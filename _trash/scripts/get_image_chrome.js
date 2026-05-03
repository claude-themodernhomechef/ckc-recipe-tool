#!/usr/bin/env node
/**
 * get_image_chrome.js
 * Chrome/Puppeteer fallback to extract og:image from a recipe URL.
 * Called by scrape_new_recipe.py when Python requests can't get the image.
 *
 * Usage:
 *   node get_image_chrome.js <url>
 *
 * Prints the image URL to stdout (empty string if not found).
 * Exit code 0 always (errors go to stderr).
 */

const puppeteer = require('puppeteer');

const url = process.argv[2];
if (!url) {
  console.error('Usage: node get_image_chrome.js <url>');
  process.exit(1);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    await page.setViewport({ width: 1280, height: 800 });

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
    } catch (e) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await new Promise(r => setTimeout(r, 2000));
      } catch (e2) {
        process.stderr.write(`Navigation failed: ${e2.message}\n`);
        console.log('');
        return;
      }
    }

    // Scroll to trigger lazy load
    await page.evaluate(() => window.scrollTo(0, 400));
    await new Promise(r => setTimeout(r, 800));

    const image = await page.evaluate(() => {
      // 1. og:image
      const og = document.querySelector('meta[property="og:image"]');
      if (og?.content) return og.content.trim();

      // 2. JSON-LD Recipe image
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
        } catch (_) {}
      }

      // 3. twitter:image
      const tw = document.querySelector('meta[name="twitter:image"]');
      if (tw?.content) return tw.content.trim();

      // 4. First large img in article/main
      for (const sel of ['article', 'main', '.recipe', '.post', '.entry-content']) {
        const el = document.querySelector(sel);
        if (!el) continue;
        for (const img of el.querySelectorAll('img')) {
          const src = img.src || img.dataset?.src || img.dataset?.lazySrc || '';
          if (src && img.naturalWidth > 300) return src;
        }
      }
      return '';
    });

    console.log(image || '');
  } finally {
    await browser.close();
  }
})();
