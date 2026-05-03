/**
 * build_ingredient_db_v2.js
 *
 * Looks up all ingredients from ingredientNutrition.json through the
 * Edamam Food Database API to get per-100g nutrition + labeled measures.
 *
 * Saves to data/ingredientNutrition_v2.json (resumable via progress file).
 *
 * Usage: node scripts/build_ingredient_db_v2.js
 */

const https    = require('https');
const fs       = require('fs');
const path     = require('path');

const APP_ID        = '1dcf034b';
const APP_KEY       = '1b4c4de12c797e9b0b96a7abe9c642b5';
const USDA_DB       = path.join(__dirname, '../data/ingredientNutrition.json');
const OUTPUT        = path.join(__dirname, '../data/ingredientNutrition_v2.json');
const PROGRESS_FILE = path.join(__dirname, '../data/ingredient_db_v2_progress.json');
const RATE_LIMIT_MS = 1300; // ~46/min under 50/min limit

// ─── Edamam Food DB lookup ────────────────────────────────────────────────────

function lookupIngredient(name) {
  return new Promise((resolve, reject) => {
    const url = `https://api.edamam.com/api/food-database/v2/parser?app_id=${APP_ID}&app_key=${APP_KEY}&ingr=${encodeURIComponent(name)}&nutrition-type=cooking`;
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 200) resolve(JSON.parse(data));
        else if (res.statusCode === 429) reject(new Error('rate_limited'));
        else resolve(null);
      });
    }).on('error', reject);
  });
}

function parseResult(name, result) {
  if (!result || !result.hints || result.hints.length === 0) return null;

  // Pick best match — prefer exact label match, else first generic food
  let best = result.hints.find(h =>
    h.food.label.toLowerCase() === name.toLowerCase() &&
    h.food.category === 'Generic foods'
  ) || result.hints.find(h => h.food.category === 'Generic foods')
    || result.hints[0];

  if (!best) return null;

  const food     = best.food;
  const measures = best.measures || [];
  const n        = food.nutrients || {};

  // Nutrient code → human-readable key + unit
  const NUTRIENT_MAP = {
    ENERC_KCAL: { key: 'calories',          unit: 'kcal' },
    PROCNT:     { key: 'protein',            unit: 'g'    },
    FAT:        { key: 'fat',                unit: 'g'    },
    FASAT:      { key: 'saturatedFat',       unit: 'g'    },
    FAMS:       { key: 'monounsaturatedFat', unit: 'g'    },
    FAPU:       { key: 'polyunsaturatedFat', unit: 'g'    },
    FATRN:      { key: 'transFat',           unit: 'g'    },
    CHOLE:      { key: 'cholesterol',        unit: 'mg'   },
    CHOCDF:     { key: 'carbs',              unit: 'g'    },
    FIBTG:      { key: 'fiber',              unit: 'g'    },
    SUGAR:      { key: 'sugar',              unit: 'g'    },
    'SUGAR.added': { key: 'addedSugar',      unit: 'g'    },
    NA:         { key: 'sodium',             unit: 'mg'   },
    K:          { key: 'potassium',          unit: 'mg'   },
    CA:         { key: 'calcium',            unit: 'mg'   },
    MG:         { key: 'magnesium',          unit: 'mg'   },
    P:          { key: 'phosphorus',         unit: 'mg'   },
    FE:         { key: 'iron',               unit: 'mg'   },
    ZN:         { key: 'zinc',               unit: 'mg'   },
    VITA_RAE:   { key: 'vitaminA',           unit: 'µg'   },
    VITC:       { key: 'vitaminC',           unit: 'mg'   },
    VITD:       { key: 'vitaminD',           unit: 'µg'   },
    TOCPHA:     { key: 'vitaminE',           unit: 'mg'   },
    VITK1:      { key: 'vitaminK',           unit: 'µg'   },
    THIA:       { key: 'vitaminB1',          unit: 'mg'   },
    RIBF:       { key: 'vitaminB2',          unit: 'mg'   },
    NIA:        { key: 'vitaminB3',          unit: 'mg'   },
    VITB6A:     { key: 'vitaminB6',          unit: 'mg'   },
    FOLDFE:     { key: 'folate',             unit: 'µg'   },
    VITB12:     { key: 'vitaminB12',         unit: 'µg'   },
    WATER:      { key: 'water',              unit: 'g'    },
  };

  const per100g = {};
  for (const [code, meta] of Object.entries(NUTRIENT_MAP)) {
    if (n[code] != null) {
      per100g[meta.key] = { value: Math.round(n[code] * 100) / 100, unit: meta.unit };
    }
  }

  return {
    foodId:   food.foodId,
    label:    food.label,
    category: food.category,
    per100g,
    measures: measures.map(m => ({
      label:      m.label,
      gramWeight: m.weight,
    })).filter(m => m.gramWeight > 0),
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const usdaDB    = JSON.parse(fs.readFileSync(USDA_DB, 'utf8'));
  const allNames  = Object.keys(usdaDB);
  console.log(`Total ingredients to look up: ${allNames.length}`);

  // Load progress
  let progress = {};
  if (fs.existsSync(PROGRESS_FILE)) {
    progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    console.log(`Resuming — ${Object.keys(progress).length} already done\n`);
  }

  const todo = allNames.filter(n => !progress[n]);
  console.log(`${todo.length} remaining\n`);

  let found = 0, notFound = 0;

  for (let i = 0; i < todo.length; i++) {
    const name = todo[i];
    process.stdout.write(`[${String(i+1).padStart(4)}/${todo.length}] ${name.padEnd(40)} `);

    try {
      const result = await lookupIngredient(name);
      const parsed = parseResult(name, result);

      if (parsed) {
        progress[name] = { status: 'ok', data: parsed };
        const m = parsed.measures.slice(0,3).map(m => `${m.label}=${m.gramWeight}g`).join(', ');
        console.log(`✓ ${parsed.label} | ${m}`);
        found++;
      } else {
        // Fall back to USDA data
        progress[name] = { status: 'not_found', data: null };
        console.log('✗ not found — keeping USDA');
        notFound++;
      }
    } catch(e) {
      if (e.message === 'rate_limited') {
        console.log('RATE LIMITED — pausing 60s...');
        fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
        await sleep(60000);
        i--;
        continue;
      }
      progress[name] = { status: 'error', error: e.message };
      console.log(`ERR: ${e.message.slice(0,40)}`);
      notFound++;
    }

    if ((i + 1) % 100 === 0) {
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
      console.log(`  [saved — ${i+1} done | found: ${found} | not found: ${notFound}]`);
    }

    await sleep(RATE_LIMIT_MS);
  }

  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));

  // Build final v2 database — Edamam where found, USDA as fallback
  const v2 = {};
  for (const name of allNames) {
    const p = progress[name];
    if (p?.status === 'ok' && p.data) {
      v2[name] = { source: 'edamam', ...p.data };
    } else {
      // Keep USDA entry as fallback
      v2[name] = { source: 'usda', ...usdaDB[name] };
    }
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(v2, null, 2));

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('INGREDIENT DB V2 COMPLETE');
  console.log(`  Found in Edamam: ${found}`);
  console.log(`  USDA fallback:   ${notFound}`);
  console.log(`  Total:           ${allNames.length}`);
  console.log(`  Saved → data/ingredientNutrition_v2.json`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
