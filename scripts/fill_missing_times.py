"""
fill_missing_times.py
─────────────────────
Fills prep_time for approved recipes that have no time data.

Strategy:
  1. Scrape the recipe URL — check JSON-LD, microdata, and body text for times
  2. If not found, ask Claude to estimate based on recipe name + ingredients

Usage:
  python3 scripts/fill_missing_times.py --dry-run    # preview only
  python3 scripts/fill_missing_times.py              # apply to Firestore
  python3 scripts/fill_missing_times.py --limit 20   # process first N
"""

import asyncio, json, os, re, sys, time, argparse
from typing import Optional
import firebase_admin
from firebase_admin import credentials, firestore as fs_module

# ── Config ──────────────────────────────────────────────────────────────────────
BASE      = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(BASE)
SA_KEY    = os.path.join(REPO_ROOT, 'service-account.json')

ANTHROPIC_KEY = os.environ.get('ANTHROPIC_API_KEY', '')

# ── CLI ─────────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument('--dry-run', action='store_true', help='Preview only — no writes')
parser.add_argument('--limit',   type=int, default=0,  help='Max recipes to process (0=all)')
args = parser.parse_args()

# ── Firebase ────────────────────────────────────────────────────────────────────
if not firebase_admin._apps:
    cred = credentials.Certificate(SA_KEY)
    firebase_admin.initialize_app(cred)
db = fs_module.client()

# ── JS: extract time from page (JSON-LD + microdata + body text) ─────────────────
EXTRACT_JS = """
() => {
  const result = { totalTime: null, prepTime: null, cookTime: null, bodySnippet: '' };

  // JSON-LD
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const raw = JSON.parse(s.textContent);
      const items = [];
      const roots = Array.isArray(raw) ? raw : [raw];
      for (const r of roots) {
        items.push(r);
        if (r['@graph']) items.push(...r['@graph']);
      }
      for (const n of items) {
        if (n['@type'] !== 'Recipe') continue;
        if (!result.totalTime && n.totalTime)  result.totalTime = n.totalTime;
        if (!result.prepTime  && n.prepTime)   result.prepTime  = n.prepTime;
        if (!result.cookTime  && n.cookTime)   result.cookTime  = n.cookTime;
        if (!result.prepTime  && n.prepTime)   result.prepTime  = n.prepTime;
      }
    } catch(e) {}
  }

  // Microdata fallback
  if (!result.totalTime) {
    const tt = document.querySelector('[itemprop="totalTime"]');
    if (tt) result.totalTime = tt.getAttribute('content') || tt.textContent.trim() || null;
  }
  if (!result.prepTime) {
    const pt = document.querySelector('[itemprop="prepTime"]');
    if (pt) result.prepTime = pt.getAttribute('content') || pt.textContent.trim() || null;
  }
  if (!result.cookTime) {
    const ct = document.querySelector('[itemprop="cookTime"]');
    if (ct) result.cookTime = ct.getAttribute('content') || ct.textContent.trim() || null;
  }

  // Grab first 3000 chars of body text for regex fallback
  result.bodySnippet = (document.body.innerText || '').slice(0, 3000);

  return result;
}
"""

# ── Helpers ─────────────────────────────────────────────────────────────────────

def parse_iso(s) -> Optional[int]:
    if not s:
        return None
    m = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?', str(s))
    if m:
        h    = int(m.group(1) or 0)
        mins = int(m.group(2) or 0)
        total = h * 60 + mins
        return total if total > 0 else None
    return None


def extract_time_from_body(text: str) -> Optional[int]:
    """Regex scan of visible page text for time mentions."""
    patterns = [
        r'total\s+time[:\s]+(\d+)\s*(?:to\s*\d+\s*)?(?:hours?|hrs?)',
        r'total\s+time[:\s]+(\d+)\s*(?:to\s*\d+\s*)?(?:minutes?|mins?)',
        r'cook\s+time[:\s]+(\d+)\s*(?:to\s*\d+\s*)?(?:hours?|hrs?)',
        r'cook\s+time[:\s]+(\d+)\s*(?:to\s*\d+\s*)?(?:minutes?|mins?)',
        r'prep\s+time[:\s]+(\d+)\s*(?:to\s*\d+\s*)?(?:hours?|hrs?)',
        r'prep\s+time[:\s]+(\d+)\s*(?:to\s*\d+\s*)?(?:minutes?|mins?)',
        r'(\d+)\s*(?:to\s*\d+\s*)?(?:minutes?|mins?)\s+(?:total|cook|prep)',
        r'takes?\s+(?:about\s+)?(\d+)\s*(?:to\s*\d+\s*)?(?:minutes?|mins?)',
        r'ready\s+in\s+(\d+)\s*(?:to\s*\d+\s*)?(?:minutes?|mins?)',
        r'in\s+(?:just\s+)?(\d+)\s*(?:to\s*\d+\s*)?(?:minutes?|mins?)',
    ]
    lower = text.lower()
    for pat in patterns:
        m = re.search(pat, lower)
        if m:
            val = int(m.group(1))
            # sanity: 1–480 minutes
            if 'hour' in pat or 'hr' in pat:
                val *= 60
            if 1 <= val <= 480:
                return val
    return None


def calc_from_data(data: dict) -> Optional[int]:
    total = parse_iso(data.get('totalTime'))
    if total:
        return total
    p = parse_iso(data.get('prepTime'))
    c = parse_iso(data.get('cookTime'))
    combined = (p or 0) + (c or 0)
    return combined if combined > 0 else None


# ── Claude estimation ────────────────────────────────────────────────────────────

import urllib.request

def claude_estimate(name: str, ingredients: list) -> Optional[int]:
    """Ask Claude to estimate total cook time in minutes."""
    if not ANTHROPIC_KEY:
        return None

    ingr_str = ', '.join(ingredients[:20]) if ingredients else 'unknown'
    prompt = (
        f'Recipe: {name}\n'
        f'Ingredients: {ingr_str}\n\n'
        'Estimate the realistic total time (prep + cook) in minutes for a home cook. '
        'Reply with ONLY a single integer (the number of minutes). No explanation.'
    )

    body = json.dumps({
        'model': 'claude-haiku-4-5-20251001',
        'max_tokens': 10,
        'messages': [{'role': 'user', 'content': prompt}],
    }).encode()

    req = urllib.request.Request(
        'https://api.anthropic.com/v1/messages',
        data=body,
        headers={
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            text = data['content'][0]['text'].strip()
            val = int(re.search(r'\d+', text).group())
            return val if 1 <= val <= 480 else None
    except Exception as e:
        print(f'    Claude error: {e}')
        return None


# ── Async scraper ────────────────────────────────────────────────────────────────

async def scrape_all(recipes: list) -> list:
    from playwright.async_api import async_playwright

    results = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=['--disable-blink-features=AutomationControlled'],
        )
        context = await browser.new_context(
            user_agent=(
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/120.0.0.0 Safari/537.36'
            ),
            viewport={'width': 1280, 'height': 800},
            locale='en-US',
        )
        page = await context.new_page()

        for i, r in enumerate(recipes):
            url    = r.get('url', '')
            name   = r['name'][:55]
            doc_id = r['id']
            ingr   = r.get('ingredients', [])

            print(f'  [{i+1}/{len(recipes)}]  {name}', flush=True)

            found_time = None
            source     = ''

            if url:
                try:
                    await page.goto(url, timeout=20000, wait_until='domcontentloaded')
                    data = await page.evaluate(EXTRACT_JS)

                    found_time = calc_from_data(data)
                    if found_time:
                        source = 'json-ld'
                    else:
                        found_time = extract_time_from_body(data.get('bodySnippet', ''))
                        if found_time:
                            source = 'body-text'

                except Exception as e:
                    print(f'    scrape error: {str(e)[:60]}', flush=True)

            if not found_time:
                found_time = claude_estimate(name, ingr)
                if found_time:
                    source = 'claude-estimate'

            if found_time:
                print(f'    → {found_time} min  [{source}]', flush=True)
                results.append({'id': doc_id, 'prep_time': found_time, 'source': source})
            else:
                print(f'    → no time found', flush=True)
                results.append({'id': doc_id, 'prep_time': None, 'source': 'none'})

        await browser.close()

    return results


# ── Main ─────────────────────────────────────────────────────────────────────────

def main():
    label = '[DRY RUN] ' if args.dry_run else ''
    print(f'CKC Fill Missing Times {label}')
    print()

    if not ANTHROPIC_KEY:
        print('WARNING: ANTHROPIC_API_KEY not set — Claude fallback disabled.')
        print()

    print('Loading approved recipes missing time from Firestore…')
    snap = db.collection('recipes').where('status', '==', 'yes').limit(2000).stream()
    recipes = []
    for doc in snap:
        data = doc.to_dict()
        if not data.get('prep_time') and not data.get('totalTime') and not data.get('cook_time') \
                and not data.get('cookTime') and not data.get('prepTime'):
            recipes.append({
                'id':          doc.id,
                'name':        data.get('name', ''),
                'url':         data.get('url', ''),
                'ingredients': data.get('ingredients', []),
            })

    total = len(recipes)
    if args.limit > 0:
        recipes = recipes[:args.limit]

    print(f'  {total} recipes missing time data')
    if args.limit > 0:
        print(f'  Processing first {len(recipes)} (--limit {args.limit})')
    print()

    results = asyncio.run(scrape_all(recipes))

    # Tally
    by_source = {}
    for res in results:
        s = res['source']
        by_source[s] = by_source.get(s, 0) + 1

    # Write
    wrote = 0
    if not args.dry_run:
        for res in results:
            if res['prep_time']:
                db.collection('recipes').document(res['id']).update({
                    'prep_time': res['prep_time'],
                    'prep_time_source': res['source'],
                })
                wrote += 1

    print()
    print('── Done ' + '─' * 50)
    for src, count in sorted(by_source.items()):
        print(f'  {src:20s} {count}')
    if args.dry_run:
        print()
        print('  DRY RUN — nothing written to Firestore.')
        print('  Run without --dry-run to apply.')
    else:
        print(f'  Firestore docs updated: {wrote}')


if __name__ == '__main__':
    main()
