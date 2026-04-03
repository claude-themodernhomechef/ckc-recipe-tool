"""
process_new_yes_recipes.py
──────────────────────────
Full enrichment pipeline for newly-swiped YES recipes.

Finds all Firestore recipes with status='yes' and no 'chefNotes' field,
then for each:

  1. Scrapes full ingredients from the recipe URL
  2. Generates Chef's Notes + Menu Description  (Claude, prompt-cached)
  3. Verifies diet tags  (Claude + CKC_Diet_Compliance_Rules.md, prompt-cached)
  4. For uncertain tags → searches FIG product DB (329k products)
       - Compliant product found  → tag confirmed
       - Caution only / not found → flagged for manual review
  5. Routes:
       - No uncertainties  → write to Firestore immediately  (processingStatus: complete)
       - Has uncertainties → append to needs_review.csv, hold (processingStatus: pending_review)

After you fill in the Final Decision column in needs_review.csv and return it:
  → python3 apply_new_review.py

Usage:
  python3 process_new_yes_recipes.py
  python3 process_new_yes_recipes.py --dry-run
  python3 process_new_yes_recipes.py --limit 5
"""

import json, os, re, sys, time, csv, argparse
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
import anthropic
import firebase_admin
from firebase_admin import credentials, firestore as fs_module, storage

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE             = os.path.dirname(os.path.abspath(__file__))
SA_KEY           = os.path.join(BASE, 'service-account.json')
RULES_PATH       = os.path.join(BASE, 'CKC_Diet_Compliance_Rules.md')
CHEF_GUIDE_PATH  = os.path.join(BASE, 'CKC_Chef_Notes_Guide.md')
PRODUCTS_FILE    = '/Users/rafi/Desktop/Claude-MHC/Fig Scraper/ckc_products_cleaned_2026-03-29.json'
PROGRESS_FILE    = os.path.join(BASE, 'process_new_progress.json')
NEEDS_REVIEW_CSV = os.path.join(BASE, 'needs_review.csv')
STORAGE_BUCKET   = 'ckc-recipe-swipe.firebasestorage.app'

# ── CLI args ───────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument('--dry-run', action='store_true')
parser.add_argument('--limit',   type=int, default=0)
parser.add_argument('--reset',   action='store_true')
args = parser.parse_args()

CONCURRENCY = 3

# ── API / Firebase ─────────────────────────────────────────────────────────────
env_text = open(os.path.join(BASE, 'functions', '.env')).read()
api_key  = re.search(r'ANTHROPIC_API_KEY=(.+)', env_text).group(1).strip()
client   = anthropic.Anthropic(api_key=api_key)

if not firebase_admin._apps:
    firebase_admin.initialize_app(
        credentials.Certificate(SA_KEY),
        {'storageBucket': STORAGE_BUCKET}
    )
db     = fs_module.client()
bucket = storage.bucket()

# ── Load static files ──────────────────────────────────────────────────────────
DIET_RULES  = open(RULES_PATH).read()
CHEF_GUIDE  = open(CHEF_GUIDE_PATH).read()

MENU_DESC_EXAMPLES = """Menu Description examples (all lowercase, semicolons between components of the same dish, no period):
- "pan-seared salmon over garlic butter orzo with roasted cherry tomatoes and fresh basil"
- "ground turkey slow-cooked with chipotle and red bell peppers, topped with sharp cheddar, green onion, and cilantro"
- "silky roasted beet and chickpea hummus garnished with aleppo pepper, za'atar, and a drizzle of olive oil"
- "grilled fresh peaches over fluffy quinoa with cherry tomatoes, cucumber, red onion, and fresh herbs in a light citrus vinaigrette"
- "crispy pan-fried chicken thighs glazed with honey, soy, and garlic over jasmine rice with scallions"""

# ── FIG product DB ─────────────────────────────────────────────────────────────
print('Loading FIG product database…')
PRODUCTS = json.load(open(PRODUCTS_FILE))
print(f'Products loaded: {len(PRODUCTS):,}\n')

# ── Protocol → FIG field ───────────────────────────────────────────────────────
PROTO_FIELD = {
    'AIP': 'aip_friendly',
    'LF':  'low_fodmap',
    'GF':  'gluten_free',
    'DF':  'dairy_free',
    'Vg':  'vegan',
    'V':   'vegetarian',
    'LH':  'low_histamine',
    'K':   None,
}

# ── Progress / CSV locks ───────────────────────────────────────────────────────
save_lock = Lock()
csv_lock  = Lock()

def load_progress():
    if args.reset and os.path.exists(PROGRESS_FILE):
        os.remove(PROGRESS_FILE)
    if os.path.exists(PROGRESS_FILE):
        return json.load(open(PROGRESS_FILE))
    return {'done': []}

def save_progress(progress):
    with save_lock:
        json.dump(progress, open(PROGRESS_FILE, 'w'), indent=2)

# ── needs_review.csv ──────────────────────────────────────────────────────────
CSV_HEADERS = ['Category', 'Recipe', 'Protocol', 'Ingredient Searched',
               'Final Decision', 'Reason', 'Caution Products Found', 'URL']

def init_csv():
    """Create CSV with headers if it doesn't exist."""
    if not os.path.exists(NEEDS_REVIEW_CSV):
        with open(NEEDS_REVIEW_CSV, 'w', newline='') as f:
            csv.writer(f).writerow(CSV_HEADERS)

def append_to_csv(rows):
    """Append uncertain items to the growing needs_review.csv."""
    with csv_lock:
        with open(NEEDS_REVIEW_CSV, 'a', newline='') as f:
            writer = csv.writer(f)
            for r in rows:
                # Skip if this recipe+protocol combo already exists in CSV
                writer.writerow(r)

def recipe_in_csv(recipe_name, protocol):
    """Check if this recipe+protocol is already in the CSV."""
    if not os.path.exists(NEEDS_REVIEW_CSV):
        return False
    with open(NEEDS_REVIEW_CSV, 'r') as f:
        for row in csv.reader(f):
            if len(row) >= 3 and row[1] == recipe_name and row[2] == protocol:
                return True
    return False

# ── HTTP session ───────────────────────────────────────────────────────────────
SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
})

# ── Step 1: Scrape ingredients ─────────────────────────────────────────────────
def scrape_recipe_page(url):
    result = {'image_url': '', 'rating': '', 'ingredients': [], 'blogger': '', 'description': ''}
    try:
        resp = SESSION.get(url, timeout=15, allow_redirects=True)
        if not resp.ok:
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
            result['blogger'] = domain.split('.')[0].replace('-', ' ').title()

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
                                except (ValueError, TypeError):
                                    pass
            except Exception:
                continue
    except Exception as e:
        print(f'  ⚠ Scrape error: {e}')
    return result

# ── Image upload ───────────────────────────────────────────────────────────────
def upload_image(image_url, recipe_name):
    if not image_url or args.dry_run:
        return image_url
    try:
        resp = SESSION.get(image_url, timeout=15)
        resp.raise_for_status()
        content_type = resp.headers.get('Content-Type', 'image/jpeg').split(';')[0]
        ext = {'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
               'image/webp': 'webp'}.get(content_type, 'jpg')
        safe_name = re.sub(r'[^a-zA-Z0-9-]', '-', recipe_name.lower())[:60]
        blob = bucket.blob(f'images/{safe_name}-{int(time.time())}.{ext}')
        blob.upload_from_string(resp.content, content_type=content_type)
        blob.make_public()
        return blob.public_url
    except Exception as e:
        print(f'  ⚠ Image upload failed: {e}')
        return image_url

# ── Step 2: Chef's Notes + Menu Description ────────────────────────────────────
CHEF_SYSTEM = f"""{CHEF_GUIDE}

{MENU_DESC_EXAMPLES}

For a given recipe, generate:
1. Chef's Notes — practical cooking tips following the guide above. Return as a single paragraph, notes separated by " | ". No bullet points, no headers, no diet protocol names.
2. Menu Description — a single lowercase phrase describing the dish (no period).

Reply in this exact format:
CHEFS_NOTES: [notes text]
---
MENU_DESC: [description text]"""

def generate_chef_content(name, cuisine, course, ingredients):
    ing_str = ', '.join(ingredients) if ingredients else 'not available'
    for attempt in range(1, 4):
        try:
            resp = client.messages.create(
                model      = 'claude-sonnet-4-6',
                max_tokens = 600,
                system     = [{'type': 'text', 'text': CHEF_SYSTEM, 'cache_control': {'type': 'ephemeral'}}],
                messages   = [{'role': 'user', 'content':
                    f'Recipe: {name} ({cuisine or "–"}, {course or "–"})\nKey ingredients: {ing_str}\n\nGenerate Chef\'s Notes and Menu Description.'}],
            )
            text       = resp.content[0].text
            notes_m    = re.search(r'CHEFS_NOTES:\s*([\s\S]+?)(?=\n---|$)', text)
            desc_m     = re.search(r'MENU_DESC:\s*([\s\S]+?)(?=\n---|$)',   text)
            return (
                notes_m.group(1).strip() if notes_m else '',
                desc_m.group(1).strip()  if desc_m  else '',
            )
        except Exception as e:
            if attempt == 3: raise
            time.sleep(attempt * 2)

# ── Step 3: Diet tag verification ─────────────────────────────────────────────
DIET_SYSTEM = f"""You are a dietary compliance analyst for a recipe app.

<COMPLIANCE_RULES>
{DIET_RULES}
</COMPLIANCE_RULES>

Analyze all 8 protocols (GF, DF, V, Vg, K, AIP, LF, LH) and return:
- native: true if recipe is compliant AS-IS
- mod: true if recipe can be made compliant with simple targeted swaps (only if native=false)
- notes: specific swap instructions in this style — full explanatory sentences with specific quantities, what stays compliant. E.g. "Replace 2 garlic cloves with 1 tbsp garlic-infused oil. All other ingredients are LF-compliant." (only if mod=true)
- uncertain: true if less than 100% confident due to ambiguous ingredients or missing context
- reason: explain the uncertainty and name the specific uncertain ingredient (only if uncertain=true)

Rules:
- If native=true, then mod=false and notes=""
- Only tag mod=true when there's a clear swap path that doesn't destroy the dish
- Be conservative: when in doubt, mark uncertain=true
- For AIP: if 4+ core ingredients need removal, set mod=false
- For LF: garlic-infused oil IS compliant; plain garlic is NOT

Reply ONLY with valid JSON:
{{"GF":{{"native":bool,"mod":bool,"notes":"","uncertain":bool,"reason":""}},"DF":{{"native":bool,"mod":bool,"notes":"","uncertain":bool,"reason":""}},"V":{{"native":bool,"mod":bool,"notes":"","uncertain":bool,"reason":""}},"Vg":{{"native":bool,"mod":bool,"notes":"","uncertain":bool,"reason":""}},"K":{{"native":bool,"mod":bool,"notes":"","uncertain":bool,"reason":""}},"AIP":{{"native":bool,"mod":bool,"notes":"","uncertain":bool,"reason":""}},"LF":{{"native":bool,"mod":bool,"notes":"","uncertain":bool,"reason":""}},"LH":{{"native":bool,"mod":bool,"notes":"","uncertain":bool,"reason":""}}}}"""

def verify_diet_tags(name, cuisine, course, ingredients):
    ing_str = '\n'.join(ingredients) if ingredients else 'not available'
    for attempt in range(1, 4):
        try:
            resp = client.messages.create(
                model      = 'claude-sonnet-4-6',
                max_tokens = 2000,
                system     = [{'type': 'text', 'text': DIET_SYSTEM, 'cache_control': {'type': 'ephemeral'}}],
                messages   = [{'role': 'user', 'content':
                    f'Recipe: {name}\nCuisine: {cuisine or "–"}\nCourse: {course or "–"}\nIngredients:\n{ing_str}'}],
            )
            text = resp.content[0].text.strip()
            text = re.sub(r'^```json\s*', '', text)
            text = re.sub(r'\s*```$', '', text)
            return json.loads(text)
        except Exception as e:
            if attempt == 3: raise
            time.sleep(attempt * 2)

# ── Step 4: FIG product search ─────────────────────────────────────────────────
def get_compliance(product, protocol):
    if protocol == 'K':
        sf = product.get('sugar_free', 'unknown')
        pa = product.get('paleo',      'unknown')
        if sf == 'compliant' and pa == 'compliant':        return 'compliant'
        if sf == 'not_compliant' or pa == 'not_compliant': return 'not_compliant'
        return 'caution'
    field = PROTO_FIELD.get(protocol)
    return product.get(field, 'unknown') if field else 'unknown'

def search_fig_products(ingredient, protocol):
    q = ingredient.lower().strip()
    results = {'compliant': [], 'caution': [], 'not_compliant': []}
    for p in PRODUCTS:
        if q in p['name'].lower():
            status = get_compliance(p, protocol)
            if status in results:
                results[status].append(p['name'])
    return results

def extract_uncertain_ingredient(reason):
    """Use Claude Haiku to extract the specific uncertain ingredient from the reason text."""
    for attempt in range(1, 4):
        try:
            resp = client.messages.create(
                model      = 'claude-haiku-4-5-20251001',
                max_tokens = 50,
                system     = [{'type': 'text', 'text':
                    'Extract the single most specific problematic ingredient name from a diet compliance uncertainty note. '
                    'Return ONLY the ingredient name — 1 to 4 words, lowercase. '
                    'If no specific ingredient (e.g. serving size uncertainty), return: SKIP',
                    'cache_control': {'type': 'ephemeral'}}],
                messages   = [{'role': 'user', 'content': f'Reason: {reason}\n\nIngredient name:'}],
            )
            text = resp.content[0].text.strip().lower()
            text = re.sub(r'[^a-z0-9\s\-\']', '', text).strip()
            return None if text == 'skip' or not text else text
        except Exception as e:
            if attempt == 3: return None
            time.sleep(attempt * 1.5)

# ── Main pipeline per recipe ───────────────────────────────────────────────────
def process_recipe(doc, index, total, progress):
    data    = doc.to_dict()
    name    = data.get('name', '')
    url     = data.get('url',  '')
    cuisine = data.get('cuisine', '')
    course  = data.get('course',  '')
    label   = f'[{index}/{total}] {name[:45]:<45}'

    print(f'{label} starting…')

    # ── 1. Scrape ingredients ──────────────────────────────────────────────────
    scraped      = scrape_recipe_page(url)
    ingredients  = scraped['ingredients']
    if not ingredients:
        print(f'{label} ⚠ no ingredients scraped — skipping')
        progress['done'].append({'id': doc.id, 'name': name, 'status': 'no_ingredients'})
        save_progress(progress)
        return

    # Use scraped image/blogger/rating if Firestore is missing them
    image_url = data.get('image') or scraped['image_url']
    if image_url and not data.get('image'):
        image_url = upload_image(image_url, name)

    # ── 2. Chef's Notes + Menu Description ────────────────────────────────────
    chef_notes, menu_desc = generate_chef_content(name, cuisine, course, ingredients)
    print(f'{label} chef notes ✓')

    # ── 3. Diet tag verification ───────────────────────────────────────────────
    diet_result = verify_diet_tags(name, cuisine, course, ingredients)
    print(f'{label} diet tags ✓')

    # ── 4. FIG product search for uncertain tags ───────────────────────────────
    confirmed_tags  = {}
    uncertain_items = []

    for proto, result in diet_result.items():
        if not result.get('native') and not result.get('mod'):
            # Not tagged at all — skip
            continue

        if not result.get('uncertain'):
            # Confident — keep as-is
            tag = {'native': result['native'], 'mod': result['mod']}
            if result.get('notes'):
                tag['notes'] = result['notes']
            confirmed_tags[proto] = tag
            continue

        # Uncertain — search FIG products
        reason     = result.get('reason', '')
        ingredient = extract_uncertain_ingredient(reason)

        if ingredient:
            matches = search_fig_products(ingredient, proto)
            if matches['compliant']:
                # Compliant product found — confirm the tag
                tag = {'native': result['native'], 'mod': result['mod']}
                if result.get('notes'):
                    tag['notes'] = result['notes']
                confirmed_tags[proto] = tag
                print(f'{label} {proto} uncertain → compliant product found ({ingredient})')
            elif matches['caution']:
                # Only caution products — flag for review
                caution_names = ' | '.join(matches['caution'][:3])
                uncertain_items.append({
                    'category':   'grey_area',
                    'recipe':     name,
                    'protocol':   proto,
                    'ingredient': ingredient,
                    'reason':     reason,
                    'caution':    caution_names,
                    'url':        url,
                })
                # Hold tag as mod: false until reviewed
                confirmed_tags[proto] = {'native': False, 'mod': False, 'notes': ''}
                print(f'{label} {proto} → grey area ({ingredient}) — needs review')
            else:
                # No product found — flag for review
                uncertain_items.append({
                    'category':   'no_product_found',
                    'recipe':     name,
                    'protocol':   proto,
                    'ingredient': ingredient,
                    'reason':     reason,
                    'caution':    '',
                    'url':        url,
                })
                confirmed_tags[proto] = {'native': False, 'mod': False, 'notes': ''}
                print(f'{label} {proto} → no product found ({ingredient}) — needs review')
        else:
            # Can't extract ingredient — flag for review
            uncertain_items.append({
                'category':   'needs_clarification',
                'recipe':     name,
                'protocol':   proto,
                'ingredient': '',
                'reason':     reason,
                'caution':    '',
                'url':        url,
            })
            confirmed_tags[proto] = {'native': False, 'mod': False, 'notes': ''}
            print(f'{label} {proto} → needs clarification — needs review')

    # ── 5. Append uncertain items to growing needs_review.csv ─────────────────
    if uncertain_items:
        csv_rows = []
        for u in uncertain_items:
            if not recipe_in_csv(u['recipe'], u['protocol']):
                csv_rows.append([
                    u['category'], u['recipe'], u['protocol'], u['ingredient'],
                    '',  # Final Decision — user fills this in
                    u['reason'], u['caution'], u['url'],
                ])
        if csv_rows:
            append_to_csv(csv_rows)
            print(f'{label} {len(csv_rows)} uncertain item(s) → needs_review.csv')

    # ── 6. Write to Firestore ──────────────────────────────────────────────────
    processing_status = 'pending_review' if uncertain_items else 'complete'

    update = {
        'chefNotes':        chef_notes,
        'menuDescription':  menu_desc,
        'ingredients':      ingredients,
        'dietTags':         confirmed_tags,
        'processingStatus': processing_status,
    }
    if image_url:
        update['image'] = image_url
    if scraped.get('rating') and not data.get('rating'):
        update['rating'] = scraped['rating']
    if scraped.get('blogger') and not data.get('blogger'):
        update['blogger'] = scraped['blogger']

    if not args.dry_run:
        doc.reference.update(update)

    status_label = '✓ complete' if processing_status == 'complete' else '⏳ pending review'
    print(f'{label} {status_label}')

    progress['done'].append({'id': doc.id, 'name': name, 'status': processing_status})
    save_progress(progress)

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    print(f'CKC New YES Recipe Pipeline {"[DRY RUN]" if args.dry_run else ""}')
    print(f'Concurrency: {CONCURRENCY}\n')

    init_csv()

    # Find unprocessed YES recipes (status=yes, no chefNotes field)
    snap = db.collection('recipes').where('status', '==', 'yes').get()
    all_docs = [d for d in snap if not d.to_dict().get('chefNotes')]

    progress = load_progress()
    done_ids = {r['id'] for r in progress['done']}
    todo     = [d for d in all_docs if d.id not in done_ids]

    if args.limit:
        todo = todo[:args.limit]

    print(f'Unprocessed YES recipes: {len(all_docs)} | Done: {len(done_ids)} | Remaining: {len(todo)}\n')

    if not todo:
        print('Nothing to process.')
        return

    offset = len(progress['done'])

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as ex:
        futures = {
            ex.submit(process_recipe, doc, offset + i + 1, len(all_docs), progress): doc
            for i, doc in enumerate(todo)
        }
        for f in as_completed(futures):
            try:
                f.result()
            except Exception as e:
                doc = futures[f]
                print(f'ERROR {doc.to_dict().get("name","?")}: {e}')

    from collections import Counter
    cats = Counter(r['status'] for r in progress['done'])
    print('\n── Summary ──────────────────────────────────')
    for k, v in cats.most_common():
        print(f'  {k:<25} {v}')
    if os.path.exists(NEEDS_REVIEW_CSV):
        with open(NEEDS_REVIEW_CSV) as f:
            n = sum(1 for _ in f) - 1  # subtract header
        if n > 0:
            print(f'\n  needs_review.csv: {n} items pending your review')
            print(f'  → Fill in "Final Decision" column and run: python3 apply_new_review.py')
    print(f'\n{"[DRY RUN — nothing written]" if args.dry_run else "Done."}')

if __name__ == '__main__':
    main()
