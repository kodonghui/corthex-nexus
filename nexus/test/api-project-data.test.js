// API-177 getProjectData and API-178 exportProject (TASK-310, SPEC-201,
// SPEC-203): SPEC-201's criteria (TC-1463 to TC-1466), each response of the
// two requests (TC-1647 to TC-1662), the export asked for from another site
// and with the service token (TC-1751, TC-1752), twice in a row (TC-1753) and
// compared with what the space holds (TC-1754), and the project's data beside
// the dry run and the export (TC-1756). Synthetic projects only; the Access
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
const SESSION = "export-session-1";
const HEAD = ["format", "project", "commit", "exported_at", "read_at", "space", "counts", "comments", "proposals", "edits", "checkpoints"];
const DATA = ["project", "title", "repository", "commit", "revision", "generated_at", "pushed_at", "space", "read_at", "read_session", "unread_since", "removal"];
const KINDS = ["comments", "replies", "decisions", "proposals", "edits", "checkpoints"];
const FILE = /^attachment; filename="nexus-([a-z0-9-]+)-([0-9]{4}-[0-9]{2}-[0-9]{2})\.json"$/;
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
// The members that the export must never hold, at any depth (SPEC-201).
function keys(value, found = new Set()) {
  if (Array.isArray(value)) value.forEach((member) => keys(member, found));
  else if (value && typeof value === "object") for (const [name, member] of Object.entries(value)) { found.add(name); keys(member, found); }
  return found;
}
const NEVER = ["snapshot", "pictures", "picture", "discrepancies", "claim", "claims", "claimed_at", "ends_at", "session", "read_session",
  "write", "write_id", "last_report", "content", "sub", "common_name", "email", "identity", "body", "source"];

// The server as the Worker build runs it, in this process: handle() over D1's
// interface on an in-memory SQLite database. fail() makes the next batches throw.
function inProcess() {
  const db = new DatabaseSync(":memory:");
  const binding = fakeD1(db);
  let failing = false;
  const batch = binding.batch.bind(binding);
  binding.batch = async (statements) => { if (failing) throw new Error("synthetic failure"); return batch(statements); };
  const env = { ...access.env, DB: binding, NEXUS_LANGUAGE: "en" };
  let serial = 0;
  async function call(method, path, { body, kind = "agent", session = SESSION, ctx = access.ctx, headers = {} } = {}) {
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
  return { db, call, fail: (value = true) => { failing = value; } };
}

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
  const tokens = { user: await sign({ sub: "synthetic-person" }), agent: await sign({ sub: "", common_name: "synthetic-client" }), neither: await sign({}) };
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
  async function call(method, path, { body, kind = "agent", session = SESSION, headers = {} } = {}) {
    const sent = { "Cf-Access-Jwt-Assertion": tokens[kind], ...(session === null ? {} : { "Nexus-Session": session }), ...headers };
    if (method === "POST") sent["Idempotency-Key"] = '"nw_' + (++serial).toString().padStart(12, "0") + '"';
    if (body !== undefined) sent["Content-Type"] = "application/json";
    const response = await httpFetch(base + path, { method, headers: sent, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await response.text();
    return { status: response.status, headers: response.headers, text, data: text && /json/.test(response.headers.get("Content-Type") || "") ? JSON.parse(text) : null };
  }
  return { call, memory: db.connection };
}

// A space with what SPEC-201's first criterion names, and more: the agent's
// read with its session label, 3 comments, one of them with 2 replies and a
// recorded decision, 1 open proposal, 1 accepted proposal whose reflection is
// in review with its report, 1 checkpoint passed in NEXUS, and a claim.
async function seed(call, project = "acme") {
  const ok = async (result, status, label) => { assert.equal(result.status, status, label + ": " + result.text); return result.data; };
  await ok(await call("POST", "/api/snapshots", { body: viewSnapshot(project) }), 200, "push");
  await ok(await call("GET", `/api/spaces/${project}/todo`), 200, "the agent's read");
  const asked = await ok(await call("POST", `/api/spaces/${project}/comments`, { kind: "user", session: null,
    body: { part: "sample", stage: "05-erd", item: "TBL-001", text: "Should an order keep its reference?" } }), 201, "a user's comment");
  await ok(await call("POST", `/api/spaces/${project}/comments/${asked.id}/replies`, { body: { text: "Yes: the reference is what the buyer sees." } }), 201, "the agent's reply");
  await ok(await call("POST", `/api/spaces/${project}/comments/${asked.id}/replies`, { kind: "user", session: null, body: { text: "Agreed, keep it." } }), 201, "the user's reply");
  await ok(await call("POST", `/api/spaces/${project}/comments/${asked.id}/decisions`, { body: { link: "https://github.com/example/qa-shop/pull/1", text: "Keep the reference." } }), 201, "a decision");
  const agentSide = await ok(await call("POST", `/api/spaces/${project}/comments`, { body: { part: "sample", stage: "05-erd", item: "TBL-002", text: "Payments keep the order's ID." } }), 201, "the agent's comment");
  const open = await ok(await call("POST", `/api/spaces/${project}/comments`, { kind: "user", session: null,
    body: { part: "sample", stage: "07-sitemap", item: "SCR-001", text: "Does the home screen list the orders?" } }), 201, "an open comment");
  await ok(await call("POST", `/api/spaces/${project}/claims/${open.id}`), 200, "a claim");
  const waiting = await ok(await call("POST", `/api/spaces/${project}/proposals`, { body: { part: "sample", stage: "05-erd", items: ["TBL-001"], reason: "The glossary names it orders.", change: "Keep the table's name." } }), 201, "an open proposal");
  const taken = await ok(await call("POST", `/api/spaces/${project}/proposals`, { body: { part: "sample", stage: "05-erd", items: ["TBL-002"], reason: "Payments belong to an order.", change: "Name the column order_id." } }), 201, "a second proposal");
  const accepted = await ok(await call("POST", `/api/spaces/${project}/proposals/${taken.id}/accept`, { kind: "user", session: null }), 200, "an acceptance");
  await ok(await call("POST", `/api/spaces/${project}/edits/${accepted.edit.id}/report`, { body: { event: "opened", pull_request: "https://github.com/example/qa-shop/pull/2" } }), 200, "a report");
  const passed = await ok(await call("POST", `/api/spaces/${project}/checkpoints`, { kind: "user", session: null, body: { part: "sample", stage: "01-domain", commit: "a".repeat(40) } }), 201, "a pass");
  return { comments: [asked.id, agentSide.id, open.id], proposals: [waiting.id, taken.id], edit: accepted.edit.id, checkpoint: passed.id };
}

// A 200 answer: JSON, the common headers, no Problem and no error log.
function answered(result, label) {
  assert.equal(result.status, 200, label);
  assert.equal(result.headers.get("Content-Type"), "application/json; charset=utf-8", label);
  for (const [name, value] of Object.entries(COMMON)) assert.equal(result.headers.get(name), value, label + " " + name);
  if (result.data) assert.equal(result.data.traceId, undefined, label);
  if (result.logs) assert.equal(result.logs.length, 0, label);
}
// A refusal: Problem Details with its code, status and trace, one log line
// with the kind and the trace, no part of a file, and nothing changed.
function refused(result, status, code, label) {
  assert.equal(result.status, status, label);
  assert.equal(result.headers.get("Content-Type"), "application/problem+json", label);
  for (const [name, value] of Object.entries(COMMON)) assert.equal(result.headers.get(name), value, label + " " + name);
  assert.equal(result.headers.get("Content-Disposition"), null, label + " sends no file");
  assert.equal(result.data.code, code, label);
  assert.equal(result.data.status, status, label);
  for (const member of ["format", "counts", "comments", "removal"]) assert.equal(result.data[member], undefined, label + " holds no " + member);
  if (result.logs) {
    assert.equal(result.data.traceId, RAY, label);
    assert.equal(result.logs.length, 1, label);
    assert.deepEqual(result.logs[0][1], { kind: code, traceId: RAY }, label);
  }
}
// An export: a file named by the project and the date of exported_at in UTC.
function exported(result, project, label) {
  answered(result, label);
  const name = FILE.exec(result.headers.get("Content-Disposition") || "");
  assert.ok(name, label + ": Content-Disposition names the file");
  assert.equal(name[1], project, label);
  assert.equal(name[2], result.data.exported_at.slice(0, 10), label + ": the date of exported_at in UTC");
  assert.deepEqual(Object.keys(result.data), HEAD, label + ": the members in stage 06's order");
  assert.equal(result.data.format, 1, label);
  return result.data;
}

test("TC-1463 to TC-1466: SPEC-201's export holds the space's entries under the user's own sign-in, is the same twice but for its time, and is 404 for an unknown project", async (t) => {
  const { db, call } = inProcess();
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-11-20T10:00:00.000Z") });
  const ids = await seed(call);
  t.mock.timers.tick(60000);
  const before = shape(db);
  const first = await call("GET", "/api/spaces/acme/export", { kind: "user", session: null });
  const file = exported(first, "acme", "TC-1463");
  assert.equal(first.headers.get("Content-Disposition"), 'attachment; filename="nexus-acme-2026-11-20.json"', "TC-1463");
  assert.deepEqual([file.project, file.commit, file.exported_at], ["acme", "a".repeat(40), "2026-11-20T10:01:00.000Z"], "TC-1463 names the project, the commit and the time");
  assert.deepEqual(file.counts, { comments: 3, replies: 2, decisions: 1, proposals: 2, edits: 1, checkpoints: 1 }, "TC-1463");
  // The clock stands still while the space is seeded, so the entries tie on their times and come by ID.
  const order = (table) => db.prepare(`SELECT id FROM ${table} WHERE project='acme' ORDER BY made_at, id`).all().map((row) => row.id);
  assert.deepEqual(file.comments.map((entry) => entry.id), order("comments"), "TC-1463: the three comments, by made_at and ID");
  assert.deepEqual(file.comments.map((entry) => entry.id).sort(), [...ids.comments].sort(), "TC-1463: the three comments");
  assert.deepEqual(file.comments.map((entry) => [entry.id, entry.replies.length]).filter(([, n]) => n), [[ids.comments[0], 2]], "TC-1463: one comment with its two replies");
  assert.deepEqual(file.proposals.map((entry) => entry.id), order("proposals"), "TC-1463: the proposals, by made_at and ID");
  assert.deepEqual(file.proposals.filter((entry) => entry.state === "open").map((entry) => entry.id), [ids.proposals[0]], "TC-1463: the open proposal");
  assert.deepEqual(file.checkpoints.map((entry) => entry.id), [ids.checkpoint], "TC-1463: the checkpoint passed in NEXUS");
  const held = keys(file);
  for (const name of NEVER) assert.equal(held.has(name), false, "TC-1463 holds no " + name);
  for (const text of [SESSION, "synthetic-person", "synthetic-client", "@", "nw_"]) assert.equal(first.text.includes(text), false, "TC-1463 holds no " + text);
  // TC-1464: the same request with the service token, and with neither kind.
  for (const kind of ["agent", "neither"]) {
    const no = await call("GET", "/api/spaces/acme/export", { kind });
    refused(no, 403, "user_only", "TC-1464 " + kind);
    assert.equal(no.data.needs, "user", "TC-1464 " + kind);
  }
  // TC-1465: a second export a second later differs only in exported_at.
  t.mock.timers.tick(1000);
  const second = exported(await call("GET", "/api/spaces/acme/export", { kind: "user", session: null }), "acme", "TC-1465");
  assert.equal(second.exported_at, "2026-11-20T10:01:01.000Z", "TC-1465");
  assert.deepEqual({ ...second, exported_at: file.exported_at }, file, "TC-1465: the same but for the time");
  assert.equal(shape(db), before, "TC-1465: the exports change nothing and keep no copy");
  // TC-1466: a project that the server does not hold.
  refused(await call("GET", "/api/spaces/unknown/export", { kind: "user", session: null }), 404, "project_not_found", "TC-1466");
});

test("TC-1647 to TC-1653: each response of API-177, under either sign-in, recording nothing", async () => {
  const { db, call, fail } = inProcess();
  const ids = await seed(call);
  assert.equal((await call("POST", "/api/snapshots", { body: legacy("legacy-shop") })).status, 200);
  const before = shape(db), read = lastRead(db, "acme");
  // TC-1647: a space, as the user, the agent and an identity of neither kind read it.
  const answers = [];
  for (const kind of ["user", "agent", "neither"]) {
    const result = await call("GET", "/api/spaces/acme/data", { kind, session: kind === "agent" ? SESSION : null });
    answered(result, "TC-1647 " + kind);
    assert.deepEqual(Object.keys(result.data), DATA, "TC-1647 " + kind + ": the members in the contract's order");
    answers.push(result.data);
  }
  assert.deepEqual(answers[1], answers[0], "TC-1647: the agent reads what the user reads");
  assert.deepEqual(answers[2], answers[0], "TC-1647: so does an identity of neither kind");
  const data = answers[0];
  assert.equal(data.space, true);
  assert.deepEqual([data.read_at, data.read_session], [read.read_at, SESSION], "TC-1647: the agent's last read with its label");
  const home = (await call("GET", "/api/home", { kind: "user", session: null })).data;
  const card = home.projects.find((entry) => entry.name === "acme");
  assert.deepEqual([data.title, data.repository, data.commit, data.revision, data.generated_at, data.pushed_at],
    [card.title, card.repository, card.commit, card.revision, card.generated_at, card.pushed_at], "TC-1647: the stored snapshot as its card gives it");
  assert.equal(data.unread_since, home.agent.find((entry) => entry.project === "acme").unread_since, "TC-1647: the oldest unread time, as the first page counts it");
  assert.ok(data.unread_since > data.read_at, "TC-1647: the checkpoint passed after the read waits unread");
  assert.deepEqual(data.removal.open.comments, { total: 2, ids: [ids.comments[1], ids.comments[2]].sort() }, "TC-1647: the open comments by ID");
  assert.deepEqual(data.removal.open.reflections, { total: 1, ids: [ids.edit] }, "TC-1647: the reflection in review");
  // HEAD: the same status and headers, no body.
  const head = await call("HEAD", "/api/spaces/acme/data", { kind: "user", session: null });
  answered(head, "TC-1647 HEAD");
  assert.equal(head.text, "", "TC-1647 HEAD has no body");
  assert.equal(shape(db), before, "TC-1647: GET and HEAD change nothing");
  assert.deepEqual(lastRead(db, "acme"), read, "TC-1647: the read records nothing");
  // TC-1648: a snapshot and no space.
  const bare = await call("GET", "/api/spaces/legacy-shop/data", { kind: "user", session: null });
  answered(bare, "TC-1648");
  assert.deepEqual([bare.data.space, bare.data.read_at, bare.data.read_session, bare.data.unread_since, bare.data.commit, bare.data.title],
    [false, null, null, null, null, "Legacy shop"], "TC-1648");
  assert.deepEqual(bare.data.removal, (await call("GET", "/api/snapshots/legacy-shop/removal")).data, "TC-1648: the dry run's answer");
  assert.equal(bare.data.removal.deletes.space, false);
  for (const kind of ["pictures", "discrepancies", ...KINDS]) assert.equal(bare.data.removal.deletes[kind], 0, "TC-1648 counts no " + kind);
  // TC-1649, TC-1650: Access did not check the request, or checked it for another application.
  refused(await call("GET", "/api/spaces/acme/data", { ctx: {} }), 403, "access_missing", "TC-1649");
  refused(await call("GET", "/api/spaces/acme/data", { ctx: { access: { aud: "unrelated-synthetic-audience" } } }), 403, "access_other_app", "TC-1650");
  // TC-1651: an unknown project, and a name in another form.
  refused(await call("GET", "/api/spaces/unknown/data"), 404, "project_not_found", "TC-1651");
  refused(await call("GET", "/api/spaces/Unknown/data"), 404, "project_not_found", "TC-1651 another form");
  // TC-1652: the server cannot read.
  fail();
  const broken = await call("GET", "/api/spaces/acme/data");
  fail(false);
  refused(broken, 500, "internal", "TC-1652");
  // TC-1653: a method that the path does not take.
  const post = await call("POST", "/api/spaces/acme/data", { body: {} });
  refused(post, 405, "method_not_allowed", "TC-1653");
  assert.equal(post.headers.get("Allow"), "GET, HEAD", "TC-1653");
  assert.equal(shape(db), before, "TC-1649 to TC-1653 change nothing");
});

test("TC-1654 to TC-1662: each response of API-178, whose file holds the space's entries whole", async (t) => {
  const { db, call, fail } = inProcess();
  const ids = await seed(call);
  assert.equal((await call("POST", "/api/snapshots", { body: legacy("legacy-shop") })).status, 200);
  const before = shape(db);
  // TC-1654: the space; GET and HEAD.
  const result = await call("GET", "/api/spaces/acme/export", { kind: "user", session: null });
  const file = exported(result, "acme", "TC-1654");
  assert.equal(file.space, true);
  assert.equal(file.read_at, lastRead(db, "acme").read_at, "TC-1654: the agent's last read");
  const head = await call("HEAD", "/api/spaces/acme/export", { kind: "user", session: null });
  answered(head, "TC-1654 HEAD");
  assert.equal(head.text, "", "TC-1654 HEAD has no body");
  assert.match(head.headers.get("Content-Disposition"), FILE, "TC-1654 HEAD names the file");
  // Every entry is whole: as the entry's own read gives it (API-114 to API-117).
  for (const comment of file.comments) {
    const { proposals, ...thread } = (await call("GET", `/api/spaces/acme/comments/${comment.id}`)).data;
    assert.deepEqual(comment, thread, "TC-1654: comment " + comment.id);
  }
  for (const proposal of file.proposals) assert.deepEqual(proposal, (await call("GET", `/api/spaces/acme/proposals/${proposal.id}`)).data, "TC-1654: proposal " + proposal.id);
  for (const edit of file.edits) {
    const read = (await call("GET", `/api/spaces/acme/edits/${edit.id}`)).data;
    assert.deepEqual(edit, { ...read, proposal: read.proposal.id }, "TC-1654: edit " + edit.id);
  }
  for (const checkpoint of file.checkpoints) assert.deepEqual(checkpoint, (await call("GET", `/api/spaces/acme/checkpoints/${checkpoint.id}`)).data, "TC-1654: checkpoint " + checkpoint.id);
  assert.deepEqual(file.edits.map((edit) => [edit.id, edit.state, edit.pull_request]), [[ids.edit, "in-review", "https://github.com/example/qa-shop/pull/2"]]);
  for (const proposal of file.proposals) assert.deepEqual(["source_text" in proposal, "source_text_chars" in proposal], [true, false], "TC-1654: a proposal with its stage source text");
  assert.equal(shape(db), before, "TC-1654: GET and HEAD change nothing");
  // TC-1655: a snapshot and no space.
  const bare = exported(await call("GET", "/api/spaces/legacy-shop/export", { kind: "user", session: null }), "legacy-shop", "TC-1655");
  assert.deepEqual({ ...bare, exported_at: null }, { format: 1, project: "legacy-shop", commit: null, exported_at: null, read_at: null, space: false,
    counts: { comments: 0, replies: 0, decisions: 0, proposals: 0, edits: 0, checkpoints: 0 }, comments: [], proposals: [], edits: [], checkpoints: [] }, "TC-1655");
  // TC-1656: the service token.
  const token = await call("GET", "/api/spaces/acme/export");
  refused(token, 403, "user_only", "TC-1656");
  assert.equal(token.data.needs, "user", "TC-1656");
  // TC-1657, TC-1658: Access.
  refused(await call("GET", "/api/spaces/acme/export", { kind: "user", ctx: {} }), 403, "access_missing", "TC-1657");
  refused(await call("GET", "/api/spaces/acme/export", { kind: "user", ctx: { access: { aud: "unrelated-synthetic-audience" } } }), 403, "access_other_app", "TC-1658");
  // TC-1659: asked from a page of another site.
  const cross = await call("GET", "/api/spaces/acme/export", { kind: "user", session: null, headers: { "Sec-Fetch-Site": "cross-site" } });
  refused(cross, 403, "cross_site", "TC-1659");
  assert.equal(cross.data.title, "A request from another site", "TC-1659: the code's title since the export");
  // TC-1660: a project that the server does not hold.
  refused(await call("GET", "/api/spaces/unknown/export", { kind: "user", session: null }), 404, "project_not_found", "TC-1660");
  // TC-1661: the server cannot build the file, and sends no part of one.
  fail();
  const broken = await call("GET", "/api/spaces/acme/export", { kind: "user", session: null });
  fail(false);
  refused(broken, 500, "internal", "TC-1661");
  // TC-1662: a method that the path does not take.
  const removal = await call("DELETE", "/api/spaces/acme/export", { kind: "user", session: null });
  refused(removal, 405, "method_not_allowed", "TC-1662");
  assert.equal(removal.headers.get("Allow"), "GET, HEAD", "TC-1662");
  assert.equal(shape(db), before, "TC-1655 to TC-1662 change nothing");
  t.diagnostic(`export of ${file.counts.comments} comments, ${file.counts.replies} replies and ${file.counts.checkpoints} checkpoint: ${result.text.length} characters`);
});

test("TC-1751, TC-1752: the export from another site and under another sign-in, on the standalone server", async (t) => {
  const { call, memory } = await standalone(t);
  await seed(call);
  const before = shape(memory);
  const ask = (kind, site) => call("GET", "/api/spaces/acme/export", { kind, session: null, headers: site ? { "Sec-Fetch-Site": site } : {} });
  for (const site of ["cross-site", "same-site"]) refused(await ask("user", site), 403, "cross_site", "TC-1751 " + site);
  for (const site of ["same-origin", "none", null]) exported(await ask("user", site), "acme", "TC-1751 " + site);
  // Another site comes first, at 3 in the order, before the kind at 4.
  refused(await ask("agent", "cross-site"), 403, "cross_site", "TC-1751 the service token from another site");
  for (const kind of ["agent", "neither"]) {
    const no = await ask(kind, null);
    refused(no, 403, "user_only", "TC-1752 " + kind);
    assert.equal(no.data.needs, "user", "TC-1752 " + kind);
  }
  assert.equal(shape(memory), before, "TC-1751, TC-1752 change nothing");
});

test("TC-1753, TC-1754: two exports in a row, and the file compared with the rows, on the standalone server", async (t) => {
  const { call, memory } = await standalone(t);
  const ids = await seed(call);
  assert.equal((await call("POST", "/api/snapshots", { body: legacy("legacy-shop") })).status, 200);
  const before = shape(memory), read = lastRead(memory, "acme");
  const first = await call("GET", "/api/spaces/acme/export", { kind: "user", session: null });
  await pause(5);
  const second = await call("GET", "/api/spaces/acme/export", { kind: "user", session: null });
  const [one, two] = [exported(first, "acme", "TC-1753 first"), exported(second, "acme", "TC-1753 second")];
  assert.ok(two.exported_at > one.exported_at, "TC-1753: the later time");
  assert.deepEqual({ ...two, exported_at: one.exported_at }, one, "TC-1753: the files differ only in exported_at");
  assert.equal(shape(memory), before, "TC-1753: no row changed and no copy is kept");
  assert.deepEqual(lastRead(memory, "acme"), read, "TC-1753: read_at did not change");
  // TC-1754: counts equal the rows; each list in its order.
  const count = (sql) => memory.prepare(sql).get("acme").n;
  assert.deepEqual(one.counts, {
    comments: count("SELECT COUNT(*) AS n FROM comments WHERE project=?"),
    replies: count("SELECT COUNT(*) AS n FROM replies AS r JOIN comments AS c ON c.id=r.comment WHERE c.project=?"),
    decisions: count("SELECT COUNT(*) AS n FROM decisions AS d JOIN comments AS c ON c.id=d.comment WHERE c.project=?"),
    proposals: count("SELECT COUNT(*) AS n FROM proposals WHERE project=?"),
    edits: count("SELECT COUNT(*) AS n FROM edits WHERE project=?"),
    checkpoints: count("SELECT COUNT(*) AS n FROM checkpoints WHERE project=?"),
  }, "TC-1754: counts equal the rows read");
  for (const kind of ["comments", "proposals", "edits", "checkpoints"]) assert.equal(one[kind].length, one.counts[kind], "TC-1754: " + kind + " as counted");
  assert.equal(one.comments.reduce((sum, comment) => sum + comment.replies.length, 0), one.counts.replies, "TC-1754: replies as counted");
  assert.equal(one.comments.reduce((sum, comment) => sum + comment.decisions.length, 0), one.counts.decisions, "TC-1754: decisions as counted");
  const ordered = (list, time) => list.every((entry, i) => i === 0 || list[i - 1][time] < entry[time] || (list[i - 1][time] === entry[time] && list[i - 1].id < entry.id));
  assert.ok(ordered(one.comments, "made_at") && ordered(one.proposals, "made_at") && ordered(one.edits, "made_at") && ordered(one.checkpoints, "passed_at"), "TC-1754: each list in its order");
  for (const comment of one.comments) for (const list of ["replies", "decisions"]) assert.deepEqual(comment[list].map((entry) => entry.seq), comment[list].map((_, i) => i + 1), "TC-1754: " + list + " by seq");
  const rows = memory.prepare("SELECT id, text, state, made_at, last_at FROM comments WHERE project=? ORDER BY made_at, id").all("acme").map((row) => ({ ...row }));
  assert.deepEqual(one.comments.map(({ id, text, state, made_at, last_at }) => ({ id, text, state, made_at, last_at })), rows, "TC-1754: every comment, open and closed");
  assert.deepEqual(one.comments.map((comment) => comment.state), ["closed", "open", "open"], "TC-1754: open and closed comments");
  assert.equal(one.comments[0].closed_as, "decided");
  assert.equal(one.comments[0].decisions[0].link, "https://github.com/example/qa-shop/pull/1");
  assert.equal(one.edits[0].id, ids.edit);
  // No snapshot, picture or discrepancy, no claim, write ID or session label, no identity and no last_report.
  const held = keys(one);
  for (const name of NEVER) assert.equal(held.has(name), false, "TC-1754 holds no " + name);
  for (const text of [SESSION, "synthetic-person", "synthetic-client", "nw_", "nd_"]) assert.equal(first.text.includes(text), false, "TC-1754 holds no " + text);
  assert.ok(memory.prepare("SELECT COUNT(*) AS n FROM claims WHERE project=?").get("acme").n > 0, "TC-1754: the space holds a claim that the file leaves out");
  assert.ok(memory.prepare("SELECT last_report FROM edits WHERE id=?").get(ids.edit).last_report, "TC-1754: the edit holds a report that the file leaves out");
  // The project without a space.
  const bare = exported(await call("GET", "/api/spaces/legacy-shop/export", { kind: "user", session: null }), "legacy-shop", "TC-1754 without a space");
  assert.equal(bare.space, false);
  assert.deepEqual([bare.comments, bare.proposals, bare.edits, bare.checkpoints], [[], [], [], []], "TC-1754: empty lists");
  for (const kind of KINDS) assert.equal(bare.counts[kind], 0, "TC-1754: no " + kind);
});

test("TC-1756: the project's data counts what a removal deletes and what the export holds, on the standalone server", async (t) => {
  const { call, memory } = await standalone(t);
  await seed(call);
  assert.equal((await call("POST", "/api/snapshots", { body: legacy("legacy-shop") })).status, 200);
  const before = shape(memory), read = lastRead(memory, "acme");
  for (const project of ["acme", "legacy-shop"]) {
    const answers = [];
    for (const kind of ["user", "agent", "neither"]) {
      const result = await call("GET", `/api/spaces/${project}/data`, { kind, session: kind === "agent" ? SESSION : null });
      assert.equal(result.status, 200, project + " " + kind);
      answers.push(result.data);
    }
    assert.deepEqual(answers[1], answers[0], project + ": the agent reads what the user reads");
    assert.deepEqual(answers[2], answers[0], project + ": so does an identity of neither kind");
    const dryRun = await call("GET", `/api/snapshots/${project}/removal`);
    const file = (await call("GET", `/api/spaces/${project}/export`, { kind: "user", session: null })).data;
    assert.deepEqual(answers[0].removal, dryRun.data, project + ": removal is the dry run's answer");
    for (const kind of KINDS) assert.equal(answers[0].removal.deletes[kind], file.counts[kind], project + ": " + kind + " as the export counts them");
    // Only the project's data names read_session.
    assert.equal(dryRun.text.includes("read_session"), false, project + ": the dry run names no read_session");
    assert.equal(JSON.stringify(file).includes("read_session"), false, project + ": the export names no read_session");
    assert.equal(file.read_at, answers[0].read_at, project + ": the export's read_at is the data's");
  }
  const data = (await call("GET", "/api/spaces/acme/data", { kind: "user", session: null })).data;
  assert.deepEqual([data.space, data.read_at, data.read_session], [true, read.read_at, SESSION], "the agent's last read with its label");
  const bare = (await call("GET", "/api/spaces/legacy-shop/data", { kind: "user", session: null })).data;
  assert.deepEqual([bare.space, bare.read_at, bare.read_session, bare.unread_since], [false, null, null, null], "no space, no read");
  for (const kind of KINDS) assert.equal(bare.removal.deletes[kind], 0, "no space counts no " + kind);
  const unknown = await call("GET", "/api/spaces/unknown/data", { kind: "user", session: null });
  assert.deepEqual([unknown.status, unknown.data.code], [404, "project_not_found"], "an unknown project");
  assert.equal(shape(memory), before, "the reads record nothing");
  assert.deepEqual(lastRead(memory, "acme"), read, "read_at is as before");
});
