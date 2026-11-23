// The entry point, run as the server runs: node src/main.js with settings from the environment.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { assertNoneIn, forbiddenValues, send, TRACE_ID, waitFor } from './support.js';

const SERVER_DIRECTORY = fileURLToPath(new URL('..', import.meta.url));
const MAIN = fileURLToPath(new URL('../src/main.js', import.meta.url));

function run(env) {
  const child = spawn(process.execPath, [MAIN], {
    cwd: SERVER_DIRECTORY,
    // Node on Windows needs SYSTEMROOT; nothing else of this machine's environment is passed.
    env: { ...(process.env.SYSTEMROOT ? { SYSTEMROOT: process.env.SYSTEMROOT } : {}), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = { stdout: '', stderr: '' };
  child.stdout.on('data', (chunk) => { output.stdout += chunk; });
  child.stderr.on('data', (chunk) => { output.stderr += chunk; });
  // Complete lines only: the last piece may still be arriving.
  const lines = () => output.stdout.split('\n').slice(0, -1).map((line) => JSON.parse(line));
  return { child, output, lines };
}

test('starts with the environment\'s settings and logs one line per request', async (t) => {
  const values = forbiddenValues([SERVER_DIRECTORY, MAIN]);
  const server = run({ NEXUS_HOST: '127.0.0.1', NEXUS_PORT: '0' });
  t.after(() => server.child.kill());
  await waitFor(() => server.lines().some((line) => line.event === 'listening'), 10_000);
  const listening = server.lines()[0];
  assert.equal(listening.event, 'listening');
  assert.equal(listening.host, '127.0.0.1');
  assert.ok(listening.port > 0);

  const answer = await send(listening.port, {
    path: `/api/spaces/demo/${values.secret}?token=${values.signInToken}`,
    headers: { 'CF-Access-Client-Secret': values.secret, 'Cf-Access-Jwt-Assertion': values.signInToken },
  });
  assert.equal(answer.status, 404);
  assert.equal(answer.json.code, 'not_found');
  await waitFor(() => server.lines().length === 2);
  const [, line] = server.lines();
  assert.equal(line.traceId, answer.json.traceId);
  assert.match(line.traceId, TRACE_ID);
  assert.equal(line.status, 404);
  assert.equal(line.code, 'not_found');
  assertNoneIn(server.output.stdout + server.output.stderr, values);
});

test('stops on an invalid setting, naming it but not its value', async () => {
  const values = forbiddenValues([SERVER_DIRECTORY]);
  const server = run({ NEXUS_PORT: values.secret });
  const [code] = await once(server.child, 'close');
  assert.equal(code, 1);
  assert.deepEqual(server.lines().map(({ event, setting }) => [event, setting]), [['settings_invalid', 'NEXUS_PORT']]);
  assertNoneIn(server.output.stdout + server.output.stderr, values);
});
