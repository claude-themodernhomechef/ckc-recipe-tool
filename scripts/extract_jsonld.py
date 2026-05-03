#!/usr/bin/env python3
"""Extract recipe ingredients and totalTime from a URL's JSON-LD."""
import sys, json, re, urllib.request

url = sys.argv[1]
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"})
try:
    html = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", errors="ignore")
except urllib.error.HTTPError as e:
    # Some sites return 404 but still serve recipe content
    html = e.read().decode("utf-8", errors="ignore")

pattern = r'<script[^>]*type\s*=\s*["\']application/ld\+json["\'][^>]*>(.*?)</script>'
blocks = re.findall(pattern, html, re.DOTALL)

def check(d):
    t = d.get("@type", "")
    if isinstance(t, list):
        t = " ".join(t)
    if "Recipe" in t:
        tt = d.get("totalTime", "")
        mins = None
        if tt:
            m = re.search(r"PT(?:(\d+)H)?(?:(\d+)M)?", str(tt))
            if m:
                mins = int(m.group(1) or 0) * 60 + int(m.group(2) or 0)
        print(json.dumps({"ingredients": d.get("recipeIngredient", []), "totalTime_min": mins}, indent=2))
        return True
    return False

for b in blocks:
    try:
        d = json.loads(b)
        if isinstance(d, list):
            for item in d:
                if check(item):
                    sys.exit(0)
        elif isinstance(d, dict):
            if check(d):
                sys.exit(0)
            if "@graph" in d:
                for item in d["@graph"]:
                    if check(item):
                        sys.exit(0)
    except json.JSONDecodeError:
        pass

print(json.dumps({"error": "No Recipe JSON-LD found"}))
