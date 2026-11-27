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
import { store, stored } from './storage.js';
import { THREAD_WORDS, threadsFocus, threadsOpened, threadsPart, threadsWhole } from './threads.js';
import { workshopEntry } from './workshop.js';
import { clampZoom, fitZoom, MAX_ZOOM, MIN_ZOOM, zoomScroll, zoomStep } from './zoom.js';

export const STEP = 8;
export const LONG_STEP = 40;
export const SEND_AFTER_MS = 400;
const DRAG_FROM = 3;
const ZOOM_WAIT_DRAG = '옮기기를 마친 뒤 그림 크기를 바꿔 주세요.';
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
  ddd_board: { pc: 'Git 문서에서 그린 그림이에요. 끌거나 화살표 키로 옮기고 F2로 이름을 바꿔요. 100% 이상에서는 두 번 눌러 이름을 바꿀 수도 있어요.', phone: 'Git 문서에서 그린 그림이에요. 눌러서 댓글을 읽고 남겨요.' },
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
const historyMark = (diagram) => `nexus-move-uncertain:${diagram}`;

export function workbenchOf(ctx, row) {
  if (!built.has(ctx)) built.set(ctx, build(ctx, row));
  return built.get(ctx);
}

function stateOf(ctx) {
  const diagram = ctx.data.diagram;
  let state = states.get(ctx.shell);
  const interrupted = state && state.pictureBox?.isConnected === false
    && (state.history.busy || state.moves.size > 0 || state.sending.size > 0);
  if (state === undefined || state.diagram !== diagram.id || interrupted) {
    state?.frame?.end();
    if (state && (state.history.busy || state.moves.size > 0 || state.sending.size > 0)) {
      clearTimeout(state.timer);
      for (const key of [...state.pending]) { state.pending.delete(key); send(state, key, null); }
      state.history.undo.length = 0; state.history.redo.length = 0;
      state.history.busy = false; state.history.inFlight = null; state.history.epoch += 1; state.history.invalidated = true;
    }
    let byDiagram = histories.get(ctx.shell);
    if (byDiagram === undefined) { byDiagram = new Map(); histories.set(ctx.shell, byDiagram); }
    let history = byDiagram.get(diagram.id);
    if (history === undefined) {
      history = { undo: [], redo: [], busy: false, inFlight: null, pendingWrites: 0, needsRefresh: false, refreshing: false, interruptedOutcome: null, epoch: 0, invalidated: stored('sessionStorage', historyMark(diagram.id)) === '1' };
      byDiagram.set(diagram.id, history);
    }
    state = { diagram: diagram.id, selected: null, moves: new Map(), before: new Map(), pending: new Set(), sending: new Set(), failed: new Set(), again: new Set(), timer: null, frame: null, drags: new WeakMap(), dragListeners: new WeakSet(), zoom: 1, pinching: false, history };
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
  // A failed move's retry must survive a workbench rebuild and unrelated thread messages.
  state.moveNotice = (state.history.busy || state.failed.size > 0) && state.moveNotice ? state.moveNotice : h('div', {});
  state.threadNotice = h('div', {});
  state.notice = h('div', { class: 'wb-notice' }, state.moveNotice, state.threadNotice);
  if (state.history.invalidated) {
    fill(state.moveNotice, h('div', { class: 'nt warn', role: 'alert' }, '저장 결과를 확인하지 못해 이동 기록을 지웠어요. 그림을 다시 확인해 주세요.'));
    state.history.invalidated = false;
    if (state.history.pendingWrites === 0) store('sessionStorage', historyMark(state.diagram), null);
  }
  state.dragNotice = h('div', { class: 'wb-notice' });
  if (state.history.needsRefresh && state.history.pendingWrites === 0) queueMicrotask(() => recoverInterrupted(state, state.history.interruptedOutcome));
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
    notice: (nodes) => fill(state.threadNotice, nodes),
    live: () => states.get(state.ctx.shell) === state,
    reload: (how) => state.ctx.shell.reload(how),
  });

  const body = [
    ctx.note === 'gone' ? h('div', { class: 'nt warn', role: 'status' }, h('div', { class: 'b' }, h('b', {}, ctx.shell.message('diagram_not_found')))) : null,
    diagramList(ctx, row),
    notDrawn(diagram),
    state.notice,
    state.dragNotice,
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
  const previousHistory = state.historyUI;
  const active = document.activeElement;
  if (state.historyFocus && active && active !== document.body && active !== state.historyFocusNode && active !== previousHistory?.undo && active !== previousHistory?.redo) {
    state.historyFocus = null;
    state.historyFocusNode = null;
    state.focus = null;
  }
  const historyFocus = state.historyFocus ?? (active === previousHistory?.undo ? 'undo' : active === previousHistory?.redo ? 'redo' : null);
  const pinchInterrupted = state.pinching;
  state.pinching = false;
  if (state.dragNode) {
    const moved = state.drags.get(state.dragNode)?.moved;
    cancelled(state, state.dragNode);
    if (moved) fill(state.dragNotice, h('div', { class: 'nt warn', role: 'alert' }, '그림이 새로 바뀌어 옮기기를 멈췄어요. 다시 옮겨 주세요.'));
  }
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
    zoom: state.zoom,
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
    const picture = pictureOf(view);
    if (view.svg) {
      for (const element of diagram.elements ?? []) {
        if (movable(state, element)) view.nodes.get(element.key)?.setAttribute('data-diagram-movable', '');
      }
      const prior = state.zoomUI;
      const focusIndex = prior ? [prior.decrease, prior.increase, prior.fit, prior.readable].indexOf(document.activeElement) : -1;
      const oldNotice = prior?.notice.textContent ?? '';
      fill(state.pictureBox, zoomControls(state), controls, picture);
      state.zoomUI.notice.textContent = oldNotice;
      if (pinchInterrupted) state.zoomUI.notice.textContent = '그림이 바뀌어 확대를 멈췄어요. 두 손가락으로 다시 확대해 주세요.';
      const newControls = [state.zoomUI.decrease, state.zoomUI.increase, state.zoomUI.fit, state.zoomUI.readable];
      if (focusIndex >= 0 && !newControls[focusIndex].disabled && !newControls[focusIndex].hidden) newControls[focusIndex].focus();
      view.box.addEventListener('dblclick', (event) => {
        if (state.zoom >= 1) return;
        event.preventDefault();
        event.stopPropagation();
        const rect = view.box.getBoundingClientRect();
        changeZoom(state, Math.min(1, state.zoom * 4), event.clientX - rect.left, event.clientY - rect.top);
      }, true);
      view.box.addEventListener('wheel', (event) => {
        if (!event.ctrlKey) return;
        event.preventDefault();
        if (state.dragNode) {
          state.zoomUI.notice.textContent = ZOOM_WAIT_DRAG;
          return;
        }
        const rect = view.box.getBoundingClientRect();
        const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? view.box.clientHeight : 1);
        changeZoom(state, state.zoom * Math.exp(-delta * 0.002), event.clientX - rect.left, event.clientY - rect.top);
      }, { passive: false });
      let pinch = null;
      // Touch.target stays where each finger started, even when it moves across the page.
      const pictureTouches = (event) => Array.from(event.touches ?? []).filter((touch) =>
        touch.target == null || view.box.contains(touch.target));
      const beginPinch = (touches) => {
        if (touches.length !== 2) { pinch = null; state.pinching = false; return; }
        if (state.dragNode) {
          const moved = state.drags.get(state.dragNode)?.moved;
          cancelled(state, state.dragNode);
          if (moved) fill(state.dragNotice, h('div', { class: 'nt warn', role: 'alert' }, '두 손가락 확대를 시작해 옮기기를 멈췄어요. 다시 옮겨 주세요.'));
        }
        const [a, b] = touches;
        pinch = { distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), zoom: state.zoom };
        state.pinching = true;
      };
      view.box.addEventListener('touchstart', (event) => {
        if (state.view !== view) return;
        beginPinch(pictureTouches(event));
      }, { passive: true });
      view.box.addEventListener('touchmove', (event) => {
        if (state.view !== view) return;
        const touches = pictureTouches(event);
        if (!pinch || touches.length !== 2 || pinch.distance === 0) return;
        if (event.cancelable === false) {
          pinch = null;
          state.pinching = false;
          state.zoomUI.notice.textContent = '스크롤을 멈춘 뒤 두 손가락으로 다시 확대해 주세요.';
          return;
        }
        event.preventDefault();
        const [a, b] = touches;
        const rect = view.box.getBoundingClientRect();
        changeZoom(state, pinch.zoom * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinch.distance,
          (a.clientX + b.clientX) / 2 - rect.left, (a.clientY + b.clientY) / 2 - rect.top);
      }, { passive: false });
      view.box.addEventListener('touchend', (event) => { if (state.view === view) beginPinch(pictureTouches(event)); });
      view.box.addEventListener('touchcancel', () => { if (state.view === view) { pinch = null; state.pinching = false; } });
    } else fill(state.pictureBox, controls, picture);
  }
  if (view.box !== undefined) {
    state.scrolled = diagram.id;
    scrollTo(view, scroll);
  }
  if (state.focus !== undefined && state.focus !== null) {
    view.nodes.get(state.focus)?.focus();
    state.focus = null;
  }
  if (historyFocus && state.historyUI) {
    const preferred = state.historyUI[historyFocus];
    const other = state.historyUI[historyFocus === 'undo' ? 'redo' : 'undo'];
    if (!preferred.disabled) { preferred.focus(); state.historyFocus = null; state.historyFocusNode = null; }
    else if (!state.history.busy && !other.disabled) { other.focus(); state.historyFocus = null; state.historyFocusNode = null; }
    else if (!state.history.busy) { state.historyFocus = null; state.historyFocusNode = null; }
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
    const left = (first.x - origin.x) * (view.zoom ?? 1);
    box.scrollLeft = Math.max(0, Math.min(left, left + first.width * (view.zoom ?? 1) / 2 - (box.clientWidth ?? 0) / 2));
  };
  if (box.isConnected === false) queueMicrotask(apply);
  else apply();
}

function zoomControls(state) {
  const decrease = h('button', { class: 'btn tertiary', type: 'button', 'aria-label': '그림 축소', on: { click: () => changeZoom(state, zoomStep(state.zoom, -1)) } }, '−');
  const increase = h('button', { class: 'btn tertiary', type: 'button', 'aria-label': '그림 확대', on: { click: () => changeZoom(state, zoomStep(state.zoom, 1)) } }, '+');
  const value = h('output', { 'aria-live': 'off', 'aria-label': '그림 배율' });
  const announcement = h('span', { class: 'sr-only', 'aria-live': 'polite' });
  const notice = h('span', { role: 'status' });
  const readable = h('button', { class: 'btn tertiary zoom-readable', type: 'button', on: { click: () => changeZoom(state, 1) } }, '글자 크게 보기');
  const hint = h('span', { class: 'small' }, state.ctx.shell.isPhone()
    ? '작게 본 그림은 원하는 곳을 두 번 누르거나 두 손가락을 벌리면 커져요.' : '작게 본 그림은 원하는 곳을 두 번 누르면 커져요.');
  const fit = h('button', { class: 'btn tertiary', type: 'button', on: { click: () => {
    if (waitForDrag(state)) return;
    const { box, size } = state.view;
    // The box shrinks with the picture; use the available viewport rather than its current height when fitting again.
    fit.scrollIntoView?.({ block: 'start', inline: 'nearest' });
    const available = (top = Math.max(0, box.getBoundingClientRect?.().top ?? 0)) => {
      const metrics = boxMetrics(box);
      return { width: Math.max(1, box.clientWidth - metrics.horizontalPadding),
        height: Math.max(1, Math.min(metrics.maxHeight, (globalThis.innerHeight ?? 674) - top) - metrics.vertical) };
    };
    // A tiny picture may leave too little page height for the controls to scroll to the top.
    // Enlarge provisionally for the space below those controls, then scroll and measure the real space.
    const boxTop = box.getBoundingClientRect?.().top ?? 0;
    const controlTop = fit.getBoundingClientRect?.().top ?? 0;
    let space = available(Math.max(0, boxTop - Math.max(0, controlTop)));
    let fitted = fitZoom(size.width, size.height, space.width, space.height);
    changeZoom(state, fitted, 0, 0);
    fit.scrollIntoView?.({ block: 'start', inline: 'nearest' });
    // A scale below 100% can reveal controls and move the picture down; use its actual position.
    space = available();
    fitted = fitZoom(size.width, size.height, space.width, space.height);
    changeZoom(state, fitted, 0, 0);
    notice.textContent = size.width * fitted > space.width || size.height * fitted > space.height
      ? '그림이 너무 커서 전체를 한 화면에 담지 못했어요.' : '';
    box.scrollLeft = 0;
    box.scrollTop = 0;
  } } }, '화면에 맞추기');
  state.zoomUI = { decrease, increase, fit, value, notice, readable, announcement };
  updateZoomControls(state);
  return h('div', { class: 'zoom-controls', role: 'group', 'aria-label': '그림 크기' }, decrease, value, increase, fit, readable, hint, notice, announcement);
}

function boxMetrics(box) {
  const css = globalThis.getComputedStyle?.(box);
  const number = (value, fallback) => Number.isFinite(Number.parseFloat(value)) ? Number.parseFloat(value) : fallback;
  const left = number(css?.paddingLeft, 12), right = number(css?.paddingRight, 12);
  const top = number(css?.paddingTop, 12), bottom = number(css?.paddingBottom, 12);
  const borderX = number(css?.borderLeftWidth, 1), borderY = number(css?.borderTopWidth, 1);
  return { insetX: left + borderX, insetY: top + borderY, horizontalPadding: left + right,
    vertical: top + bottom + borderY + number(css?.borderBottomWidth, 1), maxHeight: number(css?.maxHeight, 650) };
}

function updateZoomControls(state) {
  const { decrease, increase, value, readable } = state.zoomUI;
  const focused = document.activeElement;
  decrease.disabled = state.zoom <= MIN_ZOOM;
  increase.disabled = state.zoom >= MAX_ZOOM;
  readable.hidden = state.zoom >= 1;
  if (decrease.disabled && focused === decrease) increase.focus();
  if (increase.disabled && focused === increase) decrease.focus();
  if (readable.hidden && focused === readable) increase.focus();
  value.textContent = `${Math.round(state.zoom * 1000) / 10}%`;
}

function waitForDrag(state) {
  if (!state.dragNode) return false;
  state.zoomUI.notice.textContent = ZOOM_WAIT_DRAG;
  return true;
}

function changeZoom(state, wanted, x, y) {
  if (waitForDrag(state)) return;
  const { box, svg, size } = state.view;
  const next = clampZoom(wanted);
  if (next === state.zoom) {
    if (!state.zoomUI.notice.textContent && next === MAX_ZOOM) state.zoomUI.notice.textContent = '그림은 200%까지 확대할 수 있어요.';
    if (!state.zoomUI.notice.textContent && next === MIN_ZOOM) state.zoomUI.notice.textContent = '그림은 1%까지 축소할 수 있어요.';
    return;
  }
  state.zoomUI.notice.textContent = '';
  // The SVG starts inside the scroll box's border and padding.
  const { insetX, insetY } = boxMetrics(box);
  const centerX = (x ?? (box.clientWidth / 2 + (box.clientLeft ?? 1))) - insetX;
  const centerY = (y ?? (box.clientHeight / 2 + (box.clientTop ?? 1))) - insetY;
  const left = zoomScroll(box.scrollLeft, centerX, state.zoom, next);
  const top = zoomScroll(box.scrollTop, centerY, state.zoom, next);
  state.zoom = next;
  svg.setAttribute('width', size.width * next);
  svg.setAttribute('height', size.height * next);
  box.scrollLeft = left;
  box.scrollTop = top;
  updateZoomControls(state);
  clearTimeout(state.zoomAnnouncement);
  state.zoomAnnouncement = setTimeout(() => { state.zoomUI.announcement.textContent = `그림 배율 ${state.zoomUI.value.textContent}`; }, 250);
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
  return state.history.busy || state.history.pendingWrites > 0 || state.history.needsRefresh || state.dragNode != null || state.pending.size > 0 || state.sending.size > 0 || state.moves.size > 0;
}

function updateHistoryControls(state) {
  if (!state.historyUI) return;
  const { undo, redo } = state.historyUI;
  const pending = historyPending(state);
  undo.disabled = pending || state.history.undo.length === 0;
  redo.disabled = pending || state.history.redo.length === 0;
}

function historyKey(state, event) {
  if (!state || state.phone || state.ctx.data.diagram.removed || !state.historyUI || state.pictureBox?.isConnected === false) return;
  const key = String(event.key);
  const physicalZ = event.code === 'KeyZ' && /^\p{L}$/u.test(key) && !/^\p{Script=Latin}$/u.test(key);
  if (!(event.ctrlKey || event.metaKey) || event.altKey || (key.toLowerCase() !== 'z' && !physicalZ)) return;
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
  if (history.inFlight !== null) return;
  if (retryKey === null && historyPending(state)) return;
  const fromStack = redo ? history.redo : history.undo;
  const toStack = redo ? history.undo : history.redo;
  const entry = fromStack.at(-1);
  if (!entry) return;
  const target = redo ? entry.to : entry.from;
  const expected = redo ? (entry.automatic ? entry.drawn : entry.from) : entry.to;
  const reset = !redo && entry.automatic;
  const focusAtStart = document.activeElement;
  if (document.activeElement === state.historyUI?.undo) state.historyFocus = 'undo';
  else if (document.activeElement === state.historyUI?.redo) state.historyFocus = 'redo';
  state.historyFocusNode = state.historyFocus ? focusAtStart : null;
  history.busy = true;
  updateHistoryControls(state);
  const path = `${diagramApi(state.ctx.data.diagram.project, state.diagram)}/positions`;
  const requestKey = retryKey ?? newRequestKey();
  const epoch = history.epoch;
  const flight = Symbol('history-write');
  history.inFlight = flight;
  store('sessionStorage', historyMark(state.diagram), '1');
  history.pendingWrites += 1;
  let outcome;
  try {
    outcome = await state.ctx.shell.write('POST', path,
      { element: entry.key, x: target.x, y: target.y, expected, ...(reset ? { reset: true } : {}) }, requestKey);
  } finally { history.pendingWrites -= 1; }
  if (history.inFlight !== flight || history.epoch !== epoch) { recoverInterrupted(state, outcome); return; }
  history.inFlight = null;
  if (outcome.status >= 200 && outcome.status < 500 && history.pendingWrites === 0) store('sessionStorage', historyMark(state.diagram), null);
  if (outcome.status === 200) {
    if (reset) entry.drawn = { x: outcome.body.x, y: outcome.body.y };
    fromStack.pop();
    toStack.push(entry);
    if (!state.live()) { history.busy = false; return; }
    const element = (state.ctx.data.diagram.elements ?? []).find((each) => each.key === entry.key);
    if (element) {
      element.position = reset ? entry.drawn : { x: outcome.body.x, y: outcome.body.y };
      element.position_saved = !reset;
      if (reset && element.detail?.box) Object.assign(element.detail.box, entry.drawn);
    }
    if (reset) {
      await state.ctx.shell.reload();
      if (!state.live()) { history.busy = false; return; }
      if (state.ctx.shell.fresh('diagram')?.id !== state.diagram) {
        history.busy = false;
        history.needsRefresh = true;
        history.interruptedOutcome = outcome;
        fill(state.moveNotice, state.ctx.shell.errorNotice(state.ctx.shell.readFailure('diagram'), () => recoverInterrupted(state, outcome)));
        updateHistoryControls(state);
        return;
      }
    }
    history.busy = false;
    fill(state.moveNotice, h('div', { class: 'nt info', role: 'status' }, redo ? '이동을 다시 실행했어요.' : '이동을 되돌렸어요.'));
    const currentFocus = document.activeElement;
    const changedFocus = currentFocus && currentFocus !== document.body && currentFocus !== focusAtStart && currentFocus.isConnected !== false;
    if (changedFocus) { state.historyFocus = null; state.historyFocusNode = null; }
    else state.focus = entry.key;
    drawPicture(state);
    return;
  }
  if (!state.live()) { history.busy = false; return; }
  if (outcome.status === 409 && outcome.code === 'position_changed') {
    history.undo.length = 0;
    history.redo.length = 0;
    history.busy = false;
    await state.ctx.shell.reload();
    if (state.live()) fill(state.moveNotice, h('div', { class: 'nt warn', role: 'alert' }, '다른 곳에서 위치가 바뀌었어요. 그림을 다시 확인해 주세요.'));
    updateHistoryControls(state);
    return;
  }
  if (outcome.status === 404 && ['element_not_found', 'diagram_not_found', 'project_not_found'].includes(outcome.code)) {
    history.undo.length = 0; history.redo.length = 0; history.busy = false;
    await state.ctx.shell.reload();
    if (state.live()) fill(state.moveNotice, h('div', { class: 'nt warn', role: 'alert' }, '그림이 바뀌어 이동 기록을 지웠어요. 그림을 다시 확인해 주세요.'));
    updateHistoryControls(state);
    return;
  }
  if ((outcome.status >= 400 && outcome.status < 500) && outcome.status !== 401 && outcome.status !== 403) {
    history.undo.length = 0; history.redo.length = 0; history.busy = false;
    fill(state.moveNotice, h('div', { class: 'nt warn', role: 'alert' }, '이동을 처리하지 못해 이동 기록을 지웠어요. 그림을 다시 확인해 주세요.'));
    updateHistoryControls(state);
    return;
  }
  if (outcome.failure === 'timeout' || outcome.failure === 'network' || outcome.failure === 'answer' || outcome.status >= 500) {
    let refreshing = false;
    fill(state.moveNotice, state.ctx.shell.errorNotice(outcome, () => {
      if (!refreshing) runHistory(state, redo, requestKey);
    }), h('button', { class: 'btn tertiary sm', type: 'button', on: { click: async () => {
        if (refreshing || history.inFlight !== null) return;
        refreshing = true;
        await state.ctx.shell.reload();
        const fresh = state.ctx.shell.fresh('diagram');
        if (fresh?.id === state.diagram && state.live()) {
          history.undo.length = 0; history.redo.length = 0; history.busy = false;
          history.invalidated = false;
          store('sessionStorage', historyMark(state.diagram), null);
          fill(state.moveNotice, h('div', { class: 'nt warn', role: 'alert' }, '저장 결과를 확인하지 못해 이동 기록을 지웠어요. 그림을 다시 확인해 주세요.'));
          updateHistoryControls(state);
        }
        refreshing = false;
      } } }, '새로 고침'));
    return;
  }
  history.busy = false;
  updateHistoryControls(state);
  if (outcome.status === 401 || outcome.status === 403 || outcome.failure === 'gate') return;
  fill(state.moveNotice, state.ctx.shell.errorNotice(outcome, () => runHistory(state, redo)));
}

// A write that finished after leaving must be read again before that diagram accepts another move.
async function recoverInterrupted(state, outcome) {
  const history = state.history;
  history.needsRefresh = true;
  history.interruptedOutcome = outcome ?? history.interruptedOutcome;
  if (history.pendingWrites > 0 || history.refreshing) return;
  const shell = state.ctx.shell;
  const active = states.get(shell);
  if (!active || active.history !== history || !active.live()) return;
  history.refreshing = true;
  updateHistoryControls(active);
  await shell.reload();
  const fresh = shell.fresh('diagram');
  history.refreshing = false;
  const shown = states.get(shell);
  if (!shown || shown.history !== history || !shown.live()) return;
  if (fresh?.id === shown.diagram) {
    history.needsRefresh = false;
    if (history.interruptedOutcome?.status >= 200 && history.interruptedOutcome.status < 500) {
      store('sessionStorage', historyMark(shown.diagram), null);
    }
    fill(shown.moveNotice, h('div', { class: 'nt warn', role: 'alert' }, '이전 이동 결과를 다시 읽었어요. 그림을 확인해 주세요.'));
    drawPicture(shown);
    updateHistoryControls(shown);
  } else {
    fill(shown.moveNotice, shell.errorNotice(shell.readFailure('diagram'), () => recoverInterrupted(shown, history.interruptedOutcome)));
  }
}

// Whether element moves: a box not drawn round others, on a picture that moves, of a diagram not removed, on a PC.
function movable(state, element) {
  const diagram = state.ctx.data.diagram;
  return !state.phone && !state.history.busy && state.history.pendingWrites === 0 && !state.history.needsRefresh && state.failed.size === 0 && state.sending.size === 0
    && (state.pending.size === 0 || state.pending.has(element.key)) && !diagram.removed
    && MOVED_KINDS.has(diagram.kind) && !CONTAINERS.has(element.kind) && state.view.place.boxes.has(element.key);
}

const ARROWS = Object.freeze({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] });
const positionBound = (value) => Math.max(-1_000_000, Math.min(1_000_000, Math.round(value)));

function keydown(state, element, event) {
  if (changeKey(state, element, event, () => select(state, element.key))) return;
  const way = ARROWS[event.key];
  if (way === undefined || !movable(state, element)) return;
  event.preventDefault();
  fill(state.dragNotice);
  // Keep arrow movement visible in screen pixels at every zoom level, as a drag is.
  const step = Math.round((event.shiftKey ? LONG_STEP : STEP) / state.zoom);
  const at = state.view.place.boxes.get(element.key);
  const wanted = { x: at.x + way[0] * step, y: at.y + way[1] * step };
  const to = { x: positionBound(wanted.x), y: positionBound(wanted.y) };
  moveTo(state, element.key, to);
  if (Math.abs(wanted.x) > 1_000_000 || Math.abs(wanted.y) > 1_000_000) {
    fill(state.dragNotice, h('div', { class: 'nt warn', role: 'status' }, '이 방향으로는 더 옮길 수 없어요.'));
  }
}

// A drag follows the pointer; below 25% it needs an eight-pixel gesture, otherwise DRAG_FROM pixels.
function pointerdown(state, element, event) {
  if ((event.pointerType === 'touch' && event.isPrimary === false) || (event.button !== undefined && event.button !== 0) || !movable(state, element)) return;
  const node = state.view.nodes.get(element.key);
  const holder = node?.parentNode?.parentNode;
  if (!node || !holder) return;
  fill(state.dragNotice);
  const at = state.view.place.boxes.get(element.key);
  const shape = state.view.shapes.get(element.key) ?? null;
  const drag = { key: element.key, start: { x: event.clientX, y: event.clientY }, at, holder, shape, moved: false, to: at, zoom: state.zoom,
    threshold: state.zoom < 0.25 ? 8 : DRAG_FROM };
  if (!state.dragListeners.has(node)) {
    node.addEventListener('pointermove', (move) => dragged(state.drags.get(node), move));
    node.addEventListener('pointerup', (up) => dropped(state, node, up));
    node.addEventListener('pointercancel', () => cancelled(state, node));
    node.addEventListener('lostpointercapture', () => cancelled(state, node));
    state.dragListeners.add(node);
  }
  state.drags.set(node, drag);
  state.dragNode = node;
  updateHistoryControls(state);
  node.setPointerCapture?.(event.pointerId);
}

function dragged(drag, event) {
  if (drag === undefined) return;
  const dx = event.clientX - drag.start.x;
  const dy = event.clientY - drag.start.y;
  if (!drag.moved && Math.hypot(dx, dy) < drag.threshold) return;
  drag.moved = true;
  drag.to = { x: positionBound(drag.at.x + dx / drag.zoom), y: positionBound(drag.at.y + dy / drag.zoom) };
  drag.holder.setAttribute('x', drag.to.x - PAD);
  drag.holder.setAttribute('y', drag.to.y - PAD);
  // A flow box's shape is drawn apart from its button: it follows by an SVG transform, never a style.
  drag.shape?.setAttribute('transform', `translate(${drag.to.x - drag.at.x} ${drag.to.y - drag.at.y})`);
}

// A drag the browser took over, such as for a gesture: the box goes back to where it was, and nothing is sent.
function cancelled(state, node) {
  if (state.zoomUI?.notice.textContent === ZOOM_WAIT_DRAG) state.zoomUI.notice.textContent = '';
  const drag = state.drags.get(node);
  state.drags.delete(node);
  if (state.dragNode === node) state.dragNode = null;
  updateHistoryControls(state);
  if (drag === undefined || !drag.moved) return;
  drag.holder.setAttribute('x', drag.at.x - PAD);
  drag.holder.setAttribute('y', drag.at.y - PAD);
  drag.shape?.removeAttribute('transform');
}

function dropped(state, node, event) {
  if (state.zoomUI?.notice.textContent === ZOOM_WAIT_DRAG) state.zoomUI.notice.textContent = '';
  const drag = state.drags.get(node);
  state.drags.delete(node);
  if (state.dragNode === node) state.dragNode = null;
  if (drag === undefined) { updateHistoryControls(state); return; }
  dragged(drag, event);
  if (drag.moved) {
    const distance = Math.hypot(event.clientX - drag.start.x, event.clientY - drag.start.y);
    const returned = drag.zoom < 0.25 ? distance < drag.threshold : distance === 0;
    moveTo(state, drag.key, returned ? drag.at : drag.to);
  } else updateHistoryControls(state);
}

// Puts a box at a place: chosen, drawn there with its lines, and sent once the moves stop.
function moveTo(state, key, to) {
  const current = state.view.place.boxes.get(key);
  if (current && current.x === to.x && current.y === to.y) {
    if (state.selected !== key) { state.selected = key; drawSelected(state); }
    state.focus = key;
    drawPicture(state);
    return;
  }
  const previous = state.view.place.boxes.get(key);
  if (!state.before.has(key) && previous) {
    const element = (state.ctx.data.diagram.elements ?? []).find((each) => each.key === key);
    const automatic = element?.position_saved === false;
    const box = element?.detail?.box;
    const saved = element?.position_saved === true && element.position ? element.position : previous;
    state.before.set(key, { x: saved.x, y: saved.y, automatic,
      drawn: automatic && box ? { x: box.x, y: box.y } : null });
  }
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
  state.failed.delete(key);
  state.sending.add(key);
  if (state.live()) fill(state.moveNotice, h('div', { class: 'nt info', role: 'status' }, '이동을 저장하고 있어요. 잠시만 기다려 주세요.'));
  const epoch = state.history.epoch;
  store('sessionStorage', historyMark(state.diagram), '1');
  const path = `${diagramApi(diagram.project, diagram.id)}/positions`;
  state.history.pendingWrites += 1;
  let outcome;
  try { outcome = await state.ctx.shell.write('POST', path, { element: key, x: at.x, y: at.y }, requestKey); }
  finally { state.history.pendingWrites -= 1; }
  state.sending.delete(key);
  if (state.history.epoch !== epoch) { recoverInterrupted(state, outcome); return; }
  if (state.sending.size === 0 && state.failed.size === 0 && outcome.status >= 200 && outcome.status < 500) store('sessionStorage', historyMark(state.diagram), null);
  if (outcome.status === 200 && before && (before.x !== at.x || before.y !== at.y)) {
    state.history.redo.length = 0;
    state.history.undo.push({ key, from: { x: before.x, y: before.y }, automatic: before.automatic,
      drawn: before.drawn, to: { x: outcome.body.x, y: outcome.body.y } });
    if (state.history.undo.length > 50) state.history.undo.shift();
  }
  if (states.get(state.ctx.shell) !== state) return;
  if (outcome.status === 200) {
    // The data shown now, which a read again may have replaced while the move was sent.
    const element = (state.ctx.data.diagram.elements ?? []).find((each) => each.key === key);
    if (element !== undefined) {
      element.position = { x: outcome.body.x, y: outcome.body.y };
      element.position_saved = true;
    }
    const now = state.moves.get(key);
    if (now !== undefined && now.x === at.x && now.y === at.y) state.moves.delete(key);
    fill(state.moveNotice);
  } else if (outcome.status === 400 && outcome.code === 'invalid_request') {
    state.moves.delete(key); state.before.delete(key); state.pending.delete(key); state.again.delete(key); state.failed.delete(key);
    store('sessionStorage', historyMark(state.diagram), null);
    fill(state.moveNotice, h('div', { class: 'nt warn', role: 'alert' }, '그 위치로 옮길 수 없어 이동을 취소했어요. 다른 위치로 옮겨 주세요.'));
    drawPicture(state);
    updateHistoryControls(state);
    return;
  } else if (outcome.status === 401 || outcome.status === 403 || outcome.failure === 'gate') {
    state.failed.add(key);
    updateHistoryControls(state);
    return;
  } else if (outcome.status === 404 && outcome.code === 'element_not_found') {
    state.moves.delete(key);
    state.before.delete(key);
    state.again.delete(key);
    fill(state.moveNotice, h('div', { class: 'nt warn', role: 'alert' }, h('div', { class: 'b' }, h('b', {}, WORKBENCH_WORDS.moveGone)),
      h('button', { type: 'button', class: 'btn tertiary sm', on: { click: () => state.ctx.shell.reload() } }, '새로 고침')));
    drawPicture(state);
    return;
  } else if (outcome.status === 404 && (outcome.code === 'diagram_not_found' || outcome.code === 'project_not_found')) {
    // SCR-145#error: after a write, the diagram is read again first. A removed one still listed opens for what waits on
    // it (TASK-468), and otherwise the shell says that it is gone. The box goes back to where it was until then.
    state.moves.delete(key);
    state.before.delete(key);
    state.again.delete(key);
    fill(state.moveNotice);
    drawPicture(state);
    state.ctx.shell.reload();
    return;
  } else {
    state.failed.add(key);
    const keep = outcome.failure === 'timeout' || outcome.failure === 'network' ? { key: requestKey, at, before } : null;
    if (keep === null && before && !state.before.has(key)) state.before.set(key, before);
    fill(state.moveNotice, state.ctx.shell.errorNotice(outcome, () => {
      if (state.sending.has(key)) return;
      fill(state.moveNotice);
      send(state, key, keep);
    }));
  }
  updateHistoryControls(state);
  if (state.again.delete(key)) send(state, key, null);
}
