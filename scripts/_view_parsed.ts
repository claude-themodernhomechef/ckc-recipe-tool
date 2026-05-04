import * as admin from 'firebase-admin';
import * as path from 'path';
const sa = require(path.join(__dirname, '../service-account.json'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

(async () => {
  const id = process.argv[2];
  if (!id) { console.error('Usage: _view_parsed <id>'); process.exit(1); }
  const doc = await db.collection('recipes').doc(id).get();
  if (!doc.exists) { console.error('Not found'); process.exit(1); }
  const r = doc.data()!;
  console.log(`\n📋 ${r.name}\n   id: ${id}   servings: ${r.servings}\n`);
  console.log('parsedIngredients:');
  (r.parsedIngredients || []).forEach((p: any, i: number) => {
    const skip = p.skip ? ` [SKIP: ${p.skipReason || ''}]` : '';
    console.log(`  [${String(i).padStart(2)}] qty=${(p.qty ?? '').toString().padStart(6)} unit=${(p.unit || '').padEnd(6)} name=${(p.name || '').padEnd(40)}${skip}`);
    console.log(`       raw: "${p.raw}"`);
  });
  process.exit(0);
})();
