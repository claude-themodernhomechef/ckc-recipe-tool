#!/usr/bin/env python3
"""
scrape_missing_ratings.py
=========================
Finds all YES recipes in Firestore missing a rating, scrapes each URL
for JSON-LD aggregateRating, and writes results directly back to Firestore.

Usage:
  python3 scrape_missing_ratings.py            # run it
  python3 scrape_missing_ratings.py --dry-run  # preview only, no writes
"""

import json, time, argparse
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup
import firebase_admin
from firebase_admin import credentials, firestore as fs_module

# ── Config ────────────────────────────────────────────────────────────────────
SA_KEY     = 'service-account.json'
SLEEP_SEC  = 0.8

parser = argparse.ArgumentParser()
parser.add_argument('--dry-run', action='store_true')
args = parser.parse_args()

# ── Firebase ──────────────────────────────────────────────────────────────────
if not firebase_admin._apps:
    firebase_admin.initialize_app(credential=credentials.Certificate(SA_KEY))
db = fs_module.client()

# ── HTTP session ──────────────────────────────────────────────────────────────
SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept':          'text/html,application/xhtml+xml,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
})

# ── Scraper ───────────────────────────────────────────────────────────────────
def fetch_rating(url: str) -> dict:
    """Return {'ratingValue': float, 'ratingCount': int} or {}."""
    try:
        resp = SESSION.get(url, timeout=14)
        if resp.status_code != 200:
            return {}
        soup = BeautifulSoup(resp.text, 'html.parser')

        # 1. JSON-LD
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data  = json.loads(script.string or '')
                items = data if isinstance(data, list) else [data]
                for item in items:
                    if not isinstance(item, dict):
                        continue
                    recipe = None
                    if item.get('@type') == 'Recipe':
                        recipe = item
                    else:
                        for sub in item.get('@graph', []):
                            if isinstance(sub, dict) and sub.get('@type') == 'Recipe':
                                recipe = sub
                                break
                    if recipe:
                        agg = recipe.get('aggregateRating', {})
                        if agg:
                            rv = agg.get('ratingValue') or ''
                            rc = agg.get('ratingCount') or agg.get('reviewCount') or ''
                            try:
                                rv = round(float(str(rv).strip()), 2)
                                rc = int(str(rc).strip())
                                if 0 < rv <= 5 and rc > 0:
                                    return {'ratingValue': rv, 'ratingCount': rc}
                            except (ValueError, TypeError):
                                pass
            except Exception:
                pass

        # 2. Microdata fallback
        rating_el = soup.find(itemprop='ratingValue')
        count_el  = soup.find(itemprop='ratingCount') or soup.find(itemprop='reviewCount')
        if rating_el and count_el:
            try:
                rv = round(float((rating_el.get('content') or rating_el.text).strip()), 2)
                rc = int((count_el.get('content') or count_el.text).strip())
                if 0 < rv <= 5 and rc > 0:
                    return {'ratingValue': rv, 'ratingCount': rc}
            except (ValueError, TypeError):
                pass

        return {}
    except Exception:
        return {}

# ── Main ──────────────────────────────────────────────────────────────────────
print('Fetching YES recipes missing ratings from Firestore…')
snap = db.collection('recipes').where('status', '==', 'yes').stream()

missing = []
for doc in snap:
    d = doc.to_dict()
    r = d.get('rating', '')
    if not r or r in ('NR', ''):
        missing.append({'id': doc.id, 'name': d.get('name',''), 'url': d.get('url','')})

print(f'Found {len(missing)} recipes missing ratings\n')
if args.dry_run:
    print('[DRY RUN — no writes]\n')

found = 0
not_found = 0
errors = 0

for i, rec in enumerate(missing):
    url  = rec['url']
    name = rec['name']
    domain = ''
    try:
        domain = urlparse(url).netloc.replace('www.', '')
    except Exception:
        pass

    print(f'  [{i+1}/{len(missing)}] {name[:52]:<52}', end='', flush=True)

    if not url:
        print(' — no URL')
        errors += 1
        continue

    rating = fetch_rating(url)

    if rating:
        display = f"{rating['ratingValue']} ({rating['ratingCount']:,} ratings)"
        print(f' ★ {display}')
        found += 1
        if not args.dry_run:
            db.collection('recipes').document(rec['id']).update({'rating': display})
    else:
        print(f' — not found  [{domain}]')
        not_found += 1

    time.sleep(SLEEP_SEC)

print(f'\n── Summary ──')
print(f'  Found:     {found}')
print(f'  Not found: {not_found}')
print(f'  Errors:    {errors}')
if not args.dry_run:
    print(f'\nWrote {found} ratings directly to Firestore.')
