#!/usr/bin/env node
/**
 * check_images.js
 * Visits each recipe URL in Chrome (Puppeteer), checks for 404,
 * and grabs the og:image if the page is live.
 *
 * Reads:  /tmp/missing_images.json
 * Writes: /tmp/image_check_results.json
 *   { id: { status: 'live'|'404'|'error', image: '...' } }
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

const MISSING = JSON.parse(fs.readFileSync('/tmp/missing_images.json', 'utf8'));
const RESULTS_FILE = '/tmp/image_check_results.json';
const SLEEP_MS = 800;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function checkPage(page, url) {
  let httpStatus = null;

  // Capture HTTP response status
  const handler = res => {
    if (res.url().split('?')[0].split('#')[0] === url.split('?')[0].split('#')[0]) {
      httpStatus = res.status();
    }
  };
  page.on('response', handler);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  } catch(e) {
    page.off('response', handler);
    return { status: 'error', image: '', error: e.message.slice(0, 80) };
  }
  page.off('response', handler);

  // Check for 404 indicators
  const is404 = await page.evaluate(() => {
    const title = document.title.toLowerCase();
    const body = document.body?.innerText?.toLowerCase() || '';
    return title.includes('404') || title.includes('not found') || title.includes('page not found') ||
           body.includes('page not found') || body.includes('404 error') ||
           body.includes("couldn't find") || body.includes('does not exist');
  });

  if (httpStatus === 404 || is404) {
    return { status: '404', image: '' };
  }

  // Grab og:image
  const image = await page.evaluate(() => {
    const og = document.querySelector('meta[property="og:image"]');
    if (og) return og.content.trim();
    // Fallback: JSON-LD image
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(s.textContent);
        const items = data['@graph'] ? data['@graph'] : [data];
        for (const item of items) {
          if (item['@type'] === 'Recipe') {
            let img = item.image;
            if (Array.isArray(img)) img = img[0];
            if (typeof img === 'object') img = img.url;
            if (img) return img.trim();
          }
        }
      } catch(_) {}
    }
    return '';
  });

  return { status: 'live', image };
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox',
           '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36']
  });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

  const results = {};
  let live = 0, notFound = 0, errors = 0, gotImage = 0;

  for (let i = 0; i < MISSING.length; i++) {
    const rec = MISSING[i];
    process.stdout.write(`[${i+1}/${MISSING.length}] ${rec.name.slice(0,45).padEnd(45)} `);

    const result = await checkPage(page, rec.url);
    results[rec.id] = { ...result, name: rec.name, url: rec.url };

    if (result.status === '404') {
      notFound++;
      console.log(`❌ 404`);
    } else if (result.status === 'error') {
      errors++;
      console.log(`⚠ error: ${result.error}`);
    } else {
      live++;
      if (result.image) { gotImage++; console.log(`✓ image found`); }
      else console.log(`— live but no image`);
    }

    await sleep(SLEEP_MS);
  }

  await browser.close();
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

  console.log(`\n── Summary ──`);
  console.log(`  Live + image:  ${gotImage}`);
  console.log(`  Live no image: ${live - gotImage}`);
  console.log(`  404:           ${notFound}`);
  console.log(`  Errors:        ${errors}`);
  console.log(`\nResults → ${RESULTS_FILE}`);
})();
