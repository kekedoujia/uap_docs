#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build perf optimization: split report_summary / report_summary_zh out
of batch JSON files into a single lazy-loadable data/summaries.json.

Initial cold-page load was dominated by the DoW batch (3.3 MB, of which
~64% is report-summary text only used when a user opens the detail panel).
After this split:
  - Each batch keeps only the fields needed for list/marker rendering
    (date, location, agency, title, etc.)
  - data/summaries.json (~2 MB before gzip, much smaller after) is fetched
    lazily by the client when a detail panel is first opened.

Idempotent. Safe to re-run before each deploy.
"""
import json, os, glob

SITE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DATA = os.path.join(SITE, 'data')
EVENTS_DIR = os.path.join(DATA, 'events')
SUMMARIES_OUT = os.path.join(DATA, 'summaries.json')

SUMMARY_FIELDS = ('report_summary', 'report_summary_zh', 'report_summary_label')

def event_key(e, batch_id):
    """Stable id matching app.js's ev.id computation."""
    if e.get('id'):
        return e['id']
    return f"{batch_id}_{e.get('date_iso','')}_{e.get('location','')}_{(e.get('file') or '')[:30]}"


def main():
    # PRESERVE existing summaries — only add/overwrite for events whose batch
    # still has report_summary inline. Otherwise re-running this script after
    # the batches are already split would wipe summaries.json to {}.
    summaries = {}
    if os.path.exists(SUMMARIES_OUT):
        try:
            summaries = json.load(open(SUMMARIES_OUT))
        except Exception:
            summaries = {}
    batches_modified = 0
    total_events = 0
    bytes_saved = 0

    for path in sorted(glob.glob(os.path.join(EVENTS_DIR, 'batch_*.json'))):
        b = json.load(open(path))
        bid = b.get('batch_id', os.path.basename(path))
        before = os.path.getsize(path)
        changed = False
        for e in b['events']:
            total_events += 1
            key = event_key(e, bid)
            entry = {}
            for f in SUMMARY_FIELDS:
                if f in e and e[f]:
                    entry[f] = e[f]
            if entry:
                summaries[key] = entry
                # Strip from batch
                for f in SUMMARY_FIELDS:
                    if f in e:
                        del e[f]
                        changed = True
        if changed:
            # Minified (no indent) — shaves another ~20%.
            with open(path, 'w') as fp:
                json.dump(b, fp, ensure_ascii=False, separators=(',', ':'))
            after = os.path.getsize(path)
            bytes_saved += before - after
            batches_modified += 1
            print(f'  {os.path.basename(path)}: {before/1024:>6.0f}KB → {after/1024:>6.0f}KB')

    # Write the consolidated summaries file (minified).
    with open(SUMMARIES_OUT, 'w') as fp:
        json.dump(summaries, fp, ensure_ascii=False, separators=(',', ':'))

    print(f'\nBatches modified : {batches_modified}')
    print(f'Total events     : {total_events}')
    print(f'Summaries written: {len(summaries)}')
    print(f'summaries.json   : {os.path.getsize(SUMMARIES_OUT)/1024:.0f} KB')
    print(f'Bytes saved from batches: {bytes_saved/1024:.0f} KB')


if __name__ == '__main__':
    main()
