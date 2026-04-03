#!/usr/bin/env python3
"""
patch_protein_tags.py
=====================
Applies protein tag decisions from protein_tag_review.csv:

  Simple tag fixes:
    - Veal Saltimbocca       → Beef
    - Chinese Tea Eggs       → Egg   (already correct, ensure consistent)
    - Basmati Rice and Orzo Pilaf → Grain
    - Coconut Rice (HBH)     → Grain

  Recipe splits (duplicate with different protein + ingredient text):
    - Thai Larb Salad        → 3 versions: Chicken / Turkey / Beef
    - Zaatar Meatballs       → 2 versions: Lamb / Beef
    - Thai Coconut Curry Dumpling Soup → 2 versions: Pork / Chicken

Updates recipes.json (local source of truth) then pushes to Firestore.

Usage:
  python3 patch_protein_tags.py --dry-run   # preview changes only
  python3 patch_protein_tags.py             # apply + push to Firestore
"""

import json, copy, re, sys, time, argparse
import firebase_admin
from firebase_admin import credentials, firestore as fs_module

SA_KEY       = 'service-account.json'
RECIPES_FILE = 'recipes.json'
SLEEP_SEC    = 0.05

parser = argparse.ArgumentParser()
parser.add_argument('--dry-run', action='store_true')
args = parser.parse_args()

# ── Load recipes ──────────────────────────────────────────────────────────────
with open(RECIPES_FILE) as f:
    recipes = json.load(f)

name_index = {r['name']: i for i, r in enumerate(recipes)}

# ── Simple tag fixes ──────────────────────────────────────────────────────────
SIMPLE_FIXES = {
    'Veal Saltimbocca':                 'Beef',
    'Chinese Tea Eggs':                 'Egg',
    'Basmati Rice and Orzo Pilaf':      'Grain',
}

# For Coconut Rice we target the Half Baked Harvest one specifically
# (multiple coconut rice recipes exist — match by URL fragment)
COCONUT_RICE_URL = 'halfbakedharvest'

# ── Split recipes config ──────────────────────────────────────────────────────
# Each entry: (recipe name, list of (protein_tag, ingredient_find, ingredient_replace, name_suffix))
SPLITS = [
    (
        'Thai Larb Salad',
        [
            ('Chicken', r'16 ounces ground chicken, turkey, beef, lamb,',
                        '16 ounces ground chicken,', ' (Chicken)'),
            ('Turkey',  r'16 ounces ground chicken, turkey, beef, lamb,',
                        '16 ounces ground turkey,',  ' (Turkey)'),
            ('Beef',    r'16 ounces ground chicken, turkey, beef, lamb,',
                        '16 ounces ground beef,',    ' (Beef)'),
        ]
    ),
    (
        'Zaatar Meatballs with Green Tahini Sauce',
        [
            ('Lamb', r'1 lb ground turkey, beef, chicken or lamb',
                     '1 lb ground lamb',  ' (Lamb)'),
            ('Beef', r'1 lb ground turkey, beef, chicken or lamb',
                     '1 lb ground beef',  ' (Beef)'),
        ]
    ),
    (
        'Thai Coconut Curry Dumpling Soup',
        [
            ('Pork',    r'20  gyozas \(or potstickers\)',
                        '20 pork gyozas (or potstickers)',    ' (Pork)'),
            ('Chicken', r'20  gyozas \(or potstickers\)',
                        '20 chicken gyozas (or potstickers)', ' (Chicken)'),
        ]
    ),
]

# ── Helper ────────────────────────────────────────────────────────────────────
def fix_ingredient(ingredients, find_pat, replace_str):
    """Replace the first ingredient matching find_pat with replace_str."""
    result = []
    replaced = False
    for ing in ingredients:
        if not replaced and re.search(find_pat, ing, re.IGNORECASE):
            result.append(replace_str)
            replaced = True
        else:
            result.append(ing)
    return result

# ── Apply simple fixes ────────────────────────────────────────────────────────
simple_updates = []   # (recipe, old_protein, new_protein)

for name, new_protein in SIMPLE_FIXES.items():
    if name in name_index:
        r = recipes[name_index[name]]
        if r.get('protein') != new_protein:
            simple_updates.append((r, r.get('protein'), new_protein))
            if not args.dry_run:
                r['protein'] = new_protein

# Coconut Rice (Half Baked Harvest)
for r in recipes:
    if 'coconut rice' in r.get('name','').lower() and COCONUT_RICE_URL in r.get('url','').lower():
        if r.get('protein') != 'Grain':
            simple_updates.append((r, r.get('protein'), 'Grain'))
            if not args.dry_run:
                r['protein'] = 'Grain'

print(f'\n── Simple fixes ({len(simple_updates)}) ──')
for r, old, new in simple_updates:
    print(f'  {r["name"]}: {old!r} → {new!r}')

# ── Apply splits ──────────────────────────────────────────────────────────────
new_recipes   = []   # recipes to add
remove_names  = []   # original recipe names to remove

for base_name, variants in SPLITS:
    if base_name not in name_index:
        print(f'  WARNING: {base_name!r} not found in recipes.json')
        continue

    base = recipes[name_index[base_name]]
    remove_names.append(base_name)
    print(f'\n── Split: {base_name} ──')

    for protein_tag, find_pat, replace_str, suffix in variants:
        new_r = copy.deepcopy(base)
        new_r['name']    = base_name + suffix
        new_r['protein'] = protein_tag
        new_r['status']  = 'yes'   # required for app query (status == 'yes')
        new_r['ingredients'] = fix_ingredient(
            base.get('ingredients', []), find_pat, replace_str
        )
        new_recipes.append(new_r)
        print(f'  + {new_r["name"]} (protein={protein_tag})')
        # Show the key ingredient change
        for ing in new_r['ingredients']:
            if any(p in ing.lower() for p in ['chicken','turkey','beef','lamb','pork','gyoza','dumpling']):
                print(f'      ingredient → {ing}')
                break

# ── Rebuild recipes list ──────────────────────────────────────────────────────
if not args.dry_run:
    recipes = [r for r in recipes if r.get('name') not in remove_names]
    recipes.extend(new_recipes)

    with open(RECIPES_FILE, 'w') as f:
        json.dump(recipes, f, indent=2, ensure_ascii=False)
    print(f'\n✓ recipes.json updated ({len(recipes)} total recipes)')

# ── Firestore sync ────────────────────────────────────────────────────────────
if args.dry_run:
    print('\n[DRY RUN] No Firestore writes performed.')
    sys.exit(0)

print('\n── Syncing to Firestore ──')

def init_firebase():
    if not firebase_admin._apps:
        cred = credentials.Certificate(SA_KEY)
        firebase_admin.initialize_app(cred)
    return fs_module.client()

db = init_firebase()
col = db.collection('recipes')

# 0. Firestore-only fixes (recipes not in local recipes.json)
FIRESTORE_ONLY_FIXES = {
    'Basmati Rice and Orzo Pilaf': 'Grain',
    'Coconut Rice':                'Grain',  # HBH Thai Short Ribs side dish
}
print('\nUpdating Firestore-only fixes...')
for name, new_p in FIRESTORE_ONLY_FIXES.items():
    docs = col.where('name', '==', name).stream()
    doc_list = list(docs)
    if doc_list:
        for doc in doc_list:
            doc.reference.update({'protein': new_p})
            print(f'  ✓ Updated {name}: → {new_p}')
    else:
        print(f'  – Not found in Firestore: {name}')
    time.sleep(SLEEP_SEC)

# 1. Simple tag fixes — update by matching name field in Firestore
print('\nUpdating simple fixes...')
for r, old_p, new_p in simple_updates:
    docs = col.where('name', '==', r['name']).limit(1).stream()
    doc_list = list(docs)
    if doc_list:
        doc_list[0].reference.update({'protein': new_p})
        print(f'  ✓ Updated {r["name"]}: {old_p} → {new_p}')
    else:
        print(f'  ✗ Not found in Firestore: {r["name"]}')
    time.sleep(SLEEP_SEC)

# 2. Delete original split recipes from Firestore
print('\nRemoving original split recipes from Firestore...')
for name in remove_names:
    docs = col.where('name', '==', name).stream()
    for doc in docs:
        doc.reference.delete()
        print(f'  ✓ Deleted: {name}')
    time.sleep(SLEEP_SEC)

# 3. Add new split recipes to Firestore
print('\nAdding split recipe variants...')
for r in new_recipes:
    col.add(r)
    print(f'  ✓ Added: {r["name"]} ({r["protein"]})')
    time.sleep(SLEEP_SEC)

print('\n✅ All done.')
