/**
 * Dry-run nutrition computation on a few recipes — prints per-ingredient + per-serving totals
 * WITHOUT writing to Firestore. Used to sanity-check the pipeline before a full build.
 *
 * Usage:
 *   npx tsx scripts/_spot_check_nutrition.ts <recipe_id> [<recipe_id> ...]
 *   npx tsx scripts/_spot_check_nutrition.ts --sample   (picks 5 varied recipes)
 */
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import { parseIngredient, splitIngredientLine } from '../ckc-consumer-app/lib/ingredientParser';

const sa = require(path.join(__dirname, '../service-account.json'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const INGREDIENT_DB = path.join(__dirname, '../data/ingredientNutrition_v2.json');
const SERVINGS_PROG = path.join(__dirname, '../data/servings_progress.json');

const ingDB = JSON.parse(fs.readFileSync(INGREDIENT_DB, 'utf8'));
const servingsProg = fs.existsSync(SERVINGS_PROG) ? JSON.parse(fs.readFileSync(SERVINGS_PROG, 'utf8')) : {};

// ── Same helpers as build_recipe_nutrition_v2.ts (simplified) ───────────────
const FORM_MODIFIERS: RegExp[] = [
  /\bcanned\b/g, /\bjarred\b/g, /\bcan\b/g, /\bjar\b/g,
  /\bbone[\s-]?in\b/g, /\bboneless\b/g, /\bskin[\s-]?on\b/g, /\bskinless\b/g,
  /\bfull[\s-]?fat\b/g, /\blow[\s-]?fat\b/g, /\bnonfat\b/g, /\bwhole[\s-]?milk\b/g,
  /\bfresh\b/g, /\b\d+%?\s*lean\b/g,
];
const HARDCODED: Record<string,string> = {
  'garlic clove':'garlic','garlic cloves':'garlic',
  'yellow onion':'onion','white onion':'onion','roma tomato':'tomato',
  'heavy cream':'whipping cream','vegetable oil':'neutral cooking oil',
  'extra-virgin olive oil':'olive oil','extra virgin olive oil':'olive oil',
  'chicken stock':'chicken broth','vegetable stock':'vegetable broth','beef stock':'beef broth',
  'parmesan':'parmesan cheese','feta':'feta cheese',
};

function stripFormModifiers(name: string): string {
  let s = name.toLowerCase().replace(/\([^)]*\)/g, '');
  for (const re of FORM_MODIFIERS) s = s.replace(re, '');
  return s.replace(/\s+/g, ' ').trim();
}

function lookupIngredient(name: string): { entry: any; key: string } {
  const lower = name.toLowerCase().trim();
  if (ingDB[lower]) return { entry: ingDB[lower], key: lower };
  if (HARDCODED[lower] && ingDB[HARDCODED[lower]]) return { entry: ingDB[HARDCODED[lower]], key: HARDCODED[lower] };
  if (lower.endsWith('s') && ingDB[lower.slice(0, -1)]) return { entry: ingDB[lower.slice(0, -1)], key: lower.slice(0, -1) };
  const stripped = stripFormModifiers(lower);
  if (stripped !== lower && ingDB[stripped]) return { entry: ingDB[stripped], key: stripped };
  return { entry: null, key: '' };
}

function toGrams(qty: number, unit: string, entry: any): number {
  if (!qty) return 0;
  const u = (unit || '').toLowerCase().trim();
  if (!u || u === 'gram' || u === 'grams' || u === 'g') return qty;
  if (u === 'kg' || u === 'kilogram') return qty * 1000;
  if (u === 'oz' || u === 'ounce' || u === 'ounces') return qty * 28.35;
  if (u === 'lb' || u === 'lbs' || u === 'pound' || u === 'pounds') return qty * 453.59;
  if (u === 'ml' || u === 'milliliter') return qty;
  if (u === 'l' || u === 'liter') return qty * 1000;
  // Look up unit in entry's measures
  if (entry?.measures) {
    for (const m of entry.measures) {
      if (m.label && m.label.toLowerCase() === u) return qty * m.gramWeight;
      if (m.label && m.label.toLowerCase() + 's' === u) return qty * m.gramWeight;
    }
    // Common unit aliases
    const unitMap: Record<string,string> = {
      'tbsp':'tablespoon','tablespoons':'tablespoon','tablespoon':'tablespoon',
      'tsp':'teaspoon','teaspoons':'teaspoon','teaspoon':'teaspoon',
      'cups':'cup','cup':'cup','clove':'clove','cloves':'clove','head':'head','heads':'head',
      'sprig':'sprig','sprigs':'sprig','stalk':'stalk','stalks':'stalk',
    };
    const mapped = unitMap[u];
    if (mapped) {
      for (const m of entry.measures) {
        if (m.label && m.label.toLowerCase() === mapped) return qty * m.gramWeight;
      }
    }
  }
  // No unit + integer qty: assume "Whole" or "Serving"
  if (entry?.measures && (!u || u === '')) {
    const whole = entry.measures.find((m: any) => m.label === 'Whole');
    const serving = entry.measures.find((m: any) => m.label === 'Serving');
    if (whole) return qty * whole.gramWeight;
    if (serving) return qty * serving.gramWeight;
  }
  return 0;
}

function calculateNutrition(grams: number, entry: any): any {
  if (!grams || !entry?.per100g) return null;
  const f = grams / 100;
  const out: any = {};
  for (const [k, v] of Object.entries(entry.per100g)) {
    if (v && typeof v === 'object' && 'value' in (v as any)) {
      out[k] = +((v as any).value * f).toFixed(2);
    }
  }
  return out;
}

async function spotCheck(id: string) {
  const doc = await db.collection('recipes').doc(id).get();
  if (!doc.exists) { console.log(`❌ ${id}: not found\n`); return; }
  const r = doc.data()!;
  const servings = servingsProg[id]?.servings || r.servings || 4;
  console.log(`\n${'═'.repeat(80)}\n📋 ${r.name}\n   id: ${id}   servings: ${servings}\n${'═'.repeat(80)}`);

  const splits: string[] = [];
  for (const raw of r.ingredients) {
    if (!raw?.trim()) continue;
    for (const part of splitIngredientLine(raw)) splits.push(part);
  }

  const totals = { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sodium: 0 };
  let matched = 0, total = 0, hasGrams = 0;

  for (const raw of splits) {
    if (!raw?.trim()) continue;
    total++;
    const parsed = parseIngredient(raw);
    if (!parsed.name) {
      console.log(`  ○ skipped: "${raw.slice(0, 70)}"`);
      continue;
    }
    const { entry, key } = lookupIngredient(parsed.name);
    if (!entry) {
      console.log(`  ✗ unmatched: "${raw.slice(0, 60)}" → "${parsed.name}"`);
      continue;
    }
    matched++;
    const grams = toGrams(parsed.qty, parsed.unit, entry);
    const nut = calculateNutrition(grams, entry);
    if (grams > 0 && nut) {
      hasGrams++;
      totals.calories += nut.calories || 0;
      totals.protein  += nut.protein  || 0;
      totals.fat      += nut.fat      || 0;
      totals.carbs    += nut.carbs    || 0;
      totals.fiber    += nut.fiber    || 0;
      totals.sodium   += nut.sodium   || 0;
    }
    const gStr = grams > 0 ? `${grams.toFixed(0)}g` : '?g';
    const calStr = nut?.calories ? `${nut.calories.toFixed(0)} kcal` : '—';
    console.log(`  ✓ ${parsed.qty || ''} ${parsed.unit || ''} ${parsed.name.padEnd(35).slice(0,35)} [${key}] → ${gStr.padStart(7)} | ${calStr.padStart(10)}`);
  }

  const perServing = {
    calories: totals.calories / servings,
    protein: totals.protein / servings,
    fat: totals.fat / servings,
    carbs: totals.carbs / servings,
    fiber: totals.fiber / servings,
    sodium: totals.sodium / servings,
  };

  console.log(`\n  Coverage: ${matched}/${total} matched (${((matched/total)*100).toFixed(0)}%)  •  ${hasGrams} with grams resolved`);
  console.log(`  Whole-recipe totals:  ${totals.calories.toFixed(0)} kcal  ${totals.protein.toFixed(1)}g protein  ${totals.fat.toFixed(1)}g fat  ${totals.carbs.toFixed(1)}g carbs`);
  console.log(`  Per serving (÷${servings}):    ${perServing.calories.toFixed(0)} kcal  ${perServing.protein.toFixed(1)}g protein  ${perServing.fat.toFixed(1)}g fat  ${perServing.carbs.toFixed(1)}g carbs  ${perServing.fiber.toFixed(1)}g fiber  ${perServing.sodium.toFixed(0)}mg sodium`);
}

(async () => {
  const args = process.argv.slice(2);
  let ids: string[] = [];
  if (args[0] === '--sample') {
    ids = [
      'bbq-chicken-bowls',                                // had scant bug (now fixed)
      'pages-recipes-grilled-salmon-pine-nut-salsa',      // 79% → 100%
      'easy-chicken-enchiladas',                           // garnishes + servings=8
      'goodbye-meatballs',                                 // smushed paragraph (fixed)
    ];
    // Pick 1 random recipe with high ingredient count for variety
    const snap = await db.collection('recipes').where('status', '==', 'approved').limit(1).get();
    snap.forEach(d => ids.push(d.id));
  } else if (args.length) {
    ids = args;
  } else {
    console.error('Usage: _spot_check_nutrition <id> [...] | --sample');
    process.exit(1);
  }
  for (const id of ids) await spotCheck(id);
  process.exit(0);
})();
