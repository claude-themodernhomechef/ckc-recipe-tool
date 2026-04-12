/**
 * label_meal_types.js
 *
 * Finds all approved (status: yes) recipes missing a meal_type,
 * classifies each as entree / side / sauce / salad using Claude,
 * and writes the result back to Firestore.
 *
 * Usage:
 *   node scripts/label_meal_types.js
 *   node scripts/label_meal_types.js --dry-run   (print changes, don't write)
 */

const admin   = require('firebase-admin');
const path    = require('path');
const fs      = require('fs');
const Anthropic = require('../functions/node_modules/@anthropic-ai/sdk');

// ── Config ────────────────────────────────────────────────────────────────────
const SA_KEY      = path.join(__dirname, '..', 'service-account.json');
const ENV_FILE    = path.join(__dirname, '..', 'functions', '.env');
const BATCH_SIZE  = 50;   // recipes per Claude call
const DRY_RUN     = process.argv.includes('--dry-run');

// ── Init ──────────────────────────────────────────────────────────────────────
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(SA_KEY) });
const db = admin.firestore();

const envContent = fs.readFileSync(ENV_FILE, 'utf8');
const apiKeyMatch = envContent.match(/ANTHROPIC_API_KEY=(.+)/);
if (!apiKeyMatch) { console.error('ANTHROPIC_API_KEY not found in functions/.env'); process.exit(1); }
const claude = new Anthropic({ apiKey: apiKeyMatch[1].trim() });

// ── Classify a batch of recipes ───────────────────────────────────────────────
async function classifyBatch(recipes) {
  const list = recipes.map((r, i) => `${i + 1}. "${r.name}"${r.cuisine ? ` (${r.cuisine})` : ''}`).join('\n');

  const prompt = `You are classifying recipes for a meal planning app. The four valid meal types are:
- entree: main dishes (all proteins, pastas, soups, stews, curries, grains with protein, egg dishes)
- side: vegetable sides, starch sides, bean sides, bread sides, potato dishes
- salad: salads and slaws served as a side (NOT protein-forward salads — those are entrees)
- sauce: sauces, dressings, dips, condiments, aioli, pesto, salsas, relishes

Classify each recipe below. Reply ONLY with a JSON array in this exact format:
[{"i":1,"type":"entree"},{"i":2,"type":"side"},...]

Recipes:
${list}`;

  const msg = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = msg.content[0].text.trim();
  // Extract JSON array from response
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array in response: ' + text.slice(0, 200));
  return JSON.parse(match[0]);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Fetching approved recipes with missing meal_type…');
  const snap = await db.collection('recipes')
    .where('status', '==', 'yes')
    .get();

  const missing = snap.docs
    .filter(d => !d.data().meal_type)
    .map(d => ({ id: d.id, name: d.data().name || '', cuisine: d.data().cuisine || '' }));

  console.log(`Found ${missing.length} recipes missing meal_type (out of ${snap.size} approved)`);

  if (missing.length === 0) { console.log('Nothing to do.'); process.exit(0); }
  if (DRY_RUN) console.log('DRY RUN — no Firestore writes will be made\n');

  let updated = 0;
  let errors  = 0;

  // Process in batches
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch   = missing.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const total    = Math.ceil(missing.length / BATCH_SIZE);
    process.stdout.write(`Batch ${batchNum}/${total} (${batch.length} recipes)… `);

    try {
      const results = await classifyBatch(batch);

      if (!DRY_RUN) {
        const firestoreBatch = db.batch();
        results.forEach(({ i: idx, type }) => {
          const recipe = batch[idx - 1];
          if (!recipe) return;
          if (!['entree','side','sauce','salad','breakfast'].includes(type)) {
            console.warn(`  Unknown type "${type}" for "${recipe.name}" — skipping`);
            return;
          }
          firestoreBatch.update(db.collection('recipes').doc(recipe.id), { meal_type: type });
        });
        await firestoreBatch.commit();
      } else {
        results.forEach(({ i: idx, type }) => {
          const recipe = batch[idx - 1];
          if (recipe) console.log(`  [DRY] ${recipe.name} → ${type}`);
        });
      }

      updated += results.length;
      console.log(`done (${results.length} classified)`);
    } catch (err) {
      console.error(`ERROR: ${err.message}`);
      errors++;
    }

    // Small pause between batches to avoid rate limits
    if (i + BATCH_SIZE < missing.length) await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nDone. ${updated} recipes classified, ${errors} batch errors.`);
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
