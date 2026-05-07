/**
 * build_recipe_nutrition_v2.ts
 *
 * Uses the PRODUCTION ingredient parser from the shopping list
 * (ckc-consumer-app/lib/ingredientParser.ts) as the single source of truth
 * for parsing recipe ingredient strings.
 *
 * Calculates per-ingredient nutrition using ingredientNutrition_v2.json,
 * sums to recipe totals, divides by servings, cross-references against Edamam.
 *
 * Usage: npx tsx scripts/build_recipe_nutrition_v2.ts
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Import the production parser directly!
import { parseIngredient, splitIngredientLine } from '../ckc-consumer-app/lib/ingredientParser';

const SA_PATH       = path.join(__dirname, '../service-account.json');
const INGREDIENT_DB = path.join(__dirname, '../data/ingredientNutrition_v2.json');
const EDAMAM_PROG   = path.join(__dirname, '../data/edamam_progress.json');
const SERVINGS_PROG = path.join(__dirname, '../data/servings_progress.json');
const PROGRESS_FILE = path.join(__dirname, '../data/recipe_nutrition_v2_progress.json');

const sa = require(SA_PATH);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

// ── Cooking defaults — applied when ingredient has no stated quantity ─────────
// These are used for fats/oils that appear in recipes without an amount.
// A note is stored on the ingredient so it can be surfaced in the UI.
const COOKING_DEFAULTS: Array<{ pattern: RegExp; qty: number; unit: string; note: string }> = [
  { pattern: /\boil\b/i,        qty: 1, unit: 'tbsp', note: '1 tbsp' },
  { pattern: /\bbutter\b/i,     qty: 1, unit: 'tbsp', note: '1 tbsp' },
  { pattern: /\bghee\b/i,       qty: 1, unit: 'tbsp', note: '1 tbsp' },
  { pattern: /\blard\b/i,       qty: 1, unit: 'tbsp', note: '1 tbsp' },
  { pattern: /\bshortening\b/i, qty: 1, unit: 'tbsp', note: '1 tbsp' },
];

// ── "To serve" / "to garnish" standards ──────────────────────────────────────
// When the parser detects a serving/garnish marker (unit = "to serve" /
// "to garnish") and qty is 0, apply a per-serving default. The qty will be
// multiplied by the recipe's `servings` count to get the total recipe amount.
//
// Rules live in Firestore: config/garnishPortionRules — single source of truth.
// Edit that doc to change a portion (e.g. cheese 1 oz → 0.5 oz); no code change
// needed. Loaded once at build start and cached in memory for the run.

interface PortionRule {
  id: string;
  displayName: string;
  perServing: { qty: number; unit: string };
  note: string;
  regex: string;
  skip?: boolean;
}

let PORTION_RULES: Array<{ rule: PortionRule; pattern: RegExp }> = [];

async function loadPortionRules(): Promise<void> {
  const doc = await db.collection('config').doc('garnishPortionRules').get();
  if (!doc.exists) throw new Error('config/garnishPortionRules not found in Firestore');
  const data = doc.data()!;
  const rules = data.rules as PortionRule[];
  PORTION_RULES = rules.map(r => ({ rule: r, pattern: new RegExp(r.regex, 'i') }));
  console.log(`Loaded ${PORTION_RULES.length} portion rules from config/garnishPortionRules`);
}

function applyServingDefault(parsed: { qty: number; unit: string; name: string }, servings: number):
  { qty: number; unit: string; note: string; skip?: boolean } | null
{
  const isServingMarker = parsed.unit === 'to serve' || parsed.unit === 'to garnish';
  if (!isServingMarker || parsed.qty !== 0) return null;
  const haystack = parsed.name.toLowerCase();
  for (const { rule, pattern } of PORTION_RULES) {
    if (pattern.test(haystack)) {
      return {
        qty: rule.perServing.qty * servings,
        unit: rule.perServing.unit,
        note: rule.note,
        skip: rule.skip,
      };
    }
  }
  return null;
}

// ── Unit normalizer — shopping list parser uses these unit names ──────────────
// Maps shopping-list parser canonical units → DB measure labels
const UNIT_TO_LABEL: Record<string, string> = {
  'cup': 'Cup',
  'tbsp': 'Tablespoon',
  'tsp': 'Teaspoon',
  'oz': 'Ounce', 'fl oz': 'Fluid ounce',
  'lb': 'Pound',
  'clove': 'Clove',
  'slice': 'Slice',
  'piece': 'Piece',
  'sprig': 'Sprig',
  'stalk': 'Stalk',
  'leaf': 'Leaf',
  'can': 'Can',
  'pkg': 'Package',
  'loaf': 'Loaf',
  'bag': 'Bag',
  'head': 'Head',
  'bunch': 'Bunch',
  'ear': 'Ear',
  'fillet': 'Fillet',
  'filet': 'Fillet',
  'breast': 'Breast',
  'thigh': 'Thigh',
  'pinch': 'Pinch', 'dash': 'Dash',
  'pt': 'Pint',
  'qt': 'Quart',
};

const FALLBACK_GRAMS: Record<string, number> = {
  'Ounce': 28.35, 'Pound': 453.59,
  'Cup': 240, 'Tablespoon': 15, 'Teaspoon': 5,
  'Fluid ounce': 29.57,
  'Pinch': 0.3, 'Dash': 0.6,
  // Container fallbacks (used when DB has no labeled measure)
  'Can':     425,   // standard 15 oz can
  'Package': 454,   // 1 lb / standard package
  'Loaf':    500,   // average bread loaf
  'Bag':     200,   // e.g. salad bag / coleslaw bag
  'Bunch':    50,   // herbs/greens bunch
  'Pint':  473,   // 1 pint liquid ≈ 473ml ≈ 473g
  'Quart': 946,   // 1 quart ≈ 946ml ≈ 946g
  'Slice': 35,    // generic bread/cheese slice fallback
  'Piece': 130,   // generic piece fallback (e.g. chicken piece)
};

// Standard gram weights for count-based items (no unit).
// User standard: 1 chicken breast = 4 oz (raw), no cooking yield adjustment.
// IMPORTANT: For bone-in cuts, these weights represent EDIBLE PORTION (meat+skin,
// without bone) — because the per-100g nutrition values in our DB are sourced
// from Edamam/USDA edible-portion data. Using whole-piece weight × edible-portion
// kcal would over-count by ~30% for bone-in cuts.
const STANDARD_GRAMS: Record<string, number> = {
  // Proteins — poultry (edible portion, raw)
  // Per-piece standards:
  //   bone-in chicken breast: whole ≈ 283g (10 oz), edible ≈ 225g (skin+meat, no bone)
  //   bone-in chicken thigh:  whole ≈ 170g (6 oz),  edible ≈ 120g
  //   boneless skinless chicken breast = 8 oz (227g) — already edible
  //   boneless skinless chicken thigh  = 4 oz (113g) — already edible
  // The lookup uses partial-key matching, so longer keys win when present.
  'bone-in chicken breast':         225,
  'bone in chicken breast':         225,
  'bone-in skin-on chicken breast': 225,
  'bone-in chicken thigh':          120,
  'bone in chicken thigh':          120,
  'bone-in skin-on chicken thigh':  120,
  'boneless skinless chicken breast': 227,
  'skinless boneless chicken breast': 227,
  'boneless chicken breast':          227,
  'boneless skinless chicken thigh':  113,
  'skinless boneless chicken thigh':  113,
  'boneless chicken thigh':           113,
  // Generic fallbacks: assume boneless/skinless when not specified
  'chicken breast':        227,  // 8 oz raw (boneless/skinless default)
  // Cooked chicken (rotisserie/shredded): ~140g per breast after shrinkage.
  // DB entry uses cooked kcal/100g (~165), so per-piece weight must be cooked too.
  'cooked chicken breast':   140,
  'cooked chicken breasts':  140,
  'shredded chicken breast': 140,
  'shredded chicken':        140,
  'rotisserie chicken breast': 140,
  'chicken thigh':         113,  // 4 oz raw (boneless/skinless default)
  'chicken leg':           120,  // bone-in leg, edible portion (~6 oz whole, 30% bone)
  'chicken drumstick':      55,  // edible (~85g whole, ~35% bone)
  'chicken wing':           20,  // edible (~30g whole)
  'turkey breast':         227,
  // Lamb shank: bone-in cut, edible portion (meat + some skin) ≈ 250g per shank
  // (whole shank ~400g, ~38% bone). Use edible per Rafi's bone-in policy.
  'lamb shank':            250,
  'lamb shanks':           250,
  // Proteins — seafood
  // Generic fish filet default = 6 oz (170g) per piece (raw, skin-on)
  'fish filet':            170,
  'fish fillet':           170,
  'white fish filet':      170,
  'white fish fillet':     170,
  'salmon':                200,  // ~7 oz fillet — typical recipe portion
  'salmon filet':          200,
  'salmon fillet':         200,
  'cod filet':             170,
  'cod fillet':            170,
  'tilapia filet':         170,
  'tilapia fillet':        170,
  'halibut filet':         170,
  'halibut fillet':        170,
  'sea bass filet':        170,
  'sea bass fillet':       170,
  'mahi mahi filet':       170,
  'mahi mahi fillet':      170,
  'tuna steak':            170,
  'shrimp':                  7,  // per piece (medium)
  'prawn':                   8,
  // Proteins — meat (large cuts) — bone-in cuts use edible portion
  'pork chop':             140,   // bone-in pork chop edible (~6 oz whole, ~20% bone)
  'pork tenderloin':       454,   // full tenderloin ≈ 1 lb
  'pork shoulder':         907,   // 2 lb for 1 count
  'pork shoulder roast':   907,
  'pork butt':             907,
  'baby back ribs':        900,   // full rack ≈ 2 lbs
  'spare ribs':            800,   // full rack
  'pork ribs':             900,
  'short rib':             140,   // bone-in short rib edible (~7 oz whole, 30% bone)
  'beef short rib':        140,
  'brisket':              1000,   // 1 count = ~1 slab
  'lamb chop':             120,   // bone-in lamb chop edible (~6 oz whole)
  'leg of lamb':          1800,   // boneless leg ≈ 4 lbs
  'lamb shank':            210,   // bone-in lamb shank edible (~10 oz whole, ~30% bone)
  'steak':                 170,   // 6 oz default
  'beef patty':            113,
  'rack of lamb':          680,   // 1 rack ≈ 1.5 lbs
  // Proteins — eggs
  'egg':                    50,
  'egg yolk':               18,
  'egg white':              30,
  // Dairy
  'stick butter':          113,  // 1 stick = 4 oz
  // Alliums & aromatics
  'garlic':                  3,  // 1 clove
  'garlic clove':            3,
  'shallot':                15,
  'onion':                 150,  // medium
  'leek':                  100,
  'green onion':            10,
  'scallion':               10,
  // Vegetables — whole
  'carrot':                 60,
  'celery stalk':           40,
  'celery':                 40,
  'zucchini':              200,  // medium
  'cucumber':              200,
  'bell pepper':           120,
  'sweet red pepper':      120,
  'sweet green pepper':    120,
  'jalapeño':               14,
  'tomato':                123,  // medium
  'cherry tomato':           8,
  'potato':                150,  // medium
  'russet potato':         160,  // 1 medium russet (per Rafi)
  'russet potatoes':       160,
  'sweet potato':          130,
  'beet':                  130,
  'corn':                  100,  // 1 ear, kernels only
  'ear of corn':           100,
  'artichoke':             120,
  'head of garlic':         50,
  // Fruits
  'lemon':                  58,
  'lime':                   45,
  'orange':                131,
  'apple':                 182,
  'banana':                118,
  'avocado':               200,  // medium
  'mango':                 200,
  'peach':                 150,
  'plum':                   66,
  'fig':                    40,
  'date':                   24,
  'strawberry':             12,  // per berry
  // Mushrooms
  'mushroom':               18,  // medium cremini/button
  // Bread / tortillas
  'tortilla':               25,  // small/medium tortilla
  'tortillas':              25,
  'corn tortilla':          25,
  'corn tortillas':         25,
  'flour tortilla':         25,
  'flour tortillas':        25,
  'slice bread':            28,
  'bread slice':            28,
  // Spices / small-count items
  'cashew':                 1.5,   // per cashew nut
  'cashewnut':              1.5,
  'cashews':                1.5,
  'cashewnuts':             1.5,
  'cashew nut':             1.5,
  'cashew nuts':            1.5,
  'almond':                 1.2,   // per whole almond
  'almonds':                1.2,
  'walnut':                 4,     // per walnut half
  'walnuts':                4,
  'pecan':                  2,
  'pecans':                 2,
  'macadamia nut':          2.5,
  'macadamia nuts':         2.5,
  'pistachio':              0.7,   // per kernel
  'pistachios':             0.7,
  'peppercorn':              0.05,  // per peppercorn
  'black peppercorn':        0.05,
  'cardamom pod':            0.5,
  'whole clove':             0.3,   // spice clove, not garlic clove
  'bay leaf':                0.2,
  'dried chili':             1.5,   // per dried chili pepper
  'chipotle pepper':         7,     // canned chipotle
  // Miscellaneous whole items
  'strip bacon':             19,    // 1 strip = 19g
  'bacon strip':             19,
};

const NUTRIENTS = ['calories','protein','fat','saturatedFat','monounsaturatedFat',
  'polyunsaturatedFat','transFat','cholesterol','carbs','fiber','sugar','addedSugar',
  'sodium','potassium','calcium','magnesium','phosphorus','iron','zinc',
  'vitaminA','vitaminC','vitaminD','vitaminE','vitaminK',
  'vitaminB1','vitaminB2','vitaminB3','vitaminB6','folate','vitaminB12','water'];

// ── Prep-word stripping ──────────────────────────────────────────────────────
// Words that describe HOW an ingredient is processed/sized but don't change
// what the ingredient IS. Stripping these from the parsed name before lookup
// turns "chopped parsley" → "parsley", "yellow onion diced" → "yellow onion",
// "low sodium chicken broth" → "chicken broth".
//
// NOT stripped: "can"/"canned" (meaningfully different nutrition vs dry),
// "fresh" (kept — db distinguishes fresh vs dried for some items).

const PREP_WORDS_SINGLE = [
  // processing verbs (past participles)
  'chopped', 'minced', 'grated', 'shredded', 'diced', 'sliced', 'crushed',
  'mashed', 'peeled', 'halved', 'quartered', 'cubed', 'julienned',
  'beaten', 'whisked', 'melted', 'softened',
  // adverbs
  'finely', 'coarsely', 'freshly', 'roughly', 'thinly', 'thickly',
  // size descriptors
  'small', 'medium', 'large', 'big', 'jumbo',
  // single-word dietary modifiers
  'unsalted',
];

const PREP_WORDS_MULTI = [
  /\blow[\s-]?sodium\b/g,
  /\breduced[\s-]?sodium\b/g,
  /\blow[\s-]?fat\b/g,
  /\breduced[\s-]?fat\b/g,
  /\bfat[\s-]?free\b/g,
  /\bextra[\s-]?large\b/g,
];

function stripPrepWords(name: string): string {
  let s = name.toLowerCase();
  for (const re of PREP_WORDS_MULTI) s = s.replace(re, '');
  for (const w of PREP_WORDS_SINGLE) {
    s = s.replace(new RegExp(`\\b${w}\\b`, 'g'), '');
  }
  // Collapse whitespace, trim commas/spaces
  s = s.replace(/\s+/g, ' ').replace(/^[\s,]+|[\s,]+$/g, '').trim();
  return s;
}

// Form modifiers — kept by the parser (consumer needs them at the store) but
// stripped here so the nutrition matcher can still find a DB entry.
// "canned black beans" → "black beans", "skinless salmon" → "salmon".
const FORM_MODIFIERS_NUTRITION = [
  /\bcanned\b/g, /\bjarred\b/g, /\bcan\b/g, /\bjar\b/g,
  /\bbone[\s-]?in\b/g, /\bboneless\b/g,
  /\bskin[\s-]?on\b/g, /\bskinless\b/g,
  /\bfull[\s-]?fat\b/g, /\blow[\s-]?fat\b/g, /\bfat[\s-]?free\b/g, /\bnonfat\b/g,
  /\blow[\s-]?sodium\b/g, /\breduced[\s-]?sodium\b/g,
  /\bcrumbled\b/g, /\bshelled\b/g,
  // NOTE: "lean", "93%", "90/10" are NOT stripped here — ground-meat nutrition
  // varies meaningfully by leanness (336 kcal/100g for 70/30 vs 134 for 96/4).
  // DB has dedicated entries per leanness percentage with USDA values.
  // Unit-like words that the parser keeps in the name for shopping clarity
  // but the matcher should ignore for DB lookup
  /\bhead\b/g, /\bsticks?\b/g, /\bstrips?\b/g, /\bsprigs?\b/g, /\bstalks?\b/g,
];

function stripFormModifiers(name: string): string {
  let s = name.toLowerCase();
  // Strip any parenthetical content (size specs, brand notes, etc.) — these are
  // kept by the parser for shopping display but never useful for DB lookup.
  s = s.replace(/\([^)]*\)/g, '');
  for (const re of FORM_MODIFIERS_NUTRITION) s = s.replace(re, '');
  return s.replace(/\s+/g, ' ').replace(/^[\s,]+|[\s,]+$/g, '').trim();
}

// ── Learned aliases from Review Queue corrections ────────────────────────────
// Populated at runtime from Firestore `ingredientAliases` collection.
// Keys are lowercased raw strings; values are the canonical name the user typed.
const LEARNED_ALIASES: Record<string, string> = {};

async function loadLearnedAliases(): Promise<number> {
  try {
    const snap = await db.collection('ingredientAliases').get();
    snap.forEach(doc => {
      const d = doc.data();
      if (d.rawKey && d.canonicalName) {
        LEARNED_ALIASES[String(d.rawKey).toLowerCase().trim()] = String(d.canonicalName).toLowerCase().trim();
      }
    });
    return snap.size;
  } catch {
    return 0;
  }
}

// ── Ingredient DB lookup ──────────────────────────────────────────────────────

function lookupIngredient(name: string, ingDB: any, _retry = false): any {
  if (!name) return null;
  const lower = name.toLowerCase().trim();

  // 0. Learned alias from Review Queue corrections (highest priority)
  if (LEARNED_ALIASES[lower]) {
    const target = LEARNED_ALIASES[lower];
    if (ingDB[target]) return ingDB[target];
  }

  // 1. Exact match
  if (ingDB[lower]) return ingDB[lower];

  // 2. Plural handling
  if (lower.endsWith('s') && ingDB[lower.slice(0, -1)]) return ingDB[lower.slice(0, -1)];
  if (lower.endsWith('es') && ingDB[lower.slice(0, -2)]) return ingDB[lower.slice(0, -2)];

  // 3. Common aliases (shopping-list parser already cleans most of these, but kept as safety net)
  const ALIASES: Record<string, string> = {
    'garlic clove': 'garlic', 'garlic cloves': 'garlic',
    'yellow onion': 'onion', 'white onion': 'onion',
    'cherry tomato': 'cherry tomato', 'roma tomato': 'tomato',
    'heavy cream': 'whipping cream',
    'vegetable oil': 'neutral cooking oil',
    'olive oil': 'olive oil', 'extra-virgin olive oil': 'olive oil', 'extra virgin olive oil': 'olive oil',
    'chicken stock': 'chicken broth', 'vegetable stock': 'vegetable broth', 'beef stock': 'beef broth',
    'parmesan': 'parmesan cheese', 'feta': 'feta cheese',
    'coconut milk': 'canned coconut milk', 'full fat coconut milk': 'canned coconut milk',
    'lime juice': 'lime juice', 'lemon juice': 'lemon juice',
    'tamari': 'soy sauce', 'coconut aminos': 'soy sauce',
    'dry white wine': 'white wine', 'dry red wine': 'red wine',
    'flour': 'all-purpose flour', 'ap flour': 'all-purpose flour',
    'ginger': 'ginger root', 'fresh ginger': 'ginger root',
    'scallion': 'green onion', 'scallions': 'green onion',
    'red pepper flakes': 'red pepper flakes',
    'dijon': 'dijon mustard', 'dijon mustard': 'dijon mustard',
    'bell pepper': 'sweet red pepper',
    'red bell pepper': 'sweet red pepper',
    'green bell pepper': 'sweet green pepper',
    'salmon fillet': 'salmon fillet',
    'skin-on salmon fillet': 'salmon fillet', 'skin on salmon fillet': 'salmon fillet',
    'chicken breast': 'chicken breast', 'chicken thigh': 'chicken thigh',
    'bone-in chicken thighs': 'bone-in chicken thighs',
    'boneless chicken thighs': 'boneless chicken thighs',
    'pork shoulder roast': 'pork shoulder roast',
    'baby back pork ribs': 'baby back pork ribs',
    'baby back ribs': 'baby back ribs',
    'full fat coconut milk': 'canned coconut milk',
    'light coconut milk': 'canned coconut milk',
    'cilantro': 'cilantro', 'parsley': 'parsley',
    'coleslaw mix': 'cabbage',
    'brown sugar': 'brown sugar',
    'bbq sauce': 'barbecue sauce',
  };
  if (ALIASES[lower] && ingDB[ALIASES[lower]]) return ingDB[ALIASES[lower]];

  // 4. First word
  const firstWord = lower.split(' ')[0];
  if (firstWord.length > 3 && ingDB[firstWord]) return ingDB[firstWord];

  // 5. Partial match
  const words = lower.split(' ').filter(w => w.length > 2);
  if (words.length > 0) {
    const match = Object.keys(ingDB).find(k => words.every(w => k.includes(w)));
    if (match) return ingDB[match];
  }

  // 6. Final fallback: strip prep words + form modifiers ("chopped", "canned",
  //    "skinless", "low sodium", etc.) and retry the whole chain once.
  if (!_retry) {
    const stripped = stripFormModifiers(stripPrepWords(lower));
    if (stripped && stripped !== lower) {
      const hit = lookupIngredient(stripped, ingDB, true);
      if (hit) return hit;
    }
    // 7. Last-ditch: strip "fresh" prefix if present. "fresh" is normally kept
    //    (DB distinguishes fresh vs dried for herbs) but falls back here when no
    //    "fresh X" entry exists — e.g. "fresh scallions" → "scallions".
    if (/\bfresh\b/.test(lower)) {
      const noFresh = lower.replace(/\bfresh\b/g, '').replace(/\s+/g, ' ').trim();
      if (noFresh && noFresh !== lower) return lookupIngredient(noFresh, ingDB, true);
    }
  }

  return null;
}

// ── Unit → grams conversion ───────────────────────────────────────────────────

function toGrams(qty: number, unit: string, ingEntry: any, ingName?: string): number {
  if (!qty || qty === 0) return 0;

  const unitLower = unit?.toLowerCase() || '';

  // 0. Direct metric units — grams/kg/ml are already gram-equivalent
  if (unitLower === 'g')  return qty;
  if (unitLower === 'kg') return qty * 1000;
  if (unitLower === 'ml') return qty;           // ml ≈ g (water density)
  if (unitLower === 'l')  return qty * 1000;

  const label = UNIT_TO_LABEL[unitLower] || '';

  // 1. DB labeled measure
  if (ingEntry?.measures && label) {
    const measure = ingEntry.measures.find((m: any) =>
      m.label && m.label.toLowerCase() === label.toLowerCase()
    );
    if (measure && measure.gramWeight > 0) return qty * measure.gramWeight;
  }

  // 2. Standard fallback
  if (label && FALLBACK_GRAMS[label]) return qty * FALLBACK_GRAMS[label];

  // 2b. Piece-style units (Fillet/Breast/Thigh/Slice/Piece) without DB measure —
  // fall back to STANDARD_GRAMS lookup on the ingredient name. This is where
  // "4 filets white fish" picks up the 6-oz/piece default, "2 bone-in chicken
  // thighs" picks up 6 oz/piece, etc.
  if ((label === 'Fillet' || label === 'Breast' || label === 'Thigh' || label === 'Piece') && ingName) {
    const lower = ingName.toLowerCase().trim();
    if (STANDARD_GRAMS[lower] !== undefined) return qty * STANDARD_GRAMS[lower];
    // Longest-key first so "boneless skinless chicken breast" wins over "chicken breast"
    const keys = Object.keys(STANDARD_GRAMS).sort((a, b) => b.length - a.length);
    const matchKey = keys.find(k => lower.includes(k));
    if (matchKey) return qty * STANDARD_GRAMS[matchKey];
  }

  // 3. No unit → check STANDARD_GRAMS table first (count items with known serving size)
  if (!unit) {
    if (ingName) {
      const lower = ingName.toLowerCase().trim();
      // Direct match
      if (STANDARD_GRAMS[lower] !== undefined) return qty * STANDARD_GRAMS[lower];
      // Partial match — LONGEST KEY FIRST so "corn tortillas" beats "corn" for
      // names like "mini corn tortillas". Without sort, shorter keys win and
      // produce wildly wrong defaults.
      const keys = Object.keys(STANDARD_GRAMS).sort((a, b) => b.length - a.length);
      const matchKey = keys.find(k =>
        lower.includes(k) || k.includes(lower)
      );
      if (matchKey) return qty * STANDARD_GRAMS[matchKey];
    }
    // Fall back to DB measures. CRITICAL: for count-based items (no unit), prefer
    // per-piece measures (Whole, Noodle, Sheet, Slice, Piece, etc.) over "Serving"
    // — Serving is meal-sized (e.g. 300g for lasagna noodles!), but a count of 9
    // means 9 individual noodles (25g each), not 9 servings.
    if (ingEntry?.measures) {
      const piecePreference = ['Whole', 'Noodle', 'Sheet', 'Slice', 'Piece', 'Stick', 'Egg', 'Clove', 'Head', 'Bulb', 'Leaf', 'Fillet', 'Filet', 'Breast', 'Thigh', 'Drumstick', 'Wing', 'Strip', 'Sprig', 'Stalk', 'Stem', 'Tail', 'Pod', 'Ear', 'Wedge', 'Half', 'Bunch'];
      for (const label of piecePreference) {
        const m = ingEntry.measures.find((m: any) => m.label === label);
        if (m && m.gramWeight > 0) return qty * m.gramWeight;
      }
      const serving = ingEntry.measures.find((m: any) => m.label === 'Serving');
      if (serving && serving.gramWeight > 0) return qty * serving.gramWeight;
      const first = ingEntry.measures.find((m: any) => m.label && m.gramWeight > 0);
      if (first) return qty * first.gramWeight;
    }
    return qty * 100;
  }

  return 0;
}

function calculateNutrition(grams: number, ingEntry: any): any {
  if (!grams || !ingEntry?.per100g) return null;
  const result: any = {};
  for (const key of NUTRIENTS) {
    const n = ingEntry.per100g[key];
    if (n != null) {
      const val = n.value != null ? n.value : n;
      result[key] = Math.round((val * grams / 100) * 100) / 100;
    }
  }
  return result;
}

function sumNutrition(items: any[]): any {
  const total: any = {};
  for (const item of items) {
    if (!item.nutrition) continue;
    for (const [key, val] of Object.entries(item.nutrition)) {
      total[key] = Math.round(((total[key] || 0) + (val as number)) * 100) / 100;
    }
  }
  return total;
}

function divideNutrition(total: any, servings: number): any {
  const perServing: any = {};
  for (const [key, val] of Object.entries(total)) {
    perServing[key] = Math.round(((val as number) / servings) * 100) / 100;
  }
  return perServing;
}

// Staple sides/starches that are NEVER garnish-flagged even when the recipe
// says "to serve" — they're integral to the meal, not optional toppings.
// Examples: "steamed rice, to serve" with butter chicken, "naan, to serve"
// with curry. The diner eats them as the meal, so they belong in the main
// nutrition total.
const NON_GARNISH_STAPLES = /\b(?:rice|naan|pita|flatbread|roti|tortillas?|pasta|noodles?|spaghetti|fettuccine|linguine|penne|rigatoni|orzo|couscous|quinoa|polenta|grits|cornbread|biscuits?|baguette|sourdough|french\s+bread|ciabatta|focaccia|mashed\s+potatoes?|cauliflower\s+rice|cauliflower\s+mash)\b/i;

// Is this ingredient a garnish? Garnishes are calculated but excluded from default totals.
// The app will show them behind an "add garnishes" toggle.
function isGarnish(raw: string): boolean {
  if (!raw) return false;
  const lower = raw.toLowerCase().trim();
  // Exempt staples even when "to serve" is in the text
  if (NON_GARNISH_STAPLES.test(lower)) return false;
  return /\bfor\s+serving\b|\bfor\s+garnish\b|\bto\s+serve\b|\bto\s+garnish\b|\bto\s+top\b/.test(lower)
    || /\bfor\s+(?:spritzing|drizzling|sprinkling|dipping|finishing|brushing)\b/.test(lower)
    || /\bon\s+top\b/.test(lower)
    || /^optional[\s:]+garnish|^garnish\s*:/i.test(lower)
    || /^for\s+topping\b/i.test(lower)
    || /^optional\s+/i.test(lower);  // "Optional: avocado, lime"
}

// Multi-spice "EACH:" strings like "1/4 tsp EACH: paprika, onion powder, thyme"
// are negligible calories — skip them entirely.
function isEachSpice(raw: string): boolean {
  return /\beach\s*:/i.test(raw);
}

// ── Pre-processor: normalise ingredient strings before the parser sees them ───
// Fixes patterns the production parser mishandles for nutrition purposes.

function preprocessIngredient(raw: string): string {
  let s = raw.trim();

  // 1. "4-5-pound chicken thighs"  →  "4-5 pound chicken thighs"  (range + hyphenated unit)
  s = s.replace(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*-\s*(pounds?|lbs?|ounces?|oz)\b/gi,
    (_, a, b, u) => `${a}-${b} ${u}`);

  // 2. "4-pound pork shoulder"  →  "4 pound pork shoulder"  (single number + hyphenated unit)
  s = s.replace(/^(\d+(?:\.\d+)?)\s*-\s*(pounds?|lbs?|ounces?|oz)\b/gi,
    (_, n, u) => `${n} ${u}`);

  // 3. "one 4-5-pound package chicken"  →  "4-5 pound chicken"  (text 'one' + range-pound)
  s = s.replace(/^one\s+(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*-?\s*(pounds?|lbs?|ounces?|oz)\b\s*(?:package\s+)?/gi,
    (_, a, b, u) => `${a}-${b} ${u} `);

  // 4. "one 4-pound package chicken"  →  "4 pound chicken"
  s = s.replace(/^one\s+(\d+(?:\.\d+)?)\s*-?\s*(pounds?|lbs?|ounces?|oz)\b\s*(?:package\s+)?/gi,
    (_, n, u) => `${n} ${u} `);

  // 5. "1 4-pound pork shoulder" / "2 6-oz fillets"
  //    Count (1-4) followed by a weight spec  →  take the weight as qty
  s = s.replace(/^[1-4]\s+(\d+(?:\.\d+)?)\s*-\s*(pounds?|lbs?|ounces?|oz)\b/gi,
    (_, n, u) => `${n} ${u}`);

  // 4b. "X inch [piece of] [fresh] ginger" → "X*15 g fresh ginger"
  //     Recipe authors specify ginger by length. ~15g per inch (typical thumb-thick piece).
  //     Handles: "1 inch fresh ginger", "2 inch piece of ginger", "3-inch piece ginger",
  //              "1 (2-inch) piece ginger", "2 inches fresh ginger".
  s = s.replace(/^(\d+(?:\.\d+)?)\s*[-]?\s*inch(?:es)?\s+(?:piece\s+(?:of\s+)?)?(?:fresh\s+)?ginger\b.*$/i,
    (_, n) => `${parseFloat(n) * 15} g fresh ginger`);
  s = s.replace(/^\d+\s*\(\s*(\d+(?:\.\d+)?)\s*[-]?\s*inch(?:es)?\s*\)\s*(?:piece\s+(?:of\s+)?)?(?:fresh\s+)?ginger\b.*$/i,
    (_, n) => `${parseFloat(n) * 15} g fresh ginger`);

  // 5a. "1 cup (200 grams) dried chickpeas" / "1 cup (370g) lentils"
  //     Volume + paren metric weight + name → use the metric weight as authoritative.
  //     Common in international/UK recipes.
  s = s.replace(/^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s+cups?\s+\(\s*(\d+(?:\.\d+)?)\s*(?:grams?|g)\s*\)\s+(.+)$/i,
    (_, _vol, w, rest) => `${w} g ${rest}`);

  // 5b. "2 (6-8oz) filets center-cut salmon"  /  "2 (6 oz) fillets salmon"
  //     Count + paren per-piece weight (range OK) + portion word + adj/noun
  //     →  total weight (count × lower) + descriptor + noun
  s = s.replace(/^(\d+)\s*\(\s*(\d+(?:\.\d+)?)(?:\s*[-–]\s*\d+(?:\.\d+)?)?\s*(oz|ounces?|lb|lbs?|pounds?|g|grams?|kg)\s*\)\s*(?:filets?|fillets?|breasts?|thighs?|legs?|wings?|drumsticks?|chops?|steaks?|cutlets?|portions?|pieces?|tenders?)\s+(.+)$/i,
    (_, n, w, u, rest) => `${parseFloat(n) * parseFloat(w)} ${u} ${rest}`);

  // 6. "- 15-ounce can …" / "- ounce can …"  →  "1 can …"
  s = s.replace(/^[-–]\s*\d*\.?\d*\s*(ounce|oz|pound|lb)\s+(can|cans|jar|jars|package|packages?|bag|bags?)\b/gi,
    (_, _u, container) => `1 ${container}`);

  // 6b. Bare "15- ounce can X" / "15-oz can X" / "15 ounce can X" with no leading count
  //     →  "1 (15 oz) can X"  (route through paren-weight handler so qty=15 oz)
  s = s.replace(/^(\d+(?:\.\d+)?)\s*-?\s*(ounce|oz|pound|lb|gram|g|kg|ml)s?\.?\s+(can|cans|jar|jars|package|packages?|bag|bags?|block|blocks?|box|boxes?|bottle|bottles?)\b/gi,
    (_, n, u, container) => `1 (${n} ${u}) ${container}`);

  // 7. "1 - 15 ounce can …"  →  "1 can …"
  s = s.replace(/^([1-4])\s*[-–]\s*\d{2,}\s*(?:ounce|oz)\s+(can|cans|jar|jars|package|packages?)\b/gi,
    (_, n, container) => `${n} ${container}`);

  // 8. Standalone leading dash before a number  "- 2 tablespoons …"  →  "2 tablespoons …"
  if (/^[-–]\s*\d/.test(s)) s = s.replace(/^[-–]\s*/, '');

  return s.trim();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Loading DB V2 + edamam + servings...');
  const ingDB       = JSON.parse(fs.readFileSync(INGREDIENT_DB, 'utf8'));
  const edamamProg  = fs.existsSync(EDAMAM_PROG) ? JSON.parse(fs.readFileSync(EDAMAM_PROG, 'utf8')) : {};
  const servingsProg = fs.existsSync(SERVINGS_PROG) ? JSON.parse(fs.readFileSync(SERVINGS_PROG, 'utf8')) : {};

  console.log('Loading learned aliases from ingredientAliases collection...');
  const aliasCount = await loadLearnedAliases();
  console.log(`  ${aliasCount} learned aliases loaded`);

  await loadPortionRules();

  let progress: any = {};
  if (fs.existsSync(PROGRESS_FILE)) {
    progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    console.log(`Resuming — ${Object.keys(progress).length} already done`);
  }

  console.log('Fetching recipes from Firestore...');
  const snap = await db.collection('recipes')
    .where('status', 'in', ['approved', 'needs_review'])
    .get();

  const recipes: any[] = [];
  snap.forEach(doc => {
    const d = doc.data();
    if (d.ingredients && d.ingredients.length >= 2) {
      recipes.push({ id: doc.id, name: d.name, ingredients: d.ingredients, parsedIngredients: d.parsedIngredients, dietTags: d.dietTags ?? {} });
    }
  });

  const todo = recipes.filter(r => !progress[r.id]);
  console.log(`${recipes.length} total | ${todo.length} remaining\n`);

  let full = 0, partial = 0, failed = 0, withEd = 0;
  let totalDelta = 0, deltaCount = 0;

  for (let i = 0; i < todo.length; i++) {
    const recipe = todo[i];
    const servings = servingsProg[recipe.id]?.servings || 4;
    const edamamResult = edamamProg[recipe.id];

    process.stdout.write(`[${String(i+1).padStart(4)}/${todo.length}] ${recipe.name.slice(0,50).padEnd(50)} `);

    const ingredientResults: any[] = [];
    let matchedCount = 0, totalCount = 0;

    // Build the working list of ingredient items.
    //
    // PREFERRED: read recipe.parsedIngredients (pre-computed canonical form,
    //   stored on Firestore by scripts/write_parsed_ingredients.ts). This is the
    //   single source of truth — manual per-recipe overrides edit this field
    //   directly so both shopping list and nutrition pipeline stay in sync.
    //
    // FALLBACK: if missing, fall back to live parsing via splitIngredientLine
    //   + parseIngredient (legacy path).
    interface Item { raw: string; pre?: any; }  // pre = pre-parsed { qty, unit, name, ... } or undefined
    const items: Item[] = [];
    if (Array.isArray(recipe.parsedIngredients) && recipe.parsedIngredients.length > 0) {
      for (const p of recipe.parsedIngredients) {
        items.push({ raw: p.raw || '', pre: p });
      }
    } else {
      for (const raw of recipe.ingredients) {
        if (!raw || !raw.trim()) continue;
        for (const part of splitIngredientLine(raw)) items.push({ raw: part });
      }
    }

    for (const item of items) {
      const raw = item.raw;
      if (!raw || !raw.trim()) continue;

      // If pre-parsed says skip, honor that
      if (item.pre?.skip) {
        ingredientResults.push({ raw, name: '', skip: true, skipReason: item.pre.skipReason || 'pre_parsed_skip' });
        continue;
      }

      // Skip multi-spice "EACH:" strings — negligible calories
      if (isEachSpice(raw)) {
        ingredientResults.push({ raw, name: '', skip: true, skipReason: 'each_spice' });
        continue;
      }

      // Skip splitter-byproduct fragments — "8 pieces" / "3 sticks" / "2 sprigs"
      // with no actual ingredient noun (when noun is present like "8 chicken breast"
      // it still parses correctly via STANDARD_GRAMS).
      if (/^\s*\d+\s+(?:pieces?|slices?|sticks?|sprigs?|stalks?)\s*$/i.test(raw)) {
        ingredientResults.push({ raw, name: '', skip: true, skipReason: 'fragment' });
        continue;
      }

      totalCount++;

      // Check if this is a garnish BEFORE parsing (garnishes are calculated but
      // stored separately and excluded from the default per-serving totals)
      const garnishFlag = isGarnish(raw);

      // Use pre-parsed values if available, else live-parse
      let parsed: any;
      if (item.pre) {
        parsed = {
          qty: item.pre.qty || 0,
          unit: item.pre.unit || '',
          name: item.pre.name || '',
          category: item.pre.category || '',
          raw,
          note: item.pre.note,
        };
      } else {
        const normalised = preprocessIngredient(raw);
        parsed = parseIngredient(normalised);
      }

      // Learned alias on the RAW string: if the user previously corrected this
      // exact raw, use their canonical name instead of the parser's guess.
      const rawKey = raw.toLowerCase().trim();
      if (parsed && LEARNED_ALIASES[rawKey]) {
        parsed = { ...parsed, name: LEARNED_ALIASES[rawKey] };
      }

      // Recovery for qty=0: if the ingredient name matches a STANDARD_GRAMS entry,
      // treat it as qty=1 (e.g. "skin-on salmon fillet", "leg of lamb", "whole chicken").
      // IMPORTANT: require exact match OR matchKey to be the trailing phrase of name —
      // prevents short common words like "pepper" from matching "bell pepper" via
      // substring overlap.
      if ((!parsed || parsed.qty === 0) && parsed?.name) {
        const lower = parsed.name.toLowerCase().trim();
        const matchKey = Object.keys(STANDARD_GRAMS).find(k =>
          lower === k || lower.endsWith(' ' + k)
        );
        if (matchKey) {
          parsed = { ...parsed, qty: 1, unit: '' };
        }
      }

      // Cooking default for no-quantity fats/oils — apply sensible 1 tbsp assumption
      let assumedDefault: string | null = null;
      if ((!parsed || parsed.qty === 0)) {
        const cookingDefault = COOKING_DEFAULTS.find(d => d.pattern.test(raw));
        if (cookingDefault) {
          parsed = { ...(parsed ?? { name: raw, qty: 0, unit: '' }), qty: cookingDefault.qty, unit: cookingDefault.unit };
          assumedDefault = cookingDefault.note;
        }
      }

      // "To serve" / "to garnish" defaults — when the parser produced a serving
      // marker (unit="to serve" or "to garnish") with no qty, multiply the
      // per-serving standard by recipe servings to get the recipe total.
      // Examples: rice "to serve" → 0.5 cup × N servings; cheese "to garnish"
      // → 1 oz × N servings.
      if (parsed) {
        const servingDefault = applyServingDefault(parsed, servings);
        if (servingDefault) {
          parsed = { ...parsed, qty: servingDefault.qty, unit: servingDefault.unit };
          assumedDefault = servingDefault.note;
        }
      }

      // Skip truly vague/zero-qty ingredients (salt to taste, etc.)
      if (!parsed || parsed.qty === 0) {
        ingredientResults.push({ raw, name: parsed?.name || '', skip: true });
        continue;
      }

      // Clean leftover weight/container prefixes in name (parser edge cases)
      // NOTE: do NOT strip 'bone-in' / 'skin-on' / 'boneless' / 'skinless' here —
      // these descriptors are critical for STANDARD_GRAMS lookup (bone-in chicken
      // thigh = 170g, boneless = 113g — almost 50% difference in weight).
      const cleanedName = parsed.name
        .replace(/^\d+(?:\.\d+)?-?\s*(?:pound|lb|ounce|oz|gram|kg)s?\s*/i, '') // "4-pound …"
        .replace(/^-\s*(?:pound|lb|ounce|oz|gram|kg)s?\s*/i, '')               // "-pound …"
        .replace(/^(?:package|bag|jar|can|loaf|rack|bundle)\s+/i, '')          // "package …"
        .replace(/^(?:whole|full\s+racks?\s+(?:of\s+)?)\s*/i, '')              // 'whole' / 'full rack of'
        .trim();
      const ingName = cleanedName || parsed.name;

      let ingEntry = lookupIngredient(ingName, ingDB);

      // Second-pass: strip leading prep adjectives and try again
      if (!ingEntry && ingName !== parsed.name) {
        ingEntry = lookupIngredient(parsed.name, ingDB);
      }
      if (!ingEntry) {
        // Strip "full racks of" / count words and try the core noun
        const stripped = ingName
          .replace(/^(?:full\s+)?racks?\s+(?:of\s+)?/i, '')
          .replace(/^(?:baby\s+back\s+)?/i, '')
          .trim();
        if (stripped && stripped !== ingName) ingEntry = lookupIngredient(stripped, ingDB);
      }
      const grams    = ingEntry
        ? toGrams(parsed.qty, parsed.unit, ingEntry, ingName)
        : toGrams(parsed.qty, parsed.unit, null, ingName);
      const nutrition = grams > 0 ? calculateNutrition(grams, ingEntry) : null;

      if (ingEntry && grams > 0 && nutrition) matchedCount++;

      ingredientResults.push({
        raw,
        name:          ingName,
        qty:           parsed.qty,
        unit:          parsed.unit,
        grams:         Math.round(grams * 10) / 10,
        matched:       !!(ingEntry && grams > 0),
        garnish:       garnishFlag,
        dbLabel:       ingEntry?.label || null,
        nutrition,
        ...(assumedDefault ? { assumed: true, assumedDefault } : {}),
      });
    }

    // Breadcrumb-as-coating cap: if recipe uses whole-piece protein (chicken
    // pieces, fish fillets, pork chops) AND has breadcrumbs, AND no ground
    // meat / pasta, treat the breadcrumbs as a coating. Cap the breadcrumb
    // contribution at 2/3 cup per pound of protein (≈72g per pound of protein).
    // Excess breadcrumbs in the recipe don't all stick to the protein, so
    // shouldn't be counted in nutrition.
    {
      const isBreadcrumb = (n: string) =>
        /\b(?:bread\s*crumb|breadcrumb|panko)/i.test(n);
      const isWholePieceProtein = (n: string) =>
        /\b(?:chicken\s+(?:thighs?|breasts?|legs?|wings?|drumsticks?|pieces?|fillets?|tenders?)|salmon\s+fillets?|cod\s+fillets?|tilapia|halibut|sea\s+bass|fish\s+fillets?|fish\s+filets?|pork\s+chops?|pork\s+tenderloins?|lamb\s+chops?|steak|tuna\s+steaks?)\b/i.test(n);
      const isDisqualifier = (n: string) =>
        /\b(?:ground\s+(?:beef|turkey|chicken|pork|lamb)|minced\s+(?:beef|turkey|chicken|pork)|meatball|meatloaf|pasta|noodles?|spaghetti|fettuccine|penne|rigatoni|lasagn|cavatelli|orzo|couscous)\b/i.test(n);

      const breadcrumbItems = ingredientResults.filter(r =>
        r.matched && r.name && isBreadcrumb(r.name));
      const proteinItems = ingredientResults.filter(r =>
        r.matched && r.name && isWholePieceProtein(r.name));
      const disqualifies = ingredientResults.some(r =>
        r.name && isDisqualifier(r.name));

      if (breadcrumbItems.length > 0 && proteinItems.length > 0 && !disqualifies) {
        // Sum up the protein grams (whole-recipe)
        const proteinGrams = proteinItems.reduce((sum, r) => sum + (r.grams || 0), 0);
        const proteinLbs = proteinGrams / 453.59;
        const capGrams = proteinLbs * 72; // 2/3 cup × 108g/cup ≈ 72g per lb of protein
        for (const bc of breadcrumbItems) {
          if (bc.grams > capGrams && bc.dbLabel) {
            const ratio = capGrams / bc.grams;
            // Scale nutrition values proportionally
            if (bc.nutrition) {
              for (const k of Object.keys(bc.nutrition)) {
                if (typeof bc.nutrition[k] === 'number') {
                  bc.nutrition[k] = +(bc.nutrition[k] * ratio).toFixed(2);
                }
              }
            }
            bc.cappedFromGrams = bc.grams;
            bc.grams = Math.round(capGrams * 10) / 10;
            bc.coatingCap = true;
          }
        }
      }
    }

    // ── Cooking-loss / consumption-aware adjustments ────────────────────────────
    // These rules reflect what's actually eaten vs raw ingredient kcal:
    //   1. Bacon/sausage render — 50% of weight is fat that drips off and is
    //      typically discarded (unless recipe is soup/stew/braise that captures fat).
    //   2. Grilled/broiled/BBQ protein — 10% kcal lost to drippings.
    //   3. Alcohol burn-off in long-cooked dishes — 30% kcal lost in braise/stew/ragù.
    //   4. Frying oil cap — when ≥1/3 cup oil "for frying", count only 10% absorbed.
    //   5. Trimmed cuts — 5% kcal discount when recipe says "trimmed" / "fat removed".
    const recipeName = (recipe.name || '').toLowerCase();
    const isSoupStew = /\b(?:soup|stew|chowder|chili|gumbo|broth|bisque|braise|ragu|rag[uú]|stock|cassoulet)\b/.test(recipeName);
    const isGrilled = /\b(?:grilled?|broiled?|bbq|barbecue|kebab|kabob|skewer|satay|yakitori|charred?)\b/.test(recipeName);
    const isLongCooked = /\b(?:braised?|stewed?|ragu|rag[uú]|stew|coq\s+au\s+vin|bourguignon|osso\s+buco|cassoulet|long[\s-]?cook|simmer(?:ed)?)\b/.test(recipeName);

    const scaleNutrition = (item: any, factor: number, tag: string) => {
      if (!item.nutrition) return;
      for (const k of Object.keys(item.nutrition)) {
        if (typeof item.nutrition[k] === 'number') {
          item.nutrition[k] = +(item.nutrition[k] * factor).toFixed(2);
        }
      }
      item.adjustments = [...(item.adjustments || []), { tag, factor }];
    };

    for (const it of ingredientResults) {
      if (!it.matched || !it.nutrition) continue;
      const n = (it.name || '').toLowerCase();
      const raw = (it.raw || '').toLowerCase();

      // 1. Bacon/sausage render (skip when soup/stew captures drippings)
      if (!isSoupStew && /\b(?:bacon|pancetta|chorizo|breakfast\s+sausage|italian\s+sausage|spicy\s+italian\s+sausage)\b/.test(n)) {
        scaleNutrition(it, 0.5, 'bacon_render_loss');
      }

      // 2. Grilled/broiled protein drip loss
      if (isGrilled && /\b(?:chicken|beef|steak|lamb|pork|salmon|tuna|halibut|cod|tilapia|fish|shrimp|prawn|fillets?|filets?|thighs?|breasts?|chops?|kebab|kabob|skewer)\b/.test(n)) {
        scaleNutrition(it, 0.9, 'grill_drip_loss');
      }

      // 3. Alcohol burn-off in braise/stew
      if (isLongCooked && /\b(?:wine|beer|ale|sake|vermouth|sherry|brandy|bourbon|vodka|rum|gin|champagne|whiskey|whisky|cognac|marsala|madeira|port)\b/.test(n) && !/vinegar/.test(n)) {
        scaleNutrition(it, 0.7, 'alcohol_burnoff');
      }

      // 4. Frying oil cap — applies when raw text says "for frying" / "to fry" with
      //    ≥1/3 cup oil. Recipes deep-fry in lots of oil; only ~10% is absorbed.
      if (/\boil\b/.test(n) && /\bfor\s+(?:deep[\s-]?)?fry|to\s+(?:deep[\s-]?)?fry/.test(raw)) {
        const cupEquivalent = it.unit === 'cup' ? it.qty : (it.grams || 0) / 218;
        if (cupEquivalent >= 0.33) {
          scaleNutrition(it, 0.1, 'fry_oil_absorption');
        }
      }

      // 5. Trimmed cuts
      if (/\b(?:trimmed|fat\s+removed|fat\s+trimmed|excess\s+fat\s+(?:removed|trimmed))\b/.test(raw)) {
        scaleNutrition(it, 0.95, 'trimmed_fat');
      }
    }

    const mainItems    = ingredientResults.filter(r => r.nutrition && !r.garnish);
    const garnishItems = ingredientResults.filter(r => r.nutrition && r.garnish);
    const total        = sumNutrition(mainItems);
    const garnishTotal = garnishItems.length > 0 ? sumNutrition(garnishItems) : null;
    const perServing   = Object.keys(total).length > 0 ? divideNutrition(total, servings) : null;
    const garnishPerServing = garnishTotal ? divideNutrition(garnishTotal, servings) : null;

    let edamamDelta: number | null = null;
    if (edamamResult?.status === 'ok' && edamamResult.nutrition?.calories && total.calories) {
      edamamDelta = Math.round(Math.abs(total.calories - edamamResult.nutrition.calories) / edamamResult.nutrition.calories * 100);
      totalDelta += edamamDelta;
      deltaCount++;
      withEd++;
    }

    const matchRate = totalCount > 0 ? Math.round(matchedCount / totalCount * 100) : 0;

    if (matchRate === 100) full++;
    else if (matchRate >= 50) partial++;
    else failed++;

    progress[recipe.id] = {
      status: matchRate >= 50 ? 'ok' : 'partial',
      matchRate,
      servings,
      edamamDelta,
      nutrition: {
        ingredients: ingredientResults,
        total,
        perServing,
        garnishPerServing,
        servings,
        source: 'ingredient_db_v2_shopping_parser',
        calculatedAt: new Date().toISOString().split('T')[0],
        edamamDelta,
        edamamCalories: edamamResult?.status === 'ok' ? edamamResult.nutrition?.calories : null,
      },
    };

    const deltaStr = edamamDelta !== null ? ` Δ${edamamDelta}%` : '';
    console.log(`✓ ${matchedCount}/${totalCount} (${matchRate}%)${deltaStr}`);

    if ((i + 1) % 50 === 0) {
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
    }
  }

  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));

  const avgDelta = deltaCount > 0 ? Math.round(totalDelta / deltaCount) : 0;
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('RECIPE NUTRITION V2 (SHOPPING PARSER)');
  console.log(`  Full match (100%):    ${full}`);
  console.log(`  Partial (50-99%):     ${partial}`);
  console.log(`  Low match (<50%):     ${failed}`);
  console.log(`  Edamam cross-ref:     ${withEd}`);
  console.log(`  Avg calorie delta:    ${avgDelta}% vs Edamam`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
