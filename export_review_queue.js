/**
 * export_review_queue.js
 * ───────────────────────
 * Exports all unreviewed items from the Firestore `review_queue` collection
 * to needs_review.csv so Rafi can fill in Final Decision.
 *
 * Only exports items where finalDecision is empty (not yet reviewed).
 * Appends to existing needs_review.csv so old decisions are preserved.
 *
 * Usage:
 *   node export_review_queue.js
 *   node export_review_queue.js --overwrite   (replace existing CSV)
 */

const admin   = require('firebase-admin');
const fs      = require('fs');
const path    = require('path');
const { createObjectCsvWriter } = require('csv-writer');

const BASE        = __dirname;
const SA_KEY      = path.join(BASE, 'service-account.json');
const REVIEW_CSV  = path.join(BASE, 'needs_review.csv');
const OVERWRITE   = process.argv.includes('--overwrite');

// Init Firebase
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(SA_KEY) });
}
const db = admin.firestore();

async function main() {
  console.log('Fetching unreviewed items from review_queue…');

  const snap = await db.collection('review_queue')
    .where('finalDecision', '==', '')
    .orderBy('createdAt', 'asc')
    .get();

  if (snap.empty) {
    console.log('Nothing to export — review_queue is empty or all reviewed.');
    process.exit(0);
  }

  const rows = snap.docs.map(doc => {
    const d = doc.data();
    return {
      Category:              d.category || '',
      Recipe:                d.recipe   || '',
      Protocol:              d.protocol || '',
      'Ingredient Searched': d.ingredient || '',
      'Final Decision':      '',
      Reason:                d.reason   || '',
      'Caution Products Found': d.caution || '',
      URL:                   d.url      || '',
    };
  });

  // Check which recipe+protocol combos are already in the CSV
  const existing = new Set();
  if (!OVERWRITE && fs.existsSync(REVIEW_CSV)) {
    const content = fs.readFileSync(REVIEW_CSV, 'utf8').split('\n').slice(1);
    for (const line of content) {
      const cols = line.split(',');
      if (cols.length >= 3) existing.add(`${cols[1].trim()}||${cols[2].trim()}`);
    }
  }

  const newRows = rows.filter(r => !existing.has(`${r.Recipe}||${r.Protocol}`));

  if (newRows.length === 0) {
    console.log(`All ${rows.length} items already in needs_review.csv.`);
    process.exit(0);
  }

  const csvWriter = createObjectCsvWriter({
    path:   REVIEW_CSV,
    header: [
      { id: 'Category',               title: 'Category' },
      { id: 'Recipe',                  title: 'Recipe' },
      { id: 'Protocol',               title: 'Protocol' },
      { id: 'Ingredient Searched',    title: 'Ingredient Searched' },
      { id: 'Final Decision',         title: 'Final Decision' },
      { id: 'Reason',                 title: 'Reason' },
      { id: 'Caution Products Found', title: 'Caution Products Found' },
      { id: 'URL',                    title: 'URL' },
    ],
    append: !OVERWRITE && fs.existsSync(REVIEW_CSV),
  });

  await csvWriter.writeRecords(newRows);

  console.log(`Exported ${newRows.length} new item(s) to needs_review.csv`);
  console.log(`(${rows.length - newRows.length} already present, skipped)`);
  console.log(`\nNext steps:`);
  console.log(`  1. Open needs_review.csv in Numbers or Excel`);
  console.log(`  2. Fill in the "Final Decision" column`);
  console.log(`  3. Run: python3 apply_new_review.py`);

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
