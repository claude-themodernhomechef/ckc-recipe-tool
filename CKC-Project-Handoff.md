# CKC Recipe Tool — Project Handoff Document

**Last updated:** 2026-04-29
**Owner:** Rafi Levy (rafimlevy@gmail.com)
**Repo location (current):** `/Users/rafi/Desktop/Claude-MHC/CKC Recipes /CKC- Recipe Tool/`

This document is a complete pass-off for spinning up a new project / new working session. It captures **what exists today, why it exists, how the pieces fit together, and where it's all heading.** Read this top-to-bottom before making changes.

---

## 1. The 60-Second Summary

CKC (Curated Kitchen Collective) is a **dietary-protocol-based recipe + shopping app** for people on restrictive diets (AIP, Low-FODMAP, Keto, GF, DF, Vegan, Vegetarian, Low-Histamine).

The product has two halves:

1. **Consumer app** (`ckc-consumer-app/`) — React Native / Expo app. Onboards users by diet protocol, household size, protein and cuisine preferences, then builds personalized meal plans, shopping lists, and a barcode "Scan" tool to check products against the user's diet.
2. **Data pipeline + admin tools** (everything else) — Scripts, Cloud Functions, and an admin web UI that scrape, enrich, diet-tag, nutrition-score, and approve recipes before they land in Firestore for the consumer app to read.

The whole system runs on **Firebase** (Firestore + Storage + Cloud Functions + Hosting), with **Supabase** holding the FIG product database used during diet verification.

---

## 2. Current State (April 2026)

| Area | Status |
|---|---|
| Recipe master DB | ✅ 1,078 recipes fully enriched on Firestore |
| Consumer app — onboarding flow | ✅ Built (Splash → Welcome → Diet → Household → Protein → Cuisine → SetupComplete) |
| Consumer app — main tabs | 🟡 Partially built (Discover, Meal Plan, Scan, Shop, Profile screens exist as scaffolds) |
| Admin tool — Needs Review queue | ✅ Working in app at `/admin` (Expo web) |
| Admin tool — Swipe yes/no/maybe | ✅ Working |
| Diet compliance rules | ✅ Complete, codified in `docs/CKC_Diet_Compliance_Rules.md` |
| Cloud Function enrichment pipeline | ✅ Live — triggers on status="yes", runs scrape + chef notes + diet verify + FIG check |
| Nutrition database (v2) | ✅ Built via Edamam, stored in Firestore `ingredients` collection |
| Per-recipe per-diet nutrition (`byDiet`) | ✅ Computed and written to Firestore |
| Master Swap Table | ✅ Authoritative table at `functions/masterSwapTable.json` |
| Shopping list logic | 🟡 Spec written, partial implementation |
| Scan tab (barcode → diet check) | ⏳ Spec written, not yet built |
| Pantry Starter Kit | ⏳ Spec written, not yet built |
| Low-FODMAP 3-phase logic | ⏳ Planned (see `docs/CKC-Low-FODMAP-3-Phase-Build-Plan.md`) |

---

## 3. Tech Stack

### Consumer App
- **React Native** 0.83.2 + **Expo** 55
- **React** 19.2 + **React Native Web** 0.21 (same code runs as iOS app and as web)
- **TypeScript** 5.9
- **Navigation:** `@react-navigation/native-stack` + `@react-navigation/bottom-tabs`
- **State:** React Context (`UserContext`, `MenuContext`) — no Redux, no Zustand
- **Storage:** `@react-native-async-storage/async-storage` for local persistence
- **Fonts:** `Cormorant Garamond` (headings, italic), `DM Sans` (body) — both via `@expo-google-fonts`
- **Icons:** `@expo/vector-icons` (Ionicons)
- **AI on-device:** `@google/generative-ai` (Gemini) for some live features

### Backend
- **Firebase**
  - Firestore (recipe DB, user profiles, ingredient nutrition, review queue, ingredient categories)
  - Cloud Storage (recipe images)
  - Cloud Functions Gen 2 (Node.js 20) — enrichment pipeline
  - Firebase Hosting (admin HTML + redirects)
- **Supabase** — holds the FIG curated product database (used during diet verification to confirm a compliant product exists for an ingredient)
- **Anthropic Claude** (Sonnet) — chef's notes generation, diet tag verification
- **Edamam API** — ingredient-level nutrition lookups
- **USDA FoodData Central** — secondary nutrition source

### Deployment
- **Web admin / catalog:** Vercel + Firebase Hosting
- **Mobile:** Expo (not yet shipped to App Store)
- **Cloud Functions:** `firebase deploy --only functions` from `functions/` dir

---

## 4. Repo Structure (Annotated)

```
CKC- Recipe Tool/                            # repo root
│
├── CLAUDE.md                                # Working instructions for Claude Code (in this repo)
├── README.md                                # Stub
├── CKC-Project-Handoff.md                   # ← THIS FILE
│
├── ckc-consumer-app/                        # ╔══ THE CONSUMER APP ══════════════╗
│   ├── App.tsx                              # Root navigator + font loader + Providers
│   ├── app.json                             # Expo config (name, icon, splash, slug)
│   ├── index.ts                             # Expo entrypoint
│   ├── package.json                         # App-only dependencies
│   ├── tsconfig.json
│   │
│   ├── assets/                              # Icon, splash, logo, favicon
│   │
│   ├── constants/
│   │   └── theme.ts                         # Colors (dark theme), diet tag color map
│   │
│   ├── context/
│   │   ├── UserContext.tsx                  # Logged-in user, profile, diet protocols, household
│   │   └── MenuContext.tsx                  # Selected recipes for current meal plan
│   │
│   ├── data/
│   │   └── sampleRecipes.ts                 # Fallback / dev data (real data lives in Firestore)
│   │
│   ├── lib/                                 # Service layer
│   │   ├── firebase.ts                      # Firebase init (uses .env vars)
│   │   ├── firestore.ts                     # Recipe CRUD, query builders
│   │   ├── auth.ts                          # signUp / signIn / signOut wrappers
│   │   ├── ingredientParser.ts              # Parses raw ingredient strings → {name, qty, unit, category}
│   │   ├── claudeScoring.ts / .web.ts       # Claude API wrapper (split for native vs. web)
│   │   └── gemini.ts / .web.ts              # Gemini API wrapper (split for native vs. web)
│   │
│   ├── navigation/
│   │   └── MainTabs.tsx                     # Bottom tab nav: Discover / Meal Plan / Scan / Shop / Profile
│   │
│   └── screens/
│       ├── SplashScreen.tsx                 # Brand splash with logo
│       ├── WelcomeScreen.tsx                # "Get started" → SignUp/Login
│       ├── SignUpScreen.tsx
│       ├── LoginScreen.tsx
│       ├── NameScreen.tsx                   # Capture user's first name
│       ├── DietProtocolScreen.tsx           # Multi-select chips for 8 diet protocols
│       ├── HouseholdScreen.tsx              # # of people in household
│       ├── ProteinScreen.tsx                # Protein preferences
│       ├── CuisineScreen.tsx                # Cuisine preferences
│       ├── SetupCompleteScreen.tsx          # End of onboarding
│       ├── ShoppingPlannerScreen.tsx       # Standalone shopping flow
│       ├── GuestDiscoverScreen.tsx          # Browse without signup
│       ├── RecipeDetailScreen.tsx           # Single recipe view
│       │
│       ├── components/                      # Shared UI primitives
│       │   ├── DietTag.tsx                  # The circular diet tags (solid=native, dashed=modified)
│       │   ├── PrimaryButton.tsx
│       │   ├── SelectableChip.tsx
│       │   ├── ProgressDots.tsx
│       │   ├── OnboardingHeader.tsx
│       │   ├── SectionLabel.tsx
│       │   ├── EmptyState.tsx
│       │   └── PremiumGate.tsx              # Paywall overlay component
│       │
│       ├── main/                            # The 5 logged-in tabs
│       │   ├── DiscoverScreen.tsx           # Personalized feed
│       │   ├── MealPlanScreen.tsx           # Weekly meal plan
│       │   ├── ScanScreen.tsx               # Barcode scanner (planned)
│       │   ├── ShopScreen.tsx               # Consolidated shopping list
│       │   ├── ProfileScreen.tsx            # User settings
│       │   └── CatalogScreen.tsx            # Browse all recipes
│       │
│       └── admin/                           # Internal tools (web-only via /admin)
│           ├── AdminScreen.tsx              # Admin home
│           ├── AdminSwipeScreen.tsx         # Tinder-style yes/no/maybe on incoming recipes
│           ├── AdminMaybeScreen.tsx         # Re-review of "maybe" pile
│           ├── AdminShoppingScreen.tsx      # Test shopping list output
│           ├── NeedsReviewScreen.tsx        # Recipes flagged by enrichment pipeline
│           ├── ReviewQueueScreen.tsx        # Item-level diet uncertainty review
│           ├── DecisionsCatalogScreen.tsx   # Audit log of past decisions
│           └── RoadmapScreen.tsx            # Internal roadmap viewer
│
├── functions/                               # ╔══ CLOUD FUNCTIONS ═══════════════╗
│   ├── index.js                             # ★ Main enrichment trigger (onDocumentUpdated for recipes)
│   ├── package.json                         # firebase-admin, firebase-functions, anthropic-sdk, supabase, axios, cheerio
│   ├── masterSwapTable.json                 # Authoritative ingredient → diet swap mapping
│   ├── diet-rules.json                      # Machine-readable diet rule set
│   ├── CKC_Diet_Compliance_Rules.md         # Copied from docs/ at deploy time
│   ├── CKC_Chef_Notes_Guide.md              # Copied from docs/ at deploy time
│   └── src/
│       ├── firebaseAdmin.ts
│       ├── scrapeImages.ts
│       └── enrichment/
│           ├── classifyDietTags.ts
│           ├── classifyProtein.ts
│           └── fetchDescription.ts
│
├── scripts/                                 # ╔══ DATA PIPELINE (one-off) ═══════╗
│   │                                        # Run from repo root with `node` or `python3`
│   │
│   ├── ── Recipe ingestion ──
│   ├── scrape_new_recipe.py                 # Scrape a single new URL
│   ├── scrape_pending_metadata.py           # Bulk scrape pending recipes
│   ├── add_recipe_to_firestore.js           # Push a scraped recipe up
│   ├── extract_jsonld.py                    # Pull schema.org/Recipe JSON-LD blocks
│   │
│   ├── ── Diet tagging ──
│   ├── full_diet_audit_v2.py                # Full audit of every recipe vs. compliance rules
│   ├── verify_diet_tags.js                  # One-pass diet tag verifier
│   ├── backfill_diet_tags.js
│   ├── regen_diet_tags.js
│   ├── fix_diet_notes.js
│   │
│   ├── ── Nutrition ──
│   ├── build_ingredient_db_v2.js            # Build per-ingredient nutrition DB (Edamam)
│   ├── build_recipe_nutrition_v2.ts         # Compute per-recipe macros from ingredient DB
│   ├── write_recipe_nutrition_v2.js         # Write back to Firestore
│   ├── compute_bydiet_nutrition.js          # Compute byDiet.{AIP, LF, ...} variants per recipe
│   ├── fill_edamam_gaps.js
│   ├── run_edamam_batch.js
│   ├── compare_nutrition.js
│   │
│   ├── ── Servings backfill ──
│   ├── scrape_servings.js
│   ├── scrape_servings_puppeteer.js
│   ├── scrape_servings_chrome_profile.js
│   ├── fill_missing_times.py
│   │
│   ├── ── Ingredient master ──
│   ├── extract_ingredient_list.py
│   ├── upload_ingredient_db.js
│   ├── upload_ingredient_categories.js
│   ├── label_cuisines.js
│   ├── label_meal_types.js
│   ├── label_builtin_components.js
│   ├── standardize_salt_pepper.js
│   ├── remove_emdashes.js
│   │
│   ├── ── Review queue ──
│   ├── export_review_queue.js               # Firestore review_queue → needs_review.csv
│   ├── append_needs_review.js
│   ├── apply_review_decisions.py
│   ├── apply_new_review.py
│   ├── set_yes_to_needs_review.js
│   ├── check_broken_statuses.js
│   ├── audit_broken_urls.js
│   │
│   ├── ── Maintenance ──
│   ├── delete_recipe.js
│   ├── update_recipe_enrichment.js
│   ├── regen_chefs_notes.js
│   ├── get_enrichment_queue.js
│   ├── get_reingest_queue.js
│   ├── upload_recipe_image.js
│   └── run_enrichment.sh                    # Convenience wrapper
│
├── data/                                    # ╔══ LOCAL DATA + PROGRESS LOGS ════╗
│   ├── ingredientNutrition_v2.json          # Live ingredient → nutrition map
│   ├── masterSwapTable.json                 # Local copy of master swap table
│   ├── *_progress.json                      # Resumable progress files (don't commit)
│   ├── *_write_log.json                     # What got written when (debug)
│   └── nutrition_comparison.{csv,json}      # QA artifacts
│
├── docs/                                    # ╔══ PRODUCT + RULES DOCUMENTATION ═╗
│   │                                        # Required reading before touching related areas
│   ├── CKC-App-Build-Plan.md                # ★ MASTER ROADMAP — read first
│   ├── CKC_App_Build_Specification.md       # ★ Detailed app spec (5 tabs, freemium tiers, paywall logic)
│   ├── CKC_Diet_Compliance_Rules.md         # ★ Rulebook for all 8 diet protocols
│   ├── CKC_Chef_Notes_Guide.md              # Voice / format guide for AI-generated chef's notes
│   ├── CKC_Recipe_Modification_Analysis.md  # Methodology for "modification preserves dish" decisions
│   ├── CKC-Shopping-List-Final-Build-Plan.md
│   ├── CKC-Shopping-List-Build-Instructions.md
│   ├── CKC-Scan-Tab-Build-Plan.md
│   ├── CKC-Pantry-Starter-Kit-Build-Plan.md
│   ├── CKC-Smart-Product-Matching-Build-Plan.md
│   ├── CKC-Low-FODMAP-3-Phase-Build-Plan.md
│   ├── CKC-Admin-Recipe-Sourcing-Build-Plan.md
│   ├── CKC-Fig-Data-Pipeline.md
│   ├── CKC-Overhaul-Plan.md
│   ├── recipe_ratings_scraping_guide.md
│   └── pairing_analysis.md
│
├── admin/
│   └── review-queue.html                    # Standalone HTML admin (legacy, being replaced by Expo admin)
│
├── images/                                  # 787 recipe images (uploaded to Firebase Storage)
│
├── firebase.json                            # Firebase project config (functions, hosting, firestore, storage)
├── firestore.rules                          # Security rules — see Section 7
├── firestore.indexes.json                   # Composite indexes
├── storage.rules                            # Storage security rules
├── vercel.json                              # Vercel routing
├── service-account.json                     # GCP service account (for local scripts) — DO NOT COMMIT
└── package.json                             # Root scripts (uses firebase-admin for local jobs)
```

---

## 5. Data Model (Firestore)

### `recipes/{recipeId}`
The single source of truth for a recipe. Schema (rough):

```ts
{
  id: string;
  title: string;
  url: string;                          // original source URL
  source: string;                       // domain, e.g. "loveandlemons.com"
  image: string;                        // Firebase Storage URL
  description: string;                  // AI-generated, 1-2 sentence menu blurb
  chefNotes: string;                    // AI-generated, voice-matched notes

  servings: number;
  prepTimeMin: number | null;
  cookTimeMin: number | null;

  ingredients: Array<{
    raw: string;                        // original line, e.g. "1 cup chopped onion"
    name: string;                       // normalized, "onion"
    qty: number | null;
    unit: string | null;                // "cup", "g", "tbsp", etc.
    category: string;                   // "produce", "pantry", "dairy", "protein", etc.
  }>;

  instructions: string[];

  // Diet tags — eight protocols
  dietTags: {
    AIP:  { native: bool, mod: bool, swaps: Swap[] },
    LF:   { native: bool, mod: bool, swaps: Swap[] },   // Low-FODMAP
    K:    { native: bool, mod: bool, swaps: Swap[] },   // Keto
    GF:   { native: bool, mod: bool, swaps: Swap[] },
    DF:   { native: bool, mod: bool, swaps: Swap[] },
    V:    { native: bool, mod: bool, swaps: Swap[] },   // Vegetarian
    Vg:   { native: bool, mod: bool, swaps: Swap[] },   // Vegan
    LH:   { native: bool, mod: bool, swaps: Swap[] },   // Low-Histamine
  };

  // Per-diet nutrition (computed by compute_bydiet_nutrition.js)
  nutrition:  { calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg };
  byDiet: {
    AIP: { ...same shape... },
    LF:  { ... },
    // etc. — reflects the macros AFTER swaps are applied
  };

  // Classification
  protein:   string;                    // "chicken" | "beef" | "fish" | "vegetarian" | ...
  cuisine:   string;                    // "italian" | "mexican" | ...
  mealType:  string[];                  // ["dinner", "lunch"]

  // Pipeline state
  status:           "yes" | "no" | "maybe" | "needs_review";
  processingStatus: "pending" | "complete" | "pending_review";
  rating: number | null;                // scraped rating
}

// Swap shape (inside dietTags.{protocol}.swaps[])
{ from: "soy sauce", to: "coconut aminos", reason: "...", productMatch?: { figId, brand, name } }
```

### `users/{uid}`
Per-user profile. Only readable/writable by the owning user.
```ts
{ name, dietProtocols: string[], household: number, proteins: string[], cuisines: string[], createdAt }
```

### `ingredients/{ingredientName}`
Master ingredient nutrition database (built from Edamam). Read-only for app.
```ts
{ name, calories_per_100g, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, source: "edamam"|"usda"|"manual" }
```

### `ingredientCategories/{ingredientName}`
Maps ingredient → shopping list category. Admin-writable.

### `decisions/{decisionId}`
Append-only log of human decisions (yes/no/maybe + diet review verdicts). Used for QA + future ML training.

### `review_queue/{itemId}`
Items the enrichment pipeline couldn't auto-resolve (ambiguous diet tags, FIG product not found). Worked through in `NeedsReviewScreen`.

---

## 6. The Enrichment Pipeline (How a Recipe Goes Live)

This is the most important automated system in the project. It lives in `functions/index.js`.

```
┌──────────────────────────────────────────────────────────────────────┐
│  1. New recipe URL added (admin scrapes it, status="pending")        │
│     └─ AdminSwipeScreen → human swipes yes / no / maybe              │
│                                                                      │
│  2. status flips to "yes"                                            │
│     └─ Cloud Function trigger fires (onDocumentUpdated /recipes/{id})│
│                                                                      │
│  3. SCRAPE  → axios + cheerio pulls full ingredient list from URL    │
│                                                                      │
│  4. CHEF NOTES + DESCRIPTION                                         │
│     └─ Claude Sonnet (with CKC_Chef_Notes_Guide.md as system prompt) │
│                                                                      │
│  5. DIET TAG VERIFICATION                                            │
│     └─ Claude Sonnet (with CKC_Diet_Compliance_Rules.md), max 2k tok │
│     └─ Returns native/mod flags + uncertainty list per protocol      │
│                                                                      │
│  6. SWAP RESOLUTION                                                  │
│     a) Try MASTER_SWAP_TABLE first (functions/masterSwapTable.json)  │
│     b) If not found → query Supabase FIG products for compliant SKU  │
│        - Compliant product found → swap auto-confirmed               │
│        - Caution / not found     → write to review_queue, hold       │
│                                                                      │
│  7. WRITE BACK                                                       │
│     processingStatus = "complete"        → recipe is live            │
│     processingStatus = "pending_review"  → goes to NeedsReviewScreen │
└──────────────────────────────────────────────────────────────────────┘
```

**Required env vars on the Cloud Function:**
- `ANTHROPIC_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

**Before deploy** the rules + chef notes guide must be copied into `functions/`:
```bash
cp docs/CKC_Diet_Compliance_Rules.md functions/
cp docs/CKC_Chef_Notes_Guide.md      functions/
firebase deploy --only functions
```

---

## 7. Firestore Security Rules (Current)

Lives in `firestore.rules`. Summary:

| Collection | Read | Write | Notes |
|---|---|---|---|
| `users/{uid}` | owner only | owner only | Standard per-user lockdown |
| `recipes/{id}` | public | **public** | ⚠️ Open writes — protected by obscurity for the admin tool, must be locked down before public launch |
| `decisions/{id}` | public | denied | Read-only audit log |
| `ingredientCategories/{id}` | public | public | Admin tool needs writes |
| `ingredients/{id}` | public | denied | Nutrition lookups |
| everything else | denied | denied | Default-deny |

**Pre-launch must-do:** lock `recipes` writes behind admin auth.

---

## 8. Onboarding Flow (Built)

```
Splash
  → Welcome
      → SignUp / Login
          → Name
              → DietProtocol  (multi-select chips for 8 protocols)
                  → Household (number stepper)
                      → Protein (multi-select)
                          → Cuisine (multi-select)
                              → SetupComplete
                                  → MainTabs (Discover, MealPlan, Scan, Shop, Profile)
```

State carried via React Navigation route params, then persisted to Firestore on `SetupComplete`.

---

## 9. Long-Term Roadmap (from `docs/CKC-App-Build-Plan.md`)

**Phase 1 — Foundation (DONE)**
- Onboarding, Discover feed, basic recipe browse, dark theme design system

**Phase 2 — Core Loop (IN PROGRESS)**
- Meal Plan tab — drag/drop weekly planner
- Shop tab — consolidated shopping list with category grouping (spec in `CKC-Shopping-List-Final-Build-Plan.md`)
- RecipeDetail polish (swap visualizations, byDiet macro toggle)

**Phase 3 — Differentiators**
- **Scan tab** — barcode → product → diet compliance check (spec in `CKC-Scan-Tab-Build-Plan.md`)
- **Smart product matching** — when a swap is needed, surface specific FIG products (`CKC-Smart-Product-Matching-Build-Plan.md`)
- **Pantry Starter Kit** — guided first-purchase list per diet (`CKC-Pantry-Starter-Kit-Build-Plan.md`)

**Phase 4 — Specialized Diets**
- Low-FODMAP 3-phase support (Elimination → Reintroduction → Personalization) — see `CKC-Low-FODMAP-3-Phase-Build-Plan.md`

**Phase 5 — Monetization**
- Freemium model: free tier sees Discover + 1 meal plan/week, paid tier unlocks unlimited plans + Scan + advanced filters
- Paywall logic detailed in `CKC_App_Build_Specification.md`
- `PremiumGate.tsx` component already scaffolded

**Phase 6+** — Social, sharing, community recipes, chef partnerships

---

## 10. Local Setup (Cold Start on a New Machine)

```bash
# 1. Clone repo (or copy this directory)
cd "CKC- Recipe Tool"

# 2. Install root deps (for scripts/)
npm install

# 3. Install consumer app deps
cd ckc-consumer-app
npm install

# 4. Install Cloud Functions deps
cd ../functions
npm install
cd ..

# 5. Required local files (NOT committed)
#    - service-account.json   (GCP service account for Firebase Admin SDK)
#    - .env.local             (root, for scripts)
#    - ckc-consumer-app/.env  (Firebase web config + API keys)

# 6. Firebase login
firebase login
firebase use <project-id>

# 7. Run consumer app
cd ckc-consumer-app
npx expo start --web    # web in browser
npx expo start --ios    # iOS simulator
```

### Required `.env` keys

**`ckc-consumer-app/.env`** (Firebase web SDK):
```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_GEMINI_API_KEY=
EXPO_PUBLIC_ANTHROPIC_API_KEY=
```

**Cloud Functions runtime** (set via `firebase functions:secrets:set`):
```
ANTHROPIC_API_KEY
SUPABASE_URL
SUPABASE_ANON_KEY
```

**Root `.env.local`** (used by Python + Node scripts):
```
EDAMAM_APP_ID=
EDAMAM_APP_KEY=
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_KEY=
```

---

## 11. Design System (Critical — Don't Drift)

**Colors** (from `ckc-consumer-app/constants/theme.ts`):
- Background: `#0f0f0d` (near-black)
- Surface: `#1a1a16`
- Brand accent: `#3f0202` (deep burgundy)
- Text primary: `#f5f3ee` (warm off-white)
- Diet tag colors: each protocol has its own color (AIP red, Low-FODMAP gold, Keto purple, etc.)

**Typography:**
- Headings → `CormorantGaramond_500Medium` (often italic for elegance)
- Body → `DMSans_400Regular` / `DMSans_500Medium`
- Always serif for headlines, never display fonts.

**Diet tags (very important — Rafi has strong rules here):**
- Always **circles**, never pills/capsules
- **Solid fill** = recipe is natively compliant for this protocol
- **Dashed border** = recipe can be made compliant via a modification
- Implementation: `screens/components/DietTag.tsx`

**Theme is dark throughout the app.** No light mode planned.

---

## 12. Working Style Notes for Rafi

These are non-obvious things that have come up repeatedly:

- **Rafi is a non-technical founder / beginner coder.** Explain in plain English. Avoid jargon. When showing code, narrate what each block does.
- **Diet swaps must match by function**, not by category. Never substitute generic herbs for warm spices. The Master Swap Table is the source of truth.
- **One repo only.** The consumer app lives at `ckc-consumer-app/` — there is no separate consumer repo, even though it would be conventional to split them.
- **Authoritative docs live in `docs/`.** Always read the relevant build plan before changing a feature in that area.
- **Progress JSON files (`*_progress.json`)** track resumable script state. Don't commit them, don't delete them while a job is running.

---

## 13. Known Gotchas / Tech Debt

1. **`recipes` collection is open-write** in Firestore rules. Must lock down before public launch.
2. **`functions/CKC_Diet_Compliance_Rules.md` and `CKC_Chef_Notes_Guide.md`** are duplicates of the canonical docs in `docs/`. Cloud Functions can only `fs.readFileSync` from their own directory, so they must be copied before deploy. Easy to forget after editing the source.
3. **`masterSwapTable.json` exists in two places** — `functions/masterSwapTable.json` (used at runtime) and `data/masterSwapTable.json` (local edits). Must be kept in sync.
4. **`firebase.json` has duplicate `functions` keys** (lines 2 and 14). Second one wins. Should be cleaned up.
5. **Web vs. native split files** — `claudeScoring.ts` / `claudeScoring.web.ts` and `gemini.ts` / `gemini.web.ts` exist because the SDKs behave differently. Don't merge them.
6. **`images/` directory has 787 files** committed to the repo. Should ideally move to Storage-only.
7. **Legacy `admin/review-queue.html`** is being phased out in favor of Expo `screens/admin/*`. Don't add to it.
8. **The `_trash/` directory** at root holds files Rafi was unsure about deleting. Treat as archive — don't reference.

---

## 14. The Most Important Files to Read First

If you only have 30 minutes, read in this order:

1. **`CLAUDE.md`** (5 min) — How to operate in this repo
2. **`docs/CKC-App-Build-Plan.md`** (10 min) — Master roadmap
3. **`docs/CKC_App_Build_Specification.md`** (10 min) — Tab-by-tab spec
4. **`docs/CKC_Diet_Compliance_Rules.md`** (skim) — Diet rule book
5. **`functions/index.js`** (5 min) — How recipes get enriched
6. **`ckc-consumer-app/App.tsx`** (2 min) — Navigation map

---

## 15. Contact / Ownership

- **Owner:** Rafi Levy (rafimlevy@gmail.com)
- **Firebase project:** (check `.firebaserc` after first `firebase use`)
- **Anthropic API:** owned by Rafi
- **Supabase project:** owned by Rafi (FIG products live here)
- **Edamam account:** owned by Rafi

---

*End of handoff document. Good luck.*
