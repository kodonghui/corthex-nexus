// Agent reads (TASK-436; API-244, API-246 to API-249, SPEC-013, SPEC-014, SPEC-016, SPEC-018, SPEC-024, SPEC-026,
// SPEC-031): TASK-436's done condition, every response the five operations list, each answer against the store's rows,
// with a closed reflection entry (Q1), a confirmation cancelled before its record (Q2) and a change set's reflection
// (Q3) as approved, the tables they touch (note 23) and their log lines. The rows are written straight into the store
// with test/seed.js and entries.js, as the push and the operations of other tasks would write them.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import {
  changeSetsChanged, confirmationsChanged, removalReported, removeFromPullRequest, threadChanged,
} from '../src/entries.js';
import { idOf } from '../src/ids.js';
import { removalPreview } from '../src/removal.js';
import { ROUTES } from '../src/routes.js';
import { openStore } from '../src/store.js';
import { agentTodo } from '../src/todo.js';
import { responseRecord } from './responses.js';
import { REPOSITORY, seed, TIME } from './seed.js';
import { localGate, startServer, testStore, TRACE_ID } from './support.js';
import { checkLayer, checkTables, recordTables } from './tables.js';

const MINUTE = 60 * 1000;
const at = (minutes) => new Date(Date.parse(TIME) + minutes * MINUTE).toISOString();
const START = Date.parse(at(10));
const NAME = 'space-under-read';
const S1 = 'claude-code-5b3c82';
const LINK = 'https://github.com/example/demo/pull/7';
const MERGE = 'a'.repeat(40);
const QUESTION = 'Is the claim step missing?';
const ANSWER = 'It is, after the push.';
const flow = (name) => `docs/03-user-flow/${name}.md`;
const pull = (number) => `${REPOSITORY}/pull/${number}`;
// The project's /snapshot document lists its file pictures with their part, so that a diagram's part is found.
const FILES = ['comment', 'gone', 'proposal', 'edits', 'reflect', 'withdraw', 'remove', 'record', 'early', 'invalid'];
const PICTURES = FILES.map((name) => ({ stage: '03-user-flow', key: flow(name), part: 'nexus' }));
const ACTIONS = ['getProjectData', 'getComment', 'getProposal', 'getEdit', 'getCheckpoint'];

describe('agent reads', () => {
  const responses = responseRecord();
  let folder;
  let db;
  let recorder;
  let local;
  let server;
  let s;
  let space;
  let other;
  let otherDiagram;
  let clock = START;

  const read = async (action, path, { headers = s.agent.headers } = {}) => (
    responses.note(action, await server.send({ method: 'GET', path, headers }))
  );
  const spacePath = (end, name = NAME) => `/api/spaces/${name}${end}`;
  const comment = (id, name) => read('getComment', spacePath(`/comments/${id}`, name));
  const proposal = (id, name) => read('getProposal', spacePath(`/proposals/${id}`, name));
  const edit = (id, name) => read('getEdit', spacePath(`/edits/${id}`, name));
  const checkpoint = (id, name) => read('getCheckpoint', spacePath(`/checkpoints/${id}`, name));

  // A diagram of one file of stage 03, whose part only the /snapshot document names: { id, drawing }.
  const fileDiagram = (name, options = {}) => s.diagram(space, { stage: '03-user-flow', sourceKey: flow(name), kind: 'user_flow', name, ...options });
  const where = (diagram) => ({ part: 'nexus', stage: '03-user-flow', diagram: idOf('dg', diagram.id) });
  // A comment with what TBL-156's detail keeps, as TASK-437 writes it.
  const entry = (thread, { author = 'agent', body, detail = {}, time = TIME }) => {
    const { seq } = db.prepare('SELECT coalesce(max(seq), 0) + 1 AS seq FROM comments WHERE thread_id = ?').get(thread);
    db.prepare('INSERT INTO comments (thread_id, seq, author, credential_id, body, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(thread, seq, author, author === 'agent' ? s.agent.key : null, body, JSON.stringify(detail), time);
  };
  const changed = (diagram) => changeSetsChanged(db, { project: space.id, diagram: diagram.id, time: TIME });
  const confirmations = (diagram) => confirmationsChanged(db, { project: space.id, diagram: diagram.id, time: TIME });
  // The newest entry of kind on the diagram, open or closed.
  const entryOf = (kind, diagram) => Number(db.prepare('SELECT id FROM todos WHERE kind = ? AND diagram_id = ? ORDER BY id DESC LIMIT 1')
    .get(kind, diagram.id).id);
  const closeReason = (todo) => db.prepare('SELECT close_reason FROM todos WHERE id = ?').get(todo).close_reason;
  const merge = (pr, commit = null) => db.prepare("UPDATE pull_requests SET state = 'merged', closed_at = ?, merge_commit = ? WHERE id = ?")
    .run(TIME, commit, pr);
  // The live claim S1 holds of an entry, as these reads answer it.
  const claimed = (entryId) => ({
    entry: entryId, session: S1, mine: false, claimed_at: TIME, last_write_at: TIME, ends_at: at(60), pull_request: null,
  });

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-reads-'));
    ({ db } = openStore(folder));
    recorder = recordTables(db);
    local = localGate();
    server = await startServer({ store: recorder.store, gate: local.gate, now: () => clock, routes: ROUTES });
    s = seed(db);
    space = s.project(NAME, { parts: ['nexus'], pictures: PICTURES });
    other = s.project('another-space');
    otherDiagram = s.diagram(other);
  });

  after(async () => {
    await server.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  test('API-244 answers what deleting the space removes, the same preview API-277 gives the owner (SPEC-013)', async () => {
    const erd = s.diagram(space, { sourceKey: '/pictures/05-erd/nexus' });
    s.thread(erd);
    s.changeSet(space, erd);
    s.confirm(space, erd);
    s.toolLink(space);
    s.workshop(space);
    const answer = await read('getProjectData', spacePath('/data'));
    assert.equal(answer.status, 200);
    const owner = await server.send({ method: 'GET', path: `/api/projects/${NAME}/removal`, headers: { 'Cf-Access-Jwt-Assertion': local.token() } });
    assert.equal(owner.status, 200);
    assert.deepEqual(answer.json, owner.json);
    assert.deepEqual(answer.json, removalPreview(db, NAME));
    assert.deepEqual([answer.json.project, answer.json.revision, answer.json.commit], [NAME, 1, space.commit]);
    assert.deepEqual([answer.json.deletes.threads, answer.json.deletes.tool_links, answer.json.deletes.workshops], [1, 1, 1]);
    // Another project's rows are not counted, and a name no space has is project_not_found.
    assert.equal(answer.json.deletes.diagrams, 1);
    const missing = await read('getProjectData', spacePath('/data', 'no-such-space'));
    assert.deepEqual([missing.status, missing.json.code], [404, 'project_not_found']);
  });

  test('API-246 answers a thread with every entry in order and the change sets that answer it (SPEC-016)', async () => {
    const diagram = fileDiagram('comment');
    const thread = s.thread(diagram, { elementKey: 'FL-001', body: QUESTION });
    entry(thread, { body: ANSWER, detail: { quote: 'Push a snapshot', asks: 'recommended', look_first: 'FL-002' }, time: at(1) });
    entry(thread, { body: LINK, detail: { link: LINK }, time: at(2) });
    const first = s.changeSet(space, diagram, { origin: 'proposal', threadId: thread });
    const second = s.changeSet(space, diagram, { origin: 'proposal', threadId: thread });
    const answer = await comment(idOf('nc', thread));
    assert.equal(answer.status, 200);
    assert.deepEqual(answer.json, {
      id: idOf('nc', thread),
      ...where(diagram),
      drawing: idOf('dw', diagram.drawing),
      version: space.commit,
      item: 'FL-001',
      target: 'element',
      element: 'FL-001',
      removed_name: null,
      state: 'open',
      waits_on: 'agent',
      closed_by: null,
      opened_at: TIME,
      closed_at: null,
      last_at: at(2),
      entries: [
        { seq: 1, author: 'owner', kind: 'comment', text: QUESTION, made_at: TIME },
        { seq: 2, author: 'agent', kind: 'comment', text: ANSWER, quote: 'Push a snapshot', asks: 'recommended', look_first: 'FL-002', made_at: at(1) },
        { seq: 3, author: 'agent', kind: 'decision', text: LINK, link: LINK, made_at: at(2) },
      ],
      change_sets: [idOf('np', first), idOf('np', second)],
    });

    // A closed thread of a removed diagram is still read (SPEC-027), moved to the diagram with its element's last name.
    const gone = fileDiagram('gone', { removed: true });
    const moved = s.thread(gone, { target: 'diagram' });
    db.prepare("UPDATE comment_threads SET element_key = 'FL-009', removed_name = 'Old step' WHERE id = ?").run(moved);
    s.closeThread(moved);
    const closed = await comment(idOf('nc', moved));
    assert.equal(closed.status, 200);
    assert.deepEqual(
      [closed.json.diagram, closed.json.item, closed.json.target, closed.json.element, closed.json.removed_name],
      [idOf('dg', gone.id), '', 'diagram', 'FL-009', 'Old step'],
    );
    assert.deepEqual([closed.json.state, closed.json.waits_on, closed.json.closed_by, closed.json.closed_at], ['closed', null, 'owner', TIME]);

    // A row of an item table has no part; a stage's picture names its part in its source.
    const items = s.diagram(space, { stage: '02-prd', sourceKey: '/items/02-prd', kind: 'item_table', name: 'Requirements' });
    const row = await comment(idOf('nc', s.thread(items, { target: 'row', elementKey: 'REQ-020' })));
    assert.deepEqual([row.json.part, row.json.stage, row.json.item, row.json.target], ['', '02-prd', 'REQ-020', 'row']);
    const picture = s.diagram(space, { stage: '07-sitemap', sourceKey: '/pictures/07-sitemap/nexus', kind: 'sitemap', name: 'Sitemap' });
    const onPicture = await comment(idOf('nc', s.thread(picture, { elementKey: 'SCR-145' })));
    assert.deepEqual([onPicture.json.part, onPicture.json.stage], ['nexus', '07-sitemap']);

    // The change sets that answer a thread: the first 200, oldest first.
    const many = s.thread(diagram, { target: 'diagram' });
    const made = Array.from({ length: 201 }, () => s.changeSet(space, diagram, { origin: 'proposal', threadId: many }));
    const capped = await comment(idOf('nc', many));
    assert.deepEqual(capped.json.change_sets, made.slice(0, 200).map((key) => idOf('np', key)));

    // Another project's thread, a thread no row has and a malformed ID are comment_not_found; a project no space has
    // is project_not_found.
    const elsewhere = s.thread(otherDiagram);
    for (const id of [idOf('nc', elsewhere), idOf('nc', 999999), 'nc_not-an-id']) {
      const missing = await comment(id);
      assert.deepEqual([missing.status, missing.json.code], [404, 'comment_not_found']);
    }
    const noSpace = await comment(idOf('nc', thread), 'no-such-space');
    assert.deepEqual([noSpace.status, noSpace.json.code], [404, 'project_not_found']);
  });

  test('API-247 answers a change set with its proposal, its changes and the reflection entry it reads back in (SPEC-018, Q3)', async () => {
    const diagram = fileDiagram('proposal');
    const thread = s.thread(diagram);
    const sent = s.changeSet(space, diagram, { origin: 'proposal', threadId: thread });
    // TBL-158's detail keeps the proposal as the hub sends it, under ProposalRequest's names.
    const detail = {
      part: 'nexus', stage: '03-user-flow', items: ['FL-001', 'FL-002'], adds: ['FL-010'], reason: 'The flow misses a step.',
      change: 'Add the claim step after the push.', source_text: '# Push flow\n',
    };
    db.prepare('UPDATE change_sets SET detail = ? WHERE id = ?').run(JSON.stringify(detail), sent);
    const step = db.prepare('INSERT INTO changes (change_set_id, seq, op, element_key, new_name, target_key) VALUES (?, ?, ?, ?, ?, ?)');
    step.run(sent, 1, 'rename', 'FL-001', 'Push a snapshot again', null);
    step.run(sent, 2, 'add', 'FL-010', 'Claim an entry', null);
    step.run(sent, 3, 'connect', 'FL-001', null, 'FL-010');
    step.run(sent, 4, 'remove', 'FL-003', null, null);
    const answer = await proposal(idOf('np', sent));
    assert.equal(answer.status, 200);
    assert.deepEqual(answer.json, {
      id: idOf('np', sent),
      ...where(diagram),
      drawing: idOf('dw', diagram.drawing),
      version: space.commit,
      origin: 'proposal',
      thread: idOf('nc', thread),
      state: 'proposed',
      items: ['FL-001', 'FL-002'],
      adds: ['FL-010'],
      reason: 'The flow misses a step.',
      change: 'Add the claim step after the push.',
      source_text: true,
      changes: [
        { op: 'rename', element: 'FL-001', name: 'Push a snapshot again', target: null },
        { op: 'add', element: 'FL-010', name: 'Claim an entry', target: null },
        { op: 'connect', element: 'FL-001', name: null, target: 'FL-010' },
        { op: 'remove', element: 'FL-003', name: null, target: null },
      ],
      made_at: TIME,
      decided_at: null,
      reflection: null,
      pull_request: null,
    });
    // Rejected, it is decided and has no reflection; a detail member out of the contract's form is left out.
    db.prepare("UPDATE change_sets SET state = 'rejected', decided_at = ?, detail = ? WHERE id = ?")
      .run(at(3), JSON.stringify({ items: ['FL-001', 'not an ID', 'FL-001', 7], reason: 5 }), sent);
    const rejected = await proposal(idOf('np', sent));
    assert.deepEqual(
      [rejected.json.state, rejected.json.decided_at, rejected.json.reflection, rejected.json.items, rejected.json.adds, rejected.json.reason],
      ['rejected', at(3), null, ['FL-001'], [], null],
    );

    // A direct edit has none of a proposal's members. Accepted, it reads back in the open reflection entry that holds
    // it; in a pull request, in the same entry with the link; reflected, in that entry closed as done.
    const edits = fileDiagram('edits');
    const made = s.changeSet(space, edits);
    changed(edits);
    const reflect = entryOf('reflect', edits);
    const accepted = await proposal(idOf('np', made));
    assert.deepEqual(
      [accepted.json.origin, accepted.json.thread, accepted.json.state, accepted.json.items, accepted.json.adds,
        accepted.json.reason, accepted.json.change, accepted.json.source_text, accepted.json.changes, accepted.json.reflection,
        accepted.json.pull_request],
      ['direct_edit', null, 'accepted', [], [], null, null, false, [], idOf('ne', reflect), null],
    );
    const pr = s.pullRequest(space, { number: 21 });
    s.setChangeSet(made, { pullRequestId: pr });
    changed(edits);
    const linked = await proposal(idOf('np', made));
    assert.deepEqual([linked.json.reflection, linked.json.pull_request], [idOf('ne', reflect), pull(21)]);
    s.setChangeSet(made, { reflectedDrawing: edits.drawing });
    merge(pr, MERGE);
    changed(edits);
    assert.equal(closeReason(reflect), 'done');
    const reflected = await proposal(idOf('np', made));
    assert.deepEqual([reflected.json.state, reflected.json.reflection, reflected.json.pull_request], ['reflected', idOf('ne', reflect), pull(21)]);

    // Cancelled in an open pull request, it reads back in the removal entry that takes it out, open or done; cancelled
    // outside a pull request, in none.
    const inPull = s.changeSet(space, edits);
    const pr22 = s.pullRequest(space, { number: 22 });
    s.setChangeSet(inPull, { pullRequestId: pr22 });
    changed(edits);
    s.setChangeSet(inPull, { state: 'cancelled' });
    const { entry: removal } = removeFromPullRequest(db, { project: space.id, diagram: edits.id, changeSet: inPull, time: TIME });
    changed(edits);
    const cancelled = await proposal(idOf('np', inPull));
    assert.deepEqual([cancelled.json.state, cancelled.json.reflection, cancelled.json.pull_request], ['cancelled', idOf('ne', removal), pull(22)]);
    removalReported(db, { project: space.id, entry: removal, time: TIME });
    assert.equal((await proposal(idOf('np', inPull))).json.reflection, idOf('ne', removal));
    const outside = s.changeSet(space, edits);
    changed(edits);
    s.setChangeSet(outside, { state: 'cancelled' });
    changed(edits);
    assert.equal((await proposal(idOf('np', outside))).json.reflection, null);

    // Reflected in another pull request, it reads back in that pull request's reflection, not the first one's.
    const later = s.changeSet(space, edits);
    const pr23 = s.pullRequest(space, { number: 23 });
    s.setChangeSet(later, { pullRequestId: pr23 });
    changed(edits);
    const second = entryOf('reflect', edits);
    s.setChangeSet(later, { reflectedDrawing: edits.drawing });
    merge(pr23, 'b'.repeat(40));
    changed(edits);
    assert.notEqual(second, reflect);
    assert.equal((await proposal(idOf('np', later))).json.reflection, idOf('ne', second));
    assert.equal((await proposal(idOf('np', made))).json.reflection, idOf('ne', reflect));

    // A group of more than 200: an entry lists its first 200, so a change set past them names no entry.
    const crowded = s.diagram(space, { stage: '01-domain', sourceKey: '/pictures/01-domain/nexus', kind: 'ddd_board', name: 'DDD board' });
    const crowd = Array.from({ length: 201 }, () => s.changeSet(space, crowded));
    changed(crowded);
    const group = entryOf('reflect', crowded);
    assert.equal((await proposal(idOf('np', crowd[199]))).json.reflection, idOf('ne', group));
    assert.equal((await proposal(idOf('np', crowd[200]))).json.reflection, null);
    assert.deepEqual((await edit(idOf('ne', group))).json.change_sets, crowd.slice(0, 200).map((key) => idOf('np', key)));

    // Each reflection named reads back with the change set in it (Q1, Q3).
    for (const key of [made, inPull, later]) {
      const named = (await proposal(idOf('np', key))).json.reflection;
      assert.ok((await edit(named)).json.change_sets.includes(idOf('np', key)), named);
    }

    for (const id of [idOf('np', s.changeSet(other, otherDiagram)), idOf('np', 999999), 'np_not-an-id']) {
      const missing = await proposal(id);
      assert.deepEqual([missing.status, missing.json.code], [404, 'proposal_not_found']);
    }
    const noSpace = await proposal(idOf('np', sent), 'no-such-space');
    assert.deepEqual([noSpace.status, noSpace.json.code], [404, 'project_not_found']);
  });

  test('API-248 answers a reflection entry, open or closed, with the change sets it can still name (SPEC-024, SPEC-026, Q1)', async () => {
    const diagram = fileDiagram('reflect');
    const first = s.changeSet(space, diagram);
    const second = s.changeSet(space, diagram);
    changed(diagram);
    const reflect = entryOf('reflect', diagram);
    s.claim(space, reflect, { session: S1 });
    const id = idOf('ne', reflect);
    const waiting = await edit(id);
    assert.equal(waiting.status, 200);
    assert.deepEqual(waiting.json, {
      id,
      ...where(diagram),
      task: 'reflect',
      state: 'waiting',
      change_sets: [idOf('np', first), idOf('np', second)],
      pull_request: null,
      commit: null,
      made_at: TIME,
      closed_at: null,
      // These reads take no session, so a claim is never mine.
      claim: claimed(id),
    });

    // Its state follows its pull request, as API-258's reports set it: open, merged, and merged with its commit.
    const pr = s.pullRequest(space, { number: 31 });
    for (const key of [first, second]) s.setChangeSet(key, { pullRequestId: pr });
    changed(diagram);
    const states = [];
    const read31 = async () => {
      const { json } = await edit(id);
      states.push([json.state, json.pull_request, json.commit]);
    };
    await read31();
    merge(pr);
    await read31();
    merge(pr, MERGE);
    await read31();
    assert.deepEqual(states, [['in_review', pull(31), null], ['merged', pull(31), null], ['reported', pull(31), MERGE]]);

    // Closed as done, it lists the diagram's change sets reflected in its anchor's pull request, and has no claim.
    for (const key of [first, second]) s.setChangeSet(key, { reflectedDrawing: diagram.drawing });
    changed(diagram);
    const done = await edit(id);
    assert.deepEqual(
      [done.json.state, done.json.change_sets, done.json.pull_request, done.json.commit, done.json.closed_at, done.json.claim],
      ['done', [idOf('np', first), idOf('np', second)], pull(31), MERGE, TIME, null],
    );

    // Withdrawn, it lists its anchor.
    const withdraw = fileDiagram('withdraw');
    const lone = s.changeSet(space, withdraw);
    changed(withdraw);
    const left = entryOf('reflect', withdraw);
    s.setChangeSet(lone, { state: 'cancelled' });
    changed(withdraw);
    assert.equal(closeReason(left), 'withdrawn');
    const withdrawn = await edit(idOf('ne', left));
    assert.deepEqual(
      [withdrawn.json.state, withdrawn.json.change_sets, withdrawn.json.pull_request, withdrawn.json.closed_at],
      ['withdrawn', [idOf('np', lone)], null, TIME],
    );

    // A removal entry lists its anchor, open in its pull request's review and done once reported.
    const removeDiagram = fileDiagram('remove');
    const taken = s.changeSet(space, removeDiagram);
    const pr32 = s.pullRequest(space, { number: 32 });
    s.setChangeSet(taken, { pullRequestId: pr32 });
    changed(removeDiagram);
    s.setChangeSet(taken, { state: 'cancelled' });
    const { entry: removal } = removeFromPullRequest(db, { project: space.id, diagram: removeDiagram.id, changeSet: taken, time: TIME });
    changed(removeDiagram);
    const open = await edit(idOf('ne', removal));
    assert.deepEqual(
      [open.json.task, open.json.state, open.json.change_sets, open.json.pull_request, open.json.closed_at],
      ['remove', 'in_review', [idOf('np', taken)], pull(32), null],
    );
    removalReported(db, { project: space.id, entry: removal, time: TIME });
    const reported = await edit(idOf('ne', removal));
    assert.deepEqual([reported.json.state, reported.json.change_sets, reported.json.closed_at], ['done', [idOf('np', taken)], TIME]);

    // An entry of another kind, another project's entry, an ID no row has and a malformed one are edit_not_found.
    threadChanged(db, { project: space.id, thread: s.thread(diagram), time: TIME });
    const commentEntry = entryOf('comment', diagram);
    s.changeSet(other, otherDiagram);
    changeSetsChanged(db, { project: other.id, diagram: otherDiagram.id, time: TIME });
    const elsewhere = Number(db.prepare("SELECT id FROM todos WHERE project_id = ? AND kind = 'reflect'").get(other.id).id);
    for (const missing of [idOf('ne', commentEntry), idOf('ne', elsewhere), idOf('ne', 999999), 'ne_not-an-id']) {
      const answer = await edit(missing);
      assert.deepEqual([answer.status, answer.json.code], [404, 'edit_not_found'], missing);
    }
    const noSpace = await edit(id, 'no-such-space');
    assert.deepEqual([noSpace.status, noSpace.json.code], [404, 'project_not_found']);
  });

  test('API-249 answers a confirmation and how far its record got (SPEC-031, Q2)', async () => {
    const diagram = fileDiagram('record');
    const confirmation = s.confirm(space, diagram, { at: at(1) });
    confirmations(diagram);
    const recordEntry = entryOf('record_confirmation', diagram);
    s.claim(space, recordEntry, { session: S1 });
    const id = idOf('nk', confirmation);
    const waiting = await checkpoint(id);
    assert.equal(waiting.status, 200);
    assert.deepEqual(waiting.json, {
      id,
      ...where(diagram),
      drawing: idOf('dw', diagram.drawing),
      version: space.commit,
      state: 'passed',
      confirmation: 'confirmed',
      passed_at: at(1),
      withdrawn_at: null,
      recorded_at: null,
      cancel_recorded_at: null,
      record_state: 'waiting',
      pull_request: null,
      claim: claimed(id),
    });

    // Its record's pull request open, the record is in review; merged and recorded, it is recorded and has no claim.
    const pr = s.pullRequest(space, { number: 41, purpose: 'record' });
    db.prepare('UPDATE confirmations SET record_pull_request_id = ? WHERE id = ?').run(pr, confirmation);
    const review = await checkpoint(id);
    assert.deepEqual([review.json.record_state, review.json.pull_request], ['in_review', pull(41)]);
    merge(pr);
    s.record(confirmation);
    confirmations(diagram);
    const recorded = await checkpoint(id);
    assert.deepEqual([recorded.json.record_state, recorded.json.recorded_at, recorded.json.claim], ['recorded', TIME, null]);

    // Cancelled after its record, it is withdrawn and its cancel's record is the one due, with that entry's claim.
    s.cancel(confirmation);
    confirmations(diagram);
    const cancelEntry = entryOf('record_cancel', diagram);
    s.claim(space, cancelEntry, { session: S1 });
    const cancel = await checkpoint(id);
    assert.deepEqual(
      [cancel.json.state, cancel.json.confirmation, cancel.json.withdrawn_at, cancel.json.recorded_at, cancel.json.record_state, cancel.json.claim],
      ['withdrawn', 'cancelled', TIME, TIME, 'waiting', claimed(id)],
    );
    s.recordCancel(confirmation);
    confirmations(diagram);
    const cancelRecorded = await checkpoint(id);
    assert.deepEqual(
      [cancelRecorded.json.record_state, cancelRecorded.json.cancel_recorded_at, cancelRecorded.json.claim],
      ['recorded', TIME, null],
    );

    // Q2: cancelled before its record, it is withdrawn with nothing recorded and record_state waiting, even while its
    // record's pull request is open, and the agent to-do lists it no more.
    const early = fileDiagram('early');
    const unrecorded = s.confirm(space, early);
    confirmations(early);
    const pr42 = s.pullRequest(space, { number: 42, purpose: 'record' });
    db.prepare('UPDATE confirmations SET record_pull_request_id = ? WHERE id = ?').run(pr42, unrecorded);
    assert.equal((await checkpoint(idOf('nk', unrecorded))).json.record_state, 'in_review');
    s.cancel(unrecorded);
    confirmations(early);
    const withdrawn = await checkpoint(idOf('nk', unrecorded));
    assert.deepEqual(
      [withdrawn.json.state, withdrawn.json.confirmation, withdrawn.json.withdrawn_at, withdrawn.json.recorded_at,
        withdrawn.json.record_state, withdrawn.json.pull_request, withdrawn.json.claim],
      ['withdrawn', 'cancelled', TIME, null, 'waiting', pull(42), null],
    );
    const listed = agentTodo(db, { name: NAME, now: clock }).checkpoints.entries.map((each) => each.id);
    assert.equal(listed.includes(idOf('nk', unrecorded)), false);

    // An invalidated confirmation still passed at its version and waits for its record (SPEC-032).
    const invalid = fileDiagram('invalid');
    const old = s.confirm(space, invalid);
    // The next snapshot draws it again.
    s.snapshot(space, { parts: ['nexus'], pictures: PICTURES });
    s.invalidate(old, s.drawing(space, invalid.id));
    confirmations(invalid);
    const invalidated = await checkpoint(idOf('nk', old));
    assert.deepEqual(
      [invalidated.json.state, invalidated.json.confirmation, invalidated.json.drawing, invalidated.json.withdrawn_at, invalidated.json.record_state],
      ['passed', 'invalidated', idOf('dw', invalid.drawing), null, 'waiting'],
    );

    for (const missing of [idOf('nk', s.confirm(other, otherDiagram)), idOf('nk', 999999), 'nk_not-an-id']) {
      const answer = await checkpoint(missing);
      assert.deepEqual([answer.status, answer.json.code], [404, 'checkpoint_not_found'], missing);
    }
    const noSpace = await checkpoint(id, 'no-such-space');
    assert.deepEqual([noSpace.status, noSpace.json.code], [404, 'project_not_found']);
  });

  test('a request without a live agent credential gets access_missing, and the owner\'s sign-in agent_only', async () => {
    const paths = [
      ['getProjectData', spacePath('/data')],
      ['getComment', spacePath(`/comments/${idOf('nc', 1)}`)],
      ['getProposal', spacePath(`/proposals/${idOf('np', 1)}`)],
      ['getEdit', spacePath(`/edits/${idOf('ne', 1)}`)],
      ['getCheckpoint', spacePath(`/checkpoints/${idOf('nk', 1)}`)],
    ];
    for (const [action, path] of paths) {
      const none = await read(action, path, { headers: {} });
      assert.deepEqual([none.status, none.json.code], [401, 'access_missing']);
      const owner = await read(action, path, { headers: { 'Cf-Access-Jwt-Assertion': local.token() } });
      assert.deepEqual([owner.status, owner.json.code], [403, 'agent_only']);
    }
  });

  test('answers internal when the store fails', async (t) => {
    const store = testStore(t);
    const failing = seed(store);
    failing.project('broken');
    // A store whose read statements cannot be prepared, as when the disk fails.
    const failingStore = new Proxy(store, {
      get(target, name) {
        const value = Reflect.get(target, name, target);
        if (name === 'prepare') {
          return (sql) => {
            if (sql.includes('AS to_record') || sql.includes('FROM changes WHERE change_set_id')) throw new Error('the store failed');
            return target.prepare(sql);
          };
        }
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const other = await startServer({ store: failingStore, gate: local.gate, routes: ROUTES });
    t.after(() => other.close());
    const sent = [
      ['getProjectData', '/api/spaces/broken/data'],
      ['getComment', `/api/spaces/broken/comments/${idOf('nc', 1)}`],
      ['getProposal', `/api/spaces/broken/proposals/${idOf('np', 1)}`],
      ['getEdit', `/api/spaces/broken/edits/${idOf('ne', 1)}`],
      ['getCheckpoint', `/api/spaces/broken/checkpoints/${idOf('nk', 1)}`],
    ];
    for (const [action, path] of sent) {
      const answer = responses.note(action, await other.send({ method: 'GET', path, headers: failing.agent.headers }));
      assert.deepEqual([answer.status, answer.json.code], [500, 'internal']);
    }
    const lines = await other.logged(5);
    assert.deepEqual(lines.map((line) => line.error), ['Error', 'Error', 'Error', 'Error', 'Error']);
    assert.equal(other.logText().includes('the store failed'), false);
  });

  test('logs one line per request with its sender, and never a text, a session, a link, the space or the data folder (rule 5)', async () => {
    const lines = (await server.logged(40)).filter((line) => ACTIONS.includes(line.action));
    assert.ok(lines.length >= 40);
    for (const line of lines) {
      assert.match(line.traceId, TRACE_ID);
      assert.ok([s.agent.name, 'unknown', 'owner'].includes(line.sender));
    }
    const text = server.logText();
    for (const value of [S1, LINK, QUESTION, ANSWER, 'Old step', 'The flow misses a step.', NAME, folder, folder.replaceAll('\\', '/'),
      JSON.stringify(folder).slice(1, -1)]) {
      assert.equal(text.includes(value), false, value);
    }
  });

  test('answer every response API-244, API-246, API-247, API-248 and API-249 list', () => {
    for (const action of ACTIONS) responses.assertEvery(action);
  });

  test('touch the tables their x-corthex.tables list and change none, and admission only the layer\'s (note 23)', () => {
    checkTables(recorder, 'getProjectData');
    checkTables(recorder, 'getComment');
    checkTables(recorder, 'getProposal');
    checkTables(recorder, 'getEdit');
    checkTables(recorder, 'getCheckpoint');
    for (const action of ACTIONS) assert.deepEqual([...recorder.changed(action)], [], action);
    checkLayer(recorder);
  });
});
