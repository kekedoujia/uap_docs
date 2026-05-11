#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Add one or more events to the site without manual JSON editing.

USAGE — interactive (prompts for fields):
    python3 scripts/add_event.py

USAGE — command line (single event):
    python3 scripts/add_event.py \\
        --batch batch_002 \\
        --date 2026-12-15 \\
        --location "Roswell, New Mexico" \\
        --lat 33.3943 --lon -104.5230 \\
        --agency FBI \\
        --type PDF \\
        --title "New incident report" \\
        --file "new_incident_2026-12.pdf" \\
        --source "FBI File XYZ-123, p.1" \\
        --archive-url "https://www.war.gov/medialink/ufo/release_2/new_incident_2026-12.pdf"

USAGE — batch import from JSON:
    python3 scripts/add_event.py --import path/to/new_events.json --batch batch_002

The script:
  1. Creates the batch file if it doesn't exist
  2. Appends the event to the batch
  3. Updates manifest.json if it's a new batch
  4. Updates geocode.json if the location is new
"""
import os
import sys
import json
import argparse
from datetime import datetime

# Site root = parent dir of this script (we live in <site>/scripts/)
SITE = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA = os.path.join(SITE, "data")
EVENTS_DIR = os.path.join(DATA, "events")


def load_or_init_manifest():
    p = os.path.join(DATA, "manifest.json")
    if os.path.exists(p):
        return json.load(open(p, encoding="utf-8"))
    return {
        "version": "1.0",
        "title": "Department of War UAP/UFO Disclosure — Interactive Map",
        "description": "Geographic/chronological visualization of UAP/UFO events.",
        "batches": [],
    }


def save_manifest(m):
    with open(os.path.join(DATA, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(m, f, indent=2, ensure_ascii=False)


def load_geocode():
    p = os.path.join(DATA, "geocode.json")
    if not os.path.exists(p):
        return {}
    return json.load(open(p, encoding="utf-8"))


def save_geocode(g):
    with open(os.path.join(DATA, "geocode.json"), "w", encoding="utf-8") as f:
        json.dump(g, f, indent=2, ensure_ascii=False)


def find_batch_file(batch_id_or_name):
    """Find existing batch file by ID prefix or full filename."""
    if os.path.exists(os.path.join(EVENTS_DIR, batch_id_or_name)):
        return os.path.join(EVENTS_DIR, batch_id_or_name)
    for fn in sorted(os.listdir(EVENTS_DIR)):
        if fn.startswith(batch_id_or_name):
            return os.path.join(EVENTS_DIR, fn)
    return None


def load_or_init_batch(batch_path, batch_id, batch_name, release_date):
    if os.path.exists(batch_path):
        return json.load(open(batch_path, encoding="utf-8"))
    return {
        "batch_id": batch_id,
        "batch_name": batch_name,
        "release_date": release_date,
        "source_url": "",
        "events": [],
    }


def save_batch(batch_path, batch):
    with open(batch_path, "w", encoding="utf-8") as f:
        json.dump(batch, f, indent=2, ensure_ascii=False)


def prompt(label, default=None):
    """Interactive prompt."""
    suffix = f" [{default}]" if default else ""
    val = input(f"{label}{suffix}: ").strip()
    return val or default


def interactive():
    """Walk the user through adding one event."""
    print("=== 添加单个事件 / Add a single event ===\n")

    # Choose / create batch
    print("现有批次 / Existing batches:")
    for fn in sorted(os.listdir(EVENTS_DIR)):
        if fn.endswith(".json"):
            print(f"  - {fn}")
    print()

    batch_input = prompt("批次 ID 或文件名 (新批次直接输入新 ID，如 batch_002)")
    if not batch_input:
        print("Aborted.")
        return

    existing = find_batch_file(batch_input)
    if existing:
        batch_path = existing
        print(f"  → 使用现有批次 {os.path.basename(batch_path)}")
    else:
        # New batch
        batch_id = batch_input.replace("batch_", "").lstrip("0") or batch_input
        batch_name = prompt("批次名称 (e.g. 'DoW UFO/UAP Release 02')",
                            f"User Submission {datetime.now().strftime('%Y-%m')}")
        release_date = prompt("发布日期 (YYYY-MM-DD)",
                              datetime.now().strftime("%Y-%m-%d"))
        filename = f"{batch_input}_{release_date}.json" if not batch_input.endswith(".json") else batch_input
        batch_path = os.path.join(EVENTS_DIR, filename)
        # Init
        batch = load_or_init_batch(batch_path, batch_id, batch_name, release_date)
        save_batch(batch_path, batch)
        # Update manifest
        manifest = load_or_init_manifest()
        if os.path.basename(batch_path) not in manifest["batches"]:
            manifest["batches"].append(os.path.basename(batch_path))
            save_manifest(manifest)
        print(f"  → 创建新批次 {filename}")

    # Load batch + geocode
    batch = json.load(open(batch_path, encoding="utf-8"))
    geocode = load_geocode()

    # Event fields
    print("\n--- 事件字段 / Event fields ---")
    date_iso = prompt("日期 (YYYY-MM-DD)")
    if not date_iso:
        print("Aborted (date required).")
        return
    location = prompt("地点 / Location (e.g. 'Roswell, New Mexico')")
    if not location:
        print("Aborted (location required).")
        return

    # Geocode
    if location in geocode:
        print(f"  → 地点已在 geocode.json: ({geocode[location]['lat']}, {geocode[location]['lon']})")
    else:
        print(f"  → 新地点，需要坐标")
        lat = prompt("纬度 / Latitude (-90 to 90)")
        lon = prompt("经度 / Longitude (-180 to 180)")
        try:
            lat_f = float(lat)
            lon_f = float(lon)
            geocode[location] = {"lat": lat_f, "lon": lon_f}
            save_geocode(geocode)
            print(f"  → 已添加到 geocode.json")
        except (TypeError, ValueError):
            print("  ! 坐标无效，事件不会显示在地图上（但仍会被保存）")

    agency = prompt("报告机构 / Agency", "FBI")
    typ = prompt("类型 / Type (PDF/VID/IMG)", "PDF")
    title = prompt("标题或摘要 / Title or summary")
    source = prompt("出处 / Source citation")
    file_name = prompt("原档文件名 / Archive filename (optional)")
    archive_url = prompt(
        "原档 URL / Archive URL (optional, 留空则用本地路径)",
        f"https://www.war.gov/medialink/ufo/release_X/{file_name}" if file_name else "",
    )
    page = prompt("页码 / Page (optional)")

    event = {
        "date_iso": date_iso,
        "date_raw": date_iso,
        "location": location,
        "agency": agency,
        "type": typ,
        "title": title,
        "source": source,
        "file": file_name,
        "page": int(page) if page and page.isdigit() else None,
        "archive_url": archive_url,
    }
    batch["events"].append(event)
    save_batch(batch_path, batch)
    print(f"\n✓ 事件已添加到 {os.path.basename(batch_path)}")
    print(f"  当前批次共 {len(batch['events'])} 条事件")
    print(f"\n刷新浏览器即可看到。如要部署，运行：")
    print(f"  git add ufo_site/data/ && git commit -m 'Add event {date_iso}' && git push")


def cli_add(args):
    """Add one event from command-line args."""
    batch_input = args.batch
    existing = find_batch_file(batch_input)
    if existing:
        batch_path = existing
    else:
        batch_id = batch_input.replace("batch_", "")
        release_date = args.release_date or datetime.now().strftime("%Y-%m-%d")
        filename = f"{batch_input}_{release_date}.json"
        batch_path = os.path.join(EVENTS_DIR, filename)
        batch = load_or_init_batch(batch_path, batch_id,
                                    args.batch_name or batch_input, release_date)
        save_batch(batch_path, batch)
        manifest = load_or_init_manifest()
        if os.path.basename(batch_path) not in manifest["batches"]:
            manifest["batches"].append(os.path.basename(batch_path))
            save_manifest(manifest)
        print(f"创建新批次: {filename}")

    batch = json.load(open(batch_path, encoding="utf-8"))
    geocode = load_geocode()

    if args.lat is not None and args.lon is not None:
        if args.location not in geocode:
            geocode[args.location] = {"lat": args.lat, "lon": args.lon}
            save_geocode(geocode)

    event = {
        "date_iso": args.date,
        "date_raw": args.date_raw or args.date,
        "location": args.location,
        "agency": args.agency,
        "type": args.type,
        "title": args.title,
        "source": args.source or "",
        "file": args.file or "",
        "page": args.page,
        "archive_url": args.archive_url or "",
    }
    batch["events"].append(event)
    save_batch(batch_path, batch)
    print(f"✓ 已添加事件 {args.date} | {args.location} → {os.path.basename(batch_path)}")


def cli_import(args):
    """Import multiple events from a JSON file (array of event objects)."""
    batch_input = args.batch
    with open(args.import_path, encoding="utf-8") as f:
        new_events = json.load(f)
    if not isinstance(new_events, list):
        new_events = new_events.get("events", [])
    print(f"Importing {len(new_events)} events into {batch_input}...")

    existing = find_batch_file(batch_input)
    if existing:
        batch_path = existing
    else:
        release_date = args.release_date or datetime.now().strftime("%Y-%m-%d")
        filename = f"{batch_input}_{release_date}.json"
        batch_path = os.path.join(EVENTS_DIR, filename)
        batch = load_or_init_batch(batch_path,
                                    batch_input.replace("batch_", ""),
                                    args.batch_name or batch_input,
                                    release_date)
        save_batch(batch_path, batch)
        manifest = load_or_init_manifest()
        if os.path.basename(batch_path) not in manifest["batches"]:
            manifest["batches"].append(os.path.basename(batch_path))
            save_manifest(manifest)

    batch = json.load(open(batch_path, encoding="utf-8"))
    batch["events"].extend(new_events)
    save_batch(batch_path, batch)
    print(f"✓ 共 {len(batch['events'])} 条事件在 {os.path.basename(batch_path)}")


def main():
    p = argparse.ArgumentParser(
        description="Add UAP/UFO events to the site.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--batch", help="批次 ID 或文件名 (e.g. batch_002)")
    p.add_argument("--batch-name", help="新批次的展示名")
    p.add_argument("--release-date", help="新批次的发布日期 YYYY-MM-DD")

    p.add_argument("--date", help="事件日期 YYYY-MM-DD")
    p.add_argument("--date-raw", help="原始日期字符串（如有）")
    p.add_argument("--location", help="地点（如 'Roswell, New Mexico'）")
    p.add_argument("--lat", type=float, help="纬度")
    p.add_argument("--lon", type=float, help="经度")
    p.add_argument("--agency", default="FBI", help="报告机构")
    p.add_argument("--type", default="PDF", help="类型 PDF/VID/IMG")
    p.add_argument("--title", help="标题或摘要")
    p.add_argument("--source", help="出处")
    p.add_argument("--file", help="原档文件名")
    p.add_argument("--page", type=int, help="页码")
    p.add_argument("--archive-url", help="原档 URL")

    p.add_argument("--import", dest="import_path",
                   help="从 JSON 文件批量导入（数组形式）")

    args = p.parse_args()

    if args.import_path:
        if not args.batch:
            print("ERROR: --batch is required with --import"); sys.exit(2)
        cli_import(args)
    elif args.date and args.location:
        if not args.batch:
            print("ERROR: --batch is required"); sys.exit(2)
        cli_add(args)
    else:
        # Interactive mode
        interactive()


if __name__ == "__main__":
    main()
