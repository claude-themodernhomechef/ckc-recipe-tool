"use strict";
/**
 * Diet tag classifier — TypeScript port of enrich_recipes.py → classify_diet_tags()
 * Follows CKC_Diet_Compliance_Rules.md exactly.
 * Core rule: never apply a mod if it would gut the dish.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyDietTags = classifyDietTags;
// ── Known blog affiliations ───────────────────────────────────────────────────
const VEGAN_BLOGS = [
    'minimalist baker', 'vegan richa', 'jessica in the kitchen',
    'the simple veganista', 'this savory vegan', 'orchids + sweet tea',
    'orchids and sweet tea',
];
const VEGETARIAN_BLOGS = ['cookie and kate', 'love and lemons'];
// ── Keyword lists (mirrors enrich_recipes.py exactly) ────────────────────────
const MEAT_TITLE_KW = [
    'chicken', 'beef', 'pork', 'lamb', 'turkey', 'salmon', 'shrimp', 'prawn',
    'tuna', 'cod', 'halibut', 'tilapia', 'steak', 'duck', 'veal', 'bison',
    'sausage', 'chorizo', 'bacon', 'ham', 'mahi', 'snapper', 'trout',
    'sea bass', 'branzino', 'scallop', 'crab', 'lobster', 'clam', 'mussel',
    'oyster', 'fish', 'meat', 'carnitas', 'carne', 'brisket', 'ribs',
    'wings', 'drumstick', 'thigh', 'breast', 'ground beef', 'ground turkey',
    'ground pork', 'ground chicken', 'pulled pork', 'pulled chicken',
];
const MEAT_ING_KW = [...MEAT_TITLE_KW,
    'anchovies', 'anchovy', 'sardine', 'mackerel', 'bone broth',
    'worcestershire', 'lard', 'suet',
];
const FISH_SAUCE_KW = ['fish sauce'];
const CHICKEN_BROTH_KW = ['chicken broth', 'chicken stock', 'chicken bouillon'];
const ANCHOVY_KW = ['anchovy', 'anchovies', 'anchovy paste'];
const EGG_KW = ['egg', 'eggs', 'egg white', 'egg yolk', 'beaten egg', 'hard boiled'];
const DAIRY_KW = [
    'milk', 'whole milk', 'skim milk', '2% milk', 'buttermilk',
    'heavy cream', 'heavy whipping cream', 'light cream', 'half and half',
    'butter', 'unsalted butter', 'salted butter',
    'cream cheese', 'sour cream', 'creme fraiche', 'crème fraîche',
    'yogurt', 'greek yogurt', 'plain yogurt', 'kefir',
    'parmesan', 'parmigiano', 'mozzarella', 'cheddar', 'gruyere', 'gruyère',
    'ricotta', 'feta', 'goat cheese', 'blue cheese', 'brie', 'camembert',
    'mascarpone', 'cotija', 'queso', 'manchego', 'pecorino',
    'whipping cream', 'condensed milk', 'evaporated milk',
    'ghee', 'cheese',
];
const DAIRY_TITLE_IDENTITY_KW = [
    'feta', 'parmesan', 'parmigiano', 'cheese', 'cheesy', 'mozzarella',
    'ricotta', 'brie', 'gruyere', 'cheddar', 'mac and cheese', 'queso',
    'alfredo', 'carbonara',
];
const GLUTEN_KW = [
    'flour', 'all-purpose flour', 'wheat flour', 'wheat',
    'pasta', 'orzo', 'couscous', 'farro', 'spelt', 'barley', 'rye',
    'bread', 'breadcrumbs', 'panko', 'crouton',
    'naan', 'pita', 'tortilla wrap',
    'soy sauce',
    'ramen noodles', 'lo mein', 'chow mein', 'wonton', 'dumpling wrapper',
    'gnocchi', 'tortellini', 'ravioli', 'linguine', 'penne', 'spaghetti',
    'udon', 'egg noodles', 'oyster sauce', 'hoisin sauce', 'worcestershire sauce',
];
const GRAIN_TITLE_IDENTITY_KW = [
    'pasta', 'orzo', 'ramen', 'noodle', 'noodles', 'risotto', 'couscous',
    'gnocchi', 'ravioli', 'tortellini', 'linguine', 'penne', 'spaghetti',
    'fettuccine', 'udon', 'lo mein', 'chow mein', 'dumpling', 'wonton',
    'pot pie', 'bread', 'flatbread',
];
const GLUTEN_EASY_SWAP_KW = ['soy sauce'];
const KETO_DISQ_KW = [
    'rice', 'pasta', 'noodle', 'bread', 'flour', 'couscous', 'orzo',
    'quinoa', 'oat', 'barley', 'corn', 'tortilla',
    'bean', 'lentil', 'chickpea', 'pea', 'edamame',
    'potato', 'sweet potato', 'yam',
    'honey', 'sugar', 'brown sugar', 'maple syrup',
    'mango', 'banana', 'pineapple', 'dried fruit', 'raisin', 'date',
    'teriyaki', 'hoisin', 'bbq sauce', 'ketchup',
];
const KETO_TITLE_IDENTITY_KW = [
    'pasta', 'rice', 'risotto', 'noodle', 'noodles', 'ramen',
    'couscous', 'orzo', 'gnocchi', 'ravioli', 'tortellini', 'potato', 'yam',
];
const KETO_EASY_SWAP_KW = ['honey', 'sugar', 'brown sugar', 'maple syrup'];
const NIGHTSHADE_KW = [
    'tomato', 'pepper', 'paprika', 'chili', 'chile', 'cayenne',
    'eggplant', 'aubergine', 'potato ', 'goji', 'harissa',
];
const NUT_SEED_KW = [
    'almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut',
    'sesame', 'tahini', 'sunflower seed', 'pumpkin seed', 'chia', 'flax',
    'hemp seed', 'peanut', 'pine nut',
    'cumin', 'coriander', 'fennel seed', 'mustard', 'cardamom',
    'anise', 'nutmeg', 'celery seed', 'sumac', "za'atar", 'caraway',
    'fenugreek', 'black pepper', 'taco seasoning', 'curry powder',
    'italian seasoning', '7 spice',
];
const GRAIN_AIP_KW = [
    'rice', 'oat', 'wheat', 'corn', 'quinoa', 'buckwheat', 'amaranth',
    'flour', 'bread', 'pasta', 'noodle', 'couscous', 'barley', 'rye', 'farro', 'spelt',
];
const LEGUME_KW = [
    'bean', 'lentil', 'chickpea', 'pea ', ' peas', 'soy', 'tofu',
    'tempeh', 'edamame', 'peanut',
];
const COCOA_KW = ['chocolate', 'cocoa', 'cacao'];
const ALCOHOL_KW = ['wine', 'beer ', 'champagne', 'bourbon', 'whiskey', 'vodka',
    'rum ', 'brandy', 'sherry', 'sake', 'mirin'];
const FODMAP_DISQ_KW = [
    'garlic', 'onion', 'shallot', 'leek', 'garlic powder', 'onion powder',
    'wheat', 'rye', 'barley',
    'bean', 'lentil', 'chickpea', 'cashew', 'pistachio', 'edamame',
    'apple ', 'pear ', 'mango', 'watermelon', 'honey', 'agave',
    'milk', 'ice cream', 'yogurt', 'cream cheese', 'ricotta', 'soft cheese',
    'cauliflower', 'asparagus', 'mushroom', 'fennel', 'corn',
];
const FODMAP_EASY_SWAP_KW = ['garlic', 'onion', 'shallot', 'leek', 'garlic powder', 'onion powder'];
const FODMAP_HARD_KW = [
    'bean', 'lentil', 'chickpea', 'cashew', 'pistachio', 'edamame',
    'apple ', 'pear ', 'mango', 'watermelon',
    'cauliflower', 'asparagus', 'mushroom', 'fennel', 'corn',
];
const HISTAMINE_DISQ_KW = [
    'vinegar', 'wine', 'beer', 'champagne', 'alcohol',
    'tomato', 'spinach', 'avocado',
    'soy sauce', 'fish sauce', 'miso', 'kimchi', 'sauerkraut', 'pickl',
    'tamari',
    'aged cheese', 'parmesan', 'blue cheese', 'cheddar', 'gruyere', 'feta',
    'smoked salmon', 'canned tuna', 'canned fish', 'anchovies', 'sardine',
    'mushroom', 'strawberr', 'pineapple', 'ketchup', 'mustard',
    'worcestershire', 'hot sauce', 'sriracha',
    'chocolate', 'cocoa',
    'onion', 'garlic',
    'cumin', 'paprika', 'cayenne', 'chili', 'smoked paprika',
    'sesame', 'tahini', 'walnut', 'cashew', 'peanut', 'almond flour',
    'sumac', 'canola oil',
];
// ── Helpers ───────────────────────────────────────────────────────────────────
function containsAny(text, keywords) {
    return keywords.some(kw => text.includes(kw));
}
function hitsOf(text, keywords) {
    return keywords.filter(kw => text.includes(kw));
}
function joinSentences(parts) {
    const seenSentences = new Set();
    const seenReplaceFroms = new Set();
    const seenRemoveFroms = new Set();
    const cleaned = [];
    for (let p of parts) {
        if (!p) continue;
        // Normalize unicode whitespace (NBSP/zero-width/etc → regular space).
        p = p.replace(/[  ᠎ -‍  　﻿]/g, ' ');
        p = p.replace(/\s*\((?:use|see|reduce|add|note|keep|optional|to\b|or\s+use|or\s+see|or\s+more|but\s+|do\s+not|this\s+|adjust)[^)]*\)/gi, '');
        p = p.replace(/\s+/g, ' ').trim();
        if (!p) continue;
        p = p.charAt(0).toUpperCase() + p.slice(1);
        if (!p.endsWith('.')) p += '.';
        const lc = p.toLowerCase();
        if (seenSentences.has(lc)) continue;
        const replM = p.match(/^replace\s+(.+?)\s+with\s+/i);
        if (replM) {
            const fromKey = replM[1].trim().toLowerCase().slice(0, 80);
            if (seenReplaceFroms.has(fromKey)) continue;
            seenReplaceFroms.add(fromKey);
        }
        const remM = p.match(/^remove\s+(.+?)\s+entirely\.?$|^remove\s+(.+?)\.?$/i);
        if (remM) {
            const fromKey = ((remM[1] || remM[2]) ?? '').trim().toLowerCase().slice(0, 80);
            if (seenRemoveFroms.has(fromKey)) continue;
            seenRemoveFroms.add(fromKey);
        }
        seenSentences.add(lc);
        cleaned.push(p);
    }
    return cleaned.join(' ');
}
// ── Main classifier ───────────────────────────────────────────────────────────
function classifyDietTags(ingredients, recipeTitle = '', bloggerName = '') {
    const ingText = ingredients.join(' ').toLowerCase();
    const titleLower = recipeTitle.toLowerCase();
    const bloggerLower = bloggerName.toLowerCase();
    const tags = {};
    const hasMeat = containsAny(ingText, MEAT_ING_KW);
    const hasMeatTitle = containsAny(titleLower, MEAT_TITLE_KW);
    const hasEgg = containsAny(ingText, EGG_KW);
    const hasDairy = containsAny(ingText, DAIRY_KW);
    const hasGluten = containsAny(ingText, GLUTEN_KW);
    const hasAlcohol = containsAny(ingText, ALCOHOL_KW);
    const isVeganBlog = VEGAN_BLOGS.some(b => bloggerLower.includes(b));
    const isVegBlog = VEGETARIAN_BLOGS.some(b => bloggerLower.includes(b));
    // ── V — Vegan ───────────────────────────────────────────────────────────────
    if (isVeganBlog) {
        tags['V'] = { native: true, mod: false, notes: '' };
        tags['Vg'] = { native: true, mod: false, notes: '' };
        tags['DF'] = { native: true, mod: false, notes: '' };
    }
    else if (!hasMeat && !hasEgg && !hasDairy) {
        tags['V'] = { native: true, mod: false, notes: '' };
    }
    else if (!hasMeatTitle && !hasMeat && (hasEgg || hasDairy)) {
        const subs = [];
        if (hasEgg)
            subs.push('replace the egg with a flax egg — mix 2 tablespoons ground flaxseed with 1 tablespoon water');
        if (hasDairy) {
            subs.push('use plant-based dairy alternatives');
            subs.push('replace chicken broth with vegetable broth');
        }
        tags['V'] = { native: false, mod: true, notes: joinSentences(subs) };
    }
    // ── Vg — Vegetarian ─────────────────────────────────────────────────────────
    if (!tags['Vg']) {
        if (isVegBlog) {
            tags['Vg'] = { native: true, mod: false, notes: '' };
        }
        else if (!hasMeat) {
            tags['Vg'] = { native: true, mod: false, notes: '' };
        }
        else if (!hasMeatTitle) {
            const bgOnly = (containsAny(ingText, [...FISH_SAUCE_KW, ...CHICKEN_BROTH_KW, ...ANCHOVY_KW]) &&
                !MEAT_ING_KW
                    .filter(kw => ![...FISH_SAUCE_KW, ...CHICKEN_BROTH_KW, ...ANCHOVY_KW,
                    'fish sauce', 'chicken broth', 'chicken stock',
                    'chicken bouillon', 'anchovy', 'anchovies', 'anchovy paste'].includes(kw))
                    .some(kw => ingText.includes(kw)));
            if (bgOnly) {
                const subs = [];
                if (containsAny(ingText, FISH_SAUCE_KW))
                    subs.push('replace fish sauce with extra soy sauce and a squeeze of lime');
                if (containsAny(ingText, CHICKEN_BROTH_KW))
                    subs.push('replace chicken broth with vegetable broth');
                if (containsAny(ingText, ANCHOVY_KW))
                    subs.push('replace anchovy paste with 1 tablespoon tamari and 1 tablespoon capers with their juice');
                tags['Vg'] = { native: false, mod: true, notes: joinSentences(subs) };
            }
        }
    }
    // ── GF — Gluten-Free ────────────────────────────────────────────────────────
    if (!tags['GF']) {
        if (!hasGluten) {
            tags['GF'] = { native: true, mod: false, notes: '' };
        }
        else {
            const grainInTitle = containsAny(titleLower, GRAIN_TITLE_IDENTITY_KW);
            const glutenHits = hitsOf(ingText, GLUTEN_KW);
            const onlySoySauce = glutenHits.every(kw => GLUTEN_EASY_SWAP_KW.includes(kw));
            if (onlySoySauce) {
                tags['GF'] = { native: false, mod: true, notes: 'Replace soy sauce with tamari.' };
            }
            else if (!grainInTitle) {
                const subs = [];
                if (ingText.includes('soy sauce'))
                    subs.push('replace soy sauce with tamari');
                if (ingText.includes('oyster sauce'))
                    subs.push('replace oyster sauce with a GF variety');
                if (ingText.includes('hoisin sauce'))
                    subs.push('replace hoisin sauce with GF hoisin sauce');
                if (ingText.includes('worcestershire'))
                    subs.push('use GF Worcestershire sauce');
                if (containsAny(ingText, ['flour', 'all-purpose flour', 'wheat flour'])) {
                    if (containsAny(ingText, ['gravy', 'sauce', 'au jus', 'thicken']))
                        subs.push('replace flour with 2 tablespoons arrowroot powder to thicken the sauce');
                    else
                        subs.push('replace all-purpose flour with a 1:1 GF flour blend');
                }
                if (containsAny(ingText, ['breadcrumbs', 'panko']))
                    subs.push('use GF panko');
                if (ingText.includes('pasta'))
                    subs.push('replace pasta with a GF alternative — we like brown rice pasta for the most comparable texture');
                if (ingText.includes('orzo'))
                    subs.push('use GF orzo such as cassava flour orzo');
                if (ingText.includes('couscous'))
                    subs.push('replace couscous with GF couscous or cauliflower rice');
                if (containsAny(ingText, ['ramen noodles', 'lo mein', 'chow mein', 'udon', 'egg noodles']))
                    subs.push('replace with a brown rice noodle alternative');
                if (containsAny(ingText, ['tortilla wrap', 'flour tortilla']))
                    subs.push('replace flour tortillas with corn tortillas or a GF variety');
                if (containsAny(ingText, ['pita', 'naan']))
                    subs.push('use GF bread alternative');
                if (subs.length)
                    tags['GF'] = { native: false, mod: true, notes: joinSentences(subs) };
            }
        }
    }
    // ── DF — Dairy-Free ─────────────────────────────────────────────────────────
    if (!tags['DF']) {
        if (!hasDairy) {
            tags['DF'] = { native: true, mod: false, notes: '' };
        }
        else {
            const dairyInTitle = containsAny(titleLower, DAIRY_TITLE_IDENTITY_KW);
            if (!dairyInTitle) {
                const subs = [];
                if (containsAny(ingText, ['butter', 'unsalted butter', 'salted butter']))
                    subs.push('replace butter with olive oil');
                if (ingText.includes('ghee'))
                    subs.push('replace ghee with olive oil or coconut oil');
                if (containsAny(ingText, ['heavy cream', 'heavy whipping cream', 'whipping cream']))
                    subs.push('replace heavy cream with full-fat canned coconut milk');
                if (containsAny(ingText, ['half and half', 'light cream']))
                    subs.push('replace half-and-half with coconut milk');
                if (ingText.includes('buttermilk'))
                    subs.push('replace buttermilk with 1 tablespoon vinegar combined with 1/3 cup soy milk, rested for 10 minutes');
                if (containsAny(ingText, ['milk', 'whole milk', 'skim milk', '2% milk', 'condensed milk', 'evaporated milk']))
                    subs.push('use a plant-based milk alternative');
                if (containsAny(ingText, ['yogurt', 'greek yogurt', 'plain yogurt', 'kefir']))
                    subs.push('replace Greek yogurt with plain unsweetened coconut yogurt');
                if (containsAny(ingText, ['sour cream', 'creme fraiche', 'crème fraîche']))
                    subs.push('replace sour cream with a dairy-free alternative');
                if (containsAny(ingText, ['cream cheese', 'mascarpone']))
                    subs.push('use dairy-free cream cheese');
                if (containsAny(ingText, ['parmesan', 'parmigiano', 'pecorino']))
                    subs.push('replace parmesan with nutritional yeast and 1 tablespoon miso paste or porcini mushroom powder');
                if (containsAny(ingText, ['mozzarella', 'ricotta']))
                    subs.push('replace mozzarella and ricotta with Kite Hill brand dairy-free alternatives');
                if (ingText.includes('feta'))
                    subs.push('remove feta cheese or replace with a dairy-free feta if it is a core ingredient');
                if (ingText.includes('cotija'))
                    subs.push('remove cotija');
                if (containsAny(ingText, ['goat cheese', 'blue cheese', 'brie', 'camembert', 'cheddar', 'gruyere', 'manchego', 'queso']))
                    subs.push('omit or replace cheese with a dairy-free alternative');
                if (subs.length)
                    tags['DF'] = { native: false, mod: true, notes: joinSentences(subs) };
            }
        }
    }
    // ── K — Keto ────────────────────────────────────────────────────────────────
    if (!containsAny(ingText, KETO_DISQ_KW)) {
        tags['K'] = { native: true, mod: false, notes: '' };
    }
    else {
        const ketoInTitle = containsAny(titleLower, KETO_TITLE_IDENTITY_KW);
        const hits = hitsOf(ingText, KETO_DISQ_KW);
        const easyHits = hits.filter(kw => KETO_EASY_SWAP_KW.includes(kw));
        if (!ketoInTitle) {
            const subs = [];
            if (easyHits.includes('honey'))
                subs.push('replace honey with a liquid allulose sweetener');
            else if (containsAny(easyHits.join(' '), ['sugar', 'brown sugar', 'maple syrup']))
                subs.push('replace the sweetener with allulose');
            if (ingText.includes('rice') && !containsAny(titleLower, ['rice', 'risotto']))
                subs.push('substitute white rice with cauliflower rice');
            if (ingText.includes('quinoa'))
                subs.push('serve over cooked vegetables instead of quinoa');
            if (ingText.includes('couscous'))
                subs.push('replace couscous with cauliflower rice');
            if (containsAny(ingText, ['potato', 'sweet potato', 'yam'])) {
                if (containsAny(ingText, ['mashed', 'mash']) || titleLower.includes('mash'))
                    subs.push('replace mashed potato with cauliflower mash');
                else
                    subs.push('replace potatoes with roasted cauliflower florets or remove');
            }
            if (ingText.includes('corn') && !ingText.includes('corn tortilla'))
                subs.push('remove corn');
            if (containsAny(ingText, ['bean', 'lentil', 'chickpea']))
                subs.push('remove beans from the recipe');
            if (ingText.includes('tortilla') && !ingText.includes('corn tortilla'))
                subs.push('use keto-friendly tortillas');
            if (subs.length)
                tags['K'] = { native: false, mod: true, notes: joinSentences(subs) };
        }
    }
    // ── AIP — Autoimmune Protocol ────────────────────────────────────────────────
    const aipBlocks = {
        nightshade: containsAny(ingText, NIGHTSHADE_KW),
        'nut/seed': containsAny(ingText, NUT_SEED_KW),
        grain: containsAny(ingText, GRAIN_AIP_KW),
        legume: containsAny(ingText, LEGUME_KW),
        egg: hasEgg,
        dairy: hasDairy,
        alcohol: hasAlcohol,
        cocoa: containsAny(ingText, COCOA_KW),
    };
    const activeBlocks = Object.entries(aipBlocks).filter(([, v]) => v).map(([k]) => k);
    if (!activeBlocks.length) {
        tags['AIP'] = { native: true, mod: false, notes: '' };
    }
    else if (activeBlocks.length <= 2 && !aipBlocks['grain'] && !aipBlocks['legume']) {
        const subs = [];
        if (aipBlocks['nightshade']) {
            if (containsAny(ingText, ['soy sauce', 'tamari']))
                subs.push('replace soy sauce with coconut aminos');
            if (ingText.includes('tomato'))
                subs.push('omit tomatoes or replace with roasted beets or butternut squash for color');
            if (containsAny(ingText, ['bell pepper', 'pepper']))
                subs.push('replace bell peppers with celery or zucchini');
            if (containsAny(ingText, ['paprika', 'chili', 'cayenne', 'black pepper', 'cumin', 'mustard']))
                subs.push('replace seed-based spices with turmeric, ginger, cinnamon, or fresh herbs');
            if (ingText.includes('curry powder'))
                subs.push('replace curry powder with turmeric');
        }
        if (aipBlocks['nut/seed']) {
            if (ingText.includes('soy sauce'))
                subs.push('replace soy sauce with coconut aminos');
            if (ingText.includes('miso'))
                subs.push('replace miso with coconut aminos');
            if (ingText.includes('fish sauce'))
                subs.push('replace fish sauce with coconut aminos');
            if (ingText.includes('vinegar'))
                subs.push('replace vinegar with fresh lime or lemon juice');
            if (containsAny(ingText, ['sesame', 'tahini']))
                subs.push('remove sesame seeds and sesame oil');
            if (containsAny(ingText, ['cumin', 'coriander', 'paprika', 'mustard', 'black pepper']))
                subs.push('replace seed-based spices with turmeric, ginger, cinnamon, or fresh herbs');
        }
        if (aipBlocks['alcohol'] && containsAny(ingText, ['white wine', 'wine']))
            subs.push('replace wine with chicken broth or matching broth');
        if (subs.length)
            tags['AIP'] = { native: false, mod: true, notes: joinSentences(subs) };
    }
    // ── LF — Low-FODMAP ─────────────────────────────────────────────────────────
    if (!containsAny(ingText, FODMAP_DISQ_KW)) {
        tags['LF'] = { native: true, mod: false, notes: '' };
    }
    else {
        const fodmapHits = hitsOf(ingText, FODMAP_DISQ_KW);
        const hardFodmap = fodmapHits.filter(kw => FODMAP_HARD_KW.includes(kw));
        const easyFodmap = fodmapHits.filter(kw => FODMAP_EASY_SWAP_KW.includes(kw));
        if (easyFodmap.length && !hardFodmap.length) {
            const hasGarlic = easyFodmap.some(k => ['garlic', 'garlic powder'].includes(k));
            const hasOnion = easyFodmap.some(k => ['onion', 'shallot', 'leek', 'onion powder'].includes(k));
            const subs = [];
            if (hasGarlic && hasOnion)
                subs.push('replace garlic and onion with garlic-infused oil (use 1–2 tablespoons to replace both the oil and the garlic flavor contribution)');
            else if (hasGarlic)
                subs.push('replace garlic with 1 tablespoon garlic-infused oil');
            else if (hasOnion)
                subs.push('replace onion with the green tops of scallions only');
            if (subs.length)
                tags['LF'] = { native: false, mod: true, notes: joinSentences(subs) };
        }
    }
    // ── LH — Low-Histamine ──────────────────────────────────────────────────────
    if (!containsAny(ingText, HISTAMINE_DISQ_KW)) {
        tags['LH'] = { native: true, mod: false, notes: '' };
    }
    else {
        const histHits = hitsOf(ingText, HISTAMINE_DISQ_KW);
        const easyLh = ['soy sauce', 'vinegar', 'tamari', 'canola oil'];
        const hardHist = histHits.filter(kw => !easyLh.includes(kw));
        if (!hardHist.length) {
            const subs = [];
            if (histHits.includes('soy sauce') || histHits.includes('tamari'))
                subs.push('replace soy sauce with coconut aminos');
            if (histHits.includes('vinegar'))
                subs.push('replace vinegar with fresh lime or lemon juice');
            if (histHits.includes('canola oil'))
                subs.push('replace canola oil with olive oil');
            if (subs.length)
                tags['LH'] = { native: false, mod: true, notes: joinSentences(subs) };
        }
    }
    return tags;
}
//# sourceMappingURL=classifyDietTags.js.map