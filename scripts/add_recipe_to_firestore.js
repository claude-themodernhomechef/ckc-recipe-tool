#!/usr/bin/env node
/**
 * add_recipe_to_firestore.js
 *
 * Called by the CKC recipe sourcing agent to write a single new recipe
 * directly to Firestore as status:"pending".
 *
 * Usage:
 *   node scripts/add_recipe_to_firestore.js '<JSON>'
 *
 * JSON fields:
 *   name, url, blogger, alignmentScore, meal_type, cuisine,
 *   rating, menu_description, protein_type
 *   GF, GF_mod, GF_mod_notes
 *   DF, DF_mod, DF_mod_notes
 *   V,  V_mod,  V_mod_notes
 *   Vg, Vg_mod, Vg_mod_notes
 *   K,  K_mod,  K_mod_notes
 *   AIP, AIP_mod, AIP_mod_notes
 *   LF, LF_mod, LF_mod_notes
 *   LH, LH_mod, LH_mod_notes
 *
 * All diet fields accept 0/1 or true/false. Notes are plain strings.
 *
 * Exit 0 on success (including if recipe already exists — safe to retry).
 * Exit 1 on error.
 */

'use strict';

const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

// ── Firebase init ─────────────────────────────────────────────────────────────

function initFirebase() {
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  let credential;
  if (saJson) {
    credential = admin.credential.cert(JSON.parse(saJson));
  } else {
    // Walk up from script dir looking for service-account.json
    let dir = __dirname;
    for (let i = 0; i < 6; i++) {
      const candidate = path.join(dir, 'service-account.json');
      if (fs.existsSync(candidate)) {
        credential = admin.credential.cert(require(candidate));
        break;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  if (!credential) {
    console.error('❌ No Firebase credentials found.');
    console.error('   Set FIREBASE_SERVICE_ACCOUNT env var or place service-account.json in the repo root.');
    process.exit(1);
  }
  admin.initializeApp({ credential });
  return admin.firestore();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugifyUrl(url) {
  try {
    const pathname = new URL(url).pathname.replace(/\/$/, '');
    return pathname.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').toLowerCase().slice(0, 100).replace(/^-|-$/g, '');
  } catch {
    return url.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').toLowerCase().slice(0, 100);
  }
}

function normalizeBool(v) {
  if (typeof v === 'boolean') return v;
  if (v === 1 || v === '1' || v === 'true') return true;
  return false;
}

const MEAL_TYPE_MAP = {
  'entree':     'entree',
  'main':       'entree',
  'main dish':  'entree',
  'side dish':  'side',
  'side':       'side',
  'appetizer':  'appetizer',
  'dessert':    'dessert',
  'breakfast':  'breakfast',
  'soup':       'soup',
  'salad':      'salad',
};

function mapMealType(raw) {
  return MEAL_TYPE_MAP[(raw || '').toLowerCase().trim()] || 'entree';
}

function buildDietTags(r) {
  const tags = {};
  for (const protocol of ['GF', 'DF', 'V', 'Vg', 'K', 'AIP', 'LF', 'LH']) {
    const native = normalizeBool(r[protocol]);
    const mod    = normalizeBool(r[`${protocol}_mod`] ?? r[`${protocol} Mod`]);
    const notes  = (r[`${protocol}_mod_notes`] ?? r[`${protocol} Mod Notes`] ?? '').trim();
    if (native || mod) {
      tags[protocol] = { native, mod, notes };
    } else {
      tags[protocol] = { native: false, mod: false, notes: '' };
    }
  }
  return tags;
}

// ── Append URL to urls.txt for agent dedup ────────────────────────────────────

function appendToUrlsTxt(url) {
  // Find urls.txt by walking up from script dir
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, 'urls.txt');
    if (fs.existsSync(candidate)) {
      fs.appendFileSync(candidate, url + '\n', 'utf-8');
      return;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // If urls.txt doesn't exist yet, create it at repo root (parent of scripts/)
  const repoRoot = path.dirname(__dirname);
  fs.appendFileSync(path.join(repoRoot, 'urls.txt'), url + '\n', 'utf-8');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const jsonArg = process.argv[2];
  if (!jsonArg) {
    console.error('Usage: node add_recipe_to_firestore.js \'<JSON>\'');
    process.exit(1);
  }

  let recipe;
  try {
    recipe = JSON.parse(jsonArg);
  } catch (e) {
    console.error('❌ Invalid JSON:', e.message);
    process.exit(1);
  }

  const { name, url, blogger, alignmentScore, meal_type, cuisine, rating, menu_description, protein_type } = recipe;

  if (!name || !url) {
    console.error('❌ Recipe must have at least name and url');
    process.exit(1);
  }

  const db    = initFirebase();
  const docId = slugifyUrl(url);

  // Dedup: skip if already in Firestore
  const existing = await db.collection('recipes').doc(docId).get();
  if (existing.exists) {
    console.log(`⏭  Already exists: ${docId} — skipping`);
    process.exit(0);
  }

  const doc = {
    name:             name.trim(),
    url:              url.trim(),
    blogger:          (blogger || '').trim(),
    alignmentScore:   typeof alignmentScore === 'number' ? alignmentScore : parseInt(alignmentScore) || null,
    meal_type:        mapMealType(meal_type),
    cuisine:          (cuisine || '').trim(),
    rating:           (rating || '').trim(),
    menu_description: (menu_description || '').trim(),
    protein_type:     (protein_type || '').trim(),
    dietTags:         buildDietTags(recipe),
    ingredients:      [],         // will be filled by enrichment Cloud Function
    photo_url:        null,
    image:            null,
    status:           'pending',
    sourceAddedAt:    admin.firestore.FieldValue.serverTimestamp(),
    needsManualReview: false,
  };

  await db.collection('recipes').doc(docId).set(doc);
  appendToUrlsTxt(url.trim());

  console.log(`✅ Added: ${name} (${docId})`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
