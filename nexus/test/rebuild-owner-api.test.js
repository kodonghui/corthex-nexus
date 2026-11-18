import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { test } from "node:test";
import { createNodeServer } from "../src/node-server.js";
import { createRebuildHandler } from "../src/rebuild-app.js";
import { AUTH_COOKIE, OWNER_COOKIE, OWNER_IDLE, OWNER_LIFETIME, csrfToken, iso, randomToken, resourceId } from "../src/rebuild-auth.js";
import { RebuildRateLimit, sha256 } from "../src/rebuild-http.js";
import { RebuildOIDC } from "../src/rebuild-oidc.js";
import { openRebuildDatabase } from "../src/rebuild-sqlite.js";
import { RebuildStore } from "../src/store.js";
import { insertFixtureRow, seedRebuildFixture } from "./rebuild-fixture.js";

const origin = "https://nexus.example.test";
const issuer = "https://issuer.example.test";
const clientId = "test-corthex-nexus";
const begin = Date.parse("2026-11-18T04:00:00Z");
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const signed = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const header = signed({ alg: "RS256", kid: "fake-key" });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "fake-key", use: "sig" };

function provider(clock) {
  const state = { signer: privateKey, claimEdits: {}, tokenReads: 0, fault: null };
  state.fetch = async (destination, init) => {
    assert.equal(init.redirect, "error");
    const url = new URL(destination);
    assert.equal(url.origin, issuer);
    if (state.fault === "timeout") throw new DOMException("Fixture upstream timeout", "TimeoutError");
    if (state.fault === "unavailable") return new Response(null, { status: 503 });
    if (url.pathname === "/.well-known/openid-configuration") return Response.json({
      issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/jwks`,
      id_token_signing_alg_values_supported: ["RS256"], code_challenge_methods_supported: ["S256"], token_endpoint_auth_methods_supported: ["none"],
    });
    if (url.pathname === "/jwks") return Response.json({ keys: [jwk] });
    assert.equal(url.pathname, "/token");
    assert.equal(init.body.get("client_id"), clientId);
    assert.equal(init.body.get("redirect_uri"), `${origin}/api/v2/auth/callback`);
    assert.equal(init.body.get("grant_type"), "authorization_code");
    state.tokenReads += 1;
    const verifier = init.body.get("code_verifier");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    if (challenge !== state.challenge || init.body.get("code") !== "fixture-oauth-code") return new Response(null, { status: 400 });
    const seconds = Math.floor(clock() / 1000);
    const body = signed({ iss: issuer, aud: clientId, sub: "test-owner", iat: seconds, exp: seconds + 120,
      nonce: state.nonce, ...state.claimEdits });
    const message = `${header}.${body}`;
    return Response.json({ id_token: `${message}.${sign("RSA-SHA256", Buffer.from(message), state.signer).toString("base64url")}` });
  };
  return state;
}

async function fixture(t, { useProvider = true } = {}) {
  let time = begin;
  const clock = () => time;
  const connection = openRebuildDatabase(":memory:");
  const data = seedRebuildFixture(connection);
  const store = new RebuildStore(connection);
  const oauth = provider(clock);
  const traces = [];
  const limiter = new RebuildRateLimit();
  const oidc = useProvider ? new RebuildOIDC({ origin, issuer, clientId, fetchImpl: oauth.fetch, now: clock }) : null;
  const handle = createRebuildHandler({ origin, store, oidc, attemptKey: Buffer.alloc(32, 1), clock, limiter, onTrace: (value) => traces.push(value) });
  const server = createNodeServer({ origin, handleRequest: handle });
  const address = await server.start();
  t.after(async () => {
    await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
    connection.close();
  });
  function request(path, { method = "GET", headers = {}, body } = {}) {
    return fetch(`http://127.0.0.1:${address.port}${path}`, { method, headers, body, redirect: "manual" });
  }
  function issue(owner) {
    const token = randomToken();
    const existing = data.rows.owners.find(({ id }) => id === owner);
    const id = store.issueSession({ issuer: existing.issuer, subject: existing.subject, ownerId: resourceId("own"),
      idHash: sha256(token), csrfHash: sha256(csrfToken(token)), now: iso(time), idleExpires: iso(time + OWNER_IDLE),
      absoluteExpires: iso(time + OWNER_LIFETIME), previousHash: null });
    assert.equal(id, owner);
    return token;
  }
  return { request, connection, store, data, oauth, traces, limiter, clock, issue, advance: (ms) => { time += ms; } };
}

const cookie = (token) => `${OWNER_COOKIE}=${token}`;
const ownerHeaders = (token) => ({ Cookie: cookie(token), Origin: origin, "X-CSRF-Token": csrfToken(token) });
const json = (body) => ({ method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function problem(response, status, code) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("Content-Type"), "application/problem+json");
  const body = await response.json();
  assert.equal(body.code, code);
  assert.equal(body.status, status);
  assert.deepEqual(Object.keys(body).sort(), ["code", "detail", "instance", "status", "title", "traceId", "type"]);
  assert.match(body.traceId, /^[0-9a-f-]{36}$/);
  return body;
}

async function start(f, returnPath = "/projects") {
  const response = await f.request("/api/v2/auth/start", json({ return_path: returnPath }));
  assert.equal(response.status, 200);
  const { authorize_url } = await response.json();
  const url = new URL(authorize_url);
  assert.equal(url.origin, issuer);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  f.oauth.challenge = url.searchParams.get("code_challenge");
  f.oauth.nonce = url.searchParams.get("nonce");
  const state = url.searchParams.get("state");
  const attempt = f.connection.prepare("SELECT state_hash,nonce_hash,protected_pkce_verifier FROM auth_attempts WHERE state_hash=?").get(sha256(state));
  assert.equal(attempt.nonce_hash, sha256(f.oauth.nonce));
  assert.ok(attempt.protected_pkce_verifier.length > 43);
  assert.match(response.headers.getSetCookie()[0], /HttpOnly; Secure; SameSite=Lax/);
  return { callback: `/api/v2/auth/callback?${new URLSearchParams({ state, code: "fixture-oauth-code" })}`,
    authCookie: `${AUTH_COOKIE}=${state}` };
}

test("API-202/203 exchanges a bound code once, rotates the session and sends separate secure cookies over HTTP", async (t) => {
  const f = await fixture(t);
  const previous = f.issue(f.data.owner);
  const { callback, authCookie } = await start(f, "/projects?view=recent");
  await problem(await f.request(callback), 401, "sign_in_required");
  const headers = { Cookie: `${authCookie}; ${cookie(previous)}` };
  const responses = await Promise.all([f.request(callback, { headers }), f.request(callback, { headers })]);
  const success = responses.find((r) => r.status === 303);
  assert.ok(success);
  await problem(responses.find((r) => r !== success), 401, "sign_in_required");
  assert.equal(f.oauth.tokenReads, 1);
  assert.equal(success.headers.get("Location"), "/projects?view=recent");
  const [setSession, clearAttempt] = success.headers.getSetCookie();
  assert.match(setSession, /Max-Age=28800; HttpOnly; Secure; SameSite=Lax/);
  assert.match(clearAttempt, /^nexus_auth=; Path=\/; Max-Age=0;/);
  assert.notEqual(setSession.split(";")[0], cookie(previous));
  await problem(await f.request("/api/v2/session", { headers: { Cookie: cookie(previous) } }), 401, "sign_in_required");
  const token = setSession.split(";")[0];
  const session = await f.request("/api/v2/session", { headers: { Cookie: token } });
  assert.equal(session.status, 200);
  const payload = await session.json();
  assert.equal(payload.expires_at, iso(begin + OWNER_IDLE));
  const rawToken = token.slice(OWNER_COOKIE.length + 1);
  assert.notEqual(payload.csrf_token, rawToken);
  assert.equal(f.connection.prepare("SELECT count(*) AS n FROM owner_sessions WHERE id_hash=?").get(rawToken).n, 0);
  assert.ok(!JSON.stringify(f.traces).includes("fixture-oauth-code"));
});

test("API-203 rejects incorrect nonce, issuer, audience and signature and expired attempts", async (t) => {
  const f = await fixture(t);
  for (const claimEdits of [{ nonce: "bad-nonce" }, { iss: "https://other.example.test" }, { aud: "another-client" },
    { exp: Math.floor(begin / 1000) - 1 }]) {
    f.oauth.claimEdits = claimEdits;
    const { callback, authCookie } = await start(f);
    await problem(await f.request(callback, { headers: { Cookie: authCookie } }), 401, "sign_in_required");
  }
  f.oauth.claimEdits = {};
  f.oauth.signer = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  const badSignature = await start(f);
  await problem(await f.request(badSignature.callback, { headers: { Cookie: badSignature.authCookie } }), 401, "sign_in_required");
  const expired = await start(f);
  f.advance(301000);
  await problem(await f.request(expired.callback, { headers: { Cookie: expired.authCookie } }), 401, "sign_in_required");
  assert.equal(f.connection.prepare("SELECT count(*) AS n FROM owners").get().n, 2);
});

test("API-201/204 enforce idle and absolute expiry, CSRF, Origin, revocation and machine separation", async (t) => {
  const f = await fixture(t);
  const token = f.issue(f.data.owner), expired = f.issue(f.data.owner);
  const machine = randomToken();
  insertFixtureRow(f.connection, "project_credentials", { id: "publisher_fixture", owner_id: f.data.owner, project_id: f.data.projectId,
    role: "publisher", label: "Synthetic", secret_hash: sha256(machine), created_at: iso(begin) });
  await problem(await f.request("/api/v2/session", { headers: { Cookie: `${cookie(token)}; ${cookie(token)}` } }), 400, "invalid_input");
  await problem(await f.request("/api/v2/session", { headers: { Cookie: cookie(token), Authorization: `Bearer ${machine}` } }), 403, "operation_forbidden");
  const logout = (headers) => f.request("/api/v2/session/logout", { method: "POST", headers });
  await problem(await logout({ Cookie: cookie(token), Origin: origin }), 400, "invalid_input");
  await problem(await logout({ ...ownerHeaders(token), Origin: "https://other.example.test" }), 403, "operation_forbidden");
  await problem(await logout({ ...ownerHeaders(token), "X-CSRF-Token": csrfToken(expired) }), 403, "operation_forbidden");
  const get = (session) => f.request("/api/v2/session", { headers: { Cookie: cookie(session) } });
  for (let i = 0; i < 19; i++) {
    f.advance(25 * 60000);
    const response = await get(token);
    assert.equal(response.status, 200);
    if (i === 18) assert.equal((await response.json()).expires_at, iso(begin + OWNER_LIFETIME));
    else await response.body.cancel();
  }
  await problem(await get(expired), 401, "sign_in_required");
  f.advance(5 * 60000);
  await problem(await get(token), 401, "sign_in_required");
  const newToken = f.issue(f.data.owner);
  const response = await logout(ownerHeaders(newToken));
  assert.equal(response.status, 204);
  assert.match(response.headers.getSetCookie()[0], /^nexus_session=; Path=\/; Max-Age=0;/);
  await problem(await get(newToken), 401, "sign_in_required");
});

test("API-205/206 scope pagination and repeat writes to one verified owner", async (t) => {
  const f = await fixture(t);
  const token = f.issue(f.data.owner), other = f.issue(f.data.otherOwner);
  assert.equal(f.store.project(f.data.otherOwner, f.data.projectId), null);
  assert.equal(f.store.project(f.data.otherOwner, "prj_missing"), null);
  const input = { slug: "two-sources", title: "Two sources", repository_url: "https://github.com/example/second", default_branch: "main" };
  const create = (session, payload, key = "fixture-key-repeat-1") => f.request("/api/v2/projects", {
    ...json(payload), headers: { ...json(payload).headers, ...ownerHeaders(session), "Idempotency-Key": key },
  });
  const results = await Promise.all([create(token, input), create(token, input)]);
  assert.ok(results.every((r) => r.status === 201));
  const [created, replay] = await Promise.all(results.map((r) => r.json()));
  assert.deepEqual(created, replay);
  await problem(await create(token, { ...input, title: "Changed title" }), 409, "idempotency_conflict");
  await problem(await create(token, input, "fixture-key-another"), 409, "state_conflict");
  assert.equal((await create(other, input)).status, 201);
  const list = (session, query) => f.request(`/api/v2/projects${query || ""}`, { headers: { Cookie: cookie(session) } });
  const page = await (await list(token, "?limit=1")).json();
  assert.equal(page.projects.length, 1);
  assert.ok(page.next_cursor);
  const pageTwo = await (await list(token, `?cursor=${encodeURIComponent(page.next_cursor)}`)).json();
  assert.deepEqual(new Set([...page.projects, ...pageTwo.projects].map(({ id }) => id)), new Set([f.data.projectId, created.id]));
  assert.equal(pageTwo.next_cursor, null);
  await problem(await list(other, `?cursor=${encodeURIComponent(page.next_cursor)}`), 400, "invalid_input");
  const otherProjects = (await (await list(other)).json()).projects;
  assert.equal(otherProjects.length, 2);
  assert.ok(otherProjects.every(({ id }) => id !== f.data.projectId && id !== created.id));
  assert.equal(f.connection.prepare("SELECT count(*) AS n FROM idempotency_receipts WHERE owner_id=?").get(f.data.owner).n, 1);
});

test("API-207 distinguishes missing stages, current checkpoints and historical decisions without exposing another owner's project", async (t) => {
  const f = await fixture(t);
  const token = f.issue(f.data.owner), other = f.issue(f.data.otherOwner);
  const overview = (id, session) => f.request(`/api/v2/projects/${id}`, { headers: { Cookie: cookie(session) } });
  const response = await overview(f.data.projectId, token);
  assert.equal(response.status, 200);
  const { project, stages, held_commit } = await response.json();
  assert.equal(project.id, f.data.projectId);
  assert.equal(held_commit, "e".repeat(40));
  assert.deepEqual(stages.map(({ stage }) => stage.slice(0, 2)), Array.from({ length: 13 }, (_, i) => String(i + 1).padStart(2, "0")));
  assert.equal(stages[0].artifact_state, "missing");
  assert.equal(stages[1].artifact_state, "present");
  assert.equal(stages[1].checkpoint_state, "pending");
  assert.equal(stages[1].content_version, f.data.current.content_version);
  assert.equal(stages[1].work_state, "blocked");
  assert.ok(stages[1].checkpoint_ids.includes(f.data.previous.id));
  const foreign = await problem(await overview(f.data.projectId, other), 404, "not_found");
  const absent = await problem(await overview("prj_absent", other), 404, "not_found");
  assert.equal(foreign.detail, absent.detail);
  assert.equal(foreign.type, absent.type);
  assert.ok(!JSON.stringify(foreign).includes(project.title));
});

test("API-232 exposes only the approved public sample source without an owner session", async (t) => {
  const f = await fixture(t);
  const response = await f.request("/api/v2/sample");
  assert.equal(response.status, 200);
  const sample = await response.json();
  assert.ok(sample.source_files.length > 0);
  for (const { content_utf8, sha256: digest } of sample.source_files) assert.equal(sha256(content_utf8), digest);
  assert.ok(!JSON.stringify(sample).includes("Another owner's private sample"));
  await problem(await f.request("/api/v2/sample?project=prj_other"), 400, "invalid_input");
});

test("v2 HTTP refusals include matching public problem codes, limits, trace IDs and methods", async (t) => {
  const f = await fixture(t, { useProvider: false });
  await problem(await f.request("/api/v2/auth/start", json({ return_path: "//other.example/as-if-local" })), 400, "invalid_input");
  await problem(await f.request("/api/v2/auth/start", json({ return_path: "/projects" })), 503, "authentication_unavailable");
  await problem(await f.request("/api/v2/auth/start", json({ return_path: "/" + "x".repeat(256 * 1024) })), 413, "payload_too_large");
  const refusal = await f.request("/api/v2/session", { method: "POST" });
  assert.equal(refusal.headers.get("Allow"), "GET");
  await problem(refusal, 405, "method_not_allowed");
  await problem(await f.request("/api/v2/missing?do-not-echo=private-fixture"), 404, "not_found");
  for (let i = 0; i < 240; i++) f.limiter.require(`owner:${f.data.owner}`, f.clock(), 240);
  const token = f.issue(f.data.owner);
  const limited = await f.request("/api/v2/session", { headers: { Cookie: cookie(token) } });
  assert.ok(Number(limited.headers.get("Retry-After")) > 0);
  await problem(limited, 429, "rate_limited");
  assert.ok(!JSON.stringify(f.traces).includes("private-fixture"));
});

test("API-202 maps a provider deadline without creating a partial authentication attempt", async (t) => {
  const f = await fixture(t);
  f.oauth.fault = "timeout";
  await problem(await f.request("/api/v2/auth/start", json({ return_path: "/projects" })), 504, "upstream_timeout");
  assert.equal(f.connection.prepare("SELECT count(*) AS n FROM auth_attempts").get().n, 0);
});
