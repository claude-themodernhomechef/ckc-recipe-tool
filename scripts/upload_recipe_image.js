/**
 * upload_recipe_image.js
 *
 * Uploads a local image file to Firebase Storage and updates the recipe's
 * `image` field in Firestore.
 *
 * Usage:
 *   node scripts/upload_recipe_image.js --url "<recipe-source-url>" --image "<path/to/image.jpg>"
 *
 * Example:
 *   node scripts/upload_recipe_image.js \
 *     --url "https://somethingnutritiousblog.com/fennel-apple-salad/" \
 *     --image "/Users/rafi/Downloads/fennel-apple-salad.jpg"
 */

'use strict';

const fs    = require('fs');
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

function mimeFromExt(ext) {
  if (ext === '.png')  return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--url'   && argv[i + 1]) { args.url   = argv[++i]; }
    if (argv[i] === '--image' && argv[i + 1]) { args.image = argv[++i]; }
  }
  return args;
}

// ── Main ───────────────────────────────────────────────────────────────────
(async () => {
  const args = parseArgs(process.argv);

  if (!args.url || !args.image) {
    console.error('Usage: node upload_recipe_image.js --url "<recipe-url>" --image "<local-file-path>"');
    process.exit(1);
  }

  // Validate local file
  if (!fs.existsSync(args.image)) {
    console.error(`Image file not found: ${args.image}`);
    process.exit(1);
  }

  const slug     = slugifyUrl(args.url);
  const ext      = path.extname(args.image).toLowerCase() || '.jpg';
  const destPath = `images/${slug}${ext}`;
  const publicUrl = `https://storage.googleapis.com/ckc-recipe-swipe.firebasestorage.app/${destPath}`;

  console.log(`\nRecipe slug : ${slug}`);
  console.log(`Local file  : ${args.image}`);
  console.log(`Storage path: ${destPath}`);

  // Check recipe exists in Firestore
  const docRef = db.collection('recipes').doc(slug);
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    console.error(`\nNo Firestore recipe found with doc ID: ${slug}`);
    console.error('Double-check the URL — it must match the exact source URL used when the recipe was added.');
    process.exit(1);
  }
  console.log(`Firestore   : found "${docSnap.data().name}"`);

  // Upload to Firebase Storage
  const buffer = fs.readFileSync(args.image);
  console.log(`Uploading   : ${(buffer.length / 1024).toFixed(1)} KB...`);

  const file = bucket.file(destPath);
  await file.save(buffer, {
    metadata: { contentType: mimeFromExt(ext) },
    public: true,
  });
  console.log(`Uploaded    : ${publicUrl}`);

  // Update Firestore
  await docRef.update({ image: publicUrl });
  console.log(`Firestore   : image field updated\n`);
  console.log(`Done! Recipe "${docSnap.data().name}" now has a photo.`);
  process.exit(0);
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
