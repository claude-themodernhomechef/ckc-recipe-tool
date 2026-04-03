#!/usr/bin/env python3
"""Reads /tmp/time_results.json and writes totalTime to Firestore."""
import json, firebase_admin
from firebase_admin import credentials, firestore as fs_module

with open('/tmp/time_results.json') as f:
    results = json.load(f)

if not firebase_admin._apps:
    cred = credentials.Certificate('service-account.json')
    firebase_admin.initialize_app(cred)
db = fs_module.client()

for doc_id, time_str in results.items():
    db.collection('recipes').document(doc_id).update({'totalTime': time_str})
    print(f'  ✓ {doc_id[:8]}… → {time_str}')

print(f'\nUpdated {len(results)} recipes')
