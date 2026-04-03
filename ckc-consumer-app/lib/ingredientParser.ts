/**
 * ingredientParser.ts
 *
 * TypeScript port of the ingredient parsing logic from shopping.html.
 * Pure functions — no React dependencies. Works on both web and native.
 */

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

export interface ParsedIngredient {
  qty: number;
  unit: string;
  name: string;
  category: string;
  raw: string;
}

// ─────────────────────────────────────────────
//  Protein normalization
// ─────────────────────────────────────────────

const PROTEIN_MAP: Record<string, string> = {
  'chicken': 'Chicken',
  'beef': 'Beef', 'steak': 'Beef', 'meat': 'Beef',
  'pork': 'Pork',
  'turkey': 'Turkey',
  'lamb': 'Lamb',
  'fish': 'Fish', 'salmon': 'Fish', 'tuna': 'Fish', 'cod': 'Fish', 'halibut': 'Fish',
  'tilapia': 'Fish', 'trout': 'Fish', 'mahi': 'Fish', 'mahi mahi': 'Fish',
  'swordfish': 'Fish', 'branzino': 'Fish', 'bass': 'Fish', 'snapper': 'Fish',
  'barramundi': 'Fish', 'flounder': 'Fish', 'sole': 'Fish', 'whitefish': 'Fish',
  'white fish': 'Fish', 'mackerel': 'Fish',
  'seafood': 'Seafood', 'shrimp': 'Seafood', 'prawn': 'Seafood', 'prawns': 'Seafood',
  'scallop': 'Seafood', 'scallops': 'Seafood', 'lobster': 'Seafood', 'crab': 'Seafood',
  'mussels': 'Seafood', 'mussel': 'Seafood', 'clam': 'Seafood', 'clams': 'Seafood',
  'oyster': 'Seafood', 'oysters': 'Seafood', 'squid': 'Seafood', 'octopus': 'Seafood',
  'egg': 'Egg', 'eggs': 'Egg',
  'pasta': 'Grain', 'grain': 'Grain', 'grains': 'Grain', 'rice': 'Grain',
  'noodle': 'Grain', 'noodles': 'Grain',
  'vegetable': 'Vegetables', 'vegetables': 'Vegetables', 'veggie': 'Vegetables',
  'veggies': 'Vegetables', 'vegetarian': 'Vegetables', 'vegan': 'Vegetables',
  'salad': 'Vegetables', 'legumes': 'Vegetables',
  'tofu': 'Tofu',
};

export function normalizeProtein(raw: string): string {
  if (!raw) return '';
  const key = raw.trim().toLowerCase();
  return PROTEIN_MAP[key] || (raw.charAt(0).toUpperCase() + raw.slice(1));
}

// ─────────────────────────────────────────────
//  Ingredient DB — category lookup
// ─────────────────────────────────────────────

const INGREDIENT_DB: Record<string, string> = {
  'acini de pepe': 'pantry-consumables',
  'acini de pepe pasta': 'pantry-consumables',
  'all-purpose flour': 'pantry-consumables',
  'anchovy': 'pantry-staples',
  'apple': 'produce',
  'apple butter': 'pantry-staples',
  'apple cider vinegar': 'pantry-staples',
  'arrowroot powder': 'pantry-consumables',
  'asian cucumber': 'produce',
  'asparagus spears': 'produce',
  'avocado': 'produce',
  'avocado oil': 'pantry-staples',
  'baby bok choy': 'produce',
  'baby corn': 'pantry-consumables',
  'bacon': 'protein',
  'baking powder': 'pantry-staples',
  'baking soda': 'pantry-staples',
  'balsamic vinegar': 'pantry-staples',
  'basil': 'produce',
  'basmati rice': 'pantry-consumables',
  'bay leaves': 'pantry-staples',
  'beef': 'protein',
  'beet': 'produce',
  'bell peppers': 'produce',
  'black beans': 'pantry-consumables',
  'black rice': 'pantry-consumables',
  'black sesame seeds': 'pantry-staples',
  'bone-in chicken thigh': 'protein',
  'bone-in pork chops': 'protein',
  'boneless chicken breast': 'protein',
  'boneless chicken thigh': 'protein',
  'broccoli crown': 'produce',
  'broccolini': 'produce',
  'brown rice': 'pantry-consumables',
  'brown sugar': 'pantry-staples',
  'brussels sprouts': 'produce',
  'butter': 'dairy',
  'butternut squash': 'produce',
  'cannellini beans': 'pantry-consumables',
  'capers': 'pantry-staples',
  'cara cara orange': 'produce',
  'carrot': 'produce',
  'carrot tops': 'produce',
  'castelvetrano olives': 'pantry-staples',
  'cauliflower': 'produce',
  'cayenne': 'pantry-staples',
  'cayenne pepper': 'pantry-staples',
  'celery bunch': 'produce',
  'celery ribs': 'produce',
  'celery root': 'produce',
  'cheddar cheese': 'dairy',
  'cherry tomatoes': 'produce',
  'chicken bone broth': 'pantry-consumables',
  'chicken broth': 'pantry-consumables',
  'chickpeas': 'pantry-consumables',
  'chickpeas/garbanzo beans': 'pantry-consumables',
  'chili powder': 'pantry-staples',
  'chipotle pepper in adobo': 'pantry-staples',
  'chipotle powder': 'pantry-staples',
  'chuck roast': 'protein',
  'cilantro': 'produce',
  'cinnamon': 'pantry-staples',
  'coconut milk': 'pantry-consumables',
  'cod filets': 'protein',
  'corn': 'produce',
  'corn kernel': 'produce',
  'corn tortilla': 'pantry-consumables',
  'cornstarch': 'pantry-consumables',
  'cotija cheese': 'dairy',
  'cream cheese': 'dairy',
  'crema': 'dairy',
  'crème fraîche': 'dairy',
  'crushed tomatoes': 'pantry-consumables',
  'curry powder': 'pantry-staples',
  'diced green chilies': 'pantry-consumables',
  'dijon': 'pantry-staples',
  'dried cranberries': 'pantry-staples',
  'dried oregano': 'pantry-staples',
  'dried pinto beans': 'pantry-consumables',
  'dried rosemary': 'pantry-staples',
  'dried thyme': 'pantry-staples',
  'edamame': 'produce',
  'eggs': 'dairy',
  'enchilada sauce': 'pantry-staples',
  'extra virgin olive oil': 'pantry-staples',
  'fennel bulbs': 'produce',
  'fennel seeds': 'pantry-staples',
  'feta cheese': 'dairy',
  'fig jam': 'pantry-staples',
  'fire-roasted diced tomatoes': 'pantry-consumables',
  'fish sauce': 'pantry-staples',
  'flaky salt': 'pantry-staples',
  'flank steak': 'protein',
  'flour': 'pantry-consumables',
  'fresh basil': 'produce',
  'fresh cilantro': 'produce',
  'fresh dill': 'produce',
  'fresh ginger': 'produce',
  'fresh grapefruit': 'produce',
  'fresh mint': 'produce',
  'fresh orange juice': 'pantry-staples',
  'fresh oregano': 'produce',
  'fresh parsley': 'produce',
  'fresh rosemary': 'produce',
  'fresh sage': 'produce',
  'fresh spinach': 'produce',
  'fresh thyme': 'produce',
  'frozen peas': 'frozen',
  'fuji apple': 'produce',
  'garlic clove': 'produce',
  'garlic cloves': 'produce',
  'garlic head': 'produce',
  'garlic powder': 'pantry-staples',
  'ginger': 'pantry-staples',
  'gnocchi': 'pantry-consumables',
  'grainy mustard': 'pantry-staples',
  'grated parmesan': 'dairy',
  'green onion': 'produce',
  'ground beef (85% lean)': 'protein',
  'ground beef (90% lean)': 'protein',
  'ground black pepper': 'pantry-staples',
  'ground chicken': 'protein',
  'ground cinnamon': 'pantry-staples',
  'ground coriander': 'pantry-staples',
  'ground cumin': 'pantry-staples',
  'ground flaxseed': 'pantry-staples',
  'ground ginger': 'pantry-staples',
  'ground lamb': 'protein',
  'ground nutmeg': 'pantry-staples',
  'ground pork': 'protein',
  'ground turkey': 'protein',
  'ground turmeric': 'pantry-staples',
  'gruyere': 'dairy',
  'half and half': 'dairy',
  'halibut filet': 'protein',
  'hanger steak': 'protein',
  'harissa': 'pantry-staples',
  'hazelnuts': 'pantry-staples',
  'heavy cream': 'dairy',
  'hoisin sauce': 'pantry-staples',
  'honey': 'pantry-staples',
  'honey crisp apple': 'produce',
  'iceberg': 'produce',
  'italian bread crumbs': 'pantry-consumables',
  'italian herb seasoning': 'pantry-staples',
  'italian sausage': 'protein',
  'jalapeños': 'produce',
  'jalapeño': 'produce',
  'kabocha squash': 'produce',
  'kale': 'produce',
  'kiwi': 'produce',
  'kosher salt': 'pantry-staples',
  'leafy greens': 'produce',
  'leeks': 'produce',
  'lemon': 'produce',
  'lemon juice': 'produce',
  'lemon zest & juice': 'pantry-staples',
  'lemongrass stalk': 'produce',
  'lentils': 'pantry-consumables',
  'light coconut milk': 'pantry-consumables',
  'lime': 'produce',
  'liquid smoke': 'pantry-staples',
  'long-grain white rice': 'pantry-consumables',
  'macadamia nuts': 'pantry-staples',
  'madras curry powder': 'pantry-staples',
  'mango': 'produce',
  'maple syrup': 'pantry-staples',
  'mayonnaise': 'pantry-staples',
  'mexican beer': 'pantry-staples',
  'mexican cheese': 'dairy',
  'microgreens': 'produce',
  'mini bell peppers': 'produce',
  'mushrooms': 'produce',
  'navel orange': 'produce',
  'navy beans': 'pantry-consumables',
  'new york strip': 'protein',
  'nori sheets': 'pantry-consumables',
  'nutmeg': 'pantry-staples',
  'nutritional yeast': 'pantry-staples',
  'oil-packed sun-dried tomatoes': 'pantry-staples',
  'onion powder': 'pantry-staples',
  'orecchiette pasta': 'pantry-consumables',
  'oregano': 'pantry-staples',
  'oyster mushrooms': 'produce',
  'panko': 'pantry-consumables',
  'paprika': 'pantry-staples',
  'parmesan': 'dairy',
  'parmigiano reggiano': 'dairy',
  'peaches': 'pantry-consumables',
  'peanut butter': 'pantry-staples',
  'pearl couscous': 'pantry-consumables',
  'peas': 'produce',
  'peperoncini': 'pantry-staples',
  'pepperoncini': 'pantry-staples',
  'persian cucumber': 'produce',
  'pickled ginger': 'pantry-staples',
  'pickled jalapeno': 'pantry-staples',
  'pickled onion': 'pantry-staples',
  'pickles': 'pantry-staples',
  'pineapple': 'produce',
  'pinto beans': 'pantry-consumables',
  'pita breads': 'pantry-consumables',
  'plain greek yogurt': 'dairy',
  'poblano chili': 'pantry-staples',
  'poblano pepper': 'produce',
  'polenta': 'pantry-consumables',
  'pomegranate juice': 'pantry-staples',
  'pomegranate molasses': 'pantry-staples',
  'pomegranate seeds': 'produce',
  'potato': 'produce',
  'pumpkin beer': 'pantry-staples',
  'quinoa': 'pantry-consumables',
  'radishes': 'produce',
  'raw cashews': 'pantry-staples',
  'red bell pepper': 'produce',
  'red cabbage': 'produce',
  'red chili flakes': 'pantry-staples',
  'red chillies': 'produce',
  'red enchilada sauce': 'pantry-staples',
  'red onion': 'produce',
  'red wine vinegar': 'pantry-staples',
  'rice': 'pantry-consumables',
  'rice vinegar': 'pantry-staples',
  'roasted beet': 'produce',
  'roma tomatoes': 'produce',
  'romaine lettuce': 'produce',
  'salmon filet': 'protein',
  'salsa verde': 'pantry-staples',
  'salted butter': 'dairy',
  'sambal oelek': 'pantry-staples',
  'scallions': 'produce',
  'sea salt': 'pantry-staples',
  'serrano pepper': 'produce',
  'sesame oil': 'pantry-staples',
  'shallot': 'produce',
  'short cut pasta': 'pantry-consumables',
  'shredded cheddar cheese': 'dairy',
  'shredded pepper jack cheese': 'dairy',
  'shredded sharp cheddar': 'dairy',
  'sliced almonds': 'pantry-staples',
  'smoked paprika': 'pantry-staples',
  'sour cream': 'dairy',
  'soy milk': 'pantry-consumables',
  'soy sauce': 'pantry-staples',
  'spinach': 'produce',
  'sriracha': 'pantry-staples',
  'sticks celery': 'produce',
  'sugar': 'pantry-staples',
  'sugar snap peas': 'produce',
  'sumac': 'pantry-staples',
  'sushi rice': 'pantry-consumables',
  'sweet potato': 'produce',
  'swiss chard': 'produce',
  'taco shells': 'pantry-consumables',
  'tahini': 'pantry-staples',
  'tamari': 'pantry-staples',
  'tarragon': 'produce',
  'thai red curry paste': 'pantry-staples',
  'toasted sesame oil': 'pantry-staples',
  'toasted sesame seeds': 'pantry-staples',
  'tofu': 'protein',
  'tomatillos': 'produce',
  'tomato paste': 'pantry-staples',
  'tomato puree': 'pantry-consumables',
  'tomatoes': 'produce',
  'tortilla': 'pantry-consumables',
  'turmeric': 'pantry-staples',
  'tzatziki sauce': 'dairy',
  'unsalted butter': 'dairy',
  'unsweetened non-dairy creamer': 'pantry-consumables',
  'vegan mayo': 'pantry-staples',
  'vegetable oil': 'pantry-staples',
  'vegetable stock': 'pantry-consumables',
  'vine tomatoes': 'produce',
  'water chestnuts': 'pantry-consumables',
  'white cheddar': 'dairy',
  'white miso': 'pantry-staples',
  'white onion': 'produce',
  'white rice': 'pantry-consumables',
  'white wine': 'pantry-staples',
  'white wine vinegar': 'pantry-staples',
  'whole grain bread': 'pantry-consumables',
  'whole milk': 'dairy',
  'whole wheat elbows or shells': 'pantry-consumables',
  'worcestershire sauce': 'pantry-staples',
  'yellow bell pepper': 'produce',
  'yellow onion': 'produce',
  'yellow peach': 'produce',
  'yogurt': 'dairy',
  'zucchini': 'produce',
  'all-spice': 'pantry-staples',
  'tequila': 'pantry-staples',
  'marinara sauce': 'pantry-staples',
  'dried basil': 'pantry-staples',
  'lasagna noodles': 'pantry-consumables',
  'ricotta cheese': 'dairy',
  'shredded mozzarella': 'dairy',
  'beef tenderloin': 'protein',
  'green apple': 'produce',
  'dried shiitake mushrooms': 'pantry-consumables',
  'bean sprouts': 'produce',
  'gochujang paste': 'pantry-staples',
  'mirin': 'pantry-staples',
  'garam masala': 'pantry-staples',
  'full-fat coconut milk': 'pantry-consumables',
  'naan bread': 'pantry-consumables',
  'purple sweet potatoes': 'produce',
  'canned pinto beans': 'pantry-consumables',
  'white sugar': 'pantry-staples',
  'fresh red fresno': 'produce',
  'rice wine vinegar': 'pantry-staples',
  'limes': 'produce',
  'clementines': 'produce',
  'saffron threads': 'pantry-staples',
  'dried barberries': 'pantry-staples',
  'fresh tarragon': 'produce',
  'shelled pistachios': 'pantry-staples',
  'cumin seeds': 'pantry-staples',
  'coriander seeds': 'pantry-staples',
  'pork baby back ribs': 'protein',
  'granny smith apple': 'produce',
  'cheese tortellini': 'pantry-consumables',
  'lamb shanks': 'protein',
  'ground allspice': 'pantry-staples',
  'beef broth': 'pantry-consumables',
  'pomegranate arils': 'produce',
  'yukon gold potato': 'produce',
  'salt': 'pantry-staples',
  'eggplant': 'produce',
  'golden raisin': 'pantry-staples',
  'spaghetti squash': 'produce',
  'wild mushrooms': 'produce',
  'ground polenta': 'pantry-consumables',
  'beef tenderloin filet': 'protein',
  'chicken or vegetable broth': 'pantry-consumables',
  'milk': 'dairy',
  'cooked bacon': 'protein',
  'fresh cauliflower rice': 'produce',
  'walnut halves': 'pantry-staples',
  'pumpkin puree': 'pantry-consumables',
  'green beans': 'produce',
  'bone-in, english-style beef short ribs': 'protein',
  'whole peeled italian tomatoes': 'pantry-consumables',
  'spaghetti pasta': 'pantry-consumables',
  'crushed fire-roasted tomatoes': 'pantry-consumables',
  'shredded cooked chicken': 'protein',
  'english cucumber': 'produce',
  'dry red wine': 'pantry-staples',
  'orzo': 'pantry-consumables',
  'golden balsamic vinegar': 'pantry-staples',
  'butter lettuce': 'produce',
  'almond flour': 'pantry-consumables',
  'seafood seasoning': 'pantry-staples',
  'coconut aminos': 'pantry-staples',
  'cholula hot sauce': 'pantry-staples',
  'sweet potatoes': 'produce',
  'tomato sauce': 'pantry-staples',
  'shredded monterey jack cheese': 'dairy',
  'cooked white rice': 'pantry-consumables',
  'broccoli florets': 'produce',
  'shredded cabbage': 'produce',
  'julienned carrots': 'produce',
  'snow peas': 'produce',
  'pork shoulder roast': 'protein',
  'apple cider': 'pantry-staples',
  'dehydrated minced onion': 'pantry-staples',
  'fresh chives': 'produce',
  'lacinato kale': 'produce',
  'radicchio': 'produce',
  'hot sauce': 'pantry-staples',
  'chipotle chili powder': 'pantry-staples',
  'cooked rice': 'pantry-consumables',
  'whole chicken': 'protein',
  'white vinegar': 'pantry-staples',
  'baby arugula': 'produce',
  'blue cheese': 'dairy',
  "za'atar": 'pantry-staples',
  'bone-in lamb leg': 'protein',
  'slivered almonds': 'pantry-staples',
  'dried raisins': 'pantry-staples',
  'dried apricots': 'pantry-staples',
  'ground cardamom': 'pantry-staples',
  'whole grain elbow pasta': 'pantry-consumables',
  'parmesan cheese rind': 'dairy',
  'orange zest & juice': 'produce',
  'jarred roasted red bell pepper': 'pantry-consumables',
  'green bell pepper': 'produce',
  'canned green chilis': 'pantry-consumables',
  'purple cabbage': 'produce',
  'green cabbage': 'produce',
  'extra firm tofu': 'protein',
  'uncooked black rice': 'pantry-consumables',
  'snap peas': 'produce',
  'fresh sunflower sprouts': 'produce',
  'frozen english peas': 'frozen',
  'kashmiri red chili powder': 'pantry-staples',
  'kasuri methi': 'pantry-staples',
  'raw peeled deveined shrimp': 'protein',
  'raw scallops': 'protein',
  'thick loaf of bread': 'pantry-consumables',
  'green pitted olives': 'pantry-staples',
  'ketchup': 'pantry-staples',
  'mustard powder': 'pantry-staples',
  'cremini mushrooms': 'produce',
  'beef boullion': 'pantry-staples',
  'bone-in chicken breast': 'protein',
  'canned hominy': 'pantry-consumables',
  'tortilla chips': 'pantry-consumables',
  'shiitake mushrooms': 'produce',
  'red swiss chard': 'produce',
  'green swiss chard': 'produce',
  'escarole': 'produce',
  'ras el hanout': 'pantry-staples',
  'preserved lemon': 'pantry-staples',
  'boneless pork shoulder roast': 'protein',
  'agave nectar': 'pantry-staples',
  'shredded lettuce': 'produce',
  'egg white': 'dairy',
  'mixed sesame seeds': 'pantry-staples',
  'chili sauce': 'pantry-staples',
  'queso fresco': 'dairy',
  'achiote paste': 'pantry-staples',
  'ancho chili powder': 'pantry-staples',
  'russet potato': 'produce',
  'clam juice': 'pantry-staples',
  'canned chopped clams': 'pantry-consumables',
  'ground veal': 'protein',
  'white bread': 'pantry-consumables',
  'chianti red wine': 'pantry-staples',
  'anchovy paste': 'pantry-staples',
  'bouillon cube': 'pantry-staples',
  'aleppo pepper': 'pantry-staples',
  'yellow mustard seeds': 'pantry-staples',
  'medjool dates': 'pantry-staples',
  'cauliflower florets': 'produce',
  'sharp white cheddar': 'dairy',
  'molasses': 'pantry-staples',
  'ground mustard': 'pantry-staples',
  'coleslaw mix': 'produce',
  'thai basil leaves': 'produce',
  'sundried tomatoes': 'pantry-staples',
  'fresh mozzarella': 'dairy',
  'provolone cheese': 'dairy',
  'smoked ham bone': 'protein',
  'dried white beans': 'pantry-consumables',
  'pecorino romano': 'dairy',
  'boneless beef chuck roast': 'protein',
  'white sweet potatoes': 'produce',
  'unsweetened almond milk': 'pantry-consumables',
  'fat free cream cheese': 'dairy',
  'baby gold potatoes': 'produce',
  'rice flour': 'pantry-consumables',
  'wild rice blend': 'pantry-consumables',
  'canned chunk chicken breast': 'pantry-consumables',
  'cream of chicken soup': 'pantry-consumables',
  'frozen peas and carrots': 'frozen',
  'egg noodles': 'pantry-consumables',
  'beef shanks': 'protein',
  'fine ground cornmeal': 'pantry-consumables',
  'kecap manis': 'pantry-staples',
  'boiled eggs': 'dairy',
  'prawn crackers': 'pantry-consumables',
  'vegetable or peanut oil': 'pantry-staples',
  'tempeh': 'protein',
  'peanuts': 'pantry-staples',
  'red chilli': 'produce',
  'champagne vinegar': 'pantry-staples',
  'avocados': 'produce',
  'bread crumbs': 'pantry-consumables',
  'ground cardamon': 'pantry-staples',
  'hummus': 'pantry-staples',
  'garlic sauce': 'dairy',
  'chicken drumsticks': 'protein',
  'white mushrooms': 'produce',
  'buttermilk': 'dairy',
  'dried parsley': 'pantry-staples',
  'frozen peas & carrots': 'frozen',
  'frozen corn kernels': 'frozen',
  'tapioca starch': 'pantry-consumables',
  'unsweetened shredded coconut': 'pantry-staples',
  'peeled and deveined shrimp': 'protein',
  'bottom round roast': 'protein',
  'belgian style ale': 'pantry-staples',
  'pumpkin seeds': 'pantry-staples',
  'canned cannellini beans': 'pantry-consumables',
  'paccheri': 'pantry-consumables',
  'vegan yogurt': 'dairy',
  'cottage cheese': 'dairy',
  'shredded mozzarella cheese': 'dairy',
  'sweet thai chili sauce': 'pantry-staples',
  'apple juice': 'pantry-staples',
  'creamy peanut butter': 'pantry-staples',
  'coconut sugar': 'pantry-staples',
  'baby eggplants': 'produce',
  'thai glutinous rice': 'pantry-consumables',
  'mexican oregano': 'pantry-staples',
  'plantain chips': 'pantry-consumables',
  'ground cloves': 'pantry-staples',
  'instant yeast': 'pantry-staples',
  'pitted and halved kalamata olives': 'pantry-staples',
  'bone-in lamb shoulder bone-in': 'protein',
  'roasted pistachios': 'pantry-staples',
  'sundried tomatoes in oil': 'pantry-staples',
  'hard shell tacos': 'pantry-consumables',
  'chopped pancetta': 'protein',
  'anchovy fillets': 'pantry-staples',
  'canned whole tomatoes': 'pantry-consumables',
  'bocconcini': 'dairy',
  'canned black beans': 'pantry-consumables',
  'oat flour': 'pantry-consumables',
  'barbecue sauce': 'pantry-staples',
  'vegan worcestershire sauce': 'pantry-staples',
  'cooked mashed potato': 'pantry-consumables',
  'burger buns': 'pantry-consumables',
  'salt pork': 'protein',
  'cognac': 'pantry-staples',
  'whole grain dijon mustard': 'pantry-staples',
  'pinenuts': 'pantry-staples',
  'cinnamon stick': 'pantry-staples',
  'boneless pork tenderloin': 'protein',
  'pita chips': 'pantry-consumables',
  'sweetened condensed milk': 'pantry-consumables',
  'large flake dried unsweetened coconut': 'pantry-staples',
  'long pasta': 'pantry-consumables',
  'chili crisp': 'pantry-staples',
  'cajun seasoning': 'pantry-staples',
  'beef brisket': 'protein',
  'bone broth': 'pantry-consumables',
  'parsnips': 'produce',
  'dried tarragon': 'pantry-staples',
  'raw pecans': 'pantry-staples',
  'mixed greens salad': 'produce',
  'strawberry': 'produce',
  'cashew butter': 'pantry-staples',
  'rice noodles': 'pantry-consumables',
  'daikon': 'produce',
  'lo mein egg noodles': 'pantry-consumables',
  'dark soy sauce': 'pantry-staples',
  'white pepper': 'pantry-staples',
  'chinese 5 spice': 'pantry-staples',
  'cooked brown rice': 'pantry-consumables',
  'red thai chiles': 'produce',
  'black peppercorns': 'pantry-staples',
  'fennel': 'produce',
  'fresh english peas': 'produce',
  'italian vinaigrette': 'pantry-staples',
  'burrata cheese': 'dairy',
  'goat cheese': 'dairy',
  'chicken bouillon cubes': 'pantry-staples',
  'cream-style corn': 'pantry-consumables',
  'cornbread mix': 'pantry-consumables',
  'romano cheese': 'dairy',
  'frozen sweet peas': 'frozen',
  'pea shoots': 'produce',
  'petite potatoes': 'produce',
  'grape tomatoes': 'produce',
  'fresh cherries': 'produce',
  'calabrian chili': 'pantry-staples',
  'frozen cherries': 'frozen',
  'vegan butter': 'dairy',
  'kohlrabi': 'produce',
  'watercress': 'produce',
  'white sesame seeds': 'pantry-staples',
  'king oyster mushrooms': 'produce',
  'vegetable broth': 'pantry-consumables',
  'old bay seasoning': 'pantry-staples',
  'tagliatelle pasta': 'pantry-consumables',
  'sunflower seeds': 'pantry-staples',
  'corn on the cob': 'produce',
  'chaat masala': 'pantry-staples',
  'whole branzino': 'protein',
  'dry ramen noodles': 'pantry-consumables',
  'fresh prawns': 'protein',
  'oyster sauce': 'pantry-staples',
  'shichimi togarashi': 'pantry-staples',
  'furikake': 'pantry-staples',
  'green enchilada sauce': 'pantry-staples',
  'chopped green chiles': 'pantry-consumables',
  'baby kale': 'produce',
  'pickled jalapeño brine': 'pantry-staples',
  'ranch seasoning': 'pantry-staples',
  'refried beans': 'pantry-consumables',
  'taco seasoning': 'pantry-staples',
  '6- inch flour tortillas': 'pantry-consumables',
  'blackening seasoning': 'pantry-staples',
  'seafood stock': 'pantry-consumables',
  'marinated jarred artichoke hearts': 'pantry-consumables',
  'vegan parmesan': 'dairy',
  'skin-on sea bass': 'protein',
  'crusty torn bread': 'pantry-consumables',
  'garlic-infused oil': 'pantry-staples',
  'zhoug sauce': 'pantry-staples',
  'wonton strips': 'pantry-consumables',
  'yuzu juice': 'pantry-staples',
  'heirloom tomatoes': 'produce',
  'ciabatta bread': 'pantry-consumables',
  'coconut butter': 'pantry-staples',
  'burrito wraps': 'pantry-consumables',
  'pico de gallo': 'produce',
  'guacamole': 'produce',
  'shredded vegan cheese': 'dairy',
  'vegan sour cream': 'dairy',
  'mango salsa': 'produce',
  'racks of lamb': 'protein',
  'couscous': 'pantry-consumables',
  'bavette steak': 'protein',
  'onion soup mix': 'pantry-staples',
  // Common aliases
  'egg': 'dairy',
  'egg yolk': 'dairy',
  'chicken': 'protein',
  'salmon': 'protein',
  'shrimp': 'protein',
  'scallop': 'protein',
  'ground beef': 'protein',
  'pork': 'protein',
  'lamb': 'protein',
  'turkey': 'protein',
  'onion': 'produce',
  'garlic': 'produce',
  'ginger root': 'produce',
  'parsley': 'produce',
  'dill': 'produce',
  'mint': 'produce',
  'thyme': 'produce',
  'rosemary': 'produce',
  'sage': 'produce',
  'chive': 'produce',
  'chives': 'produce',
  'leek': 'produce',
  'tomato': 'produce',
  'cucumber': 'produce',
  'pepper': 'produce',
  'carrot': 'produce',
  'celery': 'produce',
  'onions': 'produce',
  'garlic cloves': 'produce',
  'olive oil': 'pantry-staples',
  'salt and pepper': 'pantry-staples',
  'black pepper': 'pantry-staples',
  'chicken stock': 'pantry-consumables',
  'chicken broth/stock': 'pantry-consumables',
  'beef stock': 'pantry-consumables',
  'beef broth/stock': 'pantry-consumables',
  'vegetable broth/stock': 'pantry-consumables',
  'neutral oil': 'pantry-staples',
  'canola oil': 'pantry-staples',
  'pasta': 'pantry-consumables',
  'spaghetti': 'pantry-consumables',
  'cheese': 'dairy',
  'cream': 'dairy',
};

const DB_KEYS_BY_LENGTH = Object.keys(INGREDIENT_DB).sort((a, b) => b.length - a.length);

// ─────────────────────────────────────────────
//  Parsing constants
// ─────────────────────────────────────────────

const FRACTION_MAP: Record<string, string> = {
  '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4',
  '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8',
  '⅙': '1/6', '⅚': '5/6', '⅕': '1/5', '⅘': '4/5',
};

const UNITS: Record<string, string> = {
  'cups': 'cup', 'cup': 'cup', 'c.': 'cup',
  'tablespoons': 'tbsp', 'tablespoon': 'tbsp', 'tbsp': 'tbsp', 'tbs': 'tbsp', 'tbsps': 'tbsp',
  'teaspoons': 'tsp', 'teaspoon': 'tsp', 'tsp': 'tsp', 'tsps': 'tsp',
  'ounces': 'oz', 'ounce': 'oz', 'oz': 'oz', 'fl oz': 'oz',
  'pounds': 'lb', 'pound': 'lb', 'lb': 'lb', 'lbs': 'lb',
  'grams': 'g', 'gram': 'g', 'g': 'g',
  'kilograms': 'kg', 'kilogram': 'kg', 'kg': 'kg',
  'milliliters': 'ml', 'milliliter': 'ml', 'ml': 'ml',
  'liters': 'l', 'liter': 'l',
  'cloves': 'clove', 'clove': 'clove',
  'heads': 'head', 'head': 'head',
  'bunches': 'bunch', 'bunch': 'bunch',
  'cans': 'can', 'can': 'can',
  'packages': 'pkg', 'package': 'pkg', 'pkg': 'pkg',
  'slices': 'slice', 'slice': 'slice',
  'pieces': 'piece', 'piece': 'piece', 'pcs': 'piece',
  'sprigs': 'sprig', 'sprig': 'sprig',
  'stalks': 'stalk', 'stalk': 'stalk',
  'pinches': 'pinch', 'pinch': 'pinch',
  'dashes': 'dash', 'dash': 'dash',
  'inches': 'inch', 'inch': 'inch', '"': 'inch',
  'quarts': 'qt', 'quart': 'qt', 'qt': 'qt',
  'pints': 'pt', 'pint': 'pt', 'pt': 'pt',
};

const STOP_WORDS: string[] = [
  'freshly', 'ground', 'dried', 'fresh', 'frozen', 'large', 'medium', 'small', 'whole',
  'extra', 'firm', 'soft', 'ripe', 'packed', 'heaping', 'leveled',
  'rounded', 'about', 'approximately', 'roughly', 'chopped', 'diced', 'minced', 'sliced',
  'grated', 'shredded', 'peeled', 'crushed', 'halved', 'quartered', 'optional', 'or more',
  'to taste', 'divided', 'room temperature', 'softened', 'melted', 'cooled', 'drained', 'rinsed',
  'torn', 'trimmed', 'julienned', 'cubed', 'zested', 'deveined', 'deboned', 'pitted', 'cored',
  'seeded', 'deseeded', 'blanched', 'seared', 'caramelized', 'roasted', 'toasted', 'grilled',
  'charred', 'smoked', 'pickled', 'marinated', 'brined', 'cured',
  'thin', 'thick', 'fine', 'finely', 'coarsely', 'thinly', 'bite-sized', 'bite-size',
  'warm', 'hot', 'cold', 'chilled', 'thawed',
  'good', 'quality', 'best', 'organic', 'store-bought', 'homemade', 'low-sodium',
  'unsweetened', 'reduced-fat', 'full-fat', 'light', 'dark', 'raw', 'uncooked', 'cooked',
  'leftover', 'day-old', 'for garnish', 'for serving', 'for topping', 'as needed', 'to coat',
  'plus more', 'garnish', 'serving', 'and',
];

const PIECE_WORDS = new Set([
  'fillet', 'fillets', 'thigh', 'thighs', 'breast', 'breasts', 'steak', 'steaks',
  'chop', 'chops', 'leg', 'legs', 'wing', 'wings', 'drumstick', 'drumsticks',
  'cutlet', 'cutlets', 'rack', 'rib', 'ribs', 'loin', 'loins', 'patty', 'patties',
  'burger', 'burgers', 'sausage', 'sausages', 'link', 'links',
]);

const VAGUE_WORDS: string[] = [
  'few', 'handful', 'pinch', 'dash', 'splash', 'sprinkle', 'drizzle',
  'to taste', 'as needed', 'some', 'squeeze', 'touch', 'knob',
];

const TEXT_NUMBERS: Record<string, number> = {
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'half': 0.5,
};

const STD_FRACS = [
  { val: 0.25, sym: '¼' }, { val: 1 / 3, sym: '⅓' }, { val: 0.5, sym: '½' },
  { val: 2 / 3, sym: '⅔' }, { val: 0.75, sym: '¾' },
];

const INGREDIENT_ALIASES: Record<string, string> = {
  'flat-leaf parsley': 'parsley', 'italian parsley': 'parsley', 'curly parsley': 'parsley',
  'thai basil': 'basil', 'sweet basil': 'basil', 'holy basil': 'basil',
  'fresh cilantro': 'cilantro', 'coriander leaves': 'cilantro', 'coriander': 'cilantro',
  'fresh dill': 'dill', 'dill weed': 'dill',
  'fresh mint': 'mint', 'spearmint': 'mint',
  'fresh thyme': 'thyme', 'thyme leaves': 'thyme', 'thyme sprig': 'thyme',
  'rosemary sprig': 'rosemary', 'fresh rosemary': 'rosemary',
  'sage leaf': 'sage', 'fresh sage': 'sage',
  'green onion': 'scallion', 'spring onion': 'scallion', 'scallions': 'scallion', 'green onions': 'scallion',
  'garlic clove': 'garlic cloves', 'garlic cloves': 'garlic cloves',
  'clove garlic': 'garlic cloves', 'cloves garlic': 'garlic cloves',
  'garlic head': 'garlic (whole head)', 'garlic bulb': 'garlic (whole head)',
  'head garlic': 'garlic (whole head)', 'heads garlic': 'garlic (whole head)',
  'garlic': 'garlic cloves',
  'lemon juice': 'lemon juice', 'lime juice': 'lime juice', 'orange juice': 'orange juice',
  'lemon zest': 'lemon zest', 'lime zest': 'lime zest', 'orange zest': 'orange zest',
  'cracked pepper': 'black pepper', 'cracked black pepper': 'black pepper',
  'ground pepper': 'black pepper', 'ground black pepper': 'black pepper',
  'freshly cracked pepper': 'black pepper', 'freshly ground pepper': 'black pepper',
  'freshly ground black pepper': 'black pepper',
  'kosher salt': 'salt', 'sea salt': 'salt', 'fine salt': 'salt',
  'flaky salt': 'salt', 'table salt': 'salt', 'coarse salt': 'salt',
  'chicken broth': 'chicken broth/stock', 'chicken stock': 'chicken broth/stock',
  'vegetable broth': 'vegetable broth/stock', 'vegetable stock': 'vegetable broth/stock',
  'beef broth': 'beef broth/stock', 'beef stock': 'beef broth/stock',
  'fish stock': 'fish stock', 'seafood stock': 'fish stock',
  'extra virgin olive oil': 'olive oil', 'extra-virgin olive oil': 'olive oil', 'evoo': 'olive oil',
  'vegetable oil': 'neutral oil', 'canola oil': 'neutral oil',
  'grapeseed oil': 'neutral oil', 'avocado oil': 'neutral oil',
  'sushi rice': 'white rice', 'jasmine rice': 'white rice',
  'basmati rice': 'white rice', 'long grain rice': 'white rice',
  'unsalted butter': 'butter', 'salted butter': 'butter', 'vegan butter': 'butter',
  'sour cream or creme fraiche': 'sour cream', 'sour cream or crème fraîche': 'sour cream',
  'creme fraiche': 'sour cream', 'crème fraîche': 'sour cream',
  'sour cream or yogurt': 'sour cream', 'greek yogurt': 'plain greek yogurt',
  'plain yogurt': 'plain greek yogurt', 'non-fat greek yogurt': 'plain greek yogurt',
  'whole milk mozzarella': 'mozzarella', 'fresh mozzarella': 'mozzarella', 'shredded mozzarella': 'mozzarella',
  'parmesan cheese': 'parmesan', 'grated parmesan': 'parmesan', 'parmigiano reggiano': 'parmesan',
  'pecorino romano': 'parmesan', 'romano cheese': 'parmesan',
  'mexican cheese or colby jack or pepper jack': 'mexican cheese',
  'mexican cheese blend': 'mexican cheese', 'colby jack': 'mexican cheese',
  'heavy whipping cream': 'heavy cream', 'whipping cream': 'heavy cream',
};

// ─────────────────────────────────────────────
//  Helper functions
// ─────────────────────────────────────────────

function levenshteinDistance(a: string, b: string): number {
  a = a.toLowerCase(); b = b.toLowerCase();
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
      else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

export function getDairyGroup(name: string): number {
  const n = name.toLowerCase();
  if (n.includes('egg')) return 1;
  const cheeses = ['parmesan', 'parmigiano', 'pecorino', 'romano', 'mozzarella', 'burrata', 'feta', 'cotija',
    'queso', 'cheddar', 'jack', 'gruyere', 'gruyère', 'brie', 'camembert', 'goat cheese', 'chèvre', 'blue cheese',
    'gorgonzola', 'provolone', 'fontina', 'havarti', 'gouda', 'halloumi', 'paneer', 'ricotta', 'mascarpone',
    'cream cheese', 'cottage cheese', 'cheese'];
  if (cheeses.some(c => n.includes(c))) return 2;
  if (n.includes('sour cream') || n.includes('crème') || n.includes('creme fraiche') || n.includes('yogurt')) return 3;
  return 4;
}

export function categorizeIngredient(name: string): string {
  const lower = name.toLowerCase();
  if (INGREDIENT_DB[lower]) return INGREDIENT_DB[lower];
  for (const key of DB_KEYS_BY_LENGTH) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(?:^|\\s)' + escaped + '(?:\\s|$)');
    if (re.test(lower)) return INGREDIENT_DB[key];
  }
  let bestMatch = '', bestDist = Infinity;
  for (const key of DB_KEYS_BY_LENGTH) {
    const dist = levenshteinDistance(lower, key);
    if (dist < bestDist) { bestDist = dist; bestMatch = key; }
    if (bestDist === 0) break;
  }
  if (bestDist <= 2) return INGREDIENT_DB[bestMatch];
  return 'pantry-staples';
}

export function nearestFrac(frac: number): { val: number; sym: string } | null {
  let best: { val: number; sym: string } | null = null;
  let bestDiff = Infinity;
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

export function normalizeWeight(qty: number, unit: string): { qty: number; unit: string } {
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

export function normalizeVolume(qty: number, unit: string): { qty: number; unit: string }[] {
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

export function parseQty(str: string): number {
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

export function fmtQty(qty: number, unit: string, category: string): string {
  if (!qty) return unit || '';
  const solidCategories = new Set(['protein', 'produce', 'meat', 'seafood', 'frozen']);
  if (unit === 'lb' || (unit === 'oz' && solidCategories.has(category))) {
    const n = normalizeWeight(qty, unit);
    return `${fmtNum(n.qty)} ${n.unit}`;
  }
  if (unit === 'tsp' || unit === 'tbsp') {
    const parts = normalizeVolume(qty, unit);
    return parts.map(p => `${fmtNum(p.qty)} ${p.unit}`).join(' + ');
  }
  return unit ? `${fmtNum(qty)} ${unit}` : fmtNum(qty);
}

// ─────────────────────────────────────────────
//  Main parser
// ─────────────────────────────────────────────

export function parseIngredient(raw: string): ParsedIngredient {
  if (!raw) return { qty: 0, unit: '', name: raw, category: 'pantry-staples', raw };
  let str = raw;

  // 0. Decode HTML entities
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
  for (const [k, v] of Object.entries(FRACTION_MAP)) str = str.split(k).join(v);
  str = str.trim();

  // 2. Strip long cooking notes in parens
  str = str.replace(/\(\([^)]*\)\)/g, '').replace(/\([^)]{15,}\)/g, '').replace(/\(Note\s*\d*\)/gi, '').trim();

  // 3. Vague quantities
  const strLower = str.toLowerCase();
  for (const vague of VAGUE_WORDS) {
    if (strLower.startsWith(vague)) {
      const vagueNameStr = str.slice(vague.length).replace(/^[,\s:]+/, '').trim();
      const vagueName = vagueNameStr.replace(/\(.*?\)/g, '').replace(/,.*$/, '').trim().toLowerCase();
      return { qty: 0, unit: '', name: vagueName || strLower, category: categorizeIngredient(vagueName || strLower), raw };
    }
  }

  // 4. Text numbers
  const textNumM = str.match(/^(one|two|three|four|five|six|seven|eight|nine|ten|half)\s+/i);
  let qty = 0;
  if (textNumM) {
    qty = TEXT_NUMBERS[textNumM[1].toLowerCase()] || 0;
    str = str.slice(textNumM[0].length).trim();
  }

  // 5. "N x" piece-count prefix
  let pieceCount = 0;
  if (!qty) {
    const piecePrefixM = str.match(/^(\d+)\s*[xX×]\s+/);
    if (piecePrefixM) {
      pieceCount = parseInt(piecePrefixM[1]);
      str = str.slice(piecePrefixM[0].length).trim();
    }
  }

  // 6. Strip dual metric/imperial
  str = str.replace(/\d+\.?\d*\s*(?:g|kg|ml|l)\s*[\/|]\s*/gi, '');

  // 7. Pre-normalize "zest/juice/peel of/from N ingredient"
  str = str.replace(
    /^(zest|juice|peel|rind)\s+(?:of|from)\s+((?:\d+\s+)?\d+\/\d+|\d+\.?\d*|one|two|three|four|five|six|seven|eight|nine|ten|half|a|an)\s+(.+)$/i,
    (_, prep, num, ing) => {
      const n = TEXT_NUMBERS[num.toLowerCase()] != null ? TEXT_NUMBERS[num.toLowerCase()] : num;
      return `${n} ${ing.trim()} ${prep.toLowerCase()}`;
    }
  );

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

  // 9. Compact inline measure (e.g. "1 6oz. can")
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

  // 11. Strip duplicate qty+unit
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

  // 14. Smart comma handling
  const commaIdx = str.indexOf(',');
  if (commaIdx >= 0) {
    const afterComma = str.slice(commaIdx + 1).trim();
    const afterWords = afterComma.split(/\s+/).filter(w => w.length > 0);
    const allStop = afterWords.length > 0 && afterWords.every(w =>
      STOP_WORDS.includes(w.toLowerCase().replace(/[.,!?]$/, ''))
    );
    str = allStop ? str.slice(0, commaIdx).trim() : str.replace(/,\s*/g, ' ').trim();
  }

  // 15. Clean name
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

  if (name.includes(' or ')) {
    const parts = name.split(' or ');
    name = parts.find(p => INGREDIENT_DB[p.trim()]) || parts[0].trim();
  }

  // 16. Piece-count logic
  if (pieceCount > 0) {
    const nameWords = name.split(' ');
    if (nameWords.some(w => PIECE_WORDS.has(w))) {
      const perPiece = (qty && unit) ? `${fmtNum(qty)} ${unit} ` : '';
      const category2 = forcedCategory || categorizeIngredient(name || raw);
      name = (perPiece + name).trim();
      return { qty: pieceCount, unit: '', name: INGREDIENT_ALIASES[name] || name, category: category2, raw };
    }
  }

  // 17. Special cases & alias map
  if (unit === 'clove' && !name) name = 'garlic';
  if (unit === 'clove' && (name === 'garlic' || name === 'garlic cloves')) { name = 'garlic cloves'; unit = ''; }
  if (unit === 'head' && name === 'garlic') { name = 'garlic (whole head)'; unit = ''; }
  if ((unit === 'tsp' || unit === 'tbsp') && (name === 'garlic' || name === 'garlic cloves')) {
    qty = Math.round((unit === 'tbsp' ? qty * 3 : qty) * 10) / 10;
    unit = '';
    name = 'garlic cloves';
  }
  if (unit === 'inch' && (name === 'ginger' || name === 'fresh ginger')) { unit = 'tbsp'; name = 'ginger'; }
  name = INGREDIENT_ALIASES[name] || name;

  const category = forcedCategory || categorizeIngredient(name || raw);
  return { qty, unit, name: name || raw.toLowerCase(), category, raw };
}

// ─────────────────────────────────────────────
//  Category display config
// ─────────────────────────────────────────────

export const SHOPPING_CATEGORIES = [
  { key: 'protein',            label: 'Protein' },
  { key: 'produce',            label: 'Produce' },
  { key: 'dairy',              label: 'Dairy & Eggs' },
  { key: 'pantry-staples',     label: 'Pantry Staples' },
  { key: 'pantry-consumables', label: 'Pantry Consumables' },
  { key: 'frozen',             label: 'Frozen' },
];
