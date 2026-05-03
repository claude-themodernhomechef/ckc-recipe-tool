#!/usr/bin/env python3
"""
backfill_scrape_missing.py
==========================
Re-scrapes recipe URLs for YES recipes missing blogger, rating, or protein.
Patches only the missing fields — does not overwrite existing data.

Usage:
  python3 backfill_scrape_missing.py --dry-run   # preview which recipes need scraping
  python3 backfill_scrape_missing.py              # scrape and patch
  python3 backfill_scrape_missing.py --limit 20  # patch first 20 only
"""
import json, re, time, argparse
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup
import firebase_admin
from firebase_admin import credentials, firestore as fs_module

SA_KEY   = 'service-account.json'
SLEEP_SEC = 0.8

parser = argparse.ArgumentParser()
parser.add_argument('--dry-run', action='store_true')
parser.add_argument('--limit', type=int, default=0)
args = parser.parse_args()

SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
})

# ── Firebase init ────────────────────────────────────────────────────────────
if not firebase_admin._apps:
    cred = credentials.Certificate(SA_KEY)
    firebase_admin.initialize_app(cred)
db = fs_module.client()

# ── Find recipes missing fields ──────────────────────────────────────────────
print('Fetching YES recipes missing blogger, rating, or protein...')
snap = db.collection('recipes').where('status', '==', 'yes').get()
targets = [
    (d.id, d.to_dict()) for d in snap
    if not d.to_dict().get('blogger') or not d.to_dict().get('rating') or not d.to_dict().get('protein')
]
print(f'Found {len(targets)} recipes needing a scrape')

if args.limit:
    targets = targets[:args.limit]
    print(f'Limiting to {args.limit}')

if args.dry_run:
    for _, d in targets:
        missing = [f for f in ['blogger','rating','protein'] if not d.get(f)]
        print(f'  {d.get("name","?")} — missing: {missing}')
    print(f'\n[DRY RUN] Would scrape {len(targets)} recipes')
    exit(0)

# ── Scrape function ──────────────────────────────────────────────────────────
def scrape_fields(url):
    result = {'blogger': '', 'rating': '', 'ratingValue': None}
    try:
        resp = SESSION.get(url, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')

        # JSON-LD — most reliable
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data = json.loads(script.string or '')
                items = data.get('@graph', [data]) if isinstance(data, dict) else (data if isinstance(data, list) else [data])
                for item in items:
                    if not isinstance(item, dict): continue
                    if item.get('@type') == 'Recipe':
                        agg = item.get('aggregateRating', {})
                        if agg:
                            rv = agg.get('ratingValue')
                            rc = agg.get('ratingCount') or agg.get('reviewCount', '')
                            if rv:
                                result['ratingValue'] = float(rv)
                                result['rating'] = f'{float(rv):.1f} ({rc} ratings)' if rc else f'{float(rv):.1f}'
                        break
            except Exception:
                pass

        # Blogger from og:site_name or domain
        og_site = soup.find('meta', property='og:site_name')
        if og_site and og_site.get('content'):
            result['blogger'] = og_site['content'].strip()
        else:
            domain = urlparse(url).netloc.replace('www.', '')
            result['blogger'] = domain.split('.')[0].replace('-', ' ').title()

    except Exception as e:
        print(f'    ⚠ Scrape error: {e}')
    return result

# ── Main loop ────────────────────────────────────────────────────────────────
patched = 0
failed  = 0

for i, (doc_id, data) in enumerate(targets, 1):
    name = data.get('name', '?')
    url  = data.get('url', '')
    missing = [f for f in ['blogger','rating','protein'] if not data.get(f)]
    print(f'\n[{i}/{len(targets)}] {name}')
    print(f'  Missing: {missing}')

    if not url:
        print(f'  ⚠ No URL — skipping')
        failed += 1
        continue

    scraped = scrape_fields(url)
    patch = {}

    if not data.get('blogger') and scraped.get('blogger'):
        patch['blogger'] = scraped['blogger']
    if not data.get('rating') and scraped.get('rating'):
        patch['rating'] = scraped['rating']
    # protein can't be scraped — skip (needs manual entry or inference)

    if patch:
        print(f'  ✓ Patching: {patch}')
        db.collection('recipes').document(doc_id).update(patch)
        patched += 1
    else:
        print(f'  — Nothing new scraped')
        failed += 1

    time.sleep(SLEEP_SEC)

print(f'\n── Summary ──')
print(f'  Patched: {patched}')
print(f'  No data: {failed}')
print(f'\nNote: protein ({sum(1 for _,d in targets if not d.get("protein"))} missing) requires manual entry — cannot be reliably scraped from recipe pages.')
