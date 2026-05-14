# 🛸 UFO/UAP Disclosure Map

Interactive map, timeline, and reports browser for declassified UFO/UAP records released by national governments. **Live at [uap-map.com](https://uap-map.com)** (deployed on Render).

The repository directory **is** the static website — no backend, just JSON files and vanilla JS.

## Current scale

| | Count |
|---|---|
| Events | **4,410** across 13 batches |
| Mapped (with coordinates) | **96.0%** (4,233 events) |
| Date range | **1865 – 2025** |
| Geocoded place names | 3,523 |
| Lazy-loaded summaries (EN + ZH) | 4,386 |
| Repo size | ~635 MB (mostly page thumbnails) |

### Data sources

| Source | Code | Events | Origin |
|---|---|---|---|
| US Department of War FOIA Release 01 | `DoW` | 701 | [war.gov/UFO](https://www.war.gov/UFO/) |
| Canadian FOIA + CIRVIS (30 PDFs, ~8,700 pages) | `CA-FOIA` | 3,456 | [archive.org/details/CanadaUFO](https://archive.org/details/CanadaUFO) |
| New Zealand Defence Force | `NZDF` | 243 | [nzdf.mil.nz/foi](https://www.nzdf.mil.nz/foi/) |
| National Archives of Australia (A703 / 580/1/1) | `NAA` | 8 | [recordsearch.naa.gov.au](https://recordsearch.naa.gov.au/) |
| Arquivo Nacional Brasil (Ilha da Trindade 1958) | `BR-AN` | 2 | [arquivonacional.gov.br](https://www.arquivonacional.gov.br/) |

## Quick start (local)

```bash
python3 -m http.server 9876
# Open http://localhost:9876
```

The site must be served over HTTP — browsers disallow `fetch()` of JSON over `file://`.

## Pages

| Page | Path | Description |
|---|---|---|
| **Map** | `index.html` | Leaflet dark world map with event markers + GeoNames human-activity heatmap. Click any marker for the report detail panel. |
| **Timeline** | `timeline.html` | Chronological browser. Filter by date range, agency, type, country. |
| **Reports** | `reports.html` | Searchable table of all events. Sort by date, agency, location. |

All three pages share:
- 🌐 Bilingual EN / 中文 switch (top-right)
- 🔍 Date range, agency, type, and per-country filters
- 📄 Per-event detail card with lat/lon, witnesses, source PDF page anchor, EN + ZH summary
- 🔗 Direct link to the originating gov / archive.org PDF, anchored to the exact page

## Architecture

```
ufo_site/
├── index.html / timeline.html / reports.html     # 3 user-facing pages
├── css/style.css
├── js/
│   ├── app.js              # Map page logic (Leaflet, markers, heatmap)
│   ├── timeline.js         # Timeline page
│   ├── reports.js          # Reports table
│   ├── i18n.js             # EN/ZH translation dictionary
│   ├── visitor.js          # Lightweight visit counter
│   └── version_check.js    # Auto-reload when a new deploy is detected
├── data/
│   ├── manifest.json       # List of all event batches
│   ├── version.json        # Build timestamp + commit SHA (regenerated each deploy)
│   ├── geocode.json        # Location string → {lat, lon}
│   ├── cities_heatmap.json # 33k+ GeoNames cities for the heatmap
│   ├── summaries.json      # Lazy-loaded EN + ZH per-event summaries
│   ├── events/
│   │   ├── batch_001_dow_release_01_2026-05-08.json
│   │   ├── batch_002_aus_naa.json
│   │   ├── batch_003-011_nzdf_*.json
│   │   ├── batch_012_br_arquivo_nacional.json
│   │   └── batch_013_canada_foia.json
│   └── page_thumbs/        # Per-page JPEG thumbnails (linked from event details)
├── render.yaml             # Render Blueprint (build + cache headers)
└── scripts/
    ├── prepare_for_render.py    # Build step: rewrites archive_url + writes version.json
    ├── split_summaries.py       # Extracts per-event summaries into summaries.json
    └── add_event.py             # CLI for adding a new event
```

### Data flow on each deploy

1. `git push` to `main` → Render auto-deploys
2. Render runs `python3 scripts/prepare_for_render.py`:
   - Writes `data/version.json` with build UTC timestamp + commit SHA
   - Rewrites every event's `archive_url` to point at the original gov / archive.org PDF
   - Splits long summaries into the lazy-loaded `data/summaries.json`
3. Render serves the repo as a static site

### Client-side version check

`js/version_check.js` (loaded by every page) fetches `data/version.json` with `cache: no-store` on page load, then re-checks on `visibilitychange`, `focus`, and every 5 min. If the server's version differs from what was loaded, a banner appears and the page auto-reloads after 4 s. This means an open tab self-refreshes shortly after any deploy without manual cache-clearing.

Cache-Control headers (set in `render.yaml`):

| File | TTL | Notes |
|---|---|---|
| `data/version.json` | `no-store` | Always fresh |
| `data/manifest.json` | 60 s + must-revalidate | Drives staleness checks |
| `data/events/*.json` | 120 s + must-revalidate | Pick up new events quickly |
| `data/summaries.json` | 120 s + must-revalidate | Paired with event batches |
| `data/geocode.json` | 5 min + must-revalidate | |
| `data/cities_heatmap.json` | 7 days + immutable | Never changes |
| `js/*`, `css/*` | 1 hour | |
| `*.html` | 5 min | |

## Adding events

```bash
python3 scripts/add_event.py \
  --batch batch_014 \
  --date 2026-12-15 \
  --location "Some City, Country" \
  --lat 33.39 --lon -104.52 \
  --agency FBI --type PDF \
  --title "Event description" \
  --archive-url "https://www.example.gov/file.pdf"
```

Or run with no args for an interactive prompt:

```bash
python3 scripts/add_event.py
```

For bulk ingestion (a new PDF release), see the per-source ingest scripts in the parent repo's `canada_ufo/`, `new_zealand_ufo/`, etc.

## Deploy to Render

```bash
git init && git add . && git commit -m "Initial"
git remote add origin git@github.com:USER/uap_docs.git
git push -u origin main
# Then on render.com → New → Blueprint → connect repo → Apply
```

`render.yaml` is a Render Blueprint — no manual configuration needed after connecting the repo.

## Credits

- Maps: [Leaflet](https://leafletjs.com/) + [CARTO Dark](https://carto.com/) + OpenStreetMap
- City heatmap: [GeoNames cities15000](https://download.geonames.org/export/dump/)
- Geocoding: Gemini Flash-Lite (city centers) + [Nominatim](https://nominatim.openstreetmap.org/) (manual entries)
- OCR pipelines (for ingest in the parent repo): Gemini 3.1 Flash-Lite for first pass, GPT-5.4-mini (Thinking) for difficult pages

## License

Source code: MIT. Government records: public domain (FOIA releases). Third-party derivatives (GeoNames, OSM) under their respective licenses.
