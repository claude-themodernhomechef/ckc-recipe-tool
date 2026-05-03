/**
 * audit_broken_urls.js
 *
 * Scans ALL recipes in Firestore, checks their source URLs for 404s / dead links,
 * and optionally deletes the broken ones.
 *
 * Phase 1 — audit only (default):
 *   node scripts/audit_broken_urls.js
 *   → Saves broken recipes to broken_urls.json for review
 *
 * Phase 2 — delete after reviewing the list:
 *   node scripts/audit_broken_urls.js --delete
 *   → Reads broken_urls.json and deletes those recipes from Firestore + Storage
 *
 * Options:
 *   --concurrency <n>   Parallel URL checks (default: 8)
 *   --timeout <ms>      Per-request timeout in ms (default: 10000)
 */

'use strict';

const path  = require('path');
const fs    = require('fs');
const admin = require('firebase-admin');
const fetch = (...a) => import('node-fetch').then(({ default: f }) => f(...a));

// ── Firebase init ──────────────────────────────────────────────────────────
const SA_KEY = path.join(__dirname, '..', 'service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(SA_KEY),
  storageBucket: 'ckc-recipe-swipe.firebasestorage.app',
});
const db     = admin.firestore();
const bucket = admin.storage().bucket();

const RESULTS_FILE = path.join(__dirname, '..', 'broken_urls.json');

// ── Helpers ────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { delete: false, concurrency: 8, timeout: 10000 };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--delete')                      args.delete      = true;
    if (argv[i] === '--concurrency' && argv[i + 1]) args.concurrency = parseInt(argv[++i]);
    if (argv[i] === '--timeout'     && argv[i + 1]) args.timeout     = parseInt(argv[++i]);
  }
  return args;
}

async function isUrlBroken(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Try HEAD first (faster, no body download)
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; recipe-checker/1.0)' },
    });
    clearTimeout(timer);
    if (res.status === 404 || res.status === 410) return { broken: true, status: res.status };
    if (res.status === 405 || res.status === 403) {
      // Server doesn't allow HEAD — fall back to GET
      const res2 = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; recipe-checker/1.0)' },
      });
      if (res2.status === 404 || res2.status === 410) return { broken: true, status: res2.status };
      return { broken: false, status: res2.status };
    }
    return { broken: false, status: res.status };
  } catch (e) {
    clearTimeout(timer);
    const msg = e.message || '';
    // DNS failure, connection refused, timeout — treat as broken
    if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') ||
        msg.includes('aborted') || msg.includes('timeout')) {
      return { broken: true, status: 'network_error', error: msg.slice(0, 80) };
    }
    // Other errors (SSL, etc.) — flag for review but don't auto-delete
    return { broken: false, status: 'check_error', error: msg.slice(0, 80) };
  }
}

async function runWithConcurrency(tasks, limit) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  }
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

// ── Phase 1: Audit ─────────────────────────────────────────────────────────
async function auditPhase(args) {
  console.log('Loading recipes from Firestore...');
  const snap = await db.collection('recipes').get();
  const recipes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`Found ${recipes.length} recipes. Checking URLs with concurrency=${args.concurrency}...\n`);

  let checked = 0;
  const broken = [];
  const errors = [];

  const tasks = recipes.map(recipe => async () => {
    const url = recipe.url || recipe.source;
    if (!url) {
      checked++;
      return;
    }

    const result = await isUrlBroken(url, args.timeout);
    checked++;

    const pct  = ((checked / recipes.length) * 100).toFixed(0);
    const name = (recipe.name || recipe.id).slice(0, 50).padEnd(50);

    if (result.broken) {
      broken.push({ id: recipe.id, name: recipe.name || recipe.id, url, status: result.status, error: result.error });
      process.stdout.write(`[${pct}%] ❌ ${name} (${result.status})\n`);
    } else if (result.status === 'check_error') {
      errors.push({ id: recipe.id, name: recipe.name || recipe.id, url, error: result.error });
      process.stdout.write(`[${pct}%] ⚠  ${name} (${result.error})\n`);
    } else {
      process.stdout.write(`[${pct}%] ✓  ${name}\n`);
    }
  });

  await runWithConcurrency(tasks, args.concurrency);

  console.log(`\n── Summary ──────────────────────────────`);
  console.log(`  Total checked : ${checked}`);
  console.log(`  Broken (404s) : ${broken.length}`);
  console.log(`  Check errors  : ${errors.length}`);

  if (broken.length === 0) {
    console.log('\nNo broken URLs found.');
    return;
  }

  const out = { broken, errors, generatedAt: new Date().toISOString() };
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(out, null, 2));

  console.log(`\nBroken recipes saved to: broken_urls.json`);
  console.log(`\nBroken recipes:`);
  broken.forEach(r => console.log(`  - ${r.name} (${r.status})\n    ${r.url}`));
  console.log(`\nTo delete all broken recipes, run:`);
  console.log(`  node scripts/audit_broken_urls.js --delete`);
}

// ── Phase 2: Delete ────────────────────────────────────────────────────────
async function deletePhase() {
  if (!fs.existsSync(RESULTS_FILE)) {
    console.error('broken_urls.json not found. Run without --delete first to audit.');
    process.exit(1);
  }

  const { broken } = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8'));
  if (!broken || broken.length === 0) {
    console.log('No broken recipes to delete.');
    return;
  }

  console.log(`Deleting ${broken.length} broken recipes...\n`);
  let deleted = 0;

  for (const recipe of broken) {
    try {
      // Try to delete image from Storage
      const storagePath = `images/${recipe.id}.jpg`;
      try {
        await bucket.file(storagePath).delete();
        console.log(`  Storage: deleted ${storagePath}`);
      } catch (_) {
        // Try .png fallback
        try { await bucket.file(`images/${recipe.id}.png`).delete(); } catch (_) {}
      }

      await db.collection('recipes').doc(recipe.id).delete();
      console.log(`  ✓ Deleted: ${recipe.name}`);
      deleted++;
    } catch (e) {
      console.error(`  ✗ Failed to delete ${recipe.id}: ${e.message}`);
    }
  }

  console.log(`\nDeleted ${deleted} / ${broken.length} recipes.`);

  // Clear the file after deletion
  fs.unlinkSync(RESULTS_FILE);
  console.log('broken_urls.json removed.');
}

// ── Entry ──────────────────────────────────────────────────────────────────
(async () => {
  const args = parseArgs(process.argv);
  if (args.delete) {
    await deletePhase();
  } else {
    await auditPhase(args);
  }
  process.exit(0);
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
