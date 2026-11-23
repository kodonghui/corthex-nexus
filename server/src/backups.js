// The daily backups (TBL-170; SPEC-042, SPEC-052): the backup job of TASK-450, and the warning on the owner's to-do and
// the project list while the last daily backup failed (TASK-439).
//
// The job runs in the server (main.js), not as a request: the contract names no operation for it. Each attempt copies
// the store with node:sqlite's own backup() into the folder NEXUS_BACKUP_DIR names, as one task of the server's write
// queue (writes.js): the store is one connection, which cannot back up while a write's transaction is open, so the
// writes wait for the backup while the reads go on. Its rules, as decided for TASK-450:
//
// - One backup a UTC day, named by its day, nexus-v3-backup-YYYY-MM-DD.sqlite, at the time NEXUS_BACKUP_TIME gives. A
//   server that starts after the day's time, when the day has no attempt yet, backs up at once, so a restart after
//   that time does not skip the day.
// - A first attempt that fails is retried once, 15 minutes after it failed, under the same name (attempt 2). A retry
//   that fails is the end: the warning below shows it. At start, an attempt left running, as by a crash, is recorded
//   failed, and a retry that was missed so runs at once.
// - After a backup succeeds, the backups whose day is more than 30 days before its day are removed; nothing is removed
//   after a failure, so the last good backups stay while backups fail. They are found by their files' names in the
//   folder, so a backup whose row the store does not hold, as after a restore from an older backup, goes too. A
//   removal that fails leaves the backup that succeeded as it is, and the next success removes them.
// - Not enough disk: before an attempt, when the folder's free space is less than the store's size, the backups past
//   30 days go first, the oldest first, never a newer one; when it is still short, the attempt fails without writing.
// - An attempt writes name.partial, readable by its owner only like the store, and renames it when it is complete, so
//   a file of the backup's name is always whole; a failed attempt leaves no file. A row's removed_at is when its file
//   was removed.
// - A job that cannot read or write the store logs backup_job_failed and looks again within the hour, so the schedule
//   never stops while the server runs.
//
// The warning (BackupWarning) shows once a backup failed for good, which is when its retry failed (attempt 2): a
// first attempt that failed is not the end while its retry is due (SPEC-052). It stays until a later backup succeeds
// (SPEC-042). So it is read from the latest backup that ended for good, by the time it started: a retry that failed
// shows the warning, a backup that succeeded shows none, and the rows still running or whose first attempt failed
// change nothing.
//
// The job's log lines name the backup's day, its attempt, its size and the kind of error, never a path (rule 5).

import {
  chmodSync, closeSync, mkdirSync, openSync, readdirSync, renameSync, rmSync, statfsSync, statSync,
} from 'node:fs';
import { join } from 'node:path';
import { backup as sqliteBackup } from 'node:sqlite';
import { errorKind } from './log.js';

// How long after a failed first attempt its retry runs: within the hour (SPEC-052).
export const RETRY_MS = 15 * 60_000;
// How many days a backup is kept (SPEC-052).
export const KEEP_DAYS = 30;
// The longest the job sleeps before it looks again, so that a clock that was set meanwhile is noticed within the hour.
const LOOK_AGAIN_MS = 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
const NAME = /^nexus-v3-backup-(\d{4}-\d{2}-\d{2})\.sqlite$/;
const PARTIAL = /^nexus-v3-backup-\d{4}-\d{2}-\d{2}\.sqlite\.partial$/;

// The file name of the backup of a day, YYYY-MM-DD in UTC.
export const backupName = (day) => `nexus-v3-backup-${day}.sqlite`;
// The day a backup's name names, or null for a name that is not one.
export const dayOfName = (name) => NAME.exec(name)?.[1] ?? null;
// The UTC day of a time in milliseconds, YYYY-MM-DD.
export const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const startOf = (day) => Date.parse(`${day}T00:00:00.000Z`);
const daysBefore = (day, days) => dayOf(startOf(day) - days * DAY_MS);
const iso = (ms) => new Date(ms).toISOString();

// An attempt that does not start because the folder has too little room, even with the backups past 30 days gone.
class NotEnoughDisk extends Error {}

// The statements of each store, prepared on first use (see credentials.js).
const prepared = new WeakMap();

function statementsOf(store) {
  let statements = prepared.get(store);
  if (statements === undefined) {
    statements = {
      ended: store.prepare(
        `SELECT state, started_at, finished_at FROM backups
         WHERE state = 'succeeded' OR (state = 'failed' AND attempt = 2)
         ORDER BY started_at DESC, id DESC LIMIT 1`,
      ),
      succeeded: store.prepare(
        "SELECT started_at, finished_at FROM backups WHERE state = 'succeeded' ORDER BY started_at DESC, id DESC LIMIT 1",
      ),
      // The job's own.
      latest: store.prepare('SELECT name FROM backups ORDER BY started_at DESC, id DESC LIMIT 1'),
      attempts: store.prepare('SELECT attempt, state, started_at, finished_at FROM backups WHERE name = ? ORDER BY attempt'),
      running: store.prepare("SELECT id, name, attempt FROM backups WHERE state = 'running' ORDER BY id"),
      start: store.prepare("INSERT INTO backups (name, attempt, state, started_at) VALUES (?, ?, 'running', ?) RETURNING id"),
      succeed: store.prepare("UPDATE backups SET state = 'succeeded', bytes = ?, finished_at = ? WHERE id = ?"),
      fail: store.prepare("UPDATE backups SET state = 'failed', finished_at = ? WHERE id = ?"),
      removed: store.prepare(
        "UPDATE backups SET removed_at = ? WHERE name = ? AND state = 'succeeded' AND removed_at IS NULL",
      ),
      size: store.prepare('SELECT page_count * page_size AS bytes FROM pragma_page_count(), pragma_page_size()'),
    };
    prepared.set(store, statements);
  }
  return statements;
}

// The time a backup ended: when it finished, or when it started if it kept no finish.
const endOf = (row) => row.finished_at ?? row.started_at;

// The contract's BackupWarning while the last daily backup failed, or null: failed_at is when the failed retry ended,
// last_succeeded_at when the last backup that succeeded ended, or null when none ever did.
export function backupWarning(store) {
  const statements = statementsOf(store);
  const ended = statements.ended.get();
  if (ended === undefined || ended.state !== 'failed') return null;
  const succeeded = statements.succeeded.get();
  return { failed_at: endOf(ended), last_succeeded_at: succeeded === undefined ? null : endOf(succeeded) };
}

// The free bytes of the folder, for the user the server runs as.
function freeBytes(directory) {
  const { bavail, bsize } = statfsSync(directory);
  return bavail * bsize;
}

// The backup job. settings is settings.backup: { directory, hour, minute }. queue is the server's one queue of store
// writes (writes.js), log the server's log (log.js) and now() the time in milliseconds. copy(store, path) copies the
// store to path and free(directory) gives a folder's free bytes; tests replace them, and the timers, to fail an
// attempt, fill a disk or move the clock. Returns { start(), stop() }: start() records what a crash left running and
// starts the schedule, and stop() ends it; an attempt that is running then ends as its queue task does.
export function createBackups({
  store, settings, queue, log, now = Date.now, copy = sqliteBackup, free = freeBytes,
  timers = { setTimeout, clearTimeout },
}) {
  const statements = statementsOf(store);
  const { directory } = settings;
  const minuteOfDay = settings.hour * 60 + settings.minute;
  let timer = null;
  let stopped = false;
  // The names whose first attempt a crash left running, recorded failed at start: their retry runs at once.
  const missed = new Set();

  // What is due at nowMs: { at, day, attempt } for an attempt, or { at } to look again then.
  function plan(nowMs) {
    const today = dayOf(nowMs);
    const due = startOf(today) + minuteOfDay * 60_000;
    // The day's backup, once its time has come and the day has no attempt yet.
    if (nowMs >= due && statements.attempts.all(backupName(today)).length === 0) {
      return { at: nowMs, day: today, attempt: 1 };
    }
    // The retry of the latest backup, when its first attempt failed and it has none.
    const latest = statements.latest.get();
    const day = latest === undefined ? null : dayOfName(latest.name);
    if (day !== null) {
      const attempts = statements.attempts.all(latest.name);
      const first = attempts.find((row) => row.attempt === 1);
      if (first?.state === 'failed' && attempts.every((row) => row.attempt !== 2)) {
        const at = missed.has(latest.name) ? nowMs : Date.parse(endOf(first)) + RETRY_MS;
        return { at: Math.max(nowMs, at), day, attempt: 2 };
      }
    }
    return { at: nowMs < due ? due : due + DAY_MS };
  }

  // One attempt, in the queue: its row, the room it needs, the copy, its name and the backups it ends.
  async function attempt(day, number) {
    const name = backupName(day);
    const startedMs = now();
    const { id } = statements.start.get(name, number, iso(startedMs));
    const partial = join(directory, `${name}.partial`);
    const file = join(directory, name);
    let renamed = false;
    let bytes;
    try {
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      const needed = Number(statements.size.get().bytes);
      if (free(directory) < needed) {
        removeBackups(day, () => free(directory) >= needed);
        if (free(directory) < needed) throw new NotEnoughDisk();
      }
      // Made empty and readable by its owner only before SQLite writes into it, so no other user ever reads it.
      closeSync(openSync(partial, 'w', 0o600));
      chmodSync(partial, 0o600);
      await copy(store, partial);
      bytes = statSync(partial).size;
      renameSync(partial, file);
      renamed = true;
      statements.succeed.run(bytes, iso(now()), id);
    } catch (error) {
      // A failed attempt leaves no file: its partial file, or its backup when its row could not say it succeeded.
      try {
        rmSync(renamed ? file : partial, { force: true });
      } catch {
        // A partial file that cannot be removed is removed at the next start.
      }
      statements.fail.run(iso(now()), id);
      const reason = error instanceof NotEnoughDisk ? { reason: 'not_enough_disk' } : { error: errorKind(error) };
      log({ time: iso(now()), event: 'backup_failed', day, attempt: number, ...reason });
      return;
    }
    // The backup succeeded. The backups it ends are removed apart, so a removal that fails never fails the backup.
    let removed = 0;
    let removal = null;
    try {
      removed = removeBackups(day, () => false);
    } catch (error) {
      removal = errorKind(error);
    }
    log({ time: iso(now()), event: 'backup_succeeded', day, attempt: number, bytes, removed, ms: now() - startedMs });
    if (removal !== null) log({ time: iso(now()), event: 'backup_removal_failed', day, error: removal });
  }

  // Removes the backups in the folder whose day is more than 30 days before day, the oldest first, until enough() says
  // there is room, and records when each was removed. Returns how many it removed.
  function removeBackups(day, enough) {
    const oldest = daysBefore(day, KEEP_DAYS);
    const old = readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && (dayOfName(entry.name) ?? oldest) < oldest)
      .map((entry) => entry.name)
      .sort();
    let count = 0;
    for (const name of old) {
      // The row first: a file whose removal fails is found again by the next removal.
      statements.removed.run(iso(now()), name);
      rmSync(join(directory, name), { force: true });
      count += 1;
      if (enough()) break;
    }
    return count;
  }

  // Runs what is due, then sleeps until the next thing is due or the hour is over, whichever is first.
  async function tick() {
    timer = null;
    if (stopped) return;
    let next;
    try {
      next = await queue(async () => {
        const due = plan(now());
        if (due.day === undefined || due.at > now()) return due;
        await attempt(due.day, due.attempt);
        missed.delete(backupName(due.day));
        return plan(now());
      });
    } catch (error) {
      // A store that cannot be read or written: the job looks again within the hour.
      log({ time: iso(now()), event: 'backup_job_failed', error: errorKind(error) });
      next = { at: now() + LOOK_AGAIN_MS };
    }
    if (!stopped) timer = timers.setTimeout(tick, Math.min(Math.max(next.at - now(), 0), LOOK_AGAIN_MS));
  }

  return {
    async start() {
      try {
        await queue(() => {
          // An attempt a crash left running is recorded failed; a first attempt's retry then runs at once.
          for (const row of statements.running.all()) {
            statements.fail.run(iso(now()), row.id);
            if (row.attempt === 1) missed.add(row.name);
            const day = dayOfName(row.name);
            log({ time: iso(now()), event: 'backup_failed', ...(day === null ? {} : { day }), attempt: row.attempt, reason: 'interrupted' });
          }
          // The partial files it left, which no backup is. One that cannot be removed now is left for the next start.
          let names = [];
          try {
            names = readdirSync(directory);
          } catch {
            // No folder yet: the first attempt makes it.
          }
          for (const name of names) {
            if (!PARTIAL.test(name)) continue;
            try {
              rmSync(join(directory, name), { force: true });
            } catch {
              // Left for the next start; the attempt of its day writes it anew.
            }
          }
        });
      } catch (error) {
        // What a crash left could not be recorded: the schedule starts all the same.
        log({ time: iso(now()), event: 'backup_job_failed', error: errorKind(error) });
      }
      await tick();
    },
    stop() {
      stopped = true;
      if (timer !== null) timers.clearTimeout(timer);
      timer = null;
    },
  };
}
