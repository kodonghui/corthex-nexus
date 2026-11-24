// SCR-145's changes (TASK-460; SPEC-019 to SPEC-023, SPEC-027): the AI proposals the owner answers, the direct edits
// the owner makes, and what waits for reflection. workbench.js builds the screen and calls this module where its body,
// its work panel, its Selected panel and its keys meet a change; overlays.js reads what lies over the picture (API-265).
//
// - "AI 제안" (PC): each proposal still proposed, with its kind, its text and its reason, and 수락 and 거절. Each asks
//   once, "수락할까요?" or "거절할까요?" with 취소, before it is sent (API-270, API-271). A removed diagram's proposals
//   show 거절 only (SPEC-027). An accepted proposal stays there, "수락했어요. …" with 반영 대기, until it is reflected.
// - "이 그림" while anything waits (SCR-145#waiting): 반영 대기 N, why confirming waits, the list of what waits (newest
//   accepted first, as API-265 gives it), each direct edit with 편집 취소 (API-273), and the confirm button off. On a
//   removed diagram the list only, in the button's place. TASK-461 adds the rest of the section.
// - Renaming (API-272): the Selected panel's name field, reached by a double click or F2 on an element. Enter sends a
//   changed name; Escape, or leaving the field, puts the name back and sends nothing. A refused name stays typed.
// - Connecting (API-272): 잇기 in the Selected panel, and the next element chosen is the other end; 취소 or Escape stops.
// - The Selected panel lists the chosen element's changes that wait, newest on top (SPEC-022).
// - A phone shows the marks and what waits, and none of these actions (SPEC-051).
//
// Every answer that changes something reads the diagram again (shell.reload), so the picture shows what API-265 gives.
// What this module keeps is in the workbench's state of the diagram (state.changes), never in the browser's storage.

import { projectApi } from './address.js';
import { newRequestKey } from './api.js';
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
  confirm: '이 그림 확정',
  cancelEdit: '편집 취소',
  acceptedProposal: 'AI 제안 수락',
  nameLabel: '이름 · 두 번 누르거나 F2',
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

// Makes this view's parts, once per build of the workbench: the line over the picture, the panel's two sections (none
// on a mockup, which takes no overlay), and the Selected panel's two blocks. New data from a read clears what the line
// said and the question asked; the name typed and refused stays.
export function changesOf(state) {
  const fresh = state.changes === undefined;
  if (fresh) {
    state.changes = { data: null, asking: null, busy: null, picking: null, draft: null, retry: null, said: null, focus: null };
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
  return { line: changes.line, sections: diagram.kind === 'mockup' ? [] : [changes.diagramBox, changes.proposalBox] };
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
  drawDiagram(state);
  drawProposals(state);
  const element = changes.element === null ? undefined : elementOf(state, changes.element);
  if (element !== undefined) {
    if (name) drawName(state, element);
    else if (changes.field !== null) own(state, 'element-name', changes.field);
    drawMore(state, element);
  }
  const wanted = changes.focus ?? had;
  changes.focus = null;
  const target = wanted === null ? undefined : typeof wanted === 'object' ? state.view?.nodes.get(wanted.element) : changes.ids.get(wanted);
  if (target === undefined || target === active) return;
  // The sections are not in the page yet when the workbench was just built: they take the focus once they are.
  if (target.isConnected === false) queueMicrotask(() => target.focus());
  else target.focus();
}

const own = (state, id, element) => {
  state.changes.ids.set(id, element);
  return element;
};
const off = (state) => (state.changes.busy === null ? null : 'true');

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

// "이 그림" while change sets wait (SCR-145#waiting): their count, why confirming waits, their list and the confirm
// button off. A removed diagram has no confirm button, so its list stands in the button's place without the reason
// (SPEC-027); a phone shows the reason and the list, without the button or 편집 취소.
function drawDiagram(state) {
  const changes = state.changes;
  const diagram = state.ctx.data.diagram;
  const waiting = waitingOf(diagram);
  const box = changes.diagramBox;
  if (diagram.kind === 'mockup' || waiting.length === 0) {
    box.hidden = true;
    fill(box);
    return;
  }
  box.hidden = false;
  fill(box,
    h('div', { class: 'ph' }, h('h2', {}, CHANGE_WORDS.diagram), h('span', { class: 'tag teal' }, waitingCount(waiting.length))),
    diagram.removed ? null : h('p', {}, CHANGE_WORDS.waitingWhy),
    h('ul', { class: 'chg' }, waiting.map((set) => waitingRow(state, set, 'w'))),
    diagram.removed || state.phone ? null : h('button', { type: 'button', class: 'btn primary wide', disabled: true }, CHANGE_WORDS.confirm));
}

// A change set that waits, as the mockup's list writes it: a direct rename's new name over "이름 바꾸기 · X에서", a
// direct connection's ends over 잇기, an accepted proposal's text over "AI 제안 수락". A direct edit has 편집 취소 on a
// PC. where tells the two lists apart in the IDs.
function waitingRow(state, set, where) {
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
  return h('li', {}, h('span', { class: 'grow' }, h('b', { id: `${id}-title` }, title), h('br'), h('span', { class: 'sec' }, how)), cancel);
}

// "AI 제안" on a PC: the proposals still proposed and those accepted and waiting, in API-265's order, with the count of
// those to answer, or "모두 처리함". A mockup takes no proposal, and a phone answers none (SPEC-051).
function drawProposals(state) {
  const changes = state.changes;
  const diagram = state.ctx.data.diagram;
  const box = changes.proposalBox;
  if (state.phone || diagram.kind === 'mockup') {
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
  if (state.phone || changes.busy !== null) return;
  if (verb === 'accept' && state.ctx.data.diagram.removed) return;
  changes.asking = { id: set.id, verb };
  changes.focus = `p-${set.id}-stop`;
  drawChanges(state);
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
  if (state.phone || changes.busy !== null) return;
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

// What an answer leads to (SCR-145): done, the diagram is read again; a state that changed is the stale bar; a change
// or an element gone says so with 새로 고침; a project or a diagram gone reads the diagram again first, so that a
// removed one still listed opens as SPEC-027 says (SCR-145#error); any other failure says so with 다시 시도.
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
  if (found.state === 'normal') {
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
      blur: () => left(state, element, field),
    },
  });
  field.value = draft?.name ?? shown;
  changes.field = own(state, 'element-name', field);
  fill(changes.nameBox,
    h('label', { class: 'l', for: 'element-name' }, CHANGE_WORDS.nameLabel),
    field,
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
