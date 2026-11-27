// SCR-142, the owner's to-do (TASK-455; SPEC-042, SPEC-010, SPEC-052): each state of its screen definition on
// test/fake-dom.js, against stubbed answers and against the server, and every response API-263 lists. How the screen
// looks, at 360 and 1440 pixels in light and dark, is the browser walk of the pull request.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { changeSetsChanged, confirmationsChanged, threadChanged } from '../src/entries.js';
import { createPages } from '../src/pages.js';
import { ROUTES } from '../src/routes.js';
import { openStore } from '../src/store.js';
import { stageHref } from '../web/address.js';
import { ago, clockOf, dayOf, GATE_KEY, sentWords, STALE_AFTER_MS } from '../web/states.js';
import { REASONS } from '../web/todo.js';
import { contract } from './contract.js';
import { fakePage } from './fake-dom.js';
import { listedResponses, responseRecord } from './responses.js';
import { errorShown, headerOf, json, openPage, problem, SCREENS, startShell, texts, TRACE } from './screen-page.js';
import { seed } from './seed.js';
import { localGate, startServer, waitFor } from './support.js';

// The local moment the screen is read at: the times it says are of this clock.
const NOW = new Date(2026, 10, 24, 9, 30).getTime();
const earlier = (minutes) => new Date(NOW - minutes * 60_000).toISOString();
const D1 = 'dg_0000000000a1';
const D2 = 'dg_0000000000a2';
const D3 = 'dg_0000000000a3';
const D4 = 'dg_0000000000a4';
const T1 = 'nc_0000000000b1';
const T2 = 'nc_0000000000b2';

const summary = (name, title, fields = {}) => ({
  name, title, revision: 3, commit: 'a'.repeat(40), pushed_at: earlier(12), owner_todo: 0, stages_passed: 0, ...fields,
});
const entry = (kind, fields) => ({ kind, part: '', thread: null, change_set: null, reason: null, ...fields });
const PROJECTS = {
  projects: [
    summary('reading-club', '독서 모임 앱', { stages_passed: 7, owner_todo: 4 }),
    summary('demo', 'demo', { pushed_at: earlier(26 * 60), stages_passed: 1, owner_todo: 1 }),
    // A space that holds no snapshot yet.
    summary('garden', '텃밭 계획표', { revision: null, commit: null, pushed_at: null }),
  ],
  backup: null,
};
// API-263's order: the projects by their newest entry, and each one's entries newest first.
const ENTRIES = [
  entry('confirm', { project: 'reading-club', stage: '01-domain', diagram: D1, diagram_name: '도메인 보드', reason: 'invalidated', since: earlier(12) }),
  entry('proposal', { project: 'reading-club', stage: '01-domain', diagram: D1, diagram_name: '도메인 보드', thread: T1, change_set: 'np_0000000000c1', since: earlier(180) }),
  entry('proposal', { project: 'reading-club', stage: '01-domain', diagram: D1, diagram_name: '도메인 보드', change_set: 'np_0000000000c2', since: earlier(185) }),
  entry('question', { project: 'reading-club', part: 'nexus', stage: '05-erd', diagram: D2, diagram_name: 'ERD', thread: T2, since: earlier(26 * 60) }),
  entry('confirm', { project: 'demo', stage: '02-prd', diagram: D3, diagram_name: '요구사항 표', reason: 'new', since: earlier(2 * 24 * 60) }),
  // A project API-262's list leaves out, such as one beyond its 1000: its name heads its group.
  entry('confirm', { project: 'old-notes', stage: '03-user-flow', diagram: D4, diagram_name: 'FL-001', reason: 'cancelled', since: earlier(10 * 24 * 60) }),
];
const TODO = { entries: ENTRIES, backup: null };
const BACKUP = { failed_at: new Date(2026, 10, 22, 0, 20).toISOString(), last_succeeded_at: new Date(2026, 10, 20, 0, 5).toISOString() };
const answersOf = ({ todo = TODO, projects = PROJECTS } = {}) => ({ '/api/todo': json(200, todo), '/api/projects': json(200, projects) });

// A clock that reads at now and moves on in real time; it returns the function that puts the real one back.
function clockAt(at) {
  const realNow = Date.now;
  const start = realNow();
  Date.now = () => at + (realNow() - start);
  return () => {
    Date.now = realNow;
  };
}

// SCR-142 on a fake page, read at NOW.
async function openTodo(options = {}) {
  const restore = clockAt(NOW);
  try {
    const page = await openPage('/', { search: '?view=todo', answers: answersOf(), ...options });
    const close = page.close;
    page.close = () => {
      close();
      restore();
    };
    return page;
  } catch (error) {
    restore();
    throw error;
  }
}

const mainOf = (page) => page.app.all('main')[0];
// Each row of the to-do: its tag, its tag's class, its place, its reason, its time and where it opens.
const rowsOf = (page) => mainOf(page).all('a', 'li').map((row) => {
  const lead = row.all('span', 'lead')[0].all('span')[0] ?? null;
  return {
    tag: lead?.textContent ?? null,
    look: lead?.className ?? null,
    place: row.all('b')[0].textContent,
    reason: row.all('span', 'sec')[0]?.textContent ?? null,
    time: row.all('time')[0].textContent,
    href: row.getAttribute('href'),
  };
});
const warningOf = (page) => mainOf(page).all('div', 'warn').filter((element) => element.shown);

describe('how long ago the screen says', () => {
  test('in minutes under an hour, hours under 24, "어제" on the day before, then local calendar days, never "1일 전"', () => {
    const at = (day, hours, minutes) => new Date(2026, 10, day, hours, minutes).toISOString();
    assert.equal(ago(at(24, 9, 30), NOW), '1분 전');
    assert.equal(ago(new Date(NOW + 90_000).toISOString(), NOW), '1분 전');
    assert.equal(ago(at(24, 9, 18), NOW), '12분 전');
    assert.equal(ago(at(24, 8, 31), NOW), '59분 전');
    assert.equal(ago(at(24, 8, 30), NOW), '1시간 전');
    assert.equal(ago(at(23, 9, 31), NOW), '23시간 전');
    assert.equal(ago(at(23, 9, 30), NOW), '어제');
    assert.equal(ago(at(23, 0, 0), NOW), '어제');
    assert.equal(ago(at(22, 23, 59), NOW), '2일 전');
    assert.equal(ago(at(14, 9, 30), NOW), '10일 전');
    assert.equal(ago(new Date(2025, 10, 24, 9, 30).toISOString(), NOW), '365일 전');
    // Past midnight: the day before is "어제" only once 24 hours passed, and two dates back is "2일 전" at once.
    const early = new Date(2026, 10, 24, 0, 10).getTime();
    assert.equal(ago(at(23, 23, 50), early), '20분 전');
    assert.equal(ago(at(23, 0, 11), early), '23시간 전');
    assert.equal(ago(at(23, 0, 5), early), '어제');
    assert.equal(ago(at(22, 23, 59), early), '2일 전');
    for (let minutes = 0; minutes < 30 * 24 * 60; minutes += 7) {
      assert.doesNotMatch(ago(new Date(NOW - minutes * 60_000).toISOString(), NOW), /^(?:0분|1일) 전$/, String(minutes));
    }
    assert.equal(ago('not a time', NOW), '');
  });

  test('when a project was sent, and the local date of a failed backup', () => {
    assert.equal(sentWords('12분 전'), '12분 전에 보냄');
    assert.equal(sentWords('2일 전'), '2일 전에 보냄');
    assert.equal(sentWords('어제'), '어제 보냄');
    assert.equal(dayOf(new Date(2026, 10, 22, 23, 59).toISOString()), '11월 22일');
    assert.equal(dayOf(new Date(2026, 0, 3, 0, 0).toISOString()), '1월 3일');
  });
});

describe('SCR-142', () => {
  test('home lists projects with their questions and reviews and keeps the complete to-do reachable', async () => {
    const page = await openPage('/', { answers: answersOf() });
    try {
      assert.deepEqual(texts(page, 'h1'), ['프로젝트']);
      const cards = mainOf(page).all('div', 'project-card');
      assert.deepEqual(cards.map((card) => card.all('a')[0].getAttribute('href')), ['/p/reading-club', '/p/demo', '/p/garden']);
      assert.match(cards[0].textContent, /답할 질문 1개 · 확인할 내용 3개/);
      assert.match(cards[1].textContent, /답할 질문 0개 · 확인할 내용 1개/);
      assert.equal(cards[0].all('a')[1].getAttribute('href'), `/p/reading-club/nexus/05-erd?d=${D2}&thread=${T2}`);
      assert.equal(cards[1].all('a').length, 1);
      assert.ok(mainOf(page).all('a').some((link) => link.getAttribute('href') === '/?view=todo'));
    } finally { page.close(); }
  });

  test('home does not show zero when its to-do read fails or imply a capped list is complete', async () => {
    const missing = await openPage('/', { answers: { ...answersOf(), '/api/todo': problem(500, 'internal') } });
    try {
      assert.match(mainOf(missing).textContent, /할 일 수를 읽지 못했어요/);
      assert.doesNotMatch(mainOf(missing).textContent, /답할 질문 0개/);
      assert.doesNotMatch(mainOf(missing).textContent, /최근 질문에 답하기/);
    } finally { missing.close(); }
    const full = await openPage('/', { answers: answersOf({ todo: { entries: Array(5000).fill(ENTRIES[0]), backup: null } }) });
    try { assert.match(mainOf(full).textContent, /확인할 내용 5000개 이상/); }
    finally { full.close(); }
  });

  test('a failed refresh keeps earlier project counts labelled as old until a successful retry', async () => {
    const answers = answersOf();
    const page = await openPage('/', { answers });
    try {
      assert.match(mainOf(page).textContent, /답할 질문 1개/);
      answers['/api/todo'] = problem(500, 'internal');
      await page.shell.reload();
      assert.match(mainOf(page).textContent, /이전 정보예요/);
      assert.match(mainOf(page).textContent, /답할 질문 1개/);
      assert.ok(mainOf(page).all('button').some((button) => button.textContent === '다시 시도'));
      answers['/api/todo'] = json(200, TODO);
      await page.shell.reload();
      assert.match(mainOf(page).textContent, /답할 질문 1개/);
    } finally { page.close(); }
  });

  test('a failed full-to-do refresh keeps its previous rows with an old-data warning', async () => {
    const answers = answersOf();
    const page = await openTodo({ answers });
    try {
      assert.equal(rowsOf(page).length, ENTRIES.length);
      answers['/api/todo'] = problem(500, 'internal');
      await page.shell.reload();
      assert.equal(rowsOf(page).length, ENTRIES.length);
      assert.match(mainOf(page).textContent, /이전 정보예요/);
      assert.ok(mainOf(page).all('button').some((button) => button.textContent === '다시 시도'));
    } finally { page.close(); }
  });
  test('normal: the entries by project in API-263\'s order, each by its names, its kind, why it waits and how long', async () => {
    const page = await openTodo();
    try {
      assert.deepEqual(texts(page, 'h1'), ['내 차례']);
      assert.equal(page.document.title, '내 차례 · NEXUS');
      assert.deepEqual(texts(page, 'p', 'sec'), ['모든 프로젝트에서 나를 기다리는 일이에요. 최근 것부터 보여요.']);
      // Each group by its project's title from API-262, or its name when the list leaves it out, to its page.
      const groups = mainOf(page).all('section', 'group');
      assert.deepEqual(groups.map((group) => [group.all('h2')[0].textContent, group.all('a', 'small')[0].textContent, group.all('a', 'small')[0].getAttribute('href')]), [
        ['독서 모임 앱', '프로젝트 보기', '/p/reading-club'],
        ['demo', '프로젝트 보기', '/p/demo'],
        ['old-notes', '프로젝트 보기', '/p/old-notes'],
      ]);
      assert.deepEqual(groups.map((group) => group.all('a', 'li').length), [4, 1, 1]);
      // Each 프로젝트 보기 is named with its group's heading too.
      const byId = new Map(mainOf(page).descendants().filter((element) => element.getAttribute('id') !== null).map((element) => [element.getAttribute('id'), element]));
      assert.deepEqual(groups.map((group) => group.all('a', 'small')[0].getAttribute('aria-labelledby').split(' ').map((id) => byId.get(id).textContent).join(' ')), [
        '프로젝트 보기 독서 모임 앱', '프로젝트 보기 demo', '프로젝트 보기 old-notes',
      ]);
      assert.deepEqual(rowsOf(page), [
        { tag: '확정', look: 'tag gray', place: '01 도메인 · 도메인 보드', reason: '새 문서로 확정이 풀렸어요', time: '12분 전', href: `/p/reading-club/_/01-domain?d=${D1}` },
        { tag: 'AI 제안', look: 'ai', place: '01 도메인 · 도메인 보드', reason: null, time: '3시간 전', href: `/p/reading-club/_/01-domain?d=${D1}&thread=${T1}` },
        { tag: 'AI 제안', look: 'ai', place: '01 도메인 · 도메인 보드', reason: null, time: '3시간 전', href: `/p/reading-club/_/01-domain?d=${D1}` },
        { tag: '질문', look: 'tag cyan', place: '05 ERD · ERD', reason: '열어서 질문을 읽고 댓글에 답해 주세요.', time: '어제', href: `/p/reading-club/nexus/05-erd?d=${D2}&thread=${T2}` },
        { tag: '확정', look: 'tag gray', place: '02 PRD · 요구사항 표', reason: '아직 확정한 적이 없어요', time: '2일 전', href: `/p/demo/_/02-prd?d=${D3}` },
        { tag: '확정', look: 'tag gray', place: '03 사용자 흐름 · FL-001', reason: '확정을 취소했어요', time: '10일 전', href: `/p/old-notes/_/03-user-flow?d=${D4}` },
      ]);
      // Each time holds its moment, and each row ends in the mockup's chevron.
      assert.deepEqual(mainOf(page).all('time').map((time) => time.getAttribute('datetime')), ENTRIES.map((each) => each.since));
      assert.ok(mainOf(page).all('a', 'li').every((row) => row.all('svg', 'chev').length === 1));
      // Names, not IDs (SPEC-010): no diagram, thread or proposal ID shows.
      assert.doesNotMatch(mainOf(page).textContent, /\b(?:dg|nc|np)_/);
      // "내 차례 N" is this list's count, and with no failed backup there is no warning.
      assert.equal(headerOf(page).all('span', 'cnt')[0].textContent, String(ENTRIES.length));
      assert.deepEqual(warningOf(page), []);
      assert.equal(errorShown(page), false);
      // The screen and the header read API-262 and API-263 once each.
      assert.deepEqual([...page.calls].sort(), ['/api/projects', '/api/todo']);
    } finally {
      page.close();
    }
  });

  test('each reason a diagram waits for its confirmation has its words, and only a confirmation says one', () => {
    assert.deepEqual(Object.keys(REASONS), contract.components.schemas.OwnerTodoEntry.properties.reason.anyOf[0].enum);
  });

  test('every entry API-263 answers shows, up to its most, with no "more"', async () => {
    const most = contract.components.schemas.OwnerTodo.properties.entries.maxItems;
    const entries = Array.from({ length: most }, (_, index) => ({ ...ENTRIES[index % ENTRIES.length], since: earlier(12 + index) }));
    const page = await openTodo({ answers: answersOf({ todo: { entries, backup: null } }) });
    try {
      assert.equal(mainOf(page).all('a', 'li').length, most);
      assert.equal(page.app.textContent.includes('더 보기'), false);
    } finally {
      page.close();
    }
  });

  test('a failed daily backup is a warning on top until a backup succeeds, in the empty state too', async () => {
    let backup = BACKUP;
    let entries = ENTRIES;
    const answers = { '/api/projects': json(200, PROJECTS), '/api/todo': () => json(200, { entries, backup })() };
    const page = await openTodo({ answers });
    try {
      const shown = () => warningOf(page).map((warning) => [warning.getAttribute('role'), texts(page, 'b').filter((text) => text.includes('백업')), warning.all('span')[0].textContent]);
      const expected = [['status', ['11월 22일 백업이 실패했어요.'], '서버 기록을 확인하세요. 다음 백업이 성공하면 이 알림은 사라져요.']];
      assert.deepEqual(shown(), expected);
      // On top: before the first group. The last backup that succeeded is not said.
      const body = mainOf(page).children;
      assert.ok(body.indexOf(warningOf(page)[0]) < body.indexOf(mainOf(page).all('section', 'group')[0]));
      assert.equal(mainOf(page).textContent.includes(dayOf(BACKUP.last_succeeded_at)), false);
      // Nothing to do, and the backup still failed.
      entries = [];
      page.document.dispatch('visibilitychange');
      await page.settle();
      assert.deepEqual(shown(), expected);
      assert.deepEqual(texts(page, 'h2').slice(0, 1), ['기다리는 일이 없어요']);
      // A backup succeeded: the warning is gone.
      backup = null;
      page.document.dispatch('visibilitychange');
      await page.settle();
      assert.deepEqual(warningOf(page), []);
    } finally {
      page.close();
    }
  });

  test('empty: "기다리는 일이 없어요" and the projects, each to its page, as sent', async () => {
    const page = await openTodo({ answers: answersOf({ todo: { entries: [], backup: null } }) });
    try {
      const empty = mainOf(page).all('div', 'empty')[0];
      assert.deepEqual([empty.all('h2')[0].textContent, empty.all('p')[0].textContent], ['기다리는 일이 없어요', '에이전트가 확정할 그림이나 질문을 보내면 여기에 나와요.']);
      const group = mainOf(page).all('section', 'group')[0];
      assert.equal(group.all('h2')[0].textContent, '프로젝트');
      assert.deepEqual(group.all('a', 'li').map((row) => [row.all('b')[0].textContent, row.all('span', 'sec')[0].textContent, row.getAttribute('href')]), [
        ['독서 모임 앱', '13단계 중 7 통과 · 12분 전에 보냄', '/p/reading-club'],
        ['demo', '13단계 중 1 통과 · 어제 보냄', '/p/demo'],
        ['텃밭 계획표', '13단계 중 0 통과', '/p/garden'],
      ]);
      assert.equal(headerOf(page).all('span', 'cnt')[0].textContent, '0');
    } finally {
      page.close();
    }
  });

  test('empty with no project yet: "에이전트가 처음 보내면 여기에 나와요." and the way to the agent credentials', async () => {
    const page = await openTodo({ answers: answersOf({ todo: { entries: [], backup: null }, projects: { projects: [], backup: null } }) });
    try {
      const empty = mainOf(page).all('div', 'empty')[0];
      assert.deepEqual([empty.all('h2')[0].textContent, empty.all('p')[0].textContent], ['기다리는 일이 없어요', '에이전트가 처음 보내면 여기에 나와요.']);
      assert.deepEqual(empty.all('a').map((link) => [link.textContent, link.getAttribute('href')]), [['에이전트 자격', '/p']]);
      assert.deepEqual(mainOf(page).all('section'), []);
    } finally {
      page.close();
    }
  });

  test('loading: grey rows in the list\'s places, two per project group, with no button and no project data', async () => {
    const held = [];
    const answers = answersOf();
    const page = fakePage({ pathname: '/' });
    const restore = page.install();
    const realFetch = globalThis.fetch;
    globalThis.fetch = (path) => new Promise((resolve) => held.push(() => resolve(answers[path]())));
    try {
      startShell(page.app, SCREENS['SCR-142'], { screen: 'SCR-142', view: 'todo' });
      await waitFor(() => held.length === 2);
      const main = mainOf(page);
      assert.deepEqual(texts(page, 'h1'), ['내 차례']);
      const groups = main.all('section', 'group');
      assert.deepEqual(groups.map((group) => [group.all('span', 'line').length, group.all('span', 'row').length, group.getAttribute('aria-hidden')]), [[1, 2, 'true'], [1, 2, 'true']]);
      assert.deepEqual([main.all('button'), main.all('a')], [[], []]);
      assert.equal(page.app.textContent.includes('독서 모임 앱'), false);
      for (const release of held) release();
      await waitFor(() => mainOf(page).all('a', 'li').length === ENTRIES.length);
      assert.deepEqual(mainOf(page).all('span', 'sk'), []);
    } finally {
      restore();
      globalThis.fetch = realFetch;
    }
  });

  test('error: a failed read of API-263 or API-262 says so with a retry and its traceId, and the header still works', async () => {
    for (const path of ['/api/todo', '/api/projects']) {
      let fail = true;
      const answers = answersOf();
      const page = await openTodo({ answers: { ...answers, [path]: (read) => (fail ? problem(500, 'internal')() : answers[read]()) } });
      try {
        assert.deepEqual(texts(page, 'h1'), ['내 차례']);
        assert.deepEqual(texts(page, 'b'), ['문제가 생겼어요. 다시 해 보세요.']);
        assert.deepEqual(texts(page, 'span', 'helper'), [`traceId ${TRACE}`]);
        assert.deepEqual(mainOf(page).all('a', 'li'), []);
        // The header keeps the part whose read answered.
        const header = headerOf(page);
        const menu = header.all('button').find((each) => each.getAttribute('aria-haspopup') === 'menu');
        const turn = header.all('a').find((link) => link.textContent.startsWith('내 차례'));
        assert.deepEqual([menu.shown, turn.shown], path === '/api/todo' ? [true, false] : [false, true], path);
        fail = false;
        mainOf(page).all('button').find((button) => button.textContent === '다시 시도').click();
        await page.settle();
        assert.equal(errorShown(page), false);
        assert.equal(rowsOf(page).length, ENTRIES.length);
      } finally {
        page.close();
      }
    }
  });

  test('permission: a 401 goes to the gate and a 403 shows only its message', async () => {
    const gated = await openTodo({ answers: { '/api/todo': problem(401, 'unauthenticated'), '/api/projects': problem(401, 'unauthenticated') } });
    try {
      assert.equal(gated.location.reloads, 1);
    } finally {
      gated.close();
    }
    const refused = await openTodo({ answers: { '/api/todo': problem(403, 'not_owner'), '/api/projects': problem(403, 'not_owner') } });
    try {
      assert.deepEqual([texts(refused, 'h1'), texts(refused, 'button'), refused.app.all('a', 'li')], [['이 NEXUS의 소유자만 열 수 있어요.'], [], []]);
    } finally {
      refused.close();
    }
  });

  test('stale: the read time shows after five minutes, and the times move on with the tick and with each read', async () => {
    const page = await openTodo();
    try {
      const first = mainOf(page).all('h2')[0];
      const readAt = Date.now();
      const realNow = Date.now;
      // A tick that changes no time writes none of them.
      const text = mainOf(page).all('time')[0].children[0];
      for (const tick of page.ticks) tick();
      assert.equal(mainOf(page).all('time')[0].children[0], text);
      // Three hours later, the tab still in view: the tick moves the times on and shows the read time.
      Date.now = () => realNow() + 3 * 60 * 60_000;
      for (const tick of page.ticks) tick();
      assert.deepEqual(rowsOf(page).map((row) => row.time), ['3시간 전', '6시간 전', '6시간 전', '어제', '2일 전', '10일 전']);
      assert.ok(Date.now() - readAt >= STALE_AFTER_MS);
      assert.equal(texts(page, 'span', 'tag').find((text) => text.endsWith('에 읽음')), `${clockOf(readAt)}에 읽음`);
      // The tab comes back into view and the to-do answers the same: the view stays, with the times moved on.
      page.document.dispatch('visibilitychange');
      await page.settle();
      assert.equal(mainOf(page).all('h2')[0], first);
      assert.equal(texts(page, 'span', 'tag').some((text) => text.endsWith('에 읽음')), false);
      assert.equal(rowsOf(page)[0].time, '3시간 전');
      Date.now = realNow;
    } finally {
      page.close();
    }
  });
});

describe('SCR-142 against the server', () => {
  const responses = responseRecord();
  let folder;
  let db;
  let local;
  let good;
  let broken;
  let s;
  let failing = false;
  const owner = () => ({ 'Cf-Access-Jwt-Assertion': local.token() });
  const at = (minutes) => new Date(Date.parse('2026-11-23T00:00:00.000Z') + minutes * 60_000).toISOString();

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-todo-screen-'));
    ({ db } = openStore(folder));
    local = localGate();
    s = seed(db);
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

  // SCR-142 reading the server through a stand-in for the gate that sends the given sign-in, or none.
  function openOn(target, headers = {}, options = {}) {
    const realFetch = globalThis.fetch;
    const answers = (read) => realFetch(`http://127.0.0.1:${target.port}${read}`, {
      headers: { accept: 'application/json', ...headers },
      redirect: 'manual',
    });
    return openPage('/', { search: '?view=todo', answers, ...options });
  }

  test('a new install has nothing to do and no project: the way to the agent credentials', async () => {
    const answer = responses.note('getOwnerTodo', await good.send({ path: '/api/todo', headers: owner() }));
    assert.deepEqual(answer.json, { entries: [], backup: null });
    const page = await openOn(good, owner());
    try {
      assert.deepEqual(texts(page, 'h2'), ['기다리는 일이 없어요']);
      assert.deepEqual(mainOf(page).all('a').map((link) => [link.textContent, link.getAttribute('href')]), [['에이전트 자격', '/p']]);
    } finally {
      page.close();
    }
  });

  test('the server\'s to-do shows each entry by its names, kind, reason and link, with the backup warning on top', async () => {
    const sync = (change, space, args, time) => change(db, { project: space.id, time, ...args });
    const pictures = [{ part: 'nexus', stage: '03-user-flow', key: 'docs/03-user-flow/FL-001.md', commit: '' }];
    const club = s.project('reading-club', { pictures });
    const erd = s.diagram(club, { sourceKey: '/pictures/05-erd/nexus' });
    const flow = s.diagram(club, { stage: '03-user-flow', sourceKey: 'docs/03-user-flow/FL-001.md', kind: 'user_flow', name: 'FL-001' });
    const table = s.diagram(club, { stage: '02-prd', sourceKey: '/items/02-prd', kind: 'item_table', name: '02-prd' });
    s.snapshot(club, { title: '독서 모임 앱', pictures, at: at(90) });
    sync(confirmationsChanged, club, { diagram: table.id }, at(10));
    const invalidated = s.confirm(club, erd);
    s.invalidate(invalidated, s.drawing(club, erd.id));
    sync(confirmationsChanged, club, { diagram: erd.id }, at(20));
    const cancelled = s.confirm(club, flow);
    s.cancel(cancelled);
    sync(confirmationsChanged, club, { diagram: flow.id }, at(30));
    const proposalThread = s.thread(erd, { author: 'owner', at: at(40) });
    s.changeSet(club, erd, { origin: 'proposal', threadId: proposalThread });
    sync(changeSetsChanged, club, { diagram: erd.id }, at(40));
    const question = s.thread(flow, { author: 'agent', target: 'diagram', at: at(50) });
    sync(threadChanged, club, { thread: question }, at(50));
    const demo = s.project('demo');
    const demoErd = s.diagram(demo);
    s.snapshot(demo, { at: at(75) });
    sync(confirmationsChanged, demo, { diagram: demoErd.id }, at(5));
    // The daily backup and its retry failed (TBL-170), as TASK-450's job records them.
    const backup = (attempt, state, startedAt) => db.prepare(
      'INSERT INTO backups (name, attempt, state, bytes, started_at, finished_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('nexus-v3-backup-2026-11-23.sqlite', attempt, state, null, startedAt, startedAt);
    backup(1, 'failed', at(60));
    backup(2, 'failed', at(75));

    const answer = responses.note('getOwnerTodo', await good.send({ path: '/api/todo', headers: owner() }));
    assert.equal(answer.status, 200);
    const { entries } = answer.json;
    assert.deepEqual(entries.map((each) => [each.project, each.kind]), [
      ['reading-club', 'question'], ['reading-club', 'proposal'], ['reading-club', 'confirm'], ['reading-club', 'confirm'],
      ['reading-club', 'confirm'], ['demo', 'confirm'],
    ]);
    assert.ok(answer.json.backup);
    // A clock 30 s into its minute, so that no minute, hour or day turns between the drawing and the check.
    const restore = clockAt(Math.floor(Date.now() / 60_000) * 60_000 + 30_000);
    const page = await openOn(good, owner());
    try {
      assert.deepEqual(mainOf(page).all('section', 'group').map((group) => group.all('h2')[0].textContent), ['독서 모임 앱', 'demo']);
      const words = { confirm: '확정', proposal: 'AI 제안', question: '질문' };
      const now = Date.now();
      assert.deepEqual(rowsOf(page).map(({ tag, place, reason, time, href }) => ({ tag, place, reason, time, href })), entries.map((each) => ({
        tag: words[each.kind],
        place: `${each.stage.slice(0, 2)} ${{ '02-prd': 'PRD', '03-user-flow': '사용자 흐름', '05-erd': 'ERD' }[each.stage]} · ${each.diagram_name}`,
        reason: each.kind === 'confirm' ? REASONS[each.reason] : each.kind === 'question' ? '열어서 질문을 읽고 댓글에 답해 주세요.' : null,
        time: ago(each.since, now),
        href: stageHref(each.project, each.part, each.stage, { diagram: each.diagram, thread: each.thread }),
      })));
      assert.deepEqual(rowsOf(page).filter((row) => row.reason !== null).map((row) => row.reason), ['열어서 질문을 읽고 댓글에 답해 주세요.', '확정을 취소했어요', '새 문서로 확정이 풀렸어요', '아직 확정한 적이 없어요', '아직 확정한 적이 없어요']);
      assert.ok(rowsOf(page).some((row) => row.href.includes('/nexus/03-user-flow?d=dg_') && row.href.includes('&thread=nc_')));
      assert.deepEqual(texts(page, 'b').filter((text) => text.includes('백업')), [`${dayOf(answer.json.backup.failed_at)} 백업이 실패했어요.`]);
      assert.doesNotMatch(mainOf(page).textContent, /\b(?:dg|nc|np)_/);
      assert.equal(headerOf(page).all('span', 'cnt')[0].textContent, String(entries.length));
    } finally {
      page.close();
      restore();
    }
  });

  // Each response getOwnerTodo lists, who asks for it, and the state SCR-142's definition gives it.
  const CASES = [
    { status: 200, who: 'owner', shows: (page) => assert.ok(rowsOf(page).length > 0) },
    { status: 401, code: 'unauthenticated', who: 'nobody', shows: (page) => assert.deepEqual([texts(page, 'h1'), texts(page, 'button')], [['다시 로그인하세요.'], ['새로 고침']]) },
    { status: 403, code: 'not_owner', who: 'someone', shows: (page) => assert.deepEqual([texts(page, 'h1'), texts(page, 'button')], [['이 NEXUS의 소유자만 열 수 있어요.'], []]) },
    { status: 403, code: 'owner_only', who: 'agent', shows: (page) => assert.deepEqual([texts(page, 'h1'), texts(page, 'button')], [['소유자만 NEXUS에서 할 수 있는 일이에요.'], []]) },
    {
      status: 500, code: 'internal', who: 'owner', fails: true,
      shows: (page) => {
        assert.deepEqual(texts(page, 'h1'), ['내 차례']);
        assert.deepEqual(texts(page, 'b'), ['문제가 생겼어요. 다시 해 보세요.']);
        assert.match(texts(page, 'span', 'helper')[0], /^traceId [0-9a-f]{16}$/);
      },
    },
  ];

  test('every response getOwnerTodo lists leads SCR-142 to the state its definition gives', async () => {
    const headersOf = (who) => ({
      owner: owner(), someone: { 'Cf-Access-Jwt-Assertion': local.token({ email: 'someone@example.com' }) }, agent: s.agent.headers, nobody: {},
    })[who];
    for (const listed of listedResponses('getOwnerTodo')) {
      const cases = CASES.filter((each) => (listed.status === 'default' ? each.status === 500 : String(each.status) === listed.status)
        && (listed.codes.length === 0 || listed.codes.includes(each.code)));
      assert.equal(cases.length, Math.max(1, listed.codes.length), listed.status);
      for (const each of cases) {
        const target = each.fails ? broken : good;
        failing = Boolean(each.fails);
        try {
          const answer = responses.note('getOwnerTodo', await target.send({ path: '/api/todo', headers: headersOf(each.who) }));
          assert.equal(answer.status, each.status);
          const page = await openOn(target, headersOf(each.who), { session: each.status === 401 ? { [GATE_KEY]: String(Date.now()) } : {} });
          try {
            each.shows(page);
          } finally {
            page.close();
          }
        } finally {
          failing = false;
        }
      }
    }
    responses.assertEvery('getOwnerTodo');
  });
});
