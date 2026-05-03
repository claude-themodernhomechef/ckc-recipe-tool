/**
 * get_reingest_queue.js
 * ──────────────────────
 * Outputs the Firestore IDs of all recipes that were enriched
 * without ingredients (enriched before ingredients were added).
 *
 * These need their chefNotes and dietTags re-generated now that
 * real ingredients are present.
 *
 * Usage:
 *   node scripts/get_reingest_queue.js
 */

// The 71 recipes we just added ingredients to
const IDS = [
  '149-moms-oven-poached-salmon',
  '2019-02-06-mushroom-beet-bolognese-vegan-recipe',
  '2021-03-15-sheet-pan-roasted-chicken-thighs-and-cabbage',
  '2022-01-05-vegan-creamy-cauliflower-sweet-potato-chowder',
  '2022-03-14-baked-feta-with-cherry-tomatoes',
  '2022-06-07-simple-white-bean-salad',
  '2022-08-17-blackberry-glazed-tofu-black-pepper-chili',
  '2022-11-02-kale-arugula-butter-bean-salad-mustard-tahini',
  '2023-03-01-pizza-night-salad',
  '2023-04-05-lemony-shaved-fennel-asparagus-salad',
  '2023-08-16-smoky-vegan-corn-chowder-with-potatoes',
  '2023-09-13-spicy-maple-tofu-bowls-golden-garlic-rice',
  'baked-honey-garlic-chicken-thighs-recipe',
  'beef-with-mushrooms-and-bamboo-shoots',
  'black-bean-burgers',
  'blogs-eyeswoon-unplugged-eyeswoon-unplugged-pork-shoulder-ragu',
  'blogs-eyeswoon-unplugged-pan-roasted-chicken-recipe-athena-calderone',
  'blogs-recipes-whole-roasted-fish-with-citrus-herbs',
  'braised-chicken-with-chestnuts',
  'braised-halibut-with-roasted-cherry-tomatoes-and-tahini',
  'char-siu-recipe',
  'cheesy-salsa-chicken-rice-bake',
  'chicken-and-rice-one-pan',
  'chicken-shawarma-bowl',
  'chicken-souvlaki-recipe',
  'crispy-black-bean-sweet-potato-enchiladas',
  'crispy-cilantro-lime-chicken',
  'crispy-rolled-chipotle-beef-tacos',
  'crispy-sesame-tofu-with-sticky-rice',
  'crispy-turmeric-chicken-tenders',
  'garlic-butter-shrimp',
  'garlic-lemon-herb-mediterranean-chicken-potatoes',
  'greek-chicken-bowls',
  'herb-stuffed-slow-roasted-lamb-shoulder',
  'honey-garlic-butter-shrimp',
  'honey-sesame-chicken-meal-prep-bowls',
  'lamb-shawarma',
  'mapo-tofu',
  'mixed-vegetable-casserole',
  'mujaddara',
  'newsletters-chicken-and-tomatoes-forever',
  'our-best-grilled-chicken-breast-recipe',
  'pages-recipes-braised-lamb-shoulder-fennel-orange',
  'pages-recipes-roasted-chicken-legs-dates-olives-capers',
  'pages-recipes-roasted-squash-pepita-pesto',
  'perfect-pan-roasted-salmon',
  'quick-coconut-curry-chicken',
  'recipe-stovetop-cooking-method-chraime',
  'recipes-beef-broccoli',
  'recipes-blackened-salmon-grilled-lettuce-avocado-cream',
  'recipes-double-cut-lamb-chops-with-garlic-caper-rub',
  'recipes-grilled-summer-fish',
  'recipes-honey-garlic-pork-tenderloin',
  'recipes-pan-seared-salmon-with-peas-chanterelles-and-dill-chive-sauce',
  'recipes-pan-seared-scallops-lemon-garlic-butter',
  'recipes-pork-tenderloin',
  'recipes-shawarma-chicken-rice-bake',
  'recipes-tangy-braised-short-ribs',
  'recipes-vietnamesedaikonandcarrotpickles',
  'rice-bowl',
  'sesame-peanut-chicken-katsu-ramen',
  'shanghai-style-braised-pork-belly',
  'sheet-pan-lemon-chicken-potatoes',
  'sticky-chicken-thighs',
  'tequila-lime-fish-tacos',
  'teriyaki-salmon-bowls',
  'thai-peanut-chicken-noodle-bowls',
  'this-old-school-veal-saltimbocca-is-worth-mastering',
  'turkish-red-lentil-soup',
  'tuscan-butter-salmon-recipe',
  'vegan-pasta',
];

IDS.forEach(id => console.log(id));
process.stderr.write(`${IDS.length} recipes in reingest queue\n`);
