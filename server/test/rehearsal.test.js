// The restore rehearsal before a release (TASK-450; TBL-171, SPEC-052, REQ-080, rule 5): the latest backup is restored
// into a fresh store and read, and the result is recorded for the release; a check that fails is recorded failed with
// the check's name and no path, and with no backup nothing is recorded. The command, node src/rehearse.js, is run as
// the release step runs it.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  closeSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, writeSync,
} from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import { backupName, createBackups } from '../src/backups.js';
import { rehearse, RehearsalRefused } from '../src/rehearsal.js';
import {
  openExistingStore, openStore, readMigrations, STORE_FILE, StoreError,
} from '../src/store.js';
import { createQueue } from '../src/writes.js';
import { seed } from './seed.js';
import { assertNoneIn, dataFolder, forbiddenValues, testStore } from './support.js';

const SERVER_DIRECTORY = fileURLToPath(new URL('..', import.meta.url));
const REHEARSE = fileURLToPath(new URL('../src/rehearse.js', import.meta.url));
const VERSION = readMigrations().length;
const at = (text) => Date.parse(text);

// Backs up store once on each day, as the daily job does at 03:00 UTC, into folder.
async function backUp(store, folder, ...days) {
  for (const day of days) {
    const job = createBackups({
      store,
      settings: { directory: folder, hour: 3, minute: 0 },
      queue: createQueue(),
      log: () => {},
      now: () => at(`${day}T03:00:00.000Z`),
      timers: { setTimeout: () => null, clearTimeout: () => {} },
    });
    await job.start();
    job.stop();
  }
}

// Every table of the store and how many rows they hold together.
function contents(db) {
  const tables = db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((row) => row.name);
  let rows = 0;
  for (const table of tables) rows += Number(db.prepare(`SELECT count(*) AS n FROM "${table}"`).get().n);
  return { tables: tables.length, rows };
}

const rehearsals = (db) => db.prepare('SELECT release, backup_id, result, rehearsed_at, note FROM restore_rehearsals ORDER BY id')
  .all().map((row) => ({ ...row }));
const backupId = (db, day) => Number(db.prepare("SELECT id FROM backups WHERE name = ? AND state = 'succeeded'").get(backupName(day)).id);

describe('the restore rehearsal', () => {
  test('restores the latest backup into a fresh store, reads it and records it for the release (REQ-080)', async (t) => {
    const store = testStore(t);
    const folder = dataFolder(t, 'nexus-backups-');
    const work = dataFolder(t, 'nexus-work-');
    const s = seed(store);
    s.thread(s.diagram(s.project('alpha')));
    await backUp(store, folder, '2026-11-23');
    s.diagram(s.project('bravo'));
    await backUp(store, folder, '2026-11-24');
    // What the latest backup holds: the store as it was when it was made.
    const held = contents(store);
    const record = rehearse({ store, backupDirectory: folder, release: 'v3.0.0', now: () => at('2026-11-25T09:00:00.000Z'), workDirectory: work });
    assert.deepEqual(record, {
      id: record.id,
      release: 'v3.0.0',
      backup: { id: backupId(store, '2026-11-24'), day: '2026-11-24' },
      result: 'succeeded',
      rehearsed_at: '2026-11-25T09:00:00.000Z',
      note: `restored at version ${VERSION}: ${held.tables} tables, ${held.rows} rows read`,
    });
    assert.deepEqual(rehearsals(store), [{
      release: 'v3.0.0', backup_id: record.backup.id, result: 'succeeded', rehearsed_at: '2026-11-25T09:00:00.000Z', note: record.note,
    }]);
    // The fresh folder is gone, and the backups are as they were.
    assert.deepEqual(readdirSync(work), []);
    assert.deepEqual(readdirSync(folder).sort(), [backupName('2026-11-23'), backupName('2026-11-24')]);

    // A backup whose file was removed is not the latest: the one before it is rehearsed.
    store.prepare("UPDATE backups SET removed_at = '2026-11-25T10:00:00.000Z' WHERE name = ?").run(backupName('2026-11-24'));
    const earlier = rehearse({ store, backupDirectory: folder, release: 'v3.0.1', workDirectory: work });
    assert.equal(earlier.result, 'succeeded');
    assert.deepEqual(earlier.backup, { id: backupId(store, '2026-11-23'), day: '2026-11-23' });
  });

  test('a check that fails is recorded failed, naming the check and never a path', async (t) => {
    const store = testStore(t);
    const folder = dataFolder(t, 'nexus-backups-');
    const work = dataFolder(t, 'nexus-work-');
    const s = seed(store);
    for (let index = 0; index < 40; index += 1) s.project(`project-${index}`);
    await backUp(store, folder, '2026-11-24');
    const file = join(folder, backupName('2026-11-24'));
    const values = forbiddenValues([folder, work]);
    const failed = (release) => {
      const record = rehearse({ store, backupDirectory: folder, release, workDirectory: work });
      assert.equal(record.result, 'failed');
      assertNoneIn(record.note, values);
      assert.deepEqual(readdirSync(work), []);
      return record.note;
    };
    const whole = readFileSync(file);
    // Its tables' pages are damaged.
    const descriptor = openSync(file, 'r+');
    writeSync(descriptor, Buffer.alloc(4096, 0x5a), 0, 4096, statSync(file).size - 4096 * 3);
    closeSync(descriptor);
    assert.match(failed('v3.0.0'), /^integrity failed/);
    // It is not a NEXUS v3 store.
    writeFileSync(file, `not a store ${values.refusedText}`);
    assert.equal(failed('v3.0.1'), 'open failed: not_a_v3_store');
    // Its rows point at rows it does not have.
    writeFileSync(file, whole);
    const damaged = new DatabaseSync(file);
    damaged.exec('PRAGMA foreign_keys = OFF');
    damaged.prepare("INSERT INTO restore_rehearsals (release, backup_id, result, rehearsed_at) VALUES ('x', 999, 'failed', 'y')").run();
    damaged.close();
    assert.equal(failed('v3.0.2'), 'foreign_keys failed: 1 rows');
    // Its file is gone.
    rmSync(file);
    assert.equal(failed('v3.0.3'), 'copy failed: Error ENOENT');
    assert.deepEqual(rehearsals(store).map((row) => [row.release, row.result]), [
      ['v3.0.0', 'failed'], ['v3.0.1', 'failed'], ['v3.0.2', 'failed'], ['v3.0.3', 'failed'],
    ]);
  });

  test('works in the backups\' folder, and first removes the folder a killed rehearsal left there', async (t) => {
    const store = testStore(t);
    const folder = dataFolder(t, 'nexus-backups-');
    seed(store).project('alpha');
    await backUp(store, folder, '2026-11-24');
    // What a rehearsal killed before its end left: its folder, with its copy of the store.
    const left = join(folder, 'nexus-rehearsal-Ab12Cd');
    mkdirSync(left);
    writeFileSync(join(left, STORE_FILE), 'a copy of the store');
    writeFileSync(join(folder, 'nexus-rehearsal-log.txt'), 'the operator\'s');
    assert.equal(rehearse({ store, backupDirectory: folder, release: 'v3.0.0' }).result, 'succeeded');
    assert.deepEqual(readdirSync(folder).sort(), ['nexus-rehearsal-log.txt', backupName('2026-11-24')]);
    // A backups' folder that is gone is a copy that failed.
    const gone = join(folder, 'gone');
    assert.equal(rehearse({ store, backupDirectory: gone, release: 'v3.0.1' }).note, 'copy failed: Error ENOENT');
  });

  test('records nothing with no backup to rehearse, or with a release that is not a name', async (t) => {
    const store = testStore(t);
    const folder = dataFolder(t, 'nexus-backups-');
    const refused = (release, reason) => assert.throws(
      () => rehearse({ store, backupDirectory: folder, release }),
      (error) => error instanceof RehearsalRefused && error.reason === reason,
    );
    refused('v3.0.0', 'no_backup');
    // A backup that failed, or whose file was removed, is none to rehearse.
    store.prepare("INSERT INTO backups (name, attempt, state, started_at, finished_at) VALUES (?, 1, 'failed', 'a', 'b')").run(backupName('2026-11-23'));
    store.prepare("INSERT INTO backups (name, attempt, state, started_at, finished_at, removed_at) VALUES (?, 1, 'succeeded', 'a', 'b', 'c')").run(backupName('2026-11-22'));
    refused('v3.0.0', 'no_backup');
    await backUp(store, folder, '2026-11-24');
    for (const release of ['', '-v3', 'v3 0', 'v3/0', `v${'1'.repeat(64)}`, 'ü3']) refused(release, 'release_invalid');
    assert.deepEqual(rehearsals(store), []);
    assert.equal(rehearse({ store, backupDirectory: folder, release: 'v3.0.0-rc.1+build_2' }).result, 'succeeded');
  });

  test('the command opens the store as it is, never creating one or applying a migration', (t) => {
    const folder = dataFolder(t, 'nexus-data-');
    assert.throws(() => openExistingStore(folder), (error) => error instanceof StoreError && error.reason === 'no_store');
    assert.deepEqual(readdirSync(folder), []);
    writeFileSync(join(folder, STORE_FILE), 'not a store');
    assert.throws(() => openExistingStore(folder), (error) => error.reason === 'not_a_v3_store');
    rmSync(join(folder, STORE_FILE));
    // A store marked as one no migration was applied to: openStore would apply them again, openExistingStore does not.
    const { db } = openStore(folder);
    db.exec('PRAGMA user_version = 0');
    db.close();
    const opened = openExistingStore(folder);
    try {
      assert.equal(Number(opened.prepare('PRAGMA user_version').get().user_version), 0);
    } finally {
      opened.close();
    }
  });
});

describe('node src/rehearse.js', () => {
  // Runs the command with these settings and arguments: { code, lines, text }.
  async function run(env, args) {
    const child = spawn(process.execPath, [REHEARSE, ...args], {
      cwd: SERVER_DIRECTORY,
      env: { ...(process.env.SYSTEMROOT ? { SYSTEMROOT: process.env.SYSTEMROOT } : {}), ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let text = '';
    child.stdout.on('data', (chunk) => { text += chunk; });
    child.stderr.on('data', (chunk) => { text += chunk; });
    const [code] = await once(child, 'close');
    return { code, text, lines: text.split('\n').filter((line) => line !== '').map((line) => JSON.parse(line)) };
  }

  test('records the rehearsal and exits 0 when it succeeded, 1 when it failed or had no backup, 2 when called wrong', async (t) => {
    const data = dataFolder(t, 'nexus-data-');
    const backups = dataFolder(t, 'nexus-backups-');
    const env = { NEXUS_DATA_DIR: data, NEXUS_BACKUP_DIR: backups };
    const values = forbiddenValues([SERVER_DIRECTORY, REHEARSE, data, backups]);
    const { db } = openStore(data);
    seed(db).project('alpha');
    db.close();

    // No backup yet: nothing is recorded.
    const none = await run(env, ['v3.0.0']);
    assert.equal(none.code, 1);
    assert.deepEqual(none.lines.map((line) => [line.event, line.reason]), [['rehearsal_refused', 'no_backup']]);

    const live = openExistingStore(data);
    try {
      await backUp(live, backups, '2026-11-24');
    } finally {
      live.close();
    }
    const done = await run(env, ['v3.0.0']);
    assert.equal(done.code, 0);
    assert.deepEqual(
      done.lines.map(({ event, release, backup, result }) => ({ event, release, backup, result })),
      [{ event: 'rehearsal_recorded', release: 'v3.0.0', backup: '2026-11-24', result: 'succeeded' }],
    );
    assert.match(done.lines[0].note, /^restored at version \d+: \d+ tables, \d+ rows read$/);

    writeFileSync(join(backups, backupName('2026-11-24')), `not a store ${values.refusedText}`);
    const failed = await run(env, ['v3.0.1']);
    assert.equal(failed.code, 1);
    assert.deepEqual(
      failed.lines.map(({ event, result, note }) => ({ event, result, note })),
      [{ event: 'rehearsal_recorded', result: 'failed', note: 'open failed: not_a_v3_store' }],
    );

    // Called wrong: no release, two, one that is not a name, or settings missing.
    for (const [args, runEnv, event] of [
      [[], env, 'rehearsal_refused'],
      [['v3.0.2', 'v3.0.3'], env, 'rehearsal_refused'],
      [['v3 0 2'], env, 'rehearsal_refused'],
      [['v3.0.2'], { NEXUS_DATA_DIR: data }, 'settings_invalid'],
    ]) {
      const wrong = await run(runEnv, args);
      assert.equal(wrong.code, 2, JSON.stringify(args));
      assert.deepEqual(wrong.lines.map((line) => line.event), [event]);
    }
    // No store in the data folder: none is made.
    const empty = dataFolder(t, 'nexus-data-');
    const missing = await run({ NEXUS_DATA_DIR: empty, NEXUS_BACKUP_DIR: backups }, ['v3.0.2']);
    assert.equal(missing.code, 1);
    assert.deepEqual(missing.lines.map((line) => [line.event, line.reason]), [['store_refused', 'no_store']]);
    assert.deepEqual(readdirSync(empty), []);

    const check = openExistingStore(data);
    try {
      assert.deepEqual(rehearsals(check).map((row) => [row.release, row.result]), [['v3.0.0', 'succeeded'], ['v3.0.1', 'failed']]);
    } finally {
      check.close();
    }
    for (const each of [none, done, failed, missing]) assertNoneIn(each.text, values);
  });
});
