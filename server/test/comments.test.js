// Agent comments (TASK-437; API-252 to API-255, SPEC-016, SPEC-017, SPEC-027, rule 3, rule 5): TASK-437's done
// condition, every response the four operations list, the thread and its entries against the contract, the to-do and
// the claims they change, the tables they touch (note 23) and their log lines. The project's diagrams, drawings,
// elements and threads are written straight into the store with test/seed.js, as the push and the owner's operations
// of other tasks would write them.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { threadChanged } from '../src/entries.js';
import { idOf } from '../src/ids.js';
import { readProject } from '../src/project.js';
import { ROUTES } from '../src/routes.js';
import { openStore } from '../src/store.js';
import { agentTodo } from '../src/todo.js';
import { responseRecord } from './responses.js';
import { seed, TIME } from './seed.js';
import { exchange, head, localGate, newId, startServer, testStore, TRACE_ID } from './support.js';
import { checkLayer, checkTables, recordTables } from './tables.js';

const START = Date.parse('2026-11-23T02:00:00.000Z');
const MINUTE = 60 * 1000;
const MiB = 1024 * 1024;
const S1 = 'claude-code-4f2a91';
const S2 = 'codex-7d1e';
const LINK = 'https://github.com/example/demo/pull/13';
const at = (ms) => new Date(ms).toISOString();
const flow = (name) => `docs/03-user-flow/${name}.md`;
const screen = (name) => `docs/08-screen-states/${name}.md`;
// The project's /snapshot document lists its file pictures with their part, so that a diagram's part is found.
const PICTURES = [
  ...['push', 'comment', 'approval'].map((name) => ({ stage: '03-user-flow', key: flow(name), part: 'nexus' })),
  ...['a', 'b'].map((name) => ({ stage: '08-screen-states', key: screen(name), part: 'nexus' })),
];
const ACTIONS = ['leaveComment', 'replyToComment', 'markAnswered', 'recordDecision'];

describe('agent comments', () => {
  const responses = responseRecord();
  let folder;
  let db;
  let recorder;
  let local;
  let server;
  let s;
  let space;
  let older;
  let erd;
  let erdNow;
  let pushFlow;
  let commentFlow;
  let removedFlow;
  let items;
  let failedScreen;
  let drawnScreen;
  let clock = START;

  // An element of a drawing, by its trace ID, which is its key (TBL-153).
  const element = (drawing, traceId, name, kind) => db.prepare(
    'INSERT INTO elements (drawing_id, element_key, trace_id, kind, name) VALUES (?, ?, ?, ?, ?)',
  ).run(drawing, traceId, traceId, kind, name);

  // Sends a write of action with its JSON body, request key and session, and checks the answer against the contract.
  const write = async (action, path, body, {
    session = S1, headers = s.agent.headers, key = `"${newId('nw')}"`, type = 'application/json', raw,
  } = {}) => {
    const all = { ...headers, 'Content-Type': type };
    if (session !== null) all['Nexus-Session'] = session;
    if (key !== null) all['Idempotency-Key'] = key;
    const answer = await server.send({ method: 'POST', path, headers: all, body: raw ?? JSON.stringify(body) });
    return responses.note(action, answer);
  };
  const threadPath = (id, end, name = space.name) => `/api/spaces/${name}/comments/${id}/${end}`;
  const comment = (body, options = {}) => write('leaveComment', `/api/spaces/${options.project ?? space.name}/comments`, body, options);
  const reply = (id, body, options = {}) => write('replyToComment', threadPath(id, 'replies', options.project), body, options);
  const answered = (id, options = {}) => write('markAnswered', threadPath(id, 'answered', options.project), options.body ?? {}, options);
  const decide = (id, body, options = {}) => write('recordDecision', threadPath(id, 'decisions', options.project), body, options);

  const erdComment = (extra = {}) => ({ part: 'nexus', stage: '05-erd', item: 'TBL-146', text: 'Is last_used_at needed?', ...extra });

  // An owner's thread on the ERD that waits on the agent, with its comment entry: { thread, id, entry }.
  const waiting = () => {
    const thread = s.thread(erdNow);
    threadChanged(db, { project: space.id, thread, time: TIME });
    return { thread, id: idOf('nc', thread), entry: openEntry('comment', thread) };
  };
  const openEntry = (kind, thread) => {
    const row = db.prepare('SELECT id FROM todos WHERE thread_id = ? AND kind = ? AND closed_at IS NULL').get(thread, kind);
    return row === undefined ? null : Number(row.id);
  };
  const entriesOf = (thread) => db.prepare(
    "SELECT side, kind, close_reason FROM todos WHERE thread_id = ? ORDER BY id",
  ).all(thread).map((row) => `${row.side} ${row.kind} ${row.close_reason ?? 'open'}`);
  const commentsOf = (thread) => db.prepare('SELECT seq, author, credential_id, body, detail FROM comments WHERE thread_id = ? ORDER BY seq')
    .all(thread).map((row) => ({ ...row, credential_id: row.credential_id === null ? null : Number(row.credential_id), detail: JSON.parse(row.detail) }));
  const threadRow = (thread) => ({ ...db.prepare('SELECT state, waits_on, closed_by FROM comment_threads WHERE id = ?').get(thread) });
  const claimsOf = (entry) => db.prepare('SELECT session, release_reason FROM claims WHERE todo_id = ? ORDER BY id').all(entry)
    .map((row) => ({ ...row }));
  const count = (table) => Number(db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n);
  const listed = (thread) => agentTodo(db, { name: space.name, session: S1, now: clock }).comments.entries
    .some((entry) => entry.id === idOf('nc', thread));

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-comments-'));
    ({ db } = openStore(folder));
    recorder = recordTables(db);
    local = localGate();
    server = await startServer({ store: recorder.store, gate: local.gate, now: () => clock, routes: ROUTES });
    s = seed(db);
    space = s.project('demo', { parts: ['nexus'], pictures: PICTURES });
    older = { commit: space.commit };
    erd = s.diagram(space, { sourceKey: '/pictures/05-erd/nexus' });
    for (const [id, name] of [['TBL-146', 'agent_credentials'], ['TBL-147', 'project_spaces'], ['TBL-148', 'snapshots']]) {
      element(erd.drawing, id, name, 'table');
    }
    // Stage 03 has a diagram per file. Push flow is made first, but Comment flow is first by name, and Approval flow,
    // before both by name, is removed.
    pushFlow = s.diagram(space, { stage: '03-user-flow', sourceKey: flow('push'), kind: 'user_flow', name: 'Push flow' });
    element(pushFlow.drawing, 'FL-001', 'Push a snapshot', 'flow');
    element(pushFlow.drawing, 'FL-002', 'Claim an entry', 'flow');
    commentFlow = s.diagram(space, { stage: '03-user-flow', sourceKey: flow('comment'), kind: 'user_flow', name: 'Comment flow' });
    element(commentFlow.drawing, 'FL-001', 'Push a snapshot', 'flow');
    removedFlow = s.diagram(space, { stage: '03-user-flow', sourceKey: flow('approval'), kind: 'user_flow', name: 'Approval flow', removed: true });
    element(removedFlow.drawing, 'FL-001', 'Push a snapshot', 'flow');
    items = s.diagram(space, { stage: '02-prd', sourceKey: '/items/02-prd', kind: 'item_table', name: 'Requirements' });
    element(items.drawing, 'REQ-020', 'Comment on a diagram', 'row');
    // Stage 08: its first diagram by name never drew; the second did.
    failedScreen = s.diagram(space, { stage: '08-screen-states', sourceKey: screen('a'), kind: 'screen_states', name: 'A screen', status: 'failed' });
    drawnScreen = s.diagram(space, { stage: '08-screen-states', sourceKey: screen('b'), kind: 'screen_states', name: 'B screen' });
    element(drawnScreen.drawing, 'SCR-145', 'Diagram', 'screen');
    // Stage 01's only diagram is removed.
    s.diagram(space, { stage: '01-domain', sourceKey: '/pictures/01-domain/nexus', kind: 'ddd_board', name: 'DDD board', removed: true });
    // The next snapshot draws the ERD again without TBL-148.
    s.snapshot(space, { parts: ['nexus'], pictures: PICTURES });
    erdNow = { id: erd.id, drawing: s.drawing(space, erd.id) };
    element(erdNow.drawing, 'TBL-146', 'agent_credentials', 'table');
    element(erdNow.drawing, 'TBL-147', 'project_spaces', 'table');
  });

  after(async () => {
    await server.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  test('a comment without item or diagram goes on the stage\'s first diagram, the one the project read lists first (SPEC-016)', async () => {
    clock = START;
    const text = 'Is stage 03 ready for its checkpoint?';
    const body = { part: 'nexus', stage: '03-user-flow', item: '', text, asks: 'checkpoint', look_first: 'FL-001' };
    const answer = await comment(body);
    assert.equal(answer.status, 201);
    const { id } = answer.json;
    assert.deepEqual(answer.json, {
      id,
      part: 'nexus',
      stage: '03-user-flow',
      diagram: idOf('dg', commentFlow.id),
      drawing: idOf('dw', commentFlow.drawing),
      version: older.commit,
      item: '',
      target: 'diagram',
      element: null,
      removed_name: null,
      state: 'open',
      waits_on: 'owner',
      closed_by: null,
      opened_at: at(clock),
      closed_at: null,
      last_at: at(clock),
      entries: [{ seq: 1, author: 'agent', kind: 'comment', text, asks: 'checkpoint', look_first: 'FL-001', made_at: at(clock) }],
      change_sets: [],
    });
    // The stage's address opens the first diagram the project read lists for its row.
    const row = readProject(db, space.name).stages.find((each) => each.part === 'nexus' && each.stage === '03-user-flow');
    assert.equal(row.diagrams[0].id, answer.json.diagram);
    // An agent's comment is a question of the owner's to-do, and not in the agent to-do (SPEC-016).
    const key = Number(db.prepare('SELECT id FROM comment_threads ORDER BY id DESC LIMIT 1').get().id);
    assert.equal(idOf('nc', key), id);
    assert.deepEqual(entriesOf(key), ['owner question open']);
    assert.equal(listed(key), false);
    assert.deepEqual(commentsOf(key), [{
      seq: 1, author: 'agent', credential_id: s.agent.key, body: text, detail: { asks: 'checkpoint', look_first: 'FL-001' },
    }]);
  });

  test('an item that several diagrams hold, sent without diagram, gets diagram_ambiguous, naming them (SPEC-016)', async () => {
    const threads = count('comment_threads');
    const refused = await comment({ part: 'nexus', stage: '03-user-flow', item: 'FL-001', text: 'Which push is this?' });
    assert.equal(refused.status, 409);
    assert.equal(refused.json.code, 'diagram_ambiguous');
    // In the order of the stage's diagrams; the removed one is none of them (SPEC-027).
    assert.deepEqual(refused.json.diagrams, [idOf('dg', commentFlow.id), idOf('dg', pushFlow.id)]);
    assert.equal(count('comment_threads'), threads);
    // Named, the diagram takes it; an item that one diagram holds picks that one.
    const named = await comment({ part: 'nexus', stage: '03-user-flow', diagram: idOf('dg', pushFlow.id), item: 'FL-001', text: 'This push.' });
    assert.equal(named.status, 201);
    assert.deepEqual([named.json.diagram, named.json.target, named.json.element, named.json.item], [idOf('dg', pushFlow.id), 'element', 'FL-001', 'FL-001']);
    const picked = await comment({ part: 'nexus', stage: '03-user-flow', item: 'FL-002', text: 'And the claim.' });
    assert.deepEqual([picked.status, picked.json.diagram, picked.json.element], [201, idOf('dg', pushFlow.id), 'FL-002']);
  });

  test('an agent\'s reply puts the thread on the owner\'s to-do and takes it off the agent\'s (SPEC-017)', async () => {
    clock = START + 10 * MINUTE;
    const { thread, id, entry } = waiting();
    assert.equal(listed(thread), true);
    const text = 'Yes: SPEC-050 shows it on the credential list.';
    const answer = await reply(id, { text });
    assert.equal(answer.status, 201);
    assert.deepEqual(answer.json, {
      thread: { id, state: 'open', waits_on: 'owner', closed_by: null, last_at: at(clock) },
      entry: { seq: 2, author: 'agent', kind: 'comment', text, made_at: at(clock) },
    });
    // The thread has 2 entries in order, the owner's to-do lists it and the agent to-do does not.
    assert.deepEqual(commentsOf(thread).map((row) => [row.seq, row.author]), [[1, 'owner'], [2, 'agent']]);
    assert.deepEqual(entriesOf(thread), ['agent comment done', 'owner question open']);
    assert.equal(listed(thread), false);
    // The reply wrote on the entry, so it held its claim, and closing the entry released it as done.
    assert.deepEqual(claimsOf(entry), [{ session: S1, release_reason: 'done' }]);
    // A reply on a thread that already waits on the owner keeps it there.
    const again = await reply(id, { text: 'And the screen shows it too.', asks: 'answer' });
    assert.deepEqual([again.status, again.json.thread.waits_on, again.json.entry.seq, again.json.entry.asks], [201, 'owner', 3, 'answer']);
    assert.deepEqual(entriesOf(thread), ['agent comment done', 'owner question open']);
  });

  test('a write on a thread another session claims gets claimed and changes nothing (SPEC-044)', async () => {
    clock = START + 20 * MINUTE;
    const { thread, id, entry } = waiting();
    const claim = await server.send({
      method: 'POST', path: `/api/spaces/${space.name}/claims/${id}`, headers: { ...s.agent.headers, 'Nexus-Session': S2 },
    });
    assert.equal(claim.status, 200);
    const before = commentsOf(thread);
    for (const send of [() => reply(id, { text: 'Mine.' }), () => answered(id), () => decide(id, { link: LINK })]) {
      const refused = await send();
      assert.deepEqual([refused.status, refused.json.code, refused.json.session], [409, 'claimed', S2]);
    }
    assert.deepEqual(commentsOf(thread), before);
    assert.deepEqual(threadRow(thread), { state: 'open', waits_on: 'agent', closed_by: null });
    assert.deepEqual(claimsOf(entry), [{ session: S2, release_reason: null }]);
    // The session that holds it writes.
    const held = await reply(id, { text: 'Done.' }, { session: S2 });
    assert.equal(held.status, 201);
    assert.deepEqual(claimsOf(entry), [{ session: S2, release_reason: 'done' }]);
  });

  test('a closed thread takes no reply, and a thread of a removed diagram still does (SPEC-017, SPEC-027)', async () => {
    const { thread, id } = waiting();
    s.closeThread(thread);
    threadChanged(db, { project: space.id, thread, time: TIME });
    const refused = await reply(id, { text: 'Too late.' });
    assert.deepEqual([refused.status, refused.json.code], [409, 'thread_closed']);
    assert.equal(commentsOf(thread).length, 1);
    const kept = s.thread(removedFlow, { elementKey: 'FL-001' });
    threadChanged(db, { project: space.id, thread: kept, time: TIME });
    const replied = await reply(idOf('nc', kept), { text: 'The flow was removed; this stays.' });
    assert.deepEqual([replied.status, replied.json.thread.waits_on], [201, 'owner']);
  });

  test('marking a thread answered makes it wait on the owner without a new entry, once (SPEC-017)', async () => {
    clock = START + 30 * MINUTE;
    const { thread, id, entry } = waiting();
    const answer = await answered(id);
    assert.equal(answer.status, 200);
    assert.deepEqual(answer.json, { thread: { id, state: 'open', waits_on: 'owner', closed_by: null, last_at: TIME }, changed: true });
    assert.equal(commentsOf(thread).length, 1);
    assert.deepEqual(entriesOf(thread), ['agent comment done', 'owner question open']);
    assert.deepEqual(claimsOf(entry), [{ session: S1, release_reason: 'done' }]);
    // Waiting on the owner already, or closed, it answers changed false and changes nothing.
    const again = await answered(id);
    assert.deepEqual([again.status, again.json.changed, again.json.thread.waits_on], [200, false, 'owner']);
    s.closeThread(thread);
    threadChanged(db, { project: space.id, thread, time: TIME });
    const closed = await answered(id);
    assert.deepEqual(closed.json, { thread: { id, state: 'closed', waits_on: null, closed_by: 'owner', last_at: TIME }, changed: false });
    assert.deepEqual(entriesOf(thread), ['agent comment done', 'owner question done']);
  });

  test('a decision is an entry with its link: an open thread then waits on the owner, and a closed one stays closed', async () => {
    clock = START + 40 * MINUTE;
    const { thread, id, entry } = waiting();
    const answer = await decide(id, { link: LINK, text: 'Recorded in the stage record.' });
    assert.equal(answer.status, 201);
    assert.deepEqual(answer.json, {
      thread: { id, state: 'open', waits_on: 'owner', closed_by: null, last_at: at(clock) },
      entry: { seq: 2, author: 'agent', kind: 'decision', text: 'Recorded in the stage record.', link: LINK, made_at: at(clock) },
    });
    assert.deepEqual(entriesOf(thread), ['agent comment done', 'owner question open']);
    assert.deepEqual(claimsOf(entry), [{ session: S1, release_reason: 'done' }]);
    // Without text, or with one that is empty or only white space, the link stands as the entry's text.
    for (const body of [{ link: LINK }, { link: LINK, text: '' }, { link: LINK, text: ' \n ' }]) {
      const linked = await decide(id, body);
      assert.deepEqual([linked.status, linked.json.entry.text, linked.json.entry.link], [201, LINK, LINK]);
    }
    assert.deepEqual(commentsOf(thread).at(-1).detail, { link: LINK });
    // A closed thread takes it too and stays closed: the link is a record, not a question.
    s.closeThread(thread);
    threadChanged(db, { project: space.id, thread, time: TIME });
    const closed = await decide(id, { link: LINK, text: 'Merged.' });
    assert.equal(closed.status, 201);
    assert.deepEqual(closed.json.thread, { id, state: 'closed', waits_on: null, closed_by: 'owner', last_at: at(clock) });
    assert.equal(closed.json.entry.seq, 6);
    assert.deepEqual(entriesOf(thread), ['agent comment done', 'owner question done']);
  });

  test('a decision resolves only after its text is verified in the reported merged snapshot', async () => {
    const example = s.project('decision-proof');
    const path = '/pictures/01-domain/nexus';
    const board = s.diagram(example, { stage: '01-domain', sourceKey: path, kind: 'ddd_board' });
    const text = 'Use the agreed option.';
    s.document(example, path, '01-domain', JSON.stringify({ format: 1, hotspots: [{ answer: text }] }));
    const thread = s.thread(board, { target: 'diagram', body: text });
    threadChanged(db, { project: example.id, thread, time: TIME });
    const pull = s.pullRequest(example, { number: 42, state: 'merged' });
    db.prepare('UPDATE pull_requests SET merge_commit = ? WHERE id = ?').run(example.commit, pull);
    const repository = db.prepare('SELECT repository FROM project_spaces WHERE id = ?').get(example.id).repository;
    const result = await decide(idOf('nc', thread), { link: `${repository}/pull/42`, text }, { project: example.name });
    assert.equal(result.status, 201);
    assert.equal(result.json.thread.state, 'closed');
    assert.equal(Number(db.prepare("SELECT count(*) AS n FROM thread_resolution_events WHERE thread_id = ? AND event = 'resolved'").get(thread).n), 1);
    assert.equal(openEntry('question', thread), null);
    const recommendation = s.thread(board, { target: 'diagram', author: 'agent', body: text });
    db.prepare('UPDATE comments SET detail = ? WHERE thread_id = ? AND seq = 1').run(JSON.stringify({ asks: 'recommended' }), recommendation);
    s.comment(recommendation, { author: 'owner', body: '추천안' });
    const chosen = await decide(idOf('nc', recommendation), { link: `${repository}/pull/42`, text }, { project: example.name });
    assert.equal(chosen.json.thread.state, 'closed');
    db.prepare("UPDATE comment_threads SET state = 'open', waits_on = 'agent', closed_at = NULL, closed_by = NULL WHERE id = ?").run(thread);
    db.prepare("INSERT INTO thread_resolution_events (thread_id, event, created_at) VALUES (?, 'reopened', ?)").run(thread, at(clock));
    const reopened = await decide(idOf('nc', thread), { link: `${repository}/pull/42`, text }, { project: example.name });
    assert.equal(reopened.json.thread.state, 'open');
    const pending = s.thread(board, { target: 'diagram', body: text });
    s.changeSet(example, board, { origin: 'proposal', threadId: pending });
    const stillOpen = await decide(idOf('nc', pending), { link: `${repository}/pull/42`, text }, { project: example.name });
    assert.equal(stillOpen.json.thread.state, 'open');
    const unanswered = s.thread(board, { target: 'diagram', body: text });
    s.comment(unanswered, { author: 'owner', body: 'What about the next question?' });
    const unansweredResult = await decide(idOf('nc', unanswered), { link: `${repository}/pull/42`, text }, { project: example.name });
    assert.equal(unansweredResult.json.thread.state, 'open');
    const otherDiagram = s.diagram(example);
    s.elements(otherDiagram.drawing, [{ key: 'TBL-146', trace_id: 'TBL-146', name: text }]);
    const otherThread = s.thread(otherDiagram, { target: 'diagram', body: text });
    const otherResult = await decide(idOf('nc', otherThread), { link: `${repository}/pull/42`, text }, { project: example.name });
    assert.equal(otherResult.json.thread.state, 'closed');
  });

  test('five existing waiting conversations remain open when their links cannot prove records', async () => {
    const threads = Array.from({ length: 5 }, () => waiting());
    for (const { id, thread } of threads) {
      const result = await decide(id, { link: LINK, text: 'The decision is recorded.' });
      assert.equal(result.status, 201);
      assert.equal(threadRow(thread).state, 'open');
      assert.deepEqual(entriesOf(thread).at(-1), 'owner question open');
    }
  });

  test('a comment on an item goes on its element or row, at commit when NEXUS holds it; one that left gets the diagram (SPEC-016, SPEC-027)', async () => {
    clock = START + 50 * MINUTE;
    const now = await comment(erdComment());
    assert.deepEqual(
      [now.status, now.json.drawing, now.json.version, now.json.target, now.json.element, now.json.item, now.json.removed_name],
      [201, idOf('dw', erdNow.drawing), space.commit, 'element', 'TBL-146', 'TBL-146', null],
    );
    // At an older commit NEXUS holds, the thread is at the drawing the diagram showed then.
    const then = await comment(erdComment({ commit: older.commit }));
    assert.deepEqual([then.json.drawing, then.json.version, then.json.target], [idOf('dw', erd.drawing), older.commit, 'element']);
    // A commit NEXUS does not hold: the current drawing.
    const unknown = await comment(erdComment({ commit: 'a'.repeat(40) }));
    assert.deepEqual([unknown.json.drawing, unknown.json.version], [idOf('dw', erdNow.drawing), space.commit]);
    // TBL-148 was in the drawing at that commit and the current drawing no longer holds it: the thread goes on the
    // diagram, its key kept and marked with its last name.
    const left = await comment(erdComment({ item: 'TBL-148', commit: older.commit }));
    assert.deepEqual(
      [left.status, left.json.target, left.json.element, left.json.removed_name, left.json.item, left.json.drawing],
      [201, 'diagram', 'TBL-148', 'snapshots', '', idOf('dw', erd.drawing)],
    );
    // An element the current drawing draws as unreadable counts as gone too (SPEC-027): the thread goes on the diagram.
    db.prepare("INSERT INTO elements (drawing_id, element_key, trace_id, kind, name, status) VALUES (?, ?, ?, 'table', ?, 'unreadable')")
      .run(erdNow.drawing, 'TBL-149', 'TBL-149', 'stage_documents');
    const unreadable = await comment(erdComment({ item: 'TBL-149' }));
    assert.deepEqual(
      [unreadable.status, unreadable.json.target, unreadable.json.element, unreadable.json.removed_name, unreadable.json.item],
      [201, 'diagram', 'TBL-149', 'stage_documents', ''],
    );
    // Renamed and then removed: at a commit before the rename, the mark is the element's last readable name, as a
    // thread the push moved is marked (after-drawing.js), not its name at that commit (TASK-443). Its own space keeps
    // the other tests' snapshots.
    const renamed = s.project('renamed', { parts: ['nexus'] });
    const first = renamed.commit;
    const drawn = s.diagram(renamed, { sourceKey: '/pictures/05-erd/nexus' });
    element(drawn.drawing, 'TBL-150', 'blobs', 'table');
    s.snapshot(renamed, { parts: ['nexus'] });
    element(s.drawing(renamed, drawn.id), 'TBL-150', 'document_blobs', 'table');
    s.snapshot(renamed, { parts: ['nexus'] });
    element(s.drawing(renamed, drawn.id), 'TBL-146', 'agent_credentials', 'table');
    const marked = await comment(erdComment({ item: 'TBL-150', commit: first }), { project: renamed.name });
    assert.deepEqual(
      [marked.status, marked.json.drawing, marked.json.target, marked.json.element, marked.json.removed_name],
      [201, idOf('dw', drawn.drawing), 'diagram', 'TBL-150', 'document_blobs'],
    );
    // An item table's row (stage 02, the project as a whole).
    const row = await comment({ part: '', stage: '02-prd', item: 'REQ-020', text: 'Does this cover a phone?', quote: 'on a diagram' });
    assert.deepEqual([row.status, row.json.target, row.json.element, row.json.part, row.json.entries[0].quote], [201, 'row', 'REQ-020', '', 'on a diagram']);
    // The first diagram of stage 08 never drew, but an item picks the one that did.
    const picked = await comment({ part: 'nexus', stage: '08-screen-states', item: 'SCR-145', text: 'Is this the phone layout?' });
    assert.deepEqual([picked.status, picked.json.diagram], [201, idOf('dg', drawnScreen.id)]);
  });

  test('an item that no element holds picks the file diagram it names, as a whole; an element that holds it still wins (SPEC-016)', async () => {
    clock = START + 55 * MINUTE;
    // A project whose stages 03 and 08 are drawn one diagram per file, named as the drawers name them: by the file's
    // first heading, or by the file's name until a drawer names it.
    const userFlow = (file, name, options = {}) => ({ stage: '03-user-flow', sourceKey: flow(file), kind: 'user_flow', name, ...options });
    const screenStates = (file, name, options = {}) => ({ stage: '08-screen-states', sourceKey: screen(file), kind: 'screen_states', name, ...options });
    const files = {
      'FL-001': userFlow('FL-001-put-a-project-on-nexus', 'FL-001 Put a project on NEXUS'),
      'FL-003': userFlow('FL-003-comment-and-answer', 'FL-003 Comment and answer an AI proposal'),
      'FL-005': userFlow('FL-005-reflect-accepted-changes-into-git', 'FL-005 Reflect accepted changes into Git'),
      'FL-007': userFlow('FL-007-draw-a-new-snapshot', 'FL-007 Draw a new snapshot'),
      'FL-007 again': userFlow('FL-007-draw-it-again', 'FL-007 Draw it again'),
      'FL-009': userFlow('FL-009-issue-and-revoke', 'FL-009 Issue and revoke agent access', { removed: true }),
      'FL-011a': userFlow('FL-011a-a-draft', 'FL-011a A draft'),
      'SCR-143': screenStates('SCR-143', 'SCR-143 Projects'),
      'SCR-144': screenStates('SCR-144', 'SCR-144.md'),
      'SCR-145': screenStates('SCR-145', 'SCR-145.md', { status: 'failed' }),
    };
    const pictures = Object.values(files).map(({ stage, sourceKey: key }) => ({ stage, key, part: 'nexus' }));
    const project = s.project('files', { parts: ['nexus'], pictures });
    const made = new Map(Object.entries(files).map(([label, file]) => [label, s.diagram(project, file)]));
    // Flow FL-001 holds an element of trace ID FL-003, such as a box that leads to that flow.
    element(made.get('FL-001').drawing, 'FL-003', 'Comment and answer', 'flow');
    // Stage 05's picture is no file's: its name holds no trace ID that a comment can reach.
    s.diagram(project, { stage: '05-erd', sourceKey: '/pictures/05-erd/nexus', name: 'TBL-151 diagrams' });
    const send = (body) => comment({ part: 'nexus', text: 'Is this flow done?', ...body }, { project: project.name });
    const threads = count('comment_threads');

    // The hub's comment command sends item and no diagram: FL-005 lands on its flow's diagram, as a whole.
    const flowFive = made.get('FL-005');
    const landed = await send({ stage: '03-user-flow', item: 'FL-005' });
    assert.equal(landed.status, 201);
    assert.deepEqual(
      [landed.json.diagram, landed.json.drawing, landed.json.version, landed.json.target, landed.json.element, landed.json.removed_name, landed.json.item],
      [idOf('dg', flowFive.id), idOf('dw', flowFive.drawing), project.commit, 'diagram', null, null, ''],
    );
    const thread = Number(db.prepare('SELECT id FROM comment_threads ORDER BY id DESC LIMIT 1').get().id);
    assert.deepEqual({ ...db.prepare('SELECT diagram_id, target_kind, element_key FROM comment_threads WHERE id = ?').get(thread) }, {
      diagram_id: flowFive.id, target_kind: 'diagram', element_key: null,
    });
    // A screen of stage 08, by its first heading or by its file's name.
    for (const id of ['SCR-143', 'SCR-144']) {
      const screenComment = await send({ stage: '08-screen-states', item: id });
      assert.deepEqual([screenComment.status, screenComment.json.diagram, screenComment.json.target], [201, idOf('dg', made.get(id).id), 'diagram'], id);
    }
    // Named with its diagram, the item may be the one that diagram is named by.
    const both = await send({ stage: '03-user-flow', diagram: idOf('dg', flowFive.id), item: 'FL-005' });
    assert.deepEqual([both.status, both.json.diagram, both.json.target, both.json.element], [201, idOf('dg', flowFive.id), 'diagram', null]);
    // An element that holds the item wins over the diagram named by it.
    const held = await send({ stage: '03-user-flow', item: 'FL-003' });
    assert.deepEqual(
      [held.status, held.json.diagram, held.json.target, held.json.element, held.json.item],
      [201, idOf('dg', made.get('FL-001').id), 'element', 'FL-003', 'FL-003'],
    );
    assert.equal(count('comment_threads'), threads + 5);

    // Two diagrams named by one ID: diagram_ambiguous, naming them in the stage's order.
    const twice = await send({ stage: '03-user-flow', item: 'FL-007' });
    assert.deepEqual([twice.status, twice.json.code], [409, 'diagram_ambiguous']);
    assert.deepEqual(twice.json.diagrams, [idOf('dg', made.get('FL-007').id), idOf('dg', made.get('FL-007 again').id)]);
    // An ID no element holds and no drawn file diagram of the stage is named by stays item_not_found: an unknown one, a
    // removed flow's, a screen that never drew, another diagram's with diagram, a picture that is no file's, and an ID
    // that a name starts with but goes on past.
    for (const body of [
      { stage: '03-user-flow', item: 'FL-404' },
      { stage: '03-user-flow', item: 'FL-009' },
      { stage: '08-screen-states', item: 'SCR-145' },
      { stage: '03-user-flow', diagram: idOf('dg', made.get('FL-001').id), item: 'FL-005' },
      { stage: '05-erd', item: 'TBL-151' },
      // A name that starts with more than the ID: "FL-011a A draft" is named by no trace ID.
      { stage: '03-user-flow', item: 'FL-011' },
    ]) {
      const refused = await send(body);
      assert.deepEqual([refused.status, refused.json.code, refused.json.items], [404, 'item_not_found', [body.item]], JSON.stringify(body));
    }
    assert.equal(count('comment_threads'), threads + 5);
  });

  test('a comment refused by what it names gets the 404 of that, and nothing is written', async () => {
    const threads = count('comment_threads');
    const cases = [
      // Not drawn yet, removed, never drawn, or no diagram of the stage, part or project.
      [{ part: 'nexus', stage: '07-sitemap', item: '', text: 'x' }, 'diagram_not_found'],
      [{ part: 'nexus', stage: '01-domain', item: '', text: 'x' }, 'diagram_not_found'],
      [{ part: 'nexus', stage: '03-user-flow', diagram: idOf('dg', removedFlow.id), item: '', text: 'x' }, 'diagram_not_found'],
      [{ part: 'nexus', stage: '03-user-flow', diagram: idOf('dg', erd.id), item: '', text: 'x' }, 'diagram_not_found'],
      [{ part: 'nexus', stage: '08-screen-states', diagram: idOf('dg', failedScreen.id), item: '', text: 'x' }, 'diagram_not_found'],
      [{ part: 'nexus', stage: '03-user-flow', diagram: idOf('dg', 999_999), item: '', text: 'x' }, 'diagram_not_found'],
      [{ part: '', stage: '05-erd', item: '', text: 'x' }, 'diagram_not_found'],
      // The stage's first diagram never drew: the comment does not move to another one.
      [{ part: 'nexus', stage: '08-screen-states', item: '', text: 'x' }, 'diagram_not_found'],
      [erdComment({ item: 'TBL-148' }), 'item_not_found'],
      [{ part: 'nexus', stage: '03-user-flow', diagram: idOf('dg', commentFlow.id), item: 'FL-002', text: 'x' }, 'item_not_found'],
      [{ part: 'nexus', stage: '03-user-flow', item: 'FL-404', text: 'x' }, 'item_not_found'],
      [erdComment({ part: 'other' }), 'part_not_found'],
      [erdComment({ discrepancy: newId('nd') }), 'discrepancy_not_found'],
    ];
    for (const [body, code] of cases) {
      const refused = await comment(body);
      assert.deepEqual([refused.status, refused.json.code], [404, code], JSON.stringify(body));
      if (code === 'item_not_found') assert.deepEqual(refused.json.items, [body.item]);
    }
    const missing = await comment(erdComment(), { project: 'no-such-project' });
    assert.deepEqual([missing.status, missing.json.code], [404, 'project_not_found']);
    assert.equal(count('comment_threads'), threads);
  });

  test('a write on a thread needs a thread of the project, and a project with a space', async () => {
    const { id } = waiting();
    const other = s.project('other');
    const elsewhere = s.thread(s.diagram(other));
    for (const send of [
      (thread, options) => reply(thread, { text: 'x' }, options),
      (thread, options) => answered(thread, options),
      (thread, options) => decide(thread, { link: LINK }, options),
    ]) {
      for (const thread of [idOf('nc', elsewhere), idOf('nc', 999_999), 'nc_0', newId('np')]) {
        const refused = await send(thread);
        assert.deepEqual([refused.status, refused.json.code], [404, 'comment_not_found'], thread);
      }
      const missing = await send(id, { project: 'no-such-project' });
      assert.deepEqual([missing.status, missing.json.code], [404, 'project_not_found']);
    }
  });

  test('a body out of the contract\'s form is refused, naming its field and never its value', async () => {
    const { thread, id } = waiting();
    const threads = count('comment_threads');
    const secretish = 'value-that-must-not-come-back';
    const refusals = [
      [comment, erdComment({ text: '' }), 'invalid_request', 'text'],
      [comment, erdComment({ text: ' \n\t ' }), 'invalid_request', 'text'],
      [comment, erdComment({ text: 'x'.repeat(4001) }), 'text_too_long', 'text', 4000],
      [comment, erdComment({ quote: 'q'.repeat(4001) }), 'text_too_long', 'quote', 4000],
      [comment, erdComment({ text: 7 }), 'invalid_request', 'text'],
      [comment, erdComment({ text: '\uD800' }), 'invalid_request', 'text'],
      [comment, erdComment({ extra: secretish }), 'invalid_request', 'body'],
      [comment, { stage: '05-erd', item: '', text: 'x' }, 'invalid_request', 'part'],
      [comment, erdComment({ part: 'Not A Part' }), 'invalid_request', 'part'],
      [comment, erdComment({ stage: '14-later' }), 'invalid_request', 'stage'],
      [comment, { part: 'nexus', stage: '05-erd', text: 'x' }, 'invalid_request', 'item'],
      [comment, erdComment({ item: secretish }), 'invalid_request', 'item'],
      [comment, erdComment({ diagram: secretish }), 'invalid_request', 'diagram'],
      [comment, erdComment({ commit: 'abc' }), 'invalid_request', 'commit'],
      [comment, erdComment({ asks: 'maybe' }), 'invalid_request', 'asks'],
      [comment, erdComment({ look_first: 'TBL-146' }), 'invalid_request', 'look_first'],
      // A checkpoint request has no item, at most 10 lines and 1,200 characters, and look_first.
      [comment, erdComment({ asks: 'checkpoint', look_first: 'TBL-146' }), 'invalid_request', 'item'],
      [comment, erdComment({ item: '', asks: 'checkpoint', look_first: 'TBL-146', text: 'line\n'.repeat(10) + 'eleven' }), 'invalid_request', 'text'],
      [comment, erdComment({ item: '', asks: 'checkpoint', look_first: 'TBL-146', text: 'x'.repeat(1201) }), 'text_too_long', 'text', 1200],
      [comment, erdComment({ item: '', asks: 'checkpoint' }), 'invalid_request', 'look_first'],
      [comment, erdComment({ item: '', asks: 'checkpoint', look_first: 'http://example.com' }), 'invalid_request', 'look_first'],
      [comment, erdComment({ item: '', asks: 'checkpoint', look_first: 'https://example.com/\uD800' }), 'invalid_request', 'look_first'],
      [(body, options) => reply(id, body, options), { text: '' }, 'invalid_request', 'text'],
      [(body, options) => reply(id, body, options), { text: 'x'.repeat(4001) }, 'text_too_long', 'text', 4000],
      [(body, options) => reply(id, body, options), { text: 'x', item: 'TBL-146' }, 'invalid_request', 'body'],
      [(body, options) => reply(id, body, options), { text: 'x', look_first: secretish }, 'invalid_request', 'look_first'],
      [(body, options) => answered(id, { ...options, body }), { text: 'done' }, 'invalid_request', 'body'],
      [(body, options) => decide(id, body, options), { text: 'no link' }, 'invalid_request', 'link'],
      [(body, options) => decide(id, body, options), { link: `http://${secretish}` }, 'invalid_request', 'link'],
      // A link with a lone surrogate would stand as the entry's text, which the store keeps as another text.
      [(body, options) => decide(id, body, options), { link: `${LINK}\uD800` }, 'invalid_request', 'link'],
      [(body, options) => reply(id, body, options), { text: 'x', look_first: 'https://example.com/\uD800' }, 'invalid_request', 'look_first'],
      [(body, options) => decide(id, body, options), { link: LINK, text: 'x'.repeat(4001) }, 'text_too_long', 'text', 4000],
      [(body, options) => decide(id, body, options), { link: LINK, text: 3 }, 'invalid_request', 'text'],
    ];
    for (const [send, body, code, field, limit] of refusals) {
      const refused = await send(body, {});
      const where = `${JSON.stringify(body).slice(0, 80)} → ${code} ${field}`;
      assert.deepEqual([refused.status, refused.json.code, refused.json.field], [400, code, field], where);
      if (limit !== undefined) assert.equal(refused.json.limit, limit, where);
      assert.equal(refused.text.includes(secretish), false, where);
    }
    // Every write needs its session label and its request key.
    for (const send of [(options) => comment(erdComment(), options), (options) => reply(id, { text: 'x' }, options),
      (options) => answered(id, options), (options) => decide(id, { link: LINK }, options)]) {
      for (const [options, field] of [[{ session: null }, 'Nexus-Session'], [{ session: 'has space' }, 'Nexus-Session'], [{ key: null }, 'Idempotency-Key']]) {
        const refused = await send(options);
        assert.deepEqual([refused.status, refused.json.code, refused.json.field], [400, 'invalid_request', field]);
        assert.equal(refused.text.includes('has space'), false);
      }
    }
    assert.equal(count('comment_threads'), threads);
    assert.equal(commentsOf(thread).length, 1);
    assert.deepEqual(threadRow(thread), { state: 'open', waits_on: 'agent', closed_by: null });
  });

  test('a request key sent again answers the first answer and writes nothing; with another body it is refused (rule 3)', async () => {
    const key = `"${newId('nw')}"`;
    const first = await comment(erdComment({ text: 'Once.' }), { key });
    const threads = count('comment_threads');
    const again = await comment(erdComment({ text: 'Once.' }), { key });
    assert.deepEqual([again.status, again.json], [first.status, first.json]);
    assert.equal(count('comment_threads'), threads);
    const reused = await comment(erdComment({ text: 'Twice.' }), { key });
    assert.deepEqual([reused.status, reused.json.code], [409, 'request_key_reused']);
    const { id } = waiting();
    for (const [send, body] of [[reply, { text: 'Once.' }], [(thread, sent, options) => answered(thread, { ...options, body: sent }), {}], [decide, { link: LINK }]]) {
      const own = `"${newId('nw')}"`;
      const done = await send(id, body, { key: own });
      const repeated = await send(id, body, { key: own });
      assert.deepEqual([repeated.status, repeated.json], [done.status, done.json]);
      const other = await send(id, { ...body, text: 'Another.' }, { key: own });
      assert.deepEqual([other.status, other.json.code], [409, 'request_key_reused']);
    }
  });

  test('refuses a body that is not JSON or too large', async () => {
    const { id } = waiting();
    const paths = [
      ['leaveComment', `/api/spaces/${space.name}/comments`],
      ['replyToComment', threadPath(id, 'replies')],
      ['markAnswered', threadPath(id, 'answered')],
      ['recordDecision', threadPath(id, 'decisions')],
    ];
    for (const [action, path] of paths) {
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
    const { id } = waiting();
    for (const send of [(options) => comment(erdComment(), options), (options) => reply(id, { text: 'x' }, options),
      (options) => answered(id, options), (options) => decide(id, { link: LINK }, options)]) {
      const none = await send({ headers: {} });
      assert.deepEqual([none.status, none.json.code], [401, 'access_missing']);
      const owner = await send({ headers: { 'Cf-Access-Jwt-Assertion': local.token() } });
      assert.deepEqual([owner.status, owner.json.code], [403, 'agent_only']);
    }
  });

  test('answers internal when the store fails, and changes nothing', async (t) => {
    const store = testStore(t);
    const failing = seed(store);
    const broken = failing.project('broken');
    const where = failing.diagram(broken);
    const thread = failing.thread(where);
    threadChanged(store, { project: broken.id, thread, time: TIME });
    // A store whose comment statements cannot be prepared, as when the disk fails.
    const failingStore = new Proxy(store, {
      get(target, name) {
        const value = Reflect.get(target, name, target);
        if (name === 'prepare') {
          return (sql) => {
            if (sql.includes('INSERT INTO comments')) throw new Error('the store failed');
            return target.prepare(sql);
          };
        }
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const other = await startServer({ store: failingStore, gate: local.gate, routes: ROUTES });
    t.after(() => other.close());
    const headers = { ...failing.agent.headers, 'Content-Type': 'application/json', 'Nexus-Session': S1 };
    const id = idOf('nc', thread);
    const sent = [
      ['leaveComment', '/api/spaces/broken/comments', { part: '', stage: '05-erd', item: '', text: 'x' }],
      ['replyToComment', `/api/spaces/broken/comments/${id}/replies`, { text: 'x' }],
      ['markAnswered', `/api/spaces/broken/comments/${id}/answered`, {}],
      ['recordDecision', `/api/spaces/broken/comments/${id}/decisions`, { link: LINK }],
    ];
    for (const [action, path, body] of sent) {
      const answer = responses.note(action, await other.send({
        method: 'POST', path, headers: { ...headers, 'Idempotency-Key': `"${newId('nw')}"` }, body: JSON.stringify(body),
      }));
      assert.deepEqual([answer.status, answer.json.code], [500, 'internal']);
    }
    const lines = await other.logged(4);
    assert.deepEqual(lines.map((line) => line.error), ['Error', 'Error', 'Error', 'Error']);
    assert.equal(other.logText().includes('the store failed'), false);
    assert.equal(store.prepare('SELECT count(*) AS n FROM comments').get().n, 1);
    assert.equal(store.prepare('SELECT count(*) AS n FROM request_keys').get().n, 0);
  });

  test('logs one line per request with its sender, and never a text, a session, a link or the data folder (rule 5)', async () => {
    const lines = (await server.logged(20)).filter((line) => ACTIONS.includes(line.action));
    assert.ok(lines.length >= 20);
    for (const line of lines) {
      assert.match(line.traceId, TRACE_ID);
      assert.ok([s.agent.name, 'unknown', 'owner'].includes(line.sender));
    }
    const text = server.logText();
    for (const value of [S1, S2, LINK, 'Is last_used_at needed?', 'Yes: SPEC-050', 'value-that-must-not-come-back', 'TBL-148', folder,
      folder.replaceAll('\\', '/'), JSON.stringify(folder).slice(1, -1)]) {
      assert.equal(text.includes(value), false, value);
    }
  });

  test('answer every response API-252, API-253, API-254 and API-255 list', () => {
    for (const action of ACTIONS) responses.assertEvery(action);
  });

  test('touch the tables their x-corthex.tables list, and admission only the layer\'s (note 23)', () => {
    checkTables(recorder, 'leaveComment');
    checkTables(recorder, 'replyToComment');
    checkTables(recorder, 'markAnswered');
    checkTables(recorder, 'recordDecision');
    checkLayer(recorder);
  });
});
