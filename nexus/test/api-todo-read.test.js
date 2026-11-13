// API-113 getAgentTodo with the agent's read recorded (TASK-296, SPEC-187):
// SPEC-187's criteria (TC-1408 to TC-1412), each response of API-113 (TC-1504
// to TC-1512), the reads under each sign-in on the standalone server (TC-1748)
// and a read while a comment is written (TC-1749). Synthetic projects only;
// the Access keys are generated here and every database is in memory.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { AccessVerifier } from "../src/access.js";
import { handle } from "../src/app.js";
import { createNodeServer } from "../src/node-server.js";
import { readSnapshot02 } from "../src/snapshot02.js";
import { SQLiteD1 } from "../src/sqlite.js";
import { Store } from "../src/store.js";
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
// A project that only a hub of 0.1 pushed, which has a snapshot and no space.
const legacy = (name) => ({ schema: "corthex-hub/0.1", generated_at: "2026-01-12T10:00:00+09:00", project: { name, title: "Legacy shop" },
  stages: { "02-prd": { source_state: "found", read: true, state: "in_progress", next: "Write the PRD" } }, summary: { items: 1 },
  items: [{ id: "REQ-001", kind: "requirement", stage: "02-prd", title: "Send an order confirmation", priority: "Must" }], checks: [] });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function shape(db) {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => row.name);
  return createHash("sha256").update(JSON.stringify(tables.map((name) => [name, db.prepare(`SELECT * FROM "${name}"`).all().map((row) => JSON.stringify(row)).sort()]))).digest("hex");
}
const lastRead = (db, project) => {
  const row = db.prepare("SELECT read_at, read_session FROM project_spaces WHERE project = ?").get(project);
  return row ? { ...row } : null;
};

// The server as the Worker build runs it, in this process: handle() over D1's
// interface on an in-memory SQLite database.
function inProcess({ batch } = {}) {
  const db = new DatabaseSync(":memory:");
  const binding = fakeD1(db);
  if (batch) binding.batch = batch(binding.batch.bind(binding));
  const env = { ...access.env, DB: binding, NEXUS_LANGUAGE: "en" };
  let serial = 0;
  async function call(method, path, { body, kind = "agent", session = "s-1", ctx = access.ctx, headers = {} } = {}) {
    const sent = { ...access.headers(kind), "Cf-Ray": RAY, ...(session === null ? {} : { "Nexus-Session": session }), ...headers };
    if (method === "POST") sent["Idempotency-Key"] = '"nw_' + (++serial).toString().padStart(12, "0") + '"';
    if (body !== undefined) sent["Content-Type"] = "application/json";
    const logs = [], original = console.error;
    console.error = (...args) => logs.push(args);
    let response;
    try { response = await handle(new Request("https://nexus.example.com" + path, { method, headers: sent, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env, ctx, template); }
    finally { console.error = original; }
    const text = await response.text();
    return { status: response.status, headers: response.headers, text, logs, data: text && /json/.test(response.headers.get("Content-Type") || "") ? JSON.parse(text) : null };
  }
  return { db, call };
}

// A 200 answer: JSON, the common headers, no Problem and no error log.
function answered(result, label) {
  assert.equal(result.status, 200, label);
  assert.equal(result.headers.get("Content-Type"), "application/json; charset=utf-8", label);
  for (const [name, value] of Object.entries(COMMON)) assert.equal(result.headers.get(name), value, label + " " + name);
  assert.equal(result.data.traceId, undefined, label);
  assert.equal(result.logs.length, 0, label);
}
// A refusal: Problem Details with its code, status and trace, one log line
// with the kind and the trace, and nothing changed.
function refused(result, status, code, label) {
  assert.equal(result.status, status, label);
  assert.equal(result.headers.get("Content-Type"), "application/problem+json", label);
  for (const [name, value] of Object.entries(COMMON)) assert.equal(result.headers.get(name), value, label + " " + name);
  assert.equal(result.data.code, code, label);
  assert.equal(result.data.status, status, label);
  assert.equal(result.data.traceId, RAY, label);
  for (const list of ["comments", "discrepancies", "reflections", "checkpoints"]) assert.equal(result.data[list], undefined, label + " holds no list");
  assert.equal(result.logs.length, 1, label);
  assert.deepEqual(result.logs[0][1], { kind: code, traceId: RAY }, label);
}

test("TC-1408 to TC-1410: the agent's read records the server's time and its label, a later read replaces it, a person's read records nothing", async (t) => {
  const { db, call } = inProcess();
  assert.equal((await call("POST", "/api/snapshots", { body: viewSnapshot("acme") })).status, 200);
  assert.deepEqual(lastRead(db, "acme"), { read_at: null, read_session: null }, "a new space was never read");
  // The server's clock reads 10:00; the Access verifier keeps the real clock.
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-11-20T10:00:00.000Z") });
  const first = await call("GET", "/api/spaces/acme/todo", { session: "s-1" });
  answered(first, "TC-1408");
  assert.equal(first.data.read_at, "2026-11-20T10:00:00.000Z", "TC-1408: the answer names 10:00");
  assert.equal(first.data.session, "s-1");
  assert.deepEqual(lastRead(db, "acme"), { read_at: "2026-11-20T10:00:00.000Z", read_session: "s-1" }, "TC-1408: the space's last read is 10:00 with s-1");
  t.mock.timers.tick(5 * 60000);
  const second = await call("GET", "/api/spaces/acme/todo", { session: null });
  answered(second, "TC-1409");
  assert.equal(second.data.read_at, "2026-11-20T10:05:00.000Z", "TC-1409: the later time");
  assert.equal(second.data.session, null);
  assert.deepEqual(lastRead(db, "acme"), { read_at: "2026-11-20T10:05:00.000Z", read_session: null }, "TC-1409: the later read replaces the first, with no label");
  t.mock.timers.tick(5 * 60000);
  const before = shape(db);
  for (const session of [null, "s-2"]) {
    const person = await call("GET", "/api/spaces/acme/todo", { kind: "user", session });
    answered(person, "TC-1410");
    assert.equal(person.data.read_at, null, "TC-1410: a person's read names null");
  }
  assert.equal(shape(db), before, "TC-1410: a person's read changes nothing");
  assert.deepEqual(lastRead(db, "acme"), { read_at: "2026-11-20T10:05:00.000Z", read_session: null }, "TC-1410: the last read does not change");
});

test("TC-1504: the agent's read with a comment, a reflection and two checkpoints that wait changes only the space's last read", async () => {
  const { db, call } = inProcess();
  assert.equal((await call("POST", "/api/snapshots", { body: viewSnapshot("acme") })).status, 200);
  const comment = await call("POST", "/api/spaces/acme/comments", { kind: "user", session: null, body: { part: "sample", stage: "05-erd", item: "TBL-001", text: "Use the glossary's word for this table." } });
  assert.equal(comment.status, 201);
  const proposal = await call("POST", "/api/spaces/acme/proposals", { body: { part: "sample", stage: "05-erd", items: ["TBL-001"], reason: "The glossary names it orders.", change: "Rename the table." } });
  const accepted = await call("POST", `/api/spaces/acme/proposals/${proposal.data.id}/accept`, { kind: "user", session: null });
  assert.equal(accepted.status, 200);
  for (const stage of ["01-domain", "04-functional-spec"])
    assert.equal((await call("POST", "/api/spaces/acme/checkpoints", { kind: "user", session: null, body: { part: "sample", stage } })).status, 201);
  const before = db.prepare("SELECT * FROM project_spaces").all().map((row) => ({ ...row }));
  const others = shape(db);
  const read = await call("GET", "/api/spaces/acme/todo", { session: "claude-code-4f2a91" });
  answered(read, "TC-1504");
  assert.deepEqual(Object.keys(read.data), ["project", "default_commit", "session", "read_at", "comments", "discrepancies", "reflections", "checkpoints", "waiting_for_user", "taken"]);
  assert.match(read.data.read_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.deepEqual([read.data.comments.total, read.data.reflections.total, read.data.checkpoints.total], [1, 1, 2]);
  assert.equal(read.data.comments.entries[0].id, comment.data.id);
  assert.equal(read.data.reflections.entries[0].id, accepted.data.edit.id);
  // Both checkpoints were passed without the revision's columns, which TASK-299
  // and TASK-301 write: as one passed before the revision is stored.
  for (const checkpoint of db.prepare("SELECT snapshot_revision, entry, browser, device, driven FROM checkpoints").all())
    assert.deepEqual({ ...checkpoint }, { snapshot_revision: null, entry: null, browser: null, device: null, driven: null });
  const after = db.prepare("SELECT * FROM project_spaces").all().map((row) => ({ ...row }));
  assert.deepEqual(after, before.map((row) => ({ ...row, read_at: read.data.read_at, read_session: "claude-code-4f2a91" })), "only the space's last read changes");
  db.prepare("UPDATE project_spaces SET read_at = NULL, read_session = NULL").run();
  assert.equal(shape(db), others, "no other row changes");
});

test("TC-1505: a read under a person's own sign-in where nothing waits records no read", async () => {
  const { db, call } = inProcess();
  assert.equal((await call("POST", "/api/snapshots", { body: viewSnapshot("acme") })).status, 200);
  const before = shape(db);
  const read = await call("GET", "/api/spaces/acme/todo", { kind: "user", session: null });
  answered(read, "TC-1505");
  assert.deepEqual(read.data, { project: "acme", default_commit: "a".repeat(40), session: null, read_at: null,
    comments: { total: 0, entries: [] }, discrepancies: { total: 0, entries: [] }, reflections: { total: 0, entries: [] },
    checkpoints: { total: 0, entries: [] }, waiting_for_user: 0, taken: 0 });
  assert.equal(shape(db), before, "nothing changes, and no read is recorded");
});

test("TC-1412 and TC-1506 to TC-1512: each refusal of API-113 records nothing", async () => {
  // TC-1511: the record cannot be written. Its batch fails, so no list is answered.
  let failing = false;
  const { db, call } = inProcess({ batch: (original) => async (statements) => {
    if (failing && statements.some((statement) => /^UPDATE project_spaces SET read_at/.test(statement.sql))) throw new Error("synthetic write failure");
    return original(statements);
  } });
  assert.equal((await call("POST", "/api/snapshots", { body: viewSnapshot("acme") })).status, 200);
  assert.equal((await call("POST", "/api/snapshots", { body: legacy("legacy-shop") })).status, 200);
  const cases = [
    ["TC-1506 bad-session", 400, "invalid_request", "GET", "/api/spaces/acme/todo", { session: "bad session" }],
    ["TC-1507 access-missing", 403, "access_missing", "GET", "/api/spaces/acme/todo", { ctx: {} }],
    ["TC-1508 access-other-app", 403, "access_other_app", "GET", "/api/spaces/acme/todo", { ctx: { access: { aud: "unrelated-synthetic-audience" } } }],
    ["TC-1412 and TC-1509 space-not-found", 404, "space_not_found", "GET", "/api/spaces/legacy-shop/todo", {}],
    ["TC-1510 project-not-found", 404, "project_not_found", "GET", "/api/spaces/missing-shop/todo", {}],
    ["TC-1511 internal", 500, "internal", "GET", "/api/spaces/acme/todo", {}],
    ["TC-1512 method-not-allowed", 405, "method_not_allowed", "POST", "/api/spaces/acme/todo", {}],
  ];
  for (const [label, status, code, method, path, options] of cases) {
    failing = label.startsWith("TC-1511");
    const before = shape(db);
    const result = await call(method, path, options);
    refused(result, status, code, label);
    if (code === "invalid_request") assert.equal(result.data.field, "Nexus-Session", label);
    if (code === "method_not_allowed") assert.equal(result.headers.get("Allow"), "GET, HEAD", label);
    assert.equal(shape(db), before, label + ": no data changes");
    assert.deepEqual(lastRead(db, "acme"), { read_at: null, read_session: null }, label + ": nothing is recorded");
  }
  assert.equal(lastRead(db, "legacy-shop"), null, "TC-1412: a project without a space has nothing to record in");
});

// The store with a gate before a request's first wait, so that a test can let
// another request's batch run in between (TC-1411, TC-1749): a write waits at
// its basis, which it reads before its batch, and a read or a push waits at the
// first read of its context. The gate todo holds the read's own batch, after
// the server has found the space.
function gatedStore() {
  const memory = new DatabaseSync(":memory:");
  const base = fakeD1(memory);
  const gates = { basis: null, context: null, push: null, todo: null };
  const wrap = (statement) => ({ sql: statement.sql, params: statement.params,
    bind: (...params) => wrap(statement.bind(...params)),
    first: async (column) => { if (column === "basis" && gates.basis) await gates.basis; return statement.first(column); },
    all: () => statement.all(), run: () => statement.run() });
  const db = { prepare: (sql) => wrap(base.prepare(sql)), batch: async (statements) => {
    const first = statements[0]?.sql || "";
    if (gates.context && first === "SELECT * FROM snapshots WHERE name=?") await gates.context;
    if (gates.push && first.startsWith("SELECT name, revision, generated_ms")) await gates.push;
    if (gates.todo && first.startsWith("UPDATE project_spaces SET read_at")) await gates.todo;
    return base.batch(statements);
  } };
  const opened = () => { let open; const gate = new Promise((resolve) => { open = resolve; }); return { gate, open }; };
  return { memory, store: new Store(db), gates, opened };
}
const writeComment = (store, write, text) => store.writeEntry("comment", "acme", null, { part: "sample", stage: "05-erd", item: "TBL-001", text },
  { kind: "user", write, language: "en" });

test("TC-1411 and TC-1749 at the store: a comment whose batch runs just before or just after the read's batch", async () => {
  const { memory, store, gates, opened } = gatedStore();
  await store.push(readSnapshot02(viewSnapshot("acme"), Date.now()));
  // Just after: the comment is sent first and waits before its batch while the
  // read is answered. It takes its time in its batch's turn, after the read's.
  let hold = opened();
  gates.basis = hold.gate;
  const late = writeComment(store, "nw_000000000001", "Sent while the server answers a read.");
  await pause(5);
  const read = await store.readTodo("acme", "s-1", { record: true });
  gates.basis = null; hold.open();
  const written = (await late).body;
  assert.equal(read.comments.entries.some((entry) => entry.id === written.id), false, "the read's lists do not hold it");
  assert.ok(written.last_at >= read.read_at, `TC-1411: it counts as not yet read (${written.last_at} at or after ${read.read_at})`);
  assert.equal(lastRead(memory, "acme").read_at, read.read_at);
  // Just before: the read is sent first and waits before its context while the
  // comment is written. It takes its time in its batch's turn, after the comment's.
  hold = opened();
  gates.context = hold.gate;
  const reading = store.readTodo("acme", "s-1", { record: true });
  await pause(5);
  const early = (await writeComment(store, "nw_000000000002", "Written just before the read's batch.")).body;
  gates.context = null; hold.open();
  const next = await reading;
  assert.ok(next.comments.entries.some((entry) => entry.id === early.id), "the read's lists hold it");
  assert.ok(early.last_at <= next.read_at, "and it was written before the read's time");
  assert.equal(lastRead(memory, "acme").read_at, next.read_at);
});

test("TC-1412 at the store: a space removed between the server's check and the read's batch is answered 404, and nothing is recorded", async () => {
  const { memory, store, gates, opened } = gatedStore();
  await store.push(readSnapshot02(viewSnapshot("acme"), Date.now()));
  const hold = opened();
  gates.todo = hold.gate;
  const reading = store.readTodo("acme", "s-1", { record: true });
  await pause(5);
  // The read has found the space and waits before its batch; the project goes.
  assert.equal(await store.remove("acme"), true);
  gates.todo = null; hold.open();
  await assert.rejects(reading, (error) => error.code === "space_not_found" && error.status === 404, "the read is the 404 of a project without a space");
  assert.equal(lastRead(memory, "acme"), null, "no space holds a read");
  assert.equal(memory.prepare("SELECT COUNT(*) AS n FROM project_spaces").get().n, 0);
});

test("A push that opens a discrepancy after the agent's read gives it a time at or after the read's", async () => {
  const { memory, store, gates, opened } = gatedStore();
  await store.push(readSnapshot02(viewSnapshot("acme"), Date.now()));
  await pause(2);
  // The board's aggregate keeps TERM-001 while no table names it: the push opens one discrepancy.
  const changed = viewSnapshot("acme");
  changed.pictures.find((picture) => picture.stage === "05-erd").source.tables[0].terms = [];
  const hold = opened();
  gates.push = hold.gate;
  const pushing = store.push(readSnapshot02(changed, Date.now()));
  await pause(5);
  const read = await store.readTodo("acme", "s-1", { record: true });
  gates.push = null; hold.open();
  assert.equal((await pushing).discrepancies.opened, 1);
  const opened_at = memory.prepare("SELECT opened_at FROM discrepancies WHERE project = 'acme'").get().opened_at;
  assert.equal(read.discrepancies.total, 0, "the read's lists do not hold it");
  assert.ok(opened_at >= read.read_at, `it counts as not yet read (${opened_at} at or after ${read.read_at})`);
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
  const verifier = new AccessVerifier({ requireContext: false, fetcher: async (url) => {
    assert.equal(url, "https://access.example.com/cdn-cgi/access/certs");
    return Response.json({ keys: [jwk] });
  } });
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
    return { status: response.status, headers: response.headers, text, data: text ? JSON.parse(text) : null };
  }
  return { db, call, memory: db.connection };
}

test("TC-1748: the agent to-do read under each sign-in, with HEAD, a bad label and no space, on the standalone server", async (t) => {
  const { call, memory } = await standalone(t);
  assert.equal((await call("POST", "/api/snapshots", { body: viewSnapshot("acme") })).status, 200);
  assert.equal((await call("POST", "/api/snapshots", { body: legacy("legacy-shop") })).status, 200);
  const first = await call("GET", "/api/spaces/acme/todo", { session: "s-1" });
  assert.equal(first.status, 200);
  assert.deepEqual(lastRead(memory, "acme"), { read_at: first.data.read_at, read_session: "s-1" }, "the read is recorded with s-1");
  await pause(5);
  const second = await call("GET", "/api/spaces/acme/todo");
  assert.equal(second.status, 200);
  assert.ok(second.data.read_at > first.data.read_at, "the second read replaces the first with a later time");
  assert.deepEqual(lastRead(memory, "acme"), { read_at: second.data.read_at, read_session: null }, "and no label");
  const before = shape(memory);
  const person = await call("GET", "/api/spaces/acme/todo", { kind: "user" });
  assert.equal(person.status, 200);
  assert.equal(person.data.read_at, null, "the user's read is answered with read_at null");
  for (const kind of ["agent", "user"]) {
    const head = await call("HEAD", "/api/spaces/acme/todo", { kind, session: "s-1" });
    assert.equal(head.status, 200, "HEAD under " + kind);
    assert.equal(head.text, "", "HEAD has no body");
  }
  const bad = await call("GET", "/api/spaces/acme/todo", { session: "bad label" });
  assert.equal(bad.status, 400);
  assert.equal(bad.data.field, "Nexus-Session");
  const none = await call("GET", "/api/spaces/legacy-shop/todo", { session: "s-1" });
  assert.equal(none.status, 404);
  assert.equal(none.data.code, "space_not_found");
  assert.equal(shape(memory), before, "the user's read, the HEADs, the 400 and the 404 record nothing");
  assert.deepEqual(lastRead(memory, "acme"), { read_at: second.data.read_at, read_session: null });
});

test("TC-1749: a comment and a read of the agent to-do sent at once, 200 times, on the standalone server", async (t) => {
  const { call, memory } = await standalone(t);
  assert.equal((await call("POST", "/api/snapshots", { body: viewSnapshot("acme") })).status, 200);
  const seen = { listed: 0, later: 0 };
  for (let run = 0; run < 200; run++) {
    // In every other run the read leaves a millisecond after the comment, so
    // that the two batches meet in either order over the runs.
    const reading = () => call("GET", "/api/spaces/acme/todo", { session: "s-1" });
    const [comment, read] = await Promise.all([
      call("POST", "/api/spaces/acme/comments", { kind: "user", body: { part: "sample", stage: "05-erd", item: "TBL-001", text: "Synthetic comment " + run } }),
      run % 2 ? pause(1).then(reading) : reading(),
    ]);
    assert.equal(comment.status, 201);
    assert.equal(read.status, 200);
    const listed = read.data.comments.entries.some((entry) => entry.id === comment.data.id);
    assert.ok(listed || comment.data.last_at >= read.data.read_at,
      `run ${run}: the comment is in the read's lists or counts as not yet read (${comment.data.last_at}, ${read.data.read_at})`);
    seen[listed ? "listed" : "later"]++;
    // The agent answers it, so that the agent's list stays under its 50 entries.
    assert.equal((await call("POST", `/api/spaces/acme/comments/${comment.data.id}/answered`, { session: "s-1" })).status, 200);
  }
  assert.equal(seen.listed + seen.later, 200);
  assert.ok(lastRead(memory, "acme").read_at, "the last read stands");
  t.diagnostic(`TC-1749: ${seen.listed} runs listed the comment, ${seen.later} gave it a time at or after the read's`);
});
