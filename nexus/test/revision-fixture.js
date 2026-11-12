// TASK-280: the database of the revision's cases (TC-1781 to TC-1784), and the statements that stage 05 plans for the
// design revision of 2026-11-11, read from the ERD guide. TASK-295 runs the same database through the server's migration.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

export const schema = readFileSync(new URL("../../docs/05-erd/nexus.sql", import.meta.url), "utf8");
const guide = readFileSync(new URL("../../docs/05-erd/nexus.md", import.meta.url), "utf8");

// The SQL block of "The revision's migrations", split into its statements.
export function plannedStatements(text = guide) {
  const section = text.split("\n### The revision's migrations\n")[1]?.split("\n### ")[0];
  assert.ok(section, "the ERD guide has the section of the revision's migrations");
  const block = section.match(/```sql\n([\s\S]*?)```/)?.[1];
  assert.ok(block, "the section holds one SQL block");
  return block.split(/;\s*(?:\n|$)/).map((statement) => statement.replace(/^\s+|\s+$/g, "").replace(/\n\s*/g, " ")).filter(Boolean);
}

export const STAGE = "04-functional-spec";
export const COMMIT = "3f1c9a7e5b2d4c6a8e0f1b3d5c7a9e1f2b4d6c8a";
export const SNAPSHOT = "INSERT INTO snapshots (name, revision, generated_ms, generated_at, received_at, bytes, body, default_commit) VALUES (?, 1, 1762135200000, '2026-11-11T10:00:00+09:00', '2026-11-11T01:00:00Z', 2, '{}', ?)";
export const COMMENT = "INSERT INTO comments (id, project, part, stage, item, commit_id, author, text, state, closed_as, waits, asks, made_at, last_at) VALUES (?, ?, 'nexus', ?, '', ?, 'agent', ?, ?, ?, ?, ?, ?, ?)";

// A snapshot, a space, six comments of which three open ones ask for a checkpoint on one stage, a reply and a checkpoint;
// with a picture, a discrepancy, a proposal, an edit, a decision, a claim and a write, so that a removal has every table to
// clear; and a second project that a removal must leave alone, and a snapshot without a space.
export function seeded() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(schema);
  for (const name of ["synthetic", "neighbour", "bare"]) db.prepare(SNAPSHOT).run(name, COMMIT);
  for (const name of ["synthetic", "neighbour"]) db.prepare("INSERT INTO project_spaces (project, created_at) VALUES (?, '2026-11-11T01:00:00Z')").run(name);
  const comment = (id, project, stage, state, closedAs, waits, asks, at) =>
    db.prepare(COMMENT).run(id, project, stage, COMMIT, `Comment ${id}`, state, closedAs, waits, asks, at, at);
  comment("nc_request_old1", "synthetic", STAGE, "open", null, "user", "checkpoint", "2026-11-11T01:01:00Z");
  comment("nc_request_old2", "synthetic", STAGE, "open", null, "user", "checkpoint", "2026-11-11T01:02:00Z");
  comment("nc_request_new", "synthetic", STAGE, "open", null, "user", "checkpoint", "2026-11-11T01:03:00Z");
  comment("nc_asks_answer", "synthetic", STAGE, "open", null, "user", "answer", "2026-11-11T01:04:00Z");
  comment("nc_waits_agent", "synthetic", "05-erd", "open", null, "agent", null, "2026-11-11T01:05:00Z");
  comment("nc_closed", "synthetic", STAGE, "closed", "answered", null, null, "2026-11-11T01:06:00Z");
  comment("nc_neighbour", "neighbour", STAGE, "open", null, "user", "checkpoint", "2026-11-11T01:07:00Z");
  db.prepare("INSERT INTO replies (comment, seq, author, text, made_at) VALUES ('nc_closed', 1, 'user', 'Answered.', '2026-11-11T01:06:30Z')").run();
  db.prepare("INSERT INTO decisions (comment, seq, link, text, made_at) VALUES ('nc_closed', 1, 'https://example.com/decision', 'Kept.', '2026-11-11T01:06:40Z')").run();
  db.prepare("INSERT INTO checkpoints (id, project, part, stage, commit_id, words, state, passed_at) VALUES ('ck_passed', 'synthetic', 'nexus', '03-user-flow', ?, 'The flows as drafted.', 'passed', '2026-11-11T01:08:00Z')").run(COMMIT);
  db.prepare("INSERT INTO pictures (project, part, stage, commit_id, committed_at, source, digest, drawn_at) VALUES ('synthetic', 'nexus', '05-erd', ?, '2026-11-11T00:00:00Z', 'CREATE TABLE a (b TEXT);', 'digest', '2026-11-11T01:00:00Z')").run(COMMIT);
  db.prepare("INSERT INTO discrepancies (id, project, part, compares, term, item, reasons, level, state, opened_commit, opened_at) VALUES ('nd_one', 'synthetic', 'nexus', 'aggregate-table', 'TERM-101', 'TBL-101', '[]', 'warn', 'open', ?, '2026-11-11T01:00:00Z')").run(COMMIT);
  db.prepare("INSERT INTO proposals (id, project, part, stage, commit_id, items, reason, change, state, made_at, closed_at) VALUES ('np_one', 'synthetic', 'nexus', '05-erd', ?, '[\"TBL-101\"]', 'A reason', 'A change', 'accepted', '2026-11-11T01:00:00Z', '2026-11-11T01:09:00Z')").run(COMMIT);
  db.prepare("INSERT INTO edits (id, project, part, stage, commit_id, proposal, state, made_at, changed_at) VALUES ('ne_one', 'synthetic', 'nexus', '05-erd', ?, 'np_one', 'pending', '2026-11-11T01:09:00Z', '2026-11-11T01:09:00Z')").run(COMMIT);
  db.prepare("INSERT INTO claims (entry, project, session, claimed_at, ends_at) VALUES ('nc_waits_agent', 'synthetic', 'session-a', '2026-11-11T01:10:00Z', '2026-11-11T02:10:00Z')").run();
  db.prepare("INSERT INTO writes (project, id, request, result, received_at) VALUES ('synthetic', 'w_one', 'POST /comments', '{}', '2026-11-11T01:10:00Z')").run();
  return db;
}
