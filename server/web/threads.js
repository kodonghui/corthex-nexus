// SCR-145's threads (TASK-459; SPEC-016, SPEC-017, SPEC-027, SPEC-028, SPEC-051): the diagram's comment threads in
// the Selected section of the work panel, which on a phone is the sheet under the picture. The owner reads a thread
// (API-266), comments on the diagram, an element or a row (API-267), replies (API-268) and closes it (API-269), on a
// phone too. workbench.js draws the section and puts threadsPart's nodes in it; this module keeps its own state in
// the workbench's, under state.threads, and draws only its own parts again.
//
// - With nothing chosen the section lists every thread of the diagram, open ones first and then closed ones, each by
//   its last activity, newest first. Each is named by where it is: its element, "그림 전체", or "사라진 요소 X"
//   (SPEC-027). Choosing one reads it and shows its entries, and chooses its element on the picture when it is drawn.
// - With an element or a row chosen it lists that element's threads, those marked removed with its key included, and
//   shows the first open one, else the newest. Escape and "그림 전체 스레드" go back to the whole list.
// - ?thread= is read once the diagram is shown, and shows that thread with its element chosen. A thread of another
//   diagram, or one that is gone, says so with 새로 고침 to the diagram. Choosing another thread keeps the address.
// - The open thread shown ends with a reply box and "스레드 닫기"; the section ends with a box that starts a new thread
//   where the owner is: the element, the row or the diagram. A removed diagram takes no new thread (SPEC-027), and an
//   element drawn as unreadable takes none either: the server would put it on the diagram.
// - What the owner types is kept in this tab (shell.keepDraft) under the place it is for, so it comes back after the
//   gate and is forgotten once sent. The key holds the project, the diagram's and a thread's IDs, as an address does,
//   and an element's key only as a hash, so no text of a document is kept.

import { diagramApi, isThreadId, projectApi, projectHref, stageHref } from './address.js';
import { newRequestKey, read } from './api.js';
import { fill, h } from './dom.js';

// The most characters a comment holds (Text in the contract).
export const TEXT_LIMIT = 4000;

export const THREAD_WORDS = Object.freeze({
  whole: '그림 전체',
  wholeThreads: '그림 전체 스레드',
  owner: '나',
  agent: 'AI',
  mine: '내 차례',
  agents: '에이전트 차례',
  closed: '닫힘',
  reflected: '반영되어 닫힘',
  resolved: '해결됨',
  lookFirst: '먼저 볼 것: ',
  reply: '답글 쓰기',
  replyField: '이 스레드에 남길 말',
  close: '스레드 닫기',
  reopen: '다시 열기',
  comment: '댓글 쓰기',
  send: '보내기',
  fields: Object.freeze({ element: '이 요소에 남길 말', row: '이 행에 남길 말', diagram: '이 그림에 남길 말' }),
  empty: '댓글을 적어 주세요.',
  limit: '최대 4,000자',
  kept: '쓰던 댓글은 남아 있어요.',
  unreadable: '읽지 못한 항목이에요. 그림 전체에 댓글을 다세요.',
  reload: '새로 고침',
});

// "사라진 요소 X" (SPEC-027): a thread whose element left the drawing, by the element's last name.
export const goneName = (name) => `사라진 요소 ${name}`;
// The heading over the threads listed (the mockup's words).
export const countOf = (threads, entries) => `스레드 ${threads} · 댓글 ${entries}`;

const HTTPS = /^https:\/\/\S+$/;
const NEW_FIELD = 'th-new';
const REPLY_FIELD = 'th-reply';

// The workbench calls this as it builds the view: it keeps the threads' state for the diagram shown, reads ?thread=
// the first time the address names it, and otherwise reads the thread shown again, since the view was drawn from a
// new read. host gives choose(key), which chooses an element and draws the section; notice(nodes), the bar over the
// picture; live(), whether the view is still the workbench's for this diagram; and reload(how), the shell's read
// again.
export function threadsOpened(state, host) {
  if (state.threads === undefined) {
    state.threads = {
      shown: null, thread: null, failed: null, seq: 0, handled: null, choose: false, fromAddress: false,
      texts: new Map(), errors: new Map(), sending: new Set(), boxes: null, place: null, element: null,
    };
  }
  const t = state.threads;
  t.host = host;
  const wanted = state.ctx.address.thread;
  if (isThreadId(wanted) && t.handled !== wanted) {
    t.handled = wanted;
    t.shown = wanted;
    t.thread = null;
    t.failed = null;
    t.choose = true;
    t.fromAddress = true;
    readThread(state, wanted);
  } else if (t.shown !== null) {
    readThread(state, t.shown);
  }
}

// Goes back to the whole list: no thread is shown.
export function threadsWhole(state) {
  if (state.threads === undefined) return;
  state.threads.shown = null;
  state.threads.thread = null;
  state.threads.failed = null;
  state.threads.fromAddress = false;
}

// After the section was drawn anew in place of the control that had the focus: the list's first thread takes it, else
// the box for a new comment, so the keyboard stays in the section.
export function threadsFocus(state) {
  const boxes = state.threads?.boxes ?? null;
  if (boxes === null) return;
  (boxes.list.querySelector('button') ?? boxes.add.querySelector('input'))?.focus();
}

// The section's threads, for the element chosen or, when it is null, the diagram as a whole: the list, the thread
// shown and the box for a new comment, each a part drawn again on its own.
export function threadsPart(state, element) {
  const t = state.threads;
  const diagram = state.ctx.data.diagram;
  if (element !== null) {
    // An element shows one of its own threads: the one chosen, else the first open one, else the newest.
    const listed = threadsAt(diagram, element);
    if (!listed.some((brief) => brief.id === t.shown)) {
      const next = listed[0]?.id ?? null;
      t.shown = next;
      t.thread = null;
      t.failed = null;
      t.fromAddress = false;
      if (next !== null) readThread(state, next);
    }
  }
  t.place = placeOf(diagram, element);
  t.element = element;
  t.boxes = { list: h('div', { class: 'th-list' }), shown: h('div', { class: 'th-shown' }), add: h('div', { class: 'th-add' }) };
  drawList(state);
  drawShown(state);
  drawAdd(state);
  return [
    element !== null && element.status === 'unreadable' ? h('p', { class: 'sec' }, THREAD_WORDS.unreadable) : null,
    t.boxes.list, t.boxes.shown, t.boxes.add,
  ];
}

// The threads at an element, those of its key marked removed included (SPEC-027), or else every thread of the
// diagram: open ones first, then closed ones, each newest first.
export function threadsAt(diagram, element) {
  const all = Array.isArray(diagram.threads) ? diagram.threads : [];
  const at = element === null ? all : all.filter((brief) => brief.element === element.key);
  const time = (brief) => Date.parse(brief.last_at) || 0;
  return [...at].sort((a, b) => (a.state === b.state ? time(b) - time(a) : a.state === 'open' ? -1 : 1));
}

// Where a new comment goes: the diagram as a whole, an element of a picture or a row of an item table, with the
// drawing it names (API-267). An element or a row names the drawing shown: the last good one when the latest failed.
// The diagram as a whole names the latest drawing even when it failed, so the owner can say what to fix.
function placeOf(diagram, element) {
  if (element === null) {
    const drawing = diagram.drawing ?? diagram.last_drawn ?? null;
    return { target: 'diagram', key: null, drawing: drawing?.id ?? null, draft: 'comment diagram' };
  }
  const shown = diagram.drawing?.status === 'failed' ? diagram.last_drawn : diagram.drawing;
  const target = diagram.kind === 'item_table' ? 'row' : 'element';
  return { target, key: element.key, drawing: shown?.id ?? null, draft: `comment ${target} ${hashOf(element.key)}` };
}

// FNV-1a over the text's code points, as 8 hexadecimal digits: a draft's key names an element without its text.
export function hashOf(text) {
  let hash = 0x811c9dc5;
  for (const character of String(text)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

// The key a box's text is kept under in this tab: "/p/{project} {diagram} {what}", what being "reply {thread}",
// "comment diagram", or "comment element {hash}" or "comment row {hash}".
export function draftKey(diagram, what) {
  return `${projectHref(diagram.project)} ${diagram.id} ${what}`;
}

// The text of a box: what was typed in this page, else what this tab kept.
function textOf(state, what) {
  const key = draftKey(state.ctx.data.diagram, what);
  const t = state.threads;
  return t.texts.has(key) ? t.texts.get(key) : state.ctx.shell.draftOf(key);
}

function keepText(state, what, text) {
  const key = draftKey(state.ctx.data.diagram, what);
  state.threads.texts.set(key, text);
  state.ctx.shell.keepDraft(key, text);
}

// The name of where a thread is: "사라진 요소 X", "그림 전체", or its element's name.
function whereOf(state, brief) {
  if (brief.removed_name !== null && brief.removed_name !== undefined) return goneName(brief.removed_name);
  if (brief.target === 'diagram' || brief.element === null) return THREAD_WORDS.whole;
  return state.names.get(brief.element) ?? brief.element;
}

// A thread's state: whose turn an open one is, and who closed a closed one (closed_by is known once it was read).
export function stateTag(thread) {
  if (thread.state === 'closed') {
    if (thread.resolved === true) return h('span', { class: 'tag green' }, THREAD_WORDS.resolved);
    return thread.closed_by === 'reflection'
      ? h('span', { class: 'tag green' }, THREAD_WORDS.reflected)
      : h('span', { class: 'tag gray' }, THREAD_WORDS.closed);
  }
  if (thread.waits_on === 'owner') return h('span', { class: 'tag blue' }, THREAD_WORDS.mine);
  if (thread.waits_on === 'agent') return h('span', { class: 'tag purple' }, THREAD_WORDS.agents);
  return null;
}

function drawList(state) {
  const t = state.threads;
  if (t.boxes === null) return;
  const listed = threadsAt(state.ctx.data.diagram, t.element);
  if (listed.length === 0) {
    fill(t.boxes.list);
    return;
  }
  const entries = listed.reduce((sum, brief) => sum + (brief.entries ?? 0), 0);
  fill(t.boxes.list,
    h('h3', {}, countOf(listed.length, entries)),
    h('ul', { class: 'threads' }, listed.map((brief) => {
      const on = brief.id === t.shown;
      // The thread shown says what its read says, such as who closed it.
      const known = on && t.thread?.id === brief.id ? t.thread : brief;
      return h('li', {}, h('button', {
        type: 'button', 'aria-pressed': on ? 'true' : 'false', on: { click: () => chooseThread(state, brief) },
      }, h('span', { class: 'grow' }, whereOf(state, brief)), stateTag(known), h('span', { class: 'small' }, state.ctx.shell.since(brief.last_at))));
    })));
}

// Choosing a thread of the list: it is read and shown, and its element, when it is drawn, is chosen on the picture.
function chooseThread(state, brief) {
  const t = state.threads;
  if (t.shown !== brief.id) {
    t.shown = brief.id;
    t.thread = null;
    t.failed = null;
    t.fromAddress = false;
    readThread(state, brief.id);
  }
  if (brief.element !== null && state.names.has(brief.element)) {
    t.host.choose(brief.element);
    return;
  }
  drawList(state);
  drawShown(state);
}

// Reads the thread (API-266) and shows it, if it is still the one to show when the answer comes. A thread of another
// diagram, or one gone, says that it is no longer in NEXUS; a 401, a 403 or a gone project is the shell's.
async function readThread(state, id) {
  const t = state.threads;
  const generation = nextRead(t, id);
  t.seq += 1;
  const seq = t.seq;
  const diagram = state.ctx.data.diagram;
  const outcome = await read(`${projectApi(diagram.project)}/threads/${encodeURIComponent(id)}`);
  if (!t.host.live() || seq !== t.seq || t.shown !== id || t.reads.get(id) !== generation) return;
  const choose = t.choose;
  t.choose = false;
  if (outcome.status === 200 && outcome.body.diagram === diagram.id) {
    t.thread = outcome.body;
    t.failed = null;
    brief(state, id, outcome.body, 0, true);
    const key = outcome.body.element;
    if (choose && key !== null && state.names.has(key)) {
      t.host.choose(key);
      return;
    }
  } else if (outcome.status === 200 || (outcome.status === 404 && outcome.code === 'thread_not_found')) {
    t.thread = null;
    t.failed = { gone: true };
  } else {
    if (state.ctx.shell.outcome(outcome) === null) return;
    t.thread = null;
    t.failed = { outcome };
  }
  drawList(state);
  drawShown(state);
}

// The diagram's brief of a thread takes what a read or a write answered about it; added counts an entry a write added.
function brief(state, id, thread, added = 0, authoritative = false) {
  if (!authoritative) nextRead(state.threads, id);
  const found = (state.ctx.data.diagram.threads ?? []).find((each) => each.id === id);
  if (found === undefined) return;
  found.state = thread.state;
  found.waits_on = thread.waits_on;
  if (thread.resolved === true) found.resolved = true;
  else if (authoritative || thread.state === 'open' || thread.closed_by === 'owner' || Object.hasOwn(thread, 'resolved')) delete found.resolved;
  found.last_at = thread.last_at;
  found.entries = Array.isArray(thread.entries) ? thread.entries.length : found.entries + added;
}

function nextRead(threads, id) {
  threads.reads ??= new Map();
  const generation = (threads.reads.get(id) ?? 0) + 1;
  threads.reads.set(id, generation);
  return generation;
}

// A close may race an automatic resolution. Read its state without superseding a
// different thread's in-flight read, and do not turn a successful close into an error.
export async function refreshAfterClose(state, id) {
  const t = state.threads;
  const diagram = state.ctx.data.diagram;
  const generation = nextRead(t, id);
  const seq = t.seq;
  const outcome = await read(`${projectApi(diagram.project)}/threads/${encodeURIComponent(id)}`);
  if (!t.host.live() || state.ctx.data.diagram !== diagram || t.reads.get(id) !== generation) return;
  const showing = t.shown === id && t.seq === seq;
  if ((outcome.status === 200 && outcome.body.diagram !== diagram.id) || (outcome.status === 404 && outcome.code === 'thread_not_found')) {
    if (showing) {
      t.thread = null;
      t.failed = { gone: true };
      drawShown(state);
    }
    return;
  }
  if (outcome.status !== 200) {
    const found = state.ctx.shell.outcome(outcome);
    if (found !== null && showing) t.host.notice(state.ctx.shell.errorNotice(outcome, () => refreshAfterClose(state, id)));
    return;
  }
  brief(state, id, outcome.body, 0, true);
  if (showing) {
    t.thread = outcome.body;
    t.failed = null;
    drawShown(state);
  }
  drawList(state);
}

function drawShown(state) {
  const t = state.threads;
  if (t.boxes === null) return;
  const box = t.boxes.shown;
  if (t.shown === null) return refill(box, null);
  const { shell, address } = state.ctx;
  if (t.failed?.gone) {
    // A thread the address named goes back to the diagram without it; one chosen here reads the diagram again.
    const diagram = state.ctx.data.diagram;
    const again = t.fromAddress
      ? h('a', { class: 'btn tertiary sm', href: stageHref(address.project, address.part, address.stage, { diagram: diagram.id }) }, THREAD_WORDS.reload)
      : h('button', { type: 'button', class: 'btn tertiary sm', on: { click: () => shell.reload() } }, THREAD_WORDS.reload);
    return refill(box, null, h('div', { class: 'nt warn', role: 'status' }, h('div', { class: 'b' }, h('b', {}, shell.message('thread_not_found'))), again));
  }
  if (t.failed?.outcome) {
    const id = t.shown;
    return refill(box, null, shell.errorNotice(t.failed.outcome, () => {
      t.failed = null;
      drawShown(state);
      readThread(state, id);
    }));
  }
  const thread = t.thread;
  if (thread === null || thread.id !== t.shown) {
    return refill(box, null, h('div', { class: 'thread', 'aria-hidden': 'true' }, h('span', { class: 'sk line w160' }), h('span', { class: 'sk mid' })));
  }
  const open = thread.state === 'open';
  refill(box, REPLY_FIELD, h('div', { class: 'thread', role: 'group', 'aria-label': whereOf(state, thread) },
    h('div', { class: 'btns mid' }, h('span', { class: 'small' }, whereOf(state, thread)), stateTag(thread)),
    thread.entries.map((entry) => entryOf(shell, entry)),
    open ? replyForm(state, thread) : null,
    open ? closeRow(state, thread) : thread.resolved === true ? closeRow(state, thread, true) : null));
}

// One entry of a thread: who wrote it and when, the quote it answers, its text, what to look at first and the
// decision's address. A link opens only an https address, in a new tab that cannot reach this page.
function entryOf(shell, entry) {
  const link = typeof entry.link === 'string' && HTTPS.test(entry.link) ? entry.link : null;
  return h('div', { class: 'cmt' },
    h('div', { class: 'meta' },
      entry.author === 'agent' ? h('span', { class: 'ai' }, THREAD_WORDS.agent) : h('span', { class: 'who' }, THREAD_WORDS.owner),
      h('span', { class: 'small' }, shell.since(entry.made_at))),
    entry.quote ? h('blockquote', { class: 'q' }, entry.quote) : null,
    h('span', { class: 'tx' }, entry.text),
    entry.look_first ? h('span', { class: 'small tx' }, THREAD_WORDS.lookFirst, entry.look_first) : null,
    link === null ? null : h('a', { class: 'small mono', href: link, target: '_blank', rel: 'noopener noreferrer' }, link));
}

// The box that starts a thread where the owner is, at the end of the section. None on a removed diagram (SPEC-027),
// on an element drawn as unreadable, or without a drawing to name.
function drawAdd(state) {
  const t = state.threads;
  if (t.boxes === null) return;
  const diagram = state.ctx.data.diagram;
  const place = t.place;
  if (diagram.removed || place.drawing === null || t.element?.status === 'unreadable') return refill(t.boxes.add, null);
  refill(t.boxes.add, NEW_FIELD, textForm(state, {
    id: NEW_FIELD, what: place.draft, label: THREAD_WORDS.comment, placeholder: THREAD_WORDS.fields[place.target],
    action: (text) => startOf(state, place, text),
  }));
}

function replyForm(state, thread) {
  return textForm(state, {
    id: REPLY_FIELD, what: `reply ${thread.id}`, label: THREAD_WORDS.reply, placeholder: THREAD_WORDS.replyField,
    action: (text) => replyOf(state, thread.id, text),
  });
}

// Puts nodes in a part of the section; when the focus was in it, the part's field, if it still has one, gets it back.
function refill(box, field, ...nodes) {
  const active = document.activeElement ?? null;
  const had = active !== null && box.contains(active);
  fill(box, ...nodes);
  if (had && field !== null) document.getElementById(field)?.focus();
}

// A box to write in: its label, the field and 보내기. A refused text is said under the field, as in project.js, so a
// phone shows it there and not under 보내기; anything else that went wrong is said under the box. The text is kept as
// it is typed.
function textForm(state, { id, what, label, placeholder, action }) {
  const t = state.threads;
  const error = t.errors.get(what) ?? null;
  const bad = error !== null && error.by === 'field';
  const field = h('input', {
    id, class: bad ? 'field bad' : 'field', placeholder, autocomplete: 'off', 'aria-invalid': bad ? 'true' : null,
    'aria-describedby': bad ? `${id}-error` : null,
    on: { input: () => keepText(state, what, field.value ?? '') },
  });
  field.value = textOf(state, what);
  const busy = t.sending.has(what);
  const submit = (event) => {
    event?.preventDefault?.();
    const text = field.value ?? '';
    keepText(state, what, text);
    write(state, what, text, action);
  };
  return h('form', { class: 'th-form', novalidate: true, on: { submit } },
    h('label', { class: 'l', for: id }, label),
    h('div', { class: 'form' }, h('div', {}, field, bad ? errorOf(state, what, error, id) : null),
      h('button', { type: 'submit', class: 'btn primary', disabled: busy, 'aria-busy': busy ? 'true' : null }, THREAD_WORDS.send)),
    bad ? null : errorOf(state, what, error, id));
}

function closeRow(state, thread, reopen = false) {
  const what = `${reopen ? 'reopen' : 'close'} ${thread.id}`;
  const t = state.threads;
  const busy = t.sending.has(what);
  return [
    h('div', { class: 'btns' }, h('button', {
      type: 'button', class: reopen ? 'btn tertiary' : 'btn tertiary sm', disabled: busy, 'aria-busy': busy ? 'true' : null,
      on: { click: () => write(state, what, '', () => closeOf(state, thread.id, reopen)) },
    }, reopen ? THREAD_WORDS.reopen : THREAD_WORDS.close)),
    errorOf(state, what, t.errors.get(what) ?? null, 'th-close'),
  ];
}

// What went wrong with a box or the close: by the field for a refused text, a message and 새로 고침 for something
// gone, and otherwise the message, 다시 시도 and the trace ID.
function errorOf(state, what, error, id) {
  if (error === null) return null;
  const { shell } = state.ctx;
  if (error.by === 'field') {
    // A div, not a p, as in projects.js: the shell's `.nx p{margin:0}` would take away err-text's space under the field.
    return h('div', { class: 'err-text', id: `${id}-error` }, error.text, error.limit ? ` ${THREAD_WORDS.limit}` : null);
  }
  if (error.by === 'gone') {
    return h('div', { class: 'nt warn', role: 'alert' }, h('div', { class: 'b' }, h('b', {}, shell.message(error.code))),
      h('button', { type: 'button', class: 'btn tertiary sm', on: { click: () => shell.reload() } }, THREAD_WORDS.reload));
  }
  return shell.errorNotice(error.outcome, () => {
    state.threads.errors.delete(what);
    write(state, what, closing(what) ? '' : textOf(state, what), error.action, error.kept);
  });
}

const closing = (what) => what.startsWith('close ') || what.startsWith('reopen ');

// Sends a box's text, or a close: action(text) gives the path, the body and what a success does. The request key is
// new for each send, and kept only to retry the same text after a timeout or a lost connection, since the same key
// with another body is refused. An empty text is refused here, and nothing is sent (SPEC-016).
async function write(state, what, text, action, kept = null) {
  const t = state.threads;
  if (t.sending.has(what)) return;
  if (!closing(what) && text.trim() === '') {
    t.errors.set(what, { by: 'field', text: THREAD_WORDS.empty });
    redraw(state, what);
    return;
  }
  const { path, body, done } = action(text);
  const key = kept !== null && kept.text === text ? kept.key : newRequestKey();
  t.errors.delete(what);
  t.sending.add(what);
  redraw(state, what);
  const outcome = await state.ctx.shell.write('POST', path, body, key);
  t.sending.delete(what);
  if (!t.host.live()) return;
  const { status, code = null, failure } = outcome;
  if (status === 200 || status === 201) {
    done(outcome.body);
    return;
  }
  // A 401 or a 403 went through the permission rule, which took the page; the text stays kept in this tab.
  if (status === 401 || status === 403 || failure === 'gate') return;
  const { shell } = state.ctx;
  if (status === 409 && code === 'thread_closed') {
    closedMeanwhile(state, what, text);
    return;
  }
  if (status === 404 && (code === 'project_not_found' || code === 'diagram_not_found')) {
    // SCR-145#error: after a write, the diagram is read again first.
    redraw(state, what);
    shell.reload();
    return;
  }
  if (status === 404) t.errors.set(what, { by: 'gone', code });
  else if (!closing(what) && (status === 400 || status === 413 || (status === 409 && code === 'request_key_reused'))) {
    t.errors.set(what, { by: 'field', text: shell.message(code), limit: code === 'text_too_long' || code === 'body_too_large' });
  } else {
    const retry = failure === 'timeout' || failure === 'network' ? { key, text } : null;
    t.errors.set(what, { by: 'notice', outcome, action, kept: retry });
  }
  redraw(state, what);
}

// Draws again what a write changed: the thread shown for a reply or a close, the box for a new comment.
function redraw(state, what) {
  if (what.startsWith('reply ') || closing(what)) {
    drawList(state);
    drawShown(state);
  } else {
    drawAdd(state);
  }
}

// API-267: a new thread at the place, shown once it is made, waiting on the agent.
function startOf(state, place, text) {
  const diagram = state.ctx.data.diagram;
  const body = { drawing: place.drawing, target: place.target, text };
  if (place.key !== null) body.element = place.key;
  return {
    path: `${diagramApi(diagram.project, diagram.id)}/threads`,
    body,
    done: (thread) => {
      const t = state.threads;
      // The diagram shown now: a read again may have drawn the view anew while the comment was sent.
      const now = state.ctx.data.diagram;
      if (!Array.isArray(now.threads)) now.threads = [];
      if (!now.threads.some((each) => each.id === thread.id)) {
        now.threads.push({
          id: thread.id, target: thread.target, element: thread.element, removed_name: thread.removed_name, state: thread.state,
          waits_on: thread.waits_on, last_at: thread.last_at, entries: thread.entries.length,
        });
      }
      t.shown = thread.id;
      t.thread = thread;
      t.failed = null;
      t.fromAddress = false;
      keepText(state, place.draft, '');
      drawList(state);
      drawShown(state);
      drawAdd(state);
    },
  };
}

// API-268: the owner's reply, added at the end; the thread then waits on the agent.
function replyOf(state, id, text) {
  const project = state.ctx.data.diagram.project;
  return {
    path: `${projectApi(project)}/threads/${encodeURIComponent(id)}/comments`,
    body: { text },
    done: (answer) => {
      const t = state.threads;
      if (t.thread?.id === id) {
        t.thread.entries.push(answer.entry);
        Object.assign(t.thread, summaryOf(answer.thread));
      }
      brief(state, id, answer.thread, 1);
      keepText(state, `reply ${id}`, '');
      drawList(state);
      drawShown(state);
    },
  };
}

// API-269: the thread shows closed. When it was the last open thread of a removed diagram, the diagram is read again:
// with nothing else waiting on it (a proposed AI proposal or a waiting direct edit, TASK-468) it is gone, and the
// stage's first diagram opens in its place (SPEC-027).
function closeOf(state, id, reopen = false) {
  const diagram = state.ctx.data.diagram;
  return {
    path: `${projectApi(diagram.project)}/threads/${encodeURIComponent(id)}/${reopen ? 'reopen' : 'close'}`,
    body: {},
    done: (answer) => {
      const t = state.threads;
      if (t.thread?.id === id) {
        Object.assign(t.thread, summaryOf(answer.thread));
        if (reopen) delete t.thread.resolved;
      }
      brief(state, id, answer.thread);
      drawList(state);
      drawShown(state);
      // The diagram shown now, which brief marked: a read again may have drawn the view anew while the close was sent.
      const now = state.ctx.data.diagram;
      if (!reopen && now.removed && !(now.threads ?? []).some((each) => each.state === 'open')) t.host.reload('instead');
      else if (!reopen && answer.thread.state === 'closed' && answer.thread.closed_by === 'reflection') refreshAfterClose(state, id);
    },
  };
}

function summaryOf(summary) {
  return { state: summary.state, waits_on: summary.waits_on, closed_by: summary.closed_by, last_at: summary.last_at };
}

// A reply to a thread closed meanwhile (SCR-145#stale): the bar over the picture, with 새로 고침, and the text moves
// to the box that starts a new thread at the same place: the thread's element when it is drawn readable, else the
// diagram as a whole. A removed diagram has no such box (SPEC-027), so there the thread stays as it is shown, the text
// in its reply box, until the owner reads again with the bar's 새로 고침: typed text is kept where it can be seen.
function closedMeanwhile(state, what, text) {
  const t = state.threads;
  const { shell } = state.ctx;
  const diagram = state.ctx.data.diagram;
  t.host.notice(shell.staleBar({ text: shell.message('thread_closed'), kept: THREAD_WORDS.kept }));
  if (diagram.removed) {
    drawShown(state);
    return;
  }
  const id = what.slice('reply '.length);
  const thread = t.thread?.id === id ? t.thread : null;
  if (thread !== null) Object.assign(thread, { state: 'closed', waits_on: null });
  const listed = (diagram.threads ?? []).find((each) => each.id === id);
  if (listed !== undefined) Object.assign(listed, { state: 'closed', waits_on: null });
  const where = thread ?? listed ?? null;
  const key = where !== null && (where.removed_name ?? null) === null && where.target !== 'diagram' ? where.element : null;
  const element = key === null ? null : (diagram.elements ?? []).find((each) => each.key === key && each.status !== 'unreadable') ?? null;
  const place = placeOf(diagram, element);
  const there = textOf(state, place.draft);
  keepText(state, place.draft, there === '' ? text : `${there} ${text}`);
  keepText(state, what, '');
  drawList(state);
  drawShown(state);
  drawAdd(state);
}
