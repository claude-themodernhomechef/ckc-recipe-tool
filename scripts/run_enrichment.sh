#!/bin/bash
# ─────────────────────────────────────────────────────────────
# run_enrichment.sh
# Enriches YES recipes missing chefNotes — one fresh agent call per recipe.
#
# Usage:
#   chmod +x scripts/run_enrichment.sh
#   ./scripts/run_enrichment.sh
# ─────────────────────────────────────────────────────────────

set -e
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "CKC Recipe Enrichment"
echo "Loading queue from Firestore..."

# Get all doc IDs needing enrichment (one per line)
QUEUE=$(/usr/local/bin/node scripts/get_enrichment_queue.js 2>/dev/null)
TOTAL=$(echo "$QUEUE" | grep -c . || true)

if [ -z "$QUEUE" ] || [ "$TOTAL" -eq 0 ]; then
  echo "Queue empty — all recipes are enriched."
  exit 0
fi

echo "$TOTAL recipes to enrich"
echo ""

COUNT=0
DONE=0
FAILED=0

for DOC_ID in $QUEUE; do
  COUNT=$((COUNT + 1))

  # Get recipe data for this doc
  RECIPE_DATA=$(/usr/local/bin/node scripts/get_recipe_for_enrichment.js "$DOC_ID" 2>/dev/null)
  RECIPE_NAME=$(echo "$RECIPE_DATA" | grep '^NAME:' | sed 's/NAME: //')

  echo "[$COUNT/$TOTAL] $RECIPE_NAME"

  # Run a fresh agent for this single recipe
  claude --dangerously-skip-permissions -p "
Read these two files in full before doing anything else:
1. docs/CKC_Chef_Notes_Guide.md
2. .claude/agent/diet-compliance-rules.md

Then enrich the recipe below following the instructions in .claude/agent/enrich-single-recipe.md.

---
$RECIPE_DATA
" 2>/dev/null

  if [ $? -eq 0 ]; then
    DONE=$((DONE + 1))
    echo "  ✓ done"
  else
    FAILED=$((FAILED + 1))
    echo "  ✗ failed"
  fi

  echo ""
done

echo "─────────────────────────────────────"
echo "Enriched: $DONE / $TOTAL"
if [ "$FAILED" -gt 0 ]; then
  echo "Failed:   $FAILED"
fi
