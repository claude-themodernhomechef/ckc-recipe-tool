# CKC Recipe Tool — Nutrition Calculation Rules

A plain-English guide to how we calculate calories and nutrition for every recipe. These rules reflect what people **actually eat**, not just the raw ingredients listed.

---

## Fish & Seafood

- If a recipe says "salmon" or "salmon fillet," we count it as skinless. Skin-on only if the recipe specifically says "skin-on" or "whole fish."
- Same rule applies to halibut, cod, tilapia, tuna, and other fish.
- A standard fish fillet weighs 6 oz (170g) per piece.

---

## Chicken

- If chicken is "boneless skinless," we use 8 oz per breast and 4 oz per thigh.
- If chicken is "bone-in," we count only the edible meat + skin (about 70% of the whole-piece weight).
- A bone-in chicken thigh = 4 oz of edible meat. A drumstick = 2 oz.
- A whole chicken is calculated using edible-portion only — bones don't count.
- If a recipe says "cooked chicken" or "rotisserie chicken," we use cooked values: 140g per breast (not raw 227g).

---

## Ground Meat

- If a recipe just says "ground beef" without a leanness percentage, we use 80/20.
- If a recipe says "lean ground beef," we use 90/10.
- If a recipe says "extra lean ground beef," we use 96/4.
- If a recipe says "ground turkey" or "ground chicken" without a percentage, we use 93% lean.
- If a recipe says "ground sirloin," we use 90/10.
- If a recipe says "ground chuck," we use 80/20.
- If a recipe says "ground pork," we use 80/20.

---

## Cooking Losses (calories that don't end up on the plate)

- If a recipe contains bacon, sausage, pancetta, or chorizo, we count 50% of its calories. The other 50% renders out as fat that gets discarded.
- Exception: if the recipe is a soup, stew, chili, or chowder, we count 100% — the rendered fat stays in the dish.
- If "grilled," "broiled," "BBQ," "kebab," "skewer," or "satay" is in the recipe name, we count 90% of the meat's calories. 10% is fat that drips off during cooking.
- If a recipe is a "braise," "stew," "ragù," "coq au vin," or "bourguignon" and contains wine, beer, or spirits, we count 70% of the alcohol's calories. 30% burns off during long cooking.
- If a cut is described as "trimmed" or "fat removed," we count 95% of its calories. 5% gets discarded.

---

## Frying Oil

- If a recipe deep-fries in 1/3 cup of oil or more, we count only 10% of the oil's calories. The rest stays in the pan.
- If oil is being used as a sauce, dressing ingredient, or sauté (less than 1/3 cup), we count 100%.

---

## Marinade

- We count marinade ingredients at 100%. We can't reliably tell from ingredients alone whether a marinade gets discarded or reserved-and-poured-back.
- If a specific recipe explicitly says "discard the marinade," we override it manually for that recipe.

---

## Rice, Grains & Pasta

- If a recipe says "rice," we count it raw — recipes list raw measurements.
- We only use cooked-rice values if the recipe specifically says "cooked rice," "steamed rice," "leftover rice," or similar.
- Same rule for quinoa, basmati, jasmine, brown rice, wild rice, and other grains.
- Pasta is counted in its dry/raw weight too.

---

## Beans & Legumes

- We use cooked values for all beans and legumes. Most recipes use canned or pre-cooked beans, so this matches what's actually being eaten.
- Black beans, kidney beans, cannellini, chickpeas, garbanzos, pinto, navy, butter beans, and lentils all default to cooked values.
- If a recipe explicitly says "dried" beans, the cooked values still apply (the recipe assumes you'll cook them before eating).

---

## Garnishes & Toppings

- If an ingredient says "for serving," "for garnish," "for topping," "to serve," "to garnish," "on top," "for spritzing," "for drizzling," "for sprinkling," "for dipping," "for finishing," or "for brushing," we calculate it separately. It shows up as an "add-on" in the app, not part of the main meal.
- If an ingredient line starts with "Optional," we treat it as a garnish (calculated, but excluded from the main total).
- If an ingredient is listed without a quantity (like just "Avocado" or "Lime wedges"), we usually flag it as a garnish or skip it.

---

## Breading & Coatings

- If a recipe has breadcrumbs AND a whole-piece protein (chicken thighs, pork chops, fish fillets) AND no ground meat or pasta, we cap the breadcrumbs at 2/3 cup per pound of protein. Excess breadcrumbs in the recipe don't all stick to the meat.

---

## Broths & Stocks

- Chicken broth, beef broth, vegetable broth, and bone broth all use water-based values (~10 kcal per 100g). They're mostly water with flavoring.
- "Reduced sodium," "low sodium," and "stock" all map to the same broth values — sodium content is the only meaningful difference.

---

## Fresh Herbs

- Fresh oregano, sage, tarragon, basil, parsley, cilantro, dill, mint, and chives all use **fresh** values, not dried.
- Dried herbs (thyme, rosemary in dried form, oregano dried, etc.) have ~10× the calories per gram of fresh, so we never substitute.
- 1 cup of fresh leafy herbs ≈ 25g packed.

---

## Quantity Conventions

- "1 medium onion" = 150g. "1 small" = 100g. "1 large" = 200g.
- "1 medium carrot" = 60g.
- "1 garlic clove" = 3g.
- "1 cup oil" = 218g.
- "1 stick butter" = 113g (½ cup).
- "1 large egg" = 50g.
- "1 medium tomato" = 123g.
- If a recipe gives a range like "1-2 lbs," we use the lower bound.
- If a recipe lists per-piece weight (like "4 (6-oz) salmon fillets"), we multiply: 4 × 6 oz = 24 oz total.

---

## What we DON'T adjust for

- **Cooking shrinkage on meat (water loss).** Water has 0 calories, so "1 lb raw chicken" still has the same calories as "12 oz cooked chicken." We use raw weight × raw calories, which gives the correct total.
- **Reduction sauces.** When a sauce reduces, water evaporates but calories stay the same.
- **Pasta water absorption.** The added water has no calories.
- **Salt to taste, pepper, "as needed."** These have ~0 calories.

---

## Why our values diverge from Edamam

Edamam is the industry-standard nutrition database, but it has limitations we deliberately work around:

- Edamam doesn't account for bacon fat rendering out — we do.
- Edamam doesn't subtract grill drippings — we do.
- Edamam doesn't burn off alcohol calories in braises — we do.
- Edamam treats fish as skin-on by default — we use skinless.
- Edamam sometimes returns garbage values (bone broth at 116 kcal/100g, dried-herb values for fresh herbs) — we use USDA-verified values.

The result: our calorie counts are typically 10-20% lower than Edamam for cooked meats, fried foods, and braises. This is correct, not a bug.
