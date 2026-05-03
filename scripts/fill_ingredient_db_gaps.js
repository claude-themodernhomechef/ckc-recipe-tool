/**
 * fill_ingredient_db_gaps.js
 * ──────────────────────────
 * Looks up the 331 ingredients missing from ingredientNutrition_v2.json
 * using the Edamam Food Database API and appends them to the DB.
 *
 * Resume-safe: skips ingredients already in the DB.
 * Flags any Edamam can't match to data/ingredient_gaps_review.csv
 *
 * Usage:
 *   node scripts/fill_ingredient_db_gaps.js
 */

const https  = require('https');
const fs     = require('fs');
const path   = require('path');

const ROOT       = path.join(__dirname, '..');
const DB_FILE    = path.join(ROOT, 'data', 'ingredientNutrition_v2.json');
const MASTER     = path.join(ROOT, 'ingredient_master_list.json');
const REVIEW_CSV = path.join(ROOT, 'data', 'ingredient_gaps_review.csv');

const APP_ID  = '951fa6b2';
const APP_KEY = 'd0f7c174f033b62b7c0484da38d577fc';
const SLEEP   = 350; // ms between calls — stay under Edamam rate limit

// ── Load files ────────────────────────────────────────────────────────────────
const db     = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const master = JSON.parse(fs.readFileSync(MASTER,  'utf8'));

const dbKeys = new Set(Object.keys(db).map(k => k.toLowerCase().trim()));

// Find missing ingredients (skip parse failures and to-taste items)
const SKIP_FLAGS = new Set(['PARSE_FAILED', '[PARSE_FAILED]']);
const missing = master
  .filter(item => !SKIP_FLAGS.has(item.flag))
  .filter(item => !item.name.startsWith('[PARSE FAILED]'))
  .filter(item => !dbKeys.has(item.name.toLowerCase().trim()))
  .map(item => item.name);

console.log(`ingredientNutrition_v2.json: ${Object.keys(db).length} entries`);
console.log(`Missing ingredients:         ${missing.length}`);
console.log(`Starting gap fill...\n`);

// ── Edamam Food Database lookup ───────────────────────────────────────────────
function lookupEdamam(ingredient) {
  return new Promise((resolve) => {
    const encoded = encodeURIComponent(ingredient);
    const url = `https://api.edamam.com/api/food-database/v2/parser?ingr=${encoded}&app_id=${APP_ID}&app_key=${APP_KEY}&nutrition-type=cooking`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const hints = json.hints || [];
          const parsed = json.parsed || [];

          // Prefer a direct parse hit first, then first hint
          const candidates = [
            ...(parsed.map(p => p.food)),
            ...(hints.map(h => h.food)),
          ].filter(Boolean);

          if (!candidates.length) return resolve(null);

          // Pick best: prefer "Generic foods" over branded
          const best = candidates.find(f => f.category === 'Generic foods') || candidates[0];

          const n = best.nutrients || {};
          const entry = {
            source:   'edamam',
            foodId:   best.foodId,
            label:    best.label,
            category: best.category || 'Generic foods',
            per100g: {
              calories: { value: Math.round((n.ENERC_KCAL || 0) * 10) / 10, unit: 'kcal' },
              protein:  { value: Math.round((n.PROCNT     || 0) * 10) / 10, unit: 'g' },
              fat:      { value: Math.round((n.FAT        || 0) * 10) / 10, unit: 'g' },
              carbs:    { value: Math.round((n.CHOCDF     || 0) * 10) / 10, unit: 'g' },
              fiber:    { value: Math.round((n.FIBTG      || 0) * 10) / 10, unit: 'g' },
            },
            measures: (best.measures || []).map(m => ({
              label:      m.label,
              gramWeight: Math.round(m.weight * 100) / 100,
            })).filter(m => m.label && m.gramWeight),
          };

          resolve(entry);
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const notFound = [];
  let added = 0;

  for (let i = 0; i < missing.length; i++) {
    const name = missing[i];
    const pct  = Math.round(((i + 1) / missing.length) * 100);
    process.stdout.write(`[${String(i+1).padStart(3)}/${missing.length}] (${String(pct).padStart(3)}%) ${name.slice(0, 50).padEnd(50)} `);

    const entry = await lookupEdamam(name);

    if (entry) {
      db[name] = entry;
      const cal = entry.per100g.calories.value;
      process.stdout.write(`✓  ${cal} kcal/100g\n`);
      added++;

      // Save every 10 ingredients
      if (added % 10 === 0) {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
      }
    } else {
      process.stdout.write(`✗  not found\n`);
      notFound.push(name);
    }

    await sleep(SLEEP);
  }

  // Final save
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

  // Write review CSV
  if (notFound.length) {
    const rows = ['ingredient,action'].concat(notFound.map(n => `"${n}",`));
    fs.writeFileSync(REVIEW_CSV, rows.join('\n'));
    console.log(`\nSaved review file: ${REVIEW_CSV}`);
  }

  console.log('\n── Summary ──────────────────────────────────────────────');
  console.log(`  Added to DB:   ${added}`);
  console.log(`  Not found:     ${notFound.length}`);
  console.log(`  DB total now:  ${Object.keys(db).length}`);
  console.log(`  Saved to:      data/ingredientNutrition_v2.json`);
}

main().catch(e => { console.error(e); process.exit(1); });
