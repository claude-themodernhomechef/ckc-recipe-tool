# Pass-off — Recipe Text Edits & Garnish/Per-Serving Logic

**Last updated:** 2026-05-03
**Current state:** Match rate **100%** (14,858 / 14,869 ingredient lines). 0 recipes under 80%.

---

## Where we are

Pipeline is fully clean:
- **Match rate:** 100% (was 96% → 97.4% → 100%)
- **Match-path breakdown:** 97.3% exact, 2.5% prep-stripped exact, rest negligible
- **Recipes <80%:** 0 (was 3)
- **Recipes <50%:** 0
- **Garnish/serving lines:** all 177 lines across 127 recipes now carry whole-recipe quantities scaled from per-serving rules. Nutrition can now read accurate per-serving values for every garnish.

---

## The two key formats to remember

### 1. Suffix wording: `, to garnish` and `, to serve`

(Switched from `, for garnish` / `, for serving` in the 2026-05-03 garnish pass.) The parser still recognizes both, but **all new recipes should use "to garnish" / "to serve".**

```
1 cup sour cream, to garnish
2 avocados, to serve
1/2 cup fresh cilantro, to garnish
```

What this does:
- **Shopping list** displays: `to garnish | sour cream` (qty hidden, marker shown)
- **Nutrition layer** reads: `qty=1, unit=cup, name="sour cream"` (used for math)

### 2. Quantities are **whole recipe**, not per-serving

The nutrition pipeline divides whole-recipe qty by `servings` to get per-serving values. So when adding a garnish line, scale up by servings count.

---

## Standard per-serving portion rules

**Source of truth:** [`data/garnish_portion_rules.json`](data/garnish_portion_rules.json)

That JSON file is read by `build_recipe_nutrition_v2.ts` whenever a garnish line has no explicit qty. To change a portion (e.g. cheese 1 oz → 0.5 oz), edit the JSON — no code change needed. Order matters in the JSON: more-specific rules must come before more-general ones (e.g. `pita chips` before `pita`).

The table below is a human-readable mirror of that JSON. **If they ever drift, the JSON wins.**

When writing a new garnish/serving line, look up the ingredient here, then multiply by `servings`:

| Category | Per serving | Examples |
|---|---|---|
| Grains (cooked) | 1/2 cup | rice (jasmine/white/brown/basmati/garlic/coconut/cilantro/steamed/cooked), rice pilaf, quinoa, couscous, farro, bulgur, rice noodles, soba noodles, cooked pasta, cauliflower rice, lettuce cups |
| Mashed potatoes | 1/2 cup | mashed potatoes |
| Beans / frijoles | 1/2 cup | frijoles, cooked beans, black/pinto/refried beans |
| Bread / flatbread | 1 piece | naan, pita, tortillas, flatbread, roti, crusty bread, toasted bread, whole grain bread, nori sheets |
| Cheese | 1 oz | cotija, feta, goat cheese, parmesan, pecorino romano, cheddar, mozzarella, blue cheese, gorgonzola, ricotta |
| Sour cream / yogurt tier | 2 oz | sour cream, Greek yogurt, yogurt, tzatziki, crema, creamy ranch, ranch, spicy mayo |
| Fresh herbs | 1 oz | cilantro, parsley, scallions, green/spring onions, chives, mint, basil, coriander, dill, tarragon, pea shoots, "mixed herbs" / "fresh herbs" |
| Fresh thyme (woody) | 1 tsp | thyme |
| Chips | 28 g | tortilla chips, pita chips, potato chips, croutons |
| Avocado | 1/3 avocado | avocado |
| Olives | 15 g | kalamata, castelvetrano, frescatrano, generic olives |
| Pickled / fermented jalapeño | 2 tbsp | pickled or fermented jalapeño |
| Fresh jalapeño slices | 2 tbsp (15 g) | fresh jalapeño |
| Pickled onion | 28 g | pickled red onion, pickled white onion |
| Pepperoncini | 28 g | peperoncini, pepperoncini |
| Kimchi | 28 g | kimchi |
| Nuts / large seeds | 30 g | almonds, walnuts, pecans, pine nuts, cashews, pistachios, hazelnuts, peanuts, pumpkin seeds, pepitas, sunflower seeds |
| Sesame / hemp / chia / poppy seeds | 1 tsp | sesame seeds (toasted or raw), hemp, chia, poppy seeds |
| Lime / lemon (wedges, zest, juice) | 10 g | limes, lemons, lime/lemon wedges, lime/lemon zest |
| Hot sauce / drizzles | 1 tsp | hot sauce, sriracha, tabasco, chili crisp, chile crisp, chili oil, sesame oil, hoisin sauce, mango chutney |
| Persian cucumber | 1/2 cucumber | persian/baby/mini cucumber, generic cucumber |
| Lettuce / leafy greens | 1/4 cup (18 g) | iceberg, romaine, shredded lettuce, leafy greens, salad greens, mixed greens |
| Radish | 1/2 radish (~2 g) | radish |
| Raw onion | 1 tbsp (15 g) | red/white/yellow onion, generic onion |
| Shallot | 1 tbsp | shallot |
| Cherry / grape tomatoes | 1/4 cup (38 g) | cherry/grape/generic tomatoes |
| Bell pepper (sliced) | 1/4 cup (30 g) | bell peppers, sliced peppers |
| Zucchini ribbons | 200 g | zucchini ribbons |
| Guacamole | 3 tbsp | guacamole |
| Salsa | 3 tbsp | salsa |
| Salt / black pepper / togarashi | (skip — `, to taste`) | salt, kosher salt, sea salt, flaky salt, black pepper, togarashi |

### How to scale (math shortcuts)

- Anything in `cup`s: multiply, round to nearest 1/4 cup
- Anything in `tsp`: keep as tsp up to 12 tsp; convert to tbsp above that; convert to cups above 48 tsp
- Anything in `tbsp`: convert to cups above 16 tbsp
- `oz` and `g`: just multiply
- Pieces (bread/avocado/radish/cucumber): round to nearest whole or 1/4

**Example — recipe with 8 servings, line says "shredded cotija cheese, to garnish":**
1 oz cheese × 8 servings = **8 oz**
→ stored as `8 oz shredded cotija cheese, to garnish`

---

## Conventions to follow when writing a new recipe text

1. **One ingredient per line.** Never smush multiple into a paragraph.
2. **Whole-recipe quantities.** Scale per-serving values × `servings` before saving.
3. **`, to garnish` / `, to serve` suffix** for non-essential / topping items (preferred over the older `for garnish` / `for serving`).
4. **Strip recipe-author commentary** like "(I have also used cottage cheese...)" — store just the ingredient.
5. **Use canonical names** (e.g. `whole peeled tomatoes` not `canned whole peeled tomatoes`).
6. **Drop sub-recipe references** (e.g. "5-minute Enchilada Sauce" should be replaced with the actual ingredients).
7. **For "or" alternatives in garnish lines** — pick the first option; the parser will handle it but cleaner to just store one.
8. **For compound garnish lines** — split into separate stored lines, one per ingredient, each with its own scaled qty.

---

## Tools available in this repo

### Show one recipe's parse status
```
npx tsx scripts/_show_one.ts <recipe_id>
```

### Run the full audit
```
npx tsx scripts/audit_pipeline_health.ts
```
Outputs to `data/audit_summary.json`, `data/audit_low_matchrate_recipes.csv`, etc.

### Write a recipe to Firestore
Pattern: write a one-off `_write_<name>.ts` script in `scripts/`, run via `npx tsx`, then delete it. Example:

```typescript
import * as admin from 'firebase-admin';
import * as path from 'path';
const sa = require(path.join(__dirname, '../service-account.json'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const ingredients = ['<line 1>', '<line 2>', /* ... */];
(async () => {
  await db.collection('recipes').doc('<recipe-id>').update({ ingredients });
  process.exit(0);
})();
```

---

## What was done in the 2026-05-03 garnish pass

- Built a portion-rules table (above) covering ~30 ingredient categories.
- Wrote a categorizer + splitter script that handled compound lines (`"A, B, and C, for serving"` → 3 lines), "or" alternatives (pick first), and "X or Y noun" patterns (e.g. `"steamed white or brown rice"` → `"steamed white rice"`).
- Auto-rewrote all 177 garnish/serving lines across 127 recipes with scaled qtys + new suffix wording.
- 0 lines flagged for manual review.
- Match rate moved 97.4% → 100% after push.

The throwaway scripts (`_scan_garnishes.ts`, `_garnish_preview.ts`, `_garnish_push.ts`) were deleted after the push.

---

## Remaining edge cases (low-priority, not blocking)

The audit shows 11 unmatched ingredients across the whole corpus, each in 1 recipe. They're splitter artifacts on weirdly-written lines:

- `"sort of flatbread or couscous or rice"` (1)
- `"any combination of kimchi"` (1)
- `"pasta- acini de pepe"` (1)
- `"lettuce/cabbage"` (1)
- `"extra fresh dill"` (1)
- `"cooked salmon"` (1)
- Single-character orphans: `"a"`, `"/"`, `"other"` (1 each)

These can be fixed one-off by editing the source recipe text.

---

## Quick continuation checklist for the new session

1. Open this repo: `/Users/rafi/Desktop/Claude-MHC/CKC Recipes /CKC- Recipe Tool/`
2. Run latest audit: `npx tsx scripts/audit_pipeline_health.ts`
3. Check the bottom tier: `head data/audit_low_matchrate_recipes.csv` (currently empty)
4. For any new recipe being added, follow the conventions in **"Conventions to follow"** above.
5. For garnish/serving lines, look up the ingredient in **"Standard per-serving portion rules"** and multiply by `servings`.
