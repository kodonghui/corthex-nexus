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
//     checkpoints. A removed diagram marks no pass changed, since it counts for none (SPEC-027).
//   - A removed diagram can complete its stage: when every other diagram of the stage has a recorded confirmation,
//     passes.js's passStage writes the stage's pass, as API-259 does when a record merges (TASK-447).
// - Reflections (SPEC-025). The accepted change sets of a reflection pull request whose reported merge commit is the
//   drawn snapshot's commit are reflected, at the drawing the diagram shows after the push, even when that drawing
//   lacks the change, and a comment says what is missing: reflection.js's reflectMerged, which API-258 also runs when
//   NEXUS already holds the merge commit (TASK-447).
// - Threads (SPEC-027). An element leaves its stage document when a drawing of its diagram that drew no longer has it,
//   or draws it as unreadable (its part left out as unreadable counts as gone), or when the snapshot removes its
//   diagram, other than an item table that makes way for the stage's pictures (SPEC-005). Its open threads move to the
//   diagram's own comments: target diagram, the key kept and removed_name its last readable name. When a later drawing
//   has the element again, readable, its threads stay on the diagram and link to it again: removed_name is cleared. A
//   failed drawing moves nothing, and neither does a 0.2 snapshot that keeps a stage's pictures, since it removes none.
//   A removed diagram stays listed while it has open threads (project.js).
// - Positions (SPEC-012, TBL-154). Where the owner put an element stays while the drawing the diagram shows places it.
//   A new drawing that drew drops the positions of the elements it no longer places, as positions.js's placeable
//   says: an element that left the document, or one that no longer has a box of its own. An element drawn as
//   unreadable keeps its box, and its position (note 1 of the WBS): it has not left the document. A diagram the
//   snapshot removes drops all its positions, so an element of it that comes back stands where its drawer puts it. A
//   failed drawing, a source left out and a diagram drawn as before drop none. No drawing reads a position.
// - The to-do follows through entries.js, in the same transaction: confirmationsChanged for each diagram drawn for the
//   first time, back, removed or invalidated; and, through reflectMerged, changeSetsChanged for each diagram with
//   reflected change sets and threadChanged for each thread a reflection closed or opened.
//
// It returns the push answer's counts: { confirmations_invalidated, change_sets_reflected, threads_moved }. Nothing
// here logs (rule 5).

import { confirmationsChanged } from './entries.js';
import { passStage } from './passes.js';
import { placeable } from './positions.js';
import { reflectMerged } from './reflection.js';

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
      // Stage passes: those an invalidated confirmation rested on, and the stage's latest.
      changeSince: store.prepare(
        'UPDATE stage_passes SET changed_at = ? WHERE project_id = ? AND stage = ? AND changed_at IS NULL AND passed_at >= ?',
      ),
      latestPass: store.prepare(
        'SELECT id, changed_at FROM stage_passes WHERE project_id = ? AND stage = ? ORDER BY id DESC LIMIT 1',
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
      // Positions: those of a diagram, an element of a drawing, and dropping one or all of a diagram's.
      // The diagram's positions, each with its element in the drawing, kind and detail null when it has none.
      positions: store.prepare(
        `SELECT p.element_key, e.kind, e.detail FROM element_positions p
         LEFT JOIN elements e ON e.drawing_id = ? AND e.element_key = p.element_key
         WHERE p.diagram_id = ?`,
      ),
      dropPosition: store.prepare('DELETE FROM element_positions WHERE diagram_id = ? AND element_key = ?'),
      dropPositions: store.prepare('DELETE FROM element_positions WHERE diagram_id = ?'),
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

// The last name an element had in a drawing of its diagram that drew it readable, or null when it had none.
function readableNameOf(statements, diagram, key) {
  const name = statements.lastName.get(diagram, key)?.name;
  return typeof name === 'string' && name !== '' ? name : null;
}

// The name a moved thread is marked with: that last readable name, or the element's key when it had none.
const lastNameOf = (statements, diagram, key) => readableNameOf(statements, diagram, key) ?? key;

// The same last readable name for comments.js's targetOf, so that a comment on an element that left is marked as a
// thread the push moved is (SPEC-016, SPEC-027).
export const lastReadableName = (store, diagram, key) => readableNameOf(statementsOf(store), diagram, key);

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

// Drops the diagram's positions of the elements the drawing does not place (see positions.js's placeable). Unlike the
// threads, which readableKeys moves off an element drawn as unreadable (SPEC-027), its position stays (note 1).
function keepPlaced(statements, diagram, drawing) {
  for (const { element_key: key, kind, detail } of statements.positions.all(drawing, diagram)) {
    if (kind === null || !placeable({ kind, detail })) statements.dropPosition.run(diagram, key);
  }
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
  const removedFrom = new Set();

  for (const diagram of changed) {
    const { id, stage } = diagram;
    if (diagram.removed) {
      confirming.add(id);
      removedFrom.add(stage);
      if (!diagram.madeWay) counts.threads_moved += followElements(statements, id, null);
      statements.dropPositions.run(id);
      continue;
    }
    const drew = diagram.drawing !== null && diagram.status === 'drawn';
    if (diagram.created || diagram.restored || drew) confirming.add(id);

    if (drew) {
      keepPlaced(statements, id, diagram.drawing);
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

  // A stage whose diagram the snapshot removed may now have a recorded confirmation for every diagram it keeps.
  for (const stage of removedFrom) passStage(store, { project, stage });

  // Reflections, at the drawing the diagram shows after the push (reflection.js).
  counts.change_sets_reflected += reflectMerged(store, { project, commit, time });

  for (const diagram of confirming) confirmationsChanged(store, { project, diagram, time });
  return Object.fromEntries(Object.entries(counts).map(([name, value]) => [name, Math.min(value, COUNT)]));
}
