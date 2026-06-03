/**
 * validator_apply.js
 *
 * Runs the rules-first validator on a list of recipes (by URL) and either
 * dry-runs or writes back. Same logic as validator_dryrun + the Cloud
 * Function's validateNotes.
 *
 * Usage:
 *   node scripts/validator_apply.js urls.txt           # dry-run
 *   node scripts/validator_apply.js urls.txt --write   # persist
 */

const admin = require('firebase-admin');
const fs    = require('fs');
const path  = require('path');

const SA = require(path.join(__dirname, '../service-account.json'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(SA) });
const db = admin.firestore();

const ingDBNames = JSON.parse(fs.readFileSync(path.join(__dirname, '../ckc-consumer-app/data/ingredientDBNames.json'), 'utf8'));
const masterSwap = JSON.parse(fs.readFileSync(path.join(__dirname, '../ckc-consumer-app/data/masterSwapTable.json'), 'utf8'));

const WRITE = process.argv.includes('--write');
const ALL = process.argv.includes('--all');
let urls = [];
if (!ALL) {
  const urlsFile = process.argv.find((a, i) => i > 1 && !a.startsWith('--'));
  if (!urlsFile) { console.error('Usage: validator_apply.js <urls.txt> [--write]  OR  validator_apply.js --all [--write]'); process.exit(1); }
  urls = fs.readFileSync(urlsFile, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
}

const KNOWN = new Set();
for (const k of Object.keys(ingDBNames)) for (const w of k.split(/\s+/)) if (w.length > 2) KNOWN.add(w);
for (const entry of Object.values(masterSwap)) {
  for (const v of Object.values(entry)) {
    if (v && v.to) for (const w of String(v.to).toLowerCase().split(/\s+/)) if (w.length > 2) KNOWN.add(w);
  }
}
const JUNK_TO_RE = /^(dairy|lactose|already|gf|df|the same|none|n\/a|tbd|see notes?|same|other|maple syrup|vegan|vegetarian)$/i;
const JUNK_TO_PREFIX_RE = /^(already|the same|see |refer )/i;
const CATEGORY_WORDS = new Set(['dairy', 'lactose', 'gluten', 'wheat', 'soy', 'nightshade', 'fodmap', 'histamine']);
function isValidTo(to) {
  if (!to) return false;
  const t = String(to).toLowerCase().trim();
  if (!t || JUNK_TO_RE.test(t) || JUNK_TO_PREFIX_RE.test(t)) return false;
  if (/^(replace|remove|skip|omit)\b/.test(t)) return false;
  const contentTokens = t
    .replace(/^[\d\s/.½¼¾⅓⅔⅛⅜⅝⅞]+\s*(cups?|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|lb|pounds?|g|grams?|ml|cloves?|pieces?|slices?|sprigs?|cans?|jars?)?\s+(?:of\s+)?/i, '')
    .split(/\s+/).filter(w => w.length > 2);
  if (contentTokens.length === 0) return false;
  const nonCategory = contentTokens.filter(w => !CATEGORY_WORDS.has(w));
  if (nonCategory.length === 0) return false;
  return contentTokens.some(w => KNOWN.has(w));
}
function fromInRecipe(from, ingredients) {
  if (!from) return false;
  const norm = s => String(s).toLowerCase()
    .replace(/[‘’‚‛]/g, "'").replace(/[“”„‟]/g, '"').replace(/[–—]/g, '-')
    .replace(/\([^)]*\)/g, ' ') // strip parentheticals like "(topping)"
    .replace(/[,;()'"]/g, ' ').replace(/\s+/g, ' ').trim();
  const fNorm = norm(from);
  const ings  = ingredients.map(norm);
  if (ings.some(i => i.includes(fNorm))) return true;
  const fWords = fNorm.split(' ').filter(w => w.length > 3);
  return fWords.length > 0 && ings.some(i => fWords.every(w => i.includes(w)));
}
// Display-clean an ingredient string (mirror of app's cleanForDisplay).
function cleanForDisplay(s) {
  if (!s) return '';
  let out = String(s)
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/^[\d/.½¼¾⅓⅔⅛⅜⅝⅞]+(?:[\s-][\d/.½¼¾⅓⅔⅛⅜⅝⅞]+)*\s+/i, '')
    .replace(/^(cups?|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|lb|pounds?|g|grams?|kg|ml|liters?|pieces?|slices?|sprigs?|pinch(?:es)?|dash(?:es)?|jars?|bottles?|box(?:es)?|packages?|packets?|cartons?|tubes?|bags?|sticks?|bunch(?:es)?)\s+(?:of\s+)?/i, '')
    .replace(/^(jumbo|extra\s+large|extra-large|large|medium|small)\s+(?=eggs?\b)/i, '')
    .replace(/[,;:.]+\s*$/, '').trim();
  const PREP_RE = /,\s*(diced|minced|chopped|sliced|grated|shredded|crushed|peeled|halved|quartered|cubed|julienned|torn|softened|melted|smashed|seeded|deveined|trimmed|drained|rinsed|cleaned|finely|roughly|coarsely|thinly|thickly|lightly|optional|(?:for|to)\s+[\w\s]+)\b[\s\w-]*$/i;
  while (PREP_RE.test(out)) out = out.replace(PREP_RE, '').replace(/[,;:.]+\s*$/, '').trim();
  return out.replace(/\s+/g, ' ').trim();
}

function lookupCanonical(from, protocol) {
  if (!from) return null;
  const lower = String(from).toLowerCase()
    .replace(/^[\d\s/.½¼¾⅓⅔⅛⅜⅝⅞]+\s*(cups?|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|lb|pounds?|g|grams?|ml|cloves?|pieces?|slices?|sprigs?|cans?|jars?)?\s+(?:of\s+)?/i, '')
    .replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = lower.split(/\s+/);
  const candidates = [lower, words.slice(-2).join(' '), words[words.length - 1], words[0]]
    .filter((v, i, a) => v && a.indexOf(v) === i);
  for (const c of candidates) {
    const e = masterSwap[c];
    if (e && e[protocol]) return e[protocol];
  }
  return null;
}

(async () => {
  console.log(`Mode: ${WRITE ? 'WRITE' : 'DRY-RUN'}${ALL ? ' (ALL RECIPES)' : ''}\n`);

  // Build the doc list — either from URL file or the entire recipes collection.
  let docs = [];
  if (ALL) {
    const snap = await db.collection('recipes').get();
    docs = snap.docs;
    console.log(`Scanning ${docs.length} recipes…\n`);
  } else {
    for (const url of urls) {
      const variants = [url, url.replace(/\/$/, ''), url + '/'];
      let doc = null;
      for (const u of variants) {
        const s = await db.collection('recipes').where('url', '==', u).limit(1).get();
        if (!s.empty) { doc = s.docs[0]; break; }
      }
      if (!doc) {
        const slug = url.replace(/\/$/, '').split('/').pop();
        const all = await db.collection('recipes').get();
        all.forEach(d => { if (!doc && d.data().url?.includes(slug)) doc = d; });
      }
      if (!doc) { console.log(`✗ NOT FOUND: ${url}\n`); continue; }
      docs.push(doc);
    }
  }

  let recipesChanged = 0;
  for (const doc of docs) {
    const data = doc.data();
    const ings = data.ingredients || [];
    // In --all mode, suppress per-recipe headers unless there are changes (we
    // log inside the protocol loop, so just track totals).
    const verbose = !ALL;
    if (verbose) console.log(`━━━ ${data.name} ━━━`);

    // Parse a legacy notes string into structured pairs (mirrors the app's
    // buildSwapPairs Format B). Used when notes is a string instead of array.
    function parseLegacyNotes(s) {
      const result = [];
      const lower = String(s).toLowerCase();
      const replaceRe = /replace\s+(.+?)\s+with\s+(.+?)(?:[,.]|$)/gi;
      let m;
      while ((m = replaceRe.exec(lower)) !== null) {
        const to = m[2].trim();
        // Split on " and " ONLY when both fragments look like distinct ingredients
        // (≥ 6 chars, contain a non-stopword noun). Avoids bad splits in
        // "half and half", "salt and pepper" treated as one phrase per fragment.
        const STOP_WORDS = new Set(['half', 'the', 'a', 'an', 'or']);
        const fragments = m[1].split(/\s+and\s+/i);
        const valid = fragments.every(f => {
          const t = f.trim();
          if (t.length < 6) return false;
          const firstWord = t.split(/\s+/)[0];
          if (STOP_WORDS.has(firstWord)) return false;
          return true;
        });
        const froms = (valid && fragments.length > 1) ? fragments : [m[1]];
        for (const f of froms) result.push({ type: 'replace', from: f.trim(), to });
      }
      const removeRe = /(?:^|[.;\n])\s*remove\s+([^.;\n]+?)(?:\s+entirely)?(?:[,.]|$)/gi;
      while ((m = removeRe.exec(lower)) !== null) {
        const targets = m[1].split(/\s*(?:,|\sand\s)\s*/i)
          .map(t => t.trim()).filter(t => t.length > 2);
        for (const from of targets) result.push({ type: 'remove', from });
      }
      return result;
    }

    const updates = {};
    for (const [code, t] of Object.entries(data.dietTags || {})) {
      // Convert legacy string notes to structured pairs first
      let workingNotes = t.notes;
      if (typeof workingNotes === 'string' && workingNotes.trim()) {
        workingNotes = parseLegacyNotes(workingNotes);
        if (workingNotes.length === 0) continue;
      } else if (!Array.isArray(workingNotes) || workingNotes.length === 0) {
        continue;
      }
      const kept = [], drops = [], swaps = [];
      for (const pair of workingNotes) {
        if (!pair?.from) { drops.push({ pair, reason: 'no_from' }); continue; }
        if (!fromInRecipe(pair.from, ings)) { drops.push({ pair, reason: 'from_not_in_recipe' }); continue; }
        // For `remove` pairs: only keep if the ingredient is on the
        // non-compliant list for this protocol (i.e. has a masterSwap entry).
        // Catches AI hallucinations like "remove pepitas for LF" when pepitas
        // are actually LF-compliant.
        if (pair.type === 'remove') {
          const canon = lookupCanonical(pair.from, code);
          if (canon) {
            kept.push(pair);
          } else {
            drops.push({ pair, reason: 'remove_compliant_ingredient' });
          }
          continue;
        }
        if (pair.type === 'note') { kept.push(pair); continue; }
        const canon = lookupCanonical(pair.from, code);
        if (canon) {
          // `keep` means the ingredient is compliant for this protocol —
          // the AI shouldn't have swapped it. Drop the pair entirely.
          if (canon.type === 'keep') {
            drops.push({ pair, reason: 'canonical_says_keep' });
            continue;
          }
          const oldTo = pair.to;
          const newPair = canon.type === 'remove'
            ? { type: 'remove', from: pair.from }
            : canon.type === 'note'
              ? { type: 'note', from: pair.from, note: canon.note }
              : { type: 'replace', from: pair.from, to: canon.to };
          const newToValue = canon.to ?? canon.note ?? '(remove)';
          if (String(oldTo).toLowerCase().trim() !== String(newToValue).toLowerCase().trim()) {
            swaps.push({ from: pair.from, oldTo, newTo: newToValue, kind: canon.type });
          }
          kept.push(newPair);
          continue;
        }
        if (!isValidTo(pair.to)) {
          drops.push({ pair, reason: 'junk_to_no_canonical' });
          continue;
        }
        kept.push(pair);
      }
      // Merge consecutive replace pairs that share the same `to` — fixes
      // the legacy parser's bad " and " splits ("cream, half" + "half or
      // coconut cream/milk" both pointing to "full-fat coconut milk" → one
      // entry).
      const merged = [];
      for (const p of kept) {
        const last = merged[merged.length - 1];
        if (p.type === 'replace' && last?.type === 'replace' && last.to === p.to) {
          last.from = last.from + ' and ' + p.from;
        } else {
          merged.push({ ...p });
        }
      }
      const finalKept = merged;

      const wasLegacyString = typeof t.notes === 'string';
      const hadMerges = finalKept.length < kept.length;
      const hasChanges = drops.length > 0 || swaps.length > 0 || wasLegacyString || hadMerges;
      if (!hasChanges) continue;

      if (verbose) {
        console.log(`\n  ${code}:${wasLegacyString ? '  (converting legacy string → structured)' : ''}`);
        for (const s of swaps) {
          console.log(`    ✏️  REPLACE  "${s.from}"`);
          console.log(`        was→ ${s.oldTo}`);
          console.log(`        now→ ${s.newTo}  [${s.kind}]`);
        }
        for (const d of drops) {
          const desc = d.pair.type === 'remove' ? `remove ${d.pair.from}` : `${d.pair.from} → ${d.pair.to}`;
          console.log(`    ❌ DROP [${d.reason}]: ${desc}`);
        }
      }

      if (WRITE) {
        // Strip undefined fields from each pair — Firestore rejects them
        const cleanedPairs = finalKept.map(p => {
          const o = {};
          for (const [k, v] of Object.entries(p)) if (v !== undefined) o[k] = v;
          return o;
        });
        const newTag = { ...t, notes: cleanedPairs };
        newTag.notesText = cleanedPairs.map(p => {
          const cleanFrom = cleanForDisplay(p.from);
          if (p.type === 'remove') return `Remove ${cleanFrom} entirely.`;
          if (p.type === 'note')   return `Reduce or modify ${cleanFrom}: ${p.note}.`;
          return `Replace ${cleanFrom} with ${cleanForDisplay(p.to)}.`;
        }).join(' ');
        if (drops.length > 0) newTag.uncertain = true;
        updates[`dietTags.${code}`] = newTag;
      }
    }

    if (WRITE && Object.keys(updates).length > 0) {
      await doc.ref.update(updates);
      recipesChanged++;
      if (verbose) console.log(`  → wrote ${Object.keys(updates).length} protocol update(s)`);
      else process.stdout.write('.');
    } else if (!WRITE && Object.keys(updates).length === 0 && verbose) {
      // No-op pass — keep output clean
    }
    if (verbose) console.log('');
  }
  if (ALL) console.log(`\n\n━━━ Done. ${recipesChanged} recipe(s) changed. ━━━`);
})().catch(e => { console.error(e); process.exit(1); });
