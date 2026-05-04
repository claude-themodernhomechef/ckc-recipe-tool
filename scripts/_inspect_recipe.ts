import * as admin from 'firebase-admin';
import * as path from 'path';
const sa = require(path.join(process.cwd(), 'service-account.json'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
(async () => {
  const id = process.argv[2];
  const doc = await db.collection('recipes').doc(id).get();
  if (!doc.exists) { console.error('not found'); process.exit(1); }
  const r = doc.data()!;
  console.log('Keys:', Object.keys(r).sort());
  console.log('---');
  console.log('Title/Name:', r.title || r.name);
  console.log('---ingredients (raw)---');
  (r.ingredients || []).forEach((i: any, idx: number) => console.log(`[${idx}]`, typeof i === 'string' ? i : JSON.stringify(i).slice(0, 160)));
  console.log('---instructions snippet---');
  const instr = r.instructions || r.directions || r.steps;
  if (Array.isArray(instr)) console.log(instr.slice(0, 3).map((s:any)=>typeof s==='string'?s.slice(0,200):JSON.stringify(s).slice(0,200)).join('\n---\n'));
  else if (typeof instr === 'string') console.log(instr.slice(0, 600));
  else console.log('(no instructions field)');
  process.exit(0);
})();
