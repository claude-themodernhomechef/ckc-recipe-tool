#!/usr/bin/env python3
"""Merge scraped_results.json into missing_ingredients_filled.csv → missing_ingredients_final.csv"""
import csv, json
from pathlib import Path

BASE = Path(__file__).parent.parent / "data-exports"
INPUT  = BASE / "missing_ingredients_filled.csv"
NEW    = BASE / "scraped_results.json"
OUTPUT = BASE / "missing_ingredients_final.csv"

with open(NEW) as f:
    scraped = {str(r["num"]): r for r in json.load(f)}

def mins_to_display(mins):
    if mins is None: return ""
    if mins < 60: return f"{mins} min"
    h = mins // 60; m = mins % 60
    return f"{h} hr" if m == 0 else f"{h} hr {m} min"

with open(INPUT, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    fieldnames = list(reader.fieldnames)
    if "ingredients" not in fieldnames: fieldnames += ["ingredients", "time"]
    rows = list(reader)

updated = 0
for row in rows:
    num = str(row.get("#", "")).strip()
    ingr = row.get("ingredients", "").strip()
    # Update if missing or NOT_FOUND
    if num in scraped and (not ingr or ingr in ("NOT_FOUND", "FETCH_ERROR", "")):
        s = scraped[num]
        row["ingredients"] = " | ".join(s["ingredients"])
        row["time"] = s["time"]
        updated += 1
        print(f"  Updated #{num}: {row['Recipe Name']}")

print(f"\nUpdated {updated} rows.")

with open(OUTPUT, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

# Summary
with open(OUTPUT, newline="", encoding="utf-8") as f:
    all_rows = list(csv.DictReader(f))

done = sum(1 for r in all_rows if r.get("ingredients") and r["ingredients"] not in ("NOT_FOUND","FETCH_ERROR",""))
print(f"\nFinal CSV: {done}/{len(all_rows)} recipes have ingredients.")
print(f"Written to {OUTPUT}")
