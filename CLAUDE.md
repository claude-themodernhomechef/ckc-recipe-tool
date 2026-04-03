# CKC Recipe Tool — Claude Code Guide

## IMPORTANT: This Is the Only Repo

**There is no separate "consumer app" repo.** The consumer-facing React Native app lives inside this repo at `ckc-consumer-app/`. All app code changes must be made to files inside `ckc-consumer-app/`. Do not reference or suggest changes to a separate project — everything is here.

## Project Overview

This repo contains two things in one place:
1. **The CKC consumer app** — a React Native/Expo app (in `ckc-consumer-app/`) for dietary-protocol-based recipe discovery and shopping planning
2. **Data pipeline tools** — Python/JS scripts at the repo root for recipe enrichment, scraping, diet auditing, and Firestore uploads

Built for CKC (Chef-curated Kitchen Collection). The app guides users through onboarding (diet protocol, household, protein, cuisine preferences) and generates personalized shopping plans.

## Repo Structure

```
/
├── ckc-consumer-app/       # Main React Native/Expo app
│   ├── App.tsx             # Root navigator & font loading
│   ├── screens/            # All app screens
│   ├── assets/             # Images, icons, logo
│   └── package.json        # App dependencies
├── recipes.json            # Master recipe database (~2000+ recipes)
├── ingredients.json        # Ingredient master list with swap data
├── index.html              # Web recipe catalog (standalone)
├── catalog.html            # Recipe browser UI
├── shopping.html           # Shopping list UI
├── firestore.rules         # Firestore security rules
├── storage.rules           # Firebase Storage rules
├── vercel.json             # Vercel deployment config
├── firebase.json           # Firebase project config
└── *.py                    # Data enrichment/scraping scripts (run locally)
```

## Tech Stack

- **Framework:** React Native 0.83.2 + Expo 55
- **Web:** React Native Web + React 19
- **Navigation:** React Navigation (native-stack)
- **Backend:** Firebase (Firestore, Cloud Storage)
- **Deployment:** Vercel (web), Expo (mobile)
- **Fonts:** Cormorant Garamond, DM Sans (via Expo Google Fonts)
- **Language:** TypeScript 5.9.2

## Running the App

```bash
cd ckc-consumer-app
npm install
npx expo start          # Start dev server
npx expo start --web    # Web browser only
npx expo start --ios    # iOS simulator
```

## Screen Flow

SplashScreen → WelcomeScreen → DietProtocolScreen → HouseholdScreen → ProteinScreen → CuisineScreen → SetupCompleteScreen → ShoppingPlannerScreen

## Key Design Notes

- Dark theme throughout (`Colors.bg`)
- Typography: Cormorant Garamond (headings), DM Sans (body)
- Diet protocols supported: AIP, Low-FODMAP, Keto, Gluten-Free, Dairy-Free, Vegan, Vegetarian, Low-Histamine — full rules in `CKC_Diet_Compliance_Rules.md`
- Recipe data lives in Firestore; `recipes.json` and `ingredients.json` are the local source of truth used for uploads/enrichment

## Data Scripts (Python)

Run from the project root. These are one-off data pipeline tools:
- `enrich_recipes.py` — Enriches recipe records
- `scrape_ratings.py` — Scrapes recipe ratings
- `full_diet_audit_v2.py` — Audits diet tag compliance
- Progress tracked in `*_progress.json` files (don't commit these)

## Project Docs — Read Before Building

These files contain the decisions and specs that drive this project. Read the relevant one before making changes in that area.

### Product Vision & App Structure
- **`CKC-App-Build-Plan.md`** — Master product roadmap. Covers all build phases (Phase 1 through Phase 7+), feature priorities, and the "why" behind each. **Read this first** when planning any new feature.
- **`CKC_App_Build_Specification.md`** — Detailed app spec: 5-tab structure (Discover, Meal Plan, Scan, Shop, Profile), freemium/paid tier breakdown, paywall logic, and screen-by-screen behavior. **Reference this when building or modifying any screen or navigation flow.**

### Diet & Recipe Logic
- **`CKC_Diet_Compliance_Rules.md`** — The authoritative rulebook for all 8 dietary protocols (AIP, Low-FODMAP, Keto, Gluten-Free, Dairy-Free, Vegan, Vegetarian, Low-Histamine). Lists compliant/non-compliant ingredients per protocol. **Required reading before touching any diet tagging, compliance filtering, or swap logic.**
- **`CKC_Recipe_Modification_Analysis.md`** — Analysis of how recipes are tagged and modified across protocols. Shows Rafi's methodology for deciding when a modification preserves a dish vs. destroys it. Useful context when evaluating swap suggestions or diet compliance edge cases.

### Shopping List
- **`CKC-Shopping-List-Final-Build-Plan.md`** — The finalized architecture for the shopping list system. Defines the `ingredients.json` pre-parsed object format (name, qty, unit, category, raw) and how `shopping.html` should consume it. **Use this when working on any shopping list feature.**
- **`CKC-Shopping-List-Build-Instructions.md`** — Earlier spec for shopping list development. Contains additional context on consolidation logic, category grouping, and measurement standardization.

### Data Pipeline
- **`recipe_ratings_scraping_guide.md`** — Step-by-step guide for running the ratings scraper (`scrape_ratings.py`). Covers queue building, domain-based scraping, and writing results back to the master CSV.
