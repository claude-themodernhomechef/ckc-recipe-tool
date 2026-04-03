#!/usr/bin/env python3
"""
Mod-Only Enrichment Pass
========================
Targets recipes that already have native tags set but were never evaluated
for modification notes. Re-scrapes each page, evaluates all mod columns,
and writes results WITHOUT touching existing native tags.

Run:  python3 enrich_mods_only.py
Resume-safe via mods_progress.json
"""

import csv, json, re, sys, time, os
import requests
from bs4 import BeautifulSoup

# Import classify_diet_tags from the main enrich script
sys.path.insert(0, os.path.dirname(__file__))
from enrich_recipes import (
    classify_diet_tags, fetch_recipe_json_ld,
    SESSION, TAGS
)

CSV_FILE     = 'recipes_source.csv'
PROGRESS_LOG = 'mods_progress.json'
SLEEP_SEC    = 0.8


def needs_mods(row):
    """True if recipe has at least one native tag but NO mod notes at all."""
    has_native = any((row.get(t) or '').strip() == '1' for t in TAGS)
    has_mods   = any((row.get(f'{t} Mod') or '').strip() == '1' for t in TAGS)
    was_scraped = (row.get('Rating') or '').strip() not in ('', 'NR')
    return has_native and not has_mods and was_scraped


def main():
    with open(CSV_FILE, newline='', encoding='utf-8-sig') as f:
        rows = list(csv.DictReader(f))
        f.seek(0)
        fieldnames = list(csv.DictReader(f).fieldnames)

    progress = {}
    if os.path.exists(PROGRESS_LOG):
        with open(PROGRESS_LOG) as f:
            progress = json.load(f)
        print(f'Resuming — {len(progress)} entries already done\n')

    to_process = [
        r for r in rows
        if (r.get('Recipe Title') or '').strip()
        and (r.get('URL') or '').strip()
        and needs_mods(r)
        and (r.get('Recipe Title', '').strip() not in progress)
    ]

    print(f'Recipes needing mod-only pass: {len(to_process)}\n')

    for i, row in enumerate(to_process):
        title   = row['Recipe Title'].strip()
        url     = row['URL'].strip()
        blogger = (row.get('Blogger Name') or '').strip()

        print(f'[{i+1}/{len(to_process)}] {title[:65]}')

        ld = fetch_recipe_json_ld(url)

        if ld and ld.get('recipeIngredient'):
            new_tags = classify_diet_tags(
                ld['recipeIngredient'],
                recipe_title=title,
                blogger_name=blogger,
            )
            # Only keep MOD results — do not overwrite native tags
            mod_only = {
                t: v for t, v in new_tags.items()
                if v.get('mod') and not v.get('native')
            }
            progress[title] = {'mods': mod_only}
            summary = ', '.join(f'{t} (mod)' for t in mod_only) or 'none'
            print(f'    mods → {summary}')
        else:
            progress[title] = {'mods': {}}
            print(f'    mods → skipped (no ingredients in JSON-LD)')

        with open(PROGRESS_LOG, 'w') as f:
            json.dump(progress, f, indent=2)

        time.sleep(SLEEP_SEC)

    # Apply mod results to CSV — only write Mod and Mod Notes columns
    print('\nApplying mod results to CSV...')
    updated = 0

    for row in rows:
        title = (row.get('Recipe Title') or '').strip()
        if title not in progress:
            continue
        res = progress[title]
        mods = res.get('mods', {})

        if mods and needs_mods(row):
            for tag, info in mods.items():
                # Only write mod columns — never touch native tag columns
                row[f'{tag} Mod']       = '1' if info.get('mod') else ''
                row[f'{tag} Mod Notes'] = info.get('notes', '')
            updated += 1

    with open(CSV_FILE, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f'\n✓ Done!')
    print(f'  Mod rows updated: {updated}')
    print(f'  CSV saved → {CSV_FILE}')


if __name__ == '__main__':
    main()
