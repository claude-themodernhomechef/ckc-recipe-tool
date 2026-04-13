// ─────────────────────────────────────────────
//  Recipe type + helper functions + sample data
//  Phase 2 will replace fetchRecipes with real Firestore data.
//  Sample recipes here are used as a fallback only.
// ─────────────────────────────────────────────

export interface DietTag {
  native: boolean;
  mod: boolean;
  notes: string;
  uncertain?: boolean;
  reason?: string;
}

export interface Recipe {
  id: string;
  name: string;
  url: string;
  cuisine: string;
  meal_type: string;       // 'entree' | 'side' | 'salad' | 'soup' | 'breakfast' | 'dessert'
  protein_type: string;    // 'Chicken' | 'Beef' | 'Fish' | 'Pork' | 'Vegetarian' | etc.
  menu_description: string;
  prep_time: number | null; // minutes, null if unknown
  image: string | null;
  photo_url: string | null;   // alias for image, used by list-mode card
  placeholder_color: string;
  blogger: string;
  rating: string;
  dietTags: Record<string, DietTag>;
  ingredients: string[];
  builtInStarch?: boolean;
  builtInVeg?: boolean;
  status?: 'yes' | 'no' | 'maybe' | 'pending';
  processingStatus?: 'complete' | 'pending_review' | 'failed' | 'error';
}

// Returns 'native' | 'modified' | 'none' for a given protocol on a recipe
export function getComplianceStatus(
  recipe: Recipe,
  protocol: string,
): 'native' | 'modified' | 'none' {
  const tag = recipe.dietTags[protocol];
  if (!tag) return 'none';
  if (tag.native) return 'native';
  if (tag.mod)    return 'modified';
  return 'none';
}

// Filters recipe list to those that are native or modifiable for a protocol
export function filterByProtocol(recipes: Recipe[], protocol: string): Recipe[] {
  if (protocol === 'all') return recipes;
  return recipes.filter(r => {
    const tag = r.dietTags[protocol];
    return tag && (tag.native || tag.mod);
  });
}

// ─── Sample data (fallback until Firestore is wired up in Phase 2) ───────────

export const SAMPLE_RECIPES: Recipe[] = [
  {
    id: 'carne-asada-tacos',
    name: 'Carne Asada Tacos',
    url: 'https://www.acozykitchen.com/carne-asada-tacos',
    cuisine: 'Latin/South American',
    meal_type: 'entree',
    protein_type: 'Beef',
    menu_description: 'Skirt steak marinated in lime, spices & garlic with corn tortillas.',
    prep_time: 30,
    image: null,
    photo_url: null,
    placeholder_color: '#3a2a1a',
    blogger: 'A Cozy Kitchen',
    rating: '4.9',
    dietTags: {
      GF:  { native: false, mod: true,  notes: 'Use corn tortillas or gluten-free wraps.' },
      DF:  { native: true,  mod: false, notes: '' },
      V:   { native: false, mod: false, notes: '' },
      Vg:  { native: false, mod: false, notes: '' },
      K:   { native: false, mod: true,  notes: 'Skip tortillas, serve as a bowl.' },
      AIP: { native: false, mod: false, notes: '' },
      LF:  { native: false, mod: true,  notes: 'Use garlic-infused oil, skip onion.' },
      LH:  { native: false, mod: false, notes: '' },
    },
    ingredients: ['skirt steak', 'lime juice', 'garlic', 'cumin', 'corn tortillas', 'cilantro'],
  },
  {
    id: 'lemon-herb-roasted-chicken',
    name: 'Lemon Herb Roasted Chicken',
    url: 'https://www.feastingathome.com/lemon-herb-roasted-chicken',
    cuisine: 'American',
    meal_type: 'entree',
    protein_type: 'Chicken',
    menu_description: 'Juicy whole roasted chicken with garlic, lemon, and fresh thyme.',
    prep_time: 75,
    image: null,
    photo_url: null,
    placeholder_color: '#2a1f10',
    blogger: 'Feasting at Home',
    rating: '4.8',
    dietTags: {
      GF:  { native: true,  mod: false, notes: '' },
      DF:  { native: true,  mod: false, notes: '' },
      V:   { native: false, mod: false, notes: '' },
      Vg:  { native: false, mod: false, notes: '' },
      K:   { native: true,  mod: false, notes: '' },
      AIP: { native: true,  mod: false, notes: '' },
      LF:  { native: false, mod: true,  notes: 'Use garlic-infused oil instead of garlic cloves.' },
      LH:  { native: true,  mod: false, notes: '' },
    },
    ingredients: ['whole chicken', 'lemon', 'garlic', 'thyme', 'olive oil', 'salt'],
  },
  {
    id: 'roasted-salmon-bowls',
    name: 'Roasted Salmon Bowls with Tahini',
    url: 'https://cookieandkate.com/roasted-salmon-bowls',
    cuisine: 'American',
    meal_type: 'entree',
    protein_type: 'Fish',
    menu_description: 'Flaky salmon over greens with a creamy tahini dressing.',
    prep_time: 25,
    image: null,
    photo_url: null,
    placeholder_color: '#1a2a2a',
    blogger: 'Cookie and Kate',
    rating: '4.7',
    dietTags: {
      GF:  { native: true,  mod: false, notes: '' },
      DF:  { native: true,  mod: false, notes: '' },
      V:   { native: false, mod: false, notes: '' },
      Vg:  { native: false, mod: false, notes: '' },
      K:   { native: true,  mod: false, notes: '' },
      AIP: { native: false, mod: false, notes: '' },
      LF:  { native: true,  mod: false, notes: '' },
      LH:  { native: false, mod: false, notes: '' },
    },
    ingredients: ['salmon', 'baby spinach', 'cherry tomatoes', 'tahini', 'lemon', 'olive oil'],
  },
  {
    id: 'sheet-pan-chicken-vegetables',
    name: 'Sheet Pan Chicken & Vegetables',
    url: 'https://www.ambitiouskitchen.com/sheet-pan-chicken',
    cuisine: 'American',
    meal_type: 'entree',
    protein_type: 'Chicken',
    menu_description: 'One-pan weeknight dinner with crispy chicken thighs and roasted veggies.',
    prep_time: 40,
    image: null,
    photo_url: null,
    placeholder_color: '#1a2010',
    blogger: 'Ambitious Kitchen',
    rating: '4.9',
    dietTags: {
      GF:  { native: true,  mod: false, notes: '' },
      DF:  { native: true,  mod: false, notes: '' },
      V:   { native: false, mod: false, notes: '' },
      Vg:  { native: false, mod: false, notes: '' },
      K:   { native: true,  mod: false, notes: '' },
      AIP: { native: true,  mod: false, notes: '' },
      LF:  { native: false, mod: true,  notes: 'Skip onion, use garlic-infused oil.' },
      LH:  { native: true,  mod: false, notes: '' },
    },
    ingredients: ['chicken thighs', 'bell peppers', 'zucchini', 'red onion', 'olive oil'],
  },
  {
    id: 'greek-lamb-meatballs',
    name: 'Greek Lamb Meatballs',
    url: 'https://www.themediterraneandish.com/greek-lamb-meatballs',
    cuisine: 'Mediterranean',
    meal_type: 'entree',
    protein_type: 'Lamb',
    menu_description: 'Tender lamb meatballs with fresh mint, tzatziki, and cucumber.',
    prep_time: 35,
    image: null,
    photo_url: null,
    placeholder_color: '#201a10',
    blogger: 'The Mediterranean Dish',
    rating: '4.8',
    dietTags: {
      GF:  { native: false, mod: true,  notes: 'Use gluten-free breadcrumbs.' },
      DF:  { native: false, mod: true,  notes: 'Use dairy-free yogurt for tzatziki.' },
      V:   { native: false, mod: false, notes: '' },
      Vg:  { native: false, mod: false, notes: '' },
      K:   { native: false, mod: true,  notes: 'Skip breadcrumbs or use almond flour.' },
      AIP: { native: false, mod: false, notes: '' },
      LF:  { native: false, mod: true,  notes: 'Use garlic-infused oil, skip onion.' },
      LH:  { native: false, mod: false, notes: '' },
    },
    ingredients: ['ground lamb', 'greek yogurt', 'fresh mint', 'cucumber', 'garlic', 'breadcrumbs'],
  },
];
