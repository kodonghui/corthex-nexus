import { AccessVerifier, requireKind } from "./access.js";
import { Problem } from "./problem.js";

export const STAGES = Object.freeze(["01-domain", "02-prd", "03-user-flow", "04-functional-spec", "05-erd", "06-api", "07-sitemap", "08-screen-states", "09-mockup", "10-wbs", "11-development", "12-qa", "13-presentation"]);
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TRACE = /^[A-Z][A-Z0-9]*-[0-9]{1,6}$/;
const ID = /^[0-9a-hjkmnp-tv-z]{12}$/;
const SESSION = /^[A-Za-z0-9._:-]{1,100}$/;
const rules = [
  ["getHomePage", "GET", "/"],
  ["getHubPage", "GET", "/hub"],
  ["getPictureViewPage", "GET", "/pictures/{project}/{part}/{pictureStage}"],
  ["getStageOverviewPage", "GET", "/overview/{project}/{part}/{stage}"],
  ["getProjectPage", "GET", "/p/{project}"],
  ["getStagePage", "GET", "/p/{project}/{part}/{stage}"],
  ["getViewCode", "GET", "/code/{file}"],
  ["pushSnapshot", "POST", "/api/snapshots"],
  ["listSnapshots", "GET", "/api/snapshots"],
  ["getSnapshot", "GET", "/api/snapshots/{project}"],
  ["removeProject", "DELETE", "/api/snapshots/{project}"],
  ["getHeldCommit", "GET", "/api/snapshots/{project}/held"],
  ["getRemovalDryRun", "GET", "/api/snapshots/{project}/removal"],
  ["getPicture", "GET", "/api/spaces/{project}/pictures/{part}/{pictureStage}"],
  ["getStageOverview", "GET", "/api/spaces/{project}/overview/{part}/{stage}"],
  ["getAgentTodo", "GET", "/api/spaces/{project}/todo"],
  ["getStage", "GET", "/api/spaces/{project}/stages/{part}/{stage}"],
  ["getStageTalk", "GET", "/api/spaces/{project}/talk/{part}/{stage}"],
  ["getItem", "GET", "/api/spaces/{project}/items/{id}"],
  ["getHome", "GET", "/api/home"],
  ["searchItems", "GET", "/api/search"],
  ["leaveComment", "POST", "/api/spaces/{project}/comments", "either", "comment"],
  ["getComment", "GET", "/api/spaces/{project}/comments/{comment}"],
  ["replyToComment", "POST", "/api/spaces/{project}/comments/{comment}/replies", "either", "reply"],
  ["markAnswered", "POST", "/api/spaces/{project}/comments/{comment}/answered", "either", "answered"],
  ["recordDecision", "POST", "/api/spaces/{project}/comments/{comment}/decisions", "agent", "decision"],
  ["takeRecommendation", "POST", "/api/spaces/{project}/comments/{comment}/recommended", "user", "recommended"],
  ["makeProposal", "POST", "/api/spaces/{project}/proposals", "agent", "proposal"],
  ["getProposal", "GET", "/api/spaces/{project}/proposals/{proposal}"],
  ["withdrawProposal", "POST", "/api/spaces/{project}/proposals/{proposal}/withdraw", "agent", "withdraw-proposal"],
  ["acceptProposal", "POST", "/api/spaces/{project}/proposals/{proposal}/accept", "user", "accept"],
  ["dismissProposal", "POST", "/api/spaces/{project}/proposals/{proposal}/dismiss", "user", "dismiss-proposal"],
  ["getEdit", "GET", "/api/spaces/{project}/edits/{edit}"],
  ["reportEdit", "POST", "/api/spaces/{project}/edits/{edit}/report", "agent", "report-edit"],
  ["dismissEdit", "POST", "/api/spaces/{project}/edits/{edit}/dismiss", "user", "dismiss-edit"],
  ["passCheckpoint", "POST", "/api/spaces/{project}/checkpoints", "user", "checkpoint"],
  ["getCheckpoint", "GET", "/api/spaces/{project}/checkpoints/{checkpoint}"],
  ["withdrawCheckpoint", "POST", "/api/spaces/{project}/checkpoints/{checkpoint}/withdraw", "user", "withdraw-checkpoint"],
  ["reportCheckpoint", "POST", "/api/spaces/{project}/checkpoints/{checkpoint}/report", "agent", "report-checkpoint"],
  ["claimEntry", "POST", "/api/spaces/{project}/claims/{entry}", "agent"],
  ["releaseEntry", "DELETE", "/api/spaces/{project}/claims/{entry}", "agent"],
];

export const ROUTES = Object.freeze(rules.map(([operation, method, path, role, writeName]) => ({
  operation, method, path, role, writeName,
  names: [...path.matchAll(/\{(\w+)\}/g)].map((match) => match[1]),
  pattern: new RegExp("^" + path.replace(/\{\w+\}/g, "([^/]+)") + "$"),
})));

function validate(name, value) {
  if (name === "project" && (!NAME.test(value) || value.length > 100)) return "project_not_found";
  if (name === "part" && value !== "_" && (!NAME.test(value) || value.length > 100)) return "part_not_found";
  if ((name === "stage" && !STAGES.includes(value)) || (name === "pictureStage" && !["01-domain", "05-erd", "07-sitemap"].includes(value))) return "not_found";
  if (name === "file" && !/^[a-z0-9][a-z0-9-]{0,63}\.[0-9a-f]{8}\.(?:js|css|woff2)$/.test(value)) return "not_found";
  const prefix = { comment: "nc_", proposal: "np_", edit: "ne_", checkpoint: "nk_" }[name];
  if (prefix && (!value.startsWith(prefix) || !ID.test(value.slice(3)))) return name + "_not_found";
  if (name === "entry" && (!/^n[cdek]_/.test(value) || !ID.test(value.slice(3)))) return "entry_not_found";
  if (name === "id" && (value.length > 30 || !TRACE.test(value))) return "item_not_found";
  return null;
}

export function pathRoute(request) {
  const pathname = new URL(request.url).pathname;
  const matches = ROUTES.map((route) => ({ route, values: route.pattern.exec(pathname)?.slice(1) })).filter((match) => match.values);
  if (!matches.length) throw new Problem("not_found", "no such path");
  const parsed = {};
  const first = matches[0];
  for (let i = 0; i < first.route.names.length; i++) {
    const name = first.route.names[i];
    let value;
    try { value = decodeURIComponent(first.values[i]); }
    catch { throw new Problem("not_found", "no such path"); }
    const failure = validate(name, value);
    if (failure) throw new Problem(failure, "no such path value");
    parsed[name === "pictureStage" ? "stage" : name] = name === "part" && value === "_" ? "" : value;
  }
  const selected = matches.find(({ route }) => route.method === request.method || (route.method === "GET" && request.method === "HEAD"));
  if (!selected) {
    const allowed = ["GET", "HEAD", "POST", "DELETE"].filter((method) => matches.some(({ route }) => route.method === method || (method === "HEAD" && route.method === "GET")));
    throw new Problem("method_not_allowed", "method not allowed", {}, { Allow: allowed.join(", ") });
  }
  return { ...selected.route, params: parsed };
}

// The query values that a read takes, each with its default, how it is read
// and the words of its refusal (stage 06, Addresses and paths). A value that
// is not in its form, or given twice, is refused by its field, never ignored.
const AFTER = Object.freeze([0, (value) => /^[0-9]{1,6}$/.test(value) && Number(value) <= 100000 ? Number(value) : undefined, "write a whole number from 0 to 100000"]);
// Characters are counted as code points, as the contract's lengths count them.
const length = (value) => Array.from(value).length;
const QUERIES = Object.freeze({
  getStage: {
    after: AFTER,
    filter: ["all", (value) => ["all", "talk", "mine", "left"].includes(value) ? value : undefined, "write all, talk, mine or left"],
    q: [null, (value) => length(value) <= 200 ? value : undefined, "write at most 200 characters"],
    group: ["context", (value) => ["context", "source"].includes(value) ? value : undefined, "write context or source"],
  },
  getStageTalk: {
    item: [null, (value) => value.length <= 30 && TRACE.test(value) ? value : undefined, "write a trace ID, such as TBL-111"],
    closed: [0, (value) => value === "0" || value === "1" ? Number(value) : undefined, "write 0 or 1"],
    after: AFTER,
  },
  // null is the project's first part, and _ the project as a whole.
  getItem: {
    part: [null, (value) => value === "_" ? "" : NAME.test(value) && value.length <= 100 ? value : undefined, "write a part's name, or _ for the project as a whole"],
  },
  // The words are required, and counted once their outer spaces are cut.
  searchItems: {
    q: [undefined, (value) => { const words = value.trim(); return length(words) >= 2 && length(words) <= 200 ? words : undefined; }, "write 2 to 200 characters"],
  },
});

// The values that a read takes when a request names none, which a page uses
// for the reads that it holds (stage 06's Page data).
export const defaultQuery = (operation) => Object.fromEntries(Object.entries(QUERIES[operation]).map(([name, [fallback]]) => [name, fallback]));

export function queryValues(request, route) {
  const rules = QUERIES[route.operation];
  if (!rules) return {};
  const params = new URL(request.url).searchParams, values = {};
  for (const [name, [fallback, read, words]] of Object.entries(rules)) {
    const given = params.getAll(name);
    const value = given.length === 1 ? read(given[0]) : given.length ? undefined : fallback;
    if (value === undefined) throw new Problem("invalid_request", name + ": " + words, { field: name });
    values[name] = value;
  }
  return values;
}

export function requestHeaders(request, route, kind) {
  const change = request.method !== "GET" && request.method !== "HEAD";
  const site = request.headers.get("Sec-Fetch-Site");
  if (change && site && site !== "same-origin" && site !== "none") throw new Problem("cross_site", "a request from another site cannot change NEXUS");
  if (route.role) requireKind(kind, route.role);
  let write = null;
  if (route.writeName) {
    const match = /^"(nw_[0-9a-hjkmnp-tv-z]{12})"$/.exec(request.headers.get("Idempotency-Key") || "");
    if (!match) throw new Problem("invalid_request", "send the quoted write ID in Idempotency-Key", { field: "Idempotency-Key" });
    write = match[1];
  }
  let session = null;
  if ((route.role && kind === "agent") || route.operation === "getAgentTodo") {
    session = request.headers.get("Nexus-Session");
    if ((route.role && !session) || (session !== null && !SESSION.test(session))) throw new Problem("invalid_request", "send a session label of 1 to 100 ASCII letters, digits, dot, underscore, colon or hyphen", { field: "Nexus-Session" });
  }
  return { write, session, query: queryValues(request, route) };
}

const verifier = new AccessVerifier();
export async function preflight(request, env, ctx, accessVerifier = verifier) {
  const kind = await accessVerifier.verify(request, env, ctx);
  const route = pathRoute(request);
  return { ...route, kind, ...requestHeaders(request, route, kind) };
}
