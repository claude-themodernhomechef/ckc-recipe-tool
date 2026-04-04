/**
 * append_needs_review.js
 * ───────────────────────
 * Appends an uncertain diet tag review item to the recipe doc in Firestore.
 * Used by the enrichment agent when a diet tag cannot be confirmed.
 *
 * Usage:
 *   node scripts/append_needs_review.js '<json>'
 *
 * JSON fields:
 *   docId      — Firestore recipe doc ID (required)
 *   recipe     — recipe name (for logging)
 *   protocol   — diet protocol (GF, DF, etc.)
 *   ingredient — the uncertain ingredient
 *   reason     — why it's uncertain
 *   caution    — pipe-separated caution product names (or empty string)
 *   url        — recipe URL (for reference)
 *   category   — "grey_area" | "no_product_found" | "needs_clarification"
 *
 * The review item is appended to `reviewItems` array on the recipe doc.
 * processingStatus is NOT set here — update_recipe_enrichment.js handles that.
 *
 * Exit codes:
 *   0 — success
 *   1 — error
 */

const admin = require('./functions/node_modules/firebase-admin');
const path  = require('path');

const SA_KEY = path.join(__dirname, 'service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(SA_KEY) });
}
const db = admin.firestore();

async function main() {
  const jsonStr = process.argv[2];
  if (!jsonStr) {
    console.error('Usage: node append_needs_review.js <json>');
    process.exit(1);
  }

  let item;
  try {
    item = JSON.parse(jsonStr);
  } catch (e) {
    console.error('Invalid JSON:', e.message);
    process.exit(1);
  }

  if (!item.docId) {
    console.error('Missing required field: docId');
    process.exit(1);
  }

  const reviewItem = {
    protocol:   item.protocol   || '',
    ingredient: item.ingredient || '',
    reason:     item.reason     || '',
    category:   item.category   || 'needs_clarification',
    caution:    item.caution    || '',
    resolved:   false,
    addedAt:    new Date().toISOString(),
  };

  try {
    const ref = db.collection('recipes').doc(item.docId);
    await ref.update({
      reviewItems: admin.firestore.FieldValue.arrayUnion(reviewItem),
    });
    console.log(`OK — added review item for ${item.recipe || item.docId} / ${item.protocol}`);
    process.exit(0);
  } catch (e) {
    console.error(`ERROR — ${item.docId}: ${e.message}`);
    process.exit(1);
  }
}

main();
