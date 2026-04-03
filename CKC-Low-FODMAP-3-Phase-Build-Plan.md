# CKC Low-FODMAP 3-Phase Diet Build Plan

## What This Feature Does

Guides users through the three clinical phases of the Low-FODMAP diet (Elimination, Reintroduction, Personalization) with phase-aware recipe filtering, ingredient-level FODMAP group tagging, symptom tracking, and progressive food unlocking. Built on the Monash University framework, the most well-documented clinical protocol for FODMAP management.

This is Layer 6 (Protocol Education and Tracking) in the CKC app roadmap, specifically scoped to the Low-FODMAP protocol as the first implementation. The same architecture will later extend to AIP (which also has elimination and reintroduction phases).

---

## Why This Matters for CKC

Low-FODMAP is the most commonly prescribed dietary protocol for IBS, affecting an estimated 10-15% of the global population. It is also one of the most confusing protocols to follow because compliance is not binary. Unlike gluten-free (contains gluten or it does not), FODMAP compliance depends on:

- Which FODMAP group the ingredient belongs to (fructans, GOS, fructose, lactose, mannitol, sorbitol)
- The serving size (many foods are low-FODMAP in small amounts but high-FODMAP in larger portions)
- Which phase the user is in (an ingredient banned in elimination may be allowed in reintroduction)
- Individual tolerance (one person may handle fructans fine but react to polyols)

No mainstream recipe app handles this correctly. Most apps treat Low-FODMAP as a binary tag, which only works for the elimination phase. CKC can own this space by being the first app that actually walks users through all three phases with recipe-level intelligence.

---

## The Three Phases (Monash Framework)

### Phase 1: Elimination (2-6 weeks)

Remove all high-FODMAP foods to establish a symptom baseline.

This is the phase Fig's `low_fodmap` column covers. Binary: compliant or not. CKC already supports this at launch using Fig data for product filtering and the existing swap engine for recipe filtering.

What the user sees in Phase 1:
- All recipes filtered to elimination-safe only
- Shopping list shows only elimination-compliant products (powered by Fig data)
- Pantry Kit filtered to elimination-safe products
- Smart Product Matching recommends elimination-safe alternatives
- Swap engine auto-applies elimination swaps (garlic to garlic-infused oil, onion to green parts of scallion, cauliflower to zucchini, etc.)

No new build required for Phase 1. This is what CKC already does at launch.

### Phase 2: Reintroduction (6-8 weeks)

Systematically test one FODMAP group at a time to identify personal triggers.

This is where CKC differentiates from every other app. The user tests one FODMAP group over 3 days, logs symptoms, and the app records whether that group is tolerated, partially tolerated, or not tolerated.

The six FODMAP groups to test (standard Monash order):

1. Fructans (garlic) -- test with 1 small garlic clove
2. Fructans (onion) -- test with 1/4 cup onion (tested separately because tolerance often differs)
3. GOS (galacto-oligosaccharides) -- test with 1/2 cup lentils or chickpeas
4. Lactose -- test with 1 cup milk
5. Fructose (excess) -- test with 1/2 mango or 2 tsp honey
6. Polyols (sorbitol) -- test with 2 dried apricots
7. Polyols (mannitol) -- test with 1/2 cup mushrooms

What the user sees in Phase 2:
- A guided reintroduction schedule showing which group to test and when
- For each test period: 3 CKC recipes that contain the test ingredient in isolation (no other restricted FODMAP groups present)
- A simple symptom log after each test day: "How did you feel? Rate 1-5" with optional notes
- After each 3-day test: the app asks "Did you tolerate [FODMAP group]?" with options: Yes / Partially / No
- The user's profile updates to reflect their tolerance status per group
- Recipe filtering adapts in real-time: if fructans (garlic) are marked "tolerated," recipes with garlic start appearing in the feed

Reintroduction recipe matching logic:
- The app needs to know which ingredients belong to which FODMAP group
- For a fructan (garlic) test: surface recipes that contain garlic but NO other high-FODMAP ingredients (no onion, no beans, no lactose dairy, no high-fructose fruit, no polyol vegetables)
- This requires the FODMAP Group Ingredient Database (see Step 2 below)

### Phase 3: Personalization (ongoing)

The user's long-term diet based on their reintroduction results.

Each FODMAP group now has a status: tolerated, partially tolerated (with quantity limits), or not tolerated. Recipe filtering respects all of these statuses simultaneously.

What the user sees in Phase 3:
- Recipes filtered based on their personal tolerance profile
- A "not tolerated" group works like elimination: those ingredients are excluded
- A "tolerated" group is fully unlocked: those ingredients appear normally
- A "partially tolerated" group shows recipes with a serving-size note: "This recipe uses 1/2 cup mushrooms. Your tolerance limit for polyols (mannitol) is 1/4 cup. Consider halving the mushroom amount."
- Shopping list and Pantry Kit reflect the personalized profile
- The user can re-test any group at any time if they want to check whether their tolerance has changed

---

## What Needs to Be Built

### Step 1: User Phase State Machine

A per-user state tracker that knows:
- Which phase the user is currently in (elimination, reintroduction, personalization)
- If in reintroduction: which FODMAP group they are currently testing
- For each FODMAP group: the tolerance status (untested, tolerated, partially tolerated, not tolerated)
- If partially tolerated: the quantity threshold

Data model:

```
user_fodmap_profile {
  user_id: string
  current_phase: "elimination" | "reintroduction" | "personalization"
  current_test_group: string | null  // e.g., "fructans_garlic"
  current_test_day: 1 | 2 | 3 | null
  phase_start_date: date
  
  group_statuses: {
    fructans_garlic: {
      status: "untested" | "tolerated" | "partial" | "not_tolerated"
      threshold: string | null  // e.g., "1 small clove per meal"
      tested_date: date | null
      symptom_logs: [{ day: 1-3, severity: 1-5, notes: string }]
    },
    fructans_onion: { ... },
    gos: { ... },
    lactose: { ... },
    fructose: { ... },
    polyols_sorbitol: { ... },
    polyols_mannitol: { ... }
  }
}
```

Where it lives: Supabase `user_fodmap_profiles` table. Syncs to local device cache so the app works offline during symptom logging.

Estimated effort: 1-2 days for the data model and CRUD operations.

### Step 2: FODMAP Group Ingredient Database

The core dataset that makes everything else work. Maps every ingredient in the CKC recipe index to its FODMAP group(s) and safe serving sizes.

This is NOT the Fig product database. This is an ingredient-level database that CKC builds and maintains independently.

Structure:

```
fodmap_ingredients {
  ingredient_name: string           // "garlic"
  fodmap_groups: string[]            // ["fructans"]
  elimination_status: "avoid" | "safe" | "safe_with_limit"
  safe_serving: string | null        // "garlic-infused oil only (no solid garlic)"
  reintroduction_test_group: string  // "fructans_garlic"
  reintroduction_test_amount: string // "1 small clove"
  notes: string | null               // "Fructans are not fat-soluble, so garlic-infused oil is safe"
}
```

Source data:
- Primary: Monash University FODMAP database (the gold standard, available via their app)
- Secondary: CKC's own compliance rules already built into the swap engine
- Your swap engine already knows: garlic = fructans, beans = GOS, mushrooms = polyols, cauliflower = polyols (mannitol), onion = fructans, honey = fructose, milk = lactose
- The gap is formalizing this knowledge into a structured database with serving-size thresholds

Estimated ingredient count: 150-200 ingredients cover the vast majority of recipes in the CKC index. You do not need to map every ingredient in existence, only the ones that appear in CKC recipes plus the standard reintroduction test foods.

Build approach:
1. Export all unique ingredients from the CKC recipe index
2. Cross-reference each ingredient against the Monash database for FODMAP group and safe serving
3. For ingredients not in Monash (rare specialty items), use clinical nutrition knowledge to assign
4. Rafi reviews the full list for accuracy (this is where your clinical nutrition background is the differentiator)

Estimated effort: 3-5 days for initial build (including Rafi review). Ongoing maintenance is minimal since new recipes are added one at a time and each new ingredient only needs to be classified once.

### Step 3: Phase-Aware Recipe Filtering

Modify the existing recipe filtering engine to respect the user's current FODMAP phase and tolerance profile.

Current state (launch): Recipe has a binary `low_fodmap` tag. Filter shows or hides the recipe based on that tag.

New state (Phase 2/3): Recipe filtering checks each ingredient against the FODMAP Group Ingredient Database and the user's tolerance profile.

Filter logic by phase:

**Phase 1 (Elimination):**
- Same as launch. Show recipes tagged `low_fodmap: true`. No change needed.

**Phase 2 (Reintroduction):**
- Two modes:
  - "Test mode": Show recipes that contain the current test ingredient AND no other untested/not-tolerated FODMAP groups. This is the isolation requirement.
  - "Safe mode": Show recipes that only contain tolerated or elimination-safe ingredients. This is what the user eats on non-test days.

**Phase 3 (Personalization):**
- Show recipes where ALL ingredients fall into one of:
  - Elimination-safe (always OK)
  - Belongs to a tolerated FODMAP group
  - Belongs to a partially tolerated group AND the recipe's serving size is within the user's threshold
- Hide recipes that contain ingredients from not-tolerated groups (unless the swap engine can remove them)
- Flag recipes that contain partially tolerated ingredients with a serving-size note

Query example for Phase 3:
```
User profile:
  fructans_garlic: tolerated
  fructans_onion: not_tolerated  
  gos: partial (1/4 cup chickpeas per serving)
  lactose: not_tolerated
  fructose: tolerated
  polyols_sorbitol: tolerated
  polyols_mannitol: partial (1/4 cup mushrooms)

Recipe: Tuscan Chickpea Stew
  Ingredients: olive oil, garlic, chickpeas (1 cup), tomatoes, spinach, rosemary

  Check:
    garlic -> fructans_garlic -> tolerated -> OK
    chickpeas -> GOS -> partial, threshold 1/4 cup -> recipe uses 1 cup (for 4 servings = 1/4 cup per serving) -> AT THRESHOLD, show with note
    tomatoes -> no FODMAP concern -> OK
    spinach -> safe_with_limit (moderate portions) -> OK
    rosemary -> no FODMAP concern -> OK
    
  Result: SHOW recipe, with note: "Chickpeas are at your GOS tolerance limit (1/4 cup per serving). Consider reducing slightly if sensitive."
```

This is the most complex piece of engineering in the build. The recipe filter needs to:
1. Look up each ingredient in the FODMAP Group Ingredient Database
2. Check the user's tolerance status for each relevant group
3. Handle partial tolerances with quantity math (recipe amount / servings vs. user threshold)
4. Generate human-readable notes for edge cases
5. Handle the swap engine interaction (can a not-tolerated ingredient be swapped out to make the recipe compliant?)

Estimated effort: 5-7 days for the filtering engine. Another 2-3 days for the swap engine integration.

### Step 4: Reintroduction UI Flow

The guided experience that walks users through Phase 2.

Screens:

**4A. Reintroduction Hub**
```
YOUR REINTRODUCTION PROGRESS

Phase 2: Reintroduction
Started: March 15, 2026

FODMAP Groups:
  Fructans (Garlic)    [Tolerated]
  Fructans (Onion)     [Testing - Day 2 of 3]
  GOS                  [Up Next]
  Lactose              [Not Yet Tested]
  Fructose             [Not Yet Tested]
  Polyols (Sorbitol)   [Not Yet Tested]
  Polyols (Mannitol)   [Not Yet Tested]

[View Test Recipes for Onion]
[Log Today's Symptoms]
```

**4B. Test Recipe Browser**
```
FRUCTANS (ONION) TEST RECIPES
Day 2 of 3

These recipes contain onion but no other
untested FODMAP groups, so you can clearly
identify how onion affects you.

[Recipe Card: Grilled Chicken with Caramelized Onion]
  Uses: 1/4 cup diced onion per serving
  All other ingredients: elimination-safe

[Recipe Card: Simple Onion and Herb Frittata]
  Uses: 2 tbsp diced onion per serving
  All other ingredients: elimination-safe

[Recipe Card: Roasted Carrots with Onion and Thyme]
  Uses: 1/4 cup sliced onion per serving
  All other ingredients: elimination-safe
```

**4C. Symptom Logger**
```
HOW DID YOU FEEL TODAY?

Testing: Fructans (Onion) - Day 2

Bloating:     [1] [2] [3] [4] [5]
Gas:          [1] [2] [3] [4] [5]
Abdominal pain: [1] [2] [3] [4] [5]
Bowel changes:  [1] [2] [3] [4] [5]

Notes (optional):
[                                    ]

[Save and Continue]
```

**4D. Test Results**
```
FRUCTANS (ONION) TEST COMPLETE

Your symptom scores over 3 days:
  Day 1: Avg 1.5 / 5
  Day 2: Avg 2.0 / 5
  Day 3: Avg 1.8 / 5

How would you classify your tolerance?

[Tolerated]         - No significant symptoms
[Partially Tolerated] - Some symptoms at higher amounts
[Not Tolerated]     - Clear symptoms, want to avoid

[If Partially Tolerated]:
What amount felt safe?
  ( ) Small amounts (1-2 tbsp per meal)
  ( ) Moderate amounts (1/4 cup per meal)
  ( ) I'm not sure yet

[Save Result and Move to Next Group]
```

Estimated effort: 3-5 days for the full UI flow (hub, test recipe browser, symptom logger, results screen).

### Step 5: Symptom Tracking and History

A simple log that persists beyond the reintroduction phase so users can track patterns over time.

Data model:
```
symptom_log {
  user_id: string
  date: date
  fodmap_group_tested: string | null  // null if not in active test
  bloating: 1-5
  gas: 1-5
  abdominal_pain: 1-5
  bowel_changes: 1-5
  notes: string | null
  meals_eaten: [recipe_id] | null  // optional: link to what they ate
}
```

Where it lives: Supabase `symptom_logs` table, synced to local cache for offline logging.

Future extension: Trend charts ("Your bloating scores over the past 30 days"), correlation analysis ("You tend to have higher symptoms on days with GOS-containing meals"), and exportable reports for healthcare providers.

Estimated effort: 1-2 days for the basic log. Trend charts and analysis are a later feature.

### Step 6: Product Database Phase Integration

Connect the user's FODMAP phase to the Pantry Kit and Smart Product Matching.

Phase 1 (Elimination):
- Fig's `low_fodmap` column handles this. No change from launch behavior.

Phase 2 (Reintroduction):
- When testing a FODMAP group, the Pantry Kit should surface products containing the test ingredient. "Testing fructans (garlic)? Here are garlic-containing products you can use for your test meals."
- Products outside the current test group remain filtered to elimination-safe.

Phase 3 (Personalization):
- Product filtering adapts to the user's tolerance profile.
- Tolerated groups: products containing those ingredients appear normally.
- Not tolerated groups: products containing those ingredients are hidden.
- Partially tolerated: products appear with a serving-size note.

The challenge: Fig's data is binary (compliant/not compliant with elimination). It does not tag products by FODMAP group. To filter products by FODMAP group, CKC would need to:
1. Parse the product's ingredient list (available in Fig data)
2. Cross-reference each ingredient against the FODMAP Group Ingredient Database (Step 2)
3. Determine which FODMAP groups the product triggers

This is a post-processing step on the Fig data. Run it once during the quarterly data refresh. For each product, generate a `fodmap_groups_triggered` array: ["fructans", "lactose"]. Store that alongside the existing compliance columns.

Estimated effort: 2-3 days for the post-processing pipeline. The UI changes in Pantry Kit and Smart Product Matching are minimal (1-2 days) since the filtering engine from Step 3 does the heavy lifting.

---

## Data Sources

| Data Need | Source | Status |
|---|---|---|
| Elimination-phase product filtering | Fig `low_fodmap` column | Available at launch |
| FODMAP group classification per ingredient | Monash University database + CKC swap engine knowledge | Needs to be built (Step 2) |
| FODMAP group classification per product | Derived from Fig ingredient lists + FODMAP Group Ingredient Database | Needs to be built (Step 6) |
| Reintroduction test protocols (which food, how much, how many days) | Monash University guidelines | Publicly documented, needs to be structured into app data |
| Symptom tracking | User-generated | Built in Step 5 |
| Safe serving sizes per ingredient | Monash University database | Needs to be structured into FODMAP Group Ingredient Database |

---

## Build Order

| Step | Task | Dependencies | Estimated Effort |
|---|---|---|---|
| 0 | Launch with elimination-only filtering (already built) | None | Done |
| 1 | User Phase State Machine (data model, CRUD, local sync) | Supabase backend | 1-2 days |
| 2 | FODMAP Group Ingredient Database (150-200 ingredients mapped to groups and serving sizes) | Monash data, CKC recipe index, Rafi review | 3-5 days |
| 3 | Phase-Aware Recipe Filtering engine | Steps 1-2 | 5-7 days |
| 4 | Reintroduction UI Flow (hub, test recipes, symptom logger, results) | Steps 1-3 | 3-5 days |
| 5 | Symptom Tracking and History (basic log with persistence) | Step 1 | 1-2 days |
| 6 | Product Database Phase Integration (FODMAP group tagging on Fig products, Pantry Kit and Smart Product Matching updates) | Steps 2-3, Fig data pipeline | 3-5 days |
| 7 | Swap engine integration (can the swap engine make a not-tolerated recipe compliant?) | Step 3, existing swap engine | 2-3 days |

Total estimated effort: 19-29 days of development work.

---

## Relationship to Other CKC Features

**Swap Engine (Layer 2):** The swap engine already contains FODMAP intelligence. It knows garlic is a fructan issue and recommends garlic-infused oil. In Phase 3, the swap engine can offer to make a recipe compliant for a user who has "fructans (onion): not tolerated" by swapping onion for the green parts of scallion. The swap engine becomes phase-aware.

**Smart Product Matching:** During reintroduction, product recommendations adapt. Testing garlic? The shopping list for a test recipe shows garlic-containing products. On non-test days, products stay elimination-filtered.

**Pantry Kit:** The user's "safe products" list evolves as they complete reintroduction. Products that were hidden during elimination gradually unlock as groups are tolerated.

**Nutrition Data (Layer 3):** Not directly related, but serving-size awareness from the FODMAP system could inform portion guidance on the nutrition layer.

**Recipe Compliance Scanner (Layer 5):** When a user scans an external recipe, the compliance score should reflect their personal FODMAP profile, not just the generic elimination rules. "This recipe is safe for YOUR Low-FODMAP profile" is far more valuable than "This recipe is/isn't Low-FODMAP."

---

## Liability and Disclaimers

Required disclaimer (appears during onboarding when Low-FODMAP is selected, and in the reintroduction section):

"CKC is not a substitute for medical advice. The Low-FODMAP diet should be undertaken with guidance from a qualified healthcare provider or registered dietitian. CKC organizes recipes and products around the established Monash University FODMAP framework but does not prescribe diets or make medical claims. Always consult your healthcare provider before starting an elimination or reintroduction protocol."

This is manageable liability because:
- CKC is organizing recipes around an established, peer-reviewed clinical framework (Monash)
- CKC is not diagnosing conditions or prescribing diets
- CKC is providing tools for users to track their own responses
- The disclaimer is clear and visible

---

## Future Extensions

**AIP Reintroduction:** AIP has a similar elimination/reintroduction structure. The same Phase State Machine and symptom tracking UI can be reused. The main work is building an AIP-specific ingredient database (which foods are eliminated, which are reintroduced in which stage, in what order).

**Multi-Protocol Phase Tracking:** A user could be in FODMAP Phase 3 (personalization) AND AIP Phase 2 (reintroduction) simultaneously. The filtering engine would need to respect both profiles at once. This is complex but architecturally possible since each protocol has its own state machine.

**Healthcare Provider Reports:** Export a summary of reintroduction results and symptom logs as a PDF to share with a dietitian or gastroenterologist. Low effort to build, high value for users who are working with a provider.

**Community Tolerance Data (anonymous, aggregated):** "87% of CKC users tolerated fructans (garlic) during reintroduction." This is powerful social proof and guidance, but requires a critical mass of users and careful privacy handling.

---

## Alignment Questions

### Data and Scope

1. **Do you want to license the Monash University FODMAP database, or build the ingredient database from publicly available Monash data plus your own clinical knowledge?** Licensing gives you the most accurate and up-to-date data but adds cost and a dependency. Building your own from public sources plus your expertise is free but requires more upfront work and ongoing maintenance. Given that CKC only needs to cover ingredients in its own recipe index (150-200 ingredients), building your own is likely sufficient.

2. **Should reintroduction follow the standard Monash order (fructans garlic, fructans onion, GOS, lactose, fructose, sorbitol, mannitol), or should users be able to choose which group to test first?** The Monash order is clinically recommended, but some dietitians allow flexibility. Letting users choose adds a small amount of UI complexity but gives more control.

3. **How many reintroduction test recipes do you need per FODMAP group?** The minimum is 3 (one per test day). Having 5-7 per group gives users variety if they want to repeat a test or don't like the first options. This means creating or tagging 21-49 recipes specifically for reintroduction testing. These need to be carefully constructed: each one must contain the test ingredient and ZERO other high-FODMAP ingredients.

### User Experience

4. **Should the reintroduction feature be free or premium?** My recommendation: premium. This is a high-value, differentiated feature that no other app offers. Users who are serious enough about FODMAP to do structured reintroduction are exactly the users willing to pay. The elimination phase (free) gets them in. The reintroduction guide (paid) converts them.

5. **Do you want push notifications during reintroduction?** ("Day 2 of your garlic test. Remember to log your symptoms tonight.") These increase compliance and engagement but require notification permissions.

6. **Should the symptom log include meal photos?** Some users find it helpful to photograph what they ate alongside their symptom scores. Adds storage requirements but is a nice-to-have.

### Technical

7. **Do you want the FODMAP Group Ingredient Database to be editable by users?** For example, if a user knows from experience that a specific ingredient triggers them even though it is technically low-FODMAP, should they be able to add a personal flag? This is the tolerance override concept from the Pantry Kit discussion applied to individual ingredients rather than FODMAP groups.

8. **Should partially tolerated groups have a single threshold or per-ingredient thresholds?** For example, if a user partially tolerates polyols (mannitol), does the threshold apply to all mannitol-containing foods equally, or can they set "1/2 cup mushrooms OK but 1/4 cup cauliflower is my limit"? Per-ingredient is more accurate but significantly more complex.

9. **When a user transitions from Phase 1 to Phase 2, should it be automatic (after X weeks) or manual (user taps "I'm ready to start reintroduction")?** Manual is safer and more respectful of the user's journey. Some people need 3 weeks of elimination, others need 6. The app should suggest ("You've been in elimination for 4 weeks. Ready to start reintroduction?") but let the user decide.
