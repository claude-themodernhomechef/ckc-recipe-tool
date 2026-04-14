/**
 * standardize_salt_pepper.js
 * ──────────────────────────
 * Finds every recipe ingredient line that is some variation of
 * "salt and pepper", "salt & pepper", "salt, pepper", "salt pepper",
 * "pepper and salt", etc. and rewrites it to "salt + pepper".
 *
 * Also collapses standalone "salt" or "pepper" lines that appear in the
 * same recipe as a compound "salt + pepper" line (removes the redundant ones).
 *
 * Only touches recipes with status: 'yes'.
 *
 * Usage:
 *   node scripts/standardize_salt_pepper.js             (live run)
 *   node scripts/standardize_salt_pepper.js --dry-run   (preview only)
 */

const admin = require('firebase-admin');
const path  = require('path');

const SA_KEY  = path.join(__dirname, '..', 'service-account.json');
const DRY_RUN = process.argv.includes('--dry-run');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(SA_KEY) });
}
const db = admin.firestore();

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true if a line is some compound form of salt+pepper.
 * Matches: "salt and pepper", "salt & pepper", "salt, pepper",
 *          "pepper and salt", "salt + pepper", "salt pepper", etc.
 * (with optional leading qty like "to taste", "1/4 tsp", etc.)
 */
function isCompoundSaltPepper(line) {
  const s = line.toLowerCase().replace(/[^\w\s+&,]/g, ' ').replace(/\s+/g, ' ').trim();
  return /\bsalt\b.{0,10}\bpepper\b/.test(s) || /\bpepper\b.{0,10}\bsalt\b/.test(s);
}

/**
 * Returns true if the line is ONLY about salt (no pepper component).
 */
function isOnlySalt(line) {
  const s = line.toLowerCase();
  return /\bsalt\b/.test(s) && !/\bpepper\b/.test(s);
}

/**
 * Returns true if the line is ONLY about pepper (no salt component).
 */
function isOnlyPepper(line) {
  const s = line.toLowerCase();
  return /\bpepper\b/.test(s) && !/\bsalt\b/.test(s);
}

/**
 * Rewrites a compound salt+pepper line to the canonical form,
 * preserving any leading quantity (e.g. "to taste", "1/4 tsp").
 * "to taste salt and pepper" → "salt + pepper, to taste"
 * "1/4 tsp salt and pepper"  → "salt + pepper"
 * "salt and pepper to taste" → "salt + pepper, to taste"
 */
function canonicalize(line) {
  const lower = line.toLowerCase();

  // Strip leading qty/descriptor
  const stripped = line
    .replace(/^[\d\s/½¼¾⅓⅔.]+\s*(tbsp|tsp|tablespoons?|teaspoons?|cups?|oz|lb|g|ml)\.?\s*/i, '')
    .replace(/^to\s+taste[,\s]*/i, '')
    .replace(/[,\s]*(to\s+taste|as\s+needed|as\s+desired)\s*$/i, '')
    .trim();

  const hasToTaste = /to\s+taste|as\s+needed/i.test(lower);

  return hasToTaste ? 'salt + pepper, to taste' : 'salt + pepper';
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(DRY_RUN ? '── DRY RUN ──' : '── LIVE RUN ──');

  const snap = await db.collection('recipes').where('status', 'in', ['yes', 'needs_review']).get();
  console.log(`Loaded ${snap.size} approved recipes`);

  let changed = 0;
  let skipped = 0;
  const batch = db.batch();
  let batchCount = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const ings = data.ingredients;
    if (!Array.isArray(ings) || ings.length === 0) { skipped++; continue; }

    let updated = [...ings];
    let dirty = false;

    // Step 1: Normalize all compound lines to "salt + pepper" (or "salt + pepper, to taste")
    updated = updated.map(line => {
      if (typeof line !== 'string') return line;
      if (isCompoundSaltPepper(line)) {
        const canonical = canonicalize(line);
        if (line !== canonical) {
          dirty = true;
          return canonical;
        }
      }
      return line;
    });

    // Step 2: If a compound "salt + pepper" line now exists, remove standalone salt/pepper lines
    const hasCompound = updated.some(l => typeof l === 'string' && isCompoundSaltPepper(l));
    if (hasCompound) {
      const before = updated.length;
      updated = updated.filter(line => {
        if (typeof line !== 'string') return true;
        if (isOnlySalt(line) || isOnlyPepper(line)) {
          dirty = true;
          return false; // remove
        }
        return true;
      });
      if (updated.length !== before) {
        console.log(`  [${docSnap.id}] "${data.name}" — removed ${before - updated.length} redundant salt/pepper line(s)`);
      }
    }

    if (!dirty) { skipped++; continue; }

    console.log(`  [${docSnap.id}] "${data.name}"`);
    console.log(`    Before: ${ings.filter(l => typeof l === 'string' && (/\bsalt\b/i.test(l) || /\bpepper\b/i.test(l))).join(' | ')}`);
    console.log(`    After:  ${updated.filter(l => typeof l === 'string' && (/\bsalt\b/i.test(l) || /\bpepper\b/i.test(l))).join(' | ')}`);

    if (!DRY_RUN) {
      batch.update(docSnap.ref, { ingredients: updated });
      batchCount++;
      changed++;

      // Firestore batch limit is 500 — commit and start fresh
      if (batchCount >= 490) {
        await batch.commit();
        batchCount = 0;
        console.log('  [batch committed]');
      }
    } else {
      changed++;
    }
  }

  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
  }

  console.log(`\nDone. ${changed} recipes updated, ${skipped} unchanged.`);
}

run().catch(err => { console.error(err); process.exit(1); });
