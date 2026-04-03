"""
export_firestore_to_csv.py
Exports the Firestore 'recipes' and 'decisions' collections to CSV files.
Output: firestore_recipes.csv, firestore_decisions.csv
"""

import csv, json, warnings
warnings.filterwarnings("ignore")

import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate("service-account.json")
firebase_admin.initialize_app(cred)
db = firestore.client()


def flatten_value(v):
    """Convert lists/dicts to JSON strings so they fit in a CSV cell."""
    if isinstance(v, (list, dict)):
        return json.dumps(v, ensure_ascii=False)
    return v


def export_collection(collection_name, output_file):
    print(f"\n🔥 Fetching '{collection_name}' collection...")
    docs = []
    for doc in db.collection(collection_name).stream():
        row = {"_doc_id": doc.id}
        row.update(doc.to_dict())
        docs.append(row)

    print(f"   Found {len(docs)} documents")

    if not docs:
        print(f"   ⚠️  No documents found — skipping {output_file}")
        return

    # Collect all field names across all docs (union)
    all_keys = ["_doc_id"]
    seen = set(["_doc_id"])
    for doc in docs:
        for k in doc:
            if k not in seen:
                all_keys.append(k)
                seen.add(k)

    with open(output_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=all_keys, extrasaction="ignore")
        writer.writeheader()
        for doc in docs:
            flat = {k: flatten_value(v) for k, v in doc.items()}
            writer.writerow(flat)

    print(f"   ✅ Saved to {output_file}")


export_collection("recipes", "firestore_recipes.csv")
export_collection("decisions", "firestore_decisions.csv")

print("\nDone.")
