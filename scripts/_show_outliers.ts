/**
 * Show top recipes by absolute Edamam delta — both over-counts and under-counts.
 * Helps identify systematic bugs after a build run.
 */
import * as fs from 'fs';
import * as path from 'path';
const prog = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/recipe_nutrition_v2_progress.json'), 'utf8'));
const ed = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/edamam_progress.json'), 'utf8'));

interface Row {
  id: string;
  name: string;
  servings: number;
  matchRate: number;
  oursPerServ: number;
  edamamPerServ: number;
  delta: number;
  pctDiff: number;
}

const rows: Row[] = [];
for (const [id, p] of Object.entries(prog) as [string, any][]) {
  const e = ed[id];
  if (!p?.nutrition?.perServing?.calories) continue;
  if (e?.status !== 'ok' || !e?.nutrition?.calories) continue;
  const oursPerServ = p.nutrition.perServing.calories;
  const servings = p.nutrition.servings || 4;
  const edamamPerServ = e.nutrition.calories / servings;
  const delta = oursPerServ - edamamPerServ;
  const pctDiff = edamamPerServ > 0 ? (delta / edamamPerServ) * 100 : 0;
  rows.push({
    id,
    name: p.nutrition?.recipeName || id,
    servings,
    matchRate: p.matchRate || 0,
    oursPerServ,
    edamamPerServ,
    delta,
    pctDiff,
  });
}

// Need recipe names — fetch from Firestore? Or just use stored.
// Actually progress stores recipe data. Let's check if name is there.
// Fall back to id.

// Distribution buckets
const buckets = { '<-50': 0, '-50to-25': 0, '-25to-10': 0, '-10to+10': 0, '+10to+25': 0, '+25to+50': 0, '>+50': 0 };
for (const r of rows) {
  if (r.pctDiff < -50) buckets['<-50']++;
  else if (r.pctDiff < -25) buckets['-50to-25']++;
  else if (r.pctDiff < -10) buckets['-25to-10']++;
  else if (r.pctDiff <= 10) buckets['-10to+10']++;
  else if (r.pctDiff <= 25) buckets['+10to+25']++;
  else if (r.pctDiff <= 50) buckets['+25to+50']++;
  else buckets['>+50']++;
}
const total = rows.length;
console.log(`\n📊 ${total} recipes with Edamam cross-reference\n`);
console.log(`  Distribution of (Ours − Edamam) / Edamam %:\n`);
for (const [k, v] of Object.entries(buckets)) {
  const pct = ((v / total) * 100).toFixed(1);
  const bar = '█'.repeat(Math.round(v / total * 50));
  console.log(`    ${k.padStart(10)}:  ${String(v).padStart(4)}  (${pct.padStart(5)}%)  ${bar}`);
}

// Top over-counts (positive delta)
console.log(`\n🔴 TOP 20 OVER-COUNTS (we have higher kcal than Edamam):`);
console.log(`     ${'%'.padStart(7)} ${'ours'.padStart(6)} ${'edamam'.padStart(7)} ${'mtch'.padStart(5)}  recipe (id)`);
const topOver = rows.slice().sort((a, b) => b.pctDiff - a.pctDiff).slice(0, 20);
for (const r of topOver) {
  console.log(`     ${(r.pctDiff > 0 ? '+' : '') + r.pctDiff.toFixed(0).padStart(6)}% ${r.oursPerServ.toFixed(0).padStart(6)} ${r.edamamPerServ.toFixed(0).padStart(7)} ${(r.matchRate + '%').padStart(5)}  ${r.id}`);
}

console.log(`\n🔵 TOP 20 UNDER-COUNTS (we have lower kcal than Edamam):`);
console.log(`     ${'%'.padStart(7)} ${'ours'.padStart(6)} ${'edamam'.padStart(7)} ${'mtch'.padStart(5)}  recipe (id)`);
const topUnder = rows.slice().sort((a, b) => a.pctDiff - b.pctDiff).slice(0, 20);
for (const r of topUnder) {
  console.log(`     ${r.pctDiff.toFixed(0).padStart(7)}% ${r.oursPerServ.toFixed(0).padStart(6)} ${r.edamamPerServ.toFixed(0).padStart(7)} ${(r.matchRate + '%').padStart(5)}  ${r.id}`);
}

// Median absolute delta
const absSorted = rows.slice().map(r => Math.abs(r.pctDiff)).sort((a, b) => a - b);
const median = absSorted[Math.floor(absSorted.length / 2)];
const mean = absSorted.reduce((a, b) => a + b, 0) / absSorted.length;
console.log(`\n  Median absolute delta:  ${median.toFixed(0)}%`);
console.log(`  Mean absolute delta:    ${mean.toFixed(0)}%`);
console.log(`  Within ±10%:  ${rows.filter(r => Math.abs(r.pctDiff) <= 10).length} (${((rows.filter(r => Math.abs(r.pctDiff) <= 10).length / total) * 100).toFixed(0)}%)`);
console.log(`  Within ±25%:  ${rows.filter(r => Math.abs(r.pctDiff) <= 25).length} (${((rows.filter(r => Math.abs(r.pctDiff) <= 25).length / total) * 100).toFixed(0)}%)`);

process.exit(0);
