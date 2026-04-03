#!/usr/bin/env python3
"""
process_swipe_recipes.py
========================
Processes new swipe-queue recipes from rows 2-195 of Claude Recipe Index Connect (1).xlsx:
  1. Skips 7 duplicates already in recipes.json (by URL)
  2. Skips 18 rows with no URL
  3. Scrapes each URL: image, rating, ingredients, blogger
  4. Uploads image to Firebase Storage
  5. Adds scraped recipes to recipes.json (no diet tags — to be assigned after YES swipe)

Resume-safe: progress tracked in swipe_process_progress.json

Usage:
  python3 process_swipe_recipes.py
  python3 process_swipe_recipes.py --dry-run
  python3 process_swipe_recipes.py --limit 10
"""

import json, os, re, time, argparse
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup
import pandas as pd
import firebase_admin
from firebase_admin import credentials, storage

# ── Config ─────────────────────────────────────────────────────────────────────
SPREADSHEET   = 'Claude Recipe Index Connect (1).xlsx'
RECIPES_FILE  = 'recipes.json'
PROGRESS_FILE = 'swipe_process_progress.json'
SLEEP_SEC     = 0.8
SA_KEY        = 'service-account.json'
STORAGE_BUCKET= 'ckc-recipe-swipe.firebasestorage.app'

SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
})

# ── CLI args ───────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument('--dry-run', action='store_true')
parser.add_argument('--limit',   type=int, default=0)
args = parser.parse_args()

# ── Firebase init (storage only) ──────────────────────────────────────────────
def init_firebase():
    if not firebase_admin._apps:
        cred = credentials.Certificate(SA_KEY)
        firebase_admin.initialize_app(cred, {'storageBucket': STORAGE_BUCKET})
    return storage.bucket()

# ── Scraping ───────────────────────────────────────────────────────────────────
def scrape_recipe_page(url):
    result = {
        'image_url': '', 'rating': '', 'rating_count': 0,
        'ingredients': [], 'blogger': '', 'description': ''
    }
    try:
        resp = SESSION.get(url, timeout=15, allow_redirects=True)
        if not resp.ok:
            print(f'    HTTP {resp.status_code}')
            return result
        soup = BeautifulSoup(resp.text, 'html.parser')

        og = soup.find('meta', property='og:image')
        if og and og.get('content', '').startswith('http'):
            result['image_url'] = og['content']

        site = soup.find('meta', property='og:site_name')
        if site and site.get('content'):
            result['blogger'] = site['content'].strip()
        else:
            domain = urlparse(url).netloc.replace('www.', '')
            parts = domain.split('.')
            result['blogger'] = parts[0].replace('-', ' ').title() if parts else domain

        og_desc = soup.find('meta', property='og:description') or soup.find('meta', attrs={'name': 'description'})
        if og_desc and og_desc.get('content'):
            result['description'] = og_desc['content'].strip()[:300]

        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data = json.loads(script.string or '')
                items = data if isinstance(data, list) else [data]
                for item in items:
                    nodes = [item] + (item.get('@graph', []) if isinstance(item, dict) else [])
                    for node in nodes:
                        if not isinstance(node, dict):
                            continue
                        if node.get('@type') in ('Recipe', 'recipe'):
                            ings = node.get('recipeIngredient', [])
                            if ings:
                                result['ingredients'] = [str(i).strip() for i in ings if str(i).strip()]
                            img = node.get('image')
                            if img and not result['image_url']:
                                if isinstance(img, list): img = img[0]
                                if isinstance(img, dict): img = img.get('url', '')
                                if str(img).startswith('http'):
                                    result['image_url'] = str(img)
                            agg = node.get('aggregateRating', {})
                            if agg:
                                try:
                                    rv = float(str(agg.get('ratingValue') or '').strip())
                                    rc = int(str(agg.get('ratingCount') or agg.get('reviewCount') or '0').strip())
                                    if 0 < rv <= 5:
                                        result['rating'] = f'{rv} ({rc} ratings)' if rc else str(rv)
                                        result['rating_count'] = rc
                                except (ValueError, TypeError):
                                    pass
                            author = node.get('author')
                            if author and not result['blogger']:
                                if isinstance(author, dict):
                                    result['blogger'] = author.get('name', '')
                                elif isinstance(author, list) and author:
                                    result['blogger'] = author[0].get('name', '') if isinstance(author[0], dict) else str(author[0])
                                else:
                                    result['blogger'] = str(author)
            except Exception:
                continue
    except Exception as e:
        print(f'    scrape error: {e}')
    return result

def slugify(name):
    s = name.lower()
    s = re.sub(r'[^a-z0-9\s-]', '', s)
    s = re.sub(r'\s+', '-', s.strip())
    return s[:80]

def upload_image(bucket, name, image_url):
    if not image_url:
        return ''
    try:
        resp = SESSION.get(image_url, timeout=15)
        if not resp.ok:
            return image_url
        content_type = resp.headers.get('Content-Type', 'image/jpeg').split(';')[0]
        ext = 'webp' if 'webp' in content_type else ('png' if 'png' in content_type else 'jpg')
        slug = slugify(name)
        blob = bucket.blob(f'images/{slug}.{ext}')
        blob.upload_from_string(resp.content, content_type=content_type)
        blob.make_public()
        return blob.public_url
    except Exception as e:
        print(f'    image upload error: {e}')
        return image_url

# ── Course / protein mapping ───────────────────────────────────────────────────
COURSE_MAP = {'Entrée': 'Entree', 'Side': 'Side', 'Soup': 'Soup', 'Sauce': 'Sauce',
              'Snack': 'Snack', 'Dessert': 'Dessert', 'Breakfast': 'Breakfast'}

# ── Load existing recipes.json ─────────────────────────────────────────────────
with open(RECIPES_FILE) as f:
    existing_recipes = json.load(f)
existing_urls = set(r.get('url', '').strip().rstrip('/') for r in existing_recipes if r.get('url'))

def normalize_url(url):
    return str(url).strip().rstrip('/') if pd.notna(url) else ''

# ── Load spreadsheet ───────────────────────────────────────────────────────────
df = pd.read_excel(SPREADSHEET, sheet_name='Index')
swipe_df = df.iloc[0:194].copy()  # Excel rows 2-195

swipe_df['norm_url'] = swipe_df['Original Link'].apply(normalize_url)
to_process = swipe_df[
    (swipe_df['norm_url'] != '') &
    (~swipe_df['norm_url'].isin(existing_urls))
].copy()

print(f'Swipe recipes in spreadsheet: {len(swipe_df)}')
print(f'No URL / duplicates skipped:  {len(swipe_df) - len(to_process)}')
print(f'To process:                   {len(to_process)}')

if args.limit:
    to_process = to_process.head(args.limit)
    print(f'(Limited to {args.limit})')

# ── Load progress ──────────────────────────────────────────────────────────────
progress = {}
if os.path.exists(PROGRESS_FILE):
    with open(PROGRESS_FILE) as f:
        progress = json.load(f)
done_urls   = set(progress.get('done', []))
failed_urls = set(progress.get('failed', []))

def save_progress():
    with open(PROGRESS_FILE, 'w') as f:
        json.dump({'done': list(done_urls), 'failed': list(failed_urls)}, f, indent=2)

def save_recipes():
    with open(RECIPES_FILE, 'w') as f:
        json.dump(existing_recipes, f, indent=2, ensure_ascii=False)

# ── Firebase init ──────────────────────────────────────────────────────────────
if not args.dry_run:
    bucket = init_firebase()
else:
    bucket = None

remaining = [row for _, row in to_process.iterrows() if row['norm_url'] not in done_urls]
print(f'Already done: {len(done_urls)}  |  Remaining: {len(remaining)}\n')

for i, row in enumerate(remaining):
    url  = row['norm_url']
    name = str(row.get('Name', '')).strip()
    if not name or name == 'nan':
        print(f'[{i+1}/{len(remaining)}] SKIP — no name')
        continue

    print(f'[{i+1}/{len(remaining)}] {name}')
    print(f'    URL: {url}')

    scraped = scrape_recipe_page(url)
    time.sleep(SLEEP_SEC)

    storage_image_url = ''
    if not args.dry_run and scraped['image_url']:
        print(f'    Uploading image...')
        storage_image_url = upload_image(bucket, name, scraped['image_url'])
    elif args.dry_run:
        storage_image_url = scraped['image_url']

    course  = COURSE_MAP.get(str(row.get('Meal', '')), str(row.get('Meal', '')))
    protein = str(row.get('Main Ingredient', '') or '').strip()
    if protein == 'nan': protein = ''
    cuisine = str(row.get('Cuisine', '') or '').strip()
    if cuisine == 'nan': cuisine = ''

    new_recipe = {
        'name':           name,
        'url':            url,
        'cuisine':        cuisine,
        'course':         course,
        'description':    scraped['description'],
        'image':          storage_image_url or scraped['image_url'],
        'protein':        protein,
        'rating':         scraped['rating'],
        'blogger':        scraped['blogger'],
        'alignmentScore': None,
        'dietTags':       {},
        'ingredients':    scraped['ingredients'],
    }

    if args.dry_run:
        print(f'    [DRY RUN] Would add to recipes.json:')
        print(f'      blogger={new_recipe["blogger"]}  rating={new_recipe["rating"]}')
        print(f'      ingredients={len(scraped["ingredients"])}')
        print(f'      image={new_recipe["image"][:60]}...')
    else:
        existing_recipes.append(new_recipe)
        save_recipes()
        done_urls.add(url)
        save_progress()
        print(f'    ✓ Added to recipes.json')

print(f'\nDone. Added {len(done_urls)} new recipes to recipes.json.')
if failed_urls:
    print(f'Failed ({len(failed_urls)}): {list(failed_urls)[:5]}')
