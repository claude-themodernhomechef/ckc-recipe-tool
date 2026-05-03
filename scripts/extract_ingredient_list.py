#!/usr/bin/env python3
"""
extract_ingredient_list.py
==========================
Step 1 of the nutrition pipeline.

Pulls all approved recipes from Firestore, extracts every ingredient string,
uses Claude API to parse out just the ingredient name (no quantities, units,
or prep notes), deduplicates, and saves:

  - ingredient_master_list.csv  → for your review
  - ingredient_master_list.json → used by the next script (build_nutrition_db.py)

Resume-safe: if ingredient_master_list.json already exists, skips re-parsing
and just regenerates the CSV from it.

Usage:
  python3 scripts/extract_ingredient_list.py
  python3 scripts/extract_ingredient_list.py --dry-run   # preview counts only
  python3 scripts/extract_ingredient_list.py --force     # re-parse everything
"""

import json, os, sys, time, argparse, csv, re
import firebase_admin
from firebase_admin import credentials, firestore as fs_module
import anthropic

# ── Config ────────────────────────────────────────────────────────────────────
BASE            = os.path.dirname(os.path.abspath(__file__))
SA_KEY          = 'service-account.json'
OUTPUT_JSON     = 'ingredient_master_list.json'
OUTPUT_CSV      = 'ingredient_master_list.csv'
BATCH_SIZE      = 60    # ingredient strings sent to Claude per API call
SLEEP_BETWEEN   = 0.3   # seconds between Claude API calls

# ── Args ──────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument('--dry-run', action='store_true', help='Print stats only, no files written')
parser.add_argument('--force',   action='store_true', help='Re-parse even if output JSON exists')
args = parser.parse_args()

# ── Firebase init ─────────────────────────────────────────────────────────────
def init_firebase():
    sa_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT', '')
    if sa_json:
        cred = credentials.Certificate(json.loads(sa_json))
    elif os.path.exists(SA_KEY):
        cred = credentials.Certificate(SA_KEY)
    else:
        print('ERROR: No Firebase credentials found. Need service-account.json')
        sys.exit(1)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    return fs_module.client()

# ── Claude API init ───────────────────────────────────────────────────────────
api_key = os.environ.get('ANTHROPIC_API_KEY', '')
if not api_key:
    env_path = os.path.join(BASE, 'functions', '.env')
    if os.path.exists(env_path):
        m = re.search(r'ANTHROPIC_API_KEY=(.+)', open(env_path).read())
        if m:
            api_key = m.group(1).strip()
if not api_key:
    print('ERROR: ANTHROPIC_API_KEY not found in env or functions/.env')
    sys.exit(1)
claude = anthropic.Anthropic(api_key=api_key)

# ── Parse ingredient names via Claude ─────────────────────────────────────────
def parse_ingredient_names(raw_strings: list[str]) -> list[dict]:
    """
    Sends a batch of raw ingredient strings to Claude.
    Returns a list of dicts: { raw, name, note }
      - raw:  the original string
      - name: the cleaned ingredient name only
      - note: any flag Claude raised (e.g. "ambiguous", "compound", "to taste")
    """
    numbered = "\n".join(f"{i+1}. {s}" for i, s in enumerate(raw_strings))

    prompt = f"""You are processing recipe ingredient strings into a clean ingredient database.

For each numbered ingredient string below, extract ONLY the core ingredient name.
Remove all of the following:
- Quantities and measurements (1/2 cup, 2 tablespoons, 3 lbs, etc.)
- Units (cup, tbsp, tsp, oz, g, kg, lb, bunch, sprig, clove, etc.)
- Preparation notes (minced, diced, chopped, roasted, to taste, etc.)
- Parenthetical clarifications ((from 3 limes), (about 2 cups), etc.)
- Brand qualifiers (store-bought, homemade, etc.) — keep only the base ingredient
- "for serving", "optional", "or more to taste" etc.

RULES:
1. If the string contains multiple distinct ingredients (e.g. "salt and pepper"), split them and return each on its own line as: NUMBER.a, NUMBER.b
2. If the quantity is unmeasurable ("to taste", "pinch", "splash", "as needed"), still return the ingredient name but add flag: [TO_TASTE]
3. If you cannot confidently identify the ingredient (too vague like "broth" without type, "oil" without type), return your best guess and add flag: [AMBIGUOUS]
4. Return ingredient names in their simplest form: "lime juice" not "fresh-squeezed lime juice"
5. Use lowercase

Respond in this exact JSON format — an array, one object per input line:
[
  {{"num": "1", "name": "lime juice", "flag": ""}},
  {{"num": "2", "name": "kosher salt", "flag": "TO_TASTE"}},
  {{"num": "3.a", "name": "salt", "flag": ""}},
  {{"num": "3.b", "name": "black pepper", "flag": ""}}
]

Ingredient strings to process:
{numbered}

Return only the JSON array, no explanation."""

    response = claude.messages.create(
        model='claude-haiku-4-5-20251001',
        max_tokens=4096,
        messages=[{'role': 'user', 'content': prompt}]
    )

    raw_json = response.content[0].text.strip()
    # Strip markdown code fences if present
    raw_json = re.sub(r'^```(?:json)?\s*', '', raw_json)
    raw_json = re.sub(r'\s*```$', '', raw_json)

    parsed = json.loads(raw_json)
    return parsed

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    # ── Step 1: Load existing output if available ──────────────────────────────
    if os.path.exists(OUTPUT_JSON) and not args.force:
        print(f'Found existing {OUTPUT_JSON} — skipping re-parse (use --force to redo)')
        with open(OUTPUT_JSON) as f:
            master = json.load(f)
        write_csv(master)
        print(f'Regenerated {OUTPUT_CSV} with {len(master)} ingredients')
        return

    # ── Step 2: Pull all recipes from Firestore ────────────────────────────────
    print('Connecting to Firestore...')
    db = init_firebase()

    print('Fetching all recipes...')
    docs = db.collection('recipes').get()
    recipes = [(d.id, d.to_dict()) for d in docs]
    print(f'Found {len(recipes)} recipes')

    # ── Step 3: Collect all raw ingredient strings ────────────────────────────
    raw_to_recipes = {}   # raw string → list of recipe names that use it
    for doc_id, data in recipes:
        ingredients = data.get('ingredients', [])
        recipe_name = data.get('name', doc_id)
        for ing in ingredients:
            if not isinstance(ing, str):
                continue
            ing = ing.strip()
            if not ing:
                continue
            if ing not in raw_to_recipes:
                raw_to_recipes[ing] = []
            raw_to_recipes[ing].append(recipe_name)

    all_raw = list(raw_to_recipes.keys())
    print(f'Total raw ingredient strings: {len(all_raw)}')
    print(f'(These are across all recipes, before deduplication)')

    if args.dry_run:
        print('\n[DRY RUN] No files written. Stats above.')
        return

    # ── Step 4: Parse in batches via Claude ───────────────────────────────────
    print(f'\nParsing ingredient names via Claude (batch size: {BATCH_SIZE})...')

    # name → { count, raw_examples, flag }
    name_map = {}
    failed_raws = []

    batches = [all_raw[i:i+BATCH_SIZE] for i in range(0, len(all_raw), BATCH_SIZE)]
    total_batches = len(batches)

    for batch_num, batch in enumerate(batches, 1):
        print(f'  Batch {batch_num}/{total_batches} ({len(batch)} strings)...')
        try:
            results = parse_ingredient_names(batch)
        except Exception as e:
            print(f'  ERROR on batch {batch_num}: {e}')
            for raw in batch:
                failed_raws.append(raw)
            continue

        # Map results back to raw strings
        # Build num → raw lookup (handles .a .b splits)
        num_to_raw = {}
        for i, raw in enumerate(batch):
            num_to_raw[str(i+1)] = raw

        for item in results:
            num_str = item.get('num', '')
            base_num = num_str.split('.')[0]
            raw = num_to_raw.get(base_num, '')
            name = (item.get('name') or '').strip().lower()
            flag = (item.get('flag') or '').strip()

            if not name:
                failed_raws.append(raw)
                continue

            if name not in name_map:
                name_map[name] = {
                    'name': name,
                    'count': 0,
                    'raw_examples': [],
                    'flag': flag,
                    'usda_id': None,
                    'reviewed': False
                }

            # Accumulate count from all recipes that used any raw string
            # that maps to this name
            if raw and raw in raw_to_recipes:
                name_map[name]['count'] += len(raw_to_recipes[raw])
                if len(name_map[name]['raw_examples']) < 3:
                    name_map[name]['raw_examples'].append(raw)

            # Upgrade flag if more severe
            if flag and not name_map[name]['flag']:
                name_map[name]['flag'] = flag

        time.sleep(SLEEP_BETWEEN)

    # ── Step 5: Handle failures ────────────────────────────────────────────────
    if failed_raws:
        print(f'\n{len(failed_raws)} strings failed to parse — added to needs_review')
        for raw in failed_raws:
            name = f'[PARSE FAILED] {raw[:60]}'
            name_map[name] = {
                'name': name,
                'count': len(raw_to_recipes.get(raw, [])),
                'raw_examples': [raw],
                'flag': 'PARSE_FAILED',
                'usda_id': None,
                'reviewed': False
            }

    # ── Step 6: Sort by count descending (most-used ingredients first) ─────────
    master = sorted(name_map.values(), key=lambda x: -x['count'])

    print(f'\nUnique ingredients after deduplication: {len(master)}')

    # ── Step 7: Write outputs ─────────────────────────────────────────────────
    with open(OUTPUT_JSON, 'w') as f:
        json.dump(master, f, indent=2)
    print(f'Saved {OUTPUT_JSON}')

    write_csv(master)
    print(f'Saved {OUTPUT_CSV}')

    # ── Step 8: Summary ───────────────────────────────────────────────────────
    flagged = [i for i in master if i['flag']]
    print(f'\n── Summary ────────────────────────────────────────────')
    print(f'  Total unique ingredients:  {len(master)}')
    print(f'  Flagged (need attention):  {len(flagged)}')
    print(f'  Clean (ready for USDA):    {len(master) - len(flagged)}')
    if flagged:
        print(f'\n  Flags breakdown:')
        flag_counts = {}
        for i in flagged:
            flag_counts[i['flag']] = flag_counts.get(i['flag'], 0) + 1
        for flag, count in sorted(flag_counts.items()):
            print(f'    {flag}: {count}')
    print(f'\nNext step: review {OUTPUT_CSV}, then run build_nutrition_db.py')


def write_csv(master: list):
    with open(OUTPUT_CSV, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            'ingredient_name',
            'recipe_count',
            'flag',
            'raw_example_1',
            'raw_example_2',
            'usda_id',
            'reviewed'
        ])
        for item in master:
            examples = item.get('raw_examples', [])
            writer.writerow([
                item['name'],
                item['count'],
                item.get('flag', ''),
                examples[0] if len(examples) > 0 else '',
                examples[1] if len(examples) > 1 else '',
                item.get('usda_id', ''),
                item.get('reviewed', False)
            ])


if __name__ == '__main__':
    main()
