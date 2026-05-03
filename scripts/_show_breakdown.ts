import * as fs from 'fs';
import * as path from 'path';
const prog = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/recipe_nutrition_v2_progress.json'), 'utf8'));

const id = process.argv[2];
const p = prog[id];
if (!p) { console.error('Not in progress'); process.exit(1); }
const n = p.nutrition;
console.log(`\n${'═'.repeat(90)}`);
console.log(`📋 servings: ${n.servings}   match: ${p.matchRate}%`);
console.log(`${'═'.repeat(90)}`);
console.log(`  Per-ingredient breakdown (whole-recipe values):\n`);
console.log('  ' + 'INGREDIENT'.padEnd(48) + 'qty/unit'.padEnd(15) + 'grams'.padStart(8) + '  ' + 'kcal'.padStart(7) + '  ' + 'protein'.padStart(8) + '  ' + 'fat'.padStart(7));
console.log('  ' + '-'.repeat(95));
let totalCal = 0, totalProt = 0, totalFat = 0;
for (const i of n.ingredients || []) {
  if (i.skip) {
    console.log(`  ⊝ ${(i.raw || '').slice(0, 80)}  [skipped]`);
    continue;
  }
  if (!i.matched) {
    console.log(`  ✗ "${(i.raw || '').slice(0, 75)}"  [unmatched]`);
    continue;
  }
  const qStr = `${i.qty || ''} ${i.unit || ''}`.trim();
  const cal = i.nutrition?.calories || 0;
  const prot = i.nutrition?.protein || 0;
  const fat = i.nutrition?.fat || 0;
  totalCal += cal; totalProt += prot; totalFat += fat;
  console.log(`  ✓ ${(i.name || '').slice(0,46).padEnd(48)}${qStr.padEnd(15)}${(i.grams || 0).toFixed(0).padStart(8)}g${cal.toFixed(0).padStart(7)}${prot.toFixed(1).padStart(9)}g${fat.toFixed(1).padStart(7)}g  ← raw: "${(i.raw || '').slice(0, 50)}"`);
}
console.log('  ' + '-'.repeat(95));
console.log(`  TOTAL (whole recipe):                                        ${totalCal.toFixed(0).padStart(7)}${totalProt.toFixed(1).padStart(10)}g${totalFat.toFixed(1).padStart(7)}g`);
console.log(`  PER SERVING (÷${n.servings}):                                          ${(totalCal/n.servings).toFixed(0).padStart(7)}${(totalProt/n.servings).toFixed(1).padStart(10)}g${(totalFat/n.servings).toFixed(1).padStart(7)}g`);
process.exit(0);
