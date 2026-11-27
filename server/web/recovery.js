// A tiny stable bootstrap: a module may fail across a server restart before the app can show its own error state.
// This file stays at an unversioned no-store path so it can report a failed versioned script load.
globalThis.addEventListener('error', (event) => {
  const source = event.target;
  const url = source?.tagName === 'SCRIPT' ? source.src : event.filename;
  if (!url || !new URL(url, location.href).pathname.startsWith('/web/v/')) return;
  const status = document.getElementById('startup-status');
  if (!status) return;
  const link = document.createElement('a');
  link.setAttribute('href', '');
  link.textContent = '새로고침';
  status.replaceChildren('화면을 불러오지 못했어요. ', link, '해 주세요.');
}, true);
