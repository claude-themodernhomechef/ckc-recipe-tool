/**
 * bootstrap_ingredient_aliases.js
 *
 * One-shot. Mines every existing `ingredientNameOverrides` map from every
 * recipe and seeds the global `ingredientAliases` Firestore collection.
 *
 * This means all the per-recipe text-box corrections Rafi has already made
 * become global teaching for the matcher — no need to re-edit them.
 *
 * Usage:  node scripts/bootstrap_ingredient_aliases.js
 *         node scripts/bootstrap_ingredient_aliases.js --dry   (preview only)
 */

const admin = require('firebase-admin');
const path  = require('path');

const sa = require(path.join(__dirname, '../service-account.json'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const DRY = process.argv.includes('--dry');

function slugify(s) {
  return String(s).toLowerCase()
    .replace(/\//g, '-')
    .replace(/[^a-z0-9\-_ ']/g, '')
    .trim()
    .slice(0, 200);
}

async function main() {
  console.log(DRY ? 'DRY RUN — no writes' : 'Live run — will write to ingredientAliases');
  console.log('Fetching recipes...');

  const snap = await db.collection('recipes')
    .where('status', 'in', ['approved', 'needs_review'])
    .get();

  // Aggregate: rawKey → { canonicalName, frequency, exampleRecipeIds }
  const aggregated = new Map();
  let recipesWithOverrides = 0;
  let totalOverrides = 0;

  snap.forEach(doc => {
    const d = doc.data();
    const overrides = d.ingredientNameOverrides;
    if (!overrides || typeof overrides !== 'object') return;

    let recipeHadOne = false;
    for (const [raw, override] of Object.entries(overrides)) {
      if (!override || !override.name) continue; // qty-only overrides skipped
      const rawKey = String(raw).toLowerCase().trim();
      const canonicalName = String(override.name).toLowerCase().trim();
      if (!rawKey || !canonicalName) continue;
      if (rawKey === canonicalName) continue; // no-op rename
      recipeHadOne = true;
      totalOverrides++;

      const docId = slugify(rawKey);
      if (!docId) continue;

      let entry = aggregated.get(docId);
      if (!entry) {
        entry = {
          docId,
          rawKey,
          rawString: raw,
          canonicalName,
          canonicalDisplay: override.name,
          frequency: 0,
          exampleRecipeIds: [],
          conflicts: new Set(),
        };
        aggregated.set(docId, entry);
      } else if (entry.canonicalName !== canonicalName) {
        // Two different recipes mapped the same raw to different canonicals.
        // Track conflicts so we can review them.
        entry.conflicts.add(canonicalName);
      }
      entry.frequency++;
      if (entry.exampleRecipeIds.length < 5) entry.exampleRecipeIds.push(doc.id);
    }
    if (recipeHadOne) recipesWithOverrides++;
  });

  console.log(`\nScanned ${snap.size} recipes`);
  console.log(`  ${recipesWithOverrides} have name overrides`);
  console.log(`  ${totalOverrides} total override entries`);
  console.log(`  ${aggregated.size} unique raw → canonical mappings`);

  const conflicts = [...aggregated.values()].filter(e => e.conflicts.size > 0);
  if (conflicts.length > 0) {
    console.log(`\n⚠  ${conflicts.length} raw strings have CONFLICTING canonical names across recipes:`);
    conflicts.slice(0, 20).forEach(c => {
      console.log(`   "${c.rawKey}"  →  "${c.canonicalName}" vs ${[...c.conflicts].map(x => `"${x}"`).join(', ')}`);
    });
    console.log('   (Most-common canonical wins on write. Review these manually if needed.)');
  }

  // Top mappings preview
  const top = [...aggregated.values()].sort((a, b) => b.frequency - a.frequency).slice(0, 20);
  console.log('\nTOP 20 RAW → CANONICAL (by frequency):');
  top.forEach((e, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${e.rawKey.slice(0, 50).padEnd(50)}  →  ${e.canonicalName}  (×${e.frequency})`);
  });

  if (DRY) {
    console.log('\nDRY RUN — exiting without writing.');
    return;
  }

  console.log('\nWriting to Firestore (batched)...');
  let batch = db.batch();
  let inBatch = 0;
  let written = 0;

  for (const entry of aggregated.values()) {
    const ref = db.collection('ingredientAliases').doc(entry.docId);
    batch.set(ref, {
      rawKey: entry.rawKey,
      rawString: entry.rawString,
      canonicalName: entry.canonicalName,
      canonicalDisplay: entry.canonicalDisplay,
      frequency: entry.frequency,
      exampleRecipeIds: entry.exampleRecipeIds,
      bootstrappedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(entry.conflicts.size > 0 ? { conflicts: [...entry.conflicts] } : {}),
    }, { merge: true });
    inBatch++;
    if (inBatch >= 400) {
      await batch.commit();
      written += inBatch;
      process.stdout.write(`\r  ${written}/${aggregated.size}`);
      batch = db.batch();
      inBatch = 0;
    }
  }
  if (inBatch > 0) {
    await batch.commit();
    written += inBatch;
  }

  console.log(`\r  ${written}/${aggregated.size} written ✓`);
  console.log('\nDone. The matcher can now consult ingredientAliases on its next run.');
}

main().catch(err => { console.error(err); process.exit(1); });
