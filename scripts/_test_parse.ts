import { parseIngredient } from '../ckc-consumer-app/lib/ingredientParser';
const tests = [
  "Organic whole chicken ((About 5-10 lbs. is perfect; See Notes!))",
  "1 whole chicken",
  "whole chicken",
  "1/4 teaspoon pepper ()",
];
for (const t of tests) {
  const p = parseIngredient(t);
  console.log(`"${t}" → qty=${p.qty} unit="${p.unit}" name="${p.name}"`);
}
