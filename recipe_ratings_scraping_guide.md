# Recipe Ratings Scraping Guide

A repeatable process for populating the `Rating` column in `Recipe Master Index-Table 1.csv` by scraping live recipe blog pages.

---

## Overview

Recipe blogs publish structured rating data in JSON-LD `<script>` tags. This process navigates to each blog domain using a browser, fetches each recipe page from that domain's context (bypassing CORS/403 restrictions), extracts the `aggregateRating` from the JSON-LD schema, and writes the results back to the Excel file.

**Rating format:** `X.XX (N ratings)` — e.g. `4.87 (22 ratings)`
**No rating found:** cell is left blank
**Target column:** `Rating` column in `Recipe Master Index-Table 1.csv`

---

## Files

| File | Purpose |
|------|---------|
| `Recipe Master Index-Table 1.csv` | Master data file; `Rating` column = target |
| `ratings_queue_new.json` | List of rows needing ratings (row index, title, URL, blogger) |
| `collected_ratings.json` | Accumulator: maps each URL to its scraped rating |
| `ratings_by_domain.json` | Same data grouped by domain (optional, for planning) |

---

## Step 1 — Build the Queue

Run this Python script to extract rows with empty ratings from the CSV file:

```python
import csv, json

queue = []
with open('Recipe Master Index-Table 1.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row_idx, row in enumerate(reader, start=2):  # start=2 because row 1 is header
        title   = row.get('Recipe Title', '')
        url     = row.get('URL', '')
        blogger = row.get('Blogger Name', '')
        rating  = row.get('Rating', '')

        if url and not rating:
            queue.append({'row': row_idx, 'title': title, 'url': url, 'blogger': blogger})

with open('ratings_queue_new.json', 'w') as f:
    json.dump(queue, f, indent=2)

print(f'{len(queue)} rows need ratings')
```

---

## Step 2 — Group URLs by Domain

```python
import json
from urllib.parse import urlparse

with open('ratings_queue_new.json') as f:
    queue = json.load(f)

by_domain = {}
for item in queue:
    url = item['url']
    if not url:
        continue
    domain = urlparse(url).netloc
    by_domain.setdefault(domain, []).append(url)

with open('ratings_by_domain.json', 'w') as f:
    json.dump(by_domain, f, indent=2)

for domain, urls in sorted(by_domain.items()):
    print(f'{domain}: {len(urls)} URLs')
```

---

## Step 3 — Initialise the Accumulator

```python
import json

# Start fresh, or load existing to resume
try:
    with open('collected_ratings.json') as f:
        collected = json.load(f)
    print(f'Resuming with {len(collected)} existing entries')
except FileNotFoundError:
    collected = {}
    with open('collected_ratings.json', 'w') as f:
        json.dump(collected, f)
    print('Started fresh accumulator')
```

---

## Step 4 — Scrape Each Domain (Browser Required)

Direct HTTP requests to recipe blogs return 403. Instead, use the **Claude in Chrome** browser tool to navigate to the domain, then fetch pages from that domain's JavaScript context.

### 4a. The Rating Extractor Function

Paste this on every domain before fetching. It parses JSON-LD `aggregateRating` from fetched HTML:

```javascript
function eR(html) {
  const p = new DOMParser();
  const d = p.parseFromString(html, 'text/html');
  const ss = d.querySelectorAll('script[type="application/ld+json"]');
  for (const s of ss) {
    try {
      const dt = JSON.parse(s.textContent);
      const items = Array.isArray(dt) ? dt : [dt];
      const fR = (o) => {
        if (!o || typeof o !== 'object') return null;
        if (o.aggregateRating) {
          const rv = o.aggregateRating.ratingValue;
          const rc = o.aggregateRating.ratingCount || o.aggregateRating.reviewCount;
          if (rv) {
            const n = Math.round(parseFloat(rv) * 100) / 100;
            return rc
              ? n + ' (' + parseInt(rc) + ' ' + (parseInt(rc) === 1 ? 'rating' : 'ratings') + ')'
              : '' + n;
          }
        }
        if (o['@graph']) {
          for (const g of o['@graph']) {
            const r = fR(g);
            if (r) return r;
          }
        }
        return null;
      };
      for (const i of items) {
        const r = fR(i);
        if (r) return r;
      }
    } catch (e) {}
  }
  return 'NR';
}
```

### 4b. Batch Fetch Pattern

After navigating to a domain (e.g. `https://www.seriouseats.com`), run this in the browser JS tool with that domain's URLs:

```javascript
const urls = [
  'https://www.seriouseats.com/recipe-slug-1',
  'https://www.seriouseats.com/recipe-slug-2',
  // ...
];

window._r = {};
window._d = false;

Promise.all(
  urls.map(u =>
    fetch(u)
      .then(r => r.ok ? r.text().then(h => ({ u, v: eR(h) })) : { u, v: 'HTTP_' + r.status })
      .catch(e => ({ u, v: 'ERR:' + e.message }))
  )
).then(rs => {
  rs.forEach(r => window._r[r.u] = r.v);
  window._d = true;
});
```

Check results after a few seconds:
```javascript
window._d + ' ' + JSON.stringify(window._r)
```

Wait until `window._d` is `true`, then save.

### 4c. Save After Each Domain

```python
import json

results = {
    'https://www.seriouseats.com/recipe-slug-1': '4.8 (312 ratings)',
    'https://www.seriouseats.com/recipe-slug-2': 'NR',
    # paste from browser output
}

with open('collected_ratings.json') as f:
    c = json.load(f)

for url, val in results.items():
    c[url] = {'rating': val}

with open('collected_ratings.json', 'w') as f:
    json.dump(c, f)

print(len(c))
```

### 4d. Repeat for Every Domain

Work through `ratings_by_domain.json` domain by domain: navigate → define `eR()` → batch fetch → save.

---

## Step 5 — Check Coverage

```python
import json

with open('collected_ratings.json') as f:
    c = json.load(f)

with open('ratings_queue_new.json') as f:
    q = json.load(f)

covered   = [item for item in q if item['url'] and item['url'] in c]
uncovered = [item for item in q if item['url'] and item['url'] not in c]

print(f'Total queue:  {len(q)}')
print(f'Covered:      {len(covered)}')
print(f'Uncovered:    {len(uncovered)}')

for item in uncovered:
    print(item['url'])
```

Go back to Step 4 for any uncovered URLs.

---

## Step 6 — Write Ratings to CSV

```python
import json, csv

with open('collected_ratings.json') as f:
    cr = json.load(f)

with open('ratings_queue_new.json') as f:
    q = json.load(f)

# Build a lookup dict from collected ratings by URL
url_to_rating = {}
for url, data in cr.items():
    rating = data.get('rating', '')
    if rating and rating != 'NR':
        url_to_rating[url] = rating

# Read the CSV, update ratings, and write back
rows = []
with open('Recipe Master Index-Table 1.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

updated = 0
for row in rows:
    url = row.get('URL', '')
    if url in url_to_rating:
        row['Rating'] = url_to_rating[url]
        updated += 1

# Write back to CSV
with open('Recipe Master Index-Table 1.csv', 'w', encoding='utf-8', newline='') as f:
    if rows:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

print(f'Ratings written: {updated}')
```

---

## Notes & Gotchas

**404 URLs** — Many blog URLs change slugs over time. A 404 is saved as `NR` and left blank in the spreadsheet. Check the queue manually if a high proportion of one domain returns 404s; the URL pattern may have changed.

**CORS errors** — If a domain returns `ERR` rather than `HTTP_*`, it's blocking cross-origin fetches. Try navigating directly to the recipe page and extracting the rating from the already-loaded DOM:
```javascript
eR(document.documentElement.outerHTML)
```

**Sites without JSON-LD** — Some blogs store ratings only in the rendered DOM (not in `<script>` tags). These return `NR`. To handle them, inspect the page HTML for rating patterns and extend `eR()` as needed.

**Incremental saves** — Always save `collected_ratings.json` after each domain. If the session is interrupted you can resume from where you left off without re-fetching.

**CSV column names** — This guide assumes the CSV has columns named: `Recipe Title`, `Blogger Name`, `URL`, and `Rating`. If your CSV structure changes, update the column names in the `csv.DictReader` calls in Steps 1 and 6.
