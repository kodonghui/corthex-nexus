// Drawing a kept snapshot: the place where TASK-419 hooks in its diagrams and drawings (TBL-151, TBL-152, TBL-153;
// SPEC-001, SPEC-005). TASK-418, the snapshot's intake, keeps the snapshot and its documents and calls drawSnapshot
// once, in the same transaction, before it answers; until TASK-419 replaces this function, nothing is drawn.
//
// drawSnapshot(context) gets:
// - store: the store, in the push's transaction. Like any write handler, it does not wait (await) before it writes.
// - project: { id, name }, the project space's row key and name.
// - snapshot: { id, revision, commit, format, carries }: the snapshot's row key, its revision and commit, the format it
//   came in and the picture stages that format carries. A stage the format does not carry keeps its pictures as last
//   drawn (SPEC-005).
// - completed: false for a new snapshot; true when the same commit came again in a newer format, which completes its
//   revision (API-242): then documents holds only the documents that format added, the pictures of the stages the
//   older one did not carry, and the snapshot's other documents are those snapshot_files already names.
// - documents: the documents kept now, each { path, stage, part, key, kind, sha256 } (see snapshot.js): kind is
//   picture, items or snapshot; key is the file's path for a picture of stage 03, 08 or 09, otherwise null. A document
//   left out as REQ-077 asks is not among them.
// It returns what the push answer says of the drawing: { diagrams: { drawn, unchanged, failed, removed }, failures },
// failures as the contract's PushAnswer gives them. It refuses nothing: a source that cannot be parsed keeps its
// diagram's last good drawing and is named in failures.

export function drawSnapshot() {
  return { diagrams: { drawn: 0, unchanged: 0, failed: 0, removed: 0 }, failures: [] };
}
