import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { AUTH_COOKIE, AUTH_LIFETIME, OWNER_COOKIE, OWNER_IDLE, OWNER_LIFETIME, bearerToken, cookieToken, csrfToken,
  iso, protectVerifier, randomToken, requireCSRF, requireOrigin, resourceId, safeEqual, safeReturnPath, sessionCookie,
  unprotectVerifier } from "./rebuild-auth.js";
import { canonicalJSON, rebuildBody, rebuildHeaders, rebuildJSON, rebuildProblemResponse, RebuildProblem,
  RebuildRateLimit, sha256, strictQuery } from "./rebuild-http.js";

const contract = JSON.parse(readFileSync(new URL("../../docs/06-api/sources/rebuild/openapi.json", import.meta.url), "utf8"));
const schemas = contract.components.schemas;
const stageKeys = schemas.StageSummary.properties.stage.enum;
const publicSample = contract.paths["/api/v2/sample"].get.responses["200"].content["application/json"].examples.success.value;
const projectId = /^[A-Za-z0-9][A-Za-z0-9_-]{2,79}$/;
const SPACE = /[\s\p{C}]/u;

function cursorSignature(session, id) {
  return createHmac("sha256", Buffer.from(session, "base64url")).update(`nexus.owner.projects/1\0${id}`).digest("base64url");
}

function pagination(params, session) {
  const count = params.get("limit") ?? "50";
  const cursor = params.get("cursor") || "";
  if (!/^[1-9][0-9]{0,2}$/.test(count) || Number(count) > 100 || cursor.length > 256) throw new RebuildProblem("invalid_input");
  if (!cursor) return { limit: Number(count), after: "" };
  const [id, signature, extra] = cursor.split(".");
  if (extra !== undefined || !projectId.test(id) || !safeEqual(cursorSignature(session, id), signature)) throw new RebuildProblem("invalid_input");
  return { limit: Number(count), after: id };
}

function checkRepository(input) {
  const names = input.repository_url.slice("https://github.com/".length).split("/");
  if (names.length !== 2 || names.some((name) => name === "." || name === "..")) throw new RebuildProblem("invalid_input");
  const branch = input.default_branch;
  if (SPACE.test(branch) || /[\\~^:?*\[]/.test(branch) || branch.startsWith("-") || branch === "HEAD" || branch === "@" ||
      branch.includes("..") || branch.includes("@{") || branch.endsWith(".") || branch.split("/").some((part) => !part || part.startsWith(".") || part.endsWith(".lock"))) {
    throw new RebuildProblem("invalid_input");
  }
  if (!input.title.trim() || !input.title.isWellFormed()) throw new RebuildProblem("invalid_input");
}

function catalog(artifacts, checkpoints) {
  const parts = [...new Set(artifacts.map(({ part }) => part))];
  return (parts.length ? parts : ["main"]).flatMap((part) => {
    let blockedBy = null;
    return stageKeys.map((stage) => {
      const artifact = artifacts.find((item) => item.part === part && item.stage === stage);
      const available = artifact && !["missing", "unsupported"].includes(artifact.representation);
      const related = checkpoints.filter((item) => item.part === part && item.stage === stage);
      const matching = available && related.find((item) => item.content_version === artifact.content_version && item.state !== "superseded");
      const checkpoint_state = matching?.state || (related.some((item) => item.state === "passed" || item.state === "withdrawn") ? "historical" : "none");
      const work_state = !available ? "not_started" : blockedBy ? "blocked" : checkpoint_state === "passed" ? "done" : "in_progress";
      const blockers = blockedBy ? [`${blockedBy} checkpoint is required`] : [];
      if (!blockedBy && (!available || checkpoint_state !== "passed")) blockedBy = stage;
      return { part, stage, work_state, artifact_state: artifact?.representation === "unsupported" ? "unsupported" : available ? "present" : "missing",
        checkpoint_state, content_version: artifact?.content_version ?? null, blockers,
        checkpoint_ids: related.slice(0, 100).map(({ id }) => id) };
    });
  });
}

// TASK-323/324/326, TASK-332–337. The v2 handler is mounted by the rebuild
// process only. Tests can supply a fake upstream, but the live entry point must
// use the configured, signature-verifying OIDC client.
export function createRebuildHandler({ store, origin, oidc = null, attemptKey, clock = Date.now, onTrace, limiter = new RebuildRateLimit() }) {
  const canonical = new URL(origin);
  if (canonical.protocol !== "https:" || canonical.origin !== origin || (oidc && !(Buffer.isBuffer(attemptKey) && attemptKey.length === 32))) {
    throw new Error("Invalid rebuild origin or OIDC state configuration");
  }

  function owner(request, now) {
    const bearer = bearerToken(request);
    if (bearer) {
      if (store.credential(sha256(bearer), iso(now))) throw new RebuildProblem("operation_forbidden");
      throw new RebuildProblem("sign_in_required");
    }
    const token = cookieToken(request, OWNER_COOKIE);
    if (!token) throw new RebuildProblem("sign_in_required");
    const hash = sha256(token);
    const session = store.session(hash, iso(now));
    if (!session) throw new RebuildProblem("sign_in_required");
    limiter.require(`owner:${session.owner_id}`, now, 240);
    return { token, hash, session };
  }

  function touch(identity, now) {
    const fresh = store.touchSession(identity.hash, iso(now), iso(now + OWNER_IDLE));
    if (!fresh) throw new RebuildProblem("sign_in_required");
    return fresh;
  }

  async function startSignIn(request, url, now) {
    strictQuery(url.searchParams);
    requireOrigin(request, origin, "invalid_input");
    const { return_path } = await rebuildBody(request, schemas.AuthStartInput);
    const returnPath = safeReturnPath(return_path, origin);
    if (!oidc) throw new RebuildProblem("authentication_unavailable");
    const state = randomToken(), nonce = randomToken(), verifier = randomToken();
    const authorize = await oidc.authorize({ state, nonce, verifier });
    const stateHash = sha256(state);
    const expires = iso(now + AUTH_LIFETIME);
    store.saveAuthAttempt({ stateHash, nonceHash: sha256(nonce), verifier: protectVerifier(attemptKey, stateHash, verifier),
      returnPath, now: iso(now), expires });
    return rebuildJSON({ authorize_url: authorize, expires_at: expires }, 200, {
      "Set-Cookie": sessionCookie(AUTH_COOKIE, state, AUTH_LIFETIME),
    });
  }

  async function completeSignIn(request, url, now) {
    strictQuery(url.searchParams, ["code", "state"]);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || code.length > 4096 || !state || state.length < 32 || state.length > 256) throw new RebuildProblem("invalid_input");
    if (!oidc) throw new RebuildProblem("authentication_unavailable");
    if (!safeEqual(state, cookieToken(request, AUTH_COOKIE))) throw new RebuildProblem("sign_in_required");
    const oldSession = cookieToken(request, OWNER_COOKIE);
    const auth = store.consumeAuthAttempt(sha256(state), iso(now));
    if (!auth) throw new RebuildProblem("sign_in_required");
    const verifier = unprotectVerifier(attemptKey, auth.state_hash, auth.protected_pkce_verifier);
    const identity = await oidc.complete({ code, verifier, nonceHash: auth.nonce_hash });
    const token = randomToken(), at = clock();
    store.issueSession({ ...identity, ownerId: resourceId("own"), idHash: sha256(token), csrfHash: sha256(csrfToken(token)),
      now: iso(at), idleExpires: iso(at + OWNER_IDLE), absoluteExpires: iso(at + OWNER_LIFETIME),
      previousHash: oldSession ? sha256(oldSession) : null });
    const headers = rebuildHeaders({ Location: safeReturnPath(auth.safe_return_path, origin) });
    headers.append("Set-Cookie", sessionCookie(OWNER_COOKIE, token, OWNER_LIFETIME));
    headers.append("Set-Cookie", sessionCookie(AUTH_COOKIE, "", 0));
    return new Response(null, { status: 303, headers });
  }

  function getSession(request, url, now) {
    strictQuery(url.searchParams);
    const identity = owner(request, now);
    const current = touch(identity, now);
    return rebuildJSON({ owner_id: current.owner_id, expires_at: current.idle_expires_at, csrf_token: csrfToken(identity.token) });
  }

  function logOut(request, url, now) {
    strictQuery(url.searchParams);
    const identity = owner(request, now);
    requireCSRF(request, identity.session, origin);
    if (!store.revokeSession(identity.hash, iso(now))) throw new RebuildProblem("sign_in_required");
    return new Response(null, { status: 204, headers: rebuildHeaders({ "Set-Cookie": sessionCookie(OWNER_COOKIE, "", 0) }) });
  }

  function listProjects(request, url, now) {
    strictQuery(url.searchParams, ["cursor", "limit"]);
    const identity = owner(request, now);
    const { after, limit } = pagination(url.searchParams, identity.token);
    const session = touch(identity, now);
    const projects = store.listProjects(session.owner_id, after, limit + 1);
    let next_cursor = null;
    if (projects.length > limit) {
      projects.pop();
      const { id } = projects.at(-1);
      next_cursor = `${id}.${cursorSignature(identity.token, id)}`;
    }
    return rebuildJSON({ projects, next_cursor });
  }

  async function connectProject(request, url, now) {
    strictQuery(url.searchParams);
    const identity = owner(request, now);
    requireCSRF(request, identity.session, origin);
    const key = request.headers.get("Idempotency-Key");
    if (!key || !/^[\x21-\x7e]{16,128}$/.test(key)) throw new RebuildProblem("invalid_input");
    const input = await rebuildBody(request, schemas.ProjectInput);
    checkRepository(input);
    const at = clock();
    const session = touch(identity, at);
    const result = store.connectProject({ owner: session.owner_id, id: resourceId("prj"), input,
      keyHash: sha256(key), bodyDigest: sha256(canonicalJSON(input)), receipt: resourceId("ir"), now: iso(at), expires: iso(at + 86400000), digest: sha256 });
    if (result.conflict) throw new RebuildProblem(result.conflict);
    return rebuildJSON(result.body, result.status);
  }

  function getOverview(request, url, now, id) {
    strictQuery(url.searchParams);
    if (!projectId.test(id)) throw new RebuildProblem("invalid_input");
    const identity = owner(request, now);
    const result = store.overview(identity.session.owner_id, id);
    if (!result) throw new RebuildProblem("not_found");
    touch(identity, now);
    return rebuildJSON({ project: result.project, stages: catalog(result.artifacts, result.checkpoints), held_commit: result.heldCommit });
  }

  function getSample(request, url) {
    strictQuery(url.searchParams);
    return rebuildJSON(publicSample);
  }

  const routes = new Map([
    ["/api/v2/session", { GET: getSession }],
    ["/api/v2/auth/start", { POST: startSignIn }],
    ["/api/v2/auth/callback", { GET: completeSignIn }],
    ["/api/v2/session/logout", { POST: logOut }],
    ["/api/v2/projects", { GET: listProjects, POST: connectProject }],
    ["/api/v2/sample", { GET: getSample }],
  ]);

  return async (request, { clientScope = "local" } = {}) => {
    const url = new URL(request.url);
    try {
      if (url.origin !== origin) throw new RebuildProblem("invalid_input");
      const match = /^\/api\/v2\/projects\/([^/]+)$/.exec(url.pathname);
      const route = routes.get(url.pathname) || (match ? { GET: getOverview } : null);
      if (!route) throw new RebuildProblem("not_found");
      if (!Object.hasOwn(route, request.method)) throw new RebuildProblem("method_not_allowed", { Allow: Object.keys(route).join(", ") });
      const now = clock();
      const login = url.pathname.startsWith("/api/v2/auth/");
      limiter.require(`${login ? url.pathname : "transport"}:${clientScope}`, now, login ? 30 : 3000);
      return await route[request.method](request, url, now, match?.[1]);
    } catch (error) { return rebuildProblemResponse(error, url, onTrace); }
  };
}
