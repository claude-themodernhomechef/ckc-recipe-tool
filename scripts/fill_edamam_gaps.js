/**
 * fill_edamam_gaps.js
 *
 * Per-ingredient gap fill using Edamam's Nutrition Analysis API.
 *
 * Strategy:
 *   1. Collect all unique MISS ingredient strings across all recipes
 *   2. Call Edamam ONCE per unique string (1 string → 1 call → per-ingredient nutrition)
 *   3. Cache the results (string → nutrition object)
 *   4. Apply cached nutrition to every occurrence of that string across all recipes
 *   5. Update recipe totals + perServing with the now-complete ingredient data
 *   6. Save to data/recipe_nutrition_hybrid_progress.json
 *
 * DB-matched ingredients are kept as-is. Only MISS items get Edamam data.
 * Deduplication means each unique ingredient string is only called once.
 *
 * Usage: node scripts/fill_edamam_gaps.js
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const EDAMAM_APP_ID  = '951fa6b2';
const EDAMAM_APP_KEY = 'd0f7c174f033b62b7c0484da38d577fc';
const EDAMAM_URL     = 'https://api.edamam.com/api/nutrition-details';
const RATE_LIMIT_MS  = 1350; // ~44/min, safely under 50/min limit

const V2_PROGRESS   = path.join(__dirname, '../data/recipe_nutrition_v2_progress.json');
const HYBRID_FILE   = path.join(__dirname, '../data/recipe_nutrition_hybrid_progress.json');
const CACHE_FILE    = path.join(__dirname, '../data/edamam_ingredient_cache.json');

// Edamam nutrient codes → our nutrition keys
const EDAMAM_MAP = {
  ENERC_KCAL: 'calories',    PROCNT:   'protein',
  FAT:        'fat',         FASAT:    'saturatedFat',
  FAMS:       'monounsaturatedFat',    FAPU: 'polyunsaturatedFat',
  FATRN:      'transFat',    CHOLE:    'cholesterol',
  CHOCDF:     'carbs',       FIBTG:    'fiber',
  SUGAR:      'sugar',       NA:       'sodium',
  K:          'potassium',   CA:       'calcium',
  MG:         'magnesium',   P:        'phosphorus',
  FE:         'iron',        ZN:       'zinc',
  VITA_RAE:   'vitaminA',    VITC:     'vitaminC',
  VITD:       'vitaminD',    TOCPHA:   'vitaminE',
  VITK1:      'vitaminK',    THIA:     'vitaminB1',
  RIBF:       'vitaminB2',   NIA:      'vitaminB3',
  VITB6A:     'vitaminB6',   FOLAC:    'folate',
  VITB12:     'vitaminB12',  WATER:    'water',
};

const NUTRIENTS = Object.values(EDAMAM_MAP);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function edamamToNutrition(totalNutrients) {
  if (!totalNutrients) return null;
  const result = {};
  for (const [edKey, ourKey] of Object.entries(EDAMAM_MAP)) {
    const n = totalNutrients[edKey];
    if (n && n.quantity != null) {
      result[ourKey] = Math.round(n.quantity * 100) / 100;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

function sumNutrition(nutritionList) {
  const total = {};
  for (const n of nutritionList) {
    if (!n) continue;
    for (const key of NUTRIENTS) {
      if (n[key] != null) total[key] = (total[key] || 0) + n[key];
    }
  }
  // Round all values
  for (const k of Object.keys(total)) total[k] = Math.round(total[k] * 100) / 100;
  return total;
}

function divideNutrition(n, servings) {
  if (!n || !servings) return n;
  const result = {};
  for (const [k, v] of Object.entries(n)) {
    result[k] = Math.round((v / servings) * 100) / 100;
  }
  return result;
}

// Is this a garnish ingredient? Garnishes still get nutrition calculated,
// but are stored in garnishPerServing rather than perServing.
function isGarnish(raw) {
  if (!raw) return false;
  const lower = raw.toLowerCase().trim();
  return /\bfor\s+serving\b|\bfor\s+garnish\b|\bto\s+serve\b|\bto\s+garnish\b|\bto\s+top\b/.test(lower)
      || /^optional[\s:]+garnish|^garnish\s*:/i.test(lower)
      || /^for\s+topping\b/i.test(lower)
      || /^optional\s+/i.test(lower);
}

// Skip EACH-spice strings entirely (negligible calories)
function isEachSpice(raw) {
  return /\beach\s*:/i.test(raw || '');
}

// Zero-calorie ingredients — return empty nutrition directly, skip Edamam call
const ZERO_CAL_PATTERNS = [
  /\bsalt\b/i,        // salt, sea salt, kosher salt, pink salt, etc.
  /\bwater\b/i,       // plain water (negligible)
];
function isZeroCal(raw) {
  if (!raw) return false;
  const lower = raw.toLowerCase().trim();
  // Only zero-cal if the ingredient IS salt/water — not if it just contains the word
  // Check: no other substantial food words present
  const withoutQtyUnit = lower.replace(/^[\d\s\/\.\-]+(cup|tbsp|tsp|tablespoon|teaspoon|pinch|dash|oz|lb|g|ml|l|clove|bunch|sprig|can|package|pkg|bag|piece|slice|head|bunch|ear)s?\b\.?\s*/i, '').trim();
  return ZERO_CAL_PATTERNS.some(p => p.test(withoutQtyUnit)) &&
         !/\b(sauce|dressing|broth|stock|soup|butter|oil|sugar|flour|milk|cream|vinegar|lemon|lime|pepper|spice|herb|garlic|onion|tomato|bean|pea|chicken|beef|pork|fish|shrimp|egg|cheese|yogurt|rice|pasta|grain|nut|seed|fruit|vegeta)\b/i.test(withoutQtyUnit);
}

// Normalise ingredient string before sending to Edamam
// Handles: "DIY X" → "X", "homemade X" → "X", brand callouts, etc.
function normaliseForEdamam(raw) {
  let s = raw;

  // "DIY Curry Powder" → "curry powder"
  // "DIY Lemon Tahini" → "lemon tahini"
  s = s.replace(/\bDIY\s+/gi, '');

  // "homemade ranch dressing" → "ranch dressing"
  s = s.replace(/\bhomemade\s+/gi, '');

  // "(or store-bought)" / "(see notes)" / "((brand note))" — already stripped by parser mostly
  s = s.replace(/\((?:or\s+store[- ]bought|see\s+notes?|store[- ]bought)[^)]*\)/gi, '');

  // HTML entities left over (e.g. &#8211; = em dash)
  s = s.replace(/&#\d+;/g, ' ').replace(/&[a-z]+;/gi, ' ');

  // Collapse extra spaces
  s = s.replace(/\s{2,}/g, ' ').trim();

  return s;
}

async function callEdamamSingle(ingredientStr) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ title: 'single', ingr: [ingredientStr] });
    const urlStr = `${EDAMAM_URL}?app_id=${EDAMAM_APP_ID}&app_key=${EDAMAM_APP_KEY}&nutrition-type=cooking`;

    const req = https.request(new URL(urlStr), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        if (res.statusCode === 429) return resolve({ rateLimit: true });
        if (res.statusCode !== 200) return resolve(null);
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.write(body);
    req.end();
  });
}

async function main() {
  const v2 = JSON.parse(fs.readFileSync(V2_PROGRESS, 'utf8'));

  // Load or init the ingredient cache (unique string → nutrition)
  let cache = {};
  if (fs.existsSync(CACHE_FILE)) {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    console.log(`Loaded ingredient cache: ${Object.keys(cache).length} entries`);
  }

  // Load or init hybrid output
  let hybrid = {};
  if (fs.existsSync(HYBRID_FILE)) {
    hybrid = JSON.parse(fs.readFileSync(HYBRID_FILE, 'utf8'));
    console.log(`Resuming hybrid: ${Object.keys(hybrid).length} recipes done`);
  }

  // ── Step 1: Collect all unique MISS ingredient strings ────────────────────
  const uniqueStrings = new Set();
  let totalMiss = 0;

  for (const [id, r] of Object.entries(v2)) {
    const miss = (r.nutrition?.ingredients || []).filter(i =>
      !i.skip && !i.matched && i.raw?.trim() && !isEachSpice(i.raw)
    );
    miss.forEach(i => {
      if (!cache[i.raw]) uniqueStrings.add(i.raw);
      totalMiss++;
    });
  }

  const toFetch = [...uniqueStrings];
  console.log(`\nTotal MISS ingredient uses:    ${totalMiss}`);
  console.log(`Unique strings to fetch:       ${toFetch.length}  (${Object.keys(cache).length} already cached)`);
  console.log(`Estimated time at 44/min:      ~${Math.ceil(toFetch.length / 44)} min\n`);

  // ── Step 2: Fetch Edamam nutrition for each unique string ─────────────────
  let fetched = 0, failed = 0;

  for (let i = 0; i < toFetch.length; i++) {
    const ingStr = toFetch[i];
    process.stdout.write(`[${String(i+1).padStart(4)}/${toFetch.length}] ${ingStr.slice(0,55).padEnd(55)} `);

    // Zero-cal shortcut — no API call needed
    if (isZeroCal(ingStr)) {
      cache[ingStr] = { calories: 0, sodium: 0 }; // salt has sodium but no calories
      fetched++;
      process.stdout.write(`0 cal (salt/water)\n`);
      // No rate-limit delay needed
      continue;
    }

    const normStr = normaliseForEdamam(ingStr);
    const resp = await callEdamamSingle(normStr);

    if (resp?.rateLimit) {
      console.log('\n⚠ Rate limited — waiting 65s...');
      await sleep(65000);
      i--; continue;
    }

    const nutrition = resp ? edamamToNutrition(resp.totalNutrients) : null;
    const cal = nutrition?.calories ? Math.round(nutrition.calories) : 0;

    cache[ingStr] = nutrition; // null = Edamam couldn't parse it
    fetched++;
    if (nutrition) { process.stdout.write(`${cal} cal ✓\n`); }
    else           { failed++; process.stdout.write(`— no data\n`); }

    // Save cache every 25 fetches
    if (fetched % 25 === 0) fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));

    await sleep(RATE_LIMIT_MS);
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  console.log(`\nFetched: ${fetched}  Failed: ${failed}  Cache size: ${Object.keys(cache).length}\n`);

  // ── Step 3: Apply cache to all recipes and rebuild totals ─────────────────
  console.log('Rebuilding recipe totals with gap-filled nutrition...\n');
  let improved = 0;

  for (const [id, r] of Object.entries(v2)) {
    const servings = r.servings || r.nutrition?.servings || 4;
    const ingredients = r.nutrition?.ingredients || [];

    // Enrich each ingredient with Edamam nutrition if it was a MISS
    const enrichedIngredients = ingredients.map(ing => {
      if (ing.matched || ing.skip || !ing.raw?.trim()) return ing;
      if (isEachSpice(ing.raw)) return { ...ing, skip: true, skipReason: 'each_spice' };
      const edNutrition = cache[ing.raw];
      if (!edNutrition) return ing;
      return {
        ...ing,
        nutrition:   edNutrition,
        matchedBy:   'edamam',
        matched:     true,
      };
    });

    // Recompute total — main ingredients only (not garnishes)
    const mainNutrition = enrichedIngredients
      .filter(i => !i.skip && !i.garnish && i.nutrition)
      .map(i => i.nutrition);
    const garnishNutrition = enrichedIngredients
      .filter(i => !i.skip && i.garnish && i.nutrition)
      .map(i => i.nutrition);

    const newTotal = sumNutrition(mainNutrition);
    const newPerServing = divideNutrition(newTotal, servings);
    const garnishTotal = garnishNutrition.length > 0 ? sumNutrition(garnishNutrition) : null;
    const newGarnishPerServing = garnishTotal ? divideNutrition(garnishTotal, servings) : null;

    const oldCal  = Math.round(r.nutrition?.total?.calories || 0);
    const newCal  = Math.round(newTotal.calories || 0);
    if (newCal > oldCal) improved++;

    // Recalculate matchRate with Edamam-enriched items
    const totalIng  = enrichedIngredients.filter(i => !i.skip).length;
    const matchedIng = enrichedIngredients.filter(i => !i.skip && i.matched).length;
    const newMatchRate = totalIng > 0 ? Math.round(matchedIng / totalIng * 100) : 0;

    hybrid[id] = {
      ...r,
      matchRate: newMatchRate,
      nutrition: {
        ...r.nutrition,
        ingredients: enrichedIngredients,
        total:       newTotal,
        perServing:  newPerServing,
        garnishPerServing: newGarnishPerServing,
        servings,
        source:      'db_v2+edamam_gaps',
        calculatedAt: new Date().toISOString().split('T')[0],
      },
    };
  }

  fs.writeFileSync(HYBRID_FILE, JSON.stringify(hybrid, null, 2));

  console.log(`Recipes with calories increased: ${improved}`);
  console.log(`Total recipes in hybrid:         ${Object.keys(hybrid).length}`);

  // ── Step 4: Quick accuracy check ──────────────────────────────────────────
  try {
    const ed = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/edamam_progress.json'), 'utf8'));
    let total = 0, count = 0;
    const buckets = {'0-10':0,'11-25':0,'26-50':0,'51-100':0,'101+':0};
    for (const [id, r] of Object.entries(hybrid)) {
      const bench = ed[id]?.nutrition?.calories;
      const ours  = r.nutrition?.total?.calories;
      if (!bench || !ours) continue;
      const delta = Math.round(Math.abs(ours - bench) / bench * 100);
      total += delta; count++;
      if (delta<=10) buckets['0-10']++;
      else if (delta<=25) buckets['11-25']++;
      else if (delta<=50) buckets['26-50']++;
      else if (delta<=100) buckets['51-100']++;
      else buckets['101+']++;
    }
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('HYBRID ACCURACY vs Edamam benchmark:');
    console.log('  Avg delta:    ' + Math.round(total/count) + '%  (was 33%)');
    console.log('  Within 10%:  ' + Math.round(buckets['0-10']/count*100) + '%');
    console.log('  Within 25%:  ' + Math.round((buckets['0-10']+buckets['11-25'])/count*100) + '%');
    console.log('  Within 50%:  ' + Math.round((buckets['0-10']+buckets['11-25']+buckets['26-50'])/count*100) + '%');
    console.log('  Dist:', JSON.stringify(buckets));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch {}

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
