#!/usr/bin/env python3
"""
patch_ingredient_list.py
========================
Applies Rafi's decisions to ingredient_master_list.json before USDA lookups.

Changes applied:
  - Deletes junk entries (section headers, equipment, dish names)
  - Renames ambiguous ingredients to their agreed defaults
  - Flags steak / beans / sweetener / compound sauces → nutrition_needs_review.csv
  - Marks garnish/finish/topping-only items for skipping

Run once, then run build_nutrition_db.py.
"""

import json, csv, os

BASE      = os.path.dirname(os.path.abspath(__file__))
ROOT      = os.path.dirname(BASE)
LIST_JSON = os.path.join(ROOT, 'ingredient_master_list.json')
REVIEW    = os.path.join(ROOT, 'nutrition_needs_review.csv')

with open(LIST_JSON) as f:
    ingredients = json.load(f)

original_count = len(ingredients)

# ── 1. DELETE — not ingredients ───────────────────────────────────────────────
DELETE_NAMES = {
    # PARSE_FAILED junk
    '[parse failed] toppings:',
    '[parse failed] &#8212;&#8212;',
    '[parse failed] a spice mill or mortar and pestle',
    '[parse failed] topping:',
    '[parse failed] for toppings:',
    '[parse failed] for the italian dressing:',
    '[parse failed] for the salmon burgers:',
    '[parse failed] for the wasabi mayonnaise:',
    '[parse failed] optional garnishes you might want to serve:',
    '[parse failed] serve over arugula with a drizzle of olive oil, or spread on',
    '[parse failed] sauce:',
    '[parse failed] rolling pin',
    '[parse failed] parchment paper for lining',
    '[parse failed] steamer &#8211; either a bamboo steamer or any standard stea',
    '[parse failed] for the fish:',
    '[parse failed] for the cucumber salad:',
    '[parse failed] for the cauliflower purée:',
    '[parse failed] tandoori chicken skewers',
    '[parse failed] cumin-turmeric rice',
    '[parse failed] spicy cilantro chutney',
    '[parse failed] garnish and serving:',
    # Equipment
    'freezer bag',
    'cast iron skillet',
    # Dish names / sides (not base ingredients)
    'mediterranean salad',
    'house salad',
    'garlic bread',
    'tacos',
    'cilantro lime coconut rice',
    'lime chips',
    # Garnish / topping / serving context only
    'toppings',
    'pizza toppings',
    'salad',
    'sauce',          # too vague + always garnish context
    'stuffing',
    'cooking liquid', # pan drippings / not a purchasable ingredient
}

# ── 2. RENAME — apply agreed defaults ─────────────────────────────────────────
RENAME = {
    # Generic oils → extra virgin olive oil
    'oil':                          'olive oil, extra virgin',
    'cooking oil':                  'olive oil, extra virgin',
    'neutral oil':                  'olive oil, extra virgin',
    'vegetable oil':                'olive oil, extra virgin',
    'oil spray':                    'olive oil, extra virgin',
    'cooking spray':                'olive oil, extra virgin',

    # Flour
    'flour':                        'all-purpose flour',

    # Rice
    'rice':                         'white rice, long-grain, raw',
    'cooked rice':                  'white rice, long-grain, cooked',

    # Pasta
    'pasta':                        'pasta, dry, enriched',
    'long noodles':                 'pasta, dry, enriched',
    'cooked grain':                 'white rice, long-grain, cooked',

    # Bread
    'bread':                        'bread, white, commercially prepared',
    'burger buns':                  'bread, white, commercially prepared',

    # Broth / stock defaults
    'broth':                        'chicken broth',
    'bone broth':                   'chicken bone broth',
    'water or stock':               'chicken broth',
    'chicken or vegetable stock':   'chicken broth',
    'vegetable or chicken stock':   'chicken broth',
    'chicken or vegetable broth':   'chicken broth',
    'chicken or turkey bone broth': 'chicken bone broth',
    'veggie stock':                 'vegetable broth',
    'veggie broth':                 'vegetable broth',
    'vegetable stock':              'vegetable broth',
    'vegetable or chicken stock':   'chicken broth',

    # Coconut milk → full fat unsweetened
    'coconut milk':                 'coconut milk, full fat, unsweetened',

    # Vinegar defaults
    'vinegar':                      'white wine vinegar',
    'white or red wine vinegar':    'white wine vinegar',

    # Mustard default
    'mustard':                      'yellow mustard',

    # Pepper (just "pepper" = black pepper spice)
    'pepper':                       'black pepper',

    # White fish defaults → halibut
    'white fish':                   'halibut, raw',
    'firm white fish':              'halibut, raw',
    'skinless halibut or cod fillet': 'halibut, raw',
    'whole fish':                   'halibut, raw',
    'assorted fish':                'halibut, raw',

    # Cheese default → mozzarella
    'cheese':                       'mozzarella cheese',
    'white cheddar or pepper jack cheese': 'mozzarella cheese',

    # Clearly resolvable multi-option entries
    'escarole':                     'escarole (endive), raw',
    'dry white wine':               'wine, table, white',
    'tamari':                       'tamari soy sauce',
    'polenta':                      'cornmeal, whole grain',
    'sunflower oil':                'oil, sunflower, linoleic',
    'arak':                         'alcoholic beverage, distilled, all',
    'urfa chilli flakes':           'spices, pepper, red or cayenne',
    'frozen peas and carrots':      'peas and carrots, frozen, unprepared',
    'fish broth':                   'fish stock',
    'lamb stock':                   'lamb broth',
}

# ── 3. NEEDS_REVIEW — Rafi to specify ─────────────────────────────────────────
NEEDS_REVIEW = {
    'steak': {
        'issue': 'Type not specified. Options: sirloin, ribeye, flank, skirt, tenderloin, strip',
        'instruction': 'Fill in "your_correction" with the specific cut to use as default'
    },
    'bean': {
        'issue': 'Type not specified. Options: black beans, pinto beans, kidney beans, chickpeas, cannellini',
        'instruction': 'Fill in your default bean type'
    },
    'dried beans': {
        'issue': 'Type not specified. Same as above — which bean to use as default?',
        'instruction': 'Fill in your default bean type'
    },
    'sweetener': {
        'issue': 'Type not specified. Options: honey, maple syrup, granulated sugar, coconut sugar',
        'instruction': 'Fill in your default sweetener'
    },
    'grain of choice': {
        'issue': 'Too vague. Options: white rice, brown rice, quinoa, couscous, farro',
        'instruction': 'Fill in your default grain'
    },
    'grains':          {'issue': 'Too vague — what grain?', 'instruction': 'Fill in default grain'},
    'grain':           {'issue': 'Too vague — what grain?', 'instruction': 'Fill in default grain'},
    'seeds':           {'issue': 'Too vague — pumpkin? sesame? sunflower?', 'instruction': 'Fill in default seed'},
    'nuts':            {'issue': 'Too vague — almonds? walnuts? cashews?', 'instruction': 'Fill in default nut'},
    'protein':         {'issue': 'Too vague — what protein?', 'instruction': 'Fill in default protein'},
    'white sauce':     {'issue': 'Too vague — béchamel? cream sauce?', 'instruction': 'Fill in what this usually is in your recipes'},
    'soft herbs':          {'issue': 'Too vague', 'instruction': 'Specify or skip'},
    'fresh herbs':         {'issue': 'Too vague', 'instruction': 'Specify or skip'},
    'herbs':               {'issue': 'Too vague', 'instruction': 'Specify or skip'},
    'mixed herbs':         {'issue': 'Too vague', 'instruction': 'Specify or skip'},
    'hard herbs':          {'issue': 'Too vague', 'instruction': 'Specify or skip'},
    'hardy herbs':         {'issue': 'Too vague', 'instruction': 'Specify or skip'},
    'tender herbs':        {'issue': 'Too vague', 'instruction': 'Specify or skip'},
    'fresh leafy herbs':   {'issue': 'Too vague', 'instruction': 'Specify or skip'},
    'leafy herbs':         {'issue': 'Too vague', 'instruction': 'Specify or skip'},
    'mixed tender herbs':  {'issue': 'Too vague', 'instruction': 'Specify or skip'},
    'greens':              {'issue': 'Too vague — spinach? kale? mixed?', 'instruction': 'Specify or skip'},
    'sturdy greens':       {'issue': 'Too vague', 'instruction': 'Specify or skip'},
    'mixed vegetables':    {'issue': 'Too vague', 'instruction': 'Specify or skip'},
    'seasonal vegetables': {'issue': 'Too vague', 'instruction': 'Specify or skip'},
    'vegetables':          {'issue': 'Too vague', 'instruction': 'Specify or skip'},
    'veggies':             {'issue': 'Too vague', 'instruction': 'Specify or skip'},
}

# ── 4. COMPOUND SAUCES — map to USDA branded (flag for review) ─────────────────
COMPOUND_SAUCES = {
    'teriyaki sauce':           'Search USDA Branded: Kikkoman Teriyaki Sauce',
    'enchilada sauce':          'Search USDA Branded: Las Palmas Enchilada Sauce',
    'sriracha mayo':            'Search USDA Branded: sriracha mayo',
    'yum yum sauce':            'Search USDA Branded: yum yum sauce',
    'garlic aioli':             'Search USDA Branded: garlic aioli',
    'honey mustard sauce':      'Search USDA Branded: honey mustard',
    'miso marinade':            'Compound — suggest mapping to white miso paste',
    'salmon rub':               'Compound spice blend — suggest skipping or mapping to spice mix',
    'bbq dry rub':              'Compound spice blend — suggest skipping or mapping to spice mix',
    'brown sugar bbq dry rub':  'Compound spice blend — suggest skipping or mapping to spice mix',
    'al pastor marinade':       'Compound — suggest mapping to achiote paste',
    'szechuan sauce':           'Search USDA Branded: Szechuan sauce',
    'salsa roja':               'Search USDA Branded: salsa, red, ready-to-serve',
    'moroccan spice blend':     'Compound — suggest mapping to ras el hanout',
    'tuscan marry me blend':    'Compound spice blend — suggest skipping',
    'coriander-mint yogurt':    'Compound — suggest mapping to plain greek yogurt',
    'tahini green goddess dressing': 'Compound — suggest mapping to tahini',
    'za\'atar vinaigrette':     'Compound — suggest mapping to za\'atar spice mix',
    'avocado lime dressing':    'Compound — suggest mapping to avocado + lime juice',
    'firecracker marinade':     'Compound — suggest skipping or mapping to hot sauce',
    'garlicky tahini':          'Compound — suggest mapping to tahini',
    'slaw':                     'Compound — suggest mapping to coleslaw mix',
    'white sauce':              'Too vague — béchamel? Needs your input',
    'sautéed mushrooms':        'Compound — suggest mapping to mushrooms, raw',
    'honey mustard sauce':      'Compound — search USDA Branded: honey mustard',
    'assorted fish':            'Already defaulted to halibut',
}

# ── Apply changes ─────────────────────────────────────────────────────────────
review_rows = []
new_list = []
deleted = 0
renamed = 0
flagged_review = 0
flagged_compound = 0

# Build name lookup for quick access
name_index = {item['name'].lower(): item for item in ingredients}

for item in ingredients:
    name = item['name'].lower()

    # Delete
    if name in DELETE_NAMES:
        deleted += 1
        continue

    # Rename
    if name in RENAME:
        item['name'] = RENAME[name]
        item['flag'] = 'RENAMED'
        renamed += 1
        new_list.append(item)
        continue

    # Needs review
    if name in NEEDS_REVIEW:
        review_rows.append({
            'ingredient': item['name'],
            'issue': NEEDS_REVIEW[name]['issue'],
            'raw_example': item.get('raw_examples', [''])[0],
            'usda_candidates': '',
            'your_correction': ''
        })
        item['flag'] = 'NEEDS_REVIEW'
        flagged_review += 1
        new_list.append(item)
        continue

    # Compound sauces
    if name in COMPOUND_SAUCES:
        review_rows.append({
            'ingredient': item['name'],
            'issue': f'Compound ingredient. {COMPOUND_SAUCES[name]}',
            'raw_example': item.get('raw_examples', [''])[0],
            'usda_candidates': '',
            'your_correction': ''
        })
        item['flag'] = 'COMPOUND'
        flagged_compound += 1
        new_list.append(item)
        continue

    # Keep as-is
    new_list.append(item)

# ── Deduplicate by name (renaming may create duplicates) ─────────────────────
seen = {}
deduped = []
dupes = 0
for item in new_list:
    name = item['name'].lower()
    if name in seen:
        dupes += 1
        # Merge raw_examples
        existing = seen[name]
        existing['raw_examples'] = list(set(
            existing.get('raw_examples', []) + item.get('raw_examples', [])
        ))[:3]
        existing['count'] = existing.get('count', 0) + item.get('count', 0)
    else:
        seen[name] = item
        deduped.append(item)

# ── Save ──────────────────────────────────────────────────────────────────────
with open(LIST_JSON, 'w') as f:
    json.dump(deduped, f, indent=2)

# Write needs_review CSV
if review_rows:
    with open(REVIEW, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'ingredient', 'issue', 'raw_example', 'usda_candidates', 'your_correction'
        ])
        writer.writeheader()
        writer.writerows(review_rows)

# ── Summary ────────────────────────────────────────────────────────────────────
print(f'── Patch complete ────────────────────────────────────')
print(f'  Original count:         {original_count}')
print(f'  Deleted (junk):         {deleted}')
print(f'  Renamed to defaults:    {renamed}')
print(f'  Merged duplicates:      {dupes}')
print(f'  Final unique count:     {len(deduped)}')
print(f'  Flagged for your review:{flagged_review + flagged_compound}')
print(f'    → Needs your input:   {flagged_review}')
print(f'    → Compound sauces:    {flagged_compound}')
print()
print(f'  Review file saved:      nutrition_needs_review.csv')
print(f'  Updated list saved:     ingredient_master_list.json')
print()
print(f'Next: open nutrition_needs_review.csv, fill in "your_correction" column,')
print(f'then run build_nutrition_db.py')
