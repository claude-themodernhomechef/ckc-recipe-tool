import { parseIngredient } from '../ckc-consumer-app/lib/ingredientParser';
const tests = [
  "1 cup mint leaves, packed ( 2 x .75 ounce packages)",  // "75 oz" bug
  "1/4 teaspoon pepper ()",  // empty paren strips unit
  "8 pieces",  // standalone fragment
  "1 (12.3 oz block) silken tofu",  // 12.3 oz
];
for (const t of tests) {
  const p = parseIngredient(t);
  console.log(`"${t}"\n  → qty=${p.qty} unit="${p.unit}" name="${p.name}"\n`);
}
