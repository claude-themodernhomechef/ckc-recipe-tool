/**
 * Per-recipe outlier triage:
 *   For each outlier (>±25% vs Edamam, with Edamam-noise filter), show:
 *     - Recipe name + ID
 *     - Edamam vs ours kcal/serving
 *     - The 1-3 ingredient lines that contribute most kcal
 *     - A "why" hint (over/under, possible cause)
 *
 * Output: data/triage_outliers.csv  for user review.
 * Format columns:
 *   recipe_id, recipe_name, ours_kcal_per_serving, edamam_kcal_per_serving,
 *   pct_diff, top_ingredient_1, kcal_1, top_ingredient_2, kcal_2,
 *   top_ingredient_3, kcal_3, suggested_action
 */
import * as fs from 'fs';
import * as path from 'path';
const prog = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/recipe_nutrition_v2_progress.json'), 'utf8'));
const ed = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/edamam_progress.json'), 'utf8'));

interface Row { id: string; name: string; servings: number; oursPerServ: number; edamamPerServ: number; pctDiff: number; topItems: any[]; }

const rows: Row[] = [];
for (const [id, p] of Object.entries(prog) as [string, any][]) {
  const e = ed[id];
  if (!p?.nutrition?.perServing?.calories) continue;
  if (e?.status !== 'ok' || !e?.nutrition?.calories) continue;
  const oursPerServ = p.nutrition.perServing.calories;
  const servings = p.nutrition.servings || 4;
  const edamamPerServ = e.nutrition.calories / servings;
  if (edamamPerServ < 50 || edamamPerServ > 2500) continue;
  const pctDiff = ((oursPerServ - edamamPerServ) / edamamPerServ) * 100;
  if (Math.abs(pctDiff) <= 25) continue;
  const items = (p.nutrition.ingredients || []).filter((i: any) => i.matched && i.nutrition?.calories);
  items.sort((a: any, b: any) => (b.nutrition.calories || 0) - (a.nutrition.calories || 0));
  rows.push({
    id,
    name: p.nutrition.recipeName || id,
    servings,
    oursPerServ,
    edamamPerServ,
    pctDiff,
    topItems: items.slice(0, 3),
  });
}

// Sort by absolute pctDiff desc — worst first
rows.sort((a, b) => Math.abs(b.pctDiff) - Math.abs(a.pctDiff));

// Build CSV
const headers = [
  'recipe_id', 'name', 'servings', 'ours_kcal', 'edamam_kcal', 'pct_diff',
  'top_ing_1', 'kcal_1', 'raw_1',
  'top_ing_2', 'kcal_2', 'raw_2',
  'top_ing_3', 'kcal_3', 'raw_3',
  'direction',
];
const csvEscape = (s: any) => {
  const v = String(s ?? '');
  return v.includes(',') || v.includes('"') || v.includes('\n')
    ? `"${v.replace(/"/g, '""')}"`
    : v;
};
const lines = [headers.join(',')];
for (const r of rows) {
  const row = [
    r.id, r.name, r.servings,
    r.oursPerServ.toFixed(0), r.edamamPerServ.toFixed(0),
    `${r.pctDiff > 0 ? '+' : ''}${r.pctDiff.toFixed(0)}%`,
    r.topItems[0]?.name || '', r.topItems[0]?.nutrition?.calories?.toFixed(0) || '', r.topItems[0]?.raw || '',
    r.topItems[1]?.name || '', r.topItems[1]?.nutrition?.calories?.toFixed(0) || '', r.topItems[1]?.raw || '',
    r.topItems[2]?.name || '', r.topItems[2]?.nutrition?.calories?.toFixed(0) || '', r.topItems[2]?.raw || '',
    r.pctDiff > 0 ? 'OVER' : 'UNDER',
  ];
  lines.push(row.map(csvEscape).join(','));
}

const outPath = path.join(__dirname, '../data/triage_outliers.csv');
fs.writeFileSync(outPath, lines.join('\n'));

console.log(`\nWrote ${rows.length} outliers to ${path.relative(process.cwd(), outPath)}\n`);
console.log(`Top 20 worst outliers (sorted by |Δ%|):\n`);
console.log(`  ${'Δ%'.padStart(7)}  ${'ours'.padStart(5)}  ${'edamam'.padStart(6)}  recipe (id)`);
console.log('  ' + '-'.repeat(80));
for (const r of rows.slice(0, 20)) {
  const dir = r.pctDiff > 0 ? '🔴' : '🔵';
  const top = r.topItems[0]?.name || 'NONE';
  console.log(`  ${dir} ${(r.pctDiff > 0 ? '+' : '') + r.pctDiff.toFixed(0).padStart(5)}%  ${r.oursPerServ.toFixed(0).padStart(5)}  ${r.edamamPerServ.toFixed(0).padStart(6)}  ${r.id.slice(0, 50).padEnd(50)}  top: "${top}"`);
}
process.exit(0);
