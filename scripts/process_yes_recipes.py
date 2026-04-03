#!/usr/bin/env python3
"""
process_yes_recipes.py
======================
Processes YES recipes from rows 196-496 of Claude Recipe Index Connect (1).xlsx:
  1. Skips 2 duplicates already in recipes.json (by URL)
  2. Scrapes each URL: image, rating, ingredients, blogger
  3. Uploads image to Firebase Storage
  4. Generates missing Chef's Notes / Menu Descriptions via Claude API
  5. Uploads to Firestore 'decisions' (YES) and 'recipes' collections

Resume-safe: progress tracked in yes_process_progress.json

Usage:
  python3 process_yes_recipes.py
  python3 process_yes_recipes.py --dry-run
  python3 process_yes_recipes.py --limit 10
"""

import json, os, sys, re, time, argparse, io
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup
import pandas as pd
import firebase_admin
from firebase_admin import credentials, firestore as fs_module, storage
import anthropic

# ── Config ─────────────────────────────────────────────────────────────────────
SPREADSHEET   = 'Claude Recipe Index Connect (1).xlsx'
PROGRESS_FILE = 'yes_process_progress.json'
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

# ── Firebase init ──────────────────────────────────────────────────────────────
def init_firebase():
    if not firebase_admin._apps:
        cred = credentials.Certificate(SA_KEY)
        firebase_admin.initialize_app(cred, {'storageBucket': STORAGE_BUCKET})
    return fs_module.client(), storage.bucket()

# ── Diet tag columns ───────────────────────────────────────────────────────────
DIET_COLS = {
    'V':   {'native': 'V',   'mod': 'V.1',   'notes_col': 'Unnamed: 17'},
    'Vg':  {'native': 'Vg',  'mod': 'Vg.1',  'notes_col': 'Unnamed: 19'},
    'DF':  {'native': 'DF',  'mod': 'DF.1',  'notes_col': 'Unnamed: 21'},
    'LH':  {'native': 'LH',  'mod': 'LH.1',  'notes_col': 'Unnamed: 23'},
    'LF':  {'native': 'LF',  'mod': 'LF.1',  'notes_col': 'Unnamed: 25'},
    'AIP': {'native': 'AIP', 'mod': 'AIP.1', 'notes_col': 'Unnamed: 27'},
    'GF':  {'native': 'GF',  'mod': 'GF.1',  'notes_col': 'Unnamed: 29'},
    'K':   {'native': 'K',   'mod': 'K.1',   'notes_col': 'Unnamed: 31'},
}

def build_diet_tags(row):
    tags = {}
    for key, cols in DIET_COLS.items():
        native_val = row.get(cols['native'])
        mod_val    = row.get(cols['mod'])
        notes_val  = row.get(cols['notes_col'])
        is_native  = bool(native_val == 1 or native_val == 1.0)
        is_mod     = bool(mod_val    == 1 or mod_val    == 1.0)
        notes_str  = str(notes_val).strip() if pd.notna(notes_val) else ''
        if is_native or is_mod:
            tags[key] = {'native': is_native, 'mod': is_mod, 'notes': notes_str}
    return tags

# ── Scraping ───────────────────────────────────────────────────────────────────
def scrape_recipe_page(url):
    """Returns dict with keys: image_url, rating, rating_count, ingredients, blogger, description"""
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

        # og:image fallback
        og = soup.find('meta', property='og:image')
        if og and og.get('content', '').startswith('http'):
            result['image_url'] = og['content']

        # Blog name from og:site_name or domain
        site = soup.find('meta', property='og:site_name')
        if site and site.get('content'):
            result['blogger'] = site['content'].strip()
        else:
            domain = urlparse(url).netloc.replace('www.', '')
            parts = domain.split('.')
            result['blogger'] = parts[0].replace('-', ' ').title() if parts else domain

        # og:description
        og_desc = soup.find('meta', property='og:description') or soup.find('meta', attrs={'name': 'description'})
        if og_desc and og_desc.get('content'):
            result['description'] = og_desc['content'].strip()[:300]

        # JSON-LD: ingredients, rating, better image, author
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
                            # Ingredients
                            ings = node.get('recipeIngredient', [])
                            if ings:
                                result['ingredients'] = [str(i).strip() for i in ings if str(i).strip()]
                            # Image
                            img = node.get('image')
                            if img and not result['image_url']:
                                if isinstance(img, list): img = img[0]
                                if isinstance(img, dict): img = img.get('url', '')
                                if str(img).startswith('http'):
                                    result['image_url'] = str(img)
                            # Rating
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
                            # Author / blogger
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
    """Download image_url, upload to Firebase Storage, return public URL."""
    if not image_url:
        return ''
    try:
        resp = SESSION.get(image_url, timeout=15)
        if not resp.ok:
            return image_url  # fallback to original URL
        content_type = resp.headers.get('Content-Type', 'image/jpeg').split(';')[0]
        ext = 'webp' if 'webp' in content_type else ('png' if 'png' in content_type else 'jpg')
        slug = slugify(name)
        blob = bucket.blob(f'images/{slug}.{ext}')
        blob.upload_from_string(resp.content, content_type=content_type)
        blob.make_public()
        return blob.public_url
    except Exception as e:
        print(f'    image upload error: {e}')
        return image_url  # fallback

# ── Description generation ─────────────────────────────────────────────────────

# Load chef notes guide for prompt context
_CHEF_NOTES_GUIDE_PATH = os.path.join(os.path.dirname(__file__), 'CKC_Chef_Notes_Guide.md')
with open(_CHEF_NOTES_GUIDE_PATH) as _f:
    _CHEF_NOTES_GUIDE = _f.read()

MENU_DESC_EXAMPLES = """Menu Description examples (all lowercase, semicolons between components, no period):
- "chicken breast with roasted bell peppers, onions, and poblanos; frijoles de la olla made with fresh herbs, scallions and pinto beans; warm flour tortillas; creamy jalapeno verde sauce"
- "slow-cooked fresh halibut, topped with castelvatrano olives, parsley, served with stewed lentils and carrots, with whipped cauliflower and broccoli mash"
- "ground turkey, slow-cooked with chipotle and red bell peppers, with added apple butter, white beans, tomatoes, spinach, summer squash, and leeks, topped with sharp cheddar, green onion, and cilantro"
- "silky roasted beet and chickpea hummus garnished with aleppo pepper, za\'atar, and a drizzle of olive oil"
- "grilled fresh peaches over fluffy quinoa with cherry tomatoes, cucumber, red onion, and fresh herbs in a light citrus vinaigrette"
- "charred baby sweet peppers served alongside a creamy feta-studded tzatziki with fresh dill and cucumber" """

CHEF_NOTES_INSTRUCTIONS = """
VOICE: First person plural "We". Kitchen notebook tone. Include the "why" when it adds value.
MEASUREMENTS: Spices and acids in ranges (1/2-1 tsp, 1-3 tbsp). Temperatures in Fahrenheit with doneness cues.
COMPLEXITY: Match note count to dish complexity. Simple side = 1 note. Standard entree = 2-3. Multi-component = 4+.
FORMAT: Return notes as a single paragraph with notes separated by " | ". No bullet points, no headers, no bold, no diet protocol names.

NEVER mention: Gluten-Free, Dairy-Free, Vegan, Vegetarian, Keto, AIP, Low-FODMAP, Low-Histamine, or any diet compliance swaps.
NEVER use brand names.
NEVER write generic filler like "season to taste" or "use fresh ingredients."
"""

def generate_descriptions(client, name, cuisine, meal, ingredients, existing_notes, existing_desc):
    need_notes = not existing_notes or str(existing_notes).strip() in ('', 'nan')
    need_desc  = not existing_desc  or str(existing_desc).strip()  in ('', 'nan')
    if not need_notes and not need_desc:
        return existing_notes, existing_desc

    ing_str = ', '.join(ingredients[:12]) if ingredients else 'not available'

    # Build combined prompt
    parts = []
    if need_notes:
        parts.append(
            _CHEF_NOTES_GUIDE + "\n\n"
            + CHEF_NOTES_INSTRUCTIONS + "\n\n"
            + f"Recipe to write Chef's Notes for:\n"
            + f"Name: {name}\n"
            + f"Cuisine: {cuisine}\n"
            + f"Type: {meal}\n"
            + f"Key ingredients: {ing_str}\n\n"
            + "Generate Chef's Notes for this recipe. Follow the guide above exactly.\n"
            + "Reply: CHEFS_NOTES: [text]"
        )
    if need_desc:
        parts.append(
            MENU_DESC_EXAMPLES + "\n\n"
            + f"Recipe: {name} ({cuisine}, {meal})\n"
            + f"Key ingredients: {ing_str}\n\n"
            + "Generate a Menu Description.\n"
            + "Reply: MENU_DESC: [text]"
        )

    prompt = "\n\n---\n\n".join(parts)

    try:
        response = client.messages.create(
            model='claude-haiku-4-5-20251001',
            max_tokens=500,
            messages=[{'role': 'user', 'content': prompt}]
        )
        text = response.content[0].text
        notes_match = re.search(r'CHEFS_NOTES:\s*(.+)', text)
        desc_match  = re.search(r'MENU_DESC:\s*(.+)',   text)
        final_notes = notes_match.group(1).strip() if notes_match else (existing_notes or '')
        final_desc  = desc_match.group(1).strip()  if desc_match  else (existing_desc  or '')
        return final_notes, final_desc
    except Exception as e:
        print(f'    Claude API error: {e}')
        return existing_notes or '', existing_desc or ''

# ── Course / protein mapping ───────────────────────────────────────────────────
COURSE_MAP = {'Entrée': 'Entree', 'Side': 'Side', 'Soup': 'Soup', 'Sauce': 'Sauce',
              'Snack': 'Snack', 'Dessert': 'Dessert', 'Breakfast': 'Breakfast'}

# ── Load existing recipes.json for dup check ──────────────────────────────────
with open('recipes.json') as f:
    existing_recipes = json.load(f)
existing_urls = set(r.get('url', '').strip().rstrip('/') for r in existing_recipes if r.get('url'))

def normalize_url(url):
    return str(url).strip().rstrip('/') if pd.notna(url) else ''

# ── Load spreadsheet ───────────────────────────────────────────────────────────
df = pd.read_excel(SPREADSHEET, sheet_name='Index')
yes_df = df.iloc[194:495].copy()  # Excel rows 196-496

# Filter out duplicates and blank-URL rows
yes_df['norm_url'] = yes_df['Original Link'].apply(normalize_url)
to_process = yes_df[
    (yes_df['norm_url'] != '') &
    (~yes_df['norm_url'].isin(existing_urls))
].copy()

print(f'YES recipes in spreadsheet: {len(yes_df)}')
print(f'Duplicates skipped:          {len(yes_df) - len(to_process)}')
print(f'To process:                  {len(to_process)}')

if args.limit:
    to_process = to_process.head(args.limit)
    print(f'(Limited to {args.limit})')

# ── Load progress ──────────────────────────────────────────────────────────────
progress = {}
if os.path.exists(PROGRESS_FILE):
    with open(PROGRESS_FILE) as f:
        progress = json.load(f)
done_urls = set(progress.get('done', []))
failed_urls = set(progress.get('failed', []))

def save_progress():
    with open(PROGRESS_FILE, 'w') as f:
        json.dump({'done': list(done_urls), 'failed': list(failed_urls)}, f, indent=2)

# ── Main loop ──────────────────────────────────────────────────────────────────
if not args.dry_run:
    db, bucket = init_firebase()
    claude_client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env
else:
    db = bucket = claude_client = None

remaining = [row for _, row in to_process.iterrows() if row['norm_url'] not in done_urls]
print(f'Already done: {len(done_urls)}  |  Remaining: {len(remaining)}\n')

for i, row in enumerate(remaining):
    url  = row['norm_url']
    name = str(row.get('Name', '')).strip()
    if not name or name == 'nan':
        print(f'[{i+1}/{len(remaining)}] SKIP — no name at row')
        continue

    print(f'[{i+1}/{len(remaining)}] {name}')
    print(f'    URL: {url}')

    # ── Scrape ──
    scraped = scrape_recipe_page(url)
    time.sleep(SLEEP_SEC)

    # ── Upload image to Firebase Storage ──
    storage_image_url = ''
    if not args.dry_run and scraped['image_url']:
        print(f'    Uploading image...')
        storage_image_url = upload_image(bucket, name, scraped['image_url'])
    elif args.dry_run:
        storage_image_url = scraped['image_url']  # use original in dry-run

    # ── Build diet tags ──
    diet_tags = build_diet_tags(row)

    # ── Generate missing descriptions ──
    existing_notes = str(row.get("Chef's Notes", '') or '').strip()
    existing_desc  = str(row.get('Menu Description', '') or '').strip()
    if existing_notes == 'nan': existing_notes = ''
    if existing_desc  == 'nan': existing_desc  = ''

    if not args.dry_run:
        print(f'    Generating descriptions...')
        chef_notes, menu_desc = generate_descriptions(
            claude_client, name,
            str(row.get('Cuisine', '') or ''),
            str(row.get('Meal', '') or ''),
            scraped['ingredients'],
            existing_notes, existing_desc
        )
        time.sleep(0.3)
    else:
        chef_notes, menu_desc = existing_notes, existing_desc

    # ── Build record ──
    course  = COURSE_MAP.get(str(row.get('Meal', '')), str(row.get('Meal', '')))
    protein = str(row.get('Main Ingredient', '') or '').strip()
    if protein == 'nan': protein = ''
    cuisine = str(row.get('Cuisine', '') or '').strip()
    if cuisine == 'nan': cuisine = ''

    recipe_doc = {
        'name':           name,
        'url':            url,
        'status':         'yes',
        'cuisine':        cuisine,
        'course':         course,
        'description':    menu_desc,
        'chefsNotes':     chef_notes,
        'image':          storage_image_url or scraped['image_url'],
        'protein':        protein,
        'rating':         scraped['rating'],
        'blogger':        scraped['blogger'],
        'alignmentScore': None,
        'dietTags':       diet_tags,
        'ingredients':    scraped['ingredients'],
    }

    decision_doc = {
        'name':            name,
        'decision':        'YES',
        'url':             url,
        'blogger':         scraped['blogger'],
        'alignmentScore':  None,
        'protein':         protein,
        'mealType':        course,
        'cuisineStyle':    cuisine,
        'rating':          scraped['rating'],
        'notes':           menu_desc,
        'image':           storage_image_url or scraped['image_url'],
        'dietTags':        diet_tags,
        'complianceNotes': '',
        'chefsNotes':      chef_notes,
        'decidedAt':       fs_module.SERVER_TIMESTAMP if not args.dry_run else None,
    }

    if args.dry_run:
        print(f'    [DRY RUN] Would upload:')
        print(f'      blogger={recipe_doc["blogger"]}  rating={recipe_doc["rating"]}')
        print(f'      dietTags keys={list(diet_tags.keys())}')
        print(f'      chef_notes={chef_notes[:60]}...')
        print(f'      menu_desc={menu_desc[:60]}...')
        print(f'      ingredients={len(scraped["ingredients"])}')
    else:
        try:
            # Upload to 'recipes' collection
            db.collection('recipes').add(recipe_doc)
            # Upload to 'decisions' collection
            db.collection('decisions').add(decision_doc)
            done_urls.add(url)
            save_progress()
            print(f'    ✓ Uploaded to Firestore')
        except Exception as e:
            print(f'    ✗ Firestore error: {e}')
            failed_urls.add(url)
            save_progress()

print(f'\nDone. Processed {len(done_urls)} recipes.')
if failed_urls:
    print(f'Failed ({len(failed_urls)}): {list(failed_urls)[:5]}')
