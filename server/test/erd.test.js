// The ERD drawer (TASK-422; SPEC-004; TBL-151, TBL-152, TBL-153): the stage-05 picture drawn as tables with their
// columns and keys, and foreign-key lines, placed by layout.js. The done condition:
// - This repository's 26 tables draw as a stored expected drawing. test/erd-picture.json is the pinned hub's picture
//   of db/nexus.sql with the file's SHA-256, which tests/test_erd_picture.py checks against the pinned hub; this test
//   fails when db/nexus.sql changes and the picture does not. test/erd-expected.json is its drawing, compared exactly,
//   so this test fails when the drawing changes and the file does not. To make both again, from the repository's root:
//       CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_erd_picture.py --write
//       (cd server && node test/erd-expected.js --write)
// - A statement that cannot be parsed is left out with its line: the hub's erd.py parses the schema, leaves such a
//   statement out of the picture and names it in a picture-partial check of the snapshot, which the drawing shows
//   with its file and line.
// - A foreign key to a missing table goes to a marked missing table.
// The pictures and checks of the cases that break are made here.

import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { DRAWERS, pictureWarnings, SourceFailure } from '../src/drawing.js';
import { erd } from '../src/erd.js';
import { idOf } from '../src/ids.js';
import { snapshotRoutes } from '../src/snapshots.js';
import { openStore } from '../src/store.js';
import { drawingOf, STAGE, storedDrawing, storedPicture } from './erd-expected.js';
import { FORMAT_02, newCommit, repositorySnapshot } from './snapshots.js';
import { startServer } from './support.js';

const START = Date.parse('2026-11-24T02:00:00.000Z');
const JSON_TYPE = { 'Content-Type': 'application/json' };
const SOURCE = '/pictures/05-erd/nexus';
const AGAIN = 'make test/erd-picture.json and test/erd-expected.json again as test/erd.test.js says at its top';

const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const counted = (diagrams) => ({ drawn: 0, unchanged: 0, failed: 0, removed: 0, ...diagrams });
const clone = (value) => JSON.parse(JSON.stringify(value));
const ofKind = (elements, kind, status = null) => elements.filter((element) => element.kind === kind && (element.status ?? null) === status);

// A check of the snapshot as the pinned hub writes one (its hub.py check()).
const check = (rule, message, stage, part) => ({ rule, level: 'warn', message, by: 'scan', stage, ...(part === undefined ? {} : { part }) });
const partial = (message, part = 'nexus', stage = STAGE) => check('picture-partial', message, stage, part);

// Draws a picture of stage 05 as the push gives it, with the warnings of checks.
function draw(picture, checks = []) {
  return drawingOf({ source: 'db/nexus.sql', part: 'nexus', checks, picture });
}

// A picture of the given tables, each { name, id, columns, foreign_keys } with what the hub always sends filled in.
function pictureOf(...tables) {
  return {
    format: 1,
    tables: tables.map((table, index) => ({
      id: '', context: '', removed: false, primary_key: ['id'], unique: [], foreign_keys: [], where: `db/nexus.sql:${index * 10 + 1}`,
      columns: [{ name: 'id', type: 'INTEGER', null: false, where: `db/nexus.sql:${index * 10 + 2}` }],
      ...table,
    })),
    without_table: [],
  };
}

const foreignKey = (columns, table, line) => ({ columns, table, references: ['id'], on_delete: 'cascade', where: `db/nexus.sql:${line}` });

// Whether a point lies on the outline of a box, within the layout's rounding.
function onOutline({ x, y }, box) {
  const near = (a, b) => Math.abs(a - b) < 0.02;
  const inside = x >= box.x - 0.02 && x <= box.x + box.width + 0.02 && y >= box.y - 0.02 && y <= box.y + box.height + 0.02;
  return inside && (near(x, box.x) || near(x, box.x + box.width) || near(y, box.y) || near(y, box.y + box.height));
}

describe('the ERD drawer', () => {
  test('the stored picture is the pinned hub\'s picture of db/nexus.sql as it is now', () => {
    const stored = storedPicture();
    const schema = readFileSync(new URL('../../db/nexus.sql', import.meta.url));
    assert.equal(stored.source, 'db/nexus.sql');
    assert.equal(stored.sha256, sha256(schema), `db/nexus.sql changed since test/erd-picture.json was made: ${AGAIN}`);
  });

  test('this repository\'s 26 tables draw as the stored expected drawing', () => {
    const stored = storedPicture();
    const drawing = drawingOf(stored);
    assert.deepStrictEqual(drawing, storedDrawing(), `the drawing of test/erd-picture.json changed: ${AGAIN}`);

    // The tables are db/nexus.sql's, each by its trace ID and name, in its order, with the picture's columns.
    const schema = readFileSync(new URL('../../db/nexus.sql', import.meta.url), 'utf8');
    const named = [...schema.matchAll(/^-- (TBL-\d+) ([a-z_]+) /gm)].map(([, id, name]) => [id, name]);
    const tables = ofKind(drawing.elements, 'table');
    assert.equal(tables.length, 26);
    assert.deepEqual(tables.map((table) => [table.trace_id, table.name]), named);
    assert.deepEqual(tables.map((table) => table.key), named.map(([id]) => id));
    stored.picture.tables.forEach((entry, index) => {
      assert.deepEqual(tables[index].detail.columns.map((column) => [column.name, column.type, column.null]),
        entry.columns.map((column) => [column.name, column.type, column.null]));
      assert.deepEqual(tables[index].detail.primary_key, entry.primary_key);
    });
    // Keys: TBL-147 project_spaces has id as its primary key, name unique and created_by_credential a foreign key.
    const spaces = tables.find((table) => table.trace_id === 'TBL-147');
    assert.deepEqual(Object.fromEntries(spaces.detail.columns.map((column) => [column.name, column.keys])), {
      id: ['primary'], name: ['unique'], repository: [], held_commit: [], created_at: [], created_by_credential: ['foreign'],
    });

    // One line for each foreign key, from the table that holds it to the table it names, nothing missing or left out.
    const lines = ofKind(drawing.elements, 'line');
    const keys = stored.picture.tables.flatMap((entry, index) => entry.foreign_keys.map((key) => [tables[index].key, key]));
    assert.equal(lines.length, 48);
    assert.equal(lines.length, keys.length);
    const byName = new Map(tables.map((table) => [table.name, table]));
    lines.forEach((line, index) => {
      const [from, key] = keys[index];
      assert.deepEqual([line.parent, line.detail.from, line.detail.to, line.name], [from, from, byName.get(key.table).key, key.columns.join(', ')]);
      assert.deepEqual([line.detail.columns, line.detail.references, line.detail.on_delete, line.detail.where], [key.columns, key.references, key.on_delete, key.where]);
      const box = (tableKey) => tables.find((table) => table.key === tableKey).detail.box;
      assert.ok(onOutline(line.detail.points[0], box(line.detail.from)), `line ${line.key} starts on its table`);
      assert.ok(onOutline(line.detail.points.at(-1), box(line.detail.to)), `line ${line.key} ends on the table it names`);
    });
    assert.equal(drawing.elements.length, tables.length + lines.length);
    // A referenced table lies above the tables that reference it: TBL-147 above TBL-151, diagrams.
    const diagrams = tables.find((table) => table.trace_id === 'TBL-151');
    assert.ok(spaces.detail.box.y + spaces.detail.box.height < diagrams.detail.box.y);
  });

  test('the drawing is the same each time, and a table keeps its key when the tables move', () => {
    const { picture } = storedPicture();
    assert.deepStrictEqual(draw(picture), draw(clone(picture)));
    const moved = clone(picture);
    moved.tables.reverse();
    const keysOf = (drawing) => drawing.elements.map((element) => element.key).sort();
    assert.deepEqual(keysOf(draw(moved)), keysOf(draw(picture)));
  });

  test('SPEC-004: a schema of 2 tables and 1 foreign key draws 2 tables joined by 1 line', () => {
    const { elements } = draw(pictureOf(
      { id: 'TBL-1', name: 'authors' },
      { id: 'TBL-2', name: 'books', columns: [{ name: 'id', type: 'INTEGER', null: false }, { name: 'author_id', type: 'INTEGER', null: false }],
        foreign_keys: [foreignKey(['author_id'], 'authors', 15)] },
    ));
    assert.deepEqual(elements.map((element) => [element.kind, element.name]), [['table', 'authors'], ['table', 'books'], ['line', 'author_id']]);
    assert.deepEqual([elements[2].key, elements[2].detail.from, elements[2].detail.to], ['TBL-2/line:author_id', 'TBL-2', 'TBL-1']);
    assert.deepEqual(elements[1].detail.columns[1], { name: 'author_id', type: 'INTEGER', null: false, keys: ['foreign'] });
  });

  test('a foreign key to a missing table goes to a marked missing table, one for each name', () => {
    const { elements } = draw(pictureOf(
      { id: 'TBL-1', name: 'authors', foreign_keys: [foreignKey(['id'], 'publishers', 5)] },
      { id: 'TBL-2', name: 'books', foreign_keys: [foreignKey(['id'], 'Publishers', 15), foreignKey(['id'], 'AUTHORS', 16)] },
    ));
    const missing = ofKind(elements, 'table', 'missing');
    assert.equal(missing.length, 1);
    assert.deepEqual([missing[0].key, missing[0].name, missing[0].trace_id ?? null, missing[0].detail.columns], ['table:publishers', 'publishers', null, []]);
    assert.ok(missing[0].detail.box.width > 0 && missing[0].detail.box.height > 0);
    // Both lines to publishers go to the missing table; AUTHORS is authors, whose name differs only in case.
    assert.deepEqual(ofKind(elements, 'line').map((line) => [line.detail.from, line.detail.to]),
      [['TBL-1', 'table:publishers'], ['TBL-2', 'table:publishers'], ['TBL-2', 'TBL-1']]);
    assert.deepEqual(elements.map((element) => element.kind), ['table', 'table', 'table', 'line', 'line', 'line']);
  });

  test('a table entry the drawer cannot read is left out, marked with its where, and lines still reach it', () => {
    const picture = pictureOf(
      { id: 'TBL-1', name: 'authors', columns: 'id INTEGER' },
      { id: 'TBL-2', name: 'books', foreign_keys: [foreignKey(['id'], 'authors', 15)] },
    );
    picture.tables.push(5, { id: 'TBL-3', where: 'db/nexus.sql:40', columns: [] }, { ...picture.tables[1], id: 'TBL-4', name: 'bad_key', foreign_keys: [{ table: 'x' }] });
    const { elements } = draw(picture);
    const unreadable = ofKind(elements, 'table', 'unreadable');
    assert.deepEqual(unreadable.map((table) => [table.key, table.trace_id, table.name, table.detail.where, table.detail.columns]), [
      ['TBL-1', 'TBL-1', 'authors', 'db/nexus.sql:1', []],
      ['table:', null, '', null, []],
      ['TBL-3', 'TBL-3', '', 'db/nexus.sql:40', []],
      ['TBL-4', 'TBL-4', 'bad_key', 'db/nexus.sql:11', []],
    ]);
    for (const table of unreadable) assert.ok(table.detail.box.width > 0);
    // books is drawn, and its foreign key to the unreadable authors reaches that table's box, not a missing one.
    assert.deepEqual(ofKind(elements, 'line').map((line) => [line.detail.from, line.detail.to]), [['TBL-2', 'TBL-1']]);
    assert.deepEqual(ofKind(elements, 'table', 'missing'), []);
    assert.deepEqual(ofKind(elements, 'table').map((table) => table.name), ['books']);
  });

  test('the warnings of a picture are the hub\'s picture-partial checks of its stage and part', () => {
    const checks = [
      partial('db/nexus.sql:94: CREATE TABLE has no readable column list'),
      check('picture-partial', 'db/extra.sql: source object is unreadable or exceeds 1 MB', STAGE),
      partial('db/other.sql:3: a statement of another part', 'other'),
      partial('docs/01-domain/nexus.md:7: a row of stage 01', 'nexus', '01-domain'),
      check('picture-left-out', 'the picture source is in another repository', STAGE),
      partial('no file named here'),
      partial('/srv/outside.sql:4: not a path in the repository'),
      { rule: 'picture-partial', stage: STAGE, message: 7 },
      'not a check',
    ];
    assert.deepEqual(pictureWarnings(checks, STAGE, 'nexus'), [
      { path: 'db/nexus.sql', line: 94, detail: 'CREATE TABLE has no readable column list' },
      { path: 'db/extra.sql', line: null, detail: 'source object is unreadable or exceeds 1 MB' },
      { path: null, line: null, detail: 'no file named here' },
      { path: null, line: null, detail: '/srv/outside.sql:4: not a path in the repository' },
    ]);
    assert.deepEqual(pictureWarnings(checks, STAGE, '').map((warning) => warning.path), ['db/extra.sql']);
    assert.deepEqual(pictureWarnings('none', STAGE, 'nexus'), []);
    assert.equal(pictureWarnings(Array.from({ length: 600 }, () => checks[0]), STAGE, 'nexus').length, 500);
  });

  test('a picture not in format 1 with a list of tables, or with more than 5000 elements, fails at its source', () => {
    for (const picture of [null, [], { tables: [] }, { format: 2, tables: [] }, { format: '1', tables: [] }, { format: 1 }, { format: 1, tables: {} }]) {
      assert.throws(() => draw(picture), (error) => error instanceof SourceFailure && error.path === null && error.line === null);
    }
    // 2500 tables, each with a line to one missing table: 5001 elements.
    const many = pictureOf(...Array.from({ length: 2500 }, (_, index) => ({ name: `t${index}`, foreign_keys: [foreignKey(['id'], 'gone', 1)] })));
    assert.throws(() => draw(many), SourceFailure);
    many.tables.pop();
    assert.equal(draw(many).elements.length, 4999);
  });
});

describe('the ERD through the push', () => {
  let folder;
  let db;
  let headers;
  let server;
  const clock = { now: START };

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-erd-'));
    ({ db } = openStore(folder));
    const secret = randomBytes(32).toString('base64url');
    const { lastInsertRowid } = db.prepare('INSERT INTO agent_credentials (name, secret_digest, issued_at) VALUES (?, ?, ?)')
      .run('push-job', sha256(secret), new Date(START).toISOString());
    headers = { 'CF-Access-Client-Id': idOf('ac', Number(lastInsertRowid)), 'CF-Access-Client-Secret': secret };
    // The server's own erd drawer, alone, so that the counts are the ERD's.
    server = await startServer({ store: db, now: () => clock.now, routes: snapshotRoutes({ drawers: { erd: DRAWERS.erd } }) });
  });

  after(async () => {
    await server.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  // A snapshot of this repository whose stage-05 picture and checks are given.
  function snapshotWith(name, picture, checks, { commit = newCommit(), replaces } = {}) {
    const snapshot = repositorySnapshot(FORMAT_02, { name, commit, replaces });
    snapshot.pictures.find((entry) => entry.stage === STAGE).source = picture;
    snapshot.checks = checks;
    return snapshot;
  }

  async function push(snapshot) {
    clock.now += 1000;
    return server.send({ method: 'POST', path: '/api/snapshots', headers: { ...JSON_TYPE, ...headers }, body: JSON.stringify(snapshot) });
  }

  const diagramOf = (name) => db.prepare(
    'SELECT d.* FROM diagrams d JOIN project_spaces p ON p.id = d.project_id WHERE p.name = ? AND d.source_key = ?',
  ).get(name, SOURCE);
  const drawings = (diagramId) => db.prepare('SELECT * FROM drawings WHERE diagram_id = ? ORDER BY id').all(diagramId).map((row) => ({ ...row }));
  const elements = (drawingId) => db.prepare(
    'SELECT element_key, trace_id, kind, name, parent_key, status, detail FROM elements WHERE drawing_id = ? ORDER BY id',
  ).all(drawingId).map((row) => ({ ...row, detail: JSON.parse(row.detail) }));
  // The rows the store keeps of a drawer's elements.
  const rowsOf = (drawn) => drawn.map((element) => ({
    element_key: element.key, trace_id: element.trace_id ?? null, kind: element.kind, name: element.name, parent_key: element.parent ?? null,
    status: element.status ?? null, detail: element.detail,
  }));

  test('the push draws this repository\'s ERD as the stored expected drawing, with the server\'s own drawer', async () => {
    const stored = storedPicture();
    const answer = await push(snapshotWith('erd-repository', stored.picture, stored.checks));
    assert.equal(answer.status, 201);
    assert.deepEqual([answer.json.diagrams, answer.json.failures], [counted({ drawn: 1 }), []]);
    const diagram = diagramOf('erd-repository');
    assert.deepEqual([diagram.kind, diagram.name, diagram.stage], ['erd', 'ERD', STAGE]);
    const [drawing] = drawings(diagram.id);
    assert.equal(drawing.status, 'drawn');
    assert.deepEqual(elements(drawing.id), rowsOf(storedDrawing().elements));
    // The hub left nothing out, so the digest is the picture's alone, as before warnings were given.
    const text = JSON.stringify(stored.picture);
    assert.equal(drawing.source_digest, sha256(JSON.stringify([[SOURCE, sha256(text)]])));
  });

  test('a statement the hub left out is shown with its file and line, and the warnings join the digest', async () => {
    const name = 'erd-left-out';
    const { picture } = storedPicture();
    const checks = [
      partial('db/nexus.sql:94: CREATE TABLE has no readable column list'),
      check('picture-partial', 'db/extra.sql: source object is unreadable or exceeds 1 MB', STAGE),
      partial('db/other.sql:3: a statement of another part', 'other'),
      partial('docs/01-domain/nexus.md:7: a row of stage 01', 'nexus', '01-domain'),
    ];
    const [a, b, c, d] = [newCommit(), newCommit(), newCommit(), newCommit()];
    assert.deepEqual((await push(snapshotWith(name, picture, checks, { commit: a }))).json.diagrams, counted({ drawn: 1 }));
    const diagram = diagramOf(name);
    const [first] = drawings(diagram.id);
    const shown = elements(first.id).filter((row) => row.kind === 'statement');
    assert.deepEqual(shown.map((row) => [row.name, row.status, row.detail]), [
      ['CREATE TABLE has no readable column list', 'left_out', { where: 'db/nexus.sql:94' }],
      ['source object is unreadable or exceeds 1 MB', 'left_out', { where: 'db/extra.sql' }],
    ]);
    const warnings = pictureWarnings(checks, STAGE, 'nexus');
    const text = JSON.stringify(picture);
    assert.equal(first.source_digest, sha256(JSON.stringify([[SOURCE, sha256(text)], ['/snapshot#picture-partial', sha256(JSON.stringify(warnings))]])));

    // The same warnings with another commit draw nothing new; a warning more or fewer draws again.
    assert.deepEqual((await push(snapshotWith(name, picture, clone(checks), { commit: b, replaces: a }))).json.diagrams, counted({ unchanged: 1 }));
    assert.deepEqual((await push(snapshotWith(name, picture, checks.slice(1), { commit: c, replaces: b }))).json.diagrams, counted({ drawn: 1 }));
    assert.deepEqual((await push(snapshotWith(name, picture, [], { commit: d, replaces: c }))).json.diagrams, counted({ drawn: 1 }));
    const last = drawings(diagram.id).at(-1);
    assert.deepEqual(elements(last.id).filter((row) => row.kind === 'statement'), []);
    assert.equal(last.source_digest, sha256(JSON.stringify([[SOURCE, sha256(text)]])));
  });

  test('a picture in another format fails the drawing at its source, and the diagram keeps its last good drawing', async () => {
    const name = 'erd-format';
    const { picture } = storedPicture();
    const [a, b] = [newCommit(), newCommit()];
    await push(snapshotWith(name, picture, [], { commit: a }));
    const answer = await push(snapshotWith(name, { format: 2, tables: [] }, [], { commit: b, replaces: a }));
    const diagram = diagramOf(name);
    assert.deepEqual([answer.json.diagrams, answer.json.failures], [counted({ failed: 1 }),
      [{ diagram: idOf('dg', Number(diagram.id)), part: 'nexus', stage: STAGE, where: 'db/nexus.sql' }]]);
    const [good, failed] = drawings(diagram.id);
    assert.deepEqual([good.status, failed.status, failed.failed_path, failed.failed_line], ['drawn', 'failed', 'db/nexus.sql', null]);
    assert.deepEqual(elements(failed.id), []);
    assert.equal(elements(good.id).length, 26 + 48);
  });

  test('no log line holds the picture\'s text (rule 5)', async () => {
    const marker = `table_${randomBytes(8).toString('hex')}`;
    const picture = pictureOf({ name: marker, foreign_keys: [foreignKey(['id'], `${marker}_gone`, 3)] });
    await push(snapshotWith('erd-logs', picture, [partial(`db/${marker}.sql:4: ${marker} was left out`)]));
    const logs = server.logText();
    assert.ok(logs.includes('pushSnapshot'));
    assert.equal(logs.includes(marker), false);
  });
});

test('the erd drawer is drawing.js\'s drawer of the erd kind', () => {
  assert.equal(DRAWERS.erd, erd);
});
