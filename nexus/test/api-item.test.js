// API-157 getItem and API-156 searchItems (TASK-268): one item with its links
// and its talk, and the search of every stored snapshot, against synthetic
// snapshots in an in-memory SQLite database.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { handle } from "../src/app.js";
import { fakeD1 } from "./fake-d1.js";
import { testAccess } from "./access-fixture.js";

const template = readFileSync(new URL("../src/hub.html", import.meta.url), "utf8");
// One set of synthetic Access keys for the file: the verifier keeps the keys it read.
const access = await testAccess();
const space = "/api/spaces/corthex";
const WORKING = "a7d2e4f6081b3c5d7e9fa1b2c3d4e5f607182930";
const HARNESS = "c".repeat(40), LOCAL = "d".repeat(40);
const where = "docs/02-prd/shop.md:12";

// A 0.2 snapshot of a shop whose requirement REQ-001 links, in both
// directions, items of earlier and later kinds on several stages, one of the
// same kind, a decision, an item of another kind, an ID that no item holds and
// an item on a stage outside the 13; its sources sit in the project's own
// repository and in three others that the settings name.
function shop() {
  const data = JSON.parse(readFileSync(new URL("./snapshot-02-example.json", import.meta.url), "utf8"));
  data.ids = { CTX: "context", TERM: "term", REQ: "requirement", FL: "flow", SPEC: "spec", TBL: "table", TC: "test", DEC: "decision" };
  data.repos.harness = { commit: HARNESS, web: "https://github.com/kodonghui/harness" };
  data.repos.local = { commit: LOCAL };
  data.repos.short = { commit: "abc1234", web: "https://github.com/kodonghui/short" };
  const cases = Array.from({ length: 101 }, (_, i) => ({ id: "TC-" + String(101 - i).padStart(3, "0"), kind: "test", stage: "12-qa",
    where: "docs/12-qa/shop.md:" + (i + 10), title: "Case " + (101 - i), links: ["REQ-001"] }));
  data.items = [
    { id: "CTX-002", kind: "context", stage: "01-domain", where, title: "Billing" },
    { id: "CTX-001", kind: "context", stage: "01-domain", where: "docs/01-domain/shop.md:3", title: "Orders" },
    { id: "TERM-002", kind: "term", stage: "01-domain", title: "Confirmation", links: ["REQ-001"] },
    { id: "REQ-001", kind: "requirement", stage: "02-prd", where, title: "Send an order confirmation", type: "functional", priority: "Must",
      status: "active", links: ["CTX-001", "REQ-002", "DEC-001", "NOTE-001", "SPEC-404"] },
    { id: "REQ-002", kind: "requirement", stage: "02-prd", where, title: "Refund a paid order", priority: "Should", links: ["CTX-002"] },
    { id: "DEC-001", kind: "decision", stage: "02-prd", where, title: "Mail, not text" },
    { id: "NOTE-001", kind: "note", stage: "02-prd", where, title: "A note" },
    { id: "FL-001", kind: "flow", stage: "03-user-flow", where: "docs/03-user-flow/pay.md", title: "Pay", links: ["REQ-002", "REQ-001"] },
    { id: "SPEC-010", kind: "spec", stage: "04-functional-spec", where: "local:src/confirm.js:3", title: "Confirm again", links: ["REQ-001"] },
    { id: "SPEC-002", kind: "spec", stage: "04-functional-spec", where: "notes:docs/a b.md:7", title: "Confirm by mail", links: ["REQ-001"] },
    { id: "SPEC-001", kind: "spec", stage: "04-functional-spec", where: "harness:plugins/corthex/skills/confirm.md:1", title: "Confirm a payment", links: ["REQ-001", "FL-001"] },
    { id: "TBL-901", kind: "table", stage: "99-other", where, title: "Elsewhere", links: ["REQ-001"] },
    { id: "TBL-111", kind: "table", stage: "05-erd", where: "docs/05-erd/nexus.sql:226", title: "claims", links: ["CTX-007", "SPEC-136"] },
    { id: "TBL-112", kind: "table", stage: "05-erd", where: "short:docs/05-erd/shop.sql:9", title: "payments" },
    ...cases,
  ];
  data.summary = { ...data.summary, items: data.items.length };
  return data;
}

// A snapshot of hub 0.1, which has no space and no parts.
const legacy = (name, items) => ({ schema: "corthex-hub/0.1", generated_at: "2026-01-12T10:00:00+09:00", project: { name, title: name },
  stages: {}, summary: { items: items.length }, items, checks: [] });

async function server() {
  const db = new DatabaseSync(":memory:");
  const env = { ...access.env, DB: fakeD1(db), NEXUS_LANGUAGE: "en" };
  let serial = 0;
  async function call(method, path, { body, kind = "agent" } = {}) {
    const headers = { ...access.headers(kind), "Nexus-Session": "item-test" };
    if (method === "POST") headers["Idempotency-Key"] = '"nw_' + (++serial).toString().padStart(12, "0") + '"';
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await handle(new Request("https://nexus.example.com" + path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env, access.ctx, template);
    const text = await response.text();
    return { status: response.status, headers: response.headers, text, data: text ? JSON.parse(text) : null };
  }
  return { db, call };
}

const quiet = async (work) => { const original = console.error; console.error = () => {}; try { return await work(); } finally { console.error = original; } };
const group = (answer) => answer.map((row) => [row.stage, row.total, row.items.map((item) => item.id)]);

test("API-157 gives an item's fields, context, source and trace by stage, as the hub page's trace view groups them", async () => {
  const { call } = await server();
  assert.equal((await call("POST", "/api/snapshots", { body: shop() })).status, 200);
  const answer = await call("GET", space + "/items/REQ-001");
  assert.equal(answer.status, 200);
  const { data } = answer;
  // The project's first part, the sources' language and the fields as the snapshot holds them.
  assert.deepEqual([data.project, data.part, data.language], ["corthex", "memory", "en"]);
  assert.deepEqual(data.item, { id: "REQ-001", kind: "requirement", stage: "02-prd", where, title: "Send an order confirmation", status: "active",
    type: "functional", priority: "Must", links: ["CTX-001", "REQ-002", "DEC-001", "NOTE-001", "SPEC-404"] });
  assert.deepEqual(data.context, { id: "CTX-001", title: "Orders" });
  // The place at the commit that the snapshot was made from, which is not
  // the held default branch commit, with the line as an anchor.
  assert.deepEqual(data.source, { path: "docs/02-prd/shop.md", line: 12, commit: WORKING,
    link: "https://github.com/kodonghui/corthex/blob/" + WORKING + "/docs/02-prd/shop.md#L12" });
  // Earlier kinds it comes from and later kinds it leads to, by stage in the
  // stages' order, then by kind and by ID; the same kind, a decision, another
  // kind, a missing ID and a stage outside the 13 have no place.
  assert.deepEqual(group(data.trace.from), [["01-domain", 2, ["CTX-001", "TERM-002"]]]);
  assert.deepEqual(group(data.trace.to).slice(0, 2), [["03-user-flow", 1, ["FL-001"]], ["04-functional-spec", 3, ["SPEC-001", "SPEC-002", "SPEC-010"]]]);
  const cases = data.trace.to[2];
  assert.deepEqual([data.trace.to.length, cases.stage, cases.total, cases.items.length, cases.items[0], cases.items[99].id],
    [3, "12-qa", 101, 100, { id: "TC-001", kind: "test", title: "Case 1" }, "TC-100"]);
  assert.deepEqual(data.trace.from[0].items, [{ id: "CTX-001", kind: "context", title: "Orders" }, { id: "TERM-002", kind: "term", title: "Confirmation" }]);
  // An item of the earliest kind leads only; one without links has neither.
  const context = (await call("GET", space + "/items/CTX-001")).data;
  assert.deepEqual([context.context, context.trace.from, group(context.trace.to)], [{ id: "CTX-001", title: "Orders" }, [], [["02-prd", 1, ["REQ-001"]]]]);
  const note = (await call("GET", space + "/items/NOTE-001")).data;
  assert.deepEqual([note.context, note.trace], [null, { from: [], to: [] }]);
  // HEAD answers the same status with no body.
  const head = await call("HEAD", space + "/items/REQ-001");
  assert.deepEqual([head.status, head.text, head.headers.get("Content-Type")], [200, "", "application/json; charset=utf-8"]);
});

test("API-157 links a source in the repository that holds it, at its commit, only where the settings give its web address", async () => {
  const { call } = await server();
  assert.equal((await call("POST", "/api/snapshots", { body: shop() })).status, 200);
  const source = async (id) => (await call("GET", space + "/items/" + id)).data.source;
  // A repository named in the place, at its own commit; the first line needs no anchor.
  assert.deepEqual(await source("SPEC-001"), { path: "plugins/corthex/skills/confirm.md", line: 1, commit: HARNESS,
    link: "https://github.com/kodonghui/harness/blob/" + HARNESS + "/plugins/corthex/skills/confirm.md" });
  // A name that the settings do not give stays in the path, which is encoded.
  assert.deepEqual(await source("SPEC-002"), { path: "notes:docs/a b.md", line: 7, commit: WORKING,
    link: "https://github.com/kodonghui/corthex/blob/" + WORKING + "/notes%3Adocs/a%20b.md#L7" });
  // A place without a line; a repository without a web address; one whose commit is not whole; none at all.
  assert.deepEqual(await source("FL-001"), { path: "docs/03-user-flow/pay.md", line: null, commit: WORKING,
    link: "https://github.com/kodonghui/corthex/blob/" + WORKING + "/docs/03-user-flow/pay.md" });
  assert.deepEqual(await source("SPEC-010"), { path: "src/confirm.js", line: 3, commit: LOCAL, link: null });
  assert.deepEqual(await source("TBL-112"), { path: "docs/05-erd/shop.sql", line: 9, commit: null, link: null });
  assert.equal(await source("TERM-002"), null);
});

test("API-157 holds the item's talk in the part as API-152 gives it narrowed to the item", async () => {
  const { call } = await server();
  assert.equal((await call("POST", "/api/snapshots", { body: shop() })).status, 200);
  const comment = (part, item, text, extra = {}) => call("POST", space + "/comments", { body: { part, stage: "05-erd", item, text, ...extra } });
  const asked = (await comment("nexus", "TBL-111", "Keep the claims?", { asks: "answer" })).data.id;
  const question = (await call("POST", space + "/comments", { body: { part: "nexus", stage: "05-erd", item: "TBL-111", text: "Who claims?" }, kind: "user" })).data.id;
  await comment("nexus", "TBL-112", "Which currency?");
  await comment("nexus", "", "Pass the ERD?", { asks: "checkpoint", look_first: "TBL-111" });
  const other = (await comment("memory", "TBL-111", "Keep it here?", { asks: "answer" })).data.id;
  const offered = (await call("POST", space + "/proposals", { body: { part: "nexus", stage: "05-erd", items: ["TBL-111"], reason: "Plain words", change: "Rename it" } })).data.id;
  assert.ok(asked && question && other && offered);
  const ids = (list) => list.entries.map((entry) => entry.kind ? (entry.comment || entry.proposal).id : entry.id);
  // The project's first part by default, the named part, and the project as a whole.
  let data = (await call("GET", space + "/items/TBL-111")).data;
  assert.deepEqual([data.part, data.comments.part, data.comments.stage, data.comments.item, ids(data.comments.mine)], ["memory", "memory", "05-erd", "TBL-111", [other]]);
  data = (await call("GET", space + "/items/TBL-111?part=nexus")).data;
  assert.deepEqual([data.part, ids(data.comments.mine), ids(data.comments.agent), data.comments.apart.total, data.comments.closed.total],
    ["nexus", [offered, asked], [question], 0, 0]);
  assert.deepEqual(data.comments, (await call("GET", space + "/talk/nexus/05-erd?item=TBL-111")).data);
  data = (await call("GET", space + "/items/TBL-111?part=_")).data;
  assert.deepEqual([data.part, data.comments.part, data.comments.mine.total, data.comments.agent.total], ["", "", 0, 0]);
  // An item that no stage holds, as after a push that removed it, is not
  // found, and the talk narrowed to it shows its comments apart.
  const gone = (await call("POST", space + "/comments", { body: { part: "nexus", stage: "05-erd", item: "TBL-113", text: "Where did it go?" }, kind: "user" })).data.id;
  const missing = await quiet(() => call("GET", space + "/items/TBL-113?part=nexus"));
  assert.deepEqual([missing.status, missing.data.code], [404, "item_not_found"]);
  const talk = (await call("GET", space + "/talk/nexus/05-erd?item=TBL-113")).data;
  assert.deepEqual([talk.mine.total, talk.agent.total, talk.apart.entries.map((entry) => entry.id)], [0, 0, [gone]]);
});

test("API-157 refuses an item that no stage holds, a project without a space, what the server does not hold and a part in another form", async () => {
  const { call } = await server();
  assert.equal((await call("POST", "/api/snapshots", { body: shop() })).status, 200);
  assert.equal((await call("POST", "/api/snapshots", { body: legacy("acme-shop", [{ id: "REQ-001", kind: "requirement", stage: "02-prd", title: "Refund" }]) })).status, 200);
  await quiet(async () => {
    for (const [path, status, code, field] of [
      [space + "/items/SPEC-404", 404, "item_not_found"], [space + "/items/TBL-901", 404, "item_not_found"], [space + "/items/tbl-111", 404, "item_not_found"],
      ["/api/spaces/acme-shop/items/REQ-001", 404, "space_not_found"], ["/api/spaces/unknown/items/REQ-001", 404, "project_not_found"],
      [space + "/items/REQ-001?part=billing", 404, "part_not_found"], [space + "/items/REQ-001?part=Nexus", 400, "invalid_request", "part"],
      [space + "/items/REQ-001?part=nexus&part=memory", 400, "invalid_request", "part"], ["/api/spaces/unknown/items/REQ-001?part=", 400, "invalid_request", "part"],
    ]) {
      const answer = await call("GET", path);
      assert.deepEqual([answer.status, answer.data.code, answer.data.field, answer.headers.get("Content-Type")], [status, code, field, "application/problem+json"], path);
    }
    assert.equal((await call("GET", space + "/items/SPEC-404")).data.detail, "no stage of the stored snapshot of corthex holds SPEC-404");
    const method = await call("POST", space + "/items/REQ-001", { body: {} });
    assert.deepEqual([method.status, method.data.code, method.headers.get("Allow")], [405, "method_not_allowed", "GET, HEAD"]);
  });
});

test("API-156 gives an exact ID first, then the items whose ID or title holds every word, project by project", async () => {
  const { call } = await server();
  const titled = (id, stage, title, extra = {}) => ({ id, kind: "requirement", stage, title, ...extra });
  // Pushed out of the names' order; acme-shop also holds IDs in another form,
  // an item on a stage outside the 13, the same ID twice and a long title.
  const zeta = Array.from({ length: 30 }, (_, i) => ({ id: "TC-" + String(i + 1).padStart(3, "0"), kind: "test", stage: "12-qa", title: "Refund case " + (i + 1) }));
  assert.equal((await call("POST", "/api/snapshots", { body: legacy("zeta", [titled("REQ-001", "02-prd", "Zeta's first"), ...zeta]) })).status, 200);
  assert.equal((await call("POST", "/api/snapshots", { body: shop() })).status, 200);
  assert.equal((await call("POST", "/api/snapshots", { body: legacy("acme-shop", [titled("req-9", "02-prd", "Refund in another form"),
    titled("REQ-777", "99-other", "Refund elsewhere"), titled("REQ-010", "02-prd", "Refund a paid order " + "x".repeat(120)),
    titled("REQ-001", "02-prd", "Refund a paid order"), titled("REQ-001", "03-user-flow", "Refund twice"), titled("REQ-0011", "02-prd", "Spare")]) })).status, 200);
  const search = async (words) => (await call("GET", "/api/search?q=" + encodeURIComponent(words))).data;
  const found = (answer) => answer.matches.map((match) => [match.project, match.part, match.stage, match.id]);
  // The ID in each project, by name, before the items whose ID holds it; a
  // project of hub 0.1 opens as a whole, and corthex in its first part.
  let answer = await search(" req-001 ");
  assert.deepEqual([answer.q, answer.total], ["req-001", 4]);
  assert.deepEqual(found(answer), [["acme-shop", "", "02-prd", "REQ-001"], ["corthex", "memory", "02-prd", "REQ-001"], ["zeta", "", "02-prd", "REQ-001"],
    ["acme-shop", "", "02-prd", "REQ-0011"]]);
  assert.equal(answer.matches[0].title, "Refund a paid order");
  // Every word, in the ID or the title, ignoring case; titles cut at 120.
  answer = await search("REFUND paid");
  assert.deepEqual(found(answer), [["acme-shop", "", "02-prd", "REQ-010"], ["acme-shop", "", "02-prd", "REQ-001"], ["corthex", "memory", "02-prd", "REQ-002"]]);
  assert.deepEqual([answer.total, Array.from(answer.matches[0].title).length], [3, 120]);
  // Up to 20 matches with the total of them all, in the snapshot's order.
  answer = await search("refund");
  assert.deepEqual([answer.total, answer.matches.length, answer.matches.at(-1).id], [33, 20, "TC-017"]);
  assert.deepEqual(found(answer).slice(0, 4), [["acme-shop", "", "02-prd", "REQ-010"], ["acme-shop", "", "02-prd", "REQ-001"], ["corthex", "memory", "02-prd", "REQ-002"],
    ["zeta", "", "12-qa", "TC-001"]]);
  // Words that match nothing.
  assert.deepEqual(await search("settles twice"), { q: "settles twice", total: 0, matches: [] });
  // HEAD answers the same status with no body.
  const head = await call("HEAD", "/api/search?q=REQ-001");
  assert.deepEqual([head.status, head.text, head.headers.get("Content-Type")], [200, "", "application/json; charset=utf-8"]);
});

test("API-156 refuses words that are missing, too short or too long, and a server with no snapshot finds nothing", async () => {
  const { call } = await server();
  assert.deepEqual((await call("GET", "/api/search?q=REQ-001")).data, { q: "REQ-001", total: 0, matches: [] });
  await quiet(async () => {
    for (const query of ["", "?q=", "?q=a", "?q=%20a%20", "?q=" + encodeURIComponent("가"), "?q=" + "x".repeat(201), "?q=ab&q=cd"]) {
      const answer = await call("GET", "/api/search" + query);
      assert.deepEqual([answer.status, answer.data.code, answer.data.field, answer.data.detail], [400, "invalid_request", "q", "q: write 2 to 200 characters"], query);
    }
    const method = await call("DELETE", "/api/search?q=REQ-001");
    assert.deepEqual([method.status, method.data.code, method.headers.get("Allow")], [405, "method_not_allowed", "GET, HEAD"]);
  });
});
