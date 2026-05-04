/**
 * compute_bydiet_nutrition.js
 *
 * Computes nutrition.byDiet for each mod diet tag on a recipe using
 * the local ingredient DB — no external API calls.
 *
 * Reads:  Firestore recipes (approved by default, or pass --all)
 *         data/ingredientNutrition_v2.json
 * Writes: nutrition.byDiet back to each recipe doc in Firestore
 *
 * Usage:
 *   node scripts/compute_bydiet_nutrition.js          # approved only
 *   node scripts/compute_bydiet_nutrition.js --all    # all needs_review + approved
 */

const admin = require('firebase-admin');
const fs    = require('fs');
const path  = require('path');

const SA_PATH   = path.join(__dirname, '../service-account.json');
const ING_DB    = path.join(__dirname, '../data/ingredientNutrition_v2.json');
const SWAP_PATH = path.join(__dirname, '../data/masterSwapTable.json');

const sa       = require(SA_PATH);
const swapTable = JSON.parse(fs.readFileSync(SWAP_PATH, 'utf8'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

// Returns the nutrition DB key to use for a swap target.
// Checks masterSwapTable for an explicit nutritionKey first, then falls back to the to field.
function resolveNutritionKey(ingredientName, dietCode) {
  const entry = swapTable[ingredientName.toLowerCase().trim()];
  if (!entry || !entry[dietCode]) return null;
  const swap = entry[dietCode];
  if (swap.type === 'remove') return null;
  return swap.nutritionKey || swap.to || null;
}

// ── Swap note parser (mirrors ReviewQueueScreen parseSwapPairs) ───────────────

function extractLeadingQty(s) {
  const m = s.match(/^(\d[\d/.\s]*(?:tablespoons?|teaspoons?|cups?|tbsp|tsp|oz|lb|g|ml)\s+)/i);
  return m ? m[1] : '';
}
function stripLeadingQty(s) {
  return s
    .replace(/^[\d/.\s]+(?:tablespoons?|teaspoons?|cups?|tbsp|tsp|oz|lb|g\b|ml)\s*(of\s+)?/i, '')
    .replace(/^\d[\d/.\s]*\s+/, '')    // strip bare numbers: "4 garlic" → "garlic"
    .replace(/^(the|a|an)\s+/i, '')   // strip articles: "the shallot" → "shallot"
    .trim();
}

// pickBestOption — when a chef offers multiple swap options ("X, or Y"),
// pick the one closest in form to the original ingredient.
// Example: from="butter", optionStr="olive oil for cooking, or DF butter for finishing"
//   → picks "DF butter for finishing" because it contains the word "butter"
function pickBestOption(from, optionStr) {
  if (!/\bor\b/i.test(optionStr)) return optionStr;
  const options = optionStr.split(/\s*,?\s+or\s+/i).map(s => s.trim()).filter(Boolean);
  if (options.length <= 1) return optionStr;
  const fromLower = from.toLowerCase().trim();
  const fromWords = fromLower.split(/\s+/).filter(w => w.length > 2);
  let best = options[0];
  let bestScore = -Infinity;
  for (const opt of options) {
    const optLower = opt.toLowerCase();
    let score = 0;
    if (optLower.includes(fromLower)) score += 100;
    const optWords = optLower.split(/\s+/);
    score += fromWords.filter(w => optWords.includes(w)).length * 10;
    score -= opt.length * 0.01;
    if (score > bestScore) { bestScore = score; best = opt; }
  }
  return best;
}

// cleanSwapTarget — strip cooking-purpose suffixes from a swap target so
// "DF butter for finishing" → "DF butter", "tofu (cut to match)" → "tofu".
function cleanSwapTarget(s) {
  return s
    .replace(/\s+for\s+(?:cooking|saut[eé]ing|finishing|baking|frying|searing|garnish|serving|spritzing|drizzling|sprinkling|dipping|topping|brushing)(?:\s*\/\s*\w+)*\b[\s\w/]*$/i, '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/[,;]+\s*$/, '')
    .trim();
}

function parseSwapPairs(notes) {
  const result = [];
  const s = notes.toLowerCase();
  const stopStr = `(?:[,.\\u2013\\u2014]|\\s+[—–]|$)`;
  let m;

  const insteadRe = new RegExp(`use\\s+([^.]+?)\\s+instead\\s+of\\s+([^.]+?)${stopStr}`, 'gi');
  while ((m = insteadRe.exec(s)) !== null) {
    const rawFrom = m[2].trim();
    const fromName = stripLeadingQty(rawFrom);
    const rawTo = m[1].trim();
    const qty = extractLeadingQty(rawFrom);
    const picked = cleanSwapTarget(pickBestOption(fromName, rawTo));
    const finalTo = (qty && !extractLeadingQty(picked)) ? `${qty} ${picked}` : picked;
    result.push({ from: fromName, to: finalTo });
  }

  const replaceRe = new RegExp(`replace\\s+([^.]+?)\\s+with\\s+([^.]+?)${stopStr}`, 'gi');
  while ((m = replaceRe.exec(s)) !== null) {
    const rawTo = m[2].trim().replace(/\s+[—–].*$/, '').trim();
    const toHasQty = extractLeadingQty(rawTo) !== '';
    m[1].split(/\s+and\s+/i).forEach(f => {
      const cleaned = f.trim()
        .replace(/\s*\([^)]*\)/g, '')
        .replace(/\s+(do\s+not|but\s+not|except|however|–|—|\bdo\b).*/i, '')
        .trim();
      const rawFrom = cleaned;
      const fromName = stripLeadingQty(rawFrom);
      const qty = extractLeadingQty(rawFrom);
      const picked = cleanSwapTarget(pickBestOption(fromName, rawTo));
      const finalTo = (qty && !toHasQty) ? `${qty} ${picked}` : picked;
      result.push({ from: fromName, to: finalTo });
    });
  }

  const removeRe = /remove\s+([^,.\n—–\u2013\u2014]+)/gi;
  while ((m = removeRe.exec(s)) !== null)
    m[1].split(/\s+and\s+/i).forEach(f => { const c = stripLeadingQty(f.trim()); if (c) result.push({ from: c, to: null }); });

  const skipRe = /(?:skip|omit)\s+([^,.\n—–\u2013\u2014]+)/gi;
  while ((m = skipRe.exec(s)) !== null)
    result.push({ from: stripLeadingQty(m[1].split(',')[0].trim()), to: null });

  // "X: swap text" format produced by rules-based regen (regen_diet_tags.js).
  // Example: "Sour cream: Use plain coconut yogurt or DF sour cream. Cheddar:
  // Use DF cheddar alternative."  Each sentence "X: <text>" yields one swap.
  notes.split(/\.\s+/).forEach(sentence => {
    const colonMatch = sentence.match(/^\s*([a-z][a-z\s-]+?):\s+(.+)$/i);
    if (!colonMatch) return;
    const from = colonMatch[1].trim().toLowerCase();
    const swapText = colonMatch[2].trim();
    if (/^(replace|remove|skip|omit|use)\s/i.test(from)) return;
    if (/^remove\b/i.test(swapText)) {
      result.push({ from, to: null });
      return;
    }
    const useMatch = swapText.match(/^use\s+(.+?)(?:\.|$)/i);
    if (useMatch) {
      const rawTo = useMatch[1].trim().replace(/\s+if\s+.+$/i, '');
      const picked = cleanSwapTarget(pickBestOption(from, rawTo));
      if (picked) result.push({ from, to: picked });
      return;
    }
    const replaceMatch = swapText.match(/^replace\s+(?:.+?\s+)?with\s+(.+?)(?:\.|$)/i);
    if (replaceMatch) {
      const picked = cleanSwapTarget(pickBestOption(from, replaceMatch[1].trim()));
      result.push({ from, to: picked });
      return;
    }
  });

  return result;
}

// ── Fuzzy ingredient name match ───────────────────────────────────────────────

function fuzzyMatch(term, name) {
  const clean = x => x.toLowerCase()
    .replace(/[,;]/g, ' ')
    .replace(/\b(freshly\s+ground|cloves?|heads?|tbsp\s+of|tsp\s+of|cups?\s+of|\bof\b|black|white|ground|freshly|kosher|sea|fine|coarse|cracked)\b/g, '')
    .replace(/\b(extra\s+firm|firm|silken|soft|hard|large|small|medium|big|fat|thick|thin|fresh|dried|frozen|raw|cooked|whole|boneless|skinless|lean|ripe|young|baby)\b/g, '')
    .replace(/\b(diced|sliced|chopped|minced|grated|crushed|halved|quartered|peeled|seeded|cubed|shredded|julienned|torn)\b/g, '')
    .replace(/\s+/g, ' ').trim();
  const b = clean(name);
  const nosp = x => x.replace(/\s+/g, '');

  // Handle "X/Y" alternatives in swap notes — try each variant separately
  const variants = term.split('/').map(v => clean(v.trim())).filter(Boolean);
  for (const a of variants) {
    if (a === b || nosp(a) === nosp(b)) return true;
    const aWords = a.split(' ').filter(w => w.length > 2);
    if (aWords.length > 0 && aWords.every(w => b.includes(w))) return true;
    const bWords = b.split(' ').filter(w => w.length > 2);
    if (bWords.length > 0 && bWords.every(w => a.includes(w))) return true;
  }
  return false;
}

// ── Clean ingredient name for display ────────────────────────────────────────
function cleanIngName(name) {
  return name
    .replace(/\b(extra\s+firm|firm|silken|soft|hard|large|small|medium|big|fat|thick|thin|fresh|dried|frozen|raw|cooked|whole|boneless|skinless|bone-?in|skin-?on|lean|ripe|young|baby)\b/gi, '')
    .replace(/\b(diced|sliced|chopped|minced|grated|crushed|halved|quartered|peeled|seeded|cubed|shredded)\b/gi, '')
    .replace(/\s+/g, ' ').trim();
}

// ── Ingredient DB lookup ──────────────────────────────────────────────────────

function lookupIngredient(name, ingDB) {
  const lower = name.toLowerCase().trim()
    .replace(/\s*\([^)]*\)/g, '')  // strip parentheticals: "garlic-infused oil (reduce...)" → "garlic-infused oil"
    .replace(/\s+/g, ' ').trim();
  if (ingDB[lower]) return ingDB[lower];

  // Strip prep instructions, size/texture descriptors, and filler words
  const cleaned = lower
    .replace(/\bcut\s+into\b.*$/i, '')
    .replace(/\b(extra\s+firm|firm|silken|soft|hard|large|small|medium|big|fat|thick|thin|fresh|dried|frozen|raw|cooked|whole|boneless|skinless|bone-?in|skin-?on|lean|ripe|young|baby)\b/g, '')
    .replace(/\b(diced|sliced|chopped|minced|grated|crushed|halved|quartered|peeled|seeded|cubed|shredded|crumbled|julienned|torn)\b/g, '')
    .replace(/\b(for|the|and|with|from|into|about|approx)\b/g, '')
    .replace(/\s+/g, ' ').trim();

  if (ingDB[cleaned]) return ingDB[cleaned];

  // Word match on cleaned name (words > 3 chars)
  const words = cleaned.split(' ').filter(w => w.length > 3);
  if (words.length > 0) {
    const match = Object.keys(ingDB).find(k => words.every(w => k.includes(w)));
    if (match) return ingDB[match];
  }

  // Last resort: try matching on just the first 1-2 meaningful words
  const shortWords = cleaned.split(' ').filter(w => w.length > 3).slice(0, 2);
  if (shortWords.length > 0) {
    const match = Object.keys(ingDB).find(k => shortWords.every(w => k.includes(w)));
    if (match) return ingDB[match];
  }

  return null;
}

// ── Nutrition helpers ─────────────────────────────────────────────────────────

function getPer100gVal(per100g, key) {
  const v = per100g[key];
  if (v == null) return 0;
  return typeof v === 'object' ? (v.value ?? 0) : v;
}

function calcNutrition(grams, ingEntry) {
  if (!grams || !ingEntry?.per100g) return null;
  const result = {};
  for (const [k, raw] of Object.entries(ingEntry.per100g)) {
    const val = typeof raw === 'object' ? (raw.value ?? 0) : raw;
    result[k] = Math.round((val * grams / 100) * 100) / 100;
  }
  return result;
}

function divideByServings(total, servings) {
  const srv = parseFloat(String(servings)) || 1;
  return Object.fromEntries(
    Object.entries(total).map(([k, v]) => [k, Math.round((Math.max(0, v) / srv) * 100) / 100])
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const runAll = process.argv.includes('--all');
  const ingDB  = JSON.parse(fs.readFileSync(ING_DB, 'utf8'));

  const statuses = runAll ? ['approved', 'needs_review', 'yes'] : ['approved'];
  console.log(`Fetching recipes with status: ${statuses.join(', ')}...`);

  const snap = await db.collection('recipes')
    .where('status', 'in', statuses)
    .get();

  const recipes = [];
  snap.forEach(doc => {
    const d = doc.data();
    const hasMod = d.dietTags && Object.values(d.dietTags).some(t => {
      if (!t.mod) return false;
      const text = Array.isArray(t.notes) ? (t.notesText ?? '') : (typeof t.notes === 'string' ? t.notes : '');
      return text.trim().length > 0;
    });
    if (hasMod && d.nutrition?.total && d.nutrition?.ingredients) {
      recipes.push({ id: doc.id, name: d.name, dietTags: d.dietTags, nutrition: d.nutrition });
    }
  });

  console.log(`${snap.size} total recipes fetched — ${recipes.length} have mod diet tags + nutrition data\n`);

  let updated = 0, skipped = 0;

  for (const recipe of recipes) {
    const byDiet = {};
    const servings = recipe.nutrition.servings ?? 1;
    const baseTotal = recipe.nutrition.total;
    const ings = recipe.nutrition.ingredients ?? [];

    for (const [dietCode, tagData] of Object.entries(recipe.dietTags)) {
      if (!tagData.mod) continue;
      // New format stores the string in notesText; legacy format stores it in notes
      const notesText = Array.isArray(tagData.notes)
        ? (tagData.notesText ?? '')
        : (typeof tagData.notes === 'string' ? tagData.notes : '');
      if (!notesText.trim()) continue;

      const rawPairs = parseSwapPairs(notesText);
      if (!rawPairs.length) continue;
      // De-duplicate: multiple swap notes for the same ingredient (e.g. "3 tbsp butter" and
      // "1 tbsp butter" both reduce to from="butter" after stripping quantities). Keep only one.
      const seen = new Set();
      const pairs = rawPairs.filter(p => {
        const key = `${p.from}|||${p.to ?? '__remove__'}`;
        if (seen.has(key)) return false;
        seen.add(key); return true;
      });

      // Compute base garnish total from garnish-flagged items (main ingredients
      // are already excluded from baseTotal in build_recipe_nutrition_v2).
      const baseGarnishTotal = {};
      for (const i of ings) {
        if (i.skip || !i.matched || !i.grams || !i.garnish) continue;
        const entry = lookupIngredient(i.name, ingDB);
        if (!entry) continue;
        const nutr = calcNutrition(i.grams, entry);
        if (!nutr) continue;
        for (const [k, v] of Object.entries(nutr))
          baseGarnishTotal[k] = Math.round(((baseGarnishTotal[k] ?? 0) + v) * 100) / 100;
      }

      const workingMain    = { ...baseTotal };
      const workingGarnish = { ...baseGarnishTotal };
      const swapLog        = [];   // main-ingredient swap log
      const garnishSwapLog = [];   // garnish swap log
      const swappedIngIndices = new Set();

      // Track per-garnish swap details so the UI can show diet-aware
      // "How we calculated garnish nutrition" rows (e.g. naan → GF naan
      // with adjusted kcal/protein/carbs/fat per serving).
      const garnishOverrides = new Map(); // ingredient idx → { name, grams, qty, unit, nutrition, removed }

      for (const { from, to } of pairs) {
        // Match against ALL ingredients (main + garnish), then route adjustments
        // to the correct working total based on each match's garnish flag.
        const origIngs = ings.filter((i, idx) =>
          !i.skip && i.matched && i.grams > 0 &&
          !swappedIngIndices.has(idx) &&
          fuzzyMatch(from, i.name)
        );
        if (!origIngs.length) continue;
        origIngs.forEach(i => swappedIngIndices.add(ings.indexOf(i)));
        const displayName = cleanIngName(origIngs[0].name);

        // Group matches by main vs garnish so each adjustment hits the right total
        const mainMatches    = origIngs.filter(i => !i.garnish);
        const garnishMatches = origIngs.filter(i =>  i.garnish);

        if (to === null) {
          // REMOVE
          const applyRemove = (matches, working, log) => {
            if (!matches.length) return;
            let totalCal = 0, anyInDB = false;
            for (const ing of matches) {
              const entry = lookupIngredient(ing.name, ingDB);
              if (!entry) continue;
              const nutr = calcNutrition(ing.grams, entry);
              if (!nutr) continue;
              for (const [k, v] of Object.entries(nutr))
                working[k] = Math.round(((working[k] ?? 0) - v) * 100) / 100;
              totalCal += nutr.calories ?? 0;
              anyInDB = true;
            }
            log.push(anyInDB
              ? `Removed ${displayName} (−${Math.round(totalCal)} cal)`
              : `Removed ${displayName} (not in DB)`);
          };
          applyRemove(mainMatches,    workingMain,    swapLog);
          applyRemove(garnishMatches, workingGarnish, garnishSwapLog);
          // Track per-garnish removal for the UI
          for (const ing of garnishMatches) {
            garnishOverrides.set(ings.indexOf(ing), {
              name: ing.name, originalName: ing.name,
              qty: ing.qty, unit: ing.unit, grams: ing.grams,
              nutrition: null, removed: true,
            });
          }
          continue;
        }

        // REPLACE — resolve swap target
        const toName = to
          .replace(/^\d[\d/.\s]*\s*(tablespoons?|teaspoons?|cups?|tbsp|tsp|oz|lb|g\b|ml)\s*(of\s+)?/i, '')
          .trim();
        const toVariants = toName.split(/\s+or\s+|\s*\/\s*/);
        let swapEntry = null;
        for (const variant of toVariants) {
          swapEntry = lookupIngredient(variant.trim(), ingDB);
          if (swapEntry) break;
        }
        if (!swapEntry) {
          const fallbackKey = resolveNutritionKey(from, dietCode);
          if (fallbackKey) swapEntry = lookupIngredient(fallbackKey, ingDB);
        }
        if (!swapEntry) {
          if (mainMatches.length)    swapLog.push(`${displayName} → ${toName} (not in DB, kept original)`);
          if (garnishMatches.length) garnishSwapLog.push(`${displayName} → ${toName} (not in DB, kept original)`);
          continue;
        }

        const applyReplace = (matches, working, log) => {
          if (!matches.length) return;
          let totalDelta = 0;
          for (const ing of matches) {
            const origEntry = lookupIngredient(ing.name, ingDB);
            if (origEntry) {
              const origNutr = calcNutrition(ing.grams, origEntry);
              if (origNutr) {
                for (const [k, v] of Object.entries(origNutr))
                  working[k] = Math.round(((working[k] ?? 0) - v) * 100) / 100;
                totalDelta -= origNutr.calories ?? 0;
              }
            }
            const swapNutr = calcNutrition(ing.grams, swapEntry);
            if (swapNutr) {
              for (const [k, v] of Object.entries(swapNutr))
                working[k] = Math.round(((working[k] ?? 0) + v) * 100) / 100;
              totalDelta += swapNutr.calories ?? 0;
            }
          }
          const delta = Math.round(totalDelta);
          log.push(`${displayName} → ${toName} (${delta >= 0 ? '+' : ''}${delta} cal)`);
        };
        applyReplace(mainMatches,    workingMain,    swapLog);
        applyReplace(garnishMatches, workingGarnish, garnishSwapLog);
        // Track per-garnish replacement for the UI — name change + adjusted nutrition
        for (const ing of garnishMatches) {
          const swapNutr = swapEntry ? calcNutrition(ing.grams, swapEntry) : null;
          garnishOverrides.set(ings.indexOf(ing), {
            name: toName, originalName: ing.name,
            qty: ing.qty, unit: ing.unit, grams: ing.grams,
            nutrition: swapNutr, removed: false,
          });
        }
      }

      // ── Default-table fallback ────────────────────────────────────────────
      // After applying chef notes, fill gaps for ingredients not yet swapped
      // by consulting masterSwapTable. E.g. chef wrote "Rice: Use cauliflower
      // rice" for K but didn't address naan — defaults catch naan automatically.
      for (let idx = 0; idx < ings.length; idx++) {
        if (swappedIngIndices.has(idx)) continue;
        const ing = ings[idx];
        if (!ing || ing.skip || !ing.matched || !ing.grams) continue;
        const ingKey = (ing.name || '').toLowerCase().trim();
        const defaultEntry = swapTable[ingKey];
        const defaultSwap = defaultEntry?.[dietCode];
        if (!defaultSwap) continue;

        swappedIngIndices.add(idx);
        const displayName = cleanIngName(ing.name);
        const isGarnish = !!ing.garnish;
        const working = isGarnish ? workingGarnish : workingMain;
        const log = isGarnish ? garnishSwapLog : swapLog;

        if (defaultSwap.type === 'remove') {
          const entry = lookupIngredient(ing.name, ingDB);
          if (entry) {
            const nutr = calcNutrition(ing.grams, entry);
            if (nutr) {
              for (const [k, v] of Object.entries(nutr))
                working[k] = Math.round(((working[k] ?? 0) - v) * 100) / 100;
              log.push(`Removed ${displayName} (−${Math.round(nutr.calories ?? 0)} cal) [default]`);
            } else {
              log.push(`Removed ${displayName} (not in DB) [default]`);
            }
          }
          if (isGarnish) {
            garnishOverrides.set(idx, {
              name: ing.name, originalName: ing.name,
              qty: ing.qty, unit: ing.unit, grams: ing.grams,
              nutrition: null, removed: true,
            });
          }
          continue;
        }

        if (defaultSwap.type === 'replace' && defaultSwap.to) {
          const toName = defaultSwap.to;
          const toVariants = toName.split(/\s+or\s+|\s*\/\s*/);
          let swapEntry = null;
          for (const variant of toVariants) {
            swapEntry = lookupIngredient(variant.trim(), ingDB);
            if (swapEntry) break;
          }
          if (!swapEntry) {
            log.push(`${displayName} → ${toName} (not in DB, kept original) [default]`);
            continue;
          }
          const origEntry = lookupIngredient(ing.name, ingDB);
          let totalDelta = 0;
          if (origEntry) {
            const origNutr = calcNutrition(ing.grams, origEntry);
            if (origNutr) {
              for (const [k, v] of Object.entries(origNutr))
                working[k] = Math.round(((working[k] ?? 0) - v) * 100) / 100;
              totalDelta -= origNutr.calories ?? 0;
            }
          }
          const swapNutr = calcNutrition(ing.grams, swapEntry);
          if (swapNutr) {
            for (const [k, v] of Object.entries(swapNutr))
              working[k] = Math.round(((working[k] ?? 0) + v) * 100) / 100;
            totalDelta += swapNutr.calories ?? 0;
          }
          const delta = Math.round(totalDelta);
          log.push(`${displayName} → ${toName} (${delta >= 0 ? '+' : ''}${delta} cal) [default]`);
          if (isGarnish) {
            garnishOverrides.set(idx, {
              name: toName, originalName: ing.name,
              qty: ing.qty, unit: ing.unit, grams: ing.grams,
              nutrition: swapNutr, removed: false,
            });
          }
        }
      }

      // Build per-garnish item list: includes both swapped and unchanged
      // garnishes so the UI can render the full breakdown when this diet is active.
      const garnishItems = [];
      for (let idx = 0; idx < ings.length; idx++) {
        const ing = ings[idx];
        if (!ing || !ing.garnish || ing.skip) continue;
        const override = garnishOverrides.get(idx);
        if (override) {
          garnishItems.push(override);
        } else {
          // Unchanged garnish — keep original
          garnishItems.push({
            name: ing.name, originalName: ing.name,
            qty: ing.qty, unit: ing.unit, grams: ing.grams,
            nutrition: ing.nutrition || null, removed: false,
          });
        }
      }

      byDiet[dietCode] = {
        perServing:        divideByServings(workingMain,    servings),
        garnishPerServing: divideByServings(workingGarnish, servings),
        swapLog,
        garnishSwapLog,
        garnishItems,
      };
    }

    if (Object.keys(byDiet).length === 0) { skipped++; continue; }

    let writeOk = false;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        await db.collection('recipes').doc(recipe.id).update({ 'nutrition.byDiet': byDiet });
        writeOk = true; break;
      } catch (e) {
        if (attempt < 4) { await new Promise(r => setTimeout(r, attempt * 2000)); }
        else { console.error(`  ✗ write failed after 4 attempts for ${recipe.id}: ${e.message}`); }
      }
    }
    if (!writeOk) { skipped++; continue; }
    updated++;

    const dietList = Object.entries(byDiet)
      .map(([code, d]) => `${code}(${d.swapLog.length} swaps)`)
      .join(', ');
    console.log(`[${String(updated).padStart(3)}] ${(recipe.name || recipe.id).slice(0, 45).padEnd(45)} → ${dietList}`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('BYDIET NUTRITION COMPUTE');
  console.log(`  Updated:  ${updated}`);
  console.log(`  Skipped:  ${skipped} (no mod diets or no nutrition data)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
