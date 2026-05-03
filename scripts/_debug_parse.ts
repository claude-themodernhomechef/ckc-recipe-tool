import { parseIngredient } from '../ckc-consumer-app/lib/ingredientParser';
const tests = [
  "450 g (1 lb) chicken thigh fillets",
  "450g (1 lb) chicken thigh fillets",
  "450g chicken thigh fillets",
  "450 g chicken thigh fillets",
];
for (const t of tests) {
  const p = parseIngredient(t);
  console.log(`"${t}" → qty=${p.qty} unit="${p.unit}" name="${p.name}"`);
}
