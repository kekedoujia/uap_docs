#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""One-off fix: add the 11 Apollo mission records to batch_001.

The original extractor rejected these because their incident_date is just
a year (e.g. '1969') and three of them have empty location. This script
reads records.json, defaults the date to <YYYY>-01-01 and the location to
'Moon' for Apollo records, then appends them to the batch.

Idempotent: skips events already present (by title).
"""
import os, json

SITE = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA = os.path.join(SITE, "data")
RECORDS = os.path.join(SITE, "records.json")
BATCH_PATH = None
for fn in sorted(os.listdir(os.path.join(DATA, "events"))):
    if "batch_001" in fn:
        BATCH_PATH = os.path.join(DATA, "events", fn)
        break

assert BATCH_PATH, "batch_001 file not found"

records = json.load(open(RECORDS, encoding="utf-8"))
batch = json.load(open(BATCH_PATH, encoding="utf-8"))

# Build set of existing event titles for idempotency
existing_titles = {e.get("title", "") for e in batch["events"]}

# Filter Apollo records
apollo_recs = [r for r in records if "apollo" in (r.get("title", "") or "").lower()]

added = 0
for r in apollo_recs:
    title = (r.get("title") or "").strip()
    if title in existing_titles:
        continue
    yr_raw = (r.get("incident_date") or "").strip()
    # Year-only: default to Jan 1 of that year
    if yr_raw.isdigit() and len(yr_raw) == 4:
        date_iso = f"{yr_raw}-01-01"
    else:
        continue
    location = (r.get("incident_location") or "").strip() or "Moon"
    main_link = r.get("main_link") or ""
    file_name = os.path.basename(main_link) if main_link else ""

    new_event = {
        "date_iso": date_iso,
        "date_raw": yr_raw,
        "location": location,
        "agency": r.get("agency") or "NASA",
        "type": r.get("type") or "PDF",
        "title": title,
        "source": f"NASA Apollo Mission — {title}",
        "file": file_name,
        "page": None,
        "archive_url": main_link,
        "image_url": (r.get("modal_image") or "").strip(),
        "record_description": (r.get("description") or "").strip(),
        "record_type": r.get("type") or "",
        "non_geographic": location.lower() == "moon",
    }
    batch["events"].append(new_event)
    added += 1
    print(f"  + {date_iso} | {location} | {title[:60]}")

if added:
    json.dump(batch, open(BATCH_PATH, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    print(f"\nAdded {added} Apollo events to {os.path.basename(BATCH_PATH)}")
else:
    print("\nNo new Apollo events to add (already present)")

# Make sure Moon is in geocode (should be from earlier)
geo_path = os.path.join(DATA, "geocode.json")
geo = json.load(open(geo_path, encoding="utf-8"))
if "Moon" not in geo:
    geo["Moon"] = {"lat": 0, "lon": 0}
    json.dump(geo, open(geo_path, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    print('  + geocode: added "Moon" → (0, 0)')
