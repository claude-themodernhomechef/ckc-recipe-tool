/**
 * Sample recipe data — mirrors the Firestore/recipes.json schema.
 * Swap this out for a Firebase fetch once auth is wired up.
 *
 * All recipes are based at 4 servings.
 * Protocol keys: AIP | LF | K | GF | DF | V | Vg | LH
 */

export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface Recipe {
  id: string;
  name: string;
  photo_url: string;        // color placeholder for now (e.g. "#8B4513")
  blog_url: string;
  cuisine: string;
  protein_type: string;     // "Chicken" | "Beef" | "Salmon" | "Vegetarian" | etc.
  prep_time: number;        // minutes
  meal_type: 'entree' | 'side' | 'sauce';
  menu_description: string;
  base_servings: 4;
  ingredients: Ingredient[];
  native_compliance: Partial<Record<'AIP'|'LF'|'K'|'GF'|'DF'|'V'|'Vg'|'LH', boolean>>;
  modification_compliance: Partial<Record<'AIP'|'LF'|'K'|'GF'|'DF'|'V'|'Vg'|'LH', boolean>>;
  swap_notes: Partial<Record<'AIP'|'LF'|'K'|'GF'|'DF'|'V'|'Vg'|'LH', string[]>>;
  chef_notes: string[];
  diet_compliant_notes: string[];  // swap recommendations, visible to all users
  side_pairings: string[];         // recipe IDs
  // Visual placeholder color when no photo
  placeholder_color: string;
}

export const SAMPLE_RECIPES: Recipe[] = [
  {
    id: 'r001',
    name: 'Crispy Chicken Thighs with Roasted Garlic Jus',
    photo_url: '',
    placeholder_color: '#5c3a1e',
    blog_url: 'https://example.com/crispy-chicken-thighs',
    cuisine: 'American',
    protein_type: 'Chicken',
    prep_time: 35,
    meal_type: 'entree',
    menu_description: 'Seared skin-on thighs finished in the oven with a silky pan jus.',
    base_servings: 4,
    ingredients: [
      { name: 'bone-in, skin-on chicken thighs', quantity: 8, unit: 'pieces' },
      { name: 'garlic cloves', quantity: 6, unit: 'cloves' },
      { name: 'chicken stock', quantity: 1, unit: 'cup' },
      { name: 'fresh thyme', quantity: 4, unit: 'sprigs' },
      { name: 'olive oil', quantity: 2, unit: 'tbsp' },
      { name: 'kosher salt', quantity: 1, unit: 'tsp' },
      { name: 'black pepper', quantity: 0.5, unit: 'tsp' },
    ],
    native_compliance: { GF: true, DF: true, K: true, AIP: false, LF: false },
    modification_compliance: { LF: true, AIP: true },
    swap_notes: {
      LF: ['Garlic is high-FODMAP. Swap: use garlic-infused olive oil instead of fresh garlic cloves. Remove garlic from the recipe.'],
      AIP: ['Black pepper is not AIP-compliant. Omit it. Use extra thyme and sea salt for seasoning.'],
    },
    chef_notes: [
      'Sear skin-side down for 7 full minutes without moving. That stillness is how you build the crust.',
      'Pat the thighs completely dry before searing — moisture is the enemy of crispy skin.',
      'Deglaze with cold stock to lift the fond; that\'s where all the flavor lives.',
    ],
    diet_compliant_notes: [
      'Low-FODMAP: Swap garlic cloves for garlic-infused olive oil. The flavor holds.',
      'AIP: Skip black pepper. Lean heavier on fresh thyme and sea salt.',
    ],
    side_pairings: ['r006', 'r007'],
  },

  {
    id: 'r002',
    name: 'Creamy Tuscan Salmon',
    photo_url: '',
    placeholder_color: '#c0603a',
    blog_url: 'https://example.com/tuscan-salmon',
    cuisine: 'Italian',
    protein_type: 'Salmon',
    prep_time: 25,
    meal_type: 'entree',
    menu_description: 'Pan-seared salmon fillets in a sun-dried tomato and spinach cream sauce.',
    base_servings: 4,
    ingredients: [
      { name: 'salmon fillets', quantity: 4, unit: 'fillets' },
      { name: 'heavy cream', quantity: 1, unit: 'cup' },
      { name: 'sun-dried tomatoes', quantity: 0.5, unit: 'cup' },
      { name: 'baby spinach', quantity: 2, unit: 'cups' },
      { name: 'garlic cloves', quantity: 3, unit: 'cloves' },
      { name: 'parmesan cheese', quantity: 0.25, unit: 'cup' },
      { name: 'olive oil', quantity: 2, unit: 'tbsp' },
      { name: 'Italian seasoning', quantity: 1, unit: 'tsp' },
    ],
    native_compliance: { GF: true, K: true, LH: false },
    modification_compliance: { LF: true, DF: true },
    swap_notes: {
      LF: ['Garlic is high-FODMAP. Use garlic-infused olive oil. Sun-dried tomatoes in large amounts can be high-FODMAP — limit to 2 tbsp.'],
      DF: ['Swap heavy cream for full-fat coconut cream. Skip the parmesan or use a dairy-free hard cheese alternative.'],
    },
    chef_notes: [
      'Score the salmon skin lightly with a knife before searing — it prevents curling and ensures even contact with the pan.',
      'Build the sauce in the same pan after the salmon; every bit of flavor stuck to the bottom belongs in that cream.',
      'Pull the salmon off heat 1 minute early — it finishes cooking in the hot sauce.',
    ],
    diet_compliant_notes: [
      'Low-FODMAP: Replace garlic with garlic-infused olive oil. Cap sun-dried tomatoes at 2 tbsp per serving.',
      'Dairy-Free: Use full-fat coconut cream 1:1. Omit parmesan or use Violife dairy-free hard block.',
    ],
    side_pairings: ['r007', 'r008'],
  },

  {
    id: 'r003',
    name: 'Korean-Inspired Ground Beef Bowls',
    photo_url: '',
    placeholder_color: '#8b3a3a',
    blog_url: 'https://example.com/korean-beef-bowls',
    cuisine: 'Asian',
    protein_type: 'Beef',
    prep_time: 20,
    meal_type: 'entree',
    menu_description: 'Savory-sweet ground beef over jasmine rice with sesame and scallion.',
    base_servings: 4,
    ingredients: [
      { name: 'ground beef (85/15)', quantity: 1.5, unit: 'lbs' },
      { name: 'soy sauce', quantity: 3, unit: 'tbsp' },
      { name: 'sesame oil', quantity: 1, unit: 'tbsp' },
      { name: 'brown sugar', quantity: 2, unit: 'tbsp' },
      { name: 'fresh ginger', quantity: 1, unit: 'tbsp' },
      { name: 'garlic cloves', quantity: 4, unit: 'cloves' },
      { name: 'scallions', quantity: 4, unit: 'stalks' },
      { name: 'jasmine rice', quantity: 2, unit: 'cups' },
      { name: 'sesame seeds', quantity: 1, unit: 'tbsp' },
    ],
    native_compliance: { DF: true },
    modification_compliance: { GF: true, LF: true, K: true },
    swap_notes: {
      GF: ['Regular soy sauce contains wheat. Swap for tamari (San-J brand is certified GF) 1:1.'],
      LF: ['Garlic and scallion bulbs are high-FODMAP. Use garlic-infused oil and scallion greens only (the green tops are low-FODMAP).'],
      K: ['Brown sugar adds carbs. Replace with 1 tsp of monk fruit sweetener or erythritol. Serve over cauliflower rice instead of jasmine rice.'],
    },
    chef_notes: [
      'Don\'t overcrowd the pan — let the beef sear in a single layer so it browns instead of steams.',
      'Add the sauce when the pan is fully hot; it should sizzle and caramelize immediately.',
    ],
    diet_compliant_notes: [
      'Gluten-Free: Swap soy sauce for tamari (certified GF). Everything else is already compliant.',
      'Low-FODMAP: Use garlic-infused oil instead of garlic cloves. Use only scallion greens, not the white bulbs.',
      'Keto: Replace brown sugar with monk fruit sweetener. Serve over cauliflower rice.',
    ],
    side_pairings: ['r008'],
  },

  {
    id: 'r004',
    name: 'Sheet Pan Chicken Shawarma',
    photo_url: '',
    placeholder_color: '#a0522d',
    blog_url: 'https://example.com/chicken-shawarma',
    cuisine: 'Middle Eastern',
    protein_type: 'Chicken',
    prep_time: 45,
    meal_type: 'entree',
    menu_description: 'Spiced chicken thighs roasted on a sheet pan with caramelized onion and lemon.',
    base_servings: 4,
    ingredients: [
      { name: 'boneless chicken thighs', quantity: 2, unit: 'lbs' },
      { name: 'yellow onion', quantity: 2, unit: 'medium' },
      { name: 'olive oil', quantity: 3, unit: 'tbsp' },
      { name: 'cumin', quantity: 2, unit: 'tsp' },
      { name: 'paprika', quantity: 2, unit: 'tsp' },
      { name: 'turmeric', quantity: 1, unit: 'tsp' },
      { name: 'cinnamon', quantity: 0.5, unit: 'tsp' },
      { name: 'lemon', quantity: 1, unit: 'whole' },
      { name: 'garlic cloves', quantity: 4, unit: 'cloves' },
      { name: 'kosher salt', quantity: 1.5, unit: 'tsp' },
    ],
    native_compliance: { GF: true, DF: true, K: true, AIP: false },
    modification_compliance: { LF: true, AIP: true },
    swap_notes: {
      LF: ['Onion is high-FODMAP. Replace with the green tops of leeks or use asafoetida powder (hing) in oil for flavor. Garlic → garlic-infused oil.'],
      AIP: ['Cumin, paprika, turmeric, and cinnamon are all AIP-compliant. This recipe is nearly AIP as written. Remove any nightshade-derived paprika variety.'],
    },
    chef_notes: [
      'Marinate overnight if you can — even 2 hours makes a noticeable difference in depth.',
      'Crank the oven to 425°F. Shawarma wants high heat and caramelization.',
      'Let the chicken rest 5 minutes before slicing — the juices redistribute and the slices stay moist.',
    ],
    diet_compliant_notes: [
      'Low-FODMAP: Swap yellow onion for leek greens only. Replace garlic with garlic-infused olive oil.',
    ],
    side_pairings: ['r006', 'r009'],
  },

  {
    id: 'r005',
    name: 'Lemon Herb Baked Cod',
    photo_url: '',
    placeholder_color: '#4a7a8a',
    blog_url: 'https://example.com/lemon-herb-cod',
    cuisine: 'Mediterranean',
    protein_type: 'Fish',
    prep_time: 20,
    meal_type: 'entree',
    menu_description: 'Light, flaky cod fillets with fresh herbs, lemon, and a breadcrumb crust.',
    base_servings: 4,
    ingredients: [
      { name: 'cod fillets', quantity: 4, unit: 'fillets' },
      { name: 'panko breadcrumbs', quantity: 0.5, unit: 'cup' },
      { name: 'fresh parsley', quantity: 3, unit: 'tbsp' },
      { name: 'lemon zest', quantity: 1, unit: 'tsp' },
      { name: 'lemon juice', quantity: 2, unit: 'tbsp' },
      { name: 'olive oil', quantity: 3, unit: 'tbsp' },
      { name: 'garlic cloves', quantity: 2, unit: 'cloves' },
      { name: 'kosher salt', quantity: 1, unit: 'tsp' },
    ],
    native_compliance: { DF: true, LH: true },
    modification_compliance: { GF: true, LF: true, AIP: true },
    swap_notes: {
      GF: ['Panko contains wheat. Swap for gluten-free panko breadcrumbs (Ian\'s or 4C brands work well) 1:1.'],
      LF: ['Garlic is high-FODMAP. Use garlic-infused olive oil. Skip the garlic cloves entirely.'],
      AIP: ['Swap panko for crushed pork rinds or finely shredded coconut for a crispy crust. Skip breadcrumbs entirely.'],
    },
    chef_notes: [
      'Pat the cod very dry before adding the crust — moisture prevents browning.',
      'Press the breadcrumb mixture firmly onto the fish so it adheres and crisps evenly.',
    ],
    diet_compliant_notes: [
      'Gluten-Free: Use certified GF panko (Ian\'s is widely available).',
      'Low-FODMAP: Skip garlic cloves, use garlic-infused olive oil instead.',
      'AIP: Replace breadcrumbs with crushed pork rinds or shredded coconut for crunch.',
    ],
    side_pairings: ['r008', 'r009'],
  },

  {
    id: 'r006',
    name: 'Roasted Broccolini with Lemon & Chili',
    photo_url: '',
    placeholder_color: '#2d6a2d',
    blog_url: 'https://example.com/roasted-broccolini',
    cuisine: 'American',
    protein_type: 'Vegetarian',
    prep_time: 20,
    meal_type: 'side',
    menu_description: 'Crispy-edged broccolini with a hit of lemon and red chili flake.',
    base_servings: 4,
    ingredients: [
      { name: 'broccolini', quantity: 2, unit: 'bunches' },
      { name: 'olive oil', quantity: 2, unit: 'tbsp' },
      { name: 'red chili flakes', quantity: 0.25, unit: 'tsp' },
      { name: 'lemon', quantity: 1, unit: 'whole' },
      { name: 'flaky sea salt', quantity: 0.5, unit: 'tsp' },
    ],
    native_compliance: { GF: true, DF: true, V: true, Vg: true, K: true, LF: true, LH: false },
    modification_compliance: { AIP: true, LH: true },
    swap_notes: {
      AIP: ['Chili flakes are nightshades and not AIP-compliant. Omit them and use fresh ginger and turmeric instead.'],
      LH: ['Lemon juice and zest can be high-histamine for sensitive individuals. Use lime juice as a lower-histamine alternative.'],
    },
    chef_notes: [
      'Give the broccolini room on the pan — crowding causes steaming, not roasting.',
    ],
    diet_compliant_notes: [
      'AIP: Skip the chili flakes. Season with fresh ginger and turmeric instead.',
      'Low-Histamine: Swap lemon for lime juice to reduce histamine load.',
    ],
    side_pairings: [],
  },

  {
    id: 'r007',
    name: 'Creamy Mashed Cauliflower',
    photo_url: '',
    placeholder_color: '#c8c0a8',
    blog_url: 'https://example.com/mashed-cauliflower',
    cuisine: 'American',
    protein_type: 'Vegetarian',
    prep_time: 20,
    meal_type: 'side',
    menu_description: 'Silky, buttery cauliflower mash — lighter than potato but just as satisfying.',
    base_servings: 4,
    ingredients: [
      { name: 'cauliflower head', quantity: 1, unit: 'large' },
      { name: 'butter', quantity: 3, unit: 'tbsp' },
      { name: 'heavy cream', quantity: 0.25, unit: 'cup' },
      { name: 'garlic cloves', quantity: 2, unit: 'cloves' },
      { name: 'chives', quantity: 2, unit: 'tbsp' },
      { name: 'kosher salt', quantity: 1, unit: 'tsp' },
      { name: 'white pepper', quantity: 0.25, unit: 'tsp' },
    ],
    native_compliance: { GF: true, K: true, Vg: true },
    modification_compliance: { DF: true, LF: true, AIP: true, V: true },
    swap_notes: {
      DF: ['Swap butter for vegan butter (Miyoko\'s or Earth Balance). Swap heavy cream for full-fat coconut cream.'],
      LF: ['Garlic is high-FODMAP. Use garlic-infused butter or oil instead.'],
      AIP: ['White pepper is nightshade-derived. Omit it. Use extra salt and a pinch of mace.'],
      V: ['Swap butter for vegan butter and use plant-based cream.'],
    },
    chef_notes: [
      'Dry the cauliflower after boiling — squeeze it in a clean towel. Extra moisture makes it watery, not creamy.',
      'A high-powered blender gives you a silkier result than a food processor. Worth the extra cleanup.',
    ],
    diet_compliant_notes: [
      'Dairy-Free: Use Miyoko\'s vegan butter and full-fat coconut cream.',
      'Low-FODMAP: Use garlic-infused butter/oil instead of fresh garlic cloves.',
      'AIP: Remove white pepper. Season with sea salt and a tiny pinch of mace.',
    ],
    side_pairings: [],
  },

  {
    id: 'r008',
    name: 'Cucumber Herb Salad',
    photo_url: '',
    placeholder_color: '#3a7a5a',
    blog_url: 'https://example.com/cucumber-herb-salad',
    cuisine: 'Mediterranean',
    protein_type: 'Vegetarian',
    prep_time: 10,
    meal_type: 'side',
    menu_description: 'Crisp cucumber with dill, mint, and a light lemon-olive oil dressing.',
    base_servings: 4,
    ingredients: [
      { name: 'English cucumber', quantity: 2, unit: 'medium' },
      { name: 'fresh dill', quantity: 3, unit: 'tbsp' },
      { name: 'fresh mint', quantity: 2, unit: 'tbsp' },
      { name: 'olive oil', quantity: 2, unit: 'tbsp' },
      { name: 'lemon juice', quantity: 2, unit: 'tbsp' },
      { name: 'flaky sea salt', quantity: 0.5, unit: 'tsp' },
    ],
    native_compliance: { GF: true, DF: true, V: true, Vg: true, K: true, LF: true, AIP: true },
    modification_compliance: { LH: true },
    swap_notes: {
      LH: ['Lemon juice is high-histamine. Swap for lime juice or a splash of apple cider vinegar (though vinegar is also moderate-histamine; lime is the safer choice).'],
    },
    chef_notes: [
      'Salt the cucumber slices and let them sit 10 minutes, then pat dry — removes excess water so the dressing doesn\'t get diluted.',
    ],
    diet_compliant_notes: [
      'Low-Histamine: Replace lemon juice with lime juice.',
    ],
    side_pairings: [],
  },

  {
    id: 'r009',
    name: 'Turmeric Cauliflower Rice',
    photo_url: '',
    placeholder_color: '#c8a030',
    blog_url: 'https://example.com/turmeric-cauliflower-rice',
    cuisine: 'Asian',
    protein_type: 'Vegetarian',
    prep_time: 15,
    meal_type: 'side',
    menu_description: 'Fluffy cauliflower rice toasted with turmeric, cumin, and fresh cilantro.',
    base_servings: 4,
    ingredients: [
      { name: 'cauliflower head', quantity: 1, unit: 'large' },
      { name: 'turmeric', quantity: 1, unit: 'tsp' },
      { name: 'cumin', quantity: 0.5, unit: 'tsp' },
      { name: 'olive oil', quantity: 2, unit: 'tbsp' },
      { name: 'fresh cilantro', quantity: 3, unit: 'tbsp' },
      { name: 'lime juice', quantity: 1, unit: 'tbsp' },
      { name: 'kosher salt', quantity: 0.75, unit: 'tsp' },
    ],
    native_compliance: { GF: true, DF: true, V: true, Vg: true, K: true, LF: true, AIP: true, LH: true },
    modification_compliance: {},
    swap_notes: {},
    chef_notes: [
      'Work in batches if needed — overcrowding the pan causes steaming. You want each grain to toast individually.',
    ],
    diet_compliant_notes: [],
    side_pairings: [],
  },

  {
    id: 'r010',
    name: 'Slow-Cooked Lamb Ragu with Pappardelle',
    photo_url: '',
    placeholder_color: '#7a3a1a',
    blog_url: 'https://example.com/lamb-ragu',
    cuisine: 'Italian',
    protein_type: 'Lamb',
    prep_time: 180,
    meal_type: 'entree',
    menu_description: 'Braised ground lamb with San Marzano tomatoes, rosemary, and wide pasta.',
    base_servings: 4,
    ingredients: [
      { name: 'ground lamb', quantity: 1.5, unit: 'lbs' },
      { name: 'pappardelle pasta', quantity: 12, unit: 'oz' },
      { name: 'San Marzano tomatoes', quantity: 28, unit: 'oz can' },
      { name: 'yellow onion', quantity: 1, unit: 'medium' },
      { name: 'carrots', quantity: 2, unit: 'medium' },
      { name: 'celery stalks', quantity: 2, unit: 'stalks' },
      { name: 'garlic cloves', quantity: 4, unit: 'cloves' },
      { name: 'fresh rosemary', quantity: 2, unit: 'sprigs' },
      { name: 'red wine', quantity: 0.5, unit: 'cup' },
      { name: 'olive oil', quantity: 2, unit: 'tbsp' },
    ],
    native_compliance: { DF: true },
    modification_compliance: { GF: true, LF: true },
    swap_notes: {
      GF: ['Pappardelle contains gluten. Swap for gluten-free pappardelle (Jovial brand) or serve over polenta.'],
      LF: ['Onion and garlic are high-FODMAP. Replace with leek greens and garlic-infused oil. Limit carrots to 1 medium (larger amounts can be moderate-FODMAP).'],
    },
    chef_notes: [
      'Brown the lamb in small batches over very high heat. The color you build in this step is the flavor of the whole dish.',
      'Let it braise low and slow — minimum 2 hours. The ragu tells you when it\'s done: the fat separates and pools on top.',
      'Reserve a full cup of pasta water. Add it a splash at a time when combining; the starch binds the sauce to the noodles.',
    ],
    diet_compliant_notes: [
      'Gluten-Free: Use Jovial GF pappardelle or serve over soft polenta.',
      'Low-FODMAP: Replace onion with leek greens. Use garlic-infused olive oil instead of garlic cloves.',
    ],
    side_pairings: ['r006'],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the combined compliance status of a recipe for a given protocol.
 *  'native'   = natively compliant (green)
 *  'modified' = compliant with swaps (yellow)
 *  'none'     = not compliant / not applicable
 */
export function getComplianceStatus(
  recipe: Recipe,
  protocol: string,
): 'native' | 'modified' | 'none' {
  const key = protocol as keyof typeof recipe.native_compliance;
  if (recipe.native_compliance[key]) return 'native';
  if (recipe.modification_compliance[key]) return 'modified';
  return 'none';
}

/** Filters the recipe list to only those visible for a given protocol filter.
 *  'all' = no filter, return everything.
 */
export function filterByProtocol(recipes: Recipe[], protocol: string): Recipe[] {
  if (protocol === 'all') return recipes;
  return recipes.filter(r => getComplianceStatus(r, protocol) !== 'none');
}

/** Scale an ingredient quantity from 4 servings to the user's household size. */
export function scaleQty(qty: number, household: number): number {
  const multiplier = household / 4;
  return Math.round(qty * multiplier * 100) / 100;
}
