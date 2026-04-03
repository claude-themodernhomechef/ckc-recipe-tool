/**
 * regen_chefs_notes.js
 * ─────────────────────
 * Regenerates Chef's Notes for all 948 YES recipes using the updated
 * CKC_Chef_Notes_Guide.md rules.
 *
 * Also regenerates Menu Descriptions while it's at it.
 *
 * Usage:
 *   node regen_chefs_notes.js
 *   node regen_chefs_notes.js --concurrency 5
 *   node regen_chefs_notes.js --reset
 */

const admin     = require('firebase-admin');
const Anthropic  = require('./functions/node_modules/@anthropic-ai/sdk');
const fs         = require('fs');
const path       = require('path');

// ── Config ─────────────────────────────────────────────────────────────────────

const PROGRESS_FILE   = path.join(__dirname, 'regen_chefs_notes_progress.json');
const GUIDE_PATH      = path.join(__dirname, 'CKC_Chef_Notes_Guide.md');

// Read ANTHROPIC_API_KEY from functions/.env
const envContent  = fs.readFileSync(path.join(__dirname, 'functions', '.env'), 'utf8');
const apiKeyMatch = envContent.match(/ANTHROPIC_API_KEY=(.+)/);
if (!apiKeyMatch) { console.error('ANTHROPIC_API_KEY not found'); process.exit(1); }
process.env.ANTHROPIC_API_KEY = apiKeyMatch[1].trim();

const CHEF_NOTES_GUIDE = fs.readFileSync(GUIDE_PATH, 'utf8');

const CHEF_NOTES_INSTRUCTIONS = `
VOICE: First person plural "We". Kitchen notebook tone. Include the "why" when it adds value.
MEASUREMENTS: Spices and acids in ranges (1/2-1 tsp, 1-3 tbsp). Temperatures in Fahrenheit with doneness cues.
COMPLEXITY: Match note count to dish complexity. Simple side = 1 note. Standard entree = 2-3. Multi-component = 4+.
FORMAT: Return notes as a single paragraph with notes separated by " | ". No bullet points, no headers, no bold, no diet protocol names.

NEVER mention: Gluten-Free, Dairy-Free, Vegan, Vegetarian, Keto, AIP, Low-FODMAP, Low-Histamine, or any diet compliance swaps.
NEVER use brand names.
NEVER write generic filler like "season to taste" or "use fresh ingredients."
`;

const MENU_DESC_EXAMPLES = `Menu Description examples (all lowercase, semicolons between components, no period):
- "chicken breast with roasted bell peppers, onions, and poblanos; frijoles de la olla made with fresh herbs, scallions and pinto beans; warm flour tortillas; creamy jalapeno verde sauce"
- "slow-cooked fresh halibut, topped with castelvatrano olives, parsley, served with stewed lentils and carrots, with whipped cauliflower and broccoli mash"
- "ground turkey, slow-cooked with chipotle and red bell peppers, with added apple butter, white beans, tomatoes, spinach, summer squash, and leeks, topped with sharp cheddar, green onion, and cilantro"
- "silky roasted beet and chickpea hummus garnished with aleppo pepper, za'atar, and a drizzle of olive oil"
- "grilled fresh peaches over fluffy quinoa with cherry tomatoes, cucumber, red onion, and fresh herbs in a light citrus vinaigrette"`;

// ── CLI args ───────────────────────────────────────────────────────────────────

const args        = process.argv.slice(2);
const CONCURRENCY = parseInt(
  args.find(a => a.startsWith('--concurrency='))?.split('=')[1] ||
  (args.includes('--concurrency') ? args[args.indexOf('--concurrency') + 1] : '3'),
  10
) || 3;
const RESET = args.includes('--reset');

// ── Firebase ───────────────────────────────────────────────────────────────────

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(require('./service-account.json')) });
}
const db         = admin.firestore();
const anthropic  = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Progress ───────────────────────────────────────────────────────────────────

function loadProgress() {
  if (RESET && fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
  if (!fs.existsSync(PROGRESS_FILE)) return { done: [] };
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); }
  catch (_) { return { done: [] }; }
}
function saveProgress(p) { fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2)); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function pad(str, len) { const s = String(str).slice(0, len); return s + ' '.repeat(Math.max(0, len - s.length)); }

// ── Generate Chef's Notes + Menu Description ───────────────────────────────────

async function generateDescriptions(name, cuisine, course, ingredients) {
  const ingStr = ingredients?.length ? ingredients.slice(0, 15).join(', ') : 'not available';

  const prompt = `${CHEF_NOTES_GUIDE}

${CHEF_NOTES_INSTRUCTIONS}

Recipe to write Chef's Notes for:
Name: ${name}
Cuisine: ${cuisine || 'not specified'}
Type: ${course || 'not specified'}
Key ingredients: ${ingStr}

Generate Chef's Notes for this recipe. Follow the guide above exactly.
Reply: CHEFS_NOTES: [text]

---

${MENU_DESC_EXAMPLES}

Recipe: ${name} (${cuisine || ''}, ${course || ''})
Key ingredients: ${ingStr}

Generate a Menu Description.
Reply: MENU_DESC: [text]`;

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content[0].text;
    // Match from label to next label or end — handles multiline responses
    const notesMatch = text.match(/CHEFS_NOTES:\s*([\s\S]+?)(?=\n---|\nMENU_DESC:|$)/);
    const descMatch  = text.match(/MENU_DESC:\s*([\s\S]+?)(?=\n---|$)/);

    return {
      chefsNotes:      notesMatch ? notesMatch[1].trim() : '',
      menuDescription: descMatch  ? descMatch[1].trim()  : '',
    };
  } catch (err) {
    throw err; // let processRecipe log it
  }
}

// ── Process one recipe (with retries) ─────────────────────────────────────────

async function processRecipe(doc, index, total) {
  const data  = doc.data();
  const label = `[${index}/${total}] ${pad(data.name || '', 45)}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (attempt > 1) await sleep(attempt * 2000); // backoff: 2s, 4s

      const result = await generateDescriptions(
        data.name    || '',
        data.cuisine || '',
        data.course  || '',
        data.ingredients || []
      );

      const update = {};
      if (result.chefsNotes)      update.chefsNotes      = result.chefsNotes;
      if (result.menuDescription) update.menuDescription = result.menuDescription;

      if (Object.keys(update).length > 0) {
        await db.collection('recipes').doc(doc.id).update(update);
      }

      const flags = [
        result.chefsNotes      ? 'notes✓' : 'notes✗',
        result.menuDescription ? 'menu✓'  : 'menu✗',
      ].join(' | ');

      console.log(`${label} ${flags}`);
      return 'done';

    } catch (err) {
      if (attempt < 3) {
        console.log(`${label} retry ${attempt}/3 — ${err.message.slice(0, 60)}`);
      } else {
        console.log(`${label} ✗ FAILED after 3 attempts: ${err.message.slice(0, 60)}`);
      }
    }
  }
  return 'error';
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('CKC Chef\'s Notes Regeneration');
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log('Fetching YES recipes from Firestore…\n');

  const snap = await db.collection('recipes').where('status', '==', 'yes').get();
  const allDocs = snap.docs;

  const progress = loadProgress();
  const doneSet  = new Set(progress.done);
  const todo     = allDocs.filter(d => !doneSet.has(d.id));
  const startOffset = doneSet.size;

  console.log(`Total YES: ${allDocs.length} | Done: ${doneSet.size} | Remaining: ${todo.length}\n`);

  let done = 0, errors = 0;

  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const batch   = todo.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((doc, bi) => processRecipe(doc, startOffset + i + bi + 1, allDocs.length))
    );

    results.forEach((r, ri) => {
      if (r === 'done') {
        progress.done.push(batch[ri].id);
        done++;
      } else {
        // Don't mark errors as done — they'll be retried next run
        errors++;
      }
    });

    saveProgress(progress);

    // Pause between batches to respect rate limits
    if (i + CONCURRENCY < todo.length) await sleep(1200);
  }

  console.log('\n── Summary ──');
  console.log(`  Processed: ${done}`);
  console.log(`  Errors:    ${errors}`);
  console.log(`  Total:     ${allDocs.length}`);

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
