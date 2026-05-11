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
import sys
import json

# Site root = parent dir of this script
SITE = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA = os.path.join(SITE, "data")
ARCHIVES = os.path.join(SITE, "archives")
RECORDS_JSON = os.path.join(SITE, "records.json")


def load_archive_url_map():
    """Build {filename → original public URL} from records.json."""
    if not os.path.exists(RECORDS_JSON):
        print(f"[prepare] WARNING: {RECORDS_JSON} not found, "
              f"cannot rewrite to external URLs")
        return {}
    with open(RECORDS_JSON, encoding="utf-8") as f:
        records = json.load(f)
    url_map = {}
    for r in records:
        link = r.get("main_link", "")
        if not link:
            continue
        fname = os.path.basename(link)
        url_map[fname.lower()] = link
    return url_map


def rewrite_event_batches(url_map):
    """Rewrite archive_url field in every event batch JSON."""
    events_dir = os.path.join(DATA, "events")
    if not os.path.isdir(events_dir):
        print(f"[prepare] {events_dir} missing — skip rewrite")
        return
    total_rewritten = 0
    total_untouched = 0
    for fn in sorted(os.listdir(events_dir)):
        if not fn.endswith(".json"):
            continue
        path = os.path.join(events_dir, fn)
        with open(path, encoding="utf-8") as f:
            batch = json.load(f)
        rewritten = 0
        untouched = 0
        for ev in batch.get("events", []):
            fname = (ev.get("file") or "").lower()
            external = url_map.get(fname)
            if external:
                # Only update if not already pointing to war.gov
                if ev.get("archive_url") != external:
                    ev["archive_url"] = external
                rewritten += 1
            else:
                untouched += 1
        with open(path, "w", encoding="utf-8") as f:
            json.dump(batch, f, indent=2, ensure_ascii=False)
        total_rewritten += rewritten
        total_untouched += untouched
        print(f"[prepare] {fn}: external={rewritten} kept-as-is={untouched}")
    print(f"[prepare] DONE. Total: external={total_rewritten} kept-as-is={total_untouched}")


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


def main():
    print(f"[prepare] SITE={SITE}")
    url_map = load_archive_url_map()
    if not url_map:
        print("[prepare] No URL map → keeping existing archive_url values")
        return
    rewrite_event_batches(url_map)
    note_archive_symlinks()
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
