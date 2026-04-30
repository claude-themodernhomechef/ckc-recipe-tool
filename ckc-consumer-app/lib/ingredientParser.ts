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

  // Pass 2: "and" / "or" / "/" split — only split when BOTH sides are known DB ingredients
  const final: string[] = [];
  for (const segment of working) {
    let didSplit = false;
    for (const sep of [' and ', ' or ', '/']) {
      const idx = segment.toLowerCase().indexOf(sep);
      if (idx < 0) continue;
      const before = segment.slice(0, idx).trim();
      const after  = segment.slice(idx + sep.length).trim();
      const bCleaned = cleanForDbLookup(before);
      const aCleaned = cleanForDbLookup(after);
      if (INGREDIENT_DB[bCleaned] && INGREDIENT_DB[aCleaned]) {
        final.push(before, after);
        didSplit = true;
        break;
      }
    }
    if (!didSplit) final.push(segment);
  }
  return final;
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
};

// Words that come after a comma and are always prep instructions, not product descriptors.
// "garlic, minced" → strip; "boneless, skinless chicken" → keep (not all prep words)
const PREP_WORDS = new Set([
  'minced','sliced','grated','shredded','peeled','crushed','halved','quartered',
  'julienned','cubed','torn','trimmed','zested','deveined','pitted','cored','seeded',
  'divided','optional','drained','rinsed','softened','melted','cooled','roughly',
  'finely','coarsely','thinly','tightly','blanched','chopped','cut','trimmed',
]);

const STOP_WORDS = [
  // Size / state — don't change what you buy
  'freshly','fresh','large','medium','small','whole','ripe','packed',
  'heaping','leveled','rounded','about','approximately',
  // Prep instructions — how to cut or treat, never what to buy
  'roughly','minced','sliced','grated','shredded','peeled','crushed',
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
  'few','handful','pinch','dash','splash','sprinkle','drizzle',
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
  'fresh cilantro':'cilantro', 'coriander leaves':'cilantro',
  // NOTE: bare 'coriander' NOT aliased — could be seeds (spice) or leaves depending on region
  'fresh dill':'dill', 'dill weed':'dill',
  'fresh mint':'mint', 'spearmint':'mint',
  'fresh thyme':'thyme', 'thyme leaves':'thyme', 'thyme sprig':'thyme',
  'rosemary sprig':'rosemary', 'fresh rosemary':'rosemary',
  'sage leaf':'sage', 'fresh sage':'sage',
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
  'whole milk mozzarella':'mozzarella', 'shredded mozzarella':'mozzarella',
  'parmesan cheese':'parmesan', 'grated parmesan':'parmesan',
  'parmigiano reggiano':'parmesan', 'pecorino romano':'parmesan',
  'heavy whipping cream':'heavy cream', 'whipping cream':'heavy cream',
  'mexican cheese blend':'mexican cheese', 'colby jack':'mexican cheese',
};

// ── Number helpers ─────────────────────────────────────────────────────────────

const STD_FRACS = [
  { val:0.25, sym:'¼' }, { val:1/3, sym:'⅓' }, { val:0.5, sym:'½' },
  { val:2/3, sym:'⅔' }, { val:0.75, sym:'¾' },
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

  // 0-pre. Section headers ("For the dressing:", "For the sauce:", "Sauce:") are
  // not ingredients — return early with empty name so callers can skip them.
  {
    const headerMatch = /^(?:for\s+the\s+)?[a-z\s]+:\s*$/i.test(str.trim());
    if (headerMatch) {
      return { qty: 0, unit: '', name: '', category: 'pantry-staples', raw, note };
    }
  }

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
      const toTaste = /to\s+taste|as\s+needed/i.test(str);
      str = toTaste ? 'salt + pepper, to taste' : 'salt + pepper';
    }
  }

  // 0. Decode HTML entities and strip footnote markers
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

  // 2b. Strip instruction suffixes that bleed into ingredient names.
  // "use to your taste", "to your taste", "use to taste" — variants not caught by comma logic
  str = str.replace(/,?\s*use\s+to\s+(?:your\s+)?taste\b.*/i, '').trim();
  str = str.replace(/,?\s*to\s+your\s+taste\b.*/i, '').trim();
  // "for serving", "for garnish(ing)", "for topping" — stop-word filter catches "serving"
  // but leaves the orphaned "for" behind; strip the whole phrase here instead
  str = str.replace(/,?\s*for\s+(?:serving|garnish(?:ing)?|topping)\b.*/i, '').trim();

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
  str = str.replace(/,?\s*plus\s+more\s+(?:for|to|as\s+needed)\b.*$/i, '').trim();

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
    'chopped', 'minced', 'grated', 'shredded', 'diced', 'sliced', 'crushed',
    'mashed', 'peeled', 'halved', 'quartered', 'cubed', 'julienned',
    'beaten', 'whisked', 'melted', 'softened',
    'squeezed', 'torn', 'pitted',
    // NOT stripped: 'crumbled' (cotija/feta/bacon are sold pre-crumbled),
    //               'shredded' for cheese — debatable, keeping stripped for now
    'finely', 'coarsely', 'freshly', 'roughly', 'thinly', 'thickly',
    'small', 'medium', 'large', 'big', 'jumbo',
  ];
  for (const w of PREP_WORDS_SINGLE) {
    str = str.replace(new RegExp(`\\b${w}\\b`, 'gi'), '');
  }
  // Collapse double-spaces and stray commas left behind
  str = str.replace(/\s{2,}/g, ' ').replace(/\s*,\s*,\s*/g, ', ').replace(/^[,\s]+|[,\s]+$/g, '').trim();

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
    const piecePrefixM = str.match(/^(\d+)\s*[xX×]\s+/);
    if (piecePrefixM) {
      pieceCount = parseInt(piecePrefixM[1]);
      str = str.slice(piecePrefixM[0].length).trim();
    }
  }

  // 6. Strip dual metric/imperial — keep only the imperial part
  str = str.replace(/\d+\.?\d*\s*(?:g|kg|ml|l)\s*[/|]\s*/gi, '');

  // 7. Pre-normalize "zest/juice/peel of N ingredient" → "N ingredient zest/juice/peel"
  str = str.replace(/^(zest|juice|peel|rind)\s+(?:of|from)\s+((?:\d+\s+)?\d+\/\d+|\d+\.?\d*|one|two|three|four|five|six|seven|eight|nine|ten|half|a|an)\s+(.+)$/i,
    (_, prep, num, ing) => {
      const n = TEXT_NUMBERS[num.toLowerCase()] != null ? TEXT_NUMBERS[num.toLowerCase()] : num;
      return `${n} ${ing.trim()} ${prep.toLowerCase()}`;
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

  // 12. Convert metric to imperial
  if (unit === 'g')  { qty = Math.round(qty * 0.03527 * 100) / 100; unit = 'oz'; }
  if (unit === 'kg') { qty = Math.round(qty * 2.20462 * 100) / 100; unit = 'lb'; }
  if (unit === 'ml') { qty = Math.round(qty * 0.033814 * 100) / 100; unit = 'oz'; }
  if (unit === 'l')  { qty = Math.round(qty * 33.814 * 100) / 100; unit = 'oz'; }

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

  // 15. Clean name: strip remaining parens, filter stop words
  let name = str
    .replace(/\(.*?\)/g, '')
    .replace(/\).*$/, '')
    .replace(/^juice (?:of|from)\s+(?:(?:\d+\s+)?\d+(?:\/\d+)?|\d+\.?\d*)?\s*/i, '')
    .replace(/^zest (?:of|from)\s+(?:(?:\d+\s+)?\d+(?:\/\d+)?|\d+\.?\d*)?\s*/i, '')
    .split(/\s+/)
    .filter(w => !STOP_WORDS.includes(w.toLowerCase()))
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
  // Fresh ginger in inches → tbsp (1 inch ≈ 1 tsp microplaned; use tbsp as rough equivalent)
  if (unit === 'inch' && (name === 'ginger' || name === 'fresh ginger')) { unit = 'tbsp'; name = 'ginger'; }

  name = INGREDIENT_ALIASES[name] || name;

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
