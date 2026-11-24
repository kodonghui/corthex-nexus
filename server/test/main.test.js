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
  const all = () => output.stdout.split('\n').slice(0, -1).map((line) => JSON.parse(line));
  // The daily backup's lines apart, since whether the day's backup runs at start depends on the time of day.
  const isBackup = (line) => typeof line.event === 'string' && line.event.startsWith('backup_');
  const lines = () => all().filter((line) => !isBackup(line));
  const backupLines = () => all().filter(isBackup);
  return { child, output, lines, backupLines };
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
  const backups = undo.dataFolder();
  const values = { ...forbiddenValues([SERVER_DIRECTORY, MAIN, data, backups]), audience: GATE_ENV.NEXUS_ACCESS_AUD, owner: GATE_ENV.NEXUS_OWNER_EMAIL };
  // The day's backup runs at start, since 00:00 UTC has always passed; the test waits for it, so that the store's
  // folder is seen with no write in progress.
  const server = undo.run({
    ...GATE_ENV, NEXUS_HOST: '127.0.0.1', NEXUS_PORT: '0', NEXUS_DATA_DIR: data, NEXUS_BACKUP_DIR: backups, NEXUS_BACKUP_TIME: '00:00',
  });
  await waitFor(() => server.lines().some((line) => line.event === 'listening'), 10_000);
  await waitFor(() => server.backupLines().length === 1, 10_000);
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
  // It serves the operations of routes.js, each admitted by its family: the credentials need the owner's sign-in.
  const credentials = await send(listening.port, { path: '/api/credentials', headers: { 'CF-Access-Client-Secret': values.secret } });
  assert.equal(credentials.status, 401);
  assert.equal(credentials.json.code, 'unauthenticated');
  await waitFor(() => server.lines().length === 4);
  assert.deepEqual([server.lines()[3].action, server.lines()[3].sender], ['listCredentials', 'unknown']);
  assertNoneIn(server.output.stdout + server.output.stderr, values);

  // Started again on the same folder, it applies nothing.
  await stopped(server);
  const again = undo.run({ ...GATE_ENV, NEXUS_HOST: '127.0.0.1', NEXUS_PORT: '0', NEXUS_DATA_DIR: data, NEXUS_BACKUP_DIR: backups });
  await waitFor(() => again.lines().some((each) => each.event === 'listening'), 10_000);
  assert.deepEqual(again.lines()[0].applied, []);
  assertNoneIn(again.output.stdout + again.output.stderr, values);
});

test('stops on an invalid setting, naming it but not its value', async (t) => {
  const undo = cleanups(t);
  const values = forbiddenValues([SERVER_DIRECTORY]);
  const folders = () => ({ NEXUS_DATA_DIR: undo.dataFolder(), NEXUS_BACKUP_DIR: undo.dataFolder() });
  for (const [env, setting] of [
    [{ ...GATE_ENV, ...folders(), NEXUS_PORT: values.secret }, 'NEXUS_PORT'],
    [{ ...GATE_ENV, ...folders(), NEXUS_DATA_DIR: values.secret }, 'NEXUS_DATA_DIR'],
    // Without the backups' folder the server does not start: it never runs without its daily backup (SPEC-052).
    [{ ...GATE_ENV, NEXUS_DATA_DIR: undo.dataFolder() }, 'NEXUS_BACKUP_DIR'],
    [{ ...GATE_ENV, ...folders(), NEXUS_BACKUP_DIR: values.secret }, 'NEXUS_BACKUP_DIR'],
    [{ ...GATE_ENV, ...folders(), NEXUS_BACKUP_TIME: values.secret }, 'NEXUS_BACKUP_TIME'],
    // The gate's settings have no default, and a value set by mistake is not named either.
    [{ ...GATE_ENV, ...folders(), NEXUS_ACCESS_ISSUER: '' }, 'NEXUS_ACCESS_ISSUER'],
    [{ ...GATE_ENV, ...folders(), NEXUS_ACCESS_AUD: values.secret }, 'NEXUS_ACCESS_AUD'],
    [{ ...GATE_ENV, ...folders(), NEXUS_OWNER_EMAIL: values.secret }, 'NEXUS_OWNER_EMAIL'],
    // The tool status read's tokens: one with a space, and a Jira token without its site. Neither calls a tool.
    [{ ...GATE_ENV, ...folders(), NEXUS_NOTION_TOKEN: `${values.secret} ${values.secret}` }, 'NEXUS_NOTION_TOKEN'],
    [{ ...GATE_ENV, ...folders(), NEXUS_JIRA_TOKEN: values.secret }, 'NEXUS_JIRA_SITE'],
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
  const server = undo.run({ ...GATE_ENV, NEXUS_PORT: '0', NEXUS_DATA_DIR: data, NEXUS_BACKUP_DIR: undo.dataFolder() });
  const [code] = await once(server.child, 'close');
  assert.equal(code, 1);
  assert.deepEqual(server.lines().map((line) => [line.event, line.reason]), [['store_refused', 'not_a_v3_store']]);
  assert.equal(readFileSync(join(data, STORE_FILE), 'utf8'), text);
  assert.deepEqual(readdirSync(data), [STORE_FILE]);
  assertNoneIn(server.output.stdout + server.output.stderr, values);
});

test('backs up the store at start when the day\'s time has passed, naming no path (SPEC-052)', async (t) => {
  const undo = cleanups(t);
  const data = undo.dataFolder();
  const backups = join(undo.dataFolder(), 'backups');
  const values = forbiddenValues([SERVER_DIRECTORY, MAIN, data, backups]);
  // 00:00 UTC has always passed: the day has no backup yet, so the server makes it at once.
  const server = undo.run({ ...GATE_ENV, NEXUS_PORT: '0', NEXUS_DATA_DIR: data, NEXUS_BACKUP_DIR: backups, NEXUS_BACKUP_TIME: '00:00' });
  await waitFor(() => server.backupLines().length === 1, 10_000);
  const [line] = server.backupLines();
  assert.deepEqual(
    { event: line.event, attempt: line.attempt, removed: line.removed },
    { event: 'backup_succeeded', attempt: 1, removed: 0 },
  );
  assert.match(line.day, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(line.bytes > 0);
  // The folder is made, and holds the day's backup only: a whole file, no partial one.
  assert.deepEqual(readdirSync(backups), [`nexus-v3-backup-${line.day}.sqlite`]);
  // It serves requests as before.
  const listening = server.lines().find((each) => each.event === 'listening');
  const answer = await send(listening.port, { path: '/api/none' });
  assert.equal(answer.status, 404);
  assertNoneIn(server.output.stdout + server.output.stderr, values);
});
