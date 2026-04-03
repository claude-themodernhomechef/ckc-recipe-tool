"""
compare_firestore_vs_local.py
Compares archive/data/recipes.json against Firestore, matching by URL.
"""

import json, sys, warnings
warnings.filterwarnings("ignore")

import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate("service-account.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# ── Load local ─────────────────────────────────────────────────
LOCAL_PATH = "archive/data/recipes.json"
print(f"\n📂 Loading local: {LOCAL_PATH}")
with open(LOCAL_PATH) as f:
    local_list = json.load(f)

local_by_url = {}
local_no_url = []
for r in local_list:
    url = r.get("url","").strip().rstrip("/")
    if url:
        local_by_url[url] = r
    else:
        local_no_url.append(r)

print(f"   Local records       : {len(local_list)}")
print(f"   With a URL          : {len(local_by_url)}")
print(f"   Missing URL         : {len(local_no_url)}")

# ── Load Firestore ─────────────────────────────────────────────
print("\n🔥 Fetching Firestore 'recipes' collection...")
fs_by_url = {}
fs_no_url  = []
for doc in db.collection("recipes").stream():
    d = doc.to_dict()
    url = (d.get("url") or "").strip().rstrip("/")
    if url:
        fs_by_url[url] = {"id": doc.id, **d}
    else:
        fs_no_url.append({"id": doc.id, **d})

print(f"   Firestore records   : {len(fs_by_url) + len(fs_no_url)}")
print(f"   With a URL          : {len(fs_by_url)}")
print(f"   Missing URL         : {len(fs_no_url)}")

# ── Compare ────────────────────────────────────────────────────
local_urls = set(local_by_url.keys())
fs_urls    = set(fs_by_url.keys())

only_local     = local_urls - fs_urls
only_firestore = fs_urls - local_urls
in_both        = local_urls & fs_urls

print("\n" + "="*60)
print("COMPARISON SUMMARY (matched by URL)")
print("="*60)
print(f"  In local only  (missing from Firestore) : {len(only_local)}")
print(f"  In Firestore only (not in local file)   : {len(only_firestore)}")
print(f"  Present in both                         : {len(in_both)}")

# ── Field-level diff for matching records ─────────────────────
KEY_FIELDS = ["name", "dietTags", "protein", "cuisine", "course",
              "description", "rating", "image", "alignmentScore", "ingredients"]

diffs = []
exact_match = 0
for url in in_both:
    lc = local_by_url[url]
    fs = fs_by_url[url]
    mismatches = []
    for field in KEY_FIELDS:
        lv = lc.get(field)
        fv = fs.get(field)
        if lv != fv:
            mismatches.append(field)
    if mismatches:
        diffs.append({"url": url, "name": lc.get("name","?"), "fields": mismatches})
    else:
        exact_match += 1

print(f"  Exact field matches (no diff)           : {exact_match}")
print(f"  In both but with field differences      : {len(diffs)}")

# ── Print missing from Firestore ───────────────────────────────
if only_local:
    print(f"\n⚠️  MISSING FROM FIRESTORE — these {len(only_local)} local recipes are NOT in Firebase:")
    for url in sorted(only_local):
        name = local_by_url[url].get("name","(no name)")
        print(f"   - {name}")
        print(f"     {url}")
else:
    print("\n✅  All local recipes ARE present in Firestore (none missing).")

# ── Print Firestore extras ─────────────────────────────────────
print(f"\n📊  Firestore has {len(only_firestore)} recipes NOT in the local archive file.")
print(f"    (These were likely added later via the pipeline or directly.)")
if only_firestore and len(only_firestore) <= 30:
    for url in sorted(only_firestore)[:30]:
        name = fs_by_url[url].get("name","(no name)")
        print(f"   + {name}")

# ── Field diffs detail ─────────────────────────────────────────
if diffs:
    print(f"\n🔄  FIELD DIFFERENCES in matching records (first 30):")
    for d in diffs[:30]:
        print(f"   [{d['name']}] differs on: {', '.join(d['fields'])}")
        lc = local_by_url[d['url']]
        fs = fs_by_url[d['url']]
        for field in d['fields']:
            print(f"      {field}:")
            print(f"        local     = {json.dumps(lc.get(field))[:120]}")
            print(f"        firestore = {json.dumps(fs.get(field))[:120]}")

# ── Save full report ───────────────────────────────────────────
report = {
    "local_count": len(local_list),
    "firestore_count": len(fs_by_url) + len(fs_no_url),
    "in_both": len(in_both),
    "only_in_local": [{"name": local_by_url[u].get("name","?"), "url": u} for u in sorted(only_local)],
    "only_in_firestore_count": len(only_firestore),
    "field_diff_count": len(diffs),
    "field_diffs": diffs[:100],
}
with open("compare_report.json", "w") as f:
    json.dump(report, f, indent=2)

print("\n✅ Full report saved to: compare_report.json")
print("="*60)
