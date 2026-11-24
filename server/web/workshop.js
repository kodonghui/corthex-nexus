// SCR-145's workshop (TASK-462; SPEC-036 to SPEC-041, SPEC-051; API-284 to API-292): stage-01 event storming on the
// stage workbench. screens.js runs it in the shell:
// - With the project's workshop open (API-262's project.workshop), stage 01 without ?d= or ?thread= shows the workshop:
//   the shell reads it (API-285) in place of a diagram, and this module draws the board and its panel. The drawn DDD
//   board stays reachable: its diagrams stay in the stage's list, after the entry 워크숍, and ?d= or ?thread= opens one
//   with its threads and proposals (workbench.js).
// - With no workshop open, stage 01 offers 워크숍 열기 on a PC (API-284). It asks once first, since nothing on the
//   screen closes an unfinished workshop: it stays open until every step is confirmed and written (TASK-452).
// - The step strip chooses a step. The board shows its frame and the next step's, each sticky note where it was put,
//   coloured by its kind's design token (--corthex-sticky-<kind>; the kind note is uncoloured), with the links between
//   two notes of a frame drawn as arrows.
// - On a PC the owner adds a note (API-286), moves it by dragging or by the arrow keys, renames it (API-287), removes it
//   (API-288), links two notes (API-289) and removes a link (API-290), confirms the chosen step (API-291), and imports
//   a Miro board export (API-292), whose file goes up as it is, unread by the page.
// - On a phone (SPEC-051) the board is read-only, with the mockup's note: no adding, moving, renaming, linking, step
//   confirmation or import, and no panel.
//
// The rules the coordinator chose for TASK-462, which wait for the maintainer's delegate, are in the server README's
// "Workshop board" section. The module keeps, for the shell it runs in, the chosen step and note, the moves not yet
// answered, the forms' text and what the last writes answered. The forms' unsent text goes into this tab's storage
// only when the page goes through the gate (SPEC-048).

import { projectApi, stageHref } from './address.js';
import { newRequestKey } from './api.js';
import { fill, h, s } from './dom.js';
import { headOf, PAD, pathOf, WORDS } from './picture.js';
import { straight } from './relayout.js';

export const DOMAIN_STAGE = '01-domain';
// The contract's Step, in event storming's order. Step 1 is the mockup's "1-a".
export const STEPS = Object.freeze(['0', '1', '1-b', '2', '3', '4', '5', '6', '7', '8', '9']);
// Each step's label and name, as the mockup's step strip writes them.
const STEP_WORDS = Object.freeze({
  0: ['0', '준비'],
  1: ['1-a', '이벤트'],
  '1-b': ['1-b', '타임라인'],
  2: ['2', '외부 시스템'],
  3: ['3', '명령'],
  4: ['4', '핫스팟'],
  5: ['5', '액터'],
  6: ['6', '애그리거트'],
  7: ['7', '경계 컨텍스트'],
  8: ['8', '정책·읽기 모델·컨텍스트 맵'],
  9: ['9', '컨텍스트 표'],
});
// The kinds a note is added in: the design tokens' sticky names (TASK-453), in the legend's order and then actor and
// external system, which steps 5 and 2 start with.
export const KINDS = Object.freeze(['event', 'command', 'aggregate', 'policy', 'read-model', 'hotspot', 'actor', 'external-system']);
// The words of each kind on its note: the legend's, the step strip's for actor and external system, and 기타 for note,
// the kind of a Miro note whose colour names no kind.
export const KIND_WORDS = Object.freeze({
  event: '이벤트',
  command: '명령',
  aggregate: '애그리거트',
  policy: '정책',
  'read-model': '읽기 모델',
  hotspot: '핫스팟',
  actor: '액터',
  'external-system': '외부 시스템',
  note: '기타',
});
// The kind a new note starts as: the one that introduces the chosen step (as TASK-453's import places them), and
// otherwise event.
const STEP_KINDS = Object.freeze({ 1: 'event', 2: 'external-system', 3: 'command', 4: 'hotspot', 5: 'actor', 6: 'aggregate', 8: 'policy' });
const CONFIDENCE_WORDS = Object.freeze({ certain: '확실', inferred: '추론', guess: '추측' });
const LEGEND = Object.freeze([
  ['event', '이벤트: 일어난 일'],
  ['command', '명령: 누군가 하려는 일'],
  ['aggregate', '애그리거트: 규칙을 함께 지키는 단위'],
  ['policy', '정책: "~하면 ~한다" 규칙'],
  ['read-model', '읽기 모델: 판단할 때 보는 정보'],
  ['hotspot', '핫스팟: 아직 정하지 못한 문제'],
]);

export const WORKSHOP_WORDS = Object.freeze({
  workshop: '워크숍',
  open: '열림',
  source: '워크숍이 열려 있는 동안은 이 보드가 원본이에요.',
  step3: '이벤트를 일으키는 명령을 왼쪽에 더해요.',
  add: '스티커 더하기',
  import: 'Miro에서 가져오기',
  strip: '워크숍 스텝',
  before: '확정 전',
  empty: '비어 있음',
  confirmed: '확정함',
  confirmNote: '확정하면 에이전트가 이 스텝을 도메인 문서에 써요.',
  selected: '고른 스티커',
  name: '이름',
  kind: '종류',
  addButton: '더하기',
  cancel: '취소',
  remove: '이 스티커 떼기',
  link: '잇기',
  linkAsk: '이을 스티커를 고르세요.',
  linked: '이어진 스티커',
  unlink: '연결 떼기',
  phone: '휴대폰에서는 보드를 읽기만 해요. 스티커와 스텝 확정은 PC에서 하세요.',
  confidence: '확실·추론·추측: AI가 단 근거의 정도',
  openWorkshop: '워크숍 열기',
  openAsk: '워크숍을 열까요? 11개 스텝을 모두 확정하고 에이전트가 도메인 문서에 쓸 때까지 열려 있어요.',
});

// A step's label and name, as the title, the frame and the panel say it: "3 명령", "스텝 3 · 명령".
export const stepTitle = (step) => `${WORKSHOP_WORDS.workshop} · 스텝 ${STEP_WORDS[step].join(' ')}`;
export const frameTitle = (step) => `스텝 ${STEP_WORDS[step][0]} · ${STEP_WORDS[step][1]}`;
export const confirmWords = (step) => `스텝 ${STEP_WORDS[step][0]} 확정`;
export const countWords = (notes, drafts) => `스티커 ${notes}개 · AI 초안 ${drafts}개`;
export const importedWords = (notes, links) => `스티커 ${notes}개와 연결 ${links}개를 가져왔어요.`;

// A note's size, as the mockup draws it, and TASK-452's grid, where the first free place takes a new note.
export const NOTE = Object.freeze({ width: 148, height: 80 });
export const GRID = Object.freeze({ columns: 5, x: 160, y: 120 });
// A frame is at least the mockup's board wide and its step-3 frame high, with room round its notes.
const FRAME = Object.freeze({ width: 972, height: 216, margin: 16 });
// Moves as TASK-458's: 8 pixels a step and 40 with Shift, a drag from 3 pixels, sent once they stop for 400 ms.
export const STEP = 8;
export const LONG_STEP = 40;
export const SEND_AFTER_MS = 400;
const DRAG_FROM = 3;
// A place's bound in the contract, and the size of a Miro export it takes (API-292).
const PLACE_LIMIT = 1_000_000;
export const MIRO_BYTES = 5 * 1024 * 1024;
const ARROWS = Object.freeze({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] });

export const workshopApi = (project) => `${projectApi(project)}/workshop`;

// Whether the address shows the workshop: stage 01 of a part the project has, with no ?d= or ?thread=, while the
// project's workshop is open. data is what the shell read first (API-262).
export function workshopShown({ address, data }) {
  return address.stage === DOMAIN_STAGE && address.diagram === null && address.thread === null
    && data.project?.workshop?.state === 'open'
    && (data.project.stages ?? []).some((row) => row.stage === address.stage && row.part === address.part);
}

// The read that follows API-262 when the workshop shows: API-285.
export const workshopRead = ({ address }) => ({ workshop: workshopApi(address.project) });

// Whether the workshop's board is drawn: it shows, and API-285 answered it open.
export const workshopMode = (ctx) => workshopShown(ctx) && ctx.data.workshop?.state === 'open';

// The entry 워크숍 at the head of the stage's list of diagrams, on stage 01 while the workshop is open: { text, href }.
export function workshopEntry({ address, data }) {
  if (address.stage !== DOMAIN_STAGE || data.project?.workshop?.state !== 'open') return null;
  return { text: WORKSHOP_WORDS.workshop, href: stageHref(address.project, address.part, address.stage) };
}

// The view of the workshop, built once for its title, description, tag, buttons, body and panel.
const built = new WeakMap();
// The workshop's own state, by the shell it runs in.
const states = new WeakMap();

export function workshopView(ctx) {
  if (!built.has(ctx)) built.set(ctx, build(ctx));
  return built.get(ctx);
}

// What the workshop's place shows when API-285 answered no open workshop, as when it closed between the two reads:
// the stale bar with its reload, and the stage's diagrams.
export function workshopMissing(ctx) {
  return [ctx.shell.staleBar({ text: ctx.shell.message('workshop_closed') }), diagramList(ctx)];
}

function stateFor(ctx) {
  const { shell, address } = ctx;
  let state = states.get(shell);
  if (state !== undefined) return state;
  state = {
    ctx,
    workshop: null,
    step: null,
    selected: null,
    moves: new Map(),
    pending: new Set(),
    sending: new Set(),
    again: new Set(),
    timer: null,
    drags: new WeakMap(),
    nodes: new Map(),
    linking: false,
    adding: null,
    rename: null,
    errors: {},
    busy: new Set(),
    keys: new Map(),
    imported: null,
    focus: null,
    notice: h('div', { class: 'wb-notice' }),
    opening: { asking: false, error: null, box: null, ctx: null },
    drafts: { add: `workshop:${address.project}:add`, name: `workshop:${address.project}:name` },
  };
  states.set(shell, state);
  // Unsent text that came back through the gate: the new note's name, and a rename with its note.
  const add = shell.draftOf(state.drafts.add);
  if (add !== '') state.adding = { kind: null, text: add };
  const name = shell.draftOf(state.drafts.name);
  const space = name.indexOf(' ');
  if (space > 0) {
    state.selected = name.slice(0, space);
    state.rename = { note: state.selected, text: name.slice(space + 1) };
  }
  shell.onLeave(() => {
    shell.keepDraft(state.drafts.add, state.adding?.text ?? '');
    shell.keepDraft(state.drafts.name, state.rename === null ? '' : `${state.rename.note} ${state.rename.text}`);
  });
  globalThis.document?.addEventListener?.('keydown', (event) => {
    if (event.key === 'Escape' && state.linking) stopLinking(state);
  });
  return state;
}

function build(ctx) {
  const state = stateFor(ctx);
  const workshop = ctx.data.workshop;
  // Another workshop than the one drawn before: its first step not confirmed, and no move or link of the one before.
  if (state.workshop !== workshop.id) Object.assign(state, { workshop: workshop.id, step: null, moves: new Map(), linking: false });
  state.ctx = ctx;
  state.phone = ctx.shell.isPhone();
  if (state.selected !== null && noteOf(workshop, state.selected) === null) {
    state.selected = null;
    state.linking = false;
  }
  if (state.rename !== null && state.rename.note !== state.selected) state.rename = null;
  for (const id of state.moves.keys()) if (noteOf(workshop, id) === null) state.moves.delete(id);
  if (state.step === null) state.step = firstOpen(workshop);
  if (state.adding !== null && state.adding.kind === null) state.adding.kind = kindFor(state.step);
  state.strip = h('nav', { class: 'steps', 'aria-label': WORKSHOP_WORDS.strip });
  state.bar = h('div', { class: 'ws-bar' });
  state.board = h('div', { class: 'boardbox ws-board' });
  state.panel = h('div', { class: 'ws-panel' });
  draw(state);
  return {
    title: stepTitle(state.step),
    description: state.step === '3' ? `${WORKSHOP_WORDS.step3} ${WORKSHOP_WORDS.source}` : WORKSHOP_WORDS.source,
    tags: [h('span', { class: 'tag green' }, WORKSHOP_WORDS.open)],
    actions: state.phone ? [] : actionsOf(state),
    body: [
      state.notice,
      diagramList(ctx),
      state.strip,
      state.phone ? h('div', { class: 'nt info', role: 'status' }, h('div', { class: 'b' }, h('b', {}, WORKSHOP_WORDS.phone))) : null,
      state.bar,
      state.board,
      legend(),
    ],
    panel: state.phone ? [] : [state.panel],
  };
}

// The first step not confirmed, or step 0: a workshop just opened starts at step 0.
function firstOpen(workshop) {
  return (workshop.steps ?? []).find((row) => row.confirmed_at === null)?.step ?? '0';
}

const kindFor = (step) => STEP_KINDS[step] ?? 'event';
const stepRow = (workshop, step) => (workshop.steps ?? []).find((row) => row.step === step) ?? null;

function noteOf(workshop, id) {
  for (const row of workshop.steps ?? []) {
    const note = row.notes.find((each) => each.id === id);
    if (note !== undefined) return note;
  }
  return null;
}

// Draws what a change of the state touches: the strip, the bar, the board and the panel; the title and the text under
// it change only with the step, which the shell draws again (choose).
function draw(state) {
  drawStrip(state);
  drawBar(state);
  drawBoard(state);
  drawPanel(state);
  focusAfter(state);
}

// Gives the focus back to the element the state names, once it is in the page.
function focusAfter(state) {
  const id = state.focus;
  state.focus = null;
  if (id === null) return;
  const find = () => globalThis.document?.getElementById?.(id) ?? null;
  const node = find();
  if (node !== null) node.focus();
  else queueMicrotask(() => find()?.focus());
}

// The stage's diagrams after the entry 워크숍, which is shown; each opens with ?d= in this page, as TASK-458's list.
function diagramList(ctx) {
  const { address, shell, data } = ctx;
  const row = (data.project.stages ?? []).find((each) => each.stage === address.stage && each.part === address.part);
  const diagrams = row?.diagrams ?? [];
  if (diagrams.length === 0) return null;
  const here = stageHref(address.project, address.part, address.stage);
  return h('nav', { class: 'steps', 'aria-label': `이 단계의 그림 ${diagrams.length}개` },
    h('a', { class: 'step on', href: here, 'aria-current': 'page' }, WORKSHOP_WORDS.workshop),
    diagrams.map((diagram) => {
      const href = stageHref(address.project, address.part, address.stage, { diagram: diagram.id });
      return h('a', {
        class: 'step',
        href,
        on: {
          click: (event) => {
            if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || (event.button !== undefined && event.button !== 0)) return;
            event.preventDefault();
            shell.go(href);
          },
        },
      }, diagram.name, diagram.removed ? h('span', { class: 'tag gray' }, WORDS.removed) : null);
    }));
}

// The step strip: the 11 steps, ✓ when confirmed, the chosen one marked.
function drawStrip(state) {
  const workshop = state.ctx.data.workshop;
  fill(state.strip, STEPS.map((step) => {
    const on = step === state.step;
    const done = stepRow(workshop, step)?.confirmed_at != null;
    return h('button', {
      type: 'button',
      id: `ws-step-${step}`,
      class: ['step', done ? 'done' : null, on ? 'on' : null].filter(Boolean).join(' '),
      'aria-current': on ? 'step' : null,
      on: { click: () => choose(state, step) },
    }, STEP_WORDS[step].join(' '));
  }));
}

// Chooses a step: the title, the text under it and the board change, so the shell draws the view again.
function choose(state, step) {
  if (state.step === step) return;
  state.step = step;
  if (state.adding !== null && state.adding.text === '') state.adding.kind = kindFor(step);
  delete state.errors.confirm;
  state.focus = `ws-step-${step}`;
  state.ctx.shell.redraw();
}

// The line over the board: choosing the link's end, what an import brought, or why an import was refused.
function drawBar(state) {
  const { shell } = state.ctx;
  const refused = state.errors.import ?? null;
  fill(state.bar,
    state.linking ? h('div', { class: 'nt info', role: 'status' },
      h('div', { class: 'b' }, h('b', {}, WORKSHOP_WORDS.linkAsk)),
      h('button', { type: 'button', class: 'btn tertiary sm', on: { click: () => stopLinking(state) } }, WORKSHOP_WORDS.cancel)) : null,
    state.imported === null ? null : h('div', { class: 'nt ok', role: 'status' },
      h('div', { class: 'b' }, h('b', {}, importedWords(state.imported.notes, state.imported.links)))),
    refused === null ? null : h('div', { class: 'nt err', role: 'alert' },
      h('div', { class: 'b' }, h('b', {}, shell.message(refused.code)))));
}

// The chosen step's frame and the next step's.
function drawBoard(state) {
  state.nodes = new Map();
  const at = STEPS.indexOf(state.step);
  const shown = [state.step, STEPS[at + 1]].filter((step) => step !== undefined);
  fill(state.board, shown.map((step, index) => frameOf(state, step, index > 0)));
}

function stepTag(row) {
  if (row?.confirmed_at != null) return h('span', { class: 'tag green' }, WORKSHOP_WORDS.confirmed);
  return h('span', { class: 'tag gray' }, (row?.notes ?? []).length === 0 ? WORKSHOP_WORDS.empty : WORKSHOP_WORDS.before);
}

function frameOf(state, step, next) {
  const row = stepRow(state.ctx.data.workshop, step);
  const notes = row?.notes ?? [];
  const head = h('div', { class: next ? 'frame-h next' : 'frame-h' }, h('span', {}, frameTitle(step)), stepTag(row));
  if (notes.length === 0) return [head, h('div', { class: 'frame-empty' }, state.ctx.shell.message('step_empty'))];
  return [head, frameSvg(state, step, notes)];
}

// Where a note is drawn: where it was moved to and not yet answered, or where it is.
function placeOf(state, note) {
  return state.moves.get(note.id) ?? { x: note.x, y: note.y };
}

// A frame as SVG: each note an HTML button in a foreignObject, as TASK-458's boards, so its text wraps and it is
// chosen by pointer or keyboard; each link of two notes of the frame a path with its head. A moved note is painted
// over the others.
function frameSvg(state, step, notes) {
  const boxes = new Map(notes.map((note) => [note.id, { ...placeOf(state, note), width: NOTE.width, height: NOTE.height }]));
  const all = [...boxes.values()];
  const left = Math.min(0, ...all.map((box) => box.x));
  const top = Math.min(0, ...all.map((box) => box.y));
  const right = Math.max(...all.map((box) => box.x + box.width));
  const bottom = Math.max(...all.map((box) => box.y + box.height));
  const width = Math.max(FRAME.width, right - left + 2 * FRAME.margin);
  const height = Math.max(FRAME.height, bottom - top + 2 * FRAME.margin);
  const lines = [];
  for (const link of state.ctx.data.workshop.links ?? []) {
    const from = boxes.get(link.from);
    const to = boxes.get(link.to);
    if (from === undefined || to === undefined) continue;
    const points = straight(from, to);
    lines.push(s('path', { class: 'ws-link', d: pathOf(points) }), s('path', { class: 'ws-head', d: headOf(points) }));
  }
  const still = [];
  const moved = [];
  for (const note of notes) (state.moves.has(note.id) ? moved : still).push(boxed(boxes.get(note.id), noteNode(state, note)));
  const svg = s('svg', {
    class: 'pic ws-frame', width, height, viewBox: `${left - FRAME.margin} ${top - FRAME.margin} ${width} ${height}`,
  }, lines, still, moved);
  return h('div', { class: 'pic-wrap', role: 'group', 'aria-label': `스텝 ${STEP_WORDS[step][0]} 프레임` }, svg);
}

function boxed(box, child) {
  return s('foreignObject', { x: box.x - PAD, y: box.y - PAD, width: box.width + 2 * PAD, height: box.height + 2 * PAD }, h('div', { class: 'fo' }, child));
}

// A note: its kind and confidence label as the mockup's cap, and its text. A kind no token colours shows uncoloured
// with its own text as its cap. On a phone it is not a button: tapping it does nothing (SPEC-051).
function noteNode(state, note) {
  const known = Object.hasOwn(KIND_WORDS, note.kind);
  const className = `stk k-${known ? note.kind : 'note'}`;
  const confidence = note.confidence === null || note.confidence === undefined ? null
    : h('span', { class: 'conf' }, CONFIDENCE_WORDS[note.confidence] ?? note.confidence);
  const content = [
    h('span', { class: 'cap' }, h('span', { class: 'cw' }, known ? KIND_WORDS[note.kind] : note.kind), confidence),
    h('b', { class: 'nm' }, note.text),
  ];
  if (state.phone) return h('div', { class: className }, content);
  const on = state.selected === note.id;
  const button = h('button', {
    type: 'button',
    id: `ws-note-${note.id}`,
    class: on ? `${className} sel` : className,
    'aria-pressed': on ? 'true' : 'false',
    on: {
      click: () => clicked(state, note.id),
      keydown: (event) => keydown(state, note.id, event),
      pointerdown: (event) => pointerdown(state, note.id, event),
    },
  }, content);
  state.nodes.set(note.id, button);
  return button;
}

function legend() {
  return h('div', { class: 'legend' },
    LEGEND.map(([kind, text]) => h('span', {}, h('span', { class: `sw k-${kind}`, 'aria-hidden': 'true' }), text)),
    h('span', {}, WORKSHOP_WORDS.confidence));
}

// The title's buttons on a PC: 스티커 더하기, and Miro에서 가져오기 with its file chooser.
function actionsOf(state) {
  const input = h('input', { type: 'file', accept: '.json,application/json', hidden: true, on: { change: () => chosen(state, input) } });
  state.importButton = h('button', {
    type: 'button', class: 'btn tertiary', 'aria-disabled': busyOf(state, 'import'),
    on: { click: () => { if (!state.busy.has('import')) input.click(); } },
  }, WORKSHOP_WORDS.import);
  return [
    h('button', { type: 'button', class: 'btn tertiary', on: { click: () => startAdding(state) } }, WORKSHOP_WORDS.add),
    state.importButton,
    input,
  ];
}

const busyOf = (state, name) => (state.busy.has(name) ? 'true' : null);

// The panel: the chosen step with its confirmation, the form of a new note, and the chosen note.
function drawPanel(state) {
  if (state.phone) return;
  fill(state.panel, stepSection(state), state.adding === null ? null : addSection(state), selectedSection(state));
}

function stepSection(state) {
  const { shell } = state.ctx;
  const row = stepRow(state.ctx.data.workshop, state.step);
  const notes = row?.notes ?? [];
  const confirmed = row?.confirmed_at != null;
  const refused = state.errors.confirm?.step === state.step ? state.errors.confirm.code : null;
  const off = notes.length === 0 || state.busy.has(`confirm:${state.step}`);
  return h('section', { class: 'panel', 'aria-labelledby': 'ws-step-h' },
    h('div', { class: 'ph' }, h('h2', { id: 'ws-step-h' }, frameTitle(state.step)), stepTag(row)),
    h('p', {}, countWords(notes.length, notes.filter((note) => note.made_by === 'agent').length)),
    confirmed ? null : h('p', { class: 'small' }, WORKSHOP_WORDS.confirmNote),
    confirmed ? null : h('button', {
      type: 'button', id: 'ws-confirm', class: 'btn primary wide', 'aria-disabled': off ? 'true' : null,
      'aria-describedby': refused === null ? null : 'ws-confirm-refused',
      on: { click: () => { if (!off) confirmStep(state, state.step); } },
    }, confirmWords(state.step)),
    refused === null ? null : h('p', { class: 'err-text', id: 'ws-confirm-refused', role: 'alert' }, shell.message(refused)));
}

function startAdding(state) {
  if (state.adding === null) state.adding = { kind: kindFor(state.step), text: '' };
  state.focus = 'ws-add-text';
  draw(state);
}

function addSection(state) {
  const { shell } = state.ctx;
  const { adding } = state;
  const refused = state.errors.add ?? null;
  const sending = state.busy.has('add');
  const go = h('button', {
    type: 'button', class: 'btn primary sm', 'aria-disabled': sending || !/\S/u.test(adding.text) ? 'true' : null,
    on: { click: () => addNote(state) },
  }, WORKSHOP_WORDS.addButton);
  const kind = h('select', {
    id: 'ws-add-kind', class: 'field',
    on: { change: () => { adding.kind = kind.value; } },
  }, KINDS.map((each) => h('option', { value: each, selected: each === adding.kind }, KIND_WORDS[each])));
  kind.value = adding.kind;
  const text = h('input', {
    id: 'ws-add-text', class: refused === null ? 'field' : 'field bad', maxlength: 200, autocomplete: 'off',
    'aria-invalid': refused === null ? null : 'true', 'aria-describedby': refused === null ? null : 'ws-add-refused',
    on: {
      input: () => {
        adding.text = text.value ?? '';
        if (!sending) go.setAttribute('aria-disabled', /\S/u.test(adding.text) ? 'false' : 'true');
      },
      keydown: (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          addNote(state);
        } else if (event.key === 'Escape') {
          stopAdding(state);
        }
      },
    },
  });
  text.value = adding.text;
  return h('section', { class: 'panel', 'aria-labelledby': 'ws-add-h' },
    h('h2', { id: 'ws-add-h' }, WORKSHOP_WORDS.add),
    h('div', {}, h('label', { class: 'l', for: 'ws-add-kind' }, WORKSHOP_WORDS.kind), kind),
    h('div', {}, h('label', { class: 'l', for: 'ws-add-text' }, WORKSHOP_WORDS.name), text,
      refused === null ? null : h('p', { class: 'err-text', id: 'ws-add-refused', role: 'alert' }, shell.message(refused.code))),
    h('div', { class: 'btns' }, go,
      h('button', { type: 'button', class: 'btn tertiary sm', on: { click: () => stopAdding(state) } }, WORKSHOP_WORDS.cancel)));
}

function stopAdding(state) {
  state.adding = null;
  delete state.errors.add;
  state.ctx.shell.keepDraft(state.drafts.add, '');
  draw(state);
}

function selectedSection(state) {
  const workshop = state.ctx.data.workshop;
  const note = state.selected === null ? null : noteOf(workshop, state.selected);
  if (note === null) return null;
  const { shell } = state.ctx;
  const refused = state.errors.name?.note === note.id ? state.errors.name.code : null;
  const message = refused === null ? null : h('p', { class: 'err-text', id: 'ws-name-refused', role: 'alert' }, shell.message(refused));
  const field = h('input', {
    id: 'ws-name', class: refused === null ? 'field' : 'field bad', maxlength: 200, autocomplete: 'off',
    'aria-invalid': refused === null ? null : 'true', 'aria-describedby': refused === null ? null : 'ws-name-refused',
    on: {
      input: () => {
        state.rename = { note: note.id, text: field.value ?? '' };
      },
      keydown: (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          rename(state, note.id, field.value ?? '');
        } else if (event.key === 'Escape') {
          putBack(state, field, note, message);
        }
      },
      // Leaving the field without Enter puts the name back and sends nothing. A field the panel drew again in its
      // place is no longer in the page; its blur changes nothing.
      blur: () => {
        if (field.isConnected !== false && !state.busy.has(`name:${note.id}`)) putBack(state, field, note, message);
      },
    },
  });
  field.value = state.rename?.note === note.id ? state.rename.text : note.text;
  const links = (workshop.links ?? []).filter((link) => link.from === note.id || link.to === note.id);
  return h('section', { class: 'panel', 'aria-labelledby': 'ws-note-h' },
    h('h2', { id: 'ws-note-h' }, WORKSHOP_WORDS.selected),
    h('div', {}, h('label', { class: 'l', for: 'ws-name' }, WORKSHOP_WORDS.name), field, message),
    h('div', { class: 'btns' },
      h('button', {
        type: 'button', id: 'ws-link', class: 'btn tertiary sm', 'aria-pressed': state.linking ? 'true' : 'false',
        on: { click: () => (state.linking ? stopLinking(state) : startLinking(state)) },
      }, WORKSHOP_WORDS.link),
      h('button', {
        type: 'button', class: 'btn danger-ghost sm', 'aria-disabled': busyOf(state, `remove:${note.id}`),
        on: { click: () => removeNote(state, note.id) },
      }, WORKSHOP_WORDS.remove)),
    links.length === 0 ? null : [
      h('h3', {}, WORKSHOP_WORDS.linked),
      h('ul', { class: 'chg' }, links.map((link) => {
        const outgoing = link.from === note.id;
        const other = noteOf(workshop, outgoing ? link.to : link.from);
        return h('li', {},
          h('span', { class: 'grow' }, `${outgoing ? '→' : '←'} ${other?.text ?? ''}`),
          h('button', {
            type: 'button', class: 'btn ghost sm', 'aria-disabled': busyOf(state, `unlink:${link.id}`),
            on: { click: () => unlink(state, link.id) },
          }, WORKSHOP_WORDS.unlink));
      })),
    ]);
}

// The name back as it is, with nothing sent (TASK-462's question 8).
function putBack(state, field, note, message) {
  field.value = note.text;
  if (state.rename?.note === note.id) state.rename = null;
  if (state.errors.name?.note === note.id) delete state.errors.name;
  if (message !== null) message.hidden = true;
  field.setAttribute('class', 'field');
  field.removeAttribute('aria-invalid');
  state.ctx.shell.keepDraft(state.drafts.name, '');
}

function clicked(state, id) {
  if (state.linking) {
    if (state.selected !== null && state.selected !== id) connect(state, state.selected, id);
    return;
  }
  if (state.selected === id) return;
  state.selected = id;
  state.rename = null;
  delete state.errors.name;
  state.focus = `ws-note-${id}`;
  draw(state);
}

function startLinking(state) {
  state.linking = true;
  state.focus = 'ws-link';
  draw(state);
}

function stopLinking(state) {
  if (!state.linking) return;
  state.linking = false;
  state.focus = state.selected === null ? null : `ws-note-${state.selected}`;
  draw(state);
}

function keydown(state, id, event) {
  if (event.key === 'Escape') {
    stopLinking(state);
    return;
  }
  const way = ARROWS[event.key];
  const note = noteOf(state.ctx.data.workshop, id);
  if (way === undefined || note === null || state.phone) return;
  event.preventDefault();
  const step = event.shiftKey ? LONG_STEP : STEP;
  const at = placeOf(state, note);
  moveTo(state, id, { x: at.x + way[0] * step, y: at.y + way[1] * step });
}

// A drag: the note follows the pointer, and the move is taken once it is let go 3 pixels or more from where it
// started, as TASK-458's.
function pointerdown(state, id, event) {
  const note = noteOf(state.ctx.data.workshop, id);
  if ((event.button !== undefined && event.button !== 0) || note === null || state.phone || state.linking) return;
  const node = state.nodes.get(id);
  const holder = node?.parentNode?.parentNode;
  if (!node || !holder) return;
  const at = placeOf(state, note);
  const drag = { id, start: { x: event.clientX, y: event.clientY }, at, holder, moved: false, to: at };
  if (!state.drags.has(node)) {
    node.addEventListener('pointermove', (move) => dragged(state.drags.get(node), move));
    node.addEventListener('pointerup', (up) => dropped(state, node, up));
    node.addEventListener('pointercancel', () => cancelled(state, node));
  }
  state.drags.set(node, drag);
  node.setPointerCapture?.(event.pointerId);
}

function dragged(drag, event) {
  if (drag === undefined) return;
  const dx = event.clientX - drag.start.x;
  const dy = event.clientY - drag.start.y;
  if (!drag.moved && Math.hypot(dx, dy) < DRAG_FROM) return;
  drag.moved = true;
  drag.to = bounded({ x: Math.round(drag.at.x + dx), y: Math.round(drag.at.y + dy) });
  drag.holder.setAttribute('x', drag.to.x - PAD);
  drag.holder.setAttribute('y', drag.to.y - PAD);
}

function cancelled(state, node) {
  const drag = state.drags.get(node);
  state.drags.delete(node);
  if (drag === undefined || !drag.moved) return;
  drag.holder.setAttribute('x', drag.at.x - PAD);
  drag.holder.setAttribute('y', drag.at.y - PAD);
}

function dropped(state, node, event) {
  const drag = state.drags.get(node);
  state.drags.delete(node);
  if (drag === undefined) return;
  dragged(drag, event);
  if (drag.moved) moveTo(state, drag.id, drag.to);
}

// A place kept within the frame's top-left corner and the contract's bound.
function bounded({ x, y }) {
  const limit = (value) => Math.min(PLACE_LIMIT, Math.max(0, value));
  return { x: limit(x), y: limit(y) };
}

// Puts a note at a place: chosen, drawn there with its links, and sent once the moves stop.
function moveTo(state, id, to) {
  if (state.selected !== id) {
    state.selected = id;
    state.rename = null;
  }
  state.moves.set(id, bounded(to));
  state.focus = `ws-note-${id}`;
  draw(state);
  state.pending.add(id);
  clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    for (const each of [...state.pending]) {
      state.pending.delete(each);
      sendMove(state, each);
    }
  }, SEND_AFTER_MS);
}

// Sends a note's last place (API-287). A move made while one is sent goes after its answer.
async function sendMove(state, id) {
  if (state.sending.has(id)) {
    state.again.add(id);
    return;
  }
  const at = state.moves.get(id);
  if (at === undefined) return;
  state.sending.add(id);
  const answer = await send(state, `move:${id}`, 'PATCH', notePath(state, id), { x: at.x, y: at.y });
  state.sending.delete(id);
  if (answer.status === 200) {
    putNote(state, answer.body);
    const now = state.moves.get(id);
    if (now !== undefined && now.x === at.x && now.y === at.y) state.moves.delete(id);
    clearNotice(state);
  } else {
    state.again.delete(id);
    // A refused move puts the note back where it is, unless the failure keeps it for 다시 시도.
    const retry = answer.failure === 'timeout' || answer.failure === 'network';
    if (!retry) {
      state.moves.delete(id);
      draw(state);
    }
    refused(state, answer, { retry: () => sendMove(state, id) });
    return;
  }
  if (state.again.delete(id)) sendMove(state, id);
}

const notePath = (state, id) => `${workshopApi(state.ctx.address.project)}/notes/${encodeURIComponent(id)}`;

// A write of the owner's, with a request key: the one kept for the same action and body after a timeout or a lost
// connection, so that a retry that reaches a write that went through gets its first answer, and otherwise a new one.
async function send(state, name, method, path, body, { raw = false } = {}) {
  const signature = raw ? body : JSON.stringify(body);
  const kept = state.keys.get(name);
  const key = kept !== undefined && kept.signature === signature ? kept.key : newRequestKey();
  state.keys.set(name, { signature, key });
  const answer = await state.ctx.shell.write(method, path, body, key, { raw });
  if (answer.failure !== 'timeout' && answer.failure !== 'network') state.keys.delete(name);
  return answer;
}

// What a write's answer that is no success shows, by SCR-145's states:
// - 401 and 403: the shell's permission rule has taken the page already;
// - 404 project_not_found: the shell shows the project gone; another 404, such as a note another tab removed: its
//   message over the board, and the workshop is read again;
// - 409 workshop_closed, or another 409 that leads to stale: the stale bar with its reload, the typed text kept;
// - an input error (400, 413, a reused request key) or step_empty: its message by the field the action sent, or over
//   the board when it has none;
// - anything else: the error notice with 다시 시도.
function refused(state, answer, { field = null, note = null, step = null, retry }) {
  const { shell } = state.ctx;
  if (answer.status === 404 && answer.code !== 'project_not_found') {
    notice(state, h('div', { class: 'nt warn', role: 'alert' }, h('div', { class: 'b' }, h('b', {}, shell.message(answer.code)))));
    shell.reload();
    return;
  }
  const found = shell.outcome(answer);
  if (found === null) return;
  if (found.state === 'stale') {
    const bar = shell.staleBar({ text: shell.message(answer.code) });
    bar.querySelector('button')?.addEventListener('click', () => clearNotice(state));
    notice(state, bar);
    draw(state);
    return;
  }
  if ((found.kind === 'input' || found.state === 'workshop') && field !== null) {
    state.errors[field] = { code: answer.code ?? 'internal', note, step };
    clearNotice(state);
    draw(state);
    return;
  }
  if (found.kind === 'input' || found.state === 'workshop') {
    notice(state, h('div', { class: 'nt err', role: 'alert' }, h('div', { class: 'b' }, h('b', {}, shell.message(answer.code)))));
    draw(state);
    return;
  }
  notice(state, shell.errorNotice(answer, () => {
    clearNotice(state);
    retry();
  }));
  draw(state);
}

function notice(state, node) {
  fill(state.notice, node);
}

function clearNotice(state) {
  fill(state.notice);
}

// The workshop's data after an answer, in the data shown now, which a read again may have replaced meanwhile.
function putNote(state, note) {
  const workshop = state.ctx.data.workshop;
  for (const row of workshop.steps ?? []) {
    const at = row.notes.findIndex((each) => each.id === note.id);
    if (at === -1) continue;
    if (row.step === note.step) {
      row.notes[at] = note;
      return;
    }
    row.notes.splice(at, 1);
  }
  stepRow(workshop, note.step)?.notes.push(note);
}

function dropNote(state, id) {
  const workshop = state.ctx.data.workshop;
  for (const row of workshop.steps ?? []) row.notes = row.notes.filter((note) => note.id !== id);
  workshop.links = (workshop.links ?? []).filter((link) => link.from !== id && link.to !== id);
  state.moves.delete(id);
}

// The first place of TASK-452's grid in the step's frame that no note holds exactly, row by row.
export function freePlace(notes) {
  const taken = new Set(notes.map((note) => `${note.x},${note.y}`));
  for (let slot = 0; ; slot += 1) {
    const x = (slot % GRID.columns) * GRID.x;
    const y = Math.floor(slot / GRID.columns) * GRID.y;
    if (!taken.has(`${x},${y}`)) return { x, y };
  }
}

// API-286: the owner's new note, in the chosen step's frame at the grid's first free place.
async function addNote(state) {
  const { adding } = state;
  if (adding === null || state.busy.has('add') || !/\S/u.test(adding.text)) return;
  const step = state.step;
  const notes = stepRow(state.ctx.data.workshop, step)?.notes ?? [];
  const body = { step, kind: adding.kind, text: adding.text, ...freePlace(notes) };
  state.busy.add('add');
  delete state.errors.add;
  const answer = await send(state, 'add', 'POST', `${workshopApi(state.ctx.address.project)}/notes`, body);
  state.busy.delete('add');
  if (answer.status === 201) {
    putNote(state, answer.body);
    state.adding = null;
    state.ctx.shell.keepDraft(state.drafts.add, '');
    state.selected = answer.body.id;
    state.rename = null;
    state.focus = `ws-note-${answer.body.id}`;
    clearNotice(state);
    draw(state);
    return;
  }
  state.focus = 'ws-add-text';
  refused(state, answer, { field: 'add', retry: () => addNote(state) });
}

// API-287: a rename, sent with Enter when the name differs.
async function rename(state, id, text) {
  const note = noteOf(state.ctx.data.workshop, id);
  if (note === null || state.busy.has(`name:${id}`)) return;
  if (text === note.text) {
    state.rename = null;
    state.ctx.shell.keepDraft(state.drafts.name, '');
    return;
  }
  state.rename = { note: id, text };
  state.busy.add(`name:${id}`);
  const answer = await send(state, `name:${id}`, 'PATCH', notePath(state, id), { text });
  state.busy.delete(`name:${id}`);
  if (answer.status === 200) {
    putNote(state, answer.body);
    state.rename = null;
    state.ctx.shell.keepDraft(state.drafts.name, '');
    delete state.errors.name;
    clearNotice(state);
    state.focus = 'ws-name';
    draw(state);
    return;
  }
  state.focus = 'ws-name';
  refused(state, answer, { field: 'name', note: id, retry: () => rename(state, id, text) });
}

// API-288: removes the note at once, with its links.
async function removeNote(state, id) {
  const name = `remove:${id}`;
  if (state.busy.has(name)) return;
  state.busy.add(name);
  draw(state);
  const answer = await send(state, name, 'DELETE', notePath(state, id), null);
  state.busy.delete(name);
  if (answer.status === 200) {
    dropNote(state, id);
    if (state.selected === id) {
      state.selected = null;
      state.rename = null;
      state.linking = false;
    }
    clearNotice(state);
    draw(state);
    return;
  }
  refused(state, answer, { retry: () => removeNote(state, id) });
}

// API-289: a link from the chosen note to the one chosen next; the same link again answers 200 with it.
async function connect(state, from, to) {
  state.linking = false;
  draw(state);
  const answer = await send(state, `link:${from}>${to}`, 'POST', `${workshopApi(state.ctx.address.project)}/links`, { from, to });
  if (answer.status === 201 || answer.status === 200) {
    // A 200 is a link that was there already, which keeps its place.
    const workshop = state.ctx.data.workshop;
    workshop.links = workshop.links ?? [];
    if (!workshop.links.some((link) => link.id === answer.body.id)) workshop.links.push(answer.body);
    clearNotice(state);
    draw(state);
    return;
  }
  refused(state, answer, { retry: () => connect(state, from, to) });
}

// API-290.
async function unlink(state, id) {
  const name = `unlink:${id}`;
  if (state.busy.has(name)) return;
  state.busy.add(name);
  draw(state);
  const answer = await send(state, name, 'DELETE', `${workshopApi(state.ctx.address.project)}/links/${encodeURIComponent(id)}`, null);
  state.busy.delete(name);
  if (answer.status === 200) {
    const workshop = state.ctx.data.workshop;
    workshop.links = (workshop.links ?? []).filter((link) => link.id !== id);
    clearNotice(state);
    draw(state);
    return;
  }
  refused(state, answer, { retry: () => unlink(state, id) });
}

// API-291: the chosen step's confirmation. Writing the step into the domain document goes to the agent's to-do.
async function confirmStep(state, step) {
  const name = `confirm:${step}`;
  if (state.busy.has(name)) return;
  state.busy.add(name);
  delete state.errors.confirm;
  draw(state);
  const answer = await send(state, name, 'POST', `${workshopApi(state.ctx.address.project)}/steps/${encodeURIComponent(step)}/confirm`, {});
  state.busy.delete(name);
  if (answer.status === 200) {
    const row = stepRow(state.ctx.data.workshop, step);
    if (row !== null) row.confirmed_at = answer.body.confirmed_at;
    clearNotice(state);
    draw(state);
    return;
  }
  refused(state, answer, { field: 'confirm', step, retry: () => confirmStep(state, step) });
}

// The file the owner chose for an import: one over 5 MiB is refused here, as the server would (413), without sending.
async function chosen(state, input) {
  const file = input.files?.[0];
  input.value = '';
  if (file === undefined || file === null) return;
  state.imported = null;
  delete state.errors.import;
  if (file.size > MIRO_BYTES) {
    state.errors.import = { code: 'body_too_large' };
    draw(state);
    return;
  }
  let text;
  try {
    text = await file.text();
  } catch {
    state.errors.import = { code: 'internal' };
    draw(state);
    return;
  }
  importBoard(state, text);
}

// API-292: the export's text as it is, read only by the server. On 201 the line says how many notes and links came,
// and the workshop is read again.
async function importBoard(state, text) {
  if (state.busy.has('import')) return;
  state.busy.add('import');
  state.importButton?.setAttribute('aria-disabled', 'true');
  delete state.errors.import;
  state.imported = null;
  draw(state);
  const answer = await send(state, 'import', 'POST', `${workshopApi(state.ctx.address.project)}/imports`, text, { raw: true });
  state.busy.delete('import');
  state.importButton?.removeAttribute('aria-disabled');
  if (answer.status === 201) {
    state.imported = { notes: answer.body.notes, links: answer.body.links };
    clearNotice(state);
    draw(state);
    state.ctx.shell.reload();
    return;
  }
  refused(state, answer, { field: 'import', retry: () => importBoard(state, text) });
}

// 워크숍 열기 on stage 01 with no workshop open, on a PC: asked once first, then API-284. A workshop opened already
// (409 workshop_open) opens as a new one does.
export function openPart(ctx) {
  const { address, data, shell } = ctx;
  if (address.stage !== DOMAIN_STAGE || shell.isPhone() || data.project?.workshop?.state === 'open') return null;
  const state = stateFor(ctx);
  const { opening } = state;
  opening.ctx = ctx;
  opening.box = h('div', { class: 'ws-open' });
  drawOpening(state);
  return opening.box;
}

function drawOpening(state) {
  const { opening } = state;
  const { shell } = opening.ctx;
  const sending = state.busy.has('open');
  const error = opening.error;
  const refusal = error === null ? null
    : error.kind === 'input' ? h('p', { class: 'err-text', role: 'alert' }, shell.message(error.answer.code))
      : shell.errorNotice(error.answer, () => {
        opening.error = null;
        openWorkshop(state);
      });
  if (!opening.asking) {
    fill(opening.box, h('div', { class: 'btns' }, h('button', {
      type: 'button', id: 'ws-open', class: 'btn tertiary',
      on: { click: () => { opening.asking = true; opening.error = null; state.focus = 'ws-open-yes'; drawOpening(state); } },
    }, WORKSHOP_WORDS.openWorkshop)), refusal);
  } else {
    fill(opening.box, h('div', { class: 'nt info', role: 'status' }, h('div', { class: 'b' },
      h('b', {}, WORKSHOP_WORDS.openAsk),
      h('div', { class: 'btns' },
        h('button', {
          type: 'button', id: 'ws-open-yes', class: 'btn primary sm', 'aria-disabled': sending ? 'true' : null,
          on: { click: () => openWorkshop(state) },
        }, WORKSHOP_WORDS.openWorkshop),
        h('button', {
          type: 'button', class: 'btn tertiary sm',
          on: { click: () => { opening.asking = false; opening.error = null; state.focus = 'ws-open'; drawOpening(state); } },
        }, WORKSHOP_WORDS.cancel)))), refusal);
  }
  focusAfter(state);
}

async function openWorkshop(state) {
  const { opening } = state;
  if (state.busy.has('open')) return;
  const ctx = opening.ctx;
  const { address, shell } = ctx;
  state.busy.add('open');
  opening.error = null;
  drawOpening(state);
  // The workshop's state holds a ctx of its own only once the board is drawn; the write goes through this view's.
  state.ctx = ctx;
  const answer = await send(state, 'open', 'POST', workshopApi(address.project), {});
  state.busy.delete('open');
  if (answer.status === 201 || (answer.status === 409 && answer.code === 'workshop_open')) {
    opening.asking = false;
    state.step = null;
    if (address.diagram !== null || address.thread !== null) shell.go(stageHref(address.project, address.part, address.stage));
    else shell.reload();
    return;
  }
  const found = shell.outcome(answer);
  if (found === null) return;
  // An input refusal shows under the question, which stays; any other closes it, and its 다시 시도 sends again.
  opening.error = { kind: found.kind === 'input' ? 'input' : 'retry', answer };
  opening.asking = found.kind === 'input';
  drawOpening(state);
}
