/**
 * compare_nutrition.js
 *
 * Runs 100 recipes through two nutrition engines side-by-side:
 *   1. Edamam Nutrition Analysis API (professional reference)
 *   2. Our USDA-based ingredient calculation
 *
 * Outputs: data/nutrition_comparison.csv + data/nutrition_comparison.json
 *
 * Usage:
 *   node scripts/compare_nutrition.js
 */

const admin  = require('firebase-admin');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');

// ─── Config ──────────────────────────────────────────────────────────────────

const EDAMAM_APP_ID  = '951fa6b2';
const EDAMAM_APP_KEY = 'd0f7c174f033b62b7c0484da38d577fc';
const EDAMAM_URL     = 'https://api.edamam.com/api/nutrition-details';

const SA_PATH        = path.join(__dirname, '../service-account.json');
const NUTRITION_DB   = path.join(__dirname, '../data/ingredientNutrition.json');
const OUTPUT_JSON    = path.join(__dirname, '../data/nutrition_comparison.json');
const OUTPUT_CSV     = path.join(__dirname, '../data/nutrition_comparison.csv');

const SAMPLE_SIZE    = 100;
const RATE_LIMIT_MS  = 1100; // ~55 req/min to stay under 60/min limit

// ─── Firebase init ────────────────────────────────────────────────────────────

const sa = require(SA_PATH);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

// ─── Load USDA nutrition DB ───────────────────────────────────────────────────

const nutritionDB = JSON.parse(fs.readFileSync(NUTRITION_DB, 'utf8'));

// ─── Unit conversion helpers ──────────────────────────────────────────────────

// Exact weight conversions → grams
const WEIGHT_TO_G = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592 };

// Volume units → millilitres (water-equivalent baseline)
const VOL_TO_ML = { tsp: 4.92892, tbsp: 14.7868, cup: 236.588, ml: 1, l: 1000, qt: 946.353, pt: 473.176 };

// For volumetric units, pick the USDA portion whose gramWeight is closest
// to the water-equivalent ml value. This captures ingredient-specific density.
function volumeToGrams(qty, unit, portionsArray) {
  const ml = VOL_TO_ML[unit];
  if (!ml) return null;
  const waterGrams = qty * ml; // baseline (water density = 1g/ml)

  if (!portionsArray || portionsArray.length === 0) return waterGrams;

  // Find the USDA portion that, when scaled to qty, is most proportionally
  // consistent with the water-equivalent baseline. We do this by finding the
  // portion whose gramWeight-per-1-unit is closest to the expected density
  // for this volume unit. Pick the single portion closest to waterGrams.
  // (portions are stored as "amount=1, gramWeight=Xg" — so gramWeight = g per 1 of that measure)

  // Step 1: collect candidates that are plausibly the right size for this unit
  //   tsp  ≈ 2–10g, tbsp ≈ 8–25g, cup ≈ 100–300g
  const UNIT_RANGES = {
    tsp:  [1, 15],
    tbsp: [5, 40],
    cup:  [60, 350],
    ml:   [0.5, 2],
    l:    [500, 2000],
    qt:   [700, 1200],
    pt:   [350, 600],
  };
  const [lo, hi] = UNIT_RANGES[unit] || [0, Infinity];
  const candidates = portionsArray.filter(p => p.gramWeight >= lo && p.gramWeight <= hi);
  const pool = candidates.length > 0 ? candidates : portionsArray;

  // Step 2: pick closest to water-equivalent gram weight
  let best = pool[0];
  let bestDiff = Math.abs(pool[0].gramWeight - waterGrams);
  for (const p of pool) {
    const diff = Math.abs(p.gramWeight - waterGrams);
    if (diff < bestDiff) { bestDiff = diff; best = p; }
  }
  return qty * best.gramWeight;
}

// Piece / count units → grams using USDA per-piece weight
const COUNT_UNITS = new Set(['clove', 'cloves', 'head', 'heads', 'bunch', 'bunches',
  'can', 'cans', 'slice', 'slices', 'piece', 'pieces', 'sprig', 'sprigs',
  'stalk', 'stalks', 'fillet', 'fillets']);

function countToGrams(qty, unit, portionsArray, ingredientName) {
  if (!portionsArray || portionsArray.length === 0) return null;

  // Clove → pick the smallest portion (individual clove weight)
  if (unit === 'clove' || unit === 'cloves') {
    const sorted = [...portionsArray].sort((a, b) => a.gramWeight - b.gramWeight);
    return qty * sorted[0].gramWeight;
  }
  // Can → pick the largest portion
  if (unit === 'can' || unit === 'cans') {
    const sorted = [...portionsArray].sort((a, b) => b.gramWeight - a.gramWeight);
    return qty * sorted[0].gramWeight;
  }
  // Head (garlic, lettuce) → pick the largest
  if (unit === 'head' || unit === 'heads') {
    const sorted = [...portionsArray].sort((a, b) => b.gramWeight - a.gramWeight);
    return qty * sorted[0].gramWeight;
  }
  // Default → median portion
  const sorted = [...portionsArray].sort((a, b) => a.gramWeight - b.gramWeight);
  const mid = sorted[Math.floor(sorted.length / 2)];
  return qty * mid.gramWeight;
}

// ─── Ingredient parser (JS port of ingredientParser.ts) ──────────────────────

const FRACTION_MAP = {
  '½':'1/2','⅓':'1/3','⅔':'2/3','¼':'1/4','¾':'3/4',
  '⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8','⅙':'1/6','⅚':'5/6','⅕':'1/5','⅘':'4/5',
};

const UNITS_MAP = {
  cups:'cup', cup:'cup', 'c.':'cup',
  tablespoons:'tbsp', tablespoon:'tbsp', tbsp:'tbsp', tbs:'tbsp', tbsps:'tbsp',
  teaspoons:'tsp', teaspoon:'tsp', tsp:'tsp', tsps:'tsp',
  ounces:'oz', ounce:'oz', oz:'oz', 'fl oz':'oz',
  pounds:'lb', pound:'lb', lb:'lb', lbs:'lb',
  grams:'g', gram:'g', g:'g',
  kilograms:'kg', kilogram:'kg', kg:'kg',
  milliliters:'ml', milliliter:'ml', ml:'ml',
  liters:'l', liter:'l',
  cloves:'clove', clove:'clove',
  heads:'head', head:'head',
  bunches:'bunch', bunch:'bunch',
  cans:'can', can:'can',
  packages:'pkg', package:'pkg', pkg:'pkg',
  slices:'slice', slice:'slice',
  pieces:'piece', piece:'piece', pcs:'piece',
  sprigs:'sprig', sprig:'sprig',
  stalks:'stalk', stalk:'stalk',
  pinches:'pinch', pinch:'pinch',
  dashes:'dash', dash:'dash',
  quarts:'qt', quart:'qt', qt:'qt',
  pints:'pt', pint:'pt', pt:'pt',
};

const STOP_WORDS = new Set([
  'freshly','fresh','large','medium','small','whole','ripe','packed',
  'heaping','leveled','rounded','about','approximately',
  'roughly','minced','sliced','grated','shredded','peeled','crushed',
  'halved','quartered','julienned','cubed','zested','deveined','deboned',
  'pitted','cored','seeded','deseeded','blanched','seared','caramelized',
  'toasted','grilled','charred','brined',
  'optional','divided','room','temperature','softened','melted','cooled',
  'drained','rinsed','torn','trimmed','thin','fine','finely','coarsely',
  'thinly','warm','hot','cold','chilled','thawed','good','quality','best',
  'organic','store-bought','homemade','low-sodium','unsweetened',
  'reduced-fat','full-fat','raw','uncooked','leftover','day-old',
  'garnish','serving','topping','and', 'for',
]);

const VAGUE_WORDS = ['to taste','as needed','some','squeeze','touch','knob','pinch','dash','splash','drizzle','handful','few','sprinkle'];

const INGREDIENT_ALIASES = {
  'flat-leaf parsley':'parsley','italian parsley':'parsley','curly parsley':'parsley',
  'thai basil':'basil','sweet basil':'basil',
  'fresh cilantro':'cilantro','coriander leaves':'cilantro',
  'fresh dill':'dill','dill weed':'dill',
  'fresh mint':'mint','spearmint':'mint',
  'fresh thyme':'thyme','thyme leaves':'thyme',
  'fresh rosemary':'rosemary','rosemary sprig':'rosemary',
  'green onion':'scallion','spring onion':'scallion','green onions':'scallion','scallions':'scallion',
  'garlic clove':'garlic','clove garlic':'garlic','cloves garlic':'garlic',
  'cracked pepper':'black pepper','ground pepper':'black pepper','ground black pepper':'black pepper',
  'freshly ground pepper':'black pepper','freshly ground black pepper':'black pepper',
  'kosher salt':'salt','sea salt':'salt','fine salt':'salt','flaky salt':'salt','table salt':'salt','coarse salt':'salt',
  'extra virgin olive oil':'olive oil','evoo':'olive oil',
  'unsalted butter':'butter','salted butter':'butter',
  'canned light coconut milk':'coconut milk','light coconut milk':'coconut milk',
  'full fat coconut milk':'coconut milk','full-fat coconut milk':'coconut milk',
  'low sodium soy sauce':'soy sauce','reduced sodium soy sauce':'soy sauce',
  'chicken stock':'chicken broth','vegetable stock':'vegetable broth','beef stock':'beef broth',
  'green lentils':'lentils','red lentils':'lentils','brown lentils':'lentils',
  'cherry tomatoes':'tomatoes','grape tomatoes':'tomatoes','roma tomatoes':'tomatoes',
  'red bell pepper':'bell pepper','green bell pepper':'bell pepper','yellow bell pepper':'bell pepper',
  'sweet potato':'sweet potatoes',
  'yukon gold potatoes':'potatoes','russet potatoes':'potatoes','red potatoes':'potatoes',
  'cremini mushrooms':'mushrooms','shiitake mushrooms':'mushrooms','portobello mushroom':'mushrooms',
  'baby spinach':'spinach',
  'ground beef':'beef',
  'chicken thighs':'chicken','chicken breasts':'chicken','chicken breast':'chicken',
  'salmon fillet':'salmon','salmon fillets':'salmon',
};

function parseFraction(str) {
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 2) return parseFloat(parts[0]) / parseFloat(parts[1]);
  }
  return parseFloat(str);
}

function parseQuantity(str) {
  // Normalize unicode fractions
  let s = str;
  for (const [uni, ascii] of Object.entries(FRACTION_MAP)) s = s.replace(uni, ascii);

  // Range like "1-2" → use lower number
  const rangeMatch = s.match(/^(\d+(?:\/\d+)?)\s*[-–]\s*\d/);
  if (rangeMatch) s = rangeMatch[1];

  // Mixed number like "2 1/2"
  const mixedMatch = s.match(/^(\d+)\s+(\d+\/\d+)/);
  if (mixedMatch) return parseInt(mixedMatch[1]) + parseFraction(mixedMatch[2]);

  // Plain fraction or decimal
  const numMatch = s.match(/^(\d+(?:[./]\d+)?)/);
  if (numMatch) return parseFraction(numMatch[1]);

  return null;
}

function parseIngredient(raw) {
  let s = raw.trim();

  // Check for vague quantities early
  const lowerRaw = s.toLowerCase();
  for (const vague of VAGUE_WORDS) {
    if (lowerRaw.includes(vague)) return { qty: 0, unit: '', name: lowerRaw, skip: true, reason: 'vague: ' + vague };
  }

  // "or" alternatives → take first option
  s = s.replace(/\s+or\s+.*/i, '');

  // Normalize unicode fractions
  for (const [uni, ascii] of Object.entries(FRACTION_MAP)) s = s.replace(uni, ascii);

  // Extract quantity
  // Range → lower number
  s = s.replace(/^(\d+(?:\/\d+)?)\s*[-–]\s*\d+(?:\/\d+)?\s*/, '$1 ');

  const qtyMatch = s.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+\.?\d*)/);
  const qty = qtyMatch ? parseQuantity(qtyMatch[0]) : null;
  if (qtyMatch) s = s.slice(qtyMatch[0].length).trim();

  // Extract unit
  let unit = '';
  const unitPattern = new RegExp('^(' + Object.keys(UNITS_MAP).sort((a,b) => b.length-a.length).map(u => u.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|') + ')\\b\\.?\\s*', 'i');
  const unitMatch = s.match(unitPattern);
  if (unitMatch) {
    unit = UNITS_MAP[unitMatch[1].toLowerCase()] || unitMatch[1].toLowerCase();
    s = s.slice(unitMatch[0].length).trim();
  }

  // Strip comma-separated prep instructions
  s = s.replace(/,\s*(minced|sliced|grated|shredded|peeled|crushed|halved|quartered|julienned|cubed|torn|trimmed|zested|deveined|pitted|cored|seeded|divided|optional|drained|rinsed|softened|melted|cooled|roughly|finely|coarsely|thinly|blanched|chopped|cut).*/i, '');

  // Clean name
  let name = s.toLowerCase()
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove stop words
  name = name.split(' ').filter(w => !STOP_WORDS.has(w)).join(' ').trim();

  // Apply aliases
  if (INGREDIENT_ALIASES[name]) name = INGREDIENT_ALIASES[name];

  if (!name) return { qty: 0, unit: '', name: raw.toLowerCase(), skip: true, reason: 'empty name after parse' };
  if (!qty || qty === 0) return { qty: 0, unit, name, skip: true, reason: 'no quantity' };

  return { qty, unit, name, skip: false };
}

// ─── USDA nutrition calculator ────────────────────────────────────────────────

function ingredientToGrams(qty, unit, ingredientName) {
  const entry = nutritionDB[ingredientName];
  const portions = entry ? entry.portions : null;

  // Weight unit → direct conversion
  if (WEIGHT_TO_G[unit]) return qty * WEIGHT_TO_G[unit];

  // Volume unit → ingredient-specific density from USDA
  if (VOL_TO_ML[unit]) return volumeToGrams(qty, unit, portions);

  // Count unit → USDA per-piece weight
  if (COUNT_UNITS.has(unit)) return countToGrams(qty, unit, portions, ingredientName);

  // No unit → treat as whole pieces, use median USDA portion or skip
  if (!unit && portions && portions.length > 0) {
    const sorted = [...portions].sort((a, b) => a.gramWeight - b.gramWeight);
    const mid = sorted[Math.floor(sorted.length / 2)];
    return qty * mid.gramWeight;
  }

  return null; // can't convert
}

function calcUSDA(ingredients) {
  const totals = { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };
  const log = [];

  for (const raw of ingredients) {
    const parsed = parseIngredient(raw);
    if (parsed.skip) {
      log.push({ raw, status: 'skipped', reason: parsed.reason });
      continue;
    }

    const { qty, unit, name } = parsed;

    // Look up in nutrition DB
    let entry = nutritionDB[name];

    // Try partial match if exact not found
    if (!entry) {
      const keys = Object.keys(nutritionDB);
      const found = keys.find(k => k.includes(name) || name.includes(k));
      if (found) entry = nutritionDB[found];
    }

    if (!entry) {
      log.push({ raw, parsed: name, status: 'not_in_db' });
      continue;
    }

    const grams = ingredientToGrams(qty, unit, name) || ingredientToGrams(qty, unit, Object.keys(nutritionDB).find(k => k.includes(name) || name.includes(k)));
    if (!grams) {
      log.push({ raw, parsed: name, status: 'no_gram_conversion', unit });
      continue;
    }

    const scale = grams / 100;
    const p = entry.per100g;
    totals.calories += (p.calories || 0) * scale;
    totals.protein  += (p.protein  || 0) * scale;
    totals.fat      += (p.fat      || 0) * scale;
    totals.carbs    += (p.carbs    || 0) * scale;
    totals.fiber    += (p.fiber    || 0) * scale;

    log.push({ raw, parsed: name, unit, qty, grams: Math.round(grams), status: 'ok' });
  }

  return {
    totals: {
      calories: Math.round(totals.calories),
      protein:  Math.round(totals.protein  * 10) / 10,
      fat:      Math.round(totals.fat      * 10) / 10,
      carbs:    Math.round(totals.carbs    * 10) / 10,
      fiber:    Math.round(totals.fiber    * 10) / 10,
    },
    log,
  };
}

// ─── Edamam API call ──────────────────────────────────────────────────────────

function callEdamam(title, ingredients) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ title, ingr: ingredients });
    const url  = `${EDAMAM_URL}?app_id=${EDAMAM_APP_ID}&app_key=${EDAMAM_APP_KEY}&nutrition-type=cooking`;
    const urlObj = new URL(url);

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            const n = json.totalNutrients || {};
            resolve({
              calories: Math.round(json.calories || 0),
              protein:  Math.round((n.PROCNT?.quantity || 0) * 10) / 10,
              fat:      Math.round((n.FAT?.quantity   || 0) * 10) / 10,
              carbs:    Math.round((n.CHOCDF?.quantity|| 0) * 10) / 10,
              fiber:    Math.round((n.FIBTG?.quantity || 0) * 10) / 10,
              yield:    json.yield || null,
            });
          } catch(e) { reject(new Error('JSON parse error: ' + e.message)); }
        } else if (res.statusCode === 422) {
          resolve(null); // unprocessable — ingredient strings not recognized
        } else {
          reject(new Error(`Edamam HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Sample selection ─────────────────────────────────────────────────────────

function selectDiverseSample(recipes, n) {
  // Group by meal_type + protein_type
  const groups = {};
  for (const r of recipes) {
    const key = `${r.meal_type || 'unknown'}|${r.protein_type || 'unknown'}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }

  // Proportional allocation
  const total = recipes.length;
  const sample = [];
  const groupEntries = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);

  for (const [key, items] of groupEntries) {
    const alloc = Math.max(1, Math.round((items.length / total) * n));
    // Shuffle and pick
    const shuffled = items.sort(() => Math.random() - 0.5);
    sample.push(...shuffled.slice(0, alloc));
    if (sample.length >= n) break;
  }

  // Top up if needed
  if (sample.length < n) {
    const used = new Set(sample.map(r => r.id));
    for (const r of recipes) {
      if (!used.has(r.id)) { sample.push(r); if (sample.length >= n) break; }
    }
  }

  return sample.slice(0, n);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('Fetching recipes from Firestore...');
  const snap = await db.collection('recipes')
    .where('status', 'in', ['approved', 'needs_review'])
    .get();

  const recipes = [];
  snap.forEach(doc => {
    const d = doc.data();
    if (d.ingredients && d.ingredients.length >= 3) {
      recipes.push({ id: doc.id, name: d.name, meal_type: d.meal_type, protein_type: d.protein_type, cuisine: d.cuisine, ingredients: d.ingredients });
    }
  });

  console.log(`Loaded ${recipes.length} recipes with ingredients`);
  const sample = selectDiverseSample(recipes, SAMPLE_SIZE);
  console.log(`Selected ${sample.length} diverse recipes for comparison\n`);

  const results = [];
  let edamamOk = 0, edamamFail = 0;

  for (let i = 0; i < sample.length; i++) {
    const r = sample[i];
    process.stdout.write(`[${String(i+1).padStart(3)}/${sample.length}] ${r.name.slice(0, 50).padEnd(50)} `);

    // USDA calculation
    const usda = calcUSDA(r.ingredients);

    // Edamam API call
    let edamam = null;
    try {
      edamam = await callEdamam(r.name, r.ingredients);
      if (edamam) edamamOk++; else edamamFail++;
    } catch(e) {
      console.log(`  Edamam error: ${e.message}`);
      edamamFail++;
    }

    // Compute delta (Edamam as reference)
    let delta = null;
    if (edamam) {
      delta = {
        calories: edamam.calories > 0 ? Math.round(((usda.totals.calories - edamam.calories) / edamam.calories) * 100) : null,
        protein:  edamam.protein  > 0 ? Math.round(((usda.totals.protein  - edamam.protein)  / edamam.protein)  * 100) : null,
        fat:      edamam.fat      > 0 ? Math.round(((usda.totals.fat      - edamam.fat)      / edamam.fat)      * 100) : null,
        carbs:    edamam.carbs    > 0 ? Math.round(((usda.totals.carbs    - edamam.carbs)    / edamam.carbs)    * 100) : null,
      };
    }

    const result = {
      id:           r.id,
      name:         r.name,
      meal_type:    r.meal_type,
      protein_type: r.protein_type,
      cuisine:      r.cuisine,
      ingredients:  r.ingredients,
      usda:         usda.totals,
      edamam,
      delta,
      usdaLog:      usda.log,
    };
    results.push(result);

    const calDelta = delta?.calories != null ? `Δcal ${delta.calories > 0 ? '+' : ''}${delta.calories}%` : 'Edamam N/A';
    console.log(edamam ? `USDA ${usda.totals.calories}cal | Edamam ${edamam.calories}cal | ${calDelta}` : `USDA ${usda.totals.calories}cal | Edamam failed`);

    // Rate limit
    if (i < sample.length - 1) await sleep(RATE_LIMIT_MS);
  }

  // ─── Write outputs ──────────────────────────────────────────────────────────

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(results, null, 2));
  console.log(`\nSaved full results → ${OUTPUT_JSON}`);

  // CSV summary
  const csvRows = [
    'name,meal_type,protein_type,cuisine,usda_cal,edamam_cal,delta_cal_%,usda_protein,edamam_protein,delta_protein_%,usda_fat,edamam_fat,delta_fat_%,usda_carbs,edamam_carbs,delta_carbs_%'
  ];
  for (const r of results) {
    if (!r.edamam) continue;
    csvRows.push([
      `"${r.name.replace(/"/g,'')}"`,
      r.meal_type || '',
      r.protein_type || '',
      r.cuisine || '',
      r.usda.calories, r.edamam.calories, r.delta?.calories ?? '',
      r.usda.protein,  r.edamam.protein,  r.delta?.protein  ?? '',
      r.usda.fat,      r.edamam.fat,      r.delta?.fat      ?? '',
      r.usda.carbs,    r.edamam.carbs,    r.delta?.carbs    ?? '',
    ].join(','));
  }
  fs.writeFileSync(OUTPUT_CSV, csvRows.join('\n'));
  console.log(`Saved CSV summary → ${OUTPUT_CSV}`);

  // ─── Summary stats ──────────────────────────────────────────────────────────

  const compared = results.filter(r => r.edamam && r.delta?.calories != null);
  if (compared.length > 0) {
    const absDelta = compared.map(r => Math.abs(r.delta.calories));
    const avg = Math.round(absDelta.reduce((a, b) => a + b, 0) / absDelta.length);
    const within10 = absDelta.filter(d => d <= 10).length;
    const within20 = absDelta.filter(d => d <= 20).length;

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('SUMMARY');
    console.log(`  Recipes compared:    ${compared.length}`);
    console.log(`  Edamam failures:     ${edamamFail}`);
    console.log(`  Avg calorie delta:   ±${avg}%`);
    console.log(`  Within ±10%:         ${within10}/${compared.length} (${Math.round(within10/compared.length*100)}%)`);
    console.log(`  Within ±20%:         ${within20}/${compared.length} (${Math.round(within20/compared.length*100)}%)`);

    // Top outliers
    const outliers = compared.filter(r => Math.abs(r.delta.calories) > 20)
      .sort((a, b) => Math.abs(b.delta.calories) - Math.abs(a.delta.calories))
      .slice(0, 5);
    if (outliers.length > 0) {
      console.log('\n  Top outliers (>±20% calorie delta):');
      outliers.forEach(r => console.log(`    ${r.name.slice(0,45).padEnd(45)} USDA:${r.usda.calories} Edamam:${r.edamam.calories} Δ${r.delta.calories}%`));
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
