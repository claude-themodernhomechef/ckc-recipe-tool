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
const urlsFile = process.argv.find((a, i) => i > 1 && !a.startsWith('--'));
if (!urlsFile) { console.error('Usage: validator_apply.js <urls.txt> [--write]'); process.exit(1); }
const urls = fs.readFileSync(urlsFile, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);

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
  console.log(`Mode: ${WRITE ? 'WRITE' : 'DRY-RUN'}\n`);
  for (const url of urls) {
    // Match Firestore url field (handles trailing slash mismatch)
    const variants = [url, url.replace(/\/$/, ''), url + '/'];
    let doc = null;
    for (const u of variants) {
      const s = await db.collection('recipes').where('url', '==', u).limit(1).get();
      if (!s.empty) { doc = s.docs[0]; break; }
    }
    // Fallback: extract slug from URL and search by URL contains slug
    if (!doc) {
      const slug = url.replace(/\/$/, '').split('/').pop();
      const all = await db.collection('recipes').get();
      all.forEach(d => { if (!doc && d.data().url?.includes(slug)) doc = d; });
    }
    if (!doc) { console.log(`✗ NOT FOUND: ${url}\n`); continue; }
    const data = doc.data();
    const ings = data.ingredients || [];
    console.log(`━━━ ${data.name} ━━━`);

    const updates = {};
    for (const [code, t] of Object.entries(data.dietTags || {})) {
      if (!Array.isArray(t.notes) || t.notes.length === 0) continue;
      const kept = [], drops = [], swaps = [];
      for (const pair of t.notes) {
        if (!pair?.from) { drops.push({ pair, reason: 'no_from' }); continue; }
        if (!fromInRecipe(pair.from, ings)) { drops.push({ pair, reason: 'from_not_in_recipe' }); continue; }
        if (pair.type === 'remove' || pair.type === 'note') { kept.push(pair); continue; }
        if (!isValidTo(pair.to)) {
          const canon = lookupCanonical(pair.from, code);
          if (canon) {
            const oldTo = pair.to;
            const newPair = canon.type === 'remove'
              ? { type: 'remove', from: pair.from }
              : canon.type === 'note'
                ? { type: 'note', from: pair.from, note: canon.note }
                : { type: 'replace', from: pair.from, to: canon.to };
            kept.push(newPair);
            swaps.push({ from: pair.from, oldTo, newTo: canon.to ?? canon.note ?? '(remove)', kind: canon.type });
          } else {
            drops.push({ pair, reason: 'junk_to_no_canonical' });
          }
          continue;
        }
        kept.push(pair);
      }
      if (drops.length === 0 && swaps.length === 0) continue;

      console.log(`\n  ${code}:`);
      for (const s of swaps) {
        console.log(`    ✏️  REPLACE  "${s.from}"`);
        console.log(`        was→ ${s.oldTo}`);
        console.log(`        now→ ${s.newTo}  [${s.kind}]`);
      }
      for (const d of drops) {
        const desc = d.pair.type === 'remove' ? `remove ${d.pair.from}` : `${d.pair.from} → ${d.pair.to}`;
        console.log(`    ❌ DROP [${d.reason}]: ${desc}`);
      }

      if (WRITE) {
        const newTag = { ...t, notes: kept };
        newTag.notesText = kept.map(p =>
          p.type === 'remove' ? `Remove ${p.from} entirely.` :
          p.type === 'note'   ? `Reduce or modify ${p.from}: ${p.note}.` :
                                 `Replace ${p.from} with ${p.to}.`
        ).join(' ');
        if (drops.length > 0) newTag.uncertain = true;
        updates[`dietTags.${code}`] = newTag;
      }
    }

    if (WRITE && Object.keys(updates).length > 0) {
      await doc.ref.update(updates);
      console.log(`  → wrote ${Object.keys(updates).length} protocol update(s)`);
    }
    console.log('');
  }
})().catch(e => { console.error(e); process.exit(1); });
