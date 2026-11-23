// Agent comments (TASK-437; API-252 to API-255, SPEC-016, SPEC-017, SPEC-027): an agent comments, replies in a thread,
// marks a thread answered and reports where a decision is recorded.
//
// A thread is a row of TBL-155 comment_threads, on a diagram (TBL-151) at one of its drawings (TBL-152): on the diagram
// as a whole, on an element or on a row of an item table, by the element's key (TBL-153). Its comments and replies are
// rows of TBL-156 comments in order; an agent's names its credential, and detail keeps what has no column of its own:
// quote, asks, look_first and a decision's link. An entry with a link is a decision, any other a comment.
//
// - A comment (API-252) opens a thread at the current drawing of its diagram, or at the drawing the diagram showed at
//   commit when NEXUS holds that commit (the diagram's last drawn drawing at or before its revision; without one, the
//   current drawing). Its diagram is the one diagram names, or the one diagram of the stage and part whose drawing holds
//   item, or with neither the stage's first diagram, the one its address opens (project.js's DIAGRAM_ORDER). A removed
//   diagram is none of its stage's diagrams and takes no new thread; a diagram that never drew takes none either, and
//   the comment never moves to another diagram (SPEC-016, SPEC-027). An element that the drawing at commit holds and the
//   current drawing no longer does gets the thread on the diagram, its key kept and marked with its last name, as an
//   element that left would (SPEC-016, SPEC-027).
// - A file diagram holds its own trace ID as a whole (drawing.js's diagramTraceId): an item that no element of the
//   stage's drawings holds, but that names a file diagram of the stage and part, such as FL-005 for the flow named
//   "FL-005 Reflect accepted changes into Git", picks that diagram, and the thread goes on the diagram as a whole, as a
//   comment with diagram and no item does. An element that holds the item still wins, and two diagrams named by it get
//   diagram_ambiguous. With diagram, the item may be the one that diagram is named by. So an agent reaches each file of
//   stages 03, 08 and 09 through the hub's comment command, which sends item and never diagram.
// - An open thread waits only on the side that did not write last (SPEC-017): an agent's comment, reply or decision
//   makes it wait on the owner, and so does marking it answered, without a new entry. A decision on a closed thread is
//   kept and the thread stays closed: the link is a record, not a question.
// - The to-do follows through entries.js's threadChanged, in the same transaction. A write on a thread that waits on
//   the agent writes on its comment entry, so it keeps the entry's claim first (claims.js's keepClaim: another
//   session's claim refuses it with claimed), and since the write closes that entry, it then releases the session's
//   claim as done (finishClaim).
//
// Nothing here logs; a comment's text, a session's label and a link are in the store and the answers only (rule 5).

import { finishClaim, keepClaim, sessionOf } from './claims.js';
import { openAgentEntry, threadChanged } from './entries.js';
import { idOf, keyOf } from './ids.js';
import { LIMITS } from './limits.js';
import { invalidRequest, Problem } from './problem.js';
import { DIAGRAM_ORDER, projectHead } from './project.js';
import { STAGES } from './snapshot.js';
import { diagramTraceId } from './drawing.js';
import { diagramPart, threadItem } from './todo.js';

// The contract's limits and forms: Text, CommentRequest's quote and look_first, Link, Problem.diagrams, and a
// checkpoint request's lines and characters (API-252).
const TEXT_LIMIT = LIMITS.textCharacters;
const QUOTE_LIMIT = 4000;
const LOOK_FIRST_LIMIT = 2000;
const LINK_LIMIT = 2000;
const CHECKPOINT_LINES = 10;
const CHECKPOINT_CHARACTERS = 1200;
const AMBIGUOUS_LISTED = 500;
const PART = /^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/;
const PART_LENGTH = 100;
const ITEM = /^(?:[A-Z][A-Z0-9]*-[0-9]{1,6})?$/;
const ITEM_LENGTH = 30;
const COMMIT = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
const DIAGRAM = /^dg_[0-9a-hjkmnp-tv-z]{12}$/;
const DISCREPANCY = /^nd_[0-9a-hjkmnp-tv-z]{12}$/;
const LOOK_FIRST = /^(?:[A-Z][A-Z0-9]*-[0-9]{1,6}|https:\/\/\S+)$/;
const LINK = /^https:\/\/\S+$/;
const ASKS = Object.freeze(['answer', 'recommended', 'checkpoint']);
const STAGE_SET = new Set(STAGES);
const COMMENT_FIELDS = new Set(['part', 'stage', 'diagram', 'commit', 'discrepancy', 'item', 'text', 'quote', 'asks', 'look_first']);
const REPLY_FIELDS = new Set(['text', 'asks', 'look_first']);
const DECISION_FIELDS = new Set(['link', 'text']);

// The statements of each store, prepared on first use (see credentials.js).
const prepared = new WeakMap();

const THREAD = `SELECT h.id, h.diagram_id, h.state, h.waits_on, h.closed_by FROM comment_threads h
                JOIN diagrams d ON d.id = h.diagram_id`;

function statementsOf(store) {
  let statements = prepared.get(store);
  if (statements === undefined) {
    statements = {
      project: store.prepare('SELECT id, name, held_commit FROM project_spaces WHERE name = ?'),
      held: store.prepare('SELECT revision FROM snapshots WHERE project_id = ? AND commit_sha = ?'),
      // The stage's diagrams that are not removed, in DIAGRAM_ORDER; their parts are found after (see todo.js).
      stage: store.prepare(
        `SELECT d.id, d.stage, d.source_key, d.kind, d.name FROM diagrams d
         WHERE d.project_id = ? AND d.stage = ? AND d.removed_at IS NULL ORDER BY ${DIAGRAM_ORDER}`,
      ),
      diagram: store.prepare('SELECT id, stage, source_key, kind, name, removed_at FROM diagrams WHERE id = ? AND project_id = ?'),
      // The drawing a diagram shows: its last drawn one (SPEC-001). And the one it showed at a revision.
      current: store.prepare("SELECT id, document_version FROM drawings WHERE diagram_id = ? AND status = 'drawn' ORDER BY id DESC LIMIT 1"),
      shownAt: store.prepare(
        `SELECT w.id, w.document_version FROM drawings w JOIN snapshots s ON s.id = w.snapshot_id
         WHERE w.diagram_id = ? AND w.status = 'drawn' AND s.revision <= ? ORDER BY s.revision DESC, w.id DESC LIMIT 1`,
      ),
      element: store.prepare('SELECT element_key, name FROM elements WHERE drawing_id = ? AND trace_id = ? ORDER BY id LIMIT 1'),
      // Whether a drawing holds the element readable: one drawn as unreadable counts as gone (SPEC-027).
      holds: store.prepare(
        "SELECT 1 AS held FROM elements WHERE drawing_id = ? AND element_key = ? AND (status IS NULL OR status <> 'unreadable')",
      ),
      insertThread: store.prepare(
        `INSERT INTO comment_threads (diagram_id, drawing_id, target_kind, element_key, removed_name, state, waits_on, opened_at)
         VALUES (?, ?, ?, ?, ?, 'open', 'owner', ?)`,
      ),
      thread: store.prepare(`${THREAD} WHERE h.id = ? AND d.project_id = ?`),
      last: store.prepare('SELECT seq, created_at FROM comments WHERE thread_id = ? ORDER BY seq DESC LIMIT 1'),
      insertComment: store.prepare(
        "INSERT INTO comments (thread_id, seq, author, credential_id, body, detail, created_at) VALUES (?, ?, 'agent', ?, ?, ?, ?)",
      ),
      waitOnOwner: store.prepare("UPDATE comment_threads SET waits_on = 'owner' WHERE id = ? AND state = 'open'"),
    };
    prepared.set(store, statements);
  }
  return statements;
}

// The request's fields. Each refusal names the field and never repeats its value (rule 5). proposals.js (TASK-438)
// reads its request with the same functions.

const characters = (text) => [...text].length;

export function onlyFields(body, fields) {
  if (Object.keys(body).some((field) => !fields.has(field))) {
    throw invalidRequest('body', `the body takes ${[...fields].join(', ')} only`);
  }
}

// A string field in the contract's form: refused with invalid_request on field when it is not. A lone surrogate is
// refused too, as in boundedText: a link can become an entry's text, which the store would keep as another text.
export function formOf(body, field, { pattern, length, required = false }) {
  if (!Object.hasOwn(body, field)) {
    if (required) throw invalidRequest(field, `${field} is required`);
    return undefined;
  }
  const value = body[field];
  if (typeof value !== 'string' || !value.isWellFormed() || characters(value) > length || !pattern.test(value)) {
    throw invalidRequest(field, `${field} is not in its form`);
  }
  return value;
}

// A text of 1 to 4,000 characters that is not only white space (the contract's Text, SPEC-016): an empty one is
// refused, "write a comment", and a longer one with its limit.
export function textOf(body, field = 'text') {
  if (!Object.hasOwn(body, field)) throw invalidRequest(field, `${field} is required`);
  return boundedText(body[field], field, TEXT_LIMIT, { empty: false });
}

// Text of at most limit characters; empty allows an empty one, or one of only white space.
export function boundedText(value, field, limit, { empty }) {
  if (typeof value !== 'string') throw invalidRequest(field, `${field} must be text`);
  // A lone surrogate cannot be stored as UTF-8: the store would keep another text than the one given.
  if (!value.isWellFormed()) throw invalidRequest(field, `${field} must be Unicode text`);
  if (!empty && !/\S/u.test(value)) throw invalidRequest(field, `${field} must not be empty`);
  if (characters(value) > limit) {
    throw new Problem('text_too_long', `${field} is over ${limit} characters`, {}, { field, limit });
  }
  return value;
}

function asksOf(body) {
  if (!Object.hasOwn(body, 'asks')) return undefined;
  if (!ASKS.includes(body.asks)) throw invalidRequest('asks', 'asks is answer, recommended or checkpoint');
  return body.asks;
}

const lookFirstOf = (body) => formOf(body, 'look_first', { pattern: LOOK_FIRST, length: LOOK_FIRST_LIMIT });

// What an entry keeps beside its text (TBL-156's detail), with only the members it has.
function detailOf(fields) {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

// The members of TBL-156's detail that an entry keeps beside its text.
const ENTRY_DETAIL = Object.freeze(['quote', 'asks', 'look_first', 'link']);

// A comment as the contract's Entry: a decision when it has a link, a comment otherwise, with the members of its
// detail, parsed, that an entry keeps. An agent's entry is answered through it when it is added, and each entry of a
// thread when API-246 reads one (TASK-436, reads.js).
export function entryOf({ seq, author, body, detail, created_at: madeAt }) {
  const kept = Object.fromEntries(ENTRY_DETAIL.filter((name) => typeof detail[name] === 'string').map((name) => [name, detail[name]]));
  return { seq: Number(seq), author, kind: kept.link === undefined ? 'comment' : 'decision', text: body, ...kept, made_at: madeAt };
}

// API-252's CommentRequest. A checkpoint request (asks checkpoint) has no item, at most 10 lines and 1,200 characters,
// and look_first, which goes with it only.
function commentOf(body) {
  onlyFields(body, COMMENT_FIELDS);
  const part = formOf(body, 'part', { pattern: PART, length: PART_LENGTH, required: true });
  if (!Object.hasOwn(body, 'stage')) throw invalidRequest('stage', 'stage is required');
  if (!STAGE_SET.has(body.stage)) throw invalidRequest('stage', 'stage is one of the thirteen CORTHEX stages');
  const item = formOf(body, 'item', { pattern: ITEM, length: ITEM_LENGTH, required: true });
  const request = {
    part,
    stage: body.stage,
    item,
    diagram: formOf(body, 'diagram', { pattern: DIAGRAM, length: 15 }),
    commit: formOf(body, 'commit', { pattern: COMMIT, length: 64 }),
    discrepancy: formOf(body, 'discrepancy', { pattern: DISCREPANCY, length: 15 }),
    text: textOf(body),
    quote: Object.hasOwn(body, 'quote') ? boundedText(body.quote, 'quote', QUOTE_LIMIT, { empty: true }) : undefined,
    asks: asksOf(body),
    look_first: lookFirstOf(body),
  };
  if (request.asks === 'checkpoint') {
    if (item !== '') throw invalidRequest('item', 'a checkpoint request is on the stage as a whole, with no item');
    if (request.text.split('\n').length > CHECKPOINT_LINES) {
      throw invalidRequest('text', `a checkpoint request has at most ${CHECKPOINT_LINES} lines`);
    }
    if (characters(request.text) > CHECKPOINT_CHARACTERS) {
      throw new Problem('text_too_long', `a checkpoint request is over ${CHECKPOINT_CHARACTERS} characters`, {}, {
        field: 'text', limit: CHECKPOINT_CHARACTERS,
      });
    }
    if (request.look_first === undefined) throw invalidRequest('look_first', 'a checkpoint request needs look_first');
  } else if (request.look_first !== undefined) {
    throw invalidRequest('look_first', 'look_first goes with asks checkpoint only');
  }
  return request;
}

// API-253's ReplyRequest.
function replyOf(body) {
  onlyFields(body, REPLY_FIELDS);
  return { text: textOf(body), asks: asksOf(body), look_first: lookFirstOf(body) };
}

// API-255's DecisionRequest. The link stands as the entry's text when the text is missing, empty or only white space,
// since an entry always has text (the contract's Entry and TBL-156).
function decisionOf(body) {
  onlyFields(body, DECISION_FIELDS);
  const link = formOf(body, 'link', { pattern: LINK, length: LINK_LIMIT, required: true });
  if (!URL.canParse(link)) throw invalidRequest('link', 'link is not in its form');
  const text = Object.hasOwn(body, 'text') ? boundedText(body.text, 'text', TEXT_LIMIT, { empty: true }) : '';
  return { link, text: /\S/u.test(text) ? text : link };
}

export function emptyOf(body) {
  if (Object.keys(body).length > 0) throw invalidRequest('body', 'the body is the empty object {}');
}

// Where the store's rows go in the answers.

function projectOf(statements, name) {
  const row = statements.project.get(name);
  if (row === undefined) throw new Problem('project_not_found');
  return { id: Number(row.id), name: row.name, held_commit: row.held_commit };
}

// The thread the comment ID names in the project, or comment_not_found.
function threadOf(statements, project, id) {
  const key = keyOf('nc', id);
  const row = key === null ? undefined : statements.thread.get(key, project.id);
  if (row === undefined) throw new Problem('comment_not_found');
  return { id: key, state: row.state, waitsOn: row.waits_on, closedBy: row.closed_by };
}

// The contract's ThreadSummary of a thread, with the time of its last entry.
function summaryOf(statements, thread) {
  return {
    id: idOf('nc', thread.id),
    state: thread.state,
    waits_on: thread.waitsOn,
    closed_by: thread.closedBy,
    last_at: statements.last.get(thread.id).created_at,
  };
}

// Adds an agent's entry at the end of a thread: the contract's Entry.
function addEntry(statements, { thread, credential, text, detail, time }) {
  const seq = Number(statements.last.get(thread)?.seq ?? 0) + 1;
  statements.insertComment.run(thread, seq, credential, text, JSON.stringify(detail), time);
  return entryOf({ seq, author: 'agent', body: text, detail, created_at: time });
}

const timeNow = (now) => new Date(now()).toISOString();

// The drawing the diagram showed at revision, when NEXUS holds the comment's commit and the diagram had drawn by then,
// or else the one it shows now: { id, document_version }, or null when it never drew.
function drawingOf(statements, diagram, revision) {
  const at = revision === null ? undefined : statements.shownAt.get(diagram, revision);
  return at ?? statements.current.get(diagram) ?? null;
}

// The thread's diagram and drawing, and the element item names in that drawing (SPEC-016): { diagram, drawing,
// element }, element null without item or for an item that names the file diagram itself (see the top of this file).
function placeOf(store, statements, project, request) {
  const held = request.commit === undefined ? undefined : statements.held.get(project.id, request.commit);
  const revision = held === undefined ? null : Number(held.revision);
  const parts = new Map();
  const inPart = (row) => {
    const diagram = { id: Number(row.id), stage: row.stage, kind: row.kind, source_key: row.source_key };
    return diagramPart(store, diagram, parts) === request.part;
  };
  const elementOf = (drawing) => (request.item === '' ? null : statements.element.get(Number(drawing.id), request.item) ?? null);

  // The diagram diagram names: the stage's, of the part, and not removed (SPEC-027).
  if (request.diagram !== undefined) {
    const key = keyOf('dg', request.diagram);
    const row = key === null ? undefined : statements.diagram.get(key, project.id);
    if (row === undefined || row.removed_at !== null || row.stage !== request.stage || !inPart(row)) {
      throw new Problem('diagram_not_found');
    }
    const drawing = drawingOf(statements, key, revision);
    if (drawing === null) throw new Problem('diagram_not_found');
    const element = elementOf(drawing);
    if (request.item !== '' && element === null && diagramTraceId(row) !== request.item) throw itemNotFound(request.item);
    return { diagram: row, drawing, element };
  }

  const diagrams = statements.stage.all(project.id, request.stage).filter(inPart);
  // With neither, the stage's first diagram, the one its address opens; one that never drew takes no thread.
  if (request.item === '') {
    const [first] = diagrams;
    const drawing = first === undefined ? null : drawingOf(statements, Number(first.id), revision);
    if (drawing === null) throw new Problem('diagram_not_found');
    return { diagram: first, drawing, element: null };
  }

  // The item picks the one diagram whose drawing holds it.
  const drawn = diagrams.map((row) => ({ row, drawing: drawingOf(statements, Number(row.id), revision) }))
    .filter(({ drawing }) => drawing !== null);
  if (drawn.length === 0) throw new Problem('diagram_not_found');
  const holding = drawn.map((each) => ({ ...each, element: elementOf(each.drawing) })).filter(({ element }) => element !== null);
  if (holding.length > 1) throw ambiguous(holding);
  if (holding.length === 1) {
    const [{ row, drawing, element }] = holding;
    return { diagram: row, drawing, element };
  }
  // No element holds it: the file diagram it names holds it as a whole.
  const named = drawn.filter(({ row }) => diagramTraceId(row) === request.item);
  if (named.length === 0) throw itemNotFound(request.item);
  if (named.length > 1) throw ambiguous(named);
  const [{ row, drawing }] = named;
  return { diagram: row, drawing, element: null };
}

// diagram_ambiguous, naming the diagrams in the stage's order.
const ambiguous = (found) => new Problem('diagram_ambiguous', undefined, {}, {
  diagrams: found.slice(0, AMBIGUOUS_LISTED).map(({ row }) => idOf('dg', Number(row.id))),
});

const itemNotFound = (item) => new Problem('item_not_found', undefined, {}, { items: [item] });

// The thread's target (TBL-155): the diagram as a whole without element; an element, or a row of an item table, that
// the current drawing holds readable; or else the diagram, keeping the key of the element that left with its last name.
// An element the current drawing draws as unreadable counts as gone, as after-drawing.js counts it (SPEC-027).
function targetOf(statements, diagram, drawing, element) {
  if (element === null) return { kind: 'diagram', key: null, removedName: null };
  const key = element.element_key;
  const current = statements.current.get(Number(diagram.id));
  const held = statements.holds.get(Number(current.id), key) !== undefined;
  if (held) return { kind: diagram.kind === 'item_table' ? 'row' : 'element', key, removedName: null };
  return { kind: 'diagram', key, removedName: element.name === '' ? key : element.name };
}

// API-252: an agent's comment opens a thread that waits on the owner, a question of the owner's to-do (SPEC-016).
function leaveComment({ store, params, request: incoming, body, credential, now }) {
  sessionOf(incoming.headers, { required: true });
  const request = commentOf(body);
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  if (request.part !== '' && !projectHead(store, project).parts.includes(request.part)) throw new Problem('part_not_found');
  // NEXUS v3 opens no discrepancies, so none is ever found.
  if (request.discrepancy !== undefined) throw new Problem('discrepancy_not_found');
  const { diagram, drawing, element } = placeOf(store, statements, project, request);
  const target = targetOf(statements, diagram, drawing, element);
  const time = timeNow(now);
  const { lastInsertRowid } = statements.insertThread.run(
    Number(diagram.id), Number(drawing.id), target.kind, target.key, target.removedName, time,
  );
  const thread = Number(lastInsertRowid);
  const detail = detailOf({ quote: request.quote, asks: request.asks, look_first: request.look_first });
  const entry = addEntry(statements, { thread, credential: credential.key, text: request.text, detail, time });
  threadChanged(store, { project: project.id, thread, time });
  return {
    status: 201,
    body: {
      id: idOf('nc', thread),
      part: request.part,
      stage: request.stage,
      diagram: idOf('dg', Number(diagram.id)),
      drawing: idOf('dw', Number(drawing.id)),
      version: drawing.document_version,
      item: threadItem(target.kind, target.key),
      target: target.kind,
      element: target.key,
      removed_name: target.removedName,
      state: 'open',
      waits_on: 'owner',
      closed_by: null,
      opened_at: time,
      closed_at: null,
      last_at: time,
      entries: [entry],
      change_sets: [],
    },
  };
}

// An agent's write on an open thread that makes it wait on the owner (SPEC-017): keeps the claim of the thread's comment
// entry when it waits on the agent, runs write(), moves the thread to the owner's to-do and releases the claim as done.
function onOwner(store, statements, { project, thread, session, credential, time }, write) {
  const open = openAgentEntry(store, { project: project.id, prefix: 'nc', key: thread.id });
  const entry = open === null ? null : Number(open.id);
  if (entry !== null) keepClaim(store, { project: project.id, entry, session, credential: credential.key, time });
  const written = write();
  statements.waitOnOwner.run(thread.id);
  threadChanged(store, { project: project.id, thread: thread.id, time });
  if (entry !== null) finishClaim(store, { project: project.id, entry, session, time });
  return { written, thread: { ...thread, waitsOn: 'owner' } };
}

// What a proposal writes on its thread (TASK-438, API-256, proposals.js), through the same statements and rules as a
// comment and a reply:
// - openOwnThread opens an agent's own thread on the diagram as a whole at drawing, waiting on the owner, and returns its
//   key; the caller adds its first entry in the same transaction and calls threadChanged.
// - writeOnThread is an agent's write on an open thread, as a reply's (onOwner above), and returns what write returns.
// - addAgentEntry adds an agent's entry at the end of a thread and returns it as the contract's Entry.
export function openOwnThread(store, { diagram, drawing, time }) {
  const { lastInsertRowid } = statementsOf(store).insertThread.run(diagram, drawing, 'diagram', null, null, time);
  return Number(lastInsertRowid);
}

export function writeOnThread(store, { project, thread, session, credential, time }, write) {
  return onOwner(store, statementsOf(store), { project, thread, session, credential, time }, write).written;
}

export function addAgentEntry(store, { thread, credential, text, detail, time }) {
  return addEntry(statementsOf(store), { thread, credential, text, detail, time });
}

// API-253: an agent's reply, added in order; the thread then waits on the owner and leaves the agent to-do (SPEC-017).
function replyToComment({ store, params, request, body, credential, now }) {
  const session = sessionOf(request.headers, { required: true });
  const reply = replyOf(body);
  const time = timeNow(now);
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  const thread = threadOf(statements, project, params.comment);
  if (thread.state === 'closed') throw new Problem('thread_closed');
  const detail = detailOf({ asks: reply.asks, look_first: reply.look_first });
  const done = onOwner(store, statements, { project, thread, session, credential, time }, () => (
    addEntry(statements, { thread: thread.id, credential: credential.key, text: reply.text, detail, time })
  ));
  return { status: 201, body: { thread: summaryOf(statements, done.thread), entry: done.written } };
}

// API-254: the thread waits on the owner without a new entry. One that waits on the owner already, or is closed,
// answers changed false and changes nothing.
function markAnswered({ store, params, request, body, credential, now }) {
  const session = sessionOf(request.headers, { required: true });
  emptyOf(body);
  const time = timeNow(now);
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  const thread = threadOf(statements, project, params.comment);
  if (thread.state === 'closed' || thread.waitsOn === 'owner') {
    return { body: { thread: summaryOf(statements, thread), changed: false } };
  }
  const done = onOwner(store, statements, { project, thread, session, credential, time }, () => null);
  return { body: { thread: summaryOf(statements, done.thread), changed: true } };
}

// API-255: an entry of kind decision with its link. An open thread then waits on the owner, as after any agent's entry;
// a closed one takes it and stays closed.
function recordDecision({ store, params, request, body, credential, now }) {
  const session = sessionOf(request.headers, { required: true });
  const decision = decisionOf(body);
  const time = timeNow(now);
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  const thread = threadOf(statements, project, params.comment);
  const add = () => addEntry(statements, {
    thread: thread.id, credential: credential.key, text: decision.text, detail: { link: decision.link }, time,
  });
  if (thread.state === 'closed') {
    const entry = add();
    return { status: 201, body: { thread: summaryOf(statements, thread), entry } };
  }
  const done = onOwner(store, statements, { project, thread, session, credential, time }, add);
  return { status: 201, body: { thread: summaryOf(statements, done.thread), entry: done.written } };
}

// The routes of API-252 to API-255 (see router.js), of the agent family, each with its JSON body and request key
// (rule 3).
const PROJECT = Object.freeze({ project: 'project_not_found' });
const THREAD_PARAMS = Object.freeze({ project: 'project_not_found', comment: 'comment_not_found' });
const WRITE = Object.freeze({ method: 'POST', body: 'json', requestKey: true });

export const COMMENT_ROUTES = Object.freeze([
  { ...WRITE, path: '/api/spaces/{project}/comments', action: 'leaveComment', params: PROJECT, handle: leaveComment },
  { ...WRITE, path: '/api/spaces/{project}/comments/{comment}/replies', action: 'replyToComment', params: THREAD_PARAMS, handle: replyToComment },
  { ...WRITE, path: '/api/spaces/{project}/comments/{comment}/answered', action: 'markAnswered', params: THREAD_PARAMS, handle: markAnswered },
  { ...WRITE, path: '/api/spaces/{project}/comments/{comment}/decisions', action: 'recordDecision', params: THREAD_PARAMS, handle: recordDecision },
]);
