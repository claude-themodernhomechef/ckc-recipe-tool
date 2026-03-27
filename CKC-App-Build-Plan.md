# Curated Kitchen Collective -- App Build Plan

## The Vision

CKC is the only app that bridges the gap between "I have a dietary restriction" and "here's exactly what to cook tonight, with real chef intelligence behind every decision." No other app has private chefs touching the recipes, a clinical nutrition degree informing the swaps, or a curated library of thousands of tested entrees with protocol-specific modifications. The goal is to build a product so comprehensive and so deeply useful that paying for it is a no-brainer.

---

## What Exists Today (The Foundation)

Before diving into phases, here is what is already built or in progress on the backend:

- Swipe-based recipe discovery UX
- Aggregated, highly rated entree recipes that have been cooked and vetted by a team of chefs
- Diet protocol tags on each recipe (AIP, Low-FODMAP, keto, gluten-free, low-histamine, etc.)
- Smart ingredient swap engine (Layer 2) with specific, chef-level swap guidance (not just "use gluten-free flour" but "use a 70/30 rice flour and tapioca starch blend at the same weight, add 1/2 tsp xanthan gum")
- Shopping list generation
- Chef notes on every recipe with improvement recommendations

This foundation is the moat. Everything below builds on top of it.

---

## Phase 1: Launch-Ready Foundation

**Status:** In progress (backend development)

**What this phase covers:** The core experience a user touches on day one. Swipe UX, recipe index, diet tags, swap engine, shopping lists, and chef notes all working together as a cohesive product.

### Build Instructions

1. **Recipe Data Model:** Each recipe record should store at minimum: recipe name, source URL or original content, cuisine type, protein type, prep time, cook time, total time, serving size, difficulty level, list of ingredients (structured: name, quantity, unit, category), diet protocol compliance flags (boolean per protocol), chef notes, swap recommendations per protocol, and image asset reference.

2. **Swap Engine Logic:** For each recipe flagged as "modifiable" for a given protocol, store a set of swap objects. Each swap object should contain: the original ingredient, the replacement ingredient(s) with exact ratios, any technique notes (e.g., "add xanthan gum to compensate for gluten structure"), and whether the swap changes the shopping list. When a user toggles a protocol, the swap engine should regenerate the ingredient list and shopping list in real time.

3. **Shopping List Generation:** Ingredients should auto-consolidate across all recipes in a user's weekly plan. Group by category (proteins first, then produce, then pantry, then dairy). Strip descriptive terms (thinly sliced, minced, etc.) and standardize measurements (tbsp, tsp, oz, cup, count, bunch, etc.). The list should update dynamically when a user adds/removes recipes or toggles a dietary protocol.

4. **Diet Protocol Tagging System:** Build a structured compliance engine, not just manual tags. Each ingredient in your database should carry its own protocol flags. When a recipe is loaded, the app checks every ingredient against the user's active protocol(s) and calculates compliance. This also powers Phase 5 later (the recipe scanner).

5. **User Profile Setup:** On first launch, collect: dietary protocol(s), household size, protein preferences, cuisine preferences, and any specific ingredient exclusions (allergies, dislikes). This data feeds personalization in later phases but should be captured now.

### Questions for Alignment

- What is the current tech stack for the backend? (Language, framework, database type.) This will determine how I frame build instructions in all future phases.
- Are the recipes stored in a database already, or still in spreadsheets/documents? If a database, what is the schema?
- How are the swap recommendations currently stored? Are they attached to each recipe individually, or do you have a master swap table (e.g., "whenever panko appears and user is GF, swap to X")?
- Is the swipe UX built as a native mobile app (iOS/Android), React Native, Flutter, or a web app?
- How many recipes are in the current index? Rough number is fine -- it helps me understand the data migration scope.
- Are you building this solo or with a dev team? This affects how I scope the technical lift per phase.

---

## Phase 2: Nutrition Data Per Recipe

**Goal:** Every recipe shows macros and key micronutrients. When someone toggles from the standard version to a protocol-specific version, the nutrition panel updates in real time. This eats into Cal AI's territory but with far more accuracy because your recipes are controlled and the data is calculated from actual ingredient quantities, not an AI guessing from a photo.

**Why this matters for retention:** People on protocols care deeply about this. A Low-FODMAP user wants to know their fiber load. A keto user wants net carbs. A high-protein user wants grams per serving front and center.

### Build Instructions

1. **Nutrition Data Source:** You need a reliable per-ingredient nutrition database. The two best options:
   - **USDA FoodData Central API** (free, public): Provides detailed macro and micro data per 100g for thousands of ingredients. You would query the API by ingredient name, map it to your structured ingredient list, and calculate per-serving nutrition based on your recipe's quantities. The SR Legacy and Foundation databases are the most useful for whole ingredients.
   - **Nutritionix API** (paid, more polished): Better fuzzy matching for ingredient names, includes branded products, and returns data in a more app-friendly format. Good if you want to reduce the data-cleaning overhead.

2. **Nutrition Calculation Engine:** For each recipe, the engine should: (a) look up each ingredient's nutrition data per the quantity used, (b) sum all ingredients for total recipe nutrition, (c) divide by serving count for per-serving values, and (d) recalculate when swaps are toggled. Store the raw per-ingredient nutrition data so recalculation is instant.

3. **What to display:** At minimum show calories, protein, fat, carbs, fiber, and net carbs (carbs minus fiber) per serving. For a strong differentiator, also show key micros that matter to protocol users: sodium, potassium, iron, vitamin A, vitamin C, calcium, magnesium. You do not need to show every micronutrient -- just the ones your target audience actively tracks.

4. **Real-Time Swap Recalculation:** When a user toggles a dietary protocol and the swap engine replaces ingredients, the nutrition panel must recalculate using the replacement ingredient's nutrition data. This means your swap objects need to be linked to nutrition records for both the original and the replacement ingredient.

5. **Data Accuracy Disclaimer:** Include a small note on the nutrition panel: "Nutrition estimates are calculated from USDA data and may vary based on brands and preparation methods." This is standard across every nutrition app and covers you.

6. **Edge Cases to Handle:**
   - Ingredients with no exact match in the nutrition database (e.g., specialty items). Build a manual override table where you or your team can enter nutrition data for uncommon ingredients.
   - "To taste" ingredients like salt. Exclude from nutrition totals or use a reasonable default (e.g., 1/4 tsp per serving for salt).
   - Cooking method impact. Nutrition databases provide raw values. For now, use raw values and note this in your disclaimer. Precision beyond that is overkill for this use case.

### Build Sequence

1. Set up the nutrition database (USDA or Nutritionix integration)
2. Map your existing ingredient list to the database entries (this is the bulk of the work -- likely needs manual review for accuracy)
3. Build the calculation engine
4. Build the front-end nutrition panel component
5. Wire the swap engine to trigger recalculation
6. QA a sample set of 20-30 recipes against known nutrition data to validate accuracy

### Questions for Alignment

- Do you already have a source for macro/micro data per ingredient, or is this starting from scratch?
- Which nutrition values matter most to your target users? I listed the ones I think are highest priority, but you know your audience better. For example, do your Low-FODMAP users care about FODMAP-specific values (like fructose load), or is standard macro/micro data enough?
- How do you want to handle the initial ingredient-to-database mapping? This is a manual-heavy task for the first pass. Are you doing this yourself, or do you have team members who can help?
- Should the nutrition panel be visible by default on every recipe, or should it be a toggle/expandable section?
- Do you want to support user-customized serving sizes (e.g., "I ate 1.5 servings") for personal tracking, or is per-recipe serving data sufficient for now?

---

## Phase 3: Grocery Delivery Integration + Organic Toggle

**Goal:** One-tap grocery ordering from any recipe or meal plan. User picks their preferred store through Instacart's marketplace (which covers Walmart, Kroger, Whole Foods, Costco, Safeway, and most major chains). A toggle lets users choose between All Organic, Dirty Dozen Only, or Conventional ingredients. This is the "holy shit" moment -- swipe a recipe, add to meal plan, hit one button, groceries show up at your door with the right organic choices.

**Why this matters for conversion:** This closes the full loop from discovery to dinner table. No other recipe app does organic-conscious grocery ordering. Health-conscious consumers, the exact people on dietary protocols, will lose their minds over this.

### Build Instructions

1. **Instacart Developer Platform (IDP) Integration:**
   - Apply for access to the Instacart Developer Platform. They explicitly list meal planning apps and personalized nutrition products as target partners. NYT Cooking, WeightWatchers, and eMeals are already integrated.
   - The IDP gives you access to: full item catalog (including nutrition data), real-time store inventory from 85,000+ stores across 1,500+ retail banners, and same-day delivery fulfillment.
   - Start with Instacart only. One integration covers all major retailers. Users pick their preferred store inside the Instacart flow. You do not need separate integrations for Walmart, Kroger, etc.

2. **Shopping List to Cart Mapping:**
   - Your structured shopping list data (ingredient name, quantity, unit, category) feeds directly into the Instacart product search API.
   - For each ingredient, query the API for the best match at the user's selected store. Return the top 1-2 product options.
   - Handle quantity conversion: your recipe says "2 cups chicken broth" but the store sells it in 32oz cartons. Build a lightweight unit-conversion layer.

3. **Organic / Dirty Dozen / Conventional Toggle:**
   - **User setting (stored in profile):** All Organic, Dirty Dozen Only, or Conventional.
   - **Dirty Dozen logic:** Maintain a list of the 12 produce items that score highest for pesticide residue. EWG publishes this annually (strawberries, spinach, kale, grapes, peaches, pears, nectarines, apples, bell peppers, cherries, blueberries, green beans -- updated each year). When the toggle is set to Dirty Dozen and the ingredient is on the list, the API query searches for the organic variant. Everything else searches conventional.
   - **All Organic logic:** Every produce item queries for organic. Optionally extend to proteins (pasture-raised, grass-fed) and dairy (organic) with their own sub-toggles.
   - **Conventional:** Default search, no modifications.

4. **Fallback Handling:**
   - If an organic variant is not available at the user's store, show the conventional option with a small note ("organic not available at your store -- showing conventional").
   - If an ingredient has no good match in the store catalog, flag it for the user to find manually.

5. **Affiliate/Revenue Opportunity:**
   - Instacart's partner program may include referral fees or revenue share. Investigate this during onboarding. Even a small per-order commission adds up with a large user base.

### Build Sequence

1. Apply for Instacart Developer Platform access
2. Build the API integration layer (product search, cart building, checkout handoff)
3. Build the organic toggle logic and Dirty Dozen list
4. Wire the shopping list "Order Groceries" button to the integration
5. Build the fallback/unavailable product UX
6. Test across multiple stores and ingredient types
7. Explore Walmart Recipes and Bundle API and Kroger API as secondary integrations after Instacart is stable (optional, for stores not on Instacart)

### Questions for Alignment

- Have you looked into Instacart's partner application process yet? There may be a waitlist or approval criteria.
- For the Dirty Dozen toggle, do you want to extend the organic preference beyond produce? For example: pasture-raised eggs, grass-fed beef, organic dairy. This adds complexity but aligns with your health-conscious audience.
- Do you want users to be able to review/edit the cart before it goes to Instacart, or should it be a one-tap handoff?
- Should the app remember a user's preferred store, or prompt them to choose each time?
- Are you interested in the affiliate revenue angle, or is the feature purely a user experience play for now?

---

## Phase 4: Personalized Recommendations + Meal Prep Mode

**Goal:** Two features that make the app feel like it actually knows the user. First, smart weekly nudges based on what they have saved and cooked. Second, a meal prep "Cook Day Guide" that sequences all of a user's weekly recipes into a single prep workflow with timing, just like you did for private chef clients.

**Why this matters for retention:** Recommendations create the "this app gets me" feeling. The meal prep guide is the feature that makes someone open the app every single week instead of once a month. Together, they transform CKC from a recipe box into a personal kitchen assistant.

### Part A: Personalized Recommendations

#### Build Instructions

1. **Data Collection Layer:** Track three things per user: what they save (intent), what they mark as cooked (action), and what they skip/dismiss (disinterest). Each recipe is already tagged by protein, cuisine, prep time, and dietary protocol. This gives you the data model for pattern matching.

2. **Recommendation Logic (start simple):**
   - You do not need machine learning for V1. Basic rule-based logic is enough to feel personal.
   - Track protein distribution over the last 3-4 weeks. If a user has not saved or cooked a fish recipe in 3+ weeks, surface a fish option.
   - Track cuisine affinity. If 4 of a user's last 7 saves are Italian-leaning, weight Italian recipes higher in the discovery feed.
   - Track seasonal alignment. Surface recipes featuring in-season produce.
   - Combine these signals into a weekly "Recommended For You" nudge.

3. **The Weekly Nudge:**
   - Push notification or in-app card: "Hey, you haven't had fish in a while and we noticed you were really into Italian flavors lately. Here is the perfect recipe -- Creamy Tuscan Salmon."
   - The tone should feel like a friend who knows your taste, not an algorithm. Write these templates in your brand voice.
   - Rotate the nudge type: sometimes it is protein-based, sometimes cuisine-based, sometimes it highlights a new addition to the recipe index.

4. **Feed Personalization:**
   - Beyond the nudge, the swipe discovery feed itself should be weighted by user preferences. Recipes matching their active protocol, preferred cuisines, and protein gaps should appear more frequently.

#### Questions for Alignment

- How do you envision users marking a recipe as "cooked"? A button on the recipe card? An end-of-week check-in? This affects the data model.
- Do you want the weekly nudge to be a push notification, an in-app popup, an email, or all three?
- Should the recommendation engine factor in household size? For example, a family of four might need different portion recommendations than a single user.
- How much editorial control do you want over the nudges? Should they be fully automated, or do you want to review/approve each week's nudge templates?

### Part B: Meal Prep Mode ("Cook Day Guide")

#### Build Instructions

1. **Core Concept:** The user selects which recipes from their weekly plan they want to batch-prep. The app generates a sequenced timeline for cooking everything in one session, optimized for shared downtime (while X marinates, prep Y's vegetables).

2. **Sequencing Logic:**
   - Each recipe already has prep time and cook time. Break these into discrete tasks: marinate, chop/mise en place, sear, braise, bake, rest, assemble.
   - Identify tasks with idle time (marinating, baking, simmering) and slot active tasks (chopping, sauteing) into those windows.
   - Generate a timeline: "10:00 AM -- Start marinade for Chicken Thighs. 10:05 AM -- Prep vegetable mise en place for all 4 recipes. 10:30 AM -- Begin braised short ribs. 10:45 AM -- While ribs braise, make the sauce base for Tuesday's pasta."

3. **Task Tagging on Recipes:**
   - This requires a new data layer on each recipe: a list of prep tasks, each with a type (active/passive), duration, and dependencies. For example: "Marinate chicken: passive, 30 min, must happen before sear."
   - Start by tagging your top 50-100 most popular recipes. You can do this manually since you have cooked all of them and know the workflows. Expand over time.

4. **Output Format:**
   - V1 can be as simple as a generated in-app walkthrough or a downloadable PDF "Cook Day Guide."
   - V2 could add real-time step tracking with timers and notifications.

5. **Shared Ingredient Optimization:**
   - When building the prep timeline, the app should also note shared base ingredients across recipes. "Buy one bunch of cilantro -- use 1/4 for Tuesday's tacos, 1/4 for Thursday's rice bowl." This ties back into the shopping list consolidation.

#### Questions for Alignment

- How detailed do you want the meal prep timeline to be? Full minute-by-minute sequencing, or more of a high-level "do these 3 things first, then these 2 things" guide?
- Are you willing to manually tag the prep tasks for the initial recipe set? This is where your private chef experience is the actual product -- nobody else can do this as well as you can.
- Should the Cook Day Guide assume a single cook, or should it support "two people in the kitchen" mode with parallel task assignments?
- Do you want the guide to include storage instructions? (e.g., "Store the braised short ribs in an airtight container, refrigerate, reheat on Tuesday at 350F for 15 min.")
- For V1, do you prefer an in-app walkthrough or a downloadable PDF?

---

## Phase 5: Recipe Compliance Scanner

**Goal:** A user screenshots a recipe from Instagram, texts a friend's recipe link, or sees something in a cookbook. They paste the URL or upload a photo. The app instantly scores it against their dietary profile ("this recipe is 80% compliant with your Low-FODMAP protocol") and shows exactly what needs to change, with specific swap recommendations from your engine.

**Why this matters for growth:** This is the viral feature. It turns the app from "use our recipes" to "bring us any recipe and we'll make it work for you." People will screenshot the compliance score and share it. It massively expands the use case beyond your curated library.

### Build Instructions

1. **Input Methods:**
   - **URL paste:** Scrape the recipe from the linked page. Most food blogs use structured data (JSON-LD with schema.org/Recipe). Parse the structured data first; fall back to HTML scraping if no structured data exists.
   - **Photo upload:** Use OCR (optical character recognition) to extract text from cookbook photos or screenshots. Google Cloud Vision API or Apple's Vision framework (for iOS) are solid options. After extraction, parse the text into a structured ingredient list.
   - **Manual entry:** Let users type or paste a plain-text ingredient list as a fallback.

2. **Ingredient Parsing:**
   - Take the raw ingredient list and parse each line into: quantity, unit, and ingredient name.
   - Map each parsed ingredient to your master ingredient database (the same one powering your diet protocol tags).
   - Handle fuzzy matching: "EVOO" should map to "extra virgin olive oil." "Chx" should map to "chicken."

3. **Compliance Scoring:**
   - Check each ingredient against the user's active protocol(s).
   - Calculate a compliance percentage: (compliant ingredients / total ingredients) x 100.
   - Display results in three buckets: Compliant (green), Needs Swap (yellow, with your specific swap recommendation), and Non-Compliant (red, no known swap or swap significantly alters the dish).

4. **Swap Recommendations:**
   - Pull from your existing swap engine. If your database has a swap for "panko on a GF protocol," surface it here with the same specificity ("use 1:1 ratio almond flour and add 1 tsp arrowroot starch for binding").
   - For ingredients with no existing swap in your database, flag them honestly: "No tested swap available for this ingredient on your protocol."

5. **Save Scanned Recipes:**
   - After scanning and modifying, let the user save the adapted recipe to their personal library within the app.

### Build Sequence

1. Build the URL recipe scraper (JSON-LD parser + HTML fallback)
2. Build the photo-to-text OCR pipeline
3. Build the ingredient parser (text to structured data)
4. Connect the parsed ingredients to your compliance engine
5. Build the compliance score UI (green/yellow/red breakdown)
6. Wire in swap recommendations from your existing engine
7. Build the "save to my library" flow

### Questions for Alignment

- How important is the photo/OCR input versus URL input? Photo scanning is a bigger engineering lift. If most of your users would paste URLs (from Instagram, TikTok, food blogs), you could ship URL-only first and add photo later.
- Should scanned recipes that get saved to a user's library also generate shopping lists and nutrition data, or are those features reserved for your curated recipes only?
- Do you want the compliance scanner to be a free feature (to drive downloads and virality) or a paid/premium feature?
- How should the app handle recipes with very low compliance scores (say under 30%)? Should it still show swaps, or should it suggest an alternative CKC recipe instead?

---

## Phase 6: Protocol Education and Tracking

**Goal:** Built-in guides for structured dietary protocols that have defined phases (elimination, reintroduction, personalization). The app knows where the user is in their protocol journey and tailors the recipe feed, recommendations, and educational content accordingly.

**Why this matters for engagement:** This is the feature that makes the subscription feel essential, not optional. Low-FODMAP has a staged reintroduction process. AIP has phased reintroductions. People currently navigate these mostly alone or with expensive dietitian appointments. CKC can fill that gap affordably.

### Build Instructions

1. **Start with One Protocol: Low-FODMAP**
   - Low-FODMAP is the best starting point because: it has the largest user base among dietary protocols, the phases are the most clearly defined, and the Monash University research provides a well-documented ingredient database for each phase.
   - Three phases: Elimination (2-6 weeks), Reintroduction (6-8 weeks), and Personalization (ongoing).

2. **Phase-Specific Ingredient Database:**
   - **Elimination phase:** Build a list of all ingredients that are safe during strict elimination. Tag every ingredient in your master database as elimination-safe or not. Monash University's FODMAP database is the gold standard source.
   - **Reintroduction phase:** Organize reintroduction by FODMAP group (fructans, GOS, lactose, fructose, sorbitol, mannitol). Each group has a testing protocol: introduce one food from that group, in a specific quantity, for 3 days, then 3 days off before the next group.
   - **Personalization phase:** The user has identified which FODMAP groups they tolerate. Their recipe feed now filters based on their personal tolerance profile.

3. **In-App Protocol Guide:**
   - When a user selects Low-FODMAP as their protocol, the app asks: "Which phase are you in?" and offers Elimination, Reintroduction, or Personalization.
   - **Elimination mode:** Recipe feed only shows elimination-safe recipes. Shopping list only includes safe ingredients.
   - **Reintroduction mode:** The app walks the user through each FODMAP group. "This week, you are reintroducing fructans. Here are 3 recipes that contain a controlled amount of garlic (a fructan source). After cooking, log how you felt."
   - **Personalization mode:** The user has flagged which groups they tolerate. The recipe feed adapts permanently.

4. **Symptom Logging:**
   - After each meal or reintroduction test, the user can log: energy level, digestive comfort, bloating, pain, skin condition, mood (simple 1-5 scale or emoji-based).
   - This data stays private to the user. The app does not interpret it medically -- it simply helps the user track patterns.
   - Over time, this log creates a personal food diary that has real value for the user's healthcare provider.

5. **Liability Management:**
   - Add a clear disclaimer at protocol enrollment: "CKC is not a substitute for medical advice. Always consult your healthcare provider before starting or modifying an elimination or reintroduction protocol."
   - You are not diagnosing or prescribing. You are organizing recipes by established clinical frameworks and providing tracking tools. This is well-trodden legal territory -- Fig gives FODMAP compliance ratings to 1M+ users, and Monash University sells an app that guides FODMAP reintroduction.
   - Your clinical nutrition degree gives you more credibility here than most competitors.

6. **Expansion Path:**
   - After Low-FODMAP is solid, add AIP (elimination + staged reintroductions) and then histamine intolerance.
   - Each protocol follows the same architecture: phase-specific ingredient database, guided reintroduction flow, symptom logging, and adaptive recipe feed.

### Build Sequence

1. Build the Low-FODMAP elimination ingredient database (map Monash data to your master ingredient list, tag each ingredient as elimination-safe or not)
2. Build the phase selection flow in the user profile (Elimination / Reintroduction / Personalization)
3. Wire the recipe feed filter to respect the user's current phase
4. Build the reintroduction guide UI (weekly FODMAP group introduction, suggested recipes, logging prompt)
5. Build the symptom logging interface and data storage
6. Build the personalization phase logic (user marks tolerated/not-tolerated FODMAP groups, feed adapts)
7. QA the full Low-FODMAP journey end-to-end with a test user account
8. Repeat the architecture for AIP, then histamine intolerance

### Questions for Alignment

- Do you want to license or reference Monash University's FODMAP data directly, or build your own elimination-safe ingredient list based on publicly available clinical literature? Monash sells API access through their app, but the underlying research is published and widely cited.
- How guided should the reintroduction flow be? Should the app set a schedule ("Day 1: try 1 clove of garlic. Day 2: try 2 cloves. Day 3: rest day.") or just suggest the FODMAP group and let the user manage timing?
- Should symptom logs be exportable? A PDF summary that a user can bring to their dietitian or gastroenterologist would be a strong differentiator and reinforces the "we work with your healthcare provider" positioning.
- For AIP, the reintroduction phases are less standardized than Low-FODMAP. How much clinical structure do you want to impose versus leaving it flexible?
- Do you want educational content (short articles or tooltips explaining each FODMAP group, why certain foods trigger symptoms, etc.) embedded in the protocol guide, or is the recipe-first approach sufficient?

---

## Phase 7: Monetization and Pricing Strategy

**Goal:** A pricing model that converts free users into paying subscribers by gating the features that deliver the most ongoing value, while keeping the core discovery experience free enough to drive downloads and word-of-mouth growth.

**Why this matters:** The entire build plan above only works as a business if it generates sustainable revenue. The pricing structure needs to feel fair to users, align with what they actually value, and create a clear upgrade moment where paying is an obvious decision.

### Pricing Architecture

1. **Free Tier (acquisition engine):**
   - Full access to the swipe discovery UX and recipe browsing.
   - View up to 5 full recipes per month (ingredients, instructions, chef notes).
   - Basic diet protocol tags visible on every recipe (so users can see compliance at a glance).
   - The compliance scanner (Phase 5) should have a free tier as well -- 3 scans per month. This is the viral feature and needs to be accessible enough to spread.

2. **Premium Tier (the core subscription):**
   - Unlimited recipe access with full chef notes and swap recommendations.
   - Nutrition data per recipe with real-time swap recalculation.
   - Full shopping list generation with cross-recipe consolidation.
   - Instacart integration with the organic/Dirty Dozen toggle.
   - Personalized weekly recommendations.
   - Meal prep mode (Cook Day Guide).
   - Unlimited compliance scanner usage.
   - Protocol education guides with symptom logging.

3. **Pricing Benchmarks:**
   - Recipe apps in this space typically charge $4.99-$9.99/month or $29.99-$59.99/year. Mealime charges $5.99/month. Eat This Much charges $8.99/month. Yummly Pro is $4.99/month.
   - Given the depth of CKC's feature set (chef-vetted recipes, clinical-grade swap engine, grocery delivery, protocol guidance), pricing at the higher end of that range is justified. The organic toggle and meal prep mode alone are features no competitor offers.
   - **Recommended starting point:** $7.99/month or $59.99/year (37% annual discount). The annual plan should be promoted aggressively because annual subscribers churn at a fraction of the rate of monthly subscribers, and the upfront revenue helps fund development.

4. **Upgrade Triggers (where to surface the paywall):**
   - When a free user hits their 5th recipe view: "You've used all your free recipes this month. Unlock unlimited access for $7.99/month."
   - When a free user tries to generate a shopping list: "Shopping lists are a Premium feature. Upgrade to build your weekly plan."
   - When a free user views a recipe with swaps available: show the standard version free, but blur the swap recommendations with a "See chef-approved swaps with Premium" overlay.
   - After a compliance scan: "Want to save this adapted recipe and add it to your meal plan? Upgrade to Premium."
   - Each of these moments is a natural point where the user has already experienced value and wants more.

5. **Trial Strategy:**
   - Offer a 7-day free trial of Premium on first install. This gets users hooked on the full experience before they ever see a gate.
   - After the trial, downgrade to free tier. The loss of features they have already used (shopping lists, meal prep, nutrition data) creates natural upgrade pressure without being manipulative -- they know exactly what they are paying for because they have already experienced it.

### Additional Revenue Streams

1. **Instacart affiliate commissions:** If the partner program offers revenue share per order, this becomes passive income that scales with user engagement. Even $1-2 per grocery order adds up when thousands of users are ordering weekly.

2. **Premium recipe packs or seasonal collections:** Sell themed recipe collections (Holiday Entertaining, 30-Minute Weeknight Dinners, Summer Grilling) as one-time purchases for $2.99-$4.99. These work well as impulse buys and can be promoted seasonally.

3. **Partnerships with specialty food brands:** Brands selling AIP-friendly, keto, or Low-FODMAP products would pay for sponsored placement in the swap recommendations or shopping list. This needs to be handled carefully -- the recommendations must remain genuinely useful, not just ads. A "Featured Partner" label with honest context ("we partnered with X because their cassava flour performs best in our testing") preserves trust.

4. **B2B licensing:** Dietitians and functional medicine practitioners could license CKC for their clients. Instead of saying "follow Low-FODMAP" and sending someone home with a pamphlet, a practitioner could say "download CKC, I've set up your protocol, and your recipes and shopping lists are ready." This is a longer-term play but has high potential.

### Questions for Alignment

- What is your target revenue goal for Year 1? This helps calibrate how aggressively to gate features versus keeping things open for growth.
- Do you have a strong opinion on free trial length? 7 days is standard, but 14 days gives users more time to build habits (especially the meal prep cycle, which is weekly).
- How do you feel about the free tier limits? 5 recipes per month is restrictive enough to drive upgrades but generous enough that someone can genuinely try the app. Would you go higher or lower?
- Are you open to the brand partnership revenue stream, or does it conflict with the "independent, chef-driven" positioning? There is a way to do it authentically, but it needs to feel right for the brand.
- Would you consider a lifetime access option? Something like $149.99 one-time. These are popular with early adopters and can fund development, but they reduce long-term recurring revenue.

---

## Phase 8: Community and Social Features

**Goal:** Turn CKC from a solo tool into a shared experience. Users can follow other users on similar protocols, share adapted recipes, rate and review meals they have cooked, and contribute their own swap discoveries. This creates a network effect that makes the app more valuable as the user base grows.

**Why this matters for long-term defensibility:** Recipe databases can be replicated. Chef notes can be imitated. But a community of 50,000 people on dietary protocols sharing their adapted recipes, rating swaps, and logging what works for their specific body -- that is a moat no competitor can copy overnight.

### Build Instructions

1. **User-Generated Swap Suggestions:**
   - After a user cooks a recipe with a swap, prompt them: "How did the swap work for you?" with a simple thumbs up/down and optional text note.
   - Aggregate this data. If 200 users report that your recommended GF bread crumb swap works great, surface that confidence ("Chef-approved and loved by 200+ users"). If users consistently report a swap falls flat, flag it for your team to revisit.
   - Over time, this creates a crowd-validated swap database on top of your chef-curated foundation.

2. **Recipe Sharing:**
   - Let users share their adapted recipes (after compliance scanning and modification) with a public link or directly to other CKC users.
   - Shared recipes should carry a tag showing which protocol they were adapted for and the compliance score.
   - This feeds the viral loop: someone shares a "97% AIP-compliant Chicken Tikka Masala" on Instagram, their followers download CKC to see the full recipe and swaps.

3. **Protocol-Specific Communities:**
   - Simple discussion threads or Q&A boards organized by protocol (Low-FODMAP, AIP, keto, etc.).
   - Moderated lightly -- the goal is peer support, not medical advice. Automate a disclaimer on every thread: "This community is for sharing experiences, not medical guidance."
   - Seed these communities with content from your own clinical nutrition knowledge to set the tone and quality bar.

4. **Meal Prep Photo Sharing:**
   - Let users post photos of their Cook Day results. This serves double duty: social proof for the meal prep feature and aspirational content that drives engagement.
   - A weekly "Prep Day Showcase" feature in the app highlights standout submissions.

### Build Sequence

1. Build the swap rating/feedback system (thumbs up/down + optional note)
2. Build the recipe sharing flow (generate shareable link, in-app sharing)
3. Build the community discussion threads (protocol-organized)
4. Build the photo sharing and Prep Day Showcase feature
5. Build moderation tools (flag, report, auto-disclaimer)

### Questions for Alignment

- How important is community to your vision for CKC? Some apps thrive on community (MyFitnessPal, Allrecipes). Others stay tool-focused and succeed without it (Mealime, Paprika). Where do you see CKC?
- Are you comfortable with user-generated content on the platform? It requires moderation, and the dietary protocol space can attract people who spread misinformation about "curing" conditions with food.
- Should community features be free or premium? Free community drives engagement and retention. Premium community feels exclusive but limits growth.
- Would you want to personally moderate or contribute to the community discussions, at least in the early days? Your credibility as a chef with a clinical nutrition background is a huge asset for setting the tone.

---

## Roadmap Summary

| Phase | Feature | Primary Value | Estimated Complexity |
|-------|---------|---------------|---------------------|
| 1 | Launch-Ready Foundation | Core product experience | High (in progress) |
| 2 | Nutrition Data | Retention, protocol user trust | Medium (data project) |
| 3 | Grocery Delivery + Organic Toggle | Conversion, full-loop experience | Medium-High (API integration) |
| 4 | Recommendations + Meal Prep | Retention, weekly engagement | Medium (needs usage data) |
| 5 | Recipe Compliance Scanner | Growth, virality, top-of-funnel | Medium-High (parsing + OCR) |
| 6 | Protocol Education + Tracking | Deep retention, subscription justification | High (clinical data work) |
| 7 | Monetization | Revenue | Low-Medium (paywall logic) |
| 8 | Community + Social | Defensibility, network effects | Medium (moderation overhead) |

### Critical Path Dependencies

Phase 1 is the foundation for everything. Nothing ships without it.

Phase 2 (nutrition data) should ship immediately after launch. It is mostly a data-mapping project and dramatically increases the perceived value of every recipe.

Phase 3 (grocery delivery) depends on Instacart Developer Platform approval, which may have a lead time. Start the application process during Phase 1 development so it is ready when you are.

Phase 4 (recommendations) requires real user data to work well. Ship it 4-8 weeks after launch once you have enough save/cook patterns to power the logic.

Phases 5 and 6 can be built in parallel. The compliance scanner (Phase 5) shares infrastructure with the diet protocol tagging system from Phase 1. The protocol education (Phase 6) is a content and data project that your clinical nutrition background uniquely qualifies you to build.

Phase 7 (monetization) should be designed during Phase 1 but does not need to be fully implemented until you have enough features to justify a premium tier. Launching with a free experience and adding the paywall at Phase 2 or 3 is a valid strategy.

Phase 8 (community) is a long-term play. Do not build it until you have a meaningful user base. Community features in an empty app feel worse than no community features at all.

### The Bottom Line

CKC has something no other recipe app can claim: every recipe has been cooked by a professional chef, every swap has been tested in a real kitchen, and the dietary protocol guidance is backed by a clinical nutrition education. The technology layers outlined above -- nutrition data, grocery delivery, compliance scanning, protocol tracking -- are amplifiers for that core advantage. They take your expertise and make it scalable.

The build order is designed so each phase adds a clear reason for users to stay, pay, or share. Phase 1 gets them in the door. Phase 2 makes them trust the data. Phase 3 makes their life easier. Phase 4 makes them feel known. Phase 5 brings in new users. Phase 6 makes them dependent on the app for their protocol journey. Phase 7 turns all of that into revenue. Phase 8 makes the whole thing self-reinforcing.

Build it in order. Ship each phase before perfecting it. Let real users tell you what to prioritize next.
