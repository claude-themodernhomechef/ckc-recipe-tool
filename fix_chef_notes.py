#!/usr/bin/env python3
"""
fix_chef_notes.py
=================
Finds Firestore recipe documents where chefsNotes contains diet protocol
swap instructions (e.g. "Gluten-Free:", "Dairy-Free:", "Vegan:", etc.)
instead of real chef technique notes, and regenerates them via Claude.

Usage:
  python3 fix_chef_notes.py            # Preview which recipes are affected
  python3 fix_chef_notes.py --fix      # Actually regenerate and update Firestore
  python3 fix_chef_notes.py --fix --limit 20  # Fix first 20 only
"""

import os
import re
import sys
import argparse
import firebase_admin
from firebase_admin import credentials, firestore as fs_module
import anthropic

# ── Config ────────────────────────────────────────────────────────────────────
SA_KEY = 'service-account.json'

# Load the comprehensive chef notes guide
_CHEF_NOTES_GUIDE_PATH = os.path.join(os.path.dirname(__file__), 'CKC_Chef_Notes_Guide.md')
with open(_CHEF_NOTES_GUIDE_PATH) as _f:
    _CHEF_NOTES_GUIDE = _f.read()

DIET_KEYWORDS = [
    'gluten-free:', 'dairy-free:', 'vegan:', 'vegetarian:', 'keto:',
    'aip:', 'low-fodmap:', 'low-histamine:', 'low histamine:',
    'we swap the', 'we remove the', 'we replace the',
    '**gluten', '**dairy', '**vegan', '**vegetarian', '**keto', '**aip',
]

CHEF_NOTES_INSTRUCTIONS = """
VOICE: First person plural "We". Kitchen notebook tone. Include the "why" when it adds value.
MEASUREMENTS: Spices and acids in ranges (1/2-1 tsp, 1-3 tbsp). Temperatures in Fahrenheit with doneness cues.
COMPLEXITY: Match note count to dish complexity. Simple side = 1 note. Standard entree = 2-3. Multi-component = 4+.
FORMAT: Return notes as a single paragraph with notes separated by " | ". No bullet points, no headers, no bold, no diet protocol names.

NEVER mention: Gluten-Free, Dairy-Free, Vegan, Vegetarian, Keto, AIP, Low-FODMAP, Low-Histamine, or any diet compliance swaps.
NEVER use brand names.
NEVER write generic filler like "season to taste" or "use fresh ingredients."
"""


def is_bad_note(note: str) -> bool:
    """Returns True if a note looks like a diet compliance swap, not a chef tip."""
    if not note:
        return False
    lower = note.lower()
    return any(kw in lower for kw in DIET_KEYWORDS)


def regenerate_chef_note(client: anthropic.Anthropic, name: str, cuisine: str,
                          meal: str, ingredients: list) -> str:
    ing_str = ', '.join(str(i) for i in ingredients[:12]) if ingredients else 'not available'
    prompt = (
        _CHEF_NOTES_GUIDE + "\n\n"
        + CHEF_NOTES_INSTRUCTIONS + "\n\n"
        + f"Recipe to write Chef's Notes for:\n"
        + f"Name: {name}\n"
        + f"Cuisine: {cuisine}\n"
        + f"Type: {meal}\n"
        + f"Key ingredients: {ing_str}\n\n"
        + "Generate Chef's Notes for this recipe. Follow the guide above exactly.\n"
        + "Reply: CHEFS_NOTES: [text]"
    )

    try:
        response = client.messages.create(
            model='claude-haiku-4-5-20251001',
            max_tokens=500,
            messages=[{'role': 'user', 'content': prompt}]
        )
        text = response.content[0].text
        match = re.search(r'CHEFS_NOTES:\s*(.+)', text)
        return match.group(1).strip() if match else ''
    except Exception as e:
        print(f'  Claude API error: {e}')
        return ''


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--fix', action='store_true',
                        help='Actually update Firestore (default is preview only)')
    parser.add_argument('--limit', type=int, default=0,
                        help='Max number of recipes to fix (0 = no limit)')
    args = parser.parse_args()

    # Init Firebase
    if not firebase_admin._apps:
        cred = credentials.Certificate(SA_KEY)
        firebase_admin.initialize_app(cred)
    db = fs_module.client()

    # Init Claude (only needed when fixing)
    client = anthropic.Anthropic() if args.fix else None

    print('Scanning Firestore recipes for bad chef notes...\n')

    col = db.collection('recipes')
    docs = col.stream()

    bad_docs = []
    for doc in docs:
        data = doc.to_dict()
        note = data.get('chefsNotes', '') or ''
        if is_bad_note(note):
            bad_docs.append((doc.id, data, note))

    print(f'Found {len(bad_docs)} recipes with diet-swap content in chefsNotes.\n')

    if not bad_docs:
        print('Nothing to fix.')
        return

    if not args.fix:
        print('--- PREVIEW (run with --fix to update) ---\n')
        for doc_id, data, note in bad_docs[:20]:
            name = data.get('name', doc_id)
            print(f'  [{doc_id}] {name}')
            print(f'    BAD: {note[:120]}...\n')
        if len(bad_docs) > 20:
            print(f'  ... and {len(bad_docs) - 20} more.')
        return

    # Fix mode
    to_fix = bad_docs[:args.limit] if args.limit else bad_docs
    print(f'Fixing {len(to_fix)} recipes...\n')

    fixed = 0
    failed = 0
    for doc_id, data, old_note in to_fix:
        name = data.get('name', doc_id)
        cuisine = data.get('cuisine', '')
        meal = data.get('meal_type', data.get('course', ''))
        ingredients = data.get('ingredients', [])
        # ingredients may be a list of dicts or strings
        if ingredients and isinstance(ingredients[0], dict):
            ingredients = [i.get('name', '') for i in ingredients]

        print(f'  Fixing: {name}')
        new_note = regenerate_chef_note(client, name, cuisine, meal, ingredients)

        if new_note:
            col.document(doc_id).update({'chefsNotes': new_note})
            print(f'    NEW: {new_note[:100]}')
            fixed += 1
        else:
            print(f'    FAILED to generate — leaving old note in place')
            failed += 1

    print(f'\nDone. Fixed: {fixed}, Failed/cleared: {failed}')


if __name__ == '__main__':
    main()
