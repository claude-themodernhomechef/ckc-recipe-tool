# CKC Shopping List: Final Build Plan

## Summary

Move all ingredient parsing, matching, and categorization OUT of shopping.html and INTO the Claude agent that imports recipes. The agent reads the Items sheet, matches each raw ingredient string to a canonical name and category, and writes clean structured data to ingredients.json. Shopping.html becomes a dumb aggregator that just sums quantities by name.

---

## What Changes

### ingredients.json format change

**Current format** (raw strings):
```json
{
  "Carne Asada Tacos": [
    "1/2 cup lime juice ((from 3 limes))",
    "2 teaspoons ground cumin",
    "2 pounds skirt steak"
  ]
}
```

**New format** (pre-parsed objects):
```json
{
  "Carne Asada Tacos": [
    { "name": "lime juice", "qty": 0.5, "unit": "cup", "category": "produce", "raw": "1/2 cup lime juice ((from 3 limes))" },
    { "name": "cumin", "qty": 2, "unit": "tsp", "category": "pantry", "raw": "2 teaspoons ground cumin" },
    { "name": "skirt steak", "qty": 2, "unit": "lb", "category": "protein", "raw": "2 pounds skirt steak" }
  ]
}
```

Each ingredient object has:
- `name`: canonical name from the Items sheet (what you'd write on a grocery list)
- `qty`: numeric quantity (fractions converted to decimals)
- `unit`: standardized unit (tsp, tbsp, cup, oz, lb, g, clove, bunch, can, etc.)
- `category`: one of protein, produce, dairy, pantry (lowercase, matching the Items sheet)
- `raw`: the original string, kept for debugging and display

### shopping.html simplification

The entire parsing/matching/categorizing engine gets removed. `aggregateIngredients()` becomes:

```javascript
function aggregateIngredients() {
  const map = new Map();

  for (const { recipe, servings } of menuItems) {
    const ings = ingredients[recipe.name] || [];
    for (const ing of ings) {
      // If old format (string), skip or handle gracefully
      if (typeof ing === 'string') continue;

      const key = ing.name;
      if (!key || key.length < 2) continue;

      if (!map.has(key)) {
        map.set(key, {
          name: key,
          category: ing.category || 'pantry',
          unitQtys: {},
          sources: []
        });
      }

      const entry = map.get(key);
      const u = ing.unit || 'count';
      entry.unitQtys[u] = (entry.unitQtys[u] || 0) + (ing.qty || 0) * servings;
      if (!entry.sources.includes(recipe.name)) entry.sources.push(recipe.name);
    }
  }

  return map;
}
```

**What gets removed from shopping.html:**
- `CATEGORIES[].words` arrays (the massive keyword lists)
- `PANTRY_FORCE` array
- `STOP_WORDS` array
- `FRACTION_MAP` and `parseQty()`
- `UNITS` object
- `parseIngredient()` function
- `categorizeIngredient()` function
- All the regex parsing logic

**What stays:**
- `aggregateIngredients()` (simplified version above)
- `buildShoppingList()` (renders the HTML, mostly unchanged)
- `fmtQty()` (formats numbers for display)
- `CATEGORIES` array (just for icons and labels, no words needed)
- All the UI interaction code (check/uncheck, copy, print, etc.)

---

## The Claude Agent's New Job

When the agent adds a recipe to the system, it needs to:

1. **Get the raw ingredient strings** (from the blog scrape or however recipes enter now)
2. **Read the Items sheet** to know canonical names and categories
3. **For each raw string, produce a structured object:**
   - Parse out quantity and unit
   - Strip descriptors (chopped, diced, fresh, etc.)
   - Match the cleaned name against the Items sheet
   - If no match, flag it as unknown (category: "pantry" as default)
4. **Write the structured array to ingredients.json** under the recipe name

### Prompt guidance for the agent

The agent prompt should include something like:

```
When processing a recipe's ingredients, convert each raw ingredient string 
into a structured object with these fields:

- name: The canonical grocery item name. Use the Items sheet as your lookup. 
  "2 tablespoons finely chopped flat-leaf parsley" becomes "parsley".
  "1/2 cup low-sodium chicken broth" becomes "chicken broth".
  "Freshly ground black pepper" becomes "black pepper".
  Strip all preparation methods, size descriptors, and brand names.
  
- qty: The numeric quantity. Convert fractions to decimals.
  "1/2" = 0.5, "1 1/2" = 1.5, "3/4" = 0.75
  For ranges like "2-3", use the higher number.
  For "to taste" or no quantity, use 0.
  
- unit: The standardized measurement unit. Use these abbreviations:
  tsp, tbsp, cup, oz, lb, g, kg, ml, clove, bunch, can, pkg, 
  slice, sprig, stalk, pinch, dash, piece, head, count (for whole items)
  
- category: One of: protein, produce, dairy, pantry
  Use the Items sheet category. If not in the Items sheet, use your best 
  judgment based on where you'd find it in a grocery store.
  
- raw: The original string, unchanged.

Skip garnish-only items like "for serving" or "optional, for garnish" 
unless they have a meaningful quantity.

If an ingredient has sub-recipes (like "1 cup Chimichurri Sauce, 
homemade or store-bought"), either break it into components or list it 
as a single item depending on context.
```

### Giving the agent access to the Items sheet

Two options:

**Option A (simpler): Export Items sheet to a reference file**
Run `exportItemsToJson()` from your Apps Script (the function from the earlier doc). Save the resulting file somewhere the agent can read it. Include it as context in the agent prompt or as a reference file.

**Option B (live access): Connect the agent to Google Sheets**
If the agent can read Google Sheets directly, point it at the Items sheet. This means it always has the latest data.

Either way, the agent needs the Items sheet data so it can match "flat-leaf parsley" to "parsley" and know the category is "Produce."

---

## Backfill Plan for 300+ Existing Recipes

You have 300+ recipes already in ingredients.json with raw strings. These need to be converted to the new format.

### Approach: Batch processing with Claude

1. Export the Items sheet to JSON (one-time reference)
2. Feed Claude batches of 20-30 recipes at a time from the current ingredients.json
3. For each batch, Claude converts all raw strings to structured objects
4. Output the converted batch in the new format
5. Merge all batches back into one ingredients.json

### Batch prompt template:

```
Here is the Items sheet reference (canonical names and categories):
[items.json contents]

Here are recipes to convert. For each raw ingredient string, 
produce a structured object with name, qty, unit, category, and raw.

[paste 20-30 recipes from current ingredients.json]

Return the converted recipes in the same JSON structure, 
with arrays of objects instead of arrays of strings.
```

### Handling recipes with empty arrays

About half the recipes in your file have `[]` (no ingredients scraped). These stay as empty arrays. The agent can fill them in later when the ingredient data becomes available (either through scraping or manual entry).

### Quality check

After the backfill, spot-check 10-15 recipes by adding them to the shopping list and verifying:
- Parsley variants all merge into one "parsley" line
- Black pepper is in Pantry, not Produce
- Chicken broth is in Pantry, not Protein
- Bell peppers are in Produce
- Quantities sum correctly across recipes
- "To taste" items show up without a quantity

---

## Implementation Order

1. **Export Items sheet to JSON** (reference file for the agent)
2. **Write the agent prompt additions** (ingredient parsing instructions)
3. **Backfill existing recipes** (batch convert 300+ recipes)
4. **Update ingredients.json** with the new structured format
5. **Simplify shopping.html** (swap in the new aggregateIngredients, remove parsing code)
6. **Test with real menus** (add 4-5 recipes, verify the shopping list)
7. **Set up ongoing flow** (agent converts new recipes at import time going forward)

---

## Edge Cases the Agent Should Handle

These are patterns I saw in your actual ingredients.json data:

**Double parentheticals:** `"1/2 cup lime juice ((from 3 limes))"` 
Agent should strip `((from 3 limes))` and parse qty=0.5, unit=cup, name=lime juice

**Nested options:** `"1 lb ground beef ((or ground chicken, or turkey))"`
Agent should use the primary ingredient: name=ground beef

**"Or" alternatives:** `"1 cup coconut milk or heavy cream"`
Agent should pick the first option: name=coconut milk

**Garnish markers:** `"Chopped Chives (for garnish)"`
Agent should include it but with qty=0: name=chives, qty=0, unit=count

**Compound items:** `"Salt and freshly ground black pepper"`
Agent should split into two entries: salt (qty=0) and black pepper (qty=0)

**"To taste" / "as needed":** `"Kosher salt (to taste)"`
qty=0, name=salt

**Sub-recipe references:** `"1 cup Chimichurri Sauce, homemade or store-bought"`
Agent can either list as "chimichurri sauce" (single item) or skip it

**Price annotations:** `"1 Tbsp olive oil ($0.22)"`
Strip the price, parse normally

**HTML entities:** `"&frac14; teaspoon ground black pepper"` or `"&#8211;"`
Agent should decode these before parsing

**Descriptive quantities:** `"Small bunch cilantro (diced)"`
qty=1, unit=bunch, name=cilantro

**Section headers mixed in:** Some recipes have headers like "For the sauce:" mixed into the ingredient list. Agent should skip these.

---

## What This Fixes

**Problem 1 (ingredients not combining):** Solved at the source. The agent maps "chopped parsley," "flat-leaf parsley," "Italian parsley," and "finely chopped fresh parsley" all to "parsley" before the data ever reaches shopping.html. One canonical name = one line on the shopping list.

**Problem 2 (wrong categories):** Solved at the source. The Items sheet says "black pepper" is Pantry and "bell pepper" is Produce. The agent reads the sheet and assigns the correct category. No keyword guessing.

**Bonus: Simpler code.** Shopping.html drops from ~860 lines to roughly 500. All the complex parsing logic goes away. Easier to maintain, faster to load, fewer bugs.
