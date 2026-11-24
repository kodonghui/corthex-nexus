// Confirmations (TASK-446; API-275, API-276, SPEC-027, SPEC-029, SPEC-030, SPEC-031, rule 5): every response the two
// operations list, their answers against the contract's ConfirmationAnswer, what the diagram read and the two to-dos
// show after them, the tables they touch (note 23) and their log lines.
// The done condition: confirming while a change waits for reflection gets waiting_reflection.
//
// Diagrams, drawings, change sets, recorded confirmations and stage passes are written straight into the store with
// test/seed.js, as the operations of other tasks write them (TASK-418, TASK-435, TASK-444, TASK-447).

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { changeSetsChanged, confirmationsChanged, waitingChangeSets } from '../src/entries.js';
import { idOf } from '../src/ids.js';
import { ROUTES } from '../src/routes.js';
import { openStore } from '../src/store.js';
import { responseRecord } from './responses.js';
import { closedEntries, openEntries, REPOSITORY, seed } from './seed.js';
import { exchange, head, localGate, newId, startServer, testStore, TRACE_ID } from './support.js';
import { checkLayer, checkTables, recordTables } from './tables.js';

const JSON_TYPE = { 'Content-Type': 'application/json' };
const MiB = 1024 * 1024;
// The server's clock: every confirmation it makes or cancels is at NOW, a day after the seeded rows.
const NOW = '2026-11-24T02:00:00.000Z';
// The seeded rows' time (test/seed.js).
const SEEDED = '2026-11-23T01:00:00.000Z';
// A table of the ERD as its drawer draws one.
const table = (id, name) => ({ key: id, trace_id: id, kind: 'table', name, detail: { columns: [] } });

describe('confirmations', () => {
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
  const nk = (id) => (typeof id === 'number' ? idOf('nk', id) : id);
  const confirmPath = (name, diagram) => `/api/projects/${name}/diagrams/${dg(diagram)}/confirmation`;
  const cancelPath = (name, confirmation) => `/api/projects/${name}/confirmations/${nk(confirmation)}/cancel`;
  const post = async (action, path, { body, headers = {}, to = server } = {}) => responses.note(action, await to.send({
    method: 'POST', path, headers: { ...JSON_TYPE, ...owner(), ...key(), ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
  const confirm = (name, diagram, drawing, options = {}) => post('confirmDiagram', confirmPath(name, diagram), { body: { drawing: dw(drawing) }, ...options });
  const cancel = (name, confirmation, options = {}) => post('cancelConfirmation', cancelPath(name, confirmation), { body: '{}', ...options });
  const read = async (name, diagram) => (await server.send({ path: `/api/projects/${name}/diagrams/${dg(diagram)}`, headers: owner() })).json;
  const keyOf = (id) => Number(db.prepare('SELECT id FROM confirmations ORDER BY id DESC').all().find((row) => idOf('nk', Number(row.id)) === id).id);
  const rows = (name) => db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all();
  const dump = () => JSON.stringify(['confirmations', 'todos', 'stage_passes'].map(rows));

  // A project with an ERD of two tables, drawn once: { space, erd }.
  function erdProject(name = `erd-${randomBytes(3).toString('hex')}`) {
    const space = s.project(name);
    const erd = s.diagram(space);
    s.elements(erd.drawing, [table('TBL-146', 'agent_credentials'), table('TBL-147', 'project_spaces')]);
    // The owner's to-do lists a drawn diagram until it is confirmed, as the push leaves it (TASK-435).
    confirmationsChanged(db, { project: space.id, diagram: erd.id, time: SEEDED });
    return { space, erd };
  }
  // The answer's Confirmation of a confirmation made at NOW, at the drawing of the space's commit.
  const confirmed = (id, erd, space, drawing = erd.drawing) => ({
    id,
    diagram: idOf('dg', erd.id),
    drawing: idOf('dw', drawing),
    version: space.commit,
    state: 'confirmed',
    confirmed_at: NOW,
    ended_at: null,
    recorded_at: null,
    cancel_recorded_at: null,
    pull_request: null,
  });

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-confirmations-'));
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

  test('confirming while a change waits for reflection gets waiting_reflection (SPEC-029)', async () => {
    const { space, erd } = erdProject();
    // A direct edit the owner made, and a proposal the owner accepted after it (TASK-445, TASK-444): both wait.
    const edit = await post('makeDirectEdit', `/api/projects/${space.name}/diagrams/${dg(erd.id)}/direct-edits`, {
      body: { drawing: dw(erd.drawing), op: 'rename', element: 'TBL-146', name: 'agent_keys' },
    });
    assert.equal(edit.status, 201);
    const thread = s.thread(erd);
    const proposal = s.changeSet(space, erd, { origin: 'proposal', threadId: thread, state: 'accepted', decidedAt: '2026-11-24T03:00:00.000Z' });
    // A proposal that is only proposed does not wait.
    s.changeSet(space, erd, { origin: 'proposal', threadId: thread });
    const was = dump();
    const refused = await confirm(space.name, erd.id, erd.drawing);
    assert.deepEqual([refused.status, refused.json.code, refused.json.change_sets], [409, 'waiting_reflection', [edit.json.change_set.id, idOf('np', proposal)]]);
    assert.equal(refused.json.detail, 'accepted change sets wait for reflection');
    assert.equal(dump(), was);
    assert.equal((await read(space.name, erd.id)).confirmation, null);

    // Cancelling the edit leaves the accepted proposal, which still waits.
    assert.equal((await post('cancelDirectEdit', `/api/projects/${space.name}/change-sets/${edit.json.change_set.id}/cancel`, { body: '{}' })).status, 200);
    const still = await confirm(space.name, erd.id, erd.drawing);
    assert.deepEqual([still.status, still.json.code, still.json.change_sets], [409, 'waiting_reflection', [idOf('np', proposal)]]);
    // Reflected, it waits no longer, and the diagram takes the confirmation, with the proposal still proposed.
    s.setChangeSet(proposal, { reflectedDrawing: erd.drawing });
    changeSetsChanged(db, { project: space.id, diagram: erd.id, time: NOW });
    const made = await confirm(space.name, erd.id, erd.drawing);
    assert.equal(made.status, 201);
    const confirmation = confirmed(made.json.confirmation.id, erd, space);
    assert.deepEqual(made.json, { confirmation, changed: true });
    assert.deepEqual((await read(space.name, erd.id)).confirmation, confirmation);
    // The owner's to-do no longer lists the diagram, and the agent's lists recording the confirmation (SPEC-031).
    const id = keyOf(made.json.confirmation.id);
    assert.deepEqual(openEntries(db, space.id).filter((entry) => entry.kind !== 'proposal'), [
      { side: 'agent', kind: 'record_confirmation', diagram_id: erd.id, confirmation_id: id },
    ]);
    assert.deepEqual(closedEntries(db, space.id).filter((entry) => entry.kind === 'confirm'), [{ kind: 'confirm', reason: 'done' }]);
  });

  test('the waiting change sets are one reader for direct edits and accepted proposals, in the order they were accepted', () => {
    const { space, erd } = erdProject();
    const late = s.changeSet(space, erd, { decidedAt: '2026-11-24T05:00:00.000Z' });
    const early = s.changeSet(space, erd, { origin: 'proposal', threadId: s.thread(erd), state: 'accepted', decidedAt: '2026-11-24T04:00:00.000Z' });
    s.changeSet(space, erd, { state: 'cancelled' });
    s.setChangeSet(s.changeSet(space, erd), { reflectedDrawing: erd.drawing });
    assert.deepEqual(waitingChangeSets(db, { project: space.id, diagram: erd.id, limit: 200 }), [early, late]);
    assert.deepEqual(waitingChangeSets(db, { project: space.id, diagram: erd.id, limit: 1 }), [early]);
    assert.throws(() => waitingChangeSets(db, { project: space.id, diagram: erd.id, limit: 0 }), TypeError);
  });

  test('confirmed again, the same confirmation; once it ended, a new one', async () => {
    const { space, erd } = erdProject();
    const made = await confirm(space.name, erd.id, erd.drawing);
    const was = dump();
    const again = await confirm(space.name, erd.id, erd.drawing);
    assert.deepEqual([again.status, again.json], [200, { ...made.json, changed: false }]);
    assert.equal(dump(), was);
    // A later drawing of the same documents keeps the confirmation live at its drawing (TASK-435): confirming the
    // drawing shown, or the confirmed one, answers that confirmation.
    s.snapshot(space);
    const same = s.drawing(space, erd.id);
    s.elements(same, [table('TBL-146', 'agent_credentials'), table('TBL-147', 'project_spaces'), table('TBL-148', 'snapshots')]);
    for (const drawing of [same, erd.drawing]) {
      const answer = await confirm(space.name, erd.id, drawing);
      assert.deepEqual([answer.status, answer.json], [200, { ...made.json, changed: false }]);
    }
    // A later drawing that failed keeps it live too, and the diagram shows the drawing it was confirmed after.
    s.snapshot(space);
    const failed = s.drawing(space, erd.id, { status: 'failed' });
    assert.deepEqual((await confirm(space.name, erd.id, same)).json, { ...made.json, changed: false });
    assert.equal(dump(), was);
    const notDrawn = await confirm(space.name, erd.id, failed);
    assert.deepEqual([notDrawn.status, notDrawn.json.code], [409, 'not_drawn']);

    // Cancelled, it is not revived: confirming again makes a new confirmation.
    const other = erdProject();
    const first = await confirm(other.space.name, other.erd.id, other.erd.drawing);
    await cancel(other.space.name, first.json.confirmation.id);
    const second = await confirm(other.space.name, other.erd.id, other.erd.drawing);
    assert.equal(second.status, 201);
    assert.notEqual(second.json.confirmation.id, first.json.confirmation.id);
    assert.deepEqual(second.json, { confirmation: confirmed(second.json.confirmation.id, other.erd, other.space), changed: true });
    assert.equal((await read(other.space.name, other.erd.id)).confirmation.id, second.json.confirmation.id);
  });

  test('both answers name the record\'s pull request as the diagram read does: none until reported, then the one linked (TASK-469)', async () => {
    const { space, erd } = erdProject();
    const made = await confirm(space.name, erd.id, erd.drawing);
    assert.deepEqual([made.status, made.json.confirmation.pull_request], [201, null]);
    // The agent's record pull request, open: confirmed again, the answer names it.
    const confirmation = keyOf(made.json.confirmation.id);
    s.linkRecord(confirmation, s.pullRequest(space, { number: 31, purpose: 'record' }));
    const again = await confirm(space.name, erd.id, erd.drawing);
    assert.deepEqual([again.status, again.json.confirmation.pull_request], [200, `${REPOSITORY}/pull/31`]);
    assert.deepEqual(again.json.confirmation, (await read(space.name, erd.id)).confirmation);
    // Cancelled before it was recorded, its record is withdrawn: the answer names no pull request, cancelled again
    // neither, as the diagram read.
    const cancelled = await cancel(space.name, made.json.confirmation.id);
    assert.deepEqual([cancelled.status, cancelled.json.changed, cancelled.json.confirmation.state], [200, true, 'cancelled']);
    assert.deepEqual(cancelled.json.confirmation, (await read(space.name, erd.id)).confirmation);
    assert.equal(cancelled.json.confirmation.pull_request, null);
    const twice = await cancel(space.name, made.json.confirmation.id);
    assert.deepEqual([twice.json.changed, twice.json.confirmation.pull_request], [false, null]);

    // A recorded confirmation names the pull request that recorded it; cancelled, the cancel's record is due and none
    // is reported: null.
    const other = erdProject();
    const first = await confirm(other.space.name, other.erd.id, other.erd.drawing);
    const key = keyOf(first.json.confirmation.id);
    s.linkRecord(key, s.pullRequest(other.space, { number: 32, state: 'merged', purpose: 'record' }));
    s.record(key);
    const recordedAgain = await confirm(other.space.name, other.erd.id, other.erd.drawing);
    assert.deepEqual([recordedAgain.status, recordedAgain.json.confirmation.pull_request], [200, `${REPOSITORY}/pull/32`]);
    const recorded = await cancel(other.space.name, first.json.confirmation.id);
    assert.deepEqual([recorded.json.confirmation.recorded_at, recorded.json.confirmation.pull_request], [SEEDED, null]);
    assert.deepEqual(recorded.json.confirmation, (await read(other.space.name, other.erd.id)).confirmation);

    // A project that names no repository: null, a pull request linked or not.
    const bare = s.project(undefined, { repository: null });
    const bareErd = s.diagram(bare);
    s.elements(bareErd.drawing, [table('TBL-146', 'agent_credentials')]);
    const bareMade = await confirm(bare.name, bareErd.id, bareErd.drawing);
    s.linkRecord(keyOf(bareMade.json.confirmation.id), s.pullRequest(bare, { number: 33, purpose: 'record' }));
    const bareAgain = await confirm(bare.name, bareErd.id, bareErd.drawing);
    assert.deepEqual([bareMade.status, bareMade.json.confirmation.pull_request, bareAgain.json.confirmation.pull_request], [201, null, null]);
  });

  test('a confirm names the latest drawing, which drew; another is document_changed, and a failed one not_drawn', async () => {
    const { space, erd } = erdProject();
    s.snapshot(space);
    const second = s.drawing(space, erd.id);
    s.elements(second, [table('TBL-146', 'agent_credentials')]);
    const was = dump();
    const stale = await confirm(space.name, erd.id, erd.drawing);
    assert.deepEqual([stale.status, stale.json.code, stale.json.drawing, stale.json.version], [409, 'document_changed', idOf('dw', second), space.commit]);
    // The latest drawing failed: the document does not draw, though the diagram shows its last good drawing.
    s.snapshot(space);
    const failed = s.drawing(space, erd.id, { status: 'failed' });
    for (const drawing of [second, failed, erd.drawing]) {
      const answer = await confirm(space.name, erd.id, drawing);
      assert.deepEqual([answer.status, answer.json.code, answer.json.detail], [409, 'not_drawn', 'the diagram has no current drawing'], String(drawing));
    }
    // A diagram that never drew.
    const never = s.diagram(space, { stage: '07-sitemap', sourceKey: '/pictures/07-sitemap', kind: 'sitemap', name: 'Sitemap', status: 'failed' });
    const none = await confirm(space.name, never.id, never.drawing);
    assert.deepEqual([none.status, none.json.code], [409, 'not_drawn']);
    // A drawing of no drawing of the diagram.
    for (const drawing of [idOf('dw', 999_999), never.drawing]) {
      const answer = await confirm(space.name, erd.id, drawing);
      assert.deepEqual([answer.status, answer.json.code], [404, 'drawing_not_found']);
    }
    assert.equal(dump(), was);
    // Drawn again, it takes the confirmation at that drawing.
    s.snapshot(space);
    const third = s.drawing(space, erd.id);
    const made = await confirm(space.name, erd.id, third);
    assert.deepEqual([made.status, made.json.confirmation.drawing, made.json.confirmation.version], [201, idOf('dw', third), space.commit]);
  });

  test('every diagram and item table takes a confirmation but a removed one, an empty table and the mockup page included', async () => {
    const { space, erd } = erdProject();
    const foreign = erdProject();
    // A removed diagram takes no confirmation, even while it opens for its open threads (SPEC-027).
    const removed = erdProject();
    s.thread(removed.erd);
    s.removeDiagram(removed.erd.id);
    const was = dump();
    const missing = await confirm('no-such-project', erd.id, erd.drawing);
    assert.deepEqual([missing.status, missing.json.code], [404, 'project_not_found']);
    for (const diagram of [idOf('dg', 999_999), 'dg_0000', foreign.erd.id]) {
      const answer = await confirm(space.name, diagram, erd.drawing);
      assert.deepEqual([answer.status, answer.json.code], [404, 'diagram_not_found'], String(diagram));
    }
    const gone = await confirm(removed.space.name, removed.erd.id, removed.erd.drawing);
    assert.deepEqual([gone.status, gone.json.code], [404, 'diagram_not_found']);
    assert.equal((await read(removed.space.name, removed.erd.id)).removed, true);
    assert.equal(dump(), was);
    // An item table with no item: the confirmation names its drawing, which the diagram read shows empty (SPEC-005).
    const items = s.diagram(space, { stage: '02-prd', sourceKey: '/items/02-prd', kind: 'item_table', name: 'Requirements' });
    const empty = await confirm(space.name, items.id, items.drawing);
    assert.deepEqual([empty.status, empty.json.confirmation.drawing], [201, idOf('dw', items.drawing)]);
    assert.deepEqual((await read(space.name, items.id)).elements, []);
    // The mockup page, and an item table of stage 09 drawn while the stage has none.
    const mockup = s.diagram(space, { stage: '09-mockup', sourceKey: 'design/mockup/page.html', kind: 'mockup', name: 'Mockup' });
    s.elements(mockup.drawing, [{ key: 'token:--corthex-blue', kind: 'token', name: '--corthex-blue' }]);
    assert.equal((await confirm(space.name, mockup.id, mockup.drawing)).status, 201);
    const other = s.project();
    const nine = s.diagram(other, { stage: '09-mockup', sourceKey: '/items/09-mockup', kind: 'item_table', name: 'Mockup' });
    assert.equal((await confirm(other.name, nine.id, nine.drawing)).status, 201);
  });

  test('refuses a body that is not a Confirm, naming the field and never its value', async () => {
    const { space, erd } = erdProject();
    const was = dump();
    const secret = `secret-${randomBytes(6).toString('hex')}`;
    const cases = [
      [{ drawing: dw(erd.drawing), extra: secret }, 'body'],
      [{}, 'drawing'],
      [{ drawing: secret }, 'drawing'],
      [{ drawing: 5 }, 'drawing'],
      [{ drawing: null }, 'drawing'],
    ];
    for (const [body, field] of cases) {
      const answer = await post('confirmDiagram', confirmPath(space.name, erd.id), { body });
      assert.deepEqual([answer.status, answer.json.code, answer.json.field], [400, 'invalid_request', field], JSON.stringify(body));
      assert.equal(answer.text.includes(secret), false);
    }
    assert.equal(dump(), was);
  });

  test('a cancel ends the confirmation, puts the diagram back on the owner\'s to-do and withdraws its record (SPEC-030, SPEC-031)', async () => {
    const { space, erd } = erdProject();
    const made = await confirm(space.name, erd.id, erd.drawing);
    const id = keyOf(made.json.confirmation.id);
    const pass = s.pass(space, '05-erd');
    const cancelled = await cancel(space.name, made.json.confirmation.id);
    const ended = { ...made.json.confirmation, state: 'cancelled', ended_at: NOW };
    assert.deepEqual([cancelled.status, cancelled.json], [200, { confirmation: ended, changed: true }]);
    assert.deepEqual((await read(space.name, erd.id)).confirmation, ended);
    // The owner's to-do lists it as not confirmed, naming the cancelled confirmation, and the record is withdrawn.
    assert.deepEqual(openEntries(db, space.id), [{ side: 'owner', kind: 'confirm', diagram_id: erd.id, confirmation_id: id }]);
    assert.deepEqual(closedEntries(db, space.id).filter((entry) => entry.kind === 'record_confirmation'), [
      { kind: 'record_confirmation', reason: 'withdrawn', confirmation_id: id },
    ]);
    // A stage pass is left as it is (TASK-447 marks it when the agent records a cancel).
    assert.equal(db.prepare('SELECT changed_at FROM stage_passes WHERE id = ?').get(pass).changed_at, null);
    // Cancelled again: the same, changed false, and nothing written.
    const was = dump();
    const again = await cancel(space.name, made.json.confirmation.id);
    assert.deepEqual([again.status, again.json], [200, { confirmation: ended, changed: false }]);
    assert.equal(dump(), was);
  });

  test('a recorded confirmation, cancelled, asks the agent to record the cancel; an invalidated one is not confirmed', async () => {
    const { space, erd } = erdProject();
    const made = await confirm(space.name, erd.id, erd.drawing);
    const id = keyOf(made.json.confirmation.id);
    s.record(id);
    confirmationsChanged(db, { project: space.id, diagram: erd.id, time: NOW });
    const cancelled = await cancel(space.name, made.json.confirmation.id);
    assert.deepEqual([cancelled.status, cancelled.json.changed, cancelled.json.confirmation.state, cancelled.json.confirmation.recorded_at],
      [200, true, 'cancelled', SEEDED]);
    assert.deepEqual(openEntries(db, space.id), [
      { side: 'owner', kind: 'confirm', diagram_id: erd.id, confirmation_id: id },
      { side: 'agent', kind: 'record_cancel', diagram_id: erd.id, confirmation_id: id },
    ]);

    // Invalidated by a drawing that changed the documents: not confirmed, so the same, changed false.
    const other = erdProject();
    const live = await confirm(other.space.name, other.erd.id, other.erd.drawing);
    s.snapshot(other.space);
    const changed = s.drawing(other.space, other.erd.id);
    s.invalidate(keyOf(live.json.confirmation.id), changed);
    const was = dump();
    const answer = await cancel(other.space.name, live.json.confirmation.id);
    assert.deepEqual([answer.status, answer.json.changed, answer.json.confirmation.state, answer.json.confirmation.ended_at],
      [200, false, 'invalidated', SEEDED]);
    assert.equal(dump(), was);
  });

  test('a removed diagram\'s confirmation is cancelled like any other (note 9)', async () => {
    const { space, erd } = erdProject();
    const made = await confirm(space.name, erd.id, erd.drawing);
    const id = keyOf(made.json.confirmation.id);
    s.thread(erd);
    s.removeDiagram(erd.id);
    confirmationsChanged(db, { project: space.id, diagram: erd.id, time: NOW });
    assert.equal((await read(space.name, erd.id)).confirmation.state, 'confirmed');
    const cancelled = await cancel(space.name, made.json.confirmation.id);
    assert.deepEqual([cancelled.status, cancelled.json.changed, cancelled.json.confirmation.state], [200, true, 'cancelled']);
    // Its record is withdrawn, and the owner's to-do gets no confirm entry: a removed diagram takes no confirmation.
    assert.deepEqual(openEntries(db, space.id), []);
    assert.deepEqual(closedEntries(db, space.id).filter((entry) => entry.kind === 'record_confirmation'), [
      { kind: 'record_confirmation', reason: 'withdrawn', confirmation_id: id },
    ]);
  });

  test('refuses to cancel a confirmation that is not there, or with a body', async () => {
    const { space, erd } = erdProject();
    const other = erdProject();
    const theirs = await confirm(other.space.name, other.erd.id, other.erd.drawing);
    const made = await confirm(space.name, erd.id, erd.drawing);
    const was = dump();
    const missing = await cancel('no-such-project', made.json.confirmation.id);
    assert.deepEqual([missing.status, missing.json.code], [404, 'project_not_found']);
    for (const id of [idOf('nk', 999_999), 'nk_x', theirs.json.confirmation.id]) {
      const answer = await cancel(space.name, id);
      assert.deepEqual([answer.status, answer.json.code], [404, 'confirmation_not_found'], id);
    }
    for (const body of ['{"reason":"no"}', '{"confirmation":"x"}']) {
      const answer = await cancel(space.name, made.json.confirmation.id, { body });
      assert.deepEqual([answer.status, answer.json.code, answer.json.field], [400, 'invalid_request', 'body']);
    }
    assert.equal(dump(), was);
  });

  test('a repeated request key answers the first answer and writes nothing; another action under it is refused', async () => {
    const { space, erd } = erdProject();
    const requestKey = key();
    const first = await confirm(space.name, erd.id, erd.drawing, { headers: requestKey });
    assert.equal(first.status, 201);
    const was = dump();
    const repeat = await confirm(space.name, erd.id, erd.drawing, { headers: requestKey });
    assert.deepEqual([repeat.status, repeat.json], [201, first.json]);
    assert.equal(dump(), was);
    const reused = await confirm(space.name, erd.id, idOf('dw', 999_999), { headers: requestKey });
    assert.deepEqual([reused.status, reused.json.code], [409, 'request_key_reused']);
    const cancelKey = key();
    const cancelled = await cancel(space.name, first.json.confirmation.id, { headers: cancelKey });
    assert.deepEqual((await cancel(space.name, first.json.confirmation.id, { headers: cancelKey })).json, cancelled.json);
    const otherAction = await cancel(space.name, first.json.confirmation.id, { headers: requestKey });
    assert.deepEqual([otherAction.status, otherAction.json.code], [409, 'request_key_reused']);
    assert.equal(cancelled.json.changed, true);
  });

  test('refuses a body that is not JSON or too large', async () => {
    const { space, erd } = erdProject();
    const made = await confirm(space.name, erd.id, erd.drawing);
    const was = dump();
    for (const [action, path] of [['confirmDiagram', confirmPath(space.name, erd.id)], ['cancelConfirmation', cancelPath(space.name, made.json.confirmation.id)]]) {
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
    const made = await confirm(space.name, erd.id, erd.drawing);
    await cancel(space.name, made.json.confirmation.id);
    const was = dump();
    const someone = { 'Cf-Access-Jwt-Assertion': local.token({ email: 'someone@example.org' }) };
    const sends = [
      ['confirmDiagram', confirmPath(space.name, erd.id), JSON.stringify({ drawing: dw(erd.drawing) })],
      ['cancelConfirmation', cancelPath(space.name, made.json.confirmation.id), '{}'],
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
    const live = failing.diagram(space, { stage: '02-prd', sourceKey: '/items/02-prd', kind: 'item_table', name: 'Requirements' });
    const confirmation = failing.confirm(space, live);
    confirmationsChanged(store, { project: space.id, diagram: erd.id, time: NOW });
    confirmationsChanged(store, { project: space.id, diagram: live.id, time: NOW });
    // A store whose confirmations cannot be written, as when the disk fails.
    const broken = new Proxy(store, {
      get(target, name) {
        const value = Reflect.get(target, name, target);
        if (name === 'prepare') {
          return (sql) => {
            const statement = target.prepare(sql);
            if (!sql.startsWith('INSERT INTO confirmations') && !sql.startsWith('UPDATE confirmations')) return statement;
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
    const state = () => JSON.stringify(['confirmations', 'todos'].map((name) => store.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all()));
    const was = state();
    const made = await post('confirmDiagram', confirmPath('broken', erd.id), { to: other, body: { drawing: dw(erd.drawing) } });
    assert.deepEqual([made.status, made.json.code], [500, 'internal']);
    const cancelled = await post('cancelConfirmation', cancelPath('broken', confirmation), { to: other, body: '{}' });
    assert.deepEqual([cancelled.status, cancelled.json.code], [500, 'internal']);
    assert.equal(state(), was);
    assert.equal(other.logText().includes('the store failed'), false);
  });

  test('logs one line per request with its sender, and never the project\'s name or a path (rule 5)', async () => {
    const name = `lima-${randomBytes(6).toString('hex')}`;
    const { space, erd } = erdProject(name);
    const made = await confirm(space.name, erd.id, erd.drawing);
    assert.equal(made.status, 201);
    assert.equal((await cancel(space.name, made.json.confirmation.id)).status, 200);
    const lines = (await server.logged(2)).filter((each) => ['confirmDiagram', 'cancelConfirmation'].includes(each.action));
    assert.ok(lines.length >= 2);
    for (const each of lines) {
      assert.match(each.traceId, TRACE_ID);
      assert.ok(['owner', 'unknown', s.agent.name].includes(each.sender), each.sender);
    }
    const text = server.logText();
    for (const value of [name, 'agent_credentials', folder, folder.replaceAll('\\', '/'), JSON.stringify(folder).slice(1, -1)]) {
      assert.equal(text.includes(value), false, value);
    }
  });

  test('answers every response API-275 and API-276 list', () => {
    responses.assertEvery('confirmDiagram');
    responses.assertEvery('cancelConfirmation');
  });

  test('touches the tables their x-corthex.tables list, changes only tables their spec rows feed, and admission only the layer\'s (note 23)', () => {
    checkTables(recorder, 'confirmDiagram');
    checkTables(recorder, 'cancelConfirmation');
    checkLayer(recorder);
  });
});
