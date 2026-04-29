/**
 * fix_butter_chicken_df_note.js
 * ──────────────────────────────
 * Corrects the DF swaps for "Spicy Sesame Butter Chicken".
 *
 * Issues being fixed:
 *   1. Two of three butter swaps targeted olive oil. Because butter is the
 *      identity flavor of butter chicken, all butter should swap to DF butter.
 *   2. A previous run of this script accidentally created a stray
 *      `dietTags.Dairy-Free` key (the real key uses the short code `DF`).
 *      That junk key is removed.
 *
 * Usage:
 *   node scripts/fix_butter_chicken_df_note.js --dry-run
 *   node scripts/fix_butter_chicken_df_note.js
 */

const admin = require('firebase-admin');
const path  = require('path');

const SA_KEY  = path.join(__dirname, '..', 'service-account.json');
const DRY_RUN = process.argv.includes('--dry-run');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(SA_KEY) });
}
const db = admin.firestore();

const RECIPE_ID = '1RsQWRKk2fh71b6UwvlQ';

// Render an array of swap-pair objects into the flowing notesText string
function renderNotesText(notes) {
  return notes.map(n => {
    if (n.type === 'replace') return `Replace ${n.from} with ${n.to}.`;
    if (n.type === 'remove')  return `Remove ${n.from} entirely.`;
    return '';
  }).filter(Boolean).join(' ');
}

async function main() {
  const ref  = db.collection('recipes').doc(RECIPE_ID);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error('Recipe not found:', RECIPE_ID);
    process.exit(1);
  }
  const data = snap.data();

  const dietTags = { ...(data.dietTags || {}) };
  const currentDF = dietTags.DF;
  if (!currentDF) {
    console.error('No DF tag found — aborting to avoid creating a bad shape.');
    process.exit(1);
  }

  console.log('--- CURRENT DF.notes ---');
  console.log(JSON.stringify(currentDF.notes, null, 2));

  // Rewrite each butter→olive-oil swap to butter→DF butter, preserving qty.
  const newNotes = (currentDF.notes || []).map(n => {
    if (
      n.type === 'replace' &&
      /butter/i.test(n.from || '') &&
      /olive oil/i.test(n.to || '')
    ) {
      // "4 tablespoons olive oil" → "4 tablespoons DF butter"
      const fixedTo = n.to.replace(/olive oil/i, 'DF butter');
      return { ...n, to: fixedTo };
    }
    return n;
  });

  const newDF = {
    ...currentDF,
    notes: newNotes,
    notesText: renderNotesText(newNotes),
  };

  console.log('\n--- UPDATED DF.notes ---');
  console.log(JSON.stringify(newDF.notes, null, 2));
  console.log('\n--- UPDATED DF.notesText ---');
  console.log(newDF.notesText);

  // Build the update payload. We use FieldValue.delete() for the stray key.
  const updates = {
    'dietTags.DF': newDF,
  };
  const hasStrayKey = Object.prototype.hasOwnProperty.call(dietTags, 'Dairy-Free');
  if (hasStrayKey) {
    updates['dietTags.Dairy-Free'] = admin.firestore.FieldValue.delete();
    console.log('\nWill remove stray dietTags.Dairy-Free key.');
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No writes.');
    process.exit(0);
  }

  await ref.update(updates);
  console.log('\n✓ Firestore updated.');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
