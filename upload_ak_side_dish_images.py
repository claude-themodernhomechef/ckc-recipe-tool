"""
upload_ak_side_dish_images.py

Python alternative to upload_ak_side_dish_images.js
Downloads 10 Ambitious Kitchen side dish images and uploads to Firebase Storage.

Usage:
    pip3 install google-cloud-storage
    python3 upload_ak_side_dish_images.py
"""

import json, os, urllib.request, urllib.error
from pathlib import Path

# ── Firebase / GCS ─────────────────────────────────────────────────────────────
try:
    from google.cloud import storage
    from google.oauth2 import service_account
except ImportError:
    print("Missing dependency. Run:  pip3 install google-cloud-storage")
    raise SystemExit(1)

BUCKET_NAME    = "ckc-recipe-swipe.firebasestorage.app"
SERVICE_ACCT   = Path(__file__).parent / "service-account.json"

creds  = service_account.Credentials.from_service_account_file(str(SERVICE_ACCT))
client = storage.Client(credentials=creds, project=creds.project_id)
bucket = client.bucket(BUCKET_NAME)

# ── Image map: recipe slug → source URL ───────────────────────────────────────
AK_IMAGES = {
    "best-healthy-coleslaw-ever-no-mayo":
        "https://www.ambitiouskitchen.com/wp-content/uploads/2022/07/coleslaw2-5long.jpg",
    "au-gratin-potatoes":
        "https://www.ambitiouskitchen.com/wp-content/uploads/2021/03/Gratin-FB.png",
    "30-minute-grilled-veggie-orzo":
        "https://www.ambitiouskitchen.com/wp-content/uploads/2021/08/Brown-Butter-Goat-Cheese-Veggie-Orzo-with-Basil-7long.jpg",
    "lightened-up-cheddar-cauliflower-broccoli-soup":
        "https://www.ambitiouskitchen.com/wp-content/uploads/2021/01/Soup-Fb.png",
    "italian-chopped-brussels-sprouts-salad":
        "https://www.ambitiouskitchen.com/wp-content/uploads/2021/01/Italian-Chopped-Brussels-Salad-4long.jpg",
    "curry-cashew-chickpea-quinoa-salad":
        "https://www.ambitiouskitchen.com/wp-content/uploads/2020/06/Salad-FB.png",
    "thai-broccoli-salad":
        "https://www.ambitiouskitchen.com/wp-content/uploads/2024/02/Salad-FB.png",
    "curry-roasted-cauliflower-sweet-potato-salad":
        "https://www.ambitiouskitchen.com/wp-content/uploads/2019/01/Curry-Roasted-Sweet-Potato-Cauliflower-Salad-1long.jpg",
    "lightened-sweet-potato-casserole-pecan-oat-streusel":
        "https://www.ambitiouskitchen.com/wp-content/uploads/2021/11/sweetpotatocasserolelong.jpg",
    "sweet-potato-kale-salad":
        "https://www.ambitiouskitchen.com/wp-content/uploads/2021/01/California-Roasted-Sweet-Potato-Kale-Salad-5long.jpg",
}

# ── Helpers ────────────────────────────────────────────────────────────────────
def ext_and_mime(url):
    base = url.split("?")[0].lower()
    if base.endswith(".png"):
        return ".png", "image/png"
    return ".jpg", "image/jpeg"

def download(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()

def upload(slug, data, mime, ext):
    dest = f"images/{slug}{ext}"
    blob = bucket.blob(dest)
    blob.upload_from_string(data, content_type=mime)
    blob.make_public()
    return f"https://storage.googleapis.com/{BUCKET_NAME}/{dest}"

# ── Main ───────────────────────────────────────────────────────────────────────
results, errors = [], []

print(f"Uploading {len(AK_IMAGES)} Ambitious Kitchen side dish images...\n")

for slug, src_url in AK_IMAGES.items():
    print(f"[{slug}]")
    print(f"  Source : {src_url}")
    try:
        ext, mime = ext_and_mime(src_url)
        data = download(src_url)
        print(f"  Downloaded: {len(data)/1024:.1f} KB")
        public_url = upload(slug, data, mime, ext)
        print(f"  Uploaded : images/{slug}{ext}")
        print(f"  URL      : {public_url}")
        results.append({"slug": slug, "publicUrl": public_url})
    except Exception as e:
        print(f"  ERROR: {e}")
        errors.append({"slug": slug, "error": str(e)})
    print()

print("─" * 50)
print(f"Done: {len(results)} uploaded, {len(errors)} failed")

out_path = Path(__file__).parent / "ak_upload_results.json"
with open(out_path, "w") as f:
    json.dump({"uploaded": results, "errors": errors}, f, indent=2)
print(f"Results saved to ak_upload_results.json")
