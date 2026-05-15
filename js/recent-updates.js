// Recent Updates page — events with non-empty last_updated, within rolling window, newest first.

const STATE = {
  events: [],            // only events with non-empty last_updated
  geocode: {},
  manifest: null,
  dataSources: {},
  filters: { windowDays: 180, q: '', source: '', updater: '' },
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
      // Skip events without a last_updated stamp — page only shows updated entries.
      if (!e.last_updated) continue;
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
  // Sort by last_updated desc (newest update first)
  all.sort((a, b) => (b.last_updated || '').localeCompare(a.last_updated || ''));
  STATE.events = all;
  STATE.dataSources = dataSources;
  document.getElementById('event-count').textContent = all.length;
  document.getElementById('ru-total-count').textContent = all.length;
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

function todayIso() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function daysBetween(isoA, isoB) {
  // both YYYY-MM-DD; isoA assumed >= isoB. Returns integer day count (>= 0).
  const a = new Date(isoA + 'T00:00:00Z').getTime();
  const b = new Date(isoB + 'T00:00:00Z').getTime();
  return Math.floor((a - b) / 86400000);
}

function eventPasses(e) {
  const f = STATE.filters;
  if (f.windowDays > 0) {
    const d = daysBetween(todayIso(), e.last_updated);
    if (d > f.windowDays) return false;
    if (d < 0) return false;        // future-dated stamps treated as out of window
  }
  if (f.source && (e.data_source || 'Other') !== f.source) return false;
  if (f.updater && (e.updated_by || '') !== f.updater) return false;
  if (f.q) {
    const hay = (e.location + ' ' + e.title + ' ' + (e.agency || '') + ' '
                 + (e.source || '') + ' ' + (e.updated_by || '')).toLowerCase();
    if (!hay.includes(f.q)) return false;
  }
  return true;
}

function buildFilters() {
  const sources = new Map();
  const updaters = new Map();
  for (const e of STATE.events) {
    const ds = e.data_source || 'Other';
    sources.set(ds, (sources.get(ds) || 0) + 1);
    const u = e.updated_by || 'UAP-MAP-OFFICIAL';
    updaters.set(u, (updaters.get(u) || 0) + 1);
  }
  const sourceSel = document.getElementById('ru-source-filter');
  if (sourceSel) {
    sourceSel.innerHTML = '<option value="">All</option>' + [...sources.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([s, n]) => `<option value="${escapeAttr(s)}">${escapeHtml(dsLabel(s, 'filter_label'))} (${n})</option>`).join('');
    sourceSel.addEventListener('change', refilter);
  }
  const updSel = document.getElementById('ru-updater-filter');
  if (updSel) {
    updSel.innerHTML = '<option value="">All</option>' + [...updaters.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([u, n]) => `<option value="${escapeAttr(u)}">${escapeHtml(u)} (${n})</option>`).join('');
    updSel.addEventListener('change', refilter);
  }
  document.getElementById('ru-search').addEventListener('input', refilter);
  document.getElementById('ru-window').addEventListener('change', refilter);

  document.getElementById('detail-close').addEventListener('click', () => {
    document.getElementById('detail-panel').classList.add('hidden');
  });
}

function readFilters() {
  const srcSel = document.getElementById('ru-source-filter');
  const updSel = document.getElementById('ru-updater-filter');
  STATE.filters = {
    windowDays: parseInt(document.getElementById('ru-window').value, 10) || 0,
    q: document.getElementById('ru-search').value.trim().toLowerCase(),
    source: srcSel ? srcSel.value : '',
    updater: updSel ? updSel.value : '',
  };
}

function refilter() {
  readFilters();
  render();
}

function renderEventRow(e) {
  const kind = agencyKind(e.agency);
  const hasImg = e.image_url ? '🖼' : '';
  const hasVid = e.video_url ? '🎬' : '';
  const ngBadge = e.non_geographic
    ? `<span class="tl-tag tl-tag-other">${escapeHtml(I18N.t('tl_tag_no_geo'))}</span>` : '';
  return `
    <li class="tl-event-row ru-event-row" data-id="${escapeAttr(e.id)}" tabindex="0" role="button">
      <div class="tl-row-marker tl-marker-${kind}"></div>
      <div class="tl-row-date">
        <div class="ru-updated">${escapeHtml(e.last_updated)}</div>
        <div class="ru-event-date">${escapeHtml(I18N.t('ru_event_date_short'))} ${escapeHtml(e.date_iso)}</div>
      </div>
      <div class="tl-row-body">
        <div class="tl-row-loc">${escapeHtml(e.location || I18N.t('ru_no_location'))}</div>
        <div class="tl-row-meta">
          <span class="tl-agency">${escapeHtml(e.agency || '')}</span>
          <span class="tl-type">${escapeHtml(e.type || '')}</span>
          <span class="ru-updater-tag">👤 ${escapeHtml(e.updated_by || 'UAP-MAP-OFFICIAL')}</span>
          ${ngBadge}
          <span class="tl-icons">${hasImg}${hasVid}</span>
        </div>
        <div class="tl-row-title">${escapeHtml((e.title || '').slice(0, 130))}${e.title && e.title.length > 130 ? '…' : ''}</div>
      </div>
    </li>
  `;
}

function render() {
  const list = document.getElementById('ru-list');
  const visible = STATE.events.filter(eventPasses);
  document.getElementById('ru-visible-count').textContent = visible.length;

  // Update window-summary text in topbar
  const win = STATE.filters.windowDays;
  const sumEl = document.getElementById('ru-window-summary');
  if (sumEl) {
    sumEl.textContent = win > 0
      ? I18N.t('ru_window_summary').replace('{n}', win)
      : I18N.t('ru_window_summary_all');
  }

  if (!visible.length) {
    list.innerHTML = `<div class="tl-empty">${escapeHtml(I18N.t('ru_no_results'))}</div>`;
    return;
  }

  // Group by last_updated date so same-day updates stack under one header
  const byDate = new Map();
  for (const e of visible) {
    const d = e.last_updated;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push(e);
  }
  const dates = [...byDate.keys()].sort().reverse();

  let html = '';
  for (const d of dates) {
    html += `<section class="tl-year-section">
      <h2 class="tl-year-header">${escapeHtml(d)} <span class="tl-year-count">(${byDate.get(d).length})</span></h2>
      <ul class="tl-event-list">`;
    for (const e of byDate.get(d)) {
      html += renderEventRow(e);
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
    <div class="meta-row"><strong>${t('ru_last_updated')}</strong>：${escapeHtml(e.last_updated)} · 👤 ${escapeHtml(e.updated_by || 'UAP-MAP-OFFICIAL')}</div>
    <div class="meta-row"><strong>${t('detail_location')}</strong>：${escapeHtml(e.location)} ${coordLabel}${e.location_approximate ? ` <span style="color:#e0a83c;font-size:11px;margin-left:6px;">· ${escapeHtml(t('detail_loc_approx'))}</span>` : ''}</div>
    <div class="meta-row"><strong>${t('detail_agency')}</strong>：${escapeHtml(e.agency || '')}</div>
    <div class="meta-row"><strong>${t('detail_type')}</strong>：${escapeHtml(typeLabel)}</div>
    <div class="meta-row"><strong>${t('detail_date_raw')}</strong>：${escapeHtml(e.date_raw || '')}</div>
    <div class="meta-row"><strong>${t('detail_source')}</strong>：${escapeHtml(e.source || '')}</div>
    <div class="meta-row"><strong>${t('detail_batch')}</strong>：${escapeHtml(e.batch_name)} (${e.release_date})</div>
    ${e.page ? (() => { const ps = parseInt(e.page, 10); const pe = e.page_end ? parseInt(e.page_end, 10) : ps; return `<div class="meta-row"><strong>${t('detail_page')}</strong>：${pe > ps ? `${ps} – ${pe}` : ps}</div>`; })() : ''}

    ${renderSummaryBlock(e, lang)}

    ${imageBlock}

    <div class="detail-links" style="margin-top:8px;">
      ${mapBtn}
      ${url ? `<a class="archive-link" href="${escapeAttr(useFullPdfLink || url)}" target="_blank" rel="noopener">
         ${escapeHtml(e.file && /\.pdf$/i.test(e.file) ? t('detail_open_pdf') : t('detail_view_archive'))}${e.page ? ` <span style="opacity:0.7;">· p.${parseInt(e.page,10)}</span>` : ''}
       </a>` : ''}
    </div>

    <div style="margin-top:14px; font-size:11px; color:#6a7c9c;">
      ${t('detail_event_id')}: <code>${escapeHtml(e.id)}</code>
      ${e.data_source ? ` · <span class="ds-tag">${escapeHtml(dsLabel(e.data_source, 'short_label'))}</span>` : ''}
    </div>
  `;
}

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
  const renderPanel = () => {
    document.getElementById('detail-content').innerHTML = buildDetailHtml(e);
    document.getElementById('detail-panel').classList.remove('hidden');
  };
  renderPanel();
  if (!e.report_summary && !e.report_summary_zh) {
    ensureSummaries().then(map => {
      const entry = map[e.id];
      if (entry) {
        Object.assign(e, entry);
        if (STATE.lastDetailEvent === e) renderPanel();
      }
    });
  }
}
window.ensureSummaries = ensureSummaries;

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

window.STATE = STATE;
window.showDetail = showDetail;
window.recentUpdatesRender = render;
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

(async function main() {
  try {
    await loadData();
    buildFilters();
    render();
    setTimeout(() => ensureSummaries(), 2000);
  } catch (err) {
    console.error('Failed:', err);
    document.getElementById('ru-list').innerHTML =
      `<div class="tl-empty">${escapeHtml((window.I18N && I18N.t('tl_load_fail')) || 'Load failed.')}</div>`;
  }
})();
