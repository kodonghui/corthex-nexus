// Answering an AI proposal (TASK-444; API-270, API-271, SPEC-019, SPEC-020, SPEC-027, note 7 of the WBS, rule 3,
// rule 5): TASK-444's done condition, every response the two operations list, the change set against the contract,
// the to-dos, the thread and the claims an answer leaves, the tables they touch (note 23) and their log lines. Each
// proposal is made by API-256, as an agent makes it, on a project of its own whose ERD test/seed.js writes; the
// drawings that follow it, a removal, a closed thread and the states it reaches later are written the same way.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { changeSetsChanged, threadChanged } from '../src/entries.js';
import { idOf, keyOf } from '../src/ids.js';
import { ROUTES } from '../src/routes.js';
import { openStore } from '../src/store.js';
import { responseRecord } from './responses.js';
import { seed, TIME } from './seed.js';
import { exchange, head, localGate, newId, startServer, testStore, TRACE_ID } from './support.js';
import { checkLayer, checkTables, recordTables } from './tables.js';

const START = Date.parse('2026-11-25T02:00:00.000Z');
const MINUTE = 60 * 1000;
const MiB = 1024 * 1024;
const S1 = 'claude-code-4f2a91';
const S2 = 'codex-7d1e';
const at = (ms) => new Date(ms).toISOString();
const ACTIONS = ['acceptProposal', 'rejectProposal'];
const CHANGE = 'Rename agent_credentials to agent_keys.';
const REASON = 'The owner asked to name the table after the term.';

describe('answering an AI proposal', () => {
  const responses = responseRecord();
  let folder;
  let db;
  let recorder;
  let local;
  let server;
  let s;
  let clock = START;
  let projects = 0;

  const owner = () => ({ 'Cf-Access-Jwt-Assertion': local.token() });

  // A project of its own with a drawn ERD of part nexus that holds TBL-146 and TBL-147: { space, erd }.
  const fresh = () => {
    projects += 1;
    const space = s.project(`answers-${projects}`, { parts: ['nexus'] });
    const erd = s.diagram(space, { sourceKey: '/pictures/05-erd/nexus' });
    s.elements(erd.drawing, [
      { key: 'TBL-146', trace_id: 'TBL-146', name: 'agent_credentials' },
      { key: 'TBL-147', trace_id: 'TBL-147', name: 'project_spaces' },
    ]);
    return { space, erd };
  };

  // An agent's proposal by API-256, renaming TBL-146: its answer's body.
  const propose = async (space, extra = {}) => {
    const answer = await server.send({
      method: 'POST',
      path: `/api/spaces/${space.name}/proposals`,
      headers: { ...s.agent.headers, 'Content-Type': 'application/json', 'Nexus-Session': S1, 'Idempotency-Key': `"${newId('nw')}"` },
      body: JSON.stringify({ part: 'nexus', stage: '05-erd', items: ['TBL-146'], reason: REASON, change: CHANGE, source_text: 'CREATE TABLE agent_keys ();', ...extra }),
    });
    assert.equal(answer.status, 201, answer.text);
    return answer.json;
  };

  // The owner's answer, action acceptProposal or rejectProposal, checked against the contract.
  const send = async (action, space, id, { body = '{}', headers = owner(), key = `"${newId('nw')}"`, type = 'application/json' } = {}) => {
    const all = { ...headers, 'Content-Type': type };
    if (key !== null) all['Idempotency-Key'] = key;
    const verb = action === 'acceptProposal' ? 'accept' : 'reject';
    const name = typeof space === 'string' ? space : space.name;
    return responses.note(action, await server.send({ method: 'POST', path: `/api/projects/${name}/change-sets/${id}/${verb}`, headers: all, body }));
  };
  const accept = (space, id, options) => send('acceptProposal', space, id, options);
  const reject = (space, id, options) => send('rejectProposal', space, id, options);

  const keyOfId = (id) => keyOf('np', id);
  // A change set reflected at the drawing it was made against, as TASK-435's push marks it (SPEC-025).
  const reflect = (key) => db.prepare("UPDATE change_sets SET state = 'reflected', reflected_drawing_id = drawing_id WHERE id = ?").run(key);
  const setRow = (id) => ({ ...db.prepare('SELECT state, decided_at, thread_id FROM change_sets WHERE id = ?').get(keyOfId(id)) });
  const entriesOf = (space) => db.prepare(
    'SELECT side, kind, change_set_id, thread_id, close_reason FROM todos WHERE project_id = ? ORDER BY id',
  ).all(space.id).map((row) => `${row.side} ${row.kind} ${row.change_set_id ?? row.thread_id} ${row.close_reason ?? 'open'}`);
  const threadRow = (thread) => ({ ...db.prepare('SELECT state, waits_on, closed_by FROM comment_threads WHERE id = ?').get(thread) });
  const commentCount = (thread) => Number(db.prepare('SELECT count(*) AS n FROM comments WHERE thread_id = ?').get(thread).n);
  const threadKey = (json) => Number(db.prepare('SELECT thread_id FROM change_sets WHERE id = ?').get(keyOfId(json.id)).thread_id);
  const agentGet = async (path) => (await server.send({ method: 'GET', path, headers: s.agent.headers })).json;
  const ownerGet = async (path) => (await server.send({ method: 'GET', path, headers: owner() })).json;
  const overlays = async (space, erd) => (await ownerGet(`/api/projects/${space.name}/diagrams/${idOf('dg', erd.id)}`)).overlays
    .map((overlay) => `${overlay.id} ${overlay.state}`);
  // Every row of the tables an answer may change, as JSON text.
  const dump = () => JSON.stringify(['change_sets', 'changes', 'comment_threads', 'comments', 'todos', 'claims']
    .map((table) => db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()));

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-answers-'));
    ({ db } = openStore(folder));
    recorder = recordTables(db);
    local = localGate();
    server = await startServer({ store: recorder.store, gate: local.gate, now: () => clock, routes: ROUTES });
    s = seed(db);
  });

  after(async () => {
    await server.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  test('an accepted proposal waits for reflection, and accepted again it answers the same (SPEC-019)', async () => {
    const { space, erd } = fresh();
    clock = START;
    const made = await propose(space);
    const thread = threadKey(made);
    const before = { thread: threadRow(thread), comments: commentCount(thread) };
    clock = START + MINUTE;
    const answer = await accept(space, made.id);
    assert.equal(answer.status, 200);
    const { change_set: set } = answer.json;
    assert.deepEqual([answer.json.changed, answer.json.pull_request], [true, null]);
    assert.deepEqual(
      [set.id, set.origin, set.state, set.made_at, set.decided_at, set.drawing, set.items, set.reason, set.change, set.source_text, set.changes],
      [made.id, 'proposal', 'accepted', at(START), at(START + MINUTE), idOf('dw', erd.drawing), ['TBL-146'], REASON, CHANGE, true, made.changes],
    );
    // It waits for reflection: the agent to-do lists its diagram's reflection entry with it, the entry the change set
    // and API-247 name.
    const todo = await agentGet(`/api/spaces/${space.name}/todo`);
    assert.deepEqual(todo.reflections.entries.map((entry) => [entry.id, entry.task, entry.change_sets]), [[set.reflection, 'reflect', [made.id]]]);
    assert.equal((await agentGet(`/api/spaces/${space.name}/proposals/${made.id}`)).reflection, set.reflection);
    assert.deepEqual(await overlays(space, erd), [`${made.id} accepted`]);
    // The owner's proposal entry is done; the thread, its question and its entries are as they were.
    const key = keyOfId(made.id);
    assert.deepEqual(entriesOf(space), [`owner proposal ${key} done`, `owner question ${thread} open`, `agent reflect ${key} open`]);
    assert.deepEqual([threadRow(thread), commentCount(thread)], [before.thread, before.comments]);
    // Accepted again, by a new request: the same change set, changed false, and nothing written.
    clock = START + 2 * MINUTE;
    const was = dump();
    const again = await accept(space, made.id);
    assert.deepEqual([again.status, again.json.changed, again.json.change_set], [200, false, set]);
    assert.equal(dump(), was);
    // Reflected since, it still answers the same: it was accepted.
    reflect(key);
    const reflected = await accept(space, made.id);
    assert.deepEqual([reflected.status, reflected.json.changed, reflected.json.change_set.state], [200, false, 'reflected']);
  });

  test('proposals accepted out of the order they were made wait and show in the order they were accepted (TASK-445)', async () => {
    const { space, erd } = fresh();
    clock = START;
    const first = await propose(space);
    clock = START + MINUTE;
    const second = await propose(space, { source_text: 'CREATE TABLE credentials ();' });
    // The owner accepts the later proposal first, then the earlier one.
    clock = START + 2 * MINUTE;
    assert.equal((await accept(space, second.id)).status, 200);
    clock = START + 3 * MINUTE;
    assert.equal((await accept(space, first.id)).status, 200);
    // The reflection applies them in the order they were accepted, so the later accepted wins, and the diagram read
    // lays it on top.
    const todo = await agentGet(`/api/spaces/${space.name}/todo`);
    assert.deepEqual(todo.reflections.entries.map((entry) => entry.change_sets), [[second.id, first.id]]);
    assert.deepEqual(await overlays(space, erd), [`${first.id} accepted`, `${second.id} accepted`]);
  });

  test('a rejected proposal\'s overlay is gone and its thread stays open, waiting where it did (SPEC-020)', async () => {
    const { space, erd } = fresh();
    // The owner asks on TBL-146; the agent answers with a proposal, so the thread waits on the owner.
    const thread = s.thread(erd);
    threadChanged(db, { project: space.id, thread, time: TIME });
    clock = START + 3 * MINUTE;
    const made = await propose(space, { comment: idOf('nc', thread) });
    assert.deepEqual(await overlays(space, erd), [`${made.id} proposed`]);
    const before = { thread: threadRow(thread), comments: commentCount(thread) };
    assert.deepEqual(before.thread, { state: 'open', waits_on: 'owner', closed_by: null });
    clock = START + 4 * MINUTE;
    const answer = await reject(space, made.id);
    assert.equal(answer.status, 200);
    const { change_set: set } = answer.json;
    assert.deepEqual(
      [answer.json.changed, answer.json.pull_request, set.state, set.decided_at, set.reflection, set.thread],
      [true, null, 'rejected', at(START + 4 * MINUTE), null, idOf('nc', thread)],
    );
    assert.deepEqual(await overlays(space, erd), []);
    assert.deepEqual([threadRow(thread), commentCount(thread)], [before.thread, before.comments]);
    // The owner's proposal entry is done, the thread's question stays, and the agent has nothing to reflect.
    const key = keyOfId(made.id);
    assert.deepEqual(entriesOf(space), [`agent comment ${thread} done`, `owner proposal ${key} done`, `owner question ${thread} open`]);
    assert.deepEqual((await agentGet(`/api/spaces/${space.name}/todo`)).reflections.entries, []);
    // The agent reads the rejection in the thread and the change set.
    const read = await agentGet(`/api/spaces/${space.name}/comments/${idOf('nc', thread)}`);
    assert.deepEqual([read.state, read.change_sets], ['open', [made.id]]);
    assert.equal((await agentGet(`/api/spaces/${space.name}/proposals/${made.id}`)).state, 'rejected');
    // Rejected again: the same change set, changed false, and nothing written.
    const was = dump();
    const again = await reject(space, made.id);
    assert.deepEqual([again.status, again.json.changed, again.json.change_set], [200, false, set]);
    assert.equal(dump(), was);
  });

  test('one already answered, withdrawn, or a direct edit gets change_set_state with its state', async () => {
    const { space, erd } = fresh();
    const rejected = await propose(space);
    assert.equal((await reject(space, rejected.id)).status, 200);
    const accepted = await propose(space);
    assert.equal((await accept(space, accepted.id)).status, 200);
    const withdrawn = await propose(space);
    const pulled = await server.send({
      method: 'POST',
      path: `/api/spaces/${space.name}/proposals/${withdrawn.id}/withdraw`,
      headers: { ...s.agent.headers, 'Content-Type': 'application/json', 'Nexus-Session': S1, 'Idempotency-Key': `"${newId('nw')}"` },
      body: '{}',
    });
    assert.equal(pulled.status, 200);
    const reflected = await propose(space);
    assert.equal((await accept(space, reflected.id)).status, 200);
    reflect(keyOfId(reflected.id));
    const edit = idOf('np', s.changeSet(space, erd));
    const was = dump();
    for (const [answerIt, id, state, detail] of [
      [accept, rejected.id, 'rejected', 'the change set is rejected'],
      [accept, withdrawn.id, 'cancelled', 'the change set is cancelled'],
      [accept, edit, 'accepted', 'a direct edit is cancelled, not answered'],
      [reject, accepted.id, 'accepted', 'the change set is accepted'],
      [reject, reflected.id, 'reflected', 'the change set is reflected'],
      [reject, withdrawn.id, 'cancelled', 'the change set is cancelled'],
      [reject, edit, 'accepted', 'a direct edit is cancelled, not answered'],
    ]) {
      const refused = await answerIt(space, id);
      assert.deepEqual([refused.status, refused.json.code, refused.json.state, refused.json.detail], [409, 'change_set_state', state, detail], `${id} ${state}`);
    }
    assert.equal(dump(), was);
  });

  test('a document changed since the proposal is refused, "ask for a new proposal", unless the diagram still shows its drawing (SPEC-019)', async () => {
    const { space, erd } = fresh();
    const made = await propose(space);
    // A push that left the diagram unchanged, and one whose drawing of it failed: it still shows the proposal's drawing.
    s.snapshot(space, { parts: ['nexus'] });
    s.snapshot(space, { parts: ['nexus'] });
    s.drawing(space, erd.id, { status: 'failed' });
    const kept = await propose(space);
    const taken = await accept(space, made.id);
    assert.deepEqual([taken.status, taken.json.change_set.state], [200, 'accepted']);
    // A push that drew the diagram again: the document changed.
    s.snapshot(space, { parts: ['nexus'] });
    const drawn = s.drawing(space, erd.id);
    s.elements(drawn, [{ key: 'TBL-146', trace_id: 'TBL-146', name: 'agent_keys' }]);
    const version = space.commit;
    const was = dump();
    const refused = await accept(space, kept.id);
    assert.deepEqual(
      [refused.status, refused.json.code, refused.json.drawing, refused.json.version, refused.json.detail],
      [409, 'document_changed', idOf('dw', drawn), version, 'the document changed since the proposal; ask for a new proposal'],
    );
    assert.equal(dump(), was);
    // The owner still rejects it: a rejection takes a change off, whatever the document.
    const rejected = await reject(space, kept.id);
    assert.deepEqual([rejected.status, rejected.json.change_set.state], [200, 'rejected']);
  });

  test('a removed diagram takes no accepted proposal but takes a rejection (SPEC-027, note 7)', async () => {
    const { space, erd } = fresh();
    const first = await propose(space);
    const second = await propose(space);
    s.removeDiagram(erd.id);
    const shownVersion = db.prepare('SELECT document_version FROM drawings WHERE id = ?').get(erd.drawing).document_version;
    const was = dump();
    // document_changed, naming the drawing the removed diagram still shows and its version.
    const refused = await accept(space, first.id);
    assert.deepEqual(
      [refused.status, refused.json.code, refused.json.drawing, refused.json.version, refused.json.detail],
      [409, 'document_changed', idOf('dw', erd.drawing), shownVersion, 'the diagram is no longer in its stage document; ask for a new proposal'],
    );
    assert.equal(dump(), was);
    // Rejecting clears the owner's to-do of it.
    const rejected = await reject(space, second.id);
    assert.deepEqual([rejected.status, rejected.json.changed, rejected.json.change_set.state], [200, true, 'rejected']);
    assert.deepEqual(entriesOf(space).filter((entry) => entry.includes(' proposal ')), [
      `owner proposal ${keyOfId(first.id)} open`, `owner proposal ${keyOfId(second.id)} done`,
    ]);
    // Accepted proposals of a removed diagram answer the same, as a reflected one does.
    const back = fresh();
    const waiting = await propose(back.space);
    assert.equal((await accept(back.space, waiting.id)).status, 200);
    s.removeDiagram(back.erd.id);
    const again = await accept(back.space, waiting.id);
    assert.deepEqual([again.status, again.json.changed], [200, false]);
  });

  test('a closed thread stays closed, and a thread that waits on the agent keeps its comment entry and claim (TASK-443)', async () => {
    const { space, erd } = fresh();
    // The agent's own thread, closed by the owner while its proposals are still proposed.
    const own = await propose(space);
    const other = await propose(space, { comment: idOf('nc', threadKey(own)) });
    const thread = threadKey(own);
    s.closeThread(thread);
    threadChanged(db, { project: space.id, thread, time: TIME });
    assert.equal((await accept(space, own.id)).status, 200);
    assert.equal((await reject(space, other.id)).status, 200);
    assert.deepEqual(threadRow(thread), { state: 'closed', waits_on: null, closed_by: 'owner' });
    // An owner's thread answered by a proposal, then replied to by the owner: it waits on the agent, and session S1
    // claims its comment entry.
    const asked = s.thread(erd);
    threadChanged(db, { project: space.id, thread: asked, time: TIME });
    const answered = await propose(space, { comment: idOf('nc', asked) });
    s.comment(asked, { author: 'owner', body: 'And the index?' });
    threadChanged(db, { project: space.id, thread: asked, time: TIME });
    const claimed = await server.send({
      method: 'POST', path: `/api/spaces/${space.name}/claims/${idOf('nc', asked)}`, headers: { ...s.agent.headers, 'Nexus-Session': S1 },
    });
    assert.equal(claimed.status, 200, claimed.text);
    const claims = () => db.prepare('SELECT session, released_at, release_reason FROM claims WHERE project_id = ? ORDER BY id').all(space.id)
      .map((row) => ({ ...row }));
    const was = { thread: threadRow(asked), comments: commentCount(asked), claims: claims() };
    assert.equal(was.thread.waits_on, 'agent');
    const answer = await accept(space, answered.id);
    assert.equal(answer.status, 200);
    assert.deepEqual({ thread: threadRow(asked), comments: commentCount(asked), claims: claims() }, was);
    assert.ok(entriesOf(space).includes(`agent comment ${asked} open`));
    // Another session still finds the entry claimed by S1.
    const second = await server.send({
      method: 'POST', path: `/api/spaces/${space.name}/claims/${idOf('nc', asked)}`, headers: { ...s.agent.headers, 'Nexus-Session': S2 },
    });
    assert.deepEqual([second.status, second.json.code, second.json.session], [409, 'claimed', S1]);
  });

  test('a flow file\'s proposal names its part from the snapshot, and one reflected in a pull request names it', async () => {
    projects += 1;
    const key = 'docs/03-user-flow/FL-020-alpha.md';
    const space = s.project(`answers-${projects}`, { parts: ['nexus'], pictures: [{ stage: '03-user-flow', key, part: 'nexus' }] });
    const flow = s.diagram(space, { stage: '03-user-flow', sourceKey: key, kind: 'user_flow', name: 'FL-020 Alpha' });
    s.elements(flow.drawing, [{ key: 'A', kind: 'step', name: 'Alpha step' }]);
    const flowProposal = { stage: '03-user-flow', items: ['FL-020'], change: 'Rename the step.', source_text: undefined };
    const taken = await propose(space, flowProposal);
    const accepted = await accept(space, taken.id);
    assert.deepEqual([accepted.status, accepted.json.change_set.part, accepted.json.change_set.diagram], [200, 'nexus', idOf('dg', flow.id)]);
    const dropped = await propose(space, flowProposal);
    const rejected = await reject(space, dropped.id);
    assert.deepEqual([rejected.status, rejected.json.change_set.part], [200, 'nexus']);
    // Reflected by pull request 12, it answers the same, naming its pull request.
    const pull = s.pullRequest(space, { number: 12, state: 'merged' });
    db.prepare('UPDATE change_sets SET pull_request_id = ? WHERE id = ?').run(pull, keyOfId(taken.id));
    reflect(keyOfId(taken.id));
    const again = await accept(space, taken.id);
    assert.deepEqual(
      [again.status, again.json.changed, again.json.change_set.state, again.json.change_set.pull_request, again.json.pull_request],
      [200, false, 'reflected', 'https://github.com/example/demo/pull/12', null],
    );
  });

  test('names no change set of another project or of no row, and no project that is not there', async () => {
    const { space } = fresh();
    const elsewhere = fresh();
    const theirs = await propose(elsewhere.space);
    for (const answerIt of [accept, reject]) {
      for (const id of [theirs.id, 'np_zzzzzzzzzzzz', 'np_x', 'nc_3k7m1q9r2s4t']) {
        const refused = await answerIt(space, id);
        assert.deepEqual([refused.status, refused.json.code], [404, 'change_set_not_found'], id);
      }
      const nowhere = await answerIt('no-such-project', theirs.id);
      assert.deepEqual([nowhere.status, nowhere.json.code], [404, 'project_not_found']);
    }
    assert.equal(setRow(theirs.id).state, 'proposed');
  });

  test('refuses a body other than {} and a request without a request key', async () => {
    const { space } = fresh();
    const made = await propose(space);
    for (const answerIt of [accept, reject]) {
      for (const body of ['{"reason":"no"}', '[]', '"yes"']) {
        const refused = await answerIt(space, made.id, { body });
        assert.deepEqual([refused.status, refused.json.code], [400, 'invalid_request'], body);
      }
      const keyless = await answerIt(space, made.id, { key: null });
      assert.deepEqual([keyless.status, keyless.json.code, keyless.json.field], [400, 'invalid_request', 'Idempotency-Key']);
    }
    assert.deepEqual([setRow(made.id).state, setRow(made.id).decided_at], ['proposed', null]);
  });

  test('a request key sent again answers the first answer; with another body or action it is refused (rule 3)', async () => {
    const { space } = fresh();
    const made = await propose(space);
    const key = `"${newId('nw')}"`;
    const first = await reject(space, made.id, { key });
    const again = await reject(space, made.id, { key });
    assert.deepEqual([again.status, again.json], [first.status, first.json]);
    const other = await reject(space, made.id, { key, body: '{"x":1}' });
    assert.deepEqual([other.status, other.json.code], [409, 'request_key_reused']);
    const crossed = await accept(space, made.id, { key });
    assert.deepEqual([crossed.status, crossed.json.code], [409, 'request_key_reused']);
  });

  test('refuses a body that is not JSON or too large', async () => {
    const { space } = fresh();
    const made = await propose(space);
    for (const [action, verb] of [['acceptProposal', 'accept'], ['rejectProposal', 'reject']]) {
      const typed = await send(action, space, made.id, { type: 'text/plain' });
      assert.deepEqual([typed.status, typed.json.code], [415, 'json_required']);
      const path = `/api/projects/${space.name}/change-sets/${made.id}/${verb}`;
      const headers = { ...owner(), 'Content-Type': 'application/json', 'Idempotency-Key': `"${newId('nw')}"` };
      const { answers } = await exchange(server.port, [head('POST', path, { ...headers, 'Content-Length': 2 * MiB + 1 })]);
      assert.equal(answers.length, 1);
      responses.note(action, answers[0]);
      assert.deepEqual([answers[0].status, answers[0].json.code, answers[0].json.limit], [413, 'body_too_large', 2 * MiB]);
    }
    assert.equal(setRow(made.id).state, 'proposed');
  });

  test('refuses a request without the owner\'s sign-in, of another person, with an agent credential or from another site (REQ-025)', async () => {
    const { space } = fresh();
    const made = await propose(space);
    const someone = { 'Cf-Access-Jwt-Assertion': local.token({ email: 'someone@example.org' }) };
    for (const answerIt of [accept, reject]) {
      for (const [headers, status, code] of [[{}, 401, 'unauthenticated'], [someone, 403, 'not_owner'], [s.agent.headers, 403, 'owner_only']]) {
        const refused = await answerIt(space, made.id, { headers });
        assert.deepEqual([refused.status, refused.json.code], [status, code]);
      }
      for (const site of ['cross-site', 'same-site']) {
        const refused = await answerIt(space, made.id, { headers: { ...owner(), 'Sec-Fetch-Site': site } });
        assert.deepEqual([refused.status, refused.json.code], [403, 'cross_site']);
      }
    }
    assert.equal(setRow(made.id).state, 'proposed');
  });

  test('answers internal when the store fails, and changes nothing', async (t) => {
    const store = testStore(t);
    const failing = seed(store);
    const broken = failing.project('broken');
    const where = failing.diagram(broken);
    const thread = failing.thread(where, { author: 'agent' });
    const proposed = failing.changeSet(broken, where, { origin: 'proposal', threadId: thread });
    changeSetsChanged(store, { project: broken.id, diagram: where.id, time: TIME });
    // A store whose answering statement cannot be prepared, as when the disk fails.
    const failingStore = new Proxy(store, {
      get(target, name) {
        const value = Reflect.get(target, name, target);
        if (name === 'prepare') {
          return (sql) => {
            if (sql.includes('SET state = ?, decided_at = ?')) throw new Error('the store failed');
            return target.prepare(sql);
          };
        }
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const other = await startServer({ store: failingStore, gate: local.gate, routes: ROUTES });
    t.after(() => other.close());
    for (const [action, verb] of [['acceptProposal', 'accept'], ['rejectProposal', 'reject']]) {
      const answer = responses.note(action, await other.send({
        method: 'POST',
        path: `/api/projects/broken/change-sets/${idOf('np', proposed)}/${verb}`,
        headers: { ...owner(), 'Content-Type': 'application/json', 'Idempotency-Key': `"${newId('nw')}"` },
        body: '{}',
      }));
      assert.deepEqual([answer.status, answer.json.code], [500, 'internal']);
    }
    const lines = await other.logged(2);
    assert.deepEqual(lines.map((line) => line.error), ['Error', 'Error']);
    assert.equal(other.logText().includes('the store failed'), false);
    assert.equal(store.prepare('SELECT state FROM change_sets').get().state, 'proposed');
    assert.equal(store.prepare('SELECT count(*) AS n FROM request_keys').get().n, 0);
  });

  test('logs one line per request with its sender, and never a proposal\'s text, a session or the data folder (rule 5)', async () => {
    const lines = (await server.logged(20)).filter((line) => ACTIONS.includes(line.action));
    assert.ok(lines.length >= 20);
    for (const line of lines) {
      assert.match(line.traceId, TRACE_ID);
      assert.ok([s.agent.name, 'unknown', 'owner'].includes(line.sender), line.sender);
    }
    const text = server.logText();
    for (const value of [S1, S2, CHANGE, REASON, 'CREATE TABLE agent_keys', 'And the index?', folder, folder.replaceAll('\\', '/'),
      JSON.stringify(folder).slice(1, -1)]) {
      assert.equal(text.includes(value), false, value);
    }
  });

  test('answer every response API-270 and API-271 list', () => {
    for (const action of ACTIONS) responses.assertEvery(action);
  });

  test('touch the tables their x-corthex.tables list, change only tables their spec rows feed, and admission only the layer\'s (note 23)', () => {
    checkTables(recorder, 'acceptProposal');
    checkTables(recorder, 'rejectProposal');
    checkLayer(recorder);
  });
});
