// The diagram read (TASK-441; API-265, SPEC-003 to SPEC-012, SPEC-022, SPEC-027, SPEC-034, SPEC-051, rule 5): every
// response API-265 lists, its answer against the contract's Diagram, the tables it touches (note 23) and its log lines.
// The done condition: a diagram of 300 elements is read in under a second.
//
// Most rows are written straight into the store with test/seed.js, positions, change sets and confirmations included,
// as the operations of later tasks will write them (TASK-442 to TASK-446). The last part pushes this repository's
// snapshot and reads what the server's own drawers drew.

import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { after, before, describe, test } from 'node:test';
import { changesSince } from '../src/diagram.js';
import { changeSetsChanged } from '../src/entries.js';
import { idOf } from '../src/ids.js';
import { ROUTES } from '../src/routes.js';
import { openStore } from '../src/store.js';
import { responseRecord } from './responses.js';
import { REPOSITORY, seed, TIME } from './seed.js';
import { FORMAT_03, repositorySnapshot } from './snapshots.js';
import { localGate, newId, startServer, testStore, TRACE_ID } from './support.js';
import { checkLayer, checkTables, recordTables } from './tables.js';

const at = (minutes) => new Date(Date.parse('2026-11-23T00:00:00.000Z') + minutes * 60 * 1000).toISOString();
const box = (x, y = 0) => ({ x, y, width: 200, height: 80 });
// A table of the ERD as a drawer draws one, with its key and trace ID.
const table = (id, name, detail = {}) => ({ key: id, trace_id: id, kind: 'table', name, detail: { columns: [], ...detail } });

describe('the diagram read', () => {
  const responses = responseRecord();
  let folder;
  let db;
  let recorder;
  let local;
  let server;
  let s;

  const owner = () => ({ 'Cf-Access-Jwt-Assertion': local.token() });
  const path = (name, diagram) => `/api/projects/${name}/diagrams/${typeof diagram === 'number' ? idOf('dg', diagram) : diagram}`;
  const read = async (name, diagram, headers = owner()) => responses.note('getDiagram', await server.send({ path: path(name, diagram), headers }));

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-diagram-'));
    ({ db } = openStore(folder));
    recorder = recordTables(db);
    local = localGate();
    server = await startServer({ store: recorder.store, gate: local.gate, routes: ROUTES });
    s = seed(db);
  });

  after(async () => {
    await server.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  test('answers the drawing a diagram shows, its elements by name and trace ID, and where each stands (SPEC-010, SPEC-011, SPEC-012)', async () => {
    const space = s.project();
    const erd = s.diagram(space);
    s.elements(erd.drawing, [
      table('TBL-146', 'agent_credentials', { where: 'db/nexus.sql:10', box: box(40, 60) }),
      // A table without a name: the page shows its trace ID (SPEC-010).
      table('TBL-147', '', { box: box(300, 60) }),
      { key: 'line:TBL-147>TBL-146', kind: 'line', name: 'created_by_credential', parent: 'TBL-147', detail: { from: 'TBL-147', to: 'TBL-146', points: [{ x: 1, y: 2 }] } },
      // A box past the contract's reach has no position.
      { key: 'TBL-148', trace_id: 'TBL-148', kind: 'table', name: 'snapshots', status: 'missing', detail: { columns: [], box: box(2_000_000) } },
    ]);
    // Where the owner put a table wins over its box; a position of an element the drawing no longer has is not shown.
    s.position(erd.id, 'TBL-147', { x: 512.5, y: -20 });
    s.position(erd.id, 'TBL-999', { x: 1, y: 1 });

    const answer = await read(space.name, erd.id);
    assert.equal(answer.status, 200);
    assert.deepEqual(answer.json, {
      id: idOf('dg', erd.id),
      project: space.name,
      part: '',
      stage: '05-erd',
      kind: 'erd',
      name: 'ERD',
      removed: false,
      drawing: { id: idOf('dw', erd.drawing), revision: 1, version: space.commit, status: 'drawn', failed_at: null, drawn_at: TIME },
      last_drawn: null,
      elements: [
        {
          key: 'TBL-146', trace_id: 'TBL-146', kind: 'table', name: 'agent_credentials', parent: null, status: null,
          detail: { columns: [], where: 'db/nexus.sql:10', box: box(40, 60) }, position: { x: 40, y: 60 },
        },
        {
          key: 'TBL-147', trace_id: 'TBL-147', kind: 'table', name: '', parent: null, status: null,
          detail: { columns: [], box: box(300, 60) }, position: { x: 512.5, y: -20 },
        },
        {
          key: 'line:TBL-147>TBL-146', trace_id: null, kind: 'line', name: 'created_by_credential', parent: 'TBL-147', status: null,
          detail: { from: 'TBL-147', to: 'TBL-146', points: [{ x: 1, y: 2 }] }, position: null,
        },
        {
          key: 'TBL-148', trace_id: 'TBL-148', kind: 'table', name: 'snapshots', parent: null, status: 'missing',
          detail: { columns: [], box: box(2_000_000) }, position: null,
        },
      ],
      overlays: [],
      since_confirmation: null,
      confirmation: null,
      threads: [],
    });
  });

  test('a failed drawing comes with the last good one, whose elements it shows, and where it failed (SPEC-001)', async () => {
    const space = s.project();
    const first = space.commit;
    const erd = s.diagram(space);
    s.elements(erd.drawing, [table('TBL-146', 'agent_credentials', { box: box(0) })]);
    s.snapshot(space);
    const failed = s.drawing(space, erd.id, { status: 'failed', failedPath: 'db/nexus.sql', failedLine: 41, at: at(10) });

    let answer = await read(space.name, erd.id);
    assert.deepEqual(answer.json.drawing, {
      id: idOf('dw', failed), revision: 2, version: space.commit, status: 'failed', failed_at: 'db/nexus.sql:41', drawn_at: at(10),
    });
    const good = { id: idOf('dw', erd.drawing), revision: 1, version: first, status: 'drawn', failed_at: null, drawn_at: TIME };
    assert.deepEqual(answer.json.last_drawn, good);
    assert.deepEqual(answer.json.elements.map((element) => element.key), ['TBL-146']);

    // A failure without a line names its file alone, and the last good drawing stays the same.
    s.snapshot(space);
    s.drawing(space, erd.id, { status: 'failed', failedPath: 'db/nexus.sql' });
    answer = await read(space.name, erd.id);
    assert.deepEqual([answer.json.drawing.revision, answer.json.drawing.failed_at], [3, 'db/nexus.sql']);
    assert.deepEqual(answer.json.last_drawn, good);

    // A diagram that never drew has no elements and no last good drawing.
    const never = s.diagram(space, { stage: '07-sitemap', sourceKey: '/pictures/07-sitemap', kind: 'sitemap', name: 'Sitemap', status: 'failed' });
    answer = await read(space.name, never.id);
    assert.deepEqual([answer.json.drawing.status, answer.json.drawing.failed_at, answer.json.last_drawn, answer.json.elements],
      ['failed', 'db/nexus.sql', null, []]);
  });

  test('an item table names each link from the project\'s latest item documents, and one it cannot find by \'\' (SPEC-005, SPEC-010)', async () => {
    const space = s.project();
    s.document(space, '/items/01-domain', '01-domain', JSON.stringify([
      { id: 'CTX-037', kind: 'context', stage: '01-domain', title: 'Diagram' },
      { id: 'CTX-038', kind: 'context', stage: '01-domain', title: '   ' },
    ]));
    s.document(space, '/items/02-prd', '02-prd', JSON.stringify([{ id: 'REQ-001', kind: 'requirement', stage: '02-prd', title: 'Accept a snapshot', links: ['CTX-037'] }]));
    const items = s.diagram(space, { stage: '02-prd', sourceKey: '/items/02-prd', kind: 'item_table', name: 'Item table' });
    const where = 'docs/02-prd/requirements.md:23';
    s.elements(items.drawing, [
      { key: 'REQ-001', trace_id: 'REQ-001', kind: 'row', name: 'Accept a snapshot', detail: { status: 'active', links: ['CTX-037', 'CTX-038', 'CTX-099', 'REQ-001'], where } },
      { key: 'row:odd', kind: 'row', name: '', status: 'unreadable', detail: { status: '', links: [], where: null } },
    ]);

    let answer = await read(space.name, items.id);
    assert.equal(answer.status, 200);
    assert.deepEqual(answer.json.elements, [
      {
        key: 'REQ-001', trace_id: 'REQ-001', kind: 'row', name: 'Accept a snapshot', parent: null, status: null, position: null,
        detail: {
          status: 'active',
          // A blank title and an ID no item document has give '': the page shows the ID.
          links: [{ id: 'CTX-037', name: 'Diagram' }, { id: 'CTX-038', name: '' }, { id: 'CTX-099', name: '' }, { id: 'REQ-001', name: 'Accept a snapshot' }],
          where,
        },
      },
      { key: 'row:odd', trace_id: null, kind: 'row', name: '', parent: null, status: 'unreadable', position: null, detail: { status: '', links: [], where: null } },
    ]);

    // A newer snapshot renames CTX-037 in stage 01, and holds no stage-02 items: the link takes the new name without a
    // new drawing of the table (SPEC-033), and the names come from the snapshot the project holds only.
    s.snapshot(space);
    s.document(space, '/items/01-domain', '01-domain', JSON.stringify([{ id: 'CTX-037', kind: 'context', stage: '01-domain', title: 'Picture' }]));
    answer = await read(space.name, items.id);
    assert.equal(answer.json.drawing.id, idOf('dw', items.drawing));
    assert.deepEqual(answer.json.elements[0].detail.links.map((link) => link.name), ['Picture', '', '', '']);
  });

  test('proposals and accepted change sets are overlays, newest first, with their steps, pull request and reflection entry (SPEC-022)', async () => {
    const space = s.project();
    const erd = s.diagram(space);
    s.elements(erd.drawing, [table('TBL-146', 'agent_credentials', { box: box(0) })]);
    const thread = s.thread(erd, { author: 'agent' });
    const detail = {
      items: ['TBL-146'], adds: ['TBL-171'], reason: 'The owner asked to name the table after the term.',
      change: 'Rename agent_credentials to agent_keys.', source_text: 'CREATE TABLE agent_keys (id INTEGER PRIMARY KEY);',
    };
    const proposal = s.changeSet(space, erd, { origin: 'proposal', threadId: thread, at: at(10), detail });
    s.change(proposal, { op: 'rename', element: 'TBL-146', name: 'agent_keys' });
    s.change(proposal, { op: 'add', element: 'TBL-171', name: 'agent_key_uses' });
    s.change(proposal, { op: 'connect', element: 'TBL-171', target: 'TBL-146' });
    // Two change sets on one element: both are listed, the newest first (SPEC-022).
    const edit = s.changeSet(space, erd, { at: at(20), decidedAt: at(20) });
    s.change(edit, { op: 'rename', element: 'TBL-146', name: 'agent_secrets' });
    const pullRequest = s.pullRequest(space, { number: 12 });
    const linked = s.changeSet(space, erd, { at: at(5), decidedAt: at(6), pullRequestId: pullRequest });
    s.change(linked, { op: 'remove', element: 'TBL-146' });
    // Rejected, cancelled and reflected change sets are no overlays.
    s.changeSet(space, erd, { origin: 'proposal', threadId: thread, state: 'rejected', at: at(30) });
    s.changeSet(space, erd, { state: 'cancelled', at: at(31) });
    s.setChangeSet(s.changeSet(space, erd, { at: at(32) }), { reflectedDrawing: erd.drawing });
    // The agent to-do's reflection entries (entries.js): one for the accepted change sets in no pull request, the edit
    // alone, and one for those of #12, the linked one alone, each named by its only change set.
    changeSetsChanged(db, { project: space.id, diagram: erd.id, time: at(40) });
    const entries = db.prepare("SELECT id, change_set_id FROM todos WHERE diagram_id = ? AND kind = 'reflect' AND closed_at IS NULL").all(erd.id);
    assert.equal(entries.length, 2);
    const entryOf = (set) => idOf('ne', Number(entries.find((entry) => Number(entry.change_set_id) === set).id));

    const answer = await read(space.name, erd.id);
    const common = { part: '', stage: '05-erd', diagram: idOf('dg', erd.id), drawing: idOf('dw', erd.drawing), version: space.commit };
    assert.deepEqual(answer.json.overlays, [
      {
        id: idOf('np', edit), ...common, origin: 'direct_edit', thread: null, state: 'accepted', items: [], adds: [], reason: null,
        change: null, source_text: false, changes: [{ op: 'rename', element: 'TBL-146', name: 'agent_secrets', target: null }],
        made_at: at(20), decided_at: at(20), reflection: entryOf(edit), pull_request: null,
      },
      {
        id: idOf('np', proposal), ...common, origin: 'proposal', thread: idOf('nc', thread), state: 'proposed', ...detail, source_text: true,
        changes: [
          { op: 'rename', element: 'TBL-146', name: 'agent_keys', target: null },
          { op: 'add', element: 'TBL-171', name: 'agent_key_uses', target: null },
          { op: 'connect', element: 'TBL-171', name: null, target: 'TBL-146' },
        ],
        made_at: at(10), decided_at: null, reflection: null, pull_request: null,
      },
      {
        id: idOf('np', linked), ...common, origin: 'direct_edit', thread: null, state: 'accepted', items: [], adds: [], reason: null,
        change: null, source_text: false, changes: [{ op: 'remove', element: 'TBL-146', name: null, target: null }],
        made_at: at(5), decided_at: at(6), reflection: entryOf(linked), pull_request: 'https://github.com/example/demo/pull/12',
      },
    ]);
    assert.notEqual(entryOf(edit), entryOf(linked));
  });

  test('marks what changed since the latest confirmation, whatever its state, and nothing when never confirmed (SPEC-034)', async () => {
    const space = s.project();
    const v1 = space.commit;
    const erd = s.diagram(space);
    s.elements(erd.drawing, [
      table('TBL-146', 'X', { where: 'db/nexus.sql:1', box: box(0) }),
      table('TBL-147', 'Kept', { columns: [{ name: 'id' }], where: 'db/nexus.sql:9', box: box(220) }),
      table('TBL-148', 'Gone', { box: box(440) }),
      table('TBL-149', 'Typed', { columns: [{ name: 'id', type: 'INTEGER' }], box: box(660) }),
    ]);
    let answer = await read(space.name, erd.id);
    assert.deepEqual([answer.json.since_confirmation, answer.json.confirmation], [null, null]);

    // Confirmed at the drawing shown: nothing changed since.
    const first = s.confirm(space, erd, { at: at(10) });
    answer = await read(space.name, erd.id);
    assert.deepEqual(answer.json.since_confirmation, { version: v1, added: [], removed: [], changed: [] });
    assert.deepEqual(answer.json.confirmation, {
      id: idOf('nk', first), diagram: idOf('dg', erd.id), drawing: idOf('dw', erd.drawing), version: v1, state: 'confirmed',
      confirmed_at: at(10), ended_at: null, recorded_at: null, cancel_recorded_at: null, pull_request: null,
    });

    // V2 renames X to Y, removes Gone, adds New and changes a column of Typed. Kept moves down a line of its file and
    // across the board, and its detail's members come in another order: that is not a change of what it says.
    s.snapshot(space);
    const v2 = s.drawing(space, erd.id);
    s.elements(v2, [
      table('TBL-150', 'New', { box: box(0) }),
      table('TBL-146', 'Y', { where: 'db/nexus.sql:2', box: box(220) }),
      { key: 'TBL-147', trace_id: 'TBL-147', kind: 'table', name: 'Kept', detail: { box: box(880, 300), where: 'db/nexus.sql:12', columns: [{ name: 'id' }] } },
      table('TBL-149', 'Typed', { columns: [{ name: 'id', type: 'TEXT' }], box: box(660) }),
    ]);
    s.invalidate(first, v2);
    answer = await read(space.name, erd.id);
    assert.deepEqual(answer.json.since_confirmation, { version: v1, added: ['TBL-150'], removed: ['TBL-148'], changed: ['TBL-146', 'TBL-149'] });
    assert.deepEqual([answer.json.confirmation.state, answer.json.confirmation.drawing], ['invalidated', idOf('dw', erd.drawing)]);

    // Confirmed at V2 and cancelled: the latest confirmation is still the one compared with.
    const second = s.confirm(space, { id: erd.id, drawing: v2 }, { at: at(30) });
    s.cancel(second);
    answer = await read(space.name, erd.id);
    assert.deepEqual(answer.json.since_confirmation, { version: space.commit, added: [], removed: [], changed: [] });
    assert.deepEqual([answer.json.confirmation.id, answer.json.confirmation.state, answer.json.confirmation.ended_at], [idOf('nk', second), 'cancelled', TIME]);

    // A drawing that fails after it changes nothing: the diagram shows V2 still.
    s.snapshot(space);
    s.drawing(space, erd.id, { status: 'failed' });
    answer = await read(space.name, erd.id);
    assert.deepEqual(answer.json.since_confirmation.changed, []);
    assert.equal(answer.json.last_drawn.id, idOf('dw', v2));
  });

  test('the confirmation names its record\'s pull request: none until reported, the open one, the one that recorded it, then the cancel\'s (API-259, TASK-469)', async () => {
    const space = s.project();
    const erd = s.diagram(space);
    const confirmation = s.confirm(space, erd, { at: at(10) });
    const fieldsOf = async () => {
      const { json } = await read(space.name, erd.id);
      return [json.confirmation.state, json.confirmation.recorded_at, json.confirmation.cancel_recorded_at, json.confirmation.pull_request];
    };
    // Confirmed, before the agent reports a pull request: null.
    assert.deepEqual(await fieldsOf(), ['confirmed', null, null, null]);
    // opened links the record's pull request, open while it is in review.
    const record = s.pullRequest(space, { number: 21, purpose: 'record' });
    s.linkRecord(confirmation, record);
    assert.deepEqual(await fieldsOf(), ['confirmed', null, null, `${REPOSITORY}/pull/21`]);
    // closed without merging unlinks it.
    s.linkRecord(confirmation, null);
    assert.deepEqual(await fieldsOf(), ['confirmed', null, null, null]);
    // merged records it: the pull request that recorded it.
    const recordedBy = s.pullRequest(space, { number: 22, state: 'merged', purpose: 'record' });
    s.linkRecord(confirmation, recordedBy);
    s.record(confirmation);
    assert.deepEqual(await fieldsOf(), ['confirmed', TIME, null, `${REPOSITORY}/pull/22`]);
    // Cancelled once recorded, the cancel's record is due: null until its pull request is reported, though the column
    // still names the one that recorded the confirmation; then the cancel's, open and then merged.
    s.cancel(confirmation);
    assert.deepEqual(await fieldsOf(), ['cancelled', TIME, null, null]);
    const cancelBy = s.pullRequest(space, { number: 23, purpose: 'record' });
    s.linkRecord(confirmation, cancelBy);
    assert.deepEqual(await fieldsOf(), ['cancelled', TIME, null, `${REPOSITORY}/pull/23`]);
    // merged, as API-259's merged report moves it, records the cancel.
    db.prepare("UPDATE pull_requests SET state = 'merged', closed_at = ? WHERE id = ?").run(TIME, cancelBy);
    s.recordCancel(confirmation);
    assert.deepEqual(await fieldsOf(), ['cancelled', TIME, TIME, `${REPOSITORY}/pull/23`]);

    // Its cancel's pull request closed without merging unlinks it: null again.
    const cancelClosed = s.project();
    const cancelErd = s.diagram(cancelClosed);
    const recordedThenCancelled = s.confirm(cancelClosed, cancelErd);
    s.record(recordedThenCancelled);
    s.cancel(recordedThenCancelled);
    s.linkRecord(recordedThenCancelled, null);
    assert.equal((await read(cancelClosed.name, cancelErd.id)).json.confirmation.pull_request, null);

    // Cancelled before it was recorded, its record is withdrawn: its open pull request is no longer named. Once that
    // pull request merges all the same (API-259 marks it recorded), the cancel is due and none is reported: null.
    const early = s.project();
    const earlyErd = s.diagram(early);
    const withdrawn = s.confirm(early, earlyErd);
    const earlyPull = s.pullRequest(early, { number: 24, purpose: 'record' });
    s.linkRecord(withdrawn, earlyPull);
    assert.equal((await read(early.name, earlyErd.id)).json.confirmation.pull_request, `${REPOSITORY}/pull/24`);
    s.cancel(withdrawn);
    assert.equal((await read(early.name, earlyErd.id)).json.confirmation.pull_request, null);
    db.prepare("UPDATE pull_requests SET state = 'merged', closed_at = ? WHERE id = ?").run(TIME, earlyPull);
    s.record(withdrawn);
    const merged = (await read(early.name, earlyErd.id)).json.confirmation;
    assert.deepEqual([merged.recorded_at, merged.pull_request], [TIME, null]);

    // A project that names no repository has no link to give: null.
    const bare = s.project(undefined, { repository: null });
    const bareErd = s.diagram(bare);
    const bareConfirmation = s.confirm(bare, bareErd);
    s.linkRecord(bareConfirmation, s.pullRequest(bare, { number: 5, purpose: 'record' }));
    assert.equal((await read(bare.name, bareErd.id)).json.confirmation.pull_request, null);
  });

  test('a merged pull request is named only by the confirmation it recorded, when two share one and one is cancelled first (API-275, API-259, API-276)', async () => {
    const send = async (path, headers, body) => (await server.send({
      method: 'POST', path, headers: { ...headers, 'Content-Type': 'application/json', 'Idempotency-Key': `"${newId('nw')}"` }, body: JSON.stringify(body),
    }));
    const confirm = async (space, where) => (await send(`${path(space.name, where.id)}/confirmation`, owner(), { drawing: idOf('dw', where.drawing) })).json.confirmation.id;
    const report = (space, confirmation, event, number) => send(`/api/spaces/${space.name}/checkpoints/${confirmation}/report`,
      { ...s.agent.headers, 'Nexus-Session': 'claude-code-4f2a91' }, { event, pull_request: `${REPOSITORY}/pull/${number}` });
    const cancel = (space, confirmation) => send(`/api/projects/${space.name}/confirmations/${confirmation}/cancel`, owner(), {});
    const fieldsOf = async (space, where) => {
      const { confirmation } = (await read(space.name, where.id)).json;
      return [confirmation.state, confirmation.recorded_at === null, confirmation.pull_request];
    };
    // Two diagrams of one project, confirmed, and one pull request reported for both records.
    const space = s.project();
    const first = s.diagram(space);
    const second = s.diagram(space, { sourceKey: '/pictures/05-erd-second', name: 'ERD 2' });
    const [one, two] = [await confirm(space, first), await confirm(space, second)];
    for (const confirmation of [one, two]) assert.equal((await report(space, confirmation, 'opened', 40)).status, 200);
    assert.deepEqual(await fieldsOf(space, first), ['confirmed', true, `${REPOSITORY}/pull/40`]);
    // The first is cancelled before its record: its record is withdrawn, and it names no pull request.
    assert.equal((await cancel(space, one)).status, 200);
    assert.deepEqual(await fieldsOf(space, first), ['cancelled', true, null]);
    // The pull request merges as the second's record. It recorded neither the first nor a cancel of it: still null.
    assert.deepEqual([(await report(space, two, 'merged', 40)).status], [200]);
    assert.deepEqual(await fieldsOf(space, second), ['confirmed', false, `${REPOSITORY}/pull/40`]);
    assert.deepEqual(await fieldsOf(space, first), ['cancelled', true, null]);

    // Both live: once it merges as one's record, the other's record is still due and the pull request is not open, so
    // null until it is reported merged for that one too, which records it.
    const pair = s.project();
    const left = s.diagram(pair);
    const right = s.diagram(pair, { sourceKey: '/pictures/05-erd-second', name: 'ERD 2' });
    const [l, r] = [await confirm(pair, left), await confirm(pair, right)];
    for (const confirmation of [l, r]) assert.equal((await report(pair, confirmation, 'opened', 41)).status, 200);
    assert.equal((await report(pair, r, 'merged', 41)).status, 200);
    assert.deepEqual(await fieldsOf(pair, right), ['confirmed', false, `${REPOSITORY}/pull/41`]);
    assert.deepEqual(await fieldsOf(pair, left), ['confirmed', true, null]);
    assert.equal((await report(pair, l, 'merged', 41)).status, 200);
    assert.deepEqual(await fieldsOf(pair, left), ['confirmed', false, `${REPOSITORY}/pull/41`]);
  });

  test('an element is changed when its name, kind, trace ID, parent, status or detail changes, and not when only its place or line does', () => {
    const row = (fields = {}) => ({
      element_key: 'K', trace_id: 'CTX-001', kind: 'context', name: 'Drawing', parent_key: null, status: null,
      detail: JSON.stringify({ purpose: 'draws', where: 'docs/a.md:1', box: box(0), points: [] }), ...fields,
    });
    const changed = (fields) => changesSince([row()], [row(fields)]).changed;
    for (const fields of [
      { name: 'Drawings' }, { kind: 'external' }, { trace_id: null }, { parent_key: 'lane:Owner' }, { status: 'unreadable' },
      { detail: JSON.stringify({ purpose: 'draws again', where: 'docs/a.md:1', box: box(0), points: [] }) },
      { detail: JSON.stringify({ where: 'docs/a.md:1', box: box(0), points: [] }) },
    ]) {
      assert.deepEqual(changed(fields), ['K'], JSON.stringify(fields));
    }
    for (const fields of [
      {}, { detail: JSON.stringify({ points: [{ x: 1, y: 1 }], box: box(500, 40), where: 'docs/a.md:90', purpose: 'draws' }) },
      { detail: JSON.stringify({ purpose: 'draws' }) },
    ]) {
      assert.deepEqual(changed(fields), [], JSON.stringify(fields));
    }
  });

  test('lists the threads, open ones first, with their entries and last entry; a removed element\'s thread keeps its key and last name (SPEC-027)', async () => {
    const space = s.project();
    const erd = s.diagram(space);
    s.elements(erd.drawing, [table('TBL-146', 'agent_credentials', { box: box(0) })]);
    const closed = s.thread(erd, { at: at(1) });
    s.comment(closed, { at: at(2) });
    s.closeThread(closed);
    const onElement = s.thread(erd, { at: at(3) });
    s.comment(onElement, { author: 'agent', at: at(5) });
    s.comment(onElement, { author: 'owner', at: at(7) });
    const onDiagram = s.thread(erd, { target: 'diagram', author: 'agent', at: at(4) });
    // The thread of an element that left the document, moved to the diagram as TASK-435 moves it.
    const moved = s.thread(erd, { elementKey: 'TBL-160', at: at(6) });
    db.prepare("UPDATE comment_threads SET target_kind = 'diagram', removed_name = 'old_table' WHERE id = ?").run(moved);
    const resolved = s.thread(erd, { at: at(8) });
    s.closeThread(resolved, { by: 'reflection' });
    db.prepare("INSERT INTO thread_resolution_events (thread_id, event, created_at) VALUES (?, 'resolved', ?)").run(resolved, at(9));

    const answer = await read(space.name, erd.id);
    assert.deepEqual(answer.json.threads, [
      { id: idOf('nc', onElement), target: 'element', element: 'TBL-146', removed_name: null, state: 'open', waits_on: 'agent', last_at: at(7), entries: 3 },
      { id: idOf('nc', onDiagram), target: 'diagram', element: null, removed_name: null, state: 'open', waits_on: 'owner', last_at: at(4), entries: 1 },
      { id: idOf('nc', moved), target: 'diagram', element: 'TBL-160', removed_name: 'old_table', state: 'open', waits_on: 'agent', last_at: at(6), entries: 1 },
      { id: idOf('nc', closed), target: 'element', element: 'TBL-146', removed_name: null, state: 'closed', waits_on: null, last_at: at(2), entries: 2 },
      { id: idOf('nc', resolved), target: 'element', element: 'TBL-146', removed_name: null, state: 'closed', waits_on: null, resolved: true, last_at: at(8), entries: 1 },
    ]);
  });

  test('a removed diagram opens while it has an open thread, and once they are all closed answers diagram_not_found (SPEC-027, note 10)', async () => {
    const space = s.project();
    const gone = s.diagram(space, { removed: true });
    s.elements(gone.drawing, [table('TBL-146', 'agent_credentials', { box: box(0) })]);
    const thread = s.thread(gone, { target: 'diagram' });
    let answer = await read(space.name, gone.id);
    assert.equal(answer.status, 200);
    assert.deepEqual([answer.json.removed, answer.json.elements.length, answer.json.threads.length], [true, 1, 1]);

    s.closeThread(thread);
    answer = await read(space.name, gone.id);
    assert.deepEqual([answer.status, answer.json.code], [404, 'diagram_not_found']);

    // A diagram that a snapshot draws again opens again, with its closed thread.
    s.removeDiagram(gone.id, false);
    answer = await read(space.name, gone.id);
    assert.deepEqual([answer.status, answer.json.removed, answer.json.threads[0].state], [200, false, 'closed']);
  });

  test('a removed diagram opens while a proposed AI proposal or a waiting direct edit keeps it, until the owner answers the last (SPEC-027, SPEC-020, TASK-468)', async () => {
    const space = s.project();
    let made = 0;
    const removedErd = () => {
      made += 1;
      const erd = s.diagram(space, { sourceKey: `/pictures/05-erd/gone-${made}`, removed: true });
      s.elements(erd.drawing, [table('TBL-146', 'agent_credentials', { box: box(0) })]);
      return erd;
    };
    // The owner's writes, each with its own request key: accepting (API-270) and rejecting (API-271) a proposal,
    // closing a thread (API-269) and cancelling a direct edit (API-273).
    const write = async (action, path) => responses.note(action, await server.send({
      method: 'POST', path, body: '{}',
      headers: { ...owner(), 'Content-Type': 'application/json', 'Idempotency-Key': `"${newId('nw')}"` },
    }));
    const accept = (id) => write('acceptProposal', `/api/projects/${space.name}/change-sets/${idOf('np', id)}/accept`);
    const reject = (id) => write('rejectProposal', `/api/projects/${space.name}/change-sets/${idOf('np', id)}/reject`);
    const close = (id) => write('closeThread', `/api/projects/${space.name}/threads/${idOf('nc', id)}/close`);
    const cancel = (id) => write('cancelDirectEdit', `/api/projects/${space.name}/change-sets/${idOf('np', id)}/cancel`);
    const opens = async (diagram) => {
      const answer = await read(space.name, diagram.id);
      assert.equal(answer.status, 200, answer.text);
      assert.equal(answer.json.removed, true);
      return answer.json;
    };
    const gone = async (diagram) => {
      const answer = await read(space.name, diagram.id);
      assert.deepEqual([answer.status, answer.json.code], [404, 'diagram_not_found']);
    };

    // A proposed AI proposal whose thread the owner closed keeps the diagram; rejecting it leaves nothing.
    const asked = removedErd();
    const askedThread = s.thread(asked, { target: 'diagram' });
    const proposal = s.changeSet(space, asked, { origin: 'proposal', threadId: askedThread });
    changeSetsChanged(db, { project: space.id, diagram: asked.id, time: at(1) });
    assert.equal((await close(askedThread)).status, 200);
    assert.deepEqual((await opens(asked)).overlays.map((overlay) => overlay.state), ['proposed']);
    // Accepting it there is refused (SPEC-027, API-270's document_changed), so it stays proposed and keeps the diagram:
    // only a proposal accepted before the removal is accepted on a removed diagram.
    const refused = await accept(proposal);
    assert.deepEqual([refused.status, refused.json.code], [409, 'document_changed']);
    assert.deepEqual((await opens(asked)).overlays.map((overlay) => overlay.state), ['proposed']);
    assert.equal((await reject(proposal)).status, 200);
    await gone(asked);

    // With its thread open, the rejection keeps the diagram (SPEC-020) until the owner closes the thread.
    const open = removedErd();
    const openThread = s.thread(open, { target: 'diagram' });
    const openProposal = s.changeSet(space, open, { origin: 'proposal', threadId: openThread });
    changeSetsChanged(db, { project: space.id, diagram: open.id, time: at(2) });
    assert.equal((await reject(openProposal)).status, 200);
    assert.deepEqual((await opens(open)).threads.map((thread) => thread.state), ['open']);
    assert.equal((await close(openThread)).status, 200);
    await gone(open);

    // A direct edit waiting for reflection keeps it; cancelling it leaves nothing.
    const edited = removedErd();
    const edit = s.changeSet(space, edited);
    s.change(edit, { element: 'TBL-146', name: 'agent_keys' });
    changeSetsChanged(db, { project: space.id, diagram: edited.id, time: at(3) });
    assert.deepEqual((await opens(edited)).overlays.map((overlay) => overlay.state), ['accepted']);
    assert.equal((await cancel(edit)).status, 200);
    await gone(edited);

    // A withdrawn proposal and a reflected edit leave nothing either.
    const withdrawn = removedErd();
    const withdrawnThread = s.thread(withdrawn, { target: 'diagram' });
    const withdrawnSet = s.changeSet(space, withdrawn, { origin: 'proposal', threadId: withdrawnThread });
    s.closeThread(withdrawnThread);
    await opens(withdrawn);
    s.setChangeSet(withdrawnSet, { state: 'cancelled' });
    await gone(withdrawn);
    const reflected = removedErd();
    const reflectedSet = s.changeSet(space, reflected);
    await opens(reflected);
    s.setChangeSet(reflectedSet, { reflectedDrawing: reflected.drawing });
    await gone(reflected);

    // An accepted AI proposal, which waits on the agent, and a live confirmation keep nothing.
    const accepted = removedErd();
    const acceptedThread = s.thread(accepted, { target: 'diagram' });
    s.closeThread(acceptedThread);
    s.changeSet(space, accepted, { origin: 'proposal', threadId: acceptedThread, state: 'accepted' });
    await gone(accepted);
    const confirmed = removedErd();
    s.confirm(space, confirmed);
    await gone(confirmed);
  });

  test('keeps to the contract\'s form whatever the stored rows hold', async () => {
    const space = s.project();
    const erd = s.diagram(space);
    // An element whose detail is no object, which TBL-153 allows: its detail is {} and it has no position.
    s.elements(erd.drawing, [{ key: 'TBL-146', trace_id: 'TBL-146', kind: 'table', name: 'agent_credentials', detail: [1, 2] }]);
    // A change set whose detail holds its members as other JSON types than the request's: read as absent.
    const odd = s.changeSet(space, erd, { at: at(1), detail: { items: '["TBL-146"]', adds: 7, reason: { text: 'why' }, change: ['how'], source_text: 3 } });
    // A new name and a removed_name past 200 characters, cut to 200 code points (Change.name, ThreadBrief.removed_name).
    const long = '😀'.repeat(250);
    s.change(odd, { op: 'rename', element: 'TBL-146', name: long });
    // A change set of 501 steps lists its first 500.
    const big = s.changeSet(space, erd, { at: at(2) });
    for (let n = 0; n < 501; n += 1) s.change(big, { op: 'remove', element: `TBL-${1000 + n}` });
    const moved = s.thread(erd, { elementKey: 'TBL-160' });
    db.prepare("UPDATE comment_threads SET target_kind = 'diagram', removed_name = ? WHERE id = ?").run(long, moved);

    const answer = await read(space.name, erd.id);
    assert.equal(answer.status, 200);
    assert.deepEqual([answer.json.elements[0].detail, answer.json.elements[0].position], [{}, null]);
    const [bigAnswer, oddAnswer] = answer.json.overlays;
    assert.deepEqual([bigAnswer.id, bigAnswer.changes.length, bigAnswer.changes.at(-1).element], [idOf('np', big), 500, 'TBL-1499']);
    assert.deepEqual(
      [oddAnswer.items, oddAnswer.adds, oddAnswer.reason, oddAnswer.change, oddAnswer.source_text],
      [[], [], null, null, false],
    );
    assert.equal(oddAnswer.changes[0].name, '😀'.repeat(200));
    assert.equal(answer.json.threads.find((thread) => thread.id === idOf('nc', moved)).removed_name, '😀'.repeat(200));

    // A diagram of a stage the contract does not name, which the project read does not list, is not answered.
    const stray = s.diagram(space, { stage: '99-other', sourceKey: '/pictures/99-other' });
    const strayAnswer = await read(space.name, stray.id);
    assert.deepEqual([strayAnswer.status, strayAnswer.json.code], [404, 'diagram_not_found']);
  });

  test('a file picture names the part its last drawing\'s snapshot gives it, as the project read does', async () => {
    const key = 'docs/08-screens/SCR-142.md';
    const space = s.project(undefined, { parts: ['nexus'], pictures: [{ part: 'nexus', stage: '08-screen-states', key }] });
    const screen = s.diagram(space, { stage: '08-screen-states', sourceKey: key, kind: 'screen_states', name: 'SCR-142 Owner to-do' });
    s.elements(screen.drawing, [{ key: 'SCR-142#normal', kind: 'state', name: 'SCR-142#normal', detail: { description: 'The list', responses: [], where: `${key}:31`, box: box(0) } }]);
    const answer = await read(space.name, screen.id);
    assert.deepEqual([answer.json.part, answer.json.kind, answer.json.name, answer.json.elements[0].position], ['nexus', 'screen_states', 'SCR-142 Owner to-do', { x: 0, y: 0 }]);
  });

  test('gives a phone the same answer as a PC (SPEC-051)', async () => {
    const space = s.project();
    const erd = s.diagram(space);
    s.elements(erd.drawing, [table('TBL-146', 'agent_credentials', { box: box(0) })]);
    s.thread(erd);
    const phone = await read(space.name, erd.id, { ...owner(), 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148' });
    const pc = await read(space.name, erd.id, { ...owner(), 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' });
    assert.equal(phone.status, 200);
    assert.deepEqual(phone.json, pc.json);
  });

  test('reads a diagram of 300 elements in under a second (the done condition)', async () => {
    const space = s.project();
    const erd = s.diagram(space);
    const tables = (version) => Array.from({ length: 300 }, (_, n) => table(`TBL-${1000 + n}`, `table_${n}_${version}`, {
      columns: Array.from({ length: 6 }, (__, c) => ({ name: `column_${c}`, type: 'TEXT', null: c > 0, keys: c === 0 ? ['primary'] : [] })),
      primary_key: ['column_0'],
      unique: [],
      where: `db/nexus.sql:${10 + n * 9}`,
      box: { x: (n % 20) * 260, y: Math.floor(n / 20) * 200, width: 240, height: 180 },
    }));
    // Confirmed at a first drawing; the drawing shown renames every table, so all 300 are compared and changed. The
    // rows are written in one transaction, which only makes the setup quicker.
    let current;
    db.exec('BEGIN');
    try {
      s.elements(erd.drawing, tables('a'));
      const confirmation = s.confirm(space, erd);
      s.snapshot(space);
      current = s.drawing(space, erd.id);
      s.elements(current, tables('b'));
      s.invalidate(confirmation, current);
      const shown = { id: erd.id, drawing: current };
      for (let n = 0; n < 300; n += 1) s.position(erd.id, `TBL-${1000 + n}`, { x: n * 10, y: n * 5 });
      for (let n = 0; n < 100; n += 1) s.comment(s.thread(shown, { elementKey: `TBL-${1000 + n}` }));
      for (let n = 0; n < 50; n += 1) s.change(s.changeSet(space, shown, { at: at(n) }), { element: `TBL-${1000 + n}`, name: `renamed_${n}` });
      db.exec('COMMIT');
    } catch (error) {
      // So that the other tests do not run inside a transaction left open.
      db.exec('ROLLBACK');
      throw error;
    }

    // A first read warms up the server and the store; then five reads are timed, and the middle one counts, so that
    // one read slowed by another program on a busy machine does not fail the test.
    const first = await read(space.name, erd.id);
    assert.equal(first.status, 200);
    assert.deepEqual([first.json.elements.length, first.json.since_confirmation.changed.length, first.json.threads.length, first.json.overlays.length],
      [300, 300, 100, 50]);
    const times = [];
    for (let n = 0; n < 5; n += 1) {
      const headers = owner();
      const start = performance.now();
      const answer = await server.send({ path: path(space.name, erd.id), headers });
      times.push(performance.now() - start);
      assert.equal(responses.note('getDiagram', answer).status, 200);
    }
    times.sort((a, b) => a - b);
    assert.ok(times[2] < 1000, `the middle of five reads took ${Math.round(times[2])} ms`);
  });

  test('a read writes nothing', async () => {
    const space = s.project();
    const erd = s.diagram(space);
    s.elements(erd.drawing, [table('TBL-146', 'agent_credentials', { box: box(0) })]);
    s.thread(erd);
    s.confirm(space, erd);
    s.changeSet(space, erd);
    const rows = () => JSON.stringify(['diagrams', 'drawings', 'elements', 'element_positions', 'comment_threads', 'comments', 'change_sets', 'confirmations', 'todos']
      .map((name) => db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all()));
    const before = rows();
    assert.equal((await read(space.name, erd.id)).status, 200);
    assert.equal(rows(), before);
  });

  test('refuses a request without the owner\'s sign-in, of another person, or with an agent credential', async () => {
    const space = s.project();
    const erd = s.diagram(space);
    s.elements(erd.drawing, [table('TBL-146', `Private table ${Date.now()}`)]);
    const none = await read(space.name, erd.id, {});
    assert.deepEqual([none.status, none.json.code], [401, 'unauthenticated']);
    const someone = await read(space.name, erd.id, { 'Cf-Access-Jwt-Assertion': local.token({ email: 'someone@example.org' }) });
    assert.deepEqual([someone.status, someone.json.code], [403, 'not_owner']);
    const agent = await read(space.name, erd.id, s.agent.headers);
    assert.deepEqual([agent.status, agent.json.code], [403, 'owner_only']);
    for (const answer of [none, someone, agent]) assert.equal(answer.text.includes('Private table'), false);
  });

  test('a project no space has gets project_not_found, and a diagram the project does not have diagram_not_found, neither repeating it', async () => {
    const space = s.project();
    const other = s.project();
    const erd = s.diagram(space);
    const theirs = s.diagram(other);
    for (const name of ['no-such-project', 'Upper', 'a--b', 'x'.repeat(65)]) {
      const answer = await read(name, erd.id);
      assert.deepEqual([answer.status, answer.json.code], [404, 'project_not_found'], name);
      assert.equal(answer.json.detail.includes(name), false);
    }
    // Another project's diagram, a key no diagram has, key 0, one past JavaScript's safe integers, and other forms.
    for (const id of [idOf('dg', theirs.id), idOf('dg', 999_999), 'dg_000000000000', 'dg_zzzzzzzzzzzz', 'dg_2b4c6d8e0f1g', 'nope', idOf('nc', erd.id)]) {
      const answer = await read(space.name, id);
      assert.deepEqual([answer.status, answer.json.code], [404, 'diagram_not_found'], id);
      assert.equal(answer.json.detail.includes(id), false);
    }
  });

  test('answers internal when the store fails', async (t) => {
    const store = testStore(t);
    const failing = seed(store);
    const space = failing.project('broken');
    const erd = failing.diagram(space);
    // A store whose positions cannot be read, as when the disk fails.
    const broken = new Proxy(store, {
      get(target, name) {
        const value = Reflect.get(target, name, target);
        if (name === 'prepare') {
          return (sql) => {
            if (sql.includes('FROM element_positions')) throw new Error('the store failed');
            return target.prepare(sql);
          };
        }
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const other = await startServer({ store: broken, gate: local.gate, routes: ROUTES });
    t.after(() => other.close());
    const answer = responses.note('getDiagram', await other.send({ path: path(space.name, erd.id), headers: owner() }));
    assert.deepEqual([answer.status, answer.json.code], [500, 'internal']);
    const [line] = await other.logged(1);
    assert.equal(line.error, 'Error');
    assert.equal(other.logText().includes('the store failed'), false);
  });

  test('logs one line per request with its sender, and never the project\'s text or the data folder (rule 5)', async () => {
    const marker = `no log line may hold ${Date.now()}`;
    const space = s.project(undefined, { title: `A title ${marker}` });
    const erd = s.diagram(space);
    s.elements(erd.drawing, [table('TBL-146', `A table ${marker}`, { box: box(0) })]);
    s.thread(erd, { body: `A comment ${marker}` });
    const answer = await read(space.name, erd.id);
    assert.equal(answer.json.elements[0].name, `A table ${marker}`);
    const lines = (await server.logged(10)).filter((line) => line.action === 'getDiagram');
    assert.ok(lines.length >= 10);
    for (const line of lines) {
      assert.match(line.traceId, TRACE_ID);
      assert.ok(['owner', 'unknown', s.agent.name].includes(line.sender), line.sender);
    }
    const text = server.logText();
    for (const value of [marker, 'no log line may hold', folder, folder.replaceAll('\\', '/'), JSON.stringify(folder).slice(1, -1)]) {
      assert.equal(text.includes(value), false);
    }
  });

  test('answers every response API-265 lists', () => {
    responses.assertEvery('getDiagram');
  });

  test('touches the tables its x-corthex.tables lists, and admission only the layer\'s (note 23)', () => {
    checkTables(recorder, 'getDiagram');
    checkLayer(recorder);
  });
});

describe('the diagram read of what the push drew, with the server\'s own drawers', () => {
  const responses = responseRecord();
  const clock = { now: Date.parse('2026-11-24T04:00:00.000Z') };
  let folder;
  let db;
  let local;
  let server;
  let headers;

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-diagram-push-'));
    ({ db } = openStore(folder));
    const secret = randomBytes(32).toString('base64url');
    const { lastInsertRowid } = db.prepare('INSERT INTO agent_credentials (name, secret_digest, issued_at) VALUES (?, ?, ?)')
      .run('push-job', createHash('sha256').update(secret).digest('hex'), new Date(clock.now).toISOString());
    headers = { 'CF-Access-Client-Id': idOf('ac', Number(lastInsertRowid)), 'CF-Access-Client-Secret': secret };
    local = localGate();
    server = await startServer({ store: db, gate: local.gate, routes: ROUTES, now: () => clock.now });
  });

  after(async () => {
    await server.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  test('every diagram of this repository opens with the elements its drawing holds, and stage 02\'s links are named from the items (SPEC-003 to SPEC-010)', async () => {
    const name = 'diagram-read-repository';
    const snapshot = repositorySnapshot(FORMAT_03, { name });
    // The pinned hub's items of stage 02, whose requirements link to the contexts of stage 01.
    const { items } = JSON.parse(readFileSync(new URL('./item-table-items.json', import.meta.url), 'utf8'));
    snapshot.items = [...snapshot.items.filter((entry) => entry.stage !== '02-prd'), ...items];
    clock.now += 1000;
    const pushed = await server.send({
      method: 'POST', path: '/api/snapshots', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(snapshot),
    });
    assert.ok(pushed.status === 200 || pushed.status === 201, `${pushed.status}`);

    const diagrams = db.prepare(
      `SELECT d.id, d.kind, d.stage, (SELECT max(id) FROM drawings w WHERE w.diagram_id = d.id AND w.status = 'drawn') AS shown
       FROM diagrams d JOIN project_spaces p ON p.id = d.project_id WHERE p.name = ? AND d.removed_at IS NULL ORDER BY d.id`,
    ).all(name);
    // The pictures of stages 01, 05 and 07, each screen file, and the item tables of the other stages read.
    assert.ok(diagrams.length >= 10, `${diagrams.length} diagrams`);
    assert.ok(['ddd_board', 'erd', 'sitemap', 'screen_states', 'item_table'].every((kind) => diagrams.some((each) => each.kind === kind)));
    // The names itemNames gives: each item's title that is not blank, the first of an ID winning.
    const titles = new Map(snapshot.items.filter((item) => typeof item.title === 'string' && item.title.trim() !== '').reverse()
      .map((item) => [item.id, item.title]));
    let links = 0;
    let named = 0;
    for (const diagram of diagrams) {
      const answer = responses.note('getDiagram', await server.send({
        path: `/api/projects/${name}/diagrams/${idOf('dg', Number(diagram.id))}`, headers: { 'Cf-Access-Jwt-Assertion': local.token() },
      }));
      assert.equal(answer.status, 200);
      const stored = diagram.shown === null ? [] : db.prepare(
        'SELECT element_key, trace_id, kind, name, parent_key, status, detail FROM elements WHERE drawing_id = ? ORDER BY id',
      ).all(diagram.shown);
      assert.deepEqual(answer.json.elements.map((element) => [element.key, element.trace_id, element.kind, element.name, element.parent, element.status]),
        stored.map((row) => [row.element_key, row.trace_id, row.kind, row.name, row.parent_key, row.status]), `${diagram.kind} ${diagram.stage}`);
      stored.forEach((row, index) => {
        const detail = JSON.parse(row.detail);
        const element = answer.json.elements[index];
        assert.deepEqual(element.position, detail.box === undefined ? null : { x: detail.box.x, y: detail.box.y });
        if (diagram.kind !== 'item_table') {
          assert.deepEqual(element.detail, detail);
          return;
        }
        assert.deepEqual(element.detail.links, detail.links.map((id) => ({ id, name: titles.get(id) ?? '' })));
        links += detail.links.length;
        named += element.detail.links.filter((link) => link.name !== '').length;
      });
    }
    // Stage 02's requirements link to the contexts of stage 01, each named by its title there.
    const sent = items.reduce((sum, item) => sum + (item.links ?? []).length, 0);
    assert.ok(sent > 0 && links >= sent, `${links} links of ${sent}`);
    assert.ok(named > 0, 'no link was named');
  });
});
