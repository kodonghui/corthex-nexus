// Left-out sources: a source the hub's push (API-242) names as left out keeps its diagram and its last good drawing,
// as a failed drawing at its source with no line, and nothing moves; a source named only by a check's count still
// counts as deleted (see src/drawing.js). The maintainer approved the rule through the delegate they named for
// checkpoints. The snapshots are this repository's, built by test/snapshots.js, with their pictures, items, left_out
// and checks replaced here by a few made for each test, drawn with the test drawers of test/drawers.js.
// Secret-looking and email-looking values are made at run time from parts; no test holds one as a literal.

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { confirmationsChanged } from '../src/entries.js';
import { idOf } from '../src/ids.js';
import { readProject } from '../src/project.js';
import { snapshotRoutes } from '../src/snapshots.js';
import { openStore } from '../src/store.js';
import { testDrawers } from './drawers.js';
import { openEntries, seed } from './seed.js';
import { FORMAT_02, FORMAT_03, newCommit, repositorySnapshot } from './snapshots.js';
import { startServer } from './support.js';
import { checkLayer, checkTables, recordTables } from './tables.js';

const SEEDED = '2026-11-23T01:00:00.000Z';
const START = Date.parse('2026-11-24T01:00:00.000Z');
const JSON_TYPE = { 'Content-Type': 'application/json' };
const ERD = '/pictures/05-erd/nexus';
const PRD = '/items/02-prd';
const FLOWS = '03-user-flow';
const FLOW_A = 'docs/03-user-flow/FL-001-put-a-project-on-nexus.md';
const FLOW_B = 'docs/03-user-flow/FL-002-draw-the-stages.md';
const FLOW_C = 'docs/03-user-flow/FL-003-pass-a-stage.md';
// The stages' sources as this repository's .corthex/project.json names them, which the snapshot's stage records carry.
const ERD_SOURCE = 'db/nexus.sql';
const PRD_SOURCE = 'docs/02-prd/requirements.md';

const table = (id, name) => ({ id, name, where: `${ERD_SOURCE}:${Number(id.slice(4))}`, removed: false });
const item = (id, stage, title) => ({ id, kind: 'item', stage, where: `docs/${stage}/source.md:1`, title, links: [] });
const flow = (key, ...headings) => ({ key, text: headings.map((heading) => `# ${heading}\n`).join('\n') });
const TABLES = [table('TBL-146', 'agent_credentials'), table('TBL-147', 'project_spaces')];
const FLOW_SET = [flow(FLOW_A, 'FL-001 Put a project on NEXUS'), flow(FLOW_B, 'FL-002 Draw the stages'), flow(FLOW_C, 'FL-003 Pass a stage')];
const PRD_ITEMS = [item('REQ-001', '02-prd', 'Draw the stages')];
// A left_out entry as the pinned hub writes one, and the check it adds with it.
const leftOut = (stage, why, key) => ({ part: 'nexus', stage, why, ...(key === undefined ? {} : { key }) });
// The hub's check for files past its limit, which names only the first file cut and a count.
const pastLimit = (first, omitted) => ({
  rule: 'picture-partial', level: 'warn', message: `${first}:1: first of ${omitted} supported sources omitted after 400 files`, by: 'scan',
  stage: FLOWS, args: { limit: 400, omitted },
});
const secret = () => ['gh', 'p_', randomBytes(18).toString('hex')].join('');
const email = () => [`reader${randomBytes(4).toString('hex')}`, '@', 'mail', '.', 'test'].join('');

describe('left-out sources', () => {
  let folder;
  let db;
  let recorder;
  let server;
  let rows;
  const clock = { now: START };
  const bases = new Map();

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-left-out-'));
    ({ db } = openStore(folder));
    recorder = recordTables(db);
    rows = seed(db, { time: SEEDED });
    server = await startServer({ store: recorder.store, now: () => clock.now, routes: snapshotRoutes({ drawers: testDrawers() }) });
  });

  after(async () => {
    await server.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  // A project's pushes: each push sends the next commit, replacing the one before, in format, with the ERD's tables
  // (none when tables is null), the flow files (0.3 only), the items, left_out and the checks given, and answers the
  // push's answer. same sends the held commit again.
  function project(name) {
    let held;
    const space = { name };
    space.push = async ({ format = FORMAT_03, tables = TABLES, flows = [], items = [], left = [], checks = [], same = false } = {}) => {
      if (!bases.has(format)) bases.set(format, repositorySnapshot(format, { name: 'base' }));
      const snapshot = structuredClone(bases.get(format));
      const sent = same ? held : newCommit();
      snapshot.project.name = name;
      snapshot.repos['.'].commit = sent;
      snapshot.repos['.'].default.commit = sent;
      snapshot.records.commit = sent;
      if (held !== undefined && !same) snapshot.replaces = held;
      const time = '2026-11-24T10:00:00+09:00';
      snapshot.pictures = tables === null ? [] : [{ part: 'nexus', stage: '05-erd', commit: sent, time, source: { format: 1, tables } }];
      for (const { key, text } of flows) snapshot.pictures.push({ part: 'nexus', stage: FLOWS, key, commit: sent, time, source: { text } });
      snapshot.items = items;
      snapshot.left_out = left;
      snapshot.checks = checks;
      clock.now += 60_000;
      const answer = await server.send({
        method: 'POST', path: '/api/snapshots', headers: { ...JSON_TYPE, ...rows.agent.headers }, body: JSON.stringify(snapshot),
      });
      assert.ok([200, 201].includes(answer.status), JSON.stringify(answer.json));
      held = sent;
      space.id = Number(db.prepare('SELECT id FROM project_spaces WHERE name = ?').get(name).id);
      return answer.json;
    };
    return space;
  }

  const diagram = (space, source) => {
    const row = db.prepare('SELECT id, removed_at FROM diagrams WHERE project_id = ? AND source_key = ?').get(space.id, source);
    const drawing = db.prepare('SELECT max(id) AS id FROM drawings WHERE diagram_id = ?').get(row.id).id;
    return { id: Number(row.id), drawing: Number(drawing), removed: row.removed_at !== null };
  };
  // Each drawing of a diagram, oldest first: its status and where it failed.
  const drawingsOf = (where) => db.prepare('SELECT status, failed_path, failed_line FROM drawings WHERE diagram_id = ? ORDER BY id')
    .all(where.id).map((row) => [row.status, row.failed_path, row.failed_line]);
  const failure = (where, stage, at) => ({ diagram: idOf('dg', where.id), part: 'nexus', stage, where: at });
  // The answer's drawn, failed and removed: every other diagram, the item tables of the stages read among them, is
  // unchanged.
  const counted = (answer) => [answer.diagrams.drawn, answer.diagrams.failed, answer.diagrams.removed];
  const removedAt = (where) => db.prepare('SELECT removed_at FROM diagrams WHERE id = ?').get(where.id).removed_at;
  const moved = (answer) => [answer.confirmations_invalidated, answer.change_sets_reflected, answer.threads_moved];
  // The project read's rows of a stage with diagrams, as [part, state, [id, removed, drawn] of each diagram].
  const listed = (space, stage) => readProject(db, space.name).stages
    .filter((row) => row.stage === stage && row.diagrams.length > 0)
    .map((row) => [row.part, row.state, row.diagrams.map((each) => [each.id, each.removed, each.drawn])]);
  const liveItemTable = (space, stage) => db.prepare(
    "SELECT count(*) AS n FROM diagrams WHERE project_id = ? AND stage = ? AND kind = 'item_table' AND removed_at IS NULL",
  ).get(space.id, stage).n;

  test('a picture whose source is in another repository keeps its diagram, failed at its source with no line', async () => {
    const space = project('other-repository');
    await space.push({ flows: FLOW_SET.slice(0, 2) });
    const erd = diagram(space, ERD);
    const [a, b] = [diagram(space, FLOW_A), diagram(space, FLOW_B)];
    assert.equal(liveItemTable(space, FLOWS), 0);

    // A stage's picture (05) and the files of a stage (03), each named as the hub names a source in another
    // repository: by part and stage, with no key.
    const answer = await space.push({ tables: null, left: [leftOut('05-erd', 'other-repository'), leftOut(FLOWS, 'other-repository')] });
    assert.deepEqual(counted(answer), [0, 3, 0]);
    assert.deepEqual(answer.failures, [failure(erd, '05-erd', ERD_SOURCE), failure(a, FLOWS, FLOW_A), failure(b, FLOWS, FLOW_B)]);
    assert.deepEqual(moved(answer), [0, 0, 0]);
    assert.deepEqual(drawingsOf(erd), [['drawn', null, null], ['failed', ERD_SOURCE, null]]);
    assert.deepEqual(drawingsOf(a), [['drawn', null, null], ['failed', FLOW_A, null]]);
    // Not removed: each stays its stage's diagram, in its part, with its last good drawing; the files still show as
    // the stage's pictures, so its item table does not come back.
    assert.deepEqual([erd, a, b].map(removedAt), [null, null, null]);
    assert.deepEqual(listed(space, FLOWS), [['nexus', 'open', [[idOf('dg', a.id), false, true], [idOf('dg', b.id), false, true]]]]);
    assert.deepEqual(listed(space, '05-erd'), [['nexus', 'open', [[idOf('dg', erd.id), false, true]]]]);
    assert.equal(liveItemTable(space, FLOWS), 0);

    // Left out again, each keeps that failed drawing: nothing new is drawn, and each is failed again.
    const again = await space.push({ tables: null, left: [leftOut('05-erd', 'other-repository'), leftOut(FLOWS, 'other-repository')] });
    assert.deepEqual([counted(again), again.failures.length, drawingsOf(erd).length], [[0, 3, 0], 3, 2]);
  });

  test('a file left out for size keeps its diagram by its key, and one the hub names only by a count is removed', async () => {
    const space = project('size');
    await space.push({ flows: FLOW_SET });
    const [a, b, c] = [diagram(space, FLOW_A), diagram(space, FLOW_B), diagram(space, FLOW_C)];
    // A left out for size with its key; C cut past the hub's limit, which only a check counts.
    const answer = await space.push({ flows: [FLOW_SET[1]], left: [leftOut(FLOWS, 'size', FLOW_A)], checks: [pastLimit(FLOW_C, 1)] });
    assert.deepEqual(counted(answer), [0, 1, 1]);
    assert.deepEqual(answer.failures, [failure(a, FLOWS, FLOW_A)]);
    assert.deepEqual([a, b, c].map((where) => removedAt(where) !== null), [false, false, true]);
    assert.deepEqual(drawingsOf(a), [['drawn', null, null], ['failed', FLOW_A, null]]);
    assert.deepEqual(drawingsOf(b), [['drawn', null, null]]);
    assert.deepEqual(drawingsOf(c), [['drawn', null, null]]);
    // A left_out entry of another key, or of another stage, names nothing here.
    const other = await space.push({ flows: [FLOW_SET[1]], left: [leftOut(FLOWS, 'size', FLOW_C), leftOut('08-screen-states', 'size', FLOW_A)] });
    assert.deepEqual([counted(other), removedAt(a) !== null], [[0, 0, 1], true]);
  });

  test('a file left out by its key keeps its diagram, whatever part NEXUS last read for it', async () => {
    const space = project('completed');
    await space.push({ format: FORMAT_02 });
    const completed = await space.push({ flows: [FLOW_SET[0]], same: true });
    assert.equal(completed.same_commit, true);
    const a = diagram(space, FLOW_A);
    // A revision a newer format completed records no part for the files it adds (see the server's README, Drawing).
    assert.deepEqual(listed(space, FLOWS).map(([part]) => part), ['']);
    const answer = await space.push({ left: [leftOut(FLOWS, 'size', FLOW_A)] });
    assert.deepEqual([counted(answer), answer.failures, removedAt(a)], [[0, 1, 0], [failure(a, FLOWS, FLOW_A)], null]);
    assert.deepEqual(drawingsOf(a), [['drawn', null, null], ['failed', FLOW_A, null]]);
  });

  test('a document NEXUS refuses keeps its diagram, failed at where it is from (REQ-077)', async () => {
    const space = project('refused');
    await space.push({ flows: [FLOW_SET[0]], items: PRD_ITEMS });
    const [erd, a, prd] = [diagram(space, ERD), diagram(space, FLOW_A), diagram(space, PRD)];
    const answer = await space.push({
      tables: [table('TBL-146', `agent_credentials ${email()}`), TABLES[1]],
      flows: [flow(FLOW_A, `FL-001 Put a project on NEXUS ${secret()}`)],
      items: [item('REQ-001', '02-prd', `Draw the stages ${email()}`)],
    });
    assert.deepEqual(answer.refused, [
      { part: 'nexus', stage: '05-erd', where: ERD_SOURCE, why: 'email' },
      { part: 'nexus', stage: FLOWS, where: FLOW_A, why: 'secret' },
      { part: '', stage: '02-prd', where: PRD_SOURCE, why: 'email' },
    ]);
    assert.equal(answer.diagrams.removed, 0);
    assert.deepEqual(answer.failures, [
      failure(erd, '05-erd', ERD_SOURCE), failure(a, FLOWS, FLOW_A), { ...failure(prd, '02-prd', PRD_SOURCE), part: '' },
    ]);
    assert.deepEqual([drawingsOf(erd).at(-1), drawingsOf(a).at(-1), drawingsOf(prd).at(-1)], [
      ['failed', ERD_SOURCE, null], ['failed', FLOW_A, null], ['failed', PRD_SOURCE, null],
    ]);
    assert.deepEqual([erd, a, prd].map(removedAt), [null, null, null]);
  });

  test('a left-out source keeps its confirmation, its stage\'s pass and its open threads, and the next push that sends it draws it', async () => {
    const space = project('kept');
    await space.push({ flows: [FLOW_SET[0]] });
    const a = diagram(space, FLOW_A);
    const confirmation = rows.confirm(space, a, { at: SEEDED });
    confirmationsChanged(db, { project: space.id, diagram: a.id, time: SEEDED });
    const pass = rows.pass(space, FLOWS, { passedAt: SEEDED });
    const thread = rows.thread(a, { elementKey: 'FL-001' });
    const state = () => [
      db.prepare('SELECT state FROM confirmations WHERE id = ?').get(confirmation).state,
      db.prepare('SELECT changed_at FROM stage_passes WHERE id = ?').get(pass).changed_at,
      { ...db.prepare('SELECT target_kind, element_key, removed_name, state FROM comment_threads WHERE id = ?').get(thread) },
      openEntries(db, space.id).some((entry) => entry.kind === 'confirm' && entry.diagram_id === a.id),
    ];
    const kept = ['confirmed', null, { target_kind: 'element', element_key: 'FL-001', removed_name: null, state: 'open' }, false];
    assert.deepEqual(state(), kept);

    const left = await space.push({ left: [leftOut(FLOWS, 'size', FLOW_A)] });
    assert.deepEqual([counted(left), moved(left)], [[0, 1, 0], [0, 0, 0]]);
    assert.deepEqual(state(), kept);
    assert.deepEqual(listed(space, FLOWS), [['nexus', 'passed', [[idOf('dg', a.id), false, true]]]]);

    // The same commit again answers it failed as before.
    const same = await space.push({ left: [leftOut(FLOWS, 'size', FLOW_A)], same: true });
    assert.deepEqual([same.same_commit, same.diagrams.failed, same.failures], [true, 1, [failure(a, FLOWS, FLOW_A)]]);

    // Sent again as it was, it draws again: its confirmation, the pass and the thread stay as they were.
    const back = await space.push({ flows: [FLOW_SET[0]] });
    assert.deepEqual([counted(back), moved(back)], [[1, 0, 0], [0, 0, 0]]);
    assert.deepEqual(drawingsOf(a).map(([status]) => status), ['drawn', 'failed', 'drawn']);
    assert.deepEqual(state(), kept);
    assert.deepEqual(listed(space, FLOWS), [['nexus', 'passed', [[idOf('dg', a.id), false, true]]]]);
  });

  test('touch the tables API-242 lists, and admission only the layer\'s (note 23)', () => {
    checkTables(recorder, 'pushSnapshot');
    checkLayer(recorder);
  });
});
