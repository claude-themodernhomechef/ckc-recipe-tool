/**
 * upload_missing_ingredients.js
 * ──────────────────────────────
 * Reads data-exports/missing_ingredients_final.csv and writes
 * ingredients + prep_time to each Firestore recipe doc.
 *
 * Only updates rows that have real ingredient data (skips NOT_FOUND/FETCH_ERROR/empty).
 *
 * Usage:
 *   node scripts/upload_missing_ingredients.js
 */

const admin = require('firebase-admin');
const path  = require('path');
const fs    = require('fs');
const csv   = require('csv-parse/sync');

const SA_KEY  = path.join(__dirname, '..', 'service-account.json');
const CSV_PATH = path.join(__dirname, '..', 'data-exports', 'missing_ingredients_final.csv');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(SA_KEY) });
}
const db = admin.firestore();

async function main() {
  const raw  = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = csv.parse(raw, { columns: true, skip_empty_lines: true });

  const BAD = new Set(['NOT_FOUND', 'FETCH_ERROR', '']);

  let updated = 0, skipped = 0, errors = 0;

  for (const row of rows) {
    const docId      = row['Firestore ID']?.trim();
    const name       = row['Recipe Name']?.trim();
    const ingr       = row['ingredients']?.trim();
    const timeStr    = row['time']?.trim();

    if (!docId || BAD.has(ingr)) {
      skipped++;
      continue;
    }

    // Split pipe-separated ingredients into an array
    const ingredientsArray = ingr.split(' | ').map(s => s.trim()).filter(Boolean);

    const update = {
      ingredients: ingredientsArray,
      enrichedAt: new Date().toISOString(),
    };

    if (timeStr) {
      update.prep_time = timeStr;
    }

    try {
      await db.collection('recipes').doc(docId).update(update);
      console.log(`✓ ${docId} — ${name}`);
      updated++;
    } catch (e) {
      console.error(`✗ ${docId} — ${e.message}`);
      errors++;
    }
  }

  console.log(`\nDone: ${updated} updated, ${skipped} skipped, ${errors} errors`);
}

main().catch(e => { console.error(e); process.exit(1); });
