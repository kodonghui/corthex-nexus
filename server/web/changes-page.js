// SCR-146, the changes since the last confirmation (TASK-461; SPEC-023, SPEC-029, SPEC-030, SPEC-034). screens.js runs
// it in the shell, which reads API-264 and then the diagram the workbench opens (API-265, screen.follow).
//
// - Above the list, "확정한 버전의 문서 ↗ a41c9e2 · 11월 22일 확정": the repository at the confirmed commit (choice 6),
//   a link only when the repository is an https address.
// - What waits for reflection comes first, under "반영을 기다리는 변경" with 반영 대기 N (choice 5): every change set
//   that waits, a direct edit with 편집 취소 on a PC (API-273).
// - "바뀐 요소": each element added, changed or removed since the last confirmation, with its tag, its name in the
//   drawing now, or its key once removed, and its kind; or the empty state when it was never confirmed or nothing
//   changed since.
// - The end: 이 그림 확정 on a PC for a diagram not removed and not confirmed now (choice 7), asked once and off while
//   something waits or the document does not draw, and 그림으로. After its own confirm the page says so
//   (SCR-146#confirmed). A phone reads the lists only (SPEC-051).
//
// changes.js sends 편집 취소 and 이 그림 확정 and draws the line of their answers above the body, as on the workbench
// (state.drawPage); confirm.js holds the words. The page keeps, for the shell it runs in, only what changes.js keeps.

import { stageHref } from './address.js';
import { changesOf, confirmable, confirmControl, drawChanges, own, pageOffButton, waitingCount, waitingParts } from './changes.js';
import { changedSince, CONFIRM_WORDS, confirmedVersion, countTag, isDrawn, liveConfirmation, pageRow } from './confirm.js';
import { fill, h } from './dom.js';
import { MARK_WORDS, overlayModel, waitingOf } from './overlays.js';
import { shownName } from './picture.js';

// The page's state, by the shell it runs in, for the diagram it shows.
const states = new WeakMap();

function pageState(ctx) {
  const diagram = ctx.data.diagram;
  let state = states.get(ctx.shell);
  if (state === undefined || state.diagram !== diagram.id) {
    state = { diagram: diagram.id };
    // Whether the page still shows this diagram, for an answer that comes after it changed.
    const kept = state;
    state.live = () => states.get(ctx.shell) === kept;
    states.set(ctx.shell, state);
  }
  state.ctx = ctx;
  state.phone = ctx.shell.isPhone();
  state.model = overlayModel(diagram);
  state.names = new Map((diagram.elements ?? []).map((element) => [element.key, shownName(element)]));
  state.drawPage = drawPage;
  return state;
}

// The title's tag, "6개", while any element changed since the last confirmation.
export function changesTags({ data }) {
  const diagram = data.diagram;
  if (diagram === undefined || diagram === null) return null;
  const count = changedSince(diagram)?.rows.length ?? 0;
  return count === 0 ? null : [h('span', { class: 'tag purple' }, countTag(count))];
}

// SCR-146#loading: grey rows in the list's place, and on a PC the confirm button off.
export function changesSkeleton({ shell }) {
  return [
    h('div', { class: 'cards', 'aria-hidden': 'true' }, Array.from({ length: 3 }, () => h('span', { class: 'sk row full' }))),
    shell.isPhone() ? null : pageOffButton(),
  ];
}

// The body: the line of changes.js's answers, and the page's parts, drawn again by drawChanges.
export function changesBody(ctx) {
  const diagram = ctx.data.diagram;
  if (diagram === undefined || diagram === null) {
    // Nothing was sent for the stage, so there is no version to compare with.
    return [h('div', { class: 'empty' }, h('h2', {}, CONFIRM_WORDS.noVersion)), endRow(ctx, null, false, [])];
  }
  const state = pageState(ctx);
  const { line } = changesOf(state);
  state.pageBox = h('div', { class: 'page-part' });
  drawChanges(state);
  return [line, state.pageBox];
}

function drawPage(state) {
  const { ctx, changes } = state;
  const diagram = ctx.data.diagram;
  const live = liveConfirmation(diagram);
  const since = changedSince(diagram);
  const waiting = waitingOf(diagram);
  // Only this page's own confirm leads to SCR-146#confirmed, while that confirmation stays live (choice 7).
  const confirmedHere = live !== null && changes.confirmed !== null && changes.confirmed === live.id;
  const top = (node) => (changes.ids.has('page-top') ? node : own(state, 'page-top', node));
  const heading = (text) => top(h('h2', { tabindex: '-1' }, text));
  fill(state.pageBox,
    confirmedHere
      ? top(h('div', { class: 'nt ok', role: 'status', tabindex: '-1' }, h('div', { class: 'b' }, h('b', {}, CONFIRM_WORDS.confirmedHere))))
      : since === null ? null : confirmedVersion(ctx.data.project.repository, since.version, diagram.confirmation),
    waiting.length === 0 ? null : h('section', { class: 'group' },
      h('div', { class: 'gh' }, heading(CONFIRM_WORDS.waitingHeading), h('span', { class: 'tag teal' }, waitingCount(waiting.length))),
      h('div', { class: 'list' }, waiting.map((set) => waitingItem(state, set)))),
    changedPart(since, confirmedHere, heading),
    notDrawn(state, live),
    endRow(ctx, state, confirmedHere, waiting));
}

// A change set that waits, as the mockup's row: 반영 대기, its text over how it changes, and 편집 취소 on a PC.
function waitingItem(state, set) {
  const { id, title, how, cancel } = waitingParts(state, set, 'w');
  return h('div', { class: 'li keep still' },
    h('span', { class: 'lead' }, h('span', { class: 'tag teal' }, MARK_WORDS.wait)),
    h('span', { class: 'grow' }, h('b', { id: `${id}-title` }, title), how === '' ? null : h('span', { class: 'sec' }, how)),
    cancel);
}

// "바뀐 요소", or the empty state (SCR-146#empty): never confirmed, or nothing changed since. After this page's confirm,
// that nothing changed is a line under the message (SCR-146#confirmed).
function changedPart(since, confirmedHere, heading) {
  if (since === null) return h('div', { class: 'empty' }, heading(CONFIRM_WORDS.noVersion));
  if (since.rows.length === 0) {
    return h('div', { class: 'empty' }, confirmedHere ? h('p', { class: 'sec' }, CONFIRM_WORDS.noneSince) : heading(CONFIRM_WORDS.noneSince));
  }
  return h('section', { class: 'group' }, h('div', { class: 'gh' }, heading(CONFIRM_WORDS.changedElements)),
    h('div', { class: 'list' }, since.rows.map(pageRow)));
}

// The document does not draw (SCR-146#not-drawn), on a PC, where 이 그림 확정 is off for it: what to do, and the
// picture where the failure shows.
function notDrawn(state, live) {
  const diagram = state.ctx.data.diagram;
  if (state.phone || diagram.removed || live !== null || isDrawn(diagram)) return null;
  return h('div', { class: 'nt err', role: 'alert' }, h('div', { class: 'b' }, h('b', {}, CONFIRM_WORDS.fixFirst)),
    h('a', { class: 'btn ghost sm', href: toDiagram(state.ctx) }, CONFIRM_WORDS.seeInDiagram));
}

// The end of the page: 이 그림 확정 on a PC for a diagram not removed and not confirmed now, off while something waits
// or the document does not draw, with why when something waits; then 그림으로. A phone adds where to act instead.
function endRow(ctx, state, confirmedHere, waiting) {
  const diagram = ctx.data.diagram ?? null;
  const phone = ctx.shell.isPhone();
  const offers = state !== null && !phone && !diagram.removed && liveConfirmation(diagram) === null;
  const back = h('a', { class: confirmedHere ? 'btn tertiary' : 'btn ghost', href: toDiagram(ctx) }, CONFIRM_WORDS.toDiagram);
  return [
    h('div', { class: 'btns mid' },
      offers ? (confirmable(state) ? confirmControl(state, { wide: false }) : pageOffButton()) : null,
      back,
      offers && waiting.length > 0 ? h('span', { class: 'small' }, CONFIRM_WORDS.waitingFirst) : null),
    phone ? h('div', { class: 'nt info', role: 'status' }, h('div', { class: 'b' }, h('b', {}, CONFIRM_WORDS.phone))) : null,
  ];
}

// The workbench of the stage, at this diagram when there is one.
function toDiagram({ address, data }) {
  return stageHref(address.project, address.part, address.stage, { diagram: data.diagram?.id ?? null });
}
