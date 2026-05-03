#!/bin/bash
# ─────────────────────────────────────────────────────────────
# run_enrichment.sh
# Enriches YES recipes in batches of 10 — one agent call per batch.
#
# Usage:
#   bash scripts/run_enrichment.sh             # all recipes
#   bash scripts/run_enrichment.sh --limit 50  # first 50 only
# ─────────────────────────────────────────────────────────────

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

BATCH_SIZE=10

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

NODE_BIN=/usr/local/bin/node

# Optional flags
LIMIT=0
QUEUE_SCRIPT="scripts/get_enrichment_queue.js"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --limit) LIMIT="$2"; shift 2 ;;
    --queue) QUEUE_SCRIPT="$2"; shift 2 ;;
    *) shift ;;
  esac
done

echo "CKC Recipe Enrichment (batch size: $BATCH_SIZE)"
echo "Loading queue from $QUEUE_SCRIPT..."

QUEUE=$("$NODE_BIN" "$QUEUE_SCRIPT" 2>/dev/null)
TOTAL=$(echo "$QUEUE" | grep -c . || true)

if [ -z "$QUEUE" ] || [ "$TOTAL" -eq 0 ]; then
  echo "Queue empty — all recipes are enriched."
  exit 0
fi

if [ "$LIMIT" -gt 0 ] 2>/dev/null; then
  QUEUE=$(echo "$QUEUE" | head -n "$LIMIT")
  TOTAL="$LIMIT"
  echo "$TOTAL recipes to enrich (limited)"
else
  echo "$TOTAL recipes to enrich"
fi
echo ""

DONE=0
FAILED=0
BATCH_NUM=0
IDS=()

process_batch() {
  local ids=("$@")
  local count="${#ids[@]}"
  BATCH_NUM=$((BATCH_NUM + 1))

  echo "── Batch $BATCH_NUM ($count recipes) ──────────────────────"

  # Build combined recipe data block
  COMBINED=""
  for id in "${ids[@]}"; do
    DATA=$("$NODE_BIN" scripts/get_recipe_for_enrichment.js "$id" 2>/dev/null)
    NAME=$(echo "$DATA" | grep '^NAME:' | sed 's/NAME: //')
    echo "  $NAME"
    COMBINED="$COMBINED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
$DATA
"
  done

  PROMPT="Follow the instructions in .claude/agent/enrich-batch.md to enrich this batch of $count recipes.

$COMBINED"

  "$CLAUDE_BIN" --dangerously-skip-permissions -p "$PROMPT" 2>/dev/null
  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ]; then
    DONE=$((DONE + count))
    echo "  ✓ batch done"
  else
    FAILED=$((FAILED + count))
    echo "  ✗ batch failed (exit $EXIT_CODE)"
  fi
  echo ""
}

# Loop through queue in batches
BATCH_IDS=()
while IFS= read -r DOC_ID; do
  [ -z "$DOC_ID" ] && continue
  BATCH_IDS+=("$DOC_ID")

  if [ "${#BATCH_IDS[@]}" -eq "$BATCH_SIZE" ]; then
    process_batch "${BATCH_IDS[@]}"
    BATCH_IDS=()
  fi
done <<< "$QUEUE"

# Process any remaining
if [ "${#BATCH_IDS[@]}" -gt 0 ]; then
  process_batch "${BATCH_IDS[@]}"
fi

echo "═════════════════════════════════════════"
echo "Enriched: $DONE / $TOTAL"
if [ "$FAILED" -gt 0 ]; then
  echo "Failed:   $FAILED"
fi
