/**
 * Show outliers AFTER filtering out recipes where Edamam values are clearly
 * impossible (Edamam data errors, not our bugs).
 *
 * Filter rules:
 *   - Edamam kcal/serving < 50 → likely Edamam parsing failure
 *   - Edamam kcal/serving > 2500 → impossible for a single serving
 */
import * as fs from 'fs';
import * as path from 'path';
const prog = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/recipe_nutrition_v2_progress.json'), 'utf8'));
const ed = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/edamam_progress.json'), 'utf8'));

interface Row { id: string; servings: number; oursPerServ: number; edamamPerServ: number; pctDiff: number; matchRate: number; }

const rowsAll: Row[] = [];
const rowsValid: Row[] = [];
let rejected = 0;
for (const [id, p] of Object.entries(prog) as [string, any][]) {
  const e = ed[id];
  if (!p?.nutrition?.perServing?.calories) continue;
  if (e?.status !== 'ok' || !e?.nutrition?.calories) continue;
  const oursPerServ = p.nutrition.perServing.calories;
  const servings = p.nutrition.servings || 4;
  const edamamPerServ = e.nutrition.calories / servings;
  const pctDiff = edamamPerServ > 0 ? ((oursPerServ - edamamPerServ) / edamamPerServ) * 100 : 0;
  const row = { id, servings, oursPerServ, edamamPerServ, pctDiff, matchRate: p.matchRate || 0 };
  rowsAll.push(row);
  if (edamamPerServ < 50 || edamamPerServ > 2500) { rejected++; continue; }
  rowsValid.push(row);
}

const dist = (rows: Row[], label: string) => {
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
  console.log(`\n📊 ${label}: ${total} recipes\n`);
  for (const [k, v] of Object.entries(buckets)) {
    const pct = ((v / total) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(v / total * 50));
    console.log(`    ${k.padStart(10)}:  ${String(v).padStart(4)}  (${pct.padStart(5)}%)  ${bar}`);
  }
  const absSorted = rows.slice().map(r => Math.abs(r.pctDiff)).sort((a, b) => a - b);
  const median = absSorted[Math.floor(absSorted.length / 2)] || 0;
  const mean = absSorted.length ? absSorted.reduce((a, b) => a + b, 0) / absSorted.length : 0;
  const within10 = rows.filter(r => Math.abs(r.pctDiff) <= 10).length;
  const within25 = rows.filter(r => Math.abs(r.pctDiff) <= 25).length;
  console.log(`\n  Median absolute delta:  ${median.toFixed(0)}%`);
  console.log(`  Mean absolute delta:    ${mean.toFixed(0)}%`);
  console.log(`  Within ±10%:  ${within10} (${((within10/total)*100).toFixed(0)}%)`);
  console.log(`  Within ±25%:  ${within25} (${((within25/total)*100).toFixed(0)}%)`);
};

console.log(`\n${'═'.repeat(60)}`);
console.log(`  BEFORE FILTER (all Edamam-cross-ref'd recipes)`);
console.log('═'.repeat(60));
dist(rowsAll, 'All');

console.log(`\n${'═'.repeat(60)}`);
console.log(`  AFTER FILTER (excluded ${rejected} recipes with bad Edamam data:`);
console.log(`  Edamam kcal/serving < 50 or > 2500)`);
console.log('═'.repeat(60));
dist(rowsValid, 'Filtered');

// Top outliers from filtered set only
console.log(`\n🔴 TOP 15 OVER-COUNTS (filtered):`);
const topOver = rowsValid.slice().sort((a, b) => b.pctDiff - a.pctDiff).slice(0, 15);
for (const r of topOver) {
  console.log(`     ${(r.pctDiff > 0 ? '+' : '') + r.pctDiff.toFixed(0).padStart(5)}%  ours=${r.oursPerServ.toFixed(0).padStart(4)}  edamam=${r.edamamPerServ.toFixed(0).padStart(4)}  match=${(r.matchRate + '%').padStart(4)}  ${r.id}`);
}

console.log(`\n🔵 TOP 15 UNDER-COUNTS (filtered):`);
const topUnder = rowsValid.slice().sort((a, b) => a.pctDiff - b.pctDiff).slice(0, 15);
for (const r of topUnder) {
  console.log(`     ${r.pctDiff.toFixed(0).padStart(6)}%  ours=${r.oursPerServ.toFixed(0).padStart(4)}  edamam=${r.edamamPerServ.toFixed(0).padStart(4)}  match=${(r.matchRate + '%').padStart(4)}  ${r.id}`);
}

process.exit(0);
