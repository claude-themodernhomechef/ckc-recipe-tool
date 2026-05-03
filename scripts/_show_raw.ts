import * as admin from 'firebase-admin';
import * as path from 'path';
const sa = require(path.join(__dirname, '../service-account.json'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
(async () => {
  const id = process.argv[2];
  const doc = await db.collection('recipes').doc(id).get();
  const r = doc.data()!;
  console.log(`📋 ${r.name}  (servings: ${r.servings})`);
  for (const i of r.ingredients) console.log(`  • ${JSON.stringify(i)}`);
  process.exit(0);
})();
