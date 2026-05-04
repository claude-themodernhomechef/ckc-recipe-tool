import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
const sa = require(path.join(__dirname, '../service-account.json'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const swapTable = JSON.parse(fs.readFileSync('data/masterSwapTable.json', 'utf8'));

// Category → list of representative ingredient names to check
const CATEGORIES: Record<string, string[]> = {
  'small_seeds':       ['sesame seeds', 'hemp seeds', 'chia seeds', 'poppy seeds'],
  'grain_specific':    ['white rice', 'brown rice', 'jasmine rice', 'basmati rice', 'steamed rice', 'garlic rice'],
  'rice_pilaf':        ['rice pilaf'],
  'grain_other':       ['rice noodles', 'soba noodles', 'cooked pasta', 'cooked couscous', 'cauliflower rice'],
  'grain_bare':        ['rice', 'quinoa', 'couscous', 'farro', 'bulgur'],
  'mashed_potato':     ['mashed potatoes'],
  'beans':             ['frijoles', 'black beans', 'pinto beans', 'refried beans'],
  'chips':             ['tortilla chips', 'pita chips', 'potato chips'],
  'bread':             ['naan', 'pita', 'tortilla', 'flatbread', 'roti', 'bread', 'crusty bread'],
  'nori':              ['nori sheet', 'nori'],
  'sour_cream_tier':   ['sour cream', 'greek yogurt', 'yogurt', 'tzatziki', 'crema', 'creamy ranch', 'spicy mayo', 'ranch'],
  'cheese':            ['cotija cheese', 'feta', 'goat cheese', 'parmesan', 'pecorino romano', 'cheddar', 'mozzarella', 'blue cheese', 'gorgonzola', 'ricotta'],
  'woody_herb':        ['thyme', 'fresh thyme'],
  'herb':              ['cilantro', 'parsley', 'scallions', 'green onions', 'spring onions', 'chives', 'mint', 'basil', 'dill', 'tarragon', 'pea shoots'],
  'croutons':          ['croutons'],
  'avocado':           ['avocado'],
  'olives':            ['kalamata olives', 'castelvetrano olives', 'olives'],
  'pickled_jalapeno':  ['pickled jalapeno', 'pickled jalapeño', 'fermented jalapeno'],
  'pickled_onion':     ['pickled red onion', 'pickled onion'],
  'pepperoncini':      ['pepperoncini', 'peperoncini'],
  'kimchi':            ['kimchi'],
  'nuts':              ['almonds', 'walnuts', 'pecans', 'pine nuts', 'cashews', 'pistachios', 'peanuts', 'pumpkin seeds', 'pepitas', 'sunflower seeds'],
  'citrus':            ['lime', 'lemon', 'lime wedges', 'lemon wedges', 'lime zest', 'lemon zest'],
  'hot_sauce':         ['hot sauce', 'sriracha', 'tabasco', 'chili crisp', 'chile crisp', 'chili oil', 'sesame oil', 'hoisin sauce', 'mango chutney'],
  'cucumber':          ['persian cucumber', 'cucumber'],
  'lettuce':           ['iceberg lettuce', 'romaine lettuce', 'shredded lettuce', 'lettuce'],
  'leafy_greens':      ['leafy greens', 'mixed greens', 'salad greens'],
  'radish':            ['radish'],
  'onion':             ['red onion', 'white onion', 'yellow onion', 'onion'],
  'shallot':           ['shallot', 'shallots'],
  'tomatoes':          ['cherry tomatoes', 'grape tomatoes', 'tomatoes', 'tomato'],
  'fresh_jalapeno':    ['fresh jalapeño', 'jalapeño', 'jalapeno'],
  'bell_pepper':       ['bell pepper', 'bell peppers'],
  'zucchini':          ['zucchini', 'zucchini ribbons'],
  'guacamole':         ['guacamole'],
  'salsa':             ['salsa'],
};

(async () => {
  const report: any[] = [];
  for (const [cat, names] of Object.entries(CATEGORIES)) {
    const matches: any[] = [];
    const misses: string[] = [];
    for (const n of names) {
      if (swapTable[n.toLowerCase()]) {
        matches.push({ name: n, diets: Object.keys(swapTable[n.toLowerCase()]).sort() });
      } else {
        misses.push(n);
      }
    }
    report.push({ category: cat, matches, misses });
  }

  console.log('=== GARNISH SWAP COVERAGE BY CATEGORY ===\n');
  report.forEach(r => {
    if (r.matches.length === 0) {
      console.log(`❌ ${r.category}  (NONE present in swap table)`);
      console.log(`     missing: ${r.misses.join(', ')}\n`);
    } else if (r.misses.length === 0) {
      console.log(`✅ ${r.category}  (all ${r.matches.length} present)`);
      r.matches.forEach((m: any) => console.log(`     ${m.name.padEnd(30)} [${m.diets.join(',')}]`));
      console.log();
    } else {
      console.log(`⚠️  ${r.category}  (${r.matches.length} present, ${r.misses.length} missing)`);
      r.matches.forEach((m: any) => console.log(`     ✓ ${m.name.padEnd(28)} [${m.diets.join(',')}]`));
      r.misses.forEach((m: string) => console.log(`     ✗ ${m}`));
      console.log();
    }
  });

  fs.writeFileSync('data/garnish_swap_audit.json', JSON.stringify(report, null, 2));
  process.exit(0);
})();
