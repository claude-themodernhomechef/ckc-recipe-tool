"""
apply_review_decisions.py
─────────────────────────
Applies final decisions from needs_review.numbers to Firestore diet tags.

Decision categories:
  NO           → mod: false, notes cleared
  YES_KEEP     → no change (Claude was already right)
  YES_NATIVE   → native: true, mod: false, notes cleared
  YES_MODIFY   → Claude rewrites existing note incorporating the decision, mod: true

Style: full explanatory sentences, specific quantities, what stays compliant.

Usage:
  python3 apply_review_decisions.py
  python3 apply_review_decisions.py --dry-run   (print changes, don't write)
  python3 apply_review_decisions.py --reset      (reprocess already-done items)
"""

import json, os, re, sys, time
import anthropic
import firebase_admin
from firebase_admin import credentials, firestore
from numbers_parser import Document
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

# ── Config ─────────────────────────────────────────────────────────────────────
BASE          = os.path.dirname(os.path.abspath(__file__))
NUMBERS_FILE  = os.path.join(BASE, 'needs_review.numbers')
PROGRESS_FILE = os.path.join(BASE, 'apply_review_progress.json')
SA_FILE       = os.path.join(BASE, 'service-account.json')
DRY_RUN       = '--dry-run' in sys.argv
RESET         = '--reset'   in sys.argv
CONCURRENCY   = 5

# ── API / Firebase ─────────────────────────────────────────────────────────────
env_text = open(os.path.join(BASE, 'functions', '.env')).read()
api_key  = re.search(r'ANTHROPIC_API_KEY=(.+)', env_text).group(1).strip()
client   = anthropic.Anthropic(api_key=api_key)

if not firebase_admin._apps:
    firebase_admin.initialize_app(credentials.Certificate(SA_FILE))
db = firestore.client()

# ── Progress ───────────────────────────────────────────────────────────────────
save_lock = Lock()

def load_progress():
    if not RESET and os.path.exists(PROGRESS_FILE):
        return json.load(open(PROGRESS_FILE))
    return {'done': []}

def save_progress(progress):
    with save_lock:
        json.dump(progress, open(PROGRESS_FILE, 'w'), indent=2)

# ── Style examples for Claude ──────────────────────────────────────────────────
STYLE_EXAMPLES = """
Examples of the correct note style:

Replace 3 garlic cloves and 1/3 cup of the olive oil with 3 tablespoons garlic-infused oil. Use the remaining olive oil (approximately 1 tablespoon) as needed for consistency.

Replace shallots and garlic cloves with 2 tablespoons garlic-infused oil (mixed into the glaze). The ginger, rice vinegar, bok choy, pork, orange juice, and brown sugar are all LF-compliant. Omit the whole orange halves from the pan to avoid consuming the high-FODMAP solids.

Remove black pepper entirely. Remove dijon mustard entirely (fermented, high-histamine). Remove or reduce parmesan (aged cheese, high-histamine). Lemon can remain in moderate amounts. Recipe is otherwise low-histamine compliant with these removals.

Replace 1 cup white rice with 1 cup cauliflower rice. Replace warm pita or naan with butter lettuce or iceberg lettuce wraps. All other ingredients remain unchanged.

Replace 60ml milk with 60ml unsweetened oat milk or full-fat canned coconut milk. Replace 20g butter with 20g olive oil or dairy-free butter.

Replace all-purpose flour with a 1:1 GF flour blend. Replace flour tortillas with corn tortillas or a GF variety.
"""

SYSTEM_PROMPT = f"""You rewrite diet compliance modification notes for recipes.

Style rules:
- Imperative sentences: "Replace X with Y.", "Remove X entirely.", "Use X instead of Y."
- Specific quantities when known (e.g., "Replace 2 garlic cloves with 1 tbsp garlic-infused oil")
- Note what stays compliant when helpful: "All other ingredients are LF-compliant."
- Multiple swaps as separate sentences in a flowing paragraph
- No bullet points, no headers, no markdown
- No mention of diet protocol names within the note text
- End with a period

{STYLE_EXAMPLES}

You will be given:
1. The existing note (already in the correct style)
2. A final decision about one specific flagged ingredient

Rewrite the full note incorporating the final decision. Keep all existing correct swaps. Only change the part relating to the flagged ingredient."""

# ── Read numbers file ──────────────────────────────────────────────────────────
def load_decisions():
    doc  = Document(NUMBERS_FILE)
    rows = [[str(cell.value) if cell.value is not None else '' for cell in row]
            for row in doc.sheets[0].tables[0].iter_rows()]
    headers = rows[0]  # Category, Recipe, Protocol, Ingredient Searched, Final Decision, Reason, Caution Products Found, URL
    items = []
    for r in rows[1:]:
        items.append({
            'category':            r[0].strip(),
            'recipe':              r[1].strip(),
            'protocol':            r[2].strip(),
            'ingredient_searched': r[3].strip(),
            'final_decision':      r[4].strip(),
            'reason':              r[5].strip(),
            'url':                 r[7].strip() if len(r) > 7 else '',
        })
    return items

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

# ── Claude: rewrite note ───────────────────────────────────────────────────────
def rewrite_note(recipe, protocol, existing_note, decision, ingredient):
    for attempt in range(1, 4):
        try:
            resp = client.messages.create(
                model      = 'claude-sonnet-4-6',
                max_tokens = 400,
                system     = [{'type': 'text', 'text': SYSTEM_PROMPT, 'cache_control': {'type': 'ephemeral'}}],
                messages   = [{
                    'role': 'user',
                    'content': (
                        f'Recipe: {recipe}\n'
                        f'Protocol: {protocol}\n'
                        f'Flagged ingredient: {ingredient}\n'
                        f'Final decision: {decision}\n\n'
                        f'Existing note:\n{existing_note}\n\n'
                        f'Rewrite the full note incorporating this decision:'
                    )
                }],
            )
            return resp.content[0].text.strip()
        except Exception as e:
            if attempt == 3: raise
            time.sleep(attempt * 2)

# ── Process one row ────────────────────────────────────────────────────────────
def process_item(item, index, total, progress):
    recipe   = item['recipe']
    protocol = item['protocol']
    decision = item['final_decision']
    label    = f'[{index}/{total}] {recipe[:38]:<38} {protocol}'
    cat      = categorize(decision)

    if cat == 'EMPTY':
        print(f'{label} → SKIP (no decision)')
        return

    doc = find_recipe(recipe)
    if not doc:
        print(f'{label} → NOT FOUND in Firestore')
        progress['done'].append({'recipe': recipe, 'protocol': protocol, 'status': 'not_found'})
        save_progress(progress)
        return

    diet_tags  = doc.to_dict().get('dietTags', {})
    proto_tag  = dict(diet_tags.get(protocol, {}))

    if cat == 'NO':
        # mod: false, clear notes
        proto_tag['mod']   = False
        proto_tag['notes'] = ''
        print(f'{label} → mod: false')

    elif cat == 'YES_NATIVE':
        # native: true, mod: false, clear notes
        proto_tag['native'] = True
        proto_tag['mod']    = False
        proto_tag['notes']  = ''
        print(f'{label} → native: true')

    elif cat == 'YES_KEEP':
        # No change needed
        print(f'{label} → no change')
        progress['done'].append({'recipe': recipe, 'protocol': protocol, 'status': 'no_change'})
        save_progress(progress)
        return

    elif cat == 'YES_MODIFY':
        existing_note = proto_tag.get('notes', '')
        new_note = rewrite_note(recipe, protocol, existing_note, decision, item['ingredient_searched'])
        proto_tag['mod']   = True
        proto_tag['notes'] = new_note
        print(f'{label} → rewritten')
        print(f'   {new_note[:100]}…')

    if not DRY_RUN:
        doc.reference.update({f'dietTags.{protocol}': proto_tag})

    progress['done'].append({'recipe': recipe, 'protocol': protocol, 'status': cat, 'decision': decision})
    save_progress(progress)

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    print(f'Apply Review Decisions {"[DRY RUN]" if DRY_RUN else ""}')
    print(f'Concurrency: {CONCURRENCY}\n')

    items    = load_decisions()
    progress = load_progress()
    done_set = {(r['recipe'], r['protocol']) for r in progress['done']}
    todo     = [i for i in items if (i['recipe'], i['protocol']) not in done_set and categorize(i['final_decision']) != 'EMPTY']

    print(f'Total: {len(items)} | Done: {len(progress["done"])} | Remaining: {len(todo)}\n')

    offset = len(progress['done'])

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as ex:
        futures = {
            ex.submit(process_item, item, offset + i + 1, len(items), progress): item
            for i, item in enumerate(todo)
        }
        for f in as_completed(futures):
            try:
                f.result()
            except Exception as e:
                item = futures[f]
                print(f'ERROR {item["recipe"]} | {item["protocol"]}: {e}')

    from collections import Counter
    cats = Counter(r.get('status') for r in progress['done'])
    print('\n── Summary ──────────────────────────────')
    for k, v in cats.most_common():
        print(f'  {k:<20} {v}')
    print(f'\n{"[DRY RUN — nothing written]" if DRY_RUN else "Done. Firestore updated."}')

if __name__ == '__main__':
    main()
