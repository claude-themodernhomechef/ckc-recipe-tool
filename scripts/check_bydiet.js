const admin = require('firebase-admin');
const path  = require('path');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require(path.join(__dirname, '../service-account.json'))) });
const db = admin.firestore();

(async () => {
  const doc = await db.collection('recipes').doc('1RsQWRKk2fh71b6UwvlQ').get();
  const data = doc.data();
  const nutrition = data.nutrition || {};
  console.log('status:', data.status);
  console.log('byDiet keys:', Object.keys(nutrition.byDiet || {}));
  console.log('perServing keys:', Object.keys(nutrition.perServing || {}));
  console.log('byDiet sample:', JSON.stringify(nutrition.byDiet?.DF ?? null, null, 2));
  process.exit(0);
})();
