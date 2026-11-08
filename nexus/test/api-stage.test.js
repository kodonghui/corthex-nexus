// API-158 getStage (TASK-266): a stage's head, record, the part's 13 stages and
// its items, against synthetic snapshots in an in-memory SQLite database.
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
const COMMIT = "3f1c9a7e5b2d4c6a8e0f1b3d5c7a9e1f2b4d6c8a";
const where = "docs/01-domain/shop.md:1";

// A 0.2 snapshot of a shop: two contexts listed Billing first, items that reach
// a context directly, through earlier stages or not at all, a DDD board with
// hotspots in both languages, and 717 cases for stage 12.
function shop() {
  const data = JSON.parse(readFileSync(new URL("./snapshot-02-example.json", import.meta.url), "utf8"));
  data.ids = { CTX: "context", TERM: "term", REQ: "requirement", FL: "flow", SPEC: "spec", TBL: "table", TC: "test" };
  const cases = Array.from({ length: 717 }, (_, i) => ({ id: "TC-" + String(i + 1).padStart(3, "0"), kind: "test", stage: "12-qa",
    where: "docs/12-qa/shop.md:" + (i + 10), title: "Case " + (i + 1), status: "pass", ...(i % 2 ? {} : { links: ["SPEC-001"] }) }));
  data.items = [
    { id: "CTX-002", kind: "context", stage: "01-domain", where, title: "Billing" },
    { id: "CTX-001", kind: "context", stage: "01-domain", where, title: "Orders" },
    { id: "TERM-001", kind: "term", stage: "01-domain", where, title: "Order", links: ["CTX-001"] },
    { id: "REQ-001", kind: "requirement", stage: "02-prd", where, title: "Send an order confirmation", priority: "Must", status: "active", links: ["CTX-001"] },
    { id: "REQ-002", kind: "requirement", stage: "02-prd", where, title: "Refund a paid order", priority: "Should", links: ["CTX-002"] },
    { id: "REQ-003", kind: "requirement", stage: "02-prd", where, title: "Show the order page", priority: "Must", links: ["CTX-009"] },
    { id: "REQ-004", kind: "requirement", stage: "02-prd", where, title: "Speak plainly", priority: "Could" },
    { id: "FL-001", kind: "flow", stage: "03-user-flow", where, title: "Pay", links: ["REQ-002", "REQ-001"] },
    { id: "SPEC-001", kind: "spec", stage: "04-functional-spec", where, title: "Confirm a payment", links: ["REQ-001", "FL-001"] },
    { id: "TBL-111", kind: "table", stage: "05-erd", where: "docs/05-erd/nexus.sql:226", title: "claims", links: ["CTX-007", "SPEC-136"] },
    { id: "TBL-112", kind: "table", stage: "05-erd", where: "docs/05-erd/nexus.sql:240", title: "payments", links: ["SPEC-001"] },
    { id: "TBL-113", kind: "table", stage: "05-erd", where: "docs/05-erd/nexus.sql:250", title: "refunds" },
    ...cases,
  ];
  data.summary = { ...data.summary, items: data.items.length };
  data.stages["02-prd"] = { name: "PRD", source: "docs/02-prd/", source_state: "found", read: true, state: "done",
    parts: { nexus: { state: "done", checkpoints: [{ approved: "The first draft", by: "the maintainer", date: "2026-11-01" },
      { approved: "The requirements as drafted", by: "the maintainer", where: "https://example.com/records/02", date: "2026-11-02" }], next: "", updated: "2026-11-02T10:00:00+09:00" } } };
  data.stages["06-api"] = { name: "API", source: "docs/06-api/", source_state: "missing", read: false };
  const hotspot = (text, state) => ({ text, contexts: ["CTX-001"], state, answer: "", where });
  data.pictures.push({ part: "nexus", stage: "01-domain", commit: COMMIT, time: "2026-11-03T09:40:00+09:00", source: { format: 1,
    contexts: [{ id: "CTX-001", name: "Orders", type: "core", purpose: "Orders", removed: false, external: "", rows: [], where }],
    aggregates: [], read_models: [], dependencies: [],
    hotspots: [hotspot("1. Who refunds?", "open"), hotspot("2. 누가 환불하나?", "열림"), hotspot("3. Partial refunds?", " Open "),
      hotspot("4. Taxes?", "answered"), hotspot("5. 세금은?", "답함")] } });
  data.left_out = [];
  return data;
}

async function server() {
  const db = new DatabaseSync(":memory:");
  const env = { ...access.env, DB: fakeD1(db), NEXUS_LANGUAGE: "en" };
  let serial = 0;
  async function call(method, path, { body, kind = "agent" } = {}) {
    const headers = { ...access.headers(kind), "Nexus-Session": "stage-test" };
    if (method === "POST") headers["Idempotency-Key"] = '"nw_' + (++serial).toString().padStart(12, "0") + '"';
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await handle(new Request("https://nexus.example.com" + path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env, access.ctx, template);
    const text = await response.text();
    return { status: response.status, headers: response.headers, text, data: text ? JSON.parse(text) : null };
  }
  return { db, call };
}

const quiet = async (work) => { const original = console.error; console.error = () => {}; try { return await work(); } finally { console.error = original; } };
const ids = (answer) => answer.items.entries.map((entry) => entry.id);

test("API-158 gives the head, record and the part's 13 stages", async () => {
  const { call } = await server();
  assert.equal((await call("POST", "/api/snapshots", { body: shop() })).status, 200);
  const prd = (await call("GET", "/api/spaces/corthex/stages/nexus/02-prd")).data;
  assert.deepEqual(prd.project, { name: "corthex", title: "CORTHEX", repository: "https://github.com/kodonghui/corthex", commit: COMMIT,
    generated_at: "2026-11-03T10:00:00+09:00", pushed_at: prd.project.pushed_at, parts: ["memory", "nexus"] });
  assert.match(prd.project.pushed_at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  assert.deepEqual([prd.part, prd.stage], ["nexus", "02-prd"]);
  // The last checkpoint of the part's record, the held commit and its time,
  // and the counts by kind and by priority in the order of their first item.
  assert.deepEqual(prd.head, { key: "02-prd", state: "done",
    checkpoint: { approved: "The requirements as drafted", by: "the maintainer", where: "https://example.com/records/02", date: "2026-11-02" },
    commit: COMMIT, time: "2026-11-03T09:40:00+09:00", reads: true, source_state: "found",
    counts: { items: 4, kinds: [{ kind: "requirement", count: 4 }], priorities: [{ priority: "Must", count: 2 }, { priority: "Should", count: 1 }, { priority: "Could", count: 1 }], hotspots: null },
    picture: false });
  assert.equal(prd.record.stage, "02-prd");
  assert.equal(prd.record.record.state, "done");
  assert.deepEqual(prd.stages.map((row) => row.key), ["01-domain", "02-prd", "03-user-flow", "04-functional-spec", "05-erd", "06-api", "07-sitemap",
    "08-screen-states", "09-mockup", "10-wbs", "11-development", "12-qa", "13-presentation"]);
  assert.deepEqual(prd.stages.filter((row) => row.items || row.picture || row.state !== "unknown").map((row) => [row.key, row.state, row.items, row.picture]),
    [["01-domain", "unknown", 3, true], ["02-prd", "done", 4, false], ["03-user-flow", "unknown", 1, false], ["04-functional-spec", "unknown", 1, false],
      ["05-erd", "in_progress", 3, true], ["12-qa", "unknown", 717, false]]);

  // Stage 01 counts the open hotspots of the part's board, in either language;
  // a stage with a picture shows the picture's document version.
  const domain = (await call("GET", "/api/spaces/corthex/stages/nexus/01-domain")).data;
  assert.deepEqual(domain.head.counts, { items: 3, kinds: [{ kind: "context", count: 2 }, { kind: "term", count: 1 }], priorities: [], hotspots: 3 });
  assert.deepEqual([domain.head.picture, domain.head.commit, domain.head.time, domain.head.checkpoint], [true, COMMIT, "2026-11-03T09:40:00+09:00", null]);
  // The part memory has no board: no count of hotspots.
  assert.equal((await call("GET", "/api/spaces/corthex/stages/memory/01-domain")).data.head.counts.hotspots, null);
  // A stage that the project does not read says so.
  const api = (await call("GET", "/api/spaces/corthex/stages/nexus/06-api")).data;
  assert.deepEqual([api.head.reads, api.head.source_state, api.items.total], [false, "missing", 0]);
  // HEAD answers the same status with no body.
  const head = await call("HEAD", "/api/spaces/corthex/stages/nexus/02-prd");
  assert.deepEqual([head.status, head.text, head.headers.get("Content-Type")], [200, "", "application/json; charset=utf-8"]);
});

test("API-158 groups the items by context in the snapshot's order, the items without one last", async () => {
  const { call } = await server();
  await call("POST", "/api/snapshots", { body: shop() });
  const prd = (await call("GET", "/api/spaces/corthex/stages/nexus/02-prd")).data.items;
  assert.deepEqual(prd.groups, [{ context: "CTX-002", title: "Billing", count: 1 }, { context: "CTX-001", title: "Orders", count: 1 },
    { context: "CTX-009", title: null, count: 1 }, { context: null, title: null, count: 1 }]);
  assert.deepEqual(prd.entries.map((entry) => [entry.id, entry.context]), [["REQ-002", "CTX-002"], ["REQ-001", "CTX-001"], ["REQ-003", "CTX-009"], ["REQ-004", null]]);
  assert.deepEqual(prd.entries[1], { id: "REQ-001", kind: "requirement", stage: "02-prd", where, title: "Send an order confirmation", status: "active",
    priority: "Must", links: ["CTX-001"], context: "CTX-001", comments: 0, mine: false, discrepancies: 0, reflections: 0 });
  // The source's order, with no groups.
  const source = (await call("GET", "/api/spaces/corthex/stages/nexus/02-prd?group=source")).data.items;
  assert.deepEqual([ids({ items: source }), source.groups, source.group], [["REQ-001", "REQ-002", "REQ-003", "REQ-004"], [], "source"]);
  // A context's own ID; the first context that the links name; else the first
  // item it comes from that has one, the nearest stage first.
  const contexts = async (stage) => Object.fromEntries((await call("GET", "/api/spaces/corthex/stages/nexus/" + stage + "?group=source")).data.items.entries.map((entry) => [entry.id, entry.context]));
  assert.deepEqual(await contexts("01-domain"), { "CTX-002": "CTX-002", "CTX-001": "CTX-001", "TERM-001": "CTX-001" });
  assert.deepEqual(await contexts("03-user-flow"), { "FL-001": "CTX-002" });
  assert.deepEqual(await contexts("04-functional-spec"), { "SPEC-001": "CTX-002" });
  assert.deepEqual(await contexts("05-erd"), { "TBL-111": "CTX-007", "TBL-112": "CTX-002", "TBL-113": null });
});

test("API-158 marks the part's talk and narrows by filter and words", async () => {
  const { db, call } = await server();
  await call("POST", "/api/snapshots", { body: shop() });
  const space = "/api/spaces/corthex";
  // The agent's comment waits for the user; the user's for the agent; one is
  // answered; one is on the stage as a whole; one is on another part.
  await call("POST", space + "/comments", { body: { part: "nexus", stage: "02-prd", item: "REQ-001", text: "Should the receipt name the shop?" } });
  await call("POST", space + "/comments", { body: { part: "nexus", stage: "02-prd", item: "REQ-002", text: "Who refunds?" }, kind: "user" });
  const answered = (await call("POST", space + "/comments", { body: { part: "nexus", stage: "02-prd", item: "REQ-003", text: "Which page?" }, kind: "user" })).data;
  await call("POST", space + "/comments/" + answered.id + "/answered", { body: {} });
  await call("POST", space + "/comments", { body: { part: "nexus", stage: "02-prd", item: "", text: "Pass this stage?", asks: "checkpoint" } });
  await call("POST", space + "/comments", { body: { part: "memory", stage: "02-prd", item: "REQ-004", text: "Elsewhere" } });
  let prd = (await call("GET", space + "/stages/nexus/02-prd?group=source")).data;
  assert.deepEqual(prd.items.entries.map((entry) => [entry.id, entry.comments, entry.mine]), [["REQ-001", 1, true], ["REQ-002", 1, false], ["REQ-003", 1, false], ["REQ-004", 0, false]]);
  assert.deepEqual(prd.items.counts, { all: 4, talk: 3, mine: 1, left: 2 });
  for (const [filter, expected] of [["talk", ["REQ-001", "REQ-002", "REQ-003"]], ["mine", ["REQ-001"]], ["left", ["REQ-001", "REQ-002"]], ["all", ["REQ-001", "REQ-002", "REQ-003", "REQ-004"]]]) {
    const answer = (await call("GET", space + "/stages/nexus/02-prd?group=source&filter=" + filter)).data;
    assert.deepEqual([ids(answer), answer.items.total, answer.items.filter], [expected, expected.length, filter], filter);
  }
  assert.equal(prd.stages.find((row) => row.key === "02-prd").mine, 2);
  assert.equal((await call("GET", space + "/stages/memory/02-prd")).data.stages.find((row) => row.key === "02-prd").mine, 1);

  // Every word, ignoring case, in the ID or the title; the counts follow them.
  prd = (await call("GET", space + "/stages/nexus/02-prd?q=" + encodeURIComponent("  ORDER conf "))).data.items;
  assert.deepEqual([ids({ items: prd }), prd.q, prd.total, prd.counts], [["REQ-001"], "ORDER conf", 1, { all: 1, talk: 1, mine: 1, left: 1 }]);
  prd = (await call("GET", space + "/stages/nexus/02-prd?q=req-00&filter=talk")).data.items;
  assert.deepEqual([prd.total, prd.counts], [3, { all: 4, talk: 3, mine: 1, left: 2 }]);
  prd = (await call("GET", space + "/stages/nexus/02-prd?q=nothing")).data.items;
  assert.deepEqual([prd.total, prd.entries, prd.groups, prd.counts], [0, [], [], { all: 0, talk: 0, mine: 0, left: 0 }]);
  assert.equal((await call("GET", space + "/stages/nexus/02-prd?q=%20%20")).data.items.q, null);

  // An open proposal is in my turn; a pending reflection and an open
  // discrepancy are left, on either side of the discrepancy.
  const proposal = { part: "nexus", stage: "05-erd", items: ["TBL-111"], reason: "Name the claims", change: "Rename" };
  const accepted = (await call("POST", space + "/proposals", { body: proposal })).data;
  await call("POST", space + "/proposals/" + accepted.id + "/accept", { body: {}, kind: "user" });
  await call("POST", space + "/proposals", { body: proposal });
  db.prepare(`INSERT INTO discrepancies (id,project,part,compares,term,item,reasons,level,state,opened_commit,opened_at)
    VALUES ('nd_aaaaaaaaaaaa','corthex','nexus','aggregate-table','TERM-001','TBL-112','[]','warn','open',?,'2026-11-03T01:00:00.000Z')`).run(COMMIT);
  const erd = (await call("GET", space + "/stages/nexus/05-erd?group=source")).data;
  assert.deepEqual(erd.items.entries.map((entry) => [entry.id, entry.mine, entry.discrepancies, entry.reflections]),
    [["TBL-111", true, 0, 1], ["TBL-112", false, 1, 0], ["TBL-113", false, 0, 0]]);
  assert.deepEqual(erd.items.counts, { all: 3, talk: 0, mine: 1, left: 2 });
  assert.equal(erd.stages.find((row) => row.key === "05-erd").mine, 1);
  const term = (await call("GET", space + "/stages/nexus/01-domain?filter=left")).data.items;
  assert.deepEqual(term.entries.map((entry) => [entry.id, entry.discrepancies]), [["TERM-001", 1]]);
});

test("API-158 gives 717 cases in four reads of 200, in one order", async () => {
  const { call } = await server();
  await call("POST", "/api/snapshots", { body: shop() });
  for (const group of ["context", "source"]) {
    const seen = [];
    let reads = 0, total = null, groups = null;
    for (let after = 0; ; after += 200) {
      const answer = (await call("GET", "/api/spaces/corthex/stages/nexus/12-qa?group=" + group + "&after=" + after)).data.items;
      if (!answer.entries.length) break;
      reads++; seen.push(...ids({ items: answer }));
      total ??= answer.total; groups ??= JSON.stringify(answer.groups);
      assert.deepEqual([answer.total, answer.after, JSON.stringify(answer.groups)], [total, after, groups]);
      assert.ok(answer.entries.length <= 200);
    }
    assert.deepEqual([reads, seen.length, new Set(seen).size, total], [4, 717, 717, 717], group);
    if (group === "context") {
      assert.deepEqual(JSON.parse(groups), [{ context: "CTX-002", title: "Billing", count: 359 }, { context: null, title: null, count: 358 }]);
      assert.deepEqual(seen.slice(0, 2).concat(seen.slice(359, 361)), ["TC-001", "TC-003", "TC-002", "TC-004"]);
    } else assert.deepEqual(seen.slice(0, 3), ["TC-001", "TC-002", "TC-003"]);
  }
  const past = (await call("GET", "/api/spaces/corthex/stages/nexus/12-qa?after=100000")).data.items;
  assert.deepEqual([past.entries, past.total, past.after], [[], 717, 100000]);
});

test("API-158 reads a project pushed only by a hub of 0.1, with no talk", async () => {
  const { call } = await server();
  const legacy = { schema: "corthex-hub/0.1", generated_at: "2026-01-12T10:00:00+09:00", project: { name: "acme-shop", title: "Acme Shop" },
    stages: { "02-prd": { source_state: "found", read: true, state: "in_progress" } }, summary: { items: 1 },
    items: [{ id: "REQ-001", kind: "requirement", stage: "02-prd", title: "Send an order confirmation", priority: "Must" }], checks: [] };
  assert.equal((await call("POST", "/api/snapshots", { body: legacy })).status, 200);
  const answer = (await call("GET", "/api/spaces/acme-shop/stages/_/02-prd")).data;
  assert.deepEqual(answer.project, { name: "acme-shop", title: "Acme Shop", repository: null, commit: null, generated_at: "2026-01-12T10:00:00+09:00", pushed_at: answer.project.pushed_at, parts: [""] });
  assert.deepEqual([answer.head.state, answer.head.commit, answer.head.time, answer.head.picture, answer.head.counts.items], ["in_progress", null, null, false, 1]);
  assert.deepEqual(answer.items.entries.map((entry) => [entry.id, entry.context, entry.comments, entry.mine]), [["REQ-001", null, 0, false]]);
  assert.ok(answer.stages.every((row) => row.mine === 0 && !row.picture));
});

test("API-158 refuses what it does not hold by the code of what it names", async () => {
  const { call } = await server();
  await call("POST", "/api/snapshots", { body: shop() });
  await quiet(async () => {
    for (const [path, status, code] of [
      ["/api/spaces/unknown/stages/nexus/02-prd", 404, "project_not_found"], ["/api/spaces/corthex/stages/billing/02-prd", 404, "part_not_found"],
      ["/api/spaces/corthex/stages/nexus/14-other", 404, "not_found"], ["/api/spaces/corthex/stages/Bad/02-prd", 404, "part_not_found"],
      ["/api/spaces/corthex/stages/nexus/02-prd?after=-1", 400, "invalid_request"], ["/api/spaces/unknown/stages/nexus/02-prd?filter=open", 400, "invalid_request"],
    ]) {
      const answer = await call("GET", path);
      assert.deepEqual([answer.status, answer.data.code, answer.headers.get("Content-Type")], [status, code, "application/problem+json"], path);
    }
    const method = await call("POST", "/api/spaces/corthex/stages/nexus/02-prd", { body: {} });
    assert.deepEqual([method.status, method.data.code, method.headers.get("Allow")], [405, "method_not_allowed", "GET, HEAD"]);
  });
});

test("API-158 says why a stage's picture is not current, for the list of stages (TASK-274)", async () => {
  const { call } = await server();
  assert.equal((await call("POST", "/api/snapshots", { body: shop() })).status, 200);
  const pictured = async () => (await call("GET", "/api/spaces/corthex/stages/nexus/02-prd")).data.stages.filter((row) => row.picture || row.not_current !== null)
    .map((row) => [row.key, row.picture, row.not_current]);
  assert.deepEqual(await pictured(), [["01-domain", true, null], ["05-erd", true, null]]);
  // A newer push that leaves the ERD out for its size keeps the stored picture, which is
  // then not current; a stage without a picture says null.
  const again = shop();
  again.generated_at = "2026-11-03T11:00:00+09:00";
  again.pictures = again.pictures.filter((picture) => !(picture.part === "nexus" && picture.stage === "05-erd"));
  again.left_out = [{ part: "nexus", stage: "05-erd", why: "size" }];
  assert.equal((await call("POST", "/api/snapshots", { body: again })).status, 200);
  assert.deepEqual(await pictured(), [["01-domain", true, null], ["05-erd", true, "size"]]);
});
