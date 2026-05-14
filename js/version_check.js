// Data-version checker.
//
// Fetches data/version.json (no-cache) on page load and remembers the
// version string. On every visibilitychange / focus, re-fetches and
// compares. If the server now reports a different version, shows a
// small banner and reloads the page (auto-reload after 4 s).
//
// data/version.json is regenerated on every Render build by
// scripts/prepare_for_render.py — the version field is the build's
// UTC timestamp, so any new deploy invalidates clients.

(() => {
  const VERSION_URL = 'data/version.json';
  let currentVersion = null;
  let banner = null;

  async function fetchVersion() {
    try {
      const r = await fetch(VERSION_URL + '?_=' + Date.now(), {
        cache: 'no-store',
      });
      if (!r.ok) return null;
      const j = await r.json();
      return j && j.version ? j : null;
    } catch (_) {
      return null;
    }
  }

  function showBanner(onClick) {
    if (banner) return;
    banner = document.createElement('div');
    banner.id = 'data-update-banner';
    banner.setAttribute('role', 'status');
    banner.style.cssText = [
      'position:fixed',
      'top:14px',
      'left:50%',
      'transform:translateX(-50%)',
      'background:#0a84ff',
      'color:#fff',
      'padding:10px 18px',
      'border-radius:8px',
      'cursor:pointer',
      'z-index:99999',
      'box-shadow:0 4px 14px rgba(0,0,0,.35)',
      'font-size:14px',
      'font-family:-apple-system,Segoe UI,Roboto,sans-serif',
    ].join(';');
    banner.innerHTML = '🔄 数据已更新 · Data updated — 点击刷新 / click to reload';
    banner.addEventListener('click', onClick);
    document.body.appendChild(banner);
  }

  let checking = false;
  async function maybeReload() {
    if (checking) return;
    if (document.visibilityState !== 'visible') return;
    if (!currentVersion) return;
    checking = true;
    try {
      const v = await fetchVersion();
      if (v && v.version && v.version !== currentVersion) {
        showBanner(() => location.reload());
        setTimeout(() => location.reload(), 4000);
      }
    } finally {
      checking = false;
    }
  }

  async function init() {
    const v = await fetchVersion();
    if (!v) return;
    currentVersion = v.version;
    document.addEventListener('visibilitychange', maybeReload);
    window.addEventListener('focus', maybeReload);
    // Also poll every 5 min as a fallback (focus events may be missed
    // on some browsers / OS power modes).
    setInterval(maybeReload, 5 * 60 * 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
