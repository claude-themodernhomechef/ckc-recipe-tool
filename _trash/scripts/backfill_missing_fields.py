#!/usr/bin/env python3
"""
backfill_missing_fields.py
==========================
Cross-references recipes.json against Firestore recipes collection.
For any YES recipe missing blogger, rating, or protein, fills them
in from recipes.json (matched by URL).

Usage:
  python3 backfill_missing_fields.py --dry-run   # preview only
  python3 backfill_missing_fields.py              # apply updates
"""
import json, argparse
import firebase_admin
from firebase_admin import credentials, firestore as fs_module

SA_KEY = 'service-account.json'
FIELDS = ['blogger', 'rating', 'protein', 'cuisine', 'course']

parser = argparse.ArgumentParser()
parser.add_argument('--dry-run', action='store_true')
args = parser.parse_args()

# Init Firebase
if not firebase_admin._apps:
    cred = credentials.Certificate(SA_KEY)
    firebase_admin.initialize_app(cred)
db = fs_module.client()

# Load recipes.json as URL lookup
with open('recipes.json') as f:
    raw = json.load(f)
json_recipes = raw if isinstance(raw, list) else list(raw.values())
json_by_url = {}
for r in json_recipes:
    url = (r.get('url') or '').strip().rstrip('/')
    if url:
        json_by_url[url] = r

print(f'recipes.json: {len(json_by_url)} URLs indexed')

# Fetch all YES recipes from Firestore
print('Fetching YES recipes from Firestore...')
snap = db.collection('recipes').where('status', '==', 'yes').get()
docs = [(d.id, d.to_dict()) for d in snap]
print(f'Found {len(docs)} YES recipes')

updates = 0
no_match = 0

for doc_id, data in docs:
    url = (data.get('url') or '').strip().rstrip('/')
    source = json_by_url.get(url)
    if not source:
        no_match += 1
        continue

    patch = {}
    for field in FIELDS:
        if not data.get(field) and source.get(field):
            patch[field] = source[field]

    if not patch:
        continue

    updates += 1
    print(f'  {"[DRY RUN] " if args.dry_run else ""}Patching {data.get("name","?")} — {list(patch.keys())}')
    if not args.dry_run:
        db.collection('recipes').document(doc_id).update(patch)

print(f'\n── Summary ──')
print(f'  Updated:   {updates}')
print(f'  No match:  {no_match} (URL not in recipes.json)')
print(f'  Unchanged: {len(docs) - updates - no_match}')
