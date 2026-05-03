/**
 * scrape_servings_chrome_profile.js
 *
 * Uses Puppeteer with the user's real Chrome profile — bypasses
 * Cloudflare, paywalls, and bot detection using existing cookies/logins.
 *
 * Processes only the remaining 288 URLs from chrome_queue.json.
 * Saves results to data/chrome_results.json (resumable).
 *
 * Usage: node scripts/scrape_servings_chrome_profile.js
 */

const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');

const CHROME_PATH    = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE_DIR    = path.join(process.env.HOME, 'Library/Application Support/Google/Chrome');
const QUEUE_FILE     = path.join(__dirname, '../data/chrome_queue.json');
const RESULTS_FILE   = path.join(__dirname, '../data/chrome_results.json');
const SERVINGS_FILE  = path.join(__dirname, '../data/servings_progress.json');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function extractYield() {
  // Runs inside the page context
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  for (const s of scripts) {
    try {
      const d = JSON.parse(s.textContent);
      const items = Array.isArray(d) ? d : d['@graph'] ? d['@graph'] : [d];
      for (const item of items) {
        if (item['@type'] === 'Recipe' && item.recipeYield) {
          const y = item.recipeYield;
          if (typeof y === 'number' && y > 0) return y;
          if (typeof y === 'string') { const m = y.match(/(\d+)/); if (m) return parseInt(m[1]); }
          if (Array.isArray(y) && y.length > 0) { const m = String(y[0]).match(/(\d+)/); if (m) return parseInt(m[1]); }
        }
      }
    } catch(e) {}
  }
  // DOM selectors
  const selectors = [
    '.wprm-recipe-servings', '.tasty-recipes-yield', '[itemprop="recipeYield"]',
    '.mv-recipe-servings', '.recipe-yield', '.servings-count', '[class*="servings"]',
    '.recipe-card__servings', '.recipe-meta__servings',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const attr = el.getAttribute('data-servings') || el.getAttribute('data-value');
      if (attr) { const m = attr.match(/\d+/); if (m) return parseInt(m[0]); }
      const m = el.textContent.match(/(\d+)/);
      if (m && parseInt(m[1]) > 0 && parseInt(m[1]) <= 50) return parseInt(m[1]);
    }
  }
  // Text scan
  const m = document.body.innerText.match(/(?:serves?|servings?|yield|makes)\s*:?\s*(\d+)/i);
  if (m && parseInt(m[1]) > 0 && parseInt(m[1]) <= 50) return parseInt(m[1]);
  return null;
}

async function main() {
  const queue   = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  const results = fs.existsSync(RESULTS_FILE)
    ? JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8')) : {};

  const todo = queue.filter(r => !results[r.id]);
  console.log(`${todo.length} URLs remaining\n`);

  // Create a temp profile with copied cookies so we can run alongside existing Chrome
  const tmpProfile = '/tmp/chrome_ckc_profile';
  const { execSync } = require('child_process');
  try {
    execSync(`rm -rf ${tmpProfile} && mkdir -p ${tmpProfile}/Default`);
    execSync(`cp ~/Library/Application\\ Support/Google/Chrome/Default/Cookies ${tmpProfile}/Default/ 2>/dev/null || true`);
  } catch(e) {}

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    userDataDir:    tmpProfile,
    headless:       true,
    defaultViewport: { width: 1280, height: 800 },
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(20000);

  // Block images/media to speed up
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (['image','media','font'].includes(req.resourceType())) req.abort();
    else req.continue();
  });

  let found = 0, notFound = 0, errors = 0;

  for (let i = 0; i < todo.length; i++) {
    const r = todo[i];
    process.stdout.write(`[${String(i+1).padStart(3)}/${todo.length}] ${r.name.slice(0,50).padEnd(50)} `);

    try {
      await page.goto(r.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await sleep(1200);

      const y = await page.evaluate(extractYield);

      if (y) {
        results[r.id] = { servings: y, source: 'chrome_profile' };
        console.log(`✓ ${y} servings`);
        found++;
      } else {
        results[r.id] = { servings: null, source: 'chrome_not_found' };
        console.log('✗ not found');
        notFound++;
      }
    } catch(e) {
      if (e.message.includes('net::ERR') || e.message.includes('404')) {
        results[r.id] = { servings: null, source: 'dead_link' };
        console.log('✗ dead link');
      } else {
        results[r.id] = { servings: null, source: 'chrome_error', error: e.message.slice(0, 80) };
        console.log(`ERR: ${e.message.slice(0,40)}`);
      }
      errors++;
    }

    // Save every 20
    if ((i + 1) % 20 === 0) {
      fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
      console.log(`  [saved — ${i+1} done | ✓${found} ✗${notFound} err${errors}]`);
    }

    await sleep(600);
  }

  await browser.close();
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

  // Merge back into servings_progress.json
  const servings = JSON.parse(fs.readFileSync(SERVINGS_FILE, 'utf8'));
  let merged = 0;
  for (const [id, result] of Object.entries(results)) {
    if (result.servings) {
      servings[id] = { ...servings[id], servings: result.servings, source: result.source };
      merged++;
    }
  }
  fs.writeFileSync(SERVINGS_FILE, JSON.stringify(servings, null, 2));

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('CHROME PROFILE SCRAPE COMPLETE');
  console.log(`  Found:     ${found}`);
  console.log(`  Not found: ${notFound}`);
  console.log(`  Errors:    ${errors}`);
  console.log(`  Merged into servings_progress.json: ${merged}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
