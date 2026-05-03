#!/usr/bin/env python3
"""
test_usda.py
============
Quick test to verify your USDA API key is working.
Looks up 3 common ingredients and prints the nutrition data.

Usage:
  python3 scripts/test_usda.py
"""

import os, re, sys, json
import requests

# ── Load USDA API key ─────────────────────────────────────────────────────────
BASE    = os.path.dirname(os.path.abspath(__file__))
api_key = os.environ.get('USDA_API_KEY', '')
if not api_key:
    env_path = os.path.join(BASE, 'functions', '.env')
    if os.path.exists(env_path):
        m = re.search(r'USDA_API_KEY=(.+)', open(env_path).read())
        if m:
            api_key = m.group(1).strip()
if not api_key:
    print('ERROR: USDA_API_KEY not found in functions/.env')
    print('Make sure you added:  USDA_API_KEY=your_key_here')
    sys.exit(1)

print(f'✓ API key found: {api_key[:6]}...{api_key[-4:]}')
print()

# ── Test ingredients ──────────────────────────────────────────────────────────
TEST_INGREDIENTS = ['olive oil', 'garlic', 'chicken breast']

for ingredient in TEST_INGREDIENTS:
    print(f'Looking up: {ingredient}')
    print('-' * 40)

    # Search for the ingredient
    resp = requests.get(
        'https://api.nal.usda.gov/fdc/v1/foods/search',
        params={
            'api_key': api_key,
            'query': ingredient,
            'dataType': 'SR Legacy,Foundation',
            'pageSize': 1
        }
    )

    if resp.status_code != 200:
        print(f'  ERROR: HTTP {resp.status_code}')
        print(f'  {resp.text[:200]}')
        print()
        continue

    data = resp.json()
    foods = data.get('foods', [])

    if not foods:
        print(f'  No results found')
        print()
        continue

    food = foods[0]
    print(f'  Match: {food["description"]}')
    print(f'  FDC ID: {food["fdcId"]}')
    print(f'  Database: {food.get("dataType", "?")}')

    # Extract key nutrients (per 100g)
    nutrients = {n['nutrientName']: n['value'] for n in food.get('foodNutrients', [])}
    print(f'  Per 100g:')
    print(f'    Calories:  {nutrients.get("Energy", "?")} kcal')
    print(f'    Protein:   {nutrients.get("Protein", "?")} g')
    print(f'    Fat:       {nutrients.get("Total lipid (fat)", "?")} g')
    print(f'    Carbs:     {nutrients.get("Carbohydrate, by difference", "?")} g')
    print(f'    Fiber:     {nutrients.get("Fiber, total dietary", "?")} g')
    print(f'    Sodium:    {nutrients.get("Sodium, Na", "?")} mg')
    print()

print('Done! If you see nutrition numbers above, everything is working.')
