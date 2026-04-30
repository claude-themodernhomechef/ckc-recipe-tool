/**
 * CKC Recipe Enrichment Cloud Function
 * =====================================
 * Triggered when a recipe's status changes to "yes".
 * Full pipeline:
 *   1. Scrape ingredients from recipe URL
 *   2. Generate Chef's Notes + Menu Description (Claude Sonnet + CKC_Chef_Notes_Guide.md)
 *   3. Verify diet tags (Claude Sonnet + CKC_Diet_Compliance_Rules.md, max_tokens=2000)
 *   4. For uncertain tags → extract ingredient → search FIG products via Supabase
 *      - Compliant product found → tag confirmed
 *      - Caution only / not found → write to `review_queue` collection, hold mod:false
 *   5. Write back to Firestore:
 *      - processingStatus: 'complete'        (no uncertainties)
 *      - processingStatus: 'pending_review'  (has uncertainties → see review_queue)
 *
 * Environment variables required (set in Firebase Console or .env):
 *   ANTHROPIC_API_KEY   — Anthropic API key
 *   SUPABASE_URL        — Your Supabase project URL (e.g. https://xxxx.supabase.co)
 *   SUPABASE_ANON_KEY   — Supabase anon/public key
 *
 * After deploy:
 *   firebase deploy --only functions
 *
 * To review uncertain items:
 *   Run: node export_review_queue.js   (exports review_queue → needs_review.csv)
 *   Then fill in Final Decision and run: python3 apply_new_review.py
 */

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onCall }            = require('firebase-functions/v2/https');
const { setGlobalOptions }  = require('firebase-functions/v2');
const admin    = require('firebase-admin');
const axios    = require('axios');
const cheerio  = require('cheerio');
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
const fs   = require('fs');
const path = require('path');

admin.initializeApp();

// Increase timeout — scraping + 3 LLM calls can take a while
setGlobalOptions({ timeoutSeconds: 540, memory: '1GiB' });

// ── Load guide files (must be present in functions/ directory before deploy) ──
// Copy from project root:
//   cp CKC_Diet_Compliance_Rules.md functions/
//   cp CKC_Chef_Notes_Guide.md functions/
const DIET_RULES = fs.readFileSync(path.join(__dirname, 'CKC_Diet_Compliance_Rules.md'), 'utf8');
const CHEF_GUIDE = fs.readFileSync(path.join(__dirname, 'CKC_Chef_Notes_Guide.md'),      'utf8');

// ── Master Swap Table ─────────────────────────────────────────────────────────
// Structured lookup of known ingredient → protocol swaps derived from Part 11 of
// CKC_Diet_Compliance_Rules.md. Used to auto-populate swap arrays when Claude
// marks a protocol as mod:true, before falling back to the FIG product search.
const MASTER_SWAP_TABLE = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'masterSwapTable.json'), 'utf8')
);

// ── Protocol → Supabase column ────────────────────────────────────────────────
const PROTO_FIELD = {
  AIP: 'aip_friendly',
  LF:  'low_fodmap',
  GF:  'gluten_free',
  DF:  'dairy_free',
  Vg:  'vegan',
  V:   'vegetarian',
  LH:  'low_histamine',
  K:   null,   // uses sugar_free + paleo columns
};

// ── Claude system prompts ─────────────────────────────────────────────────────
const CHEF_SYSTEM = `${CHEF_GUIDE}

For a given recipe, generate Chef's Notes — practical cooking tips following the guide above. Return as a single paragraph, notes separated by " | ". No bullet points, no headers, no diet protocol names.

Reply in this exact format:
CHEFS_NOTES: [notes text]`;

const DIET_SYSTEM = `You are a dietary compliance analyst for a recipe app.

<COMPLIANCE_RULES>
${DIET_RULES}
</COMPLIANCE_RULES>

Analyze all 8 protocols (GF, DF, V, Vg, K, AIP, LF, LH) and return:
- native: true if recipe is compliant AS-IS
- mod: true if recipe can be made compliant with simple targeted swaps (only if native=false)
- notes: structured array of swap/removal objects (only if mod=true). Each object must be:
    { "type": "replace", "from": "<ingredient as it appears in recipe>", "to": "<replacement>" }
    { "type": "remove",  "from": "<ingredient as it appears in recipe>" }
    { "type": "note",    "from": "<ingredient>", "note": "<quantity or usage instruction>" }
  Use "note" only when the ingredient is compliant but needs a quantity limit (e.g. LF balsamic vinegar — reduce to 1 tbsp).
  Use specific quantities where known (e.g. "from": "2 garlic cloves", "to": "1 tbsp garlic-infused oil").
  Only list the swaps/removals/notes — do NOT include ingredients that are already compliant.
- uncertain: true if less than 100% confident due to ambiguous ingredients or missing context
- reason: explain the uncertainty and name the specific uncertain ingredient (only if uncertain=true)

Rules:
- If native=true, then mod=false and notes=[]
- Only tag mod=true when there's a clear swap path that doesn't destroy the dish
- Be conservative: when in doubt, mark uncertain=true
- For AIP: if 4+ core ingredients need removal, set mod=false
- For LF: garlic-infused oil IS compliant; plain garlic is NOT

Reply ONLY with valid JSON:
{"GF":{"native":false,"mod":false,"notes":[],"uncertain":false,"reason":""},"DF":{"native":false,"mod":false,"notes":[],"uncertain":false,"reason":""},"V":{"native":false,"mod":false,"notes":[],"uncertain":false,"reason":""},"Vg":{"native":false,"mod":false,"notes":[],"uncertain":false,"reason":""},"K":{"native":false,"mod":false,"notes":[],"uncertain":false,"reason":""},"AIP":{"native":false,"mod":false,"notes":[],"uncertain":false,"reason":""},"LF":{"native":false,"mod":false,"notes":[],"uncertain":false,"reason":""},"LH":{"native":false,"mod":false,"notes":[],"uncertain":false,"reason":""}}`;

// ── Trigger ───────────────────────────────────────────────────────────────────
exports.enrichOnYes = onDocumentUpdated('recipes/{recipeId}', async (event) => {
  const before = event.data.before.data();
  const after  = event.data.after.data();

  // Only run when status transitions TO "yes" (swipe decision — triggers enrichment)
  if (after.status !== 'yes' || before.status === 'yes') return null;

  // Skip if already enriched (chefNotes is the sentinel field)
  if (after.chefNotes) {
    console.log(`[${event.params.recipeId}] Already enriched, skipping`);
    return null;
  }

  const recipeId = event.params.recipeId;
  const ref      = event.data.after.ref;

  console.log(`[${recipeId}] Starting enrichment for: ${after.name}`);

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const supabase  = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  try {
    // ── Step 1: Scrape ingredients ──────────────────────────────────────────
    let ingredients = after.ingredients || [];
    if (!ingredients.length && after.url) {
      console.log(`[${recipeId}] Scraping ingredients from ${after.url}`);
      ingredients = await scrapeIngredients(after.url);
      console.log(`[${recipeId}] Scraped ${ingredients.length} ingredients`);
    }

    if (!ingredients.length) {
      console.warn(`[${recipeId}] No ingredients scraped — aborting`);
      await ref.update({ enrichmentError: 'No ingredients scraped', processingStatus: 'error' });
      return null;
    }

    // ── Step 2: Chef's Notes ────────────────────────────────────────────────
    console.log(`[${recipeId}] Generating Chef's Notes`);
    const { chefNotes } = await generateChefContent(
      anthropic, after.name, after.cuisine || '', after.course || '', ingredients
    );

    // ── Step 3: Diet tag verification ───────────────────────────────────────
    console.log(`[${recipeId}] Verifying diet tags`);
    const dietResult = await verifyDietTags(
      anthropic, after.name, after.cuisine || '', after.course || '', ingredients
    );

    // ── Step 4: FIG product search for uncertain tags ───────────────────────
    const confirmedTags  = {};
    const uncertainItems = [];

    for (const [proto, result] of Object.entries(dietResult)) {
      // Skip protocols where recipe is neither native nor moddable
      if (!result.native && !result.mod) continue;

      if (!result.uncertain) {
        // Confident — keep tag as-is, store structured notes array + human-readable notesText
        const tag = { native: result.native, mod: result.mod };
        if (Array.isArray(result.notes) && result.notes.length > 0) {
          tag.notes     = result.notes;      // structured array (new format)
          tag.notesText = result.notesText;  // human-readable string (generated above)
        }
        confirmedTags[proto] = tag;
        continue;
      }

      // Uncertain — extract ingredient name, then search Supabase
      const ingredient = await extractUncertainIngredient(anthropic, result.reason);

      if (ingredient) {
        const matches = await searchFigProducts(supabase, ingredient, proto);

        if (matches.compliant.length > 0) {
          // Compliant product found → confirm the tag
          const tag = { native: result.native, mod: result.mod };
          if (result.notes) tag.notes = result.notes;
          confirmedTags[proto] = tag;
          console.log(`[${recipeId}] ${proto} uncertain → compliant product found (${ingredient})`);

        } else {
          // Caution or no product found → needs manual review
          const category = matches.caution.length > 0 ? 'grey_area' : 'no_product_found';
          uncertainItems.push({
            category,
            recipe:     after.name,
            protocol:   proto,
            ingredient,
            reason:     result.reason,
            caution:    matches.caution.slice(0, 3).join(' | '),
            url:        after.url || '',
            recipeId,
          });
          // Hold as mod:false until Rafi reviews
          confirmedTags[proto] = { native: false, mod: false, notes: '' };
          console.log(`[${recipeId}] ${proto} → ${category} (${ingredient}) — needs review`);
        }

      } else {
        // Can't extract specific ingredient → needs clarification
        uncertainItems.push({
          category:   'needs_clarification',
          recipe:     after.name,
          protocol:   proto,
          ingredient: '',
          reason:     result.reason,
          caution:    '',
          url:        after.url || '',
          recipeId,
        });
        confirmedTags[proto] = { native: false, mod: false, notes: '' };
        console.log(`[${recipeId}] ${proto} → needs clarification — needs review`);
      }
    }

    // ── Step 5: Write uncertain items to review_queue collection ───────────
    // These get exported to needs_review.csv via: node export_review_queue.js
    if (uncertainItems.length > 0) {
      const db    = admin.firestore();
      const batch = db.batch();
      for (const item of uncertainItems) {
        const docRef = db.collection('review_queue').doc();
        batch.set(docRef, {
          ...item,
          finalDecision: '',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
      console.log(`[${recipeId}] ${uncertainItems.length} uncertain item(s) → review_queue`);
    }

    // ── Step 6: Write back to Firestore, move to review queue ───────────────
    const processingStatus = uncertainItems.length > 0 ? 'pending_review' : 'complete';

    await ref.update({
      ingredients,
      chefNotes,
      dietTags:         confirmedTags,
      processingStatus,
      // status ('yes') is preserved — swipe decision is permanent
      enrichedAt:       admin.firestore.FieldValue.serverTimestamp(),
      enrichmentError:  admin.firestore.FieldValue.delete(),
    });

    console.log(`[${recipeId}] Enrichment done → processingStatus: ${processingStatus}`);
    return null;

  } catch (err) {
    console.error(`[${recipeId}] Enrichment failed:`, err.message);
    await ref.update({
      enrichmentError:  err.message,
      processingStatus: 'error',
      enrichedAt:       admin.firestore.FieldValue.serverTimestamp(),
    });
    return null;
  }
});

// ── Step 1: Scrape Ingredients ────────────────────────────────────────────────
async function scrapeIngredients(url) {
  try {
    const res = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
      },
    });

    const $ = cheerio.load(res.data);

    // Try JSON-LD structured data first (most reliable)
    const jsonLdScripts = $('script[type="application/ld+json"]');
    for (let i = 0; i < jsonLdScripts.length; i++) {
      try {
        const raw    = $(jsonLdScripts[i]).html();
        const parsed = JSON.parse(raw);
        const items  = parsed['@graph'] ? parsed['@graph'] : [parsed];
        for (const item of items) {
          if (item['@type'] === 'Recipe' && Array.isArray(item.recipeIngredient)) {
            return item.recipeIngredient.filter(Boolean).map(s => String(s).trim());
          }
        }
      } catch (_) {}
    }

    // Fallback: common ingredient list selectors
    const selectors = [
      '.wprm-recipe-ingredient',
      '.tasty-recipes-ingredients-body li',
      '.recipe-ingredients li',
      '[class*="ingredient"] li',
      '.ingredients li',
    ];
    for (const selector of selectors) {
      const items = [];
      $(selector).each((_, el) => {
        const text = $(el).text().trim();
        if (text) items.push(text);
      });
      if (items.length > 0) return items;
    }

    return [];
  } catch (err) {
    console.warn(`Scrape failed for ${url}: ${err.message}`);
    return [];
  }
}

// ── Step 2: Chef's Notes + Menu Description ───────────────────────────────────
async function generateChefContent(anthropic, name, cuisine, course, ingredients) {
  const ingStr = ingredients.join(', ');

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await anthropic.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 600,
        system: [{ type: 'text', text: CHEF_SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: [{
          role:    'user',
          content: `Recipe: ${name} (${cuisine || '–'}, ${course || '–'})\nKey ingredients: ${ingStr}\n\nGenerate Chef's Notes and Menu Description.`,
        }],
      });

      const text   = resp.content[0].text;
      const notesM = text.match(/CHEFS_NOTES:\s*([\s\S]+?)(?=\n---|$)/);
      return {
        chefNotes: notesM ? notesM[1].trim() : '',
      };
    } catch (err) {
      if (attempt === 3) throw err;
      await sleep(attempt * 2000);
    }
  }
}

// ── Step 3: Diet tag verification ─────────────────────────────────────────────
async function verifyDietTags(anthropic, name, cuisine, course, ingredients) {
  const ingStr = ingredients.join('\n');

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await anthropic.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 2000,
        system: [{ type: 'text', text: DIET_SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: [{
          role:    'user',
          content: `Recipe: ${name}\nCuisine: ${cuisine || '–'}\nCourse: ${course || '–'}\nIngredients:\n${ingStr}`,
        }],
      });

      let text = resp.content[0].text.trim();
      text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(text);

      // Post-process: for each protocol where mod=true, ensure notes is an array
      // and generate a human-readable notesText string from it.
      for (const [proto, result] of Object.entries(parsed)) {
        if (!result.mod) continue;

        // Normalise notes to array (guard against Claude returning a string)
        if (!Array.isArray(result.notes)) {
          result.notes = result.notes ? [] : [];
        }

        // Merge any Master Swap Table matches not already covered by Claude's output
        const masterSwaps = applyMasterSwaps(ingredients, proto);
        if (masterSwaps.length > 0) {
          // Avoid duplicating swaps Claude already identified (match by 'from' key)
          const existingFroms = new Set(result.notes.map(s => s.from?.toLowerCase() ?? ''));
          for (const swap of masterSwaps) {
            if (!existingFroms.has(swap.from.toLowerCase())) {
              result.notes.push(swap);
            }
          }
        }

        // Build human-readable notesText from the structured array
        result.notesText = buildNotesText(result.notes);
      }

      return parsed;
    } catch (err) {
      if (attempt === 3) throw err;
      await sleep(attempt * 2000);
    }
  }
}

// ── Master Swap Table lookup ──────────────────────────────────────────────────
/**
 * Prep-word normalization: strips quantities, units, and common culinary
 * preparation descriptors so ingredient strings can be matched against the
 * masterSwapTable keys (which are bare lowercase base names).
 */
const PREP_WORDS = new Set([
  'diced', 'minced', 'chopped', 'sliced', 'grated', 'shredded', 'julienned',
  'crushed', 'peeled', 'deveined', 'trimmed', 'halved', 'quartered', 'cubed',
  'fresh', 'dried', 'frozen', 'canned', 'cooked', 'raw', 'roasted', 'toasted',
  'large', 'small', 'medium', 'extra', 'firm', 'soft', 'whole', 'ground',
  'finely', 'roughly', 'thinly', 'lightly', 'packed', 'heaping', 'leveled',
]);

const UNIT_RE = /^[\d\s/½¼¾⅓⅔.]+\s*(tbsp|tsp|tablespoons?|teaspoons?|cups?|oz|lb|g\b|ml|pounds?|ounces?|cloves?|stalks?|heads?|bunches?|cans?|jars?|packages?|inch|cm|sprigs?)\.?\s*/i;

function normalizeIngredient(raw) {
  return raw
    .toLowerCase()
    .replace(UNIT_RE, '')              // strip leading quantity + unit
    .replace(/^\d[\d/.\s]*\s+/, '')    // strip bare leading numbers
    .split(/\s+/)
    .filter(w => !PREP_WORDS.has(w))   // remove prep words
    .join(' ')
    .trim();
}

/**
 * applyMasterSwaps(ingredients, protocol)
 * ----------------------------------------
 * Takes an array of raw recipe ingredient strings and a protocol code.
 * Returns an array of swap objects (same shape as Claude's notes array)
 * for every ingredient that has a known entry in masterSwapTable for that protocol.
 *
 * Uses substring matching: if the normalized ingredient string contains
 * a masterSwapTable key (or vice-versa), it's a match.
 */
function applyMasterSwaps(ingredients, protocol) {
  const swaps = [];
  const tableKeys = Object.keys(MASTER_SWAP_TABLE);

  for (const raw of ingredients) {
    const normalized = normalizeIngredient(raw);
    if (!normalized) continue;

    for (const key of tableKeys) {
      const entry = MASTER_SWAP_TABLE[key]?.[protocol];
      if (!entry) continue;

      // Substring match in either direction
      if (normalized.includes(key) || key.includes(normalized)) {
        const swap = { from: raw };
        if (entry.type === 'replace') {
          swap.type = 'replace';
          swap.to   = entry.to;
          if (entry.note) swap.note = entry.note;
        } else if (entry.type === 'note') {
          swap.type = 'note';
          swap.note = entry.note;
        } else {
          swap.type = 'remove';
        }
        swaps.push(swap);
        break; // one match per ingredient string is enough
      }
    }
  }

  return swaps;
}

/**
 * buildNotesText(notesArray)
 * ---------------------------
 * Converts a structured swaps array into a human-readable paragraph string.
 * - replace: "Replace [from] with [to]."
 * - remove:  "Remove [from] entirely."
 * Sentences are joined with a space.
 */
function buildNotesText(notesArray) {
  if (!Array.isArray(notesArray) || notesArray.length === 0) return '';
  return notesArray.map(s => {
    if (s.type === 'replace') return `Replace ${s.from} with ${s.to}.`;
    if (s.type === 'note')    return s.note;
    return `Remove ${s.from} entirely.`;
  }).join(' ');
}

// ── Step 4a: Extract uncertain ingredient via Claude Haiku ────────────────────
async function extractUncertainIngredient(anthropic, reason) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await anthropic.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 50,
        system: [{
          type:          'text',
          text:          'Extract the single most specific problematic ingredient name from a diet compliance uncertainty note. Return ONLY the ingredient name — 1 to 4 words, lowercase. If no specific ingredient (e.g. serving size uncertainty), return: SKIP',
          cache_control: { type: 'ephemeral' },
        }],
        messages: [{ role: 'user', content: `Reason: ${reason}\n\nIngredient name:` }],
      });

      const text = resp.content[0].text.trim().toLowerCase().replace(/[^a-z0-9\s\-']/g, '').trim();
      return (text === 'skip' || !text) ? null : text;
    } catch (err) {
      if (attempt === 3) return null;
      await sleep(attempt * 1500);
    }
  }
}

// ── Step 4b: Search FIG products via Supabase ─────────────────────────────────
// Table name: ckc_products  (update if different in your Supabase project)
async function searchFigProducts(supabase, ingredient, protocol) {
  const results = { compliant: [], caution: [], not_compliant: [] };

  try {
    let selectFields = 'name';
    if (protocol === 'K') {
      selectFields += ', sugar_free, paleo';
    } else if (PROTO_FIELD[protocol]) {
      selectFields += `, ${PROTO_FIELD[protocol]}`;
    }

    const { data, error } = await supabase
      .from('products')
      .select(selectFields)
      .ilike('name', `%${ingredient}%`)
      .limit(100);

    if (error) {
      console.warn(`Supabase search error for "${ingredient}": ${error.message}`);
      return results;
    }

    for (const product of (data || [])) {
      const status = getCompliance(product, protocol);
      if (results[status]) results[status].push(product.name);
    }
  } catch (err) {
    console.warn(`FIG search failed for "${ingredient}": ${err.message}`);
  }

  return results;
}

function getCompliance(product, protocol) {
  if (protocol === 'K') {
    const sf = product.sugar_free;
    const pa = product.paleo;
    if (sf === 'compliant' && pa === 'compliant')         return 'compliant';
    if (sf === 'not_compliant' || pa === 'not_compliant') return 'not_compliant';
    return 'caution';
  }
  const field = PROTO_FIELD[protocol];
  const val   = field ? product[field] : undefined;
  return ['compliant', 'caution', 'not_compliant'].includes(val) ? val : 'caution';
}

// ── Utility ───────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── recomputeByDiet ───────────────────────────────────────────────────────────
// Callable from the review queue app after swap notes are saved.
// Re-derives nutrition.byDiet for every mod diet tag on the recipe.

const ING_DB_PATH = path.join(__dirname, 'ingredientNutrition_v2.json');
let _ingDB = null;
function getIngDB() {
  if (!_ingDB) _ingDB = JSON.parse(fs.readFileSync(ING_DB_PATH, 'utf8'));
  return _ingDB;
}

function _fuzzyMatch(term, name) {
  const clean = x => x.toLowerCase()
    .replace(/[,;]/g, ' ')
    .replace(/\b(freshly\s+ground|cloves?|heads?|tbsp\s+of|tsp\s+of|cups?\s+of|\bof\b|black|white|ground|freshly|kosher|sea|fine|coarse|cracked)\b/g, '')
    .replace(/\b(extra\s+firm|firm|silken|soft|hard|large|small|medium|big|fat|thick|thin|fresh|dried|frozen|raw|cooked|whole|boneless|skinless|lean|ripe|young|baby)\b/g, '')
    .replace(/\b(diced|sliced|chopped|minced|grated|crushed|halved|quartered|peeled|seeded|cubed|shredded|julienned|torn)\b/g, '')
    .replace(/\s+/g, ' ').trim();
  const b = clean(name);
  const nosp = x => x.replace(/\s+/g, '');
  const variants = term.split('/').map(v => clean(v.trim())).filter(Boolean);
  for (const a of variants) {
    if (a === b || nosp(a) === nosp(b)) return true;
    const aWords = a.split(' ').filter(w => w.length > 2);
    if (aWords.length > 0 && aWords.every(w => b.includes(w))) return true;
    const bWords = b.split(' ').filter(w => w.length > 2);
    if (bWords.length > 0 && bWords.every(w => a.includes(w))) return true;
  }
  return false;
}

function _lookupIngredient(name, ingDB) {
  const lower = name.toLowerCase().trim();
  if (ingDB[lower]) return ingDB[lower];
  const cleaned = lower
    .replace(/\bcut\s+into\b.*$/i, '')
    .replace(/\b(extra\s+firm|firm|silken|soft|hard|large|small|medium|big|fat|thick|thin|fresh|dried|frozen|raw|cooked|whole|boneless|skinless|bone-?in|skin-?on|lean|ripe|young|baby)\b/g, '')
    .replace(/\b(diced|sliced|chopped|minced|grated|crushed|halved|quartered|peeled|seeded|cubed|shredded|crumbled|julienned|torn)\b/g, '')
    .replace(/\b(for|the|and|with|from|into|about|approx)\b/g, '')
    .replace(/\s+/g, ' ').trim();
  if (ingDB[cleaned]) return ingDB[cleaned];
  const words = cleaned.split(' ').filter(w => w.length > 3);
  if (words.length > 0) {
    const match = Object.keys(ingDB).find(k => words.every(w => k.includes(w)));
    if (match) return ingDB[match];
  }
  const shortWords = cleaned.split(' ').filter(w => w.length > 3).slice(0, 2);
  if (shortWords.length > 0) {
    const match = Object.keys(ingDB).find(k => shortWords.every(w => k.includes(w)));
    if (match) return ingDB[match];
  }
  return null;
}

function _calcNutrition(grams, ingEntry) {
  if (!grams || !ingEntry?.per100g) return null;
  const result = {};
  for (const [k, raw] of Object.entries(ingEntry.per100g)) {
    const val = typeof raw === 'object' ? (raw.value ?? 0) : raw;
    result[k] = Math.round((val * grams / 100) * 100) / 100;
  }
  return result;
}

function _divideByServings(total, servings) {
  const srv = parseFloat(String(servings)) || 1;
  return Object.fromEntries(
    Object.entries(total).map(([k, v]) => [k, Math.round((Math.max(0, v) / srv) * 100) / 100])
  );
}

// Parse swap pairs from either new structured array or legacy notesText string
function _getSwapPairs(tagData) {
  // New format: notes is an array of { type, from, to } objects
  if (Array.isArray(tagData.notes)) {
    return tagData.notes
      .filter(n => n.type === 'replace' || n.type === 'remove')
      .map(n => ({
        from: (n.from || '')
          .replace(/^\d[\d/.\s]*\s*(tablespoons?|teaspoons?|cups?|tbsp|tsp|oz|lb|g\b|ml)\s*(of\s+)?/i, '')
          .replace(/^\d+\s+/, '')
          .trim(),
        to:   n.type === 'remove' ? null : (n.to || '')
          .replace(/^\d[\d/.\s]*\s*(tablespoons?|teaspoons?|cups?|tbsp|tsp|oz|lb|g\b|ml)\s*(of\s+)?/i, '')
          .trim(),
      }));
  }
  // Legacy format: notesText or notes is a plain string — parse it
  const text = (typeof tagData.notes === 'string' ? tagData.notes : '') || (tagData.notesText || '');
  if (!text.trim()) return [];

  const result = [];
  const s = text.toLowerCase();
  const stopStr = `(?:[,.–—]|\\s+[—–]|$)`;
  let m;

  const replaceRe = new RegExp(`replace\\s+([^.]+?)\\s+with\\s+([^.]+?)${stopStr}`, 'gi');
  while ((m = replaceRe.exec(s)) !== null) {
    const rawTo = m[2].trim();
    m[1].split(/\s+and\s+/i).forEach(f => {
      const from = f.trim().replace(/^\d[\d/.\s]*\s*(tablespoons?|teaspoons?|cups?|tbsp|tsp|oz|lb|g\b|ml)\s*(of\s+)?/i, '').replace(/^(the|a|an)\s+/i, '').trim();
      const to   = rawTo.replace(/^\d[\d/.\s]*\s*(tablespoons?|teaspoons?|cups?|tbsp|tsp|oz|lb|g\b|ml)\s*(of\s+)?/i, '').trim();
      if (from) result.push({ from, to });
    });
  }
  const removeRe = /remove\s+([^,.\n—––—]+)/gi;
  while ((m = removeRe.exec(s)) !== null)
    result.push({ from: m[1].trim().replace(/^(the|a|an)\s+/i, '').trim(), to: null });

  return result;
}

function _computeByDietForRecipe(recipeData, ingDB) {
  const byDiet  = {};
  const servings = recipeData.nutrition?.servings ?? 1;
  const baseTotal = recipeData.nutrition?.total;
  const ings      = recipeData.nutrition?.ingredients ?? [];

  if (!baseTotal || !ings.length) return byDiet;

  for (const [dietCode, tagData] of Object.entries(recipeData.dietTags || {})) {
    if (!tagData.mod) continue;
    const pairs = _getSwapPairs(tagData);
    if (!pairs.length) continue;

    const workingTotal = { ...baseTotal };
    const swapLog = [];

    for (const { from, to } of pairs) {
      const origIngs = ings.filter(i => !i.skip && i.matched && i.grams > 0 && _fuzzyMatch(from, i.name));
      if (!origIngs.length) continue;

      for (const origIng of origIngs) {
        const origEntry = _lookupIngredient(origIng.name, ingDB);

        if (to === null) {
          if (origEntry) {
            const origNutr = _calcNutrition(origIng.grams, origEntry);
            if (origNutr) {
              for (const [k, v] of Object.entries(origNutr))
                workingTotal[k] = Math.round(((workingTotal[k] ?? 0) - v) * 100) / 100;
              swapLog.push(`Removed ${origIng.name} (−${Math.round(origNutr.calories ?? 0)} cal)`);
            }
          } else {
            swapLog.push(`Removed ${origIng.name} (not in DB)`);
          }
          continue;
        }

        const swapEntry = _lookupIngredient(to, ingDB);
        if (!swapEntry) {
          swapLog.push(`${origIng.name} → ${to} (not in DB, kept original)`);
          continue;
        }
        if (origEntry) {
          const origNutr = _calcNutrition(origIng.grams, origEntry);
          if (origNutr)
            for (const [k, v] of Object.entries(origNutr))
              workingTotal[k] = Math.round(((workingTotal[k] ?? 0) - v) * 100) / 100;
        }
        const swapNutr = _calcNutrition(origIng.grams, swapEntry);
        if (swapNutr) {
          for (const [k, v] of Object.entries(swapNutr))
            workingTotal[k] = Math.round(((workingTotal[k] ?? 0) + v) * 100) / 100;
          const origCal = origEntry ? Math.round(_calcNutrition(origIng.grams, origEntry)?.calories ?? 0) : 0;
          const delta   = Math.round(swapNutr.calories ?? 0) - origCal;
          swapLog.push(`${origIng.name} → ${to} (${delta >= 0 ? '+' : ''}${delta} cal)`);
        }
      }
    }

    byDiet[dietCode] = { perServing: _divideByServings(workingTotal, servings), swapLog };
  }

  return byDiet;
}

exports.recomputeByDiet = onCall({ timeoutSeconds: 60 }, async (request) => {
  const recipeId = request.data?.recipeId;
  if (!recipeId) throw new Error('recipeId is required');

  const ingDB   = getIngDB();
  const docRef  = admin.firestore().collection('recipes').doc(recipeId);
  const snap    = await docRef.get();
  if (!snap.exists) throw new Error(`Recipe ${recipeId} not found`);

  const byDiet = _computeByDietForRecipe(snap.data(), ingDB);

  if (Object.keys(byDiet).length > 0) {
    await docRef.update({ 'nutrition.byDiet': byDiet });
  }

  return { recipeId, updated: Object.keys(byDiet).length, diets: Object.keys(byDiet) };
});
