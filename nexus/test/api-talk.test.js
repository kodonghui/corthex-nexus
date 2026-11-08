// API-152 getStageTalk (TASK-267): a part's stage talk by turn, against a
// synthetic snapshot in an in-memory SQLite database.
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

// The example 0.2 snapshot, whose ERD of part nexus holds three tables, in
// the stage's items and in the picture.
function shop() {
  const data = JSON.parse(readFileSync(new URL("./snapshot-02-example.json", import.meta.url), "utf8"));
  const where = "docs/05-erd/nexus.sql:1";
  data.items = [...data.items, { id: "TBL-112", kind: "table", stage: "05-erd", where, title: "payments" },
    { id: "TBL-113", kind: "table", stage: "05-erd", where, title: "refunds" }];
  data.summary = { ...data.summary, items: data.items.length };
  const table = (id, name) => ({ id, name, context: "CTX-007", terms: [], removed: false, where,
    columns: [{ name: "id", type: "TEXT", null: false, where }], primary_key: ["id"], unique: [], foreign_keys: [] });
  data.pictures[0].source.tables.push(table("TBL-112", "payments"), table("TBL-113", "refunds"));
  return data;
}

async function server() {
  const db = new DatabaseSync(":memory:");
  const env = { ...access.env, DB: fakeD1(db), NEXUS_LANGUAGE: "en" };
  let serial = 0;
  async function call(method, path, { body, kind = "agent", session = "talk-test" } = {}) {
    const headers = { ...access.headers(kind), "Nexus-Session": session };
    if (method === "POST") headers["Idempotency-Key"] = '"nw_' + (++serial).toString().padStart(12, "0") + '"';
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await handle(new Request("https://nexus.example.com" + path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env, access.ctx, template);
    const text = await response.text();
    return { status: response.status, headers: response.headers, text, data: text ? JSON.parse(text) : null };
  }
  assert.equal((await call("POST", "/api/snapshots", { body: shop() })).status, 200);
  // Entries made in one millisecond would sort by their random IDs: the
  // tests set the times that they order by.
  const at = (table, id, fields) => db.prepare(`UPDATE ${table} SET ${Object.keys(fields).map((name) => name + "=?").join(",")} WHERE id=?`).run(...Object.values(fields), id);
  return { db, call, at };
}

const quiet = async (work) => { const original = console.error; console.error = () => {}; try { return await work(); } finally { console.error = original; } };
const time = (minute) => "2026-11-08T07:" + String(minute).padStart(2, "0") + ":00.000Z";
const comment = (item, text, extra = {}) => ({ body: { part: "nexus", stage: "05-erd", item, text, ...extra } });
const proposal = (items) => ({ body: { part: "nexus", stage: "05-erd", items, reason: "Name it plainly", change: "Rename it" } });
const talkIds = (list) => list.entries.map((entry) => entry.kind ? (entry.comment || entry.proposal).id : entry.id);

// The talk of the stage: my turn, the agent's turn with a claim, a comment
// apart, two closed entries and a pending reflection.
async function talk({ call, at }) {
  const ids = {};
  ids.question = (await call("POST", space + "/comments", { ...comment("TBL-111", "Should a claim end early?"), kind: "user" })).data.id;
  ids.answer = (await call("POST", space + "/comments", comment("TBL-112", "Which currency?", { asks: "answer" }))).data.id;
  ids.checkpoint = (await call("POST", space + "/comments", comment("", "Pass the ERD?", { asks: "checkpoint" }))).data.id;
  ids.recommended = (await call("POST", space + "/comments", comment("TBL-113", "Keep refunds apart?", { asks: "recommended" }))).data.id;
  ids.gone = (await call("POST", space + "/comments", { ...comment("TBL-109", "Does this table need an index?"), kind: "user" })).data.id;
  ids.goneMine = (await call("POST", space + "/comments", comment("TBL-109", "Drop it?", { asks: "answer" }))).data.id;
  ids.answered = (await call("POST", space + "/comments", { ...comment("TBL-111", "Who claims?"), kind: "user" })).data.id;
  await call("POST", space + "/comments/" + ids.answered + "/answered", { body: {} });
  ids.offered = (await call("POST", space + "/proposals", proposal(["TBL-111"]))).data.id;
  ids.withdrawn = (await call("POST", space + "/proposals", proposal(["TBL-112", "TBL-111"]))).data.id;
  await call("POST", space + "/proposals/" + ids.withdrawn + "/withdraw", { body: {} });
  ids.accepted = (await call("POST", space + "/proposals", proposal(["TBL-112"]))).data.id;
  ids.edit = (await call("POST", space + "/proposals/" + ids.accepted + "/accept", { body: {}, kind: "user" })).data.edit.id;
  // The checkpoint's and the recommendation's comments wait longer than the
  // question, and the withdrawn proposal closed last.
  for (const [name, minute] of [["question", 5], ["answer", 4], ["checkpoint", 9], ["recommended", 1], ["gone", 2], ["goneMine", 3], ["answered", 6]]) at("comments", ids[name], { made_at: time(minute), last_at: time(minute) });
  at("proposals", ids.offered, { made_at: time(7) });
  at("proposals", ids.withdrawn, { made_at: time(1), closed_at: time(8) });
  at("proposals", ids.accepted, { made_at: time(2), closed_at: time(3) });
  return ids;
}

test("API-152 gives my turn in SPEC-143's order, the agent's turn with its claims, apart and the closed count", async () => {
  const { call, at } = await server();
  const ids = await talk({ call, at });
  const claim = (await call("POST", space + "/claims/" + ids.question, { session: "agent-one" })).data;
  const edit = (await call("POST", space + "/claims/" + ids.edit, { session: "agent-two" })).data;
  const answer = await call("GET", space + "/talk/nexus/05-erd");
  assert.equal(answer.status, 200);
  const { data } = answer;
  assert.deepEqual([data.project, data.part, data.stage, data.item], ["corthex", "nexus", "05-erd", null]);
  // The comment that asks for the checkpoint first, then the open proposal,
  // then the other comments that wait for the user, oldest first.
  assert.deepEqual(data.mine.entries.map((entry) => [entry.kind, (entry.comment || entry.proposal).id]),
    [["comment", ids.checkpoint], ["proposal", ids.offered], ["comment", ids.recommended], ["comment", ids.answer]]);
  assert.equal(data.mine.total, 4);
  assert.deepEqual(data.mine.entries[1].comment, null);
  assert.deepEqual([data.mine.entries[0].proposal, data.mine.entries[0].comment.item, data.mine.entries[0].comment.asks, data.mine.entries[0].comment.claim],
    [null, "", "checkpoint", null]);
  assert.deepEqual(data.mine.entries[1].proposal, { id: ids.offered, part: "nexus", stage: "05-erd", commit: data.mine.entries[1].proposal.commit, items: ["TBL-111"],
    reason: "Name it plainly", change: "Rename it", source_text_chars: data.mine.entries[1].proposal.source_text_chars, comment: null, discrepancy: null,
    state: "open", made_at: time(7), closed_at: null, edit: null });
  // The agent's turn, with the claim's start and end; no session asked, so
  // the claim is not mine.
  assert.deepEqual([data.agent.total, talkIds(data.agent)], [1, [ids.question]]);
  assert.deepEqual(data.agent.entries[0].claim, { claimed_at: claim.claimed_at, ends_at: claim.ends_at, mine: false });
  assert.deepEqual([data.agent.entries[0].waits, data.agent.entries[0].last_at, data.agent.entries[0].replies, data.agent.entries[0].last_reply, data.agent.entries[0].proposals],
    ["agent", time(5), 0, null, []]);
  // The comments on an item that the stage no longer holds, oldest first,
  // whichever turn they wait for.
  assert.deepEqual([data.apart.total, talkIds(data.apart), data.apart.entries.map((entry) => [entry.item, entry.waits, entry.claim])],
    [2, [ids.gone, ids.goneMine], [["TBL-109", "agent", null], ["TBL-109", "user", null]]]);
  // The closed talk is counted, and listed only with closed=1.
  assert.deepEqual(data.closed, { total: 3, entries: [] });
  // The pending reflection, with its proposal and its claim.
  assert.deepEqual(data.reflections.map((row) => [row.id, row.state, row.proposal.id, row.claim]),
    [[ids.edit, "pending", ids.accepted, { claimed_at: edit.claimed_at, ends_at: edit.ends_at, mine: false }]]);
  // A claim released, or on an entry that closed, is gone from the talk.
  await call("DELETE", space + "/claims/" + ids.question, { session: "agent-one" });
  assert.equal((await call("GET", space + "/talk/nexus/05-erd")).data.agent.entries[0].claim, null);
  // HEAD answers the same status with no body.
  const head = await call("HEAD", space + "/talk/nexus/05-erd");
  assert.deepEqual([head.status, head.text, head.headers.get("Content-Type")], [200, "", "application/json; charset=utf-8"]);
});

test("API-152 narrows every list to the item, apart and closed included", async () => {
  const { call, at } = await server();
  const ids = await talk({ call, at });
  let data = (await call("GET", space + "/talk/nexus/05-erd?item=TBL-111&closed=1")).data;
  assert.deepEqual([data.item, talkIds(data.mine), talkIds(data.agent), talkIds(data.apart), data.closed.total, talkIds(data.closed), data.reflections],
    ["TBL-111", [ids.offered], [ids.question], [], 2, [ids.withdrawn, ids.answered], []]);
  data = (await call("GET", space + "/talk/nexus/05-erd?item=TBL-112&closed=1")).data;
  assert.deepEqual([talkIds(data.mine), talkIds(data.closed), data.reflections.map((row) => row.id)], [[ids.answer], [ids.withdrawn, ids.accepted], [ids.edit]]);
  data = (await call("GET", space + "/talk/nexus/05-erd?item=TBL-109")).data;
  assert.deepEqual([data.mine.total, data.agent.total, talkIds(data.apart), data.closed.total], [0, 0, [ids.gone, ids.goneMine], 0]);
  // An item with no talk, and a stage with none: every list is empty.
  for (const path of ["/talk/nexus/05-erd?item=TBL-404", "/talk/nexus/13-presentation", "/talk/memory/05-erd"]) {
    data = (await call("GET", space + path)).data;
    assert.deepEqual([data.mine, data.agent, data.apart, data.closed, data.reflections],
      [{ total: 0, entries: [] }, { total: 0, entries: [] }, { total: 0, entries: [] }, { total: 0, entries: [] }, []], path);
  }
});

test("API-152 gives the closed talk 50 at a time after after, newest first", async () => {
  const { call, at } = await server();
  const made = [];
  for (let index = 0; index < 60; index++) {
    const id = (await call("POST", space + "/comments", { ...comment("TBL-111", "Closed question " + index), kind: "user" })).data.id;
    await call("POST", space + "/comments/" + id + "/answered", { body: {} });
    const offered = (await call("POST", space + "/proposals", proposal(["TBL-112"]))).data.id;
    await call("POST", space + "/proposals/" + offered + "/withdraw", { body: {} });
    // Alternate the two kinds in time, one minute apart, oldest first.
    at("comments", id, { last_at: "2026-11-08T" + String(Math.floor(index * 2 / 60)).padStart(2, "0") + ":" + String(index * 2 % 60).padStart(2, "0") + ":00.000Z" });
    at("proposals", offered, { closed_at: "2026-11-08T" + String(Math.floor((index * 2 + 1) / 60)).padStart(2, "0") + ":" + String((index * 2 + 1) % 60).padStart(2, "0") + ":00.000Z" });
    made.push(id, offered);
  }
  const seen = [];
  for (const after of [0, 50, 100]) {
    const closed = (await call("GET", space + "/talk/nexus/05-erd?closed=1&after=" + after)).data.closed;
    assert.equal(closed.total, 120);
    assert.equal(closed.entries.length, after === 100 ? 20 : 50);
    seen.push(...talkIds(closed));
  }
  assert.deepEqual(seen, [...made].reverse());
  assert.deepEqual(new Set(seen.slice(0, 2).map((id) => id.slice(0, 3))), new Set(["np_", "nc_"]));
  // Past the end, and with closed=0, no closed entries but their count.
  for (const query of ["?closed=1&after=120", "?closed=1&after=100000", "?after=50"]) {
    assert.deepEqual((await call("GET", space + "/talk/nexus/05-erd" + query)).data.closed, { total: 120, entries: [] }, query);
  }
  // The closed comment is an entry as a list holds it, with no claim.
  const last = (await call("GET", space + "/talk/nexus/05-erd?closed=1&after=119")).data.closed.entries;
  assert.deepEqual([last.length, last[0].kind, last[0].proposal, last[0].comment.state, last[0].comment.closed_as, last[0].comment.claim],
    [1, "comment", null, "closed", "answered", null]);
});

test("API-152 refuses a project without a space, what it does not hold and query values in another form", async () => {
  const { call } = await server();
  const legacy = { schema: "corthex-hub/0.1", generated_at: "2026-01-12T10:00:00+09:00", project: { name: "acme-shop", title: "Acme Shop" },
    stages: {}, summary: { items: 0 }, items: [], checks: [] };
  assert.equal((await call("POST", "/api/snapshots", { body: legacy })).status, 200);
  await quiet(async () => {
    for (const [path, status, code, field] of [
      ["/api/spaces/acme-shop/talk/_/02-prd", 404, "space_not_found"], ["/api/spaces/unknown/talk/nexus/05-erd", 404, "project_not_found"],
      [space + "/talk/billing/05-erd", 404, "part_not_found"], [space + "/talk/nexus/14-other", 404, "not_found"],
      [space + "/talk/nexus/05-erd?item=tbl-111", 400, "invalid_request", "item"], [space + "/talk/nexus/05-erd?item=TBL-1234567", 400, "invalid_request", "item"],
      [space + "/talk/nexus/05-erd?item=", 400, "invalid_request", "item"], [space + "/talk/nexus/05-erd?closed=2", 400, "invalid_request", "closed"],
      [space + "/talk/nexus/05-erd?closed=0&closed=1", 400, "invalid_request", "closed"], [space + "/talk/nexus/05-erd?after=-1", 400, "invalid_request", "after"],
      ["/api/spaces/unknown/talk/nexus/05-erd?closed=yes", 400, "invalid_request", "closed"],
    ]) {
      const answer = await call("GET", path);
      assert.deepEqual([answer.status, answer.data.code, answer.data.field, answer.headers.get("Content-Type")], [status, code, field, "application/problem+json"], path);
    }
    const method = await call("POST", space + "/talk/nexus/05-erd", { body: {} });
    assert.deepEqual([method.status, method.data.code, method.headers.get("Allow")], [405, "method_not_allowed", "GET, HEAD"]);
  });
});
