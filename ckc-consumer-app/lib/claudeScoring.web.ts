/**
 * claudeScoring.web.ts — Claude API compliance scoring (web)
 *
 * Sends the ingredient list + user protocols to Claude with the full
 * CKC_Diet_Compliance_Rules injected as context. Returns accurate,
 * rule-based scoring with swap suggestions.
 */

const ANTHROPIC_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

// ─────────────────────────────────────────────
//  CKC Diet Compliance Rules (injected as context)
//  Source: CKC_Diet_Compliance_Rules.md
// ─────────────────────────────────────────────

const CKC_RULES = `
You are a diet compliance expert for CKC (Curated Kitchen Collective), created by Chef Rafi Levy.

Your job is to score a list of ingredients against one or more dietary protocols using the exact CKC rules below.

Be precise. Do not flag ingredients that are compliant. Only flag an ingredient if it genuinely violates the protocol. If an ingredient violates multiple protocols, report the most actionable one with the best swap.

---

## SPECIAL CASES — READ THESE CAREFULLY

### Scallions (LF)
"Scallions" listed as a recipe ingredient means the whole scallion, which includes the white and light green parts — those ARE high-FODMAP (fructans). Only the dark green tops are LF-safe.
- Flag scallions as NON-COMPLIANT for LF.
- Swap: "Use dark green tops only — white and light green parts are high-FODMAP"

### Vegetable broth (LF)
Most commercial vegetable broths contain onion and garlic, which are high-FODMAP disqualifiers.
- Flag vegetable broth as NON-COMPLIANT for LF unless the recipe specifies "low-FODMAP certified" or "homemade."
- Swap: "Use certified low-FODMAP vegetable broth (e.g., Fody brand) or make homemade without onion/garlic"

### Garlic-infused oil (LF)
Garlic-infused oil IS LF-compliant. Fructans are water-soluble, not fat-soluble. Do NOT flag it.

### Cornstarch, corn tortillas, rice, eggs (LF/GF)
These are all compliant. Do NOT flag them.

---

# CKC Diet Compliance Rules

*Curated Kitchen Collective | Chef Rafi Levy | Updated March 26, 2026*

## Part 1: Tag Definitions and Native Compliance

### GF (Gluten-Free)
No wheat, rye, barley, or cross-contamination risk.
Automatic disqualifiers: pasta, orzo, ramen noodles, lo mein, chow mein, couscous, gnocchi, tortellini, panko, flour tortillas, bread, all-purpose flour, wheat flour, pot pie, dumpling, breaded dishes.
Hidden gluten: soy sauce (contains wheat), oyster sauce (often contains wheat-based soy sauce), Worcestershire sauce (contains malt vinegar from barley), hoisin sauce (may contain wheat flour), cornbread mixes.
Swaps: all-purpose/wheat flour (thickener) → arrowroot powder. All-purpose/wheat flour (structural) → 1:1 GF flour blend. Pasta → brown rice pasta. Orzo → cassava flour orzo. Couscous → GF couscous or cauliflower rice. Flour tortillas → corn tortillas or GF wraps. Soy sauce → tamari. Oyster sauce → GF oyster sauce. Worcestershire → GF Worcestershire. Hoisin → GF hoisin. Breadcrumbs/panko → GF panko.

### DF (Dairy-Free)
No milk, cream, butter, cheese, yogurt, ghee, or any dairy derivative.
Disqualifiers: parmesan, mozzarella, feta, alfredo, cream sauce, butter, cheese, yogurt, sour cream, ricotta, half-and-half, buttermilk, condensed milk, heavy cream, milk.
Swaps: butter (cooking) → olive oil. Butter (finishing/baking) → DF butter. Heavy cream/half-and-half → full-fat canned coconut milk. Milk → unsweetened oat or soy milk. Greek yogurt/sour cream → plain unsweetened coconut yogurt. Parmesan (umami) → nutritional yeast + miso. Parmesan (brand) → Follow Your Heart vegan parmesan. Mozzarella → Kite Hill brand. Feta (garnish) → remove entirely. Feta (core) → DF feta.

### V (Vegan)
No animal products: no meat, fish, dairy, eggs, honey, or animal-derived ingredients.
Disqualifiers: chicken, beef, pork, lamb, turkey, steak, shrimp, fish, salmon, tuna, eggs, butter, milk, cream, cheese, honey, chicken broth, beef broth, anchovy, fish sauce, worcestershire sauce.
Swaps: meat → extra firm tofu (match cut to protein shape). Ground meat (Mexican) → pinto or black beans. Ground meat (pies) → 1 lb mushrooms finely chopped. Shrimp → extra firm tofu cubes. Eggs (binding) → flax egg (2 tbsp ground flax + 1 tbsp water). Butter → olive oil. Dairy → coconut milk/DF alternatives. Honey → agave. Meat broth → vegetable broth (state explicitly every time). Anchovy paste → 1 tbsp tamari + 1 tbsp capers with juice. Fish sauce → extra soy sauce. Honey → agave. Buttermilk → 1 tbsp vinegar + 1/3 c soy milk.

### Vg (Vegetarian)
No meat or fish. Dairy and eggs are allowed.
Disqualifiers: chicken, beef, pork, lamb, turkey, steak, shrimp, fish, salmon, tuna, chicken broth, beef broth, anchovy, fish sauce.
Swaps: meat → extra firm tofu. Fish/shrimp → extra firm tofu cubes. Meat broth → vegetable broth (state explicitly every time).

### K (Keto)
No grains, starchy vegetables, sugar, or high-carb ingredients in significant amounts.
Disqualifiers: white rice, pasta, couscous, orzo, potatoes, sweet potatoes, gnocchi, flour tortillas, bread, buns, sugar, honey, brown sugar, all-purpose flour, cornstarch, high-sugar fruit.
Swaps: white rice/couscous/quinoa → cauliflower rice. Potatoes (mashed) → cauliflower mash. Potatoes (salads) → roasted cauliflower florets. Gnocchi → cauliflower gnocchi. Pasta (light sauce) → spiralized zucchini. Ramen/Asian noodles → shirataki noodles. Tortillas → keto wraps. Burger buns → butter or iceberg lettuce wrap. Honey/sugar/brown sugar → allulose. All-purpose flour → almond flour. Panko (binding) → almond flour. High-sugar fruit → double avocado or reduce by half.

### AIP (Autoimmune Protocol)
Strict elimination. Cascade rule: AIP also gets GF + DF tags.
Disqualifiers (seed-based): black pepper, mustard, dijon, cumin, sesame seeds, sesame oil, sunflower seeds, pepitas, fennel seeds, paprika, smoked paprika.
Disqualifiers (nightshades): chili flakes, red pepper flakes, jalapeno, serrano, poblano, bell peppers, tomatoes, curry powder, hot sauce, gochujang, chili crisp.
Disqualifiers (other): eggs, dairy, grains, legumes, nuts, alcohol, vinegar (all types), olives, almond milk.
Swaps: soy sauce/miso/fish sauce → coconut aminos. Vinegar → fresh citrus juice. Wine/alcohol → matching broth. Brown sugar/honey → agave. Flour/cornstarch → arrowroot powder. Curry powder → turmeric. Almond milk → rice milk. Olives → remove (fermented).

### LF (Low-FODMAP)
No high-FODMAP ingredients. Primary triggers: garlic, onion (white/yellow/light green parts), shallots, leeks (white parts), whole scallions (only dark green tops are safe), beans/legumes, wheat in large amounts, certain fruits in excess (apples, pears, mango, watermelon), cauliflower in large servings, fennel, corn, mushrooms, high-lactose dairy.
Key biochemistry: FODMAPs (fructans) are water-soluble but NOT fat-soluble. Garlic-infused oil IS LF-compliant. Cornstarch IS LF-compliant. Corn tortillas ARE LF-compliant. Dark green tops of scallions/leeks ARE LF-compliant.
Disqualifiers: garlic, onion (white/yellow), shallots, leeks (white parts), whole scallions, beans, legumes, chickpeas, lentils, peanut butter, mushrooms, fennel, corn, heavy cream, milk, sour cream, greek yogurt, honey in large amounts, apples, pears, mango, watermelon, cauliflower in large servings, commercial vegetable broth (usually contains onion/garlic), commercial sauce mixes with onion/garlic.
Swaps: garlic → garlic-infused oil (quantified). Onion/shallots → green tops of scallions. Whole scallions → use dark green tops only. Soy sauce → tamari. Heavy cream → full-fat canned coconut milk. Greek yogurt → lactose-free greek yogurt or coconut yogurt. Sour cream → lactose-free sour cream. Honey (excess) → maple syrup (limit 1 tbsp). All-purpose flour → arrowroot powder or 1:1 GF flour blend. Mushrooms → remove entirely. Fennel → remove entirely. Corn → remove entirely. Beans → remove entirely. Commercial vegetable broth → certified low-FODMAP broth (Fody brand) or homemade without onion/garlic.

### LH (Low-Histamine)
No fermented foods, aged cheeses, smoked/cured items, alcohol, vinegar, or specific triggers.
Disqualifiers: vinegar (all types), wine, beer, pickled items, aged cheese (parmesan, pecorino), soy sauce, miso, smoked paprika, avocado, tomatoes in large amounts, black pepper, mustard, dijon, sriracha, hot sauce, sumac, canola oil, sour cream, fennel seeds.
Swaps: vinegar → fresh citrus juice. Wine → matching broth. Soy sauce/miso → coconut aminos or remove. Avocado → cucumber. Smoked paprika/sumac → remove entirely. Canola oil → olive oil. Black pepper → remove. Chili/sriracha/chipotle → remove.

## Part 2: Key Modification Rules

### LF — Garlic-Infused Oil Rule
FODMAPs (fructans) are water-soluble not fat-soluble. Garlic infused in oil leaves fructans in the discarded solids. Garlic-infused oil is always LF-safe.

### LF — Scallion Green Rule
White and light green parts of scallions = high-FODMAP. Dark green tops = LF-safe.
When a recipe lists "scallions" without specifying green tops only, flag it.

### LF — Cook-and-Discard Method
In slow braises, aromatic vegetables impart flavor but are discarded. FODMAPs at lower concentrations after cooking may be tolerable. Only applies to slow braises where aromatics are removed before serving.

### GF — Thickener Replacement
Arrowroot powder for gravies/thin sauces. 1:1 GF flour blend for structural applications (coating, binding, dumplings).

### Keto — Sweetener
Default keto sweetener: allulose. Caramelizes, zero glycemic impact. For BBQ/caramelization: trehalose.

### Vegan — Broth Rule
Every vegan/vegetarian modification involving a meat-based recipe MUST explicitly state "replace chicken/beef broth with vegetable broth." Never assume it is obvious.

## Master Ingredient Swap Reference

| Problem Ingredient | Protocol(s) | Standard Swap |
|---|---|---|
| Garlic / onion | LF | Garlic-infused oil |
| Onion (visual) | LF | Green parts of scallions only |
| Shallots | LF | Green tops of scallions + garlic-infused oil |
| Leeks (white parts) | LF | Green tops of leeks only |
| Whole scallions | LF | Dark green tops only — white/light green parts are high-FODMAP |
| Fennel | LF | Remove entirely |
| Corn | LF | Remove entirely |
| Beans / legumes | LF | Remove (only when supporting, not starring) |
| Peanut butter | LF | Remove entirely |
| Mushrooms | LF | Remove entirely |
| Commercial vegetable broth | LF | Certified low-FODMAP broth (Fody brand) or homemade without onion/garlic |
| Commercial sauce mixes | LF | LF-safe brand or bouillon |
| Heavy cream | DF / V | Full-fat canned coconut milk |
| Greek yogurt (tang) | DF / V / LF | Plain unsweetened coconut yogurt |
| Greek yogurt (LF only) | LF | Lactose-free greek yogurt |
| Sour cream | DF / LF | DF alternative or lactose-free |
| Parmesan (umami) | DF / V | Nutritional yeast + miso or porcini powder |
| Feta (garnish) | DF | Remove entirely |
| Butter (cooking) | DF / V | Olive oil |
| Butter (finishing) | DF / V | DF butter |
| AP flour (thickener) | GF | Arrowroot powder |
| AP flour (structural) | GF | 1:1 GF flour blend |
| Breadcrumbs / panko | GF | GF panko |
| Pasta (Italian) | GF | Brown rice pasta |
| Orzo | GF | Cassava flour orzo |
| Couscous | GF | GF couscous or cauliflower rice |
| Flour tortillas | GF | Corn tortillas or GF wraps |
| Soy sauce | GF / LF | Tamari |
| Oyster sauce | GF | GF oyster sauce |
| Worcestershire sauce | GF / V | GF or vegan variety |
| Hoisin sauce | GF | GF hoisin sauce |
| White rice | K | Cauliflower rice |
| Mashed potatoes | K | Cauliflower mash |
| Tortillas | K | Keto wraps |
| Burger buns | K | Butter lettuce or iceberg wraps |
| Ramen noodles | K | Shirataki noodles (Asian dishes only) |
| Pasta (light sauce) | K | Spiralized zucchini |
| Gnocchi | K | Cauliflower gnocchi |
| Honey / sugar | K | Allulose |
| Brown sugar (BBQ) | K | Trehalose |
| Black pepper | AIP | Remove entirely |
| Cumin | AIP | Remove or replace with cinnamon |
| Mustard / Dijon | AIP | Remove entirely |
| Sesame seeds / oil | AIP | Remove entirely |
| Chili / paprika | AIP | Remove entirely |
| Bell peppers | AIP | Remove entirely |
| Curry powder | AIP | Replace with turmeric |
| Soy sauce / miso | AIP | Coconut aminos |
| Vinegar | AIP / LH | Fresh citrus juice |
| Wine / alcohol | AIP / LF / LH | Matching broth |
| Avocado | LH | Cucumber |
| Smoked paprika | LH | Remove entirely |
| Sumac | LH | Remove entirely |
| Canola oil | LH | Olive oil |
| Chicken / beef broth | V / Vg | Vegetable broth (state explicitly every time) |
| Anchovy paste | Vg | 1 tbsp tamari + 1 tbsp capers with juice |
| Honey | V | Agave |
`;

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

export interface ScoredIngredient {
  name:      string;
  qty:       string;
  type:      'normal' | 'crossed' | 'swap';
  swapNote?: string;
  swapFor?:  string;
}

// ─────────────────────────────────────────────
//  Main scoring function
// ─────────────────────────────────────────────

export async function scoreIngredientsWithClaude(
  ingredients: { name: string; qty: string }[],
  protocols: string[],
): Promise<ScoredIngredient[]> {
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_KEY_MISSING');
  if (ingredients.length === 0) return [];

  const protocolLabels: Record<string, string> = {
    GF: 'Gluten-Free', LF: 'Low-FODMAP', DF: 'Dairy-Free',
    K: 'Keto', AIP: 'AIP', LH: 'Low-Histamine', V: 'Vegan', Vg: 'Vegetarian',
  };

  const activeLabels = protocols.map(p => protocolLabels[p] ?? p).join(', ');
  const ingredientList = ingredients.map((i, idx) => `${idx + 1}. ${i.qty} ${i.name}`).join('\n');

  const userPrompt = `
Active protocols: ${activeLabels}

Ingredient list:
${ingredientList}

For each ingredient, determine if it is compliant or not with the active protocols.

Return a JSON array with one object per ingredient in the SAME ORDER as the input list:
[
  {
    "index": 1,
    "name": "all-purpose flour",
    "qty": "2 and 1/4 cups",
    "compliant": false,
    "protocol": "GF",
    "reason": "Contains gluten",
    "swap": "1:1 GF flour blend"
  },
  {
    "index": 2,
    "name": "baking soda",
    "qty": "1 teaspoon",
    "compliant": true,
    "protocol": null,
    "reason": null,
    "swap": null
  }
]

Rules:
- Return ONLY valid JSON — no explanation, no markdown, no code blocks
- "compliant": true means the ingredient is fine for ALL active protocols
- "compliant": false means it violates at least one protocol
- "swap": null means remove entirely (no replacement)
- Be precise — do not flag compliant ingredients
`.trim();

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':         'application/json',
      'x-api-key':            ANTHROPIC_KEY,
      'anthropic-version':    '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: 2048,
      system:     CKC_RULES,
      messages:   [{ role: 'user', content: userPrompt }],
    }),
  });

  const json = await response.json();

  if (!response.ok || json?.error) {
    throw new Error(json?.error?.message ?? `Claude API error ${response.status}`);
  }

  let text = json?.content?.[0]?.text ?? '';
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  const scored = JSON.parse(text) as Array<{
    index: number;
    name: string;
    qty: string;
    compliant: boolean;
    protocol: string | null;
    reason: string | null;
    swap: string | null;
  }>;

  // ── Code-level overrides for known LF edge cases the model consistently misses ──
  // These run after Claude's response and force-flag ingredients by name,
  // because prompting alone is not reliable for these nuanced cases.
  if (protocols.includes('LF')) {
    for (const item of scored) {
      if (item.compliant) {
        const n = item.name.toLowerCase();

        // Scallions: whole scallion includes high-FODMAP white/light-green parts.
        // Only safe if the recipe explicitly says "green tops only."
        const isScallion = n.includes('scallion') || n.includes('green onion');
        const alreadySafe = n.includes('green top') || n.includes('dark green') || n.includes('top only');
        if (isScallion && !alreadySafe) {
          item.compliant = false;
          item.protocol  = 'LF';
          item.reason    = 'Whole scallions include high-FODMAP white and light-green parts';
          item.swap      = 'Use dark green tops only — slice off and discard the white and light-green bulb';
        }

        // Vegetable broth: virtually all commercial versions contain onion and garlic.
        const isBroth = n.includes('vegetable broth') || n.includes('veggie broth') || n.includes('vegetable stock');
        const isCertified = n.includes('low-fodmap') || n.includes('fodmap') || n.includes('certified') || n.includes('homemade');
        if (isBroth && !isCertified) {
          item.compliant = false;
          item.protocol  = 'LF';
          item.reason    = 'Most commercial vegetable broths contain onion and garlic (high-FODMAP)';
          item.swap      = 'Use certified low-FODMAP broth (Fody brand) or homemade without onion/garlic';
        }
      }
    }
  }

  const result: ScoredIngredient[] = [];
  const addedSwaps = new Set<string>();

  for (const item of scored) {
    if (!item.compliant) {
      const swapNote = item.swap
        ? `${item.protocol ? protocolLabels[item.protocol] ?? item.protocol : ''}: ${item.reason} → ${item.swap}`
        : `${item.protocol ? protocolLabels[item.protocol] ?? item.protocol : ''}: ${item.reason} — remove entirely`;

      result.push({ name: item.name, qty: item.qty, type: 'crossed', swapNote });

      if (item.swap && !addedSwaps.has(item.swap)) {
        addedSwaps.add(item.swap);
        result.push({ name: item.swap, qty: item.qty, type: 'swap', swapFor: item.name });
      }
    } else {
      result.push({ name: item.name, qty: item.qty, type: 'normal' });
    }
  }

  return result;
}
