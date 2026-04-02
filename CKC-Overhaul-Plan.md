# CKC App Overhaul Plan

Single codebase. All data in Firestore. Admin inside the app. Fully automatic pipeline.

---

## The Goal

| Before | After |
|---|---|
| Static HTML admin pages | Admin screen inside the Expo app at `/admin` |
| Recipe data in JSON files in GitHub | All recipes live in Firestore |
| Python scripts run manually | Cloud Functions run automatically |
| Consumer app reads fake sample data | Consumer app reads live from Firestore |
| Agent writes to CSV → GitHub | Agent writes directly to Firestore |

---

## Phases

### Phase 0 — Fix the app so it runs cleanly
**Status: Complete**

The consumer app references files that don't exist yet (Firestore connection, sample data, some UI components). Fix those so the app builds and runs without errors.

**What gets built:**
- `ckc-consumer-app/data/sampleRecipes.ts` — Recipe type definition + sample data
- `ckc-consumer-app/lib/firestore.ts` — Stub that returns sample data (real connection comes in Phase 2)
- `ckc-consumer-app/context/UserContext.tsx` — User preferences context
- `ckc-consumer-app/context/MenuContext.tsx` — Meal plan context
- `ckc-consumer-app/screens/components/DietTag.tsx` — Diet tag badge component

**Test:** App opens, recipe cards display, swiping works, diet tag badges appear.

---

### Phase 1 — Move all recipe data into Firestore
**Status: Complete**

Write a one-time migration that puts all 1,597 recipes from `recipes.json` into Firestore. Existing curated recipes go in as `status: "yes"`. New recipes from the agent will come in as `status: "pending"`.

**What gets built:**
- Migration script (`scripts/migrate_to_firestore.js`) — reads `recipes.json`, batch-writes to Firestore
- Firestore document schema:
  ```
  name, url, cuisine, course, description, image,
  protein, rating, blogger, alignmentScore,
  dietTags { GF, DF, V, Vg, K, AIP, LF, LH } (each: native, mod, notes),
  ingredients[],
  status: "yes" | "pending" | "no" | "maybe",
  enrichedAt, decidedAt, sourceAddedAt
  ```
- Updated `firestore.rules` to support Cloud Functions and admin writes

**Test:** Firebase console shows ~1,597 recipe documents. The existing `index.html` admin swipe still works against the migrated data.

**Note:** 284 recipes have no image, 171 have no diet tags, 377 have no ingredients. These are flagged as `needsManualReview: true` — they won't block the migration.

---

### Phase 2 — Consumer app reads from Firestore
**Status: Complete**

Install Firebase in the consumer app and point it at real Firestore data instead of the sample data stub.

**What gets built:**
- Firebase installed in `ckc-consumer-app/` (`firebase` package)
- `ckc-consumer-app/lib/firebase.ts` — Firebase app initialization
- `ckc-consumer-app/lib/firestore.ts` — Real `fetchRecipes()` query (status: "yes", limit 200)

**Test:** Consumer app shows real recipes from Firestore. Diet tag filters work. Images load from Firebase Storage.

**Note:** Requires Phase 1 to be complete.

---

### Phase 3 — Enrichment Cloud Function (fires on approval)
**Status: Complete**

When an admin approves a recipe (sets `status: "yes"`), a Cloud Function fires automatically and fills in diet tags, protein classification, and description. Replaces `enrich_recipes.py` and `enrich_mods.py`.

**What gets built:**
- `functions/src/enrichment/classifyDietTags.ts` — Port of the diet tag logic from `enrich_recipes.py` (all 8 protocols: GF, DF, V, Vg, K, AIP, LF, LH including "don't gut the dish" rules)
- `functions/src/enrichment/classifyProtein.ts` — Port of `classify_protein.py`
- `functions/src/enrichment/fetchDescription.ts` — Fetches `og:description` from recipe URL
- `functions/src/index.ts` — `onRecipeApproved` Firestore trigger

**How it works:**
1. Admin swipes right on a recipe in the app
2. Firestore document updates to `status: "yes"`
3. Cloud Function detects the status change
4. Runs diet tag classification, protein detection, description fetch
5. Writes results back to the same Firestore document
6. Recipe becomes visible to consumers

**Test:** Manually set a recipe's status to "yes" in Firebase console → within 60 seconds, `dietTags`, `protein`, and `description` populate automatically.

**Note:** Requires Firebase Blaze plan (pay-as-you-go) for outbound HTTP requests. Cost at typical usage is near $0/month.

---

### Phase 4 — Weekly image scraping Cloud Function
**Status: Complete**

A scheduled Cloud Function that runs every Monday and scrapes + uploads images for any recipes still missing them. Replaces `scrape.py`.

**What gets built:**
- `functions/src/scrapeImages.ts` — Scheduled function (Mondays, 2am ET)
  - Queries Firestore for recipes where `image == null`, processes 50 per run
  - Fetches `og:image` from recipe URL
  - Converts to WebP, uploads to Firebase Storage
  - Updates Firestore `image` field
- `functions/src/scrapeImageManual.ts` — On-call function for triggering a single recipe scrape from the admin UI

**Test:** Find a recipe with no image → trigger the function → image appears in Firestore and loads in the app.

---

### Phase 5 — Admin screen inside the Expo app
**Status: Complete**

The admin swipe UI moves from `index.html` into the Expo app as a proper screen accessible at `/admin` on web. Password-gated. Includes a "maybe" queue.

**What gets built:**
- `ckc-consumer-app/screens/AdminScreen.tsx` — Password gate + swipe UI
- `ckc-consumer-app/hooks/useSwipeCard.ts` — Shared swipe hook (used by both consumer DiscoverScreen and admin screen)
- `ckc-consumer-app/screens/admin/AdminSwipeScreen.tsx` — Swipe through `status: "pending"` recipes
- `ckc-consumer-app/screens/admin/AdminMaybeScreen.tsx` — List view of `status: "maybe"` recipes
- Web URL routing: navigates to Admin screen when URL path is `/admin`
- Admin password stored as `EXPO_PUBLIC_ADMIN_PASSWORD` environment variable

**Swipe decisions:**
- Right → `status: "yes"` → triggers Phase 3 enrichment automatically
- Left → `status: "no"`
- Up → `status: "maybe"` → appears in the maybe queue for later

**Test:** Go to `/admin`, enter password, swipe through pending recipes. Approved recipe appears in consumer app within ~60 seconds.

**Note:** `index.html` can be retired after this phase is verified.

---

### Phase 6 — Claude agent writes directly to Firestore
**Status: Complete**

Update the daily GitHub Action so the Claude agent writes new recipes to Firestore as `status: "pending"` instead of appending to `recipes_source.csv` and pushing to GitHub. The MD rule files (diet compliance, blog scores, approved sources) continue to guide the agent exactly as now.

**What gets built:**
- `scripts/add_recipe_to_firestore.js` — Node.js helper script the agent calls for each new recipe
- Updated `.github/workflows/source-recipes.yml` — Removes CSV commit step, adds Firestore write step
- Updated `.claude/agent/instructions.md` — Step 4 redirected from CSV append to Firestore write
- De-duplication: uses recipe URL slug as Firestore document ID — agent can't add the same recipe twice

**Test:** Manually trigger the `source-recipes.yml` workflow → new `pending` recipes appear in Firebase console → show up in the admin swipe queue in the app.

---

### Phase 7 — Clean up the old pipeline
**Status: Complete**

Once Phases 3, 4, and 6 have been running stably for at least one week.

**What gets removed / archived:**
- `.github/workflows/update-recipes.yml` — disabled (Python pipeline, replaced by Cloud Functions)
- `index.html`, `catalog.html`, `shopping.html`, `ratio-preview.html` — retired (replaced by admin screen in app)
- Python scripts moved to `archive/` folder — kept as reference, no longer in active use
- `recipes_source.csv` — archived, Firestore is now the source of truth
- `recipes.json` — removed from active use, Vercel build no longer depends on it

**Test:** Consumer app serves live data. New recipes appear in admin queue daily. No GitHub Actions writing JSON files to the repo.

---

## Dependency Order

```
Phase 0 (fix app)          — start immediately, independent
Phase 1 (migrate data)     — start immediately, independent
Phase 2 (consumer → Firestore) — requires Phase 1
Phase 3 (enrichment fn)    — requires Phase 1
Phase 4 (image scraping fn) — requires Phase 1
Phase 5 (admin in app)     — requires Phase 1 + Phase 3
Phase 6 (agent → Firestore) — requires Phase 1
Phase 7 (clean up)         — requires Phases 3, 4, 6 stable for 1 week
```

Fastest path: Run Phase 0 and Phase 1 in parallel, then Phase 2, 3, 4 in parallel, then Phase 5 and 6, then Phase 7.

---

## Before Starting Phase 3

Upgrade Firebase project `ckc-recipe-swipe` from the free Spark plan to the **Blaze (pay-as-you-go)** plan. Cloud Functions that make outbound HTTP requests (scraping images, fetching descriptions) require Blaze. At typical usage (~10 new recipes/day, weekly image scrape), cost is effectively $0/month — you only pay if usage exceeds the generous free tier.

---

## Key Files Reference

| File | Role |
|---|---|
| `ckc-consumer-app/App.tsx` | Add Admin route + web URL detection |
| `ckc-consumer-app/screens/main/DiscoverScreen.tsx` | Source of swipe mechanics → extract to shared hook |
| `enrich_recipes.py` | Diet tag logic to port to TypeScript (Phase 3) |
| `.github/workflows/source-recipes.yml` | Agent workflow to redirect to Firestore (Phase 6) |
| `.claude/agent/instructions.md` | Agent rules — update Step 4 in Phase 6 |
| `.claude/agent/diet-compliance-rules.md` | Stays as-is, referenced by agent and ported to Cloud Function |
| `firestore.rules` | Update as each phase adds new write patterns |
