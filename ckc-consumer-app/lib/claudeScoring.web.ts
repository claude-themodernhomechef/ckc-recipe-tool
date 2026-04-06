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

Your job is to score a list of ingredients against one or more dietary protocols using the exact rules below.

## PROTOCOLS AND KEY RULES

### GF (Gluten-Free)
Disqualifiers: wheat, rye, barley, pasta, orzo, ramen, lo mein, chow mein, couscous, gnocchi, tortellini, panko, flour tortillas, bread, all-purpose flour, wheat flour.
Hidden gluten: soy sauce (contains wheat), oyster sauce, worcestershire sauce, hoisin sauce.
Swaps: all-purpose/wheat flour → 1:1 GF flour blend (structural) or arrowroot powder (gravies/sauces). Pasta → brown rice pasta. Soy sauce → tamari. Breadcrumbs/panko → GF panko.

### LF (Low-FODMAP)
Disqualifiers: garlic, onion (white/yellow), shallots, leeks (white parts), beans, legumes, chickpeas, lentils, peanut butter, mushrooms, fennel, wheat in large amounts, high-lactose dairy (milk, heavy cream, sour cream, greek yogurt), honey in excess, apples, pears, mango, watermelon, cauliflower in large servings.
IMPORTANT: cornstarch is LF-compliant. Corn tortillas are LF-compliant. Green tops of scallions/leeks are LF-compliant. Garlic-infused oil is LF-compliant (fructans are water-soluble not fat-soluble).
Swaps: garlic → garlic-infused oil. Onion/shallots → green tops of scallions. Soy sauce → tamari. Heavy cream → full-fat canned coconut milk. Greek yogurt → lactose-free greek yogurt or coconut yogurt. Honey → maple syrup (limit to 1 tbsp). All-purpose flour → 1:1 GF flour blend.

### DF (Dairy-Free)
Disqualifiers: butter, milk, cream, heavy cream, half-and-half, cheese (parmesan, mozzarella, feta, cheddar, ricotta), yogurt, sour cream, ghee, buttermilk, condensed milk.
Swaps: butter (cooking) → olive oil. Butter (finishing/baking) → DF butter. Heavy cream/half-and-half → full-fat canned coconut milk. Milk → unsweetened oat or soy milk. Greek yogurt/sour cream → plain unsweetened coconut yogurt. Parmesan (umami) → nutritional yeast. Mozzarella → Kite Hill brand DF alternative. Feta (garnish) → remove entirely.

### K (Keto)
Disqualifiers: white rice, pasta, couscous, orzo, potatoes, sweet potatoes, gnocchi, flour tortillas, bread, buns, sugar, honey, brown sugar, all-purpose flour, cornstarch, high-sugar fruit.
Swaps: white rice → cauliflower rice. Potatoes → cauliflower mash. Pasta (light sauce) → spiralized zucchini. Ramen/Asian noodles → shirataki noodles. Tortillas → keto wraps. Burger buns → butter lettuce wrap. Honey/sugar/brown sugar → allulose. All-purpose flour → almond flour.

### AIP (Autoimmune Protocol)
Disqualifiers (seed-based): black pepper, mustard, dijon, cumin, sesame seeds, sesame oil, sunflower seeds, pepitas, fennel seeds, paprika, smoked paprika.
Disqualifiers (nightshades): chili flakes, red pepper flakes, jalapeno, serrano, poblano, bell peppers, tomatoes, curry powder, hot sauce, gochujang.
Disqualifiers (other): eggs, dairy, grains, legumes, nuts, alcohol, vinegar, olives, almond milk.
Swaps: soy sauce/miso/fish sauce → coconut aminos. Vinegar → fresh citrus juice. Wine/alcohol → matching broth. Brown sugar/honey → agave. Flour/cornstarch → arrowroot powder. Curry powder → turmeric. Almond milk → rice milk.

### LH (Low-Histamine)
Disqualifiers: vinegar (all types), wine, beer, pickled items, aged cheese (parmesan, pecorino), soy sauce, miso, smoked paprika, avocado, tomatoes (in large amounts), black pepper, mustard, dijon, sriracha, hot sauce, sumac, canola oil, sour cream.
Swaps: vinegar → fresh citrus juice. Wine → matching broth. Soy sauce/miso → coconut aminos or remove. Avocado → cucumber. Smoked paprika/sumac → remove entirely. Canola oil → olive oil.

### V (Vegan)
Disqualifiers: chicken, beef, pork, lamb, turkey, steak, shrimp, fish, salmon, tuna, eggs, butter, milk, cream, cheese, honey, chicken broth, beef broth, anchovy, fish sauce, worcestershire sauce.
Swaps: meat → extra firm tofu (match cut to protein shape). Shrimp → extra firm tofu cubes. Eggs (binding) → flax egg (2 tbsp ground flax + 1 tbsp water). Butter → olive oil. Dairy → coconut milk/DF alternatives. Honey → agave. Meat broth → vegetable broth (always state explicitly). Anchovy paste → 1 tbsp tamari + 1 tbsp capers with juice.

### Vg (Vegetarian)
Disqualifiers: chicken, beef, pork, lamb, turkey, steak, shrimp, fish, salmon, tuna, chicken broth, beef broth, anchovy, fish sauce.
Swaps: meat → extra firm tofu. Fish/shrimp → extra firm tofu cubes. Meat broth → vegetable broth (always state explicitly).

## IMPORTANT NOTES
- Be precise — do not flag ingredients that are compliant. For example: cornstarch is LF-compliant, garlic-infused oil is LF-compliant, corn tortillas are LF-compliant, rice is GF-compliant, eggs are GF-compliant.
- Only flag an ingredient if it genuinely violates the protocol.
- If an ingredient violates multiple protocols, report the most actionable one with the best swap.
- Keep swap suggestions concise and specific.
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
      model:      'claude-haiku-4-5-20251001',
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
