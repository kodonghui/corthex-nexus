// The router and the answers of the HTTP server: an unknown path gets the not_found Problem (TASK-413).

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createRouter } from '../src/router.js';
import { AGENT_COMMANDS, Problem } from '../src/problem.js';
import { startServer, TRACE_ID, waitFor } from './support.js';

const PROBLEM_KEYS = ['code', 'detail', 'status', 'title', 'traceId'];
const handle = () => ({ body: {} });
// These routes test the router, not admission (see admission.test.js): their actions are no operations of the
// contract, so each says it needs no admission.
const open = (route) => ({ ...route, family: 'none' });

describe('an unknown path', () => {
  let server;
  before(async () => {
    server = await startServer();
  });
  after(() => server.close());

  test('answers the not_found Problem', async () => {
    const answer = await server.send({ path: '/no/such/path' });
    assert.equal(answer.status, 404);
    assert.equal(answer.headers['content-type'], 'application/problem+json');
    assert.deepEqual(Object.keys(answer.json).sort(), PROBLEM_KEYS);
    assert.equal(answer.json.code, 'not_found');
    assert.equal(answer.json.status, 404);
    assert.equal(answer.json.title, 'No such address');
    assert.equal(answer.json.detail, 'no operation has this address');
    assert.match(answer.json.traceId, TRACE_ID);
  });

  test('under /api/spaces names the agent commands NEXUS takes (SPEC-014)', async () => {
    for (const path of ['/api/spaces', '/api/spaces/demo/unknown-command', '/api/spaces/demo/todo']) {
      const answer = await server.send({ method: 'POST', path, body: '{}' });
      assert.equal(answer.status, 404, path);
      assert.equal(answer.json.code, 'not_found');
      for (const command of AGENT_COMMANDS) assert.match(answer.json.detail, new RegExp(`\\b${command}\\b`));
    }
  });

  test('is not_found whatever the method, the query or the form of the target', async () => {
    for (const [method, path] of [
      ['GET', '/'],
      ['HEAD', '/api/projects'],
      ['DELETE', '/api/projects/demo?d=nd_1'],
      ['OPTIONS', '/api/todo'],
      ['GET', '//api/projects'],
      ['GET', 'http://nexus.example.com/api/projects'],
    ]) {
      const answer = await server.send({ method, path });
      assert.equal(answer.status, 404, `${method} ${path}`);
      if (method !== 'HEAD') assert.equal(answer.json.code, 'not_found');
    }
  });

  test('never repeats the path it was given', async () => {
    const answer = await server.send({ path: '/api/spaces/marker-in-the-path/todo' });
    assert.doesNotMatch(answer.text, /marker-in-the-path/);
  });
});

describe('the routes', () => {
  let server;
  before(async () => {
    server = await startServer({
      routes: [
        { method: 'GET', path: '/api/spaces/{project}/todo', action: 'readTodo', handle: ({ params }) => ({ body: params }) },
        { method: 'GET', path: '/api/projects/{project}', action: 'readProject', handle },
        { method: 'DELETE', path: '/api/projects/{project}', action: 'removeProject', handle },
        { method: 'POST', path: '/api/snapshots', action: 'push', handle: () => ({ status: 201, body: { created: true } }) },
        { method: 'GET', path: '/api/fails', action: 'fails', handle: () => { throw new Error('broken'); } },
        { method: 'GET', path: '/api/empty', action: 'empty', handle: () => ({}) },
        {
          method: 'GET',
          path: '/api/headers',
          action: 'headers',
          handle: () => ({
            body: { ok: true },
            headers: { 'content-type': 'text/html', 'cache-control': 'max-age=60', 'X-Content-Type-Options': 'sniff' },
          }),
        },
        { method: 'GET', path: '/api/no-headers', action: 'noHeaders', handle: () => ({ body: { ok: true }, headers: null }) },
        {
          method: 'GET',
          path: '/api/proto-header',
          action: 'protoHeader',
          handle: () => ({ body: { ok: true }, headers: JSON.parse('{"__proto__": "x", "X-Kept": "y"}') }),
        },
        ...['Transfer-Encoding', 'content-length', 'Connection'].map((name, index) => ({
          method: 'GET',
          path: `/api/framing/${index}`,
          action: 'framing',
          handle: () => ({ body: { ok: true }, headers: { [name]: name === 'Connection' ? 'close' : '1' } }),
        })),
        {
          method: 'GET',
          path: '/api/unsendable',
          action: 'unsendable',
          handle: () => { throw new Problem('not_found', 'x', { 'X-Bad': 'a\nb' }); },
        },
      ].map(open),
    });
  });
  after(() => server.close());

  test('answer JSON with the status the handler gives', async () => {
    const answer = await server.send({ method: 'POST', path: '/api/snapshots', body: '{}' });
    assert.equal(answer.status, 201);
    assert.equal(answer.headers['content-type'], 'application/json; charset=utf-8');
    assert.equal(answer.headers['cache-control'], 'no-store');
    assert.equal(answer.headers['x-content-type-options'], 'nosniff');
    assert.deepEqual(answer.json, { created: true });
  });

  test('pass each path parameter percent-decoded and leave out the query', async () => {
    assert.deepEqual((await server.send({ path: '/api/spaces/demo/todo' })).json, { project: 'demo' });
    assert.deepEqual((await server.send({ path: '/api/spaces/a%20b/todo?x=1' })).json, { project: 'a b' });
  });

  test('pass a parameter unchecked, for its handler to check against its schema', async () => {
    // The contract gives a value in another form the 404 of what it names, which only the operation knows.
    assert.deepEqual((await server.send({ path: '/api/spaces/%E0%A4%A/todo' })).json, { project: '%E0%A4%A' });
    assert.deepEqual((await server.send({ path: '/api/spaces/%2E%2E%2Fetc/todo' })).json, { project: '../etc' });
  });

  test('match no path with an empty or extra segment, or in another case', async () => {
    for (const path of ['/api/spaces//todo', '/api/spaces/demo/todo/', '/API/spaces/demo/todo']) {
      const answer = await server.send({ path });
      assert.equal(answer.status, 404, path);
      assert.equal(answer.json.code, 'not_found');
    }
  });

  test('answer method_not_allowed with Allow for a method the path does not take', async () => {
    const one = await server.send({ method: 'POST', path: '/api/spaces/demo/todo' });
    assert.equal(one.status, 405);
    assert.equal(one.headers.allow, 'GET');
    assert.equal(one.json.code, 'method_not_allowed');
    assert.equal(one.json.detail, 'this address takes GET');
    const two = await server.send({ method: 'PATCH', path: '/api/projects/demo' });
    assert.equal(two.headers.allow, 'DELETE, GET');
    assert.equal(two.json.detail, 'this address takes DELETE and GET');
    assert.deepEqual(Object.keys(two.json).sort(), PROBLEM_KEYS);
  });

  test('turn a failing handler into the internal Problem', async () => {
    for (const path of ['/api/fails', '/api/empty']) {
      const answer = await server.send({ path });
      assert.equal(answer.status, 500, path);
      assert.equal(answer.json.code, 'internal');
      assert.equal(answer.json.detail, 'an unexpected error; the trace ID names it');
      assert.doesNotMatch(answer.text, /broken/);
    }
  });

  test('keep the type, the length and nosniff of their answers, whatever headers a handler gives', async () => {
    const answer = await server.send({ path: '/api/headers' });
    assert.equal(answer.status, 200);
    assert.equal(answer.headers['content-type'], 'application/json; charset=utf-8');
    assert.equal(answer.headers['content-length'], String(Buffer.byteLength(answer.text)));
    assert.equal(answer.headers['x-content-type-options'], 'nosniff');
    assert.equal(answer.headers['cache-control'], 'max-age=60');
    const names = answer.rawHeaders.filter((_, index) => index % 2 === 0).map((name) => name.toLowerCase());
    assert.equal(names.length, new Set(names).size, 'no header is sent twice');
    assert.deepEqual(answer.json, { ok: true });
  });

  test('take no headers, or a header named __proto__, from a handler', async () => {
    const none = await server.send({ path: '/api/no-headers' });
    assert.equal(none.status, 200);
    assert.equal(none.headers['cache-control'], 'no-store');
    const proto = await server.send({ path: '/api/proto-header' });
    assert.equal(proto.status, 200);
    assert.equal(proto.headers['x-kept'], 'y');
    assert.equal(proto.headers['content-type'], 'application/json; charset=utf-8');
  });

  test('refuse a framing header from a handler as an internal fault', async () => {
    for (const index of [0, 1, 2]) {
      const answer = await server.send({ path: `/api/framing/${index}` });
      assert.equal(answer.status, 500, String(index));
      assert.equal(answer.json.code, 'internal');
      assert.equal(answer.headers['transfer-encoding'], undefined);
      assert.equal(answer.headers['content-length'], String(Buffer.byteLength(answer.text)));
    }
  });

  test('drop the connection, and keep serving, when a refusal cannot be sent', { timeout: 10_000 }, async () => {
    const rejections = [];
    const onRejection = (reason) => rejections.push(reason);
    process.on('unhandledRejection', onRejection);
    try {
      await assert.rejects(server.send({ path: '/api/unsendable' }));
      assert.equal((await server.send({ path: '/api/spaces/demo/todo' })).status, 200);
      await new Promise((resolve) => setImmediate(resolve));
      assert.deepEqual(rejections, []);
      // Its log line says why, unlike a caller that hung up.
      await waitFor(() => server.logText().includes('"action":"unsendable"'));
      const line = server.logText().split('\n').filter(Boolean).map((text) => JSON.parse(text))
        .find((each) => each.action === 'unsendable');
      assert.deepEqual([line.status, line.code, line.error, line.aborted], [null, 'not_found', 'TypeError ERR_INVALID_CHAR', true]);
    } finally {
      process.off('unhandledRejection', onRejection);
    }
  });

  test('take no CF-Ray as the trace ID without the owner\'s sign-in', async () => {
    // Anyone who reaches the server without the gate can send one; admission.test.js shows when it is taken.
    const headers = { 'CF-Ray': '0123456789abcdef-ICN' };
    for (const [method, path, code] of [
      ['GET', '/x', 'not_found'],
      ['PUT', '/api/projects/demo', 'method_not_allowed'],
      ['GET', '/api/fails', 'internal'],
    ]) {
      const answer = await server.send({ method, path, headers });
      assert.equal(answer.json.code, code);
      assert.match(answer.json.traceId, /^[0-9a-f]{16}$/);
    }
  });
});

describe('createRouter', () => {
  test('prefers a literal segment to a parameter', () => {
    const find = createRouter([
      { method: 'GET', path: '/api/projects/{project}/{part}', action: 'byParameter', handle },
      { method: 'GET', path: '/api/projects/{project}/workshop', action: 'byLiteral', handle },
    ]);
    assert.equal(find('GET', '/api/projects/demo/workshop').route.action, 'byLiteral');
    assert.equal(find('GET', '/api/projects/demo/other').route.action, 'byParameter');
  });

  test('refuses two routes of one method and one template shape', () => {
    assert.throws(() => createRouter([
      { method: 'GET', path: '/api/projects/{project}', action: 'one', handle },
      { method: 'GET', path: '/api/projects/{name}', action: 'two', handle },
    ]), /two routes/);
  });

  test('refuses a route that is not fully defined', () => {
    for (const route of [
      { method: 'TRACE', path: '/a', action: 'a', handle },
      { method: 'GET', path: 'a', action: 'a', handle },
      { method: 'GET', path: '/a/{b}/{b}', action: 'a', handle },
      { method: 'GET', path: '/a b', action: 'a', handle },
      { method: 'GET', path: '/a', action: '', handle },
      { method: 'GET', path: '/a', action: 'a' },
    ]) {
      assert.throws(() => createRouter([route]), Error, JSON.stringify(route));
    }
  });
});
