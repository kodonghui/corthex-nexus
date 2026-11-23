// The log: one line with a traceId per request, and no line holds a secret, a digest, a sign-in token, a server
// path or a refused file's text (rule 5 of the functional spec; TASK-413).
//
// The values are made at run time, so that no secret-like text is written into the repository.

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, describe, test } from 'node:test';
import { errorKind, logCrashes } from '../src/log.js';
import { assertNoneIn, forbiddenValues, startServer, TRACE_ID } from './support.js';

const SERVER_DIRECTORY = fileURLToPath(new URL('..', import.meta.url));

describe('the request log', () => {
  let server;
  let dataDirectory;
  let values;
  let answers;

  before(async () => {
    dataDirectory = await mkdtemp(join(tmpdir(), 'nexus-logs-'));
    values = forbiddenValues([SERVER_DIRECTORY, process.cwd(), dataDirectory]);
    const fileOf = (name) => join(dataDirectory, name);
    server = await startServer({
      routes: [
        {
          // A handler that fails with the request's text, a secret and a server path in its error.
          method: 'POST',
          path: '/api/spaces/{project}/comments',
          action: 'postAgentComment',
          async handle({ request }) {
            const chunks = [];
            for await (const chunk of request) chunks.push(chunk);
            const error = new Error(`${Buffer.concat(chunks)} ${values.secret} ${values.digestHex} ${fileOf('nexus.sqlite')}`);
            error.code = 'ENOENT';
            throw error;
          },
        },
        {
          method: 'GET',
          path: '/api/projects/{project}',
          action: 'getProject',
          handle: ({ params }) => ({ body: { name: params.project } }),
        },
      ],
    });

    const credential = {
      'CF-Access-Client-Id': `ac_${randomBytes(8).toString('hex')}`,
      'CF-Access-Client-Secret': values.secret,
    };
    const signIn = {
      'Cf-Access-Jwt-Assertion': values.signInToken,
      Cookie: `CF_Authorization=${values.signInToken}`,
      Authorization: `Bearer ${values.signInToken}`,
    };
    const refusedFile = JSON.stringify({
      schema: 'corthex-hub/0.3',
      files: [{ path: fileOf('docs/notes.md'), text: values.refusedText, digest: values.digestBase64 }],
    });
    answers = [];
    for (const request of [
      // Unknown paths, with the values in the path, the query, the headers and the body.
      { method: 'GET', path: `/no/such/${values.secret}?token=${values.signInToken}`, headers: { ...credential, ...signIn } },
      { method: 'GET', path: `/api/spaces/demo/${values.digestHex}`, headers: credential },
      { method: 'POST', path: `/api/spaces/${encodeURIComponent(values.refusedText)}/files`, headers: credential, body: refusedFile },
      // A method the path does not take.
      { method: 'PUT', path: `/api/projects/${values.digestBase64url}`, headers: signIn, body: refusedFile },
      // An operation that answers, with the values in its parameter, query and headers.
      { method: 'GET', path: `/api/projects/${values.secret}?d=${encodeURIComponent(values.serverPath0)}`, headers: signIn },
      // An operation whose handler fails with the values in its error.
      { method: 'POST', path: '/api/spaces/demo/comments', headers: { ...credential, 'Content-Type': 'application/json' }, body: refusedFile },
    ]) {
      answers.push(await server.send(request));
    }
  });

  after(async () => {
    await server.close();
    await rm(dataDirectory, { recursive: true, force: true });
  });

  test('has one JSON line with a traceId per request', async () => {
    const lines = await server.logged(answers.length);
    assert.equal(lines.length, answers.length);
    assert.equal(new Set(lines.map((line) => line.traceId)).size, lines.length);
    for (const line of lines) {
      assert.match(line.traceId, TRACE_ID);
      assert.match(line.time, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
      assert.equal(typeof line.ms, 'number');
    }
    // Each Problem answer names the traceId of its own line.
    for (const answer of answers.filter((each) => each.status >= 400)) {
      assert.equal(lines.filter((line) => line.traceId === answer.json.traceId && line.status === answer.status).length, 1);
    }
    assert.deepEqual(
      lines.map(({ method, action, status, code }) => [method, action, status, code]),
      [
        ['GET', null, 404, 'not_found'],
        ['GET', null, 404, 'not_found'],
        ['POST', null, 404, 'not_found'],
        ['PUT', null, 405, 'method_not_allowed'],
        ['GET', 'getProject', 200, null],
        ['POST', 'postAgentComment', 500, 'internal'],
      ],
    );
    assert.equal(lines[5].error, 'Error ENOENT');
  });

  test('holds no secret, digest, sign-in token, server path or refused file text (rule 5)', async () => {
    await server.logged(answers.length);
    assertNoneIn(server.logText(), values);
  });

  test('holds only the fields the server sets', async () => {
    const fields = new Set(['time', 'traceId', 'method', 'action', 'status', 'code', 'ms', 'error', 'aborted']);
    for (const line of await server.logged(answers.length)) {
      for (const field of Object.keys(line)) assert.ok(fields.has(field), field);
    }
  });

  test('keeps the failing handler\'s values out of its answer too', () => {
    const failed = answers.at(-1);
    assert.equal(failed.json.code, 'internal');
    assertNoneIn(failed.text, values);
  });
});

describe('the crash line', () => {
  test('names the kind of error only, then stops the process', () => {
    const values = forbiddenValues([SERVER_DIRECTORY]);
    const lines = [];
    const exits = [];
    const target = new EventEmitter();
    logCrashes(target, (entry) => lines.push(JSON.stringify(entry)), (code) => exits.push(code));
    const error = new TypeError(`${values.secret} at ${values.serverPath0}`);
    target.emit('uncaughtException', error);
    target.emit('unhandledRejection', Object.assign(new Error(values.signInToken), { code: values.digestHex }));
    assert.deepEqual(exits, [1, 1]);
    assert.deepEqual(lines.map((line) => JSON.parse(line).error), ['TypeError', 'Error']);
    assertNoneIn(lines.join('\n'), values);
  });

  test('errorKind takes built-in error types and Node\'s codes only', () => {
    class LeakyError extends Error {}
    Object.defineProperty(LeakyError, 'name', { value: 'TokenAbcDefGhi' });
    assert.equal(errorKind(new RangeError('x')), 'RangeError');
    assert.equal(errorKind(Object.assign(new Error('x'), { code: 'ERR_INVALID_ARG_TYPE' })), 'Error ERR_INVALID_ARG_TYPE');
    assert.equal(errorKind(new LeakyError('x')), 'Error');
    assert.equal(errorKind(Object.assign(new Error('x'), { code: 'a secret' })), 'Error');
    assert.equal(errorKind('a thrown text'), 'Error');
    assert.equal(errorKind(undefined), 'Error');
  });
});
