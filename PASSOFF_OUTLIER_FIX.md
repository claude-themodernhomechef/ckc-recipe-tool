# Pass-off — Recipe Nutrition Outlier Fixing

**Date:** 2026-05-04
**State:** 50.7% of recipes within ±10% of Edamam; 502 recipes still >10% off (`data/outlier_table.csv`)
**Goal:** Get nutrition values accurate per Rafi's policies (not necessarily aligned with Edamam)

---

## CRITICAL CONTEXT FOR NEW CHAT

### Architecture (READ FIRST)

```
recipe.ingredients (raw text — never modified)
   ↓
parseIngredient() + splitIngredientLine()  → in ckc-consumer-app/lib/ingredientParser.ts
   ↓
recipe.parsedIngredients (Firestore, written by scripts/write_parsed_ingredients.ts)
   ← PER-RECIPE OVERRIDES land here (with `override: true` flag)
   ↓
scripts/build_recipe_nutrition_v2.ts (computes kcal/protein/etc. → local progress file)
   ↓
data/recipe_nutrition_v2_progress.json (DRAFT — NOT user-facing)
   ↓
scripts/write_recipe_nutrition_v2.js (NOT YET RUN — final push to Firestore)
   ↓
recipe.nutrition (USER-FACING — what consumer app displays)
```

**Where work happens:**
- Parser logic: `ckc-consumer-app/lib/ingredientParser.ts`
- DB: `data/ingredientNutrition_v2.json` (~2,650 entries with per100g + measures)
- Per-recipe overrides: edit `parsedIngredients` on Firestore (not file-based)

### Rafi's Nutrition Policies (DO NOT VIOLATE)

These deliberately diverge from Edamam — that's the point:

1. **Fish defaults to skinless** unless recipe says "skin-on" or "whole fish"
   - DB: `salmon` etc. = 142 kcal/100g (USDA skinless)
   - DB: `skin-on salmon fillet` = 208 kcal/100g (USDA with skin)
2. **Bone-in cuts use edible-portion weight** in `STANDARD_GRAMS`
   - `bone-in chicken thigh` = 120g (edible meat+skin, ~70% of whole-piece)
   - `chicken drumstick` = 55g (edible)
3. **Whole chicken** = 170 kcal/100g (whole-bird-with-bones, edible-adjusted)
4. **Grains stay raw** unless recipe explicitly says "cooked" / "steamed"
   - `white rice` / `basmati rice` = 360 kcal/100g (dry)
   - `cooked rice` / `cooked white rice` = 130 kcal/100g (cooked)
5. **Beans/legumes use cooked values** (most recipes use canned/cooked)
   - `black beans` / `chickpeas` etc. = ~130 kcal/100g (cooked)
6. **Frying oil cap**: when recipe says "for frying" with ≥1 cup oil, count only ~10% absorbed
   - Override `qty` directly on the parsedIngredient (e.g., 2 cup → 0.2 cup)

---

## CURRENT STATE

**Distribution (1,007 recipes with Edamam cross-ref, after filtering Edamam noise):**

| Δ% from Edamam | Count | % |
|---|---|---|
| Within ±10% | 511 | **50.7%** |
| ±10-25% off | ~265 | ~26% |
| ±25-50% off | 172 | ~17% |
| 50-100% off | 51 | ~5% |
| >100% off | 5 | ~0.5% |

**Median absolute delta:** 10%. **Mean:** 18%.

---

## THE OUTLIER TABLE — `data/outlier_table.csv`

This is the working list. Open in Numbers/Excel.

**Columns:**
- `rank` — sorted by |Δ%| worst-first
- `pct_diff` — signed Δ% (we vs Edamam, per-serving kcal)
- `direction` — OVER or UNDER
- `recipe_id` / `recipe_name` / `servings`
- `ours_kcal_per_serv` / `edamam_kcal_per_serv`
- `top_ing_1/2/3` — the 3 ingredients contributing most kcal in our calc
- `kcal_1/2/3` — their kcal contributions (whole recipe)
- `raw_1/2/3` — the original recipe text

**Categorize each outlier as:**

1. **Real bug we own** — our calc is wrong, fixable in parser/DB/override
2. **Edamam noise** — Edamam value is impossible/missing major ingredients (we leave alone)
3. **Deliberate divergence** — our policy rules deviate from Edamam (skinless fish, dry rice) — we leave alone
4. **Recipe-text issue** — the Firestore `ingredients[]` is missing / unclear / outdated — needs source-text edit

---

## TOOLS YOU'LL USE

```bash
# Regenerate the outlier table (after any fix + re-run):
npx tsx scripts/_build_outlier_table.ts

# View the parsedIngredients for a specific recipe:
npx tsx scripts/_view_parsed.ts <recipe_id>

# View the nutrition breakdown (qty, grams, kcal per ingredient):
npx tsx scripts/_show_breakdown.ts <recipe_id>

# Apply a per-recipe override to parsedIngredients on Firestore:
npx tsx scripts/_override_parsed.ts <recipe_id> <index> qty <new_qty>
npx tsx scripts/_override_parsed.ts <recipe_id> <index> skip "<reason>"
npx tsx scripts/_override_parsed.ts <recipe_id> <index> set '{"qty":2,"unit":"oz","name":"X"}'
# (override:true flag is set automatically — preserved across re-runs)

# Re-write parsedIngredients to Firestore (after parser changes, preserves overrides):
npx tsx scripts/write_parsed_ingredients.ts

# Run the nutrition build (writes to local progress, NOT Firestore):
echo "{}" > data/recipe_nutrition_v2_progress.json
npx tsx scripts/build_recipe_nutrition_v2.ts

# Show distribution + top outliers:
npx tsx scripts/_show_outliers_filtered.ts
```

---

## WORKFLOW TEMPLATE (per outlier)

```
1. Open data/outlier_table.csv → pick a row
2. Run: npx tsx scripts/_view_parsed.ts <recipe_id>
3. Run: npx tsx scripts/_show_breakdown.ts <recipe_id>
4. Identify which line(s) are wrong + why:
   - Wrong qty/unit extraction? → parser bug
   - Wrong DB nutrition values? → DB entry fix
   - Recipe text ambiguous/wrong? → Firestore ingredient edit OR per-recipe override
   - Edamam noise? → leave alone (skip)
   - Policy divergence? → leave alone (skip)
5. Apply fix:
   - Parser bug: edit ckc-consumer-app/lib/ingredientParser.ts → re-run write_parsed_ingredients
   - DB entry: edit data/ingredientNutrition_v2.json directly (or via small one-off script)
   - Per-recipe override: npx tsx scripts/_override_parsed.ts ...
6. Re-run nutrition build: echo "{}" > data/recipe_nutrition_v2_progress.json && npx tsx scripts/build_recipe_nutrition_v2.ts
7. Verify: npx tsx scripts/_show_breakdown.ts <recipe_id>
8. Commit + push
```

---

## COMMON BUG PATTERNS (from this session)

### Parser-level bugs (when you find one, fix in ingredientParser.ts):
- "X T flour" / "X t salt" / "X c onion" — capital-T tablespoon, lowercase-t teaspoon, c cup (case-sensitive)
- "1 (4-5 pound) beef tenderloin" — count + paren weight + noun
- "1 3.5-4 lb chicken" — count + range weight + noun (no container word)
- "1 X (about N lb)" — count + noun + paren weight
- "4 6-ounce salmon fillets" — count + per-piece weight + adj/noun + portion-word
- "1 1/2-2 lbs" mixed-number range — was reading as 0.5
- "1.6-2.2kg / 3.2-4.4lb" range with dual units
- "(2 x .75 ounce packages)" multi-pack — multiply N × M
- ".75 oz" decimal-eating bug (lookbehind required)
- "(about 12 ounces)" — paren-weight with hedging word

### DB-level bugs (Edamam mislabels — fix per100g values):
- `russet potato` was 24 kcal/100g (should be ~79 raw)
- `lasagna noodles` Serving=300g (should use Noodle=25g for count-based)
- Beans labeled raw but used cooked in recipes (~340 → ~130)
- `cooked rice` labeled with raw values
- Tuna `Can` defaulted to 425g (should be 142g for 5oz can)
- Wonton strips/croutons/tortilla chips Cup default 240g (should be ~30g for airy snacks)
- Bread Cup measure 240g (should be ~30g for cubed/torn)

### `STANDARD_GRAMS` (per-piece weights in build_recipe_nutrition_v2.ts):
- Watch for substring-match collisions ("corn" matched "mini corn tortillas" → wrong weight)
- Fix: longest-key-first sort in partial match (already done at line ~501)
- Russet potato should be 160g (per Rafi)
- Cashew = 1.5g, almond = 1.2g, walnut = 4g, pistachio = 0.7g per piece

---

## WHAT TO DO NEXT (PROMPT FOR NEW CHAT)

Paste this into the new chat:

```
I'm continuing work on the CKC Recipe Tool nutrition pipeline. Current state:
- 50.7% of 1,007 recipes within ±10% of Edamam
- 502 recipes need attention (in data/outlier_table.csv)

Read PASSOFF_OUTLIER_FIX.md first. Then process data/outlier_table.csv:

For each outlier (worst-first by abs Δ%):
1. View parsedIngredients on Firestore: npx tsx scripts/_view_parsed.ts <id>
2. View breakdown: npx tsx scripts/_show_breakdown.ts <id>
3. Categorize: real bug / Edamam noise / policy divergence / recipe-text issue
4. For real bugs:
   - Parser bug → fix ingredientParser.ts, re-run write_parsed_ingredients
   - DB issue → edit data/ingredientNutrition_v2.json
   - Recipe-specific → use _override_parsed.ts to set override on parsedIngredients
5. After each batch of fixes:
   - npx tsx scripts/write_parsed_ingredients.ts (preserves overrides)
   - echo "{}" > data/recipe_nutrition_v2_progress.json
   - npx tsx scripts/build_recipe_nutrition_v2.ts
   - npx tsx scripts/_build_outlier_table.ts (regenerates the table)

CRITICAL POLICIES (don't violate):
- Fish skinless by default (unless recipe says skin-on/whole)
- Bone-in chicken uses edible-portion weight
- Grains raw unless "cooked"/"steamed"
- Beans/legumes cooked (recipes use them cooked ~95% of the time)
- Frying oil 10% absorption (when "for frying" + ≥1 cup oil)

Push to Firestore (final step) is via scripts/write_recipe_nutrition_v2.js — DO NOT run until I approve.

Start by drilling the top 5 outliers in outlier_table.csv. For each, tell me your diagnosis (bug/noise/divergence/text) and proposed fix before applying.
```

---

## FILES THE NEW CHAT NEEDS

The new Claude session has access to all files in this repo. Specifically:

**Required reading (in order):**
1. `PASSOFF_OUTLIER_FIX.md` (this file)
2. `data/outlier_table.csv` (the work list — open in spreadsheet)
3. `CLAUDE.md` (repo structure)

**Code to understand:**
4. `ckc-consumer-app/lib/ingredientParser.ts` (parser — large)
5. `scripts/build_recipe_nutrition_v2.ts` (build pipeline)
6. `scripts/write_parsed_ingredients.ts` (parsedIngredients writer)
7. `scripts/_override_parsed.ts` (override tool)

**Reference data:**
8. `data/ingredientNutrition_v2.json` (~2,650 entries)
9. `data/recipe_nutrition_v2_progress.json` (current nutrition values — local draft)

---

## OPEN QUESTIONS / UNRESOLVED

- ~30 outliers are **Edamam errors** we can't fix (impossible Edamam values like 19,381 kcal/serving). Should we add an `acceptable: true` flag to mark them as reviewed-and-accepted?
- ~80 outliers are **deliberate policy divergences** (skinless fish drops Edamam delta -25-30% on every salmon recipe). The match% is misleading because of these.
- Some recipes have **stale Firestore data** (recipe was updated on source site). The user noted `slow-baked-salmon-butter-beans` lost its butter beans component — Firestore needs to be re-scraped from source URL.

---

## SESSION HIGHLIGHTS (CUMULATIVE)

Session went from **49% within ±10%** → **50.7%**, top outliers from **80 → 20**.

Approximately 40+ specific bugs fixed. Sample wins:
- BBQ Chicken: -77% → -4%
- Chicken Kurma: +91% → -1%
- Beef Tenderloin: -68% → -7%
- Lamb Shoulder: -81% → fixed
- Sticky Chicken Thighs: +841% → +6% (one specific parser bug)
- Lasagna noodles: 9 × 300g → 9 × 25g (size-class fix)
