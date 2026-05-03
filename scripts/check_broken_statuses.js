/**
 * check_broken_statuses.js
 *
 * Reads broken_urls.json and looks up each recipe's status in Firestore,
 * so you can see how many are "yes" decisions vs pending/other before deleting.
 *
 * Usage:
 *   node scripts/check_broken_statuses.js
 */

'use strict';

const path  = require('path');
const fs    = require('fs');
const admin = require('firebase-admin');

const SA_KEY       = path.join(__dirname, '..', 'service-account.json');
const RESULTS_FILE = path.join(__dirname, '..', 'broken_urls.json');

admin.initializeApp({ credential: admin.credential.cert(SA_KEY) });
const db = admin.firestore();

(async () => {
  if (!fs.existsSync(RESULTS_FILE)) {
    console.error('broken_urls.json not found. Run audit_broken_urls.js first.');
    process.exit(1);
  }

  const { broken } = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8'));
  console.log(`Checking status of ${broken.length} broken recipes...\n`);

  const counts = {};
  const byStatus = {};

  for (const recipe of broken) {
    const doc = await db.collection('recipes').doc(recipe.id).get();
    const status = doc.exists ? (doc.data().status || 'unknown') : 'not_found';

    counts[status] = (counts[status] || 0) + 1;
    if (!byStatus[status]) byStatus[status] = [];
    byStatus[status].push(recipe.name);
  }

  console.log('── Breakdown by status ──────────────────');
  for (const [status, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${status.padEnd(15)} ${count}`);
  }

  if (byStatus['yes']) {
    console.log(`\n── YES recipes that are broken (${byStatus['yes'].length}) ──`);
    byStatus['yes'].forEach(name => console.log(`  - ${name}`));
  }

  process.exit(0);
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
