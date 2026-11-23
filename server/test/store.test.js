// The store and its migration runner (TASK-414, SPEC-015): the schema it builds is db/nexus.sql's, running it twice
// changes nothing, and a v2 store beside it is left unread.

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { chmodSync, copyFileSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { DatabaseSync } from 'node:sqlite';
import { describe, test } from 'node:test';
import { APPLICATION_ID, migrate, openStore, readMigrations, STORE_FILE, StoreError } from '../src/store.js';
import { dataFolder as newDataFolder, localGate, startServer } from './support.js';

const SCHEMA = new URL('../../db/nexus.sql', import.meta.url);
const STORE_MODULE = new URL('../src/store.js', import.meta.url).href;
const MIGRATIONS = readMigrations();
const T = '2026-11-23T00:00:00.000Z';
// v2's application ID of its rebuild store, "NXS2"; its first store has none.
const V2_REBUILD_APPLICATION_ID = 0x4e585332;
const dataFolder = (t) => newDataFolder(t, 'nexus-store-');

function schemaDatabase() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(SCHEMA, 'utf8'));
  return db;
}

// Every table, index, view and trigger with its SQL, each table's columns and foreign keys, and each index's
// columns. Whitespace in the SQL is compared as one space, as tests/test_schema.py does.
function shapeOf(db) {
  const plain = (rows) => rows.map((row) => ({ ...row }));
  const objects = plain(db.prepare(
    "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE substr(name, 1, 7) <> 'sqlite_' ORDER BY name",
  ).all()).map((row) => ({ ...row, sql: (row.sql ?? '').split(/\s+/).filter(Boolean).join(' ') }));
  const tables = objects.filter((object) => object.type === 'table').map((object) => object.name);
  const each = (pragma) => Object.fromEntries(tables.map((table) => [table, plain(db.prepare(`PRAGMA ${pragma}("${table}")`).all())]));
  const indexes = Object.fromEntries(tables.map((table) => [table, plain(db.prepare(`PRAGMA index_list("${table}")`).all())
    .map((index) => ({ ...index, columns: plain(db.prepare(`PRAGMA index_xinfo("${index.name}")`).all()) }))]));
  return { objects, columns: each('table_xinfo'), keys: each('foreign_key_list'), indexes };
}

function pragma(db, name) {
  return Number(db.prepare(`PRAGMA ${name}`).get()[name]);
}

// What a test compares to see that nothing changed: each file's bytes and modification time, and the folder's names.
function folderState(folder) {
  const names = readdirSync(folder).sort();
  return {
    names,
    files: Object.fromEntries(names.map((name) => {
      const path = join(folder, name);
      return [name, { bytes: readFileSync(path).toString('base64'), mtimeMs: statSync(path).mtimeMs }];
    })),
  };
}

// The stores a v2 server kept: its first store, with the tables v2's own check looked for, and its rebuild store.
function makeV2Stores(folder) {
  const first = new DatabaseSync(join(folder, 'nexus.sqlite'));
  first.exec(`
    CREATE TABLE migrations (id TEXT PRIMARY KEY);
    CREATE TABLE project_spaces (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE snapshots (id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL);
    CREATE TABLE comments (id INTEGER PRIMARY KEY, body TEXT NOT NULL);
    CREATE TABLE checkpoints (id INTEGER PRIMARY KEY);
    CREATE TABLE writes (id INTEGER PRIMARY KEY);
    INSERT INTO migrations VALUES ('001');
    INSERT INTO project_spaces VALUES (1, 'v2-project');
    INSERT INTO comments VALUES (1, 'a v2 comment');
  `);
  first.close();
  const rebuild = new DatabaseSync(join(folder, 'rebuild.sqlite'));
  rebuild.exec(`
    CREATE TABLE projects (id INTEGER PRIMARY KEY, slug TEXT NOT NULL);
    INSERT INTO projects VALUES (1, 'v2-rebuild-project');
    PRAGMA application_id = ${V2_REBUILD_APPLICATION_ID};
    PRAGMA user_version = 1;
  `);
  rebuild.close();
  return ['nexus.sqlite', 'rebuild.sqlite'];
}

function assertRefused(reason) {
  return (error) => {
    assert.ok(error instanceof StoreError, String(error));
    assert.equal(error.reason, reason);
    return true;
  };
}

describe('the store of a new install', () => {
  test('has the schema of db/nexus.sql, with no difference', (t) => {
    const folder = dataFolder(t);
    const { db, version, applied } = openStore(folder);
    const schema = schemaDatabase();
    try {
      checkNewStore(db, schema, version, applied);
    } finally {
      db.close();
      schema.close();
    }
    assert.deepEqual(readdirSync(folder), [STORE_FILE]);
  });

  function checkNewStore(db, schema, version, applied) {
    const numbers = MIGRATIONS.map((migration) => migration.number);
    assert.deepEqual(applied, numbers);
    assert.equal(version, numbers.length);

    const built = shapeOf(db);
    assert.deepEqual(built, shapeOf(schema));
    // The schema's 26 tables, TBL-146 to TBL-171, were compared, each with its trace ID in db/nexus.sql.
    const traced = [...readFileSync(SCHEMA, 'utf8').matchAll(/^-- TBL-(\d{3}) (\w+) /gm)];
    assert.deepEqual(traced.map((match) => Number(match[1])), Array.from({ length: 26 }, (_, index) => 146 + index));
    assert.deepEqual(Object.keys(built.columns).sort(), traced.map((match) => match[2]).sort());

    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    assert.equal(db.prepare('PRAGMA foreign_key_check').get(), undefined);
    assert.equal(pragma(db, 'foreign_keys'), 1);
    // The store's marks are in the header, not in a table: NEXUS v3's application ID and the last migration.
    assert.equal(pragma(db, 'application_id'), APPLICATION_ID);
    assert.equal(pragma(db, 'user_version'), numbers.length);
    // SPEC-015: it starts empty.
    for (const table of Object.keys(built.columns)) {
      assert.equal(db.prepare(`SELECT count(*) AS n FROM "${table}"`).get().n, 0, table);
    }
  }

  test('a schema that differs from db/nexus.sql is found', (t) => {
    const schema = schemaDatabase();
    t.after(() => schema.close());
    const expected = shapeOf(schema);
    for (const sql of [
      'CREATE INDEX backups_by_name ON backups (name)',
      'ALTER TABLE backups ADD COLUMN note TEXT',
      'DROP INDEX backups_by_time',
    ]) {
      const db = new DatabaseSync(':memory:');
      migrate(db, [...MIGRATIONS, { number: MIGRATIONS.length + 1, sql }]);
      assert.notDeepEqual(shapeOf(db), expected, sql);
      db.close();
    }
  });

  test('is made in its own file and folder, which a new install creates', (t) => {
    const folder = join(dataFolder(t), 'nested', 'data');
    const { db } = openStore(folder);
    db.close();
    assert.deepEqual(readdirSync(folder), [STORE_FILE]);
    if (process.platform !== 'win32') assert.equal(statSync(folder).mode & 0o777, 0o700);
  });

  test('is readable by its owner only, whatever the folder allows', { skip: process.platform === 'win32' && 'Windows keeps no POSIX mode' }, (t) => {
    const folder = dataFolder(t);
    const path = join(folder, STORE_FILE);
    // A folder the operator made beforehand keeps its mode; the store does not take it.
    chmodSync(folder, 0o755);
    openStore(folder).db.close();
    assert.equal(statSync(path).mode & 0o777, 0o600);
    chmodSync(path, 0o644);
    openStore(folder).db.close();
    assert.equal(statSync(path).mode & 0o777, 0o600);
    assert.equal(statSync(folder).mode & 0o777, 0o755);
  });

  test('can be opened again after a crash during the first install', (t) => {
    const folder = dataFolder(t);
    const path = join(folder, STORE_FILE);
    // A one-page cache makes SQLite write pages to the file before the commit, as a large migration would; the last
    // migration then stops the process in the middle of the transaction.
    const crashed = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import { DatabaseSync } from 'node:sqlite';
      import { migrate, readMigrations } from ${JSON.stringify(STORE_MODULE)};
      const db = new DatabaseSync(${JSON.stringify(path)});
      db.exec('PRAGMA cache_size = 1');
      db.function('crash', () => process.exit(7));
      const migrations = readMigrations();
      migrate(db, [...migrations, { number: migrations.length + 1, sql: 'SELECT crash();' }]);
    `], { encoding: 'utf8' });
    assert.equal(crashed.status, 7, crashed.stderr);
    assert.ok(statSync(path).size > 0, 'pages were written before the commit');
    assert.deepEqual(readdirSync(folder).sort(), [STORE_FILE, `${STORE_FILE}-journal`]);

    const { db, applied } = openStore(folder);
    const schema = schemaDatabase();
    try {
      assert.deepEqual(applied, MIGRATIONS.map((migration) => migration.number));
      assert.deepEqual(shapeOf(db), shapeOf(schema));
    } finally {
      db.close();
      schema.close();
    }
    assert.deepEqual(readdirSync(folder), [STORE_FILE]);
  });

  test('waits for a lock another connection holds, such as a server still stopping', async (t) => {
    const folder = dataFolder(t);
    openStore(folder).db.close();
    const holder = spawn(process.execPath, ['--input-type=module', '-e', `
      import { DatabaseSync } from 'node:sqlite';
      const db = new DatabaseSync(${JSON.stringify(join(folder, STORE_FILE))});
      db.exec('BEGIN EXCLUSIVE');
      process.stdout.write('locked\\n');
      setTimeout(() => {
        db.exec('COMMIT');
        db.close();
      }, 500);
    `], { stdio: ['ignore', 'pipe', 'inherit'] });
    const closed = once(holder, 'close');
    const [chunk] = await once(holder.stdout, 'data');
    assert.equal(String(chunk), 'locked\n');
    const started = performance.now();
    try {
      const { db, applied } = openStore(folder);
      db.close();
      assert.deepEqual(applied, []);
      assert.ok(performance.now() - started >= 200, 'it waited for the lock');
    } finally {
      const [code] = await closed;
      assert.equal(code, 0);
    }
  });
});

describe('running the migrations twice', () => {
  test('changes nothing', (t) => {
    const folder = dataFolder(t);
    openStore(folder).db.close();
    const first = folderState(folder);

    const again = openStore(folder);
    assert.deepEqual(again.applied, []);
    assert.equal(again.version, MIGRATIONS.length);
    again.db.close();
    assert.deepEqual(folderState(folder), first);
  });

  test('keeps the rows and changes nothing in a store that holds data', (t) => {
    const folder = dataFolder(t);
    const { db } = openStore(folder);
    db.prepare('INSERT INTO agent_credentials (name, secret_digest, issued_at) VALUES (?, ?, ?)').run('ci', 'digest', T);
    db.prepare('INSERT INTO project_spaces (name, created_at, created_by_credential) VALUES (?, ?, 1)').run('demo', T);
    db.close();
    const before = folderState(folder);

    for (let run = 0; run < 2; run += 1) {
      const again = openStore(folder);
      assert.deepEqual(again.applied, []);
      assert.deepEqual({ ...again.db.prepare('SELECT name FROM project_spaces').get() }, { name: 'demo' });
      again.db.close();
    }
    assert.deepEqual(folderState(folder), before);
  });

  test('applies only the migrations the store does not have, and a newer store is refused', (t) => {
    const folder = dataFolder(t);
    openStore(folder).db.close();
    const next = { number: MIGRATIONS.length + 1, sql: 'CREATE INDEX backups_by_name ON backups (name);' };

    const migrated = openStore(folder, { migrations: [...MIGRATIONS, next] });
    assert.deepEqual(migrated.applied, [next.number]);
    assert.equal(pragma(migrated.db, 'user_version'), next.number);
    migrated.db.close();
    const after = folderState(folder);

    // A server that knows fewer migrations than the store has leaves the store as it is.
    assert.throws(() => openStore(folder), assertRefused('newer_store'));
    assert.deepEqual(folderState(folder), after);
  });
});

describe('a v2 store', () => {
  test('beside the store is left unread', (t) => {
    const folder = dataFolder(t);
    const v2 = makeV2Stores(folder);
    const before = folderState(folder);
    // Where the system enforces it, the v2 stores cannot be read at all, so a runner that opened one would fail.
    const enforced = process.platform !== 'win32' && process.getuid?.() !== 0;
    const schema = schemaDatabase();
    try {
      if (enforced) {
        for (const name of v2) chmodSync(join(folder, name), 0o000);
        assert.throws(() => readFileSync(join(folder, v2[0])), { code: 'EACCES' });
      }
      for (let run = 0; run < 2; run += 1) {
        const { db } = openStore(folder);
        try {
          // The new store has the schema's tables only, and none of v2's rows.
          assert.deepEqual(shapeOf(db), shapeOf(schema));
          for (const table of ['project_spaces', 'snapshots', 'comments']) {
            assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0, table);
          }
        } finally {
          db.close();
        }
      }
    } finally {
      schema.close();
      if (enforced) for (const name of v2) chmodSync(join(folder, name), 0o600);
    }

    const after = folderState(folder);
    // Only the store was added; the v2 stores keep their bytes and modification times, and no journal of SQLite
    // appeared beside them.
    assert.deepEqual(after.names, [...before.names, STORE_FILE].sort());
    for (const name of v2) assert.deepEqual(after.files[name], before.files[name], name);
  });

  test('at the store\'s name is refused from its header and left as it is', (t) => {
    const folder = dataFolder(t);
    // Made in another folder, then copied to the store's name.
    const source = dataFolder(t);
    for (const name of makeV2Stores(source)) {
      copyFileSync(join(source, name), join(folder, STORE_FILE));
      const before = folderState(folder);
      assert.throws(() => openStore(folder), assertRefused('not_a_v3_store'), name);
      // SQLite never opened it: no byte, time or journal changed.
      assert.deepEqual(folderState(folder), before, name);
    }
  });

  test('other files at the store\'s name are refused too', (t) => {
    const folder = dataFolder(t);
    const path = join(folder, STORE_FILE);
    const other = new DatabaseSync(':memory:');
    other.exec('CREATE TABLE notes (body TEXT)');
    const anotherApplication = other.serialize();
    other.close();
    const store = join(dataFolder(t), 'store');
    openStore(store).db.close();
    const ours = readFileSync(join(store, STORE_FILE));
    for (const [what, bytes] of [
      ['a text file', Buffer.from('not a database\n')],
      ['a SQLite database of no application', Buffer.from(anotherApplication)],
      ['a store cut short in its header', ours.subarray(0, 64)],
      // Zeros are a first install that stopped before its commit only when its journal is beside it.
      ['zeros with no journal beside them', Buffer.alloc(4096)],
    ]) {
      writeFileSync(path, bytes);
      const before = folderState(folder);
      assert.throws(() => openStore(folder), assertRefused('not_a_v3_store'), what);
      assert.deepEqual(folderState(folder), before, what);
    }
  });
});

describe('the migration runner', () => {
  test('refuses a database that already holds something', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE notes (body TEXT)');
    assert.throws(() => migrate(db, MIGRATIONS), assertRefused('not_a_v3_store'));
    assert.deepEqual(db.prepare("SELECT name FROM sqlite_schema").all().map((row) => row.name), ['notes']);
    assert.equal(pragma(db, 'application_id'), 0);
    db.close();
  });

  test('changes nothing when a migration fails', (t) => {
    const folder = dataFolder(t);
    openStore(folder).db.close();
    const before = folderState(folder);
    const number = MIGRATIONS.length + 1;
    for (const [what, sql, check] of [
      ['an error', 'CREATE TABLE extra (a TEXT); INSERT INTO no_such_table VALUES (1);', { name: 'Error' }],
      [
        'a broken foreign key',
        `CREATE TABLE extra (a TEXT); INSERT INTO project_spaces (name, created_at, created_by_credential) VALUES ('orphan', '${T}', 99);`,
        assertRefused('foreign_keys_broken'),
      ],
    ]) {
      assert.throws(() => openStore(folder, { migrations: [...MIGRATIONS, { number, sql }] }), check, what);
      assert.deepEqual(folderState(folder), before, what);
    }
    const { db, applied } = openStore(folder);
    assert.deepEqual(applied, []);
    assert.equal(db.prepare("SELECT 1 FROM sqlite_schema WHERE name = 'extra'").get(), undefined);
    assert.equal(pragma(db, 'foreign_keys'), 1);
    db.close();
  });

  test('reads db/migrations, numbered from 0001 without a gap', (t) => {
    assert.ok(MIGRATIONS.length >= 1);
    assert.deepEqual(MIGRATIONS.map((migration) => migration.number), Array.from(MIGRATIONS, (_, index) => index + 1));
    assert.equal(MIGRATIONS[0].sql, readFileSync(new URL('../../db/migrations/0001_initial.sql', import.meta.url), 'utf8'));
    assert.ok(Object.isFrozen(MIGRATIONS));

    for (const [what, names] of [
      ['a gap', ['0001_a.sql', '0003_c.sql']],
      ['a repeat', ['0001_a.sql', '0001_b.sql']],
      ['no 0001', ['0002_b.sql']],
      ['no migration', ['README.md']],
      // A file that looks like a migration but is not named like one is refused, not skipped, even as the last one.
      ['a hyphen', ['0001_a.sql', '0002-add-index.sql']],
      ['capitals', ['0001_a.sql', '0002_AddIndex.sql']],
      ['another ending case', ['0001_a.sql', '0002_add.SQL']],
      ['no number', ['0001_a.sql', 'notes.sql']],
      ['another ending', ['0001_a.sql', '0002_draft.sql.txt']],
    ]) {
      const folder = dataFolder(t);
      for (const name of names) writeFileSync(join(folder, name), 'SELECT 1;');
      assert.throws(() => readMigrations(folder), assertRefused('migrations_invalid'), what);
    }
    const folder = dataFolder(t);
    for (const name of ['0001_a.sql', '0002_b.sql', 'README.md', '.gitkeep']) writeFileSync(join(folder, name), `-- ${name}`);
    assert.deepEqual(readMigrations(folder).map((migration) => migration.sql), ['-- 0001_a.sql', '-- 0002_b.sql']);
    assert.throws(() => openStore(dataFolder(t), { migrations: [] }), assertRefused('migrations_invalid'));
  });

  test('names no path in its errors', () => {
    for (const reason of ['not_a_v3_store', 'newer_store', 'migrations_invalid', 'foreign_keys_broken']) {
      const error = new StoreError(reason);
      assert.equal(error.reason, reason);
      assert.doesNotMatch(error.message, /[\\/]|sqlite\b/i, reason);
    }
    assert.throws(() => new StoreError('no_such_reason'), TypeError);
  });
});

describe('the server', () => {
  test('gives each handler the store it was given', async (t) => {
    const folder = dataFolder(t);
    const { db } = openStore(folder);
    // The project list is the owner's, so the request carries the owner's sign-in.
    const local = localGate();
    let server;
    try {
      server = await startServer({
        store: db,
        gate: local.gate,
        routes: [{
          method: 'GET',
          path: '/api/projects',
          action: 'listProjects',
          handle: ({ store }) => ({ body: { projects: store.prepare('SELECT name FROM project_spaces').all().map((row) => row.name) } }),
        }],
      });
      const answer = await server.send({ path: '/api/projects', headers: { 'Cf-Access-Jwt-Assertion': local.token() } });
      assert.equal(answer.status, 200);
      // SPEC-015: a new install lists no project.
      assert.deepEqual(answer.json, { projects: [] });
    } finally {
      await server?.close();
      db.close();
    }
  });
});
