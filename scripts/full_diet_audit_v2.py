#!/usr/bin/env python3
"""
full_diet_audit_v2.py
=====================
Comprehensive re-audit of all 699 YES recipes using the actual ingredient list.
Applies all 8 diet tags: GF, DF, K, LF, V, Vg, AIP, LH.
Also scrapes og:image for missing recipe photos.
Also scrapes ingredients for the ~94 recipes that are missing them.

Rules from: .claude/agent/diet-compliance-rules.md

Run:
  python3 full_diet_audit_v2.py --dry-run   # preview changes only
  python3 full_diet_audit_v2.py             # apply to Firebase
"""

import json, os, sys, time, re, argparse
import requests
from bs4 import BeautifulSoup
from difflib import SequenceMatcher
import firebase_admin
from firebase_admin import credentials, firestore

# ── Config ────────────────────────────────────────────────────────────────────
YES_RECIPES_FILE = 'yes_recipes.json'
INGREDIENTS_FILE = 'ingredients.json'
PROPOSED_FILE    = 'proposed_changes_v2.json'
SLEEP_SEC        = 0.5

SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
})

# ── Firebase init ──────────────────────────────────────────────────────────────
def init_firebase():
    sa_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT', '')
    if sa_json:
        cred = credentials.Certificate(json.loads(sa_json))
    elif os.path.exists('service-account.json'):
        cred = credentials.Certificate('service-account.json')
    else:
        print('No Firebase credentials found.'); sys.exit(1)
    firebase_admin.initialize_app(cred)
    return firestore.client()

# ── Load data ─────────────────────────────────────────────────────────────────
with open(YES_RECIPES_FILE) as f:
    yes_recipes = json.load(f)

with open(INGREDIENTS_FILE) as f:
    ing_db = json.load(f)

print(f"Loaded {len(yes_recipes)} YES recipes")
print(f"Ingredients DB: {len(ing_db)} entries")

# ── Fuzzy ingredient lookup ───────────────────────────────────────────────────
def similarity(a, b):
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

_match_cache = {}
def find_ingredients(name, url=''):
    if name in _match_cache:
        return _match_cache[name]
    if name in ing_db and ing_db[name]:
        _match_cache[name] = ing_db[name]
        return ing_db[name]
    slug = url.rstrip('/').split('/')[-1].replace('-', ' ')
    best, best_score = None, 0
    for k in ing_db:
        s = max(similarity(name, k), similarity(slug, k))
        if s > best_score:
            best_score, best = s, k
    result = ing_db[best] if best_score >= 0.72 and best and ing_db.get(best) else []
    _match_cache[name] = result
    return result

# ── Web scraping helpers ──────────────────────────────────────────────────────
def scrape_ingredients(url):
    """Extract ingredients from JSON-LD on a recipe page."""
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
                            return [str(i).strip() for i in item.get('recipeIngredient', []) if str(i).strip()]
                        for sub in item.get('@graph', []):
                            if isinstance(sub, dict) and sub.get('@type') == 'Recipe':
                                return [str(i).strip() for i in sub.get('recipeIngredient', []) if str(i).strip()]
            except Exception:
                pass
    except Exception:
        pass
    return []

def scrape_og_image(url):
    """Extract og:image from a recipe page."""
    try:
        resp = SESSION.get(url, timeout=12)
        if resp.status_code != 200:
            return ''
        soup = BeautifulSoup(resp.text, 'html.parser')
        # Try og:image first
        og = soup.find('meta', property='og:image')
        if og and og.get('content'):
            return og['content'].strip()
        # Try twitter:image
        tw = soup.find('meta', attrs={'name': 'twitter:image'})
        if tw and tw.get('content'):
            return tw['content'].strip()
        # Try JSON-LD image
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data = json.loads(script.string or '')
                items = data if isinstance(data, list) else [data]
                for item in items:
                    if isinstance(item, dict):
                        if item.get('@type') == 'Recipe' and item.get('image'):
                            img = item['image']
                            if isinstance(img, list):
                                return img[0] if img else ''
                            if isinstance(img, dict):
                                return img.get('url', '')
                            return str(img)
                        for sub in item.get('@graph', []):
                            if isinstance(sub, dict) and sub.get('@type') == 'Recipe' and sub.get('image'):
                                img = sub['image']
                                if isinstance(img, list):
                                    return img[0] if img else ''
                                if isinstance(img, dict):
                                    return img.get('url', '')
                                return str(img)
            except Exception:
                pass
    except Exception:
        pass
    return ''

# ── Ingredient detection helpers ──────────────────────────────────────────────
def ing_lower(ings):
    """Return lowercased ingredient strings."""
    return [i.lower() for i in ings]

def has(ings_lo, keywords, exclude=None):
    """
    Check if any ingredient contains any keyword (exact substring).
    exclude: list of substrings that, if present in the same ingredient, negate the match.
    Returns the first matching ingredient string, or None.
    """
    exclude = exclude or []
    for ing in ings_lo:
        for kw in keywords:
            if kw in ing:
                # Check exclusions
                if any(ex in ing for ex in exclude):
                    continue
                return ing
    return None

def has_any(ings_lo, keywords, exclude=None):
    """Returns True/False."""
    return has(ings_lo, keywords, exclude) is not None

def find_all(ings_lo, keywords, exclude=None):
    """Returns list of all matching ingredient strings."""
    exclude = exclude or []
    results = []
    for ing in ings_lo:
        for kw in keywords:
            if kw in ing:
                if not any(ex in ing for ex in exclude):
                    results.append(ing)
                    break
    return results

def title_has(name_lo, keywords):
    """Check if recipe title contains any keyword."""
    for kw in keywords:
        if kw in name_lo:
            return True
    return False

# ── Oil quantity helper ───────────────────────────────────────────────────────
def extract_oil_tbsp(ings_lo):
    """Try to guess total oil tablespoons from ingredients for LF garlic-oil note."""
    for ing in ings_lo:
        if 'olive oil' in ing or 'avocado oil' in ing or 'vegetable oil' in ing or 'oil' in ing:
            # Look for tablespoon quantities
            m = re.search(r'(\d+(?:\.\d+)?)\s*(?:tablespoon|tbsp)', ing)
            if m:
                return int(float(m.group(1)))
            # Look for common fractions
            if '¼' in ing or '1/4' in ing: return 1
            if '½' in ing or '1/2' in ing: return 2
            if '¾' in ing or '3/4' in ing: return 2
    return 2  # default

# ── MEAT/FISH title keywords (for V/Vg gutting detection) ────────────────────
MEAT_IN_TITLE = [
    'chicken', 'beef', 'pork', 'lamb', 'salmon', 'tuna', 'shrimp', 'turkey',
    'duck', 'veal', 'sausage', 'lobster', 'crab', 'scallop', 'cod', 'halibut',
    'tilapia', 'mahi', 'bass', 'snapper', 'trout', 'sardine', 'anchovy',
    'steak', 'brisket', 'ribs', 'wings', 'drumstick', 'meatball', 'meatloaf',
    'bolognese', 'carbonara', 'clam', 'mussel', 'squid', 'calamari', 'seafood',
    'burger', 'patty', 'chop', 'tenderloin', 'roast', 'ham', 'prosciutto',
    'chorizo', 'bacon', 'lox', 'ahi', 'branzino', 'flounder', 'swordfish',
    'oxtail', 'short rib', 'short-rib', 'carnitas', 'shawarma', 'gyro',
    'kebab', 'souvlaki', 'piccata', 'marsala', 'scallopini',
]
MEAT_IN_ING = MEAT_IN_TITLE + [
    'ground beef', 'ground turkey', 'ground pork', 'ground lamb', 'ground chicken',
    'flank steak', 'skirt steak', 'sirloin', 'ribeye', 'chuck', 'pork belly',
    'pork shoulder', 'chicken breast', 'chicken thigh', 'chicken leg',
    'fish fillet', 'fish sauce',
]

# ── GF Assessment ─────────────────────────────────────────────────────────────
def assess_gf(ings, name):
    lo = ing_lower(ings)
    name_lo = name.lower()
    notes = []

    # Soy sauce (check for soy sauce that is NOT already tamari/coconut aminos/gf)
    if has(lo, ['soy sauce'], exclude=['tamari', 'coconut aminos', 'gluten-free soy', 'gf soy']):
        notes.append("Replace soy sauce with tamari.")
    # Oyster sauce
    if has(lo, ['oyster sauce'], exclude=['gluten-free oyster', 'gf oyster']):
        notes.append("Replace oyster sauce with a GF variety.")
    # Hoisin sauce
    if has(lo, ['hoisin'], exclude=['gluten-free hoisin', 'gf hoisin']):
        notes.append("Replace hoisin sauce with GF hoisin sauce.")
    # Worcestershire
    if has(lo, ['worcestershire'], exclude=['gluten-free worcestershire', 'gf worcestershire', 'vegan worcestershire']):
        notes.append("Use GF Worcestershire sauce.")
    # All-purpose flour / wheat flour
    flour_ing = has(lo, ['all-purpose flour', 'wheat flour', 'bread flour', 'plain flour'],
                    exclude=['gluten-free', 'gf flour', 'almond flour', 'coconut flour', 'rice flour',
                             'oat flour', 'chickpea flour', 'cassava flour', 'tapioca', 'arrowroot'])
    if flour_ing:
        # Determine role: thickener vs structural
        if any(x in name_lo for x in ['bread', 'cake', 'muffin', 'biscuit', 'waffle', 'pancake']):
            notes.append("Replace all-purpose flour with a 1:1 GF flour blend.")
        else:
            notes.append("Replace all-purpose flour with a 1:1 GF flour blend.")
    # Pasta (not rice/chickpea/lentil pasta)
    pasta_ing = has(lo, ['pasta', 'penne', 'spaghetti', 'fettuccine', 'linguine', 'rigatoni',
                          'fusilli', 'farfalle', 'rotini', 'angel hair', 'bucatini', 'tagliatelle',
                          'cavatappi', 'macaroni', 'ditalini', 'orecchiette', 'pappardelle'],
                    exclude=['rice pasta', 'gf pasta', 'chickpea pasta', 'lentil pasta',
                             'gluten-free pasta', 'cassava pasta', 'shirataki', 'zucchini noodle',
                             'kelp noodle'])
    if pasta_ing:
        notes.append("Replace pasta with a GF alternative. We like brown rice pasta for the most comparable texture.")
    # Orzo
    if has(lo, ['orzo'], exclude=['rice orzo', 'gf orzo', 'cassava orzo', 'gluten-free orzo']):
        notes.append("Use GF orzo such as cassava flour orzo.")
    # Couscous
    if has(lo, ['couscous'], exclude=['cauliflower couscous', 'gf couscous']):
        notes.append("Replace couscous with GF couscous or cauliflower rice.")
    # Breadcrumbs / panko
    if has(lo, ['panko'], exclude=['gf panko', 'gluten-free panko']):
        notes.append("Use GF panko for the recipe.")
    if has(lo, ['breadcrumb', 'bread crumb'], exclude=['gf bread', 'gluten-free bread']):
        notes.append("Replace breadcrumbs with GF panko.")
    # Flour tortillas
    if has(lo, ['flour tortilla'], exclude=['corn tortilla', 'gf tortilla', 'cassava tortilla']):
        notes.append("Replace flour tortillas with corn tortillas or a GF variety.")
    # Ramen / lo mein noodles
    if has(lo, ['ramen noodle', 'lo mein noodle', 'udon', 'egg noodle'],
            exclude=['rice noodle', 'gf noodle', 'brown rice noodle']):
        notes.append("Replace with a brown rice noodle alternative.")
    # Regular bread (as ingredient, not thickener)
    if has(lo, [' bread ', 'bread slices', 'bread loaf', 'white bread', 'sourdough bread'],
            exclude=['gf bread', 'gluten-free bread', 'breadcrumb', 'cornbread',
                     'pita bread']):
        notes.append("Use GF bread alternative.")
    # Pita
    if has(lo, ['pita'], exclude=['gf pita', 'gluten-free pita']):
        notes.append("Use GF bread alternative.")
    # Buns
    if has(lo, ['bun', 'hamburger bun', 'brioche bun'], exclude=['gf bun', 'gluten-free bun']):
        notes.append("Replace buns with a GF variety.")
    # Barley
    if has(lo, ['barley'], exclude=['pearl barley alternative', 'gf']):
        notes.append("Omit barley or replace with GF grain alternative.")
    # Wonton wrappers
    if has(lo, ['wonton', 'dumpling wrapper', 'gyoza wrapper']):
        notes.append("Use GF wonton wrappers or rice paper.")
    # Beer
    if has(lo, ['beer', 'lager', 'ale', 'stout'], exclude=['gf beer', 'gluten-free beer', 'root beer']):
        notes.append("Use GF beer or replace with chicken broth.")
    # Flour as coating
    if has(lo, ['dredge in flour', 'coat in flour', 'dusted with flour', 'flour for coating',
                'seasoned flour']):
        notes.append("Replace all-purpose flour with a 1:1 GF flour blend.")

    # Cornstarch is GF - don't flag it
    # Tamari by itself is GF - don't flag it
    # Coconut aminos is GF - don't flag it

    if not notes:
        return True, False, ''

    combined = ' '.join(notes)
    return False, True, combined

# ── DF Assessment ──────────────────────────────────────────────────────────────
def assess_df(ings, name):
    lo = ing_lower(ings)
    name_lo = name.lower()
    notes = []

    # Butter (not nut butter)
    butter_ing = has(lo, ['butter'], exclude=[
        'peanut butter', 'almond butter', 'sunflower butter', 'cashew butter',
        'sunbutter', 'nut butter', 'seed butter', 'tahini', 'dairy-free butter',
        'vegan butter', 'earth balance', 'butter lettuce', 'coconut butter',
        'clarified butter',  # ghee — we handle separately
    ])
    if butter_ing:
        # Check if it's used for cooking/sautéing or finishing
        if any('melt' in ing or 'sauté' in ing or 'cook' in ing for ing in lo if 'butter' in ing):
            notes.append("Replace butter with olive oil.")
        else:
            notes.append("Replace butter with dairy-free butter.")
    # Ghee
    if has(lo, ['ghee'], exclude=['coconut ghee']):
        notes.append("Replace ghee with coconut oil or avocado oil.")
    # Heavy cream / whipping cream
    if has(lo, ['heavy cream', 'heavy whipping cream', 'whipping cream', 'double cream'],
            exclude=['coconut cream', 'dairy-free cream', 'oat cream', 'soy cream']):
        notes.append("Replace heavy cream with full-fat canned coconut milk.")
    # Half-and-half
    if has(lo, ['half-and-half', 'half and half'],
            exclude=['coconut', 'dairy-free', 'non-dairy']):
        notes.append("Replace half-and-half with coconut milk.")
    # Milk
    if has(lo, ['whole milk', 'skim milk', 'low-fat milk', '2% milk', 'cow\'s milk',
                'buttermilk', ' milk'],
            exclude=['coconut milk', 'almond milk', 'oat milk', 'soy milk', 'cashew milk',
                     'rice milk', 'dairy-free milk', 'non-dairy milk', 'nut milk',
                     'evaporated milk']):  # evaporated milk is dairy but rare
        notes.append("Replace milk with unsweetened oat milk or almond milk.")
    # Evaporated milk (dairy)
    if has(lo, ['evaporated milk'], exclude=['coconut']):
        notes.append("Replace evaporated milk with full-fat canned coconut milk.")
    # Yogurt
    if has(lo, ['greek yogurt', 'plain yogurt', 'yogurt', 'skyr'],
            exclude=['coconut yogurt', 'almond yogurt', 'dairy-free yogurt', 'vegan yogurt',
                     'non-dairy yogurt', 'lactose-free']):
        notes.append("Replace Greek yogurt with plain unsweetened coconut yogurt.")
    # Sour cream
    if has(lo, ['sour cream', 'crème fraîche', 'creme fraiche'],
            exclude=['dairy-free sour cream', 'vegan sour cream', 'coconut sour cream']):
        notes.append("Replace sour cream with a dairy-free alternative.")
    # Cream cheese
    if has(lo, ['cream cheese'], exclude=['dairy-free cream cheese', 'vegan cream cheese', 'kite hill']):
        notes.append("Replace cream cheese with a dairy-free cream cheese alternative.")
    # Parmesan
    if has(lo, ['parmesan', 'parmigiano', 'pecorino'],
            exclude=['dairy-free', 'vegan parmesan', 'nutritional yeast']):
        notes.append("Replace parmesan with nutritional yeast and 1 tablespoon miso paste or porcini mushroom powder.")
    # Mozzarella / ricotta
    if has(lo, ['mozzarella'], exclude=['dairy-free mozzarella', 'vegan mozzarella', 'kite hill']):
        notes.append("Replace mozzarella with a dairy-free mozzarella alternative. We like the Kite Hill brand.")
    if has(lo, ['ricotta'], exclude=['dairy-free ricotta', 'vegan ricotta', 'kite hill']):
        notes.append("Replace ricotta with a dairy-free ricotta. We like the Kite Hill brand.")
    # Feta
    if has(lo, ['feta'], exclude=['dairy-free feta', 'vegan feta']):
        # Feta as garnish vs core
        notes.append("Remove feta cheese.")
    # Cotija
    if has(lo, ['cotija'], exclude=['vegan cotija']):
        notes.append("Remove cotija.")
    # Cheddar, gouda, gruyère, brie, goat cheese etc.
    if has(lo, ['cheddar', 'gouda', 'gruyère', 'gruyere', 'brie', 'goat cheese',
                'manchego', 'asiago', 'provolone', 'colby', 'havarti', 'monterey jack',
                'swiss cheese', 'fontina'],
            exclude=['dairy-free', 'vegan']):
        notes.append("Replace cheese with a dairy-free alternative.")
    # Condensed milk
    if has(lo, ['condensed milk', 'sweetened condensed'], exclude=['coconut condensed']):
        notes.append("Replace condensed milk with sweetened condensed coconut milk.")

    if not notes:
        return True, False, ''

    combined = ' '.join(notes)
    return False, True, combined

# ── K (Keto) Assessment ───────────────────────────────────────────────────────
def assess_k(ings, name):
    lo = ing_lower(ings)
    name_lo = name.lower()
    notes = []

    # Gutting check: if the grain/starch IS the dish name
    guts_k = any(kw in name_lo for kw in [
        'pasta', 'risotto', 'rice pilaf', 'orzo', 'couscous', 'gnocchi', 'polenta',
        'oatmeal', 'granola', 'quinoa bowl', 'grain bowl', 'noodle soup', 'ramen',
        'tortellini', 'ravioli', 'lasagna', 'bread pudding', 'french toast',
    ])
    if guts_k:
        return False, False, ''

    # Rice (unless cauliflower rice)
    if has(lo, ['rice', 'white rice', 'brown rice', 'jasmine rice', 'basmati rice',
                'arborio rice', 'wild rice', 'fried rice', 'rice noodle'],
            exclude=['cauliflower rice', 'rice vinegar', 'rice paper', 'rice wine',
                     'rice flour', 'coconut rice', 'forbidden rice']):
        # Check if rice is identity of dish
        if any(kw in name_lo for kw in ['rice', 'fried rice', 'rice bowl', 'congee', 'pilaf']):
            return False, False, ''
        notes.append("Substitute white rice with cauliflower rice.")

    # Pasta
    if has(lo, ['pasta', 'penne', 'spaghetti', 'fettuccine', 'linguine', 'rigatoni',
                'fusilli', 'farfalle', 'rotini', 'macaroni', 'noodle', 'orzo',
                'ditalini', 'pappardelle', 'tagliatelle', 'bucatini', 'egg noodle'],
            exclude=['shirataki', 'zucchini noodle', 'kelp noodle', 'heart of palm',
                     'rice noodle', 'cassava pasta']):
        notes.append("Replace pasta with zucchini noodles or keto pasta.")

    # Couscous
    if has(lo, ['couscous'], exclude=['cauliflower couscous']):
        notes.append("Replace couscous with cauliflower rice.")

    # Bread / buns / tortillas
    if has(lo, ['bread', 'bun', 'roll', 'pita', 'baguette', 'ciabatta', 'sourdough'],
            exclude=['almond flour bread', 'keto bread', 'breadcrumb in', 'bread crumb',
                     'gf bread', 'gluten-free bread']):
        if any(kw in name_lo for kw in ['sandwich', 'toast', 'bread', 'bruschetta', 'crostini']):
            return False, False, ''
        notes.append("Replace buns with butter lettuce or iceberg lettuce wraps.")
    if has(lo, ['tortilla'], exclude=['keto tortilla', 'cassava tortilla', 'lettuce wrap']):
        notes.append("Use keto-friendly tortillas.")

    # Flour (for thickening — not structural bread)
    if has(lo, ['all-purpose flour', 'wheat flour'],
            exclude=['almond flour', 'coconut flour', 'gf flour', 'gluten-free flour',
                     'cassava flour', 'keto flour']):
        notes.append("Replace flour with arrowroot powder.")

    # Oats (not keto)
    if has(lo, ['oats', 'oatmeal', 'rolled oat'], exclude=['gluten-free oat']):
        if any(kw in name_lo for kw in ['oat', 'granola', 'overnight oat']):
            return False, False, ''
        notes.append("Remove oats from the recipe.")

    # Quinoa
    if has(lo, ['quinoa']):
        if 'quinoa' in name_lo:
            return False, False, ''
        notes.append("Serve over cooked vegetables instead of quinoa.")

    # Corn
    if has(lo, ['corn', 'sweet corn', 'corn kernels', 'corn on the cob', 'hominy'],
            exclude=['cornstarch', 'corn oil', 'corn vinegar', 'popcorn']):
        notes.append("Remove corn.")

    # Potatoes (not sweet potatoes — both are non-keto but different notes)
    if has(lo, [' potato', 'potatoes', 'hash brown', 'mashed potato', 'baked potato'],
            exclude=['sweet potato', 'yam', 'baby potato is small']):
        if 'potato' in name_lo and 'sweet' not in name_lo:
            return False, False, ''
        notes.append("Remove potatoes and replace with roasted cauliflower florets.")
    # Sweet potatoes
    if has(lo, ['sweet potato', 'sweet potatoes', 'yam'],
            exclude=['sweet potato vermicelli']):
        notes.append("Replace sweet potatoes with 1 large cauliflower head, roasted.")

    # Beans and legumes
    if has(lo, ['chickpea', 'garbanzo', 'lentil', 'black bean', 'kidney bean',
                'white bean', 'cannellini', 'navy bean', 'pinto bean', 'edamame',
                'green pea', 'split pea'],
            exclude=['snap pea', 'snow pea']):
        if any(kw in name_lo for kw in ['chickpea', 'lentil', 'bean', 'legume', 'dal', 'dahl']):
            return False, False, ''
        notes.append("Remove beans from the recipe.")

    # Peas (snap peas are OK for keto in small amounts — regular peas aren't)
    if has(lo, ['green peas', 'frozen peas', 'english peas'],
            exclude=['snap pea', 'snow pea', 'sugar snap']):
        notes.append("Remove peas.")

    # Honey
    if has(lo, ['honey'], exclude=['allulose', 'keto sweetener', 'sugar-free honey']):
        notes.append("Replace honey with a liquid allulose sweetener.")
    # Sugar / brown sugar / maple syrup / agave
    if has(lo, ['sugar', 'brown sugar', 'coconut sugar', 'palm sugar', 'turbinado',
                'granulated sugar', 'cane sugar'],
            exclude=['sugar snap', 'allulose', 'erythritol', 'stevia', 'monk fruit',
                     'sugar-free']):
        notes.append("Use allulose sugar as a replacement.")
    if has(lo, ['maple syrup'], exclude=['sugar-free maple', 'keto maple']):
        notes.append("Replace maple syrup with a liquid allulose sweetener.")
    if has(lo, ['agave'], exclude=['keto']):
        notes.append("Replace agave with a liquid allulose sweetener.")

    # BBQ sauce / teriyaki / hoisin (added sugar)
    if has(lo, ['bbq sauce', 'barbecue sauce', 'teriyaki sauce', 'hoisin sauce'],
            exclude=['sugar-free', 'keto bbq', 'keto teriyaki']):
        notes.append("Use a sugar-free or keto-friendly version of the sauce.")

    # Panko / breadcrumbs for coating
    if has(lo, ['panko', 'breadcrumb', 'bread crumb'],
            exclude=['gf panko', 'keto panko', 'almond flour']):
        notes.append("Replace breadcrumbs with almond flour.")

    if not notes:
        return True, False, ''

    combined = ' '.join(notes)
    return False, True, combined

# ── LF (Low-FODMAP) Assessment ─────────────────────────────────────────────────
def assess_lf(ings, name):
    lo = ing_lower(ings)
    name_lo = name.lower()
    notes = []

    # Garlic (major trigger)
    has_garlic = has(lo, ['garlic', 'garlic powder'],
                     exclude=['garlic-infused oil', 'garlic infused oil', 'garlic oil'])
    # Onion (major trigger)
    has_onion = has(lo, ['onion', 'shallot', 'leek', 'onion powder'],
                    exclude=['green onion', 'scallion', 'spring onion'])
    # Scallion bulb (white parts)
    has_scallion_white = has(lo, ['scallion', 'green onion', 'spring onion'],
                              exclude=['green tops', 'green part', 'tops only'])

    # Gutting check: garlic or onion in title
    if has_garlic and title_has(name_lo, ['garlic', 'onion', 'shallot', 'leek']):
        return False, False, ''

    # Garlic/onion mods
    oil_tbsp = extract_oil_tbsp(lo)
    if has_garlic and has_onion:
        notes.append(f"Remove garlic and onion and replace {oil_tbsp} tablespoons of the oil with garlic-infused oil. Replace onion with the green tops of scallions.")
    elif has_garlic:
        notes.append(f"Replace garlic and {oil_tbsp} tablespoons of oil with garlic-infused oil.")
    elif has_onion:
        notes.append("Replace onion with the green tops of scallions.")

    if has_scallion_white and not has_garlic and not has_onion:
        notes.append("Use only the dark green tops of the scallions.")

    # Legumes
    has_legumes = has(lo, ['chickpea', 'garbanzo', 'lentil', 'black bean', 'kidney bean',
                            'white bean', 'cannellini', 'navy bean', 'pinto bean',
                            'edamame', 'peanut', 'peanut butter'])
    if has_legumes:
        if any(kw in name_lo for kw in ['chickpea', 'lentil', 'bean', 'hummus', 'dal', 'dahl']):
            return False, False, ''
        notes.append("Remove chickpeas/beans from the recipe.")

    # Cashews / pistachios (high FODMAP nuts)
    if has(lo, ['cashew', 'pistachio'],
           exclude=['cashew milk', 'cashew cream is small']):
        notes.append("Replace cashews with macadamia nuts or omit.")

    # Wheat / flour (most gluten = high FODMAP)
    if has(lo, ['all-purpose flour', 'wheat flour', 'bread', 'pasta', 'couscous', 'barley'],
            exclude=['rice pasta', 'gf pasta', 'gluten-free pasta', 'gf flour', 'rice flour',
                     'almond flour', 'cornstarch']):
        notes.append("Replace pasta or flour with a GF/rice-based alternative.")

    # Soy sauce (contains wheat fructans)
    if has(lo, ['soy sauce'], exclude=['tamari', 'coconut aminos', 'gluten-free soy']):
        notes.append("Replace soy sauce with tamari.")

    # Lactose (soft cheeses, yogurt, regular milk)
    if has(lo, ['greek yogurt', 'yogurt', 'milk', 'sour cream', 'cream cheese'],
            exclude=['coconut milk', 'almond milk', 'oat milk', 'soy milk', 'lactose-free',
                     'dairy-free', 'coconut yogurt', 'coconut cream']):
        notes.append("Replace dairy with lactose-free or dairy-free alternatives.")

    # Mushrooms (most are high FODMAP — oyster mushrooms are OK)
    if has(lo, ['mushroom', 'cremini', 'shiitake', 'portobello', 'button mushroom',
                'wild mushroom', 'porcini'],
            exclude=['oyster mushroom']):
        notes.append("Remove mushrooms or replace with oyster mushrooms.")

    # Asparagus
    if has(lo, ['asparagus'], exclude=[]):
        notes.append("Remove asparagus.")

    # Cauliflower (NOT LF — do not recommend as LF substitute)
    # fennel
    if has(lo, ['fennel'], exclude=['fennel seeds is aip']):
        notes.append("Remove fennel.")
    # Balsamic vinegar
    if has(lo, ['balsamic vinegar', 'balsamic']):
        notes.append("Replace balsamic vinegar with tamari and a splash of broth.")
    # Avocado in large amounts — light use is OK
    # Corn
    if has(lo, ['corn', 'sweet corn', 'corn kernels', 'hominy'],
            exclude=['cornstarch', 'corn oil']):
        notes.append("Remove corn.")
    # Apple / pear / mango / watermelon (high FODMAP fruit)
    if has(lo, ['apple', 'pear', 'mango', 'watermelon'],
            exclude=['apple cider vinegar', 'apple juice is small']):
        notes.append("Limit high-FODMAP fruit to a small serving.")
    # Honey (in excess)
    if has(lo, ['honey'], exclude=['allulose', 'sugar-free']):
        notes.append("Limit honey to 1 tablespoon.")

    if not notes:
        return True, False, ''

    combined = ' '.join(notes)
    return False, True, combined

# ── V (Vegan) Assessment ──────────────────────────────────────────────────────
def assess_v(ings, name):
    lo = ing_lower(ings)
    name_lo = name.lower()
    notes = []

    # Gutting: if meat/fish in title → cannot make vegan
    if title_has(name_lo, MEAT_IN_TITLE):
        return False, False, ''

    # Check for meat in ingredients
    has_meat = has(lo, ['chicken', 'beef', 'pork', 'lamb', 'salmon', 'tuna', 'shrimp',
                         'turkey', 'duck', 'veal', 'steak', 'sausage', 'lobster', 'crab',
                         'scallop', 'cod', 'halibut', 'tilapia', 'mahi', 'bass', 'snapper',
                         'trout', 'ground beef', 'ground turkey', 'ground pork', 'ground lamb',
                         'ground chicken', 'pork belly', 'brisket', 'short rib', 'clam', 'mussel',
                         'squid', 'calamari', 'rotisserie chicken', 'lox', 'prosciutto',
                         'chorizo', 'bacon', 'pancetta', 'salami', 'pepperoni',
                         'ham', 'carnitas', 'oxtail', 'flank steak', 'skirt steak', 'sirloin',
                         'ribeye', 'chuck roast'],
                  exclude=['chicken broth', 'beef broth', 'chicken stock', 'beef stock',
                           'chicken of the woods'])

    # Check for broth
    has_chicken_broth = has(lo, ['chicken broth', 'chicken stock'])
    has_beef_broth = has(lo, ['beef broth', 'beef stock'])

    # If meat is a significant protein component
    if has_meat:
        # Can we swap it? Not if it's the only protein and central to dish
        # Look at recipe name for protein signal
        protein_in_title = title_has(name_lo, MEAT_IN_TITLE)
        if protein_in_title:
            return False, False, ''
        # Meat as background ingredient — can suggest swap
        notes.append("Replace the meat with extra firm tofu or a plant-based protein.")

    # Broth swaps
    if has_chicken_broth or has_beef_broth:
        notes.append("Replace chicken/beef broth with vegetable broth.")

    # Check for dairy (will need swaps for V)
    _, _, df_notes = assess_df(ings, name)
    if df_notes:
        notes.append(df_notes)

    # Eggs — use specific terms to avoid "veggie" / "eggplant" false positives
    if has(lo, [' egg ', ' eggs ', 'egg yolk', 'egg white', 'whole egg', 'large egg',
                'beaten egg', 'egg, ', 'eggs,', '2 eggs', '3 eggs', '4 eggs',
                'one egg', 'two eggs'],
            exclude=['eggplant', 'egg noodle', 'flax egg', 'chia egg', 'egg-free', 'veggie']):
        notes.append("Replace the egg with a flax egg — mix 2 tablespoons ground flaxseed with 1 tablespoon water and let it sit for 5 minutes.")

    # Honey
    if has(lo, ['honey'], exclude=['sugar-free honey', 'allulose honey']):
        notes.append("Replace honey with agave.")

    # Fish sauce
    if has(lo, ['fish sauce'], exclude=['vegan fish sauce', 'soy sauce']):
        notes.append("Replace fish sauce with extra soy sauce.")

    # Anchovy paste / anchovy
    if has(lo, ['anchovy', 'anchovy paste']):
        notes.append("Replace anchovy paste with 1 tablespoon tamari and 1 tablespoon capers with their juice.")

    # Worcestershire
    if has(lo, ['worcestershire'], exclude=['vegan worcestershire']):
        notes.append("Use vegan Worcestershire sauce.")

    # Oyster sauce
    if has(lo, ['oyster sauce'], exclude=['vegan oyster', 'mushroom oyster']):
        notes.append("Replace oyster sauce with a vegan variety.")

    if not notes:
        return True, False, ''

    combined = ' '.join(notes)
    return False, True, combined

# ── Vg (Vegetarian) Assessment ────────────────────────────────────────────────
def assess_vg(ings, name):
    lo = ing_lower(ings)
    name_lo = name.lower()
    notes = []

    # Gutting: if meat/fish in title → cannot make vegetarian
    if title_has(name_lo, MEAT_IN_TITLE):
        return False, False, ''

    # Check for meat (same list as V)
    has_meat = has(lo, ['chicken', 'beef', 'pork', 'lamb', 'salmon', 'tuna', 'shrimp',
                         'turkey', 'duck', 'veal', 'steak', 'sausage', 'lobster', 'crab',
                         'scallop', 'cod', 'halibut', 'tilapia', 'mahi', 'bass', 'snapper',
                         'trout', 'ground beef', 'ground turkey', 'ground pork', 'ground lamb',
                         'ground chicken', 'pork belly', 'brisket', 'short rib', 'clam', 'mussel',
                         'squid', 'calamari', 'rotisserie chicken', 'lox', 'prosciutto',
                         'chorizo', 'bacon', 'pancetta', 'salami', 'pepperoni',
                         'ham', 'carnitas', 'oxtail', 'flank steak', 'skirt steak', 'sirloin',
                         'ribeye', 'chuck roast'],
                  exclude=['chicken broth', 'beef broth', 'chicken stock', 'beef stock',
                           'chicken of the woods'])

    has_chicken_broth = has(lo, ['chicken broth', 'chicken stock'])
    has_beef_broth = has(lo, ['beef broth', 'beef stock'])

    if has_meat:
        if title_has(name_lo, MEAT_IN_TITLE):
            return False, False, ''
        notes.append("Replace the meat with extra firm tofu or a plant-based protein.")

    if has_chicken_broth or has_beef_broth:
        notes.append("Replace chicken/beef broth with vegetable broth.")

    # Fish sauce (Vg disqualifier)
    if has(lo, ['fish sauce'], exclude=['vegan fish sauce', 'coconut aminos']):
        notes.append("Replace fish sauce with soy sauce and a squeeze of lime.")

    # Anchovy
    if has(lo, ['anchovy'], exclude=['vegan']):
        notes.append("Omit anchovies.")

    # Worcestershire
    if has(lo, ['worcestershire'], exclude=['vegan worcestershire']):
        notes.append("Use vegan Worcestershire sauce.")

    if not notes:
        return True, False, ''

    combined = ' '.join(notes)
    return False, True, combined

# ── AIP Assessment ────────────────────────────────────────────────────────────
def assess_aip(ings, name):
    lo = ing_lower(ings)
    name_lo = name.lower()
    notes = []
    gut_count = 0

    # Nightshades (major AIP exclusion)
    if has(lo, ['tomato', 'crushed tomato', 'diced tomato', 'tomato paste', 'tomato sauce',
                'tomato puree', 'cherry tomato', 'sun-dried tomato', 'marinara'],
            exclude=['tomatillo']):
        if 'tomato' in name_lo or 'marinara' in name_lo or 'shakshuka' in name_lo or 'arrabiata' in name_lo:
            return False, False, ''
        notes.append("Remove tomatoes or replace with roasted beets or butternut squash for color.")
        gut_count += 1

    if has(lo, ['bell pepper', 'red pepper', 'yellow pepper', 'orange pepper', 'green pepper',
                'jalapeño', 'jalapeno', 'serrano', 'poblano', 'ancho', 'chipotle',
                'roasted red pepper', 'piquillo'],
            exclude=['black pepper', 'white pepper', 'szechuan pepper']):
        if any(kw in name_lo for kw in ['pepper', 'jalapeño', 'stuffed pepper']):
            return False, False, ''
        notes.append("Remove bell peppers or replace with celery or zucchini.")
        gut_count += 1

    # Paprika / cayenne (seed-based nightshade spice)
    if has(lo, ['paprika', 'smoked paprika', 'sweet paprika', 'cayenne', 'chili powder',
                'chili flake', 'red pepper flake', 'hot sauce', 'gochujang', 'harissa',
                'sriracha', 'chili crisp', 'adobo']):
        notes.append("Remove paprika, cayenne, and any chili-based spices.")
        gut_count += 1

    # Eggplant
    if has(lo, ['eggplant', 'aubergine']):
        if 'eggplant' in name_lo or 'aubergine' in name_lo:
            return False, False, ''
        notes.append("Remove eggplant.")
        gut_count += 1

    # Potatoes (not sweet potatoes — sweet potatoes ARE AIP-approved)
    if has(lo, [' potato', 'potatoes', 'white potato', 'russet potato', 'yukon gold'],
            exclude=['sweet potato', 'yam']):
        notes.append("Remove potatoes.")
        gut_count += 1

    # Grains
    has_grains = has(lo, ['rice', 'white rice', 'brown rice', 'pasta', 'oats', 'quinoa',
                           'couscous', 'barley', 'corn', 'wheat flour', 'all-purpose flour',
                           'orzo', 'noodle', 'bread', 'tortilla'],
                     exclude=['coconut flour', 'cassava flour', 'tigernut', 'arrowroot',
                              'sweet potato flour', 'plantain flour', 'rice paper',
                              'rice vinegar', 'rice wine', 'cauliflower rice', 'zucchini noodle'])
    if has_grains:
        notes.append("Replace grains with AIP-approved alternatives (cassava pasta, zucchini noodles, cauliflower rice).")
        gut_count += 1

    # Legumes
    has_legumes = has(lo, ['chickpea', 'garbanzo', 'lentil', 'black bean', 'kidney bean',
                            'white bean', 'cannellini', 'navy bean', 'pinto bean',
                            'peanut', 'peanut butter', 'edamame', 'tofu', 'tempeh', 'miso',
                            'soy milk', 'soy cream', 'soy yogurt', 'soymilk'],
                      exclude=['coconut aminos', 'soy sauce', 'tamari', 'oyster sauce',
                               'hoisin sauce', 'dark soy', 'mushroom soy', 'soy sauce',
                               'low sodium soy'])
    if has_legumes:
        if any(kw in name_lo for kw in ['chickpea', 'lentil', 'bean', 'dal', 'hummus']):
            return False, False, ''
        notes.append("Remove legumes.")
        gut_count += 1

    # Dairy
    has_dairy = has(lo, ['butter', 'cream', 'milk', 'cheese', 'parmesan', 'mozzarella',
                          'feta', 'ricotta', 'yogurt', 'sour cream', 'ghee'],
                    exclude=['coconut cream', 'coconut milk', 'almond milk', 'oat milk',
                             'peanut butter', 'almond butter', 'cashew butter',
                             'butter lettuce', 'dairy-free', 'vegan', 'nutritional yeast'])
    if has_dairy:
        notes.append("Replace dairy with coconut milk, coconut cream, or coconut oil.")
        gut_count += 1

    # Eggs
    if has(lo, ['egg', 'egg yolk', 'egg white', 'large egg', 'whole egg'],
            exclude=['eggplant', 'flax egg', 'egg-free']):
        notes.append("Remove eggs.")
        gut_count += 1

    # Nuts and seeds
    has_nuts = has(lo, ['almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'macadamia',
                         'hazelnut', 'brazil nut', 'sunflower seed', 'pumpkin seed', 'pepitas',
                         'sesame seed', 'sesame oil', 'tahini', 'hemp seed', 'flaxseed',
                         'chia seed', 'poppy seed', 'pine nut'])
    if has_nuts:
        notes.append("Remove nuts and seeds.")
        gut_count += 1

    # Seed-based spices
    has_seed_spices = has(lo, ['cumin', 'coriander', 'fennel seed', 'mustard', 'black pepper',
                                'white pepper', 'cardamom', 'anise', 'star anise', 'nutmeg',
                                'celery seed', 'sumac', 'za\'atar', 'curry powder', 'garam masala',
                                '7 spice', 'taco seasoning', 'italian seasoning',
                                'caraway', 'fenugreek'])
    if has_seed_spices:
        notes.append("Remove all seed-based spices (cumin, coriander, black pepper, mustard, etc.).")
        gut_count += 1

    # Soy sauce / tamari (fermented, AIP-excluded)
    if has(lo, ['soy sauce', 'tamari'], exclude=['coconut aminos']):
        notes.append("Replace soy sauce or tamari with coconut aminos.")
        # Not a gut violation since coconut aminos is a direct swap

    # Vinegar (fermented, AIP-excluded)
    if has(lo, ['vinegar'], exclude=['apple cider vinegar', 'coconut vinegar', 'white distilled vinegar']):
        notes.append("Replace wine-based vinegar with fresh lemon or lime juice, or apple cider vinegar.")

    # Alcohol
    if has(lo, ['wine', 'beer', 'bourbon', 'whiskey', 'rum', 'vodka', 'sake', 'mirin'],
            exclude=['rice wine vinegar', 'wine vinegar', 'root beer']):
        notes.append("Replace wine or alcohol with chicken broth or apple juice.")

    # Corn starch (AIP uses arrowroot instead)
    if has(lo, ['cornstarch', 'corn starch'], exclude=['arrowroot', 'tapioca']):
        notes.append("Replace cornstarch with arrowroot powder.")

    # Chocolate / cocoa
    if has(lo, ['chocolate', 'cocoa', 'cacao'], exclude=['carob']):
        return False, False, ''

    # Too many gut violations → skip
    if gut_count >= 4:
        return False, False, ''

    if not notes:
        return True, False, ''

    combined = ' '.join(notes)
    return False, True, combined

# ── LH (Low-Histamine) Assessment ─────────────────────────────────────────────
def assess_lh(ings, name):
    lo = ing_lower(ings)
    name_lo = name.lower()
    notes = []
    gut_count = 0

    # Fermented / high-histamine vinegars
    if has(lo, ['balsamic vinegar', 'balsamic', 'red wine vinegar', 'white wine vinegar',
                'champagne vinegar', 'sherry vinegar', 'malt vinegar'],
            exclude=['apple cider vinegar', 'white distilled vinegar', 'coconut vinegar',
                     'rice vinegar', 'unseasoned rice vinegar']):
        notes.append("Replace wine-based vinegar with lime juice or apple cider vinegar.")
        gut_count += 1

    # Soy sauce / tamari / miso (fermented)
    if has(lo, ['soy sauce', 'tamari', 'miso'], exclude=['coconut aminos']):
        notes.append("Replace soy sauce or miso with coconut aminos.")
        gut_count += 1

    # Fish sauce (fermented)
    if has(lo, ['fish sauce']):
        notes.append("Remove fish sauce.")
        gut_count += 1

    # Aged / cured meats (smoked paprika is handled separately under seed spices)
    if has(lo, ['bacon', 'prosciutto', 'salami', 'pepperoni', 'pancetta', 'chorizo',
                'mortadella', 'cured ham', 'lox', 'smoked salmon', 'smoked fish',
                'smoked turkey'],
            exclude=['smoked paprika']):
        if any(kw in name_lo for kw in ['bacon', 'prosciutto', 'salami', 'lox', 'smoked salmon']):
            return False, False, ''
        notes.append("Remove smoked or cured meats.")
        gut_count += 1

    # Aged cheeses (parmesan, gouda, cheddar, blue, gruyère are high-histamine)
    if has(lo, ['parmesan', 'parmigiano', 'pecorino', 'aged cheddar', 'gruyère', 'gruyere',
                'gouda', 'blue cheese', 'gorgonzola', 'aged goat cheese', 'aged cheese'],
            exclude=['fresh mozzarella', 'fresh ricotta', 'fresh goat cheese', 'cream cheese',
                     'mascarpone']):
        notes.append("Replace aged cheese with a fresh alternative or dairy-free option.")
        gut_count += 1

    # Canned tomatoes / tomato paste (concentrated = high histamine)
    if has(lo, ['canned tomato', 'crushed tomato', 'diced tomato in can', 'tomato paste',
                'tomato sauce', 'tomato puree', 'marinara', 'passata', 'sun-dried tomato'],
            exclude=['fresh tomato', 'cherry tomato', 'grape tomato']):
        notes.append("Sub canned tomatoes with fresh tomatoes.")
        gut_count += 1

    # Alcohol
    if has(lo, ['wine', 'beer', 'bourbon', 'whiskey', 'rum', 'vodka', 'sake', 'mirin'],
            exclude=['rice wine vinegar', 'wine vinegar', 'root beer']):
        notes.append("Replace wine with chicken broth.")
        gut_count += 1

    # Onion and garlic (histamine liberators — NOT substitutable with garlic oil for LH)
    if has(lo, ['onion', 'garlic', 'garlic powder', 'onion powder', 'shallot', 'leek'],
            exclude=['green onion tops', 'scallion green']):
        if any(kw in name_lo for kw in ['garlic', 'onion', 'shallot', 'french onion']):
            return False, False, ''
        notes.append("Omit garlic and onion entirely.")
        gut_count += 1

    # Spinach (high histamine at scale)
    if has(lo, ['spinach'], exclude=['baby spinach in small amount']):
        notes.append("Remove spinach or use a small amount of fresh spinach.")

    # Avocado (histamine liberator)
    if has(lo, ['avocado'], exclude=['avocado oil']):
        notes.append("Remove avocado. Add more cucumber to replace it.")

    # Eggplant (histamine)
    if has(lo, ['eggplant', 'aubergine']):
        if 'eggplant' in name_lo:
            return False, False, ''
        notes.append("Remove eggplant.")

    # Mushrooms (histamine at scale)
    if has(lo, ['mushroom', 'cremini', 'shiitake', 'portobello', 'button mushroom',
                'porcini'], exclude=['oyster mushroom']):
        notes.append("Remove mushrooms.")

    # Seed spices (LH also excludes these)
    if has(lo, ['cumin', 'smoked paprika', 'paprika', 'cayenne', 'chili powder',
                'chili flake', 'black pepper', 'white pepper', 'coriander', 'fennel seed',
                'mustard', 'cardamom', 'nutmeg', 'sumac', 'sriracha', 'hot sauce']):
        notes.append("Remove smoked paprika, cumin, black pepper, and other seed-based spices.")

    # Chocolate / cocoa
    if has(lo, ['chocolate', 'cocoa', 'cacao']):
        return False, False, ''

    # Walnuts / cashews / peanuts (histamine liberators)
    if has(lo, ['walnut', 'cashew', 'peanut', 'peanut butter'],
            exclude=['cashew milk']):
        notes.append("Remove walnuts, cashews, or peanuts.")

    # Sesame oil (histamine liberator)
    if has(lo, ['sesame oil'], exclude=['toasted sesame']):
        notes.append("Remove sesame oil.")

    # Canola oil
    if has(lo, ['canola oil', 'vegetable oil', 'rapeseed oil']):
        notes.append("Replace canola oil with olive oil.")

    # Too many high-histamine core components → skip
    if gut_count >= 4:
        return False, False, ''

    if not notes:
        return True, False, ''

    combined = ' '.join(notes)
    return False, True, combined

# ── Main audit loop ───────────────────────────────────────────────────────────
def audit_recipe(r):
    """Run all 8 diet assessments on a recipe. Returns new dietTags dict."""
    name = r['name']
    url  = r.get('url', '')

    ings = find_ingredients(name, url)
    if not ings:
        return None, False  # no ingredient data available

    assessors = {
        'GF':  assess_gf,
        'DF':  assess_df,
        'K':   assess_k,
        'LF':  assess_lf,
        'V':   assess_v,
        'Vg':  assess_vg,
        'AIP': assess_aip,
        'LH':  assess_lh,
    }

    new_tags = {}
    for tag, fn in assessors.items():
        native, mod, notes = fn(ings, name)
        if native or mod:
            new_tags[tag] = {
                'native': native,
                'mod': mod,
                'notes': notes if mod else '',
            }

    return new_tags, True

# ── Compare old vs new tags ───────────────────────────────────────────────────
def tags_differ(old, new):
    """Return True if the computed tags are meaningfully different from existing."""
    if set(old.keys()) != set(new.keys()):
        return True
    for tag in new:
        if tag not in old:
            return True
        o = old[tag]
        n = new[tag]
        if o.get('native') != n.get('native'):
            return True
        if o.get('mod') != n.get('mod'):
            return True
        # Notes difference — only flag if mod status changed
        if n.get('mod') and (o.get('notes', '').strip() != n.get('notes', '').strip()):
            return True
    return False

# ── Entry point ───────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true',
                        help='Print proposed changes without writing to Firebase')
    parser.add_argument('--skip-photos', action='store_true',
                        help='Skip scraping og:image for missing photos')
    parser.add_argument('--skip-scrape', action='store_true',
                        help='Skip scraping ingredients for recipes with no data')
    args = parser.parse_args()

    db = None
    if not args.dry_run:
        print("Connecting to Firebase...")
        db = init_firebase()

    # ── Step 1: Scrape missing ingredients ───────────────────────────────────
    missing_ings = [r for r in yes_recipes if not find_ingredients(r['name'], r.get('url',''))]
    print(f"\nRecipes with no ingredient data: {len(missing_ings)}")

    if missing_ings and not args.skip_scrape:
        print("Scraping missing ingredients...")
        scraped_count = 0
        for i, r in enumerate(missing_ings):
            print(f"  [{i+1}/{len(missing_ings)}] {r['name'][:55]}", end='', flush=True)
            ings = scrape_ingredients(r.get('url',''))
            if ings:
                ing_db[r['name']] = ings
                scraped_count += 1
                print(f" ({len(ings)} ingredients)")
            else:
                ing_db[r['name']] = []
                print(" — no data")
            time.sleep(SLEEP_SEC)

        # Save updated ingredients.json
        with open(INGREDIENTS_FILE, 'w') as f:
            json.dump(ing_db, f, indent=2)
        print(f"Scraped {scraped_count}/{len(missing_ings)} missing recipes. Updated ingredients.json.")

    # ── Step 2: Run diet audit ────────────────────────────────────────────────
    print(f"\nAuditing diet tags for {len(yes_recipes)} recipes...")
    proposed_changes = []
    stats = {
        'unchanged': 0, 'changed': 0, 'no_data': 0,
        'GF': 0, 'DF': 0, 'K': 0, 'LF': 0, 'V': 0, 'Vg': 0, 'AIP': 0, 'LH': 0
    }

    for i, r in enumerate(yes_recipes):
        new_tags, has_data = audit_recipe(r)
        if not has_data:
            stats['no_data'] += 1
            continue

        old_tags = r.get('dietTags', {})
        if not tags_differ(old_tags, new_tags):
            stats['unchanged'] += 1
            continue

        # Track per-diet changes
        for tag in new_tags:
            if tag not in old_tags or old_tags[tag] != new_tags[tag]:
                if tag in stats:
                    stats[tag] += 1

        proposed_changes.append({
            'id': r['id'],
            'name': r['name'],
            'url': r.get('url', ''),
            'old_tags': old_tags,
            'new_tags': new_tags,
        })
        stats['changed'] += 1

        if (i + 1) % 50 == 0:
            print(f"  {i+1}/{len(yes_recipes)} audited — {stats['changed']} changes so far")

    print(f"\nAudit complete:")
    print(f"  Unchanged:    {stats['unchanged']}")
    print(f"  Changed:      {stats['changed']}")
    print(f"  No data:      {stats['no_data']}")
    print(f"\n  Tags added/changed:")
    for tag in ['GF','DF','K','LF','V','Vg','AIP','LH']:
        print(f"    {tag}: {stats[tag]}")

    with open(PROPOSED_FILE, 'w') as f:
        json.dump(proposed_changes, f, indent=2)
    print(f"\nSaved {len(proposed_changes)} changes to {PROPOSED_FILE}")

    # ── Step 3: Scrape og:image for missing photos ────────────────────────────
    photo_updates = []
    if not args.skip_photos:
        print(f"\nScraping photos for {len(yes_recipes)} recipes...")
        for i, r in enumerate(yes_recipes):
            url = r.get('url', '')
            if not url:
                continue
            img = scrape_og_image(url)
            if img:
                photo_updates.append({'id': r['id'], 'name': r['name'], 'image': img})
            if (i + 1) % 50 == 0:
                print(f"  {i+1}/{len(yes_recipes)} photos scraped — {len(photo_updates)} found")
            time.sleep(SLEEP_SEC)

        print(f"Found photos for {len(photo_updates)}/{len(yes_recipes)} recipes")
        with open('photo_updates.json', 'w') as f:
            json.dump(photo_updates, f, indent=2)
        print("Saved photo_updates.json")

    # ── Step 4: Apply to Firebase ──────────────────────────────────────────────
    if args.dry_run:
        print("\nDry run complete — no changes written to Firebase.")
        print(f"Review {PROPOSED_FILE} to see proposed diet tag changes.")
        return

    print(f"\nApplying {len(proposed_changes)} diet tag changes to Firebase...")
    diet_applied = 0
    for change in proposed_changes:
        try:
            db.collection('decisions').document(change['id']).update({
                'dietTags': change['new_tags']
            })
            diet_applied += 1
            if diet_applied % 25 == 0:
                print(f"  {diet_applied}/{len(proposed_changes)} updated")
        except Exception as e:
            print(f"  ERROR on {change['name']}: {e}")

    print(f"Diet tags updated: {diet_applied}/{len(proposed_changes)}")

    if photo_updates:
        print(f"\nApplying {len(photo_updates)} photo URLs to Firebase...")
        photos_applied = 0
        for pu in photo_updates:
            try:
                db.collection('decisions').document(pu['id']).update({
                    'image': pu['image']
                })
                photos_applied += 1
                if photos_applied % 50 == 0:
                    print(f"  {photos_applied}/{len(photo_updates)} photos updated")
            except Exception as e:
                print(f"  ERROR on {pu['name']}: {e}")
        print(f"Photos updated: {photos_applied}/{len(photo_updates)}")

    print("\nAll done.")

if __name__ == '__main__':
    main()
