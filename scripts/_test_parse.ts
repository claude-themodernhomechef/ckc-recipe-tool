import { parseIngredient } from '../ckc-consumer-app/lib/ingredientParser';
const tests = [
  "15- ounce can full fat coconut milk",
  "1 (15- ounce) can full fat coconut milk",
  "15-ounce can full fat coconut milk",
  "15 ounce can full fat coconut milk",
  "15- ounce can cooked lentils",
];
for (const t of tests) {
  const p = parseIngredient(t);
  console.log(`"${t}" → qty=${p.qty} unit="${p.unit}" name="${p.name}"`);
}
