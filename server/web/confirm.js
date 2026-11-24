// What SCR-145 and SCR-146 say about a diagram's confirmation (TASK-461; SPEC-029, SPEC-030, SPEC-034): the words, the
// state of the latest confirmation, the elements changed since it, and the link to the confirmed version. Only what
// API-264 and API-265 give is read, and nothing is written here: changes.js sends the confirm (API-275) and its cancel
// (API-276), draws "이 그림" on the workbench, and changes-page.js draws SCR-146.

import { h } from './dom.js';
import { changesSince, KIND_WORDS, kindOfKey, MARK_WORDS } from './overlays.js';
import { shownName, tagWord } from './picture.js';
import { dayOf } from './states.js';

// The words of the confirmation, as the stage-09 mockup, the screen definitions and the coordinator's choices for
// TASK-461 give them.
export const CONFIRM_WORDS = Object.freeze({
  notConfirmed: '확정 전',
  confirmed: '확정함',
  notDrawn: '그려지지 않음',
  neverConfirmed: '아직 확정한 적이 없어서 바뀐 곳 표시가 없어요.',
  confirmedHere: '이 버전으로 확정했어요. 에이전트가 기록하면 단계가 통과돼요.',
  cancelled: '확정을 취소했어요. 다시 확정할 때까지 할 일에 남아요.',
  recorded: '기록됨',
  leftOut: '남은 AI 제안은 확정에 들어가지 않아요.',
  fixFirst: '문서를 고쳐 그려지게 한 뒤 확정하세요.',
  confirm: '이 그림 확정',
  askConfirm: '확정할까요?',
  yes: '확정',
  stop: '취소',
  cancelConfirmation: '확정 취소',
  nothingYet: '확정할 그림이 아직 없어요.',
  removed: '뺌',
  removedFrom: '문서에서 뺐어요',
  // SCR-146.
  title: '확정 뒤 바뀐 곳',
  description: '지난 확정 버전 뒤 더하고 빼고 바뀐 요소예요. 이름은 지금 그림의 이름이고, 뺀 요소는 키로 보여요.',
  changedElements: '바뀐 요소',
  waitingHeading: '반영을 기다리는 변경',
  waitingFirst: '반영을 기다리는 변경을 먼저 반영하거나 취소하세요.',
  confirmedDocument: '확정한 버전의 문서',
  toDiagram: '그림으로',
  seeInDiagram: '그림에서 보기',
  noneSince: '확정한 뒤 바뀐 곳이 없어요.',
  noVersion: '아직 확정하지 않아 비교할 버전이 없어요.',
  phone: '편집 취소와 확정은 PC에서 하세요.',
});

export const changedTag = (count) => `바뀐 곳 ${count}`;
export const changedSentence = (count) => `확정한 뒤 바뀐 곳이 ${count}개 있어요. 다시 확정하면 에이전트가 기록해요.`;
export const moreChanges = (count) => `+${count}개 더 · 바뀐 곳 모두 보기`;
export const countTag = (count) => `${count}개`;

// How many changed elements the workbench's "이 그림" lists before "+N개 더" (SCR-145's normal state).
export const SHOWN_CHANGES = 4;

// The marks of a changed element: the word and the tag's colour, as the mockup draws them.
const MARKS = Object.freeze({
  add: { word: MARK_WORDS.add, colour: 'green' },
  chg: { word: MARK_WORDS.chg, colour: 'purple' },
  del: { word: CONFIRM_WORDS.removed, colour: 'red' },
});

// Whether the diagram's latest drawing drew, so that it can be confirmed (API-275 refuses not_drawn otherwise).
export const isDrawn = (diagram) => diagram.drawing?.status === 'drawn';

// The diagram's live confirmation, or null: API-265 gives its latest confirmation in any state.
export const liveConfirmation = (diagram) => (diagram.confirmation?.state === 'confirmed' ? diagram.confirmation : null);

// The elements changed since the latest confirmation (SPEC-034), or null when the diagram was never confirmed:
// { version, rows }, each row { mark, key, name, kind }. overlays.js gives the added and the changed in the drawing's
// order; the added come first, then the changed, and then the removed, which the drawing no longer holds, in the
// confirmed drawing's order, by key (SCR-146 and the mockup's list). kind is the element's kind word, or for a removed
// one the DDD kind its key names, or null.
export function changedSince(diagram) {
  const shown = changesSince(diagram);
  if (shown === null) return null;
  const row = ({ element, mark }) => ({ mark, key: element.key, name: shownName(element), kind: tagWord(diagram, element) });
  const rows = [...shown.filter(({ mark }) => mark === 'add'), ...shown.filter(({ mark }) => mark === 'chg')].map(row);
  for (const key of diagram.since_confirmation.removed ?? []) {
    const kind = kindOfKey(key);
    rows.push({ mark: 'del', key, name: null, kind: kind === null ? null : KIND_WORDS[kind] });
  }
  return { version: diagram.since_confirmation.version, rows };
}

const markTag = (row) => h('span', { class: `tag ${MARKS[row.mark].colour}` }, MARKS[row.mark].word);
// A removed element shows its key, since the drawing no longer names it (SCR-146).
const rowName = (row) => (row.mark === 'del' ? h('span', { class: 'mono' }, row.key) : row.name);
const rowKind = (row) => {
  const words = [row.kind, row.mark === 'del' ? CONFIRM_WORDS.removedFrom : null].filter(Boolean);
  return words.length === 0 ? null : words.join(' · ');
};

// A changed element in the workbench's "이 그림", as the mockup's list writes it: the mark, the name, the kind.
export function panelRow(row) {
  const kind = rowKind(row);
  return h('li', {}, markTag(row), h('span', { class: 'grow' }, rowName(row)), kind === null ? null : h('span', { class: 'sec' }, kind));
}

// A changed element on SCR-146: the mark, then the name over the kind.
export function pageRow(row) {
  const kind = rowKind(row);
  return h('div', { class: 'li keep still short' },
    h('span', { class: 'lead' }, markTag(row)),
    h('span', { class: 'grow' }, h('b', {}, rowName(row)), kind === null ? null : h('span', { class: 'small' }, kind)));
}

// The link to the confirmed version, "확정한 버전의 문서 ↗ a41c9e2 · 11월 22일 확정" (SPEC-034, SCR-146's "before"):
// the repository at the confirmed commit, opened in a new tab. API-265 names no document's path, so it is the whole
// repository at that commit (choice 6). The contract's Link is an https address; anything else, or no repository,
// shows the same words as text.
export function confirmedVersion(repository, version, confirmation) {
  const words = [
    `${CONFIRM_WORDS.confirmedDocument} ↗ `,
    h('span', { class: 'mono' }, String(version).slice(0, 7)),
    confirmation?.confirmed_at ? ` · ${dayOf(confirmation.confirmed_at)} 확정` : null,
  ];
  const safe = typeof repository === 'string' && /^https:\/\/\S+$/.test(repository);
  if (!safe) return h('p', { class: 'small' }, words);
  const href = `${repository.replace(/\/+$/, '')}/tree/${encodeURIComponent(version)}`;
  return h('a', { class: 'small', href, target: '_blank', rel: 'noopener noreferrer' }, words);
}
