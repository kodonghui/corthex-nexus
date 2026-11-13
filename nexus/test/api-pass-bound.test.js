// API-128 passCheckpoint with the pass bound to what the user saw (TASK-301,
// SPEC-194, SPEC-196): SPEC-194's criteria (TC-1437 to TC-1441), each response
// of the operation that the contract names (TC-1570 to TC-1596), a pass after a
// push, after a newer entry of the request or while a new request is open
// (TC-1732 to TC-1734, also with the other write landing between a pass's plan
// and its batch), one write ID across a push (TC-1735), a snapshot that names no
// commit (TC-1736), a pass out of form and the server's half of a page of
// before the release (TC-1737, TC-1760), the order of the refusals (TC-1738),
// the request that a pass settles (TC-1739) and the limits of the reply that
// settles it (TC-1740). Synthetic projects only; the Access keys are generated
// here and every database is in memory.
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
const SPACE = "/api/spaces/acme";
const MIB8 = 8 * 1024 * 1024;
// The commit of the synthetic snapshot (view-fixtures.js), and another one.
const A = "a".repeat(40), B = "b".repeat(40);
const SAFARI_PHONE = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" };
const FIREFOX_DESKTOP = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0" };
const utf8 = (...texts) => texts.reduce((n, text) => n + Buffer.byteLength(text || ""), 0);
// A project that only a hub of 0.1 pushed, which has a snapshot and no space.
const legacy = (name) => ({ schema: "corthex-hub/0.1", generated_at: "2026-01-12T10:00:00+09:00", project: { name, title: "Legacy shop" },
  stages: { "02-prd": { source_state: "found", read: true, state: "in_progress", next: "Write the PRD" } }, summary: { items: 1 },
  items: [{ id: "REQ-001", kind: "requirement", stage: "02-prd", title: "Send an order confirmation", priority: "Must" }], checks: [] });

// The shop of view-fixtures.js at commit A, with items on three of the 13
// stages, among them SPEC-194, the thing that a request names to look at first.
function acme(name = "acme") {
  const data = viewSnapshot(name);
  const where = "docs/qa.md:1";
  data.ids = { ...data.ids, REQ: "requirement", SPEC: "spec" };
  data.items = [
    { id: "REQ-001", kind: "requirement", stage: "02-prd", where, title: "Send an order confirmation" },
    { id: "SPEC-194", kind: "spec", stage: "04-functional-spec", where, title: "Say what the page shows after a refused pass" },
    { id: "TBL-001", kind: "table", stage: "05-erd", where, title: "orders" }];
  data.summary = { ...data.summary, items: data.items.length };
  return data;
}
// The same snapshot at another commit, which names the held one that it replaces.
function moved(data, commit, replaces) {
  const next = structuredClone(data);
  next.repos["."].commit = commit;
  next.repos["."].default.commit = commit;
  next.records.commit = commit;
  for (const picture of next.pictures) picture.commit = commit;
  next.replaces = replaces;
  return next;
}
// A snapshot that names no commit, as a hub on a device without Git sends it.
const noCommit = (name) => ({ ...acme(name), repos: {}, records: { from: "status-file" }, pictures: [], left_out: [] });
// The agent's checkpoint request on a part's stage as a whole, in its form.
const request = (stage, extra = {}) => ({ part: "sample", stage, item: "", text: `Stage ${stage.slice(0, 2)} is ready for its checkpoint.\nLook at SPEC-194 first.`,
  asks: "checkpoint", look_first: "SPEC-194", ...extra });
// The agent's reply that asks for the checkpoint again, the request's newer entry.
const askAgain = { text: "The stage changed since.\nLook at SPEC-194 first.", asks: "checkpoint", look_first: "SPEC-194" };
// A pass that names what a page drawn at commit A showed.
const pass = (stage, extra = {}) => ({ part: "sample", stage, commit: A, ...extra });
const USER_COMMENT = { part: "sample", stage: "05-erd", item: "TBL-001", text: "Use the glossary's word for this table." };

function tables(db) {
  const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => row.name);
  return Object.fromEntries(names.map((name) => [name, createHash("sha256")
    .update(JSON.stringify(db.prepare(`SELECT * FROM "${name}"`).all().map((row) => JSON.stringify(row)).sort())).digest("hex")]));
}
const shape = (db) => createHash("sha256").update(JSON.stringify(tables(db))).digest("hex");
const changed = (before, after) => Object.keys(after).filter((name) => before[name] !== after[name]).sort();
const spaceBytes = (db) => db.prepare("SELECT text_bytes FROM project_spaces WHERE project = 'acme'").get().text_bytes;
const count = (db, table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
const row = (db, sql, ...params) => ({ ...db.prepare(sql).get(...params) });
// A comment that holds 200 replies, the most that one holds.
function fillReplies(db, id) {
  const insert = db.prepare("INSERT INTO replies (comment, seq, author, text, settles, made_at) VALUES (?, ?, 'agent', ?, 0, '2026-11-13T01:00:00.000Z')");
  db.exec("BEGIN");
  for (let seq = db.prepare("SELECT COUNT(*) AS n FROM replies WHERE comment = ?").get(id).n + 1; seq <= 200; seq++) insert.run(id, seq, "Reply " + seq);
  db.exec("COMMIT");
}

// The server as the Worker build runs it, in this process: handle() over D1's
// interface on an in-memory SQLite database. The agent writes with the label
// s-1 unless a test names another; write null sends no write ID.
function inProcess({ batch } = {}) {
  const db = new DatabaseSync(":memory:");
  const binding = fakeD1(db);
  if (batch) binding.batch = batch(binding.batch.bind(binding));
  const env = { ...access.env, DB: binding, NEXUS_LANGUAGE: "en" };
  let serial = 0;
  async function call(method, path, { body, raw, kind = "agent", session = kind === "agent" ? "s-1" : null, write, ctx = access.ctx, headers = {} } = {}) {
    const sent = { ...access.headers(kind), "Cf-Ray": RAY, ...(session === null ? {} : { "Nexus-Session": session }) };
    if (method === "POST" && write !== null) sent["Idempotency-Key"] = JSON.stringify(write || "nw_" + (++serial).toString().padStart(12, "0"));
    const payload = raw ?? (body === undefined ? undefined : JSON.stringify(body));
    if (payload !== undefined) sent["Content-Type"] = "application/json";
    Object.assign(sent, headers);
    const logs = [], original = console.error;
    console.error = (...args) => logs.push(args);
    let response;
    try { response = await handle(new Request("https://nexus.example.com" + path, { method, headers: sent, ...(payload === undefined ? {} : { body: payload }) }), env, ctx, template); }
    finally { console.error = original; }
    const text = await response.text();
    return { status: response.status, headers: response.headers, text, logs, data: text && /json/.test(response.headers.get("Content-Type") || "") ? JSON.parse(text) : null };
  }
  return { db, call };
}

// A 201 answer: JSON, the common headers, no Problem and no error log.
function created(result, label) {
  assert.equal(result.status, 201, label + ": " + result.text);
  assert.equal(result.headers.get("Content-Type"), "application/json; charset=utf-8", label);
  for (const [name, value] of Object.entries(COMMON)) assert.equal(result.headers.get(name), value, label + " " + name);
  assert.equal(result.data.traceId, undefined, label);
  assert.equal(result.logs.length, 0, label);
}
// A refusal: Problem Details with its code, status and trace, and one log line
// with the kind and the trace.
function refused(result, status, code, label) {
  assert.equal(result.status, status, label + ": " + result.text);
  assert.equal(result.headers.get("Content-Type"), "application/problem+json", label);
  for (const [name, value] of Object.entries(COMMON)) assert.equal(result.headers.get(name), value, label + " " + name);
  assert.equal(result.data.code, code, label);
  assert.equal(result.data.status, status, label);
  assert.equal(result.data.traceId, RAY, label);
  assert.equal(result.logs.length, 1, label);
  assert.deepEqual(result.logs[0][1], { kind: code, traceId: RAY }, label);
}
// A refusal that changes nothing, with the members that it names.
async function refusedHere(db, call, label, status, code, method, path, options, fields = {}) {
  const before = shape(db);
  const result = await call(method, path, options);
  refused(result, status, code, label);
  for (const [name, value] of Object.entries(fields)) assert.deepEqual(result.data[name], value, label + " " + name);
  assert.equal(shape(db), before, label + ": no data changes");
  return result;
}

test("TC-1437 to TC-1441: SPEC-194's criteria, a pass bound to the commit and the request that the page showed", async () => {
  const { db, call } = inProcess();
  assert.equal((await call("POST", "/api/snapshots", { body: acme() })).status, 200);
  const passes = SPACE + "/checkpoints";
  // TC-1439: a page drawn at commit A with stage 04's request, whose last entry
  // E1 is the comment's own text, place 0; neither changed, so the checkpoint
  // is recorded with commit A, the comment and E1.
  const spec = (await call("POST", SPACE + "/comments", { body: request("04-functional-spec") })).data;
  const passed = await call("POST", passes, { kind: "user", body: pass("04-functional-spec", { comment: spec.id, entry: 0 }) });
  created(passed, "TC-1439");
  assert.deepEqual([passed.data.commit, passed.data.comment, passed.data.entry, passed.data.revision], [A, spec.id, 0, null], "TC-1439");
  assert.deepEqual(row(db, "SELECT commit_id, comment, entry, snapshot_revision FROM checkpoints WHERE id = ?", passed.data.id),
    { commit_id: A, comment: spec.id, entry: 0, snapshot_revision: null }, "TC-1439: the checkpoint holds what was approved");
  // TC-1438: stage 03's request drawn at E1, and the agent's reply E2 before the pass.
  const flows = (await call("POST", SPACE + "/comments", { body: request("03-user-flow") })).data;
  const again = (await call("POST", SPACE + "/comments/" + flows.id + "/replies", { body: askAgain })).data;
  const newer = await refusedHere(db, call, "TC-1438", 409, "request_changed", "POST", passes,
    { kind: "user", body: pass("03-user-flow", { comment: flows.id, entry: 0, words: "The flows as drafted." }) }, { comment: flows.id, entry: again.reply.seq });
  assert.equal(newer.data.detail, `the checkpoint request ${flows.id} has a newer entry than the page showed; read it again before passing`, "TC-1438");
  // The page reads the request again, and E2 is its last entry, which still waits for the user.
  const thread = (await call("GET", SPACE + "/comments/" + flows.id, { kind: "user" })).data;
  assert.deepEqual([thread.replies.at(-1).seq, thread.replies.at(-1).text, thread.asks, thread.waits], [1, askAgain.text, "checkpoint", "user"], "TC-1438");
  // TC-1437: a page that showed commit A, and a push of commit B before the user passes.
  assert.equal((await call("POST", "/api/snapshots", { body: moved(acme(), B, A) })).status, 200);
  const pushed = await refusedHere(db, call, "TC-1437", 409, "snapshot_changed", "POST", passes,
    { kind: "user", body: pass("02-prd", { words: "The requirements as drafted." }) }, { held_commit: B });
  assert.equal(pushed.data.detail, "acme now shows commit bbbbbbb, not the one that the page showed; read the stage again before passing", "TC-1437: the answer names B");
  // TC-1440: a pass from the stage's record with no request is recorded with the commit only.
  const replies = count(db, "replies");
  const plain = await call("POST", passes, { kind: "user", body: pass("02-prd", { commit: B }) });
  created(plain, "TC-1440");
  assert.deepEqual([plain.data.commit, plain.data.comment, plain.data.entry, plain.data.revision], [B, null, null, null], "TC-1440");
  assert.equal(count(db, "replies"), replies, "TC-1440: no reply is added");
  // TC-1441: a pass that names no commit.
  const { commit: _, ...bare } = pass("05-erd");
  const left = await refusedHere(db, call, "TC-1441", 400, "invalid_request", "POST", passes, { kind: "user", body: bare }, { field: "commit" });
  assert.match(left.data.detail, /; load the page again$/, "TC-1441");
  assert.equal(count(db, "checkpoints"), 2);
  // A request stored before the design revision, without the form and with nothing to look at
  // first, is named and settled like any other: the record passes with it (SCR-112's revision).
  const old = (await call("POST", SPACE + "/comments", { body: request("07-sitemap") })).data;
  db.prepare("UPDATE comments SET text = 'Stage 07 is ready.', look_first = NULL WHERE id = ?").run(old.id);
  const formless = await call("POST", passes, { kind: "user", body: pass("07-sitemap", { commit: B, comment: old.id, entry: 0 }) });
  created(formless, "a request without the form");
  assert.deepEqual([formless.data.commit, formless.data.comment, formless.data.entry], [B, old.id, 0], "a request without the form");
  assert.deepEqual(row(db, "SELECT asks, waits, settled FROM comments WHERE id = ?", old.id), { asks: null, waits: "agent", settled: 1 },
    "a request without the form is settled by the pass's reply");
  assert.equal(count(db, "checkpoints"), 3);
});

test("TC-1570 to TC-1596: each response of API-128 passCheckpoint that the contract names", async () => {
  let failing = false;
  const { db, call } = inProcess({ batch: (original) => async (statements) => {
    if (failing && statements.some((statement) => /^INSERT INTO checkpoints/.test(statement.sql))) throw new Error("synthetic write failure");
    return original(statements);
  } });
  for (const body of [acme(), noCommit("acme-notes"), legacy("legacy-shop")]) assert.equal((await call("POST", "/api/snapshots", { body })).status, 200);
  const no = (...args) => refusedHere(db, call, ...args);
  const passes = SPACE + "/checkpoints", notes = "/api/spaces/acme-notes/checkpoints";
  const spec = (await call("POST", SPACE + "/comments", { body: request("04-functional-spec") })).data;

  // TC-1570 passed-on-a-request: from Safari on a phone, whose page reported
  // that no software drives the browser. The reply that settles the request
  // holds the words of the pass's button and counts in the space's text.
  let before = tables(db), spent = spaceBytes(db);
  const onRequest = await call("POST", passes, { kind: "user", headers: SAFARI_PHONE, body: pass("04-functional-spec", { comment: spec.id, entry: 0, driven: false }) });
  created(onRequest, "TC-1570");
  assert.deepEqual([onRequest.data.commit, onRequest.data.revision, onRequest.data.comment, onRequest.data.entry, onRequest.data.words,
    onRequest.data.browser, onRequest.data.device, onRequest.data.driven], [A, null, spec.id, 0, null, "safari", "phone", false], "TC-1570");
  assert.deepEqual(changed(before, tables(db)), ["checkpoints", "comments", "project_spaces", "replies", "writes"], "TC-1570: only the pass's transaction changes data");
  assert.equal(spaceBytes(db) - spent, utf8("Pass the stage 04 checkpoint"), "TC-1570");
  // TC-1571 passed-without-a-request: on a snapshot that names no commit, from
  // Firefox on a desktop, whose page sent nothing of software driving it.
  before = tables(db);
  const plain = await call("POST", notes, { kind: "user", headers: FIREFOX_DESKTOP, body: { part: "sample", stage: "02-prd", words: "The requirements as drafted.", revision: 1 } });
  created(plain, "TC-1571");
  assert.deepEqual([plain.data.commit, plain.data.revision, plain.data.comment, plain.data.entry, plain.data.words, plain.data.browser, plain.data.device, plain.data.driven],
    [null, 1, null, null, "The requirements as drafted.", "firefox", "desktop", null], "TC-1571");
  assert.deepEqual(changed(before, tables(db)), ["checkpoints", "writes"], "TC-1571: only the pass's transaction changes data");

  // TC-1572 to TC-1576: 400 by the field.
  await no("TC-1572 invalid-body", 400, "invalid_request", "POST", passes, { kind: "user", body: pass("02-prd", { text: "" }) }, { field: "body" });
  await no("TC-1573 missing-write-id", 400, "invalid_request", "POST", passes, { kind: "user", write: null, body: pass("02-prd") }, { field: "Idempotency-Key" });
  const { commit: _, ...old } = pass("02-prd", { words: "As drafted." });
  const outdated = await no("TC-1574 neither-commit-nor-revision", 400, "invalid_request", "POST", passes, { kind: "user", body: old }, { field: "commit" });
  assert.equal(outdated.data.detail, "commit: a pass names the commit that the page showed, or the snapshot's revision; load the page again", "TC-1574");
  await no("TC-1575 commit-and-revision", 400, "invalid_request", "POST", passes, { kind: "user", body: pass("02-prd", { revision: 1 }) }, { field: "revision" });
  await no("TC-1576 half-a-request", 400, "invalid_request", "POST", passes, { kind: "user", body: pass("02-prd", { comment: spec.id }) }, { field: "entry" });
  await no("TC-1576 the entry alone", 400, "invalid_request", "POST", passes, { kind: "user", body: pass("02-prd", { entry: 0 }) }, { field: "comment" });
  // TC-1577 to TC-1580: the kind of sign-in, Access and another site.
  await no("TC-1577 user-only", 403, "user_only", "POST", passes, { body: pass("02-prd") }, { needs: "user" });
  await no("TC-1578 access-missing", 403, "access_missing", "POST", passes, { kind: "user", ctx: {}, body: pass("02-prd") });
  await no("TC-1579 access-other-app", 403, "access_other_app", "POST", passes, { kind: "user", ctx: { access: { aud: "unrelated-synthetic-audience" } }, body: pass("02-prd") });
  await no("TC-1580 cross-site", 403, "cross_site", "POST", passes, { kind: "user", headers: { "Sec-Fetch-Site": "cross-site" }, body: pass("02-prd") });
  // TC-1581 to TC-1583: what the pass names does not exist.
  await no("TC-1581 part-not-found", 404, "part_not_found", "POST", passes, { kind: "user", body: { ...pass("02-prd"), part: "billing" } });
  await no("TC-1582 space-not-found", 404, "space_not_found", "POST", "/api/spaces/legacy-shop/checkpoints", { kind: "user", body: pass("02-prd") });
  await no("TC-1583 comment-not-found", 404, "comment_not_found", "POST", passes, { kind: "user", body: pass("03-user-flow", { comment: "nc_3a6d9g2j5m8r", entry: 0 }) });
  // TC-1584 to TC-1588: what the page showed changed.
  assert.equal((await call("POST", "/api/snapshots", { body: moved(acme(), B, A) })).status, 200);
  const pushed = await no("TC-1584 snapshot-changed", 409, "snapshot_changed", "POST", passes, { kind: "user", body: pass("02-prd") }, { held_commit: B });
  assert.equal(pushed.data.detail, "acme now shows commit bbbbbbb, not the one that the page showed; read the stage again before passing", "TC-1584");
  assert.equal(pushed.data.revision, undefined, "TC-1584");
  assert.equal((await call("POST", "/api/snapshots", { body: noCommit("acme-notes") })).status, 200);
  const newer = await no("TC-1585 snapshot-changed-without-commit", 409, "snapshot_changed", "POST", notes, { kind: "user", body: { part: "sample", stage: "03-user-flow", revision: 1 } }, { revision: 2 });
  assert.deepEqual([newer.data.detail, newer.data.held_commit], ["acme-notes now shows a newer snapshot than the page showed; read the stage again before passing", undefined], "TC-1585");
  const flows = (await call("POST", SPACE + "/comments", { body: request("03-user-flow") })).data;
  const again = (await call("POST", SPACE + "/comments/" + flows.id + "/replies", { body: askAgain })).data;
  await no("TC-1586 request-changed", 409, "request_changed", "POST", passes, { kind: "user", body: pass("03-user-flow", { commit: B, comment: flows.id, entry: 0 }) },
    { comment: flows.id, entry: again.reply.seq });
  const unnamed = await no("TC-1587 request-not-named", 409, "request_changed", "POST", passes, { kind: "user", body: pass("03-user-flow", { commit: B }) },
    { comment: flows.id, entry: again.reply.seq });
  assert.equal(unnamed.data.detail, `stage 03-user-flow of sample now has a checkpoint request, ${flows.id}; read it before passing`, "TC-1587");
  // The user's reply that does not settle the request: the comment no longer
  // asks for the checkpoint, and the stage has no open request.
  assert.equal((await call("POST", SPACE + "/comments/" + flows.id + "/replies", { kind: "user", body: { text: "Not yet: say what a refused pass shows." } })).status, 201);
  const gone = await no("TC-1588 request-no-longer-open", 409, "request_changed", "POST", passes, { kind: "user", body: pass("03-user-flow", { commit: B, comment: flows.id, entry: 2 }) });
  assert.deepEqual([gone.data.detail, gone.data.comment, gone.data.entry],
    [`the checkpoint request ${flows.id} no longer asks for the checkpoint; read the stage again`, undefined, undefined], "TC-1588");
  // TC-1589 to TC-1591: the limits of the reply that settles a request, and the write ID.
  const erd = (await call("POST", SPACE + "/comments", { body: request("05-erd") })).data;
  fillReplies(db, erd.id);
  await no("TC-1589 reply-limit", 409, "reply_limit", "POST", passes, { kind: "user", body: pass("05-erd", { commit: B, comment: erd.id, entry: 200 }) }, { limit: 200 });
  const prd = (await call("POST", SPACE + "/comments", { body: request("02-prd") })).data;
  const kept = spaceBytes(db);
  db.prepare("UPDATE project_spaces SET text_bytes = ? WHERE project = 'acme'").run(MIB8 - utf8("As drafted.") + 1);
  await no("TC-1590 space-full", 409, "space_full", "POST", passes, { kind: "user", body: pass("02-prd", { commit: B, comment: prd.id, entry: 0, words: "As drafted." }) }, { limit: MIB8 });
  db.prepare("UPDATE project_spaces SET text_bytes = ? WHERE project = 'acme'").run(kept);
  assert.equal((await call("POST", SPACE + "/comments", { kind: "user", write: "nw_6t9w2z5c8f1j", body: USER_COMMENT })).status, 201);
  await no("TC-1591 write-id-reused", 409, "write_id_reused", "POST", passes, { kind: "user", write: "nw_6t9w2z5c8f1j", body: pass("06-api", { commit: B }) });
  // TC-1592 to TC-1596: the body's size and type, the server's own error and the method.
  await no("TC-1592 words-too-long", 413, "text_too_long", "POST", passes, { kind: "user", body: pass("06-api", { commit: B, words: "x".repeat(2001) }) }, { field: "words", limit: 2000 });
  await no("TC-1593 body-too-large", 413, "body_too_large", "POST", passes, { kind: "user", raw: JSON.stringify({ ...pass("06-api", { commit: B }), padding: "x".repeat(262144) }) }, { limit: 262144 });
  await no("TC-1594 json-required", 415, "json_required", "POST", passes, { kind: "user", body: pass("06-api", { commit: B }), headers: { "Content-Type": "text/plain" } });
  failing = true;
  await no("TC-1595 internal", 500, "internal", "POST", passes, { kind: "user", body: pass("06-api", { commit: B }) });
  failing = false;
  const put = await no("TC-1596 method-not-allowed", 405, "method_not_allowed", "PUT", passes, { kind: "user", body: pass("06-api", { commit: B }) });
  assert.equal(put.headers.get("Allow"), "POST");
  assert.equal(count(db, "checkpoints"), 2, "the two passes recorded a checkpoint each, and no refusal one");
});

// The standalone server: real TCP, RSA signatures checked, SQLite through
// sqlite.js on an in-memory database, in the language that a test names. It
// keeps the SQL of each batch, one transaction each.
async function standalone(t, { language = "en" } = {}) {
  const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const jwk = { ...await crypto.subtle.exportKey("jwk", pair.publicKey), kid: "synthetic", alg: "RS256" };
  const env = { ACCESS_AUD: "synthetic-audience", ACCESS_TEAM_DOMAIN: "access.example.com", NEXUS_LANGUAGE: language };
  const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const sign = async (identity) => {
    const content = b64({ alg: "RS256", kid: jwk.kid }) + "." + b64({ iss: "https://access.example.com", aud: [env.ACCESS_AUD], exp: Math.floor(Date.now() / 1000) + 600, ...identity });
    return content + "." + Buffer.from(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(content))).toString("base64url");
  };
  const tokens = { user: await sign({ sub: "synthetic-person" }), agent: await sign({ sub: "", common_name: "synthetic-client" }) };
  const db = new SQLiteD1(":memory:");
  const batches = [], batch = db.batch.bind(db);
  db.batch = async (statements) => { batches.push(statements.map((statement) => statement.sql)); return batch(statements); };
  const verifier = new AccessVerifier({ requireContext: false, fetcher: async (url) => {
    assert.equal(url, "https://access.example.com/cdn-cgi/access/certs");
    return Response.json({ keys: [jwk] });
  } });
  const server = createNodeServer({ env: { ...env, DB: db }, origin: "https://nexus.example.com", template, verifier });
  await server.start();
  t.after(async () => { await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }); db.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  let serial = 0;
  async function call(method, path, { body, kind = "agent", session = kind === "agent" ? "s-1" : null, write, headers = {} } = {}) {
    const sent = { "Cf-Access-Jwt-Assertion": tokens[kind], ...(session === null ? {} : { "Nexus-Session": session }), ...headers };
    if (method === "POST") sent["Idempotency-Key"] = JSON.stringify(write || "nw_" + (++serial).toString().padStart(12, "0"));
    if (body !== undefined) sent["Content-Type"] = "application/json";
    const response = await httpFetch(base + path, { method, headers: sent, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await response.text();
    return { status: response.status, headers: response.headers, text, data: text ? JSON.parse(text) : null };
  }
  assert.equal((await call("POST", "/api/snapshots", { body: acme() })).status, 200);
  return { call, memory: db.connection, batches };
}

test("TC-1732 to TC-1734: a pass after a push, after a newer entry of the request and while a new request is open, on the standalone server", async (t) => {
  const { call, memory } = await standalone(t);
  const passes = SPACE + "/checkpoints";
  const counts = () => ["checkpoints", "replies", "writes"].map((table) => count(memory, table));
  // TC-1732: the page reads stage 02 at commit A; a push of commit B; the pass with A.
  const drawn = (await call("GET", SPACE + "/stages/sample/02-prd", { kind: "user" })).data;
  assert.equal(drawn.project.commit, A);
  assert.equal((await call("POST", "/api/snapshots", { body: moved(acme(), B, A) })).status, 200);
  let before = counts();
  const late = await call("POST", passes, { kind: "user", body: pass("02-prd", { commit: drawn.project.commit, words: "The requirements as drafted." }) });
  assert.deepEqual([late.status, late.data.code, late.data.held_commit], [409, "snapshot_changed", B], "TC-1732");
  assert.deepEqual(counts(), before, "TC-1732: no checkpoint, no reply and no write ID are recorded");
  const named = await call("POST", passes, { kind: "user", body: pass("02-prd", { commit: B, words: "The requirements as drafted." }) });
  assert.deepEqual([named.status, named.data.commit], [201, B], "TC-1732: the pass that names B");
  // TC-1733: the page shows stage 04's request with entry 0, and the agent asks again.
  const spec = (await call("POST", SPACE + "/comments", { body: request("04-functional-spec") })).data;
  assert.deepEqual((await call("GET", SPACE + "/comments/" + spec.id, { kind: "user" })).data.replies, [], "TC-1733: the page shows entry 0");
  const again = (await call("POST", SPACE + "/comments/" + spec.id + "/replies", { body: askAgain })).data;
  before = counts();
  const newer = await call("POST", passes, { kind: "user", body: pass("04-functional-spec", { commit: B, comment: spec.id, entry: 0 }) });
  assert.deepEqual([newer.status, newer.data.code, newer.data.comment, newer.data.entry], [409, "request_changed", spec.id, again.reply.seq], "TC-1733");
  assert.deepEqual(counts(), before, "TC-1733: nothing is recorded");
  const thread = (await call("GET", SPACE + "/comments/" + spec.id, { kind: "user" })).data;
  assert.deepEqual([thread.state, thread.waits, thread.asks], ["open", "user", "checkpoint"], "TC-1733: the comment still waits for the user");
  // TC-1734: the page reads stage 03 with no request; the agent makes one; the pass names none.
  const quiet = (await call("GET", SPACE + "/talk/sample/03-user-flow", { kind: "user" })).data;
  assert.equal(quiet.mine.total, 0, "TC-1734: the page shows no request");
  const flows = (await call("POST", SPACE + "/comments", { body: request("03-user-flow") })).data;
  before = counts();
  const unnamed = await call("POST", passes, { kind: "user", body: pass("03-user-flow", { commit: B }) });
  assert.deepEqual([unnamed.status, unnamed.data.code, unnamed.data.comment, unnamed.data.entry], [409, "request_changed", flows.id, 0], "TC-1734");
  assert.deepEqual(counts(), before, "TC-1734: nothing is recorded");
});

test("TC-1732 and TC-1733 at the store: a push or the agent's reply that lands between a pass's plan and its batch refuses the pass, which stores nothing", async () => {
  const db = new DatabaseSync(":memory:");
  const binding = fakeD1(db);
  const store = new Store(binding);
  await store.push(readSnapshot02(acme(), Date.now()));
  // Each pass's first batch waits until the other write has landed, so that its
  // receipt reads another basis than its plan did; planned again, it is refused.
  const ungated = binding.batch.bind(binding);
  async function between(write, body, other) {
    let release = null, held = 0;
    const gate = new Promise((resolve) => { release = resolve; });
    binding.batch = async (statements) => {
      if (!held && statements.some((statement) => (statement.params || []).includes(write))) { held++; await gate; }
      return ungated(statements);
    };
    const passing = store.writeEntry("checkpoint", "acme", null, body, { kind: "user", write }).catch((error) => error);
    while (!held) await new Promise((resolve) => setTimeout(resolve, 1));
    const landed = await other();
    release();
    const answer = await passing;
    binding.batch = ungated;
    return { answer, landed };
  }
  const spec = await store.writeEntry("comment", "acme", null, request("04-functional-spec"), { kind: "agent", session: "s-1", write: "nw_000000000001" });
  const reply = await between("nw_000000000002", pass("04-functional-spec", { comment: spec.body.id, entry: 0 }),
    () => store.writeEntry("reply", "acme", spec.body.id, askAgain, { kind: "agent", session: "s-1", write: "nw_000000000003" }));
  assert.deepEqual([reply.answer.code, reply.answer.status, reply.answer.fields?.comment, reply.answer.fields?.entry],
    ["request_changed", 409, spec.body.id, reply.landed.body.reply.seq], "TC-1733 at the store");
  const push = await between("nw_000000000004", pass("02-prd"), () => store.push(readSnapshot02(moved(acme(), B, A), Date.now())));
  assert.deepEqual([push.answer.code, push.answer.status, push.answer.fields?.held_commit], ["snapshot_changed", 409, B], "TC-1732 at the store");
  assert.equal(count(db, "checkpoints"), 0, "no checkpoint is stored");
  assert.deepEqual(db.prepare("SELECT seq, author FROM replies").all().map((entry) => [entry.seq, entry.author]), [[1, "agent"]], "no reply of the user is stored");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM writes WHERE id IN ('nw_000000000002', 'nw_000000000004')").get().n, 0, "nor their write IDs");
});

test("TC-1735: a pass sent twice with one write ID across a push gets its first answer, on the standalone server", async (t) => {
  const { call, memory } = await standalone(t);
  const spec = (await call("POST", SPACE + "/comments", { body: request("04-functional-spec") })).data;
  const body = pass("04-functional-spec", { comment: spec.id, entry: 0, words: "The rows as drafted." });
  const first = await call("POST", SPACE + "/checkpoints", { kind: "user", write: "nw_5c8f1j4m7p0s", body });
  assert.equal(first.status, 201, first.text);
  assert.equal((await call("POST", "/api/snapshots", { body: moved(acme(), B, A) })).status, 200);
  const second = await call("POST", SPACE + "/checkpoints", { kind: "user", write: "nw_5c8f1j4m7p0s", body });
  assert.deepEqual([second.status, second.data], [201, first.data], "the second answer is the first, though the commit changed in between");
  assert.deepEqual(memory.prepare("SELECT id, commit_id, comment, entry FROM checkpoints").all().map((entry) => ({ ...entry })),
    [{ id: first.data.id, commit_id: A, comment: spec.id, entry: 0 }], "one checkpoint");
  assert.deepEqual(memory.prepare("SELECT seq, author, text, settles FROM replies WHERE comment = ?").all(spec.id).map((entry) => ({ ...entry })),
    [{ seq: 1, author: "user", text: "The rows as drafted.", settles: 1 }], "one reply that settles the request");
});

test("TC-1736: a pass on a snapshot that names no commit names its revision, on the standalone server", async (t) => {
  const { call, memory } = await standalone(t);
  assert.equal((await call("POST", "/api/snapshots", { body: noCommit("acme-notes") })).status, 200);
  const notes = "/api/spaces/acme-notes/checkpoints";
  const drawn = (await call("GET", "/api/spaces/acme-notes/stages/sample/02-prd", { kind: "user" })).data;
  assert.deepEqual([drawn.project.commit, drawn.project.revision], [null, 1]);
  const passed = await call("POST", notes, { kind: "user", body: { part: "sample", stage: "02-prd", words: "The requirements as drafted.", revision: drawn.project.revision } });
  assert.deepEqual([passed.status, passed.data.commit, passed.data.revision], [201, null, 1], passed.text);
  assert.deepEqual(row(memory, "SELECT commit_id, snapshot_revision FROM checkpoints WHERE id = ?", passed.data.id), { commit_id: null, snapshot_revision: 1 });
  const before = shape(memory);
  for (const [label, named] of [["another revision", { revision: 2 }], ["a commit", { commit: A }]]) {
    const result = await call("POST", notes, { kind: "user", body: { part: "sample", stage: "03-user-flow", ...named } });
    assert.deepEqual([result.status, result.data.code, result.data.revision, result.data.held_commit], [409, "snapshot_changed", 1, undefined], label);
  }
  const revision = await call("POST", SPACE + "/checkpoints", { kind: "user", body: { part: "sample", stage: "03-user-flow", revision: 1 } });
  assert.deepEqual([revision.status, revision.data.code, revision.data.held_commit, revision.data.revision], [409, "snapshot_changed", A, undefined], "a snapshot that names a commit");
  assert.equal(shape(memory), before, "a refusal records nothing");
});

test("TC-1737 and the server's half of TC-1760: a pass out of form, as from a page of before the release, on the standalone server", async (t) => {
  const { call, memory } = await standalone(t);
  const spec = (await call("POST", SPACE + "/comments", { body: request("04-functional-spec") })).data;
  const before = shape(memory);
  const { commit: _, ...old } = pass("04-functional-spec", { words: "Pass it as drafted." });
  for (const [label, body, field] of [["neither, as a page of before the release sends it", old, "commit"], ["both", pass("04-functional-spec", { revision: 1 }), "revision"],
    ["a comment without its entry", pass("04-functional-spec", { comment: spec.id }), "entry"], ["an entry without its comment", pass("04-functional-spec", { entry: 0 }), "comment"]]) {
    const result = await call("POST", SPACE + "/checkpoints", { kind: "user", body });
    assert.deepEqual([result.status, result.data.code, result.data.field], [400, "invalid_request", field], label);
    if (field === "commit") assert.equal(result.data.detail, "commit: a pass names the commit that the page showed, or the snapshot's revision; load the page again", label);
  }
  assert.equal(shape(memory), before, "nothing is recorded");
});

test("TC-1738: a pass's 404s come before snapshot_changed, and snapshot_changed before request_changed, on the standalone server", async (t) => {
  const { call, memory } = await standalone(t);
  const spec = (await call("POST", SPACE + "/comments", { body: request("04-functional-spec") })).data;
  assert.equal((await call("POST", SPACE + "/comments/" + spec.id + "/replies", { body: askAgain })).status, 201);
  assert.equal((await call("POST", "/api/snapshots", { body: moved(acme(), B, A) })).status, 200);
  const before = shape(memory);
  // Each pass names commit A, which the project no longer shows.
  for (const [label, body, status, code] of [["a comment that the space does not hold", pass("04-functional-spec", { comment: "nc_3a6d9g2j5m8r", entry: 0 }), 404, "comment_not_found"],
    ["a part that the snapshot does not hold", { ...pass("04-functional-spec"), part: "billing" }, 404, "part_not_found"],
    ["a request with a newer entry", pass("04-functional-spec", { comment: spec.id, entry: 0 }), 409, "snapshot_changed"]]) {
    const result = await call("POST", SPACE + "/checkpoints", { kind: "user", body });
    assert.deepEqual([result.status, result.data.code], [status, code], label);
  }
  assert.equal(shape(memory), before, "nothing is recorded");
});

test("TC-1739: a pass with a request settles it in its transaction, in the user's words or the button's in the server's language, on the standalone server", async (t) => {
  for (const [language, button] of [["en", "Pass the stage 03 checkpoint"], ["ko", "03단계 확인 지점 통과"]]) {
    const { call, memory, batches } = await standalone(t, { language });
    const spec = (await call("POST", SPACE + "/comments", { body: request("04-functional-spec") })).data;
    const flows = (await call("POST", SPACE + "/comments", { body: request("03-user-flow") })).data;
    for (const [comment, stage, words, text] of [[spec, "04-functional-spec", "The rows as drafted.", "The rows as drafted."], [flows, "03-user-flow", undefined, button]]) {
      const label = `${language} ${stage}`;
      const sent = batches.length;
      const passed = await call("POST", SPACE + "/checkpoints", { kind: "user", body: pass(stage, { comment: comment.id, entry: 0, ...(words ? { words } : {}) }) });
      assert.equal(passed.status, 201, label + ": " + passed.text);
      assert.deepEqual([passed.data.commit, passed.data.comment, passed.data.entry, passed.data.words], [A, comment.id, 0, words ?? null], label);
      const thread = (await call("GET", SPACE + "/comments/" + comment.id, { kind: "user" })).data;
      const settling = thread.replies.at(-1);
      assert.deepEqual([settling.author, settling.text, settling.settles, thread.state, thread.asks, thread.waits, thread.settled],
        ["user", text, true, "open", null, "agent", true], label + ": the reply settles the request, which waits for the agent's record");
      assert.equal(row(memory, "SELECT passed_at FROM checkpoints WHERE id = ?", passed.data.id).passed_at, settling.made_at, label + ": the reply and the checkpoint take one time");
      const written = batches.slice(sent).filter((statements) => statements.some((sql) => /^INSERT INTO checkpoints/.test(sql)));
      assert.equal(written.length, 1, label);
      assert.ok(written[0].some((sql) => /^INSERT INTO replies/.test(sql)) && written[0].some((sql) => /^UPDATE comments/.test(sql)), label + ": in one transaction");
      const todo = (await call("GET", SPACE + "/todo")).data;
      assert.ok(todo.checkpoints.entries.some((entry) => entry.id === passed.data.id), label + ": the agent to-do lists the checkpoint to record");
    }
    const replies = count(memory, "replies");
    const plain = await call("POST", SPACE + "/checkpoints", { kind: "user", body: pass("02-prd") });
    assert.deepEqual([plain.status, plain.data.comment, plain.data.entry], [201, null, null], language + ": a pass without a request");
    assert.equal(count(memory, "replies"), replies, language + ": adds no reply");
  }
});

test("TC-1740: a pass at the limits of the request's comment and of the space, on the standalone server", async (t) => {
  const { call, memory } = await standalone(t);
  const passes = SPACE + "/checkpoints";
  const spec = (await call("POST", SPACE + "/comments", { body: request("04-functional-spec") })).data;
  fillReplies(memory, spec.id);
  const full = await call("POST", passes, { kind: "user", body: pass("04-functional-spec", { comment: spec.id, entry: 200 }) });
  assert.deepEqual([full.status, full.data.code, full.data.limit], [409, "reply_limit", 200]);
  const flows = (await call("POST", SPACE + "/comments", { body: request("03-user-flow") })).data;
  const kept = spaceBytes(memory);
  memory.prepare("UPDATE project_spaces SET text_bytes = ? WHERE project = 'acme'").run(MIB8 - utf8("Pass the stage 03 checkpoint") + 1);
  const room = await call("POST", passes, { kind: "user", body: pass("03-user-flow", { comment: flows.id, entry: 0 }) });
  assert.deepEqual([room.status, room.data.code, room.data.limit], [409, "space_full", MIB8]);
  memory.prepare("UPDATE project_spaces SET text_bytes = ? WHERE project = 'acme'").run(kept);
  assert.deepEqual([count(memory, "checkpoints"), memory.prepare("SELECT COUNT(*) AS n FROM replies WHERE author = 'user'").get().n], [0, 0], "no checkpoint and no reply are written");
  // The agent marks the full comment answered: stage 04 then has no open request.
  assert.equal((await call("POST", SPACE + "/comments/" + spec.id + "/answered", { body: {} })).status, 200);
  const plain = await call("POST", passes, { kind: "user", body: pass("04-functional-spec") });
  assert.deepEqual([plain.status, plain.data.comment, plain.data.entry], [201, null, null], plain.text);
});
