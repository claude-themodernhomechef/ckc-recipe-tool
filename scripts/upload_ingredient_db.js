/**
 * upload_ingredient_db.js
 *
 * One-time script: uploads ingredientNutrition_v2.json to Firestore
 * as an `ingredients` collection so the admin panel can do live
 * swap-nutrition lookups without bundling the DB in the app.
 *
 * Document ID = ingredient name (lowercase, spaces preserved).
 * Each doc contains: label, per100g, measures.
 *
 * Safe to re-run — uses batch sets (upsert).
 *
 * Usage: node scripts/upload_ingredient_db.js
 */

const admin = require('firebase-admin');
const fs    = require('fs');
const path  = require('path');

const SA_PATH = path.join(__dirname, '../service-account.json');
const DB_FILE = path.join(__dirname, '../data/ingredientNutrition_v2.json');

const sa = require(SA_PATH);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function main() {
  const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  const entries = Object.entries(raw); // [name, data]

  console.log(`Uploading ${entries.length} ingredients to Firestore...`);

  const BATCH_SIZE = 400;
  let written = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const chunk = entries.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const [name, data] of chunk) {
      const docId = name.toLowerCase().trim();
      const ref   = db.collection('ingredients').doc(docId);

      // Store only what the admin panel needs for swap lookups
      batch.set(ref, {
        label:    data.label    || name,
        category: data.category || '',
        per100g:  data.per100g  || {},
        measures: data.measures || [],
      });
    }

    await batch.commit();
    written += chunk.length;
    const pct = Math.round(written / entries.length * 100);
    console.log(`[${String(written).padStart(4)}/${entries.length}] ${pct}%`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('INGREDIENT DB UPLOAD COMPLETE');
  console.log(`  Written: ${written}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
