import * as fs from 'fs';
import * as path from 'path';
const prog = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/recipe_nutrition_v2_progress.json'), 'utf8'));
const ed = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/edamam_progress.json'), 'utf8'));
const ids = [
  ['1RsQWRKk2fh71b6UwvlQ', 'Spicy Sesame Butter Chicken'],
  ['1Ysypi3acarqsJcvU3xL', 'Chicken Fajitas'],
  ['2013-01-14-an-oldie-but-a-goodie-honey-baked-chicken-legs', 'Honey Mustard Baked Chicken Legs'],
  ['2013-10-24-ina-gartens-mustard-roasted-chicken', "Ina Garten's Mustard-Roasted Chicken"],
  ['2014-03-12-chicken-with-preserved-lemons-green-olives', 'Chicken with Preserved Lemons and Green Olives'],
];

for (const [id, name] of ids) {
  const p = prog[id];
  const e = ed[id];
  if (!p) { console.log(`✗ ${name}: not in progress`); continue; }
  const n = p.nutrition;
  const ps = n.perServing || {};
  const eN = e?.nutrition || {};
  const servings = n.servings || 4;
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`📋 ${name}    (servings: ${servings},  match: ${p.matchRate}%)`);
  console.log(`${'═'.repeat(80)}`);
  console.log(`  PER SERVING:                   OURS          EDAMAM         Δ`);
  const fmt = (ours: any, theirs: any, unit = '') => {
    const o = ours != null ? `${ours.toFixed(0)}${unit}` : '—';
    const t = theirs != null ? `${theirs.toFixed(0)}${unit}` : '—';
    const d = ours != null && theirs != null && theirs > 0 ? `${Math.round((ours - theirs) / theirs * 100)}%` : '—';
    return `${o.padEnd(13)} ${t.padEnd(13)} ${d}`;
  };
  // Edamam stores WHOLE-RECIPE totals — divide by servings to compare per-serving
  const eps = (v: any) => (v != null ? v / servings : null);
  console.log(`    calories:                    ${fmt(ps.calories, eps(eN.calories))}`);
  console.log(`    protein:                     ${fmt(ps.protein, eps(eN.protein), 'g')}`);
  console.log(`    fat:                         ${fmt(ps.fat, eps(eN.fat), 'g')}`);
  console.log(`    carbs:                       ${fmt(ps.carbs, eps(eN.carbs), 'g')}`);
  console.log(`    fiber:                       ${fmt(ps.fiber, eps(eN.fiber), 'g')}`);
  console.log(`    sodium:                      ${fmt(ps.sodium, eps(eN.sodium), 'mg')}`);
  // Show unmatched
  const unmatched = (n.ingredients || []).filter((i: any) => !i.matched && !i.skip);
  if (unmatched.length) {
    console.log(`\n  ⚠ Unmatched (${unmatched.length}):`);
    unmatched.forEach((i: any) => console.log(`    - "${i.raw}"`));
  }
}
process.exit(0);
