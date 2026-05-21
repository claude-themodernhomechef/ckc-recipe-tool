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
const INGREDIENT_DB_NAMES = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'ingredientDBNames.json'), 'utf8')); }
  catch { return {}; }
})();
const LEARNED_SWAP_TABLE = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'learnedSwapTable.json'), 'utf8')); }
  catch { return {}; }
})();
const MASTER_SWAP_TABLE = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'masterSwapTable.json'), 'utf8')
);

// ── Diet-tag output validator ─────────────────────────────────────────────────
// Gates each {from, to} pair Claude returns against real data before we save
// it. Junk targets like "with dairy", "lactose", "already dairy" never reach
// Firestore — they get dropped and the protocol flagged uncertain so FIG
// kicks in. Bad `from` values (not in recipe ingredients) also dropped.
const VALIDATOR_KNOWN_WORDS = new Set();
for (const k of Object.keys(INGREDIENT_DB_NAMES)) {
  for (const w of k.split(/\s+/)) if (w.length > 2) VALIDATOR_KNOWN_WORDS.add(w);
}
for (const entry of Object.values(MASTER_SWAP_TABLE)) {
  for (const v of Object.values(entry)) {
    if (v && v.to) for (const w of String(v.to).toLowerCase().split(/\s+/)) if (w.length > 2) VALIDATOR_KNOWN_WORDS.add(w);
  }
}
// Single-word `to` values that look like truncated/hallucinated outputs.
const JUNK_TO_RE = /^(dairy|lactose|already|gf|df|the same|none|n\/a|tbd|see notes?|same|other|maple syrup|vegan|vegetarian)$/i;
function isValidSwapTo(to) {
  if (!to) return false;
  const t = String(to).toLowerCase().trim();
  if (!t) return false;
  if (JUNK_TO_RE.test(t)) return false;
  if (/^(replace|remove|skip|omit)\b/.test(t)) return false; // instruction text
  const words = t.split(/\s+/).filter(w => w.length > 2);
  return words.some(w => VALIDATOR_KNOWN_WORDS.has(w));
}
function fromAppearsInIngredients(from, ingredients) {
  if (!from) return false;
  const f = String(from).toLowerCase().trim();
  if (!f) return false;
  const norm = (s) => String(s).toLowerCase().replace(/[,;()]/g, ' ').replace(/\s+/g, ' ').trim();
  const ingsNorm = ingredients.map(norm);
  const fNorm = norm(f);
  if (ingsNorm.some(i => i.includes(fNorm))) return true;
  // Word-overlap: every >3-char word in `from` appears in some ingredient
  const fWords = fNorm.split(' ').filter(w => w.length > 3);
  if (!fWords.length) return false;
  return ingsNorm.some(i => fWords.every(w => i.includes(w)));
}

/**
 * Validate Claude's structured notes array for one protocol.
 * Returns { keptNotes, dropped: [{ pair, reason }] }.
 */
function validateNotes(notes, ingredients) {
  const keptNotes = [];
  const dropped   = [];
  for (const pair of (Array.isArray(notes) ? notes : [])) {
    if (!pair || !pair.from) { dropped.push({ pair, reason: 'no_from' }); continue; }
    if (!fromAppearsInIngredients(pair.from, ingredients)) {
      dropped.push({ pair, reason: 'from_not_in_recipe' });
      continue;
    }
    if (pair.type === 'remove' || pair.type === 'note') {
      keptNotes.push(pair);
      continue;
    }
    if (!isValidSwapTo(pair.to)) {
      dropped.push({ pair, reason: 'junk_to' });
      continue;
    }
    keptNotes.push(pair);
  }
  return { keptNotes, dropped };
}

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

        // ── Validate Claude's pairs ─────────────────────────────────────────
        // Drop pairs whose `from` isn't in the recipe, or whose `to` is junk
        // (e.g. "dairy", "lactose"). If anything got dropped, flag uncertain
        // so FIG product search runs as a backstop.
        const { keptNotes, dropped } = validateNotes(result.notes, ingredients);
        if (dropped.length > 0) {
          console.log(`[validator] ${proto}: dropped ${dropped.length} pair(s):`,
            dropped.map(d => `${d.reason}: ${JSON.stringify(d.pair)}`).join(' | '));
          result.uncertain = true;
          if (!result.reason) result.reason = `Validator dropped ${dropped.length} pair(s) with bad from/to`;
        }
        result.notes = keptNotes;

        // ── Prefer learned-swap-table `to` when available ──────────────────
        // Human-validated approved-recipe swaps win over AI guesses
        // (frequency >= 2 only — single-occurrence might be noise).
        for (const pair of result.notes) {
          if (pair.type !== 'replace' || !pair.from) continue;
          const key = String(pair.from).toLowerCase().trim();
          const learned = LEARNED_SWAP_TABLE[key]?.[proto];
          if (learned && learned.length > 0 && learned[0].count >= 2 && learned[0].to) {
            pair.to = learned[0].to;
          }
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

const ING_DB_PATH    = path.join(__dirname, 'ingredientNutrition_v2.json');
const SWAP_TABLE_PATH = path.join(__dirname, 'masterSwapTable.json');
let _ingDB = null, _swapTable = null;
function getIngDB() {
  if (!_ingDB) _ingDB = JSON.parse(fs.readFileSync(ING_DB_PATH, 'utf8'));
  return _ingDB;
}
function getSwapTable() {
  if (!_swapTable) _swapTable = JSON.parse(fs.readFileSync(SWAP_TABLE_PATH, 'utf8'));
  return _swapTable;
}

// ── Smart-pick helpers (mirror compute_bydiet_nutrition.js) ───────────────────

// When chef offers multiple options ("Use A, or B"), pick the one closest to
// the original ingredient. E.g. butter + "olive oil or DF butter" → DF butter.
function _pickBestOption(from, optionStr) {
  if (!/\bor\b/i.test(optionStr)) return optionStr;
  const options = optionStr.split(/\s*,?\s+or\s+/i).map(s => s.trim()).filter(Boolean);
  if (options.length <= 1) return optionStr;
  const fromLower = from.toLowerCase().trim();
  const fromWords = fromLower.split(/\s+/).filter(w => w.length > 2);
  let best = options[0];
  let bestScore = -Infinity;
  for (const opt of options) {
    const optLower = opt.toLowerCase();
    let score = 0;
    if (optLower.includes(fromLower)) score += 100;
    const optWords = optLower.split(/\s+/);
    score += fromWords.filter(w => optWords.includes(w)).length * 10;
    score -= opt.length * 0.01;
    if (score > bestScore) { bestScore = score; best = opt; }
  }
  return best;
}

// Strip cooking-purpose suffixes: "DF butter for finishing" → "DF butter"
function _cleanSwapTarget(s) {
  return s
    .replace(/\s+for\s+(?:cooking|saut[eé]ing|finishing|baking|frying|searing|garnish|serving|spritzing|drizzling|sprinkling|dipping|topping|brushing)(?:\s*\/\s*\w+)*\b[\s\w/]*$/i, '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/^\s*\d+[\d/.\s]*\s*(cups?|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|lb|pounds?|g\b|grams?|ml|cloves?|pieces?|slices?|sprigs?|cans?|jars?|bunch(?:es)?|handfuls?|pinch(?:es)?|dash(?:es)?)\s+(?:of\s+)?/i, '')
    .replace(/[,;]+\s*$/, '')
    .trim();
}

// When swap target's Serving < Piece (multi-serving package like BFree GF naan),
// rescale total grams to Serving × numServings, qty in piece units.
function _computeSwapPortion(swapEntry, numServings) {
  const measures = swapEntry?.measures || [];
  const serving = measures.find(m => m.label === 'Serving');
  const piece = measures.find(m => m.label === 'Piece') || measures.find(m => m.label === 'Whole');
  if (!piece || !serving || serving.gramWeight >= piece.gramWeight) return null;
  const newGrams = serving.gramWeight * numServings;
  const newQty = newGrams / piece.gramWeight;
  return { grams: newGrams, qty: newQty, unit: 'piece' };
}

function _fuzzyMatch(term, name) {
  const clean = x => x.toLowerCase()
    .replace(/[,;]/g, ' ')
    .replace(/^\d[\d/.\s]*\s*(pieces?|cups?|tbsp|tsp|oz|lb|g\b|ml|tablespoons?|teaspoons?|pounds?|ounces?|grams?)?\b/gi, '')
    .replace(/\b\d+\b/g, '')
    .replace(/\b(freshly\s+ground|cloves?|heads?|tbsp\s+of|tsp\s+of|cups?\s+of|\bof\b|black|white|ground|freshly|kosher|sea|fine|coarse|cracked)\b/g, '')
    .replace(/\b(extra\s+firm|firm|silken|soft|hard|large|small|medium|big|fat|thick|thin|fresh|dried|frozen|raw|cooked|whole|boneless|skinless|lean|ripe|young|baby)\b/g, '')
    .replace(/\b(dark|light|white|meat|pieces?|parts?|cuts?|handful|preferably|golden)\b/g, '')
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
  const lower = name.toLowerCase().trim()
    .replace(/\s*\([^)]*\)/g, '')  // strip parentheticals
    .replace(/\s+/g, ' ').trim();
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

function _stripLeadingQty(s) {
  return s
    .replace(/^[\d/.\s]+(?:tablespoons?|teaspoons?|cups?|tbsp|tsp|oz|lb|g\b|ml)\s*(of\s+)?/i, '')
    .replace(/^\d[\d/.\s]*\s+/, '')
    .replace(/^(the|a|an)\s+/i, '')
    .trim();
}

// Parse swap pairs from either new structured array or legacy notesText string.
// Handles 5 plain-text phrasings + smart "pick closest option" for "use A or B".
function _getSwapPairs(tagData) {
  // Format A: structured array
  if (Array.isArray(tagData.notes)) {
    return tagData.notes
      .filter(n => n.type === 'replace' || n.type === 'remove')
      .map(n => ({
        from: _stripLeadingQty((n.from || '')),
        to:   n.type === 'remove' ? null : _stripLeadingQty((n.to || '')),
      }));
  }
  // Format B: legacy plain text — apply 5 regex phrasings + smart-pick
  const text = (typeof tagData.notes === 'string' ? tagData.notes : '') || (tagData.notesText || '');
  if (!text.trim()) return [];

  const result = [];
  const s = text.toLowerCase();
  let m;

  const insteadRe = /use\s+(.+?)\s+instead\s+of\s+(.+?)(?:[,.]|$)/gi;
  while ((m = insteadRe.exec(s)) !== null) {
    const from = _stripLeadingQty(m[2].trim());
    const to   = _cleanSwapTarget(_pickBestOption(from, m[1].trim()));
    result.push({ from, to });
  }

  const replaceRe = /replace\s+(.+?)\s+with\s+(.+?)(?:[,.]|$)/gi;
  while ((m = replaceRe.exec(s)) !== null) {
    const rawTo = m[2].trim();
    m[1].split(/\s+and\s+/i).forEach(f => {
      const from = _stripLeadingQty(f.trim());
      const to   = _cleanSwapTarget(_pickBestOption(from, rawTo));
      result.push({ from, to });
    });
  }

  const skipRe = /(?:skip|omit)\s+([^,.\n]+)/gi;
  while ((m = skipRe.exec(s)) !== null) {
    result.push({ from: _stripLeadingQty(m[1].split(',')[0].trim()), to: null });
  }

  // "X: Use Y" colon-prefix swap
  const colonUseRe = /(?:^|[.;\n])\s*([^:\n.]+?):\s*use\s+([^.;\n]+?)(?=[.;\n]|$)/gi;
  while ((m = colonUseRe.exec(s)) !== null) {
    const from = _stripLeadingQty(m[1].trim());
    const to   = _cleanSwapTarget(_pickBestOption(from, m[2].trim()));
    if (from && to) result.push({ from, to });
  }

  // "X: Remove [entirely]" colon-prefix removal
  const colonRemoveRe = /(?:^|[.;\n])\s*([^:\n.]+?):\s*remove\b[^.;\n]*?(?=[.;\n]|$)/gi;
  while ((m = colonRemoveRe.exec(s)) !== null) {
    const from = _stripLeadingQty(m[1].trim());
    if (from) result.push({ from, to: null });
  }

  return result;
}

function _computeByDietForRecipe(recipeData, ingDB, swapTable) {
  const byDiet  = {};
  const servings = recipeData.nutrition?.servings ?? 1;
  const baseTotal = recipeData.nutrition?.total;
  const baseGarnishTotal = recipeData.nutrition?.garnishPerServing
    ? Object.fromEntries(Object.entries(recipeData.nutrition.garnishPerServing).map(([k,v]) => [k, (v ?? 0) * servings]))
    : {};
  const ings = recipeData.nutrition?.ingredients ?? [];

  if (!baseTotal || !ings.length) return byDiet;

  for (const [dietCode, tagData] of Object.entries(recipeData.dietTags || {})) {
    if (!tagData.mod) continue;
    const rawPairs = _getSwapPairs(tagData);
    const seenPairs = new Set();
    const pairs = rawPairs.filter(p => {
      const key = `${p.from}|||${p.to ?? '__remove__'}`;
      if (seenPairs.has(key)) return false;
      seenPairs.add(key); return true;
    });

    const workingMain    = { ...baseTotal };
    const workingGarnish = { ...baseGarnishTotal };
    const swapLog        = [];
    const garnishSwapLog = [];
    const swappedIngIndices = new Set();
    const garnishOverrides = new Map();

    // 1) Chef-note swaps
    for (const { from, to } of pairs) {
      const toLower = to ? to.toLowerCase().trim() : '';
      const origIngs = ings.filter((i, idx) =>
        !i.skip && i.matched && i.grams > 0 &&
        !swappedIngIndices.has(idx) &&
        _fuzzyMatch(from, i.name) &&
        !(toLower && (i.name || '').toLowerCase().includes(toLower))
      );
      if (!origIngs.length) continue;
      origIngs.forEach(i => swappedIngIndices.add(ings.indexOf(i)));
      const displayName = origIngs[0].name;

      const mainMatches    = origIngs.filter(i => !i.garnish);
      const garnishMatches = origIngs.filter(i =>  i.garnish);

      if (to === null) {
        const applyRemove = (matches, working, log) => {
          if (!matches.length) return;
          let totalCal = 0, anyInDB = false;
          for (const ing of matches) {
            const entry = _lookupIngredient(ing.name, ingDB);
            if (!entry) continue;
            const nutr = _calcNutrition(ing.grams, entry);
            if (!nutr) continue;
            for (const [k, v] of Object.entries(nutr))
              working[k] = Math.round(((working[k] ?? 0) - v) * 100) / 100;
            totalCal += nutr.calories ?? 0;
            anyInDB = true;
          }
          log.push(anyInDB ? `Removed ${displayName} (−${Math.round(totalCal)} cal)` : `Removed ${displayName} (not in DB)`);
        };
        applyRemove(mainMatches,    workingMain,    swapLog);
        applyRemove(garnishMatches, workingGarnish, garnishSwapLog);
        for (const ing of garnishMatches) {
          garnishOverrides.set(ings.indexOf(ing), {
            name: ing.name, originalName: ing.name,
            qty: ing.qty, unit: ing.unit, grams: ing.grams,
            nutrition: null, removed: true,
          });
        }
        continue;
      }

      const toVariants = to.split(/\s+or\s+|\s*\/\s*/);
      let swapEntry = null;
      for (const variant of toVariants) {
        swapEntry = _lookupIngredient(variant.trim(), ingDB);
        if (swapEntry) break;
      }
      if (!swapEntry) {
        if (mainMatches.length)    swapLog.push(`${displayName} → ${to} (not in DB, kept original)`);
        if (garnishMatches.length) garnishSwapLog.push(`${displayName} → ${to} (not in DB, kept original)`);
        for (const ing of garnishMatches) {
          garnishOverrides.set(ings.indexOf(ing), {
            name: to, originalName: ing.name,
            qty: ing.qty, unit: ing.unit, grams: ing.grams,
            nutrition: ing.nutrition || null, removed: false,
          });
        }
        continue;
      }

      const applyReplace = (matches, working, log, useGramsPerItem) => {
        if (!matches.length) return;
        let totalDelta = 0;
        for (const ing of matches) {
          const useGrams = useGramsPerItem ?? ing.grams;
          const origEntry = _lookupIngredient(ing.name, ingDB);
          if (origEntry) {
            const origNutr = _calcNutrition(ing.grams, origEntry);
            if (origNutr) {
              for (const [k, v] of Object.entries(origNutr))
                working[k] = Math.round(((working[k] ?? 0) - v) * 100) / 100;
              totalDelta -= origNutr.calories ?? 0;
            }
          }
          const swapNutr = _calcNutrition(useGrams, swapEntry);
          if (swapNutr) {
            for (const [k, v] of Object.entries(swapNutr))
              working[k] = Math.round(((working[k] ?? 0) + v) * 100) / 100;
            totalDelta += swapNutr.calories ?? 0;
          }
        }
        const delta = Math.round(totalDelta);
        log.push(`${displayName} → ${to} (${delta >= 0 ? '+' : ''}${delta} cal)`);
      };

      // Portion-aware sizing for garnish swaps (e.g. BFree GF naan: 60g/serving)
      const portion = _computeSwapPortion(swapEntry, servings);
      const useGrams = portion ? portion.grams / Math.max(garnishMatches.length, 1) : undefined;
      applyReplace(mainMatches,    workingMain,    swapLog);
      applyReplace(garnishMatches, workingGarnish, garnishSwapLog, useGrams);

      for (const ing of garnishMatches) {
        const grams = portion ? portion.grams : ing.grams;
        const qty   = portion ? portion.qty   : ing.qty;
        const unit  = portion ? portion.unit  : ing.unit;
        const swapNutr = _calcNutrition(grams, swapEntry);
        garnishOverrides.set(ings.indexOf(ing), {
          name: to, originalName: ing.name,
          qty, unit, grams,
          nutrition: swapNutr, removed: false,
        });
      }
    }

    // 2) Default-table fallback
    for (let idx = 0; idx < ings.length; idx++) {
      if (swappedIngIndices.has(idx)) continue;
      const ing = ings[idx];
      if (!ing || ing.skip || !ing.matched || !ing.grams) continue;
      const itemKey = (ing.name || '').toLowerCase().trim();
      const defaultEntry = swapTable[itemKey];
      const defaultSwap = defaultEntry?.[dietCode];
      if (!defaultSwap) continue;

      swappedIngIndices.add(idx);
      const displayName = ing.name;
      const isGarnish = !!ing.garnish;
      const working = isGarnish ? workingGarnish : workingMain;
      const log = isGarnish ? garnishSwapLog : swapLog;

      if (defaultSwap.type === 'remove') {
        const entry = _lookupIngredient(ing.name, ingDB);
        if (entry) {
          const nutr = _calcNutrition(ing.grams, entry);
          if (nutr) {
            for (const [k, v] of Object.entries(nutr))
              working[k] = Math.round(((working[k] ?? 0) - v) * 100) / 100;
            log.push(`Removed ${displayName} (−${Math.round(nutr.calories ?? 0)} cal) [default]`);
          }
        }
        if (isGarnish) {
          garnishOverrides.set(idx, {
            name: ing.name, originalName: ing.name,
            qty: ing.qty, unit: ing.unit, grams: ing.grams,
            nutrition: null, removed: true,
          });
        }
        continue;
      }

      if (defaultSwap.type === 'replace' && defaultSwap.to) {
        const toName = defaultSwap.to;
        const toVariants = toName.split(/\s+or\s+|\s*\/\s*/);
        let swapEntry = null;
        for (const variant of toVariants) {
          swapEntry = _lookupIngredient(variant.trim(), ingDB);
          if (swapEntry) break;
        }
        if (!swapEntry) {
          log.push(`${displayName} → ${toName} (not in DB, kept original) [default]`);
          if (isGarnish) {
            garnishOverrides.set(idx, {
              name: toName, originalName: ing.name,
              qty: ing.qty, unit: ing.unit, grams: ing.grams,
              nutrition: ing.nutrition || null, removed: false,
            });
          }
          continue;
        }

        const portion = isGarnish ? _computeSwapPortion(swapEntry, servings) : null;
        const useGrams = portion ? portion.grams : ing.grams;

        const origEntry = _lookupIngredient(ing.name, ingDB);
        let totalDelta = 0;
        if (origEntry) {
          const origNutr = _calcNutrition(ing.grams, origEntry);
          if (origNutr) {
            for (const [k, v] of Object.entries(origNutr))
              working[k] = Math.round(((working[k] ?? 0) - v) * 100) / 100;
            totalDelta -= origNutr.calories ?? 0;
          }
        }
        const swapNutr = _calcNutrition(useGrams, swapEntry);
        if (swapNutr) {
          for (const [k, v] of Object.entries(swapNutr))
            working[k] = Math.round(((working[k] ?? 0) + v) * 100) / 100;
          totalDelta += swapNutr.calories ?? 0;
        }
        const delta = Math.round(totalDelta);
        log.push(`${displayName} → ${toName} (${delta >= 0 ? '+' : ''}${delta} cal) [default]`);
        if (isGarnish) {
          garnishOverrides.set(idx, {
            name: toName, originalName: ing.name,
            qty: portion ? portion.qty : ing.qty,
            unit: portion ? portion.unit : ing.unit,
            grams: useGrams,
            nutrition: swapNutr, removed: false,
          });
        }
      }
    }

    // Build per-garnish item list for the UI breakdown
    const garnishItems = [];
    for (let idx = 0; idx < ings.length; idx++) {
      const ing = ings[idx];
      if (!ing || !ing.garnish || ing.skip) continue;
      const override = garnishOverrides.get(idx);
      garnishItems.push(override || {
        name: ing.name, originalName: ing.name,
        qty: ing.qty, unit: ing.unit, grams: ing.grams,
        nutrition: ing.nutrition || null, removed: false,
      });
    }

    if (Object.keys(workingMain).length === 0) continue;
    byDiet[dietCode] = {
      perServing:        _divideByServings(workingMain,    servings),
      garnishPerServing: _divideByServings(workingGarnish, servings),
      swapLog,
      garnishSwapLog,
      garnishItems,
    };
  }

  return byDiet;
}

exports.recomputeByDiet = onCall({ timeoutSeconds: 60 }, async (request) => {
  const recipeId = request.data?.recipeId;
  if (!recipeId) throw new Error('recipeId is required');

  const ingDB     = getIngDB();
  const swapTable = getSwapTable();
  const docRef    = admin.firestore().collection('recipes').doc(recipeId);
  const snap      = await docRef.get();
  if (!snap.exists) throw new Error(`Recipe ${recipeId} not found`);

  const byDiet = _computeByDietForRecipe(snap.data(), ingDB, swapTable);

  if (Object.keys(byDiet).length > 0) {
    await docRef.update({ 'nutrition.byDiet': byDiet });
  }

  return { recipeId, updated: Object.keys(byDiet).length, diets: Object.keys(byDiet) };
});
