"""
dedup_firestore.py
For each duplicate URL, keeps the doc with the most data and deletes the other.
"Most data" = most fields that are non-null, non-empty string, and non-empty list.
Dry-run by default. Pass --delete to actually delete.
"""

import sys, warnings
warnings.filterwarnings('ignore')

DRY_RUN = '--delete' not in sys.argv

import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate('service-account.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

def data_score(d: dict) -> int:
    """Count fields that have meaningful data."""
    score = 0
    for v in d.values():
        if v is None:
            continue
        if isinstance(v, str) and v.strip() == '':
            continue
        if isinstance(v, (list, dict)) and len(v) == 0:
            continue
        score += 1
    return score

# ── Fetch all recipes ──────────────────────────────────────────
print("Fetching Firestore recipes...")
url_map = {}
for doc in db.collection('recipes').stream():
    d = doc.to_dict()
    url = (d.get('url') or '').strip().rstrip('/')
    if url:
        url_map.setdefault(url, []).append({'id': doc.id, 'data': d})

dupes = {url: docs for url, docs in url_map.items() if len(docs) > 1}

print(f"Unique URLs     : {len(url_map)}")
print(f"Duplicate URLs  : {len(dupes)}")
print(f"Docs to delete  : {sum(len(v)-1 for v in dupes.values())}")
print(f"Mode            : {'DRY RUN (pass --delete to apply)' if DRY_RUN else '*** LIVE DELETE ***'}")
print()

to_delete = []
conflicts = []  # tied scores — log for review

for url, docs in dupes.items():
    scored = sorted(docs, key=lambda x: data_score(x['data']), reverse=True)
    best = scored[0]
    rest = scored[1:]

    best_score = data_score(best['data'])
    second_score = data_score(rest[0]['data'])

    for loser in rest:
        to_delete.append({
            'url': url,
            'name': best['data'].get('name', '?'),
            'keep_id': best['id'],
            'keep_score': best_score,
            'delete_id': loser['id'],
            'delete_score': data_score(loser['data']),
        })

    if best_score == second_score:
        conflicts.append({'url': url, 'docs': scored})

# ── Report ─────────────────────────────────────────────────────
print(f"Will delete : {len(to_delete)} docs")
print(f"Tied scores : {len(conflicts)} (both have equal data — defaulting to first found)")
print()

if conflicts:
    print("TIED SCORE CASES (first 10):")
    for c in conflicts[:10]:
        print(f"  {c['docs'][0]['data'].get('name','?')}")
        for d in c['docs']:
            print(f"    [{d['id']}] score={data_score(d['data'])}")
    print()

# ── Delete ─────────────────────────────────────────────────────
if DRY_RUN:
    print("Sample of what would be deleted (first 20):")
    for item in to_delete[:20]:
        print(f"  DELETE {item['delete_id']} (score {item['delete_score']}) | KEEP {item['keep_id']} (score {item['keep_score']}) | {item['name']}")
    print()
    print("Run with --delete to apply.")
else:
    print("Deleting duplicates in batches...")
    batch_size = 400
    deleted = 0
    batch = db.batch()
    count = 0
    for item in to_delete:
        batch.delete(db.collection('recipes').document(item['delete_id']))
        count += 1
        deleted += 1
        if count >= batch_size:
            batch.commit()
            batch = db.batch()
            count = 0
            print(f"  Committed {deleted} deletes...")
    if count > 0:
        batch.commit()
    print(f"\nDone. Deleted {deleted} duplicate docs.")
    print("Firestore now has unique recipes only.")
