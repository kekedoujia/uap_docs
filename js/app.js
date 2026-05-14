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

// Fetch helper: rely on HTTP cache headers (manifest is short-cached and
// triggers revalidation of batches via must-revalidate in render.yaml).
async function fetchData(path) {
  const res = await fetch(path);
  return res.json();
}

async function loadData() {
  // 1. Manifest + geocode in parallel (small, both blocking).
  const [manifest, geocode] = await Promise.all([
    fetchData('data/manifest.json'),
    fetchData('data/geocode.json'),
  ]);
  STATE.manifest = manifest;
  STATE.geocode = geocode;

  // 2. All event batches in PARALLEL (was the main bottleneck — 12 sequential
  //    fetches × RTT was costing several seconds on a typical mobile network).
  const batches = await Promise.all(
    manifest.batches.map(fn => fetchData(`data/events/${fn}`))
  );

  // 3. Process batches into a flat events array.
  const allEvents = [];
  const dataSources = {};  // ds_id → metadata from batch
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
        country: batch.country || '',
      };
    }
    for (const e of batch.events) {
      // Prefer the geocode lookup, then any embedded lat/lon on the event.
      const geo = STATE.geocode[e.location];
      let lat = geo ? geo.lat : (typeof e.lat === 'number' ? e.lat : null);
      let lon = geo ? geo.lon : (typeof e.lon === 'number' ? e.lon : null);
      // Drop only if NEITHER geocoded NOR explicitly marked non-geographic.
      if (lat == null && !e.non_geographic) continue;
      const ev = Object.assign({}, e, {
        lat, lon,
        batch_id: batch.batch_id,
        batch_name: batch.batch_name,
        release_date: batch.release_date,
        data_source: e.data_source || batch.data_source || 'Other',
      });
      ev.id = e.id || `${batch.batch_id}_${ev.date_iso}_${ev.location}_${(ev.file || '').slice(0, 30)}`;
      allEvents.push(ev);
    }
  }
  STATE.events = allEvents;
  STATE.dataSources = dataSources;
  document.getElementById('event-count').textContent = allEvents.length;
  renderDataSourcesMeta();

  // Build filter options
  buildFilters();

  // 4. Cities heatmap is large (~820KB) and only used for the heat layer.
  //    Fire-and-forget after critical path so markers render immediately.
  fetch('data/cities_heatmap.json').then(r => r.json()).then(data => {
    STATE.citiesHeat = data;
    if (window.applyHeatLayer) window.applyHeatLayer();
  }).catch(err => console.warn('heatmap load failed:', err));
}

// Lookup helpers driven by STATE.dataSources (loaded from batch JSONs)
function dsInfo(id) {
  return (STATE.dataSources && STATE.dataSources[id]) || {
    id, label: id, short_label: id, filter_label: id,
    short_label_zh: id, filter_label_zh: id, url: '',
  };
}
function dsLabel(id, kind) {
  const lang = (typeof I18N !== 'undefined' && I18N.current) || 'zh';
  const info = dsInfo(id);
  const key = (lang === 'zh' && info[kind + '_zh']) ? kind + '_zh' : kind;
  return info[key] || info.label || id;
}

function renderDataSourcesMeta() {
  const btnCount = document.getElementById('ds-menu-count');
  const panel = document.getElementById('ds-menu-panel');
  if (!btnCount || !panel) return;
  const counts = new Map();
  for (const ev of STATE.events) {
    const ds = ev.data_source || 'Other';
    counts.set(ds, (counts.get(ds) || 0) + 1);
  }
  btnCount.textContent = counts.size;
  const items = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([ds, n]) => {
      const info = dsInfo(ds);
      const label = dsLabel(ds, 'short_label');
      const flabel = dsLabel(ds, 'filter_label');
      const url = info.url || '#';
      return `
        <li role="menuitem" class="ds-menu-item">
          <a href="${url}" target="_blank" rel="noopener">
            <span class="ds-menu-label">${escapeHtml(flabel)}</span>
            <span class="ds-menu-meta">${n} · ${escapeHtml(info.country || '')}</span>
          </a>
        </li>`;
    }).join('');
  panel.innerHTML = `<ul class="ds-menu-list">${items}</ul>`;

  // Wire button toggle (idempotent)
  const btn = document.getElementById('ds-menu-btn');
  if (btn && !btn._wired) {
    btn._wired = true;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = !panel.classList.contains('hidden');
      panel.classList.toggle('hidden');
      btn.setAttribute('aria-expanded', String(!open));
    });
    document.addEventListener('click', (e) => {
      if (!panel.classList.contains('hidden') && !panel.contains(e.target) && e.target !== btn) {
        panel.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  }
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
  // Date range
  let minYear = 9999, maxYear = 0;
  for (const e of STATE.events) {
    const y = parseInt(e.date_iso.slice(0, 4), 10);
    if (y < minYear) minYear = y;
    if (y > maxYear) maxYear = y;
  }
  document.getElementById('date-min').placeholder = String(minYear);
  document.getElementById('date-max').placeholder = String(maxYear);

  // Data source checkboxes — labels come from each batch's data_source_filter_label
  const dsWrap = document.getElementById('source-checkboxes');
  if (dsWrap) {
    dsWrap.innerHTML = '';
    for (const [ds, n] of [...sources.entries()].sort((a, b) => b[1] - a[1])) {
      const label = document.createElement('label');
      label.className = 'cb';
      const pretty = dsLabel(ds, 'filter_label');
      label.innerHTML = `<input type="checkbox" value="${escapeAttr(ds)}" checked> ${escapeHtml(pretty)} <span style="color:#6a7c9c">(${n})</span>`;
      label.querySelector('input').addEventListener('change', refilter);
      dsWrap.appendChild(label);
    }
  }

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

  // Type checkboxes (removed — was misleading; kept type filter pass-through below in case re-added)

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
  const typesChecked = null;  // type filter removed; always pass
  const sourcesChecked = new Set();
  document.querySelectorAll('#source-checkboxes input:checked').forEach(c => sourcesChecked.add(c.value));
  return { dateMin, dateMax, agenciesChecked, typesChecked, sourcesChecked };
}

function eventPasses(e, filters) {
  const yr = parseInt(e.date_iso.slice(0, 4), 10);
  if (filters.dateMin && yr < parseInt(filters.dateMin, 10)) return false;
  if (filters.dateMax && yr > parseInt(filters.dateMax, 10)) return false;
  if (filters.sourcesChecked && !filters.sourcesChecked.has(e.data_source || 'Other')) return false;
  if (!filters.agenciesChecked.has(e.agency)) return false;
  if (filters.typesChecked && !filters.typesChecked.has(e.type)) return false;
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
  // Hover-preview popup: no buttons (clicking the marker opens the detail panel directly).
  const titleEsc = escapeHtml(e.title || I18N.t('detail_no_title'));
  return `
    <div style="min-width:220px">
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
    </div>
  `;
}

function buildDetailHtml(e) {
  const url = e.archive_url || '';
  const t = (k) => I18N.t(k);
  const lang = (typeof I18N !== 'undefined' && I18N.current) || 'zh';

  // Page-specific thumbnail (rendered from the actual PDF page) takes priority.
  // Falls back to cover thumbnail from war.gov modal_image when no page-specific
  // render is available.
  let imageBlock = '';
  let watermarkBlock = '';
  if (e.watermark_crop_url) {
    const label = t('detail_watermark_full');
    watermarkBlock = `
      <div class="media-block">
        <div class="media-block-title">⏱ ${escapeHtml(label)}</div>
        <img src="${escapeAttr(e.watermark_crop_url)}" alt="watermark"
             style="width:100%; max-height:140px; object-fit:contain;
                    background:#000; border-radius:4px; image-rendering: crisp-edges;">
      </div>
    `;
  }
  const useFullPdfLink = e.archive_url && e.page
    ? e.archive_url + (e.archive_url.includes('#') ? '' : `#page=${parseInt(e.page, 10)}`)
    : e.archive_url;
  if (e.page_thumb_url) {
    const pageLabel = t('detail_rendered_page').replace('{page}', parseInt(e.page, 10));
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
    // Only show cover when there's no specific page (event represents whole document)
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
    const playLabel = t('detail_play_video');
    const dvidsLabel = t('detail_dvids_page');
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
    ? t('detail_non_geo')
    : (e.lat != null ? `(${e.lat.toFixed(4)}, ${e.lon.toFixed(4)})` : '');

  // Type label maps to record_type if present
  const typeLabel = e.record_type || e.type || '';

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
    ${watermarkBlock}
    ${videoBlock}

    <div class="detail-links">
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

// Render report_summary text with paragraphs + minimal inline formatting.
// Escapes HTML first (safe), then applies: **bold**, *italic*, double newlines
// → paragraph breaks, single newlines → <br>.
function renderSummary(text) {
  if (!text) return '';
  let s = escapeHtml(text);
  // Inline: **bold** before *italic* so ** doesn't get partially-matched as *...*
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  // Split into paragraphs on blank lines, then <br> within each para
  const paras = s.split(/\n\s*\n+/).map(p => p.trim()).filter(Boolean);
  return paras.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
}

// Render the report_summary block. In zh mode shows Chinese on top with English
// "原文" expandable below; in en mode shows only the English text.
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

  // Heatmap layer — lightweight overlay. Data may not be loaded yet
  // (deferred fire-and-forget). applyHeatLayer() is called once when it
  // arrives, and can also be called later if the data becomes ready after
  // the map is initialised.
  window.applyHeatLayer = function applyHeatLayer() {
    if (!STATE.citiesHeat || !STATE.citiesHeat.length) return;
    if (STATE.heatLayer) return;  // already built
    STATE.heatLayer = L.heatLayer(STATE.citiesHeat, {
      radius: 12, blur: 16, maxZoom: 7,
      max: 1.5,
      minOpacity: 0.10,
      gradient: {
        0.0: 'rgba(0, 60, 140, 0)',
        0.3: 'rgba(30, 127, 190, 0.35)',
        0.5: 'rgba(58, 168, 196, 0.45)',
        0.7: 'rgba(146, 214, 93, 0.55)',
        0.85: 'rgba(251, 209, 71, 0.65)',
        1.0: 'rgba(255, 94, 58, 0.75)',
      },
    });
    const cb = document.getElementById('show-heatmap');
    if (cb && cb.checked) STATE.heatLayer.addTo(map);
    // Apply slider value to the actual canvas opacity. Wrap in a tiny
    // timeout because the heatmap canvas only exists after the layer
    // has been added to the map and Leaflet has drawn it once.
    const op = document.getElementById('heat-opacity');
    if (op) {
      setTimeout(() => applyHeatOpacity(parseInt(op.value, 10) / 100), 50);
    }
  };
  applyHeatLayer();

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

    // Hover → rich popup preview; click → open detail panel directly.
    marker.bindPopup(buildPopupHtml(e), {
      maxWidth: 280,
      closeButton: false,
      autoClose: true,
      closeOnClick: false,
      autoPan: false,
    });
    marker.on('mouseover', () => marker.openPopup());
    marker.on('mouseout', () => marker.closePopup());
    marker.on('click', () => {
      marker.closePopup();
      showDetail(e);
    });

    layer.addLayer(marker);
    STATE.markersById[e.id] = marker;
  }
  layer.addTo(STATE.map);
  STATE.markerLayer = layer;
  updateStats();
}

// Mobile sidebar toggle
function toggleSidebar(force) {
  const open = force !== undefined ? force : !document.body.classList.contains('sidebar-open');
  document.body.classList.toggle('sidebar-open', open);
}
document.addEventListener('click', evt => {
  if (evt.target.closest('#hamburger-btn')) {
    toggleSidebar();
    return;
  }
  if (evt.target.closest('#sidebar-backdrop')) {
    toggleSidebar(false);
    return;
  }
  // Legend FAB toggle (mobile expand/collapse)
  if (evt.target.closest('.legend-fab')) {
    if (STATE.legendEl) STATE.legendEl.classList.toggle('expanded');
    return;
  }
  if (evt.target.closest('.legend-close')) {
    if (STATE.legendEl) STATE.legendEl.classList.remove('expanded');
    return;
  }
});

// Global event delegation
document.addEventListener('click', evt => {
  // Row in the Other Events modal table
  const modalRow = evt.target.closest('.modal-row');
  if (modalRow) {
    const id = modalRow.dataset.id;
    const ev = STATE.events.find(x => x.id === id);
    if (ev) showDetail(ev);
    return;
  }
  // Open the Other Events modal
  if (evt.target.closest('#other-events-btn')) {
    openOtherModal();
    return;
  }
  // Open the Disclaimer modal
  if (evt.target.closest('#disclaimer-btn')) {
    openDisclaimerModal();
    return;
  }
  // Close any open modal via X button or backdrop click
  const closer = evt.target.closest('[data-modal-close]');
  if (closer) {
    const m = closer.closest('.modal');
    if (m) {
      m.classList.add('hidden');
      if (!document.querySelector('.modal:not(.hidden)')) {
        document.body.classList.remove('modal-open');
      }
    }
    return;
  }
});
document.addEventListener('keydown', evt => {
  if (evt.key === 'Escape') {
    let closedAny = false;
    document.querySelectorAll('.modal:not(.hidden)').forEach(m => {
      m.classList.add('hidden');
      closedAny = true;
    });
    if (closedAny) document.body.classList.remove('modal-open');
    if (document.body.classList.contains('sidebar-open')) toggleSidebar(false);
  }
  if (evt.key !== 'Enter' && evt.key !== ' ') return;
  const modalRow = evt.target.closest('.modal-row');
  if (modalRow) {
    evt.preventDefault();
    const id = modalRow.dataset.id;
    const ev = STATE.events.find(x => x.id === id);
    if (ev) showDetail(ev);
  }
});

// Auto-close sidebar when user picks something on mobile
function autoCloseSidebar() {
  if (window.innerWidth <= 720 && document.body.classList.contains('sidebar-open')) {
    toggleSidebar(false);
  }
}

function toggleHeat() {
  // Heatmap data is deferred — layer may not exist yet.
  if (!STATE.heatLayer) {
    // Will be auto-added on arrival if checkbox is checked
    return;
  }
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
  const tbody = document.getElementById('other-modal-tbody');
  const countSidebar = document.getElementById('other-events-count');
  const countModal = document.getElementById('other-modal-count');
  const others = visible.filter(e => e.non_geographic);
  // Newest first — matches the timeline view ordering.
  others.sort((a, b) => b.date_iso.localeCompare(a.date_iso));
  if (countSidebar) countSidebar.textContent = others.length;
  if (countModal) countModal.textContent = others.length;
  if (!tbody) return;
  if (!others.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#6a7c9c;padding:20px;">—</td></tr>';
    return;
  }
  tbody.innerHTML = others.map(e => {
    const kind = agencyKind(e.agency);
    const hasVid = e.video_url ? '🎬' : '';
    const hasImg = e.image_url ? '🖼' : '';
    const title = (e.report_summary || e.title || '').slice(0, 160);
    return `
      <tr class="modal-row" data-id="${escapeAttr(e.id)}" tabindex="0" role="button">
        <td><span class="tl-row-marker tl-marker-${kind}" style="display:inline-block;margin-right:6px;vertical-align:middle;"></span>${escapeHtml(e.date_iso)}</td>
        <td>${escapeHtml(e.location)}</td>
        <td>${escapeHtml(e.agency || '')}</td>
        <td>${escapeHtml(e.type || '')}</td>
        <td class="modal-title-cell">${escapeHtml(title)}${title.length >= 160 ? '…' : ''}</td>
        <td class="modal-media-cell">${hasImg}${hasVid}</td>
      </tr>
    `;
  }).join('');
}

function openOtherModal() {
  document.getElementById('other-modal').classList.remove('hidden');
  document.body.classList.add('modal-open');
}
function closeOtherModal() {
  document.getElementById('other-modal').classList.add('hidden');
  document.body.classList.remove('modal-open');
}
function openDisclaimerModal() {
  document.getElementById('disclaimer-modal').classList.remove('hidden');
  document.body.classList.add('modal-open');
}

// Lazy summary fetch (perf: keeps critical batches small).
// summaries.json is fetched on first detail open OR ~3s after main load
// as background prefetch. Cached after.
let SUMMARIES_PROMISE = null;
function ensureSummaries() {
  if (!SUMMARIES_PROMISE) {
    SUMMARIES_PROMISE = fetch('data/summaries.json').then(r => r.json()).then(map => {
      // Merge into existing events in-place
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

function updateLegend() {
  if (!STATE.legendEl) return;
  const t = (k) => I18N.t(k);
  STATE.legendEl.innerHTML = `
    <button class="legend-fab" type="button" aria-label="Toggle legend" title="Legend">ⓘ</button>
    <div class="legend-content">
      <div class="legend-head">
        <h4>${escapeHtml(t('legend_title'))}</h4>
        <button class="legend-close" type="button" aria-label="Close legend">×</button>
      </div>
      <div class="leg-row"><span class="swatch" style="background:#ffd93d"></span> ${escapeHtml(t('legend_fbi'))}</div>
      <div class="leg-row"><span class="swatch" style="background:#6bcb77"></span> ${escapeHtml(t('legend_usaf'))}</div>
      <div class="leg-row"><span class="swatch" style="background:#82b9ff"></span> ${escapeHtml(t('legend_dow'))}</div>
      <div class="leg-row"><span class="swatch" style="background:#ff9f6b"></span> ${escapeHtml(t('legend_nasa'))}</div>
      <div class="leg-row"><span class="swatch" style="background:#ff6b6b"></span> ${escapeHtml(t('legend_other'))}</div>
      <hr style="border-color:#2a3a5a; margin:6px 0;">
      <div class="leg-row">${t('legend_heatmap_caption')}</div>
    </div>
  `;
}

// Expose globals so I18N.apply can re-render dynamic content
window.STATE = STATE;
window.rebuildMarkers = rebuildMarkers;
window.updateLegend = updateLegend;
window.showDetail = showDetail;
window.renderDataSourcesMeta = renderDataSourcesMeta;

// Hook I18N.apply to also re-render the data-source meta pill (labels are lang-aware).
if (typeof I18N !== 'undefined') {
  const _origApply = I18N.apply.bind(I18N);
  I18N.apply = function () {
    _origApply();
    if (window.renderDataSourcesMeta && STATE.events.length) {
      window.renderDataSourcesMeta();
    }
    // Re-render source filter checkbox labels too
    const dsWrap = document.getElementById('source-checkboxes');
    if (dsWrap && STATE.events.length) {
      const sources = new Map();
      for (const e of STATE.events) {
        const ds = e.data_source || 'Other';
        sources.set(ds, (sources.get(ds) || 0) + 1);
      }
      dsWrap.innerHTML = '';
      for (const [ds, n] of [...sources.entries()].sort((a, b) => b[1] - a[1])) {
        const lbl = document.createElement('label');
        lbl.className = 'cb';
        const pretty = dsLabel(ds, 'filter_label');
        lbl.innerHTML = `<input type="checkbox" value="${escapeAttr(ds)}" checked> ${escapeHtml(pretty)} <span style="color:#6a7c9c">(${n})</span>`;
        lbl.querySelector('input').addEventListener('change', refilter);
        dsWrap.appendChild(lbl);
      }
    }
  };
}

// Open detail panel + zoom to a specific event if URL hash specifies one
function handleHash() {
  const m = location.hash.match(/^#event=(.+)$/);
  if (!m) return;
  const id = decodeURIComponent(m[1]);
  const ev = STATE.events.find(x => x.id === id);
  if (!ev) return;
  if (ev.lat != null && !ev.non_geographic && STATE.map) {
    STATE.map.setView([ev.lat, ev.lon], 7, { animate: true });
    // Open the marker popup if present
    const marker = STATE.markersById[ev.id];
    if (marker && marker.openPopup) {
      setTimeout(() => marker.openPopup(), 400);
    }
  }
  showDetail(ev);
}

// Boot
(async function main() {
  // Set loading placeholder via i18n if available
  const evtCount = document.getElementById('event-count');
  if (evtCount && window.I18N) evtCount.textContent = I18N.t('loading');
  try {
    await loadData();
    initMap();
    handleHash();
    window.addEventListener('hashchange', handleHash);
    // Background-prefetch summaries so detail panels open instantly.
    setTimeout(() => ensureSummaries(), 2000);
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
