# CKC Protocol-Safe Pantry Starter Kits Build Plan (Updated)

## What This Feature Does

The moment a user selects their dietary protocols during onboarding, the app generates a personalized, searchable product database of every grocery product that is verified compliant with their specific combination of diets. Users can browse by category, search by name, save favorites, and add products directly to their shopping list. Think of it as "here is literally everything you can eat, organized and searchable."

---

## Decisions Locked In

- **Architecture:** Shares the same Supabase backend + local device cache as Smart Product Matching (Option C Hybrid). Same `products` table, same sync engine, same preprocessing pipeline.
- **Data source:** Fig product database (~360K products), scraped as CKC's own .json file. Refreshed quarterly.
- **Where it lives in the app:** Home page of the Account Profile tab. Easily accessible but not in the way of the app's primary functions (Discover, Meal Plan, Shopping List).
- **Category structure:**
  ```
  Protein
  Produce
  Dairy & Eggs
  Pantry (oils, sauces, spices, grains, canned goods, broths)
  Frozen
  Beverages
  Snacks
  Baking
  ```
- **Filter count:** 26 total (same as Smart Product Matching). 8 primary protocols + 11 allergens + 7 supporting filters.
- **Excluded categories:** Health & Fitness (vitamins), Personal Care, Household, Baby products. Supplements stay.
- **Caution products:** Compliant-only by default. Caution products shown as fallback with clear labeling when no compliant match exists for a category or search.
- **Monetization:** Free. The Pantry Kit is the hook that makes new users immediately understand the app's value. It drives onboarding engagement and retention. Premium features are meal planning, Instacart integration, recipe compliance scanner, and FODMAP reintroduction tracking.
- **Favorites feed into Smart Product Matching:** Yes. When a user favorites "Coconut Secret Coconut Aminos" in the Pantry Kit, that product automatically becomes the default recommendation when any recipe calls for coconut aminos on the shopping list.
- **Protocol required:** Users must select at least one protocol to access the Pantry Kit. Showing 360K unfiltered products adds no value.

---

## The User Experience

### Onboarding Flow

```
Step 1: Welcome to CKC
Step 2: Select your dietary protocols [multi-select from 26 options]
Step 3: [Sync animation - 3-4 seconds]
        "Scanning 360,000+ products..."
        "Filtering for your Low-FODMAP + Gluten-Free profile..."
        "We matched 24,847 products with your protocols"
        "This is tailored just for you"
        "Almost done building [Name]'s list..."
        "Your personalized pantry is ready"
Step 4: [Button: "Explore Your Products"]
Step 5: Curated Starter Kit (see below)
```

The product count at the 40-60% mark is a real number from the actual query. The animation stretches to 3-4 seconds even if data loads faster. The count ticks up rapidly like a slot machine counter.

### Curated Starter Kit (First-Time View)

The full database is overwhelming for a first-time user. The onboarding flow shows a curated starter kit: the 30-50 most essential products for their protocol combination.

How "essential" is determined (hybrid approach, recommended):

1. **Recipe-driven selection:** Analyze the CKC recipe index. Find the 50 most frequently used packaged ingredients across all recipes. Cross-reference with compliant Fig products.
2. **Chef curation:** Rafi reviews the recipe-frequency list and adjusts based on chef knowledge. A frequency analysis might surface "vegetable broth" as essential. Rafi might also add "coconut aminos" because it is a staple swap that new Low-FODMAP users always need but might not know about.

The starter kit is protocol-specific. Someone selecting Low-FODMAP + GF sees different essentials than someone selecting Vegan + AIP. The curated lists for the top 5-6 protocols are manually built. Less common protocol combinations fall back to the recipe-frequency algorithm.

After the starter kit view, the user can tap "Explore All [24,847] Safe Products" to access the full searchable database.

### Browse View

```
YOUR SAFE PRODUCTS
Filtered by: Low-FODMAP, Gluten-Free, Dairy-Free
24,847 products

[Search bar: "Search products..."]

CATEGORIES:
  Protein          (3,241)
  Produce          (1,892)
  Dairy & Eggs     (2,104)
  Pantry           (8,476)
  Frozen           (3,018)
  Beverages        (2,341)
  Snacks           (2,198)
  Baking           (1,577)
```

User taps "Pantry":
```
PANTRY
8,476 products

  Oils & Vinegars     (847)
  Sauces & Condiments (1,203)
  Spices & Seasonings (2,104)
  Grains & Rice       (634)
  Canned Goods        (1,892)
  Broths & Stocks     (341)
  Pasta & Noodles     (455)
  Sweeteners          (312)
  ...
```

User taps "Sauces & Condiments":
```
SAUCES & CONDIMENTS
1,203 products

[Product cards with image, name, brand, protocol badges]

Coconut Secret Coconut Aminos
  [image] | All protocols: Compliant
  [Heart icon to favorite]

Big Tree Farms Coco Aminos
  [image] | All protocols: Compliant
  [Heart icon to favorite]

...
```

### Product Detail View

```
COCONUT SECRET COCONUT AMINOS
[large product image]

Ingredients:
Organic coconut tree sap, sea salt

Allergens:
None listed

YOUR PROTOCOLS:
  Low-FODMAP      Compliant
  Gluten-Free     Compliant
  Dairy-Free      Compliant

[Save to Favorites]
[Add to Shopping List]
```

"Add to Shopping List" adds this product as a standalone item (not tied to a recipe). This lets people stock their pantry outside of the recipe flow.

### Search

User types "coconut am..." and autocomplete shows:

```
SEARCH RESULTS: "coconut aminos"
Filtered by: Low-FODMAP, Gluten-Free, Dairy-Free

3 products found

Coconut Secret Coconut Aminos
  [image] | Pantry > Sauces & Condiments
  All protocols: Compliant

Big Tree Farms Coco Aminos
  [image] | Pantry > Sauces & Condiments
  All protocols: Compliant

Thrive Market Organic Coconut Aminos
  [image] | Pantry > Sauces & Condiments
  All protocols: Compliant
```

Search runs against the local device cache. Results appear as the user types with no loading state.

If the user has the caution toggle enabled, products with yellow flags appear below compliant results with clear visual separation.

---

## Shared Infrastructure with Smart Product Matching

These two features share the same backend, the same preprocessing pipeline, and the same local cache. Building one builds most of the other.

| Component | Shared? |
|---|---|
| Supabase `products` table | Yes |
| Preprocessing pipeline (normalize compliance, remap categories, exclude non-food, detect organic) | Yes |
| Sync engine (protocol-filtered query, compressed transfer, local cache) | Yes |
| Search engine (fuzzy text match against local cache) | Yes |
| Favorites system | Yes (Pantry Kit favorites feed into Smart Product Matching defaults) |
| Browse UI (category tree, subcategory drill-down) | Pantry Kit only |
| Shopping list auto-recommend | Smart Product Matching only |
| Instacart integration | Smart Product Matching only |

---

## Data Freshness

The Fig data is a point-in-time snapshot. Product formulations change, new products launch, old ones get discontinued.

Refresh strategy:
- CKC re-scrapes Fig quarterly
- The preprocessing pipeline runs on each new scrape
- Supabase database is updated with new/changed/removed products
- A `database_version` flag bumps with each refresh
- On app open, the client checks the version flag. If it has bumped, the local cache re-syncs silently in the background.
- Products the user has favorited persist in favorites even if the product is removed from the database. If a favorited product's formulation changes and it becomes non-compliant, a notification appears: "Heads up: [Product Name] has updated its ingredients and may no longer be compliant with your Low-FODMAP protocol. We've flagged it in your favorites."

No "last verified" date shown to users (adds visual clutter without much value). Instead, the quarterly refresh keeps data current enough for practical use.

---

## Shareable Pantry Kit (Future Feature)

User generates a shareable link or PDF of their curated starter kit or full safe product list. Use cases:
- A parent shares "here's everything my daughter can eat" with their school, partner, or caregiver who does the grocery shopping
- A user shares their safe product list with a spouse or roommate
- A dietitian asks a client to share their CKC pantry kit for review

This is a low-effort, high-emotional-value feature and a potential viral loop. Worth building post-launch once the core Pantry Kit is stable.

---

## FODMAP Phase Integration (Future Feature)

When the Low-FODMAP 3-Phase Build is implemented (see CKC-Low-FODMAP-3-Phase-Build-Plan.md), the Pantry Kit adapts to the user's current FODMAP phase:

**Phase 1 (Elimination):** Pantry Kit shows only elimination-compliant products. This is the default launch behavior using Fig's `low_fodmap` column.

**Phase 2 (Reintroduction):** When testing a specific FODMAP group (e.g., fructans via garlic), the Pantry Kit can surface products containing the test ingredient: "Testing fructans (garlic)? Here are garlic-containing products you can use for your test meals." Products outside the current test group remain elimination-filtered.

**Phase 3 (Personalization):** Product filtering adapts to the user's individual tolerance profile. Tolerated groups unlock those products. Not-tolerated groups keep them hidden. Partially tolerated groups show products with serving-size notes.

This requires the FODMAP Group Ingredient Database and the post-processing pipeline that tags each product with `fodmap_groups_triggered` based on its ingredient list. See the Low-FODMAP 3-Phase Build Plan for details.

---

## Build Order

| Step | Task | Dependencies | Estimated Effort |
|---|---|---|---|
| 1 | Define final CKC category structure (confirm the 8 categories above) | None | 1 session |
| 2 | Build Fig-to-CKC category mapping table (all Fig subcategories mapped) | Step 1, full Fig data | 1-2 days |
| 3 | Preprocessing pipeline: normalize compliance strings, remap categories, exclude non-food, detect organic, flag malformed rows | Full Fig JSON, Step 2 | 1-2 days (shared with Smart Product Matching) |
| 4 | Load into Supabase and build sync engine | Step 3 | 1-2 days (shared with Smart Product Matching) |
| 5 | Build search with autocomplete and synonym map | Step 4 | 2-3 days (shared with Smart Product Matching) |
| 6 | Build browse UI (category tree, subcategory drill-down, product detail view) | Step 4 | 3-4 days |
| 7 | Build search results UI with protocol badges | Step 5, Step 6 | 1-2 days |
| 8 | Curate starter kit product lists for top 5-6 protocols | Step 3, CKC recipe index analysis, Rafi review | 2-3 days |
| 9 | Build onboarding flow integration (protocol select, sync animation, starter kit display, explore transition) | Steps 6-8 | 2-3 days |
| 10 | Add favorites system and "Add to Shopping List" standalone function | Step 7 | 1-2 days |
| 11 | Connect favorites to Smart Product Matching defaults | Step 10, Smart Product Matching build | 1 day |

Total estimated effort: 16-23 days. But Steps 1-5 overlap with Smart Product Matching, so the combined build for both features is roughly 22-30 days, not 31-43.

---

## Open Questions (Remaining)

1. **How many of the 360K Fig products are actually food?** If a large chunk is vitamins, supplements (beyond cooking-relevant ones), personal care, and household items, the actual food product count after exclusions might be 200-250K. Worth checking when the full scrape is done. This affects the "we matched X products" number in the onboarding animation.

2. **Should the Pantry Kit include a "CKC Chef's Pick" badge on manually curated products?** Rafi could flag 50-100 products across categories as personal recommendations. This adds authority and curation on top of the raw compliance data. Does not affect the build architecture but affects how product ranking and display work.

3. **Should "Baking" be its own top-level category or a subcategory under "Pantry"?** And should "Breakfast" be a separate category or folded into "Pantry" and "Frozen"? The 8-category structure above is a working draft. Worth confirming before building the UI.

4. **Deli and Prepared Foods:** Should Fig's "Deli > Prepared Trays" category (things like "Niman Ranch Pepperoni Provolone & Dark Chocolate Almonds" snack trays) be included or excluded? Useful for some users but not traditional "pantry" items. Could go under "Snacks."
