// SCR-145's pictures (TASK-458; SPEC-003 to SPEC-012, SPEC-027): the stage's diagrams, the chosen one drawn by
// picture.js or framed by mockup-frame.js, choosing an element, copying it and moving it. screens.js runs it in the
// shell, which reads API-264 and then the chosen diagram (API-265, screen.follow).
//
// - The stage's diagrams are listed above the picture when there are several, or a removed one is still listed
//   (SPEC-027): API-264's order, removed ones that something waits on last and marked. Choosing one opens it in this
//   page (shell.go) with ?d= in the address.
// - Every element is chosen by pointer or by keyboard (a button, or a line's path), and shows that it is chosen. The
//   Selected panel shows its kind, its name and its trace ID apart, and copies "ID name" (SPEC-011).
// - A box that is not drawn round others moves by dragging, or by the arrow keys, 8 pixels a step and 40 with Shift.
//   Each drag or run of keys is sent as one move once it stops for 400 ms, with a new request key (API-274). A removed
//   diagram, a phone (SPEC-051), stage 08's panels, a row and a token take no move.
// - Choosing does not draw the view again, so the mockup's frame keeps its page; a move draws the picture again.
// - The changes, answering AI proposals, renaming, connecting and what waits for reflection, are changes.js's
//   (TASK-460), and so is "이 그림" with the diagram's confirmation (TASK-461): the workbench puts their parts in place
//   and passes changes.js the choices and keys it takes.
// - The Selected section holds the threads of what is chosen, or with nothing chosen those of the whole diagram
//   (threads.js, TASK-459). Escape, or "그림 전체 스레드", chooses nothing again; while 잇기 waits for the other end,
//   Escape stops it instead, and "그림 전체 스레드" stops it too.
//
// The workbench keeps, for the shell it runs in, the chosen element and the moves not yet answered; only the text the
// owner types for a thread is kept in this tab (threads.js).

import { diagramApi, stageHref } from './address.js';
import { newRequestKey } from './api.js';
import { CHANGE_WORDS, changeKey, changesOf, drawChanges, moreBlock, nameBlock, picked, renameFrom, stopConnecting } from './changes.js';
import { CONFIRM_WORDS } from './confirm.js';
import { fill, h, s } from './dom.js';
import { mockupFrame } from './mockup-frame.js';
import { overlayModel } from './overlays.js';
import { chooser, PAD, pictureOf, shownName, STICKIES, tagWord, WORDS } from './picture.js';
import { CONTAINERS, placement } from './relayout.js';
import { THREAD_WORDS, threadsFocus, threadsOpened, threadsPart, threadsWhole } from './threads.js';
import { workshopEntry } from './workshop.js';

export const STEP = 8;
export const LONG_STEP = 40;
export const SEND_AFTER_MS = 400;
const DRAG_FROM = 3;
const MOVED_KINDS = new Set(['ddd_board', 'erd', 'sitemap', 'user_flow']);

export const WORKBENCH_WORDS = Object.freeze({
  phone: '옮기기, 이름 바꾸기, 잇기, 제안 답하기, 확정은 PC에서 하세요.',
  copy: 'ID와 이름 복사',
  copied: '복사했어요',
  copyField: 'ID와 이름',
  selected: '고른 요소',
  diagram: CHANGE_WORDS.diagram,
  proposals: CHANGE_WORDS.proposals,
  noProposals: '목업은 AI 제안을 받지 않아요. 에이전트는 토큰이나 목업에 댓글을 달아요.',
  moveGone: '다이어그램에 더 이상 없는 요소예요.',
  notDrawn: '이 문서는 그려지지 않아요.',
  notDrawnHow: '문서를 고쳐 다시 보내면 그림이 나와요.',
  removed: WORDS.removed,
});

// The text under the title, by the diagram's kind (TASK-458's question 7): the mockup's words where it gives them. The
// board's on a PC is the mockup's again, F2 renaming included, since TASK-460 renames (WBS section 4).
const DESCRIPTIONS = Object.freeze({
  ddd_board: { pc: 'Git 문서에서 그린 그림이에요. 끌어 옮기고, 두 번 눌러 이름을 바꿔 보세요. 키보드로는 화살표로 옮기고 F2로 이름을 바꿔요.', phone: 'Git 문서에서 그린 그림이에요. 눌러서 댓글을 읽고 남겨요.' },
  user_flow: 'Git 문서의 Mermaid 흐름도에서 그린 그림이에요. 흐름 파일마다 그림이 하나 있어요.',
  erd: 'Git의 스키마에서 그린 ERD예요. 테이블마다 상자가 하나 있어요.',
  sitemap: 'Git의 사이트맵에서 그린 화면 트리예요.',
  screen_states: 'Git의 화면 정의에서 그린 상태 패널이에요. 상태마다 패널이 하나 있어요.',
  item_table: 'Git 문서의 항목을 한 줄에 하나씩 보여 줘요.',
});

const BOARD_LEGEND = Object.freeze([
  ['event', '이벤트: 일어난 일'],
  ['command', '명령: 누군가 하려는 일'],
  ['aggregate', '애그리거트: 규칙을 함께 지키는 단위'],
  ['policy', '정책: "~하면 ~한다" 규칙'],
  ['read_model', '읽기 모델: 판단할 때 보는 정보'],
  ['hotspot', '핫스팟: 아직 정하지 못한 문제'],
]);
const OVERLAY_LEGEND = Object.freeze([
  ['dash', '점선: 수락하고 반영하기 전의 AI 제안'],
  ['ring', '반영 대기: 에이전트가 문서에 넣기를 기다림'],
]);
const FLOW_LEGEND = Object.freeze(['둥근 상자: 시작과 끝', '상자: 한 단계', '마름모: 결정, 갈래마다 이름']);

// The text under the workbench's title: a text, or { text, mono } for the mockup's name; null with no diagram.
export function descriptionOf(diagram, phone) {
  if (diagram === null || diagram === undefined) return null;
  if (diagram.kind === 'mockup') return { text: diagram.name, mono: true };
  const words = DESCRIPTIONS[diagram.kind];
  if (words === undefined) return null;
  return typeof words === 'string' ? words : words[phone ? 'phone' : 'pc'];
}

// SCR-145#loading's work panel: its sections' titles, with grey shapes where their contents come, as the mockup's
// frames draw them, so that nothing moves when the data comes. A phone has the Selected section only.
export function panelSkeleton(phone) {
  const section = (title, ...shapes) => h('section', { class: 'panel' }, h('div', { class: 'ph' }, h('h2', {}, title)),
    shapes.map((shape) => h('span', { class: `sk ${shape}`, 'aria-hidden': 'true' })));
  const selected = section(WORKBENCH_WORDS.selected, 'line w50', 'row');
  if (phone) return [selected];
  return [section(WORKBENCH_WORDS.diagram, 'line w80', 'line w60', 'btn full'), section(WORKBENCH_WORDS.proposals, 'row', 'row'), selected];
}

// SCR-145#empty's work panel on a PC, when nothing was sent for the stage: nothing to confirm, and no AI proposal.
export function emptyPanel(phone) {
  if (phone) return [];
  return [
    h('section', { class: 'panel' }, h('div', { class: 'ph' }, h('h2', {}, WORKBENCH_WORDS.diagram)), h('p', { class: 'sec' }, CONFIRM_WORDS.nothingYet)),
    h('section', { class: 'panel' }, h('div', { class: 'ph' }, h('h2', {}, WORKBENCH_WORDS.proposals)), h('p', { class: 'sec' }, CHANGE_WORDS.allAnswered)),
  ];
}

// The workbench of one view of the screen, built once for both its body and its panel.
const built = new WeakMap();
// The workbench's own state, by the shell it runs in.
const states = new WeakMap();
// A tab keeps each diagram's recent position history until the page is reloaded.
const histories = new WeakMap();
const historyListeners = new WeakSet();

export function workbenchOf(ctx, row) {
  if (!built.has(ctx)) built.set(ctx, build(ctx, row));
  return built.get(ctx);
}

function stateOf(ctx) {
  const diagram = ctx.data.diagram;
  let state = states.get(ctx.shell);
  if (state === undefined || state.diagram !== diagram.id) {
    state?.frame?.end();
    let byDiagram = histories.get(ctx.shell);
    if (byDiagram === undefined) { byDiagram = new Map(); histories.set(ctx.shell, byDiagram); }
    let history = byDiagram.get(diagram.id);
    if (history === undefined) { history = { undo: [], redo: [], busy: false }; byDiagram.set(diagram.id, history); }
    state = { diagram: diagram.id, selected: null, moves: new Map(), before: new Map(), pending: new Set(), sending: new Set(), again: new Set(), timer: null, frame: null, drags: new WeakMap(), history };
    // Whether the workbench still shows this diagram, for an answer that comes after a switch.
    const own = state;
    state.live = () => states.get(ctx.shell) === own;
    states.set(ctx.shell, state);
    if (!historyListeners.has(ctx.shell)) {
      historyListeners.add(ctx.shell);
      document.addEventListener('keydown', (event) => historyKey(states.get(ctx.shell), event));
    }
  }
  return state;
}

function build(ctx, row) {
  const diagram = ctx.data.diagram;
  const state = stateOf(ctx);
  state.ctx = ctx;
  state.phone = ctx.shell.isPhone();
  if (state.selected !== null && !(diagram.elements ?? []).some((element) => element.key === state.selected)) state.selected = null;
  state.model = overlayModel(diagram);
  state.names = new Map((diagram.elements ?? []).map((element) => [element.key, shownName(element)]));
  state.notice = h('div', { class: 'wb-notice' });
  state.pictureBox = h('div', { class: 'wb-picture', on: { keydown: (event) => escape(state, event) } });
  state.selectedBox = h('section', { class: 'panel', 'aria-label': WORKBENCH_WORDS.selected, on: { keydown: (event) => escape(state, event) } });
  state.tokenBox = null;
  const changes = changesOf(state);
  threadsOpened(state, {
    // A thread's element is chosen as itself, never as the other end of a connection: 잇기 stops first (changes.js).
    choose: (key) => {
      if (state.selected === key) return drawSelected(state);
      stopConnecting(state);
      return select(state, key);
    },
    notice: (nodes) => fill(state.notice, nodes),
    live: () => states.get(state.ctx.shell) === state,
    reload: (how) => state.ctx.shell.reload(how),
  });

  const body = [
    ctx.note === 'gone' ? h('div', { class: 'nt warn', role: 'status' }, h('div', { class: 'b' }, h('b', {}, ctx.shell.message('diagram_not_found')))) : null,
    diagramList(ctx, row),
    notDrawn(diagram),
    state.notice,
    changes.line,
    state.pictureBox,
  ];
  const panel = [...changes.sections];
  if (diagram.kind === 'mockup') {
    state.frame?.end();
    state.frame = mockupFrame({ diagram, shell: ctx.shell });
    fill(state.pictureBox, state.frame.element);
    // Tokens are chosen like any element, so Escape there chooses nothing again too. On a PC they are listed in "이
    // 그림", above its confirmation (changes.js); on a phone under the frame.
    const tokens = h('div', { class: 'tokens', on: { keydown: (event) => escape(state, event) } });
    state.tokenBox = tokens;
    if (state.phone) body.push(tokens);
    panel.push(h('section', { class: 'panel' }, h('div', { class: 'ph' }, h('h2', {}, WORKBENCH_WORDS.proposals)),
      h('p', { class: 'sec' }, WORKBENCH_WORDS.noProposals)));
  }
  drawPicture(state);
  body.push(legendOf(diagram, state.model));
  if (state.phone) body.push(h('div', { class: 'nt info', role: 'status' }, h('div', { class: 'b' }, h('span', {}, WORKBENCH_WORDS.phone))));
  panel.push(state.selectedBox);
  drawSelected(state);
  drawChanges(state);
  return { body, panel };
}

// The stage's diagrams above the picture, when there are several or a removed one is listed (SCR-145's data), after
// the entry 워크숍 on stage 01 while the workshop is open (workshop.js, TASK-462). A choice opens in this page; the
// address gains ?d= with its ID, or loses it for the workshop.
function diagramList(ctx, row) {
  const diagrams = row?.diagrams ?? [];
  const workshop = workshopEntry(ctx);
  if (diagrams.length < 2 && !diagrams.some((diagram) => diagram.removed) && workshop === null) return null;
  const { address, shell } = ctx;
  const shown = ctx.data.diagram.id;
  const entries = [
    ...(workshop === null ? [] : [{ href: workshop.href, on: false, text: workshop.text, removed: false }]),
    ...diagrams.map((diagram) => ({
      href: stageHref(address.project, address.part, address.stage, { diagram: diagram.id }), on: diagram.id === shown, text: diagram.name, removed: diagram.removed,
    })),
  ];
  return h('nav', { class: 'steps', 'aria-label': `이 단계의 그림 ${diagrams.length}개` }, entries.map(({ href, on, text, removed }) => h('a', {
    class: on ? 'step on' : 'step',
    href,
    'aria-current': on ? 'page' : null,
    on: {
      click: (event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || (event.button !== undefined && event.button !== 0)) return;
        event.preventDefault();
        if (!on) shell.go(href);
      },
    },
  }, text, removed ? h('span', { class: 'tag gray' }, WORKBENCH_WORDS.removed) : null)));
}

// The drawing failed (SCR-145#not-drawn): where, and that the picture comes once the document is fixed. The last good
// drawing, when there is one, is drawn under it. A mockup says it in its frame's place.
function notDrawn(diagram) {
  if (diagram.drawing?.status !== 'failed' || (diagram.kind === 'mockup' && diagram.last_drawn === null)) return null;
  return h('div', { class: 'nt err', role: 'alert' }, h('div', { class: 'b' },
    h('b', {}, WORKBENCH_WORDS.notDrawn),
    h('span', {}, diagram.drawing.failed_at ? h('span', { class: 'mono' }, `${diagram.drawing.failed_at} `) : null, WORKBENCH_WORDS.notDrawnHow)));
}

function legendOf(diagram, model) {
  const overlays = model.ghosts.length > 0 || model.links.length > 0 || [...model.marks.values()].some((over) => over.proposed || over.waiting);
  const items = [];
  if (diagram.kind === 'ddd_board') items.push(...BOARD_LEGEND.map(([kind, text]) => [h('span', { class: `sw k-${kind}`, 'aria-hidden': 'true' }), text]));
  if (diagram.kind === 'user_flow') items.push(...FLOW_LEGEND.map((text) => [null, text]));
  if (diagram.kind === 'ddd_board' || overlays) items.push(...OVERLAY_LEGEND.map(([kind, text]) => [h('span', { class: `sw ${kind}`, 'aria-hidden': 'true' }), text]));
  if (items.length === 0) return null;
  return h('div', { class: 'legend' }, items.map(([swatch, text]) => h('span', {}, swatch, text)));
}

// The picture, drawn again with the moves not yet answered; the element that had the focus gets it back.
function drawPicture(state) {
  const { ctx } = state;
  const diagram = ctx.data.diagram;
  const view = {
    diagram,
    place: placement(diagram, state.moves),
    model: state.model,
    selected: state.selected,
    names: state.names,
    nodes: new Map(),
    shapes: new Map(),
    select: (key) => select(state, key),
    keydown: (element, event) => keydown(state, element, event),
    dblclick: (element) => renameFrom(state, element, () => select(state, element.key)),
    pointerdown: (element, event) => pointerdown(state, element, event),
  };
  const before = state.view?.box;
  // A box the shell has taken out of the page with the rest of the body no longer knows where it was scrolled.
  const kept = before !== undefined && before.isConnected !== false && state.scrolled === diagram.id;
  const scroll = kept ? { left: before.scrollLeft, top: before.scrollTop } : null;
  state.view = view;
  if (diagram.kind === 'mockup') {
    if (state.tokenBox !== null) fill(state.tokenBox, tokenList(view));
  } else {
    const controls = !state.phone && !diagram.removed && MOVED_KINDS.has(diagram.kind) ? historyControls(state) : null;
    fill(state.pictureBox, controls, pictureOf(view));
  }
  if (view.box !== undefined) {
    state.scrolled = diagram.id;
    scrollTo(view, scroll);
  }
  if (state.focus !== undefined && state.focus !== null) {
    view.nodes.get(state.focus)?.focus();
    state.focus = null;
  }
}

// A redrawn picture keeps where its box was scrolled. A picture drawn first opens scrolled across to its first box, the
// top one and then the left one: centred in the box, but never past that box's left edge, so the board opens at its
// first lane's start, a flow at its start and a sitemap at its root. The box is in the page only once the shell has
// put the body there, so a box not yet in the page scrolls after that.
function scrollTo(view, scroll) {
  const { box, origin, place } = view;
  const apply = () => {
    if (scroll !== null) {
      box.scrollLeft = scroll.left;
      box.scrollTop = scroll.top;
      return;
    }
    // An ERD has no first table: it opens at its top-left corner.
    if (view.diagram.kind === 'erd') return;
    let first = null;
    for (const shown of place.boxes.values()) {
      if (first === null || shown.y < first.y || (shown.y === first.y && shown.x < first.x)) first = shown;
    }
    if (first === null) return;
    const left = first.x - origin.x;
    box.scrollLeft = Math.max(0, Math.min(left, left + first.width / 2 - (box.clientWidth ?? 0) / 2));
  };
  if (box.isConnected === false) queueMicrotask(apply);
  else apply();
}

// A mockup's tokens (SPEC-009), each chosen like any element, with a swatch of its first value when that is a colour.
function tokenList(view) {
  const tokens = (view.diagram.elements ?? []).filter((element) => element.kind === 'token');
  return [
    h('h3', {}, `이 목업이 쓰는 토큰 ${tokens.length}개`),
    h('ul', { class: 'tok' }, tokens.map((element) => h('li', {}, chooser(view, element, 'tk', [swatchOf(element), h('span', {}, shownName(element))])))),
  ];
}

// A swatch drawn with the value as an SVG fill, never a style, when the browser reads it as a colour that names nothing
// outside itself.
export function swatchOf(element) {
  const value = Array.isArray(element.detail?.values) ? element.detail.values[0] : undefined;
  const colour = typeof value === 'string' && !/url\(|var\(|env\(/i.test(value) && globalThis.CSS?.supports?.('color', value) === true;
  if (!colour) return h('span', { class: 'sw none', 'aria-hidden': 'true' });
  return s('svg', { class: 'sw', 'aria-hidden': 'true', width: 16, height: 16, viewBox: '0 0 16 16' }, s('rect', { width: 16, height: 16, rx: 4, fill: value }));
}

function setPressed(node, on) {
  if (node === undefined || node === null) return;
  node.setAttribute('aria-pressed', on ? 'true' : 'false');
  const classes = (node.getAttribute('class') ?? '').split(' ').filter((name) => name !== '' && name !== 'sel');
  if (on) classes.push('sel');
  node.setAttribute('class', classes.join(' '));
}

function select(state, key) {
  // While 잇기 waits for the other end, a choice is that end (changes.js).
  if (picked(state, key)) return;
  if (state.selected === key) return;
  setPressed(state.view.nodes.get(state.selected), false);
  state.selected = key;
  setPressed(state.view.nodes.get(key), true);
  drawSelected(state);
}

// Nothing chosen again: the Selected section lists the whole diagram's threads, and 잇기 stops waiting for the other
// end (changes.js). When the control that had the focus was in the section, which is drawn anew, the focus stays in the
// section (threadsFocus).
function whole(state) {
  const active = document.activeElement ?? null;
  const had = active !== null && state.selectedBox.contains(active);
  stopConnecting(state);
  setPressed(state.view.nodes.get(state.selected), false);
  state.selected = null;
  threadsWhole(state);
  drawSelected(state);
  if (had) threadsFocus(state);
}

// Escape, outside a field, chooses nothing again, unless it was taken already, as 잇기 takes it to stop (changes.js).
function escape(state, event) {
  if (event.key !== 'Escape' || event.target?.tagName === 'INPUT' || event.defaultPrevented) return;
  if (state.selected === null && state.threads?.shown === null) return;
  event.preventDefault();
  whole(state);
}

// The Selected panel: the element's kind, its trace ID and the like apart, its name (a field to rename it, changes.js),
// the copy of "ID name", changes.js's 잇기 and the element's changes that wait, and its threads; with nothing chosen,
// "그림 전체" and the whole diagram's threads (threads.js).
function drawSelected(state) {
  const box = state.selectedBox;
  const element = (state.ctx.data.diagram.elements ?? []).find((each) => each.key === state.selected);
  if (element === undefined) {
    fill(box, h('div', { class: 'ph' }, h('h2', {}, WORKBENCH_WORDS.selected)), h('p', {}, h('b', {}, THREAD_WORDS.whole)), threadsPart(state, null));
    return;
  }
  const status = h('span', { class: 'copied', role: 'status' });
  const kindTag = h('span', { class: STICKIES.has(element.kind) ? `tag k-${element.kind}` : 'tag gray' }, tagWord(state.ctx.data.diagram, element));
  const apart = traceLine(state.ctx.data.diagram, element);
  fill(box,
    h('div', { class: 'ph' }, h('h2', {}, WORKBENCH_WORDS.selected),
      h('div', { class: 'btns' },
        h('button', { type: 'button', class: 'btn ghost sm', on: { click: () => copy(copyText(element), status) } }, WORKBENCH_WORDS.copy),
        h('button', { type: 'button', class: 'btn ghost sm', on: { click: () => whole(state) } }, THREAD_WORDS.wholeThreads))),
    h('div', { class: 'btns mid' }, kindTag,
      element.kind === 'command' && element.detail?.actor ? h('span', { class: 'small' }, `누가: ${element.detail.actor}`) : null,
      apart === null ? null : h('span', { class: 'small mono' }, apart)),
    nameBlock(state, element),
    status,
    moreBlock(state, element),
    threadsPart(state, element));
}

// The IDs of an element, shown apart from its name: its trace ID; a flow box's node and the IDs it names; a state's or
// a token's key.
function traceLine(diagram, element) {
  if (diagram.kind === 'user_flow' && Array.isArray(element.detail?.ids)) {
    const parts = [element.detail.id, ...element.detail.ids].filter((part) => typeof part === 'string' && part !== '');
    return parts.length === 0 ? null : parts.join(' · ');
  }
  if (element.trace_id) return element.trace_id;
  if (element.kind === 'state' || element.kind === 'token') return element.key;
  return null;
}

// "ID name" (SPEC-011): the trace ID and the name, or whichever the element has.
export function copyText(element) {
  const text = [element.trace_id ?? '', element.name].filter((part) => part !== '').join(' ');
  return text === '' ? element.key : text;
}

// Copies text; when the browser refuses, shows it selected to copy by hand (SPEC-011).
async function copy(text, status) {
  try {
    await globalThis.navigator.clipboard.writeText(text);
    fill(status, WORKBENCH_WORDS.copied);
  } catch {
    const field = h('input', { class: 'field mono', readonly: true, value: text, 'aria-label': WORKBENCH_WORDS.copyField });
    fill(status, field);
    field.focus();
    field.select?.();
  }
}

function historyControls(state) {
  const undo = h('button', { class: 'btn tertiary sm', type: 'button', on: { click: () => runHistory(state, false) } }, '이동 되돌리기');
  const redo = h('button', { class: 'btn tertiary sm', type: 'button', on: { click: () => runHistory(state, true) } }, '이동 다시 실행');
  state.historyUI = { undo, redo };
  updateHistoryControls(state);
  return h('div', { class: 'move-history', role: 'group', 'aria-label': '그림 이동 기록' },
    undo, redo, h('span', { class: 'small' }, '그림에서 옮긴 위치만 되돌려요.'));
}

function historyPending(state) {
  return state.history.busy || state.pending.size > 0 || state.sending.size > 0 || state.moves.size > 0;
}

function updateHistoryControls(state) {
  if (!state.historyUI) return;
  const { undo, redo } = state.historyUI;
  const pending = historyPending(state);
  undo.disabled = pending || state.history.undo.length === 0;
  redo.disabled = pending || state.history.redo.length === 0;
}

function historyKey(state, event) {
  if (!state || state.phone || !state.historyUI || state.pictureBox?.isConnected === false) return;
  if (!(event.ctrlKey || event.metaKey) || event.altKey || String(event.key).toLowerCase() !== 'z') return;
  const target = event.target;
  if (target?.isContentEditable || target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)) return;
  const redo = Boolean(event.shiftKey);
  if (historyPending(state) || (redo ? state.history.redo : state.history.undo).length === 0) return;
  event.preventDefault();
  runHistory(state, redo);
}

async function runHistory(state, redo, retryKey = null) {
  const history = state.history;
  if (retryKey === null && historyPending(state)) return;
  const fromStack = redo ? history.redo : history.undo;
  const toStack = redo ? history.undo : history.redo;
  const entry = fromStack.at(-1);
  if (!entry) return;
  const target = redo ? entry.to : entry.from;
  const expected = redo ? entry.from : entry.to;
  history.busy = true;
  updateHistoryControls(state);
  const path = `${diagramApi(state.ctx.data.diagram.project, state.diagram)}/positions`;
  const requestKey = retryKey ?? newRequestKey();
  const outcome = await state.ctx.shell.write('POST', path, { element: entry.key, x: target.x, y: target.y, expected }, requestKey);
  if (outcome.status === 200) {
    fromStack.pop();
    toStack.push(entry);
    history.busy = false;
    if (!state.live()) return;
    const element = (state.ctx.data.diagram.elements ?? []).find((each) => each.key === entry.key);
    if (element) element.position = { x: outcome.body.x, y: outcome.body.y };
    fill(state.notice, h('div', { class: 'nt info', role: 'status' }, redo ? '이동을 다시 실행했어요.' : '이동을 되돌렸어요.'));
    state.focus = entry.key;
    drawPicture(state);
    return;
  }
  if (!state.live()) { history.busy = false; return; }
  if (outcome.status === 409 && outcome.code === 'position_changed') {
    history.undo.length = 0;
    history.redo.length = 0;
    history.busy = false;
    await state.ctx.shell.reload();
    if (state.live()) fill(state.notice, h('div', { class: 'nt warn', role: 'alert' }, '다른 곳에서 위치가 바뀌었어요. 그림을 다시 확인해 주세요.'));
    updateHistoryControls(state);
    return;
  }
  if (outcome.failure === 'timeout' || outcome.failure === 'network') {
    fill(state.notice, state.ctx.shell.errorNotice(outcome, () => runHistory(state, redo, requestKey)),
      h('button', { class: 'btn tertiary sm', type: 'button', on: { click: () => {
        history.undo.length = 0; history.redo.length = 0; history.busy = false;
        state.ctx.shell.reload();
      } } }, '새로 고침'));
    return;
  }
  history.busy = false;
  updateHistoryControls(state);
  if (outcome.status === 401 || outcome.status === 403 || outcome.failure === 'gate') return;
  fill(state.notice, state.ctx.shell.errorNotice(outcome, () => runHistory(state, redo)));
}

// Whether element moves: a box not drawn round others, on a picture that moves, of a diagram not removed, on a PC.
function movable(state, element) {
  const diagram = state.ctx.data.diagram;
  return !state.phone && !state.history.busy && !diagram.removed && MOVED_KINDS.has(diagram.kind) && !CONTAINERS.has(element.kind) && state.view.place.boxes.has(element.key);
}

const ARROWS = Object.freeze({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] });

function keydown(state, element, event) {
  if (changeKey(state, element, event, () => select(state, element.key))) return;
  const way = ARROWS[event.key];
  if (way === undefined || !movable(state, element)) return;
  event.preventDefault();
  const step = event.shiftKey ? LONG_STEP : STEP;
  const at = state.view.place.boxes.get(element.key);
  moveTo(state, element.key, { x: at.x + way[0] * step, y: at.y + way[1] * step });
}

// A drag: the box follows the pointer, and the move is taken once it is let go 3 pixels or more from where it started.
function pointerdown(state, element, event) {
  if ((event.button !== undefined && event.button !== 0) || !movable(state, element)) return;
  const node = state.view.nodes.get(element.key);
  const holder = node?.parentNode?.parentNode;
  if (!node || !holder) return;
  const at = state.view.place.boxes.get(element.key);
  const shape = state.view.shapes.get(element.key) ?? null;
  const drag = { key: element.key, start: { x: event.clientX, y: event.clientY }, at, holder, shape, moved: false, to: at };
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
  drag.to = { x: Math.round(drag.at.x + dx), y: Math.round(drag.at.y + dy) };
  drag.holder.setAttribute('x', drag.to.x - PAD);
  drag.holder.setAttribute('y', drag.to.y - PAD);
  // A flow box's shape is drawn apart from its button: it follows by an SVG transform, never a style.
  drag.shape?.setAttribute('transform', `translate(${drag.to.x - drag.at.x} ${drag.to.y - drag.at.y})`);
}

// A drag the browser took over, such as for a gesture: the box goes back to where it was, and nothing is sent.
function cancelled(state, node) {
  const drag = state.drags.get(node);
  state.drags.delete(node);
  if (drag === undefined || !drag.moved) return;
  drag.holder.setAttribute('x', drag.at.x - PAD);
  drag.holder.setAttribute('y', drag.at.y - PAD);
  drag.shape?.removeAttribute('transform');
}

function dropped(state, node, event) {
  const drag = state.drags.get(node);
  state.drags.delete(node);
  if (drag === undefined) return;
  dragged(drag, event);
  if (drag.moved) moveTo(state, drag.key, drag.to);
}

// Puts a box at a place: chosen, drawn there with its lines, and sent once the moves stop.
function moveTo(state, key, to) {
  const previous = state.view.place.boxes.get(key);
  if (!state.before.has(key) && previous) state.before.set(key, { x: previous.x, y: previous.y });
  state.history.redo.length = 0;
  if (state.selected !== key) {
    state.selected = key;
    drawSelected(state);
  }
  state.moves.set(key, to);
  state.focus = key;
  drawPicture(state);
  state.pending.add(key);
  clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    for (const each of [...state.pending]) {
      state.pending.delete(each);
      send(state, each, null);
    }
  }, SEND_AFTER_MS);
}

// Sends the last place of a box (API-274). A move made while one is sent goes after its answer. A timeout or a lost
// connection keeps the request key for its retry, { key, at }, used only while the box is still at the place sent
// with it, since the same key with another body is refused; any answer makes the next one new.
async function send(state, key, kept) {
  if (state.sending.has(key)) {
    state.again.add(key);
    return;
  }
  const at = state.moves.get(key);
  if (at === undefined) return;
  const diagram = state.ctx.data.diagram;
  const retry = kept !== null && kept.at.x === at.x && kept.at.y === at.y;
  const requestKey = retry ? kept.key : newRequestKey();
  const before = retry ? kept.before : state.before.get(key);
  if (!retry) state.before.delete(key);
  state.sending.add(key);
  const path = `${diagramApi(diagram.project, diagram.id)}/positions`;
  const outcome = await state.ctx.shell.write('POST', path, { element: key, x: at.x, y: at.y }, requestKey);
  state.sending.delete(key);
  if (outcome.status === 200 && before && (before.x !== at.x || before.y !== at.y)) {
    state.history.undo.push({ key, from: before, to: { x: outcome.body.x, y: outcome.body.y } });
    if (state.history.undo.length > 50) state.history.undo.shift();
  }
  if (states.get(state.ctx.shell) !== state) return;
  if (outcome.status === 200) {
    // The data shown now, which a read again may have replaced while the move was sent.
    const element = (state.ctx.data.diagram.elements ?? []).find((each) => each.key === key);
    if (element !== undefined) element.position = { x: outcome.body.x, y: outcome.body.y };
    const now = state.moves.get(key);
    if (now !== undefined && now.x === at.x && now.y === at.y) state.moves.delete(key);
    fill(state.notice);
  } else if (outcome.status === 401 || outcome.status === 403 || outcome.failure === 'gate') {
    return;
  } else if (outcome.status === 404 && outcome.code === 'element_not_found') {
    state.moves.delete(key);
    state.again.delete(key);
    fill(state.notice, h('div', { class: 'nt warn', role: 'alert' }, h('div', { class: 'b' }, h('b', {}, WORKBENCH_WORDS.moveGone)),
      h('button', { type: 'button', class: 'btn tertiary sm', on: { click: () => state.ctx.shell.reload() } }, '새로 고침')));
    drawPicture(state);
    return;
  } else if (outcome.status === 404 && (outcome.code === 'diagram_not_found' || outcome.code === 'project_not_found')) {
    // SCR-145#error: after a write, the diagram is read again first. A removed one still listed opens for what waits on
    // it (TASK-468), and otherwise the shell says that it is gone. The box goes back to where it was until then.
    state.moves.delete(key);
    state.again.delete(key);
    fill(state.notice);
    drawPicture(state);
    state.ctx.shell.reload();
    return;
  } else {
    const keep = outcome.failure === 'timeout' || outcome.failure === 'network' ? { key: requestKey, at, before } : null;
    if (keep === null && before && !state.before.has(key)) state.before.set(key, before);
    fill(state.notice, state.ctx.shell.errorNotice(outcome, () => {
      fill(state.notice);
      send(state, key, keep);
    }));
  }
  updateHistoryControls(state);
  if (state.again.delete(key)) send(state, key, null);
}
