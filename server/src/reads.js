// Agent reads (TASK-436; API-244, API-246 to API-249, SPEC-013, SPEC-014, SPEC-016, SPEC-018, SPEC-024, SPEC-026,
// SPEC-031): what deleting a project space removes, and one comment thread, change set, reflection entry or
// confirmation, as the pinned hub's remove and show commands read them. A read writes nothing: it opens and closes no
// entry and keeps no claim.
//
// - API-244 is the agent's read of the preview that API-277 gives the owner: removal.js's removalPreview, the one
//   count.
// - API-246 (nc_): a thread of the project, the owner's or an agent's, on a diagram removed or not (SPEC-027), with
//   every entry in order, as comments.js's entryOf answers an entry, and the change sets that answer it
//   (change_sets.thread_id), oldest first, up to 200.
// - API-247 (np_): a change set. TBL-158's detail keeps a proposal as the hub sends it, under ProposalRequest's own
//   names: items, adds, reason, change and source_text, the proposed document, of which the answer says only whether it
//   came. A direct edit's detail has none of them: no items or adds, no reason or change, and no source_text. These
//   names bind the tasks that write the detail, TASK-438 and TASK-444 (see the server's README). changes are TBL-159's
//   steps in order. reflection is the reflection entry that reads back with the change set in it (see reflectionOf).
// - API-248 (ne_): a reflection or a removal entry, open or closed. An open entry holds what entries.js's
//   heldChangeSets finds. TBL-166 keeps only a closed entry's anchor, so a closed entry lists what it can still name: a
//   reflection closed as done lists the diagram's reflected change sets in its anchor's pull request, those it
//   reflected; one withdrawn, and a removal, list their anchor. Its state is done or withdrawn as it closed, and an
//   open entry's comes from its pull request, as API-258's reports set it: none waiting, open in_review, merged without
//   a merge commit merged, and with one reported.
// - API-249 (nk_): any confirmation of the project, which the hub calls a checkpoint. state is withdrawn once it is
//   cancelled and passed otherwise, an invalidated one included, as the agent to-do reads it. record_state tells how
//   far the record that is due got: the cancel's once a recorded confirmation is cancelled, the confirmation's own
//   otherwise; recorded when that is recorded, in_review while record_pull_request_id names an open pull request, and
//   waiting otherwise. A confirmation cancelled before it was recorded is withdrawn with record_state waiting: an agent
//   reads state first, so it never records a withdrawn one.
// A reflection's or a confirmation's claim is its open entry's live claim (claims.js). These reads take no session, so
// a claim is never mine. Nothing here logs; a comment's text and a session's label are in the answer only (rule 5).

import { claimOf, pullRequestLink } from './claims.js';
import { entryOf } from './comments.js';
import { MAX_TRACE_ID, TRACE_ID } from './drawer.js';
import { heldChangeSets, openAgentEntry } from './entries.js';
import { idOf, keyOf } from './ids.js';
import { LIMITS } from './limits.js';
import { Problem } from './problem.js';
import { removalPreview } from './removal.js';
import { diagramPart, threadItem } from './todo.js';

// The contract's limits: Thread.entries and change_sets, ChangeSet.changes, items and adds, Reflection.change_sets.
const ENTRIES = 100_000;
const THREAD_CHANGE_SETS = 200;
const CHANGES = 500;
const ITEMS = 50;
const HELD = 200;

// The statements of each store, prepared on first use (see credentials.js).
const prepared = new WeakMap();

// A diagram's columns that diagramPart reads, beside a row of what is on it.
const ON_DIAGRAM = 'd.stage, d.kind AS diagram_kind, d.source_key';

function statementsOf(store) {
  let statements = prepared.get(store);
  if (statements === undefined) {
    statements = {
      project: store.prepare('SELECT id, name, repository FROM project_spaces WHERE name = ?'),
      thread: store.prepare(
        `SELECT h.id, h.diagram_id, h.drawing_id, h.target_kind, h.element_key, h.removed_name, h.state, h.waits_on, h.closed_by,
                h.opened_at, h.closed_at, w.document_version, ${ON_DIAGRAM}
         FROM comment_threads h JOIN diagrams d ON d.id = h.diagram_id JOIN drawings w ON w.id = h.drawing_id
         WHERE h.id = ? AND d.project_id = ?`,
      ),
      entries: store.prepare(`SELECT seq, author, body, detail, created_at FROM comments WHERE thread_id = ? ORDER BY seq LIMIT ${ENTRIES}`),
      answering: store.prepare(`SELECT id FROM change_sets WHERE thread_id = ? ORDER BY id LIMIT ${THREAD_CHANGE_SETS}`),
      changeSet: store.prepare(
        `SELECT c.id, c.diagram_id, c.drawing_id, c.origin, c.thread_id, c.state, c.created_at, c.decided_at, c.pull_request_id,
                c.detail, w.document_version, ${ON_DIAGRAM}
         FROM change_sets c JOIN diagrams d ON d.id = c.diagram_id JOIN drawings w ON w.id = c.drawing_id
         WHERE c.id = ? AND c.project_id = ?`,
      ),
      changes: store.prepare(
        `SELECT op, element_key, new_name, target_key FROM changes WHERE change_set_id = ? ORDER BY seq LIMIT ${CHANGES}`,
      ),
      // A reflection or a removal entry of the project, open or closed.
      entry: store.prepare(
        `SELECT t.id, t.kind, t.diagram_id, t.change_set_id, t.created_at, t.closed_at, t.close_reason, ${ON_DIAGRAM}
         FROM todos t JOIN diagrams d ON d.id = t.diagram_id
         WHERE t.id = ? AND t.project_id = ? AND t.kind IN ('reflect', 'remove_from_pr')`,
      ),
      // The diagram's open reflection entries, oldest first, as heldChangeSets takes an entry.
      openReflections: store.prepare(
        "SELECT id, kind, diagram_id, change_set_id FROM todos WHERE diagram_id = ? AND project_id = ? AND kind = 'reflect' AND closed_at IS NULL ORDER BY id",
      ),
      // The latest removal entry of a change set, open or closed.
      removalOf: store.prepare(
        "SELECT id FROM todos WHERE change_set_id = ? AND diagram_id = ? AND project_id = ? AND kind = 'remove_from_pr' ORDER BY id DESC LIMIT 1",
      ),
      // The latest reflection entry of the diagram closed as done whose anchor is in the pull request.
      doneIn: store.prepare(
        `SELECT t.id FROM todos t JOIN change_sets c ON c.id = t.change_set_id
         WHERE t.diagram_id = ? AND t.project_id = ? AND t.kind = 'reflect' AND t.close_reason = 'done' AND c.pull_request_id = ?
         ORDER BY t.id DESC LIMIT 1`,
      ),
      anchorOf: store.prepare('SELECT pull_request_id FROM change_sets WHERE id = ?'),
      reflectedIn: store.prepare(
        `SELECT id FROM change_sets WHERE diagram_id = ? AND project_id = ? AND state = 'reflected' AND pull_request_id = ?
         ORDER BY id LIMIT ${HELD}`,
      ),
      pullRequest: store.prepare('SELECT number, state, merge_commit FROM pull_requests WHERE id = ?'),
      claim: store.prepare(
        `SELECT c.session, c.claimed_at, c.last_write_at, p.number, p.state AS pull_state, p.closed_at AS pull_closed_at
         FROM claims c LEFT JOIN pull_requests p ON p.id = c.pull_request_id
         WHERE c.todo_id = ? AND c.released_at IS NULL`,
      ),
      confirmation: store.prepare(
        `SELECT k.id, k.diagram_id, k.drawing_id, k.state, k.confirmed_at, k.ended_at, k.recorded_at, k.record_pull_request_id,
                k.cancel_recorded_at, w.document_version, ${ON_DIAGRAM}
         FROM confirmations k JOIN diagrams d ON d.id = k.diagram_id JOIN drawings w ON w.id = k.drawing_id
         WHERE k.id = ? AND k.project_id = ?`,
      ),
    };
    prepared.set(store, statements);
  }
  return statements;
}

function projectOf(statements, name) {
  const row = statements.project.get(name);
  if (row === undefined) throw new Problem('project_not_found');
  return { id: Number(row.id), name: row.name, repository: row.repository };
}

// The key of the row an ID names, or the Problem code given: the router answers a malformed ID before the handler runs
// (params.js), so only an ID in its form that names no row of the project reaches here.
function keyFrom(prefix, id, code) {
  const key = keyOf(prefix, id);
  if (key === null) throw new Problem(code);
  return key;
}

// Where a row is: { part, stage, diagram }, its diagram's part found as the agent to-do finds it (todo.js).
function whereOf(store, row) {
  const diagram = { id: Number(row.diagram_id), stage: row.stage, kind: row.diagram_kind, source_key: row.source_key };
  return { part: diagramPart(store, diagram), stage: row.stage, diagram: idOf('dg', diagram.id) };
}

// The live claim of an open entry, as the contract's Claim of entry (its ID), or null.
function claimOfEntry(statements, project, todo, entry, now) {
  return claimOf(statements.claim.get(todo), { entry, session: null, now, repository: project.repository });
}

const linkOf = (project, row) => (row === undefined ? null : pullRequestLink(project.repository, row.number));

// API-244: what deleting {project} removes, the preview API-277 gives the owner (SPEC-013).
function getProjectData({ store, params }) {
  const body = removalPreview(store, params.project);
  if (body === null) throw new Problem('project_not_found');
  return { body };
}

// API-246: a thread of {project} with every entry (SPEC-016).
function getComment({ store, params }) {
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  const key = keyFrom('nc', params.comment, 'comment_not_found');
  const row = statements.thread.get(key, project.id);
  if (row === undefined) throw new Problem('comment_not_found');
  const entries = statements.entries.all(key).map((entry) => entryOf({ ...entry, detail: JSON.parse(entry.detail) }));
  return {
    body: {
      id: idOf('nc', key),
      ...whereOf(store, row),
      drawing: idOf('dw', Number(row.drawing_id)),
      version: row.document_version,
      item: threadItem(row.target_kind, row.element_key),
      target: row.target_kind,
      element: row.element_key,
      removed_name: row.removed_name,
      state: row.state,
      waits_on: row.waits_on,
      closed_by: row.closed_by,
      opened_at: row.opened_at,
      closed_at: row.closed_at,
      last_at: entries.at(-1).made_at,
      entries,
      change_sets: statements.answering.all(key).map((each) => idOf('np', Number(each.id))),
    },
  };
}

// The trace IDs of a detail member, in the contract's form and at most ITEMS, or none.
function traceIds(value) {
  if (!Array.isArray(value)) return [];
  const ids = value.filter((each) => typeof each === 'string' && each.length <= MAX_TRACE_ID && TRACE_ID.test(each));
  return [...new Set(ids)].slice(0, ITEMS);
}

// A detail member that is a text of up to 4,000 characters (the contract's Text), or null.
const textOf = (value) => (typeof value === 'string' && [...value].length <= LIMITS.textCharacters ? value : null);

// The change sets a reflection or a removal entry holds (Reflection.change_sets): an open entry's group, as
// heldChangeSets finds it; a closed reflection's reflected change sets in its anchor's pull request when it closed as
// done; otherwise, and whenever that finds none, the anchor. Returns { changeSets, pullRequest }, keys.
function heldBy(store, statements, project, entry) {
  const anchor = Number(entry.change_set_id);
  if (entry.closed_at === null) {
    const held = heldChangeSets(store, { project: project.id, entry });
    return { changeSets: held.changeSets.length > 0 ? held.changeSets.slice(0, HELD) : [anchor], pullRequest: held.pullRequest };
  }
  const pullRequestId = statements.anchorOf.get(anchor)?.pull_request_id ?? null;
  const pullRequest = pullRequestId === null ? null : Number(pullRequestId);
  if (entry.kind === 'reflect' && entry.close_reason === 'done' && pullRequest !== null) {
    const reflected = statements.reflectedIn.all(Number(entry.diagram_id), project.id, pullRequest).map((row) => Number(row.id));
    if (reflected.length > 0) return { changeSets: reflected, pullRequest };
  }
  return { changeSets: [anchor], pullRequest };
}

// The reflection entry that reads back with the change set in it (ChangeSet.reflection, API-248), or null: for an
// accepted change set, the open reflection entry whose group holds it; for one cancelled in a pull request, the removal
// entry that takes it out, open or done; for a reflected one, the latest reflection of its diagram closed as done whose
// anchor is in its pull request; for any other (proposed, rejected, or cancelled outside a pull request), none.
function reflectionOf(store, statements, project, set) {
  const id = Number(set.id);
  const diagram = Number(set.diagram_id);
  let found;
  if (set.state === 'accepted') {
    found = statements.openReflections.all(diagram, project.id)
      .find((entry) => heldChangeSets(store, { project: project.id, entry }).changeSets.includes(id));
  } else if (set.state === 'cancelled' && set.pull_request_id !== null) {
    found = statements.removalOf.get(id, diagram, project.id);
  } else if (set.state === 'reflected' && set.pull_request_id !== null) {
    found = statements.doneIn.get(diagram, project.id, Number(set.pull_request_id));
  }
  return found === undefined ? null : Number(found.id);
}

// API-247: a change set of {project}, an AI proposal or a direct edit, with its changes and state (SPEC-018).
function getProposal({ store, params }) {
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  const key = keyFrom('np', params.proposal, 'proposal_not_found');
  const row = statements.changeSet.get(key, project.id);
  if (row === undefined) throw new Problem('proposal_not_found');
  const detail = JSON.parse(row.detail);
  const reflection = reflectionOf(store, statements, project, row);
  const pullRequest = row.pull_request_id === null ? undefined : statements.pullRequest.get(Number(row.pull_request_id));
  return {
    body: {
      id: idOf('np', key),
      ...whereOf(store, row),
      drawing: idOf('dw', Number(row.drawing_id)),
      version: row.document_version,
      origin: row.origin,
      thread: row.thread_id === null ? null : idOf('nc', Number(row.thread_id)),
      state: row.state,
      items: traceIds(detail.items),
      adds: traceIds(detail.adds),
      reason: textOf(detail.reason),
      change: textOf(detail.change),
      source_text: typeof detail.source_text === 'string' && detail.source_text !== '',
      changes: statements.changes.all(key).map((step) => ({
        op: step.op, element: step.element_key, name: step.new_name, target: step.target_key,
      })),
      made_at: row.created_at,
      decided_at: row.decided_at,
      reflection: reflection === null ? null : idOf('ne', reflection),
      pull_request: linkOf(project, pullRequest),
    },
  };
}

// The state of a reflection or removal entry (Reflection.state): as it closed, or else from its pull request.
function reflectionState(entry, pullRequest) {
  if (entry.closed_at !== null) return entry.close_reason;
  if (pullRequest === undefined) return 'waiting';
  if (pullRequest.state === 'open') return 'in_review';
  if (pullRequest.state === 'merged') return pullRequest.merge_commit === null ? 'merged' : 'reported';
  return 'waiting';
}

// API-248: a reflection or removal entry of {project}, open or closed (SPEC-024, SPEC-026).
function getEdit({ store, params, now }) {
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  const key = keyFrom('ne', params.edit, 'edit_not_found');
  const entry = statements.entry.get(key, project.id);
  if (entry === undefined) throw new Problem('edit_not_found');
  const held = heldBy(store, statements, project, entry);
  const pullRequest = held.pullRequest === null ? undefined : statements.pullRequest.get(held.pullRequest);
  const id = idOf('ne', key);
  return {
    body: {
      id,
      ...whereOf(store, entry),
      task: entry.kind === 'reflect' ? 'reflect' : 'remove',
      state: reflectionState(entry, pullRequest),
      change_sets: held.changeSets.map((each) => idOf('np', each)),
      pull_request: linkOf(project, pullRequest),
      commit: pullRequest?.merge_commit ?? null,
      made_at: entry.created_at,
      closed_at: entry.closed_at,
      claim: entry.closed_at === null ? claimOfEntry(statements, project, key, id, now()) : null,
    },
  };
}

// How far the record that is due got (Checkpoint.record_state).
function recordState(row, cancelDue, pullRequest) {
  if ((cancelDue ? row.cancel_recorded_at : row.recorded_at) !== null) return 'recorded';
  return pullRequest?.state === 'open' ? 'in_review' : 'waiting';
}

// API-249: a confirmation of {project} and its record (SPEC-031).
function getCheckpoint({ store, params, now }) {
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  const key = keyFrom('nk', params.checkpoint, 'checkpoint_not_found');
  const row = statements.confirmation.get(key, project.id);
  if (row === undefined) throw new Problem('checkpoint_not_found');
  const cancelled = row.state === 'cancelled';
  const cancelDue = cancelled && row.recorded_at !== null;
  const pullRequest = row.record_pull_request_id === null ? undefined : statements.pullRequest.get(Number(row.record_pull_request_id));
  const open = openAgentEntry(store, { project: project.id, prefix: 'nk', key });
  const id = idOf('nk', key);
  return {
    body: {
      id,
      ...whereOf(store, row),
      drawing: idOf('dw', Number(row.drawing_id)),
      version: row.document_version,
      state: cancelled ? 'withdrawn' : 'passed',
      confirmation: row.state,
      passed_at: row.confirmed_at,
      withdrawn_at: cancelled ? row.ended_at : null,
      recorded_at: row.recorded_at,
      cancel_recorded_at: row.cancel_recorded_at,
      record_state: recordState(row, cancelDue, pullRequest),
      pull_request: linkOf(project, pullRequest),
      claim: open === null ? null : claimOfEntry(statements, project, Number(open.id), id, now()),
    },
  };
}

// The routes of API-244 and API-246 to API-249 (see router.js), of the agent family.
const read = (path, action, params, handle) => ({ method: 'GET', path: `/api/spaces/{project}${path}`, action, params, handle });

export const READ_ROUTES = Object.freeze([
  read('/data', 'getProjectData', { project: 'project_not_found' }, getProjectData),
  read('/comments/{comment}', 'getComment', { project: 'project_not_found', comment: 'comment_not_found' }, getComment),
  read('/proposals/{proposal}', 'getProposal', { project: 'project_not_found', proposal: 'proposal_not_found' }, getProposal),
  read('/edits/{edit}', 'getEdit', { project: 'project_not_found', edit: 'edit_not_found' }, getEdit),
  read('/checkpoints/{checkpoint}', 'getCheckpoint', { project: 'project_not_found', checkpoint: 'checkpoint_not_found' }, getCheckpoint),
]);
