// The item-table drawer (TASK-423; SPEC-005, SPEC-010, SPEC-027; TBL-151, TBL-152, TBL-153): a stage's items drawn as
// a table, one row for each item, and when a stage of 03, 08 or 09 shows its table. The done condition: stage 02 of
// this repository shows one row per requirement; removed items come last, marked; when pictures come, the table is
// marked removed and keeps its threads on its rows.
//
// item-table-items.json is the pinned hub's items of this repository's stage 02, with the SHA-256 of its source, which
// tests/test_item_table_items.py makes and checks. To make it again, from the repository's root:
//     CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_item_table_items.py --write

import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { DRAWERS, SourceFailure } from '../src/drawing.js';
import { idOf } from '../src/ids.js';
import { isRemoved, itemNames, itemTable } from '../src/item-table.js';
import { readProject } from '../src/project.js';
import { snapshotRoutes } from '../src/snapshots.js';
import { openStore } from '../src/store.js';
import { testDrawers } from './drawers.js';
import { FORMAT_02, FORMAT_03, newCommit, repositorySnapshot } from './snapshots.js';
import { startServer } from './support.js';

const START = Date.parse('2026-11-24T04:00:00.000Z');
const JSON_TYPE = { 'Content-Type': 'application/json' };
const AGAIN = 'make test/item-table-items.json again as test/item-table.test.js says at its top';
const FLOWS = '03-user-flow';

const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const at = (ms) => new Date(ms).toISOString();
const counted = (diagrams) => ({ drawn: 0, unchanged: 0, failed: 0, removed: 0, ...diagrams });

function storedItems() {
  return JSON.parse(readFileSync(new URL('./item-table-items.json', import.meta.url), 'utf8'));
}

// Draws items as the push gives them: the stage's items as JSON.
function draw(items, stage = '02-prd') {
  return itemTable({ stage, part: '', key: null, kind: 'item_table', source: 'docs/x.md', text: JSON.stringify(items), read: () => null, warnings: [] });
}

// An item in the form the hub sends, with what it always sends filled in.
const item = (id, fields = {}) => ({ id, kind: 'requirement', stage: '02-prd', where: `docs/02-prd/requirements.md:${Number(id.split('-')[1] ?? 0) + 20}`, ...fields });

// The row a drawer draws of a readable item, as the done condition and SPEC-005 ask.
const rowOf = (entry, status = null) => ({
  key: entry.id,
  trace_id: entry.id,
  kind: 'row',
  name: entry.title ?? '',
  status,
  detail: { status: entry.status ?? '', links: entry.links ?? [], where: entry.where },
});

describe('the item-table drawer', () => {
  test('the stored items are the pinned hub\'s items of stage 02 as docs/02-prd/requirements.md is now', () => {
    const stored = storedItems();
    const source = readFileSync(new URL('../../docs/02-prd/requirements.md', import.meta.url));
    assert.deepEqual([stored.stage, stored.source], ['02-prd', 'docs/02-prd/requirements.md']);
    assert.equal(stored.sha256, sha256(source), `docs/02-prd/requirements.md changed since test/item-table-items.json was made: ${AGAIN}`);
    // One item for each requirement the source's table defines, in its order.
    const defined = [...source.toString('utf8').matchAll(/^\| (REQ-\d+) \|/gm)].map(([, id]) => id);
    assert.equal(defined.length, 80);
    assert.deepEqual(stored.items.map((entry) => entry.id), defined);
  });

  test('this repository\'s stage 02 draws one row per requirement, with its name, status and links (SPEC-005)', () => {
    const { items } = storedItems();
    const { elements, name } = draw(items);
    assert.equal(elements.length, 80);
    assert.equal(name, undefined);
    assert.deepEqual(elements, items.map((entry) => rowOf(entry)));
    // Each row by its name, the requirement's title; the trace ID is its key, not its name (SPEC-010).
    assert.equal(elements[0].name.startsWith('When an agent sends a snapshot'), true);
    assert.deepEqual(elements[0].detail, { status: 'active', links: ['CTX-037'], where: 'docs/02-prd/requirements.md:23' });
    assert.ok(elements.every((row) => row.name !== row.trace_id && row.name !== ''));
  });

  test('removed items come last, marked removed, in their order; a deferred one stays in its place', () => {
    const items = [
      item('REQ-001', { title: 'One', status: 'active' }),
      item('REQ-002', { title: 'Two', status: 'removed' }),
      item('REQ-003', { title: 'Three', status: 'deferred' }),
      item('REQ-004', { title: 'Four', status: 'Deprecated (2026-11-20)' }),
      item('REQ-005', { title: 'Five' }),
    ];
    const { elements } = draw(items);
    assert.deepEqual(elements.map((row) => [row.key, row.status, row.detail.status]), [
      ['REQ-001', null, 'active'],
      ['REQ-003', null, 'deferred'],
      ['REQ-005', null, ''],
      ['REQ-002', 'removed', 'removed'],
      ['REQ-004', 'removed', 'Deprecated (2026-11-20)'],
    ]);
  });

  test('an item is removed as the hub\'s is_removed says: its status holds one of the hub\'s removed words', () => {
    for (const status of ['removed', 'Removed.', 'status: deleted', 'dropped_now', 'cancelled', 'canceled', 'obsolete', 'deprecated', '삭제', '삭제됨', '폐기', '(제외)', '취소']) {
      assert.equal(isRemoved(status), true, status);
    }
    for (const status of ['', 'active', 'removal', 'not-removed', 'removedness', 'deferred', '보류', 'Must']) assert.equal(isRemoved(status), false, status);
    for (const status of [undefined, null, 3, ['removed']]) assert.equal(isRemoved(status), false);
  });

  test('an entry it cannot read is a row marked unreadable in its place, with its trace ID and where when it has them', () => {
    const items = [
      item('REQ-001', { title: 'One' }),
      null,
      item('REQ-003', { title: 'Three', links: 'REQ-001' }),
      { kind: 'requirement', title: 'No ID', where: 'docs/02-prd/requirements.md:30' },
      item('REQ-005', { title: 7 }),
      'REQ-006',
      item('REQ-007', { title: 'Seven', status: 'removed' }),
    ];
    const { elements } = draw(items);
    assert.deepEqual(elements.map((row) => [row.key, row.trace_id, row.name, row.status, row.detail]), [
      ['REQ-001', 'REQ-001', 'One', null, { status: '', links: [], where: 'docs/02-prd/requirements.md:21' }],
      ['row:', null, '', 'unreadable', { status: '', links: [], where: null }],
      ['REQ-003', 'REQ-003', 'Three', 'unreadable', { status: '', links: [], where: 'docs/02-prd/requirements.md:23' }],
      ['row:No ID', null, 'No ID', 'unreadable', { status: '', links: [], where: 'docs/02-prd/requirements.md:30' }],
      ['REQ-005', 'REQ-005', '', 'unreadable', { status: '', links: [], where: 'docs/02-prd/requirements.md:25' }],
      ['row:#2', null, '', 'unreadable', { status: '', links: [], where: null }],
      ['REQ-007', 'REQ-007', 'Seven', 'removed', { status: 'removed', links: [], where: 'docs/02-prd/requirements.md:27' }],
    ]);
  });

  test('a row keeps its key while its item keeps its ID, whatever its title, status or place', () => {
    const before = draw([item('REQ-001', { title: 'One' }), item('req_2', { title: 'Two' }), item('REQ-003', { title: 'Three' })]).elements;
    assert.deepEqual(before.map((row) => [row.key, row.trace_id]), [['REQ-001', 'REQ-001'], ['row:req_2', null], ['REQ-003', 'REQ-003']]);
    const after = draw([
      item('REQ-003', { title: 'Three, renamed', status: 'removed' }), item('req_2', { title: 'Two, renamed' }), item('REQ-001', { title: 'One' }),
    ]).elements;
    assert.deepEqual(after.map((row) => [row.key, row.name]), [['row:req_2', 'Two, renamed'], ['REQ-001', 'One'], ['REQ-003', 'Three, renamed']]);
    // Two entries of one ID are told apart by their order.
    assert.deepEqual(draw([item('REQ-001'), item('REQ-001')]).elements.map((row) => row.key), ['REQ-001', 'REQ-001#2']);
  });

  test('a stage with no items draws an empty table', () => {
    assert.deepEqual(draw([]), { elements: [] });
  });

  test('a source that is not a list, or more items than a drawing holds, fails at its source', () => {
    for (const source of [{}, 'items', null, 3]) assert.throws(() => draw(source), SourceFailure);
    assert.equal(draw(Array.from({ length: 5000 }, (_, index) => item(`REQ-${index + 1}`))).elements.length, 5000);
    assert.throws(() => draw(Array.from({ length: 5001 }, (_, index) => item(`REQ-${index + 1}`))), SourceFailure);
  });

  test('itemNames gives each linked item\'s name from the item documents, for the page to show links by name (TASK-441)', () => {
    const names = itemNames([
      JSON.stringify([item('REQ-001', { title: 'One' }), item('REQ-002', { title: '  ' }), item('REQ-003'), null, { title: 'No ID' }]),
      null,
      'not JSON',
      JSON.stringify({ items: [] }),
      JSON.stringify([item('REQ-001', { title: 'One again' }), item('CTX-037', { title: 'Diagram' })]),
    ]);
    // A blank or missing title gives none, so the page shows that link by its ID (SPEC-010).
    assert.deepEqual([...names], [['REQ-001', 'One'], ['CTX-037', 'Diagram']]);
    const { items } = storedItems();
    assert.equal(itemNames([JSON.stringify(items)]).get('REQ-001'), items[0].title);
  });
});

describe('item tables through the push', () => {
  const clock = { now: START };
  let folder;
  let db;
  let headers;
  let own;
  let pictured;

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-item-table-'));
    ({ db } = openStore(folder));
    const secret = randomBytes(32).toString('base64url');
    const { lastInsertRowid } = db.prepare('INSERT INTO agent_credentials (name, secret_digest, issued_at) VALUES (?, ?, ?)')
      .run('push-job', sha256(secret), at(START));
    headers = { 'CF-Access-Client-Id': idOf('ac', Number(lastInsertRowid)), 'CF-Access-Client-Secret': secret };
    // The server's own drawers; and the server's item-table drawer with test drawers for the pictures of 03, 08 and
    // 09, which have no drawer of their own yet (TASK-424, TASK-426, TASK-427).
    own = await startServer({ store: db, now: () => clock.now, routes: snapshotRoutes() });
    pictured = await startServer({ store: db, now: () => clock.now, routes: snapshotRoutes({ drawers: { ...testDrawers(), item_table: DRAWERS.item_table } }) });
  });

  after(async () => {
    await own.close();
    await pictured.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  async function push(server, snapshot) {
    clock.now += 1000;
    const answer = await server.send({ method: 'POST', path: '/api/snapshots', headers: { ...JSON_TYPE, ...headers }, body: JSON.stringify(snapshot) });
    assert.ok(answer.status === 200 || answer.status === 201, `${answer.status}`);
    return answer.json;
  }

  const diagram = (name, source) => db.prepare(
    'SELECT d.* FROM diagrams d JOIN project_spaces p ON p.id = d.project_id WHERE p.name = ? AND d.source_key = ?',
  ).get(name, source);
  const drawings = (diagramId) => db.prepare('SELECT * FROM drawings WHERE diagram_id = ? ORDER BY id').all(diagramId);
  const elements = (drawingId) => db.prepare(
    'SELECT element_key, trace_id, kind, name, parent_key, status, detail FROM elements WHERE drawing_id = ? ORDER BY id',
  ).all(drawingId).map((row) => ({ ...row, detail: JSON.parse(row.detail) }));
  const threads = (diagramId) => db.prepare(
    'SELECT diagram_id, drawing_id, target_kind, element_key, removed_name, state FROM comment_threads WHERE diagram_id = ? ORDER BY id',
  ).all(diagramId).map((row) => ({ ...row }));
  const live = (name, stage) => db.prepare(
    `SELECT count(*) AS n FROM diagrams d JOIN project_spaces p ON p.id = d.project_id
     WHERE p.name = ? AND d.stage = ? AND d.kind <> 'item_table' AND d.removed_at IS NULL`,
  ).get(name, stage).n;
  // The diagrams the project read lists for a stage, in their order: [kind, removed, open threads].
  const listed = (name, stage) => readProject(db, name).stages.filter((row) => row.stage === stage)
    .flatMap((row) => row.diagrams.map((summary) => [summary.kind, summary.removed, summary.open_threads]));

  test('the push draws this repository\'s stage 02 with the server\'s own drawer: one row per requirement', async () => {
    const name = 'item-table-repository';
    const { items } = storedItems();
    const snapshot = repositorySnapshot(FORMAT_02, { name });
    snapshot.items = [...snapshot.items.filter((entry) => entry.stage !== '02-prd'), ...items];
    const answer = await push(own, snapshot);
    assert.deepEqual(answer.failures, []);
    const table = diagram(name, '/items/02-prd');
    assert.deepEqual([table.kind, table.name, table.stage, table.removed_at], ['item_table', 'Item table', '02-prd', null]);
    const [drawing, ...others] = drawings(table.id);
    assert.deepEqual([drawing.status, others], ['drawn', []]);
    const rows = elements(drawing.id);
    assert.equal(rows.length, 80);
    assert.deepEqual(rows, items.map((entry) => {
      const row = rowOf(entry);
      return { element_key: row.key, trace_id: row.trace_id, kind: 'row', name: row.name, parent_key: null, status: null, detail: row.detail };
    }));
    // The drawing reads its own stage's items and nothing else (SPEC-033).
    assert.equal(drawing.source_digest, sha256(JSON.stringify([['/items/02-prd', sha256(JSON.stringify(items))]])));
    // Stages 12 and 13, which the hub read and which have no items, show empty tables; so do 08 and 09 in 0.2.
    for (const stage of ['08-screen-states', '09-mockup', '12-qa', '13-presentation']) {
      assert.deepEqual(elements(drawings(diagram(name, `/items/${stage}`).id)[0].id), []);
    }
  });

  describe('when pictures come, the table is marked removed and keeps its threads on its rows', () => {
    const name = 'item-table-pictures';
    const [a, b, c, d, e] = [newCommit(), newCommit(), newCommit(), newCommit(), newCommit()];
    const source = `/items/${FLOWS}`;
    const flowFiles = (snapshot) => snapshot.pictures.filter((picture) => picture.stage === FLOWS);
    let table;
    let thread;

    test('a 0.2 snapshot draws stage 03 as its item table, and a row takes a thread', async () => {
      assert.equal((await push(pictured, repositorySnapshot(FORMAT_02, { name, commit: a }))).failures.length, 0);
      table = diagram(name, source);
      const [drawing] = drawings(table.id);
      const rows = elements(drawing.id);
      assert.equal(rows.length, 13);
      assert.equal(rows[0].element_key, 'FL-001');
      // An open thread on the row FL-001, as API-252 opens one (TBL-155).
      db.prepare(`INSERT INTO comment_threads (diagram_id, drawing_id, target_kind, element_key, state, waits_on, opened_at)
                  VALUES (?, ?, 'row', 'FL-001', 'open', 'owner', ?)`).run(table.id, drawing.id, at(clock.now));
      thread = threads(table.id);
      assert.deepEqual(listed(name, FLOWS), [['item_table', false, 1]]);
    });

    test('a 0.3 snapshot draws the stage\'s files: the table is marked removed, with no new drawing, and its thread stays on its row', async () => {
      const snapshot = repositorySnapshot(FORMAT_03, { name, commit: b, replaces: a });
      const files = flowFiles(snapshot).length;
      assert.ok(files > 1);
      const answer = await push(pictured, snapshot);
      // The tables of 03, 08 and 09 make way for the files.
      assert.equal(answer.diagrams.removed, 3);
      const removed = diagram(name, source);
      assert.deepEqual([removed.id, removed.removed_at], [table.id, at(clock.now)]);
      assert.equal(drawings(table.id).length, 1);
      // It made way: TASK-435's push moves none of its threads (SPEC-027).
      assert.deepEqual([threads(table.id), answer.threads_moved], [thread, 0]);
      // Listed after the pictures, marked removed, while it has its open thread (SPEC-005, SPEC-027).
      assert.deepEqual(listed(name, FLOWS), [...Array(files).fill(['user_flow', false, 0]), ['item_table', true, 1]]);
    });

    test('a 0.3 snapshot without the stage\'s files shows its table again, the same with its thread (note 3)', async () => {
      const snapshot = repositorySnapshot(FORMAT_03, { name, commit: c, replaces: b });
      const files = flowFiles(snapshot).length;
      snapshot.pictures = snapshot.pictures.filter((picture) => picture.stage !== FLOWS);
      const answer = await push(pictured, snapshot);
      // Its items did not change: the table comes back with its last drawing.
      assert.deepEqual(answer.diagrams, counted({ unchanged: 28 - files + 1, removed: files }));
      const back = diagram(name, source);
      assert.deepEqual([back.id, back.removed_at], [table.id, null]);
      assert.equal(drawings(table.id).length, 1);
      assert.deepEqual([threads(table.id), answer.threads_moved], [thread, 0]);
      assert.equal(live(name, FLOWS), 0);
      assert.deepEqual(listed(name, FLOWS)[0], ['item_table', false, 1]);
    });

    test('a 0.2 snapshot after it keeps the table, as every picture last drawn of the stage is removed', async () => {
      const snapshot = repositorySnapshot(FORMAT_02, { name, commit: d, replaces: c });
      snapshot.items.find((entry) => entry.id === 'FL-002').title = 'A flow renamed';
      const answer = await push(pictured, snapshot);
      assert.equal(answer.diagrams.drawn, 1);
      assert.equal(diagram(name, source).removed_at, null);
      const [, second] = drawings(table.id);
      assert.equal(elements(second.id).find((row) => row.element_key === 'FL-002').name, 'A flow renamed');
      // 08 and 09 keep their pictures as last drawn, so their tables stay removed.
      for (const stage of ['08-screen-states', '09-mockup']) assert.notEqual(diagram(name, `/items/${stage}`).removed_at, null);
    });

    test('and when the files come back, the table makes way again and keeps its thread', async () => {
      const answer = await push(pictured, repositorySnapshot(FORMAT_03, { name, commit: e, replaces: d }));
      assert.equal(answer.diagrams.removed, 1);
      assert.equal(diagram(name, source).removed_at, at(clock.now));
      assert.deepEqual([threads(table.id), answer.threads_moved], [thread, 0]);
      assert.deepEqual(listed(name, FLOWS).at(-1), ['item_table', true, 1]);
    });
  });

  test('a stage of 03, 08 or 09 that never had a picture file shows its item table under 0.3 (note 3)', async () => {
    const name = 'item-table-no-files';
    const snapshot = repositorySnapshot(FORMAT_03, { name });
    snapshot.pictures = snapshot.pictures.filter((picture) => picture.stage !== FLOWS && picture.stage !== '09-mockup');
    await push(pictured, snapshot);
    assert.equal(elements(drawings(diagram(name, `/items/${FLOWS}`).id)[0].id).length, 13);
    // Stage 09, read with no items, shows an empty table; 08 has its files and shows no table.
    assert.deepEqual(elements(drawings(diagram(name, '/items/09-mockup').id)[0].id), []);
    assert.equal(diagram(name, '/items/08-screen-states'), undefined);
  });

  test('without a drawer for a stage\'s files, the stage shows no picture and keeps its item table', async () => {
    const name = 'item-table-no-drawer';
    await push(own, repositorySnapshot(FORMAT_03, { name }));
    // The server has no drawer of user flows or mockups yet.
    for (const stage of [FLOWS, '09-mockup']) assert.equal(diagram(name, `/items/${stage}`).removed_at, null);
    // It draws screen states (TASK-426), so stage 08 shows its pictures and no item table.
    assert.equal(diagram(name, '/items/08-screen-states'), undefined);
    assert.equal(diagram(name, 'docs/08-screens/SCR-142.md').kind, 'screen_states');
  });

  test('a table removed because its stage is no longer read did not make way: its threads move to the diagram', async () => {
    // Under 0.3, a format that carries stage 03's pictures: with no drawer of its files, the stage shows its table.
    const name = 'item-table-not-read';
    const [a, b] = [newCommit(), newCommit()];
    await push(own, repositorySnapshot(FORMAT_03, { name, commit: a }));
    const table = diagram(name, `/items/${FLOWS}`);
    const [drawing] = drawings(table.id);
    const row = elements(drawing.id).find((each) => each.element_key === 'FL-001');
    db.prepare(`INSERT INTO comment_threads (diagram_id, drawing_id, target_kind, element_key, state, waits_on, opened_at)
                VALUES (?, ?, 'row', 'FL-001', 'open', 'owner', ?)`).run(table.id, drawing.id, at(clock.now));
    // The hub reads stage 03 no more: no items, no files, no read record.
    const unread = (snapshot) => {
      snapshot.items = snapshot.items.filter((entry) => entry.stage !== FLOWS);
      snapshot.pictures = snapshot.pictures.filter((picture) => picture.stage !== FLOWS);
      delete snapshot.stages[FLOWS].read;
      return snapshot;
    };
    const answer = await push(own, unread(repositorySnapshot(FORMAT_03, { name, commit: b, replaces: a })));
    assert.equal(diagram(name, `/items/${FLOWS}`).removed_at, at(clock.now));
    // SPEC-027 moves its row's thread to the diagram, with the row's last name (TASK-435).
    assert.equal(answer.threads_moved, 1);
    assert.deepEqual(threads(table.id).map((each) => [each.target_kind, each.element_key, each.removed_name, each.state]), [
      ['diagram', 'FL-001', row.name, 'open'],
    ]);
    // A read stage whose items all go keeps its table, with no rows.
    const empty = unread(repositorySnapshot(FORMAT_03, { name, commit: newCommit(), replaces: b }));
    empty.items = empty.items.filter((entry) => entry.stage !== '06-api');
    await push(own, empty);
    const api = diagram(name, '/items/06-api');
    assert.deepEqual([api.removed_at, elements(drawings(api.id).at(-1).id)], [null, []]);
  });

  test('a completed revision draws again only the items it kept: a stage its older push did not read fails nothing', async () => {
    const name = 'item-table-completed';
    const commit = newCommit();
    // The older push's hub did not read stages 08 and 09, so the revision keeps no items of them.
    const older = repositorySnapshot(FORMAT_02, { name, commit });
    for (const stage of ['08-screen-states', '09-mockup']) delete older.stages[stage].read;
    await push(pictured, older);
    assert.equal(diagram(name, '/items/08-screen-states'), undefined);
    // The same commit in 0.3, whose hub read them, without the files of 09.
    const newer = repositorySnapshot(FORMAT_03, { name, commit });
    newer.pictures = newer.pictures.filter((picture) => picture.stage !== '09-mockup');
    const answer = await push(pictured, newer);
    assert.deepEqual([answer.same_commit, answer.failures], [true, []]);
    assert.notEqual(diagram(name, `/items/${FLOWS}`).removed_at, null);
    for (const stage of ['08-screen-states', '09-mockup']) assert.equal(diagram(name, `/items/${stage}`), undefined);
  });

  test('a truncated snapshot draws the rows that came, and claims no read stage empty', async () => {
    const name = 'item-table-truncated';
    // The hub cut items from the end to fit: here all of stage 10's.
    const snapshot = repositorySnapshot(FORMAT_02, { name });
    snapshot.truncated = true;
    snapshot.items = snapshot.items.filter((entry) => entry.stage !== '10-wbs');
    await push(own, snapshot);
    assert.equal(elements(drawings(diagram(name, '/items/02-prd').id)[0].id).length, 80);
    for (const stage of ['08-screen-states', '09-mockup', '10-wbs', '12-qa', '13-presentation']) {
      assert.equal(diagram(name, `/items/${stage}`), undefined, stage);
    }
  });

  test('no log line holds an item\'s text (rule 5)', async () => {
    const marker = `item ${randomBytes(8).toString('hex')}`;
    const snapshot = repositorySnapshot(FORMAT_02, { name: 'item-table-logs' });
    snapshot.items.push(item('REQ-999', { title: marker, status: `${marker} removed`, links: ['REQ-001'], where: `docs/${marker.replace(' ', '-')}.md:1` }));
    await push(own, snapshot);
    const logs = own.logText();
    assert.ok(logs.includes('pushSnapshot'));
    assert.equal(logs.includes(marker), false);
    assert.equal(logs.includes(marker.replace(' ', '-')), false);
  });
});

test('the item_table drawer is drawing.js\'s drawer of the item_table kind', () => {
  assert.equal(DRAWERS.item_table, itemTable);
});
