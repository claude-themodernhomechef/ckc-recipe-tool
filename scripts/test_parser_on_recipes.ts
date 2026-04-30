/**
 * test_parser_on_recipes.ts
 *
 * Pulls a hand-picked set of recipes from Firestore and runs every ingredient
 * through the production parser, then prints a readable before/after report.
 * Use this to sanity-check parser changes on real data before reprocessing
 * the full queue.
 *
 * Usage:  npx tsx scripts/test_parser_on_recipes.ts
 */

import * as admin from 'firebase-admin';
import * as path from 'path';

import { parseIngredient, splitIngredientLine } from '../ckc-consumer-app/lib/ingredientParser';

const sa = require(path.join(__dirname, '../service-account.json'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

// Partial-match titles so capitalization/punctuation differences don't matter
const RECIPE_TITLE_PATTERNS = [
  /spicy sesame butter chicken/i,
  /chicken fajitas/i,
  /honey mustard.*chicken legs/i,
  /ina garten.*mustard.*chicken/i,
  /preserved lemons.*green olives/i,
  /simple crispy chicken thighs/i,
  /pan.?seared cod.*niçoise|pan.?seared cod.*nicoise/i,
  /one.?pan roast chicken.*shallots.*mustard/i,
];

function fmtName(name: string): string {
  if (!name) return '(skipped)';
  return name;
}

async function main() {
  console.log('Fetching recipes from Firestore...');
  const snap = await db.collection('recipes').get();

  const recipes: any[] = [];
  snap.forEach(doc => {
    const d = doc.data();
    const name = d.name || '';
    for (const pat of RECIPE_TITLE_PATTERNS) {
      if (pat.test(name)) {
        recipes.push({ id: doc.id, name, ingredients: d.ingredients || [], status: d.status });
        break;
      }
    }
  });

  recipes.sort((a, b) => a.name.localeCompare(b.name));
  console.log(`Found ${recipes.length} recipes matching the test set\n`);

  for (const recipe of recipes) {
    console.log('━'.repeat(90));
    console.log(`📖  ${recipe.name}    [${recipe.status}]`);
    console.log('━'.repeat(90));

    if (!recipe.ingredients.length) { console.log('  (no ingredients)\n'); continue; }

    // Two-column: raw → parsed (after running splitIngredientLine on each)
    const maxRawLen = Math.min(60, Math.max(...recipe.ingredients.map((r: string) => (r || '').length)));
    for (const raw of recipe.ingredients) {
      if (!raw || !raw.trim()) continue;
      const splits = splitIngredientLine(raw);
      const rawShort = raw.length > maxRawLen ? raw.slice(0, maxRawLen - 1) + '…' : raw;
      splits.forEach((segment, idx) => {
        const p = parseIngredient(segment);
        const qtyDisplay = p.qty ? `${p.qty}${p.unit ? ' ' + p.unit : ''}` : (p.unit || '');
        const display = qtyDisplay ? `${qtyDisplay} | ${fmtName(p.name)}` : fmtName(p.name);
        const left = idx === 0 ? rawShort.padEnd(maxRawLen) : ''.padEnd(maxRawLen);
        const arrow = idx === 0 ? '  →  ' : '   ↳  ';
        console.log(`  ${left}${arrow}${display}`);
      });
    }
    console.log('');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
