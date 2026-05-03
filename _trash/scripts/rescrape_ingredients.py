#!/usr/bin/env python3
"""
rescrape_ingredients.py
========================
Scrapes the actual ingredient list from each recipe URL and saves it directly
into recipes.json under an `ingredients` field. Then re-runs diet tag
classification against those real ingredients.

Previously, diet tags were computed during enrichment but the ingredients were
never saved — so there was no way to audit or re-check tags. This script fixes
that permanently.

Usage:
  python3 rescrape_ingredients.py              # run all missing
  python3 rescrape_ingredients.py --dry-run    # preview without saving
  python3 rescrape_ingredients.py --limit 50   # process only 50 recipes

Resume-safe: recipes that already have a non-empty `ingredients` field are
skipped unless you pass --force.
"""

import json, os, sys, time, re, argparse
import requests
from bs4 import BeautifulSoup

# ── Config ────────────────────────────────────────────────────────────────────
RECIPES_FILE  = 'recipes.json'
PROGRESS_FILE = 'rescrape_progress.json'
SAVE_EVERY    = 1       # write recipes.json after every single recipe (no data loss)
SLEEP_SEC     = 0.7     # polite delay between requests

SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
})

# ── Argument parsing ──────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument('--dry-run', action='store_true', help='Print changes but do not write to disk')
parser.add_argument('--force',   action='store_true', help='Re-scrape even recipes that already have ingredients')
parser.add_argument('--limit',   type=int, default=0, help='Only process N recipes (0 = all)')
args = parser.parse_args()

# ── Load recipes ──────────────────────────────────────────────────────────────
with open(RECIPES_FILE) as f:
    recipes = json.load(f)

# Build a fast lookup by id or index
recipe_map = {r.get('id', str(i)): i for i, r in enumerate(recipes)}

print(f"Loaded {len(recipes)} recipes from {RECIPES_FILE}")

# ── Scraping: extract ingredients from JSON-LD ────────────────────────────────
def scrape_ingredients(url):
    """
    Fetch a recipe page and extract the ingredient list from JSON-LD structured
    data (schema.org/Recipe → recipeIngredient). Falls back to an empty list if
    the page can't be reached or has no JSON-LD.
    """
    try:
        resp = SESSION.get(url, timeout=15, allow_redirects=True)
        if not resp.ok:
            return []
        soup = BeautifulSoup(resp.text, 'html.parser')
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data  = json.loads(script.string or '')
                items = data if isinstance(data, list) else \
                        (data.get('@graph', [data]) if isinstance(data, dict) else [])
                for item in items:
                    if isinstance(item, dict) and item.get('@type') in ('Recipe', 'recipe'):
                        ings = item.get('recipeIngredient', [])
                        return [str(i).strip() for i in ings if str(i).strip()]
            except Exception:
                continue
    except Exception as e:
        print(f'    fetch error: {e}')
    return []

# ── Diet tag classification ───────────────────────────────────────────────────
# (Mirrors classify_diet_tags in enrich_recipes.py — kept here so this script
#  is fully self-contained and always in sync with the saved ingredients.)

VEGAN_BLOGS = [
    'minimalist baker', 'vegan richa', 'jessica in the kitchen',
    'the simple veganista', 'this savory vegan', 'orchids + sweet tea',
    'orchids and sweet tea',
]
VEGETARIAN_BLOGS = ['cookie and kate', 'love and lemons']

MEAT_TITLE_KW = [
    'chicken', 'beef', 'pork', 'lamb', 'turkey', 'salmon', 'shrimp', 'prawn',
    'tuna', 'cod', 'halibut', 'tilapia', 'steak', 'duck', 'veal', 'bison',
    'sausage', 'chorizo', 'bacon', 'ham', 'mahi', 'snapper', 'trout',
    'sea bass', 'branzino', 'scallop', 'crab', 'lobster', 'clam', 'mussel',
    'oyster', 'fish', 'meat', 'carnitas', 'carne', 'brisket', 'ribs',
    'wings', 'drumstick', 'thigh', 'breast', 'ground beef', 'ground turkey',
    'ground pork', 'ground chicken', 'pulled pork', 'pulled chicken',
]
MEAT_ING_KW = MEAT_TITLE_KW + [
    'anchovies', 'anchovy', 'sardine', 'mackerel', 'bone broth',
    'worcestershire', 'lard', 'suet',
]
FISH_SAUCE_KW    = ['fish sauce']
CHICKEN_BROTH_KW = ['chicken broth', 'chicken stock', 'chicken bouillon']
ANCHOVY_KW       = ['anchovy', 'anchovies', 'anchovy paste']
EGG_KW           = ['egg', 'eggs', 'egg white', 'egg yolk', 'beaten egg', 'hard boiled']

DAIRY_KW = [
    'milk', 'whole milk', 'skim milk', '2% milk', 'buttermilk',
    'heavy cream', 'heavy whipping cream', 'light cream', 'half and half',
    'butter', 'unsalted butter', 'salted butter',
    'cream cheese', 'sour cream', 'creme fraiche', 'crème fraîche',
    'yogurt', 'greek yogurt', 'plain yogurt', 'kefir',
    'parmesan', 'parmigiano', 'mozzarella', 'cheddar', 'gruyere', 'gruyère',
    'ricotta', 'feta', 'goat cheese', 'blue cheese', 'brie', 'camembert',
    'mascarpone', 'cotija', 'queso', 'manchego', 'pecorino',
    'whipping cream', 'condensed milk', 'evaporated milk', 'ghee', 'cheese',
]
DAIRY_TITLE_IDENTITY_KW = [
    'feta', 'parmesan', 'parmigiano', 'cheese', 'cheesy', 'mozzarella',
    'ricotta', 'brie', 'gruyere', 'cheddar', 'mac and cheese', 'queso',
    'alfredo', 'carbonara',
]
GLUTEN_KW = [
    'flour', 'all-purpose flour', 'wheat flour', 'wheat',
    'pasta', 'orzo', 'couscous', 'farro', 'spelt', 'barley', 'rye',
    'bread', 'breadcrumbs', 'panko', 'crouton',
    'naan', 'pita', 'tortilla wrap',
    'soy sauce',
    'ramen noodles', 'lo mein', 'chow mein', 'wonton', 'dumpling wrapper',
    'gnocchi', 'tortellini', 'ravioli', 'linguine', 'penne', 'spaghetti',
    'udon', 'egg noodles', 'oyster sauce', 'hoisin sauce', 'worcestershire sauce',
]
GRAIN_TITLE_IDENTITY_KW = [
    'pasta', 'orzo', 'ramen', 'noodle', 'noodles', 'risotto', 'couscous',
    'gnocchi', 'ravioli', 'tortellini', 'linguine', 'penne', 'spaghetti',
    'fettuccine', 'udon', 'lo mein', 'chow mein', 'dumpling', 'wonton',
    'pot pie', 'bread', 'flatbread',
]
GLUTEN_EASY_SWAP_KW = ['soy sauce']

KETO_DISQ_KW = [
    'rice', 'pasta', 'noodle', 'bread', 'flour', 'couscous', 'orzo',
    'quinoa', 'oat', 'barley', 'corn', 'tortilla',
    'bean', 'lentil', 'chickpea', 'pea', 'edamame',
    'potato', 'sweet potato', 'yam',
    'honey', 'sugar', 'brown sugar', 'maple syrup',
    'mango', 'banana', 'pineapple', 'dried fruit', 'raisin', 'date',
    'teriyaki', 'hoisin', 'bbq sauce', 'ketchup',
]
KETO_TITLE_IDENTITY_KW = [
    'pasta', 'rice', 'risotto', 'noodle', 'noodles', 'ramen',
    'couscous', 'orzo', 'gnocchi', 'ravioli', 'tortellini', 'potato', 'yam',
]
KETO_EASY_SWAP_KW  = ['honey', 'sugar', 'brown sugar', 'maple syrup']
KETO_GRAIN_SWAP_KW = ['rice', 'quinoa']

NIGHTSHADE_KW = [
    'tomato', 'pepper', 'paprika', 'chili', 'chile', 'cayenne',
    'eggplant', 'aubergine', 'potato ', 'goji', 'harissa',
]
NUT_SEED_KW = [
    'almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut',
    'sesame', 'tahini', 'sunflower seed', 'pumpkin seed', 'chia', 'flax',
    'hemp seed', 'peanut', 'pine nut',
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
COCOA_KW   = ['chocolate', 'cocoa', 'cacao']
ALCOHOL_KW = ['wine', 'beer ', 'champagne', 'bourbon', 'whiskey', 'vodka',
              'rum ', 'brandy', 'sherry', 'sake', 'mirin']

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


# ── Compound strings that must be neutralized before keyword matching ─────────
# These are ingredient strings where a substring would incorrectly trigger a
# disqualifier check. We replace them with a neutral placeholder before running
# any contains_any() call on the ingredient text.
#
# Examples of false positives without this:
#   "rice wine vinegar" → 'wine' triggers ALCOHOL_KW (it's a condiment, not alcohol)
#   "rice wine vinegar" → 'rice' triggers KETO_DISQ_KW (a few drops is not a carb issue)
#   "apple cider vinegar" → 'apple ' triggers FODMAP_DISQ_KW (ACV is low-FODMAP)
#   "mirin" is alcohol and stays (it IS used as an actual sweetener/alcohol in cooking)
NEUTRALIZE_COMPOUNDS = [
    # Vinegars — protect from matching 'wine', 'apple', 'champagne' as disqualifiers
    ('rice wine vinegar',   'RICEWINEVINEGAR'),
    ('red wine vinegar',    'REDWINEVINEGAR'),
    ('white wine vinegar',  'WHITEWINEVINEGAR'),
    ('apple cider vinegar', 'APPLECIDERVINEGAR'),
    ('sherry vinegar',      'SHERRYVINEGAR'),
    ('balsamic vinegar',    'BALSAMICVINEGAR'),
    ('champagne vinegar',   'CHAMPAGNEVINEGAR'),

    # Coconut products — protect from matching 'milk', 'cream', 'butter' as dairy
    ('coconut milk',        'COCONUTMILK'),
    ('coconut cream',       'COCONUTCREAM'),
    ('coconut butter',      'COCONUTBUTTER'),
    ('coconut aminos',      'COCONUTAMINOS'),   # protect from 'soy' match

    # Nut/seed butters — protect from matching 'butter' as dairy
    ('peanut butter',       'PEANUTBUTTER'),
    ('almond butter',       'ALMONDBUTTER'),
    ('cashew butter',       'CASHEWBUTTER'),
    ('sunflower butter',    'SUNFLOWERBUTTER'),
    ('sunflower seed butter','SFSEEBUTTER'),
    ('tahini',              'TAHINI'),          # already in NUT_SEED_KW — fine, just not dairy

    # Vegetables — protect from matching 'egg' in eggplant
    ('eggplant',            'EGGPLANT'),
    ('aubergine',           'AUBERGINE'),
]

def normalize_ing_text(raw_text):
    """Replace compound strings with neutral placeholders before keyword matching."""
    t = raw_text
    for compound, placeholder in NEUTRALIZE_COMPOUNDS:
        t = t.replace(compound, placeholder)
    return t


def contains_any(text, keywords):
    return any(kw in text for kw in keywords)

def title_contains_any(title, keywords):
    return any(kw in title for kw in keywords)

def join_sentences(parts):
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
    Classify diet tags from an actual ingredient list.
    Returns: {tag: {'native': bool, 'mod': bool, 'notes': str}}
    """
    ing_text      = normalize_ing_text(' '.join(ingredients).lower())
    title_lower   = recipe_title.lower()
    blogger_lower = blogger_name.lower()
    tags_out      = {}

    has_meat       = contains_any(ing_text, MEAT_ING_KW)
    has_meat_title = title_contains_any(title_lower, MEAT_TITLE_KW)
    has_egg        = contains_any(ing_text, EGG_KW)
    has_dairy      = contains_any(ing_text, DAIRY_KW)
    has_gluten     = contains_any(ing_text, GLUTEN_KW)
    has_alcohol    = contains_any(ing_text, ALCOHOL_KW)

    is_vegan_blog = any(b in blogger_lower for b in VEGAN_BLOGS)
    is_veg_blog   = any(b in blogger_lower for b in VEGETARIAN_BLOGS)

    # ── V (Vegan) ─────────────────────────────────────────────────────────────
    # Vegan blog cascade only applies when the recipe actually has no animal
    # products — some vegan blogs also post non-vegan recipes.
    if is_vegan_blog and not has_meat and not has_egg and not has_dairy:
        tags_out['V']  = {'native': True, 'mod': False, 'notes': ''}
        tags_out['Vg'] = {'native': True, 'mod': False, 'notes': ''}
        tags_out['DF'] = {'native': True, 'mod': False, 'notes': ''}
    elif not has_meat and not has_egg and not has_dairy:
        tags_out['V'] = {'native': True, 'mod': False, 'notes': ''}
    elif not has_meat_title and not has_meat and (has_egg or has_dairy):
        subs = []
        if has_egg:
            subs.append('replace the egg with a flax egg — mix 2 tablespoons ground flaxseed with 1 tablespoon water')
        if has_dairy:
            subs.append('use plant-based dairy alternatives')
            subs.append('replace chicken broth with vegetable broth')
        tags_out['V'] = {'native': False, 'mod': True, 'notes': join_sentences(subs)}

    # ── Vg (Vegetarian) ───────────────────────────────────────────────────────
    if 'Vg' not in tags_out:
        if is_veg_blog:
            tags_out['Vg'] = {'native': True, 'mod': False, 'notes': ''}
        elif not has_meat:
            tags_out['Vg'] = {'native': True, 'mod': False, 'notes': ''}
        elif has_meat_title:
            pass  # meat is the dish — leave blank
        else:
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

    # ── GF (Gluten-Free) ──────────────────────────────────────────────────────
    if 'GF' not in tags_out:
        if not has_gluten:
            tags_out['GF'] = {'native': True, 'mod': False, 'notes': ''}
        else:
            grain_in_title = title_contains_any(title_lower, GRAIN_TITLE_IDENTITY_KW)
            gluten_hits    = [kw for kw in GLUTEN_KW if kw in ing_text]
            only_soy_sauce = all(kw in GLUTEN_EASY_SWAP_KW for kw in gluten_hits)

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

    # ── DF (Dairy-Free) ───────────────────────────────────────────────────────
    if 'DF' not in tags_out:
        if not has_dairy:
            tags_out['DF'] = {'native': True, 'mod': False, 'notes': ''}
        else:
            dairy_in_title = title_contains_any(title_lower, DAIRY_TITLE_IDENTITY_KW)
            if not dairy_in_title:
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

    # ── K (Keto) ──────────────────────────────────────────────────────────────
    keto_disq_present = contains_any(ing_text, KETO_DISQ_KW)
    if not keto_disq_present:
        tags_out['K'] = {'native': True, 'mod': False, 'notes': ''}
    else:
        keto_in_title = title_contains_any(title_lower, KETO_TITLE_IDENTITY_KW)
        hits      = [kw for kw in KETO_DISQ_KW if kw in ing_text]
        easy_hits = [kw for kw in hits if kw in KETO_EASY_SWAP_KW]

        if not keto_in_title:
            subs = []
            if easy_hits:
                if 'honey' in easy_hits:
                    subs.append('replace honey with a liquid allulose sweetener')
                elif contains_any(str(easy_hits), ['sugar', 'brown sugar', 'maple syrup']):
                    subs.append('replace the sweetener with allulose')
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

    # ── AIP ───────────────────────────────────────────────────────────────────
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

    # ── LF (Low-FODMAP) ───────────────────────────────────────────────────────
    fodmap_present = contains_any(ing_text, FODMAP_DISQ_KW)
    if not fodmap_present:
        tags_out['LF'] = {'native': True, 'mod': False, 'notes': ''}
    else:
        fodmap_hits  = [kw for kw in FODMAP_DISQ_KW if kw in ing_text]
        hard_fodmap  = [kw for kw in fodmap_hits if kw in FODMAP_HARD_KW]
        easy_fodmap  = [kw for kw in fodmap_hits if kw in FODMAP_EASY_SWAP_KW]

        if easy_fodmap and not hard_fodmap:
            has_garlic = any(k in easy_fodmap for k in ['garlic', 'garlic powder'])
            has_onion  = any(k in easy_fodmap for k in ['onion', 'shallot', 'leek', 'onion powder'])
            subs = []
            if has_garlic and has_onion:
                subs.append('replace garlic and onion with garlic-infused oil (use 1–2 tablespoons to replace both the oil and the garlic flavor contribution)')
            elif has_garlic:
                subs.append('replace garlic with 1 tablespoon garlic-infused oil')
            elif has_onion:
                subs.append('replace onion with the green tops of scallions only')
            if subs:
                tags_out['LF'] = {'native': False, 'mod': True, 'notes': join_sentences(subs)}

    # ── LH (Low-Histamine) ────────────────────────────────────────────────────
    histamine_present = contains_any(ing_text, HISTAMINE_DISQ_KW)
    if not histamine_present:
        tags_out['LH'] = {'native': True, 'mod': False, 'notes': ''}
    else:
        hist_hits = [kw for kw in HISTAMINE_DISQ_KW if kw in ing_text]
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


# ── Per-recipe sanity check ───────────────────────────────────────────────────
# Runs after every classification. Catches logic contradictions that keyword
# matching alone can't catch — e.g. a recipe tagged AIP-native that still has
# dairy in its ingredients, or a V-native recipe that has meat.
#
# Flags are printed as warnings but do NOT block saving. They go into
# rescrape_warnings.json so you can review them after the run.

WARNINGS = []  # accumulated across the full run

def sanity_check(recipe_name, ingredients, tags):
    """
    Check for contradictions between ingredients and assigned tags.
    Returns a list of warning strings (empty = all clear).
    """
    issues = []
    ing_text = normalize_ing_text(' '.join(ingredients).lower())

    # AIP native must have no animal dairy, eggs, grains, legumes, nightshades, nuts/seeds
    if tags.get('AIP', {}).get('native'):
        for blocker, kws in [
            ('dairy',      DAIRY_KW),
            ('egg',        EGG_KW),
            ('grain',      GRAIN_AIP_KW),
            ('legume',     LEGUME_KW),
            ('nightshade', NIGHTSHADE_KW),
            ('nut/seed',   NUT_SEED_KW),
            ('alcohol',    ALCOHOL_KW),
        ]:
            hit = next((kw for kw in kws if kw in ing_text), None)
            if hit:
                issues.append(f"AIP native but contains {blocker} ({hit!r})")

    # GF native must have no gluten keywords
    if tags.get('GF', {}).get('native'):
        hit = next((kw for kw in GLUTEN_KW if kw in ing_text), None)
        if hit:
            issues.append(f"GF native but contains gluten ({hit!r})")

    # DF native must have no dairy keywords
    if tags.get('DF', {}).get('native'):
        hit = next((kw for kw in DAIRY_KW if kw in ing_text), None)
        if hit:
            issues.append(f"DF native but contains dairy ({hit!r})")

    # V native must have no meat, egg, or dairy
    if tags.get('V', {}).get('native'):
        for blocker, kws in [('meat', MEAT_ING_KW), ('egg', EGG_KW), ('dairy', DAIRY_KW)]:
            hit = next((kw for kw in kws if kw in ing_text), None)
            if hit:
                issues.append(f"V native but contains {blocker} ({hit!r})")

    # K native must have no keto disqualifiers
    if tags.get('K', {}).get('native'):
        hit = next((kw for kw in KETO_DISQ_KW if kw in ing_text), None)
        if hit:
            issues.append(f"K native but contains keto disqualifier ({hit!r})")

    # LF native must have no FODMAP disqualifiers
    if tags.get('LF', {}).get('native'):
        hit = next((kw for kw in FODMAP_DISQ_KW if kw in ing_text), None)
        if hit:
            issues.append(f"LF native but contains FODMAP disqualifier ({hit!r})")

    # LH native must have no histamine disqualifiers
    if tags.get('LH', {}).get('native'):
        hit = next((kw for kw in HISTAMINE_DISQ_KW if kw in ing_text), None)
        if hit:
            issues.append(f"LH native but contains histamine trigger ({hit!r})")

    if issues:
        for issue in issues:
            print(f"    ⚠ WARN: {issue}")
        WARNINGS.append({'recipe': recipe_name, 'issues': issues})

    return issues


# ── Save helper ───────────────────────────────────────────────────────────────
def save_recipes():
    if args.dry_run:
        return
    with open(RECIPES_FILE, 'w') as f:
        json.dump(recipes, f, indent=2, ensure_ascii=False)


# ── Main loop ─────────────────────────────────────────────────────────────────
to_process = [
    (i, r) for i, r in enumerate(recipes)
    if args.force or not r.get('ingredients')
]

if args.limit:
    to_process = to_process[:args.limit]

total     = len(to_process)
processed = 0
scraped   = 0
failed    = 0

print(f"\nRecipes to process: {total}")
print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")
print(f"Force re-scrape: {args.force}")
print("-" * 60)

for processed, (idx, recipe) in enumerate(to_process, 1):
    name = recipe.get('name', '(unnamed)')
    url  = recipe.get('url', '')

    if not url:
        print(f"[{processed}/{total}] SKIP (no URL): {name}")
        continue

    print(f"[{processed}/{total}] {name[:60]}")
    print(f"         {url[:80]}")

    ingredients = scrape_ingredients(url)

    if ingredients:
        scraped += 1
        new_tags = classify_diet_tags(
            ingredients,
            recipe_title = recipe.get('name', ''),
            blogger_name = recipe.get('blogger', ''),
        )

        # Sanity-check every recipe immediately after classification
        issues = sanity_check(recipe.get('name', ''), ingredients, new_tags)
        status = f"⚠ {len(issues)} warn" if issues else "OK"
        print(f"         {len(ingredients)} ingredients → tags: {list(new_tags.keys())} [{status}]")

        if not args.dry_run:
            recipes[idx]['ingredients'] = ingredients
            recipes[idx]['dietTags']    = new_tags
            # Save after every single recipe so nothing is lost
            save_recipes()
    else:
        failed += 1
        print(f"         no ingredients found — keeping existing tags")

    time.sleep(SLEEP_SEC)

print("\n" + "=" * 60)
print(f"Done.")
print(f"  Processed : {processed}")
print(f"  Scraped   : {scraped}  (ingredients saved + tags updated)")
print(f"  Failed    : {failed}   (no ingredients found — tags unchanged)")
print(f"  Skipped   : {len(recipes) - len(to_process)}  (already had ingredients)")
print(f"  Warnings  : {len(WARNINGS)}  (tag contradictions to review)")

# Write warnings file so they can be reviewed after the run
if WARNINGS and not args.dry_run:
    with open('rescrape_warnings.json', 'w') as f:
        json.dump(WARNINGS, f, indent=2)
    print(f"\n  ⚠ Warnings saved to rescrape_warnings.json — review and fix manually.")

if not args.dry_run:
    print(f"\nrecipes.json updated with ingredients + fresh diet tags.")
else:
    print(f"\nDry run — no files written.")
