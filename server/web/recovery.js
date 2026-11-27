// A tiny stable bootstrap: a module may fail across a server restart before the app can show its own error state.
// It stays at a stable path so it can report versioned script and stylesheet failures.
(() => {
  let failed = false;
  let shown = false;
  function showFailure() {
    const status = document.getElementById('recovery-alert');
    if (!status || shown) return;
    shown = true;
    document.getElementById('startup-status')?.replaceChildren();
    const link = document.createElement('a');
    link.setAttribute('href', '');
    link.textContent = '새로고침';
    status.replaceChildren('화면에 문제가 생겼어요. ', link, '하거나 문제가 계속되면 관리자에게 알려주세요.');
  }
  globalThis.addEventListener('error', (event) => {
    const source = event.target;
    const url = source?.tagName === 'SCRIPT' ? source.src : source?.tagName === 'LINK' ? source.href : event.filename;
    if (!url || !new URL(url, location.href).pathname.startsWith('/web/v/')) return;
    failed = true;
    showFailure();
  }, true);
  globalThis.addEventListener('DOMContentLoaded', () => { if (failed) showFailure(); });
})();
