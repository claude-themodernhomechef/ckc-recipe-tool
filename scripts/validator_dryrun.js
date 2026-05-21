/**
 * validator_dryrun.js — Shows what Option A would do.
 *
 * For a sample of recipes, runs the validator over their existing
 * dietTags.{code}.notes, prints kept vs dropped pairs side by side.
 * No writes.
 */

const admin = require('firebase-admin');
const fs    = require('fs');
const path  = require('path');

const SA = require(path.join(__dirname, '../service-account.json'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(SA) });
const db = admin.firestore();

const ingDBNames = JSON.parse(fs.readFileSync(path.join(__dirname, '../ckc-consumer-app/data/ingredientDBNames.json'), 'utf8'));
const masterSwap = JSON.parse(fs.readFileSync(path.join(__dirname, '../ckc-consumer-app/data/masterSwapTable.json'), 'utf8'));
const learned    = JSON.parse(fs.readFileSync(path.join(__dirname, '../ckc-consumer-app/data/learnedSwapTable.json'), 'utf8'));

const KNOWN = new Set();
for (const k of Object.keys(ingDBNames)) for (const w of k.split(/\s+/)) if (w.length > 2) KNOWN.add(w);
for (const entry of Object.values(masterSwap)) {
  for (const v of Object.values(entry)) {
    if (v && v.to) for (const w of String(v.to).toLowerCase().split(/\s+/)) if (w.length > 2) KNOWN.add(w);
  }
}
const JUNK_TO_RE = /^(dairy|lactose|already|gf|df|the same|none|n\/a|tbd|see notes?|same|other|maple syrup|vegan|vegetarian)$/i;
const JUNK_TO_PREFIX_RE = /^(already|the same|see |refer )/i;
// Category words that are NOT real swap targets when standing alone (even with a qty).
// "lactose" or "dairy" by itself means nothing — the swap should be a specific
// ingredient like "lactose-free milk" or "coconut milk".
const CATEGORY_WORDS = new Set(['dairy', 'lactose', 'gluten', 'wheat', 'soy', 'nightshade', 'fodmap', 'histamine']);
function isValidTo(to) {
  if (!to) return false;
  const t = String(to).toLowerCase().trim();
  if (!t || JUNK_TO_RE.test(t) || JUNK_TO_PREFIX_RE.test(t)) return false;
  if (/^(replace|remove|skip|omit)\b/.test(t)) return false;
  // Strip leading qty/unit and check remaining content words
  const contentTokens = t
    .replace(/^[\d\s/.½¼¾⅓⅔⅛⅜⅝⅞]+\s*(cups?|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|lb|pounds?|g|grams?|ml|cloves?|pieces?|slices?|sprigs?|cans?|jars?)?\s+(?:of\s+)?/i, '')
    .split(/\s+/)
    .filter(w => w.length > 2);
  if (contentTokens.length === 0) return false;
  // If the only "ingredient-like" tokens are bare category words, reject.
  const nonCategory = contentTokens.filter(w => !CATEGORY_WORDS.has(w));
  if (nonCategory.length === 0) return false;
  return contentTokens.some(w => KNOWN.has(w));
}
function fromInRecipe(from, ingredients) {
  if (!from) return false;
  const norm = s => String(s).toLowerCase()
    .replace(/[‘’‚‛]/g, "'").replace(/[“”„‟]/g, '"').replace(/[–—]/g, '-')
    .replace(/[,;()'"]/g, ' ').replace(/\s+/g, ' ').trim();
  const fNorm = norm(from);
  const ings  = ingredients.map(norm);
  if (ings.some(i => i.includes(fNorm))) return true;
  const fWords = fNorm.split(' ').filter(w => w.length > 3);
  return fWords.length > 0 && ings.some(i => fWords.every(w => i.includes(w)));
}

function lookupCanonical(from, protocol) {
  if (!from) return null;
  const lower = String(from).toLowerCase()
    .replace(/^[\d\s/.½¼¾⅓⅔⅛⅜⅝⅞]+\s*(cups?|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|lb|pounds?|g|grams?|ml|cloves?|pieces?|slices?|sprigs?|cans?|jars?)?\s+(?:of\s+)?/i, '')
    .replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = lower.split(/\s+/);
  const candidates = [lower, words.slice(-2).join(' '), words[words.length - 1], words[0]]
    .filter((v, i, a) => v && a.indexOf(v) === i);
  for (const c of candidates) {
    const e = masterSwap[c];
    if (e && e[protocol]) return e[protocol];
  }
  return null;
}

(async () => {
  const snap = await db.collection('recipes').get();
  let totalRecipes = 0, recipesAffected = 0;
  let totalPairs = 0, totalReplaced = 0, totalDropped = 0;
  const dropReasons = { no_from: 0, from_not_in_recipe: 0, junk_to_no_canonical: 0 };
  const replaceSamples = [];
  const dropSamples = [];

  snap.forEach(doc => {
    totalRecipes++;
    const data = doc.data();
    const ings = data.ingredients || [];
    let recipeAffected = false;

    for (const [code, t] of Object.entries(data.dietTags || {})) {
      if (!Array.isArray(t.notes) || t.notes.length === 0) continue;
      for (const pair of t.notes) {
        totalPairs++;
        if (!pair?.from) { dropReasons.no_from++; totalDropped++; recipeAffected = true; continue; }
        if (!fromInRecipe(pair.from, ings)) {
          dropReasons.from_not_in_recipe++; totalDropped++; recipeAffected = true;
          if (dropSamples.length < 6) dropSamples.push({ recipe: data.name, code, reason: 'from_not_in_recipe', pair });
          continue;
        }
        if (pair.type === 'remove' || pair.type === 'note') continue;
        if (!isValidTo(pair.to)) {
          const canon = lookupCanonical(pair.from, code);
          if (canon) {
            totalReplaced++; recipeAffected = true;
            if (replaceSamples.length < 10) {
              replaceSamples.push({ recipe: data.name, code, from: pair.from, oldTo: pair.to, newTo: canon.to ?? canon.note ?? '(remove)', kind: canon.type });
            }
          } else {
            dropReasons.junk_to_no_canonical++; totalDropped++; recipeAffected = true;
            if (dropSamples.length < 6) dropSamples.push({ recipe: data.name, code, reason: 'junk_to_no_canonical', pair });
          }
        }
      }
    }
    if (recipeAffected) recipesAffected++;
  });

  console.log(`\n━━━ Validator dry-run across ALL recipes ━━━\n`);
  console.log(`Total recipes scanned:           ${totalRecipes}`);
  console.log(`  Would be affected by Option A: ${recipesAffected}\n`);
  console.log(`Pairs evaluated:    ${totalPairs}`);
  console.log(`  ✏️  REPLACED (junk→canonical):  ${totalReplaced}`);
  console.log(`  ❌ Dropped (no canonical):     ${totalDropped}`);
  console.log(`     from_not_in_recipe:         ${dropReasons.from_not_in_recipe}`);
  console.log(`     junk_to_no_canonical:       ${dropReasons.junk_to_no_canonical}`);
  console.log(`     no_from:                    ${dropReasons.no_from}\n`);

  console.log(`Sample REPLACEMENTS:`);
  for (const s of replaceSamples) {
    console.log(`  ${s.recipe.slice(0, 45)} | ${s.code}:  "${s.from}"`);
    console.log(`     was→ ${s.oldTo}`);
    console.log(`     now→ ${s.newTo}  [${s.kind}]`);
  }
  console.log(`\nSample DROPS (still no canonical):`);
  for (const s of dropSamples) {
    const desc = s.pair.type === 'remove' ? `remove ${s.pair.from}` : `${s.pair.from} → ${s.pair.to}`;
    console.log(`  ${s.recipe.slice(0, 45)} | ${s.code} [${s.reason}]: ${desc}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
