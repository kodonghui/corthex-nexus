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
import { STAGES } from '../web/stages.js';
import { REASONS } from '../web/todo.js';
import { contract } from './contract.js';
import { fakePage } from './fake-dom.js';
import { listedResponses, responseRecord } from './responses.js';
import { errorShown, GATE, headerOf, json, openPage, problem, SCREENS, startShell, texts, TRACE } from './screen-page.js';
import { seed } from './seed.js';
import { localGate, startServer, waitFor } from './support.js';

// The local moment the screen is read at: the times it says are of this clock.
const NOW = new Date(2026, 10, 24, 9, 30).getTime();
const earlier = (minutes) => new Date(NOW - minutes * 60_000).toISOString();
const D1 = 'dg_0000000000a1';
const D2 = 'dg_0000000000a2';
const D3 = 'dg_0000000000a3';
const D4 = 'dg_0000000000a4';
const notSentStages = () => STAGES.map(({ id }) => ({ stage: id, part: '', state: 'not_sent' }));
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
const TODO = { entries: ENTRIES, morning: ENTRIES.slice(0, 5), backup: null };
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
const rowsOf = (page) => mainOf(page).all('section', 'morning-card').map((card) => ({
  time: card.all('time')[0]?.textContent ?? null,
  href: card.all('a')[0]?.getAttribute('href') ?? null,
  title: card.all('h3')[0]?.textContent ?? null,
  text: card.textContent,
}));

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
  test('home shows five morning cards and links to all work and projects', async () => {
    const answers = { ...answersOf(), '/api/projects/reading-club': json(200, { name: 'reading-club', title: '독서 모임 앱', stages: notSentStages() }) };
    const page = await openPage('/', { answers });
    try {
      assert.deepEqual(texts(page, 'h1'), ['아침 보고']);
      assert.equal(rowsOf(page).length, 5);
      assert.deepEqual(mainOf(page).all('span', 'timeline-label').map((label) => label.textContent), ['무엇을 만드는지 정리', '꼭 필요한 기능', '사용하는 순서', '기능 자세히', '저장할 자료', '주고받는 약속', '화면 목록', '화면별 상태', '화면 시안', '할 일 나누기', '만들기', '검사', '발표']);
      assert.match(mainOf(page).textContent, /오늘 할 일은 6가지예요/);
      assert.match(mainOf(page).textContent, /좋은 아침이에요/);
      assert.match(mainOf(page).textContent, /답변과 제안은 10초 안에 되돌릴 수 있어요/);
      assert.ok(mainOf(page).all('a').some((link) => link.getAttribute('href') === '/?view=todo'));
      assert.ok(headerOf(page).all('a').some((link) => link.getAttribute('href') === '/p'));
    } finally { page.close(); }
  });

  test('the chosen stage is marked current and technical names are secondary in cards', async () => {
    const question = { ...ENTRIES.find((entry) => entry.kind === 'question'), question_text: '답해 주세요.' };
    const progress = { name: 'reading-club', title: '독서 모임 앱', stages: [
      { stage: '01-domain', part: 'nexus', state: 'passed' }, { stage: '05-erd', part: 'nexus', state: 'open' },
    ] };
    const page = await openPage('/', { answers: { ...answersOf({ todo: { entries: [question], morning: [question], backup: null } }), '/api/projects/reading-club': json(200, progress) } });
    try {
      const nav = mainOf(page).all('nav', 'timeline')[0];
      const current = nav.all('a').filter((link) => link.getAttribute('aria-current') === 'step');
      assert.equal(current.length, 1);
      assert.match(current[0].getAttribute('aria-label'), /05 저장할 자료: 진행 중, 현재 단계/);
      assert.ok(nav.all('a')[0].className.includes('timeline-passed'));
      assert.equal(nav.textContent.includes('시작 전'), false);
      const card = mainOf(page).all('section', 'morning-card')[0];
      assert.equal(card.all('h3')[0].textContent, '독서 모임 앱 · 저장할 자료');
      assert.equal(card.all('span', 'technical-name')[0].textContent, 'ERD');
      assert.equal(card.all('a', 'picture-link')[0].textContent, '그림에서 보기');
    } finally { page.close(); }
  });

  test('a question on a passed stage does not mark it current, and a fully passed project has no current step', async () => {
    const question = { ...ENTRIES.find((entry) => entry.kind === 'question'), stage: '01-domain', question_text: '예전 질문' };
    const makeProgress = (open) => ({ name: 'reading-club', title: '독서 모임 앱', stages: [
      { stage: '01-domain', part: 'nexus', state: 'passed' }, { stage: '05-erd', part: 'nexus', state: open ? 'open' : 'passed' },
    ] });
    const answers = { ...answersOf({ todo: { entries: [question], morning: [question], backup: null } }), '/api/projects/reading-club': json(200, makeProgress(true)) };
    const page = await openPage('/', { answers });
    try {
      let current = mainOf(page).all('nav', 'timeline')[0].all('a').find((link) => link.getAttribute('aria-current') === 'step');
      assert.match(current.getAttribute('aria-label'), /^05 /);
      answers['/api/projects/reading-club'] = json(200, makeProgress(false));
      await page.shell.reload(); await page.settle();
      current = mainOf(page).all('nav', 'timeline')[0].all('a').find((link) => link.getAttribute('aria-current') === 'step');
      assert.equal(current, undefined);
    } finally { page.close(); }
  });

  test('the next stage is labelled as next, not as the current in-progress stage', async () => {
    const entry = ENTRIES.find((each) => each.project === 'reading-club');
    const progress = { name: 'reading-club', title: '독서 모임 앱', stages: [
      { stage: '01-domain', part: '', state: 'passed' }, { stage: '02-prd', part: '', state: 'not_sent' },
    ] };
    const page = await openPage('/', { answers: { ...answersOf({ todo: { entries: [entry], morning: [entry], backup: null } }), '/api/projects/reading-club': json(200, progress) } });
    try {
      const nav = mainOf(page).all('nav', 'timeline')[0];
      const next = nav.all('a').find((link) => link.getAttribute('aria-label').includes('다음 단계'));
      assert.ok(next);
      assert.equal(next.getAttribute('aria-current'), null);
      assert.match(next.textContent, /다음/);
    } finally { page.close(); }
  });

  test('the side summary uses only recent project deliveries and known progress counts', async () => {
    const restore = clockAt(NOW);
    const projects = { projects: [
      summary('fresh', '새 자료', { pushed_at: new Date(NOW + 20_000).toISOString(), stages_passed: 3 }),
      summary('old', '이전 자료', { pushed_at: earlier(3 * 24 * 60), stages_passed: 1 }),
      summary('unknown', '시간 모름', { pushed_at: null, stages_passed: null }),
    ], backup: null };
    const page = await openPage('/', { answers: { ...answersOf({ projects, todo: { entries: [], morning: [], backup: null } }), '/api/projects/fresh': json(200, { name: 'fresh', title: '새 자료', stages: [] }) } });
    try {
      const side = mainOf(page).all('aside', 'digest-side')[0];
      const activity = side.all('ul', 'digest-activity')[0].textContent;
      assert.match(side.textContent, /AI 작업의 전체 기록은 아직 볼 수 없어요/);
      assert.match(activity, /새 자료: 자료가 도착했어요/);
      assert.doesNotMatch(activity, /이전 자료|시간 모름/);
      const overview = side.all('ul', 'project-overview')[0];
      assert.match(overview.textContent, /새 자료3\/13/);
      assert.match(overview.textContent, /시간 모름진행 정보 없음/);
      assert.equal(overview.all('progress').length, 2);
    } finally { page.close(); restore(); }
  });

  test('home keeps a progress line when there are projects but no to-dos', async () => {
    const answers = { ...answersOf({ todo: { entries: [], morning: [], backup: null } }),
      '/api/projects/reading-club': json(200, { name: 'reading-club', title: '독서 모임 앱', stages: notSentStages() }) };
    const page = await openPage('/', { answers });
    try {
      assert.equal(mainOf(page).all('span', 'timeline-label').length, 13);
      assert.match(mainOf(page).textContent, /기다리는 일이 없어요/);
    } finally { page.close(); }
  });

  test('missing progress rows do not invent thirteen unstarted stages', async () => {
    const entry = ENTRIES.find((each) => each.project === 'reading-club');
    const answers = { ...answersOf({ todo: { entries: [entry], morning: [entry], backup: null } }),
      '/api/projects/reading-club': json(200, { name: 'reading-club', title: '독서 모임 앱', stages: [] }) };
    const page = await openPage('/', { answers });
    try {
      assert.match(mainOf(page).textContent, /이 프로젝트의 진행 상황을 확인할 수 없어요/);
      assert.equal(mainOf(page).all('nav', 'timeline').length, 0);
    } finally { page.close(); }
  });

  test('a failed progress refresh cannot show a different project as the current one', async () => {
    let switched = false;
    const first = ENTRIES.find((entry) => entry.project === 'reading-club');
    const second = ENTRIES.find((entry) => entry.project === 'demo');
    const page = await openPage('/', { answers: (path, init) => {
      if (path === '/api/todo') return json(200, { entries: [switched ? second : first], morning: [switched ? second : first], backup: null })();
      if (path === '/api/projects') return json(200, PROJECTS)();
      if (path === '/api/projects/reading-club') return json(200, { name: 'reading-club', title: '독서 모임 앱', stages: notSentStages() })();
      if (path === '/api/projects/demo') return problem(500, 'internal')();
      throw new Error(`unexpected ${path}`);
    } });
    try {
      assert.match(mainOf(page).textContent, /독서 모임 앱 진행 상황/);
      switched = true; await page.shell.reload(); await page.settle();
      assert.doesNotMatch(mainOf(page).textContent, /독서 모임 앱 진행 상황/);
      assert.match(mainOf(page).textContent, /진행 상황을 불러오지 못했어요/);
    } finally { page.close(); }
  });

  test('a failed progress refresh labels the retained timeline and offers a retry', async () => {
    const entry = ENTRIES.find((each) => each.project === 'reading-club');
    const answers = { ...answersOf({ todo: { entries: [entry], morning: [entry], backup: null } }),
      '/api/projects/reading-club': json(200, { name: 'reading-club', title: '독서 모임 앱', stages: notSentStages() }) };
    const page = await openPage('/', { answers });
    try {
      answers['/api/projects/reading-club'] = problem(500, 'internal');
      await page.shell.reload(); await page.settle();
      assert.match(mainOf(page).textContent, /진행 상황은 이전 정보예요/);
      assert.ok(mainOf(page).all('button').some((button) => button.textContent === '다시 확인'));
      assert.equal(mainOf(page).all('nav', 'timeline').length, 1);
    } finally { page.close(); }
  });

  test('confirmation retries a failed preview and reopens with a fresh read', async () => {
    const entry = ENTRIES.find((each) => each.kind === 'confirm');
    const path = `/api/projects/${entry.project}/diagrams/${entry.diagram}`;
    let reads = 0;
    const answers = answersOf({ todo: { entries: [entry], morning: [entry], backup: null } });
    answers[path] = () => {
      reads += 1;
      if (reads === 1) return problem(500, 'internal')();
      return json(200, { drawing: { id: 'dr_000000000001', status: 'drawn' }, confirmation: { state: 'waiting' }, elements: [{ name: '예약 신청' }, { name: '예약 확정' }], overlays: [], since_confirmation: null })();
    };
    const page = await openPage('/', { answers });
    try {
      const click = (name) => mainOf(page).all('button').find((button) => button.textContent === name).click();
      click('이 그림 확정하기'); await page.settle();
      assert.match(mainOf(page).textContent, /그림을 불러오지 못했어요/);
      click('다시 시도'); await page.settle();
      assert.match(mainOf(page).textContent, /확정할 내용 미리보기/);
      assert.match(mainOf(page).textContent, /예약 신청/);
      assert.match(mainOf(page).textContent, /처음 확정하는 그림이에요/);
      const steps = mainOf(page).all('div', 'confirmation-steps')[0].all('li').map((item) => item.textContent);
      assert.deepEqual(steps, ['지금 그림을 맞다고 표시해요.', 'AI가 내용을 기록해요.', '모든 그림과 표가 기록되면 1단계가 끝나요.']);
      click('취소'); click('이 그림 확정하기'); await page.settle();
      assert.equal(reads, 3);
    } finally { page.close(); }
  });

  test('a confirmation preview gate response uses the shell permission flow', async () => {
    const entry = ENTRIES.find((each) => each.kind === 'confirm');
    const path = `/api/projects/${entry.project}/diagrams/${entry.diagram}`;
    const answers = { ...answersOf({ todo: { entries: [entry], morning: [entry], backup: null } }), [path]: GATE };
    const page = await openPage('/', { answers });
    try {
      mainOf(page).all('button').find((button) => button.textContent === '이 그림 확정하기').click();
      await page.settle();
      assert.equal(page.location.reloads, 1);
      assert.notEqual(page.session.getItem(GATE_KEY), null);
    } finally { page.close(); }
  });

  test('an uncertain confirmation retries with the same request key', async () => {
    const entry = ENTRIES.find((each) => each.kind === 'confirm');
    const path = `/api/projects/${entry.project}/diagrams/${entry.diagram}`;
    const known = answersOf({ todo: { entries: [entry], morning: [entry], backup: null } });
    known[path] = json(200, { drawing: { id: 'dr_000000000001', status: 'drawn' }, confirmation: { state: 'waiting' }, elements: [], overlays: [], since_confirmation: null });
    const keys = [];
    const page = await openPage('/', { answers: (url, init) => {
      if (init?.method === 'POST') { keys.push(init.headers['idempotency-key']); return keys.length === 1 ? new Error('lost') : json(200, {})(); }
      return known[url](url, init);
    } });
    try {
      const click = (name) => mainOf(page).all('button').find((button) => button.textContent === name).click();
      click('이 그림 확정하기'); await page.settle();
      click('네, 확정할게요'); await page.settle();
      assert.match(mainOf(page).textContent, /확정 결과를 확인하지 못했어요/);
      click('결과 다시 확인'); await page.settle();
      assert.equal(keys.length, 2);
      assert.equal(keys[1], keys[0]);
    } finally { page.close(); }
  });

  test('a morning answer draft survives a screen reload', async () => {
    const question = { ...ENTRIES.find((entry) => entry.kind === 'question'), question_text: '답해 주세요.' };
    const page = await openPage('/', { answers: answersOf({ todo: { entries: [question], morning: [question], backup: null } }) });
    try {
      const field = mainOf(page).all('textarea')[0];
      field.value = '아직 적는 중이에요';
      field.dispatch('input');
      await page.shell.reload();
      await page.settle();
      assert.equal(mainOf(page).all('textarea')[0].value, '아직 적는 중이에요');
      assert.equal(mainOf(page).all('form')[0].hidden, false);
    } finally { page.close(); }
  });

  test('direct answer stays closed until requested and returns focus to the input', async () => {
    const question = { ...ENTRIES.find((entry) => entry.kind === 'question'), question_text: '기간을 선택해 주세요.', question_choices: ['3일', '7일'] };
    const page = await openPage('/', { answers: answersOf({ todo: { entries: [question], morning: [question], backup: null } }) });
    try {
      const form = mainOf(page).all('form')[0];
      const field = mainOf(page).all('textarea')[0];
      const toggle = mainOf(page).all('button').find((button) => button.textContent === '직접 쓰기');
      assert.equal(form.hidden, true);
      assert.equal(toggle.getAttribute('aria-expanded'), 'false');
      toggle.click();
      assert.equal(form.hidden, false);
      assert.equal(toggle.getAttribute('aria-expanded'), 'true');
      assert.equal(page.document.activeElement, field);
      toggle.click();
      assert.equal(form.hidden, true);
    } finally { page.close(); }
  });

  test('an opened empty answer and its keyboard focus survive a changed-data redraw', async () => {
    const question = { ...ENTRIES.find((entry) => entry.kind === 'question'), question_text: '처음 질문이에요.' };
    const answers = answersOf({ todo: { entries: [question], morning: [question], backup: null } });
    const page = await openPage('/', { answers });
    try {
      mainOf(page).all('button').find((button) => button.textContent === '직접 쓰기').click();
      assert.equal(page.document.activeElement, mainOf(page).all('textarea')[0]);
      const clarified = { ...question, question_text: '설명을 더한 질문이에요.' };
      answers['/api/todo'] = json(200, { entries: [clarified], morning: [clarified], backup: null });
      await page.shell.reload(); await page.settle();
      assert.equal(mainOf(page).all('form')[0].hidden, false);
      assert.equal(page.document.activeElement, mainOf(page).all('textarea')[0]);
    } finally { page.close(); }
  });

  test('an answer redraw waits for IME composition to finish and retains the completed text', async () => {
    const question = { ...ENTRIES.find((entry) => entry.kind === 'question'), question_text: '처음 질문이에요.' };
    const answers = answersOf({ todo: { entries: [question], morning: [question], backup: null } });
    const page = await openPage('/', { answers });
    try {
      mainOf(page).all('button').find((button) => button.textContent === '직접 쓰기').click();
      const field = mainOf(page).all('textarea')[0];
      field.dispatch('compositionstart');
      const clarified = { ...question, question_text: '설명을 더한 질문이에요.' };
      answers['/api/todo'] = json(200, { entries: [clarified], morning: [clarified], backup: null });
      await page.shell.reload(); await page.settle();
      assert.equal(mainOf(page).all('textarea')[0], field);
      assert.match(mainOf(page).textContent, /입력을 마치면 새 내용을 보여드려요/);
      field.value = '한글'; field.dispatch('input'); field.dispatch('compositionend');
      await page.settle();
      assert.notEqual(mainOf(page).all('textarea')[0], field);
      assert.equal(mainOf(page).all('textarea')[0].value, '한글');
      assert.equal(page.document.activeElement, mainOf(page).all('textarea')[0]);
    } finally { page.close(); }
  });

  test('a cancelled composition flushes a waiting redraw on blur', async () => {
    const question = { ...ENTRIES.find((entry) => entry.kind === 'question'), question_text: '처음 질문이에요.' };
    const answers = answersOf({ todo: { entries: [question], morning: [question], backup: null } });
    const page = await openPage('/', { answers });
    try {
      mainOf(page).all('button').find((button) => button.textContent === '직접 쓰기').click();
      const field = mainOf(page).all('textarea')[0];
      field.dispatch('compositionstart');
      const clarified = { ...question, question_text: '설명을 더한 질문이에요.' };
      answers['/api/todo'] = json(200, { entries: [clarified], morning: [clarified], backup: null });
      await page.shell.reload(); await page.settle();
      field.value = '작성 중'; field.dispatch('input'); field.dispatch('blur');
      await page.settle();
      assert.notEqual(mainOf(page).all('textarea')[0], field);
      assert.equal(mainOf(page).all('textarea')[0].value, '작성 중');
      assert.match(mainOf(page).textContent, /설명을 더한 질문이에요/);
    } finally { page.close(); }
  });

  test('an answer survives redraw when session storage is blocked', async () => {
    const question = { ...ENTRIES.find((entry) => entry.kind === 'question'), question_text: '처음 질문이에요.' };
    const answers = answersOf({ todo: { entries: [question], morning: [question], backup: null } });
    const page = await openPage('/', { answers, blocked: true });
    try {
      mainOf(page).all('button').find((button) => button.textContent === '직접 쓰기').click();
      const field = mainOf(page).all('textarea')[0];
      field.value = '작성 중'; field.dispatch('input');
      const clarified = { ...question, question_text: '설명을 더한 질문이에요.' };
      answers['/api/todo'] = json(200, { entries: [clarified], morning: [clarified], backup: null });
      await page.shell.reload(); await page.settle();
      assert.equal(mainOf(page).all('textarea')[0].value, '작성 중');
    } finally { page.close(); }
  });

  test('clearing an automatically opened draft does not collapse the field on redraw', async () => {
    const question = { ...ENTRIES.find((entry) => entry.kind === 'question'), question_text: '질문이에요.' };
    const answers = answersOf({ todo: { entries: [question], morning: [question], backup: null } });
    const first = await openPage('/', { answers });
    let session;
    try {
      mainOf(first).all('button').find((button) => button.textContent === '직접 쓰기').click();
      const field = mainOf(first).all('textarea')[0]; field.value = '남긴 글'; field.dispatch('input');
      session = Object.fromEntries(first.session.entries);
    } finally { first.close(); }
    const page = await openPage('/', { answers, session });
    try {
      const field = mainOf(page).all('textarea')[0]; assert.equal(mainOf(page).all('form')[0].hidden, false);
      field.focus(); field.value = ''; field.dispatch('input');
      const clarified = { ...question, question_text: '더 자세한 질문이에요.' };
      answers['/api/todo'] = json(200, { entries: [clarified], morning: [clarified], backup: null });
      await page.shell.reload(); await page.settle();
      assert.equal(mainOf(page).all('form')[0].hidden, false);
      assert.equal(page.document.activeElement, mainOf(page).all('textarea')[0]);
    } finally { page.close(); }
  });

  test('a manually collapsed draft stays collapsed on redraw and is not lost', async () => {
    const question = { ...ENTRIES.find((entry) => entry.kind === 'question'), question_text: '질문이에요.' };
    const answers = answersOf({ todo: { entries: [question], morning: [question], backup: null } });
    const page = await openPage('/', { answers });
    try {
      let toggle = mainOf(page).all('button').find((button) => button.textContent === '직접 쓰기');
      toggle.click();
      const field = mainOf(page).all('textarea')[0]; field.value = '남겨 둔 글'; field.dispatch('input');
      toggle.click(); assert.equal(mainOf(page).all('form')[0].hidden, true);
      const clarified = { ...question, question_text: '설명을 더한 질문이에요.' };
      answers['/api/todo'] = json(200, { entries: [clarified], morning: [clarified], backup: null });
      await page.shell.reload(); await page.settle();
      assert.equal(mainOf(page).all('form')[0].hidden, true);
      toggle = mainOf(page).all('button').find((button) => button.textContent === '직접 쓰기');
      toggle.click(); assert.equal(mainOf(page).all('textarea')[0].value, '남겨 둔 글');
    } finally { page.close(); }
  });

  test('two questions sharing a thread have distinct input controls', async () => {
    const question = { ...ENTRIES.find((entry) => entry.kind === 'question'), question_text: '첫 질문', diagram_name: '예약 그림' };
    const another = { ...question, since: earlier(1), question_text: '다른 질문', diagram_name: '배송 그림' };
    const page = await openPage('/', { answers: answersOf({ todo: { entries: [question, another], morning: [question, another], backup: null } }) });
    try {
      const cards = mainOf(page).all('section', 'morning-card');
      const ids = cards.map((card) => card.all('form')[0].getAttribute('id'));
      assert.notEqual(ids[0], ids[1]);
      assert.deepEqual(cards.map((card) => card.all('button').find((button) => button.textContent === '직접 쓰기').getAttribute('aria-controls')), ids);
      assert.match(cards[0].all('h3')[0].getAttribute('aria-label'), /예약 그림/);
      assert.match(cards[1].all('h3')[0].getAttribute('aria-label'), /배송 그림/);
    } finally { page.close(); }
  });

  test('a morning answer explains when recovery storage is unavailable', async () => {
    const question = { ...ENTRIES.find((entry) => entry.kind === 'question'), question_text: '답해 주세요.' };
    const page = await openPage('/', { answers: answersOf({ todo: { entries: [question], morning: [question], backup: null } }) });
    try {
      page.local.setItem = () => { throw new Error('full'); };
      const field = mainOf(page).all('textarea')[0];
      field.value = '답변'; field.dispatch('input');
      mainOf(page).all('form')[0].dispatch('submit'); await page.settle();
      assert.match(mainOf(page).textContent, /브라우저 저장 공간을 사용할 수 없어 보내지 못했어요/);
    } finally { page.close(); }
  });

  test('recovering a morning answer after reopening clears only the sent draft', async () => {
    const question = { ...ENTRIES.find((entry) => entry.kind === 'question'), question_text: '답해 주세요.' };
    const answers = answersOf({ todo: { entries: [question], morning: [question], backup: null } });
    const first = await openPage('/', { answers: (url, init) => init?.method === 'POST' ? new Error('lost') : answers[url](url, init) });
    let session; let local;
    try {
      const field = mainOf(first).all('textarea')[0];
      field.value = '  답변  '; field.dispatch('input');
      mainOf(first).all('form')[0].dispatch('submit'); await first.settle();
      session = Object.fromEntries(first.session.entries); local = Object.fromEntries(first.local.entries);
    } finally { first.close(); }
    const next = await openPage('/', { session, local, answers: (url, init) => init?.method === 'POST' ? json(201, {})() : answers[url](url, init) });
    try {
      assert.equal(mainOf(next).all('textarea')[0].value, '  답변  ');
      await next.shell.pending.retry(next.shell.pending.recovered()[0]); await next.settle();
      assert.equal(mainOf(next).all('textarea')[0].value, '');
    } finally { next.close(); }
  });

  test('a later question in the same thread does not reuse an earlier draft', async () => {
    const question = { ...ENTRIES.find((entry) => entry.kind === 'question'), question_text: '첫 질문이에요.' };
    const answers = answersOf({ todo: { entries: [question], morning: [question], backup: null } });
    const page = await openPage('/', { answers });
    try {
      const field = mainOf(page).all('textarea')[0]; field.value = '지난 답변'; field.dispatch('input');
      const next = { ...question, since: earlier(1), question_text: '다음 질문이에요.' };
      answers['/api/todo'] = json(200, { entries: [next], morning: [next], backup: null });
      await page.shell.reload(); await page.settle();
      assert.equal(mainOf(page).all('textarea')[0].value, '');
    } finally { page.close(); }
  });

  test('a clarification in the same unanswered question keeps its draft', async () => {
    const question = { ...ENTRIES.find((entry) => entry.kind === 'question'), question_text: '첫 질문이에요.' };
    const answers = answersOf({ todo: { entries: [question], morning: [question], backup: null } });
    const page = await openPage('/', { answers });
    try {
      const field = mainOf(page).all('textarea')[0]; field.value = '적고 있는 답'; field.dispatch('input');
      const clarified = { ...question, question_text: '질문에 대한 설명이에요.' };
      answers['/api/todo'] = json(200, { entries: [clarified], morning: [clarified], backup: null });
      await page.shell.reload(); await page.settle();
      assert.equal(mainOf(page).all('textarea')[0].value, '적고 있는 답');
    } finally { page.close(); }
  });

  test('an explicit answer choice can be undone before it is sent', async () => {
    const question = { ...ENTRIES.find((entry) => entry.kind === 'question'), question_text: '기간을 선택해 주세요.', question_choices: ['3일', '7일'] };
    const path = `/api/projects/${question.project}/threads/${question.thread}/comments`;
    const page = await openPage('/', { answers: { ...answersOf({ todo: { entries: [question], morning: [question], backup: null } }), [path]: json(201, {}) } });
    try {
      const choice = mainOf(page).all('button').find((button) => button.textContent === '7일');
      assert.ok(choice);
      choice.click();
      assert.ok(page.app.textContent.includes('10초 뒤 보내요'));
      const undo = page.app.all('button').find((button) => button.textContent === '되돌리기');
      assert.ok(undo); undo.click();
      await page.settle();
      assert.equal(page.calls.includes(path), false);
      assert.ok(page.app.textContent.includes('되돌렸어요'));
    } finally { page.close(); }
  });

  test('home does not show zero when its to-do read fails or imply a capped list is complete', async () => {
    const missing = await openPage('/', { answers: { ...answersOf(), '/api/todo': problem(500, 'internal') } });
    try {
      assert.match(mainOf(missing).textContent, /할 일 수를 읽지 못했어요/);
      assert.doesNotMatch(mainOf(missing).textContent, /답할 질문 0개/);
      assert.doesNotMatch(mainOf(missing).textContent, /최근 질문에 답하기/);
    } finally { missing.close(); }
    const full = await openPage('/', { answers: answersOf({ todo: { entries: Array(5000).fill(ENTRIES[0]), morning: ENTRIES.slice(0, 5), backup: null } }) });
    try { assert.match(mainOf(full).textContent, /적어도 5000가지/); }
    finally { full.close(); }
  });

  test('a failed refresh keeps earlier project counts labelled as old until a successful retry', async () => {
    const answers = answersOf();
    const page = await openPage('/', { answers });
    try {
      assert.match(mainOf(page).textContent, /오늘 할 일은 6가지예요/);
      answers['/api/todo'] = problem(500, 'internal');
      await page.shell.reload();
      assert.match(mainOf(page).textContent, /이전 정보예요/);
      assert.match(mainOf(page).textContent, /오늘 할 일은 6가지예요/);
      assert.ok(mainOf(page).all('button').some((button) => button.textContent === '다시 시도'));
      answers['/api/todo'] = json(200, TODO);
      await page.shell.reload();
      assert.match(mainOf(page).textContent, /오늘 할 일은 6가지예요/);
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
  test('the full inbox shows each item in API order with its target and age', async () => {
    const page = await openTodo();
    try {
      assert.deepEqual(texts(page, 'h1'), ['모든 할 일']);
      assert.equal(page.document.title, '모든 할 일 · NEXUS');
      assert.deepEqual(rowsOf(page).map((row) => row.href), ENTRIES.map((entry) => stageHref(entry.project, entry.part, entry.stage, { diagram: entry.diagram, thread: entry.thread })));
      assert.deepEqual(mainOf(page).all('time').map((time) => time.getAttribute('datetime')), ENTRIES.map((entry) => entry.since));
      assert.doesNotMatch(mainOf(page).textContent, /\b(?:dg|nc|np)_/);
      assert.equal(headerOf(page).all('span', 'cnt')[0].textContent, String(ENTRIES.length));
      assert.equal(errorShown(page), false);
    } finally { page.close(); }
  });

  test('the inbox keeps its expanded batch after a reload', async () => {
    const entries = Array.from({ length: 120 }, (_, index) => ({ ...ENTRIES[index % ENTRIES.length], since: earlier(index + 1) }));
    const page = await openTodo({ answers: answersOf({ todo: { entries, morning: [], backup: null } }) });
    try {
      page.app.all('button').find((button) => button.textContent === '다음 할 일 보기').click();
      assert.equal(rowsOf(page).length, 100);
      await page.shell.reload(); await page.settle();
      assert.equal(rowsOf(page).length, 100);
    } finally { page.close(); }
  });

  test('each reason a diagram waits for its confirmation has its words, and only a confirmation says one', () => {
    assert.deepEqual(Object.keys(REASONS), contract.components.schemas.OwnerTodoEntry.properties.reason.anyOf[0].enum);
  });

  test('the full inbox shows all entries in batches, in order', async () => {
    const most = contract.components.schemas.OwnerTodo.properties.entries.maxItems;
    const entries = Array.from({ length: most }, (_, index) => ({ ...ENTRIES[index % ENTRIES.length], since: earlier(12 + index) }));
    const page = await openTodo({ answers: answersOf({ todo: { entries, backup: null } }) });
    try {
      assert.equal(rowsOf(page).length, 50);
      for (let n = 50; n < most; n += 50) page.app.all('button').find((button) => button.textContent === '다음 할 일 보기').click();
      assert.equal(rowsOf(page).length, most);
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
      assert.ok(body.indexOf(warningOf(page)[0]) < body.indexOf(mainOf(page).all('div', 'morning-cards')[0]));
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
      assert.deepEqual(texts(page, 'h1'), ['모든 할 일']);
      const groups = main.all('section', 'group');
      assert.deepEqual(groups.map((group) => [group.all('span', 'line').length, group.all('span', 'row').length, group.getAttribute('aria-hidden')]), [[1, 2, 'true'], [1, 2, 'true']]);
      assert.deepEqual([main.all('button'), main.all('a')], [[], []]);
      assert.equal(page.app.textContent.includes('독서 모임 앱'), false);
      for (const release of held) release();
      await waitFor(() => rowsOf(page).length === ENTRIES.length);
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
        assert.deepEqual(texts(page, 'h1'), ['모든 할 일']);
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
    assert.deepEqual(answer.json, { entries: [], morning: [], backup: null });
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
      ['demo', 'confirm'], ['reading-club', 'confirm'], ['reading-club', 'confirm'], ['reading-club', 'confirm'],
      ['reading-club', 'proposal'], ['reading-club', 'question'],
    ]);
    assert.ok(answer.json.backup);
    // A clock 30 s into its minute, so that no minute, hour or day turns between the drawing and the check.
    const restore = clockAt(Math.floor(Date.now() / 60_000) * 60_000 + 30_000);
    const page = await openOn(good, owner());
    try {
      assert.deepEqual(rowsOf(page).map((row) => row.href), entries.map((each) =>
        stageHref(each.project, each.part, each.stage, { diagram: each.diagram, thread: each.thread })));
      assert.deepEqual(rowsOf(page).map((row) => row.time), entries.map((each) => ago(each.since, Date.now())));
      assert.ok(rowsOf(page).some((row) => row.text.includes('확정을 취소했어요')));
      assert.ok(rowsOf(page).some((row) => row.text.includes('지난 확정 뒤 확인할 내용이 생겼어요. 그림을 다시 확인해 주세요')));
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
        assert.deepEqual(texts(page, 'h1'), ['모든 할 일']);
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
