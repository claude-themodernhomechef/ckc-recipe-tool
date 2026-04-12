/**
 * label_cuisines.js
 *
 * Finds all approved (status: yes) side/salad/sauce recipes missing a cuisine tag,
 * classifies each using Claude, and writes back to Firestore.
 *
 * Valid cuisines (matching the app): American, Italian, Mexican, Asian, Mediterranean,
 * Middle Eastern, Indian, French, Thai, Latin/South American
 * Use "American" for generic/neutral dishes that don't belong to a specific cuisine.
 *
 * Usage:
 *   node scripts/label_cuisines.js
 *   node scripts/label_cuisines.js --dry-run
 */

const admin    = require('firebase-admin');
const path     = require('path');
const fs       = require('fs');
const Anthropic = require('../functions/node_modules/@anthropic-ai/sdk');

const SA_KEY    = path.join(__dirname, '..', 'service-account.json');
const ENV_FILE  = path.join(__dirname, '..', 'functions', '.env');
const BATCH_SIZE = 50;
const DRY_RUN   = process.argv.includes('--dry-run');

if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(SA_KEY) });
const db = admin.firestore();

const envContent  = fs.readFileSync(ENV_FILE, 'utf8');
const apiKeyMatch = envContent.match(/ANTHROPIC_API_KEY=(.+)/);
if (!apiKeyMatch) { console.error('ANTHROPIC_API_KEY not found'); process.exit(1); }
const claude = new Anthropic({ apiKey: apiKeyMatch[1].trim() });

const VALID_CUISINES = [
  'American', 'Italian', 'Mexican', 'Asian', 'Mediterranean',
  'Middle Eastern', 'Indian', 'French', 'Thai', 'Latin/South American',
];

async function classifyBatch(recipes) {
  const list = recipes.map((r, i) => `${i + 1}. "${r.name}"`).join('\n');

  const prompt = `You are tagging recipe cuisines for a meal planning app. Choose from ONLY these options:
American, Italian, Mexican, Asian, Mediterranean, Middle Eastern, Indian, French, Thai, Latin/South American

Rules:
- Use "American" for generic/neutral dishes (roasted vegetables, mashed potatoes, green beans, coleslaw, etc.)
- Use "Asian" for Chinese, Japanese, Korean dishes unless clearly Thai
- Use "Mediterranean" for Greek, Spanish, Lebanese dishes
- Use "Middle Eastern" for Persian, Turkish, Israeli, Moroccan dishes
- Use the most specific match when clear (e.g. guacamole = Mexican, pesto = Italian)

Reply ONLY with a JSON array: [{"i":1,"cuisine":"American"},{"i":2,"cuisine":"Italian"},...]

Recipes:
${list}`;

  const msg = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text  = msg.content[0].text.trim();
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array in response: ' + text.slice(0, 200));
  return JSON.parse(match[0]);
}

async function main() {
  console.log('Fetching approved sides/salads/sauces missing cuisine…');
  const snap = await db.collection('recipes')
    .where('status', '==', 'yes')
    .where('meal_type', 'in', ['side', 'salad', 'sauce'])
    .get();

  const missing = snap.docs
    .filter(d => !d.data().cuisine || d.data().cuisine.trim() === '')
    .map(d => ({ id: d.id, name: d.data().name || '' }));

  console.log(`Found ${missing.length} missing cuisine (out of ${snap.size} total sides/salads/sauces)`);
  if (missing.length === 0) { console.log('Nothing to do.'); process.exit(0); }
  if (DRY_RUN) console.log('DRY RUN — no writes\n');

  let updated = 0, errors = 0;

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch    = missing.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const total    = Math.ceil(missing.length / BATCH_SIZE);
    process.stdout.write(`Batch ${batchNum}/${total} (${batch.length} recipes)… `);

    try {
      const results = await classifyBatch(batch);

      if (!DRY_RUN) {
        const fbBatch = db.batch();
        results.forEach(({ i: idx, cuisine }) => {
          const recipe = batch[idx - 1];
          if (!recipe) return;
          if (!VALID_CUISINES.includes(cuisine)) {
            console.warn(`  Unknown cuisine "${cuisine}" for "${recipe.name}" — defaulting to American`);
            cuisine = 'American';
          }
          fbBatch.update(db.collection('recipes').doc(recipe.id), { cuisine });
        });
        await fbBatch.commit();
      } else {
        results.forEach(({ i: idx, cuisine }) => {
          const recipe = batch[idx - 1];
          if (recipe) console.log(`  [DRY] ${recipe.name} → ${cuisine}`);
        });
      }

      updated += results.length;
      console.log(`done`);
    } catch (err) {
      console.error(`ERROR: ${err.message}`);
      errors++;
    }

    if (i + BATCH_SIZE < missing.length) await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nDone. ${updated} recipes tagged, ${errors} errors.`);
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
