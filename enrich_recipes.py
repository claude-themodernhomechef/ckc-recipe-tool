#!/usr/bin/env python3
"""
Recipe Enrichment Script
=========================
For all recipes missing a rating OR missing diet tags:
  1. Fetches the recipe page
  2. Extracts JSON-LD structured data (aggregateRating + recipeIngredient)
  3. Determines diet tags from ingredient analysis following CKC_Diet_Compliance_Rules.md
  4. Writes results back to recipes_source.csv

Core rule: Never apply a mod tag if the swap would fundamentally gut the dish.
The modified dish must still be recognizably the same recipe.

Run:  python3 enrich_recipes.py
Resume-safe: already-filled fields are never overwritten.
"""

import csv, json, re, sys, time, os
import requests
from bs4 import BeautifulSoup

CSV_FILE     = 'recipes_source.csv'
PROGRESS_LOG = 'enrich_progress.json'
SLEEP_SEC    = 0.8
TAGS         = ['V', 'Vg', 'GF', 'DF', 'LH', 'LF', 'AIP', 'K']

SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
})

# ---------------------------------------------------------------------------
# Known plant-based blogs — recipes from these are natively V + Vg + DF
# ---------------------------------------------------------------------------
VEGAN_BLOGS = [
    'minimalist baker', 'vegan richa', 'jessica in the kitchen',
    'the simple veganista', 'this savory vegan', 'orchids + sweet tea',
    'orchids and sweet tea',
]
VEGETARIAN_BLOGS = [
    'cookie and kate', 'love and lemons',
]

# ---------------------------------------------------------------------------
# Ingredient keyword lists
# ---------------------------------------------------------------------------

# Main animal proteins — if in TITLE, the dish identity is that protein → no V/Vg
MEAT_TITLE_KW = [
    'chicken', 'beef', 'pork', 'lamb', 'turkey', 'salmon', 'shrimp', 'prawn',
    'tuna', 'cod', 'halibut', 'tilapia', 'steak', 'duck', 'veal', 'bison',
    'sausage', 'chorizo', 'bacon', 'ham', 'mahi', 'snapper', 'trout',
    'sea bass', 'branzino', 'scallop', 'crab', 'lobster', 'clam', 'mussel',
    'oyster', 'fish', 'meat', 'carnitas', 'carne', 'brisket', 'ribs',
    'wings', 'drumstick', 'thigh', 'breast', 'ground beef', 'ground turkey',
    'ground pork', 'ground chicken', 'pulled pork', 'pulled chicken',
]

# Animal proteins in ingredients (broader than title)
MEAT_ING_KW = MEAT_TITLE_KW + [
    'anchovies', 'anchovy', 'sardine', 'mackerel', 'bone broth',
    'worcestershire', 'lard', 'suet',
]

FISH_SAUCE_KW    = ['fish sauce']
CHICKEN_BROTH_KW = ['chicken broth', 'chicken stock', 'chicken bouillon']
ANCHOVY_KW       = ['anchovy', 'anchovies', 'anchovy paste']

EGG_KW = ['egg', 'eggs', 'egg white', 'egg yolk', 'beaten egg', 'hard boiled']

DAIRY_KW = [
    'milk', 'whole milk', 'skim milk', '2% milk', 'buttermilk',
    'heavy cream', 'heavy whipping cream', 'light cream', 'half and half',
    'butter', 'unsalted butter', 'salted butter',
    'cream cheese', 'sour cream', 'creme fraiche', 'crème fraîche',
    'yogurt', 'greek yogurt', 'plain yogurt', 'kefir',
    'parmesan', 'parmigiano', 'mozzarella', 'cheddar', 'gruyere', 'gruyère',
    'ricotta', 'feta', 'goat cheese', 'blue cheese', 'brie', 'camembert',
    'mascarpone', 'cotija', 'queso', 'manchego', 'pecorino',
    'whipping cream', 'condensed milk', 'evaporated milk',
    'ghee', 'cheese',
]

# Dairy keywords that appear in TITLE and signal dairy IS the dish identity
DAIRY_TITLE_IDENTITY_KW = [
    'feta', 'parmesan', 'parmigiano', 'cheese', 'cheesy', 'mozzarella',
    'ricotta', 'brie', 'gruyere', 'cheddar', 'mac and cheese', 'queso',
    'alfredo', 'carbonara',
]

# Gluten-containing ingredients
GLUTEN_KW = [
    'flour', 'all-purpose flour', 'wheat flour', 'wheat',
    'pasta', 'orzo', 'couscous', 'farro', 'spelt', 'barley', 'rye',
    'bread', 'breadcrumbs', 'panko', 'crouton',
    'naan', 'pita', 'tortilla wrap',
    'soy sauce',  # contains wheat unless specified as tamari
    'ramen noodles', 'lo mein', 'chow mein', 'wonton', 'dumpling wrapper',
    'gnocchi', 'tortellini', 'ravioli', 'linguine', 'penne', 'spaghetti',
    'udon', 'egg noodles', 'oyster sauce', 'hoisin sauce', 'worcestershire sauce',
]

# Grain/carb identity of the dish (if in title → no GF mod, would gut the dish)
GRAIN_TITLE_IDENTITY_KW = [
    'pasta', 'orzo', 'ramen', 'noodle', 'noodles', 'risotto', 'couscous',
    'gnocchi', 'ravioli', 'tortellini', 'linguine', 'penne', 'spaghetti',
    'fettuccine', 'udon', 'lo mein', 'chow mein', 'dumpling', 'wonton',
    'pot pie', 'bread', 'flatbread',
]

# Gluten that is a single easy background swap (soy sauce → tamari)
GLUTEN_EASY_SWAP_KW = ['soy sauce']

# Keto disqualifiers
KETO_DISQ_KW = [
    'rice', 'pasta', 'noodle', 'bread', 'flour', 'couscous', 'orzo',
    'quinoa', 'oat', 'barley', 'corn', 'tortilla',
    'bean', 'lentil', 'chickpea', 'pea', 'edamame',
    'potato', 'sweet potato', 'yam',
    'honey', 'sugar', 'brown sugar', 'maple syrup',
    'mango', 'banana', 'pineapple', 'dried fruit', 'raisin', 'date',
    'teriyaki', 'hoisin', 'bbq sauce', 'ketchup',
]
# Keto items that are identity of the dish → no K mod
KETO_TITLE_IDENTITY_KW = [
    'pasta', 'rice', 'risotto', 'noodle', 'noodles', 'ramen',
    'couscous', 'orzo', 'gnocchi', 'ravioli', 'tortellini',
    'potato', 'yam',
]
# Background sweeteners that are easy to swap → allulose
KETO_EASY_SWAP_KW = ['honey', 'sugar', 'brown sugar', 'maple syrup']
# Grain/starch swaps — moddable if not in title (cauliflower rice, etc.)
KETO_GRAIN_SWAP_KW = ['rice', 'quinoa']
KETO_POTATO_SWAP_KW = ['potato', 'sweet potato', 'yam']
KETO_PASTA_SWAP_KW  = ['pasta', 'couscous', 'orzo', 'noodle', 'ramen']

# AIP disqualifiers
NIGHTSHADE_KW = [
    'tomato', 'pepper', 'paprika', 'chili', 'chile', 'cayenne',
    'eggplant', 'aubergine', 'potato ', 'goji', 'harissa',
]
NUT_SEED_KW = [
    'almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut',
    'sesame', 'tahini', 'sunflower seed', 'pumpkin seed', 'chia', 'flax',
    'hemp seed', 'peanut', 'pine nut',
    # seed-based spices (all disqualified on AIP)
    'cumin', 'coriander', 'fennel seed', 'mustard', 'cardamom',
    'anise', 'nutmeg', 'celery seed', 'sumac', "za'atar", 'caraway',
    'fenugreek', 'black pepper', 'taco seasoning', 'curry powder',
    'italian seasoning', '7 spice',
]
GRAIN_AIP_KW = [
    'rice', 'oat', 'wheat', 'corn', 'quinoa', 'buckwheat', 'amaranth',
    'flour', 'bread', 'pasta', 'noodle', 'couscous', 'barley', 'rye',
    'farro', 'spelt',
]
LEGUME_KW = [
    'bean', 'lentil', 'chickpea', 'pea ', ' peas', 'soy', 'tofu',
    'tempeh', 'edamame', 'peanut',
]
COCOA_KW    = ['chocolate', 'cocoa', 'cacao']
ALCOHOL_KW  = ['wine', 'beer ', 'champagne', 'bourbon', 'whiskey', 'vodka',
               'rum ', 'brandy', 'sherry', 'sake', 'mirin']

# Low-FODMAP disqualifiers (per CKC_Diet_Compliance_Rules.md)
# Easy swap: garlic/onion/shallot/leek/garlic powder/onion powder → garlic-infused oil or scallion greens
# Hard (remove or skip LF entirely): legumes, fruits, cauliflower, asparagus, mushrooms, fennel, corn
FODMAP_DISQ_KW = [
    'garlic', 'onion', 'shallot', 'leek', 'garlic powder', 'onion powder',
    'wheat', 'rye', 'barley',
    'bean', 'lentil', 'chickpea', 'cashew', 'pistachio', 'edamame',
    'apple ', 'pear ', 'mango', 'watermelon', 'honey', 'agave',
    'milk', 'ice cream', 'yogurt', 'cream cheese', 'ricotta', 'soft cheese',
    'cauliflower', 'asparagus', 'mushroom', 'fennel', 'corn',
]
FODMAP_EASY_SWAP_KW = ['garlic', 'onion', 'shallot', 'leek', 'garlic powder', 'onion powder']
FODMAP_HARD_KW = [
    'bean', 'lentil', 'chickpea', 'cashew', 'pistachio', 'edamame',
    'apple ', 'pear ', 'mango', 'watermelon',
    'cauliflower', 'asparagus', 'mushroom', 'fennel', 'corn',
]

# Low-histamine disqualifiers
# NOTE: coconut aminos is NOT a disqualifier — it is the LH-safe swap for soy sauce
HISTAMINE_DISQ_KW = [
    'vinegar', 'wine', 'beer', 'champagne', 'alcohol',
    'tomato', 'spinach', 'avocado',
    'soy sauce', 'fish sauce', 'miso', 'kimchi', 'sauerkraut', 'pickl',
    'tamari',
    'aged cheese', 'parmesan', 'blue cheese', 'cheddar', 'gruyere', 'feta',
    'smoked salmon', 'canned tuna', 'canned fish', 'anchovies', 'sardine',
    'mushroom', 'strawberr', 'pineapple', 'ketchup', 'mustard',
    'worcestershire', 'hot sauce', 'sriracha',
    'chocolate', 'cocoa',
    'onion', 'garlic',
    'cumin', 'paprika', 'cayenne', 'chili', 'smoked paprika',
    'sesame', 'tahini', 'walnut', 'cashew', 'peanut', 'almond flour',
    'sumac', 'canola oil',
]


def contains_any(text_lower, keywords):
    return any(kw in text_lower for kw in keywords)


def title_contains_any(title_lower, keywords):
    return any(kw in title_lower for kw in keywords)


def join_sentences(parts):
    """Join a list of note fragments into proper natural-language sentences."""
    sentences = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        p = p[0].upper() + p[1:]
        if not p.endswith('.'):
            p += '.'
        sentences.append(p)
    return ' '.join(sentences)


def classify_diet_tags(ingredients, recipe_title='', blogger_name=''):
    """
    Classify diet tags following CKC_Diet_Compliance_Rules.md.
    Core rule: never apply a mod if it would gut the dish.
    Returns: {tag: {'native': bool, 'mod': bool, 'notes': str}}
    """
    ing_text      = ' '.join(ingredients).lower()
    title_lower   = recipe_title.lower()
    blogger_lower = blogger_name.lower()
    tags_out      = {}

    # Pre-compute presence flags
    has_meat        = contains_any(ing_text, MEAT_ING_KW)
    has_meat_title  = title_contains_any(title_lower, MEAT_TITLE_KW)
    has_egg         = contains_any(ing_text, EGG_KW)
    has_dairy       = contains_any(ing_text, DAIRY_KW)
    has_gluten      = contains_any(ing_text, GLUTEN_KW)
    has_alcohol     = contains_any(ing_text, ALCOHOL_KW)

    is_vegan_blog = any(b in blogger_lower for b in VEGAN_BLOGS)
    is_veg_blog   = any(b in blogger_lower for b in VEGETARIAN_BLOGS)

    # -------------------------------------------------------------------------
    # V — Vegan
    # Native if: from a known vegan blog, OR no animal products whatsoever.
    # Mod only if: dairy/egg are background AND meat is not in the title.
    # Cascade: known vegan blog also gets DF natively.
    # -------------------------------------------------------------------------
    if is_vegan_blog:
        tags_out['V']  = {'native': True, 'mod': False, 'notes': ''}
        tags_out['Vg'] = {'native': True, 'mod': False, 'notes': ''}
        tags_out['DF'] = {'native': True, 'mod': False, 'notes': ''}
    elif not has_meat and not has_egg and not has_dairy:
        tags_out['V'] = {'native': True, 'mod': False, 'notes': ''}
    elif not has_meat_title and not has_meat and (has_egg or has_dairy):
        # Vegetable-forward dish with only egg/dairy as background — moddable
        subs = []
        if has_egg:
            subs.append('replace the egg with a flax egg — mix 2 tablespoons ground flaxseed with 1 tablespoon water')
        if has_dairy:
            subs.append('use plant-based dairy alternatives')
            subs.append('replace chicken broth with vegetable broth')
        tags_out['V'] = {'native': False, 'mod': True, 'notes': join_sentences(subs)}
    # else: meat in title or ingredients — gutting the dish. Leave blank.

    # -------------------------------------------------------------------------
    # Vg — Vegetarian
    # -------------------------------------------------------------------------
    if 'Vg' not in tags_out:  # skip if already set by vegan blog cascade
        if is_veg_blog:
            tags_out['Vg'] = {'native': True, 'mod': False, 'notes': ''}
        elif not has_meat:
            tags_out['Vg'] = {'native': True, 'mod': False, 'notes': ''}
        elif has_meat_title:
            # Meat is in the title — it IS the dish. Leave blank.
            pass
        else:
            # Meat in ingredients but NOT title — mod only if purely background seasoning
            background_only = (
                contains_any(ing_text, FISH_SAUCE_KW + CHICKEN_BROTH_KW + ANCHOVY_KW)
                and not any(
                    kw in ing_text
                    for kw in MEAT_ING_KW
                    if kw not in (FISH_SAUCE_KW + CHICKEN_BROTH_KW + ANCHOVY_KW +
                                  ['fish sauce', 'chicken broth', 'chicken stock',
                                   'chicken bouillon', 'anchovy', 'anchovies', 'anchovy paste'])
                )
            )
            if background_only:
                subs = []
                if contains_any(ing_text, FISH_SAUCE_KW):
                    subs.append('replace fish sauce with extra soy sauce and a squeeze of lime')
                if contains_any(ing_text, CHICKEN_BROTH_KW):
                    subs.append('replace chicken broth with vegetable broth')
                if contains_any(ing_text, ANCHOVY_KW):
                    subs.append('replace anchovy paste with 1 tablespoon tamari and 1 tablespoon capers with their juice')
                tags_out['Vg'] = {'native': False, 'mod': True, 'notes': join_sentences(subs)}

    # -------------------------------------------------------------------------
    # GF — Gluten-Free
    # Native if no gluten ingredients.
    # Mod only if the gluten is a background swap that doesn't gut the dish.
    # If grain IS the dish (pasta, orzo, ramen in title) — leave blank.
    # -------------------------------------------------------------------------
    if 'GF' not in tags_out:  # skip if already set by cascade
        if not has_gluten:
            tags_out['GF'] = {'native': True, 'mod': False, 'notes': ''}
        else:
            grain_in_title = title_contains_any(title_lower, GRAIN_TITLE_IDENTITY_KW)
            # Check what gluten sources are present
            gluten_hits = [kw for kw in GLUTEN_KW if kw in ing_text]
            only_soy_sauce = gluten_hits == ['soy sauce'] or all(kw in GLUTEN_EASY_SWAP_KW for kw in gluten_hits)

            if only_soy_sauce:
                tags_out['GF'] = {'native': False, 'mod': True,
                                  'notes': 'Replace soy sauce with tamari.'}
            elif not grain_in_title:
                subs = []
                if 'soy sauce' in ing_text:
                    subs.append('replace soy sauce with tamari')
                if 'oyster sauce' in ing_text:
                    subs.append('replace oyster sauce with a GF variety')
                if 'hoisin sauce' in ing_text:
                    subs.append('replace hoisin sauce with GF hoisin sauce')
                if 'worcestershire sauce' in ing_text:
                    subs.append('use GF Worcestershire sauce')
                if contains_any(ing_text, ['flour', 'all-purpose flour', 'wheat flour']):
                    # Distinguish thickener vs structural based on context
                    if contains_any(ing_text, ['gravy', 'sauce', 'au jus', 'thicken']):
                        subs.append('replace flour with 2 tablespoons arrowroot powder to thicken the sauce')
                    else:
                        subs.append('replace all-purpose flour with a 1:1 GF flour blend')
                if contains_any(ing_text, ['breadcrumbs', 'panko']):
                    subs.append('use GF panko')
                if 'pasta' in ing_text:
                    subs.append('replace pasta with a GF alternative — we like brown rice pasta for the most comparable texture')
                if 'orzo' in ing_text:
                    subs.append('use GF orzo such as cassava flour orzo')
                if 'couscous' in ing_text:
                    subs.append('replace couscous with GF couscous or cauliflower rice')
                if contains_any(ing_text, ['ramen noodles', 'lo mein', 'chow mein', 'udon', 'egg noodles']):
                    subs.append('replace with a brown rice noodle alternative')
                if contains_any(ing_text, ['tortilla wrap', 'flour tortilla']):
                    subs.append('replace flour tortillas with corn tortillas or a GF variety')
                if contains_any(ing_text, ['pita', 'naan']):
                    subs.append('use GF bread alternative')
                if subs:
                    tags_out['GF'] = {'native': False, 'mod': True, 'notes': join_sentences(subs)}
            # grain_in_title and structural → leave blank (would gut the dish)

    # -------------------------------------------------------------------------
    # DF — Dairy-Free
    # Native if no dairy.
    # Mod only if dairy is background and can be swapped without gutting the dish.
    # If cheese/cream IS the identity (in title) — leave blank.
    # -------------------------------------------------------------------------
    if 'DF' not in tags_out:  # skip if already set by vegan blog cascade
        if not has_dairy:
            tags_out['DF'] = {'native': True, 'mod': False, 'notes': ''}
        else:
            dairy_in_title_identity = title_contains_any(title_lower, DAIRY_TITLE_IDENTITY_KW)
            if not dairy_in_title_identity:
                subs = []
                if contains_any(ing_text, ['butter', 'unsalted butter', 'salted butter']):
                    subs.append('replace butter with olive oil')
                if contains_any(ing_text, ['ghee']):
                    subs.append('replace ghee with olive oil or coconut oil')
                if contains_any(ing_text, ['heavy cream', 'heavy whipping cream', 'whipping cream']):
                    subs.append('replace heavy cream with full-fat canned coconut milk')
                if contains_any(ing_text, ['half and half', 'light cream']):
                    subs.append('replace half-and-half with coconut milk')
                if contains_any(ing_text, ['buttermilk']):
                    subs.append('replace buttermilk with 1 tablespoon vinegar combined with 1/3 cup soy milk, rested for 10 minutes')
                if contains_any(ing_text, ['milk', 'whole milk', 'skim milk', '2% milk', 'condensed milk', 'evaporated milk']):
                    subs.append('use a plant-based milk alternative')
                if contains_any(ing_text, ['yogurt', 'greek yogurt', 'plain yogurt', 'kefir']):
                    subs.append('replace Greek yogurt with plain unsweetened coconut yogurt')
                if contains_any(ing_text, ['sour cream', 'creme fraiche', 'crème fraîche']):
                    subs.append('replace sour cream with a dairy-free alternative')
                if contains_any(ing_text, ['cream cheese', 'mascarpone']):
                    subs.append('use dairy-free cream cheese')
                # Cheese — distinguish by type and role
                if contains_any(ing_text, ['parmesan', 'parmigiano', 'pecorino']):
                    subs.append('replace parmesan with nutritional yeast and 1 tablespoon miso paste or porcini mushroom powder')
                if contains_any(ing_text, ['mozzarella', 'ricotta']):
                    subs.append('replace mozzarella and ricotta with Kite Hill brand dairy-free alternatives')
                if 'feta' in ing_text:
                    subs.append('remove feta cheese or replace with a dairy-free feta if it is a core ingredient')
                if 'cotija' in ing_text:
                    subs.append('remove cotija')
                if contains_any(ing_text, ['goat cheese', 'blue cheese', 'brie', 'camembert',
                                           'cheddar', 'gruyere', 'manchego', 'queso']):
                    subs.append('omit or replace cheese with a dairy-free alternative')
                if subs:
                    tags_out['DF'] = {'native': False, 'mod': True, 'notes': join_sentences(subs)}

    # -------------------------------------------------------------------------
    # K — Keto
    # Native if no high-carb ingredients.
    # Mod only if the carb element is swappable (grain → cauliflower, sweetener → allulose).
    # Do NOT mod if the grain/starch IS the dish (in title).
    # -------------------------------------------------------------------------
    keto_disq_present = contains_any(ing_text, KETO_DISQ_KW)
    if not keto_disq_present:
        tags_out['K'] = {'native': True, 'mod': False, 'notes': ''}
    else:
        keto_in_title = title_contains_any(title_lower, KETO_TITLE_IDENTITY_KW)
        hits      = [kw for kw in KETO_DISQ_KW if kw in ing_text]
        hard_hits = [kw for kw in hits if kw not in KETO_EASY_SWAP_KW]
        easy_hits = [kw for kw in hits if kw in KETO_EASY_SWAP_KW]

        if not keto_in_title:
            subs = []
            # Easy sweetener swaps
            if easy_hits:
                if 'honey' in easy_hits:
                    subs.append('replace honey with a liquid allulose sweetener')
                elif contains_any(str(easy_hits), ['sugar', 'brown sugar', 'maple syrup']):
                    subs.append('replace the sweetener with allulose')
            # Grain/starch swaps (only if not in title)
            if contains_any(ing_text, ['rice']) and not title_contains_any(title_lower, ['rice', 'risotto']):
                subs.append('substitute white rice with cauliflower rice')
            if contains_any(ing_text, ['quinoa']):
                subs.append('serve over cooked vegetables instead of quinoa')
            if contains_any(ing_text, ['couscous']):
                subs.append('replace couscous with cauliflower rice')
            if contains_any(ing_text, ['potato', 'sweet potato', 'yam']):
                if 'mashed' in ing_text or 'mash' in title_lower:
                    subs.append('replace mashed potato with cauliflower mash')
                else:
                    subs.append('replace potatoes with roasted cauliflower florets or remove')
            if contains_any(ing_text, ['corn']) and 'corn tortilla' not in ing_text:
                subs.append('remove corn')
            if contains_any(ing_text, ['bean', 'lentil', 'chickpea']):
                subs.append('remove beans from the recipe')
            if contains_any(ing_text, ['tortilla']) and 'corn tortilla' not in ing_text:
                subs.append('use keto-friendly tortillas')
            if subs:
                tags_out['K'] = {'native': False, 'mod': True, 'notes': join_sentences(subs)}

    # -------------------------------------------------------------------------
    # AIP — Autoimmune Protocol
    # Very strict. Only native if genuinely AIP-compliant.
    # Only mod if disqualifier count is 1-2 and swaps don't gut the dish.
    # -------------------------------------------------------------------------
    aip_blocks = {
        'nightshade': contains_any(ing_text, NIGHTSHADE_KW),
        'nut/seed':   contains_any(ing_text, NUT_SEED_KW),
        'grain':      contains_any(ing_text, GRAIN_AIP_KW),
        'legume':     contains_any(ing_text, LEGUME_KW),
        'egg':        has_egg,
        'dairy':      has_dairy,
        'alcohol':    has_alcohol,
        'cocoa':      contains_any(ing_text, COCOA_KW),
    }
    active_blocks = [k for k, v in aip_blocks.items() if v]

    if not active_blocks:
        tags_out['AIP'] = {'native': True, 'mod': False, 'notes': ''}
    elif len(active_blocks) <= 2 and 'grain' not in active_blocks and 'legume' not in active_blocks:
        # 1-2 disqualifiers, no grain or legume — potentially moddable
        subs = []
        if aip_blocks['nightshade']:
            if contains_any(ing_text, ['soy sauce', 'tamari']):
                subs.append('replace soy sauce with coconut aminos')
            if contains_any(ing_text, ['tomato']):
                subs.append('omit tomatoes or replace with roasted beets or butternut squash for color')
            if contains_any(ing_text, ['bell pepper', 'pepper']):
                subs.append('replace bell peppers with celery or zucchini')
            if contains_any(ing_text, ['paprika', 'chili', 'cayenne', 'black pepper', 'cumin', 'mustard']):
                subs.append('replace seed-based spices with turmeric, ginger, cinnamon, or fresh herbs')
            if contains_any(ing_text, ['curry powder']):
                subs.append('replace curry powder with turmeric')
        if aip_blocks['nut/seed']:
            if contains_any(ing_text, ['soy sauce']):
                subs.append('replace soy sauce with coconut aminos')
            if contains_any(ing_text, ['miso']):
                subs.append('replace miso with coconut aminos')
            if contains_any(ing_text, ['fish sauce']):
                subs.append('replace fish sauce with coconut aminos')
            if contains_any(ing_text, ['vinegar']):
                subs.append('replace vinegar with fresh lime or lemon juice')
            if contains_any(ing_text, ['sesame', 'tahini']):
                subs.append('remove sesame seeds and sesame oil')
            if contains_any(ing_text, ['cumin', 'coriander', 'paprika', 'mustard', 'black pepper']):
                subs.append('replace seed-based spices with turmeric, ginger, cinnamon, or fresh herbs')
        if aip_blocks['alcohol']:
            if contains_any(ing_text, ['white wine', 'wine']):
                subs.append('replace wine with chicken broth or matching broth')
        if subs:
            tags_out['AIP'] = {'native': False, 'mod': True, 'notes': join_sentences(subs)}

    # -------------------------------------------------------------------------
    # LF — Low-FODMAP
    # Native if no high-FODMAP ingredients.
    # Mod only if the ONLY disqualifiers are garlic/onion/shallot/leek → garlic-infused oil.
    # Hard disqualifiers (mushrooms, fennel, corn, legumes, cauliflower, asparagus, fruit)
    # make the LF modification invalid unless they are background/supporting only.
    # -------------------------------------------------------------------------
    fodmap_present = contains_any(ing_text, FODMAP_DISQ_KW)
    if not fodmap_present:
        tags_out['LF'] = {'native': True, 'mod': False, 'notes': ''}
    else:
        fodmap_hits = [kw for kw in FODMAP_DISQ_KW if kw in ing_text]
        hard_fodmap = [kw for kw in fodmap_hits if kw in FODMAP_HARD_KW]
        easy_fodmap = [kw for kw in fodmap_hits if kw in FODMAP_EASY_SWAP_KW]

        if easy_fodmap and not hard_fodmap:
            # Only garlic/onion/shallot/leek — moddable with garlic-infused oil
            has_garlic = any(k in easy_fodmap for k in ['garlic', 'garlic powder'])
            has_onion  = any(k in easy_fodmap for k in ['onion', 'shallot', 'leek', 'onion powder'])

            subs = []
            if has_garlic and has_onion:
                subs.append('replace garlic and onion with garlic-infused oil (use 1–2 tablespoons to replace both the oil and the garlic flavor contribution)')
            elif has_garlic:
                subs.append('replace garlic with 1 tablespoon garlic-infused oil')
            elif has_onion:
                subs.append('replace onion with the green tops of scallions only')

            note = join_sentences(subs)
            tags_out['LF'] = {'native': False, 'mod': True, 'notes': note}
        # else: has hard disqualifiers — LF mod would require too many changes or gut the dish

    # -------------------------------------------------------------------------
    # LH — Low-Histamine
    # Very conservative. Only native if truly clean. Very rarely apply mods.
    # -------------------------------------------------------------------------
    histamine_present = contains_any(ing_text, HISTAMINE_DISQ_KW)
    if not histamine_present:
        tags_out['LH'] = {'native': True, 'mod': False, 'notes': ''}
    else:
        hist_hits = [kw for kw in HISTAMINE_DISQ_KW if kw in ing_text]
        # Only mod if disqualifiers are limited to easy swaps (soy sauce, wine-vinegar)
        easy_lh   = ['soy sauce', 'vinegar', 'tamari', 'canola oil']
        hard_hist = [kw for kw in hist_hits if kw not in easy_lh]
        if not hard_hist:
            subs = []
            if 'soy sauce' in hist_hits or 'tamari' in hist_hits:
                subs.append('replace soy sauce with coconut aminos')
            if 'vinegar' in hist_hits:
                subs.append('replace vinegar with fresh lime or lemon juice')
            if 'canola oil' in hist_hits:
                subs.append('replace canola oil with olive oil')
            if subs:
                tags_out['LH'] = {'native': False, 'mod': True, 'notes': join_sentences(subs)}

    return tags_out


# ---------------------------------------------------------------------------
# Scraping helpers
# ---------------------------------------------------------------------------

def fetch_recipe_json_ld(url):
    try:
        r = SESSION.get(url, timeout=15, allow_redirects=True)
        if not r.ok:
            return None
        soup = BeautifulSoup(r.text, 'html.parser')
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data  = json.loads(script.string or '')
                items = data if isinstance(data, list) else \
                        (data.get('@graph', [data]) if isinstance(data, dict) else [])
                for item in items:
                    if isinstance(item, dict) and item.get('@type') in ('Recipe', 'recipe'):
                        return item
            except Exception:
                continue
    except Exception as e:
        print(f'    ✗ fetch error: {e}')
    return None


def parse_rating(ld):
    ar = ld.get('aggregateRating')
    if not ar or not isinstance(ar, dict):
        return None
    val   = str(ar.get('ratingValue') or '').strip()
    count = str(ar.get('ratingCount') or ar.get('reviewCount') or '0').strip()
    if not val:
        return None
    try:
        val_f   = float(val)
        count_i = int(float(count))
    except ValueError:
        return None
    if count_i == 0:
        return None
    label   = 'rating' if count_i == 1 else 'ratings'
    val_str = f'{val_f:.2f}'.rstrip('0').rstrip('.')
    return f'{val_str} ({count_i} {label})'


def needs_rating(row):
    v = (row.get('Rating') or '').strip()
    if not v or v == 'NR':
        return True
    m = re.match(r'^[\d.]+\s*\((\d+)\s*rating', v)
    if m and int(m.group(1)) == 0:
        return True
    return False


def needs_tags(row):
    return not any(
        (row.get(t) or '').strip() == '1' or (row.get(f'{t} Mod') or '').strip() == '1'
        for t in TAGS
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    with open(CSV_FILE, newline='', encoding='utf-8-sig') as f:
        rows = list(csv.DictReader(f))
        f.seek(0)
        fieldnames = list(csv.DictReader(f).fieldnames)

    progress = {}
    if os.path.exists(PROGRESS_LOG):
        with open(PROGRESS_LOG) as f:
            progress = json.load(f)
        print(f'Resuming — {len(progress)} entries already done\n')

    to_process = [
        r for r in rows
        if (r.get('Recipe Title') or '').strip()
        and (r.get('URL') or '').strip()
        and (needs_rating(r) or needs_tags(r))
        and (r.get('Recipe Title', '').strip() not in progress)
    ]

    print(f'Recipes to process: {len(to_process)}\n')

    for i, row in enumerate(to_process):
        title   = row['Recipe Title'].strip()
        url     = row['URL'].strip()
        blogger = (row.get('Blogger Name') or '').strip()

        print(f'[{i+1}/{len(to_process)}] {title[:65]}')

        ld     = fetch_recipe_json_ld(url)
        result = {}

        if needs_rating(row):
            if ld:
                rating_str = parse_rating(ld)
                result['rating'] = rating_str or 'NR'
            else:
                result['rating'] = 'NR'
            print(f'    rating → {result.get("rating", "—")}')

        if needs_tags(row):
            if ld and ld.get('recipeIngredient'):
                new_tags = classify_diet_tags(
                    ld['recipeIngredient'],
                    recipe_title=title,
                    blogger_name=blogger,
                )
                result['tags'] = new_tags
                summary = ', '.join(
                    f'{t}{"" if v["native"] else " (mod)"}' for t, v in new_tags.items()
                )
                print(f'    tags  → {summary or "none"}')
            else:
                result['tags'] = {}
                print(f'    tags  → skipped (no ingredients in JSON-LD)')

        progress[title] = result

        with open(PROGRESS_LOG, 'w') as f:
            json.dump(progress, f, indent=2)

        time.sleep(SLEEP_SEC)

    # Apply progress to CSV
    print('\nApplying results to CSV...')
    updated_rating = 0
    updated_tags   = 0

    for row in rows:
        title = (row.get('Recipe Title') or '').strip()
        if title not in progress:
            continue
        res = progress[title]

        if 'rating' in res and needs_rating(row):
            row['Rating'] = res['rating']
            updated_rating += 1

        if 'tags' in res and needs_tags(row):
            for tag in TAGS:
                row[tag]                = ''
                row[f'{tag} Mod']       = ''
                row[f'{tag} Mod Notes'] = ''
            for tag, info in res['tags'].items():
                row[tag]                = '1' if info['native'] else ''
                row[f'{tag} Mod']       = '1' if info['mod']    else ''
                row[f'{tag} Mod Notes'] = info.get('notes', '')
            updated_tags += 1

    with open(CSV_FILE, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f'\n✓ Done!')
    print(f'  Ratings updated : {updated_rating}')
    print(f'  Tag rows updated: {updated_tags}')
    print(f'  CSV saved → {CSV_FILE}')


if __name__ == '__main__':
    main()
