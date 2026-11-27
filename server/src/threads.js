// The owner's threads (TASK-443; API-266 to API-269, SPEC-016, SPEC-017, SPEC-027, SPEC-028, SPEC-051): the owner reads
// a thread, comments on a diagram, an element or a row, replies in a thread and closes it, on a PC or a phone alike
// (SPEC-051: a phone gets the same answers, and the page draws the rest, TASK-459). The agent's side is comments.js's
// (TASK-437), whose reading of a request's fields, a thread's target and summary, and entries this file shares.
//
// - A read (API-266) answers any thread of the project, the owner's or an agent's, open or closed, on a diagram removed
//   or not (SPEC-027), as an agent's read of a thread does (API-246): reads.js's threadBody, the one answer of both.
// - A comment (API-267) opens a thread at the drawing the owner names, a drawing of the diagram, which is the version
//   the comment is attached to (SPEC-016). On the diagram as a whole, any drawing of it takes the comment, one that
//   failed too, so the owner can tell the agent what to fix where it does not draw; an element or a row must be in that
//   drawing, and a failed drawing has none. An element that the drawing holds and the current drawing no longer holds
//   readable gets the thread on the diagram, its key kept and marked with its last name, as an element that left
//   would (comments.js's targetOf; SPEC-016, SPEC-027). A removed diagram takes no new thread (SPEC-027).
// - A reply (API-268) adds the owner's entry in order, and an open thread then waits on the agent (SPEC-017). A closed
//   thread takes none: thread_closed. An automatically resolved thread can be reopened by its owner (API-294).
// - Closing (API-269) marks the thread closed by the owner (SPEC-028); closed again, it answers changed false. It
//   changes only the thread: a proposal that answers it stays as it is, and a claim of its agent entry stays as its row
//   is and holds nothing once the entry closes (claims.js).
// - An open thread of a removed diagram is still read, replied to and closed (SPEC-027).
// - The to-do follows through entries.js's threadChanged, in the same transaction: a thread that waits on the agent is
//   a comment of the agent to-do and leaves the owner's, and a closed one is in neither (SPEC-016, SPEC-017,
//   SPEC-028). The owner's writes keep no claim: an owner's entry names no credential and no session.
//
// The choices that no approved document states (see the server's README, Threads) were approved through the
// maintainer's delegate.
// Nothing here logs; a comment's text is in the store and the answers only (rule 5).

import { emptyOf, entryOf, formOf, onlyFields, targetOf, textOf, threadSummary } from './comments.js';
import { threadChanged } from './entries.js';
import { idOf, keyOf } from './ids.js';
import { invalidRequest, Problem } from './problem.js';
import { threadBody } from './reads.js';
import { diagramPart, threadItem } from './todo.js';

// The contract's forms: StartThread's drawing and element (DrawingId, ElementKey), and its targets.
const DRAWING = /^dw_[0-9a-hjkmnp-tv-z]{12}$/;
const ELEMENT_KEY = /^\S(?:.*\S)?$/;
const ELEMENT_LENGTH = 200;
const TARGETS = Object.freeze(['diagram', 'element', 'row']);
const START_FIELDS = new Set(['drawing', 'target', 'element', 'text']);
const REPLY_FIELDS = new Set(['text']);

// The statements of each store, prepared on first use (see credentials.js).
const prepared = new WeakMap();

function statementsOf(store) {
  let statements = prepared.get(store);
  if (statements === undefined) {
    statements = {
      project: store.prepare('SELECT id FROM project_spaces WHERE name = ?'),
      diagram: store.prepare('SELECT id, stage, source_key, kind, removed_at FROM diagrams WHERE id = ? AND project_id = ?'),
      drawing: store.prepare('SELECT id, document_version FROM drawings WHERE id = ? AND diagram_id = ?'),
      element: store.prepare('SELECT element_key, name FROM elements WHERE drawing_id = ? AND element_key = ?'),
      insertThread: store.prepare(
        `INSERT INTO comment_threads (diagram_id, drawing_id, target_kind, element_key, removed_name, state, waits_on, opened_at)
         VALUES (?, ?, ?, ?, ?, 'open', 'agent', ?)`,
      ),
      thread: store.prepare(
        `SELECT h.id, h.state, h.waits_on, h.closed_by FROM comment_threads h JOIN diagrams d ON d.id = h.diagram_id
         WHERE h.id = ? AND d.project_id = ?`,
      ),
      last: store.prepare('SELECT seq FROM comments WHERE thread_id = ? ORDER BY seq DESC LIMIT 1'),
      insertComment: store.prepare(
        "INSERT INTO comments (thread_id, seq, author, credential_id, body, created_at) VALUES (?, ?, 'owner', NULL, ?, ?)",
      ),
      waitOnAgent: store.prepare("UPDATE comment_threads SET waits_on = 'agent' WHERE id = ? AND state = 'open'"),
      close: store.prepare(
        "UPDATE comment_threads SET state = 'closed', waits_on = NULL, closed_at = ?, closed_by = 'owner' WHERE id = ? AND state = 'open'",
      ),
      reopen: store.prepare("UPDATE comment_threads SET state = 'open', waits_on = 'agent', closed_at = NULL, closed_by = NULL WHERE id = ? AND state = 'closed' AND closed_by = 'reflection'"),
      reopened: store.prepare("INSERT INTO thread_resolution_events (thread_id, event, created_at) VALUES (?, 'reopened', ?)"),
      resolution: store.prepare('SELECT event FROM thread_resolution_events WHERE thread_id = ? ORDER BY id DESC LIMIT 1'),
    };
    prepared.set(store, statements);
  }
  return statements;
}

// API-267's StartThread. An element goes with a target of element or row, and none with the diagram as a whole.
function startOf(body) {
  onlyFields(body, START_FIELDS);
  const drawing = formOf(body, 'drawing', { pattern: DRAWING, length: 15, required: true });
  if (!Object.hasOwn(body, 'target')) throw invalidRequest('target', 'target is required');
  if (!TARGETS.includes(body.target)) throw invalidRequest('target', 'target is diagram, element or row');
  const element = formOf(body, 'element', { pattern: ELEMENT_KEY, length: ELEMENT_LENGTH });
  if (body.target === 'diagram' && element !== undefined) {
    throw invalidRequest('element', 'a comment on the diagram as a whole names no element');
  }
  if (body.target !== 'diagram' && element === undefined) {
    throw invalidRequest('element', `a comment on ${body.target === 'row' ? 'a row' : 'an element'} names its element`);
  }
  return { drawing, target: body.target, element, text: textOf(body) };
}

function replyOf(body) {
  onlyFields(body, REPLY_FIELDS);
  return { text: textOf(body) };
}

function projectOf(statements, name) {
  const row = statements.project.get(name);
  if (row === undefined) throw new Problem('project_not_found');
  return Number(row.id);
}

// The thread the thread ID names in the project, as { id, state, waitsOn, closedBy }, or thread_not_found. The router
// answers a malformed ID before the handler runs (params.js).
function threadOf(statements, project, id) {
  const key = keyOf('nc', id);
  const row = key === null ? undefined : statements.thread.get(key, project);
  if (row === undefined) throw new Problem('thread_not_found');
  return { id: key, state: row.state, waitsOn: row.waits_on, closedBy: row.closed_by };
}

// Adds the owner's entry at the end of a thread: the contract's Entry. An owner's entry names no credential and keeps
// nothing beside its text.
function addEntry(statements, { thread, text, time }) {
  const seq = Number(statements.last.get(thread)?.seq ?? 0) + 1;
  statements.insertComment.run(thread, seq, text, time);
  return entryOf({ seq, author: 'owner', body: text, detail: {}, created_at: time });
}

const timeNow = (now) => new Date(now()).toISOString();

// API-266: a thread of {project} with every entry in order (SPEC-016, SPEC-017).
function getThread({ store, params }) {
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  const key = keyOf('nc', params.thread);
  const body = key === null ? null : threadBody(store, project, key);
  if (body === null) throw new Problem('thread_not_found');
  return { body };
}

// The diagram {diagram} of the project, not removed (SPEC-027), and the drawing the comment names, one of its own; and
// the element it names in that drawing, or null for the diagram as a whole. A target of row is a row of an item table
// and one of element an element of a picture.
function placeOf(statements, project, id, request) {
  const key = keyOf('dg', id);
  const diagram = key === null ? undefined : statements.diagram.get(key, project);
  if (diagram === undefined || diagram.removed_at !== null) throw new Problem('diagram_not_found');
  const drawingKey = keyOf('dw', request.drawing);
  const drawing = drawingKey === null ? undefined : statements.drawing.get(drawingKey, key);
  if (drawing === undefined) throw new Problem('drawing_not_found');
  if (request.target === 'diagram') return { diagram, drawing, element: null };
  const table = diagram.kind === 'item_table';
  if ((request.target === 'row') !== table) {
    throw invalidRequest('target', table ? 'an item table takes a comment on a row' : 'only an item table has rows');
  }
  const element = statements.element.get(drawingKey, request.element);
  if (element === undefined) throw new Problem('element_not_found', undefined, {}, { element: request.element });
  return { diagram, drawing, element };
}

// API-267: the owner's comment opens a thread that waits on the agent, a comment of the agent to-do (SPEC-016).
function startThread({ store, params, body, now }) {
  const request = startOf(body);
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  const { diagram, drawing, element } = placeOf(statements, project, params.diagram, request);
  const target = targetOf(store, diagram, element);
  const time = timeNow(now);
  const { lastInsertRowid } = statements.insertThread.run(
    Number(diagram.id), Number(drawing.id), target.kind, target.key, target.removedName, time,
  );
  const thread = Number(lastInsertRowid);
  const entry = addEntry(statements, { thread, text: request.text, time });
  threadChanged(store, { project, thread, time });
  return {
    status: 201,
    body: {
      id: idOf('nc', thread),
      part: diagramPart(store, { ...diagram, id: Number(diagram.id) }),
      stage: diagram.stage,
      diagram: idOf('dg', Number(diagram.id)),
      drawing: idOf('dw', Number(drawing.id)),
      version: drawing.document_version,
      item: threadItem(target.kind, target.key),
      target: target.kind,
      element: target.key,
      removed_name: target.removedName,
      state: 'open',
      waits_on: 'agent',
      closed_by: null,
      opened_at: time,
      closed_at: null,
      last_at: time,
      entries: [entry],
      change_sets: [],
    },
  };
}

// API-268: the owner's reply, added in order; the thread then waits on the agent and leaves the owner's to-do
// (SPEC-017). A closed thread gets thread_closed.
function replyInThread({ store, params, body, now }) {
  const reply = replyOf(body);
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  const thread = threadOf(statements, project, params.thread);
  if (thread.state === 'closed') throw new Problem('thread_closed');
  const time = timeNow(now);
  const entry = addEntry(statements, { thread: thread.id, text: reply.text, time });
  statements.waitOnAgent.run(thread.id);
  threadChanged(store, { project, thread: thread.id, time });
  return { status: 201, body: { thread: threadSummary(store, { ...thread, waitsOn: 'agent' }), entry } };
}

// API-269: the owner closes the thread, which leaves both to-dos (SPEC-028). Closed already, by the owner or by a
// reflection: changed false, and nothing changes.
function closeThread({ store, params, body, now }) {
  emptyOf(body);
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  const thread = threadOf(statements, project, params.thread);
  if (thread.state === 'closed') return { body: { thread: threadSummary(store, thread), changed: false } };
  const time = timeNow(now);
  statements.close.run(time, thread.id);
  threadChanged(store, { project, thread: thread.id, time });
  const closed = { ...thread, state: 'closed', waitsOn: null, closedBy: 'owner' };
  return { body: { thread: threadSummary(store, closed), changed: true } };
}

// API-294: only the owner can reopen an automatically resolved thread. Retain an audit
// event and send the conversation to the agent, even when its target was removed.
function reopenThread({ store, params, body, now }) {
  emptyOf(body);
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  const thread = threadOf(statements, project, params.thread);
  if (thread.state === 'open') return { body: { thread: threadSummary(store, thread), changed: false } };
  if (thread.closedBy !== 'reflection' || statements.resolution.get(thread.id)?.event !== 'resolved') {
    throw invalidRequest('thread', 'only an automatically resolved thread can be reopened');
  }
  const time = timeNow(now);
  statements.reopen.run(thread.id);
  statements.reopened.run(thread.id, time);
  threadChanged(store, { project, thread: thread.id, time });
  const reopened = { ...thread, state: 'open', waitsOn: 'agent', closedBy: null };
  return { body: { thread: threadSummary(store, reopened), changed: true } };
}

// The routes of API-266 to API-269 (see router.js), of the owner family; the writes with a JSON body and a request key
// (rule 3).
const THREAD_PARAMS = Object.freeze({ project: 'project_not_found', thread: 'thread_not_found' });
const WRITE = Object.freeze({ method: 'POST', body: 'json', requestKey: true });

const THREAD_PATH = '/api/projects/{project}/threads/{thread}';
const DIAGRAM_PARAMS = Object.freeze({ project: 'project_not_found', diagram: 'diagram_not_found' });

export const THREAD_ROUTES = Object.freeze([
  { method: 'GET', path: THREAD_PATH, action: 'getThread', params: THREAD_PARAMS, handle: getThread },
  { ...WRITE, path: '/api/projects/{project}/diagrams/{diagram}/threads', action: 'startThread', params: DIAGRAM_PARAMS, handle: startThread },
  { ...WRITE, path: `${THREAD_PATH}/comments`, action: 'replyInThread', params: THREAD_PARAMS, handle: replyInThread },
  { ...WRITE, path: `${THREAD_PATH}/close`, action: 'closeThread', params: THREAD_PARAMS, handle: closeThread },
  { ...WRITE, path: `${THREAD_PATH}/reopen`, action: 'reopenThread', params: THREAD_PARAMS, handle: reopenThread },
]);
