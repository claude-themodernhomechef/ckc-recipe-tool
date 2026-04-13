/**
 * label_builtin_components.js
 *
 * Reads the real ingredients list on each entree and stamps:
 *   builtInStarch: true/false
 *   builtInVeg:    true/false
 *
 * Usage:
 *   node scripts/label_builtin_components.js --dry-run   (print only, no writes)
 *   node scripts/label_builtin_components.js             (write to Firestore)
 *   node scripts/label_builtin_components.js --limit 50  (cap at 50 recipes)
 */

const admin = require('firebase-admin');
const path  = require('path');

const SA_KEY   = path.join(__dirname, '..', 'service-account.json');
const DRY_RUN  = process.argv.includes('--dry-run');
const limitArg = process.argv.indexOf('--limit');
const LIMIT    = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;

if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(SA_KEY) });
const db = admin.firestore();

// ── Keyword lists (ingredients-level, not name-level) ─────────────────────────

const STARCH_INGREDIENTS = [
  'rice', 'white rice', 'brown rice', 'jasmine rice', 'basmati', 'fried rice',
  'pasta', 'spaghetti', 'fettuccine', 'linguine', 'penne', 'rigatoni', 'orzo',
  'noodle', 'noodles', 'ramen', 'udon', 'soba', 'lo mein', 'chow mein',
  'bread', 'bun', 'roll', 'tortilla', 'pita', 'flatbread', 'naan',
  'potato', 'potatoes', 'sweet potato', 'mashed potato',
  'couscous', 'quinoa', 'polenta', 'grits', 'farro', 'barley',
  'corn tortilla', 'flour tortilla',
];

const VEG_INGREDIENTS = [
  'broccoli', 'bok choy', 'spinach', 'kale', 'asparagus',
  'zucchini', 'yellow squash', 'butternut squash', 'acorn squash',
  'cauliflower', 'brussels sprouts', 'cabbage', 'napa cabbage',
  'carrot', 'carrots', 'green bean', 'green beans', 'snap pea', 'snap peas',
  'snow pea', 'snow peas', 'edamame', 'eggplant', 'aubergine',
  'mushroom', 'mushrooms', 'shiitake', 'cremini', 'portobello',
  'bell pepper', 'bell peppers', 'red pepper', 'green pepper',
  'tomato', 'tomatoes', 'cherry tomatoes', 'artichoke',
  'leek', 'leeks', 'fennel', 'celery', 'beet', 'beets',
  'corn', 'peas', 'Swiss chard', 'chard', 'arugula', 'watercress',
  'bok choy', 'gai lan', 'Chinese broccoli',
];

function hasStarch(ingredients) {
  const text = ingredients.join(' ').toLowerCase();
  return STARCH_INGREDIENTS.some(k => text.includes(k));
}

function hasVeg(ingredients) {
  const text = ingredients.join(' ').toLowerCase();
  return VEG_INGREDIENTS.some(k => text.includes(k));
}

function matchedKeywords(ingredients, list) {
  const text = ingredients.join(' ').toLowerCase();
  return list.filter(k => text.includes(k));
}

async function main() {
  console.log(`Fetching approved entrees (limit: ${LIMIT === Infinity ? 'all' : LIMIT})…`);

  let q = db.collection('recipes')
    .where('status', '==', 'yes')
    .where('meal_type', '==', 'entree');

  if (LIMIT !== Infinity) q = q.limit(LIMIT);

  const snap = await q.get();
  console.log(`Found ${snap.size} entrees\n`);
  if (DRY_RUN) console.log('DRY RUN — no writes\n');

  const rows = snap.docs.map(d => {
    const data = d.data();
    const ingredients = (data.ingredients || []);
    const starch = hasStarch(ingredients);
    const veg    = hasVeg(ingredients);
    const starchMatches = matchedKeywords(ingredients, STARCH_INGREDIENTS);
    const vegMatches    = matchedKeywords(ingredients, VEG_INGREDIENTS);
    return { id: d.id, name: data.name || '', ingredients, starch, veg, starchMatches, vegMatches };
  });

  // Print summary table
  console.log(`${'Recipe'.padEnd(55)} ${'Starch'.padEnd(8)} ${'Veg'.padEnd(8)} Matched keywords`);
  console.log('─'.repeat(120));
  for (const r of rows) {
    const starchStr = r.starch ? '✓' : '–';
    const vegStr    = r.veg    ? '✓' : '–';
    const keywords  = [...r.starchMatches.map(k => `[S]${k}`), ...r.vegMatches.map(k => `[V]${k}`)].join(', ');
    console.log(`${r.name.slice(0, 54).padEnd(55)} ${starchStr.padEnd(8)} ${vegStr.padEnd(8)} ${keywords}`);
  }

  const starchCount = rows.filter(r => r.starch).length;
  const vegCount    = rows.filter(r => r.veg).length;
  const bothCount   = rows.filter(r => r.starch && r.veg).length;
  console.log(`\nSummary: ${starchCount} have built-in starch, ${vegCount} have built-in veg, ${bothCount} have both`);

  if (!DRY_RUN) {
    console.log('\nWriting to Firestore…');
    const BATCH_SIZE = 400;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = db.batch();
      rows.slice(i, i + BATCH_SIZE).forEach(r => {
        batch.update(db.collection('recipes').doc(r.id), {
          builtInStarch: r.starch,
          builtInVeg:    r.veg,
        });
      });
      await batch.commit();
      console.log(`  wrote ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
    }
    console.log('Done.');
  }

  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
