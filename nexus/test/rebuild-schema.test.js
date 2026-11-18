import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { applyRebuildSchema, RebuildStore, SQLITE } from "../src/store.js";
import { openRebuildDatabase } from "../src/rebuild-sqlite.js";
import { insertFixtureRow, seedRebuildFixture } from "./rebuild-fixture.js";

const schema = readFileSync(new URL("../../db/rebuild/migrations/001-initial.sql", import.meta.url), "utf8");
const attempts = readFileSync(new URL("../../db/rebuild/migrations/002-publication-attempts.sql", import.meta.url), "utf8");
const tables = (db) => db.prepare(SQLITE.tables).all().map(({ name }) => name);

test("TASK-321/322 preserves a source-backed two-owner fixture across a real SQLite restart", (t) => {
  const folder = mkdtempSync(join(tmpdir(), "nexus-rebuild-schema-"));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const path = join(folder, "rebuild.sqlite");
  let fixture;
  {
    using initial = openRebuildDatabase(path);
    fixture = seedRebuildFixture(initial);
    assert.equal(tables(initial).length, 22);
    assert.equal(initial.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);
    assert.deepEqual(initial.prepare(SQLITE.foreignKeys).all(), []);
  }
  using db = openRebuildDatabase(path);
  const projects = db.prepare("SELECT id, owner_id FROM projects ORDER BY id").all();
  assert.deepEqual(projects.map(({ id, owner_id }) => [id, owner_id]), [[fixture.projectId, fixture.owner], [fixture.otherProject, fixture.otherOwner]]);
  const items = db.prepare("SELECT trace_id, removed FROM artifact_items WHERE artifact_id=? ORDER BY trace_id").all(fixture.current.id);
  assert.deepEqual(items.map(({ trace_id, removed }) => [trace_id, removed]), [["REQ-301", 0], ["REQ-302", 1], ["REQ-303", 0]]);
  assert.notEqual(fixture.original.content_version, fixture.current.content_version);
  const checkpoint = db.prepare("SELECT state, content_version FROM checkpoint_requests WHERE id=?").get(fixture.pending.id);
  assert.equal(checkpoint.state, "pending");
  assert.equal(checkpoint.content_version, fixture.current.content_version);
  const historical = db.prepare("SELECT content_version FROM checkpoint_decisions").get();
  assert.equal(historical.content_version, fixture.original.content_version);
  const discussion = db.prepare("SELECT source_publication_id, source_commit, content_version FROM discussion_decisions").get();
  assert.equal(discussion.source_publication_id, "pub_demo");
  assert.equal(discussion.source_commit, "c".repeat(40));
  assert.equal(discussion.content_version, fixture.original.content_version);
});

test("TASK-322 rolls back all schema objects and version markers after a late DDL error", () => {
  using db = new DatabaseSync(":memory:");
  assert.throws(() => applyRebuildSchema(db, `${schema}\nCREATE INDEX bad ON missing_table(nope);`), /no such table/);
  assert.deepEqual(tables(db), []);
  assert.equal(db.prepare("PRAGMA user_version").get().user_version, 0);
  assert.equal(db.prepare("PRAGMA application_id").get().application_id, 0);
  applyRebuildSchema(db, schema);
  assert.equal(tables(db).length, 20);
});

test("publication attempt migration is additive across restarts and version-1 schema checks", (t) => {
  const folder = mkdtempSync(join(tmpdir(), "nexus-rebuild-attempts-"));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const path = join(folder, "rebuild.sqlite");
  let fixture;
  {
    using previous = new DatabaseSync(path);
    applyRebuildSchema(previous, schema);
    fixture = seedRebuildFixture(previous);
    assert.equal(tables(previous).includes("publication_attempts"), false);
  }
  const { projectId, owner, time } = fixture;
  const accepted = fixture.rows.publications[1];
  {
    using old = new DatabaseSync(path);
    assert.throws(() => applyRebuildSchema(old, schema,
      "CREATE TABLE diagnostic_temp (id TEXT); CREATE INDEX bad ON missing_table(nope);"), /no such table/);
    assert.equal(tables(old).includes("diagnostic_temp"), false);
  }
  {
    using upgraded = openRebuildDatabase(path);
    const store = new RebuildStore(upgraded);
    assert.equal(store.projectState(owner, projectId).held_publication_id, accepted.id);
    assert.deepEqual(store.publicationAttempts(projectId, 10, 10), []);
    assert.throws(() => store.recordPublicationAttempt(projectId, "b".repeat(40), time, { outcome: "received", receipt_id: accepted.id }),
      /FOREIGN KEY/);
    store.recordPublicationAttempt(projectId, accepted.commit_sha, time, { outcome: "received", receipt_id: accepted.id });
  }
  {
    using previous = new DatabaseSync(path);
    applyRebuildSchema(previous, schema);
    assert.equal(previous.prepare("PRAGMA user_version").get().user_version, 1);
    assert.equal(previous.prepare("SELECT held_publication_id FROM projects WHERE id=?").get(projectId).held_publication_id, accepted.id);
  }
  using upgraded = openRebuildDatabase(path);
  assert.equal(new RebuildStore(upgraded).publicationAttempts(projectId, 10, 10)[0].receipt_id, accepted.id);
  assert.deepEqual(upgraded.prepare(SQLITE.foreignKeys).all(), []);
});

test("credential usage migration starts with no recorded use and preserves the latest time across restarts", (t) => {
  const folder = mkdtempSync(join(tmpdir(), "nexus-rebuild-credential-usage-"));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const path = join(folder, "rebuild.sqlite");
  const id = "cred_existing";
  let fixture;
  {
    using previous = new DatabaseSync(path);
    applyRebuildSchema(previous, schema, attempts);
    fixture = seedRebuildFixture(previous);
    insertFixtureRow(previous, "project_credentials", { id, owner_id: fixture.owner, project_id: fixture.projectId,
      role: "publisher", label: "Fixture", secret_hash: "synthetic-example-digest", created_at: fixture.time });
    assert.equal(tables(previous).includes("project_credential_usage"), false);
  }
  const latest = "2026-11-18T03:00:00.000Z";
  {
    using upgraded = openRebuildDatabase(path);
    const store = new RebuildStore(upgraded);
    assert.equal(store.listCredentials(fixture.projectId)[0].last_used_at, null);
    assert.throws(() => store.recordCredentialUse("cred_missing", fixture.time), /FOREIGN KEY/);
    store.recordCredentialUse(id, latest);
    store.recordCredentialUse(id, fixture.time);
  }
  {
    using previous = new DatabaseSync(path);
    applyRebuildSchema(previous, schema, attempts);
    assert.equal(previous.prepare("PRAGMA user_version").get().user_version, 1);
  }
  using upgraded = openRebuildDatabase(path);
  assert.equal(new RebuildStore(upgraded).listCredentials(fixture.projectId)[0].last_used_at, latest);
  assert.deepEqual(upgraded.prepare(SQLITE.foreignKeys).all(), []);
});

test("TASK-322 refuses populated unmarked and unsupported databases", () => {
  using db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE legacy (id TEXT); INSERT INTO legacy VALUES ('retained');");
  assert.throws(() => applyRebuildSchema(db, schema), /empty database/);
  assert.deepEqual(tables(db), ["legacy"]);
  assert.equal(db.prepare("SELECT id FROM legacy").get().id, "retained");

  using fresh = openRebuildDatabase(":memory:");
  fresh.exec("PRAGMA user_version=999");
  assert.throws(() => applyRebuildSchema(fresh, schema), /Unsupported rebuild database version/);
  assert.equal(fresh.prepare("PRAGMA user_version").get().user_version, 999);
});

test("TASK-322 refuses cross-project and cross-owner references in the rebuild tables", () => {
  using db = openRebuildDatabase(":memory:");
  const f = seedRebuildFixture(db);
  assert.throws(() => insertFixtureRow(db, "project_credentials", { id: "key_demo", owner_id: f.otherOwner,
    project_id: f.projectId, role: "publisher", label: "Fixture", secret_hash: "synthetic-fixture-digest", created_at: f.time }), /FOREIGN KEY/);
  assert.throws(() => insertFixtureRow(db, "stage_artifacts", {
    ...f.current, id: "art_other", part: "foreign-fixture", project_id: f.otherProject,
  }), /FOREIGN KEY/);
  assert.throws(() => insertFixtureRow(db, "checkpoint_decisions", { ...f.rows.checkpoint_decisions[0],
    id: "cpd_other", actor_owner_id: f.otherOwner, sequence: 2 }), /FOREIGN KEY/);
  assert.throws(() => insertFixtureRow(db, "discussion_decisions", { ...f.rows.discussion_decisions[0], id: "dec_wrong_commit",
    source_commit: "b".repeat(40), sequence: 2 }), /FOREIGN KEY/);
  assert.throws(() => insertFixtureRow(db, "messages", { ...f.rows.messages[1], id: "msg_duplicate", body: "Duplicate sequence" }), /UNIQUE/);
  assert.throws(() => insertFixtureRow(db, "artifact_items", { ...f.rows.artifact_items[0], trace_id: "REQ-304", removed: 2 }), /CHECK/);
  assert.deepEqual(db.prepare(SQLITE.foreignKeys).all(), []);
});
