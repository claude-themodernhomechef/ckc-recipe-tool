/**
 * sync_diet_rules.js
 *
 * Parses docs/CKC_Diet_Compliance_Rules.md into a structured JSON the
 * app and Cloud Function can consume. This makes the .md the SINGLE
 * source of truth for diet modification rules — edit the doc, re-run
 * this script, and both the AI prompt and the deterministic swap
 * generator pick up the change.
 *
 * Output: ckc-consumer-app/data/dietRules.json
 *
 * Shape:
 *   {
 *     "LF":  { title, body },   // body = the full markdown body of Part 4
 *     "DF":  { title, body },
 *     ...
 *   }
 *
 * Run: node scripts/sync_diet_rules.js
 */

const fs   = require('fs');
const path = require('path');

const IN  = path.join(__dirname, '../docs/CKC_Diet_Compliance_Rules.md');
const OUT = path.join(__dirname, '../ckc-consumer-app/data/dietRules.json');

const md = fs.readFileSync(IN, 'utf8');

// Map of "Part N: title" → protocol code. Parts that aren't per-protocol (1, 2, 3, 11) are skipped.
const PART_TO_CODE = {
  4:  'LF',
  5:  'DF',
  6:  'GF',
  7:  'K',
  8:  'AIP',
  9:  'V',  // also Vg — duplicate the body
  10: 'LH',
};

// Split on "## Part N: …" headers. Each part starts at its header and ends at the next.
const partRe = /^##\s+Part\s+(\d+):\s*(.+)$/gm;
const headers = [];
let m;
while ((m = partRe.exec(md)) !== null) {
  headers.push({ part: Number(m[1]), title: m[2].trim(), startIdx: m.index });
}

const rules = {};
for (let i = 0; i < headers.length; i++) {
  const h = headers[i];
  const code = PART_TO_CODE[h.part];
  if (!code) continue;
  const end = i + 1 < headers.length ? headers[i + 1].startIdx : md.length;
  // Trim the "## Part N: …" line itself off the body
  const lineEnd = md.indexOf('\n', h.startIdx) + 1;
  const body = md.slice(lineEnd, end).trim();
  rules[code] = { title: h.title, body };
  // Part 9 covers both V and Vg — duplicate
  if (h.part === 9) rules.Vg = { title: h.title + ' (Vegetarian)', body };
}

fs.writeFileSync(OUT, JSON.stringify(rules, null, 2));
console.log(`Wrote ${Object.keys(rules).length} protocol rule blocks to ${OUT}`);
console.log('Protocols:', Object.keys(rules).join(', '));
