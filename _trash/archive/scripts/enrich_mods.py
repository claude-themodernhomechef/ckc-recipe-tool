#!/usr/bin/env python3
"""
enrich_mods.py — Mod-Only Enrichment Pass
==========================================
Targets all recipes that have native diet tags but ZERO modification notes.
Does NOT overwrite native tags or ratings — only fills mod columns.

Rules: CKC_Diet_Compliance_Rules.md (March 26, 2026)
Run:   python3 enrich_mods.py
"""

import csv, json, re, sys, time, os
import requests
from bs4 import BeautifulSoup

CSV_FILE     = 'recipes_source.csv'
PROGRESS_LOG = 'mod_progress.json'
SLEEP_SEC    = 0.9
TAGS         = ['V', 'Vg', 'GF', 'DF', 'LH', 'LF', 'AIP', 'K']

SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
})

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def join_sentences(parts):
    """Join note fragments into proper natural-language sentences."""
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


def ing_has(ingredients, *keywords):
    """True if any ingredient line contains any of the given keywords."""
    for ing in ingredients:
        for kw in keywords:
            if kw in ing:
                return True
    return False


def title_has(title, *keywords):
    t = title.lower()
    return any(kw in t for kw in keywords)


def count_ing(ingredients, *keywords):
    """Count how many ingredient lines match any keyword."""
    return sum(1 for ing in ingredients if any(kw in ing for kw in keywords))


# ---------------------------------------------------------------------------
# "Don't gut the dish" checks
# ---------------------------------------------------------------------------

MEAT_TITLE_KW = [
    'chicken', 'beef', 'pork', 'lamb', 'steak', 'turkey', 'salmon', 'shrimp',
    'prawn', 'tuna', 'cod', 'halibut', 'tilapia', 'duck', 'veal', 'bison',
    'sausage', 'chorizo', 'bacon', 'ham', 'mahi', 'snapper', 'trout',
    'sea bass', 'branzino', 'scallop', 'crab', 'lobster', 'clam', 'mussel',
    'oyster', 'fish', 'meat', 'carnitas', 'carne', 'brisket', 'ribs',
    'wings', 'drumstick', 'thigh', 'breast', 'pulled pork', 'pulled chicken',
    'short rib', 'oxtail',
]

GRAIN_TITLE_KW = [
    'pasta', 'orzo', 'ramen', 'lo mein', 'chow mein', 'noodle', 'rice',
    'couscous', 'gnocchi', 'risotto', 'pilaf', 'farro', 'quinoa',
    'tortellini', 'ravioli', 'dumpling', 'pita', 'flatbread', 'pizza',
    'mac and cheese', 'gratin', 'au gratin', 'lasagna', 'crepe', 'pancake',
    'waffle', 'french toast', 'polenta', 'grits', 'hominy', 'cornbread',
]

LEGUME_TITLE_KW = [
    'chickpea', 'lentil', 'bean', 'dal', 'dahl', 'daal', 'hummus', 'refried',
    'edamame', 'tofu', 'tempeh', 'falafel',
    # South Asian / foreign language terms for legume dishes
    'chana', 'chole', 'rajma', 'moong', 'mung', 'urad', 'toor', 'masoor',
    'chhole', 'lobio', 'ful medames', 'feijoa',
]

POTATO_TITLE_KW = [
    'potato', 'potatoes', 'hash', 'latke', 'rösti', 'gnocchi',
]

DAIRY_TITLE_KW = [
    'parmesan', 'carbonara', 'alfredo', 'au gratin', 'gratin', 'cheesy',
    'mac and cheese', 'queso', 'feta', 'ricotta', 'mozzarella',
    'cream sauce', 'béchamel', 'cheese', 'yogurt sauce', 'tzatziki',
    'labneh', 'paneer',
]

NIGHTSHADE_TITLE_KW = [
    'tikka', 'masala', 'shakshuka', 'chili', 'enchilada', 'salsa', 'marinara',
    'arrabiata', 'pomodoro', 'tomato soup', 'tomato bisque', 'stuffed pepper',
    'eggplant parmesan', 'ratatouille',
]

FERMENTED_TITLE_KW = [
    'kimchi', 'miso', 'pickle', 'sauerkraut', 'vinaigrette',
]


def guts_dish(title, category):
    t = title.lower()
    if category == 'meat':
        return any(kw in t for kw in MEAT_TITLE_KW)
    if category == 'grain':
        return any(kw in t for kw in GRAIN_TITLE_KW)
    if category == 'legume':
        return any(kw in t for kw in LEGUME_TITLE_KW)
    if category == 'potato':
        return any(kw in t for kw in POTATO_TITLE_KW)
    if category == 'dairy':
        return any(kw in t for kw in DAIRY_TITLE_KW)
    if category == 'nightshade':
        return any(kw in t for kw in NIGHTSHADE_TITLE_KW)
    if category == 'fermented':
        return any(kw in t for kw in FERMENTED_TITLE_KW)
    return False


# ---------------------------------------------------------------------------
# Fetch
# ---------------------------------------------------------------------------

def fetch_ingredients(url):
    """Fetch recipe page, return list of ingredient strings (lowercased) or []."""
    try:
        resp = SESSION.get(url, timeout=14)
        if resp.status_code != 200:
            return []
        soup = BeautifulSoup(resp.text, 'html.parser')
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data = json.loads(script.string or '')
                items = data if isinstance(data, list) else [data]
                for item in items:
                    if isinstance(item, dict):
                        if item.get('@type') == 'Recipe':
                            ings = item.get('recipeIngredient', [])
                            return [str(i).lower() for i in ings]
                        for sub in item.get('@graph', []):
                            if isinstance(sub, dict) and sub.get('@type') == 'Recipe':
                                ings = sub.get('recipeIngredient', [])
                                return [str(i).lower() for i in ings]
            except Exception:
                pass
        return []
    except Exception:
        return []


# ---------------------------------------------------------------------------
# MOD LOGIC — one function per protocol
# ---------------------------------------------------------------------------

def mod_lf(ingredients, title, entree_type, native):
    """Low-FODMAP modification notes per CKC_Diet_Compliance_Rules Part 4."""
    if native:
        return None

    # If the recipe's core identity is a legume — no mod possible
    if guts_dish(title, 'legume'):
        return None

    has_garlic   = ing_has(ingredients, 'garlic')
    has_onion    = ing_has(ingredients, 'onion', 'onions') and not ing_has(ingredients, 'green onion', 'scallion top', 'spring onion top')
    has_shallot  = ing_has(ingredients, 'shallot')
    has_leek     = ing_has(ingredients, 'leek')
    has_oil      = ing_has(ingredients, 'olive oil', 'avocado oil', 'coconut oil', 'vegetable oil', 'canola oil', 'oil')
    has_butter   = ing_has(ingredients, 'butter') and not ing_has(ingredients, 'peanut butter', 'almond butter')
    has_fat      = has_oil or has_butter

    has_beans    = ing_has(ingredients, 'cannellini', 'kidney bean', 'black bean', 'pinto bean', 'navy bean',
                           'white bean', 'chickpea', 'lentil', 'black-eyed pea', 'fava bean', 'broad bean',
                           'butter bean', 'borlotti') and not guts_dish(title, 'legume')
    has_corn     = (any('corn' in i and 'cornstarch' not in i and 'cornmeal' not in i
                        and 'corn starch' not in i and 'acorn' not in i
                        for i in ingredients)
                    and any(kw in ' '.join(ingredients) for kw in ['corn kernel', 'sweet corn', 'hominy', 'whole corn', 'fresh corn', 'canned corn']))
    has_fennel   = ing_has(ingredients, 'fennel bulb', 'fresh fennel') and not ing_has(ingredients, 'fennel seed')
    has_mush     = ing_has(ingredients, 'mushroom')
    has_peanut   = ing_has(ingredients, 'peanut butter', 'peanut')
    has_soy      = ing_has(ingredients, 'soy sauce') and not ing_has(ingredients, 'tamari', 'coconut aminos')
    has_cream    = ing_has(ingredients, 'heavy cream', 'heavy whipping cream', 'half and half', 'half-and-half')
    has_yogurt   = ing_has(ingredients, 'greek yogurt', 'plain yogurt', 'yogurt')
    has_wine     = ing_has(ingredients, 'white wine', 'red wine', 'dry wine')
    has_balsamic = ing_has(ingredients, 'balsamic vinegar', 'balsamic')
    has_honey    = ing_has(ingredients, 'honey')
    has_flour_thickener = (ing_has(ingredients, 'all-purpose flour', 'ap flour') and
                           ing_has(ingredients, 'gravy', 'sauce', 'broth'))

    has_cauliflower_heavy = (title_has(title, 'cauliflower') and
                              ing_has(ingredients, 'cauliflower'))
    if has_cauliflower_heavy:
        return None  # cauliflower in large amounts is high-FODMAP; if it's the dish, skip

    notes = []
    any_disqualifier = False

    # --- Aromatic swaps (Section 4.1 & 4.2) ---
    if has_garlic or has_shallot or has_onion or has_leek:
        any_disqualifier = True
        if has_shallot and has_garlic and has_fat:
            notes.append("replace shallots and garlic with 2 tbsp garlic-infused oil")
        elif has_shallot and has_garlic:
            notes.append("replace shallots and garlic with 2 tbsp garlic-infused oil")
        elif has_garlic and has_onion and has_fat:
            notes.append("remove garlic and onion and replace 2 tbsp of the oil with garlic-infused oil")
        elif has_garlic and has_fat:
            notes.append("replace garlic and 1 tbsp of the oil with garlic-infused oil")
        elif has_garlic:
            notes.append("replace garlic with 1 tbsp garlic-infused oil")
        elif has_shallot and has_fat:
            notes.append("replace shallots with 1 tbsp garlic-infused oil")
        elif has_shallot:
            notes.append("replace shallots with 1 tbsp garlic-infused oil")

        if has_onion and not has_garlic and not has_shallot:
            et = (entree_type or '').lower()
            if 'salad' in et or title_has(title, 'salad', 'slaw'):
                notes.append("remove red onion")
            else:
                notes.append("replace onion with green tops of 3 scallions")

        if has_leek and not has_garlic and not has_onion and not has_shallot:
            notes.append("use green tops of leeks only — discard the white parts")

    # --- Beans / legumes (Section 4.4) ---
    if has_beans:
        any_disqualifier = True
        notes.append("remove beans")

    # --- Other high-FODMAP ingredients ---
    if has_corn:
        any_disqualifier = True
        notes.append("remove corn")
    if has_fennel:
        any_disqualifier = True
        notes.append("remove fennel")
    if has_mush:
        any_disqualifier = True
        notes.append("remove mushrooms")
    if has_peanut:
        any_disqualifier = True
        notes.append("remove peanut butter")

    # --- Secondary swaps (Section 4.5) ---
    if has_soy:
        notes.append("replace soy sauce with tamari")
    if has_cream:
        notes.append("replace heavy cream with full-fat canned coconut milk")
    if has_yogurt:
        notes.append("use lactose-free greek yogurt or coconut yogurt")
    if has_wine:
        notes.append("replace wine with matching broth")
    if has_balsamic:
        notes.append("replace balsamic vinegar with tamari and a splash of broth")
    if has_flour_thickener:
        notes.append("replace flour with arrowroot powder to thicken the sauce")

    if not any_disqualifier and not notes:
        return None
    if not notes:
        return None

    return join_sentences(notes)


def mod_df(ingredients, title, native):
    """Dairy-Free modification notes per CKC_Diet_Compliance_Rules Part 5."""
    if native:
        return None
    if guts_dish(title, 'dairy'):
        return None

    has_butter       = ing_has(ingredients, 'butter', 'unsalted butter', 'salted butter') and not ing_has(ingredients, 'peanut butter', 'almond butter', 'nut butter')
    has_heavy_cream  = ing_has(ingredients, 'heavy cream', 'heavy whipping cream', 'light cream', 'half and half', 'half-and-half', 'whipping cream')
    has_milk         = ing_has(ingredients, 'whole milk', 'skim milk', '2% milk', 'milk') and not ing_has(ingredients, 'coconut milk', 'oat milk', 'almond milk', 'soy milk', 'rice milk', 'nut milk')
    has_cream_cheese = ing_has(ingredients, 'cream cheese')
    has_sour_cream   = ing_has(ingredients, 'sour cream', 'creme fraiche', 'crème fraîche')
    has_yogurt       = ing_has(ingredients, 'greek yogurt', 'plain yogurt', 'yogurt') and not ing_has(ingredients, 'coconut yogurt', 'dairy-free yogurt')
    has_parmesan     = ing_has(ingredients, 'parmesan', 'parmigiano', 'pecorino', 'romano')
    has_mozz         = ing_has(ingredients, 'mozzarella')
    has_ricotta      = ing_has(ingredients, 'ricotta')
    has_feta         = ing_has(ingredients, 'feta')
    has_cotija       = ing_has(ingredients, 'cotija', 'queso fresco', 'queso blanco', 'queso')
    has_cheddar      = ing_has(ingredients, 'cheddar', 'gruyere', 'gruyère', 'goat cheese', 'brie', 'gouda', 'colby', 'manchego', 'camembert')
    has_ghee         = ing_has(ingredients, 'ghee')
    has_condensed    = ing_has(ingredients, 'condensed milk', 'evaporated milk', 'buttermilk')
    has_mascarpone   = ing_has(ingredients, 'mascarpone')

    notes = []

    if has_butter or has_ghee:
        notes.append("replace butter with olive oil")
    if has_heavy_cream or has_milk:
        notes.append("replace heavy cream with full-fat canned coconut milk")
    if has_condensed:
        notes.append("use full-fat coconut milk as a dairy-free substitute for condensed or evaporated milk")
    if has_sour_cream:
        notes.append("use plain unsweetened coconut yogurt in place of sour cream")
    if has_yogurt:
        notes.append("use plain unsweetened coconut yogurt in place of greek yogurt")
    if has_cream_cheese or has_mascarpone:
        notes.append("use dairy-free cream cheese")
    if has_parmesan:
        notes.append("replace parmesan with nutritional yeast and a pinch of miso paste for umami depth, or use Follow Your Heart vegan parmesan")
    if has_mozz:
        notes.append("use Kite Hill dairy-free mozzarella")
    if has_ricotta:
        notes.append("use Kite Hill dairy-free ricotta")
    if has_feta:
        if title_has(title, 'feta'):
            notes.append("use dairy-free feta")
        else:
            notes.append("remove feta or substitute dairy-free feta")
    if has_cotija:
        notes.append("remove cotija or queso fresco")
    if has_cheddar:
        notes.append("use your preferred dairy-free cheese alternative")

    if not notes:
        return None
    return join_sentences(notes)


def mod_gf(ingredients, title, native):
    """Gluten-Free modification notes per CKC_Diet_Compliance_Rules Part 6."""
    if native:
        return None
    if guts_dish(title, 'grain'):
        return None

    has_soy        = ing_has(ingredients, 'soy sauce') and not ing_has(ingredients, 'tamari', 'coconut aminos', 'gluten-free soy')
    has_oyster     = ing_has(ingredients, 'oyster sauce') and not ing_has(ingredients, 'gluten-free oyster')
    has_worce      = ing_has(ingredients, 'worcestershire') and not ing_has(ingredients, 'gluten-free worcestershire')
    has_hoisin     = ing_has(ingredients, 'hoisin') and not ing_has(ingredients, 'gluten-free hoisin')
    has_pasta      = ing_has(ingredients, 'pasta', 'spaghetti', 'fettuccine', 'linguine', 'penne', 'rigatoni', 'fusilli', 'tagliatelle', 'bucatini', 'angel hair', 'bow tie', 'farfalle', 'rotini', 'cavatappi', 'orecchiette')
    has_orzo       = ing_has(ingredients, 'orzo')
    has_couscous   = ing_has(ingredients, 'couscous')
    has_ramen      = ing_has(ingredients, 'ramen noodle', 'lo mein', 'chow mein')
    has_tortilla_f = ing_has(ingredients, 'flour tortilla')
    has_pita       = ing_has(ingredients, 'pita')
    has_bread      = (ing_has(ingredients, ' bread', 'sandwich bread', 'baguette', 'bun', 'roll')
                      and not ing_has(ingredients, 'panko', 'breadcrumb', 'bread crumb', 'gluten-free bread'))
    has_panko      = ing_has(ingredients, 'panko', 'breadcrumb', 'bread crumb') and not ing_has(ingredients, 'gluten-free panko', 'gf panko')
    has_flour      = (ing_has(ingredients, 'all-purpose flour', 'ap flour', 'whole wheat flour', 'wheat flour')
                      and not ing_has(ingredients, 'almond flour', 'coconut flour', 'rice flour', 'oat flour',
                                       'chickpea flour', 'cassava flour', '1:1 gluten-free', 'gluten-free flour'))

    notes = []

    if has_soy:
        notes.append("replace soy sauce with tamari")
    if has_oyster:
        notes.append("use gluten-free oyster sauce")
    if has_worce:
        notes.append("use gluten-free Worcestershire sauce")
    if has_hoisin:
        notes.append("use gluten-free hoisin sauce")
    if has_pasta:
        notes.append("use brown rice pasta")
    if has_orzo:
        notes.append("use cassava flour orzo")
    if has_couscous:
        notes.append("use gluten-free couscous or cauliflower rice")
    if has_ramen:
        notes.append("use brown rice noodle alternative")
    if has_tortilla_f:
        notes.append("use corn tortillas or gluten-free wraps")
    if has_pita:
        notes.append("use gluten-free pita")
    if has_bread:
        notes.append("use gluten-free bread")
    if has_panko:
        notes.append("use gluten-free panko breadcrumbs")
    if has_flour:
        # Structural vs. thickener
        if ing_has(ingredients, 'gravy', 'au jus') or title_has(title, 'gravy', 'au jus'):
            notes.append("replace flour with arrowroot powder to thicken (use 1 tbsp arrowroot per 1/4 cup flour)")
        elif ing_has(ingredients, 'meatball', 'meatloaf', 'patty', 'burger', 'binding'):
            notes.append("replace flour or breadcrumbs with gluten-free panko for binding")
        else:
            notes.append("use a 1:1 gluten-free flour blend")

    if not notes:
        return None
    return join_sentences(notes)


def mod_k(ingredients, title, entree_type, native):
    """Keto modification notes per CKC_Diet_Compliance_Rules Part 7."""
    if native:
        return None
    if guts_dish(title, 'grain') or guts_dish(title, 'potato'):
        return None
    if title_has(title, 'keto', 'low-carb', 'low carb'):
        return None

    et = (entree_type or '').lower()

    has_rice       = (ing_has(ingredients, 'white rice', 'jasmine rice', 'basmati rice', 'long grain rice', 'short grain rice', 'arborio', 'rice')
                      and not ing_has(ingredients, 'rice vinegar', 'rice wine', 'rice noodle', 'cauliflower rice', 'wild rice', 'brown rice'))
    has_pasta      = ing_has(ingredients, 'pasta', 'spaghetti', 'fettuccine', 'linguine', 'penne', 'rigatoni', 'fusilli', 'tagliatelle')
    has_orzo       = ing_has(ingredients, 'orzo')
    has_couscous   = ing_has(ingredients, 'couscous')
    has_gnocchi    = ing_has(ingredients, 'gnocchi') and not ing_has(ingredients, 'cauliflower gnocchi')
    has_ramen      = ing_has(ingredients, 'ramen noodle', 'lo mein noodle', 'chow mein noodle')
    has_noodle_generic = ing_has(ingredients, 'noodle') and not ing_has(ingredients, 'rice noodle', 'zucchini noodle', 'shirataki')
    has_potato     = (ing_has(ingredients, 'potato', 'potatoes', 'yukon gold', 'russet', 'red potato', 'fingerling')
                      and not guts_dish(title, 'potato'))
    has_sweet_pot  = ing_has(ingredients, 'sweet potato') and not guts_dish(title, 'potato')
    has_tortilla   = ing_has(ingredients, 'flour tortilla', 'corn tortilla', 'tortilla')
    has_bun        = (ing_has(ingredients, 'bun', 'burger bun', 'hamburger bun', 'bread roll', 'brioche bun')
                      and not ing_has(ingredients, 'breadcrumb', 'panko'))
    has_honey      = ing_has(ingredients, 'honey')
    has_maple      = ing_has(ingredients, 'maple syrup')
    has_brown_sug  = ing_has(ingredients, 'brown sugar', 'dark brown sugar')
    has_sugar      = (ing_has(ingredients, 'granulated sugar', 'white sugar', 'cane sugar')
                      and not ing_has(ingredients, 'coconut sugar'))
    has_beans      = (ing_has(ingredients, 'bean', 'beans', 'chickpea', 'lentil', 'pinto', 'black bean',
                               'cannellini', 'kidney', 'navy bean', 'white bean')
                      and not guts_dish(title, 'legume'))
    has_corn       = (any('corn' in i and 'cornstarch' not in i and 'cornmeal' not in i
                         and 'corn starch' not in i and 'acorn' not in i
                         for i in ingredients)
                      and any(kw in ' '.join(ingredients) for kw in ['corn kernel', 'sweet corn', 'hominy', 'whole corn', 'fresh corn']))
    has_panko      = ing_has(ingredients, 'panko', 'breadcrumb', 'bread crumb')
    has_fruit_high = ing_has(ingredients, 'pineapple', 'mango', 'banana', 'dried fruit', 'raisin', 'cranberry', 'date')

    is_asian = (title_has(title, 'thai', 'chinese', 'japanese', 'korean', 'asian', 'stir fry', 'stir-fry', 'fried rice')
                or ing_has(ingredients, 'soy sauce', 'fish sauce', 'sesame oil', 'mirin', 'rice vinegar'))

    structural_carbs = [has_rice, has_pasta, has_orzo, has_couscous, has_gnocchi,
                        has_ramen, has_noodle_generic, has_potato, has_sweet_pot,
                        has_tortilla, has_bun]
    any_structural = any(structural_carbs)

    notes = []

    if has_rice:
        notes.append("replace rice with cauliflower rice")
    if has_pasta:
        if is_asian:
            notes.append("use shirataki noodles in place of pasta")
        else:
            notes.append("use spiralized zucchini or keto pasta alternative")
    if has_orzo:
        notes.append("replace orzo with sautéed cauliflower rice")
    if has_couscous:
        notes.append("replace couscous with cauliflower rice")
    if has_gnocchi:
        notes.append("use cauliflower gnocchi")
    if has_ramen or (has_noodle_generic and is_asian):
        notes.append("use shirataki noodles")
    if has_potato:
        if 'salad' in et or title_has(title, 'salad'):
            notes.append("replace potatoes with roasted cauliflower florets")
        elif title_has(title, 'mash', 'mashed'):
            notes.append("replace mashed potatoes with cauliflower mash")
        else:
            notes.append("remove potatoes or replace with cauliflower florets")
    if has_sweet_pot:
        notes.append("replace sweet potato with cauliflower mash")
    if has_tortilla:
        notes.append("use keto wraps in place of tortillas")
    if has_bun:
        notes.append("use butter lettuce or iceberg wraps in place of buns")
    if has_beans:
        notes.append("remove beans")
    if has_corn:
        notes.append("remove corn")
    if has_honey or has_maple or has_brown_sug or has_sugar:
        notes.append("replace honey and sugar with allulose liquid sweetener")
    if has_panko and not any_structural:
        notes.append("replace breadcrumbs with almond flour for binding")
    if has_fruit_high and not any_structural:
        notes.append("reduce fruit to half the stated amount to manage net carbs")

    # Only worthwhile if there's a real structural carb to swap, OR a clear sweetener
    if not any_structural and not (has_honey or has_maple or has_brown_sug or has_sugar or has_beans or has_corn):
        return None
    if not notes:
        return None

    return join_sentences(notes)


def mod_aip(ingredients, title, native):
    """AIP modification notes per CKC_Diet_Compliance_Rules Part 8."""
    if native:
        return None
    if guts_dish(title, 'nightshade') and (
            ing_has(ingredients, 'tomato', 'tomatoes', 'bell pepper', 'chili', 'paprika')):
        return None
    if guts_dish(title, 'legume') and ing_has(ingredients, 'bean', 'chickpea', 'lentil', 'tofu', 'edamame'):
        return None
    if guts_dish(title, 'grain') and ing_has(ingredients, 'flour', 'pasta', 'rice', 'bread', 'oat'):
        return None
    if guts_dish(title, 'egg') and ing_has(ingredients, 'egg', 'eggs'):
        return None

    has_pepper   = ing_has(ingredients, 'black pepper', 'white pepper', 'cracked pepper', 'ground pepper')
    has_cumin    = ing_has(ingredients, 'cumin')
    has_mustard  = ing_has(ingredients, 'mustard', 'dijon', 'mustard seed', 'dry mustard')
    has_sesame   = ing_has(ingredients, 'sesame', 'tahini')
    has_chili    = ing_has(ingredients, 'chili', 'chile', 'chipotle', 'cayenne', 'red pepper flake',
                           'sriracha', 'hot sauce', 'gochujang', 'chili powder')
    has_paprika  = ing_has(ingredients, 'paprika', 'smoked paprika')
    has_bell_pep = ing_has(ingredients, 'bell pepper', 'red pepper', 'green pepper', 'yellow pepper')
    has_tomato   = ing_has(ingredients, 'tomato', 'tomatoes', 'cherry tomato', 'tomato paste',
                           'crushed tomato', 'marinara', 'diced tomato')
    has_soy      = ing_has(ingredients, 'soy sauce', 'tamari')
    has_miso     = ing_has(ingredients, 'miso')
    has_fish_s   = ing_has(ingredients, 'fish sauce')
    has_vinegar  = ing_has(ingredients, 'vinegar') and not ing_has(ingredients, 'balsamic')
    has_wine     = ing_has(ingredients, 'white wine', 'red wine', 'sake', 'wine')
    has_sugar    = ing_has(ingredients, 'brown sugar', 'white sugar', 'granulated sugar', 'cane sugar') and not ing_has(ingredients, 'coconut sugar')
    has_olives   = ing_has(ingredients, 'olive') and not ing_has(ingredients, 'olive oil')
    has_eggs     = ing_has(ingredients, ' egg ', 'eggs,', 'eggs.') and not guts_dish(title, 'egg')
    has_nuts     = (ing_has(ingredients, 'almond', 'walnut', 'cashew', 'pistachio', 'pine nut',
                            'pecan', 'hazelnut', 'brazil nut')
                   and not ing_has(ingredients, 'almond milk', 'almond extract'))
    has_legumes  = (ing_has(ingredients, 'bean', 'chickpea', 'lentil', 'peanut', 'soy')
                   and not guts_dish(title, 'legume'))
    has_grains   = (ing_has(ingredients, 'all-purpose flour', 'wheat flour', 'pasta', 'rice', 'oat',
                            'cornstarch', 'corn starch')
                   and not ing_has(ingredients, 'arrowroot', 'cassava', 'coconut flour', 'tapioca', 'tigernut')
                   and not guts_dish(title, 'grain'))
    has_curry    = ing_has(ingredients, 'curry powder', 'curry paste')
    has_fennel_s = ing_has(ingredients, 'fennel seed')
    has_sun_seed = ing_has(ingredients, 'sunflower seed', 'pepita', 'pumpkin seed')

    # Count hard-removal items (things you can't substitute, only remove)
    hard_removals = sum([
        1 if has_tomato and not ing_has(ingredients, 'sun-dried tomato') else 0,
        1 if has_bell_pep else 0,
        1 if has_legumes else 0,
        1 if has_grains else 0,
        1 if has_eggs else 0,
        1 if has_nuts else 0,
    ])

    if hard_removals >= 4:
        return None  # Would gut the dish

    notes = []

    # Seed-based spices (Section 8.1)
    if has_pepper:
        notes.append("remove black pepper")
    if has_cumin:
        notes.append("remove cumin or replace with a pinch of cinnamon")
    if has_mustard:
        notes.append("remove mustard and Dijon")
    if has_sesame:
        notes.append("remove sesame seeds and sesame oil")
    if has_sun_seed:
        notes.append("remove sunflower seeds and pepitas")
    if has_fennel_s:
        notes.append("remove fennel seeds")

    # Nightshades (Section 8.2)
    if has_chili or has_paprika:
        notes.append("remove chili and paprika")
    if has_bell_pep:
        notes.append("remove bell peppers")
    if has_tomato:
        notes.append("remove tomatoes")
    if has_curry:
        notes.append("replace curry powder with turmeric")

    # AIP-safe swaps (Section 8.3)
    if has_soy:
        notes.append("replace soy sauce with coconut aminos")
    if has_miso:
        notes.append("replace miso with coconut aminos")
    if has_fish_s:
        notes.append("replace fish sauce with coconut aminos")
    if has_vinegar:
        notes.append("replace vinegar with fresh lime or lemon juice")
    if has_wine:
        notes.append("replace wine with matching broth")
    if has_sugar:
        notes.append("replace sugar with agave")

    # Fermented foods (Section 8.4)
    if has_olives:
        notes.append("remove olives (fermented)")

    if has_eggs:
        notes.append("remove eggs if not structurally critical to the dish")
    if has_nuts:
        notes.append("remove nuts")
    if has_legumes:
        notes.append("remove beans or legumes")
    if has_grains:
        notes.append("use arrowroot powder or cassava flour in place of flour or cornstarch")

    if not notes:
        return None
    return join_sentences(notes)


def mod_lh(ingredients, title, native):
    """Low-Histamine modification notes per CKC_Diet_Compliance_Rules Part 10."""
    if native:
        return None

    has_vinegar    = ing_has(ingredients, 'vinegar')
    has_wine       = ing_has(ingredients, 'white wine', 'red wine', 'wine', 'sake')
    has_pickled    = ing_has(ingredients, 'pickled', 'pickle', 'capers', 'olives', 'sauerkraut')
    has_aged_ch    = ing_has(ingredients, 'parmesan', 'pecorino', 'aged cheese', 'blue cheese', 'gruyere')
    has_soy_miso   = ing_has(ingredients, 'soy sauce', 'tamari', 'miso')
    has_smk_paprika= ing_has(ingredients, 'smoked paprika')
    has_sour_cream = ing_has(ingredients, 'sour cream', 'creme fraiche')
    has_avocado    = ing_has(ingredients, 'avocado')
    has_tomato_conc= ing_has(ingredients, 'tomato paste', 'crushed tomato', 'canned tomato', 'tomato sauce')
    has_black_pep  = ing_has(ingredients, 'black pepper', 'cracked pepper', 'ground pepper')
    has_chili      = ing_has(ingredients, 'chili', 'sriracha', 'chipotle', 'cayenne', 'hot sauce', 'gochujang')
    has_mustard    = ing_has(ingredients, 'mustard', 'dijon')
    has_sumac      = ing_has(ingredients, 'sumac')
    has_fennel_s   = ing_has(ingredients, 'fennel seed')
    has_canola     = ing_has(ingredients, 'canola oil', 'vegetable oil', 'rapeseed oil')
    has_lemon_heavy= (count_ing(ingredients, 'lemon', 'lemon juice', 'lemon zest') >= 2
                      or title_has(title, 'lemon', 'citrus'))

    # Count how many significant triggers exist
    trigger_count = sum([
        1 if has_vinegar else 0,
        1 if has_wine else 0,
        1 if has_pickled else 0,
        1 if has_aged_ch else 0,
        1 if has_soy_miso else 0,
        1 if has_smk_paprika else 0,
        1 if has_sour_cream else 0,
        1 if has_avocado else 0,
        2 if has_tomato_conc else 0,     # tomato concentrate is a strong trigger
        2 if has_chili else 0,
        1 if has_sumac else 0,
    ])

    # LH is very conservative: too many triggers = not worth modding
    if trigger_count > 4:
        return None

    notes = []
    if has_vinegar:
        notes.append("replace vinegar with fresh lemon or lime juice")
    if has_wine:
        notes.append("replace wine with matching broth")
    if has_pickled:
        notes.append("remove pickled items and capers")
    if has_aged_ch:
        notes.append("remove or reduce aged cheese")
    if has_soy_miso:
        notes.append("replace soy sauce or miso with coconut aminos")
    if has_smk_paprika:
        notes.append("remove smoked paprika")
    if has_sour_cream:
        notes.append("remove sour cream")
    if has_avocado:
        notes.append("replace avocado with cucumber for a cooling element")
    if has_tomato_conc:
        notes.append("use fresh tomatoes rather than concentrated tomato paste")
    if has_black_pep:
        notes.append("remove black pepper")
    if has_chili:
        notes.append("remove chili and hot sauce")
    if has_mustard:
        notes.append("remove mustard and Dijon")
    if has_sumac:
        notes.append("remove sumac")
    if has_fennel_s:
        notes.append("remove fennel seeds")
    if has_canola:
        notes.append("replace canola oil with olive oil")
    if has_lemon_heavy:
        notes.append("reduce lemon to a small finishing squeeze rather than a full marinade")

    if not notes:
        return None
    return join_sentences(notes)


def mod_v_vg(ingredients, title, native_v, native_vg):
    """Vegan and Vegetarian modification notes per CKC_Diet_Compliance_Rules Part 9."""
    if native_v and native_vg:
        return None, None

    # If the main protein IS the dish's identity — no V/Vg mod
    if guts_dish(title, 'meat'):
        return None, None

    t = title.lower()
    is_mexican = any(kw in t for kw in ['taco', 'enchilada', 'tamale', 'burrito', 'fajita',
                                         'quesadilla', 'pozole', 'carnitas', 'carne', 'mexican'])
    is_asian   = any(kw in t for kw in ['stir fry', 'stir-fry', 'fried rice', 'bowl', 'ramen',
                                         'pho', 'thai', 'chinese', 'japanese', 'korean', 'asian'])
    is_pie     = any(kw in t for kw in ['pie', 'shepherd', 'cottage pie', 'pot pie', 'hash'])

    has_chicken    = ing_has(ingredients, 'chicken')
    has_beef       = ing_has(ingredients, 'beef', 'ground beef', 'steak')
    has_pork       = ing_has(ingredients, 'pork', 'sausage', 'chorizo', 'pancetta', 'bacon', 'prosciutto', 'ham', 'guanciale', 'salami', 'lardons')
    has_lamb       = ing_has(ingredients, 'lamb', 'ground lamb')
    has_turkey     = ing_has(ingredients, 'turkey', 'ground turkey')
    has_shrimp     = ing_has(ingredients, 'shrimp', 'prawn')
    has_fish       = ing_has(ingredients, 'salmon', 'tuna', 'cod', 'halibut', 'tilapia', 'sea bass', 'snapper', 'trout', 'mahi', 'branzino')
    has_shellfish  = ing_has(ingredients, 'scallop', 'crab', 'lobster', 'clam', 'mussel')
    has_anchovy    = ing_has(ingredients, 'anchovy', 'anchovy paste', 'anchovies')
    has_fish_sauce = ing_has(ingredients, 'fish sauce')
    has_worce      = ing_has(ingredients, 'worcestershire')
    has_chx_broth  = ing_has(ingredients, 'chicken broth', 'chicken stock', 'chicken bouillon')
    has_beef_broth = ing_has(ingredients, 'beef broth', 'beef stock', 'beef bouillon')
    has_eggs       = (ing_has(ingredients, ' egg', 'eggs') and not guts_dish(title, 'egg')
                     and not ing_has(ingredients, 'eggplant', 'egg noodle', 'egg wash'))
    has_dairy      = (ing_has(ingredients, 'butter', 'heavy cream', 'cheese', 'yogurt', 'milk')
                     and not ing_has(ingredients, 'coconut milk', 'nut milk', 'oat milk', 'peanut butter', 'almond butter'))
    has_honey      = ing_has(ingredients, 'honey')

    has_main_protein = any([has_chicken, has_beef, has_pork, has_lamb, has_turkey,
                             has_shrimp, has_fish, has_shellfish])

    v_notes  = []
    vg_notes = []

    # --- Main protein swap ---
    if has_main_protein and not native_vg:
        if has_chicken:
            if is_mexican:
                swap = "replace chicken with pinto beans"
            elif is_pie:
                swap = "replace chicken with 1 lb finely chopped mushrooms"
            else:
                swap = "replace chicken with 2 lbs extra firm tofu cut into 1-inch cubes"
            v_notes.append(swap)
            vg_notes.append(swap)

        elif has_beef:
            if is_mexican:
                swap = "replace ground beef with pinto beans or black beans"
            elif ing_has(ingredients, 'ground beef', 'ground') or is_pie:
                swap = "replace ground beef with Impossible Beef or 1 lb finely chopped mushrooms"
            else:
                swap = "replace beef with extra firm tofu cut to match the original protein shape"
            v_notes.append(swap)
            vg_notes.append(swap)

        elif has_pork:
            swap = "replace pork or sausage with extra firm tofu or Impossible Beef"
            v_notes.append(swap)
            vg_notes.append(swap)

        elif has_lamb:
            swap = "replace lamb with Impossible Beef or extra firm tofu"
            v_notes.append(swap)
            vg_notes.append(swap)

        elif has_turkey:
            swap = "replace turkey with Impossible Beef or extra firm tofu"
            v_notes.append(swap)
            vg_notes.append(swap)

        elif has_shrimp:
            swap = "replace shrimp with extra firm tofu cut into 1-inch cubes"
            v_notes.append(swap)
            vg_notes.append(swap)

        elif has_fish:
            swap = "replace fish with tofu rectangles (cut a 1 lb block into four thin pieces)"
            v_notes.append(swap)
            vg_notes.append(swap)

        elif has_shellfish:
            swap = "replace shellfish with extra firm tofu"
            v_notes.append(swap)
            vg_notes.append(swap)

    # --- Background flavorings (both V and Vg) ---
    if has_anchovy:
        note = "replace anchovy paste with 1 tbsp tamari and 1 tbsp capers with their juice"
        v_notes.append(note)
        if not native_vg:
            vg_notes.append(note)

    if has_fish_sauce:
        note = "replace fish sauce with extra soy sauce"
        v_notes.append(note)
        if not native_vg:
            vg_notes.append(note)

    if has_worce:
        note = "use vegan Worcestershire sauce"
        v_notes.append(note)
        if not native_vg:
            vg_notes.append(note)

    # --- Broth swaps (ALWAYS state explicitly per Section 9.2) ---
    if has_chx_broth:
        note = "replace chicken broth with vegetable broth"
        v_notes.append(note)
        if not native_vg:
            vg_notes.append(note)

    if has_beef_broth:
        note = "replace beef broth with vegetable broth"
        v_notes.append(note)
        if not native_vg:
            vg_notes.append(note)

    # --- Eggs (V only, Section 9.3) ---
    if has_eggs and not native_v:
        v_notes.append("replace eggs with a flax egg (2 tbsp ground flax mixed with 1 tbsp water, rest 5 min)")

    # --- Honey (V only) ---
    if has_honey and not native_v:
        v_notes.append("replace honey with agave")

    # --- Dairy (V only) ---
    if has_dairy and not native_v:
        v_notes.append("use dairy-free alternatives for any cream or butter called for")

    # Build results — only produce a mod if there's something meaningful to say
    vg_mod = join_sentences(vg_notes) if (not native_vg and vg_notes) else None
    v_mod  = join_sentences(v_notes)  if (not native_v  and v_notes)  else None

    return v_mod, vg_mod


# ---------------------------------------------------------------------------
# Needs-mod check
# ---------------------------------------------------------------------------

def needs_mod(row):
    """True if the row has any native tag but zero mod columns filled."""
    has_native = any((row.get(t) or '').strip() == '1' for t in TAGS)
    has_mod    = any((row.get(f'{t} Mod') or '').strip() == '1' for t in TAGS)
    return has_native and not has_mod


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    # Load progress
    if os.path.exists(PROGRESS_LOG):
        with open(PROGRESS_LOG) as f:
            progress = json.load(f)
    else:
        progress = {}

    # Load CSV
    with open(CSV_FILE, newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    # Identify targets
    targets = [(i, r) for i, r in enumerate(rows)
               if needs_mod(r) and (r.get('URL') or '').strip()
               and (r.get('Recipe Title') or '').strip() not in progress]

    print(f"Total recipes needing mod pass: {len(targets)}")
    processed = 0
    updated   = 0

    for i, row in targets:
        title      = (row.get('Recipe Title') or '').strip()
        url        = (row.get('URL') or '').strip()
        entree     = (row.get('Entree Type') or '').strip()
        blogger    = (row.get('Blogger Name') or '').lower().strip()

        native = {t: (row.get(t) or '').strip() == '1' for t in TAGS}

        print(f"  [{processed+1}/{len(targets)}] {title[:55]}", end='', flush=True)

        # Get ingredients
        ingredients = fetch_ingredients(url)

        if not ingredients:
            print(" — no ingredients")
            progress[title] = {'skip': True}
            processed += 1
            if processed % 20 == 0:
                with open(PROGRESS_LOG, 'w') as f:
                    json.dump(progress, f)
            time.sleep(SLEEP_SEC)
            continue

        print(f" ({len(ingredients)} ingredients)")

        # Run each protocol mod
        lf_note  = mod_lf(ingredients, title, entree, native['LF'])
        df_note  = mod_df(ingredients, title, native['DF'])
        gf_note  = mod_gf(ingredients, title, native['GF'])
        k_note   = mod_k(ingredients, title, entree, native['K'])
        aip_note = mod_aip(ingredients, title, native['AIP'])
        lh_note  = mod_lh(ingredients, title, native['LH'])
        v_note, vg_note = mod_v_vg(ingredients, title, native['V'], native['Vg'])

        result = {
            'LF Mod':  '1' if lf_note else '',
            'LF Mod Notes': lf_note or '',
            'DF Mod':  '1' if df_note else '',
            'DF Mod Notes': df_note or '',
            'GF Mod':  '1' if gf_note else '',
            'GF Mod Notes': gf_note or '',
            'K Mod':   '1' if k_note else '',
            'K Mod Notes':  k_note or '',
            'AIP Mod': '1' if aip_note else '',
            'AIP Mod Notes': aip_note or '',
            'LH Mod':  '1' if lh_note else '',
            'LH Mod Notes': lh_note or '',
            'V Mod':   '1' if v_note else '',
            'V Mod Notes':  v_note or '',
            'Vg Mod':  '1' if vg_note else '',
            'Vg Mod Notes': vg_note or '',
        }

        progress[title] = result
        processed += 1
        if any(v for v in result.values() if v and v != ''):
            updated += 1

        if processed % 20 == 0:
            with open(PROGRESS_LOG, 'w') as f:
                json.dump(progress, f)
            print(f"    → Saved progress ({processed} done, {updated} updated)")

        time.sleep(SLEEP_SEC)

    # Final save of progress
    with open(PROGRESS_LOG, 'w') as f:
        json.dump(progress, f, indent=2)

    # Apply results back to CSV
    print(f"\nApplying {updated} mod updates to {CSV_FILE} ...")
    mod_cols = [f'{t} Mod' for t in TAGS] + [f'{t} Mod Notes' for t in TAGS]

    apply_count = 0
    for row in rows:
        title = (row.get('Recipe Title') or '').strip()
        result = progress.get(title)
        if not result or result.get('skip'):
            continue
        # Only write if row currently has no mod set
        has_mod = any((row.get(f'{t} Mod') or '').strip() == '1' for t in TAGS)
        if has_mod:
            continue
        for col, val in result.items():
            if col in row:
                row[col] = val
        apply_count += 1

    with open(CSV_FILE, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Done. {apply_count} recipes updated in {CSV_FILE}.")
    print(f"Scraped {processed} pages — {processed - updated} returned no ingredient data.")


if __name__ == '__main__':
    main()
