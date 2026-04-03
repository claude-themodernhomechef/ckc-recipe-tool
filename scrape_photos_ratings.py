#!/usr/bin/env python3
"""Scrape photos and ratings from live recipe URLs using Playwright."""

import asyncio
import json
import os
import sys
from urllib.parse import urlparse

RESULTS_FILE = 'chrome_scrape_results.json'
LIVE_DOMAINS_FILE = '/tmp/live_by_domain.json'
STATUS_FILE = '/tmp/url_status.txt'

EXTRACT_JS = """
() => {
  const result = {img: '', rating: null, rc: null};
  const og = document.querySelector('meta[property="og:image"]');
  if (og && og.content && og.content.startsWith('http')) result.img = og.content;
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const d = JSON.parse(s.textContent);
      const all = [];
      const items = Array.isArray(d) ? d : [d];
      for (const it of items) { all.push(it); if (it['@graph']) all.push(...it['@graph']); }
      for (const n of all) {
        if (n['@type'] === 'Recipe') {
          if (!result.img && n.image) {
            const i = Array.isArray(n.image) ? n.image[0] : n.image;
            result.img = (typeof i === 'object' ? i.url : i) || '';
          }
          if (n.aggregateRating) {
            result.rating = n.aggregateRating.ratingValue;
            result.rc = n.aggregateRating.ratingCount;
          }
        }
      }
    } catch(e) {}
  }
  return result;
}
"""

async def scrape_all():
    from playwright.async_api import async_playwright

    # Load all live URLs with their IDs
    lines = open(STATUS_FILE).read().splitlines()
    status_map = {}
    for line in lines:
        parts = line.split(' ', 1)
        if len(parts) == 2:
            status_map[parts[1].strip()] = parts[0].strip()

    with open('yes_recipes.json') as f:
        recipes = json.load(f)
    url_to_id = {r.get('url', ''): r['id'] for r in recipes}

    live_urls = [(url, url_to_id.get(url, '')) for url, st in status_map.items() if st == '200']
    print(f"Total live URLs to scrape: {len(live_urls)}")

    # Load existing results
    if os.path.exists(RESULTS_FILE):
        with open(RESULTS_FILE) as f:
            results = json.load(f)
        print(f"Resuming — {len(results)} already done")
    else:
        results = {}

    todo = [(url, rid) for url, rid in live_urls if rid not in results]
    print(f"Remaining: {len(todo)}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=['--disable-blink-features=AutomationControlled']
        )
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport={'width': 1280, 'height': 800},
            locale='en-US',
        )
        page = await context.new_page()

        got_img = 0
        got_rating = 0
        for i, (url, rid) in enumerate(todo):
            try:
                await page.goto(url, timeout=20000, wait_until='domcontentloaded')
                data = await page.evaluate(EXTRACT_JS)
                results[rid] = {
                    'url': url,
                    'image': data.get('img', ''),
                    'rating': data.get('rating'),
                    'ratingCount': data.get('rc'),
                }
                if data.get('img'):
                    got_img += 1
                if data.get('rating'):
                    got_rating += 1
                status = '✓' if data.get('img') else '—'
                print(f"  [{i+1}/{len(todo)}] {status} {url[:70]}", flush=True)
            except Exception as e:
                results[rid] = {'url': url, 'image': '', 'rating': None, 'ratingCount': None}
                print(f"  [{i+1}/{len(todo)}] ERR {url[:60]}: {e}", flush=True)

            # Save every 25
            if (i + 1) % 25 == 0:
                with open(RESULTS_FILE, 'w') as f:
                    json.dump(results, f)
                print(f"    → Saved ({i+1} done, {got_img} images, {got_rating} ratings)", flush=True)

        await browser.close()

    with open(RESULTS_FILE, 'w') as f:
        json.dump(results, f)
    print(f"\nDone! {got_img}/{len(todo)} images, {got_rating}/{len(todo)} ratings")
    print(f"Saved to {RESULTS_FILE}")


if __name__ == '__main__':
    asyncio.run(scrape_all())
