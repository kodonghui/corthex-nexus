// The router and the answers of the HTTP server: an unknown path gets the not_found Problem (TASK-413).

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createRouter } from '../src/router.js';
import { AGENT_COMMANDS } from '../src/problem.js';
import { startServer, TRACE_ID } from './support.js';

const PROBLEM_KEYS = ['code', 'detail', 'status', 'title', 'traceId'];
const handle = () => ({ body: {} });

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
        { method: 'GET', path: '/api/spaces/{project}/todo', action: 'getAgentTodo', handle: ({ params }) => ({ body: params }) },
        { method: 'GET', path: '/api/projects/{project}', action: 'getProject', handle },
        { method: 'DELETE', path: '/api/projects/{project}', action: 'deleteProject', handle },
        { method: 'POST', path: '/api/snapshots', action: 'pushSnapshot', handle: () => ({ status: 201, body: { created: true } }) },
        { method: 'GET', path: '/api/fails', action: 'fails', handle: () => { throw new Error('broken'); } },
        { method: 'GET', path: '/api/empty', action: 'empty', handle: () => ({}) },
      ],
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

  test('match no path with an empty, extra or undecodable segment', async () => {
    for (const path of ['/api/spaces//todo', '/api/spaces/demo/todo/', '/api/spaces/%E0%A4%A/todo', '/API/spaces/demo/todo']) {
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

  test('take the gate\'s CF-Ray as the trace ID only in its own form', async () => {
    const ray = '0123456789abcdef-ICN';
    assert.equal((await server.send({ path: '/x', headers: { 'CF-Ray': ray } })).json.traceId, ray);
    for (const other of ['0123456789abcdef', '0123456789ABCDEF-ICN', '0123456789abcdef-icn', `${ray}-ICN`, `${ray} x`]) {
      const answer = await server.send({ path: '/x', headers: { 'CF-Ray': other } });
      assert.match(answer.json.traceId, /^[0-9a-f]{16}$/);
      assert.notEqual(answer.json.traceId, other);
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
