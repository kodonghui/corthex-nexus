// The kinds of sign-in that the server takes for each operation, as its
// preflight decides them, for contract_response_check.py, which compares them
// with each operation's security in the contract. No network, database or
// credentials: only the preflight runs. stdout is JSON only.
import { ROUTES, pathRoute, requestHeaders } from "../src/preflight.js";

const ID = "0123456789ab";
const values = { project: "acme-shop", part: "_", stage: "02-prd", pictureStage: "05-erd", id: "TBL-111", file: "view.01234567.js", comment: "nc_" + ID, proposal: "np_" + ID, edit: "ne_" + ID, checkpoint: "nk_" + ID, entry: "nd_" + ID };
// A write's ID and a session's label, so that a refusal can only be one of kind.
const headers = { "Idempotency-Key": '"nw_' + ID + '"', "Nexus-Session": "kinds-corpus" };
const REFUSALS = new Set(["user_only", "agent_only", "no_kind"]);

function takes(route, address, kind) {
  try {
    requestHeaders(new Request(address, { method: route.method, headers }), route, kind);
    return true;
  } catch (error) {
    if (REFUSALS.has(error.code)) return false;
    throw error;
  }
}

const kinds = {};
for (const listed of ROUTES) {
  // The search requires its words, so that its request reaches the end of the preflight.
  const address = "https://nexus.example.com" + listed.path.replace(/\{(\w+)\}/g, (_, name) => values[name]) + (listed.operation === "searchItems" ? "?q=REQ-107" : "");
  const route = pathRoute(new Request(address, { method: listed.method }));
  if (route.operation !== listed.operation) throw new Error("the path of " + listed.operation + " leads to " + route.operation);
  kinds[route.operation] = { method: route.method.toLowerCase(), path: route.path, kinds: ["user", "agent"].filter((kind) => takes(route, address, kind)) };
}
process.stdout.write(JSON.stringify(kinds));
