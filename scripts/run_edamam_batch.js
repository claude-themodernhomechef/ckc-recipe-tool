/**
 * run_edamam_batch.js
 *
 * Runs all 1,078 recipes through Edamam Nutrition Analysis API.
 * Saves progress to data/edamam_progress.json (resumable).
 * Rate limit: 50 requests/minute (plan limit).
 *
 * Usage:
 *   node scripts/run_edamam_batch.js
 */

const admin = require('firebase-admin');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');

const SA_PATH       = path.join(__dirname, '../service-account.json');
const PROGRESS_FILE = path.join(__dirname, '../data/edamam_progress.json');

const EDAMAM_APP_ID  = '951fa6b2';
const EDAMAM_APP_KEY = 'd0f7c174f033b62b7c0484da38d577fc';
const EDAMAM_URL     = 'https://api.edamam.com/api/nutrition-details';
const RATE_LIMIT_MS  = 1300; // ~46/min to stay safely under 50/min

const sa = require(SA_PATH);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

// ─── Edamam API ───────────────────────────────────────────────────────────────

function callEdamam(title, ingredients) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ title, ingr: ingredients });
    const url  = new URL(`${EDAMAM_URL}?app_id=${EDAMAM_APP_ID}&app_key=${EDAMAM_APP_KEY}&nutrition-type=cooking`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            const n = json.totalNutrients || {};
            resolve({
              calories: Math.round(json.calories || 0),
              protein:  Math.round((n.PROCNT?.quantity  || 0) * 10) / 10,
              fat:      Math.round((n.FAT?.quantity     || 0) * 10) / 10,
              carbs:    Math.round((n.CHOCDF?.quantity  || 0) * 10) / 10,
              fiber:    Math.round((n.FIBTG?.quantity   || 0) * 10) / 10,
              sodium:   Math.round((n.NA?.quantity      || 0) * 10) / 10,
              sugar:    Math.round((n.SUGAR?.quantity   || 0) * 10) / 10,
              edamamYield: json.yield || null,
            });
          } catch(e) { reject(new Error('JSON parse: ' + e.message)); }
        } else if (res.statusCode === 555) {
          resolve({ error: 'low_quality', raw: data.slice(0, 100) });
        } else if (res.statusCode === 429) {
          reject(new Error('rate_limited'));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 150)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // Load existing progress
  let progress = {};
  if (fs.existsSync(PROGRESS_FILE)) {
    progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    console.log(`Resuming — ${Object.keys(progress).length} already processed`);
  }

  console.log('Fetching recipes from Firestore...');
  const snap = await db.collection('recipes')
    .where('status', 'in', ['approved', 'needs_review'])
    .get();

  const recipes = [];
  snap.forEach(doc => {
    const d = doc.data();
    if (d.ingredients && d.ingredients.length >= 3) {
      recipes.push({ id: doc.id, name: d.name, ingredients: d.ingredients });
    }
  });

  const todo = recipes.filter(r => !progress[r.id]);
  console.log(`${recipes.length} total | ${todo.length} remaining\n`);

  let ok = 0, lowQuality = 0, errors = 0;

  for (let i = 0; i < todo.length; i++) {
    const r = todo[i];
    process.stdout.write(`[${String(i+1).padStart(4)}/${todo.length}] ${r.name.slice(0, 55).padEnd(55)} `);

    try {
      const result = await callEdamam(r.name, r.ingredients);

      if (result.error === 'low_quality') {
        progress[r.id] = { id: r.id, name: r.name, status: 'low_quality' };
        console.log('low_quality');
        lowQuality++;
      } else {
        progress[r.id] = { id: r.id, name: r.name, status: 'ok', nutrition: result };
        console.log(`${result.calories} cal | P:${result.protein}g F:${result.fat}g C:${result.carbs}g`);
        ok++;
      }
    } catch(e) {
      if (e.message === 'rate_limited') {
        console.log('RATE LIMITED — pausing 60s...');
        fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
        await sleep(60000);
        i--; // retry same recipe
        continue;
      }
      progress[r.id] = { id: r.id, name: r.name, status: 'error', error: e.message.slice(0, 100) };
      console.log(`ERR: ${e.message.slice(0, 40)}`);
      errors++;
    }

    // Save every 50
    if ((i + 1) % 50 === 0) {
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
      console.log(`  [saved progress — ${i+1} done]`);
    }

    await sleep(RATE_LIMIT_MS);
  }

  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('EDAMAM BATCH COMPLETE');
  console.log(`  Success:      ${ok}`);
  console.log(`  Low quality:  ${lowQuality}`);
  console.log(`  Errors:       ${errors}`);
  console.log(`  Saved →       data/edamam_progress.json`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
