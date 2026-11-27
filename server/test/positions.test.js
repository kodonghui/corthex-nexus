// Moving an element (TASK-442; API-274, SPEC-012, SPEC-027, rule 5): every response API-274 lists, its answer against
// the contract's MoveAnswer, the tables it touches (note 23) and its log lines; and what the push (API-242) keeps and
// drops of the positions with the server's own drawers.
//
// The done condition: a moved element keeps its place in the next drawing. The first part writes its diagrams straight
// into the store with test/seed.js; the second pushes snapshots of this repository's files, changed in each test, and
// moves their elements through API-274.

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { idOf } from '../src/ids.js';
import { ROUTES } from '../src/routes.js';
import { openStore } from '../src/store.js';
import { responseRecord } from './responses.js';
import { seed } from './seed.js';
import { FORMAT_03, newCommit, repositorySnapshot } from './snapshots.js';
import { exchange, head, localGate, newId, startServer, testStore, TRACE_ID } from './support.js';
import { checkLayer, checkTables, recordTables } from './tables.js';

const JSON_TYPE = { 'Content-Type': 'application/json' };
const MiB = 1024 * 1024;
const START = Date.parse('2026-11-24T05:00:00.000Z');
const at = (ms) => new Date(ms).toISOString();
const box = (x, y = 0) => ({ x, y, width: 200, height: 80 });
// A table of the ERD as a drawer draws one, with its key and trace ID.
const table = (id, name, more = {}) => ({ key: id, trace_id: id, kind: 'table', name, ...more, detail: { columns: [], ...(more.detail ?? {}) } });

describe('moving an element', () => {
  const responses = responseRecord();
  const clock = { now: START };
  let folder;
  let db;
  let recorder;
  let local;
  let server;
  let s;

  const owner = () => ({ 'Cf-Access-Jwt-Assertion': local.token() });
  const key = () => ({ 'Idempotency-Key': `"${newId('nw')}"` });
  const pathOf = (name, diagram) => `/api/projects/${name}/diagrams/${typeof diagram === 'number' ? idOf('dg', diagram) : diagram}/positions`;
  const move = async (name, diagram, body, headers = {}) => {
    clock.now += 1000;
    return responses.note('moveElement', await server.send({
      method: 'POST', path: pathOf(name, diagram), headers: { ...JSON_TYPE, ...owner(), ...key(), ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }));
  };
  const read = async (name, diagram) => server.send({ path: `/api/projects/${name}/diagrams/${idOf('dg', diagram)}`, headers: owner() });
  const positionsOf = (diagram) => db.prepare('SELECT element_key, x, y, moved_at FROM element_positions WHERE diagram_id = ? ORDER BY element_key')
    .all(diagram).map((row) => ({ ...row }));
  // Every row of every table but the positions and the request keys, as JSON text by table.
  const others = () => Object.fromEntries(db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all().map((row) => row.name).filter((name) => !['element_positions', 'request_keys'].includes(name))
    .map((name) => [name, db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all().map((row) => JSON.stringify(row))]));

  // A project with an ERD whose drawing holds two tables in boxes and a line between them: { space, erd }.
  function erdProject(name) {
    const space = s.project(name);
    const erd = s.diagram(space);
    s.elements(erd.drawing, [
      table('TBL-146', 'agent_credentials', { detail: { box: box(40, 60) } }),
      table('TBL-147', 'project_spaces', { detail: { box: box(300, 60) } }),
      { key: 'line:TBL-147>TBL-146', kind: 'line', name: 'created_by_credential', parent: 'TBL-147', detail: { from: 'TBL-147', to: 'TBL-146', points: [{ x: 1, y: 2 }] } },
    ]);
    return { space, erd };
  }

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-positions-'));
    ({ db } = openStore(folder));
    recorder = recordTables(db);
    local = localGate();
    server = await startServer({ store: recorder.store, gate: local.gate, routes: ROUTES, now: () => clock.now });
    s = seed(db);
  });

  after(async () => {
    await server.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  test('keeps where the owner put an element, which the diagram read shows, and the last move wins (SPEC-012)', async () => {
    const { erd } = erdProject('alpha');
    const was = others();
    const moved = await move('alpha', erd.id, { element: 'TBL-147', x: 512.5, y: -20 });
    assert.equal(moved.status, 200);
    assert.deepEqual(moved.json, { diagram: idOf('dg', erd.id), element: 'TBL-147', x: 512.5, y: -20, moved_at: at(clock.now) });
    assert.deepEqual(positionsOf(erd.id), [{ element_key: 'TBL-147', x: 512.5, y: -20, moved_at: at(clock.now) }]);
    let shown = await read('alpha', erd.id);
    assert.deepEqual(shown.json.elements.map((element) => [element.key, element.position]),
      [['TBL-146', { x: 40, y: 60 }], ['TBL-147', { x: 512.5, y: -20 }], ['line:TBL-147>TBL-146', null]]);

    // The same element moved in another tab: the later move wins. The contract's bounds are taken as they are.
    const later = await move('alpha', erd.id, { element: 'TBL-147', x: -1_000_000, y: 1_000_000 });
    assert.equal(later.status, 200);
    const other = await move('alpha', erd.id, { element: 'TBL-146', x: 0, y: 0 });
    assert.equal(other.status, 200);
    assert.deepEqual(positionsOf(erd.id).map((row) => [row.element_key, row.x, row.y]), [['TBL-146', 0, 0], ['TBL-147', -1_000_000, 1_000_000]]);
    shown = await read('alpha', erd.id);
    assert.deepEqual(shown.json.elements.map((element) => element.position), [{ x: 0, y: 0 }, { x: -1_000_000, y: 1_000_000 }, null]);
    // The drawing is as drawn: a move changes no document, drawing, element, confirmation or to-do.
    assert.deepEqual(shown.json.elements.map((element) => element.detail.box ?? null), [box(40, 60), box(300, 60), null]);
    assert.deepEqual(others(), was);
  });

  test('a conditional move refuses a position changed by another tab without overwriting it', async () => {
    const { erd } = erdProject('conditional-move');
    const element = 'TBL-147';
    const first = await move('conditional-move', erd.id, { element, x: 500, y: 80, expected: { x: 300, y: 60 } });
    assert.equal(first.status, 200);
    assert.equal((await move('conditional-move', erd.id, { element, x: 700, y: 90 })).status, 200);
    const stale = await move('conditional-move', erd.id, { element, x: 300, y: 60, expected: { x: 500, y: 80 } });
    assert.deepEqual([stale.status, stale.json.code], [409, 'position_changed']);
    assert.deepEqual(positionsOf(erd.id).map(({ x, y }) => ({ x, y })), [{ x: 700, y: 90 }]);
    const current = await move('conditional-move', erd.id, { element, x: 300, y: 60, expected: { x: 700, y: 90 } });
    assert.equal(current.status, 200);
    for (const expected of [null, { x: 300 }, { x: 300, y: 60, extra: 1 }, { x: '300', y: 60 }]) {
      const invalid = await move('conditional-move', erd.id, { element, x: 400, y: 60, expected });
      assert.deepEqual([invalid.status, invalid.json.code], [400, 'invalid_request']);
    }
    const concurrent = await Promise.all([
      move('conditional-move', erd.id, { element, x: 400, y: 60, expected: { x: 300, y: 60 } }),
      move('conditional-move', erd.id, { element, x: 500, y: 60, expected: { x: 300, y: 60 } }),
    ]);
    assert.deepEqual(concurrent.map((answer) => answer.status).sort(), [200, 409]);
  });

  test('a conditional reset removes the saved position and refuses a stale or unconditional reset', async () => {
    const { erd } = erdProject('reset-move');
    const element = 'TBL-147';
    assert.equal((await move('reset-move', erd.id, { element, x: 500, y: 80 })).status, 200);
    const stale = await move('reset-move', erd.id, { element, x: 300, y: 60, expected: { x: 400, y: 80 }, reset: true });
    assert.deepEqual([stale.status, stale.json.code], [409, 'position_changed']);
    assert.deepEqual(positionsOf(erd.id).map(({ x, y }) => ({ x, y })), [{ x: 500, y: 80 }]);
    for (const fields of [{ reset: true }, { reset: 'yes' }]) {
      const invalid = await move('reset-move', erd.id, { element, x: 300, y: 60, ...fields });
      assert.deepEqual([invalid.status, invalid.json.code], [400, 'invalid_request']);
    }
    const body = { element, x: 1, y: 2, expected: { x: 500, y: 80 }, reset: true };
    const resetKey = { 'Idempotency-Key': `"${newId('nw')}"` };
    const reset = await move('reset-move', erd.id, body, resetKey);
    assert.deepEqual([reset.status, reset.json.x, reset.json.y], [200, 300, 60]);
    assert.deepEqual(positionsOf(erd.id), []);
    assert.equal((await read('reset-move', erd.id)).json.elements.find((row) => row.key === element).position_saved, false);
    assert.equal((await move('reset-move', erd.id, { element, x: 700, y: 90 })).status, 200);
    assert.equal((await read('reset-move', erd.id)).json.elements.find((row) => row.key === element).position_saved, true);
    assert.equal((await move('reset-move', erd.id, body, resetKey)).status, 200);
    assert.deepEqual(positionsOf(erd.id).map(({ x, y }) => ({ x, y })), [{ x: 700, y: 90 }]);
    assert.equal((await move('reset-move', erd.id, { element, x: 300, y: 60 })).status, 200);
    assert.equal((await read('reset-move', erd.id)).json.elements.find((row) => row.key === element).position_saved, true);
  });

  test('moves an element of the last good drawing while the latest failed, and one drawn as unreadable or missing (SPEC-001, SPEC-004, note 1)', async () => {
    const space = s.project('bravo');
    const erd = s.diagram(space);
    s.elements(erd.drawing, [
      table('TBL-146', 'agent_credentials', { detail: { box: box(40) } }),
      // A table the drawer could not read: it keeps its box and has not left the document.
      table('TBL-147', '', { status: 'unreadable', detail: { where: 'db/nexus.sql:20', box: box(300) } }),
      // A table a foreign key names and the schema does not define: SPEC-004 draws it in a box, marked.
      table('archive', 'archive', { status: 'missing', detail: { columns: [], box: box(600) } }),
    ]);
    s.snapshot(space);
    s.drawing(space, erd.id, { status: 'failed' });
    for (const element of ['TBL-146', 'TBL-147', 'archive']) {
      const moved = await move('bravo', erd.id, { element, x: 10, y: 20 });
      assert.equal(moved.status, 200, element);
    }
    assert.deepEqual(positionsOf(erd.id).map((row) => row.element_key), ['TBL-146', 'TBL-147', 'archive']);
  });

  test('an element without a place of its own is invalid_request on element, and nothing is kept', async () => {
    const space = s.project('charlie');
    const board = s.diagram(space, { stage: '01-domain', sourceKey: '/pictures/01-domain', kind: 'ddd_board', name: 'DDD board' });
    s.elements(board.drawing, [
      { key: 'lane:Owner', kind: 'lane', name: 'Owner', detail: { box: box(0) } },
      { key: 'lane:Owner/event:Snapshot accepted', kind: 'event', name: 'Snapshot accepted', parent: 'lane:Owner', detail: { place: 1, box: box(10) } },
      { key: 'CTX-037', trace_id: 'CTX-037', kind: 'context', name: 'Diagram', detail: { box: box(0, 200) } },
      { key: 'CTX-037/command:Move', kind: 'command', name: 'Move', parent: 'CTX-037', detail: { box: box(10, 240) } },
      { key: 'hotspot_lane:Hotspots', kind: 'hotspot_lane', name: 'Hotspots', detail: { box: box(0, 400) } },
      { key: 'dependency:calls', kind: 'dependency', name: 'calls', parent: 'CTX-037', detail: { from: 'CTX-037', to: 'CTX-038', points: [] } },
      { key: 'table:left out', kind: 'table', name: 'left out', status: 'left_out', detail: { where: 'docs/01-domain/nexus.md:3' } },
      // A detail that holds no box: text, or a box that is not an object.
      { key: 'external:Git', kind: 'external', name: 'Git', detail: { box: [0, 0] } },
    ]);
    const mockup = s.diagram(space, { stage: '09-mockup', sourceKey: 'design/mockup/nexus-mockup.html', kind: 'mockup', name: 'nexus-mockup.html' });
    s.elements(mockup.drawing, [{ key: 'token:--layer-01', kind: 'token', name: '--layer-01', detail: { value: '#fff' } }]);
    const items = s.diagram(space, { stage: '02-prd', sourceKey: '/items/02-prd', kind: 'item_table', name: 'Item table' });
    s.elements(items.drawing, [{ key: 'REQ-001', trace_id: 'REQ-001', kind: 'row', name: 'Draw the stages', detail: { links: [] } }]);

    const refused = [
      [board.id, 'lane:Owner'], [board.id, 'CTX-037'], [board.id, 'hotspot_lane:Hotspots'], [board.id, 'dependency:calls'],
      [board.id, 'table:left out'], [board.id, 'external:Git'], [mockup.id, 'token:--layer-01'], [items.id, 'REQ-001'],
    ];
    for (const [diagram, element] of refused) {
      const answer = await move('charlie', diagram, { element, x: 1, y: 2 });
      assert.deepEqual([answer.status, answer.json.code, answer.json.field], [400, 'invalid_request', 'element'], element);
      assert.equal(answer.json.detail.includes(element), false);
    }
    // A board's event and sticky move: they hold nothing.
    for (const element of ['lane:Owner/event:Snapshot accepted', 'CTX-037/command:Move']) {
      assert.equal((await move('charlie', board.id, { element, x: 1, y: 2 })).status, 200, element);
    }
    assert.deepEqual(positionsOf(board.id).map((row) => row.element_key), ['CTX-037/command:Move', 'lane:Owner/event:Snapshot accepted']);
    assert.deepEqual([...positionsOf(mockup.id), ...positionsOf(items.id)], []);
  });

  test('an element the drawing shown does not hold gets element_not_found naming it, as on a diagram that never drew', async () => {
    const { space, erd } = erdProject('delta');
    // A page opened before the latest push: an element only the older drawing holds is gone, one the new one holds
    // still moves.
    s.snapshot(space);
    const newer = s.drawing(space, erd.id);
    s.elements(newer, [table('TBL-147', 'project_spaces', { detail: { box: box(0) } })]);
    const gone = await move('delta', erd.id, { element: 'TBL-146', x: 1, y: 2 });
    assert.deepEqual([gone.status, gone.json.code, gone.json.element], [404, 'element_not_found', 'TBL-146']);
    assert.equal((await move('delta', erd.id, { element: 'TBL-147', x: 1, y: 2 })).status, 200);
    const unknown = await move('delta', erd.id, { element: 'TBL-999', x: 1, y: 2 });
    assert.deepEqual([unknown.status, unknown.json.code, unknown.json.element], [404, 'element_not_found', 'TBL-999']);

    // A diagram whose only drawing failed has no element.
    const never = s.diagram(space, { stage: '03-user-flow', sourceKey: 'docs/03-user-flow/FL-009.md', kind: 'user_flow', name: 'FL-009', status: 'failed' });
    const none = await move('delta', never.id, { element: 'A', x: 1, y: 2 });
    assert.deepEqual([none.status, none.json.code, none.json.element], [404, 'element_not_found', 'A']);
    assert.deepEqual(positionsOf(never.id), []);
  });

  test('a removed diagram takes no move, even while it opens for its threads (SPEC-027); nor does a diagram or project NEXUS does not have', async () => {
    const { space } = erdProject('echo');
    const removed = s.diagram(space, { stage: '03-user-flow', sourceKey: 'docs/03-user-flow/FL-001.md', kind: 'user_flow', name: 'FL-001', removed: true });
    s.elements(removed.drawing, [{ key: 'A', kind: 'step', name: 'Start', detail: { box: box(0) } }]);
    s.thread(removed, { elementKey: 'A' });
    // It opens for its threads (API-265), and refuses the move as a direct edit is refused there.
    assert.equal((await read('echo', removed.id)).status, 200);
    const refused = await move('echo', removed.id, { element: 'A', x: 1, y: 2 });
    assert.deepEqual([refused.status, refused.json.code], [404, 'diagram_not_found']);
    // Its Move is not checked: a body whose fields break Move gets the same answer.
    const broken = await move('echo', removed.id, { element: 'A', x: 'far' });
    assert.deepEqual([broken.status, broken.json.code], [404, 'diagram_not_found']);
    assert.deepEqual(positionsOf(removed.id), []);

    const { erd: elsewhere } = erdProject('echo-other');
    const otherProject = await move('echo', elsewhere.id, { element: 'TBL-146', x: 1, y: 2 });
    assert.deepEqual([otherProject.status, otherProject.json.code], [404, 'diagram_not_found']);
    // A diagram of a stage the contract does not name, which no read lists.
    const strange = s.diagram(space, { stage: '14-later', sourceKey: '/items/14-later', kind: 'item_table', name: 'Item table' });
    const unnamed = await move('echo', strange.id, { element: 'TBL-146', x: 1, y: 2 });
    assert.deepEqual([unnamed.status, unnamed.json.code], [404, 'diagram_not_found']);
    for (const diagram of ['dg_000000000000', 'dg_zzzzzzzzzzzz', 'not-an-id']) {
      const answer = await move('echo', diagram, { element: 'TBL-146', x: 1, y: 2 });
      assert.deepEqual([answer.status, answer.json.code], [404, 'diagram_not_found'], diagram);
      assert.equal(answer.json.detail.includes(diagram), false);
    }
    const project = `no-project-${randomBytes(3).toString('hex')}`;
    const missing = await move(project, elsewhere.id, { element: 'TBL-146', x: 1, y: 2 });
    assert.deepEqual([missing.status, missing.json.code], [404, 'project_not_found']);
    assert.equal(missing.json.detail.includes(project), false);
  });

  test('refuses a body that breaks Move, naming the field and never its value', async () => {
    const { erd } = erdProject('foxtrot');
    const long = 'k'.repeat(201);
    const cases = [
      [{ element: 'TBL-146', x: 1, y: 2, z: 3 }, 'body'],
      [{ x: 1, y: 2 }, 'element'],
      [{ element: 42, x: 1, y: 2 }, 'element'],
      [{ element: '', x: 1, y: 2 }, 'element'],
      [{ element: ' TBL-146', x: 1, y: 2 }, 'element'],
      [{ element: 'TBL-146\n', x: 1, y: 2 }, 'element'],
      [{ element: long, x: 1, y: 2 }, 'element'],
      [{ element: 'TBL-146', y: 2 }, 'x'],
      [{ element: 'TBL-146', x: '1', y: 2 }, 'x'],
      [{ element: 'TBL-146', x: 1_000_000.5, y: 2 }, 'x'],
      [{ element: 'TBL-146', x: 1, y: null }, 'y'],
      [{ element: 'TBL-146', x: 1, y: -1_000_001 }, 'y'],
      [{ element: 'TBL-146', x: 1 }, 'y'],
    ];
    for (const [body, field] of cases) {
      const answer = await move('foxtrot', erd.id, body);
      assert.deepEqual([answer.status, answer.json.code, answer.json.field], [400, 'invalid_request', field], JSON.stringify(body));
      assert.equal(answer.json.detail.includes(long), false);
    }
    // A JSON value that is not an object is the request layer's.
    const notObject = await move('foxtrot', erd.id, '[1, 2]');
    assert.deepEqual([notObject.status, notObject.json.code, notObject.json.field], [400, 'invalid_request', 'body']);
    // A key of 200 characters with white space inside is an element key; this one is in no drawing.
    const wide = await move('foxtrot', erd.id, { element: `a ${'b'.repeat(198)}`, x: 1, y: 2 });
    assert.deepEqual([wide.status, wide.json.code], [404, 'element_not_found']);
    assert.deepEqual(positionsOf(erd.id), []);
  });

  test('the same request key answers the first answer again, and another request under it is request_key_reused', async () => {
    const { erd } = erdProject('golf');
    const headers = key();
    const first = await move('golf', erd.id, { element: 'TBL-146', x: 5, y: 6 }, headers);
    assert.equal(first.status, 200);
    const again = await move('golf', erd.id, { element: 'TBL-146', x: 5, y: 6 }, headers);
    assert.equal(again.status, 200);
    assert.deepEqual(again.json, first.json);
    const reused = await move('golf', erd.id, { element: 'TBL-146', x: 7, y: 8 }, headers);
    assert.deepEqual([reused.status, reused.json.code], [409, 'request_key_reused']);
    assert.deepEqual(positionsOf(erd.id).map((row) => [row.element_key, row.x, row.y, row.moved_at]), [['TBL-146', 5, 6, first.json.moved_at]]);
    // Without a request key, or with one not in its form.
    for (const value of [undefined, 'not-a-key']) {
      const answer = responses.note('moveElement', await server.send({
        method: 'POST', path: pathOf('golf', erd.id),
        headers: { ...JSON_TYPE, ...owner(), ...(value === undefined ? {} : { 'Idempotency-Key': value }) },
        body: JSON.stringify({ element: 'TBL-146', x: 9, y: 9 }),
      }));
      assert.deepEqual([answer.status, answer.json.code, answer.json.field], [400, 'invalid_request', 'Idempotency-Key']);
    }
  });

  test('refuses a body that is not JSON or too large, and keeps nothing', async () => {
    const { erd } = erdProject('hotel');
    const wrongType = await move('hotel', erd.id, { element: 'TBL-146', x: 1, y: 2 }, { 'Content-Type': 'text/plain' });
    assert.deepEqual([wrongType.status, wrongType.json.code], [415, 'json_required']);
    const { answers } = await exchange(server.port, [head('POST', pathOf('hotel', erd.id), {
      ...JSON_TYPE, ...owner(), ...key(), 'Content-Length': 2 * MiB + 1,
    })]);
    assert.equal(answers.length, 1);
    responses.note('moveElement', answers[0]);
    assert.deepEqual([answers[0].status, answers[0].json.code, answers[0].json.limit], [413, 'body_too_large', 2 * MiB]);
    assert.deepEqual(positionsOf(erd.id), []);
  });

  test('refuses a request without the owner\'s sign-in, of another person, with an agent credential or from another site', async () => {
    const { erd } = erdProject('india');
    const someone = { 'Cf-Access-Jwt-Assertion': local.token({ email: 'someone@example.org' }) };
    for (const [headers, status, code] of [[{}, 401, 'unauthenticated'], [someone, 403, 'not_owner'], [s.agent.headers, 403, 'owner_only']]) {
      const answer = responses.note('moveElement', await server.send({
        method: 'POST', path: pathOf('india', erd.id), headers: { ...JSON_TYPE, ...key(), ...headers },
        body: JSON.stringify({ element: 'TBL-146', x: 1, y: 2 }),
      }));
      assert.deepEqual([answer.status, answer.json.code], [status, code]);
    }
    for (const site of ['cross-site', 'same-site']) {
      const answer = await move('india', erd.id, { element: 'TBL-146', x: 1, y: 2 }, { 'Sec-Fetch-Site': site });
      assert.deepEqual([answer.status, answer.json.code], [403, 'cross_site']);
    }
    // The page's own request.
    assert.equal((await move('india', erd.id, { element: 'TBL-146', x: 1, y: 2 }, { 'Sec-Fetch-Site': 'same-origin' })).status, 200);
    assert.deepEqual(positionsOf(erd.id).map((row) => row.element_key), ['TBL-146']);
  });

  test('answers internal when the store fails, and keeps nothing', async (t) => {
    const store = testStore(t);
    const failing = seed(store);
    const space = failing.project('broken');
    const erd = failing.diagram(space);
    failing.elements(erd.drawing, [table('TBL-146', 'agent_credentials', { detail: { box: box(0) } })]);
    const broken = new Proxy(store, {
      get(target, name) {
        const value = Reflect.get(target, name, target);
        if (name === 'prepare') {
          return (sql) => {
            const statement = target.prepare(sql);
            if (!sql.includes('INSERT INTO element_positions')) return statement;
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
    const answer = responses.note('moveElement', await other.send({
      method: 'POST', path: pathOf('broken', erd.id), headers: { ...JSON_TYPE, ...owner(), ...key() },
      body: JSON.stringify({ element: 'TBL-146', x: 1, y: 2 }),
    }));
    assert.deepEqual([answer.status, answer.json.code], [500, 'internal']);
    assert.equal(store.prepare('SELECT count(*) AS n FROM element_positions').get().n, 0);
    assert.equal(store.prepare('SELECT count(*) AS n FROM request_keys').get().n, 0);
    assert.equal(other.logText().includes('the store failed'), false);
  });

  test('logs one line per move with its sender, and never the element, the project\'s name, a place or the data folder (rule 5)', async () => {
    const name = `kilo-${randomBytes(6).toString('hex')}`;
    const { erd } = erdProject(name);
    const element = `TBL-${String(Date.now() % 1_000_000).padStart(6, '0')}`;
    s.elements(erd.drawing, [table(element, 'element_positions', { detail: { box: box(0) } })]);
    const x = 123456.789;
    assert.equal((await move(name, erd.id, { element, x, y: -98765.4321 })).status, 200);
    const missing = `gone ${randomBytes(6).toString('hex')}`;
    assert.equal((await move(name, erd.id, { element: missing, x, y: 1 })).status, 404);
    const lines = (await server.logged(2)).filter((line) => line.action === 'moveElement');
    assert.ok(lines.length >= 2);
    for (const line of lines) {
      assert.match(line.traceId, TRACE_ID);
      assert.ok(['owner', 'unknown', s.agent.name].includes(line.sender), line.sender);
    }
    const text = server.logText();
    for (const value of [name, element, missing, String(x), '98765.4321', folder, folder.replaceAll('\\', '/'), JSON.stringify(folder).slice(1, -1)]) {
      assert.equal(text.includes(value), false, value);
    }
  });

  test('answers every response API-274 lists', () => {
    responses.assertEvery('moveElement');
  });

  test('touches the tables its x-corthex.tables lists, changes only tables SPEC-012 feeds, and admission only the layer\'s (note 23)', () => {
    checkTables(recorder, 'moveElement');
    checkLayer(recorder);
  });
});

describe('positions across drawings, with the server\'s own drawers', () => {
  const clock = { now: START };
  const FLOW = 'docs/03-user-flow/FL-001-put-a-project-on-nexus.md';
  const FLOW_TEXT = readFileSync(new URL(`../../${FLOW}`, import.meta.url), 'utf8');
  let folder;
  let db;
  let local;
  let server;
  let rows;
  let base;

  // A readable ERD table of the picture's format 1, with foreign keys to the tables named.
  const erdTable = (id, name, references = []) => ({
    id, name, where: `db/nexus.sql:${Number(id.slice(4))}`, removed: false, columns: [{ name: 'id', type: 'INTEGER', null: false }],
    primary_key: ['id'], foreign_keys: references.map((target) => ({ columns: [`${target}_id`], table: target, references: ['id'] })),
  });
  const TABLES = [
    erdTable('TBL-146', 'agent_credentials'),
    erdTable('TBL-147', 'project_spaces', ['agent_credentials']),
    erdTable('TBL-148', 'snapshots', ['project_spaces', 'agent_credentials']),
  ];

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-positions-push-'));
    ({ db } = openStore(folder));
    rows = seed(db);
    local = localGate();
    server = await startServer({ store: db, gate: local.gate, routes: ROUTES, now: () => clock.now });
    base = repositorySnapshot(FORMAT_03, { name: 'base' });
  });

  after(async () => {
    await server.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  // A project's pushes: each sends the next commit, replacing the one before, with the ERD's tables (none when null),
  // the flow file when flow is true, and the left_out entries given.
  function project(name) {
    let held;
    const space = { name };
    space.push = async ({ tables = TABLES, flow = false, left = [], erd } = {}) => {
      const snapshot = structuredClone(base);
      const commit = newCommit();
      snapshot.project.name = name;
      snapshot.repos['.'].commit = commit;
      snapshot.repos['.'].default.commit = commit;
      snapshot.records.commit = commit;
      if (held !== undefined) snapshot.replaces = held;
      const time = '2026-11-24T14:00:00+09:00';
      snapshot.pictures = [];
      if (tables !== null) snapshot.pictures.push({ part: 'nexus', stage: '05-erd', commit, time, source: erd ?? { format: 1, tables } });
      if (flow) snapshot.pictures.push({ part: 'nexus', stage: '03-user-flow', key: FLOW, commit, time, source: { text: FLOW_TEXT } });
      snapshot.items = [];
      snapshot.left_out = left;
      clock.now += 60_000;
      const answer = await server.send({
        method: 'POST', path: '/api/snapshots', headers: { ...JSON_TYPE, ...rows.agent.headers }, body: JSON.stringify(snapshot),
      });
      assert.ok([200, 201].includes(answer.status), JSON.stringify(answer.json));
      held = commit;
      return answer.json;
    };
    space.diagram = (stage) => {
      const row = db.prepare(
        'SELECT d.id, d.removed_at FROM diagrams d JOIN project_spaces p ON p.id = d.project_id WHERE p.name = ? AND d.stage = ? AND d.kind <> ?',
      ).get(name, stage, 'item_table');
      return { id: Number(row.id), removed: row.removed_at !== null };
    };
    space.move = async (stage, element, x, y) => {
      clock.now += 1000;
      return server.send({
        method: 'POST', path: `/api/projects/${name}/diagrams/${idOf('dg', space.diagram(stage).id)}/positions`,
        headers: { ...JSON_TYPE, 'Cf-Access-Jwt-Assertion': local.token(), 'Idempotency-Key': `"${newId('nw')}"` },
        body: JSON.stringify({ element, x, y }),
      });
    };
    // Each element's key and position as the diagram read answers them, and its status.
    space.read = async (stage) => {
      const answer = await server.send({
        path: `/api/projects/${name}/diagrams/${idOf('dg', space.diagram(stage).id)}`, headers: { 'Cf-Access-Jwt-Assertion': local.token() },
      });
      assert.equal(answer.status, 200);
      return answer.json;
    };
    space.positions = (stage) => db.prepare('SELECT element_key, x, y FROM element_positions WHERE diagram_id = ? ORDER BY element_key')
      .all(space.diagram(stage).id).map((row) => [row.element_key, row.x, row.y]);
    return space;
  }

  const placeOf = (answer, key) => answer.elements.find((element) => element.key === key)?.position;
  const boxOf = (answer, key) => {
    const found = answer.elements.find((element) => element.key === key)?.detail.box;
    return found === undefined ? undefined : { x: found.x, y: found.y };
  };
  // A drawing's elements as drawn, by key, without the row's IDs.
  const drawnElements = (diagram) => db.prepare(
    `SELECT element_key, kind, name, parent_key, status, detail FROM elements
     WHERE drawing_id = (SELECT max(id) FROM drawings WHERE diagram_id = ? AND status = 'drawn') ORDER BY id`,
  ).all(diagram).map((row) => ({ ...row }));

  test('a moved element keeps its place in the next drawing, which lays out as if nothing moved (the done condition)', async () => {
    const moved = project('positions-moved');
    const still = project('positions-still');
    await moved.push();
    await still.push();
    const first = db.prepare("SELECT max(id) AS id FROM drawings WHERE diagram_id = ? AND status = 'drawn'").get(moved.diagram('05-erd').id).id;
    for (const [element, x, y] of [['TBL-147', 900, 700], ['TBL-148', -50, 30.25]]) {
      assert.equal((await moved.move('05-erd', element, x, y)).status, 200, element);
    }

    // The next commit adds a table and takes TBL-148 out.
    const next = [...TABLES.slice(0, 2), erdTable('TBL-149', 'document_blobs', ['project_spaces'])];
    await moved.push({ tables: next });
    await still.push({ tables: next });
    const erd = moved.diagram('05-erd');
    assert.notEqual(db.prepare("SELECT max(id) AS id FROM drawings WHERE diagram_id = ? AND status = 'drawn'").get(erd.id).id, first);
    const shown = await moved.read('05-erd');
    assert.deepEqual(placeOf(shown, 'TBL-147'), { x: 900, y: 700 });
    assert.ok(boxOf(shown, 'TBL-146'), 'the drawer gives TBL-146 a box');
    assert.deepEqual(placeOf(shown, 'TBL-146'), boxOf(shown, 'TBL-146'));
    // An element that left the document loses its position.
    assert.equal(placeOf(shown, 'TBL-148'), undefined);
    assert.deepEqual(moved.positions('05-erd'), [['TBL-147', 900, 700]]);
    // No drawing reads a position: the drawing of the project whose elements moved is the other's, box for box.
    assert.deepEqual(drawnElements(erd.id), drawnElements(still.diagram('05-erd').id));

    // TBL-148 comes back and stands where its drawer puts it, not where it was put before it left.
    await moved.push();
    const back = await moved.read('05-erd');
    assert.ok(boxOf(back, 'TBL-148'), 'the drawer gives TBL-148 a box');
    assert.deepEqual(placeOf(back, 'TBL-148'), boxOf(back, 'TBL-148'));
    assert.notDeepEqual(placeOf(back, 'TBL-148'), { x: -50, y: 30.25 });
    assert.deepEqual(placeOf(back, 'TBL-147'), { x: 900, y: 700 });
  });

  test('an element drawn as unreadable keeps its position and still moves; a failed drawing and a source left out keep every position (note 1)', async () => {
    const space = project('positions-kept');
    await space.push();
    assert.equal((await space.move('05-erd', 'TBL-147', 400, 500)).status, 200);
    assert.equal((await space.move('05-erd', 'TBL-148', 600, 700)).status, 200);

    // TBL-147's statement no longer reads: the drawer draws it unreadable, in a box, under the same key.
    const unreadable = TABLES.map((entry) => (entry.id === 'TBL-147' ? { id: 'TBL-147', name: 'project_spaces', where: 'db/nexus.sql:147' } : entry));
    await space.push({ tables: unreadable });
    let shown = await space.read('05-erd');
    assert.equal(shown.elements.find((element) => element.key === 'TBL-147').status, 'unreadable');
    assert.deepEqual(placeOf(shown, 'TBL-147'), { x: 400, y: 500 });
    assert.equal((await space.move('05-erd', 'TBL-147', 410, 510)).status, 200);
    assert.deepEqual(space.positions('05-erd'), [['TBL-147', 410, 510], ['TBL-148', 600, 700]]);

    // A picture that does not draw: the diagram shows its last good drawing, and every position stays.
    const failed = await space.push({ erd: { format: 2 } });
    assert.equal(failed.diagrams.failed, 1);
    assert.deepEqual(space.positions('05-erd'), [['TBL-147', 410, 510], ['TBL-148', 600, 700]]);
    shown = await space.read('05-erd');
    assert.deepEqual(placeOf(shown, 'TBL-148'), { x: 600, y: 700 });
    // A move while the latest drawing failed moves an element of the last good one.
    assert.equal((await space.move('05-erd', 'TBL-146', 1, 2)).status, 200);

    // The ERD's source left out (PR 134): the diagram keeps its last good drawing and its positions.
    const left = await space.push({ tables: null, left: [{ part: 'nexus', stage: '05-erd', why: 'size' }] });
    assert.equal(left.diagrams.failed, 1);
    assert.equal(space.diagram('05-erd').removed, false);
    assert.deepEqual(space.positions('05-erd'), [['TBL-146', 1, 2], ['TBL-147', 410, 510], ['TBL-148', 600, 700]]);

    // The source again, readable: every element still stands where it was put.
    await space.push();
    shown = await space.read('05-erd');
    assert.deepEqual(['TBL-146', 'TBL-147', 'TBL-148'].map((key) => placeOf(shown, key)), [{ x: 1, y: 2 }, { x: 410, y: 510 }, { x: 600, y: 700 }]);
  });

  test('a diagram the snapshot removes drops its positions and takes no move; back again, its elements stand where its drawer puts them (SPEC-027)', async () => {
    const space = project('positions-removed');
    await space.push({ flow: true });
    const drawn = await space.read('03-user-flow');
    const step = drawn.elements.find((element) => element.position !== null);
    assert.ok(step, 'the flow has a box');
    assert.equal((await space.move('03-user-flow', step.key, 3000, 4000)).status, 200);
    assert.deepEqual(space.positions('03-user-flow'), [[step.key, 3000, 4000]]);

    // The next commit no longer has the flow file: its diagram is removed, with its positions.
    await space.push();
    assert.equal(space.diagram('03-user-flow').removed, true);
    assert.deepEqual(space.positions('03-user-flow'), []);
    const refused = await space.move('03-user-flow', step.key, 1, 1);
    assert.deepEqual([refused.status, refused.json.code], [404, 'diagram_not_found']);
    assert.deepEqual(space.positions('03-user-flow'), []);

    // The file again: the same diagram comes back, its box where the drawer puts it.
    await space.push({ flow: true });
    assert.equal(space.diagram('03-user-flow').removed, false);
    const back = await space.read('03-user-flow');
    assert.deepEqual(placeOf(back, step.key), step.position);
    assert.deepEqual(space.positions('03-user-flow'), []);
  });
});
