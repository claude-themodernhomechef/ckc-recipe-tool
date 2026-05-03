/**
 * audit_pipeline_health.ts
 *
 * Phase 1 audit. Scans every recipe in Firestore using the SAME production
 * parser + lookup that build_recipe_nutrition_v2.ts uses, and tallies:
 *
 *   1. Top unmatched ingredients (the names the matcher fails on, sorted by
 *      how many recipes they appear in)  →  data/audit_unmatched_ingredients.csv
 *   2. Recipes by match rate — which recipes have silently failing nutrition
 *      →  data/audit_low_matchrate_recipes.csv
 *   3. Diet-tag uncertainties from each recipe's reviewItems[]
 *      →  data/audit_diet_uncertainties.csv
 *   4. Shopping-category misses (parsed ingredients with no category mapping)
 *      →  data/audit_category_misses.csv
 *
 * Usage:  npx tsx scripts/audit_pipeline_health.ts
 *
 * Reads:  Firestore `recipes` (status: approved or needs_review)
 *         data/ingredientNutrition_v2.json
 *         Firestore `ingredientAliases` (if it exists — empty at first)
 *         Firestore `ingredientCategories`
 * Writes: 4 CSVs in data/  +  data/audit_summary.json
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

import { parseIngredient, categorizeIngredientWithMatch, addIngredientToDb, splitIngredientLine } from '../ckc-consumer-app/lib/ingredientParser';

const SA_PATH       = path.join(__dirname, '../service-account.json');
const INGREDIENT_DB = path.join(__dirname, '../data/ingredientNutrition_v2.json');
const OUT_DIR       = path.join(__dirname, '../data');

const sa = require(SA_PATH);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

// ── Prep-word stripping (mirrors build_recipe_nutrition_v2.ts) ───────────────
const PREP_WORDS_SINGLE = [
  'chopped', 'minced', 'grated', 'shredded', 'diced', 'sliced', 'crushed',
  'mashed', 'peeled', 'halved', 'quartered', 'cubed', 'julienned',
  'beaten', 'whisked', 'melted', 'softened',
  'finely', 'coarsely', 'freshly', 'roughly', 'thinly', 'thickly',
  'small', 'medium', 'large', 'big', 'jumbo',
  'unsalted',
];
const PREP_WORDS_MULTI: RegExp[] = [
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
  for (const w of PREP_WORDS_SINGLE) s = s.replace(new RegExp(`\\b${w}\\b`, 'g'), '');
  return s.replace(/\s+/g, ' ').replace(/^[\s,]+|[\s,]+$/g, '').trim();
}

const FORM_MODIFIERS_NUTRITION: RegExp[] = [
  /\bcanned\b/g, /\bjarred\b/g, /\bcan\b/g, /\bjar\b/g,
  /\bbone[\s-]?in\b/g, /\bboneless\b/g,
  /\bskin[\s-]?on\b/g, /\bskinless\b/g,
  /\bfull[\s-]?fat\b/g, /\blow[\s-]?fat\b/g, /\bfat[\s-]?free\b/g, /\bnonfat\b/g,
  /\bwhole[\s-]?milk\b/g,
  /\blow[\s-]?sodium\b/g, /\breduced[\s-]?sodium\b/g,
  /\breduced[\s-]?fat\b/g,
  /\b\d+%?\s*lean\b/g,
  // Herb 'fresh' prefix is a shopping-display preference; nutrition lookup retries without it
  /\bfresh\b/g,
  // Mild/hot spice qualifiers
  /\bmild\b/g, /\bhot\b/g, /\bspicy\b/g,
  // Cut style — 'english-cut' / 'center-cut' / 'flat-iron' descriptive but not in DB
  /\benglish[\s-]?cut\b/g, /\bcenter[\s-]?cut\b/g,
  // Texture/preparation descriptors — kept for shopping display, not in nutrition DB
  /\b(?:crunchy|creamy|crispy|crusty)\b/g,
  /\b(?:diced|crushed|sliced|chopped|ground|whole\s+peeled)\b/g,
  /\b(?:stone[\s-]?ground|wholegrain|whole[\s-]?grain|coarse)\b/g,
  // Variety/origin descriptors — keep for shopping display but not in nutrition DB
  /\b(?:bartlett|valencia|hass|granny\s+smith|honeycrisp|fuji|gala|pink\s+lady)\b/g,
  /\bvidalia\b/g,
  /\b(?:lacinato|tuscan|dinosaur|curly|red\s+russian)\b/g,
  /\b(?:atlantic|pacific|wild|wild[\s-]?caught|farm[\s-]?raised|sustainably[\s-]?caught)\b/g,
  /\b(?:san\s+marzano|roma|cherry|grape|heirloom|beefsteak|early\s+girl)\b/g,
  /\b(?:persian|kirby|english|hothouse|hot\s+house)\b/g,
  /\b(?:thai|italian|french|spanish|chinese|japanese|korean|mexican|indian|moroccan)\b/g,
  /\b(?:european|asian|american)\b/g,
  /\b(?:meyer)\b/g,
  /\bcrumbled\b/g, /\bshelled\b/g,
  /\bhead\b/g, /\bsticks?\b/g, /\bstrips?\b/g, /\bsprigs?\b/g, /\bstalks?\b/g,
];
function stripFormModifiers(name: string): string {
  let s = name.toLowerCase();
  // Strip any parenthetical content — kept by parser for shopping display, not useful for lookup
  s = s.replace(/\([^)]*\)/g, '');
  for (const re of FORM_MODIFIERS_NUTRITION) s = s.replace(re, '');
  return s.replace(/\s+/g, ' ').replace(/^[\s,]+|[\s,]+$/g, '').trim();
}

// ── Same lookup logic as build_recipe_nutrition_v2.ts ────────────────────────
// Copy of lookupIngredient so the audit reflects production behavior exactly.

const HARDCODED_ALIASES: Record<string, string> = {
  'garlic clove': 'garlic', 'garlic cloves': 'garlic',
  'yellow onion': 'onion', 'white onion': 'onion',
  'roma tomato': 'tomato',
  'heavy cream': 'whipping cream',
  'vegetable oil': 'neutral cooking oil',
  'extra-virgin olive oil': 'olive oil', 'extra virgin olive oil': 'olive oil',
  'chicken stock': 'chicken broth', 'vegetable stock': 'vegetable broth', 'beef stock': 'beef broth',
  'parmesan': 'parmesan cheese', 'feta': 'feta cheese',
  'coconut milk': 'canned coconut milk', 'full fat coconut milk': 'canned coconut milk',
  'light coconut milk': 'canned coconut milk',
  'tamari': 'soy sauce', 'coconut aminos': 'soy sauce',
  'dry white wine': 'white wine', 'dry red wine': 'red wine',
  'flour': 'all-purpose flour', 'ap flour': 'all-purpose flour',
  'ginger': 'ginger root', 'fresh ginger': 'ginger root',
  'scallion': 'green onion', 'scallions': 'green onion',
  'dijon': 'dijon mustard',
  'bell pepper': 'sweet red pepper',
  'red bell pepper': 'sweet red pepper',
  'green bell pepper': 'sweet green pepper',
  'skin-on salmon fillet': 'salmon fillet', 'skin on salmon fillet': 'salmon fillet',
  'coleslaw mix': 'cabbage',
  'bbq sauce': 'barbecue sauce',
};

function lookupIngredient(name: string, ingDB: any, learnedAliases: Record<string, string>, _retry = false): { entry: any; via: string } {
  if (!name) return { entry: null, via: 'no-name' };
  const lower = name.toLowerCase().trim();

  // Learned aliases (from Review Queue corrections) take priority
  if (learnedAliases[lower]) {
    const target = learnedAliases[lower];
    if (ingDB[target]) return { entry: ingDB[target], via: 'learned-alias' };
  }

  if (ingDB[lower]) return { entry: ingDB[lower], via: 'exact' };
  if (lower.endsWith('s') && ingDB[lower.slice(0, -1)]) return { entry: ingDB[lower.slice(0, -1)], via: 'plural-s' };
  if (lower.endsWith('es') && ingDB[lower.slice(0, -2)]) return { entry: ingDB[lower.slice(0, -2)], via: 'plural-es' };

  if (HARDCODED_ALIASES[lower] && ingDB[HARDCODED_ALIASES[lower]]) {
    return { entry: ingDB[HARDCODED_ALIASES[lower]], via: 'hardcoded-alias' };
  }

  const firstWord = lower.split(' ')[0];
  if (firstWord.length > 3 && ingDB[firstWord]) return { entry: ingDB[firstWord], via: 'first-word' };

  const words = lower.split(' ').filter(w => w.length > 2);
  if (words.length > 0) {
    const match = Object.keys(ingDB).find(k => words.every(w => k.includes(w)));
    if (match) return { entry: ingDB[match], via: 'partial' };
  }

  // Final fallback: strip prep words + form modifiers, retry once
  if (!_retry) {
    const stripped = stripFormModifiers(stripPrepWords(lower));
    if (stripped && stripped !== lower) {
      const result = lookupIngredient(stripped, ingDB, learnedAliases, true);
      if (result.entry) return { entry: result.entry, via: `prep-stripped:${result.via}` };
    }
  }

  return { entry: null, via: 'none' };
}

// Same preprocessor as build_recipe_nutrition_v2.ts (handles "4-pound chicken" etc.)
function preprocessIngredient(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*-\s*(pounds?|lbs?|ounces?|oz)\b/gi, (_, a, b, u) => `${a}-${b} ${u}`);
  s = s.replace(/^(\d+(?:\.\d+)?)\s*-\s*(pounds?|lbs?|ounces?|oz)\b/gi, (_, n, u) => `${n} ${u}`);
  s = s.replace(/^one\s+(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*-?\s*(pounds?|lbs?|ounces?|oz)\b\s*(?:package\s+)?/gi, (_, a, b, u) => `${a}-${b} ${u} `);
  s = s.replace(/^one\s+(\d+(?:\.\d+)?)\s*-?\s*(pounds?|lbs?|ounces?|oz)\b\s*(?:package\s+)?/gi, (_, n, u) => `${n} ${u} `);
  s = s.replace(/^[1-4]\s+(\d+(?:\.\d+)?)\s*-\s*(pounds?|lbs?|ounces?|oz)\b/gi, (_, n, u) => `${n} ${u}`);
  s = s.replace(/^[-–]\s*\d*\.?\d*\s*(ounce|oz|pound|lb)\s+(can|cans|jar|jars|package|packages?|bag|bags?)\b/gi, (_, _u, container) => `1 ${container}`);
  s = s.replace(/^([1-4])\s*[-–]\s*\d{2,}\s*(?:ounce|oz)\s+(can|cans|jar|jars|package|packages?)\b/gi, (_, n, container) => `${n} ${container}`);
  if (/^[-–]\s*\d/.test(s)) s = s.replace(/^[-–]\s*/, '');
  return s.trim();
}

function isSkippable(raw: string): boolean {
  if (!raw || !raw.trim()) return true;
  if (/\beach\s*:/i.test(raw)) return true; // multi-spice
  if (/\bto\s+taste\b/i.test(raw.toLowerCase())) return true;
  const t = raw.trim().toLowerCase();
  // Lone fragments / qty-only / unit-only that are splitter byproducts
  if (t.length <= 2) return true; // "x", "a", "/", "--", etc.
  if (/^[-–—\/.,;:\s]+$/.test(t)) return true; // pure punctuation
  if (/^(?:approx|about|scant|heaping|lightly|generous|generously|rounded|level|packed|other|extra|more|some|a\s+few|a\s+bit)\.?$/i.test(t)) return true;
  // Bare qty + unit with no ingredient noun: "3 tbsp", "1/2 teaspoon", "2 pounds", "2-3 tablespoons"
  if (/^\d+(?:\s+\d+\/\d+)?(?:[.\/]\d+)?(?:\s*-\s*\d+(?:[.\/]\d+)?)?\s*(?:tsps?|tbsps?|teaspoons?|tablespoons?|cups?|oz|ounces?|lbs?|pounds?|grams?|kg|g|ml|l|pieces?|slices?|sticks?|sprigs?|stalks?|stems?|cloves?|cans?|jars?|pkgs?|sheets?|drops?|pinch|dash|handful|tubes?)\.?$/i.test(t)) return true;
  // "use N <unit>" / "total pieces" / "X kg / Y lb" qty-conversion fragments
  if (/^use\s+\d/i.test(t)) return true;
  if (/^\d+(?:[.\/]\d+)?\s*(?:kg|g|ml|l|lb|lbs|oz|cups?)\s*\/\s*\d+(?:[.\/]\d+)?\s*(?:kg|g|ml|l|lb|lbs|oz|cups?)/i.test(t)) return true;
  // Fragments ending in "from", "of", "made of" — splitter leftovers
  if (/\b(?:from|of|made\s+of)\s*$/i.test(t) && t.length < 50) return true;
  // Empty trailing markers like ", to garnish:", ", for serving:"
  if (/^[,\s]*(?:to|for)\s+(?:serving|serve|garnish(?:ing)?|topping)\s*[:.]?\s*$/i.test(t)) return true;
  // "X total" / "total X" qty-aggregation noise (also "4 pieces total")
  if (/^total\s+\w+$|^\w+\s+total$|^\d+\s+\w+\s+total$/i.test(t)) return true;
  // "1/2 cup blanched" / "5 cups chopped into bite-sized pieces" — qty+unit+prep, no noun
  if (/^[\d¼½¾⅓⅔⅛⅜⅝⅞.\/\s-]+\s*(?:tsps?|tbsps?|teaspoons?|tablespoons?|cups?|oz|ounces?|lbs?|pounds?|grams?|kg|g|ml|inch|inches)\s+(?:chopped|diced|sliced|crushed|minced|julienne|julienned|blanched|peeled|cubed|halved|quartered|grated|shredded)\b.*$/i.test(t)) return true;
  // "4 x" / "4 X" qty-with-multiplier-noise
  if (/^\d+\s*x\s*$/i.test(t)) return true;
  // "use <qty> <unit>" with trailing junk
  if (/^use\s+[\d¼½¾⅓⅔⅛⅜⅝⅞.\/\s-]+\s*\w+/i.test(t)) return true;
  // "<qty> <unit>, <qty> <unit>" double-unit conversion ("4 tablespoons, 2 oz")
  if (/^[\d¼½¾⅓⅔⅛⅜⅝⅞.\/\s-]+\s*\w+,\s*[\d¼½¾⅓⅔⅛⅜⅝⅞.\/\s-]+\s*\w+\s*$/i.test(t)) return true;
  return false;
}

// ── CSV writer ────────────────────────────────────────────────────────────────
function csvEscape(v: any): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function writeCSV(filepath: string, rows: any[][], headers: string[]): void {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) lines.push(row.map(csvEscape).join(','));
  fs.writeFileSync(filepath, lines.join('\n'));
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface UnmatchedTally {
  parsedName: string;
  count: number;
  recipeIds: Set<string>;
  examples: Set<string>; // raw strings
}

interface DietTally {
  ingredient: string;
  protocol: string;
  category: string; // grey_area / no_product_found / etc.
  count: number;
  recipeIds: Set<string>;
}

interface CategoryMissTally {
  parsedName: string;
  count: number;
  recipeIds: Set<string>;
  examples: Set<string>;
}

async function loadLearnedAliases(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  try {
    const snap = await db.collection('ingredientAliases').get();
    snap.forEach(doc => {
      const d = doc.data();
      if (d.rawKey && d.canonicalName) {
        map[String(d.rawKey).toLowerCase().trim()] = String(d.canonicalName).toLowerCase().trim();
      }
    });
  } catch { /* collection may not exist yet */ }
  return map;
}

async function loadShoppingCategoriesIntoParser(): Promise<number> {
  let n = 0;
  try {
    const snap = await db.collection('ingredientCategories').get();
    snap.forEach(doc => {
      const d = doc.data();
      if (d.name && d.category) {
        addIngredientToDb(d.name, d.category);
        n++;
      }
    });
  } catch { /* ignore — fall back to baseline */ }
  return n;
}

async function main() {
  console.log('Loading ingredient DB...');
  const ingDB = JSON.parse(fs.readFileSync(INGREDIENT_DB, 'utf8'));

  console.log('Loading shopping categories from Firestore...');
  const catN = await loadShoppingCategoriesIntoParser();
  console.log(`  ${catN} category mappings merged into parser`);

  console.log('Loading learned aliases (Firestore)...');
  const learnedAliases = await loadLearnedAliases();
  console.log(`  ${Object.keys(learnedAliases).length} learned aliases\n`);

  console.log('Fetching recipes from Firestore...');
  const snap = await db.collection('recipes')
    .where('status', 'in', ['approved', 'needs_review'])
    .get();

  const recipes: any[] = [];
  snap.forEach(doc => {
    const d = doc.data();
    if (d.ingredients && d.ingredients.length >= 1) {
      recipes.push({
        id: doc.id,
        name: d.name || '(untitled)',
        status: d.status,
        ingredients: d.ingredients,
        reviewItems: d.reviewItems || [],
      });
    }
  });

  console.log(`Auditing ${recipes.length} recipes...\n`);

  const unmatched   = new Map<string, UnmatchedTally>();
  const catMisses   = new Map<string, CategoryMissTally>();
  const dietTally   = new Map<string, DietTally>();
  const recipeRows: any[][] = [];

  let totalIngredients = 0;
  let totalMatched     = 0;
  let totalSkipped     = 0;

  for (const recipe of recipes) {
    let matched = 0;
    let counted = 0;

    // Split each raw line first (mirrors production build_recipe_nutrition_v2.ts behavior)
    const splitRaws: string[] = [];
    for (const raw of recipe.ingredients) {
      for (const part of splitIngredientLine(raw)) splitRaws.push(part);
    }
    for (const raw of splitRaws) {
      if (isSkippable(raw)) { totalSkipped++; continue; }

      const normalised = preprocessIngredient(raw);
      const parsed = parseIngredient(normalised);
      if (!parsed || !parsed.name) { totalSkipped++; continue; }

      counted++;
      totalIngredients++;

      const ingName = parsed.name.toLowerCase().trim();
      const { entry } = lookupIngredient(ingName, ingDB, learnedAliases);

      if (entry) {
        matched++;
        totalMatched++;
      } else {
        // Tally unmatched
        let t = unmatched.get(ingName);
        if (!t) { t = { parsedName: ingName, count: 0, recipeIds: new Set(), examples: new Set() }; unmatched.set(ingName, t); }
        t.count++;
        t.recipeIds.add(recipe.id);
        if (t.examples.size < 3) t.examples.add(raw);
      }

      // Shopping-category check (separate from nutrition lookup)
      const { matched: catMatched } = categorizeIngredientWithMatch(parsed.name);
      if (!catMatched) {
        let c = catMisses.get(ingName);
        if (!c) { c = { parsedName: ingName, count: 0, recipeIds: new Set(), examples: new Set() }; catMisses.set(ingName, c); }
        c.count++;
        c.recipeIds.add(recipe.id);
        if (c.examples.size < 3) c.examples.add(raw);
      }
    }

    // Diet uncertainties
    for (const item of recipe.reviewItems) {
      if (item.finalDecision) continue; // already decided
      const ingredient = (item.ingredient || item.term || 'unknown').toLowerCase().trim();
      const protocol   = item.protocol || item.diet || 'unknown';
      const category   = item.category || 'unspecified';
      const key = `${ingredient}::${protocol}::${category}`;
      let dt = dietTally.get(key);
      if (!dt) { dt = { ingredient, protocol, category, count: 0, recipeIds: new Set() }; dietTally.set(key, dt); }
      dt.count++;
      dt.recipeIds.add(recipe.id);
    }

    const matchRate = counted > 0 ? Math.round(matched / counted * 100) : 0;
    recipeRows.push([
      recipe.id,
      recipe.name,
      recipe.status,
      counted,
      matched,
      matchRate,
      recipe.reviewItems.filter((r: any) => !r.finalDecision).length,
    ]);
  }

  // ── Sort + write CSVs ─────────────────────────────────────────────────────

  const unmatchedSorted = [...unmatched.values()]
    .sort((a, b) => b.recipeIds.size - a.recipeIds.size);

  writeCSV(
    path.join(OUT_DIR, 'audit_unmatched_ingredients.csv'),
    unmatchedSorted.map(u => [
      u.parsedName,
      u.recipeIds.size,
      u.count,
      [...u.examples].join(' | '),
    ]),
    ['parsed_name', 'recipes_affected', 'total_occurrences', 'example_raw_strings']
  );

  const catMissSorted = [...catMisses.values()]
    .sort((a, b) => b.recipeIds.size - a.recipeIds.size);

  writeCSV(
    path.join(OUT_DIR, 'audit_category_misses.csv'),
    catMissSorted.map(c => [
      c.parsedName,
      c.recipeIds.size,
      c.count,
      [...c.examples].join(' | '),
    ]),
    ['parsed_name', 'recipes_affected', 'total_occurrences', 'example_raw_strings']
  );

  const dietSorted = [...dietTally.values()]
    .sort((a, b) => b.recipeIds.size - a.recipeIds.size);

  writeCSV(
    path.join(OUT_DIR, 'audit_diet_uncertainties.csv'),
    dietSorted.map(d => [
      d.ingredient,
      d.protocol,
      d.category,
      d.recipeIds.size,
      d.count,
    ]),
    ['ingredient', 'protocol', 'category', 'recipes_affected', 'total_occurrences']
  );

  // Recipes sorted by lowest match rate first (most broken first)
  recipeRows.sort((a, b) => (a[5] as number) - (b[5] as number));

  writeCSV(
    path.join(OUT_DIR, 'audit_low_matchrate_recipes.csv'),
    recipeRows,
    ['recipe_id', 'recipe_name', 'status', 'ingredients_counted', 'ingredients_matched', 'match_rate_pct', 'open_review_items']
  );

  // ── Summary ──────────────────────────────────────────────────────────────

  const overallMatchRate = totalIngredients > 0 ? Math.round(totalMatched / totalIngredients * 100) : 0;
  const recipesByStatus  = recipes.reduce((acc: any, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  const recipesUnder50   = recipeRows.filter(r => (r[5] as number) < 50).length;
  const recipesUnder80   = recipeRows.filter(r => (r[5] as number) < 80).length;

  // Top-of-list previews
  const top10Unmatched = unmatchedSorted.slice(0, 10).map(u => ({ name: u.parsedName, recipes: u.recipeIds.size }));
  const top10CatMisses = catMissSorted.slice(0, 10).map(c => ({ name: c.parsedName, recipes: c.recipeIds.size }));
  const top10Diet      = dietSorted.slice(0, 10).map(d => ({ ingredient: d.ingredient, protocol: d.protocol, recipes: d.recipeIds.size }));

  const summary = {
    auditDate: new Date().toISOString(),
    totalRecipes: recipes.length,
    recipesByStatus,
    totalIngredientsScanned: totalIngredients,
    totalMatched,
    overallMatchRatePct: overallMatchRate,
    recipesWithMatchRateBelow50: recipesUnder50,
    recipesWithMatchRateBelow80: recipesUnder80,
    learnedAliasesLoaded: Object.keys(learnedAliases).length,
    uniqueUnmatchedIngredients: unmatchedSorted.length,
    uniqueCategoryMisses: catMissSorted.length,
    openDietUncertainties: dietSorted.reduce((sum, d) => sum + d.count, 0),
    top10Unmatched,
    top10CatMisses,
    top10Diet,
  };

  fs.writeFileSync(path.join(OUT_DIR, 'audit_summary.json'), JSON.stringify(summary, null, 2));

  // ── Console report ───────────────────────────────────────────────────────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  PIPELINE HEALTH AUDIT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Recipes scanned:           ${recipes.length}`);
  console.log(`  by status:               ${JSON.stringify(recipesByStatus)}`);
  console.log(`Ingredients scanned:       ${totalIngredients}`);
  console.log(`Overall match rate:        ${overallMatchRate}%`);
  console.log(`Recipes <50% matched:      ${recipesUnder50}`);
  console.log(`Recipes <80% matched:      ${recipesUnder80}`);
  console.log(`Unique unmatched names:    ${unmatchedSorted.length}`);
  console.log(`Unique category misses:    ${catMissSorted.length}`);
  console.log(`Open diet uncertainties:   ${dietSorted.reduce((s, d) => s + d.count, 0)}`);
  console.log('');
  console.log('TOP 10 UNMATCHED INGREDIENTS (by recipes affected):');
  top10Unmatched.forEach((u, i) => console.log(`  ${String(i + 1).padStart(2)}. ${u.name.padEnd(40)} ${u.recipes} recipes`));
  console.log('');
  console.log('TOP 10 SHOPPING-CATEGORY MISSES:');
  top10CatMisses.forEach((c, i) => console.log(`  ${String(i + 1).padStart(2)}. ${c.name.padEnd(40)} ${c.recipes} recipes`));
  console.log('');
  console.log('TOP 10 DIET UNCERTAINTIES:');
  top10Diet.forEach((d, i) => console.log(`  ${String(i + 1).padStart(2)}. ${`${d.ingredient} (${d.protocol})`.padEnd(40)} ${d.recipes} recipes`));
  console.log('');
  console.log('Files written to data/:');
  console.log('  • audit_unmatched_ingredients.csv');
  console.log('  • audit_category_misses.csv');
  console.log('  • audit_diet_uncertainties.csv');
  console.log('  • audit_low_matchrate_recipes.csv');
  console.log('  • audit_summary.json');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(err => { console.error(err); process.exit(1); });
