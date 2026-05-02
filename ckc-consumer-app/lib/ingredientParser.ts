// ─────────────────────────────────────────────
//  Ingredient / protein string utilities
//  Mirrors the logic in admin/shopping.html — keep both in sync.
// ─────────────────────────────────────────────

// ── Shopping categories (6 aisles) ────────────────────────────────────────────

export const SHOPPING_CATEGORIES = [
  { key: 'protein',            label: 'Protein' },
  { key: 'produce',            label: 'Produce' },
  { key: 'dairy',              label: 'Dairy & Eggs' },
  { key: 'pantry-staples',     label: 'Pantry Staples' },
  { key: 'pantry-consumables', label: 'Pantry Consumables' },
  { key: 'frozen',             label: 'Frozen' },
] as const;

// ── Ingredient → category database ────────────────────────────────────────────

// Hardcoded baseline — covers the most common ingredients so the app works immediately
// without waiting for Firestore. Firestore loading (below) adds/overrides on top.
const BASELINE_DB: Record<string, string> = {
  // ── Protein ──────────────────────────────────────────────────────────────────
  'chicken breast':'protein','chicken breasts':'protein','chicken thigh':'protein',
  'chicken thighs':'protein','chicken drumstick':'protein','chicken drumsticks':'protein',
  'chicken wings':'protein','whole chicken':'protein','rotisserie chicken':'protein',
  'ground chicken':'protein','ground turkey':'protein','turkey breast':'protein',
  'ground beef':'protein','beef':'protein','flank steak':'protein','skirt steak':'protein',
  'ribeye':'protein','sirloin':'protein','chuck roast':'protein','brisket':'protein',
  'short ribs':'protein','lamb chops':'protein','rack of lamb':'protein',
  'ground lamb':'protein','lamb shoulder':'protein',
  'pork chops':'protein','pork loin chops':'protein','bone-in pork chops':'protein',
  'bone-in pork loin chops':'protein','pork loin':'protein','center cut pork chops':'protein',
  'pork tenderloin':'protein','pork shoulder':'protein','pork belly':'protein',
  'bacon':'protein','pancetta':'protein','prosciutto':'protein','ham':'protein',
  'sausage':'protein','italian sausage':'protein','chorizo':'protein',
  'salmon':'protein','salmon fillet':'protein','salmon fillets':'protein',
  'tuna':'protein','tuna steak':'protein','cod':'protein','halibut':'protein',
  'tilapia':'protein','mahi mahi':'protein','sea bass':'protein','trout':'protein',
  'shrimp':'protein','prawns':'protein','scallops':'protein','crab':'protein',
  'lobster':'protein','clams':'protein','mussels':'protein','squid':'protein',
  'tofu':'protein','firm tofu':'protein','silken tofu':'protein','tempeh':'protein',
  'edamame':'protein','lentils':'protein','black beans':'protein',
  'chickpeas':'protein','white beans':'protein','kidney beans':'protein',
  'pinto beans':'protein','navy beans':'protein','cannellini beans':'protein',
  'eggs':'dairy','egg':'dairy','egg yolk':'dairy','egg yolks':'dairy',
  'egg white':'dairy','egg whites':'dairy',

  // ── Produce ──────────────────────────────────────────────────────────────────
  'garlic':'produce','garlic cloves':'produce','garlic clove':'produce',
  'onion':'produce','yellow onion':'produce','white onion':'produce',
  'red onion':'produce','sweet onion':'produce','shallot':'produce','shallots':'produce',
  'scallion':'produce','scallions':'produce','leek':'produce','leeks':'produce',
  'ginger':'produce','fresh ginger':'produce',
  'tomato':'produce','tomatoes':'produce','cherry tomatoes':'produce',
  'grape tomatoes':'produce','roma tomatoes':'produce','heirloom tomatoes':'produce',
  'red bell pepper':'produce','green bell pepper':'produce','yellow bell pepper':'produce',
  'orange bell pepper':'produce','bell pepper':'produce','bell peppers':'produce',
  'jalapeño':'produce','jalapeno':'produce','jalapenos':'produce','jalapeños':'produce',
  'serrano':'produce','poblano':'produce','anaheim pepper':'produce',
  'chili':'produce','chilies':'produce','chilli':'produce',
  'cucumber':'produce','zucchini':'produce','yellow squash':'produce',
  'butternut squash':'produce','acorn squash':'produce','delicata squash':'produce',
  'eggplant':'produce','aubergine':'produce',
  'broccoli':'produce','cauliflower':'produce','brussels sprouts':'produce',
  'cabbage':'produce','red cabbage':'produce','napa cabbage':'produce','bok choy':'produce',
  'kale':'produce','spinach':'produce','arugula':'produce','swiss chard':'produce',
  'collard greens':'produce','romaine':'produce','mixed greens':'produce',
  'asparagus':'produce','green beans':'produce','snap peas':'produce','snow peas':'produce',
  'peas':'produce','corn':'produce','artichoke':'produce','fennel':'produce',
  'celery':'produce','carrots':'produce','carrot':'produce','parsnip':'produce',
  'turnip':'produce','beet':'produce','beets':'produce','radish':'produce','radishes':'produce',
  'potato':'produce','potatoes':'produce','sweet potato':'produce','sweet potatoes':'produce',
  'yukon gold potatoes':'produce','russet potatoes':'produce','red potatoes':'produce',
  'mushroom':'produce','mushrooms':'produce','cremini mushrooms':'produce',
  'shiitake mushrooms':'produce','portobello mushroom':'produce','oyster mushrooms':'produce',
  'avocado':'produce','lime':'produce','lemon':'produce','orange':'produce',
  'grapefruit':'produce','apple':'produce','pear':'produce','mango':'produce',
  'pineapple':'produce','peach':'produce','nectarine':'produce','plum':'produce',
  'strawberry':'produce','strawberries':'produce','blueberries':'produce',
  'raspberries':'produce','blackberries':'produce','grapes':'produce','banana':'produce',
  'cilantro':'produce','parsley':'produce','basil':'produce','mint':'produce',
  'dill':'produce','thyme':'produce','rosemary':'produce','sage':'produce',
  'oregano leaves':'produce','tarragon':'produce','chives':'produce',
  'cilantro leaves':'produce','lemon juice':'produce','lime juice':'produce',
  'lemon zest':'produce','lime zest':'produce','orange zest':'produce',

  // ── Dairy ────────────────────────────────────────────────────────────────────
  'butter':'dairy','unsalted butter':'dairy','salted butter':'dairy',
  'vegan butter':'dairy','ghee':'dairy',
  'milk':'dairy','whole milk':'dairy','skim milk':'dairy','2% milk':'dairy',
  'oat milk':'dairy','almond milk':'dairy','coconut milk':'dairy','soy milk':'dairy',
  'heavy cream':'dairy','heavy whipping cream':'dairy','half and half':'dairy','half-and-half':'dairy',
  'buttermilk':'dairy','low-fat buttermilk':'dairy',
  'sour cream':'dairy','cream cheese':'dairy','ricotta':'dairy',
  'mascarpone':'dairy','cottage cheese':'dairy',
  'parmesan':'dairy','mozzarella':'dairy','cheddar':'dairy','feta':'dairy',
  'gruyere':'dairy','brie':'dairy','goat cheese':'dairy','gouda':'dairy',
  'provolone':'dairy','swiss cheese':'dairy','pepper jack':'dairy',
  'mexican cheese':'dairy','queso fresco':'dairy','cotija':'dairy',
  'plain greek yogurt':'dairy','greek yogurt':'dairy','yogurt':'dairy',
  'yoghurt':'dairy','natural yoghurt':'dairy','natural yogurt':'dairy',
  'greek yoghurt':'dairy','plain greek yoghurt':'dairy',
  'non-fat greek yogurt':'dairy','full-fat greek yogurt':'dairy',
  'pecorino':'dairy','grated pecorino':'dairy','pecorino romano':'dairy',
  'kefir':'dairy',
  'tzatziki':'dairy','tzatziki sauce':'dairy',

  // ── Pantry Staples ───────────────────────────────────────────────────────────
  'olive oil':'pantry-staples','extra virgin olive oil':'pantry-staples',
  'neutral oil':'pantry-staples','vegetable oil':'pantry-staples',
  'canola oil':'pantry-staples','avocado oil':'pantry-staples',
  'sesame oil':'pantry-staples','coconut oil':'pantry-staples',
  'salt':'pantry-staples','black pepper':'pantry-staples',
  'garlic powder':'pantry-staples','onion powder':'pantry-staples',
  'paprika':'pantry-staples','smoked paprika':'pantry-staples',
  'cumin':'pantry-staples','ground cumin':'pantry-staples',
  'coriander':'pantry-staples','ground coriander':'pantry-staples',
  'turmeric':'pantry-staples','ground turmeric':'pantry-staples',
  'chili powder':'pantry-staples','cayenne':'pantry-staples',
  'red pepper flakes':'pantry-staples','chilli flakes':'pantry-staples',
  'chili flakes':'pantry-staples','crushed red pepper':'pantry-staples',
  'oregano':'pantry-staples','dried oregano':'pantry-staples',
  'dried thyme':'pantry-staples','dried basil':'pantry-staples',
  'dried rosemary':'pantry-staples','bay leaf':'pantry-staples','bay leaves':'pantry-staples',
  'cinnamon':'pantry-staples','ground cinnamon':'pantry-staples',
  'ground cardamom':'pantry-staples','cardamom':'pantry-staples',
  'ground ginger':'pantry-staples','allspice':'pantry-staples',
  'nutmeg':'pantry-staples','ground nutmeg':'pantry-staples',
  'cloves':'pantry-staples','ground cloves':'pantry-staples',
  'cumin seeds':'pantry-staples','coriander seeds':'pantry-staples',
  'mustard seeds':'pantry-staples','fennel seeds':'pantry-staples',
  'za\'atar':'pantry-staples','zaatar':'pantry-staples','sumac':'pantry-staples',
  'curry powder':'pantry-staples','garam masala':'pantry-staples',
  'ras el hanout':'pantry-staples','chinese five spice':'pantry-staples',
  'italian seasoning':'pantry-staples','everything bagel seasoning':'pantry-staples',
  'flour':'pantry-staples','all purpose flour':'pantry-staples',
  'almond flour':'pantry-staples','tapioca flour':'pantry-staples',
  'cornstarch':'pantry-staples','corn starch':'pantry-staples','arrowroot':'pantry-staples',
  'baking soda':'pantry-staples','baking powder':'pantry-staples',
  'sugar':'pantry-staples','white sugar':'pantry-staples',
  'brown sugar':'pantry-staples','light brown sugar':'pantry-staples',
  'dark brown sugar':'pantry-staples','powdered sugar':'pantry-staples',
  'honey':'pantry-staples','maple syrup':'pantry-staples','agave':'pantry-staples',
  'vanilla extract':'pantry-staples','vanilla':'pantry-staples',
  'soy sauce':'pantry-staples','low sodium soy sauce':'pantry-staples',
  'tamari':'pantry-staples','coconut aminos':'pantry-staples',
  'fish sauce':'pantry-staples','oyster sauce':'pantry-staples',
  'worcestershire sauce':'pantry-staples','hot sauce':'pantry-staples',
  'sriracha':'pantry-staples','gochujang':'pantry-staples',
  'tomato paste':'pantry-staples','tomato sauce':'pantry-staples',
  'diced tomatoes':'pantry-staples','crushed tomatoes':'pantry-staples',
  'fire roasted tomatoes':'pantry-staples','whole peeled tomatoes':'pantry-staples',
  'chicken broth':'pantry-staples','vegetable broth':'pantry-staples',
  'beef broth':'pantry-staples','fish stock':'pantry-staples',
  'bouillon cube':'pantry-staples','bouillon cubes':'pantry-staples',
  'chicken bouillon cube':'pantry-staples','chicken bouillon cubes':'pantry-staples',
  'beef bouillon cube':'pantry-staples','beef bouillon cubes':'pantry-staples',
  'vegetable bouillon cube':'pantry-staples','vegetable bouillon cubes':'pantry-staples',
  'bouillon':'pantry-staples',
  'white wine':'pantry-staples','red wine':'pantry-staples',
  'red wine vinegar':'pantry-staples','white wine vinegar':'pantry-staples',
  'apple cider vinegar':'pantry-staples','balsamic vinegar':'pantry-staples',
  'rice vinegar':'pantry-staples','distilled white vinegar':'pantry-staples',
  'dijon mustard':'pantry-staples','whole grain mustard':'pantry-staples',
  'mayonnaise':'pantry-staples','tahini':'pantry-staples',
  'peanut butter':'pantry-staples','almond butter':'pantry-staples',
  'capers':'pantry-staples','olives':'pantry-staples','kalamata olives':'pantry-staples',
  'sun dried tomatoes':'pantry-staples','artichoke hearts':'pantry-staples',
  'roasted red peppers':'pantry-staples',
  'white rice':'pantry-staples','jasmine rice':'pantry-staples',
  'basmati rice':'pantry-staples','brown rice':'pantry-staples',
  'cauliflower rice':'pantry-staples','steamed rice':'pantry-staples',
  'rice':'pantry-staples',
  'pasta':'pantry-staples','spaghetti':'pantry-staples','penne':'pantry-staples',
  'fettuccine':'pantry-staples','rigatoni':'pantry-staples','orzo':'pantry-staples',
  'quinoa':'pantry-staples','couscous':'pantry-staples','farro':'pantry-staples',
  'breadcrumbs':'pantry-staples','panko':'pantry-staples',
  'nutritional yeast':'pantry-staples',
  'sesame seeds':'pantry-staples','pine nuts':'pantry-staples',
  'walnuts':'pantry-staples','almonds':'pantry-staples','pecans':'pantry-staples',
  'cashews':'pantry-staples','peanuts':'pantry-staples','pistachios':'pantry-staples',
  'walnut halves':'pantry-staples','walnut pieces':'pantry-staples',
  'pumpkin seeds':'pantry-staples','sunflower seeds':'pantry-staples',
  'chipotle peppers in adobo':'pantry-staples','chipotle peppers in adobo sauce':'pantry-staples',
  'pickled red onions':'produce','pickled jalapenos':'produce','pickled jalapeños':'produce',
  // Round 28 backfill — high-frequency unmatched
  'sichuan peppercorn':'pantry-staples','sichuan peppercorns':'pantry-staples',
  'green cardamom':'pantry-staples','green cardamoms':'pantry-staples','cardamom':'pantry-staples',
  'tajin':'pantry-staples','tajin powder':'pantry-staples',
  'shredded coconut':'pantry-staples','unsweetened shredded coconut':'pantry-staples',
  'shredded unsweetened coconut':'pantry-staples',
  'orzo pasta':'pantry-staples','dry orzo pasta':'pantry-staples',
  'better than bouillon':'pantry-staples',
  'better than bouillon chicken base':'pantry-staples',
  'better than bouillon beef base':'pantry-staples',
  'red boat fish sauce':'pantry-staples',
  'pickled cucumbers':'produce','pickled onions':'produce',
  'pearl onions':'produce','mini cucumbers':'produce','baby cucumbers':'produce',
  'red chillies':'produce','red chilli':'produce','red chili':'produce','red chilies':'produce',
  'rainbow chard':'produce','swiss chard':'produce',
  'queso oaxaca':'dairy',

  // ── Pantry Consumables ───────────────────────────────────────────────────────
  'tortillas':'pantry-consumables','flour tortillas':'pantry-consumables',
  'corn tortillas':'pantry-consumables','pita':'pantry-consumables',
  'naan':'pantry-consumables','bread':'pantry-consumables',
  'sandwich bread':'pantry-consumables','sourdough':'pantry-consumables',
  'baguette':'pantry-consumables','ciabatta':'pantry-consumables',
  'taco shells':'pantry-consumables','rice paper':'pantry-consumables',
  'lasagna noodles':'pantry-consumables',
  'coconut cream':'pantry-consumables','full fat coconut milk':'pantry-consumables',

  // ── Frozen ───────────────────────────────────────────────────────────────────
  'frozen peas':'frozen','frozen corn':'frozen','frozen spinach':'frozen',
  'frozen edamame':'frozen','frozen broccoli':'frozen',
};

// Runtime DB — starts as a copy of the baseline; Firestore loading adds/overrides
let INGREDIENT_DB: Record<string, string> = { ...BASELINE_DB };
let DB_KEYS_BY_LENGTH: string[] = Object.keys(INGREDIENT_DB).sort((a, b) => b.length - a.length);

function rebuildDbIndex(): void {
  DB_KEYS_BY_LENGTH = Object.keys(INGREDIENT_DB).sort((a, b) => b.length - a.length);
}

// Call this once at app startup to load additional categories from Firestore.
// Merges on top of BASELINE_DB — Firestore entries override if names match.
export async function loadIngredientCategories(): Promise<void> {
  try {
    const { collection, getDocs } = await import('firebase/firestore');
    const { db } = await import('./firebase');
    const snap = await getDocs(collection(db, 'ingredientCategories'));
    snap.forEach((docSnap: any) => {
      const d = docSnap.data();
      if (d.name && d.category) {
        INGREDIENT_DB[d.name.toLowerCase()] = d.category;
      }
    });
    rebuildDbIndex();
    console.log(`[ingredientParser] Loaded ${Object.keys(INGREDIENT_DB).length} ingredient categories`);
  } catch (e) {
    console.warn('[ingredientParser] ingredientCategories load failed, using baseline only:', e);
  }
}


// ── Levenshtein fuzzy matching ─────────────────────────────────────────────────

function levenshteinDistance(a: string, b: string): number {
  a = a.toLowerCase(); b = b.toLowerCase();
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) matrix[i][j] = matrix[i - 1][j - 1];
      else matrix[i][j] = Math.min(matrix[i-1][j-1]+1, matrix[i][j-1]+1, matrix[i-1][j]+1);
    }
  }
  return matrix[b.length][a.length];
}

function findClosestMatch(ingredient: string): [string | null, number] {
  let bestMatch: string | null = null, bestDist = Infinity;
  for (const key of DB_KEYS_BY_LENGTH) {
    const dist = levenshteinDistance(ingredient, key);
    if (dist < bestDist) { bestDist = dist; bestMatch = key; }
    if (bestDist === 0) break;
  }
  return [bestMatch, bestDist];
}

// ── Category lookup ────────────────────────────────────────────────────────────

export function categorizeIngredient(name: string): string {
  const lower = name.toLowerCase();
  if (INGREDIENT_DB[lower]) return INGREDIENT_DB[lower];
  for (const key of DB_KEYS_BY_LENGTH) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(?:^|\\s)' + escaped + '(?:\\s|$)');
    if (re.test(lower)) return INGREDIENT_DB[key];
  }
  const [match, distance] = findClosestMatch(lower);
  if (distance <= 2 && match) return INGREDIENT_DB[match];
  return 'pantry-staples';
}

// Returns category + whether it was a real DB match (matched: false = fallback default)
export function categorizeIngredientWithMatch(name: string): { category: string; matched: boolean } {
  const lower = name.toLowerCase();
  if (INGREDIENT_DB[lower]) return { category: INGREDIENT_DB[lower], matched: true };
  for (const key of DB_KEYS_BY_LENGTH) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(?:^|\\s)' + escaped + '(?:\\s|$)');
    if (re.test(lower)) return { category: INGREDIENT_DB[key], matched: true };
  }
  const [match, distance] = findClosestMatch(lower);
  if (distance <= 2 && match) return { category: INGREDIENT_DB[match], matched: true };
  return { category: 'pantry-staples', matched: false };
}

// Call after saving a new ingredient to Firestore — keeps in-memory DB in sync
export function addIngredientToDb(name: string, category: string): void {
  INGREDIENT_DB[name.toLowerCase()] = category;
  rebuildDbIndex();
}

function cleanForDbLookup(s: string): string {
  return s
    .replace(/\s+for\s+(?:serving|garnish(?:ing)?|topping)\b.*/i, '')
    // Strip leading qty + optional unit so "6 garlic cloves" → "garlic cloves",
    // "1/2 cup spinach" → "spinach", "2 tbsp olive oil" → "olive oil"
    .replace(/^(\d+(?:\s+\d+\/\d+)?(?:\.\d+)?|\d+\/\d+|[¼-¾⅐-⅞])\s+(?:cups?|tbsps?|tablespoons?|tsps?|teaspoons?|oz|ounces?|lbs?|pounds?|grams?|g|kg|ml|l|cloves?|heads?|bunches?|stalks?|sprigs?|cans?|pkgs?|pieces?|slices?|sticks?)\s+/i, '')
    .replace(/^(\d+(?:\s+\d+\/\d+)?(?:\.\d+)?|\d+\/\d+|[¼-¾⅐-⅞])\s+/, '')
    .trim()
    .toLowerCase();
}

// Splits "steamed rice, naan for serving" → ["steamed rice", "naan for serving"]
// and "steamed rice and naan for serving" → ["steamed rice", "naan for serving"]
// but keeps "boneless, skinless chicken thighs" as one item.
export function splitIngredientLine(raw: string): string[] {
  // Pre-strip "(or any X like Y, Z)" parenthetical alternatives BEFORE splitting.
  // Otherwise the splitter sees the "or"/commas inside parens and splits incorrectly.
  raw = raw.replace(/\s*\(\s*or\s+(?:any\s+)?[^)]+\)/gi, '').trim();
  // Pre-collapse "Juice of N <citrus>" → "N <citrus>" BEFORE mega-split (otherwise
  // mega-split sees "1 large lemon" as a new ingredient and splits "Juice of"
  // into its own segment).
  raw = raw.replace(/^juice\s+of\s+(\d+(?:\s+\d+\/\d+)?(?:\.\d+)?)\s+(?:large\s+|small\s+|medium\s+|big\s+)?(lemons?|limes?|oranges?|grapefruits?)\b[^()]*/i,
    (_, n, fruit) => `${n} ${fruit}`).trim();
  raw = raw.replace(/^juice\s+of\s+(\d+(?:\s+\d+\/\d+)?(?:\.\d+)?)\s+(?:large\s+|small\s+|medium\s+|big\s+)?(lemons?|limes?|oranges?|grapefruits?)\b/i,
    '$1 $2').trim();
  // Pre-strip ", plus X for Y" / ", plus more" trailing — recipe author offering
  // an extra portion that isn't a separate ingredient.
  raw = raw.replace(/,\s*plus\s+(?:more|extra|\w+(?:\s+\w+)?)\s+(?:for\s+\w+|as\s+needed|to\s+taste|if\s+needed|to\s+\w+).*$/i, '').trim();
  raw = raw.replace(/,\s*plus\s+more\b.*$/i, '').trim();
  // Pre-insert a space between letter+digit (recipe authors sometimes paste
  // "2 eggs2-3 garlic" with no space) so qty boundaries are visible.
  // Decode HTML entities first so &frac14;/&#39; etc. don't get mangled.
  raw = raw
    .replace(/&frac14;/g, '¼').replace(/&frac12;/g, '½').replace(/&frac34;/g, '¾')
    .replace(/&#(?:8211|8212);/g, '-')
    .replace(/([a-z])(\d)/gi, '$1 $2');
  // " or sub <X> and <Y>" / " or sub <X>" trailing alternative — strip entirely
  // (recipe author offering a substitute, not a separate ingredient).
  raw = raw.replace(/\s*[-–—]?\s*or\s+sub\b[^()]*$/i, '').trim();
  // Trailing "- optional" / " optional" lone marker after em-dash/hyphen — strip
  raw = raw.replace(/\s*[-–—]\s*optional\b\s*\.?\s*$/i, '').trim();
  // Lone trailing em-dash/hyphen left over from earlier strips
  raw = raw.replace(/\s*[-–—]\s*$/, '').trim();
  // Pre-strip long author-note parens BEFORE splitting (commas inside the paren
  // would otherwise trigger a bad comma-split). Mirrors the rule in parseIngredient.
  //   "(I have also used cottage cheese it worked perfectly...)" → strip
  raw = raw.replace(/\(\s*(?:I|i|you|You|we|We)\s+[^)]{20,}\)/g, '').trim();
  raw = raw.replace(/\([^)]*\b(?:worked\s+perfectly|tried\s+(?:it|this)|works\s+great|highly\s+recommend)\b[^)]*\)/gi, '').trim();
  // Pre-collapse "such as X and Y" / "such as X, Y, and Z" to just "such as X" so
  // the splitter's "and" pass doesn't break on the herb list:
  //   "tender herbs, such as basil and mint" → "tender herbs, such as basil"
  // Pre-collapse multi-herb "<adj> herbs, such as X, Y, Z (or W)" → "<adj> herbs (X, Y, Z, or W)"
  // BEFORE the comma-splitter sees the herb list (otherwise each herb becomes a
  // separate ingredient).
  raw = raw.replace(
    /\b(?:tender|soft|mixed|fresh)?\s*herbs?\b\s*,?\s*such\s+as\s+([a-z][a-z\s,]*?)(?:,\s*or\s+(?:a\s+|some\s+)?combination[a-z\s]*)?\s*\.?\s*$/i,
    (_, list: string) => {
      const items = list
        .split(/\s*,\s*|\s+(?:and|or)\s+/i)
        .map((s: string) => s.trim().replace(/[^a-z\s]/gi, ''))
        .filter((s: string) => s.length > 1);
      if (items.length === 0) return 'fresh herbs';
      if (items.length === 1) return `fresh ${items[0]}`;
      const last = items[items.length - 1];
      const head = items.slice(0, -1).join(', ');
      return `herbs (${head}, or ${last})`;
    }
  );
  // Don't pre-collapse when preceded by "herbs" — those need the full list
  // preserved for the herbs (cilantro, dill, mint, or basil) parenthetical.
  if (!/\bherbs?\b\s*,?\s*such\s+as\b/i.test(raw)) {
    raw = raw.replace(/(\bsuch\s+as\s+\w+(?:\s+\w+)?)\s*(?:,\s*\w+(?:\s+\w+)?)*\s+(?:and|or|&)\s+\w+(?:\s+\w+)?/gi, '$1');
  }
  // Inline split: catches recipe-author smush of multiple ingredients onto one line.
  //   "1½ yellow onions, finely chopped 6 garlic cloves, thinly sliced"
  //     → "1½ yellow onions, finely chopped" + "6 garlic cloves, thinly sliced"
  // Pattern: <prep-word> <digit>...<piece-or-unit-noun> — the piece word at the
  // end of the second clause is the strongest signal of a new ingredient. Insert
  // a comma so downstream comma split can pick it up.
  raw = raw.replace(
    /(\b(?:chopped|sliced|minced|diced|peeled|halved|quartered|grated|crushed|cubed|julienned|torn|whisked|beaten))\s+(\d+(?:\s+\d+\/\d+)?(?:\.\d+)?\s+(?:[a-z]+\s+){0,2}(?:cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|oz|ounce|ounces|lb|pound|pounds|clove|cloves|head|heads|bunch|bunches|stalk|stalks|piece|pieces|slice|slices|sprig|sprigs|can|cans)\b)/gi,
    '$1, $2'
  );
  // Mega-paragraph splitter: when a single line contains MULTIPLE "<num> <unit/count-noun>"
  // patterns (recipe author dumped everything into one line), insert commas before
  // every secondary qty-start. Skip content inside parens (preserve "(8 ounces)" etc.).
  // Triggers only when the line is long (>60 chars) and we find ≥2 unit-anchored qtys.
  // Pre-strip "either X or Y" alternative-source phrase before mega-split sees it
  // (otherwise the inner qty in "either pre-packaged or sliced from 2 large heads"
  // would trigger a bad split).
  raw = raw.replace(/,\s*either\b[^,]*(?:or\b[^,]*)?(?=,|$)/i, '').trim();
  // Pre-strip "or <qty> <unit> <noun>" alternative phrases — recipe author
  // offering a substitute, not a separate ingredient. Take first option only.
  //   "1/2 tablespoon butter or 1 1/2 teaspoons olive oil" → "1/2 tablespoon butter"
  // Skip if a serving suffix is present (handled by Pass 2 split for accompaniments).
  if (!/\bfor\s+serving|to\s+serve|to\s+garnish|for\s+garnish|to\s+taste|as\s+needed\b/i.test(raw)) {
    raw = raw.replace(/\s+or\s+(?:\d+(?:\/\d+)?(?:\s+\d+\/\d+)?|\d+\s*-\s*\d+)\s+(?:[a-z]+\s+){0,3}(?:cups?|tbsps?|tablespoons?|tsps?|teaspoons?|oz|ounces?|lbs?|pounds?)\s+[a-z][^,()]*$/i, '').trim();
  }
  if (raw.length >= 20) {
    // Mask paren content so qtys inside parens aren't split:
    const parens: string[] = [];
    const masked = raw.replace(/\([^)]*\)/g, m => { parens.push(m); return 'XPAREN' + (parens.length - 1) + 'X'; });
    // Split before "<num>[/<num>][\s<num>/<num>]\s<unit-or-count-noun>" mid-string
    // Negative lookbehind: don't split right after a connector word like "to" / "or" /
    // "minus" / "plus" — those signal a range or arithmetic, not a new ingredient.
    //   "1 to 3 tablespoons olives"     — keep together
    //   "1 large or 2 small bunches X"  — keep together
    //   "1 1/4 cups MINUS 2 tbsp water" — keep together (handled separately)
    const QTY_BOUNDARY = /(?<=[a-z\)])(?<!\b(?:to|or|minus|plus))\s+(?=(?:\d+(?:\/\d+)?(?:\s+\d+\/\d+)?|\d+\s*-\s*\d+)\s+(?:[a-z]+\s+){0,2}(?:cups?|tbsps?|tablespoons?|tsps?|teaspoons?|oz|ounces?|lbs?|pounds?|grams?|ml|cloves?|heads?|bunches?|stalks?|sprigs?|cans?|pkgs?|pieces?|slices?|sticks?|ears?|eggs?|onions?|shallots?|tomatoes?|potatoes?|carrots?|lemons?|limes?|peppers?|chilies|chiles|leeks?|cucumbers?|basil|cilantro|parsley|mint|dill|chives|tarragon|thyme|rosemary|sage|oregano|salt|pepper))/gi;
    const splits = masked.split(QTY_BOUNDARY).map(s => s.trim()).filter(Boolean);
    if (splits.length >= 2) {
      // 2+ qty-anchored chunks → likely a smushed multi-ingredient line.
      // Return splits directly, bypassing the conservative comma-merge below
      // (which would re-glue them).
      const restored = splits
        .map(s => s.replace(/XPAREN(\d+)X/g, (_, i) => parens[parseInt(i, 10)] || '').trim())
        .filter(Boolean);
      return restored;
    }
  }

  // "Optional for serving: <X>" — the part after the colon is the actual
  // ingredient. Rewrite to "<X>, for serving" so the parser picks it up
  // properly and we don't lose the ingredient name.
  raw = raw.replace(/^optional\s+for\s+serving\s*[:.\-—]\s*(.+)$/i, '$1, for serving');

  // "<X> <unit1> MINUS <Y> <unit2> <noun>" — math expression. Split into two
  // ingredients: integer-part of X with unit1 + Y with unit2, both with noun.
  //   "1 1/4 cups MINUS 2 tbsp water" → ["1 cup water", "2 tbsp water"]
  // (The fractional part of X is approximately consumed by the MINUS Y term.)
  {
    const minusM = raw.match(/^(\d+)(?:\s+\d+\/\d+)?\s+(\w+)\s+(?:minus|less)\s+(\d+(?:\/\d+)?)\s+(\w+)\s+(.+)$/i);
    if (minusM) {
      return [`${minusM[1]} ${minusM[2]} ${minusM[5]}`, `${minusM[3]} ${minusM[4]} ${minusM[5]}`];
    }
  }

  // "<qty> <unit> each: <A>, <B>, <C>" — split into individual ingredients
  // each carrying the same qty/unit:
  //   "1/2 teaspoon each: crushed red pepper flakes, dried oregano, salt"
  //     → ["1/2 tsp crushed red pepper flakes", "1/2 tsp dried oregano", "1/2 tsp salt"]
  {
    // First try with explicit colon/dash punctuation, then fall back to no-punct form.
    const eachM = raw.match(/^(\d+(?:\s+\d+)?\/\d+|\d+\.?\d*)\s+(\w+)\s+each\s*(?:[:.\-—]\s*|\s+)(.+)$/i);
    if (eachM) {
      const qtyStr = eachM[1];
      const unitStr = eachM[2];
      const items = eachM[3].split(/,\s*|\s+and\s+/).map(s => s.trim()).filter(Boolean);
      return items.map(item => `${qtyStr} ${unitStr} ${item}`);
    }
  }

  // Garnish/topping/filling-addition list: split each into its own ingredient
  // with a "for garnish" marker so each gets unit="to garnish".
  // "optional garnishes: sour cream, avocado, cilantro, scallions"
  //   → ["sour cream, for garnish", "avocado, for garnish", "cilantro, for garnish", ...]
  // The "add garnishes" toggle in the consumer app can then conditionally
  // include/exclude these from the shopping list and nutrition totals.
  {
    const garnishM = raw.match(/^(?:optional\s+|suggested\s+|recommended\s+)?(?:garnishes?|toppings?|filling\s+additions?|add[\s-]?ins?)\s*[:.\-—]\s*(.+)$/i);
    if (garnishM) {
      const items = garnishM[1].split(/,\s*(?!and\b)|(?:,\s*)?\s+and\s+/i).map(s => s.trim()).filter(Boolean);
      return items.map(item => `${item}, for garnish`);
    }
    // "for serving, as desired: A, B, C" / "to serve: A, B, C" — colon-list with
    // serving marker. Each item gets a "for serving" suffix.
    //   "for serving, as desired: olive oil, parsley, lemon zest, crusty bread"
    //     → ["olive oil, for serving", "parsley, for serving", ...]
    const serveM = raw.match(/^(?:for\s+serving|to\s+serve)(?:,\s*as\s+desired)?\s*[:.\-—]\s*(.+)$/i);
    if (serveM) {
      const items = serveM[1]
        .replace(/,?\s*etc\.?\s*$/i, '')
        .split(/,\s*(?!and\b)|(?:,\s*)?\s+and\s+/i)
        .map(s => s.trim())
        .filter(Boolean);
      return items.map(item => `${item}, for serving`);
    }
  }

  // Salt+pepper compound: don't split — let parseIngredient collapse it to "salt + pepper".
  // Without this guard, "kosher salt and black pepper" would split into 2 items.
  {
    const lower = raw.toLowerCase();
    const hasSalt   = /\bsalt\b/.test(lower);
    const hasPepper = /\bpepper\b/.test(lower);
    if (hasSalt && hasPepper && /\bsalt\b[\s\w&+/,]{0,30}\bpepper\b|\bpepper\b[\s\w&+/,]{0,30}\bsalt\b/.test(lower)) {
      return [raw];
    }
  }

  // Detect a trailing serving/garnish suffix on the WHOLE input. If we end up
  // splitting, each split should carry the same suffix so both halves get the
  // "to serve" / "to garnish" marker:
  //   "steamed rice and naan, for serving" →
  //     ["steamed rice, for serving", "naan, for serving"]
  let trailingSuffix = '';
  const suffixPatterns: RegExp[] = [
    /,?\s*for\s+serving\b.*$/i,
    /,?\s*to\s+serve\b.*$/i,
    /,?\s*for\s+garnish(?:ing)?\b.*$/i,
    /,?\s*to\s+garnish\b.*$/i,
    /,?\s*for\s+topping\b.*$/i,
    /,?\s*to\s+top\b.*$/i,
    /,?\s*(?:to|for)\s+(?:squeeze|drizzle|drizzling|spoon|pour|pouring)(?:\s+(?:over|on))?\b.*$/i,
    /,?\s*to\s+taste\b.*$/i,
    /,?\s*as\s+needed\b.*$/i,
  ];
  // Mask paren content so suffix patterns don't match suffixes that live INSIDE
  // a paren (e.g. "2 lemons (1 juiced and 1 cut into wedges for serving)" — the
  // "for serving" is part of the recipe-author's note, not a trailing marker).
  const sufParens: string[] = [];
  const sufMasked = raw.replace(/\([^)]*\)/g, m => {
    sufParens.push(m);
    return 'XSFX' + (sufParens.length - 1) + 'X';
  });
  for (const pat of suffixPatterns) {
    const m = sufMasked.match(pat);
    if (m) {
      // Compute index in original raw by accounting for masked-vs-original offsets.
      // Simpler: find the matched text in raw — since we only stripped paren content,
      const matchedText = m[0];
      const restoredMatch = matchedText.replace(/XSFX(\d+)X/g, (_, i) => sufParens[parseInt(i, 10)] || '');
      const realIdx = raw.lastIndexOf(restoredMatch);
      if (realIdx >= 0) {
        trailingSuffix = restoredMatch.replace(/^,?\s*/, ', ');
        raw = raw.slice(0, realIdx).trim();
        break;
      }
    }
  }

  // Pass 1: comma-based split — only split when the right segment is a known DB ingredient.
  // Mask paren content so commas INSIDE parens (e.g. "herbs (cilantro, dill, mint, or basil)")
  // don't get split. Restore parens after Pass 1 returns.
  const passParens: string[] = [];
  const passMasked = raw.replace(/\([^)]*\)/g, m => {
    passParens.push(m);
    return 'XPRN' + (passParens.length - 1) + 'X';
  });
  const restorePass = (s: string) => s.replace(/XPRN(\d+)X/g, (_, i) => passParens[parseInt(i, 10)] || '');
  const commaParts = passMasked.split(/,\s*/).map(restorePass);
  let working: string[];
  if (commaParts.length > 1) {
    const result: string[] = [commaParts[0]];
    for (let i = 1; i < commaParts.length; i++) {
      const part = commaParts[i].trim();
      const cleaned = cleanForDbLookup(part);
      const firstWord = cleaned.split(/\s+/)[0] ?? '';
      const isModifier = PREP_WORDS.has(firstWord) || STOP_WORDS.includes(firstWord);
      if (!isModifier && !!INGREDIENT_DB[cleaned]) {
        result.push(part);
      } else {
        result[result.length - 1] += ', ' + part;
      }
    }
    working = result;
  } else {
    working = [raw];
  }

  // Helper — does this phrase end with a word that's a known DB ingredient
  // OR a recognized piece-word (thighs/drumsticks/breasts/fillets/etc.)?
  // Strips trailing prep/modifier words first so "corn tortillas, warmed" still
  // resolves on "tortillas".
  function endsWithKnownIngredient(phrase: string): boolean {
    const cleaned = cleanForDbLookup(phrase);
    if (INGREDIENT_DB[cleaned]) return true;
    let tokens = cleaned.split(/[\s,]+/).filter(Boolean);
    // Strip trailing prep/stop words so we can find the actual noun
    while (tokens.length > 0) {
      const last = tokens[tokens.length - 1];
      if (PREP_WORDS.has(last) || STOP_WORDS.includes(last)) tokens.pop();
      else break;
    }
    if (tokens.length === 0) return false;
    // Last token a piece-word (cut of meat, etc.)
    if (PIECE_WORDS.has(tokens[tokens.length - 1])) return true;
    // Try last 1-3 tokens as a multi-word DB phrase
    for (let take = 1; take <= Math.min(3, tokens.length); take++) {
      const tail = tokens.slice(-take).join(' ');
      if (INGREDIENT_DB[tail]) return true;
    }
    return false;
  }

  // Pass 2: "and" / "/" split — split when BOTH sides END with a known DB ingredient.
  // EXCEPTION: when a trailing serving suffix was captured (for serving / to serve /
  //            to garnish), DO split on " or " — the recipe author is offering a
  //            choice of accompaniment, both should appear in the shopping list.
  //            Otherwise " or " is excluded ("always take first option" policy).
  const seps = trailingSuffix ? [' and ', ' or ', '/'] : [' and ', '/'];
  const final: string[] = [];
  for (const segment of working) {
    let didSplit = false;
    for (const sep of seps) {
      const idx = segment.toLowerCase().indexOf(sep);
      if (idx < 0) continue;
      const before = segment.slice(0, idx).trim();
      const after  = segment.slice(idx + sep.length).trim();
      // When a serving suffix is set, be permissive on " or " — recipe author
      // is offering accompaniments, even if not all are in the DB.
      // EXCEPTION: when both halves end with the same noun (e.g. "white rice or
      // brown rice"), it's a variety alternative — take first only, don't split.
      const isServingAnd = !!trailingSuffix && sep === ' and ';
      const isServingOr = !!trailingSuffix && sep === ' or ';
      // Permissive " and " split for serving lists too — recipe author offering
      // multiple accompaniments. "Crumbled feta and crushed pita chips, for topping"
      // → both items as garnishes.
      if (isServingAnd) {
        final.push(before, after);
        didSplit = true;
        break;
      }
      if (isServingOr) {
        const beforeLastWord = before.split(/\s+/).pop()?.toLowerCase() || '';
        const afterLastWord  = after.split(/\s+/).pop()?.toLowerCase() || '';
        // Variety alternative: same noun on both sides ("white rice or brown rice")
        // OR before is missing a noun ("Steamed white or brown rice" — before="Steamed
        // white" has no DB ingredient, after="brown rice" does). Keep first only;
        // parser's OR collapse will append the noun to single-word firsts.
        const beforeHasNoun = endsWithKnownIngredient(before);
        const afterHasNoun  = endsWithKnownIngredient(after);
        const sameNoun = beforeLastWord && beforeLastWord === afterLastWord;
        if (sameNoun) {
          final.push(before);
          didSplit = true;
          break;
        }
        if (!beforeHasNoun && afterHasNoun) {
          // Before is just an adjective ("Steamed white"); append the noun
          // from after ("brown rice" → "rice") so the result is complete.
          //   "Steamed white or brown rice" → "Steamed white rice"
          //   "2 tbsp vegetable or coconut oil" → "2 tbsp vegetable oil"
          final.push(`${before} ${afterLastWord}`);
          didSplit = true;
          break;
        }
      }
      if ((endsWithKnownIngredient(before) && endsWithKnownIngredient(after)) || isServingOr) {
        final.push(before, after);
        didSplit = true;
        break;
      }
    }
    if (!didSplit) final.push(segment);
  }
  // Re-attach the trailing suffix to every split so each item carries the marker
  return trailingSuffix ? final.map(s => s + trailingSuffix) : final;
}

// ── Parser tables ──────────────────────────────────────────────────────────────

const FRACTION_MAP: Record<string, string> = {
  '½':'1/2','⅓':'1/3','⅔':'2/3','¼':'1/4','¾':'3/4',
  '⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8','⅙':'1/6','⅚':'5/6','⅕':'1/5','⅘':'4/5',
};

const UNITS: Record<string, string> = {
  cups:'cup', cup:'cup', 'c.':'cup',
  tablespoons:'tbsp', tablespoon:'tbsp', tbsp:'tbsp', tbs:'tbsp', tbsps:'tbsp',
  teaspoons:'tsp', teaspoon:'tsp', tsp:'tsp', tsps:'tsp',
  ounces:'oz', ounce:'oz', oz:'oz', 'fl oz':'oz',
  pounds:'lb', pound:'lb', lb:'lb', lbs:'lb',
  grams:'g', gram:'g', g:'g',
  kilograms:'kg', kilogram:'kg', kg:'kg',
  milliliters:'ml', milliliter:'ml', ml:'ml',
  liters:'l', liter:'l',
  cloves:'clove', clove:'clove',
  heads:'head', head:'head',
  bunches:'bunch', bunch:'bunch',
  cans:'can', can:'can',
  packages:'pkg', package:'pkg', pkg:'pkg',
  slices:'slice', slice:'slice',
  pieces:'piece', piece:'piece', pcs:'piece',
  filets:'filet', filet:'filet', fillets:'filet', fillet:'filet',
  ears:'ear', ear:'ear',
  sprigs:'sprig', sprig:'sprig',
  stalks:'stalk', stalk:'stalk',
  pinches:'pinch', pinch:'pinch',
  dashes:'dash', dash:'dash',
  inches:'inch', inch:'inch', '"':'inch',
  quarts:'qt', quart:'qt', qt:'qt',
  pints:'pt', pint:'pt', pt:'pt',
  drops:'drop', drop:'drop',
  tins:'tin', tin:'tin',
};

// Words that come after a comma and are always prep instructions, not product descriptors.
// "garlic, minced" → strip; "boneless, skinless chicken" → keep (not all prep words)
const PREP_WORDS = new Set([
  'minced','sliced','grated','shredded','peeled','crushed','halved','quartered',
  'julienned','cubed','torn','trimmed','zested','deveined','pitted','cored','seeded',
  'divided','optional','drained','rinsed','softened','melted','cooled','roughly',
  'finely','coarsely','tightly','blanched','chopped','cut','trimmed',
  // Temperature/state — same role as prep words for splitting purposes
  'cold','warm','hot','chilled',
  // Adjectives that modify another comma-part's noun — keep merged
  'salted','unsalted',
]);

const STOP_WORDS = [
  // Size / state — don't change what you buy
  'freshly','fresh','large','medium','small','whole','ripe','packed',
  'heaping','leveled','rounded','about','approximately',
  // Prep instructions — how to cut or treat, never what to buy
  // (NOTE: 'grated' / 'shredded' removed — meaningful for cheese)
  'roughly','minced','sliced','peeled','crushed',
  'halved','quartered','julienned','cubed','zested','deveined','deboned',
  'pitted','cored','seeded','deseeded','blanched','seared','caramelized',
  'toasted','grilled','charred','brined',
  // Quantity / usage qualifiers
  'optional','or more','to taste','divided','room temperature',
  'softened','melted','cooled','drained','rinsed','torn','trimmed',
  // 'thin','thinly','thick','thickly' intentionally preserved — meaningful at
  // the store ("thick-cut bacon" ≠ regular, "thinly sliced" = pre-sliced product).
  'fine','finely','coarsely','bite-sized','bite-size',
  'warm','hot','cold','chilled','thawed',
  'good','quality','best','organic','store-bought','homemade','low-sodium',
  'unsweetened','reduced-fat','full-fat','raw','uncooked','cooked',
  'leftover','day-old','for garnish','for serving','for topping','as needed','to coat',
  'plus more','garnish','serving','and',
  // NOTE: 'roasted','diced','chopped','smoked','pickled','dried','frozen','marinated','cured'
  // are intentionally NOT stop words — they describe product types that matter when shopping.
  // "fire roasted tomatoes" ≠ "diced tomatoes"; "smoked paprika" ≠ "paprika";
  // "dried oregano" ≠ "fresh oregano"; "frozen peas" = freezer aisle vs produce.
];

// Piece-count words: the leading number is a scalable count; per-piece weight stays as descriptor
const PIECE_WORDS = new Set([
  'fillet','fillets','thigh','thighs','breast','breasts','steak','steaks',
  'chop','chops','leg','legs','wing','wings','drumstick','drumsticks',
  'cutlet','cutlets','rack','rib','ribs','loin','loins','patty','patties',
  'burger','burgers','sausage','sausages','link','links',
]);

// Vague quantities — not scalable, returned as-is with no numeric qty
const VAGUE_WORDS = [
  // NOTE: 'pinch' and 'dash' removed — they're real units in UNITS table.
  // Routing them through unit extraction lets downstream steps (salt
  // collapse, name cleanup) run properly: "pinch of coarse kosher salt"
  // now becomes unit="pinch", name="salt".
  'few','handful','splash','sprinkle','drizzle',
  'to taste','as needed','some','squeeze','touch','knob',
];

const TEXT_NUMBERS: Record<string, number> = {
  one:1, two:2, three:3, four:4, five:5,
  six:6, seven:7, eight:8, nine:9, ten:10, half:0.5,
};

// Synonym / alias map — collapses variants into the canonical shopping name
const INGREDIENT_ALIASES: Record<string, string> = {
  // Herbs
  'flat-leaf parsley':'parsley', 'italian parsley':'parsley', 'curly parsley':'parsley',
  'thai basil':'basil', 'sweet basil':'basil', 'holy basil':'basil',
  // NOTE: "fresh <herb>" aliases removed — consumer needs to know to buy fresh
  // (vs dried) herbs at the store. "fresh dill" stays as "fresh dill", etc.
  'coriander leaves':'cilantro',
  'coriander':'cilantro', // bare "coriander" — usually means leaves in US recipes
  'dill weed':'dill',
  'spearmint':'mint',
  'thyme leaves':'thyme', 'thyme sprig':'thyme',
  'rosemary sprig':'rosemary',
  'sage leaf':'sage',
  // Onion family
  'green onion':'scallion', 'spring onion':'scallion', 'scallions':'scallion', 'green onions':'scallion',
  'spring onions':'scallion',
  'lower-sodium soy sauce':'soy sauce', 'low-sodium soy sauce':'soy sauce', 'reduced-sodium soy sauce':'soy sauce',
  'black peppercorns':'black pepper', 'black peppercorn':'black pepper',
  'sichuan peppercorns':'sichuan peppercorn',
  // Synonym aliases (round 22 backfill)
  'pepitas':'pumpkin seeds', 'pepita':'pumpkin seeds',
  'cornflour':'cornstarch', 'corn flour':'cornstarch',
  'worcestershire':'worcestershire sauce',
  // Round 27 backfill
  'poultry seasoning':'dried poultry blend',
  // Round 28 backfill
  'half & half':'half-and-half', 'half &amp; half':'half-and-half',
  'natural yoghurt':'yogurt', 'natural yogurt':'yogurt', 'yoghurt':'yogurt',
  'greek yoghurt':'greek yogurt', 'plain greek yoghurt':'plain greek yogurt',
  '0% fat greek yoghurt':'non-fat greek yogurt', '0% greek yoghurt':'non-fat greek yogurt',
  '90% lean ground beef':'ground beef', '93% lean ground beef':'ground beef',
  '93% lean ground turkey':'ground turkey', '99% lean ground turkey':'ground turkey',
  'mini cucumbers':'cucumber', 'mini cucumber':'cucumber',
  'baby cucumbers':'cucumber', 'baby cucumber':'cucumber',
  'persian cucumber':'cucumber', 'persian cucumbers':'cucumber',
  'thumb ginger':'fresh ginger', 'piece fresh ginger':'fresh ginger',
  'green part of the scallions':'scallion', 'green part of scallions':'scallion',
  'low-salt chicken broth':'chicken broth', 'low salt chicken broth':'chicken broth',
  'tamari/soy sauce':'soy sauce', 'tamari':'soy sauce',
  'red boat fish sauce':'fish sauce',
  'chunky red salsa':'salsa', 'chunky salsa':'salsa', 'red salsa':'salsa',
  'bbq sauce of choice':'bbq sauce', 'oil of choice':'olive oil',
  'dry orzo pasta':'orzo', 'orzo pasta':'orzo',
  'red chillies':'red chili', 'red chilies':'red chili', 'red chilli':'red chili',
  'green chillies':'green chili', 'green chilies':'green chili',
  'shredded unsweetened coconut':'shredded coconut',
  'unsweetened shredded coconut':'shredded coconut',
  'flat-leaf parsley':'parsley', 'flat leaf parsley':'parsley',
  'flat leaves-leaf parsley':'parsley',
  'bunch cilantro':'cilantro',
  'small bunch cilantro':'cilantro',
  'large bunch cilantro':'cilantro',
  'prepared rice':'white rice', 'cooked rice':'white rice',
  'steamed white rice':'white rice', 'steamed brown rice':'brown rice',
  'firm white fish':'white fish',
  'green cardamoms':'cardamom', 'green cardamom':'cardamom',
  'tajin powder':'tajin',
  'better than bouillon chicken base':'chicken broth',
  'better than bouillon beef base':'beef broth',
  'better than bouillon vegetable base':'vegetable broth',
  '16-20 shrimp':'shrimp',
  // Garlic — normalize word order; bare "garlic" = cloves
  // 'garlic clove' singular preserved at qty=1 by parser logic; do NOT alias to plural.
  'clove garlic':'garlic cloves',
  'cloves garlic':'garlic cloves',
  'garlic':'garlic cloves',
  // Citrus — keep juice/zest separate so buyer knows the form
  'lemon juice':'lemon juice', 'lime juice':'lime juice', 'orange juice':'orange juice',
  'lemon zest':'lemon zest', 'lime zest':'lime zest', 'orange zest':'orange zest',
  // Pepper (spice) — consolidate to "black pepper"
  'cracked pepper':'black pepper', 'cracked black pepper':'black pepper',
  'ground pepper':'black pepper', 'ground black pepper':'black pepper',
  'freshly cracked pepper':'black pepper', 'freshly ground pepper':'black pepper',
  'freshly ground black pepper':'black pepper',
  // Salt — all variants → "salt" (interchangeable at the store)
  'kosher salt':'salt', 'sea salt':'salt', 'fine salt':'salt',
  'flaky salt':'salt', 'table salt':'salt', 'coarse salt':'salt', 'iodized salt':'salt',
  // Broth / stock — canonical is "<X> broth" (consumer-facing label)
  'chicken stock':'chicken broth', 'chicken broth/stock':'chicken broth',
  'vegetable stock':'vegetable broth', 'vegetable broth/stock':'vegetable broth',
  'beef stock':'beef broth', 'beef broth/stock':'beef broth',
  'seafood stock':'fish stock',
  // Oils — all olive oil variants → "olive oil"; avocado oil stays specific
  'extra virgin olive oil':'olive oil', 'extra-virgin olive oil':'olive oil',
  'virgin olive oil':'olive oil', 'evoo':'olive oil', 'e.v.o.o':'olive oil',
  'vegetable oil':'neutral oil', 'canola oil':'neutral oil', 'grapeseed oil':'neutral oil',
  // Rice — kept specific (jasmine, basmati, sushi are distinct products at the store)
  // Dairy — unsalted butter = default "butter"; salted and vegan stay distinct
  'unsalted butter':'butter',
  'sour cream or creme fraiche':'sour cream', 'sour cream or crème fraîche':'sour cream',
  'creme fraiche':'sour cream', 'crème fraîche':'sour cream',
  'greek yogurt':'plain greek yogurt', 'plain yogurt':'plain greek yogurt',
  'whole milk mozzarella':'mozzarella',
  // NOTE: 'shredded mozzarella' / 'grated parmesan' aliases removed — consumer
  // needs to know it's pre-grated/shredded vs block at the store
  // Per Rafi: bare "parmesan" should always display as "parmesan cheese"
  'parmesan':'parmesan cheese',
  'parmigiano reggiano':'parmesan', 'pecorino romano':'parmesan',
  'heavy whipping cream':'heavy cream', 'whipping cream':'heavy cream',
  'mexican cheese blend':'mexican cheese', 'colby jack':'mexican cheese',
};

// ── Number helpers ─────────────────────────────────────────────────────────────

const STD_FRACS = [
  { val:1/8,  sym:'⅛' }, { val:1/4,  sym:'¼' }, { val:1/3, sym:'⅓' },
  { val:3/8,  sym:'⅜' }, { val:1/2,  sym:'½' }, { val:5/8, sym:'⅝' },
  { val:2/3,  sym:'⅔' }, { val:3/4,  sym:'¾' }, { val:7/8, sym:'⅞' },
];

function nearestFrac(frac: number): { val: number; sym: string } | null {
  let best: { val: number; sym: string } | null = null, bestDiff = Infinity;
  for (const f of STD_FRACS) {
    const d = Math.abs(frac - f.val);
    if (d < bestDiff) { bestDiff = d; best = f; }
  }
  return (best && frac > 0 && bestDiff / frac <= 0.08) ? best : null;
}

export function fmtNum(n: number): string {
  if (!n) return '0';
  const whole = Math.floor(n);
  const frac = parseFloat((n - whole).toFixed(6));
  if (frac < 0.005) return String(whole);
  const f = nearestFrac(frac);
  if (f) return whole > 0 ? `${whole} ${f.sym}` : f.sym;
  const dec = n.toFixed(1);
  return dec.endsWith('.0') ? String(Math.round(n)) : dec;
}

function normalizeWeight(qty: number, unit: string): { qty: number; unit: string } {
  if (unit === 'oz' && qty >= 16) {
    const lbs = qty / 16;
    const whole = Math.floor(lbs);
    const frac = parseFloat((lbs - whole).toFixed(6));
    if (frac < 0.005) return { qty: whole, unit: 'lb' };
    const f = nearestFrac(frac);
    if (f) return { qty: whole + f.val, unit: 'lb' };
    return { qty: Math.round(lbs * 10) / 10, unit: 'lb' };
  }
  return { qty, unit };
}

function normalizeVolume(qty: number, unit: string): { qty: number; unit: string }[] {
  if (unit === 'tsp' && qty >= 3) {
    const tbsps = Math.floor(qty / 3);
    const remTsp = Math.round((qty - tbsps * 3) * 10) / 10;
    if (remTsp < 0.05) return [{ qty: tbsps, unit: 'tbsp' }];
    return [{ qty: tbsps, unit: 'tbsp' }, { qty: remTsp, unit: 'tsp' }];
  }
  if (unit === 'tbsp' && qty >= 16) {
    const cups = Math.floor(qty / 16);
    const remTbsp = Math.round((qty - cups * 16) * 10) / 10;
    if (remTbsp < 0.05) return [{ qty: cups, unit: 'cup' }];
    return [{ qty: cups, unit: 'cup' }, { qty: remTbsp, unit: 'tbsp' }];
  }
  if (unit === 'tbsp' && qty >= 4) {
    const cupFrac = qty / 16;
    if (cupFrac < 1) {
      const f = nearestFrac(cupFrac);
      if (f && Math.abs(cupFrac - f.val) / cupFrac <= 0.04) return [{ qty: f.val, unit: 'cup' }];
    }
  }
  return [{ qty, unit }];
}

// ── Qty parser ─────────────────────────────────────────────────────────────────

function parseQty(str: string): number {
  for (const [k, v] of Object.entries(FRACTION_MAP)) str = str.split(k).join(v);
  str = str.trim();
  // Mixed-number range: "1 1/2-2 lbs" → use lower (1 1/2)
  let m = str.match(/^(\d+)\s+(\d+)\/(\d+)\s*[-–]\s*\d/);
  if (m) return parseInt(m[1]) + parseInt(m[2]) / parseInt(m[3]);
  // Plain mixed number: "1 1/2"
  m = str.match(/^(\d+)\s+(\d+)\/(\d+)/);
  if (m) return parseInt(m[1]) + parseInt(m[2]) / parseInt(m[3]);
  // Fraction range: "1/2-1" or "1/4-1/3" → use lower (left side)
  m = str.match(/^(\d+)\/(\d+)\s*[-–]\s*\d/);
  if (m) return parseInt(m[1]) / parseInt(m[2]);
  // Plain fraction: "1/2"
  m = str.match(/^(\d+)\/(\d+)/);
  if (m) return parseInt(m[1]) / parseInt(m[2]);
  // Decimal range: "1.5-2.5" → use lower (was midpoint, but per Rafi lower is more
  // conservative for nutrition so we don't overcount calories)
  m = str.match(/^(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/);
  if (m) return parseFloat(m[1]);
  // Plain decimal/integer
  m = str.match(/^(\d+\.?\d*)/);
  if (m) return parseFloat(m[1]);
  return 0;
}

// ── Main parser ────────────────────────────────────────────────────────────────

// ── Serving note detector ─────────────────────────────────────────────────────
// Extracts "to garnish" / "to serve" / "to top" from raw ingredient strings
// BEFORE stop-word stripping so the note isn't lost.
const NOTE_PATTERNS: Array<{ re: RegExp; note: string }> = [
  { re: /\bfor\s+garnish(?:ing)?\b/i,                     note: 'to garnish' },
  { re: /\bfor\s+topping\b/i,                             note: 'to garnish' },
  { re: /\bfor\s+serv(?:ing|e)\b/i,                       note: 'to serve'   },
  { re: /\bto\s+serve\b/i,                                note: 'to serve'   },
  { re: /\bto\s+garnish\b/i,                              note: 'to garnish' },
  { re: /\bto\s+top\b/i,                                  note: 'to garnish' },
  // "avocado, diced, for" / "lime wedges for" — trailing "for" = for garnish
  { re: /\b(?:diced|sliced|wedges?|strips?|julienned)\s+for\s*$/i, note: 'to garnish' },
  { re: /\bfor\s*$/i,                                     note: 'to garnish' },
];

export function extractServingNote(raw: string): string | undefined {
  for (const { re, note } of NOTE_PATTERNS) {
    if (re.test(raw)) return note;
  }
  return undefined;
}

export function parseIngredient(raw: string): {
  qty: number; unit: string; name: string; category: string; raw: string; note?: string;
} {
  if (!raw) return { qty: 0, unit: '', name: '', category: 'pantry-staples', raw };
  let str = raw.trim();

  // Extract serving note BEFORE stop-word stripping so it isn't lost
  const note = extractServingNote(str);

  // 0-pre. Skip rows that aren't real ingredients:
  //   - Section headers ("For the dressing:", "Sauce:", "FOR THE MEATBALLS")
  //   - Sub-recipe references ("5-minute Enchilada Sauce", "Homemade Tomato Sauce")
  //   - Stray sentences ("I use this scale.")
  {
    const trimmed = str.trim();
    // Section header (with or without colon, lower or upper case)
    if (/^(?:for\s+the\s+)?[a-z\s]+:?\s*$/i.test(trimmed) && /^[A-Z\s]+:?$/.test(trimmed)) {
      return { qty: 0, unit: '', name: '', category: 'pantry-staples', raw, note };
    }
    if (/^(?:for\s+the\s+)?[a-z\s]+:\s*$/i.test(trimmed)) {
      return { qty: 0, unit: '', name: '', category: 'pantry-staples', raw, note };
    }
    // Sub-recipe reference: "N-minute <Name>", "Homemade <Name>", "<X> Sauce, below"
    if (/^\d+\s*-\s*(?:minute|min)\s+[A-Z]/.test(trimmed)) {
      return { qty: 0, unit: '', name: '', category: 'pantry-staples', raw, note };
    }
    // More sub-recipe ref forms — "<X> recipe", "<X> recipe (below)", "<X> recipe (link below)",
    // "<X>, below", "<X>, above", "PWWB BBQ Dry Rub, below", "1 batch <X>"
    if (/\brecipe\b\s*(?:\(|$)/i.test(trimmed)) {
      return { qty: 0, unit: '', name: '', category: 'pantry-staples', raw, note };
    }
    if (/,\s*(?:below|above|link\s+below|see\s+below|see\s+above)\s*\.?\s*$/i.test(trimmed)) {
      return { qty: 0, unit: '', name: '', category: 'pantry-staples', raw, note };
    }
    if (/^\d+\s+batch(?:es)?\s+/i.test(trimmed)) {
      return { qty: 0, unit: '', name: '', category: 'pantry-staples', raw, note };
    }
    // "<X> marinade" / "<X> dressing" with no qty/unit — usually a recipe-specific
    // sub-recipe reference. Note: "<X> dry rub" / "<X> seasoning" / "<X> spice blend"
    // are NOT skipped — those are commonly real packaged ingredients (jerk seasoning,
    // taco seasoning, italian seasoning, etc.).
    if (/^[A-Z][a-z]+(?:\s+[a-z]+)?\s+(?:marinade|dressing)\s*\.?\s*$/i.test(trimmed)) {
      return { qty: 0, unit: '', name: '', category: 'pantry-staples', raw, note };
    }
    // Cooking-instruction lines that got mixed in with ingredients —
    //   "Preheat the oven at 250°C or 480°F."
    //   "Add the coconut milk, vegetable stock and all the baked ingredients..."
    //   "Heat the pan over medium high heat."
    //   "Bring water to a boil."
    if (/^(?:preheat|heat|add\s+the|mix|combine|stir|cook|bake|bring|place|remove|drain|reduce|simmer|serve|whisk|pour|sprinkle|garnish|brush|sauté|chop|peel|wash|rinse|set\s+aside|let\s+rest|let\s+cool|cool\s+(?:slightly|completely)|allow\s+to)\s+/i.test(trimmed)) {
      return { qty: 0, unit: '', name: '', category: 'pantry-staples', raw, note };
    }
    // "Make the X" / "Prepare the Y" / "Use X for Z" — recipe-author prep
    // sentences that got pasted into the ingredient list. Skip.
    if (/^(?:make|prepare|use)\s+(?:the\s+|our\s+|your\s+)?\w+/i.test(trimmed) && /\b(?:marinade|sauce|dressing|rub|seasoning|mixture|below|above)\b/i.test(trimmed)) {
      return { qty: 0, unit: '', name: '', category: 'pantry-staples', raw, note };
    }
    // "Optional: any of your other favorite X" / "any of your favorite X" — vague, skip
    if (/^(?:optional\s*[:.\-—]\s*)?any\s+of\s+your\s+(?:other\s+)?favorite\b/i.test(trimmed)) {
      return { qty: 0, unit: '', name: '', category: 'pantry-staples', raw, note };
    }
    // "Any of these X" / "Any of those X" — vague placeholder, skip.
    if (/^any\s+of\s+(?:these|those|the)\b/i.test(trimmed)) {
      return { qty: 0, unit: '', name: '', category: 'pantry-staples', raw, note };
    }
    // "Any other X you'd like to add" / "Any other X you'd like" — vague placeholder, skip.
    // Pre-decode HTML entity for apostrophe (&#39; = ') so the regex catches the
    // common recipe-author "you'd" form.
    {
      const decoded = trimmed.replace(/&#(?:39|x27);|&apos;/gi, "'");
      if (/^any\s+(?:other\s+)?\w+\s+you(?:'?d|'?ll)?\s+like\s+to\b/i.test(decoded)) {
        return { qty: 0, unit: '', name: '', category: 'pantry-staples', raw, note };
      }
    }
    // Stray "I use X" sentences (not preceded by a real ingredient)
    if (/^I\s+(?:use|have|recommend|like|love)\s+/i.test(trimmed) && trimmed.length < 50) {
      return { qty: 0, unit: '', name: '', category: 'pantry-staples', raw, note };
    }
    // Skip lines that are only dashes/em-dashes/whitespace (recipe-section
    // separators that got entity-decoded to dashes).
    if (/^[\s\-–—]+$/.test(trimmed)) {
      return { qty: 0, unit: '', name: '', category: 'pantry-staples', raw, note };
    }
    // Skip "For the X:" / "For X:" recipe-section headers
    if (/^for\s+(?:the\s+)?[\w\s-]+:\s*\*?$/i.test(trimmed)) {
      return { qty: 0, unit: '', name: '', category: 'pantry-staples', raw, note };
    }
    // Skip lone "Boiling water" / "Hot water" / "Cold water" — instructions, not ingredients
    if (/^(?:boiling|hot|cold|warm)\s+water\s*\.?\s*$/i.test(trimmed) && trimmed.length < 30) {
      return { qty: 0, unit: '', name: '', category: 'pantry-staples', raw, note };
    }
  }

  // 0-fix-typos. Common spelling/punctuation fixes that break downstream parsing.
  // Always normalize these even if the recipe author left them broken.
  str = str
    .replace(/\bhandfull\b/gi, 'handful')        // common typo
    .replace(/\bhandfulls\b/gi, 'handfuls')
    // "<N>% lean ground X" → "ground X" (fat% irrelevant for shopping)
    .replace(/\b\d+\s*%\s+lean\s+ground\s+/gi, 'ground ')
    // "a few" / "few" as a count → 2 (matches user spec for sprigs/etc.)
    .replace(/^a\s+few\s+/i, '2 ')
    .replace(/^few\s+/i, '2 ')
    // Pre-insert a space between letter+digit when smushed (recipe authors
    // sometimes paste "2 eggs2-3 garlic" with no space). Decode HTML fraction
    // entities first so &frac14;/&frac12; aren't split into "frac 14" / "frac 12".
    .replace(/&frac14;/g, '¼').replace(/&frac12;/g, '½').replace(/&frac34;/g, '¾')
    .replace(/&#(?:8211|8212);/g, '-')
    .replace(/([a-z])(\d)/gi, '$1 $2')
    // Hyphenated "freshly-cracked" / "fresh-cracked" / "fresh-ground" — these are
    // prep-method modifiers, not product descriptors. Strip the hyphenated word
    // entirely so it doesn't merge with adjacent stop-word strips.
    //   "fresh-cracked black pepper"  →  "black pepper"
    //   "freshly-ground black pepper" →  "black pepper"
    .replace(/\b(?:freshly|fresh)[\s-]+(?:cracked|ground|grated|chopped|squeezed|picked)\b/gi, '')
    // "half and half" — preserve through stop-word filter (which strips "and")
    .replace(/\bhalf\s+and\s+half\b/gi, 'half-and-half')
    // Normalize multi-word fat descriptors so "fat" isn't stripped mid-phrase by
    // PREP_WORDS_SINGLE, and so the stop-word filter can preserve them as a unit.
    //   "full fat coconut milk"  →  "full-fat coconut milk"
    //   "low fat yogurt"         →  "low-fat yogurt"
    .replace(/\b(full|low|non|reduced)\s+fat\b/gi, '$1-fat')
    .replace(/\bfat\s+free\b/gi, 'fat-free')
    .replace(/\bred[\s-]+pepper(\s+flakes?)\b/gi, 'red pepper$1')  // "red-pepper" → "red pepper"
    .replace(/\bblack[\s-]+pepper\b/gi, 'black pepper')
    .replace(/\bwhite[\s-]+pepper\b/gi, 'white pepper')
    // Fix "1/ 4" → "1/4" (stray space inside fraction)
    .replace(/(\d)\/\s+(\d)/g, '$1/$2')
    .replace(/(\d)\s+\/(\d)/g, '$1/$2')
    // "1 and 1/2" → "1 1/2" (drop "and" inside mixed numbers)
    .replace(/(\d)\s+and\s+(\d+\/\d+)/g, '$1 $2')
    // "X oz/Y g" or "X oz / Y g" — drop the metric equivalent after slash
    //   "7oz/200g broccolini" → "7oz broccolini"
    //   "3.5oz/100g creamy blue cheese" → "3.5oz creamy blue cheese"
    .replace(/(\d+(?:\.\d+)?\s*(?:oz|ounce|lb|pound)s?)\s*\/\s*\d+(?:\.\d+)?\s*(?:g|gram|kg)s?\b/gi, '$1')
    // Same in reverse: "200g/7oz" → drop the gram form, keep oz
    .replace(/\d+(?:\.\d+)?\s*(?:g|gram|kg)s?\s*\/\s*(\d+(?:\.\d+)?\s*(?:oz|ounce|lb|pound)s?)\b/gi, '$1')
    // Multiple consecutive spaces → single space
    .replace(/\s{2,}/g, ' ');
  // "((About N-M lbs.))" — extract the lbs value as canonical qty (use lower bound)
  // BEFORE the generic double-paren strip eats it.
  //   "Organic whole chicken ((About 5-10 lbs. is perfect; See Notes))"
  //     → "5 lb Organic whole chicken" (then qty=5, unit=lb after standard parse)
  {
    const aboutLbsM = str.match(/\(\(?\s*about\s+(\d+)(?:\s*[-–]\s*\d+)?\s*lbs?\.?\s*[^)]*\)\)?/i);
    if (aboutLbsM) {
      const stripped = str.replace(aboutLbsM[0], '').trim();
      str = `${aboutLbsM[1]} lb ${stripped}`;
    }
  }
  // Strip leading "About " (recipe author hedge)
  str = str.replace(/^about\s+/i, '').trim();
  // "<N> <size> or <N> <size> <unit>" — alternative count phrase. Take the first
  // count + the trailing unit.
  //   "1 large or 2 small bunches kale" → "1 bunches kale"
  str = str.replace(
    /^(\d+)\s+(?:large|small|medium|big)\s+or\s+\d+\s+(?:large|small|medium|big)\s+(\w+)/i,
    '$1 $2'
  );
  // "half of a small/large/medium X" / "half a X" → "1/2 X"
  str = str.replace(/^half\s+(?:of\s+)?(?:a\s+|an\s+)?(?:small\s+|large\s+|medium\s+|big\s+)?/i, '1/2 ').trim();
  // "Finely grated zest and juice of <N> <citrus>" → "<N> <citrus>"
  str = str.replace(/^(?:finely\s+|coarsely\s+)?grated\s+zest\s+(?:and\s+)?(?:juice\s+(?:of\s+)?)?(?=\d|one|two|a\b|an\b|half)/i, '');
  // "Zest and juice of <N> <citrus>" → "<N> <citrus>" (no "grated" prefix)
  str = str.replace(/^zest\s+(?:and|&)\s+juice\s+of\s+(?=\d|one|two|a\b|an\b|half)/i, '');
  // "<N> <citrus>, grated zest and N tablespoons juice" → "<N> <citrus>"
  // (recipe author calls for both zest and juice from same fruit — just buy the fruit)
  str = str.replace(/^(\d+(?:\s*\d+\/\d+)?\s+(?:lemons?|limes?|oranges?|grapefruits?))\s*,\s*(?:finely\s+|coarsely\s+)?grated\s+zest\s+and\s+\d+(?:\s+to\s+\d+)?\s+(?:tablespoons?|tbsp|teaspoons?|tsp)\s+juice\b.*$/i, '$1');
  // "<N> <citrus>, zested and juiced" / "zest and juice of N <citrus>" simplification
  str = str.replace(/^(\d+(?:\s*\d+\/\d+)?\s+(?:lemons?|limes?|oranges?))\s*,\s*zested\s+and\s+juiced\b.*$/i, '$1');
  // "<N> <leek/scallion>, white and pale green parts only" → "<N> <leek>"
  // Also covers "white and green parts thinly sliced" (no "only") for scallions.
  str = str.replace(/,\s*(?:white\s+(?:and\s+(?:pale\s+|light\s+)?green\s+)?parts?(?:\s+only)?|(?:pale\s+|light\s+)?green\s+parts?(?:\s+only)?|tops?\s+only)\b.*$/i, '').trim();
  // ", soaked for X minutes/hours…" / ", soaked overnight" prep instruction — strip
  str = str.replace(/,\s*soaked\s+(?:for\s+\w+(?:\s+\w+)?|overnight|in\s+\w+).*$/i, '').trim();
  // " - I used <X>" / " - I use <Y>" trailing recipe-author note — strip everything after
  //   "Poultry Seasoning - I used McCormick which includes thyme..." → "Poultry Seasoning"
  str = str.replace(/\s*[-–—]\s*I\s+(?:used|use|like|recommend|prefer)\b.*$/i, '').trim();
  // Multi-word trailing prep clause after comma — strip ENTIRE clause to end.
  // Catches: ", sliced thin", ", coarsely chopped", ", finely minced", ", smashed",
  //          ", scaled & gutted", ", cleaned", ", thinly sliced", ", more to taste"
  str = str.replace(
    /,\s*(?:thinly|thickly|finely|coarsely|roughly|rough|loosely|small|large|medium)?\s*(?:sliced|chopped|minced|diced|grated|crushed|smashed|pressed|peeled|halved|quartered|cubed|julienned|torn|whisked|beaten|squeezed|trimmed|cleaned|rinsed|patted|scrubbed|scaled|gutted|cracked|cooked|warmed|toasted|quartered\s+lengthwise)\b[^,)]*$/i,
    ''
  ).trim();
  // Trailing "& <prep>" / "and <prep>" right after a stripped clause
  str = str.replace(/\s*[&]\s*(?:scaled|gutted|cleaned|trimmed|peeled)\s*$/i, '').trim();
  // ", more to taste" / ", more if needed" / orphan ", more" — strip
  str = str.replace(/,\s*more\s+(?:to\s+taste|if\s+needed|as\s+needed).*$/i, '').trim();
  str = str.replace(/,?\s+more\s*,?\s*$/i, '').trim();
  // ", plus more …" / ", plus <X> for serving|garnish|as needed" — strip the
  // entire trailing clause (recipe author offering an extra portion).
  //   "1 tsp cumin, plus more for serving" → "1 tsp cumin"
  //   "3 tbsp basil, plus basil leaves for serving" → "3 tbsp basil"
  str = str.replace(/,\s*plus\s+(?:more|extra|[a-z][a-z\s]*)\s+(?:for\s+\w+|as\s+needed|to\s+taste|if\s+needed|to\s+\w+).*$/i, '').trim();
  str = str.replace(/,\s*plus\s+more\b.*$/i, '').trim();
  // ", room temperature" / ", at room temperature" / ", room temp" trailing
  str = str.replace(/,\s*(?:at\s+)?room\s+temp(?:erature)?\.?\s*$/i, '').trim();
  // Trailing "- optional" / "- optional!" with em-dash or hyphen
  str = str.replace(/\s*[-–—]\s*optional\!?\s*$/i, '').trim();
  // ", <noun>, or <noun>" alternative list (simple non-prep alt-list at end)
  //   "1 tsp brown sugar, maple, or honey" → "1 tsp brown sugar"
  str = str.replace(/,\s*\w+(?:\s+\w+)?,?\s+or\s+\w+(?:\s+\w+)?\s*$/i, '').trim();
  // "leaves and (tender|fine) stems" / "leaves and stems" → "" (drop entire
  // trailing herb-part clause; user prefers just "fresh cilantro" not "fresh
  // cilantro leaves").
  // SKIP when preceded by herb-leaf nouns where "leaves" is the ACTUAL ingredient
  // (bay leaves, curry leaves, lime leaves, kaffir leaves) — those need to keep
  // "leaves" as the noun.
  if (!/\b(?:bay|curry|lime|kaffir|grape|fig|cabbage|lettuce)\s+leaves?\s*$/i.test(str)) {
    str = str.replace(/\s+(?:leaves|leaf)(?:\s+and\s+(?:tender\s+|fine\s+|small\s+)?(?:stems?|roots?))?\s*$/i, '').trim();
  }
  // " and stems" / " and roots" / " and leaves" trailing on herbs — drop the alt
  // (recipe author specifying both halves of the herb; for shopping just buy the bunch).
  //   "fresh cilantro leaves and stems" → "fresh cilantro leaves"
  str = str.replace(/\b(leaves|stems|tops)\s+and\s+(?:leaves|stems|tops|roots)\b/i, '$1').trim();
  // Unwrap descriptor parens immediately following an adjective/prep word:
  //   "boneless, (skinless chicken breasts)"  → "boneless skinless chicken breasts"
  //   "1 ½ cups shredded (matchstick carrots)" → "1 ½ cups shredded matchstick carrots"
  // Pattern: after comma OR adjective, an opening paren whose content starts with
  // a known descriptor (skinless/bone-in/matchstick/pre-shredded/etc.) — drop the parens.
  str = str.replace(
    /(,?\s*(?:boneless|skinless|bone-in|matchstick|pre-shredded|shredded|cooked|chopped|sliced|diced|peeled))\s*,?\s*\(\s*((?:skinless|bone-in|boneless|matchstick|pre-shredded|shredded|cooked|chopped|sliced|diced|peeled|skin-on)\b[^)]*)\)/gi,
    (_, lead, inside) => `${lead.replace(/^,\s*/, ' ')} ${inside}`
  );
  // ", omit if X" / ", omit when X" — recipe-author conditional note — strip
  str = str.replace(/,\s*omit\s+(?:if|when)\b.*$/i, '').trim();
  // ", either X or Y" / ", either pre-packaged or sliced…" — alternative source list
  str = str.replace(/,\s*either\b[^,]*(?:or\b[^,]*)?(?:,[^,]*)*$/i, '').trim();
  // ", strings removed" / ", strings discarded" — produce prep instructions
  str = str.replace(/,\s*strings?\s+(?:removed|discarded|trimmed)\b.*$/i, '').trim();
  // "<noun>, <prep-list> or <prep>" — when the comma part is a prep-only list
  // ending with " or X" (e.g. "pressed or minced", "minced or grated"), strip it.
  str = str.replace(/,\s*(?:pressed|minced|chopped|grated|sliced|crushed|peeled|grated)(?:\s+or\s+(?:pressed|minced|chopped|grated|sliced|crushed|peeled|grated))+\b.*$/i, '').trim();
  // ", X or Y, <prep>" — alternative-list of substitutable proteins/ingredients
  // followed by a prep clause. Recipe author offering options; take first option only.
  //   "boneless pork chops, tenderloin or loin, thinly sliced" → "boneless pork chops"
  str = str.replace(/,\s*[a-z][a-z\s-]*\s+or\s+[a-z][a-z\s-]*,\s*(?:thinly|finely|coarsely|roughly)?\s*(?:sliced|chopped|diced|minced|grated)\b.*$/i, '').trim();
  // ", X or other Y" / ", X or any other Y" — alternative-list after comma; drop entirely
  //   "8 ounces baby arugula, spinach or other tender greens" → "8 ounces baby arugula"
  str = str.replace(/,\s*[a-z][^,]*\s+or\s+(?:any\s+)?(?:other|similar)\b.*$/i, '').trim();
  // ", ends/tops/stems/leaves/roots/skin <prep>…" trailing prep clause — strip
  //   "brussels sprouts, ends trimmed and sliced very thin using the slicer blade…" → "brussels sprouts"
  str = str.replace(/,\s*(?:ends?|tops?|stems?|leaves?|roots?|skins?|seeds?)\s+\w+.*$/i, '').trim();
  // ", rinsed under cold water" / ", washed under running water" / ", drained well"
  str = str.replace(/,\s*(?:rinsed|washed|drained|patted)\s+(?:under|with|in|well|dry)\b.*$/i, '').trim();
  // "Small chunk <X>" / "Chunk of <X>" → "<X>, for garnish"
  // (recipe author wrote "shave off a piece for garnish" intent).
  str = str.replace(/^(?:small\s+|large\s+)?chunk\s+(?:of\s+)?(.+)$/i, '$1, for garnish').trim();
  // "<N> ears of corn" → "<N> ears corn" (strip "of" so unit=ear, name=corn,
  // then piece-word reorder produces "<N> corn ears")
  str = str.replace(/^(\d+(?:\s+\d+\/\d+)?)\s+ears?\s+of\s+corn\b/i, '$1 ears corn');
  // ", shucked" / ", shucked raw" / ", husked" — strip ear-of-corn prep instructions
  str = str.replace(/,?\s*(?:shucked|husked)(?:\s+raw)?\b.*$/i, '').trim();
  // "(thinly|finely)? sliced or shaved" → "shredded" (recipe author's intent for
  // thin-cut cabbage/produce; consumer buys pre-shredded).
  str = str.replace(/\b(?:thinly|finely)?\s*sliced\s+or\s+shaved\b/gi, 'shredded').trim();
  // Strip "assorted" / "various" / "mixed" leading on herbs/produce — vague qualifier
  str = str.replace(/\bassorted\s+/gi, '').replace(/\bvarious\s+/gi, '');
  // ", fronds for garnish" / ", fronds discarded" — secondary part of same plant; strip
  str = str.replace(/,\s*fronds?\s+(?:for\s+\w+|discarded|reserved)\b.*$/i, '').trim();
  // "for stuffing" trailing instruction (not a real prep, just placement)
  str = str.replace(/\s+for\s+stuffing\b.*$/i, '').trim();
  // "<noun> from a can of <noun>" — recipe author repeats noun for emphasis; dedupe
  //   "chipotles from a can of chipotles in adobo" → "chipotles in adobo"
  str = str.replace(/\b(\w+)\s+from\s+a\s+can\s+of\s+\1\b/gi, '$1');
  // ", plus N <unit> <X>" trailing measurement add-on — strip
  //   "...adobo, plus 1 tbsp. adobo sauce" → "...adobo"
  str = str.replace(/,\s*plus\s+\d+(?:\/\d+)?\s+\w+\.?\s+[\w\s]+$/i, '').trim();
  // "whole fish (X, Y or Z)" → "whole <noun-of-X>". Take last word of first
  // alternative as the variety (drops color adjectives like "red snapper" → "snapper").
  //   "1 3lb whole fish (red snapper, branzino or seabass)" → "1 3lb whole snapper"
  str = str.replace(
    /\b(whole\s+)fish\s*\(\s*([\w]+(?:\s+[\w]+)?)\s*[,][^)]*\)/i,
    (_, lead: string, firstOpt: string) => {
      const tokens = firstOpt.trim().split(/\s+/);
      return `${lead}${tokens[tokens.length - 1]}`;
    }
  );
  // "rind of <N> <fruit>" / "<N> rind of <fruit>" / "<N> <fruit> rind" → "<N> <fruit>"
  // (rind quantity refers to the fraction of fruit needed — a recipe calling for
  // "1/2 rind of a preserved lemon" needs 1/2 of one preserved lemon).
  //   "rind of 1 preserved lemon"           → "1 preserved lemon"
  //   "rind of a lemon"                     → "1 lemon"
  //   "1/2 rind of a preserved lemon"       → "1/2 preserved lemon"
  //   "1/2 rind of 1 preserved lemon"       → "1/2 preserved lemon"
  str = str.replace(/^(\d+(?:\/\d+)?(?:\s+\d+\/\d+)?)\s+rind\s+of\s+(?:a\s+|an\s+|\d+\s+)?(?=[a-z])/i, '$1 ');
  str = str.replace(/^rind\s+of\s+(?:a\s+|an\s+)?(?=[a-z])/i, '1 ');
  str = str.replace(/^rind\s+of\s+(?=\d)/i, '');
  str = str.replace(/\s+rind\s*$/i, '').trim();
  // "medium-to-large" / "small-to-medium" / "small to large" hyphenated size descriptor
  // — strip; we don't track this granularity.
  str = str.replace(/\b(?:small|medium|large|big)(?:\s*-\s*to\s*-\s*|\s+to\s+|\s*-\s*)(?:small|medium|large|big)\b/gi, '').trim();
  // ", clean of any dirt" / ", cleaned of dirt" / "scrubbed clean" trailing instructions
  str = str.replace(/,?\s*(?:clean(?:ed)?\s+of\s+(?:any\s+)?dirt|scrubbed\s+clean)\s*$/i, '').trim();
  // "from a can of X" / "from a jar of X" / "from a Y" trailing descriptor — strip
  //   "drained from a can of chickpeas" → "drained"
  str = str.replace(/,?\s*from\s+(?:a|an|the)\s+(?:can|jar|tin|bottle|box|package|pouch)\s+of\s+[a-z][^,]*$/i, '').trim();

  // 0. Decode HTML entities FIRST so downstream regexes (salt+pepper, etc.)
  // see decoded characters like "&" instead of "&amp;".
  str = str
    .replace(/\xa0/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(?:39|8217|8216|x27);|&apos;/gi, "'")
    .replace(/&#(?:8220|8221|8243);|&quot;/gi, '"')
    .replace(/&#8211;/g, '-').replace(/&#8212;/g, ' - ')
    .replace(/&frac14;/g, '¼').replace(/&frac12;/g, '½').replace(/&frac34;/g, '¾')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, '').replace(/&[a-z]+;/gi, '')
    .replace(/\*/g, '')
    .replace(/\s*\(\*[^)]*\)/g, '')
    .trim();

  // 0a. Normalize salt+pepper compound variations to canonical "salt + pepper"
  // Handles: "salt and pepper", "salt & pepper", "salt/pepper", "kosher salt and pepper",
  //          "sea salt and pepper", "salt and black pepper", "pepper and salt",
  //          "kosher salt freshly ground black pepper" (no explicit "and"), etc.
  //          Preserves "to taste" if present.
  {
    const lower = str.toLowerCase();
    const hasSalt   = /\bsalt\b/.test(lower);
    const hasPepper = /\bpepper\b/.test(lower);
    // Widened gap from 15 → 30 chars to catch "salt and freshly ground black pepper"
    const isCompound = hasSalt && hasPepper && /\bsalt\b[\s\w&+/,]{0,30}\bpepper\b|\bpepper\b[\s\w&+/,]{0,30}\bsalt\b/.test(lower);
    if (isCompound) {
      const toTaste = /to\s+taste|as\s+needed|to\s+season/i.test(str);
      str = toTaste ? 'salt + pepper, to taste' : 'salt + pepper';
    }
  }

  // (HTML decode moved up to step 0)
  str = str
    .replace(/\xa0/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(?:39|8217|8216|x27);|&apos;/gi, "'")
    .replace(/&#(?:8220|8221|8243);|&quot;/gi, '"')
    .replace(/&#8211;/g, '-').replace(/&#8212;/g, ' - ')
    .replace(/&frac14;/g, '¼').replace(/&frac12;/g, '½').replace(/&frac34;/g, '¾')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, '').replace(/&[a-z]+;/gi, '')
    .replace(/\*/g, '')
    .replace(/\s*\(\*[^)]*\)/g, '')
    .trim();

  // 1. Normalize unicode fractions
  // First: add a space between a digit and a unicode fraction so "1½" → "1 ½" before
  // replacing ½ → "1/2", which would otherwise turn "1½" into "11/2" (= 5.5 not 1.5).
  // Also normalize unicode fraction-slash U+2044 (⁄) to ASCII "/" so "1⁄2" parses.
  str = str.replace(/⁄/g, '/');
  str = str.replace(/(\d)([\u00BC-\u00BE\u2150-\u215E])/g, '$1 $2');
  for (const [k, v] of Object.entries(FRACTION_MAP)) str = str.split(k).join(v);
  str = str.trim();

  // 2. Strip parenthetical notes that are clearly recipe instructions, NOT purchase specs.
  // Keep: size/weight specs like "(1 1/2-inch-thick)", "(6 oz)", "(bone-in)"
  // Strip: recipe notes like "(see note)", "(Note 1)", double-parens
  str = str.replace(/\(\([^)]*\)\)/g, '').replace(/\(Note\s*\d*\)/gi, '').trim();
  // Nested paren "(noun) ((such as X or Y) Z)" — extract first alternative from
  // inner paren and prefix to the noun, then strip the whole outer paren.
  //   "potatoes ((such as Yukon or red potatoes) cut into 3/4-inch cubes)"
  //     → "Yukon potatoes"
  str = str.replace(
    /\b(\w+)\s*\(\(\s*such\s+as\s+(\w+)(?:\s+\w+)?\s+or\s+[^)]+\)[^)]*\)/gi,
    '$2 $1'
  );
  // Generic nested paren "((X) Y)" remnant — strip entirely if neither X nor Y is
  // a size/weight spec.
  str = str.replace(/\(\([^)]*\)[^)]*\)/g, '').trim();
  // Only strip long parens that contain letters suggesting a recipe note (e.g. "see", "page", "about")
  str = str.replace(/\((?:see|about|note|if|for|use|make|recipe)[^)]*\)/gi, '').trim();
  // Strip parens that start with "leaves of" / "stems of" / "tendrils" / etc. —
  // recipe-author clarification of ingredient parts, not a real spec.
  //   "(leaves of about 3 sprigs)" → strip
  //   "(tendrils)" → strip
  str = str.replace(/\(\s*(?:leaves|stems|tendrils|fronds|tops|roots|hot\s+house\s+cucumber)[^)]*\)/gi, '').trim();
  // Strip long author-note parens that begin with "I" / "you" / "we" or contain
  // first-person commentary like "have also used", "tried", "worked perfectly".
  //   "(I have also used cottage cheese it worked perfectly with my LF diet)" → strip
  str = str.replace(/\(\s*(?:I|i|you|You|we|We)\s+[^)]{20,}\)/g, '').trim();
  str = str.replace(/\([^)]*\b(?:worked\s+perfectly|tried\s+(?:it|this)|works\s+great|highly\s+recommend)\b[^)]*\)/gi, '').trim();

  // 2b. Detect serving / garnish / taste markers BEFORE stripping them.
  // The marker is surfaced as the "unit" so it shows in the qty column
  // instead of being lost ("lime wedges, to squeeze over the fajitas" →
  // qty="" unit="to serve" name="lime wedges").
  let servingMarker = '';
  // Em-dash + garnish suffix — rewrite to ", for garnish" so the serving-marker
  // detection below catches it: "Aleppo pepper- garnish (...)" → "Aleppo pepper, for garnish"
  // (also handles "to garnish" / "to serve" / "for serving" after em-dash)
  str = str.replace(/\s*[-–—]\s*(?:garnish|to\s+garnish|to\s+serve|for\s+serving)\b.*$/i, ', for garnish');
  // "Optional for serving: <X>" — explicit prefix, set marker + strip prefix
  // ("Optional for serving: crusty bread" → name="crusty bread", marker="to serve")
  {
    const optServM = str.match(/^optional\s+for\s+serving\s*[:.\-—]\s*(.+)$/i);
    if (optServM) {
      str = optServM[1].trim();
      servingMarker = 'to serve';
    }
  }
  // Mask paren content so serving-marker strips don't cross paren boundaries
  // (e.g. "(1 juiced and 1 cut into wedges for serving)" — the "for serving" is
  // inside a paren that should be stripped wholesale, not used as a marker).
  {
    const smParens: string[] = [];
    const masked = str.replace(/\([^)]*\)/g, m => { smParens.push(m); return 'XSM' + (smParens.length - 1) + 'X'; });
    const restore = (s: string) => s.replace(/XSM(\d+)X/g, (_, i) => smParens[parseInt(i, 10)] || '');
    let working = masked;
    if (/,?\s*(?:use\s+)?to\s+(?:your\s+)?taste\b|,?\s*as\s+needed\b/i.test(working)) {
      servingMarker = 'to taste';
      working = working.replace(/,?\s*(?:use\s+)?to\s+(?:your\s+)?taste\b.*/i, '').trim();
      working = working.replace(/,?\s*as\s+needed\b.*/i, '').trim();
    }
    else if (/,?\s*(?:for|to)\s+(?:garnish(?:ing)?|topping|top(?:ping)?)\b/i.test(working)) {
      servingMarker = 'to garnish';
      working = working.replace(/,?\s*(?:for|to)\s+(?:garnish(?:ing)?|topping|top(?:ping)?\s*(?:with)?)\b.*/i, '').trim();
    }
    else if (/,?\s*(?:for\s+serving|to\s+serve|(?:to|for)\s+(?:squeeze|drizzle|drizzling|spoon|pour|pouring)(?:\s+(?:over|on))?)\b/i.test(working)) {
      servingMarker = 'to serve';
      working = working.replace(/,?\s*(?:for\s+serving|to\s+serve|(?:to|for)\s+(?:squeeze|drizzle|drizzling|spoon|pour|pouring)(?:\s+(?:over|on))?)\b.*/i, '').trim();
    }
    str = restore(working);
  }

  // After serving-marker strip, clean up trailing orphan ", more" / "more"
  // left behind from ", more to taste" patterns:
  str = str.replace(/,\s*more\s*,?\s*$/i, '').trim();
  str = str.replace(/\s+more\s*$/i, '').trim();
  // Trailing ", plus X" leftover after step 2b stripped "for serving":
  //   "...basil, plus basil leaves" → "...basil"  (plus + repeat noun)
  //   "...cumin, plus more" → "...cumin"
  //   "...flakes, plus more" → "...flakes"
  str = str.replace(/,\s*plus\s+(?:more|extra|\w+(?:\s+\w+)?)\s*,?\s*$/i, '').trim();

  // 2c. Strip bare recipe-note suffixes (no parens around them):
  //     "chicken legs see notes above"  →  "chicken legs"
  //     "kosher salt preferably diamond crystal"  →  "kosher salt"
  //     "olive oil such as California Olive Ranch"  →  "olive oil"
  str = str.replace(/,?\s*see\s+notes?\s*(?:above|below|for\s+\w+)?\s*\.?$/i, '').trim();
  str = str.replace(/,?\s*preferably\b.*$/i, '').trim();
  // "such as <X>" — strip the suffix, but don't cross a closing paren (so we
  // don't eat the closing ")" of a "(any X, such as Y, Z)" parenthetical that's
  // about to be stripped wholesale by the (any X) regex below).
  // SPECIAL CASE: "<adj> herbs, such as <list>" — keep as "herbs (list)"
  //   "1 cup chopped soft herbs, such as cilantro, dill, mint or basil, or a combination"
  //     → "1 cup chopped herbs (cilantro, dill, mint, or basil)"
  // (Recipe author allows flexibility — preserve the option list as a parenthetical.)
  // Strips: vague "soft"/"tender"/"mixed"/"fresh" adjective on "herbs",
  //         trailing ", or a combination" / ", or some combo".
  // 2-or-more herbs in such-as → preserve as paren list.
  // Single herb → "fresh <herb>".
  str = str.replace(
    /\b(?:tender\s+|soft\s+|mixed\s+|fresh\s+)?herbs?\b\s*,?\s*such\s+as\s+([a-z][a-z,\s]*?(?:\s+or\s+[a-z]+)?)(?:,\s*or\s+(?:a\s+|some\s+)?combination[a-z\s]*)?\.?\s*$/i,
    (_, list: string) => {
      // Normalize the list: split by comma/and/or, dedupe, filter empties
      const items = list
        .split(/\s*,\s*|\s+(?:and|or)\s+/i)
        .map(s => s.trim().replace(/[^a-z\s]/gi, ''))
        .filter(s => s.length > 1);
      if (items.length === 0) return 'fresh herbs';
      if (items.length === 1) return `fresh ${items[0]}`;
      const last = items[items.length - 1];
      const head = items.slice(0, -1).join(', ');
      return `herbs (${head}, or ${last})`;
    }
  );
  str = str.replace(/,?\s*such\s+as\b[^)]*(?:$|(?=\)))/i, '').trim();
  str = str.replace(/,?\s*ideally\b.*$/i, '').trim();
  str = str.replace(/,?\s*or\s+any\s+(?:other|similar)\b.*$/i, '').trim();
  str = str.replace(/,?\s*depending\s+on\b.*$/i, '').trim();
  str = str.replace(/,?\s*plus\s+(?:more|extra)\b.*$/i, '').trim();
  // "<X> paste/marinade" — take first option of slash alternatives in name
  str = str.replace(/\b(paste|sauce|powder|spread)\/(?:marinade|sauce|spread|seasoning)\b/gi, '$1');
  // Strip trailing modifiers like ", premium" / ", organic" / ", store-bought" /
  // ", homemade" / ", natural" — recipe-author labels not relevant to shopping
  str = str.replace(/,\s*(?:premium|organic|store-bought|homemade|natural|pure|raw|cold-pressed|extra\s+virgin)\s*\.?\s*$/i, '').trim();
  str = str.replace(/,?\s*at\s+room\s+temperature\b.*$/i, '').trim();
  str = str.replace(/,?\s*to\s+room\s+temperature\b.*$/i, '').trim();
  // Abbreviated "room temp." form
  str = str.replace(/,?\s*(?:at|to)\s+room\s+temp\.?\s*$/i, '').trim();
  // "Organic" prefix on whole proteins (recipe-author marketing label)
  str = str.replace(/^organic\s+/i, '').trim();
  // Em-dash + prep instruction trailing: "5 cloves garlic- grated, pressed or minced"
  // REQUIRES space or comma before the dash so it doesn't match hyphenated words
  // like "freshly-grated" / "fire-roasted" mid-name.
  str = str.replace(/(?:[\s,])[-–—]\s*(?:grated|pressed|minced|chopped|sliced|diced|crushed|peeled|halved|quartered|cubed)(?:[\s,]|$).*$/i, '').trim();
  // (Em-dash + serving marker rewrite moved to step 2b — before serving-marker
  //  detection — so the rewritten ", for garnish" actually gets picked up.)
  // Strip ", NOT just X" recipe-author hedge ("wild rice blend, NOT just wild rice")
  str = str.replace(/,?\s*NOT\s+just\b.*$/i, '').trim();
  // Strip trailing "for brushing" / "for cooking" / "for searing" / "for sautéing" instructions
  // Limit to NOT cross close-paren so we don't eat ")" of an enclosing paren.
  str = str.replace(/,?\s+for\s+(?:brushing|cooking|searing|saut[ée]ing|frying|sprinkling|coating|dredging)\b[^)]*$/i, '').trim();
  // Strip ", pips discarded" / ", seeds removed" / ", core removed" / "flesh and skin chopped"
  str = str.replace(/,\s*pips?\s+discarded\b.*$/i, '').trim();
  str = str.replace(/,\s*seeds?\s+(?:removed|discarded)\b.*$/i, '').trim();
  str = str.replace(/,\s*(?:core|stem|skin|peel|flesh\s+and\s+skin)\s+(?:removed|discarded|chopped|sliced|peeled)\b.*$/i, '').trim();
  // Strip trailing "then <prep>" — "zested then halved" → strip from "then"
  str = str.replace(/\s+then\s+\w+(?:\s+\w+)?\s*$/i, '').trim();
  // "<count> <citrus>: <stuff>" — colon after citrus name kills everything after
  str = str.replace(/^(\d+\s+(?:lemons?|limes?|oranges?))\s*:\s*.+$/i, '$1');
  // (Cheese-list strip moved later — needs to run after yield-note paren strip
  //  so "(8 ounces)" is gone before we try to match "cheese – cotija" pattern)
  // "Optional:" prefix on individual ingredient lines (not garnish list — that's
  // pre-stripped in the splitter)
  str = str.replace(/^optional\s*[:.\-—]\s*/i, '').trim();
  // "as desired" / "or to taste" / "to your liking" suffixes
  str = str.replace(/,?\s*as\s+desired\b.*$/i, '').trim();
  str = str.replace(/,?\s*to\s+your\s+liking\b.*$/i, '').trim();
  // "(or any X like A, B, C)" / "(or X)" parenthetical alternatives — strip
  // ("1/2 lb linguini (or any long noodles like fettuccini, spaghetti, etc.)" → "1/2 lb linguini")
  str = str.replace(/\s*\(\s*or\s+(?:any\s+)?[^)]+\)/gi, '').trim();
  // "<adj> or <adj> <plural-noun>" → "<adj> <noun>" (take first option, keep
  // trailing noun, singularize). Handles forms like:
  //   "yukon gold or red potatoes"   → "yukon gold potatoes"
  //   "russet or yukon potatoes"     → "russet potatoes"
  //   "red or yellow onions"         → "red onions"
  // Restricted to a known set of produce/protein nouns so we don't accidentally
  // collapse legitimate "X or Y" prep instructions.
  str = str.replace(
    /\b([a-z]+(?:\s+[a-z]+)?)\s+or\s+[a-z]+(?:\s+[a-z]+)?\s+(potatoes?|onions?|peppers?|tomatoes?|apples?|pears?|squashes?|beans?|lentils?|carrots?|chiles?|chilies|peaches?|plums?|olives?|capers?|nuts?|seeds?|mushrooms?|greens?|berries|cucumbers?|radishes|leeks?)\b/gi,
    '$1 $2'
  );
  // "(any X, such as A, B, C)" — alternatives without "or" prefix
  //   ("2 tablespoons oil (any neutral oil, such as canola, vegetable, peanut, etc.)" → "2 tablespoons oil")
  str = str.replace(/\s*\(\s*any\s+\w+[^)]*\)/gi, '').trim();
  // "from stem" prep instruction leftover
  str = str.replace(/,?\s*from\s+stem\b.*$/i, '').trim();
  // Strip "trimmed of <X>" / "trimmed of big hunks of fat" / etc.
  str = str.replace(/,?\s*trimmed\s+of\b.*$/i, '').trim();
  // "N servings <X>" — drop the "N servings" prefix; set servingMarker if not yet set
  // ("2 servings steamed white rice" → "white rice" with "to serve" marker)
  {
    const servM = str.match(/^(\d+)\s+servings?\s+/i);
    if (servM) {
      str = str.slice(servM[0].length).trim();
      if (!servingMarker) servingMarker = 'to serve';
    }
  }
  // Strip "(N–M oz each)" / "(N oz each)" — recipe author's per-piece weight
  // note. Lose the parens (we keep the count from the qty extraction).
  str = str.replace(/\s*\(\s*\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?\s*(?:oz|ounce|g|gram)s?\s+each\s*\)/gi, '').trim();
  // "<count> <fraction-num> <fraction-denom>-ounce can <X>" pattern
  // ("1 13 1/2-ounce can unsweetened coconut milk" → "13.5 ounce can unsweetened coconut milk")
  // Replace count + space-separated mixed-number-oz with just the oz value.
  str = str.replace(/^(\d+)\s+(\d+)\s+(\d+)\/(\d+)\s*-\s*(?:oz|ounce)s?\b/i,
    (_, _count, whole, num, den) => `${parseInt(whole) + parseInt(num) / parseInt(den)} oz`);
  // (The "((About N lbs))" extraction was moved to the very top of parseIngredient
  //  so it runs before the double-paren strip eats it.)
  // "N (X-Y oz) filets/breasts/thighs Z" — "2 (6-8oz) filets center-cut salmon"
  // Pull the upper oz out as size annotation, reorder so the noun lands at the end:
  //   "2 (6-8oz) filets center-cut salmon" → "2 8 oz center-cut salmon filets"
  {
    const sizedFiletM = str.match(/^(\d+)\s+\(\s*(\d+(?:\.\d+)?)(?:\s*[-–]\s*(\d+(?:\.\d+)?))?\s*(?:oz|ounce)s?\.?\s*\)\s+(filets?|fillets?|breasts?|thighs?|cutlets?)\s+(.+)$/i);
    if (sizedFiletM) {
      const count = sizedFiletM[1];
      const oz = sizedFiletM[3] || sizedFiletM[2]; // upper or single
      const noun = sizedFiletM[4];
      const rest = sizedFiletM[5].trim();
      str = `${count} ${oz} oz ${rest} ${noun}`;
    }
  }
  // "N (X-Y oz) <rest>" — generic protein/seafood form (no required noun at start
  // of parens). Examples: "4 (6 oz.) wild lobster tails", "2 (4-6 ounces) wild-caught
  // Sockeye salmon". Produces "N (oz upper) oz <rest>" preserving count separately.
  // Strip common protein qualifier prefixes ("wild", "wild-caught", "organic").
  {
    const sizedProteinM = str.match(/^(\d+)\s+\(\s*(\d+(?:\.\d+)?)(?:\s*[-–]\s*(?:to\s+)?(\d+(?:\.\d+)?))?\s*(?:oz|ounce)s?\.?\s*\)\s+(.+)$/i);
    if (sizedProteinM) {
      const count = sizedProteinM[1];
      const oz = sizedProteinM[3] || sizedProteinM[2]; // upper or single
      let rest = sizedProteinM[4].trim()
        .replace(/^(?:wild-caught|wild\s+caught|wild|organic|fresh|frozen)\s+/i, '');
      // Only fire when rest looks like a real ingredient (has a noun-like word).
      // This guards against accidentally matching unrelated parens.
      if (rest && /[a-z]/i.test(rest)) {
        str = `${count} ${oz} oz ${rest}`;
      }
    }
  }
  // Strip "-or-so" colloquial qualifier ("3-or-so cups broccoli")
  str = str.replace(/[\s-]or[\s-]so\b/gi, ' ').trim();
  // Strip "juiced" / "zested" trailing prep word
  str = str.replace(/,?\s*(?:juiced|zested)(?:\s+and\s+(?:juiced|zested))?\s*$/i, '').trim();
  // "(from N-inch piece)" / "(from one N-inch piece)" — the parenthetical specifies
  // the source size; for ginger this is the actual purchase size.
  // "3 tablespoons minced fresh ginger (from one 3-inch piece)" → use "3-inch ginger"
  // (overrides the 3 tbsp qty).
  {
    const fromPieceM = str.match(/\(\s*from\s+(?:one|a|an|\d+)?\s*(\d+(?:\/\d+)?)\s*-?\s*inch\s+piece\s*\)/i);
    if (fromPieceM && /\bginger\b/i.test(str)) {
      // Replace the whole prefix with "<N> inch ginger"
      str = `${fromPieceM[1]} inch fresh ginger`;
    } else if (fromPieceM) {
      // Other ingredients — just strip the paren note
      str = str.replace(fromPieceM[0], '').trim();
    }
  }
  // Strip "(from N <citrus>)" — when paired with separate zest+juice mentions,
  // collapse to just "N <citrus>" (you buy the citrus, use both parts)
  {
    const fromCitrusM = str.match(/\(\s*from\s+(\d+|one|a|an)\s+(lemons?|limes?|oranges?)s?\s*\)/i);
    if (fromCitrusM) {
      const numWord: Record<string, number> = { one: 1, a: 1, an: 1 };
      const n = numWord[fromCitrusM[1].toLowerCase()] ?? parseInt(fromCitrusM[1], 10);
      const citrus = fromCitrusM[2].replace(/s$/i, '');
      str = `${n} ${citrus}`;
    }
  }
  // Strip generic recipe-note parens that don't contain measurement units:
  //   "(peeled and cut into 2-inch cubes)" / "(shelf-stable, fresh or frozen)" /
  //   "(Note 1)" / "(approx. 1/3 cup of lemon juice)" / "(divided)"
  // Keep parens with measurement specs like "(7-inch)" / "(15-oz.)".
  str = str.replace(/\s*\(\s*(?:partially\s+)?(?:peeled|cut|chopped|sliced|diced|minced|grated|halved|quartered|shelf[\s-]stable|fresh\s+or\s+frozen|divided|approx|approximately|see\s+notes?|note\s*\d*|cubed|crushed|drained|rinsed|give\s+or\s+take|yields?|sub\s|or\s+use)[^)]*\)/gi, '').trim();
  // Strip nested "(... (Note N))" double-paren
  str = str.replace(/\s*\(\(?Note\s*\d*\)?\)/gi, '').trim();
  // Re-run "juiced"/"zested" trailing strip AFTER parens are removed — the prior
  // strip ran before paren removal, so "lemons, juiced (approx ...)" wouldn't match.
  str = str.replace(/,?\s*(?:juiced|zested)(?:\s+and\s+(?:juiced|zested))?\s*$/i, '').trim();
  // When the leading qty has a volume/weight unit (cups, tbsp, tsp, lbs), strip
  // any subsequent paren-oz/g — those are recipe-author yield notes, not the
  // actual purchase quantity.
  //   "2 cups Shredded Chicken (10-12 ounces)" → strip "(10-12 ounces)" as note,
  //   keep "2 cups" as the actual qty.
  if (/^\d[\d\s.\/-]*\s*(?:cups?|tbsp|tablespoons?|tsp|teaspoons?|lbs?|pounds?)\b/i.test(str)) {
    str = str.replace(/\s*\(\s*\d+(?:\.\d+)?(?:\s*[-–]\s*(?:to\s+)?\d+(?:\.\d+)?)?\s*(?:oz|ounce|g|gram|lb|pound)s?\.?\s*\)/gi, '').trim();
  }
  // Strip "Use leftover X" / "Use X" / similar trailing recipe-author notes:
  //   "2 cups Shredded Chicken (10-12 ounces) Use leftover chicken, or use rotisserie chicken"
  //   "Use leftover chicken (rotisserie, baked, grilled, etc)"
  // Match optional trailing paren-clause too so the "Use X (Y, Z)" form is
  // fully stripped (the single-bracket [^)]* form would fail because the
  // trailing ")" prevents the $ anchor from matching).
  str = str.replace(/\s+use\s+(?:leftover\s+|cooked\s+)?[a-z][^()]*(?:\s*\([^)]*\))?\s*$/i, '').trim();
  // "shredded cheese – cotija, mozzarella, jack..." or "cheese – cotija, X, Y"
  // Take the FIRST specific cheese as the canonical, prefix with "shredded".
  // Runs HERE (after yield-note paren strip) so "(8 ounces)" between "cheese"
  // and the dash is already removed.
  {
    const cheeseListM = str.match(/^(.*?(?:shredded|grated)?\s*cheese)\s*[-–—]+\s*([a-z][a-z\s]*?)(?:,|$)/i);
    if (cheeseListM && /\bcheese\b/i.test(cheeseListM[1])) {
      const prefix = /shredded/i.test(cheeseListM[1]) ? 'shredded ' :
                     /grated/i.test(cheeseListM[1]) ? 'grated ' : '';
      const firstCheese = cheeseListM[2].trim();
      const beforeCheese = cheeseListM[1].replace(/\s*(?:shredded|grated)?\s*cheese\s*$/i, '').trim();
      str = `${beforeCheese} ${prefix}${firstCheese} cheese`.replace(/\s+/g, ' ').trim();
    }
  }
  // Strip "zest & juice" / "zest and juice" / "zest, juice" prefix on citrus
  // ("2-3 zest & juice lemons" → "2-3 lemons")
  str = str.replace(/^(\d+(?:\s*[-–]\s*\d+)?)\s+zest\s*(?:&|and|,)?\s*juice\s+(?=lemons?|limes?|oranges?)/i, '$1 ');
  // Strip orphan trailing "or" / ", or" left after splitting alternatives
  // ("3-4 handfuls of baby spinach, torn or roughly chopped" → after prep word
  //  strip leaves trailing "or")
  str = str.replace(/,?\s+(?:or|and)\s*$/i, '').trim();
  // Strip count-breakdown notes after a primary count + noun:
  //   "6 garlic cloves, 5 smashed and peeled, 1 finely grated or minced"
  //   → "6 garlic cloves" (the breakdown isn't useful at the store)
  str = str.replace(/(\d+\s+\w+\s*(?:cloves?|breasts?|thighs?|fillets?|filets?)),\s*\d+[^,]*(?:,\s*\d+[^,]*)*$/i, '$1').trim();
  // Strip "white part separated from greens" / "X part separated from Y"
  str = str.replace(/,?\s*\w+\s+parts?\s+separated\s+from\s+\w+\b.*$/i, '').trim();
  // "Large/small/big pinch" — drop the size word before pinch (size is meaningless
  // for a pinch quantity — a pinch is a pinch)
  str = str.replace(/^(?:large|small|big)\s+(?=pinch\b)/i, '').trim();
  // Trailing "on a diagonal" / "1\" thick" / "1/2-inch thick" prep specs
  str = str.replace(/,?\s*on\s+a\s+diagonal\b.*$/i, '').trim();
  str = str.replace(/,?\s*\d+(?:\/\d+)?["\s\-]*(?:inch|cm|in)\s+thick\b.*$/i, '').trim();
  str = str.replace(/\s*\d+(?:\/\d+)?"\s+thick\s*$/i, '').trim();
  str = str.replace(/\s*\d+(?:\/\d+)?"\s*$/i, '').trim();
  // Orphan "&" left after stripping prep words around it: "peeled & sliced into ..."
  // → if "&" ends up isolated or trailing, drop it.
  str = str.replace(/\s*&\s*$/i, '').trim();
  str = str.replace(/\s+&\s*(?=,|$)/g, '').trim();
  // "N-ounce/N oz package/box/bag of <ingredient>" → preserve as "N oz <ingredient>"
  // ("1-ounce package of fresh tarragon leaves" → effectively "1 oz fresh tarragon leaves")
  str = str.replace(/^(\d+)\s*-?\s*(?:oz|ounce)s?\s+(?:package|pkg|pack|box|bag|container|jar)\s+of\s+/i,
    (_, n) => `${n} oz `);
  str = str.replace(/^(\d+)\s+(?:oz|ounce)s?\s+(?:package|pkg|pack|box|bag|container|jar)\s+of\s+/i,
    (_, n) => `${n} oz `);
  // "Extra X" / "extra X" prefix when "extra" implies "more for serving" — drop
  str = str.replace(/^extra\s+(?=\w)/i, '').trim();
  // Handful → measured form. Per Rafi:
  //   - olives:     1 handful = 1/3 cup
  //   - everything: 1 handful = 1 oz
  // Also handles "<count> handful (<ingredient>)" — extract paren content as
  // the actual ingredient, e.g. "1 handful (pitted Kalamata olives)" → "1/3 cup kalamata olives".
  {
    // Form: "<count> handful (<X>)" — the X in parens is the actual ingredient
    const handfulParenM = str.match(/^(\d+|two|three|four|five|a|an)?\s*handfuls?\s*\(\s*([^)]+)\s*\)/i);
    if (handfulParenM) {
      const numWord: Record<string, number> = { a: 1, an: 1, two: 2, three: 3, four: 4, five: 5 };
      const n = handfulParenM[1] ? (numWord[handfulParenM[1].toLowerCase()] ?? parseInt(handfulParenM[1], 10)) : 1;
      const ing = handfulParenM[2].trim();
      if (/\bolives?\b/i.test(ing)) {
        // 1 handful olives = 1/3 cup
        const cups = n / 3;
        str = `${cups} cup ${ing}`;
      } else {
        str = `${n} oz ${ing}`;
      }
    }
  }
  // Strip "small"/"big"/"large" before handful — meaningless qualifier:
  //   "small handful of coriander" → "handful of coriander" → "1 oz coriander"
  str = str.replace(/\b(?:small|big|large)\s+(?=handfuls?\b)/gi, '').trim();
  // If a serving marker is set ("to garnish" / "to serve"), skip the handful →
  // qty conversion. Just strip the "<count> handful of " prefix so the name
  // is the bare ingredient. The nutrition pipeline will apply its own default
  // (1 tbsp herbs per serving) at recipe-build time.
  if (servingMarker) {
    str = str.replace(/^(?:\d+(?:\s*[-–]\s*\d+)?\s+|two\s+|three\s+|four\s+|five\s+|a\s+|an\s+)?handfuls?\s+of\s+/i, '').trim();
  }
  // "N handfuls of X" / "N handfuls X" — count + ingredient (no parens). Range form too.
  // For herbs (basil/cilantro/parsley/mint/etc.), 1 handful = 2 oz fresh leaves.
  // For olives, 1 handful = 1/3 cup. Everything else, 1 handful = 1 oz.
  const HERB_RE = /\b(?:basil|cilantro|coriander|parsley|mint|dill|chives|tarragon|thyme|rosemary|sage|oregano|chervil|marjoram)\b/i;
  str = str.replace(/^(\d+(?:\s*[-–]\s*\d+)?|two|three|four|five|a)\s+handfuls?\s+(?:of\s+)?/i, (_, num) => {
    const numWord: Record<string, number> = { a: 1, two: 2, three: 3, four: 4, five: 5 };
    let n: number;
    if (numWord[num.toLowerCase()] != null) n = numWord[num.toLowerCase()];
    else {
      const rangeM = num.match(/^(\d+)/);
      n = rangeM ? parseInt(rangeM[1], 10) : 1;
    }
    if (/\bolives?\b/i.test(str)) return `${n / 3} cup `;
    if (HERB_RE.test(str)) return `${n * 2} oz fresh `;
    return `${n} oz `;
  });
  str = str.replace(/^handfuls?\s+(?:of\s+)?/i, () => {
    if (/\bolives?\b/i.test(str)) return '1/3 cup ';
    if (HERB_RE.test(str)) return '2 oz fresh ';
    return '1 oz ';
  }).trim();
  // For herb handfuls, append " leaves" to make the shopping name explicit
  // (matches user spec: "handful basil, torn" → "2 oz fresh basil leaves")
  if (/^\d+\s+oz\s+fresh\s+/i.test(str) && HERB_RE.test(str) && !/\bleaves?\b/i.test(str)) {
    str = str.replace(/^(\d+\s+oz\s+fresh\s+\w+)\b/i, '$1 leaves');
  }
  // "N lemons/limes/oranges, sliced into slices/wedges" → "1 <citrus>"
  // (3-4 lemon wedges come from cutting one lemon, not buying 3-4 lemons).
  // NOTE: "rounds" intentionally excluded — recipe author cuts rounds from
  // multiple whole fruits ("3-4 lemons, sliced into rounds" → keep 3 lemons).
  // MUST fire BEFORE the "into rounds" trailing strip below or "rounds" gets eaten.
  str = str.replace(/^\d+(?:\s*[-–]\s*\d+)?\s+(lemons?|limes?|oranges?),?\s+sliced\s+(?:into\s+)?(?:slices|wedges)\b.*$/i,
    (_, citrus) => `1 ${citrus.replace(/s$/i, '')}`);
  // Trailing prep instructions about how the ingredient is cut/shaped:
  //   "potatoes, scrubbed and chopped into 1/2-inch chunks" → strip from "into" on
  //   "lemons, sliced into rounds" → strip "into rounds"
  //   "tomatoes, sliced in half" / "in halves" → strip
  //   "ears of corn, shucked raw" → strip "raw"
  // Word-based forms first
  str = str.replace(/,?\s*(?:in|into)\s+(?:half|halves|rounds|slices|wedges|chunks|cubes|pieces|florets|bite[\s-]size\s+\w+)\b[^)]*$/i, '').trim();
  // Digit-based: "into 1/2-inch chunks", "into 3-inch pieces", "into 1 inch cubes"
  str = str.replace(/,?\s*(?:in|into)\s+\d[^,]*$/i, '').trim();
  // Unicode-fraction-based: "into ½ inch thick rounds" — fractions get normalized
  // to digits later but at this point they're still ½/¼/etc.
  str = str.replace(/,?\s*(?:in|into)\s+[¼-¾⅐-⅞][^,]*$/i, '').trim();
  // Trailing orphan ", sliced into" / "sliced into" left after thickness strip
  // ate "1/2 inch thick rounds" but left "into" / "sliced into" behind
  str = str.replace(/,?\s*(?:sliced|cut)\s+(?:in|into)\s*$/i, '').trim();
  // Word-boundary required so "in" doesn't get eaten from "cumin", "thin", etc.
  str = str.replace(/,?\s*\b(?:in|into)\b\s*$/i, '').trim();
  // Trailing ", cut" / ", cut into X" — only when preceded by a comma (so we
  // don't accidentally eat "cut" inside compound nouns like "center cut bacon")
  str = str.replace(/,\s*cut\s+(?:into|in|to)\b.*$/i, '').trim();
  str = str.replace(/,\s*cut\s*$/i, '').trim();
  str = str.replace(/,?\s*raw\s*$/i, '').trim();
  // Trailing em-dash / hyphen + prep instruction: "1 shallot - finely chopped."
  str = str.replace(/\s*[-–—]\s*(?:finely|coarsely|roughly|thinly)?\s*(?:chopped|minced|sliced|diced|grated|peeled|crushed|halved|quartered|cubed|julienned|grated|shredded)\.?\s*$/i, '').trim();
  // Trailing standalone period
  str = str.replace(/\.\s*$/, '').trim();
  // "1/3 cup plus 1 tablespoon X" / "1 cup + 6 tablespoons X" — combine the two
  // measures. Keep result in cups when over a cup, else tbsp.
  str = str.replace(/^(\d+(?:\s+\d+)?\/\d+|\d+\.?\d*)\s+cups?\s+(?:plus|\+)\s+(\d+(?:\.\d+)?)\s+(?:tablespoons?|tbsp)\b/i,
    (_, cupStr, tbspStr) => {
      let cupVal = 0;
      const fracM = cupStr.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
      if (fracM) {
        const whole = fracM[1] ? parseInt(fracM[1]) : 0;
        cupVal = whole + parseInt(fracM[2]) / parseInt(fracM[3]);
      } else {
        cupVal = parseFloat(cupStr);
      }
      const totalTbsp = cupVal * 16 + parseFloat(tbspStr);
      // If total ≥ 1 cup, express as cups (round to nearest 1/8 cup so we land
      // on standard fractions: 1 cup + 6 tbsp = 22 tbsp = 1.375 cup = 1 3/8 cup)
      if (totalTbsp >= 16) {
        const cups = Math.round((totalTbsp / 16) * 8) / 8;
        return `${cups} cup`;
      }
      return `${Math.round(totalTbsp)} tbsp`;
    });
  // Brand-name strips (anywhere in string, not just suffix):
  //   "diamond crystal kosher salt"  →  "kosher salt"  →  "salt" (via salt collapse)
  //   "morton kosher salt"           →  "kosher salt"  →  "salt"
  str = str.replace(/\bdiamond\s+crystal\b/gi, '').trim();
  str = str.replace(/\bmorton'?s?\b/gi, '').trim();
  str = str.replace(/\bmaldon\b/gi, '').trim();
  // "I use <brand> brand" / "<brand> brand" suffix — brand info shouldn't show
  // on shopping list (will be stored separately for Instacart matching later)
  str = str.replace(/,?\s*i\s+use\s+\S+(?:\s+\S+)?\s+brand\b.*$/i, '').trim();
  str = str.replace(/,?\s*\S+\s+brand\b.*$/i, '').trim();
  // "approx" / "approximately" prefix — strip but keep the qty after
  str = str.replace(/^approx(?:imately)?\s+/i, '').trim();
  // Hyphenated freshly-cracked / freshly-ground / freshly-grated — strip "freshly-"
  str = str.replace(/\bfreshly-(?=cracked|ground|grated|squeezed|chopped)/gi, '').trim();
  // Then the resulting "cracked"/"ground" before pepper is fine; for "black pepper"
  // we want "cracked black pepper" → "black pepper". Strip "cracked" / "ground"
  // when paired with pepper.
  str = str.replace(/\b(?:cracked|ground)\s+(?=black\s+pepper|white\s+pepper|pepper)/gi, '').trim();
  // "X-inch piece of <ingredient>" / "X-inch piece <ingredient>"  →  "<ingredient>"
  // Also handles bare "-inch piece of ginger" leftovers
  str = str.replace(/\b\d*\.?\d*-?\s*inch\s+piece\s+(?:of\s+)?/gi, '').trim();
  str = str.replace(/^-inch\s+piece\s+(?:of\s+)?/i, '').trim();
  // "knob of ginger" / "thumb of ginger" / "2 inch knob of ginger" / "small knob of fresh ginger"
  //                                              →  "<N> inch fresh ginger"
  // Consumer needs to know to buy fresh (not ground/dried) ginger.
  {
    const knobM = str.match(/^(?:a\s+|an\s+)?(?:small\s+|large\s+)?(?:(\d+)(?:\s|-)*inch\s+)?(?:knob|thumb)\s+of\s+(?:fresh\s+)?ginger\b/i);
    if (knobM) {
      const inches = knobM[1] || '1';
      str = str.replace(knobM[0], `${inches} inch fresh ginger`).trim();
    }
  }
  // "arils from N pomegranate(s)"  →  "N cup pomegranate arils"
  // (1 pomegranate yields roughly 1 cup of arils)
  {
    const arilM = str.match(/^arils?\s+from\s+(\d+(?:\.\d+)?|one|two|three|four)\s+pomegranates?\b/i);
    if (arilM) {
      const num = TEXT_NUMBERS[arilM[1].toLowerCase()] != null ? TEXT_NUMBERS[arilM[1].toLowerCase()] : arilM[1];
      str = str.replace(arilM[0], `${num} cup pomegranate arils`).trim();
    }
  }
  // (Old "handful of X → 1/2 bunch" rule removed in favor of the unified
  //  "N handfuls of X → N oz X" rule below — 1 handful ≈ 1 oz per Rafi.)
  // Leading "or " left over from prior or-clause stripping ("or shaved red cabbage")
  str = str.replace(/^or\s+/i, '').trim();
  // Orphan parens left behind after "to taste" suffix stripping:
  //   "salt, (more to taste)"  →  "to taste" stripped at step 2b leaves "salt, (more"
  //   strip the orphan opening paren + word here.
  str = str.replace(/\s*\(\s*\w+\s*$/i, '').trim();

  // 2c2. Slash handling for known synonym pairs in ingredient names:
  //      "vegetable broth/stock" → "vegetable broth"
  //      "chicken broth/stock"   → "chicken broth"
  //      "broth/bouillon"        → "broth"
  //      Keep first word of the slash pair when both halves are interchangeable.
  str = str.replace(/\b(broth)\s*\/\s*(stock|bouillon)\b/gi, '$1');
  str = str.replace(/\b(stock)\s*\/\s*(broth|bouillon)\b/gi, '$1');

  // 2c3. "can <ingredient>" leading prefix → "canned <ingredient>"
  //      So the consumer at the store knows to buy CANNED, not dry.
  //      Only fires when "can" is the first token of the residual name (not when
  //      "can" is being extracted as the unit, which the parser handles separately).
  str = str.replace(/^can\s+(?=[a-z])/i, 'canned ');

  // 2d. Strip prep words and size descriptors anywhere in the string.
  //     These describe HOW the ingredient is processed/sized but never affect
  //     what to buy at the store ("chopped parsley" → buy parsley, chop at home).
  //     Form modifiers (bone-in, skinless, canned, fresh) are NOT stripped here.
  const PREP_WORDS_SINGLE = [
    'chopped', 'minced', 'diced', 'sliced', 'crushed',
    'mashed', 'peeled', 'halved', 'quartered', 'cubed', 'julienned',
    'beaten', 'whisked', 'melted', 'softened',
    'squeezed', 'torn', 'pitted', 'shaved',
    'warmed', 'toasted', 'browned', 'trimmed',
    'cleaned', 'rinsed', 'dried', 'patted', 'packed', 'scrubbed', 'slit',
    'scant', 'lightly', 'heaping',
    'fat', // "fat garlic cloves" → strip; thickness is irrelevant for shopping
    // NOT stripped: 'grated' / 'shredded' — meaningful for cheese
    //               ("grated parmesan" / "shredded mozzarella" stay)
    // Temperature states — kitchen treatment, not what you buy
    'cold', 'warm', 'hot', 'chilled',
    // NOT stripped: 'crumbled' (cotija/feta/bacon sold pre-crumbled),
    //               'small', 'large', 'big', 'jumbo' (informative for shopping —
    //                "8 small tortillas" is meaningfully different from large),
    //               'salted', 'frozen' (matter at the store)
    //               'unsalted' (handled separately — stripped because default butter is salted)
    'finely', 'coarsely', 'freshly', 'roughly', 'rough', 'very',
    // 'thinly'/'thickly' intentionally NOT stripped — preserve "thinly sliced"
    // / "thick-cut" descriptors that matter at the store.
    'loosely', 'tightly',
    'lengthwise', 'crosswise', 'diagonally',
    'medium', // "medium" is the default size — strip; keep small/large
    'unsalted', // butter default is salted — strip "unsalted" so name → "butter"
  ];
  for (const w of PREP_WORDS_SINGLE) {
    // Use hyphen-aware boundaries so "full-fat" isn't broken by the "fat" strip,
    // "low-sodium" isn't broken by something inside it, etc.
    // Special case: "crushed" / "diced" are FORMS for canned tomatoes (consumer
    // needs to buy crushed tomatoes vs whole). Preserve anywhere when "tomato"
    // appears in the string.
    if ((w === 'crushed' || w === 'diced') && /\btomato(?:es)?\b/i.test(str)) {
      // Skip — keep the prep word in name as a form modifier
    } else {
      str = str.replace(new RegExp(`(?<!-)\\b${w}\\b(?!-)`, 'gi'), '');
    }
  }
  // Trailing "about <fraction>" volume notes the recipe author added in parens
  // ("..., rough chopped, about 1/4-1/3 cup") — strip
  str = str.replace(/,?\s*about\s+\d[^,]*$/i, '').trim();
  // Strip orphan "&" / "+" / "and" left between stripped prep words
  str = str.replace(/(?:^|,)\s*[&+]\s+/g, ' ').trim();
  str = str.replace(/\s*[&+]\s*$/, '').trim();
  str = str.replace(/\s+[&+]\s+(?=$|,)/g, ' ').trim();

  // Aggressively normalize the comma/space mess left after stripping prep words.
  // "2 tbsp cold, salted butter, sliced" → strip "cold"+"sliced" → "2 tbsp , salted butter,"
  // → normalize → "2 tbsp salted butter".
  str = str
    .replace(/\s+/g, ' ')              // single spaces
    .replace(/(\s*,\s*)+/g, ', ')      // collapse runs of commas/spaces into a single ", "
    .replace(/\s+,/g, ',')             // no space BEFORE a comma
    .replace(/,\s*$/g, '')             // strip trailing comma
    .replace(/^[,\s]+/, '')            // strip leading commas/spaces
    .replace(/\s+/g, ' ')              // re-collapse any new doubles
    .trim();
  // After cleanup, an orphan comma sitting between qty and the noun (e.g.
  // "2 tablespoons , salted butter") would still confuse unit extraction.
  // Drop a comma that immediately follows a unit token.
  str = str.replace(/^(\d+(?:[.\/]\d+)?)\s+([a-z]+)\s*,\s*/i, '$1 $2 ');

  // 3. Vague quantities — return early with no scalable number.
  // Strip leading "a " / "an " / "small " / "large " before vague qualifiers
  // so "a drizzle of olive oil" / "small handful coriander" route correctly.
  str = str.replace(/^(?:a|an|small|large|big|generous|healthy)\s+(?=(?:few|handful|splash|sprinkle|drizzle|to\s+taste|as\s+needed|some|squeeze|touch|knob|pinch|dash)\b)/i, '').trim();
  const strLower = str.toLowerCase();
  for (const vague of VAGUE_WORDS) {
    if (strLower.startsWith(vague)) {
      // Strip leading "of" / "of a" / "of the" after the vague word
      //   "drizzle of olive oil" → name="olive oil"
      //   "pinch of sugar" → name="sugar"
      const vagueNameStr = str.slice(vague.length).replace(/^[,\s:]+/, '').replace(/^of\s+(?:a\s+|an\s+|the\s+)?/i, '').trim();
      const vagueName = vagueNameStr.replace(/\(.*?\)/g, '').replace(/,.*$/, '').trim().toLowerCase();
      return { qty: 0, unit: '', name: vagueName || strLower, category: categorizeIngredient(vagueName || strLower), raw, note };
    }
  }

  // 4. Text numbers: "One lemon" → qty=1
  const textNumM = str.match(/^(one|two|three|four|five|six|seven|eight|nine|ten|half)\s+/i);
  let qty = 0;
  if (textNumM) {
    qty = TEXT_NUMBERS[textNumM[1].toLowerCase()] || 0;
    str = str.slice(textNumM[0].length).trim();
  }

  // 5. "N x" piece-count prefix (e.g. "4 x 6oz salmon fillets")
  let pieceCount = 0;
  if (!qty) {
    // Special case: "N x M-inch <noun>" → qty=N, name="M-inch <noun>"
    // (consumer needs to know the size of tortillas/cakes/etc.)
    const sizedM = str.match(/^(\d+)\s*[xX×]\s+(\d+(?:\/\d+)?)\s*-\s*inch\s+(.+)$/i);
    if (sizedM) {
      qty = parseInt(sizedM[1]);
      str = `${sizedM[2]}-inch ${sizedM[3]}`;
    } else {
      const piecePrefixM = str.match(/^(\d+)\s*[xX×]\s+/);
      if (piecePrefixM) {
        pieceCount = parseInt(piecePrefixM[1]);
        str = str.slice(piecePrefixM[0].length).trim();
      }
    }
  }

  // 6. Strip dual metric/imperial — keep only the imperial part
  str = str.replace(/\d+\.?\d*\s*(?:g|kg|ml|l)\s*[/|]\s*/gi, '');

  // 7. Pre-normalize "zest/juice/peel of N ingredient" → "N ingredient" (drop the
  //    zest/juice marker — the consumer just buys the citrus; zest is calorie-
  //    negligible and juice is implied by qty). Also handles compound forms like
  //    "zest juice of 1 lemon" / "zest and juice of 1 lemon".
  str = str.replace(/^(?:zest|juice|peel|rind)(?:\s+(?:and|&|\+|,)?\s*(?:zest|juice|peel|rind))?\s+(?:of|from)\s+((?:\d+\s+)?\d+\/\d+|\d+\.?\d*|one|two|three|four|five|six|seven|eight|nine|ten|half|a|an)\s+(.+)$/i,
    (_, num, ing) => {
      const n = TEXT_NUMBERS[num.toLowerCase()] != null ? TEXT_NUMBERS[num.toLowerCase()] : num;
      return `${n} ${ing.trim()}`;
    });

  // 8. Extract leading quantity
  // Matches the qty (with optional range). Range support extended to fractions:
  //   "1 1/2-2 lbs", "1/2-1 tsp", "1/4-1/3 cup", "1.5-2.5 cups", "1 - 1 1/2 cups"
  // The full match includes the range suffix; parseQty returns the LOWER bound.
  const qtyPat = /^((?:\d+\s+)?\d+\/\d+(?:\s*[-–]\s*(?:\d+\s+)?\d+(?:\/\d+)?)?|\d+\.?\d*(?:\s*[-–]\s*(?:(?:\d+\s+)?\d+\/\d+|\d+\.?\d*))?)/;
  if (!qty) {
    const qtyM = str.match(qtyPat);
    if (qtyM) { qty = parseQty(qtyM[1]); str = str.slice(qtyM[0].length).trim(); }
  }

  // 8b. Strip "to N [unit]" range upper-bound
  if (qty > 0) {
    str = str.replace(/^to\s+(?:(?:\d+\s+)?\d+(?:\/\d+)?|\d+\.?\d*)\s*/i, '').trim();
  }

  // 9. Compact inline measure: "1 6oz. can" → qty=6oz, unit=oz
  let unit = '';
  const compactMeasurePat = /^(\d+\.?\d*)\s*(oz\.?|fl oz|lb\.?|lbs?\.?|g|kg|ml|l)\b/i;
  const compactM = !unit ? str.match(compactMeasurePat) : null;
  if (compactM) {
    const cQty = parseQty(compactM[1]);
    const cUnitRaw = compactM[2].replace(/\.$/, '').trim().toLowerCase();
    unit = UNITS[cUnitRaw] || cUnitRaw;
    qty = (qty || 1) * cQty;
    str = str.slice(compactM[0].length).replace(/^[.\s]+/, '').trim();
  }

  // 10. Extract unit (longest match first)
  if (!unit) {
    const unitKeys = Object.keys(UNITS).sort((a, b) => b.length - a.length);
    for (const uk of unitKeys) {
      const pat = new RegExp('^' + uk.replace(/\./g, '\\.') + '(?:\\b|\\s|,|\\.|$)', 'i');
      if (pat.test(str)) {
        unit = UNITS[uk];
        str = str.slice(uk.length).replace(/^[.\s]+/, '').trim();
        if (str.startsWith('of ')) str = str.slice(3).trim();
        break;
      }
    }
  }

  // 11. Strip duplicate qty+unit left in str after extraction
  if (unit) {
    str = str.replace(/^\d+\.?\d*\s*(?:oz\.?|lbs?\.?|lb\.?|g|kg|ml|l|cups?|tbsps?|tsps?)\s*/i, '').trim();
  }
  // 11b. Strip range-upper-bound leftovers from forms the qty regex can't capture:
  //   "1 - 1 1/2 cups mozzarella" → qty took "1", leftover " - 1 1/2 cups mozzarella"
  //   "1/2 cup to 1 cup barbecue sauce" → qty took "1/2", leftover "to 1 cup barbecue sauce"
  // After qty/unit extraction, strip trailing "<dash|to> <num/frac> <unit>?" leftovers.
  str = str.replace(/^\s*[-–]\s*(?:\d+\s+)?\d+(?:\/\d+|\.\d+)?\s*(?:cups?|tbsps?|tsps?|oz|lb|lbs|tablespoons?|teaspoons?|pounds?|ounces?)?\s*/i, '').trim();
  str = str.replace(/^to\s+(?:\d+\s+)?\d+(?:\/\d+|\.\d+)?\s*(?:cups?|tbsps?|tsps?|oz|lb|lbs|tablespoons?|teaspoons?|pounds?|ounces?)?\s*/i, '').trim();

  // 12. Convert metric to imperial — smart unit choice based on ingredient.
  //   - Butter:           grams → tbsp (1 tbsp ≈ 14g), nearest 0.5 tbsp
  //   - Grains/flour/sugar: grams → cups (rice ~200g/c, flour ~120g/c), nearest 0.25 cup
  //   - Otherwise:        grams → oz, rounded to 1 decimal (whole when ≥ 4)
  if (unit === 'g') {
    const lowerName = str.toLowerCase();
    if (/\bbutter\b/.test(lowerName)) {
      qty = Math.round((qty / 14) * 2) / 2;
      unit = 'tbsp';
    } else if (/\b(?:rice|quinoa|couscous|farro|barley|bulgur|sugar|brown\s+sugar)\b/.test(lowerName)) {
      qty = Math.round((qty / 200) * 4) / 4;
      unit = 'cup';
    } else if (/\bflour\b/.test(lowerName)) {
      qty = Math.round((qty / 120) * 4) / 4;
      unit = 'cup';
    } else {
      const oz = qty * 0.03527;
      qty = oz >= 4 ? Math.round(oz) : Math.round(oz * 10) / 10;
      unit = 'oz';
    }
  }
  if (unit === 'kg') { qty = Math.round(qty * 2.20462 * 10) / 10; unit = 'lb'; }
  if (unit === 'ml') { qty = Math.round(qty * 0.033814 * 10) / 10; unit = 'oz'; }
  if (unit === 'l')  { qty = Math.round(qty * 33.814);              unit = 'oz'; }

  // 13. Category lookup from pre-cleaned name
  const preCleanLower = str.toLowerCase()
    .replace(/\(.*?\)/g, '').replace(/\).*$/, '').replace(/,.*$/, '').trim();
  let forcedCategory: string | null = INGREDIENT_DB[preCleanLower] || null;
  if (!forcedCategory) {
    for (const key of DB_KEYS_BY_LENGTH) {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp('(?:^|\\s)' + escaped + '(?:\\s|$)');
      if (re.test(preCleanLower)) { forcedCategory = INGREDIENT_DB[key]; break; }
    }
  }

  // 13b. Strip "plus more if needed" qualifiers
  str = str.replace(/,?\s*plus more\b.*/i, '').trim();

  // 14. Smart comma: if the FIRST word after comma is a prep instruction → strip everything after;
  //     otherwise replace comma with space to preserve "boneless, skinless chicken"
  //     e.g. "jalapenos, chopped in half" → "jalapenos" (first word "chopped" is prep)
  //          "cilantro leaves, tightly packed" → "cilantro leaves" (first word "tightly" is prep)
  //          "boneless, skinless chicken" → "boneless skinless chicken" ("skinless" is not prep)
  const commaIdx = str.indexOf(',');
  if (commaIdx >= 0) {
    const afterComma = str.slice(commaIdx + 1).trim();
    const afterWords = afterComma.split(/\s+/).filter(w => w.length > 0);
    const firstWord  = afterWords[0]?.toLowerCase().replace(/[.,!?]$/, '') ?? '';
    const firstIsPrep = afterWords.length > 0 && (
      PREP_WORDS.has(firstWord) ||
      STOP_WORDS.includes(firstWord)
    );
    // Guard: if the after-comma part contains a real product noun (cheese/milk/
    // yogurt/etc.), it's a product descriptor not a prep instruction — keep it.
    //   "1 cup whole milk, full-fat ricotta cheese" — "full-fat" is a stop word
    //   but "ricotta cheese" is the actual product. Merge instead of strip.
    const afterHasProductNoun = /\b(?:cheese|milk|yogurt|yoghurt|cream|ricotta|mozzarella|parmesan|cheddar|feta|cottage|coconut|broth|stock|paste|sauce|basil|cilantro|parsley|mint|dill|chives|tarragon|thyme|rosemary|sage|oregano|ginger|garlic|chicken|beef|pork|salmon|shrimp|tofu|onion|tomato|pepper|lemon|lime)\b/i.test(afterComma);
    if (firstIsPrep && !afterHasProductNoun) {
      str = str.slice(0, commaIdx).trim();
    } else {
      // Replace commas with spaces, but PRESERVE commas inside parens
      // (e.g. "herbs (cilantro, dill, mint, or basil)").
      const parenStash: string[] = [];
      str = str
        .replace(/\([^)]*\)/g, m => { parenStash.push(m); return 'XCMP' + (parenStash.length - 1) + 'X'; })
        .replace(/,\s*/g, ' ')
        .replace(/XCMP(\d+)X/g, (_, i) => parenStash[parseInt(i, 10)] || '')
        .trim();
    }
  }

  // 15. Clean name: strip remaining parens (but PRESERVE size/weight specs the
  //     shopper needs — "(7-inch)", "(15-oz.)", "(14 ounce)"), filter stop words.
  let name = str
    .replace(/\(([^)]*)\)/g, (_, content: string) => {
      // Keep parens whose content is a size/weight spec (number + measurement unit)
      const c = content.trim();
      if (/\d/.test(c) && /(?:oz|ounce|inch|"|lb|pound|gram|kg|ml|cm|mm)\b/i.test(c)) {
        return `(${c})`;
      }
      // Keep parens whose content is an herb/produce alternative list — recipe
      // author's flexibility for the user. "or" optional (allows comma-only lists).
      //   "(cilantro, dill, mint, or basil)" / "(thyme, oregano, parsley, rosemary)"
      if (/,/.test(c) &&
          /\b(?:basil|cilantro|parsley|mint|dill|chives|tarragon|thyme|rosemary|sage|oregano|chervil|marjoram)\b/i.test(c)) {
        return ` (${c})`;
      }
      return '';
    })
    // Strip orphan closing paren (no matching open paren earlier in string).
    // Kept as belt-and-suspenders — the balanced regex above handles 99% of cases.
    .replace(/^([^()]*)\).*$/, '$1')
    // Strip trailing conditional clauses: "halved if large", "split if needed"
    .replace(/\s+if\s+[a-z]+\s*$/i, '')
    // Strip trailing " pieces" / " piece" — "cod fillet pieces" → "cod fillet"
    // (the consumer doesn't shop for pieces specifically; the qty already covers count)
    .replace(/\s+pieces?$/i, '')
    .replace(/^juice (?:of|from)\s+(?:(?:\d+\s+)?\d+(?:\/\d+)?|\d+\.?\d*)?\s*/i, '')
    .replace(/^zest (?:of|from)\s+(?:(?:\d+\s+)?\d+(?:\/\d+)?|\d+\.?\d*)?\s*/i, '')
    .split(/\s+/)
    .filter((w, i, all) => {
      const lower = w.toLowerCase();
      if (!STOP_WORDS.includes(lower)) return true;
      // Preserve "fresh" / "freshly" when paired with a herb or ginger —
      // matters at the store ("fresh dill" ≠ "dried dill").
      if ((lower === 'fresh' || lower === 'freshly') && i + 1 < all.length) {
        const next = all[i + 1].toLowerCase().replace(/[.,]+$/, '');
        const HERBS = ['ginger','cilantro','parsley','basil','mint','dill','chives','tarragon','thyme','rosemary','sage','oregano','chili','chile','chilies','chiles','chives'];
        if (HERBS.includes(next)) return true;
      }
      // Preserve "whole" when followed by a count-noun protein OR "milk".
      //   "whole chicken" / "whole turkey" / "whole fish" — meaningful at the store
      //   "whole milk mozzarella" / "whole milk ricotta" — fat content matters
      if (lower === 'whole' && i + 1 < all.length) {
        const next = all[i + 1].toLowerCase().replace(/[.,]+$/, '');
        const PROTEINS = ['chicken','turkey','duck','fish','salmon','trout','goose','rabbit','lamb','snapper','branzino','seabass','bass','halibut','cod','tilapia','mackerel'];
        if (PROTEINS.includes(next) || next === 'milk' || next === 'wheat' || next === 'grain') return true;
      }
      // Preserve "full-fat" / "low-fat" / "reduced-fat" / "non-fat" when paired with
      // a dairy/coconut product — fat content matters for nutrition + diet compliance.
      //   "full-fat coconut milk", "full-fat ricotta", "low-fat yogurt"
      if (lower === 'full-fat' || lower === 'reduced-fat' || lower === 'low-fat' || lower === 'non-fat' || lower === 'fat-free') {
        const restJoined = all.slice(i + 1).join(' ').toLowerCase();
        if (/\b(?:coconut\s+milk|coconut\s+cream|ricotta|yogurt|yoghurt|sour\s+cream|cream\s+cheese|cottage\s+cheese|milk|cheese)\b/.test(restJoined)) return true;
      }
      // Preserve "crushed" / "diced" when paired with tomato (canned form modifier).
      // Look at any token after this one, not just the immediate next, so
      // "canned crushed fire-roasted tomatoes" still preserves "crushed".
      if (lower === 'crushed' || lower === 'diced') {
        const restJoined = all.slice(i + 1).join(' ').toLowerCase();
        if (/\btomato(?:es)?\b/.test(restJoined)) return true;
      }
      return false;
    })
    .join(' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

  name = name.replace(/^(of|a|an|the)\s+/, '');
  name = name.replace(/\s+for$/, '').trim();
  // Strip orphan trailing "or" / "and" / comma left after splits:
  name = name.replace(/[\s,]+(?:or|and)\s*$/i, '').trim();
  name = name.replace(/[\s,]+$/, '').trim();
  // Strip orphan parens left when "(to taste)" / "(divided)" got partially eaten
  // by suffix strippers — e.g. "black pepper (" → "black pepper".
  // Only strip clearly-orphan parens (trailing "(" with no matching ")" after,
  // or leading ")" with no matching "(" before) — preserves legitimate balanced
  // parens like "(7-inch)" or "(16- to 17-ounce)".
  name = name.replace(/\s*\(\s*$/, '').trim();   // trailing orphan opening "("
  name = name.replace(/^\s*\)\s*/, '').trim();   // leading orphan closing ")"

  // OR collapse — skip when " or " appears inside parens (e.g.
  // "herbs (cilantro, dill, mint, or basil)" — preserved alt-list parenthetical).
  if (name.includes(' or ') && !/\([^)]*\bor\b[^)]*\)/i.test(name)) {
    const parts = name.split(' or ').map(p => p.trim()).filter(Boolean);
    // Always take the first option (recipe author's primary intent).
    // If the first option is just an adjective (single token) but the last
    // option carries a trailing noun ("olive or avocado oil" → parts[0]="olive",
    // parts[last]="avocado oil"), append the trailing noun to the first option:
    //   "olive or avocado oil"   → "olive oil"
    //   "yellow or red onions"   → "yellow onions"
    //   "linguine or spaghetti"  → "linguine"  (parts[0] already complete)
    const firstWords = parts[0].split(/\s+/);
    const lastWords  = parts[parts.length - 1].split(/\s+/);
    const PREP_WORDS_FOR_OR = ['shredded','chopped','sliced','grated','minced','cubed','crushed','diced','smashed','julienned'];
    const lastWordOfFirst = (firstWords[firstWords.length - 1] || '').toLowerCase();
    const firstEndsInPrep = PREP_WORDS_FOR_OR.includes(lastWordOfFirst);
    // If parts[0] is already a complete known ingredient, use it as-is.
    // (Prevents "butter or vegan butter" → "butter butter" and
    //  "butter or 1 1/2 teaspoons olive oil" → "butter oil".)
    if (firstWords.length === 1 && lastWords.length > 1 && !INGREDIENT_DB[parts[0].toLowerCase()]) {
      const tail = lastWords[lastWords.length - 1];
      name = (tail.toLowerCase() === parts[0].toLowerCase())
        ? parts[0]
        : `${parts[0]} ${tail}`.trim();
    } else if (firstEndsInPrep && lastWords.length >= 1) {
      // First part ends in a prep word with no noun ("cooked shredded" or
      // "shredded or chopped X"); append the noun from the last part.
      //   "cooked shredded or chopped chicken" → "cooked shredded chicken"
      //   "shredded or cubed chicken" → "shredded chicken"
      const tail = lastWords[lastWords.length - 1];
      name = `${parts[0]} ${tail}`.trim();
    } else {
      name = parts[0];
    }
  }

  // 16. Piece-count logic: "4 x 6oz salmon fillets" → qty=4, name="6 oz salmon fillets"
  if (pieceCount > 0) {
    const nameWords = name.split(' ');
    if (nameWords.some(w => PIECE_WORDS.has(w))) {
      const perPiece = (qty && unit) ? `${fmtNum(qty)} ${unit} ` : '';
      const cat = forcedCategory || categorizeIngredient(name || raw);
      name = (perPiece + name).trim();
      return { qty: pieceCount, unit: '', name: INGREDIENT_ALIASES[name] || name, category: cat, raw, note };
    }
  }

  // 16b. Piece-style units (filet/fillet/slice/piece) — when the recipe says
  // "4 filets white fish", the consumer thinks of it as "4 white fish filets",
  // not "4 filet of white fish". Move the piece word into the name (plural form
  // when qty>1) and clear the unit so the display reads naturally.
  // Don't fire when the noun already contains the piece word (avoids
  // "4 white fish filets filets"). Skip if name is empty (already handled
  // by other rules like piece-count logic above).
  if ((unit === 'filet' || unit === 'fillet' || unit === 'slice' || unit === 'piece' || unit === 'ear' || unit === 'sprig' || unit === 'stalk') && qty > 0 && name) {
    const nameLower = name.toLowerCase();
    const pieceWords = ['filet','filets','fillet','fillets','slice','slices','piece','pieces','ear','ears','sprig','sprigs','stalk','stalks'];
    const alreadyHasPiece = pieceWords.some(w => new RegExp(`\\b${w}\\b`, 'i').test(nameLower));
    if (!alreadyHasPiece) {
      // Pluralize when qty > 1 (or fractional > 1)
      const plural = qty === 1 ? unit : (unit === 'slice' || unit === 'piece' ? `${unit}s` : `${unit}s`);
      name = `${name} ${plural}`.trim();
      unit = '';
    }
  }

  // 17. Special cases & alias map
  if (unit === 'clove' && !name) name = 'garlic';
  if (unit === 'clove' && (name === 'garlic' || name === 'garlic cloves' || name === 'garlic clove')) {
    // Singular "1 garlic clove" when qty=1, plural otherwise
    name = qty === 1 ? 'garlic clove' : 'garlic cloves';
    unit = '';
  }
  if (unit === 'head'  && name === 'garlic') { name = 'garlic (whole head)'; unit = ''; }
  // Garlic measured in tsp/tbsp (minced) → convert to clove-equivalent so it aggregates cleanly
  if ((unit === 'tsp' || unit === 'tbsp') && (name === 'garlic' || name === 'garlic cloves' || name === 'garlic clove')) {
    qty = Math.round((unit === 'tbsp' ? qty * 3 : qty) * 10) / 10;
    unit = '';
    name = qty === 1 ? 'garlic clove' : 'garlic cloves';
  }
  // Note: previously converted "inch" → "tbsp" for ginger (microplaned equivalent),
  // but that produced confusing display ("1 tbsp ginger" when consumer needs to
  // buy a piece of fresh ginger). Keep the unit as "inch" for shopping clarity;
  // the nutrition matcher handles inch-to-grams via a separate conversion.

  name = INGREDIENT_ALIASES[name] || name;

  // If a serving marker was detected upstream and no real unit/qty was extracted,
  // surface the marker in the unit field so it shows in the qty column.
  if (servingMarker && !unit && !qty) {
    unit = servingMarker;
  }

  // "pinch" / "dash" with no qty are seasoning amounts — display the ingredient
  // alone (no qty/unit prefix). "pinch of salt" → just "salt".
  if (!qty && (unit === 'pinch' || unit === 'dash')) {
    unit = '';
  }

  // Salt is always a seasoning — display just "salt" without qty/unit. Recipes
  // that say "1/4 + 1/8 tsp fine salt" or "1 tsp salt" don't need a count
  // shown to the consumer; salt is always to-taste at the store.
  // (Specifically applies after the salt-collapse below has run.)
  // Move this check to after the salt collapse — see end of function.

  // "can <ingredient>" handling. Fires here (after qty/unit extraction + aliasing)
  // because earlier passes still had the qty prefix in the string.
  //   - default:        "can black beans"  →  "canned black beans"
  //                     (consumer at store needs to know it's CANNED, not dry)
  //   - coconut milk:   "can full fat coconut milk"  →  "full fat coconut milk"
  //                     (coconut milk is always canned — "canned" prefix is redundant)
  if (/^can\s+[a-z]/i.test(name)) {
    if (/coconut\s+milk\b/i.test(name)) {
      name = name.slice(4).trim();
    } else {
      name = 'canned ' + name.slice(4);
    }
  }

  // Block/box wrappers similar to can/jar — common for cheese, tofu.
  // Can/jar/tin with parenthetical size — pull oz out as actual qty.
  // Cases handled:
  //   "1 can (14 ounce) full-fat coconut milk"  →  qty=14, unit=oz, name="full-fat coconut milk"
  //   "1 (15-oz.) can black beans"              →  qty=15, unit=oz, name="canned black beans"
  //   "2 (28-ounce) jars marinara sauce"        →  qty=56, unit=oz (×2 jars), name="jarred marinara sauce"
  //   "1 tin or 160ml of coconut cream"         →  qty=5.5, unit=oz, name="canned coconut cream"
  //   "1, 19 oz tin black beans"                →  qty=19, unit=oz, name="canned black beans"
  // The shopping list then shows the actual size and form the consumer needs.
  {
    const isCanContext = unit === 'can' || unit === 'jar' || unit === 'tin' ||
      /\b(?:can|jar|tin|block|blocks|box|package|pkg)s?\b/i.test(name);
    if (isCanContext) {
      // Track the original count before we replace qty (e.g. "2 jars" of 28oz each → ×2)
      const originalCount = qty || 1;

      // Try paren-oz first: "(15-oz.)", "(28-ounce)", "(7 ounce)", "(10-12 oz)" / "(16- to 17-ounce)" (use UPPER bound)
      const ozM = name.match(/\(\s*(\d+(?:\.\d+)?)(?:\s*[-–]\s*(?:to\s+)?(\d+(?:\.\d+)?))?[\s.\-]*(oz|ounce|fl\s*oz|fluid\s+ounce)s?\.?[^)]*\)/i);
      // Try paren-ml: "(160ml)", "(160 ml)" — convert to oz (1ml ≈ 0.0338 oz)
      const mlM = !ozM && name.match(/\(?\s*(\d+(?:\.\d+)?)\s*ml\b/i);
      // Try inline-oz: "19 oz tin", "15 ounce can"
      const inlineOzM = !ozM && !mlM && name.match(/\b(\d+(?:\.\d+)?)\s*(?:oz|ounce)s?\b/i);

      if (ozM) {
        // Use UPPER bound when range present (group 2), else single value (group 1).
        // Per Rafi: paren-oz ranges represent the larger packaging size more often
        // than the smaller, so 12 oz from "(10-12 ounces)" is more accurate.
        const ozValue = ozM[2] ? parseFloat(ozM[2]) : parseFloat(ozM[1]);
        qty = Math.round(ozValue * originalCount * 10) / 10;
        unit = 'oz';
        name = name.replace(ozM[0], '').replace(/\s+/g, ' ').trim();
      } else if (mlM) {
        const oz = parseFloat(mlM[1]) * 0.0338 * originalCount;
        qty = Math.round(oz * 2) / 2; // round to nearest 0.5 oz
        unit = 'oz';
        name = name.replace(mlM[0], '').replace(/\s+/g, ' ').trim();
      } else if (inlineOzM) {
        qty = Math.round(parseFloat(inlineOzM[1]) * originalCount * 10) / 10;
        unit = 'oz';
        name = name.replace(inlineOzM[0], '').replace(/\s+/g, ' ').trim();
      }

      if (ozM || mlM || inlineOzM) {
        // Strip leading container words and connector "or"/"of"
        const isJar     = unit === 'jar' || /\bjars?\b/i.test(name);
        const isBlock   = /\bblocks?\b/i.test(name);
        const isPackage = /\b(?:package|pkg|box|bag|pack)\b/i.test(name);
        name = name.replace(/^(?:can|jar|tin|block|box|package|pkg)s?\s+/i, '').trim();
        name = name.replace(/\b(?:can|jar|tin|block|box|package|pkg)s?\s+(?:or\s+)?(?:of\s+)?/gi, '').trim();
        name = name.replace(/^or\s+/i, '').trim();
        name = name.replace(/^of\s+/i, '').trim();
        name = name.replace(/^,\s*/, '').trim();
        // Note: "in brine"/"in oil"/"in water" trailing PRESERVED — per Rafi these
        // are meaningful product forms (sun-dried tomatoes in oil vs dry-pack,
        // olives in brine, capers in brine, etc.).
        // Add canned/jarred prefix unless coconut milk (always canned), block,
        // or package/box (the form is implied by being shelf-stable in pantry).
        if (!/coconut\s+milk\b/i.test(name) && !isBlock && !isPackage) {
          const prefix = isJar ? 'jarred ' : 'canned ';
          if (!/^(?:canned|jarred)\b/i.test(name)) name = prefix + name;
        }
        // Canned/jarred items go in the pantry aisle. Setting forcedCategory here
        // also prevents fmtQty from normalizing 19 oz → 1.2 lb (the conversion only
        // fires for "solid" categories like protein/produce).
        forcedCategory = 'pantry-staples';
      }
    }
  }

  // Reorder "sticks/strips/slices <noun>" → "<noun> sticks/strips/slices".
  // "3 sticks celery" → name="celery sticks"; consumer reads more naturally.
  // Skip when the leading word is being used as a unit (qty already extracted).
  if (!unit) {
    const reorderM = name.match(/^(sticks?|strips?|slices?|sprigs?|stalks?)\s+(.+)$/i);
    if (reorderM) {
      name = `${reorderM[2]} ${reorderM[1]}`;
    }
  }

  // Generic salt collapse: "kosher salt" / "sea salt" / "fine sea salt" /
  // "coarse himalayan salt" / etc. → just "salt".
  // Flavored salts (seasoning, herb, truffle, smoked, garlic, etc.) keep modifier.
  {
    const FLAVORED_SALT_HINTS = ['seasoning','seasoned','herb','herbed','truffle','smoked','garlic','onion','celery','chili','lemon','citrus','rosemary','vanilla'];
    const PLAIN_SALT_MODIFIERS = ['kosher','sea','fine','coarse','table','iodized','flaky','flake','himalayan','pink','maldon','fleur','de'];
    if (/\bsalt\b/.test(name) && !FLAVORED_SALT_HINTS.some(f => name.includes(f))) {
      // If "salt" is the dominant word and the rest is modifiers/qty noise,
      // collapse to just "salt". Allows things like "+ 1/8 teaspoon salt" or
      // "cooking / kosher salt" to all become just "salt".
      const NOISE_TOKENS = new Set(['+', '-', '/', ',', 'teaspoon','teaspoons','tsp','tablespoon','tablespoons','tbsp','of','to','taste','cooking','baking','or','and','&','plus','diamond','crystal','morton','mortons','pinch','pinches','dash','dashes','generous','small','large','big','heaping']);
      // Pre-tokenize: split on whitespace AND on slash so "cooking/kosher" → ["cooking","kosher"]
      const tokens = name.split(/[\s/]+/).filter(Boolean);
      const remainingNonModifier = tokens.filter(t =>
        t !== 'salt' &&
        !PLAIN_SALT_MODIFIERS.includes(t) &&
        !NOISE_TOKENS.has(t) &&
        !/^[\d/.]+$/.test(t)  // pure number/fraction tokens
      );
      if (remainingNonModifier.length === 0) {
        name = 'salt';
        // Salt is universally "to taste" in our system — drop the qty/unit so
        // the shopping list / nutrition layer treats it consistently regardless
        // of what brand-specific measurement the recipe author specified.
        qty = 0;
        unit = '';
      }
    }
  }

  // Paren-kg / paren-g conversion to lb. Common for whole proteins ("1 whole
  // chicken (1.5kg)" → "3.3 lb whole chicken"). Fires regardless of container word.
  {
    const kgM = name.match(/\(\s*(\d+(?:\.\d+)?)\s*kg\s*\)/i);
    const gM  = !kgM && name.match(/\(\s*(\d+)\s*g\s*\)/i);
    if (kgM) {
      const kg = parseFloat(kgM[1]);
      const lbs = Math.round(kg * 2.20462 * 10) / 10;
      qty = lbs;
      unit = 'lb';
      name = name.replace(kgM[0], '').replace(/\s+/g, ' ').trim();
    } else if (gM) {
      const g = parseInt(gM[1], 10);
      // For tiny gram counts (<100), keep as oz; otherwise convert similar to step 12
      const oz = Math.round(g * 0.03527 * 10) / 10;
      qty = oz;
      unit = 'oz';
      name = name.replace(gM[0], '').replace(/\s+/g, ' ').trim();
    }
  }

  // Unconditional leading-container cleanup: when the qty was already extracted
  // (e.g. "1 6.7 oz jar of sun-dried tomatoes" → qty=6.7, unit=oz, name="jar of
  // sun-dried tomatoes in oil"), strip the leading "jar of "/"can of "/etc.
  name = name.replace(/^(?:can|jar|tin|block|box|package|pkg)s?\s+(?:of\s+)?/i, '').trim();

  // Reorder "skinless boneless" / "skin-on bone-in" to canonical form:
  // boneless before skinless (mirrors how grocery stores label chicken).
  name = name.replace(/\bskinless\s+boneless\b/gi, 'boneless skinless');
  name = name.replace(/\bskin-on\s+bone-in\b/gi, 'bone-in skin-on');

  // Always append " cheese" to bare cheese names — consumer searches for "X cheese"
  // at the store. "parmesan" → "parmesan cheese", "grated parmesan" → "grated
  // parmesan cheese", "feta" → "feta cheese", etc.
  {
    const BARE_CHEESES = ['parmesan','feta','cheddar','mozzarella','cotija','gruyere','brie','goat','provolone'];
    for (const ch of BARE_CHEESES) {
      const re = new RegExp(`\\b${ch}\\b(?!\\s+cheese)`, 'i');
      if (re.test(name)) {
        name = name.replace(re, `${ch} cheese`);
        break;
      }
    }
  }

  // Shredded chicken/turkey/pork/beef are by definition COOKED — prefix so
  // consumer knows it's a pre-cooked item (rotisserie, leftover, etc.)
  if (/^shredded\s+(?:chicken|turkey|pork|beef)\b/i.test(name) && !/^cooked\b/i.test(name)) {
    name = 'cooked ' + name;
  }

  // Singularize plural produce/protein nouns when qty === 1.
  // "1 leeks" → "1 leek", "1 shallots" → "1 shallot", etc. Only applies to
  // a known list to avoid breaking plural-only nouns like "greens", "beans", "peas".
  if (qty === 1) {
    const SINGULARIZE_AT_ONE = [
      'leek','onion','shallot','carrot','tomato','potato','sweet potato','cucumber',
      'lemon','lime','orange','apple','pear','peach','plum','avocado','pepper',
      'bell pepper','jalapeno','jalapeño','poblano','serrano','egg','beet',
    ];
    for (const sing of SINGULARIZE_AT_ONE) {
      // Match ending with the plural form (sing + 's' or sing.replace('o','oes'))
      const plural = sing.endsWith('o') ? sing + 'es' : sing + 's';
      const re = new RegExp(`\\b${plural}\\b\\s*$`, 'i');
      if (re.test(name)) {
        name = name.replace(re, sing).trim();
        break;
      }
    }
  }

  // Salt always displays as just "salt" — drop qty/unit (it's to-taste at the store).
  if (name === 'salt') {
    qty = 0;
    unit = '';
  }
  // Same for plain pepper variants — pepper is to-taste, not a measured purchase.
  if (name === 'pepper' || name === 'black pepper' || name === 'white pepper') {
    qty = 0;
    unit = '';
  }

  const category = forcedCategory || categorizeIngredient(name || raw);
  return { qty, unit, name: name || raw.toLowerCase(), category, raw, note };
}

// ── Format helpers ─────────────────────────────────────────────────────────────

// Units that should display as plural when qty > 1 (slice → slices, etc.).
// Volume/weight units (cup, tbsp, oz, lb) stay singular by convention.
const PLURALIZABLE_UNITS = new Set([
  'slice', 'piece', 'strip', 'sprig', 'stalk', 'clove',
  'wedge', 'pinch', 'dash', 'drop',
  'can', 'jar', 'tin', 'block', 'box', 'bag', 'package',
  'bunch', 'head', 'ear', 'sheet', 'stick',
]);
function pluralize(unit: string, qty: number): string {
  if (qty <= 1 || !PLURALIZABLE_UNITS.has(unit)) return unit;
  if (unit === 'leaf') return 'leaves';
  return unit + 's';
}

export function fmtQty(qty: number, unit: string, category?: string): string {
  if (!qty) return unit || '';
  const solidCategories = new Set(['protein', 'produce', 'meat', 'seafood', 'frozen']);
  if (unit === 'lb' || (unit === 'oz' && category && solidCategories.has(category))) {
    const n = normalizeWeight(qty, unit);
    return `${fmtNum(n.qty)} ${pluralize(n.unit, n.qty)}`;
  }
  if (unit === 'tsp' || unit === 'tbsp') {
    const parts = normalizeVolume(qty, unit);
    return parts.map(p => `${fmtNum(p.qty)} ${p.unit}`).join(' + ');
  }
  return unit ? `${fmtNum(qty)} ${pluralize(unit, qty)}` : fmtNum(qty);
}

// Dairy internal sort: eggs first, then cheeses, then sour cream/yogurt, then milks/cream/butter
export function getDairyGroup(name: string): number {
  const n = name.toLowerCase();
  if (n.includes('egg')) return 1;
  const cheeses = [
    'parmesan','parmigiano','pecorino','romano','mozzarella','burrata','feta','cotija',
    'queso','cheddar','jack','gruyere','brie','camembert','goat cheese','ricotta',
    'mascarpone','cream cheese','cottage cheese','cheese',
  ];
  if (cheeses.some(c => n.includes(c))) return 2;
  if (n.includes('sour cream') || n.includes('crème') || n.includes('yogurt')) return 3;
  return 4;
}

// ── Misc utilities ─────────────────────────────────────────────────────────────

// Normalizes a raw ingredient string before parsing:
// decodes HTML entities, strips asterisks, removes "plus more…" clauses, normalizes olive oil.
export function normalizeIngredient(raw: string): string {
  let s = raw.trim();
  s = s
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&nbsp;/gi, ' ');
  s = s.replace(/^\*+\s*/, '');
  s = s.replace(/\(\([^)]*\)\)/g, '').trim();
  s = s.replace(/,?\s*plus more\b.*/i, '').trim();
  s = s.replace(/,?\s*\(plus more[^)]*\)/i, '').trim();
  s = s.replace(/,?\s*if (?:necessary|needed)\b.*/i, '').trim();
  s = s.replace(/,?\s*or more\b.*/i, '').trim();
  s = s.replace(/,?\s*(?:use\s+)?to\s+(?:your\s+)?taste\b.*/i, '').trim();
  s = s.replace(/,?\s*for\s+(?:serving|garnish(?:ing)?|topping)\b.*/i, '').trim();
  s = s.replace(/\bextra[- ]?virgin olive oil\b/gi, 'olive oil');
  s = s.replace(/\bevoo\b/gi, 'olive oil');
  s = s.replace(/\b(?:light|pure) olive oil\b/gi, 'olive oil');
  return s.trim();
}

// Normalizes a protein type label for display and search matching.
export function normalizeProtein(protein: string): string {
  return protein.trim().toLowerCase();
}

// Formats a rating string like "4.9 (180 ratings)" → "4.9/5 · 180 ratings"
export function formatRating(rating: string | undefined | null): string | null {
  if (!rating || rating === 'NR' || rating === 'N/A') return null;
  const withCount = rating.match(/^([\d.]+)\s*\((\d[\d,]*)\s*rating/i);
  if (withCount) return `${withCount[1]}/5 · ${withCount[2]} ratings`;
  const num = parseFloat(rating);
  if (!isNaN(num)) return `${num}/5`;
  return null;
}
