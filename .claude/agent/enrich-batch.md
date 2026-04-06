# Batch Recipe Enrichment Agent

You will receive a batch of recipes. Process them **one at a time, in order**. Complete and write each recipe to Firestore before moving to the next.

## Before starting any recipe

Read these two files in full — once only:
1. `docs/CKC_Chef_Notes_Guide.md`
2. `docs/CKC_Diet_Compliance_Rules.md`

---

## For EACH recipe

### Step 1 — Ingredients + prep_time

Look at the INGREDIENTS section in the recipe data.

**If ingredients are listed → use them as-is. Do NOT visit the URL for ingredients.**
Only visit the URL to get `totalTime` (for prep_time), and only if `PREP_TIME: missing`.

**If INGREDIENTS says "(none — scrape from URL)" → visit the URL** and extract:
- `recipeIngredient` from JSON-LD first, fall back to page HTML
- `totalTime` from JSON-LD (ISO 8601 → integer minutes, e.g. PT45M → 45)

If the URL is blocked (NYT Cooking, etc.), skip prep_time and use whatever is available.

### Step 2 — Chef Notes

Write exactly 3 chef notes per `CKC_Chef_Notes_Guide.md`:
- Voice: "We like to…"
- Pipe-separated: `note 1 | note 2 | note 3`
- Specific to this dish — no generic tips
- Draw from: technique, sourcing, acid/brightness, flavor depth, sauce math, nutritional upgrade, practical shortcut

### Step 3 — Diet Tags

**If DIET_TAGS says "already present (all 8 protocols)" → skip this step.**

**If DIET_TAGS says "missing" or "incomplete" → generate all 8 protocols:**

Order: GF → DF → K → LF → V → Vg → AIP → LH

For each protocol, check EVERY ingredient against `docs/CKC_Diet_Compliance_Rules.md`. No guessing.

- `native: true` = compliant as written
- `mod: true` = compliant with simple swaps (include swap in notes)
- Both false = not compliant, not worth modifying
- If uncertain: set `uncertain: true` and add `reason` field explaining which ingredient and why

### Step 4 — Write to Firestore

```bash
node scripts/update_recipe_enrichment.js '<json>'
```

Fields:
- `docId` — required
- `chefNotes` — pipe-separated string
- `prep_time` — integer minutes (omit if unknown)
- `dietTags` — full 8-protocol object (omit if skipped)

After each write, print one line:
`✓ [Recipe Name] — notes ✓, prep_time: Xmin, tags: GF DF K LF V Vg AIP LH`

Then immediately move to the next recipe.

---

## Rules

- Never fabricate ingredients — use what's provided or scraped
- Never write `menuDescription`
- Check EVERY ingredient for diet tags
- If a URL is fully inaccessible and no ingredients were provided, write chefNotes only
- Do not stop between recipes — process the full batch
