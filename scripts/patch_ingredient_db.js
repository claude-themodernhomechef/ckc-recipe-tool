/**
 * patch_ingredient_db.js
 *
 * One-time patch to update data/ingredientNutrition_v2.json with corrected
 * USDA-sourced per100g data and updated/added measures for 9 ingredients.
 *
 * Run: node scripts/patch_ingredient_db.js
 */

const fs   = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/ingredientNutrition_v2.json');

const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

// ── Helper: build a per100g nutrient object in the DB format ─────────────────
function n(value, unit) {
  return { value, unit };
}

// ── 1. heavy cream ───────────────────────────────────────────────────────────
db['heavy cream'].per100g = {
  calories:           n(340,   'kcal'),
  protein:            n(2.84,  'g'),
  fat:                n(36.08, 'g'),
  carbs:              n(2.84,  'g'),
  fiber:              n(0,     'g'),
  sugar:              n(2.92,  'g'),
  saturatedFat:       n(23.03, 'g'),
  monounsaturatedFat: n(9.1,   'g'),
  polyunsaturatedFat: n(1.57,  'g'),
  transFat:           n(1.24,  'g'),
  cholesterol:        n(113,   'mg'),
  sodium:             n(27,    'mg'),
  potassium:          n(95,    'mg'),
  calcium:            n(66,    'mg'),
  magnesium:          n(7,     'mg'),
  phosphorus:         n(58,    'mg'),
  iron:               n(0.1,   'mg'),
  zinc:               n(0.24,  'mg'),
  vitaminA:           n(411,   'µg'),
  vitaminC:           n(0.6,   'mg'),
  vitaminD:           n(1.6,   'µg'),
  vitaminE:           n(0.92,  'mg'),
  vitaminK:           n(3.2,   'µg'),
  vitaminB1:          n(0.02,  'mg'),
  vitaminB2:          n(0.188, 'mg'),
  vitaminB3:          n(0.064, 'mg'),
  vitaminB6:          n(0.035, 'mg'),
  folate:             n(4,     'µg'),
  vitaminB12:         n(0.16,  'µg'),
  water:              n(57.71, 'g'),
};
// Add Pint measure if not already present
if (!db['heavy cream'].measures.find(m => m.label === 'Pint')) {
  db['heavy cream'].measures.push({ label: 'Pint', gramWeight: 476 });
}
console.log('✓ heavy cream — per100g updated, Pint measure added');

// ── 2. bacon ─────────────────────────────────────────────────────────────────
db['bacon'].per100g = {
  calories:     n(571,   'kcal'),
  protein:      n(28.57, 'g'),
  fat:          n(50,    'g'),
  carbs:        n(0,     'g'),
  fiber:        n(0,     'g'),
  sugar:        n(0,     'g'),
  saturatedFat: n(17.86, 'g'),
  cholesterol:  n(214,   'mg'),
  sodium:       n(2071,  'mg'),
  iron:         n(2.57,  'mg'),
};
console.log('✓ bacon — per100g updated (measures unchanged)');

// ── 3. bone-in chicken thighs ────────────────────────────────────────────────
db['bone-in chicken thighs'].per100g = {
  calories:     n(239,   'kcal'),
  protein:      n(24.42, 'g'),
  fat:          n(15.66, 'g'),
  carbs:        n(0,     'g'),
  fiber:        n(0,     'g'),
  sugar:        n(0,     'g'),
  saturatedFat: n(4.87,  'g'),
  cholesterol:  n(136,   'mg'),
  sodium:       n(60,    'mg'),
  calcium:      n(10,    'mg'),
  iron:         n(0.4,   'mg'),
};
// Update Piece gramWeight from 85 → 130
const pieceIdx = db['bone-in chicken thighs'].measures.findIndex(m => m.label === 'Piece');
if (pieceIdx !== -1) {
  db['bone-in chicken thighs'].measures[pieceIdx].gramWeight = 130;
  console.log('✓ bone-in chicken thighs — per100g updated, Piece gramWeight → 130');
} else {
  db['bone-in chicken thighs'].measures.push({ label: 'Piece', gramWeight: 130 });
  console.log('✓ bone-in chicken thighs — per100g updated, Piece measure added (130g)');
}

// ── 4. chicken broth ─────────────────────────────────────────────────────────
db['chicken broth'].per100g = {
  calories:     n(8,     'kcal'),
  protein:      n(1.67,  'g'),
  fat:          n(0,     'g'),
  carbs:        n(0.42,  'g'),
  fiber:        n(0,     'g'),
  sugar:        n(0.42,  'g'),
  saturatedFat: n(0,     'g'),
  cholesterol:  n(0,     'mg'),
  sodium:       n(212,   'mg'),
};
// Confirm Quart=960g and Cup=240g exist; add if missing
if (!db['chicken broth'].measures.find(m => m.label === 'Quart')) {
  db['chicken broth'].measures.push({ label: 'Quart', gramWeight: 960 });
  console.log('  → chicken broth: added Quart=960g');
} else {
  console.log('  → chicken broth: Quart already present');
}
if (!db['chicken broth'].measures.find(m => m.label === 'Cup')) {
  db['chicken broth'].measures.push({ label: 'Cup', gramWeight: 240 });
  console.log('  → chicken broth: added Cup=240g');
} else {
  console.log('  → chicken broth: Cup already present');
}
console.log('✓ chicken broth — per100g updated');

// ── 5. vegetable broth ───────────────────────────────────────────────────────
db['vegetable broth'].per100g = {
  calories:     n(6,     'kcal'),
  protein:      n(0,     'g'),
  fat:          n(0,     'g'),
  carbs:        n(1.25,  'g'),
  fiber:        n(0,     'g'),
  sugar:        n(0.83,  'g'),
  saturatedFat: n(0,     'g'),
  cholesterol:  n(0,     'mg'),
  sodium:       n(238,   'mg'),
};
// Update Cup gramWeight to 240g (currently 227g)
const vbCupIdx = db['vegetable broth'].measures.findIndex(m => m.label === 'Cup');
if (vbCupIdx !== -1) {
  const old = db['vegetable broth'].measures[vbCupIdx].gramWeight;
  db['vegetable broth'].measures[vbCupIdx].gramWeight = 240;
  console.log(`✓ vegetable broth — per100g updated, Cup gramWeight ${old} → 240`);
} else {
  db['vegetable broth'].measures.push({ label: 'Cup', gramWeight: 240 });
  console.log('✓ vegetable broth — per100g updated, Cup=240g added');
}
// Also update Serving (was 227) to stay consistent
const vbServIdx = db['vegetable broth'].measures.findIndex(m => m.label === 'Serving');
if (vbServIdx !== -1 && db['vegetable broth'].measures[vbServIdx].gramWeight === 227) {
  db['vegetable broth'].measures[vbServIdx].gramWeight = 240;
  console.log('  → vegetable broth: Serving gramWeight updated to 240 for consistency');
}

// ── 6. havarti cheese ────────────────────────────────────────────────────────
db['havarti cheese'].per100g = {
  calories:     n(400,  'kcal'),
  protein:      n(20,   'g'),
  fat:          n(30,   'g'),
  carbs:        n(0,    'g'),
  fiber:        n(0,    'g'),
  sugar:        n(0,    'g'),
  saturatedFat: n(20,   'g'),
  cholesterol:  n(100,  'mg'),
  sodium:       n(525,  'mg'),
  calcium:      n(830,  'mg'),
  potassium:    n(80,   'mg'),
  iron:         n(0,    'mg'),
};
// Add Slice measure if not already present
if (!db['havarti cheese'].measures.find(m => m.label === 'Slice')) {
  db['havarti cheese'].measures.push({ label: 'Slice', gramWeight: 28 });
  console.log('✓ havarti cheese — per100g updated, Slice=28g added');
} else {
  console.log('✓ havarti cheese — per100g updated, Slice already present');
}

// ── 7. sea bass ──────────────────────────────────────────────────────────────
db['sea bass'].per100g = {
  calories:     n(209,   'kcal'),
  protein:      n(14.93, 'g'),
  fat:          n(16.57, 'g'),
  carbs:        n(0.14,  'g'),
  fiber:        n(0,     'g'),
  saturatedFat: n(0,     'g'),
  cholesterol:  n(0,     'mg'),
  sodium:       n(109,   'mg'),
  potassium:    n(236,   'mg'),
  magnesium:    n(17,    'mg'),
  phosphorus:   n(152,   'mg'),
  zinc:         n(0.29,  'mg'),
  vitaminB12:   n(0.59,  'µg'),
};
// Add Piece measure if not already present
if (!db['sea bass'].measures.find(m => m.label === 'Piece')) {
  db['sea bass'].measures.push({ label: 'Piece', gramWeight: 170 });
  console.log('✓ sea bass — per100g updated, Piece=170g added');
} else {
  console.log('✓ sea bass — per100g updated, Piece already present');
}

// ── 8. baby bella mushrooms ──────────────────────────────────────────────────
db['baby bella mushrooms'].per100g = {
  calories:     n(24,   'kcal'),
  protein:      n(2.41, 'g'),
  fat:          n(0,    'g'),
  carbs:        n(4.82, 'g'),
  fiber:        n(0.6,  'g'),
  sugar:        n(1.2,  'g'),
  saturatedFat: n(0,    'g'),
  cholesterol:  n(0,    'mg'),
  sodium:       n(0,    'mg'),
  potassium:    n(448,  'mg'),
  calcium:      n(2,    'mg'),
  iron:         n(0.41, 'mg'),
};
// Add Pint measure if not already present
if (!db['baby bella mushrooms'].measures.find(m => m.label === 'Pint')) {
  db['baby bella mushrooms'].measures.push({ label: 'Pint', gramWeight: 227 });
  console.log('✓ baby bella mushrooms — per100g updated, Pint=227g added');
} else {
  console.log('✓ baby bella mushrooms — per100g updated, Pint already present');
}

// ── 9. italian bread ─────────────────────────────────────────────────────────
db['italian bread'].per100g = {
  calories:     n(244,  'kcal'),
  protein:      n(6.67, 'g'),
  fat:          n(0,    'g'),
  carbs:        n(51.11,'g'),
  fiber:        n(2.2,  'g'),
  sugar:        n(0,    'g'),
  saturatedFat: n(0,    'g'),
  cholesterol:  n(0,    'mg'),
  sodium:       n(489,  'mg'),
  potassium:    n(111,  'mg'),
  iron:         n(3.33, 'mg'),
};
// Update Slice gramWeight from 28 → 35
const ibSliceIdx = db['italian bread'].measures.findIndex(m => m.label === 'Slice');
if (ibSliceIdx !== -1) {
  const old = db['italian bread'].measures[ibSliceIdx].gramWeight;
  db['italian bread'].measures[ibSliceIdx].gramWeight = 35;
  console.log(`✓ italian bread — per100g updated, Slice gramWeight ${old} → 35`);
} else {
  db['italian bread'].measures.push({ label: 'Slice', gramWeight: 35 });
  console.log('✓ italian bread — per100g updated, Slice=35g added');
}
// Also update Serving if it matches the old Slice weight
const ibServIdx = db['italian bread'].measures.findIndex(m => m.label === 'Serving');
if (ibServIdx !== -1 && db['italian bread'].measures[ibServIdx].gramWeight === 28) {
  db['italian bread'].measures[ibServIdx].gramWeight = 35;
  console.log('  → italian bread: Serving gramWeight also updated to 35 for consistency');
}

// ── Write back ────────────────────────────────────────────────────────────────
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
console.log('\nDB written successfully to', DB_PATH);
