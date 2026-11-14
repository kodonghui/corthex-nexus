// A project's data (API-177, SPEC-203), the removal's dry run (API-110,
// SPEC-115) and the export (API-178, SPEC-201), from the rows that store.js
// reads in one batch each. The panel's counts, the dry run and the export's
// head count the same rows in the same way, so the three cannot differ.
// Nothing here reads the database or the request.
import * as E from "./entries.js";
import { snapshotHead } from "./home-data.js";

// rows are the answers of store.js's REMOVAL, in its order: the counts of the
// six tables, of the replies and of the decisions, then the four lists.
export function removal(project, space, rows) {
  const deletes = { snapshot: true, space };
  ["pictures", "discrepancies", "comments", "proposals", "edits", "checkpoints"].forEach((table, i) => { deletes[table] = rows[i].results[0].n; });
  deletes.replies = rows[6].results[0].n;
  deletes.decisions = rows[7].results[0].n;
  const open = {};
  ["comments", "proposals", "reflections", "checkpoints"].forEach((name, i) => {
    const entries = rows[i + 8].results;
    open[name] = { total: entries[0]?._total || 0, ids: entries.map((row) => row.id) };
  });
  return { project, deletes, open };
}

// The stored snapshot as the project's card gives it; the space's last read
// with its session label and the oldest time since which an entry that the
// agent has not read waits (SPEC-188, SPEC-189), none of them for a project
// without a space; and the dry run.
export function projectData(head, read, dryRun) {
  const { title, repository, commit, generated_at, pushed_at } = snapshotHead(head);
  return { project: head.name, title, repository, commit, revision: head.revision, generated_at, pushed_at,
    space: Boolean(read), read_at: read?.read_at ?? null, read_session: read?.read_session ?? null,
    unread_since: read ? E.spaceRead(read).unread_since : null, removal: dryRun };
}

// The export, with its head first and its lists in the order that store.js
// reads them; counts are the lengths of the lists that the file holds. It
// holds no snapshot, picture, discrepancy, claim, write ID, session label or
// identity (SPEC-201).
export function projectExport(project, now, head, read, [comments, replies, decisions, proposals, edits, checkpoints]) {
  const byComment = (rows) => {
    const held = new Map();
    for (const row of rows) {
      if (!held.has(row.comment)) held.set(row.comment, []);
      held.get(row.comment).push(row);
    }
    return held;
  };
  const repliesOf = byComment(replies), decisionsOf = byComment(decisions);
  return { format: 1, project, commit: head.default_commit || null, exported_at: now, read_at: read?.read_at ?? null, space: Boolean(read),
    counts: { comments: comments.length, replies: replies.length, decisions: decisions.length, proposals: proposals.length,
      edits: edits.length, checkpoints: checkpoints.length },
    comments: comments.map((row) => ({ ...E.comment(row), replies: (repliesOf.get(row.id) || []).map(E.reply),
      decisions: (decisionsOf.get(row.id) || []).map(E.decision) })),
    proposals: proposals.map((row) => E.proposal(row, true)),
    edits: edits.map(E.edit),
    checkpoints: checkpoints.map(E.checkpoint) };
}
