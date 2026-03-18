#!/usr/bin/env python3
"""
CKC Recipe Scraper
==================
Reads recipes_source.csv, scrapes OG images, converts to WebP,
uploads to Firebase Storage, and updates recipes.json.

Local usage:
  1. pip install requests beautifulsoup4 Pillow firebase-admin
  2. Place service-account.json in project root (never commit this)
  3. python3 scrape.py

GitHub Actions: reads FIREBASE_SERVICE_ACCOUNT env var automatically.
"""

import csv, io, json, os, re, sys, time
import requests
from bs4 import BeautifulSoup
from PIL import Image
import firebase_admin
from firebase_admin import credentials, storage

CSV_FILE    = 'recipes_source.csv'
OUTPUT_JSON = 'recipes.json'
BUCKET_NAME = 'ckc-recipe-swipe.firebasestorage.app'

SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
})


def init_firebase():
    sa_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT')
    if sa_json:
        cred = credentials.Certificate(json.loads(sa_json))
    elif os.path.exists('service-account.json'):
        cred = credentials.Certificate('service-account.json')
    else:
        print('No Firebase credentials found.')
        print('Set FIREBASE_SERVICE_ACCOUNT env var or place service-account.json in project root.')
        sys.exit(1)
    firebase_admin.initialize_app(cred, {'storageBucket': BUCKET_NAME})
    return storage.bucket()


def slugify(text):
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'-+', '-', text)
    return text[:80].strip('-')


def is_storage_url(url):
    return bool(url and ('firebasestorage.googleapis.com' in url or 'storage.googleapis.com' in url))


def fetch_og_image_url(page_url):
    try:
        r = SESSION.get(page_url, timeout=12, allow_redirects=True)
        soup = BeautifulSoup(r.text, 'html.parser')
        tag = (soup.find('meta', property='og:image') or
               soup.find('meta', attrs={'name': 'og:image'}))
        if tag and tag.get('content'):
            return tag['content'].strip()
    except Exception as e:
        print(f'    ✗ fetch error: {e}')
    return None


def to_webp(source):
    """Convert image from bytes/path to WebP BytesIO. Returns None on failure."""
    try:
        img = Image.open(source if isinstance(source, str) else io.BytesIO(source))
        if img.mode in ('RGBA', 'LA', 'P'):
            img = img.convert('RGB')
        buf = io.BytesIO()
        img.save(buf, 'WEBP', quality=82, method=4)
        buf.seek(0)
        return buf
    except Exception as e:
        print(f'    ✗ webp conversion error: {e}')
        return None


def upload_to_storage(bucket, webp_buf, slug):
    try:
        blob = bucket.blob(f'images/{slug}.webp')
        blob.upload_from_file(webp_buf, content_type='image/webp')
        blob.make_public()
        return blob.public_url
    except Exception as e:
        print(f'    ✗ upload error: {e}')
        return None


def process_image(bucket, slug, page_url, local_path=None):
    """Try local file first, then scrape. Returns Firebase Storage URL or None."""

    # 1. Migrate existing local image
    if local_path and os.path.exists(local_path):
        print(f'    → migrating local image...')
        buf = to_webp(local_path)
        if buf:
            url = upload_to_storage(bucket, buf, slug)
            if url:
                print(f'    → uploaded ✓')
                return url

    # 2. Scrape from page
    if not page_url:
        return None
    og_url = fetch_og_image_url(page_url)
    if not og_url:
        print(f'    → no OG image found')
        return None
    try:
        r = SESSION.get(og_url, timeout=12, stream=True, allow_redirects=True)
        if not r.ok:
            print(f'    ✗ image HTTP {r.status_code}')
            return None
        buf = to_webp(r.content)
        if not buf:
            return None
        url = upload_to_storage(bucket, buf, slug)
        if url:
            print(f'    → scraped + uploaded ✓')
        return url
    except Exception as e:
        print(f'    ✗ scrape error: {e}')
        return None


def main():
    if not os.path.exists(CSV_FILE):
        print(f'Error: {CSV_FILE} not found.')
        sys.exit(1)

    bucket = init_firebase()

    with open(CSV_FILE, newline='', encoding='utf-8-sig') as f:
        rows = list(csv.DictReader(f))
    print(f'Loaded {len(rows)} rows from {CSV_FILE}\n')

    existing = {}
    if os.path.exists(OUTPUT_JSON):
        with open(OUTPUT_JSON, encoding='utf-8') as f:
            for r in json.load(f):
                existing[r['name']] = r
        print(f'{len(existing)} recipes already in {OUTPUT_JSON}\n')

    recipes = []
    new_count = 0

    for i, row in enumerate(rows):
        name           = (row.get('Recipe Title') or '').strip()
        url            = (row.get('URL') or '').strip()
        cuisine        = (row.get('Cuisine Style') or '').strip()
        course         = (row.get('Meal Type') or '').strip()
        description    = (row.get('Notes') or '').strip()
        blogger        = (row.get('Blogger Name') or '').strip()
        alignment      = (row.get('Alignment Score') or '').strip()
        rating         = (row.get('Rating') or '').strip()

        if not name:
            continue

        slug = slugify(name)
        ex   = existing.get(name)

        # Already has Firebase Storage URL — skip entirely
        if ex and is_storage_url(ex.get('image')):
            recipes.append(ex)
            print(f'[{i+1}/{len(rows)}] {name[:60]:<60} ✓')
            continue

        print(f'[{i+1}/{len(rows)}] {name[:60]}')
        new_count += 1

        local_path = ex.get('image') if ex else None
        image_url  = process_image(bucket, slug, url, local_path)

        if not image_url:
            print(f'    → no image')

        recipes.append({
            'name':           name,
            'url':            url,
            'blogger':        blogger,
            'alignmentScore': int(alignment) if alignment.isdigit() else (alignment or None),
            'cuisine':        cuisine,
            'course':         course,
            'description':    description,
            'rating':         rating,
            'image':          image_url,
        })

        # Save progress after every recipe so it's resumable
        with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
            json.dump(recipes, f, indent=2, ensure_ascii=False)

        time.sleep(0.6)

    with_images = sum(1 for r in recipes if r['image'])
    print(f'\n✓ Done!')
    print(f'  {len(recipes)} recipes written to {OUTPUT_JSON}')
    print(f'  {with_images}/{len(recipes)} have images')
    print(f'  {new_count} newly processed')


if __name__ == '__main__':
    main()
