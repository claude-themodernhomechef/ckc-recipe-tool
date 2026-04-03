#!/usr/bin/env python3
"""
migrate_to_unified.py
=====================
One-time migration to consolidate recipes + decisions into a single
unified 'recipes' collection with a 'status' field.

Steps:
  1. Update existing 299 'recipes' docs → add status: "yes", rename description→menuDescription
  2. Migrate YES decisions (~998) → new 'recipes' docs (deduplicated by URL)
  3. Migrate NO/MAYBE decisions → new 'recipes' docs (bare fields)

Resume-safe: progress tracked in migrate_progress.json

Usage:
  python3 migrate_to_unified.py --dry-run   # preview counts only
  python3 migrate_to_unified.py             # run migration
  python3 migrate_to_unified.py --step 1    # run only step 1
"""

import json, os, sys, argparse, time
import firebase_admin
from firebase_admin import credentials, firestore as fs_module

# ── Config ──────────────────────────────────────────────────────────────────────
SA_KEY         = 'service-account.json'
PROGRESS_FILE  = 'migrate_progress.json'
SLEEP_SEC      = 0.05   # small delay between writes to avoid rate limiting

# ── CLI args ────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument('--dry-run', action='store_true', help='Preview counts only, no writes')
parser.add_argument('--step',    type=int, default=0, help='Run only a specific step (1, 2, or 3)')
args = parser.parse_args()

# ── Firebase init ────────────────────────────────────────────────────────────────
def init_firebase():
    if not firebase_admin._apps:
        cred = credentials.Certificate(SA_KEY)
        firebase_admin.initialize_app(cred)
    return fs_module.client()

# ── Progress tracking ────────────────────────────────────────────────────────────
def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE) as f:
            return json.load(f)
    return {
        'step1_done': False,
        'step2_migrated_ids': [],   # decision doc IDs already migrated
        'step3_migrated_ids': [],
    }

def save_progress(prog):
    with open(PROGRESS_FILE, 'w') as f:
        json.dump(prog, f, indent=2)

# ── Step 1: Update existing 299 recipes docs ─────────────────────────────────────
def step1_update_existing_recipes(db, dry_run):
    print('\n── Step 1: Update existing recipes docs ──')
    recipes_ref = db.collection('recipes')
    docs = list(recipes_ref.stream())
    print(f'  Found {len(docs)} existing recipes docs')

    needs_update = []
    for doc in docs:
        data = doc.to_dict()
        updates_needed = {}

        # Add status: "yes" if missing
        if 'status' not in data:
            updates_needed['status'] = 'yes'

        # Rename description → menuDescription if menuDescription is absent
        # (In the existing 299 docs, 'description' was used for both og:description
        #  and Claude-generated menu descriptions. We keep 'description' as-is
        #  and also set menuDescription from it if the description looks like
        #  a semicolon-separated menu description — otherwise leave menuDescription blank)
        if 'menuDescription' not in data and data.get('description'):
            desc = data['description']
            # Heuristic: if it contains semicolons it's a menu description
            if ';' in desc:
                updates_needed['menuDescription'] = desc
                updates_needed['description'] = ''  # clear the old field
            # Otherwise leave description as-is (it's an og:description)

        # Mark as already enriched (they have dietTags etc.)
        if 'enrichedAt' not in data and data.get('dietTags'):
            updates_needed['enrichedAt'] = fs_module.SERVER_TIMESTAMP

        if updates_needed:
            needs_update.append((doc.id, updates_needed))

    print(f'  {len(needs_update)} docs need updates')
    if dry_run:
        print('  [dry-run] Skipping writes')
        return

    for doc_id, updates in needs_update:
        db.collection('recipes').document(doc_id).update(updates)
        time.sleep(SLEEP_SEC)
        print(f'  Updated {doc_id[:12]}…', end='\r')

    print(f'\n  ✓ Step 1 complete: {len(needs_update)} docs updated')

# ── Step 2: Migrate YES decisions → recipes ──────────────────────────────────────
def step2_migrate_yes_decisions(db, dry_run, prog):
    print('\n── Step 2: Migrate YES decisions → recipes ──')

    # Build set of existing recipe URLs for deduplication
    print('  Loading existing recipe URLs…')
    existing_urls = set()
    for doc in db.collection('recipes').stream():
        url = doc.to_dict().get('url', '').strip().rstrip('/')
        if url:
            existing_urls.add(url)
    print(f'  {len(existing_urls)} existing recipe URLs loaded')

    # Load YES decisions
    print('  Loading YES decisions…')
    yes_docs = list(
        db.collection('decisions').where('decision', '==', 'YES').stream()
    )
    print(f'  Found {len(yes_docs)} YES decisions')

    already_migrated = set(prog.get('step2_migrated_ids', []))
    skipped_dups = 0
    migrated = 0
    errors = 0

    for doc in yes_docs:
        if doc.id in already_migrated:
            continue

        data = doc.to_dict()
        url = (data.get('url') or '').strip().rstrip('/')

        # Dedup by URL
        if url and url in existing_urls:
            skipped_dups += 1
            already_migrated.add(doc.id)
            continue

        # Build new unified recipe doc
        new_doc = {
            'status':    'yes',
            'decidedAt': data.get('decidedAt'),
            'createdAt': data.get('decidedAt'),  # use decidedAt as createdAt fallback

            # Core fields (map from decisions schema)
            'name':           data.get('name', ''),
            'url':            url,
            'image':          data.get('image', ''),
            'blogger':        data.get('blogger', ''),
            'rating':         data.get('rating', ''),
            'protein':        data.get('protein', ''),
            'alignmentScore': data.get('alignmentScore'),
            'course':         data.get('mealType', ''),      # mealType → course
            'cuisine':        data.get('cuisineStyle', ''),  # cuisineStyle → cuisine
            'description':    data.get('notes', ''),         # notes → description

            # Enrichment fields (keep if present, else blank — Cloud Function will fill)
            'dietTags':        data.get('dietTags') or {},
            'chefsNotes':      data.get('chefsNotes', ''),
            'menuDescription': '',  # not present in decisions, will be generated
            'ingredients':     data.get('ingredients') or [],

            # Mark enrichment status
            'enrichedAt': None,  # Cloud Function will set this after enriching
        }

        # If recipe has dietTags already, mark enrichedAt so Cloud Function skips it
        if new_doc['dietTags'] and any(new_doc['dietTags'].values()):
            new_doc['enrichedAt'] = data.get('decidedAt')

        if dry_run:
            migrated += 1
            already_migrated.add(doc.id)
            if url:
                existing_urls.add(url)
            continue

        try:
            db.collection('recipes').add(new_doc)
            if url:
                existing_urls.add(url)
            migrated += 1
            already_migrated.add(doc.id)
            prog['step2_migrated_ids'] = list(already_migrated)
            if migrated % 50 == 0:
                save_progress(prog)
                print(f'  Migrated {migrated} so far…')
            time.sleep(SLEEP_SEC)
        except Exception as e:
            print(f'\n  ERROR on {doc.id}: {e}')
            errors += 1

    prog['step2_migrated_ids'] = list(already_migrated)
    if not dry_run:
        save_progress(prog)

    print(f'\n  ✓ Step 2 complete: {migrated} migrated, {skipped_dups} skipped (dups), {errors} errors')
    return migrated

# ── Step 3: Migrate NO/MAYBE decisions → recipes ─────────────────────────────────
def step3_migrate_no_maybe_decisions(db, dry_run, prog):
    print('\n── Step 3: Migrate NO/MAYBE decisions → recipes ──')

    # Build set of existing recipe URLs
    print('  Loading existing recipe URLs…')
    existing_urls = set()
    for doc in db.collection('recipes').stream():
        url = doc.to_dict().get('url', '').strip().rstrip('/')
        if url:
            existing_urls.add(url)

    # Load NO + MAYBE decisions
    no_docs    = list(db.collection('decisions').where('decision', '==', 'NO').stream())
    maybe_docs = list(db.collection('decisions').where('decision', '==', 'MAYBE').stream())
    print(f'  Found {len(no_docs)} NO, {len(maybe_docs)} MAYBE decisions')

    already_migrated = set(prog.get('step3_migrated_ids', []))
    migrated = 0
    skipped_dups = 0
    errors = 0

    for doc in no_docs + maybe_docs:
        if doc.id in already_migrated:
            continue

        data  = doc.to_dict()
        url   = (data.get('url') or '').strip().rstrip('/')
        decision = data.get('decision', 'NO').lower()

        if url and url in existing_urls:
            skipped_dups += 1
            already_migrated.add(doc.id)
            continue

        new_doc = {
            'status':    decision,   # "no" or "maybe"
            'decidedAt': data.get('decidedAt'),
            'createdAt': data.get('decidedAt'),
            'name':      data.get('name', ''),
            'url':       url,
            'image':     data.get('image', ''),
            'blogger':   data.get('blogger', ''),
            'rating':    data.get('rating', ''),
            'protein':   data.get('protein', ''),
            'course':    data.get('mealType', ''),
            'cuisine':   data.get('cuisineStyle', ''),
            'description': data.get('notes', ''),
            'alignmentScore': data.get('alignmentScore'),
        }

        if dry_run:
            migrated += 1
            already_migrated.add(doc.id)
            if url:
                existing_urls.add(url)
            continue

        try:
            db.collection('recipes').add(new_doc)
            if url:
                existing_urls.add(url)
            migrated += 1
            already_migrated.add(doc.id)
            prog['step3_migrated_ids'] = list(already_migrated)
            if migrated % 100 == 0:
                save_progress(prog)
                print(f'  Migrated {migrated} so far…')
            time.sleep(SLEEP_SEC)
        except Exception as e:
            print(f'\n  ERROR on {doc.id}: {e}')
            errors += 1

    prog['step3_migrated_ids'] = list(already_migrated)
    if not dry_run:
        save_progress(prog)

    print(f'\n  ✓ Step 3 complete: {migrated} migrated, {skipped_dups} skipped (dups), {errors} errors')
    return migrated

# ── Main ─────────────────────────────────────────────────────────────────────────
def main():
    print('=== CKC Unified Migration ===')
    if args.dry_run:
        print('[DRY RUN — no writes will be made]\n')

    db   = init_firebase()
    prog = load_progress()

    run_step = args.step  # 0 = all steps

    if run_step in (0, 1):
        if not prog.get('step1_done') or run_step == 1:
            step1_update_existing_recipes(db, args.dry_run)
            if not args.dry_run:
                prog['step1_done'] = True
                save_progress(prog)
        else:
            print('\n── Step 1: Already done (skipping) ──')

    if run_step in (0, 2):
        step2_migrate_yes_decisions(db, args.dry_run, prog)

    if run_step in (0, 3):
        step3_migrate_no_maybe_decisions(db, args.dry_run, prog)

    # Final count
    if not args.dry_run:
        total = db.collection('recipes').count().get()[0][0].value
        print(f'\n=== Migration complete ===')
        print(f'Total recipes in collection: {total}')
    else:
        print(f'\n=== Dry run complete — no changes made ===')

if __name__ == '__main__':
    main()
