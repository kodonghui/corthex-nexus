// Writes one at a time, in the order they arrive (rule 4, TASK-415): two writes to one project sent at once run one
// after the other. The server has one queue for every write, since its one store connection holds one transaction.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createQueue } from '../src/writes.js';
import { localGate, newId, startServer, testStore, waitFor } from './support.js';

// The routes are the owner's (TASK-416), so each request carries the owner's sign-in from a gate with a local key.
const signedIn = (local) => ({ 'Content-Type': 'application/json', 'Cf-Access-Jwt-Assertion': local.token() });

// A server whose writes wait as long as their body says, recording when each starts and ends.
async function slowServer(t, { store = null } = {}) {
  const events = [];
  const arrived = [];
  const project = { project: 'project_not_found' };
  const local = localGate();
  // Admission checks the sign-in as a request arrives, before its body is read; the gate records the order.
  const gate = {
    signIn(headers) {
      arrived.push(headers['x-name']);
      return local.gate.signIn(headers);
    },
    isOwner: (claims) => local.gate.isOwner(claims),
  };
  const server = await startServer({
    store,
    gate,
    routes: [
      {
        method: 'POST',
        path: '/api/projects/{project}/tool-links',
        action: 'addToolLink',
        params: project,
        body: 'json',
        async handle({ body, store: db }) {
          events.push(`${body.name} start`);
          if (db !== null) events.push(`${body.name} in transaction ${db.isTransaction}`);
          await delay(body.wait ?? 0);
          events.push(`${body.name} end`);
          if (body.fail) throw new Error('broken');
          return { status: 201, body: { name: body.name } };
        },
      },
      {
        method: 'GET',
        path: '/api/projects/{project}',
        action: 'getProject',
        params: project,
        handle: () => {
          events.push('read');
          return { body: { ok: true } };
        },
      },
    ],
  });
  t.after(() => server.close());
  const write = (project, name, extra = {}) => server.send({
    method: 'POST',
    path: `/api/projects/${project}/tool-links`,
    headers: { ...signedIn(local), 'X-Name': name },
    body: JSON.stringify({ name, ...extra }),
  });
  const read = (project) => server.send({ path: `/api/projects/${project}`, headers: signedIn(local) });
  return { server, events, arrived, write, read };
}

test('two writes to one project sent at once run one after the other', async (t) => {
  const { events, write } = await slowServer(t);
  const first = write('demo', 'a', { wait: 150 });
  await waitFor(() => events.includes('a start'));
  const second = write('demo', 'b', { wait: 10 });
  const answers = await Promise.all([first, second]);
  assert.deepEqual(answers.map((answer) => answer.status), [201, 201]);
  assert.deepEqual(events, ['a start', 'a end', 'b start', 'b end']);
});

test('writes run in the order they arrive', async (t) => {
  const { events, arrived, write } = await slowServer(t);
  const pending = [write('demo', 'a', { wait: 200 })];
  await waitFor(() => events.includes('a start'));
  for (const name of ['b', 'c', 'd']) {
    pending.push(write('demo', name));
    await waitFor(() => arrived.includes(name));
    await delay(20);
  }
  await Promise.all(pending);
  assert.deepEqual(events.filter((event) => event.endsWith('start')), ['a start', 'b start', 'c start', 'd start']);
});

test('writes to another project wait too, and a read does not', async (t) => {
  const { events, write, read: get } = await slowServer(t);
  const first = write('demo', 'a', { wait: 150 });
  await waitFor(() => events.includes('a start'));
  const other = write('other', 'b');
  const read = await get('demo');
  assert.equal(read.status, 200);
  // The read was answered while the first write still ran; the other project's write waited for it.
  assert.deepEqual(events.slice(0, 2), ['a start', 'read']);
  await Promise.all([first, other]);
  assert.deepEqual(events.slice(2), ['a end', 'b start', 'b end']);
});

test('a write that fails does not hold the next', async (t) => {
  const { events, write } = await slowServer(t);
  const failed = write('demo', 'a', { wait: 50, fail: true });
  await waitFor(() => events.includes('a start'));
  const next = write('demo', 'b');
  assert.deepEqual([(await failed).status, (await next).status], [500, 201]);
  assert.deepEqual(events, ['a start', 'a end', 'b start', 'b end']);
});

test('a write runs in the store\'s transaction, which no other write shares', async (t) => {
  const store = testStore(t);
  const { events, write } = await slowServer(t, { store });
  const first = write('demo', 'a', { wait: 100 });
  await waitFor(() => events.includes('a start'));
  const second = write('demo', 'b');
  await Promise.all([first, second]);
  assert.deepEqual(events, ['a start', 'a in transaction true', 'a end', 'b start', 'b in transaction true', 'b end']);
  assert.equal(store.isTransaction, false);
});

test('a write whose answer could not be sent, rather than a thrown Problem, changes nothing', async (t) => {
  const store = testStore(t);
  const local = localGate();
  const rows = () => Number(store.prepare('SELECT count(*) AS n FROM backups').get().n);
  const keys = () => Number(store.prepare('SELECT count(*) AS n FROM request_keys').get().n);
  // Answers a handler may not give: each is a fault of the server, found before the write is stored.
  const ANSWERS = {
    refusal: { status: 409, body: { refused: true } },
    none: undefined,
    'a status that is no number': { status: 'created', body: { ok: true } },
    'a success the contract has not': { status: 204, body: { ok: true } },
    'no body': { status: 201 },
    'an empty object': { status: 201, body: {} },
    'an array': { status: 201, body: [{ ok: true }] },
    'null': { status: 201, body: null },
    'an object sent as {}': { status: 201, body: { id: undefined } },
    'an object sent as a string': { status: 201, body: { toJSON: () => 'x' } },
    'a framing header': { status: 201, body: { ok: true }, headers: { 'Content-Length': '5' } },
    'a header Node cannot send': { status: 201, body: { ok: true }, headers: { 'X-Note': 'a\nb' } },
  };
  const addRow = (name) => store.prepare("INSERT INTO backups (name, attempt, state, started_at) VALUES (?, 1, 'running', ?)")
    .run(name, new Date().toISOString());
  const route = (path, extra) => ({
    method: 'POST', path, action: 'addToolLink', params: { project: 'project_not_found' }, body: 'json', ...extra,
  });
  const server = await startServer({
    store,
    gate: local.gate,
    routes: [
      route('/api/projects/{project}/tool-links', {
        handle({ body }) {
          addRow(body.name);
          return ANSWERS[body.name];
        },
      }),
      // A route whose repeat keeps an answer that could not be sent.
      route('/api/projects/{project}/workshop', {
        requestKey: true,
        handle({ body }) {
          addRow(body.name);
          return { status: 201, body: { ok: true } };
        },
        repeat: () => ({ status: 409, body: { ok: true } }),
      }),
    ],
  });
  t.after(() => server.close());
  for (const name of Object.keys(ANSWERS)) {
    const sent = await server.send({
      method: 'POST', path: '/api/projects/demo/tool-links', headers: signedIn(local), body: JSON.stringify({ name }),
    });
    assert.deepEqual([sent.status, sent.json.code], [500, 'internal'], name);
  }
  const repeat = await server.send({
    method: 'POST',
    path: '/api/projects/demo/workshop',
    headers: { ...signedIn(local), 'Idempotency-Key': `"${newId('nw')}"` },
    body: JSON.stringify({ name: 'repeat' }),
  });
  assert.deepEqual([repeat.status, repeat.json.code], [500, 'internal']);
  assert.deepEqual([rows(), keys()], [0, 0]);
  assert.equal(store.isTransaction, false);
});

test('the queue runs each task after the ones before it, whether they succeeded or failed', async () => {
  const run = createQueue();
  const order = [];
  const results = await Promise.allSettled([
    run(async () => { await delay(30); order.push(1); return 1; }),
    run(() => { order.push(2); throw new Error('two'); }),
    run(async () => { order.push(3); return 3; }),
  ]);
  assert.deepEqual(order, [1, 2, 3]);
  assert.deepEqual(results.map((result) => result.status), ['fulfilled', 'rejected', 'fulfilled']);
});
