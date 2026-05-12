// Bilingual i18n: zh (default) / en
// Applied to elements with data-i18n="key" attributes.
// JS modules read translations via I18N.t(key).

const I18N = {
  current: 'zh',

  dict: {
    zh: {
      title: 'UFO/UAP 解密档案交互地图',
      header_title: '🛸 UFO/UAP 解密档案交互地图',
      meta_events: '事件',
      meta_batches: '批次',
      meta_source: '数据源',
      sidebar_title: '筛选器 / Filters',
      filter_date_range: '时间范围：',
      filter_agency: '报告机构：',
      filter_type: 'UAP 类型：',
      filter_layers: '显示图层：',
      layer_heatmap: '人类活动 heatmap',
      layer_intensity: '强度',
      layer_markers: '事件标点',
      layer_cluster: '聚合相邻点',
      stats_visible: '当前显示：',
      stats_by_region: '按地区统计',
      footer_version: '站点版本',
      footer_built: '生成日期',
      // Map popup / detail
      popup_view_detail: '查看详情 / Details',
      popup_open_archive: '原档↗',
      detail_close: '关闭',
      detail_location: '📍 地点',
      detail_agency: '🏛 报告机构',
      detail_type: '📁 类型',
      detail_date_raw: '📅 原始日期文本',
      detail_source: '🔖 来源',
      detail_batch: '📦 批次',
      detail_page: '📄 页码',
      detail_open_pdf: '📄 打开原始档案 / Open Original PDF',
      detail_event_id: '事件 ID',
      detail_no_title: '(无标题)',
      legend_title: '图例 / Legend',
      legend_fbi: 'FBI',
      legend_usaf: 'USAF/OSI',
      legend_dow: '战争部 (DoW)',
      legend_nasa: 'NASA',
      legend_other: '其他/Other',
      legend_heatmap_caption: '人类活动 heatmap<br>(GeoNames 33k 城市，按人口对数加权)',
      load_error: '加载数据失败。请通过 HTTP 服务器访问（不能直接打开 index.html 文件）。',
      load_error_cmd: '命令',
      loading: '加载中…',
      visitor_you_are: '您是第',
      visitor_suffix: '位访客',
      other_events_title: '其他事件（外太空 / 无具体地点）',
      nav_timeline: '📅 时间轴视图',
      timeline_title: 'UFO/UAP 事件时间轴',
      timeline_header: '事件时间轴',
      timeline_to_map: '🗺 返回地图',
      timeline_back: '返回地图',
      tl_search: '搜索',
      tl_search_placeholder: '输入地点、机构、关键词...',
      tl_visible: '显示',
      tl_no_results: '无符合条件的事件',
      tl_th_date: '日期',
      tl_th_location: '地点',
      tl_th_agency: '机构',
      tl_th_type: '类型',
      tl_th_title: '标题 / 摘要',
      tl_th_media: '媒体',
    },
    en: {
      title: 'UFO/UAP Disclosure Archive — Interactive Map',
      header_title: '🛸 UFO/UAP Disclosure Archive Map',
      meta_events: 'events',
      meta_batches: 'batch(es)',
      meta_source: 'Data source',
      sidebar_title: 'Filters',
      filter_date_range: 'Date range:',
      filter_agency: 'Reporting agency:',
      filter_type: 'UAP type:',
      filter_layers: 'Display layers:',
      layer_heatmap: 'Human activity heatmap',
      layer_intensity: 'Intensity',
      layer_markers: 'Event markers',
      layer_cluster: 'Cluster nearby points',
      stats_visible: 'Currently visible:',
      stats_by_region: 'By region',
      footer_version: 'Site version',
      footer_built: 'Built',
      popup_view_detail: 'View details',
      popup_open_archive: 'Archive↗',
      detail_close: 'Close',
      detail_location: '📍 Location',
      detail_agency: '🏛 Reporting agency',
      detail_type: '📁 Type',
      detail_date_raw: '📅 Original date text',
      detail_source: '🔖 Source',
      detail_batch: '📦 Batch',
      detail_page: '📄 Page',
      detail_open_pdf: '📄 Open original PDF',
      detail_event_id: 'Event ID',
      detail_no_title: '(no title)',
      legend_title: 'Legend',
      legend_fbi: 'FBI',
      legend_usaf: 'USAF / OSI',
      legend_dow: 'Department of War',
      legend_nasa: 'NASA',
      legend_other: 'Other',
      legend_heatmap_caption: 'Human activity heatmap<br>(33k GeoNames cities, log-pop weighted)',
      load_error: 'Failed to load data. Please serve over HTTP (not file://).',
      load_error_cmd: 'Command',
      loading: 'Loading…',
      visitor_you_are: 'You are visitor #',
      visitor_suffix: '',
      other_events_title: 'Other events (outer space / unlocated)',
      nav_timeline: '📅 Timeline view',
      timeline_title: 'UFO/UAP Event Timeline',
      timeline_header: 'Event Timeline',
      timeline_to_map: '🗺 Back to map',
      timeline_back: 'Back to map',
      tl_search: 'Search',
      tl_search_placeholder: 'location, agency, keyword...',
      tl_visible: 'Showing',
      tl_no_results: 'No events match.',
      tl_th_date: 'Date',
      tl_th_location: 'Location',
      tl_th_agency: 'Agency',
      tl_th_type: 'Type',
      tl_th_title: 'Title / Summary',
      tl_th_media: 'Media',
    },
  },

  t(key) {
    const lang = this.current;
    return (this.dict[lang] && this.dict[lang][key]) || this.dict.zh[key] || key;
  },

  apply() {
    // Apply translations to all data-i18n elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const k = el.getAttribute('data-i18n');
      const v = this.t(k);
      if (v) el.textContent = v;
    });
    // Placeholder attribute
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const k = el.getAttribute('data-i18n-placeholder');
      const v = this.t(k);
      if (v) el.setAttribute('placeholder', v);
    });
    // Update <html lang>
    document.documentElement.lang = this.current === 'zh' ? 'zh-CN' : 'en';
    // Highlight active button
    document.querySelectorAll('.lang-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.lang === this.current);
    });
    // Re-render dynamic parts of the app if it has booted
    if (window.STATE && window.STATE.map) {
      if (window.rebuildMarkers) window.rebuildMarkers();
      if (window.updateLegend) window.updateLegend();
      const id = document.getElementById('detail-panel');
      if (id && !id.classList.contains('hidden') && window.STATE.lastDetailEvent) {
        if (window.showDetail) window.showDetail(window.STATE.lastDetailEvent);
      }
    }
    // Visitor counter re-render
    if (window.renderVisitorCounter) window.renderVisitorCounter();
  },

  set(lang) {
    if (!this.dict[lang]) return;
    this.current = lang;
    try { localStorage.setItem('ufo_lang', lang); } catch (e) {}
    this.apply();
  },

  init() {
    // Read preference
    let saved = null;
    try { saved = localStorage.getItem('ufo_lang'); } catch (e) {}
    if (saved && this.dict[saved]) {
      this.current = saved;
    } else {
      // Auto-detect from browser
      const browserLang = (navigator.language || 'zh').toLowerCase();
      this.current = browserLang.startsWith('zh') ? 'zh' : 'en';
    }
    this.apply();

    // Wire toggle buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => this.set(btn.dataset.lang));
    });
  },
};

// Boot i18n as soon as DOM is ready
document.addEventListener('DOMContentLoaded', () => I18N.init());
