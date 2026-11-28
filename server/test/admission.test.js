// Owner admission (SPEC-048, rule 1, rule 8; TASK-416): every owner request needs the gate's sign-in of the one owner,
// a write of the owner's comes only from NEXUS's own pages, and every refusal is logged with its time, action, sender
// and reason. The sign-ins are signed with a local key; no test reaches a gate or the network. Agent admission, and an
// agent credential on an owner operation, are tested with the credentials they need in credentials.test.js.

import assert from 'node:assert/strict';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import { AGENT_ACTIONS, familyOf, OWNER_ACTIONS } from '../src/admission.js';
import { createApp } from '../src/app.js';
import { createGate, GateKeysError } from '../src/gate.js';
import {
  assertNoneIn, forbiddenValues, ISSUER, localGate, newId, OWNER_EMAIL, signToken, startServer, TRACE_ID,
} from './support.js';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const PROBLEM_KEYS = ['code', 'detail', 'status', 'title', 'traceId'];
const RAY = /^[0-9a-f]{16}-[A-Z]{3}$/;
const HOUR = 3600;

// The contract's operations: their method, operationId, family and the codes their examples answer.
function operations() {
  const found = [];
  let current = null;
  for (const line of read('api/openapi.yaml').split('\n')) {
    // A line indented two spaces or less ends the operation: the next path, or the end of paths.
    if (/^ {0,2}\S/.test(line)) current = null;
    const method = /^ {4}(get|post|put|patch|delete):$/.exec(line);
    if (method) {
      current = { method: method[1].toUpperCase(), codes: new Set() };
      found.push(current);
    }
    if (current === null) continue;
    const id = /^ {6}operationId: (\S+)$/.exec(line);
    if (id) current.action = id[1];
    const family = /^ {8}family: (\S+)$/.exec(line);
    if (family) current.family = family[1];
    const code = /^ {20}code: ([a-z_]+)$/.exec(line);
    if (code) current.codes.add(code[1]);
  }
  return found;
}

describe('the operation families', () => {
  const all = operations();
  const ofFamily = (family) => all.filter((each) => each.family === family);

  test('are the contract\'s', () => {
    assert.ok(all.length >= 52, 'the contract was read');
    assert.equal(all.filter((each) => each.family === undefined).length, 0);
    assert.deepEqual([...OWNER_ACTIONS].sort(), ofFamily('owner').map((each) => each.action).sort());
    assert.deepEqual([...AGENT_ACTIONS].sort(), ofFamily('agent').map((each) => each.action).sort());
  });

  test('refuse what the contract says each owner operation refuses', () => {
    // Every owner operation answers unauthenticated and not_owner; exactly its writes answer cross_site.
    for (const operation of ofFamily('owner')) {
      assert.ok(operation.codes.has('unauthenticated'), operation.action);
      assert.ok(operation.codes.has('not_owner'), operation.action);
      assert.equal(operation.codes.has('cross_site'), operation.method !== 'GET', operation.action);
    }
  });

  test('come from the contract, and a route of any other action says it needs no admission', () => {
    const handle = () => ({ body: {} });
    assert.equal(familyOf({ action: 'listProjects' }), 'owner');
    assert.equal(familyOf({ action: 'pushSnapshot' }), 'agent');
    assert.equal(familyOf({ action: 'listProjects', family: 'owner' }), 'owner');
    assert.equal(familyOf({ action: 'aTestRoute', family: 'none' }), 'none');
    assert.throws(() => familyOf({ action: 'listProjects', family: 'none' }), /owner operation/);
    assert.throws(() => familyOf({ action: 'listProject' }), /no operation of the contract/);
    assert.throws(() => familyOf({ action: 'aTestRoute', family: 'owner' }), /no operation of the contract/);
    // An owner operation cannot be served without the gate.
    assert.throws(
      () => createApp({ settings: {}, routes: [{ method: 'GET', path: '/api/projects', action: 'listProjects', handle }] }),
      /need the gate/,
    );
    // An agent operation cannot be served without the store, which holds the agent credentials.
    assert.throws(
      () => createApp({ settings: {}, routes: [{ method: 'GET', path: '/api/spaces/{project}/todo', action: 'getAgentTodo', params: { project: 'space_not_found' }, handle }] }),
      /need the store/,
    );
  });
});

describe('an owner request', () => {
  const marker = `project-data-${randomBytes(8).toString('hex')}`;
  const calls = { count: 0 };
  // Each handler answers project data, so a refusal that reached one would show it.
  // params names the 404 code of each path parameter (see params.js); the IDs below are in their contract's forms.
  const answering = (method, path, action, params = {}) => ({
    method,
    path,
    action,
    params,
    handle: () => {
      calls.count += 1;
      return { body: { projects: [{ name: marker }] } };
    },
  });
  let local;
  let server;
  let lines = 0;

  before(async () => {
    local = localGate();
    server = await startServer({
      gate: local.gate,
      routes: [
        answering('GET', '/api/projects', 'listProjects'),
        answering('POST', '/api/projects/{project}/diagrams/{diagram}/threads', 'startThread', {
          project: 'project_not_found', diagram: 'diagram_not_found',
        }),
        answering('PATCH', '/api/projects/{project}/workshop/notes/{note}', 'changeNote', {
          project: 'project_not_found', note: 'note_not_found',
        }),
        answering('DELETE', '/api/projects/{project}/tool-links/{link}', 'removeToolLink', {
          project: 'project_not_found', link: 'tool_link_not_found',
        }),
      ],
    });
  });
  after(() => server.close());

  // Sends a request and answers it with its log line.
  async function sent(request) {
    const answer = await server.send(request);
    lines += 1;
    const line = (await server.logged(lines)).at(-1);
    return { answer, line };
  }

  // A refusal: the Problem only, no project data, the handler never called, and one log line with its time, action,
  // sender and reason.
  async function refused(request, { status, code, sender = 'unknown', reason }) {
    const handled = calls.count;
    const { answer, line } = await sent(request);
    assert.equal(answer.status, status);
    assert.equal(answer.headers['content-type'], 'application/problem+json');
    assert.deepEqual(Object.keys(answer.json).sort(), PROBLEM_KEYS);
    assert.equal(answer.json.code, code);
    assert.equal(answer.text.includes(marker), false, 'a refused answer holds project data');
    assert.equal(calls.count, handled, 'a refused request reached its handler');
    assert.equal(line.traceId, answer.json.traceId);
    assert.match(line.time, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    assert.equal(line.action, request.action);
    assert.equal(line.sender, sender);
    assert.equal(line.status, status);
    assert.equal(line.code, code);
    assert.equal(line.reason, reason);
    return { answer, line };
  }

  async function admitted(request) {
    const handled = calls.count;
    const { answer, line } = await sent(request);
    assert.equal(answer.status, 200, answer.text);
    assert.equal(answer.json.projects[0].name, marker);
    assert.equal(calls.count, handled + 1);
    assert.equal(line.sender, 'owner');
    assert.equal(line.code, null);
    assert.equal(line.reason, undefined);
    return { answer, line };
  }

  const list = (headers = {}) => ({ method: 'GET', path: '/api/projects', headers, action: 'listProjects' });
  const write = (headers = {}) => ({
    method: 'POST',
    path: `/api/projects/demo/diagrams/${newId('dg')}/threads`,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: '{"text":"a comment"}',
    action: 'startThread',
  });
  const signedIn = (token, headers = {}) => ({ 'Cf-Access-Jwt-Assertion': token, ...headers });
  const seconds = () => Math.floor(Date.now() / 1000);

  test('with the owner\'s sign-in is admitted, with the owner as its sender', async () => {
    await admitted(list(signedIn(local.token())));
    // The gate's email is matched without case, and a sign-in with one audience among others is the application's.
    await admitted(list(signedIn(local.token({ email: OWNER_EMAIL.toUpperCase() }))));
    await admitted(list(signedIn(local.token({ aud: local.audience }))));
    await admitted(list(signedIn(local.token({ aud: [randomBytes(32).toString('hex'), local.audience] }))));
    // A clock behind the gate's by under a minute still admits a sign-in just made.
    await admitted(list(signedIn(local.token({ nbf: seconds() + 30 }))));
  });

  test('with no sign-in, or an expired one, gets unauthenticated', async () => {
    await refused(list(), { status: 401, code: 'unauthenticated', reason: 'no_sign_in' });
    await refused(list(signedIn('')), { status: 401, code: 'unauthenticated', reason: 'no_sign_in' });
    await refused(write(), { status: 401, code: 'unauthenticated', reason: 'no_sign_in' });
    const expired = local.token({ iat: seconds() - 2 * HOUR, nbf: seconds() - 2 * HOUR, exp: seconds() - HOUR });
    await refused(list(signedIn(expired)), { status: 401, code: 'unauthenticated', reason: 'expired' });
    await refused(write(signedIn(local.token({ exp: seconds() - 1 }))), { status: 401, code: 'unauthenticated', reason: 'expired' });
    // The sign-in is read from the gate's header only, never from a cookie or another header.
    const cookie = { Cookie: `CF_Authorization=${local.token()}`, Authorization: `Bearer ${local.token()}` };
    await refused(list(cookie), { status: 401, code: 'unauthenticated', reason: 'no_sign_in' });
  });

  test('with a sign-in the gate did not sign for this NEXUS gets unauthenticated', async () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
    const otherSigned = (claims, header) => signToken(other, { alg: 'RS256', kid: local.kid, ...header }, claims);
    const claims = { aud: [local.audience], email: OWNER_EMAIL, exp: seconds() + HOUR, iss: ISSUER, sub: 'x' };
    const [head, body] = local.token().split('.');
    for (const [token, reason] of [
      ['not a token', 'malformed'],
      [`${head}.${body}`, 'malformed'],
      [`${head}.${body}.`, 'malformed'],
      [`${local.token()}, ${local.token()}`, 'malformed'],
      ['a'.repeat(9000), 'malformed'],
      // A token cannot choose its algorithm, its key or how its claims are read.
      [local.token({}, { alg: 'none' }), 'malformed'],
      [local.token({}, { alg: 'HS256' }), 'malformed'],
      [local.token({}, { kid: undefined }), 'malformed'],
      [local.token({}, { crit: ['exp'] }), 'malformed'],
      [`${head}.${Buffer.from('[1]').toString('base64url')}.${local.token().split('.')[2]}`, 'malformed'],
      [local.token({}, { kid: randomBytes(32).toString('hex') }), 'unknown_key'],
      [otherSigned(claims), 'bad_signature'],
      [`${head}.${otherSigned(claims).split('.')[1]}.${local.token().split('.')[2]}`, 'bad_signature'],
      [local.token({ iss: 'https://another.example.com' }), 'wrong_issuer'],
      [local.token({ iss: undefined }), 'wrong_issuer'],
      [local.token({ aud: [randomBytes(32).toString('hex')] }), 'wrong_audience'],
      [local.token({ aud: undefined }), 'wrong_audience'],
      [local.token({ exp: undefined }), 'malformed'],
      [local.token({ exp: `${seconds() + HOUR}` }), 'malformed'],
      [local.token({ nbf: seconds() + 2 * 60 }), 'not_yet_valid'],
      [local.token({ nbf: 'now' }), 'malformed'],
    ]) {
      await refused(list(signedIn(token)), { status: 401, code: 'unauthenticated', reason });
    }
  });

  test('with another person\'s sign-in gets not_owner, the sender still unknown', async () => {
    for (const claims of [
      { email: 'someone@example.org' },
      { email: `${OWNER_EMAIL}.example.org` },
      { email: `x${OWNER_EMAIL}` },
      // A service token of the gate carries no email.
      { email: undefined, sub: '', common_name: `${randomBytes(16).toString('hex')}.access` },
      { email: [OWNER_EMAIL] },
    ]) {
      await refused(list(signedIn(local.token(claims))), { status: 403, code: 'not_owner' });
      await refused(write(signedIn(local.token(claims))), { status: 403, code: 'not_owner' });
    }
  });

  test('that writes from another site gets cross_site, the owner its sender', async () => {
    for (const site of ['cross-site', 'same-site', '', 'same-origin, cross-site']) {
      const owner = signedIn(local.token(), { 'Sec-Fetch-Site': site });
      await refused(write(owner), { status: 403, code: 'cross_site', sender: 'owner' });
    }
    const owner = signedIn(local.token(), { 'Sec-Fetch-Site': 'cross-site' });
    await refused({ ...write(owner), method: 'PATCH', path: `/api/projects/demo/workshop/notes/${newId('sn')}`, action: 'changeNote' },
      { status: 403, code: 'cross_site', sender: 'owner' });
    await refused({ method: 'DELETE', path: `/api/projects/demo/tool-links/${newId('tl')}`, headers: owner, action: 'removeToolLink' },
      { status: 403, code: 'cross_site', sender: 'owner' });
    // From NEXUS's own page, typed into the address bar, or from no browser at all, a write is admitted.
    for (const site of ['same-origin', 'none', undefined]) {
      await admitted(write(signedIn(local.token(), site === undefined ? {} : { 'Sec-Fetch-Site': site })));
    }
    // A read from another site changes nothing and is admitted; the browser keeps its answer from that site.
    await admitted(list(signedIn(local.token(), { 'Sec-Fetch-Site': 'cross-site' })));
  });

  test('takes the gate\'s CF-Ray as its trace ID only once the owner is admitted', async () => {
    const ray = () => `${randomBytes(8).toString('hex')}-ICN`;
    const owner = ray();
    const { answer, line } = await admitted(list(signedIn(local.token(), { 'CF-Ray': owner })));
    assert.equal(line.traceId, owner);
    assert.equal(answer.json.projects[0].name, marker);
    const crossSite = ray();
    const refusal = await refused(write(signedIn(local.token(), { 'Sec-Fetch-Site': 'cross-site', 'CF-Ray': crossSite })),
      { status: 403, code: 'cross_site', sender: 'owner' });
    assert.equal(refusal.answer.json.traceId, crossSite);
    // Without the owner's current sign-in, anyone could have chosen it: no sign-in, an expired or a foreign one, or
    // another person's, which is a bearer token its holder could send around the gate.
    for (const [request, expected] of [
      [list({ 'CF-Ray': ray() }), { status: 401, code: 'unauthenticated', reason: 'no_sign_in' }],
      [list(signedIn(local.token({ exp: seconds() - 1 }), { 'CF-Ray': ray() })), { status: 401, code: 'unauthenticated', reason: 'expired' }],
      [list(signedIn(local.token({ aud: ['another'] }), { 'CF-Ray': ray() })), { status: 401, code: 'unauthenticated', reason: 'wrong_audience' }],
      [list(signedIn(local.token({ email: 'someone@example.org' }), { 'CF-Ray': ray() })), { status: 403, code: 'not_owner' }],
    ]) {
      const { answer: other } = await refused(request, expected);
      assert.notEqual(other.json.traceId, request.headers['CF-Ray']);
      assert.match(other.json.traceId, /^[0-9a-f]{16}$/);
    }
    // Only a ray in its own form is taken.
    for (const other of ['0123456789abcdef', '0123456789ABCDEF-ICN', '0123456789abcdef-icn', `${owner}-ICN`, `${owner} x`]) {
      const { line: admittedLine } = await admitted(list(signedIn(local.token(), { 'CF-Ray': other })));
      assert.match(admittedLine.traceId, /^[0-9a-f]{16}$/);
      assert.doesNotMatch(admittedLine.traceId, RAY);
    }
  });

  test('leaves the sign-in, the emails and the request\'s values out of the log and the answers (rule 5, rule 8)', async () => {
    const values = forbiddenValues([]);
    const owner = local.token();
    const someone = local.token({ email: 'someone@example.org' });
    const answers = [];
    for (const request of [
      list(signedIn(owner)),
      list(signedIn(someone)),
      list(signedIn(values.signInToken)),
      write(signedIn(owner, { 'Sec-Fetch-Site': 'cross-site', 'CF-Access-Client-Secret': values.secret })),
      list({ 'CF-Access-Client-Secret': values.secret, Cookie: `CF_Authorization=${owner}` }),
    ]) {
      answers.push((await sent(request)).answer);
    }
    const forbidden = { ...values, owner, someone, ownerEmail: OWNER_EMAIL, someoneEmail: 'someone@example.org', ownerPayload: owner.split('.')[1] };
    assertNoneIn(server.logText(), forbidden);
    for (const answer of answers) assertNoneIn(answer.text, forbidden);
    const fields = new Set(['time', 'traceId', 'requestId', 'method', 'action', 'sender', 'status', 'code', 'ms', 'reason', 'error', 'aborted']);
    for (const line of await server.logged(lines)) {
      for (const field of Object.keys(line)) assert.ok(fields.has(field), field);
      assert.ok(['owner', 'unknown'].includes(line.sender), line.sender);
      assert.match(line.traceId, TRACE_ID);
    }
  });
});

describe('an owner request when the gate\'s keys cannot be read', () => {
  test('gets internal, and the log says why without a token', async () => {
    const local = localGate();
    const failing = (code) => ({ key: async () => { throw new GateKeysError(code); } });
    for (const [keys, error] of [[failing('ENOTFOUND'), 'Error ENOTFOUND'], [failing(), 'Error']]) {
      const gate = createGate({ issuer: ISSUER, audience: local.audience, owner: OWNER_EMAIL, keys });
      let calls = 0;
      const server = await startServer({
        gate,
        routes: [{ method: 'GET', path: '/api/projects', action: 'listProjects', handle: () => { calls += 1; return { body: {} }; } }],
      });
      try {
        const token = local.token();
        const answer = await server.send({ path: '/api/projects', headers: { 'Cf-Access-Jwt-Assertion': token } });
        assert.equal(answer.status, 500);
        assert.equal(answer.json.code, 'internal');
        assert.equal(calls, 0);
        const [line] = await server.logged(1);
        assert.deepEqual([line.sender, line.code, line.reason, line.error], ['unknown', 'internal', 'keys_unavailable', error]);
        assertNoneIn(server.logText(), { token });
        // A sign-in that cannot be a token is refused without reading the keys.
        const none = await server.send({ path: '/api/projects' });
        assert.equal(none.json.code, 'unauthenticated');
      } finally {
        await server.close();
      }
    }
  });
});
