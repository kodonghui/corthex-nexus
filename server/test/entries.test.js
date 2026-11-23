// To-do entries (TASK-433): each kind of entry appears and leaves when done, one reflection entry holds every waiting
// change set of a diagram (SPEC-026), and a removed diagram puts nothing on the owner's to-do (note 4 of the WBS).
// Each test sets up the fewest rows the store allows with test/seed.js and reads the entries in TBL-166 and in the
// agent to-do (API-245's answer, src/todo.js).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  changeSetsChanged, confirmationsChanged, heldChangeSets, openAgentEntry, removalReported, removeFromPullRequest,
  stepsChanged, threadChanged,
} from '../src/entries.js';
import { idOf } from '../src/ids.js';
import { agentTodo } from '../src/todo.js';
import { closedEntries, openEntries, REPOSITORY, seed, TIME } from './seed.js';
import { testStore } from './support.js';

const NOW = Date.parse(TIME);
const LATER = '2026-11-23T02:00:00.000Z';

// The agent to-do of a project, read as API-245 reads it.
const todoOf = (db, space, session = null) => agentTodo(db, { name: space.name, session, now: NOW });

test('a thread waits on one side at a time, and a closed thread on neither (SPEC-016, SPEC-017, SPEC-028)', (t) => {
  const db = testStore(t);
  const s = seed(db);
  const space = s.project();
  const erd = s.diagram(space);
  const thread = s.thread(erd, { author: 'owner' });

  // The owner's comment waits on the agent.
  assert.deepEqual(threadChanged(db, { project: space.id, thread, time: TIME }), { opened: 1, closed: 0 });
  assert.deepEqual(openEntries(db, space.id), [{ side: 'agent', kind: 'comment', diagram_id: erd.id, thread_id: thread }]);
  assert.deepEqual(todoOf(db, space).comments.entries.map((entry) => entry.id), [idOf('nc', thread)]);
  // Calling it again changes nothing.
  assert.deepEqual(threadChanged(db, { project: space.id, thread, time: TIME }), { opened: 0, closed: 0 });

  // The agent's reply moves it to the owner's to-do as a question and takes it off the agent's.
  s.comment(thread, { author: 'agent' });
  assert.deepEqual(threadChanged(db, { project: space.id, thread, time: LATER }), { opened: 1, closed: 1 });
  assert.deepEqual(openEntries(db, space.id), [{ side: 'owner', kind: 'question', diagram_id: erd.id, thread_id: thread }]);
  assert.equal(todoOf(db, space).comments.total, 0);
  assert.equal(todoOf(db, space).waiting_for_user, 1);

  // The owner's reply moves it back; closing it takes it off both.
  s.comment(thread, { author: 'owner' });
  threadChanged(db, { project: space.id, thread, time: LATER });
  assert.deepEqual(openEntries(db, space.id).map((entry) => entry.kind), ['comment']);
  s.closeThread(thread);
  assert.deepEqual(threadChanged(db, { project: space.id, thread, time: LATER }), { opened: 0, closed: 1 });
  assert.deepEqual(openEntries(db, space.id), []);
  assert.deepEqual(closedEntries(db, space.id).map((entry) => `${entry.kind} ${entry.reason}`), ['comment done', 'question done', 'comment done']);
  assert.deepEqual(threadChanged(db, { project: space.id, thread, time: LATER }), { opened: 0, closed: 0 });
});

test('an AI proposal waits on the owner until it is answered or withdrawn (SPEC-018, SPEC-019, SPEC-020)', (t) => {
  const db = testStore(t);
  const s = seed(db);
  const space = s.project();
  const erd = s.diagram(space);
  const thread = s.thread(erd);
  const [accepted, rejected, withdrawn] = [1, 2, 3].map(() => s.changeSet(space, erd, { origin: 'proposal', threadId: thread }));
  const sync = () => changeSetsChanged(db, { project: space.id, diagram: erd.id, time: TIME });

  assert.deepEqual(sync(), { opened: 3, closed: 0 });
  assert.deepEqual(openEntries(db, space.id).map((entry) => `${entry.kind} ${entry.change_set_id}`), [
    `proposal ${accepted}`, `proposal ${rejected}`, `proposal ${withdrawn}`,
  ]);
  assert.equal(todoOf(db, space).waiting_for_user, 3);
  assert.deepEqual(sync(), { opened: 0, closed: 0 });

  s.setChangeSet(accepted, { state: 'accepted' });
  s.setChangeSet(rejected, { state: 'rejected' });
  s.setChangeSet(withdrawn, { state: 'cancelled' });
  // The accepted proposal's reflection goes to the agent to-do (SPEC-019).
  assert.deepEqual(sync(), { opened: 1, closed: 3 });
  assert.deepEqual(openEntries(db, space.id), [{ side: 'agent', kind: 'reflect', diagram_id: erd.id, change_set_id: accepted }]);
  assert.deepEqual(closedEntries(db, space.id).map((entry) => `${entry.change_set_id} ${entry.reason}`), [
    `${accepted} done`, `${rejected} done`, `${withdrawn} withdrawn`,
  ]);
});

test('one reflection entry holds every waiting change set of a diagram (SPEC-021, SPEC-024, SPEC-025, SPEC-026)', (t) => {
  const db = testStore(t);
  const s = seed(db);
  const space = s.project();
  const erd = s.diagram(space);
  const board = s.diagram(space, { stage: '01-domain', sourceKey: '/pictures/01-domain', kind: 'ddd_board', name: 'DDD board' });
  const sync = (where = erd) => changeSetsChanged(db, { project: space.id, diagram: where.id, time: TIME });
  const reflections = () => todoOf(db, space).reflections.entries;

  // Three accepted change sets of one diagram are one entry; another diagram's is its own.
  const first = [];
  for (let n = 0; n < 3; n += 1) {
    first.push(s.changeSet(space, erd));
    sync();
  }
  s.changeSet(space, board);
  sync(board);
  const [entry] = reflections();
  assert.equal(reflections().length, 2);
  assert.deepEqual(entry.change_sets, first.map((key) => idOf('np', key)));
  assert.deepEqual([entry.task, entry.pull_request, entry.diagram], ['reflect', null, idOf('dg', erd.id)]);

  // The agent opens pull request 12 for them: the same entry, now naming it.
  const twelve = s.pullRequest(space, { number: 12 });
  for (const key of first) s.setChangeSet(key, { pullRequestId: twelve });
  assert.deepEqual(sync(), { opened: 0, closed: 0 });
  assert.deepEqual(reflections()[0], { ...entry, pull_request: `${REPOSITORY}/pull/12` });

  // A change set accepted while the pull request is open starts a new entry (SPEC-026).
  const fourth = s.changeSet(space, erd);
  assert.deepEqual(sync(), { opened: 1, closed: 0 });
  assert.deepEqual(reflections().filter((each) => each.diagram === entry.diagram).map((each) => each.change_sets), [
    first.map((key) => idOf('np', key)), [idOf('np', fourth)],
  ]);

  // The pull request closes without merge: its change sets wait again, so one entry, the older, holds all four.
  for (const key of first) s.setChangeSet(key, { pullRequestId: null });
  assert.deepEqual(sync(), { opened: 0, closed: 1 });
  const merged = reflections().filter((each) => each.diagram === entry.diagram);
  assert.deepEqual(merged.map((each) => [each.id, each.change_sets.length, each.pull_request]), [[entry.id, 4, null]]);
  assert.deepEqual(closedEntries(db, space.id).map((each) => each.reason), ['withdrawn']);

  // Pull request 13 carries them all and is reflected: the entry is done.
  const thirteen = s.pullRequest(space, { number: 13 });
  for (const key of [...first, fourth]) s.setChangeSet(key, { pullRequestId: thirteen });
  sync();
  // The drawing of the merge commit's snapshot shows them (SPEC-025).
  s.snapshot(space);
  const reflected = s.drawing(space, erd.id);
  for (const key of [...first, fourth]) s.setChangeSet(key, { reflectedDrawing: reflected });
  assert.deepEqual(sync(), { opened: 0, closed: 1 });
  // In the order of the entries' keys: the older entry is done, the newer one was withdrawn.
  assert.deepEqual(closedEntries(db, space.id).map((each) => each.reason), ['done', 'withdrawn']);
  assert.deepEqual(reflections().map((each) => each.diagram), [idOf('dg', board.id)]);
  assert.deepEqual(sync(), { opened: 0, closed: 0 });
});

test('an entry follows its change sets when one is cancelled, and a removal is taken out of its pull request (SPEC-023)', (t) => {
  const db = testStore(t);
  const s = seed(db);
  const space = s.project();
  const erd = s.diagram(space);
  const sync = () => changeSetsChanged(db, { project: space.id, diagram: erd.id, time: TIME });
  const [a, b] = [s.changeSet(space, erd), s.changeSet(space, erd)];
  sync();
  const [{ id }] = todoOf(db, space).reflections.entries;

  // The change set that named the entry is cancelled: the entry stays and holds the other.
  s.setChangeSet(a, { state: 'cancelled' });
  assert.deepEqual(sync(), { opened: 0, closed: 0 });
  assert.deepEqual(todoOf(db, space).reflections.entries.map((each) => [each.id, each.change_sets]), [[id, [idOf('np', b)]]]);

  // Linked to an open pull request, then cancelled there: the agent takes it out, and nothing is left to reflect.
  const pull = s.pullRequest(space, { number: 7 });
  s.setChangeSet(b, { pullRequestId: pull });
  sync();
  assert.equal(todoOf(db, space).reflections.entries[0].pull_request, `${REPOSITORY}/pull/7`);
  s.setChangeSet(b, { state: 'cancelled' });
  const removal = removeFromPullRequest(db, { project: space.id, diagram: erd.id, changeSet: b, time: TIME });
  assert.equal(removal.opened, 1);
  assert.deepEqual(removeFromPullRequest(db, { project: space.id, diagram: erd.id, changeSet: b, time: TIME }), { opened: 0, entry: removal.entry });
  assert.deepEqual(sync(), { opened: 0, closed: 1 });
  const [remove] = todoOf(db, space).reflections.entries;
  assert.deepEqual([remove.id, remove.task, remove.change_sets, remove.pull_request], [
    idOf('ne', removal.entry), 'remove', [idOf('np', b)], `${REPOSITORY}/pull/7`,
  ]);
  assert.deepEqual(heldChangeSets(db, { project: space.id, entry: openAgentEntry(db, { project: space.id, prefix: 'ne', key: removal.entry }) }), {
    changeSets: [b], pullRequest: pull,
  });

  // Any report of its pull request closes the removal.
  assert.deepEqual(removalReported(db, { project: space.id, entry: removal.entry, time: LATER }), { closed: 1 });
  assert.deepEqual(removalReported(db, { project: space.id, entry: removal.entry, time: LATER }), { closed: 0 });
  assert.deepEqual(closedEntries(db, space.id).map((each) => `${each.kind} ${each.reason}`), ['reflect withdrawn', 'remove_from_pr done']);
  assert.equal(todoOf(db, space).reflections.total, 0);
  assert.throws(() => removalReported(db, { project: space.id, entry: removal.entry + 99, time: LATER }), /no removal entry/);
});

test('the owner confirms a drawn diagram and the agent records it, or records its cancel (SPEC-029 to SPEC-033)', (t) => {
  const db = testStore(t);
  const s = seed(db);
  const space = s.project();
  const erd = s.diagram(space);
  const sync = () => confirmationsChanged(db, { project: space.id, diagram: erd.id, time: TIME });
  const owner = () => openEntries(db, space.id).filter((entry) => entry.side === 'owner');
  const checkpoints = () => todoOf(db, space).checkpoints.entries;

  // A drawn diagram that was never confirmed waits on the owner, naming no confirmation.
  assert.deepEqual(sync(), { opened: 1, closed: 0 });
  assert.deepEqual(owner(), [{ side: 'owner', kind: 'confirm', diagram_id: erd.id }]);
  assert.deepEqual(sync(), { opened: 0, closed: 0 });

  // Confirmed: off the owner's to-do, and recording it on the agent's (SPEC-029, SPEC-031).
  const first = s.confirm(space, erd);
  assert.deepEqual(sync(), { opened: 1, closed: 1 });
  assert.deepEqual(owner(), []);
  assert.deepEqual(checkpoints(), [{
    id: idOf('nk', first), part: '', stage: '05-erd', diagram: idOf('dg', erd.id), version: space.commit, state: 'passed',
    passed_at: TIME, withdrawn_at: null, claim: null,
  }]);

  // Recorded: done (SPEC-032). Cancelled then: the owner's to-do says cancelled, and the agent records the cancel.
  s.record(first);
  sync();
  assert.deepEqual(checkpoints(), []);
  s.cancel(first);
  assert.deepEqual(sync(), { opened: 2, closed: 0 });
  assert.deepEqual(owner(), [{ side: 'owner', kind: 'confirm', diagram_id: erd.id, confirmation_id: first }]);
  assert.deepEqual(checkpoints().map((each) => [each.id, each.state, each.withdrawn_at]), [[idOf('nk', first), 'withdrawn', TIME]]);
  s.recordCancel(first);
  assert.deepEqual(sync(), { opened: 0, closed: 1 });
  assert.deepEqual(checkpoints(), []);

  // Confirmed again, then invalidated by a new drawing before it is recorded: the owner's to-do says invalidated, and
  // the agent still records it at its version (SPEC-032, SPEC-033).
  const second = s.confirm(space, erd);
  sync();
  s.snapshot(space);
  s.invalidate(second, s.drawing(space, erd.id));
  sync();
  assert.deepEqual(owner(), [{ side: 'owner', kind: 'confirm', diagram_id: erd.id, confirmation_id: second }]);
  assert.deepEqual(checkpoints().map((each) => [each.id, each.state]), [[idOf('nk', second), 'passed']]);

  // Confirmed and cancelled before it is recorded: its record is withdrawn (SPEC-031).
  s.record(second);
  const third = s.confirm(space, erd);
  sync();
  s.cancel(third);
  sync();
  assert.deepEqual(owner(), [{ side: 'owner', kind: 'confirm', diagram_id: erd.id, confirmation_id: third }]);
  assert.deepEqual(checkpoints(), []);
  const closed = closedEntries(db, space.id).filter((entry) => entry.confirmation_id === third);
  assert.deepEqual(closed.map((entry) => `${entry.kind} ${entry.reason}`), ['record_confirmation withdrawn']);
  assert.deepEqual(closedEntries(db, space.id).filter((entry) => entry.kind === 'confirm').map((entry) => entry.reason), [
    'done', 'done', 'done',
  ]);

  // A diagram whose only drawing failed is not drawn, so it waits on no one (SPEC-029).
  const failed = s.diagram(space, { stage: '07-sitemap', sourceKey: '/pictures/07-sitemap', kind: 'sitemap', name: 'Sitemap', status: 'failed' });
  assert.deepEqual(confirmationsChanged(db, { project: space.id, diagram: failed.id, time: TIME }), { opened: 0, closed: 0 });
});

test('a removed diagram puts nothing on the owner\'s to-do, confirmed or not, until it comes back (note 4, SPEC-027)', (t) => {
  const db = testStore(t);
  const s = seed(db);
  const space = s.project();
  const confirmed = s.diagram(space);
  const open = s.diagram(space, { stage: '07-sitemap', sourceKey: '/pictures/07-sitemap', kind: 'sitemap', name: 'Sitemap' });
  const sync = (where) => confirmationsChanged(db, { project: space.id, diagram: where.id, time: TIME });
  const confirmation = s.confirm(space, confirmed);
  sync(confirmed);
  sync(open);
  assert.deepEqual(openEntries(db, space.id).map((entry) => `${entry.side} ${entry.kind} ${entry.diagram_id}`), [
    `agent record_confirmation ${confirmed.id}`, `owner confirm ${open.id}`,
  ]);

  // A snapshot removes both; neither has an open thread. The confirmed one puts nothing on the owner's to-do, and its
  // confirmation and the agent's entry to record it stay. The other's confirm entry is withdrawn.
  s.removeDiagram(confirmed.id);
  s.removeDiagram(open.id);
  assert.deepEqual(sync(confirmed), { opened: 0, closed: 0 });
  assert.deepEqual(sync(open), { opened: 0, closed: 1 });
  assert.deepEqual(openEntries(db, space.id).map((entry) => `${entry.side} ${entry.kind}`), ['agent record_confirmation']);
  assert.deepEqual(closedEntries(db, space.id).map((entry) => `${entry.kind} ${entry.reason}`), ['confirm withdrawn']);
  assert.equal(db.prepare('SELECT state FROM confirmations WHERE id = ?').get(confirmation).state, 'confirmed');
  assert.equal(todoOf(db, space).waiting_for_user, 0);

  // Back again: the one with a live confirmation still waits on no one; the other waits on the owner again.
  s.removeDiagram(confirmed.id, false);
  s.removeDiagram(open.id, false);
  assert.deepEqual(sync(confirmed), { opened: 0, closed: 0 });
  assert.deepEqual(sync(open), { opened: 1, closed: 0 });
  assert.deepEqual(openEntries(db, space.id).filter((entry) => entry.side === 'owner').map((entry) => entry.diagram_id), [open.id]);

  // A confirmation cancelled while the diagram was away makes it wait on the owner, as cancelled, when it is back.
  s.removeDiagram(confirmed.id);
  s.cancel(confirmation);
  assert.deepEqual(sync(confirmed), { opened: 0, closed: 1 });
  s.removeDiagram(confirmed.id, false);
  assert.deepEqual(sync(confirmed), { opened: 1, closed: 0 });
  assert.deepEqual(openEntries(db, space.id).filter((entry) => entry.diagram_id === confirmed.id && entry.side === 'owner'), [
    { side: 'owner', kind: 'confirm', diagram_id: confirmed.id, confirmation_id: confirmation },
  ]);
});

test('a confirmed workshop step waits to be written into the domain document (SPEC-039, SPEC-040)', (t) => {
  const db = testStore(t);
  const s = seed(db);
  const space = s.project();
  const workshop = s.workshop(space);
  const sync = () => stepsChanged(db, { project: space.id, workshop, time: TIME });
  assert.deepEqual(sync(), { opened: 0, closed: 0 });
  s.confirmStep(workshop, '2', { at: '2026-11-23T00:10:00.000Z' });
  sync();
  s.confirmStep(workshop, '1-b', { at: '2026-11-23T00:20:00.000Z' });
  assert.deepEqual(sync(), { opened: 1, closed: 0 });
  assert.deepEqual(todoOf(db, space).steps, {
    total: 2,
    entries: [
      { workshop: idOf('ws', workshop), step: '2', confirmed_at: '2026-11-23T00:10:00.000Z', checkpoint: false },
      { workshop: idOf('ws', workshop), step: '1-b', confirmed_at: '2026-11-23T00:20:00.000Z', checkpoint: true },
    ],
  });
  s.writeStep(workshop, '2');
  assert.deepEqual(sync(), { opened: 0, closed: 1 });
  assert.deepEqual(todoOf(db, space).steps.entries.map((entry) => entry.step), ['1-b']);
  assert.deepEqual(closedEntries(db, space.id), [{ kind: 'write_step', reason: 'done', step: '2' }]);
  assert.deepEqual(sync(), { opened: 0, closed: 0 });
});

test('an entry ID names the open entry of the agent to-do it is about, in its project only', (t) => {
  const db = testStore(t);
  const s = seed(db);
  const space = s.project();
  const other = s.project();
  const erd = s.diagram(space);
  const thread = s.thread(erd);
  threadChanged(db, { project: space.id, thread, time: TIME });
  s.changeSet(space, erd);
  changeSetsChanged(db, { project: space.id, diagram: erd.id, time: TIME });
  const confirmation = s.confirm(space, erd);
  confirmationsChanged(db, { project: space.id, diagram: erd.id, time: TIME });
  const [reflection] = todoOf(db, space).reflections.entries;
  const reflectKey = Number(db.prepare("SELECT id FROM todos WHERE kind = 'reflect'").get().id);
  assert.equal(reflection.id, idOf('ne', reflectKey));

  const named = (prefix, key, project = space.id) => openAgentEntry(db, { project, prefix, key })?.kind ?? null;
  assert.equal(named('nc', thread), 'comment');
  assert.equal(named('ne', reflectKey), 'reflect');
  assert.equal(named('nk', confirmation), 'record_confirmation');
  assert.equal(named('nd', thread), null);
  assert.equal(named('nc', thread, other.id), null);
  // An ne_ ID names a reflection or a removal only, and an owner entry never.
  const ownerEntry = Number(db.prepare("SELECT id FROM todos WHERE side = 'owner'").get()?.id ?? 0);
  assert.equal(ownerEntry, 0, 'the confirmed diagram waits on no owner entry');
  const recordKey = Number(db.prepare("SELECT id FROM todos WHERE kind = 'record_confirmation'").get().id);
  assert.equal(named('ne', recordKey), null);
  assert.throws(() => openAgentEntry(db, { project: space.id, prefix: 'np', key: 1 }), /starts with nc, nd, ne or nk/);
  // A closed entry is named by no ID.
  s.closeThread(thread);
  threadChanged(db, { project: space.id, thread, time: TIME });
  assert.equal(named('nc', thread), null);
});

test('refuses a call that does not name its subject by row keys and a time', (t) => {
  const db = testStore(t);
  const s = seed(db);
  const space = s.project();
  const erd = s.diagram(space);
  assert.throws(() => threadChanged(db, { project: space.id, thread: 0, time: TIME }), /thread is a row key/);
  assert.throws(() => threadChanged(db, { project: space.id, thread: 99, time: TIME }), /no thread has this key/);
  assert.throws(() => changeSetsChanged(db, { project: '1', diagram: erd.id, time: TIME }), /project is a row key/);
  assert.throws(() => confirmationsChanged(db, { project: space.id, diagram: erd.id, time: 'now' }), /time is a time/);
  assert.throws(() => confirmationsChanged(db, { project: space.id + 1, diagram: erd.id, time: TIME }), /no diagram of the project/);
  assert.throws(() => stepsChanged(db, { project: space.id, workshop: 1.5, time: TIME }), /workshop is a row key/);
  assert.equal(db.prepare('SELECT count(*) AS n FROM todos').get().n, 0);
});
