// The theme, set before the page is drawn so that it never flashes the other one: the one the owner chose with the
// switch (localStorage 'nexus-theme'), or else the system's. A classic script, since a module runs after the first
// paint; states.js themeOf is the same rule, which test/shell.test.js checks against this file.
(function () {
  var chosen = null;
  try {
    chosen = window.localStorage.getItem('nexus-theme');
  } catch (error) {
    chosen = null;
  }
  var dark = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var theme = chosen === 'light' || chosen === 'dark' ? chosen : (dark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
}());
