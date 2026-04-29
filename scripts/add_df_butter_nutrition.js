/**
 * add_df_butter_nutrition.js
 * Adds Miyoko's Organic Vegan Butter nutrition (scaled to per 100g)
 * to both data/ingredientNutrition_v2.json and functions/ingredientNutrition_v2.json.
 *
 * Source: Miyoko's label — 1 tbsp (14g) = 90 cal, 10g fat, 0g protein/carbs/fiber
 * Per 100g: calories=642.86, fat=71.43, protein=0, carbs=0, fiber=0
 *
 * Usage: node scripts/add_df_butter_nutrition.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILES = [
  path.join(ROOT, 'data',      'ingredientNutrition_v2.json'),
  path.join(ROOT, 'functions', 'ingredientNutrition_v2.json'),
];

const ENTRY = {
  source:   'manual',
  label:    "Miyoko's Organic Vegan Butter",
  category: 'Dairy-free products',
  per100g: {
    calories: { value: 642.86, unit: 'kcal' },
    protein:  { value: 0,      unit: 'g'    },
    fat:      { value: 71.43,  unit: 'g'    },
    carbs:    { value: 0,      unit: 'g'    },
    fiber:    { value: 0,      unit: 'g'    },
  },
  measures: [
    { label: 'Tablespoon', gramWeight: 14 },
    { label: 'Teaspoon',   gramWeight: 4.67 },
    { label: 'Gram',       gramWeight: 1 },
    { label: 'Ounce',      gramWeight: 28.35 },
  ],
};

// All lookup keys the swap system might use for this ingredient
const KEYS = [
  'df butter',
  'dairy-free butter',
  "miyoko's butter",
  "miyoko's",
  'miyokos butter',
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
