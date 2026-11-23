// The agent to-do (TASK-433; API-245, SPEC-014, SPEC-026, SPEC-031, SPEC-043): what waits on the agents of one
// project, from the open entries of TBL-166 that entries.js opens and closes, each with its claim (TBL-167).
//
// The answer is the contract's AgentTodo, each list oldest first:
// - comments: the threads that wait on the agent, with the last entry of each (SPEC-016, SPEC-017);
// - reflections: the change sets to reflect, one entry for those of a diagram in no pull request and one for each
//   pull request (SPEC-026), and the cancelled change sets to take out of an open pull request (SPEC-023);
// - checkpoints: the confirmations to record, and the cancels of recorded ones (SPEC-031, SPEC-030);
// - steps: during a workshop, the confirmed steps to write into the domain document (SPEC-039);
// - discrepancies: always empty, since NEXUS v3 opens none.
// Each list gives its total and at most the contract's 5000 entries (11 steps). waiting_for_user counts the owner's
// open entries of the project, and taken the listed entries that another session claims. A read writes nothing:
// read_at is the time of the answer, which the hub keeps as the session's read.
//
// The Nexus-Session header names the session that reads, so that each claim says whether it is the session's own
// (mine); without it no claim is. A claim is shown by claims.js's one rule of when it ends (SPEC-045): while its pull
// request is open, and otherwise for 60 minutes after the later of its last write and its pull request's close. Claims
// themselves are claims.js's (TASK-434).
//
// Nothing here logs; a comment's text is in the answer only, never in a log line (rule 5).

import { claimOf, pullRequestLink, sessionOf } from './claims.js';
import { heldChangeSets, isCheckpointStep } from './entries.js';
import { idOf } from './ids.js';
import { Problem } from './problem.js';

// AgentTodo's maxItems, and TodoReflection.change_sets'.
const LISTED = 5000;
const LISTED_STEPS = 11;
const HELD_CHANGE_SETS = 200;
// The contract's ItemRef and Part.
const TRACE_ID = /^[A-Z][A-Z0-9]*-[0-9]{1,6}$/;
const TRACE_ID_LENGTH = 30;
const PART = /^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/;
const PART_LENGTH = 100;

// The statements of each store, prepared on first use (see credentials.js).
const prepared = new WeakMap();

const OPEN_AGENT = "t.project_id = ? AND t.side = 'agent' AND t.closed_at IS NULL";

function statementsOf(store) {
  let statements = prepared.get(store);
  if (statements === undefined) {
    statements = {
      project: store.prepare('SELECT id, name, repository, held_commit FROM project_spaces WHERE name = ?'),
      comments: store.prepare(
        `SELECT t.id, t.thread_id, d.id AS diagram_id, d.stage, d.kind AS diagram_kind, d.source_key,
                h.target_kind, h.element_key, h.opened_at, c.author, c.body, c.created_at AS last_at
         FROM todos t
         JOIN diagrams d ON d.id = t.diagram_id
         JOIN comment_threads h ON h.id = t.thread_id
         JOIN comments c ON c.thread_id = h.id AND c.seq = (SELECT max(seq) FROM comments WHERE thread_id = h.id)
         WHERE ${OPEN_AGENT} AND t.kind = 'comment'
         ORDER BY t.created_at, t.id LIMIT ${LISTED}`,
      ),
      reflections: store.prepare(
        `SELECT t.id, t.kind, t.diagram_id, t.change_set_id, t.created_at, d.stage, d.kind AS diagram_kind, d.source_key
         FROM todos t JOIN diagrams d ON d.id = t.diagram_id
         WHERE ${OPEN_AGENT} AND t.kind IN ('reflect', 'remove_from_pr')
         ORDER BY t.created_at, t.id LIMIT ${LISTED}`,
      ),
      checkpoints: store.prepare(
        `SELECT t.id, t.kind, t.confirmation_id, d.id AS diagram_id, d.stage, d.kind AS diagram_kind, d.source_key,
                c.confirmed_at, c.ended_at, w.document_version
         FROM todos t
         JOIN diagrams d ON d.id = t.diagram_id
         JOIN confirmations c ON c.id = t.confirmation_id
         JOIN drawings w ON w.id = c.drawing_id
         WHERE ${OPEN_AGENT} AND t.kind IN ('record_confirmation', 'record_cancel')
         ORDER BY t.created_at, t.id LIMIT ${LISTED}`,
      ),
      steps: store.prepare(
        `SELECT t.workshop_id, t.step, s.confirmed_at
         FROM todos t JOIN workshop_steps s ON s.workshop_id = t.workshop_id AND s.step = t.step
         WHERE ${OPEN_AGENT} AND t.kind = 'write_step'
         ORDER BY t.created_at, t.id LIMIT ${LISTED_STEPS}`,
      ),
      totals: store.prepare(
        `SELECT
           count(*) FILTER (WHERE side = 'agent' AND kind = 'comment') AS comments,
           count(*) FILTER (WHERE side = 'agent' AND kind IN ('reflect', 'remove_from_pr')) AS reflections,
           count(*) FILTER (WHERE side = 'agent' AND kind IN ('record_confirmation', 'record_cancel')) AS checkpoints,
           count(*) FILTER (WHERE side = 'agent' AND kind = 'write_step') AS steps,
           count(*) FILTER (WHERE side = 'owner') AS owner
         FROM todos WHERE project_id = ? AND closed_at IS NULL`,
      ),
      claims: store.prepare(
        `SELECT c.todo_id, c.session, c.claimed_at, c.last_write_at, p.number, p.state AS pull_state, p.closed_at AS pull_closed_at
         FROM todos t
         JOIN claims c ON c.todo_id = t.id AND c.released_at IS NULL
         LEFT JOIN pull_requests p ON p.id = c.pull_request_id
         WHERE ${OPEN_AGENT}`,
      ),
      pullRequest: store.prepare('SELECT number FROM pull_requests WHERE id = ?'),
      lastDrawing: store.prepare('SELECT snapshot_id FROM drawings WHERE diagram_id = ? ORDER BY id DESC LIMIT 1'),
      rest: store.prepare(
        "SELECT b.body FROM snapshot_files f JOIN document_blobs b ON b.sha256 = f.blob_sha256 WHERE f.snapshot_id = ? AND f.path = '/snapshot'",
      ),
    };
    prepared.set(store, statements);
  }
  return statements;
}

// The part of the project a diagram belongs to, '' for the project as a whole (see the server's README, Drawing): a
// stage's picture names it in its source_key, /pictures/<stage>/<part>; an item table has none; a file's picture of
// stage 03, 08 or 09 has it only in the /snapshot document of the snapshot its last drawing comes from, beside the
// file's key. parts caches what a read found, by snapshot.
export function diagramPart(store, diagram, parts = new Map()) {
  const { id, stage, kind, source_key: key } = diagram;
  if (kind === 'item_table') return '';
  if (key.startsWith('/pictures/')) return key.split('/')[3] ?? '';
  const statements = statementsOf(store);
  const drawing = statements.lastDrawing.get(id);
  if (drawing === undefined) return '';
  const snapshot = Number(drawing.snapshot_id);
  if (!parts.has(snapshot)) {
    const found = new Map();
    const rest = statements.rest.get(snapshot);
    const pictures = rest === undefined ? [] : JSON.parse(rest.body).pictures;
    for (const picture of Array.isArray(pictures) ? pictures : []) {
      const part = picture?.part ?? '';
      if (typeof picture?.key === 'string' && typeof part === 'string' && part.length <= PART_LENGTH && PART.test(part)) {
        found.set(`${picture.stage}\n${picture.key}`, part);
      }
    }
    parts.set(snapshot, found);
  }
  return parts.get(snapshot).get(`${stage}\n${key}`) ?? '';
}

// The agent to-do of the project named name, as the contract's AgentTodo, or null when no project space has the
// name. session is the reading session's label or null, and now the time in milliseconds.
export function agentTodo(store, { name, session = null, now }) {
  const statements = statementsOf(store);
  const project = statements.project.get(name);
  if (project === undefined) return null;
  const projectId = Number(project.id);
  const repository = project.repository;
  const parts = new Map();
  const where = (row) => ({
    part: diagramPart(store, { id: row.diagram_id, stage: row.stage, kind: row.diagram_kind, source_key: row.source_key }, parts),
    stage: row.stage,
    diagram: idOf('dg', Number(row.diagram_id)),
  });
  const claims = new Map(statements.claims.all(projectId).map((row) => [Number(row.todo_id), row]));
  let taken = 0;
  const claimed = (todo, entry) => {
    const claim = claimOf(claims.get(Number(todo)), { entry, session, now, repository });
    if (claim !== null && !claim.mine) taken += 1;
    return claim;
  };

  const comments = statements.comments.all(projectId).map((row) => {
    const id = idOf('nc', Number(row.thread_id));
    const key = row.element_key ?? '';
    const item = row.target_kind !== 'diagram' && key.length <= TRACE_ID_LENGTH && TRACE_ID.test(key) ? key : '';
    return {
      id,
      ...where(row),
      item,
      target: row.target_kind,
      opened_at: row.opened_at,
      last_at: row.last_at,
      last_author: row.author,
      last_text: row.body,
      claim: claimed(row.id, id),
    };
  });

  // An entry holds at least one change set while entries.js keeps it open; one that holds none is left out, before
  // its claim is counted in taken.
  let empty = 0;
  const reflections = statements.reflections.all(projectId).map((row) => {
    const held = heldChangeSets(store, { project: projectId, entry: row });
    if (held.changeSets.length > 0) return { row, held };
    empty += 1;
    return null;
  }).filter((each) => each !== null).map(({ row, held }) => {
    const id = idOf('ne', Number(row.id));
    const number = held.pullRequest === null ? null : statements.pullRequest.get(held.pullRequest)?.number ?? null;
    return {
      id,
      ...where(row),
      task: row.kind === 'reflect' ? 'reflect' : 'remove',
      made_at: row.created_at,
      change_sets: held.changeSets.slice(0, HELD_CHANGE_SETS).map((key) => idOf('np', key)),
      pull_request: pullRequestLink(repository, number),
      claim: claimed(row.id, id),
    };
  });

  const checkpoints = statements.checkpoints.all(projectId).map((row) => {
    const id = idOf('nk', Number(row.confirmation_id));
    const cancel = row.kind === 'record_cancel';
    return {
      id,
      ...where(row),
      version: row.document_version,
      state: cancel ? 'withdrawn' : 'passed',
      passed_at: row.confirmed_at,
      withdrawn_at: cancel ? row.ended_at : null,
      claim: claimed(row.id, id),
    };
  });

  const steps = statements.steps.all(projectId).map((row) => ({
    workshop: idOf('ws', Number(row.workshop_id)),
    step: row.step,
    confirmed_at: row.confirmed_at,
    checkpoint: isCheckpointStep(row.step),
  }));

  const totals = statements.totals.get(projectId);
  return {
    project: project.name,
    default_commit: project.held_commit,
    session,
    read_at: new Date(now).toISOString(),
    comments: { total: Number(totals.comments), entries: comments },
    discrepancies: { total: 0, entries: [] },
    reflections: { total: Number(totals.reflections) - empty, entries: reflections },
    checkpoints: { total: Number(totals.checkpoints), entries: checkpoints },
    steps: { total: Number(totals.steps), entries: steps },
    waiting_for_user: Number(totals.owner),
    taken,
  };
}

// API-245: the agent to-do of {project}. A project without a space answers space_not_found, which the hub reads as an
// empty to-do.
function getAgentTodo({ store, params, request, now }) {
  const session = sessionOf(request.headers);
  const body = agentTodo(store, { name: params.project, session, now: now() });
  if (body === null) throw new Problem('space_not_found');
  return { body };
}

// The route of API-245 (see router.js), of the agent family.
export const TODO_ROUTES = Object.freeze([
  {
    method: 'GET',
    path: '/api/spaces/{project}/todo',
    action: 'getAgentTodo',
    params: { project: 'space_not_found' },
    handle: getAgentTodo,
  },
]);
