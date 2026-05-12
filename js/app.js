// UFO/UAP Interactive Map — main app
// Loads manifest → batches → renders heatmap + event markers on Leaflet map.

const STATE = {
  events: [],          // all events (with lat/lon attached)
  geocode: {},         // location → {lat, lon}
  citiesHeat: [],      // [[lat, lon, weight], ...]
  manifest: null,
  filters: {
    dateMin: null,
    dateMax: null,
    agencies: new Set(),  // empty = all
    types: new Set(),
  },
  map: null,
  heatLayer: null,
  markerLayer: null,
  markersById: {},
};

async function loadData() {
  // 1. Manifest
  const manifest = await (await fetch('data/manifest.json')).json();
  STATE.manifest = manifest;

  // 2. Geocode
  STATE.geocode = await (await fetch('data/geocode.json')).json();

  // 3. Cities heatmap
  STATE.citiesHeat = await (await fetch('data/cities_heatmap.json')).json();

  // 4. All event batches
  const allEvents = [];
  for (const batchFile of manifest.batches) {
    const batch = await (await fetch(`data/events/${batchFile}`)).json();
    for (const e of batch.events) {
      const geo = STATE.geocode[e.location];
      if (!geo) continue;  // skip un-geocoded
      const ev = Object.assign({}, e, {
        lat: geo.lat,
        lon: geo.lon,
        batch_id: batch.batch_id,
        batch_name: batch.batch_name,
        release_date: batch.release_date,
      });
      // Unique ID
      ev.id = `${batch.batch_id}_${ev.date_iso}_${ev.location}_${(ev.file || '').slice(0, 30)}`;
      allEvents.push(ev);
    }
  }
  STATE.events = allEvents;
  document.getElementById('event-count').textContent = allEvents.length;
  document.getElementById('batch-count').textContent = manifest.batches.length;

  // Build filter options
  buildFilters();
}

function buildFilters() {
  const agencies = new Map();
  const types = new Map();
  for (const e of STATE.events) {
    agencies.set(e.agency, (agencies.get(e.agency) || 0) + 1);
    types.set(e.type, (types.get(e.type) || 0) + 1);
  }
  // Date range
  let minYear = 9999, maxYear = 0;
  for (const e of STATE.events) {
    const y = parseInt(e.date_iso.slice(0, 4), 10);
    if (y < minYear) minYear = y;
    if (y > maxYear) maxYear = y;
  }
  document.getElementById('date-min').placeholder = String(minYear);
  document.getElementById('date-max').placeholder = String(maxYear);

  // Agency checkboxes
  const aWrap = document.getElementById('agency-checkboxes');
  const sortedAgencies = [...agencies.entries()].sort((a, b) => b[1] - a[1]);
  for (const [ag, n] of sortedAgencies) {
    const label = document.createElement('label');
    label.className = 'cb';
    label.innerHTML = `<input type="checkbox" value="${escapeAttr(ag)}" checked> ${escapeHtml(ag)} <span style="color:#6a7c9c">(${n})</span>`;
    label.querySelector('input').addEventListener('change', refilter);
    aWrap.appendChild(label);
  }

  // Type checkboxes
  const tWrap = document.getElementById('type-checkboxes');
  for (const [t, n] of [...types.entries()].sort((a, b) => b[1] - a[1])) {
    const label = document.createElement('label');
    label.className = 'cb';
    label.innerHTML = `<input type="checkbox" value="${escapeAttr(t)}" checked> ${escapeHtml(t)} <span style="color:#6a7c9c">(${n})</span>`;
    label.querySelector('input').addEventListener('change', refilter);
    tWrap.appendChild(label);
  }

  // Date inputs
  document.getElementById('date-min').addEventListener('change', refilter);
  document.getElementById('date-max').addEventListener('change', refilter);
  // Layer toggles
  document.getElementById('show-heatmap').addEventListener('change', toggleHeat);
  document.getElementById('show-markers').addEventListener('change', toggleMarkers);
  document.getElementById('cluster-markers').addEventListener('change', rebuildMarkers);
  // Heatmap opacity slider
  const opacityEl = document.getElementById('heat-opacity');
  if (opacityEl) {
    opacityEl.addEventListener('input', () => {
      const pct = parseInt(opacityEl.value, 10);
      document.getElementById('heat-opacity-val').textContent = pct + '%';
      applyHeatOpacity(pct / 100);
    });
  }
}

function getActiveFilters() {
  const dateMin = document.getElementById('date-min').value || null;
  const dateMax = document.getElementById('date-max').value || null;
  const agenciesChecked = new Set();
  document.querySelectorAll('#agency-checkboxes input:checked').forEach(c => agenciesChecked.add(c.value));
  const typesChecked = new Set();
  document.querySelectorAll('#type-checkboxes input:checked').forEach(c => typesChecked.add(c.value));
  return { dateMin, dateMax, agenciesChecked, typesChecked };
}

function eventPasses(e, filters) {
  const yr = parseInt(e.date_iso.slice(0, 4), 10);
  if (filters.dateMin && yr < parseInt(filters.dateMin, 10)) return false;
  if (filters.dateMax && yr > parseInt(filters.dateMax, 10)) return false;
  if (!filters.agenciesChecked.has(e.agency)) return false;
  if (!filters.typesChecked.has(e.type)) return false;
  return true;
}

function refilter() {
  rebuildMarkers();
  updateStats();
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

function buildPopupHtml(e) {
  const url = e.archive_url || '#';
  const titleEsc = escapeHtml(e.title || I18N.t('detail_no_title'));
  return `
    <div style="min-width:240px">
      <div class="date-badge" style="display:inline-block; background:#82b9ff; color:#0b1320;
           padding:2px 8px; border-radius:3px; font-weight:bold; font-size:11px;">
        ${e.date_iso}
      </div>
      <div style="margin-top:6px; font-weight:600; color:#82b9ff;">${escapeHtml(e.location)}</div>
      <div style="margin-top:4px; font-size:11px; color:#8fa3c4;">
        <strong>${escapeHtml(e.agency || '')}</strong> · ${escapeHtml(e.type || '')}
      </div>
      <div style="margin-top:6px; font-size:11px; color:#c8d6f0; max-height:80px; overflow:hidden;">
        ${titleEsc.length > 140 ? titleEsc.slice(0, 140) + '…' : titleEsc}
      </div>
      <div style="margin-top:8px;">
        <button class="show-detail" data-id="${escapeAttr(e.id)}"
          style="background:#82b9ff; color:#0b1320; border:none; padding:6px 12px;
                 border-radius:3px; cursor:pointer; font-size:11px; font-weight:600;">
          ${escapeHtml(I18N.t('popup_view_detail'))}
        </button>
        ${url !== '#' ? `<a href="${escapeAttr(url)}" target="_blank" rel="noopener"
            style="margin-left:6px; color:#82b9ff; font-size:11px;">${escapeHtml(I18N.t('popup_open_archive'))}</a>` : ''}
      </div>
    </div>
  `;
}

function buildDetailHtml(e) {
  const url = e.archive_url || '';
  const t = (k) => I18N.t(k);
  const lang = (window.I18N && I18N.current) || 'zh';

  // Thumbnail / image preview
  let imageBlock = '';
  if (e.image_url) {
    imageBlock = `
      <div class="media-block">
        <a href="${escapeAttr(e.image_url)}" target="_blank" rel="noopener" title="${escapeHtml(e.image_url)}">
          <img src="${escapeAttr(e.image_url)}" alt="thumbnail"
               style="width:100%; max-height:240px; object-fit:contain;
                      background:#000; border-radius:4px; cursor:zoom-in;"
               onerror="this.parentElement.parentElement.style.display='none'">
        </a>
      </div>
    `;
  }

  // Embedded video player if a paired DVIDS video is attached
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

  // Type label maps to record_type if present
  const typeLabel = e.record_type || e.type || '';

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

    ${e.record_description ? `<div class="full-text">${escapeHtml(e.record_description)}</div>` : `<div class="full-text">${escapeHtml(e.title || '')}</div>`}

    ${imageBlock}
    ${videoBlock}

    ${url ? `<a class="archive-link" href="${escapeAttr(url)}" target="_blank" rel="noopener">
       ${escapeHtml(t('detail_open_pdf'))}
     </a>` : ''}

    <div style="margin-top:14px; font-size:11px; color:#6a7c9c;">
      ${t('detail_event_id')}: <code>${escapeHtml(e.id)}</code>
    </div>
  `;
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

function initMap() {
  const map = L.map('map', {
    center: [25, -30],
    zoom: 3,
    minZoom: 2, maxZoom: 18,
    worldCopyJump: true,
  });
  STATE.map = map;

  // Dark base layer with national borders
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  // Heatmap layer — lightweight overlay (won't drown the base map)
  STATE.heatLayer = L.heatLayer(STATE.citiesHeat, {
    radius: 12, blur: 16, maxZoom: 7,
    max: 1.5,                    // higher max → colors stay lower in scale
    minOpacity: 0.10,            // very subtle low-activity areas
    gradient: {
      0.0: 'rgba(0, 60, 140, 0)',
      0.3: 'rgba(30, 127, 190, 0.35)',
      0.5: 'rgba(58, 168, 196, 0.45)',
      0.7: 'rgba(146, 214, 93, 0.55)',
      0.85: 'rgba(251, 209, 71, 0.65)',
      1.0: 'rgba(255, 94, 58, 0.75)',
    },
  });
  if (document.getElementById('show-heatmap').checked) STATE.heatLayer.addTo(map);

  // Apply initial opacity from slider
  setTimeout(() => {
    const opacityEl = document.getElementById('heat-opacity');
    if (opacityEl) applyHeatOpacity(parseInt(opacityEl.value, 10) / 100);
  }, 100);

  // Marker layer
  rebuildMarkers();

  // Add legend (re-renders on language change)
  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = function() {
    const div = L.DomUtil.create('div', '');
    div.id = 'legend';
    STATE.legendEl = div;
    return div;
  };
  legend.addTo(map);
  STATE.legendCtrl = legend;
  updateLegend();

  // Detail panel close
  document.getElementById('detail-close').addEventListener('click', () => {
    document.getElementById('detail-panel').classList.add('hidden');
  });
}

function rebuildMarkers() {
  if (STATE.markerLayer) {
    STATE.map.removeLayer(STATE.markerLayer);
  }
  STATE.markersById = {};

  if (!document.getElementById('show-markers').checked) {
    updateStats();
    return;
  }

  const useCluster = document.getElementById('cluster-markers').checked;
  const layer = useCluster
    ? L.markerClusterGroup({
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        maxClusterRadius: 40,
      })
    : L.layerGroup();

  const filters = getActiveFilters();
  for (const e of STATE.events) {
    if (!eventPasses(e, filters)) continue;
    // Skip non-geographic events — they show in the Other panel instead
    if (e.non_geographic) continue;
    const kind = agencyKind(e.agency);
    const icon = L.divIcon({
      className: 'uap-marker ' + kind,
      iconSize: [14, 14],
    });
    const marker = L.marker([e.lat, e.lon], { icon: icon });

    // Tooltip on hover
    const tooltip = `<b>${e.date_iso}</b> · ${escapeHtml(e.location)}<br>
      <span style="color:#8fa3c4">${escapeHtml(e.agency || '')} · ${escapeHtml(e.type || '')}</span>`;
    marker.bindTooltip(tooltip, {
      direction: 'top', offset: [0, -10], opacity: 0.95,
    });

    // Popup on click
    marker.bindPopup(buildPopupHtml(e), { maxWidth: 280 });

    layer.addLayer(marker);
    STATE.markersById[e.id] = marker;
  }
  layer.addTo(STATE.map);
  STATE.markerLayer = layer;
  updateStats();
}

// Global event delegation for popup buttons + Other-events list
document.addEventListener('click', evt => {
  const btn = evt.target.closest('.show-detail');
  if (btn) {
    const id = btn.dataset.id;
    const ev = STATE.events.find(x => x.id === id);
    if (ev) showDetail(ev);
    return;
  }
  const row = evt.target.closest('.other-row');
  if (row) {
    const id = row.dataset.id;
    const ev = STATE.events.find(x => x.id === id);
    if (ev) showDetail(ev);
  }
});
document.addEventListener('keydown', evt => {
  if (evt.key !== 'Enter' && evt.key !== ' ') return;
  const row = evt.target.closest('.other-row');
  if (row) {
    evt.preventDefault();
    const id = row.dataset.id;
    const ev = STATE.events.find(x => x.id === id);
    if (ev) showDetail(ev);
  }
});

function toggleHeat() {
  if (document.getElementById('show-heatmap').checked) {
    STATE.heatLayer.addTo(STATE.map);
  } else {
    STATE.map.removeLayer(STATE.heatLayer);
  }
}

// Live-adjust heatmap intensity. Scales the alpha of every gradient stop
// + scales the layer's overall opacity via CSS.
function applyHeatOpacity(scale) {
  if (!STATE.heatLayer) return;
  // Apply via the leaflet-heat canvas opacity (it's a single canvas)
  const heatCanvas = STATE.heatLayer._canvas;
  if (heatCanvas) {
    heatCanvas.style.opacity = String(scale);
  }
}
function toggleMarkers() {
  rebuildMarkers();
}

function updateStats() {
  const filters = getActiveFilters();
  const visible = STATE.events.filter(e => eventPasses(e, filters));
  document.getElementById('visible-count').textContent = `${visible.length} / ${STATE.events.length}`;

  // Region stats: group by country/region (heuristic — last comma word or whole)
  const counts = {};
  for (const e of visible) {
    const loc = e.location;
    let region = loc;
    if (loc.includes(',')) {
      region = loc.split(',').pop().trim();
    }
    counts[region] = (counts[region] || 0) + 1;
  }
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 25);
  const html = rows.map(([r, n]) =>
    `<div class="region-row"><span>${escapeHtml(r)}</span><span>${n}</span></div>`
  ).join('');
  document.getElementById('region-stats').innerHTML = html;

  // Other Events: non-geographic events (visible after filters)
  updateOtherEvents(visible);
}

function updateOtherEvents(visible) {
  const wrap = document.getElementById('other-events-list');
  const countEl = document.getElementById('other-events-count');
  if (!wrap) return;
  const others = visible.filter(e => e.non_geographic);
  others.sort((a, b) => a.date_iso.localeCompare(b.date_iso));
  if (countEl) countEl.textContent = others.length;
  if (!others.length) {
    wrap.innerHTML = '<div style="color:#6a7c9c; padding:4px 0;">— —</div>';
    return;
  }
  const hasVideo = (e) => e.video_url ? '🎬' : '';
  const hasImage = (e) => e.image_url ? '🖼' : '';
  wrap.innerHTML = others.map(e => `
    <div class="other-row" data-id="${escapeAttr(e.id)}" role="button" tabindex="0">
      <div class="other-row-line">
        <span class="other-date">${e.date_iso}</span>
        <span class="other-icons">${hasVideo(e)}${hasImage(e)}</span>
      </div>
      <div class="other-loc">${escapeHtml(e.location)}</div>
      <div class="other-meta">${escapeHtml(e.agency || '')} · ${escapeHtml(e.type || '')}</div>
    </div>
  `).join('');
}

function showDetail(e) {
  STATE.lastDetailEvent = e;
  document.getElementById('detail-content').innerHTML = buildDetailHtml(e);
  document.getElementById('detail-panel').classList.remove('hidden');
}

function updateLegend() {
  if (!STATE.legendEl) return;
  const t = (k) => I18N.t(k);
  STATE.legendEl.innerHTML = `
    <h4>${escapeHtml(t('legend_title'))}</h4>
    <div class="leg-row"><span class="swatch" style="background:#ffd93d"></span> ${escapeHtml(t('legend_fbi'))}</div>
    <div class="leg-row"><span class="swatch" style="background:#6bcb77"></span> ${escapeHtml(t('legend_usaf'))}</div>
    <div class="leg-row"><span class="swatch" style="background:#82b9ff"></span> ${escapeHtml(t('legend_dow'))}</div>
    <div class="leg-row"><span class="swatch" style="background:#ff9f6b"></span> ${escapeHtml(t('legend_nasa'))}</div>
    <div class="leg-row"><span class="swatch" style="background:#ff6b6b"></span> ${escapeHtml(t('legend_other'))}</div>
    <hr style="border-color:#2a3a5a; margin:6px 0;">
    <div class="leg-row">${t('legend_heatmap_caption')}</div>
  `;
}

// Expose globals so I18N.apply can re-render dynamic content
window.STATE = STATE;
window.rebuildMarkers = rebuildMarkers;
window.updateLegend = updateLegend;
window.showDetail = showDetail;

// Boot
(async function main() {
  // Set loading placeholder via i18n if available
  const evtCount = document.getElementById('event-count');
  if (evtCount && window.I18N) evtCount.textContent = I18N.t('loading');
  try {
    await loadData();
    initMap();
  } catch (err) {
    console.error('Failed to load data:', err);
    const I = window.I18N || { t: (k) => k };
    document.getElementById('event-count').textContent = I.t('load_error');
    document.getElementById('map').innerHTML =
      '<div style="color:#ff6b6b; padding:40px; text-align:center;">'
      + escapeHtml(I.t('load_error'))
      + '<br><br>' + escapeHtml(I.t('load_error_cmd')) + ': '
      + '<code style="background:#2a3a5a; padding:4px 8px; border-radius:3px;">'
      + 'python3 -m http.server 9876</code></div>';
  }
})();
