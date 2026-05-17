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
      filter_source: '数据源：',
      filter_agency: '报告机构：',
      filter_select_all: '全选',
      agency_others: '其他/Others',
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
      detail_loc_approx: '⚠️ 地址不精确',
      detail_agency: '🏛 报告机构',
      detail_type: '📁 类型',
      detail_date_raw: '📅 原始日期文本',
      detail_source: '🔖 来源',
      detail_batch: '📦 批次',
      detail_page: '📄 页码',
      detail_open_pdf: '📄 打开原始档案 / Open Original PDF',
      detail_event_id: '事件 ID',
      detail_view_archive: '🗂 查看原档案',
      detail_additional_resources: '相关资料 / 其它文件',
      detail_also_in_files: '本案跨文件 / Case also appears in:',
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
      detail_play_video: '▶ 播放视频',
      detail_dvids_page: 'DVIDS 页面 ↗',
      detail_non_geo: '(无具体坐标)',
      detail_war_gov: '🏛 war.gov 官方页面',
      detail_view_on_map: '🗺 在地图上查看',
      detail_rendered_page: '第 {page} 页（PDF 渲染）',
      detail_watermark_full: '图片左下角时间水印（红外传感器默认时钟，实际日期未提供）',
      detail_watermark_short: '左下角时间水印（红外传感器默认时钟）',
      tl_tag_no_geo: '无地点',
      tl_load_fail: '加载失败。请通过 HTTP 服务器访问。',
      nav_reports: '📑 按报告索引',
      reports_title: 'UFO/UAP 档案 — 按报告索引',
      reports_header: '档案报告索引',
      reports_to_map: '🗺 返回地图',
      reports_to_timeline: '📅 时间轴',
      reports_back: '返回地图',
      reports_search_placeholder: '档案名称、来源、机构…',
      reports_visible_short: '显示',
      reports_no_results: '无符合条件的报告',
      reports_files_label: '档案',
      reports_pages_label: '页数',
      reports_events_label: '事件数',
      reports_file_label: '档案',
      reports_open_pdf_short: '打开 PDF',
      reports_open_gov: 'war.gov ↗',
      reports_expand: '展开事件',
      reports_collapse: '收起',
      reports_sort_label: '排序：',
      reports_sort_events: '事件数（多→少）',
      reports_sort_name: '档案名',
      reports_sort_pages: '页数（多→少）',
      nav_donate: '☕ 打赏',
      donate_title: '自愿赞助 — UFO/UAP 解密档案',
      donate_header: '自愿赞助',
      donate_intro_title: '这是一个非营利、不展示广告的个人维护项目',
      donate_intro_body: '本站完全免费、不收集用户数据。所有维护费用目前由开发者自费承担。若本站对您有帮助，欢迎通过以下方式打赏一杯咖啡。',
      donate_use_title: '💡 款项用途',
      donate_use_body: '您所支付的款项将<strong>仅用于本站的运营与内容建设</strong>，具体包括：<strong>原始档案 PDF/OCR 处理与数据整理</strong>、<strong>AI 推理费用</strong>（GPT/Claude API，用于事件摘要与双语翻译）、<strong>网站运维</strong>（域名、Render 托管、CDN、地图瓦片等）、以及后续新档案来源（更多国家/机构解密文件）的获取与索引。',
      donate_disclaimer: '⚠️ 重要说明：本款项为<strong>自愿赞助（support payment）</strong>，<strong>不是慈善捐款（charitable donation）</strong>。本项目并非任何美国 501(c)(3) 或其他国家/地区注册的慈善/非营利组织，您所支付的款项<strong>不可用于税务抵扣</strong>。',
      donate_venmo_hint: '使用 Venmo App 扫描二维码，或直接搜索 @uapmap',
      donate_venmo_open: '在 Venmo 中打开 ↗',
      donate_paypal_hint: '使用 PayPal App 扫描二维码，或直接搜索用户名 UAP-MAP',
      donate_wechat_hint: '使用微信扫一扫，向 PlanckConstant 转账',
      donate_verify: '🔍 <strong>扫码后请务必核对收款用户名</strong>，确认与本页所示一致（Venmo: <strong>@uapmap</strong>，PayPal: <strong>UAP-MAP</strong>，微信: <strong>PlanckConstant</strong>）后再转账，谨防误付他人。',
      donate_thanks: '感谢您的支持 🛸',
      disclaimer_title: '📄 免责声明 / Disclaimer',
      disclaimer_body: (
        '<strong>数据源</strong>：本站所有事件均来自<strong>各国可靠的官方政府档案/解密发布</strong>，'
        + '目前已收录的来源包括：'
        + '美国战争部 (Department of War / War Department) 于 2026 年 5 月 8 日发布的 '
        + '<a href="https://www.war.gov/UFO/" target="_blank" rel="noopener">UFO/UAP 解密档案 Release 01</a>'
        + '、澳大利亚国家档案馆 (National Archives of Australia) 的 '
        + '<a href="https://recordsearch.naa.gov.au/" target="_blank" rel="noopener">RecordSearch 公开档案</a>'
        + '、新西兰国防军 (New Zealand Defence Force) 依《公务信息法》于 2010-2012 年解密的 '
        + '<a href="https://archive.org/details/NewZealandUFO" target="_blank" rel="noopener">UFO 档案合集</a>'
        + '、以及巴西国家档案馆 (Arquivo Nacional do Brasil) 公开的 '
        + '<a href="https://www.gov.br/arquivonacional/" target="_blank" rel="noopener">航空部 UFO 卷宗</a>。'
        + '<strong>本站只收录由官方机构正式公开/解密的政府记录</strong>，不收录非官方目击网站、'
        + '民间整理的二次资料或匿名爆料。'
        + '<br><br>'
        + '本站内容由 OCR 文字识别与自动化脚本索引生成，部分摘要由 AI（GPT-5.4-mini）基于'
        + '原始档案图像与公开信息撰写，<strong>不保证完全准确</strong>——原始档案为唯一权威来源，'
        + '关键信息请以官方文件为准。本站可能存在以下不完美之处：OCR 误识、事件遗漏、'
        + '日期或地点抽取错误、缩略图与正文页码偏差等。'
        + '<br><br>'
        + '<strong>第三方服务与开源组件致谢</strong>：本站地图底图由 '
        + '<a href="https://carto.com/basemaps/" target="_blank" rel="noopener">CARTO Basemaps</a>'
        + '（dark_all 样式）提供，地理数据来源于 '
        + '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap 贡献者</a>'
        + '（ODbL 协议），相关版权标注已在地图右下角持续显示。前端交互由 '
        + '<a href="https://leafletjs.com/" target="_blank" rel="noopener">Leaflet</a>（BSD-2-Clause）'
        + '及其插件 '
        + '<a href="https://github.com/Leaflet/Leaflet.heat" target="_blank" rel="noopener">Leaflet.heat</a>、'
        + '<a href="https://github.com/Leaflet/Leaflet.markercluster" target="_blank" rel="noopener">Leaflet.markercluster</a>'
        + '（均为 MIT 协议）实现。本站对上述各服务与开源项目仅作<strong>非商业研究用途</strong>，'
        + '并严格遵守各自的署名要求与使用条款。'
        + '<br><br>'
        + '本站为<strong>完全免费的公益研究项目</strong>，不涉及任何商业目的、不展示任何广告、'
        + '不收集任何用户个人数据，与美国、澳大利亚、新西兰、巴西或任何其它政府/官方机构均无关联、'
        + '不代表其立场。仅供学习、研究及公共讨论之用。'
        + '<br><br>'
        + '<strong>联系方式</strong>：若您代表本页所引用的任何政府机构、第三方服务或开源项目，'
        + '对本站的使用、署名或内容有任何疑问或顾虑，欢迎通过邮件联系：'
        + '<a href="mailto:uapmap@outlook.com">uapmap@outlook.com</a>。'
      ),
      // Recent Updates page
      nav_recent_updates: '🔔 最近更新',
      ru_title: 'UFO/UAP 最近更新',
      ru_header: '最近更新',
      ru_back: '返回地图',
      ru_to_map: '🗺 返回地图',
      ru_to_timeline: '📅 时间轴',
      ru_to_reports: '📑 报告索引',
      ru_window_label: '时间窗口：',
      ru_window_all: '全部',
      ru_days: '天',
      ru_search_placeholder: '地点、机构、关键词、更新者…',
      ru_updated_by_label: '更新者：',
      ru_window_summary: '最近 {n} 天',
      ru_window_summary_all: '全部更新',
      ru_no_results: '所选时间窗口内暂无更新条目。',
      ru_event_date_short: '事件',
      ru_no_location: '(无地点)',
      ru_last_updated: '🕘 最近更新',
    },
    en: {
      title: 'UFO/UAP Disclosure Archive — Interactive Map',
      header_title: '🛸 UFO/UAP Disclosure Archive Map',
      meta_events: 'incidents',
      meta_batches: 'batch(es)',
      meta_source: 'Data source',
      sidebar_title: 'Filters',
      filter_date_range: 'Date range:',
      filter_source: 'Data source:',
      filter_agency: 'Reporting agency:',
      filter_select_all: 'Select all',
      agency_others: 'Others',
      filter_type: 'UAP type:',
      filter_layers: 'Display layers:',
      layer_heatmap: 'Human activity heatmap',
      layer_intensity: 'Intensity',
      layer_markers: 'Incident markers',
      layer_cluster: 'Cluster nearby points',
      stats_visible: 'Currently visible:',
      stats_by_region: 'By region',
      footer_version: 'Site version',
      footer_built: 'Built',
      popup_view_detail: 'View details',
      popup_open_archive: 'Archive↗',
      detail_close: 'Close',
      detail_location: '📍 Location',
      detail_loc_approx: '⚠️ Location approximate',
      detail_agency: '🏛 Reporting agency',
      detail_type: '📁 Type',
      detail_date_raw: '📅 Original date text',
      detail_source: '🔖 Source',
      detail_batch: '📦 Batch',
      detail_page: '📄 Page',
      detail_open_pdf: '📄 Open original PDF',
      detail_event_id: 'Incident ID',
      detail_view_archive: '🗂 View original archive',
      detail_additional_resources: 'Related resources / additional files',
      detail_also_in_files: 'Case also appears in:',
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
      other_events_title: 'Other incidents (outer space / unlocated)',
      nav_timeline: '📅 Timeline view',
      timeline_title: 'UFO/UAP Incident Timeline',
      timeline_header: 'Incident Timeline',
      timeline_to_map: '🗺 Back to map',
      timeline_back: 'Back to map',
      tl_search: 'Search',
      tl_search_placeholder: 'location, agency, keyword...',
      tl_visible: 'Showing',
      tl_no_results: 'No incidents match.',
      tl_th_date: 'Date',
      tl_th_location: 'Location',
      tl_th_agency: 'Agency',
      tl_th_type: 'Type',
      tl_th_title: 'Title / Summary',
      tl_th_media: 'Media',
      detail_play_video: '▶ Play video',
      detail_dvids_page: 'DVIDS page ↗',
      detail_non_geo: '(non-geographic)',
      detail_war_gov: '🏛 war.gov source page',
      detail_view_on_map: '🗺 View on map',
      detail_rendered_page: 'Rendered page {page}',
      detail_watermark_full: 'Bottom-left timestamp watermark (IR sensor default — real date unknown)',
      detail_watermark_short: 'Bottom-left timestamp (IR sensor default)',
      tl_tag_no_geo: 'no geo',
      tl_load_fail: 'Load failed. Please serve over HTTP.',
      nav_reports: '📑 By report',
      reports_title: 'UFO/UAP Archive — By Report',
      reports_header: 'Archive Reports Index',
      reports_to_map: '🗺 Back to map',
      reports_to_timeline: '📅 Timeline',
      reports_back: 'Back to map',
      reports_search_placeholder: 'file name, source, agency…',
      reports_visible_short: 'Showing',
      reports_no_results: 'No reports match.',
      reports_files_label: 'files',
      reports_pages_label: 'pages',
      reports_events_label: 'incidents',
      reports_file_label: 'File',
      reports_open_pdf_short: 'Open PDF',
      reports_open_gov: 'war.gov ↗',
      reports_expand: 'Show incidents',
      reports_collapse: 'Hide',
      reports_sort_label: 'Sort:',
      reports_sort_events: 'Incident count (high→low)',
      reports_sort_name: 'File name',
      reports_sort_pages: 'Page count (high→low)',
      nav_donate: '☕ Support This Website',
      donate_title: 'Support This Website — UFO/UAP Disclosure Archive',
      donate_header: 'Support This Website',
      donate_intro_title: 'An ad-free, individually maintained project',
      donate_intro_body: 'This site is completely free, runs no ads, and collects no user data. Operating costs are currently paid out of pocket by the developer. If this site has been useful to you, please consider buying me a coffee.',
      donate_use_title: '💡 Use of funds',
      donate_use_body: 'Contributions will be used <strong>solely for the operation and content development of this site</strong>, specifically: <strong>archive PDF/OCR processing and data curation</strong>; <strong>AI inference costs</strong> (GPT/Claude API for incident summaries and bilingual translation); <strong>site operations</strong> (domain, Render hosting, CDN, map tiles, etc.); and the acquisition and indexing of additional declassified archives (more countries / agencies).',
      donate_disclaimer: '⚠️ Important: Contributions are <strong>voluntary support payments</strong>, <strong>not tax-deductible charitable donations</strong>. This project is not a registered 501(c)(3) or any other charitable/non-profit entity, so your contribution <strong>cannot be claimed as a tax deduction</strong>.',
      donate_venmo_hint: 'Scan with the Venmo app, or search @uapmap directly',
      donate_venmo_open: 'Open in Venmo ↗',
      donate_paypal_hint: 'Scan with the PayPal app, or search the username UAP-MAP directly',
      donate_wechat_hint: 'Scan with WeChat to send to PlanckConstant',
      donate_verify: '🔍 <strong>After scanning, please verify the recipient username</strong> matches what is shown on this page (Venmo: <strong>@uapmap</strong>, PayPal: <strong>UAP-MAP</strong>, WeChat: <strong>PlanckConstant</strong>) before sending, to avoid paying the wrong person.',
      donate_thanks: 'Thank you for your support 🛸',
      disclaimer_title: '📄 Disclaimer',
      disclaimer_body: (
        '<strong>Data sources</strong>: All incidents on this site come from '
        + '<strong>reliable official government archives and declassification releases</strong>. '
        + 'Sources currently included: the U.S. Department of War\'s '
        + '<a href="https://www.war.gov/UFO/" target="_blank" rel="noopener">'
        + 'UFO/UAP Disclosure Release 01</a> (8 May 2026); the '
        + '<a href="https://recordsearch.naa.gov.au/" target="_blank" rel="noopener">'
        + 'National Archives of Australia RecordSearch</a> public collection; '
        + 'the New Zealand Defence Force UFO files declassified 2010-2012 under '
        + 'the Official Information Act and archived at '
        + '<a href="https://archive.org/details/NewZealandUFO" target="_blank" rel="noopener">archive.org</a>; '
        + 'and Brazilian Ministry of Aeronautics dossiers released by the '
        + '<a href="https://www.gov.br/arquivonacional/" target="_blank" rel="noopener">'
        + 'Arquivo Nacional do Brasil</a>. '
        + '<strong>This site only includes records officially published or declassified by government bodies</strong> — '
        + 'it does not include unofficial sighting databases, third-party compilations, or anonymous reports.'
        + '<br><br>'
        + 'Content is auto-indexed via OCR text recognition and scripted '
        + 'extraction; some summaries are written by AI (GPT-5.4-mini) from the original '
        + 'document images and public knowledge. <strong>Accuracy is not guaranteed</strong> — '
        + 'the original archival documents are the sole authoritative source. Known imperfections include: '
        + 'OCR errors, missed incidents, date/location extraction mistakes, and occasional thumbnail/page mismatches.'
        + '<br><br>'
        + '<strong>Third-party services & open-source credits</strong>: '
        + 'Map basemap tiles are served by '
        + '<a href="https://carto.com/basemaps/" target="_blank" rel="noopener">CARTO Basemaps</a> '
        + '(dark_all style); geographic data is © '
        + '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> '
        + '(ODbL). Attribution for both is continuously displayed in the lower-right corner of the map. '
        + 'Interactive functionality is built with '
        + '<a href="https://leafletjs.com/" target="_blank" rel="noopener">Leaflet</a> (BSD-2-Clause) '
        + 'and the plugins '
        + '<a href="https://github.com/Leaflet/Leaflet.heat" target="_blank" rel="noopener">Leaflet.heat</a> '
        + 'and '
        + '<a href="https://github.com/Leaflet/Leaflet.markercluster" target="_blank" rel="noopener">Leaflet.markercluster</a> '
        + '(both MIT). All of the above are used for '
        + '<strong>non-commercial research purposes only</strong>, in compliance with each project\'s attribution and licensing requirements.'
        + '<br><br>'
        + 'This is a <strong>free, non-commercial research project</strong>. '
        + 'No advertising. No user data is collected. '
        + 'This site is not affiliated with, endorsed by, or representative of the U.S., Australian, New Zealand, Brazilian, or any other '
        + 'government / official agency. Provided for educational, research, and public discussion purposes only.'
        + '<br><br>'
        + '<strong>Contact</strong>: If you represent any of the government agencies, third-party services, or open-source projects '
        + 'cited on this page and have questions or concerns about our use, attribution, or content, please reach out at '
        + '<a href="mailto:uapmap@outlook.com">uapmap@outlook.com</a>.'
      ),
      // Recent Updates page
      nav_recent_updates: '🔔 Recent Updates',
      ru_title: 'UFO/UAP — Recent Updates',
      ru_header: 'Recent Updates',
      ru_back: 'Back to map',
      ru_to_map: '🗺 Back to map',
      ru_to_timeline: '📅 Timeline',
      ru_to_reports: '📑 Reports',
      ru_window_label: 'Window:',
      ru_window_all: 'All',
      ru_days: 'days',
      ru_search_placeholder: 'Location, agency, keyword, editor…',
      ru_updated_by_label: 'Updated by:',
      ru_window_summary: 'Last {n} days',
      ru_window_summary_all: 'All updates',
      ru_no_results: 'No entries updated within the selected window.',
      ru_event_date_short: 'event',
      ru_no_location: '(no location)',
      ru_last_updated: '🕘 Last updated',
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
      if (!v) return;
      // If the key starts with 'html_' OR the element has data-i18n-html,
      // treat translation as raw HTML; otherwise use textContent.
      if (el.hasAttribute('data-i18n-html') || k.startsWith('html_')) {
        el.innerHTML = v;
      } else {
        el.textContent = v;
      }
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
    // Re-render map-specific elements (only on the map page)
    if (window.STATE && window.STATE.map) {
      if (window.rebuildMarkers) window.rebuildMarkers();
      if (window.updateLegend) window.updateLegend();
    }
    // Re-render open detail panel on EITHER page (map or timeline), since
    // its content has lang-dependent fields (Chinese/English summary, labels).
    if (window.STATE && window.STATE.lastDetailEvent && window.showDetail) {
      const id = document.getElementById('detail-panel');
      if (id && !id.classList.contains('hidden')) {
        window.showDetail(window.STATE.lastDetailEvent);
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
