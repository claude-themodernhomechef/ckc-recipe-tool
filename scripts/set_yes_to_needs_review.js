/**
 * set_yes_to_needs_review.js
 * ──────────────────────────
 * Finds all Firestore recipe docs with status == 'yes' and updates them to
 * status: 'needs_review' so they appear in the Review Queue admin tool.
 *
 * Usage:
 *   node scripts/set_yes_to_needs_review.js
 *   node scripts/set_yes_to_needs_review.js --dry-run
 */

const admin = require('firebase-admin');
const path  = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const SA_KEY  = path.join(__dirname, '..', 'service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(SA_KEY) });
}
const db = admin.firestore();

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}\n`);

  const snap = await db.collection('recipes').where('status', '==', 'yes').get();

  if (snap.empty) {
    console.log('No recipes with status == "yes" found.');
    process.exit(0);
  }

  console.log(`Found ${snap.size} recipes with status "yes". Updating to "needs_review"...\n`);

  let updated = 0;
  const BATCH_SIZE = 400;
  const docs = snap.docs;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + BATCH_SIZE);

    for (const doc of chunk) {
      const name = doc.data().name || doc.id;
      console.log(`  ${updated + 1}. ${name}`);
      if (!DRY_RUN) {
        batch.update(doc.ref, { status: 'needs_review' });
      }
      updated++;
    }

    if (!DRY_RUN) {
      await batch.commit();
      console.log(`  ✓ Batch committed (${chunk.length} docs)\n`);
    }
  }

  console.log(`\n${DRY_RUN ? '[DRY RUN] Would have updated' : 'Done. Updated'} ${updated} recipes to needs_review.`);
  process.exit(0);
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
