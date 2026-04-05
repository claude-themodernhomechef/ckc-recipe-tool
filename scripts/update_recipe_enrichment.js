/**
 * update_recipe_enrichment.js
 * ────────────────────────────
 * Helper script for the enrichment agent.
 * Writes chefNotes, menuDescription, and/or dietTags to a Firestore recipe doc.
 *
 * Usage:
 *   node scripts/update_recipe_enrichment.js '<doc_id>' '<json>'
 *
 * JSON fields (all optional — only provided fields are written):
 *   chefNotes        — string
 *   menuDescription  — string
 *   dietTags         — object with protocol keys (GF, DF, V, Vg, K, AIP, LF, LH)
 *
 * Exit codes:
 *   0 — success
 *   1 — error (printed to stderr)
 */

const admin = require('firebase-admin');
const path  = require('path');
const fs    = require('fs');

const SA_KEY = path.join(__dirname, '..', 'service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(SA_KEY) });
}
const db = admin.firestore();

async function main() {
  const [,, docId, jsonStr] = process.argv;

  if (!docId || !jsonStr) {
    console.error('Usage: node update_recipe_enrichment.js <doc_id> <json>');
    process.exit(1);
  }

  let fields;
  try {
    fields = JSON.parse(jsonStr);
  } catch (e) {
    console.error('Invalid JSON:', e.message);
    process.exit(1);
  }

  const allowed = ['chefNotes', 'dietTags', 'prep_time'];
  const update  = {};

  for (const key of allowed) {
    if (fields[key] !== undefined) update[key] = fields[key];
  }

  if (Object.keys(update).length === 0) {
    console.error('No valid fields provided. Allowed:', allowed.join(', '));
    process.exit(1);
  }

  // Set processingStatus based on whether any dietTags are uncertain/unresolved
  let hasPendingTags = false;
  if (update.dietTags) {
    hasPendingTags = Object.values(update.dietTags).some(t => t && t.uncertain === true);
  }
  update.processingStatus = hasPendingTags ? 'pending_review' : 'complete';
  update.enrichedAt = new Date().toISOString();

  try {
    await db.collection('recipes').doc(docId).update(update);
    const written = Object.keys(update).filter(k => k !== 'processingStatus' && k !== 'enrichedAt');
    console.log(`OK — ${docId} updated (${written.join(', ')})`);
    process.exit(0);
  } catch (e) {
    console.error(`ERROR — ${docId}: ${e.message}`);
    process.exit(1);
  }
}

main();
