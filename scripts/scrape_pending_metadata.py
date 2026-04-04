"""
scrape_pending_metadata.py
──────────────────────────
Scrapes photo_url, rating, and prep_time for status:pending recipes
that are missing image or rating data. Uses Playwright (headless Chrome)
to get past Cloudflare and JS-rendered pages. Updates Firestore directly.

Usage:
  python3 scripts/scrape_pending_metadata.py --dry-run   # preview only
  python3 scripts/scrape_pending_metadata.py             # apply to Firestore
  python3 scripts/scrape_pending_metadata.py --limit 20  # process first N only
"""

import asyncio, json, os, re, sys, time, argparse
from typing import Optional, Tuple
import firebase_admin
from firebase_admin import credentials, firestore as fs_module

# ── Config ─────────────────────────────────────────────────────────────────────
BASE      = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(BASE)
SA_KEY    = os.path.join(REPO_ROOT, 'service-account.json')

# ── CLI ────────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument('--dry-run', action='store_true', help='Preview only — no writes')
parser.add_argument('--limit',   type=int, default=0,  help='Max recipes to process (0=all)')
args = parser.parse_args()

# ── Firebase ───────────────────────────────────────────────────────────────────
if not firebase_admin._apps:
    cred = credentials.Certificate(SA_KEY)
    firebase_admin.initialize_app(cred)
db = fs_module.client()

# ── JS to run in the browser page ─────────────────────────────────────────────
EXTRACT_JS = """
() => {
  const result = { img: '', rating: null, reviewCount: null, totalTime: null };

  // og:image fallback
  const og = document.querySelector('meta[property="og:image"]');
  if (og && og.content && og.content.startsWith('http')) result.img = og.content;

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

        // Image
        if (!result.img && n.image) {
          const i = Array.isArray(n.image) ? n.image[0] : n.image;
          result.img = (typeof i === 'object' ? i.url : i) || '';
        }

        // Rating
        if (n.aggregateRating) {
          result.rating      = n.aggregateRating.ratingValue  || null;
          result.reviewCount = n.aggregateRating.reviewCount  ||
                               n.aggregateRating.ratingCount  || null;
        }

        // Total time
        if (!result.totalTime) {
          result.totalTime = n.totalTime || null;
          if (!result.totalTime && n.prepTime && n.cookTime) {
            result.totalTime = '__calc__';
            result.prepTime  = n.prepTime;
            result.cookTime  = n.cookTime;
          }
        }
      }
    } catch(e) {}
  }
  return result;
}
"""

# ── Helpers ────────────────────────────────────────────────────────────────────

def parse_iso(s: str) -> Optional[int]:
    if not s or s == '__calc__':
        return None
    m = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?', str(s))
    if m:
        h    = int(m.group(1) or 0)
        mins = int(m.group(2) or 0)
        total = h * 60 + mins
        return total if total > 0 else None
    return None


def calc_total_time(data: dict) -> Optional[int]:
    total = parse_iso(data.get('totalTime') or '')
    if total:
        return total
    p = parse_iso(data.get('prepTime') or '')
    c = parse_iso(data.get('cookTime') or '')
    combined = (p or 0) + (c or 0)
    return combined if combined > 0 else None


# ── Async scraper ──────────────────────────────────────────────────────────────

async def scrape_all(recipes: list) -> list:
    from playwright.async_api import async_playwright

    results = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=['--disable-blink-features=AutomationControlled'],
        )
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
                       '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport={'width': 1280, 'height': 800},
            locale='en-US',
        )
        page = await context.new_page()

        for i, r in enumerate(recipes):
            url    = r['url']
            name   = r['name'][:55]
            doc_id = r['id']

            if not url:
                print(f'  [{i+1}/{len(recipes)}] SKIP  {name}  (no URL)')
                results.append({'id': doc_id, 'update': {}})
                continue

            try:
                await page.goto(url, timeout=20000, wait_until='domcontentloaded')
                data = await page.evaluate(EXTRACT_JS)

                update = {}

                if not r['has_photo'] and data.get('img'):
                    update['photo_url'] = data['img']

                if not r['has_rating'] and data.get('rating'):
                    try:
                        update['rating'] = str(round(float(data['rating']), 1))
                    except Exception:
                        pass

                if data.get('reviewCount'):
                    try:
                        update['review_count'] = str(int(float(data['reviewCount'])))
                    except Exception:
                        pass

                pt = calc_total_time(data)
                if pt and not r.get('has_prep_time'):
                    update['prep_time'] = pt

                status = '✓' if update else '—'
                fields = ', '.join(update.keys()) if update else 'nothing new'
                print(f'  [{i+1}/{len(recipes)}] {status}  {name}  ({fields})', flush=True)
                results.append({'id': doc_id, 'update': update})

            except Exception as e:
                print(f'  [{i+1}/{len(recipes)}] ERR  {name}  ({str(e)[:60]})', flush=True)
                results.append({'id': doc_id, 'update': {}})

        await browser.close()

    return results


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    label = '[DRY RUN] ' if args.dry_run else ''
    print(f'CKC Pending Metadata Scraper {label}')
    print()

    print('Loading pending recipes from Firestore…')
    snap = db.collection('recipes').where('status', '==', 'pending').stream()
    recipes = []
    for doc in snap:
        data = doc.to_dict()
        has_photo     = bool(data.get('photo_url') or data.get('image'))
        has_rating    = bool(data.get('rating'))
        has_prep_time = bool(data.get('prep_time'))
        if not has_photo or not has_rating:
            recipes.append({
                'id':           doc.id,
                'name':         data.get('name', ''),
                'url':          data.get('url', ''),
                'has_photo':    has_photo,
                'has_rating':   has_rating,
                'has_prep_time': has_prep_time,
            })

    total = len(recipes)
    if args.limit > 0:
        recipes = recipes[:args.limit]

    print(f'  {total} pending recipes missing photo or rating')
    if args.limit > 0:
        print(f'  Processing first {len(recipes)} (--limit {args.limit})')
    print()

    # Run async scraper
    results = asyncio.run(scrape_all(recipes))

    # Write to Firestore
    got_photo = got_rating = got_time = wrote = 0
    for res in results:
        update = res['update']
        if not update:
            continue
        if 'photo_url'    in update: got_photo  += 1
        if 'rating'       in update: got_rating  += 1
        if 'prep_time'    in update: got_time    += 1
        if not args.dry_run:
            db.collection('recipes').document(res['id']).update(update)
            wrote += 1

    print()
    print('── Done ' + '─' * 50)
    print(f'  Photos found:     {got_photo}')
    print(f'  Ratings found:    {got_rating}')
    print(f'  Prep times found: {got_time}')
    if args.dry_run:
        print()
        print('  DRY RUN — nothing written to Firestore.')
        print('  Run without --dry-run to apply.')
    else:
        print(f'  Firestore docs updated: {wrote}')


if __name__ == '__main__':
    main()
