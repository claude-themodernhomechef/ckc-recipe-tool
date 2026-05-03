#!/usr/bin/env python3
"""
scrape_time_fast.py
Parallel Python scraper for totalTime across all YES recipes.
20 concurrent workers — completes ~956 recipes in ~2-3 minutes.

Usage:
  python3 scrape_time_fast.py
  python3 scrape_time_fast.py --workers 30

Then run:
  python3 apply_time.py
"""

import json, re, time, argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from bs4 import BeautifulSoup
import firebase_admin
from firebase_admin import credentials, firestore as fs_module

parser = argparse.ArgumentParser()
parser.add_argument('--workers', type=int, default=20)
args = parser.parse_args()

RESULTS_FILE = '/tmp/time_results.json'

# ── Firebase ──────────────────────────────────────────────────────────────────
if not firebase_admin._apps:
    cred = credentials.Certificate('service-account.json')
    firebase_admin.initialize_app(cred)
db = fs_module.client()

# ── ISO 8601 duration -> human string ────────────────────────────────────────
def parse_iso(iso):
    if not iso: return ''
    h = int((re.search(r'(\d+)H', iso) or [0,0])[1])
    m = int((re.search(r'(\d+)M', iso) or [0,0])[1])
    total = h * 60 + m
    if not total: return ''
    if total < 60: return f'{total} min'
    hrs, mins = total // 60, total % 60
    return f'{hrs} hr {mins} min' if mins else f'{hrs} hr'

# ── Scrape a single URL ───────────────────────────────────────────────────────
def scrape_time(doc_id, url):
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                      'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
    })
    try:
        resp = session.get(url, timeout=12, allow_redirects=True)
        if resp.status_code in (403, 429, 503):
            return doc_id, None, f'HTTP {resp.status_code}'
        if not resp.ok:
            return doc_id, None, f'HTTP {resp.status_code}'

        soup = BeautifulSoup(resp.text, 'html.parser')

        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data = json.loads(script.string or '')
                items = data.get('@graph', [data]) if isinstance(data, dict) else data
                if not isinstance(items, list): items = [items]
                for item in items:
                    if not isinstance(item, dict): continue
                    if item.get('@type') == 'Recipe':
                        total = item.get('totalTime', '')
                        if not total:
                            prep = item.get('prepTime', '')
                            cook = item.get('cookTime', '')
                            ph = int((re.search(r'(\d+)H', prep) or [0,0])[1]) if prep else 0
                            pm = int((re.search(r'(\d+)M', prep) or [0,0])[1]) if prep else 0
                            ch = int((re.search(r'(\d+)H', cook) or [0,0])[1]) if cook else 0
                            cm = int((re.search(r'(\d+)M', cook) or [0,0])[1]) if cook else 0
                            total_mins = (ph + ch) * 60 + pm + cm
                            if total_mins:
                                hrs = total_mins // 60
                                mins = total_mins % 60
                                total = f'PT{hrs}H{mins}M' if hrs else f'PT{mins}M'
                        t = parse_iso(total)
                        if t:
                            return doc_id, t, None
            except Exception:
                pass

        return doc_id, None, 'not found'
    except Exception as e:
        return doc_id, None, str(e)[:60]

# ── Main ──────────────────────────────────────────────────────────────────────
print('Fetching YES recipes from Firestore...')
snap = db.collection('recipes').where('status', '==', 'yes').get()
recipes = []
for d in snap:
    data = d.to_dict()
    if not data.get('totalTime') and data.get('url'):
        recipes.append({'id': d.id, 'name': data.get('name', ''), 'url': data['url']})
print(f'Recipes missing time: {len(recipes)}')

results = {}
found = missing = errors = 0
start = time.time()

with ThreadPoolExecutor(max_workers=args.workers) as pool:
    futures = {pool.submit(scrape_time, r['id'], r['url']): r for r in recipes}
    done = 0
    for future in as_completed(futures):
        rec = futures[future]
        doc_id, time_str, err = future.result()
        done += 1

        if time_str:
            results[doc_id] = time_str
            found += 1
            status = f'✓ {time_str}'
        elif err and 'not found' not in err:
            errors += 1
            status = f'⚠ {err}'
        else:
            missing += 1
            status = '— not found'

        print(f'[{done}/{len(recipes)}] {rec["name"][:50].ljust(50)} {status}')

        if done % 50 == 0:
            with open(RESULTS_FILE, 'w') as f:
                json.dump(results, f, indent=2)

with open(RESULTS_FILE, 'w') as f:
    json.dump(results, f, indent=2)

elapsed = time.time() - start
print(f'\n── Summary ──')
print(f'  Found:   {found}')
print(f'  Missing: {missing}')
print(f'  Errors:  {errors}')
print(f'  Time:    {elapsed:.0f}s')
print(f'\nRun: python3 apply_time.py  to push to Firestore')
