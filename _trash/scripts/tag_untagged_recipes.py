#!/usr/bin/env python3
"""
tag_untagged_recipes.py
=======================
Processes all approved recipes with no dietTags through the full CKC diet
compliance pipeline:

  1. Fetch 153 approved recipes missing dietTags from Firestore
  2. Call Claude API to analyse all 8 protocols per recipe
  3. Cross-reference uncertain ingredients against the Fig DB
  4. Write confirmed tags back to Firestore
  5. Write grey-area / uncertain cases to needs_review_diet_tags.csv

Run:
  python3 tag_untagged_recipes.py --dry-run   # preview only, no writes
  python3 tag_untagged_recipes.py             # apply tags + write CSV
"""

import json, os, sys, re, time, csv, argparse, warnings
warnings.filterwarnings('ignore')

import firebase_admin
from firebase_admin import credentials, firestore
import anthropic

# ── Config ─────────────────────────────────────────────────────────────────────
BASE          = os.path.dirname(os.path.abspath(__file__))
RULES_FILE    = os.path.join(BASE, 'CKC_Diet_Compliance_Rules.md')
FIG_DB_FILE   = '/Users/rafi/Desktop/Claude-MHC/Fig Scraper/ckc_products_cleaned_2026-03-29.json'
PROGRESS_FILE = os.path.join(BASE, 'tag_untagged_progress.json')
OUT_CSV       = os.path.join(BASE, 'needs_review_diet_tags.csv')
OUT_JSON      = os.path.join(BASE, 'tag_untagged_updates.json')

PROTOCOLS     = ['GF', 'DF', 'V', 'Vg', 'K', 'AIP', 'LF', 'LH']
PROTO_FIG_FIELD = {
    'AIP': 'aip_friendly',
    'LF':  'low_fodmap',
    'GF':  'gluten_free',
    'DF':  'dairy_free',
    'V':   'vegan',
    'Vg':  'vegetarian',
    'LH':  'low_histamine',
    'K':   None,   # special: sugar_free + paleo
}

# ── Load compliance rules ──────────────────────────────────────────────────────
with open(RULES_FILE) as f:
    DIET_RULES = f.read()

# ── Load Fig DB ────────────────────────────────────────────────────────────────
print("Loading Fig DB…", flush=True)
with open(FIG_DB_FILE) as f:
    FIG_PRODUCTS = json.load(f)
print(f"  {len(FIG_PRODUCTS):,} products loaded", flush=True)

def search_fig(ingredient_name: str, protocol: str) -> list[dict]:
    """Return up to 5 Fig products that match the ingredient name and are
    compliant with the given protocol."""
    field = PROTO_FIG_FIELD.get(protocol)
    q = ingredient_name.lower().strip()
    results = []
    for p in FIG_PRODUCTS:
        name_lower = (p.get('name') or '').lower()
        if q not in name_lower:
            continue
        if field and not p.get(field):
            continue
        # For Keto: require sugar_free AND paleo
        if protocol == 'K' and not (p.get('sugar_free') and p.get('paleo')):
            continue
        results.append(p)
        if len(results) >= 5:
            break
    return results

# ── Firebase ───────────────────────────────────────────────────────────────────
def init_firebase():
    try:
        return firestore.client()
    except Exception:
        cred = credentials.Certificate(os.path.join(BASE, 'service-account.json'))
        firebase_admin.initialize_app(cred)
        return firestore.client()

# ── Fetch recipes ──────────────────────────────────────────────────────────────
def fetch_untagged(db) -> list[dict]:
    docs = db.collection('recipes').where('status', '==', 'yes').stream()
    out = []
    for d in docs:
        r = d.to_dict()
        dt = r.get('dietTags') or {}
        if not dt:
            out.append({
                'id':          d.id,
                'name':        r.get('name', ''),
                'url':         r.get('url', ''),
                'ingredients': r.get('ingredients', []),
                'notes':       r.get('notes') or r.get('description') or '',
                'cuisine':     r.get('cuisine', ''),
                'blogger':     r.get('blogger', ''),
            })
    return out

# ── Claude API analysis ────────────────────────────────────────────────────────
SYSTEM_PROMPT = f"""You are a precise dietary compliance analyst for CKC (Curated Kitchen Collective).
Your job: analyse a recipe's ingredient list against ALL 8 diet protocols.

COMPLIANCE RULES (authoritative — follow exactly):
{DIET_RULES}

OUTPUT FORMAT — respond with ONLY valid JSON, no markdown, no explanation:
{{
  "tags": {{
    "GF":  {{"native": true|false, "mod": true|false, "notes": "swap instruction or empty string"}},
    "DF":  {{"native": true|false, "mod": true|false, "notes": "..."}},
    "V":   {{"native": true|false, "mod": true|false, "notes": "..."}},
    "Vg":  {{"native": true|false, "mod": true|false, "notes": "..."}},
    "K":   {{"native": true|false, "mod": true|false, "notes": "..."}},
    "AIP": {{"native": true|false, "mod": true|false, "notes": "..."}},
    "LF":  {{"native": true|false, "mod": true|false, "notes": "..."}},
    "LH":  {{"native": true|false, "mod": true|false, "notes": "..."}}
  }},
  "uncertain": [
    {{
      "ingredient": "exact ingredient name from the list",
      "protocol":   "GF|DF|V|Vg|K|AIP|LF|LH",
      "reason":     "why you are uncertain — specific, detailed",
      "category":   "grey_area|no_product_found|skipped"
    }}
  ]
}}

RULES FOR TAGGING:
- Set native=true when the recipe is ALREADY compliant with zero modifications.
- Set mod=true when a specific, practical swap makes it compliant (include the swap in notes).
- Set both native=false AND mod=false when the ingredient IS the dish (no mod possible).
- Add to "uncertain" only when you genuinely cannot determine compliance without
  product-level verification (e.g., brand-specific spice blends, ambiguous sauces).
- If a recipe has NO tags at all for a protocol, set native=false and mod=false (omit from output is fine, but the JSON must include all 8 keys).
- AIP cascade rule: if AIP native=true or mod=true, GF and DF must also be true.
- "notes" for native=true tags must be an empty string.
- "notes" for mod=true tags must be the EXACT swap instruction.
"""

def analyse_recipe(client: anthropic.Anthropic, recipe: dict) -> dict:
    """Call Claude to analyse a recipe. Returns parsed JSON or raises."""
    ingredients_str = '\n'.join(f'  - {i}' for i in recipe['ingredients']) if recipe['ingredients'] else '  (no ingredient list available)'
    user_msg = f"""Recipe: {recipe['name']}
URL: {recipe['url']}
Cuisine: {recipe['cuisine']}
Blogger: {recipe['blogger']}
Notes/Description: {recipe['notes'][:300] if recipe['notes'] else '(none)'}

Ingredients:
{ingredients_str}

Analyse all 8 diet protocols and return the JSON."""

    response = client.messages.create(
        model='claude-haiku-4-5-20251001',
        max_tokens=1200,
        system=SYSTEM_PROMPT,
        messages=[{'role': 'user', 'content': user_msg}],
    )
    text = response.content[0].text.strip()
    # Strip markdown fences if present
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    return json.loads(text)

# ── Fig cross-reference ────────────────────────────────────────────────────────
def enrich_uncertain(uncertain: list[dict]) -> list[dict]:
    """For each uncertain item, search Fig DB and add caution_products."""
    enriched = []
    for u in uncertain:
        products = search_fig(u['ingredient'], u['protocol'])
        names = [f"{p.get('brand','')} {p.get('name','')}".strip() for p in products]
        u['caution_products'] = ' | '.join(names[:5]) if names else ''
        if products:
            u['category'] = 'grey_area'
        enriched.append(u)
    return enriched

# ── Write needs_review CSV ─────────────────────────────────────────────────────
CSV_FIELDS = ['Category', 'Recipe', 'Protocol', 'Ingredient Searched',
              'Reason', 'Caution Products Found', 'URL']

def append_to_csv(path: str, recipe: dict, uncertain: list[dict]):
    write_header = not os.path.exists(path)
    with open(path, 'a', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        if write_header:
            w.writeheader()
        for u in uncertain:
            w.writerow({
                'Category':              u.get('category', 'no_product_found'),
                'Recipe':                recipe['name'],
                'Protocol':              u['protocol'],
                'Ingredient Searched':   u['ingredient'],
                'Reason':                u['reason'],
                'Caution Products Found': u.get('caution_products', ''),
                'URL':                   recipe['url'],
            })

# ── Progress tracking ──────────────────────────────────────────────────────────
def load_progress() -> dict:
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE) as f:
            return json.load(f)
    return {'done': [], 'updates': {}}

def save_progress(progress: dict):
    with open(PROGRESS_FILE, 'w') as f:
        json.dump(progress, f, indent=2)

# ── Build final dietTags dict from analysis ────────────────────────────────────
def build_diet_tags(tags: dict) -> dict:
    """Convert Claude output tags to Firestore dietTags format.
    Only include protocols where at least one of native/mod is True."""
    out = {}
    for code, val in tags.items():
        if val.get('native') or val.get('mod'):
            out[code] = {
                'native': bool(val.get('native')),
                'mod':    bool(val.get('mod')),
                'notes':  val.get('notes', '') or '',
            }
    return out

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true', help='No Firestore writes')
    args = parser.parse_args()

    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}Starting tag_untagged_recipes…\n", flush=True)

    db     = init_firebase()
    client = anthropic.Anthropic()   # reads ANTHROPIC_API_KEY from env
    prog   = load_progress()
    done   = set(prog['done'])

    print("Fetching untagged approved recipes…", flush=True)
    recipes = fetch_untagged(db)
    print(f"  Found {len(recipes)} recipes to process\n", flush=True)

    # Reuse cached updates from a previous interrupted run
    all_updates = prog.get('updates', {})

    for i, recipe in enumerate(recipes, 1):
        rid = recipe['id']
        if rid in done:
            print(f"  [{i}/{len(recipes)}] SKIP (done): {recipe['name']}", flush=True)
            continue

        print(f"  [{i}/{len(recipes)}] {recipe['name']}", flush=True)

        if not recipe['ingredients']:
            print(f"    ⚠  No ingredients — writing to needs_review and skipping", flush=True)
            append_to_csv(OUT_CSV, recipe, [{
                'ingredient': '(none)',
                'protocol':   'ALL',
                'reason':     'Recipe has no ingredients stored in Firestore — cannot tag.',
                'category':   'skipped',
                'caution_products': '',
            }])
            done.add(rid)
            prog['done'] = list(done)
            save_progress(prog)
            continue

        try:
            result   = analyse_recipe(client, recipe)
            tags_raw = result.get('tags', {})
            uncertain = result.get('uncertain', [])

            # Fig cross-reference
            if uncertain:
                uncertain = enrich_uncertain(uncertain)
                append_to_csv(OUT_CSV, recipe, uncertain)

            # Build Firestore-ready tags
            diet_tags = build_diet_tags(tags_raw)

            tag_summary = ', '.join(
                f"{k}({'N' if v['native'] else ''}{'+M' if v['mod'] else ''})"
                for k, v in diet_tags.items()
            ) or '(none — no protocols apply)'

            print(f"    Tags: {tag_summary}", flush=True)
            if uncertain:
                print(f"    Uncertain: {[u['ingredient'] + '/' + u['protocol'] for u in uncertain]}", flush=True)

            # Write to Firestore
            if not args.dry_run and diet_tags:
                db.collection('recipes').document(rid).update({'dietTags': diet_tags})

            all_updates[rid] = {
                'name':      recipe['name'],
                'dietTags':  diet_tags,
                'uncertain': uncertain,
            }
            prog['updates'] = all_updates
            done.add(rid)
            prog['done'] = list(done)
            save_progress(prog)

        except json.JSONDecodeError as e:
            print(f"    ✗ JSON parse error: {e} — skipping", flush=True)
        except Exception as e:
            print(f"    ✗ Error: {e} — skipping", flush=True)

        time.sleep(0.3)   # be polite to the API

    # Write full update log
    with open(OUT_JSON, 'w') as f:
        json.dump(all_updates, f, indent=2)

    # Summary
    total_tagged   = sum(1 for v in all_updates.values() if v['dietTags'])
    total_uncertain = sum(len(v['uncertain']) for v in all_updates.values())
    print(f"\n{'─'*50}")
    print(f"Done. {len(all_updates)} recipes processed.")
    print(f"  Tagged:               {total_tagged}")
    print(f"  Uncertain flags:      {total_uncertain} (written to {os.path.basename(OUT_CSV)})")
    if args.dry_run:
        print("  [DRY RUN] — no Firestore writes made")
    print(f"  Full log:             {os.path.basename(OUT_JSON)}")
    print(f"{'─'*50}\n")

if __name__ == '__main__':
    main()
