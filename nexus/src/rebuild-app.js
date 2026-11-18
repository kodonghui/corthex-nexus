import { AUTH_COOKIE, AUTH_LIFETIME, OWNER_COOKIE, OWNER_IDLE, OWNER_LIFETIME, bearerToken, cookieToken, csrfToken,
  iso, protectVerifier, randomToken, requireCSRF, requireOrigin, resourceId, safeEqual, safeReturnPath, sessionCookie,
  unprotectVerifier } from "./rebuild-auth.js";
import { canonicalJSON, rebuildBody, rebuildHeaders, rebuildJSON, rebuildProblemResponse, RebuildProblem,
  RebuildRateLimit, sha256, strictQuery } from "./rebuild-http.js";

import { commitPattern, idPattern, publicSample, rebuildRoutes, routeRequest, schemas, stageKeys } from "./rebuild-contract.js";
import { repositoryNames } from "./rebuild-github.js";
import { pageCursor, pageInput, publicationHandlers, writeResult } from "./rebuild-publications.js";
import { parserVersion, prepareArtifacts } from "./rebuild-source.js";
import { reviewHandlers } from "./rebuild-review.js";

const SPACE = /[\s\p{C}]/u;

function checkRepository(input) {
  if (!repositoryNames(input.repository_url)) throw new RebuildProblem("invalid_input");
  const branch = input.default_branch;
  if (SPACE.test(branch) || /[\\~^:?*\[]/.test(branch) || branch.startsWith("-") || branch === "HEAD" || branch === "@" ||
      branch.includes("..") || branch.includes("@{") || branch.endsWith(".") || branch.split("/").some((part) => !part || part.startsWith(".") || part.endsWith(".lock"))) {
    throw new RebuildProblem("invalid_input");
  }
  if (!input.title.trim() || !input.title.isWellFormed()) throw new RebuildProblem("invalid_input");
}

export function stageCatalog(artifacts, checkpoints) {
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
export function createRebuildHandler({ store, origin, oidc = null, attemptKey, clock = Date.now, onTrace, onOutcome, limiter = new RebuildRateLimit(), github = null, releaseCommit = null }) {
  const canonical = new URL(origin);
  if (canonical.protocol !== "https:" || canonical.origin !== origin || (oidc && !(Buffer.isBuffer(attemptKey) && attemptKey.length === 32))) {
    throw new Error("Invalid rebuild origin or OIDC state configuration");
  }

  function reportOutcome(outcome, traceId) {
    try { onOutcome?.({ outcome, traceId }); }
    catch { /* Logging cannot change a durable write's response. */ }
  }

  function traceFailure(record) {
    onTrace?.(record);
    const outcome = record.code === "lease_expired" ? "lease_expired" : record.status >= 500 ? "failed" : "refused";
    reportOutcome(outcome, record.traceId);
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
    limiter.require(`owner:${session.owner_id}`, now, 120);
    return { token, hash, session };
  }

  function touch(identity, now) {
    const fresh = store.touchSession(identity.hash, iso(now), iso(now + OWNER_IDLE));
    if (!fresh) throw new RebuildProblem("sign_in_required");
    return fresh;
  }

  function access(request, now, projectId, roles, forbidden = "operation_forbidden") {
    const token = bearerToken(request);
    if (token) {
      const hash = sha256(token);
      const credential = store.credential(hash, iso(now));
      if (!credential) throw new RebuildProblem("sign_in_required");
      if (credential.project_id !== projectId) throw new RebuildProblem("not_found");
      if (!roles.includes(credential.role)) throw new RebuildProblem(forbidden);
      limiter.require(`credential:${credential.id}`, now, 120);
      return { token, hash, role: credential.role, credential, owner: credential.owner_id, project: store.projectState(credential.owner_id, projectId) };
    }
    const identity = owner(request, now);
    if (!roles.includes("owner")) throw new RebuildProblem("operation_forbidden");
    const project = store.projectState(identity.session.owner_id, projectId);
    if (!project) throw new RebuildProblem("not_found");
    if (request.method === "GET") touch(identity, now);
    else requireCSRF(request, identity.session, origin);
    return { ...identity, role: "owner", owner: identity.session.owner_id, project };
  }

  function writeContext(request, actor, operation, body, scope = actor.project?.id || "owner") {
    const key = request.headers.get("Idempotency-Key");
    if (!key || !/^[\x21-\x7e]{16,128}$/.test(key)) throw new RebuildProblem("invalid_input");
    const at = clock();
    const now = iso(at);
    if (actor.role === "owner") touch(actor, at);
    else if (store.credential(actor.hash, now)?.id !== actor.credential.id) throw new RebuildProblem("sign_in_required");
    const receiptScope = actor.role === "owner" ? scope : `${scope}:credential:${actor.credential.id}`;
    return { owner: actor.owner, scope: receiptScope, operation, keyHash: sha256(key), bodyDigest: sha256(canonicalJSON({ target: new URL(request.url).pathname, body })),
      receipt: resourceId("ir"), now, expires: iso(at + 86400000), digest: sha256 };
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
    const { after, limit } = pageInput(url.searchParams, identity.token, "projects", idPattern);
    const session = touch(identity, now);
    const projects = store.listProjects(session.owner_id, after, limit + 1);
    let next_cursor = null;
    if (projects.length > limit) {
      projects.pop();
      const { id } = projects.at(-1);
      next_cursor = pageCursor(identity.token, "projects", id);
    }
    return rebuildJSON({ projects, next_cursor });
  }

  async function connectProject(request, url, now) {
    strictQuery(url.searchParams);
    const identity = owner(request, now);
    requireCSRF(request, identity.session, origin);
    const input = await rebuildBody(request, schemas.ProjectInput);
    checkRepository(input);
    const write = writeContext(request, { ...identity, owner: identity.session.owner_id, role: "owner" }, "connectProject", input);
    return writeResult(store.connectProject({ ...write, id: resourceId("prj"), input }));
  }

  function getOverview(request, url, now, { projectId: id }) {
    strictQuery(url.searchParams);
    const identity = owner(request, now);
    const result = store.overview(identity.session.owner_id, id);
    if (!result) throw new RebuildProblem("not_found");
    touch(identity, now);
    return rebuildJSON({ project: result.project, stages: stageCatalog(result.artifacts, result.checkpoints), held_commit: result.heldCommit });
  }

  function getSample(request, url) {
    strictQuery(url.searchParams);
    return rebuildJSON(publicSample);
  }

  async function createPrivateSampleProject(request, _url, now) {
    const identity = owner(request, now);
    requireCSRF(request, identity.session, origin);
    const input = await rebuildBody(request, schemas.SampleProjectInput);
    if (!input.title.trim() || !input.title.isWellFormed()) throw new RebuildProblem("invalid_input");
    if (typeof releaseCommit !== "string" || !commitPattern.test(releaseCommit)) throw new RebuildProblem("internal_error");
    const write = writeContext(request, { ...identity, owner: identity.session.owner_id, role: "owner" }, "createPrivateSampleProject", input);
    const id = resourceId("prj");
    const snapshot = { format: "nexus.publish/1", commit: releaseCommit, base_commit: null, consent_id: null,
      artifacts: [{ part: "main", stage: "02-prd", source_files: publicSample.source_files.map((file) => ({ ...file, path: "nexus/sample/" + file.path })) }] };
    const snapshotText = canonicalJSON(snapshot);
    const verified = { id: resourceId("pub"), digest: sha256(snapshotText), parser: parserVersion,
      repository: "https://github.com/kodonghui/corthex-nexus", snapshotText,
      artifacts: prepareArtifacts(snapshot.artifacts).map((artifact) => ({ ...artifact, id: resourceId("art") })) };
    return writeResult(store.createSample(write, input, id, "sample-" + sha256(id).slice(0, 16), verified, snapshot));
  }

  const routes = rebuildRoutes({ getOwnerSession: getSession, startOwnerSignIn: startSignIn, completeOwnerSignIn: completeSignIn,
    signOut: logOut, listOwnerProjects: listProjects, connectProject, getProjectOverview: getOverview, getPublicSample: getSample, createPrivateSampleProject,
    ...publicationHandlers({ store, github, access, writeContext, limiter, stageCatalog, reportOutcome }),
    ...reviewHandlers({ store, access, writeContext, limiter, stageCatalog, reportOutcome }),
  });

  return async (request, { clientScope = "local" } = {}) => {
    const url = new URL(request.url);
    try {
      if (url.origin !== origin) throw new RebuildProblem("invalid_input");
      const { op, ids } = routeRequest(routes, request, url);
      const now = clock();
      const login = url.pathname.startsWith("/api/v2/auth/");
      limiter.require(`${login ? url.pathname : "transport"}:${clientScope}`, now, login ? 30 : 3000);
      return await op.handle(request, url, now, ids);
    } catch (error) { return rebuildProblemResponse(error, url, traceFailure); }
  };
}
