// export_ingredients_csv.js
// Reads all recipe ingredients from Firestore, parses them, and exports
// a CSV of: ingredient_name, category, frequency, example_raw
// Run: node scripts/export_ingredients_csv.js

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ── Firebase init ──────────────────────────────────────────────────────────
const serviceAccount = require('../.firebase/service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Ingredient parser (mirrors shopping.html logic) ────────────────────────
const FRACTION_MAP = {'½':'1/2','⅓':'1/3','⅔':'2/3','¼':'1/4','¾':'3/4','⅛':'1/8'};
const UNITS = new Set(['cup','cups','tbsp','tablespoon','tablespoons','tsp','teaspoon','teaspoons',
  'oz','ounce','ounces','lb','pound','pounds','g','gram','grams','kg','ml','liter','liters',
  'clove','cloves','head','heads','bunch','bunches','can','cans','pkg','package','packages',
  'sprig','sprigs','stalk','stalks','pinch','pinches','dash','dashes','inch','inches','qt','pt',
  'slice','slices','piece','pieces']);
const STOP_WORDS = new Set(['freshly','dried','fresh','frozen','large','medium','small','whole',
  'extra','firm','soft','ripe','packed','heaping','leveled','rounded','about','approximately',
  'roughly','chopped','diced','minced','sliced','grated','shredded','peeled','crushed','halved',
  'quartered','optional','divided','softened','melted','cooled','drained','rinsed','torn','trimmed',
  'julienned','cubed','zested','deveined','deboned','pitted','cored','seeded','blanched','seared',
  'caramelized','roasted','toasted','grilled','charred','smoked','pickled','marinated','brined',
  'cured','thin','thick','fine','finely','coarsely','thinly','warm','hot','cold','chilled','thawed',
  'good','quality','organic','store-bought','homemade','low-sodium','unsweetened','reduced-fat',
  'full-fat','light','dark','raw','uncooked','cooked','leftover','day-old','and']);

const INGREDIENT_CATEGORIES = {
  // Proteins
  'chicken':'protein','turkey':'protein','beef':'protein','pork':'protein','lamb':'protein',
  'salmon':'protein','shrimp':'protein','tuna':'protein','cod':'protein','fish':'protein',
  'tofu':'protein','tempeh':'protein','egg':'protein','eggs':'protein','bacon':'protein',
  'sausage':'protein','ham':'protein','scallop':'protein','crab':'protein','lobster':'protein',
  // Produce
  'onion':'produce','garlic':'produce','tomato':'produce','lemon':'produce','lime':'produce',
  'orange':'produce','ginger':'produce','carrot':'produce','celery':'produce','potato':'produce',
  'mushroom':'produce','spinach':'produce','kale':'produce','pepper':'produce','zucchini':'produce',
  'broccoli':'produce','cauliflower':'produce','avocado':'produce','apple':'produce',
  'cucumber':'produce','lettuce':'produce','arugula':'produce','herbs':'produce',
  // Dairy
  'butter':'dairy','cheese':'dairy','cream':'dairy','milk':'dairy','yogurt':'dairy',
  'feta':'dairy','parmesan':'dairy','mozzarella':'dairy','cheddar':'dairy',
  // Pantry staples
  'oil':'pantry-staples','vinegar':'pantry-staples','salt':'pantry-staples',
  'pepper':'pantry-staples','sauce':'pantry-staples','mustard':'pantry-staples',
  // Pantry consumables
  'flour':'pantry-consumables','pasta':'pantry-consumables','rice':'pantry-consumables',
  'beans':'pantry-consumables','lentils':'pantry-consumables','broth':'pantry-consumables',
};

function parseIngredientName(raw) {
  let s = raw;
  // Replace unicode fractions
  for (const [k,v] of Object.entries(FRACTION_MAP)) s = s.replace(new RegExp(k,'g'), v);
  // Remove parentheticals
  s = s.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '');
  // Remove leading quantity
  s = s.replace(/^\s*\d[\d\s./]*\s*/, '');
  // Remove unit
  const unitRe = new RegExp('^(' + [...UNITS].join('|') + ')s?\\s+', 'i');
  s = s.replace(unitRe, '');
  // Remove stop words
  const words = s.split(/\s+/).filter(w => w && !STOP_WORDS.has(w.toLowerCase().replace(/[^a-z]/g,'')));
  s = words.join(' ').trim().toLowerCase().replace(/[,;]+$/, '').trim();
  return s;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('Fetching recipes from Firestore...');
  const snap = await db.collection('recipes').where('status', '==', 'yes').get();
  console.log(`${snap.size} recipes loaded`);

  // Map: parsed_name → { count, category_guess, example_raw, raw_variants }
  const map = new Map();

  for (const doc of snap.docs) {
    const data = doc.data();
    const ings = data.ingredients || [];
    for (const raw of ings) {
      if (!raw || typeof raw !== 'string') continue;
      const name = parseIngredientName(raw);
      if (!name || name.length < 2) continue;

      if (!map.has(name)) {
        // Guess category from keyword match
        let cat = 'pantry-staples';
        const lower = name.toLowerCase();
        for (const [kw, c] of Object.entries(INGREDIENT_CATEGORIES)) {
          if (lower.includes(kw)) { cat = c; break; }
        }
        map.set(name, { count: 0, category: cat, example_raw: raw });
      }
      map.get(name).count++;
    }
  }

  // Sort by frequency desc
  const sorted = [...map.entries()].sort((a,b) => b[1].count - a[1].count);

  // Write CSV
  const rows = [['ingredient_name','category','frequency','example_raw']];
  for (const [name, info] of sorted) {
    rows.push([name, info.category, info.count, info.example_raw]);
  }

  const csv = rows.map(r =>
    r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')
  ).join('\n');

  const outPath = path.join(__dirname, '..', 'firestore_ingredients.csv');
  fs.writeFileSync(outPath, csv);
  console.log(`\nDone! ${sorted.length} unique ingredients → firestore_ingredients.csv`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
