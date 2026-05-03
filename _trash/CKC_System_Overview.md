# CKC Recipe Tool — System Overview
*Last updated: April 2026*

---

## What This Tool Is

CKC is a recipe discovery and meal planning app for people following specific dietary protocols (AIP, Low-FODMAP, Keto, Gluten-Free, Dairy-Free, Vegan, Vegetarian, Low-Histamine). You curate the recipe library. Consumers browse, swipe, and plan meals from whatever you've approved.

This document explains the full pipeline from finding a recipe on the internet to it appearing on a consumer's phone.

---

## The Full Pipeline

```
1. Find a recipe online
       ↓
2. Scheduled scraper pulls it into Firestore (automatic, weekly)
       ↓
3. You swipe on it in the Admin app
       ↓  (swipe right = YES)
4. Cloud function enriches it automatically (no computer needed)
       ↓  (takes ~30–60 seconds)
5. Uncertain diet tags flagged during enrichment appear in Needs Review
       ↓  (resolve each flag: Compliant / Replace / Remove / Skip)
6. Enriched recipe appears in your Review Queue
       ↓
7. You review it, edit anything that's wrong, approve it
       ↓
8. Recipe goes live on the consumer app
```

---

## Step-by-Step Breakdown

### Step 1–2: Finding & Scraping
A scheduled weekly task automatically finds and pulls new recipes into the database (Firestore) with a status of `pending`. You don't need to do anything here.

### Step 3: Swiping
You go to **ckc-recipe-tool.vercel.app/admin** and swipe through the pending recipes:
- **Swipe right** → status becomes `yes` → triggers enrichment immediately
- **Swipe left** → status becomes `no` → ignored
- **Swipe up** → status becomes `maybe` → goes into a maybe pile for later

### Step 4: Enrichment Cloud Function (automatic)
The moment a recipe is swiped `yes`, a Firebase Cloud Function fires automatically. It does 4 things without you touching anything:

1. **Scrapes the ingredient list** from the recipe's URL
2. **Generates Chef's Notes** using Claude + your chef notes guide
3. **Verifies all 8 diet protocols** using Claude + your full compliance rulebook
4. **Checks uncertain ingredients** against the FIG product database (Supabase)
   - If a compliant product is found → diet tag confirmed
   - If only caution products found → tag flagged for your review
   - If no product found → tag set to off, flagged for your review

When enrichment is done, the recipe's `processingStatus` is set to `pending_review` if there are flagged ingredients, and its `status` changes to `needs_review`.

### Step 5: Needs Review (diet flag resolution)
You go to the **Needs Review tab** in the Admin app. This shows every recipe that had uncertain diet tags flagged during enrichment. For each flagged ingredient you can:

- **Compliant** → confirms the tag as native (no modification needed)
- **Replace** → Claude generates a swap note; you edit and approve it
- **Remove Tag** → removes the diet tag entirely
- **Skip** → leaves it unresolved for later

Once all flags on a recipe are resolved, it disappears from this screen. The recipe stays in `needs_review` status and moves to the Review Queue.

### Step 6: Review Queue
You go to the **Review Queue tab** in the Admin app. This shows every enriched recipe waiting for your approval. For each recipe you can see and edit:

- Photo, name, source URL, blogger, cuisine, course, protein, rating, servings
- All 8 diet protocol tags (Native / Mod / None) with modification notes
- Chef's Notes (auto-generated, editable)
- Full ingredient list (editable line by line)
- Shopping list preview — how the ingredients will actually appear on the consumer's shopping list, parsed and grouped by category (Protein, Produce, Dairy, Pantry, etc.)

Everything auto-saves as you type. Nothing goes live until you hit Approve.

### Step 7: Approving
- **Approve** → status becomes `approved` → recipe is immediately live on consumer app
- **Reject** → status becomes `no` → recipe is removed from queue
- **Skip** → stays in queue for later
- **Push All to Consumer** → batch-approves everything in the queue at once

---

## Status Lifecycle

Every recipe in Firestore has a `status` field. Here's what each one means:

| Status | What it means |
|--------|--------------|
| `pending` | In the swipe queue, not yet decided |
| `yes` | Swiped right — enrichment is running or complete |
| `needs_review` | Enrichment done — waiting in your Review Queue |
| `approved` | You approved it — live on consumer app |
| `no` | Rejected — not used anywhere |
| `maybe` | Held for later review |

The `processingStatus` field is separate from `status` and tracks enrichment sub-state:

| processingStatus | What it means |
|-----------------|--------------|
| `pending_review` | Has unresolved diet flags — appears in Needs Review tab |
| *(absent)* | No flags, or all flags resolved |

---

## What Runs Automatically (No Computer Needed)

- Weekly recipe scraper → pulls new recipes into Firestore
- Enrichment cloud function → fires the moment you swipe yes
- Consumer app → reads from Firestore in real time

## What Requires You

- Swiping (deciding which recipes to bring in)
- Reviewing the enriched data in the Review Queue
- Approving recipes before they go live

---

## The Ingredient Parser

The ingredient parser is the logic that converts a raw ingredient string like `"1/3 cup extra-virgin olive oil"` into a structured shopping list item: `⅓ cup · olive oil · pantry-staples`.

It handles:
- Fraction conversion (1/3 → ⅓)
- Unit normalization (tablespoon → tbsp)
- Prep instruction stripping (", thinly sliced" → removed)
- Smart comma logic (", chopped in half" strips; ", skinless" stays)
- Ingredient aliases (all olive oil variants → "olive oil")
- Category assignment (protein / produce / dairy / pantry staples / pantry consumables / frozen)
- FIG product-style descriptors preserved ("fire roasted tomatoes" stays intact)

**Where it lives:** `ckc-consumer-app/lib/ingredientParser.ts`

**Where it runs:** In the browser, at display time. It does not touch Firestore — it just formats what's already stored.

**Important:** There is currently a second copy of the parser embedded in the admin `shopping.html` page. Both need to be kept in sync when rules change. This is a known issue — a future cleanup task.

---

## Where Each Piece Lives

| What | Where | Notes |
|------|-------|-------|
| Consumer app (React Native) | `ckc-consumer-app/` | Deployed to Vercel |
| Admin panel | `ckc-consumer-app/screens/admin/` | Part of same Vercel deployment |
| Review Queue screen | `screens/admin/ReviewQueueScreen.tsx` | New — built April 2026 |
| Ingredient parser | `lib/ingredientParser.ts` | Used by consumer + admin |
| Enrichment cloud function | `functions/index.js` | Deployed to Firebase |
| Recipe database | Firestore (`recipes` collection) | Single source of truth |
| Diet compliance rules | `CKC_Diet_Compliance_Rules.md` | Fed into Claude for tag verification |
| Chef notes guide | `CKC_Chef_Notes_Guide.md` | Fed into Claude for chef notes |

---

## Known Issues / Pending Work

1. **Existing ~1,073 recipes** are currently `status: yes` in Firestore. The consumer app now filters by `approved`. These recipes need to be either batch-migrated to `approved` or run through the Review Queue before they'll show on the new consumer build. **Vercel has not been fully cut over yet — hold off until this is decided.** Note: `scripts/fix_diet_notes.js` exists to rewrite all existing diet tag notes to the current style rules (no em dashes, no science explanations, no listing compliant ingredients) before these recipes go live — run this before batch-approving.

2. **Two parser copies** — `ingredientParser.ts` and the inline parser in `shopping.html` need to stay in sync manually. Any rule change needs to be applied to both.

3. **Admin shopping.html parser** — the comma logic fix (first-word strip) was applied to `ingredientParser.ts` but not yet to `shopping.html`.
