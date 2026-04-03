"""
crossref_diet_products2.py
───────────────────────────
For each uncertain diet flag:
  1. Uses Claude (Haiku, cached system prompt) to extract the exact problematic ingredient
  2. Searches all 329k FIG products by name for that ingredient
  3. Checks protocol compliance

Rules:
  - compliant found  → mod confirmed
  - caution only     → grey area (noted)
  - not_compliant    → mod not possible
  - nothing found    → not in FIG DB
  - identity-destroying list → mod: false, skip search

Keto: sugar_free + paleo both compliant = compliant
Caution = not compliant (noted separately)

Usage:
  python3 crossref_diet_products2.py
  python3 crossref_diet_products2.py --reset
"""

import json, os, re, time, sys
import anthropic
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE          = os.path.dirname(os.path.abspath(__file__))
UNCERT_FILE   = os.path.join(BASE, 'diet_uncertainty_report.json')
PRODUCTS_FILE = '/Users/rafi/Desktop/Claude-MHC/Fig Scraper/ckc_products_cleaned_2026-03-29.json'
PROGRESS_FILE = os.path.join(BASE, 'crossref_progress.json')
OUT_FILE      = os.path.join(BASE, 'diet_product_crossref_report.json')

# ── API key from functions/.env ────────────────────────────────────────────────
env_text = open(os.path.join(BASE, 'functions', '.env')).read()
api_key  = re.search(r'ANTHROPIC_API_KEY=(.+)', env_text).group(1).strip()
client   = anthropic.Anthropic(api_key=api_key)

RESET       = '--reset' in sys.argv
CONCURRENCY = 5

# ── Protocol → FIG field ───────────────────────────────────────────────────────
PROTO_FIELD = {
    'AIP': 'aip_friendly',
    'LF':  'low_fodmap',
    'GF':  'gluten_free',
    'DF':  'dairy_free',
    'Vg':  'vegan',
    'V':   'vegetarian',
    'LH':  'low_histamine',
    'K':   None,
}

# ── Identity-destroying ────────────────────────────────────────────────────────
IDENTITY_DESTROYING = {
    ('K',  'Crispy Falafel Recipe'),
    ('K',  'Mediterranean Lentil Salad'),
    ('LF', 'Peanut Butter Chicken'),
    ('LH', 'Guacamole'),
    ('LH', 'Mango Pico de Gallo'),
    ('LF', 'Double the Mushrooms Chicken Marsala'),
    ('LH', 'Salmon Puttanesca'),
    ('LH', 'Castelvetrano Olive Chicken Skillet'),
    ('LH', 'Creamy Refried Beans'),
    ('K',  'Lightened Sweet Potato Casserole Pecan Oat Streusel'),
    ('LH', 'Fettuccine with Smoked Salmon and Dill Cream Sauce'),
    ('LH', 'Miso Glazed Salmon Bowls'),
    ('LH', 'Tomato Aguachile'),
}

# ── Progress ───────────────────────────────────────────────────────────────────
save_lock = Lock()

def load_progress():
    if not RESET and os.path.exists(PROGRESS_FILE):
        return json.load(open(PROGRESS_FILE))
    return {'results': []}

def save_progress(progress):
    with save_lock:
        json.dump(progress, open(PROGRESS_FILE, 'w'), indent=2)

# ── Product compliance ─────────────────────────────────────────────────────────
def get_compliance(product, protocol):
    if protocol == 'K':
        sf = product.get('sugar_free', 'unknown')
        pa = product.get('paleo',      'unknown')
        if sf == 'compliant' and pa == 'compliant':   return 'compliant'
        if sf == 'not_compliant' or pa == 'not_compliant': return 'not_compliant'
        return 'caution'
    field = PROTO_FIELD.get(protocol)
    return product.get(field, 'unknown') if field else 'unknown'

def search_products(ingredient, protocol, products):
    q = ingredient.lower().strip()
    results = {'compliant': [], 'caution': [], 'not_compliant': []}
    for p in products:
        if q in p['name'].lower():
            status = get_compliance(p, protocol)
            if status in results:
                results[status].append({'name': p['name'], 'brand': p.get('brand', '')})
    return results

# ── Claude: extract ingredient ─────────────────────────────────────────────────
SYSTEM_PROMPT = """You extract the single most specific problematic ingredient name from a diet compliance uncertainty note.
Return ONLY the ingredient name — 1 to 4 words, lowercase, no punctuation, no explanation.
Examples: "garam masala", "mirin", "taco seasoning", "gochujang", "feta", "scallion", "balsamic vinegar", "salsa verde"
If the uncertainty is about serving size, portion, or general ambiguity (not a specific ingredient that needs a product swap), return: SKIP"""

def extract_ingredient(recipe, protocol, reason):
    for attempt in range(1, 4):
        try:
            resp = client.messages.create(
                model      = 'claude-haiku-4-5-20251001',
                max_tokens = 50,
                system     = [{'type': 'text', 'text': SYSTEM_PROMPT, 'cache_control': {'type': 'ephemeral'}}],
                messages   = [{'role': 'user', 'content': f'Recipe: {recipe}\nProtocol: {protocol}\nReason: {reason}\n\nIngredient name:'}],
            )
            text = resp.content[0].text.strip().lower()
            text = re.sub(r'[^a-z0-9\s\-\']', '', text).strip()
            return None if text == 'skip' or not text else text
        except Exception as e:
            if attempt == 3:
                raise
            time.sleep(attempt * 1.5)

# ── Process one item ───────────────────────────────────────────────────────────
def process_item(item, index, total, products, progress):
    recipe   = item['recipe']
    protocol = item['protocol']
    reason   = item['reason']
    url      = item.get('url', '')
    label    = f'[{index}/{total}] {recipe[:38]:<38} {protocol}'
    base     = {'recipe': recipe, 'protocol': protocol, 'url': url, 'reason': reason}

    # Identity-destroying?
    if (protocol, recipe) in IDENTITY_DESTROYING:
        print(f'{label} → identity-destroying')
        result = {**base, 'verdict': 'mod: false — destroys dish identity', 'category': 'identity_destroying'}
        progress['results'].append(result)
        save_progress(progress)
        return result

    # Extract ingredient
    ingredient = extract_ingredient(recipe, protocol, reason)
    if not ingredient:
        print(f'{label} → SKIP')
        result = {**base, 'ingredient_searched': None, 'verdict': 'skipped — no specific ingredient', 'category': 'skipped'}
        progress['results'].append(result)
        save_progress(progress)
        return result

    # Search all 329k products
    matches = search_products(ingredient, protocol, products)

    if matches['compliant']:
        print(f'{label} → ✓ compliant ({ingredient})')
        result = {**base, 'ingredient_searched': ingredient, 'verdict': 'mod confirmed — compliant product exists',
                  'compliant_products': matches['compliant'][:5], 'category': 'mod_confirmed'}
    elif matches['caution']:
        print(f'{label} → ⚠ caution ({ingredient})')
        result = {**base, 'ingredient_searched': ingredient, 'verdict': 'grey area — only caution products found',
                  'caution_products': matches['caution'][:5], 'category': 'grey_area'}
    elif matches['not_compliant']:
        print(f'{label} → ✗ not compliant ({ingredient})')
        result = {**base, 'ingredient_searched': ingredient, 'verdict': 'mod not possible — only non-compliant products found',
                  'not_compliant_products': matches['not_compliant'][:3], 'category': 'mod_not_possible'}
    else:
        print(f'{label} → ? not in FIG ({ingredient})')
        result = {**base, 'ingredient_searched': ingredient, 'verdict': 'no matching product found in FIG database',
                  'category': 'no_product_found'}

    progress['results'].append(result)
    save_progress(progress)
    return result

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    print('CKC Diet × FIG Product Cross-Reference')
    print(f'Concurrency: {CONCURRENCY}\n')

    uncertain = json.load(open(UNCERT_FILE))
    print(f'Loading products…')
    products  = json.load(open(PRODUCTS_FILE))
    print(f'Products loaded: {len(products):,}\n')

    progress = load_progress()
    done_keys = {(r['protocol'], r['recipe']) for r in progress['results']}
    todo      = [u for u in uncertain if (u['protocol'], u['recipe']) not in done_keys]

    print(f'Total: {len(uncertain)} | Done: {len(progress["results"])} | Remaining: {len(todo)}\n')

    offset = len(progress['results'])

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as ex:
        futures = {
            ex.submit(process_item, item, offset + i + 1, len(uncertain), products, progress): item
            for i, item in enumerate(todo)
        }
        for f in as_completed(futures):
            try:
                f.result()
            except Exception as e:
                item = futures[f]
                print(f'ERROR {item["recipe"]} | {item["protocol"]}: {e}')

    # Build final grouped report
    from collections import defaultdict
    by_cat = defaultdict(list)
    for r in progress['results']:
        by_cat[r.get('category', 'unknown')].append(r)

    summary = {k: len(v) for k, v in by_cat.items()}
    summary['total'] = len(progress['results'])

    report = {'summary': summary, **dict(by_cat)}
    json.dump(report, open(OUT_FILE, 'w'), indent=2)

    print('\n── Summary ──────────────────────────────')
    for k, v in summary.items():
        print(f'  {k:<25} {v}')
    print(f'\nSaved → {OUT_FILE}')

if __name__ == '__main__':
    main()
