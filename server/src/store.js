// The store: NEXUS v3's own SQLite database, which the migrations of db/migrations build and keep up to date
// (TASK-414, SPEC-015).
//
// A new install starts with an empty store and never reads a v2 store. The store has a name v2 never used,
// nexus-v3.sqlite, in the folder NEXUS_DATA_DIR names, so a v2 store in the same folder is never opened. A file
// that has the store's name but is not a NEXUS v3 store is refused from its 100-byte header, before SQLite opens it,
// and left as it is.
//
// The header holds the store's marks, so the store has no table db/nexus.sql does not have: its application ID is
// NEXUS v3's, and its user version is the number of the last migration applied.
//
// No error names a path or a value read from a file (rule 5): a StoreError carries its reason only.

import { closeSync, mkdirSync, openSync, readdirSync, readFileSync, readSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

// The store's file in the data folder. v2 named its stores nexus.sqlite and rebuild.sqlite.
export const STORE_FILE = 'nexus-v3.sqlite';
// "NXS3" in the header's application ID. v2's rebuild store has "NXS2", and its first store none.
export const APPLICATION_ID = 0x4e585333;
// The approved migrations: db/migrations of this repository.
export const MIGRATIONS_DIRECTORY = new URL('../../db/migrations/', import.meta.url);

const MIGRATION_FILE = /^(\d{4})_[a-z0-9_]+\.sql$/;
const SQLITE_HEADER = 'SQLite format 3\0';
const HEADER_BYTES = 100;
const APPLICATION_ID_OFFSET = 68;

export class StoreError extends Error {
  // reason is one of the keys of REASONS.
  constructor(reason) {
    if (!Object.hasOwn(REASONS, reason)) throw new TypeError(`no store reason ${reason}`);
    super(REASONS[reason]);
    this.name = 'StoreError';
    this.reason = reason;
  }
}

const REASONS = Object.freeze({
  not_a_v3_store: 'the file with the store\'s name is not a NEXUS v3 store; it was left as it is',
  newer_store: 'the store was migrated by a newer server than this one; it was left as it is',
  migrations_invalid: 'the migrations are not numbered from 0001 without a gap',
  foreign_keys_broken: 'a migration left rows whose foreign keys point at no row; nothing was changed',
});

// The migrations in order: { number, sql } for each file named like 0001_initial.sql. Other files are not
// migrations. The numbers run from 1 without a gap or a repeat.
export function readMigrations(directory = MIGRATIONS_DIRECTORY) {
  const folder = directory instanceof URL ? fileURLToPath(directory) : directory;
  const migrations = readdirSync(folder)
    .map((name) => [name, MIGRATION_FILE.exec(name)])
    .filter(([, match]) => match !== null)
    .map(([name, match]) => ({ number: Number(match[1]), sql: readFileSync(join(folder, name), 'utf8') }))
    .sort((one, other) => one.number - other.number);
  checkNumbers(migrations);
  return Object.freeze(migrations);
}

// Opens the store in the data folder, creating the folder and the store on a new install, and applies the
// migrations it does not have yet. Returns { db, version, applied }: the open DatabaseSync with foreign keys on, the
// store's migration number and the numbers this call applied.
export function openStore(dataDirectory, { migrations = readMigrations() } = {}) {
  checkNumbers(migrations);
  mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
  const path = join(dataDirectory, STORE_FILE);
  checkHeader(path);
  const db = new DatabaseSync(path, { enableForeignKeyConstraints: true });
  try {
    return { db, ...migrate(db, migrations) };
  } catch (error) {
    db.close();
    throw error;
  }
}

// Applies to db, in one transaction, each migration after the store's user version, and marks the store as NEXUS
// v3's. An empty database becomes a store; a database with anything else in it is refused. A store that has every
// migration is not written to, so running it again changes nothing. A migration that fails changes nothing.
export function migrate(db, migrations) {
  checkNumbers(migrations);
  // Foreign keys are off while the migrations run, so that one can rebuild a table as SQLite's ALTER TABLE
  // procedure does, and every key is checked before the transaction commits. The pragma does nothing inside a
  // transaction, so it is set before it begins.
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    db.exec('BEGIN IMMEDIATE');
    try {
      const applied = migrateInTransaction(db, migrations);
      if (applied.length === 0) {
        db.exec('ROLLBACK');
      } else {
        db.exec('COMMIT');
      }
      return { version: migrations.length, applied };
    } catch (error) {
      if (db.isTransaction) db.exec('ROLLBACK');
      throw error;
    }
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}

function migrateInTransaction(db, migrations) {
  const application = pragma(db, 'application_id');
  const version = pragma(db, 'user_version');
  if (application === 0 && version === 0) {
    // A new store: an empty database, with no table, index, view or trigger.
    if (db.prepare('SELECT 1 FROM sqlite_schema LIMIT 1').get() !== undefined) throw new StoreError('not_a_v3_store');
  } else if (application !== APPLICATION_ID) {
    throw new StoreError('not_a_v3_store');
  }
  if (version > migrations.length) throw new StoreError('newer_store');
  const applied = [];
  for (const migration of migrations.slice(version)) {
    db.exec(migration.sql);
    db.exec(`PRAGMA user_version = ${migration.number}`);
    applied.push(migration.number);
  }
  if (applied.length > 0) {
    db.exec(`PRAGMA application_id = ${APPLICATION_ID}`);
    if (db.prepare('PRAGMA foreign_key_check').get() !== undefined) throw new StoreError('foreign_keys_broken');
  }
  return applied;
}

function checkNumbers(migrations) {
  const valid = Array.isArray(migrations) && migrations.length > 0 && migrations.every(
    (migration, index) => migration?.number === index + 1 && typeof migration.sql === 'string',
  );
  if (!valid) throw new StoreError('migrations_invalid');
}

// Refuses a file at the store's path that is not a NEXUS v3 store, reading only its header. A missing or empty file
// is a new install, which SQLite creates or fills.
function checkHeader(path) {
  let descriptor;
  try {
    descriptor = openSync(path, 'r');
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  try {
    const header = Buffer.alloc(HEADER_BYTES);
    const size = readSync(descriptor, header, 0, HEADER_BYTES, 0);
    if (size === 0) return;
    const ours = size === HEADER_BYTES
      && header.toString('latin1', 0, SQLITE_HEADER.length) === SQLITE_HEADER
      && header.readUInt32BE(APPLICATION_ID_OFFSET) === APPLICATION_ID;
    if (!ours) throw new StoreError('not_a_v3_store');
  } finally {
    closeSync(descriptor);
  }
}

function pragma(db, name) {
  return Number(db.prepare(`PRAGMA ${name}`).get()[name]);
}
