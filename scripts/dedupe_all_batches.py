#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Walk every batch (except Canada, already deduped) and merge
multi-page same-incident records.

Cluster key  : (date_iso, normalized_file, normalized_location_token)
Why per-file : different files can contain different incidents on the
               same date in the same city; only same-file same-date
               same-place is a true split-page incident.

For each merged cluster:
  - Pick canonical = longest summary
  - Set page = min, page_end = max (zero-padded to canonical's width)
  - Append "**Additional pages:**" / "**其它相关页面：**" notes to
    summary_en / summary_zh in summaries.json
  - Aggregate witnesses across the merged pages
  - Drop the absorbed records from the batch (and their summary entries)
"""
import json, os, re, glob
from collections import defaultdict

SITE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
EVENTS_DIR = os.path.join(SITE, 'data/events')
SUMS = os.path.join(SITE, 'data/summaries.json')

SKIP_BATCHES = {'batch_013_canada_foia.json'}  # already deduped


def norm_loc(s):
    if not s: return ''
    return re.split(r'[,;()]', s.lower())[0].strip()


def event_key(e, bid):
    if e.get('id'): return e['id']
    return f"{bid}_{e.get('date_iso','')}_{e.get('location','')}_{(e.get('file') or '')[:30]}"


def split_witnesses(text):
    if not text: return []
    t = text.strip().rstrip('.')
    if t.lower() in ('unspecified','unknown','none','[unclear]','not stated',
                     'redacted','[redacted]','n/a'): return []
    out = []
    for c in re.split(r'\s*;\s*', t):
        for sub in re.split(r',\s*and\s+|\s+and\s+|\s*&\s*', c):
            sub = sub.strip().rstrip(',').strip()
            if sub: out.append(sub)
    return out


def witness_overlap(a, b):
    al, bl = a.lower().strip(), b.lower().strip()
    if al == bl or al in bl or bl in al: return True
    at = set(re.findall(r'\w+', al))
    bt = set(re.findall(r'\w+', bl))
    if at and bt:
        return len(at & bt) / max(len(at), len(bt)) >= 0.6
    return False


def main():
    sums = json.load(open(SUMS)) if os.path.exists(SUMS) else {}
    total_merged = 0
    total_absorbed = 0
    by_batch = {}

    for path in sorted(glob.glob(os.path.join(EVENTS_DIR, 'batch_*.json'))):
        name = os.path.basename(path)
        if name in SKIP_BATCHES: continue
        b = json.load(open(path))
        bid = b.get('batch_id', name)

        groups = defaultdict(list)
        passthrough = []  # events without a page number — keep as-is, never merged
        for e in b['events']:
            page_val = e.get('page')
            if not page_val:
                passthrough.append(e); continue
            try:
                int(str(page_val))
            except (ValueError, TypeError):
                passthrough.append(e); continue
            key = (e['date_iso'], e.get('file',''), norm_loc(e.get('location','')))
            groups[key].append(e)

        kept = list(passthrough)
        drop_keys_in_sums = set()
        keep_event_ids = set()  # events that won't be removed
        merged_in_this_batch = 0
        absorbed_in_this_batch = 0

        # Mark all event-keys we plan to keep, with grouping
        canonical_for = {}  # key → canonical event
        for key, evs in groups.items():
            if len(evs) == 1:
                kept.append(evs[0])
                continue
            # Multi-page cluster
            def slen(e):
                k = event_key(e, bid)
                return len(sums.get(k, {}).get('report_summary','') or '')
            canon = max(evs, key=slen)
            others = [e for e in evs if e is not canon]

            # page range
            pages = sorted(int(str(x['page'])) for x in evs)
            pad = max(3, len(str(canon['page'])))
            canon = dict(canon)
            canon['page'] = f'{pages[0]:0{pad}d}'
            canon['page_end'] = f'{pages[-1]:0{pad}d}'

            # Aggregate witnesses
            all_w = split_witnesses(canon.get('witnesses',''))
            for o in others:
                for w in split_witnesses(o.get('witnesses','')):
                    if w and not any(witness_overlap(w, x) for x in all_w):
                        all_w.append(w)
            if all_w:
                canon['witnesses'] = '; '.join(all_w)

            # Source field annotation
            n_extra = len(others)
            canon['source'] = (canon.get('source','').split(' (+')[0]
                               + f' (+{n_extra} additional pages)')

            # Update summary with merged-pages note
            canon_key = event_key(canon, bid)
            other_pages = sorted(int(str(o['page'])) for o in others)
            note_pages = ', '.join(str(p) for p in other_pages)
            note_en = (f'\n\n**Additional pages:** This same incident is also '
                       f'recorded on {n_extra} other '
                       f'page{"s" if n_extra>1 else ""} '
                       f'(p.{note_pages}) of the same file.')
            note_zh = (f'\n\n**其它相关页面：** 本事件在同一档案中的其它 '
                       f'{n_extra} 页（第 {note_pages} 页）中亦有记录。')
            csum = sums.get(canon_key, {})
            s_en = csum.get('report_summary') or ''
            s_zh = csum.get('report_summary_zh') or ''
            if '**Additional pages:**' not in s_en:
                csum['report_summary'] = s_en.rstrip() + note_en
                csum['report_summary_zh'] = s_zh.rstrip() + note_zh
                if csum and not csum.get('report_summary_label'):
                    csum['report_summary_label'] = 'Summary (merged from multi-page record)'
                sums[canon_key] = csum

            # Mark absorbed sums for removal
            for o in others:
                drop_keys_in_sums.add(event_key(o, bid))

            kept.append(canon)
            merged_in_this_batch += 1
            absorbed_in_this_batch += n_extra

        # Sort & save
        def sort_key(e):
            pv = e.get('page')
            try:
                pn = int(str(pv)) if pv not in (None, '', 'None') else 0
            except (ValueError, TypeError):
                pn = 0
            return (e.get('date_iso',''), e.get('file','') or '', pn)
        kept.sort(key=sort_key)
        b['events'] = kept
        json.dump(b, open(path, 'w'), ensure_ascii=False, separators=(',', ':'))

        for k in drop_keys_in_sums:
            sums.pop(k, None)

        if merged_in_this_batch:
            by_batch[name] = (merged_in_this_batch, absorbed_in_this_batch)
            total_merged += merged_in_this_batch
            total_absorbed += absorbed_in_this_batch

    json.dump(sums, open(SUMS, 'w'), ensure_ascii=False, separators=(',', ':'))

    print(f'Clusters merged across all batches: {total_merged}')
    print(f'Records absorbed                    : {total_absorbed}')
    for name, (m, a) in by_batch.items():
        print(f'  {name:<50}  merged={m}  absorbed={a}')


if __name__ == '__main__':
    main()
