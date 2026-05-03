/**
 * remove_emdashes.js
 * ────────────────────
 * Removes em dashes from chefNotes and diet modification notes in Firestore recipes.
 *
 * Usage:
 *   node scripts/remove_emdashes.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ── Firebase ───────────────────────────────────────────────────────────────────

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(require('../service-account.json')) });
}
const db = admin.firestore();

// ── Utility ────────────────────────────────────────────────────────────────────

function removeEmDashes(text) {
  if (!text || typeof text !== 'string') return text;
  // Remove em dashes (—) and replace with regular hyphens or spaces
  return text.replace(/—/g, ' - ');
}

function removeEmDashesFromObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const cleaned = { ...obj };

  // Remove em dashes from chefNotes
  if (cleaned.chefNotes && typeof cleaned.chefNotes === 'string') {
    cleaned.chefNotes = removeEmDashes(cleaned.chefNotes);
  }

  // Remove em dashes from diet modifications (nested structure)
  if (cleaned.dietModifications && typeof cleaned.dietModifications === 'object') {
    Object.keys(cleaned.dietModifications).forEach(diet => {
      const dietData = cleaned.dietModifications[diet];
      if (dietData && typeof dietData === 'object') {
        if (dietData.notes && typeof dietData.notes === 'string') {
          dietData.notes = removeEmDashes(dietData.notes);
        }
        if (dietData.modifications && typeof dietData.modifications === 'string') {
          dietData.modifications = removeEmDashes(dietData.modifications);
        }
      }
    });
  }

  return cleaned;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function pad(str, len) {
  const s = String(str).slice(0, len);
  return s + ' '.repeat(Math.max(0, len - s.length));
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Removing em dashes from Firestore recipes…\n');

  const snap = await db.collection('recipes').get();
  const allDocs = snap.docs;

  console.log(`Total recipes: ${allDocs.length}\n`);

  let updated = 0;
  let unchanged = 0;
  let errors = 0;

  for (let i = 0; i < allDocs.length; i++) {
    const doc = allDocs[i];
    const data = doc.data();
    const label = `[${i + 1}/${allDocs.length}] ${pad(data.name || '', 45)}`;

    try {
      const cleaned = removeEmDashesFromObject(data);

      // Check if anything actually changed
      const dataStr = JSON.stringify(data);
      const cleanedStr = JSON.stringify(cleaned);

      if (dataStr !== cleanedStr) {
        // Only update the fields that changed
        const updates = {};

        if (data.chefNotes !== cleaned.chefNotes) {
          updates.chefNotes = cleaned.chefNotes;
        }

        if (JSON.stringify(data.dietModifications) !== JSON.stringify(cleaned.dietModifications)) {
          updates.dietModifications = cleaned.dietModifications;
        }

        await db.collection('recipes').doc(doc.id).update(updates);
        console.log(`${label} ✓ updated`);
        updated++;
      } else {
        console.log(`${label} – no changes`);
        unchanged++;
      }
    } catch (err) {
      console.log(`${label} ✗ error: ${err.message.slice(0, 60)}`);
      errors++;
    }

    // Throttle updates
    if ((i + 1) % 10 === 0) await sleep(500);
  }

  console.log('\n── Summary ──');
  console.log(`  Updated:   ${updated}`);
  console.log(`  Unchanged: ${unchanged}`);
  console.log(`  Errors:    ${errors}`);
  console.log(`  Total:     ${allDocs.length}`);

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
