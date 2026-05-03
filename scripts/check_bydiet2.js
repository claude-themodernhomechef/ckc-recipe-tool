const admin = require('firebase-admin');
const path  = require('path');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require(path.join(__dirname, '../service-account.json'))) });
const db = admin.firestore();

(async () => {
  const snap = await db.collection('recipes').where('status','==','yes').limit(5).get();
  for (const doc of snap.docs) {
    const n = doc.data().nutrition || {};
    console.log(doc.id.slice(0,35).padEnd(36), '→ byDiet:', Object.keys(n.byDiet || {}).join(', ') || 'EMPTY');
  }
  process.exit(0);
})();
