#!/bin/bash
# ─────────────────────────────────────────────────────────────
# run_enrichment.sh
# Enriches YES recipes missing chefNotes — one fresh agent call per recipe.
#
# Usage:
#   bash scripts/run_enrichment.sh
# ─────────────────────────────────────────────────────────────

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Find claude binary
CLAUDE_BIN=""
for p in \
  "/usr/local/bin/claude" \
  "$HOME/.local/bin/claude" \
  "$HOME/.npm-global/bin/claude" \
  "$HOME/.vscode/extensions/anthropic.claude-code-2.1.92-darwin-arm64/resources/native-binary/claude" \
  "$HOME/Library/Application Support/Claude/claude-code-vm/2.1.87/claude"; do
  if [ -x "$p" ]; then
    CLAUDE_BIN="$p"
    break
  fi
done
if [ -z "$CLAUDE_BIN" ]; then
  echo "ERROR: claude not found. Update CLAUDE_BIN path in run_enrichment.sh."
  exit 1
fi
echo "Using claude: $CLAUDE_BIN"

NODE_BIN=/usr/local/bin/node

echo "CKC Recipe Enrichment"
echo "Loading queue from Firestore..."

QUEUE=$("$NODE_BIN" scripts/get_enrichment_queue.js 2>/dev/null)
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

  RECIPE_DATA=$("$NODE_BIN" scripts/get_recipe_for_enrichment.js "$DOC_ID" 2>/dev/null)
  RECIPE_NAME=$(echo "$RECIPE_DATA" | grep '^NAME:' | sed 's/NAME: //')

  echo "[$COUNT/$TOTAL] $RECIPE_NAME"

  # Run a fresh agent for this single recipe — errors are caught, never kill the loop
  PROMPT="Read the instructions in .claude/agent/enrich-single-recipe.md then enrich the recipe below.

---
$RECIPE_DATA
"
  "$CLAUDE_BIN" --dangerously-skip-permissions -p "$PROMPT" 2>/dev/null
  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ]; then
    DONE=$((DONE + 1))
    echo "  ✓ done"
  else
    FAILED=$((FAILED + 1))
    echo "  ✗ failed (exit $EXIT_CODE)"
  fi

  echo ""
done

echo "─────────────────────────────────────"
echo "Enriched: $DONE / $TOTAL"
if [ "$FAILED" -gt 0 ]; then
  echo "Failed:   $FAILED"
fi
