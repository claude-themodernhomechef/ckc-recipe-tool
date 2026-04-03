# CKC Diet Compliance Rules

*Curated Kitchen Collective | Chef Rafi Levy | Updated March 26, 2026*

This document is the single source of truth for how CKC tags recipes for dietary compliance and how recipes are modified to meet additional protocols. It merges the original `diet-compliance-rules.md` (used by the automated sourcing agent) with manual modification rules derived from ingredient-level analysis of 212 recipes (Rows 285-496 of the CKC Recipe Index).

---

## Part 1: Tag Definitions and Native Compliance

These definitions determine whether a recipe receives a native diet tag (no modifications needed). A recipe is natively compliant when its published ingredient list contains nothing that violates the protocol.

### GF (Gluten-Free)

**Definition:** No wheat, rye, barley, or cross-contamination risk.

**Automatic disqualifiers in title/ingredients:** pasta, orzo, ramen noodles, lo mein, chow mein, couscous, gnocchi, tortellini, panko, pot pie, dumpling, breaded dishes, flour tortillas, bread.

**Automatic qualifiers:** Notes/title contain "gluten-free," "paleo," "Whole30," "AIP," "keto," "low-carb." Sheet pan, stir-fry, or pure protein dishes with no grain ingredients. All Minimalist Baker recipes (they specialize in GF).

**Hidden gluten sources to watch for:** Soy sauce (contains wheat), oyster sauce (often contains wheat-based soy sauce), Worcestershire sauce (contains malt vinegar from barley), hoisin sauce (may contain wheat flour), cornbread mixes (may contain wheat flour).

### DF (Dairy-Free)

**Definition:** No milk, cream, butter, cheese, yogurt, ghee, or any dairy derivative.

**Automatic disqualifiers in title/notes:** parmesan, mozzarella, feta, alfredo, cream sauce, creamy (without non-dairy specification), butter, cheese, yogurt, sour cream, ricotta, half-and-half, buttermilk, condensed milk.

**Automatic qualifiers:** Notes/title contain "dairy-free," "paleo," "Whole30," "AIP," "vegan." Coconut milk/cream based dishes are natively DF.

### V (Vegan)

**Definition:** No animal products whatsoever. No meat, fish, dairy, eggs, honey, or animal-derived ingredients.

**Automatic qualifiers:** Recipes from known vegan blogs (Minimalist Baker, Vegan Richa, Jessica in the Kitchen, The Simple Veganista, This Savory Vegan). Any recipe explicitly labeled "vegan."

**Does NOT qualify:** "Vegan adaptable," "tofu/chicken/shrimp" slash-lists, or recipes where vegan is an option rather than the default.

### Vg (Vegetarian)

**Definition:** No meat or fish. Dairy and eggs are allowed.

**Automatic qualifiers:** Explicitly says "vegetarian" (not "vegetarian adaptable"). Title has no animal proteins AND the dish is clearly plant-based (pasta e fagioli, dal, curry with no meat, etc.).

**Does NOT qualify:** "Vegetarian adaptable" or protein slash-lists.

### K (Keto)

**Definition:** Low-carb / ketogenic. No grains, starchy vegetables, sugar, or high-carb ingredients in significant amounts.

**Automatic qualifiers:** Notes explicitly say "keto" or "low-carb." Labeled Whole30/Paleo with no grain/sugar ingredients in the title. Pure protein + non-starchy vegetable dishes.

### AIP (Autoimmune Protocol)

**Definition:** Strict elimination diet. The following are ALL eliminated: nightshades (tomatoes, peppers, eggplant, potatoes), seeds (black pepper, mustard, cumin, sesame, fennel seeds, paprika), nuts, eggs, dairy, grains, legumes, alcohol, refined sugars, seed-based spices, and certain oils.

**Cascade rule:** Any recipe tagged AIP also receives GF and DF tags.

**Automatic qualifiers:** Notes explicitly say "AIP" or "autoimmune protocol."

### LF (Low-FODMAP)

**Definition:** No high-FODMAP ingredients. The primary triggers are: garlic, onion (white and light green parts), shallots, leeks (white parts), beans/legumes, wheat in large amounts, certain fruits in excess (apples, pears, mango, watermelon), cauliflower in large servings, fennel, corn, mushrooms, and high-lactose dairy.

**Key biochemistry:** FODMAPs (specifically fructans) are water-soluble but NOT fat-soluble. This means garlic-infused oil is LF-compliant because the flavor compounds transfer to the fat while the fructans stay in the discarded solids.

**Automatic qualifiers:** Notes explicitly state "Low FODMAP." Recipes from blogs like Paleo Running Momma that label LF specifically.

### LH (Low-Histamine)

**Definition:** No fermented foods, aged cheeses, smoked/cured meats, alcohol, vinegar, certain spices, avocado, tomatoes in excess, and citrus in excess.

**Specific triggers:** Pickled items, soy sauce, miso, vinegar (all types), wine/beer, smoked paprika, sumac, sour cream, aged parmesan/pecorino, avocado, sriracha/hot sauce, Dijon mustard, black pepper (in some protocols).

**Automatic qualifiers:** Only when explicitly noted. Very rare in the dataset.

---

## Part 2: Automated Tagging Logic

A Python script (fill_tags.py) applies native tags heuristically from the recipe title, notes, cuisine style, and blogger name without visiting each URL. The approach is intentionally conservative: only apply tags when clearly confident.

### Detection Cascades

- Whole30 or Paleo in notes: automatically gets GF + DF
- AIP in notes: gets AIP + GF + DF
- Low FODMAP in notes: gets LF
- Known vegan blog: gets V + Vg + DF

### Results (from 1,487 recipes)

- Diet Tags filled: 1,193 (80% coverage, up from 25 / 1.7%)
- Tags intentionally blank: 294 (recipes like cheesy pasta, breaded dishes where no tags apply)
- Protein column filled: 1,195
- Entree Type column filled: 1,487

---

## Part 3: Manual Modification Rules

These rules govern the "Modified Compliance" columns (Q-AF in the Recipe Index). They document how to adapt a recipe to meet a protocol through specific, targeted ingredient swaps that preserve the dish's identity.

### The Decision Framework

**Step 1:** Can this recipe be natively tagged? If no offending ingredients exist, tag natively. No modification needed.

**Step 2:** If not natively compliant, can a simple swap fix it? A "simple swap" means replacing one ingredient with a specific alternative that preserves the dish's character.

**Step 3:** If the swap is more complex, is the dish still recognizable after the modification?

**Step 4:** If the dish would lose its identity, skip the modification entirely. No modification is better than a bad one.

### When NOT to Modify

- The offending ingredient IS the dish (no LF mod for Chickpea Soup, no Keto mod for Rice Pilaf)
- AIP would require removing 4+ core ingredients
- The modification creates a fundamentally different recipe
- The grain/starch is the entire dish format with no viable substitute
- The fermented ingredient provides the dish's defining flavor (miso in miso soup, vinegar in pickled vegetables)

---

## Part 4: Low-FODMAP (LF) Modification Rules

LF is the most frequently modified protocol. Out of 212 recipes, 105 received LF modifications.

### 4.1 The Garlic-Infused Oil Rule

**Principle:** FODMAPs (fructans) are water-soluble but not fat-soluble. Garlic infused in oil transfers flavor compounds to the fat while fructans stay in the discarded solids.

**Standard swap formulas:**

- Recipe has garlic + olive oil: "Replace garlic and [X] tbsp of oil with garlic-infused oil"
- Recipe has garlic + onion + oil: "Remove garlic and onion and replace [X] tbsp of the oil with garlic-infused oil"
- Recipe has garlic only (no oil): "Replace garlic with 1 tbsp garlic-infused oil"
- Recipe has shallots: "Replace shallots and garlic with [X] tbsp garlic-infused oil"

**Always quantify the oil amount.** The quantity replaces both the original oil AND the removed garlic's flavor contribution.

### 4.2 The Scallion Green Rule

**Principle:** The white and light green parts of scallions contain fructans (high-FODMAP). The dark green tops do not.

**Standard swap formulas:**

- Red onion in salads: "Remove red onion" (no replacement needed if other vegetables provide texture)
- Onion in cooked dishes: "Replace onion with green tops of [X] scallions"
- Shallots in meatballs: "Replace shallots with greens from 2 scallions"
- Chives in salads: "Replace chives with green onion tops"

### 4.3 The Cook-and-Discard Method

**Principle:** In slow braises, aromatic vegetables impart flavor to the liquid. FODMAPs leach into the liquid at lower, often tolerable concentrations. Discarding the solids removes the concentrated source.

**Use only for:** Slow braises where aromatics serve a flavoring purpose but are not consumed as part of the final dish.

- "Ok to consume the beef as is, discard the onion, carrot and parsnip once cooked."
- "Ok to use shallots but discard once finished cooking."

### 4.4 Bean, Legume, and Corn Removal

**Beans/legumes:** High-FODMAP due to GOS (galacto-oligosaccharides). Remove when supporting, skip the LF modification entirely when the legume IS the recipe.

- Remove cannellini beans from minestrone (beans are one of many components)
- Remove chickpeas from roasted squash (squash is the star)
- Remove peanut butter from coconut chicken (peanuts are a legume)
- Never attempt LF for Chickpea Soup, Refried Beans, etc.

**Corn:** Moderate-FODMAP due to sorbitol. Remove from salads and tacos.

**Fennel:** Moderate-to-high FODMAP due to fructan content. Remove entirely.

### 4.5 Additional LF Swaps

| Ingredient | LF Swap |
|---|---|
| Soy sauce | Tamari |
| Greek yogurt | Lactose-free greek yogurt or coconut yogurt |
| Heavy cream | Coconut milk |
| Sour cream | Lactose-free sour cream |
| Commercial sauce mixes | Specific LF-safe replacement (bouillon, LF brand) |
| Wine / alcohol | Matching broth (chicken for white wine, beef for red) |
| Balsamic vinegar | Tamari + matching broth |
| Honey (in excess) | Limit to 1 tbsp or replace with maple syrup |
| Flour (in gravies) | Arrowroot powder or GF 1:1 flour |
| Mushrooms | Remove entirely |

---

## Part 5: Dairy-Free (DF) Modification Rules

62 recipes received DF modifications. The swap depends on the functional role of the dairy.

### 5.1 By Functional Role

**Cream / richness (heavy cream, half-and-half):**
- Default: Full-fat canned coconut milk
- Lighter applications: Unsweetened oat or soy milk

**Tang / cultured (greek yogurt, sour cream):**
- Default: Plain unsweetened coconut yogurt
- LF overlap: Lactose-free greek yogurt

**Cheese / umami (parmesan, pecorino):**
- For savory depth: Nutritional yeast + miso paste or porcini mushroom powder
- For hard cheese texture: Follow Your Heart brand vegan parmesan
- For melting texture: Kite Hill brand vegan mozzarella/ricotta

**Cheese as garnish (feta, cotija, blue cheese):**
- Simply remove. Do not replace a garnish.
- Exception: If feta is a core ingredient (not just a sprinkle), use DF feta
- Alternative: Replace cheese with avocado (in salads where a creamy element is needed)

**Butter:**
- Cooking fat (sauteing, browning): Replace with olive oil
- Finishing fat (mashed potatoes, baking): Replace with DF butter
- Already has coconut milk: Simply remove the butter

---

## Part 6: Gluten-Free (GF) Modification Rules

67 recipes received GF modifications.

### 6.1 Thickener Replacement

**Arrowroot powder** (gravies, au jus, thin sauces): Creates a clearer, glossier sauce. Reduce quantity vs. flour (1/4 c flour becomes 1 tbsp arrowroot).

**1:1 GF flour blend** (coating, binding, dumplings, breading, thick stews): Needed for structural applications where arrowroot alone cannot provide the right texture.

### 6.2 Pasta and Grain Swaps

| Original | GF Swap |
|---|---|
| General pasta | GF alternative |
| Italian pasta (texture-critical) | Brown rice pasta |
| Orzo | Cassava flour orzo |
| Couscous | GF couscous or cauliflower rice |
| Ramen / lo mein noodles | Brown rice noodle alternative |
| Tortellini | GF tortellini |
| Flour tortillas | Corn tortillas or GF wraps |
| Bread / buns | GF bread alternative |
| Cornbread mix | GF cornbread mix |

### 6.3 Condiment Swaps

| Original | GF Swap |
|---|---|
| Soy sauce | Tamari |
| Soy sauce (soy-sensitive) | Coconut aminos |
| Oyster sauce | GF oyster sauce |
| Worcestershire sauce | GF Worcestershire sauce |
| Hoisin sauce | GF hoisin sauce |

### 6.4 Breadcrumb and Bread Handling

- Breadcrumbs in binding (meatballs): Replace with GF panko
- Panko breading: Use GF panko
- Croutons (topping only): Remove entirely
- Pita: Use GF pita

---

## Part 7: Keto (K) Modification Rules

82 recipes received Keto modifications.

### 7.1 Grain and Starch Replacements

| Original | Keto Swap |
|---|---|
| White rice | Cauliflower rice |
| Couscous | Cauliflower rice |
| Quinoa | Cooked vegetables |
| Orzo | Sauteed cauliflower rice |
| Mashed potatoes | Cauliflower mash |
| Sweet potatoes (mashed) | Cauliflower mash |
| Potatoes (in salads) | Roasted cauliflower florets |
| Potatoes (in stews) | Remove, or add 1 tbsp arrowroot to compensate |
| Gnocchi | Cauliflower gnocchi |

### 7.2 Noodle and Pasta Replacements

| Context | Keto Swap |
|---|---|
| Asian noodle dishes (bold sauce) | Shirataki noodles |
| Light-sauced pasta | Spiralized zucchini |
| Heavy pasta dishes | Keto pasta |

**Shirataki noodles:** Reserve for Asian dishes only where the sauce is bold enough to carry the neutral flavor.

### 7.3 Tortilla and Bread Replacements

- Tacos / enchiladas: Keto wraps
- Burgers: Iceberg or butter lettuce wraps (specify variety for proper cupping)
- Tortilla chips: Keto tortilla chips or remove
- Burritos: GF wraps

### 7.4 Sweetener Replacements

**Default keto sweetener: Allulose.** Caramelizes, dissolves, no cooling effect. Zero glycemic impact.

- Honey: "Replace honey with allulose liquid sweetener"
- Brown sugar: "Replace with allulose sweetener"
- White sugar: "Use allulose sugar as a replacement"
- BBQ / caramelization: Trehalose as alternative

**Reduction approach:** When full elimination is unnecessary, just reduce: "Reduce the amount of honey and flour to 1 tbsp."

### 7.5 Fruit Management

Do not blanket-ban fruit. Manage net carbs by context:

- High-sugar fruit as topping: Replace with double avocado
- Fruit in moderate amounts: Reduce by half ("Consume 1/2 the amount of pineapple")
- Fruit as core ingredient: Swap for similar-texture vegetable (apple becomes fennel)
- Juice as cooking liquid: Replace half with matching broth

### 7.6 Breading Replacements (Keto)

- Panko in meatballs: Equal parts cauliflower rice
- Breading for schnitzel: Cauliflower-based panko
- Breadcrumbs for binding: Almond flour
- Decorative panko topping: Remove entirely

### 7.7 Strategic Removal

Remove carb elements entirely when not structurally necessary: beans from soup, pasta from minestrone, dumplings from chicken soup, hominy from pozole, croutons/wontons from salads, corn from tacos.

---

## Part 8: Autoimmune Protocol (AIP) Modification Rules

27 recipes received AIP modifications. Only modify when the recipe can survive eliminations and remain recognizable. If 4+ core ingredients need removal, skip it.

### 8.1 Seed-Based Ingredients (Always Remove)

- Black pepper
- Mustard / Dijon (seed-based)
- Cumin
- Sesame seeds and sesame oil
- Sunflower seeds, pepitas
- Fennel seeds

### 8.2 Nightshade Ingredients (Always Remove)

- Chili flakes / red pepper flakes
- Paprika (regular and smoked)
- Jalapeno / serrano / poblano peppers
- Bell peppers
- Curry powder: Replace with turmeric (curry contains chili and seeds)
- Chili crisp / gochujang / hot sauce
- Tomatoes in concentrated forms (fresh in small amounts may be tolerated)

### 8.3 AIP-Safe Replacements

| Problem | AIP Swap |
|---|---|
| Soy sauce | Coconut aminos |
| Miso | Coconut aminos |
| Fish sauce | Coconut aminos |
| Vinegar (all types) | Fresh citrus juice (lime or lemon) |
| Wine / alcohol | Matching broth |
| Brown sugar | Agave |
| Flour / cornstarch | Arrowroot powder |
| Almond milk | Rice milk |

**Coconut aminos** is the universal AIP savory liquid. It replaces soy sauce, miso, AND fish sauce depending on context.

**Agave** is the AIP-safe sweetener. Distinct from allulose (keto).

### 8.4 Fermented Foods (Remove on AIP)

- Olives (fermented)
- Vinegar (all types, replace with citrus)
- Wine / beer (replace with broth)
- Bouillon cubes with restricted ingredients

---

## Part 9: Vegan (V) and Vegetarian (Vg) Modification Rules

45 recipes received V modifications, 30 received Vg.

### 9.1 Protein Replacement by Dish Type

**Tofu:** Always specify "extra firm." Match the cut to the protein shape:

- Steak in wraps: Crumbled extra firm tofu
- Shrimp in bowls: Extra firm tofu cubed into 1 inch blocks
- Chicken on skewers: 2 lbs extra firm tofu cut into 1 inch cubes
- Fish fillets: Tofu rectangles (1 lb block cut into four thin pieces)
- Prawns in stir-fry: 1 lb firm tofu

**Impossible Beef / meat alternatives:** For bold spice profiles where the seasoning carries the swap (Moroccan meatballs, enchiladas, lasagna).

**Mushrooms:** For ground meat texture in pies and pulled sandwiches. "Replace beef with 1 lb of mushrooms finely chopped."

**Beans:** Culturally authentic for Mexican/Latin dishes. Always specify the type:

- Tamale casserole: Pinto beans
- Enchiladas: Black beans
- Soups: Cannellini beans

### 9.2 Broth Swap Rule

**Every vegan/vegetarian modification involving a meat-based recipe MUST explicitly state "replace chicken/beef broth with vegetable broth."** Never assume this is obvious. State it every time.

### 9.3 Egg Replacement

- Binding in meatballs/casseroles: Flax egg (2 tbsp ground flax + 1 tbsp water). Always provide the exact ratio.
- Remove egg if not structurally critical.

### 9.4 Condiment Swaps

| Original | Vegan Swap |
|---|---|
| Anchovy paste | 1 tbsp tamari + 1 tbsp capers with juice |
| Worcestershire sauce | Vegan Worcestershire sauce |
| Fish sauce | Extra soy sauce |
| Oyster sauce | Vegan oyster sauce |
| Honey | Agave |
| Buttermilk | 1 tbsp vinegar + 1/3 c soy milk (rest 10 min) |
| Condensed milk | 2 tbsp agave |

---

## Part 10: Low-Histamine (LH) Modification Rules

16 recipes received LH modifications. The most clinically specialized protocol.

### 10.1 Fermented and Aged Foods

| Original | LH Swap |
|---|---|
| Vinegar (all types) | Fresh citrus juice (lime or lemon) |
| Wine | Matching broth |
| Pickled items | Remove |
| Aged cheese (parmesan, pecorino) | Remove or DF alternative |
| Soy sauce / miso | Remove or coconut aminos |
| Smoked paprika | Remove |
| Sour cream | Remove |

### 10.2 Specific Histamine Triggers

- Avocado: Remove. Replace with cucumber for similar cooling effect.
- Tomatoes (concentrated): Remove when in large amounts
- Black pepper: Remove entirely
- Chili / sriracha / chipotle: Remove entirely
- Mustard / Dijon: Remove
- Sumac: Remove (dried berry, high-histamine)
- Lemon in large amounts: Remove or reduce (some LH protocols flag excess citrus)
- Fennel seeds: Remove
- Canola oil: Replace with olive oil

---

## Part 11: Master Ingredient Swap Reference

| Problem Ingredient | Protocol(s) | Standard Swap |
|---|---|---|
| Garlic / onion | LF | Garlic-infused oil (quantified per recipe) |
| Onion (visual needed) | LF | Green parts of scallions only |
| Shallots | LF | Green tops of scallions + garlic-infused oil |
| Leeks (white parts) | LF | Green tops of leeks only |
| Fennel | LF | Remove entirely |
| Corn | LF | Remove entirely |
| Beans / legumes | LF | Remove (only when supporting, not starring) |
| Peanut butter | LF | Remove entirely |
| Mushrooms | LF | Remove entirely |
| Commercial sauce mixes | LF | LF-safe brand or bouillon |
| Heavy cream | DF / V | Full-fat canned coconut milk |
| Half-and-half | DF | Coconut milk |
| Greek yogurt (tang) | DF / V / LF | Plain unsweetened coconut yogurt |
| Greek yogurt (LF only) | LF | Lactose-free greek yogurt |
| Sour cream | DF / LF | DF alternative or lactose-free |
| Parmesan (umami) | DF / V | Nutritional yeast + miso or porcini powder |
| Parmesan (brand) | DF / V | Follow Your Heart vegan parmesan |
| Mozzarella (melting) | DF / V | Kite Hill brand or DF alternative |
| Feta (garnish) | DF | Remove entirely |
| Feta (core) | DF | DF feta |
| Cotija | DF / V | Remove entirely |
| Butter (cooking) | DF / V | Olive oil |
| Butter (finishing) | DF / V | DF butter |
| AP flour (thickener) | GF | Arrowroot powder (reduce quantity) |
| AP flour (structural) | GF | 1:1 GF flour blend |
| Breadcrumbs / panko | GF | GF panko |
| Pasta (Italian) | GF | Brown rice pasta |
| Orzo | GF | Cassava flour orzo |
| Couscous | GF | GF couscous or cauliflower rice |
| Flour tortillas | GF | Corn tortillas or GF wraps |
| Soy sauce | GF / LF | Tamari |
| Soy sauce (soy-sensitive) | GF | Coconut aminos |
| Oyster sauce | GF | GF oyster sauce |
| Worcestershire sauce | GF / V | GF or vegan variety |
| Hoisin sauce | GF | GF hoisin sauce |
| White rice | K | Cauliflower rice |
| Mashed potatoes | K | Cauliflower mash |
| Potatoes (salads) | K | Roasted cauliflower florets |
| Tortillas | K | Keto wraps |
| Burger buns | K | Butter lettuce or iceberg wraps |
| Ramen noodles | K | Shirataki noodles (Asian dishes only) |
| Pasta (light sauce) | K | Spiralized zucchini |
| Gnocchi | K | Cauliflower gnocchi |
| Panko (keto) | K | Cauliflower-based panko or almond flour |
| Honey / sugar | K | Allulose (liquid or granular) |
| Brown sugar (BBQ) | K | Trehalose |
| High-sugar fruit | K | Double avocado or reduce by half |
| Juice (cooking liquid) | K | Replace half with matching broth |
| Black pepper | AIP | Remove entirely |
| Cumin | AIP | Remove or replace with cinnamon |
| Mustard / Dijon | AIP | Remove entirely |
| Sesame seeds / oil | AIP | Remove entirely |
| Chili / paprika | AIP | Remove entirely |
| Bell peppers | AIP | Remove entirely |
| Curry powder | AIP | Replace with turmeric |
| Soy sauce / miso | AIP | Coconut aminos |
| Fish sauce | AIP | Coconut aminos |
| Vinegar | AIP / LH | Fresh citrus juice |
| Wine / alcohol | AIP / LF / LH | Matching broth |
| Brown sugar | AIP | Agave |
| Olives | AIP | Remove (fermented) |
| Almond milk | AIP | Rice milk |
| Avocado | LH | Cucumber |
| Smoked paprika | LH | Remove entirely |
| Sumac | LH | Remove entirely |
| Canola oil | LH | Olive oil |
| Chicken / steak (vegan) | V | Extra firm tofu (cut to match protein shape) |
| Ground meat (Mexican) | V / Vg | Pinto or black beans |
| Ground meat (pies) | V / Vg | 1 lb mushrooms finely chopped |
| Shrimp | V / Vg | Extra firm tofu cubes |
| Eggs (binding) | V | Flax egg (2 tbsp ground flax + 1 tbsp water) |
| Chicken / beef broth | V / Vg | Vegetable broth (state explicitly every time) |
| Anchovy paste | Vg | 1 tbsp tamari + 1 tbsp capers with juice |
| Fish sauce | V | Extra soy sauce |
| Honey | V | Agave |
| Buttermilk | V | 1 tbsp vinegar + 1/3 c soy milk (rest 10 min) |

---

*Generated March 26, 2026 | CKC Recipe Tool | Chef Rafi Levy*
*Derived from: diet-compliance-rules.md (agent sourcing rules), CKC_Recipe_Tags_Session_Summary.docx (automated tagging session), and ingredient-level analysis of 212 recipes (Rows 285-496, CKC Recipe Index).*
