// The entry point, run as the server runs: node src/main.js with settings from the environment.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { readMigrations, STORE_FILE } from '../src/store.js';
import { assertNoneIn, forbiddenValues, send, TRACE_ID, waitFor } from './support.js';

const SERVER_DIRECTORY = fileURLToPath(new URL('..', import.meta.url));
const MAIN = fileURLToPath(new URL('../src/main.js', import.meta.url));
const MIGRATION_NUMBERS = readMigrations().map((migration) => migration.number);
// The gate's settings: placeholders, the audience made at run time. No test reaches the gate.
const GATE_ENV = Object.freeze({
  NEXUS_ACCESS_ISSUER: 'https://team.example.com',
  NEXUS_ACCESS_AUD: randomBytes(32).toString('hex'),
  NEXUS_OWNER_EMAIL: 'owner@example.com',
});

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

// What a test leaves behind is undone in reverse order: its servers stop before its data folders are removed.
function cleanups(t) {
  const steps = [];
  t.after(async () => {
    for (const step of steps.reverse()) await step();
  });
  return {
    dataFolder() {
      const folder = mkdtempSync(join(tmpdir(), 'nexus-main-'));
      steps.push(() => rmSync(folder, { recursive: true, force: true, maxRetries: 5 }));
      return folder;
    },
    run(env) {
      const server = run(env);
      steps.push(() => stopped(server));
      return server;
    },
  };
}

async function stopped(server) {
  if (server.child.exitCode === null && server.child.signalCode === null) {
    const closed = once(server.child, 'close');
    server.child.kill();
    await closed;
  }
}

test('starts with the environment\'s settings and logs one line per request', async (t) => {
  const undo = cleanups(t);
  const data = undo.dataFolder();
  // The gate's audience and the owner's email are settings no line names either.
  const values = { ...forbiddenValues([SERVER_DIRECTORY, MAIN, data]), audience: GATE_ENV.NEXUS_ACCESS_AUD, owner: GATE_ENV.NEXUS_OWNER_EMAIL };
  const server = undo.run({ ...GATE_ENV, NEXUS_HOST: '127.0.0.1', NEXUS_PORT: '0', NEXUS_DATA_DIR: data });
  await waitFor(() => server.lines().some((line) => line.event === 'listening'), 10_000);
  const [opened, listening] = server.lines();
  // The store opens before the server listens: a new install applies every migration.
  assert.deepEqual(
    { event: opened.event, version: opened.version, applied: opened.applied },
    { event: 'store_opened', version: MIGRATION_NUMBERS.length, applied: MIGRATION_NUMBERS },
  );
  assert.deepEqual(readdirSync(data), [STORE_FILE]);
  assert.equal(listening.event, 'listening');
  assert.equal(listening.host, '127.0.0.1');
  assert.ok(listening.port > 0);

  const answer = await send(listening.port, {
    path: `/api/spaces/demo/${values.secret}?token=${values.signInToken}`,
    headers: { 'CF-Access-Client-Secret': values.secret, 'Cf-Access-Jwt-Assertion': values.signInToken },
  });
  assert.equal(answer.status, 404);
  assert.equal(answer.json.code, 'not_found');
  await waitFor(() => server.lines().length === 3);
  const line = server.lines()[2];
  assert.equal(line.traceId, answer.json.traceId);
  assert.match(line.traceId, TRACE_ID);
  assert.equal(line.status, 404);
  assert.equal(line.code, 'not_found');
  assertNoneIn(server.output.stdout + server.output.stderr, values);

  // Started again on the same folder, it applies nothing.
  await stopped(server);
  const again = undo.run({ ...GATE_ENV, NEXUS_HOST: '127.0.0.1', NEXUS_PORT: '0', NEXUS_DATA_DIR: data });
  await waitFor(() => again.lines().some((each) => each.event === 'listening'), 10_000);
  assert.deepEqual(again.lines()[0].applied, []);
  assertNoneIn(again.output.stdout + again.output.stderr, values);
});

test('stops on an invalid setting, naming it but not its value', async (t) => {
  const undo = cleanups(t);
  const values = forbiddenValues([SERVER_DIRECTORY]);
  for (const [env, setting] of [
    [{ ...GATE_ENV, NEXUS_PORT: values.secret, NEXUS_DATA_DIR: undo.dataFolder() }, 'NEXUS_PORT'],
    [{ ...GATE_ENV, NEXUS_DATA_DIR: values.secret }, 'NEXUS_DATA_DIR'],
    // The gate's settings have no default, and a value set by mistake is not named either.
    [{ ...GATE_ENV, NEXUS_DATA_DIR: undo.dataFolder(), NEXUS_ACCESS_ISSUER: '' }, 'NEXUS_ACCESS_ISSUER'],
    [{ ...GATE_ENV, NEXUS_DATA_DIR: undo.dataFolder(), NEXUS_ACCESS_AUD: values.secret }, 'NEXUS_ACCESS_AUD'],
    [{ ...GATE_ENV, NEXUS_DATA_DIR: undo.dataFolder(), NEXUS_OWNER_EMAIL: values.secret }, 'NEXUS_OWNER_EMAIL'],
  ]) {
    const server = undo.run(env);
    const [code] = await once(server.child, 'close');
    assert.equal(code, 1);
    assert.deepEqual(server.lines().map((line) => [line.event, line.setting]), [['settings_invalid', setting]]);
    assertNoneIn(server.output.stdout + server.output.stderr, { ...values, audience: GATE_ENV.NEXUS_ACCESS_AUD, owner: GATE_ENV.NEXUS_OWNER_EMAIL });
  }
});

test('stops before listening when the file at the store\'s name is not a NEXUS v3 store, naming no path', async (t) => {
  const undo = cleanups(t);
  const data = undo.dataFolder();
  const values = forbiddenValues([SERVER_DIRECTORY, data]);
  const text = `not a store ${values.refusedText}\n`;
  writeFileSync(join(data, STORE_FILE), text);
  const server = undo.run({ ...GATE_ENV, NEXUS_PORT: '0', NEXUS_DATA_DIR: data });
  const [code] = await once(server.child, 'close');
  assert.equal(code, 1);
  assert.deepEqual(server.lines().map((line) => [line.event, line.reason]), [['store_refused', 'not_a_v3_store']]);
  assert.equal(readFileSync(join(data, STORE_FILE), 'utf8'), text);
  assert.deepEqual(readdirSync(data), [STORE_FILE]);
  assertNoneIn(server.output.stdout + server.output.stderr, values);
});
