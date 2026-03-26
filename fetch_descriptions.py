#!/usr/bin/env python3
"""
fetch_descriptions.py
Fetches og:description from recipe URLs for any recipe missing a real description.
Run: python3 fetch_descriptions.py
"""
import json, re, sys, time
import requests
from bs4 import BeautifulSoup

SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
})

RECIPES_JSON = 'recipes.json'

def is_real_description(s):
    s = (s or '').strip()
    if not s:
        return False
    if re.match(r'^\d[\d,]*\s+ratings?$', s, re.I):
        return False
    return True

def fetch_og_description(url, timeout=10):
    try:
        r = SESSION.get(url, timeout=timeout, allow_redirects=True)
        if not r.ok:
            return None
        soup = BeautifulSoup(r.text, 'html.parser')
        # Try og:description first
        tag = soup.find('meta', property='og:description') or \
              soup.find('meta', attrs={'name': 'description'})
        if tag and tag.get('content'):
            desc = tag['content'].strip()
            # Trim to ~200 chars at a sentence boundary
            if len(desc) > 200:
                cut = desc[:200].rfind('.')
                desc = desc[:cut+1] if cut > 80 else desc[:200]
            return desc
    except Exception as e:
        print(f'    error: {e}')
    return None

def main():
    with open(RECIPES_JSON, encoding='utf-8') as f:
        recipes = json.load(f)

    need = [r for r in recipes if not is_real_description(r.get('description',''))]
    print(f'Recipes needing descriptions: {len(need)} / {len(recipes)}\n')

    updated = 0
    for i, recipe in enumerate(need):
        name = recipe.get('name','')
        url  = recipe.get('url','')
        print(f'[{i+1}/{len(need)}] {name[:55]}')
        if not url:
            print('    no URL')
            continue

        desc = fetch_og_description(url)
        if desc:
            print(f'    → {desc[:80]}')
            recipe['description'] = desc
            updated += 1
        else:
            print('    ✗ not found')

        # Save every 10 recipes
        if (i+1) % 10 == 0:
            with open(RECIPES_JSON, 'w', encoding='utf-8') as f:
                json.dump(recipes, f, indent=2, ensure_ascii=False)
            print(f'    [saved progress]')

        time.sleep(0.5)

    # Final save
    with open(RECIPES_JSON, 'w', encoding='utf-8') as f:
        json.dump(recipes, f, indent=2, ensure_ascii=False)

    print(f'\n✓ Done — updated {updated} / {len(need)} descriptions')

if __name__ == '__main__':
    main()
