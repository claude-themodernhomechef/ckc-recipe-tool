import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
const sa = require(path.join(__dirname, '../service-account.json'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const swapTable = JSON.parse(fs.readFileSync('data/masterSwapTable.json', 'utf8'));

(async () => {
  const snap = await db.collection('recipes').get();
  // Collect all unique garnish ingredient names + their frequency + sample recipe id
  const freq: Record<string, { count: number; sample: string }> = {};
  snap.forEach(doc => {
    const ings = doc.data().nutrition?.ingredients || [];
    ings.forEach((ing: any) => {
      if (!ing.garnish) return;
      const name = (ing.name || '').toLowerCase().trim();
      if (!name) return;
      if (!freq[name]) freq[name] = { count: 0, sample: doc.id };
      freq[name].count++;
    });
  });

  const sorted = Object.entries(freq).sort((a,b) => b[1].count - a[1].count);
  const present: any[] = [];
  const absent: any[] = [];

  sorted.forEach(([name, info]) => {
    const entry = swapTable[name];
    if (entry) present.push({ name, count: info.count, diets: Object.keys(entry).sort().join(',') });
    else absent.push({ name, count: info.count, sample: info.sample });
  });

  console.log(`=== GARNISH COVERAGE AUDIT ===`);
  console.log(`Unique garnish ingredient names: ${sorted.length}`);
  console.log(`In masterSwapTable: ${present.length}`);
  console.log(`Missing from masterSwapTable: ${absent.length}\n`);

  console.log(`=== ALREADY IN SWAP TABLE (${present.length}) ===`);
  present.forEach(p => console.log(`  ${String(p.count).padStart(3)} × ${p.name.padEnd(35)} [${p.diets}]`));

  console.log(`\n=== MISSING FROM SWAP TABLE (${absent.length}) ===`);
  console.log(`(only ingredients with potential diet conflicts need entries — many of these may need NO entry if compliant for all 8 diets)\n`);
  absent.forEach(a => console.log(`  ${String(a.count).padStart(3)} × ${a.name}`));

  fs.writeFileSync('data/garnish_swap_coverage.json', JSON.stringify({ present, absent }, null, 2));
  process.exit(0);
})();
