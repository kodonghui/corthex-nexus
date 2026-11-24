// The app shell (TASK-454; SPEC-048, SPEC-051): the addresses, the shared states of docs/08-screens (sections 2 and
// 3), and the shell itself run on test/fake-dom.js, against stubbed answers and against the server, so that every
// response API-262, API-263 and API-264 list leads to the state the screen definitions give it. How the pages look,
// at 360 and 1440 pixels in light and dark, is the browser walk of the pull request.

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { runInNewContext } from 'node:vm';
import { createPages } from '../src/pages.js';
import { ROUTES } from '../src/routes.js';
import { openStore } from '../src/store.js';
import { changesHref, parseAddress, projectHref, stageHref } from '../web/address.js';
import { outcomeOf } from '../web/api.js';
import { STAGES } from '../web/stages.js';
import {
  clockOf, GATE_KEY, gateStep, readTag, SHARED_STATES, STALE_AFTER_MS, stateOf, switchName, THEME_KEY, themeOf,
} from '../web/states.js';
import { contract, operations } from './contract.js';
import { fakePage } from './fake-dom.js';
import { listedResponses, responseRecord } from './responses.js';
import { seed } from './seed.js';
import {
  chosenDiagram, errorShown, GATE, headerOf, json, LISTED_DIAGRAMS, message, openPage, problem, SCREENS, startShell, texts, TRACE,
} from './screen-page.js';
import { localGate, startServer, waitFor } from './support.js';

const ROOT = new URL('../../', import.meta.url);
const TIME = '2026-11-23T01:00:00.000Z';
const DIAGRAM = 'dg_0000000000a1';
const REMOVED = 'dg_0000000000a2';
const SCREEN_IDS = ['SCR-142', 'SCR-143', 'SCR-144', 'SCR-145', 'SCR-146'];
// The operations of the three reads, by their API IDs.
const ACTIONS = Object.fromEntries(operations().filter(({ operation }) => ['API-262', 'API-263', 'API-264']
  .includes(operation['x-corthex']?.id)).map(({ operation }) => [operation['x-corthex'].id, operation.operationId]));

const summary = (name, title) => ({
  name, title, revision: 3, commit: 'a'.repeat(40), pushed_at: TIME, owner_todo: 1, stages_passed: 0,
});
const diagramOf = (id, name, removed = false) => ({
  id, kind: 'ddd_board', name, removed, drawn: true, confirmation: 'none', waiting: 0, open_threads: 0,
});
const PROJECTS = { projects: [summary('garden', '텃밭 계획표'), summary('reading-club', '독서 모임 앱')], backup: null };
const entry = (kind, fields = {}) => ({
  kind, project: 'reading-club', part: '', stage: '01-domain', diagram: DIAGRAM, diagram_name: '도메인 보드', thread: null,
  change_set: null, reason: kind === 'confirm' ? 'new' : null, since: TIME, ...fields,
});
const TODO = {
  entries: [entry('confirm'), entry('question', { thread: 'nc_0000000000b1' }), entry('proposal', { change_set: 'np_0000000000c1' })],
  backup: null,
};
const PROJECT = {
  name: 'reading-club',
  title: '독서 모임 앱',
  repository: 'https://github.com/example/demo',
  revision: 3,
  commit: 'a'.repeat(40),
  pushed_at: TIME,
  parts: [],
  stages: STAGES.map(({ id }) => ({
    stage: id,
    part: '',
    state: id === '01-domain' || id === '08-screen-states' ? 'open' : 'not_sent',
    passed_at: null,
    diagrams: id === '01-domain' ? [diagramOf(DIAGRAM, '도메인 보드')]
      : id === '08-screen-states' ? [diagramOf('dg_0000000000a3', 'SCR-001.md'), diagramOf(REMOVED, 'SCR-000.md', true)] : [],
  })),
  tool_links: [],
  workshop: null,
};

// API-265's Diagram of a diagram the workbench opens (TASK-458), drawn with no elements.
const diagramBody = (id, stage, kind, name, removed = false) => ({
  id, project: 'reading-club', part: '', stage, kind, name, removed,
  drawing: { id: `dw_${id.slice(3)}`, revision: 3, version: 'a'.repeat(40), status: 'drawn', failed_at: null, drawn_at: TIME },
  last_drawn: null, elements: [], overlays: [], since_confirmation: null, confirmation: null, threads: [],
});
const diagramRead = (id) => `/api/projects/reading-club/diagrams/${id}`;
const FINE = {
  '/api/projects': json(200, PROJECTS),
  '/api/todo': json(200, TODO),
  '/api/projects/reading-club': json(200, PROJECT),
  '/api/credentials': json(200, { credentials: [] }),
  [diagramRead(DIAGRAM)]: json(200, diagramBody(DIAGRAM, '01-domain', 'ddd_board', '도메인 보드')),
  [diagramRead('dg_0000000000a3')]: json(200, diagramBody('dg_0000000000a3', '08-screen-states', 'screen_states', 'SCR-001.md')),
  [diagramRead(REMOVED)]: json(200, diagramBody(REMOVED, '08-screen-states', 'screen_states', 'SCR-000.md', true)),
};

// The screen of pathname on a fake page (test/screen-page.js), with the answers of FINE unless others are given.
const open = (pathname, options = {}) => openPage(pathname, { answers: FINE, ...options });

describe('the addresses', () => {
  test('name the screens of the sitemap, with ?d= and ?thread= as they are given', () => {
    assert.deepEqual(parseAddress('/'), { screen: 'SCR-142' });
    assert.deepEqual(parseAddress('/p'), { screen: 'SCR-143' });
    assert.deepEqual(parseAddress('/p/reading-club'), { screen: 'SCR-144', project: 'reading-club' });
    assert.deepEqual(parseAddress('/p/reading-club/_/01-domain'),
      { screen: 'SCR-145', project: 'reading-club', part: '', stage: '01-domain', diagram: null, thread: null });
    assert.deepEqual(parseAddress('/p/reading-club/app/05-erd', `?d=${DIAGRAM}&thread=nc_0000000000a1`),
      { screen: 'SCR-145', project: 'reading-club', part: 'app', stage: '05-erd', diagram: DIAGRAM, thread: 'nc_0000000000a1' });
    assert.deepEqual(parseAddress('/p/reading-club/_/05-erd/changes', '?d=anything&thread=x'),
      { screen: 'SCR-146', project: 'reading-club', part: '', stage: '05-erd', diagram: 'anything' });
    assert.equal(parseAddress('/p/reading-club/_/01-domain', '?d=').diagram, '');
    for (const path of ['/x', '/p/', '/P', '/p/Bad', '/p/a--b', '/p/demo/', '/p/demo/_/14-x', '/p/demo/__/01-domain',
      '/p/demo//01-domain', '/p/demo/_/01-domain/', '/p/demo/_/01-domain/changes/x', '/p/demo/_/01-domain/other',
      '/p/%64emo', `/p/${'a'.repeat(65)}`, `/p/demo/${'a'.repeat(101)}/01-domain`, '//p', '', 'p']) {
      assert.equal(parseAddress(path), null, path);
    }
  });

  test('the screens\' addresses read back as the same screen', () => {
    const at = (href) => {
      const url = new URL(href, 'https://nexus.example.com');
      return parseAddress(url.pathname, url.search);
    };
    assert.equal(projectHref('reading-club'), '/p/reading-club');
    assert.equal(stageHref('reading-club', '', '01-domain'), '/p/reading-club/_/01-domain');
    assert.deepEqual(at(stageHref('reading-club', 'app', '09-mockup', { diagram: DIAGRAM, thread: 'nc_0000000000a1' })),
      { screen: 'SCR-145', project: 'reading-club', part: 'app', stage: '09-mockup', diagram: DIAGRAM, thread: 'nc_0000000000a1' });
    assert.deepEqual(at(changesHref('reading-club', '', '05-erd', { diagram: DIAGRAM })),
      { screen: 'SCR-146', project: 'reading-club', part: '', stage: '05-erd', diagram: DIAGRAM });
  });
});

describe('the shared states', () => {
  test('follow section 3 of the screen definitions for each answer', () => {
    const cases = [
      [{ status: 200, body: {} }, 'normal', null],
      [{ status: 201, body: {} }, 'normal', null],
      [{ status: 400, code: 'invalid_request' }, 'error', 'input'],
      [{ status: 413, code: 'body_too_large' }, 'error', 'input'],
      [{ status: 401, code: 'unauthenticated' }, 'permission', 'gate'],
      [{ failure: 'gate' }, 'permission', 'gate'],
      [{ status: 403, code: 'not_owner' }, 'permission', 'message'],
      [{ status: 403, code: 'owner_only' }, 'permission', 'message'],
      [{ status: 403, code: null }, 'permission', 'message'],
      [{ status: 403, code: 'cross_site' }, 'permission', 'reload'],
      [{ status: 404, code: 'project_not_found' }, 'error', 'gone'],
      [{ status: 404, code: 'tool_link_not_found' }, 'normal', null],
      [{ status: 404, code: 'workshop_not_found' }, 'normal', null],
      [{ status: 409, code: 'document_changed' }, 'stale', 'reload'],
      [{ status: 409, code: 'request_key_reused' }, 'error', 'input'],
      [{ status: 409, code: 'name_taken' }, 'error', 'input'],
      [{ status: 415, code: 'json_required' }, 'error', 'retry'],
      [{ status: 500, code: 'internal' }, 'error', 'retry'],
      [{ status: 502, code: null }, 'error', 'retry'],
      [{ failure: 'timeout' }, 'error', 'retry'],
      [{ failure: 'network' }, 'error', 'retry'],
      [{ failure: 'answer' }, 'error', 'retry'],
    ];
    for (const [outcome, state, kind] of cases) assert.deepEqual(stateOf(outcome), { state, kind }, JSON.stringify(outcome));
    // A 409 leads to a screen's own state only when the screen has it.
    assert.equal(stateOf({ status: 409, code: 'waiting_reflection' }).state, 'stale');
    assert.equal(stateOf({ status: 409, code: 'waiting_reflection' }, SCREENS['SCR-145'].states).state, 'waiting');
    assert.equal(stateOf({ status: 409, code: 'not_drawn' }, SCREENS['SCR-146'].states).state, 'not-drawn');
    assert.equal(stateOf({ status: 409, code: 'workshop_open' }, SCREENS['SCR-146'].states).state, 'stale');
    assert.equal(stateOf({ status: 409, code: 'step_empty' }, SCREENS['SCR-145'].states).state, 'workshop');
  });

  test('each response of API-262, API-263 and API-264 leads to the state its screen definitions give it', () => {
    const seen = new Set();
    for (const id of SCREEN_IDS) {
      const text = readFileSync(new URL(`docs/08-screens/${id}.md`, ROOT), 'utf8');
      const rows = [...text.matchAll(new RegExp(`^\\| ${id}#([a-z-]+) \\|.*\\| ([^|]*) \\|$`, 'gm'))];
      assert.ok(rows.length >= 6, id);
      for (const [, state, from] of rows) {
        for (const [, api, status] of from.matchAll(/(API-26[234])#(\w+)/g)) {
          const action = ACTIONS[api];
          const listed = listedResponses(action).find((response) => response.status === status);
          assert.ok(listed, `${id}#${state}: ${api}#${status} is listed`);
          seen.add(`${api}#${status}`);
          const outcomes = status === 'default' ? [{ status: 500, code: 'internal' }, { failure: 'network' }, { failure: 'timeout' }]
            : /^2/.test(status) ? [{ status: Number(status), body: {} }]
              : listed.codes.map((code) => ({ status: Number(status), code }));
          const expected = state === 'empty' ? 'normal' : state;
          for (const outcome of outcomes) {
            assert.equal(stateOf(outcome, SCREENS[id].states ?? SHARED_STATES).state, expected, `${id}#${state} from ${api}#${status}`);
          }
        }
      }
    }
    for (const [api, action] of Object.entries(ACTIONS)) {
      for (const { status } of listedResponses(action)) assert.ok(seen.has(`${api}#${status}`), `${api}#${status} leads to a state`);
    }
  });

  test('an answer becomes an outcome: the gate\'s redirect, a success, a Problem, or an answer that is not JSON', () => {
    assert.deepEqual(outcomeOf('opaqueredirect', 0, null), { failure: 'gate' });
    assert.deepEqual(outcomeOf('basic', 302, null), { failure: 'gate' });
    assert.deepEqual(outcomeOf('basic', 200, { projects: [] }), { status: 200, body: { projects: [] } });
    assert.deepEqual(outcomeOf('basic', 200, null), { failure: 'answer' });
    assert.deepEqual(outcomeOf('basic', 200, []), { failure: 'answer' });
    assert.deepEqual(outcomeOf('basic', 500, { code: 'internal', traceId: TRACE }), { status: 500, code: 'internal', traceId: TRACE });
    assert.deepEqual(outcomeOf('basic', 403, null), { status: 403, code: null, traceId: null });
  });

  test('the read time shows once the data is five minutes old, or a read again failed', () => {
    const readAt = new Date(2026, 10, 24, 9, 5, 30).getTime();
    assert.equal(readTag(null, readAt), null);
    assert.equal(readTag(readAt, readAt + STALE_AFTER_MS - 1), null);
    assert.equal(readTag(readAt, readAt + STALE_AFTER_MS), '09:05에 읽음');
    assert.equal(readTag(readAt, readAt + 1, true), '09:05에 읽음');
    assert.equal(clockOf(new Date(2026, 10, 24, 22, 42).getTime()), '22:42');
  });

  test('a 401 reloads through the gate once, and a second before any read succeeded shows the message', () => {
    assert.equal(gateStep(null), 'reload');
    assert.equal(gateStep(String(Date.now())), 'message');
    assert.equal(gateStep(String(Date.now() - 60 * 60 * 1000)), 'message');
    assert.equal(message('unauthenticated'), '다시 로그인하세요.');
  });

  test('the theme is the one chosen, or else the system\'s, and theme.js sets it before the page is drawn', () => {
    const script = readFileSync(new URL('../web/theme.js', import.meta.url), 'utf8');
    for (const [stored, systemDark, expected] of [
      [null, false, 'light'], [null, true, 'dark'], ['light', true, 'light'], ['dark', false, 'dark'], ['blue', true, 'dark'],
    ]) {
      assert.equal(themeOf(stored, systemDark), expected);
      let theme = null;
      runInNewContext(script, {
        window: {
          localStorage: { getItem: (key) => (key === THEME_KEY ? stored : null) },
          matchMedia: (query) => ({ matches: query === '(prefers-color-scheme: dark)' && systemDark }),
        },
        document: { documentElement: { setAttribute: (name, value) => { if (name === 'data-theme') theme = value; } } },
      });
      assert.equal(theme, expected, `${stored} ${systemDark}`);
    }
    // Storage that cannot be read follows the system.
    let theme = null;
    runInNewContext(script, {
      window: { get localStorage() { throw new Error('blocked'); }, matchMedia: () => ({ matches: true }) },
      document: { documentElement: { setAttribute: (name, value) => { theme = value; } } },
    });
    assert.equal(theme, 'dark');
    assert.equal(switchName('light'), '어두운 화면');
    assert.equal(switchName('dark'), '밝은 화면');
  });
});

describe('the shell', () => {
  test('shows the loading state until the reads answer, and no project data before they do', async () => {
    const held = [];
    const answers = (path) => new Promise((resolve) => held.push(() => resolve(FINE[path]())));
    const page = fakePage({ pathname: '/p/reading-club' });
    const restore = page.install();
    const realFetch = globalThis.fetch;
    globalThis.fetch = answers;
    try {
      startShell(page.app, SCREENS['SCR-144'], parseAddress('/p/reading-club'));
      await delay(10);
      assert.equal(held.length, 3);
      assert.ok(page.app.all('span', 'sk').length >= 13);
      assert.deepEqual(texts(page, 'h1'), []);
      assert.equal(page.app.textContent.includes('독서 모임 앱'), false);
      assert.equal(page.app.textContent.includes('reading-club'), false);
      assert.equal(texts(page, 'span', 'proj')[0], '프로젝트');
      for (const release of held) release();
      await waitFor(() => texts(page, 'h1').length === 1);
      assert.deepEqual(texts(page, 'h1'), ['독서 모임 앱']);
      assert.deepEqual(texts(page, 'nav').map((text) => text.split('/')), [['프로젝트', '독서 모임 앱']]);
      assert.equal(texts(page, 'span', 'proj')[0], '독서 모임 앱');
      assert.equal(page.app.all('span', 'sk').length, 0);
      assert.equal(page.document.title, '독서 모임 앱 · NEXUS');
    } finally {
      restore();
      globalThis.fetch = realFetch;
    }
  });

  test('the header holds NEXUS, the project menu, "내 차례 N" and the dark-screen switch', async () => {
    const page = await open('/p/reading-club');
    try {
      const header = headerOf(page);
      assert.equal(header.all('a', 'brand')[0].getAttribute('href'), '/');
      const turn = header.all('a').find((link) => link.textContent.startsWith('내 차례'));
      assert.ok(turn.shown);
      assert.equal(turn.all('span', 'cnt')[0].textContent, '3');
      assert.equal(turn.getAttribute('aria-label'), '내 차례 3개');
      const button = header.all('button').find((each) => each.getAttribute('aria-haspopup') === 'menu');
      const menu = header.all('ul', 'menu')[0];
      assert.deepEqual(menu.all('a').map((link) => [link.textContent, link.getAttribute('href'), link.getAttribute('aria-current')]), [
        ['텃밭 계획표', '/p/garden', null],
        ['독서 모임 앱', '/p/reading-club', 'page'],
        ['프로젝트 목록', '/p', null],
      ]);
      assert.equal(menu.hidden, true);
      button.click();
      assert.equal(menu.hidden, false);
      assert.equal(button.getAttribute('aria-expanded'), 'true');
      assert.equal(page.document.activeElement.textContent, '텃밭 계획표');
      menu.dispatch('keydown', { key: 'ArrowDown' });
      assert.equal(page.document.activeElement.textContent, '독서 모임 앱');
      menu.dispatch('keydown', { key: 'ArrowUp' });
      menu.dispatch('keydown', { key: 'ArrowUp' });
      assert.equal(page.document.activeElement.textContent, '프로젝트 목록');
      menu.dispatch('keydown', { key: 'Escape' });
      assert.equal(menu.hidden, true);
      assert.equal(page.document.activeElement, button);
      button.click();
      page.app.all('h1')[0].click();
      assert.equal(menu.hidden, true);
      assert.equal(button.getAttribute('aria-expanded'), 'false');
    } finally {
      page.close();
    }
  });

  test('a header read that fails leaves its part out, and the rest of the page works', async () => {
    // SCR-144 reads no project list of its own (SCR-142 does, and shows its error when that read fails).
    const page = await open('/p/reading-club', { answers: { ...FINE, '/api/projects': problem(500, 'internal') } });
    try {
      const header = headerOf(page);
      assert.equal(header.all('button').find((each) => each.getAttribute('aria-haspopup') === 'menu').shown, false);
      assert.deepEqual(texts(page, 'h1'), ['독서 모임 앱']);
      assert.equal(errorShown(page), false);
    } finally {
      page.close();
    }
    const other = await open('/p', { answers: { ...FINE, '/api/todo': new Error('no network') } });
    try {
      assert.equal(headerOf(other).all('a').some((link) => link.textContent.startsWith('내 차례') && link.shown), false);
      assert.deepEqual(texts(other, 'h1'), ['프로젝트']);
    } finally {
      other.close();
    }
  });

  test('the dark-screen switch turns the theme and keeps the choice on this browser only', async () => {
    const page = await open('/');
    try {
      const button = headerOf(page).all('button').find((each) => each.getAttribute('aria-label') === '어두운 화면');
      assert.equal(page.document.documentElement.getAttribute('data-theme'), 'light');
      assert.equal(button.all('span', 'theme-label')[0].textContent, '어두운 화면');
      button.click();
      assert.equal(page.document.documentElement.getAttribute('data-theme'), 'dark');
      assert.equal(page.local.getItem(THEME_KEY), 'dark');
      assert.equal(button.getAttribute('aria-label'), '밝은 화면');
      button.click();
      assert.equal(page.document.documentElement.getAttribute('data-theme'), 'light');
      assert.deepEqual([...page.local.entries.keys()], [THEME_KEY]);
    } finally {
      page.close();
    }
  });

  test('a first 401 keeps unsent text and reloads through the gate; a second shows "다시 로그인하세요." with 새로 고침', async () => {
    const denied = { '/api/projects': problem(401, 'unauthenticated'), '/api/todo': problem(401, 'unauthenticated') };
    const first = await open('/', { answers: denied });
    try {
      assert.equal(first.location.reloads, 1);
      assert.ok(first.session.getItem(GATE_KEY) !== null);
      assert.deepEqual(texts(first, 'h1'), ['내 차례']);
    } finally {
      first.close();
    }
    // The page that came back from the gate, still refused.
    const second = await open('/', { answers: denied, session: first.session.entries.size ? Object.fromEntries(first.session.entries) : {} });
    try {
      assert.equal(second.location.reloads, 0);
      assert.deepEqual(texts(second, 'h1'), ['다시 로그인하세요.']);
      assert.deepEqual(texts(second, 'header'), ['NEXUS']);
      const again = second.app.all('button').filter((each) => each.shown);
      assert.deepEqual(again.map((each) => each.textContent), ['새로 고침']);
      again[0].click();
      assert.equal(second.location.reloads, 1);
    } finally {
      second.close();
    }
    // The gate's redirect is a 401 too, and the shell keeps unsent text before it reloads.
    const gated = await open('/p/reading-club', { answers: { '/api/projects': GATE, '/api/todo': GATE, '/api/projects/reading-club': GATE } });
    try {
      assert.equal(gated.location.reloads, 1);
    } finally {
      gated.close();
    }
    let kept = null;
    const page = fakePage({ pathname: '/' });
    const restore = page.install();
    const realFetch = globalThis.fetch;
    let release;
    globalThis.fetch = () => new Promise((resolve) => { release = () => resolve(problem(401, 'unauthenticated')()); });
    try {
      const shell = startShell(page.app, SCREENS['SCR-142'], parseAddress('/'));
      shell.onLeave(() => {
        shell.keepDraft('/#comment', 'an unsent comment');
        kept = shell.draftOf('/#comment');
      });
      release();
      await waitFor(() => page.location.reloads === 1);
      assert.equal(kept, 'an unsent comment');
      assert.equal(page.session.getItem('nexus-draft:/#comment'), 'an unsent comment');
    } finally {
      restore();
      globalThis.fetch = realFetch;
    }
  });

  test('a read that succeeds lets a later 401 reload through the gate again', async () => {
    const page = await open('/', { session: { [GATE_KEY]: String(Date.now()) } });
    try {
      assert.equal(page.session.getItem(GATE_KEY), null);
      assert.deepEqual(texts(page, 'h1'), ['내 차례']);
    } finally {
      page.close();
    }
  });

  test('a 403 shows only its message, and cross_site a reload too', async () => {
    for (const [code, button] of [['not_owner', false], ['owner_only', false], [null, false], ['cross_site', true]]) {
      const refused = problem(403, code);
      const page = await open('/p', { answers: { '/api/projects': refused, '/api/todo': refused } });
      try {
        assert.deepEqual(texts(page, 'h1'), [message(code ?? 'not_owner')], String(code));
        assert.deepEqual(texts(page, 'header'), ['NEXUS']);
        assert.deepEqual(texts(page, 'button'), button ? ['새로 고침'] : []);
        assert.equal(page.location.reloads, 0);
      } finally {
        page.close();
      }
    }
    assert.equal(message('not_owner'), '이 NEXUS의 소유자만 열 수 있어요.');
  });

  test('a failed read shows "문제가 생겼어요. 다시 해 보세요." with a retry and its traceId; the header still works', async () => {
    let fail = true;
    const answers = { ...FINE, '/api/todo': (path) => (fail ? problem(500, 'internal')() : FINE[path]()) };
    const page = await open('/', { answers });
    try {
      assert.ok(errorShown(page));
      assert.deepEqual(texts(page, 'b'), ['문제가 생겼어요. 다시 해 보세요.']);
      assert.deepEqual(texts(page, 'span', 'helper'), [`traceId ${TRACE}`]);
      assert.deepEqual(texts(page, 'h1'), ['내 차례']);
      assert.ok(headerOf(page).all('ul', 'menu')[0].all('a').length === 3);
      fail = false;
      const calls = page.calls.length;
      page.app.all('button').find((each) => each.textContent === '다시 시도').click();
      await page.settle();
      assert.ok(page.calls.length > calls);
      assert.equal(errorShown(page), false);
    } finally {
      page.close();
    }
    const offline = await open('/p/reading-club', { answers: { ...FINE, '/api/projects/reading-club': new TypeError('fetch failed') } });
    try {
      assert.deepEqual(texts(offline, 'b'), ['문제가 생겼어요. 다시 해 보세요.']);
      assert.deepEqual(texts(offline, 'span', 'helper'), []);
    } finally {
      offline.close();
    }
  });

  test('a project that is not in NEXUS says so with a link to the projects', async () => {
    const page = await open('/p/gone', { answers: { ...FINE, '/api/projects/gone': problem(404, 'project_not_found') } });
    try {
      assert.deepEqual(texts(page, 'h1'), ['NEXUS에 없는 프로젝트예요.']);
      assert.deepEqual(texts(page, 'p'), ['지워졌거나 주소가 바뀌었어요.']);
      assert.deepEqual(page.app.all('a', 'btn').map((link) => [link.textContent, link.getAttribute('href')]), [['프로젝트 목록', '/p']]);
    } finally {
      page.close();
    }
    const stage = await open('/p/gone/_/01-domain', { answers: { ...FINE, '/api/projects/gone': problem(404, 'project_not_found') } });
    try {
      assert.deepEqual(texts(stage, 'h1'), ['NEXUS에 없는 프로젝트예요.']);
      assert.deepEqual(texts(stage, 'nav'), []);
    } finally {
      stage.close();
    }
  });

  test('the workbench shows the stage tabs, the place and the diagram, or the stage\'s empty state', async () => {
    const page = await open('/p/reading-club/_/01-domain');
    try {
      const tabs = page.app.all('nav', 'tabs')[0];
      assert.equal(tabs.getAttribute('aria-label'), '단계');
      assert.deepEqual(tabs.all('a').map((tab) => tab.textContent), STAGES.map(({ number, name }) => `${number}${name}`));
      assert.deepEqual(tabs.all('a', 'on').map((tab) => [tab.textContent, tab.getAttribute('aria-current')]), [['01도메인', 'page']]);
      assert.equal(tabs.all('a')[4].getAttribute('href'), '/p/reading-club/_/05-erd');
      assert.deepEqual(texts(page, 'nav', 'crumb'), ['독서 모임 앱/01 도메인']);
      assert.deepEqual(texts(page, 'h1'), ['도메인 보드']);
      assert.equal(page.app.all('aside')[0].getAttribute('aria-label'), '작업 패널');
      assert.equal(texts(page, 'span', 'proj')[0], '독서 모임 앱');
    } finally {
      page.close();
    }
    // A stage with nothing sent: the tab opens it like any other, to SCR-145#empty.
    const empty = await open('/p/reading-club/_/02-prd');
    try {
      assert.deepEqual(texts(empty, 'h1'), ['PRD']);
      assert.deepEqual(texts(empty, 'h2'), ['아직 보낸 것이 없어요.']);
      assert.ok(texts(empty, 'p').includes('에이전트가 다음에 보낼 때 나와요.'));
    } finally {
      empty.close();
    }
    // Without ?d=, the stage's first diagram that is not removed; a removed one opens when ?d= names it.
    const row = PROJECT.stages.find((each) => each.stage === '08-screen-states');
    assert.equal(chosenDiagram(row, null).name, 'SCR-001.md');
    assert.equal(chosenDiagram(row, REMOVED).name, 'SCR-000.md');
  });

  test('an unknown or malformed ?d= reads "NEXUS에 없는 다이어그램이에요." with 프로젝트로, and the tabs still work', async () => {
    for (const [path, search] of [
      ['/p/reading-club/_/01-domain', '?d=dg_0000000000zz'],
      ['/p/reading-club/_/01-domain', '?d=not-a-diagram'],
      ['/p/reading-club/_/01-domain', '?d='],
      ['/p/reading-club/_/05-erd/changes', `?d=${DIAGRAM}`],
    ]) {
      const page = await open(path, { search });
      try {
        assert.deepEqual(texts(page, 'h1'), ['NEXUS에 없는 다이어그램이에요.'], search);
        assert.deepEqual(texts(page, 'p'), ['문서에서 빠졌거나 주소가 바뀌었어요. 작업대의 다른 단계는 그대로 열려요.']);
        assert.deepEqual(page.app.all('a', 'btn').map((link) => [link.textContent, link.getAttribute('href')]), [['프로젝트로', '/p/reading-club']]);
        assert.equal(page.app.all('nav', 'tabs')[0].shown, true);
      } finally {
        page.close();
      }
    }
    const part = await open('/p/reading-club/app/01-domain');
    try {
      assert.deepEqual(texts(part, 'h1'), ['프로젝트에 없는 부분이에요.']);
      assert.equal(part.app.all('nav', 'tabs')[0].shown, false);
    } finally {
      part.close();
    }
  });

  test('a malformed ?thread= reads as a thread that is gone, with 새로 고침 to the diagram', async () => {
    const page = await open('/p/reading-club/_/01-domain', { search: '?thread=bad' });
    try {
      assert.deepEqual(texts(page, 'h1'), ['도메인 보드']);
      const panel = page.app.all('aside')[0];
      // The note, and then the Selected section, here the whole diagram's (TASK-459).
      assert.deepEqual(texts({ app: panel }, 'b'), ['NEXUS에 더 이상 없는 댓글 스레드예요.', '그림 전체']);
      assert.deepEqual(panel.all('a').map((link) => [link.textContent, link.getAttribute('href')]),
        [['새로 고침', `/p/reading-club/_/01-domain?d=${DIAGRAM}`]]);
    } finally {
      page.close();
    }
    const thread = '/api/projects/reading-club/threads/nc_0000000000a1';
    const well = await open('/p/reading-club/_/01-domain', { search: '?thread=nc_0000000000a1', answers: { ...FINE, [thread]: problem(404, 'thread_not_found') } });
    try {
      // A thread's ID is the workbench's to read (TASK-459): the panel holds only its own sections, and no note of the
      // shell's comes before them.
      assert.ok(well.calls.includes(thread));
      assert.deepEqual(well.app.all('aside')[0].children.map((child) => child.tagName), ['SECTION']);
    } finally {
      well.close();
    }
  });

  test('the changes page names its place with the stage\'s diagram', async () => {
    const page = await open('/p/reading-club/_/01-domain/changes', { search: `?d=${DIAGRAM}` });
    try {
      assert.deepEqual(texts(page, 'h1'), ['확정 뒤 바뀐 곳']);
      assert.deepEqual(page.app.all('nav', 'crumb')[0].all('a').map((link) => [link.textContent, link.getAttribute('href')]), [
        ['독서 모임 앱', '/p/reading-club'],
        ['01 도메인', `/p/reading-club/_/01-domain?d=${DIAGRAM}`],
      ]);
      assert.equal(page.app.all('nav', 'tabs').length, 1);
    } finally {
      page.close();
    }
  });

  test('an address that names no screen reads "없는 주소예요." with a link to the to-do', async () => {
    const page = await open('/x');
    try {
      assert.deepEqual(texts(page, 'h1'), ['없는 주소예요.']);
      assert.deepEqual(page.app.all('a', 'btn').map((link) => [link.textContent, link.getAttribute('href')]), [['내 차례', '/']]);
      assert.equal(headerOf(page).all('span', 'cnt')[0].textContent, '3');
    } finally {
      page.close();
    }
  });

  test('stale: the read time shows after five minutes, the tab coming back reads again, and a failed read again keeps the data', async () => {
    let fail = false;
    const answers = { ...FINE, '/api/projects': (path) => (fail ? problem(500, 'internal')() : FINE[path]()) };
    const page = await open('/p', { answers });
    const realNow = Date.now;
    try {
      const tag = () => page.app.all('span', 'tag')[0];
      assert.equal(tag().shown, false);
      const readAt = realNow();
      Date.now = () => readAt + STALE_AFTER_MS + 1000;
      for (const tick of page.ticks) tick();
      Date.now = realNow;
      assert.equal(tag().shown, true);
      assert.equal(tag().textContent, `${clockOf(readAt)}에 읽음`);
      // The tab comes back into view: it reads again, and the new answer replaces the data and the tag.
      const calls = page.calls.length;
      page.document.dispatch('visibilitychange');
      await page.settle();
      assert.ok(page.calls.length > calls);
      assert.equal(tag().shown, false);
      // A read again that fails keeps the data, with the error notice and the read time, and the header keeps its
      // project menu, which the same read fills.
      fail = true;
      page.document.dispatch('visibilitychange');
      await page.settle();
      assert.deepEqual(texts(page, 'h1'), ['프로젝트']);
      assert.ok(errorShown(page));
      assert.equal(tag().shown, true);
      assert.match(tag().textContent, /^\d\d:\d\d에 읽음$/);
      assert.equal(headerOf(page).all('button').find((each) => each.getAttribute('aria-haspopup') === 'menu').shown, true);
      assert.equal(headerOf(page).all('ul', 'menu')[0].all('a').length, 3);
    } finally {
      Date.now = realNow;
      page.close();
    }
  });

  test('a read again that answers what is shown leaves the view as it is, and a changed answer draws it again', async () => {
    let title = '독서 모임 앱';
    const answers = { ...FINE, '/api/projects/reading-club': () => json(200, { ...PROJECT, title })() };
    const page = await open('/p/reading-club', { answers });
    try {
      const shown = page.app.all('h1')[0];
      page.document.dispatch('visibilitychange');
      await page.settle();
      assert.equal(page.app.all('h1')[0], shown);
      title = '바뀐 이름';
      page.document.dispatch('visibilitychange');
      await page.settle();
      assert.notEqual(page.app.all('h1')[0], shown);
      assert.deepEqual(texts(page, 'h1'), ['바뀐 이름']);
    } finally {
      page.close();
    }
  });

  test('a reload asked for while a read runs runs once that read ends, so the newest answer shows', async () => {
    let title = '독서 모임 앱';
    let wait = null;
    const answers = async (path) => {
      if (path !== '/api/projects/reading-club') return FINE[path]();
      const body = { ...PROJECT, title };
      if (wait !== null) await wait;
      return json(200, body)();
    };
    const page = await open('/p/reading-club', { answers });
    try {
      let release;
      wait = new Promise((resolve) => { release = resolve; });
      page.shell.reload();
      await delay(10);
      // A write ends while that read is held, and the screen asks for its data again.
      title = '바뀐 이름';
      page.shell.reload();
      wait = null;
      release();
      await waitFor(() => texts(page, 'h1')[0] === '바뀐 이름');
      await page.settle();
      assert.equal(page.calls.filter((path) => path === '/api/projects/reading-club').length, 3);
      assert.deepEqual(texts(page, 'h1'), ['바뀐 이름']);
    } finally {
      page.close();
    }
  });

  test('a read again that finds the project gone shows it gone, not its old data', async () => {
    let gone = false;
    const answers = { ...FINE, '/api/projects/reading-club': (path) => (gone ? problem(404, 'project_not_found')() : FINE[path]()) };
    const page = await open('/p/reading-club/_/01-domain', { answers });
    try {
      assert.deepEqual(texts(page, 'h1'), ['도메인 보드']);
      gone = true;
      page.document.dispatch('visibilitychange');
      await page.settle();
      assert.deepEqual(texts(page, 'h1'), ['NEXUS에 없는 프로젝트예요.']);
      assert.deepEqual(page.app.all('a', 'btn').map((link) => [link.textContent, link.getAttribute('href')]), [['프로젝트 목록', '/p']]);
      assert.equal(errorShown(page), false);
      assert.equal(page.app.all('nav', 'tabs')[0].shown, false);
    } finally {
      page.close();
    }
  });

  test('where this tab\'s storage is blocked, a 401 shows "다시 로그인하세요." at once and never reloads', async () => {
    const denied = { '/api/projects': problem(401, 'unauthenticated'), '/api/todo': problem(401, 'unauthenticated') };
    const page = await open('/', { answers: denied, blocked: true });
    try {
      assert.equal(page.location.reloads, 0);
      assert.deepEqual(texts(page, 'h1'), ['다시 로그인하세요.']);
      assert.deepEqual(texts(page, 'button'), ['새로 고침']);
    } finally {
      page.close();
    }
  });

  test('a ?d= that a stage listed to the most API-264 lists leaves out is not called gone', async () => {
    assert.equal(LISTED_DIAGRAMS, contract.components.schemas.StageState.properties.diagrams.maxItems);
    const many = Array.from({ length: LISTED_DIAGRAMS }, (_, index) => diagramOf(`dg_${String(index).padStart(12, '0')}`, `flow-${index}.md`));
    const full = { ...PROJECT, stages: PROJECT.stages.map((row) => (row.stage === '03-user-flow' ? { ...row, state: 'open', diagrams: many } : row)) };
    // The workbench reads such a diagram itself (API-265, TASK-458): it opens when the read finds it, and is gone when
    // the read answers diagram_not_found, with 프로젝트로.
    const answers = {
      ...FINE,
      '/api/projects/reading-club': json(200, full),
      [diagramRead('dg_00000000zzzz')]: json(200, diagramBody('dg_00000000zzzz', '03-user-flow', 'user_flow', 'flow-beyond.md')),
      [diagramRead('dg_00000000zzzy')]: problem(404, 'diagram_not_found'),
    };
    const beyond = await open('/p/reading-club/_/03-user-flow', { search: '?d=dg_00000000zzzz', answers });
    try {
      assert.deepEqual(texts(beyond, 'h1'), ['flow-beyond.md']);
    } finally {
      beyond.close();
    }
    const missing = await open('/p/reading-club/_/03-user-flow', { search: '?d=dg_00000000zzzy', answers });
    try {
      assert.deepEqual(texts(missing, 'h1'), ['NEXUS에 없는 다이어그램이에요.']);
      assert.deepEqual(missing.app.all('a', 'btn').map((link) => [link.textContent, link.getAttribute('href')]), [['프로젝트로', '/p/reading-club']]);
    } finally {
      missing.close();
    }
    const malformed = await open('/p/reading-club/_/03-user-flow', { search: '?d=bad', answers });
    try {
      assert.deepEqual(texts(malformed, 'h1'), ['NEXUS에 없는 다이어그램이에요.']);
    } finally {
      malformed.close();
    }
  });

  test('the stale bar of a 409 says what changed, keeps typed text and reads again', async () => {
    const page = await open('/p/reading-club/_/01-domain');
    try {
      const bar = page.shell.staleBar({ text: '문서가 바뀌었어요. 새 버전을 보세요.', kept: '쓰던 댓글은 남아 있어요.' });
      assert.equal(bar.getAttribute('role'), 'alert');
      assert.equal(bar.textContent, '문서가 바뀌었어요. 새 버전을 보세요.쓰던 댓글은 남아 있어요.새로 고침');
      const calls = page.calls.length;
      bar.all('button')[0].click();
      await page.settle();
      assert.ok(page.calls.length > calls);
    } finally {
      page.close();
    }
  });
});

describe('the shell against the server', () => {
  const responses = responseRecord();
  let folder;
  let db;
  let local;
  let good;
  let broken;
  let agent;
  let failing = false;

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-shell-'));
    ({ db } = openStore(folder));
    local = localGate();
    const s = seed(db);
    agent = s.agent;
    const space = s.project('reading-club', { title: '독서 모임 앱' });
    s.diagram(space, { stage: '01-domain', sourceKey: '/pictures/01-domain', kind: 'ddd_board', name: '도메인 보드' });
    const store = new Proxy(db, {
      get(target, name) {
        const value = Reflect.get(target, name, target);
        if (name === 'prepare' && failing) return () => { throw new Error('the store failed'); };
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    good = await startServer({ routes: ROUTES, store: db, gate: local.gate, pages: createPages() });
    broken = await startServer({ routes: ROUTES, store, gate: local.gate });
  });

  after(async () => {
    await good.close();
    await broken.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  // Each response the operation lists: who asks, and what the screen then shows. SCR-143's reads (listProjects and
  // listCredentials) are its parts, tested with the screen in projects-screen.test.js.
  const CASES = [
    { status: 200, who: 'owner', shows: (page, title) => assert.deepEqual(texts(page, 'h1'), [title]) },
    { status: 401, code: 'unauthenticated', who: 'nobody', shows: (page) => assert.deepEqual([texts(page, 'h1'), texts(page, 'button')], [['다시 로그인하세요.'], ['새로 고침']]) },
    { status: 403, code: 'not_owner', who: 'someone', shows: (page) => assert.deepEqual([texts(page, 'h1'), texts(page, 'button')], [['이 NEXUS의 소유자만 열 수 있어요.'], []]) },
    { status: 403, code: 'owner_only', who: 'agent', shows: (page) => assert.deepEqual([texts(page, 'h1'), texts(page, 'button')], [['소유자만 NEXUS에서 할 수 있는 일이에요.'], []]) },
    { status: 404, code: 'project_not_found', who: 'owner', missing: true, shows: (page) => assert.deepEqual(texts(page, 'h1'), ['NEXUS에 없는 프로젝트예요.']) },
    {
      status: 500, code: 'internal', who: 'owner', fails: true,
      shows: (page) => {
        assert.deepEqual(texts(page, 'b'), ['문제가 생겼어요. 다시 해 보세요.']);
        assert.match(texts(page, 'span', 'helper')[0], /^traceId [0-9a-f]{16}$/);
      },
    },
  ];
  const SCREENS_OF = {
    getOwnerTodo: { pathname: '/', path: '/api/todo', title: '내 차례' },
    getProject: { pathname: '/p/reading-club', path: '/api/projects/reading-club', title: '독서 모임 앱', missing: '/p/no-such-project' },
  };

  function headersOf(who) {
    if (who === 'owner') return { 'Cf-Access-Jwt-Assertion': local.token() };
    if (who === 'someone') return { 'Cf-Access-Jwt-Assertion': local.token({ email: 'someone@example.com' }) };
    if (who === 'agent') return agent.headers;
    return {};
  }

  for (const [action, screen] of Object.entries(SCREENS_OF)) {
    test(`every response ${action} lists leads its screen to the state the screen definitions give`, async () => {
      for (const listed of listedResponses(action)) {
        const cases = CASES.filter((each) => (listed.status === 'default' ? each.status === 500 : String(each.status) === listed.status)
          && (listed.codes.length === 0 || listed.codes.includes(each.code)));
        assert.ok(cases.length === Math.max(1, listed.codes.length), `${action} ${listed.status}`);
        for (const each of cases) {
          const target = each.fails ? broken : good;
          const pathname = each.missing ? screen.missing : screen.pathname;
          const path = each.missing ? `/api/projects/${pathname.split('/')[2]}` : screen.path;
          failing = Boolean(each.fails);
          try {
            const answer = responses.note(action, await target.send({ path, headers: headersOf(each.who) }));
            assert.equal(answer.status, each.status, `${action} ${each.status} ${each.code}`);
            // The shell reads through a stand-in for the gate that sends the same sign-in, or none.
            const realFetch = globalThis.fetch;
            const answers = (read) => realFetch(`http://127.0.0.1:${target.port}${read}`, {
              headers: { accept: 'application/json', ...headersOf(each.who) },
              redirect: 'manual',
            });
            const page = await open(pathname, { answers, session: each.status === 401 ? { [GATE_KEY]: String(Date.now()) } : {} });
            try {
              each.shows(page, screen.title);
            } finally {
              page.close();
            }
          } finally {
            failing = false;
          }
        }
      }
      responses.assertEvery(action);
    });
  }

  test('the server\'s own page holds no project data, and its reads answer 401 without a sign-in (SPEC-048)', async () => {
    for (const path of ['/', '/p', '/p/reading-club', '/p/reading-club/_/01-domain']) {
      const answer = await good.send({ path });
      assert.equal(answer.status, 200);
      assert.equal(answer.text.includes('독서 모임 앱'), false);
      assert.equal(answer.text.includes('도메인 보드'), false);
    }
    const realFetch = globalThis.fetch;
    const answers = (read) => realFetch(`http://127.0.0.1:${good.port}${read}`, { headers: { accept: 'application/json' }, redirect: 'manual' });
    const page = await open('/p/reading-club/_/01-domain', { answers, session: { [GATE_KEY]: String(Date.now()) } });
    try {
      assert.deepEqual(texts(page, 'h1'), ['다시 로그인하세요.']);
      assert.equal(page.app.textContent.includes('독서 모임 앱'), false);
      assert.equal(page.app.textContent.includes('도메인 보드'), false);
    } finally {
      page.close();
    }
  });
});
