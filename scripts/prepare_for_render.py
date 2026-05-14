#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Prepare the site for Render deployment.

Steps:
  1. Rewrite each event's archive_url from a local path to the original
     war.gov / DVIDS URL (so we don't have to upload archives).
  2. Note local archive symlinks (harmless on Render; useful for local dev).

Idempotent — safe to run repeatedly.

The script lives in <site_root>/scripts/, so the site root is its parent dir.
"""
import os
import re
import sys
import json


def title_to_hash(s):
    """Mirror war.gov/UFO's JS titleToHash() — strip non-alphanum, replace spaces with hyphens."""
    s = (s or '').strip()
    s = re.sub(r'\s+', '-', s)
    s = re.sub(r'[^A-Za-z0-9\-_]', '', s)
    s = re.sub(r'-+', '-', s)
    return s


def gov_page_url(title):
    """Build the war.gov deep-link URL for a given record title."""
    h = title_to_hash(title)
    return f"https://www.war.gov/UFO/#{h}" if h else "https://www.war.gov/UFO/"

# Site root = parent dir of this script
SITE = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA = os.path.join(SITE, "data")
ARCHIVES = os.path.join(SITE, "archives")
RECORDS_JSON = os.path.join(SITE, "records.json")
DVIDS_JSON = os.path.join(SITE, "dvids_metadata.json")


def load_archive_url_map():
    """Build {filename → {archive_url, image_url, type, record_title, description, gov_url}}
    from records.json."""
    if not os.path.exists(RECORDS_JSON):
        print(f"[prepare] WARNING: {RECORDS_JSON} not found, "
              f"cannot rewrite to external URLs")
        return {}
    with open(RECORDS_JSON, encoding="utf-8") as f:
        records = json.load(f)
    info_map = {}
    title_to_url = {}  # for matching events whose `file` field is missing
    for r in records:
        title = (r.get("title") or "").strip()
        gov_url = gov_page_url(title) if title else "https://www.war.gov/UFO/"
        link = r.get("main_link", "")
        info_obj = {
            "archive_url": link,
            "image_url": (r.get("modal_image") or "").strip(),
            "record_type": r.get("type", ""),
            "record_title": title,
            "description": (r.get("description") or "").strip(),
            "gov_page_url": gov_url,
            "incident_date": (r.get("incident_date") or "").strip(),
            "incident_location": (r.get("incident_location") or "").strip(),
        }
        if link:
            fname = os.path.basename(link)
            info_map.setdefault(fname.lower(), info_obj)
        title_to_url[title.lower()] = info_obj
    info_map["__by_title__"] = title_to_url
    return info_map


# Locations that are either outer-space, broadcast media, or too vague
# to render as a single point on the map. They show in the "Other" panel.
NON_GEOGRAPHIC_LOCATIONS = {
    "moon",
    "low earth orbit",
    "pacific ocean",
    "pacific time zone (us)",
    "pacific time zone",
    "indopacom (indo-pacific)",
    "indopacom",
    "indo-pacom",
    "western united states",
    "united states (general)",
    "southern united states",
    "middle east",
    "middle east (general)",
    "united states",
    "television broadcast (us)",
    "affidavit (gen. du bose, retired)",
    "television (lt. col. marcel testimony)",
    "washington, d.c. (gao)",
}


def load_video_info_map():
    """Build {filename or title → video info} for events with paired DVIDS videos.

    Returns dict keyed by lowercase filename. Each value is:
      {video_url, dvids_id, video_title, dvids_page}
    """
    if not os.path.exists(RECORDS_JSON) or not os.path.exists(DVIDS_JSON):
        return {}
    with open(RECORDS_JSON, encoding="utf-8") as f:
        records = json.load(f)
    with open(DVIDS_JSON, encoding="utf-8") as f:
        dvids = json.load(f)

    # records.json has both PDF rows and VID rows that share the same PDF link
    # but have different titles. Both rows have dvids_video_id pointing at the
    # same video. Pivot: filename → dvids_video_id (use the first non-empty).
    file_to_dvids = {}
    for r in records:
        dvids_id = (r.get("dvids_video_id") or "").strip()
        if not dvids_id:
            continue
        link = r.get("main_link", "")
        if link:
            fname = os.path.basename(link).lower()
            file_to_dvids.setdefault(fname, dvids_id)

    # Build the output map
    info_map = {}
    for fname, dvids_id in file_to_dvids.items():
        meta = dvids.get(dvids_id)
        if not meta:
            continue
        info_map[fname] = {
            "video_url": meta.get("best_mp4_src", ""),
            "dvids_id": dvids_id,
            "video_title": meta.get("title", ""),
            "dvids_page": f"https://www.dvidshub.net/video/{dvids_id}",
            "captions_vtt": meta.get("captions_webvtt", ""),
            "duration": meta.get("duration"),
        }
    return info_map


def rewrite_event_batches(info_map, video_map):
    """For each event:
      - rewrite archive_url to point to war.gov
      - attach image_url (thumbnail)
      - attach paired DVIDS video info if available
      - flag non_geographic locations (Moon, generic regions, etc.)
      - attach gov_page_url deep-link to war.gov/UFO record
    """
    by_title = info_map.get("__by_title__", {})
    events_dir = os.path.join(DATA, "events")
    if not os.path.isdir(events_dir):
        print(f"[prepare] {events_dir} missing — skip rewrite")
        return
    totals = {"external": 0, "image": 0, "video": 0, "non_geo": 0, "gov": 0}
    for fn in sorted(os.listdir(events_dir)):
        if not fn.endswith(".json"):
            continue
        path = os.path.join(events_dir, fn)
        with open(path, encoding="utf-8") as f:
            batch = json.load(f)
        counts = {"external": 0, "image": 0, "video": 0, "non_geo": 0, "gov": 0}
        for ev in batch.get("events", []):
            fname = (ev.get("file") or "").lower()
            info = info_map.get(fname) if fname else None
            # Fallback: lookup by title
            if not info:
                title_low = (ev.get("title") or "").lower().strip()
                if title_low in by_title:
                    info = by_title[title_low]
            if info:
                if info.get("archive_url"):
                    if ev.get("archive_url") != info["archive_url"]:
                        ev["archive_url"] = info["archive_url"]
                    counts["external"] += 1
                if info.get("image_url"):
                    ev["image_url"] = info["image_url"]
                    counts["image"] += 1
                if not ev.get("record_description") and info.get("description"):
                    ev["record_description"] = info["description"]
                if info.get("record_type"):
                    ev["record_type"] = info["record_type"]
                # Attach gov.war page deep link
                if info.get("gov_page_url"):
                    ev["gov_page_url"] = info["gov_page_url"]
                    counts["gov"] += 1
                # Sync date/location from official manifest if our data is missing/N/A
                if info.get("incident_date"):
                    ev["official_date"] = info["incident_date"]
                if info.get("incident_location"):
                    ev["official_location"] = info["incident_location"]
            # Attach paired video
            vinfo = video_map.get(fname) if fname else None
            # Fallback: try by title
            if not vinfo:
                # Search video_map for any entry with matching title
                title_low = (ev.get("title") or "").lower().strip()
                for k, v in video_map.items():
                    if k.startswith(title_to_hash(title_low).lower()[:20]):
                        vinfo = v
                        break
            if vinfo and vinfo.get("video_url"):
                ev["video_url"] = vinfo["video_url"]
                ev["dvids_id"] = vinfo["dvids_id"]
                ev["video_title"] = vinfo["video_title"]
                ev["dvids_page"] = vinfo["dvids_page"]
                if vinfo.get("captions_vtt"):
                    ev["video_captions_vtt"] = vinfo["captions_vtt"]
                counts["video"] += 1
            # Flag non-geographic
            loc_key = (ev.get("location") or "").lower().strip()
            if loc_key in NON_GEOGRAPHIC_LOCATIONS:
                ev["non_geographic"] = True
                counts["non_geo"] += 1
        with open(path, "w", encoding="utf-8") as f:
            json.dump(batch, f, indent=2, ensure_ascii=False)
        for k, v in counts.items():
            totals[k] += v
        print(f"[prepare] {fn}: external={counts['external']} "
              f"images={counts['image']} videos={counts['video']} "
              f"non_geo={counts['non_geo']} gov_url={counts['gov']}")
    print(f"[prepare] TOTALS: external={totals['external']} "
          f"images={totals['image']} videos={totals['video']} "
          f"non_geographic={totals['non_geo']} gov_url={totals['gov']}")


def note_archive_symlinks():
    """Symlinks remain for local dev; Render simply ignores symlink targets
    outside the publish path (PDFs are served from war.gov anyway)."""
    if not os.path.exists(ARCHIVES):
        return
    n = sum(1 for x in os.listdir(ARCHIVES)
            if os.path.islink(os.path.join(ARCHIVES, x)))
    if n:
        print(f"[prepare] {n} archive symlink(s) present "
              f"(local dev only; Render ignores)")


def write_version_file():
    """Write data/version.json with build timestamp + commit SHA. The
    client polls this with no-cache to detect new deploys and reload."""
    from datetime import datetime, timezone
    commit = (os.environ.get('RENDER_GIT_COMMIT', '')
              or os.environ.get('GIT_COMMIT', ''))[:8]
    if not commit:
        try:
            import subprocess
            commit = subprocess.check_output(
                ['git', 'rev-parse', '--short=8', 'HEAD'],
                cwd=SITE, stderr=subprocess.DEVNULL).decode().strip()
        except Exception:
            commit = 'local'
    payload = {
        'version': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'commit': commit or 'unknown',
    }
    out = os.path.join(DATA, 'version.json')
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(payload, f)
    print(f"[prepare] version.json: {payload['version']} (commit {payload['commit']})")


def main():
    print(f"[prepare] SITE={SITE}")
    write_version_file()
    info_map = load_archive_url_map()
    video_map = load_video_info_map()
    print(f"[prepare] file→{{url,image,...}} map: {len(info_map)} entries")
    print(f"[prepare] file→paired-video map: {len(video_map)} entries")
    if not info_map:
        print("[prepare] No info map → keeping existing values")
        return
    rewrite_event_batches(info_map, video_map)
    note_archive_symlinks()
    # Perf: split heavy report_summary fields into lazy-loaded summaries.json.
    # Idempotent — re-runs after rewrite_event_batches above so any newly
    # added summary fields get included.
    try:
        import subprocess
        script = os.path.join(os.path.dirname(__file__), 'split_summaries.py')
        subprocess.check_call([sys.executable, script])
    except Exception as e:
        print(f'[prepare] WARN: split_summaries.py failed: {e}')
    # Final size check
    total = 0
    for d, _, files in os.walk(SITE):
        for f in files:
            try:
                total += os.path.getsize(os.path.join(d, f))
            except OSError:
                pass
    print(f"[prepare] Final site size: {total / 1024 / 1024:.2f} MB")


if __name__ == "__main__":
    main()
