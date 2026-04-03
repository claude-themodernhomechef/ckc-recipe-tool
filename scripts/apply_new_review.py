"""
apply_new_review.py
───────────────────
Applies Final Decision column from needs_review.csv back to Firestore.

After process_new_yes_recipes.py flags uncertain items:
  1. Open needs_review.csv in Numbers or Excel
  2. Fill in the "Final Decision" column for each row
  3. Save the file (as CSV or .numbers)
  4. Run: python3 apply_new_review.py

Decision format (same as needs_review.numbers workflow):
  "No"                    → mod: false, notes cleared
  "Yes"                   → no change needed (Claude was right)
  "Yes, natively"         → native: true, mod: false
  "Yes, remove X"         → Claude rewrites note with X removed
  "Yes, replace X with Y" → Claude rewrites note with swap applied

Once all decisions are applied for a recipe, processingStatus → complete.

Usage:
  python3 apply_new_review.py
  python3 apply_new_review.py --dry-run
  python3 apply_new_review.py --source path/to/file.csv    (default: needs_review.csv)
"""

import json, os, re, sys, time, csv, argparse
import anthropic
import firebase_admin
from firebase_admin import credentials, firestore as fs_module
from threading import Lock
from concurrent.futures import ThreadPoolExecutor, as_completed

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE             = os.path.dirname(os.path.abspath(__file__))
SA_KEY           = os.path.join(BASE, 'service-account.json')
NEEDS_REVIEW_CSV = os.path.join(BASE, 'needs_review.csv')
PROGRESS_FILE    = os.path.join(BASE, 'apply_new_review_progress.json')

# ── CLI ────────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument('--dry-run', action='store_true')
parser.add_argument('--source',  default=NEEDS_REVIEW_CSV)
parser.add_argument('--reset',   action='store_true')
args = parser.parse_args()

CONCURRENCY = 5

# ── API / Firebase ─────────────────────────────────────────────────────────────
env_text = open(os.path.join(BASE, 'functions', '.env')).read()
api_key  = re.search(r'ANTHROPIC_API_KEY=(.+)', env_text).group(1).strip()
client   = anthropic.Anthropic(api_key=api_key)

if not firebase_admin._apps:
    firebase_admin.initialize_app(credentials.Certificate(SA_KEY))
db = fs_module.client()

# ── Progress ───────────────────────────────────────────────────────────────────
save_lock = Lock()

def load_progress():
    if args.reset and os.path.exists(PROGRESS_FILE):
        os.remove(PROGRESS_FILE)
    if os.path.exists(PROGRESS_FILE):
        return json.load(open(PROGRESS_FILE))
    return {'done': []}

def save_progress(p):
    with save_lock:
        json.dump(p, open(PROGRESS_FILE, 'w'), indent=2)

# ── Read CSV (handles both .csv and .numbers via numbers-parser) ───────────────
def load_review_file(path):
    if path.endswith('.numbers'):
        try:
            from numbers_parser import Document
            doc  = Document(path)
            rows = [[str(c.value) if c.value is not None else ''
                     for c in row] for row in doc.sheets[0].tables[0].iter_rows()]
            return rows[0], rows[1:]
        except ImportError:
            print('numbers-parser not installed. Run: pip3 install numbers-parser')
            sys.exit(1)
    else:
        with open(path, newline='') as f:
            rows = list(csv.reader(f))
        return rows[0], rows[1:]

# ── Categorize decision ────────────────────────────────────────────────────────
def categorize(decision):
    d = decision.strip().lower()
    if not d:                        return 'EMPTY'
    if d in ('no', 'no.'):           return 'NO'
    if d.startswith('yes, nativ'):   return 'YES_NATIVE'
    if d in ('yes', 'yes.', 'yes '): return 'YES_KEEP'
    return 'YES_MODIFY'

# ── Firestore lookup ───────────────────────────────────────────────────────────
recipe_cache = {}
cache_lock   = Lock()

def find_recipe(name):
    with cache_lock:
        if name in recipe_cache:
            return recipe_cache[name]
    snap = db.collection('recipes').where('name', '==', name).where('status', '==', 'yes').limit(1).get()
    doc  = snap[0] if snap else None
    with cache_lock:
        recipe_cache[name] = doc
    return doc

# ── Note style examples for Claude ────────────────────────────────────────────
STYLE_EXAMPLES = """
Note style examples:
Replace 3 garlic cloves and 1/3 cup olive oil with 3 tablespoons garlic-infused oil. Use the remaining olive oil as needed for consistency.
Remove black pepper entirely. Remove dijon mustard entirely (fermented, high-histamine). Lemon can remain in moderate amounts. Recipe is otherwise low-histamine compliant with these removals.
Replace 1 cup white rice with 1 cup cauliflower rice. Replace warm pita or naan with butter lettuce wraps. All other ingredients remain unchanged.
Replace shallots and garlic with 2 tablespoons garlic-infused oil mixed into the glaze. The ginger, rice vinegar, bok choy, pork, and orange juice are all LF-compliant.
"""

REWRITE_SYSTEM = f"""You rewrite diet compliance modification notes for recipes.

Style rules:
- Imperative sentences: "Replace X with Y.", "Remove X entirely.", "Use X instead."
- Specific quantities when known
- Note what stays compliant: "All other ingredients are LF-compliant."
- Flowing paragraph, no bullet points, no headers, no protocol names in the text
- End with a period

{STYLE_EXAMPLES}

You receive the existing note and a final decision about one specific uncertain ingredient.
Rewrite the full note incorporating the decision. Keep all existing correct swaps intact."""

def rewrite_note(recipe, protocol, existing_note, decision, ingredient):
    for attempt in range(1, 4):
        try:
            resp = client.messages.create(
                model      = 'claude-sonnet-4-6',
                max_tokens = 400,
                system     = [{'type': 'text', 'text': REWRITE_SYSTEM, 'cache_control': {'type': 'ephemeral'}}],
                messages   = [{'role': 'user', 'content':
                    f'Recipe: {recipe}\nProtocol: {protocol}\n'
                    f'Flagged ingredient: {ingredient}\nFinal decision: {decision}\n\n'
                    f'Existing note:\n{existing_note}\n\nRewrite:'}],
            )
            return resp.content[0].text.strip()
        except Exception as e:
            if attempt == 3: raise
            time.sleep(attempt * 2)

# ── Process one row ────────────────────────────────────────────────────────────
def process_row(row, headers, index, total, progress):
    # Map columns by header name for robustness
    h = {v: i for i, v in enumerate(headers)}
    recipe   = row[h.get('Recipe', 1)].strip()
    protocol = row[h.get('Protocol', 2)].strip()
    decision = row[h.get('Final Decision', 4)].strip()
    reason   = row[h.get('Reason', 5)].strip()
    ingredt  = row[h.get('Ingredient Searched', 3)].strip()
    url      = row[h.get('URL', 7)].strip() if len(row) > 7 else ''

    label = f'[{index}/{total}] {recipe[:38]:<38} {protocol}'
    cat   = categorize(decision)

    if cat == 'EMPTY':
        print(f'{label} → SKIP (no decision yet)')
        return

    doc = find_recipe(recipe)
    if not doc:
        print(f'{label} → NOT FOUND in Firestore')
        progress['done'].append({'recipe': recipe, 'protocol': protocol, 'status': 'not_found'})
        save_progress(progress)
        return

    data      = doc.to_dict()
    diet_tags = dict(data.get('dietTags', {}))
    proto_tag = dict(diet_tags.get(protocol, {}))

    if cat == 'NO':
        proto_tag['mod']   = False
        proto_tag['notes'] = ''
        print(f'{label} → mod: false')

    elif cat == 'YES_NATIVE':
        proto_tag['native'] = True
        proto_tag['mod']    = False
        proto_tag['notes']  = ''
        print(f'{label} → native: true')

    elif cat == 'YES_KEEP':
        # Re-enable mod tag that was held as false
        proto_tag['mod'] = True
        print(f'{label} → mod confirmed (no change to notes)')

    elif cat == 'YES_MODIFY':
        existing_note = proto_tag.get('notes', '')
        new_note = rewrite_note(recipe, protocol, existing_note, decision, ingredt)
        proto_tag['mod']   = True
        proto_tag['notes'] = new_note
        print(f'{label} → rewritten')
        print(f'   {new_note[:100]}…')

    diet_tags[protocol] = proto_tag

    # Check if all uncertain items for this recipe are now resolved
    # If so, flip processingStatus → complete
    if not args.dry_run:
        update = {f'dietTags.{protocol}': proto_tag}

        # Check remaining unresolved rows for this recipe in the CSV
        # (done externally — just flip to complete when all decisions applied)
        doc.reference.update(update)

    progress['done'].append({'recipe': recipe, 'protocol': protocol, 'status': cat})
    save_progress(progress)

# ── After applying all decisions, flip complete recipes ───────────────────────
def finalize_complete_recipes(all_rows, headers, progress):
    """For each recipe where all pending_review rows now have decisions, set processingStatus: complete."""
    if args.dry_run:
        return

    h          = {v: i for i, v in enumerate(headers)}
    done_set   = {(r['recipe'], r['protocol']) for r in progress['done'] if r['status'] not in ('not_found', 'EMPTY')}
    by_recipe  = {}

    for row in all_rows:
        recipe   = row[h.get('Recipe', 1)].strip()
        protocol = row[h.get('Protocol', 2)].strip()
        decision = row[h.get('Final Decision', 4)].strip()
        if recipe not in by_recipe:
            by_recipe[recipe] = {'total': 0, 'resolved': 0}
        by_recipe[recipe]['total'] += 1
        if decision.strip():
            by_recipe[recipe]['resolved'] += 1

    for recipe, counts in by_recipe.items():
        if counts['total'] == counts['resolved']:
            doc = find_recipe(recipe)
            if doc and doc.to_dict().get('processingStatus') == 'pending_review':
                doc.reference.update({'processingStatus': 'complete'})
                print(f'  ✓ {recipe} → processingStatus: complete')

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    print(f'Apply New Review Decisions {"[DRY RUN]" if args.dry_run else ""}')

    if not os.path.exists(args.source):
        print(f'File not found: {args.source}')
        sys.exit(1)

    headers, rows = load_review_file(args.source)
    progress      = load_progress()
    done_set      = {(r['recipe'], r['protocol']) for r in progress['done']}

    # Only process rows that have a decision filled in and aren't already done
    todo = [r for r in rows
            if r[headers.index('Final Decision') if 'Final Decision' in headers else 4].strip()
            and (r[1].strip(), r[2].strip()) not in done_set]

    print(f'Total rows: {len(rows)} | With decisions: {len(todo)} | Already applied: {len(progress["done"])}\n')

    offset = len(progress['done'])

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as ex:
        futures = {
            ex.submit(process_row, row, headers, offset + i + 1, len(rows), progress): row
            for i, row in enumerate(todo)
        }
        for f in as_completed(futures):
            try:
                f.result()
            except Exception as e:
                row = futures[f]
                print(f'ERROR {row[1]} | {row[2]}: {e}')

    print('\nFinalizing complete recipes…')
    finalize_complete_recipes(rows, headers, progress)

    from collections import Counter
    cats = Counter(r['status'] for r in progress['done'])
    print('\n── Summary ──────────────────────────────────')
    for k, v in cats.most_common():
        print(f'  {k:<20} {v}')
    print(f'\n{"[DRY RUN — nothing written]" if args.dry_run else "Done."}')

if __name__ == '__main__':
    main()
