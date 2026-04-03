#!/usr/bin/env python3
"""
CKC Diet Tag Auditor v2 — High-confidence fixes only
Based on CKC_Diet_Compliance_Rules.md + CKC_Recipe_Tags_Session_Summary_Updated.docx

Strategy:
- Only make changes when ingredient data exists AND the fix is unambiguous
- Priority 1: Fix incomplete GF mod notes (missed soy sauce/oyster/hoisin/Worcestershire)
- Priority 2: Fix wrongly-native GF tags (recipe has hidden gluten but tagged native)
- Priority 3: Fix incomplete DF mod notes
- Priority 4: Fix wrongly-native DF tags
- Priority 5: Fix incomplete K/LF mod notes
- Conservative on AIP/LH — only add if already present or very obvious
"""

import json, re
from difflib import SequenceMatcher

# ── Load data ────────────────────────────────────────────────────────────────
with open('yes_recipes.json') as f:
    yes_recipes = json.load(f)

with open('/tmp/ckc-preview/ingredients.json') as f:
    ing_db = json.load(f)

print(f"YES recipes: {len(yes_recipes)}")
print(f"Ingredients DB: {len(ing_db)} recipes")

# ── Fuzzy name match ─────────────────────────────────────────────────────────
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

def ing_text(ings):
    return ' '.join(ings).lower()

def has(t, *terms):
    return any(term.lower() in t for term in terms)

def has_word(t, term):
    return bool(re.search(r'\b' + re.escape(term.lower()) + r'\b', t))

def normalize_current(dietTags):
    out = {}
    for k, v in (dietTags or {}).items():
        if isinstance(v, dict):
            out[k] = {'native': bool(v.get('native')), 'mod': bool(v.get('mod')), 'notes': (v.get('notes') or '').strip()}
        elif v is True:
            out[k] = {'native': True, 'mod': False, 'notes': ''}
    return out

# ── GF Hidden Gluten Detection ───────────────────────────────────────────────
# Each entry: (ingredient_to_detect, function_to_test, fix_note)
GF_HIDDEN = [
    ('soy sauce',       lambda t: has_word(t,'soy sauce') and not has(t,'tamari','coconut aminos'),
                        'Use tamari instead of soy sauce'),
    ('oyster sauce',    lambda t: has(t,'oyster sauce'),
                        'Use GF oyster sauce'),
    ('hoisin sauce',    lambda t: has(t,'hoisin sauce'),
                        'Use GF hoisin sauce'),
    ('worcestershire',  lambda t: has(t,'worcestershire') and not has(t,'gf worcestershire','vegan worcestershire'),
                        'Use GF Worcestershire sauce'),
    ('panko/breadcrumbs', lambda t: has(t,'panko','bread crumb','breadcrumb') and not has(t,'gf panko','gluten-free panko'),
                        'Use GF panko or GF breadcrumbs'),
    ('flour tortilla',  lambda t: has(t,'flour tortilla'),
                        'Use corn tortillas or GF wraps instead of flour tortillas'),
    ('cornbread mix',   lambda t: has(t,'cornbread mix'),
                        'Use GF cornbread mix'),
]

def get_gf_violations(t):
    """Returns list of fix notes for all hidden gluten found in ingredient text."""
    fixes = []
    for name, test_fn, fix in GF_HIDDEN:
        if test_fn(t):
            fixes.append(fix)
    return fixes

def get_gf_pasta_violations(t):
    """Pasta/grain that needs GF swap."""
    PASTA_MAP = {
        'orzo':           'Use cassava flour orzo',
        'couscous':       'Use GF couscous or cauliflower rice',
        'ramen noodle':   'Use brown rice noodles instead of ramen',
        'lo mein':        'Use brown rice noodles instead of lo mein',
        'udon':           'Use brown rice noodles instead of udon',
        'gnocchi':        'Use cauliflower gnocchi',
        'tortellini':     'Use GF tortellini',
        'regular pasta':  None,  # handled separately
    }
    fixes = []
    if has(t,'orzo'): fixes.append('Use cassava flour orzo')
    if has(t,'couscous'): fixes.append('Use GF couscous or cauliflower rice')
    if has(t,'ramen') or has_word(t,'lo mein') or has_word(t,'udon'):
        fixes.append('Use brown rice noodles')
    if has(t,'gnocchi'): fixes.append('Use cauliflower gnocchi')
    if has(t,'tortellini'): fixes.append('Use GF tortellini')
    return fixes

# ── DF Dairy Detection ────────────────────────────────────────────────────────
DAIRY_MAP = [
    ('heavy cream',     lambda t: has(t,'heavy cream','heavy whipping cream'),
                        'Replace heavy cream with full-fat canned coconut milk'),
    ('half-and-half',   lambda t: has(t,'half and half','half-and-half'),
                        'Replace half-and-half with full-fat canned coconut milk'),
    ('sour cream',      lambda t: has(t,'sour cream') and not has(t,'dairy-free sour cream','vegan sour cream'),
                        'Use dairy-free sour cream'),
    ('greek yogurt',    lambda t: has(t,'greek yogurt','plain yogurt') and not has(t,'coconut yogurt','dairy-free'),
                        'Use plain unsweetened coconut yogurt'),
    ('buttermilk',      lambda t: has(t,'buttermilk'),
                        'Replace buttermilk with 1 tbsp vinegar + 1/3 cup soy milk (rest 10 min)'),
    ('cream cheese',    lambda t: has(t,'cream cheese') and not has(t,'dairy-free cream cheese','vegan cream cheese'),
                        'Use dairy-free cream cheese'),
    ('ricotta',         lambda t: has(t,'ricotta') and not has(t,'dairy-free ricotta','vegan ricotta'),
                        'Use Kite Hill dairy-free ricotta'),
    ('parmesan',        lambda t: (has(t,'parmesan','parmigiano','pecorino')) and not has(t,'vegan parmesan','dairy-free parmesan'),
                        'Use nutritional yeast or Follow Your Heart vegan parmesan'),
    ('mozzarella',      lambda t: has(t,'mozzarella') and not has(t,'vegan mozzarella','dairy-free mozzarella'),
                        'Use Kite Hill dairy-free mozzarella'),
    ('feta',            lambda t: has(t,'feta') and not has(t,'dairy-free feta','vegan feta'),
                        'Remove feta or use dairy-free feta'),
    ('cotija',          lambda t: has(t,'cotija'),  'Remove cotija cheese'),
    ('queso',           lambda t: has(t,'queso'),   'Remove queso or use dairy-free alternative'),
    ('gruyere',         lambda t: has(t,'gruyere'), 'Use dairy-free cheese alternative'),
    ('cheddar',         lambda t: has(t,'cheddar') and not has(t,'dairy-free cheddar','vegan cheddar'),
                        'Use dairy-free cheddar'),
    ('blue cheese',     lambda t: has(t,'blue cheese'), 'Remove blue cheese'),
    ('goat cheese',     lambda t: has(t,'goat cheese'), 'Remove goat cheese or use dairy-free alternative'),
    ('butter',          lambda t: has(t,'butter') and not has(t,'peanut butter','almond butter','cashew butter','nut butter','vegan butter','dairy-free butter'),
                        'Replace butter with olive oil (cooking) or dairy-free butter (finishing)'),
    ('milk',            lambda t: has_word(t,'milk') and not has(t,'coconut milk','almond milk','oat milk','soy milk','cashew milk','nut milk'),
                        'Use unsweetened oat or soy milk'),
    ('cheese',          lambda t: has_word(t,'cheese') and not has(t,'vegan cheese','dairy-free cheese','nutritional yeast'),
                        'Use dairy-free cheese alternative'),
]

def get_df_violations(t):
    fixes, seen = [], set()
    for name, test_fn, fix in DAIRY_MAP:
        if test_fn(t) and fix not in seen:
            fixes.append(fix)
            seen.add(fix)
    return fixes

# ── K Keto Detection ──────────────────────────────────────────────────────────
KETO_MAP = [
    ('white rice',      lambda t: has(t,'white rice','jasmine rice','basmati rice','long-grain rice') and not has(t,'cauliflower rice'),
                        'Replace rice with cauliflower rice'),
    ('rice',            lambda t: has_word(t,'rice') and not has(t,'cauliflower rice','brown rice pasta','rice noodle','rice vinegar','rice flour','rice wine'),
                        'Replace rice with cauliflower rice'),
    ('pasta',           lambda t: has(t,'pasta','spaghetti','linguine','fettuccine','penne','rigatoni','tagliatelle') and not has(t,'gf pasta','rice pasta','keto pasta','zucchini noodle','shirataki'),
                        'Use spiralized zucchini or keto pasta'),
    ('ramen/lo mein',   lambda t: has(t,'ramen','lo mein','udon'),
                        'Use shirataki noodles'),
    ('couscous',        lambda t: has(t,'couscous'),
                        'Replace couscous with cauliflower rice'),
    ('gnocchi',         lambda t: has(t,'gnocchi') and not has(t,'cauliflower gnocchi'),
                        'Use cauliflower gnocchi'),
    ('potato',          lambda t: has(t,'potato','potatoes') and not has(t,'sweet potato','cauliflower'),
                        'Replace potato with cauliflower or omit'),
    ('sweet potato',    lambda t: has(t,'sweet potato'),
                        'Replace sweet potato with cauliflower mash'),
    ('flour tortilla',  lambda t: has(t,'flour tortilla'),
                        'Use keto wraps instead of flour tortillas'),
    ('burger bun',      lambda t: has(t,'burger bun','buns','hamburger bun'),
                        'Use butter lettuce or iceberg wraps instead of buns'),
    ('bread',           lambda t: has_word(t,'bread') and not has(t,'breadcrumb','cornbread','bread crumb','pita bread') and not has(t,'keto bread','gf bread'),
                        'Use keto bread alternative'),
    ('honey',           lambda t: has_word(t,'honey'),
                        'Replace honey with liquid allulose sweetener'),
    ('brown sugar',     lambda t: has(t,'brown sugar'),
                        'Replace brown sugar with allulose sweetener'),
    ('sugar',           lambda t: has_word(t,'sugar') and not has(t,'coconut sugar') ,
                        'Use allulose as a sugar replacement'),
    ('beans',           lambda t: has(t,'black bean','cannellini','chickpea','kidney bean','pinto bean','white bean','navy bean','lentil') and not has(t,'green bean','bean sprout'),
                        'Remove beans/legumes'),
    ('corn',            lambda t: has(t,'corn') and not has(t,'cornstarch','cornmeal'),
                        'Remove corn'),
    ('quinoa',          lambda t: has(t,'quinoa'),
                        'Replace quinoa with cooked vegetables'),
]

def get_k_violations(t):
    fixes, seen = [], set()
    for name, test_fn, fix in KETO_MAP:
        if test_fn(t) and fix not in seen:
            fixes.append(fix)
            seen.add(fix)
    return fixes

# ── LF Low-FODMAP Detection ───────────────────────────────────────────────────
def get_lf_violations(t, recipe_name=''):
    fixes = []
    name = recipe_name.lower()

    garlic = has(t,'garlic') and not has(t,'garlic-infused oil','garlic infused oil')
    onion = has(t,'onion','shallot','leek') and not has(t,'green onion top','scallion green')
    has_oil = has(t,'olive oil','vegetable oil','avocado oil','canola oil',' oil')

    if garlic and onion and has_oil:
        fixes.append('Remove garlic and onion; replace with garlic-infused oil')
    elif garlic and has_oil:
        fixes.append('Replace garlic and oil with garlic-infused oil')
    elif garlic:
        fixes.append('Replace garlic with 1 tbsp garlic-infused oil')
    elif onion:
        fixes.append('Replace onion/shallot with green tops of scallions')

    if has(t,'mushroom') and 'mushroom soup' not in name and 'mushroom' not in name.split()[0]:
        fixes.append('Remove mushrooms')
    if has(t,'fennel') and not has(t,'fennel seed'):
        fixes.append('Remove fennel')
    if has_word(t,'corn') and not has(t,'cornstarch','cornmeal','corn tortilla'):
        fixes.append('Remove corn')

    for legume in ['cannellini','chickpea','black bean','kidney bean','lentil','pinto bean','white bean','navy bean']:
        if has(t, legume):
            # Skip if the recipe IS the legume
            if legume in name:
                return []  # Don't modify, the legume is the dish
            fixes.append(f'Remove {legume}s')
            break

    if has_word(t,'soy sauce') and not has(t,'tamari'):
        fixes.append('Use tamari instead of soy sauce')
    if has(t,'heavy cream') and not has(t,'coconut milk'):
        fixes.append('Replace heavy cream with coconut milk')
    if has(t,'sour cream') and not has(t,'lactose-free'):
        fixes.append('Use lactose-free sour cream')

    return fixes

# ── Main audit ────────────────────────────────────────────────────────────────
proposed_changes = []
stats = {'gf_fixed': 0, 'df_fixed': 0, 'k_fixed': 0, 'lf_fixed': 0,
         'no_ings': 0, 'unchanged': 0}

for r in yes_recipes:
    ings = find_ingredients(r['name'], r.get('url',''))
    t = ing_text(ings)
    current = normalize_current(r.get('dietTags', {}))
    proposed = {k: dict(v) for k, v in current.items()}  # deep copy

    if not ings:
        stats['no_ings'] += 1
        # Still record for awareness but mark as no-data
        proposed_changes.append({
            'id': r['id'],
            'name': r['name'],
            'url': r.get('url',''),
            'status': 'no_ingredient_data',
            'current': current,
            'proposed': current,  # no change
        })
        continue

    changed = False
    reasons = []

    # ── GF Analysis ──────────────────────────────────────────────────────────
    if 'GF' in current:
        gf = proposed['GF']
        violations = get_gf_violations(t)
        pasta_viol = get_gf_pasta_violations(t) if not gf['native'] else []

        if gf['native'] and violations:
            # Was native but has hidden gluten → switch to mod
            gf['native'] = False
            gf['mod'] = True
            gf['notes'] = '; '.join(violations)
            changed = True
            reasons.append(f"GF: native→mod (found: {', '.join(violations)})")

        elif gf['mod'] and violations:
            # Already mod — check if notes are complete
            all_fixes = violations + pasta_viol
            current_notes = gf['notes'].lower()
            missing = [f for f in all_fixes if not any(
                keyword in current_notes
                for keyword in f.lower().split()[:3]
            )]
            if missing:
                gf['notes'] = '; '.join(all_fixes)
                changed = True
                reasons.append(f"GF: added missing mods ({', '.join(missing)})")

    # ── DF Analysis ──────────────────────────────────────────────────────────
    if 'DF' in current:
        df = proposed['DF']
        violations = get_df_violations(t)

        if df['native'] and violations:
            # Was native but has dairy → switch to mod
            df['native'] = False
            df['mod'] = True
            df['notes'] = '; '.join(violations)
            changed = True
            reasons.append(f"DF: native→mod (found dairy)")

        elif df['mod'] and violations:
            # Already mod — check notes are complete
            current_notes = df['notes'].lower()
            missing = [f for f in violations if not any(
                keyword in current_notes
                for keyword in f.lower().split()[:3]
            )]
            if missing:
                df['notes'] = '; '.join(violations)
                changed = True
                reasons.append(f"DF: updated notes to cover all dairy")

    # ── K Analysis ───────────────────────────────────────────────────────────
    if 'K' in current:
        k = proposed['K']
        if k['mod']:
            violations = get_k_violations(t)
            if violations:
                current_notes = k['notes'].lower()
                missing = [f for f in violations if not any(
                    keyword in current_notes
                    for keyword in f.lower().split()[:3]
                )]
                if missing:
                    k['notes'] = '; '.join(violations)
                    changed = True
                    reasons.append(f"K: updated to cover all carb sources")

    # ── LF Analysis ──────────────────────────────────────────────────────────
    if 'LF' in current:
        lf = proposed['LF']
        if lf['mod']:
            violations = get_lf_violations(t, r['name'])
            if violations:
                current_notes = lf['notes'].lower()
                missing = [f for f in violations if not any(
                    keyword in current_notes
                    for keyword in f.lower().split()[:3]
                )]
                if missing:
                    lf['notes'] = '; '.join(violations)
                    changed = True
                    reasons.append(f"LF: updated notes")

    if changed:
        proposed_changes.append({
            'id': r['id'],
            'name': r['name'],
            'url': r.get('url',''),
            'status': 'changed',
            'reasons': reasons,
            'current': current,
            'proposed': proposed,
        })
        if any('GF' in rs for rs in reasons): stats['gf_fixed'] += 1
        if any('DF' in rs for rs in reasons): stats['df_fixed'] += 1
        if any('K:' in rs for rs in reasons): stats['k_fixed'] += 1
        if any('LF' in rs for rs in reasons): stats['lf_fixed'] += 1
    else:
        stats['unchanged'] += 1

with open('proposed_changes.json', 'w') as f:
    json.dump(proposed_changes, f, indent=2)

# ── Summary ───────────────────────────────────────────────────────────────────
changed_entries = [c for c in proposed_changes if c['status'] == 'changed']
print(f"\n{'='*65}")
print(f"Total YES recipes:            {len(yes_recipes)}")
print(f"Recipes with ingredient data: {len(yes_recipes) - stats['no_ings']}")
print(f"Recipes with no data:         {stats['no_ings']}")
print(f"Recipes unchanged (correct):  {stats['unchanged']}")
print(f"Recipes needing changes:      {len(changed_entries)}")
print(f"  → GF fixes:  {stats['gf_fixed']}")
print(f"  → DF fixes:  {stats['df_fixed']}")
print(f"  → K fixes:   {stats['k_fixed']}")
print(f"  → LF fixes:  {stats['lf_fixed']}")
print(f"\nTop GF fixes:")
for c in changed_entries[:10]:
    if any('GF' in r for r in c.get('reasons',[])):
        print(f"  {c['name']}")
        for reason in c.get('reasons',[]):
            print(f"    → {reason}")
