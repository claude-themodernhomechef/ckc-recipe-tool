/**
 * mine_approved_swaps.js
 *
 * Walks every status='approved' recipe and extracts the structured
 * dietTags.{code}.notes pairs (type='replace' or 'remove'). Builds a
 * frequency-weighted swap table keyed by lowercase ingredient name +
 * protocol, used by the app's "Apply learned swaps" path to generate
 * diet notes without an API call.
 *
 * Output: ckc-consumer-app/data/learnedSwapTable.json
 *
 * Shape:
 *   {
 *     "<lowercased from>": {
 *       "<protocol>": [
 *         { "to": "<replacement>" | null, "count": N },
 *         ...
 *       ]
 *     }
 *   }
 *
 * Run:  node scripts/mine_approved_swaps.js
 */

const admin = require('firebase-admin');
const fs    = require('fs');
const path  = require('path');

const SA_PATH = path.join(__dirname, '../service-account.json');
const OUT     = path.join(__dirname, '../ckc-consumer-app/data/learnedSwapTable.json');

const sa = require(SA_PATH);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

function normalizeFrom(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[,;]/g, ' ')
    // strip leading qty/unit
    .replace(/^\s*\d+[\d/.\s]*\s*(cups?|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|lb|pounds?|g|grams?|ml|cloves?|pieces?|slices?|sprigs?)\s+(?:of\s+)?/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

(async () => {
  const snap = await db.collection('recipes').where('status', '==', 'approved').get();
  console.log(`Mining ${snap.size} approved recipes…`);

  // table[from][protocol] = Map<to_or_null, count>
  const table = {};

  snap.forEach(doc => {
    const tags = doc.data().dietTags || {};
    for (const [protocol, t] of Object.entries(tags)) {
      if (!Array.isArray(t.notes)) continue;
      for (const pair of t.notes) {
        if (!pair || !pair.from) continue;
        const from = normalizeFrom(pair.from);
        if (!from) continue;
        const to   = pair.type === 'remove' ? null : (pair.to ? String(pair.to).toLowerCase().trim() : null);
        if (!table[from]) table[from] = {};
        if (!table[from][protocol]) table[from][protocol] = new Map();
        const m = table[from][protocol];
        m.set(to, (m.get(to) ?? 0) + 1);
      }
    }
  });

  // Flatten to JSON-serializable shape, sorted by frequency desc.
  const out = {};
  for (const [from, byProto] of Object.entries(table)) {
    out[from] = {};
    for (const [proto, counts] of Object.entries(byProto)) {
      out[from][proto] = [...counts.entries()]
        .map(([to, count]) => ({ to, count }))
        .sort((a, b) => b.count - a.count);
    }
  }

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`Wrote ${Object.keys(out).length} unique source ingredients to ${OUT}`);

  // Print a few high-confidence entries for sanity
  const entries = Object.entries(out)
    .map(([k, v]) => ({ k, total: Object.values(v).reduce((s, arr) => s + arr.reduce((a, b) => a + b.count, 0), 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
  console.log('\nTop ingredients by occurrence:');
  for (const e of entries) console.log(`  ${e.k}: ${e.total} occurrences across protocols`);
})().catch(e => { console.error(e); process.exit(1); });
