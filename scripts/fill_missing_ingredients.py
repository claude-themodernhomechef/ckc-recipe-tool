#!/usr/bin/env python3
"""
Reads data-exports/missing_ingredients.csv, fetches each URL,
extracts ingredients + totalTime via JSON-LD, and writes
data-exports/missing_ingredients_filled.csv.
"""
import csv, json, re, sys, time, urllib.request
from pathlib import Path

INPUT  = Path(__file__).parent.parent / "data-exports" / "missing_ingredients.csv"
OUTPUT = Path(__file__).parent.parent / "data-exports" / "missing_ingredients_filled.csv"

def fetch_html(url):
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
    )
    try:
        return urllib.request.urlopen(req, timeout=20).read().decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as e:
        try:
            return e.read().decode("utf-8", errors="ignore")
        except Exception:
            return ""
    except Exception as e:
        print(f"  ERROR fetching: {e}", file=sys.stderr)
        return ""

def parse_recipe(html):
    pattern = r'<script[^>]*type\s*=\s*["\']application/ld\+json["\'][^>]*>(.*?)</script>'
    blocks = re.findall(pattern, html, re.DOTALL)

    def extract(d):
        t = d.get("@type", "")
        if isinstance(t, list):
            t = " ".join(t)
        if "Recipe" not in t:
            return None
        ingredients = d.get("recipeIngredient", [])
        tt = d.get("totalTime", "")
        mins = None
        if tt:
            m = re.search(r"PT(?:(\d+)H)?(?:(\d+)M)?", str(tt))
            if m:
                mins = int(m.group(1) or 0) * 60 + int(m.group(2) or 0)
        return {"ingredients": ingredients, "totalTime_min": mins}

    for b in blocks:
        try:
            d = json.loads(b)
            if isinstance(d, list):
                for item in d:
                    result = extract(item)
                    if result is not None:
                        return result
            elif isinstance(d, dict):
                result = extract(d)
                if result is not None:
                    return result
                if "@graph" in d:
                    for item in d["@graph"]:
                        result = extract(item)
                        if result is not None:
                            return result
        except json.JSONDecodeError:
            pass
    return {"ingredients": [], "totalTime_min": None}

def mins_to_display(mins):
    if mins is None:
        return ""
    if mins < 60:
        return f"{mins} min"
    h = mins // 60
    m = mins % 60
    if m == 0:
        return f"{h} hr"
    return f"{h} hr {m} min"

rows = []
with open(INPUT, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames or []
    rows = list(reader)

# Add new columns if not present
if "ingredients" not in fieldnames:
    fieldnames = list(fieldnames) + ["ingredients", "time"]

total = len(rows)
for i, row in enumerate(rows):
    url = row.get("URL", "").strip()
    num = row.get("#", i+1)
    name = row.get("Recipe Name", "")
    print(f"[{num}/{total}] {name}")
    if not url:
        print("  No URL, skipping.")
        row["ingredients"] = ""
        row["time"] = ""
        continue

    html = fetch_html(url)
    if not html:
        row["ingredients"] = "FETCH_ERROR"
        row["time"] = ""
        time.sleep(1)
        continue

    result = parse_recipe(html)
    ingredients_list = result.get("ingredients", [])
    total_mins = result.get("totalTime_min")

    if ingredients_list:
        row["ingredients"] = " | ".join(ingredients_list)
        print(f"  -> {len(ingredients_list)} ingredients, time: {mins_to_display(total_mins)}")
    else:
        row["ingredients"] = "NOT_FOUND"
        print(f"  -> No JSON-LD recipe found")

    row["time"] = mins_to_display(total_mins)
    time.sleep(0.5)  # be polite

with open(OUTPUT, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print(f"\nDone! Written to {OUTPUT}")
