// The owner's threads (TASK-443; API-266 to API-269, SPEC-016, SPEC-017, SPEC-027, SPEC-028, SPEC-051, rule 3,
// rule 5): TASK-443's done condition, every response the four operations list, the thread and its entries against the
// contract, the to-do they change, the tables they touch (note 23) and their log lines. The project's diagrams,
// drawings, elements, threads and change sets are written straight into the store with test/seed.js, as the push and
// the operations of other tasks would write them.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { readDiagram } from '../src/diagram.js';
import { changeSetsChanged, threadChanged } from '../src/entries.js';
import { idOf, keyOf } from '../src/ids.js';
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
const ACTIONS = ['getThread', 'startThread', 'replyInThread', 'closeThread'];
const ERD = '/pictures/05-erd/nexus';
const FLOW = 'docs/03-user-flow/FL-001-put-a-project-on-nexus.md';
const GONE = 'docs/03-user-flow/FL-009-gone.md';
const SCREEN = 'docs/08-screens/SCR-145.md';
// The project's /snapshot document lists its file pictures with their part, so that a diagram's part is found.
const PICTURES = [FLOW, GONE].map((key) => ({ stage: '03-user-flow', key, part: 'nexus' }));
const TEXT = 'Should agent credentials keep their last use?';
const at = (ms) => new Date(ms).toISOString();

describe('the owner\'s threads', () => {
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
  let items;
  let flow;
  let gone;
  let never;
  let other;
  let otherErd;
  let clock = START;

  const owner = () => ({ 'Cf-Access-Jwt-Assertion': local.token() });
  const dg = (where) => idOf('dg', where.id);
  const dw = (drawing) => idOf('dw', drawing);
  const nc = (thread) => idOf('nc', thread);

  // Sends a request of action, the owner's unless headers say otherwise; a write with its JSON body and a request key.
  // Each request is a minute after the one before, so that each entry has its own time.
  const call = async (action, method, path, { body, raw, headers = owner(), key = `"${newId('nw')}"`, type = 'application/json' } = {}) => {
    const all = { ...headers };
    if (method === 'POST') {
      all['Content-Type'] = type;
      if (key !== null) all['Idempotency-Key'] = key;
    }
    clock += MINUTE;
    const sent = method === 'POST' ? raw ?? JSON.stringify(body) : undefined;
    return responses.note(action, await server.send({ method, path, headers: all, body: sent }));
  };
  const threadPath = (id, end = '', name = space.name) => `/api/projects/${name}/threads/${id}${end}`;
  const read = (id, options = {}) => call('getThread', 'GET', threadPath(id, '', options.project), options);
  const start = (where, body, options = {}) => call(
    'startThread', 'POST', `/api/projects/${options.project ?? space.name}/diagrams/${where}/threads`, { body, ...options },
  );
  const reply = (id, text, options = {}) => call('replyInThread', 'POST', threadPath(id, '/comments', options.project), { body: { text }, ...options });
  const close = (id, options = {}) => call('closeThread', 'POST', threadPath(id, '/close', options.project), { body: {}, ...options });
  // An agent's read of the same thread (API-246), which answers the same Thread.
  const agentRead = async (id) => (await server.send({ path: `/api/spaces/${space.name}/comments/${id}`, headers: s.agent.headers })).json;

  // An element of a drawing by its key, with its trace ID when the key is one (TBL-153).
  const element = (drawing, key, name, { status = null, traceId = key } = {}) => db.prepare(
    'INSERT INTO elements (drawing_id, element_key, trace_id, kind, name, status) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(drawing, key, traceId, 'table', name, status);
  // A thread that waits on the side given, with its to-do entry open: an agent's question waits on the owner.
  const thread = (where, options = {}) => {
    const id = s.thread(where, options);
    threadChanged(db, { project: (options.space ?? space).id, thread: id, time: TIME });
    return id;
  };
  // The thread's open to-do entries as "side kind", and every entry it ever had with how it closed.
  const open = (id) => db.prepare('SELECT side, kind FROM todos WHERE thread_id = ? AND closed_at IS NULL ORDER BY id').all(id)
    .map((row) => `${row.side} ${row.kind}`);
  const entriesOf = (id) => db.prepare('SELECT side, kind, close_reason FROM todos WHERE thread_id = ? ORDER BY id').all(id)
    .map((row) => `${row.side} ${row.kind} ${row.close_reason ?? 'open'}`);
  const threadRow = (id) => ({ ...db.prepare('SELECT state, waits_on, closed_by, closed_at FROM comment_threads WHERE id = ?').get(id) });
  const comments = (id) => db.prepare('SELECT seq, author, credential_id, body, detail FROM comments WHERE thread_id = ? ORDER BY seq')
    .all(id).map((row) => ({ ...row, credential_id: row.credential_id === null ? null : Number(row.credential_id) }));
  const count = (table) => Number(db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n);
  const listed = (id) => agentTodo(db, { name: space.name, now: clock }).comments.entries.some((entry) => entry.id === nc(id));

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-threads-'));
    ({ db } = openStore(folder));
    recorder = recordTables(db);
    local = localGate();
    server = await startServer({ store: recorder.store, gate: local.gate, now: () => clock, routes: ROUTES });
    s = seed(db);
    space = s.project('demo', { parts: ['nexus'], pictures: PICTURES });
    // The ERD's first drawing holds three tables. The next snapshot redraws it without TBL-147, and with TBL-148 drawn
    // as unreadable, so a comment made at the first drawing on either finds the element gone (SPEC-016, SPEC-027).
    erd = s.diagram(space, { sourceKey: ERD });
    element(erd.drawing, 'TBL-146', 'agent_credentials');
    element(erd.drawing, 'TBL-147', 'project_spaces');
    element(erd.drawing, 'TBL-148', 'snapshots');
    older = { drawing: erd.drawing, commit: space.commit };
    s.snapshot(space, { parts: ['nexus'], pictures: PICTURES });
    erd = { id: erd.id, drawing: s.drawing(space, erd.id) };
    element(erd.drawing, 'TBL-146', 'agent_credentials');
    element(erd.drawing, 'TBL-148', 'snapshots', { status: 'unreadable' });
    // An item table, whose elements are rows; a file diagram, whose element key is no trace ID; a removed file diagram;
    // and a screen that never drew, only failed.
    items = s.diagram(space, { stage: '02-prd', sourceKey: '/items/02-prd', kind: 'item_table', name: 'Requirements' });
    element(items.drawing, 'REQ-020', 'Comment on a diagram');
    flow = s.diagram(space, { stage: '03-user-flow', sourceKey: FLOW, kind: 'user_flow', name: 'FL-001 Put a project on NEXUS' });
    element(flow.drawing, 'step:start', 'Start', { traceId: null });
    gone = s.diagram(space, { stage: '03-user-flow', sourceKey: GONE, kind: 'user_flow', name: 'FL-009 Gone', removed: true });
    element(gone.drawing, 'step:start', 'Start', { traceId: null });
    never = s.diagram(space, { stage: '08-screen-states', sourceKey: SCREEN, kind: 'screen_states', name: 'SCR-145.md', status: 'failed' });
    other = s.project('other');
    otherErd = s.diagram(other);
  });

  after(async () => {
    await server.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  test('the owner\'s reply puts the thread on the agent to-do and takes it off the owner\'s (SPEC-017)', async () => {
    // An agent's question waits on the owner: it is on the owner's to-do and not on the agent's.
    const question = thread(erd, { author: 'agent', body: 'Is last_used_at needed?' });
    assert.deepEqual([open(question), listed(question)], [['owner question'], false]);
    const answer = await reply(nc(question), 'Keep it; the list shows it.');
    assert.equal(answer.status, 201);
    assert.deepEqual(answer.json, {
      thread: { id: nc(question), state: 'open', waits_on: 'agent', closed_by: null, last_at: at(clock) },
      entry: { seq: 2, author: 'owner', kind: 'comment', text: 'Keep it; the list shows it.', made_at: at(clock) },
    });
    assert.deepEqual([open(question), listed(question)], [['agent comment'], true]);
    assert.deepEqual(entriesOf(question), ['owner question done', 'agent comment open']);
    assert.deepEqual(threadRow(question), { state: 'open', waits_on: 'agent', closed_by: null, closed_at: null });
    // The thread has its entries in order; the owner's names no credential and keeps nothing beside its text.
    const shown = await read(nc(question));
    assert.deepEqual(shown.json.entries.map((entry) => [entry.seq, entry.author, entry.text]), [
      [1, 'agent', 'Is last_used_at needed?'], [2, 'owner', 'Keep it; the list shows it.'],
    ]);
    assert.deepEqual(comments(question)[1], { seq: 2, author: 'owner', credential_id: null, body: 'Keep it; the list shows it.', detail: '{}' });
    // A second reply while it waits on the agent is added after it; the thread still waits on the agent, with one entry.
    const again = await reply(nc(question), 'And keep the time too.');
    assert.deepEqual([again.status, again.json.entry.seq, again.json.thread.waits_on], [201, 3, 'agent']);
    assert.deepEqual(entriesOf(question), ['owner question done', 'agent comment open']);
    // When the agent writes again, the thread is the owner's question once more, and the owner's reply moves it back.
    s.comment(question, { author: 'agent', body: 'Done.' });
    threadChanged(db, { project: space.id, thread: question, time: TIME });
    assert.deepEqual([open(question), listed(question)], [['owner question'], false]);
    assert.equal((await reply(nc(question), 'Thank you.')).json.thread.waits_on, 'agent');
    assert.deepEqual([open(question), listed(question)], [['agent comment'], true]);
  });

  test('the owner\'s comment opens a thread at the drawing shown, on the agent to-do (SPEC-016, SPEC-051)', async () => {
    const answer = await start(dg(erd), { drawing: dw(erd.drawing), target: 'element', element: 'TBL-146', text: TEXT });
    assert.equal(answer.status, 201);
    const id = answer.json.id;
    const key = keyOf('nc', id);
    assert.deepEqual(answer.json, {
      id,
      part: 'nexus',
      stage: '05-erd',
      diagram: dg(erd),
      drawing: dw(erd.drawing),
      version: space.commit,
      item: 'TBL-146',
      target: 'element',
      element: 'TBL-146',
      removed_name: null,
      state: 'open',
      waits_on: 'agent',
      closed_by: null,
      opened_at: at(clock),
      closed_at: null,
      last_at: at(clock),
      entries: [{ seq: 1, author: 'owner', kind: 'comment', text: TEXT, made_at: at(clock) }],
      change_sets: [],
    });
    // On the agent to-do, not the owner's; the owner's read and the agent's read answer the same thread.
    assert.deepEqual([open(key), listed(key)], [['agent comment'], true]);
    assert.deepEqual(comments(key), [{ seq: 1, author: 'owner', credential_id: null, body: TEXT, detail: '{}' }]);
    const shown = await read(id);
    assert.deepEqual([shown.status, shown.json], [200, answer.json]);
    assert.deepEqual(await agentRead(id), answer.json);

    // On the diagram as a whole, on a row of an item table, and on a file diagram's element, whose key is no trace ID.
    const whole = await start(dg(erd), { drawing: dw(erd.drawing), target: 'diagram', text: 'The whole ERD.' });
    assert.deepEqual([whole.json.target, whole.json.element, whole.json.item, whole.json.removed_name], ['diagram', null, '', null]);
    const row = await start(dg(items), { drawing: dw(items.drawing), target: 'row', element: 'REQ-020', text: 'This requirement.' });
    assert.deepEqual([row.json.part, row.json.stage, row.json.target, row.json.element, row.json.item], ['', '02-prd', 'row', 'REQ-020', 'REQ-020']);
    const step = await start(dg(flow), { drawing: dw(flow.drawing), target: 'element', element: 'step:start', text: 'This step.' });
    assert.deepEqual([step.json.part, step.json.target, step.json.element, step.json.item], ['nexus', 'element', 'step:start', '']);
    // A phone sends the same request and gets the same answer (SPEC-051); the page draws the rest (TASK-459).
    const phone = await start(dg(erd), { drawing: dw(erd.drawing), target: 'diagram', text: 'From a phone.' }, {
      headers: { ...owner(), 'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36' },
    });
    assert.deepEqual([phone.status, phone.json.waits_on, phone.json.entries.length], [201, 'agent', 1]);
  });

  test('an element that left the drawing gets the thread on the diagram, marked from the removed element (SPEC-016, SPEC-027)', async () => {
    // At the first drawing: TBL-147 is gone from the current drawing, and TBL-148 is drawn there as unreadable.
    const left = await start(dg(erd), { drawing: dw(older.drawing), target: 'element', element: 'TBL-147', text: 'Is it gone?' });
    assert.deepEqual(
      [left.status, left.json.drawing, left.json.version, left.json.target, left.json.element, left.json.removed_name, left.json.item],
      [201, dw(older.drawing), older.commit, 'diagram', 'TBL-147', 'project_spaces', ''],
    );
    const unreadable = await start(dg(erd), { drawing: dw(older.drawing), target: 'element', element: 'TBL-148', text: 'Unreadable now.' });
    assert.deepEqual([unreadable.json.target, unreadable.json.element, unreadable.json.removed_name], ['diagram', 'TBL-148', 'snapshots']);
    // TBL-146 is still drawn: the thread is on it, at the version the owner saw.
    const kept = await start(dg(erd), { drawing: dw(older.drawing), target: 'element', element: 'TBL-146', text: 'Still here.' });
    assert.deepEqual([kept.json.target, kept.json.element, kept.json.version], ['element', 'TBL-146', older.commit]);
    // The diagram read lists the moved thread on the diagram with its last name.
    const brief = readDiagram(db, space.name, dg(erd)).threads.find((each) => each.id === left.json.id);
    assert.deepEqual([brief.target, brief.element, brief.removed_name], ['diagram', 'TBL-147', 'project_spaces']);
    // Renamed and then removed: the mark is the element's last readable name, as a thread the push moved is marked
    // (after-drawing.js), not its name at the drawing the owner saw. Its own space keeps the other tests' snapshots.
    const renamed = s.project('renamed');
    const diagram = s.diagram(renamed);
    element(diagram.drawing, 'TBL-149', 'blobs');
    s.snapshot(renamed);
    element(s.drawing(renamed, diagram.id), 'TBL-149', 'document_blobs');
    s.snapshot(renamed);
    element(s.drawing(renamed, diagram.id), 'TBL-146', 'agent_credentials');
    const request = { drawing: dw(diagram.drawing), target: 'element', element: 'TBL-149', text: 'Renamed?' };
    const marked = await start(dg(diagram), request, { project: renamed.name });
    assert.deepEqual(
      [marked.status, marked.json.drawing, marked.json.target, marked.json.element, marked.json.removed_name],
      [201, dw(diagram.drawing), 'diagram', 'TBL-149', 'document_blobs'],
    );
  });

  test('a drawing that failed takes a comment on the diagram as a whole, at its version; an element there is not found', async () => {
    const failed = Number(db.prepare('SELECT id FROM drawings WHERE diagram_id = ?').get(never.id).id);
    const answer = await start(dg(never), { drawing: dw(failed), target: 'diagram', text: 'Fix the screen so that it draws.' });
    assert.deepEqual(
      [answer.status, answer.json.part, answer.json.drawing, answer.json.version, answer.json.target, answer.json.item],
      [201, '', dw(failed), space.commit, 'diagram', ''],
    );
    assert.deepEqual(open(keyOf('nc', answer.json.id)), ['agent comment']);
    // The diagram read lists it on the diagram as a whole, and a read of the thread names the failed drawing and its
    // version, the commit whose document did not draw.
    const brief = readDiagram(db, space.name, dg(never)).threads.find((each) => each.id === answer.json.id);
    assert.deepEqual([brief.target, brief.element, brief.state], ['diagram', null, 'open']);
    assert.deepEqual([(await agentRead(answer.json.id)).drawing, (await read(answer.json.id)).json.version], [dw(failed), space.commit]);
    // A failed drawing has no elements.
    const none = await start(dg(never), { drawing: dw(failed), target: 'element', element: 'SCR-145', text: 'This state.' });
    assert.deepEqual([none.status, none.json.code, none.json.element], [404, 'element_not_found', 'SCR-145']);
  });

  test('a removed diagram takes no new thread, and its threads are read, answered and closed (SPEC-027)', async () => {
    const question = thread(gone, { author: 'agent', elementKey: 'step:start', body: 'Should this flow come back?' });
    const was = count('comment_threads');
    const refused = await start(dg(gone), { drawing: dw(gone.drawing), target: 'diagram', text: 'A new thread.' });
    assert.deepEqual([refused.status, refused.json.code, count('comment_threads')], [404, 'diagram_not_found', was]);
    assert.deepEqual((await read(nc(question))).json.entries.length, 1);
    const answered = await reply(nc(question), 'No; it was merged into FL-001.');
    assert.deepEqual([answered.status, answered.json.thread.waits_on], [201, 'agent']);
    // Closing its last open thread: the diagram read now answers diagram_not_found (TASK-441), and the thread is still
    // read, as any thread of the project is (API-246, API-266).
    assert.notEqual(typeof readDiagram(db, space.name, dg(gone)), 'string');
    const closed = await close(nc(question));
    assert.deepEqual([closed.status, closed.json.changed, closed.json.thread.state], [200, true, 'closed']);
    assert.equal(readDiagram(db, space.name, dg(gone)), 'diagram_not_found');
    const shown = await read(nc(question));
    assert.deepEqual([shown.status, shown.json.state, shown.json.closed_by, shown.json.entries.length], [200, 'closed', 'owner', 2]);
  });

  test('closing takes the thread off both to-dos; closed again, it answers changed false (SPEC-028)', async () => {
    // An owner's thread that waits on the agent, whose comment entry a session claims.
    const asked = thread(erd, { body: 'Rename it?' });
    const entry = Number(db.prepare("SELECT id FROM todos WHERE thread_id = ? AND kind = 'comment'").get(asked).id);
    s.claim(space, entry, { session: 'claude-code-4f2a91', claimedAt: at(clock), lastWriteAt: at(clock) });
    const claims = () => db.prepare('SELECT session, released_at, release_reason FROM claims WHERE todo_id = ?').all(entry).map((row) => ({ ...row }));
    const held = claims();
    const lastAt = db.prepare('SELECT created_at FROM comments WHERE thread_id = ? ORDER BY seq DESC LIMIT 1').get(asked).created_at;
    const answer = await close(nc(asked));
    const closedAt = threadRow(asked).closed_at;
    assert.deepEqual([answer.status, answer.json], [200, {
      thread: { id: nc(asked), state: 'closed', waits_on: null, closed_by: 'owner', last_at: lastAt }, changed: true,
    }]);
    assert.deepEqual(threadRow(asked), { state: 'closed', waits_on: null, closed_by: 'owner', closed_at: at(clock) });
    assert.deepEqual([open(asked), entriesOf(asked), listed(asked)], [[], ['agent comment done'], false]);
    // The claim's row stays as it was; it holds nothing once its entry is closed (claims.js).
    assert.deepEqual(claims(), held);
    // Closed again: changed false, nothing changes.
    const again = await close(nc(asked));
    assert.deepEqual([again.status, again.json], [200, { ...answer.json, changed: false }]);
    assert.equal(threadRow(asked).closed_at, closedAt);
    // A thread a reflection closed stays closed by the reflection.
    const reflected = thread(erd, { author: 'agent' });
    s.closeThread(reflected, { by: 'reflection' });
    threadChanged(db, { project: space.id, thread: reflected, time: TIME });
    const byReflection = await close(nc(reflected));
    assert.deepEqual([byReflection.json.changed, byReflection.json.thread.closed_by], [false, 'reflection']);
    // A closed thread takes no reply: a new comment starts a new thread (SPEC-017). There is no reopening.
    const refused = await reply(nc(asked), 'One more thing.');
    assert.deepEqual([refused.status, refused.json.code, comments(asked).length, threadRow(asked).state], [409, 'thread_closed', 1, 'closed']);
  });

  test('closing a thread leaves a proposal that answers it as it is', async () => {
    const asked = thread(erd, { author: 'agent', body: 'Rename agent_credentials to credentials?' });
    const proposal = s.changeSet(space, erd, { origin: 'proposal', threadId: asked });
    changeSetsChanged(db, { project: space.id, diagram: erd.id, time: TIME });
    const proposals = () => db.prepare("SELECT count(*) AS n FROM todos WHERE change_set_id = ? AND kind = 'proposal' AND closed_at IS NULL")
      .get(proposal).n;
    assert.equal(proposals(), 1);
    assert.equal((await close(nc(asked))).json.changed, true);
    const state = db.prepare('SELECT state FROM change_sets WHERE id = ?').get(proposal).state;
    assert.deepEqual([state, proposals(), threadRow(asked).state], ['proposed', 1, 'closed']);
  });

  // TASK-444 builds API-270 and API-271: until then this test is a to-do, and that task drops the mark.
  test('accepting or rejecting a proposal after its thread closed leaves the thread closed', {
    todo: 'TASK-444 builds accepting and rejecting a proposal (API-270, API-271)',
  }, async () => {
    for (const decision of ['accept', 'reject']) {
      const asked = thread(erd, { author: 'agent', body: `Shall I ${decision} it?` });
      const proposal = s.changeSet(space, erd, { origin: 'proposal', threadId: asked });
      changeSetsChanged(db, { project: space.id, diagram: erd.id, time: TIME });
      await close(nc(asked));
      const answer = await server.send({
        method: 'POST',
        path: `/api/projects/${space.name}/change-sets/${idOf('np', proposal)}/${decision}`,
        headers: { ...owner(), 'Content-Type': 'application/json', 'Idempotency-Key': `"${newId('nw')}"` },
        body: '{}',
      });
      assert.equal(answer.status, 200, decision);
      assert.deepEqual([threadRow(asked).state, threadRow(asked).closed_by, open(asked)], ['closed', 'owner', []], decision);
    }
  });

  test('refuses a comment whose fields are not the contract\'s, or whose target is not found, and opens nothing', async () => {
    const was = count('comment_threads');
    const drawing = dw(erd.drawing);
    for (const [body, field] of [
      [{ target: 'diagram', text: TEXT }, 'drawing'],
      [{ drawing: 'dw_0', target: 'diagram', text: TEXT }, 'drawing'],
      [{ drawing, text: TEXT }, 'target'],
      [{ drawing, target: 'table', text: TEXT }, 'target'],
      [{ drawing, target: 'diagram', element: 'TBL-146', text: TEXT }, 'element'],
      [{ drawing, target: 'element', text: TEXT }, 'element'],
      [{ drawing, target: 'element', element: ' TBL-146', text: TEXT }, 'element'],
      [{ drawing, target: 'row', element: 'TBL-146', text: TEXT }, 'target'],
      [{ drawing, target: 'diagram' }, 'text'],
      [{ drawing, target: 'diagram', text: ' \n ' }, 'text'],
      [{ drawing, target: 'diagram', text: 5 }, 'text'],
      [{ drawing, target: 'diagram', text: TEXT, item: 'TBL-146' }, 'body'],
    ]) {
      const answer = await start(dg(erd), body);
      assert.deepEqual([answer.status, answer.json.code, answer.json.field], [400, 'invalid_request', field], JSON.stringify(body));
    }
    // An item table's rows are rows, not elements.
    const asElement = await start(dg(items), { drawing: dw(items.drawing), target: 'element', element: 'REQ-020', text: TEXT });
    assert.deepEqual([asElement.status, asElement.json.field], [400, 'target']);
    const empty = await start(dg(erd), { drawing, target: 'diagram', text: '' });
    assert.equal(empty.json.detail, 'text must not be empty');
    const long = await start(dg(erd), { drawing, target: 'diagram', text: 'x'.repeat(4001) });
    assert.deepEqual([long.status, long.json.code, long.json.field, long.json.limit], [400, 'text_too_long', 'text', 4000]);
    assert.equal((await start(dg(erd), { drawing, target: 'diagram', text: 'x'.repeat(4000) })).status, 201);

    for (const [where, body, code] of [
      [dg(otherErd), { drawing: dw(otherErd.drawing), target: 'diagram', text: TEXT }, 'diagram_not_found'],
      [idOf('dg', 999_999), { drawing, target: 'diagram', text: TEXT }, 'diagram_not_found'],
      ['dg_0', { drawing, target: 'diagram', text: TEXT }, 'diagram_not_found'],
      [dg(erd), { drawing: dw(items.drawing), target: 'diagram', text: TEXT }, 'drawing_not_found'],
      [dg(erd), { drawing: idOf('dw', 999_999), target: 'diagram', text: TEXT }, 'drawing_not_found'],
      [dg(erd), { drawing, target: 'element', element: 'TBL-147', text: TEXT }, 'element_not_found'],
    ]) {
      const answer = await start(where, body);
      assert.deepEqual([answer.status, answer.json.code], [404, code], `${where} ${JSON.stringify(body)}`);
      if (code === 'element_not_found') assert.equal(answer.json.element, 'TBL-147');
    }
    const project = await start(dg(erd), { drawing, target: 'diagram', text: TEXT }, { project: 'no-such-project' });
    assert.deepEqual([project.status, project.json.code], [404, 'project_not_found']);
    assert.equal(count('comment_threads'), was + 1);
  });

  test('refuses a reply or a close that is not the contract\'s, or of a thread not found, and changes nothing', async () => {
    const asked = thread(erd, { author: 'agent' });
    const otherThread = thread(otherErd, { space: other });
    const was = [count('comments'), count('todos'), threadRow(asked)];
    for (const [body, field, code] of [
      [{}, 'text', 'invalid_request'],
      [{ text: '' }, 'text', 'invalid_request'],
      [{ text: TEXT, asks: 'answer' }, 'body', 'invalid_request'],
      [{ text: 'x'.repeat(4001) }, 'text', 'text_too_long'],
    ]) {
      const answer = await call('replyInThread', 'POST', threadPath(nc(asked), '/comments'), { body });
      assert.deepEqual([answer.status, answer.json.code, answer.json.field], [400, code, field], JSON.stringify(body));
    }
    for (const body of [{ text: TEXT }, { changed: true }]) {
      const answer = await close(nc(asked), { body });
      assert.deepEqual([answer.status, answer.json.code, answer.json.field], [400, 'invalid_request', 'body']);
    }
    for (const id of [nc(otherThread), nc(999_999), 'nc_0']) {
      for (const answer of [await reply(id, TEXT), await close(id), await read(id)]) {
        assert.deepEqual([answer.status, answer.json.code], [404, 'thread_not_found'], id);
      }
    }
    for (const answer of [
      await reply(nc(asked), TEXT, { project: 'no-such-project' }),
      await close(nc(asked), { project: 'no-such-project' }),
      await read(nc(asked), { project: 'no-such-project' }),
    ]) {
      assert.deepEqual([answer.status, answer.json.code], [404, 'project_not_found']);
      assert.equal(answer.json.detail.includes('no-such-project'), false);
    }
    assert.deepEqual([count('comments'), count('todos'), threadRow(asked)], was);
  });

  test('a request key answers its first answer again, and another action with it is refused (rule 3)', async () => {
    const key = `"${newId('nw')}"`;
    const body = { drawing: dw(erd.drawing), target: 'diagram', text: 'Once only.' };
    const first = await start(dg(erd), body, { key });
    const threads = count('comment_threads');
    const repeat = await start(dg(erd), body, { key });
    assert.deepEqual([repeat.status, repeat.json, count('comment_threads')], [201, first.json, threads]);
    const reused = await start(dg(erd), { ...body, text: 'Another comment.' }, { key });
    assert.deepEqual([reused.status, reused.json.code, count('comment_threads')], [409, 'request_key_reused', threads]);

    const replyKey = `"${newId('nw')}"`;
    const replied = await reply(first.json.id, 'Once.', { key: replyKey });
    const repeatReply = await reply(first.json.id, 'Once.', { key: replyKey });
    assert.deepEqual([repeatReply.status, repeatReply.json, comments(keyOf('nc', first.json.id)).length], [201, replied.json, 2]);
    const reusedReply = await reply(first.json.id, 'Twice.', { key: replyKey });
    assert.deepEqual([reusedReply.status, reusedReply.json.code], [409, 'request_key_reused']);

    const closeKey = `"${newId('nw')}"`;
    const closed = await close(first.json.id, { key: closeKey });
    assert.deepEqual([closed.json.changed, (await close(first.json.id, { key: closeKey })).json], [true, closed.json]);
    const second = await start(dg(erd), { ...body, text: 'A second thread.' });
    const reusedClose = await close(second.json.id, { key: closeKey });
    assert.deepEqual([reusedClose.status, reusedClose.json.code, threadRow(keyOf('nc', second.json.id)).state], [409, 'request_key_reused', 'open']);
  });

  test('refuses a body that is not JSON or too large, and changes nothing', async () => {
    const asked = thread(erd, { author: 'agent' });
    const was = [count('comment_threads'), count('comments')];
    const paths = [
      ['startThread', `/api/projects/${space.name}/diagrams/${dg(erd)}/threads`],
      ['replyInThread', threadPath(nc(asked), '/comments')],
      ['closeThread', threadPath(nc(asked), '/close')],
    ];
    for (const [action, path] of paths) {
      const wrongType = await call(action, 'POST', path, { raw: '{}', type: 'text/plain' });
      assert.deepEqual([wrongType.status, wrongType.json.code], [415, 'json_required'], action);
      const { answers } = await exchange(server.port, [head('POST', path, {
        'Content-Type': 'application/json', ...owner(), 'Idempotency-Key': `"${newId('nw')}"`, 'Content-Length': 2 * MiB + 1,
      })]);
      responses.note(action, answers[0]);
      assert.deepEqual([answers[0].status, answers[0].json.code, answers[0].json.limit], [413, 'body_too_large', 2 * MiB], action);
      const notObject = await call(action, 'POST', path, { raw: '[]' });
      assert.deepEqual([notObject.status, notObject.json.code, notObject.json.field], [400, 'invalid_request', 'body'], action);
    }
    assert.deepEqual([count('comment_threads'), count('comments')], was);
  });

  test('refuses a request without the owner\'s sign-in, of another person, with an agent credential or from another site', async () => {
    const asked = thread(erd, { author: 'agent' });
    const was = [count('comment_threads'), count('comments'), threadRow(asked)];
    const someone = { 'Cf-Access-Jwt-Assertion': local.token({ email: 'someone@example.org' }) };
    const sends = [
      (headers) => read(nc(asked), { headers }),
      (headers) => start(dg(erd), { drawing: dw(erd.drawing), target: 'diagram', text: TEXT }, { headers }),
      (headers) => reply(nc(asked), TEXT, { headers }),
      (headers) => close(nc(asked), { headers }),
    ];
    for (const sendAs of sends) {
      for (const [headers, status, code] of [[{}, 401, 'unauthenticated'], [someone, 403, 'not_owner'], [s.agent.headers, 403, 'owner_only']]) {
        const answer = await sendAs(headers);
        assert.deepEqual([answer.status, answer.json.code], [status, code]);
      }
    }
    for (const sendAs of sends.slice(1)) {
      for (const site of ['cross-site', 'same-site']) {
        const answer = await sendAs({ ...owner(), 'Sec-Fetch-Site': site });
        assert.deepEqual([answer.status, answer.json.code], [403, 'cross_site']);
      }
    }
    assert.deepEqual([count('comment_threads'), count('comments'), threadRow(asked)], was);
  });

  test('answers internal when the store fails, and changes nothing', async (t) => {
    const store = testStore(t);
    const failing = seed(store);
    const broken = failing.project('broken');
    const where = failing.diagram(broken);
    const asked = failing.thread(where, { author: 'agent' });
    threadChanged(store, { project: broken.id, thread: asked, time: TIME });
    // A store whose thread statements cannot be prepared, as when the disk fails.
    const failingStore = new Proxy(store, {
      get(target, name) {
        const value = Reflect.get(target, name, target);
        if (name === 'prepare') {
          return (sql) => {
            if (sql.includes('comment_threads')) throw new Error('the store failed');
            return target.prepare(sql);
          };
        }
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const third = await startServer({ store: failingStore, gate: local.gate, routes: ROUTES });
    t.after(() => third.close());
    const write = { 'Content-Type': 'application/json', ...owner() };
    const sent = [
      ['getThread', 'GET', `/api/projects/broken/threads/${nc(asked)}`, undefined],
      ['startThread', 'POST', `/api/projects/broken/diagrams/${dg(where)}/threads`, { drawing: dw(where.drawing), target: 'diagram', text: 'x' }],
      ['replyInThread', 'POST', `/api/projects/broken/threads/${nc(asked)}/comments`, { text: 'x' }],
      ['closeThread', 'POST', `/api/projects/broken/threads/${nc(asked)}/close`, {}],
    ];
    for (const [action, method, path, body] of sent) {
      const headers = method === 'GET' ? owner() : { ...write, 'Idempotency-Key': `"${newId('nw')}"` };
      const answer = responses.note(action, await third.send({ method, path, headers, body: body === undefined ? undefined : JSON.stringify(body) }));
      assert.deepEqual([answer.status, answer.json.code], [500, 'internal'], action);
    }
    const lines = await third.logged(4);
    assert.deepEqual(lines.map((line) => line.error), ['Error', 'Error', 'Error', 'Error']);
    assert.equal(third.logText().includes('the store failed'), false);
    assert.deepEqual([store.prepare('SELECT count(*) AS n FROM comments').get().n, store.prepare('SELECT count(*) AS n FROM request_keys').get().n], [1, 0]);
  });

  test('logs one line per request with its sender, and never a comment\'s text or the data folder (rule 5)', async () => {
    const lines = (await server.logged(20)).filter((line) => ACTIONS.includes(line.action));
    assert.ok(lines.length >= 20);
    for (const line of lines) {
      assert.match(line.traceId, TRACE_ID);
      assert.ok(['owner', 'unknown', s.agent.name].includes(line.sender), line.sender);
    }
    const text = server.logText();
    for (const value of [TEXT, 'Keep it; the list shows it.', 'Fix the screen so that it draws.', 'This requirement.', folder,
      folder.replaceAll('\\', '/'), JSON.stringify(folder).slice(1, -1)]) {
      assert.equal(text.includes(value), false, value);
    }
  });

  test('answer every response API-266, API-267, API-268 and API-269 list', () => {
    for (const action of ACTIONS) responses.assertEvery(action);
  });

  test('touch the tables their x-corthex.tables list, and admission only the layer\'s (note 23)', () => {
    checkTables(recorder, 'getThread');
    checkTables(recorder, 'startThread');
    checkTables(recorder, 'replyInThread');
    checkTables(recorder, 'closeThread');
    checkLayer(recorder);
  });
});
