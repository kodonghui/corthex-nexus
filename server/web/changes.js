// SCR-145's changes (TASK-460; SPEC-019 to SPEC-023, SPEC-027): the AI proposals the owner answers, the direct edits
// the owner makes, and what waits for reflection. workbench.js builds the screen and calls this module where its body,
// its work panel, its Selected panel and its keys meet a change; overlays.js reads what lies over the picture (API-265).
//
// - "AI 제안" (PC and phone): each proposal still proposed, with its kind, its text and its reason, and 수락 and 거절. Each asks
//   once, then gives a ten-second Undo before sending (API-270, API-271). A removed diagram's proposals
//   show 거절 only (SPEC-027). An accepted proposal stays there, "수락했어요. …" with 반영 대기, until it is reflected.
// - "이 그림" while anything waits (SCR-145#waiting): 반영 대기 N, why confirming waits, the list of what waits (newest
//   accepted first, as API-265 gives it), each direct edit with 편집 취소 (API-273), and the confirm button off. On a
//   removed diagram the list only, in the button's place.
// - "이 그림" otherwise (TASK-461; SPEC-029, SPEC-030, SPEC-034): the state of the latest confirmation (확정 전, 확정함,
//   바뀐 곳 N, 그려지지 않음), up to four elements changed since it with "+N개 더" to SCR-146, the note on AI proposals,
//   and the record request, which asks once with confirm and cancel before it is sent (API-275). A live confirmation
//   has 확정 취소 instead, sent at once (API-276). A removed diagram has neither (SPEC-027). A mockup lists its tokens
//   there. confirm.js holds the words and reads the confirmation.
// - SCR-146 (changes-page.js) draws its body through this module too (state.drawPage), with the same line, the same
//   waiting rows and 편집 취소, and the same 이 그림 확정.
// - Renaming (API-272): the Selected panel's name field, reached by a double click or F2 on an element. Enter sends a
//   changed name; Escape, or leaving the field, puts the name back and sends nothing. A refused name stays typed.
// - Connecting (API-272): 잇기 in the Selected panel, and the next element chosen is the other end; 취소 or Escape stops.
// - The Selected panel lists the chosen element's changes that wait, newest on top (SPEC-022).
// - A phone can confirm and answer proposals after a question; direct editing and cancellations stay on a PC (SPEC-051).
//
// Every answer that changes something reads the diagram again (shell.reload), so the picture shows what API-265 gives.
// What this module keeps is in the workbench's state of the diagram (state.changes), never in the browser's storage.

import { changesHref, diagramApi, projectApi } from './address.js';
import { isRetryableOutcome, newRequestKey } from './api.js';
import {
  changedSentence, changedSince, changedTag, CONFIRM_WORDS, isDrawn, liveConfirmation, moreChanges, panelRow, recordPullRequest,
  SHOWN_CHANGES,
} from './confirm.js';
import { fill, h } from './dom.js';
import { isProposed, isWaiting, KIND_WORDS, kindOfKey, MARK_WORDS, waitingOf } from './overlays.js';

// The words of SCR-145's changes: the mockup's, the screen definition's, and the coordinator's choices for TASK-460.
export const CHANGE_WORDS = Object.freeze({
  diagram: '이 그림',
  proposals: 'AI 제안',
  proposalsNote: 'AI가 만든 제안이에요. 수락하고 에이전트가 반영하기 전에는 문서에 들어가지 않아요.',
  allAnswered: '모두 처리함',
  accept: '수락',
  reject: '거절',
  stop: '취소',
  askAccept: '수락할까요?',
  askReject: '거절할까요?',
  accepted: '수락했어요. 에이전트가 문서에 넣으면 실선이 돼요.',
  askNew: '새 제안을 부탁하세요.',
  waitingWhy: '반영을 기다리는 변경을 먼저 반영하거나 취소하세요. 에이전트가 문서에 넣으면 이 표시가 사라져요.',
  confirm: '이 그림 확정하고 기록 요청',
  cancelEdit: '편집 취소',
  acceptedProposal: 'AI 제안 수락',
  nameLabel: '이름',
  connect: '잇기',
  pick: '이을 요소를 고르세요.',
  connected: '이미 이어져 있어요.',
  reload: '새로 고침',
});

export const toAnswer = (count) => `답할 것 ${count}`;
export const waitingCount = (count) => `${MARK_WORDS.wait} ${count}`;
export const renamedFrom = (name) => `이름 바꾸기 · ${name}에서`;

// The words of a proposal's steps (choice 2): an add whose key names a DDD kind takes that kind's word, as the mockup's
// "이벤트 더하기"; a proposal with no steps adds by trace ID, or else changes what its items are.
const STEP_WORDS = Object.freeze({ add: '더하기', rename: '이름 바꾸기', connect: '잇기', remove: '지우기' });
const NO_STEPS = '바꾸기';

// The kind line of a change set: the words of its steps in their order, each once, joined with " · ".
export function kindLine(set) {
  const steps = set.changes ?? [];
  if (steps.length === 0) return (set.adds ?? []).length > 0 ? STEP_WORDS.add : NO_STEPS;
  const words = [];
  for (const step of steps) {
    const kind = step.op === 'add' ? kindOfKey(step.element) : null;
    const word = kind === null ? STEP_WORDS[step.op] : `${KIND_WORDS[kind]} ${STEP_WORDS.add}`;
    if (word !== undefined && !words.includes(word)) words.push(word);
  }
  return words.length === 0 ? NO_STEPS : words.join(' · ');
}

// What the server's direct edits take (the server's README, "Direct edits"): an element drawn as unreadable, missing or
// left out takes none; three names are the drawer's, not the document's; a connection joins the kinds its picture draws
// its lines between. A mockup takes no direct edit, and screen states no connection.
const UNREADABLE = new Set(['unreadable', 'missing', 'left_out']);
const JOINS = Object.freeze({
  erd: new Set(['table']),
  sitemap: new Set(['screen']),
  user_flow: new Set(['terminal', 'step', 'decision', 'document', 'store', 'llm', 'grading']),
  ddd_board: new Set(['context', 'external']),
  item_table: new Set(['row']),
});

// The drawing a direct edit names: the one the diagram shows, the last good one when the current one failed.
export function shownDrawing(diagram) {
  return diagram.drawing?.status === 'drawn' ? diagram.drawing.id : diagram.last_drawn?.id ?? null;
}

// Whether the owner edits this diagram here: on a PC, not removed (SPEC-027), not the mockup, with a drawing shown.
function edits(state) {
  const diagram = state.ctx.data.diagram;
  return !state.phone && !diagram.removed && diagram.kind !== 'mockup' && shownDrawing(diagram) !== null;
}

export function renames(state, element) {
  const diagram = state.ctx.data.diagram;
  if (!edits(state) || UNREADABLE.has(element.status ?? '') || element.kind === 'token' || element.kind === 'hotspot_lane') return false;
  return !(element.kind === 'line' && (diagram.kind === 'erd' || diagram.kind === 'sitemap'));
}

export function joins(state, element) {
  const diagram = state.ctx.data.diagram;
  return edits(state) && !UNREADABLE.has(element.status ?? '') && JOINS[diagram.kind]?.has(element.kind) === true;
}

// The name an element shows on top: its waiting or proposed rename's, or its own (overlays.js nameWith).
function nameOnTop(state, key) {
  return state.model.marks.get(key)?.rename?.name ?? state.names.get(key) ?? key;
}

const elementOf = (state, key) => (state.ctx.data.diagram.elements ?? []).find((element) => element.key === key);

// Makes this view's parts, once per build of the workbench: the line over the picture, the panel's two sections ("이
// 그림" only on a mockup, which takes no overlay), and the Selected panel's two blocks. New data from a read clears what the line
// said and the question asked; the name typed and refused stays.
export function changesOf(state) {
  const fresh = state.changes === undefined;
  if (fresh) {
    state.changes = { data: null, asking: null, busy: null, picking: null, draft: null, retry: null, said: null, focus: null, confirmed: null };
  }
  const changes = state.changes;
  if (changes.data !== state.ctx.data) {
    changes.data = state.ctx.data;
    changes.said = changes.picking === null ? null : changes.said;
    changes.asking = null;
  }
  // A read again after a write ends that write's wait: its answer is drawn now.
  if (changes.busy === 'reloading') changes.busy = null;
  if (changes.picking !== null && !joins(state, elementOf(state, changes.picking) ?? {})) {
    changes.picking = null;
    changes.said = null;
  }
  // The element of this module's that has the focus takes it back from the workbench built again, by its ID.
  const active = globalThis.document?.activeElement ?? null;
  const had = [...(changes.ids?.entries() ?? [])].find(([, element]) => element === active)?.[0] ?? null;
  if (changes.focus === null && had !== null) changes.focus = had;
  changes.line = h('div', { class: 'wb-notice wb-line' });
  changes.diagramBox = h('section', { class: 'panel', hidden: true, 'aria-label': CHANGE_WORDS.diagram });
  changes.proposalBox = h('section', { class: 'panel', hidden: true, 'aria-label': CHANGE_WORDS.proposals });
  changes.nameBox = h('div', { class: 'wb-name' });
  changes.moreBox = h('div', { class: 'wb-more' });
  changes.field = null;
  changes.connectButton = null;
  changes.element = null;
  changes.ids = new Map();
  const diagram = state.ctx.data.diagram;
  return { line: changes.line, sections: diagram.kind === 'mockup' ? [changes.diagramBox] : [changes.diagramBox, changes.proposalBox] };
}

// Draws the line, the two sections and the Selected panel's list again from the state; name draws the name field too.
// The element that had the focus gets it back by its ID, or the one changes.focus names takes it: an ID of this module's,
// or { element } for an element's box in the picture.
export function drawChanges(state, { name = false } = {}) {
  const changes = state.changes;
  const active = globalThis.document?.activeElement ?? null;
  const had = [...(changes.ids?.entries() ?? [])].find(([, element]) => element === active)?.[0] ?? null;
  changes.ids = new Map();
  drawLine(state);
  if (state.drawPage !== undefined) {
    // SCR-146 (changes-page.js): its body in place of the workbench's sections.
    state.drawPage(state);
  } else {
    drawDiagram(state);
    drawProposals(state);
    const element = changes.element === null ? undefined : elementOf(state, changes.element);
    if (element !== undefined) {
      if (name) drawName(state, element);
      else if (changes.field !== null) own(state, 'element-name', changes.field);
      drawMore(state, element);
    }
  }
  const wanted = changes.focus ?? had;
  changes.focus = null;
  // SCR-146 has no picture: an element's focus goes to the page's first heading there.
  const target = wanted === null
    ? undefined
    : typeof wanted === 'object' ? state.view?.nodes.get(wanted.element) ?? changes.ids.get('page-top') : changes.ids.get(wanted) ?? changes.ids.get('page-top');
  if (target === undefined || target === active) return;
  // The sections are not in the page yet when the workbench was just built: they take the focus once they are.
  if (target.isConnected === false) queueMicrotask(() => target.focus());
  else target.focus();
}

export const own = (state, id, element) => {
  state.changes.ids.set(id, element);
  return element;
};
export const off = (state) => (state.changes.busy === null ? null : 'true');

// What the line over the picture says: choosing the other end of a connection, a connection that exists, a change
// that is gone, a refusal for a state that changed (SCR-145#stale), a request refused as it is, or a failure with
// 다시 시도.
function drawLine(state) {
  const changes = state.changes;
  const { shell } = state.ctx;
  const said = changes.said;
  if (said === null) {
    fill(changes.line);
    return;
  }
  if (said.kind === 'pick') {
    const stop = own(state, 'pick-stop', h('button', {
      type: 'button', class: 'btn tertiary sm', id: 'pick-stop', on: { click: () => stopPicking(state, true), keydown: (event) => escape(state, event) },
    }, CHANGE_WORDS.stop));
    fill(changes.line, h('div', { class: 'nt', role: 'status' }, h('div', { class: 'b' }, h('b', {}, CHANGE_WORDS.pick)), stop));
  } else if (said.kind === 'connected') {
    fill(changes.line, h('div', { class: 'nt', role: 'status' }, h('div', { class: 'b' }, h('b', {}, CHANGE_WORDS.connected))));
  } else if (said.kind === 'stale' || said.kind === 'gone') {
    // The shell's stale bar, with a 새로 고침 that also takes it away: a read again that answers what is shown does not
    // draw the screen again (shell.js settle). Accepting adds "새 제안을 부탁하세요." (SCR-145).
    const kept = said.kind === 'stale' && said.verb === 'accept' ? CHANGE_WORDS.askNew : null;
    fill(changes.line, h('div', { class: 'nt warn', role: 'alert' },
      h('div', { class: 'b' }, h('b', {}, shell.message(said.code)), kept === null ? null : h('span', {}, kept)),
      h('button', { type: 'button', class: 'btn tertiary sm', on: { click: () => readAgain(state) } }, CHANGE_WORDS.reload)));
  } else if (said.kind === 'refused') {
    // A request the server refuses as it is (400, 413): its message, and no 다시 시도, which would send it again.
    fill(changes.line,
      h('div', { class: 'nt err', role: 'alert' }, h('div', { class: 'b' }, h('b', {}, shell.message(said.code)))),
      said.traceId ? h('span', { class: 'helper mono' }, `traceId ${said.traceId}`) : null);
  } else {
    fill(changes.line, shell.errorNotice(said.outcome, () => {
      state.changes.said = null;
      drawLine(state);
      said.retry();
    }));
  }
}

function readAgain(state) {
  state.changes.said = null;
  drawLine(state);
  state.ctx.shell.reload();
}

// "이 그림" on the workbench's panel (SCR-145): what waits for reflection while anything does (SCR-145#waiting), and
// otherwise the state of the latest confirmation and its button. A removed diagram has no confirmation part, so what
// waits stands alone, without the reason (SPEC-027); a phone can confirm but cannot cancel a confirmation or edit
// (SPEC-051). A mockup takes no overlay and lists its tokens here on a PC (SPEC-009).
function drawDiagram(state) {
  const box = state.changes.diagramBox;
  const parts = diagramParts(state);
  box.hidden = parts === null;
  fill(box, parts ?? []);
}

function diagramParts(state) {
  const diagram = state.ctx.data.diagram;
  const waiting = diagram.kind === 'mockup' ? [] : waitingOf(diagram);
  const tokens = diagram.kind === 'mockup' && !state.phone ? state.tokenBox ?? null : null;
  const heading = (...tags) => h('div', { class: 'ph' },
    own(state, 'diagram-heading', h('h2', { id: 'diagram-heading', tabindex: '-1' }, CHANGE_WORDS.diagram)), tags);
  const waitingTag = () => h('span', { class: 'tag teal' }, waitingCount(waiting.length));
  const list = () => h('ul', { class: 'chg' }, waiting.map((set) => waitingRow(state, set, 'w')));
  if (diagram.removed) {
    if (waiting.length > 0) return [heading(waitingTag()), list()];
    return tokens === null ? null : [heading(), tokens];
  }
  const live = liveConfirmation(diagram);
  if (waiting.length > 0) {
    // A live confirmation stays, with its line and 확정 취소; otherwise confirming waits, its button off.
    if (live !== null) return [heading(confirmedTag(), waitingTag()), confirmedLines(state, live), list(), cancelButton(state, live)];
    return [heading(waitingTag()), h('p', {}, CHANGE_WORDS.waitingWhy), list(), state.phone ? null : offButton()];
  }
  if (state.phone) {
    if (!isDrawn(diagram)) return [heading(...(live === null ? [] : [confirmedTag()]), h('span', { class: 'tag red' }, CONFIRM_WORDS.notDrawn)),
      h('p', {}, CONFIRM_WORDS.phoneNotDrawn), live === null ? h('p', { class: 'small' }, CONFIRM_WORDS.phone) : confirmedLines(state, live)];
    if (live !== null) return [heading(confirmedTag()), confirmedLines(state, live)];
    return [sinceParts(state, heading), diagram.kind === 'mockup' ? null : h('p', { class: 'small' }, CONFIRM_WORDS.leftOut),
      h('p', {}, CONFIRM_WORDS.beforeConfirm), confirmControl(state), h('p', { class: 'small' }, CONFIRM_WORDS.phone)];
  }
  if (!isDrawn(diagram)) {
    // SCR-145#not-drawn: nothing to confirm until the document draws; a live confirmation keeps its line and 확정 취소.
    return [
      heading(h('span', { class: 'tag red' }, CONFIRM_WORDS.notDrawn)),
      h('p', {}, CONFIRM_WORDS.fixFirst),
      live === null ? [tokens, offButton()] : [confirmedLines(state, live), tokens, cancelButton(state, live)],
    ];
  }
  if (live !== null) return [heading(confirmedTag()), confirmedLines(state, live), tokens, cancelButton(state, live)];
  return [
    sinceParts(state, heading),
    tokens,
    diagram.kind === 'mockup' ? null : h('p', { class: 'small' }, CONFIRM_WORDS.leftOut),
    h('p', {}, CONFIRM_WORDS.beforeConfirm),
    confirmControl(state),
  ];
}

// What a diagram not confirmed now shows (choice 3): never confirmed, "확정 전" and that nothing is marked; its last
// confirmation ended by a change, "바뀐 곳 N", the sentence and up to four elements, or "확정 전" alone when no element
// changed; cancelled, "확정 전", that it was cancelled, and the elements changed since. "+N개 더" goes to SCR-146 when
// there are more than four.
function sinceParts(state, heading) {
  const diagram = state.ctx.data.diagram;
  const since = changedSince(diagram);
  const before = () => h('span', { class: 'tag gray' }, CONFIRM_WORDS.notConfirmed);
  if (since === null) return [heading(before()), h('p', { class: 'sec' }, CONFIRM_WORDS.neverConfirmed)];
  const count = since.rows.length;
  const visitable = since.rows.filter((row) => row.mark !== 'del');
  const tour = visitable.length && state.selectChanged ? h('button', { type: 'button', class: 'btn tertiary', on: { click: () => {
    const index = (state.changeTourIndex ?? -1) + 1;
    state.changeTourIndex = index % visitable.length;
    state.selectChanged(visitable[state.changeTourIndex].key);
    drawChanges(state);
  } } }, state.changeTourIndex === undefined ? '바뀐 곳 둘러보기' : `다음 바뀐 곳 (${state.changeTourIndex + 1}/${visitable.length})`) : null;
  const rows = count === 0 ? null : [
    tour,
    h('ul', { class: 'chg' }, since.rows.slice(0, SHOWN_CHANGES).map(panelRow)),
    count > SHOWN_CHANGES ? h('a', { class: 'small', href: changesFor(state) }, moreChanges(count - SHOWN_CHANGES)) : null,
  ];
  if (diagram.confirmation?.state === 'cancelled') return [heading(before()), h('p', { class: 'sec' }, CONFIRM_WORDS.cancelled), rows];
  if (count === 0) return [heading(before())];
  return [heading(h('span', { class: 'tag purple' }, changedTag(count))), h('p', { class: 'sec' }, changedSentence(count)), rows];
}

// SCR-146 of the diagram shown.
function changesFor(state) {
  const { address, data } = state.ctx;
  return changesHref(address.project, address.part, address.stage, { diagram: data.diagram.id });
}

const confirmedTag = () => h('span', { class: 'tag green' }, CONFIRM_WORDS.confirmed);

// The live confirmation's line and, in small text under it, "기록됨 · 3분 전 · PR #12 ↗" once the agent recorded it, the
// pull request a link only for an https link (TASK-469, choice 2), and a recording explanation
// until then, while the record's pull request is open too. A phone shows the same lines.
function confirmedLines(state, live) {
  if (!live.recorded_at) return [h('p', {}, CONFIRM_WORDS.confirmedHere), h('p', { class: 'small' }, CONFIRM_WORDS.untilRecorded)];
  const link = recordPullRequest(live.pull_request);
  return [
    h('p', {}, CONFIRM_WORDS.confirmedHere),
    h('p', { class: 'small' },
      state.ctx.shell.since(live.recorded_at, (ago) => `${CONFIRM_WORDS.recorded} · ${ago}`),
      link === null ? null : [' · ', link]),
  ];
}

// 이 그림 확정 drawn off, while something waits or the document does not draw: the panel's at its full width, SCR-146's
// at its own.
const offButton = (wide = true) => h('button', { type: 'button', class: wide ? 'btn primary wide' : 'btn primary', disabled: true }, CHANGE_WORDS.confirm);
export const pageOffButton = () => offButton(false);

// The ID the question of 이 그림 확정 is asked under, apart from every change set's.
const CONFIRMING = 'confirm';

// The record request, or its question with confirm and cancel; Escape stops asking. wide is
// the panel's full-width button; SCR-146 draws it at its own width.
export function confirmControl(state, { wide = true } = {}) {
  const changes = state.changes;
  if (changes.asking?.id === CONFIRMING) {
    const yes = own(state, 'confirm-yes', h('button', {
      type: 'button', class: 'btn primary sm', id: 'confirm-yes', 'aria-disabled': off(state), on: { click: () => confirmDiagram(state) },
    }, CONFIRM_WORDS.yes));
    const stop = own(state, 'confirm-stop', h('button', {
      type: 'button', class: 'btn ghost sm', id: 'confirm-stop', 'aria-disabled': off(state), on: { click: () => stopConfirming(state) },
    }, CONFIRM_WORDS.stop));
    return h('div', {
      class: 'btns mid', role: 'group', 'aria-labelledby': 'confirm-ask',
      on: { keydown: (event) => event.key === 'Escape' && stopConfirming(state) },
    }, h('span', { id: 'confirm-ask' }, CONFIRM_WORDS.askConfirm), yes, stop);
  }
  return own(state, 'confirm', h('button', {
    type: 'button', class: wide ? 'btn primary wide' : 'btn primary', id: 'confirm', 'aria-disabled': off(state),
    on: { click: () => askConfirming(state) },
  }, CHANGE_WORDS.confirm));
}

// 확정 취소 on a PC, sent at once (choice 2).
function cancelButton(state, live) {
  if (state.phone) return null;
  return own(state, 'cancel-confirmation', h('button', {
    type: 'button', class: 'btn tertiary wide', id: 'cancel-confirmation', 'aria-disabled': off(state),
    on: { click: () => cancelConfirmation(state, live) },
  }, CONFIRM_WORDS.cancelConfirmation));
}

// Whether this diagram can be confirmed here: not removed, drawn, with nothing waiting and no live confirmation
// (SPEC-029). The server refuses the rest anyway.
export function confirmable(state) {
  const diagram = state.ctx.data.diagram;
  return !diagram.removed && isDrawn(diagram) && liveConfirmation(diagram) === null && waitingOf(diagram).length === 0;
}

function askConfirming(state) {
  const changes = state.changes;
  if (changes.busy !== null || !confirmable(state)) return;
  changes.asking = { id: CONFIRMING, verb: 'confirm' };
  changes.focus = 'confirm-stop';
  drawChanges(state);
}

function stopConfirming(state) {
  const changes = state.changes;
  if (changes.asking?.id !== CONFIRMING || changes.busy !== null) return;
  changes.asking = null;
  changes.focus = 'confirm';
  drawChanges(state);
}

// API-275 on the drawing shown, once asked, or sent again by 다시 시도. A 200 or a 201 is the confirmed state, which the
// page that sent it says while that confirmation stays live (SCR-146#confirmed).
async function confirmDiagram(state) {
  const changes = state.changes;
  if (changes.busy !== null || !confirmable(state)) return;
  const diagram = state.ctx.data.diagram;
  const outcome = await post(state, 'confirm', `${diagramApi(diagram.project, diagram.id)}/confirmation`, { drawing: diagram.drawing.id });
  if (outcome === null) return;
  if (outcome.status === 200 || outcome.status === 201) changes.confirmed = outcome.body?.confirmation?.id ?? null;
  met(state, outcome, { verb: 'confirm', retry: () => confirmDiagram(state), focus: 'diagram-heading' });
}

// API-276 on the live confirmation; the heading takes the focus once the diagram is read again.
async function cancelConfirmation(state, live) {
  const changes = state.changes;
  const diagram = state.ctx.data.diagram;
  if (state.phone || changes.busy !== null || diagram.removed) return;
  const path = `${projectApi(diagram.project)}/confirmations/${encodeURIComponent(live.id)}/cancel`;
  const outcome = await post(state, 'unconfirm', path, {});
  if (outcome === null) return;
  met(state, outcome, { verb: 'unconfirm', retry: () => cancelConfirmation(state, live), focus: 'diagram-heading' });
}

// A change set that waits, as the mockup's list writes it: a direct rename's new name over "이름 바꾸기 · X에서", a
// direct connection's ends over 잇기, an accepted proposal's text over "AI 제안 수락". A direct edit has 편집 취소 on a
// PC. where tells the lists apart in the IDs.
function waitingRow(state, set, where) {
  const { id, title, how, cancel } = waitingParts(state, set, where);
  return h('li', {}, h('span', { class: 'grow' }, h('b', { id: `${id}-title` }, title), h('br'), h('span', { class: 'sec' }, how)), cancel);
}

// The parts of a waiting change set's row, for the workbench's lists and SCR-146's: { id, title, how, cancel }.
export function waitingParts(state, set, where) {
  const step = (set.changes ?? [])[0];
  let title;
  let how;
  if (set.origin === 'proposal') {
    title = set.change || kindLine(set);
    how = CHANGE_WORDS.acceptedProposal;
  } else if (step?.op === 'rename') {
    title = step.name ?? '';
    how = renamedFrom(state.names.get(step.element) ?? step.element);
  } else if (step?.op === 'connect') {
    title = `${nameOnTop(state, step.element)} → ${nameOnTop(state, step.target)}`;
    how = CHANGE_WORDS.connect;
  } else {
    title = kindLine(set);
    how = '';
  }
  const id = `${where}-${set.id}`;
  const cancel = set.origin === 'direct_edit' && !state.phone
    ? own(state, `${id}-cancel`, h('button', {
      type: 'button', class: 'btn ghost sm', id: `${id}-cancel`, 'aria-labelledby': `${id}-cancel ${id}-title`, 'aria-disabled': off(state),
      on: { click: () => cancelEdit(state, set) },
    }, CHANGE_WORDS.cancelEdit))
    : null;
  return { id, title, how, cancel };
}

// "AI 제안" on PC or phone: the proposals still proposed and those accepted and waiting, in API-265's order, with the count of
// those to answer, or "모두 처리함". A mockup takes no proposal (SPEC-051).
function drawProposals(state) {
  const changes = state.changes;
  const diagram = state.ctx.data.diagram;
  const box = changes.proposalBox;
  if (diagram.kind === 'mockup') {
    box.hidden = true;
    fill(box);
    return;
  }
  const shown = (diagram.overlays ?? []).filter((set) => set.origin === 'proposal' && (isProposed(set) || isWaiting(set)));
  const open = shown.filter(isProposed).length;
  box.hidden = false;
  const heading = own(state, 'proposals-heading', h('h2', { id: 'proposals-heading', tabindex: '-1' }, CHANGE_WORDS.proposals));
  fill(box,
    h('div', { class: 'ph' }, heading, open > 0 ? h('span', { class: 'tag blue' }, toAnswer(open)) : null),
    h('p', { class: 'small' }, CHANGE_WORDS.proposalsNote),
    open === 0 ? h('p', { class: 'sec' }, CHANGE_WORDS.allAnswered) : null,
    shown.map((set) => proposalCard(state, set)));
}

function proposalCard(state, set) {
  const waiting = isWaiting(set);
  return h('div', { class: 'prop' },
    h('div', { class: 'k' }, h('span', { class: 'ai' }, 'AI'), kindLine(set)),
    set.change ? h('b', { id: `p-${set.id}-title` }, set.change) : null,
    waiting ? h('p', { class: 'sec' }, CHANGE_WORDS.accepted) : (set.reason ? h('p', { class: 'sec' }, set.reason) : null),
    waiting ? h('span', { class: 'tag teal' }, MARK_WORDS.wait) : answers(state, set));
}

// 수락 and 거절, or the question one of them asks. A removed diagram's proposal shows 거절 only (SPEC-027).
function answers(state, set) {
  const changes = state.changes;
  const id = `p-${set.id}`;
  const titled = set.change ? ` ${id}-title` : '';
  const actionPath = `${projectApi(state.ctx.data.diagram.project)}/change-sets/${encodeURIComponent(set.id)}/accept`;
  if (state.ctx.shell.pending?.hasTarget(actionPath)) return h('p', { role: 'status' }, '이 제안은 처리 중이에요. 위 안내를 확인해 주세요.');
  if (changes.asking?.id === set.id) {
    const { verb } = changes.asking;
    const yes = own(state, `${id}-yes`, h('button', {
      type: 'button', class: 'btn primary sm', id: `${id}-yes`, 'aria-disabled': off(state), on: { click: () => answer(state, set, verb) },
    }, verb === 'accept' ? CHANGE_WORDS.accept : CHANGE_WORDS.reject));
    const stop = own(state, `${id}-stop`, h('button', {
      type: 'button', class: 'btn ghost sm', id: `${id}-stop`, 'aria-disabled': off(state), on: { click: () => stopAsking(state, set) },
    }, CHANGE_WORDS.stop));
    return h('div', {
      class: 'btns mid', role: 'group', 'aria-labelledby': `${id}-ask${titled}`,
      on: { keydown: (event) => event.key === 'Escape' && stopAsking(state, set) },
    }, h('span', { id: `${id}-ask` }, verb === 'accept' ? CHANGE_WORDS.askAccept : CHANGE_WORDS.askReject), yes, stop);
  }
  const removed = state.ctx.data.diagram.removed;
  return h('div', { class: 'btns' },
    removed ? null : own(state, `${id}-accept`, h('button', {
      type: 'button', class: 'btn primary sm', id: `${id}-accept`, 'aria-labelledby': `${id}-accept${titled}`, 'aria-disabled': off(state),
      on: { click: () => ask(state, set, 'accept') },
    }, CHANGE_WORDS.accept)),
    own(state, `${id}-reject`, h('button', {
      type: 'button', class: 'btn ghost sm', id: `${id}-reject`, 'aria-labelledby': `${id}-reject${titled}`, 'aria-disabled': off(state),
      on: { click: () => ask(state, set, 'reject') },
    }, CHANGE_WORDS.reject)));
}

function ask(state, set, verb) {
  const changes = state.changes;
  if (changes.busy !== null || (verb === 'accept' && state.ctx.data.diagram.removed)) return;
  const path = `${projectApi(state.ctx.data.diagram.project)}/change-sets/${encodeURIComponent(set.id)}/${verb}`;
  try {
    if (!state.ctx.shell.pending) throw new Error('storage unavailable');
    let pendingKey = null;
    const retry = () => {
      const item = state.ctx.shell.pending.recovered().find((candidate) => candidate.key === pendingKey)
        ?? { key: pendingKey, path, body: {}, state: 'unconfirmed' };
      state.ctx.shell.pending.retry(item, hooks);
    };
    const hooks = {
      done: (_body, outcome) => { if (state.live()) met(state, outcome, { verb, retry, focus: 'proposals-heading' }); },
      failed: (outcome) => {
        if (!state.live()) return;
        const again = isRetryableOutcome(outcome) ? retry : () => ask(state, set, verb);
        met(state, outcome, { verb, retry: again, focus: 'proposals-heading' });
      },
      undone: () => { if (state.live()) drawChanges(state); },
    };
    pendingKey = state.ctx.shell.pending.enqueue(path, {}, hooks);
    drawChanges(state);
  } catch (error) {
    if (error.message === 'already pending') { drawChanges(state); return; }
    changes.said = { kind: 'error', outcome: { failure: 'network' }, retry: () => ask(state, set, verb) };
    drawChanges(state);
  }
}

function stopAsking(state, set) {
  const changes = state.changes;
  if (changes.asking?.id !== set.id || changes.busy !== null) return;
  const { verb } = changes.asking;
  changes.asking = null;
  changes.focus = `p-${set.id}-${verb}`;
  drawChanges(state);
}

// API-270 or API-271 on the proposal asked about, or sent again by 다시 시도.
async function answer(state, set, verb) {
  const changes = state.changes;
  if (changes.busy !== null) return;
  if (verb === 'accept' && state.ctx.data.diagram.removed) return;
  const path = `${projectApi(state.ctx.data.diagram.project)}/change-sets/${encodeURIComponent(set.id)}/${verb}`;
  const outcome = await post(state, verb, path, {});
  if (outcome === null) return;
  met(state, outcome, { verb, retry: () => answer(state, set, verb), focus: 'proposals-heading' });
}

// API-273 on a direct edit that waits. The element it changed takes the focus once the diagram is read again.
async function cancelEdit(state, set) {
  const changes = state.changes;
  if (state.phone || changes.busy !== null || set.origin !== 'direct_edit') return;
  const path = `${projectApi(state.ctx.data.diagram.project)}/change-sets/${encodeURIComponent(set.id)}/cancel`;
  const outcome = await post(state, 'cancel', path, {});
  if (outcome === null) return;
  met(state, outcome, { verb: 'cancel', retry: () => cancelEdit(state, set), element: set.changes?.[0]?.element ?? null });
}

// API-272: a rename or a connection against the drawing shown.
async function directEdit(state, edit) {
  const changes = state.changes;
  const diagram = state.ctx.data.diagram;
  const drawing = shownDrawing(diagram);
  if (state.phone || changes.busy !== null || drawing === null) return;
  const path = `${projectApi(diagram.project)}/diagrams/${encodeURIComponent(diagram.id)}/direct-edits`;
  const outcome = await post(state, edit.op, path, { drawing, ...edit });
  if (outcome === null) return;
  const input = outcome.status === 400 || outcome.status === 413 || (outcome.status === 409 && outcome.code === 'request_key_reused');
  if (edit.op === 'rename' && input) {
    // A refused name (empty, or over 200 characters): the message by the field, the name kept as typed.
    // An element chosen meanwhile keeps the focus; the refused name shows when this one is chosen again.
    keepDraft(state, edit.element, { code: outcome.code ?? 'invalid_request', traceId: outcome.traceId ?? null });
    const here = changes.element === edit.element;
    if (here) changes.focus = 'element-name';
    drawChanges(state, { name: here });
    return;
  }
  if (outcome.status === 200 && edit.op === 'connect') {
    // A connection that exists: nothing new (SPEC-021).
    changes.said = { kind: 'connected' };
    drawChanges(state);
    return;
  }
  met(state, outcome, { verb: edit.op, retry: () => directEdit(state, edit), element: edit.element });
}

// Sends one change, with every change's button off while it runs: { status, … } as api.js answers, or null when the
// workbench no longer shows this diagram. A timeout or a lost connection keeps the request key for 다시 시도 of the
// same request; any other answer makes the next key new.
async function post(state, busy, path, body) {
  const changes = state.changes;
  const signature = `${path} ${JSON.stringify(body)}`;
  const key = changes.retry?.signature === signature ? changes.retry.key : newRequestKey();
  changes.retry = null;
  changes.busy = busy;
  changes.said = null;
  if (changes.field !== null && busy === 'rename') changes.field.setAttribute('readonly', '');
  drawChanges(state);
  const outcome = await state.ctx.shell.write('POST', path, body, key);
  changes.busy = null;
  changes.field?.removeAttribute('readonly');
  if (outcome.failure === 'timeout' || outcome.failure === 'network') changes.retry = { signature, key };
  if (!state.live()) return null;
  return outcome;
}

// What an answer leads to (SCR-145, SCR-146): done, the diagram is read again; a confirm refused because something
// waits or the document does not draw reads it again too, and the screen shows why (SCR-145#waiting, #not-drawn); a
// state that changed is the stale bar; a change, an element, a drawing or a confirmation gone says so with 새로 고침; a
// project or a diagram gone reads the diagram again first, so that a removed one still listed opens as SPEC-027 says
// (SCR-145#error); any other failure says so with 다시 시도.
async function met(state, outcome, { verb, retry, focus = null, element = null }) {
  const changes = state.changes;
  const { shell } = state.ctx;
  if (outcome.status === 404) {
    // shell.outcome would end the page; a change, an element or a drawing gone is this part's to say.
    if (outcome.code === 'project_not_found' || outcome.code === 'diagram_not_found') {
      changes.asking = null;
      drawChanges(state);
      shell.reload();
      return;
    }
    changes.asking = null;
    changes.said = { kind: 'gone', code: outcome.code ?? 'internal' };
    drawChanges(state);
    return;
  }
  const found = shell.outcome(outcome);
  if (found === null) return;
  if (found.state === 'normal' || found.state === 'waiting' || found.state === 'not-drawn') {
    changes.asking = null;
    if (verb === 'rename') changes.draft = null;
    // The buttons stay off until the diagram read again is drawn; then the element changed, or the heading, takes the
    // focus.
    changes.busy = 'reloading';
    drawChanges(state);
    changes.focus = element !== null ? { element } : focus;
    await shell.reload();
    // A read again that answers what is shown draws nothing again (shell.js settle): the buttons come back here.
    if (changes.busy === 'reloading' && state.live()) {
      changes.busy = null;
      drawChanges(state);
    }
    return;
  }
  changes.asking = null;
  if (verb === 'rename') keepDraft(state, element, null);
  if (found.state === 'stale') {
    changes.said = { kind: 'stale', code: outcome.code ?? 'document_changed', verb };
  } else if (outcome.status === 400 || outcome.status === 413) {
    changes.said = { kind: 'refused', code: outcome.code ?? 'invalid_request', traceId: outcome.traceId ?? null };
  } else {
    changes.said = { kind: 'error', outcome, retry };
  }
  drawChanges(state);
}

// The name typed for element stays after a refusal, with its message when refused is given, until Escape or a send.
function keepDraft(state, key, refused) {
  const changes = state.changes;
  const name = changes.draft?.key === key ? changes.draft.name : nameOnTop(state, key);
  changes.draft = { key, name, refused, kept: true };
}

// The Selected panel's name: a field on a PC for an element the server renames, else the name on top as text.
export function nameBlock(state, element) {
  const changes = state.changes;
  changes.element = element.key;
  drawName(state, element);
  return changes.nameBox;
}

function drawName(state, element) {
  const changes = state.changes;
  const shown = nameOnTop(state, element.key);
  if (!renames(state, element)) {
    changes.field = null;
    fill(changes.nameBox, h('p', {}, h('b', {}, shown)));
    return;
  }
  const draft = changes.draft?.key === element.key ? changes.draft : null;
  const refused = draft?.refused ?? null;
  const field = h('input', {
    id: 'element-name', class: refused === null ? 'field' : 'field bad', autocomplete: 'off', spellcheck: 'false',
    readonly: changes.busy === 'rename', 'aria-invalid': refused === null ? null : 'true',
    'aria-describedby': refused === null ? null : 'element-name-err',
    on: {
      input: () => typed(state, element, field),
      keydown: (event) => nameKey(state, element, field, event),
      blur: (event) => { if (event.relatedTarget?.id !== 'save-element-name') left(state, element, field); },
    },
  });
  field.value = draft?.name ?? shown;
  changes.field = own(state, 'element-name', field);
  fill(changes.nameBox,
    h('label', { class: 'l', for: 'element-name' }, CHANGE_WORDS.nameLabel),
    field,
    own(state, 'save-element-name', h('button', { type: 'button', class: 'btn tertiary', id: 'save-element-name',
      'aria-disabled': off(state), on: { pointerdown: (event) => event.preventDefault(),
        blur: () => left(state, element, field),
        click: () => nameKey(state, element, field, { key: 'Enter', preventDefault() {} }) } }, '이름 고치기')),
    refused === null ? null : [
      // A div, not a p: the shell's `.nx p{margin:0}` would take away err-text's space under the field.
      h('div', { class: 'err-text', id: 'element-name-err', role: 'alert' }, state.ctx.shell.message(refused.code)),
      refused.traceId ? h('span', { class: 'helper mono' }, `traceId ${refused.traceId}`) : null,
    ]);
}

function typed(state, element, field) {
  const changes = state.changes;
  const draft = changes.draft?.key === element.key ? changes.draft : null;
  changes.draft = { key: element.key, name: field.value ?? '', refused: draft?.refused ?? null, kept: draft?.kept ?? false };
}

// Enter sends a changed name; Escape puts the name back and gives the focus back to the element.
function nameKey(state, element, field, event) {
  if (event.isComposing) return;
  if (event.key === 'Enter') {
    event.preventDefault();
    const name = field.value ?? '';
    if (state.changes.busy !== null) return;
    if (name === nameOnTop(state, element.key)) {
      const refused = state.changes.draft?.key === element.key && state.changes.draft.refused !== null;
      putBack(state, element);
      if (refused) {
        drawName(state, element);
        state.changes.field?.focus();
      }
      return;
    }
    typed(state, element, field);
    directEdit(state, { op: 'rename', element: element.key, name });
  } else if (event.key === 'Escape') {
    event.preventDefault();
    putBack(state, element);
    drawName(state, element);
    state.view?.nodes.get(element.key)?.focus();
  }
}

// Leaving the field sends nothing and puts the name back, unless it is being sent or it was refused and stays typed.
function left(state, element, field) {
  const changes = state.changes;
  if (changes.busy === 'rename') return;
  const draft = changes.draft?.key === element.key ? changes.draft : null;
  if (draft?.kept) return;
  changes.draft = null;
  field.value = nameOnTop(state, element.key);
}

function putBack(state, element) {
  if (state.changes.draft?.key === element.key) state.changes.draft = null;
}

// F2 or a double click on an element: the name field takes the focus with its text selected.
export function focusName(state) {
  const field = state.changes?.field;
  if (field === null || field === undefined) return;
  field.focus();
  field.select?.();
}

// The Selected panel's actions and list: 잇기 for an element the server joins, and the element's changes that wait,
// newest on top (SPEC-022).
export function moreBlock(state, element) {
  drawMore(state, element);
  return state.changes.moreBox;
}

function drawMore(state, element) {
  const changes = state.changes;
  const diagram = state.ctx.data.diagram;
  const ids = new Set(state.model.marks.get(element.key)?.sets ?? []);
  // A connection lies on both its ends, though the picture marks the one it starts from (overlays.js).
  const ends = (set) => (set.changes ?? []).some((step) => step.op === 'connect' && step.target === element.key);
  const waiting = (diagram.overlays ?? []).filter((set) => isWaiting(set) && (ids.has(set.id) || ends(set)));
  changes.connectButton = joins(state, element)
    ? own(state, 'connect', h('button', {
      type: 'button', class: 'btn ghost sm', id: 'connect', 'aria-pressed': changes.picking === element.key ? 'true' : 'false',
      'aria-disabled': off(state),
      on: { click: () => (changes.picking === element.key ? stopPicking(state, true) : startPicking(state, element)), keydown: (event) => escape(state, event) },
    }, CHANGE_WORDS.connect))
    : null;
  fill(changes.moreBox,
    changes.connectButton === null ? null : h('div', { class: 'btns' }, changes.connectButton),
    waiting.length === 0 ? null : [h('h3', {}, MARK_WORDS.wait), h('ul', { class: 'chg' }, waiting.map((set) => waitingRow(state, set, 's')))]);
}

function startPicking(state, element) {
  const changes = state.changes;
  if (changes.busy !== null || !joins(state, element)) return;
  changes.picking = element.key;
  changes.said = { kind: 'pick' };
  drawChanges(state);
}

// Stops choosing the other end; back gives the focus back to 잇기, as after 취소, whose button goes.
function stopPicking(state, back) {
  const changes = state.changes;
  if (changes.picking === null) return false;
  changes.picking = null;
  changes.said = null;
  if (back) changes.focus = 'connect';
  drawChanges(state);
  return true;
}

// Stops choosing the other end without a connection, when the workbench chooses nothing or a thread's element.
export function stopConnecting(state) {
  if (state.changes !== undefined) stopPicking(state, false);
}

function escape(state, event) {
  if (event.key !== 'Escape' || state.changes.picking === null) return;
  event.preventDefault();
  stopPicking(state, true);
}

// The workbench's choice of an element while 잇기 waits for the other end: an element it joins, other than the first,
// is sent as the connection's target; any other choice does nothing. False when nothing is being connected.
export function picked(state, key) {
  const changes = state.changes;
  if (changes === undefined || changes.picking === null) return false;
  const from = changes.picking;
  const target = elementOf(state, key);
  if (key === from || target === undefined || !joins(state, target) || changes.busy !== null) return true;
  changes.picking = null;
  changes.said = null;
  directEdit(state, { op: 'connect', element: from, target: key });
  return true;
}

// The workbench's keys on an element: Escape stops connecting, and F2 renames the element, which choose chooses first.
// True when the key was this module's.
export function changeKey(state, element, event, choose) {
  const picking = state.changes?.picking ?? null;
  if (event.key === 'Escape' && picking !== null) {
    event.preventDefault();
    stopPicking(state, false);
    return true;
  }
  if (event.key === 'F2' && !event.isComposing) {
    event.preventDefault();
    renameFrom(state, element, choose);
    return true;
  }
  return false;
}

// A double click or F2 on an element: choose chooses it, and its name field takes the focus. Nothing while 잇기 waits
// for the other end, or for an element the server does not rename.
export function renameFrom(state, element, choose) {
  if ((state.changes?.picking ?? null) !== null || !renames(state, element)) return;
  choose();
  focusName(state);
}
