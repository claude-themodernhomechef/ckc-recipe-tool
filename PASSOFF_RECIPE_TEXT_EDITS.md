# Pass-off — Recipe Text Edits & Garnish/Per-Serving Logic

**Date:** 2026-05-03
**Session ending state:** match rate 96%, 3 recipes still under 80%

---

## Where we are

After 30+ rounds of parser/alias work + 2 recipe-text edits, the codebase is at:
- **Match rate:** 96% (13,948 / 14,517 ingredients)
- **Distribution:**
  - 100%: 632 recipes (+65 from session start)
  - 80–99%: 438
  - 50–79%: 4 (was ~30)
  - <50%: 0 (was 18)

We pivoted from parser improvements to **recipe-text edits** for the last stuck recipes. Two recipes have been edited so far:
- ✅ **Goodbye Meatballs** (50% → 100%) — split smushed paragraph into 16 lines
- ✅ **Easy Chicken Enchiladas** (60% → 100%) — split into 13 lines, garnishes scaled × 8 servings

---

## The two key formats to remember

### 1. Garnishes — `, for garnish` suffix

Every garnish ingredient should be stored as one line with `, for garnish` at the end:

```
1 cup sour cream, for garnish
2 avocados, for garnish
1/2 cup fresh cilantro, for garnish
```

What this does:
- **Shopping list** displays: `to garnish | sour cream` (qty hidden, marker shown)
- **Nutrition layer** reads: `qty=1, unit=cup, name="sour cream"` (used for math)
- **One stored line carries both views.**

Same pattern for `, for serving` (e.g. accompaniments) and `, to taste`.

### 2. Quantities are **whole recipe**, not per-serving

The nutrition pipeline assumes the qty in each ingredient line is for the **whole recipe**, then divides by `servings` to get per-serving values. So when you write a garnish line, if you're thinking "1 tbsp cilantro per plate," you need to scale up by the recipe's servings count.

**Example — Easy Chicken Enchiladas (servings = 8):**

| Per-serving (what you might think)     | Whole recipe (× 8) — what to STORE |
|----------------------------------------|------------------------------------|
| 2 tbsp sour cream                      | 1 cup sour cream                   |
| 1/4 avocado                            | 2 avocados                         |
| 1 tbsp fresh cilantro                  | 1/2 cup fresh cilantro             |
| 1 tbsp fresh scallions                 | 1/2 cup fresh scallions            |
| 1 tbsp pickled jalapeno                | 1/2 cup pickled jalapeno           |
| 1 tbsp pickled onions                  | 1/2 cup pickled onions             |

Conversion shortcuts:
- 1 tbsp × 8 = 8 tbsp = **1/2 cup**
- 2 tbsp × 8 = 16 tbsp = **1 cup**
- 1/4 × 8 = **2** (whole units)

---

## Recipes still to address

### Stuck recipes (<80%, in priority order)

| Recipe | Match | Action needed |
|--------|-------|---------------|
| How to Cook Jasmine Rice | 75% | Tutorial recipe with duplicate lines + "MINUS 2 tbsp water" math expression. Pick one cooking method or simplify. |
| Garlic Caper Lamb Chop With Tomato Burrata Peach Salad | 78% | Likely has compound ingredient lines that need splitting. |
| Grilled Broccolini | 80% | Edge of bottom tier; one or two unmatched. |

### Recipes already edited that may need a garnish/scaling audit

These had garnish-list lines but they were NOT manually re-verified for per-serving scaling. The parser's automatic garnish-list splitter handled them, but the qtys may still be per-serving from the original recipe text:

- (none flagged so far — both edited recipes had main-ingredient lines, the Enchiladas was the only one with garnishes that needed scaling)

### Future scope — recipes with "for garnish" / "for serving" lines that came through the auto-splitter

The parser's `garnish-list` splitter (in `splitIngredientLine`) auto-tags `optional garnishes: A, B, C` lines as `<each>, for garnish` — but the qtys in those original lines were typically **omitted entirely** (recipe authors say "scallions" not "1 tbsp scallions"). So nutrition will undercount these. If you want accurate nutrition for garnishes across the full corpus, you'd need to:

1. Identify recipes with auto-split garnish lines
2. Decide a default per-serving garnish portion (e.g. 1 tbsp herbs, 1/4 avocado)
3. Multiply by servings
4. Rewrite those lines with explicit qtys

This is a separate, larger-scope task — not blocking the bottom-tier cleanup.

---

## Tools available in this repo

### Show one recipe's parse status
The script `scripts/_show_one.ts` shows match status per ingredient line. Pass the recipe ID:
```
npx tsx scripts/_show_one.ts <recipe_id>
```
Output marks each line with ✓ (matched), ✗ (unmatched), or ○ (skipped).

### Run the full audit
```
npx tsx scripts/audit_pipeline_health.ts
```
Outputs to `data/audit_summary.json`, `data/audit_low_matchrate_recipes.csv`, etc.

### Write a recipe to Firestore
Pattern (write a one-off `_write_<name>.ts` script in `scripts/`, run via `npx tsx`, then delete the script). Example used for Goodbye Meatballs / Enchiladas:

```typescript
import * as admin from 'firebase-admin';
import * as path from 'path';
const sa = require(path.join(__dirname, '../service-account.json'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const ingredients = [
  '<line 1>',
  '<line 2>',
  // ...
];
(async () => {
  const ref = db.collection('recipes').doc('<recipe-id>');
  await ref.update({ ingredients });
  process.exit(0);
})();
```

---

## Conventions to follow when writing a new recipe text

1. **One ingredient per line.** Never smush multiple into a paragraph.
2. **Whole-recipe quantities.** Scale per-serving values × `servings` before saving.
3. **`, for garnish` / `, for serving` suffix** for non-essential / topping items.
4. **Strip recipe-author commentary** like "(I have also used cottage cheese...)" — store just the ingredient.
5. **Use canonical names where possible** (e.g. `whole peeled tomatoes` not `canned whole peeled tomatoes` — the alias map handles common variants but cleaner names always match).
6. **Drop sub-recipe references** (e.g. "5-minute Enchilada Sauce" in the Enchiladas was replaced — it pointed to another recipe and was unmatchable).

---

## Aliases added this session (high-frequency)

For reference if you're auditing the alias coverage. All in `INGREDIENT_ALIASES` in `ckc-consumer-app/lib/ingredientParser.ts`:

- Common variants → canonical:
  - `pepitas` → `pumpkin seeds`
  - `cornflour` → `cornstarch`
  - `worcestershire` → `worcestershire sauce`
  - `half & half` / `half-and-half` → `half-and-half`
  - `natural yoghurt` / `yoghurt` → `yogurt`
  - `90% lean ground beef` / `93% lean ground turkey` → `ground beef` / `ground turkey`
  - `mini cucumbers` / `baby cucumbers` / `persian cucumbers` → `cucumber`
  - `tamari/soy sauce` / `tamari` → `soy sauce`
  - `red boat fish sauce` → `fish sauce`
  - `chunky red salsa` → `salsa`
  - `bbq sauce of choice` → `bbq sauce`
  - `prepared rice` / `cooked rice` / `steamed white rice` → `white rice`
  - `firm white fish` → `white fish`
  - `green cardamoms` → `cardamom`
  - `tajin powder` → `tajin`
  - `better than bouillon X base` → `X broth`
  - `canned X beans` → `X beans` (chickpeas, kidney, pinto, cannellini, navy, black)
  - `whole milk full-fat ricotta cheese` → `ricotta cheese`
  - `grated parmesan cheese` → `parmesan cheese`
  - `shredded cotija cheese` / `shredded cotija` → `cotija cheese`
  - `salt + pepper` → `salt`
  - `6/8/10-inch tortillas` → `corn/flour tortillas`
  - `frescatrano olives` → `castelvetrano olives`
  - `baby creamer potato` → `yukon gold potato`
  - `pure clam juice` → `clam juice`
  - `skinless halibut/cod/salmon` → noun
  - `frozen sweet peas` → `frozen peas`
  - `grassfed ground beef` → `ground beef`
  - `dried poultry blend` → `poultry seasoning`
  - `mixed herbs` → `fresh herbs`
  - `head red cabbage` / `head cabbage` → `red cabbage` / `cabbage`
  - `canned tomatoes` / `canned whole peeled tomatoes` → `whole peeled tomatoes`

If a recipe has an unmatched ingredient that's clearly a real ingredient with a different name in the nutrition DB, add an alias rather than editing the recipe text.

---

## Quick continuation checklist for the new session

1. Open this repo: `/Users/rafi/Desktop/Claude-MHC/CKC Recipes /CKC- Recipe Tool/`
2. Run latest audit: `npx tsx scripts/audit_pipeline_health.ts`
3. Check the bottom tier: `head data/audit_low_matchrate_recipes.csv`
4. For each stuck recipe, run `npx tsx scripts/_show_one.ts <recipe_id>` to see what's failing
5. Decide: alias fix vs recipe-text edit
6. After any change, re-audit to confirm match rate moved
7. Commit + push after each round (check git log for message style)
