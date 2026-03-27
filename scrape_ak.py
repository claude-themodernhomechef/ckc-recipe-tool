#!/usr/bin/env python3
"""
scrape_ak.py — Fetch Ambitious Kitchen images using stealth browser
===================================================================
Setup (run once):
  pip3 install playwright playwright-stealth Pillow firebase-admin
  python3 -m playwright install chromium

Run:
  python3 scrape_ak.py
"""

import asyncio, json, os, re, sys, time, io
import firebase_admin
from firebase_admin import credentials, storage as fb_storage
from PIL import Image

RECIPES_JSON = 'recipes.json'
BUCKET_NAME  = 'ckc-recipe-swipe.firebasestorage.app'


def slugify(text):
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    return re.sub(r'-+', '-', text).strip('-')[:80]


def init_firebase():
    sa_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT')
    if sa_json:
        cred = credentials.Certificate(json.loads(sa_json))
    elif os.path.exists('service-account.json'):
        cred = credentials.Certificate('service-account.json')
    else:
        print('No Firebase credentials found.'); sys.exit(1)
    firebase_admin.initialize_app(cred, {'storageBucket': BUCKET_NAME})
    return fb_storage.bucket()


def screenshot_to_webp(png_bytes, max_width=800):
    img = Image.open(io.BytesIO(png_bytes)).convert('RGB')
    if img.width > max_width:
        ratio = max_width / img.width
        img = img.resize((max_width, int(img.height * ratio)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, 'WEBP', quality=82, method=6)
    return buf.getvalue()


def upload_to_storage(bucket, slug, webp_bytes):
    blob = bucket.blob(f'images/{slug}.webp')
    blob.upload_from_string(webp_bytes, content_type='image/webp')
    blob.make_public()
    return blob.public_url


async def get_recipe_image(page, url):
    """Navigate to page and screenshot the main food image."""
    try:
        await page.goto(url, timeout=45000, wait_until='domcontentloaded')
        await asyncio.sleep(4)

        # Check for Cloudflare challenge
        title = await page.title()
        if 'just a moment' in title.lower() or 'checking' in title.lower():
            print(f'  ⏳ Cloudflare challenge — waiting 8s...')
            await asyncio.sleep(8)

        # Try selectors for the main recipe image
        selectors = [
            '.wprm-recipe-image img',
            '.tasty-recipes-image img',
            '.recipe-hero img',
            '.single-thumbnail img',
            '.post-thumbnail img',
            'article .entry-content img:first-of-type',
            'img.wp-post-image',
            'figure.wp-block-image img',
            '.entry-header img',
        ]

        for sel in selectors:
            el = await page.query_selector(sel)
            if el:
                await el.scroll_into_view_if_needed()
                await asyncio.sleep(0.8)
                box = await el.bounding_box()
                if box and box['width'] > 150 and box['height'] > 150:
                    return await el.screenshot()

        # Last resort: screenshot top of page
        return await page.screenshot(clip={'x': 0, 'y': 80, 'width': 900, 'height': 650})

    except Exception as e:
        print(f'  Error: {e}')
        return None


async def main():
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print('Run: pip3 install playwright && python3 -m playwright install chromium')
        sys.exit(1)

    try:
        from playwright_stealth import stealth_async
        HAS_STEALTH = True
    except ImportError:
        print('playwright-stealth not found — install with: pip3 install playwright-stealth')
        print('Continuing without stealth (may still be blocked)...\n')
        HAS_STEALTH = False
        stealth_async = None

    with open(RECIPES_JSON, encoding='utf-8') as f:
        all_recipes = json.load(f)

    ak_missing = [
        r for r in all_recipes
        if r and 'ambitiouskitchen' in (r.get('url') or '')
        and not r.get('image')
    ]
    print(f'Ambitious Kitchen recipes missing images: {len(ak_missing)}\n')
    if not ak_missing:
        print('Nothing to do!'); return

    bucket = init_firebase()
    recipe_map = {r['name']: r for r in all_recipes if r}
    updated = 0

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=False,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-web-security',
            ]
        )
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            viewport={'width': 1280, 'height': 900},
            locale='en-US',
            timezone_id='America/Los_Angeles',
            permissions=['geolocation'],
        )

        page = await context.new_page()

        if HAS_STEALTH:
            await stealth_async(page)
            print('✓ Stealth mode active\n')

        # Warm up on homepage
        print('Warming up on homepage...')
        await page.goto('https://www.ambitiouskitchen.com', timeout=30000, wait_until='domcontentloaded')
        await asyncio.sleep(5)
        # Simulate human scroll
        await page.mouse.move(640, 400)
        await page.keyboard.press('PageDown')
        await asyncio.sleep(2)
        print('Ready.\n')

        for i, recipe in enumerate(ak_missing):
            name = recipe['name']
            url  = recipe['url']
            slug = slugify(name)
            print(f'[{i+1}/{len(ak_missing)}] {name[:60]}')

            # Already in storage?
            blob = bucket.blob(f'images/{slug}.webp')
            if blob.exists():
                blob.make_public()
                recipe_map[name]['image'] = blob.public_url
                print(f'  ✓ already in storage')
                updated += 1
                continue

            png = await get_recipe_image(page, url)
            if not png:
                print(f'  ✗ failed')
                continue

            try:
                webp = screenshot_to_webp(png)
                pub_url = upload_to_storage(bucket, slug, webp)
                recipe_map[name]['image'] = pub_url
                print(f'  ✓ uploaded')
                updated += 1
            except Exception as e:
                print(f'  ✗ upload error: {e}')

            # Save progress after each recipe
            with open(RECIPES_JSON, 'w', encoding='utf-8') as f:
                json.dump(list(recipe_map.values()), f, indent=2, ensure_ascii=False)

            await asyncio.sleep(2.5)

        await browser.close()

    print(f'\n✓ Done — {updated}/{len(ak_missing)} recipes updated')
    if updated:
        print('Run: git add recipes.json && git commit -m "Add AK images" && git push')


if __name__ == '__main__':
    asyncio.run(main())
