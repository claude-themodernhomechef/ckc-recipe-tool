"""
flag_for_admin_review.py
────────────────────────
Flags Group B + C recipes for admin swipe review.

Groups being flagged (status: yes → pending):
  B) Added by sourcing agent — no matching YES decision in decisions collection
  C) Unknown origin — no sourceAddedAt, no matching YES decision

These will appear in the app's /admin swipe queue.
Human-approved recipes (Group A) are left untouched.

Usage:
  python3 flag_for_admin_review.py --dry-run   # preview only
  python3 flag_for_admin_review.py             # apply to Firestore
"""

import json, os, sys, argparse, time
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
    print('CKC Admin Review Flagger', '[DRY RUN]' if args.dry_run else '')
    print()

    # ── Step 1: get all YES decision URLs (Group A = human approved) ───────────
    print('Loading YES decisions from decisions collection…')
    decisions_snap = db.collection('decisions').where('decision', '==', 'YES').get()
    yes_decision_urls = set(d.to_dict().get('url', '').rstrip('/') for d in decisions_snap)
    print(f'  Found {len(yes_decision_urls)} YES decision URLs')

    # ── Step 2: get all YES recipes ────────────────────────────────────────────
    print('Loading YES recipes from recipes collection…')
    recipes_snap = db.collection('recipes').where('status', '==', 'yes').get()
    print(f'  Found {len(recipes_snap)} YES recipes')

    # ── Step 3: identify B + C ─────────────────────────────────────────────────
    to_flag = []
    group_a = 0

    for doc in recipes_snap:
        data = doc.to_dict()
        url  = (data.get('url') or '').rstrip('/')

        if url in yes_decision_urls:
            group_a += 1  # Human approved — leave alone
        else:
            label = 'B (sourcing agent)' if data.get('sourceAddedAt') else 'C (unknown origin)'
            to_flag.append((doc, label))

    print()
    print(f'  Group A (human approved — untouched): {group_a}')
    print(f'  Group B + C (to flag as pending):     {len(to_flag)}')
    print()

    if not to_flag:
        print('Nothing to flag.')
        return

    # ── Step 4: preview or apply ───────────────────────────────────────────────
    group_b = sum(1 for _, l in to_flag if l.startswith('B'))
    group_c = sum(1 for _, l in to_flag if l.startswith('C'))
    print(f'  Group B: {group_b}')
    print(f'  Group C: {group_c}')
    print()

    if args.dry_run:
        print('DRY RUN — sample of recipes that would be flagged:')
        for doc, label in to_flag[:10]:
            data = doc.to_dict()
            print(f'  [{label}] {data.get("name", "?")}')
        if len(to_flag) > 10:
            print(f'  … and {len(to_flag) - 10} more')
        print()
        print('Run without --dry-run to apply.')
        return

    # ── Apply ──────────────────────────────────────────────────────────────────
    print(f'Flagging {len(to_flag)} recipes as status=pending…')
    updated = 0
    errors  = 0

    for doc, label in to_flag:
        try:
            doc.reference.update({'status': 'pending'})
            updated += 1
            if updated % 50 == 0:
                print(f'  {updated}/{len(to_flag)} done…')
            time.sleep(0.05)  # avoid rate limiting
        except Exception as e:
            name = doc.to_dict().get('name', '?')
            print(f'  ERROR {name}: {e}')
            errors += 1

    print()
    print('── Done ──────────────────────────────────────────────')
    print(f'  Flagged as pending: {updated}')
    if errors:
        print(f'  Errors:             {errors}')
    print()
    print('Open the app → /admin to begin swiping.')

if __name__ == '__main__':
    main()
