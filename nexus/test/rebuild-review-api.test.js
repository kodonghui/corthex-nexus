import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createNodeServer } from "../src/node-server.js";
import { createRebuildHandler } from "../src/rebuild-app.js";
import { csrfToken, iso, OWNER_COOKIE, randomToken, resourceId } from "../src/rebuild-auth.js";
import { publicSample } from "../src/rebuild-contract.js";
import { sha256 } from "../src/rebuild-http.js";
import { openRebuildDatabase } from "../src/rebuild-sqlite.js";
import { RebuildStore } from "../src/store.js";
import { insertFixtureRow, seedRebuildFixture } from "./rebuild-fixture.js";

const origin = "https://nexus.example.test";
const day = Date.parse("2026-11-18T05:00:00Z");
const releaseCommit = "6".repeat(40);

async function fixture(t) {
  let time = day;
  const db = openRebuildDatabase(":memory:");
  const seed = seedRebuildFixture(db);
  const store = new RebuildStore(db);
  const ownerToken = (subject) => {
    const owner = seed.rows.owners.find((row) => row.id === subject);
    const token = randomToken();
    store.issueSession({ issuer: owner.issuer, subject: owner.subject, ownerId: resourceId("own"), idHash: sha256(token),
      csrfHash: sha256(csrfToken(token)), now: iso(time), idleExpires: iso(time + 1800000), absoluteExpires: iso(time + 28800000) });
    return token;
  };
  const owner = ownerToken(seed.owner), other = ownerToken(seed.otherOwner);
  const outcomes = [];
  const handle = createRebuildHandler({ store, origin, clock: () => time, releaseCommit, onOutcome: (event) => outcomes.push(event) });
  const server = createNodeServer({ origin, handleRequest: handle });
  const address = await server.start();
  t.after(async () => {
    await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
    db.close();
  });
  const root = `/projects/${seed.projectId}`;
  async function call(path, { body, token = owner, agent = false, key = resourceId("fixture"), standalone = false } = {}) {
    return fetch(`http://127.0.0.1:${address.port}/api/v2${standalone ? "" : root}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { ...(agent ? { Authorization: `Bearer ${token}` } : { Cookie: `${OWNER_COOKIE}=${token}`, Origin: origin, "X-CSRF-Token": csrfToken(token) }),
        ...(body === undefined ? {} : { "Content-Type": "application/json", "Idempotency-Key": key }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  const part = seed.current.part;
  const review = `/stages/${part}/02-prd`;
  const question = (artifact = seed.original, id = "REQ-301", edits = {}) => ({
    item_id: id, content_version: artifact.content_version, publication_id: artifact.publication_id,
    body: "Could we clarify this requirement?", ask_ai: true, ...edits,
  });
  const issue = async (role = "agent") => expect(await call("/credentials", { body: { role, label: "Test runner" } }), 201);
  return { call, issue, db, seed, store, part, review, question, other, owner, outcomes, advance: (ms) => { time += ms; } };
}

async function expect(response, status, code) {
  assert.equal(response.status, status, await response.clone().text());
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const result = await response.json();
  if (code) assert.equal(result.code, code);
  return result;
}

test("versioned question, exclusive claim, renewal, reply, proposal reflection and appended owner decision", async (t) => {
  const f = await fixture(t);
  const agentA = await f.issue(), agentB = await f.issue(), publisher = await f.issue("publisher");
  const askPath = f.review + "/discussions";
  const create = { body: f.question(), key: resourceId("repeat") };
  const [question, replay] = await Promise.all([f.call(askPath, create), f.call(askPath, create)]).then((results) => Promise.all(results.map((r) => expect(r, 201))));
  assert.deepEqual(question, replay);
  assert.deepEqual(f.outcomes, [{ outcome: "queued", traceId: undefined }, { outcome: "skipped", traceId: undefined }]);
  assert.equal(question.publication_id, f.seed.original.publication_id);
  assert.equal(question.messages[0].author, "owner");
  assert.equal(question.agent_work[0].state, "queued");
  const work = question.agent_work[0];
  const claims = `/agent/work/${work.id}`;
  const discussion = `/discussions/${question.id}`;
  await expect(await f.call(askPath, { body: f.question(f.seed.current, "REQ-302") }), 404, "not_found");
  await expect(await f.call(askPath, { body: f.question(f.seed.current, "REQ-301", { content_version: "f".repeat(64) }) }), 409, "stale_version");
  await expect(await f.call(askPath, { body: f.question(f.seed.current, "REQ-301", { body: "x".repeat(8001) }) }), 413, "payload_too_large");
  await expect(await f.call(discussion, { token: f.other }), 404, "not_found");
  await expect(await f.call(discussion, { agent: true, token: publisher.secret }), 403, "operation_forbidden");
  const claimBody = { body: { session_label: "Agent A", expected_revision: 0 }, agent: true, token: agentA.secret, key: resourceId("claim") };
  const proof = await expect(await f.call(claims + "/claim", claimBody), 200);
  assert.equal(proof.work.session_label, "Agent A");
  assert.deepEqual(await expect(await f.call(claims + "/claim", claimBody), 200), proof);
  await expect(await f.call(claims + "/claim", { ...claimBody, token: agentB.secret }), 409, "state_conflict");
  await expect(await f.call(discussion, { agent: true, token: agentB.secret }), 404, "not_found");
  const sourcePath = f.review + "/items/REQ-301";
  const exact = new URLSearchParams({ publication_id: work.publication_id, version: work.content_version });
  await expect(await f.call(sourcePath, { agent: true, token: agentA.secret }), 400, "invalid_input");
  await expect(await f.call(sourcePath + "?" + exact, { agent: true, token: agentA.secret }), 200);
  await expect(await f.call(f.review + "/items/REQ-302?" + exact, { agent: true, token: agentA.secret }), 404, "not_found");
  const proposalOptions = { agent: true, token: agentA.secret,
    body: { lease_token: proof.lease_token, work_id: work.id, content_version: work.content_version, body: "Clarify scope in the source." } };
  const proposal = await expect(await f.call(discussion + "/proposals", proposalOptions), 201);
  assert.equal(proposal.state, "proposed");
  const path = `/proposals/${proposal.id}`;
  const accepted = await expect(await f.call(path + "/decision", { body: { expected_revision: 0, decision: "accept" } }), 200);
  assert.equal(accepted.reflection, null);
  const touched = await expect(await f.call(claims + "/renew", { agent: true, token: agentA.secret,
    body: { expected_revision: 1, lease_token: proof.lease_token } }), 200);
  assert.equal(touched.work.revision, 2);
  const replyInput = { agent: true, token: agentA.secret, key: resourceId("reply"),
    body: { expected_revision: 2, lease_token: proof.lease_token, content_version: work.content_version, body: "The alternative is now documented." } };
  const reply = await expect(await f.call(claims + "/reply", replyInput), 201);
  assert.equal(reply.sequence, 2);
  assert.deepEqual(await expect(await f.call(claims + "/reply", replyInput), 201), reply);
  const reflected = await expect(await f.call(path + "/reflection", { agent: true, token: agentA.secret,
    body: { expected_revision: 1, publication_id: f.seed.current.publication_id, source_commit: "e".repeat(40) } }), 200);
  assert.equal(reflected.reflection.content_version, f.seed.current.content_version);
  const firstPage = await expect(await f.call(discussion + "?limit=1"), 200);
  assert.equal(firstPage.messages.length, 1);
  const secondPage = await expect(await f.call(discussion + "?limit=1&cursor=" + encodeURIComponent(firstPage.next_cursor)), 200);
  assert.equal(secondPage.messages[0].id, reply.id);
  const evidence = { publication_id: f.seed.current.publication_id, source_commit: "e".repeat(40),
    expected_revision: firstPage.revision, body: "Verified the new source." };
  await expect(await f.call(discussion + "/decisions", { body: { ...evidence, source_commit: "f".repeat(40) } }), 409, "stale_version");
  const decision = await expect(await f.call(discussion + "/decisions", { body: evidence }), 201);
  const reviewed = await expect(await f.call(discussion), 200);
  assert.equal(reviewed.state, "resolved");
  assert.equal(reviewed.decisions[0].id, decision.id);
  assert.equal(reviewed.decisions[0].publication_id, f.seed.current.publication_id);
  assert.ok(!JSON.stringify(f.db.prepare("SELECT protected_payload_json FROM write_journal").all()).includes(proof.lease_token));
  assert.ok(!JSON.stringify(f.db.prepare("SELECT safe_result_json FROM idempotency_receipts").all()).includes(proof.lease_token));
  const events = await expect(await f.call("/events?limit=1"), 200);
  assert.equal(events.events[0].kind, "discussion");
  assert.equal((await expect(await f.call("/events", { agent: true, token: publisher.secret }), 200)).events.length, 0);
});

test("expired and released work returns to the queue and stale leases cannot acknowledge replies", async (t) => {
  const f = await fixture(t);
  const a = await f.issue(), b = await f.issue();
  const asked = await expect(await f.call(f.review + "/discussions", { body: f.question() }), 201);
  const route = `/agent/work/${asked.agent_work[0].id}`;
  const lease = await expect(await f.call(route + "/claim", { agent: true, token: a.secret,
    body: { session_label: "First", expected_revision: 0 } }), 200);
  f.advance(600001);
  const expired = await expect(await f.call(route + "/renew", { agent: true, token: a.secret,
    body: { lease_token: lease.lease_token, expected_revision: lease.work.revision } }), 409, "lease_expired");
  assert.deepEqual(f.outcomes.at(-1), { outcome: "lease_expired", traceId: expired.traceId });
  const queue = await expect(await f.call("/agent/work", { agent: true, token: b.secret }), 200);
  assert.equal(queue.work[0].state, "queued");
  const reclaimed = await expect(await f.call(route + "/claim", { agent: true, token: b.secret,
    body: { session_label: "Second", expected_revision: lease.work.revision } }), 200);
  const released = await expect(await f.call(route + "/release", { agent: true, token: b.secret,
    body: { lease_token: reclaimed.lease_token, expected_revision: reclaimed.work.revision } }), 200);
  assert.equal(released.state, "queued");
  assert.equal(released.session_label, null);
});

test("checkpoint decisions enforce current stage dependencies and human session, and retain withdrawals", async (t) => {
  const f = await fixture(t);
  const agent = await f.issue();
  const prd = f.seed.current, domainVersion = "9".repeat(64);
  insertFixtureRow(f.db, "stage_artifacts", { id: "art_domain", project_id: f.seed.projectId,
    publication_id: prd.publication_id, part: f.part, stage: "01-domain", content_version: domainVersion, parser_version: "test",
    representation: "diagram", source_path: "docs/domain.md", source_json: "{}", created_at: prd.created_at });
  const args = { part: f.part, stage: "01-domain", publication_id: prd.publication_id, content_version: domainVersion };
  await expect(await f.call("/checkpoints", { body: { ...args, publication_id: f.seed.original.publication_id } }), 409, "stale_version");
  const request = await expect(await f.call("/checkpoints", { agent: true, token: agent.secret, body: args }), 201);
  const pending = f.seed.pending;
  const prdDecision = { expected_revision: pending.row_revision, content_version: prd.content_version, decision: "pass", reason: "Reviewed" };
  await expect(await f.call(`/checkpoints/${pending.id}/decisions`, { body: prdDecision }), 409, "state_conflict");
  const checkpoint = `/checkpoints/${request.id}`;
  const body = { ...prdDecision, content_version: domainVersion };
  await expect(await f.call(checkpoint + "/decisions", { agent: true, token: agent.secret, body }), 403, "human_session_required");
  const decided = await expect(await f.call(checkpoint + "/decisions", { body }), 201);
  assert.equal(decided.state, "passed");
  const review = await expect(await f.call(checkpoint), 200);
  assert.equal(review.history[0].decided_by, f.seed.owner);
  assert.equal(review.publication_id, prd.publication_id);
  assert.equal(review.source_commit, "e".repeat(40));
  assert.deepEqual(review.current_source, { publication_id: prd.publication_id, content_version: domainVersion });
  const original = await expect(await f.call(`/checkpoints/${f.seed.previous.id}`), 200);
  assert.equal(original.source_commit, "c".repeat(40));
  assert.equal(original.content_version, f.seed.original.content_version);
  assert.deepEqual(original.current_source, { publication_id: prd.publication_id, content_version: prd.content_version });
  const listing = await expect(await f.call("/versions"), 200);
  const prdVersions = listing.versions.filter(({ stage }) => stage === "02-prd");
  assert.deepEqual(prdVersions.map(({ held, checkpoint_state, matching_checkpoint_ids }) =>
    ({ held, checkpoint_state, matching_checkpoint_ids })), [
    { held: true, checkpoint_state: "pending", matching_checkpoint_ids: [pending.id] },
    { held: false, checkpoint_state: "passed", matching_checkpoint_ids: [f.seed.previous.id] },
  ]);
  const prdPassed = await expect(await f.call(`/checkpoints/${pending.id}/decisions`, { body: prdDecision }), 201);
  assert.equal(prdPassed.state, "passed");
  const withdrawal = { expected_revision: 1, content_version: domainVersion, prior_decision_id: decided.id, reason: "Needs a second review." };
  const key = resourceId("withdraw");
  const result = await expect(await f.call(checkpoint + "/withdrawals", { body: withdrawal, key }), 201);
  assert.equal(result.state, "withdrawn");
  assert.deepEqual(await expect(await f.call(checkpoint + "/withdrawals", { body: withdrawal, key }), 201), result);
  const history = (await expect(await f.call(checkpoint), 200)).history;
  assert.deepEqual(history.map((entry) => entry.decision), ["pass", "withdraw"]);
  assert.deepEqual(history.map((entry) => entry.prior_decision_id), [null, decided.id]);
  assert.equal(f.db.prepare("SELECT count(*) n FROM checkpoint_decisions WHERE request_id=?").get(request.id).n, 2);
  const reviewedAgain = await expect(await f.call(checkpoint + "/decisions", { body: { ...body, expected_revision: 2, reason: "Reviewed again" } }), 201);
  assert.equal(reviewedAgain.state, "passed");
  assert.deepEqual((await expect(await f.call(checkpoint), 200)).history.map((entry) => entry.decision), ["pass", "withdraw", "pass"]);
  await expect(await f.call(checkpoint, { token: f.other }), 404, "not_found");
});

test("sample copy stays synthetic, private and bound to the deployed source commit", async (t) => {
  const f = await fixture(t);
  const options = { standalone: true, body: { title: "Private fixture copy" }, key: resourceId("sample") };
  const sample = await expect(await f.call("/sample-projects", options), 201);
  assert.deepEqual(await expect(await f.call("/sample-projects", options), 201), sample);
  assert.equal(sample.synthetic, true);
  assert.equal(sample.repository_url, null);
  assert.equal(sample.default_branch, null);
  assert.equal(sample.verification_state, "not_connected");
  const route = `/projects/${sample.id}/stages/main/02-prd`;
  const item = await expect(await f.call(route, { standalone: true }), 200);
  assert.equal(item.source.commit, releaseCommit);
  assert.ok(item.source.path.startsWith("nexus/sample/"));
  assert.equal(item.items[0].id, "REQ-301");
  for (const file of publicSample.source_files) {
    assert.equal(readFileSync(new URL("../sample/" + file.path, import.meta.url), "utf8"), file.content_utf8);
  }
  await expect(await f.call(route, { standalone: true, token: f.other }), 404, "not_found");
});
