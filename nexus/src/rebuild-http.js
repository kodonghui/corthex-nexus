import { createHash, randomUUID } from "node:crypto";
import { jsonBody } from "./body.js";
import { Problem } from "./problem.js";

const errors = Object.freeze({
  invalid_input: [400, "Request is invalid"],
  sign_in_required: [401, "Sign in to continue"],
  operation_forbidden: [403, "This identity cannot perform the operation"],
  human_session_required: [403, "An owner session is required"],
  not_found: [404, "The requested resource is unavailable"],
  method_not_allowed: [405, "Method is not allowed"],
  stale_version: [409, "The reviewed version has changed"],
  state_conflict: [409, "The resource is already in use or has changed"],
  idempotency_conflict: [409, "The request key belongs to a different request"],
  lease_expired: [409, "The work lease has expired"],
  unmerged_commit: [409, "The publication is not on the default branch"],
  older_publication: [409, "A newer publication is already held"],
  consent_required: [409, "A matching first publication consent is required"],
  payload_too_large: [413, "The request body exceeds its limit"],
  rate_limited: [429, "Too many requests"],
  internal_error: [500, "The request could not be completed"],
  authentication_unavailable: [503, "Sign-in is temporarily unavailable"],
  source_verification_unavailable: [503, "Repository verification is unavailable"],
  upstream_timeout: [504, "An upstream service did not respond in time"],
});

export class RebuildProblem extends Error {
  constructor(code, headers = {}) {
    super(code);
    if (!Object.hasOwn(errors, code)) throw new TypeError("Unknown rebuild problem code");
    this.code = code;
    this.headers = headers;
  }
}

export function rebuildHeaders(extra) {
  const h = new Headers(extra);
  h.set("Cache-Control", "no-store");
  h.set("Referrer-Policy", "no-referrer");
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
  h.set("Cross-Origin-Resource-Policy", "same-origin");
  return h;
}

export function rebuildProblemResponse(error, url, onTrace) {
  const code = error instanceof RebuildProblem ? error.code : "internal_error";
  const [status, title] = errors[code];
  const traceId = randomUUID();
  onTrace?.({ traceId, code, status });
  const headers = rebuildHeaders(error instanceof RebuildProblem ? error.headers : {});
  headers.set("Content-Type", "application/problem+json");
  return new Response(JSON.stringify({ type: `${url.origin}/problems/${code}`, title, status,
    detail: code === "sign_in_required" ? "Return to the welcome screen and sign in again." : title,
    instance: url.pathname.slice(0, 2048) || "/", code, traceId }), { status, headers });
}

export function rebuildJSON(body, status = 200, extra) {
  return Response.json(body, { status, headers: rebuildHeaders(extra) });
}

export async function rebuildBody(request, schema, options) {
  try { return (await jsonBody(request, schema, false, { oversizeText: /(?:^|\.)(?:body|content_utf8)$/, ...options })).data; }
  catch (error) {
    if (!(error instanceof Problem)) throw error;
    throw new RebuildProblem(error.code === "body_too_large" || error.code === "text_too_long" ? "payload_too_large" : "invalid_input");
  }
}

export function strictQuery(params, names = []) {
  for (const name of params.keys()) {
    if (!names.includes(name) || params.getAll(name).length !== 1) throw new RebuildProblem("invalid_input");
  }
}

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function canonicalJSON(value) {
  if (value === null || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) return JSON.stringify(value);
  if (typeof value === "string" && value.isWellFormed()) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(",")}]`;
  if (value && typeof value === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    return `{${Object.keys(value).sort().map((key) => `${canonicalJSON(key)}:${canonicalJSON(value[key])}`).join(",")}}`;
  }
  throw new RebuildProblem("invalid_input");
}

// Fixed, bounded windows. The process accepts only a small number of attempts
// for each trusted scope; the scope is not copied from request headers.
export class RebuildRateLimit {
  #time = -1;
  #counts = new Map();

  require(scope, now, limit) {
    const time = Math.floor(now / 60000);
    if (this.#time !== time) {
      this.#time = time;
      this.#counts.clear();
    }
    const count = this.#counts.get(scope) || 0;
    if (count >= limit || (count === 0 && this.#counts.size >= 10000)) {
      throw new RebuildProblem("rate_limited", { "Retry-After": String(60 - Math.floor(now / 1000) % 60) });
    }
    this.#counts.set(scope, count + 1);
  }
}
