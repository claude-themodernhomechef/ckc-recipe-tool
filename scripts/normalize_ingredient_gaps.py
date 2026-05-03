#!/usr/bin/env python3
"""
normalize_ingredient_gaps.py
============================
For each ingredient missing from ingredientNutrition_v2.json, finds the
best matching entry already in the DB and creates an alias.

e.g. "dried cumin" → "cumin" (already in DB, same nutrition)
     "baby spinach leaves" → "baby spinach" (already in DB)

Sends batches to Claude Haiku for fast, accurate matching.
Truly novel ingredients with no proxy are flagged to data/ingredient_no_proxy.csv

Usage:
  python3 scripts/normalize_ingredient_gaps.py
"""

import json, os, re, sys, time, csv
import anthropic

BASE      = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(BASE)
DB_FILE   = os.path.join(REPO_ROOT, 'data', 'ingredientNutrition_v2.json')
GAPS_CSV  = os.path.join(REPO_ROOT, 'data', 'ingredient_gaps_review.csv')
NO_PROXY  = os.path.join(REPO_ROOT, 'data', 'ingredient_no_proxy.csv')
BATCH     = 40   # ingredients per Claude call

# ── Load API key ──────────────────────────────────────────────────────────────
env_path = os.path.join(BASE, 'functions', '.env')
api_key  = os.environ.get('ANTHROPIC_API_KEY', '')
if not api_key and os.path.exists(env_path):
    m = re.search(r'ANTHROPIC_API_KEY=(.+)', open(env_path).read())
    if m: api_key = m.group(1).strip()
if not api_key:
    print('ERROR: ANTHROPIC_API_KEY not found'); sys.exit(1)

claude = anthropic.Anthropic(api_key=api_key)

# ── Load files ────────────────────────────────────────────────────────────────
with open(DB_FILE) as f:
    db = json.load(f)

db_keys = sorted(db.keys())

with open(GAPS_CSV) as f:
    reader = csv.reader(f)
    next(reader)  # skip header
    missing = [row[0].strip() for row in reader if row]

print(f'DB entries:          {len(db_keys)}')
print(f'Missing ingredients: {len(missing)}')
print(f'Batches:             {len(missing) // BATCH + 1}')
print()

# ── Claude proxy matcher ──────────────────────────────────────────────────────
DB_KEY_LIST = '\n'.join(f'- {k}' for k in db_keys)

def find_proxies(batch):
    numbered = '\n'.join(f'{i+1}. {n}' for i, n in enumerate(batch))
    prompt = f"""You are building a nutrition database. For each missing ingredient below, find the best matching entry from the existing database.

RULES:
- Match by nutritional equivalence, not name similarity
- "dried cumin" → "cumin" (same thing, just specifying dried)
- "cold butter" → "butter" (temperature doesn't change nutrition)
- "boneless chicken breast" → "chicken breast" or "boneless skinless chicken breast"
- "baby spinach leaves" → "baby spinach" or "spinach"
- "fresh orange juice" → "orange juice"
- "vegetable oil" → "canola oil" or "sunflower oil" (nutritionally similar)
- "broth" (generic) → "chicken broth" (most common default)
- "oil" (generic) → "olive oil" (most common default)
- "rice" (generic) → "white rice" or "jasmine rice"
- "pasta" (generic) → "spaghetti" or closest pasta type
- "flour" (generic) → "all purpose flour"
- Cooking equipment (cedar plank, skewer, freezer bag) → NONE
- Truly novel ingredients with no nutritional proxy → NONE
- Condiments that are complete dishes (ranch dressing) → find closest component or NONE

EXISTING DB KEYS (find matches from this list only):
{DB_KEY_LIST}

MISSING INGREDIENTS TO MATCH:
{numbered}

Return JSON array, one object per ingredient:
[
  {{"num": 1, "missing": "dried cumin", "proxy": "cumin", "reason": "same ingredient"}},
  {{"num": 2, "missing": "cedar plank", "proxy": null, "reason": "cooking equipment, not food"}}
]

Return ONLY the JSON array."""

    resp = claude.messages.create(
        model='claude-haiku-4-5-20251001',
        max_tokens=4096,
        messages=[{'role': 'user', 'content': prompt}]
    )
    raw = resp.content[0].text.strip()
    raw = re.sub(r'^```(?:json)?\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw)
    return json.loads(raw)

# ── Main loop ─────────────────────────────────────────────────────────────────
added    = 0
no_proxy = []
batches  = [missing[i:i+BATCH] for i in range(0, len(missing), BATCH)]

for b_num, batch in enumerate(batches, 1):
    print(f'Batch {b_num}/{len(batches)}...')
    try:
        results = find_proxies(batch)
    except Exception as e:
        print(f'  ERROR: {e}')
        for name in batch:
            no_proxy.append({'ingredient': name, 'reason': f'batch error: {e}'})
        time.sleep(2)
        continue

    for item in results:
        name  = item.get('missing', '')
        proxy = item.get('proxy')

        if not name:
            continue

        if proxy and proxy in db:
            # Copy the proxy entry's data under the missing name
            db[name] = db[proxy].copy()
            db[name]['_proxy_for'] = proxy
            added += 1
            print(f'  ✓ {name:<50} → {proxy}')
        else:
            reason = item.get('reason', 'no proxy found')
            no_proxy.append({'ingredient': name, 'reason': reason})
            print(f'  ✗ {name:<50}  [{reason}]')

    time.sleep(0.3)

# ── Save DB ───────────────────────────────────────────────────────────────────
with open(DB_FILE, 'w') as f:
    json.dump(db, f, indent=2)

# ── Save no-proxy list ────────────────────────────────────────────────────────
if no_proxy:
    with open(NO_PROXY, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['ingredient', 'reason'])
        writer.writeheader()
        writer.writerows(no_proxy)

print(f'\n── Summary ─────────────────────────────────────────────')
print(f'  Aliases added:   {added}')
print(f'  No proxy found:  {len(no_proxy)}')
print(f'  DB total now:    {len(db)}')
if no_proxy:
    print(f'  Review file:     data/ingredient_no_proxy.csv')
print(f'  Saved to:        data/ingredientNutrition_v2.json')
