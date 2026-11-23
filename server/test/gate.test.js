// The gate's signing keys from the team's certs endpoint (gate.js; TASK-416). The endpoint is a function made here:
// no test reaches a gate or the network.

import assert from 'node:assert/strict';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { CERTS_PATH, createGate, createGateKeys, GateKeysError } from '../src/gate.js';
import { ISSUER, localGate, OWNER_EMAIL } from './support.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// A certs endpoint whose answers the test sets, which counts the requests it gets, and a clock the test moves.
function endpoint(answer) {
  const state = { requests: [], answer, time: 1_000_000 };
  state.now = () => state.time;
  state.fetch = async (url, options) => {
    state.requests.push({ url, options });
    const next = typeof state.answer === 'function' ? await state.answer() : state.answer;
    if (next instanceof Error) throw next;
    return new Response(typeof next === 'string' ? next : JSON.stringify(next), { status: next.status ?? 200 });
  };
  return state;
}

test('reads the keys from the issuer\'s certs endpoint and verifies a sign-in with them', async () => {
  const local = localGate();
  const certs = endpoint(local.certs());
  const keys = createGateKeys({ issuer: ISSUER, fetch: certs.fetch, now: certs.now });
  const gate = createGate({ issuer: ISSUER, audience: local.audience, owner: OWNER_EMAIL, keys });
  const claims = await gate.signIn({ 'cf-access-jwt-assertion': local.token() });
  assert.ok(gate.isOwner(claims));
  assert.equal(certs.requests.length, 1);
  const [{ url, options }] = certs.requests;
  assert.equal(url, `${ISSUER}${CERTS_PATH}`);
  assert.equal(url, 'https://gate.example.com/cdn-cgi/access/certs');
  // A redirect could lead the server to keys of another host.
  assert.equal(options.redirect, 'error');
  assert.ok(options.signal instanceof AbortSignal);
  // The key is public, whatever else the endpoint sends.
  assert.equal((await keys.key(local.kid)).type, 'public');
});

test('keeps the keys for an hour and asks again after it', async () => {
  const local = localGate();
  const certs = endpoint(local.certs());
  const keys = createGateKeys({ issuer: ISSUER, fetch: certs.fetch, now: certs.now });
  await keys.key(local.kid);
  certs.time += 59 * MINUTE;
  await keys.key(local.kid);
  assert.equal(certs.requests.length, 1);
  certs.time += 2 * MINUTE;
  await keys.key(local.kid);
  assert.equal(certs.requests.length, 2);
});

test('asks again for a kid it does not know, at most once in ten seconds', async () => {
  const local = localGate();
  const certs = endpoint(local.certs());
  const keys = createGateKeys({ issuer: ISSUER, fetch: certs.fetch, now: certs.now });
  const unknown = randomBytes(16).toString('hex');
  assert.equal(await keys.key(unknown), null);
  assert.equal(certs.requests.length, 1);
  for (let index = 0; index < 20; index += 1) assert.equal(await keys.key(randomBytes(16).toString('hex')), null);
  assert.equal(certs.requests.length, 1);
  // A key the gate began to sign with is read once the gap has passed.
  const next = localGate();
  certs.answer = { keys: [...local.certs().keys, ...next.certs().keys] };
  certs.time += 10 * 1000;
  assert.notEqual(await keys.key(next.kid), null);
  assert.equal(certs.requests.length, 2);
  assert.notEqual(await keys.key(local.kid), null);
});

test('asks once for requests that arrive together', async () => {
  const local = localGate();
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  const certs = endpoint(async () => {
    await held;
    return local.certs();
  });
  const keys = createGateKeys({ issuer: ISSUER, fetch: certs.fetch, now: certs.now });
  const waiting = Array.from({ length: 5 }, () => keys.key(local.kid));
  release();
  for (const key of await Promise.all(waiting)) assert.notEqual(key, null);
  assert.equal(certs.requests.length, 1);
});

test('fails with GateKeysError when it has no current keys, and keeps current ones through a failure', async () => {
  const local = localGate();
  const cause = Object.assign(new Error('getaddrinfo'), { code: 'ENOTFOUND' });
  const certs = endpoint(new TypeError('fetch failed', { cause }));
  const keys = createGateKeys({ issuer: ISSUER, fetch: certs.fetch, now: certs.now });
  await assert.rejects(keys.key(local.kid), (error) => error instanceof GateKeysError && error.code === 'ENOTFOUND');
  // Within the gap it does not ask again.
  await assert.rejects(keys.key(local.kid), GateKeysError);
  assert.equal(certs.requests.length, 1);
  certs.answer = local.certs();
  certs.time += 10 * 1000;
  assert.notEqual(await keys.key(local.kid), null);
  // The endpoint fails while the keys are current: a kid it could not be asked about is unknown, a known one answers.
  certs.answer = Object.assign(new Error('x'), { code: 'ECONNREFUSED' });
  certs.time += 10 * 1000;
  assert.equal(await keys.key(randomBytes(16).toString('hex')), null);
  assert.notEqual(await keys.key(local.kid), null);
  // Once they are an hour old, they are not used.
  certs.time += HOUR;
  await assert.rejects(keys.key(local.kid), GateKeysError);
});

test('refuses an answer that is not a set of RS256 keys of at least 2048 bits', async () => {
  const local = localGate();
  const jwk = local.certs().keys[0];
  const small = generateKeyPairSync('rsa', { modulusLength: 1024 }).publicKey.export({ format: 'jwk' });
  const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' }).publicKey.export({ format: 'jwk' });
  for (const answer of [
    { status: 404, keys: [jwk] },
    { status: 302, keys: [jwk] },
    'not json',
    'null',
    { keys: 'none' },
    { keys: [] },
    { keys: [{ ...jwk, kid: '' }] },
    { keys: [{ ...jwk, alg: 'RS512' }] },
    { keys: [{ ...jwk, use: 'enc' }] },
    { keys: [{ ...small, kid: local.kid }] },
    { keys: [{ ...ec, kid: local.kid }] },
    { keys: [{ ...jwk, n: 'not a modulus' }] },
    // Two keys with one kid would leave the token to choose.
    { keys: [jwk, { ...localGate().certs().keys[0], kid: local.kid }] },
    // An answer too large to be a set of keys.
    JSON.stringify({ keys: [jwk], padding: 'x'.repeat(70 * 1024) }),
  ]) {
    const certs = endpoint(answer);
    const keys = createGateKeys({ issuer: ISSUER, fetch: certs.fetch, now: certs.now });
    await assert.rejects(keys.key(local.kid), GateKeysError, JSON.stringify(answer).slice(0, 80));
  }
  // Keys the gate does not sign with are left out, and the others kept.
  const certs = endpoint({ keys: [{ ...ec, kid: 'ec' }, { ...small, kid: 'small' }, jwk] });
  const keys = createGateKeys({ issuer: ISSUER, fetch: certs.fetch, now: certs.now });
  assert.notEqual(await keys.key(local.kid), null);
  assert.equal(await keys.key('ec'), null);
  assert.equal(await keys.key('small'), null);
});
