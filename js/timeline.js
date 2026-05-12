// Timeline page — chronological list of all events with filters + detail panel.

const STATE = {
  events: [],
  geocode: {},
  manifest: null,
  filters: { yearMin: null, yearMax: null, agency: '', type: '', q: '' },
  lastDetailEvent: null,
};

async function loadData() {
  const manifest = await (await fetch('data/manifest.json')).json();
  STATE.manifest = manifest;
  STATE.geocode = await (await fetch('data/geocode.json')).json();
  const all = [];
  for (const batchFile of manifest.batches) {
    const batch = await (await fetch(`data/events/${batchFile}`)).json();
    for (const e of batch.events) {
      const geo = STATE.geocode[e.location];
      const ev = Object.assign({}, e, {
        lat: geo ? geo.lat : null,
        lon: geo ? geo.lon : null,
        batch_id: batch.batch_id,
        batch_name: batch.batch_name,
        release_date: batch.release_date,
      });
      ev.id = `${batch.batch_id}_${ev.date_iso}_${ev.location}_${(ev.file || '').slice(0, 30)}`;
      all.push(ev);
    }
  }
  // Sort by date desc (newest first)
  all.sort((a, b) => b.date_iso.localeCompare(a.date_iso));
  STATE.events = all;
  document.getElementById('event-count').textContent = all.length;
  document.getElementById('tl-total-count').textContent = all.length;
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
  if (f.agency && e.agency !== f.agency) return false;
  if (f.type && e.type !== f.type) return false;
  if (f.q) {
    const hay = (e.location + ' ' + e.title + ' ' + (e.agency || '') + ' ' + (e.source || '')).toLowerCase();
    if (!hay.includes(f.q)) return false;
  }
  return true;
}

function buildFilters() {
  const agencies = new Map();
  const types = new Map();
  for (const e of STATE.events) {
    agencies.set(e.agency, (agencies.get(e.agency) || 0) + 1);
    types.set(e.type, (types.get(e.type) || 0) + 1);
  }
  const agencySel = document.getElementById('tl-agency-filter');
  const typeSel = document.getElementById('tl-type-filter');
  agencySel.innerHTML = '<option value="">All</option>' + [...agencies.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([a, n]) => `<option value="${escapeAttr(a)}">${escapeHtml(a)} (${n})</option>`).join('');
  typeSel.innerHTML = '<option value="">All</option>' + [...types.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `<option value="${escapeAttr(t)}">${escapeHtml(t)} (${n})</option>`).join('');

  document.getElementById('tl-year-min').addEventListener('input', refilter);
  document.getElementById('tl-year-max').addEventListener('input', refilter);
  document.getElementById('tl-search').addEventListener('input', refilter);
  agencySel.addEventListener('change', refilter);
  typeSel.addEventListener('change', refilter);

  document.getElementById('detail-close').addEventListener('click', () => {
    document.getElementById('detail-panel').classList.add('hidden');
  });
}

function readFilters() {
  STATE.filters = {
    yearMin: parseInt(document.getElementById('tl-year-min').value, 10) || null,
    yearMax: parseInt(document.getElementById('tl-year-max').value, 10) || null,
    agency: document.getElementById('tl-agency-filter').value,
    type: document.getElementById('tl-type-filter').value,
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
    ? `<span class="tl-tag tl-tag-other">${lang === 'en' ? 'no geo' : '无地点'}</span>` : '';
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
  const lang = (window.I18N && I18N.current) || 'zh';

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
  const lang = (window.I18N && I18N.current) || 'zh';

  let imageBlock = '';
  if (e.image_url) {
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
    const playLabel = lang === 'en' ? '▶ Play video' : '▶ 播放视频';
    const dvidsLabel = lang === 'en' ? 'DVIDS page ↗' : 'DVIDS 页面 ↗';
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
    ? (lang === 'en' ? '(non-geographic)' : '(无具体坐标)')
    : (e.lat != null ? `(${e.lat.toFixed(4)}, ${e.lon.toFixed(4)})` : '');

  const typeLabel = e.record_type || e.type || '';

  // "View on map" button if event has coordinates
  const mapBtn = (e.lat != null && !e.non_geographic) ? `
    <a class="archive-link small" href="index.html#event=${encodeURIComponent(e.id)}"
       style="margin-right:6px;">${escapeHtml(lang === 'en' ? '🗺 View on map' : '🗺 在地图上查看')}</a>
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

    ${e.report_summary ? `<div class="full-text">${escapeHtml(e.report_summary)}</div>` : ''}

    ${imageBlock}
    ${videoBlock}

    <div class="detail-links" style="margin-top:8px;">
      ${mapBtn}
      ${url ? `<a class="archive-link" href="${escapeAttr(url)}" target="_blank" rel="noopener">
         ${escapeHtml(t('detail_open_pdf'))}
       </a>` : ''}
      ${e.gov_page_url ? `<a class="archive-link" href="${escapeAttr(e.gov_page_url)}" target="_blank" rel="noopener"
         style="background:#3a5d9e;">
         ${escapeHtml(lang === 'en' ? '🏛 war.gov source' : '🏛 war.gov 官方页面')}
       </a>` : ''}
    </div>

    <div style="margin-top:14px; font-size:11px; color:#6a7c9c;">
      ${t('detail_event_id')}: <code>${escapeHtml(e.id)}</code>
    </div>
  `;
}

function showDetail(e) {
  STATE.lastDetailEvent = e;
  document.getElementById('detail-content').innerHTML = buildDetailHtml(e);
  document.getElementById('detail-panel').classList.remove('hidden');
}

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
const _origApply = window.I18N && I18N.apply.bind(I18N);
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
  } catch (err) {
    console.error('Failed:', err);
    document.getElementById('timeline-list').innerHTML =
      '<div class="tl-empty">加载失败 / Load failed. 请通过 HTTP 服务器访问。</div>';
  }
})();
