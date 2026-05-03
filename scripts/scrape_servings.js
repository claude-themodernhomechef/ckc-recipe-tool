/**
 * scrape_servings.js
 *
 * Phase 1: Fast HTML scrape for recipeYield across all recipes.
 * Saves progress to data/servings_progress.json so Phase 2 (Chrome)
 * can pick up only the failures.
 *
 * Usage:
 *   node scripts/scrape_servings.js
 */

const admin = require('firebase-admin');
const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const SA_PATH       = path.join(__dirname, '../service-account.json');
const PROGRESS_FILE = path.join(__dirname, '../data/servings_progress.json');

const sa = require(SA_PATH);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

// ─── Fetch ────────────────────────────────────────────────────────────────────

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 12000,
    }, res => {
      // Follow one redirect
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchPage(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ html: data, status: res.statusCode }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ─── Extract yield from HTML ──────────────────────────────────────────────────

function extractYield(html) {
  // 1. JSON-LD (most reliable)
  const blocks = html.match(/<script[^>]*type=[\"']application\/ld\+json[\"'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of blocks) {
    const json = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
    try {
      const data = JSON.parse(json);
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

  // 2. Meta / data attributes
  const metaPatterns = [
    /\"recipeYield\":\s*[\"']?(\d+)/i,
    /data-servings=[\"'](\d+)[\"']/i,
    /data-yield=[\"'](\d+)[\"']/i,
    /"yield":\s*(\d+)/i,
  ];
  for (const p of metaPatterns) {
    const m = html.match(p);
    if (m && parseInt(m[1]) > 0) return { value: parseInt(m[1]), source: 'meta' };
  }

  // 3. Visible text patterns
  const textPatterns = [
    /(?:serves|servings|yield|makes)\s*:?\s*(\d+)/i,
    /(\d+)\s+servings/i,
    /(\d+)\s+serving/i,
    /serves?\s+(\d+)/i,
    /makes?\s+(\d+)/i,
  ];
  for (const p of textPatterns) {
    const m = html.match(p);
    if (m && parseInt(m[1]) > 0 && parseInt(m[1]) <= 50) { // sanity cap
      return { value: parseInt(m[1]), source: 'text' };
    }
  }

  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Load existing progress
  let progress = {};
  if (fs.existsSync(PROGRESS_FILE)) {
    progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    console.log(`Resuming — ${Object.keys(progress).length} already processed`);
  }

  console.log('Fetching recipes from Firestore...');
  const snap = await db.collection('recipes')
    .where('status', 'in', ['approved', 'needs_review'])
    .get();

  const recipes = [];
  snap.forEach(doc => {
    const d = doc.data();
    if (d.url) recipes.push({ id: doc.id, name: d.name, url: d.url });
  });
  console.log(`${recipes.length} recipes to process\n`);

  const todo = recipes.filter(r => !progress[r.id]);
  console.log(`${todo.length} remaining after resume\n`);

  let scraped = 0, failed = 0, errors = 0;

  for (let i = 0; i < todo.length; i++) {
    const r = todo[i];
    process.stdout.write(`[${String(i+1).padStart(4)}/${todo.length}] ${r.name.slice(0, 50).padEnd(50)} `);

    try {
      const { html, status } = await fetchPage(r.url);
      if (status !== 200) {
        progress[r.id] = { id: r.id, name: r.name, url: r.url, servings: null, source: 'error', error: `HTTP ${status}` };
        console.log(`HTTP ${status}`);
        errors++;
      } else {
        const result = extractYield(html);
        if (result) {
          progress[r.id] = { id: r.id, name: r.name, url: r.url, servings: result.value, source: result.source };
          console.log(`✓ ${result.value} servings (${result.source})`);
          scraped++;
        } else {
          progress[r.id] = { id: r.id, name: r.name, url: r.url, servings: null, source: 'needs_chrome' };
          console.log('✗ needs Chrome');
          failed++;
        }
      }
    } catch(e) {
      progress[r.id] = { id: r.id, name: r.name, url: r.url, servings: null, source: 'error', error: e.message.slice(0, 80) };
      console.log(`ERR: ${e.message.slice(0, 40)}`);
      errors++;
    }

    // Save progress every 25 recipes
    if ((i + 1) % 25 === 0) fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));

    await new Promise(r => setTimeout(r, 350));
  }

  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));

  const needsChrome = Object.values(progress).filter(r => r.source === 'needs_chrome' || r.source === 'error');
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 1 COMPLETE');
  console.log(`  Scraped successfully: ${scraped}`);
  console.log(`  Needs Chrome:         ${needsChrome.length}`);
  console.log(`  Errors:               ${errors}`);
  console.log(`  Progress saved →      data/servings_progress.json`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
