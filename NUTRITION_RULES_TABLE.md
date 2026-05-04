# Nutrition Calculation Rules — Quick Reference

| Category | If the recipe says... | Then we calculate it as... | Why |
|---|---|---|---|
| **Fish** | "salmon" / "salmon fillet" / "cod" / "halibut" / "tilapia" | Skinless | Most home cooks remove or buy skinless |
| **Fish** | "skin-on salmon" / "whole fish" | Skin-on (208 kcal/100g for salmon) | Recipe explicitly includes skin |
| **Chicken** | "boneless skinless chicken breast" | 8 oz / 227g per breast | Standard portion |
| **Chicken** | "boneless skinless chicken thigh" | 4 oz / 113g per thigh | Standard portion |
| **Chicken** | "bone-in chicken thigh" | 4.2 oz / 120g edible meat + skin (70% of whole-piece) | Bones aren't eaten |
| **Chicken** | "chicken drumstick" | 2 oz / 55g edible | Bones aren't eaten |
| **Chicken** | "whole chicken" | Edible-portion only, 170 kcal/100g | Bones aren't eaten |
| **Chicken** | "cooked chicken" / "rotisserie chicken" / "shredded chicken" | 140g per breast (cooked weight, 165 kcal/100g) | Already cooked, accounts for shrinkage |
| **Ground beef** | "ground beef" (no %) | 80/20 (254 kcal/100g) | Most common in stores |
| **Ground beef** | "lean ground beef" | 90/10 (179 kcal/100g) | Standard "lean" assumption |
| **Ground beef** | "extra lean ground beef" | 96/4 (134 kcal/100g) | USDA extra-lean classification |
| **Ground beef** | "ground sirloin" | 90/10 (179 kcal/100g) | Sirloin is naturally leaner |
| **Ground beef** | "ground chuck" | 80/20 (254 kcal/100g) | Chuck is standard 80/20 |
| **Ground turkey** | "ground turkey" (no %) | 93% lean (143 kcal/100g) | Health-recipe convention |
| **Ground turkey** | "ground turkey breast" / "extra lean" | 99% lean (107 kcal/100g) | All-white-meat |
| **Ground chicken** | "ground chicken" (no %) | 93% lean (134 kcal/100g) | Health-recipe convention |
| **Ground pork** | "ground pork" | 80/20 (259 kcal/100g) | Standard ratio |
| **Bacon/sausage** | Recipe contains bacon, pancetta, chorizo, or sausage | Count 50% of calories | 50% renders out as fat that's discarded |
| **Bacon/sausage** | Recipe is a soup, stew, chili, or chowder | Count 100% of bacon calories | Rendered fat stays in the dish |
| **Grilling** | Recipe name contains "grilled," "broiled," "BBQ," "kebab," "skewer," or "satay" | Count 90% of meat calories | 10% drips off as fat during cooking |
| **Trimmed cuts** | Ingredient says "trimmed" or "fat removed" | Count 95% of calories | 5% gets discarded |
| **Alcohol** | Recipe is "braised," "stewed," "ragù," "coq au vin," or "bourguignon" AND contains wine, beer, or spirits | Count 70% of alcohol calories | 30% burns off in long cooking |
| **Frying oil** | "for frying" / "to deep fry" with 1/3 cup oil or more | Count 10% of oil calories | 90% stays in the pan |
| **Marinade** | Recipe lists marinade ingredients | Count 100% by default | Can't reliably tell discard vs reserve from ingredients alone |
| **Marinade** | Recipe explicitly says "discard the marinade" | Manually override that recipe | Overrides handle case-by-case |
| **Rice/grains** | "rice" / "quinoa" / "basmati" / "brown rice" | Use raw values | Recipes list raw measurements |
| **Rice/grains** | "cooked rice" / "steamed rice" / "leftover rice" | Use cooked values (130 kcal/100g, Cup=158g) | Recipe specifies the cooked form |
| **Pasta** | "pasta" / "noodles" | Use raw/dry values | Recipes list dry weight |
| **Beans** | "black beans" / "kidney beans" / "chickpeas" / "lentils" | Use cooked values (~130 kcal/100g) | Most recipes use canned/pre-cooked |
| **Beans** | "dried chickpeas" / "dried beans" | Still use cooked values | Recipe assumes you cook them before eating |
| **Garnish** | "for serving" / "for garnish" / "to serve" / "on top" / "for spritzing" / "for drizzling" | Calculate separately, not in main total | Add-on, not part of the main meal |
| **Garnish** | Ingredient line starts with "Optional" | Same as above — separate from main total | Optional add-on |
| **Garnish** | Ingredient has no quantity (e.g., just "Avocado" or "Lime wedges") | Treat as garnish or skip | Author didn't specify amount — likely garnish |
| **Breading** | Recipe has breadcrumbs + whole-piece protein + no ground meat or pasta | Cap breadcrumbs at 2/3 cup per pound of protein | Excess doesn't stick to the meat |
| **Broth** | "chicken broth" / "beef broth" / "vegetable broth" / "bone broth" | ~10 kcal per 100g | Mostly water with flavoring |
| **Broth** | "low sodium" / "reduced sodium" / "stock" variants | Same values as regular broth | Sodium content is the only difference |
| **Fresh herbs** | "fresh basil," "fresh oregano," "fresh parsley," etc. | Use USDA fresh values (~25 kcal/100g for leafy) | Fresh herbs have ~10× fewer calories than dried |
| **Onion** | "1 medium onion" | 150g | Standard size |
| **Onion** | "1 small" / "1 large" | 100g / 200g | |
| **Carrot** | "1 medium carrot" | 60g | Standard size |
| **Garlic** | "1 garlic clove" | 3g | Standard size |
| **Egg** | "1 large egg" | 50g | USDA standard |
| **Tomato** | "1 medium tomato" | 123g | USDA standard |
| **Butter** | "1 stick butter" | 113g (½ cup) | US standard |
| **Oil** | "1 cup oil" | 218g | Density-based |
| **Range** | Recipe says "1-2 lbs" | Use the lower bound (1 lb) | Conservative estimate |
| **Per-piece** | Recipe says "4 (6-oz) salmon fillets" | Multiply: 4 × 6 = 24 oz total | Honor per-piece weight specification |
| **Cooking shrinkage** | Any meat cooked from raw | Use raw weight × raw calories (no shrinkage adjustment) | Water lost has 0 calories — totals stay the same |
| **Reduction sauces** | "Reduce by half," "simmer until thick" | No adjustment | Water evaporates but calories don't change |
| **Salt/pepper** | "salt to taste" / "pepper as needed" | 0 calories | Negligible |

---

## Summary of cooking-loss adjustments (for quick reference)

| Adjustment | Discount | Trigger |
|---|---|---|
| Bacon/sausage render | 50% off | Recipe contains bacon/sausage AND is not a soup/stew |
| Grill/broil/BBQ drip | 10% off | Recipe name has "grilled," "broiled," "BBQ," "kebab," etc. |
| Alcohol burn-off | 30% off | Recipe is braise/stew/ragù AND contains wine/beer/spirits |
| Trimmed cuts | 5% off | Ingredient says "trimmed" or "fat removed" |
| Deep-frying oil | 90% off | "For frying" with ≥1/3 cup oil |
