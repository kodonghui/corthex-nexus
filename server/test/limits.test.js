// Body limits and JSON only (TASK-415): a body over its limit gets snapshot_too_large or body_too_large, a body that
// is not JSON gets json_required, and the server reads no more of a body it does not take than its limit.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { BODY_KINDS } from '../src/body.js';
import { LIMITS } from '../src/limits.js';
import { contract, operations } from './contract.js';
import { exchange, head, startServer } from './support.js';

const MiB = 1_048_576;
const echo = ({ body }) => ({ body: { keys: Object.keys(body) } });

test('the limits are the contract\'s', () => {
  const limits = contract.components['x-corthex'].limits;
  assert.deepEqual(
    [LIMITS.snapshotBytes, LIMITS.miroBytes, LIMITS.bodyBytes, LIMITS.textCharacters, LIMITS.nameCharacters],
    [limits.snapshot_bytes, limits.miro_bytes, limits.body_bytes, limits.text_characters, limits.name_characters],
  );
  assert.deepEqual(
    [LIMITS.credentialNameCharacters, LIMITS.requestKeyDays, LIMITS.claimMinutes],
    [limits.credential_name_characters, limits.request_key_days, limits.claim_minutes],
  );
  assert.deepEqual([LIMITS.snapshotBytes, LIMITS.miroBytes, LIMITS.bodyBytes], [8 * MiB, 5 * MiB, 2 * MiB]);
});

test('every body of the contract is a JSON object of one of the three kinds, with its limit and its codes', () => {
  const kindOf = (id) => ({ pushSnapshot: 'snapshot', importMiroBoard: 'miro' })[id] ?? 'json';
  let bodies = 0;
  for (const { method, path, operation } of operations()) {
    const where = `${method} ${path}`;
    if (operation.requestBody === undefined) {
      assert.equal(operation.responses['413'], undefined, where);
      assert.equal(operation.responses['415'], undefined, where);
      continue;
    }
    bodies += 1;
    const kind = BODY_KINDS[kindOf(operation.operationId)];
    assert.equal(operation.requestBody.required, true, where);
    assert.deepEqual(Object.keys(operation.requestBody.content), ['application/json'], where);
    assert.equal(operation.requestBody.description, `At most ${kind.limit} bytes.`, where);
    for (const { value } of Object.values(operation.responses['413'].content['application/problem+json'].examples)) {
      // API-292's example copies the 2 MiB limit of the other bodies, while its body, the limits and SPEC-041's
      // row give a Miro export 5 MiB; the server follows those. This test fails once the example is corrected.
      const limit = operation.operationId === 'importMiroBoard' ? LIMITS.bodyBytes : kind.limit;
      assert.deepEqual([value.code, value.limit], [kind.tooLarge, limit], where);
    }
    for (const { value } of Object.values(operation.responses['415'].content['application/problem+json'].examples)) {
      assert.equal(value.code, 'json_required', where);
    }
    const invalid = Object.values(operation.responses['400'].content['application/problem+json'].examples)
      .map(({ value }) => value.code);
    assert.ok(invalid.includes(kind.invalid), where);
  }
  assert.equal(bodies, 31, 'the contract\'s bodies were read');
});

describe('a request body', () => {
  let server;
  before(async () => {
    // These routes test the body, not admission (see admission.test.js): their actions are no operations of the
    // contract, so each says it needs no admission.
    server = await startServer({
      routes: [
        { method: 'POST', path: '/api/snapshots', action: 'push', body: 'snapshot', handle: echo },
        {
          method: 'POST',
          path: '/api/projects/{project}/workshop/imports',
          action: 'importBoard',
          params: { project: 'project_not_found' },
          body: 'miro',
          handle: echo,
        },
        {
          method: 'POST',
          path: '/api/projects/{project}/tool-links',
          action: 'addLink',
          params: { project: 'project_not_found' },
          body: 'json',
          handle: echo,
        },
        { method: 'GET', path: '/api/projects/{project}', action: 'readProject', params: { project: 'project_not_found' }, handle: () => ({ body: { ok: true } }) },
      ].map((route) => ({ ...route, family: 'none' })),
    });
  });
  after(() => server.close());

  const json = { 'Content-Type': 'application/json' };

  test('over its limit gets snapshot_too_large or body_too_large, without being read', async () => {
    for (const [path, code, limit] of [
      ['/api/snapshots', 'snapshot_too_large', 8 * MiB],
      ['/api/projects/demo/workshop/imports', 'body_too_large', 5 * MiB],
      ['/api/projects/demo/tool-links', 'body_too_large', 2 * MiB],
    ]) {
      // The body is declared one byte over the limit and never sent.
      const { answers, closed, ms } = await exchange(server.port, [head('POST', path, { ...json, 'Content-Length': limit + 1 })]);
      assert.equal(answers.length, 1, path);
      const [answer] = answers;
      assert.equal(answer.status, 413, path);
      assert.equal(answer.headers['content-type'], 'application/problem+json');
      assert.deepEqual([answer.json.code, answer.json.limit, answer.json.status], [code, limit, 413], path);
      assert.equal(answer.headers.connection, 'close', path);
      assert.ok(closed && ms < 2000, `${path}: the connection is closed at once`);
    }
  });

  test('sent without its length is refused once it passes the limit', async () => {
    const chunk = (size) => Buffer.concat([Buffer.from(`${size.toString(16)}\r\n`), Buffer.alloc(size, 0x20), Buffer.from('\r\n')]);
    const { answers, closed } = await exchange(server.port, [
      head('POST', '/api/projects/demo/tool-links', { ...json, 'Transfer-Encoding': 'chunked' }),
      chunk(MiB),
      chunk(MiB),
      chunk(1),
    ]);
    assert.equal(answers[0]?.status, 413);
    assert.deepEqual([answers[0].json.code, answers[0].json.limit], ['body_too_large', 2 * MiB]);
    assert.ok(closed);
  });

  test('at its limit is taken', async () => {
    for (const [path, limit] of [['/api/projects/demo/tool-links', 2 * MiB], ['/api/projects/demo/workshop/imports', 5 * MiB]]) {
      const body = `{"t":"${'a'.repeat(limit - 8)}"}`;
      assert.equal(Buffer.byteLength(body), limit);
      const answer = await server.send({ method: 'POST', path, headers: json, body });
      assert.equal(answer.status, 200, path);
      assert.deepEqual(answer.json, { keys: ['t'] });
    }
  });

  test('that is not application/json gets json_required', async () => {
    for (const headers of [
      {},
      { 'Content-Type': 'text/plain' },
      { 'Content-Type': 'application/x-www-form-urlencoded' },
      { 'Content-Type': 'application/json-patch+json' },
      { 'Content-Type': 'application/json; charset=iso-8859-1' },
      { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' },
    ]) {
      for (const path of ['/api/snapshots', '/api/projects/demo/tool-links']) {
        const answer = await server.send({ method: 'POST', path, headers, body: '{"a":1}' });
        assert.equal(answer.status, 415, `${path} ${JSON.stringify(headers)}`);
        assert.equal(answer.json.code, 'json_required');
        assert.equal(answer.json.detail, 'send the body as application/json');
      }
    }
    for (const type of ['application/json', 'Application/JSON; charset="UTF-8"', 'application/json;charset=utf-8']) {
      const answer = await server.send({ method: 'POST', path: '/api/projects/demo/tool-links', headers: { 'Content-Type': type }, body: '{"a":1}' });
      assert.equal(answer.status, 200, type);
    }
  });

  test('that is not JSON text of an object is refused naming the body', async () => {
    for (const body of ['', '{"a":', 'null', '[1]', '"text"', '12', Buffer.from([0x7b, 0x22, 0xff, 0x22, 0x3a, 0x31, 0x7d])]) {
      for (const [path, code] of [['/api/projects/demo/tool-links', 'invalid_request'], ['/api/snapshots', 'invalid_snapshot']]) {
        const answer = await server.send({ method: 'POST', path, headers: json, body });
        assert.equal(answer.status, 400, `${path} ${body}`);
        assert.deepEqual([answer.json.code, answer.json.field], [code, 'body'], `${path} ${body}`);
      }
    }
  });

  test('of a refused request is not drained when it could be over its limit (TASK-413 review, round 1 #8)', async () => {
    // A body declared at 64 MiB of which only a little comes, to a path that is no operation, to a method the path
    // does not take, and to an operation refused before its body: each is answered and the connection closed, where
    // Node would otherwise read the 64 MiB before closing.
    for (const [method, path, status] of [
      ['POST', '/no/such/path', 404],
      ['PUT', '/api/projects/demo', 405],
      ['POST', '/api/projects/Demo/tool-links', 404],
    ]) {
      const { answers, closed, ms } = await exchange(server.port, [head(method, path, { ...json, 'Content-Length': 64 * MiB }), '{"a":']);
      assert.equal(answers[0]?.status, status, path);
      assert.equal(answers[0].headers.connection, 'close', path);
      assert.ok(closed && ms < 2000, `${path}: the connection is closed at once`);
    }
    // So is one whose length is not declared.
    const chunked = await exchange(server.port, [head('POST', '/no/such/path', { 'Transfer-Encoding': 'chunked' }), '5\r\nhello\r\n']);
    assert.equal(chunked.answers[0]?.status, 404);
    assert.ok(chunked.closed);
  });

  test('of a refused request within its limit is read and dropped, keeping the connection', async () => {
    // Two requests on one connection: the first refused with its body unread, the second answered after it.
    const body = '{"a":1}';
    const { answers, closed } = await exchange(server.port, [
      head('POST', '/no/such/path', { ...json, 'Content-Length': body.length }) + body,
      head('GET', '/api/projects/demo', {}),
    ], { waitMs: 500 });
    assert.deepEqual(answers.map((answer) => answer.status), [404, 200]);
    assert.equal(answers[0].headers.connection, 'keep-alive');
    assert.equal(closed, false);
    // The limit is the operation's own: a snapshot refused before its body is read keeps the connection up to 8 MiB.
    const snapshot = Buffer.alloc(3 * MiB, 0x20);
    const large = await exchange(server.port, [
      head('POST', '/api/snapshots', { 'Content-Type': 'text/plain', 'Content-Length': snapshot.length }),
      snapshot,
      head('GET', '/api/projects/demo', {}),
    ], { waitMs: 1000 });
    assert.deepEqual(large.answers.map((answer) => answer.status), [415, 200]);
    assert.equal(large.closed, false);
  });
});
