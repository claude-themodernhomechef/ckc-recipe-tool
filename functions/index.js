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

// ── Menu description examples ─────────────────────────────────────────────────
const MENU_DESC_EXAMPLES = `Menu Description examples (all lowercase, no period):
- "pan-seared salmon over garlic butter orzo with roasted cherry tomatoes and fresh basil"
- "ground turkey slow-cooked with chipotle and red bell peppers, topped with sharp cheddar, green onion, and cilantro"
- "silky roasted beet and chickpea hummus garnished with aleppo pepper, za'atar, and a drizzle of olive oil"
- "grilled fresh peaches over fluffy quinoa with cherry tomatoes, cucumber, red onion, and fresh herbs in a light citrus vinaigrette"
- "crispy pan-fried chicken thighs glazed with honey, soy, and garlic over jasmine rice with scallions"`;

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

${MENU_DESC_EXAMPLES}

For a given recipe, generate:
1. Chef's Notes — practical cooking tips following the guide above. Return as a single paragraph, notes separated by " | ". No bullet points, no headers, no diet protocol names.
2. Menu Description — a single lowercase phrase describing the dish (no period).

Reply in this exact format:
CHEFS_NOTES: [notes text]
---
MENU_DESC: [description text]`;

const DIET_SYSTEM = `You are a dietary compliance analyst for a recipe app.

<COMPLIANCE_RULES>
${DIET_RULES}
</COMPLIANCE_RULES>

Analyze all 8 protocols (GF, DF, V, Vg, K, AIP, LF, LH) and return:
- native: true if recipe is compliant AS-IS
- mod: true if recipe can be made compliant with simple targeted swaps (only if native=false)
- notes: specific swap instructions in this style — full explanatory sentences with specific quantities, what stays compliant. E.g. "Replace 2 garlic cloves with 1 tbsp garlic-infused oil. All other ingredients are LF-compliant." (only if mod=true)
- uncertain: true if less than 100% confident due to ambiguous ingredients or missing context
- reason: explain the uncertainty and name the specific uncertain ingredient (only if uncertain=true)

Rules:
- If native=true, then mod=false and notes=""
- Only tag mod=true when there's a clear swap path that doesn't destroy the dish
- Be conservative: when in doubt, mark uncertain=true
- For AIP: if 4+ core ingredients need removal, set mod=false
- For LF: garlic-infused oil IS compliant; plain garlic is NOT

Reply ONLY with valid JSON:
{"GF":{"native":false,"mod":false,"notes":"","uncertain":false,"reason":""},"DF":{"native":false,"mod":false,"notes":"","uncertain":false,"reason":""},"V":{"native":false,"mod":false,"notes":"","uncertain":false,"reason":""},"Vg":{"native":false,"mod":false,"notes":"","uncertain":false,"reason":""},"K":{"native":false,"mod":false,"notes":"","uncertain":false,"reason":""},"AIP":{"native":false,"mod":false,"notes":"","uncertain":false,"reason":""},"LF":{"native":false,"mod":false,"notes":"","uncertain":false,"reason":""},"LH":{"native":false,"mod":false,"notes":"","uncertain":false,"reason":""}}`;

// ── Trigger ───────────────────────────────────────────────────────────────────
exports.enrichOnYes = onDocumentUpdated('recipes/{recipeId}', async (event) => {
  const before = event.data.before.data();
  const after  = event.data.after.data();

  // Only run when status transitions TO "yes"
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

    // ── Step 2: Chef's Notes + Menu Description ─────────────────────────────
    console.log(`[${recipeId}] Generating Chef's Notes + Menu Description`);
    const { chefNotes, menuDescription } = await generateChefContent(
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
        // Confident — keep tag as-is
        const tag = { native: result.native, mod: result.mod };
        if (result.notes) tag.notes = result.notes;
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

    // ── Step 6: Write back to Firestore ─────────────────────────────────────
    const processingStatus = uncertainItems.length > 0 ? 'pending_review' : 'complete';

    await ref.update({
      ingredients,
      chefNotes,
      menuDescription,
      dietTags:         confirmedTags,
      processingStatus,
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
      const descM  = text.match(/MENU_DESC:\s*([\s\S]+?)(?=\n---|$)/);
      return {
        chefNotes:       notesM ? notesM[1].trim() : '',
        menuDescription: descM  ? descM[1].trim()  : '',
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
      return JSON.parse(text);
    } catch (err) {
      if (attempt === 3) throw err;
      await sleep(attempt * 2000);
    }
  }
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
