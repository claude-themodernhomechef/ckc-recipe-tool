const admin = require('firebase-admin');
const path  = require('path');
const SA_KEY = path.join(__dirname, '..', 'service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(SA_KEY) });
const db = admin.firestore();

(async () => {
  const doc = await db.collection('recipes').doc('1RsQWRKk2fh71b6UwvlQ').get();
  const data = doc.data();
  console.log('--- TOP-LEVEL FIELDS ---');
  console.log(Object.keys(data).sort().join('\n'));
  console.log('\n--- dietTags ---');
  console.log(JSON.stringify(data.dietTags, null, 2));
  // Also dump anything diet-shaped
  for (const k of Object.keys(data)) {
    if (k.toLowerCase().includes('diet') || k.toLowerCase().includes('swap') || k.toLowerCase().includes('mod')) {
      console.log(`\n--- ${k} ---`);
      console.log(JSON.stringify(data[k], null, 2));
    }
  }
  process.exit(0);
})();
