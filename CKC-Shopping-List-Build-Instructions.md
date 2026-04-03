# CKC Shopping List: Build Instructions

## What This Fixes

Two core problems with the current `shopping.html` shopping list:

1. **Ingredients that should combine aren't combining.** "Chopped parsley" and "parsley" create two separate line items. At the store, you're buying parsley once.
2. **Ingredients land in the wrong grocery category.** "Black pepper" shows up under Produce (matching the broad keyword "pepper"). "Chicken broth" shows up under Protein (matching "chicken").

Both problems stem from the same two areas of the code: the **name normalization pipeline** (how ingredient strings get cleaned into a canonical key) and the **categorization logic** (how the cleaned name gets sorted into a grocery aisle).

---

## Problem 1: Ingredients Not Combining

### Root Cause

The current `parseIngredient()` function strips STOP_WORDS (like "chopped," "diced," "minced") from the ingredient name. That part works. But descriptors that AREN'T in the stop words list create different keys that never merge.

**Example:** Three recipes contribute these raw strings:
- `"1/4 cup chopped parsley"` → cleaned to `"parsley"` ✓
- `"2 tbsp flat-leaf parsley"` → cleaned to `"flat-leaf parsley"` ✗
- `"1 tbsp Italian parsley, finely minced"` → cleaned to `"italian parsley"` ✗

You end up with three line items for parsley instead of one.

### Fix: Two-Layer Name Normalization

#### Layer 1: Expand the stop words list

Add these categories of words that the current STOP_WORDS list is missing:

```
// Preparation methods (beyond chop/dice/mince)
'torn', 'trimmed', 'julienned', 'cubed', 'zested', 'deveined', 'deboned',
'pitted', 'cored', 'seeded', 'deseeded', 'blanched', 'seared',
'caramelized', 'roasted', 'toasted', 'grilled', 'charred', 'smoked',
'pickled', 'marinated', 'brined', 'cured'

// Size/shape descriptors
'thin', 'thick', 'fine', 'finely', 'coarsely', 'roughly', 'thinly',
'bite-sized', 'bite-size', 'inch-thick'

// Temperature/state
'warm', 'hot', 'cold', 'chilled', 'thawed', 'at room temperature'

// Qualifiers that don't change what you buy
'good', 'quality', 'best', 'organic', 'store-bought', 'homemade',
'low-sodium', 'unsweetened', 'reduced-fat', 'full-fat', 'light',
'dark', 'raw', 'uncooked', 'cooked', 'leftover', 'day-old',
'plus more for garnish', 'for garnish', 'for serving', 'for topping',
'as needed', 'to coat'
```

#### Layer 2: Add a synonym/alias map

After stripping stop words, run the cleaned name through a lookup table that collapses known variants into one canonical name. This is the most important fix.

```javascript
const INGREDIENT_ALIASES = {
  // Herbs
  'flat-leaf parsley': 'parsley',
  'italian parsley': 'parsley',
  'curly parsley': 'parsley',
  'thai basil': 'basil',
  'sweet basil': 'basil',
  'holy basil': 'basil',
  'fresh cilantro': 'cilantro',
  'coriander leaves': 'cilantro',
  'coriander': 'cilantro',
  'fresh dill': 'dill',
  'dill weed': 'dill',
  'fresh mint': 'mint',
  'spearmint': 'mint',
  'fresh thyme': 'thyme',
  'thyme leaves': 'thyme',
  'thyme sprig': 'thyme',
  'rosemary sprig': 'rosemary',
  'fresh rosemary': 'rosemary',
  'sage leaf': 'sage',
  'fresh sage': 'sage',

  // Onion family
  'green onion': 'scallion',
  'spring onion': 'scallion',
  'scallions': 'scallion',
  'green onions': 'scallion',

  // Garlic
  'garlic clove': 'garlic',
  'garlic cloves': 'garlic',

  // Citrus
  'lemon juice': 'lemon',
  'lime juice': 'lime',
  'orange juice': 'orange',
  'lemon zest': 'lemon',
  'lime zest': 'lime',
  'orange zest': 'orange',

  // Pepper (the spice, not the vegetable)
  'black pepper': 'black pepper',
  'white pepper': 'white pepper',
  'cracked pepper': 'black pepper',
  'cracked black pepper': 'black pepper',
  'ground pepper': 'black pepper',
  'ground black pepper': 'black pepper',
  'freshly cracked pepper': 'black pepper',
  'freshly ground pepper': 'black pepper',
  'freshly ground black pepper': 'black pepper',
  'pepper': 'black pepper',  // bare "pepper" in a recipe almost always means black pepper

  // Common consolidations
  'extra virgin olive oil': 'olive oil',
  'extra-virgin olive oil': 'olive oil',
  'evoo': 'olive oil',
  'kosher salt': 'salt',
  'sea salt': 'salt',
  'fine salt': 'salt',
  'flaky salt': 'salt',
  'table salt': 'salt',
  'coarse salt': 'salt',
  'sushi rice': 'white rice',
  'jasmine rice': 'white rice',
  'basmati rice': 'white rice',
  'long grain rice': 'white rice',

  // Dairy
  'unsalted butter': 'butter',
  'salted butter': 'butter',

  // Oils
  'vegetable oil': 'neutral oil',
  'canola oil': 'neutral oil',
  'grapeseed oil': 'neutral oil',
  'avocado oil': 'neutral oil',
};
```

**Important decision:** Some of these aliases are opinionated. You might NOT want to merge "lemon juice" and "lemon zest" into just "lemon" because someone might need both and they're different parts of the fruit. Same with different rice varieties. Decide which merges make sense for how your users actually shop. The alias map is easy to adjust.

#### Layer 3: Normalize the name AFTER alias lookup

After alias resolution, also do these final cleanups:
- Strip trailing "s" for simple plurals (but be careful: "hummus" shouldn't become "hummu")
- Remove articles: "a," "an," "the"
- Collapse whitespace

```javascript
function normalizeName(rawName) {
  let name = rawName.toLowerCase().trim();

  // 1. Strip stop words
  name = name.split(/\s+/)
    .filter(w => !STOP_WORDS.includes(w))
    .join(' ')
    .trim();

  // 2. Check alias map (try full name first, then progressively shorter)
  if (INGREDIENT_ALIASES[name]) {
    name = INGREDIENT_ALIASES[name];
  }

  // 3. Remove articles
  name = name.replace(/^(a|an|the)\s+/i, '');

  // 4. Final whitespace cleanup
  name = name.replace(/\s+/g, ' ').trim();

  return name;
}
```

### Where to plug this in

In `parseIngredient()`, replace the current name-cleaning block (lines 603-613) with a call to `normalizeName()`. The key used in `aggregateIngredients()` (line 646) will then be the canonical name, and matching ingredients will properly combine.

---

## Problem 2: Wrong Categories

### Root Cause

Two issues working together:

**Issue A: The produce keyword list is too greedy.** It includes broad terms like `'pepper'`, `'corn'`, `'ginger'`. So "black pepper" (a pantry spice) matches "pepper" in produce. "Corn starch" would match "corn." The word-boundary matching (line 515) checks if the keyword appears anywhere in the name, which catches too many false positives.

**Issue B: PANTRY_FORCE doesn't cover spices.** The override list catches things like "chicken broth" (via "broth") and "sesame oil" (via "oil"), but it doesn't include common spices by name. So "black pepper," "white pepper," "ground cumin," etc. fall through to the produce/protein keyword matcher.

### Fix: Add a Spice/Seasoning Force List

Create a `SPICE_FORCE` list (or merge it into `PANTRY_FORCE`) that explicitly catches common spices and seasonings before the produce keyword matcher runs:

```javascript
const SPICE_FORCE = [
  'black pepper', 'white pepper', 'ground pepper', 'cracked pepper',
  'pepper flake', 'red pepper flake', 'crushed red pepper',
  'cayenne', 'paprika', 'smoked paprika',
  'cumin', 'ground cumin',
  'coriander seed', 'ground coriander',
  'cinnamon', 'ground cinnamon',
  'nutmeg', 'ground nutmeg',
  'cardamom', 'ground cardamom',
  'turmeric', 'ground turmeric',
  'ginger powder', 'ground ginger',
  'garlic powder', 'onion powder',
  'chili powder', 'ancho chili powder',
  'oregano', 'dried oregano', 'dried thyme', 'dried basil',
  'dried rosemary', 'dried parsley', 'dried dill',
  'bay leaf', 'bay leaves',
  'clove', 'ground clove', 'whole clove',
  'allspice', 'ground allspice',
  'fennel seed', 'mustard seed', 'celery seed', 'caraway seed',
  'sumac', 'za\'atar', 'garam masala', 'curry powder',
  'old bay', 'everything bagel seasoning',
  'italian seasoning', 'herbs de provence',
  'tajin', 'msg', 'nutritional yeast',
];
```

### Fix the categorization order

Update `categorizeIngredient()` to check in this order:

1. **SPICE_FORCE** check first (exact match or "contains" on the cleaned name)
2. **PANTRY_FORCE** check second (existing logic)
3. **Protein keywords** third
4. **Produce keywords** fourth
5. **Dairy keywords** fifth
6. **Pantry** as the catch-all

```javascript
function categorizeIngredient(name) {
  const lower = name.toLowerCase();

  // 1. Spices/seasonings: always pantry
  for (const kw of SPICE_FORCE) {
    if (lower === kw || lower.includes(kw)) return 'pantry';
  }

  // 2. Pantry-force (broth, oil, sauce, flour, etc.)
  for (const kw of PANTRY_FORCE) {
    if (lower.includes(kw)) return 'pantry';
  }

  // 3. Check Protein → Produce → Dairy
  for (const cat of CATEGORIES.filter(c => c.key !== 'pantry')) {
    for (const kw of cat.words) {
      if (lower === kw ||
          lower.startsWith(kw + ' ') ||
          lower.endsWith(' ' + kw) ||
          lower.includes(' ' + kw + ' ')) {
        return cat.key;
      }
      if (lower.startsWith(kw)) return cat.key;
    }
  }

  return 'pantry';
}
```

### Fix the produce keyword list

Remove overly broad terms from the produce `words` array that commonly collide with pantry items:

**Remove or make more specific:**
- `'pepper'` → replace with `'bell pepper'`, `'green pepper'`, `'red pepper'`, `'yellow pepper'` (keep the specific ones that are already there)
- `'corn'` → replace with `'corn on the cob'`, `'sweet corn'`, `'fresh corn'`
- `'ginger'` → keep `'ginger root'` and `'fresh ginger'`, remove bare `'ginger'` (since "ground ginger" is a spice)
- `'turmeric root'` → keep as-is, but make sure `'turmeric'` alone routes to pantry via SPICE_FORCE

The principle: produce keywords should describe things you find in the produce aisle. If a word could equally mean a dried spice, make the produce version more specific.

---

## Implementation Order

1. **Expand STOP_WORDS** with the additional prep/descriptor words listed above
2. **Add the INGREDIENT_ALIASES map** and the `normalizeName()` function
3. **Wire normalizeName() into parseIngredient()** replacing the existing name-cleaning block
4. **Add SPICE_FORCE list** to the categorization system
5. **Update categorizeIngredient()** to check spices first
6. **Trim the produce keyword list** to remove broad terms that collide with pantry spices
7. **Test with real data** by adding 4-5 recipes that share common ingredients and verifying:
   - Parsley variants merge into one line
   - Black pepper goes to Pantry
   - Chicken broth goes to Pantry
   - Bell peppers still go to Produce
   - Fresh ginger goes to Produce, ground ginger goes to Pantry
   - Quantities sum correctly across merged items

---

## Edge Cases to Watch

**"Salt and pepper to taste"**: Many recipes include this as a single string. The parser will struggle with it because it contains two ingredients in one line. Consider adding a special case that splits common combo phrases before parsing.

**"Juice of 1 lemon"**: The quantity parser expects the number at the start. This format puts it in the middle. The parser may return qty=0 and treat the whole string as the ingredient name. Consider a regex that catches "juice of N [citrus]" patterns.

**Servings multiplier**: When someone sets 2x servings, quantities double. Make sure the alias merging still works correctly with multiplied quantities (it should, since aggregation happens after parsing).

**Same ingredient, different units across recipes**: One recipe says "2 tbsp olive oil," another says "1/4 cup olive oil." The current code stores these as separate unit entries in `unitQtys` and displays them as "2 tbsp + 1/4 cup." Consider adding unit conversion for common volume measures (3 tsp = 1 tbsp, 2 tbsp = 1 fl oz, 16 tbsp = 1 cup) so they combine into a single quantity.

**"To taste" items with no quantity**: Salt, pepper, and other "to taste" ingredients may come through with qty=0. The current display handles this fine (just shows the name), but make sure they still merge properly when multiple recipes include them.

---

## Optional Enhancements (Not Required for the Fix)

- **Unit conversion**: Convert compatible units so "2 tbsp + 1/4 cup" becomes "6 tbsp" or "just under 1/2 cup"
- **Smart rounding**: Instead of "1.333 cups," display "1 1/3 cups" (the `fmtQty` function already does some of this, but could be expanded)
- **"Staples" section**: Auto-filter out items like salt, pepper, and olive oil into a separate "Pantry Staples (you probably have these)" section so the list focuses on what people actually need to buy
- **Aisle grouping beyond 4 categories**: Split Pantry into sub-groups like "Oils & Vinegars," "Canned Goods," "Grains & Pasta," "Spices," "Sauces & Condiments" for a more store-friendly list
