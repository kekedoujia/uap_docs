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

  function renderVisitorCounter(n) {
    const el = document.getElementById('visitor-counter');
    if (!el) return;
    if (n == null && LAST_COUNT == null) {
      el.classList.remove('ready');
      return;
    }
    if (n != null) LAST_COUNT = n;
    const I = window.I18N || { t: (k) => k };
    const prefix = I.t('visitor_you_are');
    const suffix = I.t('visitor_suffix');
    const formatted = LAST_COUNT.toLocaleString('en-US');
    el.innerHTML =
      escapeHtml(prefix) +
      ' <span class="num">' + escapeHtml(formatted) + '</span>' +
      (suffix ? ' ' + escapeHtml(suffix) : '');
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
