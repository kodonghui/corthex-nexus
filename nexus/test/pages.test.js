// The redesign's pages and the hub page's move (TASK-271): API-155 at /, API-101
// at /hub, API-153's 302 to a project's current stage and API-154's stage page,
// which holds the answers of API-158, API-152 and API-111, against synthetic
// snapshots in an in-memory SQLite database.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { VIEW_POLICY, handle, renderView } from "../src/app.js";
import { createViews } from "../src/views.js";
import { words } from "../ui/messages.js";
import { fakeD1 } from "./fake-d1.js";
import { testAccess } from "./access-fixture.js";
import { viewSnapshot } from "./view-fixtures.js";

const template = readFileSync(new URL("../src/hub.html", import.meta.url), "utf8");
// One set of synthetic Access keys for the file: the verifier keeps the keys it read.
const access = await testAccess();
const folder = new URL("../src/view-code/", import.meta.url);
const metadata = JSON.parse(readFileSync(new URL("sizes.json", folder), "utf8"));
const views = createViews(Object.fromEntries(metadata.files.map((file) => [file.name, { type: file.type, body: readFileSync(new URL(file.path, folder)) }])), metadata.entries);
// The pattern of API-153's Location in the contract.
const LOCATION = /^\/p\/[a-z0-9]+(?:-[a-z0-9]+)*\/(?:_|[a-z0-9]+(?:-[a-z0-9]+)*)\/(?:01-domain|02-prd|03-user-flow|04-functional-spec|05-erd|06-api|07-sitemap|08-screen-states|09-mockup|10-wbs|11-development|12-qa|13-presentation)$/;
const escape = (value) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TITLE = 'Shop </script><script>alert(1)</script> & "__CORTHEX_VIEW_DATA__"';

async function server(snapshots, { lang = "en", withViews = true } = {}) {
  const db = new DatabaseSync(":memory:");
  const env = { ...access.env, DB: fakeD1(db), NEXUS_LANGUAGE: lang };
  let serial = 0;
  async function call(method, path, { body, kind = "agent", accept } = {}) {
    const headers = { ...access.headers(kind), "Nexus-Session": "pages-test", ...(accept ? { Accept: accept } : {}) };
    if (method === "POST") headers["Idempotency-Key"] = '"nw_' + (++serial).toString().padStart(12, "0") + '"';
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const request = new Request("https://nexus.example.com" + path, { method, headers, redirect: "manual", ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const response = await handle(request, env, access.ctx, template, withViews ? views : {});
    const text = await response.text();
    return { status: response.status, headers: response.headers, text, data: /json/.test(response.headers.get("Content-Type") || "") && text ? JSON.parse(text) : null };
  }
  for (const snapshot of snapshots) {
    const pushed = await call("POST", "/api/snapshots", { body: snapshot });
    assert.equal(pushed.status, 200, pushed.text);
  }
  return { db, call };
}

// The page's data, which the page holds once.
function viewData(html) {
  const open = '<script id="view-data" type="application/json">';
  assert.equal(html.split(open).length, 2);
  const start = html.indexOf(open) + open.length;
  return JSON.parse(html.slice(start, html.indexOf("</script>", start)));
}

// A 0.2 snapshot whose first part, in the settings' order, records the states
// given, each stage of the 13 that it names; the others are not recorded.
function recorded(name, parts, states) {
  const data = viewSnapshot(name), time = new Date().toISOString();
  data.project.parts = parts;
  data.stages = {};
  for (const [part, list] of Object.entries(states)) for (const [stage, state] of Object.entries(list)) {
    data.stages[stage] ??= { name: stage, human: "notion", truth: "source", source: "docs/qa/", source_state: "found", read: true, files: 1, items: 1, parts: {} };
    data.stages[stage].parts[part] = { state, next: "Synthetic next action", updated: time,
      checkpoints: state === "done" ? [{ date: "2026-11-08", by: "Synthetic reviewer", approved: "Synthetic checkpoint" }] : [] };
  }
  data.pictures = data.pictures.filter((picture) => parts.includes(picture.part));
  return data;
}

// A project that only a hub of 0.1 pushed: no space, no parts, and its stage
// records in the stages themselves.
const legacy = { schema: "corthex-hub/0.1", generated_at: "2026-01-12T10:00:00+09:00", project: { name: "acme-shop", title: "Acme Shop" },
  stages: { "02-prd": { source_state: "found", read: true, state: "in_progress", next: "Write the PRD" } }, summary: { items: 1 },
  items: [{ id: "REQ-001", kind: "requirement", stage: "02-prd", title: "Send an order confirmation", priority: "Must" }], checks: [] };

const HEADERS = ["Content-Type", "Cache-Control", "Content-Security-Policy", "Cross-Origin-Opener-Policy", "X-Frame-Options", "Referrer-Policy"];
const PAGE_HEADERS = ["text/html; charset=utf-8", "no-store", VIEW_POLICY, "same-origin", "DENY", "no-referrer"];

test("API-155 serves the first page at / with the answer of API-151, drawn by the views, and HEAD alike", async () => {
  const shop = viewSnapshot("qa-shop");
  shop.project.title = TITLE;
  const { call } = await server([shop, legacy]);
  assert.equal((await call("POST", "/api/spaces/qa-shop/comments", { body: { part: "sample", stage: "05-erd", item: "TBL-001", text: "Which currency?", asks: "answer" } })).status, 201);
  const page = await call("GET", "/");
  assert.equal(page.status, 200);
  assert.deepEqual(HEADERS.map((name) => page.headers.get(name)), PAGE_HEADERS);
  const held = viewData(page.text), home = (await call("GET", "/api/home")).data;
  assert.deepEqual(Object.keys(held), ["schema", "generated_at", "lang", "data"]);
  assert.deepEqual([held.schema, held.lang], ["corthex-home-page/0.3", "en"]);
  assert.match(held.generated_at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  // The page reads API-151 when it is served; only the time of the read differs.
  assert.deepEqual({ ...held.data, generated_at: null }, { ...home, generated_at: null });
  assert.deepEqual([held.data.my_turn.total, held.data.projects.map((card) => card.name)], [1, ["acme-shop", "qa-shop"]]);
  assert.equal(held.data.projects[1].title, TITLE);
  // The server draws the page from the data that it holds, as the view's code does.
  assert.equal(page.text, renderView(views.page(held), held));
  assert.match(page.text, /^<!doctype html><html lang="en"><head>/);
  assert.match(page.text, /<body class="nx" data-nx-page="home">/);
  assert.match(page.text, /<script type="module" src="\/code\/page\.[0-9a-f]{8}\.js"><\/script><\/body><\/html>$/);
  assert.doesNotMatch(page.text, /<script>alert/);
  const head = await call("HEAD", "/");
  assert.deepEqual([head.status, head.text, ...HEADERS.map((name) => head.headers.get(name))], [200, "", ...PAGE_HEADERS]);
  const korean = await (await server([], { lang: "ko" })).call("GET", "/");
  assert.match(korean.text, /^<!doctype html><html lang="ko">/);
  assert.deepEqual([viewData(korean.text).lang, viewData(korean.text).data.projects], ["ko", []]);
});

test("API-101 serves the hub page unchanged at /hub, and neither address answers a write", async () => {
  const { call } = await server([viewSnapshot("qa-shop")]);
  const hub = await call("GET", "/hub");
  assert.equal(hub.status, 200);
  assert.ok(hub.text.includes('<script id="hub-data" type="application/json">'));
  assert.doesNotMatch(hub.text, /id="view-data"/);
  assert.match(hub.headers.get("Content-Security-Policy"), /^default-src 'none'; script-src 'sha256-/);
  assert.equal((await call("HEAD", "/hub")).text, "");
  for (const path of ["/", "/hub", "/p/qa-shop", "/p/qa-shop/sample/05-erd"]) {
    const refused = await call("POST", path, { body: {} });
    assert.deepEqual([refused.status, refused.data.code, refused.headers.get("Allow")], [405, "method_not_allowed", "GET, HEAD"], path);
  }
});

test("API-153 leads a project to its first part's current stage with a 302, which the page then answers", async () => {
  const progress = recorded("in-progress", ["sample"], { sample: { "01-domain": "done", "04-functional-spec": "in_progress", "05-erd": "not_started", "07-sitemap": "skipped" } });
  const waiting = recorded("not-started", ["sample"], { sample: { "01-domain": "done", "04-functional-spec": "done", "05-erd": "skipped", "07-sitemap": "not_started", "12-qa": "not_started" } });
  const finished = recorded("all-done", ["sample"], { sample: { "01-domain": "done", "05-erd": "done", "07-sitemap": "skipped" } });
  const silent = recorded("no-records", ["sample"], {});
  // The settings name second first: the first part is theirs, not the first by name.
  const order = recorded("settings-order", ["second", "sample"], { second: { "05-erd": "in_progress" }, sample: { "01-domain": "in_progress" } });
  const { call } = await server([progress, waiting, finished, silent, order, legacy]);
  for (const [project, location] of [["in-progress", "/p/in-progress/sample/04-functional-spec"], ["not-started", "/p/not-started/sample/07-sitemap"],
    ["all-done", "/p/all-done/sample/01-domain"], ["no-records", "/p/no-records/sample/01-domain"], ["settings-order", "/p/settings-order/second/05-erd"],
    ["acme-shop", "/p/acme-shop/_/02-prd"]]) {
    for (const method of ["GET", "HEAD"]) {
      const reply = await call(method, "/p/" + project);
      assert.equal(reply.status, 302, project);
      assert.equal(reply.headers.get("Location"), location, project);
      assert.match(location, LOCATION);
      assert.deepEqual([reply.text, reply.headers.get("Cache-Control"), reply.headers.get("Content-Security-Policy"), reply.headers.get("Content-Type")],
        ["", "no-store", "default-src 'none'; frame-ancestors 'none'", null]);
    }
    const page = await call("GET", location);
    assert.equal(page.status, 200, location);
    const [, , part, stage] = location.split("/").slice(1);
    assert.deepEqual([viewData(page.text).data.part, viewData(page.text).data.stage], [part === "_" ? "" : part, stage]);
  }
  const unknown = await call("GET", "/p/no-such-project");
  assert.deepEqual([unknown.status, unknown.data.code], [404, "project_not_found"]);
});

test("API-154 holds the answers of API-158, API-152 and, on a pictured stage, API-111, and draws the page from them", async () => {
  const shop = viewSnapshot("qa-shop");
  shop.project.parts = ["sample", "second"];
  const { call } = await server([shop]);
  const comment = (stage, item, text) => call("POST", "/api/spaces/qa-shop/comments", { body: { part: "sample", stage, item, text, asks: "answer" } });
  assert.equal((await comment("05-erd", "TBL-001", "Which currency?")).status, 201);
  assert.equal((await comment("04-functional-spec", "", "Is the stage as a whole right?")).status, 201);
  const original = console.error, logs = [];
  console.error = (...args) => logs.push(args);
  try {
    for (const [part, stage, pictured] of [["sample", "05-erd", true], ["sample", "04-functional-spec", false], ["sample", "02-prd", false], ["_", "01-domain", false], ["second", "07-sitemap", false]]) {
      logs.splice(0);
      const at = `/${part}/${stage}`, page = await call("GET", "/p/qa-shop" + at), logged = logs.splice(0);
      assert.equal(page.status, 200, at);
      // The page logs what it lacks, as a refusal is logged: its code and trace ID.
      assert.deepEqual(logged.map(([label, value]) => [label, value.kind, value.traceId]),
        page.text.includes('"problem":null') ? [] : [["nexus", viewData(page.text).problem.code, viewData(page.text).problem.traceId]], at);
      assert.deepEqual(HEADERS.map((name) => page.headers.get(name)), PAGE_HEADERS);
      const held = viewData(page.text);
      assert.deepEqual(Object.keys(held), ["schema", "generated_at", "lang", "data", "talk", "picture", "problem"]);
      assert.deepEqual([held.schema, held.lang], ["corthex-stage-page/0.3", "en"]);
      assert.deepEqual(held.data, (await call("GET", "/api/spaces/qa-shop/stages" + at)).data, at);
      assert.deepEqual(held.talk, (await call("GET", "/api/spaces/qa-shop/talk" + at)).data, at);
      const picture = await call("GET", "/api/spaces/qa-shop/pictures" + at);
      if (pictured) assert.deepEqual([held.picture, held.problem], [picture.data, null], at);
      else if (["01-domain", "05-erd", "07-sitemap"].includes(stage)) {
        // A pictured stage whose picture the space does not hold says why, as API-111 does.
        assert.equal(held.picture, null);
        assert.deepEqual({ ...held.problem, traceId: null }, { ...picture.data, traceId: null }, at);
        assert.deepEqual([held.problem.code, held.problem.why], ["picture_not_found", "not-drawn"]);
      } else assert.deepEqual([held.picture, held.problem], [null, null], at);
      assert.equal(page.text, renderView(views.page(held), held));
      assert.match(page.text, /<body class="nx" data-nx-page="stage">/);
    }
  } finally { console.error = original; }
  const talk = viewData((await call("GET", "/p/qa-shop/sample/04-functional-spec")).text).talk;
  assert.deepEqual([talk.mine.total, talk.mine.entries[0].kind, talk.mine.entries[0].comment.item], [1, "comment", ""]);
  const korean = await (await server([viewSnapshot("qa-shop")], { lang: "ko" })).call("GET", "/p/qa-shop/sample/05-erd");
  assert.match(korean.text, /^<!doctype html><html lang="ko">/);
  assert.equal(viewData(korean.text).lang, "ko");
});

test("a project without a space holds its stage with neither talk nor picture, and the page says why", async () => {
  const { call } = await server([legacy]);
  const original = console.error, logs = [];
  console.error = (...args) => logs.push(args);
  try {
    for (const stage of ["02-prd", "05-erd"]) {
      const page = await call("GET", "/p/acme-shop/_/" + stage);
      assert.equal(page.status, 200);
      const held = viewData(page.text);
      assert.deepEqual(logs.splice(0).map(([, value]) => [value.kind, value.traceId]), [["space_not_found", held.problem.traceId]]);
      assert.deepEqual(held.data, (await call("GET", "/api/spaces/acme-shop/stages/_/" + stage)).data);
      assert.deepEqual([held.talk, held.picture, held.problem.code, held.problem.status], [null, null, "space_not_found", 404]);
      assert.equal((await call("GET", "/api/spaces/acme-shop/talk/_/" + stage)).data.code, "space_not_found");
      logs.splice(0);
    }
  } finally { console.error = original; }
});

test("a page address that names no project, part or stage is the message page with a way to all projects", async () => {
  const shop = viewSnapshot("qa-shop");
  const original = console.error;
  console.error = () => {};
  try {
    for (const lang of ["en", "ko"]) {
      const { call } = await server([shop], { lang });
      for (const [path, code] of [["/p/nobody", "project_not_found"], ["/p/nobody/_/02-prd", "project_not_found"], ["/p/qa-shop/gone/02-prd", "part_not_found"],
        ["/p/qa-shop/Sample/02-prd", "part_not_found"], ["/p/qa-shop/sample/14-other", "not_found"], ["/p/qa-shop/sample", "not_found"]]) {
        const message = await call("GET", path, { accept: "text/html,application/xhtml+xml" });
        assert.deepEqual([message.status, message.headers.get("Content-Type"), message.headers.get("Cache-Control")], [404, "text/html; charset=utf-8", "no-store"], path);
        assert.ok(message.text.includes(`<html lang="${lang}">`));
        assert.ok(message.text.includes("<h1>" + escape(words(code, lang)) + "</h1>"), path);
        assert.ok(message.text.includes(`<a class="control" href="/">${escape(words("All projects", lang))}</a>`), path);
        assert.doesNotMatch(message.text, /<script|<link/);
        const problem = await call("GET", path);
        assert.deepEqual([problem.status, problem.headers.get("Content-Type"), problem.data.code], [404, "application/problem+json", code], path);
        assert.equal((await call("HEAD", path, { accept: "text/html" })).text, "");
      }
    }
  } finally { console.error = original; }
});

// SPEC-154's redirects of these two addresses come with TASK-278, once the stage's
// page draws the picture and the list (TASK-274, TASK-275); until then they keep
// their pages, whose way back leads to the hub page at its new address.
test("0.2's picture view and stage overview keep their pages, whose top bar leads to the hub page at /hub", async () => {
  const { call } = await server([viewSnapshot("qa-shop")]);
  for (const lang of ["en", "ko"]) {
    const { call: local } = lang === "en" ? { call } : await server([viewSnapshot("qa-shop")], { lang });
    for (const view of ["picture", "overview"]) {
      const path = `/${view === "picture" ? "pictures" : "overview"}/qa-shop/sample/05-erd`, page = await local("GET", path);
      assert.deepEqual([page.status, page.headers.get("Location"), page.headers.get("Content-Security-Policy")], [200, null, VIEW_POLICY], path);
      const held = viewData(page.text);
      assert.deepEqual([held.schema, held.view, held.lang], ["corthex-view-page/0.2", view, lang], path);
      // The picture view's first drawing, before its code, has the top bar too.
      if (view === "picture") assert.ok(page.text.includes(`<header class="topbar"><a class="control" href="/hub">${lang === "ko" ? "허브 페이지" : "Hub page"}</a>`), path);
      assert.doesNotMatch(page.text, /href="\/"/, path);
    }
  }
});

test("without the view's build, each page holds its data alone", async () => {
  const { call } = await server([viewSnapshot("qa-shop")], { withViews: false });
  for (const [path, schema] of [["/", "corthex-home-page/0.3"], ["/p/qa-shop/sample/05-erd", "corthex-stage-page/0.3"]]) {
    const page = await call("GET", path);
    assert.deepEqual([page.status, page.headers.get("Content-Security-Policy"), viewData(page.text).schema], [200, VIEW_POLICY, schema]);
    assert.doesNotMatch(page.text, /<script type="module"/);
  }
});
