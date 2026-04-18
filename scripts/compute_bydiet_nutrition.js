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

const SA_PATH  = path.join(__dirname, '../service-account.json');
const ING_DB   = path.join(__dirname, '../data/ingredientNutrition_v2.json');

const sa = require(SA_PATH);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

// ── Swap note parser (mirrors ReviewQueueScreen parseSwapPairs) ───────────────

function extractLeadingQty(s) {
  const m = s.match(/^(\d[\d/.\s]*(?:cup|tbsp|tsp|oz|lb|g|ml)s?\s+)/i);
  return m ? m[1] : '';
}
function stripLeadingQty(s) { return s.replace(/^[\d/.\s]+(?:cup|tbsp|tsp|oz|lb|g\b|ml)s?\s*/i, '').trim(); }

function parseSwapPairs(notes) {
  const result = [];
  const s = notes.toLowerCase();
  const stopStr = `(?:[,.\\u2013\\u2014]|\\s+[—–]|$)`;
  let m;

  const insteadRe = new RegExp(`use\\s+([^.]+?)\\s+instead\\s+of\\s+([^.]+?)${stopStr}`, 'gi');
  while ((m = insteadRe.exec(s)) !== null) {
    const rawFrom = m[2].trim(), rawTo = m[1].trim();
    const qty = extractLeadingQty(rawFrom);
    result.push({ from: stripLeadingQty(rawFrom), to: (qty && !extractLeadingQty(rawTo)) ? `${qty} ${rawTo}` : rawTo });
  }

  const replaceRe = new RegExp(`replace\\s+([^.]+?)\\s+with\\s+([^.]+?)${stopStr}`, 'gi');
  while ((m = replaceRe.exec(s)) !== null) {
    const rawTo = m[2].trim().replace(/\s+[—–].*$/, '').trim();
    const toHasQty = extractLeadingQty(rawTo) !== '';
    m[1].split(/\s+and\s+/i).forEach(f => {
      // Strip editorial commentary after the ingredient name
      const cleaned = f.trim()
        .replace(/\s*\([^)]*\)/g, '')                                      // strip (parentheticals)
        .replace(/\s+(do\s+not|but\s+not|except|however|–|—|\bdo\b).*/i, '') // strip "do not sub..." etc
        .trim();
      const rawFrom = cleaned;
      const qty = extractLeadingQty(rawFrom);
      result.push({ from: stripLeadingQty(rawFrom), to: (qty && !toHasQty) ? `${qty} ${rawTo}` : rawTo });
    });
  }

  const removeRe = /remove\s+([^,.\n—–\u2013\u2014]+)/gi;
  while ((m = removeRe.exec(s)) !== null)
    m[1].split(/\s+and\s+/i).forEach(f => { const c = stripLeadingQty(f.trim()); if (c) result.push({ from: c, to: null }); });

  const skipRe = /(?:skip|omit)\s+([^,.\n—–\u2013\u2014]+)/gi;
  while ((m = skipRe.exec(s)) !== null)
    result.push({ from: stripLeadingQty(m[1].split(',')[0].trim()), to: null });

  return result;
}

// ── Fuzzy ingredient name match ───────────────────────────────────────────────

function fuzzyMatch(term, name) {
  const clean = x => x.toLowerCase()
    .replace(/\b(freshly\s+ground|cloves?|heads?|tbsp\s+of|tsp\s+of|cups?\s+of|\bof\b|black|white|ground|freshly|kosher|sea|fine|coarse|cracked)\b/g, '')
    .replace(/\s+/g, ' ').trim();
  const b = clean(name);
  const nosp = x => x.replace(/\s+/g, '');

  // Handle "X/Y" alternatives in swap notes — try each variant separately
  const variants = term.split('/').map(v => clean(v.trim())).filter(Boolean);
  for (const a of variants) {
    if (a === b || nosp(a) === nosp(b)) return true;
    const aWords = a.split(' ').filter(w => w.length > 2);
    if (aWords.length > 0 && aWords.every(w => b.includes(w))) return true;
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
  const lower = name.toLowerCase().trim();
  if (ingDB[lower]) return ingDB[lower];

  // Strip prep instructions, size/texture descriptors, and filler words
  const cleaned = lower
    .replace(/\bcut\s+into\b.*$/i, '')           // "cut into 1-inch cubes" and everything after
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
    const hasMod = d.dietTags && Object.values(d.dietTags).some(t => t.mod && t.notes?.trim());
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
      if (!tagData.mod || !tagData.notes?.trim()) continue;

      const pairs = parseSwapPairs(tagData.notes);
      if (!pairs.length) continue;

      const workingTotal = { ...baseTotal };
      const swapLog = [];

      for (const { from, to } of pairs) {
        const origIngs = ings.filter(i => !i.skip && i.matched && i.grams > 0 && fuzzyMatch(from, i.name));
        if (!origIngs.length) continue;

        for (const origIng of origIngs) {
          const origEntry = lookupIngredient(origIng.name, ingDB);

          if (to === null) {
            // Remove ingredient
            if (origEntry) {
              const origNutr = calcNutrition(origIng.grams, origEntry);
              if (origNutr) {
                for (const [k, v] of Object.entries(origNutr))
                  workingTotal[k] = Math.round(((workingTotal[k] ?? 0) - v) * 100) / 100;
                swapLog.push(`Removed ${cleanIngName(origIng.name)} (−${Math.round(origNutr.calories ?? 0)} cal)`);
              }
            } else {
              swapLog.push(`Removed ${cleanIngName(origIng.name)} (not in DB)`);
            }
            continue;
          }

          // Swap — look up replacement
          const toName    = to.replace(/^\d[\d/.\s]*(cup|tbsp|tsp|oz|lb|g|ml)s?\s*/i, '').trim();
          const swapEntry = lookupIngredient(toName, ingDB);

          if (!swapEntry) {
            swapLog.push(`${cleanIngName(origIng.name)} → ${toName} (not in DB, kept original)`);
            continue;
          }

          // Subtract original
          if (origEntry) {
            const origNutr = calcNutrition(origIng.grams, origEntry);
            if (origNutr)
              for (const [k, v] of Object.entries(origNutr))
                workingTotal[k] = Math.round(((workingTotal[k] ?? 0) - v) * 100) / 100;
          }

          // Add swap at same gram weight
          const swapNutr = calcNutrition(origIng.grams, swapEntry);
          if (swapNutr) {
            for (const [k, v] of Object.entries(swapNutr))
              workingTotal[k] = Math.round(((workingTotal[k] ?? 0) + v) * 100) / 100;
            const origCal = origEntry ? Math.round(calcNutrition(origIng.grams, origEntry)?.calories ?? 0) : 0;
            const swapCal = Math.round(swapNutr.calories ?? 0);
            const delta   = swapCal - origCal;
            swapLog.push(`${cleanIngName(origIng.name)} → ${toName} (${delta >= 0 ? '+' : ''}${delta} cal)`);
          }
        }
      }

      byDiet[dietCode] = {
        perServing: divideByServings(workingTotal, servings),
        swapLog,
      };
    }

    if (Object.keys(byDiet).length === 0) { skipped++; continue; }

    await db.collection('recipes').doc(recipe.id).update({ 'nutrition.byDiet': byDiet });
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
