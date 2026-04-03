/**
 * upload_ak_side_dish_images.js
 *
 * Downloads the 10 Ambitious Kitchen side dish recipe images and uploads
 * them to Firebase Storage under the same path convention as other recipe images.
 *
 * Usage:
 *   node upload_ak_side_dish_images.js
 *
 * Requirements:
 *   npm install node-fetch firebase-admin   (if not already installed)
 *   service-account.json must be present in this directory
 */

const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const admin = require('firebase-admin');
const path  = require('path');
const fs    = require('fs');

// ── Firebase init ──────────────────────────────────────────────────────────
const serviceAccount = require('./service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'ckc-recipe-swipe.firebasestorage.app',
});
const bucket = admin.storage().bucket();

// ── Image map: recipe slug → source URL ───────────────────────────────────
const AK_IMAGES = {
  'best-healthy-coleslaw-ever-no-mayo':
    'https://www.ambitiouskitchen.com/wp-content/uploads/2022/07/coleslaw2-5long.jpg',
  'au-gratin-potatoes':
    'https://www.ambitiouskitchen.com/wp-content/uploads/2021/03/Gratin-FB.png',
  '30-minute-grilled-veggie-orzo':
    'https://www.ambitiouskitchen.com/wp-content/uploads/2021/08/Brown-Butter-Goat-Cheese-Veggie-Orzo-with-Basil-7long.jpg',
  'lightened-up-cheddar-cauliflower-broccoli-soup':
    'https://www.ambitiouskitchen.com/wp-content/uploads/2021/01/Soup-Fb.png',
  'italian-chopped-brussels-sprouts-salad':
    'https://www.ambitiouskitchen.com/wp-content/uploads/2021/01/Italian-Chopped-Brussels-Salad-4long.jpg',
  'curry-cashew-chickpea-quinoa-salad':
    'https://www.ambitiouskitchen.com/wp-content/uploads/2020/06/Salad-FB.png',
  'thai-broccoli-salad':
    'https://www.ambitiouskitchen.com/wp-content/uploads/2024/02/Salad-FB.png',
  'curry-roasted-cauliflower-sweet-potato-salad':
    'https://www.ambitiouskitchen.com/wp-content/uploads/2019/01/Curry-Roasted-Sweet-Potato-Cauliflower-Salad-1long.jpg',
  'lightened-sweet-potato-casserole-pecan-oat-streusel':
    'https://www.ambitiouskitchen.com/wp-content/uploads/2021/11/sweetpotatocasserolelong.jpg',
  'sweet-potato-kale-salad':
    'https://www.ambitiouskitchen.com/wp-content/uploads/2021/01/California-Roasted-Sweet-Potato-Kale-Salad-5long.jpg',
};

// ── Helpers ────────────────────────────────────────────────────────────────
function getExt(url) {
  const base = url.split('?')[0];
  return path.extname(base).toLowerCase() || '.jpg';
}

function mimeFromExt(ext) {
  return ext === '.png' ? 'image/png' : 'image/jpeg';
}

async function downloadAndUpload(slug, srcUrl) {
  const ext        = getExt(srcUrl);
  const destPath   = `images/${slug}${ext}`;
  const publicUrl  = `https://storage.googleapis.com/ckc-recipe-swipe.firebasestorage.app/${destPath}`;

  console.log(`\n[${slug}]`);
  console.log(`  Source : ${srcUrl}`);

  // Download
  const resp = await fetch(srcUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; recipe-tool/1.0)' }
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} from ${srcUrl}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  console.log(`  Downloaded: ${(buffer.length / 1024).toFixed(1)} KB`);

  // Upload to Firebase Storage
  const file = bucket.file(destPath);
  await file.save(buffer, {
    metadata: { contentType: mimeFromExt(ext) },
    public: true,
  });

  console.log(`  Uploaded : ${destPath}`);
  console.log(`  URL      : ${publicUrl}`);
  return { slug, publicUrl };
}

// ── Main ───────────────────────────────────────────────────────────────────
(async () => {
  console.log(`Uploading ${Object.keys(AK_IMAGES).length} Ambitious Kitchen side dish images...\n`);
  const results = [];
  const errors  = [];

  for (const [slug, srcUrl] of Object.entries(AK_IMAGES)) {
    try {
      const r = await downloadAndUpload(slug, srcUrl);
      results.push(r);
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      errors.push({ slug, error: err.message });
    }
  }

  console.log(`\n─────────────────────────────────────────`);
  console.log(`Done: ${results.length} uploaded, ${errors.length} failed`);

  // Write results to a JSON file for reference
  const out = {
    uploaded: results,
    errors,
    firebaseStorageBase: 'https://storage.googleapis.com/ckc-recipe-swipe.firebasestorage.app/images/',
  };
  fs.writeFileSync('ak_upload_results.json', JSON.stringify(out, null, 2));
  console.log(`Results saved to ak_upload_results.json`);
})();
