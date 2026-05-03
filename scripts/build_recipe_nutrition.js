/**
 * build_recipe_nutrition.js
 *
 * For every recipe in Firestore:
 *   1. Parse each ingredient string → qty, unit, name
 *   2. Look up name in ingredientNutrition_v2.json
 *   3. Convert qty+unit → grams using DB labeled measures
 *   4. Calculate each ingredient's full nutrition contribution
 *   5. Sum all ingredients → total recipe nutrition
 *   6. Divide by servings → per-serving nutrition
 *   7. Cross-reference total calories against Edamam result (where available)
 *   8. Write full nutrition object to each Firestore recipe document
 *
 * Resumable via data/recipe_nutrition_progress.json
 *
 * Usage: node scripts/build_recipe_nutrition.js
 */

const admin  = require('firebase-admin');
const fs     = require('fs');
const path   = require('path');

const SA_PATH          = path.join(__dirname, '../service-account.json');
const INGREDIENT_DB    = path.join(__dirname, '../data/ingredientNutrition_v2.json');
const EDAMAM_PROG      = path.join(__dirname, '../data/edamam_progress.json');
const SERVINGS_PROG    = path.join(__dirname, '../data/servings_progress.json');
const PROGRESS_FILE    = path.join(__dirname, '../data/recipe_nutrition_progress.json');

const sa = require(SA_PATH);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

// ── Unit normalizer → DB measure label ───────────────────────────────────────
// Maps common recipe abbreviations to the labeled measure names in Edamam DB

const UNIT_TO_LABEL = {
  // Volume
  'cup': 'Cup', 'cups': 'Cup', 'c': 'Cup',
  'tbsp': 'Tablespoon', 'tablespoon': 'Tablespoon', 'tablespoons': 'Tablespoon', 'tbs': 'Tablespoon', 'tbsps': 'Tablespoon',
  'tsp': 'Teaspoon',  'teaspoon': 'Teaspoon',  'teaspoons': 'Teaspoon', 'ts': 'Teaspoon', 'tsps': 'Teaspoon',
  'pinch': 'Pinch', 'pinches': 'Pinch', 'dash': 'Dash', 'dashes': 'Dash',
  'fl oz': 'Fluid ounce', 'fluid oz': 'Fluid ounce', 'fluid ounce': 'Fluid ounce',
  'ml': 'Milliliter', 'milliliter': 'Milliliter', 'milliliters': 'Milliliter',
  'l': 'Liter', 'liter': 'Liter', 'liters': 'Liter',
  'pint': 'Pint', 'pints': 'Pint', 'pt': 'Pint',
  'quart': 'Quart', 'quarts': 'Quart', 'qt': 'Quart',
  'gallon': 'Gallon', 'gallons': 'Gallon', 'gal': 'Gallon',
  // Weight (handle directly via gram conversion)
  'g': 'Gram', 'gram': 'Gram', 'grams': 'Gram',
  'oz': 'Ounce', 'ounce': 'Ounce', 'ounces': 'Ounce',
  'lb': 'Pound', 'lbs': 'Pound', 'pound': 'Pound', 'pounds': 'Pound',
  'kg': 'Kilogram', 'kilogram': 'Kilogram', 'kilograms': 'Kilogram',
  // Count/piece
  'clove': 'Clove', 'cloves': 'Clove',
  'slice': 'Slice', 'slices': 'Slice',
  'piece': 'Piece', 'pieces': 'Piece',
  'strip': 'Strip', 'strips': 'Strip',
  'sprig': 'Sprig', 'sprigs': 'Sprig',
  'stalk': 'Stalk', 'stalks': 'Stalk',
  'leaf': 'Leaf', 'leaves': 'Leaf',
  'can': 'Can', 'cans': 'Can',
  'package': 'Package', 'packages': 'Package', 'pkg': 'Package',
  'head': 'Head', 'heads': 'Head',
  'bunch': 'Bunch', 'bunches': 'Bunch',
  'ear': 'Ear', 'ears': 'Ear',
  'fillet': 'Fillet', 'fillets': 'Fillet',
  'steak': 'Steak', 'steaks': 'Steak',
  'breast': 'Breast', 'breasts': 'Breast',
  'thigh': 'Thigh', 'thighs': 'Thigh',
  'inch': 'Inch', 'inches': 'Inch',
};

// Standard fallback gram weights for units not found in DB measures
const FALLBACK_GRAMS = {
  'Gram': 1, 'Ounce': 28.35, 'Pound': 453.59, 'Kilogram': 1000,
  'Cup': 240, 'Tablespoon': 15, 'Teaspoon': 5,
  'Fluid ounce': 29.57, 'Milliliter': 1, 'Liter': 1000,
  'Pint': 473, 'Quart': 946, 'Gallon': 3785,
  'Pinch': 0.3, 'Dash': 0.6,
};

// ── Ingredient parser (Node.js port of core logic) ────────────────────────────

const FRACTION_MAP = {
  '½': 0.5, '⅓': 0.333, '⅔': 0.667, '¼': 0.25, '¾': 0.75,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};

const STOP_WORDS = [
  'to taste','as needed','optional','for garnish','for serving','for topping',
  'freshly','fresh','ripe','packed','divided','room temperature','softened',
  'melted','cooled','drained','rinsed','finely','roughly','thinly','coarsely',
  'minced','sliced','grated','shredded','peeled','crushed','halved','quartered',
  'cubed','zested','pitted','cored','seeded','toasted','warm','cold','chilled',
  'low-sodium','unsweetened','homemade','store-bought',
  // Prep methods commonly left in name
  'chopped','diced','julienned','torn','blanched','roasted','grilled','fried',
  'boiled','steamed','pureed','mashed','whipped','beaten','whisked','sautéed',
  'sauteed','caramelized','smoked','canned','frozen','thawed','cooked','raw',
  'dried','ground','crumbled','trimmed','deveined','butterflied','deboned',
  // Size descriptors (only as leading words, handled separately below)
  // Other modifiers
  'whole','boneless','skinless','bone-in','skin-on','lean','organic','extra-virgin',
];

const VAGUE_STARTERS = ['salt','pepper','salt and pepper','salt & pepper','salt + pepper','water',
  'for the dressing','for the sauce','for the marinade','for the glaze','for the topping',
  'for serving','for garnish','to serve','to taste','each:','optional:',
];

function parseFraction(str) {
  for (const [k, v] of Object.entries(FRACTION_MAP)) {
    str = str.split(k).join(` ${v} `);
  }
  str = str.replace(/(\d+)\s*\/\s*(\d+)/g, (_, n, d) => (parseFloat(n) / parseFloat(d)).toString());
  return str;
}

function parseIngredient(raw) {
  try {
  if (!raw || !raw.trim()) return null;
  let str = raw.trim();

  // Normalize unicode fractions
  str = parseFraction(str);

  // Decode HTML entities — fractions and dashes first, then strip remainder
  str = str.replace(/&frac12;/g, '0.5').replace(/&frac14;/g, '0.25').replace(/&frac34;/g, '0.75')
           .replace(/&frac13;/g, '0.333').replace(/&frac23;/g, '0.667')
           .replace(/&frac18;/g, '0.125').replace(/&frac38;/g, '0.375')
           .replace(/&#8531;/g, '0.333').replace(/&#8532;/g, '0.667'); // ⅓ ⅔ numeric
  str = str.replace(/&#8211;/g, '-').replace(/&#8212;/g, '-').replace(/&ndash;/g, '-').replace(/&mdash;/g, '-');
  str = str.replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '').replace(/\*/g, '').trim();

  // Strip parenthetical recipe notes (not size specs)
  str = str.replace(/\((?:see|about|note|if|for|use|make|recipe)[^)]*\)/gi, '').trim();
  str = str.replace(/\(\([^)]*\)\)/g, '').trim();

  const lower = str.toLowerCase();

  // Skip vague/non-shoppable ingredients
  for (const v of VAGUE_STARTERS) {
    if (lower.startsWith(v)) return { qty: 0, unit: '', name: v, skip: true };
  }

  // Normalize written-out "one" → "1"
  str = str.replace(/^one\s+/i, '1 ');

  // Handle metric/imperial dual format: "1.25 kg / 2.5 lb" → use imperial (lb) side
  str = str.replace(/[\d.]+\s*(?:kg|g)\s*\/\s*([\d.]+\s*(?:lb|oz))/gi, '$1');

  // Normalize "4-5-pound" → "4.5 pound" (hyphenated ranges in descriptors)
  str = str.replace(/(\d+)-(\d+)-pound/gi, (_, lo, hi) => `${(parseFloat(lo)+parseFloat(hi))/2} pound`);
  str = str.replace(/(\d+)-(\d+)-ounce/gi, (_, lo, hi) => `${(parseFloat(lo)+parseFloat(hi))/2} ounce`);

  // Normalize ranges like "3-4 cups" → "3.5 cups" (take midpoint), strip leading dash artifact
  str = str.replace(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s+(cup|tbsp|tsp|oz|lb|g|cup)/gi,
    (_, lo, hi, unit) => `${(parseFloat(lo)+parseFloat(hi))/2} ${unit}`);
  // Strip stray leading hyphens from parser artifacts like "-4 cups" or "-3 tablespoons"
  str = str.replace(/^[-–]\s*/, '');
  // Normalize "juice of N lemon(s)/lime(s)" → "N tablespoons lemon juice"
  str = str.replace(/juice\s+of\s+([\d.½¼¾]+)\s+lemon/gi, '$1 tablespoons lemon juice');
  str = str.replace(/juice\s+of\s+([\d.½¼¾]+)\s+lime/gi, '$1 tablespoons lime juice');
  str = str.replace(/juice\s+of\s+one\s+lemon/gi, '2 tablespoons lemon juice');
  str = str.replace(/juice\s+of\s+one\s+lime/gi, '1 tablespoon lime juice');
  // Strip fat% from yogurt/milk: "plain 2% greek yogurt" → "plain greek yogurt"
  str = str.replace(/\b\d+%\s*/g, '');

  // Extract leading quantity: "2 1/2 cups" or "2.5 cups"
  let qty = 0;
  let rest = str;

  const qtyMatch = rest.match(/^([\d\s.+\/]+)\s*/);
  if (qtyMatch) {
    const qStr = qtyMatch[1].trim();
    // Handle "1 1/2" style mixed numbers
    const mixed = qStr.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
    if (mixed) {
      qty = parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3]);
    } else {
      try { qty = parseFloat(Function('"use strict"; return (' + qStr.replace(/\s+/g, '+') + ')')()) || 0; } catch(e) { qty = parseFloat(qStr) || 0; }
    }
    rest = rest.slice(qtyMatch[0].length).trim();
  }

  // Extract unit
  let unit = '';
  const unitPattern = new RegExp(
    '^(' + Object.keys(UNIT_TO_LABEL).sort((a,b) => b.length - a.length).map(u => u.replace(/[-]/g, '\\$&')).join('|') + ')\\b\\.?\\s*',
    'i'
  );
  const unitMatch = rest.match(unitPattern);
  if (unitMatch) {
    unit = unitMatch[1].toLowerCase().trim();
    rest = rest.slice(unitMatch[0].length).trim();
  }

  // Clean ingredient name: remove stop words, prep notes, trailing commas
  let name = rest
    .replace(/,.*$/, '')           // remove everything after first comma
    .replace(/\(.*?\)/g, '')       // remove parenthetical specs
    .trim()
    .toLowerCase();

  // Strip leading size descriptors (only at start, to preserve "red onion", "black beans")
  name = name.replace(/^(extra-large|extra large|jumbo|large|medium|small|mini|baby|bite-sized)\s+/i, '').trim();

  // Remove stop words from name
  for (const sw of STOP_WORDS) {
    name = name.replace(new RegExp(`\\b${sw}\\b`, 'gi'), '').trim();
  }
  name = name.replace(/\s+/g, ' ').trim();

  // If no qty and no recognizable unit, default qty to 1 for piece items
  if (!qty && !unit) qty = 1;

  return { qty, unit, name, raw };
  } catch(e) { return { qty: 0, unit: '', name: raw?.toLowerCase() || '', raw, skip: true }; }
}

// ── Ingredient DB lookup ──────────────────────────────────────────────────────

function lookupIngredient(name, ingDB) {
  if (!name) return null;
  const lower = name.toLowerCase().trim();

  // 1. Exact match
  if (ingDB[lower]) return ingDB[lower];

  // 2. Try removing trailing 's' (plurals)
  if (lower.endsWith('s') && ingDB[lower.slice(0, -1)]) return ingDB[lower.slice(0, -1)];
  if (lower.endsWith('es') && ingDB[lower.slice(0, -2)]) return ingDB[lower.slice(0, -2)];

  // 3. Try common aliases
  const ALIASES = {
    // Garlic
    'garlic cloves': 'garlic', 'garlic clove': 'garlic', 'garlic cloves peeled': 'garlic',
    // Tomatoes
    'cherry tomatoes': 'cherry tomato', 'grape tomatoes': 'cherry tomato',
    'roma tomatoes': 'tomato', 'plum tomatoes': 'tomato', 'tomatoes': 'tomato',
    // Chicken
    'chicken thighs': 'chicken thigh', 'chicken breasts': 'chicken breast',
    'chicken pieces': 'chicken', 'rotisserie chicken': 'chicken',
    'chicken tenders': 'chicken breast', 'chicken cutlets': 'chicken breast',
    'boneless chicken thighs': 'chicken thigh', 'boneless chicken breasts': 'chicken breast',
    'salmon fillets': 'salmon', 'salmon fillet': 'salmon',
    // Onion
    'green onions': 'green onion', 'scallions': 'green onion',
    'yellow onion': 'onion', 'yellow onions': 'onion',
    'white onion': 'onion', 'white onions': 'onion',
    'red onions': 'red onion',
    'shallots': 'shallot',
    // Bell peppers
    'bell pepper': 'sweet red pepper', 'red bell pepper': 'sweet red pepper',
    'green bell pepper': 'sweet green pepper', 'yellow bell pepper': 'sweet yellow pepper',
    'orange bell pepper': 'sweet red pepper',
    // Dairy
    'heavy cream': 'whipping cream', 'heavy whipping cream': 'whipping cream',
    'parmesan': 'parmesan cheese', 'parm': 'parmesan cheese',
    'feta': 'feta cheese', 'crumbled feta': 'feta cheese',
    'mozzarella': 'mozzarella cheese',
    'cream cheese': 'cream cheese',
    // Fats & oils
    'olive oil': 'olive oil', 'extra-virgin olive oil': 'olive oil',
    'virgin olive oil': 'olive oil',
    'vegetable oil': 'neutral cooking oil', 'canola oil': 'canola oil',
    'coconut oil': 'coconut oil',
    'sesame oil': 'sesame oil',
    // Flour
    'all-purpose flour': 'all-purpose flour', 'ap flour': 'all-purpose flour',
    'flour': 'all-purpose flour', 'all purpose flour': 'all purpose flour',
    // Broths/stocks
    'chicken stock': 'chicken broth', 'low sodium chicken broth': 'chicken broth',
    'vegetable stock': 'vegetable broth', 'beef stock': 'beef broth',
    'bone broth': 'chicken broth',
    // Ground meats
    'ground beef': 'ground beef', 'ground turkey': 'ground turkey',
    'ground chicken': 'ground chicken', 'ground pork': 'ground pork',
    // Greens
    'baby spinach': 'spinach', 'spinach leaves': 'spinach',
    'kale leaves': 'kale', 'mixed greens': 'lettuce',
    // Coconut
    'coconut milk': 'canned coconut milk', 'full-fat coconut milk': 'canned coconut milk',
    'unsweetened coconut milk': 'unsweetened coconut milk',
    // Citrus juice
    'lime juice': 'lime juice', 'lemon juice': 'lemon juice',
    'squeezed lemon juice': 'lemon juice', 'squeezed lime juice': 'lime juice',
    // Soy/tamari
    'tamari': 'soy sauce', 'coconut aminos': 'soy sauce',
    // Beans & legumes
    'black beans': 'black beans', 'can black beans': 'black beans',
    'chickpeas': 'chickpeas', 'garbanzo beans': 'chickpeas',
    'lentils': 'lentils',
    // Wine
    'dry white wine': 'white wine', 'white wine': 'white wine',
    'dry red wine': 'red wine', 'red wine': 'red wine',
    // Eggs
    'eggs': 'egg', 'egg': 'egg',
    // Herbs (fresh = same as dried for nutrition purposes)
    'parsley': 'parsley', 'flat-leaf parsley': 'parsley',
    'cilantro': 'cilantro', 'basil': 'basil', 'dill': 'dill',
    'chives': 'chives', 'mint': 'mint', 'thyme': 'thyme',
    'rosemary': 'rosemary', 'oregano': 'oregano',
    // Other
    'honey': 'honey', 'maple syrup': 'maple syrup',
    'dijon mustard': 'dijon mustard', 'whole grain mustard': 'whole grain mustard',
    'mustard': 'dijon mustard',
    'sour cream': 'sour cream',
    'avocado': 'avocado', 'avocados': 'avocado',
    'zucchini': 'zucchini', 'carrots': 'carrot', 'carrot': 'carrot',
    'celery': 'celery', 'celery stalks': 'celery',
    'mushrooms': 'mushroom', 'cremini mushrooms': 'mushroom',
    'shiitake mushrooms': 'shiitake mushroom',
    'asparagus': 'asparagus', 'broccoli': 'broccoli',
    'cauliflower': 'cauliflower', 'sweet potato': 'sweet potato',
    'sweet potatoes': 'sweet potato', 'potatoes': 'potato',
    'butternut squash': 'butternut squash',
    'limes': 'lime', 'lemons': 'lemon', 'oranges': 'orange',
    'ginger': 'ginger root', 'fresh ginger': 'ginger root',
    // Container/prep prefixes that slip through
    'head cauliflower': 'cauliflower', 'cauliflower head': 'cauliflower',
    'can tomato sauce': 'tomato sauce', 'can diced tomatoes': 'diced tomatoes',
    'can crushed tomatoes': 'crushed tomatoes', 'can whole tomatoes': 'diced tomatoes',
    'can chickpeas': 'chickpeas', 'can lentils': 'lentils',
    'can kidney beans': 'kidney beans', 'can cannellini beans': 'cannellini beans',
    'can white beans': 'cannellini beans',
    'sticks celery': 'celery', 'stick celery': 'celery',
    'handful parsley': 'parsley', 'handful basil': 'basil',
    'piece ginger': 'ginger root',
    'diamond crystal kosher salt': 'kosher salt',
    'shelled edamame': 'edamame',
    'low sodium tamari': 'soy sauce', 'low-sodium tamari': 'soy sauce',
    'low sodium soy sauce': 'soy sauce',
    'hot sauce': 'hot sauce',
    'of corn': 'corn', 'corn': 'corn',
    'tomatoes': 'tomato', 'roma tomato': 'tomato',
    'lemon zest': 'lemon', 'lime zest': 'lime',
    'zest of one lemon': 'lemon', 'zest of lemon': 'lemon',
    'juice of lemon': 'lemon juice', 'juice of lime': 'lime juice',
    'handful of parsley': 'parsley', 'handful of basil': 'basil',
    'handful of cilantro': 'cilantro', 'handful of cilantro leaves': 'cilantro',
    'greek yogurt': 'greek yogurt', 'plain greek yogurt': 'greek yogurt',
    'black beans': 'black beans',
    'sun-dried tomatoes': 'sun-dried tomatoes',
    // "or" alternatives — pick first
    'white or brown rice': 'white rice',
    'cherry or grape tomatoes': 'cherry tomato',
    // Misc
    'dry quinoa': 'quinoa', 'quinoa': 'quinoa',
    'rice': 'white rice', 'white rice': 'white rice', 'brown rice': 'brown rice',
  };
  if (ALIASES[lower] && ingDB[ALIASES[lower]]) return ingDB[ALIASES[lower]];

  // 4. Try stripping leading prep/size word and re-matching
  //    e.g. "chopped parsley" → "parsley", "large yellow onion" → "yellow onion"
  const PREP_PREFIX = /^(chopped|diced|minced|sliced|grated|crumbled|shredded|mashed|cooked|roasted|raw|dried|frozen|canned|large|medium|small|whole|boneless|skinless)\s+/i;
  if (PREP_PREFIX.test(lower)) {
    const stripped = lower.replace(PREP_PREFIX, '').trim();
    if (ingDB[stripped]) return ingDB[stripped];
    if (ALIASES[stripped] && ingDB[ALIASES[stripped]]) return ingDB[ALIASES[stripped]];
  }

  // 5. Try first word (e.g., "rotisserie chicken" → "chicken")
  const firstWord = lower.split(' ')[0];
  if (firstWord.length > 3 && ingDB[firstWord]) return ingDB[firstWord];

  // 6. Partial match — find DB key that contains all words of the name
  const words = lower.split(' ').filter(w => w.length > 2);
  if (words.length > 0) {
    const match = Object.keys(ingDB).find(k =>
      words.every(w => k.includes(w))
    );
    if (match) return ingDB[match];
  }

  // 7. Last-word fallback — "kosher salt and black pepper" → try last main word
  const lastWord = lower.split(/\s+and\s+|\s+&\s+/).pop()?.trim();
  if (lastWord && lastWord !== lower && ingDB[lastWord]) return ingDB[lastWord];

  return null;
}

// ── Unit → grams conversion ───────────────────────────────────────────────────

function toGrams(qty, unit, ingEntry) {
  if (!qty || qty === 0) return 0;

  const label = UNIT_TO_LABEL[unit?.toLowerCase()] || '';

  // 1. Try to find measure in DB entry
  if (ingEntry && ingEntry.measures && label) {
    const measure = ingEntry.measures.find(m =>
      m.label && m.label.toLowerCase() === label.toLowerCase()
    );
    if (measure && measure.gramWeight > 0) return qty * measure.gramWeight;
  }

  // 2. Fall back to standard conversion
  if (label && FALLBACK_GRAMS[label]) return qty * FALLBACK_GRAMS[label];

  // 3. If no unit, assume grams (e.g., count items use the "Serving" measure)
  if (!unit || unit === '') {
    if (ingEntry && ingEntry.measures) {
      const serving = ingEntry.measures.find(m => m.label && m.label === 'Serving');
      if (serving && serving.gramWeight > 0) return qty * serving.gramWeight;
      // Use first valid measure as fallback
      const first = ingEntry.measures.find(m => m.label && m.gramWeight > 0);
      if (first) return qty * first.gramWeight;
    }
    return qty * 100; // assume ~100g per unit as last resort
  }

  return 0;
}

// ── Nutrition calculator ──────────────────────────────────────────────────────

const NUTRIENTS = ['calories','protein','fat','saturatedFat','monounsaturatedFat',
  'polyunsaturatedFat','transFat','cholesterol','carbs','fiber','sugar','addedSugar',
  'sodium','potassium','calcium','magnesium','phosphorus','iron','zinc',
  'vitaminA','vitaminC','vitaminD','vitaminE','vitaminK',
  'vitaminB1','vitaminB2','vitaminB3','vitaminB6','folate','vitaminB12','water'];

function calculateIngredientNutrition(grams, ingEntry) {
  if (!grams || grams === 0 || !ingEntry || !ingEntry.per100g) return null;
  const result = {};
  for (const key of NUTRIENTS) {
    const n = ingEntry.per100g[key];
    if (n != null) {
      const val = n.value != null ? n.value : n; // handle both {value, unit} and plain number
      result[key] = Math.round((val * grams / 100) * 100) / 100;
    }
  }
  return result;
}

function sumNutrition(items) {
  const total = {};
  for (const item of items) {
    if (!item.nutrition) continue;
    for (const [key, val] of Object.entries(item.nutrition)) {
      total[key] = Math.round(((total[key] || 0) + val) * 100) / 100;
    }
  }
  return total;
}

function divideNutrition(total, servings) {
  const perServing = {};
  for (const [key, val] of Object.entries(total)) {
    perServing[key] = Math.round((val / servings) * 100) / 100;
  }
  return perServing;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Loading data...');
  const ingDB       = JSON.parse(fs.readFileSync(INGREDIENT_DB, 'utf8'));
  const edamamProg  = JSON.parse(fs.readFileSync(EDAMAM_PROG,   'utf8'));
  const servingsProg = JSON.parse(fs.readFileSync(SERVINGS_PROG, 'utf8'));

  let progress = {};
  if (fs.existsSync(PROGRESS_FILE)) {
    progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    console.log(`Resuming — ${Object.keys(progress).length} already done`);
  }

  console.log('Fetching recipes from Firestore...');
  const snap = await db.collection('recipes')
    .where('status', 'in', ['approved', 'needs_review'])
    .get();

  const recipes = [];
  snap.forEach(doc => {
    const d = doc.data();
    if (d.ingredients && d.ingredients.length >= 2) {
      recipes.push({ id: doc.id, name: d.name, ingredients: d.ingredients });
    }
  });

  const todo = recipes.filter(r => !progress[r.id]);
  console.log(`${recipes.length} total recipes | ${todo.length} remaining\n`);

  let matched = 0, partial = 0, failed = 0, withEdamam = 0;
  let totalDelta = 0, deltaCount = 0;

  for (let i = 0; i < todo.length; i++) {
    const recipe = todo[i];
    const servingsEntry = servingsProg[recipe.id];
    const servings = servingsEntry?.servings || 4; // default 4 if missing
    const edamamResult = edamamProg[recipe.id];

    process.stdout.write(`[${String(i+1).padStart(4)}/${todo.length}] ${recipe.name.slice(0,55).padEnd(55)} `);

    // Parse and calculate each ingredient
    const ingredientResults = [];
    let matchedCount = 0, totalCount = 0;

    for (const raw of recipe.ingredients) {
      if (!raw || !raw.trim()) continue;
      totalCount++;

      const parsed = parseIngredient(raw);
      if (!parsed || parsed.skip) {
        ingredientResults.push({ raw, name: parsed?.name || raw, skip: true });
        continue;
      }

      const ingEntry = lookupIngredient(parsed.name, ingDB);
      const grams    = ingEntry ? toGrams(parsed.qty, parsed.unit, ingEntry) : 0;
      const nutrition = grams > 0 ? calculateIngredientNutrition(grams, ingEntry) : null;

      if (ingEntry && grams > 0 && nutrition) matchedCount++;

      ingredientResults.push({
        raw,
        name:     parsed.name,
        qty:      parsed.qty,
        unit:     parsed.unit,
        grams:    Math.round(grams * 10) / 10,
        matched:  !!(ingEntry && grams > 0),
        dbLabel:  ingEntry?.label || null,
        nutrition,
      });
    }

    // Sum all ingredients
    const itemsWithNutrition = ingredientResults.filter(r => r.nutrition);
    const total    = sumNutrition(itemsWithNutrition);
    const perServing = Object.keys(total).length > 0 ? divideNutrition(total, servings) : null;

    // Cross-reference against Edamam
    let edamamDelta = null;
    if (edamamResult?.status === 'ok' && edamamResult.nutrition?.calories && total.calories) {
      edamamDelta = Math.round(Math.abs(total.calories - edamamResult.nutrition.calories) / edamamResult.nutrition.calories * 100);
      totalDelta += edamamDelta;
      deltaCount++;
      withEdamam++;
    }

    const matchRate = totalCount > 0 ? Math.round(matchedCount / totalCount * 100) : 0;

    // Track status
    if (matchRate === 100) matched++;
    else if (matchRate >= 50) partial++;
    else failed++;

    progress[recipe.id] = {
      status: matchRate >= 50 ? 'ok' : 'partial',
      matchRate,
      servings,
      edamamDelta,
      nutrition: {
        ingredients: ingredientResults,
        total,
        perServing,
        servings,
        source: 'ingredient_db_v2',
        calculatedAt: new Date().toISOString().split('T')[0],
        edamamDelta,
        edamamCalories: edamamResult?.status === 'ok' ? edamamResult.nutrition?.calories : null,
      },
    };

    const deltaStr = edamamDelta !== null ? ` Δ${edamamDelta}%` : '';
    console.log(`✓ ${matchedCount}/${totalCount} matched (${matchRate}%)${deltaStr}`);

    // Save every 50
    if ((i + 1) % 50 === 0) {
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
      console.log(`  [saved — ${i+1} done | full:${matched} partial:${partial} failed:${failed}]`);
    }
  }

  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));

  const avgDelta = deltaCount > 0 ? Math.round(totalDelta / deltaCount) : 0;
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('RECIPE NUTRITION CALCULATION COMPLETE');
  console.log(`  Full match (100%):    ${matched}`);
  console.log(`  Partial (50-99%):     ${partial}`);
  console.log(`  Low match (<50%):     ${failed}`);
  console.log(`  Edamam cross-ref:     ${withEdamam} recipes`);
  console.log(`  Avg calorie delta:    ${avgDelta}% vs Edamam`);
  console.log(`  Saved → data/recipe_nutrition_progress.json`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
