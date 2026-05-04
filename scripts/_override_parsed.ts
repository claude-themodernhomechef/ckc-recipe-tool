/**
 * Apply per-recipe overrides to parsedIngredients on Firestore.
 *
 * Usage:
 *   _override_parsed.ts <recipeId> <indexOrRange> <op> [args]
 *
 * Operations:
 *   skip <reason>            Mark item(s) skip:true with reason
 *   qty <number>             Update qty
 *   unit <string>            Update unit
 *   name <string>            Update name
 *   set "{...JSON...}"       Replace fields with JSON-merged object
 *
 * Examples:
 *   skip 0 "served_separately"
 *   qty 3 0.2                        # cap fry oil to 0.2 cup
 *   set 0 '{"qty":2,"unit":"oz","name":"canned chickpeas"}'
 */
import * as admin from 'firebase-admin';
import * as path from 'path';
const sa = require(path.join(__dirname, '../service-account.json'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

(async () => {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error('Usage: _override_parsed <recipeId> <index> <op> [args...]');
    process.exit(1);
  }
  const [recipeId, idxStr, op, ...rest] = args;
  const doc = await db.collection('recipes').doc(recipeId).get();
  if (!doc.exists) { console.error('Recipe not found'); process.exit(1); }
  const r = doc.data()!;
  const parsed = (r.parsedIngredients || []).slice();
  const idx = parseInt(idxStr);
  if (idx < 0 || idx >= parsed.length) {
    console.error(`Index ${idx} out of range (0-${parsed.length - 1})`);
    process.exit(1);
  }
  const before = { ...parsed[idx] };
  switch (op) {
    case 'skip':
      parsed[idx] = { ...parsed[idx], skip: true, skipReason: rest[0] || 'manual_override', override: true };
      break;
    case 'qty':
      parsed[idx] = { ...parsed[idx], qty: parseFloat(rest[0]), override: true };
      break;
    case 'unit':
      parsed[idx] = { ...parsed[idx], unit: rest[0], override: true };
      break;
    case 'name':
      parsed[idx] = { ...parsed[idx], name: rest[0], override: true };
      break;
    case 'set':
      parsed[idx] = { ...parsed[idx], ...JSON.parse(rest[0]), override: true };
      break;
    default:
      console.error('Unknown op:', op);
      process.exit(1);
  }
  await db.collection('recipes').doc(recipeId).update({ parsedIngredients: parsed });
  console.log(`✓ ${recipeId}[${idx}]`);
  console.log(`  before: ${JSON.stringify(before)}`);
  console.log(`  after:  ${JSON.stringify(parsed[idx])}`);
  process.exit(0);
})();
