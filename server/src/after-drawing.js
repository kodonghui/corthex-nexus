// After a drawing (TASK-435; SPEC-025, SPEC-027, SPEC-033, SPEC-035): what a push changes once drawing.js has drawn its
// snapshot, in the push's transaction, before it answers (API-242). The push calls afterDrawing with what drawSnapshot
// changed, for a new snapshot and for a revision completed in a newer format alike.
//
// - Confirmations (SPEC-033). A diagram's live confirmation is invalidated by a new drawing of it that drew, when the
//   documents that drawing read differ from those of the confirmed drawing (their source_digest): a change only in a
//   file the diagram does not draw from keeps it, and so does a change that comes back to the confirmed text. A failed
//   drawing invalidates nothing, since the diagram still shows its last good drawing (SPEC-001).
// - Stage passes (SPEC-035, TBL-161). A pass stays in the record, and is marked changed since the pass (changed_at):
//   - when a confirmation it rests on is invalidated: every pass of the stage made since that confirmation was
//     confirmed and not marked yet;
//   - when, after the stage's latest pass, a diagram of the stage appears without a live confirmation: drawn for the
//     first time, back from removal, or a picture that replaces the stage's item table. The stage then no longer has a
//     recorded confirmation for every diagram, which SPEC-035's pass rests on. No approved document states this rule;
//     the coordinator chose it for TASK-435, and the maintainer approved it through the delegate they named for
//     checkpoints. A removed diagram changes no pass, since it counts for none (SPEC-027).
// - Reflections (SPEC-025). The accepted change sets of a reflection pull request whose reported merge commit is the
//   drawn snapshot's commit are reflected, at the drawing the diagram shows after the push, its latest that drew (a
//   failed drawing shows the last good one, SPEC-001), even when that drawing lacks the change: the comment saying what
//   is missing is TASK-447's (note 26 of the WBS). Only that exact commit marks them (API-258). The thread of a
//   proposal then closes, by reflection, once none of its change sets is proposed or accepted.
// - Threads (SPEC-027). An element leaves its stage document when a drawing of its diagram that drew no longer has it,
//   or draws it as unreadable (its part left out as unreadable counts as gone), or when the snapshot removes its
//   diagram, other than an item table that makes way for the stage's pictures (SPEC-005). Its open threads move to the
//   diagram's own comments: target diagram, the key kept and removed_name its last readable name. When a later drawing
//   has the element again, readable, its threads stay on the diagram and link to it again: removed_name is cleared. A
//   failed drawing moves nothing, and neither does a 0.2 snapshot that keeps a stage's pictures, since it removes none.
//   A removed diagram stays listed while it has open threads (project.js).
// - The to-do follows through entries.js, in the same transaction: confirmationsChanged for each diagram drawn for the
//   first time, back, removed or invalidated; changeSetsChanged for each diagram with reflected change sets; and
//   threadChanged for each thread a reflection closed.
//
// It returns the push answer's counts: { confirmations_invalidated, change_sets_reflected, threads_moved }. Nothing
// here logs (rule 5).

import { changeSetsChanged, confirmationsChanged, threadChanged } from './entries.js';

// PushAnswer's counts are at most 1,000,000.
const COUNT = 1_000_000;
const UNREADABLE = 'unreadable';

// The statements of each store, prepared on first use (see credentials.js).
const prepared = new WeakMap();

function statementsOf(store) {
  let statements = prepared.get(store);
  if (statements === undefined) {
    statements = {
      // A diagram's live confirmation, with the documents its drawing read.
      live: store.prepare(
        `SELECT k.id, k.confirmed_at, w.source_digest FROM confirmations k JOIN drawings w ON w.id = k.drawing_id
         WHERE k.diagram_id = ? AND k.state = 'confirmed'`,
      ),
      invalidate: store.prepare(
        "UPDATE confirmations SET state = 'invalidated', ended_at = ?, invalidated_by_drawing = ? WHERE id = ? AND state = 'confirmed'",
      ),
      // Whether a diagram has a drawing that drew before the given one.
      drawnBefore: store.prepare("SELECT 1 AS drawn FROM drawings WHERE diagram_id = ? AND status = 'drawn' AND id < ? LIMIT 1"),
      currentDrawn: store.prepare("SELECT id FROM drawings WHERE diagram_id = ? AND status = 'drawn' ORDER BY id DESC LIMIT 1"),
      latestDrawing: store.prepare('SELECT max(id) AS id FROM drawings WHERE diagram_id = ?'),
      // Stage passes: those an invalidated confirmation rested on, and the stage's latest.
      changeSince: store.prepare(
        'UPDATE stage_passes SET changed_at = ? WHERE project_id = ? AND stage = ? AND changed_at IS NULL AND passed_at >= ?',
      ),
      latestPass: store.prepare(
        'SELECT id, changed_at FROM stage_passes WHERE project_id = ? AND stage = ? ORDER BY passed_at DESC, id DESC LIMIT 1',
      ),
      changePass: store.prepare('UPDATE stage_passes SET changed_at = ? WHERE id = ? AND changed_at IS NULL'),
      // Threads.
      elements: store.prepare('SELECT element_key, status FROM elements WHERE drawing_id = ?'),
      threads: store.prepare(
        'SELECT id, state, target_kind, element_key, removed_name FROM comment_threads WHERE diagram_id = ? AND element_key IS NOT NULL ORDER BY id',
      ),
      lastName: store.prepare(
        `SELECT e.name FROM elements e JOIN drawings w ON w.id = e.drawing_id
         WHERE w.diagram_id = ? AND w.status = 'drawn' AND e.element_key = ? AND (e.status IS NULL OR e.status <> 'unreadable')
         ORDER BY w.id DESC LIMIT 1`,
      ),
      move: store.prepare("UPDATE comment_threads SET target_kind = 'diagram', removed_name = ? WHERE id = ?"),
      relink: store.prepare('UPDATE comment_threads SET removed_name = NULL WHERE id = ?'),
      // Reflections: the accepted change sets of the reflection pull requests whose merge commit is commit.
      reflecting: store.prepare(
        `SELECT c.id, c.diagram_id, c.thread_id FROM change_sets c
         JOIN pull_requests p ON p.id = c.pull_request_id AND p.project_id = c.project_id
         WHERE c.project_id = ? AND c.state = 'accepted' AND p.purpose = 'reflection' AND p.merge_commit = ?
         ORDER BY c.id`,
      ),
      reflect: store.prepare("UPDATE change_sets SET state = 'reflected', reflected_drawing_id = ? WHERE id = ? AND state = 'accepted'"),
      asking: store.prepare("SELECT 1 AS asking FROM change_sets WHERE thread_id = ? AND state IN ('proposed', 'accepted') LIMIT 1"),
      closeThread: store.prepare(
        "UPDATE comment_threads SET state = 'closed', waits_on = NULL, closed_at = ?, closed_by = 'reflection' WHERE id = ? AND state = 'open'",
      ),
    };
    prepared.set(store, statements);
  }
  return statements;
}

// The elements a drawing holds readable, by key: an element drawn as unreadable counts as gone (SPEC-027).
function readableKeys(statements, drawing) {
  const keys = new Set();
  for (const row of statements.elements.all(drawing)) {
    if (row.status !== UNREADABLE) keys.add(row.element_key);
  }
  return keys;
}

// The last name an element had in a drawing of its diagram that drew it readable, or its key when it had none.
function lastNameOf(statements, diagram, key) {
  const name = statements.lastName.get(diagram, key)?.name;
  return typeof name === 'string' && name !== '' ? name : key;
}

// Moves the open threads of the diagram's elements that keys does not hold to the diagram, and links again those moved
// before whose element keys holds. keys is null for a removed diagram, which holds none. Returns how many moved.
function followElements(statements, diagram, keys) {
  let moved = 0;
  for (const thread of statements.threads.all(diagram)) {
    const key = thread.element_key;
    const here = keys !== null && keys.has(key);
    if (thread.removed_name === null && !here && thread.state === 'open') {
      statements.move.run(lastNameOf(statements, diagram, key), Number(thread.id));
      moved += 1;
    } else if (thread.removed_name !== null && here) {
      statements.relink.run(Number(thread.id));
    }
  }
  return moved;
}

// Marks the stage's latest pass changed since the pass, unless it is already.
function changeLatestPass(statements, project, stage, time) {
  const pass = statements.latestPass.get(project, stage);
  if (pass !== undefined && pass.changed_at === null) statements.changePass.run(time, Number(pass.id));
}

// See the top of this file. changed is drawSnapshot's list; commit the drawn snapshot's commit.
export function afterDrawing(store, { project, commit, changed, time }) {
  const statements = statementsOf(store);
  const counts = { confirmations_invalidated: 0, change_sets_reflected: 0, threads_moved: 0 };
  const confirming = new Set();

  for (const diagram of changed) {
    const { id, stage } = diagram;
    if (diagram.removed) {
      confirming.add(id);
      if (!diagram.madeWay) counts.threads_moved += followElements(statements, id, null);
      continue;
    }
    const drew = diagram.drawing !== null && diagram.status === 'drawn';
    if (diagram.created || diagram.restored || drew) confirming.add(id);

    if (drew) {
      const live = statements.live.get(id);
      if (live !== undefined && live.source_digest !== diagram.digest) {
        statements.invalidate.run(time, diagram.drawing, Number(live.id));
        statements.changeSince.run(time, project, stage, live.confirmed_at);
        counts.confirmations_invalidated += 1;
      }
    }

    // The threads follow the elements of the drawing the diagram shows now, when that changed or it came back.
    if (drew || diagram.restored) {
      const shown = statements.currentDrawn.get(id);
      if (shown !== undefined) counts.threads_moved += followElements(statements, id, readableKeys(statements, Number(shown.id)));
    }

    // A diagram that appears without a live confirmation after the stage's latest pass marks it changed.
    const appears = diagram.restored || (drew && statements.drawnBefore.get(id, diagram.drawing) === undefined);
    if (appears && statements.currentDrawn.get(id) !== undefined && statements.live.get(id) === undefined) {
      changeLatestPass(statements, project, stage, time);
    }
  }

  // Reflections, at the drawing the diagram shows after the push. A change set is made against a drawing that drew,
  // so the diagram has one; its latest drawing is only a guard.
  const reflected = new Set();
  const asked = new Set();
  for (const set of statements.reflecting.all(project, commit)) {
    const diagram = Number(set.diagram_id);
    const shown = statements.currentDrawn.get(diagram) ?? statements.latestDrawing.get(diagram);
    statements.reflect.run(Number(shown.id), Number(set.id));
    counts.change_sets_reflected += 1;
    reflected.add(diagram);
    if (set.thread_id !== null) asked.add(Number(set.thread_id));
  }
  for (const diagram of reflected) changeSetsChanged(store, { project, diagram, time });
  for (const thread of asked) {
    if (statements.asking.get(thread) !== undefined) continue;
    if (statements.closeThread.run(time, thread).changes > 0) threadChanged(store, { project, thread, time });
  }

  for (const diagram of confirming) confirmationsChanged(store, { project, diagram, time });
  return Object.fromEntries(Object.entries(counts).map(([name, value]) => [name, Math.min(value, COUNT)]));
}
