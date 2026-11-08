// The workspace's talk (API-152, SPEC-150): a part's stage talk by turn, from
// the rows that store.js reads. Nothing here reads the database or the request.
import * as E from "./entries.js";

export const TURN = 200;
export const CLOSED = 50;

// Oldest first by a time, or newest first, then by ID, as SQL orders them.
const by = (field, newest = false) => (a, b) =>
  (a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0) * (newest ? -1 : 1) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const first = (entries) => ({ total: entries.length, entries: entries.slice(0, TURN) });

export function talkData({ snapshot, project, part, stage, item, now, open, proposals, reflections, claims, closedTotal, closedRows }) {
  // The view asks with no session, so no claim is mine; each comment and
  // reflection gives its claim's start and end while one lasts, else null.
  const comment = (row) => E.withClaimStart(E.commentListRow(row), claims, null, now);
  const entry = (row) => row.id.startsWith("np_") ? { kind: "proposal", comment: null, proposal: E.proposal(row) }
    : { kind: "comment", comment: comment(row), proposal: null };
  const named = (proposal) => item === null || (proposal !== null && proposal.items.includes(item));

  // A comment on an item that the stored snapshot's stage no longer holds is
  // apart (REQ-162), in neither turn; one on the stage as a whole never is.
  const held = new Set((Array.isArray(snapshot.items) ? snapshot.items : []).filter((row) => row.stage === stage).map((row) => row.id));
  const asked = [], waiting = [], agent = [], apart = [];
  for (const row of [...open].sort(by("last_at"))) {
    if (row.item && !held.has(row.item)) apart.push(row);
    else if (row.waits === "user") (row.asks === "checkpoint" ? asked : waiting).push(row);
    else agent.push(row);
  }

  // My turn in SPEC-143's order: the comments whose last entry asks for the
  // stage's checkpoint, the open proposals, then the other comments that wait
  // for the user, each oldest first; the agent's turn and apart oldest first,
  // since the time of a comment's last entry is when it began to wait.
  const offered = proposals.map((row) => E.proposal(row)).filter(named).sort(by("made_at"));
  const mine = [...asked.map(entry), ...offered.map((proposal) => ({ kind: "proposal", comment: null, proposal })), ...waiting.map(entry)];
  return { project, part, stage, item,
    mine: first(mine), agent: first(agent.map(comment)), apart: first(apart.map(comment)),
    closed: { total: closedTotal, entries: [...closedRows].sort(by("_at", true)).slice(0, CLOSED).map(entry) },
    reflections: reflections.map((row) => E.editListRow(row)).filter((edit) => named(edit.proposal))
      .map((edit) => E.withClaimStart(edit, claims, null, now)) };
}
