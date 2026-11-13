// API-159 takeRecommendation (TASK-270, TASK-302): the user takes the agent's
// recommendation in one write with its write ID, and under D17 passes no
// checkpoint, which is passed with API-128 on what the user saw; against
// synthetic snapshots in an in-memory SQLite database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { handle } from "../src/app.js";
import { fakeD1 } from "./fake-d1.js";
import { testAccess } from "./access-fixture.js";

const template = readFileSync(new URL("../src/hub.html", import.meta.url), "utf8");
// One set of synthetic Access keys for the file: the verifier keeps the keys it read.
const access = await testAccess();
const SPACE = "/api/spaces/corthex";
const COMMIT = "3f1c9a7e5b2d4c6a8e0f1b3d5c7a9e1f2b4d6c8a";
const COMMON = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY", "X-Robots-Tag": "noindex, nofollow", "Cross-Origin-Resource-Policy": "same-origin" };
const RAY = "0123456789abcdef-ICN";

// An answer of 200: JSON, the common headers, no Problem and no error log.
function answered(result, label) {
  assert.equal(result.status, 200, label + ": " + result.text);
  assert.equal(result.headers.get("Content-Type"), "application/json; charset=utf-8", label);
  for (const [name, value] of Object.entries(COMMON)) assert.equal(result.headers.get(name), value, label + " " + name);
  assert.equal(result.data.traceId, undefined, label);
  assert.equal(result.logs.length, 0, label);
}
// A refusal: Problem Details with its code, status and trace, the common
// headers, and one log line with the kind and the trace (TC-1598, TC-1599,
// TC-1602 to TC-1609 and TC-1611).
function problem(result, status, code, label) {
  assert.equal(result.status, status, label + ": " + result.text);
  assert.equal(result.headers.get("Content-Type"), "application/problem+json", label);
  for (const [name, value] of Object.entries(COMMON)) assert.equal(result.headers.get(name), value, label + " " + name);
  assert.deepEqual([result.data.code, result.data.status, result.data.traceId], [code, status, RAY], label);
  assert.equal(result.logs.length, 1, label);
  assert.deepEqual(result.logs[0][1], { kind: code, traceId: RAY }, label);
}

// The example 0.2 snapshot, whose parts are memory and nexus; a later push
// may name only nexus.
function corthex(parts = ["memory", "nexus"], generated = "2026-11-03T10:00:00+09:00") {
  const data = JSON.parse(readFileSync(new URL("./snapshot-02-example.json", import.meta.url), "utf8"));
  data.project.parts = parts;
  data.left_out = data.left_out.filter((row) => parts.includes(row.part));
  data.generated_at = generated;
  return data;
}
// A project that only a hub of 0.1 pushed, so it has no space.
const legacy = { schema: "corthex-hub/0.1", generated_at: "2026-01-12T10:00:00+09:00", project: { name: "acme-shop", title: "Acme Shop" },
  stages: {}, summary: { items: 0 }, items: [], checks: [] };

async function server(language, ...snapshots) {
  const db = new DatabaseSync(":memory:");
  const env = { ...access.env, DB: fakeD1(db), NEXUS_LANGUAGE: language };
  let serial = 0;
  async function call(method, path, { body, kind = "agent", write, headers = {} } = {}) {
    const sent = { ...access.headers(kind), "Cf-Ray": RAY, ...(kind === "agent" ? { "Nexus-Session": "recommendation-test" } : {}), ...headers };
    if (method === "POST" && !("Idempotency-Key" in headers)) sent["Idempotency-Key"] = '"' + (write || "nw_" + (++serial).toString().padStart(12, "0")) + '"';
    if (body !== undefined && !("Content-Type" in headers)) sent["Content-Type"] = "application/json";
    const request = new Request("https://nexus.example.com" + path, { method, headers: sent, ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }) });
    const logs = [], original = console.error;
    console.error = (...args) => logs.push(args);
    let response;
    try { response = await handle(request, env, access.ctx, template); }
    finally { console.error = original; }
    const text = await response.text();
    return { status: response.status, headers: response.headers, text, logs, data: text ? JSON.parse(text) : null };
  }
  for (const snapshot of snapshots) {
    const pushed = await call("POST", "/api/snapshots", { body: snapshot });
    assert.equal(pushed.status, 200, pushed.text);
  }
  // Every row of every table, to show that a refusal changes nothing.
  const shape = () => createHash("sha256").update(JSON.stringify(db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
    .map(({ name }) => [name, db.prepare(`SELECT * FROM "${name}"`).all().map((row) => JSON.stringify(row)).sort()]))).digest("hex");
  const count = (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  const bytes = () => db.prepare("SELECT text_bytes FROM project_spaces WHERE project='corthex'").get().text_bytes;
  // The agent's comment that asks something of the user, and its ID. A
  // checkpoint request is on the stage as a whole and names what to look at
  // first (SPEC-197).
  const ask = async (asks, part = "nexus", stage = "05-erd", item = asks === "checkpoint" ? "" : "TBL-111") =>
    (await call("POST", SPACE + "/comments", { body: { part, stage, item, text: "Rename the table claims to entry_claims?", ...(asks ? { asks } : {}),
      ...(asks === "checkpoint" ? { look_first: "TBL-111" } : {}) } })).data.id;
  const take = (id, options = {}) => call("POST", SPACE + "/comments/" + id + "/recommended", { kind: "user", ...options });
  return { db, call, shape, count, bytes, ask, take };
}

test("API-159 takes a recommendation: the user's reply in the server's words settles the comment, which then waits for the agent", async () => {
  for (const [language, words] of [["en", "As recommended"], ["ko-KR", "추천대로"]]) {
    const { call, count, bytes, ask, take } = await server(language, corthex());
    const id = await ask("recommended");
    // A session's claim on the comment does not hold the user back, and stays.
    assert.equal((await call("POST", SPACE + "/claims/" + id)).status, 200);
    const before = bytes();
    const taken = await take(id);
    answered(taken, "taken in " + language);
    const at = taken.data.reply.made_at;
    assert.deepEqual(taken.data, { comment: { id, state: "open", closed_as: null, waits: "agent", asks: null, last_at: at, settled: true, dismissed: false },
      reply: { seq: 1, author: "user", text: words, made_at: at, settles: true, look_first: null }, checkpoint: null, changed: true });
    assert.equal(bytes() - before, Buffer.byteLength(words), "the reply's words count in the space's text");
    assert.equal(count("checkpoints"), 0);
    const thread = (await call("GET", SPACE + "/comments/" + id)).data;
    assert.deepEqual([thread.waits, thread.asks, thread.settled, thread.replies], ["agent", null, true, [taken.data.reply]]);
    // The entry leaves my turn and joins the agent's to-do, still claimed.
    const home = (await call("GET", "/api/home")).data;
    assert.deepEqual([home.my_turn.total, home.agent[0].comments.total, home.agent[0].taken], [0, 1, 1]);
  }
});

test("API-159 refuses a checkpoint request as not_recommended and changes nothing: the request is passed with API-128", async () => {
  const { call, shape, count, ask, take } = await server("en", corthex());
  // The user's question on the stage as a whole, answered by the agent's reply that asks for the checkpoint.
  const id = (await call("POST", SPACE + "/comments", { kind: "user", body: { part: "nexus", stage: "04-functional-spec", item: "", text: "Can we pass stage 04?" } })).data.id;
  assert.equal((await call("POST", SPACE + "/comments/" + id + "/replies", { body: { text: "The rows stand as written; pass it?", asks: "checkpoint", look_first: "https://example.com/nexus/04-functional-spec" } })).status, 201);
  const whole = await ask("checkpoint", "", "02-prd", "");
  for (const request of [id, whole]) {
    const before = shape();
    const refused = await take(request);
    problem(refused, 409, "not_recommended", "a checkpoint request");
    assert.equal(refused.data.detail, "the comment does not wait for the user with a recommendation to take");
    assert.equal(shape(), before, "the refusal changes nothing");
  }
  // The request still waits for the user, first in my turn, and no checkpoint passed.
  const home = (await call("GET", "/api/home", { kind: "user" })).data;
  assert.deepEqual(home.my_turn.entries.map((entry) => [entry.id, entry.asks]), [[id, "checkpoint"], [whole, "checkpoint"]]);
  assert.deepEqual([count("checkpoints"), count("replies")], [0, 1]);
  // The pass names what the entry showed, the commit and the request's last entry, and settles it with the button's words.
  const passed = await call("POST", SPACE + "/checkpoints", { kind: "user", body: { part: "nexus", stage: "04-functional-spec", commit: COMMIT, comment: id, entry: 1 } });
  assert.equal(passed.status, 201, passed.text);
  assert.deepEqual([passed.data.comment, passed.data.entry, passed.data.words], [id, 1, null]);
  const thread = (await call("GET", SPACE + "/comments/" + id, { kind: "user" })).data;
  assert.deepEqual([thread.waits, thread.asks, thread.settled, thread.replies.at(-1).text], ["agent", null, true, "Pass the stage 04 checkpoint"]);
  // Taken again then, the request is no recommendation taken already.
  const after = await take(id);
  assert.deepEqual([after.status, after.data.code], [409, "not_recommended"]);
});

test("API-159 sent again leaves one result: the same write ID gives the first answer, and a new one changes nothing", async () => {
  const { shape, count, ask, take, call } = await server("en", corthex());
  const id = await ask("recommended");
  const first = await take(id, { write: "nw_aaaaaaaaaaaa" });
  assert.equal(first.status, 200, first.text);
  assert.deepEqual([first.data.changed, first.data.checkpoint], [true, null]);
  const after = shape();
  const repeated = await take(id, { write: "nw_aaaaaaaaaaaa" });
  answered(repeated, "sent again");
  assert.deepEqual(repeated.data, first.data);
  assert.equal(shape(), after, "the same write ID changes nothing");
  // Taken already: the same reply, with changed false; only the new write ID's receipt is kept.
  const again = await take(id);
  assert.deepEqual([again.status, again.data], [200, { ...first.data, changed: false }]);
  assert.deepEqual([count("replies"), count("checkpoints"), count("writes")], [1, 0, 3]);
  // Two takes at once with their own write IDs: one changes it, and the
  // other, planned again on the changed comment, finds it taken.
  const other = await ask("recommended");
  const both = await Promise.all([take(other), take(other)]);
  assert.deepEqual(both.map((answer) => answer.status), [200, 200]);
  assert.deepEqual(both.map((answer) => answer.data.changed).sort(), [false, true]);
  assert.deepEqual([count("replies"), count("checkpoints")], [2, 0]);
  // A write ID that another request used is refused.
  const reused = await call("POST", SPACE + "/comments/" + (await ask("recommended")) + "/replies", { kind: "user", write: "nw_bbbbbbbbbbbb", body: { text: "Yes." } });
  assert.equal(reused.status, 201);
  const refused = await take(await ask("recommended"), { write: "nw_bbbbbbbbbbbb" });
  problem(refused, 409, "write_id_reused", "a write ID of another request");
  // Once the agent answers the user's reply, the take no longer stands, and the comment waits for the user's answer.
  assert.equal((await call("POST", SPACE + "/comments/" + id + "/replies", { body: { text: "Renamed in the ERD." } })).status, 201);
  const gone = await take(id);
  assert.deepEqual([gone.status, gone.data.code], [409, "not_recommended"]);
});

test("API-159 gives a checkpoint passed with the press before the release as taken already, without the checkpoint", async () => {
  const { db, call, take } = await server("en", corthex());
  // Before TASK-302 the press passed the checkpoint with the reply at one time: the comment waits
  // for the agent after the user's reply in the words for "as recommended", which a checkpoint names.
  const at = "2026-11-12T08:31:12.204Z";
  db.prepare(`INSERT INTO comments (id,project,part,stage,item,quote,discrepancy,commit_id,author,text,state,closed_as,waits,asks,settled,dismissed,made_at,last_at,look_first)
    VALUES ('nc_eeeeeeeeeeee','corthex','nexus','04-functional-spec','',NULL,NULL,?,'agent','Pass stage 04?','open',NULL,'agent',NULL,1,0,?,?,NULL)`).run(COMMIT, "2026-11-12T08:00:00.000Z", at);
  db.prepare("INSERT INTO replies (comment,seq,author,text,settles,made_at,look_first) VALUES ('nc_eeeeeeeeeeee',1,'user','As recommended',1,?,NULL)").run(at);
  db.prepare(`INSERT INTO checkpoints (id,project,part,stage,commit_id,words,state,passed_at,comment,browser,device)
    VALUES ('nk_eeeeeeeeeeee','corthex','nexus','04-functional-spec',?,'As recommended','passed',?,'nc_eeeeeeeeeeee','unknown','unknown')`).run(COMMIT, at);
  const again = await take("nc_eeeeeeeeeeee");
  assert.deepEqual([again.status, again.data], [200, { comment: { id: "nc_eeeeeeeeeeee", state: "open", closed_as: null, waits: "agent", asks: null, settled: true, dismissed: false, last_at: at },
    reply: { seq: 1, author: "user", text: "As recommended", settles: true, made_at: at, look_first: null }, checkpoint: null, changed: false }]);
  // The checkpoint stands as it was.
  assert.equal((await call("GET", SPACE + "/checkpoints/nk_eeeeeeeeeeee", { kind: "user" })).data.state, "passed");
});

test("API-159 refuses a comment that asks nothing to take, as not_recommended, and changes nothing", async () => {
  const { call, shape, ask, take } = await server("en", corthex());
  const question = (await call("POST", SPACE + "/comments", { kind: "user", body: { part: "nexus", stage: "05-erd", item: "TBL-111", text: "Why claims?" } })).data.id;
  const answer = await ask("answer");
  const plain = await ask(null);
  const checkpoint = await ask("checkpoint");
  const closed = await ask("recommended");
  await call("POST", SPACE + "/comments/" + closed + "/answered", { body: {} });
  // Answered in another tab in the user's own words, or offered a proposal since.
  const replied = await ask("recommended");
  await call("POST", SPACE + "/comments/" + replied + "/replies", { kind: "user", body: { text: "Yes, rename it.", settles: true } });
  const proposed = await ask("recommended");
  assert.equal((await call("POST", SPACE + "/proposals", { body: { part: "nexus", stage: "05-erd", items: ["TBL-111"], reason: "Name it plainly", change: "Rename claims.", comment: proposed } })).status, 201);
  for (const [name, id] of Object.entries({ question, answer, plain, checkpoint, closed, replied, proposed })) {
    const before = shape();
    problem(await take(id), 409, "not_recommended", name);
    assert.equal(shape(), before, name + " changes nothing");
  }
});

test("API-159 keeps the refusals of API-119: limits and what does not exist; a part no longer held is no refusal of its own", async () => {
  const { call, db, shape, ask, take } = await server("en", corthex(), legacy);
  const memoryCheckpoint = await ask("checkpoint", "memory", "02-prd", "");
  const memoryRecommendation = await ask("recommended", "memory", "02-prd", "");
  const full = await ask("recommended");
  const limit = await ask("recommended");
  // A later push names only nexus: a checkpoint asked on memory is not_recommended as any
  // checkpoint request is, while a recommendation there is still a reply, as API-119 takes it.
  assert.equal((await call("POST", "/api/snapshots", { body: corthex(["nexus"], "2026-11-03T11:00:00+09:00") })).status, 200);
  // The comment holds 200 replies, the most that one holds.
  const insert = db.prepare("INSERT INTO replies(comment,seq,author,text,settles,made_at) VALUES (?,?,?,?,0,?)");
  for (let seq = 1; seq <= 200; seq++) insert.run(limit, seq, "agent", "Reply " + seq, "2026-11-03T01:00:00.000Z");
  const cases = [["not_recommended", 409, SPACE + "/comments/" + memoryCheckpoint],
    ["reply_limit", 409, SPACE + "/comments/" + limit],
    ["comment_not_found", 404, SPACE + "/comments/nc_000000000000"],
    ["project_not_found", 404, "/api/spaces/nope/comments/" + full],
    ["space_not_found", 404, "/api/spaces/acme-shop/comments/" + full]];
  for (const [code, status, path] of cases) {
    const before = shape();
    const refused = await call("POST", path + "/recommended", { kind: "user" });
    problem(refused, status, code, code);
    if (code === "reply_limit") assert.equal(refused.data.limit, 200);
    assert.equal(shape(), before, code + " changes nothing");
  }
  // The space's 8 MiB of text holds no more words.
  db.prepare("UPDATE project_spaces SET text_bytes=? WHERE project='corthex'").run(8 * 1024 * 1024 - 13);
  const before = shape();
  const crowded = await take(full);
  problem(crowded, 409, "space_full", "space_full");
  assert.equal(crowded.data.limit, 8 * 1024 * 1024);
  assert.equal(shape(), before);
  db.prepare("UPDATE project_spaces SET text_bytes=0 WHERE project='corthex'").run();
  const elsewhere = await take(memoryRecommendation);
  assert.deepEqual([elsewhere.status, elsewhere.data.checkpoint, elsewhere.data.comment.settled], [200, null, true]);
});

test("API-159 is the user's own: the service token, another site, no kind and no write ID are refused; no body is read", async () => {
  const { call, shape, ask, take } = await server("en", corthex());
  const id = await ask("recommended");
  const path = SPACE + "/comments/" + id + "/recommended";
  const before = shape();
  for (const [label, options, status, code, field] of [
    ["service token", { kind: "agent" }, 403, "user_only"],
    ["another site", { kind: "user", headers: { "Sec-Fetch-Site": "cross-site" } }, 403, "cross_site"],
    ["neither kind", { kind: "neither" }, 403, "no_kind"],
    ["no write ID", { kind: "user", headers: { "Idempotency-Key": "" } }, 400, "invalid_request", "Idempotency-Key"],
    ["a write ID in another form", { kind: "user", headers: { "Idempotency-Key": "nw_aaaaaaaaaaaa" } }, 400, "invalid_request", "Idempotency-Key"]]) {
    const refused = await call("POST", path, options);
    problem(refused, status, code, label);
    if (field) assert.equal(refused.data.field, field, label);
    assert.equal(shape(), before, label + " changes nothing");
  }
  const read = await call("GET", path, { kind: "user" });
  problem(read, 405, "method_not_allowed", "GET");
  assert.equal(read.headers.get("Allow"), "POST");
  // It takes no body: whatever is sent is not read.
  const taken = await take(id, { body: "not JSON", headers: { "Content-Type": "text/plain" } });
  assert.deepEqual([taken.status, taken.data.changed, taken.data.reply.text], [200, true, "As recommended"]);
});
