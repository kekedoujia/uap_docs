// Reports page — groups events by source PDF/file and lists each report
// as an expandable card with its constituent events sorted by page number.

const STATE = {
  events: [],
  geocode: {},
  manifest: null,
  reports: [],   // [{key, file, label, record_description, archive_url, gov_page_url, agency, type, events:[], pages:Set, eventCount}]
  filters: { q: '', sort: 'events' },
  expanded: new Set(),
  lastDetailEvent: null,
};

async function fetchData(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  return res.json();
}

async function loadData() {
  const manifest = await fetchData('data/manifest.json');
  STATE.manifest = manifest;
  STATE.geocode = await fetchData('data/geocode.json');
  // pdf_pages.json: file → total page count in the source PDF
  try {
    STATE.pdfPages = await fetchData('data/pdf_pages.json');
  } catch (e) {
    STATE.pdfPages = {};
  }
  const all = [];
  const dataSources = {};
  for (const batchFile of manifest.batches) {
    const batch = await fetchData(`data/events/${batchFile}`);
    if (batch.data_source) {
      dataSources[batch.data_source] = {
        id: batch.data_source,
        label: batch.data_source_label || batch.data_source,
        short_label: batch.data_source_short_label || batch.data_source,
        filter_label: batch.data_source_filter_label || batch.data_source_label || batch.data_source,
        short_label_zh: batch.data_source_short_label_zh || batch.data_source_short_label || batch.data_source,
        filter_label_zh: batch.data_source_filter_label_zh || batch.data_source_filter_label || batch.data_source,
        url: batch.data_source_url || '',
      };
    }
    for (const e of batch.events) {
      const geo = STATE.geocode[e.location];
      const ev = Object.assign({}, e, {
        lat: geo ? geo.lat : null,
        lon: geo ? geo.lon : null,
        batch_id: batch.batch_id,
        batch_name: batch.batch_name,
        release_date: batch.release_date,
        data_source: e.data_source || batch.data_source || 'Other',
      });
      ev.id = e.id || `${batch.batch_id}_${ev.date_iso}_${ev.location}_${(ev.file || '').slice(0, 30)}`;
      all.push(ev);
    }
  }
  STATE.events = all;
  STATE.dataSources = dataSources;

  // Group by `file` (PDF). Events without a file go into a synthetic
  // "(no file / video pairing)" bucket keyed by 'type+video_title' or 'agency'.
  const groups = new Map();
  for (const e of all) {
    let key;
    if (e.file) {
      key = e.file;
    } else {
      // Non-file events (e.g. external archive references like NAA RecordSearch):
      // each event becomes its own group keyed by id, so the reports view lists
      // them individually rather than collapsing into a single bucket.
      key = `__ref__::${e.id}`;
    }
    if (!groups.has(key)) {
      const isPdf = !!e.file && /\.pdf$/i.test(e.file);
      groups.set(key, {
        key,
        is_pdf: isPdf,
        is_external_ref: !e.file,
        file: e.file || null,
        // For non-file refs, use the event title as the card label
        label: e.file || e.title || e.video_title || '(no title)',
        record_description: e.record_description || '',
        archive_url: e.archive_url || null,
        gov_page_url: e.gov_page_url || null,
        agency: e.agency || '',
        type: e.type || '',
        events: [],
        pages: new Set(),
      });
    }
    const g = groups.get(key);
    g.events.push(e);
    if (e.page) g.pages.add(String(e.page).padStart(4, '0'));
  }
  // Compute counts and sort events by page (ascending) then date
  for (const g of groups.values()) {
    g.eventCount = g.events.length;
    // pageCount = total pages in the source PDF (from pdf_pages.json),
    // falling back to the count of distinct event-pages if not available.
    g.pageCount = (g.file && (STATE.pdfPages || {})[g.file]) || g.pages.size;
    g.coveredPages = g.pages.size;  // distinct event-pages (informational)
    g.events.sort((a, b) => {
      const pa = parseInt(a.page || 0, 10);
      const pb = parseInt(b.page || 0, 10);
      if (pa !== pb) return pa - pb;
      return (a.date_iso || '').localeCompare(b.date_iso || '');
    });
  }
  STATE.reports = [...groups.values()];

  document.getElementById('event-count').textContent = all.length;
  document.getElementById('report-count').textContent = STATE.reports.length;
  document.getElementById('rp-total-count').textContent = STATE.reports.length;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeAttr(s) {
  if (s == null) return '';
  return String(s).replace(/"/g, '&quot;').replace(/&/g, '&amp;');
}

function renderSummary(text) {
  if (!text) return '';
  let s = escapeHtml(text);
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  const paras = s.split(/\n\s*\n+/).map(p => p.trim()).filter(Boolean);
  return paras.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
}

function renderSummaryBlock(e, lang) {
  if (!e.report_summary) return '';
  const label = e.report_summary_label
    ? `<div class="full-text-label">${escapeHtml(e.report_summary_label)}</div>`
    : '';
  if (lang === 'zh' && e.report_summary_zh) {
    return `
      <div class="full-text">
        ${label}
        ${renderSummary(e.report_summary_zh)}
        <details class="bilingual-toggle">
          <summary>原文 / English original</summary>
          <div class="bilingual-en">${renderSummary(e.report_summary)}</div>
        </details>
      </div>`;
  }
  return `
    <div class="full-text">
      ${label}
      ${renderSummary(e.report_summary)}
    </div>`;
}

function agencyKind(agency) {
  const a = (agency || '').toLowerCase();
  if (a.includes('fbi')) return 'fbi';
  if (a.includes('nasa')) return 'nasa';
  if (a.includes('usaf') || a.includes('air force') || a.includes('osi')
      || a.includes('project sign') || a.includes('project grudge')) return 'usaf';
  if (a.includes('department of war')) return 'dow';
  return '';
}

function shortenFile(f) {
  // Strip hash-like prefixes (e.g. "342_hs1-416511228_box186_319.1-flying-discs-1949.pdf"
  // → "Box 186 319.1 Flying Discs 1949")
  if (!f) return '';
  let s = f.replace(/\.pdf$/i, '');
  // Common patterns:
  //   "342_hs1-416511228_box186_319.1-flying-discs-1949"
  //     → "Box 186 319.1 — Flying Discs 1949"
  //   "38_143685_box7_incident_summaries_1-100"
  //     → "Box 7 — Incident Summaries 1-100"
  //   "65_hs1-834228961_62-hq-83894_section_2"
  //     → "FBI 62-HQ-83894 — Section 2"
  const m1 = s.match(/box(\d+)[_\-]([0-9.]+)[_\-](.+)$/i);
  if (m1) return `Box ${m1[1]} ${m1[2]} — ${m1[3].replace(/_+/g, ' ')}`;
  const m2 = s.match(/box(\d+)[_\-](.+)$/i);
  if (m2) return `Box ${m2[1]} — ${m2[2].replace(/_+/g, ' ')}`;
  const m3 = s.match(/(\d{2,3}-?hq-\d{3,})[_\-](.+)$/i);
  if (m3) return `FBI ${m3[1].toUpperCase()} — ${m3[2].replace(/_+/g, ' ')}`;
  return s.replace(/_+/g, ' ');
}

function reportPasses(r) {
  const f = STATE.filters;
  if (f.source) {
    // Pass only if any event in the report belongs to that data source
    const hits = r.events.some(e => (e.data_source || 'Other') === f.source);
    if (!hits) return false;
  }
  if (!f.q) return true;
  const hay = (r.label + ' ' + r.file + ' ' + r.record_description + ' '
    + r.agency + ' ' + r.type).toLowerCase();
  return hay.includes(f.q);
}

function dsLabel(id, kind) {
  const lang = (typeof I18N !== 'undefined' && I18N.current) || 'zh';
  const info = (STATE.dataSources && STATE.dataSources[id]) || { id };
  const zhKey = kind + '_zh';
  return (lang === 'zh' && info[zhKey]) || info[kind] || info.label || id;
}

function buildFilters() {
  // Populate the source filter dropdown from STATE.dataSources
  const srcSel = document.getElementById('rp-source-filter');
  if (srcSel) {
    const counts = new Map();
    for (const r of STATE.reports) {
      for (const e of r.events) {
        const ds = e.data_source || 'Other';
        counts.set(ds, (counts.get(ds) || 0) + 1);
      }
    }
    srcSel.innerHTML = '<option value="">All</option>' + [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([s, n]) => `<option value="${escapeAttr(s)}">${escapeHtml(dsLabel(s, 'filter_label'))} (${n})</option>`).join('');
    srcSel.addEventListener('change', refilter);
  }
  document.getElementById('rp-search').addEventListener('input', refilter);
  document.getElementById('rp-sort').addEventListener('change', refilter);
  document.getElementById('detail-close').addEventListener('click', () => {
    document.getElementById('detail-panel').classList.add('hidden');
  });
}

function readFilters() {
  const srcSel = document.getElementById('rp-source-filter');
  STATE.filters = {
    q: document.getElementById('rp-search').value.trim().toLowerCase(),
    sort: document.getElementById('rp-sort').value,
    source: srcSel ? srcSel.value : '',
  };
}

function refilter() {
  readFilters();
  render();
}

function renderEventLine(e) {
  const kind = agencyKind(e.agency);
  const pageLabel = e.page ? `p.${parseInt(e.page, 10)}` : '—';
  const ngBadge = e.non_geographic
    ? `<span class="rp-tag rp-tag-other">${escapeHtml(I18N.t('tl_tag_no_geo'))}</span>` : '';
  const date = e.date_iso || '—';
  const title = escapeHtml((e.title || '').slice(0, 140))
    + (e.title && e.title.length > 140 ? '…' : '');
  return `
    <li class="rp-event-row" data-id="${escapeAttr(e.id)}" tabindex="0" role="button">
      <span class="rp-row-marker rp-marker-${kind}"></span>
      <span class="rp-row-page">${escapeHtml(pageLabel)}</span>
      <span class="rp-row-date">${escapeHtml(date)}</span>
      <span class="rp-row-loc">${escapeHtml(e.location || '')}</span>
      <span class="rp-row-title">${title}</span>
      ${ngBadge}
    </li>
  `;
}

function renderReportCard(r) {
  const isOpen = STATE.expanded.has(r.key);
  const labelPretty = r.is_pdf ? shortenFile(r.file) : r.label;
  const desc = r.record_description
    ? `<div class="rp-card-desc">${escapeHtml(r.record_description)}</div>`
    : '';
  const headerTitle = r.is_pdf
    ? `<div class="rp-card-file"><span class="rp-card-fileicon">📄</span><code>${escapeHtml(r.file)}</code></div>`
    : `<div class="rp-card-file"><span class="rp-card-fileicon">🎬</span>${escapeHtml(r.label)}</div>`;

  const pdfLink = r.archive_url
    ? `<a class="rp-link" href="${escapeAttr(r.archive_url)}" target="_blank" rel="noopener">${escapeHtml(I18N.t('reports_open_pdf_short'))}</a>`
    : '';
  const govLink = r.gov_page_url
    ? `<a class="rp-link rp-link-gov" href="${escapeAttr(r.gov_page_url)}" target="_blank" rel="noopener">${escapeHtml(I18N.t('reports_open_gov'))}</a>`
    : '';

  const eventsList = isOpen ? `
    <ul class="rp-event-list">
      ${r.events.map(renderEventLine).join('')}
    </ul>
  ` : '';

  return `
    <article class="rp-card ${isOpen ? 'rp-open' : ''}" data-key="${escapeAttr(r.key)}">
      <header class="rp-card-header" tabindex="0" role="button" aria-expanded="${isOpen}">
        <div class="rp-card-titleblock">
          <h2 class="rp-card-title">${escapeHtml(labelPretty)}</h2>
          ${headerTitle}
          ${desc}
        </div>
        <div class="rp-card-stats">
          <div class="rp-stat">
            <span class="rp-stat-num">${r.eventCount}</span>
            <span class="rp-stat-lbl">${escapeHtml(I18N.t('reports_events_label'))}</span>
          </div>
          ${r.is_pdf && r.pageCount > 0 ? `<div class="rp-stat">
            <span class="rp-stat-num">${r.pageCount}</span>
            <span class="rp-stat-lbl">${escapeHtml(I18N.t('reports_pages_label'))}</span>
          </div>` : ''}
        </div>
        <div class="rp-card-actions">
          ${pdfLink}
          ${govLink}
          <button class="rp-toggle-btn" type="button">
            ${isOpen ? '▾ ' + escapeHtml(I18N.t('reports_collapse'))
                     : '▸ ' + escapeHtml(I18N.t('reports_expand'))}
          </button>
        </div>
      </header>
      ${eventsList}
    </article>
  `;
}

function render() {
  const list = document.getElementById('reports-list');
  const visible = STATE.reports.filter(reportPasses);
  document.getElementById('rp-visible-count').textContent = visible.length;

  // Sort
  const s = STATE.filters.sort;
  if (s === 'name') {
    visible.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
  } else if (s === 'pages') {
    visible.sort((a, b) => (b.pageCount || 0) - (a.pageCount || 0));
  } else {
    // default: events
    visible.sort((a, b) => b.eventCount - a.eventCount);
  }

  if (!visible.length) {
    list.innerHTML = `<div class="rp-empty">${escapeHtml(I18N.t('reports_no_results'))}</div>`;
    return;
  }
  list.innerHTML = visible.map(renderReportCard).join('');
}

// ===== Detail-panel helpers (reused from timeline.js logic) ============

function buildDetailHtml(e) {
  const url = e.archive_url || '';
  const t = (k) => I18N.t(k);
  const lang = (typeof I18N !== 'undefined' && I18N.current) || 'zh';

  let imageBlock = '';
  const useFullPdfLink = e.archive_url && e.page
    ? e.archive_url + (e.archive_url.includes('#') ? '' : `#page=${parseInt(e.page, 10)}`)
    : e.archive_url;
  if (e.page_thumb_url) {
    const pageLabel = I18N.t('detail_rendered_page').replace('{page}', parseInt(e.page, 10));
    imageBlock = `
      <div class="media-block">
        <div class="media-block-title">📄 ${escapeHtml(pageLabel)}</div>
        <a href="${escapeAttr(useFullPdfLink || e.page_thumb_url)}" target="_blank" rel="noopener">
          <img src="${escapeAttr(e.page_thumb_url)}" alt="page thumbnail"
               style="width:100%; max-height:520px; object-fit:contain;
                      background:#000; border-radius:4px; cursor:zoom-in;"
               onerror="this.parentElement.parentElement.style.display='none'">
        </a>
      </div>
    `;
  } else if (e.image_url && !e.page) {
    imageBlock = `
      <div class="media-block">
        <a href="${escapeAttr(e.image_url)}" target="_blank" rel="noopener">
          <img src="${escapeAttr(e.image_url)}" alt="thumbnail"
               style="width:100%; max-height:240px; object-fit:contain;
                      background:#000; border-radius:4px; cursor:zoom-in;"
               onerror="this.parentElement.parentElement.style.display='none'">
        </a>
      </div>
    `;
  }

  let videoBlock = '';
  if (e.video_url) {
    const captionsTrack = e.video_captions_vtt
      ? `<track kind="subtitles" src="${escapeAttr(e.video_captions_vtt)}" srclang="en" label="English" default>`
      : '';
    const playLabel = I18N.t('detail_play_video');
    const dvidsLabel = I18N.t('detail_dvids_page');
    const captionVid = e.video_title || e.title || '';
    videoBlock = `
      <div class="media-block">
        <div class="media-block-title">🎬 ${escapeHtml(captionVid)}</div>
        <video controls preload="metadata" playsinline crossorigin="anonymous"
               style="width:100%; max-height:260px; background:#000; border-radius:4px;">
          <source src="${escapeAttr(e.video_url)}" type="video/mp4">
          ${captionsTrack}
        </video>
        <div style="margin-top:6px;">
          <a href="${escapeAttr(e.video_url)}" target="_blank" rel="noopener"
             class="archive-link small">${escapeHtml(playLabel)}</a>
          ${e.dvids_page ? `<a href="${escapeAttr(e.dvids_page)}" target="_blank"
             rel="noopener" class="archive-link small"
             style="margin-left:6px;">${escapeHtml(dvidsLabel)}</a>` : ''}
        </div>
      </div>
    `;
  }

  const coordLabel = e.non_geographic
    ? I18N.t('detail_non_geo')
    : (e.lat != null ? `(${e.lat.toFixed(4)}, ${e.lon.toFixed(4)})` : '');
  const typeLabel = e.record_type || e.type || '';

  const mapBtn = (e.lat != null && !e.non_geographic) ? `
    <a class="archive-link small" href="index.html#event=${encodeURIComponent(e.id)}"
       style="margin-right:6px;">${escapeHtml(I18N.t('detail_view_on_map'))}</a>
  ` : '';

  return `
    <h3>${escapeHtml(e.title || t('detail_no_title'))}</h3>
    <div class="date-badge">${e.date_iso}</div>
    <div class="meta-row"><strong>${t('detail_location')}</strong>：${escapeHtml(e.location)} ${coordLabel}</div>
    <div class="meta-row"><strong>${t('detail_agency')}</strong>：${escapeHtml(e.agency || '')}</div>
    <div class="meta-row"><strong>${t('detail_type')}</strong>：${escapeHtml(typeLabel)}</div>
    <div class="meta-row"><strong>${t('detail_date_raw')}</strong>：${escapeHtml(e.date_raw || '')}</div>
    <div class="meta-row"><strong>${t('detail_source')}</strong>：${escapeHtml(e.source || '')}</div>
    <div class="meta-row"><strong>${t('detail_batch')}</strong>：${escapeHtml(e.batch_name)} (${e.release_date})</div>
    ${e.page ? `<div class="meta-row"><strong>${t('detail_page')}</strong>：${escapeHtml(String(e.page))}</div>` : ''}

    ${renderSummaryBlock(e, lang)}

    ${imageBlock}
    ${e.watermark_crop_url ? `
      <div class="media-block">
        <div class="media-block-title">⏱ ${escapeHtml(I18N.t('detail_watermark_short'))}</div>
        <img src="${escapeAttr(e.watermark_crop_url)}" alt="watermark"
             style="width:100%; max-height:140px; object-fit:contain; background:#000; border-radius:4px;">
      </div>` : ''}
    ${videoBlock}

    <div class="detail-links" style="margin-top:8px;">
      ${mapBtn}
      ${url ? `<a class="archive-link" href="${escapeAttr(useFullPdfLink || url)}" target="_blank" rel="noopener">
         ${escapeHtml(e.file && /\.pdf$/i.test(e.file) ? t('detail_open_pdf') : t('detail_view_archive'))}${e.page ? ` <span style="opacity:0.7;">· p.${parseInt(e.page,10)}</span>` : ''}
       </a>` : ''}
      ${e.gov_page_url && e.gov_page_url !== e.archive_url ? `<a class="archive-link" href="${escapeAttr(e.gov_page_url)}" target="_blank" rel="noopener"
         style="background:#3a5d9e;">
         🏛 ${escapeHtml(dsLabel(e.data_source, 'short_label'))}
       </a>` : ''}
    </div>

    ${Array.isArray(e.additional_resources) && e.additional_resources.length ? `
    <div class="detail-resources">
      <div class="detail-resources-title">${escapeHtml(t('detail_additional_resources'))}</div>
      <ul class="detail-resource-list">
        ${e.additional_resources.map(r => `
          <li><a href="${escapeAttr(r.url)}" target="_blank" rel="noopener">
            ${escapeHtml(r.label || r.url)}
          </a> ${r.type ? `<span class="resource-type">[${escapeHtml(r.type)}]</span>` : ''}</li>
        `).join('')}
      </ul>
    </div>` : ''}

    <div style="margin-top:14px; font-size:11px; color:#6a7c9c;">
      ${t('detail_event_id')}: <code>${escapeHtml(e.id)}</code>
      ${e.data_source ? ` · <span class="ds-tag">${escapeHtml(dsLabel(e.data_source, 'short_label'))}</span>` : ''}
    </div>
  `;
}

function showDetail(e) {
  STATE.lastDetailEvent = e;
  document.getElementById('detail-content').innerHTML = buildDetailHtml(e);
  document.getElementById('detail-panel').classList.remove('hidden');
}

// ===== Card expand/collapse + event-row clicks =========================

function toggleReport(key) {
  if (STATE.expanded.has(key)) STATE.expanded.delete(key);
  else STATE.expanded.add(key);
  render();
}

document.addEventListener('click', evt => {
  // Event row → detail
  const row = evt.target.closest('.rp-event-row');
  if (row) {
    evt.stopPropagation();
    const id = row.dataset.id;
    const ev = STATE.events.find(x => x.id === id);
    if (ev) showDetail(ev);
    return;
  }
  // Don't toggle when clicking links/buttons inside header
  if (evt.target.closest('.rp-link')) return;
  const header = evt.target.closest('.rp-card-header');
  if (header) {
    const key = header.parentElement.dataset.key;
    if (key) toggleReport(key);
  }
});

document.addEventListener('keydown', evt => {
  if (evt.key !== 'Enter' && evt.key !== ' ') return;
  const row = evt.target.closest('.rp-event-row');
  if (row) {
    evt.preventDefault();
    const id = row.dataset.id;
    const ev = STATE.events.find(x => x.id === id);
    if (ev) showDetail(ev);
    return;
  }
  const header = evt.target.closest('.rp-card-header');
  if (header) {
    evt.preventDefault();
    const key = header.parentElement.dataset.key;
    if (key) toggleReport(key);
  }
});

// Expose for i18n re-render
window.STATE = STATE;
window.showDetail = showDetail;

const _origApply = (typeof I18N !== 'undefined') && I18N.apply.bind(I18N);
if (_origApply) {
  I18N.apply = function () {
    _origApply();
    if (STATE.reports.length) render();
    if (STATE.lastDetailEvent) {
      const panel = document.getElementById('detail-panel');
      if (!panel.classList.contains('hidden')) showDetail(STATE.lastDetailEvent);
    }
  };
}

// Boot
(async function main() {
  try {
    await loadData();
    buildFilters();
    render();
  } catch (err) {
    console.error('Failed:', err);
    document.getElementById('reports-list').innerHTML =
      `<div class="rp-empty">${escapeHtml((window.I18N && I18N.t('tl_load_fail')) || 'Load failed.')}</div>`;
  }
})();
