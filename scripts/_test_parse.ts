import { parseIngredient } from '../ckc-consumer-app/lib/ingredientParser';
const tests = [
  "450 g (1 lb) chicken thigh fillets (chopped)",
  "100 g (1 cup) sugar snap peas",
  "1 salmon fillet (about 2 pounds)",
  "Organic whole chicken (About 5-10 lbs. is perfect)",
  "2 to 3 cups vegetable oil (for frying)",
];
for (const t of tests) {
  const p = parseIngredient(t);
  console.log(`RAW: ${t}\n  → qty=${p.qty} unit="${p.unit}" name="${p.name}"\n`);
}
