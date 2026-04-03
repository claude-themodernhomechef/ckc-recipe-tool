#!/usr/bin/env python3
"""
scrape_ratings.py
=================
Scrapes ratingValue + ratingCount from each YES recipe's JSON-LD,
saves to ratings.json, then batch-updates Firebase.

Run:  python3 scrape_ratings.py
"""

import json, time, os, re
import requests
from bs4 import BeautifulSoup
import firebase_admin
from firebase_admin import credentials, firestore

# ── Config ─────────────────────────────────────
OUTPUT_FILE   = 'ratings.json'
PROGRESS_FILE = 'ratings_progress.json'
SLEEP_SEC     = 0.6

SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
})

# ── Firebase ────────────────────────────────────
def init_firebase():
    if not firebase_admin._apps:
        cred_path = os.path.expanduser('~/.config/ckc-firebase-key.json')
        if not os.path.exists(cred_path):
            # Try local key
            for name in ['firebase-key.json', 'serviceAccount.json', 'serviceAccountKey.json']:
                if os.path.exists(name):
                    cred_path = name
                    break
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    return firestore.client()

# ── Scrape one URL ──────────────────────────────
def fetch_rating(url: str) -> dict:
    """Return {'ratingValue': float, 'ratingCount': int} or empty dict."""
    try:
        resp = SESSION.get(url, timeout=14)
        if resp.status_code != 200:
            return {}
        soup = BeautifulSoup(resp.text, 'html.parser')

        # 1. Try JSON-LD
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data = json.loads(script.string or '')
                items = data if isinstance(data, list) else [data]
                for item in items:
                    if isinstance(item, dict):
                        recipe = None
                        if item.get('@type') == 'Recipe':
                            recipe = item
                        else:
                            for sub in item.get('@graph', []):
                                if isinstance(sub, dict) and sub.get('@type') == 'Recipe':
                                    recipe = sub
                                    break
                        if recipe:
                            agg = recipe.get('aggregateRating', {})
                            if agg:
                                rv = agg.get('ratingValue') or agg.get('bestRating') or ''
                                rc = agg.get('ratingCount') or agg.get('reviewCount') or ''
                                try:
                                    rv = round(float(str(rv).strip()), 1)
                                    rc = int(str(rc).strip())
                                    if 0 < rv <= 5 and rc > 0:
                                        return {'ratingValue': rv, 'ratingCount': rc}
                                except (ValueError, TypeError):
                                    pass
            except Exception:
                pass

        # 2. Fallback: look for schema.org microdata
        rating_el = soup.find(itemprop='ratingValue')
        count_el  = soup.find(itemprop='ratingCount') or soup.find(itemprop='reviewCount')
        if rating_el and count_el:
            try:
                rv = round(float(rating_el.get('content', rating_el.text).strip()), 1)
                rc = int(count_el.get('content', count_el.text).strip())
                if 0 < rv <= 5 and rc > 0:
                    return {'ratingValue': rv, 'ratingCount': rc}
            except (ValueError, TypeError):
                pass

        return {}
    except Exception:
        return {}


def main():
    # Load yes recipes
    with open('yes_recipes.json') as f:
        recipes = json.load(f)
    print(f"YES recipes: {len(recipes)}")

    # Load existing progress
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE) as f:
            result = json.load(f)
        print(f"Resuming — {len(result)} already processed")
    else:
        result = {}

    todo = [r for r in recipes if r['id'] not in result]
    print(f"Remaining: {len(todo)}")
    print()

    found = 0
    for i, recipe in enumerate(todo):
        rid   = recipe['id']
        name  = recipe['name']
        url   = recipe.get('url', '')

        print(f"  [{i+1}/{len(todo)}] {name[:55]}", end='', flush=True)

        if not url:
            result[rid] = {}
            print(" — no URL")
            continue

        rating = fetch_rating(url)
        result[rid] = rating

        if rating:
            found += 1
            print(f" ★ {rating['ratingValue']} ({rating['ratingCount']} reviews)")
        else:
            print(" — no rating")

        # Save progress every 25
        if (i + 1) % 25 == 0:
            with open(PROGRESS_FILE, 'w') as f:
                json.dump(result, f)
            print(f"    → Saved progress ({i+1} done, {found} with ratings so far)")

        time.sleep(SLEEP_SEC)

    # Final save
    with open(PROGRESS_FILE, 'w') as f:
        json.dump(result, f)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(result, f, indent=2)

    print(f"\n{'─'*60}")
    print(f"Scraping complete.")
    print(f"  Recipes with ratings : {found}/{len(recipes)}")
    print(f"  Saved to             : {OUTPUT_FILE}")
    print()

    # ── Push to Firebase ──────────────────────────
    import sys
    if sys.stdin.isatty():
        push = input("Push ratings to Firebase? [y/N] ").strip().lower()
        if push != 'y':
            print("Skipped Firebase update.")
            return
    else:
        print("Running headless — auto-pushing to Firebase…")

    print("\nInitialising Firebase…")
    db = init_firebase()

    updates = 0
    skipped = 0
    batch = db.batch()
    batch_count = 0

    for recipe in recipes:
        rid    = recipe['id']
        rating = result.get(rid, {})
        if not rating:
            skipped += 1
            continue

        # Format as "4.9 (312 ratings)"
        display = f"{rating['ratingValue']} ({rating['ratingCount']:,} ratings)"
        ref = db.collection('decisions').document(rid)
        batch.update(ref, {'rating': display})
        updates += 1
        batch_count += 1

        if batch_count == 400:
            batch.commit()
            batch = db.batch()
            batch_count = 0
            print(f"  Committed 400 updates…")

    if batch_count:
        batch.commit()

    print(f"\nFirebase update complete.")
    print(f"  Updated : {updates} recipes")
    print(f"  Skipped : {skipped} (no rating found)")


if __name__ == '__main__':
    main()
