// TASK-280 (TC-1781, TC-1782): the statements that stage 05 plans for the design revision of 2026-11-11, run on
// node:sqlite as the ERD guide gives them, on a database built from nexus.sql. tests/test_revision_statements.py runs
// the same on Python's sqlite3.
import assert from "node:assert/strict";
import { test } from "node:test";

import { COMMENT, COMMIT, STAGE, plannedStatements, seeded } from "./revision-fixture.js";

const TABLES = ["snapshots", "project_spaces", "pictures", "discrepancies", "comments", "replies", "decisions", "proposals", "edits", "checkpoints", "claims", "writes"];
const counts = (db) => Object.fromEntries(TABLES.map((table) => [table, db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n]));
const plain = (rows) => rows.map((row) => ({ ...row }));

test("TC-1781: the revision's planned statements keep every row, and the index alone is refused", () => {
  const statements = plannedStatements();
  assert.equal(statements.length, 11, "nine columns, the statement before the index and the index");
  assert.match(statements.at(-1), /^CREATE UNIQUE INDEX comments_request ON comments \(project, part, stage\) WHERE state = 'open' AND asks = 'checkpoint'$/);
  assert.match(statements.at(-2), /^UPDATE comments SET asks = 'answer'/);

  const alone = seeded();
  for (const statement of statements.filter((statement) => !statement.startsWith("UPDATE"))) {
    if (statement.startsWith("CREATE UNIQUE INDEX")) assert.throws(() => alone.exec(statement), /UNIQUE constraint failed/);
    else alone.exec(statement);
  }
  alone.close();

  const db = seeded();
  const before = counts(db);
  for (const statement of statements) db.exec(statement);
  assert.deepEqual(counts(db), before, "every row is kept");
  assert.deepEqual(plain(db.prepare("PRAGMA foreign_key_check").all()), []);
  assert.deepEqual(plain(db.prepare("SELECT id, state, waits, asks FROM comments WHERE project = 'synthetic' AND stage = ? AND id LIKE 'nc_request%' ORDER BY id").all(STAGE)), [
    { id: "nc_request_new", state: "open", waits: "user", asks: "checkpoint" },
    { id: "nc_request_old1", state: "open", waits: "user", asks: "answer" },
    { id: "nc_request_old2", state: "open", waits: "user", asks: "answer" },
  ]);
  assert.equal(db.prepare("SELECT asks FROM comments WHERE id = 'nc_neighbour'").get().asks, "checkpoint", "another project's request stays");
  const added = { project_spaces: ["read_at", "read_session"], comments: ["look_first"], replies: ["look_first"],
    checkpoints: ["browser", "device", "driven", "snapshot_revision", "entry"] };
  for (const [table, columns] of Object.entries(added)) {
    const names = plain(db.prepare(`PRAGMA table_info(${table})`).all()).map((column) => column.name);
    assert.deepEqual(names.slice(-columns.length).sort(), [...columns].sort(), `${table} gains its columns after its last one`);
    for (const column of columns) assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} IS NOT NULL`).get().n, 0);
  }
  db.close();
});

test("TC-1782: the database itself refuses what the revision forbids", () => {
  const db = seeded();
  for (const statement of plannedStatements()) db.exec(statement);
  assert.throws(() => db.prepare(COMMENT).run("nc_request_second", "synthetic", STAGE, COMMIT, "Again", "open", null, "user", "checkpoint", "2026-11-11T02:00:00Z", "2026-11-11T02:00:00Z"),
    /UNIQUE constraint failed/, "a second open request on a part's stage");
  db.prepare(COMMENT).run("nc_request_other_stage", "synthetic", "03-user-flow", COMMIT, "Another stage", "open", null, "user", "checkpoint", "2026-11-11T02:00:00Z", "2026-11-11T02:00:00Z");
  const checkpoint = (column, value) => db.prepare(`INSERT INTO checkpoints (id, project, part, stage, commit_id, state, passed_at, ${column}) VALUES (?, 'synthetic', 'nexus', '02-prd', ?, 'passed', '2026-11-11T02:00:00Z', ?)`)
    .run(`ck_${column}_${String(value)}`, COMMIT, value);
  for (const [column, value] of [["browser", "Mozilla/5.0"], ["browser", "CHROME"], ["device", "laptop"], ["driven", 2], ["entry", -1]]) {
    assert.throws(() => checkpoint(column, value), /CHECK constraint failed/, `${column} ${value} is refused`);
  }
  for (const [column, value] of [["browser", "chrome"], ["browser", "unknown"], ["device", "phone"], ["driven", 0], ["entry", 0]]) checkpoint(column, value);
  const read = db.prepare("UPDATE project_spaces SET read_at = ?, read_session = ? WHERE project = ?");
  assert.equal(read.run("2026-11-11T03:00:00.000Z", "session-a", "bare").changes, 0, "a project without a space records no read");
  assert.equal(read.run("2026-11-11T03:00:00.000Z", "session-a", "synthetic").changes, 1);

  const removed = plain(db.prepare("SELECT id FROM comments WHERE project = 'synthetic'").all()).map((row) => row.id);
  const neighbour = { comments: db.prepare("SELECT COUNT(*) AS n FROM comments WHERE project = 'neighbour'").get().n };
  assert.equal(db.prepare("DELETE FROM snapshots WHERE name = ?").run("synthetic").changes, 1);
  for (const table of TABLES.filter((table) => !["snapshots", "replies", "decisions"].includes(table))) {
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE project = 'synthetic'`).get().n, 0, `${table} keeps no row of the project`);
  }
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM snapshots WHERE name = 'synthetic'").get().n, 0);
  for (const table of ["replies", "decisions"]) {
    const left = plain(db.prepare(`SELECT comment FROM ${table}`).all()).filter((row) => removed.includes(row.comment));
    assert.deepEqual(left, [], `${table} keeps no row of the project`);
  }
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM comments WHERE project = 'neighbour'").get().n, neighbour.comments);
  assert.deepEqual(plain(db.prepare("PRAGMA foreign_key_check").all()), []);
  db.close();
});
