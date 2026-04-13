// upload_ingredient_categories.js
// Reads ingredients_master.csv and uploads each row as a document
// to the Firestore collection: ingredientCategories
// Document ID = ingredient_name (slugified)
// Run: node scripts/upload_ingredient_categories.js

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ── Firebase init ──────────────────────────────────────────────────────────
const serviceAccount = require('../service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Read CSV ───────────────────────────────────────────────────────────────
function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].match(/(".*?"|[^,]+)/g).map(h => h.replace(/^"|"$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Parse quoted CSV values
    const vals = [];
    let inQuote = false, cur = '';
    for (let c = 0; c < line.length; c++) {
      if (line[c] === '"') {
        if (inQuote && line[c+1] === '"') { cur += '"'; c++; }
        else inQuote = !inQuote;
      } else if (line[c] === ',' && !inQuote) {
        vals.push(cur); cur = '';
      } else {
        cur += line[c];
      }
    }
    vals.push(cur);
    if (vals.length >= 2) {
      const obj = {};
      headers.forEach((h, idx) => obj[h] = vals[idx] || '');
      rows.push(obj);
    }
  }
  return rows;
}

// ── Slugify document ID ────────────────────────────────────────────────────
// Firestore doc IDs can't contain '/' — replace with '-'
function toDocId(name) {
  return name.trim().toLowerCase().replace(/\//g, '-').replace(/[^a-z0-9\-_ ']/g, '').replace(/\s+/g, ' ').trim();
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const csvPath = path.join(__dirname, '..', 'ingredients_master.csv');
  const content = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCSV(content);
  console.log(`Parsed ${rows.length} rows from ingredients_master.csv`);

  const collectionRef = db.collection('ingredientCategories');

  // Upload in batches of 400 (Firestore limit is 500 per batch)
  const BATCH_SIZE = 400;
  let uploaded = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = rows.slice(i, i + BATCH_SIZE);

    for (const row of chunk) {
      const name = row['ingredient_name'];
      const category = row['category'];
      const frequency = parseInt(row['frequency']) || 0;
      const exampleRaw = row['example_raw'] || '';

      if (!name || !category) continue;

      const docId = toDocId(name);
      const docRef = collectionRef.doc(docId);
      batch.set(docRef, {
        name,
        category,
        frequency,
        exampleRaw,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    try {
      await batch.commit();
      uploaded += chunk.length;
      console.log(`Uploaded ${uploaded}/${rows.length}...`);
    } catch (e) {
      errors++;
      console.error(`Batch error at row ${i}:`, e.message);
    }
  }

  console.log(`\nDone! ${uploaded} documents written to ingredientCategories (${errors} batch errors)`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
