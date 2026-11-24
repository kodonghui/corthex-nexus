// SCR-145's workshop (TASK-462; SPEC-036 to SPEC-041, SPEC-051) on test/fake-dom.js: opening a workshop, the board
// with its strip, frames and legend, adding, moving, renaming, removing and linking sticky notes, confirming a step,
// importing a Miro export, the phone's read-only board and the drawn board that stays reachable, against stubbed
// answers; then the screen against the server, with every response API-284 to API-292 list. How the board looks, at
// 360 and 1440 pixels in light and dark, is the browser walk of the pull request.

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createPages } from '../src/pages.js';
import { ROUTES } from '../src/routes.js';
import { openStore } from '../src/store.js';
import { GATE_KEY } from '../web/states.js';
import { contract, validate } from './contract.js';
import { listedResponses, responseRecord } from './responses.js';
import { json, message, openPage, problem, texts } from './screen-page.js';
import { seed } from './seed.js';
import { localGate, startServer } from './support.js';

// The modules that import ./layout.js load once screen-page.js has taught the import where the server serves it from.
const {
  confirmWords, countWords, frameTitle, GRID, importedWords, LONG_STEP, MIRO_BYTES, SEND_AFTER_MS, STEP,
  stepTitle, STEPS, WORKSHOP_WORDS,
} = await import('../web/workshop.js');

const TIME = '2026-11-24T01:00:00.000Z';
const P = 'reading-club';
const WS = 'ws_000000000001';
const BOARD = 'dg_0000000000b1';
const STAGE_IDS = ['01-domain', '02-prd', '03-user-flow', '04-functional-spec', '05-erd', '06-api', '07-sitemap', '08-screen-states', '09-mockup', '10-wbs', '11-development', '12-qa', '13-presentation'];
const HEADER = {
  '/api/projects': json(200, { projects: [], backup: null }),
  '/api/todo': json(200, { entries: [], backup: null }),
};
const PROJECT_PATH = `/api/projects/${P}`;
const WORKSHOP_PATH = `${PROJECT_PATH}/workshop`;
const DIAGRAM_PATH = `${PROJECT_PATH}/diagrams/${BOARD}`;
const STAGE_PATH = `/p/${P}/_/01-domain`;

// A sticky note as API-285 lists it; id is its number.
const noteOf = (id, step, kind, text, x, y, fields = {}) => ({
  id: `sn_${String(id).padStart(12, '0')}`, step, kind, text, x, y, made_by: 'owner', confidence: null, from_miro: false, created_at: TIME, ...fields,
});
const linkOf = (id, from, to) => ({ id: `sl_${String(id).padStart(12, '0')}`, from: from.id, to: to.id, made_by: 'owner' });
// The mockup's step 3: four events and three commands, drafted by the agent, one renamed by the owner.
const NOTES = Object.freeze({
  e1: noteOf(1, '3', 'event', '모임이 만들어짐', 0, 120, { made_by: 'agent', confidence: 'certain' }),
  e2: noteOf(2, '3', 'event', '참가가 확정됨', 160, 120, { made_by: 'agent', confidence: 'certain' }),
  e3: noteOf(3, '3', 'event', '대기자 명단에 올라감', 320, 120, { made_by: 'agent', confidence: 'inferred' }),
  e4: noteOf(4, '3', 'event', '알림이 보내짐', 480, 120, { made_by: 'agent', confidence: 'certain' }),
  c1: noteOf(5, '3', 'command', '모임 만들기', 0, 0, { made_by: 'agent', confidence: 'certain' }),
  c2: noteOf(6, '3', 'command', '참가 신청하기', 160, 0),
  c3: noteOf(7, '3', 'command', '알림 보내기', 480, 0, { made_by: 'agent', confidence: 'guess' }),
});

// API-285's Workshop: notes by step, links and the confirmed steps.
function workshopOf({ notes = Object.values(NOTES), links = [], confirmed = [], state = 'open' } = {}) {
  const body = {
    id: WS, state, opened_at: TIME, closed_at: state === 'open' ? null : TIME,
    steps: STEPS.map((step) => ({
      step, confirmed_at: confirmed.includes(step) ? TIME : null, written_at: null, checkpoint: ['1-b', '7', '9'].includes(step),
      notes: notes.filter((note) => note.step === step).map((note) => ({ ...note })),
    })),
    links: links.map((link) => ({ ...link })),
  };
  assert.deepEqual(validate(contract, body, { $ref: '#/components/schemas/Workshop' }), []);
  return body;
}

// API-264's Project: stage 01 with the drawn DDD board, and the workshop as given.
function projectOf({ workshop = { id: WS, state: 'open' }, diagrams = true } = {}) {
  return {
    name: P, title: '독서 모임 앱', repository: 'https://github.com/example/demo', revision: 3, commit: 'a'.repeat(40), pushed_at: TIME, parts: [],
    stages: STAGE_IDS.map((stage) => ({
      stage, part: '', state: stage === '01-domain' && diagrams ? 'open' : 'not_sent', passed_at: null,
      diagrams: stage === '01-domain' && diagrams
        ? [{ id: BOARD, kind: 'ddd_board', name: 'DDD board', removed: false, drawn: true, confirmation: 'none', waiting: 0, open_threads: 0 }]
        : [],
    })),
    tool_links: [],
    workshop,
  };
}

const stored = (name) => JSON.parse(readFileSync(new URL(`./${name}`, import.meta.url), 'utf8'));
const BOARD_ELEMENTS = stored('ddd-board-expected.json').elements.map((element) => ({
  key: element.key, trace_id: element.trace_id ?? null, kind: element.kind, name: element.name ?? '', parent: element.parent ?? null,
  status: element.status ?? null, detail: element.detail ?? {}, position: null,
}));
const DIAGRAM = {
  id: BOARD, project: P, part: '', stage: '01-domain', kind: 'ddd_board', name: 'DDD board', removed: false,
  drawing: { id: 'dw_0000000000b1', revision: 3, version: 'a'.repeat(40), status: 'drawn', failed_at: null, drawn_at: TIME },
  last_drawn: null, elements: BOARD_ELEMENTS, overlays: [], since_confirmation: null, confirmation: null, threads: [],
};

// Opens stage 01 with world's answers: { project, workshop } as API-264 and API-285 answer them, each read again as it
// is then. A write goes to wrote(request, world), which answers it, and is kept in page.sent as { method, path, body,
// text, key, type }.
async function openBoard({ world = {}, search = '', phone = false, session = {}, wrote = () => json(500, {})() } = {}) {
  const state = { project: projectOf(), workshop: workshopOf(), ...world };
  const sent = [];
  const page = await openPage(STAGE_PATH, {
    search,
    phone,
    session,
    answers: (path, init) => {
      const method = init?.method ?? 'GET';
      if (method !== 'GET') {
        const request = {
          method, path, text: init.body, body: init.body === undefined ? null : JSON.parse(init.body),
          key: init.headers['idempotency-key'], type: init.headers['content-type'] ?? null,
        };
        sent.push(request);
        return wrote(request, state);
      }
      if (path === PROJECT_PATH) return json(200, state.project)();
      if (path === WORKSHOP_PATH) return state.workshop === null ? problem(404, 'workshop_not_found')() : json(200, state.workshop)();
      if (path === DIAGRAM_PATH) return json(200, DIAGRAM)();
      const answer = HEADER[path];
      if (answer === undefined) throw new Error(`no answer for ${path}`);
      return answer();
    },
  });
  page.sent = sent;
  page.world = state;
  return page;
}

const panelOf = (page) => page.app.all('aside')[0];
const boardOf = (page) => page.app.all('div', 'ws-board')[0];
const stripOf = (page) => page.app.all('nav').find((nav) => nav.getAttribute('aria-label') === WORKSHOP_WORDS.strip);
const buttonNamed = (root, text) => root.all('button').find((button) => button.textContent === text);
const noteNamed = (page, text) => boardOf(page).all('button', 'stk').find((button) => button.all('b')[0].textContent === text);
const holderOf = (button) => button.parentNode.parentNode;
const placeOf = (button) => [Number(holderOf(button).getAttribute('x')) + 6, Number(holderOf(button).getAttribute('y')) + 6];
const field = (page, id) => page.app.descendants().find((element) => element.getAttribute('id') === id);
const type = (input, text) => {
  input.value = text;
  input.dispatch('input');
};
const chooseStep = async (page, step) => {
  stripOf(page).all('button').find((button) => button.getAttribute('id') === `ws-step-${step}`).click();
  await page.settle();
};
const waitSend = async (page) => {
  await delay(SEND_AFTER_MS + 80);
  await page.settle();
};
// The panel's sections by their headings.
const sectionNamed = (page, heading) => panelOf(page).all('section').find((section) => section.all('h2')[0]?.textContent === heading);

describe('SCR-145 workshop', () => {
  test('stage 01 with the workshop open shows the board first: title, 열림, strip, two frames, legend and panel', async () => {
    const page = await openBoard();
    try {
      assert.deepEqual(texts(page, 'h1'), [stepTitle('0')]);
      assert.equal(stepTitle('0'), '워크숍 · 스텝 0 준비');
      assert.ok(page.app.all('span', 'tag').some((tag) => tag.textContent === '열림' && tag.className.includes('green')));
      assert.deepEqual(texts(page, 'p', 'sec'), [WORKSHOP_WORDS.source]);
      // The title's buttons, and no diagram read: the workshop is read in its place.
      assert.deepEqual(page.app.all('div', 'title')[0].all('button').map((button) => button.textContent), ['스티커 더하기', 'Miro에서 가져오기']);
      assert.ok(page.calls.includes(WORKSHOP_PATH));
      assert.equal(page.calls.includes(DIAGRAM_PATH), false);
      // The stage's list: 워크숍 shown, the drawn board after it.
      const list = page.app.all('nav').find((nav) => nav.getAttribute('aria-label') === '이 단계의 그림 1개');
      assert.deepEqual(list.all('a').map((link) => [link.textContent, link.getAttribute('aria-current')]), [['워크숍', 'page'], ['DDD board', null]]);
      assert.equal(list.all('a')[1].getAttribute('href'), `${STAGE_PATH}?d=${BOARD}`);
      // The strip: 11 steps in the mockup's words, step 0 chosen.
      assert.deepEqual(stripOf(page).all('button').map((button) => button.textContent),
        ['0 준비', '1-a 이벤트', '1-b 타임라인', '2 외부 시스템', '3 명령', '4 핫스팟', '5 액터', '6 애그리거트', '7 경계 컨텍스트', '8 정책·읽기 모델·컨텍스트 맵', '9 컨텍스트 표']);
      assert.equal(stripOf(page).all('button', 'on')[0].textContent, '0 준비');
      // Step 0's frame and step 1's, both empty.
      assert.deepEqual(boardOf(page).all('div', 'frame-h').map((frame) => frame.textContent), ['스텝 0 · 준비비어 있음', '스텝 1-a · 이벤트비어 있음']);
      assert.deepEqual(texts(page, 'div', 'frame-empty'), [message('step_empty'), message('step_empty')]);
      assert.equal(message('step_empty'), '확정하기 전에 스티커를 붙이세요.');
      assert.deepEqual(page.app.all('div', 'legend')[0].children.map((span) => span.textContent), [
        '이벤트: 일어난 일', '명령: 누군가 하려는 일', '애그리거트: 규칙을 함께 지키는 단위', '정책: "~하면 ~한다" 규칙', '읽기 모델: 판단할 때 보는 정보',
        '핫스팟: 아직 정하지 못한 문제', '확실·추론·추측: AI가 단 근거의 정도',
      ]);
      // The panel: the step with its count, the note on confirming, and its confirm button, off while it is empty.
      const step = sectionNamed(page, frameTitle('0'));
      assert.deepEqual(step.all('p').map((p) => p.textContent), [countWords(0, 0), WORKSHOP_WORDS.confirmNote]);
      assert.equal(buttonNamed(step, confirmWords('0')).getAttribute('aria-disabled'), 'true');
      assert.equal(page.app.all('div', 'nt').some((note) => note.textContent === WORKSHOP_WORDS.phone), false);
    } finally {
      page.close();
    }
  });

  test('step 3 shows the mockup\'s text and notes: kinds, confidence labels, places and the next step\'s frame', async () => {
    const page = await openBoard({ world: { workshop: workshopOf({ confirmed: ['0', '1', '1-b', '2'] }) } });
    try {
      // The first step not confirmed is chosen.
      assert.deepEqual(texts(page, 'h1'), ['워크숍 · 스텝 3 명령']);
      assert.deepEqual(texts(page, 'p', 'sec'), ['이벤트를 일으키는 명령을 왼쪽에 더해요. 워크숍이 열려 있는 동안은 이 보드가 원본이에요.']);
      assert.deepEqual(stripOf(page).all('button', 'done').map((button) => button.textContent), ['0 준비', '1-a 이벤트', '1-b 타임라인', '2 외부 시스템']);
      const notes = boardOf(page).all('button', 'stk');
      assert.equal(notes.length, 7);
      const first = noteNamed(page, '모임이 만들어짐');
      assert.deepEqual([first.className, first.all('span', 'cw')[0].textContent, first.all('span', 'conf')[0].textContent], ['stk k-event', '이벤트', '확실']);
      assert.deepEqual(placeOf(first), [0, 120]);
      assert.deepEqual(noteNamed(page, '알림 보내기').all('span', 'conf')[0].textContent, '추측');
      assert.deepEqual(noteNamed(page, '대기자 명단에 올라감').all('span', 'conf')[0].textContent, '추론');
      // An owner's note has no label.
      assert.deepEqual(noteNamed(page, '참가 신청하기').all('span', 'conf'), []);
      assert.deepEqual(boardOf(page).all('div', 'frame-h').map((frame) => frame.textContent), ['스텝 3 · 명령확정 전', '스텝 4 · 핫스팟비어 있음']);
      assert.ok(boardOf(page).all('div', 'pic-wrap').some((wrap) => wrap.getAttribute('aria-label') === '스텝 3 프레임'));
      // Seven notes, six of them still the agent's drafts.
      assert.deepEqual(sectionNamed(page, '스텝 3 · 명령').all('p')[0].textContent, '스티커 7개 · AI 초안 6개');
      assert.equal(buttonNamed(panelOf(page), '스텝 3 확정').getAttribute('aria-disabled'), null);
      // Choosing another step draws its title and frames.
      await chooseStep(page, '1-b');
      assert.deepEqual(texts(page, 'h1'), ['워크숍 · 스텝 1-b 타임라인']);
      assert.deepEqual(texts(page, 'p', 'sec'), [WORKSHOP_WORDS.source]);
      assert.deepEqual(boardOf(page).all('div', 'frame-h').map((frame) => frame.textContent), ['스텝 1-b · 타임라인확정함', '스텝 2 · 외부 시스템확정함']);
      assert.equal(sectionNamed(page, '스텝 1-b · 타임라인').all('button').length, 0);
      await chooseStep(page, '9');
      assert.deepEqual(boardOf(page).all('div', 'frame-h').map((frame) => frame.textContent), ['스텝 9 · 컨텍스트 표비어 있음']);
    } finally {
      page.close();
    }
  });

  test('every kind shows in its token\'s class with its word; note shows uncoloured as 기타, and an unknown kind as sent', async () => {
    const kinds = ['event', 'command', 'aggregate', 'policy', 'read-model', 'hotspot', 'actor', 'external-system', 'note', 'Bounded context'];
    const notes = kinds.map((kind, index) => noteOf(index + 1, '0', kind, `note ${index}`, (index % 5) * 160, Math.floor(index / 5) * 120));
    const page = await openBoard({ world: { workshop: workshopOf({ notes }) } });
    try {
      const shown = notes.map((note) => {
        const button = noteNamed(page, note.text);
        return [button.className, button.all('span', 'cw')[0].textContent];
      });
      assert.deepEqual(shown, [
        ['stk k-event', '이벤트'], ['stk k-command', '명령'], ['stk k-aggregate', '애그리거트'], ['stk k-policy', '정책'],
        ['stk k-read-model', '읽기 모델'], ['stk k-hotspot', '핫스팟'], ['stk k-actor', '액터'], ['stk k-external-system', '외부 시스템'],
        ['stk k-note', '기타'], ['stk k-note', 'Bounded context'],
      ]);
      // Each kind's class is in nexus.css, coloured by its sticky token; note has none.
      const css = readFileSync(new URL('../web/nexus.css', import.meta.url), 'utf8');
      for (const kind of kinds.slice(0, 8)) assert.match(css, new RegExp(`\\.stk\\.k-${kind}[,{][^}]*var\\(--corthex-sticky-${kind}\\)`), kind);
      assert.doesNotMatch(css, /\.stk\.k-note\{[^}]*--corthex-sticky/);
    } finally {
      page.close();
    }
  });

  test('스티커 더하기: the step\'s kind first, the grid\'s first free place, and the new note chosen', async () => {
    const taken = [noteOf(1, '5', 'actor', 'Owner', 0, 0), noteOf(2, '5', 'actor', 'Agent', 160, 0), noteOf(3, '5', 'actor', 'Moved', 170, 0)];
    let made = 0;
    const page = await openBoard({
      world: { workshop: workshopOf({ notes: taken }) },
      wrote: ({ body }) => {
        made += 1;
        return json(201, noteOf(100 + made, body.step, body.kind, body.text, body.x, body.y))();
      },
    });
    try {
      await chooseStep(page, '5');
      buttonNamed(page.app.all('div', 'title')[0], WORKSHOP_WORDS.add).click();
      await page.settle();
      const form = sectionNamed(page, WORKSHOP_WORDS.add);
      assert.deepEqual(form.all('label').map((label) => label.textContent), ['종류', '이름']);
      const kind = field(page, 'ws-add-kind');
      assert.deepEqual(kind.all('option').map((option) => option.textContent), ['이벤트', '명령', '애그리거트', '정책', '읽기 모델', '핫스팟', '액터', '외부 시스템']);
      assert.equal(kind.value, 'actor');
      assert.equal(page.document.activeElement, field(page, 'ws-add-text'));
      // Nothing to add until the name has a letter.
      const add = buttonNamed(form, '더하기');
      assert.equal(add.getAttribute('aria-disabled'), 'true');
      add.click();
      await page.settle();
      assert.deepEqual(page.sent, []);
      kind.value = 'policy';
      kind.dispatch('change');
      type(field(page, 'ws-add-text'), '모임장');
      assert.equal(add.getAttribute('aria-disabled'), 'false');
      field(page, 'ws-add-text').dispatch('keydown', { key: 'Enter' });
      await page.settle();
      assert.equal(page.sent.length, 1);
      assert.deepEqual(page.sent[0].body, { step: '5', kind: 'policy', text: '모임장', x: 2 * GRID.x, y: 0 });
      assert.equal(page.sent[0].path, `${WORKSHOP_PATH}/notes`);
      assert.match(page.sent[0].key, /^"nw_[0-9a-hjkmnp-tv-z]{12}"$/);
      // The note shows at once, chosen, and the form is gone.
      const added = noteNamed(page, '모임장');
      assert.deepEqual([added.className, placeOf(added)], ['stk k-policy sel', [320, 0]]);
      assert.equal(sectionNamed(page, WORKSHOP_WORDS.add), undefined);
      assert.equal(field(page, 'ws-name').value, '모임장');
      assert.equal(sectionNamed(page, '스텝 5 · 액터').all('p')[0].textContent, '스티커 4개 · AI 초안 0개');
      // 취소 closes the form and sends nothing.
      buttonNamed(page.app.all('div', 'title')[0], WORKSHOP_WORDS.add).click();
      await page.settle();
      buttonNamed(sectionNamed(page, WORKSHOP_WORDS.add), '취소').click();
      await page.settle();
      assert.equal(sectionNamed(page, WORKSHOP_WORDS.add), undefined);
      assert.equal(page.sent.length, 1);
    } finally {
      page.close();
    }
  });

  test('a note moves by the arrow keys and by dragging, and is sent once with a new request key after 400 ms', async () => {
    const page = await openBoard({
      world: { workshop: workshopOf({ confirmed: ['0', '1', '1-b', '2'] }) },
      wrote: ({ path, body }) => {
        const note = Object.values(NOTES).find((each) => path.endsWith(each.id));
        return json(200, { ...note, ...body })();
      },
    });
    try {
      let button = noteNamed(page, '모임 만들기');
      button.dispatch('keydown', { key: 'ArrowRight' });
      button = noteNamed(page, '모임 만들기');
      assert.deepEqual(placeOf(button), [STEP, 0]);
      assert.equal(page.document.activeElement, button);
      button.dispatch('keydown', { key: 'ArrowDown', shiftKey: true });
      assert.deepEqual(page.sent, []);
      await waitSend(page);
      assert.equal(page.sent.length, 1);
      assert.deepEqual([page.sent[0].method, page.sent[0].path, page.sent[0].body], ['PATCH', `${WORKSHOP_PATH}/notes/${NOTES.c1.id}`, { x: STEP, y: LONG_STEP }]);
      assert.equal(field(page, 'ws-name').value, '모임 만들기');
      // A move to the frame's left edge stops there.
      noteNamed(page, '모임 만들기').dispatch('keydown', { key: 'ArrowLeft', shiftKey: true });
      assert.deepEqual(placeOf(noteNamed(page, '모임 만들기')), [0, LONG_STEP]);
      await waitSend(page);
      assert.deepEqual(page.sent[1].body, { x: 0, y: LONG_STEP });
      assert.notEqual(page.sent[1].key, page.sent[0].key);
      // A drag: taken once it is let go 3 pixels or more away; a click is not a move.
      button = noteNamed(page, '알림 보내기');
      button.dispatch('pointerdown', { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
      button.dispatch('pointermove', { clientX: 101, clientY: 101 });
      button.dispatch('pointerup', { clientX: 101, clientY: 101 });
      await waitSend(page);
      assert.equal(page.sent.length, 2);
      button = noteNamed(page, '알림 보내기');
      button.dispatch('pointerdown', { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
      // The same button takes its drag listeners once, whatever number of presses it saw.
      assert.equal(button.listeners.get('pointerup').length, 1);
      button.dispatch('pointermove', { clientX: 150, clientY: 130 });
      assert.deepEqual(placeOf(button), [530, 30]);
      button.dispatch('pointerup', { clientX: 150, clientY: 130 });
      await waitSend(page);
      assert.deepEqual(page.sent[2].body, { x: 530, y: 30 });
    } finally {
      page.close();
    }
  });

  test('a rename is sent with Enter when the name differs; Escape or leaving the field puts the name back', async () => {
    const page = await openBoard({
      world: { workshop: workshopOf({ confirmed: ['0', '1', '1-b', '2'] }) },
      wrote: ({ body }) => json(200, { ...NOTES.c1, ...body, made_by: 'owner', confidence: null })(),
    });
    try {
      noteNamed(page, '모임 만들기').click();
      await page.settle();
      const section = sectionNamed(page, WORKSHOP_WORDS.selected);
      assert.deepEqual(section.all('label').map((label) => label.textContent), ['이름']);
      assert.deepEqual(section.all('button').map((button) => button.textContent), ['잇기', '이 스티커 떼기']);
      let name = field(page, 'ws-name');
      assert.equal(name.value, '모임 만들기');
      // The same name: nothing is sent.
      name.dispatch('keydown', { key: 'Enter' });
      await page.settle();
      assert.deepEqual(page.sent, []);
      // Escape puts it back.
      type(name, '모임 열기');
      name.dispatch('keydown', { key: 'Escape' });
      assert.equal(name.value, '모임 만들기');
      // Leaving the field without Enter puts it back.
      type(name, '모임 열기');
      name.dispatch('blur');
      assert.equal(name.value, '모임 만들기');
      await page.settle();
      assert.deepEqual(page.sent, []);
      type(name, '모임 열기');
      name.dispatch('keydown', { key: 'Enter' });
      await page.settle();
      assert.deepEqual([page.sent.length, page.sent[0].method, page.sent[0].body], [1, 'PATCH', { text: '모임 열기' }]);
      // A renamed draft is the owner's: its label goes.
      const renamed = noteNamed(page, '모임 열기');
      assert.deepEqual(renamed.all('span', 'conf'), []);
      name = field(page, 'ws-name');
      assert.deepEqual([name.value, page.document.activeElement === name], ['모임 열기', true]);
      assert.equal(sectionNamed(page, '스텝 3 · 명령').all('p')[0].textContent, '스티커 7개 · AI 초안 5개');
    } finally {
      page.close();
    }
  });

  test('이 스티커 떼기 removes the note at once with its links; 잇기 links the next note chosen, and 연결 떼기 removes it', async () => {
    let links = 0;
    const page = await openBoard({
      world: { workshop: workshopOf({ confirmed: ['0', '1', '1-b', '2'], links: [linkOf(1, NOTES.c1, NOTES.e1)] }) },
      wrote: ({ method, path, body }) => {
        if (method === 'POST') {
          links += 1;
          return json(201, { id: `sl_${String(10 + links).padStart(12, '0')}`, from: body.from, to: body.to, made_by: 'owner' })();
        }
        return json(200, { id: path.split('/').at(-1), changed: true })();
      },
    });
    try {
      // The link drawn in the frame, an arrow with its head.
      assert.equal(boardOf(page).all('path', 'ws-link').length, 1);
      assert.equal(boardOf(page).all('path', 'ws-head').length, 1);
      noteNamed(page, '모임 만들기').click();
      await page.settle();
      let section = sectionNamed(page, WORKSHOP_WORDS.selected);
      assert.deepEqual(section.all('h3').map((h3) => h3.textContent), ['이어진 스티커']);
      assert.deepEqual(section.all('li').map((li) => li.all('span')[0].textContent), ['→ 모임이 만들어짐']);
      // 잇기, then Escape: nothing is sent.
      buttonNamed(section, '잇기').click();
      await page.settle();
      assert.deepEqual(texts(page, 'b').filter((text) => text === WORKSHOP_WORDS.linkAsk), [WORKSHOP_WORDS.linkAsk]);
      page.document.listeners.get('keydown').forEach((listener) => listener({ key: 'Escape' }));
      await page.settle();
      assert.equal(texts(page, 'b').includes(WORKSHOP_WORDS.linkAsk), false);
      // 잇기, then 취소.
      buttonNamed(sectionNamed(page, WORKSHOP_WORDS.selected), '잇기').click();
      await page.settle();
      buttonNamed(page.app.all('div', 'ws-bar')[0], '취소').click();
      await page.settle();
      assert.equal(texts(page, 'b').includes(WORKSHOP_WORDS.linkAsk), false);
      // 잇기, then another note: the link from the chosen note to it.
      buttonNamed(sectionNamed(page, WORKSHOP_WORDS.selected), '잇기').click();
      await page.settle();
      noteNamed(page, '모임 만들기').click();
      await page.settle();
      assert.deepEqual(page.sent, []);
      noteNamed(page, '참가 신청하기').click();
      await page.settle();
      assert.deepEqual([page.sent[0].method, page.sent[0].path, page.sent[0].body], ['POST', `${WORKSHOP_PATH}/links`, { from: NOTES.c1.id, to: NOTES.c2.id }]);
      assert.equal(boardOf(page).all('path', 'ws-link').length, 2);
      section = sectionNamed(page, WORKSHOP_WORDS.selected);
      assert.deepEqual(section.all('li').map((li) => li.all('span')[0].textContent), ['→ 모임이 만들어짐', '→ 참가 신청하기']);
      // 연결 떼기 on the first.
      buttonNamed(section.all('li')[0], '연결 떼기').click();
      await page.settle();
      assert.deepEqual([page.sent[1].method, page.sent[1].path, page.sent[1].body], ['DELETE', `${WORKSHOP_PATH}/links/sl_000000000001`, null]);
      assert.deepEqual(sectionNamed(page, WORKSHOP_WORDS.selected).all('li').map((li) => li.all('span')[0].textContent), ['→ 참가 신청하기']);
      // 이 스티커 떼기: no question; the note and its link go.
      buttonNamed(sectionNamed(page, WORKSHOP_WORDS.selected), '이 스티커 떼기').click();
      await page.settle();
      assert.deepEqual([page.sent[2].method, page.sent[2].path], ['DELETE', `${WORKSHOP_PATH}/notes/${NOTES.c1.id}`]);
      assert.equal(noteNamed(page, '모임 만들기'), undefined);
      assert.equal(boardOf(page).all('path', 'ws-link').length, 0);
      assert.equal(sectionNamed(page, WORKSHOP_WORDS.selected), undefined);
    } finally {
      page.close();
    }
  });

  test('스텝 N 확정 confirms the chosen step; an empty step\'s confirmation refused says 확정하기 전에 스티커를 붙이세요', async () => {
    let refuse = true;
    const page = await openBoard({
      world: { workshop: workshopOf({ confirmed: ['0', '1', '1-b', '2'] }) },
      wrote: ({ path }) => (refuse ? problem(409, 'step_empty')() : json(200, { workshop: WS, step: path.split('/').at(-2), confirmed_at: TIME, checkpoint: false, changed: true })()),
    });
    try {
      buttonNamed(panelOf(page), '스텝 3 확정').click();
      await page.settle();
      assert.deepEqual([page.sent[0].path, page.sent[0].body], [`${WORKSHOP_PATH}/steps/3/confirm`, {}]);
      // Another tab emptied it meanwhile.
      assert.deepEqual(panelOf(page).all('p', 'err-text').map((p) => p.textContent), [message('step_empty')]);
      refuse = false;
      buttonNamed(panelOf(page), '스텝 3 확정').click();
      await page.settle();
      assert.notEqual(page.sent[1].key, page.sent[0].key);
      const step = sectionNamed(page, '스텝 3 · 명령');
      assert.deepEqual(step.all('span', 'tag').map((tag) => tag.textContent), ['확정함']);
      assert.equal(buttonNamed(step, '스텝 3 확정'), undefined);
      assert.deepEqual(panelOf(page).all('p', 'err-text'), []);
      assert.ok(stripOf(page).all('button', 'done').some((button) => button.textContent === '3 명령'));
      assert.equal(boardOf(page).all('div', 'frame-h')[0].textContent, '스텝 3 · 명령확정함');
    } finally {
      page.close();
    }
  });

  test('Miro에서 가져오기 sends the chosen file as it is, says what came, and reads the workshop again; over 5 MiB stays here', async () => {
    const page = await openBoard({ wrote: () => json(201, { workshop: WS, notes: 30, links: 4 })() });
    try {
      const input = page.app.all('div', 'title')[0].all('input')[0];
      assert.deepEqual([input.getAttribute('type'), input.getAttribute('accept'), input.hidden], ['file', '.json,application/json', true]);
      // Over 5 MiB: refused without sending, with the 413's message.
      input.files = [{ size: MIRO_BYTES + 1, text: async () => 'x' }];
      input.dispatch('change');
      await page.settle();
      assert.deepEqual(page.sent, []);
      assert.deepEqual(page.app.all('div', 'ws-bar')[0].all('b').map((b) => b.textContent), [message('body_too_large')]);
      const reads = page.calls.filter((path) => path === WORKSHOP_PATH).length;
      const file = '{"data": [ {"id":"1","type":"sticky_note"} ]}';
      input.files = [{ size: file.length, text: async () => file }];
      input.dispatch('change');
      await page.settle();
      assert.deepEqual([page.sent[0].method, page.sent[0].path, page.sent[0].text, page.sent[0].type], ['POST', `${WORKSHOP_PATH}/imports`, file, 'application/json']);
      assert.match(page.sent[0].key, /^"nw_[0-9a-hjkmnp-tv-z]{12}"$/);
      assert.deepEqual(page.app.all('div', 'ws-bar')[0].all('b').map((b) => b.textContent), [importedWords(30, 4)]);
      assert.equal(importedWords(30, 4), '스티커 30개와 연결 4개를 가져왔어요.');
      assert.equal(page.calls.filter((path) => path === WORKSHOP_PATH).length, reads + 1);
    } finally {
      page.close();
    }
  });

  test('on a phone the board is read-only: the note says so, and nothing adds, moves, confirms or imports (SPEC-051)', async () => {
    const page = await openBoard({ phone: true, world: { workshop: workshopOf({ confirmed: ['0', '1', '1-b', '2'] }) } });
    try {
      assert.deepEqual(texts(page, 'h1'), ['워크숍 · 스텝 3 명령']);
      assert.ok(texts(page, 'b').includes('휴대폰에서는 보드를 읽기만 해요. 스티커와 스텝 확정은 PC에서 하세요.'));
      assert.deepEqual(page.app.all('div', 'title')[0].all('button'), []);
      assert.deepEqual(panelOf(page).children, []);
      // The notes are drawn, but none is a button; the strip still chooses a step.
      assert.equal(boardOf(page).all('button').length, 0);
      assert.equal(boardOf(page).all('div', 'stk').length, 7);
      await chooseStep(page, '4');
      assert.deepEqual(texts(page, 'h1'), ['워크숍 · 스텝 4 핫스팟']);
      assert.deepEqual(page.sent, []);
    } finally {
      page.close();
    }
  });

  test('the drawn DDD board stays reachable: ?d= and ?thread= open it, with 워크숍 first in its list', async () => {
    const page = await openBoard({ search: `?d=${BOARD}` });
    try {
      assert.deepEqual(texts(page, 'h1'), ['DDD board']);
      assert.ok(page.calls.includes(DIAGRAM_PATH));
      assert.equal(page.calls.includes(WORKSHOP_PATH), false);
      const list = page.app.all('nav').find((nav) => nav.getAttribute('aria-label') === '이 단계의 그림 1개');
      assert.deepEqual(list.all('a').map((link) => [link.textContent, link.getAttribute('aria-current')]), [['워크숍', null], ['DDD board', 'page']]);
      // No 워크숍 열기 while one is open.
      assert.equal(buttonNamed(page.app, WORKSHOP_WORDS.openWorkshop), undefined);
      // 워크숍 opens it in the page.
      list.all('a')[0].dispatch('click', { button: 0 });
      await page.settle();
      assert.deepEqual([page.location.pathname, page.location.search], [STAGE_PATH, '']);
      assert.deepEqual(texts(page, 'h1'), [stepTitle('0')]);
    } finally {
      page.close();
    }
    const thread = await openBoard({ search: '?thread=th_000000000001' });
    try {
      assert.deepEqual(texts(thread, 'h1'), ['DDD board']);
      assert.equal(thread.calls.includes(WORKSHOP_PATH), false);
    } finally {
      thread.close();
    }
  });

  test('워크숍 열기 asks once, opens the workshop at step 0, and is not offered on a phone or while one is open', async () => {
    const world = { project: projectOf({ workshop: null }), workshop: null };
    const page = await openBoard({
      world,
      wrote: (request, state) => {
        state.project = projectOf();
        state.workshop = workshopOf({ notes: [] });
        return json(201, state.workshop)();
      },
    });
    try {
      assert.deepEqual(texts(page, 'h1'), ['DDD board']);
      const open = buttonNamed(page.app, WORKSHOP_WORDS.openWorkshop);
      open.click();
      await page.settle();
      assert.deepEqual(page.sent, []);
      assert.ok(texts(page, 'b').includes(WORKSHOP_WORDS.openAsk));
      assert.equal(WORKSHOP_WORDS.openAsk, '워크숍을 열까요? 11개 스텝을 모두 확정하고 에이전트가 도메인 문서에 쓸 때까지 열려 있어요.');
      // 취소: back to the button.
      buttonNamed(page.app.all('div', 'ws-open')[0], '취소').click();
      await page.settle();
      assert.equal(texts(page, 'b').includes(WORKSHOP_WORDS.openAsk), false);
      buttonNamed(page.app, WORKSHOP_WORDS.openWorkshop).click();
      await page.settle();
      buttonNamed(page.app.all('div', 'nt')[0], WORKSHOP_WORDS.openWorkshop).click();
      await page.settle();
      assert.deepEqual([page.sent[0].method, page.sent[0].path, page.sent[0].body], ['POST', WORKSHOP_PATH, {}]);
      assert.deepEqual(texts(page, 'h1'), ['워크숍 · 스텝 0 준비']);
    } finally {
      page.close();
    }
    // A workshop opened meanwhile (409 workshop_open) opens, from a drawn diagram's address too.
    const other = await openBoard({
      world: { project: projectOf({ workshop: { id: WS, state: 'closed' } }) },
      search: `?d=${BOARD}`,
      wrote: (request, state) => {
        state.project = projectOf();
        return problem(409, 'workshop_open')();
      },
    });
    try {
      buttonNamed(other.app, WORKSHOP_WORDS.openWorkshop).click();
      await other.settle();
      buttonNamed(other.app.all('div', 'nt')[0], WORKSHOP_WORDS.openWorkshop).click();
      await other.settle();
      assert.deepEqual([other.location.pathname, other.location.search], [STAGE_PATH, '']);
      assert.deepEqual(texts(other, 'h1'), [stepTitle('0')]);
    } finally {
      other.close();
    }
    for (const phone of [true, false]) {
      const shown = await openBoard({ phone, world: { project: projectOf({ workshop: null, diagrams: false }), workshop: null } });
      try {
        // With nothing sent for stage 01, the empty state, and 워크숍 열기 on a PC only.
        assert.ok(texts(shown, 'h2').includes('아직 보낸 것이 없어요.'));
        assert.equal(buttonNamed(shown.app, WORKSHOP_WORDS.openWorkshop) !== undefined, !phone);
      } finally {
        shown.close();
      }
    }
  });

  test('a write after the workshop closed shows "워크숍이 닫혀 있어요" with 새로 고침, and keeps what was typed', async () => {
    const page = await openBoard({ world: { workshop: workshopOf({ confirmed: ['0', '1', '1-b', '2'] }) }, wrote: () => problem(409, 'workshop_closed')() });
    try {
      buttonNamed(page.app.all('div', 'title')[0], WORKSHOP_WORDS.add).click();
      await page.settle();
      type(field(page, 'ws-add-text'), '모임 취소됨');
      buttonNamed(sectionNamed(page, WORKSHOP_WORDS.add), '더하기').click();
      await page.settle();
      const bar = page.app.all('div', 'wb-notice')[0];
      assert.deepEqual([bar.all('b').map((b) => b.textContent), bar.all('button').map((button) => button.textContent)], [['워크숍이 닫혀 있어요.'], ['새로 고침']]);
      assert.equal(field(page, 'ws-add-text').value, '모임 취소됨');
      // The reload reads the project and the workshop again, and the bar goes.
      const reads = page.calls.filter((path) => path === PROJECT_PATH).length;
      bar.all('button')[0].click();
      await page.settle();
      assert.equal(page.calls.filter((path) => path === PROJECT_PATH).length, reads + 1);
      assert.deepEqual(page.app.all('div', 'wb-notice')[0].children, []);
    } finally {
      page.close();
    }
  });

  test('a 401 on a rename keeps the typed name through the gate, and the page shows it again', async () => {
    const page = await openBoard({ world: { workshop: workshopOf({ confirmed: ['0', '1', '1-b', '2'] }) }, wrote: () => problem(401, 'unauthenticated')() });
    let session;
    try {
      noteNamed(page, '모임 만들기').click();
      await page.settle();
      buttonNamed(page.app.all('div', 'title')[0], WORKSHOP_WORDS.add).click();
      await page.settle();
      type(field(page, 'ws-add-text'), '새 모임');
      const name = field(page, 'ws-name');
      type(name, '모임 열기');
      name.dispatch('keydown', { key: 'Enter' });
      await page.settle();
      assert.equal(page.location.reloads, 1);
      session = Object.fromEntries([...page.session.entries]);
    } finally {
      page.close();
    }
    const again = await openBoard({ world: { workshop: workshopOf({ confirmed: ['0', '1', '1-b', '2'] }) }, session });
    try {
      assert.equal(field(again, 'ws-name').value, '모임 열기');
      assert.equal(field(again, 'ws-add-text').value, '새 모임');
      assert.ok(noteNamed(again, '모임 만들기').className.includes('sel'));
    } finally {
      again.close();
    }
  });

  test('a closed workshop, or none, between the two reads shows "워크숍이 닫혀 있어요" with 새로 고침', async () => {
    for (const workshop of [workshopOf({ state: 'closed' }), null]) {
      const page = await openBoard({ world: { workshop } });
      try {
        assert.deepEqual(texts(page, 'h1'), ['도메인']);
        assert.ok(texts(page, 'b').includes(message('workshop_closed')));
        assert.ok(texts(page, 'button').includes('새로 고침'));
      } finally {
        page.close();
      }
    }
  });
});

describe('SCR-145 workshop against the server', () => {
  const responses = responseRecord();
  const realFetch = globalThis.fetch;
  let folder;
  let db;
  let local;
  let good;
  let broken;
  let s;
  let failing = false;
  let count = 0;
  const owner = () => ({ 'Cf-Access-Jwt-Assertion': local.token() });
  const someone = () => ({ 'Cf-Access-Jwt-Assertion': local.token({ email: 'someone@example.com' }) });
  const headersOf = (who) => ({ owner: owner(), someone: someone(), agent: s.agent.headers, nobody: {} })[who];
  const signedOut = () => ({ [GATE_KEY]: String(Date.now()) });
  const key = () => {
    count += 1;
    return { 'Idempotency-Key': `"nw_${String(count).padStart(12, '0')}"` };
  };
  const JSON_TYPE = { 'Content-Type': 'application/json' };

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-workshop-screen-'));
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

  // The operation a request of the page is, by its method and path.
  function actionOf(method, path) {
    if (/\/workshop$/u.test(path)) return method === 'GET' ? 'getWorkshop' : 'openWorkshop';
    if (/\/workshop\/notes$/u.test(path)) return 'addNote';
    if (/\/workshop\/notes\/[^/]+$/u.test(path)) return method === 'PATCH' ? 'changeNote' : 'removeNote';
    if (/\/workshop\/links$/u.test(path)) return 'connectNotes';
    if (/\/workshop\/links\/[^/]+$/u.test(path)) return 'removeNoteLink';
    if (/\/workshop\/steps\/[^/]+\/confirm$/u.test(path)) return 'confirmStep';
    if (/\/workshop\/imports$/u.test(path)) return 'importMiroBoard';
    return null;
  }

  // A request to the server, its answer noted under the operation it is.
  async function call(target, action, { method = 'POST', path, headers = {}, body }) {
    const answer = await target.send({ method, path, headers: { ...(body === undefined ? {} : JSON_TYPE), ...headers }, body: body === undefined || typeof body === 'string' ? body : JSON.stringify(body) });
    return responses.note(action, answer);
  }

  // A project with an open workshop, two notes in step 0 and a link from the first to the second: { name, a, b, link }.
  async function board({ open = true } = {}) {
    const { name } = s.project();
    if (!open) return { name };
    const path = `/api/projects/${name}/workshop`;
    assert.equal((await call(good, 'openWorkshop', { path, headers: { ...owner(), ...key() }, body: {} })).status, 201);
    const a = (await call(good, 'addNote', { path: `${path}/notes`, headers: { ...owner(), ...key() }, body: { step: '0', kind: 'event', text: 'Note A', x: 0, y: 0 } })).json;
    const b = (await call(good, 'addNote', { path: `${path}/notes`, headers: { ...owner(), ...key() }, body: { step: '0', kind: 'command', text: 'Note B', x: 160, y: 0 } })).json;
    const link = (await call(good, 'connectNotes', { path: `${path}/links`, headers: { ...owner(), ...key() }, body: { from: a.id, to: b.id } })).json;
    return { name, a, b, link };
  }

  // The page of stage 01 of name on target, as who; a request in replay ("METHOD path") gets that answer instead. Every
  // other write goes to the server and is noted.
  async function openOn(target, name, { who = 'owner', replay = {}, session = {}, search = '' } = {}) {
    const asked = [];
    const answers = async (path, init) => {
      const method = init?.method ?? 'GET';
      asked.push(`${method} ${path}`);
      // A stand-in that gives nothing, as a used once(), lets the request through.
      const stood = replay[`${method} ${path}`]?.();
      if (stood !== undefined) return stood;
      const response = await realFetch(`http://127.0.0.1:${target.port}${path}`, {
        method, headers: { ...(init?.headers ?? {}), ...headersOf(who) }, body: init?.body, redirect: 'manual',
      });
      const action = actionOf(method, path);
      if (action === null || method === 'GET') return response;
      const text = await response.text();
      responses.note(action, { status: response.status, headers: Object.fromEntries(response.headers), text, json: JSON.parse(text) });
      return new Response(text, { status: response.status, headers: response.headers });
    };
    const page = await openPage(`/p/${name}/_/01-domain`, { search, answers, session });
    page.asked = asked;
    return page;
  }

  const replayOf = (answer) => () => new Response(answer.text, { status: answer.status, headers: { 'content-type': answer.headers['content-type'] } });
  // An answer given to the first such request only.
  const once = (answer) => {
    let used = false;
    return () => {
      if (used) return undefined;
      used = true;
      return replayOf(answer)();
    };
  };
  // The listed responses' cases: those of each listed status, one for each Problem code it lists.
  const casesOf = (action, cases) => listedResponses(action).map((listed) => {
    const found = cases.filter((each) => (listed.status === 'default' ? each.status === 500 : String(each.status) === listed.status)
      && (listed.codes.length === 0 || listed.codes.includes(each.code)));
    assert.equal(found.length, Math.max(1, listed.codes.length), `${action} ${listed.status}`);
    return found;
  }).flat();

  // What each answer leads the page to, by SCR-145's states.
  const gateShows = (page) => assert.deepEqual([page.location.reloads, page.session.getItem(GATE_KEY) !== null], [1, true]);
  const permissionShows = (code, buttons = []) => (page) => assert.deepEqual([texts(page, 'h1'), texts(page, 'button')], [[message(code)], buttons]);
  const goneShows = (page) => assert.deepEqual([texts(page, 'h1'), page.app.all('a', 'btn').map((link) => link.textContent)], [[message('project_not_found')], ['프로젝트 목록']]);
  const notice = (page) => page.app.all('div', 'wb-notice')[0];
  const staleShows = (page) => assert.deepEqual([notice(page).all('b').map((b) => b.textContent), notice(page).all('button').map((button) => button.textContent)], [['워크숍이 닫혀 있어요.'], ['새로 고침']]);
  const inNotice = (code, buttons = []) => (page) => assert.deepEqual([notice(page).all('b').map((b) => b.textContent), notice(page).all('button').map((button) => button.textContent)], [[message(code)], buttons]);
  const failureShows = inNotice('internal', ['다시 시도']);
  const byField = (code) => (page) => assert.deepEqual(page.app.all('p', 'err-text').filter((p) => p.shown).map((p) => p.textContent), [message(code)]);
  const inBar = (code) => (page) => assert.deepEqual(page.app.all('div', 'ws-bar')[0].all('b').map((b) => b.textContent), [message(code)]);
  // A 404 of a note or a link another tab removed: its message, and the workshop read again.
  const goneNoteShows = (code) => (page) => {
    inNotice(code)(page);
    const wrote = page.asked.findIndex((request) => !request.startsWith('GET '));
    assert.ok(page.asked.slice(wrote).some((request) => /^GET \/api\/projects\/[^/]+\/workshop$/u.test(request)), page.asked.join(', '));
  };

  // The cases every owner write shares: the sign-in, the owner, the gate's cross-site check, a project that is gone and
  // a store that fails. request(fields) makes the request.
  const shared = (request, { input }) => [
    { status: 401, code: 'unauthenticated', request: request({ who: 'nobody' }), shows: gateShows },
    { status: 403, code: 'owner_only', request: request({ who: 'agent' }), shows: permissionShows('owner_only') },
    { status: 403, code: 'not_owner', request: request({ who: 'someone' }), shows: permissionShows('not_owner') },
    { status: 403, code: 'cross_site', request: request({ headers: { 'Sec-Fetch-Site': 'cross-site' } }), shows: permissionShows('cross_site', ['새로 고침']) },
    { status: 404, code: 'project_not_found', request: request({ project: 'no-such-project' }), shows: goneShows },
    { status: 409, code: 'request_key_reused', request: request({ reused: true }), shows: input('request_key_reused') },
    { status: 500, code: 'internal', fails: true, request: request({}), shows: failureShows },
  ];

  // Runs each case: its answer made on the server, then the page doing act with that answer in place of its own.
  async function runCases(action, method, pathOf, cases, act, { open = true } = {}) {
    for (const each of cases) {
      if (each.done) continue;
      const target = each.fails ? broken : good;
      const space = await board({ open });
      failing = Boolean(each.fails);
      let answer;
      try {
        answer = responses.note(action, await target.send(await each.request(space)));
      } finally {
        failing = false;
      }
      assert.deepEqual([answer.status, answer.json?.code], [each.status, each.code], `${action} ${each.status} ${each.code}`);
      const replay = { ...(each.first?.(space) ?? {}), [`${method} ${pathOf(space)}`]: replayOf(answer) };
      const page = await openOn(good, space.name, { replay, search: each.search ?? '' });
      try {
        await act(page, space);
        await page.settle();
        each.shows(page, space);
      } catch (error) {
        error.message = `${action} ${each.status} ${each.code}: ${error.message}`;
        throw error;
      } finally {
        page.close();
      }
    }
    responses.assertEvery(action);
  }

  // A request of an owner's write, as each case changes it.
  function requestOf(space, { method = 'POST', path, body = {}, who = 'owner', headers = {}, project = null, reused = false, keyless = false }) {
    const real = project === null ? path : path.replace(`/api/projects/${space.name}/`, `/api/projects/${project}/`).replace(new RegExp(`/api/projects/${space.name}$`, 'u'), `/api/projects/${project}`);
    const sent = body === null ? {} : JSON_TYPE;
    const requestKey = keyless ? {} : key();
    return async () => {
      if (reused) {
        // The key taken first by another write of the owner's, a workshop opened in another project, so this board
        // stays as it was for the page.
        const first = await good.send({ method: 'POST', path: `/api/projects/${s.project().name}/workshop`, headers: { ...JSON_TYPE, ...owner(), ...requestKey }, body: '{}' });
        assert.equal(first.status, 201);
      }
      return { method, path: real, headers: { ...sent, ...headersOf(who), ...requestKey, ...headers }, body: body === null ? undefined : JSON.stringify(body) };
    };
  }

  test('every response API-285 lists leads SCR-145 to the state its definition gives', async () => {
    const space = await board();
    const path = (name) => `/api/projects/${name}/workshop`;
    const cases = casesOf('getWorkshop', [
      { status: 200, shows: (page) => assert.deepEqual(texts(page, 'h1'), [stepTitle('0')]) },
      { status: 401, code: 'unauthenticated', who: 'nobody', shows: gateShows },
      { status: 403, code: 'not_owner', who: 'someone', shows: permissionShows('not_owner') },
      { status: 403, code: 'owner_only', who: 'agent', shows: permissionShows('owner_only') },
      { status: 404, code: 'project_not_found', project: 'no-such-project', shows: goneShows },
      // No workshop between the project's read and this one: the stale bar and its reload.
      { status: 404, code: 'workshop_not_found', project: (await board({ open: false })).name, shows: (page) => assert.ok(texts(page, 'b').includes(message('workshop_closed'))) },
      { status: 500, code: 'internal', fails: true, shows: failureShows },
    ]);
    for (const each of cases) {
      failing = Boolean(each.fails);
      let answer;
      try {
        answer = responses.note('getWorkshop', await (each.fails ? broken : good).send({ path: path(each.project ?? space.name), headers: headersOf(each.who ?? 'owner') }));
      } finally {
        failing = false;
      }
      assert.deepEqual([answer.status, answer.json.code], [each.status, each.code]);
      const page = await openOn(good, space.name, { replay: { [`GET ${path(space.name)}`]: replayOf(answer) } });
      try {
        // A 500 of the workshop's read shows the error in place of the board, with 다시 시도.
        if (each.status === 500) assert.deepEqual([texts(page, 'b'), texts(page, 'button').includes('다시 시도')], [[message('internal')], true]);
        else each.shows(page);
      } finally {
        page.close();
      }
    }
    responses.assertEvery('getWorkshop');
  });

  test('every response API-284 lists leads 워크숍 열기 to the state SCR-145 gives', async () => {
    const path = (space) => `/api/projects/${space.name}/workshop`;
    const make = (fields = {}) => (space) => requestOf(space, { path: path(space), ...fields })();
    const byOpen = (code) => byField(code);
    const before = new Map();
    const cases = casesOf('openWorkshop', [
      { status: 201, done: true },
      { status: 400, code: 'invalid_request', request: make({ keyless: true }), shows: byOpen('invalid_request') },
      ...shared((fields) => make(fields), { input: byOpen }),
      {
        status: 409, code: 'workshop_open',
        // The page read the project before the test's own request opened the workshop.
        request: async (space) => {
          before.set(space.name, await good.send({ path: `/api/projects/${space.name}`, headers: owner() }));
          assert.equal((await good.send(await make()(space))).status, 201);
          return make()(space);
        },
        first: (space) => ({ [`GET /api/projects/${space.name}`]: once(before.get(space.name)) }),
        // The workshop opened meanwhile opens: the page reads again and shows it.
        shows: (page) => assert.deepEqual(texts(page, 'h1'), [stepTitle('0')]),
      },
      { status: 413, code: 'body_too_large', request: async (space) => ({ ...(await make()(space)), body: JSON.stringify({ pad: 'x'.repeat(2 * 1024 * 1024) }) }), shows: byOpen('body_too_large') },
      { status: 415, code: 'json_required', request: async (space) => ({ ...(await make()(space)), headers: { ...owner(), ...key(), 'Content-Type': 'text/plain' } }), shows: inOpen('json_required') },
    ].map((each) => (each.code === 'internal' ? { ...each, shows: inOpen('internal') } : each)));
    function inOpen(code) {
      return (page) => {
        const box = page.app.all('div', 'ws-open')[0];
        assert.deepEqual([box.all('b').map((b) => b.textContent), box.all('button').map((button) => button.textContent).includes('다시 시도')], [[message(code)], true]);
      };
    }
    const act = async (page) => {
      buttonNamed(page.app, WORKSHOP_WORDS.openWorkshop).click();
      await page.settle();
      buttonNamed(page.app.all('div', 'ws-open')[0].all('div', 'nt')[0], WORKSHOP_WORDS.openWorkshop).click();
    };
    // The 201 through the page, against the server.
    const fresh = await board({ open: false });
    const page = await openOn(good, fresh.name);
    try {
      await act(page);
      await page.settle();
      assert.deepEqual(texts(page, 'h1'), [stepTitle('0')]);
    } finally {
      page.close();
    }
    // A workshop that is open shows the board, so the page runs these where none is open; a 409 workshop_open comes
    // from a second request of the test's.
    await runCases('openWorkshop', 'POST', path, cases, act, { open: false });
  });

  test('every response API-286 lists leads 스티커 더하기 to the state SCR-145 gives', async () => {
    const path = (space) => `/api/projects/${space.name}/workshop/notes`;
    const note = { step: '0', kind: 'event', text: 'Note C', x: 320, y: 0 };
    const make = (fields = {}) => (space) => requestOf(space, { path: path(space), body: note, ...fields })();
    const cases = casesOf('addNote', [
      { status: 201, done: true },
      { status: 400, code: 'invalid_request', request: make({ body: { ...note, text: ' ' } }), shows: byField('invalid_request') },
      { status: 400, code: 'text_too_long', request: make({ body: { ...note, text: 'x'.repeat(201) } }), shows: byField('text_too_long') },
      ...shared((fields) => make(fields), { input: byField }),
      { status: 409, code: 'workshop_closed', request: async () => make()(await board({ open: false })), shows: staleShows },
      { status: 413, code: 'body_too_large', request: async (space) => ({ ...(await make()(space)), body: JSON.stringify({ ...note, pad: 'x'.repeat(2 * 1024 * 1024) }) }), shows: byField('body_too_large') },
      { status: 415, code: 'json_required', request: async (space) => ({ ...(await make()(space)), headers: { ...owner(), ...key(), 'Content-Type': 'text/plain' } }), shows: inNotice('json_required', ['다시 시도']) },
    ]);
    const act = async (page) => {
      buttonNamed(page.app.all('div', 'title')[0], WORKSHOP_WORDS.add).click();
      await page.settle();
      type(field(page, 'ws-add-text'), 'Note C');
      buttonNamed(sectionNamed(page, WORKSHOP_WORDS.add), '더하기').click();
    };
    const space = await board();
    const page = await openOn(good, space.name);
    try {
      await act(page);
      await page.settle();
      const added = noteNamed(page, 'Note C');
      assert.deepEqual([added.className, placeOf(added)], ['stk k-event sel', [320, 0]]);
      const read = (await good.send({ path: `/api/projects/${space.name}/workshop`, headers: owner() })).json;
      assert.deepEqual(read.steps[0].notes.map((each) => [each.text, each.kind, each.x, each.y, each.made_by]), [
        ['Note A', 'event', 0, 0, 'owner'], ['Note B', 'command', 160, 0, 'owner'], ['Note C', 'event', 320, 0, 'owner'],
      ]);
    } finally {
      page.close();
    }
    await runCases('addNote', 'POST', path, cases, act);
  });

  test('every response API-287 lists leads a rename and a move to the state SCR-145 gives', async () => {
    const path = (space) => `/api/projects/${space.name}/workshop/notes/${space.a.id}`;
    const make = (fields = {}) => (space) => requestOf(space, { method: 'PATCH', path: path(space), body: { text: 'Note A2' }, ...fields })();
    const cases = casesOf('changeNote', [
      { status: 200, done: true },
      { status: 400, code: 'invalid_request', request: make({ body: { text: ' ' } }), shows: byField('invalid_request') },
      { status: 400, code: 'text_too_long', request: make({ body: { text: 'x'.repeat(201) } }), shows: byField('text_too_long') },
      ...shared((fields) => make(fields), { input: byField }),
      { status: 404, code: 'note_not_found', request: async (space) => ({ ...(await make()(space)), path: path(space).replace(space.a.id, 'sn_zzzzzzzzzzzz') }), shows: goneNoteShows('note_not_found') },
      { status: 409, code: 'workshop_closed', request: async (space) => ({ ...(await make()(space)), path: `/api/projects/${(await board({ open: false })).name}/workshop/notes/${space.a.id}` }), shows: staleShows },
      { status: 413, code: 'body_too_large', request: async (space) => ({ ...(await make()(space)), body: JSON.stringify({ text: 'x', pad: 'x'.repeat(2 * 1024 * 1024) }) }), shows: byField('body_too_large') },
      { status: 415, code: 'json_required', request: async (space) => ({ ...(await make()(space)), headers: { ...owner(), ...key(), 'Content-Type': 'text/plain' } }), shows: inNotice('json_required', ['다시 시도']) },
    ]);
    const act = async (page) => {
      noteNamed(page, 'Note A').click();
      await page.settle();
      type(field(page, 'ws-name'), 'Note A2');
      field(page, 'ws-name').dispatch('keydown', { key: 'Enter' });
    };
    const space = await board();
    const page = await openOn(good, space.name);
    try {
      await act(page);
      await page.settle();
      assert.equal(field(page, 'ws-name').value, 'Note A2');
      // A move of the same note, by the arrow keys.
      noteNamed(page, 'Note A2').dispatch('keydown', { key: 'ArrowDown', shiftKey: true });
      await waitSend(page);
      const read = (await good.send({ path: `/api/projects/${space.name}/workshop`, headers: owner() })).json;
      assert.deepEqual(read.steps[0].notes.map((each) => [each.text, each.x, each.y]), [['Note A2', 0, LONG_STEP], ['Note B', 160, 0]]);
      assert.deepEqual(notice(page).children, []);
    } finally {
      page.close();
    }
    await runCases('changeNote', 'PATCH', path, cases, act);
  });

  test('every response API-288 lists leads 이 스티커 떼기 to the state SCR-145 gives', async () => {
    const path = (space) => `/api/projects/${space.name}/workshop/notes/${space.a.id}`;
    const make = (fields = {}) => (space) => requestOf(space, { method: 'DELETE', path: path(space), body: null, ...fields })();
    const cases = casesOf('removeNote', [
      { status: 200, done: true },
      { status: 400, code: 'invalid_request', request: make({ keyless: true }), shows: inNotice('invalid_request') },
      ...shared((fields) => make(fields), { input: (code) => inNotice(code) }),
      { status: 404, code: 'note_not_found', request: async (space) => ({ ...(await make()(space)), path: path(space).replace(space.a.id, 'sn_zzzzzzzzzzzz') }), shows: goneNoteShows('note_not_found') },
      { status: 409, code: 'workshop_closed', request: async (space) => ({ ...(await make()(space)), path: `/api/projects/${(await board({ open: false })).name}/workshop/notes/${space.a.id}` }), shows: staleShows },
    ]);
    const act = async (page) => {
      noteNamed(page, 'Note A').click();
      await page.settle();
      buttonNamed(sectionNamed(page, WORKSHOP_WORDS.selected), WORKSHOP_WORDS.remove).click();
    };
    const space = await board();
    const page = await openOn(good, space.name);
    try {
      await act(page);
      await page.settle();
      assert.equal(noteNamed(page, 'Note A'), undefined);
      const read = (await good.send({ path: `/api/projects/${space.name}/workshop`, headers: owner() })).json;
      assert.deepEqual([read.steps[0].notes.map((each) => each.text), read.links], [['Note B'], []]);
    } finally {
      page.close();
    }
    await runCases('removeNote', 'DELETE', path, cases, act);
  });

  test('every response API-289 lists leads 잇기 to the state SCR-145 gives', async () => {
    const path = (space) => `/api/projects/${space.name}/workshop/links`;
    const make = (fields = {}) => (space) => requestOf(space, { path: path(space), body: { from: space.b.id, to: space.a.id }, ...fields })();
    const cases = casesOf('connectNotes', [
      { status: 200, done: true },
      { status: 201, done: true },
      { status: 400, code: 'invalid_request', request: make({ body: { from: 'x', to: 'y' } }), shows: inNotice('invalid_request') },
      ...shared((fields) => make(fields), { input: (code) => inNotice(code) }),
      { status: 404, code: 'note_not_found', request: make({ body: { from: 'sn_zzzzzzzzzzzz', to: 'sn_zzzzzzzzzzzy' } }), shows: goneNoteShows('note_not_found') },
      { status: 409, code: 'workshop_closed', request: async (space) => ({ ...(await make()(space)), path: `/api/projects/${(await board({ open: false })).name}/workshop/links` }), shows: staleShows },
      { status: 413, code: 'body_too_large', request: async (space) => ({ ...(await make()(space)), body: JSON.stringify({ from: 'a', to: 'b', pad: 'x'.repeat(2 * 1024 * 1024) }) }), shows: inNotice('body_too_large') },
      { status: 415, code: 'json_required', request: async (space) => ({ ...(await make()(space)), headers: { ...owner(), ...key(), 'Content-Type': 'text/plain' } }), shows: inNotice('json_required', ['다시 시도']) },
    ]);
    const act = async (page) => {
      noteNamed(page, 'Note B').click();
      await page.settle();
      buttonNamed(sectionNamed(page, WORKSHOP_WORDS.selected), WORKSHOP_WORDS.link).click();
      await page.settle();
      noteNamed(page, 'Note A').click();
    };
    const space = await board();
    const page = await openOn(good, space.name);
    try {
      // 201: B to A; then A to B again, which is there already: 200.
      await act(page);
      await page.settle();
      noteNamed(page, 'Note A').click();
      await page.settle();
      buttonNamed(sectionNamed(page, WORKSHOP_WORDS.selected), WORKSHOP_WORDS.link).click();
      await page.settle();
      noteNamed(page, 'Note B').click();
      await page.settle();
      assert.deepEqual(sectionNamed(page, WORKSHOP_WORDS.selected).all('li').map((li) => li.all('span')[0].textContent), ['→ Note B', '← Note B']);
      assert.equal(boardOf(page).all('path', 'ws-link').length, 2);
    } finally {
      page.close();
    }
    await runCases('connectNotes', 'POST', path, cases, act);
  });

  test('every response API-290 lists leads 연결 떼기 to the state SCR-145 gives', async () => {
    const path = (space) => `/api/projects/${space.name}/workshop/links/${space.link.id}`;
    const make = (fields = {}) => (space) => requestOf(space, { method: 'DELETE', path: path(space), body: null, ...fields })();
    const cases = casesOf('removeNoteLink', [
      { status: 200, done: true },
      { status: 400, code: 'invalid_request', request: make({ keyless: true }), shows: inNotice('invalid_request') },
      ...shared((fields) => make(fields), { input: (code) => inNotice(code) }),
      { status: 404, code: 'note_link_not_found', request: async (space) => ({ ...(await make()(space)), path: path(space).replace(space.link.id, 'sl_zzzzzzzzzzzz') }), shows: goneNoteShows('note_link_not_found') },
      { status: 409, code: 'workshop_closed', request: async (space) => ({ ...(await make()(space)), path: `/api/projects/${(await board({ open: false })).name}/workshop/links/${space.link.id}` }), shows: staleShows },
    ]);
    const act = async (page) => {
      noteNamed(page, 'Note A').click();
      await page.settle();
      buttonNamed(sectionNamed(page, WORKSHOP_WORDS.selected).all('li')[0], WORKSHOP_WORDS.unlink).click();
    };
    const space = await board();
    const page = await openOn(good, space.name);
    try {
      await act(page);
      await page.settle();
      assert.equal(boardOf(page).all('path', 'ws-link').length, 0);
      const read = (await good.send({ path: `/api/projects/${space.name}/workshop`, headers: owner() })).json;
      assert.deepEqual(read.links, []);
    } finally {
      page.close();
    }
    await runCases('removeNoteLink', 'DELETE', path, cases, act);
  });

  test('every response API-291 lists leads 스텝 N 확정 to the state SCR-145 gives', async () => {
    const path = (space) => `/api/projects/${space.name}/workshop/steps/0/confirm`;
    const make = (fields = {}) => (space) => requestOf(space, { path: path(space), body: {}, ...fields })();
    const cases = casesOf('confirmStep', [
      { status: 200, done: true },
      { status: 400, code: 'invalid_request', request: make({ body: { step: '0' } }), shows: byField('invalid_request') },
      ...shared((fields) => make(fields), { input: byField }),
      { status: 404, code: 'step_not_found', request: async (space) => ({ ...(await make()(space)), path: path(space).replace('/steps/0/', '/steps/10/') }), shows: goneNoteShows('step_not_found') },
      { status: 409, code: 'step_empty', request: async (space) => ({ ...(await make()(space)), path: path(space).replace('/steps/0/', '/steps/2/') }), shows: byField('step_empty') },
      { status: 409, code: 'workshop_closed', request: async (space) => ({ ...(await make()(space)), path: `/api/projects/${(await board({ open: false })).name}/workshop/steps/0/confirm` }), shows: staleShows },
      { status: 413, code: 'body_too_large', request: async (space) => ({ ...(await make()(space)), body: JSON.stringify({ pad: 'x'.repeat(2 * 1024 * 1024) }) }), shows: byField('body_too_large') },
      { status: 415, code: 'json_required', request: async (space) => ({ ...(await make()(space)), headers: { ...owner(), ...key(), 'Content-Type': 'text/plain' } }), shows: inNotice('json_required', ['다시 시도']) },
    ]);
    const act = async (page) => buttonNamed(panelOf(page), '스텝 0 확정').click();
    const space = await board();
    const page = await openOn(good, space.name);
    try {
      await act(page);
      await page.settle();
      assert.deepEqual(sectionNamed(page, '스텝 0 · 준비').all('span', 'tag').map((tag) => tag.textContent), ['확정함']);
      const read = (await good.send({ path: `/api/projects/${space.name}/workshop`, headers: owner() })).json;
      assert.notEqual(read.steps[0].confirmed_at, null);
    } finally {
      page.close();
    }
    await runCases('confirmStep', 'POST', path, cases, act);
  });

  test('every response API-292 lists leads Miro에서 가져오기 to the state SCR-145 gives', async () => {
    const path = (space) => `/api/projects/${space.name}/workshop/imports`;
    const sticky = (id, content, x = 0) => ({ id, type: 'sticky_note', data: { content: `<p>${content}</p>` }, style: { fillColor: 'orange' }, position: { x, y: 0 } });
    const file = JSON.stringify({ data: [sticky('3458764500000000001', 'Imported one'), sticky('3458764500000000002', 'Imported two', 200)] });
    const make = (fields = {}) => (space) => requestOf(space, { path: path(space), body: JSON.parse(file), ...fields })();
    const cases = casesOf('importMiroBoard', [
      { status: 201, done: true },
      { status: 400, code: 'invalid_request', request: make({ body: { items: [] } }), shows: inBar('invalid_request') },
      { status: 400, code: 'text_too_long', request: make({ body: { data: [sticky('1', 'x'.repeat(201))] } }), shows: inBar('text_too_long') },
      ...shared((fields) => make(fields), { input: inBar }),
      { status: 409, code: 'workshop_closed', request: async () => make()(await board({ open: false })), shows: staleShows },
      {
        status: 413, code: 'body_too_large',
        request: async (space) => ({ ...(await make()(space)), body: JSON.stringify({ data: [], pad: 'x'.repeat(5 * 1024 * 1024) }) }),
        shows: inBar('body_too_large'),
      },
      { status: 415, code: 'json_required', request: async (space) => ({ ...(await make()(space)), headers: { ...owner(), ...key(), 'Content-Type': 'text/plain' } }), shows: inNotice('json_required', ['다시 시도']) },
    ]);
    const act = async (page) => {
      const input = page.app.all('div', 'title')[0].all('input')[0];
      input.files = [{ size: file.length, text: async () => file }];
      input.dispatch('change');
    };
    const space = await board();
    const page = await openOn(good, space.name);
    try {
      await act(page);
      await page.settle();
      assert.deepEqual(page.app.all('div', 'ws-bar')[0].all('b').map((b) => b.textContent), [importedWords(2, 0)]);
      // Read again: the notes are on the board, in step 1, the step of the event kind.
      await chooseStep(page, '1');
      assert.deepEqual(boardOf(page).all('button', 'stk').map((button) => button.all('b')[0].textContent), ['Imported one', 'Imported two']);
    } finally {
      page.close();
    }
    await runCases('importMiroBoard', 'POST', path, cases, act);
  });
});
