#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Compute and set `page_end` for every multi-page incident across ALL
batches (not just Canada). Walks data/events/*.json, parses any
"**Additional pages:**" note in each event's summary to find the page
references, and writes back `page_end` = max page number found in the
canonical event's own file.

Single-page events keep no page_end (so the UI shows just the page).

Re-runnable; idempotent.
"""
import json, os, re, glob

SITE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
EVENTS_DIR = os.path.join(SITE, 'data/events')
SUMS_PATH  = os.path.join(SITE, 'data/summaries.json')

# Two reference patterns we need to recognize:
#  1) "<file label> p.<n>" — used by the Canada dedupe pass
#  2) "PDF pages X, Y, and Z" — used by the NZ refine pass
REF_RE      = re.compile(r'([A-Za-z0-9][\w\-/.,\s]{0,80}?)\s+p\.(\d+)')
PAGES_LIST  = re.compile(r'PDF\s+pages?\s+([\d,\s\-]+(?:\s+and\s+\d+)?)', re.I)


def file_label(file_field):
    """Reduce 'Canada - FOIA Part 04 - Pages 901-1200.pdf' or similar to
    a comparable label fragment. Keep flexibility for other batches."""
    if not file_field: return ''
    s = file_field.replace('.pdf', '').strip()
    # Drop common prefixes
    s = re.sub(r'^Canada - FOIA\s*', '', s)
    return re.sub(r'\s+', ' ', s).strip()


def main():
    summaries = {}
    if os.path.exists(SUMS_PATH):
        summaries = json.load(open(SUMS_PATH))

    total_updated = 0
    by_batch = {}

    for batch_path in sorted(glob.glob(os.path.join(EVENTS_DIR, '*.json'))):
        b = json.load(open(batch_path))
        bid = b.get('batch_id', os.path.basename(batch_path))
        n_updated = 0
        for e in b.get('events', []):
            canonical_page_raw = e.get('page')
            if canonical_page_raw is None:
                continue
            try:
                canonical_page = int(str(canonical_page_raw))
            except (ValueError, TypeError):
                continue
            if not canonical_page:
                continue

            # Compute the summary-key (matches split_summaries.py)
            key = e.get('id') or f"{bid}_{e.get('date_iso','')}_{e.get('location','')}_{(e.get('file') or '')[:30]}"

            # Summary text — try batch event first, then summaries.json
            s_text = e.get('report_summary') or ''
            if not s_text and key in summaries:
                s_text = summaries[key].get('report_summary','') or ''
            # Recognise three kinds of multi-page markers:
            #   "**Additional pages:**" (Canada dedupe)
            #   "Additional pages"      (defensive)
            #   "referenced on PDF pages" (NZ refine)
            if not any(m in s_text for m in (
                    '**Additional pages:**', 'Additional pages',
                    'referenced on PDF page')):
                continue

            own_lbl = file_label(e.get('file','')).lower()
            same_file_pages = {canonical_page}
            # Pattern 1: "<file label> p.NN" — labelled cross-references
            for label, pn in REF_RE.findall(s_text):
                label = file_label(label).lower()
                if not own_lbl or own_lbl in label or label in own_lbl:
                    try:
                        same_file_pages.add(int(pn))
                    except ValueError:
                        pass
            # Pattern 2: "PDF pages X, Y, and Z" — bare page lists
            for chunk in PAGES_LIST.findall(s_text):
                for num in re.findall(r'\d+', chunk):
                    try:
                        same_file_pages.add(int(num))
                    except ValueError:
                        pass

            if len(same_file_pages) > 1:
                start = min(same_file_pages)
                end   = max(same_file_pages)
                # Preserve zero-padding width of the original
                pad = max(3, len(str(canonical_page_raw)))
                e['page']     = f'{start:0{pad}d}'
                e['page_end'] = f'{end:0{pad}d}'
                n_updated += 1
        if n_updated:
            with open(batch_path, 'w') as f:
                json.dump(b, f, ensure_ascii=False, separators=(',', ':'))
            total_updated += n_updated
            by_batch[os.path.basename(batch_path)] = n_updated

    print(f'Multi-page events updated across all batches : {total_updated}')
    for batch, n in sorted(by_batch.items()):
        print(f'  {batch:<50} {n}')


if __name__ == '__main__':
    main()
