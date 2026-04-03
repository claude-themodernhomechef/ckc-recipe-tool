#!/usr/bin/env python3
"""
enrich_prep_time.py

Populates the `prep_time` field (integer minutes, representing TOTAL time)
on all YES recipes. "Total time" = prep + cook combined, which is what the
recipe site's totalTime field reports.

Strategy (in order):
  1. If the recipe already has a numeric `prep_time` — skip (already done).
  2. If it has a `totalTime` string left by the old scraper (e.g. "30 min",
     "1 hr 15 min") — convert that to minutes and write `prep_time`.
  3. Otherwise — fetch the recipe URL and extract totalTime (or prepTime +
     cookTime combined) from the page's JSON-LD schema, then write `prep_time`.

At the end prints a table of every recipe where prep_time still couldn't be
determined, with name + URL, so you can look them up manually.

Usage:
  python3 enrich_prep_time.py              # dry run (print what would happen)
  python3 enrich_prep_time.py --write      # actually update Firestore
  python3 enrich_prep_time.py --write --workers 30
"""

import json, re, time, argparse
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup
import firebase_admin
from firebase_admin import credentials, firestore as fs_module

# ── Args ──────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser()
parser.add_argument('--write',   action='store_true', help='Write updates to Firestore (default: dry run)')
parser.add_argument('--workers', type=int, default=20, help='Parallel scrape workers')
args = parser.parse_args()

# ── Firebase ──────────────────────────────────────────────────────────────────

if not firebase_admin._apps:
    cred = credentials.Certificate('service-account.json')
    firebase_admin.initialize_app(cred)
db = fs_module.client()

# ── Helpers ───────────────────────────────────────────────────────────────────

def total_time_str_to_minutes(s: str) -> int | None:
    """
    Convert strings like "30 min", "1 hr", "1 hr 15 min", "45 minutes"
    to an integer number of minutes. Returns None if unparseable.
    """
    if not s:
        return None
    s = s.lower().strip()
    hours   = int((re.search(r'(\d+)\s*h', s)   or [0, 0])[1])
    minutes = int((re.search(r'(\d+)\s*m', s)   or [0, 0])[1])
    total   = hours * 60 + minutes
    return total if total > 0 else None


def iso_duration_to_minutes(iso: str) -> int | None:
    """Convert ISO 8601 duration (PT1H30M, PT45M, etc.) to integer minutes."""
    if not iso:
        return None
    hours   = int((re.search(r'(\d+)H', iso) or [0, 0])[1])
    minutes = int((re.search(r'(\d+)M', iso) or [0, 0])[1])
    total   = hours * 60 + minutes
    return total if total > 0 else None


def scrape_minutes(doc_id: str, url: str) -> tuple[str, int | None, str | None]:
    """
    Fetch URL, parse JSON-LD for totalTime / prepTime+cookTime.
    Returns (doc_id, minutes_or_None, error_or_None).
    """
    session = requests.Session()
    session.headers.update({
        'User-Agent': (
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
            'AppleWebKit/537.36 (KHTML, like Gecko) '
            'Chrome/120.0.0.0 Safari/537.36'
        ),
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
    })
    try:
        resp = session.get(url, timeout=14, allow_redirects=True)
        if resp.status_code in (403, 429, 503):
            return doc_id, None, f'HTTP {resp.status_code}'
        if not resp.ok:
            return doc_id, None, f'HTTP {resp.status_code}'

        soup = BeautifulSoup(resp.text, 'html.parser')

        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data  = json.loads(script.string or '')
                items = data.get('@graph', [data]) if isinstance(data, dict) else data
                if not isinstance(items, list):
                    items = [items]
                for item in items:
                    if not isinstance(item, dict):
                        continue
                    if item.get('@type') not in ('Recipe', 'recipe'):
                        continue

                    # 1. totalTime directly
                    mins = iso_duration_to_minutes(item.get('totalTime', ''))
                    if mins:
                        return doc_id, mins, None

                    # 2. prepTime + cookTime
                    prep_mins = iso_duration_to_minutes(item.get('prepTime', ''))
                    cook_mins = iso_duration_to_minutes(item.get('cookTime', ''))
                    combined  = (prep_mins or 0) + (cook_mins or 0)
                    if combined:
                        return doc_id, combined, None

            except Exception:
                pass

        return doc_id, None, 'not found in schema'

    except Exception as e:
        return doc_id, None, str(e)[:80]


# ── Load recipes from Firestore ───────────────────────────────────────────────

print('Fetching YES recipes from Firestore...')
snap = db.collection('recipes').where('status', '==', 'yes').get()

already_have  = []   # have numeric prep_time already
from_string   = []   # have totalTime string, will convert
need_scrape   = []   # need to hit the URL

for d in snap:
    data = d.to_dict()
    doc  = {'id': d.id, 'name': data.get('name', ''), 'url': data.get('url', '')}

    existing_prep = data.get('prep_time')
    if isinstance(existing_prep, (int, float)) and existing_prep > 0:
        already_have.append(doc)
        continue

    total_time_str = data.get('totalTime', '')
    if total_time_str:
        mins = total_time_str_to_minutes(str(total_time_str))
        if mins:
            doc['prep_time'] = mins
            from_string.append(doc)
            continue

    if doc['url']:
        need_scrape.append(doc)
    else:
        doc['error'] = 'no URL'
        need_scrape.append(doc)   # will land in "not found" list

print(f'  Already have prep_time : {len(already_have)}')
print(f'  Convert from totalTime : {len(from_string)}')
print(f'  Need to scrape         : {len(need_scrape)}')
print()

# ── Scrape missing ones ───────────────────────────────────────────────────────

scrape_results: dict[str, int] = {}   # doc_id -> minutes
not_found: list[dict]           = []   # recipes we couldn't get

to_scrape = [r for r in need_scrape if r.get('url') and not r.get('error')]
no_url    = [r for r in need_scrape if not r.get('url') or r.get('error')]

if to_scrape:
    print(f'Scraping {len(to_scrape)} URLs with {args.workers} workers...')
    start = time.time()
    done  = 0

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(scrape_minutes, r['id'], r['url']): r
            for r in to_scrape
        }
        for future in as_completed(futures):
            rec = futures[future]
            doc_id, mins, err = future.result()
            done += 1

            if mins:
                scrape_results[doc_id] = mins
                label = f'✓  {mins} min'
            else:
                not_found.append({'id': doc_id, 'name': rec['name'], 'url': rec['url'], 'error': err})
                label = f'—  {err}'

            print(f'  [{done:>4}/{len(to_scrape)}] {rec["name"][:50].ljust(50)}  {label}')

    print(f'  Scraped in {time.time() - start:.0f}s\n')

not_found += no_url  # recipes with no URL at all

# ── Apply updates ─────────────────────────────────────────────────────────────

updates: list[tuple[str, int, str]] = []   # (doc_id, minutes, source)

for r in from_string:
    updates.append((r['id'], r['prep_time'], 'totalTime string'))

for doc_id, mins in scrape_results.items():
    updates.append((doc_id, mins, 'scraped'))

print(f'Updates to apply: {len(updates)}')

if args.write:
    print('Writing to Firestore...')
    for doc_id, mins, source in updates:
        db.collection('recipes').document(doc_id).update({'prep_time': mins})
        print(f'  ✓ {doc_id[:10]}…  prep_time={mins}  ({source})')
    print(f'\n✅  Wrote {len(updates)} prep_time values to Firestore.')
else:
    print('(Dry run — pass --write to commit to Firestore)\n')
    for doc_id, mins, source in updates[:20]:
        print(f'  would set prep_time={mins:>4}  on {doc_id[:10]}…  ({source})')
    if len(updates) > 20:
        print(f'  … and {len(updates) - 20} more')

# ── Print manual-review list ──────────────────────────────────────────────────

print(f'\n{"─"*70}')
print(f'COULD NOT FIND prep_time for {len(not_found)} recipes — manual review needed:')
print(f'{"─"*70}')
if not_found:
    for r in sorted(not_found, key=lambda x: x['name']):
        print(f'  {r["name"][:55].ljust(55)}  {r.get("url", "(no url)")}')
else:
    print('  (none — all recipes accounted for!)')
print(f'{"─"*70}')
