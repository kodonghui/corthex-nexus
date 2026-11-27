// Reports from the agent (TASK-447; API-258, API-259, SPEC-023, SPEC-024, SPEC-025, SPEC-030, SPEC-031, SPEC-032,
// SPEC-035, SPEC-045, notes 20 and 26 of the WBS, rule 3, rule 5): TASK-447's done condition, every response the two
// operations list, the reflection and the checkpoint they answer against the contract, the pull requests, change sets,
// to-do entries, claims, comments and passes they write, the tables they touch (note 23) and their log lines. The done
// condition: recording a stage's last confirmation writes its pass with the date of the last confirmation (SPEC-035).
//
// Diagrams, drawings, elements, change sets, confirmations, pull requests and passes are written straight into the
// store with test/seed.js, as the push and the owner's operations of other tasks write them.

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { changeSetsChanged, confirmationsChanged, removeFromPullRequest } from '../src/entries.js';
import { idOf } from '../src/ids.js';
import { LIMITS } from '../src/limits.js';
import { cancelRecorded, passStage } from '../src/passes.js';
import { latestPasses } from '../src/project.js';
import { ROUTES } from '../src/routes.js';
import { openStore } from '../src/store.js';
import { responseRecord } from './responses.js';
import { closedEntries, openEntries, REPOSITORY, seed, TIME } from './seed.js';
import { exchange, head, localGate, newId, startServer, testStore, TRACE_ID } from './support.js';
import { checkLayer, checkTables, recordTables } from './tables.js';

const START = Date.parse('2026-11-24T02:00:00.000Z');
const MINUTE = 60 * 1000;
const MiB = 1024 * 1024;
const S1 = 'claude-code-4f2a91';
const S2 = 'codex-7d1e';
const ACTIONS = ['reportEdit', 'reportCheckpoint'];
const SECRETISH = 'value-that-must-not-come-back';
const at = (ms) => new Date(ms).toISOString();
const link = (number) => `${REPOSITORY}/pull/${number}`;
const sha = () => randomBytes(20).toString('hex');
// A table of the ERD as its drawer draws one.
const table = (id, name) => ({ key: id, trace_id: id, kind: 'table', name, detail: { columns: [] } });
// The head of the comment that says what a merged document lacks (note 26), in Korean as the owner's screen is.
const lacks = (number) => `병합한 PR #${number}의 문서에 이 변경이 없어요. 변경은 반영됨으로 표시했어요. 다시 필요하면 이 스레드에 답하거나 새 제안을 부탁하세요.`;

describe('reports from the agent', () => {
  const responses = responseRecord();
  let folder;
  let db;
  let recorder;
  let local;
  let server;
  let s;
  let clock = START;

  // Sends a report with its JSON body, request key and session, and checks the answer against the contract.
  const write = async (action, path, body, {
    session = S1, headers = s.agent.headers, key = `"${newId('nw')}"`, type = 'application/json', raw,
  } = {}) => {
    const all = { ...headers, 'Content-Type': type };
    if (session !== null) all['Nexus-Session'] = session;
    if (key !== null) all['Idempotency-Key'] = key;
    return responses.note(action, await server.send({ method: 'POST', path, headers: all, body: raw ?? JSON.stringify(body) }));
  };
  const ne = (entry) => (typeof entry === 'number' ? idOf('ne', entry) : entry);
  const nk = (confirmation) => (typeof confirmation === 'number' ? idOf('nk', confirmation) : confirmation);
  const editPath = (space, entry) => `/api/spaces/${space.name}/edits/${ne(entry)}/report`;
  const checkpointPath = (space, confirmation) => `/api/spaces/${space.name}/checkpoints/${nk(confirmation)}/report`;
  const reportEdit = (space, entry, body, options) => write('reportEdit', editPath(space, entry), body, options);
  const reportCheckpoint = (space, confirmation, body, options) => write('reportCheckpoint', checkpointPath(space, confirmation), body, options);
  const readEdit = async (space, entry) => (await server.send({ path: `/api/spaces/${space.name}/edits/${ne(entry)}`, headers: s.agent.headers })).json;

  const rows = (sql, ...values) => db.prepare(sql).all(...values).map((row) => ({ ...row }));
  const entries = (space, kind) => rows('SELECT id FROM todos WHERE project_id = ? AND kind = ? AND closed_at IS NULL ORDER BY id', space.id, kind)
    .map((row) => Number(row.id));
  const entryRow = (id) => rows('SELECT closed_at, close_reason FROM todos WHERE id = ?', id)[0];
  const pullRow = (space, number) => rows(
    'SELECT purpose, state, merge_commit, closed_at, credential_id FROM pull_requests WHERE project_id = ? AND number = ?', space.id, number,
  ).map((row) => ({ ...row, credential_id: Number(row.credential_id) }))[0];
  const numberOf = (pullRequest) => (pullRequest === null ? null : Number(db.prepare('SELECT number FROM pull_requests WHERE id = ?').get(pullRequest).number));
  const setRow = (id) => rows('SELECT state, pull_request_id, reflected_drawing_id FROM change_sets WHERE id = ?', id).map((row) => ({
    state: row.state,
    pull_request: numberOf(row.pull_request_id),
    reflected_drawing: row.reflected_drawing_id === null ? null : Number(row.reflected_drawing_id),
  }))[0];
  const claimsOf = (entry) => rows('SELECT session, release_reason, pull_request_id FROM claims WHERE todo_id = ? ORDER BY id', entry)
    .map((row) => ({ session: row.session, released: row.release_reason, pull_request: numberOf(row.pull_request_id) }));
  const confirmationRow = (id) => rows(
    'SELECT state, recorded_at, cancel_recorded_at, record_pull_request_id FROM confirmations WHERE id = ?', id,
  ).map(({ record_pull_request_id: pullRequest, ...row }) => ({ ...row, pull_request: numberOf(pullRequest) }))[0];
  const passesOf = (space) => rows('SELECT stage, passed_at, changed_at FROM stage_passes WHERE project_id = ? ORDER BY id', space.id);
  const count = (name) => Number(db.prepare(`SELECT count(*) AS n FROM ${name}`).get().n);
  const dump = () => JSON.stringify(['pull_requests', 'change_sets', 'confirmations', 'todos', 'claims', 'stage_passes', 'comment_threads', 'comments']
    .map((name) => rows(`SELECT * FROM ${name} ORDER BY rowid`)));

  // A project with an ERD of two tables, drawn once, its owner's confirm entry open as the push leaves it: { space,
  // erd }.
  function erdProject(name = `demo-${randomBytes(3).toString('hex')}`, options = {}) {
    const space = s.project(name, options);
    const erd = s.diagram(space);
    s.elements(erd.drawing, [table('TBL-146', 'agent_credentials'), table('TBL-147', 'project_spaces')]);
    confirmationsChanged(db, { project: space.id, diagram: erd.id, time: TIME });
    return { space, erd };
  }
  // The stage's item table, drawn.
  const itemTable = (space, stage = '05-erd') => s.diagram(space, { stage, sourceKey: `/items/${stage}`, kind: 'item_table', name: 'Items' });
  // An accepted direct edit of one step, with its reflection entry as the owner's edit leaves it (TASK-445).
  function edit(space, where, step = { op: 'rename', element: 'TBL-146', name: 'agent_keys' }, options = {}) {
    const id = s.changeSet(space, where, options);
    s.change(id, step);
    changeSetsChanged(db, { project: space.id, diagram: where.id, time: TIME });
    return id;
  }
  // A live confirmation of the diagram, its record entry open as API-275 leaves it.
  function confirmed(space, where, options) {
    const id = s.confirm(space, where, options);
    confirmationsChanged(db, { project: space.id, diagram: where.id, time: TIME });
    return id;
  }
  const claimOf = (entry, { lastWrite = clock, ends = null, pullRequest = null, mine = true, claimedAt = START } = {}) => ({
    entry, session: S1, mine, claimed_at: at(claimedAt), last_write_at: at(lastWrite), ends_at: ends === null ? null : at(ends),
    pull_request: pullRequest === null ? null : link(pullRequest),
  });

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-reports-'));
    ({ db } = openStore(folder));
    recorder = recordTables(db);
    local = localGate();
    server = await startServer({ store: recorder.store, gate: local.gate, routes: ROUTES, now: () => clock });
    s = seed(db);
  });

  after(async () => {
    await server.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  test('recording a stage\'s last confirmation writes its pass with the date of the last confirmation (SPEC-035)', async () => {
    clock = START;
    const { space, erd } = erdProject();
    // The stage's item table was confirmed last and recorded first; a removed diagram counts for none (SPEC-027); a
    // diagram of another stage that waits keeps no pass of this one from being written.
    const items = itemTable(space);
    const early = confirmed(space, items, { at: '2026-11-23T05:00:00.000Z' });
    s.record(early);
    confirmationsChanged(db, { project: space.id, diagram: items.id, time: TIME });
    s.diagram(space, { sourceKey: '/pictures/05-erd/old', removed: true });
    itemTable(space, '02-prd');
    const last = confirmed(space, erd, { at: '2026-11-23T03:00:00.000Z' });
    const [entry] = entries(space, 'record_confirmation');
    const checkpoint = (more) => ({
      id: nk(last), part: '', stage: '05-erd', diagram: idOf('dg', erd.id), drawing: idOf('dw', erd.drawing), version: space.commit,
      state: 'passed', confirmation: 'confirmed', passed_at: '2026-11-23T03:00:00.000Z', withdrawn_at: null, recorded_at: null,
      cancel_recorded_at: null, record_state: 'waiting', pull_request: null, claim: null, ...more,
    });

    const opened = await reportCheckpoint(space, last, { event: 'opened', pull_request: link(21) });
    assert.deepEqual(opened.json, {
      checkpoint: checkpoint({ record_state: 'in_review', pull_request: link(21), claim: claimOf(nk(last), { pullRequest: 21 }) }), changed: true,
    });
    assert.deepEqual(passesOf(space), []);

    clock = START + 5 * MINUTE;
    const merged = await reportCheckpoint(space, last, { event: 'merged', pull_request: link(21) });
    assert.deepEqual(merged.json, {
      checkpoint: checkpoint({ recorded_at: at(clock), record_state: 'recorded', pull_request: link(21) }), changed: true,
    });
    assert.deepEqual(passesOf(space), [{ stage: '05-erd', passed_at: '2026-11-23T05:00:00.000Z', changed_at: null }]);
    // Its entry is done and the claim released as done (SPEC-032); the pull request is the record's, merged.
    assert.deepEqual(entryRow(entry), { closed_at: at(clock), close_reason: 'done' });
    assert.deepEqual(claimsOf(entry), [{ session: S1, released: 'done', pull_request: 21 }]);
    assert.deepEqual(pullRow(space, 21), { purpose: 'record', state: 'merged', merge_commit: null, closed_at: at(clock), credential_id: s.agent.key });

    // Reported again: changed false, and no second pass.
    clock = START + 6 * MINUTE;
    const again = await reportCheckpoint(space, last, { event: 'merged', pull_request: link(21) });
    assert.deepEqual(again.json, { checkpoint: merged.json.checkpoint, changed: false });
    assert.equal(passesOf(space).length, 1);
  });

  test('a pass needs every diagram of the stage live and recorded, rests on them once, and a recorded cancel marks those it rested on', () => {
    const { space, erd } = erdProject();
    const stage = '05-erd';
    const pass = () => passStage(db, { project: space.id, stage });
    // A stage with nothing to confirm, or with a diagram not recorded yet, has not passed.
    assert.equal(passStage(db, { project: space.id, stage: '07-sitemap' }), null);
    const first = s.confirm(space, erd, { at: '2026-11-23T02:00:00.000Z' });
    assert.equal(pass(), null);
    // Recorded, then invalidated: it is recorded at its version (SPEC-032) and counts for no pass.
    s.record(first);
    s.invalidate(first, erd.drawing);
    assert.equal(pass(), null);
    // Confirmed again and recorded: the pass, at the confirmation's date, written once.
    const second = s.confirm(space, erd, { at: '2026-11-23T04:00:00.000Z' });
    s.record(second);
    assert.equal(pass(), '2026-11-23T04:00:00.000Z');
    assert.equal(pass(), null);
    // A pass marked changed rests on them no more, and neither does one older than the last confirmation.
    const [{ id }] = rows('SELECT id FROM stage_passes WHERE project_id = ?', space.id);
    s.changePass(Number(id));
    assert.equal(pass(), '2026-11-23T04:00:00.000Z');
    const other = erdProject();
    s.pass(other.space, stage, { passedAt: '2026-11-23T03:00:00.000Z' });
    s.record(s.confirm(other.space, other.erd, { at: '2026-11-23T04:00:00.000Z' }));
    assert.equal(passStage(db, { project: other.space.id, stage }), '2026-11-23T04:00:00.000Z');
    assert.throws(() => passStage(db, { project: space.id, stage: '' }), TypeError);

    // A pass written later may carry an earlier date: the stage's latest pass is the last written, which the project
    // read shows. The table confirmed last is changed, then removed, so the stage passes again at the ERD's date.
    const pair = erdProject();
    const items = itemTable(pair.space);
    s.record(s.confirm(pair.space, pair.erd, { at: '2026-11-23T01:00:00.000Z' }));
    s.record(s.confirm(pair.space, items, { at: '2026-11-23T03:00:00.000Z' }));
    assert.equal(passStage(db, { project: pair.space.id, stage }), '2026-11-23T03:00:00.000Z');
    const [{ id: changed }] = rows('SELECT id FROM stage_passes WHERE project_id = ?', pair.space.id);
    s.changePass(Number(changed));
    s.removeDiagram(items.id);
    assert.equal(passStage(db, { project: pair.space.id, stage }), '2026-11-23T01:00:00.000Z');
    assert.deepEqual({ ...latestPasses(db, pair.space.id).get(stage) }, { stage, passed_at: '2026-11-23T01:00:00.000Z', changed_at: null });

    // A recorded cancel marks the passes made while the confirmation was live, from its confirmed_at to its ended_at,
    // and leaves those before and after it, and one already marked, as they are.
    const third = erdProject();
    const live = s.confirm(third.space, third.erd, { at: '2026-11-22T00:00:00.000Z' });
    s.record(live);
    const before = s.pass(third.space, stage, { passedAt: '2026-11-21T00:00:00.000Z' });
    const resting = s.pass(third.space, stage, { passedAt: '2026-11-22T00:00:00.000Z' });
    const marked = s.pass(third.space, stage, { passedAt: '2026-11-22T12:00:00.000Z' });
    s.changePass(marked, { at: '2026-11-22T13:00:00.000Z' });
    const later = s.pass(third.space, stage, { passedAt: '2026-11-23T02:00:00.000Z' });
    assert.throws(() => cancelRecorded(db, { project: third.space.id, confirmation: live, time: at(START) }), TypeError);
    s.cancel(live);
    assert.equal(cancelRecorded(db, { project: third.space.id, confirmation: live, time: at(START) }), 1);
    assert.deepEqual(rows('SELECT id, changed_at FROM stage_passes WHERE project_id = ? ORDER BY id', third.space.id), [
      { id: before, changed_at: null },
      { id: resting, changed_at: at(START) },
      { id: marked, changed_at: '2026-11-22T13:00:00.000Z' },
      { id: later, changed_at: null },
    ]);
  });

  test('a reflection\'s pull request: opened links it with the claim, merged and reflected record it, and a held commit reflects at once', async () => {
    clock = START;
    const { space, erd } = erdProject();
    const set = edit(space, erd);
    const [entry] = entries(space, 'reflect');
    const reflection = (more) => ({
      id: ne(entry), part: '', stage: '05-erd', diagram: idOf('dg', erd.id), task: 'reflect', state: 'in_review',
      change_sets: [idOf('np', set)], pull_request: link(12), commit: null, made_at: TIME, closed_at: null, claim: null, ...more,
    });
    // No pull request yet: a report without one gets pull_request_needed, and writes nothing.
    const was = dump();
    for (const body of [{ event: 'opened' }, { event: 'reflected', commit: sha() }]) {
      const needed = await reportEdit(space, entry, body);
      assert.deepEqual([needed.status, needed.json.code], [409, 'pull_request_needed']);
    }
    assert.equal(dump(), was);

    const opened = await reportEdit(space, entry, { event: 'opened', pull_request: link(12) });
    assert.deepEqual(opened.json, { edit: reflection({ claim: claimOf(ne(entry), { pullRequest: 12 }) }), changed: true });
    assert.deepEqual(pullRow(space, 12), { purpose: 'reflection', state: 'open', merge_commit: null, closed_at: null, credential_id: s.agent.key });
    assert.deepEqual(setRow(set), { state: 'accepted', pull_request: 12, reflected_drawing: null });
    assert.deepEqual(claimsOf(entry), [{ session: S1, released: null, pull_request: 12 }]);

    // Reported again: the same link, changed false. A read answers the same, its claim not mine.
    clock = START + MINUTE;
    const again = await reportEdit(space, entry, { event: 'opened', pull_request: link(12) });
    assert.deepEqual(again.json, { edit: reflection({ claim: claimOf(ne(entry), { pullRequest: 12 }) }), changed: false });
    assert.deepEqual(await readEdit(space, entry), reflection({ claim: claimOf(ne(entry), { pullRequest: 12, mine: false }) }));
    // Another pull request gets pull_request_mismatch, naming the group's; another session gets claimed.
    const other = await reportEdit(space, entry, { event: 'opened', pull_request: link(13) });
    assert.deepEqual([other.status, other.json.code, other.json.pull_request], [409, 'pull_request_mismatch', link(12)]);
    const held = await reportEdit(space, entry, { event: 'merged' }, { session: S2 });
    assert.deepEqual([held.status, held.json.code, held.json.session], [409, 'claimed', S1]);
    assert.equal(pullRow(space, 13), undefined);

    // merged, without its link: the group's own. The claim's 60 minutes start from the merge.
    clock = START + 2 * MINUTE;
    const merged = await reportEdit(space, entry, { event: 'merged' });
    assert.deepEqual(merged.json, {
      edit: reflection({ state: 'merged', claim: claimOf(ne(entry), { pullRequest: 12, ends: clock + 60 * MINUTE }) }), changed: true,
    });
    // reflected with a commit NEXUS does not hold: reported, and the change set waits for that commit's push.
    clock = START + 3 * MINUTE;
    const merge = sha();
    const reported = await reportEdit(space, entry, { event: 'reflected', pull_request: link(12), commit: merge });
    assert.deepEqual(reported.json, {
      edit: reflection({ state: 'reported', commit: merge, claim: claimOf(ne(entry), { pullRequest: 12, ends: clock + 60 * MINUTE }) }),
      changed: true,
    });
    assert.deepEqual(setRow(set), { state: 'accepted', pull_request: 12, reflected_drawing: null });

    // NEXUS holds a snapshot of the commit, which drew the rename: reflected with it reflects the change set at once at
    // that drawing (SPEC-025), the entry is done and the claim released as done.
    s.snapshot(space);
    const shown = s.drawing(space, erd.id);
    s.elements(shown, [table('TBL-146', 'agent_keys'), table('TBL-147', 'project_spaces')]);
    clock = START + 4 * MINUTE;
    const threads = count('comment_threads');
    const reflected = await reportEdit(space, entry, { event: 'reflected', commit: space.commit });
    assert.deepEqual(reflected.json, { edit: reflection({ state: 'done', commit: space.commit, closed_at: at(clock) }), changed: true });
    assert.deepEqual(setRow(set), { state: 'reflected', pull_request: 12, reflected_drawing: shown });
    assert.deepEqual(pullRow(space, 12), {
      purpose: 'reflection', state: 'merged', merge_commit: space.commit, closed_at: at(START + 2 * MINUTE), credential_id: s.agent.key,
    });
    assert.deepEqual(claimsOf(entry), [{ session: S1, released: 'done', pull_request: 12 }]);
    assert.equal(count('comment_threads'), threads);
    assert.deepEqual(entries(space, 'reflect'), []);

    // On the closed entry, a report that repeats what is true answers changed false; any other change_set_state.
    for (const body of [{ event: 'reflected', commit: space.commit }, { event: 'merged', pull_request: link(12) }]) {
      const repeat = await reportEdit(space, entry, body);
      assert.deepEqual([repeat.status, repeat.json.changed, repeat.json.edit.state], [200, false, 'done']);
    }
    const bodies = [{ event: 'opened' }, { event: 'closed' }, { event: 'reflected', commit: merge }, { event: 'merged', pull_request: link(14) }];
    for (const body of bodies) {
      const refused = await reportEdit(space, entry, body);
      assert.deepEqual([refused.status, refused.json.code, refused.json.state], [409, 'change_set_state', 'reflected'], body.event);
    }
  });

  test('closed unlinks the change sets, which wait again, and starts the claim\'s 60 minutes; opened reopens it (SPEC-024, SPEC-045)', async () => {
    clock = START;
    const { space, erd } = erdProject();
    const set = edit(space, erd);
    const [entry] = entries(space, 'reflect');
    await reportEdit(space, entry, { event: 'opened', pull_request: link(30) });
    clock = START + 10 * MINUTE;
    const closed = await reportEdit(space, entry, { event: 'closed' });
    // The reflection waits in no pull request; the claim still names the closed one and ends 60 minutes after it closed.
    assert.deepEqual([closed.status, closed.json.changed, closed.json.edit.state, closed.json.edit.pull_request], [200, true, 'waiting', null]);
    assert.deepEqual(closed.json.edit.claim, claimOf(ne(entry), { pullRequest: 30, ends: clock + 60 * MINUTE }));
    assert.deepEqual(pullRow(space, 30), { purpose: 'reflection', state: 'closed', merge_commit: null, closed_at: at(clock), credential_id: s.agent.key });
    assert.deepEqual(setRow(set), { state: 'accepted', pull_request: null, reflected_drawing: null });
    assert.deepEqual(entries(space, 'reflect'), [entry]);
    // Closed again: nothing changes.
    const repeat = await reportEdit(space, entry, { event: 'closed', pull_request: link(30) });
    assert.deepEqual([repeat.status, repeat.json.changed], [200, false]);
    // The claim ends 60 minutes after the close.
    clock = START + 71 * MINUTE;
    assert.equal((await readEdit(space, entry)).claim, null);

    // GitHub reopens a closed pull request: opened links the group again and keeps a new claim while it is open.
    const reopened = await reportEdit(space, entry, { event: 'opened', pull_request: link(30) });
    assert.deepEqual([reopened.json.changed, reopened.json.edit.state, reopened.json.edit.pull_request], [true, 'in_review', link(30)]);
    assert.deepEqual(reopened.json.edit.claim, claimOf(ne(entry), { pullRequest: 30, claimedAt: clock }));
    assert.deepEqual([pullRow(space, 30).state, pullRow(space, 30).closed_at, setRow(set).pull_request], ['open', null, 30]);
    assert.deepEqual(claimsOf(entry).map((claim) => claim.released), ['idle', null]);

    // Merged, it is neither reopened nor closed: invalid_request on event, and nothing changes.
    await reportEdit(space, entry, { event: 'merged' });
    const was = dump();
    for (const event of ['opened', 'closed']) {
      const refused = await reportEdit(space, entry, { event });
      assert.deepEqual([refused.status, refused.json.code, refused.json.field, refused.json.detail], [400, 'invalid_request', 'event', 'pull request 30 is merged']);
    }
    assert.equal(dump(), was);

    // A pull request NEXUS has closed that is reported merged takes the newer state, and links the group.
    const late = edit(space, erd, { op: 'add', element: 'TBL-170', name: 'tool_runs' });
    const [, next] = entries(space, 'reflect');
    await reportEdit(space, next, { event: 'opened', pull_request: link(31) });
    await reportEdit(space, next, { event: 'closed' });
    clock = START + 80 * MINUTE;
    const merged = await reportEdit(space, next, { event: 'merged', pull_request: link(31) });
    assert.deepEqual([merged.json.changed, merged.json.edit.state, merged.json.edit.pull_request], [true, 'merged', link(31)]);
    assert.deepEqual([pullRow(space, 31).state, pullRow(space, 31).closed_at, setRow(late).pull_request], ['merged', at(clock), 31]);
  });

  test('closed unlinks every group in the pull request, of each diagram, and each waits again', async () => {
    clock = START;
    const { space, erd } = erdProject();
    const items = itemTable(space);
    const first = edit(space, erd);
    const second = edit(space, items, { op: 'rename', element: 'REQ-001', name: 'Sign in' });
    const [one, two] = entries(space, 'reflect');
    await reportEdit(space, one, { event: 'opened', pull_request: link(33) });
    await reportEdit(space, two, { event: 'opened', pull_request: link(33) });
    const closed = await reportEdit(space, one, { event: 'closed' });
    assert.deepEqual([closed.status, closed.json.changed], [200, true]);
    assert.deepEqual([setRow(first).pull_request, setRow(second).pull_request], [null, null]);
    assert.deepEqual([(await readEdit(space, one)).state, (await readEdit(space, two)).state], ['waiting', 'waiting']);
    assert.deepEqual(entries(space, 'reflect'), [one, two]);
  });

  test('a closed pull request\'s change sets meet those accepted meanwhile: the older entry holds them all, the newer is withdrawn', async () => {
    clock = START;
    const { space, erd } = erdProject();
    const first = edit(space, erd);
    const [older] = entries(space, 'reflect');
    await reportEdit(space, older, { event: 'opened', pull_request: link(40) });
    // A change set accepted while the pull request is open starts a new entry (SPEC-026).
    const second = edit(space, erd, { op: 'add', element: 'TBL-170', name: 'tool_runs' });
    const [, newer] = entries(space, 'reflect');
    const closed = await reportEdit(space, older, { event: 'closed' });
    assert.deepEqual(closed.json.edit.change_sets, [idOf('np', first), idOf('np', second)]);
    assert.deepEqual(entries(space, 'reflect'), [older]);
    assert.equal(entryRow(newer).close_reason, 'withdrawn');
    // A report on the withdrawn entry gets change_set_state, with its change set's state.
    const refused = await reportEdit(space, newer, { event: 'opened', pull_request: link(41) });
    assert.deepEqual([refused.status, refused.json.code, refused.json.state], [409, 'change_set_state', 'accepted']);
  });

  test('a removal entry closes on any report of its change set\'s pull request, and another gets pull_request_mismatch (SPEC-023)', async () => {
    clock = START;
    const { space, erd } = erdProject();
    const pullRequest = s.pullRequest(space, { number: 50 });
    const cancelled = s.changeSet(space, erd, { state: 'cancelled', pullRequestId: pullRequest });
    const { entry } = removeFromPullRequest(db, { project: space.id, diagram: erd.id, changeSet: cancelled, time: TIME });
    const other = await reportEdit(space, entry, { event: 'opened', pull_request: link(51) });
    assert.deepEqual([other.status, other.json.code, other.json.pull_request], [409, 'pull_request_mismatch', link(50)]);

    clock = START + 5 * MINUTE;
    const removal = (more) => ({
      id: ne(entry), part: '', stage: '05-erd', diagram: idOf('dg', erd.id), task: 'remove', state: 'done', change_sets: [idOf('np', cancelled)],
      pull_request: link(50), commit: null, made_at: TIME, closed_at: at(clock), claim: null, ...more,
    });
    const done = await reportEdit(space, entry, { event: 'closed', pull_request: link(50) });
    assert.deepEqual(done.json, { edit: removal(), changed: true });
    // It leaves the pull request to its reflection's reports, and its claim is released as done.
    assert.equal(pullRow(space, 50).state, 'open');
    assert.deepEqual(claimsOf(entry), [{ session: S1, released: 'done', pull_request: null }]);
    // Reported again with its own pull request: changed false. Another: change_set_state, cancelled.
    for (const body of [{ event: 'merged' }, { event: 'opened', pull_request: link(50) }]) {
      const repeat = await reportEdit(space, entry, body);
      assert.deepEqual([repeat.status, repeat.json], [200, { edit: removal(), changed: false }]);
    }
    const refused = await reportEdit(space, entry, { event: 'merged', pull_request: link(52) });
    assert.deepEqual([refused.status, refused.json.code, refused.json.state], [409, 'change_set_state', 'cancelled']);
  });

  test('a late merge report resolves a decision already present in the held drawing', async () => {
    const space = s.project('late-record');
    const path = '/pictures/01-domain/nexus';
    const board = s.diagram(space, { stage: '01-domain', sourceKey: path, kind: 'ddd_board' });
    const text = 'The approved answer.';
    s.document(space, path, '01-domain', JSON.stringify({ format: 1, hotspots: [{ answer: text }] }));
    const thread = s.thread(board, { target: 'diagram', body: text });
    s.comment(thread, { body: text });
    db.prepare('UPDATE comments SET detail = ? WHERE thread_id = ? AND seq = 2').run(JSON.stringify({ link: link(97) }), thread);
    const pull = s.pullRequest(space, { number: 97 });
    const set = s.changeSet(space, board, { pullRequestId: pull });
    s.change(set, { op: 'rename', element: 'CTX-001', name: 'Example' });
    changeSetsChanged(db, { project: space.id, diagram: board.id, time: TIME });
    const [entry] = entries(space, 'reflect');
    const result = await reportEdit(space, entry, { event: 'reflected', pull_request: link(97), commit: space.commit });
    assert.equal(result.status, 200);
    assert.equal(rows('SELECT state FROM comment_threads WHERE id = ?', thread)[0].state, 'closed');
  });

  test('a reported merge resolves a proposal only when the drawing proves its change', async () => {
    const { space, erd } = erdProject();
    const thread = s.thread(erd, { elementKey: 'TBL-146' });
    const pullRequest = s.pullRequest(space, { number: 96 });
    const proposal = s.changeSet(space, erd, { origin: 'proposal', state: 'accepted', threadId: thread, pullRequestId: pullRequest });
    s.change(proposal, { op: 'rename', element: 'TBL-146', name: 'agent_credentials' });
    changeSetsChanged(db, { project: space.id, diagram: erd.id, time: TIME });
    const [entry] = entries(space, 'reflect');
    const result = await reportEdit(space, entry, { event: 'reflected', pull_request: link(96), commit: space.commit });
    assert.equal(result.status, 200);
    assert.equal(rows('SELECT state FROM comment_threads WHERE id = ?', thread)[0].state, 'closed');
    assert.equal(rows("SELECT event FROM thread_resolution_events WHERE thread_id = ?", thread)[0].event, 'resolved');
  });

  test('a merged document that lacks a change: reflected anyway, and one comment on the diagram says what is missing (SPEC-025, note 26)', async () => {
    clock = START;
    const { space, erd } = erdProject();
    s.elements(erd.drawing, [table('TBL-148', 'snapshots'), table('TBL-149', 'document_blobs')]);
    const pullRequest = s.pullRequest(space, { number: 93 });
    // The pull request was reported by another agent: the comment is that agent's, whose work the reflection is.
    const writer = s.credential();
    db.prepare('UPDATE pull_requests SET credential_id = ? WHERE id = ?').run(writer.key, pullRequest);
    const decided = (hour) => `2026-11-23T${String(hour).padStart(2, '0')}:00:00.000Z`;
    const made = (step, hour, options = {}) => {
      const id = s.changeSet(space, erd, { decidedAt: decided(hour), pullRequestId: pullRequest, ...options });
      for (const each of [step].flat()) s.change(id, each);
      return id;
    };
    // Accepted in this order; the rename of TBL-149 was then left by its removal, reflected before by another pull request.
    const renamedGone = made({ op: 'rename', element: 'TBL-149', name: 'blobs' }, 2);
    const removedBefore = made({ op: 'remove', element: 'TBL-149' }, 3, { pullRequestId: null });
    const renamed = made({ op: 'rename', element: 'TBL-146', name: 'agent_keys' }, 4);
    const asked = s.thread(erd, { elementKey: 'TBL-147' });
    const connected = made({ op: 'connect', element: 'TBL-147', target: 'TBL-146', name: 'owns' }, 5, { origin: 'proposal', state: 'accepted', threadId: asked });
    const added = made({ op: 'add', element: 'TBL-170', name: 'tool_runs' }, 6);
    const removed = made({ op: 'remove', element: 'TBL-147' }, 7);
    const shownRename = made({ op: 'rename', element: 'TBL-148', name: 'snapshot_rows' }, 8);
    // The merge commit's snapshot drew TBL-148's rename and TBL-149's removal, and nothing else of them.
    s.snapshot(space);
    const shown = s.drawing(space, erd.id);
    s.elements(shown, [table('TBL-146', 'agent_credentials'), table('TBL-147', 'project_spaces'), table('TBL-148', 'snapshot_rows')]);
    s.setChangeSet(removedBefore, { reflectedDrawing: shown });
    changeSetsChanged(db, { project: space.id, diagram: erd.id, time: TIME });
    const [entry] = entries(space, 'reflect');

    clock = START + 5 * MINUTE;
    const reflected = await reportEdit(space, entry, { event: 'reflected', pull_request: link(93), commit: space.commit });
    assert.deepEqual([reflected.status, reflected.json.edit.state, reflected.json.changed], [200, 'done', true]);
    for (const set of [renamedGone, renamed, connected, added, removed, shownRename]) {
      assert.deepEqual(setRow(set), { state: 'reflected', pull_request: 93, reflected_drawing: shown });
    }
    // One new thread on the diagram as a whole at that drawing, waiting on the owner as a question of the owner's
    // to-do. The connect is not said: TBL-147's removal, accepted after it, is in the same reflection.
    const [thread] = rows("SELECT id, target_kind, element_key, drawing_id, state, waits_on FROM comment_threads WHERE diagram_id = ? AND target_kind = 'diagram'", erd.id);
    assert.deepEqual({ ...thread, id: undefined }, { id: undefined, target_kind: 'diagram', element_key: null, drawing_id: shown, state: 'open', waits_on: 'owner' });
    assert.deepEqual(rows('SELECT seq, author, credential_id, body FROM comments WHERE thread_id = ?', thread.id), [{
      seq: 1, author: 'agent', credential_id: writer.key, body: [
        lacks(93),
        '- 직접 편집, 이름 바꾸기: TBL-149 document_blobs → blobs — 나중에 수락한 변경을 남겼어요: 직접 편집, 지우기: TBL-149 document_blobs',
        '- 직접 편집, 이름 바꾸기: TBL-146 agent_credentials → agent_keys',
        '- 직접 편집, 추가: TBL-170 tool_runs',
        '- 직접 편집, 지우기: TBL-147 project_spaces',
      ].join('\n'),
    }]);
    assert.ok(openEntries(db, space.id).some((each) => each.side === 'owner' && each.kind === 'question' && each.thread_id === Number(thread.id)));
    // The proposal's own thread stays open because the drawing does not prove its connection.
    assert.deepEqual(rows('SELECT state, closed_by FROM comment_threads WHERE id = ?', asked), [{ state: 'open', closed_by: null }]);
    assert.ok(closedEntries(db, space.id).some((each) => each.kind === 'reflect' && each.reason === 'done'));

    // A later step of the same change set replaces an earlier one: the drawing shows the rename, so nothing is missing.
    const third = erdProject();
    const both = s.changeSet(third.space, third.erd, { pullRequestId: s.pullRequest(third.space, { number: 95 }) });
    s.change(both, { op: 'add', element: 'TBL-171', name: 'tool_logs' });
    s.change(both, { op: 'rename', element: 'TBL-171', name: 'tool_events' });
    s.snapshot(third.space);
    const drawn = s.drawing(third.space, third.erd.id);
    s.elements(drawn, [table('TBL-146', 'agent_credentials'), table('TBL-147', 'project_spaces'), table('TBL-171', 'tool_events')]);
    changeSetsChanged(db, { project: third.space.id, diagram: third.erd.id, time: TIME });
    const [thirdEntry] = entries(third.space, 'reflect');
    const quiet = await reportEdit(third.space, thirdEntry, { event: 'reflected', commit: third.space.commit });
    assert.deepEqual([quiet.json.edit.state, setRow(both).state], ['done', 'reflected']);
    assert.deepEqual(rows("SELECT id FROM comment_threads WHERE diagram_id = ? AND target_kind = 'diagram'", third.erd.id), []);

    // A long list stays within a comment's 4,000 characters, and counts the changes it leaves out.
    const other = erdProject();
    const many = s.changeSet(other.space, other.erd, { pullRequestId: s.pullRequest(other.space, { number: 94 }) });
    for (let index = 0; index < 150; index += 1) s.change(many, { op: 'add', element: `TBL-${300 + index}`, name: `a_table_with_a_rather_long_name_${index}` });
    changeSetsChanged(db, { project: other.space.id, diagram: other.erd.id, time: TIME });
    const [otherEntry] = entries(other.space, 'reflect');
    await reportEdit(other.space, otherEntry, { event: 'reflected', commit: other.space.commit });
    const [{ body }] = rows(
      "SELECT c.body FROM comments c JOIN comment_threads h ON h.id = c.thread_id WHERE h.diagram_id = ? AND h.target_kind = 'diagram'", other.erd.id,
    );
    const lines = body.split('\n');
    assert.ok([...body].length <= LIMITS.textCharacters);
    assert.equal(lines[0], lacks(94));
    assert.equal(lines[1], '- 직접 편집, 추가: TBL-300 a_table_with_a_rather_long_name_0');
    const [, left] = /^- 그 밖의 변경 (\d+)개$/.exec(lines.at(-1));
    assert.equal(lines.length - 2 + Number(left), 150);
  });

  test('a record\'s pull request: opened links it, another open one is refused, closed unlinks it and merged records it (SPEC-031, SPEC-032)', async () => {
    clock = START;
    const { space, erd } = erdProject();
    const confirmation = confirmed(space, erd);
    const [entry] = entries(space, 'record_confirmation');
    const opened = await reportCheckpoint(space, confirmation, { event: 'opened', pull_request: link(60) });
    assert.deepEqual([opened.status, opened.json.changed, opened.json.checkpoint.record_state, opened.json.checkpoint.pull_request], [200, true, 'in_review', link(60)]);
    assert.equal(pullRow(space, 60).purpose, 'record');
    const again = await reportCheckpoint(space, confirmation, { event: 'opened', pull_request: link(60) });
    assert.deepEqual([again.status, again.json.changed], [200, false]);
    const other = await reportCheckpoint(space, confirmation, { event: 'opened', pull_request: link(61) });
    assert.deepEqual([other.status, other.json.code, other.json.pull_request], [409, 'pull_request_mismatch', link(60)]);
    const held = await reportCheckpoint(space, confirmation, { event: 'merged', pull_request: link(60) }, { session: S2 });
    assert.deepEqual([held.status, held.json.code, held.json.session], [409, 'claimed', S1]);

    // closed unlinks it, and the claim's 60 minutes start.
    clock = START + 10 * MINUTE;
    const closed = await reportCheckpoint(space, confirmation, { event: 'closed', pull_request: link(60) });
    assert.deepEqual([closed.json.changed, closed.json.checkpoint.record_state, closed.json.checkpoint.pull_request], [true, 'waiting', null]);
    assert.deepEqual(closed.json.checkpoint.claim, claimOf(nk(confirmation), { pullRequest: 60, ends: clock + 60 * MINUTE }));
    // Another pull request records it.
    clock = START + 20 * MINUTE;
    const next = await reportCheckpoint(space, confirmation, { event: 'opened', pull_request: link(61) });
    assert.deepEqual([next.json.changed, next.json.checkpoint.record_state, next.json.checkpoint.pull_request], [true, 'in_review', link(61)]);
    clock = START + 25 * MINUTE;
    const merged = await reportCheckpoint(space, confirmation, { event: 'merged', pull_request: link(61) });
    assert.deepEqual([merged.json.changed, merged.json.checkpoint.recorded_at, merged.json.checkpoint.record_state, merged.json.checkpoint.claim], [true, at(clock), 'recorded', null]);
    assert.deepEqual(confirmationRow(confirmation), { state: 'confirmed', recorded_at: at(clock), cancel_recorded_at: null, pull_request: 61 });
    assert.deepEqual(entryRow(entry), { closed_at: at(clock), close_reason: 'done' });
    assert.deepEqual(claimsOf(entry), [{ session: S1, released: 'done', pull_request: 61 }]);
    // The stage has passed: its one diagram has its recorded confirmation.
    assert.deepEqual(passesOf(space), [{ stage: '05-erd', passed_at: TIME, changed_at: null }]);
    // Nothing is due now: its pull request answers changed false, another pull_request_mismatch naming it.
    const repeat = await reportCheckpoint(space, confirmation, { event: 'opened', pull_request: link(61) });
    assert.deepEqual([repeat.status, repeat.json.changed], [200, false]);
    const late = await reportCheckpoint(space, confirmation, { event: 'merged', pull_request: link(62) });
    assert.deepEqual([late.status, late.json.code, late.json.pull_request], [409, 'pull_request_mismatch', link(61)]);

    // A confirmation invalidated before its record merged is recorded at its version and stays invalidated (SPEC-032).
    const second = erdProject();
    const old = confirmed(second.space, second.erd);
    s.invalidate(old, second.erd.drawing);
    confirmationsChanged(db, { project: second.space.id, diagram: second.erd.id, time: TIME });
    const kept = await reportCheckpoint(second.space, old, { event: 'merged', pull_request: link(62) });
    assert.deepEqual(
      [kept.json.changed, kept.json.checkpoint.state, kept.json.checkpoint.confirmation, kept.json.checkpoint.record_state],
      [true, 'passed', 'invalidated', 'recorded'],
    );
    assert.deepEqual(passesOf(second.space), []);
  });

  test('the cancel\'s record: merged marks it, and the passes that rested on the confirmation changed (SPEC-030)', async () => {
    clock = START;
    const { space, erd } = erdProject();
    const confirmation = s.confirm(space, erd, { at: '2026-11-22T00:00:00.000Z' });
    s.record(confirmation);
    const recordedBy = s.pullRequest(space, { number: 70, state: 'merged', purpose: 'record' });
    db.prepare('UPDATE confirmations SET record_pull_request_id = ? WHERE id = ?').run(recordedBy, confirmation);
    const before = s.pass(space, '05-erd', { passedAt: '2026-11-21T00:00:00.000Z' });
    const resting = s.pass(space, '05-erd', { passedAt: '2026-11-22T00:00:00.000Z' });
    const later = s.pass(space, '05-erd', { passedAt: '2026-11-23T02:00:00.000Z' });
    s.cancel(confirmation);
    confirmationsChanged(db, { project: space.id, diagram: erd.id, time: TIME });
    const [entry] = entries(space, 'record_cancel');
    // The record's own pull request reported again: changed false, the cancel's record still due.
    const repeat = await reportCheckpoint(space, confirmation, { event: 'merged', pull_request: link(70) });
    assert.deepEqual([repeat.status, repeat.json.changed, repeat.json.checkpoint.record_state], [200, false, 'waiting']);
    // Once a pull request for the cancel was opened and closed, the record's own pull request, or another merged by the
    // time of the cancel, still holds no record of the cancel.
    await reportCheckpoint(space, confirmation, { event: 'opened', pull_request: link(72) });
    await reportCheckpoint(space, confirmation, { event: 'closed', pull_request: link(72) });
    s.pullRequest(space, { number: 69, state: 'merged' });
    db.prepare("UPDATE pull_requests SET closed_at = '2026-11-22T12:00:00.000Z' WHERE project_id = ? AND number IN (69, 70)").run(space.id);
    for (const number of [70, 69]) {
      const old = await reportCheckpoint(space, confirmation, { event: 'merged', pull_request: link(number) });
      assert.deepEqual(
        [old.status, old.json.changed, old.json.checkpoint.record_state, confirmationRow(confirmation).cancel_recorded_at],
        [200, false, 'waiting', null],
      );
    }

    const opened = await reportCheckpoint(space, confirmation, { event: 'opened', pull_request: link(71) });
    assert.deepEqual([opened.json.changed, opened.json.checkpoint.record_state, opened.json.checkpoint.pull_request], [true, 'in_review', link(71)]);
    clock = START + 5 * MINUTE;
    const merged = await reportCheckpoint(space, confirmation, { event: 'merged', pull_request: link(71) });
    assert.deepEqual(merged.json, {
      checkpoint: {
        id: nk(confirmation), part: '', stage: '05-erd', diagram: idOf('dg', erd.id), drawing: idOf('dw', erd.drawing), version: space.commit,
        state: 'withdrawn', confirmation: 'cancelled', passed_at: '2026-11-22T00:00:00.000Z', withdrawn_at: TIME, recorded_at: TIME,
        cancel_recorded_at: at(clock), record_state: 'recorded', pull_request: link(71), claim: null,
      },
      changed: true,
    });
    assert.deepEqual(rows('SELECT id, changed_at FROM stage_passes WHERE project_id = ? ORDER BY id', space.id), [
      { id: before, changed_at: null }, { id: resting, changed_at: at(clock) }, { id: later, changed_at: null },
    ]);
    assert.deepEqual(entryRow(entry), { closed_at: at(clock), close_reason: 'done' });
    // Nothing is due now.
    const done = await reportCheckpoint(space, confirmation, { event: 'merged', pull_request: link(71) });
    assert.deepEqual([done.status, done.json.changed], [200, false]);
    const other = await reportCheckpoint(space, confirmation, { event: 'merged', pull_request: link(70) });
    assert.deepEqual([other.status, other.json.code, other.json.pull_request], [409, 'pull_request_mismatch', link(71)]);
  });

  test('a confirmation cancelled before its record merged answers confirmation_cancelled, and a merged record is kept so its cancel is recorded', async () => {
    clock = START;
    const { space, erd } = erdProject();
    const confirmation = confirmed(space, erd);
    await reportCheckpoint(space, confirmation, { event: 'opened', pull_request: link(80) });
    s.cancel(confirmation);
    confirmationsChanged(db, { project: space.id, diagram: erd.id, time: TIME });
    // opened and closed write nothing.
    let was = dump();
    for (const event of ['opened', 'closed']) {
      const refused = await reportCheckpoint(space, confirmation, { event, pull_request: link(80) });
      assert.deepEqual([refused.status, refused.json.code], [409, 'confirmation_cancelled']);
    }
    assert.equal(dump(), was);

    // merged: Git holds the record now, so it is marked recorded and the agent to-do gets recording the cancel
    // (SPEC-030), and the refusal keeps that write.
    // Another pull request than the open one linked gets pull_request_mismatch, and nothing is written.
    const other = await reportCheckpoint(space, confirmation, { event: 'merged', pull_request: link(81) });
    assert.deepEqual([other.status, other.json.code, other.json.pull_request], [409, 'pull_request_mismatch', link(80)]);
    assert.equal(dump(), was);

    clock = START + 5 * MINUTE;
    const key = `"${newId('nw')}"`;
    const merged = await reportCheckpoint(space, confirmation, { event: 'merged', pull_request: link(80) }, { key });
    assert.deepEqual([merged.status, merged.json.code, merged.json.detail], [409, 'confirmation_cancelled', 'the owner cancelled the confirmation; record the cancel']);
    assert.deepEqual(confirmationRow(confirmation), { state: 'cancelled', recorded_at: at(clock), cancel_recorded_at: null, pull_request: 80 });
    assert.equal(pullRow(space, 80).state, 'merged');
    assert.deepEqual(openEntries(db, space.id).filter((each) => each.side === 'agent'), [
      { side: 'agent', kind: 'record_cancel', diagram_id: erd.id, confirmation_id: confirmation },
    ]);
    // The same request key answers the same refusal and writes nothing more (rule 3).
    was = dump();
    clock = START + 6 * MINUTE;
    const lines = (await server.logged(0)).length;
    const repeat = await reportCheckpoint(space, confirmation, { event: 'merged', pull_request: link(80) }, { key });
    assert.deepEqual([repeat.status, repeat.json], [409, merged.json]);
    assert.equal(dump(), was);
    // Its log line names the refusal's code, as the first one's did.
    const line = (await server.logged(lines + 1)).at(-1);
    assert.deepEqual([line.action, line.status, line.code], ['reportCheckpoint', 409, 'confirmation_cancelled']);
    // Under another key, the same report is still of a confirmation cancelled before its record merged: the same
    // refusal, and nothing written, while the cancel's record is due.
    const again = await reportCheckpoint(space, confirmation, { event: 'merged', pull_request: link(80) });
    assert.deepEqual([again.status, again.json.code], [409, 'confirmation_cancelled']);
    assert.equal(dump(), was);
    assert.equal(openEntries(db, space.id).filter((each) => each.kind === 'record_cancel').length, 1);
  });

  test('one pull request may hold a reflection and a record, and its merge commit reflects the change sets whatever its first report was', async () => {
    clock = START;
    const { space, erd } = erdProject();
    const items = itemTable(space);
    const confirmation = confirmed(space, items);
    const set = edit(space, erd);
    const [entry] = entries(space, 'reflect');
    // The record reports pull request 100 first.
    await reportCheckpoint(space, confirmation, { event: 'opened', pull_request: link(100) });
    const opened = await reportEdit(space, entry, { event: 'opened', pull_request: link(100) });
    assert.deepEqual([opened.status, opened.json.changed, opened.json.edit.pull_request], [200, true, link(100)]);
    assert.equal(pullRow(space, 100).purpose, 'record');
    // The record's merge merges it for both.
    const recorded = await reportCheckpoint(space, confirmation, { event: 'merged', pull_request: link(100) });
    assert.equal(recorded.json.checkpoint.record_state, 'recorded');
    assert.equal((await readEdit(space, entry)).state, 'merged');
    const reflected = await reportEdit(space, entry, { event: 'reflected', commit: space.commit });
    assert.deepEqual([reflected.json.edit.state, setRow(set).state], ['done', 'reflected']);
  });

  test('a pull request the workshop reported for the domain document is refused, as the workshop refuses these (TASK-452)', async () => {
    clock = START;
    const { space, erd } = erdProject();
    const confirmation = confirmed(space, erd);
    edit(space, erd);
    const [entry] = entries(space, 'reflect');
    s.pullRequest(space, { number: 110, purpose: 'domain_document' });
    const was = dump();
    const reflection = await reportEdit(space, entry, { event: 'opened', pull_request: link(110) });
    const record = await reportCheckpoint(space, confirmation, { event: 'opened', pull_request: link(110) });
    for (const refused of [reflection, record]) {
      assert.deepEqual([refused.status, refused.json.code, refused.json.field], [400, 'invalid_request', 'pull_request']);
    }
    assert.equal(dump(), was);
  });

  test('a flow file\'s reflection and record name its part from the snapshot, as API-248 and API-249 read them', async () => {
    clock = START;
    const key = 'docs/03-user-flow/FL-001-put-a-project-on-nexus.md';
    const space = s.project(`flows-${randomBytes(3).toString('hex')}`, { parts: ['nexus'], pictures: [{ stage: '03-user-flow', key, part: 'nexus' }] });
    const flow = s.diagram(space, { stage: '03-user-flow', sourceKey: key, kind: 'user_flow', name: 'FL-001' });
    s.elements(flow.drawing, [{ key: 'A', kind: 'node', name: 'Push' }]);
    edit(space, flow, { op: 'rename', element: 'A', name: 'Push a snapshot' });
    const [entry] = entries(space, 'reflect');
    const confirmation = confirmed(space, flow);
    const reflection = await reportEdit(space, entry, { event: 'opened', pull_request: link(120) });
    assert.deepEqual([reflection.status, reflection.json.edit.part, reflection.json.edit.stage], [200, 'nexus', '03-user-flow']);
    assert.deepEqual(await readEdit(space, entry), { ...reflection.json.edit, claim: { ...reflection.json.edit.claim, mine: false } });
    const record = await reportCheckpoint(space, confirmation, { event: 'opened', pull_request: link(121) });
    assert.deepEqual([record.status, record.json.checkpoint.part, record.json.checkpoint.stage], [200, 'nexus', '03-user-flow']);
  });

  test('refuses a report that is not in its form, of another repository, or of an entry that is not there', async () => {
    clock = START;
    const { space, erd } = erdProject();
    edit(space, erd);
    const [entry] = entries(space, 'reflect');
    const confirmation = confirmed(space, itemTable(space));
    // A project that names no repository, and another project, with an entry and a confirmation each.
    const bare = erdProject(undefined, { repository: null });
    edit(bare.space, bare.erd);
    const [bareEntry] = entries(bare.space, 'reflect');
    const bareConfirmation = confirmed(bare.space, itemTable(bare.space));
    const other = erdProject();
    edit(other.space, other.erd);
    const [otherEntry] = entries(other.space, 'reflect');
    const otherConfirmation = confirmed(other.space, itemTable(other.space));
    const was = dump();
    const invalid = [
      ['reportEdit', entry, {}, 'event'],
      ['reportEdit', entry, { event: 'pushed' }, 'event'],
      ['reportEdit', entry, { event: 'needs-user' }, 'event'],
      ['reportEdit', entry, { event: 'opened', extra: SECRETISH }, 'body'],
      ['reportEdit', entry, { event: 'opened', pull_request: 'http://github.com/example/demo/pull/1' }, 'pull_request'],
      ['reportEdit', entry, { event: 'opened', pull_request: `${link(1)} ${SECRETISH}` }, 'pull_request'],
      ['reportEdit', entry, { event: 'opened', pull_request: `${REPOSITORY}/pull/${'1'.repeat(2000)}` }, 'pull_request'],
      ['reportEdit', entry, { event: 'opened', pull_request: 12 }, 'pull_request'],
      ['reportEdit', entry, { event: 'opened', pull_request: `${REPOSITORY}/issues/3` }, 'pull_request'],
      ['reportEdit', entry, { event: 'opened', pull_request: `${REPOSITORY}/pull/0` }, 'pull_request'],
      ['reportEdit', entry, { event: 'opened', pull_request: `${REPOSITORY}/pull/1234567890` }, 'pull_request'],
      ['reportEdit', entry, { event: 'opened', pull_request: `${REPOSITORY}/pull/12/files` }, 'pull_request'],
      ['reportEdit', entry, { event: 'reflected', pull_request: link(12) }, 'commit'],
      ['reportEdit', entry, { event: 'reflected', pull_request: link(12), commit: 'ABC' }, 'commit'],
      ['reportEdit', entry, { event: 'merged', commit: SECRETISH }, 'commit'],
      ['reportCheckpoint', confirmation, { event: 'opened' }, 'pull_request'],
      ['reportCheckpoint', confirmation, { event: 'reflected', pull_request: link(12) }, 'event'],
      ['reportCheckpoint', confirmation, { event: 'needs-user', pull_request: link(12) }, 'event'],
      ['reportCheckpoint', confirmation, { event: 'opened', pull_request: link(12), commit: sha() }, 'body'],
    ];
    for (const [action, id, body, field] of invalid) {
      const send = action === 'reportEdit' ? reportEdit : reportCheckpoint;
      const refused = await send(space, id, body);
      const where = `${action} ${JSON.stringify(body).slice(0, 80)}`;
      assert.deepEqual([refused.status, refused.json.code, refused.json.field], [400, 'invalid_request', field], where);
      assert.equal(refused.text.includes(SECRETISH), false, where);
    }
    // Every report needs its session label and its request key.
    for (const send of [(options) => reportEdit(space, entry, { event: 'opened', pull_request: link(12) }, options),
      (options) => reportCheckpoint(space, confirmation, { event: 'opened', pull_request: link(12) }, options)]) {
      for (const [options, field] of [[{ session: null }, 'Nexus-Session'], [{ session: 'has space' }, 'Nexus-Session'], [{ key: null }, 'Idempotency-Key']]) {
        const refused = await send(options);
        assert.deepEqual([refused.status, refused.json.code, refused.json.field], [400, 'invalid_request', field]);
        assert.equal(refused.text.includes('has space'), false);
      }
    }
    // Another repository's pull request, or any in a project that names no repository, gets repository_mismatch.
    const mismatches = [
      [reportEdit, space, entry, 'https://github.com/example/other/pull/1', "this is another repository than the project's"],
      [reportEdit, space, entry, 'https://github.com/example/demo-two/pull/1', "this is another repository than the project's"],
      [reportCheckpoint, space, confirmation, 'https://gitlab.com/example/demo/pull/1', "this is another repository than the project's"],
      [reportEdit, bare.space, bareEntry, link(1), 'the project names no repository'],
      [reportCheckpoint, bare.space, bareConfirmation, link(1), 'the project names no repository'],
    ];
    for (const [send, where, id, pullRequest, detail] of mismatches) {
      const refused = await send(where, id, { event: 'opened', pull_request: pullRequest });
      assert.deepEqual([refused.status, refused.json.code, refused.json.detail], [409, 'repository_mismatch', detail], pullRequest);
    }
    // Entries that are not there, of another project, or not a reflection or a record.
    const [confirmEntry] = entries(space, 'confirm');
    const body = { event: 'opened', pull_request: link(12) };
    assert.deepEqual((await reportEdit({ name: 'no-such-project' }, entry, body)).json.code, 'project_not_found');
    assert.deepEqual((await reportCheckpoint({ name: 'no-such-project' }, confirmation, body)).json.code, 'project_not_found');
    for (const id of [idOf('ne', 999_999), 'ne_x', otherEntry, confirmEntry]) {
      const missing = await reportEdit(space, id, body);
      assert.deepEqual([missing.status, missing.json.code], [404, 'edit_not_found'], String(id));
    }
    for (const id of [idOf('nk', 999_999), 'nk_x', otherConfirmation]) {
      const missing = await reportCheckpoint(space, id, body);
      assert.deepEqual([missing.status, missing.json.code], [404, 'checkpoint_not_found'], String(id));
    }
    assert.equal(dump(), was);
    // The repository's address is read without regard to case, with or without a closing slash.
    const cased = await reportEdit(space, entry, { event: 'opened', pull_request: 'https://GitHub.com/Example/Demo/pull/12/' });
    assert.deepEqual([cased.status, cased.json.edit.pull_request], [200, link(12)]);
  });

  test('a request key sent again answers the first answer and writes nothing; with another body it is refused (rule 3)', async () => {
    clock = START;
    const { space, erd } = erdProject();
    edit(space, erd);
    const [entry] = entries(space, 'reflect');
    const confirmation = confirmed(space, itemTable(space));
    for (const [send, id] of [[reportEdit, entry], [reportCheckpoint, confirmation]]) {
      const key = `"${newId('nw')}"`;
      const first = await send(space, id, { event: 'opened', pull_request: link(110) }, { key });
      const was = dump();
      const again = await send(space, id, { event: 'opened', pull_request: link(110) }, { key });
      assert.deepEqual([again.status, again.json], [first.status, first.json]);
      assert.equal(dump(), was);
      const reused = await send(space, id, { event: 'closed', pull_request: link(110) }, { key });
      assert.deepEqual([reused.status, reused.json.code], [409, 'request_key_reused']);
    }
  });

  test('refuses a body that is not JSON or too large', async () => {
    const { space, erd } = erdProject();
    edit(space, erd);
    const [entry] = entries(space, 'reflect');
    const confirmation = confirmed(space, itemTable(space));
    for (const [action, path] of [['reportEdit', editPath(space, entry)], ['reportCheckpoint', checkpointPath(space, confirmation)]]) {
      const typed = await write(action, path, null, { type: 'text/plain', raw: '{}' });
      assert.deepEqual([typed.status, typed.json.code], [415, 'json_required']);
      const headers = { ...s.agent.headers, 'Content-Type': 'application/json', 'Nexus-Session': S1, 'Idempotency-Key': `"${newId('nw')}"` };
      const { answers } = await exchange(server.port, [head('POST', path, { ...headers, 'Content-Length': 2 * MiB + 1 })]);
      assert.equal(answers.length, 1);
      responses.note(action, answers[0]);
      assert.deepEqual([answers[0].status, answers[0].json.code, answers[0].json.limit], [413, 'body_too_large', 2 * MiB]);
    }
  });

  test('a request without a live agent credential gets access_missing, and the owner\'s sign-in agent_only', async () => {
    const { space, erd } = erdProject();
    edit(space, erd);
    const [entry] = entries(space, 'reflect');
    const confirmation = confirmed(space, itemTable(space));
    const was = dump();
    for (const send of [(options) => reportEdit(space, entry, { event: 'opened', pull_request: link(1) }, options),
      (options) => reportCheckpoint(space, confirmation, { event: 'opened', pull_request: link(1) }, options)]) {
      const none = await send({ headers: {} });
      assert.deepEqual([none.status, none.json.code], [401, 'access_missing']);
      const owner = await send({ headers: { 'Cf-Access-Jwt-Assertion': local.token() } });
      assert.deepEqual([owner.status, owner.json.code], [403, 'agent_only']);
    }
    assert.equal(dump(), was);
  });

  test('answers internal when the store fails, and writes nothing', async (t) => {
    const store = testStore(t);
    const failing = seed(store);
    const space = failing.project('broken');
    const where = failing.diagram(space);
    failing.changeSet(space, where);
    changeSetsChanged(store, { project: space.id, diagram: where.id, time: TIME });
    const items = failing.diagram(space, { sourceKey: '/items/05-erd', kind: 'item_table', name: 'Items' });
    const confirmation = failing.confirm(space, items);
    confirmationsChanged(store, { project: space.id, diagram: items.id, time: TIME });
    const entry = Number(store.prepare("SELECT id FROM todos WHERE kind = 'reflect'").get().id);
    // A store whose pull requests cannot be written, as when the disk fails.
    const broken = new Proxy(store, {
      get(target, name) {
        const value = Reflect.get(target, name, target);
        if (name === 'prepare') {
          return (sql) => {
            if (sql.includes('INSERT INTO pull_requests')) throw new Error('the store failed');
            return target.prepare(sql);
          };
        }
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const other = await startServer({ store: broken, gate: local.gate, routes: ROUTES });
    t.after(() => other.close());
    const state = () => JSON.stringify(['pull_requests', 'change_sets', 'confirmations', 'todos', 'claims', 'request_keys']
      .map((name) => store.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all()));
    const was = state();
    const headers = { ...failing.agent.headers, 'Content-Type': 'application/json', 'Nexus-Session': S1 };
    for (const [action, path] of [
      ['reportEdit', `/api/spaces/broken/edits/${ne(entry)}/report`],
      ['reportCheckpoint', `/api/spaces/broken/checkpoints/${nk(confirmation)}/report`],
    ]) {
      const answer = responses.note(action, await other.send({
        method: 'POST', path, headers: { ...headers, 'Idempotency-Key': `"${newId('nw')}"` }, body: JSON.stringify({ event: 'opened', pull_request: link(5) }),
      }));
      assert.deepEqual([answer.status, answer.json.code], [500, 'internal']);
    }
    assert.equal(state(), was);
    assert.equal(other.logText().includes('the store failed'), false);
  });

  test('logs one line per request with its sender, and never a link, a commit, a session or the project\'s name (rule 5)', async () => {
    const name = `lima-${randomBytes(6).toString('hex')}`;
    const { space, erd } = erdProject(name);
    edit(space, erd);
    const [entry] = entries(space, 'reflect');
    const merge = sha();
    assert.equal((await reportEdit(space, entry, { event: 'reflected', pull_request: link(7), commit: merge })).status, 200);
    const lines = (await server.logged(20)).filter((line) => ACTIONS.includes(line.action));
    assert.ok(lines.length >= 20);
    for (const line of lines) {
      assert.match(line.traceId, TRACE_ID);
      assert.ok([s.agent.name, 'unknown', 'owner'].includes(line.sender), line.sender);
    }
    const text = server.logText();
    for (const value of [name, S1, S2, merge, 'github.com/example', SECRETISH, 'agent_keys', '반영됨', folder, folder.replaceAll('\\', '/'),
      JSON.stringify(folder).slice(1, -1)]) {
      assert.equal(text.includes(value), false, value);
    }
  });

  test('answer every response API-258 and API-259 list', () => {
    for (const action of ACTIONS) responses.assertEvery(action);
  });

  test('touch the tables their x-corthex.tables list, change only tables their spec rows feed, and admission only the layer\'s (note 23)', () => {
    checkTables(recorder, 'reportEdit');
    checkTables(recorder, 'reportCheckpoint');
    checkLayer(recorder);
  });
});
