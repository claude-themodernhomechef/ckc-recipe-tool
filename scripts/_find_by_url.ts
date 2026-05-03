import * as admin from 'firebase-admin';
import * as path from 'path';
const sa = require(path.join(__dirname, '../service-account.json'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const urls = [
  'https://www.halfbakedharvest.com/one-pan-spicy-sesame-butter-chicken',
  'https://www.halfbakedharvest.com/skillet-chicken-fajitas',
  'https://alexandracooks.com/2013/01/14/an-oldie-but-a-goodie-honey-baked-chicken-legs',
  'https://alexandracooks.com/2013/10/24/ina-gartens-mustard-roasted-chicken',
  'https://alexandracooks.com/2014/03/12/chicken-with-preserved-lemons-green-olives',
];

(async () => {
  const snap = await db.collection('recipes').get();
  const all: any[] = [];
  snap.forEach(d => all.push({ id: d.id, ...d.data() }));
  for (const u of urls) {
    const matches = all.filter(r => {
      const ru = (r.sourceUrl || r.url || r.recipeUrl || '').toLowerCase();
      return ru.includes(u.replace(/^https?:\/\//, '').split('/').slice(0, 3).join('/').toLowerCase()) ||
             ru.includes(u.split('/').filter((s: string) => s.length > 8).pop()?.toLowerCase() || '!!!');
    });
    if (matches.length === 1) {
      console.log(`✓ ${u}\n  → ${matches[0].id}  "${matches[0].name}"\n`);
    } else if (matches.length > 1) {
      console.log(`? ${u} (${matches.length} matches):`);
      matches.forEach(m => console.log(`    ${m.id}  "${m.name}"`));
    } else {
      console.log(`✗ ${u} — not found`);
    }
  }
  process.exit(0);
})();
