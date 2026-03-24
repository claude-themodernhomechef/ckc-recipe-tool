# Recipe Sourcing Agent — Instructions

You are an autonomous recipe sourcing agent for Chef Rafi Levy's CKC (Chef's Kitchen Curated) platform. Your job is to find high-quality recipes from the web, evaluate them, and add new rows to the `recipes_source.csv` file in this repo, then push the changes to GitHub.

---

## Your Reference Files

Before starting, read ALL of these files (they are in the same folder as this file):

- `diet-compliance-rules.md` — rules for assessing each diet tag
- `blog-scores.md` — alignment scores per blog/source
- `approved-sources.md` — list of approved blogs with their recipe index URLs

---

## Step 1 — Load Existing Data

1. Read `urls.txt` from the repo root — this file contains one URL per line and is the complete list of all recipes already in the CSV. Use this for duplicate checking instead of reading the full CSV.
2. Note which blogs appear frequently in the URLs so you can prioritize less-covered sources.

---

## Step 2 — Find New Recipes

Use BOTH of the following discovery methods:

### Method A: Crawl Approved Sources
For each blog listed in `approved-sources.md`:
- Visit the blog's recipe index URL (listed in that file).
- Find recipe links not already in `urls.txt`.
- Prioritize recent posts (last 6 months) and high-rating recipes.
- Aim to find 3–5 new recipes per blog per run.

### Method B: Open Web Search
Run searches like:
- `"best [cuisine] recipes site:instagrammable food blogs 2024 2025"`
- `"gluten free dinner recipes high rated"`
- `"easy weeknight [protein] recipes"`
- `"meal prep [protein] [cuisine] site:[blog].com"`

Look for recipes that:
- Are from reputable food blogs (well-photographed, clearly tested)
- Are main dishes (Entrees) or notable sides
- Feature one of these proteins: chicken, beef, lamb, pork, fish, seafood, shrimp, tofu
- OR are strong vegetarian/vegan mains

Aim to discover at least 5–10 recipes from web search each run, including from blogs NOT yet in the CSV.

---

## Step 3 — Evaluate Each Recipe

For each new recipe URL found, visit the page and collect the following information. Do NOT add a recipe if you cannot verify these details by reading the actual page.

### Fields to Fill

| Column | What to fill |
|---|---|
| Recipe Title | Exact recipe name from the page heading |
| URL | Full URL of the recipe page |
| Blogger Name | Name of the blog (e.g. "A Cozy Kitchen") |
| Alignment Score | Numeric 0–100 — see `blog-scores.md` |
| Meal Type | One of: Entree, Side Dish, Appetizer, Dessert, Breakfast |
| Cuisine Style | One of the standard cuisine categories (see below) |
| Rating | Format: `4.8 (120 ratings)` — pull from the page if shown. Use `N/A` if not available |
| Notes | 1–2 sentence description. Highlight: technique, key flavors, dietary notes, prep time, why it's CKC-relevant |
| V | `1` if recipe is **natively vegan** (no modifications needed), else `0` |
| V Mod | `1` if recipe **can be made vegan** with simple modifications, else `0` |
| V Mod Notes | How to modify the recipe to be vegan (leave blank if V=1 or not achievable) |
| Vg | `1` if recipe is **natively vegetarian**, else `0` |
| Vg Mod | `1` if recipe **can be made vegetarian** with simple modifications, else `0` |
| Vg Mod Notes | How to modify the recipe to be vegetarian |
| GF | `1` if recipe is **natively gluten-free**, else `0` |
| GF Mod | `1` if recipe **can be made gluten-free** with simple modifications, else `0` |
| GF Mod Notes | How to modify the recipe to be GF (e.g. "Sub soy sauce → tamari") |
| DF | `1` if recipe is **natively dairy-free**, else `0` |
| DF Mod | `1` if recipe **can be made dairy-free** with simple modifications, else `0` |
| DF Mod Notes | How to modify the recipe to be DF (e.g. "Sub butter → olive oil") |
| LH | `1` if recipe is **natively low-histamine**, else `0` |
| LH Mod | `1` if recipe **can be made low-histamine** with simple modifications, else `0` |
| LH Mod Notes | How to modify the recipe to be LH |
| LF | `1` if recipe is **natively low-FODMAP**, else `0` |
| LF Mod | `1` if recipe **can be made low-FODMAP** with simple modifications, else `0` |
| LF Mod Notes | How to modify the recipe to be LF |
| AIP | `1` if recipe is **natively AIP-compliant**, else `0` |
| AIP Mod | `1` if recipe **can be made AIP** with simple modifications, else `0` |
| AIP Mod Notes | How to modify the recipe to be AIP |
| K | `1` if recipe is **natively keto**, else `0` |
| K Mod | `1` if recipe **can be made keto** with simple modifications, else `0` |
| K Mod Notes | How to modify the recipe to be keto |

**Diet tag rules** — see `diet-compliance-rules.md` for full compliance criteria per tag.

**Key principle:** Only apply a Mod tag if the modification leaves the dish recognizably the same recipe. If removing or swapping an ingredient guts the dish (e.g., garlic from Honey Garlic Chicken), leave the tag at 0.

### Cuisine Style Options
Use one of these values exactly:
- American
- Italian
- Mediterranean
- Latin/South American
- Asian
- Middle Eastern
- Indian
- French
- Mexican (use Latin/South American for broader Mexican dishes)

### Alignment Score for New Blogs
If the blog is not in `blog-scores.md`, assess it using this rubric:
- **90–97**: Premium blog. Beautiful photography, highly-tested recipes, clean ingredient lists, approachable for home cooks, strong aesthetic match for CKC clientele.
- **80–89**: Solid blog. Good recipes and photography but may be more casual, less curated, or more mainstream.
- **70–79**: Acceptable. Functional recipes but lower production quality or less style alignment.
- **Below 70**: Do not add — not a quality fit for CKC.

---

## Step 4 — Write to CSV

1. **Write incrementally** — do not wait until all 10 recipes are researched. Append the first 5 rows as soon as they are ready, then research and append the next 5.
2. Append new rows at the bottom of `recipes_source.csv` (after all existing content).
3. Follow the exact column order: `Recipe Title,URL,Blogger Name,Alignment Score,Meal Type,Cuisine Style,Rating,Notes,V,V Mod,V Mod Notes,Vg,Vg Mod,Vg Mod Notes,GF,GF Mod,GF Mod Notes,DF,DF Mod,DF Mod Notes,LH,LH Mod,LH Mod Notes,LF,LF Mod,LF Mod Notes,AIP,AIP Mod,AIP Mod Notes,K,K Mod,K Mod Notes,Protein,Entree Type`
4. Use exactly **34 columns per row** — do not add extra columns.
5. For all diet binary columns (`V`, `V Mod`, `Vg`, `Vg Mod`, etc.) use `1` or `0`. For notes columns (`V Mod Notes`, `Vg Mod Notes`, etc.) use the modification text or leave blank.
5. Properly quote any field that contains commas.
6. Do NOT modify existing rows.
7. Do NOT add blank rows between entries.

---

## Step 5 — Push to GitHub

After writing to the CSV:

```bash
cd "/path/to/repo"
git add recipes_source.csv
git commit -m "feat: add [N] new recipes from [source list] — automated sourcing run [date]"
git push origin main
```

Replace `[N]` with the number of recipes added, `[source list]` with the blog names used, and `[date]` with today's date in YYYY-MM-DD format.

If the push fails due to auth, check that GitHub credentials are configured (see `GITHUB_SETUP.md` if present).

---

## Quality Guidelines

**DO add recipes that:**
- Are well-tested (high ratings with meaningful review count)
- Are visually appealing (good photography evident from the page)
- Are realistic for a private chef to cook for 2–8 people
- Reflect CKC's aesthetic: globally-inspired, ingredient-forward, elevated but not fussy
- Feature fresh, whole ingredients

**DO NOT add recipes that:**
- Are already in the CSV (check URLs)
- Are highly processed or rely on packaged shortcuts (Hamburger Helper, canned soups as base, etc.)
- Are too casual/basic (plain scrambled eggs, simple sandwiches)
- Are desserts unless exceptional and obviously relevant
- Are from low-quality or hard-to-navigate blog sites

---

## Target Volume per Run

- Aim to add **exactly 10 new recipes per run**
- Balance protein types: don't add 3+ of the same protein in one run
- Balance cuisine styles across runs
- Include at least 2–3 recipes with strong diet tag coverage (GF, DF, or AIP) per run
- **Write incrementally**: append the first 5 recipes to the CSV before researching the second 5 — do not hold all recipes in context until the end
