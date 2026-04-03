#!/usr/bin/env python3
"""
scrape_new_recipe.py
====================
Lightweight scraper for adding new recipes to the swipe queue.
Scrapes bare minimum data for Rafi to make a YES/NO/MAYBE decision,
uploads the image to Firebase Storage, and writes to Firestore
with status: "pending".

Usage:
  python3 scrape_new_recipe.py <url>
  python3 scrape_new_recipe.py <url1> <url2> <url3>
  python3 scrape_new_recipe.py --file urls.txt        # one URL per line
  python3 scrape_new_recipe.py <url> --dry-run        # preview only
  python3 scrape_new_recipe.py <url> --protein Chicken --cuisine Mediterranean
"""

import json, os, sys, re, time, argparse, io, subprocess
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup
import firebase_admin
from firebase_admin import credentials, firestore as fs_module, storage

# ── Config ──────────────────────────────────────────────────────────────────────
SA_KEY         = 'service-account.json'
STORAGE_BUCKET = 'ckc-recipe-swipe.firebasestorage.app'
SLEEP_SEC      = 0.8

SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
})

# ── CLI args ────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description='Add new recipes to the CKC swipe queue')
parser.add_argument('urls', nargs='*', help='Recipe URL(s) to scrape')
parser.add_argument('--file',     help='Text file with one URL per line')
parser.add_argument('--dry-run',  action='store_true', help='Preview only, no writes')
parser.add_argument('--protein',  help='Override protein field (e.g. Chicken, Salmon)')
parser.add_argument('--cuisine',  help='Override cuisine field (e.g. Mediterranean, Asian)')
parser.add_argument('--course',   help='Override course field (e.g. Entree, Side, Soup)')
args = parser.parse_args()

# ── Firebase init ────────────────────────────────────────────────────────────────
def init_firebase():
    if not firebase_admin._apps:
        cred = credentials.Certificate(SA_KEY)
        firebase_admin.initialize_app(cred, {'storageBucket': STORAGE_BUCKET})
    return fs_module.client(), storage.bucket()

# ── Scraping ─────────────────────────────────────────────────────────────────────
def scrape_recipe(url):
    """Scrape bare minimum fields from a recipe URL."""
    result = {
        'name':        '',
        'description': '',
        'image_url':   '',
        'rating':      '',
        'blogger':     '',
        'protein':     args.protein or '',
        'cuisine':     args.cuisine or '',
        'course':      args.course or 'Entree',
        'totalTime':   '',
    }

    try:
        resp = SESSION.get(url, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')

        # ── Name ──────────────────────────────────────────────────────
        # Try JSON-LD first
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data = json.loads(script.string or '')
                items = data.get('@graph', [data]) if isinstance(data, dict) else data
                for item in items:
                    if isinstance(item, dict) and item.get('@type') == 'Recipe':
                        result['name'] = item.get('name', '').strip()

                        # Description
                        result['description'] = (item.get('description') or '').strip()[:300]

                        # Rating
                        agg = item.get('aggregateRating', {})
                        if agg:
                            rv  = agg.get('ratingValue', '')
                            rc  = agg.get('ratingCount', '') or agg.get('reviewCount', '')
                            if rv:
                                result['rating'] = f"{float(rv):.1f} ({rc} ratings)" if rc else str(rv)

                        # Image
                        img = item.get('image')
                        if isinstance(img, list): img = img[0]
                        if isinstance(img, dict): img = img.get('url', '')
                        result['image_url'] = str(img or '').strip()

                        # Total time (ISO 8601 → human readable)
                        def parse_iso_duration(iso):
                            if not iso: return ''
                            h = int((re.search(r'(\d+)H', iso) or [0,0])[1])
                            m = int((re.search(r'(\d+)M', iso) or [0,0])[1])
                            total = h * 60 + m
                            if not total: return ''
                            if total < 60: return f'{total} min'
                            hrs = total // 60
                            mins = total % 60
                            return f'{hrs} hr {mins} min' if mins else f'{hrs} hr'

                        total = item.get('totalTime', '')
                        if not total:
                            prep = item.get('prepTime', '')
                            cook = item.get('cookTime', '')
                            if prep or cook:
                                ph = int((re.search(r'(\d+)H', prep) or [0,0])[1]) if prep else 0
                                pm = int((re.search(r'(\d+)M', prep) or [0,0])[1]) if prep else 0
                                ch = int((re.search(r'(\d+)H', cook) or [0,0])[1]) if cook else 0
                                cm = int((re.search(r'(\d+)M', cook) or [0,0])[1]) if cook else 0
                                total_mins = (ph + ch) * 60 + pm + cm
                                if total_mins:
                                    hrs = total_mins // 60
                                    mins = total_mins % 60
                                    total = f'PT{hrs}H{mins}M' if hrs else f'PT{mins}M'
                        result['totalTime'] = parse_iso_duration(total)
                        break
            except Exception:
                pass

        # ── Fallback name from og:title / h1 ──────────────────────────
        if not result['name']:
            og_title = soup.find('meta', property='og:title')
            result['name'] = (og_title['content'] if og_title else '').strip()
        if not result['name']:
            h1 = soup.find('h1')
            result['name'] = h1.get_text(strip=True) if h1 else ''

        # ── Fallback description from og:description ───────────────────
        if not result['description']:
            og_desc = soup.find('meta', property='og:description') or \
                      soup.find('meta', attrs={'name': 'description'})
            if og_desc:
                result['description'] = og_desc.get('content', '').strip()[:300]

        # ── Fallback image from og:image ───────────────────────────────
        if not result['image_url']:
            og_img = soup.find('meta', property='og:image')
            if og_img:
                result['image_url'] = og_img.get('content', '').strip()

        # ── Blogger from og:site_name or domain ───────────────────────
        og_site = soup.find('meta', property='og:site_name')
        if og_site and og_site.get('content'):
            result['blogger'] = og_site['content'].strip()
        else:
            domain = urlparse(url).netloc.replace('www.', '')
            result['blogger'] = domain.split('.')[0].replace('-', ' ').title()

    except Exception as e:
        print(f'  ⚠ Scrape error: {e}')

    return result

# ── Chrome fallback for image ────────────────────────────────────────────────────
CHROME_SCRIPT = os.path.join(os.path.dirname(__file__), 'get_image_chrome.js')

def get_image_via_chrome(url):
    """Launch Puppeteer to extract og:image when Python requests can't."""
    try:
        result = subprocess.run(
            ['node', CHROME_SCRIPT, url],
            capture_output=True, text=True, timeout=45
        )
        image = result.stdout.strip()
        if image:
            print(f'  ✓ Image found via Chrome fallback')
        return image
    except Exception as e:
        print(f'  ⚠ Chrome fallback failed: {e}')
        return ''

# ── Image upload ─────────────────────────────────────────────────────────────────
def upload_image(image_url, recipe_name, bucket):
    """Download image and upload to Firebase Storage. Returns public URL."""
    if not image_url:
        return ''

    try:
        resp = SESSION.get(image_url, timeout=15)
        resp.raise_for_status()
        content_type = resp.headers.get('Content-Type', 'image/jpeg').split(';')[0]

        ext = {
            'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
            'image/webp': 'webp', 'image/gif': 'gif',
        }.get(content_type, 'jpg')

        # Safe filename from recipe name
        safe_name = re.sub(r'[^a-zA-Z0-9-]', '-', recipe_name.lower())[:60]
        blob_path = f'images/{safe_name}-{int(time.time())}.{ext}'

        blob = bucket.blob(blob_path)
        blob.upload_from_string(resp.content, content_type=content_type)
        blob.make_public()

        return blob.public_url

    except Exception as e:
        print(f'  ⚠ Image upload failed: {e}')
        return image_url  # fall back to original URL

# ── Check for duplicates ─────────────────────────────────────────────────────────
def url_exists_in_firestore(db, url):
    """Check if a URL is already in the recipes collection."""
    clean = url.strip().rstrip('/')
    try:
        snap = db.collection('recipes').where('url', '==', clean).limit(1).get()
        return len(list(snap)) > 0
    except Exception:
        return False

# ── Main ─────────────────────────────────────────────────────────────────────────
def main():
    # Collect URLs
    urls = list(args.urls or [])
    if args.file:
        with open(args.file) as f:
            urls += [line.strip() for line in f if line.strip() and not line.startswith('#')]

    if not urls:
        print('Error: provide at least one URL')
        parser.print_help()
        sys.exit(1)

    print(f'Processing {len(urls)} URL(s){"  [DRY RUN]" if args.dry_run else ""}')

    if not args.dry_run:
        db, bucket = init_firebase()
    else:
        db = bucket = None

    added = 0
    skipped = 0
    failed = 0

    for url in urls:
        url = url.strip().rstrip('/')
        print(f'\n→ {url}')

        # Dedup check
        if not args.dry_run and url_exists_in_firestore(db, url):
            print(f'  ⏭ Already in database, skipping')
            skipped += 1
            continue

        # Scrape
        data = scrape_recipe(url)
        if not data['name']:
            print(f'  ✗ Could not extract recipe name — skipping')
            failed += 1
            continue

        print(f'  Name:     {data["name"]}')
        print(f'  Blogger:  {data["blogger"]}')
        print(f'  Rating:   {data["rating"] or "—"}')
        print(f'  Cuisine:  {data["cuisine"] or "—"}')
        print(f'  Protein:  {data["protein"] or "—"}')
        print(f'  Desc:     {(data["description"] or "")[:80]}{"…" if len(data["description"]) > 80 else ""}')
        print(f'  Time:     {data["totalTime"] or "—"}')
        print(f'  Image:    {"yes" if data["image_url"] else "no"}')

        if args.dry_run:
            added += 1
            continue

        # Chrome fallback if no image from Python
        if not data['image_url']:
            print(f'  → No image via Python, trying Chrome...')
            data['image_url'] = get_image_via_chrome(url)

        # Upload image
        image_storage_url = upload_image(data['image_url'], data['name'], bucket)
        if image_storage_url != data['image_url']:
            print(f'  ✓ Image uploaded to Storage')

        # Build Firestore doc
        doc = {
            'name':        data['name'],
            'url':         url,
            'image':       image_storage_url,
            'description': data['description'],
            'protein':     data['protein'],
            'cuisine':     data['cuisine'],
            'course':      data['course'],
            'rating':      data['rating'],
            'blogger':     data['blogger'],
            'totalTime':   data['totalTime'],
            'status':      'pending',
            'createdAt':   fs_module.SERVER_TIMESTAMP,
            'alignmentScore': None,
        }

        # Write to Firestore
        db.collection('recipes').add(doc)
        print(f'  ✓ Added to swipe queue')
        added += 1

        time.sleep(SLEEP_SEC)

    print(f'\n── Summary ──')
    print(f'  Added:   {added}')
    print(f'  Skipped: {skipped} (duplicates)')
    print(f'  Failed:  {failed}')

if __name__ == '__main__':
    main()
