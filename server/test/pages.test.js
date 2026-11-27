// The pages (TASK-454; SPEC-048, SPEC-051, rule 5): the shell at every screen address, the app's files, the 404 page
// only outside /api, the headers of every answer, no project data without a sign-in, nothing loaded from another
// site, the fonts against their record, and the log lines of page requests.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { after, before, describe, test } from 'node:test';
import { createPages, isApiPath, messagesModule, PAGE_HEADERS, PAGE_POLICY } from '../src/pages.js';
import { ERRORS } from '../src/problem.js';
import { ROUTES } from '../src/routes.js';
import { openStore } from '../src/store.js';
import { parseAddress } from '../web/address.js';
import { seed } from './seed.js';
import { ISSUER, localGate, OWNER_EMAIL, startServer } from './support.js';

const WEB = new URL('../web/', import.meta.url);
const read = (path) => readFileSync(new URL(path, WEB));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
// Every file of web/, by its path there.
const WEB_FILES = readdirSync(WEB, { recursive: true }).map((name) => String(name).replaceAll('\\', '/'))
  .filter((path) => extname(path) !== '');
const SERVED = WEB_FILES.filter((path) => ['.css', '.js', '.woff2'].includes(extname(path)));
const TEXTS = WEB_FILES.filter((path) => ['.css', '.js', '.html'].includes(extname(path)));
const FONTS = JSON.parse(read('fonts/fonts.json'));

// Addresses that name a screen, and addresses that name none.
const SCREEN_ADDRESSES = [
  '/', '/p', '/p/reading-club', '/p/reading-club/_/01-domain', '/p/reading-club/app/13-presentation',
  '/p/reading-club/_/05-erd/changes', '/p/a/b-c/09-mockup',
];
const OTHER_ADDRESSES = [
  '/x', '/p/', '/P', '/p/Bad_Name', '/p/a--b', `/p/${'a'.repeat(65)}`, '/p/demo/', '/p/demo/_', '/p/demo/_/14-x',
  '/p/demo/__/01-domain', '/p/demo//01-domain', '/p/demo/_/01-domain/', '/p/demo/_/01-domain/changes/x',
  '/p/demo/_/01-domain/other', '/p/%64emo', '/p/demo/_/01-domain/changes/', '/web', '/web/', '/web/nope.js',
  '/web/shell.html', '/web/fonts/fonts.json', '/web/fonts/LICENSE.txt', '/web/../src/app.js', '/index.html',
];

function assertPageHeaders(answer, where) {
  for (const [name, value] of Object.entries(PAGE_HEADERS)) {
    if (name !== 'cache-control') assert.equal(answer.headers[name], value, `${where}: ${name}`);
  }
  assert.equal(answer.headers['x-content-type-options'], 'nosniff', where);
}

describe('the pages', () => {
  let folder;
  let db;
  let local;
  let server;
  let plain;
  let space;
  const marks = {};

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-pages-'));
    ({ db } = openStore(folder));
    local = localGate();
    server = await startServer({ routes: ROUTES, store: db, gate: local.gate, pages: createPages() });
    plain = await startServer({ routes: ROUTES, store: db, gate: local.gate });
    const stamp = Date.now();
    Object.assign(marks, {
      name: `marked-project-${stamp}`,
      title: `A title no page may hold ${stamp}`,
      diagram: `A diagram no page may hold ${stamp}`,
      comment: `A comment no page may hold ${stamp}`,
      part: `marked-part-${stamp}`,
    });
    const s = seed(db);
    space = s.project(marks.name, { title: marks.title, parts: [marks.part] });
    const diagram = s.diagram(space, { name: marks.diagram });
    s.thread(diagram, { body: marks.comment });
  });

  after(async () => {
    await server.close();
    await plain.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  test('every screen address answers the shell, with the page headers (SCR-142 to SCR-146)', async () => {
    const shell = read('shell.html').toString('utf8');
    for (const path of [...SCREEN_ADDRESSES, `/p/${marks.name}/${marks.part}/05-erd?d=dg_000000000001&thread=nc_000000000001`]) {
      const answer = await server.send({ path });
      assert.equal(answer.status, 200, path);
      assert.equal(answer.headers['content-type'], 'text/html; charset=utf-8', path);
      assert.equal(answer.headers['cache-control'], 'no-store', path);
      assertPageHeaders(answer, path);
      assert.equal(answer.text.replaceAll(/\/web\/v\/[a-f0-9]{64}\//g, '/web/'), shell, path);
    }
  });

  test('versioned assets use one content-derived namespace and the browser may cache them', async () => {
    const page = await server.send({ path: '/' });
    const paths = [...page.text.matchAll(/(?:href|src)="(\/web\/v\/[a-f0-9]{64}\/[^\"]+\.(?:js|css))"/g)].map((match) => match[1]);
    const expected = [...read('shell.html').toString('utf8').matchAll(/(?:href|src)="(\/web\/[^"?#]+\.(?:js|css))"/g)].map((match) => match[1]).filter((path) => path !== '/web/recovery.js');
    assert.ok(expected.length > 0);
    assert.match(page.text, /<script src="\/web\/recovery\.js"><\/script>/);
    assert.deepEqual(paths.map((path) => path.replace(/^\/web\/v\/[a-f0-9]{64}\//, '/web/')), expected);
    assert.equal(new Set(paths.map((path) => path.split('/')[3])).size, 1);
    for (const path of paths) {
      const answer = await server.send({ path });
      assert.equal(answer.status, 200, path);
      assert.equal(answer.headers['cache-control'], 'private, max-age=31536000, immutable');
      const legacy = await server.send({ path: path.replace(/^\/web\/v\/[a-f0-9]{64}\//, '/web/') });
      assert.ok(answer.bytes.equals(legacy.bytes), path);
      assert.equal(legacy.headers['cache-control'], 'no-store');
    }
    const stale = paths[0].replace(/\/v\/[a-f0-9]{64}\//, `/v/${'0'.repeat(64)}/`);
    assert.equal((await server.send({ path: stale })).status, 404);
    const version = paths[0].split('/')[3];
    for (const path of ['messages.js', 'layout.js']) {
      const answer = await server.send({ path: `/web/v/${version}/${path}` });
      assert.equal(answer.status, 200, path);
      assert.equal(answer.headers['cache-control'], 'private, max-age=31536000, immutable');
    }
  });

  test('the shell offers a reload when scripts cannot start after a release change', async () => {
    const answer = await server.send({ path: '/p' });
    assert.match(answer.text, /화면을 불러오고 있어요/);
    assert.match(answer.text, /<a href="">새로고침<\/a>/);
  });

  test('a failed versioned script changes the startup notice to an error and keeps a reload link', () => {
    let listener;
    const status = { replaceChildren: (...children) => { status.children = children; } };
    const doc = { getElementById: () => status, createElement: () => ({ setAttribute(name, value) { this[name] = value; } }) };
    runInNewContext(read('recovery.js').toString('utf8'), {
      globalThis: { addEventListener: (type, handler, capture) => { assert.equal(type, 'error'); assert.equal(capture, true); listener = handler; } },
      document: doc, location: { href: 'https://example.test/p' }, URL,
    });
    listener({ target: { tagName: 'SCRIPT', src: 'https://example.test/web/v/old/main.js' } });
    assert.match(status.children[0], /불러오지 못했어요/);
    assert.equal(status.children[1].href, '');
    assert.equal(status.children[1].textContent, '새로고침');
    delete status.children;
    listener({ target: { tagName: 'IMG', src: 'https://example.test/web/v/old/p.png' } });
    assert.equal(status.children, undefined);
    listener({ target: {}, filename: 'https://example.test/web/v/old/main.js' });
    assert.match(status.children[0], /불러오지 못했어요/);
  });

  test('the Content-Security-Policy loads nothing from another site and allows no inline code', () => {
    const directives = Object.fromEntries(PAGE_POLICY.split('; ').map((directive) => {
      const [name, ...values] = directive.split(' ');
      return [name, values];
    }));
    assert.deepEqual(directives['default-src'], ["'none'"]);
    // frame-src 'self': the stage-09 mockup page (API-293), NEXUS's own answer, in its frame (TASK-458).
    for (const name of ['script-src', 'style-src', 'img-src', 'font-src', 'connect-src', 'frame-src']) assert.deepEqual(directives[name], ["'self'"], name);
    for (const name of ['base-uri', 'form-action', 'frame-ancestors']) assert.deepEqual(directives[name], ["'none'"], name);
    assert.deepEqual(directives['require-trusted-types-for'], ["'script'"]);
    assert.equal(PAGE_POLICY.includes('unsafe'), false);
    assert.equal(/https?:|\*|data:|blob:/.test(PAGE_POLICY), false);
  });

  test('every file of the app answers as it is in web/, with its type and the page headers', async () => {
    const types = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.woff2': 'font/woff2' };
    assert.ok(SERVED.length >= 15);
    for (const path of SERVED) {
      const answer = await server.send({ path: `/web/${path}` });
      assert.equal(answer.status, 200, path);
      assert.equal(answer.headers['content-type'], types[extname(path)], path);
      assert.ok(answer.bytes.equals(read(path)), path);
      assert.equal(answer.headers['cache-control'], extname(path) === '.woff2' ? 'private, max-age=31536000, immutable' : 'no-store', path);
      assertPageHeaders(answer, path);
    }
  });

  test('src/layout.js answers at /web/layout.js as it is, for the workbench to lay out a moved box (TASK-458)', async () => {
    const source = readFileSync(new URL('../src/layout.js', import.meta.url));
    assert.equal(WEB_FILES.includes('layout.js'), false);
    const answer = await server.send({ path: '/web/layout.js' });
    assert.equal(answer.status, 200);
    assert.equal(answer.headers['content-type'], 'text/javascript; charset=utf-8');
    assert.ok(answer.bytes.equals(source));
    assert.equal(answer.headers['cache-control'], 'no-store');
    assertPageHeaders(answer, 'layout.js');
    // A page runs it as its own code: it imports nothing, names no other site and writes no markup or style.
    const text = source.toString('utf8');
    assert.equal(/^\s*import\s/m.test(text), false);
    assert.deepEqual([...text.matchAll(/https?:\/\/[^\s"'`)]+/g)], []);
    assert.equal(/\bimport\(|\beval\(|\bdocument\b/.test(text), false);
    assert.equal(/innerHTML|outerHTML|insertAdjacentHTML|new Function|\.style/.test(text), false);
  });

  test('an address that names no screen answers the shell with 404, which never holds the path or the query', async () => {
    const shell = read('shell.html').toString('utf8');
    const marker = `marker${Date.now()}`;
    for (const path of [...OTHER_ADDRESSES, `/${marker}?q=${marker}`, `/p/${marker}/x/y/z?d=${marker}`]) {
      const answer = await server.send({ path });
      assert.equal(answer.status, 404, path);
      assert.equal(answer.headers['content-type'], 'text/html; charset=utf-8', path);
      assertPageHeaders(answer, path);
      assert.equal(answer.text.replaceAll(/\/web\/v\/[a-f0-9]{64}\//g, '/web/'), shell, path);
      assert.equal(answer.text.includes(marker), false, path);
    }
  });

  test('the server serves the shell for exactly the addresses the page reads a screen from', () => {
    const pageOf = createPages();
    for (const path of [...SCREEN_ADDRESSES, ...OTHER_ADDRESSES]) {
      if (path.startsWith('/web/') && SERVED.includes(path.slice(5))) continue;
      assert.equal(pageOf(path).status === 200, parseAddress(path) !== null, path);
    }
  });

  test('every /api path the server does not know still answers the not_found Problem, with pages or without', async () => {
    for (const target of [server, plain]) {
      for (const [method, path] of [
        ['GET', '/api'], ['GET', '/api/'], ['GET', '/api/nope'], ['GET', '/api/projects/demo/nope'], ['GET', '/api/web/main.js'],
        ['POST', '/api/nope'], ['GET', '/api?x=1'],
      ]) {
        const answer = await target.send({ method, path });
        assert.equal(answer.status, 404, `${method} ${path}`);
        assert.equal(answer.headers['content-type'], 'application/problem+json', `${method} ${path}`);
        assert.equal(answer.json.code, 'not_found', `${method} ${path}`);
      }
    }
    assert.equal(isApiPath('/api'), true);
    assert.equal(isApiPath('/apis'), false);
  });

  test('a page is a GET only: any other method outside /api answers as before', async () => {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const answer = await server.send({ method, path: '/p', body: method === 'DELETE' ? undefined : '{}' });
      assert.equal(answer.status, 404, method);
      assert.equal(answer.json.code, 'not_found', method);
    }
    const head = await server.send({ method: 'HEAD', path: '/' });
    assert.equal(head.status, 404);
  });

  test('without a sign-in no page or file holds project data, a setting or a server address (SPEC-048)', async () => {
    const values = [
      marks.title, marks.diagram, marks.comment, 'no page may hold', OWNER_EMAIL, new URL(ISSUER).host, local.audience,
      folder, folder.replaceAll('\\', '/'), String(server.port), fileURLToPath(new URL('..', import.meta.url)),
    ];
    const paths = [
      ...SCREEN_ADDRESSES, `/p/${marks.name}`, `/p/${marks.name}/${marks.part}/05-erd`, `/p/${marks.name}/_/05-erd/changes`,
      ...OTHER_ADDRESSES, ...SERVED.map((path) => `/web/${path}`), '/web/messages.js',
    ];
    for (const path of paths) {
      const answer = await server.send({ path });
      assert.ok([200, 404].includes(answer.status), path);
      // A font is IBM's file byte for byte (the fonts test checks its SHA-256), so it holds nothing of NEXUS.
      if (path.endsWith('.woff2')) continue;
      for (const value of values) assert.equal(answer.text.includes(value), false, `${path} holds a value it may not`);
      // Only the page's own address can name the project, and the page never repeats it.
      if (!path.startsWith('/web/') && !path.includes(marks.name)) assert.equal(answer.text.includes(marks.name), false, path);
      if (path.includes(marks.name)) assert.equal(answer.text.includes(marks.name), false, path);
    }
    // The API it reads still admits only the owner.
    for (const path of ['/api/projects', '/api/todo', `/api/projects/${marks.name}`]) {
      const answer = await server.send({ path });
      assert.deepEqual([answer.status, answer.json.code], [401, 'unauthenticated'], path);
      assert.equal(answer.text.includes(marks.title), false);
    }
  });

  test('the page and its code load nothing from another site, and run no inline script or style', () => {
    const shell = read('shell.html').toString('utf8');
    const links = [...shell.matchAll(/\b(?:src|href)="([^"]*)"/g)].map(([, link]) => link);
    assert.ok(links.length >= 5);
    assert.equal((shell.match(/<a href="">새로고침<\/a>/g) ?? []).length, 1);
    const onlyAssets = shell.replace('<a href="">새로고침</a>', '');
    for (const [, link] of onlyAssets.matchAll(/\b(?:src|href)="([^"]*)"/g)) assert.match(link, /^\/web\/[A-Za-z0-9./-]+$/, link);
    assert.equal(/<style|\sstyle=|<script(?![^>]*\ssrc=)/i.test(shell), false);
    for (const path of TEXTS) {
      const text = read(path).toString('utf8');
      // The SVG namespace is a name, never loaded.
      const urls = [...text.matchAll(/https?:\/\/[^\s"'`)]+/g)].map(([url]) => url).filter((url) => url !== 'http://www.w3.org/2000/svg');
      assert.deepEqual(urls, [], path);
      assert.equal(/@import|\/\/[a-z0-9.-]+\.[a-z]{2,}\//i.test(text.replace('http://www.w3.org/2000/svg', '')), false, path);
      if (extname(path) === '.css') {
        for (const [, url] of text.matchAll(/url\(\s*["']?([^"')]+)/g)) assert.match(url, /^\/web\/fonts\//, `${path}: ${url}`);
      }
      if (extname(path) === '.js') {
        assert.equal(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function|cssText|setAttribute\(\s*['"]style/.test(text), false, path);
        assert.equal(/\bstyle\s*=|\.style\b/.test(text), false, path);
      }
    }
  });

  test('the fonts are the recorded files of IBM Plex releases, and fonts.css names exactly them (question 4)', () => {
    const recorded = FONTS.releases.flatMap((release) => release.files);
    assert.equal(recorded.length, 4);
    for (const release of FONTS.releases) {
      assert.match(release.release, /^@ibm\/plex-(?:sans-kr|mono)@\d+\.\d+\.\d+$/);
      assert.match(release.asset, /^https:\/\/github\.com\/IBM\/plex\/releases\/download\//);
      for (const file of release.files) {
        const bytes = read(`fonts/${file.file}`);
        assert.equal(bytes.length, file.bytes, file.file);
        assert.equal(sha256(bytes), file.sha256, file.file);
        assert.equal(bytes.subarray(0, 4).toString('latin1'), 'wOF2', file.file);
        assert.ok([400, 600].includes(file.weight), file.file);
        assert.ok(file.file.startsWith(release.release.replace('@ibm/', '').replace('@', '-')), file.file);
      }
    }
    assert.equal(sha256(read('fonts/LICENSE.txt')), FONTS.licence.sha256);
    assert.match(read('fonts/LICENSE.txt').toString('utf8'), /SIL Open Font License, Version 1\.1/);
    const woff2 = WEB_FILES.filter((path) => extname(path) === '.woff2').map((path) => path.slice('fonts/'.length)).sort();
    assert.deepEqual(woff2, recorded.map((file) => file.file).sort());
    const css = read('fonts.css').toString('utf8');
    const named = [...css.matchAll(/url\("\/web\/fonts\/([^"]+)"\)/g)].map(([, file]) => file).sort();
    assert.deepEqual(named, recorded.map((file) => file.file).sort());
    assert.equal(recorded.reduce((sum, file) => sum + file.bytes, 0), 972872);
  });

  test('web/messages.js is the Korean message of every code of the error registry', async () => {
    const answer = await server.send({ path: '/web/messages.js' });
    assert.equal(answer.status, 200);
    assert.equal(answer.text, messagesModule());
    const { MESSAGES } = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(answer.text)}`);
    assert.deepEqual(MESSAGES, Object.fromEntries(Object.entries(ERRORS).map(([code, entry]) => [code, entry.message_ko])));
    assert.equal(MESSAGES.unauthenticated, '다시 로그인하세요.');
    assert.equal(MESSAGES.not_found, '없는 주소예요.');
  });

  test('logs one line per page request with no path, query or project in it (rule 5)', async () => {
    const marker = `logged${Date.now()}`;
    const before = server.logText().split('\n').filter(Boolean).length;
    await server.send({ path: `/p/${marker}?d=${marker}` });
    await server.send({ path: `/${marker}/x?thread=${marker}` });
    await server.send({ path: '/web/main.js' });
    const lines = (await server.logged(before + 3)).slice(before);
    assert.deepEqual(lines.map((line) => [line.method, line.action, line.sender, line.status, line.code]), [
      ['GET', null, 'unknown', 200, null],
      ['GET', null, 'unknown', 404, null],
      ['GET', null, 'unknown', 200, null],
    ]);
    assert.equal(server.logText().includes(marker), false);
    assert.equal(server.logText().includes(marks.title), false);
  });
});
