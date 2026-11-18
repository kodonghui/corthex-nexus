import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { createNodeServer } from "../src/node-server.js";
import { createRebuildHandler } from "../src/rebuild-app.js";
import { AUTH_COOKIE, OWNER_COOKIE, OWNER_IDLE, OWNER_LIFETIME, csrfToken, iso, randomToken, resourceId } from "../src/rebuild-auth.js";
import { RebuildGitHub } from "../src/rebuild-github.js";
import { sha256 } from "../src/rebuild-http.js";
import { RebuildOIDC } from "../src/rebuild-oidc.js";
import { snapshotLimit } from "../src/rebuild-source.js";
import { openRebuildDatabase } from "../src/rebuild-sqlite.js";
import { RebuildStore } from "../src/store.js";
import { insertFixtureRow, rebuildFixture, seedRebuildFixture } from "./rebuild-fixture.js";

const contract = JSON.parse(readFileSync(new URL("../../docs/06-api/sources/rebuild/openapi.json", import.meta.url), "utf8"));
const operations = new Map(Object.entries(contract.paths).flatMap(([path, verbs]) =>
  Object.entries(verbs).map(([method, spec]) => [spec["x-corthex"].id, { path, method: method.toUpperCase(), spec }])));
const problem = contract.components.schemas.Problem;
const problemCodes = contract.components["x-corthex"].errors;
const origin = "https://coverage.nexus.example.test";
const initialTime = Date.parse("2026-11-18T05:00:00Z");
const domainTables = [
  "owners", "projects", "project_credentials", "publication_consents", "publications", "stage_artifacts", "artifact_items",
  "discussions", "messages", "discussion_decisions", "agent_work", "proposals", "checkpoint_requests", "checkpoint_decisions",
  "idempotency_receipts", "write_journal",
];
const absent = "fixture_missing";
const version = "0".repeat(64);
const stageName = "02-prd";

async function fixture(t, { oidc, github } = {}) {
  const db = openRebuildDatabase(":memory:");
  const data = rebuildFixture();
  data.rows.projects.find(({ id }) => id === data.projectId).synthetic = 0;
  seedRebuildFixture(db, data);
  const store = new RebuildStore(db);
  let now = initialTime;
  const tokens = { owner: randomToken(), agent: randomToken(), publisher: randomToken() };
  const credentialIds = { agent: "cred_fixture_agent", publisher: "cred_fixture_publisher" };
  const owner = data.rows.owners.find(({ id }) => id === data.owner);
  store.issueSession({ issuer: owner.issuer, subject: owner.subject, ownerId: owner.id, idHash: sha256(tokens.owner),
    csrfHash: sha256(csrfToken(tokens.owner)), now: iso(now), idleExpires: iso(now + OWNER_IDLE), absoluteExpires: iso(now + OWNER_LIFETIME) });
  for (const role of ["agent", "publisher"]) {
    insertFixtureRow(db, "project_credentials", { id: credentialIds[role], owner_id: data.owner, project_id: data.projectId,
      role, label: "Synthetic " + role, secret_hash: sha256(tokens[role]), created_at: iso(now) });
  }
  const traces = [];
  const handler = createRebuildHandler({ store, origin, oidc, github, clock: () => now, attemptKey: Buffer.alloc(32, 5),
    releaseCommit: "6".repeat(40), onTrace: (trace) => traces.push(trace) });
  const server = createNodeServer({ origin, handleRequest: handler });
  const { port } = await server.start();
  t.after(async () => {
    await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
    db.close();
  });
  const ids = { projectId: data.projectId, part: data.current.part, stage: stageName, itemId: "REQ-301", discussionId: "dis_demo",
    workId: "work_fixture", proposalId: "proposal_fixture", publicationId: data.current.publication_id, checkpointId: data.pending.id,
    credentialId: credentialIds.agent, artifactId: data.current.id };
  function request(id, { role = "owner", pathIds = {}, query, body, key = resourceId("coverage"), headers = {} } = {}) {
    const operation = operations.get(id);
    const named = { ...ids, ...pathIds };
    const pathname = operation.path.replace(/\{(\w+)\}/g, (_, name) => encodeURIComponent(named[name]));
    const auth = role === "owner" ? { Cookie: `${OWNER_COOKIE}=${tokens.owner}`, "X-CSRF-Token": csrfToken(tokens.owner) }
      : role === "anonymous" ? {} : { Authorization: `Bearer ${tokens[role]}` };
    const write = operation.method === "POST";
    const outgoing = { ...auth, Origin: origin, ...(write ? { "Content-Type": "application/json", "Idempotency-Key": key } : {}), ...headers };
    const content = typeof body === "string" ? body : JSON.stringify(body ?? {});
    return fetch(`http://127.0.0.1:${port}${pathname}${query ? "?" + new URLSearchParams(query) : ""}`,
      { method: operation.method, headers: outgoing, ...(write ? { body: content } : {}), redirect: "manual" });
  }

  function fingerprint() {
    return sha256(JSON.stringify(domainTables.map((table) => db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all())));
  }

  async function refusal(id, status, code, options) {
    const example = operations.get(id).spec.responses[status]?.content["application/problem+json"];
    assert.equal(example?.schema?.$ref, "#/components/schemas/Problem", `${id}#${status} contract`);
    assert.equal(problemCodes[code].status, status);
    const before = fingerprint();
    const response = await request(id, options);
    const value = await response.json();
    assert.equal(response.status, status, `${id} returned ${response.status} ${value.code}`);
    assert.equal(response.headers.get("Content-Type"), "application/problem+json");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(Object.keys(value).sort(), problem.required.toSorted());
    for (const [key, rules] of Object.entries(problem.properties)) {
      if (rules.type === "string") {
        assert.equal(typeof value[key], "string");
        assert.ok(Array.from(value[key]).length >= (rules.minLength ?? 0));
        assert.ok(Array.from(value[key]).length <= (rules.maxLength ?? Infinity));
      }
      if (rules.enum) assert.ok(rules.enum.includes(value[key]), `invalid ${key} in ${id}`);
    }
    assert.equal(value.type, `${origin}/problems/${code}`);
    assert.equal(value.status, status);
    assert.equal(value.code, code);
    assert.equal(value.instance, new URL(response.url).pathname);
    assert.deepEqual(traces.at(-1), { traceId: value.traceId, code, status });
    // Reads may refresh session metadata. Refused writes leave the domain, receipt and journal rows intact.
    assert.equal(fingerprint(), before, `${id} refusal changed durable domain data`);
    return value;
  }

  return { data, db, request, refusal, credentialIds, advance: (ms) => { now += ms; } };
}

const roleRefusals = [
  ["API-205", "publisher"], ["API-206", "publisher"], ["API-207", "publisher"],
  ["API-208", "publisher"], ["API-209", "publisher"], ["API-210", "publisher"], ["API-211", "publisher"],
  ["API-213", "publisher"], ["API-214", "owner"], ["API-215", "owner"], ["API-216", "owner"],
  ["API-217", "owner"], ["API-218", "agent"], ["API-219", "owner"], ["API-220", "publisher"],
  ["API-221", "publisher"], ["API-223", "agent", "human_session_required"], ["API-224", "publisher"],
  ["API-225", "owner"], ["API-227", "publisher"], ["API-229", "agent"], ["API-230", "agent"],
  ["API-231", "agent"], ["API-233", "publisher"], ["API-235", "owner"], ["API-236", "owner"],
];

test("wrong authenticated roles are refused before parsing or writing project data", async (t) => {
  const server = await fixture(t);
  for (const [id, role, code = "operation_forbidden"] of roleRefusals) {
    await t.test(`${id}#403 ${role}`, () => server.refusal(id, 403, code, { role }));
  }
});

const leaseBody = { lease_token: randomToken(), expected_revision: 0 };
const claimBody = { session_label: "Synthetic agent session", expected_revision: 0 };
const decisionBody = { expected_revision: 0, decision: "accept" };

function publishBody(data) {
  const content = "# Proposed wording\n\n| Requirement | Title |\n| --- | --- |\n| REQ-301 | Clarified private scope |\n";
  return { format: "nexus.publish/1", commit: "f".repeat(40), base_commit: data.rows.publications.at(-1).commit_sha,
    consent_id: null, artifacts: [{ part: data.current.part, stage: stageName,
      source_files: [{ path: "docs/requirements.md", media_type: "text/markdown", content_utf8: content, sha256: sha256(content) }] }] };
}

test("inaccessible projects and absent targets are indistinguishable in the authenticated scope", async (t) => {
  const server = await fixture(t);
  const { data } = server;
  const target = { projectId: absent };
  const work = { workId: absent };
  const proposal = { proposalId: absent };
  const checkpoint = { checkpointId: absent };
  const current = { publication_id: data.current.publication_id, content_version: data.current.content_version };
  const evidence = { body: "Review evidence", expected_revision: 0, publication_id: current.publication_id,
    source_commit: data.rows.publications.at(-1).commit_sha };
  const humanDecision = { expected_revision: 0, content_version: current.content_version, decision: "pass", reason: "" };
  const withdrawal = { expected_revision: 0, content_version: current.content_version, prior_decision_id: absent, reason: "" };
  const cases = [
    ["API-210", { pathIds: target }],
    ["API-213", { pathIds: { discussionId: absent }, body: evidence }],
    ["API-214", { pathIds: target, role: "agent" }],
    ["API-215", { pathIds: work, role: "agent", body: claimBody }],
    ["API-216", { pathIds: work, role: "agent", body: { ...leaseBody, content_version: current.content_version, body: "Synthetic reply" } }],
    ["API-217", { role: "agent", body: { work_id: absent, lease_token: leaseBody.lease_token, content_version: current.content_version, body: "Synthetic change" } }],
    ["API-218", { pathIds: proposal, body: decisionBody }],
    ["API-219", { pathIds: proposal, role: "agent", body: { expected_revision: 0, publication_id: current.publication_id, source_commit: evidence.source_commit } }],
    ["API-220", { body: { ...current, part: data.current.part, stage: "05-erd" } }],
    ["API-222", { pathIds: checkpoint, body: humanDecision }],
    ["API-223", { pathIds: checkpoint, body: withdrawal }],
    ["API-224", { pathIds: target }],
    ["API-225", { pathIds: { projectId: data.otherProject }, role: "publisher", body: publishBody(data) }],
    ["API-227", { pathIds: target, body: { preview_digest: version, consent: true } }],
    ["API-229", { pathIds: target, body: { role: "agent", label: "Synthetic credential" } }],
    ["API-230", { pathIds: { credentialId: absent }, body: { credential_id: absent } }],
    ["API-234", { pathIds: target }],
    ["API-235", { pathIds: work, role: "agent", body: leaseBody }],
    ["API-236", { pathIds: work, role: "agent", body: leaseBody }],
  ];
  for (const [id, options] of cases) {
    await t.test(`${id}#404`, () => server.refusal(id, 404, "not_found", options));
  }
});

const boundedWriteRoles = [
  ["API-206", "owner"], ["API-213", "owner"], ["API-215", "agent"], ["API-216", "agent"], ["API-217", "agent"],
  ["API-218", "owner"], ["API-219", "agent"], ["API-220", "owner"], ["API-222", "owner"], ["API-223", "owner"],
  ["API-225", "publisher"], ["API-227", "owner"], ["API-229", "owner"], ["API-230", "owner"], ["API-233", "owner"],
  ["API-235", "agent"], ["API-236", "agent"],
];

test("JSON request size limits reject authorized writers without a receipt", async (t) => {
  const server = await fixture(t);
  const ordinary = JSON.stringify({ padding: "x".repeat(256 * 1024) });
  for (const [id, role] of boundedWriteRoles) {
    await t.test(`${id}#413 ${role}`, () => server.refusal(id, 413, "payload_too_large", {
      role, body: id === "API-225" ? JSON.stringify({ padding: "x".repeat(snapshotLimit) }) : ordinary,
    }));
  }
});

async function success(server, id, status, options) {
  const response = await server.request(id, options);
  const value = await response.json();
  assert.equal(response.status, status, `${id} setup returned ${response.status} ${value.code}`);
  return value;
}

test("expired leases, stale decisions, and duplicate keys cannot change durable state", async (t) => {
  const server = await fixture(t);
  const { data } = server;
  const content_version = data.current.content_version;
  const publication_id = data.current.publication_id;
  const question = await success(server, "API-211", 201, { body: { item_id: "REQ-301", content_version, publication_id, body: "Clarify private scope.", ask_ai: true } });
  const workId = question.agent_work[0].id;
  const lease = await success(server, "API-215", 200, { pathIds: { workId }, role: "agent", body: claimBody });
  const proposalBody = { work_id: workId, lease_token: lease.lease_token, content_version, body: "Adjust the wording." };
  const proposal = await success(server, "API-217", 201, { pathIds: { discussionId: question.id }, role: "agent", body: proposalBody });

  await t.test("API-218#409 stale proposal revision", () => server.refusal("API-218", 409, "stale_version",
    { pathIds: { proposalId: proposal.id }, body: { ...decisionBody, expected_revision: proposal.revision + 1 } }));
  await t.test("API-219#409 proposed change is not accepted", () => server.refusal("API-219", 409, "state_conflict",
    { pathIds: { proposalId: proposal.id }, role: "agent", body: { expected_revision: proposal.revision, publication_id, source_commit: data.rows.publications.at(-1).commit_sha } }));

  server.advance(600001);
  const expired = { lease_token: lease.lease_token, expected_revision: lease.work.revision };
  await t.test("API-216#409 expired reply", () => server.refusal("API-216", 409, "lease_expired",
    { pathIds: { workId }, role: "agent", body: { ...expired, content_version, body: "Do not add the expired reply." } }));
  await t.test("API-217#409 expired proposal", () => server.refusal("API-217", 409, "lease_expired",
    { pathIds: { discussionId: question.id }, role: "agent", body: proposalBody }));
  await t.test("API-236#409 expired release", () => server.refusal("API-236", 409, "lease_expired",
    { pathIds: { workId }, role: "agent", body: expired }));
  await t.test("API-223#409 withdrawal without the current decision", () => server.refusal("API-223", 409, "stale_version",
    { body: { expected_revision: data.pending.row_revision, prior_decision_id: absent, content_version, reason: "" } }));
  await t.test("API-227#409 existing publication needs no first-publication consent", () => server.refusal("API-227", 409, "state_conflict",
    { body: { preview_digest: version, consent: true } }));

  const revokeKey = resourceId("coverage");
  await success(server, "API-230", 200, { key: revokeKey, body: { credential_id: server.credentialIds.agent } });
  await t.test("API-230#409 reuse of a revoke key for another credential", () => server.refusal("API-230", 409, "idempotency_conflict",
    { key: revokeKey, pathIds: { credentialId: server.credentialIds.publisher }, body: { credential_id: server.credentialIds.publisher } }));
  const sampleKey = resourceId("coverage");
  await success(server, "API-233", 201, { key: sampleKey, body: { title: "Synthetic sample" } });
  await t.test("API-233#409 reuse of a sample key with another title", () => server.refusal("API-233", 409, "idempotency_conflict",
    { key: sampleKey, body: { title: "Edited synthetic sample" } }));

  for (let index = 0; index < 99; index++) {
    insertFixtureRow(server.db, "project_credentials", { id: `cred_coverage_${index}`, owner_id: data.owner, project_id: data.projectId,
      role: "agent", label: "Existing synthetic credential", secret_hash: sha256(`fixture credential ${index}`), created_at: iso(initialTime) });
  }
  await t.test("API-229#409 project already holds 100 live credentials", () => server.refusal("API-229", 409, "state_conflict",
    { body: { role: "agent", label: "One credential too many" } }));
});

test("API-210#200 lists its historical versioned thread for the owner", async (t) => {
  const server = await fixture(t);
  const body = await success(server, "API-210", 200);
  const response = operations.get("API-210").spec.responses[200].content["application/json"].schema;
  const schema = contract.components.schemas[response.$ref.split("/").at(-1)];
  assert.deepEqual(Object.keys(body).sort(), schema.required.toSorted());
  assert.equal(body.next_cursor, null);
  assert.equal(body.discussions.length, 1);
  const thread = body.discussions[0];
  assert.deepEqual(Object.keys(thread).sort(), contract.components.schemas.Discussion.required.toSorted());
  assert.equal(thread.id, "dis_demo");
  assert.equal(thread.publication_id, server.data.original.publication_id);
  assert.equal(thread.content_version, server.data.original.content_version);
  assert.deepEqual(thread.messages.map(({ author, sequence }) => [author, sequence]), [["owner", 1], ["agent", 2]]);
});

test("the OIDC callback consumes the attempt without issuing a session on provider failures", async (t) => {
  const issuer = "https://issuer.example.test";
  const provider = { fail: 503, calls: 0 };
  const oidc = new RebuildOIDC({ origin, issuer, clientId: "coverage-fixture", now: () => initialTime, timeout: 250,
    fetchImpl: async (destination, init) => {
      const url = new URL(destination);
      assert.equal(url.origin, issuer);
      assert.equal(init.redirect, "error");
      if (url.pathname === "/.well-known/openid-configuration") {
        return Response.json({ issuer, authorization_endpoint: issuer + "/authorize", token_endpoint: issuer + "/token", jwks_uri: issuer + "/jwks",
          id_token_signing_alg_values_supported: ["RS256"], code_challenge_methods_supported: ["S256"],
          token_endpoint_auth_methods_supported: ["none"] });
      }
      assert.equal(url.pathname, "/token");
      assert.equal(init.body.get("redirect_uri"), origin + "/api/v2/auth/callback");
      assert.equal(init.body.get("grant_type"), "authorization_code");
      assert.equal(init.body.get("code"), "fixture-authorization-code");
      assert.ok(init.body.get("code_verifier"));
      provider.calls++;
      if (provider.fail === 504) await delay(5000, null, { signal: init.signal });
      return new Response(null, { status: 503 });
    } });
  const server = await fixture(t, { oidc });
  const sessions = () => server.db.prepare("SELECT count(*) AS n FROM owner_sessions").get().n;
  const consumed = () => server.db.prepare("SELECT count(*) AS n FROM auth_attempts WHERE used_at IS NOT NULL").get().n;
  for (const [status, code] of [[503, "authentication_unavailable"], [504, "upstream_timeout"]]) {
    await t.test(`API-203#${status}`, async () => {
      provider.fail = status;
      const before = [sessions(), consumed(), provider.calls];
      const start = await server.request("API-202", { role: "anonymous", body: { return_path: "/projects" } });
      assert.equal(start.status, 200);
      const { authorize_url } = await start.json();
      const state = new URL(authorize_url).searchParams.get("state");
      const cookie = start.headers.getSetCookie()[0].split(";")[0];
      assert.equal(cookie, `${AUTH_COOKIE}=${state}`);
      await server.refusal("API-203", status, code, { role: "anonymous", headers: { Cookie: cookie },
        query: { code: "fixture-authorization-code", state, scope: "openid" } });
      assert.deepEqual([sessions(), consumed(), provider.calls], [before[0], before[1] + 1, before[2] + 1]);
    });
  }
});

test("API-225#504 repository deadline cannot advance the held publication", async (t) => {
  let called = false;
  const github = new RebuildGitHub({ timeout: 250, fetchImpl: async (destination, init) => {
    assert.equal(new URL(destination).origin, "https://api.github.com");
    assert.equal(init.redirect, "error");
    called = true;
    await delay(5000, null, { signal: init.signal });
  } });
  const server = await fixture(t, { github });
  await server.refusal("API-225", 504, "upstream_timeout", { role: "publisher", body: publishBody(server.data) });
  assert.equal(called, true);
});
