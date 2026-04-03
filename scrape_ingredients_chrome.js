/**
 * scrape_ingredients_chrome.js
 * ─────────────────────────────
 * Uses Puppeteer (headless Chrome) to scrape ingredients for YES recipes
 * where the ingredient list is empty — typically JS-rendered recipe cards.
 *
 * After scraping, re-runs diet compliance analysis and updates Firestore.
 *
 * Usage:
 *   node scrape_ingredients_chrome.js
 *   node scrape_ingredients_chrome.js --concurrency 3
 *   node scrape_ingredients_chrome.js --reset
 */

const puppeteer = require('puppeteer');
const admin     = require('firebase-admin');
const fs        = require('fs');
const path      = require('path');
const dietRules = require('./functions/diet-rules.json');

// ── Config ────────────────────────────────────────────────────────────────────

const PROGRESS_FILE = path.join(__dirname, 'scrape_ingredients_progress.json');
const SERVICE_ACCOUNT = require('./service-account.json');

const args        = process.argv.slice(2);
const CONCURRENCY = parseInt(
  args.find(a => a.startsWith('--concurrency='))?.split('=')[1] ||
  (args.includes('--concurrency') ? args[args.indexOf('--concurrency') + 1] : '3'),
  10
) || 3;
const RESET = args.includes('--reset');

// ── Firebase ──────────────────────────────────────────────────────────────────

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(SERVICE_ACCOUNT) });
}
const db = admin.firestore();

// ── Progress ──────────────────────────────────────────────────────────────────

function loadProgress() {
  if (RESET && fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
  if (!fs.existsSync(PROGRESS_FILE)) return { done: [] };
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); }
  catch (_) { return { done: [] }; }
}

function saveProgress(p) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function pad(str, len) {
  const s = String(str).slice(0, len);
  return s + ' '.repeat(Math.max(0, len - s.length));
}

// ── Scrape ingredients from a loaded Puppeteer page ──────────────────────────

async function scrapeIngredientsFromPage(page, url) {
  try {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch (_) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(3000);
    }
    await sleep(2000); // let JS recipe cards render

    return await page.evaluate(() => {
      // 1. JSON-LD structured data (most reliable)
      for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          const parsed = JSON.parse(script.textContent);
          const items = parsed['@graph']
            ? parsed['@graph']
            : (Array.isArray(parsed) ? parsed : [parsed]);
          for (const item of items) {
            if (item['@type'] === 'Recipe' && Array.isArray(item.recipeIngredient) && item.recipeIngredient.length) {
              return item.recipeIngredient.filter(Boolean);
            }
          }
        } catch (_) {}
      }

      // 2. Common recipe plugin CSS selectors
      const selectors = [
        '.wprm-recipe-ingredient',
        '.wprm-recipe-ingredients li',
        '.tasty-recipes-ingredients-body li',
        '.tasty-recipes-ingredients li',
        '[class*="ingredient"] li',
        '.recipe-ingredients li',
        '.ingredients li',
        '[itemprop="recipeIngredient"]',
        '.ingredient',
        '.recipe__ingredient',
        '[data-ingredient]',
        '.mv-recipe-ingredient',
        '.zrdn-ingredient',
        '.wookmark-ingredient',
      ];
      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        if (els.length > 0) {
          const items = Array.from(els).map(el => el.innerText.trim()).filter(Boolean);
          if (items.length > 0) return items;
        }
      }

      return [];
    });
  } catch (err) {
    return [];
  }
}

// ── Diet compliance (mirrors Cloud Function logic) ────────────────────────────

function capitalise(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

function analyzeDietCompliance(ingredients, name, description, url, blogger) {
  const ingredientText = ingredients.join(' ').toLowerCase();
  const contextText    = `${name} ${description} ${blogger}`.toLowerCase();
  const allText        = `${ingredientText} ${contextText}`;
  const result         = {};

  for (const [tag, rules] of Object.entries(dietRules)) {
    const hasQualifier       = rules.native_qualifiers.some(q => allText.includes(q.toLowerCase()));
    const disqualifiers      = rules.native_disqualifiers.filter(d => ingredientText.includes(d.toLowerCase()));
    const isNativelyDisqualified = disqualifiers.length > 0;

    let native = false, mod = false, notes = '';

    if (hasQualifier && !isNativelyDisqualified) {
      native = true;
    } else if (!isNativelyDisqualified && ingredients.length > 0) {
      native = true;
    }

    if (!native) {
      if (tag === 'LF' && rules.skip_if_star) {
        const nameLC = name.toLowerCase();
        if (rules.skip_if_star.some(s => nameLC.includes(s))) {
          result[tag] = { native: false, mod: false, notes: '' };
          continue;
        }
      }

      const modCandidates = (rules.mod_candidates || []).filter(c =>
        ingredientText.includes(c.toLowerCase())
      );
      if (modCandidates.length > 0) {
        const swapNotes = modCandidates
          .map(c => { const swap = rules.swaps?.[c]; return swap ? `${capitalise(c)}: ${swap}.` : null; })
          .filter(Boolean);
        if (swapNotes.length > 0) { mod = true; notes = swapNotes.join(' '); }
      }
    }

    if (native || mod) result[tag] = { native, mod, notes };

    if (tag === 'AIP' && (native || mod) && rules.cascade_tags) {
      for (const ct of rules.cascade_tags) {
        if (!result[ct]) result[ct] = { native: true, mod: false, notes: '' };
      }
    }
  }

  return result;
}

// ── Process one recipe ────────────────────────────────────────────────────────

async function processRecipe(page, doc, index, total) {
  const data  = doc.data();
  const label = `[${index}/${total}] ${pad(data.name || '', 45)}`;

  try {
    const ingredients = await scrapeIngredientsFromPage(page, data.url);

    if (!ingredients.length) {
      console.log(`${label} — not found`);
      return { status: 'not_found' };
    }

    const dietTags = analyzeDietCompliance(
      ingredients,
      data.name || '',
      data.description || '',
      data.url || '',
      data.blogger || ''
    );

    await db.collection('recipes').doc(doc.id).update({
      ingredients,
      dietTags,
      enrichedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const tagCount = Object.keys(dietTags).length;
    console.log(`${label} ✓ ${ingredients.length} ingr | ${tagCount} tags`);
    return { status: 'done' };

  } catch (err) {
    console.log(`${label} ✗ ${err.message.slice(0, 60)}`);
    return { status: 'error' };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('CKC Ingredient Scraper (Puppeteer)');
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log('Fetching YES recipes with missing ingredients…\n');

  const snap = await db.collection('recipes').where('status', '==', 'yes').get();
  const missing = snap.docs.filter(d => {
    const data = d.data();
    return !data.ingredients || data.ingredients.length === 0;
  });

  console.log(`Recipes missing ingredients: ${missing.length}`);

  const progress = loadProgress();
  const doneSet  = new Set(progress.done);
  const todo     = missing.filter(d => !doneSet.has(d.id));

  console.log(`Already done: ${doneSet.size} | Remaining: ${todo.length}\n`);

  if (todo.length === 0) {
    console.log('Nothing to do!');
    process.exit(0);
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  let found = 0, notFound = 0, errors = 0;
  const startOffset = doneSet.size;

  // Process in batches of CONCURRENCY (each with its own page)
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const batch = todo.slice(i, i + CONCURRENCY);

    const pages = await Promise.all(batch.map(async () => {
      const p = await browser.newPage();
      await p.setViewport({ width: 1280, height: 800 });
      await p.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
      await p.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      return p;
    }));

    const results = await Promise.all(
      batch.map((doc, bi) =>
        processRecipe(pages[bi], doc, startOffset + i + bi + 1, missing.length)
      )
    );

    // Close pages
    await Promise.all(pages.map(p => p.close().catch(() => {})));

    // Update progress
    results.forEach((r, ri) => {
      progress.done.push(batch[ri].id);
      if (r.status === 'done') found++;
      else if (r.status === 'not_found') notFound++;
      else errors++;
    });

    saveProgress(progress);

    if (i + CONCURRENCY < todo.length) await sleep(500);
  }

  await browser.close();

  console.log('\n── Summary ──');
  console.log(`  Found:     ${found}`);
  console.log(`  Not found: ${notFound}`);
  console.log(`  Errors:    ${errors}`);
  console.log(`  Total:     ${missing.length}`);

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
