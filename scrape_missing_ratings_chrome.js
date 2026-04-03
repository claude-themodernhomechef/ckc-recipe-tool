#!/usr/bin/env node
/**
 * scrape_missing_ratings_chrome.js
 * Puppeteer scraper for YES recipes missing a rating.
 * Reads missing recipes from Firestore, scrapes with N concurrent pages,
 * writes rating directly back to Firestore.
 *
 * Usage:
 *   node scrape_missing_ratings_chrome.js
 *   node scrape_missing_ratings_chrome.js --concurrency 3
 */

const puppeteer = require('puppeteer');
const admin     = require('firebase-admin');

const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const args = process.argv.slice(2);
const CONCURRENCY = (() => {
  const i = args.indexOf('--concurrency');
  return i >= 0 ? parseInt(args[i + 1]) : 3;
})();
const SLEEP_MS = 800;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function scrapePage(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  } catch (e) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await sleep(3000);
    } catch (e2) {
      return { error: e2.message.slice(0, 80) };
    }
  }

  // Extra wait for JS-heavy sites to finish rendering ratings
  await sleep(2000);

  try {
    return await page.evaluate(() => {
      // 1. JSON-LD
      for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          const data  = JSON.parse(s.textContent);
          const items = data['@graph'] ? data['@graph'] : (Array.isArray(data) ? data : [data]);
          for (const item of items) {
            if (item['@type'] === 'Recipe' && item.aggregateRating) {
              const agg = item.aggregateRating;
              const rv  = parseFloat(agg.ratingValue || '');
              const rc  = parseInt(agg.ratingCount || agg.reviewCount || '');
              if (rv > 0 && rv <= 5 && rc > 0) {
                return { ratingValue: rv, ratingCount: rc };
              }
            }
          }
        } catch (_) {}
      }

      // 2. Microdata
      const rvEl = document.querySelector('[itemprop="ratingValue"]');
      const rcEl = document.querySelector('[itemprop="ratingCount"]') ||
                   document.querySelector('[itemprop="reviewCount"]');
      if (rvEl && rcEl) {
        const rv = parseFloat(rvEl.getAttribute('content') || rvEl.innerText);
        const rc = parseInt(rcEl.getAttribute('content')   || rcEl.innerText);
        if (rv > 0 && rv <= 5 && rc > 0) return { ratingValue: rv, ratingCount: rc };
      }

      // 3. Text patterns — multiple formats
      const text = document.body?.innerText || '';

      const patterns = [
        // "4.8 from 312 reviews" / "5 from 1 review" / "4.82 from 22 votes"
        /([\d.]+)\s+from\s+([\d,]+)\s+(?:reviews?|votes?|ratings?)/i,
        // "4.7 (638)" or "4.5 (128)" — allrecipes/foodandwine/thekitchn style
        // Must start with a real score (3.0–5.0) followed by count in parens — not a generic number
        /\b([345](?:\.\d)?)\s*\(([\d,]+)\)(?:\s*\||\s*READ|\s*REVIEWS|\s*ratings?)?/i,
        // "4.5 ★★★★½ 22 Ratings" / "5.0 ★★★★★ 6 Ratings" — food52 style
        // Require score 3–5 to avoid false positives like "2 (1 ratings)"
        /\b([345](?:\.\d{1,2})?)\s+[★✩]+[\s\S]{0,15}?([\d,]+)\s+ratings?/i,
        // "Rated X out of 5"
        /rated\s+([\d.]+)\s+out\s+of\s+5[\s\S]{0,30}?([\d,]+)/i,
      ];

      for (const pat of patterns) {
        const m = text.match(pat);
        if (m) {
          const rv = parseFloat(m[1]);
          const rc = m[2] ? parseInt(m[2].replace(/,/g, '')) : 1;
          if (rv > 0 && rv <= 5 && rc > 0) {
            return { ratingValue: rv, ratingCount: rc, source: 'text' };
          }
        }
      }

      return {};
    });
  } catch (evalErr) {
    return { error: evalErr.message.slice(0, 80) };
  }
}

(async () => {
  console.log('Fetching YES recipes missing ratings from Firestore…');
  const snap = await db.collection('recipes').where('status', '==', 'yes').get();
  const recipes = snap.docs
    .filter(d => {
      const r = d.data().rating;
      return (!r || r === 'NR' || r === '') && d.data().url;
    })
    .map(d => ({ id: d.id, name: d.data().name || '', url: d.data().url }));

  console.log(`Missing ratings: ${recipes.length} | Concurrency: ${CONCURRENCY}\n`);

  if (!recipes.length) {
    console.log('Nothing to do!');
    process.exit(0);
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ],
  });

  const pages = await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      const p = await browser.newPage();
      await p.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
      await p.setViewport({ width: 1280, height: 800 });
      return p;
    })
  );

  let found = 0, missing = 0, errors = 0, done = 0;
  const total = recipes.length;

  for (let i = 0; i < recipes.length; i += CONCURRENCY) {
    const batch = recipes.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (rec, idx) => {
        const raw = await scrapePage(pages[idx], rec.url);
        return { rec, raw };
      })
    );

    const writes = [];
    for (const { rec, raw } of batchResults) {
      done++;
      const label = `[${done}/${total}] ${rec.name.slice(0, 52).padEnd(52)}`;

      if (raw.error) {
        errors++;
        console.log(`${label} ⚠ ${raw.error}`);
      } else if (raw.ratingValue) {
        const display = `${raw.ratingValue} (${raw.ratingCount.toLocaleString()} ratings)`;
        console.log(`${label} ★ ${display}`);
        found++;
        writes.push(
          db.collection('recipes').doc(rec.id).update({ rating: display })
        );
      } else {
        missing++;
        console.log(`${label} — not found`);
      }
    }

    if (writes.length) await Promise.all(writes);
    await sleep(SLEEP_MS);
  }

  await browser.close();

  console.log(`\n── Summary ──`);
  console.log(`  Found:     ${found}`);
  console.log(`  Not found: ${missing}`);
  console.log(`  Errors:    ${errors}`);
  console.log(`\nWrote ${found} ratings directly to Firestore.`);
})();
