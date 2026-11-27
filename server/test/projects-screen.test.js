// TASK-456: SCR-143, the projects and the agent credentials (web/projects.js), run in the shell on test/fake-dom.js.
// The first part runs the screen against stubbed answers, state by state; the second against the server, so that every
// response API-262, API-279, API-280 and API-281 list leads the screen to what SCR-143 gives. The operations themselves
// are tested in owner.test.js (API-262) and credentials.test.js (API-279 to API-281). These tests lay nothing out: the
// browser walk of the pull request shows each state at 360 and 1440 px, in light and dark.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { idOf } from '../src/ids.js';
import { createPages } from '../src/pages.js';
import { ROUTES } from '../src/routes.js';
import { openStore } from '../src/store.js';
import { newRequestKey, write } from '../web/api.js';
import { objectParticle } from '../web/korean.js';
import { ago as agoText, clockOf, dayOf, GATE_KEY, STALE_AFTER_MS } from '../web/states.js';
import { fakePage } from './fake-dom.js';
import { listedResponses, responseRecord } from './responses.js';
import { errorShown, json, message, openPage, problem, SCREENS, startShell, texts, TRACE } from './screen-page.js';
import { seed } from './seed.js';
import { exchange, head, localGate, startServer } from './support.js';

const MINUTE = 60_000;
const MiB = 1024 * 1024;
const ago = (minutes) => new Date(Date.now() - minutes * MINUTE - 5000).toISOString();
const NAME_DRAFT = 'nexus-draft:p:credential-name';
const REPEATED = '이 자격은 이미 발급됐어요. 비밀값은 처음 응답에만 있어서 다시 보여 줄 수 없어요. 이 자격을 폐기하고 새로 발급하세요.';
// A secret in the contract's form, for the stubbed answers only.
const SECRET = 'test-secret-shown-once-000000000000000000a';

const summary = (name, title, fields = {}) => ({
  name, title, revision: 3, commit: 'a'.repeat(40), pushed_at: ago(2 * 24 * 60), owner_todo: 0, stages_passed: 0, ...fields,
});
const PROJECTS = {
  projects: [
    summary('reading-club', '독서 모임 앱', { revision: 66, pushed_at: ago(12), owner_todo: 4, stages_passed: 7 }),
    summary('demo', 'demo', { stages_passed: 1 }),
    summary('new-space', 'new-space', { revision: null, commit: null, pushed_at: null }),
  ],
  backup: null,
};
const credential = (n, name, fields = {}) => ({
  id: idOf('ac', n), name, issued_at: '2026-11-20T03:00:00.000Z', revoked_at: null, last_used_at: null, ...fields,
});
const CI = credential(3, 'ci', { issued_at: '2026-11-21T03:00:00.000Z', last_used_at: ago(12) });
const LAPTOP = credential(2, 'laptop');
const OLD = credential(1, 'old-laptop', {
  issued_at: '2026-11-02T03:00:00.000Z', last_used_at: '2026-11-10T03:00:00.000Z', revoked_at: '2026-11-12T00:30:00.000Z',
});
const CREDENTIALS = { credentials: [CI, LAPTOP, OLD] };
const NEW = credential(4, 'laptop-2', { issued_at: new Date().toISOString() });
const FINE = { '/api/projects': json(200, PROJECTS), '/api/todo': json(200, { entries: [], backup: null }), '/api/credentials': json(200, CREDENTIALS) };
const REVOKE = (id) => `/api/credentials/${id}/revoke`;

// The answers of a page: each read by its path from reads, else FINE; each write by its path from writes, its
// requests kept in sent as { method, path, key, type, body }.
function answering({ reads = {}, writes = {} } = {}) {
  const sent = [];
  const answer = (path, init = {}) => {
    if ((init.method ?? 'GET') !== 'GET') {
      sent.push({
        method: init.method, path, key: init.headers['idempotency-key'], type: init.headers['content-type'],
        body: init.body === undefined ? undefined : JSON.parse(init.body),
      });
      const made = writes[path];
      if (made === undefined) throw new Error(`no write answer for ${path}`);
      return made(path, init);
    }
    const made = reads[path] ?? FINE[path];
    if (made === undefined) throw new Error(`no answer for ${path}`);
    return made(path, init);
  };
  return { answer, sent };
}

const open = (options = {}) => {
  const { answer, sent } = answering(options);
  return openPage('/p', { answers: answer, search: options.search ?? '', session: options.session ?? {} }).then((page) => Object.assign(page, { sent }));
};
const byId = (page, id) => page.app.descendants().find((element) => element.getAttribute('id') === id) ?? null;
const button = (page, text, within = page.app) => within.all('button').find((element) => element.textContent === text && element.shown);
const tables = (page) => page.app.all('table');
const cells = (row) => row.all('td').map((cell) => cell.textContent);
const cards = (page) => page.app.all('div', 'card');
const panel = (page) => page.app.all('section', 'panel')[0] ?? null;
const timeout = () => Object.assign(new Error('timed out'), { name: 'TimeoutError' });

function typeName(page, text) {
  const field = byId(page, 'credential-name');
  field.value = text;
  field.dispatch('input');
}

async function issue(page, name) {
  typeName(page, name);
  button(page, '발급').click();
  await page.settle();
  await page.settle();
}

// Asks to revoke the credential in its table row, and answers the question with 폐기.
async function revoke(page, id) {
  const row = page.app.all('tr').find((each) => each.all('td').some((cell) => cell.getAttribute('id') === `credential-t-${id}`));
  button(page, '폐기', row).click();
  await page.settle();
  const asked = page.app.all('tr').find((each) => each.all('td').some((cell) => cell.getAttribute('id') === `credential-t-${id}`));
  button(page, '폐기', asked).click();
  await page.settle();
  await page.settle();
}

// The clipboard of the page, which takes what is copied or refuses it.
function clipboard({ refuse = false } = {}) {
  const copied = [];
  const before = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (text) => { if (refuse) throw new Error('refused'); copied.push(text); } },
  });
  return {
    copied,
    restore: () => (before === undefined ? delete globalThis.navigator.clipboard : Object.defineProperty(globalThis.navigator, 'clipboard', before)),
  };
}

// The page's history, which records each address it is given.
function history() {
  const given = [];
  globalThis.history = { state: null, replaceState: (state, unused, url) => given.push(url) };
  return { given, restore: () => delete globalThis.history };
}

describe('the projects and the credentials (SCR-143)', () => {
  test('normal at 1440 px: projects in API-262\'s order with their stages passed, to-do and last send; credentials in API-279\'s', async () => {
    const page = await open();
    try {
      assert.deepEqual(texts(page, 'h1'), ['프로젝트']);
      const [projects, credentials] = tables(page);
      assert.deepEqual(projects.all('th').map((cell) => cell.textContent), ['프로젝트', '진행', '할 일', '마지막으로 보낸 때']);
      const rows = projects.all('tbody')[0].all('tr');
      assert.deepEqual(cells(rows[0]), ['독서 모임 앱 reading-club', '13단계 중 7 통과', '할 일 4', '리비전 66 · 12분 전']);
      assert.deepEqual(cells(rows[1]), ['demo demo', '13단계 중 1 통과', '할 일 0', `리비전 3 · ${agoText(PROJECTS.projects[1].pushed_at, Date.now())}`]);
      // A space that holds no snapshot yet has no revision or send time.
      assert.deepEqual(cells(rows[2]), ['new-space new-space', '13단계 중 0 통과', '할 일 0', '']);
      assert.deepEqual(rows.map((row) => row.all('a')[0].getAttribute('href')), ['/p/reading-club', '/p/demo', '/p/new-space']);
      assert.deepEqual(rows.map((row) => row.all('span', 'bar')[0].getAttribute('data-passed')), ['7', '1', '0']);
      assert.deepEqual(rows.map((row) => row.all('span', 'tag')[0].className), ['tag blue', 'tag gray', 'tag gray']);
      assert.equal(projects.className, 'tb wide-only');
      // Credentials: live first, then revoked, each newest first, as API-279 answers (not the mockup's sample order).
      assert.deepEqual(credentials.all('th').map((cell) => cell.textContent), ['이름', '발급', '마지막으로 씀', '']);
      const lines = credentials.all('tbody')[0].all('tr');
      assert.deepEqual(cells(lines[0]), ['ci', '11월 21일', '12분 전', '폐기']);
      assert.deepEqual(cells(lines[1]), ['laptop', '11월 20일', '아직 안 씀', '폐기']);
      assert.deepEqual(cells(lines[2]), ['old-laptop', '11월 2일', '11월 10일', `폐기됨 ${dayOf(OLD.revoked_at)} ${clockOf(OLD.revoked_at)}`]);
      assert.deepEqual(lines.map((row) => row.className), ['', '', 'off']);
      // Each 폐기 is named with its credential's name, which the row shows: names, not IDs (SPEC-010).
      const revokeButton = lines[0].all('button')[0];
      assert.equal(revokeButton.getAttribute('aria-labelledby'), `credential-t-${CI.id}-revoke credential-t-${CI.id}`);
      assert.equal(page.app.textContent.includes('ac_'), false);
      // The issue form and the phone's note: CSS shows one of them (nexus.css, data-pc-only and data-phone-only).
      const form = page.app.all('div', 'form')[0].parent;
      assert.equal(form.getAttribute('data-pc-only'), '');
      assert.deepEqual(texts(page, 'label'), ['새 자격 이름']);
      assert.equal(byId(page, 'credential-name').getAttribute('placeholder'), '예: laptop');
      assert.equal(byId(page, 'credential-name').getAttribute('maxlength'), null);
      const note = page.app.all('div', 'info')[0];
      assert.equal(note.getAttribute('data-phone-only'), '');
      assert.equal(note.textContent, '자격 발급과 폐기는 PC에서 하세요.');
      assert.equal(errorShown(page), false);
    } finally {
      page.close();
    }
  });

  test('normal at 360 px: the projects as rows and the credentials as cards, as the mockup\'s frames', async () => {
    const page = await open();
    try {
      const list = page.app.all('div', 'list')[0];
      assert.equal(list.className, 'list narrow-only');
      assert.deepEqual(list.all('a').map((row) => [row.getAttribute('href'), row.textContent]), [
        ['/p/reading-club', '독서 모임 앱13단계 중 7 통과 · 리비전 66 · 12분 전할 일 4'],
        ['/p/demo', `demo13단계 중 1 통과 · 리비전 3 · ${agoText(PROJECTS.projects[1].pushed_at, Date.now())}할 일 0`],
        ['/p/new-space', 'new-space13단계 중 0 통과할 일 0'],
      ]);
      assert.equal(page.app.all('div', 'cards')[0].className, 'cards narrow-only');
      assert.deepEqual(cards(page).map((card) => card.textContent), [
        'ci폐기발급 11월 21일 · 마지막으로 씀 12분 전',
        'laptop폐기발급 11월 20일 · 마지막으로 씀 아직 안 씀',
        `old-laptop폐기됨 ${dayOf(OLD.revoked_at)} ${clockOf(OLD.revoked_at)}발급 11월 2일 · 마지막으로 씀 11월 10일`,
      ]);
      // A phone hides each 폐기 (data-pc-only); a narrow PC window keeps it.
      assert.ok(cards(page).slice(0, 2).every((card) => card.all('button')[0].getAttribute('data-pc-only') === ''));
    } finally {
      page.close();
    }
  });

  test('loading: grey rows for both, the issue form off, and no data before the reads answer', async () => {
    const page = fakePage({ pathname: '/p' });
    const restore = page.install();
    const realFetch = globalThis.fetch;
    // The screen's reads never answer; the header's to-do count does.
    globalThis.fetch = (path) => (path === '/api/todo' ? Promise.resolve(FINE[path]()) : new Promise(() => {}));
    try {
      startShell(page.app, SCREENS['SCR-143'], { screen: 'SCR-143' });
      assert.deepEqual(page.app.all('h1').map((each) => each.textContent), ['프로젝트']);
      assert.equal(page.app.all('span', 'sk').length, 4);
      assert.equal(byId(page, 'credential-name').getAttribute('disabled'), '');
      assert.equal(page.app.all('button').find((each) => each.textContent === '발급').getAttribute('disabled'), '');
      assert.equal(page.app.all('h2').map((each) => each.textContent).join(), '에이전트 자격');
      assert.equal(page.app.all('div', 'info')[0].getAttribute('data-phone-only'), '');
      assert.equal(page.app.textContent.includes('독서 모임 앱'), false);
      assert.equal(page.app.textContent.includes('laptop'), false);
    } finally {
      globalThis.fetch = realFetch;
      restore();
    }
  });

  test('empty: no project says how one comes, and no credential says no agent can send yet', async () => {
    const page = await open({ reads: { '/api/projects': json(200, { projects: [], backup: null }), '/api/credentials': json(200, { credentials: [] }) } });
    try {
      assert.deepEqual(page.app.all('div', 'empty').map((each) => each.textContent), [
        '아직 프로젝트가 없어요에이전트가 처음 보내면 여기에 나와요. 아래에서 자격을 발급해 hub에 설정하고 --first로 보내세요.',
        '아직 보낼 수 있는 에이전트가 없어요.',
      ]);
      assert.deepEqual(tables(page), []);
      assert.ok(button(page, '발급'));
    } finally {
      page.close();
    }
  });

  test('error: each table\'s read fails in its own place, with a retry and its traceId, and the other still shows', async () => {
    let fail = true;
    const failing = (path) => (fail ? problem(500, 'internal')() : FINE[path]());
    const page = await open({ reads: { '/api/projects': failing } });
    try {
      assert.deepEqual(page.app.all('div', 'err').map((each) => each.textContent), ['프로젝트를 읽지 못했어요.다시 시도']);
      assert.deepEqual(texts(page, 'span', 'helper'), [`traceId ${TRACE}`]);
      // The credentials still show, and so does the issue form; the header's project menu stays out.
      assert.equal(tables(page).length, 1);
      assert.deepEqual(cells(tables(page)[0].all('tr')[1]).slice(0, 2), ['ci', '11월 21일']);
      assert.ok(button(page, '발급'));
      fail = false;
      button(page, '다시 시도').click();
      await page.settle();
      assert.equal(errorShown(page), false);
      assert.equal(tables(page).length, 2);
    } finally {
      page.close();
    }
    const other = await open({ reads: { '/api/credentials': () => new TypeError('fetch failed') } });
    try {
      assert.deepEqual(other.app.all('div', 'err').map((each) => each.textContent), ['에이전트 자격을 읽지 못했어요.다시 시도']);
      // No answer came, so there is no traceId.
      assert.deepEqual(texts(other, 'span', 'helper').filter((text) => text.startsWith('traceId')), []);
      assert.equal(tables(other).length, 1);
      assert.deepEqual(cells(tables(other)[0].all('tr')[1]).slice(0, 2), ['독서 모임 앱 reading-club', '13단계 중 7 통과']);
    } finally {
      other.close();
    }
  });

  test('stale: a table whose read again fails keeps its rows with the failure, and the read time shows', async () => {
    let fail = false;
    const nativeNow = Date.now;
    const firstRead = Date.parse('2026-11-27T16:01:59.000Z');
    const realNow = () => firstRead + MINUTE;
    let page;
    try {
      Date.now = () => firstRead;
      page = await open({ reads: { '/api/credentials': (path) => (fail ? problem(500, 'internal')() : FINE[path]()) } });
      Date.now = realNow;
      const tag = () => page.app.all('span', 'tag').find((each) => each.parent.className === 'row');
      assert.equal(tag().shown, false);
      const readAt = firstRead;
      Date.now = () => readAt + STALE_AFTER_MS + 1000;
      for (const tick of page.ticks) tick();
      Date.now = realNow;
      assert.equal(tag().textContent, `${clockOf(readAt)}에 읽음`);
      fail = true;
      page.document.dispatch('visibilitychange');
      await page.settle();
      assert.deepEqual(page.app.all('div', 'err').map((each) => each.textContent), ['에이전트 자격을 읽지 못했어요.다시 시도']);
      assert.equal(tables(page).length, 2);
      assert.deepEqual(cells(tables(page)[1].all('tr')[1]).slice(0, 1), ['ci']);
      assert.equal(tag().shown, true);
      assert.equal(tag().textContent, `${clockOf(readAt)}에 읽음`);
      fail = false;
      page.document.dispatch('visibilitychange');
      await page.settle();
      assert.equal(errorShown(page), false);
      assert.equal(tag().shown, false);
      Date.now = () => realNow() + STALE_AFTER_MS + 1000;
      for (const tick of page.ticks) tick();
      assert.equal(tag().textContent, `${clockOf(realNow())}에 읽음`);
    } finally {
      Date.now = nativeNow;
      page?.close();
    }
  });

  test('secret: a 201 shows the secret once with 복사 and the hub\'s setting, and keeps it nowhere but this page', async () => {
    const said = [];
    const kept = {};
    for (const name of ['log', 'info', 'warn', 'error', 'debug']) {
      kept[name] = console[name];
      console[name] = (...args) => said.push(args.join(' '));
    }
    const board = clipboard();
    const where = history();
    let issued = false;
    const page = await open({
      reads: { '/api/credentials': () => json(200, { credentials: issued ? [NEW, ...CREDENTIALS.credentials] : CREDENTIALS.credentials })() },
      writes: { '/api/credentials': () => { issued = true; return json(201, { credential: NEW, secret: SECRET })(); } },
    });
    try {
      const reads = page.calls.filter((path) => path === '/api/credentials').length;
      await issue(page, 'laptop-2');
      assert.deepEqual(page.sent.map(({ method, path, type, body }) => [method, path, type, body]), [['POST', '/api/credentials', 'application/json', { name: 'laptop-2' }]]);
      assert.match(page.sent[0].key, /^"nw_[0-9a-hjkmnp-tv-z]{12}"$/);
      const shown = panel(page);
      assert.deepEqual(shown.all('h2').map((each) => each.textContent), ['새 자격 laptop-2']);
      assert.deepEqual(shown.all('span', 'tag').map((each) => each.textContent), ['지금만 보여요']);
      assert.equal(shown.all('p')[0].textContent, '비밀값은 지금만 보여요. 이 페이지를 떠나거나 새로 고치면 다시 볼 수 없어요.');
      assert.deepEqual(shown.all('label').map((each) => each.textContent), ['Client ID', 'Client secret']);
      assert.deepEqual(shown.all('input').map((each) => [each.getAttribute('value'), each.getAttribute('readonly')]), [[NEW.id, ''], [SECRET, '']]);
      assert.equal(shown.all('p')[1].textContent,
        'hub가 도는 기기의 환경 변수 CORTHEX_NEXUS_CLIENT_ID와 CORTHEX_NEXUS_CLIENT_SECRET에 넣으세요. 파일이나 명령줄에는 넣지 마세요.');
      // The panel takes the focus, the name field is empty again, and the list was read again with the new one.
      assert.equal(page.document.activeElement, byId(page, 'issued-heading'));
      assert.equal(byId(page, 'credential-name').getAttribute('value'), '');
      assert.ok(page.calls.filter((path) => path === '/api/credentials').length > reads);
      assert.deepEqual(cells(tables(page)[1].all('tr')[1]).slice(0, 1), ['laptop-2']);
      // 복사 puts each value on the clipboard and says so by its own button until the next copy.
      button(page, '복사', panel(page).all('div', 'form')[1]).click();
      await page.settle();
      assert.deepEqual(board.copied, [SECRET]);
      const statuses = () => panel(page).all('span', 'small').map((each) => each.textContent);
      assert.deepEqual(statuses(), ['', '복사했어요']);
      button(page, '복사', panel(page).all('div', 'form')[0]).click();
      await page.settle();
      assert.deepEqual(board.copied, [SECRET, NEW.id]);
      assert.deepEqual(statuses(), ['복사했어요', '']);
      // A read again keeps the panel; the secret never went to a browser store, the console, a log or the address.
      page.document.dispatch('visibilitychange');
      await page.settle();
      assert.equal(panel(page).all('input')[1].getAttribute('value'), SECRET);
      const stored = [...page.session.entries.values(), ...page.local.entries.values()].join('\n');
      assert.equal(stored.includes(SECRET), false);
      assert.equal(said.join('\n').includes(SECRET), false);
      assert.equal(`${page.location.pathname}${page.location.search}`.includes(SECRET), false);
      assert.deepEqual(where.given, []);
    } finally {
      page.close();
      board.restore();
      where.restore();
      Object.assign(console, kept);
    }
    // Opened again, as after leaving or reloading, the page never shows it: it never asks for it.
    const again = await open({ reads: { '/api/credentials': json(200, { credentials: [NEW, ...CREDENTIALS.credentials] }) } });
    try {
      assert.equal(panel(again), null);
      assert.equal(again.app.textContent.includes(SECRET), false);
      assert.equal(again.app.descendants().some((each) => each.getAttribute('value') === SECRET), false);
      assert.deepEqual(again.calls.filter((path) => path.startsWith('/api/credentials')), ['/api/credentials']);
    } finally {
      again.close();
    }
  });

  test('a refused clipboard shows the value selected for the owner to copy (SPEC-011, as SCR-145)', async () => {
    const board = clipboard({ refuse: true });
    const page = await open({ writes: { '/api/credentials': json(201, { credential: NEW, secret: SECRET }) } });
    try {
      await issue(page, 'laptop-2');
      button(page, '복사', panel(page).all('div', 'form')[1]).click();
      await page.settle();
      assert.equal(page.document.activeElement, byId(page, 'issued-secret'));
      assert.deepEqual(panel(page).all('span', 'small').map((each) => each.textContent), ['', '']);
    } finally {
      page.close();
      board.restore();
    }
  });

  test('a refused clipboard selects the field the page shows now, after a draw while it answered', async () => {
    let refuse;
    const before = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => new Promise((resolve, reject) => { refuse = () => reject(new Error('refused')); }) },
    });
    const page = await open({ writes: { '/api/credentials': json(201, { credential: NEW, secret: SECRET }) } });
    try {
      await issue(page, 'laptop-2');
      const clicked = byId(page, 'issued-secret');
      button(page, '복사', panel(page).all('div', 'form')[1]).click();
      // A question in a row draws the page again while the clipboard has not answered.
      button(page, '폐기', tables(page)[1].all('tr')[1]).click();
      await page.settle();
      assert.notEqual(byId(page, 'issued-secret'), clicked);
      refuse();
      await page.settle();
      assert.equal(page.document.activeElement, byId(page, 'issued-secret'));
    } finally {
      page.close();
      if (before === undefined) delete globalThis.navigator.clipboard;
      else Object.defineProperty(globalThis.navigator, 'clipboard', before);
    }
  });

  test('another issue replaces the secret, and revoking its credential here takes it away', async () => {
    const second = credential(5, 'desk', { issued_at: new Date().toISOString() });
    let revoked = false;
    const listed = () => (revoked ? [{ ...second, revoked_at: new Date().toISOString() }] : [second]);
    const page = await open({
      reads: { '/api/credentials': () => json(200, { credentials: [...listed(), NEW] })() },
      writes: {
        '/api/credentials': (path, init) => (JSON.parse(init.body).name === 'laptop-2'
          ? json(201, { credential: NEW, secret: SECRET })()
          : json(201, { credential: second, secret: `${SECRET.slice(0, 42)}b` })()),
        [REVOKE(second.id)]: () => { revoked = true; return json(200, { credential: { ...second, revoked_at: new Date().toISOString() }, changed: true, claims_released: 0 })(); },
      },
    });
    try {
      await issue(page, 'laptop-2');
      await issue(page, 'desk');
      assert.deepEqual(panel(page).all('h2').map((each) => each.textContent), ['새 자격 desk']);
      assert.equal(page.app.descendants().some((each) => each.getAttribute('value') === SECRET), false);
      await revoke(page, second.id);
      assert.equal(panel(page), null);
    } finally {
      page.close();
    }
  });

  test('a repeated issue (200) shows the same credential without its secret, and says to revoke it and issue another', async () => {
    const page = await open({ writes: { '/api/credentials': json(200, { credential: NEW, secret: null }) } });
    try {
      await issue(page, 'laptop-2');
      const shown = panel(page);
      assert.deepEqual(shown.all('h2').map((each) => each.textContent), ['새 자격 laptop-2']);
      assert.deepEqual(shown.all('span', 'tag'), []);
      assert.deepEqual(shown.all('label').map((each) => each.textContent), ['Client ID']);
      assert.deepEqual(shown.all('p').map((each) => each.textContent), [REPEATED]);
    } finally {
      page.close();
    }
  });

  test('a refused issue shows its message by the name, which stays, and the request key follows docs/08-screens', async () => {
    let answer = () => timeout();
    const page = await open({ writes: { '/api/credentials': () => answer() } });
    try {
      // No answer: the message by the name, which is not marked wrong, and the same key once more for the same name.
      await issue(page, 'ci');
      const field = () => byId(page, 'credential-name');
      assert.equal(field().getAttribute('value'), 'ci');
      assert.equal(field().getAttribute('aria-invalid'), null);
      assert.equal(field().className, 'field');
      assert.equal(field().getAttribute('aria-describedby'), 'credential-name-refused');
      assert.equal(byId(page, 'credential-name-refused').textContent, '문제가 생겼어요. 다시 해 보세요.');
      assert.equal(page.document.activeElement, field());
      assert.equal(page.session.getItem(NAME_DRAFT), 'ci');
      answer = problem(409, 'name_taken');
      button(page, '발급').click();
      await page.settle();
      assert.equal(page.sent[1].key, page.sent[0].key);
      assert.equal(byId(page, 'credential-name-refused').textContent, '다른 이름을 고르세요.');
      // Not a p, which the shell's `.nx p{margin:0}` would pull up against the field.
      assert.equal(byId(page, 'credential-name-refused').tagName, 'DIV');
      assert.equal(field().getAttribute('value'), 'ci');
      // The server refused the name: it is marked.
      assert.equal(field().getAttribute('aria-invalid'), 'true');
      assert.equal(field().className, 'field bad');
      // After an answer, a new key; and a new one when the name changes.
      button(page, '발급').click();
      await page.settle();
      assert.notEqual(page.sent[2].key, page.sent[1].key);
      answer = () => timeout();
      button(page, '발급').click();
      await page.settle();
      typeName(page, 'ci-2');
      button(page, '발급').click();
      await page.settle();
      assert.notEqual(page.sent[4].key, page.sent[3].key);
      // The input errors of docs/08-screens section 3 mark the name; the others say so by it.
      for (const [made, text, trace, marked] of [
        [problem(400, 'invalid_request'), '표시한 입력을 확인하세요.', true, true],
        [problem(409, 'request_key_reused'), '새 요청으로 다시 보내세요.', true, true],
        [problem(413, 'body_too_large'), '한 번에 보내는 양을 줄이세요.', true, true],
        [problem(415, 'json_required'), '본문을 JSON으로 보내세요.', true, false],
        [problem(500, 'internal'), '문제가 생겼어요. 다시 해 보세요.', true, false],
        [() => new TypeError('fetch failed'), '문제가 생겼어요. 다시 해 보세요.', false, false],
      ]) {
        answer = made;
        button(page, '발급').click();
        await page.settle();
        assert.equal(byId(page, 'credential-name-refused').textContent, text);
        assert.equal(field().getAttribute('value'), 'ci-2');
        assert.equal(texts(page, 'span', 'helper').includes(`traceId ${TRACE}`), trace, text);
        assert.equal(field().getAttribute('aria-invalid'), marked ? 'true' : null, text);
      }
    } finally {
      page.close();
    }
  });

  test('issuing and revoking are off while they run, and one result shows', async () => {
    let finish;
    const page = await open({ writes: { '/api/credentials': () => new Promise((resolve) => { finish = () => resolve(json(201, { credential: NEW, secret: SECRET })()); }) } });
    try {
      typeName(page, 'laptop-2');
      button(page, '발급').click();
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(page.app.all('button').find((each) => each.textContent === '발급').getAttribute('disabled'), '');
      assert.equal(byId(page, 'credential-name').getAttribute('disabled'), '');
      assert.ok(tables(page)[1].all('button').every((each) => each.getAttribute('disabled') === ''));
      page.app.all('button').find((each) => each.textContent === '발급').click();
      finish();
      await page.settle();
      await page.settle();
      assert.equal(page.sent.length, 1);
      assert.equal(page.app.all('section', 'panel').length, 1);
      assert.equal(byId(page, 'credential-name').getAttribute('disabled'), null);
    } finally {
      page.close();
    }
  });

  test('발급 is off while a revoke runs, and Enter in the name sends nothing', async () => {
    let finish;
    const page = await open({
      writes: {
        [REVOKE(CI.id)]: () => new Promise((resolve) => { finish = () => resolve(json(200, { credential: { ...CI, revoked_at: new Date().toISOString() }, changed: true, claims_released: 0 })()); }),
        '/api/credentials': json(201, { credential: NEW, secret: SECRET }),
      },
    });
    try {
      const row = () => tables(page)[1].all('tr')[1];
      button(page, '폐기', row()).click();
      await page.settle();
      button(page, '폐기', row()).click();
      await new Promise((resolve) => setImmediate(resolve));
      // While it runs, the focus waits on the credentials' heading, whose row buttons are off.
      assert.equal(page.document.activeElement, byId(page, 'credentials-heading'));
      assert.equal(byId(page, 'credentials-heading').getAttribute('tabindex'), '-1');
      assert.equal(page.app.all('button').find((each) => each.textContent === '발급').getAttribute('disabled'), '');
      assert.equal(byId(page, 'credential-name').getAttribute('disabled'), null);
      typeName(page, 'laptop-2');
      byId(page, 'credential-name').dispatch('keydown', { key: 'Enter' });
      page.app.all('button').find((each) => each.textContent === '발급').click();
      finish();
      await page.settle();
      await page.settle();
      assert.deepEqual(page.sent.map(({ path }) => path), [REVOKE(CI.id)]);
      assert.equal(page.app.all('button').find((each) => each.textContent === '발급').getAttribute('disabled'), null);
      assert.equal(page.document.activeElement, byId(page, 'credentials-heading'));
    } finally {
      page.close();
    }
  });

  test('a revoke asks once in its row, with 취소 focused; 취소 and Escape put 폐기 back', async () => {
    const page = await open({ writes: {} });
    try {
      const row = () => tables(page)[1].all('tr')[1];
      button(page, '폐기', row()).click();
      await page.settle();
      assert.deepEqual(row().all('td')[3].textContent, '폐기할까요?폐기취소');
      const asking = row().all('span', 'ask')[0];
      assert.equal(asking.getAttribute('role'), 'group');
      assert.equal(asking.getAttribute('data-pc-only'), '');
      assert.equal(page.document.activeElement, button(page, '취소', row()));
      assert.equal(button(page, '폐기', row()).className, 'btn danger sm');
      // One row asks at a time; the card of the same credential asks too, for a narrow window.
      assert.equal(tables(page)[1].all('span', 'ask').length, 1);
      assert.equal(cards(page)[0].all('span', 'ask').length, 1);
      button(page, '취소', row()).click();
      await page.settle();
      assert.equal(row().all('td')[3].textContent, '폐기');
      assert.equal(page.document.activeElement, row().all('button')[0]);
      button(page, '폐기', row()).click();
      await page.settle();
      button(page, '취소', row()).dispatch('keydown', { key: 'Escape' });
      await page.settle();
      assert.equal(row().all('td')[3].textContent, '폐기');
      assert.deepEqual(page.sent, []);
    } finally {
      page.close();
    }
  });

  test('a revoke that answers 200 reads the list again, and the row shows "폐기됨" with the time', async () => {
    const at = new Date().toISOString();
    let revoked = false;
    const page = await open({
      reads: { '/api/credentials': () => json(200, { credentials: revoked ? [{ ...CI, revoked_at: at }, LAPTOP, OLD] : CREDENTIALS.credentials })() },
      writes: { [REVOKE(CI.id)]: () => { revoked = true; return json(200, { credential: { ...CI, revoked_at: at }, changed: true, claims_released: 1 })(); } },
    });
    try {
      await revoke(page, CI.id);
      assert.deepEqual(page.sent.map(({ method, path, type, body }) => [method, path, type, body]), [['POST', REVOKE(CI.id), 'application/json', {}]]);
      assert.match(page.sent[0].key, /^"nw_[0-9a-hjkmnp-tv-z]{12}"$/);
      const row = tables(page)[1].all('tr')[1];
      assert.equal(row.className, 'off');
      assert.deepEqual(cells(row), ['ci', '11월 21일', dayOf(CI.last_used_at), `폐기됨 ${dayOf(at)} ${clockOf(at)}`]);
      assert.equal(errorShown(page), false);
      // The row's buttons are gone, so the focus stays on the credentials' heading, not on the page's body.
      assert.equal(page.document.activeElement, byId(page, 'credentials-heading'));
    } finally {
      page.close();
    }
  });

  test('a refused revoke says why above the credentials; one gone meanwhile reads the list again', async () => {
    let answer = problem(404, 'credential_not_found');
    const page = await open({ writes: { [REVOKE(CI.id)]: () => answer() } });
    try {
      const reads = page.calls.filter((path) => path === '/api/credentials').length;
      await revoke(page, CI.id);
      assert.deepEqual(page.app.all('div', 'err').map((each) => each.textContent), ['NEXUS에 없는 자격 증명이에요.']);
      assert.equal(page.document.activeElement, byId(page, 'credentials-heading'));
      assert.ok(page.calls.filter((path) => path === '/api/credentials').length > reads);
      for (const [made, text] of [
        [problem(400, 'invalid_request'), '표시한 입력을 확인하세요.'],
        [problem(409, 'request_key_reused'), '새 요청으로 다시 보내세요.'],
        [problem(413, 'body_too_large'), '한 번에 보내는 양을 줄이세요.'],
        [problem(415, 'json_required'), '본문을 JSON으로 보내세요.'],
        [problem(500, 'internal'), '문제가 생겼어요. 다시 해 보세요.'],
      ]) {
        answer = made;
        await revoke(page, CI.id);
        assert.deepEqual(page.app.all('div', 'err').map((each) => each.textContent), [text]);
        assert.ok(texts(page, 'span', 'helper').includes(`traceId ${TRACE}`), text);
        // Each answer ends its key.
        assert.notEqual(page.sent.at(-1).key, page.sent.at(-2).key);
        assert.equal(page.document.activeElement, byId(page, `credential-t-${CI.id}-revoke`), text);
      }
      // No answer keeps the key for the same credential's retry.
      answer = () => timeout();
      await revoke(page, CI.id);
      await revoke(page, CI.id);
      assert.equal(page.sent.at(-1).key, page.sent.at(-2).key);
      assert.deepEqual(page.app.all('div', 'err').map((each) => each.textContent), ['문제가 생겼어요. 다시 해 보세요.']);
    } finally {
      page.close();
    }
  });

  test('after a deletion on SCR-144, "{project}를 지웠어요" shows once on top, only for a project no longer listed', async () => {
    const where = history();
    try {
      await deletedOnce(where);
    } finally {
      where.restore();
    }
  });

  async function deletedOnce(where) {
    const page = await open({ search: '?deleted=old-notes' });
    try {
      const notice = page.app.all('div', 'ok')[0];
      assert.equal(notice.textContent, 'old-notes를 지웠어요');
      assert.equal(notice.getAttribute('role'), 'status');
      // On top: right under the title.
      assert.equal(page.app.all('main')[0].children[1], notice);
      assert.deepEqual(where.given, ['/p']);
      // It stays while the page is drawn again; the address no longer holds it, so a reload does not say it.
      page.document.dispatch('visibilitychange');
      await page.settle();
      assert.equal(page.app.all('div', 'ok').length, 1);
    } finally {
      page.close();
    }
    for (const search of ['?deleted=demo', '?deleted=Bad%20Name', '']) {
      const other = await open({ search });
      try {
        assert.deepEqual(other.app.all('div', 'ok'), [], search);
      } finally {
        other.close();
      }
    }
    assert.deepEqual(where.given, ['/p', '/p', '/p']);
  }

  // test/project-screen.test.js (TASK-457) checks the rest of the shared rule.
  test('the object particle reads a final ck as one k, as Korean reads stack', () => {
    for (const name of ['stack', 'feedback', 'track', 'deck', 'old-stack']) assert.equal(objectParticle(name), '을', name);
    for (const name of ['desk', 'chart', 'ck']) assert.equal(objectParticle(name), '를', name);
  });

  test('a phone offers neither issue nor revoke', async () => {
    const page = await open();
    const realMatch = globalThis.matchMedia;
    try {
      globalThis.matchMedia = (query) => ({ matches: query.includes('pointer: coarse'), addEventListener() {} });
      typeName(page, 'from-a-phone');
      button(page, '발급').click();
      button(page, '폐기', tables(page)[1]).click();
      await page.settle();
      assert.deepEqual(page.sent, []);
      assert.deepEqual(page.app.all('span', 'ask'), []);
    } finally {
      globalThis.matchMedia = realMatch;
      page.close();
    }
  });
});

describe('writes from a page (web/api.js)', () => {
  test('send the method, the body as JSON and the request key in double quotes, with no redirect and no cache', async () => {
    const realFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (path, init) => {
      calls.push([path, init]);
      return new Response('{"changed":true}', { status: 200, headers: { 'content-type': 'application/json' } });
    };
    try {
      const key = newRequestKey();
      assert.match(key, /^nw_[0-9a-hjkmnp-tv-z]{12}$/);
      assert.deepEqual(await write('POST', '/api/credentials', { name: 'laptop' }, key), { status: 200, body: { changed: true } });
      await write('DELETE', '/api/projects/demo/tool-links/x', null, key);
      const [[path, init], [, none]] = calls;
      assert.equal(path, '/api/credentials');
      assert.deepEqual([init.method, init.body, init.credentials, init.redirect, init.cache], ['POST', '{"name":"laptop"}', 'same-origin', 'manual', 'no-store']);
      assert.deepEqual(init.headers, { accept: 'application/json', 'idempotency-key': `"${key}"`, 'content-type': 'application/json' });
      assert.deepEqual([none.method, none.body, none.headers['content-type']], ['DELETE', undefined, undefined]);
      assert.ok(init.signal instanceof AbortSignal);
      const keys = new Set(Array.from({ length: 200 }, () => newRequestKey()));
      assert.equal(keys.size, 200);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe('SCR-143 against the server', () => {
  const responses = responseRecord();
  const ACTIONS = ['listProjects', 'listCredentials', 'issueCredential', 'revokeCredential'];
  let folder;
  let db;
  let local;
  let good;
  let broken;
  let agent;
  let failing = false;
  let counter = 0;

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-projects-screen-'));
    ({ db } = openStore(folder));
    local = localGate();
    const s = seed(db);
    agent = s.agent;
    s.project('reading-club', { title: '독서 모임 앱' });
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

  const JSON_TYPE = { 'Content-Type': 'application/json' };
  const keyed = () => ({ 'Idempotency-Key': `"${newRequestKey()}"` });
  function headersOf(who) {
    if (who === 'owner') return { 'Cf-Access-Jwt-Assertion': local.token() };
    if (who === 'someone') return { 'Cf-Access-Jwt-Assertion': local.token({ email: 'someone@example.com' }) };
    if (who === 'agent') return agent.headers;
    return {};
  }
  // The server's answer as the page's fetch gets it.
  const asFetched = (answer) => () => new Response(answer.text, { status: answer.status, headers: { 'content-type': answer.headers['content-type'] } });
  const fresh = () => `screen-${(counter += 1)}`;

  // A real answer of the operation for a response it lists: { answer, name }, noted for assertEvery.
  async function answerFor(action, status, code) {
    const who = code === 'owner_only' ? 'agent' : code === 'not_owner' ? 'someone' : status === '401' ? 'nobody' : 'owner';
    const server = status === 'default' ? broken : good;
    const name = fresh();
    let request;
    if (action === 'listProjects' || action === 'listCredentials') {
      request = { path: action === 'listProjects' ? '/api/projects' : '/api/credentials', headers: headersOf(who) };
    } else {
      const issuing = action === 'issueCredential';
      let path = '/api/credentials';
      let body = JSON.stringify({ name });
      let headers = { ...JSON_TYPE, ...headersOf(who), ...keyed() };
      if (!issuing) {
        const made = await good.send({ method: 'POST', path, headers: { ...JSON_TYPE, ...headersOf('owner'), ...keyed() }, body: JSON.stringify({ name: fresh() }) });
        path = status === '404' ? REVOKE(idOf('ac', 999_999)) : REVOKE(made.json.credential.id);
        body = '{}';
      }
      if (status === '200' && issuing) {
        await good.send({ method: 'POST', path, headers, body });
      }
      if (status === '400') body = issuing ? JSON.stringify({ name: '' }) : '{"x":1}';
      if (code === 'cross_site') headers['Sec-Fetch-Site'] = 'cross-site';
      if (code === 'name_taken') body = JSON.stringify({ name: 'taken-name' });
      if (code === 'name_taken') await good.send({ method: 'POST', path, headers: { ...JSON_TYPE, ...headersOf('owner'), ...keyed() }, body });
      if (code === 'request_key_reused') {
        await good.send({ method: 'POST', path: '/api/credentials', headers, body: JSON.stringify({ name: fresh() }) });
      }
      if (status === '415') headers = { ...headers, 'Content-Type': 'text/plain' };
      if (status === '413') {
        const { answers } = await exchange(good.port, [head('POST', path, { ...headers, 'Content-Length': 2 * MiB + 1 })]);
        return { answer: responses.note(action, answers[0]), name };
      }
      request = { method: 'POST', path, headers, body };
    }
    failing = status === 'default';
    try {
      return { answer: responses.note(action, await server.send(request)), name };
    } finally {
      failing = false;
    }
  }

  // What the page shows for each answer, by the action, the status and the code.
  async function shows(action, status, code, { answer, name }) {
    const fetched = asFetched(answer);
    const reading = action === 'listProjects' || action === 'listCredentials';
    const reads = reading ? { [action === 'listProjects' ? '/api/projects' : '/api/credentials']: fetched } : {};
    // Without a sign-in the gate refuses every read, so no read lets the page through again (shell.js succeeded).
    if (reading && status === '401') Object.assign(reads, { '/api/projects': fetched, '/api/todo': fetched, '/api/credentials': fetched });
    const writes = { '/api/credentials': fetched, [REVOKE(CI.id)]: fetched };
    const page = await open({ reads, writes, session: reading && status === '401' ? { [GATE_KEY]: String(Date.now()) } : {} });
    try {
      if (action === 'issueCredential') await issue(page, name);
      if (action === 'revokeCredential') await revoke(page, CI.id);
      const label = `${action} ${status} ${code ?? ''}`;
      if (status === '401') {
        // The page keeps the unsent name and goes to the gate once; a read with the mark already set says to sign in.
        if (reading) assert.deepEqual(texts(page, 'h1'), ['다시 로그인하세요.'], label);
        else assert.equal(page.location.reloads, 1, label);
        if (action === 'issueCredential') assert.equal(page.session.getItem(NAME_DRAFT), name, label);
        return;
      }
      if (status === '403') {
        assert.deepEqual(texts(page, 'h1'), [message(code)], label);
        assert.deepEqual(texts(page, 'button'), code === 'cross_site' ? ['새로 고침'] : [], label);
        return;
      }
      if (reading && status === '200') {
        assert.equal(errorShown(page), false, label);
        if (action === 'listProjects') assert.ok(page.app.textContent.includes('독서 모임 앱'), label);
        // The seed's agent credential, at least, is listed.
        else assert.ok(tables(page)[1].all('td').some((cell) => /^(?:agent|screen)-/.test(cell.textContent)), label);
        return;
      }
      if (reading) {
        const text = action === 'listProjects' ? '프로젝트를 읽지 못했어요.다시 시도' : '에이전트 자격을 읽지 못했어요.다시 시도';
        assert.deepEqual(page.app.all('div', 'err').map((each) => each.textContent), [text], label);
        assert.match(texts(page, 'span', 'helper').find((each) => each.startsWith('traceId')), /^traceId [0-9a-f]{16}$/, label);
        return;
      }
      if (action === 'issueCredential' && status === '201') {
        assert.deepEqual(panel(page).all('input').map((each) => each.getAttribute('value')), [answer.json.credential.id, answer.json.secret], label);
        return;
      }
      if (action === 'issueCredential' && status === '200') {
        assert.deepEqual(panel(page).all('p').map((each) => each.textContent), [REPEATED], label);
        return;
      }
      if (action === 'issueCredential') {
        assert.equal(byId(page, 'credential-name-refused').textContent, message(answer.json.code), label);
        assert.equal(byId(page, 'credential-name').getAttribute('value'), name, label);
        return;
      }
      if (status === '200') {
        assert.equal(errorShown(page), false, label);
        assert.equal(page.sent.length, 1, label);
        return;
      }
      assert.deepEqual(page.app.all('div', 'err').map((each) => each.textContent), [message(answer.json.code)], label);
    } finally {
      page.close();
    }
  }

  for (const action of ACTIONS) {
    test(`every response ${action} lists leads SCR-143 to what its definition gives`, async () => {
      for (const listed of listedResponses(action)) {
        for (const code of listed.codes.length === 0 ? [null] : listed.codes) {
          const got = await answerFor(action, listed.status, code);
          const expected = listed.status === 'default' ? 500 : Number(listed.status);
          assert.equal(got.answer.status, expected, `${action} ${listed.status} ${code}: ${got.answer.text}`);
          await shows(action, listed.status, code, got);
        }
      }
      responses.assertEvery(action);
    });
  }

  test('a new install shows no project and no credential, as SPEC-015 starts', async (t) => {
    const empty = mkdtempSync(join(tmpdir(), 'nexus-projects-empty-'));
    const opened = openStore(empty);
    const server = await startServer({ routes: ROUTES, store: opened.db, gate: local.gate });
    t.after(async () => {
      await server.close();
      opened.db.close();
      rmSync(empty, { recursive: true, force: true, maxRetries: 5 });
    });
    const realFetch = globalThis.fetch;
    const answers = (path) => realFetch(`http://127.0.0.1:${server.port}${path}`, { headers: { accept: 'application/json', ...headersOf('owner') }, redirect: 'manual' });
    const page = await openPage('/p', { answers });
    try {
      assert.deepEqual(page.app.all('div', 'empty').map((each) => each.all('h2')[0]?.textContent ?? each.textContent), [
        '아직 프로젝트가 없어요', '아직 보낼 수 있는 에이전트가 없어요.',
      ]);
    } finally {
      page.close();
    }
  });
});
