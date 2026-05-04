/**
 * regen_diet_tags.js
 * ──────────────────
 * Re-runs diet compliance analysis on all 948 YES recipes
 * using their current ingredients and updates dietTags in Firestore.
 *
 * Usage:
 *   node regen_diet_tags.js
 *   node regen_diet_tags.js --reset
 */

const admin    = require('firebase-admin');
const fs       = require('fs');
const path     = require('path');
const dietRules = require(path.join(__dirname, '../functions/diet-rules.json'));

const PROGRESS_FILE = path.join(__dirname, 'regen_diet_tags_progress.json');
const BATCH_SIZE    = 20;

const args  = process.argv.slice(2);
const RESET = args.includes('--reset');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(require(path.join(__dirname, '../service-account.json'))) });
}
const db = admin.firestore();

function loadProgress() {
  if (RESET && fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
  if (!fs.existsSync(PROGRESS_FILE)) return { done: [] };
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); }
  catch (_) { return { done: [] }; }
}
function saveProgress(p) { fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2)); }

function capitalise(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

function analyzeDiet(ingredients, name, description, url, blogger) {
  const ingredientText = ingredients.join(' ').toLowerCase();
  const contextText    = `${name} ${description} ${blogger}`.toLowerCase();
  const allText        = `${ingredientText} ${contextText}`;
  const result         = {};

  for (const [tag, rules] of Object.entries(dietRules)) {
    const hasQualifier       = rules.native_qualifiers.some(q => allText.includes(q.toLowerCase()));
    const disqualifiers      = rules.native_disqualifiers.filter(d => ingredientText.includes(d.toLowerCase()));
    const isNativelyDisqualified = disqualifiers.length > 0;

    let native = false, mod = false, notes = '';

    if (hasQualifier && !isNativelyDisqualified) {
      native = true;
    } else if (!isNativelyDisqualified && ingredients.length > 0) {
      native = true;
    }

    if (!native) {
      if (tag === 'LF' && rules.skip_if_star) {
        const nameLC = name.toLowerCase();
        if (rules.skip_if_star.some(s => nameLC.includes(s))) {
          result[tag] = { native: false, mod: false, notes: '' };
          continue;
        }
      }
      let modCandidates = (rules.mod_candidates || []).filter(c =>
        ingredientText.includes(c.toLowerCase())
      );
      // Dedupe overlapping candidates: drop a candidate if a longer matched
      // candidate already covers it (e.g. drop "cream" when "sour cream" matched).
      modCandidates = modCandidates
        .sort((a, b) => b.length - a.length)
        .filter((c, i, arr) =>
          !arr.slice(0, i).some(longer => longer.toLowerCase().includes(c.toLowerCase())));
      if (modCandidates.length > 0) {
        const swapNotes = modCandidates
          .map(c => { const swap = rules.swaps?.[c]; return swap ? `${capitalise(c)}: ${swap}.` : null; })
          .filter(Boolean);
        if (swapNotes.length > 0) { mod = true; notes = swapNotes.join(' '); }
      }
    }

    if (native || mod) result[tag] = { native, mod, notes };

    if (tag === 'AIP' && (native || mod) && rules.cascade_tags) {
      for (const ct of rules.cascade_tags) {
        if (!result[ct]) result[ct] = { native: true, mod: false, notes: '' };
      }
    }
  }
  return result;
}

async function main() {
  console.log('CKC Diet Tags Regeneration');
  console.log('Fetching all YES recipes from Firestore…\n');

  const snap    = await db.collection('recipes').where('status', '==', 'yes').get();
  const allDocs = snap.docs;

  const progress = loadProgress();
  const doneSet  = new Set(progress.done);
  const todo     = allDocs.filter(d => !doneSet.has(d.id));

  console.log(`Total YES: ${allDocs.length} | Done: ${doneSet.size} | Remaining: ${todo.length}\n`);

  let updated = 0, skipped = 0;

  for (let i = 0; i < todo.length; i += BATCH_SIZE) {
    const batch = todo.slice(i, i + BATCH_SIZE);
    const firestoreBatch = db.batch();

    for (const doc of batch) {
      const data = doc.data();
      const ingredients = data.ingredients || [];
      if (!ingredients.length) { skipped++; progress.done.push(doc.id); continue; }

      const dietTags = analyzeDiet(
        ingredients,
        data.name        || '',
        data.description || '',
        data.url         || '',
        data.blogger     || ''
      );

      firestoreBatch.update(db.collection('recipes').doc(doc.id), { dietTags });
      progress.done.push(doc.id);
      updated++;
    }

    await firestoreBatch.commit();
    saveProgress(progress);

    const pct = Math.round(((doneSet.size + i + batch.length) / allDocs.length) * 100);
    process.stdout.write(`\r  Progress: ${doneSet.size + i + batch.length}/${allDocs.length} (${pct}%)`);
  }

  console.log('\n\n── Summary ──');
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped (no ingredients): ${skipped}`);
  console.log(`  Total:   ${allDocs.length}`);

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
