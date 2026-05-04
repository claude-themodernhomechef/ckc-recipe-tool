/**
 * Process all recipes outside ±25% Edamam delta. For each, find the top
 * contributing ingredient (the one with the most kcal). Group by ingredient
 * to surface DB entries that are systematically wrong.
 */
import * as fs from 'fs';
import * as path from 'path';
const prog = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/recipe_nutrition_v2_progress.json'), 'utf8'));
const ed = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/edamam_progress.json'), 'utf8'));

interface Outlier {
  id: string;
  pctDiff: number;
  oursPerServ: number;
  edamamPerServ: number;
  topIngredient: string;
  topIngKcal: number;
  topIngPctOfTotal: number;
}

const outliers: Outlier[] = [];
for (const [id, p] of Object.entries(prog) as [string, any][]) {
  const e = ed[id];
  if (!p?.nutrition?.perServing?.calories) continue;
  if (e?.status !== 'ok' || !e?.nutrition?.calories) continue;
  const oursPerServ = p.nutrition.perServing.calories;
  const servings = p.nutrition.servings || 4;
  const edamamPerServ = e.nutrition.calories / servings;
  // Filter Edamam noise
  if (edamamPerServ < 50 || edamamPerServ > 2500) continue;
  const pctDiff = ((oursPerServ - edamamPerServ) / edamamPerServ) * 100;
  if (Math.abs(pctDiff) <= 25) continue;

  // Find top ingredient by calories
  const items = (p.nutrition.ingredients || []).filter((i: any) => i.matched && i.nutrition?.calories);
  items.sort((a: any, b: any) => (b.nutrition.calories || 0) - (a.nutrition.calories || 0));
  const top = items[0];
  const total = items.reduce((s: number, i: any) => s + (i.nutrition.calories || 0), 0);
  outliers.push({
    id,
    pctDiff,
    oursPerServ,
    edamamPerServ,
    topIngredient: top?.name || 'NONE',
    topIngKcal: top?.nutrition?.calories || 0,
    topIngPctOfTotal: total > 0 ? ((top?.nutrition?.calories || 0) / total) * 100 : 0,
  });
}

// Group by top ingredient to find patterns
const byIngredient = new Map<string, { count: number; over: number; under: number; recipes: string[]; avgPctDiff: number }>();
for (const o of outliers) {
  const k = o.topIngredient;
  let g = byIngredient.get(k);
  if (!g) { g = { count: 0, over: 0, under: 0, recipes: [], avgPctDiff: 0 }; byIngredient.set(k, g); }
  g.count++;
  if (o.pctDiff > 0) g.over++; else g.under++;
  if (g.recipes.length < 5) g.recipes.push(`${o.id} (${o.pctDiff > 0 ? '+' : ''}${o.pctDiff.toFixed(0)}%)`);
  g.avgPctDiff = (g.avgPctDiff * (g.count - 1) + o.pctDiff) / g.count;
}

console.log(`\nTOTAL OUTLIERS (>±25%, Edamam-validated): ${outliers.length}\n`);

const sorted = Array.from(byIngredient.entries()).sort((a, b) => b[1].count - a[1].count);
console.log(`TOP 30 INGREDIENTS DRIVING OUTLIERS (by recipe count):\n`);
console.log(`  ${'count'.padStart(5)}  ${'over'.padStart(4)}  ${'under'.padStart(4)}  ${'avg Δ%'.padStart(7)}  ingredient`);
console.log('  ' + '-'.repeat(70));
for (let i = 0; i < Math.min(30, sorted.length); i++) {
  const [name, g] = sorted[i];
  const overUnder = g.over > g.under ? '🔴' : g.under > g.over ? '🔵' : '🟡';
  console.log(`  ${String(g.count).padStart(5)}  ${String(g.over).padStart(4)}  ${String(g.under).padStart(4)}  ${(g.avgPctDiff > 0 ? '+' : '') + g.avgPctDiff.toFixed(0).padStart(6)}%  ${overUnder} ${name}`);
}

console.log(`\n\nSAMPLE OUTLIERS PER PATTERN (top 10 ingredients):\n`);
for (let i = 0; i < Math.min(10, sorted.length); i++) {
  const [name, g] = sorted[i];
  console.log(`\n[${name}] — ${g.count} outliers, avg Δ${g.avgPctDiff.toFixed(0)}%`);
  g.recipes.forEach(r => console.log(`    ${r}`));
}
process.exit(0);
