/**
 * backfill_diet_tags.js
 * ─────────────────────
 * Re-runs diet tag verification on all recipes with processingStatus = 'pending_review'
 * or 'complete' (i.e. already enriched) using the updated pipeline:
 *   - New masterSwapTable with Rafi's corrections
 *   - type: "note" support
 *   - V protocol no longer flags dairy/eggs/honey
 *
 * Run from repo root:
 *   node scripts/backfill_diet_tags.js
 *
 * Optional: process a single recipe by ID:
 *   node scripts/backfill_diet_tags.js <recipeId>
 *
 * Env: reads scripts/functions/.env for ANTHROPIC_API_KEY / SUPABASE_URL / SUPABASE_ANON_KEY
 *      Falls back to process.env if already set.
 *
 * Safety:
 *   - DRY_RUN=true  → prints what would change, writes nothing to Firestore
 *   - BATCH_SIZE     → recipes per batch (default 5, max 10 to avoid rate limits)
 *   - DELAY_MS       → ms between batches (default 3000)
 */

const fs   = require('fs');
const path = require('path');

// Load .env from functions directory (no dotenv dependency needed)
const envPath = path.join(__dirname, '../functions/.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const FN = path.resolve(__dirname, '../functions/node_modules');
const admin    = require('firebase-admin');
const Anthropic = require(path.join(FN, '@anthropic-ai/sdk'));
const { createClient } = require(path.join(FN, '@supabase/supabase-js'));

// ── Config ────────────────────────────────────────────────────────────────────
const DRY_RUN    = process.env.DRY_RUN === 'true';
const BATCH_SIZE = Math.min(parseInt(process.env.BATCH_SIZE || '5', 10), 10);
const DELAY_MS   = parseInt(process.env.DELAY_MS || '3000', 10);
const TARGET_IDS = process.argv.slice(2).filter(Boolean);

// ── Load support files ────────────────────────────────────────────────────────
const DIET_RULES = fs.readFileSync(
  path.join(__dirname, '../functions/CKC_Diet_Compliance_Rules.md'), 'utf8'
);
const MASTER_SWAP_TABLE = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../functions/masterSwapTable.json'), 'utf8')
);

// ── Firebase init ─────────────────────────────────────────────────────────────
const serviceAccount = require('../service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Claude + Supabase clients ─────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase  = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// ── Diet prompt (mirrors functions/index.js) ──────────────────────────────────
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
  Use "note" only when the ingredient is compliant but needs a quantity limit (e.g. LF balsamic vinegar).
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

// ── Helpers (mirrors functions/index.js) ──────────────────────────────────────
const PREP_WORDS = new Set([
  'diced','minced','chopped','sliced','grated','shredded','julienned','crushed',
  'peeled','deveined','trimmed','halved','quartered','cubed','fresh','dried',
  'frozen','canned','cooked','raw','roasted','toasted','large','small','medium',
  'extra','firm','soft','whole','ground','finely','roughly','thinly','lightly',
  'packed','heaping','leveled',
]);
const UNIT_RE = /^[\d\s/½¼¾⅓⅔.]+\s*(tbsp|tsp|tablespoons?|teaspoons?|cups?|oz|lb|g\b|ml|pounds?|ounces?|cloves?|stalks?|heads?|bunches?|cans?|jars?|packages?|inch|cm|sprigs?)\.?\s*/i;

function normalizeIngredient(raw) {
  return raw.toLowerCase()
    .replace(UNIT_RE, '')
    .replace(/^\d[\d/.\s]*\s+/, '')
    .split(/\s+/).filter(w => !PREP_WORDS.has(w)).join(' ').trim();
}

function applyMasterSwaps(ingredients, protocol) {
  const swaps = [];
  const tableKeys = Object.keys(MASTER_SWAP_TABLE);
  for (const raw of ingredients) {
    const normalized = normalizeIngredient(raw);
    if (!normalized) continue;
    for (const key of tableKeys) {
      const entry = MASTER_SWAP_TABLE[key]?.[protocol];
      if (!entry) continue;
      if (normalized.includes(key) || key.includes(normalized)) {
        const swap = { from: raw };
        if (entry.type === 'replace') {
          swap.type = 'replace'; swap.to = entry.to;
          if (entry.note) swap.note = entry.note;
        } else if (entry.type === 'note') {
          swap.type = 'note'; swap.note = entry.note;
        } else {
          swap.type = 'remove';
        }
        swaps.push(swap);
        break;
      }
    }
  }
  return swaps;
}

function buildNotesText(notesArray) {
  if (!Array.isArray(notesArray) || notesArray.length === 0) return '';
  return notesArray.map(s => {
    if (s.type === 'replace') return `Replace ${s.from} with ${s.to}.`;
    if (s.type === 'note')    return s.note;
    return `Remove ${s.from} entirely.`;
  }).join(' ');
}

async function verifyDietTags(name, cuisine, course, ingredients) {
  const ingStr = ingredients.join('\n');
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: [{ type: 'text', text: DIET_SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: `Recipe: ${name}\nCuisine: ${cuisine||'–'}\nCourse: ${course||'–'}\nIngredients:\n${ingStr}` }],
      });
      let text = resp.content[0].text.trim()
        .replace(/^```json\s*/, '').replace(/\s*```$/, '');
      // Extract first balanced {...} block to tolerate stray prose before/after JSON.
      const start = text.indexOf('{');
      if (start >= 0) {
        let depth = 0, end = -1, inStr = false, esc = false;
        for (let i = start; i < text.length; i++) {
          const c = text[i];
          if (esc) { esc = false; continue; }
          if (c === '\\' && inStr) { esc = true; continue; }
          if (c === '"') inStr = !inStr;
          else if (!inStr && c === '{') depth++;
          else if (!inStr && c === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
        }
        if (end > start) text = text.substring(start, end);
      }
      const parsed = JSON.parse(text);

      for (const [proto, result] of Object.entries(parsed)) {
        if (!result.mod) continue;
        if (!Array.isArray(result.notes)) result.notes = [];
        const masterSwaps = applyMasterSwaps(ingredients, proto);
        if (masterSwaps.length > 0) {
          const existingFroms = new Set(result.notes.map(s => s.from?.toLowerCase() ?? ''));
          for (const swap of masterSwaps) {
            if (!existingFroms.has(swap.from.toLowerCase())) result.notes.push(swap);
          }
        }
        result.notesText = buildNotesText(result.notes);
      }
      return parsed;
    } catch (err) {
      if (attempt === 3) throw err;
      await sleep(attempt * 2000);
    }
  }
}

async function searchFigProducts(ingredient, proto) {
  const PROTO_FIELD = {
    AIP: 'aip_friendly', LF: 'low_fodmap', GF: 'gluten_free', DF: 'dairy_free',
    Vg: 'vegan', V: 'vegetarian', LH: 'low_histamine', K: null,
  };
  const field = PROTO_FIELD[proto];
  if (!field) return { compliant: [], caution: [] };
  try {
    const { data } = await supabase.from('products')
      .select('name,' + field)
      .ilike('name', `%${ingredient}%`)
      .limit(10);
    const compliant = (data || []).filter(p => p[field] === true).map(p => p.name);
    const caution   = (data || []).filter(p => p[field] === false).map(p => p.name);
    return { compliant, caution };
  } catch { return { compliant: [], caution: [] }; }
}

async function extractUncertainIngredient(reason) {
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      messages: [{ role: 'user', content: `Extract the single most specific problematic ingredient name from this note. Return ONLY the ingredient name (1-4 words, lowercase). If no specific ingredient, return: SKIP\n\n${reason}` }],
    });
    const name = resp.content[0].text.trim().toLowerCase();
    return name === 'skip' ? null : name;
  } catch { return null; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔄 CKC Diet Tag Backfill`);
  console.log(`   DRY_RUN:    ${DRY_RUN}`);
  console.log(`   BATCH_SIZE: ${BATCH_SIZE}`);
  console.log(`   DELAY_MS:   ${DELAY_MS}ms`);
  if (TARGET_IDS.length) console.log(`   TARGETS:    ${TARGET_IDS.length} id(s)`);
  console.log('');

  // Fetch recipes to process
  let recipes = [];
  if (TARGET_IDS.length) {
    const snaps = await Promise.all(
      TARGET_IDS.map(id => db.collection('recipes').doc(id).get())
    );
    const missing = [];
    for (let i = 0; i < snaps.length; i++) {
      if (!snaps[i].exists) missing.push(TARGET_IDS[i]);
      else recipes.push({ id: snaps[i].id, ...snaps[i].data() });
    }
    if (missing.length) console.warn(`⚠️  Not found: ${missing.join(', ')}`);
  } else {
    // All enriched recipes that have chefNotes (i.e. went through the pipeline)
    const snap = await db.collection('recipes')
      .where('processingStatus', 'in', ['complete', 'pending_review'])
      .get();
    // Skip any already backfilled (resume-safe)
    recipes = snap.docs
      .filter(d => !d.data().backfilledAt)
      .map(d => ({ id: d.id, ...d.data() }));
  }

  console.log(`Found ${recipes.length} recipes to backfill\n`);

  let done = 0, errors = 0, skipped = 0;

  for (let i = 0; i < recipes.length; i += BATCH_SIZE) {
    const batch = recipes.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async recipe => {
      const { id, name, cuisine, course, ingredients } = recipe;
      if (!ingredients?.length) { skipped++; return; }

      try {
        const dietResult = await verifyDietTags(name, cuisine || '', course || '', ingredients);

        const confirmedTags = {};
        const uncertainItems = [];

        for (const [proto, result] of Object.entries(dietResult)) {
          if (!result.native && !result.mod) continue;

          if (!result.uncertain) {
            const tag = { native: result.native, mod: result.mod };
            if (Array.isArray(result.notes) && result.notes.length > 0) {
              tag.notes     = result.notes;
              tag.notesText = result.notesText;
            }
            confirmedTags[proto] = tag;
            continue;
          }

          const ingredient = await extractUncertainIngredient(result.reason);
          if (ingredient) {
            const matches = await searchFigProducts(ingredient, proto);
            if (matches.compliant.length > 0) {
              const tag = { native: result.native, mod: result.mod };
              if (result.notes) tag.notes = result.notes;
              confirmedTags[proto] = tag;
            } else {
              uncertainItems.push({ proto, ingredient, reason: result.reason });
              confirmedTags[proto] = { native: false, mod: false, notes: '' };
            }
          } else {
            uncertainItems.push({ proto, ingredient: '', reason: result.reason });
            confirmedTags[proto] = { native: false, mod: false, notes: '' };
          }
        }

        const processingStatus = uncertainItems.length > 0 ? 'pending_review' : 'complete';

        if (DRY_RUN) {
          console.log(`[DRY] ${id} — ${name}`);
          console.log(`      tags: ${Object.keys(confirmedTags).join(', ')}`);
          if (uncertainItems.length) console.log(`      uncertain: ${uncertainItems.map(u => u.proto).join(', ')}`);
        } else {
          await db.collection('recipes').doc(id).update({
            dietTags:         confirmedTags,
            processingStatus,
            backfilledAt:     admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`✅ ${id} — ${name} (${processingStatus})`);
        }
        done++;
      } catch (err) {
        console.error(`❌ ${id} — ${name}: ${err.message}`);
        errors++;
      }
    }));

    if (i + BATCH_SIZE < recipes.length) await sleep(DELAY_MS);

    const pct = Math.round(((i + BATCH_SIZE) / recipes.length) * 100);
    console.log(`   Progress: ${Math.min(i + BATCH_SIZE, recipes.length)}/${recipes.length} (${pct}%)\n`);
  }

  console.log('\n─────────────────────────────────');
  console.log(`Done:    ${done}`);
  console.log(`Errors:  ${errors}`);
  console.log(`Skipped: ${skipped} (no ingredients)`);
  process.exit(errors > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
