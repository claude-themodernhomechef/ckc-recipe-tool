#!/usr/bin/env node
/**
 * scrape_time.js
 * Scrapes prep/cook/total time from all YES recipe pages via Puppeteer.
 * Reads from Firestore, writes totalTime back as a human-readable string.
 *
 * Usage:
 *   node scrape_time.js              # scrape all YES recipes missing time
 *   node scrape_time.js --all        # re-scrape even recipes that already have time
 *   node scrape_time.js --limit 20   # cap at 20 for testing
 *
 * Writes: /tmp/time_results.json  { docId: "45 min" }
 * Then run: python3 apply_time.py  to push to Firestore
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const admin = require('firebase-admin');

// ── Firebase ─────────────────────────────────────────────────────────────────
const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── CLI ───────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const ALL   = args.includes('--all');
const LIMIT = (() => { const i = args.indexOf('--limit'); return i >= 0 ? parseInt(args[i+1]) : 0; })();
const SLEEP_MS = 900;

// ── ISO duration → "X min" / "X hr Y min" ───────────────────────────────────
function parseDuration(iso) {
  if (!iso) return '';
  const h = (iso.match(/(\d+)H/) || [])[1] || 0;
  const m = (iso.match(/(\d+)M/) || [])[1] || 0;
  const total = parseInt(h) * 60 + parseInt(m);
  if (!total) return '';
  if (total < 60) return `${total} min`;
  const hrs = Math.floor(total / 60);
  const mins = total % 60;
  return mins ? `${hrs} hr ${mins} min` : `${hrs} hr`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function scrapePage(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
  } catch(e) {
    try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }); }
    catch(e2) { return { error: e2.message.slice(0, 60) }; }
  }

  try { return await page.evaluate(() => {
    // JSON-LD (most reliable)
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(s.textContent);
        const items = data['@graph'] ? data['@graph'] : [data];
        for (const item of items) {
          if (item['@type'] === 'Recipe') {
            return {
              totalTime: item.totalTime || '',
              prepTime:  item.prepTime  || '',
              cookTime:  item.cookTime  || '',
            };
          }
        }
      } catch(_) {}
    }

    // Fallback: look for visible time elements on page
    const selectors = [
      '[class*="total-time"]', '[class*="totaltime"]',
      '[class*="cook-time"]',  '[class*="cooktime"]',
      '[class*="prep-time"]',  '[class*="preptime"]',
      '.wprm-recipe-total_time-container',
      '.tasty-recipes-total-time',
      '[itemprop="totalTime"]', '[itemprop="cookTime"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const dt = el.getAttribute('datetime') || el.getAttribute('content') || '';
        const text = el.innerText?.trim() || '';
        if (dt || text) return { totalTime: dt, fallbackText: text };
      }
    }
    return {};
  }); } catch(evalErr) { return { error: evalErr.message.slice(0, 60) }; }
}

(async () => {
  console.log('Fetching YES recipes from Firestore...');
  const snap = await db.collection('recipes').where('status', '==', 'yes').get();
  let recipes = snap.docs
    .filter(d => ALL ? true : !d.data().totalTime)
    .map(d => ({ id: d.id, name: d.data().name || '', url: d.data().url || '' }))
    .filter(r => r.url);

  if (LIMIT) recipes = recipes.slice(0, LIMIT);
  console.log(`Scraping time for ${recipes.length} recipes...\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox',
           '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36']
  });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

  // Load any previously saved results (resume-safe)
  let results = {};
  if (fs.existsSync('/tmp/time_results.json')) {
    try { results = JSON.parse(fs.readFileSync('/tmp/time_results.json', 'utf8')); } catch(_) {}
  }
  // Skip already-done recipes
  recipes = recipes.filter(r => !(r.id in results));
  console.log(`Already saved: ${Object.keys(results).length} | Remaining: ${recipes.length}`);
  let found = 0, missing = 0, errors = 0;

  for (let i = 0; i < recipes.length; i++) {
    const rec = recipes[i];
    process.stdout.write(`[${i+1}/${recipes.length}] ${rec.name.slice(0,50).padEnd(50)} `);

    const raw = await scrapePage(page, rec.url);

    if (raw.error) {
      errors++;
      console.log(`⚠ ${raw.error}`);
      await sleep(SLEEP_MS);
      continue;
    }

    // Prefer totalTime, fallback to prepTime+cookTime
    let timeStr = parseDuration(raw.totalTime);
    if (!timeStr && (raw.prepTime || raw.cookTime)) {
      const p = raw.prepTime?.match(/(\d+)H/)?.[1]*60 + raw.prepTime?.match(/(\d+)M/)?.[1]*1 || 0;
      const c = raw.cookTime?.match(/(\d+)H/)?.[1]*60 + raw.cookTime?.match(/(\d+)M/)?.[1]*1 || 0;
      const total = p + c;
      if (total) timeStr = total < 60 ? `${total} min` : `${Math.floor(total/60)} hr${total%60 ? ' ' + total%60 + ' min' : ''}`;
    }
    if (!timeStr && raw.fallbackText) timeStr = raw.fallbackText.slice(0, 20);

    if (timeStr) {
      results[rec.id] = timeStr;
      found++;
      console.log(`✓ ${timeStr}`);
      // Save incrementally every 10 results
      if (found % 10 === 0) fs.writeFileSync('/tmp/time_results.json', JSON.stringify(results, null, 2));
    } else {
      missing++;
      console.log(`— not found`);
    }

    await sleep(SLEEP_MS);
  }

  await browser.close();
  fs.writeFileSync('/tmp/time_results.json', JSON.stringify(results, null, 2));

  console.log(`\n── Summary ──`);
  console.log(`  Found:   ${found}`);
  console.log(`  Missing: ${missing}`);
  console.log(`  Errors:  ${errors}`);
  console.log(`\nRun: python3 apply_time.py  to push to Firestore`);
})();
