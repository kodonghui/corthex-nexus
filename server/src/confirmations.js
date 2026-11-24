// Confirmations (TASK-446; API-275, API-276, SPEC-027, SPEC-029, SPEC-030, SPEC-031): the owner confirms a diagram or
// an item table at the drawing it shows, and cancels a confirmation. Both are owner operations with a JSON body and a
// request key (rule 3), each one write (writes.js). A phone offers neither (SPEC-029, REQ-068): that is the page's.
// Nothing here logs; the answer holds IDs, times and a commit only (rule 5).
//
// API-275 records a confirmation (TBL-160) of the diagram at the drawing named, state confirmed, and entries.js's
// confirmationsChanged closes the owner's confirm entry and adds recording it to the agent to-do (SPEC-031). The
// answer names the drawing it confirms, so the page can show what was confirmed, an empty item table among them.
// - The diagram. A removed one takes no confirmation (SPEC-027), nor does one of a stage the contract does not name,
//   which no read lists: both answer diagram_not_found. Every other diagram takes one, the mockup page and an item
//   table of any stage included (SPEC-005), since a stage passes only when each of them is confirmed (SPEC-035).
// - Confirmed already. While the diagram has a live confirmation, a confirm naming the drawing it shows or the drawing
//   it is confirmed at answers 200 with that confirmation and changed false (SPEC-029). The two differ when a later
//   drawing read the same documents and so kept the confirmation live (after-drawing.js, SPEC-033): its documents are
//   those it confirmed. A confirmation that ended, cancelled or invalidated, is not revived: confirming again makes a
//   new one.
// - The drawing. The request names the diagram's latest drawing, which drew. When the latest drawing failed, the
//   document does not draw, and the confirm is refused with not_drawn, even while the diagram shows its last good
//   drawing: the page shows where it failed (SCR-145). Another drawing of the diagram answers document_changed with the
//   latest drawing and its version ("look at the new version"); a drawing of no drawing of the diagram answers
//   drawing_not_found.
// - Waiting changes. While a change set of the diagram waits for reflection, accepted and not reflected, a direct edit
//   or an accepted proposal alike (entries.js's waitingChangeSets), the confirm is refused with waiting_reflection,
//   listing up to 200 of them, oldest accepted first (SPEC-029). A proposal that is only proposed does not wait: the
//   page says that AI proposals left out are not confirmed (SCR-145).
//
// API-276 ends a live confirmation as cancelled (SPEC-030), and confirmationsChanged puts the diagram back on the
// owner's to-do as not confirmed. One the agent has not recorded loses its agent entry, withdrawn (SPEC-031); one
// recorded already gets recording the cancel on the agent to-do (SPEC-030).
// - Not confirmed, that is cancelled or invalidated already, it answers the same with changed false and changes
//   nothing.
// - A removed diagram's confirmation is cancelled like any other (note 9 of the WBS): SPEC-027 refuses only confirming,
//   and a cancel only takes a confirmation out. The owner's to-do gets no confirm entry for it, since a removed diagram
//   takes no confirmation (entries.js).
// - A stage pass is left as it is. Between a cancel and its record the project page still shows the stage passed;
//   TASK-447, when the agent records the cancel, marks the passes resting on that confirmation changed_at, as
//   after-drawing.js does for an invalidation.

import { pullRequestLink } from './claims.js';
import { confirmationsChanged, waitingChangeSets } from './entries.js';
import { idOf, keyOf } from './ids.js';
import { invalidRequest, Problem } from './problem.js';
import { STAGES } from './snapshot.js';

const STAGE_SET = new Set(STAGES);
const DRAWING_ID = /^dw_[0-9a-hjkmnp-tv-z]{12}$/;
// The contract's Problem.change_sets lists at most 200.
const LISTED_WAITING = 200;

// The statements of each store, prepared on first use (see credentials.js).
const prepared = new WeakMap();

// A confirmation with the commit of the drawing it confirms and the number of its record's pull request, as a select
// list on CONFIRMATION_ROWS: confirmations k, drawings w and the pull request r of record_pull_request_id, which names
// the pull request of the record that is due, or of the last one recorded (reports.js, TASK-469). The diagram read
// (diagram.js) reads the same.
export const CONFIRMATION = `k.id, k.diagram_id, k.drawing_id, w.document_version, k.state, k.confirmed_at, k.ended_at, k.recorded_at,
  k.cancel_recorded_at, r.number AS record_number`;
export const CONFIRMATION_ROWS = `confirmations k JOIN drawings w ON w.id = k.drawing_id
  LEFT JOIN pull_requests r ON r.id = k.record_pull_request_id`;

function statementsOf(store) {
  let statements = prepared.get(store);
  if (statements === undefined) {
    statements = {
      project: store.prepare('SELECT id, repository FROM project_spaces WHERE name = ?'),
      diagram: store.prepare('SELECT id, stage, removed_at FROM diagrams WHERE id = ? AND project_id = ?'),
      drawing: store.prepare('SELECT id FROM drawings WHERE id = ? AND diagram_id = ?'),
      current: store.prepare('SELECT id, status, document_version FROM drawings WHERE diagram_id = ? ORDER BY id DESC LIMIT 1'),
      lastDrawn: store.prepare("SELECT id FROM drawings WHERE diagram_id = ? AND status = 'drawn' ORDER BY id DESC LIMIT 1"),
      live: store.prepare(
        `SELECT ${CONFIRMATION} FROM ${CONFIRMATION_ROWS} WHERE k.diagram_id = ? AND k.state = 'confirmed'`,
      ),
      confirmation: store.prepare(
        `SELECT ${CONFIRMATION} FROM ${CONFIRMATION_ROWS} WHERE k.id = ? AND k.project_id = ?`,
      ),
      insert: store.prepare(
        "INSERT INTO confirmations (project_id, diagram_id, drawing_id, state, confirmed_at) VALUES (?, ?, ?, 'confirmed', ?)",
      ),
      cancel: store.prepare("UPDATE confirmations SET state = 'cancelled', ended_at = ? WHERE id = ? AND state = 'confirmed'"),
    };
    prepared.set(store, statements);
  }
  return statements;
}

const timeOf = (now) => new Date(now()).toISOString();

// The contract's Confirmation, from a row of CONFIRMATION with the project's repository. pull_request is the link of
// the record's pull request, as an overlay's is built (diagram.js), and null while the project names no repository.
// The diagram read gives the diagram's latest confirmation in the same form (diagram.js).
export function confirmationBody(row, repository) {
  return {
    id: idOf('nk', Number(row.id)),
    diagram: idOf('dg', Number(row.diagram_id)),
    drawing: idOf('dw', Number(row.drawing_id)),
    version: row.document_version,
    state: row.state,
    confirmed_at: row.confirmed_at,
    ended_at: row.ended_at,
    recorded_at: row.recorded_at,
    cancel_recorded_at: row.cancel_recorded_at,
    pull_request: row.record_number === null ? null : pullRequestLink(repository, row.record_number),
  };
}

// The project space {project}: { id, repository }.
function projectOf(statements, name) {
  const row = statements.project.get(name);
  if (row === undefined) throw new Problem('project_not_found');
  return { id: Number(row.id), repository: row.repository };
}

// The drawing a Confirm names. Each refusal names the field and never repeats its value (rule 5).
function drawingField(body) {
  if (Object.keys(body).some((field) => field !== 'drawing')) throw invalidRequest('body', 'the body takes drawing only');
  if (!Object.hasOwn(body, 'drawing')) throw invalidRequest('drawing', 'drawing is required');
  if (typeof body.drawing !== 'string' || !DRAWING_ID.test(body.drawing)) throw invalidRequest('drawing', 'drawing is not in its form');
  return keyOf('dw', body.drawing);
}

// The diagram {diagram} of the project, which takes a confirmation: not removed (SPEC-027), of a stage the contract
// names.
function confirmableDiagram(statements, project, id) {
  const key = keyOf('dg', id);
  const row = key === null ? undefined : statements.diagram.get(key, project);
  if (row === undefined || row.removed_at !== null || !STAGE_SET.has(row.stage)) throw new Problem('diagram_not_found');
  return Number(row.id);
}

// API-275: confirms {diagram} at the drawing named (SPEC-029, SPEC-031).
function confirmDiagram({ store, params, body, now }) {
  const named = drawingField(body);
  const statements = statementsOf(store);
  const space = projectOf(statements, params.project);
  const project = space.id;
  const answer = (row) => confirmationBody(row, space.repository);
  const diagram = confirmableDiagram(statements, project, params.diagram);
  if (named === null || statements.drawing.get(named, diagram) === undefined) throw new Problem('drawing_not_found');
  const current = statements.current.get(diagram);
  const shown = current.status === 'drawn' ? Number(current.id) : Number(statements.lastDrawn.get(diagram)?.id ?? 0);
  const live = statements.live.get(diagram);
  if (live !== undefined && (named === Number(live.drawing_id) || named === shown)) {
    return { body: { confirmation: answer(live), changed: false } };
  }
  if (current.status !== 'drawn') throw new Problem('not_drawn', 'the diagram has no current drawing');
  if (named !== Number(current.id)) {
    throw new Problem('document_changed', undefined, {}, { drawing: idOf('dw', Number(current.id)), version: current.document_version });
  }
  const waiting = waitingChangeSets(store, { project, diagram, limit: LISTED_WAITING });
  if (waiting.length > 0) throw new Problem('waiting_reflection', undefined, {}, { change_sets: waiting.map((key) => idOf('np', key)) });
  const time = timeOf(now);
  const key = Number(statements.insert.run(project, diagram, named, time).lastInsertRowid);
  confirmationsChanged(store, { project, diagram, time });
  return { status: 201, body: { confirmation: answer(statements.confirmation.get(key, project)), changed: true } };
}

// API-276: cancels the confirmation {confirmation} (SPEC-030, SPEC-031).
function cancelConfirmation({ store, params, body, now }) {
  if (Object.keys(body).length > 0) throw invalidRequest('body', 'the body is the empty object {}');
  const statements = statementsOf(store);
  const space = projectOf(statements, params.project);
  const project = space.id;
  const answer = (row) => confirmationBody(row, space.repository);
  const key = keyOf('nk', params.confirmation);
  const row = key === null ? undefined : statements.confirmation.get(key, project);
  if (row === undefined) throw new Problem('confirmation_not_found');
  if (row.state !== 'confirmed') return { body: { confirmation: answer(row), changed: false } };
  const time = timeOf(now);
  statements.cancel.run(time, key);
  confirmationsChanged(store, { project, diagram: Number(row.diagram_id), time });
  return { body: { confirmation: answer(statements.confirmation.get(key, project)), changed: true } };
}

// The routes of API-275 and API-276 (see router.js), of the owner family.
export const CONFIRMATION_ROUTES = Object.freeze([
  {
    method: 'POST',
    path: '/api/projects/{project}/diagrams/{diagram}/confirmation',
    action: 'confirmDiagram',
    params: { project: 'project_not_found', diagram: 'diagram_not_found' },
    body: 'json',
    requestKey: true,
    handle: confirmDiagram,
  },
  {
    method: 'POST',
    path: '/api/projects/{project}/confirmations/{confirmation}/cancel',
    action: 'cancelConfirmation',
    params: { project: 'project_not_found', confirmation: 'confirmation_not_found' },
    body: 'json',
    requestKey: true,
    handle: cancelConfirmation,
  },
]);
