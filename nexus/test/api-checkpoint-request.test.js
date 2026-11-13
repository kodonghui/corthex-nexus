// API-118 leaveComment and API-119 replyToComment with the checkpoint request
// taken only in its form (TASK-297, SPEC-197, SPEC-198): SPEC-197's criteria
// (TC-1450, TC-1451, TC-1453), each response of the two operations (TC-1513 to
// TC-1569), two requests at once (TC-1742), a request's text at its limits
// (TC-1743), the thing to look at first in each form (TC-1744) and the reply
// that asks for the checkpoint again (TC-1745). Synthetic projects only; the
// Access keys are generated here and every database is in memory.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { AccessVerifier } from "../src/access.js";
import { handle } from "../src/app.js";
import { createNodeServer } from "../src/node-server.js";
import { entryId } from "../src/push-plan.js";
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
const utf8 = (...texts) => texts.reduce((n, text) => n + Buffer.byteLength(text || ""), 0);
// A project that only a hub of 0.1 pushed, which has a snapshot and no space.
const legacy = (name) => ({ schema: "corthex-hub/0.1", generated_at: "2026-01-12T10:00:00+09:00", project: { name, title: "Legacy shop" },
  stages: { "02-prd": { source_state: "found", read: true, state: "in_progress", next: "Write the PRD" } }, summary: { items: 1 },
  items: [{ id: "REQ-001", kind: "requirement", stage: "02-prd", title: "Send an order confirmation", priority: "Must" }], checks: [] });

// The shop of view-fixtures.js with items on three of the 13 stages and one
// outside them, which no stage holds; its board's aggregate keeps a term that
// no table names, so that its push opens one discrepancy.
function acme(name = "acme") {
  const data = viewSnapshot(name);
  const where = "docs/qa.md:1";
  data.ids = { ...data.ids, REQ: "requirement", SPEC: "spec" };
  data.items = [
    { id: "REQ-001", kind: "requirement", stage: "02-prd", where, title: "Send an order confirmation" },
    { id: "SPEC-194", kind: "spec", stage: "04-functional-spec", where, title: "Say what the page shows after a refused pass" },
    { id: "TBL-001", kind: "table", stage: "05-erd", where, title: "orders" },
    { id: "NOTE-001", kind: "note", stage: "00-notes", where, title: "A stage of its own" }];
  data.summary = { ...data.summary, items: data.items.length };
  data.pictures.find((picture) => picture.stage === "05-erd").source.tables[0].terms = [];
  return data;
}
// The agent's checkpoint request on a part's stage as a whole, in its form.
const request = (stage, extra = {}) => ({ part: "sample", stage, item: "", text: `Stage ${stage.slice(0, 2)} is ready for its checkpoint.\nLook at SPEC-194 first.`,
  asks: "checkpoint", look_first: "SPEC-194", ...extra });
const USER_COMMENT = { part: "sample", stage: "05-erd", item: "TBL-001", text: "Use the glossary's word for this table." };

function tables(db) {
  const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => row.name);
  return Object.fromEntries(names.map((name) => [name, createHash("sha256")
    .update(JSON.stringify(db.prepare(`SELECT * FROM "${name}"`).all().map((row) => JSON.stringify(row)).sort())).digest("hex")]));
}
const shape = (db) => createHash("sha256").update(JSON.stringify(tables(db))).digest("hex");
const changed = (before, after) => Object.keys(after).filter((name) => before[name] !== after[name]).sort();
const openRequests = (db) => db.prepare("SELECT id, part, stage FROM comments WHERE state = 'open' AND asks = 'checkpoint' ORDER BY stage, id").all().map((row) => ({ ...row }));
const spaceBytes = (db) => db.prepare("SELECT text_bytes FROM project_spaces WHERE project = 'acme'").get().text_bytes;

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
// The copies of a comment that fill the space up to 2,000 comments.
function fillComments(db, id) {
  const row = { ...db.prepare("SELECT * FROM comments WHERE id = ?").get(id) };
  const copy = db.prepare(`INSERT INTO comments (${Object.keys(row).join(",")}) VALUES (${Object.keys(row).map(() => "?").join(",")})`);
  db.exec("BEGIN");
  for (let n = db.prepare("SELECT COUNT(*) AS n FROM comments WHERE project = 'acme'").get().n; n < 2000; n++) copy.run(...Object.values({ ...row, id: entryId("nc_") }));
  db.exec("COMMIT");
}
// A comment that holds 200 replies, the most that one holds.
function fillReplies(db, id) {
  const insert = db.prepare("INSERT INTO replies (comment, seq, author, text, settles, made_at) VALUES (?, ?, 'agent', ?, 0, '2026-11-13T01:00:00.000Z')");
  db.exec("BEGIN");
  for (let seq = db.prepare("SELECT COUNT(*) AS n FROM replies WHERE comment = ?").get(id).n + 1; seq <= 200; seq++) insert.run(id, seq, "Reply " + seq);
  db.exec("COMMIT");
}

test("TC-1450, TC-1451 and TC-1453: the agent asks for one stage's checkpoint at a time, and a second request is a reply on the first", async () => {
  const { db, call } = inProcess();
  assert.equal((await call("POST", "/api/snapshots", { body: acme() })).status, 200);
  // TC-1450: stage 04's draft is merged and pushed, and the agent asks for its
  // checkpoint in ten lines, with SPEC-194 as the thing to look at first.
  const text = ["Stage 04's rows are ready for their checkpoint.", "- 24 new rows and 20 changed ones, for the loop with the agent.",
    "- A pass names what you saw and is refused when that changed.", "- A request names one thing to look at first.", "- Ten lines at most.",
    "- The talk holds it on the stage as a whole.", "- My turn lists it as a checkpoint request.", "- Nothing else changed.",
    "- The other stages wait for their own.", "Look at SPEC-194 first: it says what the page shows after a refused pass."].join("\n");
  const asked = await call("POST", SPACE + "/comments", { body: { part: "sample", stage: "04-functional-spec", item: "", text, asks: "checkpoint", look_first: "SPEC-194" } });
  created(asked, "TC-1450");
  assert.equal(asked.data.text.split("\n").length, 10);
  const talk = (await call("GET", SPACE + "/talk/sample/04-functional-spec", { kind: "user" })).data;
  assert.equal(talk.mine.total, 1, "TC-1450: the talk holds one comment on my turn");
  assert.deepEqual([talk.mine.entries[0].kind, talk.mine.entries[0].comment.id, talk.mine.entries[0].comment.item, talk.mine.entries[0].comment.asks,
    talk.mine.entries[0].comment.look_first], ["comment", asked.data.id, "", "checkpoint", "SPEC-194"], "TC-1450: on the stage as a whole, asking for the checkpoint");
  const home = (await call("GET", "/api/home", { kind: "user" })).data;
  assert.deepEqual(home.my_turn.entries.map((entry) => [entry.kind, entry.id, entry.stage, entry.item, entry.asks]),
    [["comment", asked.data.id, "04-functional-spec", "", "checkpoint"]], "TC-1450: my turn lists it as a checkpoint request");
  // TC-1451: stages 03 and 04 both wait, each with a request of its own.
  const flows = await call("POST", SPACE + "/comments", { body: request("03-user-flow") });
  created(flows, "TC-1451");
  assert.deepEqual(openRequests(db), [{ id: flows.data.id, part: "sample", stage: "03-user-flow" }, { id: asked.data.id, part: "sample", stage: "04-functional-spec" }]);
  // TC-1453: a second request on stage 04 while the first is open is refused
  // with the first, and the hub then asks again as a reply on it.
  const second = request("04-functional-spec", { text: "Stage 04 changed since.\nLook at SPEC-194 first." });
  const before = shape(db);
  const refusal = await call("POST", SPACE + "/comments", { body: second });
  refused(refusal, 409, "checkpoint_requested", "TC-1453");
  assert.deepEqual([refusal.data.comment, refusal.data.detail],
    [asked.data.id, `stage 04-functional-spec of sample has an open checkpoint request, ${asked.data.id}; ask again as a reply on it`]);
  assert.equal(shape(db), before, "TC-1453: the refusal stores nothing");
  const again = await call("POST", SPACE + "/comments/" + refusal.data.comment + "/replies", { body: { text: second.text, asks: "checkpoint", look_first: second.look_first } });
  created(again, "TC-1453");
  const thread = (await call("GET", SPACE + "/comments/" + asked.data.id, { kind: "user" })).data;
  assert.deepEqual(thread.replies.map((reply) => [reply.author, reply.text, reply.look_first]), [["agent", second.text, "SPEC-194"]], "TC-1453: stored as a reply on the first");
  assert.deepEqual([thread.asks, thread.waits], ["checkpoint", "user"]);
  assert.deepEqual(openRequests(db).map((row) => row.id), [flows.data.id, asked.data.id], "TC-1453: stage 04 still holds one open request");
});

test("TC-1513 to TC-1540: each response of API-118 leaveComment that the contract names", async () => {
  let failing = false;
  const { db, call } = inProcess({ batch: (original) => async (statements) => {
    if (failing && statements.some((statement) => /^INSERT INTO comments/.test(statement.sql))) throw new Error("synthetic write failure");
    return original(statements);
  } });
  assert.equal((await call("POST", "/api/snapshots", { body: acme() })).status, 200);
  assert.equal((await call("POST", "/api/snapshots", { body: legacy("legacy-shop") })).status, 200);
  const comments = SPACE + "/comments";
  const no = (...args) => refusedHere(db, call, ...args);

  // TC-1513 left: the user's comment, which names no thing to look at first.
  let before = tables(db), spent = spaceBytes(db);
  const left = await call("POST", comments, { kind: "user", body: USER_COMMENT });
  created(left, "TC-1513");
  assert.deepEqual([left.data.author, left.data.waits, left.data.asks, left.data.look_first], ["user", "agent", null, null], "TC-1513");
  assert.deepEqual(changed(before, tables(db)), ["comments", "project_spaces", "writes"], "TC-1513: only the comment's transaction changes data");
  assert.equal(spaceBytes(db) - spent, utf8(USER_COMMENT.text));
  // TC-1514 request-left: the agent's checkpoint request for a stage, which waits for the user.
  before = tables(db); spent = spaceBytes(db);
  const asked = await call("POST", comments, { body: request("04-functional-spec") });
  created(asked, "TC-1514");
  assert.deepEqual([asked.data.author, asked.data.item, asked.data.waits, asked.data.asks, asked.data.look_first], ["agent", "", "user", "checkpoint", "SPEC-194"], "TC-1514");
  assert.deepEqual(changed(before, tables(db)), ["comments", "project_spaces", "writes"], "TC-1514: only the comment's transaction changes data");
  assert.equal(spaceBytes(db) - spent, utf8(asked.data.text, "SPEC-194"), "TC-1514: the thing to look at first counts in the space's text");
  assert.equal(db.prepare("SELECT look_first FROM comments WHERE id = ?").get(asked.data.id).look_first, "SPEC-194");

  // TC-1515 to TC-1522: 400 by the field.
  await no("TC-1515 invalid-field", 400, "invalid_request", "POST", comments, { kind: "user", body: { ...USER_COMMENT, text: "   " } }, { field: "text" });
  await no("TC-1516 missing-write-id", 400, "invalid_request", "POST", comments, { kind: "user", write: null, body: USER_COMMENT }, { field: "Idempotency-Key" });
  await no("TC-1517 missing-session", 400, "invalid_request", "POST", comments, { session: null, body: request("02-prd") }, { field: "Nexus-Session" });
  const { look_first: _, ...old } = request("02-prd");
  const outdated = await no("TC-1518 request-without-look-first", 400, "invalid_request", "POST", comments, { body: old }, { field: "look_first" });
  assert.match(outdated.data.detail, /; update the hub$/, "TC-1518: a hub from before the revision is told to update");
  await no("TC-1519 request-too-long", 400, "invalid_request", "POST", comments, { body: request("02-prd", { text: Array(11).fill("A line").join("\n") }) }, { field: "text" });
  await no("TC-1520 request-on-an-item", 400, "invalid_request", "POST", comments, { body: request("02-prd", { item: "REQ-001" }) }, { field: "item" });
  await no("TC-1521 look-first-without-request", 400, "invalid_request", "POST", comments, { body: { ...USER_COMMENT, asks: "answer", look_first: "TBL-001" } }, { field: "look_first" });
  await no("TC-1521 the user's comment", 400, "invalid_request", "POST", comments, { kind: "user", body: { ...USER_COMMENT, look_first: "TBL-001" } }, { field: "look_first" });
  const unheld = await no("TC-1522 look-first-not-held", 400, "invalid_request", "POST", comments, { body: request("02-prd", { look_first: "SPEC-999" }) }, { field: "look_first" });
  assert.equal(unheld.data.detail, "look_first: no stage of the stored snapshot of acme holds SPEC-999");
  // TC-1523 to TC-1526: Access, another site and a sign-in of neither kind.
  await no("TC-1523 access-missing", 403, "access_missing", "POST", comments, { kind: "user", ctx: {}, body: USER_COMMENT });
  await no("TC-1524 access-other-app", 403, "access_other_app", "POST", comments, { kind: "user", ctx: { access: { aud: "unrelated-synthetic-audience" } }, body: USER_COMMENT });
  await no("TC-1525 cross-site", 403, "cross_site", "POST", comments, { kind: "user", headers: { "Sec-Fetch-Site": "cross-site" }, body: USER_COMMENT });
  await no("TC-1526 no-kind", 403, "no_kind", "POST", comments, { kind: "neither", body: USER_COMMENT });
  // TC-1527 to TC-1530: what the request names does not exist.
  await no("TC-1527 part-not-found", 404, "part_not_found", "POST", comments, { body: request("02-prd", { part: "billing" }) });
  await no("TC-1528 discrepancy-not-found", 404, "discrepancy_not_found", "POST", comments, { kind: "user", body: { ...USER_COMMENT, discrepancy: "nd_4h8r2t6w9z3c" } });
  await no("TC-1529 project-not-found", 404, "project_not_found", "POST", "/api/spaces/nope/comments", { kind: "user", body: USER_COMMENT });
  await no("TC-1530 space-not-found", 404, "space_not_found", "POST", "/api/spaces/legacy-shop/comments", { kind: "user", body: USER_COMMENT });
  // TC-1531 to TC-1535: claims, state and limits.
  const twice = await no("TC-1531 checkpoint-requested", 409, "checkpoint_requested", "POST", comments, { body: request("04-functional-spec") }, { comment: asked.data.id });
  assert.equal(twice.data.detail, `stage 04-functional-spec of sample has an open checkpoint request, ${asked.data.id}; ask again as a reply on it`);
  fillComments(db, left.data.id);
  await no("TC-1532 comment-limit", 409, "comment_limit", "POST", comments, { kind: "user", body: USER_COMMENT }, { limit: 2000 });
  db.prepare("DELETE FROM comments WHERE project = 'acme' AND id NOT IN (?, ?)").run(left.data.id, asked.data.id);
  const kept = spaceBytes(db);
  db.prepare("UPDATE project_spaces SET text_bytes = ? WHERE project = 'acme'").run(8 * 1024 * 1024 - utf8(USER_COMMENT.text) + 1);
  await no("TC-1533 space-full", 409, "space_full", "POST", comments, { kind: "user", body: USER_COMMENT }, { limit: 8 * 1024 * 1024 });
  db.prepare("UPDATE project_spaces SET text_bytes = ? WHERE project = 'acme'").run(kept);
  const discrepancy = db.prepare("SELECT id FROM discrepancies WHERE project = 'acme' AND state = 'open'").get().id;
  const claim = await call("POST", SPACE + "/claims/" + discrepancy, { session: "s-2" });
  assert.equal(claim.status, 200);
  await no("TC-1534 claimed", 409, "claimed", "POST", comments, { session: "s-1", body: { ...USER_COMMENT, text: "The table keeps the term.", discrepancy } }, { ends_at: claim.data.ends_at });
  assert.equal((await call("POST", comments + "/" + left.data.id + "/replies", { kind: "user", write: "nw_6t9w2z5c8f1j", body: { text: "The glossary says orders." } })).status, 201);
  await no("TC-1535 write-id-reused", 409, "write_id_reused", "POST", comments, { kind: "user", write: "nw_6t9w2z5c8f1j", body: USER_COMMENT });
  // TC-1536 to TC-1540: the body's size and type, the server's own error and the method.
  await no("TC-1536 text-too-long", 413, "text_too_long", "POST", comments, { kind: "user", body: { ...USER_COMMENT, text: "x".repeat(4001) } }, { field: "text", limit: 4000 });
  await no("TC-1537 body-too-large", 413, "body_too_large", "POST", comments, { kind: "user", raw: JSON.stringify({ ...USER_COMMENT, padding: "x".repeat(262144) }) }, { limit: 262144 });
  await no("TC-1538 json-required", 415, "json_required", "POST", comments, { kind: "user", body: USER_COMMENT, headers: { "Content-Type": "text/plain" } });
  failing = true;
  await no("TC-1539 internal", 500, "internal", "POST", comments, { kind: "user", body: USER_COMMENT });
  failing = false;
  const put = await no("TC-1540 method-not-allowed", 405, "method_not_allowed", "PUT", comments, { kind: "user", body: USER_COMMENT });
  assert.equal(put.headers.get("Allow"), "POST");
});

test("TC-1541 to TC-1569: each response of API-119 replyToComment that the contract names", async () => {
  let failing = false;
  const { db, call } = inProcess({ batch: (original) => async (statements) => {
    if (failing && statements.some((statement) => /^INSERT INTO replies/.test(statement.sql))) throw new Error("synthetic write failure");
    return original(statements);
  } });
  assert.equal((await call("POST", "/api/snapshots", { body: acme() })).status, 200);
  assert.equal((await call("POST", "/api/snapshots", { body: legacy("legacy-shop") })).status, 200);
  const no = (...args) => refusedHere(db, call, ...args);
  const asked = (await call("POST", SPACE + "/comments", { body: request("04-functional-spec") })).data;
  const question = (await call("POST", SPACE + "/comments", { kind: "user", body: USER_COMMENT })).data;
  const replies = (id) => SPACE + "/comments/" + id + "/replies";

  // TC-1541 replied: the user's reply, which names no thing to look at first.
  let before = tables(db), spent = spaceBytes(db);
  const replied = await call("POST", replies(asked.id), { kind: "user", body: { text: "Not yet: the reply should not close it." } });
  created(replied, "TC-1541");
  assert.deepEqual([replied.data.reply.author, replied.data.reply.look_first, replied.data.comment.waits, replied.data.comment.asks], ["user", null, "agent", null], "TC-1541");
  assert.deepEqual(changed(before, tables(db)), ["comments", "project_spaces", "replies", "writes"], "TC-1541: only the reply's transaction changes data");
  assert.equal(spaceBytes(db) - spent, utf8("Not yet: the reply should not close it."));
  // TC-1542 asked-again: the agent's reply that asks for the checkpoint again
  // on the stage's request, whose last entry it now is.
  before = tables(db); spent = spaceBytes(db);
  const text = "SPEC-194 now says what the page shows after a refused pass.\nLook at SPEC-194 first.";
  const again = await call("POST", replies(asked.id), { body: { text, asks: "checkpoint", look_first: "SPEC-194" } });
  created(again, "TC-1542");
  assert.deepEqual([again.data.reply.seq, again.data.reply.author, again.data.reply.look_first, again.data.comment.waits, again.data.comment.asks],
    [2, "agent", "SPEC-194", "user", "checkpoint"], "TC-1542");
  assert.deepEqual(changed(before, tables(db)), ["comments", "project_spaces", "replies", "writes"], "TC-1542: only the reply's transaction changes data");
  assert.equal(spaceBytes(db) - spent, utf8(text, "SPEC-194"), "TC-1542: the thing to look at first counts in the space's text");
  assert.deepEqual(openRequests(db).map((row) => row.id), [asked.id]);

  // TC-1543 to TC-1550: 400 by the field.
  const ask = (extra = {}) => ({ text: "Look at SPEC-194 first.", asks: "checkpoint", look_first: "SPEC-194", ...extra });
  await no("TC-1543 invalid-field", 400, "invalid_request", "POST", replies(question.id), { kind: "user", body: { text: "" } }, { field: "text" });
  await no("TC-1544 missing-write-id", 400, "invalid_request", "POST", replies(question.id), { kind: "user", write: null, body: { text: "Yes." } }, { field: "Idempotency-Key" });
  await no("TC-1545 missing-session", 400, "invalid_request", "POST", replies(question.id), { session: null, body: { text: "Yes." } }, { field: "Nexus-Session" });
  const outdated = await no("TC-1546 request-without-look-first", 400, "invalid_request", "POST", replies(asked.id), { body: { text: "Pass it?", asks: "checkpoint" } }, { field: "look_first" });
  assert.match(outdated.data.detail, /; update the hub$/);
  await no("TC-1547 request-too-long", 400, "invalid_request", "POST", replies(asked.id), { body: ask({ text: "가".repeat(1201) }) }, { field: "text" });
  const item = await no("TC-1548 request-on-another-comment", 400, "invalid_request", "POST", replies(question.id), { body: ask() }, { field: "asks" });
  assert.equal(item.data.detail, "asks: a reply asks for a checkpoint only on a comment on the stage as a whole");
  await no("TC-1549 look-first-without-request", 400, "invalid_request", "POST", replies(question.id), { kind: "user", body: { text: "See it.", look_first: "TBL-001" } }, { field: "look_first" });
  await no("TC-1549 the agent's answer", 400, "invalid_request", "POST", replies(question.id), { body: { text: "See it.", asks: "answer", look_first: "TBL-001" } }, { field: "look_first" });
  await no("TC-1550 look-first-not-held", 400, "invalid_request", "POST", replies(asked.id), { body: ask({ look_first: "SPEC-999" }) }, { field: "look_first" });
  // TC-1551 to TC-1555: Access, another site and the kind of sign-in.
  await no("TC-1551 access-missing", 403, "access_missing", "POST", replies(question.id), { kind: "user", ctx: {}, body: { text: "Yes." } });
  await no("TC-1552 access-other-app", 403, "access_other_app", "POST", replies(question.id), { kind: "user", ctx: { access: { aud: "unrelated-synthetic-audience" } }, body: { text: "Yes." } });
  await no("TC-1553 cross-site", 403, "cross_site", "POST", replies(question.id), { kind: "user", headers: { "Sec-Fetch-Site": "cross-site" }, body: { text: "Yes." } });
  await no("TC-1554 user-only", 403, "user_only", "POST", replies(question.id), { body: { text: "Settled.", settles: true } }, { needs: "user" });
  await no("TC-1555 no-kind", 403, "no_kind", "POST", replies(question.id), { kind: "neither", body: { text: "Yes." } });
  // TC-1556 to TC-1558: what the request names does not exist.
  await no("TC-1556 comment-not-found", 404, "comment_not_found", "POST", replies("nc_3a6d9g2j5m8r"), { kind: "user", body: { text: "Yes." } });
  await no("TC-1557 project-not-found", 404, "project_not_found", "POST", "/api/spaces/nope/comments/" + question.id + "/replies", { kind: "user", body: { text: "Yes." } });
  await no("TC-1558 space-not-found", 404, "space_not_found", "POST", "/api/spaces/legacy-shop/comments/" + question.id + "/replies", { kind: "user", body: { text: "Yes." } });
  // TC-1559 to TC-1564: claims, state and limits.
  const whole = (await call("POST", SPACE + "/comments", { kind: "user", body: { part: "sample", stage: "04-functional-spec", item: "", text: "Is ten lines enough?" } })).data;
  const twice = await no("TC-1559 checkpoint-requested", 409, "checkpoint_requested", "POST", replies(whole.id), { body: ask() }, { comment: asked.id });
  assert.equal(twice.data.detail, `stage 04-functional-spec of sample has an open checkpoint request, ${asked.id}; ask again as a reply on it`);
  const closed = (await call("POST", SPACE + "/comments", { kind: "user", body: { ...USER_COMMENT, text: "Who claims?" } })).data;
  assert.equal((await call("POST", SPACE + "/comments/" + closed.id + "/answered", { body: {} })).status, 200);
  await no("TC-1560 comment-closed", 409, "comment_closed", "POST", replies(closed.id), { body: { text: "One more thing." } });
  fillReplies(db, whole.id);
  await no("TC-1561 reply-limit", 409, "reply_limit", "POST", replies(whole.id), { kind: "user", body: { text: "Yes." } }, { limit: 200 });
  const kept = spaceBytes(db);
  db.prepare("UPDATE project_spaces SET text_bytes = ? WHERE project = 'acme'").run(8 * 1024 * 1024 - 3);
  await no("TC-1562 space-full", 409, "space_full", "POST", replies(question.id), { kind: "user", body: { text: "Yes, rename it." } }, { limit: 8 * 1024 * 1024 });
  db.prepare("UPDATE project_spaces SET text_bytes = ? WHERE project = 'acme'").run(kept);
  const claim = await call("POST", SPACE + "/claims/" + question.id, { session: "s-2" });
  assert.equal(claim.status, 200);
  await no("TC-1563 claimed", 409, "claimed", "POST", replies(question.id), { session: "s-1", body: { text: "I take it." } }, { ends_at: claim.data.ends_at });
  assert.equal((await call("POST", SPACE + "/comments", { kind: "user", write: "nw_6t9w2z5c8f1j", body: { ...USER_COMMENT, text: "Another question." } })).status, 201);
  await no("TC-1564 write-id-reused", 409, "write_id_reused", "POST", replies(question.id), { kind: "user", write: "nw_6t9w2z5c8f1j", body: { text: "Yes." } });
  // TC-1565 to TC-1569: the body's size and type, the server's own error and the method.
  await no("TC-1565 text-too-long", 413, "text_too_long", "POST", replies(question.id), { kind: "user", body: { text: "x".repeat(4001) } }, { field: "text", limit: 4000 });
  await no("TC-1566 body-too-large", 413, "body_too_large", "POST", replies(question.id), { kind: "user", raw: JSON.stringify({ text: "Yes.", padding: "x".repeat(262144) }) }, { limit: 262144 });
  await no("TC-1567 json-required", 415, "json_required", "POST", replies(question.id), { kind: "user", body: { text: "Yes." }, headers: { "Content-Type": "text/plain" } });
  failing = true;
  await no("TC-1568 internal", 500, "internal", "POST", replies(question.id), { kind: "user", body: { text: "Yes." } });
  failing = false;
  const get = await no("TC-1569 method-not-allowed", 405, "method_not_allowed", "GET", replies(question.id), { kind: "user" });
  assert.equal(get.headers.get("Allow"), "POST");
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
  async function call(method, path, { body, kind = "agent", session = kind === "agent" ? "s-1" : null } = {}) {
    const headers = { "Cf-Access-Jwt-Assertion": tokens[kind], ...(session === null ? {} : { "Nexus-Session": session }) };
    if (method === "POST") headers["Idempotency-Key"] = '"nw_' + (++serial).toString().padStart(12, "0") + '"';
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await httpFetch(base + path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await response.text();
    return { status: response.status, headers: response.headers, text, data: text ? JSON.parse(text) : null };
  }
  assert.equal((await call("POST", "/api/snapshots", { body: acme() })).status, 200);
  return { call, memory: db.connection };
}

test("TC-1742: two checkpoint requests at once on the standalone server, and at the store two batches that both pass the check", async (t) => {
  const { call, memory } = await standalone(t);
  const [one, two] = await Promise.all([call("POST", SPACE + "/comments", { body: request("04-functional-spec") }),
    call("POST", SPACE + "/comments", { body: request("04-functional-spec", { text: "Stage 04 again.\nLook at SPEC-194 first." }) })]);
  const [first, second] = one.status === 201 ? [one, two] : [two, one];
  assert.deepEqual([first.status, second.status, second.data.code, second.data.comment], [201, 409, "checkpoint_requested", first.data.id]);
  assert.deepEqual(openRequests(memory).map((row) => row.id), [first.data.id], "the stage holds one open request");
  assert.equal(memory.prepare("SELECT COUNT(*) AS n FROM comments").get().n, 1);

  // At the store, both batches pass the receipt's check: the basis that both
  // plans read and that their receipts read again leaves out the stage's open
  // request. The index comments_request then fails the second batch whole.
  const db = new DatabaseSync(":memory:");
  const binding = fakeD1(db);
  const failures = [];
  const batch = binding.batch.bind(binding);
  binding.batch = async (statements) => {
    try { return await batch(statements); }
    catch (error) { failures.push(String(error.message)); throw error; }
  };
  const store = new Store(binding);
  await store.push(readSnapshot02(acme(), Date.now()));
  const basis = store.entryBasis.bind(store);
  store.entryBasis = (...args) => {
    const query = basis(...args);
    const sql = query.sql.replace(/'request',CASE WHEN t\.request=1 THEN \(SELECT r\.id[\s\S]*?ORDER BY r\.id LIMIT 1\) END,/, "'request',NULL,");
    assert.notEqual(sql, query.sql, "the basis leaves out the open request");
    return { ...query, sql };
  };
  const write = (id, text) => store.writeEntry("comment", "acme", null, request("04-functional-spec", { text }), { kind: "agent", session: "s-1", write: id });
  const results = await Promise.allSettled([write("nw_000000000001", "First.\nLook at SPEC-194 first."), write("nw_000000000002", "Second.\nLook at SPEC-194 first.")]);
  const kept = results.find((result) => result.status === "fulfilled");
  const lost = results.find((result) => result.status === "rejected");
  assert.ok(kept && lost, "one request is stored and the other refused");
  assert.deepEqual([kept.value.status, lost.reason.code, lost.reason.status, lost.reason.fields.comment], [201, "checkpoint_requested", 409, kept.value.body.id]);
  assert.equal(failures.length, 1, "one batch failed");
  assert.match(failures[0], /UNIQUE constraint failed: comments\.project, comments\.part, comments\.stage/, "at the index comments_request");
  assert.deepEqual(db.prepare("SELECT id FROM comments").all().map((row) => row.id), [kept.value.body.id], "nothing of the second batch is stored");
  const lostWrite = results.indexOf(lost) === 0 ? "nw_000000000001" : "nw_000000000002";
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM writes WHERE id = ?").get(lostWrite).n, 0, "not even its write ID");
  assert.equal(db.prepare("SELECT text_bytes FROM project_spaces").get().text_bytes, utf8(kept.value.body.text, "SPEC-194"));

  // Without the index, the receipt's check alone keeps a stage to one open
  // request: a write planned before another request on its stage was stored
  // has its batch run after it, so that its receipt reads another basis and
  // nothing of it is stored; planned again, it is refused with the open one.
  db.exec("DROP INDEX comments_request");
  store.entryBasis = basis;
  let release = null;
  const gate = new Promise((resolve) => { release = resolve; });
  const ungated = binding.batch;
  let held = 0;
  binding.batch = async (statements) => {
    if (!held && statements.some((statement) => (statement.params || []).includes("nw_000000000004"))) { held++; await gate; }
    return ungated(statements);
  };
  const prd = (id, text) => store.writeEntry("comment", "acme", null, request("02-prd", { text }), { kind: "agent", session: "s-1", write: id });
  const late = prd("nw_000000000004", "Late.\nLook at SPEC-194 first.").catch((error) => error);
  while (!held) await new Promise((resolve) => setTimeout(resolve, 1));
  const early = await prd("nw_000000000003", "Early.\nLook at SPEC-194 first.");
  assert.equal(early.status, 201);
  release();
  const answer = await late;
  assert.deepEqual([answer.code, answer.fields?.comment], ["checkpoint_requested", early.body.id], "the late write is refused with the open request");
  assert.equal(failures.length, 1, "no other batch failed");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM writes WHERE id = 'nw_000000000004'").get().n, 0, "nothing of it is stored");
  assert.deepEqual(openRequests(db).map((row) => [row.id, row.stage]), [[early.body.id, "02-prd"], [kept.value.body.id, "04-functional-spec"]]);
});

test("TC-1743: a checkpoint request at the limits of its text, on the standalone server", async (t) => {
  const { call, memory } = await standalone(t);
  // Ten lines and 1,200 characters, counted as code points: the first line
  // holds a character that UTF-16 holds in two units.
  const line = (n) => "가나다라마바사아자차".repeat(Math.ceil(n / 10)).slice(0, n);
  const lines = [line(118) + "😀", ...Array(8).fill(line(119)), line(120)];
  const most = lines.join("\n");
  assert.deepEqual([Array.from(most).length, most.length, most.split("\n").length], [1200, 1201, 10]);
  const fits = await call("POST", SPACE + "/comments", { body: request("02-prd", { text: most }) });
  assert.equal(fits.status, 201, fits.text);
  assert.equal(fits.data.text, most);
  const before = shape(memory);
  for (const [label, text, status, code, field] of [["11 lines", Array(11).fill("A line").join("\n"), 400, "invalid_request", "text"],
    ["1,201 characters", most + "가", 400, "invalid_request", "text"], ["more than 4,000 characters", "x".repeat(4001), 413, "text_too_long", "text"]]) {
    const result = await call("POST", SPACE + "/comments", { body: request("04-functional-spec", { text }) });
    assert.deepEqual([result.status, result.data.code, result.data.field], [status, code, field], label);
    assert.equal(shape(memory), before, label + ": a refusal stores nothing");
  }
  assert.deepEqual(openRequests(memory).map((row) => row.stage), ["02-prd"]);
});

test("TC-1744: the thing to look at first in each form, on the standalone server", async (t) => {
  const { call, memory } = await standalone(t);
  const long = "https://example.com/" + "a".repeat(2000 - "https://example.com/".length);
  const page = "https://nexus.example.com/p/acme/sample/05-erd";
  for (const [stage, look] of [["04-functional-spec", "SPEC-194"], ["02-prd", long], ["05-erd", page]]) {
    const spent = spaceBytes(memory);
    const result = await call("POST", SPACE + "/comments", { body: request(stage, { look_first: look }) });
    assert.equal(result.status, 201, stage + ": " + result.text);
    assert.equal(result.data.look_first, look, stage + ": the answer holds look_first");
    assert.equal(memory.prepare("SELECT look_first FROM comments WHERE id = ?").get(result.data.id).look_first, look);
    assert.equal(spaceBytes(memory) - spent, utf8(result.data.text, look), stage + ": look_first counts in the space's text");
  }
  const before = shape(memory);
  const { look_first: _, ...left } = request("06-api");
  for (const [label, sent, field] of [["an ID that no stage holds", request("06-api", { look_first: "SPEC-999" }), "look_first"],
    ["an item outside the 13 stages", request("06-api", { look_first: "NOTE-001" }), "look_first"],
    ["an https address of 2,001 characters", request("06-api", { look_first: long + "a" }), "look_first"],
    ["an http address", request("06-api", { look_first: "http://example.com/stage-06" }), "look_first"],
    ["left out", left, "look_first"],
    ["a comment that asks for no checkpoint", { ...USER_COMMENT, asks: "answer", look_first: "TBL-001" }, "look_first"],
    ["a request on an item", request("06-api", { item: "TBL-001" }), "item"]]) {
    const result = await call("POST", SPACE + "/comments", { body: sent });
    assert.deepEqual([result.status, result.data.code, result.data.field], [400, "invalid_request", field], label);
    assert.equal(shape(memory), before, label + ": a refusal stores nothing");
  }
});

test("TC-1745: a reply that asks for the checkpoint again, on the standalone server", async (t) => {
  const { call, memory } = await standalone(t);
  const asked = (await call("POST", SPACE + "/comments", { body: request("04-functional-spec") })).data;
  assert.equal((await call("POST", SPACE + "/comments/" + asked.id + "/replies", { kind: "user", body: { text: "Not yet: say what a refused pass shows." } })).status, 201);
  assert.deepEqual(openRequests(memory), [], "after the user's reply the stage has no open request");
  const text = "SPEC-194 now says what the page shows after a refused pass.\nLook at SPEC-194 first.";
  const again = await call("POST", SPACE + "/comments/" + asked.id + "/replies", { body: { text, asks: "checkpoint", look_first: "SPEC-194" } });
  assert.equal(again.status, 201, again.text);
  assert.deepEqual([again.data.comment.asks, again.data.comment.waits, again.data.reply.seq, again.data.reply.look_first], ["checkpoint", "user", 2, "SPEC-194"]);
  const thread = (await call("GET", SPACE + "/comments/" + asked.id, { kind: "user" })).data;
  assert.deepEqual(thread.replies.at(-1), again.data.reply, "the reply is the request's last entry");
  assert.deepEqual(openRequests(memory).map((row) => row.id), [asked.id], "the comment is the stage's open request again");
  // Such a reply on the user's comment on an item, and on the user's second
  // comment on the stage as a whole while the first is the open request.
  const question = (await call("POST", SPACE + "/comments", { kind: "user", body: USER_COMMENT })).data;
  const whole = (await call("POST", SPACE + "/comments", { kind: "user", body: { part: "sample", stage: "04-functional-spec", item: "", text: "Is ten lines enough?" } })).data;
  const before = shape(memory);
  const onItem = await call("POST", SPACE + "/comments/" + question.id + "/replies", { body: { text: "Pass it?", asks: "checkpoint", look_first: "TBL-001" } });
  assert.deepEqual([onItem.status, onItem.data.code, onItem.data.field], [400, "invalid_request", "asks"]);
  const second = await call("POST", SPACE + "/comments/" + whole.id + "/replies", { body: { text: "Pass it?", asks: "checkpoint", look_first: "SPEC-194" } });
  assert.deepEqual([second.status, second.data.code, second.data.comment], [409, "checkpoint_requested", asked.id]);
  assert.equal(shape(memory), before, "the 400 and the 409 store nothing");
  assert.deepEqual(openRequests(memory).map((row) => row.id), [asked.id]);
});
