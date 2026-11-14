// TASK-299: the kind of browser and device of a pass (SPEC-195). The code that reads it returns
// only the words of the contract's vocabulary (its own test); the criteria of SPEC-195, TC-1442
// to TC-1444, through handle() as the Worker build runs it; TC-1741 on the standalone server,
// with passes of every kind and the checkpoints of every answer that holds them; a checkpoint
// that a stored record names, whose kind the stage's record keeps showing; and the record that
// the stage's page draws. TC-1445's other half, the stage record that the pinned hub
// writes in Git, is in tests/test_nexus.py. Synthetic projects only; the Access keys are
// generated here and every database is in memory.
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { AccessVerifier } from "../src/access.js";
import { handle } from "../src/app.js";
import { BROWSERS, DEVICES, clientKind } from "../src/client-kind.js";
import { drawRecord } from "../src/draw/stage.js";
import { esc } from "../src/draw/html.js";
import { codeMessage, label, labels } from "../src/draw/words.js";
import { createNodeServer } from "../src/node-server.js";
import { SQLiteD1 } from "../src/sqlite.js";
import { testAccess } from "./access-fixture.js";
import { fakeD1 } from "./fake-d1.js";
import { viewSnapshot } from "./view-fixtures.js";

const template = readFileSync(new URL("../src/hub.html", import.meta.url), "utf8");
const access = await testAccess();
const COMMIT = "abc1234" + "0".repeat(33);
const ADDRESS = "203.0.113.7";
// Real browsers' headers, as they send them.
const SAFARI_PHONE = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" };
const CHROME_DESKTOP = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Sec-CH-UA": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"', "Sec-CH-UA-Mobile": "?0", "Sec-CH-UA-Platform": '"Windows"' };
// 2,000 characters of text that name no browser, with a mark to look for in the database.
const LONG_TEXT = ("qa-pass-kind-mark " + "lorem ipsum dolor ").repeat(60).slice(0, 2000);
const ADDRESSED = { "CF-Connecting-IP": ADDRESS, "X-Forwarded-For": ADDRESS, "X-Real-IP": ADDRESS };

function shop(name = "acme") {
  const data = JSON.parse(JSON.stringify(viewSnapshot(name)).replaceAll("a".repeat(40), COMMIT));
  data.ids = { ...data.ids, SPEC: "spec" };
  data.items = [{ id: "SPEC-194", kind: "spec", stage: "04-functional-spec", where: "docs/qa.md:1", title: "Say what the page shows after a refused pass" },
    { id: "TBL-001", kind: "table", stage: "05-erd", where: "docs/qa.md:2", title: "orders" }];
  data.summary = { ...data.summary, items: data.items.length };
  return data;
}
const REQUEST = { part: "sample", stage: "04-functional-spec", item: "", text: "Stage 04 is ready for its checkpoint.\nLook at SPEC-194 first.",
  asks: "checkpoint", look_first: "SPEC-194" };
// Everything that the database holds, as text, to look for what must not be there.
const stored = (db) => JSON.stringify(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()
  .map(({ name }) => db.prepare(`SELECT * FROM "${name}"`).all()));
const kindOf = (checkpoint) => [checkpoint.browser, checkpoint.device, checkpoint.driven];

// The server as the Worker build runs it, in this process: handle() over D1's interface on an
// in-memory SQLite database. headers are the request's own, beside Access's.
function inProcess() {
  const db = new DatabaseSync(":memory:");
  const env = { ...access.env, DB: fakeD1(db), NEXUS_LANGUAGE: "en" };
  let serial = 0;
  async function call(method, path, { body, kind = "agent", session = null, headers = {} } = {}) {
    const sent = { ...headers, ...access.headers(kind), ...(session === null ? {} : { "Nexus-Session": session }) };
    if (method === "POST") sent["Idempotency-Key"] = '"nw_' + (++serial).toString().padStart(12, "0") + '"';
    if (body !== undefined) sent["Content-Type"] = "application/json";
    const response = await handle(new Request("https://nexus.example.com" + path, { method, headers: sent, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env, access.ctx, template);
    const text = await response.text();
    return { status: response.status, text, data: text && /json/.test(response.headers.get("Content-Type") || "") ? JSON.parse(text) : null };
  }
  return { db, call };
}
const pass = (call, headers, body = { part: "sample", stage: "05-erd", commit: COMMIT }) => call("POST", "/api/spaces/acme/checkpoints", { kind: "user", body, headers });

// Every answer that holds the checkpoint, read after the pass: the pass's own, the checkpoint,
// the agent to-do, the stage's record and 0.2's overview, which the stage's record holds.
async function everyAnswer(call, id, stage = "05-erd") {
  const one = (await call("GET", "/api/spaces/acme/checkpoints/" + id)).data;
  const todo = (await call("GET", "/api/spaces/acme/todo", { session: "s-1" })).data.checkpoints.entries.find((entry) => entry.id === id);
  const record = (await call("GET", `/api/spaces/acme/stages/sample/${stage}`)).data.record.checkpoints.find((entry) => entry.id === id);
  const overview = (await call("GET", `/api/spaces/acme/overview/sample/${stage}`)).data.checkpoints.find((entry) => entry.id === id);
  return { one, todo, record, overview };
}

test("TASK-299: the code that reads the kind returns only the contract's words, for real browsers and for any text", () => {
  // The vocabulary is the contract's Checkpoint's, without its null, which only a checkpoint
  // passed before the revision holds.
  const contract = readFileSync(new URL("../../docs/06-api/nexus.openapi.yaml", import.meta.url), "utf8");
  const schema = contract.slice(contract.indexOf("\n    Checkpoint:\n"), contract.indexOf("\n    CheckpointEntry:\n"));
  const enumOf = (name) => new RegExp(`\\n        ${name}:\\n(?:          .*\\n)*?          enum: \\[([^\\]]+)\\]`).exec(schema)[1].split(",").map((word) => word.trim());
  assert.deepEqual([...BROWSERS, "null"], enumOf("browser"));
  assert.deepEqual([...DEVICES, "null"], enumOf("device"));
  const read = (headers) => clientKind(new Headers(headers));
  const cases = [
    [SAFARI_PHONE, "safari", "phone"],
    // An iPad's Safari names a Mac by default, and is then a desktop, as the request names it.
    [{ "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15" }, "safari", "desktop"],
    [{ "User-Agent": "Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1" }, "safari", "tablet"],
    [CHROME_DESKTOP, "chrome", "desktop"],
    [{ "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
      "Sec-CH-UA": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"', "Sec-CH-UA-Mobile": "?1", "Sec-CH-UA-Platform": '"Android"' }, "chrome", "phone"],
    [{ "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Sec-CH-UA": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"', "Sec-CH-UA-Mobile": "?0", "Sec-CH-UA-Platform": '"Android"' }, "chrome", "tablet"],
    [{ "Sec-CH-UA": '"Microsoft Edge";v="131", "Chromium";v="131", "Not_A Brand";v="24"', "Sec-CH-UA-Mobile": "?0", "Sec-CH-UA-Platform": '"Windows"' }, "edge", "desktop"],
    [{ "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0" }, "edge", "desktop"],
    [{ "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0" }, "firefox", "desktop"],
    [{ "User-Agent": "Mozilla/5.0 (Android 14; Mobile; rv:133.0) Gecko/133.0 Firefox/133.0" }, "firefox", "phone"],
    [{ "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/133.0 Mobile/15E148 Safari/605.1.15" }, "firefox", "phone"],
    [{ "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1" }, "chrome", "phone"],
    [{ "User-Agent": "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36" }, "other", "phone"],
    [{ "Sec-CH-UA": '"Opera";v="114", "Chromium";v="128", "Not=A?Brand";v="24"', "Sec-CH-UA-Mobile": "?0", "Sec-CH-UA-Platform": '"macOS"' }, "other", "desktop"],
    // Chrome for Testing without a head, as the repository's browser suites run it.
    [{ "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36",
      "Sec-CH-UA": '"Chromium";v="153", "Not_A Brand";v="8"', "Sec-CH-UA-Mobile": "?0", "Sec-CH-UA-Platform": '"Linux"' }, "chrome", "desktop"],
    // Chromium without a head, as Playwright 1.63 launches it, adds the brand HeadlessChrome,
    // which is of Chrome's family as its User-Agent is (BUG-609).
    [{ "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.8010.12 Safari/537.36",
      "Sec-CH-UA": '"HeadlessChrome";v="153", "Not_A Brand";v="8", "Chromium";v="153"', "Sec-CH-UA-Mobile": "?0", "Sec-CH-UA-Platform": '"Linux"' }, "chrome", "desktop"],
    // A brand of its own beside HeadlessChrome is still another browser.
    [{ "Sec-CH-UA": '"HeadlessChrome";v="153", "Brave";v="153", "Chromium";v="153"', "Sec-CH-UA-Mobile": "?0", "Sec-CH-UA-Platform": '"Linux"' }, "other", "desktop"],
    // An app's own web view on a phone, which is no browser of the four.
    [{ "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.4.5" }, "other", "phone"],
    [{ "User-Agent": "curl/8.5.0" }, "unknown", "unknown"],
    [{}, "unknown", "unknown"],
    [{ "User-Agent": "   " }, "unknown", "unknown"],
    [{ "User-Agent": LONG_TEXT }, "unknown", "unknown"],
    // Hints that hold only the brand that means nothing, or no brand at all, leave it to the User-Agent.
    [{ "Sec-CH-UA": '"Not)A;Brand";v="99"', "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0" }, "firefox", "desktop"],
    [{ "Sec-CH-UA": "<script>alert(1)</script>", "Sec-CH-UA-Mobile": "?1", "Sec-CH-UA-Platform": "Android" }, "unknown", "phone"],
    [{ "Sec-CH-UA-Mobile": "?0", "Sec-CH-UA-Platform": '"Haiku"', "User-Agent": "Mozilla/5.0 (Haiku; x86_64)" }, "other", "unknown"],
  ];
  for (const [headers, browser, device] of cases) assert.deepEqual(read(headers), { browser, device }, JSON.stringify(headers).slice(0, 160));
  // Any text: only the vocabulary's words, two of them, and nothing of the text. The pieces
  // are the tokens that the code looks for, in any order, with what browsers never send.
  const pieces = ["Mozilla/5.0", "(iPhone;", "iPad", "Android", "Mobile", "Tablet", "Windows NT 10.0", "Macintosh", "X11", "CrOS", "Linux", "Chrome/1", "CriOS/1",
    "HeadlessChrome/1", "Edg/1", "EdgA/1", "Firefox/1", "FxiOS/1", "Version/17", "Safari/6", "OPR/1", "SamsungBrowser/2", '"', "\\", ";", "é", "\u{1F600}", "x".repeat(300)];
  let seed = 299;
  const next = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  for (let round = 0; round < 2000; round++) {
    const text = Array.from({ length: 1 + next(12) }, () => pieces[next(pieces.length)]).join(next(2) ? " " : "");
    const hint = Array.from({ length: next(4) }, () => `"${["Chromium", "Google Chrome", "Microsoft Edge", "Opera", "Not_A Brand", "Brave", "", "Not A;Brand"][next(8)]}";v="${next(200)}"`).join(", ");
    const kind = read({ "User-Agent": text, ...(hint ? { "Sec-CH-UA": hint } : {}), "Sec-CH-UA-Mobile": ["?0", "?1", "?2", ""][next(4)], "Sec-CH-UA-Platform": ['"Android"', '"macOS"', "Windows", '"x"'][next(4)] });
    assert.deepEqual(Object.keys(kind), ["browser", "device"]);
    assert.ok(BROWSERS.includes(kind.browser) && DEVICES.includes(kind.device), JSON.stringify([text.slice(0, 100), kind]));
  }
  // The patterns take time in proportion to the text, however long: 100,000 characters of the
  // pieces that the patterns start on read in well under a second.
  const started = performance.now();
  read({ "User-Agent": "Mozilla/5.0 " + "Version/ Safari/ Edg/ Chrome/ (".repeat(3200), "Sec-CH-UA": '"a";v="'.repeat(140), "Sec-CH-UA-Platform": '"' + "a".repeat(5000) });
  assert.ok(performance.now() - started < 1000, "a long header reads in time");
});

test("TC-1442: a pass from Safari on a phone is recorded as Safari, phone, and that no software was reported to drive the browser", async () => {
  const { db, call } = inProcess();
  assert.equal((await call("POST", "/api/snapshots", { body: shop() })).status, 200);
  const passed = await pass(call, SAFARI_PHONE, { part: "sample", stage: "05-erd", commit: COMMIT, driven: false });
  assert.equal(passed.status, 201, passed.text);
  assert.deepEqual(kindOf(passed.data), ["safari", "phone", false]);
  const answers = await everyAnswer(call, passed.data.id);
  for (const [name, checkpoint] of Object.entries(answers)) assert.deepEqual(kindOf(checkpoint), ["safari", "phone", false], name);
  assert.deepEqual({ ...db.prepare("SELECT browser, device, driven FROM checkpoints").get() }, { browser: "safari", device: "phone", driven: 0 });
  assert.ok(!stored(db).includes("iPhone OS 17_5") && !stored(db).includes("AppleWebKit"), "none of the User-Agent's text is stored");
});

test("TC-1443: a pass from a browser under WebDriver is recorded as driven by software, and the pass is still taken", async () => {
  const { db, call } = inProcess();
  assert.equal((await call("POST", "/api/snapshots", { body: shop() })).status, 200);
  const passed = await pass(call, CHROME_DESKTOP, { part: "sample", stage: "05-erd", commit: COMMIT, words: "Under WebDriver", driven: true });
  assert.equal(passed.status, 201, passed.text);
  assert.deepEqual([passed.data.state, passed.data.words, ...kindOf(passed.data)], ["passed", "Under WebDriver", "chrome", "desktop", true]);
  for (const [name, checkpoint] of Object.entries(await everyAnswer(call, passed.data.id))) assert.deepEqual(kindOf(checkpoint), ["chrome", "desktop", true], name);
  // It waits for its record in the agent to-do like any other pass.
  assert.equal((await call("GET", "/api/spaces/acme/todo", { session: "s-1" })).data.checkpoints.total, 1);
  assert.equal(db.prepare("SELECT driven FROM checkpoints").get().driven, 1);
});

test("TC-1444: a pass whose User-Agent is 2,000 characters of text stores none of that text, and no address", async () => {
  const { db, call } = inProcess();
  assert.equal((await call("POST", "/api/snapshots", { body: shop() })).status, 200);
  assert.equal(LONG_TEXT.length, 2000);
  const passed = await pass(call, { "User-Agent": LONG_TEXT, ...ADDRESSED });
  assert.equal(passed.status, 201, passed.text);
  assert.deepEqual(kindOf(passed.data), ["unknown", "unknown", null]);
  const text = stored(db);
  for (let at = 0; at + 16 <= LONG_TEXT.length; at += 97) assert.ok(!text.includes(LONG_TEXT.slice(at, at + 16)), "nothing of the text at " + at);
  assert.ok(!text.includes("qa-pass-kind-mark") && !text.includes(ADDRESS), "neither the text nor the address is stored");
  assert.ok(!JSON.stringify(passed.data).includes("lorem"), "nor answered");
});

test("TC-1445, the server's half: the agent to-do names the kind with the checkpoint, so that the agent reads it, while the record that the agent writes takes none of it", async () => {
  const { call } = inProcess();
  assert.equal((await call("POST", "/api/snapshots", { body: shop() })).status, 200);
  const passed = await pass(call, SAFARI_PHONE, { part: "sample", stage: "05-erd", commit: COMMIT, driven: false });
  const listed = (await call("GET", "/api/spaces/acme/todo", { session: "s-1" })).data.checkpoints.entries[0];
  assert.deepEqual([listed.id, listed.why, ...kindOf(listed)], [passed.data.id, "not-recorded", "safari", "phone", false]);
  // A stage record pushed with the checkpoint's ID records it: the stored record is the hub's,
  // whose checkpoint holds what was approved, by whom, where and when (tests/test_nexus.py).
  const recorded = shop();
  recorded.stages["05-erd"].parts.sample.checkpoints = [{ approved: "The tables as drafted", by: "the maintainer", date: "2026-11-13", nexus: passed.data.id }];
  // A minute after the first push, which the server takes as newer and not as dated ahead.
  recorded.generated_at = new Date(Date.parse(recorded.generated_at) + 60000).toISOString();
  const pushed = await call("POST", "/api/snapshots", { body: recorded });
  assert.equal(pushed.status, 200, pushed.text);
  const after = (await call("GET", "/api/spaces/acme/checkpoints/" + passed.data.id)).data;
  assert.ok(after.recorded_commit, "the record names it");
  assert.deepEqual(kindOf(after), ["safari", "phone", false], "and the server keeps the kind beside it");
});

test("TC-1741, a recorded checkpoint: the stage's record keeps showing its kind under the record's entry, and its 50 keep those that wait first", async () => {
  const { db, call } = inProcess();
  assert.equal((await call("POST", "/api/snapshots", { body: shop() })).status, 200);
  const passed = await pass(call, SAFARI_PHONE, { part: "sample", stage: "05-erd", commit: COMMIT, driven: true });
  const recorded = shop();
  recorded.stages["05-erd"].parts.sample.checkpoints = [{ approved: "The tables as drafted", by: "the maintainer", date: "2026-11-13", nexus: passed.data.id }];
  recorded.generated_at = new Date(Date.parse(recorded.generated_at) + 60000).toISOString();
  assert.equal((await call("POST", "/api/snapshots", { body: recorded })).status, 200);
  // The to-do no longer lists it, while the stage's record and 0.2's overview still hold it, recorded,
  // with its kind, so that the record shows it beside the entry that names it.
  assert.equal((await call("GET", "/api/spaces/acme/todo", { session: "s-1" })).data.checkpoints.total, 0);
  const stage = (await call("GET", "/api/spaces/acme/stages/sample/05-erd")).data;
  const overview = (await call("GET", "/api/spaces/acme/overview/sample/05-erd")).data;
  for (const [name, list] of [["stage", stage.record.checkpoints], ["overview", overview.checkpoints]]) {
    const held = list.find((entry) => entry.id === passed.data.id);
    assert.ok(held?.recorded_commit, name + ": held, recorded");
    assert.deepEqual([held.state, ...kindOf(held)], ["passed", "safari", "phone", true], name);
  }
  for (const lang of ["en", "ko"]) {
    const words = labels("The kind of browser and device", lang), html = drawRecord(stage, lang);
    const list = html.slice(html.indexOf('<ul class="cps">'), html.indexOf("</ul>"));
    assert.ok(list.includes("The tables as drafted"), lang + ": the record's entry");
    const sep = '<span class="sep" aria-hidden="true">·</span>', seen = `<span class="cpc">${esc(label("The head", 2, lang, { commit: COMMIT.slice(0, 7) }))}</span>${sep}`;
    assert.ok(list.includes(`<p class="cpk">${seen}<span>${esc(words[1] + ", " + words[6])}</span>${sep}<span>${esc(words[10])}</span></p></li>`), lang + ": the commit that it passed, then its kind, under the entry's date");
    assert.ok(!html.includes(`data-nx-key="cp:${esc(passed.data.id)}"`), lang + ": no box that waits for its record, nor Withdraw");
    assert.ok(!html.includes(esc(codeMessage("Pass again", lang))), lang + ": and the pass is not a pass again");
  }
  // Sixty checkpoints that stored records name, all passed before the one that waits: the 50 hold
  // the one that waits first, then the recorded ones newest first.
  const insert = db.prepare(`INSERT INTO checkpoints (id, project, part, stage, commit_id, words, state, passed_at, recorded_commit, browser, device, driven)
    VALUES (?, 'acme', 'sample', '05-erd', ?, NULL, 'passed', ?, ?, 'chrome', 'desktop', 0)`);
  for (let i = 0; i < 60; i++) insert.run("nk_r0000000" + String(i).padStart(3, "0"), COMMIT, new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString(), COMMIT);
  const waiting = await pass(call, CHROME_DESKTOP, { part: "sample", stage: "05-erd", commit: COMMIT });
  assert.equal(waiting.status, 201, waiting.text);
  const held = (await call("GET", "/api/spaces/acme/stages/sample/05-erd")).data.record.checkpoints;
  assert.equal(held.length, 50);
  assert.deepEqual([held[0].id, held[0].recorded_commit], [waiting.data.id, null], "the one that waits first");
  const times = held.slice(1).map((entry) => entry.passed_at);
  assert.deepEqual(times, [...times].sort().reverse(), "then the recorded ones, newest first");
  assert.equal(held[1].id, passed.data.id, "the newest recorded one, passed after the sixty");
});

test("TC-1741: the kind of browser and device never refuses a pass, on the standalone server, and every answer that holds a checkpoint names the three", async (t) => {
  const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const jwk = { ...await crypto.subtle.exportKey("jwk", pair.publicKey), kid: "synthetic", alg: "RS256" };
  const env = { ACCESS_AUD: "synthetic-audience", ACCESS_TEAM_DOMAIN: "access.example.com", NEXUS_LANGUAGE: "en" };
  const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const sign = async (identity) => {
    const content = b64({ alg: "RS256", kid: jwk.kid }) + "." + b64({ iss: "https://access.example.com", aud: [env.ACCESS_AUD], exp: Math.floor(Date.now() / 1000) + 600, ...identity });
    return content + "." + Buffer.from(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(content))).toString("base64url");
  };
  const tokens = { user: await sign({ sub: "synthetic-person" }), agent: await sign({ sub: "", common_name: "synthetic-client" }) };
  const database = new SQLiteD1(":memory:");
  const verifier = new AccessVerifier({ requireContext: false, fetcher: async () => Response.json({ keys: [jwk] }) });
  const server = createNodeServer({ env: { ...env, DB: database }, origin: "https://nexus.example.com", template, verifier });
  await server.start();
  t.after(async () => { await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }); database.close(); });
  // Node's own HTTP client, which adds no User-Agent of its own, so that a pass can send none.
  let serial = 0;
  const call = (method, path, { body, kind = "agent", session = null, headers = {} } = {}) => new Promise((resolve, reject) => {
    const sent = { ...headers, "Cf-Access-Jwt-Assertion": tokens[kind], ...(session === null ? {} : { "Nexus-Session": session }) };
    if (method === "POST") sent["Idempotency-Key"] = '"nw_' + (++serial).toString().padStart(12, "0") + '"';
    const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
    if (data) Object.assign(sent, { "Content-Type": "application/json", "Content-Length": String(data.length) });
    const outgoing = httpRequest({ host: "127.0.0.1", port: server.address().port, method, path, headers: sent }, (incoming) => {
      const chunks = [];
      incoming.on("data", (chunk) => chunks.push(chunk));
      incoming.on("end", () => { const text = Buffer.concat(chunks).toString("utf8"); resolve({ status: incoming.statusCode, text, data: text ? JSON.parse(text) : null }); });
    });
    outgoing.on("error", reject);
    outgoing.end(data);
  });
  assert.equal((await call("POST", "/api/snapshots", { body: shop() })).status, 200);
  // A checkpoint passed before the revision, as the server stored it then: none of the three.
  database.connection.prepare(`INSERT INTO checkpoints (id, project, part, stage, commit_id, words, state, passed_at)
    VALUES ('nk_000000000001', 'acme', 'sample', '04-functional-spec', ?, 'Before the revision', 'passed', '2026-11-01T00:00:00.000Z')`).run(COMMIT);

  const senders = [["Safari on a phone", SAFARI_PHONE, ["safari", "phone"]], ["Chrome on a desktop, with its client hints", CHROME_DESKTOP, ["chrome", "desktop"]],
    ["2,000 characters that name no browser", { "User-Agent": LONG_TEXT }, ["unknown", "unknown"]], ["no User-Agent", {}, ["unknown", "unknown"]]];
  const passes = [];
  for (const [name, headers, kind] of senders) {
    for (const driven of [true, false, undefined]) {
      const body = { part: "sample", stage: "05-erd", commit: COMMIT, ...(driven === undefined ? {} : { driven }) };
      const passed = await call("POST", "/api/spaces/acme/checkpoints", { kind: "user", body, headers: { ...headers, ...ADDRESSED } });
      assert.equal(passed.status, 201, `${name}, driven ${driven}: ${passed.text}`);
      assert.deepEqual(kindOf(passed.data), [...kind, driven ?? null], `${name}, driven ${driven}`);
      passes.push([passed.data.id, [...kind, driven ?? null]]);
    }
  }
  // Since TASK-302 the press as recommended passes no checkpoint (D17): the request that the
  // agent asked for is passed with its comment and last entry, with the kind and driven as sent.
  const asked = await call("POST", "/api/spaces/acme/comments", { body: REQUEST, session: "s-1" });
  assert.equal(asked.status, 201, asked.text);
  const taken = await call("POST", `/api/spaces/acme/comments/${asked.data.id}/recommended`, { kind: "user", headers: SAFARI_PHONE });
  assert.deepEqual([taken.status, taken.data.code], [409, "not_recommended"]);
  const answered = await call("POST", "/api/spaces/acme/checkpoints", { kind: "user", headers: SAFARI_PHONE,
    body: { part: "sample", stage: "04-functional-spec", commit: COMMIT, comment: asked.data.id, entry: 0, driven: false } });
  assert.equal(answered.status, 201, answered.text);
  assert.deepEqual(kindOf(answered.data), ["safari", "phone", false]);
  passes.push([answered.data.id, ["safari", "phone", false]]);

  // Every answer that holds a checkpoint names the three, and the one passed before the
  // revision holds them null, not unknown.
  const expected = new Map([...passes, ["nk_000000000001", [null, null, null]]]);
  const todo = await call("GET", "/api/spaces/acme/todo", { session: "s-1" });
  assert.equal(todo.data.checkpoints.total, expected.size);
  for (const entry of todo.data.checkpoints.entries) assert.deepEqual(kindOf(entry), expected.get(entry.id), "to-do " + entry.id);
  for (const stage of ["05-erd", "04-functional-spec"]) {
    const record = (await call("GET", `/api/spaces/acme/stages/sample/${stage}`)).data.record.checkpoints;
    const overview = (await call("GET", `/api/spaces/acme/overview/sample/${stage}`)).data.checkpoints;
    assert.ok(record.length && record.length === overview.length, stage);
    for (const entry of [...record, ...overview]) assert.deepEqual(kindOf(entry), expected.get(entry.id), stage + " " + entry.id);
  }
  for (const [id, kind] of expected) assert.deepEqual(kindOf((await call("GET", "/api/spaces/acme/checkpoints/" + id)).data), kind, "checkpoint " + id);
  const old = (await call("GET", "/api/spaces/acme/checkpoints/nk_000000000001")).data;
  assert.ok(["browser", "device", "driven"].every((name) => Object.hasOwn(old, name) && old[name] === null), "null, not unknown or left out");
  // The agent reports the record's pull request, and the user withdraws: both answers name them.
  const [first] = passes[0];
  const reported = await call("POST", `/api/spaces/acme/checkpoints/${first}/report`, { body: { event: "opened", pull_request: "https://github.com/example/acme/pull/1" }, session: "s-1" });
  assert.equal(reported.status, 200, reported.text);
  assert.deepEqual(kindOf(reported.data.checkpoint), expected.get(first));
  const [second] = passes[1];
  const withdrawn = await call("POST", `/api/spaces/acme/checkpoints/${second}/withdraw`, { kind: "user", body: {} });
  assert.equal(withdrawn.status, 200, withdrawn.text);
  assert.deepEqual([withdrawn.data.checkpoint.state, ...kindOf(withdrawn.data.checkpoint)], ["withdrawn", ...expected.get(second)]);
  const oldWithdrawn = await call("POST", "/api/spaces/acme/checkpoints/nk_000000000001/withdraw", { kind: "user", body: {} });
  assert.deepEqual(kindOf(oldWithdrawn.data.checkpoint), [null, null, null]);
  // The database holds nothing of the headers' text and no address.
  const text = JSON.stringify(database.connection.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()
    .map(({ name }) => database.connection.prepare(`SELECT * FROM "${name}"`).all()));
  for (const fragment of ["iPhone OS 17_5", "AppleWebKit", "Win64", "Google Chrome", "Not_A Brand", "qa-pass-kind-mark", "lorem ipsum", ADDRESS])
    assert.ok(!text.includes(fragment), "not stored: " + fragment);
});

test("TC-1741, the record: the stage's record shows the kind under a checkpoint's date, never as a check, and nothing for one passed before the revision", () => {
  const PASSED = "2026-11-13T05:00:00.000Z";
  const checkpoint = (id, kind) => ({ id, part: "sample", stage: "05-erd", commit: COMMIT, words: null, state: "passed", passed_at: PASSED, withdrawn_at: null,
    pull_request: null, pr_state: null, recorded_commit: null, ...kind });
  const checkpoints = [checkpoint("nk_000000000001", { browser: "safari", device: "phone", driven: false }),
    checkpoint("nk_000000000002", { browser: "chrome", device: "desktop", driven: true }),
    checkpoint("nk_000000000003", { browser: "unknown", device: "unknown", driven: null }),
    checkpoint("nk_000000000004", { browser: "other", device: "tablet", driven: null }),
    checkpoint("nk_000000000005", { browser: null, device: null, driven: null }),
    { ...checkpoint("nk_000000000006", { browser: "firefox", device: "desktop", driven: false }), state: "withdrawn", withdrawn_at: PASSED }];
  const data = { project: { name: "acme" }, part: "sample", stage: "05-erd", head: { key: "05-erd", state: "in_progress" },
    record: { project: "acme", part: "sample", stage: "05-erd", record: { state: "in_progress", checkpoints: [], next: null, from: "snapshot" }, checks: [], warnings: [], checkpoints } };
  for (const lang of ["en", "ko"]) {
    const words = labels("The kind of browser and device", lang), html = drawRecord(data, lang);
    const box = (id) => { const at = html.indexOf(`data-nx-key="cp:${esc(id)}"`); assert.ok(at > 0, id); return html.slice(at, html.indexOf("</div>", at)); };
    const kind = (id) => [...box(id).matchAll(/<p class="cpk">(.*?)<\/p>/g)].map((match) => match[1]);
    // Each line follows "Commit {commit}", the commit that the pass named (TASK-301).
    const sep = '<span class="sep" aria-hidden="true">·</span>', seen = `<span class="cpc">${esc(label("The head", 2, lang, { commit: COMMIT.slice(0, 7) }))}</span>${sep}`;
    assert.deepEqual(kind("nk_000000000001"), [`${seen}<span>${esc(words[1] + ", " + words[6])}</span>`], lang + ": Safari, phone, with no word of software");
    assert.deepEqual(kind("nk_000000000002"), [`${seen}<span>${esc(words[0] + ", " + words[8])}</span>${sep}<span>${esc(words[10])}</span>`], lang + ": and that software drove it");
    assert.deepEqual(kind("nk_000000000003"), [`${seen}<span>${esc(words[5] + ", " + words[9])}</span>`], lang + ": unknown, as recorded");
    assert.deepEqual(kind("nk_000000000004"), [`${seen}<span>${esc(words[4] + ", " + words[7])}</span>`], lang);
    assert.deepEqual(kind("nk_000000000005"), [], lang + ": nothing for a checkpoint passed before the revision");
    assert.deepEqual(kind("nk_000000000006"), [`${seen}<span>${esc(words[2] + ", " + words[8])}</span>`], lang + ": a withdrawn one keeps its record");
    // The kind follows the date, as a record: no Withdraw or other control depends on it.
    assert.ok(box("nk_000000000001").indexOf('<p class="cpk">') > box("nk_000000000001").indexOf("</b>"), lang + ": under the date");
    assert.equal((html.match(/data-nx-act="withdraw"/g) || []).length, 5, lang + ": Withdraw on each that waits, whatever its kind");
  }
  assert.deepEqual(labels("The kind of browser and device", "en").slice(0, 6), ["Chrome", "Safari", "Firefox", "Edge", "another browser", "unknown browser"]);
  assert.equal(labels("The kind of browser and device", "ko")[10], "소프트웨어가 브라우저를 조작함");
});
