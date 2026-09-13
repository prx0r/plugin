#!/usr/bin/env python3
"""Intel validator: schema conformance, index counts, freshness warnings.
Exit 0 = valid (warnings allowed), 2 = errors. Run: npm run intel:check"""
import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).parent
META = {"schema.json", "index.json", "watchlist.json"}
REQ = {"id", "topic", "advice", "source", "confidence", "status", "last_checked"}
TOPICS = {"submission", "tool-design", "review-ops", "discovery", "auth"}
CONF = {"high", "medium", "low"}
STATUS = {"official", "self_verified", "reproduced", "community_report",
          "hypothesis", "superseded", "verified", "anecdotal", "stale"}
REPRO = {"none", "reproduced", "failed"}
# Freshness policy (days): official spec, community quirk, self-tested.
POLICY = [("official", 30), ("community_report", 14), ("anecdotal", 14),
          ("self_verified", 7), ("reproduced", 7), ("hypothesis", 7)]

errors, warnings, counts = [], [], {}
today = date.today()

for path in sorted(ROOT.glob("*.json")):
    if path.name in META:
        json.load(open(path))
        continue
    items = json.load(open(path))
    assert isinstance(items, list), path
    seen = set()
    for it in items:
        missing = REQ - set(it)
        if missing:
            errors.append(f"{path.name}:{it.get('id')}: missing {sorted(missing)}")
        if it.get("id") in seen:
            errors.append(f"{path.name}: duplicate {it.get('id')}")
        seen.add(it.get("id"))
        if it.get("topic") not in TOPICS:
            errors.append(f"{path.name}:{it.get('id')}: bad topic")
        if it.get("confidence") not in CONF:
            errors.append(f"{path.name}:{it.get('id')}: bad confidence")
        if it.get("status") not in STATUS:
            errors.append(f"{path.name}:{it.get('id')}: bad status")
        if "reproduction" in it and it["reproduction"] not in REPRO:
            errors.append(f"{path.name}:{it.get('id')}: bad reproduction")
        if {"type", "url"} - set(it.get("source", {})):
            errors.append(f"{path.name}:{it.get('id')}: bad source")
        try:
            age = (today - date.fromisoformat(it["last_checked"])).days
        except Exception:
            errors.append(f"{path.name}:{it.get('id')}: bad last_checked")
            continue
        for status, limit in POLICY:
            if it.get("status") == status and age > limit and status != "superseded":
                warnings.append(f"{path.name}:{it['id']}: {status} stale ({age}d > {limit}d)")
                break
    counts["intel/" + path.name] = len(items)

idx = json.load(open(ROOT / "index.json"))
if idx["total_items"] != sum(counts.values()):
    errors.append("index total mismatch")
for entry in idx["files"]:
    if "items" in entry and counts.get("intel/" + entry["file"]) != entry["items"]:
        errors.append(f"index count mismatch: {entry['file']}")

for w in warnings:
    print("WARN", w)
for e in errors:
    print("ERROR", e)
print(f"intel OK: {sum(counts.values())} items" if not errors else f"intel FAIL: {len(errors)} errors")
sys.exit(2 if errors else 0)
