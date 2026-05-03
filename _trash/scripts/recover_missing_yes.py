"""
recover_missing_yes.py
───────────────────────
Recovers Group D: YES decisions that exist in the decisions collection
but are missing from the recipes collection.

For each missing recipe:
  - Copies all available fields from the decisions doc
  - Writes a new document to the recipes collection with status: yes
  - Leaves processingStatus unset so process_new_yes_recipes.py picks them up

Resume-safe: skips any URL already in the recipes collection.

Usage:
  python3 recover_missing_yes.py --dry-run   # preview only
  python3 recover_missing_yes.py             # apply to Firestore
"""

import os, sys, argparse, time
import firebase_admin
from firebase_admin import credentials, firestore as fs_module

# ── Config ─────────────────────────────────────────────────────────────────────
BASE      = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(BASE)
SA_KEY    = os.path.join(REPO_ROOT, 'service-account.json')

# ── CLI args ───────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument('--dry-run', action='store_true', help='Preview only — no writes')
args = parser.parse_args()

# ── Firebase ───────────────────────────────────────────────────────────────────
if not firebase_admin._apps:
    cred = credentials.Certificate(SA_KEY)
    firebase_admin.initialize_app(cred)
db = fs_module.client()

def main():
    print('CKC Group D Recovery', '[DRY RUN]' if args.dry_run else '')
    print()

    # ── Step 1: collect all URLs already in recipes collection ─────────────────
    print('Loading existing recipe URLs…')
    recipes_snap = db.collection('recipes').select(['url']).get()
    existing_urls = set(
        (d.to_dict().get('url') or '').rstrip('/')
        for d in recipes_snap
    )
    print(f'  {len(existing_urls)} recipes already in collection')

    # ── Step 2: find YES decisions missing from recipes ────────────────────────
    print('Loading YES decisions…')
    decisions_snap = db.collection('decisions').where('decision', '==', 'YES').get()
    print(f'  {len(decisions_snap)} YES decisions found')

    missing = []
    for doc in decisions_snap:
        data = doc.to_dict()
        url  = (data.get('url') or '').rstrip('/')
        if url and url not in existing_urls:
            missing.append((doc.id, data))

    print(f'  Missing from recipes collection: {len(missing)}')
    print()

    if not missing:
        print('Nothing to recover — all YES decisions are already in recipes.')
        return

    # ── Step 3: preview or apply ───────────────────────────────────────────────
    if args.dry_run:
        print('DRY RUN — recipes that would be recovered:')
        for _, data in missing[:15]:
            print(f'  - {data.get("name", "?")}  |  {(data.get("url") or "")[:60]}')
        if len(missing) > 15:
            print(f'  … and {len(missing) - 15} more')
        print()
        print('Run without --dry-run to apply.')
        return

    # ── Step 4: write to recipes collection ────────────────────────────────────
    print(f'Writing {len(missing)} recovered recipes to Firestore…')
    written = 0
    errors  = 0

    for decision_id, data in missing:
        try:
            # Map decisions fields → recipes fields
            recipe_doc = {
                'status':      'yes',
                'name':        data.get('name')         or '',
                'url':         data.get('url')          or '',
                'image':       data.get('image')        or '',
                'photo_url':   data.get('image')        or '',
                'rating':      data.get('rating')       or '',
                'blogger':     data.get('blogger')      or '',
                'protein_type': data.get('protein')     or '',
                'cuisine':     data.get('cuisineStyle') or '',
                'meal_type':   data.get('mealType')     or '',
                'alignmentScore': data.get('alignmentScore') or '',
                'decidedAt':   data.get('decidedAt')    or '',
                'recoveredFrom': decision_id,  # audit trail
            }

            # Carry over enrichment fields if they exist on the decision doc
            if data.get('dietTags'):
                recipe_doc['dietTags'] = data['dietTags']
            if data.get('chefNotes'):
                recipe_doc['chefNotes'] = data['chefNotes']
            if data.get('chefsNotes'):
                recipe_doc['chefsNotes'] = data['chefsNotes']
            if data.get('ingredients'):
                recipe_doc['ingredients'] = data['ingredients']

            # Remove empty strings to keep docs clean
            recipe_doc = {k: v for k, v in recipe_doc.items() if v != ''}

            db.collection('recipes').add(recipe_doc)
            written += 1

            if written % 25 == 0:
                print(f'  {written}/{len(missing)} written…')

            time.sleep(0.05)  # avoid rate limiting

        except Exception as e:
            name = data.get('name', '?')
            print(f'  ERROR {name}: {e}')
            errors += 1

    print()
    print('── Done ──────────────────────────────────────────────')
    print(f'  Recovered: {written}')
    if errors:
        print(f'  Errors:    {errors}')
    print()
    print('These recipes are now in the pipeline.')
    print('Run process_new_yes_recipes.py to enrich them.')

if __name__ == '__main__':
    main()
