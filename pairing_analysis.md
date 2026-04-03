# CKC Pairing Intelligence: Complete Rule Set

## Overview

This document defines the complete pairing logic for the CKC app's Side Dish Pairing Engine (referenced in the App Build Specification, Phase 1E). It was built from two sources: quantitative analysis of 51 weeks of historical menus (204 entree groups, 356 recipes, 467 indexed items) and qualitative rules captured through structured chef interviews.

The engine must evaluate what an entree already contains before making any pairing decision. The core principle: **look inside the dish first, then fill what's missing without creating conflicts.**

---

## Section 1: Entree Classification System

Before the engine selects any sides, it must classify the entree by format. The format determines what components are already present and what the entree needs.

### Format Definitions

**Standalone Complete (no sides needed):**
- Soups and stews: always stand alone, no pairings ever
- Casseroles and one-pan bakes: always stand alone (chicken noodle casserole, baked ziti, stuffed peppers, tamale casserole, lasagna)
- Bowls that contain protein + grain + vegetable: stand alone unless a component is missing

**Starch-Included (skip starch, may need vegetable):**
- Pasta dishes: starch is built in. A simple salad or green side is acceptable but never a second starch.
- Sandwiches and burgers: bread covers the starch. A side vegetable or starch is acceptable (slaw, fries, salad all work).
- Tacos: tortilla covers the starch. Flexible on sides. Rice, beans, pico, salsa, cremas, side salads, roasted vegetables are all acceptable.
- Bowls with grain but minimal/no vegetable: skip starch, add a vegetable.

**Protein-Only (needs starch + vegetable):**
- Grilled proteins served plain (kabobs, skewers, grilled chicken, pan-seared fish, grilled steak): always pair with both a starch and a vegetable.
- Lettuce wraps: lettuce is not a starch. These need a starch side. Treat differently from tacos.

**Braised/Roasted Meat (conditional):**
- If the braise/roast includes legumes and vegetables (like a tagine): only add a starch if one isn't already present.
- If the braise/roast is simple (just the meat, maybe aromatics): pair with both a starch and a vegetable.

**Build-Your-Own Bowl (multi-component):**
- These can have many small side recipes, each with its own preparation instructions. No hard cap on number of sides. The constraint is that each component should be quick to make or reuse ingredients from the entree.

### Component Detection

The engine must scan the entree's ingredient list and recipe metadata to detect:

| Component | How to Detect | Examples |
|-----------|--------------|----------|
| Built-in starch | Ingredients include rice, pasta, noodles, bread, tortilla, couscous, quinoa, potatoes, grains | Kung Pao Chicken with Rice, Butternut Squash Chicken Pasta |
| Built-in vegetable | Ingredients include 2+ vegetables beyond aromatics (onion, garlic don't count) | Stir-fry with peppers and broccoli, curry with cauliflower and peas |
| Built-in protein | Meat, fish, tofu, legumes as primary ingredient | Most entrees |
| Built-in sauce | Recipe includes a sauce/glaze/dressing as part of the preparation | Honey Balsamic Chicken, Creamy Tuscan Salmon |

**Rule: If a component is detected as built-in, do not recommend a side that fills that same role, unless the built-in version is minimal (e.g., a small rice bed under a protein counts as starch, but a few pieces of onion in a braise do not count as "vegetable included").**

---

## Section 2: Clash Prevention Rules

The engine must block pairings that create flavor, texture, or weight conflicts.

### Hard Blocks (never allow)

1. **Two starches together.** If the entree has a built-in starch, never recommend a starch side. If the entree needs a starch, never recommend a second starch alongside it.

2. **Two heavy/rich dishes together.** A braised or heavy entree (pot roast, short ribs, beef bourguignon) should not be paired with a heavy/braised side. Pair with lighter sides that provide contrast.

3. **Two competing cream-heavy dishes.** Block two standalone rich, cream-forward preparations from appearing together (e.g., Creamy Tuscan Salmon + au gratin potatoes). However, a cream-sauced protein served over a creamy base is acceptable because the base supports the entree rather than competing with it (e.g., scallops in brown butter sauce over creamy polenta is fine).

4. **Sweet side with a sweet-glazed entree.** If the entree has a sweet glaze, marinade, or sauce component (honey balsamic, maple ginger, sweet and sour), do not recommend a sweet-forward side. Choose savory, herby, or acidic sides for contrast.

### Soft Preferences (favor but don't hard-block)

5. **Favor contrast over matching.** Rich entrees pair better with bright/acidic sides. Light entrees can handle richer sides. The pairing should create balance on the plate, not reinforce a single note.

6. **Quick prep preferred.** When multiple sides qualify equally, prefer the one with shorter prep time or the one that reuses ingredients from the entree. However, a longer-prep side that is the best culinary match should still win over a quick but mediocre option.

---

## Section 3: Cuisine Pairing Logic

### Primary Rule: Entree Cuisine Drives Pairing

The entree's cuisine tag takes priority over the user's cuisine preferences. If the entree is Thai, pair with Thai-adjacent or neutral sides, regardless of whether the user's profile says they prefer Italian.

User cuisine preferences are used as a tiebreaker when multiple equally valid sides exist, or for building the alternatives list.

### Cuisine Compatibility Tiers

**Tier 1 (same cuisine):** Always the first choice when a qualifying side exists.

**Tier 2 (adjacent/bridge cuisines):** Acceptable when no same-cuisine side fits or as alternatives.
- American sides are the universal donor. They work with every cuisine.
- Middle Eastern and Mediterranean sides bridge freely between each other and into Moroccan, Indian, and European.
- Asian and Thai sides bridge freely between each other.
- Mexican and Latin sides stay within their family.

**Tier 3 (neutral):** Simple preparations with no strong cuisine identity work anywhere.
- Steamed vegetables, simple green salads, roasted vegetables, steamed rice

**Anti-pairings (block):**
- Do not pair Italian sides with Asian entrees or vice versa
- Do not pair Mexican sides with Asian entrees or vice versa
- Do not pair heavy French sides with light Asian entrees

### Cuisine Logic for Alternatives

When building the cycle-through alternatives list: same cuisine first, then adjacent cuisines, then neutral. Never include a cuisine that would create an anti-pairing clash.

---

## Section 4: Protocol Override Rules

When a user has an active dietary protocol, the pairing engine must modify its behavior. Protocol rules override normal pairing logic.

### Keto Override

**Rule:** Replace all starch recommendations with keto-friendly alternatives. Do not show the original starch to the user.

**Keto starch alternatives:** Cauliflower rice, zoodles (zucchini noodles), roasted vegetables, shirataki noodles, keto pasta, riced broccoli, spaghetti squash, mashed cauliflower.

**Behavior:** When the normal engine would recommend "Cilantro Lime Rice" as a starch side, the Keto user sees "Cilantro Lime Cauliflower Rice" (or the nearest keto-compliant alternative from the database). The original rice side is hidden entirely.

### Gluten-Free Override

**Rule:** Swap grain-based starch sides for GF alternatives. Couscous becomes quinoa or rice. Pasta sides become GF pasta. Bread-based sides (pita, crusty bread) become GF bread or are replaced with a different side role.

### Low-FODMAP Override

**Rule:** Exclude sides that are garlic-heavy or onion-heavy. Sides where garlic or onion is a primary flavor component (not just a background aromatic) should be filtered out. If a side can be made compliant with a garlic-infused olive oil swap, show it as a Tier 2 option with the modification note visible.

### AIP Override

**Rule:** Exclude sides containing nightshades (tomatoes, peppers, eggplant, potatoes, paprika-spiced dishes). No roasted peppers, tomato-based salads, potato-based starches, or paprika-seasoned vegetables. Sweet potatoes are allowed (not a nightshade).

### General Protocol Behavior

**Default display:** Show natively compliant sides (Tier 1) as the default pairing. If no Tier 1 option exists, show a modifiable side (Tier 2) with swap notes visible.

**Alternatives list:** When cycling through alternatives, exclude non-compliant sides entirely unless they can be made compliant with modifications. Modifiable sides appear in the alternatives list with their modification notes, but truly non-compliant sides are hidden.

**Never show a Tier 3 (non-compliant, non-modifiable) side to a user with that protocol active.**

---

## Section 5: Side Role Definitions and Alternative Cycling

### Role Categories

| Role | Examples | When to Recommend |
|------|----------|-------------------|
| Starch | Rice (all varieties), potatoes (mashed, roasted, fries), polenta, couscous, quinoa, bread, orzo | When the entree has no built-in starch |
| Vegetable | Roasted vegetables, sauteed greens, broccolini, bok choy, green beans, roasted squash, steamed veg | When the entree has no/minimal built-in vegetables |
| Salad/Slaw | Green salads, slaws, grain salads, chopped salads, cucumber salad | Acceptable for pasta dishes, sandwiches, as vegetable alternative |
| Sauce/Condiment | Salsas, cremas, aioli, vinaigrettes, dipping sauces | Only when the entree is dry/plain and needs a finishing element |
| Bean/Legume | Refried beans, frijoles, lentils, chickpeas | Cuisine-appropriate contexts only (Mexican, Middle Eastern, Mediterranean) |

### Alternative Cycling Rules

When the user taps the cycle button on a side slot:

1. **Alternatives must be the same role.** A starch slot cycles through other starches. A vegetable slot cycles through other vegetables. Roles do not cross.

2. **Ordering priority for alternatives:**
   - Same cuisine as the entree (Tier 1)
   - Adjacent/bridge cuisine (Tier 2)
   - Neutral preparations (Tier 3)
   - Within each tier, prefer seasonal matches (current season first, then adjacent seasons, then any season)

3. **All alternatives must pass clash prevention rules.** Every alternative is checked against the entree for starch duplication, heaviness conflicts, cream competition, and sweet-on-sweet.

4. **All alternatives must pass the user's active protocol filters.** Non-compliant alternatives are hidden. Modifiable alternatives appear with notes.

5. **No fixed cap on number of alternatives.** Show as many as are valid after applying all filters. If only 2 qualify, show 2. If 8 qualify, show 8.

---

## Section 6: Seasonal Context

### Application

Seasonal context is **preferred but not strict.** The engine should favor sides that match the current season, but a great pairing from a different season should not be excluded.

### Seasonal Side Character

**Winter:** Root vegetables, warming starches, braised greens, mashed preparations. Cauliflower rice blend, mashed sweet potatoes, couscous, roasted root vegetables.

**Spring:** Light and fresh. Asparagus, peas, light salads, herb-forward sides. Most varied season with minimal repetition.

**Summer:** Fresh and bright. Corn salads, herby green rice, grilled vegetables, fruit-forward salads, slaws. Black rice. Greek potato salad.

**Fall:** Squash-forward, earthy. Roasted kabocha squash, stewed lentils, broccolini, edamame, Asian cucumber salad, black rice. Strongest repetition patterns of any season.

### Seasonal Ordering in Alternatives

When building the alternatives list, order by:
1. Current season match + same cuisine
2. Current season match + any cuisine
3. Adjacent season match + same cuisine
4. Any season + same cuisine
5. Any season + any cuisine

---

## Section 7: Quantitative Patterns from Historical Data

These patterns were extracted from 51 weeks of menus and inform the default pairing selections.

### Protein Affinity (what sides historically pair with each protein)

**Chicken:** Most flexible protein. Accepts any side role. Historical favorites: Roasted Maple Ginger Kabocha Squash (3x with Pomegranate Chicken), Frijoles de la Olla (2x with Chicken Fajitas), Cheesey Broccoli White Rice (2x). Side role split: 36% starch, 21% vegetable, 21% salad.

**Fish:** Only protein where vegetables outrank starches. Historical favorites: Garlicky Broccolini (4x), Asian Cucumber Salad (3x), Black Rice (3x), Edamame (3x), Stewed Lentils (3x). Side role split: 32% starch, 37% vegetable, 15% salad.

**Beef:** Most starch-heavy protein. Historical favorites: Creamy Polenta (2x), Whipped Mashed Potatoes (2x), Garlicky Broccolini (2x). Side role split: 43% starch, 19% vegetable, 19% salad.

**Pork:** Highest starch dependency at 55%. Eclectic range: coconut rice, black rice, sage mashed potatoes, potato-carrot mash.

**Lamb:** 50% starch with Mediterranean lean. French Celery Root Mashed Potatoes, Zucchini Rice, Crispy Sweet Potato Fries.

**Vegetable entrees:** Rarely paired. When they are, sauces/dips dominate (60%).

### Signature Pairings (proven repeaters, use as defaults)

These specific combinations appeared multiple times in historical menus and should be preserved as default pairings:

- **Sticky Grapefruit Miso Salmon:** Asian Cucumber Salad + Black Rice + Edamame + Garlicky Broccolini + Spicy Mayo
- **Pomegranate Chicken:** Roasted Maple Ginger Kabocha Squash
- **Chicken Fajitas:** Frijoles de la Olla + Creamy Jalapeno Verde Sauce
- **Chipotle Honey Pot Roast Tacos:** Tropical Salad + Mango Vinaigrette
- **Coconut Braised Chicken and Chickpeas:** Cheesey Broccoli White Rice
- **Halibut with Citrus and Smashed Olives:** Stewed Lentils

### Cuisine Pairing Rates (historical)

Overall: 51.7% same-cuisine, 48.3% cross-cuisine.

High same-cuisine: American (79%), Mexican (67%), Middle Eastern (50%).
High cross-cuisine: Italian (75% cross), French (100% cross), Fusion (100% cross).

American sides appeared as cross-cuisine companions more than any other cuisine, confirming their "universal donor" role.

### Sauce Frequency (historical)

Only 7.4% of groups included a sauce. This low rate is intentional and should be preserved. Sauces are special-occasion additions for dry/plain entrees, not standard components.

---

## Section 8: Protocol Compliance Data

### Native Compliance Rates

| Protocol | All Recipes | Entrees | Sides |
|----------|------------|---------|-------|
| Gluten-Free | 73.0% | 66.1% | 85.4% |
| Dairy-Free | 63.5% | 65.1% | 63.8% |
| Vegan | 48.0% | 15.1% | 96.9% |
| Keto | 35.1% | 37.6% | 31.5% |
| Vegetarian | 33.1% | 12.4% | 64.6% |
| Low Histamine | 15.2% | 2.7% | 37.7% |
| Low FODMAP | 12.1% | 2.7% | 27.7% |
| AIP | 9.8% | 2.7% | 22.3% |

### Full-Group Compliance (entire pairing natively compliant)

| Protocol | Rate |
|----------|------|
| Gluten-Free | 57.4% |
| Dairy-Free | 45.6% |
| Vegan | 11.8% |
| Keto | 10.3% |
| Vegetarian | 8.3% |
| AIP | 2.0% |
| Low Histamine | 0.5% |
| Low FODMAP | 0.5% |

### Compliance Implications for Pairing

Sides are significantly more compliant than entrees across every protocol. The pairing engine's best strategy for protocol compliance is **smart side selection.** A non-compliant entree can sometimes be rescued by choosing sides that are natively compliant, keeping the overall meal closer to protocol.

For Low Histamine, Low FODMAP, and AIP: full-group compliance is nearly zero. These clients need purpose-built pairings where every component is verified individually.

---

## Section 9: Decision Tree Summary

When the engine receives an entree and a user profile, it follows this sequence:

```
1. CLASSIFY the entree format
   - Soup/stew/casserole? -> No pairings. Done.
   - Complete bowl (protein + grain + veg)? -> No pairings unless a component is missing.
   - Has built-in starch? -> Do not add starch. May add vegetable/salad.
   - Has built-in vegetables (2+ beyond aromatics)? -> Do not add vegetable unless minimal.
   - Protein-only / lettuce wrap? -> Add starch + vegetable.
   - Simple braise (meat only)? -> Add starch + vegetable.
   - Complex braise (meat + legumes + veg)? -> Add starch only if missing.
   - Taco? -> Flexible. Rice, beans, salsa, salad, roasted veg all acceptable.
   - Pasta? -> Salad or green side only.
   - Sandwich/burger? -> Vegetable or starch side acceptable.

2. CHECK for signature pairings
   - If this entree has a proven historical pairing, use it as the default.

3. APPLY protocol overrides (if user has active protocols)
   - Keto: replace starches with keto alternatives, hide originals.
   - GF: swap grain starches for GF alternatives.
   - Low-FODMAP: exclude garlic/onion-heavy sides.
   - AIP: exclude nightshade-containing sides.
   - For all protocols: default to Tier 1 (natively compliant).
     Fallback to Tier 2 (compliant with modifications, show notes).
     Never show Tier 3 (non-compliant, non-modifiable).

4. SELECT sides by cuisine match
   - Entree cuisine drives selection, not user preferences.
   - Same cuisine first, then adjacent/bridge, then neutral.

5. RUN clash prevention
   - No two starches.
   - No two heavy/rich dishes.
   - No two competing cream-heavy dishes (cream-sauce + creamy-base is OK).
   - No sweet side with sweet-glazed entree.

6. APPLY soft preferences
   - Favor quick-prep sides or ingredient-reusing sides (but don't sacrifice quality).
   - Favor seasonal matches (preferred, not strict).

7. BUILD alternatives list (for cycle button)
   - Same role only (starch swaps for starch, veg for veg).
   - Same cuisine > adjacent cuisine > neutral.
   - Current season > adjacent season > any season.
   - All alternatives must pass clash prevention + protocol filters.
   - No fixed cap on number. Show as many as qualify.

8. SAUCE decision
   - Only recommend a sauce if the entree is dry/plain and needs a finishing element.
   - Most entrees do not get a sauce. Preserve the historical 7% rate.
```
