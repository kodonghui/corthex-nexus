// What the workbench lays over a picture (note 24 of the WBS; SPEC-018, SPEC-022, SPEC-034): AI proposals dashed,
// change sets that wait for reflection ringed, and the marks of what changed since the last confirmation. TASK-458
// draws them with the pictures; TASK-460 (proposals, direct edits, waiting) and TASK-461 (confirmations, SCR-146) use
// this module as it is, so it reads only API-265's Diagram and builds no screen of its own.
//
// - overlayModel(diagram): by element key, what lies over each element; the boxes a change set adds, and the lines it
//   connects. Only proposals still proposed and change sets accepted and not yet reflected lie over a picture.
// - proposalsOf, waitingOf and changesSince: the lists the work panel shows.
// - markChips, overClasses, aiBadge, nameWith and ghostCap: the marks, the classes, the AI badge, the name and the cap a
//   box or a row shows, as the stage-09 mockup draws them.

import { h } from './dom.js';

// The marks, as the stage-09 mockup writes them.
export const MARK_WORDS = Object.freeze({ add: '더함', chg: '바뀜', wait: '반영 대기' });
// The words of a DDD board's kinds, as the mockup's caps write them, and of the kinds a ghost box can take.
export const KIND_WORDS = Object.freeze({
  event: '이벤트',
  command: '명령',
  aggregate: '애그리거트',
  policy: '정책',
  read_model: '읽기 모델',
  hotspot: '핫스팟',
  external: '외부 시스템',
  context: '경계 컨텍스트',
});

// Whether a change set lies over the picture: a proposal still proposed, or a change set accepted and not reflected.
export const isProposed = (set) => set.origin === 'proposal' && set.state === 'proposed';
export const isWaiting = (set) => set.state === 'accepted';

// What lies over the diagram's picture:
// - marks: a Map of element key to { proposed, waiting, rename, removing, since, sets }: proposed when a proposal
//   names it; waiting when an accepted change set does; rename the name on top, { name, waiting }, from the newest
//   change set that renames it; removing, { waiting }, when one removes it; since 'add' or 'chg' from
//   since_confirmation; sets the IDs of the change sets that name it, newest first;
// - ghosts: the boxes change sets add, [{ key, name, kind, waiting, set }], in the overlays' order (newest first);
//   kind is the DDD kind a board's key names, or null; name is '' when the change gives none, and the page then shows
//   the key (SPEC-010);
// - links: the lines change sets connect, [{ from, to, name, waiting, set }], between elements or ghosts.
export function overlayModel(diagram) {
  const elements = diagram.elements ?? [];
  const keys = new Set(elements.map((element) => element.key));
  const byTrace = new Map();
  for (const element of elements) {
    if (element.trace_id) byTrace.set(element.trace_id, [...(byTrace.get(element.trace_id) ?? []), element.key]);
  }
  const marks = new Map();
  const entry = (key) => {
    if (!marks.has(key)) marks.set(key, { proposed: false, waiting: false, rename: null, removing: null, since: null, sets: [] });
    return marks.get(key);
  };
  const since = diagram.since_confirmation;
  if (since) {
    for (const key of since.added ?? []) if (keys.has(key)) entry(key).since = 'add';
    for (const key of since.changed ?? []) if (keys.has(key)) entry(key).since = 'chg';
  }
  const ghosts = [];
  const ghostKeys = new Set();
  const links = [];
  for (const set of diagram.overlays ?? []) {
    if (!isProposed(set) && !isWaiting(set)) continue;
    const waiting = isWaiting(set);
    const touched = new Set();
    for (const id of set.items ?? []) for (const key of byTrace.get(id) ?? []) touched.add(key);
    // The boxes it adds first, so that a line it connects to one of them finds it, in whatever order its steps come.
    const steps = set.changes ?? [];
    const adds = steps.filter((change) => change.op === 'add');
    for (const change of adds) {
      if (keys.has(change.element) || ghostKeys.has(change.element)) continue;
      ghostKeys.add(change.element);
      ghosts.push({ key: change.element, name: change.name ?? '', kind: kindOfKey(change.element), waiting, set: set.id });
    }
    for (const change of steps) {
      if (change.op === 'add' || (!keys.has(change.element) && !ghostKeys.has(change.element))) {
        continue;
      } else if (change.op === 'rename') {
        if (keys.has(change.element)) {
          const over = entry(change.element);
          over.rename ??= { name: change.name ?? '', waiting };
          touched.add(change.element);
        }
      } else if (change.op === 'remove') {
        if (keys.has(change.element)) {
          entry(change.element).removing ??= { waiting };
          touched.add(change.element);
        }
      } else if (change.op === 'connect' && change.target !== null && (keys.has(change.target) || ghostKeys.has(change.target))) {
        links.push({ from: change.element, to: change.target, name: change.name ?? '', waiting, set: set.id });
        if (keys.has(change.element)) touched.add(change.element);
      }
    }
    // A proposal without steps adds its items by trace ID (ProposalRequest.adds), shown by that ID.
    if (adds.length === 0) {
      for (const id of set.adds ?? []) {
        if (byTrace.has(id) || ghostKeys.has(id)) continue;
        ghostKeys.add(id);
        ghosts.push({ key: id, name: '', kind: null, waiting, set: set.id });
      }
    }
    for (const key of touched) {
      const over = entry(key);
      if (waiting) over.waiting = true;
      else over.proposed = true;
      over.sets.push(set.id);
    }
  }
  return { marks, ghosts, links };
}

// The DDD kind a board's element key names in its last part, such as command in "CTX-037/command:Send snapshot".
export function kindOfKey(key) {
  const last = String(key).split('/').at(-1);
  const kind = last.includes(':') ? last.slice(0, last.indexOf(':')) : '';
  return Object.hasOwn(KIND_WORDS, kind) ? kind : null;
}

// The proposals the owner answers (TASK-460), newest first.
export const proposalsOf = (diagram) => (diagram.overlays ?? []).filter(isProposed);
// The change sets that wait for reflection (TASK-460, TASK-461), newest accepted first.
export const waitingOf = (diagram) => (diagram.overlays ?? []).filter(isWaiting);

// The elements changed since the last confirmation that the drawing shows (TASK-461): [{ element, mark }] in the
// drawing's order, mark being 'add' or 'chg'; null when the diagram was never confirmed, as the page then says.
export function changesSince(diagram) {
  const since = diagram.since_confirmation;
  if (!since) return null;
  const added = new Set(since.added ?? []);
  const changed = new Set(since.changed ?? []);
  return (diagram.elements ?? [])
    .filter((element) => added.has(element.key) || changed.has(element.key))
    .map((element) => ({ element, mark: added.has(element.key) ? 'add' : 'chg' }));
}

// The marks of an element, as small tags: 더함 or 바뀜, then 반영 대기. over is an entry of overlayModel's marks.
export function markChips(over) {
  if (over === undefined || over === null) return [];
  return [
    over.since === null ? null : h('span', { class: `mk ${over.since}` }, MARK_WORDS[over.since]),
    over.waiting ? h('span', { class: 'mk wait' }, MARK_WORDS.wait) : null,
  ];
}

// The classes a box takes from what lies over it: ov-prop dashed with the AI badge, waiting ringed.
export function overClasses(over) {
  if (over === undefined || over === null) return [];
  return [over.proposed ? 'ov-prop' : null, over.waiting ? 'waiting' : null, over.removing === null ? null : 'ov-remove'].filter(Boolean);
}

// The AI badge of a box a proposal names.
export function aiBadge(over) {
  return over?.proposed ? h('span', { class: 'ai' }, 'AI') : null;
}

// A box's name with what lies over it: the name on top, the drawn name struck under it when a change set renames it
// (SPEC-018: "Y over X").
export function nameWith(name, over) {
  if (over?.rename && over.rename.name !== name) {
    return [h('b', { class: 'nm' }, over.rename.name), h('s', { class: 'was' }, name)];
  }
  return [h('b', { class: 'nm' }, name)];
}

// The cap of a ghost box: AI, and the kind's word when its key names one, such as "AI · 이벤트".
export function ghostCap(ghost) {
  return ghost.kind === null ? 'AI' : `AI · ${KIND_WORDS[ghost.kind]}`;
}
