/**
 * add_coconut_yogurt_nutrition.js
 * Adds coconut yogurt nutrition (per 100g) from USDA FDC #2664530
 * to both data/ingredientNutrition_v2.json and functions/ingredientNutrition_v2.json.
 *
 * Source: USDA FoodData Central FDC ID 2664530
 * Per 100g: calories=147, fat=13.86, protein=1.54, carbs=4.61, fiber=1.58
 *
 * Usage: node scripts/add_coconut_yogurt_nutrition.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILES = [
  path.join(ROOT, 'data',      'ingredientNutrition_v2.json'),
  path.join(ROOT, 'functions', 'ingredientNutrition_v2.json'),
];

const ENTRY = {
  source:   'usda',
  foodId:   '2664530',
  label:    'Coconut Yogurt',
  category: 'Dairy-free products',
  per100g: {
    calories: { value: 147,   unit: 'kcal' },
    protein:  { value: 1.54,  unit: 'g'    },
    fat:      { value: 13.86, unit: 'g'    },
    carbs:    { value: 4.61,  unit: 'g'    },
    fiber:    { value: 1.58,  unit: 'g'    },
  },
  measures: [
    { label: 'Cup',        gramWeight: 245 },
    { label: 'Tablespoon', gramWeight: 15  },
    { label: 'Gram',       gramWeight: 1   },
    { label: 'Ounce',      gramWeight: 28.35 },
  ],
};

const KEYS = [
  'coconut yogurt',
  'plain unsweetened coconut yogurt',
  'unsweetened coconut yogurt',
  'coconut milk yogurt',
];

for (const filePath of FILES) {
  const db = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let added = 0, updated = 0;
  for (const key of KEYS) {
    if (db[key]) { db[key] = ENTRY; updated++; }
    else         { db[key] = ENTRY; added++;   }
  }
  fs.writeFileSync(filePath, JSON.stringify(db, null, 2));
  console.log(`${path.relative(ROOT, filePath)}: ${added} added, ${updated} updated`);
}

console.log('\nKeys written:', KEYS.join(', '));
console.log('Per 100g:', JSON.stringify(ENTRY.per100g));
