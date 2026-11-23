// Direct edits (TASK-445; API-272, API-273, SPEC-021, SPEC-022, SPEC-023, SPEC-027, rule 5): every response the two
// operations list, their answers against the contract's DirectEditAnswer and ChangeSetAnswer, what the diagram read
// and the agent to-do show after them, the tables they touch (note 23) and their log lines.
// The done condition: after an unreflected rename of X to Y is cancelled, the diagram shows X again (SPEC-023).
//
// Diagrams, drawings, proposals and pull requests are written straight into the store with test/seed.js, as the
// operations of other tasks write them (TASK-418, TASK-438, TASK-444, TASK-447).

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { writeSteps } from '../src/changes.js';
import { changeSetsChanged } from '../src/entries.js';
import { idOf } from '../src/ids.js';
import { ROUTES } from '../src/routes.js';
import { openStore } from '../src/store.js';
import { responseRecord } from './responses.js';
import { closedEntries, openEntries, REPOSITORY, seed } from './seed.js';
import { exchange, head, localGate, newId, startServer, testStore, TRACE_ID } from './support.js';
import { checkLayer, checkTables, recordTables } from './tables.js';

const JSON_TYPE = { 'Content-Type': 'application/json' };
const MiB = 1024 * 1024;
// The server's clock: every change set it makes is made at NOW, a day after the seeded rows.
const NOW = '2026-11-24T02:00:00.000Z';
// When the owner accepts a proposal after the server's direct edits, as API-270 will.
const LATER = '2026-11-24T03:00:00.000Z';
// A table of the ERD as its drawer draws one, and a line from one table to the table it references.
const table = (id, name) => ({ key: id, trace_id: id, kind: 'table', name, detail: { columns: [] } });
const line = (from, to) => ({ key: `line:${from}>${to}`, kind: 'line', name: 'id', parent: from, detail: { from, to, points: [] } });

describe('direct edits', () => {
  const responses = responseRecord();
  let folder;
  let db;
  let recorder;
  let local;
  let server;
  let s;

  const owner = () => ({ 'Cf-Access-Jwt-Assertion': local.token() });
  const key = () => ({ 'Idempotency-Key': `"${newId('nw')}"` });
  const dg = (id) => (typeof id === 'number' ? idOf('dg', id) : id);
  const dw = (id) => (typeof id === 'number' ? idOf('dw', id) : id);
  const np = (id) => (typeof id === 'number' ? idOf('np', id) : id);
  const editPath = (name, diagram) => `/api/projects/${name}/diagrams/${dg(diagram)}/direct-edits`;
  const cancelPath = (name, changeSet) => `/api/projects/${name}/change-sets/${np(changeSet)}/cancel`;
  const post = async (action, path, { body, headers = {}, to = server } = {}) => responses.note(action, await to.send({
    method: 'POST', path, headers: { ...JSON_TYPE, ...owner(), ...key(), ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
  const edit = (name, diagram, body, options = {}) => post('makeDirectEdit', editPath(name, diagram), { ...options, body });
  const cancel = (name, changeSet, options = {}) => post('cancelDirectEdit', cancelPath(name, changeSet), { body: '{}', ...options });
  const read = async (name, diagram) => (await server.send({ path: `/api/projects/${name}/diagrams/${dg(diagram)}`, headers: owner() })).json;
  const agentRead = async (name, changeSet) => (await server.send({
    path: `/api/spaces/${name}/proposals/${np(changeSet)}`, headers: s.agent.headers,
  })).json;
  const keyOf = (id) => Number(db.prepare('SELECT id FROM change_sets ORDER BY id DESC').all().find((row) => idOf('np', Number(row.id)) === id).id);
  const rows = (table) => db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all();
  const dump = () => JSON.stringify(['change_sets', 'changes', 'todos'].map(rows));
  // The owner accepts a proposal at a time, as API-270 will (TASK-438).
  const accept = (changeSet, at) => db.prepare("UPDATE change_sets SET state = 'accepted', decided_at = ? WHERE id = ?").run(at, changeSet);

  // A project with an ERD of three tables and a line from TBL-147 to TBL-146: { space, erd }.
  function erdProject(name = `erd-${randomBytes(3).toString('hex')}`) {
    const space = s.project(name);
    const erd = s.diagram(space);
    s.elements(erd.drawing, [
      table('TBL-146', 'agent_credentials'),
      table('TBL-147', 'project_spaces'),
      table('TBL-148', 'snapshots'),
      line('TBL-147', 'TBL-146'),
    ]);
    return { space, erd };
  }
  const rename = (drawing, element, name) => ({ drawing: dw(drawing), op: 'rename', element, name });
  const connect = (drawing, element, target) => ({ drawing: dw(drawing), op: 'connect', element, target });

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-direct-edits-'));
    ({ db } = openStore(folder));
    recorder = recordTables(db);
    local = localGate();
    server = await startServer({ store: recorder.store, gate: local.gate, routes: ROUTES, now: () => Date.parse(NOW) });
    s = seed(db);
  });

  after(async () => {
    await server.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  test('after an unreflected rename of X to Y is cancelled, the diagram shows X again (SPEC-021, SPEC-022, SPEC-023)', async () => {
    const { space, erd } = erdProject();
    const version = space.commit;
    const made = await edit(space.name, erd.id, rename(erd.drawing, 'TBL-146', 'agent_keys'));
    assert.equal(made.status, 201);
    const id = made.json.change_set.id;
    const set = keyOf(id);
    const [reflection] = openEntries(db, space.id).filter((entry) => entry.kind === 'reflect');
    const entry = db.prepare("SELECT id FROM todos WHERE kind = 'reflect' AND change_set_id = ?").get(set).id;
    assert.deepEqual(reflection, { side: 'agent', kind: 'reflect', diagram_id: erd.id, change_set_id: set });
    // An accepted change set against the drawing shown, its one step a rename, its reflection on the agent to-do.
    const accepted = {
      id,
      part: '',
      stage: '05-erd',
      diagram: idOf('dg', erd.id),
      drawing: idOf('dw', erd.drawing),
      version,
      origin: 'direct_edit',
      thread: null,
      state: 'accepted',
      items: [],
      adds: [],
      reason: null,
      change: null,
      source_text: false,
      changes: [{ op: 'rename', element: 'TBL-146', name: 'agent_keys', target: null }],
      made_at: NOW,
      decided_at: NOW,
      reflection: idOf('ne', Number(entry)),
      pull_request: null,
    };
    assert.deepEqual(made.json, { change_set: accepted, created: true });
    assert.deepEqual(rows('changes').filter((row) => Number(row.change_set_id) === set).map((row) => [row.seq, row.op, row.element_key, row.new_name, row.target_key]),
      [[1, 'rename', 'TBL-146', 'agent_keys', null]]);
    assert.equal(db.prepare('SELECT detail FROM change_sets WHERE id = ?').get(set).detail, '{}');
    // The agent reads it as the owner got it.
    assert.deepEqual(await agentRead(space.name, id), accepted);
    // The diagram shows X as drawn with Y laid over it, waiting for reflection (SPEC-022).
    let diagram = await read(space.name, erd.id);
    assert.equal(diagram.elements.find((element) => element.key === 'TBL-146').name, 'agent_credentials');
    assert.deepEqual(diagram.overlays, [accepted]);

    const cancelled = await cancel(space.name, id);
    assert.equal(cancelled.status, 200);
    const dropped = { ...accepted, state: 'cancelled', reflection: null };
    assert.deepEqual(cancelled.json, { change_set: dropped, changed: true, pull_request: null });
    // The diagram shows X again: the element as drawn and no overlay (SPEC-023).
    diagram = await read(space.name, erd.id);
    assert.equal(diagram.elements.find((element) => element.key === 'TBL-146').name, 'agent_credentials');
    assert.deepEqual(diagram.overlays, []);
    assert.deepEqual(openEntries(db, space.id).filter((each) => each.side === 'agent'), []);
    assert.deepEqual(closedEntries(db, space.id), [{ kind: 'reflect', reason: 'withdrawn', change_set_id: set }]);
    assert.deepEqual(await agentRead(space.name, id), dropped);
    // Cancelled again: the same result, changed false, and nothing written.
    const was = dump();
    const again = await cancel(space.name, id);
    assert.deepEqual([again.status, again.json], [200, { change_set: dropped, changed: false, pull_request: null }]);
    assert.equal(dump(), was);
  });

  test('a connection is a line from the element to the target; one that exists makes no change set (SPEC-021)', async () => {
    const { space, erd } = erdProject();
    // A line of the drawing shown from TBL-147 to TBL-146 exists.
    const was = dump();
    const exists = await edit(space.name, erd.id, connect(erd.drawing, 'TBL-147', 'TBL-146'));
    assert.deepEqual([exists.status, exists.json], [200, { change_set: null, created: false }]);
    assert.equal(dump(), was);
    // The other direction is another connection.
    const back = await edit(space.name, erd.id, connect(erd.drawing, 'TBL-146', 'TBL-147'));
    assert.equal(back.status, 201);
    assert.deepEqual(back.json.change_set.changes, [{ op: 'connect', element: 'TBL-146', target: 'TBL-147', name: null }]);
    const made = await edit(space.name, erd.id, connect(erd.drawing, 'TBL-148', 'TBL-146'));
    assert.equal(made.status, 201);
    // A waiting change set that connects them is a connection that exists.
    const waiting = await edit(space.name, erd.id, connect(erd.drawing, 'TBL-148', 'TBL-146'));
    assert.deepEqual([waiting.status, waiting.json], [200, { change_set: null, created: false }]);
    // One reflection entry holds both waiting change sets (SPEC-026), and both lie over the diagram, newest on top.
    const reflections = openEntries(db, space.id).filter((entry) => entry.kind === 'reflect');
    assert.equal(reflections.length, 1);
    assert.equal(made.json.change_set.reflection, back.json.change_set.reflection);
    assert.deepEqual((await read(space.name, erd.id)).overlays.map((overlay) => overlay.id), [made.json.change_set.id, back.json.change_set.id]);
    // Once it is cancelled, the same connection makes a change set again.
    assert.equal((await cancel(space.name, made.json.change_set.id)).status, 200);
    assert.equal((await edit(space.name, erd.id, connect(erd.drawing, 'TBL-148', 'TBL-146'))).status, 201);
  });

  test('a user flow\'s arrow and a DDD dependency count in the direction their points run', async () => {
    const space = s.project();
    const flow = s.diagram(space, { stage: '03-user-flow', sourceKey: 'docs/03-user-flow/flow.md', kind: 'user_flow', name: 'Flow' });
    s.elements(flow.drawing, [
      { key: 'step:A', kind: 'step', name: 'Start' },
      { key: 'step:B', kind: 'step', name: 'Next' },
      { key: 'arrow:A>B', kind: 'arrow', name: 'yes', parent: 'step:A', detail: { from: 'step:A', to: 'step:B', points: [] } },
    ]);
    assert.equal((await edit(space.name, flow.id, connect(flow.drawing, 'step:A', 'step:B'))).status, 200);
    const back = await edit(space.name, flow.id, connect(flow.drawing, 'step:B', 'step:A'));
    assert.equal(back.status, 201);
    // A file's picture has the part its snapshot's /snapshot document names beside the file's key, '' here.
    assert.equal(back.json.change_set.part, '');
    assert.equal((await cancel(space.name, back.json.change_set.id)).json.change_set.part, '');
    const board = s.diagram(space, { stage: '01-domain', sourceKey: '/pictures/01-domain', kind: 'ddd_board', name: 'Board' });
    s.elements(board.drawing, [
      { key: 'CTX-036', trace_id: 'CTX-036', kind: 'context', name: 'Intake' },
      { key: 'CTX-037', trace_id: 'CTX-037', kind: 'context', name: 'Diagram' },
      { key: 'dependency:CTX-036>CTX-037', kind: 'dependency', name: 'reads', parent: 'CTX-036', detail: { from: 'CTX-036', to: 'CTX-037', points: [] } },
    ]);
    assert.equal((await edit(space.name, board.id, connect(board.drawing, 'CTX-036', 'CTX-037'))).status, 200);
    assert.equal((await edit(space.name, board.id, connect(board.drawing, 'CTX-037', 'CTX-036'))).status, 201);
  });

  test('on an item table, a row connects to another row it lists among its links', async () => {
    const space = s.project();
    const items = s.diagram(space, { stage: '04-functional-spec', sourceKey: '/items/04-functional-spec', kind: 'item_table', name: 'Spec' });
    s.elements(items.drawing, [
      { key: 'SPEC-021', trace_id: 'SPEC-021', kind: 'row', name: 'Rename or connect directly', detail: { status: 'active', links: ['REQ-026', 'SPEC-022'] } },
      { key: 'SPEC-022', trace_id: 'SPEC-022', kind: 'row', name: 'Show what waits for reflection', detail: { status: 'active', links: [] } },
      { key: 'SPEC-023', trace_id: 'SPEC-023', kind: 'row', name: 'Cancel a direct edit', detail: { status: 'active', links: ['SPEC-021'] } },
    ]);
    // SPEC-021 lists SPEC-022, and SPEC-023 lists SPEC-021.
    assert.equal((await edit(space.name, items.id, connect(items.drawing, 'SPEC-021', 'SPEC-022'))).status, 200);
    assert.equal((await edit(space.name, items.id, connect(items.drawing, 'SPEC-023', 'SPEC-021'))).status, 200);
    // A link the other way, and a row the element does not list, are new.
    assert.equal((await edit(space.name, items.id, connect(items.drawing, 'SPEC-022', 'SPEC-021'))).status, 201);
    assert.equal((await edit(space.name, items.id, connect(items.drawing, 'SPEC-021', 'SPEC-023'))).status, 201);
    // A link to an ID that is no row of the table is no element of the drawing.
    const outside = await edit(space.name, items.id, connect(items.drawing, 'SPEC-021', 'REQ-026'));
    assert.deepEqual([outside.status, outside.json.code, outside.json.element], [404, 'element_not_found', 'REQ-026']);
  });

  test('a rename to the name the element has makes no change set; that name is the waiting rename\'s accepted last', async () => {
    const { space, erd } = erdProject();
    const same = await edit(space.name, erd.id, rename(erd.drawing, 'TBL-146', 'agent_credentials'));
    assert.deepEqual([same.status, same.json], [200, { change_set: null, created: false }]);
    assert.equal((await edit(space.name, erd.id, rename(erd.drawing, 'TBL-146', 'agent_keys'))).status, 201);
    assert.equal((await edit(space.name, erd.id, rename(erd.drawing, 'TBL-146', 'agent_keys'))).status, 200);
    // The name as drawn is another name now, since the waiting rename changes it.
    const back = await edit(space.name, erd.id, rename(erd.drawing, 'TBL-146', 'agent_credentials'));
    assert.equal(back.status, 201);
    assert.equal((await edit(space.name, erd.id, rename(erd.drawing, 'TBL-146', 'agent_credentials'))).status, 200);
    // A name is kept as it is written, and counted in characters: 200 of them, one outside the Basic Multilingual Plane.
    const long = `${'가'.repeat(199)}😀`;
    const kept = await edit(space.name, erd.id, rename(erd.drawing, 'TBL-147', long));
    assert.equal(kept.status, 201);
    assert.equal(kept.json.change_set.changes[0].name, long);
    const spaced = await edit(space.name, erd.id, rename(erd.drawing, 'TBL-148', ' snapshot rows '));
    assert.equal(spaced.json.change_set.changes[0].name, ' snapshot rows ');
  });

  test('a rename of an element an open AI proposal also renames is made as any other; the later accepted wins', async () => {
    const { space, erd } = erdProject();
    const thread = s.thread(erd, { elementKey: 'TBL-146' });
    // The proposal, made a day before the direct edit.
    const proposal = s.changeSet(space, erd, { origin: 'proposal', threadId: thread, detail: { reason: 'Shorter.' } });
    s.change(proposal, { op: 'rename', element: 'TBL-146', name: 'credentials' });
    changeSetsChanged(db, { project: space.id, diagram: erd.id, time: '2026-11-23T01:00:00.000Z' });
    const made = await edit(space.name, erd.id, rename(erd.drawing, 'TBL-146', 'agent_keys'));
    assert.equal(made.status, 201);
    // Both lie over the element, the newer on top, and the proposal still waits on the owner (SPEC-022).
    let overlays = (await read(space.name, erd.id)).overlays;
    assert.deepEqual(overlays.map((overlay) => [overlay.id, overlay.state]), [[made.json.change_set.id, 'accepted'], [idOf('np', proposal), 'proposed']]);
    assert.ok(openEntries(db, space.id).some((entry) => entry.kind === 'proposal' && entry.change_set_id === proposal));
    // The owner accepts the proposal after the direct edit: the later accepted, it is on top now, and the reflection
    // entry that holds both lists it last, so its name is the one the reflection leaves.
    accept(proposal, LATER);
    changeSetsChanged(db, { project: space.id, diagram: erd.id, time: LATER });
    overlays = (await read(space.name, erd.id)).overlays;
    assert.deepEqual(overlays.map((overlay) => [overlay.id, overlay.state]), [[idOf('np', proposal), 'accepted'], [made.json.change_set.id, 'accepted']]);
    const held = await server.send({ path: `/api/spaces/${space.name}/edits/${made.json.change_set.reflection}`, headers: s.agent.headers });
    assert.deepEqual(held.json.change_sets, [made.json.change_set.id, idOf('np', proposal)]);
    // So the name the element has is the proposal's.
    assert.deepEqual((await edit(space.name, erd.id, rename(erd.drawing, 'TBL-146', 'credentials'))).json, { change_set: null, created: false });
  });

  test('across reflection entries the later accepted wins too: a proposal accepted while the edit is in a pull request is reflected after it', async () => {
    const { space, erd } = erdProject();
    const thread = s.thread(erd, { elementKey: 'TBL-146' });
    const proposal = s.changeSet(space, erd, { origin: 'proposal', threadId: thread });
    s.change(proposal, { op: 'rename', element: 'TBL-146', name: 'credentials' });
    changeSetsChanged(db, { project: space.id, diagram: erd.id, time: '2026-11-23T01:00:00.000Z' });
    const made = await edit(space.name, erd.id, rename(erd.drawing, 'TBL-146', 'agent_keys'));
    const set = keyOf(made.json.change_set.id);
    // The agent opens a reflection pull request with the direct edit.
    s.setChangeSet(set, { pullRequestId: s.pullRequest(space, { number: 5 }) });
    changeSetsChanged(db, { project: space.id, diagram: erd.id, time: NOW });
    // The owner then accepts the proposal. It waits in a later entry, which the agent to-do lists after the one in
    // the pull request, so it is reflected after it, and it is on top of the element meanwhile.
    accept(proposal, LATER);
    changeSetsChanged(db, { project: space.id, diagram: erd.id, time: LATER });
    const reflections = openEntries(db, space.id).filter((entry) => entry.kind === 'reflect');
    assert.deepEqual(reflections.map((entry) => entry.change_set_id), [set, proposal]);
    const overlays = (await read(space.name, erd.id)).overlays;
    assert.deepEqual(overlays.map((overlay) => overlay.id), [idOf('np', proposal), made.json.change_set.id]);
    assert.deepEqual((await edit(space.name, erd.id, rename(erd.drawing, 'TBL-146', 'credentials'))).json, { change_set: null, created: false });
  });

  test('an element drawn as unreadable, missing or left out takes no direct edit; one drawn as removed does', async () => {
    const space = s.project();
    const erd = s.diagram(space);
    s.elements(erd.drawing, [
      table('TBL-146', 'agent_credentials'),
      { ...table('TBL-150', 'snapshot_files'), status: 'unreadable' },
      { ...table('TBL-999', 'gone_rows'), status: 'missing' },
      { key: 'statement:view', kind: 'statement', name: 'a view', status: 'left_out' },
    ]);
    const was = dump();
    for (const key of ['TBL-150', 'TBL-999', 'statement:view']) {
      const renamed = await edit(space.name, erd.id, rename(erd.drawing, key, 'x'));
      assert.deepEqual([renamed.status, renamed.json.code, renamed.json.element], [404, 'element_not_found', key]);
      const connected = await edit(space.name, erd.id, connect(erd.drawing, 'TBL-146', key));
      assert.deepEqual([connected.status, connected.json.code, connected.json.element], [404, 'element_not_found', key]);
    }
    assert.equal(dump(), was);
    // A context the domain document marks removed is still in it.
    const board = s.diagram(space, { stage: '01-domain', sourceKey: '/pictures/01-domain', kind: 'ddd_board', name: 'Board' });
    s.elements(board.drawing, [{ key: 'CTX-030', trace_id: 'CTX-030', kind: 'context', name: 'Old intake', status: 'removed' }]);
    assert.equal((await edit(space.name, board.id, rename(board.drawing, 'CTX-030', 'Older intake'))).status, 201);
  });

  test('a connection joins the kinds its picture draws lines between; a picture with no line takes none', async () => {
    const { space, erd } = erdProject();
    const refused = (answer, field) => assert.deepEqual([answer.status, answer.json.code, answer.json.field], [400, 'invalid_request', field]);
    // An ERD joins tables: a line is neither end of a connection.
    refused(await edit(space.name, erd.id, connect(erd.drawing, 'line:TBL-147>TBL-146', 'TBL-148')), 'element');
    refused(await edit(space.name, erd.id, connect(erd.drawing, 'TBL-148', 'line:TBL-147>TBL-146')), 'target');
    // A sitemap joins screens, and its line from a screen to the next one is a connection that exists.
    const sitemap = s.diagram(space, { stage: '07-sitemap', sourceKey: '/pictures/07-sitemap', kind: 'sitemap', name: 'Sitemap' });
    s.elements(sitemap.drawing, [
      { key: 'SCR-141', trace_id: 'SCR-141', kind: 'screen', name: 'Projects' },
      { key: 'SCR-145', trace_id: 'SCR-145', kind: 'screen', name: 'Workbench', parent: 'SCR-141' },
      { key: 'line:SCR-145', kind: 'line', name: 'SCR-145', parent: 'SCR-141', detail: { from: 'SCR-141', to: 'SCR-145', points: [] } },
    ]);
    assert.equal((await edit(space.name, sitemap.id, connect(sitemap.drawing, 'SCR-141', 'SCR-145'))).status, 200);
    assert.equal((await edit(space.name, sitemap.id, connect(sitemap.drawing, 'SCR-145', 'SCR-141'))).status, 201);
    // A user flow joins its boxes of every shape, and no lane.
    const flow = s.diagram(space, { stage: '03-user-flow', sourceKey: 'docs/03-user-flow/joins.md', kind: 'user_flow', name: 'Flow' });
    s.elements(flow.drawing, [
      { key: 'lane:owner', kind: 'lane', name: 'Owner' },
      { key: 'start', kind: 'terminal', name: 'Start', parent: 'lane:owner' },
      { key: 'ask', kind: 'decision', name: 'Signed in?', parent: 'lane:owner' },
    ]);
    assert.equal((await edit(space.name, flow.id, connect(flow.drawing, 'start', 'ask'))).status, 201);
    refused(await edit(space.name, flow.id, connect(flow.drawing, 'lane:owner', 'start')), 'element');
    // A DDD board joins contexts and external systems, and no event.
    const board = s.diagram(space, { stage: '01-domain', sourceKey: '/pictures/01-domain', kind: 'ddd_board', name: 'Board' });
    s.elements(board.drawing, [
      { key: 'CTX-036', trace_id: 'CTX-036', kind: 'context', name: 'Intake' },
      { key: 'external:GitHub', kind: 'external', name: 'GitHub' },
      { key: 'event:pushed', kind: 'event', name: 'Snapshot pushed', parent: 'CTX-036' },
    ]);
    assert.equal((await edit(space.name, board.id, connect(board.drawing, 'CTX-036', 'external:GitHub'))).status, 201);
    refused(await edit(space.name, board.id, connect(board.drawing, 'CTX-036', 'event:pushed')), 'target');
    // Screen states draw no line: a connection is refused on op, and a rename is taken.
    const states = s.diagram(space, { stage: '08-screen-states', sourceKey: 'docs/08-screens/SCR-145.md', kind: 'screen_states', name: 'States' });
    s.elements(states.drawing, [{ key: 'normal', kind: 'state', name: 'Normal' }, { key: 'empty', kind: 'state', name: 'Empty' }]);
    refused(await edit(space.name, states.id, connect(states.drawing, 'normal', 'empty')), 'op');
    assert.equal((await edit(space.name, states.id, rename(states.drawing, 'empty', 'No diagrams'))).status, 201);
  });

  test('refuses a body that is not a DirectEdit, naming the field and never its value', async () => {
    const { space, erd } = erdProject();
    const was = dump();
    const secret = `secret-${randomBytes(6).toString('hex')}`;
    const cases = [
      [{ ...rename(erd.drawing, 'TBL-146', 'x'), extra: secret }, 'invalid_request', 'body'],
      [{ op: 'rename', element: 'TBL-146', name: 'x' }, 'invalid_request', 'drawing'],
      [{ ...rename(erd.drawing, 'TBL-146', 'x'), drawing: secret }, 'invalid_request', 'drawing'],
      [{ ...rename(erd.drawing, 'TBL-146', 'x'), drawing: 5 }, 'invalid_request', 'drawing'],
      [{ drawing: dw(erd.drawing), element: 'TBL-146', name: 'x' }, 'invalid_request', 'op'],
      [{ ...rename(erd.drawing, 'TBL-146', 'x'), op: 'remove' }, 'invalid_request', 'op'],
      [{ drawing: dw(erd.drawing), op: 'rename', name: 'x' }, 'invalid_request', 'element'],
      [rename(erd.drawing, ` ${secret}`, 'x'), 'invalid_request', 'element'],
      [rename(erd.drawing, `${secret}\nTBL-146`, 'x'), 'invalid_request', 'element'],
      [rename(erd.drawing, 'x'.repeat(201), 'x'), 'invalid_request', 'element'],
      [{ drawing: dw(erd.drawing), op: 'rename', element: 'TBL-146' }, 'invalid_request', 'name'],
      [rename(erd.drawing, 'TBL-146', ''), 'invalid_request', 'name'],
      [rename(erd.drawing, 'TBL-146', ' \t\n'), 'invalid_request', 'name'],
      [rename(erd.drawing, 'TBL-146', 7), 'invalid_request', 'name'],
      [{ ...rename(erd.drawing, 'TBL-146', 'x'), target: 'TBL-147' }, 'invalid_request', 'target'],
      [{ drawing: dw(erd.drawing), op: 'connect', element: 'TBL-146' }, 'invalid_request', 'target'],
      [connect(erd.drawing, 'TBL-146', 'TBL-146'), 'invalid_request', 'target'],
      [{ ...connect(erd.drawing, 'TBL-146', 'TBL-147'), name: secret }, 'invalid_request', 'name'],
    ];
    for (const [body, code, field] of cases) {
      const answer = await edit(space.name, erd.id, body);
      assert.deepEqual([answer.status, answer.json.code, answer.json.field], [400, code, field], JSON.stringify(body));
      assert.equal(answer.text.includes(secret), false);
    }
    // A lone surrogate cannot be stored as written.
    const lone = await edit(space.name, erd.id, `{"drawing":"${dw(erd.drawing)}","op":"rename","element":"TBL-146","name":"a\\ud800"}`);
    assert.deepEqual([lone.status, lone.json.code, lone.json.field], [400, 'invalid_request', 'name']);
    // Over 200 characters, with the limit (SPEC-021).
    const long = await edit(space.name, erd.id, rename(erd.drawing, 'TBL-146', `${secret}${'x'.repeat(200)}`));
    assert.deepEqual([long.status, long.json.code, long.json.field, long.json.limit], [400, 'text_too_long', 'name', 200]);
    assert.equal(long.text.includes(secret), false);
    assert.equal(dump(), was);
  });

  test('refuses an edit of a diagram, drawing or element that is not there to edit', async () => {
    const { space, erd } = erdProject();
    const was = dump();
    const missing = await edit('no-such-project', erd.id, rename(erd.drawing, 'TBL-146', 'x'));
    assert.deepEqual([missing.status, missing.json.code], [404, 'project_not_found']);
    const malformed = await edit('No_Such', erd.id, rename(erd.drawing, 'TBL-146', 'x'));
    assert.deepEqual([malformed.status, malformed.json.code], [404, 'project_not_found']);
    for (const diagram of [idOf('dg', 999_999), 'dg_0000', erdProject().erd.id]) {
      const answer = await edit(space.name, diagram, rename(erd.drawing, 'TBL-146', 'x'));
      assert.deepEqual([answer.status, answer.json.code], [404, 'diagram_not_found'], String(diagram));
    }
    // A removed diagram takes no direct edit, even while it opens for its open threads (SPEC-027).
    const removed = erdProject();
    s.thread(removed.erd);
    s.removeDiagram(removed.erd.id);
    const gone = await edit(removed.space.name, removed.erd.id, rename(removed.erd.drawing, 'TBL-146', 'x'));
    assert.deepEqual([gone.status, gone.json.code], [404, 'diagram_not_found']);
    assert.equal((await read(removed.space.name, removed.erd.id)).removed, true);
    // Stage 09's mockup takes no overlay, so no direct edit.
    const mockup = s.diagram(space, { stage: '09-mockup', sourceKey: 'design/mockup/page.html', kind: 'mockup', name: 'Mockup' });
    s.elements(mockup.drawing, [{ key: 'token:--corthex-blue', kind: 'token', name: '--corthex-blue' }, { key: 'token:--corthex-red', kind: 'token', name: '--corthex-red' }]);
    for (const body of [rename(mockup.drawing, 'token:--corthex-blue', 'x'), connect(mockup.drawing, 'token:--corthex-blue', 'token:--corthex-red')]) {
      const answer = await edit(space.name, mockup.id, body);
      assert.deepEqual([answer.status, answer.json.code, answer.json.field], [400, 'invalid_request', 'op']);
    }
    // A drawing of no drawing of the diagram.
    for (const drawing of [idOf('dw', 999_999), removed.erd.drawing]) {
      const answer = await edit(space.name, erd.id, rename(drawing, 'TBL-146', 'x'));
      assert.deepEqual([answer.status, answer.json.code], [404, 'drawing_not_found']);
    }
    // An element, or a target, that the drawing shown does not have.
    const element = await edit(space.name, erd.id, rename(erd.drawing, 'TBL-999', 'x'));
    assert.deepEqual([element.status, element.json.code, element.json.element], [404, 'element_not_found', 'TBL-999']);
    const target = await edit(space.name, erd.id, connect(erd.drawing, 'TBL-146', 'TBL-998'));
    assert.deepEqual([target.status, target.json.code, target.json.element], [404, 'element_not_found', 'TBL-998']);
    assert.equal(dump(), was);
  });

  test('an edit names the drawing the diagram shows; another one is document_changed', async () => {
    const { space, erd } = erdProject();
    // A later drawing that drew, from the next snapshot: the first one is no longer shown.
    s.snapshot(space);
    const second = s.drawing(space, erd.id);
    s.elements(second, [table('TBL-146', 'agent_credentials')]);
    const stale = await edit(space.name, erd.id, rename(erd.drawing, 'TBL-146', 'x'));
    assert.deepEqual([stale.status, stale.json.code, stale.json.drawing, stale.json.version], [409, 'document_changed', idOf('dw', second), space.commit]);
    // A later drawing that failed: the diagram shows its last good one, which takes the edit, and the failed one is
    // refused, naming the drawing shown.
    s.snapshot(space);
    const failed = s.drawing(space, erd.id, { status: 'failed' });
    const refused = await edit(space.name, erd.id, rename(failed, 'TBL-146', 'x'));
    assert.deepEqual([refused.status, refused.json.code, refused.json.drawing], [409, 'document_changed', idOf('dw', second)]);
    const made = await edit(space.name, erd.id, rename(second, 'TBL-146', 'x'));
    assert.deepEqual([made.status, made.json.change_set.drawing], [201, idOf('dw', second)]);
    // A diagram that never drew shows no element: its latest drawing takes no edit, with element_not_found rather than
    // a document_changed naming the same drawing again, and an older one is refused, naming the latest.
    const never = s.diagram(space, { stage: '07-sitemap', sourceKey: '/pictures/07-sitemap', kind: 'sitemap', name: 'Sitemap', status: 'failed' });
    s.elements(never.drawing, [{ key: 'SCR-142', trace_id: 'SCR-142', kind: 'screen', name: 'Workbench' }]);
    const none = await edit(space.name, never.id, rename(never.drawing, 'SCR-142', 'x'));
    assert.deepEqual([none.status, none.json.code, none.json.element], [404, 'element_not_found', 'SCR-142']);
    s.snapshot(space);
    const later = s.drawing(space, never.id, { status: 'failed' });
    const older = await edit(space.name, never.id, rename(never.drawing, 'SCR-142', 'x'));
    assert.deepEqual([older.status, older.json.code, older.json.drawing], [409, 'document_changed', idOf('dw', later)]);
  });

  test('a direct edit in an open reflection pull request is cancelled all the same, and the agent takes it out (SPEC-023)', async () => {
    const { space, erd } = erdProject();
    const made = await edit(space.name, erd.id, rename(erd.drawing, 'TBL-146', 'agent_keys'));
    const set = keyOf(made.json.change_set.id);
    const pull = s.pullRequest(space, { number: 12 });
    s.setChangeSet(set, { pullRequestId: pull });
    changeSetsChanged(db, { project: space.id, diagram: erd.id, time: NOW });
    const link = `${REPOSITORY}/pull/12`;
    const cancelled = await cancel(space.name, made.json.change_set.id);
    const removal = db.prepare("SELECT id FROM todos WHERE kind = 'remove_from_pr' AND change_set_id = ?").get(set).id;
    assert.deepEqual([cancelled.status, cancelled.json.changed, cancelled.json.pull_request], [200, true, link]);
    assert.deepEqual(
      [cancelled.json.change_set.state, cancelled.json.change_set.pull_request, cancelled.json.change_set.reflection],
      ['cancelled', link, idOf('ne', Number(removal))],
    );
    assert.deepEqual(openEntries(db, space.id).filter((entry) => entry.side === 'agent'), [
      { side: 'agent', kind: 'remove_from_pr', diagram_id: erd.id, change_set_id: set },
    ]);
    assert.deepEqual((await read(space.name, erd.id)).overlays, []);
    // Cancelled again: the same, with the same pull request, and no second removal entry.
    const again = await cancel(space.name, made.json.change_set.id);
    assert.deepEqual(again.json, { ...cancelled.json, changed: false });
    assert.equal(db.prepare("SELECT count(*) AS n FROM todos WHERE kind = 'remove_from_pr'").get().n, 1);
    // Once that pull request is closed, it is no longer the open one the agent is asked to take it out of.
    db.prepare("UPDATE pull_requests SET state = 'closed', closed_at = ? WHERE id = ?").run(NOW, pull);
    const closed = await cancel(space.name, made.json.change_set.id);
    assert.deepEqual([closed.status, closed.json.changed, closed.json.pull_request], [200, false, null]);

    // In a pull request that merged before it was reflected, it is cancelled with no removal: the drawing will show it.
    const merged = await edit(space.name, erd.id, rename(erd.drawing, 'TBL-147', 'spaces'));
    const mergedSet = keyOf(merged.json.change_set.id);
    const thirteen = s.pullRequest(space, { number: 13, state: 'merged' });
    s.setChangeSet(mergedSet, { pullRequestId: thirteen });
    changeSetsChanged(db, { project: space.id, diagram: erd.id, time: NOW });
    const late = await cancel(space.name, merged.json.change_set.id);
    assert.deepEqual([late.status, late.json.changed, late.json.pull_request, late.json.change_set.pull_request, late.json.change_set.reflection],
      [200, true, null, `${REPOSITORY}/pull/13`, null]);
    assert.equal(db.prepare("SELECT count(*) AS n FROM todos WHERE kind = 'remove_from_pr' AND change_set_id = ?").get(mergedSet).n, 0);
    assert.deepEqual((await cancel(space.name, merged.json.change_set.id)).json, { ...late.json, changed: false });
  });

  test('a removed diagram\'s waiting direct edit is cancelled like any other (note 8)', async () => {
    const { space, erd } = erdProject();
    const made = await edit(space.name, erd.id, rename(erd.drawing, 'TBL-146', 'agent_keys'));
    s.thread(erd);
    s.removeDiagram(erd.id);
    // It opens for its threads, and lists the edit that waits.
    assert.deepEqual((await read(space.name, erd.id)).overlays.map((overlay) => overlay.id), [made.json.change_set.id]);
    const cancelled = await cancel(space.name, made.json.change_set.id);
    assert.deepEqual([cancelled.status, cancelled.json.changed, cancelled.json.change_set.state], [200, true, 'cancelled']);
    assert.deepEqual((await read(space.name, erd.id)).overlays, []);
    assert.deepEqual(openEntries(db, space.id).filter((entry) => entry.kind === 'reflect'), []);
  });

  test('refuses to cancel a change set that is not there, reflected, or an AI proposal', async () => {
    const { space, erd } = erdProject();
    const other = erdProject();
    const theirs = await edit(other.space.name, other.erd.id, rename(other.erd.drawing, 'TBL-146', 'x'));
    const made = await edit(space.name, erd.id, rename(erd.drawing, 'TBL-146', 'agent_keys'));
    const set = keyOf(made.json.change_set.id);
    const was = dump();
    const missing = await cancel('no-such-project', made.json.change_set.id);
    assert.deepEqual([missing.status, missing.json.code], [404, 'project_not_found']);
    for (const id of [idOf('np', 999_999), 'np_x', theirs.json.change_set.id]) {
      const answer = await cancel(space.name, id);
      assert.deepEqual([answer.status, answer.json.code], [404, 'change_set_not_found'], id);
    }
    for (const body of ['{"reason":"no"}', '{"change_set":"x"}']) {
      const answer = await cancel(space.name, made.json.change_set.id, { body });
      assert.deepEqual([answer.status, answer.json.code, answer.json.field], [400, 'invalid_request', 'body']);
    }
    assert.equal(dump(), was);
    // Reflected: refused, with its state (SPEC-023).
    s.setChangeSet(set, { reflectedDrawing: erd.drawing });
    const reflected = await cancel(space.name, made.json.change_set.id);
    assert.deepEqual([reflected.status, reflected.json.code, reflected.json.state], [409, 'change_set_state', 'reflected']);
    // A direct edit in any other state is refused with it, as the contract's example of a rejected one is.
    const rejected = s.changeSet(space, erd, { origin: 'direct_edit', state: 'rejected' });
    const refused = await cancel(space.name, idOf('np', rejected));
    assert.deepEqual([refused.status, refused.json.code, refused.json.state, refused.json.detail], [409, 'change_set_state', 'rejected', 'the change set is rejected']);
    // An AI proposal is answered, not cancelled, in whatever state it is.
    const thread = s.thread(erd);
    for (const state of ['proposed', 'accepted', 'rejected', 'cancelled']) {
      const proposal = s.changeSet(space, erd, { origin: 'proposal', threadId: thread, state });
      const answer = await cancel(space.name, idOf('np', proposal));
      assert.deepEqual([answer.status, answer.json.code, answer.json.state], [409, 'change_set_state', state]);
    }
  });

  test('a repeated request key answers the first answer and writes nothing; another action under it is refused', async () => {
    const { space, erd } = erdProject();
    const requestKey = key();
    const first = await edit(space.name, erd.id, rename(erd.drawing, 'TBL-146', 'agent_keys'), { headers: requestKey });
    const was = dump();
    const repeat = await edit(space.name, erd.id, rename(erd.drawing, 'TBL-146', 'agent_keys'), { headers: requestKey });
    assert.deepEqual([repeat.status, repeat.json], [201, first.json]);
    assert.equal(dump(), was);
    const reused = await edit(space.name, erd.id, rename(erd.drawing, 'TBL-146', 'other'), { headers: requestKey });
    assert.deepEqual([reused.status, reused.json.code], [409, 'request_key_reused']);
    const cancelKey = key();
    const cancelled = await cancel(space.name, first.json.change_set.id, { headers: cancelKey });
    assert.equal((await cancel(space.name, first.json.change_set.id, { headers: cancelKey })).json.changed, true);
    const otherAction = await cancel(space.name, first.json.change_set.id, { headers: requestKey });
    assert.deepEqual([otherAction.status, otherAction.json.code], [409, 'request_key_reused']);
    assert.equal(cancelled.json.changed, true);
  });

  test('refuses a body that is not JSON or too large', async () => {
    const { space, erd } = erdProject();
    const made = await edit(space.name, erd.id, rename(erd.drawing, 'TBL-146', 'agent_keys'));
    const was = dump();
    for (const [action, path] of [['makeDirectEdit', editPath(space.name, erd.id)], ['cancelDirectEdit', cancelPath(space.name, made.json.change_set.id)]]) {
      const wrongType = await post(action, path, { body: '{}', headers: { 'Content-Type': 'text/plain' } });
      assert.deepEqual([wrongType.status, wrongType.json.code], [415, 'json_required']);
      const { answers } = await exchange(server.port, [head('POST', path, { ...JSON_TYPE, ...owner(), ...key(), 'Content-Length': 2 * MiB + 1 })]);
      assert.equal(answers.length, 1);
      responses.note(action, answers[0]);
      assert.deepEqual([answers[0].status, answers[0].json.code, answers[0].json.limit], [413, 'body_too_large', 2 * MiB]);
    }
    assert.equal(dump(), was);
  });

  test('refuses a request without the owner\'s sign-in, of another person, with an agent credential or from another site', async () => {
    const { space, erd } = erdProject();
    const made = await edit(space.name, erd.id, rename(erd.drawing, 'TBL-146', 'agent_keys'));
    const was = dump();
    const someone = { 'Cf-Access-Jwt-Assertion': local.token({ email: 'someone@example.org' }) };
    const sends = [
      ['makeDirectEdit', editPath(space.name, erd.id), JSON.stringify(rename(erd.drawing, 'TBL-147', 'x'))],
      ['cancelDirectEdit', cancelPath(space.name, made.json.change_set.id), '{}'],
    ];
    for (const [action, path, body] of sends) {
      for (const [headers, status, code] of [[{}, 401, 'unauthenticated'], [someone, 403, 'not_owner'], [s.agent.headers, 403, 'owner_only']]) {
        const answer = responses.note(action, await server.send({ method: 'POST', path, headers: { ...JSON_TYPE, ...key(), ...headers }, body }));
        assert.deepEqual([answer.status, answer.json.code], [status, code]);
      }
      for (const site of ['cross-site', 'same-site']) {
        const answer = await post(action, path, { body, headers: { 'Sec-Fetch-Site': site } });
        assert.deepEqual([answer.status, answer.json.code], [403, 'cross_site']);
      }
    }
    assert.equal(dump(), was);
  });

  test('answers internal when the store fails, and writes nothing', async (t) => {
    const store = testStore(t);
    const failing = seed(store);
    const space = failing.project('broken');
    const erd = failing.diagram(space);
    failing.elements(erd.drawing, [table('TBL-146', 'agent_credentials')]);
    const set = failing.changeSet(space, erd);
    writeSteps(store, { changeSet: set, steps: [{ op: 'rename', element: 'TBL-146', name: 'agent_keys' }] });
    changeSetsChanged(store, { project: space.id, diagram: erd.id, time: NOW });
    // A store whose steps cannot be written, and whose change sets cannot be cancelled, as when the disk fails.
    const broken = new Proxy(store, {
      get(target, name) {
        const value = Reflect.get(target, name, target);
        if (name === 'prepare') {
          return (sql) => {
            const statement = target.prepare(sql);
            if (!sql.startsWith('INSERT INTO changes') && !sql.includes("SET state = 'cancelled'")) return statement;
            return new Proxy(statement, {
              get(inner, field) {
                if (field === 'run') return () => { throw new Error('the store failed'); };
                const own = Reflect.get(inner, field, inner);
                return typeof own === 'function' ? own.bind(inner) : own;
              },
            });
          };
        }
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const other = await startServer({ store: broken, gate: local.gate, routes: ROUTES });
    t.after(() => other.close());
    const state = () => JSON.stringify(['change_sets', 'changes', 'todos'].map((name) => store.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all()));
    const was = state();
    const made = await post('makeDirectEdit', editPath('broken', erd.id), { to: other, body: rename(erd.drawing, 'TBL-146', 'keys') });
    assert.deepEqual([made.status, made.json.code], [500, 'internal']);
    const cancelled = await post('cancelDirectEdit', cancelPath('broken', set), { to: other, body: '{}' });
    assert.deepEqual([cancelled.status, cancelled.json.code], [500, 'internal']);
    assert.equal(state(), was);
    assert.equal(other.logText().includes('the store failed'), false);
  });

  test('logs one line per request with its sender, and never the project\'s name, an element or a name (rule 5)', async () => {
    const name = `lima-${randomBytes(6).toString('hex')}`;
    const { space, erd } = erdProject(name);
    const secret = `name-${randomBytes(6).toString('hex')}`;
    const made = await edit(space.name, erd.id, rename(erd.drawing, 'TBL-146', secret));
    assert.equal(made.status, 201);
    assert.equal((await edit(space.name, erd.id, rename(erd.drawing, `${secret}-element`, 'x'))).status, 404);
    assert.equal((await cancel(space.name, made.json.change_set.id)).status, 200);
    const lines = (await server.logged(3)).filter((each) => ['makeDirectEdit', 'cancelDirectEdit'].includes(each.action));
    assert.ok(lines.length >= 3);
    for (const each of lines) {
      assert.match(each.traceId, TRACE_ID);
      assert.ok(['owner', 'unknown', s.agent.name].includes(each.sender), each.sender);
    }
    const text = server.logText();
    for (const value of [name, secret, 'agent_credentials', folder, folder.replaceAll('\\', '/'), JSON.stringify(folder).slice(1, -1)]) {
      assert.equal(text.includes(value), false, value);
    }
  });

  test('writeSteps writes the steps of a change set in order after any it has, and holds each to the Change of the contract', (t) => {
    const store = testStore(t);
    const own = seed(store);
    const space = own.project();
    const erd = own.diagram(space);
    const set = own.changeSet(space, erd);
    assert.equal(writeSteps(store, { changeSet: set, steps: [
      { op: 'add', element: 'TBL-171', name: 'restore_rehearsals' },
      { op: 'connect', element: 'TBL-171', target: 'TBL-170' },
    ] }), 2);
    assert.equal(writeSteps(store, { changeSet: set, steps: [{ op: 'remove', element: 'TBL-169' }, { op: 'rename', element: 'TBL-170', name: 'backups' }] }), 2);
    assert.deepEqual(store.prepare('SELECT seq, op, element_key, new_name, target_key FROM changes WHERE change_set_id = ? ORDER BY seq').all(set)
      .map((row) => [row.seq, row.op, row.element_key, row.new_name, row.target_key]), [
      [1, 'add', 'TBL-171', 'restore_rehearsals', null],
      [2, 'connect', 'TBL-171', null, 'TBL-170'],
      [3, 'remove', 'TBL-169', null, null],
      [4, 'rename', 'TBL-170', 'backups', null],
    ]);
    // A step that breaks the contract is a fault, and none of the steps given is written.
    for (const step of [
      { op: 'move', element: 'TBL-170' },
      { op: 'remove', element: ' TBL-170' },
      { op: 'rename', element: 'TBL-170' },
      { op: 'rename', element: 'TBL-170', name: 'x', target: 'TBL-171' },
      { op: 'rename', element: 'TBL-170', name: 'x'.repeat(201) },
      { op: 'connect', element: 'TBL-170', target: 'TBL-170' },
      { op: 'connect', element: 'TBL-170', target: 'TBL-171', name: 'x' },
    ]) {
      assert.throws(() => writeSteps(store, { changeSet: set, steps: [{ op: 'remove', element: 'TBL-146' }, step] }), TypeError, JSON.stringify(step));
    }
    assert.equal(store.prepare('SELECT count(*) AS n FROM changes WHERE change_set_id = ?').get(set).n, 4);
  });

  test('answers every response API-272 and API-273 list', () => {
    responses.assertEvery('makeDirectEdit');
    responses.assertEvery('cancelDirectEdit');
  });

  test('touches the tables their x-corthex.tables list, changes only tables their spec rows feed, and admission only the layer\'s (note 23)', () => {
    checkTables(recorder, 'makeDirectEdit');
    checkTables(recorder, 'cancelDirectEdit');
    checkLayer(recorder);
  });
});
