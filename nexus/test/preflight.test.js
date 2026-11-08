import assert from "node:assert/strict";
import { test } from "node:test";
import { ROUTES, pathRoute, requestHeaders } from "../src/preflight.js";

const request = (method, path, headers) => new Request("https://nexus.example.com" + path, { method, headers });
const ID = "0123456789ab";
const values = { project: "acme-shop", part: "_", stage: "02-prd", pictureStage: "05-erd", id: "TBL-111", file: "view.01234567.js", comment: "nc_" + ID, proposal: "np_" + ID, edit: "ne_" + ID, checkpoint: "nk_" + ID, entry: "nd_" + ID };
// The search requires its words, so that a request of it reaches its handler.
const path = (route) => route.path.replace(/\{(\w+)\}/g, (_, name) => values[name]) + (route.operation === "searchItems" ? "?q=REQ-107" : "");
const code = (value) => (error) => error.code === value;
const headers = { "Idempotency-Key": '"nw_' + ID + '"', "Nexus-Session": "agent-one" };

test("all 41 contracted operations dispatch, and every GET also takes HEAD", () => {
  assert.equal(ROUTES.length, 41);
  assert.equal(new Set(ROUTES.map((route) => route.operation)).size, 41);
  // The first page holds the root since TASK-271, and the hub page moved to /hub.
  assert.equal(pathRoute(request("GET", "/")).operation, "getHomePage");
  assert.equal(pathRoute(request("GET", "/hub")).operation, "getHubPage");
  assert.deepEqual(pathRoute(request("GET", "/p/acme/_/02-prd")).params, { project: "acme", part: "", stage: "02-prd" });
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
    ["/api/spaces/acme/items/tbl-111", "item_not_found"], ["/api/spaces/acme/items/TBL-1234567", "item_not_found"],
    ["/api/spaces/acme/items/A" + "B".repeat(23) + "-123456", "item_not_found"], ["/api/spaces/Acme/items/tbl-111", "project_not_found"],
    ["/api/spaces/acme/items/", "not_found"],
    ["/p/Acme", "project_not_found"], ["/p/acme/Part/02-prd", "part_not_found"], ["/p/acme/_/14-other", "not_found"],
    ["/p/acme/part", "not_found"], ["/p/", "not_found"], ["/hub/", "not_found"],
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

test("an item read takes its part, the first part when it is left out, and refuses one in another form by its field", () => {
  const item = (query = "") => request("GET", "/api/spaces/acme/items/TBL-111" + query);
  const route = pathRoute(item());
  assert.deepEqual([route.operation, route.params], ["getItem", { project: "acme", id: "TBL-111" }]);
  assert.deepEqual(requestHeaders(item(), route, null).query, { part: null });
  assert.deepEqual(requestHeaders(item("?part=nexus&item=x"), route, null).query, { part: "nexus" });
  assert.deepEqual(requestHeaders(item("?part=_"), route, null).query, { part: "" });
  assert.equal(requestHeaders(item("?part=" + "a".repeat(100)), route, null).query.part.length, 100);
  for (const query of ["?part=Nexus", "?part=", "?part=a_b", "?part=-a", "?part=" + "a".repeat(101), "?part=nexus&part=memory"]) {
    assert.throws(() => requestHeaders(item(query), route, null), (error) => error.code === "invalid_request" && error.fields.field === "part", query);
  }
});

test("a search takes 2 to 200 characters of words once their outer spaces are cut, and refuses others by q", () => {
  const search = (query = "") => request("GET", "/api/search" + query);
  const route = pathRoute(search());
  assert.deepEqual([route.operation, route.params], ["searchItems", {}]);
  assert.deepEqual(requestHeaders(search("?q=REQ-107&part=x"), route, null).query, { q: "REQ-107" });
  assert.deepEqual(requestHeaders(search("?q=" + encodeURIComponent("  구매 확인 ")), route, null).query, { q: "구매 확인" });
  assert.deepEqual(requestHeaders(search("?q=%20%20ab%20%20"), route, null).query, { q: "ab" });
  assert.equal(Array.from(requestHeaders(search("?q=" + encodeURIComponent(" " + "가".repeat(200) + " ")), route, null).query.q).length, 200);
  for (const query of ["", "?q=", "?q=a", "?q=%20a%20", "?q=" + encodeURIComponent("가"), "?q=" + "x".repeat(201), "?q=" + encodeURIComponent("가".repeat(201)), "?q=ab&q=cd"]) {
    assert.throws(() => requestHeaders(search(query), route, null), (error) => error.code === "invalid_request" && error.fields.field === "q"
      && error.message === "q: write 2 to 200 characters", query);
  }
});

test("the first page's read takes no query value and ignores any that it is given", () => {
  const home = (query = "") => request("GET", "/api/home" + query);
  const route = pathRoute(home());
  assert.deepEqual([route.operation, route.params], ["getHome", {}]);
  assert.deepEqual(requestHeaders(home("?q=REQ-107&part=x&part=y"), route, null).query, {});
  assert.equal(pathRoute(request("HEAD", "/api/home")).operation, "getHome");
  assert.throws(() => pathRoute(request("POST", "/api/home")), (error) => error.code === "method_not_allowed" && error.headers.Allow === "GET, HEAD");
  assert.throws(() => pathRoute(request("GET", "/api/home/x")), code("not_found"));
});

test("taking a recommendation is the user's write on one comment, with a write ID and no session", () => {
  const route = pathRoute(request("POST", "/api/spaces/acme-shop/comments/nc_" + ID + "/recommended"));
  assert.deepEqual([route.operation, route.role, route.writeName, route.params], ["takeRecommendation", "user", "recommended", { project: "acme-shop", comment: "nc_" + ID }]);
  assert.deepEqual(requestHeaders(request("POST", "/api/spaces/acme-shop/comments/nc_" + ID + "/recommended", headers), route, "user"),
    { write: "nw_" + ID, session: null, query: {} });
  assert.throws(() => pathRoute(request("POST", "/api/spaces/acme-shop/comments/np_" + ID + "/recommended")), code("comment_not_found"));
  assert.throws(() => pathRoute(request("GET", "/api/spaces/acme-shop/comments/nc_" + ID + "/recommended")), (error) => error.code === "method_not_allowed" && error.headers.Allow === "POST");
});
