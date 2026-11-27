// SCR-145's pictures (TASK-458; SPEC-003 to SPEC-012, SPEC-027) on test/fake-dom.js: each kind of diagram drawn by its
// names from this repository's own drawings, choosing, copying and moving an element, the stage's list of diagrams and
// the switch in the page, the mockup's frame, what lies over a picture, and the layout guard, against stubbed answers;
// then the screen against the server, with every response API-264, API-265, API-274 and API-293 list. How the pictures
// look, at 360 and 1440 pixels in light and dark, is the browser walk of the pull request.

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createPages } from '../src/pages.js';
import { ROUTES } from '../src/routes.js';
import { idOf } from '../src/ids.js';
import { openStore } from '../src/store.js';
import { GATE_KEY } from '../web/states.js';
import { FRAME_WORDS, pagePath } from '../web/mockup-frame.js';
import { MARK_WORDS, overlayModel } from '../web/overlays.js';
import { contract, validate } from './contract.js';
import { listedResponses, responseRecord } from './responses.js';
import { json, message, openPage, problem, texts, TRACE } from './screen-page.js';
import { seed } from './seed.js';
import { FORMAT_03, repositorySnapshot } from './snapshots.js';
import { localGate, startServer } from './support.js';

// The modules that import ./layout.js load once screen-page.js has taught the import where the server serves it from.
const { placement } = await import('../web/relayout.js');
const { copyText, LONG_STEP, SEND_AFTER_MS, STEP, WORKBENCH_WORDS } = await import('../web/workbench.js');

const TIME = '2026-11-23T01:00:00.000Z';
const P = 'reading-club';
const ID = Object.freeze({
  board: 'dg_0000000000b1',
  table: 'dg_0000000000b2',
  flow: 'dg_0000000000c1',
  flow2: 'dg_0000000000c2',
  oldFlow: 'dg_0000000000c3',
  erd: 'dg_0000000000b5',
  sitemap: 'dg_0000000000b7',
  states: 'dg_0000000000b8',
  mockup: 'dg_0000000000b9',
});
const stored = (name) => JSON.parse(readFileSync(new URL(`./${name}`, import.meta.url), 'utf8'));
// An element of a drawer's drawing as API-265 answers it.
const asElement = (element) => ({
  key: element.key, trace_id: element.trace_id ?? null, kind: element.kind, name: element.name ?? '', parent: element.parent ?? null,
  status: element.status ?? null, detail: element.detail ?? {}, position: null, position_saved: false,
});
const FLOWS = Object.values(stored('user-flow-expected.json'));
const ELEMENTS = Object.freeze({
  board: stored('ddd-board-expected.json').elements,
  erd: stored('erd-expected.json').elements,
  sitemap: stored('sitemap-expected.json').elements,
  states: stored('screen-states-expected.json').drawings[0].elements,
  mockup: stored('mockup-expected.json').elements,
  flow: FLOWS[0].elements,
  flow2: FLOWS[1].elements,
  oldFlow: FLOWS[2].elements,
  table: [
    { key: 'REQ-001', trace_id: 'REQ-001', kind: 'row', name: 'Owner signs in', detail: { status: 'Must', links: ['SPEC-001'], where: 'docs/02-prd/requirements.md:10' } },
    { key: 'REQ-002', trace_id: 'REQ-002', kind: 'row', name: 'Agent sends a snapshot', detail: { status: 'Must', links: [], where: 'docs/02-prd/requirements.md:11' } },
    { key: 'REQ-003', trace_id: 'REQ-003', kind: 'row', name: 'Old wish', status: 'removed', detail: { status: '', links: [], where: 'docs/02-prd/requirements.md:12' } },
  ],
});
// Each diagram of the project: its stage, kind and name.
const DIAGRAMS = Object.freeze({
  board: ['01-domain', 'ddd_board', 'DDD board'],
  table: ['02-prd', 'item_table', 'Item table'],
  flow: ['03-user-flow', 'user_flow', FLOWS[0].name],
  flow2: ['03-user-flow', 'user_flow', FLOWS[1].name],
  oldFlow: ['03-user-flow', 'user_flow', FLOWS[2].name],
  erd: ['05-erd', 'erd', 'ERD'],
  sitemap: ['07-sitemap', 'sitemap', 'Sitemap'],
  states: ['08-screen-states', 'screen_states', 'SCR-142 Owner to-do'],
  mockup: ['09-mockup', 'mockup', 'nexus-mockup.html'],
});

// API-265's Diagram of one of DIAGRAMS, drawn; fields replaces what it gives.
function diagramOf(which, fields = {}) {
  const [stage, kind, name] = DIAGRAMS[which];
  const id = ID[which];
  const body = {
    id, project: P, part: '', stage, kind, name, removed: which === 'oldFlow',
    drawing: { id: `dw_${id.slice(3)}`, revision: 3, version: 'a'.repeat(40), status: 'drawn', failed_at: null, drawn_at: TIME },
    last_drawn: null, elements: ELEMENTS[which].map(asElement), overlays: [], since_confirmation: null, confirmation: null, threads: [],
    ...fields,
  };
  assert.deepEqual(validate(contract, body, { $ref: '#/components/schemas/Diagram' }), [], which);
  return body;
}

const summaryOf = (which, fields = {}) => {
  const [, kind, name] = DIAGRAMS[which];
  return { id: ID[which], kind, name, removed: which === 'oldFlow', drawn: true, confirmation: 'none', waiting: 0, open_threads: which === 'oldFlow' ? 1 : 0, ...fields };
};
const STAGE_IDS = ['01-domain', '02-prd', '03-user-flow', '04-functional-spec', '05-erd', '06-api', '07-sitemap', '08-screen-states', '09-mockup', '10-wbs', '11-development', '12-qa', '13-presentation'];
// API-264's Project, with the stages' diagrams; a removed flow with an open thread is listed last (SPEC-027).
function projectOf(lists = {}) {
  const listed = {
    '01-domain': ['board'], '02-prd': ['table'], '03-user-flow': ['flow', 'flow2', 'oldFlow'], '05-erd': ['erd'], '07-sitemap': ['sitemap'],
    '08-screen-states': ['states'], '09-mockup': ['mockup'], ...lists,
  };
  return {
    name: P, title: '독서 모임 앱', repository: 'https://github.com/example/demo', revision: 3, commit: 'a'.repeat(40), pushed_at: TIME, parts: [],
    stages: STAGE_IDS.map((stage) => ({
      stage, part: '', state: listed[stage] ? 'open' : 'not_sent', passed_at: null, diagrams: (listed[stage] ?? []).map((which) => summaryOf(which)),
    })),
    tool_links: [],
    workshop: null,
  };
}

const diagramPath = (which) => `/api/projects/${P}/diagrams/${ID[which]}`;
const positionsPath = (which) => `${diagramPath(which)}/positions`;
const pathOf = (which) => `/p/${P}/_/${DIAGRAMS[which][0]}`;
const HEADER = {
  '/api/projects': json(200, { projects: [], backup: null }),
  '/api/todo': json(200, { entries: [], backup: null }),
};
// The answers of a page with every diagram as drawn; more replaces some, by path.
function answersOf(more = {}) {
  return {
    ...HEADER,
    [`/api/projects/${P}`]: json(200, projectOf()),
    ...Object.fromEntries(Object.keys(ID).map((which) => [diagramPath(which), json(200, diagramOf(which))])),
    [pagePath(P, ID.mockup)]: () => new Response('<!doctype html><p>mockup</p>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }),
    ...more,
  };
}

// Opens a stage's page with answers by path, a POST answered by moved (a function of the request's body and
// headers); every POST is kept in page.sent as { path, body, key }.
async function openStage(which, { search = '', more = {}, moved = null, phone = false, clipboard = 'allowed', session = {} } = {}) {
  const answers = answersOf(more);
  const sent = [];
  const page = await openPage(pathOf(which), {
    search,
    session,
    phone,
    clipboard,
    answers: (path, init) => {
      if (init?.method === 'POST') {
        const body = JSON.parse(init.body);
        const key = init.headers['idempotency-key'];
        sent.push({ path, body, key });
        return (moved ?? movedAnswer(which))(body, key);
      }
      const answer = answers[path];
      if (answer === undefined) throw new Error(`no answer for ${path}`);
      return answer(path, init);
    },
  });
  page.sent = sent;
  return page;
}

// API-274's 200 for a move of which's diagram.
const movedAnswer = (which) => (body) => json(200, { diagram: ID[which], element: body.element, x: body.x, y: body.y, moved_at: TIME })();

const pictureBox = (page) => page.app.all('div', 'wb-picture')[0];
const panelOf = (page) => page.app.all('aside')[0];
const selectedOf = (page) => panelOf(page).all('section').find((section) => section.getAttribute('aria-label') === WORKBENCH_WORDS.selected);
// The name the Selected panel shows: in its name field on a PC for an element that takes a rename (TASK-460), else as text.
const nameIn = (panel) => panel.all('input').find((input) => input.getAttribute('id') === 'element-name')?.value ?? panel.all('b')[0]?.textContent;
// The chooser of an element: the button or line drawn for its key, found by the name it shows.
const buttonNamed = (page, className, name) => pictureBox(page).all('button', className).find((button) => button.all('b').some((b) => b.textContent === name));
const holderOf = (button) => button.parentNode.parentNode;
const boxOf = (which, key) => ELEMENTS[which].find((element) => element.key === key).detail.box;
const waitSend = async (page) => {
  await delay(SEND_AFTER_MS + 80);
  await page.settle();
};

describe('SCR-145 pictures', () => {
  test('undo and redo restore a saved move without intercepting text undo', async () => {
    const page = await openStage('erd');
    try {
      const table = ELEMENTS.erd.find((element) => element.kind === 'table');
      const at = boxOf('erd', table.key);
      buttonNamed(page, 'tbl', table.name).dispatch('keydown', { key: 'ArrowRight' });
      await waitSend(page);
      let controls = pictureBox(page).all('div', 'move-history')[0].all('button');
      assert.equal(controls[0].disabled, false);
      const input = page.document.createElement('input');
      page.app.append(input);
      input.dispatch('keydown', { key: 'z', ctrlKey: true });
      assert.equal(page.sent.length, 1);
      buttonNamed(page, 'tbl', table.name).dispatch('keydown', { key: 'z', ctrlKey: true });
      await page.settle();
      assert.deepEqual(page.sent[1].body, { element: table.key, x: at.x, y: at.y, expected: { x: at.x + STEP, y: at.y }, reset: true });
      controls = pictureBox(page).all('div', 'move-history')[0].all('button');
      assert.equal(controls[1].disabled, false);
      buttonNamed(page, 'tbl', table.name).dispatch('keydown', { key: 'z', ctrlKey: true, shiftKey: true });
      await page.settle();
      assert.deepEqual(page.sent[2].body, { element: table.key, x: at.x + STEP, y: at.y, expected: { x: at.x, y: at.y } });
    } finally { page.close(); }
  });

  test('undoing two previously automatic boxes restores the original layout', async () => {
    const page = await openStage('erd');
    try {
      const [first, second] = ELEMENTS.erd.filter((element) => element.kind === 'table');
      const place = (table) => {
        const holder = holderOf(buttonNamed(page, 'tbl', table.name));
        return [Number(holder.getAttribute('x')), Number(holder.getAttribute('y'))];
      };
      const initial = [place(first), place(second)];
      buttonNamed(page, 'tbl', first.name).dispatch('keydown', { key: 'ArrowRight', shiftKey: true });
      await waitSend(page);
      buttonNamed(page, 'tbl', second.name).dispatch('keydown', { key: 'ArrowDown' });
      await waitSend(page);
      for (let count = 0; count < 2; count += 1) {
        pictureBox(page).all('div', 'move-history')[0].all('button')[0].click();
        await page.settle();
      }
      assert.deepEqual(page.sent.slice(2).map((entry) => entry.body.reset), [true, true]);
      assert.deepEqual([place(first), place(second)], initial);
      pictureBox(page).all('div', 'move-history')[0].all('button')[1].click();
      await page.settle();
      assert.equal(page.sent.at(-1).body.reset, undefined);
      assert.deepEqual(page.sent.at(-1).body.expected, { x: first.detail.box.x, y: first.detail.box.y });
    } finally { page.close(); }
  });

  test('an older diagram response without position_saved is treated conservatively', async () => {
    const old = diagramOf('erd');
    old.elements = old.elements.map(({ position_saved, ...element }) => element);
    const page = await openStage('erd', { more: { [diagramPath('erd')]: json(200, old) } });
    try {
      const table = ELEMENTS.erd.find((element) => element.kind === 'table');
      buttonNamed(page, 'tbl', table.name).dispatch('keydown', { key: 'ArrowRight' });
      await waitSend(page);
      pictureBox(page).all('div', 'move-history')[0].all('button')[0].click();
      await page.settle();
      assert.equal(page.sent[1].body.reset, undefined);
    } finally { page.close(); }
  });

  test('a conflicting undo reloads instead of overwriting another tab', async () => {
    const page = await openStage('erd', { moved: (body) => body.expected
      ? problem(409, 'position_changed')() : movedAnswer('erd')(body) });
    try {
      const table = ELEMENTS.erd.find((element) => element.kind === 'table');
      buttonNamed(page, 'tbl', table.name).dispatch('keydown', { key: 'ArrowRight' });
      await waitSend(page);
      pictureBox(page).all('div', 'move-history')[0].all('button')[0].click();
      await page.settle();
      assert.equal(page.sent.length, 2);
      assert.ok(page.sent[1].body.expected);
      assert.match(page.app.textContent, /다른 곳에서 위치가 바뀌었어요/);
      assert.equal(pictureBox(page).all('div', 'move-history')[0].all('button')[0].disabled, true);
    } finally { page.close(); }
  });

  test('leaving after an uncertain undo clears the locked history on return', async () => {
    const page = await openStage('flow', { moved: (body) => body.expected
      ? new TypeError('Failed to fetch') : movedAnswer('flow')(body) });
    try {
      pictureBox(page).all('button', 'fbox')[0].dispatch('keydown', { key: 'ArrowRight' });
      await waitSend(page);
      pictureBox(page).all('div', 'move-history')[0].all('button')[0].click();
      await page.settle();
      assert.equal(pictureBox(page).all('div', 'move-history')[0].all('button')[0].disabled, true);
      page.app.all('nav', 'steps')[0].all('a')[1].click();
      await page.settle();
      page.pop(pathOf('flow'));
      await page.settle();
      assert.match(page.app.textContent, /저장 결과를 확인하지 못해 이동 기록을 지웠어요/);
      pictureBox(page).all('button', 'fbox')[0].dispatch('keydown', { key: 'ArrowRight' });
      await waitSend(page);
      assert.equal(page.sent.length, 3);
    } finally { page.close(); }
  });

  test('a new page explains uncertain history using the tab marker and then consumes it', async () => {
    const key = `nexus-move-uncertain:${ID.flow}`;
    const page = await openStage('flow', { session: { [key]: '1' } });
    try {
      assert.match(page.app.textContent, /저장 결과를 확인하지 못해 이동 기록을 지웠어요/);
      assert.equal(page.session.getItem(key), null);
      pictureBox(page).all('button', 'fbox')[0].dispatch('keydown', { key: 'ArrowRight' });
      await waitSend(page);
      assert.equal(page.sent.length, 1);
      assert.equal(page.session.getItem(key), null);
    } finally { page.close(); }
  });

  test('a late move answer cannot add stale history after switching away and back', async () => {
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    const page = await openStage('flow', { moved: (body) => held.then(() => movedAnswer('flow')(body)) });
    try {
      pictureBox(page).all('button', 'fbox')[0].dispatch('keydown', { key: 'ArrowRight' });
      await delay(SEND_AFTER_MS + 80);
      page.app.all('nav', 'steps')[0].all('a')[1].click();
      await delay(80);
      page.pop(pathOf('flow'));
      await delay(80);
      assert.equal(pictureBox(page).all('div', 'move-history')[0].all('button')[0].disabled, true);
      release();
      await page.settle();
      assert.equal(pictureBox(page).all('div', 'move-history')[0].all('button')[0].disabled, true);
    } finally { release(); page.close(); }
  });

  test('a missing element during undo drops stale history and reloads', async () => {
    const page = await openStage('erd', { moved: (body) => body.expected
      ? problem(404, 'element_not_found')() : movedAnswer('erd')(body) });
    try {
      const table = ELEMENTS.erd.find((element) => element.kind === 'table');
      buttonNamed(page, 'tbl', table.name).dispatch('keydown', { key: 'ArrowRight' });
      await waitSend(page);
      pictureBox(page).all('div', 'move-history')[0].all('button')[0].click();
      await page.settle();
      assert.match(page.app.textContent, /그림이 바뀌어 이동 기록을 지웠어요/);
      assert.equal(pictureBox(page).all('div', 'move-history')[0].all('button')[0].disabled, true);
    } finally { page.close(); }
  });

  test('only the latest 50 moves are undoable, and a new move clears redo', async () => {
    const page = await openStage('erd');
    try {
      const table = ELEMENTS.erd.find((element) => element.kind === 'table');
      for (let index = 0; index < 51; index += 1) {
        buttonNamed(page, 'tbl', table.name).dispatch('keydown', { key: 'ArrowRight' });
        await waitSend(page);
      }
      for (let index = 0; index < 50; index += 1) {
        pictureBox(page).all('div', 'move-history')[0].all('button')[0].click();
        await page.settle();
      }
      let controls = pictureBox(page).all('div', 'move-history')[0].all('button');
      assert.equal(controls[0].disabled, true);
      assert.equal(controls[1].disabled, false);
      buttonNamed(page, 'tbl', table.name).dispatch('keydown', { key: 'ArrowRight' });
      await waitSend(page);
      controls = pictureBox(page).all('div', 'move-history')[0].all('button');
      assert.equal(controls[1].disabled, true);
      assert.equal(page.sent.filter((entry) => entry.body.expected).length, 50);
    } finally { page.close(); }
  });

  test('each kind of diagram draws by the names of its elements, never by a trace ID or a diagram ID (SPEC-010)', async () => {
    const cases = {
      board: (box) => {
        const named = ELEMENTS.board.filter((element) => ['event', 'command', 'aggregate', 'policy', 'read_model', 'hotspot', 'external'].includes(element.kind) && element.detail?.box);
        assert.deepEqual(box.all('button', 'stk').map((button) => button.all('b', 'nm')[0].textContent).sort(), named.map((element) => element.name).sort());
        assert.ok(box.all('button', 'ctx-head').some((head) => head.textContent === '경계 컨텍스트 · Diagram'));
        assert.doesNotMatch(box.textContent, /\b(?:CTX|TERM)-\d{3}\b/);
      },
      erd: (box) => {
        const tables = ELEMENTS.erd.filter((element) => element.kind === 'table');
        assert.deepEqual(box.all('button', 'tbl').map((button) => button.all('b', 'nm')[0].textContent), tables.map((table) => table.name));
        assert.equal(box.all('path', 'pic-hit').length, ELEMENTS.erd.length - tables.length);
        assert.doesNotMatch(box.textContent, /\bTBL-\d{3}\b/);
      },
      sitemap: (box) => {
        assert.deepEqual(box.all('button', 'scr').map((button) => button.all('b', 'nm')[0].textContent),
          ['Owner to-do', 'Projects', 'Project', 'Stage workbench', 'Changes since the last confirmation']);
        assert.equal(box.all('button', 'scr')[0].all('span', 'sub')[0].textContent, '/');
        assert.doesNotMatch(box.textContent, /\bSCR-\d{3}\b/);
      },
      flow: (box) => {
        const boxes = ELEMENTS.flow.filter((element) => element.detail?.box);
        const buttons = box.all('button', 'fbox');
        assert.equal(buttons.length, boxes.length);
        // The lines as the author broke them; the trace IDs they name apart, under them.
        assert.deepEqual(buttons.map((button) => button.all('b', 'ln1').map((line) => line.textContent)), boxes.map((element) => element.detail.lines));
        assert.ok(buttons.every((button) => button.all('b', 'ln1').every((line) => !/\bREQ-\d{3}\b/.test(line.textContent))));
        assert.equal(buttons[0].all('span', 'id')[0].textContent, 'REQ-018');
        assert.ok(box.all('div', 'flab').some((label) => label.textContent === 'no'));
      },
      states: (box) => {
        assert.deepEqual(box.all('button', 'spanel').map((panel) => panel.all('b', 'mono')[0].textContent), ELEMENTS.states.map((element) => element.name));
      },
      table: (box) => {
        assert.deepEqual(box.all('button', 'rowpick').map((row) => row.all('b', 'nm')[0].textContent), ['Owner signs in', 'Agent sends a snapshot', 'Old wish']);
        assert.deepEqual(box.all('th').map((cell) => cell.textContent), ['이름', '상태', '링크']);
        assert.deepEqual(box.all('tr').at(-1).all('span', 'mk').map((mark) => mark.textContent), ['지움']);
      },
    };
    for (const [which, check] of Object.entries(cases)) {
      const page = await openStage(which);
      try {
        assert.deepEqual(texts(page, 'h1'), [DIAGRAMS[which][1] === 'user_flow' ? FLOWS[0].name : DIAGRAMS[which][2]], which);
        check(pictureBox(page));
        assert.doesNotMatch(page.app.all('main')[0].textContent, /\bdg_[0-9a-z]{12}\b/, which);
      } finally {
        page.close();
      }
    }
  });

  test('the ERD and the sitemap use the stage-01 board\'s boxes, lines and marks', async () => {
    for (const which of ['board', 'erd', 'sitemap']) {
      const elements = ELEMENTS[which];
      const boxed = elements.filter((element) => element.detail?.box && !['lane', 'context', 'hotspot_lane'].includes(element.kind));
      const lined = elements.filter((element) => Array.isArray(element.detail?.points));
      const [added, changed] = boxed;
      const page = await openStage(which, {
        more: { [diagramPath(which)]: json(200, diagramOf(which, { since_confirmation: { version: 'b'.repeat(40), added: [added.key], changed: [changed.key], removed: [] } })) },
      });
      try {
        const svg = pictureBox(page).all('svg', 'pic')[0];
        assert.equal(svg.getAttribute('class'), `pic k-${DIAGRAMS[which][1]}`);
        // Each box a button in a foreignObject; each line its path, its head and the wider path that chooses it.
        const holders = svg.all('foreignObject').filter((holder) => holder.children[0]?.className === 'fo');
        assert.ok(holders.length >= boxed.length, which);
        assert.equal(svg.all('path', 'pic-ln').length, lined.length, which);
        assert.equal(svg.all('path', 'pic-hd').length, lined.length, which);
        assert.equal(svg.all('path', 'pic-hit').length, lined.length, which);
        // The marks since the confirmation, as the board marks its stickies.
        const marks = svg.all('span', 'mk').map((mark) => [mark.className, mark.textContent]);
        assert.deepEqual(marks, [['mk add', MARK_WORDS.add], ['mk chg', MARK_WORDS.chg]], which);
      } finally {
        page.close();
      }
    }
  });

  test('copying CTX-037 Diagram puts "CTX-037 Diagram" on the clipboard and says 복사했어요; refused, it shows the text selected', async () => {
    const context = ELEMENTS.board.find((element) => element.key === 'CTX-037');
    assert.equal(copyText(asElement(context)), 'CTX-037 Diagram');
    for (const clipboard of ['allowed', 'refused']) {
      const page = await openStage('board', { clipboard });
      try {
        // With nothing chosen the section is the whole diagram's (TASK-459).
        assert.deepEqual(selectedOf(page).all('b').map((b) => b.textContent), ['그림 전체']);
        const head = pictureBox(page).all('button', 'ctx-head').find((button) => button.textContent === '경계 컨텍스트 · Diagram');
        head.click();
        const panel = selectedOf(page);
        assert.equal(panel.hidden, false);
        assert.equal(head.getAttribute('aria-pressed'), 'true');
        assert.deepEqual(panel.all('span', 'tag').map((tag) => tag.textContent), ['경계 컨텍스트']);
        assert.deepEqual(panel.all('span', 'mono').map((span) => span.textContent), ['CTX-037']);
        assert.deepEqual([nameIn(panel), panel.all('b').map((b) => b.textContent)], ['Diagram', []]);
        panel.all('button').find((button) => button.textContent === WORKBENCH_WORDS.copy).click();
        await page.settle();
        const status = panel.all('span', 'copied')[0];
        if (clipboard === 'allowed') {
          assert.deepEqual(page.copied, ['CTX-037 Diagram']);
          assert.equal(status.textContent, '복사했어요');
        } else {
          const [field] = status.all('input');
          assert.equal(field.getAttribute('value'), 'CTX-037 Diagram');
          assert.equal(field.getAttribute('readonly'), '');
          assert.equal(page.document.activeElement, field);
          assert.equal(field.selectedAll, true);
        }
      } finally {
        page.close();
      }
    }
  });

  test('elements, lines, state panels and tokens are chosen by keyboard, and the panel shows their kind, IDs and name', async () => {
    const board = await openStage('board');
    try {
      // Every box is a button, which the keyboard reaches and presses; a line is a path with tabindex and role.
      const command = buttonNamed(board, 'stk', 'Send snapshot');
      assert.equal(command.getAttribute('type'), 'button');
      command.click();
      assert.deepEqual(selectedOf(board).all('span', 'small').map((span) => span.textContent), ['누가: Agent']);
      const line = pictureBox(board).all('path', 'pic-hit').find((path) => path.getAttribute('aria-label') === 'Send a snapshot');
      assert.deepEqual([line.getAttribute('tabindex'), line.getAttribute('role')], ['0', 'button']);
      line.dispatch('keydown', { key: 'Enter' });
      assert.deepEqual([line.getAttribute('aria-pressed'), command.getAttribute('aria-pressed')], ['true', 'false']);
      assert.deepEqual(selectedOf(board).all('span', 'tag').map((tag) => tag.textContent), ['의존']);
      const lane = pictureBox(board).all('button', 'plabel').find((button) => button.textContent === 'Project');
      lane.dispatch('keydown', { key: ' ' });
      lane.click();
      assert.deepEqual(selectedOf(board).all('span', 'tag').map((tag) => tag.textContent), ['레인']);
    } finally {
      board.close();
    }
    // A line's tag says what it joins: a foreign key on an ERD, a line between screens on a sitemap.
    for (const [which, word] of [['erd', '외래 키'], ['sitemap', '화면 사이 선']]) {
      const page = await openStage(which);
      try {
        pictureBox(page).all('path', 'pic-hit')[0].dispatch('keydown', { key: 'Enter' });
        assert.deepEqual(selectedOf(page).all('span', 'tag').map((tag) => tag.textContent), [word], which);
      } finally {
        page.close();
      }
    }
    const states = await openStage('states');
    try {
      const panel = pictureBox(states).all('button', 'spanel')[1];
      panel.click();
      assert.deepEqual([selectedOf(states).all('span', 'tag')[0].textContent, selectedOf(states).all('span', 'mono')[0].textContent], ['상태', 'SCR-142#loading']);
    } finally {
      states.close();
    }
    const mockup = await openStage('mockup');
    try {
      const frame = mockup.app.all('iframe')[0];
      const tokens = panelOf(mockup).all('button', 'tk');
      assert.equal(tokens.length, ELEMENTS.mockup.length);
      assert.equal(panelOf(mockup).all('h3')[0].textContent, `이 목업이 쓰는 토큰 ${ELEMENTS.mockup.length}개`);
      tokens[1].click();
      assert.deepEqual([selectedOf(mockup).all('span', 'tag')[0].textContent, selectedOf(mockup).all('b')[0].textContent], ['토큰', '--text-primary']);
      // Choosing keeps the frame and its page.
      assert.equal(mockup.app.all('iframe')[0], frame);
      // A colour's swatch is an SVG fill; a font's is none.
      assert.equal(tokens[1].all('rect')[0].getAttribute('fill'), '#161616');
      const font = tokens.find((token) => token.textContent.endsWith('--corthex-type-body-01'));
      assert.deepEqual([font.all('rect').length, font.all('span', 'sw').length], [0, 1]);
      // Escape in the token list chooses nothing again, as on the picture (TASK-459).
      panelOf(mockup).all('div', 'tokens')[0].dispatch('keydown', { key: 'Escape' });
      assert.deepEqual([tokens[1].getAttribute('aria-pressed'), selectedOf(mockup).all('b').map((b) => b.textContent)], ['false', ['그림 전체']]);
    } finally {
      mockup.close();
    }
  });

  test('a box moves by the arrow keys, 8 pixels a step and 40 with Shift, and is sent once with a new request key after 400 ms', async () => {
    const page = await openStage('erd');
    try {
      const table = ELEMENTS.erd.find((element) => element.kind === 'table');
      const at = boxOf('erd', table.key);
      let button = buttonNamed(page, 'tbl', table.name);
      button.dispatch('keydown', { key: 'ArrowRight' });
      button = buttonNamed(page, 'tbl', table.name);
      assert.deepEqual([Number(holderOf(button).getAttribute('x')), Number(holderOf(button).getAttribute('y'))], [at.x + STEP - 6, at.y - 6]);
      assert.equal(page.document.activeElement, button);
      button.dispatch('keydown', { key: 'ArrowDown', shiftKey: true });
      assert.deepEqual(page.sent, []);
      await waitSend(page);
      assert.equal(page.sent.length, 1);
      assert.deepEqual(page.sent[0].body, { element: table.key, x: at.x + STEP, y: at.y + LONG_STEP });
      assert.equal(page.sent[0].path, positionsPath('erd'));
      assert.match(page.sent[0].key, /^"nw_[0-9a-hjkmnp-tv-z]{12}"$/);
      button = buttonNamed(page, 'tbl', table.name);
      assert.deepEqual([Number(holderOf(button).getAttribute('x')), Number(holderOf(button).getAttribute('y'))], [at.x + STEP - 6, at.y + LONG_STEP - 6]);
      assert.equal(nameIn(selectedOf(page)), table.name);
      // The next move is another action, under another key.
      button.dispatch('keydown', { key: 'ArrowLeft' });
      await waitSend(page);
      assert.equal(page.sent.length, 2);
      assert.deepEqual(page.sent[1].body, { element: table.key, x: at.x, y: at.y + LONG_STEP });
      assert.notEqual(page.sent[1].key, page.sent[0].key);
    } finally {
      page.close();
    }
  });

  test('a drag moves a box once it is let go 3 pixels or more away; a click does not', async () => {
    const page = await openStage('sitemap');
    try {
      const at = boxOf('sitemap', 'SCR-143');
      const button = buttonNamed(page, 'scr', 'Projects');
      button.dispatch('pointerdown', { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
      button.dispatch('pointermove', { clientX: 101, clientY: 101 });
      button.dispatch('pointerup', { clientX: 101, clientY: 101 });
      await waitSend(page);
      assert.deepEqual(page.sent, []);
      button.dispatch('pointerdown', { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
      button.dispatch('pointermove', { clientX: 150, clientY: 120 });
      assert.deepEqual([Number(holderOf(button).getAttribute('x')), Number(holderOf(button).getAttribute('y'))], [at.x + 50 - 6, at.y + 20 - 6]);
      button.dispatch('pointerup', { clientX: 160, clientY: 130 });
      await waitSend(page);
      assert.deepEqual(page.sent.map((each) => each.body), [{ element: 'SCR-143', x: at.x + 60, y: at.y + 30 }]);
    } finally {
      page.close();
    }
  });

  test('a flow box\'s shape follows its drag by an SVG transform; a drag the browser cancels puts the box back and sends nothing', async () => {
    const page = await openStage('flow');
    try {
      const button = pictureBox(page).all('button', 'fbox')[0];
      const holder = holderOf(button);
      const placeOf = () => [Number(holder.getAttribute('x')), Number(holder.getAttribute('y'))];
      const before = placeOf();
      const transformed = () => pictureBox(page).descendants().filter((element) => element.getAttribute('transform') !== null);
      assert.deepEqual(transformed(), []);
      button.dispatch('pointerdown', { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
      button.dispatch('pointermove', { clientX: 150, clientY: 120 });
      // The box goes to whole pixels, as API-274 takes them; the shape moves by as much.
      const at = { x: before[0] + 6, y: before[1] + 6 };
      const to = { x: Math.round(at.x + 50), y: Math.round(at.y + 20) };
      assert.deepEqual(placeOf(), [to.x - 6, to.y - 6]);
      assert.deepEqual(transformed().map((shape) => shape.getAttribute('transform')), [`translate(${to.x - at.x} ${to.y - at.y})`]);
      button.dispatch('pointercancel');
      assert.deepEqual(placeOf(), before);
      assert.deepEqual(transformed(), []);
      // The pointer let go after the cancel is no drop.
      button.dispatch('pointerup', { clientX: 160, clientY: 130 });
      await waitSend(page);
      assert.deepEqual(page.sent, []);
      assert.deepEqual(placeOf(), before);
    } finally {
      page.close();
    }
  });

  test('a phone, a removed diagram, stage 08\'s panels, a lane and a context take no move', async () => {
    const checks = [
      ['board', { phone: true }, (page) => buttonNamed(page, 'stk', 'Send snapshot')],
      ['oldFlow', { search: `?d=${ID.oldFlow}` }, (page) => pictureBox(page).all('button', 'fbox')[0]],
      ['states', {}, (page) => pictureBox(page).all('button', 'spanel')[0]],
      ['board', {}, (page) => pictureBox(page).all('button', 'plabel')[0]],
      ['board', {}, (page) => pictureBox(page).all('button', 'ctx-head')[0]],
    ];
    for (const [which, options, find] of checks) {
      const page = await openStage(which, options);
      try {
        const button = find(page);
        const before = holderOf(button).getAttribute?.('x') ?? null;
        button.dispatch('keydown', { key: 'ArrowRight', preventDefault() {} });
        button.dispatch('pointerdown', { button: 0, clientX: 0, clientY: 0 });
        button.dispatch('pointermove', { clientX: 50, clientY: 50 });
        button.dispatch('pointerup', { clientX: 50, clientY: 50 });
        await waitSend(page);
        assert.deepEqual(page.sent, [], which);
        assert.equal(holderOf(find(page)).getAttribute?.('x') ?? null, before, which);
      } finally {
        page.close();
      }
    }
    const phone = await openStage('board', { phone: true });
    try {
      assert.deepEqual(texts(phone, 'p', 'sec'), ['Git 문서에서 그린 그림이에요. 눌러서 댓글을 읽고 남겨요.']);
      assert.ok(texts(phone, 'span').includes(WORKBENCH_WORDS.phone));
    } finally {
      phone.close();
    }
  });

  test('a move waits for an in-flight save; a lost connection keeps the request key for retry', async () => {
    let release;
    const held = new Promise((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const moved = (body, key) => {
      calls += 1;
      if (calls === 1) return held.then(() => movedAnswer('erd')(body, key));
      if (calls === 3) return new TypeError('Failed to fetch');
      return movedAnswer('erd')(body, key);
    };
    const page = await openStage('erd', { moved });
    try {
      const table = ELEMENTS.erd.find((element) => element.kind === 'table');
      const at = boxOf('erd', table.key);
      buttonNamed(page, 'tbl', table.name).dispatch('keydown', { key: 'ArrowRight' });
      await delay(SEND_AFTER_MS + 80);
      buttonNamed(page, 'tbl', table.name).dispatch('keydown', { key: 'ArrowRight' });
      await delay(SEND_AFTER_MS + 80);
      assert.equal(page.sent.length, 1);
      release();
      await page.settle();
      assert.deepEqual(page.sent.map((each) => each.body.x), [at.x + STEP]);
      buttonNamed(page, 'tbl', table.name).dispatch('keydown', { key: 'ArrowRight' });
      await waitSend(page);
      assert.deepEqual(page.sent.map((each) => each.body.x), [at.x + STEP, at.x + 2 * STEP]);
      // A third move whose connection is lost: the error, and its retry under the same key.
      buttonNamed(page, 'tbl', table.name).dispatch('keydown', { key: 'ArrowRight' });
      await waitSend(page);
      assert.equal(page.sent.length, 3);
      // A lost connection has no code: the message of any failure.
      assert.deepEqual(page.app.all('div', 'wb-notice')[0].all('b').map((b) => b.textContent), [message('internal')]);
      page.app.all('div', 'wb-notice')[0].all('button')[0].click();
      await page.settle();
      assert.equal(page.sent.length, 4);
      assert.equal(page.sent[3].key, page.sent[2].key);
      assert.deepEqual(page.app.all('div', 'wb-notice')[0].children, []);
    } finally {
      page.close();
    }
  });

  test('a failed move blocks another move until retry and preserves its original position for undo', async () => {
    let calls = 0;
    const moved = (body, key) => {
      calls += 1;
      return calls === 1 ? new TypeError('Failed to fetch') : movedAnswer('erd')(body, key);
    };
    const page = await openStage('erd', { moved });
    try {
      const table = ELEMENTS.erd.find((element) => element.kind === 'table');
      const at = boxOf('erd', table.key);
      buttonNamed(page, 'tbl', table.name).dispatch('keydown', { key: 'ArrowRight' });
      await waitSend(page);
      assert.equal(page.sent.length, 1);
      // The retry must settle the uncertain save before another move can change its original position.
      buttonNamed(page, 'tbl', table.name).dispatch('keydown', { key: 'ArrowRight' });
      page.app.all('div', 'wb-notice')[0].all('button')[0].click();
      await page.settle();
      assert.deepEqual(page.sent[1].body, { element: table.key, x: at.x + STEP, y: at.y });
      assert.equal(page.sent[1].key, page.sent[0].key);
      assert.equal(page.sent.length, 2);
      assert.deepEqual(page.app.all('div', 'wb-notice')[0].children, []);
      pictureBox(page).all('div', 'move-history')[0].all('button')[0].click();
      await page.settle();
      assert.deepEqual(page.sent[2].body, { element: table.key, x: at.x, y: at.y, expected: { x: at.x + STEP, y: at.y }, reset: true });
    } finally {
      page.close();
    }
  });

  test('different boxes do not start competing saves before the first is settled', async () => {
    const page = await openStage('erd');
    try {
      const tables = ELEMENTS.erd.filter((element) => element.kind === 'table');
      buttonNamed(page, 'tbl', tables[0].name).dispatch('keydown', { key: 'ArrowRight' });
      buttonNamed(page, 'tbl', tables[1].name).dispatch('keydown', { key: 'ArrowRight' });
      await waitSend(page);
      assert.deepEqual(page.sent.map((entry) => entry.body.element), [tables[0].key]);
      buttonNamed(page, 'tbl', tables[1].name).dispatch('keydown', { key: 'ArrowRight' });
      await waitSend(page);
      assert.deepEqual(page.sent.map((entry) => entry.body.element), [tables[0].key, tables[1].key]);
    } finally { page.close(); }
  });

  test('a move\'s answer goes into the diagram shown now, which a read again replaced while it was sent', async () => {
    let release;
    const held = new Promise((resolve) => {
      release = resolve;
    });
    let later = false;
    const LATER = '2026-11-23T02:00:00.000Z';
    const page = await openStage('erd', {
      moved: (body, key) => held.then(() => movedAnswer('erd')(body, key)),
      more: {
        // The read again answers a later drawing of the same diagram, so the view is built again from it.
        [diagramPath('erd')]: (path, init) => json(200, diagramOf('erd', later ? {
          drawing: { id: `dw_${ID.erd.slice(3)}`, revision: 4, version: 'b'.repeat(40), status: 'drawn', failed_at: null, drawn_at: LATER },
        } : {}))(path, init),
      },
    });
    try {
      const table = ELEMENTS.erd.find((element) => element.kind === 'table');
      const at = boxOf('erd', table.key);
      const placeOf = () => {
        const holder = holderOf(buttonNamed(page, 'tbl', table.name));
        return [Number(holder.getAttribute('x')), Number(holder.getAttribute('y'))];
      };
      buttonNamed(page, 'tbl', table.name).dispatch('keydown', { key: 'ArrowRight' });
      await delay(SEND_AFTER_MS + 80);
      assert.equal(page.sent.length, 1);
      later = true;
      page.shell.reload();
      // The move's answer is held, so the page cannot settle: the read again answers at once.
      await delay(60);
      assert.deepEqual(placeOf(), [at.x + STEP - 6, at.y - 6]);
      release();
      await page.settle();
      // Drawn again from the data it has: the box stays where its answer put it.
      page.shell.redraw();
      assert.deepEqual(placeOf(), [at.x + STEP - 6, at.y - 6]);
    } finally {
      page.close();
    }
  });

  test('the stage\'s diagrams are listed with the removed one last; choosing one opens it in the page with ?d=, and back returns', async () => {
    const page = await openStage('flow');
    try {
      const steps = page.app.all('nav', 'steps')[0];
      assert.equal(steps.getAttribute('aria-label'), '이 단계의 그림 3개');
      assert.deepEqual(steps.all('a').map((link) => link.textContent), [FLOWS[0].name, FLOWS[1].name, `${FLOWS[2].name}지움`]);
      assert.equal(steps.all('a')[0].getAttribute('aria-current'), 'page');
      const href = `${pathOf('flow2')}?d=${ID.flow2}`;
      assert.equal(steps.all('a')[1].getAttribute('href'), href);
      // A click with a key held is the browser's, as a new tab.
      steps.all('a')[1].dispatch('click', { ctrlKey: true });
      assert.deepEqual(page.history.pushed, []);
      steps.all('a')[1].click();
      await page.settle();
      assert.deepEqual(page.history.pushed, [href]);
      assert.deepEqual(page.location.assigned, []);
      assert.deepEqual(texts(page, 'h1'), [FLOWS[1].name]);
      assert.equal(page.app.all('nav', 'steps')[0].all('a')[1].getAttribute('aria-current'), 'page');
      page.pop(pathOf('flow'));
      await page.settle();
      assert.deepEqual(texts(page, 'h1'), [FLOWS[0].name]);
      assert.equal(page.location.reloads, 0);
    } finally {
      page.close();
    }
  });

  test('a diagram gone meanwhile opens the stage\'s first diagram with "NEXUS에 없는 다이어그램이에요"', async () => {
    const page = await openStage('flow', { more: { [diagramPath('flow2')]: problem(404, 'diagram_not_found') } });
    try {
      page.app.all('nav', 'steps')[0].all('a')[1].click();
      await page.settle();
      assert.deepEqual([page.location.pathname, page.location.search], [pathOf('flow'), '']);
      assert.deepEqual(texts(page, 'h1'), [FLOWS[0].name]);
      assert.deepEqual(page.app.all('main')[0].all('div', 'warn').map((notice) => notice.textContent), [message('diagram_not_found')]);
      assert.equal(message('diagram_not_found'), 'NEXUS에 없는 다이어그램이에요.');
    } finally {
      page.close();
    }
  });

  test('a diagram gone after its switch was shown shows as gone on a read again, not as the stage\'s first diagram', async () => {
    let gone = false;
    const page = await openStage('flow', {
      more: { [diagramPath('flow2')]: (path, init) => (gone ? problem(404, 'diagram_not_found') : json(200, diagramOf('flow2')))(path, init) },
    });
    try {
      page.app.all('nav', 'steps')[0].all('a')[1].click();
      await page.settle();
      assert.deepEqual(texts(page, 'h1'), [FLOWS[1].name]);
      gone = true;
      page.shell.reload();
      await page.settle();
      assert.deepEqual([page.location.pathname, page.location.search], [pathOf('flow2'), `?d=${ID.flow2}`]);
      assert.deepEqual(texts(page, 'h1'), [message('diagram_not_found')]);
    } finally {
      page.close();
    }
  });

  test('a switch made while another still reads shows only the last one chosen', async () => {
    let release;
    const held = new Promise((resolve) => {
      release = resolve;
    });
    // The first switch's diagram is gone, and answers only after the second switch was made.
    const page = await openStage('flow', { more: { [diagramPath('flow2')]: () => held.then(() => problem(404, 'diagram_not_found')()) } });
    try {
      const second = `${pathOf('flow2')}?d=${ID.flow2}`;
      const third = `${pathOf('oldFlow')}?d=${ID.oldFlow}`;
      page.shell.go(second);
      await delay(40);
      assert.ok(page.calls.includes(diagramPath('flow2')));
      page.shell.go(third);
      release();
      await page.settle();
      assert.deepEqual(page.history.pushed, [second, third]);
      assert.deepEqual([page.location.pathname, page.location.search], [pathOf('oldFlow'), `?d=${ID.oldFlow}`]);
      assert.deepEqual(texts(page, 'h1'), [FLOWS[2].name]);
      assert.deepEqual(page.app.all('main')[0].all('div', 'warn'), []);
    } finally {
      page.close();
    }
  });

  test('a removed diagram opens read-only, marked 지움, with its last drawing', async () => {
    const page = await openStage('oldFlow', { search: `?d=${ID.oldFlow}` });
    try {
      assert.deepEqual(texts(page, 'h1'), [FLOWS[2].name]);
      const current = page.app.all('nav', 'steps')[0].all('a').find((link) => link.getAttribute('aria-current') === 'page');
      assert.equal(current.textContent, `${FLOWS[2].name}지움`);
      assert.ok(pictureBox(page).all('button', 'fbox').length > 0);
    } finally {
      page.close();
    }
  });

  test('a failed drawing says so with where, and draws the last good drawing under it', async () => {
    const page = await openStage('erd', {
      more: {
        [diagramPath('erd')]: json(200, diagramOf('erd', {
          drawing: { id: 'dw_0000000000d5', revision: 4, version: 'c'.repeat(40), status: 'failed', failed_at: 'db/nexus.sql:12', drawn_at: TIME },
          last_drawn: { id: `dw_${ID.erd.slice(3)}`, revision: 3, version: 'a'.repeat(40), status: 'drawn', failed_at: null, drawn_at: TIME },
        })),
      },
    });
    try {
      const notice = page.app.all('div', 'err')[0];
      assert.deepEqual(notice.all('b').map((b) => b.textContent), [WORKBENCH_WORDS.notDrawn]);
      assert.equal(notice.all('span', 'mono')[0].textContent, 'db/nexus.sql:12 ');
      assert.ok(pictureBox(page).all('button', 'tbl').length > 0);
    } finally {
      page.close();
    }
  });

  test('the mockup frame reads the page\'s status first, shows its bar, opens the page again once, and stops the second time', async () => {
    const page = await openStage('mockup');
    try {
      const path = pagePath(P, ID.mockup);
      assert.ok(page.calls.indexOf(path) > page.calls.indexOf(diagramPath('mockup')));
      const group = page.app.all('div', 'isolated')[0];
      assert.equal(group.getAttribute('aria-label'), FRAME_WORDS.group);
      assert.deepEqual(group.all('div', 'isobar')[0].children.map((child) => child.textContent), ['sandbox', FRAME_WORDS.bar]);
      let frame = group.all('iframe')[0];
      assert.deepEqual(['src', 'sandbox', 'title', 'referrerpolicy'].map((name) => frame.getAttribute(name)), [path, 'allow-scripts', 'nexus-mockup.html', 'no-referrer']);
      assert.deepEqual(texts(page, 'p', 'mono'), ['nexus-mockup.html']);
      frame.dispatch('load');
      assert.deepEqual(group.all('div', 'frame-note')[0].children, []);
      // The mockup goes to another page: the page opens again, once.
      frame.setAttribute('src', 'about:blank');
      frame.dispatch('load');
      assert.deepEqual(group.all('div', 'frame-note')[0].all('b').map((b) => b.textContent), [FRAME_WORDS.reopened]);
      assert.equal(frame.getAttribute('src'), path);
      frame.dispatch('load');
      assert.equal(group.all('iframe')[0], frame);
      // It goes elsewhere again: the view stops, with 다시 열기.
      frame.dispatch('load');
      assert.deepEqual(group.all('iframe'), []);
      assert.deepEqual(group.all('b').map((b) => b.textContent), [FRAME_WORDS.stopped]);
      assert.equal(FRAME_WORDS.stopped, '목업이 계속 다른 페이지를 열어요');
      const reads = page.calls.filter((call) => call === path).length;
      group.all('button').find((button) => button.textContent === '다시 열기').click();
      await page.settle();
      assert.equal(page.calls.filter((call) => call === path).length, reads + 1);
      frame = group.all('iframe')[0];
      assert.equal(frame.getAttribute('src'), path);
    } finally {
      page.close();
    }
  });

  test('the mockup frame shows a mockup that never drew, a page gone and a failure in the frame\'s place', async () => {
    const cases = [
      [problem(409, 'not_drawn'), (slot) => assert.deepEqual([slot.all('h2')[0].textContent, slot.all('p')[0].textContent], ['nexus-mockup.html', message('not_drawn')])],
      [problem(404, 'diagram_not_found'), (slot) => assert.deepEqual([slot.all('b')[0].textContent, slot.all('button')[0].textContent], [message('diagram_not_found'), '새로 고침'])],
      [problem(500, 'internal'), (slot) => assert.deepEqual([slot.all('b')[0].textContent, slot.all('button')[0].textContent, slot.all('span', 'helper')[0].textContent], [message('internal'), '다시 시도', `traceId ${TRACE}`])],
      [() => new TypeError('Failed to fetch'), (slot) => assert.deepEqual([slot.all('b')[0].textContent, slot.all('span', 'helper')], [message('internal'), []])],
    ];
    for (const [answer, check] of cases) {
      const page = await openStage('mockup', { more: { [pagePath(P, ID.mockup)]: answer } });
      try {
        const slot = page.app.all('div', 'frame-slot')[0];
        assert.deepEqual(slot.all('iframe'), []);
        check(slot);
      } finally {
        page.close();
      }
    }
  });

  test('proposals lie dashed with the AI badge, waiting change sets ringed with 반영 대기, adds as boxes under the picture', async () => {
    const event = 'CTX-037/command:Send snapshot/event:Snapshot received';
    const command = 'CTX-037/command:Send snapshot';
    const added = 'CTX-037/command:Send snapshot/event:Snapshot queued';
    const set = (id, origin, state, changes, fields = {}) => ({
      id, part: '', stage: '01-domain', diagram: ID.board, drawing: `dw_${ID.board.slice(3)}`, version: 'a'.repeat(40), origin,
      thread: null, state, items: [], adds: [], reason: null, change: null, source_text: false, changes, made_at: TIME, decided_at: null,
      reflection: null, pull_request: null, ...fields,
    });
    const overlays = [
      set('np_0000000000e1', 'proposal', 'proposed', [
        { op: 'add', element: added, name: 'Snapshot queued', target: null },
        { op: 'connect', element: command, name: null, target: added },
        { op: 'rename', element: event, name: 'Snapshot taken', target: null },
      ], { items: ['CTX-037'] }),
      set('np_0000000000e2', 'direct_edit', 'accepted', [{ op: 'remove', element: 'CTX-037/command:Send snapshot/event:Snapshot rejected', name: null, target: null }]),
      set('np_0000000000e3', 'proposal', 'rejected', [{ op: 'rename', element: command, name: 'Never shown', target: null }]),
    ];
    const diagram = diagramOf('board', { overlays });
    const model = overlayModel(diagram);
    assert.deepEqual(model.ghosts, [{ key: added, name: 'Snapshot queued', kind: 'event', waiting: false, set: 'np_0000000000e1' }]);
    assert.deepEqual(model.links, [{ from: command, to: added, name: '', waiting: false, set: 'np_0000000000e1' }]);
    assert.deepEqual(model.marks.get(event).rename, { name: 'Snapshot taken', waiting: false });
    assert.equal(model.marks.get('CTX-037/command:Send snapshot/event:Snapshot rejected').waiting, true);
    assert.equal(model.marks.get(command).rename, null);
    const page = await openStage('board', { more: { [diagramPath('board')]: json(200, diagram) } });
    try {
      const box = pictureBox(page);
      const renamed = buttonNamed(page, 'stk', 'Snapshot taken');
      assert.ok(renamed.className.split(' ').includes('ov-prop'));
      assert.deepEqual([renamed.all('span', 'ai')[0].textContent, renamed.all('s', 'was')[0].textContent], ['AI', 'Snapshot received']);
      // The board shows "Snapshot rejected" twice, in its lane and in its context; the context's is removed.
      const [removing, ...others] = box.all('button', 'ov-remove');
      assert.deepEqual([others, removing.all('b', 'nm')[0].textContent], [[], 'Snapshot rejected']);
      assert.ok(removing.className.split(' ').includes('waiting'));
      assert.deepEqual(removing.all('span', 'mk').map((mark) => mark.textContent), [MARK_WORDS.wait]);
      const ghost = box.all('div', 'ghost')[0];
      assert.deepEqual([ghost.all('span', 'cap')[0].textContent, ghost.all('b')[0].textContent], ['AI · 이벤트', 'Snapshot queued']);
      const ghostTop = Number(ghost.parentNode.parentNode.getAttribute('y'));
      const lowest = Math.max(...ELEMENTS.board.filter((element) => element.detail?.box).map((element) => element.detail.box.y + element.detail.box.height));
      assert.ok(ghostTop > lowest);
      assert.equal(box.all('path', 'ov-link').length, 1);
      assert.equal(buttonNamed(page, 'stk', 'Never shown'), undefined);
    } finally {
      page.close();
    }
  });

  test('a moved box keeps the others clear on the ERD, the sitemap and the flows, and is drawn over them on the board', () => {
    const moveFirst = (which, elements, kinds) => {
      const diagram = { kind: DIAGRAMS[which]?.[1] ?? 'user_flow', elements: elements.map(asElement) };
      const first = diagram.elements.find((element) => kinds.includes(element.kind) && element.detail?.box);
      const to = { x: first.detail.box.x + 400, y: first.detail.box.y + 80 };
      return { diagram, first, to, place: placement(diagram, new Map([[first.key, to]])) };
    };
    for (const [which, kinds] of [['erd', ['table']], ['sitemap', ['screen']]]) {
      const { first, to, place } = moveFirst(which, ELEMENTS[which], kinds);
      assert.equal(place.mode, 'clear', which);
      assert.deepEqual([place.boxes.get(first.key).x, place.boxes.get(first.key).y], [to.x, to.y], which);
    }
    for (const flow of FLOWS) {
      const { first, to, place } = moveFirst('flow', flow.elements, ['step', 'terminal', 'decision']);
      assert.equal(place.mode, 'clear', flow.name);
      assert.deepEqual([place.boxes.get(first.key).x, place.boxes.get(first.key).y], [to.x, to.y], flow.name);
    }
    const board = moveFirst('board', ELEMENTS.board, ['event']);
    assert.equal(board.place.mode, 'over');
    assert.deepEqual([board.place.boxes.get(board.first.key).x, board.place.boxes.get(board.first.key).y], [board.to.x, board.to.y]);
  });

  test('a sticky moved on the board is painted after every other box, so that it shows whole over them', async () => {
    const page = await openStage('board');
    try {
      const event = ELEMENTS.board.find((element) => element.kind === 'event');
      buttonNamed(page, 'stk', event.name).dispatch('keydown', { key: 'ArrowRight', shiftKey: true });
      const svg = pictureBox(page).all('svg', 'pic')[0];
      const holders = svg.children.filter((child) => child.tagName.toLowerCase() === 'foreignobject');
      assert.equal(holders.at(-1), holderOf(buttonNamed(page, 'stk', event.name)));
      await waitSend(page);
    } finally {
      page.close();
    }
  });

  test('the guard: a flow whose drawing layout.js does not give back is drawn over, with only the moved box\'s lines re-routed', () => {
    const elements = FLOWS[0].elements.map(asElement);
    // A drawing laid out by some other hand: one line's route is not the one layout.js gives.
    const bent = elements.find((element) => element.kind === 'arrow' && element.detail.points.length === 2 && element.detail.from !== 'A');
    bent.detail = { ...bent.detail, points: [bent.detail.points[0], { x: bent.detail.points[0].x + 1, y: bent.detail.points[1].y }] };
    const diagram = { kind: 'user_flow', elements };
    assert.equal(placement(diagram).mode, 'drawn');
    const moved = elements.find((element) => element.key === 'A');
    const to = { x: moved.detail.box.x + 300, y: moved.detail.box.y };
    const place = placement(diagram, new Map([['A', to]]));
    assert.equal(place.mode, 'over');
    assert.deepEqual([place.boxes.get('A').x, place.boxes.get('A').y], [to.x, to.y]);
    for (const element of elements.filter((each) => each.kind === 'arrow')) {
      const touches = element.detail.from === 'A' || element.detail.to === 'A';
      if (touches) assert.equal(place.lines.get(element.key).length, 2, element.key);
      else assert.deepEqual(place.lines.get(element.key), element.detail.points, element.key);
    }
  });
});

describe('SCR-145 against the server', () => {
  const responses = responseRecord();
  const NAME = 'nexus-page';
  const realFetch = globalThis.fetch;
  let folder;
  let db;
  let local;
  let good;
  let broken;
  let s;
  let failing = false;
  // The first diagram of each stage of the pushed project, by stage, with its part.
  const first = {};
  const owner = () => ({ 'Cf-Access-Jwt-Assertion': local.token() });
  const someone = () => ({ 'Cf-Access-Jwt-Assertion': local.token({ email: 'someone@example.com' }) });
  const headersOf = (who) => ({ owner: owner(), someone: someone(), agent: s.agent.headers, nobody: {} })[who];
  // The mark of a sign-in just tried, so that a 401 shows its message rather than loading the page again.
  const signedOut = () => ({ [GATE_KEY]: String(Date.now()) });

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-workbench-'));
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
    // This repository's own snapshot: every stage's diagrams drawn as an agent sends them.
    const pushed = await good.send({
      method: 'POST', path: '/api/snapshots', headers: { 'Content-Type': 'application/json', ...s.agent.headers },
      body: JSON.stringify(repositorySnapshot(FORMAT_03, { name: NAME })),
    });
    assert.equal(pushed.status, 201);
    const project = responses.note('getProject', await good.send({ path: `/api/projects/${NAME}`, headers: owner() }));
    for (const row of project.json.stages) {
      if (row.diagrams.length > 0 && first[row.stage] === undefined) first[row.stage] = { id: row.diagrams[0].id, part: row.part };
    }
  });

  after(async () => {
    await good.close();
    await broken.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  const stagePath = (stage) => `/p/${NAME}/${first[stage].part || '_'}/${stage}`;
  const diagramRead = (stage) => `/api/projects/${NAME}/diagrams/${first[stage].id}`;
  // The server's answer to a request, as a Response again for the page.
  const replayOf = (answer) => () => new Response(answer.text, { status: answer.status, headers: { 'content-type': answer.headers['content-type'] } });
  // The listed responses' cases: those of each listed status, one for each Problem code it lists.
  const casesOf = (action, cases) => listedResponses(action).map((listed) => {
    const found = cases.filter((each) => (listed.status === 'default' ? each.status === 500 : String(each.status) === listed.status)
      && (listed.codes.length === 0 || listed.codes.includes(each.code)));
    assert.equal(found.length, Math.max(1, listed.codes.length), `${action} ${listed.status}`);
    return found;
  }).flat();

  // The page of path reading target as who; a request in replay ("GET /api/..." or "POST /api/...") gets that answer
  // instead. Each move the page sends to the server is noted, and page.asked lists every request as "METHOD path".
  async function openOn(target, path, { who = 'owner', replay = {}, session = {} } = {}) {
    const asked = [];
    const answers = async (read, init) => {
      const method = init?.method ?? 'GET';
      asked.push(`${method} ${read}`);
      const stand = replay[`${method} ${read}`];
      if (stand !== undefined) return stand(read, init);
      const response = await realFetch(`http://127.0.0.1:${target.port}${read}`, {
        method, headers: { ...(init?.headers ?? {}), ...headersOf(who) }, body: init?.body, redirect: 'manual',
      });
      if (method !== 'POST') return response;
      const text = await response.text();
      responses.note('moveElement', { status: response.status, headers: Object.fromEntries(response.headers), text, json: JSON.parse(text) });
      return new Response(text, { status: response.status, headers: response.headers });
    };
    const page = await openPage(path, { answers, session });
    page.asked = asked;
    return page;
  }

  const permissionShows = (code, buttons = []) => (page) => assert.deepEqual([texts(page, 'h1'), texts(page, 'button')], [[message(code)], buttons]);
  // A 401 once the owner's other reads succeeded: the page loads again once, through the gate (the shell's gate rule).
  const gateShows = (page) => assert.deepEqual([page.location.reloads, page.session.getItem(GATE_KEY) !== null], [1, true]);
  const failureShows = (page) => assert.deepEqual([texts(page, 'b'), texts(page, 'button').includes('다시 시도')], [[message('internal')], true]);

  test('every stage draws from the server by names, and a move is sent and kept (API-274 200)', async () => {
    const titles = { '01-domain': 'DDD board', '05-erd': 'ERD', '07-sitemap': 'Sitemap', '09-mockup': 'nexus-mockup.html' };
    for (const stage of ['01-domain', '02-prd', '03-user-flow', '05-erd', '07-sitemap', '08-screen-states', '09-mockup']) {
      const answer = responses.note('getDiagram', await good.send({ path: diagramRead(stage), headers: owner() }));
      assert.equal(answer.status, 200, stage);
      const page = await openOn(good, stagePath(stage));
      try {
        assert.deepEqual(texts(page, 'h1'), [titles[stage] ?? answer.json.name], stage);
        assert.doesNotMatch(page.app.all('main')[0].textContent, /\bdg_[0-9a-z]{12}\b/, stage);
        if (stage === '09-mockup') assert.equal(page.app.all('iframe')[0].getAttribute('src'), `${diagramRead(stage)}/page`);
        else assert.ok(pictureBox(page).all('button').length > 0, stage);
      } finally {
        page.close();
      }
    }
    const answer = responses.note('getMockupPage', await good.send({ path: `${diagramRead('09-mockup')}/page`, headers: owner() }));
    assert.equal(answer.status, 200);
    const page = await openOn(good, stagePath('05-erd'));
    try {
      const button = pictureBox(page).all('button', 'tbl')[0];
      const name = button.all('b', 'nm')[0].textContent;
      button.dispatch('keydown', { key: 'ArrowDown', shiftKey: true });
      await waitSend(page);
      assert.deepEqual(page.app.all('div', 'wb-notice')[0].children, []);
      const read = (await good.send({ path: diagramRead('05-erd'), headers: owner() })).json;
      const moved = read.elements.find((element) => element.name === name);
      assert.deepEqual(moved.position, { x: moved.detail.box.x, y: moved.detail.box.y + LONG_STEP });
    } finally {
      page.close();
    }
  });

  test('every response API-264 lists leads SCR-145 to the state its definition gives', async () => {
    const cases = casesOf('getProject', [
      { status: 200, who: 'owner', shows: (page) => assert.deepEqual(texts(page, 'h1'), ['DDD board']) },
      { status: 401, code: 'unauthenticated', who: 'nobody', shows: permissionShows('unauthenticated', ['새로 고침']) },
      { status: 403, code: 'not_owner', who: 'someone', shows: permissionShows('not_owner') },
      { status: 403, code: 'owner_only', who: 'agent', shows: permissionShows('owner_only') },
      {
        status: 404, code: 'project_not_found', who: 'owner', project: 'no-such-project',
        shows: (page) => assert.deepEqual([texts(page, 'h1'), page.app.all('a', 'btn').map((link) => link.textContent)], [[message('project_not_found')], ['프로젝트 목록']]),
      },
      { status: 500, code: 'internal', who: 'owner', fails: true, shows: failureShows },
    ]);
    for (const each of cases) {
      const target = each.fails ? broken : good;
      const project = each.project ?? NAME;
      failing = Boolean(each.fails);
      try {
        const answer = responses.note('getProject', await target.send({ path: `/api/projects/${project}`, headers: headersOf(each.who) }));
        assert.equal(answer.status, each.status);
        const page = await openOn(target, `/p/${project}/nexus/01-domain`, { who: each.who, session: each.status === 401 ? signedOut() : {} });
        try {
          each.shows(page);
        } finally {
          page.close();
        }
      } finally {
        failing = false;
      }
    }
    responses.assertEvery('getProject');
  });

  test('every response API-265 lists leads SCR-145 to the state its definition gives', async () => {
    const cases = casesOf('getDiagram', [
      { status: 200, who: 'owner', shows: (page) => assert.ok(pictureBox(page).all('button', 'tbl').length > 0) },
      { status: 401, code: 'unauthenticated', who: 'nobody', shows: gateShows },
      { status: 403, code: 'not_owner', who: 'someone', shows: permissionShows('not_owner') },
      { status: 403, code: 'owner_only', who: 'agent', shows: permissionShows('owner_only') },
      {
        status: 404, code: 'project_not_found', who: 'owner', path: () => `/api/projects/no-such-project/diagrams/${first['05-erd'].id}`,
        shows: (page) => assert.deepEqual(texts(page, 'h1'), [message('project_not_found')]),
      },
      {
        status: 404, code: 'diagram_not_found', who: 'owner', path: () => `/api/projects/${NAME}/diagrams/dg_zzzzzzzzzzzz`,
        shows: (page) => assert.deepEqual([texts(page, 'h1'), page.app.all('a', 'btn').map((link) => link.textContent)], [[message('diagram_not_found')], ['프로젝트로']]),
      },
      { status: 500, code: 'internal', who: 'owner', fails: true, shows: failureShows },
    ]);
    for (const each of cases) {
      failing = Boolean(each.fails);
      let answer;
      try {
        answer = responses.note('getDiagram', await (each.fails ? broken : good).send({ path: each.path?.() ?? diagramRead('05-erd'), headers: headersOf(each.who) }));
      } finally {
        failing = false;
      }
      assert.equal(answer.status, each.status);
      // The owner reads the project; the diagram's read answers as the server answered here.
      const page = await openOn(good, stagePath('05-erd'), { replay: { [`GET ${diagramRead('05-erd')}`]: replayOf(answer) } });
      try {
        each.shows(page);
      } finally {
        page.close();
      }
    }
    responses.assertEvery('getDiagram');
  });

  test('every response API-293 lists leads the mockup frame to the state SCR-145 gives', async () => {
    // A mockup that never drew: its drawing failed and it has no good one (SCR-145#not-drawn).
    const space = s.project('never-drawn');
    const never = s.diagram(space, { stage: '09-mockup', sourceKey: 'design/mockup/page.html', kind: 'mockup', name: 'Mockup', status: 'failed' });
    const pageOf = (project, id) => `/api/projects/${project}/diagrams/${id}/page`;
    const slotOf = (page) => page.app.all('div', 'frame-slot')[0];
    const inSlot = (code, button) => (page) => assert.deepEqual([slotOf(page).all('b')[0].textContent, slotOf(page).all('button')[0].textContent], [message(code), button]);
    const cases = casesOf('getMockupPage', [
      { status: 200, who: 'owner', shows: (page) => assert.equal(slotOf(page).all('iframe')[0].getAttribute('sandbox'), 'allow-scripts') },
      { status: 401, code: 'unauthenticated', who: 'nobody', shows: gateShows },
      { status: 403, code: 'not_owner', who: 'someone', shows: permissionShows('not_owner') },
      { status: 403, code: 'owner_only', who: 'agent', shows: permissionShows('owner_only') },
      { status: 404, code: 'project_not_found', who: 'owner', path: () => pageOf('no-such-project', first['09-mockup'].id), shows: inSlot('project_not_found', '새로 고침') },
      { status: 404, code: 'diagram_not_found', who: 'owner', path: () => pageOf(NAME, 'dg_zzzzzzzzzzzz'), shows: inSlot('diagram_not_found', '새로 고침') },
      { status: 409, code: 'not_drawn', who: 'owner', path: () => pageOf('never-drawn', idOf('dg', never.id)), real: true },
      { status: 500, code: 'internal', who: 'owner', fails: true, shows: inSlot('internal', '다시 시도') },
    ]);
    for (const each of cases) {
      failing = Boolean(each.fails);
      let answer;
      try {
        answer = responses.note('getMockupPage', await (each.fails ? broken : good).send({ path: each.path?.() ?? `${diagramRead('09-mockup')}/page`, headers: headersOf(each.who) }));
      } finally {
        failing = false;
      }
      assert.equal(answer.status, each.status);
      if (each.real) {
        // The owner opens that project's stage 09: the frame reads the page's status from the server itself.
        const page = await openOn(good, '/p/never-drawn/_/09-mockup');
        try {
          assert.deepEqual([slotOf(page).all('h2')[0].textContent, slotOf(page).all('p')[0].textContent], ['Mockup', message('not_drawn')]);
          assert.deepEqual(slotOf(page).all('iframe'), []);
        } finally {
          page.close();
        }
        continue;
      }
      const page = await openOn(good, stagePath('09-mockup'), {
        replay: each.status === 200 ? {} : { [`GET ${diagramRead('09-mockup')}/page`]: replayOf(answer) },
      });
      try {
        each.shows(page);
      } finally {
        page.close();
      }
    }
    responses.assertEvery('getMockupPage');
  });

  test('every response API-274 lists leads a move to the state SCR-145 gives', async () => {
    const path = `${diagramRead('05-erd')}/positions`;
    const element = (await good.send({ path: diagramRead('05-erd'), headers: owner() })).json.elements.find((each) => each.kind === 'table');
    const body = (fields = {}) => JSON.stringify({ element: element.key, x: 1, y: 2, ...fields });
    let count = 0;
    const key = () => {
      count += 1;
      return { 'Idempotency-Key': `"nw_${String(count).padStart(12, '0')}"` };
    };
    const json = { 'Content-Type': 'application/json' };
    const post = (fields = {}) => ({ method: 'POST', path, headers: { ...json, ...owner(), ...key() }, body: body(), ...fields });
    const reused = key();
    const notice = (page) => page.app.all('div', 'wb-notice')[0];
    const inNotice = (code, buttons = ['다시 시도']) => (page) => assert.deepEqual(
      [notice(page).all('b').map((b) => b.textContent), notice(page).all('button').map((button) => button.textContent)], [[message(code)], buttons],
    );
    // A 404 for the project or the diagram after a write: the page reads the diagram again first (SCR-145#error), which
    // here the server answers as before, so the diagram shows again with its box where it was and no notice.
    const readAgain = (page) => {
      const moved = page.asked.indexOf(`POST ${path}`);
      assert.ok(moved !== -1 && page.asked.indexOf(`GET ${diagramRead('05-erd')}`, moved) > moved, page.asked.join(', '));
      assert.deepEqual(notice(page).children, []);
      const at = element.position ?? element.detail.box;
      const holder = holderOf(buttonNamed(page, 'tbl', element.name));
      assert.deepEqual([Number(holder.getAttribute('x')), Number(holder.getAttribute('y'))], [at.x - 6, at.y - 6]);
    };
    const cases = casesOf('moveElement', [
      { status: 200, done: true },
      { status: 400, code: 'invalid_request', request: () => post({ headers: { ...json, ...owner() } }), shows: inNotice('invalid_request') },
      { status: 401, code: 'unauthenticated', request: () => post({ headers: { ...json, ...key() } }), shows: gateShows },
      { status: 403, code: 'owner_only', request: () => post({ headers: { ...json, ...s.agent.headers, ...key() } }), shows: permissionShows('owner_only') },
      { status: 403, code: 'not_owner', request: () => post({ headers: { ...json, ...someone(), ...key() } }), shows: permissionShows('not_owner') },
      { status: 403, code: 'cross_site', request: () => post({ headers: { ...json, ...owner(), ...key(), 'Sec-Fetch-Site': 'cross-site' } }), shows: permissionShows('cross_site', ['새로 고침']) },
      { status: 404, code: 'project_not_found', request: () => post({ path: `/api/projects/no-such-project/diagrams/${first['05-erd'].id}/positions` }), shows: readAgain },
      { status: 404, code: 'diagram_not_found', request: () => post({ path: `/api/projects/${NAME}/diagrams/dg_zzzzzzzzzzzz/positions` }), shows: readAgain },
      {
        status: 404, code: 'element_not_found', request: () => post({ body: body({ element: 'TBL-999' }) }),
        shows: (page) => {
          inNotice('element_not_found', ['새로 고침'])(page);
          assert.equal(message('element_not_found'), WORKBENCH_WORDS.moveGone);
          // The box goes back to where it was: the place the owner put it before, or else where it is drawn.
          const at = element.position ?? element.detail.box;
          const holder = holderOf(buttonNamed(page, 'tbl', element.name));
          assert.deepEqual([Number(holder.getAttribute('x')), Number(holder.getAttribute('y'))], [at.x - 6, at.y - 6]);
        },
      },
      {
        status: 409, code: 'request_key_reused',
        request: async () => {
          await good.send(post({ headers: { ...json, ...owner(), ...reused } }));
          return post({ headers: { ...json, ...owner(), ...reused }, body: body({ x: 99 }) });
        },
        shows: inNotice('request_key_reused'),
      },
      {
        status: 409, code: 'position_changed', historyOnly: true,
        request: () => post({ body: body({ expected: { x: -999999, y: -999999 } }) }),
      },
      { status: 413, code: 'body_too_large', request: () => post({ body: JSON.stringify({ element: element.key, x: 1, y: 2, pad: 'x'.repeat(2 * 1024 * 1024) }) }), shows: inNotice('body_too_large') },
      { status: 415, code: 'json_required', request: () => post({ headers: { 'Content-Type': 'text/plain', ...owner(), ...key() } }), shows: inNotice('json_required') },
      { status: 500, code: 'internal', fails: true, request: () => post(), shows: inNotice('internal') },
    ]);
    for (const each of cases) {
      // The 200 is the page's own move to the server, in the test before.
      if (each.done) continue;
      failing = Boolean(each.fails);
      let answer;
      try {
        answer = responses.note('moveElement', await (each.fails ? broken : good).send(await each.request()));
      } finally {
        failing = false;
      }
      assert.deepEqual([answer.status, answer.json.code], [each.status, each.code]);
      // A conditional conflict is exercised in the undo test above; an ordinary move never sends expected.
      if (each.historyOnly) continue;
      const page = await openOn(good, stagePath('05-erd'), { replay: { [`POST ${path}`]: replayOf(answer) } });
      try {
        // The table found by its name: a moved one is painted after the others.
        buttonNamed(page, 'tbl', element.name).dispatch('keydown', { key: 'ArrowRight' });
        await waitSend(page);
        // A read again after the answer.
        await page.settle();
        each.shows(page);
      } finally {
        page.close();
      }
    }
    responses.assertEvery('moveElement');
  });
});
