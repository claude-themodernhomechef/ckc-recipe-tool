# CKC Fig Data Pipeline: Scraper to Supabase

## What This Document Covers

Step-by-step instructions for taking the raw .json output from the Fig scraper, cleaning it, transforming it, loading it into Supabase, and setting up the sync endpoint that the iOS and web app call to populate the local device cache.

This is the operational glue between the scraper and the three feature build plans (Smart Product Matching, Pantry Starter Kit, Low-FODMAP 3-Phase). Those documents describe what the features do. This document describes how the data gets from point A (raw scrape) to point B (queryable database powering all three features).

---

## Step 1: Expected Raw Output from the Scraper

The Fig scraper produces a .json file with one object per product. Based on the test CSV (test_results_50.csv), each product object should contain:

```json
{
  "name": "Coconut Secret Coconut Aminos",
  "brand": "Coconut Secret",
  "category": "Pantry",
  "subcategory": "Sauces & Condiments",
  "ingredients": "Organic coconut tree sap, sea salt",
  "image_url": "https://...",
  "product_url": "https://...",
  "upc": "851949002017",
  "low_fodmap": "This product is likely Low FODMAP.",
  "gluten_free": "This product is likely Gluten Free.",
  "dairy_free": "This product is likely Dairy Free.",
  "vegan": "This product is likely Vegan.",
  "vegetarian": "This product is likely Vegetarian.",
  "paleo": "...",
  "aip_friendly": "...",
  "low_histamine": "...",
  "seed_oil_free": "...",
  "soy_free": "...",
  "peanut_free": "...",
  "tree_nut_free": "...",
  "egg_free": "...",
  "fish_free": "...",
  "shellfish_free": "...",
  "sesame_free": "...",
  "wheat_free": "...",
  "corn_free": "...",
  "milk_free": "...",
  "lactose_free": "...",
  "whole30": "...",
  "anti_inflammatory": "...",
  "nightshade_free": "...",
  "sugar_free": "...",
  "sulfite_free": "...",
  "msg_free": "..."
}
```

Notes on the raw data:
- `upc` may or may not be present. If Fig exposes it, capture it (Instacart can use UPCs for exact product matching). If not, leave the field null.
- `brand` may need to be parsed from the `name` field if Fig does not provide it as a separate field.
- The 90 diet protocol columns each contain a verbose compliance string, not a boolean.
- Only 26 of the 90 columns matter for CKC. The rest can be dropped during preprocessing.

**Before running the pipeline, validate the raw file:**
- Confirm it parses as valid JSON
- Count total products (expect ~360K)
- Spot-check 10-20 products for completeness (all fields present, no empty strings where data is expected)
- Check if `upc` is populated (affects Instacart integration precision)

---

## Step 2: Preprocessing Script

This script takes the raw .json and produces a cleaned .json ready for Supabase import. It handles five transformations.

### 2A: Keep Only the 26 CKC Protocol Columns

Drop all diet protocol columns except these 26:

**8 primary protocols:**
`low_fodmap`, `gluten_free`, `dairy_free`, `vegan`, `vegetarian`, `paleo`, `aip_friendly`, `low_histamine`

**11 allergen filters:**
`soy_free`, `peanut_free`, `tree_nut_free`, `egg_free`, `fish_free`, `shellfish_free`, `sesame_free`, `wheat_free`, `corn_free`, `milk_free`, `lactose_free`

**7 supporting filters:**
`seed_oil_free`, `whole30`, `anti_inflammatory`, `nightshade_free`, `sugar_free`, `sulfite_free`, `msg_free`

Everything else is dropped. This reduces storage and query complexity significantly.

### 2B: Normalize Compliance Strings

Each of the 26 protocol columns contains a verbose string from Fig. Convert each to a single enum value:

| If the string contains... | Set value to |
|---|---|
| "This product is likely" | `compliant` |
| "are not" (definitive non-compliance) | `not_compliant` |
| "may not be" (uncertain, no definitive non-compliance) | `caution` |
| "are not" AND "may not be" (both present) | `not_compliant` |
| Empty string or missing | `unknown` |

Pseudocode:
```python
def normalize_compliance(raw_string):
    if not raw_string or raw_string.strip() == "":
        return "unknown"
    if "This product is likely" in raw_string:
        return "compliant"
    if "are not" in raw_string:
        return "not_compliant"
    if "may not be" in raw_string:
        return "caution"
    return "unknown"
```

Run this on all 26 columns for every product. The output replaces the verbose string with one of four values: `compliant`, `not_compliant`, `caution`, `unknown`.

### 2C: Remap Categories to CKC Structure

Fig uses its own category/subcategory taxonomy. CKC uses a simpler 8-category structure. Build a mapping table:

```python
CATEGORY_MAP = {
    # Fig category > subcategory : CKC category
    "Meat & Seafood > *": "Protein",
    "Deli > Deli Meat": "Protein",
    "Deli > Prepared Trays": "Snacks",
    "Produce > *": "Produce",
    "Dairy > *": "Dairy & Eggs",
    "Eggs > *": "Dairy & Eggs",
    "Pantry > Oils & Vinegars": "Pantry",
    "Pantry > Sauces & Condiments": "Pantry",
    "Pantry > Spices & Seasonings": "Pantry",
    "Pantry > Grains & Rice": "Pantry",
    "Pantry > Canned Goods": "Pantry",
    "Pantry > Broths & Stocks": "Pantry",
    "Pantry > Pasta & Noodles": "Pantry",
    "Pantry > Sweeteners": "Pantry",
    "Frozen > *": "Frozen",
    "Beverages > *": "Beverages",
    "Snacks > *": "Snacks",
    "Baking > *": "Baking",
    "Breakfast > *": "Pantry",  # Fold into Pantry unless you decide otherwise
    "Health & Fitness > *": "EXCLUDE",
    "Personal Care > *": "EXCLUDE",
    "Household > *": "EXCLUDE",
    "Baby > *": "EXCLUDE",
}
```

Products mapped to `EXCLUDE` are dropped entirely. They are not food products and should not appear in the Pantry Kit or Smart Product Matching.

**Data quality check:** Flag any product where the `category` field is longer than 50 characters or contains patterns that look like product names (the test CSV showed product names leaking into the category field). Log these for manual review.

For any Fig category/subcategory combo not in the mapping table, default to `Pantry` and log it for review. After the first full scrape, review the logged unmapped categories and update the mapping table.

### 2D: Detect Organic Status

Fig has no dedicated organic column. Parse the `name` field:

```python
def detect_organic(name):
    name_upper = name.upper()
    if "ORGANIC" in name_upper or "USDA ORGANIC" in name_upper:
        return True
    return False
```

Store the result as `is_organic: true/false` on each product.

### 2E: Extract or Validate Brand

If the scraper captures `brand` as a separate field, keep it as-is. If not, parse it from the product name. Most Fig product names follow the pattern "[Brand] [Product Description]". A simple heuristic:

```python
def extract_brand(name):
    # Most brands are the first 1-3 words before the product type
    # This is imperfect and will need manual review for edge cases
    # For now, store the full name and add brand extraction later
    # if the scraper does not provide brand separately
    return None  # Placeholder
```

Brand is used for Instacart `brand_filters`. If you can get it from the scraper, great. If not, you can add it later without blocking the rest of the pipeline.

---

## Step 3: Exclude Non-Food Products

After category remapping, drop all products where `ckc_category == "EXCLUDE"`. Also drop products where:
- `name` is empty or null
- `ingredients` is empty or null (a product without an ingredient list cannot be compliance-verified)
- `category` is empty, null, or clearly malformed (logged in Step 2C)

Log the count of excluded products and the reasons. This gives you a sense of how many of the ~360K products are actually food (expect 200-250K after exclusions).

---

## Step 4: Output the Cleaned JSON

The preprocessing script outputs a new .json file where each product looks like:

```json
{
  "fig_id": "fig_12345",
  "name": "Coconut Secret Coconut Aminos",
  "brand": "Coconut Secret",
  "ckc_category": "Pantry",
  "ckc_subcategory": "Sauces & Condiments",
  "fig_category": "Pantry",
  "fig_subcategory": "Sauces & Condiments",
  "ingredients": "Organic coconut tree sap, sea salt",
  "image_url": "https://...",
  "product_url": "https://...",
  "upc": "851949002017",
  "is_organic": true,
  "low_fodmap": "compliant",
  "gluten_free": "compliant",
  "dairy_free": "compliant",
  "vegan": "compliant",
  "vegetarian": "compliant",
  "paleo": "compliant",
  "aip_friendly": "compliant",
  "low_histamine": "compliant",
  "seed_oil_free": "compliant",
  "soy_free": "compliant",
  "peanut_free": "compliant",
  "tree_nut_free": "compliant",
  "egg_free": "compliant",
  "fish_free": "compliant",
  "shellfish_free": "compliant",
  "sesame_free": "compliant",
  "wheat_free": "compliant",
  "corn_free": "compliant",
  "milk_free": "compliant",
  "lactose_free": "compliant",
  "whole30": "compliant",
  "anti_inflammatory": "compliant",
  "nightshade_free": "compliant",
  "sugar_free": "compliant",
  "sulfite_free": "compliant",
  "msg_free": "compliant"
}
```

Save this as `ckc_products_cleaned_YYYY-MM-DD.json`. Keep the date in the filename so you can track which scrape each file came from.

---

## Step 5: Supabase Table Schema

Create a `products` table in Supabase with the following schema:

```sql
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fig_id TEXT UNIQUE,
  name TEXT NOT NULL,
  brand TEXT,
  ckc_category TEXT NOT NULL,
  ckc_subcategory TEXT,
  fig_category TEXT,
  fig_subcategory TEXT,
  ingredients TEXT,
  image_url TEXT,
  product_url TEXT,
  upc TEXT,
  is_organic BOOLEAN DEFAULT FALSE,

  -- 8 primary protocols
  low_fodmap TEXT CHECK (low_fodmap IN ('compliant', 'not_compliant', 'caution', 'unknown')),
  gluten_free TEXT CHECK (gluten_free IN ('compliant', 'not_compliant', 'caution', 'unknown')),
  dairy_free TEXT CHECK (dairy_free IN ('compliant', 'not_compliant', 'caution', 'unknown')),
  vegan TEXT CHECK (vegan IN ('compliant', 'not_compliant', 'caution', 'unknown')),
  vegetarian TEXT CHECK (vegetarian IN ('compliant', 'not_compliant', 'caution', 'unknown')),
  paleo TEXT CHECK (paleo IN ('compliant', 'not_compliant', 'caution', 'unknown')),
  aip_friendly TEXT CHECK (aip_friendly IN ('compliant', 'not_compliant', 'caution', 'unknown')),
  low_histamine TEXT CHECK (low_histamine IN ('compliant', 'not_compliant', 'caution', 'unknown')),

  -- 11 allergen filters
  soy_free TEXT CHECK (soy_free IN ('compliant', 'not_compliant', 'caution', 'unknown')),
  peanut_free TEXT CHECK (peanut_free IN ('compliant', 'not_compliant', 'caution', 'unknown')),
  tree_nut_free TEXT CHECK (tree_nut_free IN ('compliant', 'not_compliant', 'caution', 'unknown')),
  egg_free TEXT CHECK (egg_free IN ('compliant', 'not_compliant', 'caution', 'unknown')),
  fish_free TEXT CHECK (fish_free IN ('compliant', 'not_compliant', 'caution', 'unknown')),
  shellfish_free TEXT CHECK (shellfish_free IN ('compliant', 'not_compliant', 'caution', 'unknown')),
  sesame_free TEXT CHECK (sesame_free IN ('compliant', 'not_compliant', 'caution', 'unknown')),
  wheat_free TEXT CHECK (wheat_free IN ('compliant', 'not_compliant', 'caution', 'unknown')),
  corn_free TEXT CHECK (corn_free IN ('compliant', 'not_compliant', 'caution', 'unknown')),
  milk_free TEXT CHECK (milk_free IN ('compliant', 'not_compliant', 'caution', 'unknown')),
  lactose_free TEXT CHECK (lactose_free IN ('compliant', 'not_compliant', 'caution', 'unknown')),

  -- 7 supporting filters
  seed_oil_free TEXT CHECK (seed_oil_free IN ('compliant', 'not_compliant', 'caution', 'unknown')),
  whole30 TEXT CHECK (whole30 IN ('compliant', 'not_compliant', 'caution', 'unknown')),
  anti_inflammatory TEXT CHECK (anti_inflammatory IN ('compliant', 'not_compliant', 'caution', 'unknown')),
  nightshade_free TEXT CHECK (nightshade_free IN ('compliant', 'not_compliant', 'caution', 'unknown')),
  sugar_free TEXT CHECK (sugar_free IN ('compliant', 'not_compliant', 'caution', 'unknown')),
  sulfite_free TEXT CHECK (sulfite_free IN ('compliant', 'not_compliant', 'caution', 'unknown')),
  msg_free TEXT CHECK (msg_free IN ('compliant', 'not_compliant', 'caution', 'unknown')),

  -- Metadata
  data_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes

These indexes are critical for query performance. Without them, filtering 200K+ products by multiple protocol columns will be slow.

```sql
-- Full-text search on product name (powers search bar and autocomplete)
CREATE INDEX idx_products_name_search ON products USING gin(to_tsvector('english', name));

-- Protocol filtering (one index per protocol column for fast WHERE clauses)
CREATE INDEX idx_products_low_fodmap ON products (low_fodmap);
CREATE INDEX idx_products_gluten_free ON products (gluten_free);
CREATE INDEX idx_products_dairy_free ON products (dairy_free);
CREATE INDEX idx_products_vegan ON products (vegan);
CREATE INDEX idx_products_vegetarian ON products (vegetarian);
CREATE INDEX idx_products_paleo ON products (paleo);
CREATE INDEX idx_products_aip_friendly ON products (aip_friendly);
CREATE INDEX idx_products_low_histamine ON products (low_histamine);
CREATE INDEX idx_products_seed_oil_free ON products (seed_oil_free);
CREATE INDEX idx_products_soy_free ON products (soy_free);
CREATE INDEX idx_products_peanut_free ON products (peanut_free);
CREATE INDEX idx_products_tree_nut_free ON products (tree_nut_free);
CREATE INDEX idx_products_egg_free ON products (egg_free);
CREATE INDEX idx_products_wheat_free ON products (wheat_free);
CREATE INDEX idx_products_corn_free ON products (corn_free);
CREATE INDEX idx_products_milk_free ON products (milk_free);
CREATE INDEX idx_products_lactose_free ON products (lactose_free);

-- Category browsing (Pantry Kit category tree)
CREATE INDEX idx_products_ckc_category ON products (ckc_category);
CREATE INDEX idx_products_ckc_subcategory ON products (ckc_subcategory);

-- Organic filter
CREATE INDEX idx_products_organic ON products (is_organic);

-- Composite index for the most common multi-protocol queries
-- (adjust based on actual usage patterns after launch)
CREATE INDEX idx_products_fodmap_gf_df ON products (low_fodmap, gluten_free, dairy_free);
```

### Supporting Tables

**Database version tracker** (for client sync):
```sql
CREATE TABLE data_versions (
  id SERIAL PRIMARY KEY,
  version INTEGER NOT NULL,
  scraped_at DATE NOT NULL,
  loaded_at TIMESTAMPTZ DEFAULT NOW(),
  product_count INTEGER NOT NULL,
  notes TEXT
);
```

**User favorites** (for Pantry Kit and Smart Product Matching):
```sql
CREATE TABLE user_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

CREATE INDEX idx_favorites_user ON user_favorites (user_id);
```

---

## Step 6: Load Data into Supabase

### Option A: Supabase Dashboard Import (Small Datasets, Testing)

For the initial test with a small subset (e.g., the first 1,000 products), you can use the Supabase dashboard CSV import. Export the cleaned JSON to CSV, then upload via the Table Editor.

### Option B: Supabase Client Library (Full Dataset, Production)

For the full 200K+ product load, use the Supabase JavaScript client or the Postgres `COPY` command.

**Using the Supabase JS client (Node.js script):**

```javascript
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://YOUR_PROJECT.supabase.co',
  'YOUR_SERVICE_ROLE_KEY'  // Use service role key for bulk inserts
);

async function loadProducts() {
  const raw = fs.readFileSync('ckc_products_cleaned_2026-03-29.json', 'utf8');
  const products = JSON.parse(raw);
  
  console.log(`Loading ${products.length} products...`);
  
  // Supabase insert has a batch limit. Insert in chunks of 500.
  const BATCH_SIZE = 500;
  let loaded = 0;
  
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    
    const { data, error } = await supabase
      .from('products')
      .upsert(batch, { onConflict: 'fig_id' });
    
    if (error) {
      console.error(`Error at batch ${i}: ${error.message}`);
      // Log the error but continue with the next batch
    } else {
      loaded += batch.length;
      console.log(`Loaded ${loaded} / ${products.length}`);
    }
  }
  
  console.log('Done.');
  
  // Update the data version tracker
  const { error: versionError } = await supabase
    .from('data_versions')
    .insert({
      version: 1,  // Increment this with each quarterly refresh
      scraped_at: '2026-03-29',
      product_count: loaded,
      notes: 'Initial load from Fig scrape'
    });
  
  if (versionError) {
    console.error(`Version tracking error: ${versionError.message}`);
  }
}

loadProducts();
```

**Using direct Postgres COPY (fastest for large datasets):**

If you have direct Postgres access (available in Supabase via the connection string in Settings > Database):

1. Export cleaned JSON to CSV
2. Connect to the Supabase Postgres instance using `psql`
3. Run `\COPY products FROM 'ckc_products_cleaned.csv' WITH (FORMAT csv, HEADER true);`

This is the fastest method for 200K+ rows. Takes seconds instead of minutes.

### After Loading: Verify

Run these checks in the Supabase SQL editor:

```sql
-- Total product count
SELECT COUNT(*) FROM products;

-- Products per CKC category
SELECT ckc_category, COUNT(*) FROM products GROUP BY ckc_category ORDER BY COUNT(*) DESC;

-- Compliance distribution for key protocols
SELECT low_fodmap, COUNT(*) FROM products GROUP BY low_fodmap;
SELECT gluten_free, COUNT(*) FROM products GROUP BY gluten_free;
SELECT dairy_free, COUNT(*) FROM products GROUP BY dairy_free;

-- Check for data quality issues
SELECT COUNT(*) FROM products WHERE name IS NULL OR name = '';
SELECT COUNT(*) FROM products WHERE ingredients IS NULL OR ingredients = '';
SELECT COUNT(*) FROM products WHERE ckc_category IS NULL;

-- Sample products to eyeball
SELECT name, ckc_category, low_fodmap, gluten_free, dairy_free 
FROM products 
ORDER BY RANDOM() 
LIMIT 20;
```

---

## Step 7: Sync Endpoint for the App

The iOS and web apps need to pull a filtered subset of products based on the user's active protocols. This is the sync that populates the local device cache.

### Supabase RPC Function (Recommended)

Create a Postgres function that takes an array of protocol names and returns all compliant products:

```sql
CREATE OR REPLACE FUNCTION get_compliant_products(
  protocols TEXT[]  -- e.g., ARRAY['low_fodmap', 'gluten_free', 'dairy_free']
)
RETURNS TABLE (
  id UUID,
  fig_id TEXT,
  name TEXT,
  brand TEXT,
  ckc_category TEXT,
  ckc_subcategory TEXT,
  ingredients TEXT,
  image_url TEXT,
  upc TEXT,
  is_organic BOOLEAN,
  low_fodmap TEXT,
  gluten_free TEXT,
  dairy_free TEXT,
  vegan TEXT,
  vegetarian TEXT,
  paleo TEXT,
  aip_friendly TEXT,
  low_histamine TEXT,
  seed_oil_free TEXT,
  soy_free TEXT,
  peanut_free TEXT,
  tree_nut_free TEXT,
  egg_free TEXT,
  fish_free TEXT,
  shellfish_free TEXT,
  sesame_free TEXT,
  wheat_free TEXT,
  corn_free TEXT,
  milk_free TEXT,
  lactose_free TEXT,
  whole30 TEXT,
  anti_inflammatory TEXT,
  nightshade_free TEXT,
  sugar_free TEXT,
  sulfite_free TEXT,
  msg_free TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  query TEXT;
  protocol TEXT;
BEGIN
  query := 'SELECT id, fig_id, name, brand, ckc_category, ckc_subcategory, ingredients, image_url, upc, is_organic, low_fodmap, gluten_free, dairy_free, vegan, vegetarian, paleo, aip_friendly, low_histamine, seed_oil_free, soy_free, peanut_free, tree_nut_free, egg_free, fish_free, shellfish_free, sesame_free, wheat_free, corn_free, milk_free, lactose_free, whole30, anti_inflammatory, nightshade_free, sugar_free, sulfite_free, msg_free FROM products WHERE 1=1';
  
  FOREACH protocol IN ARRAY protocols
  LOOP
    query := query || format(' AND %I = ''compliant''', protocol);
  END LOOP;
  
  RETURN QUERY EXECUTE query;
END;
$$;
```

### How the App Calls It

**From the iOS or web client (Supabase SDK):**

```javascript
const { data, error } = await supabase
  .rpc('get_compliant_products', {
    protocols: ['low_fodmap', 'gluten_free', 'dairy_free']
  });

// data is now an array of all products compliant with all three protocols
// Cache this locally (Core Data on iOS, IndexedDB on web)
```

This single call returns the user's entire filtered product set. On a properly indexed table with 200K products, this query returns in under 100ms even for 3-4 protocol filters.

### Data Version Check

The app should check the current data version on each launch to know if a re-sync is needed:

```sql
-- Simple version check endpoint
CREATE OR REPLACE FUNCTION get_data_version()
RETURNS INTEGER
LANGUAGE sql
AS $$
  SELECT version FROM data_versions ORDER BY id DESC LIMIT 1;
$$;
```

App logic:
```javascript
const { data: versionData } = await supabase.rpc('get_data_version');
const serverVersion = versionData;
const localVersion = getLocalVersion();  // from device storage

if (serverVersion > localVersion) {
  // Re-sync: call get_compliant_products and update local cache
  // Update local version number
}
```

---

## Step 8: Quarterly Refresh Process

When you re-scrape Fig (quarterly), here is the exact process:

1. **Run the scraper.** Output: new raw .json file.
2. **Run the preprocessing script** (Step 2). Output: new cleaned .json file with date stamp.
3. **Compare with the previous load:**
   - New products (fig_id exists in new file but not in Supabase): INSERT
   - Updated products (fig_id exists in both, but fields changed): UPDATE
   - Removed products (fig_id exists in Supabase but not in new file): mark as inactive (do NOT delete, because users may have favorites pointing to them)
4. **Load the changes** using the upsert script from Step 6 (the `onConflict: 'fig_id'` handles inserts vs. updates automatically).
5. **Bump the data version** in the `data_versions` table.
6. **Check user favorites for broken compliance:**
   ```sql
   -- Find favorites where the product's compliance changed
   SELECT uf.user_id, p.name, p.low_fodmap, p.gluten_free
   FROM user_favorites uf
   JOIN products p ON uf.product_id = p.id
   WHERE p.updated_at > (NOW() - INTERVAL '1 day')
   AND (p.low_fodmap != 'compliant' OR p.gluten_free != 'compliant');
   ```
   These users should get an in-app notification: "Heads up: [Product Name] has updated its ingredients and may no longer be compliant with your Low-FODMAP protocol."
7. **The app detects the version bump** on next launch and re-syncs the local cache silently in the background.

### Handling Removed Products

When a product disappears from Fig (discontinued, reformulated, delisted), do NOT delete it from Supabase. Instead, add an `is_active` column:

```sql
ALTER TABLE products ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
```

Mark removed products as `is_active = false`. The sync endpoint filters to `WHERE is_active = true`. But user favorites still reference the product so the "this product changed" notification works.

---

## Step 9: Row-Level Security (RLS)

Supabase uses RLS to control who can read/write data. For the products table, the policy is simple:

```sql
-- Anyone can read products (this is public catalog data)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Products are publicly readable"
  ON products FOR SELECT
  USING (true);

-- Only the service role can insert/update/delete (your preprocessing scripts)
CREATE POLICY "Only service role can modify products"
  ON products FOR ALL
  USING (auth.role() = 'service_role');
```

For user favorites, restrict to the owning user:

```sql
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own favorites"
  ON user_favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorites"
  ON user_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites"
  ON user_favorites FOR DELETE
  USING (auth.uid() = user_id);
```

---

## Summary: The Full Pipeline

```
Fig Scraper
    |
    v
Raw .json (~360K products, 90 protocol columns, verbose strings)
    |
    v
Preprocessing Script (Step 2)
  - Keep only 26 protocol columns
  - Normalize compliance strings to enum values
  - Remap categories to CKC 8-category structure
  - Detect organic status from product name
  - Exclude non-food products
  - Flag data quality issues
    |
    v
Cleaned .json (~200-250K food products, 26 protocol columns, enum values)
    |
    v
Supabase Load (Step 6)
  - Create products table with schema (Step 5)
  - Upsert in batches of 500
  - Create indexes for protocol filtering and full-text search
  - Verify counts and data quality
    |
    v
Supabase Database (queryable, indexed, versioned)
    |
    v
Sync Endpoint (Step 7)
  - get_compliant_products(protocols[]) RPC function
  - get_data_version() for sync checks
    |
    v
App Local Cache (Core Data on iOS, IndexedDB on web)
  - Filtered product set (~15-30K products per user)
  - All browsing, searching, and filtering runs locally
  - Re-syncs on protocol change, version bump, or manual refresh
```

---

## Checklist: Before Running the Pipeline

- [ ] Scraper output is valid JSON
- [ ] Product count is in the expected range (~360K)
- [ ] UPC field presence confirmed (or noted as absent)
- [ ] Supabase project created with Postgres database
- [ ] `products` table created with schema from Step 5
- [ ] Indexes created
- [ ] `data_versions` table created
- [ ] `user_favorites` table created
- [ ] RLS policies applied
- [ ] Preprocessing script tested on a subset (e.g., 1,000 products)
- [ ] Full cleaned dataset loaded and verified
- [ ] `get_compliant_products` RPC function tested with sample protocol arrays
- [ ] `get_data_version` RPC function returning correct version
- [ ] App client successfully calling sync endpoint and populating local cache
