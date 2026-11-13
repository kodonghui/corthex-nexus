// API-151 getHome (TASK-269): the first page's my turn, the agent to-do's
// counts and the project cards, against synthetic snapshots in an in-memory
// SQLite database.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { handle } from "../src/app.js";
import { drawingOf } from "../src/home-data.js";
import { pictureLayout } from "../src/layout.js";
import { fakeD1 } from "./fake-d1.js";
import { testAccess } from "./access-fixture.js";
import { viewSnapshot } from "./view-fixtures.js";

const template = readFileSync(new URL("../src/hub.html", import.meta.url), "utf8");
// One set of synthetic Access keys for the file: the verifier keeps the keys it read.
const access = await testAccess();
const COMMIT = "3f1c9a7e5b2d4c6a8e0f1b3d5c7a9e1f2b4d6c8a";
const where = "docs/05-erd/nexus.sql:1";
const TITLE = "Before the first push of a project, the hub skill shall have the agent ask the user.";
const LONG_NEXT = "Write the API contract, ".repeat(13).trim();

// The example 0.2 snapshot with its parts in the settings' order, nexus
// first: three tables in the ERD of nexus, a requirement, an item outside the
// 13 stages, four checks and the records of two stages. The first push also
// holds a DDD board of nexus, a sitemap of memory and a part, old, that the
// second push no longer names.
function corthex(first = true) {
  const data = JSON.parse(readFileSync(new URL("./snapshot-02-example.json", import.meta.url), "utf8"));
  const fixture = viewSnapshot("corthex");
  const picture = (part, stage, source) => ({ part, stage, commit: COMMIT, time: "2026-11-03T09:40:00+09:00", source });
  data.project.parts = first ? ["nexus", "memory", "old"] : ["nexus", "memory"];
  data.generated_at = first ? "2026-11-03T10:00:00+09:00" : "2026-11-03T11:00:00+09:00";
  data.items = [...data.items, { id: "TBL-112", kind: "table", stage: "05-erd", where, title: "payments" },
    { id: "TBL-113", kind: "table", stage: "05-erd", where, title: "refunds" },
    { id: "REQ-107", kind: "requirement", stage: "02-prd", where: "docs/02-prd/nexus.md:9", title: TITLE },
    { id: "CTX-001", kind: "context", stage: "01-domain", where: "docs/01-domain/nexus.md:3", title: "Ordering" },
    { id: "NOTE-001", kind: "note", stage: "00-notes", where: "docs/notes.md:1", title: "A stage of its own" }];
  data.summary = { ...data.summary, items: data.items.length };
  data.checks = [{ rule: "unlinked", level: "warn", message: "Unlinked" }, { rule: "unlinked", level: "warn", message: "Unlinked" },
    { rule: "duplicate", level: "error", message: "Duplicate" }, { rule: "note", level: "info", message: "Note" }];
  data.stages["02-prd"] = { name: "PRD", source: "docs/02-prd/", source_state: "found", read: true,
    parts: { nexus: { state: "done", checkpoints: [], next: "", updated: "2026-11-02T10:00:00+09:00" },
      memory: { state: "not_started", checkpoints: [], next: "Write the memory PRD", updated: "2026-11-02T10:00:00+09:00" } } };
  const table = (id, name) => ({ id, name, context: "CTX-007", terms: [], removed: false, where,
    columns: [{ name: "id", type: "TEXT", null: false, where }], primary_key: ["id"], unique: [], foreign_keys: [] });
  data.pictures[0].source.tables.push(table("TBL-112", "payments"), table("TBL-113", "refunds"));
  data.pictures.push(picture("nexus", "01-domain", fixture.pictures.find((row) => row.stage === "01-domain").source));
  if (first) data.pictures.push(picture("memory", "07-sitemap", fixture.pictures.find((row) => row.stage === "07-sitemap").source),
    picture("old", "05-erd", data.pictures[0].source));
  data.left_out = [];
  return data;
}

// A 0.2 snapshot of a shop whose part sample holds a DDD board, an ERD and a
// sitemap without screens.
function shop() {
  const data = viewSnapshot("qa-shop");
  data.pictures.find((row) => row.stage === "07-sitemap").source.screens = [];
  return data;
}
// A project that only a hub of 0.1 pushed, whose title and next action are
// longer than a card holds: a record of 0.2 holds 300 characters of its next
// action, one of 0.1 more.
const legacy = { schema: "corthex-hub/0.1", generated_at: "2026-01-12T10:00:00+09:00", project: { name: "acme-shop", title: "Acme Shop ".repeat(13) },
  stages: { "02-prd": { source_state: "found", read: true, state: "in_progress", next: LONG_NEXT } }, summary: { items: 1 },
  items: [{ id: "REQ-001", kind: "requirement", stage: "02-prd", title: "Send an order confirmation", priority: "Must" }], checks: [] };

async function server(...snapshots) {
  const db = new DatabaseSync(":memory:");
  const env = { ...access.env, DB: fakeD1(db), NEXUS_LANGUAGE: "en" };
  let serial = 0;
  async function call(method, path, { body, kind = "agent", session = "home-test" } = {}) {
    const headers = { ...access.headers(kind), ...(session === null ? {} : { "Nexus-Session": session }) };
    if (method === "POST") headers["Idempotency-Key"] = '"nw_' + (++serial).toString().padStart(12, "0") + '"';
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await handle(new Request("https://nexus.example.com" + path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env, access.ctx, template);
    const text = await response.text();
    return { status: response.status, headers: response.headers, text, data: text ? JSON.parse(text) : null };
  }
  for (const snapshot of snapshots) {
    const pushed = await call("POST", "/api/snapshots", { body: snapshot });
    assert.equal(pushed.status, 200, pushed.text);
  }
  // Entries made in one millisecond would sort by their random IDs: the
  // tests set the times that they order by.
  const at = (table, id, fields) => db.prepare(`UPDATE ${table} SET ${Object.keys(fields).map((name) => name + "=?").join(",")} WHERE id=?`).run(...Object.values(fields), id);
  return { db, call, at };
}

const time = (minute) => "2026-11-08T07:" + String(minute).padStart(2, "0") + ":00.000Z";
const comment = (project, part, stage, item, text, extra = {}) => ["/api/spaces/" + project + "/comments", { body: { part, stage, item, text, ...extra } }];
// Sends a comment as the agent or the user and gives its ID.
const say = async (call, kind, [path, options]) => (await call("POST", path, { ...options, kind })).data.id;

test("API-151 answers a server without snapshots with nothing waiting and no card, and HEAD alike", async () => {
  const { call } = await server();
  const answer = await call("GET", "/api/home");
  assert.equal(answer.status, 200);
  assert.match(answer.data.generated_at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  assert.deepEqual(answer.data, { generated_at: answer.data.generated_at, my_turn: { total: 0, entries: [] }, agent: [], projects: [] });
  assert.deepEqual([answer.headers.get("Content-Type"), answer.headers.get("Cache-Control")], ["application/json; charset=utf-8", "no-store"]);
  const head = await call("HEAD", "/api/home");
  assert.deepEqual([head.status, head.text, head.headers.get("Content-Type")], [200, "", "application/json; charset=utf-8"]);
});

test("API-151 gathers my turn across the spaces in SPEC-143's order, each group oldest first", async () => {
  const { call, at } = await server(corthex(), shop());
  const ids = {};
  const post = async (name, sent, kind = "agent") => { ids[name] = await say(call, kind, sent); };
  await post("shopCheckpoint", comment("qa-shop", "sample", "01-domain", "", "Pass the board?", { asks: "checkpoint", look_first: "https://example.com/qa-shop/board" }));
  await post("checkpoint", comment("corthex", "nexus", "05-erd", "", "Pass the ERD with the rows as drafted?", { asks: "checkpoint", look_first: "TBL-111" }));
  await post("question", comment("corthex", "nexus", "02-prd", "REQ-107", "Should the agent also ask before a push again?", { asks: "answer" }));
  await post("gone", comment("corthex", "nexus", "05-erd", "TBL-109", "Drop the table?", { asks: "answer", quote: "CREATE TABLE claims_old (" }));
  await post("asked", comment("corthex", "nexus", "05-erd", "TBL-111", "Should a claim end early?"), "user");
  const reply = "x".repeat(290) + "가나다라마바사아자차카";
  await call("POST", "/api/spaces/corthex/comments/" + ids.asked + "/replies", { body: { text: reply, asks: "recommended" } });
  await post("waiting", comment("corthex", "nexus", "05-erd", "TBL-112", "Which currency?"), "user");
  await post("answered", comment("corthex", "nexus", "05-erd", "TBL-113", "Done?", { asks: "answer" }));
  await call("POST", "/api/spaces/corthex/comments/" + ids.answered + "/answered", { body: {}, kind: "user" });
  const proposal = (project, part, items, change) => ["/api/spaces/" + project + "/proposals", { body: { part, stage: "05-erd", items, reason: "Name it plainly", change } }];
  await post("offered", proposal("corthex", "nexus", ["TBL-112", "TBL-111"], "Rename the table payments to settlements."));
  await post("shopOffered", proposal("qa-shop", "sample", ["TBL-002"], "Split the payments."));
  await post("withdrawn", proposal("corthex", "nexus", ["TBL-113"], "Drop refunds."));
  await call("POST", "/api/spaces/corthex/proposals/" + ids.withdrawn + "/withdraw", { body: {} });
  await post("accepted", proposal("corthex", "nexus", ["TBL-113"], "Keep refunds."));
  await call("POST", "/api/spaces/corthex/proposals/" + ids.accepted + "/accept", { body: {}, kind: "user" });
  for (const [name, minute] of [["shopCheckpoint", 6], ["checkpoint", 2], ["question", 1], ["gone", 5], ["asked", 3], ["answered", 0], ["waiting", 0]])
    at("comments", ids[name], { last_at: time(minute) });
  at("proposals", ids.offered, { made_at: time(9) });
  at("proposals", ids.shopOffered, { made_at: time(8) });

  const home = (await call("GET", "/api/home")).data;
  assert.equal(home.my_turn.total, 7);
  assert.deepEqual(home.my_turn.entries.map((entry) => entry.id),
    [ids.checkpoint, ids.shopCheckpoint, ids.shopOffered, ids.offered, ids.question, ids.asked, ids.gone]);
  const [checkpoint, shopCheckpoint, shopOffered, offered, question, asked, gone] = home.my_turn.entries;
  assert.deepEqual(checkpoint, { kind: "comment", id: ids.checkpoint, project: "corthex", part: "nexus", stage: "05-erd", item: "", title: null,
    quote: null, text: "Pass the ERD with the rows as drafted?", at: time(2), asks: "checkpoint" });
  assert.deepEqual([shopCheckpoint.project, shopCheckpoint.part, shopCheckpoint.stage, shopCheckpoint.asks], ["qa-shop", "sample", "01-domain", "checkpoint"]);
  // A proposal shows its first item, its change and when it was made; the shop's
  // snapshot holds no items, so its item has no title.
  assert.deepEqual(offered, { kind: "proposal", id: ids.offered, project: "corthex", part: "nexus", stage: "05-erd", item: "TBL-112", title: "payments",
    quote: null, text: "Rename the table payments to settlements.", at: time(9), asks: null });
  assert.deepEqual([shopOffered.item, shopOffered.title, shopOffered.at], ["TBL-002", null, time(8)]);
  assert.deepEqual([question.item, question.title, question.asks], ["REQ-107", TITLE, "answer"]);
  // A comment shows the last reply, cut at 300 characters, and what it asks.
  assert.deepEqual([asked.text, Array.from(asked.text).length, asked.asks, asked.title, asked.at], [Array.from(reply).slice(0, 300).join(""), 300, "recommended", "claims", time(3)]);
  assert.deepEqual([gone.item, gone.title, gone.quote], ["TBL-109", null, "CREATE TABLE claims_old ("]);
});

test("API-151 gives 50 entries of my turn with the total of them all", async () => {
  const { call, at } = await server(corthex());
  for (let n = 0; n < 53; n++) {
    const id = await say(call, "agent", comment("corthex", "nexus", "05-erd", "", "Synthetic question " + n, { asks: "answer" }));
    at("comments", id, { last_at: new Date(Date.UTC(2026, 10, 8, 7, 0, n)).toISOString() });
  }
  const home = (await call("GET", "/api/home")).data;
  assert.deepEqual([home.my_turn.total, home.my_turn.entries.length], [53, 50]);
  assert.deepEqual(home.my_turn.entries.map((entry) => entry.text), Array.from({ length: 50 }, (_, n) => "Synthetic question " + n));
});

test("API-151 shows a comment's last entry, the agent's: an open proposal that answers it after its last reply, else that reply", async () => {
  const { call } = await server(corthex());
  const reply = (id, kind, text) => call("POST", "/api/spaces/corthex/comments/" + id + "/replies", { body: { text }, kind });
  const answer = async (id, change) => say(call, "agent", ["/api/spaces/corthex/proposals",
    { body: { part: "nexus", stage: "05-erd", items: ["TBL-112"], reason: "As asked", change, comment: id } }]);
  // The user's last reply comes before the agent's proposal, so the proposal
  // is the last entry, not the user's words.
  const currency = await say(call, "user", comment("corthex", "nexus", "05-erd", "TBL-112", "Which currency?"));
  await reply(currency, "agent", "Euro or won?");
  await reply(currency, "user", "Won.");
  const won = await answer(currency, "Store the amounts in won.");
  // A proposal withdrawn is no entry: the comment's own text is its last.
  const column = await say(call, "agent", comment("corthex", "nexus", "05-erd", "TBL-112", "Keep the column note?"));
  const dropped = await answer(column, "Drop the column note.");
  await call("POST", "/api/spaces/corthex/proposals/" + dropped + "/withdraw", { body: {} });
  // A reply after the proposal is the last entry.
  const index = await say(call, "agent", comment("corthex", "nexus", "05-erd", "TBL-112", "Index the reference?"));
  const indexed = await answer(index, "Add an index on the reference.");
  await reply(index, "agent", "Or keep it unique only.");
  const home = (await call("GET", "/api/home")).data;
  const text = Object.fromEntries(home.my_turn.entries.map((entry) => [entry.id, [entry.kind, entry.text, entry.asks]]));
  assert.deepEqual(text, { [currency]: ["comment", "Store the amounts in won.", null], [won]: ["proposal", "Store the amounts in won.", null],
    [column]: ["comment", "Keep the column note?", null], [index]: ["comment", "Or keep it unique only.", null], [indexed]: ["proposal", "Add an index on the reference.", null] });
  assert.equal(home.my_turn.total, 5);
});

test("API-151 counts each space's agent to-do by list, with the place of its oldest entry and the taken ones", async () => {
  const { db, call, at } = await server(corthex(), shop(), legacy);
  const claimed = await say(call, "user", comment("corthex", "nexus", "05-erd", "TBL-111", "Should a claim end early?"));
  const ids = {};
  for (const [name, part, stage, minute] of [["later", "nexus", "05-erd", 3], ["oldest", "memory", "02-prd", 1]]) {
    ids[name] = await say(call, "user", comment("corthex", part, stage, "", "Is this right?"));
    at("comments", ids[name], { last_at: time(minute) });
  }
  // A comment that waits for the user is my turn, not the agent's.
  const mine = await say(call, "agent", comment("corthex", "nexus", "05-erd", "", "Pass it?", { asks: "checkpoint", look_first: "TBL-111" }));
  // Two open discrepancies, the older one at a screen's stage, and one resolved.
  db.prepare(`INSERT INTO discrepancies (id,project,part,compares,term,item,reasons,level,state,opened_commit,opened_at) VALUES
    ('nd_aaaaaaaaaaaa','corthex','nexus','aggregate-table','TERM-001','TBL-112','[]','warn','open',?,'2026-11-03T02:00:00.000Z'),
    ('nd_bbbbbbbbbbbb','corthex','memory','read-model-screen','TERM-002','SCR-001','[]','info','open',?,'2026-11-03T01:00:00.000Z')`).run(COMMIT, COMMIT);
  db.prepare(`INSERT INTO discrepancies (id,project,part,compares,term,item,reasons,level,state,opened_commit,opened_at,resolved_commit,resolved_at) VALUES
    ('nd_cccccccccccc','corthex','nexus','aggregate-table','TERM-003','TBL-113','[]','warn','resolved',?,'2026-11-03T00:00:00.000Z',?,'2026-11-03T03:00:00.000Z')`).run(COMMIT, COMMIT);
  const proposal = { part: "nexus", stage: "05-erd", items: ["TBL-111"], reason: "Name it plainly", change: "Rename it" };
  const accepted = (await call("POST", "/api/spaces/corthex/proposals", { body: proposal })).data.id;
  const edit = (await call("POST", "/api/spaces/corthex/proposals/" + accepted + "/accept", { body: {}, kind: "user" })).data.edit.id;
  const checkpoint = (await call("POST", "/api/spaces/corthex/checkpoints", { body: { part: "nexus", stage: "05-erd", words: "As drafted" }, kind: "user" })).data.id;
  // Two sessions take the comment and the reflection; a claim on my turn's
  // comment is no entry of the to-do.
  for (const [entry, session] of [[claimed, "agent-one"], [edit, "agent-two"], [mine, "agent-two"]])
    assert.equal((await call("POST", "/api/spaces/corthex/claims/" + entry, { body: {}, session })).status, 200);

  const home = (await call("GET", "/api/home")).data;
  // Each push opened one discrepancy as well: corthex's board names an
  // aggregate without a table, and the shop's a read model without a screen.
  const shopDiscrepancy = db.prepare("SELECT id, opened_at FROM discrepancies WHERE project='qa-shop'").get();
  // Neither space was read (SPEC-189): every entry that waits for the agent and
  // that no session holds is not read yet, here two comments, three
  // discrepancies and the checkpoint, since the oldest discrepancy opened.
  assert.deepEqual(home.agent, [
    { project: "corthex", comments: { total: 3, oldest: { part: "memory", stage: "02-prd", entry: ids.oldest } },
      discrepancies: { total: 3, oldest: { part: "memory", stage: "07-sitemap", entry: "nd_bbbbbbbbbbbb" } },
      reflections: { total: 1, oldest: { part: "nexus", stage: "05-erd", entry: edit } },
      checkpoints: { total: 1, oldest: { part: "nexus", stage: "05-erd", entry: checkpoint } }, taken: 2,
      read_at: null, unread: 6, unread_since: "2026-11-03T01:00:00.000Z" },
    { project: "qa-shop", comments: { total: 0, oldest: null }, discrepancies: { total: 1, oldest: { part: "sample", stage: "07-sitemap", entry: shopDiscrepancy.id } },
      reflections: { total: 0, oldest: null }, checkpoints: { total: 0, oldest: null }, taken: 0,
      read_at: null, unread: 1, unread_since: shopDiscrepancy.opened_at },
  ]);
  // The counts are the lists of API-113 read without a session.
  const todo = (await call("GET", "/api/spaces/corthex/todo", { session: null })).data;
  assert.deepEqual([todo.comments.total, todo.discrepancies.total, todo.reflections.total, todo.checkpoints.total, todo.taken], [3, 3, 1, 1, 2]);
});

test("API-151 gives a card for each stored snapshot by name, with its parts, stages and pictures", async () => {
  const { call } = await server(corthex(), shop(), legacy);
  assert.equal((await call("POST", "/api/snapshots", { body: corthex(false) })).status, 200);
  for (const stage of ["05-erd", "05-erd", "01-domain"]) await say(call, "user", comment("corthex", "nexus", stage, "", "Is this right?"));
  const closed = await say(call, "user", comment("corthex", "nexus", "05-erd", "", "Done?"));
  await call("POST", "/api/spaces/corthex/comments/" + closed + "/answered", { body: {}, kind: "user" });

  const projects = (await call("GET", "/api/home")).data.projects;
  assert.deepEqual(projects.map((card) => card.name), ["acme-shop", "corthex", "qa-shop"]);
  const [acme, card, qa] = projects;
  // A project that only a hub of 0.1 pushed: the project as a whole, no
  // repository, commit or space.
  assert.deepEqual(acme, { name: "acme-shop", title: "Acme Shop ".repeat(13).slice(0, 120), repository: null, commit: null,
    generated_at: "2026-01-12T10:00:00+09:00", pushed_at: acme.pushed_at, items: 1, warnings: 0,
    parts: [{ name: "", recorded: true, current: "02-prd", next: LONG_NEXT.slice(0, 300), states: ["unknown", "in_progress", ...Array(11).fill("unknown")] }],
    stages: acme.stages, pictures: [] });
  assert.deepEqual(acme.stages.filter((row) => row.items).map((row) => [row.key, row.items]), [["02-prd", 1]]);

  assert.deepEqual([card.title, card.repository, card.commit, card.generated_at, card.items, card.warnings],
    ["CORTHEX", "https://github.com/kodonghui/corthex", COMMIT, "2026-11-03T11:00:00+09:00", 5, 2]);
  assert.deepEqual(card.stages.map((row) => row.key), ["01-domain", "02-prd", "03-user-flow", "04-functional-spec", "05-erd", "06-api", "07-sitemap",
    "08-screen-states", "09-mockup", "10-wbs", "11-development", "12-qa", "13-presentation"]);
  assert.deepEqual(card.stages.filter((row) => row.items).map((row) => [row.key, row.items]), [["01-domain", 1], ["02-prd", 1], ["05-erd", 3]]);
  // The parts in the settings' order: nexus's first stage in progress, and
  // memory's first not started when none is in progress.
  assert.deepEqual(card.parts.map(({ name, recorded, current, next }) => [name, recorded, current, next]),
    [["nexus", true, "05-erd", "Write the API contract"], ["memory", true, "02-prd", "Write the memory PRD"]]);
  assert.deepEqual(card.parts[0].states.slice(0, 5), ["unknown", "done", "unknown", "unknown", "in_progress"]);
  // The pictures by the parts' order and then the stages': the sitemap that
  // the second push left out is no longer current, and old's picture stays off
  // the card, since the settings no longer name old.
  assert.deepEqual(card.pictures.map(({ part, stage, not_current, comments }) => [part, stage, not_current, comments]),
    [["nexus", "01-domain", null, 1], ["nexus", "05-erd", null, 2], ["memory", "07-sitemap", "source-gone", 0]]);
  assert.deepEqual(card.pictures.map((picture) => picture.drawing.boxes.length), [14, 3, 3]);
  // Three tables stand two to a row, 130 units apart.
  assert.deepEqual(card.pictures[1].drawing, { bounds: [0, 0, 700, 374], boxes: [["table", 0, 0, 300, 122], ["table", 400, 0, 300, 122], ["table", 0, 252, 300, 122]], lines: [] });

  // The shop: a drawing for each kind of picture, and none for a sitemap
  // without screens.
  assert.deepEqual([qa.items, qa.warnings, qa.parts.map((part) => [part.name, part.current, part.next])], [0, 0, [["sample", "01-domain", "Review the synthetic sample"]]]);
  assert.deepEqual(qa.pictures.map((picture) => [picture.stage, picture.drawing && picture.drawing.boxes.map((box) => box[0])]), [
    ["01-domain", ["context", "lane", "event", "command", "actor", "aggregate", "read-model", "event", "command", "aggregate", "policy", "read-model", "external", "hotspot"]],
    ["05-erd", ["table", "table"]], ["07-sitemap", null]]);
  // The payments table's key points from its right middle to the orders
  // table's left middle.
  assert.deepEqual(qa.pictures[1].drawing, { bounds: [0, 0, 700, 186], boxes: [["table", 0, 0, 300, 154], ["table", 400, 0, 300, 186]], lines: [[700, 93, 0, 77]] });
});

test("API-151's small drawing is the first layout without labels, null past 2,000 boxes or lines or at the layout's limit", () => {
  const where = "docs/qa.md:1";
  const table = (n, keys = []) => ({ id: "", name: "t" + n, context: "", removed: false, where, columns: [{ name: "id", type: "TEXT", null: false, where }],
    primary_key: ["id"], unique: [], foreign_keys: keys.map((other) => ({ columns: ["id"], table: "t" + other, references: ["id"], on_delete: "", where })) });
  const erd = (tables) => ({ format: 1, tables, without_table: [] });
  // 50 tables with 40 keys each draw 2,000 lines; one key more is too many.
  const keyed = (extra) => erd(Array.from({ length: 50 }, (_, n) => table(n, Array.from({ length: 40 + (n < extra ? 1 : 0) }, (_, k) => (n + k + 1) % 50))));
  assert.equal(drawingOf(keyed(0), "05-erd").lines.length, 2000);
  assert.equal(drawingOf(keyed(1), "05-erd"), null);
  assert.equal(drawingOf(erd([]), "05-erd"), null);
  // A board of 1,999 events in one context draws 2,000 boxes with its frame;
  // one event more is too many. A board that repeats its events past the
  // layout's limit stops it, and its list of items is not a drawing.
  const rows = (count) => Array.from({ length: Math.ceil(count / 20) }, (_, r) => ({ given_by: "", policy: false, read_model: "", command: "", aggregate: "",
    events: Array.from({ length: Math.min(20, count - r * 20) }, (_, e) => "Event " + (r * 20 + e)), where }));
  const board = (count, timeline) => ({ format: 1, contexts: [{ id: "", name: "Orders", type: "core", purpose: "", removed: false, external: "", rows: rows(count), where }],
    aggregates: [], read_models: [], dependencies: [], hotspots: [], ...(timeline ? { timeline } : {}) });
  assert.equal(drawingOf(board(1999), "01-domain").boxes.length, 2000);
  assert.equal(drawingOf(board(2000), "01-domain"), null);
  const repeated = Array.from({ length: 20 }, (_, i) => ({ lane: "Lane " + i, where, places: Array.from({ length: 200 }, () => Array(10).fill("Event 0")) }));
  const limited = pictureLayout(board(1, repeated), "01-domain");
  assert.deepEqual([limited.limited, limited.nodes.length < 10], [true, true]);
  assert.equal(drawingOf(board(1, repeated), "01-domain"), null);
  // Two contexts, each with an actor of 65 units, stand 345 units high, so
  // the line between them starts and ends at 242.5, drawn at 243.
  const row = (given_by, command, event) => ({ given_by, policy: false, read_model: "", command, aggregate: "", events: [event], where });
  const context = (id, name, rows) => ({ id, name, type: "core", purpose: "", removed: false, external: "", rows, where });
  const contexts = [context("CTX-001", "Ordering", [row("Buyer", "Place order", "Order placed")]), context("CTX-002", "Shipping", [row("Clerk", "Ship order", "Order shipped")])];
  const linked = { format: 1, contexts, aggregates: [], read_models: [], hotspots: [], dependencies: [{ from: "CTX-001", to: "CTX-002", kind: "event", why: "", data: "", where }],
    timeline: [{ lane: "Buy", places: [["Order placed"], ["Order shipped"]], where }] };
  assert.deepEqual(drawingOf(linked, "01-domain"), { bounds: [0, 70, 1990, 345],
    boxes: [["context", 400, 70, 590, 345], ["context", 1400, 70, 590, 345], ["lane", 0, 70, 300, 50], ["event", 720, 170, 220, 100], ["command", 450, 170, 220, 100],
      ["actor", 450, 290, 220, 65], ["event", 1720, 170, 220, 100], ["command", 1450, 170, 220, 100], ["actor", 1450, 290, 220, 65]],
    lines: [[670, 220, 720, 220], [1670, 220, 1720, 220], [990, 243, 1400, 243]] });
});
