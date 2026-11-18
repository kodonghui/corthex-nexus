import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createNodeServer } from "../src/node-server.js";
import { createRebuildHandler } from "../src/rebuild-app.js";
import { csrfToken, iso, OWNER_COOKIE, randomToken, resourceId } from "../src/rebuild-auth.js";
import { canonicalJSON, sha256 } from "../src/rebuild-http.js";
import { rebuildView } from "../src/rebuild-views.js";
import { RebuildGitHub } from "../src/rebuild-github.js";
import { openRebuildDatabase } from "../src/rebuild-sqlite.js";
import { parserVersion, prepareArtifacts, previewDigest } from "../src/rebuild-source.js";
import { RebuildStore } from "../src/store.js";
import { insertFixtureRow, seedRebuildFixture } from "./rebuild-fixture.js";

const origin = "https://rebuild.example.test";
const now = Date.parse("2026-11-18T04:00:00Z");
const sha = (digit) => digit.repeat(40);
const inputFile = (path, source, media = "text/markdown") => ({ path, media_type: media, content_utf8: source, sha256: sha256(source) });
const source = (id, title) => `# Requirements\n\n| Requirement | Title |\n| --- | --- |\n| REQ-301 | Private projects |\n| ${id} | ${title} |\n`;
const html = "<!doctype html><html><head><title>Fixture</title></head><body><h1>Public sample layout</h1></body></html>";
function snapshot(n = "1", base = null, item = "REQ-302") {
  return { format: "nexus.publish/1", commit: sha(n), base_commit: base, consent_id: null,
    artifacts: [
      { part: "main", stage: "02-prd", source_files: [inputFile("docs/prd.md", source(item, "Additional requirement"))] },
      { part: "main", stage: "09-mockup", source_files: [inputFile("design/index.html", html, "text/html")] },
    ] };
}

async function fixture(t, github = null) {
  const db = openRebuildDatabase(":memory:");
  const seed = seedRebuildFixture(db);
  const store = new RebuildStore(db);
  const issue = (id) => {
    const { issuer, subject } = seed.rows.owners.find((owner) => owner.id === id);
    const token = randomToken();
    store.issueSession({ issuer, subject, ownerId: id, idHash: sha256(token), csrfHash: sha256(csrfToken(token)),
      now: iso(now), idleExpires: iso(now + 60000), absoluteExpires: iso(now + 3600000) });
    return token;
  };
  const owner = issue(seed.owner);
  const foreign = issue(seed.otherOwner);
  const outcomes = [];
  const handler = createRebuildHandler({ origin, store, github, clock: () => now, onOutcome: (event) => outcomes.push(event) });
  const server = createNodeServer({ origin, handleRequest: handler });
  const address = await server.start();
  t.after(async () => {
    await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
    db.close();
  });
  const call = (path, token, method = "GET", body, key = resourceId("fixture"), machine = false) => fetch(
    `http://127.0.0.1:${address.port}/api/v2${path}`, { method,
      headers: { ...(token ? machine ? { Authorization: `Bearer ${token}` } :
        { Cookie: `${OWNER_COOKIE}=${token}`, Origin: origin, "X-CSRF-Token": csrfToken(token) } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json", "Idempotency-Key": key }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const repo = await call("/projects", owner, "POST", { slug: "github-fixture", title: "Scoped GitHub fixture",
    repository_url: "https://github.com/example/fixture", default_branch: "main" });
  assert.equal(repo.status, 201);
  const project = (await repo.json()).id;
  const start = `/projects/${project}`;
  const post = (path, data, key, token = owner) => call(start + path, token, "POST", data, key);
  const get = (path, token = owner) => call(start + path, token);
  const credential = async (role = "publisher") => {
    const result = await post("/credentials", { role, label: "Fixture runner" });
    assert.equal(result.status, 201);
    return result.json();
  };
  const consent = async (input) => {
    const response = await post("/publication-consents", { preview_digest: previewDigest(project, input), consent: true });
    assert.equal(response.status, 201);
    return { ...input, consent_id: (await response.json()).id };
  };
  return { db, seed, owner, foreign, call, post, get, credential, project, consent, outcomes,
    publish: (input, secret, key) => call(start + "/publications", secret, "POST", input, key, true) };
}
async function expect(response, status, code) {
  assert.equal(response.status, status, await response.clone().text());
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const result = await response.json();
  if (code) assert.equal(result.code, code);
  return result;
}

function gitFixture(inputs) {
  const states = new Map(inputs.map((input) => [input.commit, input]));
  const captured = [];
  const clocked = { head: inputs.at(-1).commit, error: null, denied: null, seen: captured };
  const trees = new Map(inputs.map((input, i) => [sha(String(i + 5)), input]));
  clocked.github = new RebuildGitHub({ fetchImpl: async (destination, init) => {
    const url = new URL(destination);
    assert.equal(url.origin, "https://api.github.com");
    assert.equal(init.redirect, "error");
    if (clocked.error === "timeout") throw new DOMException("fixture", "TimeoutError");
    if (clocked.error === "denied") return new Response(null, { status: 403 });
    const path = url.pathname.replace(/^\/repos\/example\/fixture/, "");
    captured.push(path);
    if (!path) return Response.json({ default_branch: "main", full_name: "example/fixture" });
    if (path === "/git/ref/heads/main") return Response.json({ ref: "refs/heads/main", object: { type: "commit", sha: clocked.head } });
    if (path.startsWith("/compare/")) {
      const [before, after] = path.slice(9).split("...");
      const good = states.has(before) && states.has(after) && before < after && before !== clocked.denied;
      return Response.json({ status: good ? "ahead" : "diverged", merge_base_commit: { sha: good ? before : sha("f") } });
    }
    if (path.startsWith("/git/commits/")) {
      const commit = path.split("/").at(-1);
      const tree = [...trees].find(([, input]) => input.commit === commit);
      return tree ? Response.json({ sha: commit, tree: { sha: tree[0] } }) : new Response(null, { status: 404 });
    }
    const hash = path.split("/").at(-1);
    return Response.json({ sha: hash, truncated: false, tree: trees.get(hash).artifacts.flatMap(({ source_files }) => source_files.map((file) => ({
      path: file.path, type: "blob", mode: "100644",
      sha: createHash("sha1").update(`blob ${Buffer.byteLength(file.content_utf8)}\0`).update(file.content_utf8).digest("hex"),
    }))) });
  } });
  return clocked;
}

test("approved preview digest and parsed source evidence are stable across transport metadata", () => {
  const contract = JSON.parse(readFileSync(new URL("../../docs/06-api/sources/rebuild/openapi.json", import.meta.url)));
  const example = contract.components["x-corthex"].first_publication_preview.example;
  assert.equal(canonicalJSON(example.envelope), example.canonical_utf8);
  assert.equal(previewDigest(example.envelope.project_id, { ...example.envelope.snapshot, consent_id: "test-consent" }), example.sha256);
  const paths = [
    ["01-domain", "docs/01-domain/rebuild.md", "text/markdown"], ["02-prd", "docs/02-prd/rebuild.md", "text/markdown"],
    ["03-user-flow", "docs/03-user-flow/rebuild/FL-130.md", "text/markdown"],
    ["04-functional-spec", "docs/04-functional-spec/rebuild.md", "text/markdown"],
    ["05-erd", "db/rebuild/migrations/001-initial.sql", "application/sql"],
    ["06-api", "docs/06-api/sources/rebuild/openapi.json", "application/json"],
    ["07-sitemap", "docs/07-sitemap/sources/rebuild.yaml", "application/yaml"],
    ["08-screen-states", "docs/08-screens/rebuild/SCR-131.md", "text/markdown"],
    ["09-mockup", "design/rebuild/index.html", "text/html"], ["10-wbs", "docs/10-wbs/rebuild.md", "text/markdown"],
    ["11-development", "nexus/src/rebuild-app.js", "text/plain"],
    ["12-qa", "nexus/test/rebuild-schema.test.js", "text/plain"],
    ["13-presentation", null, null],
  ];
  const source = paths.map(([stage, path, media]) => ({ part: "rebuild", stage,
    source_files: path ? [inputFile(path, readFileSync(new URL("../../" + path, import.meta.url), "utf8"), media)] : [] }));
  const artifacts = prepareArtifacts(source);
  for (const artifact of artifacts.slice(0, -1)) assert.notEqual(artifact.representation, "unsupported", artifact.stage);
  assert.equal(artifacts.at(-1).representation, "missing");
  assert.ok(artifacts[0].graph.edges.length > 10);
  assert.ok(artifacts[2].graph.nodes.length > 5);
  assert.ok(artifacts[4].graph.edges.length > 5);
  assert.equal(artifacts[5].items.length, 36);
  assert.equal(artifacts[6].graph.nodes.length, 11);
  assert.ok(artifacts[5].items.find(({ id }) => id === "API-225").fields["HTTP 201"]);
  const { stage, files, manifest, contentVersion } = artifacts[1];
  const envelope = { version: "nexus.content/1", parser_contract: `${parserVersion}:${stage}`,
    source_files: files.map(({ path, media_type, sha256 }) => ({ path, media_type, sha256 })), attachments: manifest };
  assert.equal(contentVersion, sha256(canonicalJSON(envelope)));
});

test("schema and rendering keep multi-file relations, routable parts and preview policy", () => {
  const artifact = { part: "main", stage: "05-erd", source_files: [
    inputFile("db/child.sql", "-- TBL-127 Child\nCREATE TABLE child (parent_id TEXT REFERENCES parent(id));\n", "application/sql"),
    inputFile("db/parent.sql", "-- TBL-126 Parent\nCREATE TABLE parent (id TEXT PRIMARY KEY);\n", "application/sql"),
  ] };
  const [result] = prepareArtifacts([artifact]);
  assert.deepEqual(result.graph.edges, [{ from: "TBL-127", to: "TBL-126", label: "foreign key" }]);
  assert.deepEqual(result.diagnostics, []);
  for (const part of [".", ".."]) assert.throws(() => prepareArtifacts([{ ...artifact, part }]), { code: "invalid_input" });
  const preview = rebuildView(new Request(origin + "/p/prj_test/preview/art_test"), "en");
  const source = rebuildView(new Request(origin + "/p/prj_test/main/02-prd"), "en");
  const header = preview.headers.get("Content-Security-Policy");
  assert.match(header, /script-src 'self' 'unsafe-inline'/);
  assert.match(header, /style-src 'self' 'unsafe-inline'/);
  assert.match(header, /frame-src 'none'/);
  assert.ok(!source.headers.get("Content-Security-Policy").includes("unsafe-inline"));
});

test("a committed translation preserves the original review item and contributes to the content digest", () => {
  const original = inputFile("docs/prd.md", "| REQ-301 | Canonical requirement |\n");
  const translation = inputFile("docs/prd.ko.md", "| REQ-301 | 번역 요구사항 |\n");
  const stage = { part: "main", stage: "02-prd" };
  const [dual] = prepareArtifacts([{ ...stage, source_files: [translation, original] }]);
  const [single] = prepareArtifacts([{ ...stage, source_files: [original] }]);
  assert.equal(dual.items[0].title, "Canonical requirement");
  assert.equal(dual.items[0].path, original.path);
  assert.notEqual(dual.contentVersion, single.contentVersion);
  const [koreanOnly] = prepareArtifacts([{ ...stage, source_files: [translation] }]);
  assert.equal(koreanOnly.items[0].title, "번역 요구사항");
});

test("API-225/227 confirms consent and Git blobs, preserves retry receipts/history and rejects an older base", async (t) => {
  const initial = snapshot(), metadata = snapshot("2", initial.commit), changed = snapshot("3", metadata.commit, "REQ-303");
  const upstream = gitFixture([initial, metadata, changed]);
  const f = await fixture(t, upstream.github);
  const { secret } = await f.credential();
  const refused = await expect(await f.publish(initial, secret), 409, "consent_required");
  assert.deepEqual(f.outcomes.at(-1), { outcome: "refused", traceId: refused.traceId });
  const accepted = await f.consent(initial);
  await expect(await f.publish({ ...accepted, commit: sha("4") }, secret), 409, "consent_required");
  upstream.denied = initial.commit;
  await expect(await f.publish(accepted, secret), 409, "unmerged_commit");
  upstream.denied = null;
  const wrong = { ...initial, artifacts: structuredClone(initial.artifacts) };
  wrong.artifacts[0].source_files = [inputFile("docs/prd.md", "Source different from Git")];
  await expect(await f.publish(await f.consent(wrong), secret), 409, "unmerged_commit");
  const ready = await f.consent(initial);
  const key = resourceId("repeat");
  const first = await expect(await f.publish(ready, secret, key), 201);
  assert.equal(first.revision, 1);
  assert.deepEqual(f.outcomes.at(-1), { outcome: "received", traceId: undefined });
  assert.deepEqual(await expect(await f.get("/publications/" + first.id), 200), first);
  upstream.error = "denied";
  assert.deepEqual(await expect(await f.publish(ready, secret, key), 201), first);
  assert.deepEqual(f.outcomes.at(-1), { outcome: "skipped", traceId: undefined });
  await expect(await f.publish({ ...ready, commit: sha("4") }, secret, key), 409, "idempotency_conflict");
  upstream.error = null;
  const part = "/stages/main/02-prd";
  const original = await expect(await f.get(part), 200);
  const same = await expect(await f.publish(metadata, secret), 201);
  const sameBody = await expect(await f.get(part), 200);
  assert.equal(sameBody.source.content_version, original.source.content_version);
  assert.equal(sameBody.source.publication_id, same.id);
  assert.equal(sameBody.source.commit, metadata.commit);
  const later = await expect(await f.publish(changed, secret), 201);
  assert.equal(later.revision, 3);
  const current = await expect(await f.get(part), 200);
  assert.notEqual(current.source.content_version, original.source.content_version);
  assert.equal(current.items.find((item) => item.id === "REQ-302").removed, true);
  await expect(await f.get(part + "/items/REQ-302"), 404, "not_found");
  const historical = await expect(await f.get(part + "/items/REQ-302?publication_id=" + first.id), 200);
  assert.equal(historical.source.commit, initial.commit);
  assert.equal(historical.removed, false);
  await expect(await f.get(part + "?publication_id=" + same.id + "&version=" + "a".repeat(64)), 404, "not_found");
  await expect(await f.publish({ ...changed, base_commit: initial.commit }, secret), 409, "older_publication");
  const versionOne = await expect(await f.get("/versions?limit=1"), 200);
  const versionTwo = await expect(await f.get("/versions?limit=1&cursor=" + encodeURIComponent(versionOne.next_cursor)), 200);
  assert.deepEqual([versionOne.versions[0].stage, versionTwo.versions[0].stage], ["02-prd", "09-mockup"]);
  assert.equal(versionOne.versions[0].publication_revision, 3);
  const preview = await expect(await f.get("/stages/main/09-mockup"), 200);
  const content = await expect(await f.get("/previews/" + preview.artifact_id), 200);
  assert.equal(content.sandbox, "allow-scripts");
  assert.equal(content.part, preview.stage.part);
  assert.deepEqual(content.source, preview.source);
  assert.equal(content.html, html);
  await expect(await f.get("/previews/" + preview.artifact_id, f.foreign), 404, "not_found");
  assert.equal(f.db.prepare("SELECT count(*) n FROM publications WHERE project_id=?").get(f.project).n, 3);
  assert.equal(f.db.prepare("SELECT count(*) n FROM write_journal WHERE project_id=? AND operation='publishSnapshot'").get(f.project).n, 3);
});

test("publication failure metrics correlate with the safe upstream problem", async (t) => {
  const input = snapshot();
  const upstream = gitFixture([input]);
  const f = await fixture(t, upstream.github);
  const { secret } = await f.credential();
  const consented = await f.consent(input);
  upstream.error = "denied";
  const failure = await expect(await f.publish(consented, secret), 503, "source_verification_unavailable");
  assert.deepEqual(f.outcomes, [{ outcome: "failed", traceId: failure.traceId }]);
});

test("API-228–230 issues one project-scoped secret and grants access only until revocation", async (t) => {
  const f = await fixture(t);
  const key = resourceId("issue"), input = { role: "publisher", label: "Fixture publisher" };
  const { credential, secret } = await expect(await f.post("/credentials", input, key), 201);
  const retry = await expect(await f.post("/credentials", input, key), 200);
  assert.deepEqual(retry, { credential, secret_not_replayed: true });
  assert.ok(!JSON.stringify(f.db.prepare("SELECT * FROM idempotency_receipts").all()).includes(secret));
  assert.ok(!JSON.stringify(f.db.prepare("SELECT * FROM write_journal").all()).includes(secret));
  assert.ok(!JSON.stringify(f.db.prepare("SELECT * FROM project_credentials").all()).includes(secret));
  await expect(await f.get("/credentials", f.foreign), 404, "not_found");
  await expect(await f.call(`/projects/${f.project}/credentials`, secret, "GET", undefined, undefined, true), 403, "operation_forbidden");
  await expect(await f.call(`/projects/${f.seed.projectId}/publications/pub_demo`, secret, "GET", undefined, undefined, true), 404, "not_found");
  for (let i = 0; i < 105; i++) insertFixtureRow(f.db, "project_credentials", { id: "cred_past_" + i, owner_id: f.seed.owner,
    project_id: f.project, role: "publisher", label: "Revoked fixture", secret_hash: sha256("past:" + i),
    created_at: "2026-11-18T04:01:00.000Z", revoked_at: "2026-11-18T04:01:01.000Z" });
  const listing = await expect(await f.get("/credentials"), 200);
  assert.equal(listing.credentials.length, 100);
  assert.equal(listing.credentials[0].id, credential.id);
  const revoked = await expect(await f.post(`/credentials/${credential.id}/revoke`, { credential_id: credential.id }), 200);
  assert.equal(revoked.revoked, true);
  await expect(await f.publish(snapshot(), secret), 401, "sign_in_required");
});


test("agent citation authorization includes later pages and exact item reads", async (t) => {
  const f = await fixture(t);
  const root = "/projects/" + f.seed.projectId;
  const { secret } = await expect(await f.call(root + "/credentials", f.owner, "POST", { role: "agent", label: "Queue fixture" }), 201);
  for (let i = 0; i < 105; i++) {
    const trace = "REQ-" + (600 + i);
    const discussion = "dis_queue_" + i;
    const question = "msg_queue_" + i;
    const item = { id: trace, title: "Fixture item " + i, removed: false, kind: "requirement", fields: {},
      source: { repository_url: "https://github.com/example/sample", path: f.seed.original.source_path, line: 1, commit: "c".repeat(40),
        content_version: f.seed.original.content_version, publication_id: f.seed.original.publication_id,
        publication_revision: 1, published_at: f.seed.time } };
    insertFixtureRow(f.db, "artifact_items", { project_id: f.seed.projectId, artifact_id: f.seed.original.id, trace_id: trace,
      item_json: JSON.stringify(item), source_line: 1, removed: 0 });
    insertFixtureRow(f.db, "discussions", { id: discussion, project_id: f.seed.projectId, origin_artifact_id: f.seed.original.id,
      item_trace_id: trace, state: "open", created_at: f.seed.time });
    insertFixtureRow(f.db, "messages", { id: question, project_id: f.seed.projectId, discussion_id: discussion, sequence: 1,
      author_kind: "owner", author_ref: f.seed.owner, body: "Review a cited item", created_at: f.seed.time });
    insertFixtureRow(f.db, "agent_work", { id: "work_queue_" + i, project_id: f.seed.projectId, question_message_id: question,
      state: "queued", created_at: f.seed.time });
  }
  const target = root + "/stages/" + f.seed.original.part + "/02-prd";
  const selection = new URLSearchParams({ publication_id: f.seed.original.publication_id, version: f.seed.original.content_version });
  const call = (path) => f.call(path, secret, "GET", undefined, undefined, true);
  assert.equal((await expect(await call(target + "/items/REQ-704?" + selection), 200)).id, "REQ-704");
  await expect(await call(target + "/items/REQ-301?" + selection), 404, "not_found");
  const first = await expect(await call(target + "?" + selection + "&limit=100"), 200);
  const second = await expect(await call(target + "?" + selection + "&limit=100&cursor=" + encodeURIComponent(first.next_cursor)), 200);
  assert.equal(first.items.length, 100);
  assert.equal(second.items.length, 5);
  assert.equal(second.items.at(-1).id, "REQ-704");
});
