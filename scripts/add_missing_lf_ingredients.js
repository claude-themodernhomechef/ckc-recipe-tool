/**
 * add_missing_lf_ingredients.js
 * Adds nutrition entries for ingredients used in LF swaps that were missing from the DB:
 *   - garlic-infused oil  (same macros as olive oil)
 *   - scallion tops       (USDA FDC #170006 — "Onions, young green, tops only")
 *   - lactose-free greek yogurt (same macros as plain greek yogurt)
 */

const fs   = require('fs');
const path = require('path');

const ROOT  = path.join(__dirname, '..');
const FILES = [
  path.join(ROOT, 'data',      'ingredientNutrition_v2.json'),
  path.join(ROOT, 'functions', 'ingredientNutrition_v2.json'),
];

const OLIVE_OIL = {
  source: 'usda', label: 'Garlic-Infused Olive Oil', category: 'Oils',
  per100g: {
    calories: { value: 884,  unit: 'kcal' },
    protein:  { value: 0,    unit: 'g'    },
    fat:      { value: 100,  unit: 'g'    },
    carbs:    { value: 0,    unit: 'g'    },
    fiber:    { value: 0,    unit: 'g'    },
  },
  measures: [
    { label: 'Tablespoon', gramWeight: 13.5 },
    { label: 'Teaspoon',   gramWeight: 4.5  },
    { label: 'Cup',        gramWeight: 216  },
  ],
};

const SCALLION_TOPS = {
  source: 'usda', foodId: '170006',
  label: 'Onions, young green, tops only', category: 'Vegetables',
  per100g: {
    calories: { value: 27,   unit: 'kcal' },
    protein:  { value: 0.97, unit: 'g'    },
    fat:      { value: 0.47, unit: 'g'    },
    carbs:    { value: 5.74, unit: 'g'    },
    fiber:    { value: 1.8,  unit: 'g'    },
  },
  measures: [
    { label: 'Cup, chopped', gramWeight: 100 },
    { label: 'Tablespoon',   gramWeight: 6   },
    { label: 'Gram',         gramWeight: 1   },
  ],
};

const LF_YOGURT = {
  source: 'manual', label: 'Lactose-Free Greek Yogurt', category: 'Dairy',
  per100g: {
    calories: { value: 87,  unit: 'kcal' },
    protein:  { value: 7.3, unit: 'g'    },
    fat:      { value: 5.3, unit: 'g'    },
    carbs:    { value: 3.3, unit: 'g'    },
    fiber:    { value: 0,   unit: 'g'    },
  },
  measures: [
    { label: 'Cup',        gramWeight: 245  },
    { label: 'Tablespoon', gramWeight: 15   },
  ],
};

const ENTRIES = [
  { entry: OLIVE_OIL, keys: [
    'garlic-infused oil',
    'garlic infused oil',
    'garlic-infused olive oil',
    'garlic infused olive oil',
  ]},
  { entry: SCALLION_TOPS, keys: [
    'scallion tops',
    'scallion top',
    'green tops of scallions',
    'green tops of scallion',
    'green tops',
    'green onion tops',
    'green parts of scallions',
    'tops of scallions',
  ]},
  { entry: LF_YOGURT, keys: [
    'lactose-free greek yogurt',
    'lactose free greek yogurt',
    'lactose-free yogurt',
    'lactose free yogurt',
    'lactose-free plain greek yogurt',
  ]},
];

for (const filePath of FILES) {
  const db = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let added = 0, updated = 0;
  for (const { entry, keys } of ENTRIES) {
    for (const key of keys) {
      if (db[key]) { db[key] = entry; updated++; }
      else         { db[key] = entry; added++;   }
    }
  }
  fs.writeFileSync(filePath, JSON.stringify(db, null, 2));
  console.log(`${path.relative(ROOT, filePath)}: ${added} added, ${updated} updated`);
}

for (const { entry, keys } of ENTRIES) {
  console.log(`\n${entry.label}:`);
  console.log(`  Keys: ${keys.join(', ')}`);
  console.log(`  Per 100g: ${JSON.stringify(entry.per100g)}`);
}
