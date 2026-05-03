/**
 * delete_recipe.js
 *
 * Permanently removes a recipe from Firestore by its source URL.
 * Also deletes the corresponding image from Firebase Storage if one exists.
 *
 * Usage:
 *   node scripts/delete_recipe.js "<recipe-source-url>"
 *
 * Example:
 *   node scripts/delete_recipe.js "https://minimalistbaker.com/1-pot-spiced-red-lentil-tomato-coconut-soup/"
 */

'use strict';

const path  = require('path');
const admin = require('firebase-admin');

// ── Firebase init ──────────────────────────────────────────────────────────
const SA_KEY = path.join(__dirname, '..', 'service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(SA_KEY),
  storageBucket: 'ckc-recipe-swipe.firebasestorage.app',
});

const db     = admin.firestore();
const bucket = admin.storage().bucket();

// ── Helpers ────────────────────────────────────────────────────────────────
function slugifyUrl(url) {
  try {
    const pathname = new URL(url).pathname.replace(/\/$/, '');
    return pathname.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').toLowerCase().slice(0, 100).replace(/^-|-$/g, '');
  } catch {
    return url.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').toLowerCase().slice(0, 100);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
(async () => {
  const recipeUrl = process.argv[2];

  if (!recipeUrl) {
    console.error('Usage: node delete_recipe.js "<recipe-source-url>"');
    process.exit(1);
  }

  const slug   = slugifyUrl(recipeUrl);
  const docRef = db.collection('recipes').doc(slug);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    console.error(`No recipe found with doc ID: ${slug}`);
    console.error('Double-check the URL — it must match the exact source URL used when the recipe was added.');
    process.exit(1);
  }

  const data = docSnap.data();
  console.log(`\nFound: "${data.name}" (${slug})`);

  // Try to delete image from Storage if it exists
  if (data.image) {
    try {
      // Extract storage path from the public URL
      const match = data.image.match(/\/o\/(.+?)(\?|$)/);
      const storagePath = match
        ? decodeURIComponent(match[1])
        : `images/${slug}.jpg`;

      await bucket.file(storagePath).delete();
      console.log(`Storage     : deleted ${storagePath}`);
    } catch (e) {
      // Non-fatal — image may have already been deleted or path may differ
      console.log(`Storage     : no image to delete (${e.message})`);
    }
  }

  // Delete Firestore document
  await docRef.delete();
  console.log(`Firestore   : deleted "${data.name}"\n`);
  console.log('Done.');
  process.exit(0);
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
