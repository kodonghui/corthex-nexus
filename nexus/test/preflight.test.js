import assert from "node:assert/strict";
import { test } from "node:test";
import { ROUTES, pathRoute, requestHeaders } from "../src/preflight.js";

const request = (method, path, headers) => new Request("https://nexus.example.com" + path, { method, headers });
const ID = "0123456789ab";
const values = { project: "acme-shop", part: "_", stage: "02-prd", pictureStage: "05-erd", file: "view.01234567.js", comment: "nc_" + ID, proposal: "np_" + ID, edit: "ne_" + ID, checkpoint: "nk_" + ID, entry: "nd_" + ID };
const path = (route) => route.path.replace(/\{(\w+)\}/g, (_, name) => values[name]);
const code = (value) => (error) => error.code === value;
const headers = { "Idempotency-Key": '"nw_' + ID + '"', "Nexus-Session": "agent-one" };

test("all 34 contracted operations dispatch, and every GET also takes HEAD", () => {
  assert.equal(ROUTES.length, 34);
  assert.equal(new Set(ROUTES.map((route) => route.operation)).size, 34);
  for (const route of ROUTES) {
    assert.equal(pathRoute(request(route.method, path(route))).operation, route.operation);
    if (route.method === "GET") assert.equal(pathRoute(request("HEAD", path(route))).operation, route.operation);
  }
});

test("invalid path values get resource-specific 404s and never reach a handler", () => {
  for (const [path, error] of [
    ["/api/snapshots/Bad", "project_not_found"], ["/api/spaces/acme/pictures/Bad/05-erd", "part_not_found"],
    ["/api/spaces/acme/pictures/_/02-prd", "not_found"], ["/api/spaces/acme/overview/_/other", "not_found"],
    ["/api/spaces/acme/comments/nc_iiiiiiiiiiii", "comment_not_found"], ["/api/spaces/acme/proposals/nc_" + ID, "proposal_not_found"],
    ["/api/spaces/acme/edits/wrong", "edit_not_found"], ["/api/spaces/acme/checkpoints/wrong", "checkpoint_not_found"],
    ["/api/spaces/acme/claims/np_" + ID, "entry_not_found"], ["/api/snapshots/a%2fb", "project_not_found"],
    ["/code/private.js", "not_found"], ["/api/snapshots/%ZZ", "not_found"], ["/nothing", "not_found"],
  ]) assert.throws(() => pathRoute(request("GET", path)), code(error), path);
});

test("known paths reject methods with all supported methods in Allow", () => {
  assert.throws(() => pathRoute(request("PATCH", "/api/snapshots")), (error) => error.code === "method_not_allowed" && error.headers.Allow === "GET, HEAD, POST");
  assert.throws(() => pathRoute(request("OPTIONS", "/api/snapshots/acme")), (error) => error.code === "method_not_allowed" && error.headers.Allow === "GET, HEAD, DELETE");
});

test("cross-site refusal precedes kind, then write ID precedes the agent session", () => {
  const route = pathRoute(request("POST", "/api/spaces/acme/proposals"));
  assert.throws(() => requestHeaders(request("POST", "/api/spaces/acme/proposals", { "Sec-Fetch-Site": "same-site" }), route, "user"), code("cross_site"));
  assert.throws(() => requestHeaders(request("POST", "/api/spaces/acme/proposals"), route, "user"), code("agent_only"));
  assert.throws(() => requestHeaders(request("POST", "/api/spaces/acme/proposals"), route, null), code("no_kind"));
  assert.throws(() => requestHeaders(request("POST", "/api/spaces/acme/proposals"), route, "agent"), (error) => error.fields.field === "Idempotency-Key");
  assert.throws(() => requestHeaders(request("POST", "/api/spaces/acme/proposals", { "Idempotency-Key": headers["Idempotency-Key"] }), route, "agent"), (error) => error.fields.field === "Nexus-Session");
});

test("every write role and header policy agrees with the request-name table", () => {
  for (const route of ROUTES.filter((route) => route.role)) {
    const kind = route.role === "either" ? "agent" : route.role;
    const result = requestHeaders(request(route.method, path(route), headers), route, kind);
    assert.equal(result.write, route.writeName ? "nw_" + ID : null);
    assert.equal(result.session, kind === "agent" ? "agent-one" : null);
    assert.throws(() => requestHeaders(request(route.method, path(route), headers), route, null), code("no_kind"));
    if (route.role !== "either") assert.throws(() => requestHeaders(request(route.method, path(route), headers), route, kind === "user" ? "agent" : "user"), code(kind === "user" ? "user_only" : "agent_only"));
  }
});

test("reads, pushes and removals accept a checked identity with neither kind", () => {
  for (const route of ROUTES.filter((route) => !route.role)) assert.doesNotThrow(() => requestHeaders(request(route.method, path(route)), route, null));
});

test("session labels are required only where specified and user's session header is ignored", () => {
  const comment = pathRoute(request("POST", "/api/spaces/acme/comments"));
  assert.equal(requestHeaders(request("POST", "/api/spaces/acme/comments", { ...headers, "Nexus-Session": "bad session" }), comment, "user").session, null);
  for (const key of ["nw_" + ID, '"nw_iiiiiiiiiiii"', '"nw_' + ID + '" extra']) assert.throws(() => requestHeaders(request("POST", "/api/spaces/acme/comments", { ...headers, "Idempotency-Key": key }), comment, "agent"), (error) => error.fields.field === "Idempotency-Key");
  const todo = pathRoute(request("GET", "/api/spaces/acme/todo"));
  assert.equal(requestHeaders(request("GET", "/api/spaces/acme/todo"), todo, "user").session, null);
  assert.throws(() => requestHeaders(request("GET", "/api/spaces/acme/todo", { "Nexus-Session": "bad session" }), todo, "user"), (error) => error.fields.field === "Nexus-Session");
});

test("a stage read takes its query values with their defaults and refuses one in another form by its field", () => {
  const stage = (query = "") => request("GET", "/api/spaces/acme/stages/_/02-prd" + query);
  const route = pathRoute(stage());
  assert.equal(route.operation, "getStage");
  assert.deepEqual(requestHeaders(stage(), route, null).query, { after: 0, filter: "all", q: null, group: "context" });
  assert.deepEqual(requestHeaders(stage("?after=100000&filter=left&q=" + encodeURIComponent("구매 push") + "&group=source&other=1"), route, null).query,
    { after: 100000, filter: "left", q: "구매 push", group: "source" });
  assert.equal(requestHeaders(stage("?q=" + "가".repeat(200)), route, null).query.q.length, 200);
  for (const [query, field] of [["?after=100001", "after"], ["?after=-1", "after"], ["?after=1.5", "after"], ["?after=", "after"], ["?after=0&after=0", "after"],
    ["?filter=All", "filter"], ["?filter=", "filter"], ["?group=kind", "group"], ["?q=" + "가".repeat(201), "q"], ["?q=a&q=b", "q"]]) {
    assert.throws(() => requestHeaders(stage(query), route, null), (error) => error.code === "invalid_request" && error.fields.field === field, query);
  }
  // Only the stage and talk reads take query values; the others ignore what is sent.
  const todo = pathRoute(request("GET", "/api/spaces/acme/todo?after=x"));
  assert.deepEqual(requestHeaders(request("GET", "/api/spaces/acme/todo?after=x"), todo, null).query, {});
});

test("a talk read takes its item, closed and after with their defaults and refuses one in another form by its field", () => {
  const talk = (query = "") => request("GET", "/api/spaces/acme/talk/_/05-erd" + query);
  const route = pathRoute(talk());
  assert.equal(route.operation, "getStageTalk");
  assert.deepEqual(requestHeaders(talk(), route, null).query, { item: null, closed: 0, after: 0 });
  assert.deepEqual(requestHeaders(talk("?item=TBL-111&closed=1&after=50&filter=x"), route, null).query, { item: "TBL-111", closed: 1, after: 50 });
  assert.equal(requestHeaders(talk("?item=A" + "B".repeat(22) + "-123456"), route, null).query.item.length, 30);
  for (const [query, field] of [["?item=tbl-111", "item"], ["?item=TBL-111x", "item"], ["?item=TBL-1234567", "item"], ["?item=A" + "B".repeat(23) + "-123456", "item"],
    ["?item=", "item"], ["?item=TBL-1&item=TBL-2", "item"], ["?closed=2", "closed"], ["?closed=true", "closed"], ["?closed=", "closed"], ["?closed=1&closed=1", "closed"],
    ["?after=100001", "after"], ["?after=-1", "after"], ["?item=TBL-111&closed=2&after=x", "closed"]]) {
    assert.throws(() => requestHeaders(talk(query), route, null), (error) => error.code === "invalid_request" && error.fields.field === field, query);
  }
});
