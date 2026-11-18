import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createNodeServer } from "../src/node-server.js";
import { createRebuildHandler } from "../src/rebuild-app.js";
import { RebuildProblem } from "../src/rebuild-http.js";
import { openRebuildDatabase } from "../src/rebuild-sqlite.js";
import { RebuildStore } from "../src/store.js";

const contract = JSON.parse(readFileSync(new URL("../../docs/06-api/sources/rebuild/openapi.json", import.meta.url)));
const origin = "https://nexus.example.test";
const sampleParams = { projectId: "prj_fixture", part: "main", stage: "02-prd", itemId: "REQ-301" };

async function fixture(t, limiter) {
  const db = openRebuildDatabase(":memory:");
  const handler = createRebuildHandler({ store: new RebuildStore(db), origin, limiter });
  const server = createNodeServer({ origin, handleRequest: handler });
  const address = await server.start();
  t.after(async () => {
    await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
    db.close();
  });
  return (path, method) => fetch(`http://127.0.0.1:${address.port}${path}`, { method });
}

async function problem(response, status, code, op) {
  assert.equal(response.status, status, op);
  assert.equal(response.headers.get("Cache-Control"), "no-store", op);
  assert.equal(response.headers.get("Content-Type"), "application/problem+json", op);
  const value = await response.json();
  assert.equal(value.code, code, op);
  assert.match(value.traceId, /^[0-9a-f-]{36}$/, op);
}

test("each approved v2 HTTP operation is reachable and shares the declared refusals", async (t) => {
  const normal = await fixture(t);
  const limited = await fixture(t, { require: () => { throw new RebuildProblem("rate_limited", { "Retry-After": "20" }); } });
  const failed = await fixture(t, { require: () => { throw new Error("Synthetic internal detail"); } });
  let operations = 0;
  for (const [template, pathOperations] of Object.entries(contract.paths)) {
    const route = template.replace(/\{(\w+)\}/g, (_, name) => sampleParams[name] || "fixture_id");
    const denied = await normal(route, "DELETE");
    await problem(denied, 405, "method_not_allowed", template);
    assert.deepEqual(new Set(denied.headers.get("Allow").split(/,\s*/)), new Set(Object.keys(pathOperations).map((method) => method.toUpperCase())));
    for (const [method, definition] of Object.entries(pathOperations)) {
      operations += 1;
      const action = method.toUpperCase(), op = definition.operationId;
      if (definition.responses["400"]) await problem(await normal(route + "?unexpected=1", action), 400, "invalid_input", op);
      if (definition.responses["429"]) {
        const response = await limited(route, action);
        await problem(response, 429, "rate_limited", op);
        assert.equal(response.headers.get("Retry-After"), "20", op);
      }
      if (definition.security.length && definition.responses["401"]) {
        await problem(await normal(route, action), 401, "sign_in_required", op);
      }
      if (definition.responses.default) {
        await problem(await failed(route, action), 500, "internal_error", op);
      }
    }
  }
  assert.equal(operations, 36);
});
