// After a drawing (TASK-435; SPEC-025, SPEC-027, SPEC-033, SPEC-035): what the hub's push (API-242) changes once it has
// drawn its snapshot. The snapshots are this repository's, built by test/snapshots.js, with their pictures and items
// replaced here by a few made for each test. The push draws with the test drawers of test/drawers.js, and an ERD drawer
// made here that draws a table marked unreadable as the stage's drawers do. Confirmations, change sets, pull requests,
// passes and threads are written by test/seed.js, as the operations of later tasks will write them.
//
// The done condition: a changed document invalidates its confirmation and puts it on the to-do; the snapshot holding
// the merge commit marks the change sets reflected and closes the threads that asked for them; an invalidated
// confirmation marks its stage's pass changed since the pass, and the pass stays; a removed element's threads stay
// readable on its diagram; a failed drawing, a 0.2 snapshot that keeps a stage's pictures and an item table that makes
// way for pictures move none; a deleted flow file's diagram stays listed, marked removed, while it has open threads.
// test/snapshots.test.js answers every response API-242 lists.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { SourceFailure } from '../src/drawing.js';
import { changeSetsChanged, confirmationsChanged } from '../src/entries.js';
import { idOf } from '../src/ids.js';
import { readProject } from '../src/project.js';
import { snapshotRoutes } from '../src/snapshots.js';
import { openStore } from '../src/store.js';
import { placeOf, testDrawers } from './drawers.js';
import { closedEntries, openEntries, seed } from './seed.js';
import { FORMAT_02, FORMAT_03, newCommit, repositorySnapshot } from './snapshots.js';
import { startServer } from './support.js';
import { checkLayer, checkTables, recordTables } from './tables.js';

const SEEDED = '2026-11-23T01:00:00.000Z';
const START = Date.parse('2026-11-24T01:00:00.000Z');
const JSON_TYPE = { 'Content-Type': 'application/json' };
const ERD = '/pictures/05-erd/nexus';
const FLOW_A = 'docs/03-user-flow/FL-001-put-a-project-on-nexus.md';
const FLOW_B = 'docs/03-user-flow/FL-002-draw-the-stages.md';
const FLOW_C = 'docs/03-user-flow/FL-003-pass-a-stage.md';
const at = (ms) => new Date(ms).toISOString();

// The ERD drawer of these tests: each table is an element keyed by its trace ID and named by its name. A table with
// unreadable true is drawn as the stage's drawers draw one they cannot read, status unreadable under the same key; one
// with broken true fails the drawing at its where.
function erd({ text }) {
  const elements = JSON.parse(text).tables.map((table) => {
    if (table.broken === true) throw new SourceFailure(placeOf(table.where));
    return { trace_id: table.id, kind: 'table', name: table.unreadable ? '' : table.name, status: table.unreadable ? 'unreadable' : null };
  });
  return { elements };
}

const table = (id, name, more = {}) => ({ id, name, where: `db/nexus.sql:${Number(id.slice(4))}`, removed: false, ...more });
const item = (id, stage, title) => ({ id, kind: 'item', stage, where: `docs/${stage}/source.md:1`, title, links: [] });
const flow = (key, ...headings) => ({ key, text: headings.map((heading) => `# ${heading}\n`).join('\n') });

describe('after a drawing', () => {
  let folder;
  let db;
  let recorder;
  let server;
  let rows;
  const clock = { now: START };
  const bases = new Map();

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-after-drawing-'));
    ({ db } = openStore(folder));
    recorder = recordTables(db);
    rows = seed(db, { time: SEEDED });
    server = await startServer({ store: recorder.store, now: () => clock.now, routes: snapshotRoutes({ drawers: { ...testDrawers(), erd } }) });
  });

  after(async () => {
    await server.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  // A project's pushes: each push sends the next commit, replacing the one before, in format, with the ERD's tables,
  // the flow files (0.3 only) and the items given, and answers the push's answer.
  function project(name) {
    let held;
    const space = { name };
    space.push = async ({ format = FORMAT_03, tables = [], flows = [], items = [], commit = newCommit(), same = false } = {}) => {
      if (!bases.has(format)) bases.set(format, repositorySnapshot(format, { name: 'base' }));
      const snapshot = structuredClone(bases.get(format));
      const sent = same ? held : commit;
      snapshot.project.name = name;
      snapshot.repos['.'].commit = sent;
      snapshot.repos['.'].default.commit = sent;
      snapshot.records.commit = sent;
      if (held !== undefined && !same) snapshot.replaces = held;
      const time = '2026-11-24T10:00:00+09:00';
      snapshot.pictures = [{ part: 'nexus', stage: '05-erd', commit: sent, time, source: { format: 1, tables } }];
      for (const { key, text } of flows) {
        snapshot.pictures.push({ part: 'nexus', stage: '03-user-flow', key, commit: sent, time, source: { text } });
      }
      snapshot.items = items;
      clock.now += 60_000;
      const answer = await server.send({
        method: 'POST', path: '/api/snapshots', headers: { ...JSON_TYPE, ...rows.agent.headers }, body: JSON.stringify(snapshot),
      });
      assert.ok([200, 201].includes(answer.status), JSON.stringify(answer.json));
      held = sent;
      const row = db.prepare('SELECT id, held_commit FROM project_spaces WHERE name = ?').get(name);
      Object.assign(space, { id: Number(row.id), commit: row.held_commit });
      return answer.json;
    };
    return space;
  }

  const time = () => at(clock.now);
  const diagram = (space, source) => {
    const row = db.prepare('SELECT id, removed_at FROM diagrams WHERE project_id = ? AND source_key = ?').get(space.id, source);
    const drawing = db.prepare('SELECT max(id) AS id FROM drawings WHERE diagram_id = ?').get(row.id).id;
    return { id: Number(row.id), drawing: Number(drawing), removed: row.removed_at !== null };
  };
  const drawingsOf = (where) => db.prepare('SELECT id, status FROM drawings WHERE diagram_id = ? ORDER BY id').all(where.id).map((row) => ({ ...row }));
  const confirmation = (id) => ({ ...db.prepare('SELECT state, ended_at, invalidated_by_drawing FROM confirmations WHERE id = ?').get(id) });
  const threadRow = (id) => ({
    ...db.prepare('SELECT diagram_id, target_kind, element_key, removed_name, state, closed_by FROM comment_threads WHERE id = ?').get(id),
  });
  const commentsOf = (thread) => db.prepare('SELECT body FROM comments WHERE thread_id = ? ORDER BY seq').all(thread).map((row) => row.body);
  const changeSetRow = (id) => ({ ...db.prepare('SELECT state, reflected_drawing_id FROM change_sets WHERE id = ?').get(id) });
  const passRow = (id) => ({ ...db.prepare('SELECT passed_at, changed_at FROM stage_passes WHERE id = ?').get(id) });
  const counts = (answer) => [answer.confirmations_invalidated, answer.change_sets_reflected, answer.threads_moved];
  // A confirmation of the diagram's current drawing, made as API-275 will make one, its to-do following.
  const confirm = (space, where, { at: confirmedAt = SEEDED } = {}) => {
    const id = rows.confirm(space, where, { at: confirmedAt });
    confirmationsChanged(db, { project: space.id, diagram: where.id, time: SEEDED });
    return id;
  };
  const stageRow = (space, stage) => readProject(db, space.name).stages.find((row) => row.stage === stage && row.part === 'nexus')
    ?? readProject(db, space.name).stages.find((row) => row.stage === stage);

  test('a changed document invalidates its confirmation and puts the diagram back on the owner\'s to-do (SPEC-033)', async () => {
    const space = project('invalidated');
    const tables = [table('TBL-146', 'agent_credentials'), table('TBL-147', 'project_spaces')];
    assert.deepEqual(counts(await space.push({ tables, items: [item('REQ-001', '02-prd', 'Draw')] })), [0, 0, 0]);
    let erdNow = diagram(space, ERD);
    // A drawn diagram waits on the owner from its first drawing.
    assert.ok(openEntries(db, space.id).some((entry) => entry.kind === 'confirm' && entry.diagram_id === erdNow.id));
    const first = confirm(space, erdNow);
    assert.equal(openEntries(db, space.id).some((entry) => entry.kind === 'confirm' && entry.diagram_id === erdNow.id), false);

    // A change only in a file the ERD does not draw from keeps it.
    assert.deepEqual(counts(await space.push({ tables, items: [item('REQ-001', '02-prd', 'Draw them')] })), [0, 0, 0]);
    assert.equal(confirmation(first).state, 'confirmed');

    // A failed drawing invalidates nothing; the fix back to the confirmed text keeps it, though it draws again.
    const broken = [...tables, table('TBL-148', 'snapshots', { broken: true })];
    const failed = await space.push({ tables: broken });
    assert.equal(failed.diagrams.failed, 1);
    assert.deepEqual(counts(failed), [0, 0, 0]);
    assert.equal(confirmation(first).state, 'confirmed');
    const fixed = await space.push({ tables });
    assert.deepEqual([fixed.diagrams.drawn, ...counts(fixed)], [1, 0, 0, 0]);
    assert.equal(confirmation(first).state, 'confirmed');

    // A change to its document invalidates it, by the drawing that drew the change, and the owner confirms again.
    const changed = await space.push({ tables: [table('TBL-146', 'agent_credentials'), table('TBL-147', 'project_spaces_v2')] });
    assert.deepEqual(counts(changed), [1, 0, 0]);
    erdNow = diagram(space, ERD);
    assert.deepEqual(confirmation(first), { state: 'invalidated', ended_at: time(), invalidated_by_drawing: erdNow.drawing });
    const waiting = openEntries(db, space.id).filter((entry) => entry.diagram_id === erdNow.id);
    assert.deepEqual(waiting.map((entry) => [entry.side, entry.kind, entry.confirmation_id]), [
      ['agent', 'record_confirmation', first],
      ['owner', 'confirm', first],
    ]);
  });

  test('the snapshot holding the merge commit reflects the change sets and closes the threads that asked for them (SPEC-025)', async () => {
    const space = project('reflected');
    const tables = [table('TBL-146', 'agent_credentials'), table('TBL-147', 'project_spaces')];
    await space.push({ tables });
    const erdNow = diagram(space, ERD);
    const asked = rows.thread(erdNow, { elementKey: 'TBL-147' });
    const proposal = rows.changeSet(space, erdNow, { origin: 'proposal', threadId: asked, state: 'accepted' });
    const edit = rows.changeSet(space, erdNow);
    const other = rows.changeSet(space, erdNow);
    const merged = rows.pullRequest(space, { number: 12, state: 'merged' });
    const opened = rows.pullRequest(space, { number: 13 });
    rows.setChangeSet(proposal, { pullRequestId: merged });
    rows.setChangeSet(edit, { pullRequestId: merged });
    rows.setChangeSet(other, { pullRequestId: opened });
    changeSetsChanged(db, { project: space.id, diagram: erdNow.id, time: SEEDED });
    const merge = newCommit();
    db.prepare('UPDATE pull_requests SET merge_commit = ? WHERE id = ?').run(merge, merged);

    // A snapshot of another commit marks nothing.
    assert.deepEqual(counts(await space.push({ tables })), [0, 0, 0]);
    assert.equal(changeSetRow(proposal).state, 'accepted');

    // The merge commit's snapshot reflects both change sets of pull request 12, even though its drawing lacks the
    // rename, at the diagram's drawing after the push, and closes the proposal's thread by reflection.
    const answer = await space.push({ tables, commit: merge });
    assert.deepEqual(counts(answer), [0, 2, 0]);
    const shown = diagram(space, ERD).drawing;
    assert.deepEqual([changeSetRow(proposal), changeSetRow(edit)], [
      { state: 'reflected', reflected_drawing_id: shown }, { state: 'reflected', reflected_drawing_id: shown },
    ]);
    assert.equal(changeSetRow(other).state, 'accepted');
    assert.deepEqual(threadRow(asked), { diagram_id: erdNow.id, target_kind: 'element', element_key: 'TBL-147', removed_name: null, state: 'closed', closed_by: 'reflection' });
    // The thread and the reflection leave the to-do; pull request 13's change set still waits.
    const open = openEntries(db, space.id);
    assert.equal(open.some((entry) => entry.thread_id === asked), false);
    assert.deepEqual(open.filter((entry) => entry.kind === 'reflect').map((entry) => entry.change_set_id), [other]);
    assert.ok(closedEntries(db, space.id).some((entry) => entry.kind === 'reflect' && entry.reason === 'done'));

    // When the merge commit's snapshot fails to draw the diagram, the change sets are reflected at the drawing it
    // still shows, its last good one, not at the failed drawing (SPEC-001).
    const late = rows.changeSet(space, diagram(space, ERD));
    const second = rows.pullRequest(space, { number: 14, state: 'merged' });
    rows.setChangeSet(late, { pullRequestId: second });
    const failing = newCommit();
    db.prepare('UPDATE pull_requests SET merge_commit = ? WHERE id = ?').run(failing, second);
    const good = diagram(space, ERD).drawing;
    assert.deepEqual(counts(await space.push({ tables: [...tables, table('TBL-148', 'snapshots', { broken: true })], commit: failing })), [0, 1, 0]);
    assert.equal(drawingsOf(diagram(space, ERD)).at(-1).status, 'failed');
    assert.deepEqual(changeSetRow(late), { state: 'reflected', reflected_drawing_id: good });
  });

  test('an invalidated confirmation marks the passes it rested on changed since the pass, and the pass stays (SPEC-035)', async () => {
    const space = project('passed');
    const tables = [table('TBL-146', 'agent_credentials')];
    await space.push({ tables });
    const erdNow = diagram(space, ERD);
    const before = rows.pass(space, '05-erd', { passedAt: '2026-11-22T00:00:00.000Z' });
    const first = confirm(space, erdNow, { at: '2026-11-23T00:00:00.000Z' });
    const since = rows.pass(space, '05-erd', { passedAt: '2026-11-23T02:00:00.000Z' });
    rows.record(first);
    assert.equal(stageRow(space, '05-erd').state, 'passed');

    await space.push({ tables: [table('TBL-146', 'agent_credentials_v2')] });
    assert.deepEqual(passRow(since), { passed_at: '2026-11-23T02:00:00.000Z', changed_at: time() });
    assert.deepEqual(passRow(before), { passed_at: '2026-11-22T00:00:00.000Z', changed_at: null });
    assert.deepEqual([stageRow(space, '05-erd').state, stageRow(space, '05-erd').passed_at], ['changed_since_pass', '2026-11-23T02:00:00.000Z']);
  });

  test('a diagram that appears after the stage\'s pass without a live confirmation marks the pass changed; a removed one does not', async () => {
    const space = project('appears');
    // Two flow files, so that the stage keeps a picture when one goes: a stage of 03 with none shows its item table,
    // which appears too (note 3; see the next test).
    const flows = [flow(FLOW_A, 'FL-001 Put a project on NEXUS'), flow(FLOW_B, 'FL-002 Draw the stages')];
    await space.push({ flows });
    const first = diagram(space, FLOW_A);
    rows.record(confirm(space, first));
    rows.record(confirm(space, diagram(space, FLOW_B)));
    const pass = rows.pass(space, '03-user-flow', { passedAt: SEEDED });

    // Removing a diagram changes no pass, since a removed diagram counts for none (SPEC-027).
    await space.push({ flows: [flows[1]] });
    assert.deepEqual([diagram(space, FLOW_A).removed, passRow(pass).changed_at], [true, null]);
    // It comes back with its live confirmation: still nothing to confirm.
    await space.push({ flows });
    assert.deepEqual(passRow(pass).changed_at, null);
    // A new flow file appears without a confirmation: the stage's pass is changed since the pass, and stays.
    await space.push({ flows: [...flows, flow(FLOW_C, 'FL-003 Pass a stage')] });
    assert.deepEqual(passRow(pass), { passed_at: SEEDED, changed_at: time() });
    assert.equal(stageRow(space, '03-user-flow').state, 'changed_since_pass');
  });

  test('when a stage of 03 loses its last picture, its item table appears without a confirmation and marks the pass changed', async () => {
    // Note 3 of the WBS (TASK-423): a stage of 03, 08 or 09 with no picture that is not removed shows its item table.
    const space = project('table-appears');
    const flows = [flow(FLOW_A, 'FL-001 Put a project on NEXUS')];
    const items = [item('FL-001', '03-user-flow', 'Put a project on NEXUS')];
    await space.push({ flows, items });
    rows.record(confirm(space, diagram(space, FLOW_A)));
    const pass = rows.pass(space, '03-user-flow', { passedAt: SEEDED });

    await space.push({ items });
    const table = diagram(space, '/items/03-user-flow');
    assert.deepEqual([diagram(space, FLOW_A).removed, table.removed], [true, false]);
    assert.deepEqual(passRow(pass), { passed_at: SEEDED, changed_at: time() });
    assert.equal(stageRow(space, '03-user-flow').state, 'changed_since_pass');
    assert.ok(openEntries(db, space.id).some((entry) => entry.kind === 'confirm' && entry.diagram_id === table.id));
  });

  test('a removed element\'s open threads move to its diagram, readable, marked with its last name, and link again when it returns (SPEC-027)', async () => {
    const space = project('moved');
    const both = [table('TBL-146', 'agent_credentials'), table('TBL-147', 'project_spaces')];
    await space.push({ tables: both });
    const erdNow = diagram(space, ERD);
    const open = rows.thread(erdNow, { elementKey: 'TBL-147', body: 'Keep the name?' });
    const closed = rows.thread(erdNow, { elementKey: 'TBL-147', body: 'Done before.' });
    rows.closeThread(closed);
    const stays = rows.thread(erdNow, { elementKey: 'TBL-146' });

    const answer = await space.push({ tables: [both[0]] });
    assert.deepEqual(counts(answer), [0, 0, 1]);
    assert.deepEqual(threadRow(open), { diagram_id: erdNow.id, target_kind: 'diagram', element_key: 'TBL-147', removed_name: 'project_spaces', state: 'open', closed_by: null });
    assert.deepEqual(commentsOf(open), ['Keep the name?']);
    assert.equal(threadRow(closed).target_kind, 'element');
    assert.equal(threadRow(stays).target_kind, 'element');

    // The element comes back: the thread stays on the diagram, linked to it again.
    assert.deepEqual(counts(await space.push({ tables: both })), [0, 0, 0]);
    assert.deepEqual(threadRow(open), { diagram_id: erdNow.id, target_kind: 'diagram', element_key: 'TBL-147', removed_name: null, state: 'open', closed_by: null });
  });

  test('an element drawn as unreadable counts as gone until it reads again, marked with its last readable name (note 2)', async () => {
    const space = project('unreadable');
    await space.push({ tables: [table('TBL-146', 'agent_credentials')] });
    const thread = rows.thread(diagram(space, ERD), { elementKey: 'TBL-146' });
    assert.deepEqual(counts(await space.push({ tables: [table('TBL-146', 'agent_credentials', { unreadable: true })] })), [0, 0, 1]);
    assert.deepEqual([threadRow(thread).target_kind, threadRow(thread).removed_name], ['diagram', 'agent_credentials']);
    await space.push({ tables: [table('TBL-146', 'agent_credentials')] });
    assert.deepEqual([threadRow(thread).target_kind, threadRow(thread).removed_name], ['diagram', null]);
  });

  test('a failed drawing, a 0.2 snapshot that keeps the pictures and an item table that makes way for pictures move none', async () => {
    // A failed drawing: the diagram shows its last good drawing, and its threads stay where they are.
    const failing = project('failing');
    const tables = [table('TBL-146', 'agent_credentials'), table('TBL-147', 'project_spaces')];
    await failing.push({ tables });
    const onTable = rows.thread(diagram(failing, ERD), { elementKey: 'TBL-147' });
    const failed = await failing.push({ tables: [table('TBL-146', 'agent_credentials', { broken: true })] });
    assert.deepEqual([failed.diagrams.failed, ...counts(failed)], [1, 0, 0, 0]);
    assert.deepEqual([threadRow(onTable).target_kind, threadRow(onTable).removed_name], ['element', null]);

    // A corthex-hub/0.2 snapshot after 0.3 pictures keeps them as last drawn (SPEC-005), so nothing leaves.
    const kept = project('kept-pictures');
    await kept.push({ flows: [flow(FLOW_A, 'FL-001 Put a project on NEXUS')] });
    const flowNow = diagram(kept, FLOW_A);
    const onFlow = rows.thread(flowNow, { elementKey: 'FL-001' });
    const older = await kept.push({ format: FORMAT_02 });
    assert.deepEqual([older.diagrams.removed, older.threads_moved], [0, 0]);
    assert.deepEqual([diagram(kept, FLOW_A).removed, threadRow(onFlow).target_kind], [false, 'element']);

    // A stage's item table makes way for its pictures when the same commit completes its revision in 0.3: the row's
    // thread is not moved, while the new pictures wait for confirmation and mark the stage's pass changed.
    const madeWay = project('made-way');
    await madeWay.push({ format: FORMAT_02, items: [item('FL-001', '03-user-flow', 'Put a project on NEXUS')] });
    const itemTable = diagram(madeWay, '/items/03-user-flow');
    const onRow = rows.thread(itemTable, { target: 'row', elementKey: 'FL-001' });
    const pass = rows.pass(madeWay, '03-user-flow', { passedAt: SEEDED });
    const completed = await madeWay.push({ same: true, flows: [flow(FLOW_A, 'FL-001 Put a project on NEXUS')], items: [item('FL-001', '03-user-flow', 'Put a project on NEXUS')] });
    assert.deepEqual([completed.same_commit, completed.diagrams.removed, completed.threads_moved], [true, 1, 0]);
    assert.equal(diagram(madeWay, '/items/03-user-flow').removed, true);
    assert.deepEqual([threadRow(onRow).target_kind, threadRow(onRow).removed_name], ['row', null]);
    assert.equal(passRow(pass).changed_at, time());
    assert.ok(openEntries(db, madeWay.id).some((entry) => entry.kind === 'confirm' && entry.diagram_id === diagram(madeWay, FLOW_A).id));
  });

  test('a deleted flow file\'s diagram stays listed, marked removed, while it has open threads (SPEC-027)', async () => {
    const space = project('deleted-flow');
    const flows = [flow(FLOW_A, 'FL-001 Put a project on NEXUS'), flow(FLOW_B, 'FL-002 Draw the stages')];
    await space.push({ flows });
    const deleted = diagram(space, FLOW_A);
    const thread = rows.thread(deleted, { elementKey: 'FL-001' });
    const answer = await space.push({ flows: [flows[1]] });
    assert.deepEqual([answer.diagrams.removed, answer.threads_moved], [1, 1]);
    assert.deepEqual(threadRow(thread), {
      diagram_id: deleted.id, target_kind: 'diagram', element_key: 'FL-001', removed_name: 'Put a project on NEXUS', state: 'open', closed_by: null,
    });
    const listed = () => readProject(db, space.name).stages.flatMap((row) => row.diagrams).find((each) => each.id === idOf('dg', deleted.id));
    assert.deepEqual([listed().removed, listed().open_threads], [true, 1]);
    // Its confirm entry is withdrawn: a removed diagram takes no confirmation (note 4).
    assert.equal(openEntries(db, space.id).some((entry) => entry.kind === 'confirm' && entry.diagram_id === deleted.id), false);
    rows.closeThread(thread);
    assert.equal(listed(), undefined);
  });

  test('touch the tables API-242 lists, and admission only the layer\'s (note 23)', () => {
    checkTables(recorder, 'pushSnapshot');
    checkLayer(recorder);
  });
});
