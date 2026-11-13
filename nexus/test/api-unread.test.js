// API-151 getHome, API-158 getStage and API-152 getStageTalk with the agent's
// last read and what it has not read (TASK-298, SPEC-188, SPEC-189): the
// answers behind SPEC-188's and SPEC-189's criteria (TC-1413 to TC-1420), each
// response of the three operations (TC-1621 to TC-1646) and what counts as not
// yet read (TC-1750). The pages that show them are drawn in draw-loop.test.js
// and walked in the browser regression. Synthetic projects only; the Access
// keys are generated here and every database is in memory.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { AccessVerifier } from "../src/access.js";
import { handle } from "../src/app.js";
import { createNodeServer } from "../src/node-server.js";
import { SQLiteD1 } from "../src/sqlite.js";
import { testAccess } from "./access-fixture.js";
import { fakeD1 } from "./fake-d1.js";
import { viewSnapshot } from "./view-fixtures.js";

const template = readFileSync(new URL("../src/hub.html", import.meta.url), "utf8");
// The standalone server is reached over loopback HTTP with Node's own fetch;
// testAccess() then stands in for the Access certificates of handle().
const httpFetch = globalThis.fetch;
const access = await testAccess();
const COMMON = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY", "X-Robots-Tag": "noindex, nofollow", "Cross-Origin-Resource-Policy": "same-origin" };
const RAY = "0123456789abcdef-ICN";
const COMMIT = "abc1234" + "0".repeat(33);
// A project that only a hub of 0.1 pushed, which has a snapshot and no space.
const legacy = (name) => ({ schema: "corthex-hub/0.1", generated_at: "2026-01-12T10:00:00+09:00", project: { name, title: "Legacy shop" },
  stages: { "02-prd": { source_state: "found", read: true, state: "in_progress", next: "Write the PRD" } }, summary: { items: 1 },
  items: [{ id: "REQ-001", kind: "requirement", stage: "02-prd", title: "Send an order confirmation", priority: "Must" }], checks: [] });
// The shop of view-fixtures.js from a commit that starts with abc1234, with an
// item on stage 04; opened makes its board keep a term that no table names, so
// that its push opens one discrepancy.
function shop(name = "acme", { opened = false } = {}) {
  const data = JSON.parse(JSON.stringify(viewSnapshot(name)).replaceAll("a".repeat(40), COMMIT));
  data.ids = { ...data.ids, SPEC: "spec" };
  data.items = [{ id: "SPEC-194", kind: "spec", stage: "04-functional-spec", where: "docs/qa.md:1", title: "Say what the page shows after a refused pass" },
    { id: "TBL-001", kind: "table", stage: "05-erd", where: "docs/qa.md:2", title: "orders" }];
  data.summary = { ...data.summary, items: data.items.length };
  if (opened) data.pictures.find((picture) => picture.stage === "05-erd").source.tables[0].terms = [];
  return data;
}
const USER_COMMENT = (text, item = "TBL-001") => ({ part: "sample", stage: "05-erd", item, text });
const REQUEST = { part: "sample", stage: "04-functional-spec", item: "", text: "Stage 04 is ready for its checkpoint.\nLook at SPEC-194 first.",
  asks: "checkpoint", look_first: "SPEC-194" };
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function shape(db) {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => row.name);
  return createHash("sha256").update(JSON.stringify(tables.map((name) => [name, db.prepare(`SELECT * FROM "${name}"`).all().map((row) => JSON.stringify(row)).sort()]))).digest("hex");
}

// The server as the Worker build runs it, in this process: handle() over D1's
// interface on an in-memory SQLite database; failing() makes every batch fail.
function inProcess() {
  const db = new DatabaseSync(":memory:");
  const binding = fakeD1(db);
  let failing = false;
  const original = binding.batch.bind(binding);
  binding.batch = async (statements) => { if (failing) throw new Error("synthetic read failure"); return original(statements); };
  const env = { ...access.env, DB: binding, NEXUS_LANGUAGE: "en" };
  let serial = 0;
  async function call(method, path, { body, kind = "agent", session = null, ctx = access.ctx } = {}) {
    const sent = { ...access.headers(kind), "Cf-Ray": RAY, ...(session === null ? {} : { "Nexus-Session": session }) };
    if (method === "POST") sent["Idempotency-Key"] = '"nw_' + (++serial).toString().padStart(12, "0") + '"';
    if (body !== undefined) sent["Content-Type"] = "application/json";
    const logs = [], originalError = console.error;
    console.error = (...args) => logs.push(args);
    let response;
    try { response = await handle(new Request("https://nexus.example.com" + path, { method, headers: sent, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env, ctx, template); }
    finally { console.error = originalError; }
    const text = await response.text();
    return { status: response.status, headers: response.headers, text, logs, data: text && /json/.test(response.headers.get("Content-Type") || "") ? JSON.parse(text) : null };
  }
  return { db, call, fail: (on) => { failing = on; } };
}

// A 200 answer: JSON, the common headers, no Problem and no error log; its
// HEAD answers the same status and headers with no body.
async function answered(call, path, label) {
  const result = await call("GET", path);
  assert.equal(result.status, 200, label);
  assert.equal(result.headers.get("Content-Type"), "application/json; charset=utf-8", label);
  for (const [name, value] of Object.entries(COMMON)) assert.equal(result.headers.get(name), value, label + " " + name);
  assert.equal(result.data.traceId, undefined, label);
  assert.equal(result.logs.length, 0, label);
  const head = await call("HEAD", path);
  assert.deepEqual([head.status, head.text, head.headers.get("Content-Type")], [200, "", "application/json; charset=utf-8"], label + " HEAD");
  return result.data;
}
// A refusal: Problem Details with its code, status and trace, and one log line
// with the kind and the trace.
function refused(result, status, code, label) {
  assert.equal(result.status, status, label);
  assert.equal(result.headers.get("Content-Type"), "application/problem+json", label);
  for (const [name, value] of Object.entries(COMMON)) assert.equal(result.headers.get(name), value, label + " " + name);
  assert.equal(result.data.code, code, label);
  assert.equal(result.data.status, status, label);
  assert.equal(result.data.traceId, RAY, label);
  assert.equal(result.logs.length, 1, label);
  assert.deepEqual(result.logs[0][1], { kind: code, traceId: RAY }, label);
}

// A write of the user, or of the agent's session s-1.
const say = async (call, kind, path, body) => {
  const result = await call("POST", path, { kind, body, session: kind === "agent" ? "s-1" : null });
  assert.ok([200, 201].includes(result.status), `${path}: ${result.status} ${result.text}`);
  return result.data;
};
const agentOf = (home, project) => home.agent.find((row) => row.project === project);
const cardOf = (home, project) => home.projects.find((row) => row.name === project);
const talkOf = async (call, project, stage = "05-erd") => (await call("GET", `/api/spaces/${project}/talk/sample/${stage}`)).data;
const stageOf = async (call, project, stage = "05-erd", part = "sample") => (await call("GET", `/api/spaces/${project}/stages/${part}/${stage}`)).data;
const home = async (call) => (await call("GET", "/api/home")).data;
const at = (text) => Date.parse(text);

test("TC-1413 and TC-1414: the card and the stage's project name the last push, its commit and the agent's last read, or that there is none", async (t) => {
  const { call } = inProcess();
  t.mock.timers.enable({ apis: ["Date"], now: at("2026-11-20T09:00:00.000Z") });
  assert.equal((await call("POST", "/api/snapshots", { body: shop("acme") })).status, 200);
  assert.equal((await call("POST", "/api/snapshots", { body: shop("beta") })).status, 200);
  assert.equal((await call("POST", "/api/snapshots", { body: legacy("legacy-shop") })).status, 200);
  t.mock.timers.tick(5 * 60000);
  assert.equal((await call("GET", "/api/spaces/acme/todo", { session: "s-1" })).data.read_at, "2026-11-20T09:05:00.000Z");

  const first = await home(call);
  // TC-1413: the push at 09:00 by the server's clock, from abc1234, and the read at 09:05.
  assert.deepEqual([cardOf(first, "acme").pushed_at, cardOf(first, "acme").commit.slice(0, 7)], ["2026-11-20T09:00:00.000Z", "abc1234"]);
  assert.deepEqual(agentOf(first, "acme").read_at, "2026-11-20T09:05:00.000Z");
  const stage = await stageOf(call, "acme");
  assert.deepEqual([stage.project.pushed_at, stage.project.commit.slice(0, 7), stage.project.space, stage.project.read_at],
    ["2026-11-20T09:00:00.000Z", "abc1234", true, "2026-11-20T09:05:00.000Z"]);
  // TC-1414: a project that the agent never read has no last read, in both answers.
  assert.equal(agentOf(first, "beta").read_at, null);
  assert.deepEqual([(await stageOf(call, "beta")).project.space, (await stageOf(call, "beta")).project.read_at], [true, null]);
  // A project without a space has no entry in agent, and its stage says so.
  assert.equal(agentOf(first, "legacy-shop"), undefined);
  assert.deepEqual(cardOf(first, "legacy-shop").commit, null);
  const none = (await stageOf(call, "legacy-shop", "02-prd", "_")).project;
  assert.deepEqual([none.space, none.read_at, none.unread_since, none.commit], [false, null, null, null]);
});

test("TC-1415: an entry that has waited since 08:00 yesterday after a read at 07:00 is the time from which a wait of more than 24 hours shows", async (t) => {
  const { call } = inProcess();
  t.mock.timers.enable({ apis: ["Date"], now: at("2026-11-19T07:00:00.000Z") });
  assert.equal((await call("POST", "/api/snapshots", { body: shop("acme") })).status, 200);
  assert.equal((await call("GET", "/api/spaces/acme/todo")).status, 200);
  t.mock.timers.tick(60 * 60000);
  const comment = await say(call, "user", "/api/spaces/acme/comments", USER_COMMENT("Use the glossary's word for this table."));
  assert.equal(comment.last_at, "2026-11-19T08:00:00.000Z");
  t.mock.timers.tick(25 * 60 * 60000);
  const today = await home(call);
  assert.deepEqual(agentOf(today, "acme"), { ...agentOf(today, "acme"), read_at: "2026-11-19T07:00:00.000Z", unread: 1, unread_since: "2026-11-19T08:00:00.000Z" });
  assert.equal(today.generated_at, "2026-11-20T09:00:00.000Z", "the first page opens at 09:00 today");
  assert.equal((await stageOf(call, "acme")).project.unread_since, "2026-11-19T08:00:00.000Z", "the workspace's head has the same time");
});

test("TC-1417 to TC-1419: the user's reply after the read is not read yet until the agent's next read, and a claim shows as taken without the mark", async (t) => {
  const { call } = inProcess();
  t.mock.timers.enable({ apis: ["Date"], now: at("2026-11-20T09:00:00.000Z") });
  assert.equal((await call("POST", "/api/snapshots", { body: shop("acme") })).status, 200);
  const comment = await say(call, "user", "/api/spaces/acme/comments", USER_COMMENT("Should a claim end early?"));
  t.mock.timers.tick(30 * 60000);
  await say(call, "agent", `/api/spaces/acme/comments/${comment.id}/replies`, { text: "Only when the session releases it." });
  t.mock.timers.tick(30 * 60000);
  assert.equal((await call("GET", "/api/spaces/acme/todo")).data.read_at, "2026-11-20T10:00:00.000Z");
  t.mock.timers.tick(5 * 60000);
  await say(call, "user", `/api/spaces/acme/comments/${comment.id}/replies`, { text: "Say so in the row." });

  // TC-1417: the comment is under the agent's turn, not read yet, and the first page counts it.
  let talk = await talkOf(call, "acme");
  assert.deepEqual(talk.agent.entries.map((entry) => [entry.id, entry.unread, entry.claim]), [[comment.id, true, null]]);
  assert.deepEqual(talk.agent.entries[0].last_at, "2026-11-20T10:05:00.000Z");
  let counts = agentOf(await home(call), "acme");
  assert.deepEqual([counts.read_at, counts.unread, counts.unread_since], ["2026-11-20T10:00:00.000Z", 1, "2026-11-20T10:05:00.000Z"]);

  // TC-1418: the agent's read at 10:10, then the page reads again: no mark.
  t.mock.timers.tick(5 * 60000);
  assert.equal((await call("GET", "/api/spaces/acme/todo")).data.read_at, "2026-11-20T10:10:00.000Z");
  talk = await talkOf(call, "acme");
  assert.deepEqual(talk.agent.entries.map((entry) => [entry.id, entry.unread]), [[comment.id, false]]);
  counts = agentOf(await home(call), "acme");
  assert.deepEqual([counts.read_at, counts.unread, counts.unread_since], ["2026-11-20T10:10:00.000Z", 0, null]);
  assert.equal((await stageOf(call, "acme")).project.unread_since, null);

  // TC-1419: another reply of the user, which a session claims: taken, without the mark.
  t.mock.timers.tick(5 * 60000);
  await say(call, "user", `/api/spaces/acme/comments/${comment.id}/replies`, { text: "And in the screen's row." });
  assert.equal((await talkOf(call, "acme")).agent.entries[0].unread, true, "not read yet before the claim");
  t.mock.timers.tick(5 * 60000);
  assert.equal((await call("POST", `/api/spaces/acme/claims/${comment.id}`, { body: {}, session: "s-2" })).status, 200);
  talk = await talkOf(call, "acme");
  assert.deepEqual([talk.agent.entries[0].unread, talk.agent.entries[0].claim.claimed_at], [false, "2026-11-20T10:20:00.000Z"]);
  counts = agentOf(await home(call), "acme");
  assert.deepEqual([counts.unread, counts.unread_since, counts.taken], [0, null, 1]);
  // When the claim ends, the entry is not read yet again until the agent's next read.
  t.mock.timers.tick(2 * 60 * 60000);
  assert.equal((await talkOf(call, "acme")).agent.entries[0].unread, true);
  assert.equal(agentOf(await home(call), "acme").unread, 1);
});

test("TC-1420: in a space that was never read every entry that waits for the agent is not read yet, and none that waits for the user", async () => {
  const { call } = inProcess();
  assert.equal((await call("POST", "/api/snapshots", { body: shop("acme", { opened: true }) })).status, 200);
  const comment = await say(call, "user", "/api/spaces/acme/comments", USER_COMMENT("Use the glossary's word for this table."));
  const asked = await say(call, "agent", "/api/spaces/acme/comments", USER_COMMENT("Should the column be unique?"));
  const proposal = await say(call, "agent", "/api/spaces/acme/proposals", { part: "sample", stage: "05-erd", items: ["TBL-001"], reason: "The glossary names it orders.", change: "Rename the table." });
  const edit = (await say(call, "user", `/api/spaces/acme/proposals/${proposal.id}/accept`, {})).edit;
  const checkpoint = await say(call, "user", "/api/spaces/acme/checkpoints", { part: "sample", stage: "01-domain" });
  const talk = await talkOf(call, "acme");
  assert.deepEqual(talk.agent.entries.map((entry) => [entry.id, entry.unread]), [[comment.id, true]]);
  assert.deepEqual(talk.mine.entries.map((entry) => [entry.comment.id, entry.comment.unread]), [[asked.id, false]], "the agent's question waits for the user");
  assert.deepEqual(talk.reflections.map((entry) => [entry.id, entry.state, entry.unread]), [[edit.id, "pending", true]]);
  const counts = agentOf(await home(call), "acme");
  // The comment, the push's discrepancy, the pending reflection and the passed checkpoint.
  assert.deepEqual([counts.read_at, counts.comments.total, counts.discrepancies.total, counts.reflections.total, counts.checkpoints.total, counts.unread],
    [null, 1, 1, 1, 1, 4]);
  // The oldest of their times: the discrepancy opened with the push.
  const todo = (await call("GET", "/api/spaces/acme/todo", { kind: "user" })).data;
  const times = [todo.comments.entries[0].last_at, todo.discrepancies.entries[0].opened_at, todo.reflections.entries[0].made_at, todo.checkpoints.entries[0].passed_at];
  assert.equal(counts.unread_since, times.sort()[0]);
  assert.deepEqual([todo.comments.entries[0].unread, todo.reflections.entries[0].unread], [true, true], "a person's read of the to-do gives the same marks and records nothing");
  assert.equal(todo.checkpoints.entries[0].id, checkpoint.id);
  // A reflection in review waits for its pull request, so it is not unread.
  await say(call, "agent", `/api/spaces/acme/edits/${edit.id}/report`, { event: "opened", pull_request: "https://github.com/example/qa-shop/pull/1" });
  assert.deepEqual((await talkOf(call, "acme")).reflections.map((entry) => [entry.state, entry.unread]), [["in-review", false]]);
  assert.equal(agentOf(await home(call), "acme").unread, 3);
});

test("SPEC-189: a checkpoint withdrawn after the agent's read waits since its withdrawal while its open pull request keeps it in the to-do", async (t) => {
  const { call } = inProcess();
  t.mock.timers.enable({ apis: ["Date"], now: at("2026-11-20T09:00:00.000Z") });
  assert.equal((await call("POST", "/api/snapshots", { body: shop("acme") })).status, 200);
  const checkpoint = await say(call, "user", "/api/spaces/acme/checkpoints", { part: "sample", stage: "01-domain" });
  assert.equal(checkpoint.passed_at, "2026-11-20T09:00:00.000Z");
  let counts = agentOf(await home(call), "acme");
  assert.deepEqual([counts.unread, counts.unread_since], [1, "2026-11-20T09:00:00.000Z"], "passed, it waits since its pass");
  t.mock.timers.tick(30 * 60000);
  await say(call, "agent", `/api/spaces/acme/checkpoints/${checkpoint.id}/report`, { event: "opened", pull_request: "https://github.com/example/qa-shop/pull/2" });
  t.mock.timers.tick(30 * 60000);
  assert.equal((await call("GET", "/api/spaces/acme/todo")).data.read_at, "2026-11-20T10:00:00.000Z");
  counts = agentOf(await home(call), "acme");
  assert.deepEqual([counts.checkpoints.total, counts.unread, counts.unread_since], [1, 0, null], "read at 10:00");
  t.mock.timers.tick(60 * 60000);
  const withdrawn = (await say(call, "user", `/api/spaces/acme/checkpoints/${checkpoint.id}/withdraw`, {})).checkpoint;
  assert.deepEqual([withdrawn.state, withdrawn.withdrawn_at, withdrawn.pr_state], ["withdrawn", "2026-11-20T11:00:00.000Z", "open"]);
  counts = agentOf(await home(call), "acme");
  assert.deepEqual([counts.checkpoints.total, counts.unread, counts.unread_since], [1, 1, "2026-11-20T11:00:00.000Z"],
    "withdrawn after the read, it is not read yet since its withdrawal, though it passed before the read");
  assert.equal((await stageOf(call, "acme")).project.unread_since, "2026-11-20T11:00:00.000Z", "API-158 alike");
});

test("TC-1621 to TC-1626: each response of API-151", async () => {
  const empty = inProcess();
  // TC-1622: a server without snapshots.
  const nothing = await answered(empty.call, "/api/home", "TC-1622 empty-server");
  assert.deepEqual({ ...nothing, generated_at: null }, { generated_at: null, my_turn: { total: 0, entries: [] }, agent: [], projects: [] });

  const { db, call, fail } = inProcess();
  assert.equal((await call("POST", "/api/snapshots", { body: shop("acme") })).status, 200);
  assert.equal((await call("GET", "/api/spaces/acme/todo")).status, 200);
  await pause(2);
  await say(call, "agent", "/api/spaces/acme/comments", REQUEST);
  const question = await say(call, "user", "/api/spaces/acme/comments", USER_COMMENT("Should the column be unique?"));
  // TC-1621: my turn, the agent's counts with the last read and what it has not read, and the card.
  const before = shape(db);
  const waiting = await answered(call, "/api/home", "TC-1621 waiting");
  assert.equal(shape(db), before, "TC-1621: GET and HEAD change nothing");
  assert.deepEqual(waiting.my_turn.entries.map((entry) => [entry.kind, entry.asks]), [["comment", "checkpoint"]]);
  const counts = agentOf(waiting, "acme");
  assert.deepEqual(Object.keys(counts), ["project", "comments", "discrepancies", "reflections", "checkpoints", "taken", "read_at", "unread", "unread_since"]);
  assert.deepEqual([counts.comments.total, counts.unread, counts.unread_since], [1, 1, question.last_at]);
  assert.ok(counts.read_at < question.last_at);
  assert.deepEqual([cardOf(waiting, "acme").commit, typeof cardOf(waiting, "acme").pushed_at], [COMMIT, "string"]);

  for (const [label, status, code, method, options] of [
    ["TC-1623 access-missing", 403, "access_missing", "GET", { ctx: {} }],
    ["TC-1624 access-other-app", 403, "access_other_app", "GET", { ctx: { access: { aud: "unrelated-synthetic-audience" } } }],
    ["TC-1625 internal", 500, "internal", "GET", {}],
    ["TC-1626 method-not-allowed", 405, "method_not_allowed", "POST", {}],
  ]) {
    fail(code === "internal");
    const result = await call(method, "/api/home", options);
    fail(false);
    refused(result, status, code, label);
    if (status === 405) assert.equal(result.headers.get("Allow"), "GET, HEAD", label);
    assert.equal(shape(db), before, label + ": no data changes");
  }
});

test("TC-1627 to TC-1635: each response of API-158", async () => {
  const { db, call, fail } = inProcess();
  assert.equal((await call("POST", "/api/snapshots", { body: shop("acme") })).status, 200);
  assert.equal((await call("GET", "/api/spaces/acme/todo")).status, 200);
  await pause(2);
  const request = await say(call, "agent", "/api/spaces/acme/comments", REQUEST);
  const question = await say(call, "user", "/api/spaces/acme/comments", { ...USER_COMMENT("Say what the page shows after a refused pass.", "SPEC-194"), stage: "04-functional-spec" });
  const path = "/api/spaces/acme/stages/sample/04-functional-spec";
  const before = shape(db);
  // TC-1627: stage 04 while its checkpoint request is open, with the space's
  // last read and the oldest entry that the agent has not read.
  const stage = await answered(call, path, "TC-1627 spec-with-a-request");
  assert.equal(shape(db), before, "TC-1627: GET and HEAD change nothing");
  assert.deepEqual(Object.keys(stage.project), ["name", "title", "repository", "commit", "generated_at", "pushed_at", "space", "read_at", "unread_since", "parts"]);
  assert.deepEqual([stage.project.space, stage.project.unread_since], [true, question.last_at]);
  assert.ok(stage.project.read_at < request.last_at);
  assert.deepEqual(stage.record.comments.entries.map((entry) => [entry.id, entry.asks, entry.unread]),
    [[question.id, null, true], [request.id, "checkpoint", false]]);

  for (const [label, status, code, method, url, options] of [
    ["TC-1628 invalid-after", 400, "invalid_request", "GET", path + "?after=-1", {}],
    ["TC-1629 access-missing", 403, "access_missing", "GET", path, { ctx: {} }],
    ["TC-1630 access-other-app", 403, "access_other_app", "GET", path, { ctx: { access: { aud: "unrelated-synthetic-audience" } } }],
    ["TC-1631 part-not-found", 404, "part_not_found", "GET", "/api/spaces/acme/stages/billing/04-functional-spec", {}],
    ["TC-1632 project-not-found", 404, "project_not_found", "GET", "/api/spaces/missing-shop/stages/sample/04-functional-spec", {}],
    ["TC-1633 no-such-stage", 404, "not_found", "GET", "/api/spaces/acme/stages/sample/14-other", {}],
    ["TC-1634 internal", 500, "internal", "GET", path, {}],
    ["TC-1635 method-not-allowed", 405, "method_not_allowed", "POST", path, {}],
  ]) {
    fail(code === "internal");
    const result = await call(method, url, options);
    fail(false);
    refused(result, status, code, label);
    if (code === "invalid_request") assert.equal(result.data.field, "after", label);
    if (status === 405) assert.equal(result.headers.get("Allow"), "GET, HEAD", label);
    assert.equal(shape(db), before, label + ": no data changes");
  }
});

test("TC-1636 to TC-1646: each response of API-152", async () => {
  const { db, call, fail } = inProcess();
  assert.equal((await call("POST", "/api/snapshots", { body: shop("acme") })).status, 200);
  assert.equal((await call("POST", "/api/snapshots", { body: legacy("legacy-shop") })).status, 200);
  assert.equal((await call("GET", "/api/spaces/acme/todo")).status, 200);
  await pause(2);
  const request = await say(call, "agent", "/api/spaces/acme/comments", REQUEST);
  const fresh = await say(call, "user", "/api/spaces/acme/comments", { ...USER_COMMENT("Say what the page shows after a refused pass.", "SPEC-194"), stage: "04-functional-spec" });
  const taken = await say(call, "user", "/api/spaces/acme/comments", { ...USER_COMMENT("Is ten lines enough?", "SPEC-194"), stage: "04-functional-spec" });
  assert.equal((await call("POST", `/api/spaces/acme/claims/${taken.id}`, { body: {}, session: "s-2" })).status, 200);
  const path = "/api/spaces/acme/talk/sample/04-functional-spec";
  const before = shape(db);
  // TC-1636: the open request in my turn, and in the agent's turn an entry
  // that the agent has not read and one that a session holds.
  const talk = await answered(call, path, "TC-1636 by-turn");
  assert.equal(shape(db), before, "TC-1636: GET and HEAD change nothing");
  assert.deepEqual(talk.mine.entries.map((entry) => [entry.comment.id, entry.comment.unread, entry.comment.look_first]), [[request.id, false, "SPEC-194"]]);
  assert.deepEqual(talk.agent.entries.map((entry) => [entry.id, entry.unread, entry.claim === null]), [[fresh.id, true, true], [taken.id, false, false]]);
  // TC-1637: a stage without talk.
  const nothing = await answered(call, "/api/spaces/acme/talk/sample/13-presentation", "TC-1637 nothing-yet");
  assert.deepEqual(nothing, { project: "acme", part: "sample", stage: "13-presentation", item: null, mine: { total: 0, entries: [] },
    agent: { total: 0, entries: [] }, apart: { total: 0, entries: [] }, closed: { total: 0, entries: [] }, reflections: [] });

  for (const [label, status, code, method, url, options] of [
    ["TC-1638 invalid-after", 400, "invalid_request", "GET", path + "?closed=1&after=-1", {}],
    ["TC-1639 access-missing", 403, "access_missing", "GET", path, { ctx: {} }],
    ["TC-1640 access-other-app", 403, "access_other_app", "GET", path, { ctx: { access: { aud: "unrelated-synthetic-audience" } } }],
    ["TC-1641 space-not-found", 404, "space_not_found", "GET", "/api/spaces/legacy-shop/talk/_/02-prd", {}],
    ["TC-1642 project-not-found", 404, "project_not_found", "GET", "/api/spaces/missing-shop/talk/sample/04-functional-spec", {}],
    ["TC-1643 part-not-found", 404, "part_not_found", "GET", "/api/spaces/acme/talk/billing/04-functional-spec", {}],
    ["TC-1644 no-such-stage", 404, "not_found", "GET", "/api/spaces/acme/talk/sample/14-other", {}],
    ["TC-1645 internal", 500, "internal", "GET", path, {}],
    ["TC-1646 method-not-allowed", 405, "method_not_allowed", "POST", path, {}],
  ]) {
    fail(code === "internal");
    const result = await call(method, url, options);
    fail(false);
    refused(result, status, code, label);
    if (code === "invalid_request") assert.equal(result.data.field, "after", label);
    if (status === 405) assert.equal(result.headers.get("Allow"), "GET, HEAD", label);
    assert.equal(shape(db), before, label + ": no data changes");
  }
});

// The standalone server: real TCP, RSA signatures checked, SQLite through
// sqlite.js on an in-memory database.
async function standalone(t) {
  const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const jwk = { ...await crypto.subtle.exportKey("jwk", pair.publicKey), kid: "synthetic", alg: "RS256" };
  const env = { ACCESS_AUD: "synthetic-audience", ACCESS_TEAM_DOMAIN: "access.example.com", NEXUS_LANGUAGE: "en" };
  const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const sign = async (identity) => {
    const content = b64({ alg: "RS256", kid: jwk.kid }) + "." + b64({ iss: "https://access.example.com", aud: [env.ACCESS_AUD], exp: Math.floor(Date.now() / 1000) + 600, ...identity });
    return content + "." + Buffer.from(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(content))).toString("base64url");
  };
  const tokens = { user: await sign({ sub: "synthetic-person" }), agent: await sign({ sub: "", common_name: "synthetic-client" }) };
  const db = new SQLiteD1(":memory:");
  const verifier = new AccessVerifier({ requireContext: false, fetcher: async () => Response.json({ keys: [jwk] }) });
  const server = createNodeServer({ env: { ...env, DB: db }, origin: "https://nexus.example.com", template, verifier });
  await server.start();
  t.after(async () => { await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }); db.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  let serial = 0;
  async function call(method, path, { body, kind = "agent", session = null } = {}) {
    const headers = { "Cf-Access-Jwt-Assertion": tokens[kind], ...(session === null ? {} : { "Nexus-Session": session }) };
    if (method === "POST") headers["Idempotency-Key"] = '"nw_' + (++serial).toString().padStart(12, "0") + '"';
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await httpFetch(base + path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await response.text();
    return { status: response.status, text, data: text ? JSON.parse(text) : null };
  }
  return { call };
}

test("TC-1750: what counts as not yet read, before and after the agent's read, in a space with a recorded read and in one never read, on the standalone server", async (t) => {
  const { call } = await standalone(t);
  for (const [project, read] of [["acme", true], ["beta", false]]) {
    assert.equal((await call("POST", "/api/snapshots", { body: shop(project) })).status, 200);
    if (read) assert.equal((await call("GET", `/api/spaces/${project}/todo`, { session: "s-1" })).status, 200);
    await pause(2);
    const space = `/api/spaces/${project}`;
    const waiting = await say(call, "user", space + "/comments", USER_COMMENT("Use the glossary's word for this table."));
    const claimed = await say(call, "user", space + "/comments", USER_COMMENT("Should a claim end early?"));
    assert.equal((await call("POST", `${space}/claims/${claimed.id}`, { body: {}, session: "s-2" })).status, 200);
    const question = await say(call, "agent", space + "/comments", USER_COMMENT("Should the column be unique?"));
    const closed = await say(call, "user", space + "/comments", USER_COMMENT("Done?"));
    assert.equal((await call("POST", `${space}/comments/${closed.id}/answered`, { body: {}, session: "s-1" })).status, 200);
    // The board's aggregate keeps a term that no table names: the push opens a discrepancy.
    await pause(2);
    assert.equal((await call("POST", "/api/snapshots", { body: shop(project, { opened: true }) })).status, 200);
    const opened_at = (await call("GET", space + "/todo", { kind: "user" })).data.discrepancies.entries[0].opened_at;

    const label = read ? "a space with a recorded read" : "a space never read";
    const talk = await talkOf(call, project);
    const marks = Object.fromEntries([...talk.mine.entries.map((entry) => entry.comment), ...talk.agent.entries].map((entry) => [entry.id, entry.unread]));
    assert.deepEqual(marks, { [waiting.id]: true, [claimed.id]: false, [question.id]: false }, label + ": only the comment that waits for the agent and that no session holds");
    const closedTalk = (await call("GET", `${space}/talk/sample/05-erd?closed=1`)).data.closed.entries;
    assert.deepEqual(closedTalk.map((entry) => [entry.comment.id, entry.comment.unread]), [[closed.id, false]], label + ": a closed comment is never unread");
    const counts = agentOf(await home(call), project);
    const since = [waiting.last_at, opened_at].sort()[0];
    assert.deepEqual([counts.unread, counts.unread_since], [2, since], label + ": the first page counts it and the discrepancy");
    assert.equal((await stageOf(call, project)).project.unread_since, since, label + ": API-158 alike");
    if (!read) assert.equal(counts.read_at, null);

    assert.equal((await call("GET", space + "/todo", { session: "s-1" })).status, 200);
    const after = agentOf(await home(call), project);
    assert.deepEqual([after.unread, after.unread_since], [0, null], label + ": after the read");
    assert.equal((await stageOf(call, project)).project.unread_since, null);
    assert.deepEqual((await talkOf(call, project)).agent.entries.map((entry) => entry.unread), [false, false]);
    // No answer holds a mark of 24 hours: the page works it out from unread_since.
    assert.deepEqual(Object.keys(after), ["project", "comments", "discrepancies", "reflections", "checkpoints", "taken", "read_at", "unread", "unread_since"]);
  }
});
