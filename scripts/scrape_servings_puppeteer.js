/**
 * scrape_servings_puppeteer.js
 *
 * Phase 2: Uses Puppeteer (headless Chrome) to extract recipeYield
 * from the 1,062 URLs that failed plain HTTP scraping.
 *
 * Reads data/servings_progress.json, processes only failures,
 * writes results back to the same file.
 *
 * Usage:
 *   node scripts/scrape_servings_puppeteer.js
 */

const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');

const PROGRESS_FILE = path.join(__dirname, '../data/servings_progress.json');

// ─── Extract yield from rendered page ────────────────────────────────────────

async function extractYieldFromPage(page) {
  return await page.evaluate(() => {
    // 1. JSON-LD (most reliable — works after JS renders)
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        const items = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
        for (const item of items) {
          if (item['@type'] === 'Recipe' && item.recipeYield) {
            const y = item.recipeYield;
            if (typeof y === 'number' && y > 0) return { value: y, source: 'jsonld' };
            if (typeof y === 'string') { const m = y.match(/(\d+)/); if (m) return { value: parseInt(m[1]), source: 'jsonld' }; }
            if (Array.isArray(y) && y.length > 0) {
              const m = String(y[0]).match(/(\d+)/);
              if (m) return { value: parseInt(m[1]), source: 'jsonld' };
            }
          }
        }
      } catch(e) {}
    }

    // 2. Common DOM selectors used by recipe plugins
    const selectors = [
      '[class*="servings"] [class*="value"]',
      '[class*="serving"] [class*="number"]',
      '[data-servings]',
      '[class*="yield"] [class*="value"]',
      '.wprm-recipe-servings',
      '.tasty-recipes-yield',
      '.mv-recipe-servings',
      '[class*="recipe-yield"]',
      '.recipe-yield',
      '.servings',
      '[itemprop="recipeYield"]',
    ];
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const text = el.getAttribute('data-servings') || el.textContent;
          const m = text.match(/(\d+)/);
          if (m && parseInt(m[1]) > 0 && parseInt(m[1]) <= 50) {
            return { value: parseInt(m[1]), source: 'dom_selector' };
          }
        }
      } catch(e) {}
    }

    // 3. Page text patterns
    const bodyText = document.body?.innerText || '';
    const patterns = [
      /(?:serves|servings|yield|makes)\s*:?\s*(\d+)/i,
      /(\d+)\s+servings/i,
      /serves?\s+(\d+)/i,
      /makes?\s+(\d+)\s+serv/i,
    ];
    for (const p of patterns) {
      const m = bodyText.match(p);
      if (m && parseInt(m[1]) > 0 && parseInt(m[1]) <= 50) {
        return { value: parseInt(m[1]), source: 'text' };
      }
    }

    return null;
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));

  const todo = Object.values(progress).filter(r =>
    r.source === 'needs_chrome' || r.source === 'error'
  );

  console.log(`${todo.length} URLs to process with Puppeteer\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
    ],
  });

  const page = await browser.newPage();

  // Mimic a real browser
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

  // Block images/fonts/css to speed things up
  await page.setRequestInterception(true);
  page.on('request', req => {
    const type = req.resourceType();
    if (['image', 'stylesheet', 'font', 'media'].includes(type)) req.abort();
    else req.continue();
  });

  let scraped = 0, stillFailed = 0;

  for (let i = 0; i < todo.length; i++) {
    const r = todo[i];
    process.stdout.write(`[${String(i+1).padStart(4)}/${todo.length}] ${r.name.slice(0, 52).padEnd(52)} `);

    try {
      await page.goto(r.url, { waitUntil: 'domcontentloaded', timeout: 15000 });

      // Wait a beat for JS to render
      await sleep(800);

      const result = await extractYieldFromPage(page);

      if (result) {
        progress[r.id] = { ...progress[r.id], servings: result.value, source: result.source };
        console.log(`✓ ${result.value} servings (${result.source})`);
        scraped++;
      } else {
        progress[r.id] = { ...progress[r.id], servings: null, source: 'needs_manual' };
        console.log('✗ needs manual');
        stillFailed++;
      }
    } catch(e) {
      progress[r.id] = { ...progress[r.id], servings: null, source: 'needs_manual', error: e.message.slice(0, 80) };
      console.log(`ERR: ${e.message.slice(0, 40)}`);
      stillFailed++;
    }

    // Save every 50
    if ((i + 1) % 50 === 0) {
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
      console.log(`  [saved — ${i+1} done | scraped: ${scraped} | failed: ${stillFailed}]`);
    }
  }

  await browser.close();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));

  const totalScraped = Object.values(progress).filter(r => r.servings !== null).length;
  const needsManual  = Object.values(progress).filter(r => r.source === 'needs_manual').length;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PUPPETEER SCRAPE COMPLETE');
  console.log(`  Newly scraped:    ${scraped}`);
  console.log(`  Still needs manual: ${needsManual}`);
  console.log(`  Total with servings: ${totalScraped} / ${Object.keys(progress).length}`);
  console.log(`  Saved → data/servings_progress.json`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(e => { console.error(e); process.exit(1); });
