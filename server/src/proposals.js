// Agent proposals (TASK-438; API-256, API-257, SPEC-014, SPEC-018, SPEC-027): an agent posts a change set laid over a
// drawn picture, and withdraws it while it is still proposed. The server's README, "Proposals", says the same for the
// owner's side.
//
// A proposal is a row of TBL-158 change_sets of origin proposal, state proposed, against the current drawing of one
// diagram (TBL-152), with its steps as rows of TBL-159 changes in order. TBL-158's detail keeps the request under
// ProposalRequest's own names, items, adds, reason, change and source_text, as API-247 reads it (reads.js, TASK-436).
//
// - Where it goes. Only a drawn picture of stage 01, 03, 05, 07 or 08 takes a proposal (the contract's ProposalStage);
//   stage 09 and any other stage get invalid_request on stage. The diagram is the comment's thread's, the one diagram
//   names, or the one diagram of the stage and part that holds every item. An item is held by an element of the
//   diagram's current drawing with that trace ID, or, when no element of the stage's drawings holds it, by the file
//   diagram it names (drawing.js's diagramTraceId), as a comment's item is (comments.js): then the proposal lays over
//   that diagram as a whole, its items keep the ID and mark no element. Items no diagram holds get item_not_found,
//   naming each; items that no single diagram holds all of, or that several hold, get diagram_ambiguous with those
//   diagrams in the stage's order. An item table, a diagram that never drew and a stage and part with no drawn picture
//   get not_drawn. A removed diagram is none of its stage's diagrams (SPEC-027, note 6 of the WBS): named by diagram or
//   reached through the comment's thread, it gets diagram_not_found, and an item only it held is not found.
// - The drawing it is against is the diagram's current one, its last drawn drawing (SPEC-001). A commit other than that
//   drawing's version is refused as document_changed, naming the drawing and its version, unless NEXUS holds the commit
//   and the diagram showed that same drawing at it: a push that left the diagram unchanged did not change its document.
// - Changes. With source_text on stage 03 or 08, whose diagram is one file, NEXUS draws the text with that diagram's own
//   drawer as the file at the diagram's key (drawing.js's drawProposed) and compares the two drawings by element key: in
//   the proposed drawing's order, an element only it has is a connect from its detail.from to its detail.to when it is
//   a line or an arrow between two of its elements, and an add otherwise; an element with another name is a rename;
//   then each element only the current drawing has, in its order, is a remove. Every other difference, a position
//   among them, makes no change. A text that does not draw gets invalid_request on source_text, naming the line it
//   fails at, and so do more than 500 changes. On stage 01, 05 and 07 NEXUS draws the hub's parsed picture and reads
//   none of their Markdown, SQL or YAML, so source_text is kept and makes no change: the change set marks its items
//   with the change text, as without source_text (see the README's gap).
// - The thread. Every proposal adds one agent entry to its thread, its change text, and the thread then waits on the
//   owner. With comment, it is that thread, of the stage and part, as a reply's (comments.js's writeOnThread): a closed
//   thread gets thread_closed, and while it waits on the agent, the proposal keeps the claim of its comment entry
//   (claims.js: another session's claim gets claimed) and releases it as done once written. Without comment, the
//   agent's own thread opens on the diagram as a whole at the proposal's drawing. The owner's to-do then holds the
//   thread's question and the proposal (entries.js's threadChanged and changeSetsChanged).
// - Withdrawing (API-257) cancels a proposal that is still proposed and closes the owner's proposal entry as withdrawn;
//   one withdrawn already answers changed false, and one accepted, rejected or reflected gets change_set_state with its
//   state. While the proposal's thread waits on the agent, the withdrawal is a write on its comment entry and keeps its
//   claim. The thread is kept as it is. A proposal on a diagram removed since can still be withdrawn.
//
// Nothing here logs; a proposal's text, its source_text and a session's label are in the store and the answers only
// (rule 5).

import { keepClaim, sessionOf } from './claims.js';
import { addAgentEntry, boundedText, emptyOf, formOf, onlyFields, openOwnThread, textOf, writeOnThread } from './comments.js';
import { MAX_TRACE_ID, TRACE_ID } from './drawer.js';
import { diagramTraceId, drawProposed } from './drawing.js';
import { changeSetsChanged, openAgentEntry, threadChanged } from './entries.js';
import { idOf, keyOf } from './ids.js';
import { invalidRequest, Problem } from './problem.js';
import { DIAGRAM_ORDER, projectHead } from './project.js';
import { changeSetOf } from './reads.js';
import { diagramPart } from './todo.js';

// The contract's ProposalStage, and the stages of it whose diagram is one file, which source_text draws.
const PROPOSAL_STAGES = Object.freeze(['01-domain', '03-user-flow', '05-erd', '07-sitemap', '08-screen-states']);
const DRAWN_FROM_TEXT = new Set(['03-user-flow', '08-screen-states']);
const ITEM_TABLE = 'item_table';
// Elements that join two others: a connect when the proposed drawing adds one.
const JOINING = new Set(['line', 'arrow']);
// The contract's limits and forms: ProposalRequest's items, adds and source_text, ChangeSet.changes, Problem.diagrams.
const ITEMS = 50;
const SOURCE_TEXT_LIMIT = 1_000_000;
const CHANGES = 500;
const AMBIGUOUS_LISTED = 500;
const PART = /^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/;
const PART_LENGTH = 100;
const COMMIT = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
const DIAGRAM = /^dg_[0-9a-hjkmnp-tv-z]{12}$/;
const DISCREPANCY = /^nd_[0-9a-hjkmnp-tv-z]{12}$/;
const COMMENT = /^nc_[0-9a-hjkmnp-tv-z]{12}$/;
const FIELDS = new Set(['part', 'stage', 'diagram', 'commit', 'discrepancy', 'items', 'reason', 'change', 'adds', 'source_text', 'comment']);

// The statements of each store, prepared on first use (see credentials.js).
const prepared = new WeakMap();

const DIAGRAM_COLUMNS = 'd.id, d.stage, d.source_key, d.kind, d.name, d.removed_at';

function statementsOf(store) {
  let statements = prepared.get(store);
  if (statements === undefined) {
    statements = {
      project: store.prepare('SELECT id, name, held_commit, repository FROM project_spaces WHERE name = ?'),
      held: store.prepare('SELECT revision FROM snapshots WHERE project_id = ? AND commit_sha = ?'),
      // The stage's diagrams that are not removed, in DIAGRAM_ORDER, as a comment finds them (comments.js).
      stage: store.prepare(
        `SELECT ${DIAGRAM_COLUMNS} FROM diagrams d
         WHERE d.project_id = ? AND d.stage = ? AND d.removed_at IS NULL ORDER BY ${DIAGRAM_ORDER}`,
      ),
      diagram: store.prepare(`SELECT ${DIAGRAM_COLUMNS} FROM diagrams d WHERE d.id = ? AND d.project_id = ?`),
      // The thread with its diagram's columns; id is the diagram's, as in the statements above.
      thread: store.prepare(
        `SELECT h.state, h.waits_on, ${DIAGRAM_COLUMNS} FROM comment_threads h JOIN diagrams d ON d.id = h.diagram_id
         WHERE h.id = ? AND d.project_id = ?`,
      ),
      // The drawing a diagram shows: its last drawn one (SPEC-001). And the one it showed at a revision.
      current: store.prepare("SELECT id, document_version FROM drawings WHERE diagram_id = ? AND status = 'drawn' ORDER BY id DESC LIMIT 1"),
      shownAt: store.prepare(
        `SELECT w.id FROM drawings w JOIN snapshots s ON s.id = w.snapshot_id
         WHERE w.diagram_id = ? AND w.status = 'drawn' AND s.revision <= ? ORDER BY s.revision DESC, w.id DESC LIMIT 1`,
      ),
      holds: store.prepare('SELECT 1 AS held FROM elements WHERE drawing_id = ? AND trace_id = ? LIMIT 1'),
      elements: store.prepare('SELECT element_key, kind, name FROM elements WHERE drawing_id = ? ORDER BY id'),
      insertChangeSet: store.prepare(
        `INSERT INTO change_sets (project_id, diagram_id, drawing_id, origin, thread_id, credential_id, state, created_at, detail)
         VALUES (?, ?, ?, 'proposal', ?, ?, 'proposed', ?, ?)`,
      ),
      insertChange: store.prepare(
        'INSERT INTO changes (change_set_id, seq, op, element_key, new_name, target_key) VALUES (?, ?, ?, ?, ?, ?)',
      ),
      proposal: store.prepare('SELECT id, diagram_id, origin, thread_id, state FROM change_sets WHERE id = ? AND project_id = ?'),
      withdraw: store.prepare("UPDATE change_sets SET state = 'cancelled', decided_at = ? WHERE id = ? AND state = 'proposed'"),
    };
    prepared.set(store, statements);
  }
  return statements;
}

// The request's fields. Each refusal names the field and never repeats its value (rule 5).

// A list of 1 to 50 different trace IDs (ProposalRequest's items and adds).
function traceIdsOf(body, field, { required = false } = {}) {
  if (!Object.hasOwn(body, field)) {
    if (required) throw invalidRequest(field, `${field} is required`);
    return undefined;
  }
  const value = body[field];
  if (!Array.isArray(value) || value.length < 1 || value.length > ITEMS) {
    throw invalidRequest(field, `${field} is a list of 1 to ${ITEMS} trace IDs`);
  }
  if (!value.every((each) => typeof each === 'string' && each.length <= MAX_TRACE_ID && TRACE_ID.test(each))) {
    throw invalidRequest(field, `${field} holds trace IDs only`);
  }
  if (new Set(value).size !== value.length) throw invalidRequest(field, `${field} names each trace ID once`);
  return value;
}

// API-256's ProposalRequest.
function proposalOf(body) {
  onlyFields(body, FIELDS);
  const part = formOf(body, 'part', { pattern: PART, length: PART_LENGTH, required: true });
  if (!Object.hasOwn(body, 'stage')) throw invalidRequest('stage', 'stage is required');
  if (!PROPOSAL_STAGES.includes(body.stage)) {
    throw invalidRequest('stage', `stage is one of ${PROPOSAL_STAGES.join(', ')}; comment on any other stage instead`);
  }
  return {
    part,
    stage: body.stage,
    diagram: formOf(body, 'diagram', { pattern: DIAGRAM, length: 15 }),
    commit: formOf(body, 'commit', { pattern: COMMIT, length: 64 }),
    discrepancy: formOf(body, 'discrepancy', { pattern: DISCREPANCY, length: 15 }),
    comment: formOf(body, 'comment', { pattern: COMMENT, length: 15 }),
    items: traceIdsOf(body, 'items', { required: true }),
    adds: traceIdsOf(body, 'adds'),
    reason: textOf(body, 'reason'),
    change: textOf(body, 'change'),
    sourceText: Object.hasOwn(body, 'source_text') ? sourceTextOf(body.source_text) : undefined,
  };
}

// The proposed document: text of 1 to 1,000,000 characters.
function sourceTextOf(value) {
  const text = boundedText(value, 'source_text', SOURCE_TEXT_LIMIT, { empty: true });
  if (text === '') throw invalidRequest('source_text', 'source_text must not be empty');
  return text;
}

// What TBL-158's detail keeps of a proposal, under ProposalRequest's own names (see the top of this file).
function detailOf(request) {
  return {
    items: request.items,
    ...(request.adds === undefined ? {} : { adds: request.adds }),
    reason: request.reason,
    change: request.change,
    ...(request.sourceText === undefined ? {} : { source_text: request.sourceText }),
  };
}

function projectOf(statements, name) {
  const row = statements.project.get(name);
  if (row === undefined) throw new Problem('project_not_found');
  return { id: Number(row.id), name: row.name, held_commit: row.held_commit, repository: row.repository };
}

const timeNow = (now) => new Date(now()).toISOString();

const itemNotFound = (items) => new Problem('item_not_found', undefined, {}, { items });

// diagram_ambiguous, naming the diagrams in the stage's order.
const ambiguous = (found) => new Problem('diagram_ambiguous', undefined, {}, {
  diagrams: found.slice(0, AMBIGUOUS_LISTED).map(({ row }) => idOf('dg', Number(row.id))),
});

// The comment's thread, of the stage and part, open and on a diagram that is not removed (see the top of this file):
// { id, diagram }, keys.
function threadOf(statements, project, request, inPart) {
  const key = keyOf('nc', request.comment);
  const row = key === null ? undefined : statements.thread.get(key, project.id);
  if (row === undefined || row.stage !== request.stage || !inPart(row)) throw new Problem('comment_not_found');
  if (row.removed_at !== null) throw new Problem('diagram_not_found');
  if (row.state === 'closed') throw new Problem('thread_closed');
  const diagram = Number(row.id);
  if (request.diagram !== undefined && keyOf('dg', request.diagram) !== diagram) {
    throw invalidRequest('diagram', 'diagram names another diagram than the comment\'s thread is on');
  }
  return { id: key, diagram };
}

// The diagram the proposal lays over and the drawing it is against (see the top of this file): { diagram, drawing },
// diagram a row of TBL-151 and drawing { id, document_version }.
function placeOf(statements, project, request, thread, inPart) {
  const holds = (drawing, item) => statements.holds.get(Number(drawing.id), item) !== undefined;
  let row;
  if (thread !== null) {
    row = statements.diagram.get(thread.diagram, project.id);
  } else if (request.diagram !== undefined) {
    const key = keyOf('dg', request.diagram);
    row = key === null ? undefined : statements.diagram.get(key, project.id);
    if (row === undefined || row.removed_at !== null || row.stage !== request.stage || !inPart(row)) {
      throw new Problem('diagram_not_found');
    }
  }
  if (row !== undefined) {
    const drawing = row.kind === ITEM_TABLE ? null : statements.current.get(Number(row.id)) ?? null;
    if (drawing === null) throw new Problem('not_drawn');
    const missing = request.items.filter((item) => !holds(drawing, item) && diagramTraceId(row) !== item);
    if (missing.length > 0) throw itemNotFound(missing);
    return { diagram: row, drawing };
  }

  // The items pick the one drawn picture of the stage and part that holds them all.
  const drawn = statements.stage.all(project.id, request.stage)
    .filter((each) => each.kind !== ITEM_TABLE && inPart(each))
    .map((each) => ({ row: each, drawing: statements.current.get(Number(each.id)) ?? null }))
    .filter(({ drawing }) => drawing !== null);
  if (drawn.length === 0) throw new Problem('not_drawn');
  const holders = new Map(request.items.map((item) => {
    const holding = drawn.filter(({ drawing }) => holds(drawing, item));
    return [item, holding.length > 0 ? holding : drawn.filter(({ row: each }) => diagramTraceId(each) === item)];
  }));
  const missing = request.items.filter((item) => holders.get(item).length === 0);
  if (missing.length > 0) throw itemNotFound(missing);
  const all = drawn.filter((each) => request.items.every((item) => holders.get(item).includes(each)));
  if (all.length === 1) return { diagram: all[0].row, drawing: all[0].drawing };
  throw ambiguous(all.length > 1 ? all : drawn.filter((each) => request.items.some((item) => holders.get(item).includes(each))));
}

// A commit the proposal is drawn against: the drawing's version, or a commit NEXUS holds at which the diagram showed the
// same drawing. Any other is document_changed.
function checkCommit(statements, project, diagram, drawing, commit) {
  if (commit === undefined || commit === drawing.document_version) return;
  const held = statements.held.get(project.id, commit);
  const shown = held === undefined ? undefined : statements.shownAt.get(Number(diagram.id), Number(held.revision));
  if (shown !== undefined && Number(shown.id) === Number(drawing.id)) return;
  throw new Problem('document_changed', undefined, {}, { drawing: idOf('dw', Number(drawing.id)), version: drawing.document_version });
}

const nameOrNone = (name) => (name === '' ? null : name);

// The changes a proposed document makes to the drawing (see the top of this file): each { op, element, name, target }.
function changesOf(statements, request, diagram, drawing) {
  if (request.sourceText === undefined || !DRAWN_FROM_TEXT.has(diagram.stage)) return [];
  const proposed = drawProposed({
    stage: diagram.stage, part: request.part, kind: diagram.kind, key: diagram.source_key, text: request.sourceText,
  });
  if (proposed === null) return [];
  if (proposed.failure !== undefined) {
    const { line } = proposed.failure;
    throw invalidRequest('source_text', line === null ? 'source_text does not draw' : `source_text does not draw at its line ${line}`);
  }
  const current = statements.elements.all(Number(drawing.id));
  const before = new Map(current.map((element) => [element.element_key, element]));
  const after = new Set(proposed.elements.map((element) => element.key));
  const changes = [];
  for (const element of proposed.elements) {
    const was = before.get(element.key);
    if (was === undefined) {
      const { from, to } = element.detail;
      const joins = JOINING.has(element.kind) && after.has(from) && after.has(to) && from !== to;
      changes.push(joins
        ? { op: 'connect', element: from, name: nameOrNone(element.name), target: to }
        : { op: 'add', element: element.key, name: nameOrNone(element.name), target: null });
    } else if (was.name !== element.name) {
      changes.push({ op: 'rename', element: element.key, name: element.name, target: null });
    }
  }
  for (const element of current) {
    if (!after.has(element.element_key)) changes.push({ op: 'remove', element: element.element_key, name: null, target: null });
  }
  if (changes.length > CHANGES) throw invalidRequest('source_text', `source_text makes more than ${CHANGES} changes`);
  return changes;
}

// API-256: an agent's proposal, laid over a drawn picture and put on the owner's to-do (SPEC-018).
function makeProposal({ store, params, request: incoming, body, credential, now }) {
  const session = sessionOf(incoming.headers, { required: true });
  const request = proposalOf(body);
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  if (request.part !== '' && !projectHead(store, project).parts.includes(request.part)) throw new Problem('part_not_found');
  // NEXUS v3 opens no discrepancies, so none is ever found.
  if (request.discrepancy !== undefined) throw new Problem('discrepancy_not_found');
  const parts = new Map();
  const inPart = (row) => diagramPart(store, { id: Number(row.id), stage: row.stage, kind: row.kind, source_key: row.source_key }, parts)
    === request.part;
  const thread = request.comment === undefined ? null : threadOf(statements, project, request, inPart);
  const { diagram, drawing } = placeOf(statements, project, request, thread, inPart);
  checkCommit(statements, project, diagram, drawing, request.commit);
  const changes = changesOf(statements, request, diagram, drawing);
  const time = timeNow(now);
  const detail = JSON.stringify(detailOf(request));
  const write = (threadKey) => {
    const { lastInsertRowid } = statements.insertChangeSet.run(
      project.id, Number(diagram.id), Number(drawing.id), threadKey, credential.key, time, detail,
    );
    const key = Number(lastInsertRowid);
    changes.forEach((change, index) => {
      statements.insertChange.run(key, index + 1, change.op, change.element, change.name, change.target);
    });
    addAgentEntry(store, { thread: threadKey, credential: credential.key, text: request.change, detail: {}, time });
    changeSetsChanged(store, { project: project.id, diagram: Number(diagram.id), time });
    return key;
  };
  let key;
  if (thread === null) {
    const own = openOwnThread(store, { diagram: Number(diagram.id), drawing: Number(drawing.id), time });
    key = write(own);
    threadChanged(store, { project: project.id, thread: own, time });
  } else {
    key = writeOnThread(store, { project, thread, session, credential, time }, () => write(thread.id));
  }
  return { status: 201, body: changeSetOf(store, project, key) };
}

// API-257: the agent withdraws its proposal while it is proposed (SPEC-018); withdrawn again, changed false.
function withdrawProposal({ store, params, request, body, credential, now }) {
  const session = sessionOf(request.headers, { required: true });
  emptyOf(body);
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  const key = keyOf('np', params.proposal);
  const row = key === null ? undefined : statements.proposal.get(key, project.id);
  if (row === undefined || row.origin !== 'proposal') throw new Problem('proposal_not_found');
  if (row.state === 'cancelled') return { body: { proposal: changeSetOf(store, project, key), changed: false } };
  if (row.state !== 'proposed') {
    throw new Problem('change_set_state', `the change set is ${row.state}; only a proposed one can be withdrawn`, {}, { state: row.state });
  }
  const time = timeNow(now);
  // While the thread waits on the agent, the withdrawal is a write on its comment entry.
  const open = openAgentEntry(store, { project: project.id, prefix: 'nc', key: Number(row.thread_id) });
  if (open !== null) keepClaim(store, { project: project.id, entry: Number(open.id), session, credential: credential.key, time });
  statements.withdraw.run(time, key);
  changeSetsChanged(store, { project: project.id, diagram: Number(row.diagram_id), time });
  return { body: { proposal: changeSetOf(store, project, key), changed: true } };
}

// The routes of API-256 and API-257 (see router.js), of the agent family, each with its JSON body and request key
// (rule 3).
const WRITE = Object.freeze({ method: 'POST', body: 'json', requestKey: true });

export const PROPOSAL_ROUTES = Object.freeze([
  { ...WRITE, path: '/api/spaces/{project}/proposals', action: 'makeProposal', params: { project: 'project_not_found' }, handle: makeProposal },
  {
    ...WRITE,
    path: '/api/spaces/{project}/proposals/{proposal}/withdraw',
    action: 'withdrawProposal',
    params: { project: 'project_not_found', proposal: 'proposal_not_found' },
    handle: withdrawProposal,
  },
]);
