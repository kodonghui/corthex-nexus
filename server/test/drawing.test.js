// Diagrams and drawings (TASK-419; SPEC-001, SPEC-005; TBL-151, TBL-152, TBL-153): what the hub's push (API-242)
// draws from the documents it keeps, with the drawers of test/drawers.js, and others made here, in place of the
// drawing tasks' (TASK-421 to TASK-427). The snapshots are this repository's, built by test/snapshots.js and changed
// here. The done condition: a failing source keeps the last drawing and is named in failures; a 0.2 snapshot after 0.3
// pictures keeps them; an element keeps its key across drawings.

import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { checkDrawers, DRAWERS, elementKey, KINDS, SourceFailure } from '../src/drawing.js';
import { idOf } from '../src/ids.js';
import { snapshotRoutes } from '../src/snapshots.js';
import { openStore } from '../src/store.js';
import { CANNOT_DRAW, placeOf, testDrawers } from './drawers.js';
import { responseRecord } from './responses.js';
import { FORMAT_02, FORMAT_03, newCommit, repositorySnapshot } from './snapshots.js';
import { assertNoneIn, startServer } from './support.js';
import { checkLayer, checkTables, recordTables } from './tables.js';

const START = Date.parse('2026-11-23T02:00:00.000Z');
const JSON_TYPE = { 'Content-Type': 'application/json' };
const KEYED = new Set(['03-user-flow', '08-screen-states', '09-mockup']);
const FLOW = 'docs/03-user-flow/FL-001-put-a-project-on-nexus.md';
const SCREEN = 'docs/08-screens/SCR-143.md';
// What this repository's snapshot draws (see test/snapshots.test.js).
const DIAGRAMS_02 = 8;
const DIAGRAMS_03 = 26;

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const at = (ms) => new Date(ms).toISOString();
const counted = (diagrams) => ({ drawn: 0, unchanged: 0, failed: 0, removed: 0, ...diagrams });

// A drawing's source_digest: the documents it read, by path and SHA-256 (null for none), in the order of their paths.
function digestOf(reads) {
  return sha256(JSON.stringify([...reads].sort(([a], [b]) => (a < b ? -1 : 1))));
}

// The documents of a snapshot that diagrams are drawn from, by their paths (see src/snapshot.js): its pictures and
// each stage's items.
function sourcesOf(snapshot) {
  const sources = new Map();
  for (const picture of snapshot.pictures) {
    if (KEYED.has(picture.stage)) sources.set(picture.key, picture.source.text);
    else sources.set(picture.part === '' ? `/pictures/${picture.stage}` : `/pictures/${picture.stage}/${picture.part}`, JSON.stringify(picture.source));
  }
  for (const stage of new Set(snapshot.items.map((item) => item.stage))) {
    sources.set(`/items/${stage}`, JSON.stringify(snapshot.items.filter((item) => item.stage === stage)));
  }
  return sources;
}

const pictureOf = (snapshot, stage) => snapshot.pictures.find((picture) => picture.stage === stage && !KEYED.has(stage));
const fileOf = (snapshot, key) => snapshot.pictures.find((picture) => picture.key === key);

// Puts a line into a file's text, so that it becomes line number at.
function insertLine(picture, at, line) {
  const lines = picture.source.text.split('\n');
  lines.splice(at - 1, 0, line);
  picture.source.text = lines.join('\n');
}

describe('drawing a snapshot', () => {
  const responses = responseRecord();
  let folder;
  let db;
  let recorder;
  let headers;
  let server;
  const servers = [];
  const clock = { now: START };
  // Every snapshot's markers and failing paths, which no log line may hold (rule 5).
  const forbidden = {};

  // A server that draws with drawers, on the suite's store.
  async function serverWith(drawers) {
    const started = await startServer({ store: recorder.store, now: () => clock.now, routes: snapshotRoutes({ drawers }) });
    servers.push(started);
    return started;
  }

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-drawing-'));
    ({ db } = openStore(folder));
    recorder = recordTables(db);
    const secret = randomBytes(32).toString('base64url');
    const { lastInsertRowid } = db.prepare('INSERT INTO agent_credentials (name, secret_digest, issued_at) VALUES (?, ?, ?)')
      .run('push-job', sha256(secret), at(START));
    headers = { 'CF-Access-Client-Id': idOf('ac', Number(lastInsertRowid)), 'CF-Access-Client-Secret': secret };
    server = await serverWith(testDrawers());
  });

  after(async () => {
    for (const started of servers) await started.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  async function push(snapshot, to = server) {
    const answer = await to.send({ method: 'POST', path: '/api/snapshots', headers: { ...JSON_TYPE, ...headers }, body: JSON.stringify(snapshot) });
    responses.note('pushSnapshot', answer);
    return answer;
  }

  const project = (name) => db.prepare('SELECT id FROM project_spaces WHERE name = ?').get(name);
  const snapshotId = (name, revision) => Number(db.prepare(
    'SELECT s.id FROM snapshots s JOIN project_spaces p ON p.id = s.project_id WHERE p.name = ? AND s.revision = ?',
  ).get(name, revision).id);
  const diagrams = (name) => db.prepare(
    'SELECT d.* FROM diagrams d JOIN project_spaces p ON p.id = d.project_id WHERE p.name = ? ORDER BY d.id',
  ).all(name).map((row) => ({ ...row }));
  const diagram = (name, source) => diagrams(name).find((row) => row.source_key === source);
  const drawings = (diagramId) => db.prepare('SELECT * FROM drawings WHERE diagram_id = ? ORDER BY id').all(diagramId).map((row) => ({ ...row }));
  const elements = (drawingId) => db.prepare(
    'SELECT element_key, trace_id, kind, name, parent_key, status, detail FROM elements WHERE drawing_id = ? ORDER BY id',
  ).all(drawingId).map((row) => ({ ...row }));
  // The diagram's last good drawing, which it shows while its last drawing failed.
  const lastDrawn = (diagramId) => drawings(diagramId).filter((row) => row.status === 'drawn').at(-1);
  const rows = () => Object.fromEntries(['project_spaces', 'snapshots', 'snapshot_files', 'diagrams', 'drawings', 'elements']
    .map((table) => [table, Number(db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n)]));
  const failureOf = (name, source, part, stage, where) => ({ diagram: idOf('dg', diagram(name, source).id), part, stage, where });

  test('a corthex-hub/0.3 send draws a diagram per stage and part of 01, 05 and 07, one per file of 03, 08 and 09, and an item table per other stage', async () => {
    const name = 'every-kind';
    clock.now = START + 1000;
    const snapshot = repositorySnapshot(FORMAT_03, { name });
    const { commit } = snapshot.repos['.'].default;
    const answer = await push(snapshot);
    assert.equal(answer.status, 201);
    assert.deepEqual([answer.json.diagrams, answer.json.failures], [counted({ drawn: DIAGRAMS_03 }), []]);

    const sources = sourcesOf(snapshot);
    const kinds = { '01-domain': 'ddd_board', '05-erd': 'erd', '07-sitemap': 'sitemap', '03-user-flow': 'user_flow', '08-screen-states': 'screen_states', '09-mockup': 'mockup' };
    const expected = [
      ...snapshot.pictures.map((picture) => [picture.stage, KEYED.has(picture.stage) ? picture.key : `/pictures/${picture.stage}/nexus`, kinds[picture.stage]]),
      ...['02-prd', '04-functional-spec', '06-api', '10-wbs'].map((stage) => [stage, `/items/${stage}`, 'item_table']),
    ];
    const found = diagrams(name);
    assert.deepEqual(found.map((row) => [row.stage, row.source_key, row.kind]).sort(), expected.sort());
    // Stages 01, 05 and 07 have pictures in every format, so their items draw no table; nor do 03's in 0.3.
    for (const stage of ['01-domain', '03-user-flow', '05-erd', '07-sitemap']) assert.equal(diagram(name, `/items/${stage}`), undefined);

    const names = new Map(found.map((row) => [row.source_key, row.name]));
    assert.deepEqual([names.get('/pictures/01-domain/nexus'), names.get('/pictures/05-erd/nexus'), names.get('/pictures/07-sitemap/nexus')],
      ['DDD board', 'ERD', 'Sitemap']);
    assert.equal(names.get(FLOW), 'FL-001 Put a project on NEXUS');
    assert.equal(names.get('/items/02-prd'), '02-prd');
    for (const row of found) {
      assert.deepEqual([row.created_at, row.removed_at], [at(clock.now), null]);
      // One drawing each, of this snapshot at its commit, whose digest covers the document it read.
      const [drawing, ...others] = drawings(row.id);
      assert.deepEqual(others, []);
      assert.deepEqual(
        [drawing.project_id, drawing.snapshot_id, drawing.document_version, drawing.status, drawing.failed_path, drawing.failed_line, drawing.drawn_at],
        [project(name).id, snapshotId(name, 1), commit, 'drawn', null, null, at(clock.now)],
      );
      assert.equal(drawing.source_digest, digestOf([[row.source_key, sha256(sources.get(row.source_key))]]), row.source_key);
    }
    // The ERD's tables, keyed by their trace IDs; the mockup's tokens, keyed by their names.
    const erd = elements(drawings(diagram(name, '/pictures/05-erd/nexus').id)[0].id);
    const tables = pictureOf(snapshot, '05-erd').source.tables;
    assert.equal(erd.length, 26);
    assert.deepEqual(erd.map((row) => [row.element_key, row.trace_id, row.kind, row.name, row.parent_key, row.status]),
      tables.map((table) => [table.id, table.id, 'table', table.name, null, null]));
    assert.deepEqual(JSON.parse(erd[0].detail), { where: tables[0].where });
    const tokens = elements(drawings(diagram(name, 'design/mockup/nexus-mockup.html').id)[0].id);
    assert.ok(tokens.length > 10);
    for (const token of tokens) assert.deepEqual([token.kind, token.element_key], ['token', `token:${token.name}`]);
  });

  test('a corthex-hub/0.2 send shows stages 03, 08 and 09 as item tables while no snapshot drew their pictures', async () => {
    const name = 'item-tables';
    const snapshot = repositorySnapshot(FORMAT_02, { name });
    const answer = await push(snapshot);
    assert.deepEqual(answer.json.diagrams, counted({ drawn: DIAGRAMS_02 }));
    assert.deepEqual(diagrams(name).map((row) => [row.source_key, row.kind]).sort(), [
      ['/items/02-prd', 'item_table'], ['/items/03-user-flow', 'item_table'], ['/items/04-functional-spec', 'item_table'],
      ['/items/06-api', 'item_table'], ['/items/10-wbs', 'item_table'], ['/pictures/01-domain/nexus', 'ddd_board'],
      ['/pictures/05-erd/nexus', 'erd'], ['/pictures/07-sitemap/nexus', 'sitemap'],
    ]);
    const flows = elements(drawings(diagram(name, '/items/03-user-flow').id)[0].id);
    assert.deepEqual(flows.map((row) => row.element_key), snapshot.items.filter((item) => item.stage === '03-user-flow').map((item) => item.id));
    assert.equal(flows.length, 13);
  });

  describe('a failing source keeps the last good drawing and is named in failures', () => {
    const name = 'failing';
    const [a, b, c, d, e] = [newCommit(), newCommit(), newCommit(), newCommit(), newCommit()];
    let previous = a;
    // A snapshot whose ERD cannot read its third table, whose sitemap cannot be read at all and whose flow FL-001
    // cannot read its line 3.
    const broken = (commit) => {
      const snapshot = repositorySnapshot(FORMAT_03, { name, commit, replaces: previous });
      previous = commit;
      pictureOf(snapshot, '05-erd').source.tables[2].broken = true;
      pictureOf(snapshot, '07-sitemap').source.screens[0].broken = 'source';
      insertLine(fileOf(snapshot, FLOW), 3, CANNOT_DRAW);
      return snapshot;
    };
    let expectedFailures;
    let firstDrawings;

    test('a first send draws every source', async () => {
      assert.equal((await push(repositorySnapshot(FORMAT_03, { name, commit: a }))).status, 201);
      firstDrawings = new Map(['/pictures/05-erd/nexus', '/pictures/07-sitemap/nexus', FLOW].map((source) => [source, drawings(diagram(name, source).id)[0]]));
    });

    test('a source that cannot be read fails its drawing where it failed, and the diagram keeps its last good drawing', async () => {
      clock.now = START + 2000;
      const snapshot = broken(b);
      const answer = await push(snapshot);
      const erdWhere = pictureOf(snapshot, '05-erd').source.tables[2].where;
      // In the order of the snapshot's documents; a failure that names no path is at the picture's source.
      expectedFailures = [
        failureOf(name, '/pictures/05-erd/nexus', 'nexus', '05-erd', erdWhere),
        failureOf(name, '/pictures/07-sitemap/nexus', 'nexus', '07-sitemap', snapshot.stages['07-sitemap'].source),
        failureOf(name, FLOW, '', '03-user-flow', `${FLOW}:3`),
      ];
      assert.deepEqual([answer.status, answer.json.diagrams, answer.json.failures],
        [200, counted({ unchanged: DIAGRAMS_03 - 3, failed: 3 }), expectedFailures]);
      forbidden.erdWhere = erdWhere;
      forbidden.flowWhere = `${FLOW}:3`;

      const places = new Map([
        ['/pictures/05-erd/nexus', [placeOf(erdWhere).path, placeOf(erdWhere).line]],
        ['/pictures/07-sitemap/nexus', [snapshot.stages['07-sitemap'].source, null]],
        [FLOW, [FLOW, 3]],
      ]);
      for (const [source, [path, line]] of places) {
        const row = diagram(name, source);
        assert.equal(row.removed_at, null);
        const [first, failed, ...others] = drawings(row.id);
        assert.deepEqual(others, []);
        assert.deepEqual(first, firstDrawings.get(source));
        assert.deepEqual([failed.snapshot_id, failed.document_version, failed.status, failed.failed_path, failed.failed_line, failed.drawn_at],
          [snapshotId(name, 2), b, 'failed', path, line, at(clock.now)]);
        // A failed drawing has no elements; the diagram shows its last good one, whose elements stay.
        assert.deepEqual(elements(failed.id), []);
        assert.equal(lastDrawn(row.id).id, first.id);
        assert.ok(elements(first.id).length > 0);
      }
      // Its digest still covers what it read, so the same source fails again without a new drawing.
      assert.equal(drawings(diagram(name, FLOW).id)[1].source_digest, digestOf([[FLOW, sha256(fileOf(snapshot, FLOW).source.text)]]));
    });

    test('the same source failing again is named again, with no new drawing', async () => {
      const before = rows();
      const answer = await push(broken(c));
      assert.deepEqual([answer.json.diagrams, answer.json.failures], [counted({ unchanged: DIAGRAMS_03 - 3, failed: 3 }), expectedFailures]);
      assert.deepEqual(rows(), { ...before, snapshots: before.snapshots + 1, snapshot_files: rows().snapshot_files });
    });

    test('a source that reads again draws again', async () => {
      clock.now = START + 3000;
      const answer = await push(repositorySnapshot(FORMAT_03, { name, commit: d, replaces: c }));
      previous = d;
      assert.deepEqual([answer.json.diagrams, answer.json.failures], [counted({ drawn: 3, unchanged: DIAGRAMS_03 - 3 }), []]);
      for (const [source, first] of firstDrawings) {
        const last = drawings(diagram(name, source).id).at(-1);
        assert.deepEqual([last.status, last.snapshot_id, last.source_digest], ['drawn', snapshotId(name, 4), first.source_digest]);
        assert.deepEqual(elements(last.id), elements(first.id));
      }
    });

    test('a new file whose first drawing fails gets its diagram, named by its file, and is named in failures', async () => {
      const snapshot = repositorySnapshot(FORMAT_03, { name, commit: e, replaces: d });
      const key = 'docs/03-user-flow/FL-099-a-flow-that-cannot-be-drawn.md';
      snapshot.pictures.push({ ...fileOf(snapshot, FLOW), key, source: { text: `${CANNOT_DRAW}\n# FL-099 A flow\n` } });
      const answer = await push(snapshot);
      assert.deepEqual([answer.json.diagrams, answer.json.failures],
        [counted({ unchanged: DIAGRAMS_03, failed: 1 }), [failureOf(name, key, '', '03-user-flow', `${key}:1`)]]);
      const row = diagram(name, key);
      assert.deepEqual([row.kind, row.name, row.removed_at], ['user_flow', 'FL-099-a-flow-that-cannot-be-drawn.md', null]);
      assert.deepEqual(drawings(row.id).map((drawing) => [drawing.status, drawing.failed_path, drawing.failed_line]), [['failed', key, 1]]);
      assert.equal(lastDrawn(row.id), undefined);
      forbidden.newFlow = key;
    });
  });

  describe('a corthex-hub/0.2 snapshot after 0.3 pictures keeps them', () => {
    const name = 'kept';
    const [a, b, c, d] = [newCommit(), newCommit(), newCommit(), newCommit()];
    const files = (snapshot) => snapshot.pictures.filter((picture) => KEYED.has(picture.stage)).map((picture) => picture.key);
    let keys;

    test('a 0.2 snapshot keeps the pictures of stages 03, 08 and 09 as last drawn, and draws no item table for them', async () => {
      const first = repositorySnapshot(FORMAT_03, { name, commit: a });
      keys = files(first);
      assert.equal(keys.length, 19);
      assert.equal((await push(first)).status, 201);
      const answer = await push(repositorySnapshot(FORMAT_02, { name, commit: b, replaces: a }));
      assert.deepEqual([answer.json.diagrams, answer.json.failures], [counted({ unchanged: DIAGRAMS_03 }), []]);
      for (const key of keys) {
        const row = diagram(name, key);
        assert.equal(row.removed_at, null, key);
        // Its version names the commit it comes from.
        assert.deepEqual(drawings(row.id).map((drawing) => [drawing.snapshot_id, drawing.document_version]), [[snapshotId(name, 1), a]]);
      }
      // Stage 03's items draw no table while its pictures stay.
      assert.equal(diagram(name, '/items/03-user-flow'), undefined);
      assert.equal(diagrams(name).filter((row) => row.removed_at === null).length, DIAGRAMS_03);
    });

    test('a 0.3 snapshot draws them again: a file it no longer holds is removed, and a changed one drawn', async () => {
      clock.now = START + 4000;
      const snapshot = repositorySnapshot(FORMAT_03, { name, commit: c, replaces: b });
      snapshot.pictures = snapshot.pictures.filter((picture) => picture.key !== FLOW);
      fileOf(snapshot, SCREEN).source.text += '\n## A new state\n';
      const answer = await push(snapshot);
      assert.deepEqual(answer.json.diagrams, counted({ drawn: 1, unchanged: DIAGRAMS_03 - 2, removed: 1 }));
      assert.equal(diagram(name, FLOW).removed_at, at(clock.now));
      assert.deepEqual(drawings(diagram(name, SCREEN).id).map((drawing) => drawing.document_version), [a, c]);
    });

    test('a 0.2 snapshot after it keeps the pictures as the 0.3 one left them', async () => {
      clock.now = START + 5000;
      const answer = await push(repositorySnapshot(FORMAT_02, { name, commit: d, replaces: c }));
      assert.deepEqual(answer.json.diagrams, counted({ unchanged: DIAGRAMS_03 - 1 }));
      assert.equal(diagram(name, FLOW).removed_at, at(START + 4000));
      assert.equal(drawings(diagram(name, SCREEN).id).at(-1).document_version, c);
      assert.equal(diagram(name, '/items/03-user-flow'), undefined);
    });
  });

  describe('an element keeps its key across drawings', () => {
    const name = 'keys';
    const [a, b] = [newCommit(), newCommit()];

    test('by its trace ID, or by its kind and name, wherever it stands and whatever else changed', async () => {
      assert.equal((await push(repositorySnapshot(FORMAT_03, { name, commit: a }))).status, 201);
      const erdBefore = elements(drawings(diagram(name, '/pictures/05-erd/nexus').id)[0].id);
      const flowBefore = elements(drawings(diagram(name, FLOW).id)[0].id);
      assert.deepEqual(flowBefore.map((row) => [row.element_key, row.name]), [['FL-001', 'Put a project on NEXUS'], ['heading:Failure paths', 'Failure paths']]);

      const snapshot = repositorySnapshot(FORMAT_03, { name, commit: b, replaces: a });
      // The ERD: table TBL-151 renamed and moved last, and a new table first.
      const { tables } = pictureOf(snapshot, '05-erd').source;
      const index = tables.findIndex((table) => table.id === 'TBL-151');
      const [moved] = tables.splice(index, 1);
      tables.push({ ...moved, name: 'drawn_diagrams' });
      tables.unshift({ id: 'TBL-900', name: 'new_table', where: 'db/nexus.sql:1', removed: false });
      // The flow: its title changed, and a heading put before the one that has no trace ID.
      const flow = fileOf(snapshot, FLOW);
      flow.source.text = flow.source.text.replace('# FL-001 Put a project on NEXUS', '# FL-001 Put a project on NEXUS, renamed');
      flow.source.text = flow.source.text.replace('## Failure paths', '## Before the failure paths\n\n## Failure paths');
      const answer = await push(snapshot);
      assert.deepEqual(answer.json.diagrams, counted({ drawn: 2, unchanged: DIAGRAMS_03 - 2 }));

      const erdAfter = elements(drawings(diagram(name, '/pictures/05-erd/nexus').id)[1].id);
      assert.deepEqual(erdAfter.map((row) => row.element_key), ['TBL-900', ...erdBefore.map((row) => row.element_key).filter((key) => key !== 'TBL-151'), 'TBL-151']);
      assert.deepEqual(erdAfter.filter((row) => row.element_key === 'TBL-151').map((row) => [row.trace_id, row.name]), [['TBL-151', 'drawn_diagrams']]);
      const flowAfter = elements(drawings(diagram(name, FLOW).id)[1].id);
      assert.deepEqual(flowAfter.map((row) => [row.element_key, row.name]), [
        ['FL-001', 'Put a project on NEXUS, renamed'],
        ['heading:Before the failure paths', 'Before the failure paths'],
        ['heading:Failure paths', 'Failure paths'],
      ]);
    });

    test('a key the drawer gives, a parent, a key two elements would share and a long one keep theirs too', async () => {
      let reversed = false;
      const shapes = [
        { key: 'lane:owner', kind: 'lane', name: 'Owner' },
        { kind: 'event', name: 'Snapshot\n  accepted', parent: 'lane:owner' },
        { kind: 'line', key: 'TBL-152>TBL-151', name: '' },
        { kind: 'note', name: 'Same' },
        { trace_id: 'CTX-037', kind: 'context', name: '' },
        { kind: 'context', name: 'x'.repeat(300), status: 'marked', detail: { columns: [{ name: 'id' }] } },
      ];
      const drawn = await serverWith({ ...testDrawers(), sitemap: () => ({ name: 'n'.repeat(250), elements: reversed ? [...shapes].reverse() : shapes }) });
      const long = elementKey({ kind: 'context', name: 'x'.repeat(300) });
      const expected = new Map([
        ['lane:owner', ['lane', 'Owner', null]],
        ['lane:owner/event:Snapshot accepted', ['event', 'Snapshot\n  accepted', 'lane:owner']],
        ['TBL-152>TBL-151', ['line', '', null]],
        ['note:Same', ['note', 'Same', null]],
        ['CTX-037', ['context', '', null]],
        [long, ['context', `${'x'.repeat(199)}…`, null]],
      ]);
      const name2 = 'drawer-keys';
      const [c, d] = [newCommit(), newCommit()];
      assert.equal((await push(repositorySnapshot(FORMAT_02, { name: name2, commit: c }), drawn)).status, 201);
      const row = diagram(name2, '/pictures/07-sitemap/nexus');
      assert.equal(row.name, `${'n'.repeat(199)}…`);
      const first = elements(drawings(row.id)[0].id);
      assert.deepEqual(new Map(first.map((element) => [element.element_key, [element.kind, element.name, element.parent_key]])), expected);
      assert.equal([...long].length, 200);
      assert.match(long, /^context:x+#[0-9a-f]{16}$/);
      assert.deepEqual(first.find((element) => element.element_key === long).detail, '{"columns":[{"name":"id"}]}');
      // The same source drawn in another order is a new drawing, whose elements keep their keys.
      reversed = true;
      const answer = await push(repositorySnapshot(FORMAT_02, { name: name2, commit: d, replaces: c }), drawn);
      assert.deepEqual(answer.json.diagrams, counted({ drawn: 1, unchanged: DIAGRAMS_02 - 1 }));
      const second = elements(drawings(row.id)[1].id);
      assert.deepEqual(second.map((element) => element.element_key), first.map((element) => element.element_key).reverse());
      assert.equal(drawings(row.id)[1].source_digest, drawings(row.id)[0].source_digest);
    });

    test('elementKey: the trace ID, or the kind and name under the parent, within 200 characters', () => {
      assert.equal(elementKey({ trace_id: 'TBL-151', kind: 'table', name: 'diagrams' }), 'TBL-151');
      assert.equal(elementKey({ kind: 'event', name: '  Snapshot \t accepted ', parent: 'lane:owner' }), 'lane:owner/event:Snapshot accepted');
      assert.equal(elementKey({ kind: 'note', name: '' }), 'note:');
      const one = elementKey({ kind: 'note', name: `${'y'.repeat(250)}1` });
      const two = elementKey({ kind: 'note', name: `${'y'.repeat(250)}2` });
      assert.notEqual(one, two);
      assert.deepEqual([[...one].length, [...two].length], [200, 200]);
    });
  });

  test('two elements a drawer leaves to share a key are numbered in their order', async () => {
    const drawn = await serverWith({
      ...testDrawers(),
      erd: () => ({ elements: [{ kind: 'note', name: 'Same' }, { key: 'note:Same#2', kind: 'note', name: 'Given' }, { kind: 'note', name: 'Same' }, { kind: 'note', name: 'Same' }] }),
    });
    assert.equal((await push(repositorySnapshot(FORMAT_02, { name: 'numbered' }), drawn)).status, 201);
    const found = elements(drawings(diagram('numbered', '/pictures/05-erd/nexus').id)[0].id);
    assert.deepEqual(found.map((row) => [row.element_key, row.name]), [['note:Same', 'Same'], ['note:Same#2', 'Given'], ['note:Same#3', 'Same'], ['note:Same#4', 'Same']]);
  });

  describe('the same commit in a newer format draws the pictures 0.2 did not carry', () => {
    const name = 'completed';
    const [a, b] = [newCommit(), newCommit()];

    test('and stage 03\'s item table makes way for them (SPEC-005)', async () => {
      assert.deepEqual((await push(repositorySnapshot(FORMAT_02, { name, commit: a }))).json.diagrams, counted({ drawn: DIAGRAMS_02 }));
      const table = diagram(name, '/items/03-user-flow');
      assert.equal(table.removed_at, null);
      clock.now = START + 6000;
      const snapshot = repositorySnapshot(FORMAT_03, { name, commit: a });
      const answer = await push(snapshot);
      assert.deepEqual([answer.json.same_commit, answer.json.diagrams], [true, counted({ drawn: 19, unchanged: DIAGRAMS_02 - 1, removed: 1 })]);
      assert.equal(diagram(name, '/items/03-user-flow').removed_at, at(clock.now));
      // The files are drawn from the revision they complete.
      for (const picture of snapshot.pictures.filter((each) => KEYED.has(each.stage))) {
        assert.deepEqual(drawings(diagram(name, picture.key).id).map((drawing) => [drawing.snapshot_id, drawing.document_version, drawing.status]),
          [[snapshotId(name, 1), a, 'drawn']]);
      }
      // The stages 0.2 carried are not drawn again.
      assert.equal(drawings(diagram(name, '/pictures/05-erd/nexus').id).length, 1);
    });

    test('and the item table stays removed while the stage has pictures, a 0.2 snapshot after it included', async () => {
      for (const replaces of [a, undefined]) {
        const answer = await push(repositorySnapshot(FORMAT_02, { name, commit: b, replaces }));
        assert.deepEqual(answer.json.diagrams, counted({ unchanged: DIAGRAMS_03 }));
      }
      assert.equal(diagram(name, '/items/03-user-flow').removed_at, at(START + 6000));
      assert.equal(drawings(diagram(name, '/items/03-user-flow').id).length, 1);
    });
  });

  test('a diagram whose document a snapshot no longer holds is removed, and comes back when it holds it again', async () => {
    const name = 'comes-back';
    const [a, b, c] = [newCommit(), newCommit(), newCommit()];
    assert.equal((await push(repositorySnapshot(FORMAT_03, { name, commit: a }))).status, 201);
    clock.now = START + 7000;
    const without = repositorySnapshot(FORMAT_03, { name, commit: b, replaces: a });
    without.pictures = without.pictures.filter((picture) => picture.key !== SCREEN);
    without.items = without.items.filter((item) => item.stage !== '04-functional-spec');
    assert.deepEqual((await push(without)).json.diagrams, counted({ unchanged: DIAGRAMS_03 - 2, removed: 2 }));
    for (const source of [SCREEN, '/items/04-functional-spec']) assert.equal(diagram(name, source).removed_at, at(clock.now));
    // Removed, a diagram is not one of the project's: the same snapshot again counts it nowhere.
    assert.deepEqual((await push(without)).json.diagrams, counted({ unchanged: DIAGRAMS_03 - 2 }));

    const back = await push(repositorySnapshot(FORMAT_03, { name, commit: c, replaces: b }));
    assert.deepEqual(back.json.diagrams, counted({ unchanged: DIAGRAMS_03 }));
    for (const source of [SCREEN, '/items/04-functional-spec']) {
      const row = diagram(name, source);
      assert.equal(row.removed_at, null);
      // The same diagram, its source unchanged: no new drawing.
      assert.equal(drawings(row.id).length, 1);
    }
  });

  test('a drawing reads other documents of its own snapshot, which its digest covers', async () => {
    const reading = await serverWith({
      ...testDrawers(),
      ddd_board: ({ text, read }) => {
        const terms = JSON.parse(read('/items/01-domain'));
        assert.equal(read('/items/no-such-stage'), null);
        assert.equal(read('/pictures/01-domain/nexus'), text);
        return { elements: terms.slice(0, 3).map((term) => ({ trace_id: term.id, kind: 'term', name: term.title })) };
      },
    });
    const name = 'reads';
    const [a, b, c] = [newCommit(), newCommit(), newCommit()];
    const first = repositorySnapshot(FORMAT_02, { name, commit: a });
    assert.equal((await push(first, reading)).status, 201);
    const board = diagram(name, '/pictures/01-domain/nexus');
    const sources = sourcesOf(first);
    assert.equal(drawings(board.id)[0].source_digest, digestOf([
      ['/items/01-domain', sha256(sources.get('/items/01-domain'))],
      ['/items/no-such-stage', null],
      ['/pictures/01-domain/nexus', sha256(sources.get('/pictures/01-domain/nexus'))],
    ]));

    // A change in a document the board read draws it again; a change in one it did not read leaves it.
    const changed = repositorySnapshot(FORMAT_02, { name, commit: b, replaces: a });
    changed.items.find((item) => item.stage === '01-domain').title = 'A term renamed';
    assert.deepEqual((await push(changed, reading)).json.diagrams, counted({ drawn: 1, unchanged: DIAGRAMS_02 - 1 }));
    assert.equal(elements(drawings(board.id)[1].id)[0].name, 'A term renamed');
    const other = repositorySnapshot(FORMAT_02, { name, commit: c, replaces: b });
    other.items.find((item) => item.stage === '01-domain').title = 'A term renamed';
    other.items.find((item) => item.stage === '02-prd').title = 'A requirement renamed';
    assert.deepEqual((await push(other, reading)).json.diagrams, counted({ drawn: 1, unchanged: DIAGRAMS_02 - 1 }));
    assert.equal(drawings(board.id).length, 2);
  });

  test('a kind without a drawer draws nothing', async () => {
    const none = await serverWith(DRAWERS);
    const answer = await push(repositorySnapshot(FORMAT_03, { name: 'no-drawers' }), none);
    assert.deepEqual([answer.status, answer.json.diagrams], [201, counted({})]);
    assert.deepEqual(diagrams('no-drawers'), []);
    const tables = await serverWith({ item_table: testDrawers().item_table });
    assert.deepEqual((await push(repositorySnapshot(FORMAT_03, { name: 'tables-only' }), tables)).json.diagrams, counted({ drawn: 4 }));
    assert.deepEqual(new Set(diagrams('tables-only').map((row) => row.kind)), new Set(['item_table']));
  });

  test('more than 5000 elements fail the drawing at its source', async () => {
    const many = (count) => () => ({ elements: Array.from({ length: count }, (_, index) => ({ kind: 'screen', name: `screen ${index}` })) });
    const name = 'many';
    const [a, b] = [newCommit(), newCommit()];
    const fits = await serverWith({ sitemap: many(5000) });
    assert.deepEqual((await push(repositorySnapshot(FORMAT_02, { name, commit: a }), fits)).json.diagrams, counted({ drawn: 1 }));
    const tooMany = await serverWith({ sitemap: many(5001) });
    const snapshot = repositorySnapshot(FORMAT_02, { name, commit: b, replaces: a });
    const answer = await push(snapshot, tooMany);
    assert.deepEqual([answer.json.diagrams, answer.json.failures], [counted({ failed: 1 }),
      [failureOf(name, '/pictures/07-sitemap/nexus', 'nexus', '07-sitemap', snapshot.stages['07-sitemap'].source)]]);
    const row = diagram(name, '/pictures/07-sitemap/nexus');
    assert.equal(elements(lastDrawn(row.id).id).length, 5000);
  });

  test('a drawer that breaks the interface fails the push with internal, and the push changes nothing', async () => {
    const marker = `source text ${randomBytes(8).toString('hex')}`;
    forbidden.marker = marker;
    const cases = [
      () => null,
      () => ({ elements: {} }),
      () => ({ name: 5, elements: [] }),
      () => ({ elements: [null] }),
      () => ({ elements: [{ kind: 'Table', name: 'x' }] }),
      () => ({ elements: [{ kind: 'k'.repeat(41), name: 'x' }] }),
      () => ({ elements: [{ kind: 'table' }] }),
      () => ({ elements: [{ kind: 'table', name: 'x', trace_id: 'tbl-1' }] }),
      () => ({ elements: [{ kind: 'table', name: 'x', key: ' padded' }] }),
      () => ({ elements: [{ kind: 'table', name: 'x', key: 'two\nlines' }] }),
      () => ({ elements: [{ kind: 'table', name: 'x', key: 'same' }, { kind: 'table', name: 'y', key: 'same' }] }),
      () => ({ elements: [{ kind: 'table', name: 'x', parent: 'nowhere' }] }),
      () => ({ elements: [{ kind: 'table', name: 'x', key: 'self', parent: 'self' }] }),
      () => ({ elements: [{ kind: 'table', name: 'x', status: '' }] }),
      () => ({ elements: [{ kind: 'table', name: 'x', status: 's'.repeat(61) }] }),
      () => ({ elements: [{ kind: 'table', name: 'x', detail: [] }] }),
      () => ({ elements: [{ kind: 'table', name: 'x', detail: { size: 1n } }] }),
      () => Promise.resolve({ elements: [] }),
      () => { throw new SourceFailure({ path: `db/${marker}\n.sql` }); },
      () => { throw new SourceFailure({ path: 'p'.repeat(301) }); },
      () => { throw new SourceFailure({ line: 0 }); },
      () => { throw new SourceFailure({ line: 1.5 }); },
      () => { throw new TypeError(marker); },
      ({ read }) => read(5),
    ];
    const before = rows();
    for (const [index, erd] of cases.entries()) {
      const faulty = await serverWith({ ...testDrawers(), erd });
      const answer = await push(repositorySnapshot(FORMAT_02, { name: 'faults' }), faulty);
      assert.deepEqual([answer.status, answer.json.code], [500, 'internal'], `case ${index}`);
      assert.equal(answer.text.includes(marker), false);
      const [line] = await faulty.logged(1);
      assert.equal(line.error, 'TypeError', `case ${index}`);
    }
    assert.deepEqual(rows(), before);
    assert.equal(project('faults'), undefined);
  });

  test('the drawers are checked when the push\'s routes are made', () => {
    assert.deepEqual([...KINDS].sort(), ['ddd_board', 'erd', 'item_table', 'mockup', 'screen_states', 'sitemap', 'user_flow']);
    assert.deepEqual(DRAWERS, {});
    assert.equal(checkDrawers(testDrawers()) !== null, true);
    for (const drawers of [null, [], { board: () => ({ elements: [] }) }, { erd: 'draw' }]) {
      assert.throws(() => snapshotRoutes({ drawers }), TypeError);
    }
  });

  test('no log line holds a source\'s text or where a drawing failed (rule 5)', () => {
    const text = servers.map((started) => started.logText()).join('\n');
    assert.ok(text.length > 0);
    assertNoneIn(text, { ...forbidden, cannotDraw: CANNOT_DRAW, flow: FLOW, screen: SCREEN });
  });

  test('touch the tables API-242 lists, and admission only the layer\'s (note 23)', () => {
    checkTables(recorder, 'pushSnapshot');
    checkLayer(recorder);
  });
});
