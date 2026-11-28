// SCR-145's changes (TASK-460; SPEC-019 to SPEC-023, SPEC-027) on test/fake-dom.js: the AI proposals with 수락 and
// 거절, each asked once; renaming by the name field, F2 and a double click; connecting with 잇기; what waits for
// reflection with 편집 취소 (SCR-145#waiting) and on a removed diagram; a phone, which offers none of them; and the text
// under stage 01's title. Then the screen against the server, with every response API-270, API-271, API-272 and
// API-273 list. How it looks, at 360 and 1440 pixels in light and dark, is the browser walk of the pull request.

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { createPages } from '../src/pages.js';
import { idOf } from '../src/ids.js';
import { ROUTES } from '../src/routes.js';
import { openStore } from '../src/store.js';
import { GATE_KEY } from '../web/states.js';
import { contract, validate } from './contract.js';
import { listedResponses, responseRecord } from './responses.js';
import { json, message, openPage, problem, texts } from './screen-page.js';
import { seed } from './seed.js';
import { localGate, newId, startServer, waitFor } from './support.js';

// The modules that import ./layout.js load once screen-page.js has taught the import where the server serves it from.
const { CHANGE_WORDS, kindLine, renamedFrom, toAnswer, waitingCount } = await import('../web/changes.js');
const { descriptionOf, WORKBENCH_WORDS } = await import('../web/workbench.js');
const { MARK_WORDS } = await import('../web/overlays.js');
const { THREAD_WORDS } = await import('../web/threads.js');

const TIME = '2026-11-23T01:00:00.000Z';
const P = 'reading-club';
const ID = Object.freeze({ board: 'dg_0000000000b1', erd: 'dg_0000000000b5', oldErd: 'dg_0000000000b6' });
const DRAWING = Object.freeze({ board: 'dw_0000000000b1', erd: 'dw_0000000000b5', oldErd: 'dw_0000000000b6' });
const stored = (name) => JSON.parse(readFileSync(new URL(`./${name}`, import.meta.url), 'utf8'));
const asElement = (element) => ({
  key: element.key, trace_id: element.trace_id ?? null, kind: element.kind, name: element.name ?? '', parent: element.parent ?? null,
  status: element.status ?? null, detail: element.detail ?? {}, position: null,
});
const ERD = stored('erd-expected.json').elements;
const BOARD = stored('ddd-board-expected.json').elements;
const [A, B, C] = ERD.filter((element) => element.kind === 'table');
const LINE = ERD.find((element) => element.kind === 'line');
const DIAGRAMS = Object.freeze({
  board: ['01-domain', 'ddd_board', 'DDD board', BOARD],
  erd: ['05-erd', 'erd', 'ERD', ERD],
  oldErd: ['05-erd', 'erd', 'Old ERD', ERD],
});

// API-265's Diagram of one of DIAGRAMS, drawn; fields replaces what it gives.
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

// A change set of the ERD as API-265 lists it.
const setOf = (id, origin, state, changes, fields = {}) => ({
  id, part: '', stage: '05-erd', diagram: ID.erd, drawing: DRAWING.erd, version: 'a'.repeat(40), origin,
  thread: origin === 'proposal' ? 'nc_0000000000t1' : null, state, items: [], adds: [], reason: null, change: null, source_text: false,
  changes, made_at: TIME, decided_at: state === 'proposed' ? null : TIME, reflection: null, pull_request: null, ...fields,
});
const rename = (element, name) => ({ op: 'rename', element: element.key, name, target: null });
const connect = (from, to) => ({ op: 'connect', element: from.key, name: null, target: to.key });

const PROPOSED = setOf('np_0000000000a1', 'proposal', 'proposed', [rename(A, 'agent_keys'), connect(A, C)], {
  items: ['TBL-146'], change: 'Rename agent_credentials to agent_keys.', reason: 'The owner asked to name the table after the term.',
});
const ACCEPTED = setOf('np_0000000000a2', 'proposal', 'accepted', [rename(C, 'snapshot_rows')], {
  items: ['TBL-148'], change: 'Rename snapshots to snapshot_rows.', reason: 'Rows, as the other tables.',
});
const RENAMED = setOf('np_0000000000a3', 'direct_edit', 'accepted', [rename(B, 'project_rooms')]);
const CONNECTED = setOf('np_0000000000a4', 'direct_edit', 'accepted', [connect(B, C)]);

const STAGE_IDS = ['01-domain', '02-prd', '03-user-flow', '04-functional-spec', '05-erd', '06-api', '07-sitemap', '08-screen-states', '09-mockup', '10-wbs', '11-development', '12-qa', '13-presentation'];
const summaryOf = (which) => {
  const [, kind, name] = DIAGRAMS[which];
  return { id: ID[which], kind, name, removed: which === 'oldErd', drawn: true, confirmation: 'none', waiting: 0, open_threads: which === 'oldErd' ? 1 : 0 };
};
// API-264's Project: the board on stage 01, and the ERD with a removed one listed last on stage 05 (SPEC-027).
function projectOf() {
  const listed = { '01-domain': ['board'], '05-erd': ['erd', 'oldErd'] };
  return {
    name: P, title: '독서 모임 앱', repository: 'https://github.com/example/demo', revision: 3, commit: 'a'.repeat(40), pushed_at: TIME, parts: [],
    stages: STAGE_IDS.map((stage) => ({
      stage, part: '', state: listed[stage] ? 'open' : 'not_sent', passed_at: null, diagrams: (listed[stage] ?? []).map(summaryOf),
    })),
    tool_links: [],
    workshop: null,
  };
}

const diagramPath = (which) => `/api/projects/${P}/diagrams/${ID[which]}`;
const changeSetPath = (id, verb) => `/api/projects/${P}/change-sets/${id}/${verb}`;
const editsPath = (which) => `${diagramPath(which)}/direct-edits`;

// Opens a stage at which's diagram, read as diagrams gives it (later reads as page.reads says by path); a POST is
// kept in page.sent as { path, body, key } and answered by posted(path, body), a function that makes a Response, or
// a Promise of one, or an Error to throw.
async function openStage(which, { diagram = diagramOf(which), phone = false, posted = () => json(500, {}) } = {}) {
  const reads = {
    '/api/projects': json(200, { projects: [], backup: null }),
    '/api/todo': json(200, { entries: [], backup: null }),
    [`/api/projects/${P}`]: json(200, projectOf()),
    [diagramPath(which)]: json(200, diagram),
  };
  const sent = [];
  const search = which === 'oldErd' ? `?d=${ID.oldErd}` : '';
  const page = await openPage(`/p/${P}/_/${DIAGRAMS[which][0]}`, {
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
  page.diagramReads = () => page.calls.filter((path) => path === diagramPath(which)).length;
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
const selectedOf = (page) => sectionOf(page, WORKBENCH_WORDS.selected);
const lineOf = (page) => page.app.all('div', 'wb-line')[0];
const pictureBox = (page) => page.app.all('div', 'wb-picture')[0];
const buttonNamed = (page, name) => pictureBox(page).all('button', 'tbl').find((button) => button.all('b', 'nm').some((b) => b.textContent === name));
const fieldOf = (page) => byId(page, 'element-name');
const buttonsIn = (node) => node.all('button').map((button) => button.textContent);
const shownTexts = (node, tag, className = null) => node.all(tag, className).filter((element) => element.shown).map((element) => element.textContent);
// A list's rows as [title, how, buttons].
const rowsOf = (list) => list.all('li').map((li) => [li.all('b')[0].textContent, li.all('span', 'sec')[0].textContent, buttonsIn(li)]);
// Whether element has the focus; compared by identity, since the assertion's message of a fake element is huge.
const focused = (page, element, what = 'the focus') => assert.ok(element !== null && element !== undefined && page.document.activeElement === element, what);
// A press of a button: a browser focuses it as it clicks.
const press = (button) => {
  button.focus();
  button.click();
};
const typeName = (page, name) => {
  const field = fieldOf(page);
  field.value = name;
  field.dispatch('input');
  return field;
};

describe('SCR-145 changes', () => {
  test('a proposal\'s kind line comes from its steps, each word once, as the mockup writes "이벤트 더하기"', () => {
    const steps = (...changes) => ({ changes, adds: [] });
    assert.equal(kindLine(steps({ op: 'add', element: 'CTX-037/command:Send snapshot/event:Snapshot queued', name: 'Snapshot queued', target: null })), '이벤트 더하기');
    assert.equal(kindLine(steps({ op: 'add', element: 'TBL-200', name: 'rooms', target: null })), '더하기');
    assert.equal(kindLine(steps(rename(A, 'x'), connect(A, B), rename(B, 'y'))), '이름 바꾸기 · 잇기');
    assert.equal(kindLine(steps({ op: 'remove', element: A.key, name: null, target: null })), '지우기');
    assert.equal(kindLine({ changes: [], adds: ['TBL-200'] }), '더하기');
    assert.equal(kindLine({ changes: [], adds: [] }), '바꾸기');
  });

  test('"AI 제안" shows each proposal\'s kind, text and reason with 수락 and 거절, an accepted one waiting, and 모두 처리함 when none is open', async () => {
    const rejected = setOf('np_0000000000a5', 'proposal', 'rejected', [rename(B, 'never_shown')], { change: 'Never shown.' });
    const page = await openStage('erd', { diagram: diagramOf('erd', { overlays: [ACCEPTED, PROPOSED, rejected] }) });
    try {
      const section = sectionOf(page, CHANGE_WORDS.proposals);
      assert.equal(section.hidden, false);
      assert.deepEqual(shownTexts(section, 'h2'), [CHANGE_WORDS.proposals]);
      assert.deepEqual(section.all('span', 'tag').map((tag) => tag.textContent), [toAnswer(1), MARK_WORDS.wait]);
      assert.equal(toAnswer(1), '답할 것 1');
      const cards = section.all('div', 'prop');
      assert.deepEqual(cards.map((card) => card.all('div', 'k')[0].textContent), ['AI이름 바꾸기', 'AI이름 바꾸기 · 잇기']);
      // API-265's order: accepted on top, then the proposals by when they were made.
      assert.deepEqual(cards.map((card) => card.all('b')[0].textContent), [ACCEPTED.change, PROPOSED.change]);
      assert.deepEqual(cards.map((card) => card.all('p', 'sec')[0].textContent), [CHANGE_WORDS.accepted, PROPOSED.reason]);
      assert.deepEqual(cards.map(buttonsIn), [[], [CHANGE_WORDS.accept, CHANGE_WORDS.reject]]);
      assert.equal(section.all('p', 'sec').some((p) => p.textContent === CHANGE_WORDS.allAnswered), false);
    } finally {
      page.close();
    }
    const none = await openStage('erd');
    try {
      const section = sectionOf(none, CHANGE_WORDS.proposals);
      assert.deepEqual([section.all('span', 'tag').length, section.all('div', 'prop').length], [0, 0]);
      assert.deepEqual(shownTexts(section, 'p'), [CHANGE_WORDS.proposalsNote, CHANGE_WORDS.allAnswered]);
      // Nothing waits: "이 그림" shows the confirmation's state instead (TASK-461), here never confirmed.
      const diagram = sectionOf(none, CHANGE_WORDS.diagram);
      assert.equal(diagram.hidden, false);
      assert.deepEqual(diagram.all('span', 'tag').map((tag) => tag.textContent), ['확정 전']);
    } finally {
      none.close();
    }
  });

  test('수락 asks once, "수락할까요?" with 수락 and 취소; 취소 and Escape stop; 수락 sends API-270 with every button off until the diagram is read again', async () => {
    const answer = held(json(200, { change_set: { ...PROPOSED, state: 'accepted', decided_at: TIME }, changed: true, pull_request: null }));
    const page = await openStage('erd', { diagram: diagramOf('erd', { overlays: [PROPOSED] }), posted: () => answer.answer });
    try {
      const id = `p-${PROPOSED.id}`;
      byId(page, `${id}-accept`).click();
      const group = byId(page, `${id}-ask`).parentNode;
      assert.deepEqual([byId(page, `${id}-ask`).textContent, buttonsIn(group)], [CHANGE_WORDS.askAccept, [CHANGE_WORDS.accept, CHANGE_WORDS.stop]]);
      focused(page, byId(page, `${id}-stop`));
      byId(page, `${id}-stop`).click();
      assert.ok(byId(page, `${id}-ask`) === null);
      focused(page, byId(page, `${id}-accept`));
      byId(page, `${id}-accept`).click();
      byId(page, `${id}-ask`).parentNode.dispatch('keydown', { key: 'Escape' });
      assert.ok(byId(page, `${id}-ask`) === null);
      assert.deepEqual(page.sent, []);
      byId(page, `${id}-accept`).click();
      press(byId(page, `${id}-yes`));
      await waitFor(() => page.sent.length === 1);
      assert.deepEqual([page.sent[0].path, page.sent[0].body], [changeSetPath(PROPOSED.id, 'accept'), {}]);
      assert.match(page.sent[0].key, /^"nw_[0-9a-hjkmnp-tv-z]{12}"$/);
      // While it runs, every button of the changes is off, and the one pressed keeps the focus.
      assert.equal(byId(page, `${id}-yes`).getAttribute('aria-disabled'), 'true');
      focused(page, byId(page, `${id}-yes`));
      const reads = page.diagramReads();
      page.reads[diagramPath('erd')] = json(200, diagramOf('erd', { overlays: [{ ...PROPOSED, state: 'accepted', decided_at: TIME }] }));
      answer.release();
      await page.settle();
      assert.equal(page.diagramReads(), reads + 1);
      const card = sectionOf(page, CHANGE_WORDS.proposals).all('div', 'prop')[0];
      assert.deepEqual([card.all('p', 'sec')[0].textContent, card.all('span', 'tag')[0].textContent, buttonsIn(card)], [CHANGE_WORDS.accepted, MARK_WORDS.wait, []]);
      focused(page, byId(page, 'proposals-heading'));
      assert.equal(page.sent.length, 1);
    } finally {
      page.close();
    }
  });

  test('거절 asks "거절할까요?" and sends API-271; once the diagram is read again the overlay is gone', async () => {
    const page = await openStage('erd', {
      diagram: diagramOf('erd', { overlays: [PROPOSED] }),
      posted: () => json(200, { change_set: { ...PROPOSED, state: 'rejected', decided_at: TIME }, changed: true, pull_request: null }),
    });
    try {
      const id = `p-${PROPOSED.id}`;
      assert.ok(buttonNamed(page, 'agent_keys').className.split(' ').includes('ov-prop'));
      byId(page, `${id}-reject`).click();
      assert.deepEqual([byId(page, `${id}-ask`).textContent, buttonsIn(byId(page, `${id}-ask`).parentNode)], [CHANGE_WORDS.askReject, [CHANGE_WORDS.reject, CHANGE_WORDS.stop]]);
      page.reads[diagramPath('erd')] = json(200, diagramOf('erd'));
      byId(page, `${id}-yes`).click();
      await page.settle();
      assert.deepEqual(page.sent.map((each) => [each.path, each.body]), [[changeSetPath(PROPOSED.id, 'reject'), {}]]);
      assert.ok(buttonNamed(page, 'agent_keys') === undefined);
      assert.equal(buttonNamed(page, A.name).className.split(' ').includes('ov-prop'), false);
      assert.deepEqual(shownTexts(sectionOf(page, CHANGE_WORDS.proposals), 'p', 'sec'), [CHANGE_WORDS.allAnswered]);
    } finally {
      page.close();
    }
  });

  test('SCR-145#waiting on a PC: the elements marked, and "이 그림" with its count, why confirming waits, the list with 편집 취소 and the confirm button off', async () => {
    const page = await openStage('erd', { diagram: diagramOf('erd', { overlays: [CONNECTED, RENAMED, ACCEPTED, PROPOSED] }) });
    try {
      const renamed = buttonNamed(page, 'project_rooms');
      assert.ok(renamed.className.split(' ').includes('waiting'));
      assert.deepEqual([renamed.all('s', 'was')[0].textContent, renamed.all('span', 'mk').map((mark) => mark.textContent)], [B.name, [MARK_WORDS.wait]]);
      const section = sectionOf(page, CHANGE_WORDS.diagram);
      assert.equal(section.hidden, false);
      assert.deepEqual([shownTexts(section, 'h2'), section.all('span', 'tag').map((tag) => tag.textContent)], [[CHANGE_WORDS.diagram], [waitingCount(3)]]);
      assert.equal(waitingCount(3), '반영 대기 3');
      assert.deepEqual(shownTexts(section, 'p'), [CHANGE_WORDS.waitingWhy]);
      assert.deepEqual(rowsOf(section.all('ul', 'chg')[0]), [
        // The ends by the names they show on top, as the picture does: C's accepted rename included.
        ['project_rooms → snapshot_rows', CHANGE_WORDS.connect, [CHANGE_WORDS.cancelEdit]],
        ['project_rooms', renamedFrom(B.name), [CHANGE_WORDS.cancelEdit]],
        [ACCEPTED.change, CHANGE_WORDS.acceptedProposal, []],
      ]);
      assert.equal(renamedFrom(B.name), `이름 바꾸기 · ${B.name}에서`);
      const confirm = section.all('button').at(-1);
      assert.deepEqual([confirm.textContent, confirm.getAttribute('disabled')], [CHANGE_WORDS.confirm, '']);
      // Each 편집 취소 is named with its row.
      const cancel = byId(page, `w-${RENAMED.id}-cancel`);
      assert.equal(cancel.getAttribute('aria-labelledby'), `w-${RENAMED.id}-cancel w-${RENAMED.id}-title`);
    } finally {
      page.close();
    }
  });

  test('편집 취소 sends API-273, and the diagram read again shows the element as before with the focus on it (SPEC-023)', async () => {
    const page = await openStage('erd', {
      diagram: diagramOf('erd', { overlays: [RENAMED] }),
      posted: () => json(200, { change_set: { ...RENAMED, state: 'cancelled' }, changed: true, pull_request: null }),
    });
    try {
      page.reads[diagramPath('erd')] = json(200, diagramOf('erd'));
      byId(page, `w-${RENAMED.id}-cancel`).click();
      await page.settle();
      assert.deepEqual(page.sent.map((each) => [each.path, each.body]), [[changeSetPath(RENAMED.id, 'cancel'), {}]]);
      const table = buttonNamed(page, B.name);
      assert.equal(table.className.split(' ').includes('waiting'), false);
      // "이 그림" lists nothing that waits any more (TASK-461 shows its confirmation there).
      assert.deepEqual(sectionOf(page, CHANGE_WORDS.diagram).all('span', 'tag').map((tag) => tag.textContent), ['확정 전']);
      focused(page, table);
    } finally {
      page.close();
    }
  });

  test('the Selected panel lists the chosen element\'s changes that wait, newest on top, and its name field shows the name on top (SPEC-022)', async () => {
    const proposalOnB = setOf('np_0000000000a6', 'proposal', 'accepted', [rename(B, 'rooms')], { change: 'Rename to rooms.', decided_at: '2026-11-23T03:00:00.000Z' });
    const page = await openStage('erd', { diagram: diagramOf('erd', { overlays: [proposalOnB, RENAMED] }) });
    try {
      buttonNamed(page, 'rooms').click();
      const panel = selectedOf(page);
      assert.equal(fieldOf(page).value, 'rooms');
      assert.deepEqual(shownTexts(panel, 'h3'), [MARK_WORDS.wait]);
      assert.deepEqual(rowsOf(panel.all('ul', 'chg')[0]), [
        [proposalOnB.change, CHANGE_WORDS.acceptedProposal, []],
        ['project_rooms', renamedFrom(B.name), [CHANGE_WORDS.cancelEdit]],
      ]);
      // The panel's 편집 취소 is another button than the "이 그림" list's, by its own ID.
      assert.ok(byId(page, `s-${RENAMED.id}-cancel`) !== null && byId(page, `w-${RENAMED.id}-cancel`) !== null);
    } finally {
      page.close();
    }
  });

  test('renaming: F2 or a double click focuses the name field with its text selected; Escape or leaving it puts the name back; Enter sends a changed name (API-272)', async () => {
    const made = setOf('np_0000000000a7', 'direct_edit', 'accepted', [rename(B, 'project_rooms')]);
    const page = await openStage('erd', { posted: () => json(201, { change_set: made, created: true }) });
    try {
      buttonNamed(page, A.name).dispatch('keydown', { key: 'F2' });
      const panel = selectedOf(page);
      // The name field, and then the threads' box for a new comment (TASK-459).
      assert.deepEqual([panel.hidden, shownTexts(panel, 'label')], [false, [CHANGE_WORDS.nameLabel, THREAD_WORDS.comment]]);
      focused(page, fieldOf(page));
      assert.deepEqual([fieldOf(page).value, fieldOf(page).selectedAll], [A.name, true]);
      // Enter on the name it has sends nothing.
      fieldOf(page).dispatch('keydown', { key: 'Enter' });
      typeName(page, 'agent_keys').dispatch('keydown', { key: 'Escape' });
      assert.equal(fieldOf(page).value, A.name);
      focused(page, buttonNamed(page, A.name));
      typeName(page, 'agent_keys').dispatch('blur');
      assert.equal(fieldOf(page).value, A.name);
      // A double click: the click chooses B, and the double click focuses its field.
      buttonNamed(page, B.name).click();
      buttonNamed(page, B.name).dispatch('dblclick');
      focused(page, fieldOf(page));
      assert.deepEqual([fieldOf(page).value, fieldOf(page).selectedAll], [B.name, true]);
      assert.deepEqual(page.sent, []);
      page.reads[diagramPath('erd')] = json(200, diagramOf('erd', { overlays: [made] }));
      typeName(page, 'project_rooms').dispatch('keydown', { key: 'Enter' });
      await page.settle();
      assert.deepEqual(page.sent.map((each) => [each.path, each.body]), [
        [editsPath('erd'), { drawing: DRAWING.erd, op: 'rename', element: B.key, name: 'project_rooms' }],
      ]);
      const renamed = buttonNamed(page, 'project_rooms');
      assert.deepEqual(renamed.all('span', 'mk').map((mark) => mark.textContent), [MARK_WORDS.wait]);
      focused(page, renamed);
      assert.equal(fieldOf(page).value, 'project_rooms');
      // A foreign key's name is its columns', not the document's: no field, and F2 does nothing.
      const line = pictureBox(page).all('path', 'pic-hit').find((path) => path.getAttribute('aria-label') === (LINE.name || `${A.name} → ${B.name}`))
        ?? pictureBox(page).all('path', 'pic-hit')[0];
      line.click();
      line.dispatch('keydown', { key: 'F2' });
      assert.ok(fieldOf(page) === null);
    } finally {
      page.close();
    }
  });

  test('a refused name stays typed with its message by the field, also when the field is left; Escape puts the name back', async () => {
    const page = await openStage('erd', { posted: () => problem(400, 'invalid_request') });
    try {
      buttonNamed(page, A.name).dispatch('keydown', { key: 'F2' });
      typeName(page, ' ').dispatch('keydown', { key: 'Enter' });
      await page.settle();
      const field = fieldOf(page);
      assert.deepEqual([field.value, field.className, field.getAttribute('aria-invalid'), field.getAttribute('aria-describedby')], [' ', 'field bad', 'true', 'element-name-err']);
      assert.equal(byId(page, 'element-name-err').textContent, message('invalid_request'));
      focused(page, field);
      field.dispatch('blur');
      assert.equal(fieldOf(page).value, ' ');
      fieldOf(page).dispatch('keydown', { key: 'Escape' });
      assert.deepEqual([fieldOf(page).value, fieldOf(page).className, byId(page, 'element-name-err') === null], [A.name, 'field', true]);
      // Enter on the name shown, once refused, sends nothing and takes the message away; the field keeps the focus.
      buttonNamed(page, A.name).dispatch('keydown', { key: 'F2' });
      typeName(page, ' ').dispatch('keydown', { key: 'Enter' });
      await page.settle();
      assert.equal(fieldOf(page).className, 'field bad');
      typeName(page, A.name).dispatch('keydown', { key: 'Enter' });
      assert.deepEqual([fieldOf(page).className, fieldOf(page).getAttribute('aria-invalid'), byId(page, 'element-name-err') === null], ['field', null, true]);
      focused(page, fieldOf(page));
      assert.equal(page.sent.length, 2);
    } finally {
      page.close();
    }
  });

  test('a name refused once another element is chosen stays with its own element, and the focus stays where it is', async () => {
    const answer = held(problem(400, 'invalid_request'));
    const page = await openStage('erd', { posted: () => answer.answer });
    try {
      buttonNamed(page, A.name).dispatch('keydown', { key: 'F2' });
      typeName(page, ' ').dispatch('keydown', { key: 'Enter' });
      press(buttonNamed(page, B.name));
      answer.release();
      await page.settle();
      assert.deepEqual([fieldOf(page).value, fieldOf(page).className], [B.name, 'field']);
      focused(page, buttonNamed(page, B.name));
      buttonNamed(page, A.name).click();
      assert.deepEqual([fieldOf(page).value, fieldOf(page).className, byId(page, 'element-name-err').textContent], [' ', 'field bad', message('invalid_request')]);
    } finally {
      page.close();
    }
  });

  test('a read again that draws the workbench anew gives the focus back to the name field, with the name typed', async () => {
    const page = await openStage('erd');
    try {
      buttonNamed(page, A.name).dispatch('keydown', { key: 'F2' });
      typeName(page, 'agent_k');
      page.reads[diagramPath('erd')] = json(200, diagramOf('erd', { overlays: [PROPOSED] }));
      page.document.dispatch('visibilitychange');
      await page.settle();
      assert.ok(sectionOf(page, CHANGE_WORDS.proposals).all('div', 'prop').length > 0);
      focused(page, fieldOf(page));
      assert.equal(fieldOf(page).value, 'agent_k');
    } finally {
      page.close();
    }
  });

  test('a rename on a drawing that failed names the last good drawing, which the diagram shows (SPEC-001)', async () => {
    const failed = { id: 'dw_0000000000f1', revision: 4, version: 'b'.repeat(40), status: 'failed', failed_at: 'db/nexus.sql:12', drawn_at: TIME };
    const last = { id: DRAWING.erd, revision: 3, version: 'a'.repeat(40), status: 'drawn', failed_at: null, drawn_at: TIME };
    const page = await openStage('erd', {
      diagram: diagramOf('erd', { drawing: failed, last_drawn: last }),
      posted: () => json(200, { change_set: null, created: false }),
    });
    try {
      buttonNamed(page, A.name).dispatch('keydown', { key: 'F2' });
      typeName(page, 'agent_keys').dispatch('keydown', { key: 'Enter' });
      await page.settle();
      assert.equal(page.sent[0].body.drawing, last.id);
    } finally {
      page.close();
    }
  });

  test('connecting: 잇기 asks for the other end; itself or a line does nothing; 취소 and Escape stop; a connection that exists says so', async () => {
    let answer = json(200, { change_set: null, created: false });
    const page = await openStage('erd', { posted: () => answer });
    try {
      buttonNamed(page, A.name).click();
      const connectButton = () => byId(page, 'connect');
      assert.deepEqual([connectButton().textContent, connectButton().getAttribute('aria-pressed')], [CHANGE_WORDS.connect, 'false']);
      connectButton().click();
      assert.deepEqual([shownTexts(lineOf(page), 'b'), buttonsIn(lineOf(page))], [[CHANGE_WORDS.pick], [CHANGE_WORDS.stop]]);
      assert.equal(connectButton().getAttribute('aria-pressed'), 'true');
      buttonNamed(page, A.name).click();
      pictureBox(page).all('path', 'pic-hit')[0].click();
      assert.deepEqual([page.sent, shownTexts(lineOf(page), 'b')], [[], [CHANGE_WORDS.pick]]);
      assert.equal(buttonNamed(page, A.name).getAttribute('aria-pressed'), 'true');
      buttonNamed(page, B.name).dispatch('keydown', { key: 'Escape' });
      assert.equal(lineOf(page).children.length, 0);
      // That Escape was 잇기's: it does not also choose nothing again (TASK-459), so A stays chosen with its 잇기.
      assert.equal(buttonNamed(page, A.name).getAttribute('aria-pressed'), 'true');
      assert.ok(connectButton() !== null);
      // 그림 전체 스레드 stops 잇기 too, so the element chosen next, as a thread's element would be, is not the other end.
      connectButton().click();
      press(selectedOf(page).all('button').find((button) => button.textContent === THREAD_WORDS.wholeThreads));
      assert.deepEqual([lineOf(page).children.length, connectButton()], [0, null]);
      buttonNamed(page, B.name).click();
      assert.deepEqual([page.sent, buttonNamed(page, B.name).getAttribute('aria-pressed')], [[], 'true']);
      buttonNamed(page, A.name).click();
      connectButton().click();
      press(byId(page, 'pick-stop'));
      assert.equal(lineOf(page).children.length, 0);
      focused(page, connectButton());
      connectButton().click();
      buttonNamed(page, B.name).click();
      await page.settle();
      assert.deepEqual(page.sent.map((each) => [each.path, each.body]), [[editsPath('erd'), { drawing: DRAWING.erd, op: 'connect', element: A.key, target: B.key }]]);
      assert.deepEqual(shownTexts(lineOf(page), 'b'), [CHANGE_WORDS.connected]);
      // The choice of the other end does not change the element chosen.
      assert.equal(buttonNamed(page, A.name).getAttribute('aria-pressed'), 'true');
      const made = setOf('np_0000000000a8', 'direct_edit', 'accepted', [connect(A, C)]);
      answer = json(201, { change_set: made, created: true });
      page.reads[diagramPath('erd')] = json(200, diagramOf('erd', { overlays: [made] }));
      connectButton().click();
      buttonNamed(page, C.name).click();
      await page.settle();
      assert.deepEqual(page.sent[1].body, { drawing: DRAWING.erd, op: 'connect', element: A.key, target: C.key });
      assert.deepEqual(rowsOf(sectionOf(page, CHANGE_WORDS.diagram).all('ul', 'chg')[0]), [[`${A.name} → ${C.name}`, CHANGE_WORDS.connect, [CHANGE_WORDS.cancelEdit]]]);
      assert.equal(lineOf(page).children.length, 0);
      // The connection lies on both its ends: the element it goes to lists it too (SPEC-022).
      buttonNamed(page, C.name).click();
      assert.deepEqual(rowsOf(selectedOf(page).all('ul', 'chg')[0]), [[`${A.name} → ${C.name}`, CHANGE_WORDS.connect, [CHANGE_WORDS.cancelEdit]]]);
      // A connection the server refuses as it is (400) shows its message, with no 다시 시도 that would send it again.
      answer = problem(400, 'invalid_request');
      connectButton().click();
      buttonNamed(page, B.name).click();
      await page.settle();
      assert.deepEqual(page.sent[2].body, { drawing: DRAWING.erd, op: 'connect', element: C.key, target: B.key });
      assert.deepEqual([shownTexts(lineOf(page), 'b'), buttonsIn(lineOf(page))], [[message('invalid_request')], []]);
    } finally {
      page.close();
    }
  });

  test('a lost connection keeps the request key for 다시 시도; a decided change shows the stale bar with "새 제안을 부탁하세요." and 새로 고침', async () => {
    let calls = 0;
    const page = await openStage('erd', {
      diagram: diagramOf('erd', { overlays: [PROPOSED] }),
      posted: () => {
        calls += 1;
        if (calls === 1) return () => new TypeError('Failed to fetch');
        return problem(409, 'change_set_state');
      },
    });
    try {
      const id = `p-${PROPOSED.id}`;
      byId(page, `${id}-accept`).click();
      byId(page, `${id}-yes`).click();
      await page.settle();
      // A lost connection has no code: the message of any failure.
      assert.deepEqual([shownTexts(lineOf(page), 'b'), buttonsIn(lineOf(page))], [[message('internal')], ['다시 시도']]);
      lineOf(page).all('button')[0].click();
      await page.settle();
      assert.equal(page.sent[1].key, page.sent[0].key);
      assert.deepEqual(shownTexts(lineOf(page), 'b'), [message('change_set_state')]);
      assert.equal(message('change_set_state'), '이미 결정된 변경이에요.');
      assert.deepEqual([shownTexts(lineOf(page), 'span'), buttonsIn(lineOf(page))], [[CHANGE_WORDS.askNew], ['새로 고침']]);
      const reads = page.diagramReads();
      lineOf(page).all('button')[0].click();
      await page.settle();
      assert.deepEqual([page.diagramReads(), lineOf(page).children.length], [reads + 1, 0]);
    } finally {
      page.close();
    }
  });

  test('a removed diagram: its proposals show 거절 only, "이 그림" lists its waiting direct edits with 편집 취소 in the button\'s place, and nothing renames or connects (SPEC-027)', async () => {
    const proposal = { ...PROPOSED, diagram: ID.oldErd, drawing: DRAWING.oldErd };
    const edit = { ...RENAMED, diagram: ID.oldErd, drawing: DRAWING.oldErd };
    const page = await openStage('oldErd', { diagram: diagramOf('oldErd', { overlays: [edit, proposal] }) });
    try {
      const cards = sectionOf(page, CHANGE_WORDS.proposals).all('div', 'prop');
      assert.deepEqual(cards.map(buttonsIn), [[CHANGE_WORDS.reject]]);
      const section = sectionOf(page, CHANGE_WORDS.diagram);
      assert.deepEqual([section.all('span', 'tag').map((tag) => tag.textContent), shownTexts(section, 'p')], [[waitingCount(1)], []]);
      assert.deepEqual(rowsOf(section.all('ul', 'chg')[0]), [['project_rooms', renamedFrom(B.name), [CHANGE_WORDS.cancelEdit]]]);
      assert.deepEqual(buttonsIn(section), [CHANGE_WORDS.cancelEdit]);
      buttonNamed(page, 'project_rooms').click();
      buttonNamed(page, 'project_rooms').dispatch('keydown', { key: 'F2' });
      assert.ok(fieldOf(page) === null && byId(page, 'connect') === null);
      assert.deepEqual(shownTexts(selectedOf(page), 'b').slice(0, 1), ['project_rooms']);
    } finally {
      page.close();
    }
  });

  test('a phone can answer proposals while direct editing and confirmation during waiting remain unavailable', async () => {
    const page = await openStage('erd', { phone: true, diagram: diagramOf('erd', { overlays: [RENAMED, ACCEPTED, PROPOSED] }) });
    try {
      assert.ok(buttonNamed(page, 'agent_keys').className.split(' ').includes('ov-prop'));
      assert.ok(buttonNamed(page, 'project_rooms').className.split(' ').includes('waiting'));
      assert.equal(sectionOf(page, CHANGE_WORDS.proposals).hidden, false);
      const id = `p-${PROPOSED.id}`;
      byId(page, `${id}-accept`).click();
      assert.equal(byId(page, `${id}-ask`).textContent, CHANGE_WORDS.askAccept);
      assert.deepEqual(page.sent, []);
      byId(page, `${id}-stop`).click();
      byId(page, `${id}-reject`).click();
      assert.equal(byId(page, `${id}-ask`).textContent, CHANGE_WORDS.askReject);
      assert.deepEqual(page.sent, []);
      byId(page, `${id}-stop`).click();
      const section = sectionOf(page, CHANGE_WORDS.diagram);
      assert.deepEqual([section.hidden, shownTexts(section, 'p'), buttonsIn(section)], [false, [CHANGE_WORDS.waitingWhy], []]);
      assert.deepEqual(rowsOf(section.all('ul', 'chg')[0]).map(([title]) => title), ['project_rooms', ACCEPTED.change]);
      buttonNamed(page, 'project_rooms').click();
      buttonNamed(page, 'project_rooms').dispatch('keydown', { key: 'F2' });
      buttonNamed(page, 'project_rooms').dispatch('dblclick');
      assert.ok(fieldOf(page) === null && byId(page, 'connect') === null);
      // No change's button: only the copy and the threads', which a phone keeps (TASK-459).
      assert.deepEqual(buttonsIn(selectedOf(page)), [WORKBENCH_WORDS.copy, THREAD_WORDS.wholeThreads, THREAD_WORDS.send]);
      assert.ok(texts(page, 'span').includes(WORKBENCH_WORDS.phone));
      assert.deepEqual(page.sent, []);
    } finally {
      page.close();
    }
  });

  for (const verb of ['accept', 'reject']) {
    test(`a phone sends proposal ${verb} only after the second question`, async () => {
      const page = await openStage('erd', { phone: true, diagram: diagramOf('erd', { overlays: [PROPOSED] }) });
      try {
        const id = `p-${PROPOSED.id}`;
        byId(page, `${id}-${verb}`).click();
        assert.equal(page.sent.length, 0);
        byId(page, `${id}-yes`).click();
        await page.settle();
        assert.equal(page.sent.length, 1);
        assert.equal(page.sent[0].path, `/api/projects/${P}/change-sets/${PROPOSED.id}/${verb}`);
      } finally { page.close(); }
    });
  }

  test('under stage 01\'s title a PC shows the mockup\'s text, F2 renaming included, and a phone its own', async () => {
    const pcText = 'Git 문서에서 그린 그림이에요. 끌거나 화살표 키로 옮기고 F2로 이름을 바꿔요. 100% 이상에서는 두 번 눌러 이름을 바꿀 수도 있어요.';
    assert.equal(descriptionOf(diagramOf('board'), false), pcText);
    assert.equal(descriptionOf(diagramOf('board'), true), 'Git 문서에서 그린 그림이에요. 눌러서 댓글을 읽고 남겨요.');
    const page = await openStage('board');
    try {
      assert.ok(texts(page, 'p').includes(pcText));
      // On a board, the contexts and the external systems connect; a sticky does not.
      const sticky = pictureBox(page).all('button', 'stk')[0];
      sticky.click();
      assert.ok(byId(page, 'connect') === null);
      pictureBox(page).all('button', 'ctx-head')[0].click();
      assert.ok(byId(page, 'connect') !== null);
    } finally {
      page.close();
    }
  });
});

describe('SCR-145 changes against the server', () => {
  const responses = responseRecord();
  const realFetch = globalThis.fetch;
  const ACTIONS = Object.freeze({ accept: 'acceptProposal', reject: 'rejectProposal', cancel: 'cancelDirectEdit', 'direct-edits': 'makeDirectEdit' });
  const MiB = 1024 * 1024;
  let folder;
  let db;
  let local;
  let good;
  let broken;
  let s;
  let failing = false;
  // The project the page shows, and one whose answers the tests take; each with its ERD: { space, erd, ids }.
  let shown;
  let other;
  const owner = () => ({ 'Cf-Access-Jwt-Assertion': local.token() });
  const someone = () => ({ 'Cf-Access-Jwt-Assertion': local.token({ email: 'someone@example.com' }) });
  const headersOf = (who) => ({ owner: owner(), someone: someone(), agent: s.agent.headers, nobody: {} })[who];
  const TABLE_ROWS = [A, B, C].map((table) => ({ key: table.key, trace_id: table.trace_id, kind: table.kind, name: table.name, detail: table.detail }));

  // A project of its own with a drawn ERD of part nexus that holds A, B and C.
  const fresh = (name) => {
    const space = s.project(name, { parts: ['nexus'] });
    const erd = s.diagram(space, { sourceKey: '/pictures/05-erd/nexus' });
    s.elements(erd.drawing, TABLE_ROWS);
    return { space, erd, diagram: idOf('dg', erd.id), drawing: idOf('dw', erd.drawing) };
  };
  // An agent's proposal by API-256 on A, by its trace ID and without the proposed document, so that it names no other
  // table: its ID.
  const propose = async (where) => {
    const answer = await good.send({
      method: 'POST',
      path: `/api/spaces/${where.space.name}/proposals`,
      headers: { ...s.agent.headers, 'Content-Type': 'application/json', 'Nexus-Session': 'claude-code-4f2a91', 'Idempotency-Key': `"${newId('nw')}"` },
      body: JSON.stringify({ part: 'nexus', stage: '05-erd', items: [A.trace_id], reason: 'The owner asked.', change: 'Rename agent_credentials to agent_keys.' }),
    });
    assert.equal(answer.status, 201, answer.text);
    return answer.json.id;
  };
  const keyHeader = () => ({ 'Idempotency-Key': `"${newId('nw')}"` });
  const JSON_TYPE = { 'Content-Type': 'application/json' };
  // A POST as the owner, with a new request key, unless fields say otherwise.
  const post = (path, fields = {}) => ({ method: 'POST', path, headers: { ...JSON_TYPE, ...owner(), ...keyHeader() }, body: '{}', ...fields });
  const answerPath = (where, id, verb) => `/api/projects/${where.space.name}/change-sets/${id}/${verb}`;
  const editPath = (where) => `/api/projects/${where.space.name}/diagrams/${where.diagram}/direct-edits`;
  // A name no other edit of the tests gave.
  let names = 0;
  const newName = (base) => {
    names += 1;
    return `${base}_${names}`;
  };
  const directEdit = async (where, edit) => {
    const answer = await good.send(post(editPath(where), { body: JSON.stringify({ drawing: where.drawing, ...edit }) }));
    assert.equal(answer.status, 201, answer.text);
    return answer.json.change_set.id;
  };

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-changes-'));
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
    shown = fresh('changes-page');
    other = fresh('changes-answers');
    shown.proposals = { replay: await propose(shown), accept: await propose(shown), reject: await propose(shown) };
    shown.edits = {
      replay: await directEdit(shown, { op: 'rename', element: B.key, name: 'project_rooms' }),
      cancel: await directEdit(shown, { op: 'rename', element: C.key, name: 'snapshot_rows' }),
    };
  });

  after(async () => {
    await good.close();
    await broken.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  const stagePath = () => `/p/${shown.space.name}/nexus/05-erd`;
  const diagramRead = () => `/api/projects/${shown.space.name}/diagrams/${shown.diagram}`;
  const replayOf = (answer) => () => new Response(answer.text, { status: answer.status, headers: { 'content-type': answer.headers['content-type'] } });
  const casesOf = (action, cases) => listedResponses(action).map((listed) => {
    const found = cases.filter((each) => (listed.status === 'default' ? each.status === 500 : String(each.status) === listed.status)
      && (listed.codes.length === 0 || listed.codes.includes(each.code)));
    assert.equal(found.length, Math.max(1, listed.codes.length), `${action} ${listed.status}`);
    return found;
  }).flat();

  // The page of the shown project as who; a request in replay ("POST /api/...") gets that answer instead. Each change
  // the page sends to the server is noted, and page.asked lists every request as "METHOD path".
  async function openOn({ who = 'owner', replay = {}, session = {}, path = stagePath(), search = '' } = {}) {
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
      responses.note(ACTIONS[read.split('/').at(-1)], { status: response.status, headers: Object.fromEntries(response.headers), text, json: JSON.parse(text) });
      return new Response(text, { status: response.status, headers: response.headers });
    };
    const page = await openPage(path, { answers, session, search });
    page.asked = asked;
    return page;
  }

  // What the page shows for each kind of answer (SCR-145).
  const permissionShows = (code, buttons = []) => (page) => assert.deepEqual([texts(page, 'h1'), texts(page, 'button')], [[message(code)], buttons]);
  const gateShows = (page) => assert.deepEqual([page.location.reloads, page.session.getItem(GATE_KEY) !== null], [1, true]);
  const inLine = (code, buttons = ['다시 시도'], spans = []) => (page) => assert.deepEqual(
    [shownTexts(lineOf(page), 'b'), buttonsIn(lineOf(page)), shownTexts(lineOf(page), 'span').filter((span) => !span.startsWith('traceId'))],
    [[message(code)], buttons, spans],
  );
  // A request the server refuses as it is (400, 413): its message, with no 다시 시도 that would send it again.
  const refused = (code) => inLine(code, []);
  const stale = (code, spans = []) => inLine(code, ['새로 고침'], spans);
  const gone = (code) => inLine(code, ['새로 고침']);
  const byField = (code) => (page) => {
    assert.deepEqual([byId(page, 'element-name-err')?.textContent, fieldOf(page).className, fieldOf(page).value], [message(code), 'field bad', 'agent_keys']);
    assert.equal(lineOf(page).children.length, 0);
  };
  // A 404 for the project or the diagram after a write: the page reads the diagram again first (SCR-145#error), which
  // the server answers as before, so the diagram shows again with nothing in the line.
  const readAgain = (page) => {
    const sent = page.asked.findIndex((each) => each.startsWith('POST '));
    assert.ok(sent !== -1 && page.asked.indexOf(`GET ${diagramRead()}`, sent) > sent, page.asked.join(', '));
    assert.equal(lineOf(page).children.length, 0);
    assert.ok(buttonNamed(page, A.name) !== undefined);
  };

  // The page's own answers: A proposal accepted and one rejected (200), a direct edit cancelled (200), a rename made
  // (201) and a connection made and then made again (201, 200).
  test('the page accepts, rejects, cancels, renames and connects against the server (API-270, API-271, API-273 200; API-272 201 and 200)', async () => {
    const page = await openOn();
    try {
      const click = async (id) => {
        byId(page, id).click();
        await page.settle();
      };
      await click(`p-${shown.proposals.accept}-accept`);
      await click(`p-${shown.proposals.accept}-yes`);
      const accepted = sectionOf(page, CHANGE_WORDS.proposals).all('div', 'prop').find((card) => card.all('span', 'tag').length > 0);
      assert.deepEqual(accepted.all('p', 'sec').map((p) => p.textContent), [CHANGE_WORDS.accepted]);
      await click(`p-${shown.proposals.reject}-reject`);
      await click(`p-${shown.proposals.reject}-yes`);
      assert.ok(byId(page, `p-${shown.proposals.reject}-reject`) === null);
      await click(`w-${shown.edits.cancel}-cancel`);
      assert.ok(byId(page, `w-${shown.edits.cancel}-cancel`) === null);
      assert.equal(buttonNamed(page, C.name).className.split(' ').includes('waiting'), false);
      // C, whose edit was just cancelled, so that A keeps its name for the tests that follow.
      buttonNamed(page, C.name).dispatch('keydown', { key: 'F2' });
      typeName(page, 'snapshot_rows').dispatch('keydown', { key: 'Enter' });
      await page.settle();
      assert.deepEqual(buttonNamed(page, 'snapshot_rows').all('span', 'mk').map((mark) => mark.textContent), [MARK_WORDS.wait]);
      for (const made of ['made', 'exists']) {
        buttonNamed(page, 'snapshot_rows').click();
        await click('connect');
        buttonNamed(page, 'project_rooms').click();
        await page.settle();
        if (made === 'exists') assert.deepEqual(shownTexts(lineOf(page), 'b'), [CHANGE_WORDS.connected]);
      }
      const rows = rowsOf(sectionOf(page, CHANGE_WORDS.diagram).all('ul', 'chg')[0]).map(([title]) => title);
      assert.ok(rows.includes('snapshot_rows → project_rooms'), rows.join(', '));
    } finally {
      page.close();
    }
  });

  test('a removed diagram opens for what waits on it: its proposal is rejected and its direct edit cancelled against the server, and nothing else is offered (SPEC-027, TASK-468)', async () => {
    const removed = fresh('changes-removed');
    const proposal = await propose(removed);
    const edit = await directEdit(removed, { op: 'rename', element: B.key, name: 'project_rooms' });
    s.removeDiagram(removed.erd.id);
    const page = await openOn({ path: `/p/${removed.space.name}/nexus/05-erd`, search: `?d=${removed.diagram}` });
    try {
      assert.deepEqual(sectionOf(page, CHANGE_WORDS.proposals).all('div', 'prop').map(buttonsIn), [[CHANGE_WORDS.reject]]);
      const section = sectionOf(page, CHANGE_WORDS.diagram);
      assert.deepEqual([shownTexts(section, 'p'), buttonsIn(section)], [[], [CHANGE_WORDS.cancelEdit]]);
      buttonNamed(page, 'project_rooms').click();
      buttonNamed(page, 'project_rooms').dispatch('keydown', { key: 'F2' });
      assert.ok(fieldOf(page) === null && byId(page, 'connect') === null);
      byId(page, `p-${proposal}-reject`).click();
      byId(page, `p-${proposal}-yes`).click();
      await page.settle();
      assert.deepEqual(shownTexts(sectionOf(page, CHANGE_WORDS.proposals), 'p', 'sec'), [CHANGE_WORDS.allAnswered]);
      byId(page, `w-${edit}-cancel`).click();
      await page.settle();
      assert.equal(sectionOf(page, CHANGE_WORDS.diagram).hidden, true);
      assert.ok(buttonNamed(page, B.name) !== undefined);
      assert.deepEqual(page.asked.filter((each) => each.startsWith('POST ')), [
        `POST /api/projects/${removed.space.name}/change-sets/${proposal}/reject`,
        `POST /api/projects/${removed.space.name}/change-sets/${edit}/cancel`,
      ]);
    } finally {
      page.close();
    }
  });

  // Runs each case of action: the server's answer, taken by request, is replayed to the page for act, and shows checks
  // what the page shows. A case with page answered in the test before.
  async function everyResponse(action, path, act, cases) {
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
      const page = await openOn({ replay: { [`POST ${path}`]: replayOf(answer) } });
      try {
        await act(page);
        await page.settle();
        each.shows(page, answer);
      } catch (error) {
        error.message = `${action} ${each.status} ${each.code}: ${error.message}`;
        throw error;
      } finally {
        page.close();
      }
    }
    responses.assertEvery(action);
  }

  // The cases every answer to a proposal shares (API-270, API-271), on a proposal of the other project.
  const answerCases = (verb, more) => {
    const path = () => answerPath(other, other.proposal, verb);
    const reused = keyHeader();
    return [
      { status: 200, page: true },
      { status: 400, code: 'invalid_request', request: () => post(path(), { body: '{"x":1}' }), shows: refused('invalid_request') },
      { status: 401, code: 'unauthenticated', request: () => post(path(), { headers: { ...JSON_TYPE, ...keyHeader() } }), shows: gateShows },
      { status: 403, code: 'owner_only', request: () => post(path(), { headers: { ...JSON_TYPE, ...s.agent.headers, ...keyHeader() } }), shows: permissionShows('owner_only') },
      { status: 403, code: 'not_owner', request: () => post(path(), { headers: { ...JSON_TYPE, ...someone(), ...keyHeader() } }), shows: permissionShows('not_owner') },
      { status: 403, code: 'cross_site', request: () => post(path(), { headers: { ...JSON_TYPE, ...owner(), ...keyHeader(), 'Sec-Fetch-Site': 'cross-site' } }), shows: permissionShows('cross_site', ['새로 고침']) },
      { status: 404, code: 'project_not_found', request: () => post(`/api/projects/no-such-project/change-sets/${other.proposal}/${verb}`), shows: readAgain },
      { status: 404, code: 'change_set_not_found', request: () => post(`/api/projects/${other.space.name}/change-sets/np_zzzzzzzzzzzz/${verb}`), shows: gone('change_set_not_found') },
      {
        status: 409, code: 'request_key_reused',
        request: async () => {
          const first = await propose(other);
          await good.send(post(answerPath(other, first, verb), { headers: { ...JSON_TYPE, ...owner(), ...reused } }));
          return post(path(), { headers: { ...JSON_TYPE, ...owner(), ...reused } });
        },
        shows: inLine('request_key_reused'),
      },
      { status: 413, code: 'body_too_large', request: () => post(path(), { body: JSON.stringify({ pad: 'x'.repeat(2 * MiB) }) }), shows: refused('body_too_large') },
      { status: 415, code: 'json_required', request: () => post(path(), { headers: { 'Content-Type': 'text/plain', ...owner(), ...keyHeader() } }), shows: inLine('json_required') },
      { status: 500, code: 'internal', fails: true, request: () => post(path()), shows: inLine('internal') },
      ...more,
    ];
  };
  const answerOn = (verb) => async (page) => {
    byId(page, `p-${shown.proposals.replay}-${verb}`).click();
    byId(page, `p-${shown.proposals.replay}-yes`).click();
  };

  test('every response API-270 lists leads accepting to the state SCR-145 gives', async () => {
    other.proposal = await propose(other);
    // A proposal whose diagram drew again since: the document changed (SPEC-019).
    const moved = fresh('changes-moved');
    const old = await propose(moved);
    s.snapshot(moved.space, { parts: ['nexus'] });
    s.elements(s.drawing(moved.space, moved.erd.id), TABLE_ROWS);
    await everyResponse('acceptProposal', answerPath(shown, shown.proposals.replay, 'accept'), answerOn('accept'), answerCases('accept', [
      {
        status: 409, code: 'change_set_state',
        request: async () => {
          const decided = await propose(other);
          await good.send(post(answerPath(other, decided, 'reject')));
          return post(answerPath(other, decided, 'accept'));
        },
        shows: stale('change_set_state', [CHANGE_WORDS.askNew]),
      },
      { status: 409, code: 'document_changed', request: () => post(answerPath(moved, old, 'accept')), shows: stale('document_changed', [CHANGE_WORDS.askNew]) },
    ]));
  });

  test('every response API-271 lists leads rejecting to the state SCR-145 gives', async () => {
    other.proposal = await propose(other);
    await everyResponse('rejectProposal', answerPath(shown, shown.proposals.replay, 'reject'), answerOn('reject'), answerCases('reject', [
      {
        status: 409, code: 'change_set_state',
        request: async () => {
          const decided = await propose(other);
          await good.send(post(answerPath(other, decided, 'accept')));
          return post(answerPath(other, decided, 'reject'));
        },
        shows: stale('change_set_state'),
      },
    ]));
  });

  test('every response API-272 lists leads renaming to the state SCR-145 gives, a refused name by its field', async () => {
    const body = (fields = {}) => JSON.stringify({ drawing: other.drawing, op: 'rename', element: A.key, name: 'agent_keys', ...fields });
    const path = editPath(other);
    const reused = keyHeader();
    // A diagram that drew again since the drawing the page names.
    const moved = fresh('changes-redrawn');
    s.snapshot(moved.space, { parts: ['nexus'] });
    s.elements(s.drawing(moved.space, moved.erd.id), TABLE_ROWS);
    const act = async (page) => {
      buttonNamed(page, A.name).dispatch('keydown', { key: 'F2' });
      typeName(page, 'agent_keys').dispatch('keydown', { key: 'Enter' });
    };
    await everyResponse('makeDirectEdit', editPath(shown), act, [
      { status: 201, page: true },
      { status: 200, page: true },
      { status: 400, code: 'invalid_request', request: () => post(path, { body: body({ name: ' ' }) }), shows: byField('invalid_request') },
      { status: 400, code: 'text_too_long', request: () => post(path, { body: body({ name: 'x'.repeat(201) }) }), shows: byField('text_too_long') },
      { status: 401, code: 'unauthenticated', request: () => post(path, { headers: { ...JSON_TYPE, ...keyHeader() }, body: body() }), shows: gateShows },
      { status: 403, code: 'owner_only', request: () => post(path, { headers: { ...JSON_TYPE, ...s.agent.headers, ...keyHeader() }, body: body() }), shows: permissionShows('owner_only') },
      { status: 403, code: 'not_owner', request: () => post(path, { headers: { ...JSON_TYPE, ...someone(), ...keyHeader() }, body: body() }), shows: permissionShows('not_owner') },
      { status: 403, code: 'cross_site', request: () => post(path, { headers: { ...JSON_TYPE, ...owner(), ...keyHeader(), 'Sec-Fetch-Site': 'cross-site' }, body: body() }), shows: permissionShows('cross_site', ['새로 고침']) },
      { status: 404, code: 'project_not_found', request: () => post(`/api/projects/no-such-project/diagrams/${other.diagram}/direct-edits`, { body: body() }), shows: readAgain },
      { status: 404, code: 'diagram_not_found', request: () => post(`/api/projects/${other.space.name}/diagrams/dg_zzzzzzzzzzzz/direct-edits`, { body: body() }), shows: readAgain },
      { status: 404, code: 'drawing_not_found', request: () => post(path, { body: body({ drawing: 'dw_zzzzzzzzzzzz' }) }), shows: gone('drawing_not_found') },
      { status: 404, code: 'element_not_found', request: () => post(path, { body: body({ element: 'TBL-999' }) }), shows: gone('element_not_found') },
      {
        status: 409, code: 'request_key_reused',
        request: async () => {
          await good.send(post(path, { headers: { ...JSON_TYPE, ...owner(), ...reused }, body: body({ element: C.key, name: newName('snapshot_rows') }) }));
          return post(path, { headers: { ...JSON_TYPE, ...owner(), ...reused }, body: body() });
        },
        shows: byField('request_key_reused'),
      },
      { status: 409, code: 'document_changed', request: () => post(editPath(moved), { body: body({ drawing: moved.drawing }) }), shows: stale('document_changed') },
      { status: 413, code: 'body_too_large', request: () => post(path, { body: JSON.stringify({ drawing: other.drawing, op: 'rename', element: A.key, name: 'x', pad: 'x'.repeat(2 * MiB) }) }), shows: byField('body_too_large') },
      { status: 415, code: 'json_required', request: () => post(path, { headers: { 'Content-Type': 'text/plain', ...owner(), ...keyHeader() }, body: body() }), shows: inLine('json_required') },
      { status: 500, code: 'internal', fails: true, request: () => post(path, { body: body() }), shows: inLine('internal') },
    ]);
  });

  test('every response API-273 lists leads 편집 취소 to the state SCR-145 gives', async () => {
    const edit = await directEdit(other, { op: 'rename', element: B.key, name: newName('project_rooms') });
    const path = answerPath(other, edit, 'cancel');
    const reused = keyHeader();
    const act = async (page) => byId(page, `w-${shown.edits.replay}-cancel`).click();
    await everyResponse('cancelDirectEdit', answerPath(shown, shown.edits.replay, 'cancel'), act, [
      { status: 200, page: true },
      { status: 400, code: 'invalid_request', request: () => post(path, { body: '{"x":1}' }), shows: refused('invalid_request') },
      { status: 401, code: 'unauthenticated', request: () => post(path, { headers: { ...JSON_TYPE, ...keyHeader() } }), shows: gateShows },
      { status: 403, code: 'owner_only', request: () => post(path, { headers: { ...JSON_TYPE, ...s.agent.headers, ...keyHeader() } }), shows: permissionShows('owner_only') },
      { status: 403, code: 'not_owner', request: () => post(path, { headers: { ...JSON_TYPE, ...someone(), ...keyHeader() } }), shows: permissionShows('not_owner') },
      { status: 403, code: 'cross_site', request: () => post(path, { headers: { ...JSON_TYPE, ...owner(), ...keyHeader(), 'Sec-Fetch-Site': 'cross-site' } }), shows: permissionShows('cross_site', ['새로 고침']) },
      { status: 404, code: 'project_not_found', request: () => post(`/api/projects/no-such-project/change-sets/${edit}/cancel`), shows: readAgain },
      { status: 404, code: 'change_set_not_found', request: () => post(`/api/projects/${other.space.name}/change-sets/np_zzzzzzzzzzzz/cancel`), shows: gone('change_set_not_found') },
      {
        status: 409, code: 'request_key_reused',
        request: async () => {
          const first = await directEdit(other, { op: 'rename', element: C.key, name: newName('snapshot_rows') });
          await good.send(post(answerPath(other, first, 'cancel'), { headers: { ...JSON_TYPE, ...owner(), ...reused } }));
          return post(path, { headers: { ...JSON_TYPE, ...owner(), ...reused } });
        },
        shows: inLine('request_key_reused'),
      },
      // An AI proposal is answered, not cancelled: change_set_state with its state.
      { status: 409, code: 'change_set_state', request: async () => post(answerPath(other, await propose(other), 'cancel')), shows: stale('change_set_state') },
      { status: 413, code: 'body_too_large', request: () => post(path, { body: JSON.stringify({ pad: 'x'.repeat(2 * MiB) }) }), shows: refused('body_too_large') },
      { status: 415, code: 'json_required', request: () => post(path, { headers: { 'Content-Type': 'text/plain', ...owner(), ...keyHeader() } }), shows: inLine('json_required') },
      { status: 500, code: 'internal', fails: true, request: () => post(path), shows: inLine('internal') },
    ]);
  });
});
