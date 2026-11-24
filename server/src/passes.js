// Stage passes (TASK-447; SPEC-035, REQ-042, TBL-161, notes 20 and 25 of the WBS): the one place that writes a stage's
// pass when every diagram of the stage has a recorded confirmation, and that marks the passes a recorded cancel took
// away. TASK-435 (after-drawing.js) marks a pass changed when a confirmation it rests on is invalidated or a diagram
// appears without one; the project read (project.js) shows them.
//
// - A pass (passStage) is written when every diagram of the stage that is not removed, item tables included and in
//   every part, since TBL-161 keeps no part, has a live confirmation that is recorded (SPEC-035): one invalidated
//   meanwhile and recorded at its version (SPEC-032) does not count, and a removed diagram counts for none (SPEC-027).
//   A stage with none of them gets no pass ("a stage with nothing to confirm → not passed"). Its passed_at is the date
//   of the last confirmation, the latest confirmed_at among them. A pass of the stage that is not marked changed and is
//   no older than that already rests on them, so none is written again. API-259 calls it when a record merges, and
//   the push (after-drawing.js) when it removes a diagram, which can complete a stage without any record.
// - A recorded cancel (cancelRecorded, TASK-446's approved rule) marks changed_at on the passes of the stage made while
//   that confirmation was live, from its confirmed_at to its ended_at, as an invalidation does (after-drawing.js): Git's
//   stage record changes when the cancel is recorded. A pass made after the owner confirmed again rests on the new
//   confirmation and is not marked.
//
// Nothing here logs (rule 5).

import { checkKey, checkTime } from './entries.js';

// The statements of each store, prepared on first use (see credentials.js).
const prepared = new WeakMap();

function statementsOf(store) {
  let statements = prepared.get(store);
  if (statements === undefined) {
    statements = {
      // Each diagram of the stage that is not removed, with the confirmed_at of its live, recorded confirmation or null.
      stage: store.prepare(
        `SELECT d.id, (SELECT k.confirmed_at FROM confirmations k
                       WHERE k.diagram_id = d.id AND k.state = 'confirmed' AND k.recorded_at IS NOT NULL) AS recorded
         FROM diagrams d WHERE d.project_id = ? AND d.stage = ? AND d.removed_at IS NULL`,
      ),
      resting: store.prepare(
        'SELECT 1 AS rests FROM stage_passes WHERE project_id = ? AND stage = ? AND changed_at IS NULL AND passed_at >= ? LIMIT 1',
      ),
      insert: store.prepare('INSERT INTO stage_passes (project_id, stage, passed_at) VALUES (?, ?, ?)'),
      confirmation: store.prepare(
        `SELECT d.stage, k.confirmed_at, k.ended_at FROM confirmations k JOIN diagrams d ON d.id = k.diagram_id
         WHERE k.id = ? AND k.project_id = ?`,
      ),
      change: store.prepare(
        `UPDATE stage_passes SET changed_at = ?
         WHERE project_id = ? AND stage = ? AND changed_at IS NULL AND passed_at >= ? AND passed_at <= ?`,
      ),
    };
    prepared.set(store, statements);
  }
  return statements;
}

// Writes the stage's pass when it has passed and no pass rests on its confirmations yet (see the top of this file).
// Returns the pass's passed_at, or null when none was written.
export function passStage(store, { project, stage }) {
  checkKey(project, 'project');
  if (typeof stage !== 'string' || stage === '') throw new TypeError('stage is a stage key');
  const statements = statementsOf(store);
  const diagrams = statements.stage.all(project, stage);
  if (diagrams.length === 0 || diagrams.some((diagram) => diagram.recorded === null)) return null;
  const last = diagrams.map((diagram) => diagram.recorded).sort().at(-1);
  if (statements.resting.get(project, stage, last) !== undefined) return null;
  statements.insert.run(project, stage, last);
  return last;
}

// Marks the passes that rested on the cancelled confirmation changed at time (see the top of this file). Returns how
// many were marked.
export function cancelRecorded(store, { project, confirmation, time }) {
  checkKey(project, 'project');
  checkKey(confirmation, 'confirmation');
  checkTime(time);
  const statements = statementsOf(store);
  const row = statements.confirmation.get(confirmation, project);
  if (row === undefined || row.ended_at === null) throw new TypeError('a cancel is of an ended confirmation of the project');
  return Number(statements.change.run(time, project, row.stage, row.confirmed_at, row.ended_at).changes);
}
