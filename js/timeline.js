// Timeline page — chronological list of all events with filters + detail panel.

const STATE = {
  events: [],
  geocode: {},
  manifest: null,
  filters: { yearMin: null, yearMax: null, agency: '', type: '', q: '' },
  lastDetailEvent: null,
};

async function fetchData(path) {
  const res = await fetch(path);
  return res.json();
}

async function loadData() {
  const [manifest, geocode] = await Promise.all([
    fetchData('data/manifest.json'),
    fetchData('data/geocode.json'),
  ]);
  STATE.manifest = manifest;
  STATE.geocode = geocode;
  // Batches in parallel — biggest single perf win on slow networks.
  const batches = await Promise.all(
    manifest.batches.map(fn => fetchData(`data/events/${fn}`))
  );
  const all = [];
  const dataSources = {};
  for (const batch of batches) {
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
  // Sort by date desc (newest first)
  all.sort((a, b) => b.date_iso.localeCompare(a.date_iso));
  STATE.events = all;
  STATE.dataSources = dataSources;
  document.getElementById('event-count').textContent = all.length;
  document.getElementById('tl-total-count').textContent = all.length;
}

function dsLabel(id, kind) {
  const lang = (typeof I18N !== 'undefined' && I18N.current) || 'zh';
  const info = (STATE.dataSources && STATE.dataSources[id]) || { id };
  const zhKey = kind + '_zh';
  return (lang === 'zh' && info[zhKey]) || info[kind] || info.label || id;
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

function eventPasses(e) {
  const f = STATE.filters;
  const yr = parseInt(e.date_iso.slice(0, 4), 10);
  if (f.yearMin && yr < f.yearMin) return false;
  if (f.yearMax && yr > f.yearMax) return false;
  if (f.source && (e.data_source || 'Other') !== f.source) return false;
  if (f.agency && e.agency !== f.agency) return false;
  if (f.q) {
    const hay = (e.location + ' ' + e.title + ' ' + (e.agency || '') + ' ' + (e.source || '')).toLowerCase();
    if (!hay.includes(f.q)) return false;
  }
  return true;
}

function buildFilters() {
  const agencies = new Map();
  const types = new Map();
  const sources = new Map();
  for (const e of STATE.events) {
    agencies.set(e.agency, (agencies.get(e.agency) || 0) + 1);
    types.set(e.type, (types.get(e.type) || 0) + 1);
    const ds = e.data_source || 'Other';
    sources.set(ds, (sources.get(ds) || 0) + 1);
  }
  const agencySel = document.getElementById('tl-agency-filter');
  const sourceSel = document.getElementById('tl-source-filter');
  agencySel.innerHTML = '<option value="">All</option>' + [...agencies.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([a, n]) => `<option value="${escapeAttr(a)}">${escapeHtml(a)} (${n})</option>`).join('');
  if (sourceSel) {
    sourceSel.innerHTML = '<option value="">All</option>' + [...sources.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([s, n]) => `<option value="${escapeAttr(s)}">${escapeHtml(dsLabel(s, 'filter_label'))} (${n})</option>`).join('');
    sourceSel.addEventListener('change', refilter);
  }

  document.getElementById('tl-year-min').addEventListener('input', refilter);
  document.getElementById('tl-year-max').addEventListener('input', refilter);
  document.getElementById('tl-search').addEventListener('input', refilter);
  agencySel.addEventListener('change', refilter);

  document.getElementById('detail-close').addEventListener('click', () => {
    document.getElementById('detail-panel').classList.add('hidden');
  });
}

function readFilters() {
  const srcSel = document.getElementById('tl-source-filter');
  STATE.filters = {
    yearMin: parseInt(document.getElementById('tl-year-min').value, 10) || null,
    yearMax: parseInt(document.getElementById('tl-year-max').value, 10) || null,
    agency: document.getElementById('tl-agency-filter').value,
    source: srcSel ? srcSel.value : '',
    q: document.getElementById('tl-search').value.trim().toLowerCase(),
  };
}

function refilter() {
  readFilters();
  render();
}

function renderEventRow(e, lang) {
  const kind = agencyKind(e.agency);
  const hasImg = e.image_url ? '🖼' : '';
  const hasVid = e.video_url ? '🎬' : '';
  const ngBadge = e.non_geographic
    ? `<span class="tl-tag tl-tag-other">${escapeHtml(I18N.t('tl_tag_no_geo'))}</span>` : '';
  return `
    <li class="tl-event-row" data-id="${escapeAttr(e.id)}" tabindex="0" role="button">
      <div class="tl-row-marker tl-marker-${kind}"></div>
      <div class="tl-row-date">${escapeHtml(e.date_iso)}</div>
      <div class="tl-row-body">
        <div class="tl-row-loc">${escapeHtml(e.location)}</div>
        <div class="tl-row-meta">
          <span class="tl-agency">${escapeHtml(e.agency || '')}</span>
          <span class="tl-type">${escapeHtml(e.type || '')}</span>
          ${ngBadge}
          <span class="tl-icons">${hasImg}${hasVid}</span>
        </div>
        <div class="tl-row-title">${escapeHtml((e.title || '').slice(0, 130))}${e.title && e.title.length > 130 ? '…' : ''}</div>
      </div>
    </li>
  `;
}

function render() {
  const list = document.getElementById('timeline-list');
  const decadeJump = document.getElementById('timeline-decade-jump');
  const visible = STATE.events.filter(eventPasses);
  document.getElementById('tl-visible-count').textContent = visible.length;
  const lang = (typeof I18N !== 'undefined' && I18N.current) || 'zh';

  // Group by decade for jump bar
  const decades = new Map();
  for (const e of visible) {
    const y = parseInt(e.date_iso.slice(0, 4), 10);
    const d = Math.floor(y / 10) * 10;
    decades.set(d, (decades.get(d) || 0) + 1);
  }
  decadeJump.innerHTML = [...decades.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([d, n]) =>
      `<a href="#decade-${d}" class="tl-decade-chip">${d}s <span>(${n})</span></a>`
    ).join('');

  // Group all events by year (non_geographic included inline)
  const byYear = new Map();
  for (const e of visible) {
    const y = e.date_iso.slice(0, 4);
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(e);
  }
  const years = [...byYear.keys()].sort().reverse();

  if (!years.length) {
    list.innerHTML = '<div class="tl-empty" data-i18n="tl_no_results">无符合条件的事件</div>';
    if (window.I18N) I18N.apply();
    return;
  }

  let html = '';
  let lastDecade = -1;
  for (const y of years) {
    const yearInt = parseInt(y, 10);
    const decade = Math.floor(yearInt / 10) * 10;
    if (decade !== lastDecade) {
      lastDecade = decade;
      html += `<div class="tl-decade-anchor" id="decade-${decade}"></div>`;
    }
    html += `<section class="tl-year-section">
      <h2 class="tl-year-header">${escapeHtml(y)} <span class="tl-year-count">(${byYear.get(y).length})</span></h2>
      <ul class="tl-event-list">`;
    for (const e of byYear.get(y)) {
      html += renderEventRow(e, lang);
    }
    html += '</ul></section>';
  }
  list.innerHTML = html;
}

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

  // "View on map" button if event has coordinates
  const mapBtn = (e.lat != null && !e.non_geographic) ? `
    <a class="archive-link small" href="index.html#event=${encodeURIComponent(e.id)}"
       style="margin-right:6px;">${escapeHtml(I18N.t('detail_view_on_map'))}</a>
  ` : '';

  return `
    <h3>${escapeHtml(e.title || t('detail_no_title'))}</h3>
    <div class="date-badge">${e.date_iso}</div>
    <div class="meta-row"><strong>${t('detail_location')}</strong>：${escapeHtml(e.location)} ${coordLabel}${e.location_approximate ? ` <span style="color:#e0a83c;font-size:11px;margin-left:6px;">· ${escapeHtml(t('detail_loc_approx'))}</span>` : ''}</div>
    <div class="meta-row"><strong>${t('detail_agency')}</strong>：${escapeHtml(e.agency || '')}</div>
    <div class="meta-row"><strong>${t('detail_type')}</strong>：${escapeHtml(typeLabel)}</div>
    <div class="meta-row"><strong>${t('detail_date_raw')}</strong>：${escapeHtml(e.date_raw || '')}</div>
    <div class="meta-row"><strong>${t('detail_source')}</strong>：${escapeHtml(e.source || '')}</div>
    <div class="meta-row"><strong>${t('detail_batch')}</strong>：${escapeHtml(e.batch_name)} (${e.release_date})</div>
    ${e.page ? (() => { const ps = parseInt(e.page, 10); const pe = e.page_end ? parseInt(e.page_end, 10) : ps; return `<div class="meta-row"><strong>${t('detail_page')}</strong>：${pe > ps ? `${ps} – ${pe}` : ps}</div>`; })() : ''}

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

// Lazy summary fetch — see app.js for rationale.
let SUMMARIES_PROMISE = null;
function ensureSummaries() {
  if (!SUMMARIES_PROMISE) {
    SUMMARIES_PROMISE = fetch('data/summaries.json').then(r => r.json()).then(map => {
      for (const ev of STATE.events) {
        const entry = map[ev.id];
        if (entry) Object.assign(ev, entry);
      }
      return map;
    }).catch(err => { console.warn('summaries load failed:', err); return {}; });
  }
  return SUMMARIES_PROMISE;
}

function showDetail(e) {
  STATE.lastDetailEvent = e;
  const render = () => {
    document.getElementById('detail-content').innerHTML = buildDetailHtml(e);
    document.getElementById('detail-panel').classList.remove('hidden');
  };
  render();
  if (!e.report_summary && !e.report_summary_zh) {
    ensureSummaries().then(map => {
      const entry = map[e.id];
      if (entry) {
        Object.assign(e, entry);
        if (STATE.lastDetailEvent === e) render();
      }
    });
  }
}
window.ensureSummaries = ensureSummaries;

// Click delegation for event rows
document.addEventListener('click', evt => {
  const row = evt.target.closest('.tl-event-row');
  if (row) {
    const id = row.dataset.id;
    const ev = STATE.events.find(x => x.id === id);
    if (ev) showDetail(ev);
  }
});
document.addEventListener('keydown', evt => {
  if (evt.key !== 'Enter' && evt.key !== ' ') return;
  const row = evt.target.closest('.tl-event-row');
  if (row) {
    evt.preventDefault();
    const id = row.dataset.id;
    const ev = STATE.events.find(x => x.id === id);
    if (ev) showDetail(ev);
  }
});

// Expose for i18n re-render
window.STATE = STATE;
window.showDetail = showDetail;
window.timelineRender = render;
// When language changes, re-render list (because labels are inline)
const _origApply = (typeof I18N !== 'undefined') && I18N.apply.bind(I18N);
if (_origApply) {
  I18N.apply = function () {
    _origApply();
    if (STATE.events.length) render();
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
    setTimeout(() => ensureSummaries(), 2000);
  } catch (err) {
    console.error('Failed:', err);
    document.getElementById('timeline-list').innerHTML =
      `<div class="tl-empty">${escapeHtml((window.I18N && I18N.t('tl_load_fail')) || 'Load failed.')}</div>`;
  }
})();
