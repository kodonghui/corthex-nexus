// SCR-145's "이 그림" and SCR-146 (TASK-461; SPEC-023, SPEC-029, SPEC-030, SPEC-034) on test/fake-dom.js: the state of
// the latest confirmation, the elements changed since it, 이 그림 확정 asked once, 확정 취소, the loading and empty work
// panels, and SCR-146's states at both widths. Then both screens against the server, with every response API-273,
// API-275 and API-276 list. How they look, at 360 and 1440 pixels in light and dark, is the browser walk of the pull
// request.

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { createPages } from '../src/pages.js';
import { idOf, keyOf } from '../src/ids.js';
import { ROUTES } from '../src/routes.js';
import { openStore } from '../src/store.js';
import { GATE_KEY } from '../web/states.js';
import { contract, validate } from './contract.js';
import { listedResponses, responseRecord } from './responses.js';
import { json, message, openPage, problem, texts } from './screen-page.js';
import { REPOSITORY, seed } from './seed.js';
import { localGate, newId, startServer } from './support.js';

// The modules that import ./layout.js load once screen-page.js has taught the import where the server serves it from.
const { CHANGE_WORDS, waitingCount } = await import('../web/changes.js');
const { changedSentence, changedTag, CONFIRM_WORDS, countTag, moreChanges } = await import('../web/confirm.js');
const { WORKBENCH_WORDS } = await import('../web/workbench.js');
const { MARK_WORDS } = await import('../web/overlays.js');
const { tagWord } = await import('../web/picture.js');

const TIME = '2026-11-23T01:00:00.000Z';
const P = 'reading-club';
const ID = Object.freeze({ erd: 'dg_0000000000c5', board: 'dg_0000000000c1', mockup: 'dg_0000000000c9', oldErd: 'dg_0000000000c6' });
const DRAWING = Object.freeze({ erd: 'dw_0000000000c5', board: 'dw_0000000000c1', mockup: 'dw_0000000000c9', oldErd: 'dw_0000000000c6', confirmed: 'dw_0000000000c0' });
const CONFIRMED_AT = 'b41c9e2'.padEnd(40, '0');
const stored = (name) => JSON.parse(readFileSync(new URL(`./${name}`, import.meta.url), 'utf8'));
const asElement = (element) => ({
  key: element.key, trace_id: element.trace_id ?? null, kind: element.kind, name: element.name ?? '', parent: element.parent ?? null,
  status: element.status ?? null, detail: element.detail ?? {}, position: null,
});
const ERD = stored('erd-expected.json').elements;
const BOARD = stored('ddd-board-expected.json').elements;
const TABLES = ERD.filter((element) => element.kind === 'table');
const [A, B, C, D, E] = TABLES;
const COMMANDS = BOARD.filter((element) => element.kind === 'command');
const TOKENS = [
  { key: 'color.brand', trace_id: null, kind: 'token', name: 'color.brand', parent: null, status: null, detail: { values: ['#4589ff'] } },
  { key: 'space.04', trace_id: null, kind: 'token', name: 'space.04', parent: null, status: null, detail: { values: ['16px'] } },
];
const DIAGRAMS = Object.freeze({
  erd: ['05-erd', 'erd', 'ERD', ERD],
  oldErd: ['05-erd', 'erd', 'Old ERD', ERD],
  board: ['01-domain', 'ddd_board', 'DDD board', BOARD],
  mockup: ['09-mockup', 'mockup', 'mockup.html', TOKENS],
});

// API-265's Diagram of one of DIAGRAMS, drawn and never confirmed; fields replaces what it gives.
function diagramOf(which, fields = {}) {
  const [stage, kind, name, elements] = DIAGRAMS[which];
  const body = {
    id: ID[which], project: P, part: '', stage, kind, name, removed: which === 'oldErd',
    drawing: { id: DRAWING[which], revision: 3, version: 'a'.repeat(40), status: 'drawn', failed_at: null, drawn_at: TIME },
    last_drawn: null, elements: elements.map(asElement), overlays: [], since_confirmation: null, confirmation: null, threads: [],
    ...fields,
  };
  assert.deepEqual(validate(contract, body, { $ref: '#/components/schemas/Diagram' }), [], which);
  return body;
}

// The latest confirmation of which's diagram in a state, at CONFIRMED_AT, with what changed since then.
const confirmationOf = (which, state, fields = {}) => ({
  id: 'nk_0000000000k1', diagram: ID[which], drawing: DRAWING.confirmed, version: CONFIRMED_AT, state, confirmed_at: TIME,
  ended_at: state === 'confirmed' ? null : TIME, recorded_at: null, cancel_recorded_at: null, pull_request: null,
  ...fields,
});
const sinceOf = ({ added = [], changed = [], removed = [] } = {}) => ({ version: CONFIRMED_AT, added, changed, removed });
// The mockup's six: three tables added, two changed and one removed.
const SIX = sinceOf({ added: [A.key, B.key, C.key], changed: [D.key, E.key], removed: ['TBL-999'] });
const confirmedWith = (which, state, since = SIX, fields = {}) => diagramOf(which, {
  since_confirmation: since, confirmation: confirmationOf(which, state, fields),
});

// A change set of the ERD as API-265 lists it.
const setOf = (id, origin, changes, fields = {}) => ({
  id, part: '', stage: '05-erd', diagram: ID.erd, drawing: DRAWING.erd, version: 'a'.repeat(40), origin,
  thread: origin === 'proposal' ? 'nc_0000000000t1' : null, state: 'accepted', items: [], adds: [], reason: null, change: null, source_text: false,
  changes, made_at: TIME, decided_at: TIME, reflection: null, pull_request: null, ...fields,
});
const RENAMED = setOf('np_0000000000e1', 'direct_edit', [{ op: 'rename', element: B.key, name: 'project_rooms', target: null }]);
const ACCEPTED = setOf('np_0000000000e2', 'proposal', [{ op: 'rename', element: C.key, name: 'snapshot_rows', target: null }], {
  items: ['TBL-148'], change: 'Rename snapshots to snapshot_rows.', reason: 'Rows, as the other tables.',
});
const PROPOSED = { ...ACCEPTED, state: 'proposed', decided_at: null };

const STAGE_IDS = ['01-domain', '02-prd', '03-user-flow', '04-functional-spec', '05-erd', '06-api', '07-sitemap', '08-screen-states', '09-mockup', '10-wbs', '11-development', '12-qa', '13-presentation'];
const summaryOf = (which) => {
  const [, kind, name] = DIAGRAMS[which];
  return { id: ID[which], kind, name, removed: which === 'oldErd', drawn: true, confirmation: 'none', waiting: 0, open_threads: which === 'oldErd' ? 1 : 0 };
};
// API-264's Project: the board on stage 01, the ERD with a removed one listed last on stage 05, the mockup on stage 09.
function projectOf(repository = REPOSITORY) {
  const listed = { '01-domain': ['board'], '05-erd': ['erd', 'oldErd'], '09-mockup': ['mockup'] };
  return {
    name: P, title: '독서 모임 앱', repository, revision: 3, commit: 'a'.repeat(40), pushed_at: TIME, parts: [],
    stages: STAGE_IDS.map((stage) => ({
      stage, part: '', state: listed[stage] ? 'open' : 'not_sent', passed_at: null, diagrams: (listed[stage] ?? []).map(summaryOf),
    })),
    tool_links: [],
    workshop: null,
  };
}

const diagramPath = (which) => `/api/projects/${P}/diagrams/${ID[which]}`;
const confirmPath = (which) => `${diagramPath(which)}/confirmation`;
const cancelPath = (id) => `/api/projects/${P}/confirmations/${id}/cancel`;
const stageHrefOf = (which) => `/p/${P}/_/${DIAGRAMS[which][0]}`;

// Opens SCR-145 (screen 'stage') or SCR-146 ('changes') at which's diagram, read as diagram gives it (later reads as
// page.reads says by path); a POST is kept in page.sent as { path, body, key } and answered by posted(path, body), a
// function that makes a Response, or a Promise of one.
async function openAt(which, { screen = 'stage', diagram = diagramOf(which), phone = false, repository = REPOSITORY, posted = () => json(500, {}) } = {}) {
  const reads = {
    '/api/projects': json(200, { projects: [], backup: null }),
    '/api/todo': json(200, { entries: [], backup: null }),
    [`/api/projects/${P}`]: json(200, projectOf(repository)),
    [diagramPath(which)]: json(200, diagram),
    [`${diagramPath(which)}/page`]: () => new Response('<!doctype html><title>m</title>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }),
  };
  const sent = [];
  const search = which === 'oldErd' ? `?d=${ID.oldErd}` : '';
  const page = await openPage(`${stageHrefOf(which)}${screen === 'changes' ? '/changes' : ''}`, {
    search,
    phone,
    answers: (path, init) => {
      if (init?.method === 'POST') {
        const body = JSON.parse(init.body);
        sent.push({ path, body, key: init.headers['idempotency-key'] });
        return posted(path, body)();
      }
      const answer = reads[path];
      if (answer === undefined) throw new Error(`no answer for ${path}`);
      return answer(path, init);
    },
  });
  page.sent = sent;
  page.reads = reads;
  return page;
}

// A Response held until release() is called, as an answer still on its way.
function held(made) {
  let release;
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  return { answer: () => promise.then(() => made()), release: () => release() };
}

const byId = (page, id) => page.document.getElementById(id);
const panelOf = (page) => page.app.all('aside')[0];
const sectionOf = (page, label) => panelOf(page).all('section').find((section) => section.getAttribute('aria-label') === label);
const diagramSection = (page) => sectionOf(page, CHANGE_WORDS.diagram);
const lineOf = (page) => page.app.all('div', 'wb-line')[0];
const buttonsIn = (node) => node.all('button').map((button) => button.textContent);
const shownTexts = (node, tag, className = null) => node.all(tag, className).filter((element) => element.shown).map((element) => element.textContent);
const tagsIn = (node) => shownTexts(node, 'span', 'tag');
const focused = (page, element, what = 'the focus') => assert.ok(element !== null && element !== undefined && page.document.activeElement === element, what);
const press = (button) => {
  button.focus();
  button.click();
};
const mainOf = (page) => page.app.all('main')[0];
// SCR-146's rows of a group, as [tag, name, kind].
const pageRows = (group) => group.all('div', 'li').map((row) => [row.all('span', 'tag')[0].textContent, row.all('b')[0].textContent, row.all('span', 'small')[0]?.textContent ?? row.all('span', 'sec')[0]?.textContent ?? null]);
const groupNamed = (page, heading) => mainOf(page).all('section', 'group').find((group) => group.all('h2')[0]?.textContent === heading);
const kindOf = (element) => tagWord({ kind: 'erd' }, asElement(element));

describe('SCR-145 "이 그림"', () => {
  test('never confirmed: a phone also offers confirmation with a second question', async () => {
    const page = await openAt('erd');
    try {
      const section = diagramSection(page);
      assert.equal(section.hidden, false);
      assert.deepEqual(shownTexts(section, 'h2'), [CHANGE_WORDS.diagram]);
      assert.deepEqual(tagsIn(section), ['확정 전']);
      assert.deepEqual(shownTexts(section, 'p'), ['아직 확정한 적이 없어서 바뀐 곳 표시가 없어요.', '남은 AI 제안은 확정에 들어가지 않아요.', CONFIRM_WORDS.beforeConfirm]);
      assert.deepEqual(buttonsIn(section), ['이 그림 확정하고 기록 요청']);
      assert.equal(byId(page, 'confirm').getAttribute('class'), 'btn primary wide');
      // The panel's order: 이 그림, AI 제안, the Selected section.
      assert.deepEqual(panelOf(page).children.filter((child) => child.shown).map((child) => child.getAttribute('aria-label')), [CHANGE_WORDS.diagram, CHANGE_WORDS.proposals, WORKBENCH_WORDS.selected]);
    } finally {
      page.close();
    }
    const phone = await openAt('erd', { phone: true, diagram: diagramOf('erd', { overlays: [PROPOSED] }) });
    try {
      assert.equal(diagramSection(phone).hidden, false);
      assert.deepEqual(shownTexts(diagramSection(phone), 'p'), [CONFIRM_WORDS.neverConfirmed, CONFIRM_WORDS.leftOut, CONFIRM_WORDS.beforeConfirm, CONFIRM_WORDS.phone]);
      assert.ok(byId(phone, 'confirm') !== null);
      press(byId(phone, 'confirm'));
      assert.equal(phone.sent.length, 0);
      assert.ok(byId(phone, 'confirm-yes') !== null);
      press(byId(phone, 'confirm-stop'));
      assert.equal(phone.sent.length, 0);
      press(byId(phone, 'confirm'));
      press(byId(phone, 'confirm-yes'));
      await phone.settle();
      assert.equal(phone.sent.length, 1);
    } finally {
      phone.close();
    }
  });

  test('changed since its confirmation: 바뀐 곳 N, the sentence, four elements (더함, then 바뀜, then 뺌) and "+N개 더" to SCR-146', async () => {
    const page = await openAt('erd', { diagram: confirmedWith('erd', 'invalidated') });
    try {
      const section = diagramSection(page);
      assert.deepEqual(tagsIn(section).slice(0, 1), [changedTag(6)]);
      assert.equal(changedTag(6), '바뀐 곳 6');
      assert.deepEqual(shownTexts(section, 'p', 'sec'), [changedSentence(6)]);
      assert.equal(changedSentence(6), '확정한 뒤 바뀐 곳이 6개 있어요. 다시 확정하면 에이전트가 기록해요.');
      const rows = section.all('ul', 'chg')[0].all('li').map((li) => [li.all('span', 'tag')[0].textContent, li.all('span', 'grow')[0].textContent, li.all('span', 'sec')[0]?.textContent]);
      assert.deepEqual(rows, [['더함', A.name, kindOf(A)], ['더함', B.name, kindOf(B)], ['더함', C.name, kindOf(C)], ['바뀜', D.name, kindOf(D)]]);
      const more = section.all('a')[0];
      assert.deepEqual([more.textContent, more.getAttribute('href')], [moreChanges(2), `/p/${P}/_/05-erd/changes?d=${ID.erd}`]);
      assert.equal(moreChanges(2), '+2개 더 · 바뀐 곳 모두 보기');
      assert.deepEqual(shownTexts(section, 'p', 'small'), [CONFIRM_WORDS.leftOut]);
      assert.deepEqual(buttonsIn(section), ['바뀐 곳 둘러보기', '이 그림 확정하고 기록 요청']);
      section.all('button').find((button) => button.textContent === '바뀐 곳 둘러보기').click();
      assert.ok(page.app.all('button').some((button) => button.getAttribute('aria-pressed') === 'true' && button.textContent.includes(A.name)));
      assert.equal(page.document.activeElement?.getAttribute('id'), 'element-name');
    } finally {
      page.close();
    }
    // Four or fewer: every one, and no "+N개 더"; the removed one by its key.
    const four = await openAt('erd', { diagram: confirmedWith('erd', 'invalidated', sinceOf({ added: [A.key], changed: [D.key], removed: ['TBL-999'] })) });
    try {
      const section = diagramSection(four);
      assert.deepEqual(section.all('li').map((li) => li.all('span', 'grow')[0].textContent), [A.name, D.name, 'TBL-999']);
      assert.deepEqual(section.all('li')[2].all('span', 'sec').map((span) => span.textContent), ['문서에서 뺐어요']);
      assert.equal(section.all('a').length, 0);
    } finally {
      four.close();
    }
  });

  test('ended with nothing changed is 확정 전 alone; cancelled is 확정 전 with "확정을 취소했어요. …" and what changed since', async () => {
    const quiet = await openAt('erd', { diagram: confirmedWith('erd', 'invalidated', sinceOf()) });
    try {
      const section = diagramSection(quiet);
      assert.deepEqual(tagsIn(section), ['확정 전']);
      assert.deepEqual(shownTexts(section, 'p'), [CONFIRM_WORDS.leftOut, CONFIRM_WORDS.beforeConfirm]);
      assert.deepEqual(buttonsIn(section), ['이 그림 확정하고 기록 요청']);
    } finally {
      quiet.close();
    }
    const cancelled = await openAt('erd', { diagram: confirmedWith('erd', 'cancelled', sinceOf({ changed: [D.key] })) });
    try {
      const section = diagramSection(cancelled);
      assert.deepEqual(tagsIn(section), ['확정 전', '바뀜']);
      assert.deepEqual(shownTexts(section, 'p', 'sec'), ['확정을 취소했어요. 다시 확정할 때까지 할 일에 남아요.']);
      assert.deepEqual(section.all('li').map((li) => li.all('span', 'grow')[0].textContent), [D.name]);
      assert.deepEqual(buttonsIn(section), ['바뀐 곳 둘러보기', '이 그림 확정하고 기록 요청']);
    } finally {
      cancelled.close();
    }
  });

  test('confirmed (SCR-145#confirmed): 확정함, the message, the recording explanation and 확정 취소, also while the record\'s pull request is open; a phone without 확정 취소', async () => {
    for (const phone of [false, true]) {
      for (const fields of [{}, { pull_request: `${REPOSITORY}/pull/12` }]) {
        const page = await openAt('erd', { phone, diagram: confirmedWith('erd', 'confirmed', sinceOf(), fields) });
        const which = `${phone ? 'phone' : 'PC'} ${JSON.stringify(fields)}`;
        try {
          const section = diagramSection(page);
          assert.deepEqual(tagsIn(section), ['확정함'], which);
          assert.deepEqual(shownTexts(section, 'p'), [CONFIRM_WORDS.confirmedHere, CONFIRM_WORDS.untilRecorded], which);
          assert.deepEqual(shownTexts(section, 'p', 'small'), [CONFIRM_WORDS.untilRecorded], which);
          // The open pull request is not shown before the record (choice 3).
          assert.deepEqual([section.all('a').length, section.all('time').length], [0, 0], which);
          assert.deepEqual(buttonsIn(section), phone ? [] : ['확정 취소'], which);
          if (!phone) assert.equal(byId(page, 'cancel-confirmation').getAttribute('class'), 'btn tertiary wide');
        } finally {
          page.close();
        }
      }
    }
  });

  test('a phone retains a live confirmation tag when the current drawing fails', async () => {
    const diagram = confirmedWith('erd', 'confirmed', sinceOf());
    diagram.last_drawn = diagram.drawing;
    diagram.drawing = { ...diagram.drawing, status: 'failed', failed_at: null };
    const page = await openAt('erd', { phone: true, diagram });
    try {
      const section = diagramSection(page);
      assert.deepEqual(tagsIn(section), ['확정함', '그려지지 않음']);
      assert.ok(shownTexts(section, 'p').includes(CONFIRM_WORDS.confirmedHere));
      assert.deepEqual(buttonsIn(section), []);
    } finally { page.close(); }
  });

  test('recorded (SCR-145#confirmed): "기록됨 · 3분 전 · PR #12 ↗", the pull request a link in a new tab; without one "기록됨 · 3분 전" alone, on a PC and a phone', async () => {
    const recordedAt = new Date(Date.now() - 3 * 60_000).toISOString();
    for (const phone of [false, true]) {
      const page = await openAt('erd', { phone, diagram: confirmedWith('erd', 'confirmed', sinceOf(), { recorded_at: recordedAt, pull_request: `${REPOSITORY}/pull/12` }) });
      try {
        const section = diagramSection(page);
        assert.deepEqual(tagsIn(section), ['확정함']);
        assert.deepEqual(shownTexts(section, 'p'), [CONFIRM_WORDS.confirmedHere, '기록됨 · 3분 전 · PR #12 ↗']);
        const [link, ...more] = section.all('a');
        assert.deepEqual([more.length, link.textContent, link.getAttribute('href'), link.getAttribute('target'), link.getAttribute('rel')], [
          0, 'PR #12 ↗', `${REPOSITORY}/pull/12`, '_blank', 'noopener noreferrer',
        ]);
        assert.deepEqual(section.all('time').map((time) => time.textContent), ['기록됨 · 3분 전']);
        assert.deepEqual(buttonsIn(section), phone ? [] : ['확정 취소']);
      } finally {
        page.close();
      }
      // Recorded with no link to give (no repository, or a cancel's pull request closed unmerged): the time alone.
      const bare = await openAt('erd', { phone, diagram: confirmedWith('erd', 'confirmed', sinceOf(), { recorded_at: recordedAt }) });
      try {
        const section = diagramSection(bare);
        assert.deepEqual(shownTexts(section, 'p', 'small'), ['기록됨 · 3분 전']);
        assert.equal(section.all('a').length, 0);
      } finally {
        bare.close();
      }
    }
    // Only an https link of a pull request is a link, what the contract would refuse included.
    const { recordPullRequest } = await import('../web/confirm.js');
    const { fakePage } = await import('./fake-dom.js');
    const restore = fakePage({ pathname: '/' }).install();
    try {
      for (const link of [
        null, 'http://example.com/demo/pull/12', 'javascript:alert(1)//pull/12', 'https://example.com/demo/pull/',
        'https://example.com/demo/pull/0', 'https://example.com/demo/tree/12', 'https://example.com/demo/pull/12 x',
      ]) {
        assert.equal(recordPullRequest(link), null, String(link));
      }
      const link = recordPullRequest('https://example.com/demo/pull/7');
      assert.deepEqual([link.tagName, link.textContent, link.getAttribute('href'), link.getAttribute('target'), link.getAttribute('rel')], [
        'A', 'PR #7 ↗', 'https://example.com/demo/pull/7', '_blank', 'noopener noreferrer',
      ]);
    } finally {
      restore();
    }
  });

  test('not drawn (SCR-145#not-drawn): 그려지지 않음, "문서를 고쳐 그려지게 한 뒤 확정하세요." and the button off', async () => {
    const failed = { id: 'dw_0000000000c7', revision: 4, version: 'c'.repeat(40), status: 'failed', failed_at: 'db/nexus.sql:12', drawn_at: TIME };
    const page = await openAt('erd', { diagram: diagramOf('erd', { drawing: failed, last_drawn: diagramOf('erd').drawing }) });
    try {
      const section = diagramSection(page);
      assert.deepEqual(tagsIn(section), ['그려지지 않음']);
      assert.deepEqual(shownTexts(section, 'p'), [CONFIRM_WORDS.fixFirst]);
      const button = section.all('button')[0];
      assert.deepEqual([button.textContent, button.getAttribute('disabled')], ['이 그림 확정하고 기록 요청', '']);
      button.click();
      assert.equal(page.sent.length, 0);
    } finally {
      page.close();
    }
    const phone = await openAt('erd', { phone: true, diagram: diagramOf('erd', { drawing: failed, last_drawn: diagramOf('erd').drawing }) });
    try {
      const section = diagramSection(phone);
      assert.deepEqual(tagsIn(section), ['그려지지 않음']);
      assert.deepEqual(shownTexts(section, 'p'), [CONFIRM_WORDS.phoneNotDrawn, CONFIRM_WORDS.phone]);
      assert.equal(section.all('button').length, 0);
    } finally { phone.close(); }
  });

  test('what waits keeps the waiting state; with a live confirmation it shows both tags and 확정 취소 in the off button\'s place', async () => {
    const waiting = await openAt('erd', { diagram: diagramOf('erd', { overlays: [RENAMED] }) });
    try {
      const section = diagramSection(waiting);
      assert.deepEqual(tagsIn(section), [waitingCount(1)]);
      assert.deepEqual(shownTexts(section, 'p'), [CHANGE_WORDS.waitingWhy]);
      assert.equal(section.all('button').at(-1).getAttribute('disabled'), '');
    } finally {
      waiting.close();
    }
    const live = await openAt('erd', { diagram: diagramOf('erd', { overlays: [RENAMED], since_confirmation: sinceOf(), confirmation: confirmationOf('erd', 'confirmed') }) });
    try {
      const section = diagramSection(live);
      assert.deepEqual(tagsIn(section), ['확정함', waitingCount(1)]);
      assert.deepEqual(shownTexts(section, 'p'), [CONFIRM_WORDS.confirmedHere, CONFIRM_WORDS.untilRecorded]);
      assert.deepEqual(buttonsIn(section), [CHANGE_WORDS.cancelEdit, '확정 취소']);
    } finally {
      live.close();
    }
  });

  test('a removed diagram has neither 이 그림 확정 nor 확정 취소, its confirmation live or not (SPEC-027)', async () => {
    for (const confirmation of [null, confirmationOf('oldErd', 'confirmed')]) {
      const page = await openAt('oldErd', { diagram: diagramOf('oldErd', { since_confirmation: confirmation === null ? null : sinceOf(), confirmation }) });
      try {
        assert.equal(diagramSection(page).hidden, true);
        assert.ok(byId(page, 'confirm') === null && byId(page, 'cancel-confirmation') === null);
      } finally {
        page.close();
      }
    }
  });

  test('a mockup lists its tokens in "이 그림" on a PC, above 이 그림 확정, and under the frame on a phone', async () => {
    const page = await openAt('mockup');
    try {
      const section = diagramSection(page);
      assert.deepEqual(shownTexts(section, 'h3'), ['이 목업이 쓰는 토큰 2개']);
      assert.deepEqual(shownTexts(section, 'p'), [CONFIRM_WORDS.neverConfirmed, CONFIRM_WORDS.beforeConfirm]);
      const order = section.descendants().filter((element) => element.tagName === 'H3' || element.getAttribute('id') === 'confirm').map((element) => element.tagName);
      assert.deepEqual(order, ['H3', 'BUTTON']);
      // One 이 그림 section, then the mockup's own AI 제안 note.
      assert.equal(panelOf(page).all('h2').filter((h2) => h2.textContent === CHANGE_WORDS.diagram).length, 1);
    } finally {
      page.close();
    }
    const phone = await openAt('mockup', { phone: true });
    try {
      assert.equal(diagramSection(phone).hidden, false);
      assert.deepEqual(shownTexts(diagramSection(phone), 'p'), [CONFIRM_WORDS.neverConfirmed, CONFIRM_WORDS.beforeConfirm, CONFIRM_WORDS.phone]);
      assert.deepEqual(texts(phone, 'h3'), ['이 목업이 쓰는 토큰 2개']);
    } finally {
      phone.close();
    }
  });

  test('the record request asks once with confirm and cancel; 취소 and Escape stop; 확정 sends API-275 with every button off until the diagram is read again', async () => {
    const answer = held(json(201, { confirmation: confirmationOf('erd', 'confirmed', { drawing: DRAWING.erd, version: 'a'.repeat(40) }), changed: true }));
    const page = await openAt('erd', { posted: () => answer.answer });
    try {
      press(byId(page, 'confirm'));
      assert.ok(shownTexts(diagramSection(page), 'p').includes(CONFIRM_WORDS.beforeConfirm));
      const group = diagramSection(page).all('div', 'btns').find((div) => div.getAttribute('role') === 'group');
      assert.deepEqual([shownTexts(group, 'span'), buttonsIn(group)], [[CONFIRM_WORDS.askConfirm], [CONFIRM_WORDS.yes, '취소']]);
      assert.equal(group.getAttribute('aria-labelledby'), 'confirm-ask');
      focused(page, byId(page, 'confirm-stop'), '취소 has the focus');
      press(byId(page, 'confirm-stop'));
      focused(page, byId(page, 'confirm'), '이 그림 확정 has the focus again');
      press(byId(page, 'confirm'));
      byId(page, 'confirm-yes').parent.dispatch('keydown', { key: 'Escape' });
      assert.ok(byId(page, 'confirm-yes') === null);
      assert.equal(page.sent.length, 0);
      press(byId(page, 'confirm'));
      page.reads[diagramPath('erd')] = json(200, diagramOf('erd', {
        since_confirmation: { ...sinceOf(), version: 'a'.repeat(40) },
        confirmation: confirmationOf('erd', 'confirmed', { drawing: DRAWING.erd, version: 'a'.repeat(40) }),
      }));
      press(byId(page, 'confirm-yes'));
      await new Promise((resolve) => setTimeout(resolve, 5));
      assert.deepEqual(page.sent.map((each) => [each.path, each.body]), [[confirmPath('erd'), { drawing: DRAWING.erd }]]);
      assert.match(page.sent[0].key, /^"nw_[0-9a-hjkmnp-tv-z]{12}"$/);
      // While it is sent: the question stays, its buttons off.
      assert.equal(byId(page, 'confirm-yes').getAttribute('aria-disabled'), 'true');
      byId(page, 'confirm-yes').click();
      assert.equal(page.sent.length, 1);
      answer.release();
      await page.settle();
      assert.deepEqual(tagsIn(diagramSection(page)), ['확정함']);
      assert.deepEqual(buttonsIn(diagramSection(page)), ['확정 취소']);
      focused(page, byId(page, 'diagram-heading'), '"이 그림" has the focus');
    } finally {
      page.close();
    }
  });

  test('확정 취소 sends API-276 at once, and the diagram read again is not confirmed', async () => {
    const live = confirmationOf('erd', 'confirmed');
    const page = await openAt('erd', {
      diagram: confirmedWith('erd', 'confirmed', sinceOf()),
      posted: () => json(200, { confirmation: { ...live, state: 'cancelled', ended_at: TIME }, changed: true }),
    });
    try {
      page.reads[diagramPath('erd')] = json(200, confirmedWith('erd', 'cancelled', sinceOf()));
      press(byId(page, 'cancel-confirmation'));
      await page.settle();
      assert.deepEqual(page.sent.map((each) => [each.path, each.body]), [[cancelPath(live.id), {}]]);
      const section = diagramSection(page);
      assert.deepEqual(tagsIn(section), ['확정 전']);
      assert.deepEqual(shownTexts(section, 'p', 'sec'), [CONFIRM_WORDS.cancelled]);
      assert.deepEqual(buttonsIn(section), ['이 그림 확정하고 기록 요청']);
    } finally {
      page.close();
    }
  });

  test('a confirm refused because something waits or the document does not draw reads the diagram again, which shows why', async () => {
    const cases = [
      ['waiting_reflection', diagramOf('erd', { overlays: [RENAMED] }), [waitingCount(1)]],
      ['not_drawn', diagramOf('erd', { drawing: { ...diagramOf('erd').drawing, id: 'dw_0000000000c7', status: 'failed', failed_at: 'db/nexus.sql:3' }, last_drawn: diagramOf('erd').drawing }), ['그려지지 않음']],
    ];
    for (const [code, after, tags] of cases) {
      const page = await openAt('erd', { posted: () => problem(409, code) });
      try {
        page.reads[diagramPath('erd')] = json(200, after);
        press(byId(page, 'confirm'));
        press(byId(page, 'confirm-yes'));
        await page.settle();
        assert.deepEqual(tagsIn(diagramSection(page)).slice(0, 1), tags, code);
        assert.equal(lineOf(page).children.length, 0, code);
      } finally {
        page.close();
      }
    }
  });

  test('loading: the work panel keeps its sections\' titles with grey shapes; a phone keeps the Selected one only', async () => {
    const { startShell, SCREENS } = await import('./screen-page.js');
    const { fakePage } = await import('./fake-dom.js');
    const { parseAddress } = await import('../web/address.js');
    for (const phone of [false, true]) {
      const page = fakePage({ pathname: `/p/${P}/_/05-erd`, phone });
      const restore = page.install();
      const realFetch = globalThis.fetch;
      globalThis.fetch = () => new Promise(() => {});
      try {
        startShell(page.app, SCREENS['SCR-145'], parseAddress(`/p/${P}/_/05-erd`, ''));
        const panel = page.app.all('aside')[0];
        assert.deepEqual(panel.all('h2').map((h2) => h2.textContent), phone ? ['고른 요소'] : ['이 그림', 'AI 제안', '고른 요소']);
        assert.ok(panel.all('span', 'sk').length >= (phone ? 2 : 7));
        assert.ok(panel.all('span', 'sk').every((shape) => shape.getAttribute('aria-hidden') === 'true'));
      } finally {
        restore();
        globalThis.fetch = realFetch;
      }
    }
  });

  test('empty: with nothing sent, a PC\'s panel says there is nothing to confirm and no AI proposal; a phone\'s is empty', async () => {
    const empty = async (phone) => openPage(`/p/${P}/_/02-prd`, {
      phone,
      answers: {
        '/api/projects': json(200, { projects: [], backup: null }),
        '/api/todo': json(200, { entries: [], backup: null }),
        [`/api/projects/${P}`]: json(200, projectOf()),
      },
    });
    const page = await empty(false);
    try {
      assert.deepEqual(texts({ app: panelOf(page) }, 'h2'), ['이 그림', 'AI 제안']);
      assert.deepEqual(texts({ app: panelOf(page) }, 'p'), ['확정할 그림이 아직 없어요.', '모두 처리함']);
      assert.match(page.app.textContent, /AI 대화창에 .*필요한 기능 내용을 정리해 NEXUS에 보내줘/);
    } finally {
      page.close();
    }
    const phone = await empty(true);
    try {
      assert.equal(panelOf(phone).children.length, 0);
      assert.match(phone.app.textContent, /AI 대화창에 .*필요한 기능 내용을 정리해 NEXUS에 보내줘/);
    } finally {
      phone.close();
    }
  });
});

describe('SCR-146', () => {
  test('both widths explain that open proposals are excluded before confirmation', async () => {
    for (const phone of [true, false]) {
      const page = await openAt('erd', { screen: 'changes', phone, diagram: diagramOf('erd', { overlays: [PROPOSED] }) });
      try {
        assert.ok(shownTexts(mainOf(page), 'p').includes(CONFIRM_WORDS.leftOut));
        press(byId(page, 'confirm'));
        assert.equal(page.sent.length, 0);
        assert.ok(shownTexts(mainOf(page), 'p').includes(CONFIRM_WORDS.leftOut));
      } finally { page.close(); }
    }
  });
  test('the recording explanation stays visible while confirming', async () => {
    const page = await openAt('erd', { screen: 'changes', diagram: confirmedWith('erd', 'invalidated') });
    try {
      press(byId(page, 'confirm'));
      assert.ok(shownTexts(mainOf(page), 'p').includes(CONFIRM_WORDS.beforeConfirm));
    } finally { page.close(); }
  });
  test('normal: "6개" by the title, the link to the confirmed version, each changed element, 이 그림 확정 and 그림으로', async () => {
    const page = await openAt('erd', { screen: 'changes', diagram: confirmedWith('erd', 'invalidated') });
    try {
      assert.deepEqual(texts(page, 'h1'), ['확정 뒤 바뀐 곳']);
      assert.deepEqual(texts(page, 'nav', 'crumb'), ['독서 모임 앱/05 ERD/확정 뒤 바뀐 곳']);
      const title = page.app.all('div', 'title')[0];
      assert.deepEqual(title.all('span', 'tag').filter((tag) => tag.shown).map((tag) => [tag.textContent, tag.className]), [[countTag(6), 'tag purple']]);
      assert.deepEqual(shownTexts(title, 'p'), [CONFIRM_WORDS.description]);
      assert.ok(shownTexts(mainOf(page), 'p').includes(CONFIRM_WORDS.beforeConfirm));
      const link = mainOf(page).all('a', 'small')[0];
      assert.deepEqual([link.textContent, link.getAttribute('href'), link.getAttribute('target'), link.getAttribute('rel')], [
        `확정한 버전의 문서 ↗ b41c9e2 · ${new Date(TIME).getMonth() + 1}월 ${new Date(TIME).getDate()}일 확정`,
        `${REPOSITORY}/tree/${CONFIRMED_AT}`, '_blank', 'noopener noreferrer',
      ]);
      const group = groupNamed(page, '바뀐 요소');
      assert.deepEqual(pageRows(group), [
        ['더함', A.name, kindOf(A)], ['더함', B.name, kindOf(B)], ['더함', C.name, kindOf(C)],
        ['바뀜', D.name, kindOf(D)], ['바뀜', E.name, kindOf(E)], ['뺌', 'TBL-999', '문서에서 뺐어요'],
      ]);
      assert.deepEqual(group.all('div', 'li').map((row) => row.className), Array(6).fill('li keep still short'));
      assert.equal(group.all('div', 'li')[5].all('b')[0].all('span', 'mono').length, 1);
      const end = mainOf(page).children.at(-1).children.at(-1);
      assert.deepEqual([...end.all('button'), ...end.all('a')].map((each) => [each.textContent, each.className]), [['이 그림 확정하고 기록 요청', 'btn primary'], ['그림으로', 'btn ghost']]);
      assert.equal(end.all('a')[0].getAttribute('href'), `/p/${P}/_/05-erd?d=${ID.erd}`);
      assert.equal(page.document.title, '확정 뒤 바뀐 곳 · NEXUS');
    } finally {
      page.close();
    }
  });

  test('a board\'s removed element shows its key and the DDD kind it names', async () => {
    const [kept, gone] = COMMANDS;
    const page = await openAt('board', { screen: 'changes', diagram: confirmedWith('board', 'invalidated', sinceOf({ added: [kept.key], removed: [`${gone.key}-old`] })) });
    try {
      assert.deepEqual(pageRows(groupNamed(page, '바뀐 요소')), [['더함', kept.name, '명령'], ['뺌', `${gone.key}-old`, '명령 · 문서에서 뺐어요']]);
    } finally {
      page.close();
    }
  });

  test('a phone cannot cancel an edit and cannot confirm while it waits', async () => {
    const page = await openAt('erd', { screen: 'changes', phone: true, diagram: { ...confirmedWith('erd', 'invalidated'), overlays: [RENAMED] } });
    try {
      assert.equal(byId(page, 'confirm'), null);
      assert.equal(texts(page, 'button').includes('편집 취소'), false);
      assert.deepEqual(pageRows(groupNamed(page, '반영을 기다리는 변경')), [['반영 대기', 'project_rooms', `이름 바꾸기 · ${B.name}에서`]]);
      const note = mainOf(page).all('div', 'info')[0];
      assert.deepEqual([note.textContent, note.getAttribute('role')], ['편집 취소와 확정 취소는 PC에서 하세요.', 'status']);
    } finally {
      page.close();
    }
  });

  test('a phone can request a confirmation from the changes page after the second question', async () => {
    const page = await openAt('erd', { screen: 'changes', phone: true, diagram: confirmedWith('erd', 'invalidated') });
    try {
      press(byId(page, 'confirm'));
      assert.equal(page.sent.length, 0);
      assert.ok(byId(page, 'confirm-stop'));
      press(byId(page, 'confirm-yes'));
      await page.settle();
      assert.equal(page.sent.length, 1);
      assert.equal(page.sent[0].path, `${diagramPath('erd')}/confirmation`);
    } finally { page.close(); }
  });

  test('a phone explains why a failed drawing cannot be confirmed on the changes page', async () => {
    const failed = { ...diagramOf('erd').drawing, status: 'failed', failed_at: 'docs/example.md:1' };
    const page = await openAt('erd', { screen: 'changes', phone: true, diagram: diagramOf('erd', { drawing: failed }) });
    try {
      assert.match(mainOf(page).textContent, /문서가 그려지지 않았어요/);
      assert.ok(mainOf(page).all('a').some((link) => link.textContent === CONFIRM_WORDS.seeInDiagram));
      const button = mainOf(page).all('button').find((item) => item.textContent === CHANGE_WORDS.confirm);
      assert.notEqual(button.getAttribute('disabled'), null);
      assert.equal(page.sent.length, 0);
    } finally { page.close(); }
  });

  test('waiting (SCR-146#waiting): every change set that waits comes first under "반영을 기다리는 변경", a direct edit with 편집 취소; the button is off with why', async () => {
    const page = await openAt('erd', { screen: 'changes', diagram: { ...confirmedWith('erd', 'invalidated'), overlays: [RENAMED, ACCEPTED] } });
    try {
      assert.ok(!shownTexts(mainOf(page), 'p').includes(CONFIRM_WORDS.beforeConfirm));
      const groups = mainOf(page).all('section', 'group');
      assert.deepEqual(groups.map((group) => group.all('h2')[0].textContent), ['반영을 기다리는 변경', '바뀐 요소']);
      assert.deepEqual(tagsIn(groups[0].all('div', 'gh')[0]), [waitingCount(2)]);
      assert.deepEqual(pageRows(groups[0]), [
        [MARK_WORDS.wait, 'project_rooms', `이름 바꾸기 · ${B.name}에서`],
        [MARK_WORDS.wait, ACCEPTED.change, CHANGE_WORDS.acceptedProposal],
      ]);
      assert.deepEqual(groups[0].all('div', 'li').map(buttonsIn), [['편집 취소'], []]);
      const confirm = mainOf(page).all('button').find((button) => button.textContent === '이 그림 확정하고 기록 요청');
      assert.equal(confirm.getAttribute('disabled'), '');
      assert.ok(texts(page, 'span', 'small').includes('반영을 기다리는 변경을 먼저 반영하거나 취소하세요.'));
    } finally {
      page.close();
    }
  });

  test('편집 취소 sends API-273, and the list read again leaves it out', async () => {
    const page = await openAt('erd', {
      screen: 'changes',
      diagram: { ...confirmedWith('erd', 'invalidated'), overlays: [RENAMED] },
      posted: () => json(200, { change_set: { ...RENAMED, state: 'cancelled' }, changed: true, pull_request: null }),
    });
    try {
      page.reads[diagramPath('erd')] = json(200, confirmedWith('erd', 'invalidated'));
      press(byId(page, `w-${RENAMED.id}-cancel`));
      await page.settle();
      assert.deepEqual(page.sent.map((each) => each.path), [`/api/projects/${P}/change-sets/${RENAMED.id}/cancel`]);
      assert.ok(groupNamed(page, '반영을 기다리는 변경') === undefined);
      assert.ok(byId(page, 'confirm') !== null);
      focused(page, groupNamed(page, '바뀐 요소').all('h2')[0], 'the list\'s heading has the focus');
    } finally {
      page.close();
    }
  });

  test('confirmed (SCR-146#confirmed): after this page\'s confirm, the message, that nothing changed since, and 그림으로', async () => {
    const after = confirmationOf('erd', 'confirmed', { id: 'nk_0000000000k2', drawing: DRAWING.erd, version: 'a'.repeat(40) });
    const page = await openAt('erd', { screen: 'changes', diagram: confirmedWith('erd', 'invalidated'), posted: () => json(201, { confirmation: after, changed: true }) });
    try {
      page.reads[diagramPath('erd')] = json(200, diagramOf('erd', { since_confirmation: { ...sinceOf(), version: 'a'.repeat(40) }, confirmation: after }));
      press(byId(page, 'confirm'));
      press(byId(page, 'confirm-yes'));
      await page.settle();
      const note = mainOf(page).all('div', 'ok')[0];
      assert.deepEqual([note.textContent, note.getAttribute('role')], [CONFIRM_WORDS.confirmedHere, 'status']);
      focused(page, note, 'the message has the focus');
      assert.deepEqual(shownTexts(mainOf(page).all('div', 'empty')[0], 'p'), ['확정한 뒤 바뀐 곳이 없어요.']);
      assert.equal(mainOf(page).all('a', 'small').length, 0);
      assert.deepEqual(mainOf(page).all('a', 'btn').map((link) => [link.textContent, link.className]), [['그림으로', 'btn tertiary']]);
      assert.ok(byId(page, 'confirm') === null);
      assert.equal(page.app.all('div', 'title')[0].all('span', 'purple').length, 0);
    } finally {
      page.close();
    }
    // Opened with a live confirmation and nothing changed: the empty state, without the message.
    const opened = await openAt('erd', { screen: 'changes', diagram: confirmedWith('erd', 'confirmed', sinceOf()) });
    try {
      assert.equal(mainOf(opened).all('div', 'ok').length, 0);
      assert.deepEqual(texts(opened, 'h2'), ['확정한 뒤 바뀐 곳이 없어요.']);
      assert.ok(byId(opened, 'confirm') === null);
      assert.equal(mainOf(opened).all('a', 'small').length, 1);
    } finally {
      opened.close();
    }
  });

  test('empty (SCR-146#empty): never confirmed, "아직 확정하지 않아 비교할 버전이 없어요." with 이 그림 확정; nothing sent for the stage, the same', async () => {
    const page = await openAt('erd', { screen: 'changes' });
    try {
      assert.deepEqual(texts(page, 'h2'), ['아직 확정하지 않아 비교할 버전이 없어요.']);
      assert.equal(mainOf(page).all('a', 'small').length, 0);
      assert.ok(byId(page, 'confirm') !== null);
      assert.equal(page.app.all('div', 'title')[0].all('span', 'purple').length, 0);
    } finally {
      page.close();
    }
    const none = await openPage(`/p/${P}/_/02-prd/changes`, {
      answers: {
        '/api/projects': json(200, { projects: [], backup: null }),
        '/api/todo': json(200, { entries: [], backup: null }),
        [`/api/projects/${P}`]: json(200, projectOf()),
      },
    });
    try {
      assert.deepEqual(texts(none, 'h2'), ['아직 확정하지 않아 비교할 버전이 없어요.']);
      assert.deepEqual(texts(none, 'a').filter((text) => text === '그림으로'), ['그림으로']);
    } finally {
      none.close();
    }
  });

  test('the confirmed version is a link only for an https repository; otherwise the same words as text', async () => {
    for (const repository of [null, 'http://example.com/demo', 'javascript:alert(1)']) {
      if (repository !== null && validate(contract, repository, { $ref: '#/components/schemas/Link' }).length > 0) continue;
      const page = await openAt('erd', { screen: 'changes', repository, diagram: confirmedWith('erd', 'invalidated') });
      try {
        assert.equal(mainOf(page).all('a', 'small').length, 0, String(repository));
        assert.match(mainOf(page).all('p', 'small')[0].textContent, /^확정한 버전의 문서 ↗ b41c9e2 · /);
      } finally {
        page.close();
      }
    }
    // What the contract would refuse is no link either.
    const { confirmedVersion } = await import('../web/confirm.js');
    const { fakePage } = await import('./fake-dom.js');
    const restore = fakePage({ pathname: '/' }).install();
    try {
      for (const repository of [null, 'http://example.com/demo', 'javascript:alert(1)', 'https://']) {
        assert.equal(confirmedVersion(repository, CONFIRMED_AT, null).tagName, 'P', String(repository));
      }
      assert.equal(confirmedVersion('https://example.com/demo/', CONFIRMED_AT, null).getAttribute('href'), `https://example.com/demo/tree/${CONFIRMED_AT}`);
      // Without .git, as a pull request's link (src/claims.js repositoryBase).
      assert.equal(confirmedVersion('https://example.com/demo.git', CONFIRMED_AT, null).getAttribute('href'), `https://example.com/demo/tree/${CONFIRMED_AT}`);
    } finally {
      restore();
    }
  });

  test('not drawn (SCR-146#not-drawn): the list, "문서를 고쳐 그려지게 한 뒤 확정하세요." with 그림에서 보기, and the button off', async () => {
    const failed = { id: 'dw_0000000000c7', revision: 4, version: 'c'.repeat(40), status: 'failed', failed_at: 'db/nexus.sql:12', drawn_at: TIME };
    const page = await openAt('erd', { screen: 'changes', diagram: { ...confirmedWith('erd', 'invalidated'), drawing: failed, last_drawn: diagramOf('erd').drawing } });
    try {
      assert.ok(!shownTexts(mainOf(page), 'p').includes(CONFIRM_WORDS.beforeConfirm));
      const note = mainOf(page).all('div', 'err')[0];
      assert.deepEqual([shownTexts(note, 'b'), note.all('a').map((link) => [link.textContent, link.getAttribute('href')])], [
        [CONFIRM_WORDS.fixFirst], [['그림에서 보기', `/p/${P}/_/05-erd?d=${ID.erd}`]],
      ]);
      const confirm = mainOf(page).all('button').find((button) => button.textContent === '이 그림 확정하고 기록 요청');
      assert.equal(confirm.getAttribute('disabled'), '');
      assert.ok(groupNamed(page, '바뀐 요소') !== undefined);
    } finally {
      page.close();
    }
  });

  test('a removed diagram shows what changed and what waits, and no 이 그림 확정 (SPEC-027)', async () => {
    const page = await openAt('oldErd', { screen: 'changes', diagram: diagramOf('oldErd', { since_confirmation: SIX, confirmation: confirmationOf('oldErd', 'invalidated'), overlays: [{ ...RENAMED, diagram: ID.oldErd, drawing: DRAWING.oldErd }] }) });
    try {
      assert.ok(groupNamed(page, '바뀐 요소') !== undefined);
      assert.deepEqual(texts(page, 'button').filter((text) => text === '이 그림 확정하고 기록 요청' || text === '편집 취소'), ['편집 취소']);
    } finally {
      page.close();
    }
  });

  test('loading (SCR-146#loading): grey rows, and on a PC 이 그림 확정 off', async () => {
    const { startShell, SCREENS } = await import('./screen-page.js');
    const { fakePage } = await import('./fake-dom.js');
    const { parseAddress } = await import('../web/address.js');
    for (const phone of [false, true]) {
      const page = fakePage({ pathname: `/p/${P}/_/05-erd/changes`, phone });
      const restore = page.install();
      const realFetch = globalThis.fetch;
      globalThis.fetch = () => new Promise(() => {});
      try {
        startShell(page.app, SCREENS['SCR-146'], parseAddress(`/p/${P}/_/05-erd/changes`, ''));
        const main = page.app.all('main')[0];
        assert.deepEqual(texts(page, 'h1'), ['확정 뒤 바뀐 곳']);
        assert.equal(main.all('div', 'cards')[0].all('span', 'row').length, 3);
        assert.deepEqual(main.all('button').map((button) => [button.textContent, button.getAttribute('disabled')]), phone ? [] : [['이 그림 확정하고 기록 요청', '']]);
      } finally {
        restore();
        globalThis.fetch = realFetch;
      }
    }
  });

  test('stale (SCR-146#stale): a confirm refused for a changed document shows its message with 새로 고침 above the list', async () => {
    const page = await openAt('erd', { screen: 'changes', diagram: confirmedWith('erd', 'invalidated'), posted: () => problem(409, 'document_changed') });
    try {
      press(byId(page, 'confirm'));
      press(byId(page, 'confirm-yes'));
      await page.settle();
      assert.deepEqual([shownTexts(lineOf(page), 'b'), buttonsIn(lineOf(page))], [['문서가 바뀌었어요. 새 버전을 보세요.'], ['새로 고침']]);
      const parts = mainOf(page).children.map((child) => child.className);
      assert.ok(parts.indexOf('wb-notice wb-line') < parts.indexOf('page-part'));
    } finally {
      page.close();
    }
  });
});

describe('SCR-145 and SCR-146 against the server', () => {
  const responses = responseRecord();
  const realFetch = globalThis.fetch;
  const MiB = 1024 * 1024;
  let folder;
  let db;
  let local;
  let good;
  let broken;
  let s;
  let failing = false;
  const owner = () => ({ 'Cf-Access-Jwt-Assertion': local.token() });
  const someone = () => ({ 'Cf-Access-Jwt-Assertion': local.token({ email: 'someone@example.com' }) });
  const headersOf = (who) => ({ owner: owner(), someone: someone(), agent: s.agent.headers, nobody: {} })[who];
  const TABLE_ROWS = [A, B, C].map((table) => ({ key: table.key, trace_id: table.trace_id, kind: table.kind, name: table.name, detail: table.detail }));
  // The operation a POST of the page is, by its path.
  const actionOf = (path) => (path.includes('/confirmations/') ? 'cancelConfirmation' : path.endsWith('/confirmation') ? 'confirmDiagram' : 'cancelDirectEdit');

  // A project of its own with a drawn ERD of part nexus that holds A, B and C: { space, erd, diagram, drawing }.
  const fresh = (name) => {
    const space = s.project(name, { parts: ['nexus'] });
    const erd = s.diagram(space, { sourceKey: '/pictures/05-erd/nexus' });
    s.elements(erd.drawing, TABLE_ROWS);
    return { space, erd, diagram: idOf('dg', erd.id), drawing: idOf('dw', erd.drawing) };
  };
  // The ERD drawn again from a new snapshot: the drawing the page showed is no longer the latest.
  const drawAgain = (where, status = 'drawn') => {
    s.snapshot(where.space, { parts: ['nexus'] });
    const drawing = s.drawing(where.space, where.erd.id, { status });
    if (status === 'drawn') s.elements(drawing, TABLE_ROWS);
    return drawing;
  };
  const keyHeader = () => ({ 'Idempotency-Key': `"${newId('nw')}"` });
  const JSON_TYPE = { 'Content-Type': 'application/json' };
  const post = (path, fields = {}) => ({ method: 'POST', path, headers: { ...JSON_TYPE, ...owner(), ...keyHeader() }, body: '{}', ...fields });
  const confirmOf = (where) => `/api/projects/${where.space.name}/diagrams/${where.diagram}/confirmation`;
  const confirmBody = (where, drawing = where.drawing) => JSON.stringify({ drawing });
  const cancelOf = (where, id) => `/api/projects/${where.space.name}/confirmations/${id}/cancel`;
  const editCancelOf = (where, id) => `/api/projects/${where.space.name}/change-sets/${id}/cancel`;
  const directEdit = async (where, name) => {
    const answer = await good.send(post(`/api/projects/${where.space.name}/diagrams/${where.diagram}/direct-edits`, {
      body: JSON.stringify({ drawing: where.drawing, op: 'rename', element: B.key, name }),
    }));
    assert.equal(answer.status, 201, answer.text);
    return answer.json.change_set.id;
  };
  let names = 0;
  const newName = (base) => {
    names += 1;
    return `${base}_${names}`;
  };
  // A project name no other of the tests took.
  const newProject = (base) => {
    names += 1;
    return `${base}-${names}`;
  };

  // The projects the page shows: never confirmed (confirming), confirmed (cancelling), and with a direct edit waiting
  // (editing); and one whose answers the tests take (other).
  let confirming;
  let cancelling;
  let editing;
  let other;

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-confirm-'));
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
    confirming = fresh('confirm-page');
    cancelling = fresh('confirm-cancel-page');
    cancelling.confirmation = idOf('nk', s.confirm(cancelling.space, { id: cancelling.erd.id, drawing: cancelling.erd.drawing }));
    editing = fresh('confirm-edit-page');
    editing.edit = await directEdit(editing, 'project_rooms');
    other = fresh('confirm-answers');
  });

  after(async () => {
    await good.close();
    await broken.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  const replayOf = (answer) => () => new Response(answer.text, { status: answer.status, headers: { 'content-type': answer.headers['content-type'] } });
  const casesOf = (action, cases) => listedResponses(action).map((listed) => {
    const found = cases.filter((each) => (listed.status === 'default' ? each.status === 500 : String(each.status) === listed.status)
      && (listed.codes.length === 0 || listed.codes.includes(each.code)));
    assert.equal(found.length, Math.max(1, listed.codes.length), `${action} ${listed.status}`);
    return found;
  }).flat();

  // SCR-145 or SCR-146 of where as who; a request in replay ("POST /api/...") gets that answer instead. Each change the
  // page sends to the server is noted, and page.asked lists every request as "METHOD path".
  async function openOn(where, { screen = 'stage', who = 'owner', replay = {} } = {}) {
    const asked = [];
    const answers = async (read, init) => {
      const method = init?.method ?? 'GET';
      asked.push(`${method} ${read}`);
      const stand = replay[`${method} ${read}`];
      if (stand !== undefined) return stand(read, init);
      const response = await realFetch(`http://127.0.0.1:${good.port}${read}`, {
        method, headers: { ...(init?.headers ?? {}), ...headersOf(who) }, body: init?.body, redirect: 'manual',
      });
      if (method !== 'POST') return response;
      const text = await response.text();
      responses.note(actionOf(read), { status: response.status, headers: Object.fromEntries(response.headers), text, json: JSON.parse(text) });
      return new Response(text, { status: response.status, headers: response.headers });
    };
    const page = await openPage(`/p/${where.space.name}/nexus/05-erd${screen === 'changes' ? '/changes' : ''}`, { answers });
    page.asked = asked;
    page.where = where;
    return page;
  }

  // What the page shows for each kind of answer (SCR-145, SCR-146).
  const permissionShows = (code, buttons = []) => (page) => assert.deepEqual([texts(page, 'h1'), texts(page, 'button')], [[message(code)], buttons]);
  const gateShows = (page) => assert.deepEqual([page.location.reloads, page.session.getItem(GATE_KEY) !== null], [1, true]);
  const inLine = (code, buttons = ['다시 시도']) => (page) => assert.deepEqual(
    [shownTexts(lineOf(page), 'b'), buttonsIn(lineOf(page))],
    [[message(code)], buttons],
  );
  const refused = (code) => inLine(code, []);
  const stale = (code) => inLine(code, ['새로 고침']);
  const gone = (code) => inLine(code, ['새로 고침']);
  // The page read the diagram again after the write, and the line says nothing: a write done, a project or a diagram
  // gone (SCR-145#error, read again first), or a confirm refused for what the diagram read again shows.
  const readAgain = (page) => {
    const sent = page.asked.findIndex((each) => each.startsWith('POST '));
    const read = `GET /api/projects/${page.where.space.name}/diagrams/${page.where.diagram}`;
    assert.ok(sent !== -1 && page.asked.indexOf(read, sent) > sent, page.asked.join(', '));
    assert.equal(lineOf(page).children.length, 0);
  };

  // Runs each case of action: the server's answer, taken by request, is replayed to the page of where for act, and
  // shows checks what the page shows. A case with page answered in the test before.
  async function everyResponse(action, where, screen, path, act, cases) {
    for (const each of casesOf(action, cases)) {
      if (each.page) continue;
      failing = Boolean(each.fails);
      let answer;
      try {
        answer = responses.note(action, await (each.fails ? broken : good).send(await each.request()));
      } finally {
        failing = false;
      }
      assert.deepEqual([answer.status, answer.json.code], [each.status, each.code], answer.text);
      const page = await openOn(where, { screen, replay: { [`POST ${path}`]: replayOf(answer) } });
      try {
        await act(page);
        await page.settle();
        each.shows(page, answer);
      } catch (error) {
        error.message = `${action} on ${screen} ${each.status} ${each.code}: ${error.message}`;
        throw error;
      } finally {
        page.close();
      }
    }
    responses.assertEvery(action);
  }

  const confirmOnPage = async (page) => {
    byId(page, 'confirm').click();
    byId(page, 'confirm-yes').click();
  };

  test('the pages confirm, cancel the confirmation and cancel an edit against the server (API-275 201, API-276 200, API-273 200)', async () => {
    const where = fresh('confirm-flow');
    const edit = await directEdit(where, newName('project_rooms'));
    const page = await openOn(where, { screen: 'changes' });
    try {
      assert.equal(mainOf(page).all('button').find((button) => button.textContent === '이 그림 확정하고 기록 요청').getAttribute('disabled'), '');
      byId(page, `w-${edit}-cancel`).click();
      await page.settle();
      await confirmOnPage(page);
      await page.settle();
      assert.deepEqual(shownTexts(mainOf(page).all('div', 'ok')[0], 'b'), [CONFIRM_WORDS.confirmedHere]);
    } finally {
      page.close();
    }
    const stage = await openOn(where);
    try {
      assert.deepEqual(tagsIn(diagramSection(stage)), ['확정함']);
      byId(stage, 'cancel-confirmation').click();
      await stage.settle();
      assert.deepEqual(tagsIn(diagramSection(stage)), ['확정 전']);
      assert.deepEqual(shownTexts(diagramSection(stage), 'p', 'sec'), [CONFIRM_WORDS.cancelled]);
      await confirmOnPage(stage);
      await stage.settle();
      assert.deepEqual(tagsIn(diagramSection(stage)), ['확정함']);
      assert.deepEqual(stage.asked.filter((each) => each.startsWith('POST ')).map((each) => each.split('/').at(-1)), ['cancel', 'confirmation']);
    } finally {
      stage.close();
    }
  });

  // The cases of API-275, on other's diagram and those set up for each refusal.
  const confirmCases = () => {
    const path = () => confirmOf(other);
    const body = () => confirmBody(other);
    const reused = keyHeader();
    const moved = fresh(newProject('confirm-moved'));
    drawAgain(moved);
    const failed = fresh(newProject('confirm-failed'));
    drawAgain(failed, 'failed');
    const waiting = fresh(newProject('confirm-waiting'));
    const third = fresh(newProject('confirm-third'));
    return [
      {
        status: 201, code: undefined,
        request: async () => {
          // A confirmation of its own each time, so that 201 comes again.
          const where = fresh(newProject('confirm-made'));
          return post(confirmOf(where), { body: confirmBody(where) });
        },
        shows: readAgain,
      },
      {
        status: 200, code: undefined,
        request: async () => {
          await good.send(post(path(), { body: body() }));
          return post(path(), { body: body() });
        },
        shows: readAgain,
      },
      { status: 400, code: 'invalid_request', request: () => post(path(), { body: '{"x":1}' }), shows: refused('invalid_request') },
      { status: 401, code: 'unauthenticated', request: () => post(path(), { headers: { ...JSON_TYPE, ...keyHeader() }, body: body() }), shows: gateShows },
      { status: 403, code: 'owner_only', request: () => post(path(), { headers: { ...JSON_TYPE, ...s.agent.headers, ...keyHeader() }, body: body() }), shows: permissionShows('owner_only') },
      { status: 403, code: 'not_owner', request: () => post(path(), { headers: { ...JSON_TYPE, ...someone(), ...keyHeader() }, body: body() }), shows: permissionShows('not_owner') },
      { status: 403, code: 'cross_site', request: () => post(path(), { headers: { ...JSON_TYPE, ...owner(), ...keyHeader(), 'Sec-Fetch-Site': 'cross-site' }, body: body() }), shows: permissionShows('cross_site', ['새로 고침']) },
      { status: 404, code: 'project_not_found', request: () => post(`/api/projects/no-such-project/diagrams/${other.diagram}/confirmation`, { body: body() }), shows: readAgain },
      { status: 404, code: 'diagram_not_found', request: () => post(`/api/projects/${other.space.name}/diagrams/dg_zzzzzzzzzzzz/confirmation`, { body: body() }), shows: readAgain },
      { status: 404, code: 'drawing_not_found', request: () => post(path(), { body: confirmBody(other, 'dw_zzzzzzzzzzzz') }), shows: gone('drawing_not_found') },
      {
        status: 409, code: 'request_key_reused',
        request: async () => {
          await good.send(post(confirmOf(third), { headers: { ...JSON_TYPE, ...owner(), ...reused }, body: confirmBody(third) }));
          return post(path(), { headers: { ...JSON_TYPE, ...owner(), ...reused }, body: body() });
        },
        shows: inLine('request_key_reused'),
      },
      { status: 409, code: 'document_changed', request: () => post(confirmOf(moved), { body: confirmBody(moved) }), shows: stale('document_changed') },
      {
        status: 409, code: 'waiting_reflection',
        request: async () => {
          await directEdit(waiting, newName('project_rooms'));
          return post(confirmOf(waiting), { body: confirmBody(waiting) });
        },
        shows: readAgain,
      },
      { status: 409, code: 'not_drawn', request: () => post(confirmOf(failed), { body: confirmBody(failed) }), shows: readAgain },
      { status: 413, code: 'body_too_large', request: () => post(path(), { body: JSON.stringify({ drawing: other.drawing, pad: 'x'.repeat(2 * MiB) }) }), shows: refused('body_too_large') },
      { status: 415, code: 'json_required', request: () => post(path(), { headers: { 'Content-Type': 'text/plain', ...owner(), ...keyHeader() }, body: body() }), shows: inLine('json_required') },
      { status: 500, code: 'internal', fails: true, request: () => post(path(), { body: body() }), shows: inLine('internal') },
    ];
  };

  test('every response API-275 lists leads 이 그림 확정 on SCR-145 to the state SCR-145 gives', async () => {
    await everyResponse('confirmDiagram', confirming, 'stage', confirmOf(confirming), confirmOnPage, confirmCases());
  });

  test('every response API-275 lists leads 이 그림 확정 on SCR-146 to the state SCR-146 gives', async () => {
    await everyResponse('confirmDiagram', confirming, 'changes', confirmOf(confirming), confirmOnPage, confirmCases());
  });

  test('every response API-276 lists leads 확정 취소 on SCR-145 to the state SCR-145 gives', async () => {
    const live = () => {
      const where = fresh(newProject('confirm-live'));
      return { where, id: idOf('nk', s.confirm(where.space, { id: where.erd.id, drawing: where.erd.drawing })) };
    };
    const target = live();
    const path = () => cancelOf(target.where, target.id);
    const reused = keyHeader();
    await everyResponse('cancelConfirmation', cancelling, 'stage', cancelOf(cancelling, cancelling.confirmation), (page) => byId(page, 'cancel-confirmation').click(), [
      {
        status: 200, code: undefined,
        request: () => {
          const made = live();
          return post(cancelOf(made.where, made.id));
        },
        shows: readAgain,
      },
      { status: 400, code: 'invalid_request', request: () => post(path(), { body: '{"x":1}' }), shows: refused('invalid_request') },
      { status: 401, code: 'unauthenticated', request: () => post(path(), { headers: { ...JSON_TYPE, ...keyHeader() } }), shows: gateShows },
      { status: 403, code: 'owner_only', request: () => post(path(), { headers: { ...JSON_TYPE, ...s.agent.headers, ...keyHeader() } }), shows: permissionShows('owner_only') },
      { status: 403, code: 'not_owner', request: () => post(path(), { headers: { ...JSON_TYPE, ...someone(), ...keyHeader() } }), shows: permissionShows('not_owner') },
      { status: 403, code: 'cross_site', request: () => post(path(), { headers: { ...JSON_TYPE, ...owner(), ...keyHeader(), 'Sec-Fetch-Site': 'cross-site' } }), shows: permissionShows('cross_site', ['새로 고침']) },
      { status: 404, code: 'project_not_found', request: () => post(`/api/projects/no-such-project/confirmations/${target.id}/cancel`), shows: readAgain },
      { status: 404, code: 'confirmation_not_found', request: () => post(cancelOf(target.where, 'nk_zzzzzzzzzzzz')), shows: gone('confirmation_not_found') },
      {
        status: 409, code: 'request_key_reused',
        request: async () => {
          const first = live();
          await good.send(post(cancelOf(first.where, first.id), { headers: { ...JSON_TYPE, ...owner(), ...reused } }));
          return post(path(), { headers: { ...JSON_TYPE, ...owner(), ...reused } });
        },
        shows: inLine('request_key_reused'),
      },
      { status: 413, code: 'body_too_large', request: () => post(path(), { body: JSON.stringify({ pad: 'x'.repeat(2 * MiB) }) }), shows: refused('body_too_large') },
      { status: 415, code: 'json_required', request: () => post(path(), { headers: { 'Content-Type': 'text/plain', ...owner(), ...keyHeader() } }), shows: inLine('json_required') },
      { status: 500, code: 'internal', fails: true, request: () => post(path()), shows: inLine('internal') },
    ]);
  });

  test('every response API-273 lists leads 편집 취소 on SCR-146 to the state SCR-146 gives', async () => {
    const edit = await directEdit(other, newName('project_rooms'));
    const path = editCancelOf(other, edit);
    const reused = keyHeader();
    await everyResponse('cancelDirectEdit', editing, 'changes', editCancelOf(editing, editing.edit), (page) => byId(page, `w-${editing.edit}-cancel`).click(), [
      {
        status: 200, code: undefined,
        request: async () => post(editCancelOf(other, await directEdit(other, newName('project_rooms')))),
        shows: readAgain,
      },
      { status: 400, code: 'invalid_request', request: () => post(path, { body: '{"x":1}' }), shows: refused('invalid_request') },
      { status: 401, code: 'unauthenticated', request: () => post(path, { headers: { ...JSON_TYPE, ...keyHeader() } }), shows: gateShows },
      { status: 403, code: 'owner_only', request: () => post(path, { headers: { ...JSON_TYPE, ...s.agent.headers, ...keyHeader() } }), shows: permissionShows('owner_only') },
      { status: 403, code: 'not_owner', request: () => post(path, { headers: { ...JSON_TYPE, ...someone(), ...keyHeader() } }), shows: permissionShows('not_owner') },
      { status: 403, code: 'cross_site', request: () => post(path, { headers: { ...JSON_TYPE, ...owner(), ...keyHeader(), 'Sec-Fetch-Site': 'cross-site' } }), shows: permissionShows('cross_site', ['새로 고침']) },
      { status: 404, code: 'project_not_found', request: () => post(`/api/projects/no-such-project/change-sets/${edit}/cancel`), shows: readAgain },
      { status: 404, code: 'change_set_not_found', request: () => post(editCancelOf(other, 'np_zzzzzzzzzzzz')), shows: gone('change_set_not_found') },
      {
        status: 409, code: 'request_key_reused',
        request: async () => {
          const first = await directEdit(other, newName('snapshot_rows'));
          await good.send(post(editCancelOf(other, first), { headers: { ...JSON_TYPE, ...owner(), ...reused } }));
          return post(path, { headers: { ...JSON_TYPE, ...owner(), ...reused } });
        },
        shows: inLine('request_key_reused'),
      },
      {
        status: 409, code: 'change_set_state',
        // A direct edit the agent reflected meanwhile is not cancelled.
        request: async () => {
          const done = await directEdit(other, newName('snapshot_rows'));
          s.setChangeSet(Number(keyOf('np', done)), { reflectedDrawing: other.erd.drawing });
          return post(editCancelOf(other, done));
        },
        shows: stale('change_set_state'),
      },
      { status: 413, code: 'body_too_large', request: () => post(path, { body: JSON.stringify({ pad: 'x'.repeat(2 * MiB) }) }), shows: refused('body_too_large') },
      { status: 415, code: 'json_required', request: () => post(path, { headers: { 'Content-Type': 'text/plain', ...owner(), ...keyHeader() } }), shows: inLine('json_required') },
      { status: 500, code: 'internal', fails: true, request: () => post(path), shows: inLine('internal') },
    ]);
  });
});
