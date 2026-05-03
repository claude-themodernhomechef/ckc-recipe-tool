#!/usr/bin/env python3
"""
build_nutrition_db.py
=====================
Step 2 of the nutrition pipeline.

For each ingredient in ingredient_master_list.json, queries the USDA
FoodData Central API in priority order:
  1. SR Legacy      — lab-verified, ~7,900 whole foods (gold standard)
  2. Foundation     — highly precise analytical data, ~2,400 foods
  3. FNDDS          — mixed/prepared dishes, recipe-level items
  4. Branded        — manufacturer labels, last resort

Claude picks the best match from each tier's results. If no confident
match is found across all tiers, the ingredient is flagged to
nutrition_needs_review.csv for your manual input.

Outputs:
  - ingredientNutrition.json   → local cache of all nutrition data
  - nutrition_needs_review.csv → ingredients that need your attention

Resume-safe: already-resolved ingredients are skipped on re-run.

Usage:
  python3 scripts/build_nutrition_db.py
  python3 scripts/build_nutrition_db.py --dry-run    # preview only
  python3 scripts/build_nutrition_db.py --limit 50   # test with 50
  python3 scripts/build_nutrition_db.py --force      # re-query everything
"""

import json, os, re, sys, time, csv, argparse, unicodedata
import requests
import anthropic

# ── Config ─────────────────────────────────────────────────────────────────────
BASE              = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT         = os.path.dirname(BASE)
INPUT_JSON        = os.path.join(REPO_ROOT, 'ingredient_master_list.json')
OUTPUT_JSON       = os.path.join(REPO_ROOT, 'data', 'ingredientNutrition_v3.json')
NEEDS_REVIEW_CSV  = os.path.join(REPO_ROOT, 'data', 'nutrition_needs_review.csv')
USDA_BASE         = 'https://api.nal.usda.gov/fdc/v1'
RESULTS_PER_TIER  = 8     # top N results Claude evaluates per tier
MAX_KCAL_PER_100G = 900   # reject any match above this — real foods top out ~884 kcal (pure oil)
SLEEP_USDA        = 0.15  # seconds between USDA calls (rate limit courtesy)
SLEEP_CLAUDE      = 0.2   # seconds between Claude calls

# Data tiers in priority order
TIERS = [
    {'name': 'SR Legacy',   'dataType': 'SR Legacy'},
    {'name': 'Foundation',  'dataType': 'Foundation'},
    {'name': 'FNDDS',       'dataType': 'Survey (FNDDS)'},
    {'name': 'Branded',     'dataType': 'Branded'},
]

# Nutrients we care about (USDA nutrient IDs)
NUTRIENT_IDS = {
    1008: 'calories',       # Energy (kcal)
    1003: 'protein',        # Protein
    1004: 'fat',            # Total lipid (fat)
    1005: 'carbs',          # Carbohydrate, by difference
    1079: 'fiber',          # Fiber, total dietary
    1093: 'sodium',         # Sodium, Na
    1092: 'potassium',      # Potassium, K
    1087: 'calcium',        # Calcium, Ca
    1089: 'iron',           # Iron, Fe
    1090: 'magnesium',      # Magnesium, Mg
    1162: 'vitamin_c',      # Vitamin C
    1106: 'vitamin_a',      # Vitamin A, RAE
    1109: 'vitamin_e',      # Vitamin E
    1114: 'vitamin_d',      # Vitamin D
    1185: 'vitamin_k',      # Vitamin K
    1165: 'vitamin_b1',     # Thiamin (B1)
    1166: 'vitamin_b2',     # Riboflavin (B2)
    1167: 'vitamin_b3',     # Niacin (B3)
    1175: 'vitamin_b6',     # Vitamin B6
    1177: 'folate',         # Folate
    1178: 'vitamin_b12',    # Vitamin B12
    1253: 'cholesterol',    # Cholesterol
    1258: 'saturated_fat',  # Fatty acids, saturated
    1292: 'monounsaturated_fat',  # Fatty acids, monounsaturated
    1293: 'polyunsaturated_fat',  # Fatty acids, polyunsaturated
}

# ── Args ──────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument('--dry-run', action='store_true', help='Preview only, no files written')
parser.add_argument('--limit',   type=int, default=0, help='Only process N ingredients')
parser.add_argument('--force',   action='store_true', help='Re-query already-resolved ingredients')
args = parser.parse_args()

# ── Load API keys ──────────────────────────────────────────────────────────────
env_path = os.path.join(BASE, 'functions', '.env')
env_text = open(env_path).read() if os.path.exists(env_path) else ''

usda_key = os.environ.get('USDA_API_KEY', '')
if not usda_key:
    m = re.search(r'USDA_API_KEY=(.+)', env_text)
    if m: usda_key = m.group(1).strip()
if not usda_key:
    print('ERROR: USDA_API_KEY not found'); sys.exit(1)

anthropic_key = os.environ.get('ANTHROPIC_API_KEY', '')
if not anthropic_key:
    m = re.search(r'ANTHROPIC_API_KEY=(.+)', env_text)
    if m: anthropic_key = m.group(1).strip()
if not anthropic_key:
    print('ERROR: ANTHROPIC_API_KEY not found'); sys.exit(1)

claude = anthropic.Anthropic(api_key=anthropic_key)
print(f'✓ USDA key: {usda_key[:6]}...{usda_key[-4:]}')
print(f'✓ Claude key: {anthropic_key[:10]}...{anthropic_key[-4:]}')

# ── Preflight: verify Claude is actually reachable before starting ─────────────
print('Testing Claude API...', end=' ', flush=True)
try:
    _test = claude.messages.create(
        model='claude-haiku-4-5-20251001',
        max_tokens=10,
        messages=[{'role': 'user', 'content': 'ping'}]
    )
    print('✓ Claude is working')
except Exception as _e:
    print(f'\n⛔ Claude is not available: {_e}')
    print('Fix your spend limit at console.anthropic.com → Settings → Limits, then re-run.')
    sys.exit(1)

# ── Load inputs ────────────────────────────────────────────────────────────────
if not os.path.exists(INPUT_JSON):
    print(f'ERROR: {INPUT_JSON} not found. Run extract_ingredient_list.py first.')
    sys.exit(1)

with open(INPUT_JSON) as f:
    ingredients = json.load(f)

# Load existing nutrition DB (resume support)
if os.path.exists(OUTPUT_JSON) and not args.force:
    with open(OUTPUT_JSON) as f:
        nutrition_db = json.load(f)
    print(f'Loaded existing nutrition DB: {len(nutrition_db)} entries')
else:
    nutrition_db = {}

print(f'Ingredients to process: {len(ingredients)}')

if args.limit:
    ingredients = ingredients[:args.limit]
    print(f'Limited to {args.limit} ingredients')

# ── Manual overrides — known USDA FDC IDs for problem ingredients ─────────────
# These bypass search entirely and use the exact correct USDA entry.
# Format: ingredient_name → fdcId
MANUAL_OVERRIDES = {
    # Verified FDC IDs — confirmed via USDA API search
    'chicken thighs':       173627,  # Chicken, broilers or fryers, dark meat, thigh, meat only, raw
    'chicken thigh':        173627,
    'yellow onion':         790646,  # Onions, yellow, raw (Foundation)
    'yellow onions':        790646,  # plural form → same entry
    'tomato':               170457,  # Tomatoes, red, ripe, raw (singular)
    'tomatoes':             170457,  # Tomatoes, red, ripe, raw, year round average
    'cherry tomatoes':      170457,  # Proxy: Tomatoes, red, ripe, raw
    'grape tomatoes':       170457,
    # italian seasoning → no complete USDA data found, flagged for manual review
    'unsalted butter':      173430,  # Butter, without salt (SR Legacy)
    'rice vinegar':         172237,  # Vinegar, distilled (nutritionally identical to rice vinegar)
    'coconut milk, full fat, unsweetened': 170173,  # Nuts, coconut milk, canned (SR Legacy)
    'egg':                  171287,  # Egg, whole, raw, fresh (not dried)
    'chicken broth':        174536,  # Soup, chicken broth, ready-to-serve
    # Rafi-confirmed FDC IDs — with calorie data
    'jalapeño':             2747661, # Peppers, hot chili, jalapeno, raw — 24 kcal ✓
    'jalapeños':            2747661,
    'jalapeno':             2747661,
    'jalapenos':            2747661,
    'jalapeño pepper':      2747661,
    'jalapeño peppers':     2747661,
    'harissa':              2019244, # Harissa — 67 kcal ✓
    'panko':                2112787, # Panko breadcrumbs — 357 kcal ✓
    'panko breadcrumbs':    2112787,
    # Rafi-confirmed FDC IDs — spice blends with no calorie data in USDA
    # Used in tiny amounts (≤1 tbsp), calorie contribution is negligible (<3 kcal/dish)
    'italian seasoning':    384472,  # Simply Organic Italian Seasoning (Rafi confirmed)
    'sumac':                2630657, # Ground sumac (Rafi confirmed)
    'ground sumac':         2630657,
    'cajun seasoning':      1887349, # Cajun seasoning (Rafi confirmed)
    "za'atar":              1957496, # Za'atar (Rafi confirmed)
    'zaatar':               1957496,
    'liquid smoke':         2680455, # Liquid smoke (Rafi confirmed)
}

# Ingredients where missing calorie data is acceptable — spice blends used in
# tiny quantities where USDA simply has no calorie entry. Calorie impact <3 kcal/dish.
ACCEPT_WITHOUT_CALORIES = {
    'italian seasoning', 'sumac', 'ground sumac', 'cajun seasoning',
    "za'atar", 'zaatar', 'liquid smoke',
}

# ── Unicode normalization (accent chars like ñ break USDA search) ─────────────
def normalize_for_usda(name: str) -> str:
    """Strip accent/diacritic characters so USDA search doesn't fail.
    e.g. jalapeño → jalapeno, café → cafe
    """
    nfkd = unicodedata.normalize('NFKD', name)
    return ''.join(c for c in nfkd if not unicodedata.combining(c))

# ── USDA search ────────────────────────────────────────────────────────────────
def search_usda(query: str, data_type: str) -> list:
    """Search USDA for an ingredient in a specific data tier."""
    try:
        resp = requests.get(
            f'{USDA_BASE}/foods/search',
            params={
                'api_key': usda_key,
                'query': normalize_for_usda(query),
                'dataType': data_type,
                'pageSize': RESULTS_PER_TIER,
                'pageNumber': 1,
            },
            timeout=10
        )
        if resp.status_code != 200:
            return []
        return resp.json().get('foods', [])
    except Exception as e:
        print(f'    USDA error: {e}')
        return []

def get_food_detail(fdc_id: int) -> dict:
    """Fetch full food details including food portions."""
    try:
        resp = requests.get(
            f'{USDA_BASE}/food/{fdc_id}',
            params={'api_key': usda_key},
            timeout=10
        )
        if resp.status_code != 200:
            return {}
        return resp.json()
    except Exception:
        return {}

# ── Nutrient extraction ────────────────────────────────────────────────────────
# Alternative calorie nutrient IDs used by Foundation Foods
CALORIE_IDS = {1008, 2047, 1062}

def extract_nutrients(food_nutrients: list) -> dict:
    """Extract our target nutrients per 100g from USDA nutrient list."""
    result = {}
    for n in food_nutrients:
        nid = n.get('nutrientId') or n.get('nutrient', {}).get('id')
        val = n.get('value')
        if val is None:
            val = n.get('amount')
        if val is None:
            continue
        # Handle calories — Foundation Foods sometimes use alternate IDs
        if nid in CALORIE_IDS and 'calories' not in result:
            result['calories'] = round(float(val), 2)
        elif nid in NUTRIENT_IDS:
            result[NUTRIENT_IDS[nid]] = round(float(val), 2)
    return result

def extract_portions(food_detail: dict) -> list:
    """Extract household measure portions (cups, tbsp, oz, etc.)"""
    portions = []
    for p in food_detail.get('foodPortions', []):
        unit = (
            p.get('measureUnit', {}).get('name') or
            p.get('modifier') or
            p.get('portionDescription', '')
        )
        gram_weight = p.get('gramWeight', 0)
        amount = p.get('amount', 1)
        if unit and gram_weight:
            portions.append({
                'unit': unit.strip().lower(),
                'amount': amount,
                'gramWeight': round(gram_weight, 2)
            })
    return portions

# ── Claude match selection ─────────────────────────────────────────────────────
def claude_pick_best_match(ingredient: str, candidates: list, tier: str) -> dict | None:
    """
    Ask Claude to pick the best USDA match from candidates.
    Returns the chosen candidate dict, or None if no confident match.
    """
    if not candidates:
        return None

    candidate_list = '\n'.join(
        f'{i+1}. [{c["fdcId"]}] {c["description"]} ({c.get("brandOwner", "")})'
        for i, c in enumerate(candidates)
    )

    prompt = f"""You are building a nutrition database for a recipe app. You need to find the best USDA FoodData Central match for a recipe ingredient.

Ingredient: "{ingredient}"
Data tier: {tier}

USDA candidates:
{candidate_list}

Pick the SINGLE best match. Rules (in strict order):

ALWAYS:
1. Prefer "raw" over any cooked form (sauteed, roasted, baked, fried, boiled, grilled). Raw is the default.
2. Prefer whole, minimally processed forms.
3. Prefer the most specific match to the ingredient name.
4. Prefer SR Legacy / Foundation over FNDDS / Branded when quality is equal.

NEVER accept:
- Condensed, concentrated, or reconstituted forms (reject "condensed", "concentrated")
- Cooked/prepared forms when a raw option exists (reject "sauteed", "roasted", "grilled", "fried", "baked", "dehydrated" unless the ingredient itself is a dried spice)
- Breaded, battered, or coated versions

SPECIFIC RULES (these override general rules):
- Milk → ALWAYS use cow's whole milk (3.25% milkfat). REJECT sheep milk, goat milk, evaporated milk, condensed milk.
- Mushrooms (generic) → prefer white button mushrooms, raw. REJECT chanterelle, morel, truffle, grilled, sauteed.
- Baby bella / cremini mushrooms → prefer cremini or brown mushrooms, raw. REJECT grilled or cooked.
- Mint / mint leaves → prefer fresh spearmint or peppermint leaf, raw. REJECT mint candy, mint extract, mint flavoring, mint oil.
- Cinnamon / cinnamon stick → prefer pure ground cinnamon or cinnamon sticks. REJECT cinnamon-sugar blends, flavored mixes.
- Poblano pepper → prefer raw fresh poblano. REJECT dried ancho, mulato, or any dried version.
- Red curry paste → this is a PASTE, not a powder. REJECT curry powder. Accept branded red curry paste.
- Rice (jasmine, basmati, white rice) → ALWAYS prefer white rice of the specified variety. REJECT brown rice unless the ingredient says "brown".
- Jalapeno / jalapeño → prefer raw fresh jalapeno pepper. REJECT pickled, canned, dried.
- Chili flakes / red pepper flakes → prefer crushed red pepper or dried chili flakes. REJECT any entry showing >500 kcal/100g (that's a data error).
- BBQ sauce → prefer BBQ sauce, not salsa, not hot sauce.
- White wine vinegar → prefer white wine vinegar specifically. If not found, use distilled white vinegar (NOT red wine vinegar, NOT balsamic).
- For broths/stocks: prefer "ready-to-serve" or "home-prepared". REJECT "condensed".
- For tomatoes: ALWAYS prefer fresh red ripe raw. REJECT green, orange, canned, crushed, sun-dried.
- For meat/poultry: ALWAYS prefer boneless, skinless, raw. REJECT "with skin", bone-in, cooked.
- For ground beef: prefer 80% lean (80/20).
- For coconut milk: prefer full-fat canned. REJECT coconut water, lite/light coconut milk.

FINAL CHECK: If no candidate clearly matches the ingredient, return null — do not pick a wrong food type (e.g. don't pick "sheep milk" for "milk", don't pick "chanterelle" for "mushrooms").

Respond in this exact JSON format:
{{"match": 1, "confidence": "high", "reason": "Raw whole ingredient, exact match"}}

If NO candidate is a good match, respond:
{{"match": null, "confidence": "none", "reason": "Why none work"}}

Confidence levels: "high" = certain match, "medium" = close but not perfect.
Only return the JSON, no explanation."""

    try:
        resp = claude.messages.create(
            model='claude-haiku-4-5-20251001',
            max_tokens=150,
            messages=[{'role': 'user', 'content': prompt}]
        )
        raw = resp.content[0].text.strip()
        raw = re.sub(r'^```(?:json)?\s*', '', raw)
        raw = re.sub(r'\s*```$', '', raw)
        result = json.loads(raw)

        match_idx = result.get('match')
        confidence = result.get('confidence', 'none')

        if match_idx is None or confidence == 'none':
            return None

        # Accept high or medium confidence
        if confidence in ('high', 'medium') and 1 <= match_idx <= len(candidates):
            chosen = candidates[match_idx - 1]
            chosen['_confidence'] = confidence
            chosen['_reason'] = result.get('reason', '')
            return chosen

        return None
    except Exception as e:
        err_str = str(e)
        if 'usage limit' in err_str.lower() or 'you will regain access' in err_str.lower():
            # Raise your monthly spend cap at console.anthropic.com → Settings → Limits
            # The ingredient will go to needs_review and be retried on next run.
            print(f'    ✗ Claude usage limit active — ingredient will be retried on next run')
        else:
            print(f'    Claude error: {e}')
        return None

# ── Main loop ─────────────────────────────────────────────────────────────────
needs_review = []
processed = 0
skipped = 0
found = 0
flagged = 0

print(f'\nStarting USDA lookups...\n')

for i, item in enumerate(ingredients, 1):
    name = item['name']

    # Skip parse failures and already-resolved
    if name.startswith('[PARSE FAILED]'):
        needs_review.append({
            'ingredient': name,
            'issue': 'Could not parse from raw ingredient string',
            'raw_example': item.get('raw_examples', [''])[0],
            'usda_candidates': '',
            'your_correction': ''
        })
        flagged += 1
        continue

    if name in nutrition_db and not args.force:
        skipped += 1
        continue

    flag = item.get('flag', '')
    print(f'[{i}/{len(ingredients)}] {name}', end='')
    if flag:
        print(f' [{flag}]', end='')
    print()

    if args.dry_run:
        continue

    # ── Check manual override first ───────────────────────────────────────────
    if name.lower() in MANUAL_OVERRIDES:
        fdc_id = MANUAL_OVERRIDES[name.lower()]
        detail = get_food_detail(fdc_id)
        time.sleep(SLEEP_USDA)
        if detail:
            nutrients = extract_nutrients(detail.get('foodNutrients', []))
            portions = extract_portions(detail)
            nutrition_db[name] = {
                'fdcId': fdc_id,
                'description': detail.get('description', name),
                'tier': 'Manual Override',
                'confidence': 'high',
                'per100g': nutrients,
                'portions': portions,
            }
            cal = nutrients.get('calories', '?')
            pro = nutrients.get('protein', '?')
            no_cal_note = ' (spice blend — no USDA calorie data, negligible impact)' if name.lower() in ACCEPT_WITHOUT_CALORIES else ''
            print(f'    ✓ [Manual Override] {detail.get("description", name)} | {cal} kcal, {pro}g protein per 100g{no_cal_note}')
            found += 1
            processed += 1
            with open(OUTPUT_JSON, 'w') as f:
                json.dump(nutrition_db, f, indent=2)
            continue

    # ── Search each tier in priority order ────────────────────────────────────
    # For each tier: search → Claude picks best match → validate nutrients are complete
    # If nutrients are incomplete, continue to next tier before giving up
    matched = None
    matched_tier = None
    matched_nutrients = None
    matched_portions = None
    matched_detail = None
    all_candidates_for_review = []

    for tier in TIERS:
        candidates = search_usda(name, tier['dataType'])
        time.sleep(SLEEP_USDA)

        if not candidates:
            continue

        # Collect candidates for review file in case nothing works
        for c in candidates[:2]:
            all_candidates_for_review.append(f'[{tier["name"]}] {c["description"]} (fdcId: {c["fdcId"]})')

        chosen = claude_pick_best_match(name, candidates, tier['name'])
        time.sleep(SLEEP_CLAUDE)

        if not chosen:
            continue

        # Get full detail to validate nutrients
        detail = get_food_detail(chosen['fdcId'])
        time.sleep(SLEEP_USDA)

        nutrients = extract_nutrients(
            detail.get('foodNutrients', chosen.get('foodNutrients', []))
        )

        # ── Validate: must have calories for any food that isn't pure water/salt ──
        # Foods where 0 kcal is legitimate: water, salt, vinegar, baking soda
        ZERO_CALORIE_OK = {'water', 'salt', 'kosher salt', 'sea salt', 'table salt',
                           'baking soda', 'baking powder', 'vinegar', 'apple cider vinegar',
                           'red wine vinegar', 'white wine vinegar', 'rice vinegar',
                           'distilled vinegar', 'sparkling water', 'seltzer water'}
        cal = nutrients.get('calories')
        name_lower = name.lower()
        zero_ok = any(z in name_lower for z in ZERO_CALORIE_OK)

        if not zero_ok and (cal is None or cal == 0):
            print(f'    ⚠ [{tier["name"]}] {chosen["description"]} — calories missing, trying next tier')
            continue  # Don't accept this match, try next tier

        # ── Validate: reject absurdly high calorie values (data errors in Branded) ──
        # Real foods top out around 884 kcal/100g (pure oil). Anything above MAX_KCAL_PER_100G
        # is almost certainly a data entry error (e.g. chilli flakes showing 7,500 kcal)
        if cal is not None and cal > MAX_KCAL_PER_100G:
            print(f'    ⚠ [{tier["name"]}] {chosen["description"]} — {cal} kcal/100g exceeds max ({MAX_KCAL_PER_100G}), rejecting bad data')
            continue  # Don't accept this match, try next tier

        # ── Match is valid ────────────────────────────────────────────────────
        matched = chosen
        matched_tier = tier['name']
        matched_nutrients = nutrients
        matched_portions = extract_portions(detail)
        matched_detail = detail
        break

    # ── Process match ─────────────────────────────────────────────────────────
    if matched:
        fdc_id = matched['fdcId']

        nutrition_db[name] = {
            'fdcId': fdc_id,
            'description': matched['description'],
            'tier': matched_tier,
            'confidence': matched.get('_confidence', 'medium'),
            'per100g': matched_nutrients,
            'portions': matched_portions,
        }

        cal = matched_nutrients.get('calories', '?')
        pro = matched_nutrients.get('protein', '?')
        print(f'    ✓ [{matched_tier}] {matched["description"]} | {cal} kcal, {pro}g protein per 100g')
        found += 1
        processed += 1

        # Save after every ingredient (resume safety)
        with open(OUTPUT_JSON, 'w') as f:
            json.dump(nutrition_db, f, indent=2)

    else:
        needs_review.append({
            'ingredient': name,
            'issue': 'No match with complete calorie data found in SR Legacy, Foundation, FNDDS, or Branded',
            'raw_example': item.get('raw_examples', [''])[0],
            'usda_candidates': ' | '.join(all_candidates_for_review[:6]),
            'your_correction': ''
        })
        print(f'    ✗ No match found — added to needs_review')
        flagged += 1
        processed += 1

# ── Write needs_review CSV ─────────────────────────────────────────────────────
if needs_review and not args.dry_run:
    with open(NEEDS_REVIEW_CSV, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'ingredient', 'issue', 'raw_example', 'usda_candidates', 'your_correction'
        ])
        writer.writeheader()
        writer.writerows(needs_review)
    print(f'\nSaved {NEEDS_REVIEW_CSV} ({len(needs_review)} items need your review)')

# ── Summary ────────────────────────────────────────────────────────────────────
print(f'\n── Summary ───────────────────────────────────────────')
print(f'  Total ingredients:    {len(ingredients)}')
print(f'  Skipped (cached):     {skipped}')
print(f'  Matched to USDA:      {found}')
print(f'  Needs your review:    {flagged}')
print(f'  Saved to:             ingredientNutrition.json')
if flagged:
    print(f'  Review file:          nutrition_needs_review.csv')
print(f'\nNext step: run calculate_recipe_nutrition.py to compute per-recipe nutrition facts')
