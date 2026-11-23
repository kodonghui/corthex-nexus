// The tables each operation touches (note 23 of the WBS): the recorder of tables.js tells an operation's own tables
// from those the schema's keys reach, each operation the server takes has its tables checked against the contract,
// and a handler runs as its operation.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runAs, runningAction } from '../src/operation.js';
import { createRouter } from '../src/router.js';
import { ROUTES } from '../src/routes.js';
import { testStore } from './support.js';
import { checkLayer, checkTables, listedTables, PENDING, recordTables, TABLE_IDS } from './tables.js';

const TIME = '2026-11-23T01:00:00.000Z';

test('the TBL IDs are db/nexus.sql\'s, one per table of the store', (t) => {
  const store = testStore(t);
  const tables = store.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all()
    .map((row) => row.name).sort();
  assert.deepEqual([...TABLE_IDS.keys()].sort(), tables);
  assert.equal(TABLE_IDS.get('agent_credentials'), 'TBL-146');
  assert.equal(TABLE_IDS.get('claims'), 'TBL-167');
  assert.equal(new Set(TABLE_IDS.values()).size, tables.length);
});

test('notes what each statement touches for the operation it runs for, and the rest for the request layer', (t) => {
  const recorder = recordTables(testStore(t));
  const { store } = recorder;
  const insert = store.prepare('INSERT INTO agent_credentials (name, secret_digest, issued_at) VALUES (?, ?, ?)');
  const count = store.prepare('SELECT count(*) AS n FROM agent_credentials');
  // A statement prepared once counts for each operation that runs it, when it runs.
  runAs('issueCredential', () => insert.run('one', 'a'.repeat(64), TIME));
  assert.deepEqual([...recorder.tables('issueCredential')], ['agent_credentials']);
  assert.equal(recorder.tables('listCredentials').size, 0);
  runAs('listCredentials', () => count.get());
  assert.deepEqual([...recorder.tables('listCredentials')], ['agent_credentials']);
  // What runs outside every handler is the request layer's, and exec is noted too.
  store.exec("DELETE FROM request_keys WHERE created_at < '2000'");
  assert.deepEqual([...recorder.layer()], ['request_keys']);
  checkLayer(recorder);
  // What a handler waits for runs as its operation.
  return runAs('revokeCredential', async () => {
    await Promise.resolve();
    store.prepare('SELECT 1 FROM claims').all();
    assert.deepEqual([...recorder.tables('revokeCredential')], ['claims']);
    assert.equal(recorder.runs(), 4);
  });
});

test('leaves out the tables a statement reaches only through the schema\'s keys', (t) => {
  const recorder = recordTables(testStore(t));
  const { store } = recorder;
  const touched = (sql, ...values) => {
    const action = `test ${sql}`;
    runAs(action, () => store.prepare(sql).run(...values));
    return [...recorder.tables(action)].sort();
  };
  const credential = touched('INSERT INTO agent_credentials (name, secret_digest, issued_at) VALUES (?, ?, ?)', 'k', 'b'.repeat(64), TIME);
  assert.deepEqual(credential, ['agent_credentials']);
  // An insert reads the parents its foreign keys name; a RETURNING insert into a parent reads its children too.
  assert.deepEqual(touched('INSERT INTO project_spaces (name, created_at, created_by_credential) VALUES (?, ?, 1)', 'p', TIME), ['project_spaces']);
  assert.deepEqual(touched("INSERT INTO agent_credentials (name, secret_digest, issued_at) VALUES ('r', ?, ?) RETURNING id", 'c'.repeat(64), TIME), ['agent_credentials']);
  // A delete reaches every table its cascades reach, and reads the tables keyed to them.
  assert.deepEqual(touched('DELETE FROM project_spaces WHERE id = 1'), ['project_spaces']);
  // An update reads the table it updates, and the parents of the keys it changes.
  assert.deepEqual(touched("UPDATE claims SET released_at = ?, release_reason = 'revoked' WHERE credential_id = 1", TIME), ['claims']);
  assert.deepEqual(touched('UPDATE claims SET pull_request_id = NULL WHERE id = 1'), ['claims']);
  // A read is the statement's own, joins and subqueries included.
  assert.deepEqual(touched('SELECT c.id FROM claims c JOIN todos t ON t.id = c.todo_id WHERE c.id IN (SELECT 1 FROM backups)'), ['backups', 'claims', 'todos']);
  // A delete of a table no cascade from another deleted table reaches is the statement's own.
  assert.deepEqual(touched('DELETE FROM claims WHERE id = 1'), ['claims']);
  assert.deepEqual(touched('DELETE FROM todos WHERE id = 1'), ['todos']);
});

test('fails an operation that touches a table its x-corthex.tables does not list, or never touches one it lists', (t) => {
  assert.deepEqual([...listedTables('revokeCredential')], ['TBL-146', 'TBL-167']);
  const recorder = recordTables(testStore(t));
  const { store } = recorder;
  const credentials = store.prepare('SELECT id FROM agent_credentials');
  const claims = store.prepare('SELECT id FROM claims');
  runAs('revokeCredential', () => credentials.all());
  assert.throws(() => checkTables(recorder, 'revokeCredential'), /revokeCredential touches other tables/);
  runAs('revokeCredential', () => claims.all());
  checkTables(recorder, 'revokeCredential');
  runAs('listCredentials', () => claims.all());
  assert.throws(() => checkTables(recorder, 'listCredentials'), /listCredentials touches other tables/);
  assert.throws(() => checkTables(recorder, 'issueCredential'), /issueCredential touches other tables/);
  assert.throws(() => checkTables(recorder, 'noSuchOperation'), /no operation of the contract/);
  store.prepare('SELECT id FROM backups').all();
  assert.throws(() => checkLayer(recorder), /the request layer touched backups/);
});

test('leaves to a later task only tables its operation lists and the WBS gives that task, and only while untouched', (t) => {
  const wbs = readFileSync(new URL('../../docs/10-wbs/wbs.md', import.meta.url), 'utf8');
  for (const [action, { task, tables }] of Object.entries(PENDING)) {
    const listed = listedTables(action);
    for (const table of tables) assert.ok(listed.has(table), `${action} does not list ${table}`);
    const row = new RegExp(`^\\| ${task} \\|.*$`, 'm').exec(wbs);
    assert.ok(row, `the WBS has no ${task}`);
    const touches = row[0].split('|')[4];
    for (const table of tables) assert.ok(touches.includes(table), `${task} does not touch ${table}`);
  }
  // TASK-419 drew the snapshot, whose tables TASK-418 left pending: pushSnapshot is checked against every table it
  // lists, so touching only the tables that keep the snapshot fails.
  assert.equal(Object.hasOwn(PENDING, 'pushSnapshot'), false);
  const recorder = recordTables(testStore(t));
  const { store } = recorder;
  for (const table of ['project_spaces', 'snapshots', 'document_blobs', 'snapshot_files']) {
    runAs('pushSnapshot', () => store.prepare(`SELECT 1 FROM ${table}`).all());
  }
  assert.throws(() => checkTables(recorder, 'pushSnapshot'), /pushSnapshot touches other tables/);
  for (const table of ['diagrams', 'drawings', 'elements']) runAs('pushSnapshot', () => store.prepare(`SELECT 1 FROM ${table}`).all());
  checkTables(recorder, 'pushSnapshot');
});

test('every operation the server takes has its tables checked against the contract in its tests', () => {
  const folder = new URL('./', import.meta.url);
  const text = readdirSync(folder).filter((name) => name.endsWith('.test.js'))
    .map((name) => readFileSync(new URL(name, folder), 'utf8')).join('\n');
  assert.ok(ROUTES.length >= 5, 'the routes were read');
  // Each route's tests end with checkTables for its action, named in the call, so a search finds it.
  for (const { action } of ROUTES) {
    assert.ok(text.includes(`checkTables(recorder, '${action}')`), `the tests of ${action} do not check its tables`);
  }
});

test('a handler runs as its operation, and nothing else does', async () => {
  let seen;
  const find = createRouter([{
    method: 'GET',
    path: '/a',
    action: 'listCredentials',
    handle: async () => {
      await Promise.resolve();
      seen = runningAction();
      return { body: { ok: true } };
    },
  }]);
  const { route } = find('GET', '/a');
  assert.equal(runningAction(), null);
  await route.handle({});
  assert.equal(seen, 'listCredentials');
  assert.equal(runningAction(), null);
});
