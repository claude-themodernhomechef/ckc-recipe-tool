/**
 * fix_golden_curry_lentil_soup.js
 * ────────────────────────────────
 * Fixes data issues in the "1-Pot Golden Curry Lentil Soup" recipe:
 *   1. Cleans messy ingredient lines (double-paren notes, "X or Y" patterns)
 *   2. Fixes HTML entity in Garlic flatbread line
 *   3. Adds LF diet modification note (shallot/garlic → garlic-infused oil)
 *
 * Usage:
 *   node scripts/fix_golden_curry_lentil_soup.js
 *   node scripts/fix_golden_curry_lentil_soup.js --dry-run
 */

const admin = require('firebase-admin');
const path  = require('path');

const SA_KEY  = path.join(__dirname, '..', 'service-account.json');
const DRY_RUN = process.argv.includes('--dry-run');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(SA_KEY) });
}
const db = admin.firestore();

const RECIPE_ID = '1-pot-golden-curry-lentil-soup';

async function main() {
  const ref = db.collection('recipes').doc(RECIPE_ID);
  const snap = await ref.get();

  if (!snap.exists) {
    console.error('Recipe not found:', RECIPE_ID);
    process.exit(1);
  }

  const data = snap.data();

  // ── 1. Clean ingredients ──────────────────────────────────────────────────
  const originalIngredients = data.ingredients || [];
  console.log('\n--- ORIGINAL INGREDIENTS ---');
  originalIngredients.forEach((line, i) => console.log(`  [${i}] ${line}`));

  const cleanedIngredients = originalIngredients.map(line => {
    // Remove double-paren notes like ((text here))
    let clean = line.replace(/\s*\(\([^)]*\)\)/g, '').trim();

    // "red or golden lentils" → "red lentils"
    clean = clean.replace(/uncooked\s+rinsed\s+red\s+or\s+golden\s+lentils/i, 'red lentils');
    clean = clean.replace(/red\s+or\s+golden\s+lentils/i, 'red lentils');

    // "Fresh lemon or lime juice" → "Fresh lemon juice"
    clean = clean.replace(/fresh\s+lemon\s+or\s+lime\s+juice/i, 'Fresh lemon juice');

    // Fix HTML entity
    clean = clean.replace(/&amp;/g, '&');

    // Clean up extra whitespace
    clean = clean.replace(/\s{2,}/g, ' ').trim();

    return clean;
  });

  console.log('\n--- CLEANED INGREDIENTS ---');
  cleanedIngredients.forEach((line, i) => {
    const changed = line !== originalIngredients[i];
    if (changed) console.log(`  [${i}] ${line}  ← CHANGED`);
    else         console.log(`  [${i}] ${line}`);
  });

  // ── 2. Add LF modification note ───────────────────────────────────────────
  const dietTags = { ...(data.dietTags || {}) };

  const currentLF = dietTags['Low-FODMAP'] || {};
  console.log('\n--- CURRENT LF TAG ---');
  console.log(JSON.stringify(currentLF, null, 2));

  // Only update if not already set
  const lfNoteNeeded = !currentLF.notes ||
    !currentLF.notes.toLowerCase().includes('garlic-infused oil');

  if (lfNoteNeeded) {
    dietTags['Low-FODMAP'] = {
      ...currentLF,
      mod: true,
      native: false,
      notes: 'Use garlic-infused oil instead of shallot and garlic, which are high-FODMAP.',
    };
    console.log('\n--- UPDATED LF TAG ---');
    console.log(JSON.stringify(dietTags['Low-FODMAP'], null, 2));
  } else {
    console.log('\nLF note already set — skipping.');
  }

  // ── 3. Build update payload ───────────────────────────────────────────────
  const updates = {};

  const ingredientsChanged = JSON.stringify(cleanedIngredients) !== JSON.stringify(originalIngredients);
  if (ingredientsChanged) updates.ingredients = cleanedIngredients;
  if (lfNoteNeeded)       updates.dietTags = dietTags;

  if (Object.keys(updates).length === 0) {
    console.log('\nNo changes needed.');
    process.exit(0);
  }

  console.log('\n--- FIELDS TO UPDATE ---');
  console.log(Object.keys(updates).join(', '));

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes written.');
    process.exit(0);
  }

  await ref.update(updates);
  console.log('\n✓ Firestore updated successfully.');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
