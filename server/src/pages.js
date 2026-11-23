// The pages (TASK-454): the one shell page for every screen address, and the scripts, styles and fonts it loads from
// web/, all read once when the server starts. None of them holds a project's data, a setting, a server address or
// anything of the request: the page asks the API for its data once it runs, and the API admits only the owner (see
// admission.js). So the pages are answered without admission, while the gate still stands in front of the whole site.
//
// The server answers a GET of a path outside /api here, and only when it serves pages (main.js): the shell with 200 at
// an address that names a screen (web/address.js parseAddress, which the page reads its screen from too), a file of
// web/ at /web/<its path>, and the shell with 404 at any other path, where the page says "없는 주소예요." Every /api path
// stays the API's, whose unknown ones answer the not_found Problem. Every answer carries PAGE_HEADERS, the
// Content-Security-Policy that loads nothing from another site among them, and nosniff (see app.js).

import { readdirSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { parseAddress } from '../web/address.js';
import { ERRORS } from './problem.js';

const WEB = new URL('../web/', import.meta.url);
// The types of the files served from web/; a file of any other type there (the fonts' record and licence) is not.
const TYPES = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
});
const HTML = 'text/html; charset=utf-8';
// Only the page itself, its own scripts, styles and fonts, and reads of NEXUS's API: no inline script or style, no
// frame, no form sent by the browser, no plugin, and markup strings refused (Trusted Types), so a page builds its
// elements from text (see web/dom.js).
export const PAGE_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "require-trusted-types-for 'script'",
].join('; ');
export const PAGE_HEADERS = Object.freeze({
  'cache-control': 'no-store',
  'content-security-policy': PAGE_POLICY,
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
});
// A font's path names its release (web/fonts/fonts.json), so a browser may keep it.
const FONT_CACHE = 'private, max-age=31536000, immutable';

// The page answer of a path: { status, type, text, headers }, text being the body's bytes.
export function createPages() {
  const shell = readFileSync(new URL('shell.html', WEB));
  const files = new Map();
  for (const name of readdirSync(WEB, { recursive: true })) {
    const path = String(name).replaceAll('\\', '/');
    const type = TYPES[extname(path)];
    if (type !== undefined) files.set(`/web/${path}`, answer(200, type, readFileSync(new URL(path, WEB)), type === TYPES['.woff2']));
  }
  files.set('/web/messages.js', answer(200, TYPES['.js'], Buffer.from(messagesModule())));
  const page = answer(200, HTML, shell);
  const missing = answer(404, HTML, shell);
  return function pageOf(pathname) {
    if (files.has(pathname)) return files.get(pathname);
    return parseAddress(pathname) === null ? missing : page;
  };
}

// Whether a path is the API's, which the pages never answer.
export function isApiPath(pathname) {
  return pathname === '/api' || pathname.startsWith('/api/');
}

// web/messages.js: the Korean message of each code of the contract's error registry, for the pages to show a refusal
// by its code (rule 7). It is made from ERRORS when the server starts, so it has one source.
export function messagesModule() {
  const messages = Object.fromEntries(Object.entries(ERRORS).map(([code, entry]) => [code, entry.message_ko]));
  return `// Made by the server from its error registry (src/problem.js) as it starts.\nexport const MESSAGES = Object.freeze(${JSON.stringify(messages, null, 2)});\n`;
}

function answer(status, type, text, font = false) {
  const headers = { ...PAGE_HEADERS };
  if (font) headers['cache-control'] = FONT_CACHE;
  return Object.freeze({ status, type, text, headers: Object.freeze(headers) });
}
