#!/usr/bin/env python3
"""
Recipe Enrichment Script
=========================
For all recipes missing a rating OR missing diet tags:
  1. Fetches the recipe page
  2. Extracts JSON-LD structured data (aggregateRating + recipeIngredient)
  3. Determines diet tags from ingredient analysis following diet-compliance-rules.md
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
# Known plant-based blogs — recipes from these are natively V/Vg
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

FISH_SAUCE_KW   = ['fish sauce']
CHICKEN_BROTH_KW = ['chicken broth', 'chicken stock', 'chicken bouillon']
ANCHOVY_KW      = ['anchovy', 'anchovies', 'anchovy paste']

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

# Dairy keywords that appear in TITLE and signal that dairy IS the dish
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
    'soy sauce',  # contains wheat unless specified tamari
    'ramen noodles', 'lo mein', 'chow mein', 'wonton', 'dumpling wrapper',
    'gnocchi', 'tortellini', 'ravioli', 'linguine', 'penne', 'spaghetti',
    'udon', 'egg noodles',
]

# Gluten sources that are grain/carb identity of the dish (in title = no GF mod)
GRAIN_TITLE_IDENTITY_KW = [
    'pasta', 'orzo', 'ramen', 'noodle', 'noodles', 'risotto', 'couscous',
    'gnocchi', 'ravioli', 'tortellini', 'linguine', 'penne', 'spaghetti',
    'fettuccine', 'udon', 'lo mein', 'chow mein', 'dumpling', 'wonton',
    'pot pie', 'bread', 'flatbread',
]

# Gluten that is a simple background swap (soy sauce → tamari)
GLUTEN_EASY_SWAP_KW = ['soy sauce']

# Gluten that can be swapped but changes more (flour, breadcrumbs, pasta)
GLUTEN_SWAP_KW = ['flour', 'breadcrumbs', 'panko', 'pasta', 'orzo', 'couscous',
                   'bread', 'naan', 'pita', 'tortilla wrap']

# Keto disqualifiers
KETO_DISQ_KW = [
    'rice', 'pasta', 'noodle', 'bread', 'flour', 'couscous', 'orzo',
    'quinoa', 'oat', 'barley', 'corn', 'tortilla',
    'bean', 'lentil', 'chickpea', 'pea', 'edamame',
    'potato', 'sweet potato', 'yam',
    'honey', 'sugar', 'brown sugar', 'maple syrup', 'agave',
    'mango', 'banana', 'pineapple', 'dried fruit', 'raisin', 'date',
    'teriyaki', 'hoisin', 'bbq sauce', 'ketchup',
]
# Keto items that are identity of the dish (title) → no K mod
KETO_TITLE_IDENTITY_KW = [
    'pasta', 'rice', 'risotto', 'noodle', 'noodles', 'ramen',
    'couscous', 'orzo', 'gnocchi', 'ravioli', 'tortellini',
    'potato', 'yam',
]
# Keto disqualifiers that are easy background swaps
KETO_EASY_SWAP_KW = ['honey', 'sugar', 'brown sugar', 'maple syrup', 'agave']

# AIP disqualifiers
NIGHTSHADE_KW = [
    'tomato', 'pepper', 'paprika', 'chili', 'chile', 'cayenne',
    'eggplant', 'aubergine', 'potato ', 'goji', 'harissa',
]
NUT_SEED_KW = [
    'almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut',
    'sesame', 'tahini', 'sunflower seed', 'pumpkin seed', 'chia', 'flax',
    'hemp seed', 'peanut', 'pine nut',
    # seed spices
    'cumin', 'coriander', 'fennel seed', 'mustard', 'cardamom',
    'anise', 'nutmeg', 'celery seed', 'sumac', 'za\'atar', 'caraway',
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
COCOA_KW = ['chocolate', 'cocoa', 'cacao']
ALCOHOL_KW = ['wine', 'beer ', 'champagne', 'bourbon', 'whiskey', 'vodka',
               'rum ', 'brandy', 'sherry', 'sake', 'mirin']

# Low-FODMAP disqualifiers
FODMAP_DISQ_KW = [
    'garlic', 'onion', 'shallot', 'leek', 'garlic powder', 'onion powder',
    'wheat', 'rye', 'barley',
    'bean', 'lentil', 'chickpea', 'cashew', 'pistachio', 'edamame',
    'apple ', 'pear ', 'mango', 'watermelon', 'honey', 'agave',
    'milk', 'ice cream', 'yogurt', 'cream cheese', 'ricotta', 'soft cheese',
    'cauliflower', 'asparagus', 'mushroom',
]
FODMAP_EASY_SWAP_KW = ['garlic', 'onion', 'shallot', 'garlic powder', 'onion powder']
FODMAP_HARD_KW = [
    'bean', 'lentil', 'chickpea', 'cashew', 'pistachio', 'edamame',
    'apple ', 'pear ', 'mango', 'watermelon', 'honey', 'agave',
    'cauliflower', 'asparagus',
]

# Low-histamine disqualifiers
HISTAMINE_DISQ_KW = [
    'vinegar', 'wine', 'beer', 'champagne', 'alcohol',
    'tomato', 'spinach', 'avocado',
    'soy sauce', 'fish sauce', 'miso', 'kimchi', 'sauerkraut', 'pickl',
    'tamari', 'coconut aminos',  # fermented
    'aged cheese', 'parmesan', 'blue cheese', 'cheddar', 'gruyere', 'feta',
    'smoked salmon', 'canned tuna', 'canned fish', 'anchovies', 'sardine',
    'mushroom', 'strawberr', 'pineapple', 'ketchup', 'mustard',
    'worcestershire', 'hot sauce', 'sriracha',
    'chocolate', 'cocoa',
    'onion', 'garlic',
    'cumin', 'paprika', 'cayenne', 'chili', 'cinnamon',  # seed spices
    'sesame', 'tahini', 'walnut', 'cashew', 'peanut', 'almond flour',
]


def contains_any(text_lower, keywords):
    return any(kw in text_lower for kw in keywords)


def title_contains_any(title_lower, keywords):
    return any(kw in title_lower for kw in keywords)


def join_sentences(parts):
    """Join a list of note fragments into proper sentences."""
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
    Classify diet tags following diet-compliance-rules.md.
    Core rule: never apply a mod if it would gut the dish.
    Returns: {tag: {'native': bool, 'mod': bool, 'notes': str}}
    """
    ing_text    = ' '.join(ingredients).lower()
    title_lower = recipe_title.lower()
    blogger_lower = blogger_name.lower()
    tags_out    = {}

    # Pre-compute presence flags
    has_meat     = contains_any(ing_text, MEAT_ING_KW)
    has_meat_title = title_contains_any(title_lower, MEAT_TITLE_KW)
    has_egg      = contains_any(ing_text, EGG_KW)
    has_dairy    = contains_any(ing_text, DAIRY_KW)
    has_gluten   = contains_any(ing_text, GLUTEN_KW)
    has_alcohol  = contains_any(ing_text, ALCOHOL_KW)

    is_vegan_blog = any(b in blogger_lower for b in VEGAN_BLOGS)
    is_veg_blog   = any(b in blogger_lower for b in VEGETARIAN_BLOGS)

    # -------------------------------------------------------------------------
    # V — Vegan
    # Only native if: from a known vegan blog, OR no animal products at all.
    # Mod only if: dairy/eggs are background AND the dish title has no animal protein.
    # If the dish cannot be made vegan without gutting it — leave blank.
    # -------------------------------------------------------------------------
    if is_vegan_blog:
        tags_out['V'] = {'native': True, 'mod': False, 'notes': ''}
    elif not has_meat and not has_egg and not has_dairy:
        tags_out['V'] = {'native': True, 'mod': False, 'notes': ''}
    elif not has_meat_title and not has_meat and (has_egg or has_dairy):
        # Vegetable-forward dish with only egg/dairy as background — moddable
        subs = []
        if has_egg:   subs.append('use a flax or chia egg instead')
        if has_dairy: subs.append('use plant-based dairy alternatives')
        tags_out['V'] = {'native': False, 'mod': True, 'notes': join_sentences(subs)}
    # else: has meat (in title or ingredients) — cannot make vegan, leave blank

    # -------------------------------------------------------------------------
    # Vg — Vegetarian
    # Only native if: from a known veg/vegan blog, OR no meat/fish in ingredients.
    # Mod only if: the meat/fish is a background flavoring (fish sauce, anchovy,
    # chicken broth) — NOT if it is the main protein or appears in the title.
    # If the dish cannot be made vegetarian without gutting it — leave blank.
    # -------------------------------------------------------------------------
    if is_vegan_blog or is_veg_blog:
        tags_out['Vg'] = {'native': True, 'mod': False, 'notes': ''}
    elif not has_meat:
        tags_out['Vg'] = {'native': True, 'mod': False, 'notes': ''}
    elif has_meat_title:
        # Meat is in the title — it IS the dish. Leave blank.
        pass
    else:
        # Meat in ingredients but NOT the title — only mod if purely background seasoning
        background_only = (
            contains_any(ing_text, FISH_SAUCE_KW + CHICKEN_BROTH_KW + ANCHOVY_KW)
            and not any(
                kw in ing_text
                for kw in MEAT_ING_KW
                if kw not in FISH_SAUCE_KW + CHICKEN_BROTH_KW + ANCHOVY_KW + ['fish sauce', 'chicken broth', 'chicken stock', 'chicken bouillon', 'anchovy', 'anchovies', 'anchovy paste']
            )
        )
        if background_only:
            subs = []
            if contains_any(ing_text, FISH_SAUCE_KW):
                subs.append('replace fish sauce with coconut aminos and a squeeze of lime')
            if contains_any(ing_text, CHICKEN_BROTH_KW):
                subs.append('use vegetable broth instead of chicken broth')
            if contains_any(ing_text, ANCHOVY_KW):
                subs.append('omit anchovies')
            tags_out['Vg'] = {'native': False, 'mod': True, 'notes': join_sentences(subs)}

    # -------------------------------------------------------------------------
    # GF — Gluten-Free
    # Native if no gluten ingredients.
    # Mod only if the gluten is a background swap that doesn't gut the dish.
    # If the grain IS the dish (pasta, orzo, ramen in title) — leave blank.
    # -------------------------------------------------------------------------
    if not has_gluten:
        tags_out['GF'] = {'native': True, 'mod': False, 'notes': ''}
    else:
        grain_in_title = title_contains_any(title_lower, GRAIN_TITLE_IDENTITY_KW)
        only_soy_sauce = all(kw in GLUTEN_EASY_SWAP_KW for kw in GLUTEN_KW if kw in ing_text)

        if only_soy_sauce:
            tags_out['GF'] = {'native': False, 'mod': True,
                              'notes': 'Use tamari or coconut aminos instead of soy sauce'}
        elif not grain_in_title:
            subs = []
            if 'soy sauce' in ing_text:
                subs.append('use tamari instead of soy sauce')
            if contains_any(ing_text, ['flour', 'all-purpose flour']):
                subs.append('use a GF flour blend or arrowroot starch')
            if contains_any(ing_text, ['breadcrumbs', 'panko']):
                subs.append('use GF breadcrumbs or almond flour')
            if contains_any(ing_text, ['pasta', 'orzo', 'couscous', 'noodle']):
                subs.append('use GF pasta')
            if contains_any(ing_text, ['tortilla wrap', 'pita', 'naan']):
                subs.append('use corn or GF tortillas')
            if subs:
                tags_out['GF'] = {'native': False, 'mod': True, 'notes': join_sentences(subs)}
        # grain_in_title and not only soy sauce → leave blank (would gut the dish)

    # -------------------------------------------------------------------------
    # DF — Dairy-Free
    # Native if no dairy.
    # Mod only if dairy is a background ingredient that can be swapped.
    # If cheese/cream IS the dish identity (in the title) — leave blank.
    # -------------------------------------------------------------------------
    if not has_dairy:
        tags_out['DF'] = {'native': True, 'mod': False, 'notes': ''}
    else:
        dairy_in_title_identity = title_contains_any(title_lower, DAIRY_TITLE_IDENTITY_KW)
        if not dairy_in_title_identity:
            subs = []
            if contains_any(ing_text, ['butter', 'unsalted butter', 'salted butter']):
                subs.append('use olive oil or coconut oil instead of butter')
            if contains_any(ing_text, ['heavy cream', 'heavy whipping cream', 'light cream', 'half and half', 'whipping cream']):
                subs.append('use full-fat coconut cream instead of heavy cream')
            if contains_any(ing_text, ['milk', 'whole milk', 'buttermilk', 'skim milk']):
                subs.append('use a plant-based milk')
            if contains_any(ing_text, ['yogurt', 'greek yogurt', 'plain yogurt']):
                subs.append('use coconut yogurt')
            if contains_any(ing_text, ['sour cream', 'creme fraiche', 'crème fraîche']):
                subs.append('use a dairy-free sour cream')
            if contains_any(ing_text, ['cream cheese', 'mascarpone']):
                subs.append('use dairy-free cream cheese')
            if contains_any(ing_text, ['ghee']):
                subs.append('use coconut oil or olive oil instead of ghee')
            cheese_words = ['parmesan', 'parmigiano', 'mozzarella', 'cheddar', 'gruyere',
                            'ricotta', 'feta', 'goat cheese', 'blue cheese', 'brie',
                            'camembert', 'cotija', 'queso', 'manchego', 'pecorino', 'cheese']
            if contains_any(ing_text, cheese_words):
                subs.append('omit the cheese or use a dairy-free alternative')
            if subs:
                tags_out['DF'] = {'native': False, 'mod': True, 'notes': join_sentences(subs)}

    # -------------------------------------------------------------------------
    # K — Keto
    # Native if no high-carb ingredients.
    # Mod only if the carb is a small background sweetener (honey, sugar, maple).
    # Do NOT mod if the grain/starch IS the dish (in title).
    # -------------------------------------------------------------------------
    keto_disq_present = contains_any(ing_text, KETO_DISQ_KW)
    if not keto_disq_present:
        tags_out['K'] = {'native': True, 'mod': False, 'notes': ''}
    else:
        keto_in_title = title_contains_any(title_lower, KETO_TITLE_IDENTITY_KW)
        hits = [kw for kw in KETO_DISQ_KW if kw in ing_text]
        hard_hits = [kw for kw in hits if kw not in KETO_EASY_SWAP_KW]
        easy_hits = [kw for kw in hits if kw in KETO_EASY_SWAP_KW]

        if not hard_hits and easy_hits and not keto_in_title:
            tags_out['K'] = {'native': False, 'mod': True,
                             'notes': 'Replace the sweetener with erythritol or monk fruit'}

    # -------------------------------------------------------------------------
    # AIP — Autoimmune Protocol
    # Very strict. Only tag native if genuinely AIP-compliant.
    # Only mod if disqualifier is a simple swap that doesn't gut the dish.
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
    elif active_blocks == ['nightshade'] or active_blocks == ['nut/seed']:
        # Only one simple disqualifier — may be moddable
        subs = []
        if aip_blocks['nightshade']:
            subs.append('omit or replace tomatoes with roasted beets or butternut squash')
            subs.append('replace peppers with celery or zucchini')
            subs.append('replace seed-based spices with turmeric, ginger, or fresh herbs')
        if aip_blocks['nut/seed']:
            subs.append('replace seed-based spices with turmeric, ginger, cinnamon, or fresh herbs')
        if subs:
            tags_out['AIP'] = {'native': False, 'mod': True, 'notes': join_sentences(subs)}

    # -------------------------------------------------------------------------
    # LF — Low-FODMAP
    # Native if no high-FODMAP ingredients.
    # Mod only if the only disqualifiers are garlic/onion/shallot.
    # -------------------------------------------------------------------------
    fodmap_present = contains_any(ing_text, FODMAP_DISQ_KW)
    if not fodmap_present:
        tags_out['LF'] = {'native': True, 'mod': False, 'notes': ''}
    else:
        fodmap_hits = [kw for kw in FODMAP_DISQ_KW if kw in ing_text]
        hard_fodmap = [kw for kw in fodmap_hits if kw in FODMAP_HARD_KW]
        easy_fodmap = [kw for kw in fodmap_hits if kw in FODMAP_EASY_SWAP_KW]

        if easy_fodmap and not hard_fodmap:
            has_garlic  = any(k in easy_fodmap for k in ['garlic', 'garlic powder'])
            has_onion   = any(k in easy_fodmap for k in ['onion', 'shallot', 'onion powder'])
            if has_garlic and has_onion:
                note = 'Replace garlic and onion with garlic-infused oil'
            elif has_garlic:
                note = 'Replace garlic with garlic-infused oil'
            elif has_onion:
                note = 'Replace onion with the green tops of scallions'
            else:
                note = 'Replace garlic and onion with garlic-infused oil'
            if not note.endswith('.'):
                note += '.'
            tags_out['LF'] = {'native': False, 'mod': True, 'notes': note}

    # -------------------------------------------------------------------------
    # LH — Low-Histamine
    # Very conservative. Only native if truly clean. Very rarely apply mods.
    # -------------------------------------------------------------------------
    histamine_present = contains_any(ing_text, HISTAMINE_DISQ_KW)
    if not histamine_present:
        tags_out['LH'] = {'native': True, 'mod': False, 'notes': ''}
    else:
        hist_hits = [kw for kw in HISTAMINE_DISQ_KW if kw in ing_text]
        # Only mod if the only disqualifiers are soy sauce or wine-vinegar (easy swap)
        easy_lh = ['soy sauce', 'vinegar']
        hard_hist = [kw for kw in hist_hits if kw not in easy_lh]
        if not hard_hist:
            subs = []
            if 'soy sauce' in hist_hits: subs.append('use coconut aminos instead of soy sauce')
            if 'vinegar' in hist_hits:   subs.append('replace vinegar with lime juice or apple cider vinegar')
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
                data = json.loads(script.string or '')
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

        ld = fetch_recipe_json_ld(url)
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
            # Clear all tag columns first, then fill from result
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
