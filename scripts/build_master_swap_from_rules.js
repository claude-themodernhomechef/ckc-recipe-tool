/**
 * build_master_swap_from_rules.js
 *
 * Comprehensively populates ckc-consumer-app/data/masterSwapTable.json from
 * docs/CKC_Diet_Compliance_Rules.md (Parts 4–11). Each rule lives ONCE here;
 * the Cloud Function + app read from the resulting JSON.
 *
 * Merge strategy: deep-merge into existing entries by [ingredient][protocol]
 * so manually-added rules (LF/cream, K/lemon juice, etc.) are preserved.
 *
 * Re-run any time the doc changes.
 */

const fs = require('fs');
const path = require('path');

const PATH = path.join(__dirname, '../ckc-consumer-app/data/masterSwapTable.json');
const table = JSON.parse(fs.readFileSync(PATH, 'utf8'));

// Helper: assign rules for many ingredient aliases at once
function assign(aliases, protocol, rule) {
  for (const name of aliases) {
    const key = name.toLowerCase().trim();
    table[key] = table[key] || {};
    // Don't overwrite existing entries unless they're empty
    if (!table[key][protocol]) table[key][protocol] = rule;
  }
}

// ── LF (Part 4) ──────────────────────────────────────────────────────────────
const garlicInfusedOil = { type: 'replace', to: 'garlic-infused oil' };
assign(['garlic', 'garlic cloves', 'minced garlic', 'crushed garlic', 'fresh garlic', 'whole garlic', 'garlic clove'], 'LF', garlicInfusedOil);

// LF: every onion/shallot variant becomes the same swap — green parts of
// scallions only. Color/form doesn't change the rule.
const scallionGreens = { type: 'replace', to: 'green parts of scallions only' };
assign(['onion', 'yellow onion', 'white onion', 'sweet onion', 'red onion', 'spanish onion', 'vidalia onion', 'pearl onion', 'sliced onion', 'diced onion', 'chopped onion', 'minced onion'], 'LF', scallionGreens);
assign(['shallot', 'shallots', 'sliced shallot', 'minced shallot', 'chopped shallot'], 'LF', scallionGreens);
assign(['leek', 'leeks', 'sliced leek'], 'LF', { type: 'replace', to: 'green tops of leeks only' });
assign(['chives', 'minced chives', 'fresh chives', 'chopped chives'], 'LF', { type: 'replace', to: 'green tops of scallions' });

assign(['fennel', 'fennel bulb', 'sliced fennel'], 'LF', { type: 'remove' });
assign(['corn', 'sweet corn', 'corn kernels', 'fresh corn'], 'LF', { type: 'remove' });
assign(['peanut butter', 'peanuts'], 'LF', { type: 'remove' });
assign(['mushroom', 'mushrooms', 'cremini mushrooms', 'shiitake mushrooms', 'button mushrooms', 'portobello mushrooms', 'baby bella mushrooms'], 'LF', { type: 'remove' });
assign(['black beans', 'kidney beans', 'cannellini beans', 'chickpeas', 'garbanzo beans', 'pinto beans', 'lentils', 'french lentils'], 'LF', { type: 'remove', note: 'remove only when supporting, not starring' });

assign(['greek yogurt', 'plain greek yogurt'], 'LF', { type: 'replace', to: 'lactose-free greek yogurt' });
assign(['sour cream'], 'LF', { type: 'replace', to: 'lactose-free sour cream' });
assign(['balsamic vinegar', 'aged balsamic'], 'LF', { type: 'replace', to: 'tamari + matching broth' });
assign(['honey', 'raw honey'], 'LF', { type: 'note', note: 'reduce to 1 tbsp or replace with maple syrup' });
assign(['flour', 'all-purpose flour', 'ap flour'], 'LF', { type: 'replace', to: 'arrowroot powder or GF 1:1 flour' });

// ── DF (Part 5) ──────────────────────────────────────────────────────────────
const coconutMilkFullFat = { type: 'replace', to: 'full-fat canned coconut milk' };
assign(['heavy cream', 'heavy whipping cream', 'whipping cream', 'double cream'], 'DF', coconutMilkFullFat);
assign(['half-and-half', 'half and half'], 'DF', { type: 'replace', to: 'coconut milk' });
assign(['cream', 'light cream'], 'DF', coconutMilkFullFat);
assign(['milk', 'whole milk', '2% milk', 'skim milk', '1% milk'], 'DF', { type: 'replace', to: 'unsweetened oat milk' });
assign(['buttermilk'], 'DF', { type: 'replace', to: '1 tbsp vinegar + 1/3 cup soy milk (rest 10 min)' });

const coconutYogurt = { type: 'replace', to: 'plain unsweetened coconut yogurt' };
assign(['greek yogurt', 'plain greek yogurt', 'yogurt', 'plain yogurt'], 'DF', coconutYogurt);
assign(['sour cream', 'cream cheese'], 'DF', { type: 'replace', to: 'DF alternative' });

assign(['parmesan', 'parmesan cheese', 'parmigiano', 'pecorino', 'pecorino romano'], 'DF', { type: 'replace', to: 'nutritional yeast + miso (or Follow Your Heart vegan parmesan)' });
assign(['mozzarella', 'mozzarella cheese', 'fresh mozzarella'], 'DF', { type: 'replace', to: 'Kite Hill vegan mozzarella' });
assign(['ricotta', 'ricotta cheese'], 'DF', { type: 'replace', to: 'Kite Hill vegan ricotta' });
assign(['cheddar', 'cheddar cheese', 'sharp cheddar'], 'DF', { type: 'replace', to: 'DF cheddar alternative' });
assign(['feta', 'feta cheese', 'crumbled feta'], 'DF', { type: 'remove', note: 'remove if garnish; use DF feta if core ingredient' });
assign(['cotija', 'cotija cheese'], 'DF', { type: 'remove' });
assign(['blue cheese', 'gorgonzola'], 'DF', { type: 'remove' });
assign(['goat cheese'], 'DF', { type: 'replace', to: 'DF cream cheese' });

assign(['butter', 'salted butter', 'unsalted butter'], 'DF', { type: 'replace', to: 'olive oil (cooking) or DF butter (finishing)' });
assign(['ghee'], 'DF', { type: 'replace', to: 'olive oil' });

// ── GF (Part 6) ──────────────────────────────────────────────────────────────
assign(['all-purpose flour', 'ap flour', 'flour', 'wheat flour'], 'GF', { type: 'replace', to: '1:1 GF flour blend (arrowroot for thin sauces — reduce qty)' });
assign(['breadcrumbs', 'panko', 'panko breadcrumbs', 'italian breadcrumbs'], 'GF', { type: 'replace', to: 'GF panko' });
assign(['pasta', 'spaghetti', 'penne', 'rigatoni', 'fettuccine', 'linguine', 'tagliatelle', 'pappardelle'], 'GF', { type: 'replace', to: 'brown rice pasta' });
assign(['orzo'], 'GF', { type: 'replace', to: 'cassava flour orzo' });
assign(['couscous'], 'GF', { type: 'replace', to: 'GF couscous or cauliflower rice' });
assign(['ramen noodles', 'lo mein noodles', 'egg noodles'], 'GF', { type: 'replace', to: 'brown rice noodles' });
assign(['tortellini'], 'GF', { type: 'replace', to: 'GF tortellini' });
assign(['flour tortillas', 'flour tortilla'], 'GF', { type: 'replace', to: 'corn tortillas or GF wraps' });
assign(['bread', 'crusty bread', 'sandwich bread', 'sourdough', 'baguette'], 'GF', { type: 'replace', to: 'GF bread' });
assign(['burger buns', 'hamburger buns', 'buns', 'brioche buns'], 'GF', { type: 'replace', to: 'GF buns' });
assign(['pita', 'pita bread'], 'GF', { type: 'replace', to: 'GF pita' });
assign(['naan', 'naan bread'], 'GF', { type: 'replace', to: 'GF naan' });
assign(['croutons'], 'GF', { type: 'remove' });
assign(['cornbread mix'], 'GF', { type: 'replace', to: 'GF cornbread mix' });

assign(['soy sauce', 'shoyu', 'light soy sauce', 'dark soy sauce', 'low-sodium soy sauce'], 'GF', { type: 'replace', to: 'tamari' });
assign(['oyster sauce'], 'GF', { type: 'replace', to: 'GF oyster sauce' });
assign(['worcestershire sauce', 'worcestershire'], 'GF', { type: 'replace', to: 'GF Worcestershire sauce' });
assign(['hoisin sauce', 'hoisin'], 'GF', { type: 'replace', to: 'GF hoisin sauce' });

// ── K (Part 7) ───────────────────────────────────────────────────────────────
const cauliflowerRice = { type: 'replace', to: 'cauliflower rice' };
assign(['white rice', 'jasmine rice', 'basmati rice', 'long grain rice', 'short grain rice', 'rice'], 'K', cauliflowerRice);
assign(['brown rice'], 'K', cauliflowerRice);
assign(['couscous'], 'K', cauliflowerRice);
assign(['quinoa'], 'K', { type: 'replace', to: 'cooked vegetables' });
assign(['orzo'], 'K', { type: 'replace', to: 'sauteed cauliflower rice' });
assign(['mashed potatoes', 'potato puree'], 'K', { type: 'replace', to: 'cauliflower mash' });
assign(['sweet potato', 'sweet potatoes'], 'K', { type: 'replace', to: 'cauliflower mash (when mashed) or remove' });
assign(['potato', 'potatoes', 'russet potatoes', 'yukon potatoes', 'baby potatoes'], 'K', { type: 'replace', to: 'roasted cauliflower florets (or remove from stews + 1 tbsp arrowroot)' });
assign(['gnocchi'], 'K', { type: 'replace', to: 'cauliflower gnocchi' });

assign(['shirataki noodles'], 'K', { type: 'keep' });
assign(['pasta', 'spaghetti', 'penne', 'fettuccine', 'linguine'], 'K', { type: 'replace', to: 'spiralized zucchini (light sauce) or keto pasta (heavy)' });
assign(['ramen noodles', 'lo mein noodles'], 'K', { type: 'replace', to: 'shirataki noodles' });

assign(['tortillas', 'corn tortillas', 'flour tortillas'], 'K', { type: 'replace', to: 'keto wraps' });
assign(['burger buns', 'hamburger buns', 'buns'], 'K', { type: 'replace', to: 'iceberg or butter lettuce wraps' });
assign(['burrito wraps'], 'K', { type: 'replace', to: 'GF wraps' });
assign(['tortilla chips'], 'K', { type: 'replace', to: 'keto tortilla chips or remove' });
assign(['naan', 'naan bread'], 'K', { type: 'replace', to: 'cauliflower flatbread' });
assign(['bread', 'crusty bread', 'sandwich bread', 'sourdough', 'baguette', 'toasted bread', 'toasted crusty bread'], 'K', { type: 'remove' });
assign(['bread', 'crusty bread', 'sandwich bread', 'sourdough', 'baguette', 'toasted bread', 'toasted crusty bread'], 'LF', { type: 'replace', to: 'GF or sourdough bread' });

const allulose = { type: 'replace', to: 'allulose liquid sweetener' };
assign(['honey', 'raw honey'], 'K', allulose);
assign(['maple syrup'], 'K', allulose);
assign(['white sugar', 'granulated sugar', 'sugar'], 'K', { type: 'replace', to: 'allulose sweetener' });
assign(['brown sugar'], 'K', { type: 'replace', to: 'allulose sweetener (or trehalose for BBQ caramelization)' });
assign(['apricot preserves', 'jam', 'jelly', 'preserves'], 'K', { type: 'replace', to: 'sugar-free preserves or allulose-sweetened equivalent' });

// Citrus (lemon, lime, orange juice) is K-compliant; no rule needed. The
// validator will drop Claude's bad "replace with broth" outputs since no
// canonical exists, and the protocol gets flagged uncertain for review.
assign(['apple', 'apples'], 'K', { type: 'replace', to: 'fennel (matching texture)' });
assign(['pineapple', 'mango', 'banana'], 'K', { type: 'note', note: 'high-sugar fruit; reduce quantity by half' });

assign(['breadcrumbs', 'panko'], 'K', { type: 'replace', to: 'cauliflower-based panko (breading) or almond flour (binder)' });

// ── AIP (Part 8) ─────────────────────────────────────────────────────────────
const aipRemove = { type: 'remove' };
assign(['black pepper', 'cracked black pepper', 'freshly cracked black pepper', 'ground black pepper'], 'AIP', aipRemove);
assign(['white pepper', 'pepper'], 'AIP', aipRemove);
assign(['cumin', 'ground cumin', 'cumin seeds'], 'AIP', { type: 'replace', to: 'cinnamon or remove' });
assign(['mustard', 'dijon mustard', 'dijon', 'grainy mustard', 'whole grain mustard', 'yellow mustard'], 'AIP', aipRemove);
assign(['mustard seeds'], 'AIP', aipRemove);
assign(['sesame seeds', 'toasted sesame seeds', 'sesame oil', 'toasted sesame oil'], 'AIP', aipRemove);
assign(['sunflower seeds', 'pepitas', 'pumpkin seeds', 'fennel seeds'], 'AIP', aipRemove);

assign(['chili flakes', 'red pepper flakes', 'crushed red pepper'], 'AIP', aipRemove);
assign(['paprika', 'smoked paprika', 'sweet paprika', 'hot paprika'], 'AIP', aipRemove);
assign(['jalapeno', 'serrano', 'poblano', 'habanero'], 'AIP', aipRemove);
assign(['bell pepper', 'bell peppers', 'red bell pepper', 'green bell pepper', 'yellow bell pepper'], 'AIP', aipRemove);
assign(['chili crisp', 'gochujang', 'hot sauce', 'sriracha', 'chipotle'], 'AIP', aipRemove);
assign(['cayenne pepper', 'cayenne'], 'AIP', aipRemove);
assign(['curry powder'], 'AIP', { type: 'replace', to: 'turmeric' });

const coconutAminos = { type: 'replace', to: 'coconut aminos' };
assign(['soy sauce', 'shoyu', 'low-sodium soy sauce', 'light soy sauce', 'dark soy sauce'], 'AIP', coconutAminos);
assign(['tamari'], 'AIP', coconutAminos);
assign(['miso', 'miso paste', 'white miso', 'light miso', 'red miso'], 'AIP', coconutAminos);
assign(['fish sauce'], 'AIP', coconutAminos);

const freshCitrus = { type: 'replace', to: 'fresh citrus juice (lime or lemon)' };
assign(['vinegar', 'white vinegar', 'apple cider vinegar', 'rice vinegar', 'red wine vinegar', 'white wine vinegar', 'sherry vinegar', 'balsamic vinegar'], 'AIP', freshCitrus);
assign(['red wine', 'dry red wine'], 'AIP', { type: 'replace', to: 'beef broth' });
assign(['white wine', 'dry white wine'], 'AIP', { type: 'replace', to: 'chicken broth' });

assign(['brown sugar'], 'AIP', { type: 'replace', to: 'agave' });
assign(['flour', 'cornstarch'], 'AIP', { type: 'replace', to: 'arrowroot powder' });
assign(['almond milk'], 'AIP', { type: 'replace', to: 'rice milk' });
assign(['olives', 'kalamata olives', 'green olives', 'black olives'], 'AIP', aipRemove);
assign(['ketchup'], 'AIP', aipRemove);

// ── LH (Part 10) ─────────────────────────────────────────────────────────────
const lhCitrus = { type: 'replace', to: 'fresh citrus juice (lime or lemon)' };
assign(['vinegar', 'white vinegar', 'apple cider vinegar', 'rice vinegar', 'red wine vinegar', 'white wine vinegar', 'sherry vinegar', 'balsamic vinegar'], 'LH', lhCitrus);
assign(['red wine', 'dry red wine'], 'LH', { type: 'replace', to: 'beef broth' });
assign(['white wine', 'dry white wine'], 'LH', { type: 'replace', to: 'chicken broth' });

assign(['parmesan', 'pecorino', 'aged cheese'], 'LH', { type: 'remove' });
assign(['soy sauce', 'miso'], 'LH', { type: 'replace', to: 'coconut aminos or remove' });
assign(['smoked paprika'], 'LH', { type: 'remove' });
assign(['sour cream'], 'LH', { type: 'remove' });
assign(['avocado', 'avocados'], 'LH', { type: 'replace', to: 'cucumber' });
assign(['black pepper', 'cracked black pepper', 'freshly cracked black pepper'], 'LH', { type: 'remove' });
assign(['chili', 'sriracha', 'chipotle', 'cayenne pepper', 'chili flakes', 'red pepper flakes'], 'LH', { type: 'remove' });
assign(['mustard', 'dijon mustard', 'dijon'], 'LH', { type: 'remove' });
assign(['sumac'], 'LH', { type: 'remove' });
assign(['fennel seeds'], 'LH', { type: 'remove' });
assign(['canola oil', 'vegetable oil'], 'LH', { type: 'replace', to: 'olive oil' });
assign(['tomato paste', 'tomato sauce'], 'LH', { type: 'note', note: 'remove when in large amounts; OK in small quantities' });

// ── V / Vg (Part 9) ──────────────────────────────────────────────────────────
const tofuCubed = { type: 'replace', to: 'extra firm tofu cubed into 1-inch blocks' };
assign(['chicken breast', 'boneless skinless chicken breast', 'chicken breasts'], 'V', tofuCubed);
assign(['chicken thigh', 'chicken thighs', 'boneless chicken thighs', 'bone-in chicken thighs'], 'V', tofuCubed);
assign(['chicken'], 'V', tofuCubed);
assign(['beef', 'steak', 'sirloin', 'ribeye', 'flank steak', 'skirt steak'], 'V', tofuCubed);
assign(['pork', 'pork chops', 'pork tenderloin', 'pork shoulder'], 'V', tofuCubed);
assign(['lamb', 'lamb chops', 'leg of lamb'], 'V', tofuCubed);
assign(['shrimp', 'jumbo shrimp', 'prawns'], 'V', tofuCubed);
assign(['salmon', 'salmon fillet', 'salmon fillets'], 'V', { type: 'replace', to: 'extra firm tofu rectangles (1 lb block cut into 4 thin pieces)' });
assign(['cod', 'halibut', 'tilapia', 'snapper', 'sea bass'], 'V', { type: 'replace', to: 'extra firm tofu rectangles' });
assign(['tuna'], 'V', { type: 'replace', to: 'extra firm tofu' });
assign(['scallops'], 'V', { type: 'replace', to: 'king oyster mushroom slices' });
assign(['bacon', 'pancetta'], 'V', { type: 'replace', to: 'tempeh bacon or smoked tofu' });
assign(['sausage', 'italian sausage', 'chorizo'], 'V', { type: 'replace', to: 'vegan sausage' });
assign(['ground beef', 'ground turkey', 'ground chicken', 'ground pork', 'ground lamb'], 'V', { type: 'replace', to: 'Impossible Beef or 1 lb mushrooms finely chopped' });
assign(['ground meat'], 'V', { type: 'replace', to: 'Impossible Beef or finely chopped mushrooms' });
assign(['anchovy', 'anchovies', 'anchovy paste'], 'V', { type: 'replace', to: '1 tbsp tamari + 1 tbsp capers with juice' });
assign(['fish sauce'], 'V', { type: 'replace', to: 'extra soy sauce' });

const vegBroth = { type: 'replace', to: 'vegetable broth' };
assign(['chicken broth', 'chicken stock', 'chicken bouillon'], 'V', vegBroth);
assign(['beef broth', 'beef stock', 'beef bouillon'], 'V', vegBroth);
assign(['bone broth'], 'V', vegBroth);
assign(['better than bouillon', 'chicken better than bouillon', 'chicken flavor better than bouillon'], 'V', { type: 'replace', to: 'vegetable Better Than Bouillon' });

assign(['honey', 'raw honey'], 'V', { type: 'replace', to: 'agave' });
assign(['gelatin'], 'V', { type: 'replace', to: 'agar agar' });
assign(['buttermilk'], 'V', { type: 'replace', to: '1 tbsp vinegar + 1/3 cup soy milk (rest 10 min)' });
assign(['eggs', 'egg', 'large egg', 'large eggs'], 'V', { type: 'replace', to: 'flax egg (2 tbsp ground flax + 1 tbsp water per egg)' });
assign(['egg white', 'egg whites'], 'V', { type: 'remove' });
assign(['condensed milk', 'sweetened condensed milk'], 'V', { type: 'replace', to: '2 tbsp agave' });

// Vg = vegetarian (allows dairy and eggs, just remove meat/fish)
const vgTofuCubed = { type: 'replace', to: 'extra firm tofu cubed into 1-inch blocks' };
assign(['chicken', 'chicken breast', 'chicken thigh', 'chicken thighs'], 'Vg', vgTofuCubed);
assign(['beef', 'steak', 'ground beef'], 'Vg', vgTofuCubed);
assign(['pork', 'pork chops'], 'Vg', vgTofuCubed);
assign(['lamb'], 'Vg', vgTofuCubed);
assign(['shrimp', 'prawns'], 'Vg', vgTofuCubed);
assign(['salmon', 'cod', 'halibut', 'tuna'], 'Vg', { type: 'replace', to: 'extra firm tofu rectangles' });
assign(['bacon', 'pancetta'], 'Vg', { type: 'replace', to: 'tempeh bacon' });
assign(['anchovy', 'anchovies', 'anchovy paste'], 'Vg', { type: 'replace', to: '1 tbsp tamari + 1 tbsp capers with juice' });
assign(['fish sauce'], 'Vg', { type: 'replace', to: 'extra soy sauce' });
assign(['chicken broth', 'chicken stock'], 'Vg', vegBroth);
assign(['beef broth', 'beef stock'], 'Vg', vegBroth);
assign(['bone broth'], 'Vg', vegBroth);
assign(['better than bouillon', 'chicken better than bouillon', 'chicken flavor better than bouillon'], 'Vg', { type: 'replace', to: 'vegetable Better Than Bouillon' });
assign(['gelatin'], 'Vg', { type: 'replace', to: 'agar agar' });

// ── Sort keys alphabetically + save ──────────────────────────────────────────
const sorted = Object.fromEntries(Object.keys(table).sort().map(k => [k, table[k]]));
fs.writeFileSync(PATH, JSON.stringify(sorted, null, 2));
console.log(`✔ masterSwapTable updated. Total keys: ${Object.keys(sorted).length}`);
