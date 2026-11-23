// The restore rehearsal before a release (TBL-171; SPEC-052, REQ-080, TASK-450): the latest backup is restored into a
// fresh store and read, and the result is recorded for the release. rehearse.js runs it as a command; running it before
// each release is the release step's (TASK-464).
//
// The latest backup is the last one that succeeded and whose file is still kept. It is copied into a new folder as the
// store's file and opened as the server opens its store (store.js), so this code's migrations are applied to the copy:
// the rehearsal restores the backup into this release. The copy is then read: SQLite's integrity check, its foreign
// keys, and every row of every table. The folder is removed afterwards, whatever the result. It is made only its owner
// opens (mkdtemp), inside the backups' folder rather than a folder other users share; and a folder that a rehearsal
// killed before its end left there, with its copy of the store, is removed before a new one is made.
//
// The result is recorded in the store the command opens, as it is (openExistingStore): succeeded, with what was read,
// or failed, with a note that names the check that failed and the kind of error, never a path. With no backup to
// rehearse nothing is recorded, since a rehearsal names its backup.

import { copyFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { dayOfName } from './backups.js';
import { errorKind } from './log.js';
import { openStore, STORE_FILE, StoreError } from './store.js';

// A release's name, such as v3.0.0: a letter or digit, then up to 63 letters, digits, dots, pluses, hyphens and
// underscores.
export const RELEASE = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;
// The fresh folder of a rehearsal: this prefix, then the six characters mkdtemp adds.
const WORK = 'nexus-rehearsal-';
const WORK_FOLDER = /^nexus-rehearsal-[A-Za-z0-9]{6}$/;

// A rehearsal that cannot be recorded: reason is release_invalid or no_backup.
export class RehearsalRefused extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'RehearsalRefused';
    this.reason = reason;
  }
}

// A check of the restored copy that failed: check names it.
class CheckFailed extends Error {
  constructor(check, detail) {
    super(check);
    this.check = check;
    this.detail = detail;
  }
}

// Rehearses a restore of the latest backup in backupDirectory and records it in store for release. Returns the row it
// recorded: { id, release, backup: { id, day }, result, rehearsed_at, note }. Throws RehearsalRefused, recording
// nothing, when the release's name is not one or no backup is kept. workDirectory is where the fresh folder is made:
// the backups' folder unless a test gives another.
export function rehearse({ store, backupDirectory, release, now = Date.now, workDirectory = backupDirectory }) {
  if (typeof release !== 'string' || !RELEASE.test(release)) throw new RehearsalRefused('release_invalid');
  const backup = store.prepare(
    "SELECT id, name FROM backups WHERE state = 'succeeded' AND removed_at IS NULL ORDER BY started_at DESC, id DESC LIMIT 1",
  ).get();
  if (backup === undefined) throw new RehearsalRefused('no_backup');
  let result = 'succeeded';
  let note;
  try {
    note = restoreAndRead(join(backupDirectory, backup.name), workDirectory);
  } catch (error) {
    if (!(error instanceof CheckFailed)) throw error;
    result = 'failed';
    note = error.detail === undefined ? `${error.check} failed` : `${error.check} failed: ${error.detail}`;
  }
  const rehearsedAt = new Date(now()).toISOString();
  const { id } = store.prepare(
    'INSERT INTO restore_rehearsals (release, backup_id, result, rehearsed_at, note) VALUES (?, ?, ?, ?, ?) RETURNING id',
  ).get(release, backup.id, result, rehearsedAt, note);
  return {
    id: Number(id),
    release,
    backup: { id: Number(backup.id), day: dayOfName(backup.name) },
    result,
    rehearsed_at: rehearsedAt,
    note,
  };
}

// Copies the backup at file into a fresh folder, opens it as a store and reads it. Returns what was read, as the
// rehearsal's note, or throws CheckFailed with the check that failed.
function restoreAndRead(file, workDirectory) {
  const folder = check('copy', () => {
    for (const name of readdirSync(workDirectory)) {
      if (WORK_FOLDER.test(name)) rmSync(join(workDirectory, name), { recursive: true, force: true, maxRetries: 5 });
    }
    return mkdtempSync(join(workDirectory, WORK));
  });
  let db = null;
  try {
    check('copy', () => copyFileSync(file, join(folder, STORE_FILE)));
    const opened = check('open', () => openStore(folder));
    db = opened.db;
    const integrity = check('integrity', () => db.prepare('PRAGMA integrity_check').all().map((row) => row.integrity_check));
    if (integrity.length !== 1 || integrity[0] !== 'ok') throw new CheckFailed('integrity');
    const broken = check('foreign_keys', () => db.prepare('PRAGMA foreign_key_check').all());
    if (broken.length > 0) throw new CheckFailed('foreign_keys', `${broken.length} rows`);
    const { tables, rows } = check('read', () => readAll(db));
    return `restored at version ${opened.version}: ${tables} tables, ${rows} rows read`;
  } finally {
    // The result stands whatever the clean-up does: a folder that cannot be removed now goes with the next rehearsal.
    try {
      db?.close();
    } catch {
      // Closed with the process.
    }
    try {
      rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
    } catch {
      // Removed by the next rehearsal, before it makes its own.
    }
  }
}

// Every row of every table of the store.
function readAll(db) {
  const tables = db.prepare(
    "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ).all().map((row) => row.name);
  let rows = 0;
  for (const table of tables) {
    for (const _row of db.prepare(`SELECT * FROM "${table.replaceAll('"', '""')}"`).iterate()) rows += 1;
  }
  return { tables: tables.length, rows };
}

// Runs one check: what it returns, or CheckFailed naming it with the kind of error, or the store's reason.
function check(name, run) {
  try {
    return run();
  } catch (error) {
    if (error instanceof CheckFailed) throw error;
    throw new CheckFailed(name, error instanceof StoreError ? error.reason : errorKind(error));
  }
}
