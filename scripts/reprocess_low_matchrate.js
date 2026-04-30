/**
 * reprocess_low_matchrate.js
 *
 * Phase 3 — clears stale progress entries for recipes that previously failed
 * to fully match, so the next nutrition build picks them up using the
 * improved ingredient DB and learned aliases.
 *
 * Usage:
 *   node scripts/reprocess_low_matchrate.js               # default: <100% matchRate
 *   node scripts/reprocess_low_matchrate.js --threshold 80
 *   node scripts/reprocess_low_matchrate.js --all         # clear everything
 *   node scripts/reprocess_low_matchrate.js --dry         # preview only
 *
 * After running this, run:
 *   npx tsx scripts/build_recipe_nutrition_v2.ts
 *   node scripts/write_recipe_nutrition_v2.js
 */

const fs   = require('fs');
const path = require('path');

const PROGRESS_FILE = path.join(__dirname, '../data/recipe_nutrition_v2_progress.json');
const BACKUP_FILE   = path.join(__dirname, '../data/recipe_nutrition_v2_progress.backup.json');

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const ALL = args.includes('--all');
const thresholdIdx = args.indexOf('--threshold');
const THRESHOLD = thresholdIdx >= 0 ? parseInt(args[thresholdIdx + 1], 10) : 100;

if (!fs.existsSync(PROGRESS_FILE)) {
  console.error(`Progress file not found: ${PROGRESS_FILE}`);
  process.exit(1);
}

const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
const total = Object.keys(progress).length;

const toClear = [];
for (const [id, entry] of Object.entries(progress)) {
  if (ALL) { toClear.push(id); continue; }
  const rate = entry.matchRate ?? 0;
  if (rate < THRESHOLD) toClear.push(id);
}

console.log(`Total recipes in progress file: ${total}`);
console.log(`Mode: ${ALL ? 'all' : `matchRate < ${THRESHOLD}%`}`);
console.log(`Will clear: ${toClear.length} entries`);

if (toClear.length === 0) {
  console.log('Nothing to clear. Exiting.');
  process.exit(0);
}

// Show a sample
console.log('\nSample of entries to clear:');
for (const id of toClear.slice(0, 10)) {
  const e = progress[id];
  console.log(`  ${id.slice(0, 30).padEnd(30)}  matchRate=${e.matchRate ?? '?'}%`);
}
if (toClear.length > 10) console.log(`  ... and ${toClear.length - 10} more`);

if (DRY) {
  console.log('\nDRY RUN — no changes written.');
  process.exit(0);
}

// Backup
fs.writeFileSync(BACKUP_FILE, JSON.stringify(progress, null, 2));
console.log(`\nBacked up to: ${path.basename(BACKUP_FILE)}`);

// Clear
for (const id of toClear) delete progress[id];
fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));

console.log(`Cleared ${toClear.length} stale entries.`);
console.log(`Remaining: ${Object.keys(progress).length}`);
console.log('\nNext steps:');
console.log('  1. npx tsx scripts/build_recipe_nutrition_v2.ts');
console.log('  2. node scripts/write_recipe_nutrition_v2.js');
