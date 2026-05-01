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
  'heavy cream':'dairy','heavy whipping cream':'dairy','half and half':'dairy',
  'sour cream':'dairy','cream cheese':'dairy','ricotta':'dairy',
  'mascarpone':'dairy','cottage cheese':'dairy',
  'parmesan':'dairy','mozzarella':'dairy','cheddar':'dairy','feta':'dairy',
  'gruyere':'dairy','brie':'dairy','goat cheese':'dairy','gouda':'dairy',
  'provolone':'dairy','swiss cheese':'dairy','pepper jack':'dairy',
  'mexican cheese':'dairy','queso fresco':'dairy','cotija':'dairy',
  'plain greek yogurt':'dairy','greek yogurt':'dairy','yogurt':'dairy',
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
  return s.replace(/\s+for\s+(?:serving|garnish(?:ing)?|topping)\b.*/i, '').trim().toLowerCase();
}

// Splits "steamed rice, naan for serving" → ["steamed rice", "naan for serving"]
// and "steamed rice and naan for serving" → ["steamed rice", "naan for serving"]
// but keeps "boneless, skinless chicken thighs" as one item.
export function splitIngredientLine(raw: string): string[] {
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
    /,?\s*(?:to|for)\s+(?:squeeze|drizzle|drizzling|spoon|pour|pouring)(?:\s+(?:over|on))?\b.*$/i,
    /,?\s*to\s+taste\b.*$/i,
    /,?\s*as\s+needed\b.*$/i,
  ];
  for (const pat of suffixPatterns) {
    const m = raw.match(pat);
    if (m) {
      trailingSuffix = m[0].replace(/^,?\s*/, ', ');
      raw = raw.slice(0, m.index!).trim();
      break;
    }
  }

  // Pass 1: comma-based split — only split when the right segment is a known DB ingredient
  const commaParts = raw.split(/,\s*/);
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

  // Pass 2: "and" / "or" / "/" split — split when BOTH sides END with a known DB ingredient
  const final: string[] = [];
  for (const segment of working) {
    let didSplit = false;
    for (const sep of [' and ', ' or ', '/']) {
      const idx = segment.toLowerCase().indexOf(sep);
      if (idx < 0) continue;
      const before = segment.slice(0, idx).trim();
      const after  = segment.slice(idx + sep.length).trim();
      if (endsWithKnownIngredient(before) && endsWithKnownIngredient(after)) {
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
  'finely','coarsely','thinly','tightly','blanched','chopped','cut','trimmed',
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
  'thin','fine','finely','coarsely','thinly','bite-sized','bite-size',
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
  // NOTE: bare 'coriander' NOT aliased — could be seeds (spice) or leaves depending on region
  'dill weed':'dill',
  'spearmint':'mint',
  'thyme leaves':'thyme', 'thyme sprig':'thyme',
  'rosemary sprig':'rosemary',
  'sage leaf':'sage',
  // Onion family
  'green onion':'scallion', 'spring onion':'scallion', 'scallions':'scallion', 'green onions':'scallion',
  // Garlic — normalize word order; bare "garlic" = cloves
  'garlic clove':'garlic cloves',
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
  'parmesan cheese':'parmesan',
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
  let m = str.match(/^(\d+)\s+(\d+)\/(\d+)/);
  if (m) return parseInt(m[1]) + parseInt(m[2]) / parseInt(m[3]);
  m = str.match(/^(\d+)\/(\d+)/);
  if (m) return parseInt(m[1]) / parseInt(m[2]);
  m = str.match(/^(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/);
  if (m) return (parseFloat(m[1]) + parseFloat(m[2])) / 2;
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
    // Stray "I use X" sentences (not preceded by a real ingredient)
    if (/^I\s+(?:use|have|recommend|like|love)\s+/i.test(trimmed) && trimmed.length < 50) {
      return { qty: 0, unit: '', name: '', category: 'pantry-staples', raw, note };
    }
  }

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
  str = str.replace(/(\d)([\u00BC-\u00BE\u2150-\u215E])/g, '$1 $2');
  for (const [k, v] of Object.entries(FRACTION_MAP)) str = str.split(k).join(v);
  str = str.trim();

  // 2. Strip parenthetical notes that are clearly recipe instructions, NOT purchase specs.
  // Keep: size/weight specs like "(1 1/2-inch-thick)", "(6 oz)", "(bone-in)"
  // Strip: recipe notes like "(see note)", "(Note 1)", double-parens
  str = str.replace(/\(\([^)]*\)\)/g, '').replace(/\(Note\s*\d*\)/gi, '').trim();
  // Only strip long parens that contain letters suggesting a recipe note (e.g. "see", "page", "about")
  str = str.replace(/\((?:see|about|note|if|for|use|make|recipe)[^)]*\)/gi, '').trim();

  // 2b. Detect serving / garnish / taste markers BEFORE stripping them.
  // The marker is surfaced as the "unit" so it shows in the qty column
  // instead of being lost ("lime wedges, to squeeze over the fajitas" →
  // qty="" unit="to serve" name="lime wedges").
  let servingMarker = '';
  // "to taste" / "use to taste" / "to your taste" / "as needed"
  if (/,?\s*(?:use\s+)?to\s+(?:your\s+)?taste\b|,?\s*as\s+needed\b/i.test(str)) {
    servingMarker = 'to taste';
    str = str.replace(/,?\s*(?:use\s+)?to\s+(?:your\s+)?taste\b.*/i, '').trim();
    str = str.replace(/,?\s*as\s+needed\b.*/i, '').trim();
  }
  // Garnish: "for garnish", "to garnish", "for garnishing", "for topping",
  //          "to top", "to top with"
  else if (/,?\s*(?:for|to)\s+(?:garnish(?:ing)?|topping|top(?:ping)?)\b/i.test(str)) {
    servingMarker = 'to garnish';
    str = str.replace(/,?\s*(?:for|to)\s+(?:garnish(?:ing)?|topping|top(?:ping)?\s*(?:with)?)\b.*/i, '').trim();
  }
  // Serving: "for serving", "to serve", "to/for drizzle/drizzling/squeeze/spoon/pour [over X]"
  // ("over/on" optional so "olive oil, to drizzle" / "...for drizzling" also fire)
  else if (/,?\s*(?:for\s+serving|to\s+serve|(?:to|for)\s+(?:squeeze|drizzle|drizzling|spoon|pour|pouring)(?:\s+(?:over|on))?)\b/i.test(str)) {
    servingMarker = 'to serve';
    str = str.replace(/,?\s*(?:for\s+serving|to\s+serve|(?:to|for)\s+(?:squeeze|drizzle|drizzling|spoon|pour|pouring)(?:\s+(?:over|on))?)\b.*/i, '').trim();
  }

  // 2c. Strip bare recipe-note suffixes (no parens around them):
  //     "chicken legs see notes above"  →  "chicken legs"
  //     "kosher salt preferably diamond crystal"  →  "kosher salt"
  //     "olive oil such as California Olive Ranch"  →  "olive oil"
  str = str.replace(/,?\s*see\s+notes?\s*(?:above|below|for\s+\w+)?\s*\.?$/i, '').trim();
  str = str.replace(/,?\s*preferably\b.*$/i, '').trim();
  str = str.replace(/,?\s*such\s+as\b.*$/i, '').trim();
  str = str.replace(/,?\s*ideally\b.*$/i, '').trim();
  str = str.replace(/,?\s*or\s+any\s+(?:other|similar)\b.*$/i, '').trim();
  str = str.replace(/,?\s*depending\s+on\b.*$/i, '').trim();
  str = str.replace(/,?\s*plus\s+(?:more|extra)\b.*$/i, '').trim();
  str = str.replace(/,?\s*at\s+room\s+temperature\b.*$/i, '').trim();
  // "N lemons/limes/oranges, sliced into rounds/slices/wedges" → "1 <citrus>"
  // (3-4 lemon rounds come from cutting one lemon, not buying 3-4 lemons).
  // MUST fire BEFORE the "into rounds" trailing strip below or "rounds" gets eaten.
  str = str.replace(/^\d+(?:\s*[-–]\s*\d+)?\s+(lemons?|limes?|oranges?),?\s+sliced\s+(?:into\s+)?(?:rounds|slices|wedges)\b.*$/i,
    (_, citrus) => `1 ${citrus.replace(/s$/i, '')}`);
  // Trailing prep instructions about how the ingredient is cut/shaped:
  //   "potatoes, scrubbed and chopped into 1/2-inch chunks" → strip from "into" on
  //   "lemons, sliced into rounds" → strip "into rounds"
  //   "tomatoes, sliced in half" / "in halves" → strip
  //   "ears of corn, shucked raw" → strip "raw"
  // Word-based forms first
  str = str.replace(/,?\s*(?:in|into)\s+(?:half|halves|rounds|slices|wedges|chunks|cubes|pieces|florets|bite[\s-]size\s+\w+)\b.*$/i, '').trim();
  // Digit-based: "into 1/2-inch chunks", "into 3-inch pieces", "into 1 inch cubes"
  str = str.replace(/,?\s*(?:in|into)\s+\d[^,]*$/i, '').trim();
  // Unicode-fraction-based: "into ½ inch thick rounds" — fractions get normalized
  // to digits later but at this point they're still ½/¼/etc.
  str = str.replace(/,?\s*(?:in|into)\s+[¼-¾⅐-⅞][^,]*$/i, '').trim();
  // Trailing "cut" / "cut in <word>" leftovers from prior partial strips
  str = str.replace(/,?\s*cut\b.*$/i, '').trim();
  str = str.replace(/,?\s*raw\s*$/i, '').trim();
  // Trailing em-dash / hyphen + prep instruction: "1 shallot - finely chopped."
  str = str.replace(/\s*[-–—]\s*(?:finely|coarsely|roughly|thinly)?\s*(?:chopped|minced|sliced|diced|grated|peeled|crushed|halved|quartered|cubed|julienned|grated|shredded)\.?\s*$/i, '').trim();
  // Trailing standalone period
  str = str.replace(/\.\s*$/, '').trim();
  // "1/3 cup plus 1 tablespoon X" → combine to total tbsp
  // 1/3 cup = 5.33 tbsp + 1 tbsp ≈ 6 tbsp
  str = str.replace(/^(\d+(?:\s+\d+)?\/\d+|\d+\.?\d*)\s+cups?\s+plus\s+(\d+(?:\.\d+)?)\s+(?:tablespoons?|tbsp)\b/i,
    (_, cupStr, tbspStr) => {
      let cupVal = 0;
      const fracM = cupStr.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
      if (fracM) {
        const whole = fracM[1] ? parseInt(fracM[1]) : 0;
        cupVal = whole + parseInt(fracM[2]) / parseInt(fracM[3]);
      } else {
        cupVal = parseFloat(cupStr);
      }
      const totalTbsp = Math.round(cupVal * 16 + parseFloat(tbspStr));
      return `${totalTbsp} tbsp`;
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
  // "handful of <herb>" / "small handful of <herb>" / "large handful of <herb>"
  //                                                              →  "1/2 bunch <herb>"
  // Handful is colloquial for "about half a bunch" of fresh herbs
  {
    const handfulM = str.match(/^(?:a\s+|an\s+)?(?:small\s+|large\s+|big\s+)?handful\s+of\s+(.+)$/i);
    if (handfulM) {
      let herb = handfulM[1].replace(/\bleaves\b/i, '').trim();
      str = `1/2 bunch ${herb}`;
    }
  }
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
    'cleaned', 'rinsed', 'dried', 'patted', 'packed', 'scrubbed',
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
    'finely', 'coarsely', 'freshly', 'roughly', 'thinly', 'thickly',
    'medium', // "medium" is the default size — strip; keep small/large
    'unsalted', // butter default is salted — strip "unsalted" so name → "butter"
  ];
  for (const w of PREP_WORDS_SINGLE) {
    // Use hyphen-aware boundaries so "full-fat" isn't broken by the "fat" strip,
    // "low-sodium" isn't broken by something inside it, etc.
    str = str.replace(new RegExp(`(?<!-)\\b${w}\\b(?!-)`, 'gi'), '');
  }
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

  // 3. Vague quantities — return early with no scalable number
  const strLower = str.toLowerCase();
  for (const vague of VAGUE_WORDS) {
    if (strLower.startsWith(vague)) {
      const vagueNameStr = str.slice(vague.length).replace(/^[,\s:]+/, '').trim();
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
  const qtyPat = /^((?:\d+\s+)?\d+\/\d+|\d+\.?\d*(?:\s*[-–]\s*\d+\.?\d*)?)/;
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
    str = firstIsPrep ? str.slice(0, commaIdx).trim() : str.replace(/,\s*/g, ' ').trim();
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
        const HERBS = ['ginger','cilantro','parsley','basil','mint','dill','chives','tarragon','thyme','rosemary','sage','oregano'];
        if (HERBS.includes(next)) return true;
      }
      return false;
    })
    .join(' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

  name = name.replace(/^(of|a|an|the)\s+/, '');
  name = name.replace(/\s+for$/, '').trim();

  if (name.includes(' or ')) {
    const parts = name.split(' or ');
    name = parts.find(p => INGREDIENT_DB[p.trim()]) || parts[0].trim();
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

  // 17. Special cases & alias map
  if (unit === 'clove' && !name) name = 'garlic';
  if (unit === 'clove' && (name === 'garlic' || name === 'garlic cloves')) { name = 'garlic cloves'; unit = ''; }
  if (unit === 'head'  && name === 'garlic') { name = 'garlic (whole head)'; unit = ''; }
  // Garlic measured in tsp/tbsp (minced) → convert to clove-equivalent so it aggregates cleanly
  if ((unit === 'tsp' || unit === 'tbsp') && (name === 'garlic' || name === 'garlic cloves')) {
    qty = Math.round((unit === 'tbsp' ? qty * 3 : qty) * 10) / 10;
    unit = '';
    name = 'garlic cloves';
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

      // Try paren-oz first: "(15-oz.)", "(28-ounce)", "(7 ounce)"
      const ozM = name.match(/\(\s*(\d+(?:\.\d+)?)[\s.\-]*(oz|ounce|fl\s*oz|fluid\s+ounce)s?\.?[^)]*\)/i);
      // Try paren-ml: "(160ml)", "(160 ml)" — convert to oz (1ml ≈ 0.0338 oz)
      const mlM = !ozM && name.match(/\(?\s*(\d+(?:\.\d+)?)\s*ml\b/i);
      // Try inline-oz: "19 oz tin", "15 ounce can"
      const inlineOzM = !ozM && !mlM && name.match(/\b(\d+(?:\.\d+)?)\s*(?:oz|ounce)s?\b/i);

      if (ozM) {
        qty = Math.round(parseFloat(ozM[1]) * originalCount * 10) / 10;
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
        const isJar  = unit === 'jar' || /\bjars?\b/i.test(name);
        const isBlock = /\bblocks?\b/i.test(name);
        name = name.replace(/^(?:can|jar|tin|block|box|package|pkg)s?\s+/i, '').trim();
        name = name.replace(/\b(?:can|jar|tin|block|box|package|pkg)s?\s+(?:or\s+)?(?:of\s+)?/gi, '').trim();
        name = name.replace(/^or\s+/i, '').trim();
        name = name.replace(/^of\s+/i, '').trim();
        name = name.replace(/^,\s*/, '').trim();
        // Strip "in brine"/"in oil"/"in water" trailing — preserved by recipe but
        // not a buying-relevant detail (most cheeses/olives in brine are sold in brine)
        name = name.replace(/\s+in\s+(?:brine|oil|water|syrup)\s*$/i, '').trim();
        // Add canned/jarred prefix unless coconut milk (always canned)
        if (!/coconut\s+milk\b/i.test(name)) {
          const prefix = isJar ? 'jarred ' : isBlock ? '' : 'canned ';
          if (prefix && !/^(?:canned|jarred)\b/i.test(name)) name = prefix + name;
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
      // collapse to just "salt". Allows the qty extraction to leave "+ 1/8
      // teaspoon salt" → "salt" by ignoring the noise tokens.
      const NOISE_TOKENS = new Set(['+', '-', '/', ',', 'teaspoon','teaspoons','tsp','tablespoon','tablespoons','tbsp','of','to','taste']);
      const tokens = name.split(/\s+/);
      const remainingNonModifier = tokens.filter(t =>
        t !== 'salt' &&
        !PLAIN_SALT_MODIFIERS.includes(t) &&
        !NOISE_TOKENS.has(t) &&
        !/^[\d/.]+$/.test(t)  // pure number/fraction tokens
      );
      if (remainingNonModifier.length === 0) name = 'salt';
    }
  }

  // Salt always displays as just "salt" — drop qty/unit (it's to-taste at the store).
  if (name === 'salt') {
    qty = 0;
    unit = '';
  }

  const category = forcedCategory || categorizeIngredient(name || raw);
  return { qty, unit, name: name || raw.toLowerCase(), category, raw, note };
}

// ── Format helpers ─────────────────────────────────────────────────────────────

export function fmtQty(qty: number, unit: string, category?: string): string {
  if (!qty) return unit || '';
  const solidCategories = new Set(['protein', 'produce', 'meat', 'seafood', 'frozen']);
  if (unit === 'lb' || (unit === 'oz' && category && solidCategories.has(category))) {
    const n = normalizeWeight(qty, unit);
    return `${fmtNum(n.qty)} ${n.unit}`;
  }
  if (unit === 'tsp' || unit === 'tbsp') {
    const parts = normalizeVolume(qty, unit);
    return parts.map(p => `${fmtNum(p.qty)} ${p.unit}`).join(' + ');
  }
  return unit ? `${fmtNum(qty)} ${unit}` : fmtNum(qty);
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
