/**
 * sample_100_parsed.ts
 *
 * Pulls 100 recipes from Firestore (sorted worst-first by match rate from the
 * latest audit) and writes raw → parsed output for every ingredient into a
 * readable file: data/audit_100_recipes.txt
 *
 * Use this to manually scan for parsing patterns that still look wrong.
 *
 * Usage:  npx tsx scripts/sample_100_parsed.ts
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

import { parseIngredient, splitIngredientLine, fmtQty } from '../ckc-consumer-app/lib/ingredientParser';

const SA_PATH       = path.join(__dirname, '../service-account.json');
const AUDIT_RECIPES = path.join(__dirname, '../data/audit_low_matchrate_recipes.csv');
const OUT_PATH      = path.join(__dirname, '../data/audit_100_recipes.txt');

const sa = require(SA_PATH);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

function fmtParsed(p: { qty: number; unit: string; name: string; category: string }): string {
  if (!p.name && !p.qty) return '(skipped)';
  // Serving markers ("to taste", "to serve", "to garnish") aren't real units —
  // show them with a "|" separator so they don't look like a quantity.
  if (!p.qty && p.unit) return `${p.unit} | ${p.name}`;
  if (p.qty) return `${fmtQty(p.qty, p.unit, p.category)} ${p.name}`;
  return p.name;
}

async function main() {
  const N = 100;

  console.log('Loading worst-matched recipe IDs from latest audit...');
  if (!fs.existsSync(AUDIT_RECIPES)) {
    console.error(`Audit file not found: ${AUDIT_RECIPES}`);
    console.error('Run `npx tsx scripts/audit_pipeline_health.ts` first.');
    process.exit(1);
  }

  // CSV columns: recipe_id, recipe_name, status, ingredients_counted, ingredients_matched, match_rate_pct, open_review_items
  const csvLines = fs.readFileSync(AUDIT_RECIPES, 'utf8').split('\n').slice(1).filter(l => l.trim());
  // Take first N (CSV is already sorted ascending by match_rate_pct)
  const targetIds = csvLines.slice(0, N).map(line => {
    const m = line.match(/^("([^"]|"")*"|[^,]*),/);
    return m ? m[1].replace(/^"|"$/g, '').replace(/""/g, '"') : '';
  }).filter(Boolean);

  console.log(`Fetching ${targetIds.length} recipes from Firestore...`);

  // Firestore `in` queries cap at 30 per call, so chunk
  const recipes: Array<{ id: string; name: string; status: string; ingredients: string[]; matchRate: number }> = [];
  for (let i = 0; i < targetIds.length; i += 30) {
    const chunk = targetIds.slice(i, i + 30);
    const snap = await db.collection('recipes').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
    snap.forEach(doc => {
      const d = doc.data();
      // Find match_rate from CSV
      const csvRow = csvLines.find(l => l.startsWith(`${doc.id},`) || l.startsWith(`"${doc.id}",`));
      const matchRate = csvRow ? parseInt(csvRow.split(',')[5] || '0', 10) : 0;
      recipes.push({
        id: doc.id,
        name: d.name || '(untitled)',
        status: d.status || '?',
        ingredients: d.ingredients || [],
        matchRate,
      });
    });
  }

  // Re-sort by match rate to preserve the audit's worst-first order
  recipes.sort((a, b) => a.matchRate - b.matchRate);

  // Build the report
  const out: string[] = [];
  out.push('━'.repeat(100));
  out.push('  RECIPE PARSER REVIEW — 100 worst-matched recipes (lowest match rate first)');
  out.push('━'.repeat(100));
  out.push('');
  out.push('Format:  raw ingredient string  →  parsed display');
  out.push('         If splitter produces multiple, each split line shown with ↳');
  out.push('         "qty unit name" or "marker | name" if no qty');
  out.push('');

  for (const recipe of recipes) {
    out.push('═'.repeat(100));
    out.push(`📖  ${recipe.name}    [${recipe.status}]    match rate: ${recipe.matchRate}%`);
    out.push(`    ${recipe.id}`);
    out.push('═'.repeat(100));

    if (!recipe.ingredients.length) { out.push('  (no ingredients)\n'); continue; }

    const maxRawLen = Math.min(70, Math.max(20, ...recipe.ingredients.map(r => (r || '').length)));
    for (const raw of recipe.ingredients) {
      if (!raw || !raw.trim()) continue;
      const splits = splitIngredientLine(raw);
      const rawShort = raw.length > maxRawLen ? raw.slice(0, maxRawLen - 1) + '…' : raw;
      splits.forEach((segment, idx) => {
        const p = parseIngredient(segment);
        const display = fmtParsed(p);
        const left = idx === 0 ? rawShort.padEnd(maxRawLen) : ''.padEnd(maxRawLen);
        const arrow = idx === 0 ? '  →  ' : '   ↳  ';
        out.push(`  ${left}${arrow}${display}`);
      });
    }
    out.push('');
  }

  fs.writeFileSync(OUT_PATH, out.join('\n'));
  console.log(`\nWrote ${recipes.length} recipes (${out.length} lines) → ${OUT_PATH}`);
  console.log('Open the file in your editor and scan for patterns that look wrong.');
}

main().catch(err => { console.error(err); process.exit(1); });
