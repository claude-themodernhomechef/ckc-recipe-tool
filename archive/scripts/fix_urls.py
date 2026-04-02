#!/usr/bin/env python3
"""
fix_urls.py
===========
Phase 1 --check : Fetch NO decisions from Firestore, check each URL, save broken list
Phase 2 --search : Search DuckDuckGo for correct URL for each broken recipe
Phase 3 --fix   : Apply url_fixes.json to Firestore + recipes.json

Typical workflow:
  python3 fix_urls.py --check          # produces broken_urls.json
  python3 fix_urls.py --search         # produces url_fixes.json  (run from your own terminal)
  python3 fix_urls.py --fix            # applies fixes
"""

import json, os, re, sys, time, argparse
import requests
from bs4 import BeautifulSoup
import firebase_admin
from firebase_admin import credentials, firestore

SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
})

RECIPES_JSON = 'recipes.json'
BROKEN_FILE  = 'broken_urls.json'
FIXES_FILE   = 'url_fixes.json'

SKIP_DOMAINS = {          # domains known to block bots / have no recipe
    'saveur.com',
    'food52.com',
    'alisoneroman.com',
}


# ── Firebase ──────────────────────────────────────────────────
def init_firebase():
    sa_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT')
    if sa_json:
        cred = credentials.Certificate(json.loads(sa_json))
    elif os.path.exists('service-account.json'):
        cred = credentials.Certificate('service-account.json')
    else:
        print('No Firebase credentials found.'); sys.exit(1)
    firebase_admin.initialize_app(cred)
    return firestore.client()


# ── Helpers ───────────────────────────────────────────────────
def check_url(url, timeout=8):
    try:
        r = SESSION.head(url, timeout=timeout, allow_redirects=True)
        if r.status_code in (405, 403):
            r = SESSION.get(url, timeout=timeout, allow_redirects=True, stream=True)
        return r.status_code == 200
    except Exception:
        return False


def get_domain(url):
    try:
        return requests.utils.urlparse(url).netloc.lstrip('www.')
    except Exception:
        return ''


def slugify(text):
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    return re.sub(r'-+', '-', text).strip('-')


def search_duckduckgo(query, domain=None):
    """
    Search DuckDuckGo HTML. Returns list of (title, url) tuples.
    Must be run from a real terminal — not available in sandboxed envs.
    """
    ddg_url = 'https://html.duckduckgo.com/html/'
    q = f'site:{domain} {query}' if domain else query
    try:
        r = SESSION.post(ddg_url, data={'q': q}, timeout=15)
        if not r.ok:
            return []
        soup = BeautifulSoup(r.text, 'html.parser')
        results = []
        for a in soup.select('.result__a'):
            href = a.get('href', '')
            if 'uddg=' in href:
                import urllib.parse
                params = dict(urllib.parse.parse_qsl(urllib.parse.urlparse(href).query))
                href = params.get('uddg', href)
            title = a.get_text(strip=True)
            if href.startswith('http'):
                results.append((title, href))
        return results
    except Exception as e:
        print(f'    DDG error: {e}')
        return []


def find_url(name, old_url):
    """
    Try to find a working URL for this recipe.
    1. Try common slug patterns on same domain
    2. Search DuckDuckGo on same domain
    3. Search DuckDuckGo broadly
    """
    domain = get_domain(old_url)
    base_url = old_url.split('/')[0] + '//' + requests.utils.urlparse(old_url).netloc
    slug = slugify(name)

    # 1. Try slug variations on same domain
    if domain not in SKIP_DOMAINS:
        candidates = [
            f"{base_url}/{slug}/",
            f"{base_url}/recipe/{slug}/",
            f"{base_url}/recipes/{slug}/",
        ]
        for url in candidates:
            if url.rstrip('/') != old_url.rstrip('/') and check_url(url):
                return url, 'slug-guess'

    # 2. Search DDG on same domain
    if domain not in SKIP_DOMAINS:
        results = search_duckduckgo(name, domain)
        for title, url in results[:3]:
            if domain in url and url.rstrip('/') != old_url.rstrip('/'):
                if check_url(url):
                    return url, 'ddg-domain'

    # 3. Search DDG broadly (any reputable food blog)
    results = search_duckduckgo(f'{name} recipe')
    trusted = [
        'seriouseats.com', 'bonappetit.com', 'nytimes.com/recipes',
        'thekitchn.com', 'delish.com', 'allrecipes.com', 'epicurious.com',
    ]
    for title, url in results[:5]:
        if any(t in url for t in trusted):
            if check_url(url):
                return url, 'ddg-broad'

    return None, None


# ── Phase 1: Check ────────────────────────────────────────────
def phase_check(db):
    print("Fetching NO decisions from Firestore…")
    no_docs = list(db.collection('decisions').where('decision', '==', 'NO').stream())
    no_list = [{'id': d.id, **d.to_dict()} for d in no_docs]
    print(f"Found {len(no_list)} NO decisions\n")

    broken = []
    ok_count = 0

    for i, doc in enumerate(no_list):
        name   = doc.get('name', '')
        url    = doc.get('url', '')
        doc_id = doc['id']
        sys.stdout.write(f"\r[{i+1}/{len(no_list)}] {name[:50]:<50}")
        sys.stdout.flush()

        if not url or not check_url(url):
            broken.append({'name': name, 'old_url': url or '', 'firestore_id': doc_id})
        else:
            ok_count += 1
        time.sleep(0.1)

    print(f"\n\nOK: {ok_count}  |  Broken: {len(broken)}")
    with open(BROKEN_FILE, 'w') as f:
        json.dump(broken, f, indent=2)
    print(f"Saved to {BROKEN_FILE}")
    print(f"\nNext: run  python3 fix_urls.py --search")


# ── Phase 2: Search ───────────────────────────────────────────
def phase_search():
    if not os.path.exists(BROKEN_FILE):
        print(f"Run --check first to generate {BROKEN_FILE}")
        sys.exit(1)

    with open(BROKEN_FILE) as f:
        broken = json.load(f)

    # Load existing fixes so we can resume
    fixes = {}
    if os.path.exists(FIXES_FILE):
        with open(FIXES_FILE) as f:
            for item in json.load(f):
                fixes[item['name']] = item

    print(f"Searching for correct URLs for {len(broken)} broken recipes…\n")

    for i, b in enumerate(broken):
        name    = b['name']
        old_url = b['old_url']

        if name in fixes:
            print(f"[{i+1}/{len(broken)}] SKIP (already fixed): {name[:55]}")
            continue

        print(f"[{i+1}/{len(broken)}] {name[:60]}")
        print(f"  broken: {old_url}")

        new_url, method = find_url(name, old_url)
        if new_url:
            print(f"  → {method}: {new_url}")
            fixes[name] = {'name': name, 'old_url': old_url, 'new_url': new_url, 'method': method}
        else:
            print(f"  ✗ not found")
            fixes[name] = {'name': name, 'old_url': old_url, 'new_url': None, 'method': None}

        # Save after every recipe so we can resume
        with open(FIXES_FILE, 'w') as f:
            json.dump(list(fixes.values()), f, indent=2)

        time.sleep(1.2)   # polite delay

    found  = sum(1 for v in fixes.values() if v.get('new_url'))
    missed = sum(1 for v in fixes.values() if not v.get('new_url'))
    print(f"\n{'='*55}")
    print(f"Found  : {found}")
    print(f"Missed : {missed}")
    print(f"Saved to {FIXES_FILE}")
    print(f"\nNext: run  python3 fix_urls.py --fix")


# ── Phase 3: Fix ──────────────────────────────────────────────
def phase_fix(db):
    if not os.path.exists(FIXES_FILE):
        print(f"No {FIXES_FILE} found. Run --search first."); sys.exit(1)
    if not os.path.exists(BROKEN_FILE):
        print(f"No {BROKEN_FILE} found. Run --check first."); sys.exit(1)

    with open(FIXES_FILE) as f:
        fixes = [x for x in json.load(f) if x.get('new_url')]

    with open(BROKEN_FILE) as f:
        broken_map = {b['name']: b for b in json.load(f)}

    with open(RECIPES_JSON, encoding='utf-8') as f:
        recipes = json.load(f)
    recipe_map = {r['name']: r for r in recipes}

    print(f"Applying {len(fixes)} fixes…\n")
    applied = 0
    for fix in fixes:
        name    = fix['name']
        new_url = fix['new_url']
        print(f"  {name[:55]}")
        print(f"    {new_url}")

        if name in broken_map:
            doc_id = broken_map[name]['firestore_id']
            db.collection('decisions').document(doc_id).update({'url': new_url})

        if name in recipe_map:
            recipe_map[name]['url'] = new_url

        applied += 1

    with open(RECIPES_JSON, 'w', encoding='utf-8') as f:
        json.dump(list(recipe_map.values()), f, indent=2, ensure_ascii=False)

    print(f"\n✓ Applied {applied} fixes to Firestore + recipes.json")
    print("Now commit and push recipes.json.")


# ── Entry ─────────────────────────────────────────────────────
if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check',  action='store_true')
    parser.add_argument('--search', action='store_true')
    parser.add_argument('--fix',    action='store_true')
    args = parser.parse_args()

    if args.search:
        phase_search()   # no Firebase needed
    else:
        db = init_firebase()
        if args.fix:
            phase_fix(db)
        else:
            phase_check(db)
