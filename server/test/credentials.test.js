// Agent credentials (SPEC-049, SPEC-050, rule 1, rule 5, rule 8; TASK-417): the owner issues, lists and revokes them
// (API-279, API-280, API-281), the secret shows once and only its digest is kept, every agent request is checked by its
// CF-Access-Client-Id and -Secret pair, and revoking releases the credential's claims. Credential values are made at
// run time; no test holds one as a literal.

import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { idOf, keyOf } from '../src/ids.js';
import { ROUTES } from '../src/routes.js';
import { openStore } from '../src/store.js';
import { contract, validate } from './contract.js';
import { responseRecord } from './responses.js';
import {
  assertNoneIn, exchange, forbiddenValues, head, localGate, newId, startServer, testStore, TRACE_ID, waitFor,
} from './support.js';
import { checkLayer, checkTables, recordTables } from './tables.js';

const START = Date.parse('2026-11-23T01:00:00.000Z');
const MINUTE = 60_000;
const MiB = 1024 * 1024;
const SECRET = /^[A-Za-z0-9_-]{43}$/;
const JSON_TYPE = { 'Content-Type': 'application/json' };
const ACTIONS = ['listCredentials', 'issueCredential', 'revokeCredential'];

// A store in a data folder of its own, for a suite: { db, remove() }.
function suiteStore() {
  const folder = mkdtempSync(join(tmpdir(), 'nexus-credentials-'));
  const { db } = openStore(folder);
  return {
    db,
    remove() {
      db.close();
      rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
    },
  };
}

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest();
const key = () => ({ 'Idempotency-Key': `"${newId('nw')}"` });
const at = (ms) => new Date(ms).toISOString();

describe('agent credentials', () => {
  const responses = responseRecord();
  // Every secret the tests were shown, so that the log, the answers and the store can be searched for it.
  const shown = [];
  const agentCalls = [];
  let opened;
  let recorder;
  let local;
  let server;
  let lines = 0;
  const clock = { now: START };
  // A write that holds the queue until the test lets it go: { started, release(work) }.
  let hold = null;

  before(async () => {
    opened = suiteStore();
    recorder = recordTables(opened.db);
    local = localGate();
    server = await startServer({
      store: recorder.store,
      gate: local.gate,
      now: () => clock.now,
      routes: [
        ...ROUTES,
        // Agent operations at addresses of the tests' own, which answer who sent them.
        {
          method: 'GET',
          path: '/test/agent',
          action: 'getAgentTodo',
          handle: ({ caller, credential }) => {
            agentCalls.push(['read', caller]);
            return { body: { caller, name: credential.name, id: credential.id } };
          },
        },
        {
          method: 'POST',
          path: '/test/agent',
          action: 'claimEntry',
          body: 'json',
          handle: ({ caller }) => {
            agentCalls.push(['write', caller]);
            return { body: { caller } };
          },
        },
        // A write of no operation that waits until the test runs work() in its transaction and lets it go.
        {
          method: 'POST',
          path: '/test/hold',
          action: 'testHold',
          family: 'none',
          handle: () => new Promise((resolve) => {
            hold.started = true;
            hold.release = (work) => {
              work();
              resolve({ body: { held: true } });
            };
          }),
        },
      ],
    });
  });

  after(async () => {
    await server.close();
    opened.remove();
  });

  // Sends a request and returns its answer and its log line. action, when given, is the operation whose response the
  // contract must list.
  async function sent(request, action) {
    const answer = await server.send({ ...request, headers: clean(request.headers ?? {}) });
    lines += 1;
    const line = (await server.logged(lines)).at(-1);
    if (action !== undefined) responses.note(action, answer);
    return { answer, line };
  }

  const owner = (headers = {}) => ({ 'Cf-Access-Jwt-Assertion': local.token(), ...headers });
  const pair = (credential, secret) => ({ 'CF-Access-Client-Id': credential.id, 'CF-Access-Client-Secret': secret });
  const list = (headers = owner()) => sent({ path: '/api/credentials', headers }, 'listCredentials');
  const issue = (name, headers = {}) => sent({
    method: 'POST',
    path: '/api/credentials',
    headers: { ...JSON_TYPE, ...owner(), ...key(), ...headers },
    body: typeof name === 'string' ? JSON.stringify({ name }) : JSON.stringify(name),
  }, 'issueCredential');
  const revoke = (id, headers = {}, body = '{}') => sent({
    method: 'POST',
    path: `/api/credentials/${id}/revoke`,
    headers: { ...JSON_TYPE, ...owner(), ...key(), ...headers },
    body,
  }, 'revokeCredential');
  const agentRead = (headers) => sent({ path: '/test/agent', headers });
  const row = (id) => ({ ...opened.db.prepare('SELECT * FROM agent_credentials WHERE id = ?').get(keyOfId(id)) });

  // A new credential: { credential, secret }.
  async function issued(name = `agent-${randomBytes(4).toString('hex')}`) {
    const { answer } = await issue(name);
    assert.equal(answer.status, 201, answer.text);
    shown.push(answer.json.secret);
    return answer.json;
  }

  test('issues a credential whose secret shows once, keeping only its digest (SPEC-049)', async () => {
    const requestKey = key();
    const { answer, line } = await issue('laptop', requestKey);
    assert.equal(answer.status, 201);
    assert.equal(answer.headers['cache-control'], 'no-store');
    const { credential, secret } = answer.json;
    shown.push(secret);
    assert.match(secret, SECRET);
    assert.deepEqual({ ...credential, id: undefined }, {
      id: undefined, name: 'laptop', issued_at: at(START), revoked_at: null, last_used_at: null,
    });
    assert.deepEqual([line.sender, line.code, line.action], ['owner', null, 'issueCredential']);
    // The store keeps the secret's SHA-256 only.
    const stored = row(credential.id);
    assert.equal(stored.name, 'laptop');
    assert.equal(stored.secret_digest, sha256(secret).toString('hex'));
    assert.notEqual(stored.secret_digest, secret);
    // The same request again, as after a reload: the same credential, and no secret.
    const again = await issue('laptop', requestKey);
    assert.equal(again.answer.status, 200);
    assert.deepEqual(again.answer.json, { credential, secret: null });
    // Its request key keeps the answer without the secret.
    const kept = opened.db.prepare('SELECT answer FROM request_keys WHERE request_key = ?').get(requestKey['Idempotency-Key'].slice(1, -1));
    assert.deepEqual(JSON.parse(kept.answer), { credential, secret: null });
    // A new secret each time.
    const other = await issued('desktop');
    assert.notEqual(other.secret, secret);
    assert.notEqual(other.credential.id, credential.id);
  });

  test('refuses a name in use, revoked or not, and keeps the first (SPEC-049)', async () => {
    const before = count();
    const { answer, line } = await issue('laptop');
    assert.equal(answer.status, 409);
    assert.equal(answer.json.code, 'name_taken');
    assert.deepEqual([line.sender, line.code], ['owner', 'name_taken']);
    const revoked = await issued('old-phone');
    assert.equal((await revoke(revoked.credential.id)).answer.status, 200);
    assert.equal((await issue('old-phone')).answer.json.code, 'name_taken');
    // Names are kept as given, so another case is another name.
    await issued('LAPTOP');
    assert.equal(count(), before + 2);
  });

  test('refuses a name that is empty, over 64 characters or not text, naming the field only', async () => {
    const before = count();
    const long = 'n'.repeat(65);
    for (const [body, field] of [
      [{}, 'name'],
      [{ name: '' }, 'name'],
      [{ name: '   \t ' }, 'name'],
      [{ name: long }, 'name'],
      [{ name: '\u{1F511}'.repeat(65) }, 'name'],
      [{ name: 42 }, 'name'],
      [{ name: null }, 'name'],
      [{ name: ['laptop'] }, 'name'],
      [{ name: '\ud800laptop' }, 'name'],
      [{ name: 'laptop', [`extra-${long}`]: true }, 'body'],
      [JSON.parse('{"name":"laptop","__proto__":{}}'), 'body'],
    ]) {
      const { answer } = await issue(body);
      assert.equal(answer.status, 400, JSON.stringify(body));
      assert.deepEqual([answer.json.code, answer.json.field], ['invalid_request', field]);
      assert.equal(answer.text.includes(long), false, 'the detail repeats the value');
    }
    // 64 characters are taken, counted as characters, not UTF-16 units or bytes.
    for (const name of ['n'.repeat(64), '\u{1F511}'.repeat(64), ' a ']) {
      const { answer } = await issue(name);
      assert.equal(answer.status, 201, name);
      assert.equal(answer.json.credential.name, name);
      shown.push(answer.json.secret);
    }
    assert.equal(count(), before + 3);
  });

  test('refuses a body that is not JSON, too large or without its request key', async () => {
    const before = count();
    const headers = { ...owner(), ...key() };
    const wrongType = await sent({ method: 'POST', path: '/api/credentials', headers: { ...headers, 'Content-Type': 'text/plain' }, body: '{"name":"x"}' }, 'issueCredential');
    assert.equal(wrongType.answer.json.code, 'json_required');
    const broken = await sent({ method: 'POST', path: '/api/credentials', headers: { ...JSON_TYPE, ...owner(), ...key() }, body: '{"name":' }, 'issueCredential');
    assert.deepEqual([broken.answer.json.code, broken.answer.json.field], ['invalid_request', 'body']);
    const unkeyed = await sent({ method: 'POST', path: '/api/credentials', headers: { ...JSON_TYPE, ...owner() }, body: '{"name":"y"}' }, 'issueCredential');
    assert.deepEqual([unkeyed.answer.json.code, unkeyed.answer.json.field], ['invalid_request', 'Idempotency-Key']);
    for (const path of ['/api/credentials', `/api/credentials/${idOf('ac', 1)}/revoke`]) {
      const { answers } = await exchange(server.port, [head('POST', path, { ...JSON_TYPE, ...owner(), ...key(), 'Content-Length': 2 * MiB + 1 })]);
      lines += 1;
      assert.equal(answers.length, 1);
      responses.note(path.endsWith('revoke') ? 'revokeCredential' : 'issueCredential', answers[0]);
      assert.deepEqual([answers[0].status, answers[0].json.code, answers[0].json.limit], [413, 'body_too_large', 2 * MiB]);
    }
    const revokeType = await revoke(idOf('ac', 1), { 'Content-Type': 'text/plain' });
    assert.equal(revokeType.answer.json.code, 'json_required');
    assert.equal(count(), before);
    assert.equal(row(idOf('ac', 1)).revoked_at, null);
  });

  test('refuses a request key used for another request', async () => {
    const requestKey = key();
    const first = await issued();
    const { answer } = await issue('first-of-key', requestKey);
    assert.equal(answer.status, 201);
    shown.push(answer.json.secret);
    const reused = await issue('second-of-key', requestKey);
    assert.equal(reused.answer.json.code, 'request_key_reused');
    const otherAction = await revoke(first.credential.id, requestKey);
    assert.equal(otherAction.answer.json.code, 'request_key_reused');
    assert.equal(row(first.credential.id).revoked_at, null);
  });

  test('lists the credentials with names and times only, live ones first (API-279)', async () => {
    const { answer, line } = await list();
    assert.equal(answer.status, 200);
    assert.equal(line.sender, 'owner');
    const listed = answer.json.credentials;
    const rows = opened.db.prepare('SELECT * FROM agent_credentials').all();
    assert.equal(listed.length, rows.length);
    for (const credential of listed) assert.deepEqual(Object.keys(credential), ['id', 'name', 'issued_at', 'revoked_at', 'last_used_at']);
    const live = listed.filter((credential) => credential.revoked_at === null);
    assert.ok(live.length > 0 && live.length < listed.length);
    assert.deepEqual(listed.slice(0, live.length), live, 'live credentials come first');
    for (const part of [live, listed.slice(live.length)]) {
      const ids = part.map((credential) => keyOfId(credential.id));
      assert.deepEqual(ids, [...ids].sort((one, other) => other - one), 'newest first');
    }
    for (const { secret_digest: digest } of rows) assert.equal(answer.text.includes(digest), false, 'the list holds a digest');
  });

  test('admits an agent request with a live pair, sent by the credential\'s name (rule 8)', async () => {
    const { credential, secret } = await issued('ci-runner');
    const ray = `${randomBytes(8).toString('hex')}-ICN`;
    const { answer, line } = await agentRead({ ...pair(credential, secret), 'CF-Ray': ray });
    assert.equal(answer.status, 200, answer.text);
    // The request key's caller is the credential's ID, the log's sender its name.
    assert.deepEqual(answer.json, { caller: credential.id, name: 'ci-runner', id: credential.id });
    assert.deepEqual([line.sender, line.code, line.reason, line.traceId], ['ci-runner', null, undefined, ray]);
    const write = await sent({ method: 'POST', path: '/test/agent', headers: { ...JSON_TYPE, ...pair(credential, secret) }, body: '{}' });
    assert.deepEqual(write.answer.json, { caller: credential.id });
    assert.equal(write.line.sender, 'ci-runner');
    // The owner's sign-in beside a live pair does not change who sent it.
    const both = await agentRead({ ...pair(credential, secret), ...owner() });
    assert.equal(both.line.sender, 'ci-runner');
  });

  test('BUG-008: accepts either complete agent header pair and refuses ambiguous pairs', async () => {
    const { credential, secret } = await issued('alternate-headers');
    const modern = { 'Nexus-Agent-Client-Id': credential.id, 'Nexus-Agent-Client-Secret': secret };
    const legacy = pair(credential, secret);
    for (const headers of [legacy, modern]) {
      const { answer } = await agentRead(headers);
      assert.equal(answer.status, 200);
    }
    for (const headers of [
      { 'Nexus-Agent-Client-Id': credential.id },
      { 'Nexus-Agent-Client-Secret': secret },
      { 'Nexus-Agent-Client-Id': credential.id, 'CF-Access-Client-Secret': secret },
      { ...legacy, ...modern },
      { ...modern, 'CF-Access-Client-Id': credential.id },
      { ...modern, 'CF-Access-Client-Id': '' },
      { ...modern, ...pair({ id: newId('ac') }, secret) },
      { ...modern, ...pair(credential, randomBytes(32).toString('base64url')) },
      { ...modern, 'Nexus-Agent-Client-Id': [credential.id, credential.id] },
      { ...modern, 'Nexus-Agent-Client-Secret': `${secret}, ${secret}` },
      { ...modern, 'Nexus-Agent-Client-Secret': 'invalid' },
    ]) {
      const { answer, line } = await agentRead(headers);
      assert.equal(answer.status, 401);
      assert.equal(answer.json.code, 'access_missing');
      assert.equal(line.reason, 'malformed');
    }
    const ownerAttempt = await sent({ method: 'GET', path: '/api/credentials', headers: modern });
    assert.equal(ownerAttempt.answer.status, 403);
    assert.equal(ownerAttempt.answer.json.code, 'owner_only');
    await revoke(credential.id);
    const revoked = await agentRead(modern);
    assert.equal(revoked.answer.status, 401);
    assert.equal(revoked.line.reason, 'revoked');
  });

  test('marks a credential used, at most once a minute, and shows it in the list', async () => {
    const { credential, secret } = await issued('marked');
    assert.equal(row(credential.id).last_used_at, null);
    await agentRead(pair(credential, secret));
    await waitFor(() => row(credential.id).last_used_at === at(clock.now));
    const first = clock.now;
    clock.now += 30_000;
    await agentRead(pair(credential, secret));
    clock.now += 31_000;
    await agentRead(pair(credential, secret));
    await waitFor(() => row(credential.id).last_used_at === at(clock.now));
    assert.notEqual(row(credential.id).last_used_at, at(first + 30_000));
    const { answer } = await list();
    assert.equal(answer.json.credentials.find((each) => each.id === credential.id).last_used_at, at(clock.now));
  });

  test('refuses an agent request without a live pair with access_missing, whatever was wrong', async () => {
    const { credential, secret } = await issued('refused');
    const revoked = await issued('revoked-one');
    await revoke(revoked.credential.id);
    const handled = agentCalls.length;
    const unknown = newId('ac');
    for (const [headers, reason] of [
      [{}, 'no_credential'],
      [{ 'CF-Access-Client-Id': credential.id }, 'malformed'],
      [{ 'CF-Access-Client-Secret': secret }, 'malformed'],
      [pair({ id: credential.id.toUpperCase() }, secret), 'malformed'],
      [pair({ id: `${credential.id}0` }, secret), 'malformed'],
      [pair({ id: `ac_${randomBytes(8).toString('hex')}` }, secret), 'malformed'],
      [pair(credential, `${secret}=`), 'malformed'],
      [pair(credential, secret.slice(1)), 'malformed'],
      [pair(credential, `${secret}, ${secret}`), 'malformed'],
      [{ 'CF-Access-Client-Id': [credential.id, credential.id], 'CF-Access-Client-Secret': secret }, 'malformed'],
      [pair({ id: unknown }, secret), 'unknown_credential'],
      // An ID in its form whose key the store cannot hold names no credential either.
      [pair({ id: idOf('ac', Number.MAX_SAFE_INTEGER).replace(/^ac_./, 'ac_z') }, secret), 'unknown_credential'],
      [pair({ id: `ac_${'0'.repeat(12)}` }, secret), 'unknown_credential'],
      [pair(credential, randomBytes(32).toString('base64url')), 'wrong_secret'],
      [pair(credential, revoked.secret), 'wrong_secret'],
      [pair(revoked.credential, revoked.secret), 'revoked'],
      // Another person's sign-in, or one that is not valid, is no credential either.
      [owner({ 'Cf-Access-Jwt-Assertion': local.token({ email: 'someone@example.org' }) }), 'no_credential'],
      [{ 'Cf-Access-Jwt-Assertion': 'not a sign-in' }, 'no_credential'],
    ]) {
      for (const send of [
        () => agentRead(headers),
        () => sent({ method: 'POST', path: '/test/agent', headers: { ...JSON_TYPE, ...headers }, body: '{}' }),
      ]) {
        const { answer, line } = await send();
        assert.equal(answer.status, 401, reason);
        assert.equal(answer.json.code, 'access_missing');
        assert.equal(answer.json.detail, 'this request carries no valid agent credential');
        assert.deepEqual([line.sender, line.code, line.reason], ['unknown', 'access_missing', reason]);
        assert.match(answer.json.traceId, /^[0-9a-f]{16}$/);
      }
    }
    assert.equal(agentCalls.length, handled, 'a refused request reached its handler');
  });

  test('refuses the owner\'s sign-in on an agent operation with agent_only', async () => {
    const handled = agentCalls.length;
    for (const send of [
      () => agentRead(owner()),
      () => sent({ method: 'POST', path: '/test/agent', headers: { ...JSON_TYPE, ...owner() }, body: '{}' }),
    ]) {
      const { answer, line } = await send();
      assert.equal(answer.status, 403);
      assert.equal(answer.json.code, 'agent_only');
      assert.deepEqual([line.sender, line.code, line.reason], ['owner', 'agent_only', 'no_credential']);
    }
    assert.equal(agentCalls.length, handled);
  });

  test('refuses a live credential on the owner\'s operations with owner_only, sent by its name (rule 1)', async () => {
    const { credential, secret } = await issued('wrong-door');
    const target = await issued('target');
    const before = count();
    for (const send of [
      () => list(pair(credential, secret)),
      () => issue('by-an-agent', { 'Cf-Access-Jwt-Assertion': undefined, ...pair(credential, secret) }),
      () => revoke(target.credential.id, { 'Cf-Access-Jwt-Assertion': undefined, ...pair(credential, secret) }),
    ]) {
      const { answer, line } = await send();
      assert.equal(answer.status, 403);
      assert.equal(answer.json.code, 'owner_only');
      assert.deepEqual([line.sender, line.code, line.reason], ['wrong-door', 'owner_only', 'no_sign_in']);
    }
    // A pair that is not live is no credential: the request has no sign-in.
    const revoked = await issued('revoked-at-the-door');
    await revoke(revoked.credential.id);
    for (const headers of [pair(revoked.credential, revoked.secret), pair(credential, randomBytes(32).toString('base64url'))]) {
      const { answer, line } = await list(headers);
      assert.deepEqual([answer.status, answer.json.code, line.sender], [401, 'unauthenticated', 'unknown']);
    }
    assert.equal(count(), before + 1);
    assert.equal(row(target.credential.id).revoked_at, null);
  });

  test('refuses requests without the owner\'s sign-in, of another person or from another site', async () => {
    const target = await issued('kept');
    const someone = { 'Cf-Access-Jwt-Assertion': local.token({ email: 'someone@example.org' }) };
    for (const [headers, status, code] of [
      [{ 'Cf-Access-Jwt-Assertion': undefined }, 401, 'unauthenticated'],
      [someone, 403, 'not_owner'],
    ]) {
      assert.equal((await list(headers['Cf-Access-Jwt-Assertion'] === undefined ? {} : headers)).answer.json.code, code);
      const issuing = await issue('refused-name', headers);
      assert.deepEqual([issuing.answer.status, issuing.answer.json.code], [status, code]);
      const revoking = await revoke(target.credential.id, headers);
      assert.deepEqual([revoking.answer.status, revoking.answer.json.code], [status, code]);
    }
    for (const site of ['cross-site', 'same-site']) {
      const issuing = await issue('cross-site-name', { 'Sec-Fetch-Site': site });
      assert.equal(issuing.answer.json.code, 'cross_site');
      const revoking = await revoke(target.credential.id, { 'Sec-Fetch-Site': site });
      assert.equal(revoking.answer.json.code, 'cross_site');
    }
    assert.equal(opened.db.prepare("SELECT count(*) AS n FROM agent_credentials WHERE name LIKE '%-name'").get().n, 0);
    assert.equal(row(target.credential.id).revoked_at, null);
  });

  test('revokes a credential, releases its live claims and refuses its next request (SPEC-050)', async () => {
    const { credential, secret } = await issued('to-revoke');
    const other = await issued('stays');
    const claims = seedClaims([
      [credential, null], [credential, null], [credential, 'released'], [other.credential, null],
    ]);
    assert.equal((await agentRead(pair(credential, secret))).answer.status, 200);
    clock.now += MINUTE;
    const requestKey = key();
    const { answer, line } = await revoke(credential.id, requestKey);
    assert.equal(answer.status, 200);
    assert.deepEqual([line.sender, line.code], ['owner', null]);
    assert.equal(answer.json.changed, true);
    assert.equal(answer.json.claims_released, 2);
    assert.equal(answer.json.credential.revoked_at, at(clock.now));
    assert.equal(answer.json.credential.name, 'to-revoke');
    const released = (id) => opened.db.prepare('SELECT released_at, release_reason FROM claims WHERE id = ?').get(id);
    assert.deepEqual({ ...released(claims[0]) }, { released_at: at(clock.now), release_reason: 'revoked' });
    assert.deepEqual({ ...released(claims[1]) }, { released_at: at(clock.now), release_reason: 'revoked' });
    assert.equal(released(claims[2]).release_reason, 'released');
    assert.deepEqual({ ...released(claims[3]) }, { released_at: null, release_reason: null });
    // Its next request is refused.
    const next = await agentRead(pair(credential, secret));
    assert.deepEqual([next.answer.status, next.answer.json.code, next.line.reason], [401, 'access_missing', 'revoked']);
    // The same request again answers the first answer; revoked again, nothing changes.
    clock.now += MINUTE;
    const repeat = await revoke(credential.id, requestKey);
    assert.deepEqual(repeat.answer.json, answer.json);
    // Revoked again, nothing changes, not even a claim: this one is seeded behind the rule-4 recheck, which keeps a
    // revoked credential from taking one, so that a repeat that touched claims would show.
    const [stray] = seedClaims([[credential, null]]);
    const again = await revoke(credential.id);
    assert.deepEqual(again.answer.json, { credential: answer.json.credential, changed: false, claims_released: 0 });
    assert.equal(row(credential.id).revoked_at, answer.json.credential.revoked_at);
    assert.deepEqual({ ...released(stray) }, { released_at: null, release_reason: null });
    assert.equal((await agentRead(pair(other.credential, other.secret))).answer.status, 200);
  });

  test('refuses a revoke of no credential, or with a body that is not {}', async () => {
    const target = await issued('revoke-target');
    for (const id of [newId('ac'), idOf('ac', 999_999), 'ac_0', 'laptop', `${target.credential.id}x`, encodeURIComponent('ac_../x')]) {
      const { answer } = await revoke(id);
      assert.deepEqual([answer.status, answer.json.code], [404, 'credential_not_found'], id);
      assert.equal(answer.text.includes(id), false);
    }
    for (const body of ['{"reason":"lost"}', '{"credential":"x"}']) {
      const { answer } = await revoke(target.credential.id, {}, body);
      assert.deepEqual([answer.status, answer.json.code, answer.json.field], [400, 'invalid_request', 'body']);
    }
    const notJson = await revoke(target.credential.id, {}, '[]');
    assert.deepEqual([notJson.answer.json.code, notJson.answer.json.field], ['invalid_request', 'body']);
    assert.equal(row(target.credential.id).revoked_at, null);
  });

  test('refuses an agent write that waited behind its credential\'s revocation (rule 4)', async () => {
    const { credential, secret } = await issued('waiting');
    hold = { started: false };
    const held = server.send({ method: 'POST', path: '/test/hold' });
    await waitFor(() => hold.started);
    // The agent's write is admitted while its credential is live, then waits behind the held write.
    const runs = recorder.runs();
    const write = server.send({ method: 'POST', path: '/test/agent', headers: { ...JSON_TYPE, ...pair(credential, secret) }, body: '{}' });
    await waitFor(() => recorder.runs() > runs);
    const handled = agentCalls.length;
    // The write before it revokes the credential.
    hold.release(() => {
      opened.db.prepare('UPDATE agent_credentials SET revoked_at = ? WHERE id = ?').run(at(clock.now), keyOfId(credential.id));
    });
    assert.equal((await held).status, 200);
    const answer = await write;
    lines += 2;
    assert.deepEqual([answer.status, answer.json.code], [401, 'access_missing']);
    assert.equal(agentCalls.length, handled, 'the refused write reached its handler');
    const line = (await server.logged(lines)).find((each) => each.traceId === answer.json.traceId);
    assert.deepEqual([line.sender, line.code, line.reason], ['unknown', 'access_missing', 'revoked']);
  });

  test('keeps no plain secret in the store, and no secret or digest in the log or an answer (rule 5)', async () => {
    assert.ok(shown.length >= 10);
    const forbidden = {};
    for (const [index, secret] of shown.entries()) {
      const digest = sha256(secret);
      Object.assign(forbidden, {
        [`secret${index}`]: secret,
        [`digestHex${index}`]: digest.toString('hex'),
        [`digestBase64${index}`]: digest.toString('base64'),
        [`digestBase64url${index}`]: digest.toString('base64url'),
      });
    }
    assertNoneIn(server.logText(), { ...forbidden, ...forbiddenValues([]) });
    const { answer } = await list();
    assertNoneIn(answer.text, forbidden);
    // Every text of every row of every table, and the store's file, hold no secret.
    const tables = opened.db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all().map((each) => each.name);
    const text = tables.map((table) => JSON.stringify(opened.db.prepare(`SELECT * FROM "${table}"`).all())).join('\n');
    const file = readFileSync(opened.db.location()).toString('latin1');
    for (const secret of shown) {
      assert.equal(text.includes(secret), false, 'a table holds a secret');
      assert.equal(file.includes(secret), false, 'the store file holds a secret');
    }
    const fields = new Set(['time', 'traceId', 'method', 'action', 'sender', 'status', 'code', 'ms', 'reason', 'error', 'aborted']);
    for (const line of await server.logged(lines)) {
      for (const field of Object.keys(line)) assert.ok(fields.has(field), field);
      assert.match(line.traceId, TRACE_ID);
    }
  });

  test('answers internal when the store fails', async (t) => {
    const store = testStore(t);
    // A store whose credential statements cannot be prepared, as when the disk fails.
    const failing = new Proxy(store, {
      get(target, name) {
        const value = Reflect.get(target, name, target);
        if (name === 'prepare') {
          return (sql) => {
            if (sql.includes('agent_credentials')) throw new Error('the store failed');
            return target.prepare(sql);
          };
        }
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const broken = await startServer({ store: failing, gate: local.gate, routes: ROUTES });
    t.after(() => broken.close());
    for (const [action, request] of [
      ['listCredentials', { path: '/api/credentials', headers: owner() }],
      ['issueCredential', { method: 'POST', path: '/api/credentials', headers: { ...JSON_TYPE, ...owner(), ...key() }, body: '{"name":"x"}' }],
      ['revokeCredential', { method: 'POST', path: `/api/credentials/${idOf('ac', 1)}/revoke`, headers: { ...JSON_TYPE, ...owner(), ...key() }, body: '{}' }],
    ]) {
      const answer = await broken.send(request);
      responses.note(action, answer);
      assert.deepEqual([answer.status, answer.json.code], [500, 'internal']);
    }
    const logged = await broken.logged(3);
    assert.deepEqual(logged.map((line) => line.error), ['Error', 'Error', 'Error']);
    assert.equal(broken.logText().includes('the store failed'), false);
  });

  test('answer every response API-279, API-280 and API-281 list', () => {
    for (const action of ACTIONS) responses.assertEvery(action);
  });

  test('touch the tables their x-corthex.tables lists, and admission only the layer\'s (note 23)', () => {
    checkTables(recorder, 'listCredentials');
    checkTables(recorder, 'issueCredential');
    checkTables(recorder, 'revokeCredential');
    checkLayer(recorder);
  });

  // The number of credentials.
  function count() {
    return Number(opened.db.prepare('SELECT count(*) AS n FROM agent_credentials').get().n);
  }

  // Claims of the given credentials, each on a to-do of its own, released when the second value says so; returns their
  // row IDs.
  function seedClaims(specs) {
    const db = opened.db;
    const time = at(clock.now);
    const project = db.prepare("INSERT INTO project_spaces (name, created_at, created_by_credential) VALUES (?, ?, ?)")
      .run(`claims-${randomBytes(4).toString('hex')}`, time, keyOfId(specs[0][0].id)).lastInsertRowid;
    return specs.map(([credential, released], index) => {
      const diagram = db.prepare("INSERT INTO diagrams (project_id, stage, source_key, kind, name, created_at) VALUES (?, '05-erd', ?, 'erd', 'ERD', ?)")
        .run(project, `db/${index}.sql`, time).lastInsertRowid;
      const todo = db.prepare("INSERT INTO todos (project_id, side, kind, diagram_id, created_at) VALUES (?, 'agent', 'reflect', ?, ?)")
        .run(project, diagram, time).lastInsertRowid;
      return Number(db.prepare('INSERT INTO claims (project_id, todo_id, session, credential_id, claimed_at, last_write_at, released_at, release_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(project, todo, `session-${index}`, keyOfId(credential.id), time, time, released === null ? null : time, released).lastInsertRowid);
    });
  }
});

// The row key of a credential's ID.
function keyOfId(id) {
  return keyOf('ac', id);
}

// Headers without those set to undefined, which a test leaves out.
function clean(headers) {
  return Object.fromEntries(Object.entries(headers).filter(([, value]) => value !== undefined));
}

test('the contract\'s examples of the three operations validate, so the answers are checked against real schemas', () => {
  for (const [schema, value] of [
    ['CredentialList', { credentials: [] }],
    ['IssuedCredential', { credential: { id: idOf('ac', 7), name: 'x', issued_at: at(START), revoked_at: null, last_used_at: null }, secret: null }],
  ]) {
    assert.deepEqual(validate(contract, value, { $ref: `#/components/schemas/${schema}` }), []);
  }
  assert.notDeepEqual(validate(contract, { credentials: [{ id: 'nope' }] }, { $ref: '#/components/schemas/CredentialList' }), []);
});
