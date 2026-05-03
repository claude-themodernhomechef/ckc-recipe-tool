const admin = require('firebase-admin');
const path  = require('path');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require(path.join(__dirname, '../service-account.json'))) });
const db = admin.firestore();

(async () => {
  const doc = await db.collection('recipes').doc('1RsQWRKk2fh71b6UwvlQ').get();
  const n = doc.data().nutrition || {};
  console.log('--- nutrition top-level keys ---');
  console.log(Object.keys(n).join(', '));
  console.log('\n--- ingredients (first 3) ---');
  (n.ingredients || []).slice(0, 3).forEach(i => console.log(JSON.stringify(i)));
  console.log('\n--- perServing ---');
  console.log(JSON.stringify(n.perServing));
  process.exit(0);
})();
