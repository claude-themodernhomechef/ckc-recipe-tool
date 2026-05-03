/**
 * crossref_diet_products.js
 * ──────────────────────────
 * For each uncertain diet flag:
 *   1. Uses Claude to extract the specific problematic ingredient from the reason text
 *   2. Searches all 329k FIG products for that ingredient by name
 *   3. Checks protocol compliance (compliant / caution / not_compliant)
 *
 * Rules:
 *   - compliant product found  → mod confirmed
 *   - caution only             → grey area (noted)
 *   - not_compliant only       → mod not possible
 *   - nothing found            → no product in FIG DB
 *   - identity-destroying list → mod: false, skip search
 *
 * Keto uses sugar_free + paleo (both must be compliant)
 * Caution = not compliant unless a compliant product also exists
 *
 * Usage:
 *   node crossref_diet_products.js
 *   node crossref_diet_products.js --concurrency 5
 */

const Anthropic = require('./functions/node_modules/@anthropic-ai/sdk');
const fs        = require('fs');
const path      = require('path');

// ── Config ─────────────────────────────────────────────────────────────────────
const UNCERT_FILE   = path.join(__dirname, 'diet_uncertainty_report.json');
const PRODUCTS_FILE = '/Users/rafi/Desktop/Claude-MHC/Fig Scraper/ckc_products_cleaned_2026-03-29.json';
const PROGRESS_FILE = path.join(__dirname, 'crossref_progress.json');
const OUT_FILE      = path.join(__dirname, 'diet_product_crossref_report.json');

const envContent  = fs.readFileSync(path.join(__dirname, 'functions', '.env'), 'utf8');
const apiKeyMatch = envContent.match(/ANTHROPIC_API_KEY=(.+)/);
if (!apiKeyMatch) { console.error('ANTHROPIC_API_KEY not found'); process.exit(1); }
process.env.ANTHROPIC_API_KEY = apiKeyMatch[1].trim();

const args        = process.argv.slice(2);
const CONCURRENCY = parseInt(args.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '5');
const RESET       = args.includes('--reset');

const client = new Anthropic();

// ── Protocol → FIG field ───────────────────────────────────────────────────────
const PROTO_FIELD = {
  AIP: 'aip_friendly',
  LF:  'low_fodmap',
  GF:  'gluten_free',
  DF:  'dairy_free',
  Vg:  'vegan',
  V:   'vegetarian',
  LH:  'low_histamine',
  K:   null, // special: sugar_free + paleo
};

// ── Identity-destroying → mod: false, skip search ─────────────────────────────
const IDENTITY_DESTROYING = new Set([
  'K|Crispy Falafel Recipe',
  'K|Mediterranean Lentil Salad',
  'LF|Peanut Butter Chicken',
  'LH|Guacamole',
  'LH|Mango Pico de Gallo',
  'LF|Double the Mushrooms Chicken Marsala',
  'LH|Salmon Puttanesca',
  'LH|Castelvetrano Olive Chicken Skillet',
  'LH|Creamy Refried Beans',
  'K|Lightened Sweet Potato Casserole Pecan Oat Streusel',
  'LH|Fettuccine with Smoked Salmon and Dill Cream Sauce',
  'LH|Miso Glazed Salmon Bowls',
  'LH|Tomato Aguachile',
]);

// ── Progress ───────────────────────────────────────────────────────────────────
function loadProgress() {
  if (!RESET && fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  }
  return { results: [] };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ── Product compliance check ───────────────────────────────────────────────────
function getCompliance(product, protocol) {
  if (protocol === 'K') {
    const sf = product.sugar_free || 'unknown';
    const pa = product.paleo      || 'unknown';
    if (sf === 'compliant' && pa === 'compliant') return 'compliant';
    if (sf === 'not_compliant' || pa === 'not_compliant') return 'not_compliant';
    return 'caution';
  }
  const field = PROTO_FIELD[protocol];
  return field ? (product[field] || 'unknown') : 'unknown';
}

function searchProducts(ingredient, protocol, products) {
  const q = ingredient.toLowerCase().trim();
  const results = { compliant: [], caution: [], not_compliant: [] };

  for (const p of products) {
    if (p.name.toLowerCase().includes(q)) {
      const status = getCompliance(p, protocol);
      if (results[status]) {
        results[status].push({ name: p.name, brand: p.brand || '' });
      }
    }
  }
  return results;
}

// ── Claude: extract ingredient from reason ─────────────────────────────────────
async function extractIngredient(recipe, protocol, reason) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await client.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 100,
        system: [
          {
            type: 'text',
            text: `You extract the single most specific problematic ingredient name from a diet compliance uncertainty note.
Return ONLY the ingredient name — 1 to 4 words, lowercase, no punctuation, no explanation.
Examples: "garam masala", "mirin", "taco seasoning", "gochujang", "feta", "scallion", "balsamic vinegar"
If the uncertainty is about serving size or general ambiguity (not a specific ingredient), return: SKIP`,
            cache_control: { type: 'ephemeral' },
          }
        ],
        messages: [
          {
            role: 'user',
            content: `Recipe: ${recipe}\nProtocol: ${protocol}\nReason: ${reason}\n\nIngredient name:`,
          }
        ],
      });

      const text = resp.content[0].text.trim().toLowerCase().replace(/[^a-z0-9\s\-\']/g, '');
      return text === 'skip' ? null : text;

    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise(r => setTimeout(r, attempt * 1000));
    }
  }
}

// ── Sleep ──────────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Process one uncertain item ─────────────────────────────────────────────────
async function processItem(item, index, total, products) {
  const { recipe, protocol, reason, url } = item;
  const key   = `${protocol}|${recipe}`;
  const label = `[${index}/${total}] ${recipe.slice(0, 40).padEnd(40)} ${protocol}`;

  const base = { recipe, protocol, url, reason };

  // Identity-destroying?
  if (IDENTITY_DESTROYING.has(key)) {
    console.log(`${label} → identity-destroying`);
    return { ...base, verdict: 'mod: false — destroys dish identity', category: 'identity_destroying' };
  }

  // Extract ingredient via Claude
  const ingredient = await extractIngredient(recipe, protocol, reason);

  if (!ingredient) {
    console.log(`${label} → SKIP (no specific ingredient)`);
    return { ...base, ingredient_searched: null, verdict: 'skipped — no specific ingredient to search', category: 'skipped' };
  }

  // Search all 329k products
  const matches = searchProducts(ingredient, protocol, products);

  let result;
  if (matches.compliant.length > 0) {
    console.log(`${label} → ✓ compliant (${ingredient})`);
    result = { ...base, ingredient_searched: ingredient, verdict: 'mod confirmed — compliant product exists', compliant_products: matches.compliant.slice(0, 5), category: 'mod_confirmed' };
  } else if (matches.caution.length > 0) {
    console.log(`${label} → ⚠ caution only (${ingredient})`);
    result = { ...base, ingredient_searched: ingredient, verdict: 'grey area — only caution products found', caution_products: matches.caution.slice(0, 5), category: 'grey_area' };
  } else if (matches.not_compliant.length > 0) {
    console.log(`${label} → ✗ not compliant (${ingredient})`);
    result = { ...base, ingredient_searched: ingredient, verdict: 'mod not possible — only non-compliant products found', not_compliant_products: matches.not_compliant.slice(0, 3), category: 'mod_not_possible' };
  } else {
    console.log(`${label} → ? not in FIG DB (${ingredient})`);
    result = { ...base, ingredient_searched: ingredient, verdict: 'no matching product found in FIG database', category: 'no_product_found' };
  }

  return result;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log('CKC Diet × FIG Product Cross-Reference');
  console.log(`Concurrency: ${CONCURRENCY}\n`);

  const uncertain = JSON.parse(fs.readFileSync(UNCERT_FILE, 'utf8'));
  console.log(`Loading ${PRODUCTS_FILE.split('/').pop()}…`);
  const products  = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
  console.log(`Products loaded: ${products.length.toLocaleString()}\n`);

  const progress = loadProgress();
  const doneKeys = new Set(progress.results.map(r => `${r.protocol}|${r.recipe}`));
  const todo     = uncertain.filter(u => !doneKeys.has(`${u.protocol}|${u.recipe}`));

  console.log(`Total: ${uncertain.length} | Done: ${progress.results.length} | Remaining: ${todo.length}\n`);

  // Process in batches
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const batch = todo.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((item, j) => processItem(item, progress.results.length + j + 1, uncertain.length, products))
    );
    progress.results.push(...batchResults);
    saveProgress(progress);
    if (i + CONCURRENCY < todo.length) await sleep(200);
  }

  // Build final report
  const byCategory = {};
  for (const r of progress.results) {
    const cat = r.category || 'unknown';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(r);
  }

  const summary = {};
  for (const [cat, items] of Object.entries(byCategory)) {
    summary[cat] = items.length;
  }
  summary.total = progress.results.length;

  const report = { summary, ...byCategory };
  fs.writeFileSync(OUT_FILE, JSON.stringify(report, null, 2));

  console.log('\n── Summary ──────────────────────────────');
  for (const [k, v] of Object.entries(summary)) {
    console.log(`  ${k.padEnd(25)} ${v}`);
  }
  console.log(`\nSaved → ${OUT_FILE}`);
}

main().catch(console.error);
