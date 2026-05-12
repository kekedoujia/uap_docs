// Visitor counter — uses public counter API (no backend required).
//
// Behavior:
//   - Each unique browser session (24 h cooldown) increments the counter once.
//   - Subsequent page loads within 24 h fetch the cached number without bump.
//   - Graceful fallback: if API down, element is hidden.
//
// Public counter APIs tried in order:
//   1. https://abacus.jasoncameron.dev/hit/<ns>/visits        (primary)
//   2. https://api.counterapi.dev/v1/<ns>/visits/up           (fallback)

(function () {
  const NS = 'uap-docs-2026';        // namespace for our counter
  const KEY = 'visits';
  const STORAGE_KEY = 'uap_visitor_state';
  const COOLDOWN_MS = 24 * 60 * 60 * 1000;   // 24 h

  function getCached() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (Date.now() - (obj.t || 0) < COOLDOWN_MS && typeof obj.n === 'number') {
        return obj;
      }
    } catch (e) {}
    return null;
  }

  function setCached(n) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ n, t: Date.now() }));
    } catch (e) {}
  }

  async function fetchAbacus(action) {
    // action: 'hit' (increment+get) or 'info' (get only)
    const url = `https://abacus.jasoncameron.dev/${action}/${NS}/${KEY}`;
    const r = await fetch(url, { method: 'GET', mode: 'cors' });
    if (!r.ok) throw new Error('abacus ' + r.status);
    const j = await r.json();
    return typeof j.value === 'number' ? j.value : null;
  }

  async function fetchCounterAPI() {
    const url = `https://api.counterapi.dev/v1/${NS}/${KEY}/up`;
    const r = await fetch(url, { method: 'GET', mode: 'cors' });
    if (!r.ok) throw new Error('counterapi ' + r.status);
    const j = await r.json();
    return typeof j.count === 'number' ? j.count : null;
  }

  async function getCount(shouldIncrement) {
    // Try abacus first
    try {
      const n = await fetchAbacus(shouldIncrement ? 'hit' : 'info');
      if (n != null) return n;
    } catch (e) { console.debug('abacus failed:', e); }
    // Fallback: counterapi.dev (only has increment endpoint)
    try {
      const n = await fetchCounterAPI();
      if (n != null) return n;
    } catch (e) { console.debug('counterapi failed:', e); }
    return null;
  }

  let LAST_COUNT = null;

  // Self-contained strings — don't depend on i18n.js (avoids stale-cache issues)
  const STRINGS = {
    zh: { prefix: '您是第', suffix: '位访客' },
    en: { prefix: 'You are visitor #', suffix: '' },
  };

  function currentLang() {
    if (window.I18N && I18N.current && STRINGS[I18N.current]) return I18N.current;
    try {
      const saved = localStorage.getItem('ufo_lang');
      if (saved && STRINGS[saved]) return saved;
    } catch (e) {}
    return (navigator.language || 'zh').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }

  function renderVisitorCounter(n) {
    const el = document.getElementById('visitor-counter');
    if (!el) return;
    if (n == null && LAST_COUNT == null) {
      el.classList.remove('ready');
      return;
    }
    if (n != null) LAST_COUNT = n;
    const s = STRINGS[currentLang()];
    const formatted = LAST_COUNT.toLocaleString('en-US');
    el.innerHTML =
      escapeHtml(s.prefix) +
      ' <span class="num">' + escapeHtml(formatted) + '</span>' +
      (s.suffix ? ' ' + escapeHtml(s.suffix) : '');
    el.classList.add('ready');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;',
      '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  // Boot
  document.addEventListener('DOMContentLoaded', async () => {
    const cached = getCached();
    if (cached) {
      // Show cached number immediately; refresh quietly without incrementing
      renderVisitorCounter(cached.n);
      try {
        const n = await getCount(false);
        if (n != null) {
          renderVisitorCounter(n);
          setCached(n);
        }
      } catch (e) {}
    } else {
      // New session — increment once
      try {
        const n = await getCount(true);
        if (n != null) {
          renderVisitorCounter(n);
          setCached(n);
        }
      } catch (e) {
        console.debug('counter unavailable');
      }
    }
  });

  // Expose for i18n re-render
  window.renderVisitorCounter = renderVisitorCounter;
})();
