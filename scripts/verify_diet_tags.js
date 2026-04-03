/**
 * verify_diet_tags.js
 * ────────────────────
 * Runs every YES recipe through Claude using the full CKC_Diet_Compliance_Rules.md
 * to verify and correct diet tags with true reasoning (not keyword matching).
 *
 * Outputs:
 *   - Updated dietTags in Firestore (Claude-verified)
 *   - diet_uncertainty_report.json  — recipes/protocols Claude wasn't 100% sure about
 *   - diet_tag_changes.json         — every tag that changed vs. the old keyword-based tags
 *
 * Usage:
 *   node verify_diet_tags.js
 *   node verify_diet_tags.js --concurrency 2
 *   node verify_diet_tags.js --reset
 */

const admin    = require('firebase-admin');
const Anthropic = require('./functions/node_modules/@anthropic-ai/sdk');
const fs       = require('fs');
const path     = require('path');

// ── Config ─────────────────────────────────────────────────────────────────────

const PROGRESS_FILE    = path.join(__dirname, 'verify_diet_tags_progress.json');
const UNCERTAINTY_FILE = path.join(__dirname, 'diet_uncertainty_report.json');
const CHANGES_FILE     = path.join(__dirname, 'diet_tag_changes.json');
const RULES_PATH       = path.join(__dirname, 'CKC_Diet_Compliance_Rules.md');

const envContent  = fs.readFileSync(path.join(__dirname, 'functions', '.env'), 'utf8');
const apiKeyMatch = envContent.match(/ANTHROPIC_API_KEY=(.+)/);
if (!apiKeyMatch) { console.error('ANTHROPIC_API_KEY not found'); process.exit(1); }
process.env.ANTHROPIC_API_KEY = apiKeyMatch[1].trim();

const DIET_RULES = fs.readFileSync(RULES_PATH, 'utf8');

const PROTOCOLS = ['GF', 'DF', 'V', 'Vg', 'K', 'AIP', 'LF', 'LH'];

// ── CLI args ───────────────────────────────────────────────────────────────────

const args        = process.argv.slice(2);
const CONCURRENCY = parseInt(
  args.find(a => a.startsWith('--concurrency='))?.split('=')[1] ||
  (args.includes('--concurrency') ? args[args.indexOf('--concurrency') + 1] : '2'),
  10
) || 2;
const RESET = args.includes('--reset');

// ── Firebase ───────────────────────────────────────────────────────────────────

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(require('./service-account.json')) });
}
const db        = admin.firestore();
const anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Progress & Reports ─────────────────────────────────────────────────────────

function loadProgress() {
  if (RESET && fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
  if (RESET && fs.existsSync(UNCERTAINTY_FILE)) fs.unlinkSync(UNCERTAINTY_FILE);
  if (RESET && fs.existsSync(CHANGES_FILE)) fs.unlinkSync(CHANGES_FILE);
  if (!fs.existsSync(PROGRESS_FILE)) return { done: [] };
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); }
  catch (_) { return { done: [] }; }
}
function saveProgress(p) { fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2)); }

function loadReport(file) {
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (_) { return []; }
}
function saveReport(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function pad(str, len) { const s = String(str).slice(0, len); return s + ' '.repeat(Math.max(0, len - s.length)); }

// ── Claude analysis ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a dietary compliance analyst for a recipe app. Your job is to determine which dietary protocols a recipe natively meets, and which it can meet with specific ingredient swaps.

<COMPLIANCE_RULES>
${DIET_RULES}
</COMPLIANCE_RULES>

For each recipe you receive, analyze all 8 protocols (GF, DF, V, Vg, K, AIP, LF, LH) and return:

- native: true if recipe is compliant AS-IS with no modifications
- mod: true if recipe can be made compliant with simple targeted swaps (only if native=false)
- notes: specific swap instructions per the rules (only if mod=true, empty string otherwise)
- uncertain: true if you are less than 100% confident in this tag due to ambiguous ingredients, missing context, or edge cases
- reason: explain the uncertainty if uncertain=true (empty string otherwise)

Important rules:
- If native=true, then mod=false and notes=""
- Only tag mod=true when there's a clear swap path per the rules that doesn't destroy the dish
- Be conservative: when in doubt, mark uncertain=true rather than guessing
- For V and Vg: only tag native=true if there is clearly NO animal product in the ingredient list
- For AIP: if 4+ core ingredients need removal, set both native=false AND mod=false
- For LF: garlic-infused oil IS LF compliant; plain garlic is NOT

Reply ONLY with valid JSON, no other text:
{
  "GF":  {"native": bool, "mod": bool, "notes": "", "uncertain": bool, "reason": ""},
  "DF":  {"native": bool, "mod": bool, "notes": "", "uncertain": bool, "reason": ""},
  "V":   {"native": bool, "mod": bool, "notes": "", "uncertain": bool, "reason": ""},
  "Vg":  {"native": bool, "mod": bool, "notes": "", "uncertain": bool, "reason": ""},
  "K":   {"native": bool, "mod": bool, "notes": "", "uncertain": bool, "reason": ""},
  "AIP": {"native": bool, "mod": bool, "notes": "", "uncertain": bool, "reason": ""},
  "LF":  {"native": bool, "mod": bool, "notes": "", "uncertain": bool, "reason": ""},
  "LH":  {"native": bool, "mod": bool, "notes": "", "uncertain": bool, "reason": ""}
}`;

async function analyzeDietWithClaude(name, cuisine, course, ingredients) {
  const ingStr = ingredients.slice(0, 20).join('\n');

  const userMessage = `Analyze this recipe:
Name: ${name}
Cuisine: ${cuisine || 'not specified'}
Type: ${course || 'not specified'}
Ingredients:
${ingStr}`;

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userMessage }],
  }, {
    headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
  });

  const text = msg.content[0].text.trim();
  // Strip any markdown code fences if present
  const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  return JSON.parse(clean);
}

// ── Compare old vs new tags ────────────────────────────────────────────────────

function diffTags(oldTags, newTags, name, url) {
  const changes = [];
  for (const proto of PROTOCOLS) {
    const oldVal = oldTags?.[proto];
    const newVal = newTags?.[proto];
    const oldNative = oldVal?.native || false;
    const oldMod    = oldVal?.mod    || false;
    const newNative = newVal?.native || false;
    const newMod    = newVal?.mod    || false;

    if (oldNative !== newNative || oldMod !== newMod) {
      changes.push({
        recipe: name,
        url,
        protocol: proto,
        was: oldVal ? `native=${oldNative} mod=${oldMod}` : 'not tagged',
        now: newVal ? `native=${newNative} mod=${newMod}` : 'not tagged',
        newNotes: newVal?.notes || '',
      });
    }
  }
  return changes;
}

// ── Process one recipe ─────────────────────────────────────────────────────────

async function processRecipe(doc, index, total, uncertainReport, changesReport) {
  const data  = doc.data();
  const label = `[${index}/${total}] ${pad(data.name || '', 45)}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (attempt > 1) await sleep(attempt * 2000);

      const result = await analyzeDietWithClaude(
        data.name        || '',
        data.cuisine     || '',
        data.course      || '',
        data.ingredients || []
      );

      // Build clean dietTags for Firestore (strip uncertain/reason)
      const newDietTags = {};
      for (const proto of PROTOCOLS) {
        const r = result[proto];
        if (r && (r.native || r.mod)) {
          newDietTags[proto] = {
            native: r.native || false,
            mod:    r.mod    || false,
            notes:  r.notes  || '',
          };
        }
      }

      // Collect uncertain items
      const uncertainItems = [];
      for (const proto of PROTOCOLS) {
        const r = result[proto];
        if (r?.uncertain) {
          uncertainItems.push({
            recipe:     data.name || '',
            url:        data.url  || '',
            protocol:   proto,
            native:     r.native,
            mod:        r.mod,
            reason:     r.reason || '',
            ingredient: r.reason || '',
          });
        }
      }

      // Collect tag changes vs old keyword-based tags
      const changes = diffTags(data.dietTags || {}, newDietTags, data.name || '', data.url || '');

      // Update Firestore
      await db.collection('recipes').doc(doc.id).update({ dietTags: newDietTags });

      // Append to reports
      if (uncertainItems.length > 0) uncertainReport.push(...uncertainItems);
      if (changes.length > 0) changesReport.push(...changes);

      const tagCount       = Object.keys(newDietTags).length;
      const uncertainCount = uncertainItems.length;
      const changeCount    = changes.length;
      const flags = [
        `${tagCount} tags`,
        uncertainCount > 0 ? `⚠ ${uncertainCount} uncertain` : '',
        changeCount > 0    ? `↔ ${changeCount} changed`     : '',
      ].filter(Boolean).join(' | ');

      console.log(`${label} ${flags}`);
      return 'done';

    } catch (err) {
      if (attempt < 3) {
        console.log(`${label} retry ${attempt}/3 — ${err.message.slice(0, 80)}`);
      } else {
        console.log(`${label} ✗ FAILED: ${err.message.slice(0, 80)}`);
      }
    }
  }
  return 'error';
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('CKC Diet Tag Verification (Claude-powered)');
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log('Fetching YES recipes from Firestore…\n');

  const snap    = await db.collection('recipes').where('status', '==', 'yes').get();
  const allDocs = snap.docs;

  const progress       = loadProgress();
  const doneSet        = new Set(progress.done);
  const todo           = allDocs.filter(d => !doneSet.has(d.id));
  const uncertainReport = loadReport(UNCERTAINTY_FILE);
  const changesReport   = loadReport(CHANGES_FILE);

  console.log(`Total YES: ${allDocs.length} | Done: ${doneSet.size} | Remaining: ${todo.length}\n`);

  let done = 0, errors = 0;

  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const batch   = todo.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((doc, bi) =>
        processRecipe(doc, doneSet.size + i + bi + 1, allDocs.length, uncertainReport, changesReport)
      )
    );

    results.forEach((r, ri) => {
      if (r === 'done') {
        progress.done.push(batch[ri].id);
        done++;
      } else {
        errors++;
      }
    });

    saveProgress(progress);
    saveReport(UNCERTAINTY_FILE, uncertainReport);
    saveReport(CHANGES_FILE, changesReport);

    if (i + CONCURRENCY < todo.length) await sleep(1200);
  }

  console.log('\n── Summary ──');
  console.log(`  Processed:        ${done}`);
  console.log(`  Errors:           ${errors}`);
  console.log(`  Uncertain items:  ${uncertainReport.length}`);
  console.log(`  Tag changes:      ${changesReport.length}`);
  console.log(`\n  Reports saved to:`);
  console.log(`    ${UNCERTAINTY_FILE}`);
  console.log(`    ${CHANGES_FILE}`);

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
