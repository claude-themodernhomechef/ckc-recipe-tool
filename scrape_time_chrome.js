#!/usr/bin/env node
/**
 * scrape_time_chrome.js
 * Parallel Puppeteer scraper for recipes still missing totalTime.
 * Reads missing recipes from Firestore, scrapes with N concurrent pages,
 * then writes totalTime back to Firestore directly.
 *
 * Usage:
 *   node scrape_time_chrome.js              # 5 concurrent pages
 *   node scrape_time_chrome.js --concurrency 8
 */

const puppeteer = require('puppeteer');
const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const args = process.argv.slice(2);
const CONCURRENCY = (() => {
  const i = args.indexOf('--concurrency');
  return i >= 0 ? parseInt(args[i + 1]) : 5;
})();
const RESULTS_FILE = '/tmp/time_results_chrome.json';
const SLEEP_MS = 600;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseDuration(iso) {
  if (!iso) return '';
  const h = parseInt((iso.match(/(\d+)H/) || [])[1] || 0);
  const m = parseInt((iso.match(/(\d+)M/) || [])[1] || 0);
  const total = h * 60 + m;
  if (!total) return '';
  if (total < 60) return `${total} min`;
  const hrs = Math.floor(total / 60);
  const mins = total % 60;
  return mins ? `${hrs} hr ${mins} min` : `${hrs} hr`;
}

async function scrapePage(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
  } catch (e) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(1500);
    } catch (e2) {
      return { error: e2.message.slice(0, 60) };
    }
  }

  try {
    return await page.evaluate(() => {
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
        } catch (_) {}
      }
      // Fallback: visible time elements
      const selectors = [
        '[class*="total-time"]', '[class*="totaltime"]',
        '[class*="cook-time"]', '[class*="cooktime"]',
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
    });
  } catch (evalErr) {
    return { error: evalErr.message.slice(0, 60) };
  }
}

async function processRecipe(page, rec) {
  const raw = await scrapePage(page, rec.url);
  if (raw.error) return { id: rec.id, name: rec.name, timeStr: null, err: raw.error };

  let timeStr = parseDuration(raw.totalTime);
  if (!timeStr && (raw.prepTime || raw.cookTime)) {
    const p = (raw.prepTime?.match(/(\d+)H/)?.[1] || 0) * 60 + parseInt(raw.prepTime?.match(/(\d+)M/)?.[1] || 0);
    const c = (raw.cookTime?.match(/(\d+)H/)?.[1] || 0) * 60 + parseInt(raw.cookTime?.match(/(\d+)M/)?.[1] || 0);
    const total = p + c;
    if (total) timeStr = total < 60 ? `${total} min` : `${Math.floor(total/60)} hr${total%60 ? ' ' + total%60 + ' min' : ''}`;
  }
  if (!timeStr && raw.fallbackText) timeStr = raw.fallbackText.slice(0, 20);

  return { id: rec.id, name: rec.name, timeStr: timeStr || null, err: null };
}

(async () => {
  console.log('Fetching recipes missing totalTime from Firestore...');
  const snap = await db.collection('recipes').where('status', '==', 'yes').get();
  const recipes = snap.docs
    .filter(d => !d.data().totalTime && d.data().url)
    .map(d => ({ id: d.id, name: d.data().name || '', url: d.data().url }));

  console.log(`Missing time: ${recipes.length} | Concurrency: ${CONCURRENCY}\n`);

  if (!recipes.length) {
    console.log('Nothing to do!');
    process.exit(0);
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
  });

  // Create pool of pages
  const pages = await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      const p = await browser.newPage();
      await p.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
      await p.setViewport({ width: 1280, height: 800 });
      return p;
    })
  );

  const results = {};
  let found = 0, missing = 0, errors = 0, done = 0;
  const total = recipes.length;

  // Process in batches of CONCURRENCY
  for (let i = 0; i < recipes.length; i += CONCURRENCY) {
    const batch = recipes.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((rec, idx) => processRecipe(pages[idx], rec))
    );

    const firestoreWrites = [];
    for (const result of batchResults) {
      done++;
      if (result.timeStr) {
        results[result.id] = result.timeStr;
        found++;
        console.log(`[${done}/${total}] ${result.name.slice(0, 50).padEnd(50)} ✓ ${result.timeStr}`);
        firestoreWrites.push(
          db.collection('recipes').doc(result.id).update({ totalTime: result.timeStr })
        );
      } else if (result.err) {
        errors++;
        console.log(`[${done}/${total}] ${result.name.slice(0, 50).padEnd(50)} ⚠ ${result.err}`);
      } else {
        missing++;
        console.log(`[${done}/${total}] ${result.name.slice(0, 50).padEnd(50)} — not found`);
      }
    }

    // Write to Firestore and save file in parallel with next batch
    if (firestoreWrites.length) await Promise.all(firestoreWrites);
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

    await sleep(SLEEP_MS);
  }

  await browser.close();

  console.log(`\n── Summary ──`);
  console.log(`  Found:   ${found}`);
  console.log(`  Missing: ${missing}`);
  console.log(`  Errors:  ${errors}`);
  console.log(`\nWrote ${found} times directly to Firestore.`);
})();
