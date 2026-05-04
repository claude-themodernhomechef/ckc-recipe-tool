/**
 * write_recipe_nutrition_v2.js
 *
 * Reads calculated nutrition from data/recipe_nutrition_v2_progress.json
 * and batch-writes the nutrition object to each recipe in Firestore.
 *
 * Only writes recipes with matchRate >= 50 (skips low-quality matches).
 * Resumable — skips recipes already written (tracked in write_v2_log.json).
 *
 * Usage: node scripts/write_recipe_nutrition_v2.js
 */

const admin = require('firebase-admin');
const fs    = require('fs');
const path  = require('path');

const SA_PATH       = path.join(__dirname, '../service-account.json');
const PROGRESS_FILE = path.join(__dirname, '../data/recipe_nutrition_v2_progress.json');
const WRITE_LOG     = path.join(__dirname, '../data/recipe_nutrition_v2_write_log.json');

const sa = require(SA_PATH);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function main() {
  const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  const allIds   = Object.keys(progress);

  // Load write log for resumability
  let writeLog = {};
  if (fs.existsSync(WRITE_LOG)) {
    writeLog = JSON.parse(fs.readFileSync(WRITE_LOG, 'utf8'));
    console.log(`Resuming — ${Object.keys(writeLog).length} already written`);
  }

  // Filter: only write recipes with sufficient match quality
  const toWrite = allIds.filter(id => {
    if (writeLog[id]) return false;
    const entry = progress[id];
    if (!entry || !entry.nutrition) return false;
    if (entry.matchRate < 50) return false;
    if (!entry.nutrition.perServing) return false;
    return true;
  });

  const skipped = allIds.filter(id => {
    const entry = progress[id];
    return entry && entry.matchRate < 50;
  });

  console.log(`\nTotal recipes in v2 progress: ${allIds.length}`);
  console.log(`Skipping (match < 50%):        ${skipped.length}`);
  console.log(`To write:                      ${toWrite.length}`);
  console.log(`Already written:               ${Object.keys(writeLog).length}\n`);

  let written = 0, errors = 0;
  const BATCH_SIZE = 400;

  for (let i = 0; i < toWrite.length; i += BATCH_SIZE) {
    const chunk = toWrite.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const id of chunk) {
      const entry = progress[id];
      const ref   = db.collection('recipes').doc(id);
      const n     = entry.nutrition;

      // Compress ingredients: keep raw + name + grams + matched + skip + garnish + assumed flags
      const compressedIngredients = (n.ingredients || []).map(ing => ({
        raw:            ing.raw,
        name:           ing.name,
        grams:          ing.grams || 0,
        matched:        !!ing.matched,
        skip:           !!ing.skip,
        garnish:        !!ing.garnish,
        ...(ing.assumed ? { assumed: true, assumedDefault: ing.assumedDefault } : {}),
      }));

      const nutritionToWrite = {
        ingredients:       compressedIngredients,
        total:             n.total             || {},
        perServing:        n.perServing         || {},
        garnishPerServing: n.garnishPerServing  ?? null,
        servings:          n.servings           || 4,
        matchRate:         entry.matchRate      || 0,
        source:            'db_v2+edamam_gaps',
        calculatedAt:      n.calculatedAt       || new Date().toISOString().split('T')[0],
        edamamDelta:       n.edamamDelta        ?? null,
        edamamCalories:    n.edamamCalories     ?? null,
      };

      batch.update(ref, { nutrition: nutritionToWrite });
    }

    await batch.commit();

    for (const id of chunk) writeLog[id] = { writtenAt: new Date().toISOString() };
    fs.writeFileSync(WRITE_LOG, JSON.stringify(writeLog, null, 2));

    written += chunk.length;
    const pct = Math.round(written / toWrite.length * 100);
    console.log(`[${String(written).padStart(4)}/${toWrite.length}] ${pct}% written`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('FIRESTORE WRITE V2 COMPLETE');
  console.log(`  Written:             ${written}`);
  console.log(`  Skipped (low match): ${skipped.length}`);
  console.log(`  Errors:              ${errors}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
