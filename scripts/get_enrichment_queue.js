/**
 * get_enrichment_queue.js
 * ────────────────────────
 * Returns all YES recipe doc IDs that need enrichment (missing chefNotes).
 * Outputs one doc ID per line — used by run_enrichment.sh to loop.
 *
 * Usage:
 *   node scripts/get_enrichment_queue.js
 */

const admin = require('firebase-admin');
const path  = require('path');

const SA_KEY = path.join(__dirname, '..', 'service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(SA_KEY) });
}
const db = admin.firestore();

const ALL_PROTOCOLS = ['GF', 'DF', 'K', 'LF', 'V', 'Vg', 'AIP', 'LH'];

async function main() {
  const snap = await db.collection('recipes')
    .where('status', '==', 'yes')
    .get();

  const ids = snap.docs
    .filter(doc => {
      const d = doc.data();
      const missingChefNotes   = !d.chefNotes || !d.chefNotes.trim();
      const missingIngredients = !d.ingredients || d.ingredients.length === 0;
      const existingProtocols  = d.dietTags ? Object.keys(d.dietTags) : [];
      const incompleteDietTags = !ALL_PROTOCOLS.every(p => existingProtocols.includes(p));
      return missingChefNotes || missingIngredients || incompleteDietTags;
    })
    .map(doc => doc.id);

  // One ID per line — easy to loop over in shell
  ids.forEach(id => console.log(id));
  process.stderr.write(`${ids.length} recipes in queue\n`);
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
