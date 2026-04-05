/**
 * get_recipe_for_enrichment.js
 * ─────────────────────────────
 * Fetches a single recipe from Firestore and outputs its data
 * as formatted text for the enrichment agent prompt.
 *
 * Usage:
 *   node scripts/get_recipe_for_enrichment.js <doc_id>
 */

const admin = require('firebase-admin');
const path  = require('path');

const SA_KEY = path.join(__dirname, '..', 'service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(SA_KEY) });
}
const db = admin.firestore();

async function main() {
  const docId = process.argv[2];
  if (!docId) {
    console.error('Usage: node get_recipe_for_enrichment.js <doc_id>');
    process.exit(1);
  }

  const doc = await db.collection('recipes').doc(docId).get();
  if (!doc.exists) {
    console.error(`Recipe ${docId} not found`);
    process.exit(1);
  }

  const d = doc.data();
  const hasDietTags = d.dietTags && Object.keys(d.dietTags).length > 0;

  const lines = [
    `DOC_ID: ${docId}`,
    `NAME: ${d.name || ''}`,
    `URL: ${d.url || ''}`,
    `CUISINE: ${d.cuisine || ''}`,
    `COURSE: ${d.course || d.meal_type || ''}`,
    `PROTEIN: ${d.protein_type || d.protein || ''}`,
    '',
    'INGREDIENTS:',
  ];

  const ingredients = d.ingredients || [];
  if (ingredients.length > 0) {
    ingredients.forEach(i => lines.push(`  - ${i}`));
  } else {
    lines.push('  (none — scrape from URL above)');
  }

  lines.push('');
  if (hasDietTags) {
    lines.push('DIET_TAGS: already present — skip diet tag generation');
    lines.push(JSON.stringify(d.dietTags, null, 2));
  } else {
    lines.push('DIET_TAGS: missing — generate all 8 protocols');
  }

  console.log(lines.join('\n'));
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
