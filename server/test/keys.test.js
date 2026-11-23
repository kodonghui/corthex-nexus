// Request keys (rule 3, TASK-415): a key sent again with the same body gets the first answer and writes nothing,
// with another body request_key_reused; keys belong to their caller, last 7 days and are left only by stored writes.

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { REQUEST_KEY } from '../src/keys.js';
import { Problem } from '../src/problem.js';
import { createWrites } from '../src/writes.js';
import { contract } from './contract.js';
import { localGate, newId, startServer, testStore } from './support.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const START = Date.parse('2026-11-23T01:30:00.000Z');
const KEY_ID = newId('nw');
const KEY = `"${KEY_ID}"`;
const OTHER_KEY_ID = newId('nw');
const AGENT = newId('ac');
// A server whose writes record each run and add a row to a table, so a test can count what was written. Its writes
// are the owner's, admitted by the owner's sign-in (TASK-416), so the owner is the caller their keys belong to.
async function keyServer(t) {
  const store = testStore(t);
  const local = localGate();
  const json = (key = KEY) => ({
    'Content-Type': 'application/json',
    'Cf-Access-Jwt-Assertion': local.token(),
    ...(key === null ? {} : { 'Idempotency-Key': key }),
  });
  const clock = { now: START };
  const ran = [];
  const addRow = (name) => store.prepare("INSERT INTO backups (name, attempt, state, started_at) VALUES (?, 1, 'running', ?)")
    .run(name, new Date(clock.now).toISOString());
  const write = (action, path, handle, extra = {}) => ({
    method: 'POST', path, action, params: path.includes('{project}') ? { project: 'project_not_found' } : {},
    body: 'json', requestKey: true, handle, ...extra,
  });
  const server = await startServer({
    store,
    gate: local.gate,
    now: () => clock.now,
    routes: [
      write('addToolLink', '/api/projects/{project}/tool-links', async ({ params, body }) => {
        ran.push(['addToolLink', body.name]);
        addRow(`${params.project}/${body.name}/${ran.length}`);
        if (body.wait) await delay(body.wait);
        return { status: 201, body: { id: ran.length, name: body.name } };
      }),
      write('openWorkshop', '/api/projects/{project}/workshop', ({ body }) => {
        ran.push(['openWorkshop', body.name]);
        return { status: 201, body: { id: ran.length } };
      }),
      write('confirmStep', '/api/projects/{project}/refused', ({ body }) => {
        ran.push(['confirmStep', body.name]);
        addRow(`refused/${ran.length}`);
        throw new Problem('step_empty');
      }),
      write('closeThread', '/api/projects/{project}/fails', ({ body }) => {
        ran.push(['closeThread', body.name]);
        addRow(`fails/${ran.length}`);
        throw new Error('broken');
      }),
      write('replyInThread', '/api/projects/{project}/returns', ({ body }) => {
        ran.push(['replyInThread', body.name]);
        addRow(`returns/${ran.length}`);
        return { status: 409, body: { refused: true } };
      }),
      write('issueCredential', '/api/credentials', ({ body }) => {
        ran.push(['issueCredential', body.name]);
        return { status: 201, body: { id: AGENT, name: body.name, secret: randomBytes(24).toString('base64url') } };
      }, { repeat: ({ body }) => ({ status: 200, body: { ...body, secret: null } }) }),
    ],
  });
  t.after(() => server.close());
  const count = (table) => Number(store.prepare(`SELECT count(*) AS n FROM ${table}`).get().n);
  const keys = () => store.prepare('SELECT actor, request_key, action, status_code, answer, created_at FROM request_keys ORDER BY created_at')
    .all().map((row) => ({ ...row }));
  const post = (path, body, headers = json()) => server.send({ method: 'POST', path, headers, body: JSON.stringify(body) });
  return { server, store, clock, ran, count, keys, post, json };
}

test('the request key is the contract\'s Idempotency-Key', () => {
  const header = contract.components.parameters.IdempotencyKey;
  assert.deepEqual([header.name, header.in, header.required], ['Idempotency-Key', 'header', true]);
  assert.equal(REQUEST_KEY.source.replace('(', '').replace(')', ''), header.schema.pattern);
  assert.match(header.description, /within 7 days/);
});

test('a key sent again with the same body gets the first answer and writes nothing', async (t) => {
  const { ran, count, keys, post } = await keyServer(t);
  const first = await post('/api/projects/demo/tool-links', { name: 'a' });
  assert.equal(first.status, 201);
  const again = await post('/api/projects/demo/tool-links', { name: 'a' });
  assert.equal(again.status, 201);
  assert.deepEqual(again.json, first.json);
  assert.equal(ran.length, 1);
  assert.equal(count('backups'), 1);
  // The key's row: the caller, the key without its quotes, the operation and the SHA-256 of its path and body.
  const [row] = keys();
  assert.deepEqual(
    { ...row, action: row.action.replace(/[0-9a-f]{64}$/, 'DIGEST') },
    {
      actor: 'owner', request_key: KEY_ID, action: 'addToolLink DIGEST', status_code: 201,
      answer: JSON.stringify(first.json), created_at: new Date(START).toISOString(),
    },
  );
});

test('a key sent again with another body, path or action gets request_key_reused and writes nothing', async (t) => {
  const { server, ran, count, keys, post, json } = await keyServer(t);
  assert.equal((await post('/api/projects/demo/tool-links', { name: 'a' })).status, 201);
  const before = keys();
  for (const [path, body] of [
    ['/api/projects/demo/tool-links', { name: 'b' }],
    ['/api/projects/demo/tool-links', { name: 'a', other: true }],
    ['/api/projects/other/tool-links', { name: 'a' }],
    ['/api/projects/demo/workshop', { name: 'a' }],
  ]) {
    const answer = await post(path, body);
    assert.equal(answer.status, 409, `${path} ${JSON.stringify(body)}`);
    assert.equal(answer.json.code, 'request_key_reused');
    assert.equal(answer.json.detail, 'this request key was used for another action');
  }
  // The same JSON in other bytes is another body.
  const spaced = await server.send({ method: 'POST', path: '/api/projects/demo/tool-links', headers: json(), body: '{ "name": "a" }' });
  assert.equal(spaced.json.code, 'request_key_reused');
  assert.equal(ran.length, 1);
  assert.equal(count('backups'), 1);
  assert.deepEqual(keys(), before);
});

test('a key belongs to its caller', async (t) => {
  // Only the owner is admitted until TASK-417 checks agent credentials, so the writes are given to the write layer as
  // admission would give them: the owner's, and an agent credential's under its ID.
  const store = testStore(t);
  const write = createWrites({ store, now: () => START });
  let ran = 0;
  const route = { method: 'POST', action: 'addToolLink', handle: () => ({ status: 201, body: { id: (ran += 1) } }) };
  const request = { pathname: '/api/projects/demo/tool-links', key: KEY_ID, bytes: Buffer.from('{"name":"a"}') };
  const owner = await write(route, { caller: 'owner' }, request);
  const agent = await write(route, { caller: AGENT }, request);
  const again = await write(route, { caller: AGENT }, request);
  assert.deepEqual([owner.text, agent.text, again.text], ['{"id":1}', '{"id":2}', '{"id":2}']);
  assert.equal(ran, 2);
  const actors = store.prepare('SELECT actor FROM request_keys').all().map((row) => row.actor);
  assert.deepEqual(actors.sort(), [AGENT, 'owner'].sort());
});

test('a key is kept 7 days, and older keys are dropped', async (t) => {
  const { clock, ran, keys, post, json } = await keyServer(t);
  await post('/api/projects/demo/tool-links', { name: 'a' });
  clock.now = START + DAY_MS;
  await post('/api/projects/demo/tool-links', { name: 'b' }, json(`"${OTHER_KEY_ID}"`));
  // Within 7 days of its first use the key answers as it did.
  clock.now = START + 7 * DAY_MS;
  assert.equal((await post('/api/projects/demo/tool-links', { name: 'a' })).json.id, 1);
  assert.equal(ran.length, 2);
  // After them it is a new request; the write of a new key drops every key older than 7 days.
  clock.now = START + 7 * DAY_MS + 1;
  const later = await post('/api/projects/demo/tool-links', { name: 'a' });
  assert.deepEqual([later.status, later.json.id, ran.length], [201, 3, 3]);
  assert.deepEqual(keys().map((row) => [row.request_key, row.created_at]), [
    [OTHER_KEY_ID, new Date(START + DAY_MS).toISOString()],
    [KEY_ID, new Date(START + 7 * DAY_MS + 1).toISOString()],
  ]);
});

test('a refused or failed write changes nothing and leaves no key behind', async (t) => {
  const { ran, count, keys, post } = await keyServer(t);
  const cases = [
    ['/api/projects/demo/refused', 409, 'step_empty'],
    ['/api/projects/demo/fails', 500, 'internal'],
    // A handler that returns a refusal rather than throwing a Problem is a fault, rolled back the same way.
    ['/api/projects/demo/returns', 500, 'internal'],
  ];
  for (const [path, status, code] of cases) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const answer = await post(path, { name: 'a' });
      assert.deepEqual([answer.status, answer.json.code], [status, code], path);
    }
  }
  // Each was run again under the same key, since the first left no key; none left a row.
  assert.equal(ran.length, 6);
  assert.equal(count('backups'), 0);
  assert.deepEqual(keys(), []);
});

test('a missing or malformed key is invalid_request on Idempotency-Key, before the write', async (t) => {
  const { ran, keys, post, json } = await keyServer(t);
  // Without its quotes, a letter out of the alphabet, one character short or over, another prefix, and sent twice.
  const malformed = [
    null, KEY_ID, `"${KEY_ID.slice(0, -1)}J"`, `"${KEY_ID.slice(0, -1)}"`, `"${KEY_ID}x"`, `"nd_${KEY_ID.slice(3)}"`,
    `${KEY}, ${KEY}`,
  ];
  for (const key of malformed) {
    const answer = await post('/api/projects/demo/tool-links', { name: 'a' }, json(key));
    assert.equal(answer.status, 400, String(key));
    assert.deepEqual([answer.json.code, answer.json.field], ['invalid_request', 'Idempotency-Key']);
    assert.equal(answer.text.includes(KEY_ID.slice(3, -1)), false);
  }
  assert.equal(ran.length, 0);
  assert.deepEqual(keys(), []);
});

test('a repeat answers what the route keeps, so a credential\'s secret is never kept or shown again', async (t) => {
  const { keys, post } = await keyServer(t);
  const first = await post('/api/credentials', { name: 'laptop' });
  assert.equal(first.status, 201);
  assert.equal(typeof first.json.secret, 'string');
  const again = await post('/api/credentials', { name: 'laptop' });
  assert.equal(again.status, 200);
  assert.deepEqual(again.json, { ...first.json, secret: null });
  const [row] = keys();
  assert.equal(row.status_code, 200);
  assert.equal(row.answer.includes(first.json.secret), false);
});

test('the same key sent twice at once runs once, and both get the first answer', async (t) => {
  const { ran, count, post } = await keyServer(t);
  const [one, two] = await Promise.all([
    post('/api/projects/demo/tool-links', { name: 'a', wait: 100 }),
    post('/api/projects/demo/tool-links', { name: 'a', wait: 100 }),
  ]);
  assert.deepEqual([one.status, two.status], [201, 201]);
  assert.deepEqual(one.json, two.json);
  assert.equal(ran.length, 1);
  assert.equal(count('backups'), 1);
});

test('no log line holds the request\'s digest (rule 5)', async (t) => {
  const { server, keys, post } = await keyServer(t);
  await post('/api/projects/demo/tool-links', { name: 'a' });
  await post('/api/projects/demo/tool-links', { name: 'b' });
  await server.logged(2);
  const digest = keys()[0].action.split(' ')[1];
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.equal(server.logText().includes(digest), false);
  assert.equal(server.logText().includes(digest.slice(0, 16)), false);
});
