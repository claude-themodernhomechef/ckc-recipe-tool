/**
 * Write `parsedIngredients` to every recipe in Firestore.
 *
 * For each recipe:
 *   1. Apply splitIngredientLine to each raw ingredient
 *   2. Apply preprocessIngredient + parseIngredient to each split
 *   3. Store an array of { raw, qty, unit, name, category, splitFrom?, skip?, skipReason? }
 *
 * After this runs, the nutrition build can read parsedIngredients directly,
 * and per-recipe overrides can be applied by editing the parsedIngredients
 * field in Firestore (no code changes needed).
 *
 * Re-running this script overwrites parsedIngredients with auto-parser output —
 * so DO NOT re-run after manual edits unless you've backed those up.
 *
 * Usage: npx tsx scripts/write_parsed_ingredients.ts
 *        npx tsx scripts/write_parsed_ingredients.ts --dry-run
 *        npx tsx scripts/write_parsed_ingredients.ts --only=<recipeId>
 */
import * as admin from 'firebase-admin';
import * as path from 'path';
import { parseIngredient, splitIngredientLine } from '../ckc-consumer-app/lib/ingredientParser';

const sa = require(path.join(__dirname, '../service-account.json'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const onlyArg = args.find(a => a.startsWith('--only='));
const onlyId = onlyArg ? onlyArg.split('=')[1] : null;

interface ParsedIng {
  raw: string;             // original recipe line
  splitFrom?: string;      // when split from a parent line, the parent
  qty: number;
  unit: string;
  name: string;
  category: string;
  skip?: boolean;
  skipReason?: string;
  note?: string;
}

function isSkippable(raw: string): { skip: boolean; reason?: string } {
  const t = raw.trim().toLowerCase();
  if (!t) return { skip: true, reason: 'empty' };
  if (t.length <= 2) return { skip: true, reason: 'fragment' };
  if (/^[-–—\/.,;:\s]+$/.test(t)) return { skip: true, reason: 'punctuation' };
  if (/\beach\s*:/i.test(raw)) return { skip: true, reason: 'each_spice' };
  if (/\bto\s+taste\b/i.test(t)) return { skip: true, reason: 'to_taste' };
  if (/^\s*\d+\s+(?:pieces?|slices?|sticks?|sprigs?|stalks?)\s*$/i.test(raw)) {
    return { skip: true, reason: 'piece_fragment' };
  }
  return { skip: false };
}

(async () => {
  console.log(`Loading recipes from Firestore...${dryRun ? ' (DRY RUN)' : ''}`);
  const snap = await db.collection('recipes')
    .where('status', 'in', ['approved', 'needs_review'])
    .get();

  let updated = 0;
  let totalIngs = 0;
  let totalParsed = 0;
  let totalSkipped = 0;

  const recipes: any[] = [];
  snap.forEach(d => {
    const data = d.data();
    if (!data.ingredients || !Array.isArray(data.ingredients)) return;
    if (onlyId && d.id !== onlyId) return;
    recipes.push({ id: d.id, name: data.name, ingredients: data.ingredients });
  });

  console.log(`Processing ${recipes.length} recipes...\n`);

  for (let i = 0; i < recipes.length; i++) {
    const r = recipes[i];
    const parsed: ParsedIng[] = [];

    for (const raw of r.ingredients as string[]) {
      if (!raw || !raw.trim()) continue;
      totalIngs++;

      // Split
      const splits = splitIngredientLine(raw);
      const isSplit = splits.length > 1 || splits[0] !== raw;

      for (const segment of splits) {
        if (!segment || !segment.trim()) continue;

        const skipCheck = isSkippable(segment);
        if (skipCheck.skip) {
          parsed.push({
            raw: segment,
            ...(isSplit ? { splitFrom: raw } : {}),
            qty: 0, unit: '', name: '', category: '',
            skip: true, skipReason: skipCheck.reason,
          });
          totalSkipped++;
          continue;
        }

        const p = parseIngredient(segment);
        parsed.push({
          raw: segment,
          ...(isSplit ? { splitFrom: raw } : {}),
          qty: p.qty,
          unit: p.unit,
          name: p.name || '',
          category: p.category || '',
          ...(p.note ? { note: p.note } : {}),
        });
        totalParsed++;
      }
    }

    if (i % 50 === 0 || i === recipes.length - 1) {
      process.stdout.write(`\r  [${i + 1}/${recipes.length}] ${r.name?.slice(0, 50).padEnd(50) ?? r.id}`);
    }

    if (!dryRun) {
      await db.collection('recipes').doc(r.id).update({ parsedIngredients: parsed });
      updated++;
    }
  }

  console.log('\n');
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Recipes processed:   ${recipes.length}`);
  console.log(`  Recipes updated:     ${updated}${dryRun ? ' (dry run — nothing written)' : ''}`);
  console.log(`  Raw ingredient lines: ${totalIngs}`);
  console.log(`  Parsed ingredients:  ${totalParsed} (after splits)`);
  console.log(`  Skipped fragments:   ${totalSkipped}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
