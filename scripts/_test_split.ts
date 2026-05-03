import { splitIngredientLine, parseIngredient } from '../ckc-consumer-app/lib/ingredientParser';
const tests = [
  "4 bone-in, skin-on thighs and 4 bone-in, skin-on drumsticks",
  "4 bone-in, skin-on thighs",
  "pita, naan or some sort of flatbread or couscous or rice for serving",
  "scallions, sesame seeds, for serving",
];
for (const t of tests) {
  console.log(`\nRAW: "${t}"`);
  for (const s of splitIngredientLine(t)) {
    const p = parseIngredient(s);
    console.log(`  split → "${s}"  →  parsed.name="${p.name}"  qty=${p.qty} unit="${p.unit}"`);
  }
}
process.exit(0);
