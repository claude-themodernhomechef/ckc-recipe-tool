#!/usr/bin/env node
/**
 * check_images2.js
 * Second pass — waits for full page load + extra time for JS-rendered images.
 * Also tries scrolling to trigger lazy-load, and checks multiple image sources.
 *
 * Reads:  /tmp/missing_images2.json
 * Writes: /tmp/image_check_results2.json
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

const MISSING = JSON.parse(fs.readFileSync('/tmp/missing_images2.json', 'utf8'));
const RESULTS_FILE = '/tmp/image_check_results2.json';
const SLEEP_MS = 1500;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function checkPage(page, url) {
  let httpStatus = null;
  const handler = res => {
    const resUrl = res.url().split('?')[0].split('#')[0];
    const targetUrl = url.split('?')[0].split('#')[0];
    if (resUrl === targetUrl) httpStatus = res.status();
  };
  page.on('response', handler);

  try {
    // Wait for full network idle this time
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
  } catch(e) {
    // Fallback to domcontentloaded
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(2000);
    } catch(e2) {
      page.off('response', handler);
      return { status: 'error', image: '', error: e2.message.slice(0, 80) };
    }
  }
  page.off('response', handler);

  // Scroll to trigger lazy load
  await page.evaluate(() => window.scrollTo(0, 500));
  await sleep(800);

  // Check 404
  const is404 = await page.evaluate(() => {
    const title = document.title.toLowerCase();
    const body = document.body?.innerText?.toLowerCase() || '';
    return title.includes('404') || title.includes('not found') || title.includes('page not found') ||
           body.includes('page not found') || body.includes('404 error') ||
           body.includes("couldn't find") || body.includes('does not exist');
  });

  if (httpStatus === 404 || is404) return { status: '404', image: '' };

  const image = await page.evaluate(() => {
    // 1. og:image
    const og = document.querySelector('meta[property="og:image"]');
    if (og?.content) return og.content.trim();

    // 2. JSON-LD
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

    // 3. twitter:image
    const tw = document.querySelector('meta[name="twitter:image"]');
    if (tw?.content) return tw.content.trim();

    // 4. First large <img> in article/main content
    const containers = ['article', 'main', '.recipe', '.post', '.entry-content', '.content'];
    for (const sel of containers) {
      const el = document.querySelector(sel);
      if (!el) continue;
      for (const img of el.querySelectorAll('img')) {
        const src = img.src || img.dataset.src || img.dataset.lazySrc || '';
        if (src && img.naturalWidth > 300) return src;
      }
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
  await page.setViewport({ width: 1280, height: 800 });

  const results = {};
  let got = 0, miss = 0, dead = 0, err = 0;

  for (let i = 0; i < MISSING.length; i++) {
    const rec = MISSING[i];
    process.stdout.write(`[${i+1}/${MISSING.length}] ${rec.name.slice(0,45).padEnd(45)} `);

    const result = await checkPage(page, rec.url);
    results[rec.id] = { ...result, name: rec.name, url: rec.url };

    if (result.status === '404')        { dead++; console.log(`❌ 404`); }
    else if (result.status === 'error') { err++;  console.log(`⚠ ${result.error}`); }
    else if (result.image)              { got++;  console.log(`✓ image`); }
    else                                { miss++; console.log(`— no image`); }

    await sleep(SLEEP_MS);
  }

  await browser.close();
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

  console.log(`\n── Summary ──`);
  console.log(`  Got image: ${got}`);
  console.log(`  No image:  ${miss}`);
  console.log(`  404:       ${dead}`);
  console.log(`  Errors:    ${err}`);
  console.log(`\nResults → ${RESULTS_FILE}`);
})();
