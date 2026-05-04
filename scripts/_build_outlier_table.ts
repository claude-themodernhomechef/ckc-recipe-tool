/**
 * Build a comprehensive table of every recipe where our nutrition differs
 * from Edamam by >10% (per-serving calories), excluding Edamam noise.
 *
 * Output: data/outlier_table.csv (open in Numbers/Excel)
 *   Columns: rank, abs_pct_diff, recipe_id, recipe_name, ours_kcal,
 *            edamam_kcal, direction, top_ing_1, kcal_1, raw_1,
 *            top_ing_2, kcal_2, raw_2, top_ing_3, kcal_3, raw_3
 *
 * Sort: worst |Δ%| first.
 */
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
const sa = require(path.join(__dirname, '../service-account.json'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const prog = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/recipe_nutrition_v2_progress.json'), 'utf8'));
const ed = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/edamam_progress.json'), 'utf8'));

(async () => {
  console.log('Loading recipe names from Firestore...');
  const namesById = new Map<string, string>();
  const snap = await db.collection('recipes').get();
  snap.forEach(d => namesById.set(d.id, d.data().name || ''));

  interface Row {
    id: string; name: string; servings: number; oursPerServ: number;
    edamamPerServ: number; pctDiff: number; topItems: any[];
  }
  const rows: Row[] = [];
  for (const [id, p] of Object.entries(prog) as [string, any][]) {
    const e = ed[id];
    if (!p?.nutrition?.perServing?.calories) continue;
    if (e?.status !== 'ok' || !e?.nutrition?.calories) continue;
    const oursPerServ = p.nutrition.perServing.calories;
    const servings = p.nutrition.servings || 4;
    const edamamPerServ = e.nutrition.calories / servings;
    if (edamamPerServ < 50 || edamamPerServ > 2500) continue;  // filter Edamam noise
    const pctDiff = ((oursPerServ - edamamPerServ) / edamamPerServ) * 100;
    if (Math.abs(pctDiff) <= 10) continue;
    const items = (p.nutrition.ingredients || [])
      .filter((i: any) => i.matched && i.nutrition?.calories)
      .sort((a: any, b: any) => (b.nutrition.calories || 0) - (a.nutrition.calories || 0));
    rows.push({
      id,
      name: namesById.get(id) || id,
      servings,
      oursPerServ,
      edamamPerServ,
      pctDiff,
      topItems: items.slice(0, 3),
    });
  }

  rows.sort((a, b) => Math.abs(b.pctDiff) - Math.abs(a.pctDiff));

  const csvEscape = (s: any) => {
    const v = String(s ?? '');
    return v.includes(',') || v.includes('"') || v.includes('\n')
      ? `"${v.replace(/"/g, '""')}"`
      : v;
  };
  const headers = [
    'rank', 'abs_pct_diff', 'pct_diff', 'recipe_id', 'recipe_name',
    'servings', 'ours_kcal_per_serv', 'edamam_kcal_per_serv', 'direction',
    'top_ing_1', 'kcal_1', 'raw_1',
    'top_ing_2', 'kcal_2', 'raw_2',
    'top_ing_3', 'kcal_3', 'raw_3',
  ];
  const lines = [headers.join(',')];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const row = [
      i + 1, Math.abs(r.pctDiff).toFixed(0),
      `${r.pctDiff > 0 ? '+' : ''}${r.pctDiff.toFixed(0)}%`,
      r.id, r.name, r.servings,
      r.oursPerServ.toFixed(0), r.edamamPerServ.toFixed(0),
      r.pctDiff > 0 ? 'OVER' : 'UNDER',
      r.topItems[0]?.name || '', r.topItems[0]?.nutrition?.calories?.toFixed(0) || '', r.topItems[0]?.raw || '',
      r.topItems[1]?.name || '', r.topItems[1]?.nutrition?.calories?.toFixed(0) || '', r.topItems[1]?.raw || '',
      r.topItems[2]?.name || '', r.topItems[2]?.nutrition?.calories?.toFixed(0) || '', r.topItems[2]?.raw || '',
    ];
    lines.push(row.map(csvEscape).join(','));
  }

  const outPath = path.join(__dirname, '../data/outlier_table.csv');
  fs.writeFileSync(outPath, lines.join('\n'));

  // Distribution summary
  const buckets = { '10-25%': 0, '25-50%': 0, '50-100%': 0, '>100%': 0 };
  for (const r of rows) {
    const a = Math.abs(r.pctDiff);
    if (a <= 25) buckets['10-25%']++;
    else if (a <= 50) buckets['25-50%']++;
    else if (a <= 100) buckets['50-100%']++;
    else buckets['>100%']++;
  }

  console.log(`\n📊 Total recipes with >10% Edamam difference: ${rows.length}\n`);
  console.log('Distribution:');
  for (const [k, v] of Object.entries(buckets)) {
    console.log(`  ${k.padEnd(10)}: ${String(v).padStart(4)}`);
  }
  console.log(`\nWrote full table to: data/outlier_table.csv\n`);
  process.exit(0);
})();
