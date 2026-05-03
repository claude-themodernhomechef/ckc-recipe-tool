#!/usr/bin/env python3
"""
patch_nutrition_db.py
=====================
Resolves unresolved ingredients by:
  1. Removing bad FDC entries from previous runs
  2. Deleting non-food items (equipment, vague terms)
  3. Mapping duplicate/variant names to already-resolved entries
  4. Fetching Rafi-confirmed FDC IDs directly

Run after build_nutrition_db.py. Safe to re-run.
"""

import json, os, re, sys, time
import requests

BASE      = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(BASE)
OUTPUT_JSON  = os.path.join(REPO_ROOT, 'ingredientNutrition.json')
MASTER_JSON  = os.path.join(REPO_ROOT, 'ingredient_master_list.json')

env_path = os.path.join(BASE, 'functions', '.env')
env_text = open(env_path).read() if os.path.exists(env_path) else ''
usda_key = os.environ.get('USDA_API_KEY', '')
if not usda_key:
    m = re.search(r'USDA_API_KEY=(.+)', env_text)
    if m: usda_key = m.group(1).strip()
if not usda_key:
    print('ERROR: USDA_API_KEY not found'); sys.exit(1)

USDA_BASE   = 'https://api.nal.usda.gov/fdc/v1'
CALORIE_IDS = {1008, 2047, 1062}
NUTRIENT_IDS = {
    1008:'calories',1003:'protein',1004:'fat',1005:'carbs',1079:'fiber',
    1093:'sodium',1092:'potassium',1087:'calcium',1089:'iron',1090:'magnesium',
    1162:'vitamin_c',1106:'vitamin_a',1109:'vitamin_e',1114:'vitamin_d',
    1185:'vitamin_k',1165:'vitamin_b1',1166:'vitamin_b2',1167:'vitamin_b3',
    1175:'vitamin_b6',1177:'folate',1178:'vitamin_b12',1253:'cholesterol',
    1258:'saturated_fat',1292:'monounsaturated_fat',1293:'polyunsaturated_fat',
}

# ── BAD ENTRIES — wrong FDC IDs fetched in a previous run ─────────────────────
# Remove these so they get re-patched with correct proxies below
BAD_ENTRIES = {
    'lemongrass',        # pulled turmeric (wrong) → now proxy to ginger ✓
    'kasuri methi',      # pulled cream (wrong) → now proxy to cumin ✓
    'sambal oelek',      # pulled chicken enchilada (wrong) → now correct FDC ✓
    'microgreens',       # pulled pine nuts (wrong) → now proxy to spinach ✓
    'lard',              # pulled salted butter (wrong) → now correct FDC ✓
    'dried barberries',  # pulled spinach (wrong) → now correct FDC ✓
    'five spice powder', # pulled paprika (wrong) → now correct FDC ✓
    # Fix wrong proxy entries
    'hanger steak',        # was mapped to ground beef → now correct FDC ✓
    'rendered lard',       # was mapped to unsalted butter → now correct FDC ✓
    'lard',                # was mapped to unsalted butter → now correct FDC ✓
    'tajin',               # was mapped to chili powder → now correct FDC 1862081 ✓
    # barberries not in USDA — stays as cranberry proxy via MAP (no BAD_ENTRY needed)
    'dried pasta',         # was mapped to white rice → now correct FDC ✓
    'liguine',             # was mapped to white rice → now correct FDC ✓
    'sambal olek',         # was mapped to red pepper flakes → now correct FDC ✓
    'sambal oelak',        # was mapped to red pepper flakes → now correct FDC ✓
    # Five spice entries with 0-calorie branded FDC → re-map to cinnamon proxy
    'chinese five spice',
    'five-spice powder',
    'asian five spice',
    'chinese five-spice',
    'chinese 5 spice',
    'five spice powder',
}

# ── DELETE — non-food, equipment, too vague, compound recipes ─────────────────
DELETE = {
    'skewers', 'metal skewers', 'metal skewer', 'bamboo skewer', 'bamboo skewers',
    'cedar planks', 'charcoal', 'ice',
    'seasoning', 'seasonings', 'protein', 'grains', 'grain', 'veggies',
    'seasonal vegetables', 'hard herbs', 'hardy herbs', 'tender herbs', 'soft herbs',
    'leafy herbs', 'cooked grains', 'toasted bread', 'grilled bread', 'boiled rice',
    'cooked chicken breasts', 'cooked noodles', 'shredded birria',
    "sautéed mushrooms", 'creamy corn slaw', 'bbq dry rub', 'tuscan marry me blend',
    'moroccan spice blend', "za'atar vinaigrette", 'fried garlic chicken ramen soup',
    'bagged salad', 'tzakiki sauce', 'toum', 'pizza dough', 'red food coloring',
    'meat drippings', 'chili threads', 'coco bread',
}

# ── MAP — variant/duplicate names → canonical resolved name ───────────────────
MAP = {
    # Za'atar variants
    'zaatar':                   "za'atar",
    "za'atar seasoning":        "za'atar",
    'zaatar spice':             "za'atar",
    "za'atar spice":            "za'atar",

    # Italian seasoning variants
    'italian seasoning blend':  'italian seasoning',
    'dried italian seasoning':  'italian seasoning',
    'dried italian herbs':      'italian seasoning',
    'italian blend herbs':      'italian seasoning',
    'italian herb blend':       'italian seasoning',
    'italian seasonings':       'italian seasoning',
    'herbes de provence':       'italian seasoning',
    'herbs de provence':        'italian seasoning',
    'seafood seasoning':        'italian seasoning',
    'tuscan seasoning':         'italian seasoning',

    # Sambal variants → handled by NEW_FDC (direct fetch)
    # Doubanjiang → sambal oelek (fermented chili bean paste, same base)
    'doubanjiang':              'sambal oelek',
    'chili garlic paste':       'sambal oelek',
    'chili paste with garlic':  'sambal oelek',

    # Five spice variants → cinnamon (USDA has no five spice entry; used in ¼ tsp amounts)
    'five spice powder':        'cinnamon',
    'five-spice powder':        'cinnamon',
    '5-spice':                  'cinnamon',
    'asian five spice':         'cinnamon',
    'chinese five spice':       'cinnamon',
    'chinese five-spice':       'cinnamon',
    'chinese 5 spice':          'cinnamon',

    # Chili flake variants → red pepper flakes
    'pepper flakes':            'red pepper flakes',
    'dried chilli flakes':      'red pepper flakes',
    'dried chili flakes':       'red pepper flakes',
    'crushed pepper flakes':    'red pepper flakes',
    'crushed red chili flakes': 'red pepper flakes',
    'chinese chili flakes':     'red pepper flakes',
    'urfa biber':               'red pepper flakes',
    'togarashi':                'red pepper flakes',
    'shichimi togarashi':       'red pepper flakes',
    'japanese togarashi pepper':'red pepper flakes',
    'japanese 7 spice powder':  'red pepper flakes',
    'chilli':                   'red pepper flakes',

    # Chile powder variants → chili powder
    'chile powder':             'chili powder',
    'chipotle pepper flakes':   'chipotle powder',
    'chipotle paste':           'chipotle powder',
    'adobo seasoning':          'chili powder',
    'creole seasoning':         'chili powder',
    'all-purpose seasoning':    'chili powder',
    'berbere':                  'chili powder',
    # tajin → handled by NEW_FDC (direct fetch)

    # Aleppo variants → aleppo pepper
    'aleppo chilli':            'aleppo pepper',
    'aleppo chilli flakes':     'aleppo pepper',
    'aleppo pepper flakes':     'aleppo pepper',

    # Cumin-forward spice blends → cumin
    'ras el hanout':            'cumin',
    'ras-el-hanout':            'cumin',
    'baharat':                  'cumin',
    'shawarma seasoning':       'cumin',
    'moroccan spice':           'cumin',
    'shahi jeera':              'cumin',
    'jamaican green seasoning': 'cumin',

    # Sesame-based blends → sesame seeds
    'dukkah':                   'sesame seeds',

    # Sichuan / Szechuan → black pepper
    'sichuan peppercorns':      'black pepper',
    'szechuan peppercorns':     'black pepper',
    'ground pepper':            'black pepper',

    # Salt variants → salt
    'kala namak':               'salt',
    'msg':                      'salt',

    # Lemongrass variants → ginger (aromatic root proxy)
    'lemongrass':               'ginger',
    'lemongrass stalks':        'ginger',
    'fresh lemongrass':         'ginger',

    # Kasuri methi variants → cumin (dried spice proxy)
    'kasuri methi':             'cumin',
    'kasoori methi':            'cumin',
    'fenugreek leaves':         'cumin',

    # Microgreens → spinach
    'microgreens':              'spinach',
    'micro greens':             'spinach',

    # lard → handled by NEW_FDC (direct fetch)

    # Dried barberries → cranberries (tart dried berry proxy)
    'dried barberries':         'cranberries',
    'barberries':               'cranberries',

    # Lime leaves → bay leaf (aromatic leaf proxy)
    'kaffir lime leaves':       'bay leaf',
    'makrut lime leaves':       'bay leaf',
    'lime leaves':              'bay leaf',
    'curry leaves':             'bay leaf',

    # Fresh herb variants → resolved base herb
    'fresh mint leaves':        'fresh mint',
    'fresh oregano':            'oregano',
    'fresh sage':               'sage',
    'dill leaves':              'fresh dill',
    'rosemary leaves':          'fresh rosemary',
    'thai basil leaves':        'thai basil',
    'holy basil leaves':        'thai basil',
    'fresh tarragon':           'tarragon',
    'carrot tops':              'carrots',
    'fennel frond':             'fennel',
    'garlic scapes':            'garlic',

    # Cinnamon variants
    'cinnamon sticks':          'cinnamon',
    'cinnamon powder':          'cinnamon',
    'mexican cinnamon stick':   'cinnamon',

    # Tomato variants
    'beefsteak tomatoes':       'tomatoes',
    'fire-roasted tomato':      'tomatoes',
    'fire roasted tomato':      'tomatoes',

    # Chili pepper variants → jalapeño
    'scotch bonnet chilli':     'jalapeño',
    'scotch bonnet pepper':     'jalapeño',
    'thai chilies':             'jalapeño',
    'thai chili':               'jalapeño',
    'thai bird chilies':        'jalapeño',
    "bird's-eye chilies":       'jalapeño',
    'ají amarillo chiles':      'jalapeño',
    'pickled jalapeno':         'jalapeño',

    # British/international names → US resolved names
    'rocket':                   'arugula',
    'aubergine':                'eggplant',
    'courgette':                'zucchini',
    'beansprouts':              'bean sprouts',
    'beansprout':               'bean sprouts',
    'sweetcorn':                'corn',
    'mangetout':                'snow peas',
    'cavolo nero':              'kale',
    'butterbean':               'white beans',
    'king edward potato':       'potato',
    'salad leaves':             'mixed greens',

    # Condiments
    'dijon':                    'dijon mustard',
    'kewpie':                   'mayonnaise',
    'hing':                     'garlic powder',
    'asafetida':                'garlic powder',

    # Starch (dried pasta + liguine handled by NEW_FDC)

    # Meat (hanger steak + lard handled by NEW_FDC)
    'lamb stew meat':           'lamb shoulder',
    'bone-in chicken':          'chicken thighs',
    'lardons':                  'bacon',

    # Seafood
    'salmon paste':             'salmon',
    'seaweed':                  'nori',

    # Produce
    'barberries':               'cranberries',      # not in USDA; tart dried berry, cranberry is closest proxy
    'dried barberries':         'cranberries',
    'green apple':              'apple',
    'mixed citrus':             'orange',

    # Dairy/cheese
    'stracciatella cheese':     'fresh mozzarella',
    'vegan cream':              'coconut cream',
    'cheddar and mozzarella mix': 'cheddar cheese',

    # Brine
    'pickle brine':             'distilled vinegar',
    'pickled jalapeño juice':   'distilled vinegar',

    # Bread
    'pav':                      'dinner rolls',

    # Alcohol → white wine proxy
    'dry vermouth':             'white wine',
    'vermouth':                 'white wine',
    'bourbon':                  'white wine',
    'brandy':                   'white wine',

    # Tea
    'tea leaves':               'black tea',

    # Misc
    'roasted bell peppers':     'bell pepper',
    'cilantro crema':           'sour cream',
    'garlic herb butter':       'unsalted butter',
    'sour orange juice':        'orange juice',
    'sumac spice':              'sumac',
    'ground sumac':             'sumac',
    'kewpie':                   'mayonnaise',
}

# ── FETCH — Rafi-confirmed FDC IDs ────────────────────────────────────────────
NEW_FDC = {
    'everything but the bagel seasoning': 2152623,
    'peppercinis':                        1949319,
    'pepperoncini':                       1949319,
    # Rafi-confirmed correct FDC IDs (replacing wrong proxy mappings)
    # Note: five spice not in USDA SR Legacy — using cinnamon as spice blend proxy (used in ¼ tsp amounts)
    'sambal oelek':         2032351,
    'sambal olek':          2032351,
    'sambal oelak':         2032351,
    'lard':                 2116466,
    'rendered lard':        2116466,
    'hanger steak':         1458194,
    'tajin':                1862081,  # TAJIN, CLASICO SEASONING, LIME — 200 kcal ✓
    # barberries: not in USDA — mapped to cranberries proxy in MAP below
    'dried pasta':          169736,
    'liguine':              169736,
    'pasta':                169736,
}

# ── Helpers ───────────────────────────────────────────────────────────────────
def get_food_detail(fdc_id):
    try:
        resp = requests.get(f'{USDA_BASE}/food/{fdc_id}', params={'api_key': usda_key}, timeout=10)
        return resp.json() if resp.status_code == 200 else {}
    except: return {}

def extract_nutrients(food_nutrients):
    result = {}
    for n in food_nutrients:
        nid = n.get('nutrientId') or n.get('nutrient', {}).get('id')
        val = n.get('value')
        if val is None: val = n.get('amount')
        if val is None: continue
        if nid in CALORIE_IDS and 'calories' not in result:
            result['calories'] = round(float(val), 2)
        elif nid in NUTRIENT_IDS:
            result[NUTRIENT_IDS[nid]] = round(float(val), 2)
    return result

def extract_portions(food_detail):
    portions = []
    for p in food_detail.get('foodPortions', []):
        unit = p.get('measureUnit', {}).get('name') or p.get('modifier') or p.get('portionDescription', '')
        gram_weight = p.get('gramWeight', 0)
        amount = p.get('amount', 1)
        if unit and gram_weight:
            portions.append({'unit': unit.strip().lower(), 'amount': amount, 'gramWeight': round(gram_weight, 2)})
    return portions

# ── Load data ─────────────────────────────────────────────────────────────────
with open(OUTPUT_JSON) as f:
    db = json.load(f)
with open(MASTER_JSON) as f:
    all_ingredients = json.load(f)

print(f'Loaded DB: {len(db)} resolved entries')

# ── Step 1: Remove bad entries ─────────────────────────────────────────────────
removed = 0
for bad in BAD_ENTRIES:
    if bad in db:
        del db[bad]
        removed += 1
        print(f'  REMOVED bad entry: {bad}')
if removed:
    print(f'  Removed {removed} bad entries')

# ── Step 2: Process unresolved ────────────────────────────────────────────────
resolved = set(db.keys())
unresolved = [item['name'] for item in all_ingredients if item['name'] not in resolved]
print(f'Unresolved before patch: {len(unresolved)}')

deleted = mapped = fetched = 0
still_unresolved = []

for name in unresolved:
    name_lower = name.lower()

    # Delete non-food
    if name_lower in DELETE or name in DELETE:
        db[name] = {'fdcId': None, 'description': f'[DELETED] {name}', 'tier': 'Deleted', 'confidence': 'n/a', 'per100g': {}, 'portions': []}
        deleted += 1
        continue

    # Fetch confirmed FDC ID FIRST (takes priority over proxy MAP)
    fdc_id = NEW_FDC.get(name_lower) or NEW_FDC.get(name)
    if fdc_id:
        detail = get_food_detail(fdc_id)
        time.sleep(0.15)
        if detail:
            nutrients = extract_nutrients(detail.get('foodNutrients', []))
            portions = extract_portions(detail)
            db[name] = {'fdcId': fdc_id, 'description': detail.get('description', name),
                        'tier': 'Manual Override', 'confidence': 'high',
                        'per100g': nutrients, 'portions': portions}
            cal = nutrients.get('calories', '?')
            print(f'  FETCH: {name} → {detail.get("description")} | {cal} kcal')
            fetched += 1
            continue

    # Map to existing resolved entry (proxy, runs after confirmed FDC IDs)
    target = MAP.get(name_lower) or MAP.get(name)
    if target:
        if target in db:
            entry = dict(db[target])
            entry['_mapped_from'] = target
            db[name] = entry
            mapped += 1
            print(f'  MAP: {name} → {target}')
            continue
        else:
            print(f'  ⚠ MAP target not in DB: {name} → {target}')

    still_unresolved.append(name)

# Save
with open(OUTPUT_JSON, 'w') as f:
    json.dump(db, f, indent=2)

print(f'\n── Patch Summary ─────────────────────────────────────')
print(f'  Removed bad entries:    {removed}')
print(f'  Deleted (non-food):     {deleted}')
print(f'  Mapped (duplicates):    {mapped}')
print(f'  Fetched (new FDC IDs):  {fetched}')
print(f'  Still unresolved:       {len(still_unresolved)}')
print(f'  Total in DB now:        {len(db)}')
if still_unresolved:
    print(f'\nStill unresolved:')
    for n in still_unresolved:
        print(f'  - {n}')
print(f'\nSaved to ingredientNutrition.json')
