#!/usr/bin/env python3
"""
scrape_ingredients.py
======================
Scrapes raw ingredient strings from all approved recipe pages (via JSON-LD)
and saves them to ingredients.json.

Run: python3 scrape_ingredients.py
Output: ingredients.json  →  { "Recipe Title": ["ingredient 1", ...], ... }
"""

import csv, json, time, os
import requests
from bs4 import BeautifulSoup

CSV_FILE      = 'recipes_source.csv'
OUTPUT_FILE   = 'ingredients.json'
PROGRESS_FILE = 'ingredients_progress.json'
SLEEP_SEC     = 0.7

SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
})

def fetch_ingredients(url):
    try:
        resp = SESSION.get(url, timeout=14)
        if resp.status_code != 200:
            return []
        soup = BeautifulSoup(resp.text, 'html.parser')
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data = json.loads(script.string or '')
                items = data if isinstance(data, list) else [data]
                for item in items:
                    if isinstance(item, dict):
                        if item.get('@type') == 'Recipe':
                            return [str(i).strip() for i in item.get('recipeIngredient', []) if str(i).strip()]
                        for sub in item.get('@graph', []):
                            if isinstance(sub, dict) and sub.get('@type') == 'Recipe':
                                return [str(i).strip() for i in sub.get('recipeIngredient', []) if str(i).strip()]
            except Exception:
                pass
        return []
    except Exception:
        return []

def main():
    # Load existing progress
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE) as f:
            result = json.load(f)
        print(f"Resuming — {len(result)} already done")
    else:
        result = {}

    # Load recipes
    with open(CSV_FILE, newline='', encoding='utf-8-sig') as f:
        rows = [r for r in csv.DictReader(f)
                if r.get('Recipe Title','').strip() and r.get('URL','').strip()]

    todo = [(r.get('Recipe Title','').strip(), r.get('URL','').strip())
            for r in rows if r.get('Recipe Title','').strip() not in result]

    print(f"Total recipes: {len(rows)} | Still to scrape: {len(todo)}")

    for i, (title, url) in enumerate(todo):
        print(f"  [{i+1}/{len(todo)}] {title[:55]}", end='', flush=True)
        ings = fetch_ingredients(url)
        result[title] = ings
        print(f" ({len(ings)} ingredients)" if ings else " — no data")

        if (i + 1) % 25 == 0:
            with open(PROGRESS_FILE, 'w') as f:
                json.dump(result, f)
            print(f"    → Saved progress ({i+1} done)")

        time.sleep(SLEEP_SEC)

    # Final save
    with open(PROGRESS_FILE, 'w') as f:
        json.dump(result, f)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(result, f, indent=2)

    have_data = sum(1 for v in result.values() if v)
    print(f"\nDone. {have_data}/{len(result)} recipes have ingredient data.")
    print(f"Saved to {OUTPUT_FILE}")

if __name__ == '__main__':
    main()
