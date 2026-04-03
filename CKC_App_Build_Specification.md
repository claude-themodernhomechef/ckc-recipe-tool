# CKC App Build Specification

## Overview

Curated Kitchen Collective is a cross-platform mobile app (React Native or Flutter) that helps people discover chef-vetted recipes, plan meals, and shop for groceries with built-in dietary protocol intelligence. The app links out to food bloggers for cooking instructions but owns the curation layer, chef notes, diet compliance data, ingredient swap recommendations, and shopping list infrastructure.

The app supports 8 dietary protocols at launch: Vegan, Vegetarian, Gluten-Free, Dairy-Free, Low-FODMAP, Low-Histamine, AIP, and Keto.

The recipe database contains 500+ fully structured recipes (ingredient name, quantity, unit) with diet compliance tags, chef notes, and protocol-specific swap notes already built out. All recipes are standardized to 4 servings.

---

## App Structure: 5 Tabs

### Tab 1: Discover
The primary entry point. Houses the recipe swipe tool and filtered browsing.

### Tab 2: Meal Plan
Where saved recipes become weekly menus with consolidated shopping lists.

### Tab 3: Scan
Paste a URL or upload a photo to score any recipe against the user's dietary profile. (Launches as placeholder, goes live in later build phases.)

### Tab 4: Shop
Shopping list and grocery delivery integration. (Launches as part of Meal Plan, becomes its own tab when Instacart integration goes live.)

### Tab 5: Profile
Saved recipes, dietary protocol settings, household size, personal notes, and eventually protocol tracking.

Pre-auth flow: Splash page > Login/Signup > Land on Discover tab.

---

## Freemium Model

### Free Tier
- Limited swipes per day (10-15)
- All 8 dietary protocol filters and compliance badges visible
- Full recipe detail screen with diet compliant notes (swap recommendations) visible
- One chef note preview per recipe (remaining chef notes gated)
- Single-recipe shopping list generation (capped at 3 per week, upgrade prompt appears at limit; the cap is invisible to the user until they hit it)
- Save recipes to recipe bank
- Scaling card on redirect to blogger site
- Access to filtered browsing by cuisine, protein, and prep time

### Paid Tier
- Unlimited swipes
- Full chef notes unlocked on all recipes
- Meal Plan calendar (build weekly menus, assign recipes to days)
- Pre-selected side dish pairings with cycle-through alternatives
- Consolidated multi-recipe shopping list scaled to household size
- Post-cook review and personal notes
- Personalized recommendations and weekly nudges
- Everything that comes in later phases (URL scanner, Instacart, nutrition data, pantry scanner, protocol tracking)

### Paywall Logic
- Diet compliant notes (ingredient swap recommendations) stay free because they demonstrate CKC's core value to users with dietary restrictions. Gating these creates a dead-end experience.
- Chef notes (culinary tips for elevating the dish) are the premium layer. Show one note as a teaser, gate the rest with "X more chef tips available with Premium."
- The meal plan tool is the primary conversion driver. Free users can discover and save recipes, but planning a full week and getting a consolidated shopping list requires upgrading.
- The 3-per-week single-recipe shopping list cap is a soft limit. The user does not see it advertised. They simply get an upgrade prompt when they try to generate a 4th list in one week.

---

## Build Order

### Phase 1: Core MVP

Everything the app needs to function as a usable product on day one.

#### 1A: Authentication and Onboarding

**Splash screen:** Brand logo, tagline, "Get Started" and "Log In" buttons.

**Signup flow:** Email/password or social auth (Google, Apple). After account creation, a brief onboarding sequence:
- "What dietary protocols do you follow?" (multi-select from all 8, plus "None, I just love food")
- "How many people are you cooking for?" (number selector, defaults to 4)
- "What cuisines do you enjoy?" (multi-select: Italian, Mexican, Asian, Mediterranean, Middle Eastern, American, Indian, French)
- Copy on the final screen: "The more you swipe, the smarter your meal plans get. We're learning what you love."

**Data stored in profile:** Selected protocols, household size, cuisine preferences. All editable later in Profile tab.

#### 1B: Discover Tab (Swipe Tool)

**Swipe interface:** Full-screen recipe cards. Right swipe saves to recipe bank. Left swipe passes. Each card shows: recipe photo, recipe name, cuisine tag, protein type, prep time, and diet compliance badges (small colored icons for each protocol the recipe meets).

**Filter bar at top:** Protocol filter chips (GF, DF, Vegan, etc.), plus secondary filters for cuisine type, protein, and prep time (under 30 min, under 60 min, 60+ min). When a protocol is active, only recipes that are either natively compliant or compliant with modifications appear in the stack.

**Compliance badge behavior:** Green checkmark = natively compliant. Yellow badge = compliant with modifications (swap notes available). Recipes that are not compliant and cannot be modified do not appear when that protocol filter is active.

**Filtered browsing (below swipe area):** Category tiles organized by cuisine, protein, and prep time. Only show categories where the library has enough recipes to feel full. Do not offer open search at launch. The browse experience should feel curated, not expose thin spots in the library. A "Chef Picks" or "Trending This Week" featured section gives a place for seasonal content and editorial curation.

**Swipe limit (free users):** After 10-15 swipes per day, a soft gate appears: "Want to keep discovering? Upgrade to Premium for unlimited swipes."

#### 1C: Recipe Detail Screen

When a user taps into any recipe (from swipe, browse, or saved recipes), they see:

- Recipe name, photo, cuisine tag, protein type, prep time
- Diet compliance badges with expandable detail (tap a badge to see why it's compliant or what modifications are needed)
- Diet compliant notes: Full swap recommendations visible to all users. Example: "Garlic is high in FODMAPs. Swap: use garlic-infused olive oil instead."
- Chef notes: First note visible to all users. Remaining notes behind paywall with "X more chef tips with Premium" prompt. Example of a chef note: "Sear the chicken thighs skin-side down for 7 minutes before flipping. Don't move them. That's how you get the crust."
- Ingredient list scaled to the user's household size (your database has structured ingredients at 4-serving baseline; apply the multiplier based on their profile)
- "Generate Shopping List" button (single recipe list, free users capped at 3/week)
- "Save to Recipe Bank" button
- "View Full Recipe" button (triggers the scaling card, then redirects to blogger's site in Safari/browser)

#### 1D: Scaling Card (Interstitial on Redirect)

When the user taps "View Full Recipe," a bottom sheet card slides up before the redirect. It only appears when the user's household size differs from the 4-serving baseline.

**Card content:**
- "CKC scaled this recipe for [X] servings."
- "If the original recipe differs, follow our shopping list quantities."
- 1-2 concrete examples from that specific recipe's highest-quantity ingredients (e.g., "2 cups rice becomes 3 cups")
- Tip line in lighter text: "Scale seasonings and spices to taste rather than by exact multiplier."
- "Cooking for a different number tonight?" link with a quick number selector for temporary override (does not change profile setting)
- "Got it" or "Continue to Recipe" button dismisses the card and opens the blog URL

#### 1E: Meal Plan Tab (Paid Feature)

**Weekly calendar view:** 7 day slots, each can hold one or more recipes. Users add recipes from their saved recipe bank by tapping a day and selecting from saved recipes. No open search; they browse their saved bank filtered by the same cuisine/protein/prep time categories.

**Side dish pairing:** When an entree is assigned to a day, the app pre-selects recommended side dishes based on CKC's pairing intelligence (data from your historical Excel menus, to be extracted and codified in the pairing analysis). Each side has a cycle button that rotates through 3-4 chef-curated alternative sides. All alternatives are also vetted and tagged.

**Pairing behavior by protocol:** If the user has an active dietary protocol, the default side pairing should be natively compliant (Tier 1). If no Tier 1 option exists, show a Tier 2 side (compliant with modifications) with the swap notes visible. Never recommend a Tier 3 (non-compliant, non-modifiable) side for an active protocol.

**Meal card display per day:**
- Entree name (linked to recipe detail)
- Paired side 1 with cycle button
- Paired side 2 with cycle button (if applicable)
- Sauce/condiment if the pairing includes one

**New user experience:** For users who haven't saved enough recipes to fill a week, the app suggests recipes from the full CKC library filtered by their protocol and cuisine preferences. Copy on the meal plan: "Save more recipes from Discover to build personalized meal plans."

**Onboarding copy for personalization:** "The more you swipe, the smarter your meal plans get. We're learning what you love." This appears on the Meal Plan tab for new users.

#### 1F: Shopping List

**Two modes:**

**Single-recipe list (free and paid):** Generated from the recipe detail screen. Ingredients scaled to household size, organized by store section (Produce, Protein, Dairy/Alternatives, Pantry, Spices). Attached to that specific recipe. Persists as long as the recipe is saved. Checkboxes on each item that persist between sessions. Free users capped at 3 list generations per week.

**Consolidated meal plan list (paid only):** Auto-generated when the user finalizes their weekly meal plan. Combines ingredients across all recipes on the plan. Duplicate ingredients merged (if 3 recipes call for olive oil, one line shows the total). Quantities adjusted for household size. Organized by store section. Lives at the bottom of the Meal Plan tab, accessible via a "Shopping List" button.

**Shopping list intelligence:**
- When a user swaps from the standard version of a recipe to a protocol-modified version (using the swap notes), the shopping list reflects the swapped ingredients, not the originals.
- When a user cycles a side dish to an alternative, the shopping list updates to reflect the new side's ingredients.
- Items organized by section: Produce, Protein, Dairy/Alternatives, Pantry, Spices, Grains/Bread.
- Checkboxes persist between sessions. Checked items stay checked even if the app is closed.

**Notification opportunity:** If a shopping list was generated and no items have been checked after 2-3 days, send a gentle push notification: "Your shopping list for this week's meals is ready. Heading to the store soon?"

#### 1G: Profile Tab

- User name, email, account settings
- Dietary protocol selector (multi-select, all 8)
- Household size selector
- Cuisine preferences
- Saved recipe bank with ability to organize into custom collections ("Weeknight Quick," "Date Night," "Meal Prep Favorites")
- Subscription management (upgrade/downgrade, billing)

---

### Phase 2: Post-Cook Review Notifications

**Trigger:** The day after a recipe was assigned to on the meal plan calendar, send a push notification: "How was last night's [recipe name]? Quick 3-question review."

**Review flow (tapping the notification opens a review card, not the full app):**

1. "How was the meal?" - 5-star rating
2. "Did the ingredient swaps work well?" - Yes / Mostly / No (only appears if the recipe had active swap modifications for the user's protocol)
3. "Would you make this recipe again?" - Yes / Maybe / No
4. Optional free text field: "Any personal notes for next time?"
5. Optional photo upload: "Want to add a photo of how yours turned out?"

**Where the data goes:**
- Star rating and "make again" feed the personalized recommendation engine (Phase 3)
- Swap feedback feeds the swap engine quality improvement loop (aggregate data shows which swaps are working and which need revision)
- Personal notes attach to that recipe in the user's saved bank and appear on the recipe detail screen next time they view it
- User photos become the personal thumbnail for that recipe in their saved collection

**Build notes:** This is a notification trigger, a simple form, and data storage. Low engineering complexity relative to its impact. Ship early to start collecting the data that powers Phase 3.

---

### Phase 3: Personalized Recommendations and Weekly Nudges

**Weekly nudge:** A banner card at the top of the Discover tab's swipe stack, appearing once per week. Shows one recommended recipe with a reason.

**Early-stage logic (before enough review data exists):** Simple pattern matching based on saved and swiped recipes. Track cuisine type and protein of every saved recipe. If 60%+ of saved recipes are Italian, surface more Italian recipes. If the user hasn't saved a fish recipe in 3+ weeks, nudge with a fish recipe. Example: "You've been into Italian lately and it's been a while since you had fish. Try this one: Creamy Tuscan Salmon."

**Copy to set expectations:** "The more you use CKC, the better we get at knowing what you love." This appears on the nudge card itself.

**Later-stage logic (after review data accumulates):** Factor in star ratings and "make again" responses. Recipes rated 4-5 stars with "yes, make again" go into heavy rotation for future meal plan suggestions. Recipes rated 1-2 stars are suppressed. Protein variety enforcement: don't suggest chicken 4 weeks in a row. Cuisine diversity: introduce new cuisines the user hasn't tried if their pattern is narrow.

**Personalized meal plan suggestions:** When the user opens the Meal Plan tab for a new week, the app auto-suggests a draft menu pulled from their saved recipe bank, weighted by their ratings, cuisine preferences, and protein variety. They can accept, swap individual recipes, or start from scratch.

---

### Phase 4: Nutrition Data Per Recipe

**What it shows:** Macros (calories, protein, carbs, fat) and key micros (fiber, sodium, iron, vitamin A, vitamin C) per serving. Displayed on the recipe detail screen below the ingredient list.

**Data source:** Calculate from the structured ingredient data using a nutrition API (USDA FoodData Central API is free and comprehensive) or a nutrition database. Each ingredient in the recipe maps to a USDA food item, quantity is known, macros/micros are calculated per serving.

**Protocol toggle behavior:** When the user views a recipe and toggles from the standard version to a protocol-modified version (with ingredient swaps), the nutrition panel recalculates in real time based on the swapped ingredients. Example: swapping regular flour for a rice flour/tapioca starch blend changes the carb and fiber numbers.

**Meal plan nutrition summary:** On the Meal Plan tab, show a daily and weekly nutrition overview based on all planned recipes. This is a nice-to-have addition once per-recipe nutrition is working.

**Build notes:** This is primarily a data project. The structured ingredient data already exists. The main work is mapping each ingredient to a USDA food item ID and building the calculation layer. The per-recipe display is a simple UI addition to the existing recipe detail screen.

---

### Phase 5: URL Recipe Scanner with Compliance Scoring

**Paid feature.** Lives in the Scan tab.

**Input:** User pastes a URL from any recipe blog.

**Processing:**
1. Fetch the page and extract the ingredient list. Most recipe blogs use WordPress recipe plugins (WP Recipe Maker, Tasty Recipes, etc.) that embed structured data (JSON-LD schema markup) in the page. Pull the ingredient list from the schema first. If no schema is available, parse the HTML for the recipe card.
2. Parse each ingredient into name, quantity, and unit.
3. Run every ingredient through the rules-based compliance engine against the user's active dietary protocol(s).
4. Generate a compliance score and flag non-compliant ingredients with specific swap recommendations.

**Output screen:**
- Overall compliance percentage at the top: "78% compliant with your Low-FODMAP protocol"
- Each ingredient listed with a green/yellow/red indicator
- Red ingredients show the issue and the recommended swap: "Garlic: contains high fructans. Swap: use garlic-infused olive oil."
- "Save Modified Recipe" button: applies all swaps and saves a clean version to the user's recipe bank, available for meal planning
- "Share Results" button: generates a shareable visual summary for social media. "I scanned this recipe and CKC made it Low-FODMAP compliant in 3 swaps." This is the viral growth feature.

**Build notes:** Start with URL parsing only. The JSON-LD approach significantly reduces the complexity since you're extracting structured data, not scraping unstructured HTML. Test against the most common recipe blog platforms (WordPress with WPRM, Tasty Recipes, and Jump to Recipe plugins cover the majority of food blogs).

---

### Phase 6: Instacart Integration with Organic Toggle

**Lives in the Shop tab** (which becomes its own tab at this phase, previously the shopping list lived inside the Meal Plan tab).

**Three toggle options (visible on the Shop tab, not buried in settings):**
- All Organic: every produce item queries for organic variant
- Dirty Dozen Only: produce items on the EWG annual list query for organic, everything else queries conventional
- Conventional: all standard queries

**Flow:** User finalizes meal plan > shopping list generates > user taps "Order Groceries" > the app converts the list to an Instacart cart via Instacart Developer Platform API > the organic/conventional toggle logic is applied per item > user reviews the Instacart cart in-app or in Instacart > confirms and checks out.

**Instacart Developer Platform (IDP):** One integration covers Walmart, Kroger, Whole Foods, Costco, Safeway, and most major chains through Instacart's marketplace. The user picks their preferred store inside the Instacart flow.

**Dirty Dozen logic:** Maintain a simple list of the 12 produce items that score highest for pesticide residue (EWG publishes this annually). If the ingredient is on the dirty dozen list and the user's toggle is set to Dirty Dozen, the API query searches for the organic variant. Everything else searches conventional.

**Recommended products section:** Below the shopping list, show 2-3 recommended brands for protocol-specific staple ingredients (coconut aminos, compliant flours, specific brands of tamari, etc.). Start with 50-100 of the most common specialty items. This also opens future affiliate revenue potential.

---

### Phase 7: Photo Recipe Scanner

**Extension of the Scan tab.** Adds a second input method alongside the URL scanner.

**Input:** User uploads a photo or screenshot of a recipe (from a cookbook, Instagram, a text from a friend).

**Processing:**
1. OCR extracts text from the image.
2. NLP parses the extracted text into individual ingredients with quantities and units.
3. Same compliance engine as the URL scanner runs against the user's protocol(s).
4. Same output screen with compliance score, flagged ingredients, and swap recommendations.

**Build notes:** Use an existing OCR/vision API (Google Cloud Vision, OpenAI Vision, or Gemini). The accuracy will be lower than URL parsing because images are messier than structured data. Allow the user to manually edit the extracted ingredient list before running the compliance check to correct any OCR errors.

---

### Phase 8: Pantry/Fridge Photo Scanner

**Enhancement to the Shop tab.**

**Flow:** Before ordering groceries or heading to the store, the user snaps photos of their pantry, spice rack, and fridge. The app identifies items via image recognition API and cross-references them against the current shopping list.

**Shopping list behavior:** Items the app thinks the user already owns get highlighted yellow. A banner at the top: "Some items may already be in your kitchen." The user taps each highlighted item to dismiss it (they need it) or confirm they have it (removes from list). The final shopping list only contains what they actually need to buy.

**Limitations and how to handle them:**
- The app can identify that someone has olive oil but cannot determine quantity remaining. The "you may already have this" framing is a suggestion, not a guarantee.
- Pantry photos are messy. Items behind other items, labels facing away. Accuracy won't be 100%. Even catching 60-70% of existing pantry items saves the user money and reduces waste.
- The manual confirmation step covers the accuracy gap.

**Build notes:** Use the same vision API from Phase 7. The matching logic compares identified items against the structured shopping list data (ingredient names). Exact match and fuzzy match both needed (the API might return "extra virgin olive oil" while the shopping list says "olive oil").

---

### Phase 9: Protocol Tracking and Education

**Lives in the Profile tab.**

**Protocol guides:** For protocols with phased structures (Low-FODMAP elimination > reintroduction > personalization; AIP elimination > staged reintroduction), build lightweight guides that walk the user through each phase.

**FODMAP example:**
- "Elimination Phase: Week 3 of 6"
- Recipes shown during this phase are filtered to only natively compliant options (no modification-dependent recipes during strict elimination)
- When elimination phase ends: "Ready to reintroduce garlic? Here's the protocol. Here are 3 recipes that test just garlic. Log how you felt after each one."
- Simple symptom log: "How did you feel after reintroducing [ingredient]? Rate 1-5." Results feed back into the user's profile and adjust future recommendations.

**Reintroduction recipe matching:** The app knows which ingredients are being tested in each reintroduction phase. It surfaces recipes from the database that contain the test ingredient in isolation (no other restricted ingredients) so the user can clearly identify whether that specific food is a trigger.

**Disclaimer (required):** "CKC is not a substitute for medical advice. Always consult your healthcare provider before starting an elimination or reintroduction protocol." This appears in the protocol tracking section and during onboarding if a clinical protocol is selected.

**Build notes:** Start with Low-FODMAP only since it has the most clearly defined phases (Monash University framework). Expand to AIP next. The ingredient database per protocol phase needs to be built out (which ingredients are allowed in elimination, which are reintroduced in which order). This is real work but the Monash framework is well-documented.

---

## Key Data Model Concepts

### Recipe Object
- name, photo_url, blog_url, cuisine, protein_type, prep_time, meal_type (entree/side/sauce)
- ingredients[] (each with name, quantity, unit)
- native_compliance{} (boolean per protocol)
- modification_compliance{} (boolean per protocol, plus swap_notes string)
- chef_notes[]
- diet_compliant_notes[] (swap recommendations)
- menu_description
- side_pairings[] (linked recipe IDs with priority ranking and alternative IDs)
- base_servings: 4 (standardized)

### Meal Object (sits above individual recipes)
- entree_id (links to recipe)
- side_ids[] (links to recipes, ordered by pairing priority)
- sauce_ids[] (links to recipes)
- This relational layer enables: meal plan display with paired sides, consolidated shopping lists across a full meal, future nutrition rollup per meal

### User Profile Object
- email, auth_method
- active_protocols[] (multi-select from 8)
- household_size (integer, default 4)
- cuisine_preferences[]
- subscription_tier (free/paid)
- saved_recipes[] (with optional collection grouping)
- review_history[] (recipe_id, star_rating, swap_feedback, make_again, personal_notes, photo_url)
- protocol_tracking{} (current phase, start date, reintroduction log)

---

## Cross-Tab User Flows

### Discovery to Dinner Flow
Discover (swipe/browse) > Save recipe > Meal Plan (assign to day, sides auto-paired) > Shopping List (consolidated, scaled) > Scaling Card > Blog redirect > Cook > Review notification next day

### Single Recipe Flow (Free User)
Discover (swipe/browse) > Save recipe > Recipe Detail (see diet compliant notes, chef note preview) > Generate single-recipe shopping list > Scaling Card > Blog redirect > Cook

### External Recipe Flow (Paid User)
Scan tab > Paste URL or upload photo > Compliance score + swap recommendations > Save Modified Recipe > Add to Meal Plan > Shopping List > Cook

### Pantry-Aware Shopping Flow
Meal Plan finalized > Shopping list generated > Snap pantry photos > Items cross-referenced > Yellow highlights on items already owned > User confirms/dismisses > Final shopping list > Instacart one-tap order with organic toggle

---

## Technical Decisions

### Platform
Cross-platform: React Native or Flutter. Both handle the swipe UX well and allow iOS + Android from a single codebase.

### Recipe Data
All 500+ recipes already fully structured with ingredient name, quantity, unit. Diet compliance tags and swap notes already built across all 8 protocols. Standardized to 4 servings per entree.

### Swap Engine
Rules-based system. Each ingredient is tagged against each protocol. When an ingredient is flagged as non-compliant for a given protocol, the system looks up the swap rule (e.g., garlic + Low-FODMAP = swap to garlic-infused olive oil). Swap rules are pre-defined in a database, not AI-generated per request.

### Side Dish Pairing Engine
Built from historical menu data (52 weeks of Excel menus with entree-to-side pairings). Patterns extracted and codified into rules covering: protein affinity, cuisine pairing logic, seasonal tendencies, side role distribution, and protocol-adjusted pairing. See separate Pairing Intelligence analysis for the full rule set.

### Scaling Logic
All recipes standardized to 4 servings. Shopping list multiplier = household_size / 4. Scaling card displays the multiplier and 1-2 concrete ingredient examples when redirecting to the blog.

### Nutrition Data Source
USDA FoodData Central API (free). Map each ingredient in the database to a USDA food item ID. Calculate macros/micros per serving from structured quantity data.

### Recipe Scanning (URL)
Extract ingredients from blog post JSON-LD structured data (schema.org Recipe markup). Most WordPress recipe plugins embed this. Fallback: HTML parsing of recipe card elements.

### Image Recognition (Photo Scanner + Pantry Scanner)
Google Cloud Vision API, OpenAI Vision, or Gemini. Used for: OCR on recipe photos (Phase 7) and object detection in pantry/fridge photos (Phase 8).

### Grocery Delivery
Instacart Developer Platform API. Single integration covers multiple retailers. User selects preferred store within Instacart flow.
