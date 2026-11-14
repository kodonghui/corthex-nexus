// TASK-202/203: compare real SQLite metadata, not a second copy of the schema.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";

import { SQLiteD1 } from "../src/sqlite.js";
import { MIGRATIONS, Store } from "../src/store.js";
import { fakeD1 } from "./fake-d1.js";
import { STAGE, plannedStatements, schema4, seeded } from "./revision-fixture.js";

const schema = readFileSync(new URL("../../docs/05-erd/nexus.sql", import.meta.url), "utf8");
const plain = (rows) => rows.map((row) => ({ ...row }));
const quoted = (name) => '"' + name.replaceAll('"', '""') + '"';

function checks(sql) {
  const found = [];
  const pattern = /\bCHECK\s*\(/gi;
  let match;
  while ((match = pattern.exec(sql))) {
    let depth = 1;
    let end = pattern.lastIndex;
    let quote = "";
    for (; end < sql.length && depth; end++) {
      const ch = sql[end];
      if (quote) {
        if (ch === quote && sql[end + 1] === quote) end++;
        else if (ch === quote) quote = "";
      } else if (ch === "'" || ch === '"') quote = ch;
      else if (ch === "(") depth++;
      else if (ch === ")") depth--;
    }
    assert.equal(depth, 0, "balanced CHECK expression");
    found.push(sql.slice(pattern.lastIndex, end - 1).replace(/\s+/g, " ").trim());
    pattern.lastIndex = end;
  }
  return found.sort();
}

function describe(db) {
  return plain(db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all())
    .map(({ name, sql }) => ({
      name,
      columns: plain(db.prepare(`PRAGMA table_info(${quoted(name)})`).all()),
      foreignKeys: plain(db.prepare(`PRAGMA foreign_key_list(${quoted(name)})`).all()),
      indexes: plain(db.prepare(`PRAGMA index_list(${quoted(name)})`).all())
        .map(({ name: index, unique, origin, partial }) => ({
          name: index, unique, origin, partial,
          columns: plain(db.prepare(`PRAGMA index_info(${quoted(index)})`).all()),
          where: (db.prepare("SELECT sql FROM sqlite_master WHERE name=?").get(index)?.sql || "")
            .match(/\bWHERE\s+(.+)$/i)?.[1] || "",
        })).sort((a, b) => a.name.localeCompare(b.name)),
      checks: checks(sql),
    }));
}

test("TASK-202/203: migration output has exactly the stage-05 tables, columns, keys, indexes and constraints", async () => {
  const expected = new DatabaseSync(":memory:");
  expected.exec(schema);
  const actual = new DatabaseSync(":memory:");
  await new Store(fakeD1(actual)).ensure();
  assert.deepEqual(describe(actual), describe(expected));
  assert.deepEqual(plain(actual.prepare("SELECT version FROM migrations ORDER BY version").all()), [{ version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }, { version: 5 }]);
  assert.equal(actual.prepare("SELECT COUNT(*) AS n FROM migrations WHERE applied_at IS NOT NULL").get().n, 5);
  actual.close(); expected.close();
});

test("TASK-202/203: a phase-1 snapshot survives migration byte for byte with its revision", async () => {
  const raw = new DatabaseSync(":memory:");
  raw.exec(MIGRATIONS[0].statements[0]);
  const body = '{"schema":"corthex-hub/0.1","title":"그림 \\u003cscript>"}\n';
  const values = ["synthetic", 7, 1762135200123, "2026-11-03T10:00:00+09:00", "2026-11-03T01:00:00Z", Buffer.byteLength(body), body];
  raw.prepare("INSERT INTO snapshots VALUES (?, ?, ?, ?, ?, ?, ?)").run(...values);
  const store = new Store(fakeD1(raw));
  await store.ensure();
  assert.deepEqual(Object.values({ ...raw.prepare("SELECT name, revision, generated_ms, generated_at, received_at, bytes, body FROM snapshots").get() }), values);
  assert.deepEqual({ ...raw.prepare("SELECT default_commit, push_id FROM snapshots").get() }, { default_commit: null, push_id: null });
  assert.equal(await store.body("synthetic"), body);
  const timestamps = plain(raw.prepare("SELECT * FROM migrations ORDER BY version").all());
  await new Store(fakeD1(raw)).ensure();
  assert.deepEqual(plain(raw.prepare("SELECT * FROM migrations ORDER BY version").all()), timestamps);
  raw.close();
});

test("TASK-203: a failed schema-2 transaction rolls back and a later attempt retries it", async () => {
  const raw = new DatabaseSync(":memory:");
  const binding = fakeD1(raw);
  const batch = binding.batch;
  let fail = true;
  binding.batch = (statements) => {
    if (fail && statements.some((s) => s.sql.startsWith("ALTER TABLE"))) {
      fail = false;
      // Fail inside the transaction, after both ALTERs have run.
      return batch([...statements.slice(0, 2), binding.prepare("INSERT INTO table_that_does_not_exist VALUES (1)")]);
    }
    return batch(statements);
  };
  const store = new Store(binding);
  await assert.rejects(store.ensure());
  assert.equal(raw.prepare("PRAGMA table_info(snapshots)").all().length, 7);
  assert.deepEqual(plain(raw.prepare("SELECT version FROM migrations").all()), [{ version: 1 }]);
  await store.ensure();
  assert.equal(raw.prepare("PRAGMA table_info(snapshots)").all().length, 9);
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM migrations").get().n, 5);
  raw.close();
});

test("TASK-202/203: two Worker isolates applying the same migrations converge without partial schema", async () => {
  const raw = new DatabaseSync(":memory:");
  let arrivals = 0;
  let release;
  const barrier = new Promise((resolve) => { release = resolve; });
  const bindings = [fakeD1(raw), fakeD1(raw)];
  for (const binding of bindings) {
    const batch = binding.batch;
    binding.batch = async (statements) => {
      if (statements.some((s) => s.sql === MIGRATIONS[0].statements[0])) {
        if (++arrivals === 2) release();
        await barrier;
      }
      return batch(statements);
    };
  }
  await Promise.all(bindings.map((binding) => new Store(binding).ensure()));
  assert.equal(arrivals, 2);
  assert.deepEqual(plain(raw.prepare("SELECT version FROM migrations ORDER BY version").all()), [{ version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }, { version: 5 }]);
  const expected = new DatabaseSync(":memory:"); expected.exec(schema);
  assert.deepEqual(describe(raw), describe(expected));
  raw.close(); expected.close();
});

// TASK-295 (TC-1783, TC-1784): migration 5, the design revision's, on TASK-280's database of schema 4, through D1's
// interface as the Worker build runs it (fake-d1.js over node:sqlite) and on the standalone server's SQLite file.
const TABLES = ["snapshots", "project_spaces", "pictures", "discrepancies", "comments", "replies", "decisions", "proposals", "edits", "checkpoints", "claims", "writes"];
const counts = (db) => Object.fromEntries(TABLES.map((table) => [table, db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n]));
const ADDED = { project_spaces: ["read_at", "read_session"], comments: ["look_first"], replies: ["look_first"],
  checkpoints: ["browser", "device", "driven", "snapshot_revision", "entry"] };
const oneLine = (sql) => sql.replace(/\s+/g, " ").trim();
const stamped = (db) => plain(db.prepare("SELECT version, applied_at FROM migrations ORDER BY version").all());

// A server's database of schema 4 records versions 1 to 4, as store.js wrote them when it made the schema.
function before(db = new DatabaseSync(":memory:")) {
  seeded(db);
  for (const version of [1, 2, 3, 4]) db.prepare("INSERT INTO migrations (version, applied_at) VALUES (?, ?)").run(version, `2026-11-0${version}T00:00:00.000Z`);
  return db;
}

function migrated(db, rows) {
  assert.deepEqual(counts(db), rows, "every row is kept");
  assert.deepEqual(plain(db.prepare("PRAGMA foreign_key_check").all()), []);
  assert.deepEqual(plain(db.prepare("SELECT id, asks FROM comments WHERE asks IS NOT NULL ORDER BY project, id").all()), [
    { id: "nc_neighbour", asks: "checkpoint" },
    { id: "nc_asks_answer", asks: "answer" },
    { id: "nc_request_new", asks: "checkpoint" },
    { id: "nc_request_old1", asks: "answer" },
    { id: "nc_request_old2", asks: "answer" },
  ], "the newest request of each stage stays its request, and the older ones ask for an answer");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM comments WHERE id LIKE 'nc_request%' AND state = 'open' AND waits = 'user'").get().n, 3);
  for (const [table, columns] of Object.entries(ADDED)) {
    const names = plain(db.prepare(`PRAGMA table_info(${table})`).all()).map((column) => column.name);
    assert.deepEqual(names.slice(-columns.length), columns, `${table} gains its columns after its last one`);
    for (const column of columns) assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} IS NOT NULL`).get().n, 0, `${table}.${column} is empty`);
  }
  assert.deepEqual(stamped(db).map((row) => row.version), [1, 2, 3, 4, 5]);
  const expected = new DatabaseSync(":memory:"); expected.exec(schema);
  assert.deepEqual(describe(db), describe(expected), "the migrated schema equals nexus.sql");
  expected.close();
}

test("TASK-295 (TC-1784): schema-4.sql is what migrations 1 to 4 make, and migration 5 is the ERD guide's block", () => {
  const made = new DatabaseSync(":memory:");
  made.exec("CREATE TABLE IF NOT EXISTS migrations (\n  version    INTEGER PRIMARY KEY,\n  applied_at TEXT    NOT NULL\n)");
  for (const migration of MIGRATIONS.filter((migration) => migration.version <= 4)) for (const sql of migration.statements) made.exec(sql);
  const frozen = new DatabaseSync(":memory:"); frozen.exec(schema4);
  assert.deepEqual(describe(made), describe(frozen));
  made.close(); frozen.close();
  assert.deepEqual(MIGRATIONS.map((migration) => migration.version), [1, 2, 3, 4, 5], "migration 5 takes the next free version");
  assert.deepEqual(MIGRATIONS[4].statements.map(oneLine), plannedStatements().map(oneLine), "the statements are the guide's, word for word");
});

test("TASK-295 (TC-1784): an empty database made through the migrations equals nexus.sql on both adapters", async (t) => {
  const folder = mkdtempSync(join(tmpdir(), "nexus-schema-5-"));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const expected = new DatabaseSync(":memory:"); expected.exec(schema);
  const memory = new DatabaseSync(":memory:");
  await new Store(fakeD1(memory)).ensure();
  const file = join(folder, "nexus.sqlite");
  const server = new SQLiteD1(file);
  await new Store(server).ensure();
  server.close();
  const opened = new DatabaseSync(file);
  for (const db of [memory, opened]) {
    assert.deepEqual(describe(db), describe(expected));
    for (const [table, columns] of Object.entries(ADDED)) {
      const names = plain(db.prepare(`PRAGMA table_info(${table})`).all()).map((column) => column.name);
      assert.deepEqual(names.slice(-columns.length), columns, `${table} ends with the revision's columns`);
    }
    assert.match(db.prepare("SELECT sql FROM sqlite_master WHERE name = 'comments_request'").get().sql,
      /^CREATE UNIQUE INDEX comments_request ON comments \(project, part, stage\) WHERE state = 'open' AND asks = 'checkpoint'$/);
  }
  memory.close(); opened.close(); expected.close();
});

test("TASK-295 (TC-1783): migration 5 through D1's interface keeps every row of TASK-280's database, and runs once", async () => {
  const db = before();
  const rows = counts(db);
  await new Store(fakeD1(db)).ensure();
  migrated(db, rows);
  const first = stamped(db);
  await new Store(fakeD1(db)).ensure();
  assert.deepEqual(stamped(db), first, "a second run changes nothing");
  assert.deepEqual(counts(db), rows);
  assert.throws(() => db.prepare("UPDATE comments SET asks = 'checkpoint' WHERE id = 'nc_request_old1'").run(), /UNIQUE constraint failed/,
    "the index holds one open request for each part's stage");
  db.close();
});

test("TASK-295 (TC-1783): migration 5 on the standalone server's SQLite file, opened again", async (t) => {
  const folder = mkdtempSync(join(tmpdir(), "nexus-migration-5-"));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const file = join(folder, "nexus.sqlite");
  const raw = before(new DatabaseSync(file));
  const rows = counts(raw);
  raw.close();
  const server = new SQLiteD1(file);
  await new Store(server).ensure();
  server.check();
  server.close();
  const opened = new DatabaseSync(file);
  migrated(opened, rows);
  const first = stamped(opened);
  opened.close();
  const again = new SQLiteD1(file);
  await new Store(again).ensure();
  again.close();
  const last = new DatabaseSync(file);
  assert.deepEqual(stamped(last), first, "a second run changes nothing");
  assert.deepEqual(counts(last), rows);
  last.close();
});

test("TASK-295 (TC-1783): a failure inside migration 5's batch leaves no column and no version, and a later start applies it", async () => {
  const db = before();
  const rows = counts(db);
  const binding = fakeD1(db);
  const batch = binding.batch;
  let fail = true;
  binding.batch = (statements) => {
    if (fail && statements.some((statement) => statement.sql.startsWith("ALTER TABLE project_spaces ADD COLUMN read_at"))) {
      fail = false;
      // Fail inside the transaction, after the nine columns, before the request's statement and the index.
      return batch([...statements.slice(0, 9), binding.prepare("INSERT INTO table_that_does_not_exist VALUES (1)")]);
    }
    return batch(statements);
  };
  await assert.rejects(new Store(binding).ensure());
  assert.deepEqual(stamped(db).map((row) => row.version), [1, 2, 3, 4]);
  for (const [table, columns] of Object.entries(ADDED)) {
    const names = plain(db.prepare(`PRAGMA table_info(${table})`).all()).map((column) => column.name);
    for (const column of columns) assert.equal(names.includes(column), false, `${table}.${column} is not added`);
  }
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM comments WHERE project = 'synthetic' AND asks = 'checkpoint' AND stage = ?").get(STAGE).n, 3, "no request changed");
  await new Store(binding).ensure();
  migrated(db, rows);
  db.close();
});
