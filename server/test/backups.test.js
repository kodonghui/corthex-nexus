// The daily backup (TASK-450; TBL-170, SPEC-052, SPEC-042, rule 5): one backup a UTC day at the configured time, a
// retry 15 minutes after a failed first attempt, 30 days kept, the oldest past 30 days removed first when the disk is
// short, what a crash left running, and the warning on the owner's to-do once a retry failed. The job runs with a clock
// and timers of the test's, so a month passes in a moment; the copies are node:sqlite's own backups of a real store.

import assert from 'node:assert/strict';
import {
  existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { backup as sqliteBackup, DatabaseSync } from 'node:sqlite';
import { describe, test } from 'node:test';
import { backupName, backupWarning, createBackups, dayOf, RETRY_MS } from '../src/backups.js';
import { ROUTES } from '../src/routes.js';
import { createQueue } from '../src/writes.js';
import { seed } from './seed.js';
import {
  assertNoneIn, dataFolder, forbiddenValues, localGate, startServer, testStore,
} from './support.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const at = (text) => Date.parse(text);

// A backup job over store, writing into a folder of its own, with the test's clock and timers. The clock starts at
// start; run() fires the job's next timer, moving the clock to the time it was set for, and until(time) fires them up
// to that time and leaves the clock there.
function backupJob(t, store, { start, hour = 3, minute = 0, copy, free, directory } = {}) {
  const folder = directory ?? join(dataFolder(t, 'nexus-backups-'), 'backups');
  let clock = start;
  let pending = null;
  const timers = {
    setTimeout: (fire, ms) => {
      pending = { fire, due: clock + ms };
      return pending;
    },
    clearTimeout: (timer) => {
      if (pending === timer) pending = null;
    },
  };
  const lines = [];
  const queue = createQueue();
  const job = createBackups({
    store,
    settings: { directory: folder, hour, minute },
    queue,
    log: (line) => lines.push(line),
    now: () => clock,
    ...(copy === undefined ? {} : { copy }),
    ...(free === undefined ? {} : { free }),
    timers,
  });
  t.after(() => job.stop());
  return {
    folder,
    lines,
    queue,
    job,
    now: () => clock,
    setClock: (time) => {
      clock = time;
    },
    next: () => (pending === null ? null : pending.due),
    async run() {
      const { fire, due } = pending;
      pending = null;
      clock = Math.max(clock, due);
      await fire();
    },
    async until(time) {
      while (pending !== null && pending.due <= time) await this.run();
      clock = Math.max(clock, time);
    },
    files: () => (existsSync(folder) ? readdirSync(folder).sort() : []),
    // Plain objects, as node:sqlite's rows have no prototype.
    rows: () => store.prepare('SELECT name, attempt, state, bytes, started_at, finished_at, removed_at FROM backups ORDER BY id')
      .all().map((row) => ({ ...row })),
  };
}

// The days from first to last, YYYY-MM-DD.
function days(first, last) {
  const all = [];
  for (let time = at(`${first}T00:00:00.000Z`); time <= at(`${last}T00:00:00.000Z`); time += DAY) all.push(dayOf(time));
  return all;
}

// A kept backup of a day, as an earlier run left it: its file and its row.
function keptBackup(store, folder, day, bytes = 64) {
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, backupName(day)), Buffer.alloc(bytes));
  store.prepare(
    "INSERT INTO backups (name, attempt, state, bytes, started_at, finished_at) VALUES (?, 1, 'succeeded', ?, ?, ?)",
  ).run(backupName(day), bytes, `${day}T03:00:00.000Z`, `${day}T03:01:00.000Z`);
}

describe('the daily backup', () => {
  test('given 31 daily backups, the next one removes the oldest, and 30 remain plus the new one (SPEC-052)', async (t) => {
    const store = testStore(t);
    seed(store).project('alpha');
    const job = backupJob(t, store, { start: at('2026-10-24T03:00:00.000Z') });
    await job.job.start();
    // A backup a day from 2026-10-24 to 2026-11-23: 31 daily backups, none removed, since none is past 30 days.
    await job.until(at('2026-11-23T03:00:00.000Z'));
    assert.deepEqual(job.files(), days('2026-10-24', '2026-11-23').map(backupName));
    assert.equal(job.rows().length, 31);
    assert.ok(job.rows().every((row) => row.state === 'succeeded' && row.attempt === 1 && row.removed_at === null));
    // Each at its time: 03:00 UTC.
    assert.ok(job.rows().every((row) => row.started_at.endsWith('T03:00:00.000Z')));
    // The next one, on 2026-11-24, removes 2026-10-24, which is more than 30 days before it: 30 remain, from
    // 2026-10-25, plus the new one.
    await job.until(at('2026-11-24T03:00:00.000Z'));
    assert.deepEqual(job.files(), days('2026-10-25', '2026-11-24').map(backupName));
    const removed = job.rows().filter((row) => row.removed_at !== null);
    assert.deepEqual(removed.map((row) => [row.name, row.removed_at]), [[backupName('2026-10-24'), '2026-11-24T03:00:00.000Z']]);
    assert.equal(job.rows().filter((row) => row.removed_at === null).length, 31);
    assert.deepEqual(job.lines.at(-1), {
      time: '2026-11-24T03:00:00.000Z',
      event: 'backup_succeeded',
      day: '2026-11-24',
      attempt: 1,
      bytes: statSync(join(job.folder, backupName('2026-11-24'))).size,
      removed: 1,
      ms: 0,
    });
  });

  test('a backup is a whole copy of the store, made while the writes wait and the reads go on', async (t) => {
    const store = testStore(t);
    seed(store).project('alpha');
    let release;
    const started = new Promise((resolve) => {
      release = resolve;
    });
    let copying = null;
    // The copy waits until the test lets it go.
    const copy = async (db, path) => {
      copying = path;
      await started;
      return sqliteBackup(db, path);
    };
    const job = backupJob(t, store, { start: at('2026-11-24T03:00:00.000Z'), copy });
    const done = job.job.start();
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(copying.endsWith(`${backupName('2026-11-24')}.partial`));
    // A write waits in the queue; a read does not.
    let wrote = false;
    const write = job.queue(() => {
      seed(store).project('bravo');
      wrote = true;
    });
    assert.equal(store.prepare('SELECT count(*) AS n FROM project_spaces').get().n, 1);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(wrote, false);
    assert.deepEqual(job.rows().map((row) => row.state), ['running']);
    release();
    await done;
    await write;
    assert.equal(wrote, true);
    // The copy holds the store as it was when the backup ran: the first project, not the one written after.
    const copyDb = new DatabaseSync(join(job.folder, backupName('2026-11-24')), { readOnly: true });
    try {
      assert.deepEqual(copyDb.prepare('SELECT name FROM project_spaces').all().map((row) => row.name), ['alpha']);
      assert.equal(copyDb.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    } finally {
      copyDb.close();
    }
    assert.deepEqual(job.rows().map((row) => [row.state, row.bytes]), [['succeeded', statSync(join(job.folder, backupName('2026-11-24'))).size]]);
  });

  test('backs up at start when the day\'s time has passed without a backup, and waits for the time otherwise', async (t) => {
    // Before the day's time: nothing until 04:30, then the day's backup.
    const store = testStore(t);
    const early = backupJob(t, store, { start: at('2026-11-24T01:10:00.000Z'), hour: 4, minute: 30 });
    await early.job.start();
    assert.deepEqual(early.rows(), []);
    // It looks again within the hour, so a clock set meanwhile is noticed.
    assert.equal(early.next(), at('2026-11-24T02:10:00.000Z'));
    await early.until(at('2026-11-24T04:29:59.999Z'));
    assert.deepEqual(early.rows(), []);
    await early.run();
    assert.equal(early.now(), at('2026-11-24T04:30:00.000Z'));
    assert.deepEqual(early.rows().map((row) => [row.name, row.state]), [[backupName('2026-11-24'), 'succeeded']]);
    early.job.stop();

    // After it, with no backup that day: at once.
    const late = backupJob(t, testStore(t), { start: at('2026-11-24T22:45:00.000Z'), hour: 4, minute: 30 });
    await late.job.start();
    assert.deepEqual(late.rows().map((row) => [row.name, row.started_at]), [[backupName('2026-11-24'), '2026-11-24T22:45:00.000Z']]);
    // The next is the next day's.
    await late.until(at('2026-11-25T04:30:00.000Z'));
    assert.deepEqual(late.files(), [backupName('2026-11-24'), backupName('2026-11-25')]);
    late.job.stop();

    // After it, with the day's backup made: nothing more that day.
    const again = backupJob(t, store, { start: at('2026-11-24T23:00:00.000Z'), hour: 4, minute: 30, directory: early.folder });
    await again.job.start();
    assert.equal(again.rows().length, 1);
    assert.equal(again.next(), at('2026-11-25T00:00:00.000Z'));
  });

  test('retries a failed first attempt 15 minutes later under the same name, and a retry that succeeds warns of nothing', async (t) => {
    const store = testStore(t);
    let calls = 0;
    const copy = async (db, path) => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error('the disk said no'), { code: 'EIO' });
      return sqliteBackup(db, path);
    };
    const job = backupJob(t, store, { start: at('2026-11-24T03:00:00.000Z'), copy });
    await job.job.start();
    // The first attempt failed and left no file; its retry is due 15 minutes after it.
    assert.deepEqual(job.files(), []);
    assert.deepEqual(job.rows().map((row) => [row.attempt, row.state, row.finished_at]), [[1, 'failed', '2026-11-24T03:00:00.000Z']]);
    assert.equal(job.next(), at('2026-11-24T03:00:00.000Z') + RETRY_MS);
    assert.deepEqual(job.lines, [{ time: '2026-11-24T03:00:00.000Z', event: 'backup_failed', day: '2026-11-24', attempt: 1, error: 'Error EIO' }]);
    // A first attempt that failed is not the end while its retry is due.
    assert.equal(backupWarning(store), null);
    await job.run();
    assert.deepEqual(
      job.rows().map((row) => [row.name, row.attempt, row.state, row.started_at]),
      [[backupName('2026-11-24'), 1, 'failed', '2026-11-24T03:00:00.000Z'], [backupName('2026-11-24'), 2, 'succeeded', '2026-11-24T03:15:00.000Z']],
    );
    assert.deepEqual(job.files(), [backupName('2026-11-24')]);
    assert.equal(backupWarning(store), null);
    // The next is the next day's first attempt.
    assert.equal(job.next(), at('2026-11-24T04:15:00.000Z'));
    await job.until(at('2026-11-25T03:00:00.000Z'));
    assert.deepEqual(job.rows().at(-1).name, backupName('2026-11-25'));
  });

  test('a failed backup shows on the owner\'s to-do after its retry failed, until a backup succeeds (SPEC-042)', async (t) => {
    const store = testStore(t);
    const local = localGate();
    const server = await startServer({ store, gate: local.gate, routes: ROUTES });
    t.after(() => server.close());
    const warning = async () => {
      const answer = await server.send({ path: '/api/todo', headers: { 'Cf-Access-Jwt-Assertion': local.token() } });
      assert.equal(answer.status, 200);
      return answer.json.backup;
    };
    const job = backupJob(t, store, { start: at('2026-11-23T03:00:00.000Z') });
    await job.job.start();
    assert.equal(await warning(), null);
    // The folder is taken by a file: the next day's attempts cannot write, for a real reason.
    const away = `${job.folder}-away`;
    renameSync(job.folder, away);
    writeFileSync(job.folder, 'not a folder');
    await job.until(at('2026-11-24T03:00:00.000Z'));
    assert.deepEqual(job.rows().at(-1), {
      name: backupName('2026-11-24'), attempt: 1, state: 'failed', bytes: null,
      started_at: '2026-11-24T03:00:00.000Z', finished_at: '2026-11-24T03:00:00.000Z', removed_at: null,
    });
    // Not yet: the retry is due.
    assert.equal(await warning(), null);
    await job.until(at('2026-11-24T03:15:00.000Z'));
    assert.deepEqual(job.rows().at(-1).attempt, 2);
    // The retry failed too: the warning shows, with the last backup that succeeded.
    assert.deepEqual(await warning(), { failed_at: '2026-11-24T03:15:00.000Z', last_succeeded_at: '2026-11-23T03:00:00.000Z' });
    // Nothing was removed after the failure, and nothing more runs that day.
    assert.equal(job.next(), at('2026-11-24T04:15:00.000Z'));
    // The folder comes back; the next day's backup succeeds and the warning goes.
    rmSync(job.folder);
    renameSync(away, job.folder);
    await job.until(at('2026-11-25T03:00:00.000Z'));
    assert.equal(await warning(), null);
    assert.deepEqual(job.files(), [backupName('2026-11-23'), backupName('2026-11-25')]);
    // The lines say what failed, never where.
    const values = forbiddenValues([job.folder, away]);
    assertNoneIn(JSON.stringify(job.lines), values);
    assert.deepEqual(job.lines.map((line) => [line.event, line.day, line.attempt]), [
      ['backup_succeeded', '2026-11-23', 1],
      ['backup_failed', '2026-11-24', 1],
      ['backup_failed', '2026-11-24', 2],
      ['backup_succeeded', '2026-11-25', 1],
    ]);
  });

  test('at start, an attempt a crash left running is recorded failed, and its retry runs at once', async (t) => {
    const store = testStore(t);
    const folder = join(dataFolder(t, 'nexus-backups-'), 'backups');
    mkdirSync(folder);
    // A first attempt that was running when the server stopped, with its partial file, and a file of another kind.
    store.prepare("INSERT INTO backups (name, attempt, state, started_at) VALUES (?, 1, 'running', '2026-11-24T03:00:00.000Z')")
      .run(backupName('2026-11-24'));
    writeFileSync(join(folder, `${backupName('2026-11-24')}.partial`), 'half');
    writeFileSync(join(folder, 'notes.txt'), 'the operator\'s');
    const job = backupJob(t, store, { start: at('2026-11-24T03:05:00.000Z'), directory: folder });
    await job.job.start();
    assert.deepEqual(
      job.rows().map((row) => [row.attempt, row.state, row.started_at, row.finished_at]),
      [[1, 'failed', '2026-11-24T03:00:00.000Z', '2026-11-24T03:05:00.000Z'], [2, 'succeeded', '2026-11-24T03:05:00.000Z', '2026-11-24T03:05:00.000Z']],
    );
    assert.deepEqual(job.files(), [backupName('2026-11-24'), 'notes.txt']);
    assert.deepEqual(job.lines.map((line) => [line.event, line.attempt, line.reason]), [
      ['backup_failed', 1, 'interrupted'],
      ['backup_succeeded', 2, undefined],
    ]);
    assert.equal(backupWarning(store), null);
    job.job.stop();

    // A retry left running is the end: it is recorded failed, nothing more runs, and the warning shows.
    store.prepare("INSERT INTO backups (name, attempt, state, started_at, finished_at) VALUES (?, 1, 'failed', ?, ?)")
      .run(backupName('2026-11-25'), '2026-11-25T03:00:00.000Z', '2026-11-25T03:00:00.000Z');
    store.prepare("INSERT INTO backups (name, attempt, state, started_at) VALUES (?, 2, 'running', '2026-11-25T03:15:00.000Z')")
      .run(backupName('2026-11-25'));
    const after = backupJob(t, store, { start: at('2026-11-25T03:20:00.000Z'), directory: folder });
    await after.job.start();
    assert.equal(after.rows().length, 4);
    assert.deepEqual(backupWarning(store), { failed_at: '2026-11-25T03:20:00.000Z', last_succeeded_at: '2026-11-24T03:05:00.000Z' });
    assert.equal(after.next(), at('2026-11-25T04:20:00.000Z'));
  });

  test('a retry the server missed runs at start, even past the hour', async (t) => {
    const store = testStore(t);
    store.prepare("INSERT INTO backups (name, attempt, state, started_at, finished_at) VALUES (?, 1, 'failed', ?, ?)")
      .run(backupName('2026-11-24'), '2026-11-24T03:00:00.000Z', '2026-11-24T03:01:00.000Z');
    // Started again at 05:00 the same day, after the retry's time.
    const job = backupJob(t, store, { start: at('2026-11-24T05:00:00.000Z') });
    await job.job.start();
    assert.deepEqual(job.rows().map((row) => [row.attempt, row.state, row.started_at]), [
      [1, 'failed', '2026-11-24T03:00:00.000Z'],
      [2, 'succeeded', '2026-11-24T05:00:00.000Z'],
    ]);
    // Started before the retry's time, it waits for it.
    const store2 = testStore(t);
    store2.prepare("INSERT INTO backups (name, attempt, state, started_at, finished_at) VALUES (?, 1, 'failed', ?, ?)")
      .run(backupName('2026-11-24'), '2026-11-24T03:00:00.000Z', '2026-11-24T03:01:00.000Z');
    const soon = backupJob(t, store2, { start: at('2026-11-24T03:05:00.000Z') });
    await soon.job.start();
    assert.equal(soon.rows().length, 1);
    assert.equal(soon.next(), at('2026-11-24T03:16:00.000Z'));
    // When the next day's time came while the server was stopped, that day's backup runs instead.
    const store3 = testStore(t);
    store3.prepare("INSERT INTO backups (name, attempt, state, started_at, finished_at) VALUES (?, 1, 'failed', ?, ?)")
      .run(backupName('2026-11-24'), '2026-11-24T03:00:00.000Z', '2026-11-24T03:01:00.000Z');
    const nextDay = backupJob(t, store3, { start: at('2026-11-25T09:00:00.000Z') });
    await nextDay.job.start();
    assert.deepEqual(nextDay.rows().map((row) => [row.name, row.attempt, row.state]), [
      [backupName('2026-11-24'), 1, 'failed'],
      [backupName('2026-11-25'), 1, 'succeeded'],
    ]);
    assert.equal(backupWarning(store3), null);
  });

  test('when the disk is short, the backups past 30 days go first, the oldest first, never a newer one', async (t) => {
    const store = testStore(t);
    const folder = join(dataFolder(t, 'nexus-backups-'), 'backups');
    const kept = ['2026-10-14', '2026-10-19', '2026-10-24', '2026-10-25', '2026-11-23'];
    for (const day of kept) keptBackup(store, folder, day);
    const size = Number(store.prepare('SELECT page_count * page_size AS n FROM pragma_page_count(), pragma_page_size()').get().n);
    // Room for the backup once two old backups are gone; the copy fails, so the usual removal after a success does
    // not run, and what was removed for room is seen alone.
    const present = () => kept.filter((day) => existsSync(join(folder, backupName(day))));
    const roomAfterTwo = () => (kept.length - present().length >= 2 ? size : size - 1);
    const failing = async () => {
      throw Object.assign(new Error('copy failed'), { code: 'EIO' });
    };
    const job = backupJob(t, store, { start: at('2026-11-24T03:00:00.000Z'), directory: folder, free: roomAfterTwo, copy: failing });
    await job.job.start();
    // 2026-10-14 and 2026-10-19 went, the oldest first; 2026-10-24 is past 30 days too but was not needed.
    assert.deepEqual(present(), ['2026-10-24', '2026-10-25', '2026-11-23']);
    assert.deepEqual(
      job.rows().filter((row) => row.removed_at !== null).map((row) => row.name),
      [backupName('2026-10-14'), backupName('2026-10-19')],
    );
    assert.equal(job.lines.at(-1).event, 'backup_failed');
    job.job.stop();

    // Never enough room: every backup past 30 days goes, none newer, and the attempt fails without writing.
    const short = backupJob(t, store, { start: at('2026-11-24T03:15:00.000Z'), directory: folder, free: () => size - 1 });
    await short.job.start();
    assert.deepEqual(present(), ['2026-10-25', '2026-11-23']);
    assert.deepEqual(short.files(), [backupName('2026-10-25'), backupName('2026-11-23')]);
    assert.deepEqual(short.rows().at(-1), {
      name: backupName('2026-11-24'), attempt: 2, state: 'failed', bytes: null,
      started_at: '2026-11-24T03:15:00.000Z', finished_at: '2026-11-24T03:15:00.000Z', removed_at: null,
    });
    assert.deepEqual(short.lines, [{ time: '2026-11-24T03:15:00.000Z', event: 'backup_failed', day: '2026-11-24', attempt: 2, reason: 'not_enough_disk' }]);
    assert.deepEqual(backupWarning(store), { failed_at: '2026-11-24T03:15:00.000Z', last_succeeded_at: '2026-11-23T03:01:00.000Z' });
  });

  test('a store that cannot be written is looked at again within the hour, without a loop', async (t) => {
    const store = testStore(t);
    const job = backupJob(t, store, { start: at('2026-11-24T03:00:00.000Z') });
    // The backups' table cannot take a row, as when the store's disk fails.
    store.exec("CREATE TRIGGER no_backup BEFORE INSERT ON backups BEGIN SELECT RAISE(ABORT, 'no room'); END");
    await job.job.start();
    assert.deepEqual(job.rows(), []);
    assert.equal(job.next(), at('2026-11-24T04:00:00.000Z'));
    assert.deepEqual(job.lines.map((line) => [line.event, line.error]), [['backup_job_failed', 'Error ERR_SQLITE_ERROR']]);
    store.exec('DROP TRIGGER no_backup');
    await job.run();
    assert.deepEqual(job.rows().map((row) => row.state), ['succeeded']);
  });

  test('the schedule starts even when what a crash left cannot be recorded', async (t) => {
    const store = testStore(t);
    store.prepare("INSERT INTO backups (name, attempt, state, started_at) VALUES (?, 1, 'running', '2026-11-23T03:00:00.000Z')")
      .run(backupName('2026-11-23'));
    // No row can be marked failed, so the attempt left running cannot be recorded.
    store.exec("CREATE TRIGGER no_failure BEFORE UPDATE OF state ON backups WHEN NEW.state = 'failed' BEGIN SELECT RAISE(ABORT, 'no'); END");
    const job = backupJob(t, store, { start: at('2026-11-24T03:00:00.000Z') });
    await job.job.start();
    assert.deepEqual(job.lines.map((line) => [line.event, line.day, line.error]), [
      ['backup_job_failed', undefined, 'Error ERR_SQLITE_ERROR'],
      ['backup_succeeded', '2026-11-24', undefined],
    ]);
    assert.deepEqual(job.files(), [backupName('2026-11-24')]);
    // It looks again within the hour, as it always does.
    assert.equal(job.next(), at('2026-11-24T04:00:00.000Z'));
  });

  test('a backup whose row cannot say it succeeded leaves no file, and a removal that fails never fails a backup', async (t) => {
    const store = testStore(t);
    const folder = join(dataFolder(t, 'nexus-backups-'), 'backups');
    keptBackup(store, folder, '2026-10-20');
    // The copy is whole and has its name, but its row cannot be marked succeeded: the attempt failed, and its file goes.
    store.exec("CREATE TRIGGER no_success BEFORE UPDATE OF state ON backups WHEN NEW.state = 'succeeded' BEGIN SELECT RAISE(ABORT, 'no'); END");
    const job = backupJob(t, store, { start: at('2026-11-24T03:00:00.000Z'), directory: folder });
    await job.job.start();
    assert.deepEqual(job.files(), [backupName('2026-10-20')]);
    assert.deepEqual(job.rows().at(-1).state, 'failed');
    assert.deepEqual(job.lines.at(-1), { time: '2026-11-24T03:00:00.000Z', event: 'backup_failed', day: '2026-11-24', attempt: 1, error: 'Error ERR_SQLITE_ERROR' });
    store.exec('DROP TRIGGER no_success');
    // The retry succeeds, but the backup past 30 days cannot be recorded removed: the backup stays succeeded with its
    // file, the old one stays, and the removal is logged apart.
    store.exec("CREATE TRIGGER no_removal BEFORE UPDATE OF removed_at ON backups BEGIN SELECT RAISE(ABORT, 'no'); END");
    await job.run();
    assert.deepEqual(job.rows().at(-1).state, 'succeeded');
    assert.deepEqual(job.files(), [backupName('2026-10-20'), backupName('2026-11-24')]);
    assert.deepEqual(job.lines.slice(-2).map((line) => [line.event, line.day, line.attempt, line.removed, line.error]), [
      ['backup_succeeded', '2026-11-24', 2, 0, undefined],
      ['backup_removal_failed', '2026-11-24', undefined, undefined, 'Error ERR_SQLITE_ERROR'],
    ]);
    assert.equal(backupWarning(store), null);
    // The next success removes it.
    store.exec('DROP TRIGGER no_removal');
    await job.until(at('2026-11-25T03:00:00.000Z'));
    assert.deepEqual(job.files(), [backupName('2026-11-24'), backupName('2026-11-25')]);
    assert.equal(job.rows().find((row) => row.name === backupName('2026-10-20')).removed_at, '2026-11-25T03:00:00.000Z');
  });

  test('a backup the store has no row of, as after a restore from an older backup, is removed past 30 days too', async (t) => {
    const store = testStore(t);
    const folder = join(dataFolder(t, 'nexus-backups-'), 'backups');
    mkdirSync(folder, { recursive: true });
    for (const day of ['2026-10-20', '2026-10-30']) writeFileSync(join(folder, backupName(day)), 'a backup');
    // A folder of a backup's name is no backup.
    mkdirSync(join(folder, backupName('2026-10-01')));
    const job = backupJob(t, store, { start: at('2026-11-24T03:00:00.000Z'), directory: folder });
    await job.job.start();
    assert.deepEqual(job.files(), [backupName('2026-10-01'), backupName('2026-10-30'), backupName('2026-11-24')]);
    assert.equal(job.lines.at(-1).removed, 1);
  });

  test('stop() ends the schedule', async (t) => {
    const store = testStore(t);
    const job = backupJob(t, store, { start: at('2026-11-24T01:00:00.000Z') });
    await job.job.start();
    assert.notEqual(job.next(), null);
    job.job.stop();
    assert.equal(job.next(), null);
  });

  test('a backup is readable by its owner only, in a folder only its owner opens', { skip: process.platform === 'win32' && 'Windows keeps no POSIX mode' }, async (t) => {
    const store = testStore(t);
    const job = backupJob(t, store, { start: at('2026-11-24T03:00:00.000Z') });
    await job.job.start();
    assert.equal(statSync(join(job.folder, backupName('2026-11-24'))).mode & 0o777, 0o600);
    assert.equal(statSync(job.folder).mode & 0o777, 0o700);
  });
});
