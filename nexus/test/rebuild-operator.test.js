import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { createRebuildHandler } from "../src/rebuild-app.js";
import { randomToken } from "../src/rebuild-auth.js";
import { backupLegacy, backupRebuild, checkRelease, importLegacy, recoverAcknowledged } from "../src/rebuild-operator.js";
import { sha256 } from "../src/rebuild-http.js";
import { openRebuildDatabase } from "../src/rebuild-sqlite.js";
import { SQLiteD1 } from "../src/sqlite.js";
import { RebuildStore, Store } from "../src/store.js";
import { insertFixtureRow, seedRebuildFixture } from "./rebuild-fixture.js";

const time = "2026-11-18T04:00:00.000Z";
const commit = "a".repeat(40);
const old = "b".repeat(40);
const aliasCommit = "c".repeat(40);
const issuer = "https://issuer.example.test";

async function workspace(t) {
  const folder = await mkdtemp(join(tmpdir(), "nexus-rebuild-operator-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  return folder;
}

async function seededLegacy(path) {
  const native = new SQLiteD1(path);
  try {
    await new Store(native).ensure();
    for (const name of ["sample-one", "sample-two", "sample-three"]) {
      const commitId = name.endsWith("one") ? commit : old;
      const body = JSON.stringify({ project: { name, title: name, parts: ["main"] }, repos: {
        harness: { web: "https://github.com/example/harness", commit: aliasCommit },
        alternate: { web: "https://git.example.test/alternate", commit: aliasCommit },
      }, items: [
        { id: "REQ-301", stage: "02-prd", kind: "requirement", title: "Synthetic source", where: "harness:docs/prd.md:5" },
        { id: "REQ-302", stage: "02-prd", kind: "requirement", title: "Project source", where: "docs/local.md:7" },
        { id: "REQ-303", stage: "02-prd", kind: "requirement", title: "Archived source", where: "alternate:docs/prd.md:5" },
      ] });
      insertFixtureRow(native.connection, "snapshots", { name, revision: 3, generated_ms: Date.parse(time),
        generated_at: time, received_at: time, bytes: Buffer.byteLength(body), body, default_commit: commitId });
      insertFixtureRow(native.connection, "project_spaces", { project: name, repo_url: "https://github.com/example/" + name, created_at: time });
      insertFixtureRow(native.connection, "comments", { id: "nc_" + name, project: name, part: "main", stage: "02-prd", item: "REQ-301",
        commit_id: old, author: "user", text: "Preserve the exact old note for " + name, state: "closed", closed_as: "decided", made_at: time, last_at: time });
      insertFixtureRow(native.connection, "replies", { comment: "nc_" + name, seq: 1, author: "agent", text: "Old reply", made_at: time });
      insertFixtureRow(native.connection, "decisions", { comment: "nc_" + name, seq: 1, link: "https://github.com/example/" + name + "/pull/1",
        text: "Old decision", made_at: time });
      insertFixtureRow(native.connection, "checkpoints", { id: "nk_" + name, project: name, part: "main", stage: "02-prd",
        commit_id: old, words: "Reviewed at that commit", state: "withdrawn", passed_at: time, withdrawn_at: time });
      if (name === "sample-one") insertFixtureRow(native.connection, "checkpoints", { id: "nk_reapproval", project: name, part: "main", stage: "02-prd",
        commit_id: old, words: "Reviewed again", state: "passed", passed_at: "2026-11-18T04:05:00.000Z" });
      insertFixtureRow(native.connection, "writes", { project: name, id: "old-write-" + name, request: "{}", result: "{}", received_at: time });
    }
    native.check();
  } finally { native.close(); }
  await chmod(path, 0o600);
}

function addOwner(db, id) {
  insertFixtureRow(db, "owners", { id, issuer, subject: id, created_at: time });
}

test("API-237/238 back up and import three legacy fixture projects without changing the source", async (t) => {
  const folder = await workspace(t);
  const legacy = join(folder, "legacy.sqlite");
  await seededLegacy(legacy);
  const before = sha256(await readFile(legacy));
  const snapshot = join(folder, "safe-backup");
  const backup = await backupLegacy(legacy, snapshot);
  assert.equal(backup.projects, 3);
  assert.equal(backup.accepted_write_boundary, 3);
  const target = join(folder, "candidate.sqlite"), config = join(folder, "owners.json");
  const ownerDB = openRebuildDatabase(target);
  addOwner(ownerDB, "own_fixture");
  ownerDB.close();
  await chmod(target, 0o600);
  const projects = ["sample-one", "sample-two", "sample-three"];
  await writeFile(config, JSON.stringify(Object.fromEntries(projects.map((name) => [name, { owner_id: "own_fixture",
    repository_url: `https://github.com/example/${name}`, default_branch: "main" }]))), { mode: 0o600 });
  const args = [join(snapshot, "legacy.sqlite"), join(snapshot, "inventory.json"), config, target];
  const imported = await importLegacy(...args);
  assert.equal(imported.projects, 3);
  assert.equal(imported.archives.writes, 3);
  assert.equal(imported.inventory_digest, backup.inventory_digest);
  assert.equal((await importLegacy(...args)).replay, true);
  assert.equal(sha256(await readFile(legacy)), before);
  const reopened = openRebuildDatabase(target);
  try {
    const checks = reopened.prepare(`SELECT d.id,m.body,m.author_ref,a.publication_id FROM discussions d JOIN messages m ON m.discussion_id=d.id
      JOIN stage_artifacts a ON a.id=d.origin_artifact_id WHERE m.sequence=1 ORDER BY d.id`).all();
    assert.deepEqual(checks.map((row) => row.id), ["nc_sample-one", "nc_sample-three", "nc_sample-two"]);
    assert.equal(checks[0].body, "Preserve the exact old note for sample-one");
    assert.equal(checks[0].author_ref, "user");
    for (const row of checks) assert.equal(reopened.prepare("SELECT commit_sha FROM publications WHERE id=?").get(row.publication_id).commit_sha, old);
    const history = reopened.prepare(`SELECT id,decision,prior_decision_id FROM checkpoint_decisions
      WHERE request_id='nk_sample-one' ORDER BY sequence`).all();
    assert.deepEqual(history.map((row) => row.decision), ["pass", "withdraw", "pass"]);
    assert.equal(history[0].id, "nk_sample-one");
    assert.equal(history[1].prior_decision_id, history[0].id);
    assert.equal(history[2].id, "nk_reapproval");
    assert.equal(reopened.prepare("SELECT state FROM checkpoint_requests WHERE id='nk_sample-one'").get().state, "passed");
    assert.equal(reopened.prepare("SELECT target_id FROM legacy_mappings WHERE legacy_id='nk_reapproval'").get().target_id, history[2].id);
    assert.equal(reopened.prepare("SELECT count(*) AS n FROM discussion_decisions").get().n, 3);

    const store = new RebuildStore(reopened);
    const project = store.listProjects("own_fixture", "", 3).find(({ slug }) => slug === "sample-one");
    const artifact = store.artifact(project.id, "main", "02-prd", { version: null, publication: null });
    const locations = store.artifactItems(project.id, artifact.id, "", 3, null).map(({ source }) =>
      [source.repository_url, source.path, source.line, source.commit]);
    assert.deepEqual(locations, [
      ["https://github.com/example/harness", "docs/prd.md", 5, aliasCommit],
      ["https://github.com/example/sample-one", "docs/local.md", 7, commit],
      ["https://github.com/example/sample-one", "legacy-source", null, commit],
    ]);

    const origin = "https://rebuild.example.test";
    const token = randomToken();
    insertFixtureRow(reopened, "project_credentials", { id: "cred_fixture", owner_id: "own_fixture", project_id: project.id,
      role: "publisher", label: "Fixture", secret_hash: sha256(token), created_at: time });
    const verified = [];
    const handle = createRebuildHandler({ origin, store, clock: () => Date.parse(time), github: {
      async verify(repo, publication, held) { verified.push([repo.id, publication.commit, held]); },
    } });
    const source = "| ID | Title |\n| --- | --- |\n| REQ-301 | Verified source |\n";
    const input = { format: "nexus.publish/1", commit, base_commit: commit, consent_id: null, artifacts: [
      { part: "main", stage: "02-prd", source_files: [{ path: "docs/prd.md", media_type: "text/markdown", content_utf8: source, sha256: sha256(source) }] },
    ] };
    const publish = (body, key) => handle(new Request(`${origin}/api/v2/projects/${project.id}/publications`, { method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(body) }));
    const upgraded = await publish(input, "fixture-format-upgrade");
    assert.equal(upgraded.status, 201, await upgraded.clone().text());
    const published = await upgraded.json();
    assert.equal(published.held_commit, commit);
    assert.equal(published.revision, artifact.publication_revision + 1);
    assert.deepEqual(verified, [[project.id, commit, commit]]);
    const held = reopened.prepare("SELECT parent_publication_id,format_version FROM publications WHERE id=?").get(published.id);
    assert.equal(held.parent_publication_id, artifact.publication_id);
    assert.equal(held.format_version, 2);
    const retry = await publish(input, "fixture-format-upgrade");
    assert.deepEqual(await retry.json(), published);
    const replaced = await publish({ ...input, artifacts: [{ ...input.artifacts[0], part: "other" }] }, "fixture-other-envelope");
    assert.equal(replaced.status, 409);
    assert.equal((await replaced.json()).code, "older_publication");
  } finally { reopened.close(); }
});

function connect(store, owner, id, label) {
  const input = { slug: label, title: label, repository_url: "https://github.com/example/" + label, default_branch: "main" };
  return store.connectProject({ owner, id, input, keyHash: sha256(label), bodyDigest: sha256(JSON.stringify(input)),
    receipt: "receipt_" + label, now: time, expires: "2026-11-19T04:00:00.000Z", digest: sha256 });
}

test("API-240 restores every acknowledged write after a baseline and rolls back a conflicting tail", async (t) => {
  const folder = await workspace(t);
  const file = join(folder, "source.sqlite");
  const connection = openRebuildDatabase(file);
  await chmod(file, 0o600);
  const store = new RebuildStore(connection);
  addOwner(connection, "own_first");
  const session = sha256("fixture-before-logout");
  store.issueSession({ issuer, subject: "own_first", ownerId: "own_first", idHash: session, csrfHash: sha256("fixture-csrf"),
    now: time, idleExpires: "2026-11-19T04:00:00.000Z", absoluteExpires: "2026-11-19T04:00:00.000Z" });
  const state = sha256("fixture-pending-login");
  store.saveAuthAttempt({ stateHash: state, nonceHash: sha256("fixture-nonce"), verifier: "fixture-verifier",
    returnPath: "/", now: time, expires: "2026-11-19T04:00:00.000Z" });
  assert.equal(connect(store, "own_first", "prj_baseline", "baseline").status, 201);
  const base = join(folder, "first"), frozen = join(folder, "frozen");
  const baseline = await backupRebuild(file, base);
  assert.equal(baseline.boundary, 1);
  assert.ok(store.session(session, time));
  assert.equal(store.revokeSession(session, time), true);
  addOwner(connection, "own_after_switch");
  assert.equal(connect(store, "own_after_switch", "prj_after_switch", "after-switch").status, 201);
  assert.equal(connect(store, "own_first", "prj_next_write", "next-write").status, 201);
  await backupRebuild(file, frozen);
  connection.close();
  const args = { baseline: join(base, "rebuild.sqlite"), inventory: join(base, "baseline.json"), frozen: join(frozen, "rebuild.sqlite") };
  const output = join(folder, "recovered");
  const recovered = await recoverAcknowledged({ ...args, output });
  assert.deepEqual([recovered.after, recovered.through, recovered.applied], [1, 3, 2]);
  const verified = new DatabaseSync(join(output, "recovered.sqlite"), { readOnly: true });
  try {
    const restored = new RebuildStore(verified);
    assert.equal(restored.journalBoundary(), 3);
    assert.equal(restored.session(session, time), null);
    assert.ok(verified.prepare("SELECT used_at FROM auth_attempts WHERE state_hash=?").get(state).used_at);
    assert.equal(verified.prepare("SELECT count(*) n FROM projects").get().n, 3);
    assert.equal(verified.prepare("SELECT subject FROM owners WHERE id='own_after_switch'").get().subject, "own_after_switch");
  } finally { verified.close(); }
  const broken = openRebuildDatabase(args.frozen);
  broken.prepare("UPDATE write_journal SET result_digest=? WHERE sequence=3").run("f".repeat(64));
  broken.close();
  const rejected = join(folder, "rejected");
  await assert.rejects(recoverAcknowledged({ ...args, output: rejected }), /Acknowledged write result differs/);
  const reverted = new DatabaseSync(join(rejected, "recovered.sqlite"), { readOnly: true });
  try {
    assert.equal(new RebuildStore(reverted).journalBoundary(), 1);
    assert.equal(reverted.prepare("SELECT count(*) n FROM projects").get().n, 1);
  } finally { reverted.close(); }
});

test("recovery rejects a frozen database with a different acknowledged prefix at the same write boundary", async (t) => {
  const folder = await workspace(t);
  for (const name of ["baseline", "unrelated"]) {
    const file = join(folder, `${name}.sqlite`);
    const db = openRebuildDatabase(file);
    try {
      await chmod(file, 0o600);
      addOwner(db, "own_fixture");
      const store = new RebuildStore(db);
      assert.equal(connect(store, "own_fixture", `prj_${name}`, name).status, 201);
      if (name === "unrelated") assert.equal(connect(store, "own_fixture", "prj_additional", "additional").status, 201);
      await backupRebuild(file, join(folder, name));
    } finally { db.close(); }
  }
  const output = join(folder, "rejected");
  await assert.rejects(recoverAcknowledged({ baseline: join(folder, "baseline", "rebuild.sqlite"),
    inventory: join(folder, "baseline", "baseline.json"), frozen: join(folder, "unrelated", "rebuild.sqlite"), output }), /journal prefixes differ/);
  await assert.rejects(readFile(join(output, "recovery.json")), { code: "ENOENT" });
});

test("the compatible recovery retains acknowledged question and checkpoint transaction links", async (t) => {
  const folder = await workspace(t);
  const file = join(folder, "source.sqlite");
  const db = openRebuildDatabase(file);
  await chmod(file, 0o600);
  const seed = seedRebuildFixture(db);
  const store = new RebuildStore(db);
  const before = join(folder, "base");
  const frozen = join(folder, "frozen");
  await backupRebuild(file, before);
  const context = (op, input) => ({ owner: seed.owner, scope: seed.projectId, operation: op,
    keyHash: sha256("key:" + op), bodyDigest: sha256(JSON.stringify(input)), receipt: "ir_" + op,
    now: time, expires: "2026-11-19T04:00:00.000Z", digest: sha256 });
  const question = { publication_id: seed.current.publication_id, content_version: seed.current.content_version,
    ask_ai: true, item_id: "REQ-301", body: "Preserve a newly acknowledged question" };
  const asked = store.askAboutArtifact(context("askAboutArtifact", question), seed.projectId, seed.current.part, seed.current.stage,
    question, { discussion: "dis_recovery", message: "msg_recovery", work: "work_recovery" });
  assert.equal(asked.status, 201);
  const path = seed.pending.id;
  const decision = { content_version: seed.current.content_version, expected_revision: seed.pending.row_revision,
    decision: "pass", reason: "A fixture owner reviewed the approved version" };
  const decided = store.decideRebuildCheckpoint(context("decideCheckpoint", decision), seed.projectId, path, decision,
    "cpd_recovery", () => [], false);
  assert.equal(decided.status, 201);
  await backupRebuild(file, frozen);
  db.close();
  const output = join(folder, "recovered");
  await recoverAcknowledged({ baseline: join(before, "rebuild.sqlite"), inventory: join(before, "baseline.json"),
    frozen: join(frozen, "rebuild.sqlite"), output });
  const restored = openRebuildDatabase(join(output, "recovered.sqlite"));
  try {
    const candidate = new RebuildStore(restored);
    const work = candidate.workRecord(seed.projectId, "work_recovery");
    assert.equal(work.question_id, "msg_recovery");
    assert.equal(work.body, question.body);
    assert.equal(work.content_version, question.content_version);
    assert.equal(candidate.checkpointRecord(seed.projectId, path).state, "passed");
    assert.equal(candidate.checkpointHistory(seed.projectId, path).at(-1).id, "cpd_recovery");
    assert.equal(candidate.journalBoundary(), 2);
  } finally { restored.close(); }
});

test("API-239 keeps the existing runtime when exact release evidence is missing", async (t) => {
  const folder = await workspace(t);
  const evidence = join(folder, "evidence.json");
  const report = { format: "nexus.release-evidence/1", release_commit: commit, reports: {} };
  await writeFile(evidence, JSON.stringify(report), { mode: 0o600 });
  const state = await checkRelease(evidence, commit);
  assert.equal(state.decision, "keep");
  assert.equal(state.blocked.length, 10);
  await assert.rejects(checkRelease(evidence, old), /another candidate/);
});
