"""
fix_unswiped_yes.py
Finds recipes marked status='yes' with no backing YES decision in the decisions collection.
Reverts them to status='pending' so they can be properly reviewed.
Dry-run by default. Pass --fix to apply.
"""

import sys, warnings
warnings.filterwarnings('ignore')

DRY_RUN = '--fix' not in sys.argv

import firebase_admin
from firebase_admin import credentials, firestore as fs_module

cred = credentials.Certificate('service-account.json')
firebase_admin.initialize_app(cred)
db = firestore.client() if False else fs_module.client()

# ── Get all YES decision URLs ──────────────────────────────────
print("Loading decisions collection...")
yes_decisions = set()
for doc in db.collection('decisions').stream():
    d = doc.to_dict()
    if d.get('decision') == 'YES':
        url = (d.get('url') or '').strip().rstrip('/')
        if url:
            yes_decisions.add(url)
print(f"  YES decisions: {len(yes_decisions)}")

# ── Find yes recipes with no decision backing ──────────────────
print("Loading recipes collection...")
to_revert = []
for doc in db.collection('recipes').stream():
    d = doc.to_dict()
    if d.get('status') != 'yes':
        continue
    url = (d.get('url') or '').strip().rstrip('/')
    if url not in yes_decisions:
        to_revert.append({'id': doc.id, 'name': d.get('name', '?'), 'url': url})

print(f"  Recipes to revert to pending: {len(to_revert)}")
print(f"  Mode: {'DRY RUN (pass --fix to apply)' if DRY_RUN else '*** LIVE UPDATE ***'}")

if DRY_RUN:
    print("\nSample (first 20):")
    for r in to_revert[:20]:
        print(f"  {r['name']}")
    print("\nRun with --fix to apply.")
else:
    print("\nReverting in batches...")
    batch = db.batch()
    count = 0
    updated = 0
    for r in to_revert:
        ref = db.collection('recipes').document(r['id'])
        batch.update(ref, {'status': 'pending', 'decidedAt': None})
        count += 1
        updated += 1
        if count >= 400:
            batch.commit()
            batch = db.batch()
            count = 0
            print(f"  Committed {updated} updates...")
    if count > 0:
        batch.commit()
    print(f"\nDone. Reverted {updated} recipes to 'pending'.")
