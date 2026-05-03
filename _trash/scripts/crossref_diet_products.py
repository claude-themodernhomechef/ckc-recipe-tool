"""
crossref_diet_products.py
─────────────────────────
Cross-references uncertain diet tag recipes against the FIG product database.

For each uncertain flag:
  - If the recipe modification destroys dish identity → mod: false
  - Otherwise → search FIG products for a compliant version of the flagged ingredient
    - compliant found  → mod confirmed, product noted
    - caution only     → grey area, noted separately
    - nothing found    → mod not possible

Output: diet_product_crossref_report.json
"""

import json, re, os
from collections import defaultdict

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE    = os.path.dirname(os.path.abspath(__file__))
UNCERT  = os.path.join(BASE, 'diet_uncertainty_report.json')
PRODS   = '/Users/rafi/Desktop/Claude-MHC/Fig Scraper/ckc_products_cleaned_2026-03-29.json'
OUT     = os.path.join(BASE, 'diet_product_crossref_report.json')

# ── Protocol → FIG field ───────────────────────────────────────────────────────
PROTO_FIELD = {
    'AIP': 'aip_friendly',
    'LF':  'low_fodmap',
    'GF':  'gluten_free',
    'DF':  'dairy_free',
    'Vg':  'vegan',
    'V':   'vegetarian',
    'LH':  'low_histamine',
    'K':   None,  # special: sugar_free + paleo
}

# ── Identity-destroying cases → mod: false ────────────────────────────────────
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

# ── Ingredient extraction from free-text reason ────────────────────────────────
# Ordered list of regex strategies; first match wins
EXTRACT_PATTERNS = [
    # "X is/are [adjective] [noun]" — subject of sentence
    r'^([A-Za-z][a-zA-Z\s\-\']{2,35}?)\s+(?:is|are)\b',
    # "X composition/content/brand/blend" — strip noise suffix
    r'([A-Za-z][a-zA-Z\s\-\']{2,30}?)\s+(?:composition|content|brand|blend|ingredients?|carb|status)\b',
    # "removing/without/replacing X"
    r'(?:removing|without|replace[sd]?|replacing|swap(?:ping)?)\s+([a-zA-Z][a-zA-Z\s\-\']{2,30}?)(?:\s+(?:is|are|significantly|from|entirely|would|may|can|changes|alters)|\,|\.)',
    # "The X question" / "The X problem"
    r'[Tt]he\s+([a-zA-Z][a-zA-Z\s\-\']{2,25}?)\s+(?:question|problem|issue|concern)\b',
]

# Noise suffixes to strip from extracted terms
NOISE_SUFFIXES = [
    ' composition', ' content', ' brand', ' blend', ' ingredients',
    ' carb', ' status', ' question', ' problem', ' issue',
    ' and ', ' or ',
]

# Non-food stopwords
STOPWORDS = {
    'the', 'this', 'that', 'some', 'most', 'many', 'standard', 'recipe',
    'dish', 'additional', 'context', 'protocol', 'uncertain', 'fodmap',
    'modification', 'access', 'citrus', 'quantity', 'level', 'detail',
    'unknown', 'information', 'amount', 'version', 'option',
}

def extract_ingredient(reason: str) -> list[str]:
    """Return list of ingredient search terms extracted from reason text."""
    candidates = []

    for pat in EXTRACT_PATTERNS:
        m = re.search(pat, reason, re.IGNORECASE)
        if m:
            term = m.group(1).strip().lower()
            candidates.append(term)

    # Clean each candidate
    results = []
    for term in candidates:
        # Strip trailing noise
        for suffix in NOISE_SUFFIXES:
            if term.endswith(suffix.strip()):
                term = term[:term.rfind(suffix.strip())].strip()
        # Strip leading articles
        term = re.sub(r'^(the|a|an)\s+', '', term).strip()
        # Split "X and Y" into two terms
        if ' and ' in term:
            parts = [p.strip() for p in term.split(' and ')]
            results.extend(p for p in parts if len(p) > 2 and p not in STOPWORDS)
        elif len(term) > 2 and term not in STOPWORDS:
            results.append(term)

    return list(dict.fromkeys(results))  # deduplicate, preserve order

# ── Product search ─────────────────────────────────────────────────────────────
def get_compliance(product: dict, protocol: str) -> str:
    if protocol == 'K':
        sf = product.get('sugar_free', 'unknown')
        pa = product.get('paleo', 'unknown')
        if sf == 'compliant' and pa == 'compliant':
            return 'compliant'
        if 'not_compliant' in (sf, pa):
            return 'not_compliant'
        return 'caution'
    field = PROTO_FIELD.get(protocol)
    if not field:
        return 'unknown'
    return product.get(field, 'unknown')

def search_products(query: str, protocol: str, products: list) -> dict:
    q = query.lower()
    results = {'compliant': [], 'caution': [], 'not_compliant': []}
    for p in products:
        if q in p['name'].lower():
            status = get_compliance(p, protocol)
            if status in results:
                results[status].append({'name': p['name'], 'brand': p.get('brand', '')})
    return results

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    print('Loading uncertainty report…')
    with open(UNCERT) as f:
        uncertain = json.load(f)

    print(f'Loading {PRODS.split("/")[-1]}…')
    with open(PRODS) as f:
        products = json.load(f)
    print(f'Products loaded: {len(products):,}')

    report = {
        'summary': {},
        'identity_destroying':  [],
        'mod_confirmed':        [],
        'grey_area':            [],
        'mod_not_possible':     [],
        'no_product_found':     [],
    }

    totals = defaultdict(int)

    for u in uncertain:
        recipe   = u['recipe']
        protocol = u['protocol']
        reason   = u['reason']
        url      = u.get('url', '')

        base = {
            'recipe':   recipe,
            'protocol': protocol,
            'url':      url,
            'reason':   reason,
        }

        # 1. Identity-destroying?
        if (protocol, recipe) in IDENTITY_DESTROYING:
            report['identity_destroying'].append({**base, 'verdict': 'mod: false — destroys dish identity'})
            totals['identity_destroying'] += 1
            continue

        # 2. Extract ingredient keywords (may return multiple)
        ingredients = extract_ingredient(reason)
        if not ingredients:
            report['no_product_found'].append({**base, 'ingredients_searched': [], 'note': 'Could not extract ingredient keyword'})
            totals['no_extract'] += 1
            continue

        # 3. Search product DB — aggregate across all extracted terms
        all_compliant    = []
        all_caution      = []
        all_not_compliant = []

        for ingredient in ingredients:
            m = search_products(ingredient, protocol, products)
            all_compliant.extend(m['compliant'])
            all_caution.extend(m['caution'])
            all_not_compliant.extend(m['not_compliant'])

        entry = {**base, 'ingredients_searched': ingredients}

        if all_compliant:
            entry['verdict']           = 'mod confirmed — compliant product exists'
            entry['compliant_products'] = all_compliant[:5]
            report['mod_confirmed'].append(entry)
            totals['mod_confirmed'] += 1

        elif all_caution:
            entry['verdict']          = 'grey area — only caution products found'
            entry['caution_products'] = all_caution[:5]
            report['grey_area'].append(entry)
            totals['grey_area'] += 1

        elif all_not_compliant:
            entry['verdict']  = 'mod not possible — only non-compliant products found'
            entry['products'] = all_not_compliant[:3]
            report['mod_not_possible'].append(entry)
            totals['mod_not_possible'] += 1

        else:
            entry['verdict'] = 'no matching product found in FIG database'
            report['no_product_found'].append(entry)
            totals['no_product_found'] += 1

    report['summary'] = {
        'total_uncertain':      len(uncertain),
        'identity_destroying':  totals['identity_destroying'],
        'mod_confirmed':        totals['mod_confirmed'],
        'grey_area':            totals['grey_area'],
        'mod_not_possible':     totals['mod_not_possible'],
        'no_product_found':     totals['no_product_found'] + totals['no_extract'],
    }

    with open(OUT, 'w') as f:
        json.dump(report, f, indent=2)

    print(f'\n── Results ─────────────────────────────')
    for k, v in report['summary'].items():
        print(f'  {k:<25} {v}')
    print(f'\nSaved → {OUT}')

if __name__ == '__main__':
    main()
