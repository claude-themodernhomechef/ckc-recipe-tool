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
  // Round 34
  'ginger-garlic paste':'pantry-staples','ginger garlic paste':'pantry-staples',
  'marinara sauce':'pantry-staples','tomato basil sauce':'pantry-staples',
  'wild rice':'pantry-staples','wild rice blend':'pantry-staples',
  // Round 30 DB — unsticks bottom-tier recipes
  'cooked shredded chicken':'protein','shredded chicken':'protein',
  'enchilada sauce':'pantry-staples','red enchilada sauce':'pantry-staples',
  'shredded cheese':'dairy','shredded mexican cheese':'dairy','mexican cheese blend':'dairy',
  'stone-ground polenta':'pantry-staples','polenta':'pantry-staples',
  'center cut bacon':'protein','center-cut bacon':'protein',
  'center-cut salmon':'protein','center cut salmon':'protein',
  'salmon filets':'protein','center-cut salmon filets':'protein',
  // Round 51 DB additions
  'pizza dough':'pantry-consumables',
  'brisket':'protein','baby back ribs':'protein',
  'pickle juice':'pantry-staples','aquafaba':'pantry-staples',
  'cheese tortellini':'pantry-consumables','tortellini':'pantry-consumables',
  'harissa':'pantry-staples',
  'thai chiles':'produce','thai chile':'produce','red chili':'produce',
  'plum tomatoes':'produce','grape tomatoes':'produce','cherry tomatoes':'produce',
  'red curry paste':'pantry-staples','green curry paste':'pantry-staples',
  'plant-based milk':'dairy',
  'extra virgin olive oil':'pantry-staples',
  'roasted cashews':'pantry-staples','cumin seeds':'pantry-staples',
  'maple syrup':'pantry-staples','pure maple syrup':'pantry-staples',
  'peanut oil':'pantry-staples','roasted peanut oil':'pantry-staples',
  // Round 50 DB additions
  'creamy peanut butter':'pantry-staples','smooth peanut butter':'pantry-staples',
  'natural peanut butter':'pantry-staples',
  'whole grain mustard':'pantry-staples','whole-grain mustard':'pantry-staples',
  'flank steak':'protein','onion soup mix':'pantry-staples',
  'rolled oats':'pantry-staples','old-fashioned rolled oats':'pantry-staples',
  'roasted corn kernels':'produce','roasted corn':'produce',
  'shredded cheddar cheese':'dairy','shredded cheddar':'dairy',
  'mixed greens':'produce','baby arugula':'produce',
  'low-sodium tamari':'pantry-staples','tamari':'pantry-staples',
  'lite coconut milk':'pantry-staples','light coconut milk':'pantry-staples',
  'little gem lettuce':'produce',
  'mccormick grill mates brazilian steak house marinade':'pantry-staples',
  "mike's mighty fried garlic chicken ramen soup":'pantry-staples',
  'ramen noodles':'pantry-staples','ramen':'pantry-staples',
  // Round 47 DB additions
  "lawry's seasoning salt":'pantry-staples',"lawrys seasoning salt":'pantry-staples',
  'seasoning salt':'pantry-staples',
  '93% lean ground turkey':'protein','85% lean ground turkey':'protein','99% lean ground turkey':'protein',
  '85% lean ground beef':'protein','90% lean ground beef':'protein','93% lean ground beef':'protein',
  'fresh sage':'produce','fresh thyme':'produce','fresh rosemary':'produce',
  'pickled ginger':'pantry-staples','lacinato kale':'produce','pork belly':'protein',
  // Round 46 DB additions
  'key limes':'produce','key lime':'produce',
  'kalamata olives':'pantry-staples','kalamata olive':'pantry-staples',
  'sun-dried tomatoes':'pantry-staples','sun dried tomatoes':'pantry-staples',
  'turkey sausage':'protein','marinara sauce':'pantry-staples',
  // Round 45 DB additions
  'hard boiled eggs':'protein','hard boiled egg':'protein',
  'habanero pepper':'produce','habanero':'produce',
  'ground cardamom':'pantry-staples',
  'romaine lettuce':'produce','green leaf lettuce':'produce','butter lettuce':'produce',
  // Round 44 DB additions
  'candied walnuts':'pantry-staples','candied pecans':'pantry-staples',
  'gluten-free pasta':'pantry-staples',
  'garam masala':'pantry-staples','grapefruit':'produce','grapefruit zest':'produce',
  // Round 43 DB additions
  'fried almonds':'pantry-staples',
  'fingerling potatoes':'produce','baby back pork ribs':'protein','chicken sausage':'protein',
  'jumbo shrimp':'protein','extra-jumbo shrimp':'protein',
  'fig preserves':'pantry-staples','coconut flakes':'pantry-staples',
  'frozen spinach':'produce','frozen peas':'produce','frozen edamame':'produce',
  // Round 42 DB additions (user wants kept as-is)
  'crunchy peanut butter':'pantry-staples',
  'coarse mustard':'pantry-staples','stone-ground mustard':'pantry-staples','wholegrain mustard':'pantry-staples',
  'canned diced fire-roasted tomatoes':'pantry-staples',
  'fire-roasted tomatoes':'pantry-staples',
  'pearl couscous':'pantry-staples','black lentils':'pantry-staples','beluga lentils':'pantry-staples',
  'long-grain white rice':'pantry-staples','linguine':'pantry-staples',
  'cashew butter':'pantry-staples','blue cheese':'dairy','wonton strips':'pantry-consumables',
  'bacon bits':'protein','sourdough bread':'pantry-consumables',
  'dark lager':'pantry-staples','lemon pepper seasoning':'pantry-staples',
  // Round 40 DB additions
  'better that bouillon chicken base':'pantry-staples', // typo of 'than' kept as user spec
  'better than bouillon chicken base':'pantry-staples',
  'bone-in english-cut beef short ribs':'protein','english-cut beef short ribs':'protein',
  'bone-in skin-on chicken breast and thighs':'protein',
  'canned mild hatch chilies':'pantry-staples','mild hatch chilies':'pantry-staples',
  'hatch chilies':'pantry-staples','hatch chiles':'pantry-staples',
  'bartlett pears':'produce','bartlett pear':'produce',
  'fresh italian parsley':'produce','fresh green onion':'produce',
  'fresh oregano':'produce','fresh cilantro':'produce','fresh parsley':'produce',
  'lacinato kale':'produce','red leaf lettuce':'produce','bibb lettuce':'produce',
  'liquid aminos':'pantry-staples','okra':'produce','black tea':'pantry-staples',
  'andouille sausage':'protein','italian sausage':'protein','bulk italian sausage':'protein',
  // Round 39 DB additions
  'asafoetida':'pantry-staples','hing':'pantry-staples',
  'frozen shelled edamame':'produce','shelled edamame':'produce',
  'andouille sausage':'protein','ancho chilies':'pantry-staples','ancho chiles':'pantry-staples',
  'artichoke hearts':'pantry-staples','aleppo pepper':'pantry-staples',
  'baby bok choy':'produce','bok choy':'produce',
  // Round 29 DB additions
  'green chiles':'pantry-staples','green chile':'pantry-staples',
  'castelvetrano olives':'pantry-staples','frescatrano olives':'pantry-staples',
  'cavatappi':'pantry-staples',
  'lo mein':'pantry-staples','lo mein noodles':'pantry-staples','egg noodles':'pantry-staples',
  'cornbread mix':'pantry-staples','cornbread':'pantry-consumables',
  'instant yeast':'pantry-staples','active dry yeast':'pantry-staples','dry yeast':'pantry-staples',
  'blackened seasoning':'pantry-staples','tuscan seasoning':'pantry-staples',
  'havarti':'dairy','havarti dill':'dairy',
  'crusty bread':'pantry-consumables','italian bread':'pantry-consumables','sourdough bread':'pantry-consumables',
  'butternut squash':'produce','honeynut squash':'produce',
  'mediterranean salad':'produce',
  'beets':'produce','beet':'produce','golden beets':'produce',
  'asparagus':'produce','asparagus spears':'produce',
  'coconut manna':'pantry-consumables','coconut butter':'pantry-consumables',
  'anchovy':'pantry-staples','anchovies':'pantry-staples','anchovy fillets':'pantry-staples','anchovy paste':'pantry-staples',
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
  'sweet peppers':'produce','mini sweet peppers':'produce','hot peppers':'produce',
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
  // Pre-strip leading qualifier words ("scant 1 tsp X" / "heaping 1 cup Y") so the
  // mega-paragraph splitter doesn't treat them as a bare ingredient before the qty.
  raw = raw.replace(/^\s*(?:scant|heaping|lightly|generous|generously|rounded|level|packed)\s+(?=\d)/i, '').trim();
  // "X & Y, for serving/garnish/topping" / "X + Y, for serving" — split into 2
  // when the line has no qty/unit and ends with a serving suffix.
  // Example: "Extra cranberries & cilantro" / "avocado wedges + sesame seeds, for serving"
  {
    const ampPlusM = raw.match(/^\s*(?:extra\s+|fresh\s+|optional[:,\s]+)?([\w\s-]+?)\s*[&+]\s*([\w\s-]+?)(\s*,?\s*(?:for\s+(?:serving|garnish(?:ing)?|topping)|to\s+(?:serve|garnish|top))\b.*)?$/i);
    if (ampPlusM && !/\d/.test(ampPlusM[1] + ampPlusM[2])) {
      const left = ampPlusM[1].trim();
      const right = ampPlusM[2].trim();
      const suffix = ampPlusM[3] || '';
      if (left.length > 1 && right.length > 1 && left.split(/\s+/).length <= 4 && right.split(/\s+/).length <= 4) {
        return [`${left}${suffix}`, `${right}${suffix}`];
      }
    }
  }
  // Pre-strip "(or any X like Y, Z)" parenthetical alternatives BEFORE splitting.
  // Otherwise the splitter sees the "or"/commas inside parens and splits incorrectly.
  raw = raw.replace(/\s*\(\s*or\s+(?:any\s+)?[^)]+\)/gi, '').trim();
  // "(for serving)" / "(for garnish)" / "(to taste)" parenthetical suffix —
  // unwrap to bare suffix so the trailing-suffix detection finds it.
  raw = raw.replace(/\s*\(\s*(for\s+(?:serving|garnish(?:ing)?|topping)|to\s+(?:serve|garnish|taste|top)|as\s+needed)\s*\)\s*$/i, ', $1').trim();
  // Slash-list "X/Y/Z" without qty — split into separate items (recipe author
  // offering a list of garnish/serving alternatives).
  // Fires only when the line has NO qty/unit and contains 2+ slashes between word groups.
  if (!/^\s*\d/.test(raw) && (raw.match(/\//g) || []).length >= 2) {
    const slashItems = raw.split(/\s*\/\s*/).map(s => s.trim()).filter(Boolean);
    if (slashItems.length >= 2 && slashItems.every(s => s.length > 1 && s.length < 50)) {
      return slashItems.map(item => `${item}, for garnish`);
    }
  }
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
  // Pre-strip ", or N <unit> [cooked] X" trailing — alt-form alternative the
  // recipe author offers for a canned/dried-bean swap. Mega-split would otherwise
  // turn this into a separate ingredient.
  //   "1 (15-oz) can black beans, drained, or 1 1/2 cups cooked black beans"
  //     → drop ", or 1 1/2 cups cooked black beans"
  raw = raw.replace(/,\s*or\s+[\d¼½¾⅓⅔⅛⅜⅝⅞](?:[.\/\s][\d¼½¾⅓⅔⅛⅜⅝⅞]+)*\s+(?:cups?|tbsps?|tablespoons?|tsps?|teaspoons?|oz|ounces?|lbs?|pounds?|grams?)\.?\s+(?:cooked\s+)?[\w\s-]+$/i, '').trim();
  // Pre-collapse "Zest and juice of [N] [citrus]" / "grated zest and juice of"
  // → "[N] [citrus]" so the citrus becomes the ingredient (mega-split would
  // otherwise produce "zest juice of" as a fragment).
  raw = raw.replace(/^(?:finely\s+)?(?:grated\s+)?(?:the\s+)?zest\s+and\s+juice\s+of\s+(\d+(?:\s+\d+\/\d+)?(?:\.\d+)?)?\s*(?:large\s+|small\s+|medium\s+)?(lemons?|limes?|oranges?|grapefruits?)\b[^()]*/i,
    (_, n, fruit) => `${n || '1'} ${fruit}`).trim();
  // Pre-strip trailing ", from <something>" recipe-author note (e.g. "minced
  // yellow onion, from 1 small onion" → "minced yellow onion").
  raw = raw.replace(/,\s*from\s+\d+\b[^()]*$/i, '').trim();
  // ", plus N <unit>" mid-line → " + N <unit>" so plus-split rule fires
  // ("4 tablespoons, plus 1/3 cup olive oil" → "4 tablespoons + 1/3 cup olive oil")
  raw = raw.replace(/,\s*plus\s+(\d+(?:\s+\d+\/\d+)?(?:\.\d+)?|\d+\/\d+|[¼-¾⅐-⅞])\s+(cups?|tbsps?|tablespoons?|tsps?|teaspoons?|oz|ounces?|lbs?|pounds?)/gi, ' + $1 $2');
  // Pre-insert a space between letter+digit (recipe authors sometimes paste
  // "2 eggs2-3 garlic" with no space) so qty boundaries are visible.
  // Decode HTML entities first so &frac14;/&#39; etc. don't get mangled.
  raw = raw
    .replace(/&frac14;/g, '¼').replace(/&frac12;/g, '½').replace(/&frac34;/g, '¾')
    .replace(/&#8531;/g, '⅓').replace(/&#8532;/g, '⅔')
    .replace(/&#8533;/g, '⅕').replace(/&#8537;/g, '⅙').replace(/&#8539;/g, '⅛')
    .replace(/&#(?:8211|8212);/g, '-')
    .replace(/&#(?:8216|8217|39);/g, "'")
    .replace(/&#(?:8220|8221);/g, '"')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
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
    /\b(?:tender|soft|mixed|fresh)?\s*herbs?\b\s*[:,]?\s*(?:such\s+as\s+)?([a-z][a-z\s,]*?)(?:,\s*or\s+(?:a\s+|some\s+)?combination[a-z\s]*)?\s*\.?\s*$/i,
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
  // "<X> <unit1> + <Y> <unit2> <noun>" — split into two lines, each with noun
  // (nutrition layer sums them; shopping list shows both):
  //   "1 tablespoon + 1 teaspoon cornstarch"  → ["1 tbsp cornstarch", "1 tsp cornstarch"]
  //   "2 TBSP + 1 TBSP olive oil"             → ["2 tbsp olive oil", "1 tbsp olive oil"]
  //   "1/4 cup+2 tsp milk"                    → ["1/4 cup milk", "2 tsp milk"]
  // NOTE: '+' followed by a fraction "1 + 1/2 lbs" was rewritten to "1 1/2" earlier (mixed number).
  {
    const plusM = raw.match(/^(\d+(?:\s+\d+\/\d+)?(?:\.\d+)?|\d+\/\d+|[¼-¾⅐-⅞])\s+(cups?|tbsps?|tablespoons?|tsps?|teaspoons?|oz|ounces?|lbs?|pounds?)\s*\+\s*(\d+(?:\s+\d+\/\d+)?(?:\.\d+)?|\d+\/\d+|[¼-¾⅐-⅞])\s+(cups?|tbsps?|tablespoons?|tsps?|teaspoons?|oz|ounces?|lbs?|pounds?)\s+(.+)$/i);
    if (plusM) {
      return [`${plusM[1]} ${plusM[2]} ${plusM[5]}`, `${plusM[3]} ${plusM[4]} ${plusM[5]}`];
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
    const garnishM = raw.match(/^(?:optional\s+|suggested\s+|recommended\s+|for\s+)?(?:garnishes?|toppings?|filling\s+additions?|add[\s-]?ins?|additions?|add[\s-]?in\s+for\s+\w+)\s*[:.\-—]\s*(.+)$/i);
    if (garnishM) {
      const items = garnishM[1].split(/,\s*(?!and\b)|(?:,\s*)?\s+and(?:\/or)?\s+/i).map(s => s.trim()).filter(Boolean);
      return items.map(item => `${item}, for garnish`);
    }
    // "for serving, as desired: A, B, C" / "to serve: A, B, C" — colon-list with
    // serving marker. Each item gets a "for serving" suffix.
    //   "for serving, as desired: olive oil, parsley, lemon zest, crusty bread"
    //     → ["olive oil, for serving", "parsley, for serving", ...]
    const serveM = raw.match(/^(?:suggested\s+)?(?:for\s+serving|to\s+serve)(?:,\s*as\s+desired)?\s*[:.\-—]\s*(.+)$/i);
    if (serveM) {
      const items = serveM[1]
        .replace(/,?\s*etc\.?\s*$/i, '')
        .split(/,\s*(?!and\b)|(?:,\s*)?\s+and(?:\/or)?\s+/i)
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
      // When a serving suffix is set, recipe author is offering a list of garnish/
      // serving items — be more permissive: split even when prep-word is first
      // (e.g. "sliced scallions" — keep as separate garnish item).
      // Use endsWithKnownIngredient (looks past prep words) instead of strict DB hit.
      const passLooksLikeIngredient = !isModifier && !!INGREDIENT_DB[cleaned];
      const passServingPermissive = !!trailingSuffix && endsWithKnownIngredient(part);
      if (passLooksLikeIngredient || passServingPermissive) {
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
  // Round 27 backfill — REMOVED circular alias 'poultry seasoning' → 'dried poultry blend' (round 34: nutrition DB has 'poultry seasoning' as canonical)
  // Round 30 — alias to nutrition-DB canonical names for stuck recipes
  'stone-ground polenta':'polenta', 'stoneground polenta':'polenta',
  'center cut bacon':'bacon', 'center-cut bacon':'bacon',
  'center cut bacon slices':'bacon', 'center-cut bacon slices':'bacon',
  'center-cut salmon':'salmon', 'center cut salmon':'salmon',
  'center-cut salmon filets':'salmon filets', 'center cut salmon filets':'salmon filets',
  'center-cut salmon filet':'salmon filet', 'center cut salmon filet':'salmon filet',
  'center-cut, skin-on salmon fillets':'salmon fillets',
  // Round 71 — final 9 cleanup (aliasing to actual DB keys, not idealized names)
  'garlic herb':'garlic',
  'roasted tomatoes':'fire roasted tomatoes',
  'dried chilies':'dried red chilies',
  'havarti':'havarti dill cheese','havarti cheese':'havarti dill cheese',
  'dehydrated onion':'dehydrated minced onion',
  'ranch seasoning':'ranch',
  'plantain':'plantain chips',
  'italian cheese blend':'mexican cheese blend',
  'whole milk greek yogurt':'plain whole milk greek yogurt',
  'sweet rice':'thai sweet rice',
  // Round 70 — fuzzy-match conversion to exact (final batch)
  'oregano marjoram':'fresh oregano','oregano marjoram or thyme sprigs':'fresh oregano',
  'chicken thighs boneless & skinless':'boneless skinless chicken thighs',
  'or jumbo shrimp':'jumbo shrimp','large or jumbo shrimp':'jumbo shrimp',
  'salmon filet pin bones skin removed':'salmon','salmon filet pin bones and skin removed':'salmon',
  'lemons for juicing':'lemon','lemons halved for juicing':'lemon',
  'italian style bread crumbs':'italian breadcrumbs','dried italian style bread crumbs':'italian breadcrumbs',
  'short grain white rice':'short-grain white rice','short grain raw long-grain white rice':'short-grain white rice',
  'extra virgin olive':'olive oil',
  'kale stalks':'kale','large stalks kale stems removed':'kale',
  'carrot tops stems removed':'carrot tops','packed carrot tops':'carrot tops',
  'boneless skinless salmon filets cut':'salmon fillets','boneless skinless salmon filets':'salmon fillets',
  'salmon fillets (fresh':'salmon fillets','salmon fillets fresh or thawed':'salmon fillets',
  'sheets nori':'nori',
  'plain':'plain yogurt',
  'filets of salmon':'salmon fillets',
  'kale ribs stems removed':'kale','coarsely chopped kale ribs and stems removed':'kale',
  'skinless chicken thighs':'boneless skinless chicken thighs','skinless chicken thighs or breasts':'boneless skinless chicken thighs',
  'chinese chili pepper':'dried chilies','dried chinese chili peppers':'dried chilies',
  'quinoa brown rice':'cooked quinoa','leftover cooked quinoa, brown rice':'cooked quinoa',
  'low-fat 1% milk':'milk','low fat 1% milk':'milk',
  'corn starch + 1/4 cup water':'cornstarch','corn starch':'cornstarch',
  'lemon (juiced - this is':'lemon',
  'vidalia onion':'onions','sweet vidalia onions':'onions',
  'new york steak strip steaks':'new york strip steak','new york strip steaks':'new york strip steak',
  'skin on salmon':'salmon',
  'noodles rice':'noodles','cooked noodles or boiled rice':'noodles',
  '1 and':'',
  'potatoes thin-skinned 1/8 inch rounds':'potatoes',
  'tacos':'taco shells','hard shell tacos':'taco shells',
  'english cucumber ribbons':'english cucumber','english cucumber':'cucumber',
  '2% reduced-fat plain greek yogurt':'plain greek yogurt',
  'herbs (lettuce':'fresh herbs','herbs (lettuce, and tzatziki, or for serving)':'fresh herbs',
  'ground meat':'ground beef','ground meat (ground turkey, ground beef, or ground pork':'ground beef',
  'grated parmesan cheese reggiano':'parmesan cheese','grated parmesan reggiano':'parmesan cheese',
  'kale stemmed':'kale','kale stemmed and roughly chopped':'kale',
  'fennel (from 1 fennel bulb)':'fennel','shaved fennel from 1 medium fennel bulb':'fennel',
  'lemon zest + 1 tbsp. lemon juice':'lemon',
  'rice green onions':'rice',
  'canned fire roasted tomatoes':'fire roasted tomatoes','can fire roasted tomatoes':'fire roasted tomatoes',
  'ancho powder':'ancho chili powder','ancho or new mexico chili powder':'ancho chili powder',
  'tilapia fillet':'tilapia','big fillets of tilapia':'tilapia',
  'avocado slices':'avocado',
  'shredded cabbage seasoned with lime juice':'cabbage',
  't. cornstarch':'cornstarch',
  'or shrimp':'shrimp','large or shrimp':'shrimp',
  'shrimp tails removed':'shrimp','peeled and deveined medium to large raw shrimp tails removed':'shrimp',
  'tortillas wraps':'tortillas','large tortillas wraps or thin pita bread':'tortillas',
  'labneh plain greek yogurt':'labneh','labneh plain greek yogurt or tzatziki':'labneh',
  'cayenne pepper chile flakes':'cayenne pepper','cayenne pepper or aleppo chile flakes':'cayenne pepper',
  'skinless chicken breasts boneless & skinless':'boneless skinless chicken breast',
  'thick whole milk greek yogurt':'plain whole milk greek yogurt',
  'carrots parsnips':'carrots','roughly chopped carrots and parsnips':'carrots',
  'smoked chicken sausage':'chicken sausage','smoked cooked chicken sausage':'chicken sausage',
  'garlic cloves pressed through a garlic press':'garlic',
  'thai sweet':'sweet rice','thai sweet or glutinous rice':'sweet rice',
  'shell pasta':'pasta','small shell pasta':'pasta',
  'broccoli florets stems':'broccoli florets',
  'thai bird chilies chilies':'thai bird chilies','thai bird chilies or holland chilies':'thai bird chilies',
  'pineapple juice (':'pineapple juice',
  'avocado olive oil':'avocado oil','avocado or extra virgin olive oil':'avocado oil',
  'tapioca flour/starch':'tapioca flour','tapioca flour':'tapioca flour',
  'extra-virgin olive':'olive oil',
  'garlic cloves do not use jar':'garlic',
  'corn ear':'corn','ear of corn':'corn','ear of corn shucked and kernels removed':'corn',
  'jalapeño ( up':'jalapeno','jalapeño chopped up seeds removed':'jalapeno',
  'white rice (':'white rice','white rice (such as jasmine':'white rice',
  'herbs (like chives, parsley, or or dill)':'fresh herbs','herbs (like chives, parsley, or dill)':'fresh herbs',
  'olive oil for pan-frying':'olive oil',
  'or jalapeno':'jalapeno','diced or sliced jalapeno':'jalapeno',
  'garlic head ( unpeeled':'garlic','whole garlic head':'garlic',
  'herbs (mint, dill, italian parsley or cilantro- a mix is nice)':'fresh herbs',
  'aleppo flakes':'red pepper flakes','aleppo or chili flakes':'red pepper flakes',
  'herbs (cilantro, italian parsley, dill or basil or a combo!)':'fresh herbs','fresh herbs (cilantro, italian parsley, dill or basil)':'fresh herbs',
  'tahini paste stirred':'tahini','tahini paste':'tahini',
  'fresh basil and/or mint':'fresh basil','fresh basil and/or mint leaves':'fresh basil',
  'kale bundle':'kale',
  // Round 69 — fuzzy-match conversion to exact (batch 10)
  'salmon (skin removed cut':'salmon',
  'basmati rice -':'basmati rice','basmati rice or other long grain rice':'basmati rice',
  'bone-in skin-on chicken breast and thighs':'bone-in skin-on chicken thighs','bone-in skin-on chicken a mix of breasts and thighs':'bone-in skin-on chicken thighs',
  'saffron crumbled':'saffron','pinch saffron crumbled':'saffron',
  'nuts ( slivered almonds':'slivered almonds',
  'chicken thighs boneless skin on':'boneless skinless chicken thighs','boneless and skin on chicken thighs':'boneless skinless chicken thighs',
  'poblano pepper dice':'poblano pepper','poblano pepper medium dice':'poblano pepper',
  'spinach chop':'spinach','large handful spinach rough chop':'spinach',
  'mozzarella cheese i':'mozzarella cheese',
  'sherry vinegar red wine vinegar':'sherry vinegar','sherry vinegar red wine vinegar or lemon juice':'sherry vinegar',
  'hominy -2 to 3 cans':'hominy','cooked hominy':'hominy',
  'canned can green chilies':'canned green chilies','can diced green chilies':'canned green chilies',
  'chicken wing':'chicken wings','whole chicken wings':'chicken wings',
  'lemongrass outer leaves removed stalk cut':'lemongrass','stalk of fresh lemongrass':'lemongrass',
  'kale greens':'kale','chopped kale or collard greens or chard':'kale',
  'feta cheese see notes above':'feta cheese','block of feta':'feta cheese',
  'ginger juliennes':'fresh ginger',
  'salmon fillets with skin':'salmon fillets',
  'herbs (basil, or dill)':'fresh herbs','chopped herbs (basil, or dill)':'fresh herbs',
  'tubular pasta':'pasta','tubular dried pasta':'pasta','tubular dried pasta such as mezzi rigatoni':'pasta',
  'of thyme sprig':'fresh thyme','large sprig of thyme':'fresh thyme',
  'garlic (from':'garlic','minced garlic':'garlic',
  'brine':'caper brine','brine from a jar of capers':'caper brine',
  'serrano habanero chiles':'serrano pepper','serrano and habanero chiles':'serrano pepper',
  'lime wedges for squeezing':'lime',
  'canned cherry tomatoes with their juices':'canned cherry tomatoes','can cherry or diced tomatoes with their juices':'canned cherry tomatoes',
  'herbs (parsley, mint, dill, basil, tarragon, chives, or a combination)':'fresh herbs',
  'sage sprigs':'fresh sage','sprigs sage':'fresh sage',
  'thyme 2 sprigs italian parsley 2 bay leaves':'fresh thyme',
  'salmon steelhead trout':'salmon',
  'lemon half':'lemon','lemon half thinly sliced':'lemon',
  'herbs (dill, mint, cilantro, parsley, or)':'fresh herbs',
  'scallions (whites, greens cut into 1/2-inch (13-mm) segments on the diagonal reserved separately)':'fresh scallions',
  'broccoli florets (from':'broccoli florets','bite-size broccoli florets':'broccoli florets',
  '3 ⅞ oz salmon fillets':'salmon fillets',
  'wedges of lemon':'lemon wedges',
  'garlic bulb unpeeled':'garlic','garlic bulb':'garlic',
  'skinless chicken thigh':'boneless skinless chicken thighs',
  'harissa chile flakes':'harissa','harissa or dried red chile flakes':'harissa',
  'canned tomatoes crushed sauce':'canned crushed tomatoes','can tomatoes crushed':'canned crushed tomatoes',
  'shallots from':'shallots','finely chopped shallots from about':'shallots',
  'sun gold tomato':'sun gold tomatoes','sun gold tomatoes':'cherry tomatoes','pint sun gold tomatoes':'cherry tomatoes',
  'salmon fillets 1':'salmon fillets',
  // Round 68 — fuzzy-match conversion to exact (batch 9)
  'chickpeas canned':'canned chickpeas','chickpeas canned or soaked and cooked':'canned chickpeas',
  'lemon wedges/squeeze':'lemon',
  'mint flakes':'fresh mint','dried mint flakes':'fresh mint',
  'white beans beans':'white beans','cooked white beans or kidney beans':'white beans',
  'salmon (skin removed':'salmon','salmon skin removed cut into bite size pieces':'salmon','salmon skin removed and cut into 1-inch cubes':'salmon',
  'rice vinegar ⁣':'rice vinegar',
  'maple syrup ⁣':'maple syrup',
  'scallion lengthways put in a glass of water':'fresh scallions','scallion finely sliced lengthways':'fresh scallions',
  'boneless chicken tenders/strips':'chicken tenders',
  'mint sprigs':'fresh mint','tablespoons mint sprigs':'fresh mint',
  'garlic sauce - toum':'garlic sauce','garlic sauce':'garlic sauce',
  'water for boiling':'water',
  'boneless skinless chicken breasts thighs':'boneless skinless chicken breast','boneless skinless chicken breasts or thighs':'boneless skinless chicken breast','boneless skinless chicken breasts thighs or a mix':'boneless skinless chicken breast',
  'shallots onion':'shallots','minced shallots or red onion':'shallots',
  'potatoes -':'potatoes','medium potatoes (russets, yukon)':'potatoes',
  'orange juice + 2 tablespoons zest':'orange juice','orange juice and zest':'orange juice',
  'racks of lamb':'rack of lamb','rack of lamb':'rack of lamb',
  'couscous with pine nuts':'couscous',
  'courgette / zucchini':'zucchini','medium courgette / zucchini':'zucchini',
  'mixed salad':'mixed greens','mixed salad leaves':'mixed greens',
  'scallions dark green parts only':'fresh scallions',
  'l chicken stock':'chicken broth',
  'chestnuts broken':'chestnuts','cooked chestnuts roughly broken':'chestnuts',
  'ground cumin + 1/8 tsp extra':'ground cumin',
  'capers + 2 tbsp of their brine':'capers','capers + 2 tbsp of their juices':'capers',
  'clementines unpeeled':'clementines','clementines unpeeled sliced horizontally':'clementines',
  'fennel seeds slightly':'fennel seeds','fennel seeds slightly crushed':'fennel seeds',
  'chicken legs drumstick thigh attached':'chicken legs','chicken legs drumstick and thigh attached':'chicken legs',
  'grated zest of 1 orange':'orange zest','grated zest of orange':'orange zest',
  'onions 1 the other 2 each cut':'onions','onions peeled roughly chopped':'onions',
  'lamb shoulder bone':'lamb shoulder','lamb shoulder bone in':'lamb shoulder',
  'cardamom pods bashed open with a pestle mortar':'cardamom','cardamom pods roughly bashed open':'cardamom',
  'oregano sprigs':'fresh oregano','sprigs oregano':'fresh oregano',
  'urfa flakes':'red pepper flakes','urfa or aleppo chilli flakes':'red pepper flakes',
  'cashews soaked for an hour':'cashews',
  'lime (juiced':'lime',
  'romaine lettuce cleanned':'romaine lettuce','head romaine lettuce':'romaine lettuce',
  'scallion stalks':'fresh scallions','scallion stalks cleaned and chopped':'fresh scallions',
  'wild salmon filet with skin':'salmon','whole wild salmon filet with skin':'salmon',
  'cavatelli ditalini elbow':'pasta','cavatelli, ditalini, elbow or small shell pasta':'pasta',
  'carrots heirloom carrots are':'carrots','small to medium carrots heirloom or organic':'carrots',
  // Round 67 — fuzzy-match conversion to exact (batch 8)
  'leaves italian parsley':'fresh italian parsley','italian parsley leaves':'fresh italian parsley',
  'parmigiano reggiano cheese (':'parmesan cheese','parmigiano reggiano cheese':'parmesan cheese',
  'veggies of choice':'mixed vegetables',
  'chipotle chile in adobo sauce + 1 tablespoon of adobo sauce':'chipotle chile in adobo sauce','chipotle chile in adobo sauce':'chipotle chile in adobo sauce',
  'or grated fresh ginger':'fresh ginger','minced or grated fresh ginger':'fresh ginger',
  'chicken thighs boneless':'boneless skinless chicken thighs',
  'mango - cut':'mango','ripe mango':'mango',
  'coriander leaves stalk':'fresh cilantro','stalk of coriander leaves':'fresh cilantro',
  '(435ml) vegetable':'vegetable broth','vegetable or chicken broth':'vegetable broth',
  'full-fat coconut milk add':'full-fat coconut milk',
  'peanut butter add after it\'s':'peanut butter',
  'chicken thighs - left for shredding':'chicken thighs','chicken thighs left whole for shredding':'chicken thighs',
  'hearts of romaine':'romaine lettuce','chopped hearts of romaine or little gem lettuce':'romaine lettuce',
  'lime juice (juice of':'lime juice',
  'lime zest as':'lime',
  'half & half cream':'half-and-half',
  'pepper jack cheese slices':'pepper jack cheese','slices pepper jack cheese':'pepper jack cheese',
  'avocado sesame seeds':'avocado',
  'or canned mandarin orange segments':'mandarin orange segments','fresh or canned mandarin orange segments':'mandarin orange segments',
  'whole chicken (':'whole chicken','organic whole chicken':'whole chicken',
  'spinach mustard greens':'spinach','spinach, mustard greens or baby kale':'spinach',
  'or grated ginger root':'fresh ginger','minced or grated ginger root':'fresh ginger',
  'carrots scraped into thin rounds':'carrots','carrots scraped and sliced into thin rounds':'carrots',
  'long grain long-grain white rice':'white rice','long grain raw long-grain white rice':'white rice',
  'bulb fennel':'fennel',
  'jalapeños if desired':'jalapeno','jalapeños seeded if desired and chopped':'jalapeno',
  'lime zest + 1/4 cup lime juice':'lime',
  'pods green cardamom':'cardamom','green cardamom pods':'cardamom',
  'black pepper corn':'black peppercorns',
  'or ginger':'fresh ginger','fresh minced or crushed ginger':'fresh ginger',
  'chipotle peppers from a can in adobo sauce':'chipotle chile in adobo sauce','chipotle peppers from a can packed in adobo sauce':'chipotle chile in adobo sauce',
  'fresh cilantro plush':'fresh cilantro','finely chopped fresh cilantro plush':'fresh cilantro',
  'pla':'plain yogurt','plain 2% greek yogurt':'plain yogurt',
  'leg of lamb boneless':'boneless leg of lamb',
  '6 oz salmon fillets':'salmon fillets','salmon fillets skin on or off':'salmon fillets',
  'lemon zest (from':'lemon','lemon zest from about':'lemon',
  'lamb shanks excess skin':'lamb shanks','lamb shanks excess skin trimmed':'lamb shanks',
  'light sugar':'light brown sugar','light brown sugar':'light brown sugar','packed light or dark brown sugar':'brown sugar',
  'chicken (boneless breasts or thighs cut to 1 to 1 1/2 inch pieces)':'boneless skinless chicken breast','chicken boneless breasts or thighs':'boneless skinless chicken breast',
  'full-fat milk':'whole milk','full fat milk':'whole milk',
  'green chili ( (':'green chili',
  'olive oil (240ml)':'olive oil',
  'coriander ground':'ground coriander',
  // Round 66 — fuzzy-match conversion to exact (batch 7)
  'roasted red pepper':'roasted red peppers',
  'cracked of black pepper':'black pepper',
  'skirt flank':'skirt steak','skirt flank or flat iron steak':'skirt steak',
  'drumsticks':'chicken drumsticks',
  'fenugreek':'fenugreek leaves','fenugreek leaves':'fenugreek leaves',
  'orange (ends removed discarded':'orange','orange ends removed and discarded':'orange',
  'chicken breasts 150g each':'chicken breast','medium chicken breasts':'chicken breast',
  'leaves coriander':'fresh cilantro','fresh coriander':'fresh cilantro',
  'guacamole shredded cheese':'guacamole',
  'skinless bone-in chicken thighs pieces':'bone-in skin-on chicken thighs','pieces skinless bone-in chicken thighs':'bone-in skin-on chicken thighs',
  'canned pumpkin':'canned pumpkin puree',
  'shrimp 16-20 count':'shrimp','large shrimp 16-20 count':'shrimp',
  'olive oil butter':'olive oil','olive oil and butter':'olive oil',
  'lime juice + wedges':'lime',
  'chicken breasts (, skinless & boneless (250–8–10oz each) )':'boneless skinless chicken breast','large chicken breasts skinless & boneless':'boneless skinless chicken breast',
  '2% milk':'milk',
  'red':'red onion',
  'extra-virgin oil':'olive oil',
  'lime zest + lime juice':'lime',
  'lime cut':'lime','lime cut into 4 wedges':'lime',
  'butter + 1 tbsp':'butter','unsalted butter + 1 tbsp':'butter',
  'chicken breasts pounded to a similar thickness':'chicken breast',
  'sage leaves plus 1 tablespoon sage':'fresh sage','sage leaves':'fresh sage',
  'lemon squeezies':'lemon',
  'gouda cheese slices':'gouda cheese','slices gouda cheese':'gouda cheese',
  'zucchinis zoodles':'zucchini','medium zucchinis or prepped zoodles':'zucchini',
  'olive oil + a sprinkle of salt':'olive oil',
  'leaves fresh cilantro':'fresh cilantro','chopped fresh cilantro':'fresh cilantro',
  'beer of choice':'beer',
  'chicken thighs leave':'chicken thighs',
  'chicken breast pounded to an even thickness':'chicken breast',
  'lemon save the lemon for grilling/ juicing':'lemon',
  'chili flakes-':'red pepper flakes','chili flakes':'red pepper flakes',
  'cotija cheese crumbled':'cotija cheese',
  'chili flakes (optional':'red pepper flakes','dried chili flakes':'red pepper flakes',
  'lime wedges and/or cilantro lime dressing':'lime',
  'white corn':'corn','white corn or flour tortillas':'corn tortillas',
  'boneless skinless chicken breasts each piece cut':'boneless skinless chicken breast',
  'canned of chickpeas':'canned chickpeas','can of chickpeas':'canned chickpeas',
  'lime zest juice':'lime','lime zest and juice':'lime',
  'stems':'fresh cilantro',
  'boneless beef chuck (well-marbled':'beef chuck','boneless beef chuck':'beef chuck',
  'white boiling potato':'white potato','white boiling potatoes':'white potato',
  // Round 65 — fuzzy-match conversion to exact (batch 6)
  'medium tomatoes roasted':'fire roasted tomatoes',
  'dried chilies':'dried red chilies',
  'kidney beans beans':'kidney beans','kidney beans or black beans':'kidney beans',
  'cheddar cheese slices':'cheddar cheese','slices cheddar cheese':'cheddar cheese',
  'slaw mix with cabbage':'coleslaw mix','slaw mix':'coleslaw mix',
  'nori sheets –':'nori','nori sheets':'nori',
  'coriander sprig':'fresh cilantro','sprig coriander':'fresh cilantro',
  'chicken breasts boneless & skinless':'boneless skinless chicken breast','chicken breasts boneless and skinless':'boneless skinless chicken breast',
  'thyme oregano/ sage':'fresh herbs','thyme oregano sage':'fresh herbs',
  'all- purpose flour':'all-purpose flour',
  'shallot 1/2 cup':'shallots','large shallot 1/2 cup finely diced':'shallots',
  'shredded iceberg':'iceberg lettuce','shredded iceberg or romaine lettuce':'iceberg lettuce',
  'long grain':'white rice','long grain or basmati rice':'white rice',
  'boneless chicken thigh':'boneless skinless chicken thighs','boneless chicken thighs':'boneless skinless chicken thighs',
  'boneless skinless':'boneless skinless chicken breast',
  'garlic 3 3':'garlic','cloves garlic 3 sliced and 3 chopped':'garlic',
  'mild green chili':'green chiles',
  'spinach (add more for greener soup use':'spinach','packed spinach':'spinach',
  'non-dairy cream':'non-dairy creamer',
  'ground beef -':'ground beef',
  'cilantro green onions':'fresh cilantro',
  'or red cabbage':'red cabbage','chopped or shaved red cabbage':'red cabbage',
  'tortilla chips (crumbled overtop':'tortilla chips',
  'baby tomato':'cherry tomatoes','baby tomatoes':'cherry tomatoes',
  'clove of garlic':'garlic',
  'water to thin to desired consistency':'water',
  'cilantro tender stems ok':'fresh cilantro','bunch cilantro tender stems ok':'fresh cilantro',
  'scallions stalks':'fresh scallions','stalks scallions':'fresh scallions',
  'orange peppers':'bell peppers','orange or red bell peppers':'bell peppers',
  'sun tomato strips in oil (jarred':'sun-dried tomatoes in oil','sun dried tomato strips in oil':'sun-dried tomatoes in oil',
  'sun-dried tomato strips in oil':'sun-dried tomatoes in oil',
  'parmesan cheese.':'parmesan cheese',
  'flaked':'cooked salmon','flaked cooked salmon':'cooked salmon',
  'chickpeas picked over soaked for at least 4 hours up to 24 hours in the refrigerator':'chickpeas','dried (uncooked/raw) chickpeas':'chickpeas',
  'shredded cheese of your choice':'shredded cheese',
  'flour of choice (all purpose':'all-purpose flour','flour of choice':'all-purpose flour',
  'bacon if not vegetarian':'bacon','chopped bacon if not vegetarian':'bacon',
  'garlic cloves smashed':'garlic','garlic cloves lightly smashed':'garlic',
  'kale ribs removed into':'kale','kale ribs removed':'kale',
  'herbs (cilantro, dill, mint, basil, or a combination, or more for serving)':'fresh herbs','chopped herbs':'fresh herbs',
  'tofu (non gmo':'tofu','tofu non gmo organic':'tofu',
  'shredded italian blend':'italian cheese blend','shredded italian blend or mozzarella cheese':'italian cheese blend',
  'mayo + more':'mayonnaise',
  'dates raisins':'dates','dates or golden raisins':'dates',
  'chinese mustard':'mustard','chinese hot mustard':'mustard',
  // Round 64 — fuzzy-match conversion to exact (batch 5)
  // (round 71 maps roasted tomatoes → fire roasted tomatoes)
  'water (30 ml)':'water',
  'salsa or pico de gallo (homemade or storebought, 240 ml)':'salsa','salsa or pico de gallo':'salsa',
  'guacamole (homemade or storebought, 240 ml)':'guacamole',
  'boneless skinless chicken breasts butterflied pounded thin':'boneless skinless chicken breast',
  'beans picked through':'dried beans','dried beans':'dried beans',
  'garlic excess paper removed':'garlic','garlic excess paper removed and halved crosswise':'garlic',
  'slivered':'pistachios','slivered or crushed unsalted pistachios':'pistachios',
  'boneless pork chop':'boneless pork chop','boneless pork chops':'boneless pork chop','boneless pork chops, tenderloin or loin':'boneless pork chop',
  'corn husks removed ears':'corn','ears of corn husks removed':'corn',
  'fresh dill thick stems removed':'fresh dill',
  'plain full-fat yogurt':'full-fat greek yogurt',
  'charcoal piece':'',
  'chicken boneless':'boneless skinless chicken breast',
  'pineapple thinly':'pineapple','pineapple thinly sliced':'pineapple',
  'garlic (separated into cloves':'garlic','head of garlic separated into cloves':'garlic',
  'herbs (basil, or mint)':'fresh herbs','herbs (basil or mint)':'fresh herbs',
  'or tzatziki':'tzatziki','store-bought or homemade tzatziki':'tzatziki',
  'pepper corn':'black peppercorns',
  'cilantro / coriander':'fresh cilantro','cilantro / coriander leaves':'fresh cilantro',
  'seasoned bread crumbs':'bread crumbs','seasoned dry bread crumbs':'bread crumbs',
  'canned ) black beans':'black beans','can black beans':'black beans',
  'mustard vegan mayo etc':'mustard',
  'beef tenderloin cut':'beef tenderloin','beef tenderloin (ribeye or top sirloin)':'beef tenderloin',
  'skinless chicken tenders':'chicken tenders','boneless skinless chicken tenders':'chicken tenders',
  'a sweet onion':'sweet onion',
  'fennel bulb-':'fennel','fennel bulb':'fennel',
  'cherry grape tomatoes':'cherry tomatoes','cherry, grape or baby heirloom tomatoes':'cherry tomatoes',
  'avocado flesh removed':'avocado',
  'gold potato':'yukon gold potatoes','small gold potatoes':'yukon gold potatoes',
  'butter to grease the baking dish':'butter',
  'peanut oil- the peanut sauce elevates!':'peanut oil',
  'red chinese chilies':'dried chilies','dried red chinese chilies':'dried chilies',
  'ginger julienne':'fresh ginger',
  'oxtail ribs':'oxtail','oxtail or short ribs':'oxtail',
  'bone-in skin-on chicken breast halves':'bone-in skin-on chicken breast',
  'shallots larger ones':'shallots',
  'herbs (thyme, oregano, parsley, rosemary)':'fresh herbs','assorted fresh herbs':'fresh herbs',
  'stew meat':'beef stew meat','stew meat or beef chuck':'beef stew meat',
  'bell peppers peppers':'bell peppers','bell peppers or poblano peppers':'bell peppers',
  'pumpkin seeds (use the ones from your butternut squash':'pumpkin seeds',
  'grapefruit':'grapefruit','fresh grapefruit zest':'grapefruit',
  'shrimp with tail on':'shrimp','medium peeled raw shrimp with tail on':'shrimp',
  'or 2 cedar planks':'',
  'ro-tel tomatoes':'diced tomatoes','ro-tel tomatoes and green chilies':'diced tomatoes',
  // Round 63 — fuzzy-match conversion to exact (batch 4)
  'herb flatbread':'herb flatbread','herb flat bread':'herb flatbread',
  'or shredded parmesan cheese':'parmesan cheese','shaved or shredded parmesan':'parmesan cheese',
  'tostadas chips':'tortilla chips',
  'asparagus (tender parts':'asparagus',
  'or rosemary':'fresh rosemary','chopped fresh or dried rosemary':'fresh rosemary',
  'honey roasted peanuts':'honey roasted peanuts','roasted peanuts':'honey roasted peanuts',
  'jalapeno pepper pepper':'jalapeno','jalapeno pepper or habanero pepper':'jalapeno',
  'baby bell pepper':'bell peppers','baby bell peppers':'bell peppers',
  'garlic clove grated':'garlic','garlic clove finely grated':'garlic',
  'smoke paprika':'smoked paprika',
  'vinegar-based sauce':'hot sauce','vinegar-based hot sauce':'hot sauce',
  '& brown':'',  // splitter byproduct
  'chicken thighs cut':'chicken thighs','chicken thighs cut into pieces':'chicken thighs',
  'curry powder i':'curry powder','curry powder i use this one':'curry powder',
  'bone-':'',  // splitter byproduct (insufficient context)
  'canned italian tomatoes':'whole peeled tomatoes','canned whole peeled italian tomatoes':'whole peeled tomatoes',
  'canned crushed tomatoes in thick puree':'canned crushed tomatoes',
  'chicken thighs (, bone-in skin-on (~8oz each, note 1))':'bone-in skin-on chicken thighs','chicken thighs skin-on and bone-in':'bone-in skin-on chicken thighs',
  'chicken stock ( low sodium':'chicken broth','chicken stock low sodium':'chicken broth',
  'herbs (sage, thyme, etc.) sprigs':'fresh herbs','sprigs of herbs':'fresh herbs',
  'shallots thinly':'shallots','shallots thinly sliced':'shallots',
  'leaves dill':'fresh dill',
  '2 zucchini':'zucchini','medium zucchini':'zucchini',
  'red orange pepper':'red bell pepper','red, orange or yellow bell pepper':'red bell pepper',
  'scallions (from 5 to 6 scallions':'fresh scallions','chopped scallions':'fresh scallions',
  'cauliflower "ready to cook" cauliflower rice if frozen)':'cauliflower','cauliflower ready to cook cauliflower rice':'cauliflower',
  'cauliflower into florets':'cauliflower','heads cauliflower':'cauliflower',
  'hard shells':'taco shells','hard or soft taco shells':'taco shells','hard taco shells':'taco shells',
  'rice of choice':'rice','cooked rice of choice':'rice',
  'jalapeños stemmed':'jalapeno','jalapeños stemmed and seeded':'jalapeno','jalapeños':'jalapeno','large jalapeños':'jalapeno',
  'canned of salmon':'canned salmon','can of salmon':'canned salmon',
  'pasta for two':'pasta',
  'avocado oil olive oil':'avocado oil','avocado oil or light olive oil':'avocado oil',
  'ts sea salt':'salt','fine sea salt':'salt',
  'or mint':'fresh mint','roughly chopped or torn mint leaves':'fresh mint',
  'or parsley':'fresh parsley','roughly chopped or torn parsley leaves':'fresh parsley',
  'red bell pepper roasted':'roasted red peppers','red bell pepper roasted and peeled':'roasted red peppers',
  'tomatoes roasted':'roasted tomatoes','medium tomatoes roasted and peeled':'roasted tomatoes',
  'or ranch seasoning powder':'ranch seasoning','store-bought or homemade ranch seasoning powder':'ranch seasoning',
  'salted plantain or tortilla chips':'plantain chips',
  'capers in brine':'capers',
  'frozen veg':'frozen vegetables','frozen diced veg':'frozen vegetables','frozen mixed vegetables':'frozen vegetables',
  'bone':'',  // ambiguous splitter byproduct
  'low sodium chicken stock':'chicken broth','low-sodium chicken stock':'chicken broth',
  'pasta shape of choice':'pasta','small pasta shape of choice':'pasta',
  'one':'',  // junk single word
  'corn kernels cut off the cob ears':'corn kernels','corn kernels cut off the cob':'corn kernels','raw corn kernels':'corn kernels',
  'cilantro basil':'fresh cilantro',  // backup if splitter doesn't catch
  'cilantro, basil':'fresh cilantro',
  'cranberries & cilantro':'cranberries',  // backup if splitter doesn't catch
  'avocado wedges + sesame seeds':'avocado',  // backup if splitter doesn't catch
  // Round 62 — fuzzy-match conversion to exact (batch 3)
  't flour':'all-purpose flour','t  flour':'all-purpose flour',
  't dill':'fresh dill','t fresh chopped dill':'fresh dill',
  'mozzarella cheese slices':'mozzarella cheese','slices mozzarella cheese':'mozzarella cheese',
  'garlic bread':'',
  // (round 71 maps havarti → havarti dill cheese, the actual DB key)
  'bone-in skin-on chicken legs thighs':'bone-in skin-on chicken thighs','bone-in skin-on chicken legs, thighs, drumsticks':'bone-in skin-on chicken thighs',
  'cucumbers tossed in rice wine vinegar':'cucumbers',
  'anchovy fillets packet in oil':'anchovy fillets in oil','anchovy fillets in oil':'anchovy fillets in oil',
  'lemon juice (from':'lemon juice',
  'head of romaine lettuce':'romaine lettuce','large head of romaine lettuce':'romaine lettuce',
  'quinoa dry':'quinoa',
  'corn canned':'canned corn',
  'cranberries & cilantro':'cranberries','extra cranberries & cilantro':'cranberries',
  'flat- leaf parsley':'fresh italian parsley','flat-leaf parsley':'fresh italian parsley',
  'kale tough stems removed':'kale','finely-chopped kale tough stems removed':'kale',
  'leaves iceberg lettuce':'iceberg lettuce',
  'peruvian black olives olives':'black olives','peruvian black olives or kalamata olives':'black olives',
  'boneless skinless chicken breast 2-inch':'boneless skinless chicken breast','boneless skinless chicken breast 2-inch cubed':'boneless skinless chicken breast',
  'dehydrated minced onion':'dehydrated minced onion',
  'uncured bacon':'bacon','raw uncured bacon':'bacon',
  'avocado wedges + sesame seeds':'avocado',
  'cauliflower rice frozen':'cauliflower rice',
  'heart of romaine':'romaine lettuce','hearts of romaine lettuce':'romaine lettuce','heart of romaine lettuce':'romaine lettuce',
  'mushrooms stemmed':'mushrooms',
  'grated parmesan cheese-reggiano':'parmesan cheese','grated parmesan-reggiano':'parmesan cheese',
  'lemongrass stalks bottom third only tough outer layers removed':'lemongrass',
  'serrano chiles with seeds if you want some heat':'serrano pepper','serrano chiles':'serrano pepper',
  'crowns broccoli':'broccoli',
  'water the thin':'water',
  'frozen mixed peas & carrot':'frozen mixed peas and carrots','frozen mixed peas and carrots':'frozen mixed peas and carrots',
  'russet potatoes (-':'russet potatoes',
  'bacon pieces':'bacon','pieces bacon':'bacon',
  'radicchio head':'radicchio',
  'or panko breadcrumbs':'panko breadcrumbs','fresh or panko breadcrumbs':'panko breadcrumbs',
  'cayenne more':'cayenne pepper',
  'lime wedges for spritzing':'lime',
  'chicken breast fillets':'chicken breast','small chicken breast fillets':'chicken breast',
  'grass fed ground beef':'grass-fed ground beef',
  'zucchini grated on a box grater':'zucchini',
  'super firm tofu':'extra firm tofu','super firm high-protein tofu':'extra firm tofu',
  'fresh ginger root slices':'fresh ginger','thin slices of fresh ginger root':'fresh ginger',
  '(950-1070 ml) vegetable':'vegetable broth',
  'sprouts basil leaves':'sprouts',
  'boneless skinless chicken breast halves':'boneless skinless chicken breast',
  'salsa sour cream':'salsa','salsa and sour cream':'salsa',
  'skin-on salmon portions':'salmon',
  'kale de-stemmed +':'kale','organic kale de-stemmed':'kale',
  'herbs (like cilantro':'fresh herbs',
  // Round 61 — fuzzy-match conversion to exact (batch 2 of fuzzy CSV)
  'rib celery':'celery','rib  celery':'celery',
  'full-fat plain greek yogurt':'full-fat greek yogurt','plain full-fat greek yogurt':'full-fat greek yogurt',
  'lemongrass stalk':'lemongrass','stalk lemongrass':'lemongrass',
  'canned full-fat coconut milk':'full-fat coconut milk',
  'chiles':'green chiles','dried chiles':'green chiles',
  'shredded mexican cheese blend':'mexican cheese blend',
  'all-purpose':'all-purpose flour','all-purpose or gluten-free flour':'all-purpose flour',
  'garlic cloves-':'garlic',
  'sheets of nori':'nori','sheets of nori (seaweed)':'nori',
  'extra shrimp':'shrimp','extra large shrimp':'shrimp','extra large or jumbo shrimp':'shrimp',
  'or shredded chicken':'cooked shredded chicken','cooked cubed or shredded chicken':'cooked shredded chicken','diced or shredded cooked chicken or turkey':'cooked shredded chicken',
  'or frozen corn':'frozen corn','fresh or frozen corn':'frozen corn',
  'chicken thighs bone-':'bone-in skin-on chicken thighs','chicken thighs bone-in skin on':'bone-in skin-on chicken thighs',
  'canned crushed tomato':'canned crushed tomatoes','crushed tomatoes':'canned crushed tomatoes',
  'lemon zest juice':'lemon','lemon zest and juice':'lemon',
  'head of broccoli':'broccoli','small head of broccoli':'broccoli',
  'herbs (basil, dill, or parsley)':'fresh herbs',
  'low sodium chicken':'chicken broth','low sodium chicken or vegetable broth':'chicken broth',
  'parmesan cheese-reggiano':'parmesan cheese','parmesan-reggiano':'parmesan cheese',
  'a lime':'lime',
  'basil sprig':'fresh basil','large basil sprig':'fresh basil',
  'garlic & flatbread':'garlic','garlic & fresh flatbread':'garlic',
  'chicken breast tofu':'chicken breast','chicken breast, tofu or prawns':'chicken breast',
  'rice wine vinegar do not sub white vinegar it will be too sour':'rice wine vinegar',
  'chili flakes scallions roasted peanuts thai basil':'chili flakes',
  'chicken breast halves on the bone with skin':'bone-in skin-on chicken breast',
  'bone-in skin-on thighs':'bone-in skin-on chicken thighs',
  'bone-in skin-on drumsticks':'chicken drumsticks',
  'lemon wedges for spritzing':'lemon',
  'herbs (like basil, oregano, chives for topping)':'fresh herbs',
  'asparagus woody ends discarded':'asparagus',
  'cream half-and-half':'half-and-half','cream, half and half or coconut cream':'half-and-half',
  'mixed carrot':'carrots','mixed carrots':'carrots',
  'pc skin-on salmon':'salmon',
  'chicken - 2 breasts':'chicken breast','chicken - 2 large breasts':'chicken breast',
  'dill sprigs':'fresh dill','sprigs dill':'fresh dill',
  'fillets of salmon':'salmon fillets',
  'shallots dice':'shallots',
  'feta cheese cut into two slabs':'feta cheese',
  'garlic grated':'garlic','garlic finely grated':'garlic',
  'fregola couscous':'couscous','cooked fregola couscous':'couscous',
  'sun tomatoes in oil':'sun-dried tomatoes in oil','sun dried tomatoes in oil':'sun-dried tomatoes in oil','sun dried tomatoes packed in oil':'sun-dried tomatoes in oil',
  'cobs corn':'corn cobs',
  'celery stick':'celery','stick celery':'celery',
  'sichuan peppercorns pepper flakes':'sichuan peppercorns','sichuan peppercorns or red pepper flakes':'sichuan peppercorns',
  '2x 1" strips lemon zest':'lemon','strips lemon zest':'lemon',
  'fennel bulb stalks fronds':'fennel',
  'lemon zest + 2 tbsp. lemon juice':'lemon','lemon zest + 2 tbsp lemon juice':'lemon',
  'c red onion':'red onion','minced red onion':'red onion',
  't salted butter':'butter',
  // Round 60 — fuzzy-match conversion to exact (batch 1 of fuzzy CSV)
  'bay':'bay leaves',
  'sauce':'hot sauce',
  'feta cheese crumbled':'feta cheese',
  'garlic (whole head)':'garlic','head of garlic':'garlic','head garlic':'garlic',
  'shredded carrot':'shredded carrots',
  'sun tomatoes':'sun-dried tomatoes','sun dried tomatoes':'sun-dried tomatoes',
  'shredded red cabbage':'red cabbage',
  'full-fat greek yogurt':'full-fat greek yogurt','full fat greek yogurt':'full-fat greek yogurt',
  'celery sticks':'celery','sticks celery':'celery',
  'shredded mexican cheese':'mexican cheese blend',
  'leaves cilantro':'fresh cilantro',
  'yellow':'',  // ambiguous — drop rather than mismatch
  'chicken thighs boneless skinless':'boneless skinless chicken thighs','boneless and skinless chicken thighs':'boneless skinless chicken thighs',
  'leaves basil':'fresh basil',
  'chicken flavor "better than bouillon"':'bouillon cube','better than bouillon':'bouillon cube',
  'matchstick carrot':'matchstick carrots','matchstick carrots':'carrots',
  'pasta of choice':'pasta','dried pasta of choice':'pasta',
  'ribs celery':'celery',
  'bacon slices':'bacon','slices bacon':'bacon',
  'jalapeno slices':'jalapeno','slices jalapeno':'jalapeno',
  'bacon strips':'bacon','strips bacon':'bacon',
  'corn ears':'corn','ears corn':'corn','ears of corn':'corn','ears fresh corn':'corn',
  'shredded monterey jack':'monterey jack cheese','shredded monterey jack or cheddar cheese':'monterey jack cheese',
  'or avocado':'avocado',
  'thick cut bacon strips':'bacon','strips thick cut bacon':'bacon','strips thick-cut bacon':'bacon',
  'pieces':'',  // splitter byproduct ("1 inch pieces")
  'low sodium tamari':'soy sauce',
  'tarragon sprigs':'fresh tarragon','sprigs tarragon':'fresh tarragon',
  'butter sticks':'butter','sticks butter':'butter',
  'cavatappi':'pasta','cavatappi pasta':'pasta','delallo cavatappi pasta':'pasta',
  'water to thin the dressing':'water','warm water to thin the dressing':'water',
  'cornflour / cornstarch':'cornstarch',
  'pita bread loaves':'pita bread',
  'firm':'',  // ambiguous (was matching to extra firm tofu)
  'pumpkin sesame sunflower etc':'pumpkin seeds',
  'cream 20%':'heavy cream','cream 20% fat':'heavy cream',
  'garlic herb':'garlic',
  'scallions (white green parts separated':'fresh scallions',
  'fingerling potato':'fingerling potatoes','fingerling potatoes':'potatoes',
  'lemon zest plus 2 tablespoons lemon juice':'lemon',
  'cilantro mint':'fresh cilantro',
  'leaves mint':'fresh mint',
  'red onion onion':'red onion','red onion or yellow onion':'red onion',
  'shredded lettuce and/or greens of choice':'lettuce',
  'cinnamon piece':'cinnamon stick',
  'lemon zest from one lemon':'lemon','lemon zest from one small lemon':'lemon',
  'feta cheese block':'feta cheese',
  'cherry tomatoes on the vine':'cherry tomatoes',
  'avocado green onions':'avocado',
  // Round 59 — final 11 cleanup
  'some sort of flatbread or couscous or rice':'cooked rice',
  'other fresh':'fresh herbs',
  '4 x':'',
  '/ or cilantro':'fresh cilantro',
  '1 inch julienne pieces':'',
  'julienne pieces':'',
  'use ½ teaspoon morton), more, as needed':'salt',
  // Round 58 — splitter-noise cleanup pass
  'garlicherbs':'garlic',
  'sort of flatbread or couscous or rice':'cooked rice',
  'swiss chard collard greens greens':'collard greens','collard greens mustard greens':'collard greens',
  '2 cups peeled, diced white sweet potatoes*':'sweet potatoes',
  ', for garnish: 2 tablespoons finely chopped fresh flat-leaf parsley, chives and/or green onions':'fresh italian parsley',
  'extra harissa':'harissa',
  'or 1/4 tsp. kosher salt':'salt','or 1 1/2 cups black beans':'black beans','or 1 1/2 cups chickpeas':'chickpeas',
  '5 teaspoon (20g) diamond crystal':'salt','diamond crystal':'salt','morton kosher salt':'salt',
  'but lovely: fresh oregano':'fresh oregano','but lovely: minced fresh oregano':'fresh oregano',
  '(jalapeno slices':'jalapeno','(jalapeno slices, for garnish':'jalapeno',
  'pine nuts some more lemon zest gomasio bee pollen big salt flakes':'pine nuts',
  'capered lemon dill sauce':'',
  'any combination of kimchi chile crisp nori sheets':'kimchi',
  'mixed herbs - basil':'fresh basil',
  'more cashews seeds':'cashews','more cashews or hemp seeds':'cashews',
  'used as scoopers to eat bites of salad':'',
  'tornherbs (like mint, dill, parsley, or for serving)':'fresh herbs','fresh tornherbs':'fresh herbs','tornherbs':'fresh herbs',
  'mixed cilantro':'fresh cilantro',
  'bell peppers mix red':'bell peppers',
  'smoked paprika oregano':'smoked paprika',
  'soy sauce/fish sauce':'soy sauce',
  'roastedfresh tomatoes':'roasted tomatoes','roasted fresh tomatoes':'roasted tomatoes',
  'pasta- acini de pepe pastina':'pastina',
  'little gem lettuce red':'little gem lettuce','little gem lettuce, red or green leaf lettuce':'little gem lettuce',
  'spring onions / scallions':'fresh scallions',
  'bunch cilantro leaves':'fresh cilantro',
  'stems a few leaves reserved':'',
  'or free-range chicken':'whole chicken','large organic or free-range chicken':'whole chicken',
  'or the same weight in chicken thighs with the skin on the bone pieces':'chicken thighs',
  'additional parsley':'fresh parsley','additional chopped parsley':'fresh parsley',
  'slivered pistachios':'pistachios',
  'plus chiles':'chiles','plus thinly sliced chiles':'chiles',
  'steamed jasmine rice':'jasmine rice',
  'drumsticks legs':'chicken drumsticks',
  'black peppercorns all wrapped in a packet made of':'black peppercorns',
  'green leek':'leek','green leek leaves':'leek',
  'filet arctic char':'arctic char',
  'other herbs':'fresh herbs',
  'tubes':'',
  'italianfresh seasoning':'italian seasoning','italian fresh seasoning':'italian seasoning',
  'white wine marsala wine':'white wine',
  'stir-fry vegetables':'mixed vegetables',
  'optional, for garnish: hot sauce, pickled red onion, jalapeño (fresh or pickled), avocado':'hot sauce',
  'crisp salad greens':'mixed greens',
  '1 cup fresh packed':'',
  'baby back ribs neck bones':'baby back ribs',
  '0022 pieces*':'',
  // Round 57 — fix the 2 sub-80% recipes (BBQ Chicken Bowls + Pan-Fried Salmon)
  'additional bbq sauce':'bbq sauce',
  'pwwb bbq dry rub':'','pwwb bbq dry rub, below':'',
  'pinch of saffron threads mixed with':'saffron threads',
  'then juice to get':'',
  '1 tsp':'','1 teaspoon':'',
  // Round 56 — batch from round 55 audit (post empty-fallback fix)
  '---':'','--':'',
  'roasted corn kernels':'roasted corn kernels',
  'sheets phyllo dough':'phyllo dough',
  'sweet potatoes dice':'sweet potatoes',
  'smoked paprika powder':'smoked paprika',
  'smooth dijon mustard':'dijon mustard',
  'whole milk heavy cream':'heavy cream',
  'whole chicken wing':'chicken wings','whole chicken wings':'chicken wings',
  'your favorite vegetables':'',
  'snack-size (2-by-3-inch) sheet roasted nori crumbled':'nori','snack-size sheet roasted nori':'nori','sheet roasted nori':'nori',
  'bouquet garni made of 8 sprigs thyme 2 sprigs italian parsley 2 bay leaves 1/2 teaspoon black peppercorns all wrapped in a packet made of 2 green leek':'fresh thyme',
  'stem scallions':'fresh scallions',
  'aquafaba':'chickpea liquid','reserved chickpea liquid':'chickpea liquid',
  'white fish filets':'white fish','white fish filet':'white fish',
  'serano chili':'serrano pepper','serano':'serrano pepper',
  'thick-cut boneless salmon fillets each weighing 100g (4oz) skinned':'salmon fillet',
  'yellow onion from 1 onion':'yellow onion','minced yellow onion from 1 small onion':'yellow onion',
  'teasoon black pepper':'black pepper','teasoon ground black pepper':'black pepper',
  'thin lemon slices':'lemon',
  'wild-caught sockeye salmon fillet':'salmon fillet','wild-caught sockeye salmon':'salmon',
  'wild-caught lobster tails':'lobster tails',
  'tomatoes-on-the-vine':'tomatoes',
  'seasoned black beans':'black beans',
  'sheet frozen puff pastry':'puff pastry',
  'sweet vidalia onions':'vidalia onion','sweet vidalia onion':'vidalia onion',
  'shredded red/purple cabbage':'red cabbage',
  'steamed basmati rice':'basmati rice',
  'combo of snow peas baby carrots broccoli florets':'stir-fry vegetables',
  'sweet corn ears':'corn','sweet corn':'corn',
  'thick whole milk greek yogurt':'whole milk greek yogurt',
  'unsulphured molasses':'molasses','unsulphured organic molasses':'molasses',
  'thick non-dairy yogurt':'non-dairy yogurt',
  // Round 55 — batch from round 54 audit (post alias-bug-fix)
  '3-ingredient mediterranean salad,  ((or sliced tomatoes and cucumbers, and chopped parsley) )':'',
  'a spice mill or mortar and pestle':'',
  'any other seasoning you like (garlic powder, chili powder, nutritional yeast, old bay even!)':'',
  'cooked or raw vegetables to accompany (i like roasted broccoli)':'',
  'ten to twelve 8"–10" metal skewers, or bamboo, soaked 30 minutes':'',
  '1  head, (or about 1 cup roughly chopped fresh cilantro)':'fresh cilantro',
  'suggested for serving: cooked white rice and tzatziki (homemade or store-bought)':'cooked white rice',
  '2 cups cooked, chopped chicken':'cooked chicken',
  'roasted corn kernels':'corn',
  'any other seasonings you like (i used simply organics adobo)':'',
  'for serving, as desired: cooked quinoa or rice, mixed greens, shredded cheddar or pepper jack, diced avocado or guacamole, finely chopped cilantro, additional bbq sauce, etc.':'cooked quinoa',
  'red snapper':'red snapper',
  'for serving, as desired: cooked rice or grains of choice, capered lemon dill sauce (below)':'cooked rice',
  'optional toppings, (see notes)':'',
  '2 cups cooked, chopped/shredded chicken':'cooked shredded chicken',
  'yam potato':'sweet potato','yam or sweet potato':'sweet potato',
  'stock cube mixed with 200ml of boiling water':'bouillon cube','stock cube':'bouillon cube',
  'sour cream pico de gallo guacamole shredded cheese':'sour cream',
  'thick bacon slices':'bacon',
  'wild caught sockeye salmon (or any salmon you have access to':'salmon','wild caught sockeye salmon':'salmon',
  'thickened / heavy cream':'heavy cream',
  'tamari/soy sauce/fish sauce':'soy sauce',
  'wild-caught jumbo shrimp':'shrimp',
  'tiny pinch of red pepper flakes':'red pepper flakes',
  '13.5 ounce cans unsweetened (full-fat coconut milk)':'full-fat coconut milk',
  'shaoxing rice wine dry sherry':'shaoxing rice wine','shaoxing rice wine, dry sherry or sake':'shaoxing rice wine',
  'streaky free-range bacon slices':'bacon',
  '8-10 pre-soaked skewers (optional)':'',
  'whole wheat elbows':'whole wheat pasta','whole wheat elbows or shells':'whole wheat pasta',
  'white cheddar cheese slice':'white cheddar cheese',
  'side of salmon boneless skinless':'salmon',
  'sheet seaweed':'nori','dried seaweed or sushi nori':'nori',
  'thick pieces of skinless white firm fish fillet':'white fish',
  'thick italian crust bread slices':'italian bread',
  'vegan yoghurt':'vegan yogurt',
  'shredded lettuce/cabbage':'lettuce',
  'wonton strips scallions sesame seeds':'wonton strips',
  'vinegar- white':'white vinegar','vinegar- white or rice wine':'white vinegar',
  'slender heirloom carrots clean dry':'carrots',
  'strands mace':'mace',
  'white albacore tuna in olive oil':'albacore tuna in olive oil','white albacore tuna packed in olive oil':'albacore tuna in olive oil',
  'for serving, as desired: extra virgin olive oil, leafy parsley, lemon zest, lemon wedges, crusty bread, etc.':'olive oil',
  'shop-bought crispy onions':'crispy onions',
  'whole lamb shoulder scored':'lamb shoulder',
  'soft figs':'dried figs','soft dried figs':'dried figs',
  'sautã©ed cauliflower rice':'cauliflower rice','sautéed cauliflower rice (to serve over)':'cauliflower rice',
  'unrefined brown sugar':'brown sugar',
  'tablesponns butter':'butter','tablesponns unsalted butter':'butter',
  // Round 54 — batch from round 53 audit
  'mediterranean salad':'',
  'thick soft whole grain slices':'whole grain bread','thick soft whole grain or white bread':'whole grain bread',
  'sautéed cauliflower rice':'cauliflower rice','sauteed cauliflower rice':'cauliflower rice',
  'sautéed broccoli':'broccoli','sauteed broccoli':'broccoli',
  'twists of black pepper':'black pepper','twists of freshly ground black pepper':'black pepper',
  'whole wheat bread slice':'whole wheat bread',
  'whole snapper':'red snapper','whole fish':'red snapper',
  'thick-cut bacon slices':'bacon',
  'for serving, as desired: cooked quinoa or rice, mixed greens, shredded cheddar or pepper jack, diced avocado or guacamole, finely chopped cilantro, additional bbq sauce, etc.':'cooked quinoa',
  'for serving, as desired: cooked rice or grains of choice, capered lemon dill sauce (below)':'cooked rice',
  'any combination of kimchi chile crisp nori sheets cucumber avocado':'kimchi',
  'teaspon garlic powder':'garlic powder',
  'toppings':'',
  'thick coconut milk':'full-fat coconut milk',
  "trader joe's chicken shawarma":'chicken shawarma',"trader joe's chicken shawarma (or see notes making the chicken from scratch!)":'chicken shawarma',
  'slab of salmon':'salmon',
  'steamed rice cilantro lime chili oil':'cooked white rice',
  'sesame oil olive oil':'sesame oil','sesame oil or extra virgin olive oil':'sesame oil',
  'sweet potato chunks thicker is better':'sweet potato',
  'unsated butter':'butter','unsated':'butter',
  'suggested garnishes: pickled red onion fresh cilantro chili crunch':'pickled red onion',
  'suggested garnishes: vegan parmesan cheese fresh basil':'vegan parmesan cheese','suggested garnishes: vegan parmesan fresh basil':'vegan parmesan cheese',
  'thin asparagus stalks':'asparagus',
  'scotch bonnet papper':'scotch bonnet pepper',
  'side wild salmon fillet':'salmon fillet',
  'smoked salmon into pieces':'smoked salmon',
  'sweet potatoes into 1/4-inch cubes':'sweet potatoes',
  // Round 53 — batch from round 52 audit
  'steamed rice naan':'cooked white rice','steamed rice and naan':'cooked white rice',
  'steamed white':'cooked white rice','steamed white or brown rice':'cooked white rice',
  'sesame seeds scallions cilantro':'sesame seeds',
  'black pepper chili flakes':'black pepper','black pepper and chili flakes':'black pepper',
  'garnishes: avocado coconut yogurt lime wedges':'avocado',
  'boiling water':'water',
  'shredded lettuce/green onion/cilantro':'lettuce',
  'each onion powder garlic powder':'onion powder',
  'green onions sesame seeds':'fresh green onions',
  'mixed herbs: basil dill parsley':'fresh basil',
  'delallo castelvetrano olives':'castelvetrano olives','delallo pitted castelvetrano olives':'castelvetrano olives',
  'spice mill':'',
  'toppings: parmesan cheese fresh basil':'parmesan cheese','toppings: parmesan and finely-chopped fresh basil':'parmesan cheese',
  'jarred favorite marinara sauce':'marinara sauce','favorite marinara sauce':'marinara sauce',
  'shredded low-moisture shredded mozzarella cheese':'mozzarella cheese','shredded low-moisture mozzarella':'mozzarella cheese',
  'to twelve 8"–10" metal skewers':'','metal skewers':'','bamboo skewers':'',
  'pearl onions roma tomatoes sweet peppers':'pearl onions','pearl onions, roma tomatoes, sweet and hot peppers':'pearl onions',
  'white fish (snapper cod etc.':'white fish','white fish (snapper cod etc':'white fish',
  'suggested toppings: crumbled bacon':'bacon','suggested toppings: crumbled bacon or crispy pancetta':'bacon',
  'whole-milk cottage cheese':'cottage cheese',
  'toppings: chives crunchy onions blue cheese crumbles':'fresh chives',
  'for garnish: 2 tablespoons finely chopped fresh flat-leaf parsley, chives and/or green onions':'fresh italian parsley',
  'suggested':'','suggested for serving: cooked white rice and tzatziki':'cooked white rice',
  'wasabi peas for crunch':'wasabi peas',
  'tablesoons chives':'fresh chives','tablesoons minced chives':'fresh chives',
  'side of salmon (pin bones removed':'salmon','side of salmon':'salmon',
  'sesame oil separated':'sesame oil',
  'stems scallions':'fresh scallions',
  'thickened/heavy cream':'heavy cream',
  'sauce like sriracha':'hot sauce','hot sauce like sriracha':'hot sauce',
  'pork spareribs baby back ribs neck bones':'baby back ribs',
  'wavy plantain chips i am obsessed with these!':'plantain chips','wavy plantain chips':'plantain chips',
  'toppings: smoked paprika':'smoked paprika',
  'stemmed curly kale':'kale','stemmed and roughly chopped curly kale':'kale',
  'sour cream applesauce':'sour cream',
  'roasted corn kernels':'corn','grilled or roasted corn kernels cut off the cob':'corn',
  'skin-on sea bass pieces':'sea bass','skin-on sea bass':'sea bass',
  '"poultry blend" herbs':'fresh herbs','poultry blend herbs':'fresh herbs','poultry blend fresh herbs':'fresh herbs',
  'whole salmon filet':'salmon','whole salmon fillet':'salmon',
  'tsp sweet soy sauce / kecap manis':'soy sauce','sweet soy sauce / kecap manis':'soy sauce','kecap manis':'soy sauce',
  // Round 52 — persistent residuals + new items
  '13.5- ounce cans':'canned coconut milk',
  '2 cups cooked, chopped chicken':'cooked chicken',
  '2 cups cooked, chopped/shredded chicken':'cooked shredded chicken',
  '28-ounce crushed san marzano tomato':'canned san marzano crushed tomatoes',
  '3-4 boneless skinless chicken breast':'boneless skinless chicken breast',
  'bone-in skin-on chicken- a mix of breasts thighs are perfect pieces':'bone-in skin-on chicken breast and thighs',
  'bone-in skin-on chicken- a mix of breasts thighs are perfect piec':'bone-in skin-on chicken breast and thighs',
  'fillets center-cut salmon skinned':'salmon fillets',
  'fully-cooked chicken sausage links':'chicken sausage',
  'mature spinach':'spinach',
  'lower-sodium vegetable':'vegetable broth','lower sodium vegetable':'vegetable broth',
  // Garnish-list residual aliases (persistent across rounds)
  'garnishes: additional parsley black pepper':'fresh parsley',
  'garnishes: avocado (jalapeno slices, cilantro, queso fresco)':'avocado',
  'garnishes: flat leaf parsley cilantro pomegranate seeds nuts':'fresh italian parsley',
  'garnishes: queso fresco fresh cilantro avocado extra lime wedges':'queso fresco',
  'garnishes: scallions cilantro':'fresh scallions',
  'garnishes: sesame seeds herbs like cilantro':'sesame seeds',
  'additions: green olives capers avocado feta cheese and/or hummus':'feta cheese',
  'optional for garnish: hot sauce, pickled red onion, jalapeño (fre':'hot sauce',
  'options cilantro tomatoes avocado slices':'fresh cilantro',
  'for garnish: 2 tablespoons finely chopped fresh flat-leaf parsley':'fresh italian parsley',
  'for serving, as desired: cooked quinoa or rice, mixed greens, shr':'cooked quinoa',
  'for serving, as desired: cooked rice or grains of choice, capered':'white rice',
  'for serving, as desired: extra virgin olive oil, leafy parsley, l':'extra virgin olive oil',
  // Specific new aliases
  'salted plantain':'plantain','salty lime chips':'lime chips',
  'sambal olek plus 1 -2 tablespoons more for extra spicy':'sambal oelek','sambal olek':'sambal oelek',
  'kosher salt black pepper':'salt',
  'each chili powder cumin':'chili powder',
  'each fresh basil parsley':'fresh basil',
  'each fresh parsley dill':'fresh parsley',
  'each salt sugar':'salt',
  'asafoetida':'asafoetida','any combination of kimchi chile crisp nori sheets cucumber avocad':'kimchi',
  'any other seasoning you like':'','any other seasonings you like':'',
  'or vegetables to accompany':'','other desired herbs':'fresh herbs',
  'pre-soaked skewers':'',
  // Round 51 — P-Z batch
  // Picked herbs → fresh herb
  'picked coriander':'fresh cilantro','picked cilantro':'fresh cilantro',
  'picked mint':'fresh mint','picked oregano':'fresh oregano',
  'picked parsley':'fresh parsley','picked rosemary':'fresh rosemary',
  'picked thyme':'fresh thyme','picked sage':'fresh sage',
  // Salmon/cod pieces variants
  'pieces of cod':'cod fillet','pieces cod':'cod fillet',
  'pieces of salmon':'salmon fillet','pieces salmon':'salmon fillets',
  'portions salmon fillet':'salmon fillet','primewaters salmon fillet':'salmon fillet',
  // ', plus N <unit>' leftovers
  'plus 1 1/2 tbsp. rice vinegar':'rice vinegar','plus 1 1/2 tbsp rice vinegar':'rice vinegar',
  'plus 1 tablespoon ground turmeric':'ground turmeric',
  'plus 1 teaspoon lemon juice':'lemon juice',
  'plus 1 teaspoon white sesame seeds':'white sesame seeds',
  'plus 1/2 cup flour':'flour',
  'plus 2 teaspoons extra virgin olive oil':'olive oil',
  'plus 4 teaspoons of sugar':'sugar','plus 4 teaspoons sugar':'sugar',
  // Specific aliases
  'pickle juice (i get this':'pickle juice',
  'piece ginger':'fresh ginger','small piece ginger':'fresh ginger',
  'pinch of saffron threads mixed with 1 tbsp water':'saffron threads',
  'pinch red pepper flakes':'red pepper flakes','large pinch red pepper flakes':'red pepper flakes',
  'pizza dough ball':'pizza dough',
  'plain brisket 3 pounds':'brisket','plain brisket':'brisket',
  'plant-based milk of choice':'almond milk','plant based milk':'almond milk',
  'plant-based milk':'almond milk',
  'plum tomatoes slices':'plum tomatoes',
  'pork spareribs baby back ribs neck bones':'baby back ribs',
  'pork spareribs, baby back ribs, neck bones':'baby back ribs',
  'prepared hummus':'hummus',
  'private reserve extra virgin olive oil':'extra virgin olive oil',
  'pure maple syrup depending how sweet you like your slaw':'maple syrup',
  'red chilli split':'red chili',
  'red curry paste ( store bought':'red curry paste','red curry paste store bought':'red curry paste',
  'red harissa sauce':'harissa','harissa sauce':'harissa',
  'red pepper flakes reduce':'red pepper flakes','red pepper flakes omit':'red pepper flakes',
  'red thai chiles but kept intact':'thai chiles','red thai chiles':'thai chiles',
  'red yellow':'bell peppers','red yellow peppers':'bell peppers',
  'red yellow orange bell peppers':'bell peppers',
  'refrigerated cheese tortellini':'cheese tortellini',
  'regular powder':'curry powder','regular curry powder':'curry powder','spicy curry powder':'curry powder',
  'reserved chickpea liquid':'aquafaba','chickpea liquid':'aquafaba',
  'reserved pasta water':'water','reserved strained cooking liquid':'water',
  'roasted cashews halves':'roasted cashews',
  'roasted cumin seeds bruised using a mortar pestle':'cumin seeds',
  'roasted cumin seeds':'cumin seeds',
  'roasted herb tomatoes':'tomatoes',
  'roasted peanut oil':'peanut oil',
  'runny honey':'honey',
  'plain yogurt cilantro pickled onions':'plain yogurt',
  // Round 50 — M-Z batch
  'mature spinach':'spinach',
  'meaty firm fish':'white fish',
  'medium-sized green bell pepper':'green bell pepper',
  'medium-sized red bell pepper':'red bell pepper',
  'medium-sized sweet potatoes':'sweet potatoes',
  'mixed black white sesame seeds':'sesame seeds',
  'mixed black and white sesame seeds':'sesame seeds',
  'mixed cherry tomatoes':'cherry tomatoes',
  'mixed cilantro dill':'fresh cilantro',
  'mixed cilantro and dill':'fresh cilantro',
  'mixed fresh parsley':'fresh parsley',
  'mixed green black olives':'olives','mixed green and black olives':'olives',
  'mixed greens/arugula':'mixed greens','mixed greens arugula':'mixed greens',
  'mixed herbs - basil thyme dill':'fresh herbs',
  'mixed herbs cilantro parsley dill':'fresh herbs',
  'mixed herbs lettuce tzatziki':'mixed herbs',
  'mixed mushrooms':'mushrooms',
  'mixed sesame and/or sunflower seeds':'sesame seeds',
  'mixed tomatoes':'tomatoes',
  'more tablespoon fresh parsley':'fresh parsley',
  'mushrooms- cremini portobello shiitake button':'mushrooms',
  'mustard- whole grain':'whole grain mustard',
  // Peanut butter — user wants 'creamy peanut butter' canonical (smooth = creamy)
  'natural creamy peanut butter':'creamy peanut butter',
  'natural peanut butter smooth':'creamy peanut butter',
  'natural peanut butter':'creamy peanut butter',
  'smooth peanut butter':'creamy peanut butter',
  'peanut butter smooth':'creamy peanut butter',
  'new zealand grass-fed flank steak':'flank steak',
  'nonstick cooking spray for grilling':'nonstick cooking spray',
  'o organics® baby arugula':'baby arugula','o organics baby arugula':'baby arugula',
  'oil for greasing':'olive oil',
  'oil-packed anchovy filets':'anchovy fillets','oil-packed anchovy fillets':'anchovy fillets',
  'oil-packed sun tomatoes':'sun-dried tomatoes',
  'oil-packed sun dried tomatoes':'sun-dried tomatoes',
  'old-fashioned rolled oats':'rolled oats',
  'or 1 tbsp. plus 1/2 tsp. kosher salt':'salt',
  'or 1/2 a red onion':'red onion',
  'or 1/4 tsp. kosher salt plus':'salt',
  'or 3 tablespoons chili paste with garlic':'chili paste',
  'or free-range chicken 1.3kg into 8 pieces':'whole chicken',
  'organic free-range chicken':'whole chicken',
  'or frozen/thawed fire-roasted corn':'fire-roasted corn',
  'or roasted corn kernels cut off the cob ears':'roasted corn kernels',
  'roasted corn kernels':'roasted corn kernels',
  'packet mccormick grill mates brazilian steak house marinade':'mccormick grill mates brazilian steak house marinade',
  'packet onion soup mix':'onion soup mix',
  "packets mike's mighty fried garlic chicken ramen soup":"mike's mighty fried garlic chicken ramen soup",
  "packs dry ramen noodles":'ramen noodles',
  'palmful of cilantro':'fresh cilantro','palmful cilantro':'fresh cilantro',
  'part skim shredded cheddar cheese':'shredded cheddar cheese',
  'pasta- acini de pepe pastina pearl couscous':'pasta',
  'perfect sauteed broccoli':'broccoli','perfect sautéed broccoli':'broccoli',
  // Round 49 — long-tail
  // 'lite coconut milk' KEPT (added DB entry)
  'little gem lettuce 3-4 heads':'little gem lettuce',
  'loaf crusty bread':'crusty bread','small loaf crusty bread':'crusty bread',
  'long grain jasmine rice':'jasmine rice','long-grain jasmine rice':'jasmine rice',
  'long noodles of choice':'noodles','long noodles':'noodles',
  'long sweet potatoes':'sweet potatoes',
  'lots of black pepper':'black pepper','lots of freshly ground black pepper':'black pepper',
  'lots of limes':'limes','lots of fresh limes':'limes',
  'lower-sodium tamari':'low-sodium tamari','lower sodium tamari':'low-sodium tamari',
  // Round 48 — exact-match aliases for persistent + new items
  '+ 1/3 cup extra virgin olive oil':'olive oil',
  '+ 3 tablespoons sesame seeds':'sesame seeds',
  '+ 1 tbsp extra virgin olive oil':'olive oil',
  '+ 1 teaspoon cornstarch':'cornstarch',
  '+ 1 teaspoon vegetable oil':'vegetable oil',
  '1  head,':'fresh cilantro','1 head,':'fresh cilantro',
  '1  head':'fresh cilantro','1 head':'fresh cilantro',
  'head fresh cilantro':'fresh cilantro',
  'leaves parsley (stems removed':'fresh parsley',
  'leaves parsley':'fresh parsley',
  'leaves thyme sprigs tied in kitchen twine':'fresh thyme',
  'leaves thyme sprigs':'fresh thyme',
  'lebanese pita (- cut':'lebanese pita',
  'lebanese pita':'pita',
  'less sodium soy sauce':'soy sauce','reduced-sodium soy sauce':'soy sauce',
  'light flavored oil - light olive':'olive oil',
  'light flavored oil':'olive oil','light olive oil':'olive oil',
  'light spray avocado oil':'avocado oil',
  'limes/lime juice':'lime juice',
  'limes: 1':'limes','limes 1':'limes',
  // Round 47 — long-tail
  'jarred pickled ginger + 2 tablespoons juice':'pickled ginger',
  'jarred pickled ginger':'pickled ginger',
  'kosher salt to season':'salt',
  'lacinto':'lacinato kale','dino kale':'lacinato kale',
  'largely carrots':'carrots','largely chopped carrots':'carrots',
  'lean ground turkey':'93% lean ground turkey',
  'lean skin-on pork belly':'pork belly','lean pork belly':'pork belly',
  'leaves fresh sage 6 leaves + 1 tbsp':'fresh sage',
  'leaves fresh sage':'fresh sage','leaves of fresh sage':'fresh sage',
  'leaves from 8 sprigs fresh thyme':'fresh thyme',
  'leaves from sprigs fresh thyme':'fresh thyme','leaves of fresh thyme':'fresh thyme',
  // Round 46 — long-tail
  'heavy cream/whipping cream':'heavy cream','heavy cream whipping cream':'heavy cream',
  'high olive oil':'olive oil','high quality olive oil':'olive oil',
  'hulled pumpkin seeds':'pumpkin seeds','raw hulled pumpkin seeds':'pumpkin seeds',
  'hungarian paprika sweet':'paprika','hungarian paprika':'paprika',
  'hunk of parmesan cheese':'parmesan cheese','hunk parmesan cheese':'parmesan cheese',
  'japanese sweet potatoes/sweet potatoes':'sweet potatoes','japanese sweet potatoes':'sweet potatoes',
  'jarred 24- marinara':'marinara sauce','jar marinara':'marinara sauce',
  'jarred oil-packed sun-dried tomatoes':'sun-dried tomatoes',
  'oil-packed sun-dried tomatoes':'sun-dried tomatoes',
  'jones dairy farm antibiotic free turkey sausage':'turkey sausage',
  'antibiotic free turkey sausage':'turkey sausage',
  'juicy tomatoes':'tomatoes','medium juicy tomatoes':'tomatoes',
  'kalmata olives':'kalamata olives','kalmata olive':'kalamata olives',
  // Round 45 — long-tail
  'green onion mostly green parts':'green onion',
  'green part of 2 spring onions / scallions':'scallions',
  'green part of spring onions / scallions':'scallions',
  'green part of scallions':'scallion',
  'habanero pepper/jalapeno':'habanero pepper',
  'habanero pepper jalapeno':'habanero pepper',
  'grinds of black pepper':'black pepper','few grinds of black pepper':'black pepper',
  'ground cardamon':'ground cardamom','ground cardamoms':'ground cardamom',
  'ground pork ((85g':'ground pork','ground pork (85g':'ground pork',
  'handfful of fresh dill':'fresh dill','handful of fresh dill':'fresh dill',
  'hard-boiled eggs':'hard boiled eggs','hardboiled eggs':'hard boiled eggs','boiled eggs':'hard boiled eggs',
  'heads of broccoli':'broccoli','small heads of broccoli':'broccoli','large heads of broccoli':'broccoli',
  'heads romaine':'romaine lettuce','heads of romaine':'romaine lettuce',
  'heavy cream sour cream':'heavy cream',
  'green onions cilantro':'green onion',
  'greek yogurt limes sea salt':'greek yogurt',
  // Round 44 — long-tail (garnish lists already resolve via splitter; remaining aliases here)
  'garam masala + 1/4 tsp':'garam masala',
  'garnish: 1-2 tablespoons italian parsley':'fresh italian parsley',
  'garnish: fresh cilantro lime':'fresh cilantro',
  'garnish: fresh parsley':'fresh parsley',
  'generous handfuls baby spinach':'baby spinach','generous handful baby spinach':'baby spinach',
  'ginger- cut across the grain slices':'fresh ginger','ginger cut across the grain':'fresh ginger',
  'glazed walnuts':'candied walnuts',
  'gluten-free pasta of choice':'gluten-free pasta','gluten-free fusilli':'gluten-free pasta',
  'goat cheese crumbles':'goat cheese',
  'good-quality mayonnaise':'mayonnaise','good quality mayonnaise':'mayonnaise',
  'good-quality olive oil':'olive oil','good quality olive oil':'olive oil',
  'granulated garlic powder':'garlic powder','granulated garlic':'garlic powder',
  'grapefruit zest plus 1 tablespoon juice':'grapefruit',
  'greek feta cheese in brine':'feta cheese','feta cheese in brine':'feta cheese',
  'block greek feta cheese in brine':'feta cheese',
  // Round 43 — long-tail
  'egg-free garlic aioli regular mayo':'mayo','egg-free garlic aioli':'mayo',
  'elbow-style pasta':'pasta',
  'extra-jumbo shrimp':'jumbo shrimp',
  'extra-large bunch asparagus':'asparagus',
  'extra-virgin olive oil for pan':'olive oil',
  'fig preserves/jam':'fig preserves',
  'filet arctic char salmon steelhead trout cod haddock':'salmon',
  'arctic char':'salmon','steelhead trout':'salmon',
  'fillets center-cut salmon skinned':'salmon fillets',
  'fingerling potatoes vertically':'fingerling potatoes',
  'firmly brown sugar':'brown sugar',
  'flake/chips coconut':'coconut flakes',
  'flat leave parsley':'fresh italian parsley',
  'flesh zest half a lemon':'lemon',
  'for garnish: 2 tablespoons finely chopped fresh flat-leaf parsley':'fresh italian parsley',
  'for garnish: 2 tablespoons finely chopped fresh flat-leaf parsley ':'fresh italian parsley',
  'frozen leaf spinach defrosted liquid out':'frozen spinach',
  'frozen peas defrosted':'frozen peas',
  'frozen spinach thawed/ dry':'frozen spinach',
  'full racks baby back pork ribs':'baby back pork ribs','full rack baby back pork ribs':'baby back pork ribs',
  'fully-cooked chicken sausage links':'chicken sausage','fully cooked chicken sausage':'chicken sausage',
  // Round 42 — long-tail batch
  // Dry-X grain prefix → strip "dry"
  'dry basmati rice':'basmati rice',
  'dry black lentils':'black lentils',
  'dry israeli couscous':'pearl couscous','israeli couscous':'pearl couscous',
  'dry jasmine rice':'jasmine rice',
  'dry liguine':'linguine','liguine':'linguine',
  'dry long-grain white rice':'long-grain white rice',
  'dry pearl couscous':'pearl couscous',
  'dry short cut pasta':'pasta','short cut pasta':'pasta',
  'dry unoaked white wine':'dry white wine','unoaked white wine':'dry white wine',
  // Creamy/crispy prefix
  'creamy blue cheese':'blue cheese',
  'creamy cashew butter⁣':'cashew butter','creamy cashew butter':'cashew butter',
  'creamy tzatziki sauce':'tzatziki sauce',
  'crispy bacon bits':'bacon bits',
  'crispy wonton strips':'wonton strips',
  // 'crunchy peanut butter' kept as-is (user spec); DB entry below handles it
  // Vague qty markers
  'couple dashes of sauce':'hot sauce','dashes of sauce':'hot sauce',
  'cracks of black pepper':'black pepper','cranks of black pepper':'black pepper',
  'dollop of vegan sour cream':'sour cream',
  'drizzle olive oil':'olive oil',
  // Specific aliases
  'cm piece ginger':'fresh ginger','centimeter piece ginger':'fresh ginger',
  'cod fillet pieces':'cod fillet',
  'crustless sourdough broken':'sourdough bread','crustless sourdough':'sourdough bread',
  'cut up fish':'fish','cut up assorted fish':'fish','assorted fish':'fish',
  'dairy-free sweet potatoes':'sweet potatoes','dairy free sweet potatoes':'sweet potatoes',
  'dalkin&co lemon pepper seasoning':'lemon pepper seasoning',
  'dalkin&amp;co lemon pepper seasoning':'lemon pepper seasoning',
  'lemon pepper seasoning':'lemon pepper seasoning',
  'dark lager like negro modelo':'dark lager','negro modelo':'dark lager',
  // 'coarse mustard' kept as-is (user spec); DB entry below
  // 'canned diced fire-roasted tomatoes' kept (canned form); DB entry below
  'diced fire-roasted tomatoes with their juices':'canned diced fire-roasted tomatoes',
  'diced fire-roasted tomatoes':'canned diced fire-roasted tomatoes',
  'dulce verde':'lettuce',
  // Round 41 — repeating long-tail (parsed forms with parens/junk that need exact-key alias)
  '+ 1 tbsp extra virgin olive oil':'olive oil',
  '+ 1 teaspoon cornstarch':'cornstarch',
  '+ 1 teaspoon vegetable oil':'vegetable oil',
  "' knob fresh ginger":'fresh ginger',
  '(1 3/4 lb) butternut squash 1/4”':'butternut squash',
  '(1 3/4 lb) butternut squash 1/4':'butternut squash',
  '(1/2 pound) thin asparagus tough ends removed cut':'asparagus',
  '(16- to 17-ounce) package potato gnocchi':'potato gnocchi',
  '(6-ounce) firm skinless white fish fillets':'white fish fillet',
  '(6 to 8-ounce) center cut salmon filets':'salmon filets',
  '[6-ounce] center-cut salmon filets':'salmon filets',
  '6 ounce salmon fillets':'salmon fillets',
  '6-ounce skin-on salmon fillets':'salmon fillets',
  '4- to 6-ounce halibut fillets':'halibut fillets',
  'center-cut atlantic salmon (skin removed cut':'salmon',
  'center-cut atlantic salmon':'salmon',
  '13.5 ounce cans unsweetened (full-fat coconut milk)':'canned coconut milk',
  '14-ounce cans coconut milk':'canned coconut milk',
  '15-ounce can black beans':'canned black beans',
  '15-ounce cans beans of choice':'canned beans',
  '15-ounce cans low sodium pinto beans [you can sub black beans if desired but pinto beans are more traditional]':'canned pinto beans',
  '15-ounce cans low sodium pinto beans [you can sub black beans if ':'canned pinto beans',
  '2 cups cooked, chopped chicken':'cooked chicken',
  '2 cups cooked, chopped/shredded chicken':'cooked shredded chicken',
  '2/3 cup, plus 2 tablespoons  tamari or soy sauce':'soy sauce',
  '2/3 cup, plus 2 tablespoons tamari or soy sauce':'soy sauce',
  '4 tablespoons, plus 1/3 cup extra virgin olive oil':'olive oil',
  '1 teaspoon, plus 3 tablespoons sesame seeds':'sesame seeds',
  '28-ounce crushed san marzano tomato':'canned san marzano crushed tomatoes',
  '3 1/2–4 lb. chicken':'whole chicken',
  '3 1/2-4 lb. chicken':'whole chicken',
  '3-4 boneless skinless chicken breast':'boneless skinless chicken breast',
  '3-4 pound beef chuck roast':'beef chuck roast',
  '3-to-3 1/2-pound butternut squash':'butternut squash',
  '3- inch knob fresh ginger':'fresh ginger',
  '4 to 5 pound leg of lamb':'leg of lamb',
  '3/4 cup lukewarm water':'water',
  '1  head, (or about 1 cup roughly chopped fresh cilantro)':'fresh cilantro',
  '1 head, (or about 1 cup roughly chopped fresh cilantro)':'fresh cilantro',
  '3 ounces':'fresh baby spinach',
  'add ins: chicken tofu egg':'cooked chicken',
  'add-in for spice: 1 to 2 chipotle chiles in adobo':'chipotle peppers in adobo',
  'additions: green olives capers avocado feta cheese and/or hummus':'feta cheese',
  'aleppo pepper pepper flakes (or more':'aleppo pepper',
  'baby bok choy green onion':'baby bok choy',
  'bell peppers onions':'bell peppers',
  'bone-in skin-on chicken- a mix of breasts thighs are perfect piec':'bone-in skin-on chicken breast and thighs',
  'bouquet garni made of 8 sprigs thyme 2 sprigs italian parsley 2 b':'fresh herbs',
  'chile poblanos stemmed':'poblano','chile poblanos':'poblano',
  'chipotles in adobo plus 1 tbsp. adobo sauce':'chipotle peppers in adobo',
  'cloved garlic':'garlic cloves',
  'any combination of kimchi chile crisp nori sheets cucumber avocad':'kimchi',
  'any other seasoning you like':'',
  'any other seasonings you like':'',
  // Round 40 — bell peppers, herb fresh-prefix, salmon variants, recipe-author quirks
  'bell peppers 1/2-inch':'bell peppers',
  'bell peppers mix red yellow orange':'bell peppers',
  'bell peppers spiralized':'bell peppers',
  // Bunch/bundle of herb → fresh herb (user wants "fresh" prefix to differentiate from dried spice)
  'bunch of coriander':'fresh cilantro','bunch coriander':'fresh cilantro',
  'fresh coriander':'fresh cilantro','coriander leaves':'fresh cilantro',
  'bunch of flat-leaf parsley':'fresh italian parsley',
  'bunch of italian parsley':'fresh italian parsley',
  'flat-leaf parsley':'italian parsley','flat leaf parsley':'italian parsley',
  'bunch parsley':'fresh parsley',
  'bunch flat-leaf parsley':'fresh italian parsley',
  'bundle green onion':'fresh green onion','bundle of green onion':'fresh green onion',
  'bundle green onions':'fresh green onion','bundle of green onions':'fresh green onion',
  'bundle red leaf lettuce':'red leaf lettuce','bunch red leaf lettuce':'red leaf lettuce',
  'bulbs baby bok choy':'baby bok choy','bulb baby bok choy':'baby bok choy',
  'bunch lacinato kale':'lacinato kale','bunch kale':'kale',
  'bunch kale swiss chard collard greens':'kale',
  'bunch kale swiss chard collard greens greens':'kale',
  // Salmon variants
  'boneless skineless salmon fillets':'salmon fillets','boneless skinless salmon fillets':'salmon fillets',
  'center-cut salmon filets':'salmon filets',
  'center-cut salmon filets (6 - 8 oz each with skin removed)':'salmon filets',
  'center-cut skin-on salmon fillet':'salmon fillet',
  'center-cut skin-on salmon fillets':'salmon fillets',
  'center-cut atlantic salmon':'salmon','center cut atlantic salmon':'salmon',
  'atlantic salmon':'salmon',
  'big fillets of tilapia':'tilapia fillet','tilapia fillets':'tilapia fillet',
  // One-offs
  'barlett pears':'bartlett pears','bartlett pear':'bartlett pears',
  'basmati rice washed':'basmati rice',
  'bhindi':'okra',
  'bibb lettuce cups to make lettuce wraps':'bibb lettuce','lettuce cups':'bibb lettuce',
  'big cup fresh cilantro':'fresh cilantro',
  'black pepper plus':'black pepper',
  'black tea bags':'black tea',
  'block-style feta cheese':'feta cheese','block-style feta':'feta cheese',
  'bone-in short ribs at least 1':'bone-in short ribs',
  'bone-in skin-on chicken- a mix of breasts thighs are perfect piec':'bone-in skin-on chicken breast and thighs',
  'bone-in skin-on chicken- a mix of breasts and thighs':'bone-in skin-on chicken breast and thighs',
  'boneless butterflied leg of lamb':'leg of lamb',
  'boneless butterflied leg of lamb (weighing':'leg of lamb',
  'boneless pork shoulder excess cut':'boneless pork shoulder',
  'bouquet garni':'fresh herbs','bouquet garni made of 8 sprigs thyme 2 sprigs italian parsley 2 b':'fresh herbs',
  'braggs liquid aminos':'liquid aminos',
  'brown mustard {whole 30 compliant}':'brown mustard',
  'brown onions':'yellow onion','brown onion':'yellow onion',
  'brown onions (, 0.6cm (1/2in) wide)':'yellow onion',
  'brussels sprouts ended outer leaves removed':'brussels sprouts',
  'bulk italian sausage':'italian sausage',
  'bunch of flat-leaf parsley':'fresh italian parsley',
  'but lovely: fresh oregano /':'fresh oregano',
  'cajun seasoning us this':'cajun seasoning',
  'candied jalapeños':'pickled jalapeños','candied jalapenos':'pickled jalapenos',
  'cannellini beans great northern beans':'cannellini beans',
  'canola oil peanut oil':'canola oil',
  'cardamon':'cardamom',
  'chicken- boneless skinless chicken breast':'boneless skinless chicken breast',
  // Round 39 — long-tail
  'asofetida':'asafoetida','asafetida':'asafoetida','hing':'asafoetida',
  'frozen shelled edamame':'frozen shelled edamame','bag frozen shelled edamame':'frozen shelled edamame',
  'shelled edamame':'frozen shelled edamame',
  'back pepper':'black pepper',
  'asian fish sauce':'fish sauce',
  'andouille sausage links':'andouille sausage','andouille sausage link':'andouille sausage',
  'ancho chilies-rehydrated':'ancho chilies','ancho chiles-rehydrated':'ancho chilies',
  'dried ancho chilies':'ancho chilies','dried ancho chiles':'ancho chiles',
  'artichoke hearts in water':'artichoke hearts','artichoke hearts packed in water':'artichoke hearts',
  '+2 tsp milk':'milk','+ 2 tsp milk':'milk',
  // Round 38 — additional aliases
  'chipotle chiles in adobo':'chipotle peppers in adobo',
  'chipotle chile in adobo':'chipotle peppers in adobo',
  'aji amarillo paste':'aji amarillo paste','aji amarillo':'aji amarillo paste',
  'aji amarillo chile paste':'aji amarillo paste',
  'aji amarillo paste chile paste':'aji amarillo paste',
  'aleppo pepper':'aleppo pepper','aleppo pepper pepper flakes':'aleppo pepper',
  'all-natural garlic powder':'garlic powder','natural garlic powder':'garlic powder',
  // 'all purpose flour' / 'all-purpose flour' kept as-is (DB has them)
  'all purpose flour 1 tbsp':'all purpose flour',
  'all-purpose unbleached flour':'all purpose flour',
  'unbleached all purpose flour':'all purpose flour',
  '750-milliliter bottle of red wine':'red wine','bottle of red wine':'red wine',
  '1/3 less fat cream cheese':'reduced-fat cream cheese',
  'fresh baby spinach':'baby spinach',
  '6-8 oz boneless pork chops':'boneless pork chops',
  '6 salmon fillet portions':'salmon fillets',
  '6 salmon fillet portions (skin on':'salmon fillets',
  // Round 36 — paren-prefix container forms (user wants 'canned' kept)
  'potato gnocchi':'potato gnocchi','gnocchi':'potato gnocchi',
  'beef chuck roast':'beef chuck roast','chuck roast':'beef chuck roast',
  'leg of lamb':'leg of lamb',
  'whole chicken':'whole chicken',
  'butternut squash':'butternut squash',
  'halibut fillet':'halibut fillet','halibut fillets':'halibut fillet',
  'salmon fillet':'salmon fillet',
  'white fish fillet':'white fish fillet','white fish fillets':'white fish fillet',
  'firm white fish fillet':'white fish fillet','firm skinless white fish fillets':'white fish fillet',
  'pinto beans':'pinto beans','black beans':'black beans',
  'canned beans':'canned beans','canned black beans':'canned black beans',
  'canned pinto beans':'canned pinto beans',
  'canned coconut milk':'canned coconut milk',
  'unsweetened coconut milk':'canned coconut milk',
  'unsweetened full-fat coconut milk':'canned coconut milk',
  'beans of choice':'canned beans',
  'low sodium pinto beans':'canned pinto beans',
  'crushed san marzano tomatoes':'canned san marzano crushed tomatoes',
  'san marzano tomato':'canned san marzano crushed tomatoes',
  'crushed tomatoes':'canned crushed tomatoes',
  '1 head':'fresh cilantro','head fresh cilantro':'fresh cilantro',
  // Round 36b — , plus N <unit> trailing
  '1 teaspoon, plus 3 tablespoons sesame seeds':'sesame seeds',
  '2/3 cup, plus 2 tablespoons tamari or soy sauce':'soy sauce',
  '4 tablespoons, plus 1/3 cup extra virgin olive oil':'olive oil',
  // Round 36c — ginger normalization
  'knob fresh ginger':'fresh ginger',
  'ginger root':'fresh ginger',
  '-inch ginger root':'fresh ginger',
  '-inch knob fresh ginger':'fresh ginger',
  // Round 36d — name cleanup
  '16/20 shrimp':'shrimp', '16-20 shrimp':'shrimp', '16/20 raw shrimp':'shrimp',
  'cooked chopped chicken':'cooked chicken',
  'cooked chopped/shredded chicken':'cooked shredded chicken',
  'lukewarm water':'water', 'cold tap water':'water', 'hot tap water':'water',
  '-pound whole chicken':'whole chicken',
  '1/4 lbs boneless skinless chicken breast':'boneless skinless chicken breast',
  // Round 35 — long-tail cleanup
  'sweet and hot peppers':'sweet peppers', 'sweet hot peppers':'sweet peppers',
  'roma tomatoes sweet peppers':'roma tomatoes',
  'healthy pinch sea salt':'salt', 'pinch sea salt':'salt',
  'bone-in skin-on dark meat chicken pieces':'bone-in skin-on chicken thigh',
  'bone-in skin-on dark meat chicken':'bone-in skin-on chicken thigh',
  'dark meat chicken':'chicken thigh',
  '6-ounce cod fish fillets 1 to 1 1/2 inches thick':'cod fillet',
  'cod fillets':'cod fillet','cod filets':'cod fillet','cod filet':'cod fillet',
  '-sized lemon':'lemon', 'small to medium-sized lemon':'lemon', 'medium-sized lemon':'lemon',
  'delallo castelvetrano olives':'castelvetrano olives',
  'pitted castelvetrano olives':'castelvetrano olives',
  '(1 3/4 lb) butternut squash 1/4':'butternut squash',
  'bunch rainbow chard stemmed':'rainbow chard', 'rainbow chard stemmed':'rainbow chard',
  'plus 1 teaspoon arrowroot powder':'arrowroot powder',
  'havarti dill cheese slices':'havarti dill cheese',
  '(1-inch) pieces of italian':'italian bread', '(1-inch) pieces italian':'italian bread',
  'pieces of italian':'italian bread',
  'red capsicum / bell pepper':'red bell pepper',
  'creamy polenta':'polenta',
  'plus 1-2 teaspoons cajun seasoning':'cajun seasoning',
  'cajun seasoning':'cajun seasoning',
  'shredded low-moisture shredded mozzarella cheese':'shredded mozzarella cheese',
  'shredded low-moisture mozzarella':'shredded mozzarella cheese',
  'low-moisture mozzarella':'shredded mozzarella cheese',
  'coriander/cilantro leaves':'fresh cilantro', 'coriander cilantro leaves':'fresh cilantro',
  '2" piece ginger':'fresh ginger', '2-inch piece ginger':'fresh ginger',
  '2 inch fresh ginger':'fresh ginger',
  'hanger flatiron':'hanger steak', 'hanger thick skirt':'hanger steak',
  'flatiron':'flat iron steak',
  'creamy almond butter':'almond butter', 'creamy almonds butter':'almond butter',
  'loaf of bread':'bread', 'bread loaf':'bread',
  'frozen/thawed fire-roasted corn':'fire-roasted corn',
  'frozen fire-roasted corn kernels':'fire-roasted corn',
  'frozen fire-roasted corn':'fire-roasted corn',
  'roasted salted pumpkin seeds':'pumpkin seeds', 'roasted pumpkin seeds':'pumpkin seeds',
  'loaf ciabatta bread':'ciabatta bread', 'ciabatta bread loaf':'ciabatta bread',
  // Round 34 — clean-up of high-frequency 80-99% tier issues
  'dried poultry blend':'poultry seasoning',
  'steamed broccoli':'broccoli',
  '(2-inch) piece fresh ginger':'fresh ginger',
  '2-inch piece fresh ginger':'fresh ginger',
  'piece fresh ginger':'fresh ginger',
  'coconut yogurt':'coconut yoghurt',
  'dry wild rice blend':'wild rice blend',
  'dry wild rice':'wild rice',
  'non-fat greek yogurt':'fat free greek yogurt',
  '0% fat greek yoghurt':'fat free greek yogurt', '0% fat greek yogurt':'fat free greek yogurt',
  'fat-free greek yogurt':'fat free greek yogurt',
  'parmigiano':'parmigiano-reggiano',
  'parmigiano reggiano cheese':'parmigiano-reggiano cheese',
  'parmigiano reggiano':'parmigiano-reggiano',
  'gluten-free tamari soy sauce':'soy sauce',
  'jarred favorite marinara sauce':'marinara sauce', 'favorite marinara sauce':'marinara sauce',
  'turkish persian cucumbers':'cucumber', 'turkish persian english cucumbers':'cucumber',
  'persian cucumbers into coins':'cucumber',
  'bonesless skinless chicken thighs':'boneless skinless chicken thighs',
  'red capsicum':'red bell pepper', 'capsicum':'bell pepper',
  'firm slightly tart apples':'apples', 'firm tart apples':'apples',
  'boiled russet potatoes':'russet potatoes',
  'finely-chopped kale tough stems removed':'kale',
  'cubes ice':'ice', 'ice cubes':'ice',
  'wide strips of lime zest from 1 lime':'lime', 'lime zest from 1 lime':'lime',
  'bulb garlic separated into cloves':'garlic',
  'sour cream full-fat greek yogurt':'sour cream',
  'shelled salted pistachios ground':'pistachios',
  'crusty bread for dipping':'crusty bread',
  // Round 33 — Lamb Chops + Broccolini
  'rack of lamb':'lamb racks',
  'fresh poultry herbs':'poultry blend fresh herbs',
  'poultry herbs':'poultry blend fresh herbs',
  "gaby's garlic goodness olive oil":'garlic-infused olive oil',
  "gaby’s garlic goodness olive oil":'garlic-infused olive oil',
  // Round 32 — Goodbye Meatballs follow-up
  'canned tomatoes':'whole peeled tomatoes',
  'canned whole peeled tomatoes':'whole peeled tomatoes',
  'shredded cotija cheese':'cotija cheese', 'shredded cotija':'cotija cheese',
  'canned black beans':'black beans',
  'canned chickpeas':'chickpeas','canned kidney beans':'kidney beans','canned pinto beans':'pinto beans',
  'canned cannellini beans':'cannellini beans','canned navy beans':'navy beans',
  'whole milk full-fat ricotta cheese':'ricotta cheese',
  'whole milk ricotta cheese':'ricotta cheese',
  'full-fat ricotta cheese':'ricotta cheese',
  'whole-milk ricotta':'ricotta cheese',
  'grated parmesan cheese':'parmesan cheese', 'grated parmesan':'parmesan cheese',
  'grated parmigiano-reggiano cheese':'parmigiano-reggiano',
  'grated parmigiano-reggiano':'parmigiano-reggiano',
  // Round 31 — bottom-tier unstickers
  'salt + pepper':'salt',
  '6-inch tortillas':'corn tortillas', '8-inch tortillas':'flour tortillas','10-inch tortillas':'flour tortillas',
  'shredded cotija cheese':'cotija', 'cotija cheese':'cotija',
  'frescatrano olives':'castelvetrano olives',
  'baby creamer potato':'yukon gold potato', 'baby creamer potatoes':'yukon gold potatoes',
  'creamer potato':'yukon gold potato', 'creamer potatoes':'yukon gold potatoes',
  'pure clam juice':'clam juice',
  'skinless halibut':'halibut', 'skinless cod':'cod', 'skinless salmon':'salmon',
  'skinless tilapia':'tilapia',
  'frozen sweet peas':'frozen peas', 'sweet peas':'peas',
  'grassfed ground beef':'ground beef', 'grass-fed ground beef':'ground beef',
  'grassfed ground turkey':'ground turkey', 'grass-fed ground turkey':'ground turkey',
  'dried poultry blend':'poultry seasoning',
  'mixed herbs':'fresh herbs',
  'maple chipotle ketchup':'ketchup',
  'head red cabbage':'red cabbage', 'head cabbage':'cabbage', 'head green cabbage':'green cabbage',
  "za'atar viniagrette":"za'atar", "za’atar viniagrette":"za'atar",
  'persian cucumbers cut into bite sized':'cucumber',
  'persian cucumbers':'cucumber',
  // Round 29 backfill — single-recipe long tail
  'canned garbanzo beans':'chickpeas', 'garbanzo beans':'chickpeas',
  'roasted salted pepitas':'pumpkin seeds', 'salted pepitas':'pumpkin seeds',
  'canned green chilis':'green chiles', 'canned green chilies':'green chiles',
  'green chilis':'green chiles',
  'delallo cavatappi pasta':'cavatappi', 'cavatappi pasta':'cavatappi',
  'delallo castelvetrano olives':'castelvetrano olives',
  'pitted castelvetrano olives':'castelvetrano olives',
  'overnight jasmine rice':'jasmine rice',
  'thick asparagus spears':'asparagus', 'asparagus spears':'asparagus',
  'chiffonade basil':'basil',
  'shelled salted pistachios':'pistachios', 'shelled pistachios':'pistachios',
  'roasted beets':'beets', 'roasted beet':'beets',
  'diy curry powder':'curry powder',
  'tostadas':'tortilla chips', 'tostada chips':'tortilla chips',
  'boneless center cut pork tenderloin':'pork tenderloin',
  'pork tenderloin strips':'pork tenderloin',
  'persian cucumbers':'cucumber',
  'long wide pasta noodles':'pasta', 'wide pasta noodles':'pasta',
  '-ingredient mediterranean salad':'mediterranean salad',
  '6-ounce cod fish fillets':'cod fillet', 'cod fish fillets':'cod fillet',
  'cod fillets':'cod fillet',
  'sea salt':'salt', 'flaky sea salt':'salt', 'kosher sea salt':'salt',
  // (round 71 aliases havarti → havarti dill cheese)
  'honeynut squash':'butternut squash',
  'arrowroot powder':'arrowroot',
  'leafy parsley':'parsley',
  // Round 28 backfill
  'half & half':'half-and-half', 'half &amp; half':'half-and-half',
  'natural yoghurt':'yogurt', 'natural yogurt':'yogurt', 'yoghurt':'yogurt',
  'greek yoghurt':'greek yogurt', 'plain greek yoghurt':'plain greek yogurt',
  '0% fat greek yoghurt':'fat free greek yogurt', '0% greek yoghurt':'fat free greek yogurt',
  // Round 38: removed '90% lean ground beef' → 'ground beef' aliases
  // (user prefers '<N>% lean ground X' form preserved; nutrition lookup falls back via FORM_MODIFIERS_NUTRITION strip)
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
    // Skip "For the X:" / "For X:" recipe-section headers (with or without colon)
    if (/^for\s+(?:the\s+)?[\w\s-]+:?\s*\*?$/i.test(trimmed) && !/\d/.test(trimmed) && trimmed.length < 40) {
      return { qty: 0, unit: '', name: '', category: 'pantry-staples', raw, note };
    }
    // Skip "freezer bag", "mortar and pestle", and other equipment lines
    if (/^(?:large\s+|small\s+|medium\s+)?(?:freezer\s+bag|mortar\s+and\s+pestle|spice\s+mill|skewers?)\b/i.test(trimmed)) {
      return { qty: 0, unit: '', name: '', category: 'pantry-staples', raw, note };
    }
    // Skip vague placeholders that point to other recipes
    if (/^(?:house\s+salad|side\s+salad|simple\s+salad)\b/i.test(trimmed) && trimmed.length < 40) {
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
    // Entity decode FIRST so semicolons in entities aren't broken by later strips
    .replace(/&frac14;/g, '¼').replace(/&frac12;/g, '½').replace(/&frac34;/g, '¾')
    .replace(/&#8531;/g, '⅓').replace(/&#8532;/g, '⅔')
    .replace(/&#8533;/g, '⅕').replace(/&#8537;/g, '⅙').replace(/&#8539;/g, '⅛')
    .replace(/&#(?:8211|8212);/g, '-')
    .replace(/&#(?:8216|8217|39);/g, "'")
    .replace(/&#(?:8220|8221);/g, '"')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/\bhandfull\b/gi, 'handful')        // common typo
    .replace(/\bhandfulls\b/gi, 'handfuls')
    // "&quot;" → '"' (more entities)
    .replace(/&quot;?/g, '"')
    // ", plus N <unit>" → " + N <unit>" so the plus-split rule fires later
    // ("4 tablespoons, plus 1/3 cup extra virgin olive oil" → "4 tablespoons + 1/3 cup ...")
    .replace(/,\s*plus\s+(\d+(?:\s+\d+\/\d+)?(?:\.\d+)?|\d+\/\d+|[¼-¾⅐-⅞])\s+(cups?|tbsps?|tablespoons?|tsps?|teaspoons?|oz|ounces?|lbs?|pounds?)/gi, ' + $1 $2')
    // "1 + 1/2" / "1+1/2" / "1 + ½" mixed-number with + → "1 1/2"
    .replace(/(\d)\s*\+\s*(\d+\/\d+)/g, '$1 $2')
    .replace(/(\d)\s*\+\s*([¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g, '$1 $2')
    // Leading "+" (e.g. "+2 tsp milk" — recipe author's continuation marker) — strip
    .replace(/^\s*\+\s*/, '')
    // "X to Y" leading range — convert to "X-Y" so range-parser handles it
    //   "1 to 1.25 lbs" → "1-1.25 lbs"
    //   "1 to 2 cups" → "1-2 cups"
    .replace(/^(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)(\s)/i, '$1-$2$3')
    // Leading ".25" or "1/4." (stray dot after fraction) — normalize
    .replace(/^\.(\d)/, '0.$1')
    .replace(/(\d+\/\d+)\./g, '$1')
    // "(N-inch) piece <noun>" / "<N>-inch piece <noun>" → set up for inch-as-unit
    // Pre-rewrites to "<N> inch <noun>" so qty extraction grabs N inches.
    //   "1 (2-inch) piece ginger" → "1 2 inch ginger" → qty=2 unit=inch name=ginger
    //   "1 (4-inch) piece fresh ginger" → similar
    .replace(/^\s*\d+\s*\(\s*(\d+(?:\.\d+)?)\s*-?\s*inch\s*\)\s*(?:piece|knob)\s+/i, '$1 inch ')
    .replace(/^\s*\d+\s*[-–]\s*inch\s+(?:piece|knob)\s+/i, (m) => {
      const num = m.match(/^\s*(\d+)/)?.[1] || '1';
      return `${num} inch `;
    })
    // "finely-chopped" / "coarsely-chopped" / "thinly-sliced" → un-hyphenate so
    // the prep-word strip loop catches "chopped"/"sliced" and the orphan-thinly
    // strip catches "finely"/"thinly".
    .replace(/\b(finely|coarsely|roughly|thinly|thickly|freshly)-(chopped|sliced|grated|diced|minced|crushed|cut|cracked|ground)\b/gi, '$1 $2')
    // "<N> thin slices of <X>" → "<N> slices <X>" (drop "thin", keep slice count)
    .replace(/\b(\d+)\s+thin\s+slices?\s+(?:of\s+)?/gi, '$1 slices ')
    // "<N>-Ingredient X" recipe-title prefix — strip leading "<N>-Ingredient "
    .replace(/^\d+\s*[-–—]\s*ingredient\s+/i, '')
    // Cost annotation "$X.XX" — strip
    .replace(/\$\s*\d+(?:\.\d+)?/g, '')
    // ", washed" / ", washed and X" trailing produce-prep — strip
    .replace(/,\s*washed(?:\s+and\s+\w+)?\s*$/i, '')
    // Semicolon list: drop everything from ";" onward (entities decoded above)
    .replace(/;[^]*$/, '')
    // Normalize fat-percent prefix forms (user prefers '85% lean ground X' form):
    //   "85/15 ground turkey"  → "85% lean ground turkey"
    //   "93% ground chicken"   → "93% lean ground chicken"
    //   "85% lean ground beef" → unchanged (already canonical)
    .replace(/\b(\d+)\/\d+\s+ground\s+/gi, '$1% lean ground ')
    .replace(/\b(\d+)%\s+ground\s+/gi, (m, n) => `${n}% lean ground `)
    .replace(/\b(\d+)%\s+lean\s+lean\s+/gi, '$1% lean ')
    // "1/3 less fat" → "reduced-fat"
    .replace(/\b1\/3\s+less\s+fat\b/gi, 'reduced-fat')
    // "a few" / "few" as a count → 2 (matches user spec for sprigs/etc.)
    .replace(/^a\s+few\s+/i, '2 ')
    .replace(/^few\s+/i, '2 ')
    // Pre-insert a space between letter+digit when smushed (recipe authors
    // sometimes paste "2 eggs2-3 garlic" with no space). Decode HTML fraction
    // entities first so &frac14;/&frac12; aren't split into "frac 14" / "frac 12".
    .replace(/&frac14;/g, '¼').replace(/&frac12;/g, '½').replace(/&frac34;/g, '¾')
    .replace(/&#8531;/g, '⅓').replace(/&#8532;/g, '⅔')
    .replace(/&#8533;/g, '⅕').replace(/&#8537;/g, '⅙').replace(/&#8539;/g, '⅛')
    .replace(/&#(?:8211|8212);/g, '-')
    .replace(/&#(?:8216|8217|39);/g, "'")
    .replace(/&#(?:8220|8221);/g, '"')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
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
    // 'fat free' kept as two words — nutrition DB has 'fat free greek yogurt' with space
    .replace(/\bred[\s-]+pepper(\s+flakes?)\b/gi, 'red pepper$1')  // "red-pepper" → "red pepper"
    .replace(/\bblack[\s-]+pepper\b/gi, 'black pepper')
    .replace(/\bwhite[\s-]+pepper\b/gi, 'white pepper')
    // Fix "1/ 4" → "1/4" (stray space inside fraction)
    .replace(/(\d)\/\s+(\d)/g, '$1/$2')
    .replace(/(\d)\s+\/(\d)/g, '$1/$2')
    // "1 and 1/2" / "1 & 1/2" → "1 1/2" (drop conjunction inside mixed numbers)
    .replace(/(\d)\s+(?:and|&)\s+(\d+\/\d+)/g, '$1 $2')
    // "X oz/Y g" or "X oz / Y g" — drop the metric equivalent after slash
    //   "7oz/200g broccolini" → "7oz broccolini"
    //   "3.5oz/100g creamy blue cheese" → "3.5oz creamy blue cheese"
    .replace(/(\d+(?:\.\d+)?\s*(?:oz|ounce|lb|pound)s?)\s*\/\s*\d+(?:\.\d+)?\s*(?:g|gram|kg)s?\b/gi, '$1')
    // Same in reverse: "200g/7oz" → drop the gram form, keep oz
    .replace(/\d+(?:\.\d+)?\s*(?:g|gram|kg)s?\s*\/\s*(\d+(?:\.\d+)?\s*(?:oz|ounce|lb|pound)s?)\b/gi, '$1')
    // "X cup/tbsp/tsp / Y g/ml" — keep imperial, drop metric half
    //   "1 1/4 cups / 180g bacon" → "1 1/4 cups bacon"
    //   "2 tbsp / 30 ml avocado oil" → "2 tbsp avocado oil"
    //   "4 cups / 480 g frozen riced cauliflower" → "4 cups frozen riced cauliflower"
    //   "1/4 cup/1 ounce crumbled feta cheese" → "1/4 cup crumbled feta cheese"
    .replace(/((?:\d+(?:\s+\d+\/\d+)?|\d+\/\d+|\d+(?:\.\d+)?)\s*(?:cups?|tbsps?|tablespoons?|tsps?|teaspoons?))\s*\/\s*\d+(?:\.\d+)?\s*(?:g|grams?|kg|ml|l|oz|ounces?)\.?\s+/gi, '$1 ')
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
  // "X-ounce can/jar/bag/box <noun>" leading prefix — strip the size+container so
  // the noun is what gets matched. The container+oz transform later still fires
  // on the qty extracted upstream.
  //   "(10-oz.) bag frozen sweet peas" → "frozen sweet peas"
  //   "14-ounce cans coconut milk" → "coconut milk"
  str = str.replace(/^\(?\s*\d+(?:\.\d+)?[\s-]*(?:oz|ounce|ounces?)\.?\s*\)?\s*(?:can|cans|jar|jars|bag|bags|box|boxes|package|packages|pkg|tin|tins|bottle|bottles)\s+/i, '');
  // "into bite sized X" / "into bite-sized X" / "into X pieces" trailing — strip
  str = str.replace(/\s+(?:cut\s+)?into\s+bite[\s-]*siz(?:e|ed)\s+\w+\s*$/i, '').trim();
  // ", taste and adjust X" / "(taste and adjust X)" — recipe-author note
  str = str.replace(/,?\s*\(?\s*taste\s+(?:and\s+)?adjust\b[^)]*\)?\s*$/i, '').trim();
  // "swish of X" / "sprinkle of X" / "drizzle of X" / "lil <X>" — vague qty markers
  str = str.replace(/^(?:just\s+)?a?\s*(?:swish|sprinkle|drizzle|lil|little|tiny\s+bit|small\s+amount)\s+of\s+/i, '').trim();
  str = str.replace(/^just\s+a?\s*lil\s+/i, '').trim();
  str = str.replace(/^just\s+a?\s*little\s+/i, '').trim();
  // ", like X" trailing recipe-author preference (e.g. ", like Sauvignon Blanc")
  str = str.replace(/,\s*like\s+[a-z][^,]*(?:,[^,]*)*$/i, '').trim();
  // Orphan "thinly" / "thickly" not followed by sliced/cut/diced (the prep word
  // got stripped earlier, leaving the adverb dangling) — strip.
  str = str.replace(/\b(thinly|thickly)\s+(?!sliced|cut|diced|chopped|grated|shaved)/gi, '').trim();
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
  // Strip parens whose content is only prep instructions (washed/scrubbed/dried/etc.)
  //   "(washed, dried, and sliced thin)" → strip
  //   "(scrubbed, dried, and sliced into 1/8 inch thick coins)" → strip
  //   "(peeled and cut into cubes)" → strip
  str = str.replace(
    /\(\s*(?:washed|scrubbed|dried|peeled|cleaned|trimmed|patted|rinsed|husked|shucked|seeded|cored|stemmed|deveined|cut|chopped|sliced|diced|minced|grated|smashed|pressed|halved|quartered|cubed|julienned|torn|crumbled|crushed|drained)[^)]*\)/gi,
    ''
  ).trim();
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
  // Orphan "thinly" / "thickly" — after PREP_WORDS_SINGLE stripped "sliced"/"cut"/etc.,
  // the adverb is left dangling without a verb. Strip it.
  str = str.replace(/\b(?:thinly|thickly)\s+/gi, '').trim();
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
      /\b(?:can|jar|tin|block|blocks|box|package|pkg|bag|pack|bottle|bunch|head)s?\b/i.test(name) ||
      // No container word but has (N-oz/lb) paren prefix immediately before a piece-word noun
      // (fillet/breast/thigh/etc.) — recipe author's per-piece weight spec. Allow 0-3 intermediate words.
      /^\s*\(\s*\d+(?:\.\d+)?(?:\s*[-–]\s*(?:to\s+)?\d+(?:\.\d+)?)?\s*[-\s]?(?:oz|ounce|lb|pound|ounces|pounds)s?\.?\s*\)\s*(?:[\w-]+\s+){0,3}(?:fillet|fillets|filet|filets|breast|breasts|thigh|thighs|chop|chops|steak|steaks|piece|pieces|slice|slices|tail|tails)\b/i.test(name);
    if (isCanContext) {
      // Track the original count before we replace qty (e.g. "2 jars" of 28oz each → ×2)
      const originalCount = qty || 1;

      // Try paren-oz first: "(15-oz.)", "(28-ounce)", "(7 ounce)", "(10-12 oz)" / "(16- to 17-ounce)" (use UPPER bound)
      const ozM = name.match(/\(\s*(\d+(?:\.\d+)?)(?:\s*(?:[-–]|to)\s*(\d+(?:\.\d+)?))?[\s.\-]*(oz|ounce|fl\s*oz|fluid\s+ounce|lb|pound)s?\.?[^)]*\)/i);
      // Convert lb to oz at extraction time so downstream is consistent
      let _lbToOz = false;
      if (ozM && /lb|pound/i.test(ozM[3])) _lbToOz = true;
      // Try paren-ml: "(160ml)", "(160 ml)" — convert to oz (1ml ≈ 0.0338 oz)
      const mlM = !ozM && name.match(/\(?\s*(\d+(?:\.\d+)?)\s*ml\b/i);
      // Try inline-oz: "19 oz tin", "15 ounce can"
      const inlineOzM = !ozM && !mlM && name.match(/\b(\d+(?:\.\d+)?)\s*(?:oz|ounce)s?\b/i);

      if (ozM) {
        // Use UPPER bound when range present (group 2), else single value (group 1).
        // Per Rafi: paren-oz ranges represent the larger packaging size more often
        // than the smaller, so 12 oz from "(10-12 ounces)" is more accurate.
        let ozValue = ozM[2] ? parseFloat(ozM[2]) : parseFloat(ozM[1]);
        if (_lbToOz) ozValue *= 16;  // convert lb → oz
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
        const isBunch   = /\b(?:bunch|head)\b/i.test(name);
        name = name.replace(/^(?:can|jar|tin|block|box|package|pkg|bag|pack|bottle|bunch|head)s?\s+/i, '').trim();
        name = name.replace(/\b(?:can|jar|tin|block|box|package|pkg|bag|pack|bottle|bunch|head)s?\s+(?:or\s+)?(?:of\s+)?/gi, '').trim();
        name = name.replace(/^or\s+/i, '').trim();
        name = name.replace(/^of\s+/i, '').trim();
        name = name.replace(/^,\s*/, '').trim();
        // Note: "in brine"/"in oil"/"in water" trailing PRESERVED — per Rafi these
        // are meaningful product forms (sun-dried tomatoes in oil vs dry-pack,
        // olives in brine, capers in brine, etc.).
        // Add canned/jarred prefix unless coconut milk (always canned), block,
        // or package/box (the form is implied by being shelf-stable in pantry).
        // SKIP when name contains a piece-word noun (fillet/breast/thigh/chop/etc.) —
        // those are protein/seafood per-piece weights, not canned goods.
        const isPieceProtein = /\b(?:fillet|fillets|filet|filets|breast|breasts|thigh|thighs|chop|chops|steak|steaks|tail|tails)\b/i.test(name);
        if (!/coconut\s+milk\b/i.test(name) && !isBlock && !isPackage && !isPieceProtein && !isBunch) {
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
      // Protein cuts (singular when qty=1 lb/oz/each)
      'chicken breast','chicken thigh','chicken leg','chicken wing','chicken drumstick',
      'turkey breast','turkey thigh','boneless skinless chicken breast',
      'boneless skinless chicken thigh','bone-in skin-on chicken breast',
      'bone-in skin-on chicken thigh','salmon fillet','salmon filet',
      'cod fillet','cod filet','halibut fillet','tilapia fillet',
      'pork chop','lamb chop','steak','beef patty',
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

  // Final alias pass — applied AFTER all stop-word strips and singularization
  // since many alias keys only match the fully-normalized name. Also runs on
  // the raw-fallback so whole-line aliases (e.g. "any other seasoning you
  // like (...)") apply when the parser couldn't extract a clean name.
  let finalName = name || raw.toLowerCase();
  if (INGREDIENT_ALIASES[finalName] !== undefined) {
    finalName = INGREDIENT_ALIASES[finalName];
  }

  const category = forcedCategory || categorizeIngredient(finalName || raw);
  return { qty, unit, name: finalName, category, raw, note };
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
