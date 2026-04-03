# CKC Smart Product Matching Build Plan (Updated)

## What This Feature Does

When a user adds a recipe to their meal plan or shopping list, every ingredient gets matched to specific, brand-name grocery products that are verified compliant with the user's active dietary protocols. The user sees "Coconut Secret Coconut Aminos" instead of just "coconut aminos."

---

## Decisions Locked In

- **Architecture:** Option C (Hybrid). Supabase as the backend source of truth with aggressive local device caching. After the initial sync, all browsing, searching, and filtering happens on-device with zero network latency.
- **Data source:** Fig product database (~360K products), scraped and stored as CKC's own .json file. Refreshed quarterly.
- **Data storage:** Supabase Postgres table (`products`). On user protocol selection, the filtered product set (~15-30K products, 2-4MB compressed) syncs to local cache (Core Data on iOS, IndexedDB on web).
- **Filter count:** 26 total columns indexed from Fig data.
  - 8 primary diet protocols: `vegan`, `vegetarian`, `gluten_free`, `dairy_free`, `low_fodmap`, `low_histamine`, `aip_friendly`, `paleo`
  - Keto is NOT in Fig. Keto filtering requires nutrition data (net carbs per serving) from a separate source (USDA database or nutrition API). This is a known gap.
  - 11 allergen filters: `soy_free`, `peanut_free`, `tree_nut_free`, `egg_free`, `fish_free`, `shellfish_free`, `sesame_free`, `wheat_free`, `corn_free`, `milk_free`, `lactose_free`
  - 7 supporting filters: `seed_oil_free`, `whole30`, `anti_inflammatory`, `nightshade_free`, `sugar_free`, `sulfite_free`, `msg_free`
  - `gut_friendly` removed (too vague, no clinical standard).
- **Caution products:** Default to showing compliant-only results. If zero compliant products match an ingredient for the user's protocols, fall back to "caution" products with clear visual distinction and specific ingredient-level warnings.
- **Excluded categories:** Health & Fitness (vitamins), Personal Care, Household, Baby products. Supplements stay (sometimes used in recipes).
- **Favorites integration:** When a user favorites a product in the Pantry Kit, that product becomes the default recommendation in Smart Product Matching. User favorites "Coconut Secret Coconut Aminos" in the Pantry Kit, and next time a recipe calls for coconut aminos, the shopping list auto-recommends that brand.
- **Monetization:** Smart Product Matching is a premium feature (part of the meal planning / shopping list paywall).

---

## Data Pipeline

### Source Data

Fig product CSV/JSON with the following fields per product:
- `name`: Brand + product name (e.g., "Coconut Secret Coconut Aminos")
- `category`: Fig's category (needs remapping to CKC categories)
- `subcategory`: Fig's subcategory
- `ingredients`: Full ingredient list as a string
- `image_url`: Product image (links to Walmart product images in current data)
- 90 diet protocol columns, each containing a compliance string

### Compliance String Normalization

Fig's compliance values are verbose strings, not simple booleans. They need to be normalized into three statuses:

| Fig String Pattern | CKC Status |
|---|---|
| "This product is likely [Protocol]." | `compliant` |
| "has X ingredients that are not [Protocol]." | `not_compliant` |
| "has X ingredients that may not be [Protocol]." | `caution` |
| "has X ingredients that are not [Protocol] and Y that may not be." | `not_compliant` (treat the stronger signal) |

The preprocessing script parses each compliance string and stores a normalized enum (`compliant`, `caution`, `not_compliant`) per protocol per product.

### Category Remapping

CKC uses its own category structure (not mirroring Instacart or Fig, since Instacart's API does not use categories for product lookup):

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

A mapping table converts Fig categories and subcategories to CKC categories. This mapping is built once and updated if Fig changes their taxonomy.

Data quality note: The test CSV showed some product names leaking into the category field. The preprocessing script should flag rows where `category` contains strings longer than 50 characters or matches known product name patterns.

### Organic Detection

Fig does not have a dedicated `organic` column. Organic status is embedded in the product name (e.g., "Thrive Market Organic Coconut Aminos"). The preprocessing script scans the `name` field for "Organic" and "USDA Organic" and sets an `is_organic` boolean.

This powers the organic toggle and the Dirty Dozen logic:
- User enables "prefer organic"
- For produce items on the EWG Dirty Dozen list, the shopping list prioritizes organic-labeled products
- For produce NOT on the Dirty Dozen list, conventional is fine (saves money)

---

## How Matching Works

### The Matching Flow

1. User saves a recipe to their meal plan
2. Recipe ingredients populate the shopping list (ingredient name, quantity, unit)
3. For each ingredient, the matching engine queries the local product cache:
   - Filter: all active protocols = `compliant`
   - Search: fuzzy match ingredient name against product names
   - Sort: user favorites first, then by match confidence, then alphabetically
4. Top match is auto-recommended. User can tap to see alternatives.
5. If no compliant match exists, fall back to `caution` products with clear labeling

### Matching Query Example

User protocols: Low-FODMAP + Gluten-Free + Dairy-Free
Shopping list ingredient: "tamari"

```sql
SELECT * FROM products_cache
WHERE low_fodmap = 'compliant'
  AND gluten_free = 'compliant'
  AND dairy_free = 'compliant'
  AND (name ILIKE '%tamari%' OR name ILIKE '%soy sauce%')
ORDER BY 
  is_user_favorite DESC,
  match_confidence DESC,
  name ASC
LIMIT 10
```

This runs against the local cache, so it returns in milliseconds.

### Ingredient-to-Product Synonym Map

Not every ingredient name matches a product name directly. The matching engine needs a synonym map:

| Recipe Ingredient | Search Terms |
|---|---|
| tamari | tamari, soy sauce, coconut aminos |
| olive oil | olive oil, extra virgin olive oil, EVOO |
| chicken broth | chicken broth, chicken stock, bone broth |
| all-purpose flour | all-purpose flour, AP flour, plain flour |
| coconut milk | coconut milk, coconut cream |

This map is built manually and expanded over time as edge cases surface. Start with the 50-100 most common CKC recipe ingredients.

### Caution Fallback Display

When no compliant products exist for an ingredient + protocol combination:

```
No fully verified products found for "tamari" 
with your protocols. Showing products with 
minor concerns.

San-J Tamari Gluten Free Soy Sauce
  Low-FODMAP: Compliant
  Gluten-Free: Compliant
  Dairy-Free: Compliant

  [!] CAUTION
  Soy-Free: 1 ingredient may not be soy-free
  Tap to see ingredient details

[Why am I seeing this?]
```

The "[Why am I seeing this?]" link explains: "We show products with minor concerns when no fully verified match exists. This lets you make an informed choice rather than leaving you with no recommendation."

---

## Instacart Integration

Instacart's API does not use categories. Each line item is a product name used as a search term:

```json
{
  "title": "My CKC Shopping List",
  "line_items": [
    {
      "name": "Coconut Secret Coconut Aminos",
      "line_item_measurements": [{ "quantity": 1, "unit": "each" }],
      "filters": {
        "brand_filters": ["Coconut Secret"],
        "health_filters": ["GLUTEN_FREE"]
      }
    }
  ]
}
```

Key integration points:
- `health_filters` supports: `ORGANIC`, `GLUTEN_FREE`, `FAT_FREE`, `VEGAN`, `KOSHER`, `SUGAR_FREE`, `LOW_FAT`. When a user has gluten-free active, CKC automatically passes `GLUTEN_FREE` to every line item. The organic toggle passes `ORGANIC`.
- `brand_filters` passes the exact brand name from the user's favorite or the top product match. "Coconut Secret" gets the exact product at the user's local store.
- `upcs` (barcodes) allow pinning to an exact SKU. Worth checking if Fig data includes UPCs when scraping the full dataset.
- Cart building runs server-side via a Supabase Edge Function. The client sends the full shopping list, the Edge Function looks up recommended products, queries Instacart for availability at the user's store, builds the cart, and returns a single checkout link. No client-side Instacart API calls.

---

## Sync Strategy

The local product cache refreshes in three scenarios:

1. **User changes protocols:** Re-filter and re-sync from Supabase. Takes 1-2 seconds.
2. **Database version bump:** Quarterly when CKC re-scrapes Fig data. Happens silently in background on app open.
3. **Manual refresh:** User pulls to refresh.

Between syncs, everything is local. The app works offline for browsing and searching. Only Instacart ordering and real-time store availability checks need connectivity.

---

## Onboarding Sync Animation

When the user first selects their protocols during onboarding, a progress animation masks the 1-2 second data sync:

```
0-20%    "Scanning 360,000+ products..."
20-40%   "Filtering for your Low-FODMAP + Gluten-Free profile..."
40-60%   "We matched 24,847 products with your protocols"
60-80%   "This is tailored just for you"
80-95%   "Almost done building [Name]'s list..."
100%     "Your personalized pantry is ready"
         [Button: "Explore Your Products"]
```

The product count at 40-60% is a real number pulled from the actual query result. The progress bar should stretch to 3-4 seconds even if data loads faster, so messages have time to register. The count can tick up rapidly like a slot machine counter for visual effect.

---

## Build Order

| Step | Task | Dependencies | Estimated Effort |
|---|---|---|---|
| 1 | Preprocessing pipeline: normalize compliance strings, remap categories to CKC structure, exclude non-food, detect organic, flag malformed rows | Full Fig data (JSON) | 1-2 days |
| 2 | Load into Supabase: create `products` table, index protocol columns, set up full-text search | Step 1 | 1 day |
| 3 | Build sync engine: protocol-filtered query, compressed transfer, local cache (Core Data / IndexedDB) | Step 2 | 2-3 days |
| 4 | Build ingredient-to-product synonym map (top 50-100 ingredients) | CKC recipe index | 1-2 days |
| 5 | Build matching engine: query local cache, rank results, handle caution fallback | Steps 3-4 | 2-3 days |
| 6 | Shopping list UI integration: auto-recommend products, tap for alternatives, product detail view | Step 5 | 2-3 days |
| 7 | Favorites integration: user favorites from Pantry Kit become default recommendations | Step 5, Pantry Kit favorites system | 1 day |
| 8 | Instacart Edge Function: server-side cart building with brand filters and health filters | Steps 2, 5 | 3-4 days |
| 9 | Onboarding sync animation | Step 3 | 1 day |

Total estimated effort: 15-20 days.

Note: Steps 1-4 are shared with the Pantry Kit build. Building one builds both.

---

## Open Questions (Remaining)

1. **Does Fig data include UPCs (barcodes)?** If yes, Instacart integration becomes significantly more precise (exact SKU matching instead of name-based search). Worth checking when scraping the full dataset.

2. **Should product matching data feed into the recipe compliance score in the swipe deck?** (e.g., "11 of 12 ingredients have verified compliant products available.") This would mean the product database influences recipe discovery, not just the shopping list. My recommendation: yes, but as a secondary signal, not a primary filter.

3. **Is there a plan for affiliate links or referral revenue from product recommendations?** Some Fig product URLs link to Walmart product images. If recommending specific brands, there is an opportunity to link to purchase with affiliate tracking. Does not affect the build but affects how product URLs are structured in the database.

4. **Tolerance overrides at the product level:** When a user on Low-FODMAP knows they tolerate a specific product that contains a technically non-compliant ingredient (e.g., a pasta sauce with small amounts of garlic), should they be able to manually mark that product as "safe for me"? This creates a per-user exception layer on top of the protocol filtering. Connects to the FODMAP 3-Phase build (where tolerance overrides are handled at the FODMAP group level rather than product level).
