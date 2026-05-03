/**
 * fix_diet_notes.js
 * ─────────────────
 * Rewrites all dietTags notes that violate the style rules:
 *   - Em dashes (—)
 *   - Science/reasoning explanations
 *   - Listing already-compliant ingredients
 *
 * Only touches recipes with status: 'yes'.
 * Saves progress to fix_diet_notes_progress.json so it can resume if interrupted.
 *
 * Usage:
 *   node scripts/fix_diet_notes.js
 *   node scripts/fix_diet_notes.js --dry-run   (preview without writing)
 */

const admin     = require('firebase-admin');
const Anthropic  = require('@anthropic-ai/sdk').default;
const path       = require('path');
const fs         = require('fs');

const SA_KEY       = path.join(__dirname, '..', 'service-account.json');
const PROGRESS_FILE = path.join(__dirname, '..', 'fix_diet_notes_progress.json');
const DRY_RUN      = process.argv.includes('--dry-run');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(SA_KEY) });
}
const db     = admin.firestore();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Style prompt (mirrors NeedsReviewScreen.tsx) ──────────────────────────────

const SYSTEM_PROMPT = `You rewrite diet compliance modification notes for recipes.

Style rules:
- Imperative sentences only: "Replace X with Y.", "Remove X entirely.", "Use X instead of Y."
- Specific quantities when known (e.g., "Replace 2 garlic cloves with 1 tbsp garlic-infused oil")
- Only describe the swap or removal — nothing else
- Do NOT explain why the swap works or describe the science behind it
- Do NOT list ingredients that are already compliant
- Do NOT say "all other ingredients are compliant" or anything similar
- No em dashes (—) anywhere in the note
- Multiple swaps as separate sentences in a flowing paragraph
- No bullet points, no headers, no markdown
- No mention of diet protocol names within the note text
- End with a period

Examples of the correct note style:

Replace 3 garlic cloves and 1/3 cup of the olive oil with 3 tablespoons garlic-infused oil. Use the remaining olive oil (approximately 1 tablespoon) as needed for consistency.

Replace shallots and garlic cloves with 2 tablespoons garlic-infused oil.

Remove black pepper entirely. Remove dijon mustard entirely. Remove or reduce parmesan.

Replace 1 cup white rice with 1 cup cauliflower rice. Replace warm pita or naan with butter lettuce or iceberg lettuce wraps.

Replace 60ml milk with 60ml unsweetened oat milk or full-fat canned coconut milk. Replace 20g butter with 20g olive oil or dairy-free butter.

Replace all-purpose flour with a 1:1 GF flour blend. Replace flour tortillas with corn tortillas or a GF variety.

You will be given an existing modification note that needs to be cleaned up. Rewrite it following the style rules exactly. Return only the rewritten note — no commentary.`;

// ── Violation detection ───────────────────────────────────────────────────────

// Notes that contain no real swap content — should be cleared to ''
function shouldClear(note) {
  if (!note || !note.trim()) return false;
  // Conversational Claude responses from a bad previous run
  if (/^(I |You'?ve |You are|There'?s |Please provide|I'm ready|I appreciate|I understand|I cannot provide|I don't see|I can't (complete|rewrite|provide)|I have nothing)/i.test(note)) return true;
  // Meta-instructions that got written as notes
  if (/^(Remove this note|This note should|This note doesn't|This note cannot|This recipe (cannot|is not) (be )?modifi|Not (a recipe|modifiable)|No viable|No modification)/i.test(note)) return true;
  // "Not modifiable" standalone notes with no swap content
  if (/^Not modifiable[\s\-–—]*(for this diet)?[\s\.]*(because|as|since)?[\s\S]{0,120}$/.test(note.trim()) && !/^(Replace|Remove|Use|Omit)/i.test(note)) return true;
  return false;
}

// Notes that have real swap content but violate style rules — need Claude rewrite
function hasViolation(note) {
  if (!note || !note.trim()) return false;
  if (shouldClear(note)) return false; // handled separately
  // Em dash
  if (note.includes('—')) return true;
  // Compliant-ingredient listing / science language
  if (/remain(s)? compliant|all other ingredient|keeping this|are (all )?compliant|is compliant|stay compliant|are low-|are lf-|are aip|are gf|are df|are keto|fructan|fodmap-compliant|histamine-compliant/i.test(note)) return true;
  // Parenthetical science explanations e.g. "(nightshade)", "(high-histamine trigger)", "(legume)"
  if (/\((nightshade|legume|seed.based|fermented|high.histamine|high.carb|grain|dairy|soy)\)/i.test(note)) return true;
  // Trailing reasoning after swap e.g. "Remove X (Y is a Z trigger)"
  if (/\(.*trigger\)|\(.*eliminated on\)|\(.*is a \w+\)/i.test(note)) return true;
  return false;
}

// ── Rewrite a single note via Claude ─────────────────────────────────────────

async function rewriteNote(note) {
  const msg = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: 'user', content: `Rewrite this note:\n\n${note}` }],
  });
  const result = (msg.content?.[0]?.text ?? '').trim();
  // If Claude still responded conversationally, return empty string
  if (/^(I |You'?ve |Please |I'm |I appreciate|I understand|I cannot|I don't|I can't)/i.test(result)) return '';
  return result;
}

// ── Sleep helper ──────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Progress tracking ─────────────────────────────────────────────────────────

function loadProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); }
  catch { return { done: [] }; }
}

function saveProgress(p) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) console.log('DRY RUN — no writes will be made\n');
  if (!DRY_RUN && !process.env.ANTHROPIC_API_KEY) {
    console.error('Missing ANTHROPIC_API_KEY env var');
    process.exit(1);
  }

  const progress = loadProgress();
  const doneSet  = new Set(progress.done);

  // Load all yes recipes
  console.log('Loading recipes...');
  const [snapYes, snapNR] = await Promise.all([
    db.collection('recipes').where('status', '==', 'yes').get(),
    db.collection('recipes').where('status', '==', 'needs_review').get(),
  ]);
  const snap = { docs: [...snapYes.docs, ...snapNR.docs] };
  console.log(`${snap.docs.length} recipes (yes + needs_review)\n`);

  let recipesDone = 0, recipesSkipped = 0, notesFixed = 0, notesChecked = 0;

  for (const doc of snap.docs) {
    const recipeId = doc.id;
    const data     = doc.data();
    const dietTags = data.dietTags || {};

    // Skip if already done AND no violations remain
    if (doneSet.has(recipeId)) {
      const hasAny = Object.values(dietTags).some(tag => hasViolation(tag.notes || ''));
      if (!hasAny) { recipesSkipped++; continue; }
    }

    const updates  = {};
    let   changed  = false;

    for (const [protocol, tag] of Object.entries(dietTags)) {
      const note = tag.notes || '';
      notesChecked++;

      const clear   = shouldClear(note);
      const rewrite = !clear && hasViolation(note);
      if (!clear && !rewrite) continue;

      console.log(`  [${protocol}] "${note.slice(0, 80)}..."`);

      if (!DRY_RUN) {
        try {
          let fixed = '';
          if (rewrite) {
            fixed = await rewriteNote(note);
            await sleep(200); // gentle rate limiting
          }
          console.log(`       → ${fixed ? '"' + fixed.slice(0, 80) + '"' : '(cleared)'}`);
          updates[`dietTags.${protocol}.notes`] = fixed;
          changed = true;
          notesFixed++;
        } catch (e) {
          console.warn(`  ERROR rewriting ${recipeId} [${protocol}]: ${e.message}`);
        }
      } else {
        console.log(`  (dry run — would ${clear ? 'clear' : 'rewrite'})`);
        notesFixed++;
      }
    }

    if (changed && !DRY_RUN) {
      await db.collection('recipes').doc(recipeId).update(updates);
    }

    // Mark done and save progress
    progress.done.push(recipeId);
    doneSet.add(recipeId);
    if (!DRY_RUN) saveProgress(progress);
    recipesDone++;

    if (recipesDone % 50 === 0) {
      console.log(`\n--- Progress: ${recipesDone} recipes processed, ${notesFixed} notes fixed ---\n`);
    }
  }

  console.log('\n=== DONE ===');
  console.log(`Recipes processed : ${recipesDone}`);
  console.log(`Recipes skipped   : ${recipesSkipped} (already done)`);
  console.log(`Notes checked     : ${notesChecked}`);
  console.log(`Notes fixed       : ${notesFixed}`);

  if (!DRY_RUN) {
    fs.unlinkSync(PROGRESS_FILE);
    console.log('Progress file cleaned up.');
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
