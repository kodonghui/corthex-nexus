// The agent to-do (TASK-433; API-245, SPEC-014, SPEC-026, SPEC-031, SPEC-043, rule 5): every response API-245 lists,
// its answer against the contract's AgentTodo, the tables it touches (note 23) and its log lines. The entries are set
// up with test/seed.js and opened by src/entries.js, as the operations of later tasks will open them.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { changeSetsChanged, confirmationsChanged, stepsChanged, threadChanged } from '../src/entries.js';
import { idOf } from '../src/ids.js';
import { ROUTES } from '../src/routes.js';
import { openStore } from '../src/store.js';
import { responseRecord } from './responses.js';
import { REPOSITORY, seed, TIME } from './seed.js';
import { localGate, startServer, testStore, TRACE_ID } from './support.js';
import { checkLayer, checkTables, recordTables } from './tables.js';

const NOW = Date.parse('2026-11-23T02:00:00.000Z');
const SESSION = 'claude-code-4f2a91';
const OTHER = 'codex-7d1e';
const MINUTE = 60 * 1000;
const at = (ms) => new Date(ms).toISOString();

describe('the agent to-do', () => {
  const responses = responseRecord();
  let folder;
  let db;
  let recorder;
  let local;
  let server;
  let s;
  // The project with an entry of every kind, and what each is about.
  let full;

  const read = async (name, headers = s.agent.headers) => responses.note('getAgentTodo', await server.send({ path: `/api/spaces/${name}/todo`, headers }));

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-todo-'));
    ({ db } = openStore(folder));
    recorder = recordTables(db);
    local = localGate();
    server = await startServer({ store: recorder.store, gate: local.gate, now: () => NOW, routes: ROUTES });
    // Every row is written straight into the store, outside any operation, as the operations of later tasks would.
    s = seed(db);
    full = everyKind(s, db);
  });

  after(async () => {
    await server.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  test('lists every kind of entry, oldest first, each with its claim (SPEC-043, SPEC-026, SPEC-031)', async () => {
    const answer = await read(full.space.name, { ...s.agent.headers, 'Nexus-Session': SESSION });
    assert.equal(answer.status, 200);
    const erd = idOf('dg', full.erd.id);
    const flow = idOf('dg', full.flow.id);
    const table = idOf('dg', full.table.id);
    assert.deepEqual(answer.json, {
      project: full.space.name,
      default_commit: full.space.commit,
      session: SESSION,
      read_at: at(NOW),
      comments: {
        total: 3,
        entries: [
          {
            id: idOf('nc', full.threads.element), part: 'nexus', stage: '05-erd', diagram: erd, item: 'TBL-146', target: 'element',
            opened_at: '2026-11-23T00:10:00.000Z', last_at: '2026-11-23T00:15:00.000Z', last_author: 'owner', last_text: full.text,
            claim: {
              entry: idOf('nc', full.threads.element), session: SESSION, mine: true, claimed_at: '2026-11-23T01:30:00.000Z',
              last_write_at: '2026-11-23T01:40:00.000Z', ends_at: '2026-11-23T02:40:00.000Z', pull_request: null,
            },
          },
          {
            id: idOf('nc', full.threads.flow), part: 'nexus', stage: '03-user-flow', diagram: flow, item: '', target: 'diagram',
            opened_at: '2026-11-23T00:20:00.000Z', last_at: '2026-11-23T00:20:00.000Z', last_author: 'owner', last_text: 'Is this the whole flow?',
            claim: null,
          },
          {
            id: idOf('nc', full.threads.row), part: '', stage: '02-prd', diagram: table, item: '', target: 'row',
            opened_at: '2026-11-23T00:30:00.000Z', last_at: '2026-11-23T00:30:00.000Z', last_author: 'owner', last_text: 'Which row is this?',
            claim: null,
          },
        ],
      },
      discrepancies: { total: 0, entries: [] },
      reflections: {
        total: 2,
        entries: [
          {
            id: idOf('ne', full.reflections.open), part: 'nexus', stage: '05-erd', diagram: erd, task: 'reflect', made_at: TIME,
            change_sets: full.changeSets.inPull.map((key) => idOf('np', key)), pull_request: `${REPOSITORY}/pull/12`,
            claim: {
              entry: idOf('ne', full.reflections.open), session: OTHER, mine: false, claimed_at: TIME, last_write_at: TIME,
              ends_at: null, pull_request: `${REPOSITORY}/pull/12`,
            },
          },
          {
            id: idOf('ne', full.reflections.waiting), part: 'nexus', stage: '05-erd', diagram: erd, task: 'reflect', made_at: TIME,
            change_sets: [idOf('np', full.changeSets.waiting)], pull_request: null, claim: null,
          },
        ],
      },
      checkpoints: {
        total: 1,
        entries: [{
          id: idOf('nk', full.confirmation), part: 'nexus', stage: '05-erd', diagram: erd, version: full.space.commit, state: 'passed',
          passed_at: '2026-11-23T00:40:00.000Z', withdrawn_at: null, claim: null,
        }],
      },
      steps: {
        total: 1,
        entries: [{ workshop: idOf('ws', full.workshop), step: '7', confirmed_at: '2026-11-23T00:50:00.000Z', checkpoint: true }],
      },
      waiting_for_user: 1,
      taken: 1,
    });
  });

  test('a claim is mine only for the session that reads, and none without one', async () => {
    const other = await read(full.space.name, { ...s.agent.headers, 'Nexus-Session': OTHER });
    assert.equal(other.json.session, OTHER);
    assert.equal(other.json.comments.entries[0].claim.mine, false);
    assert.equal(other.json.reflections.entries[0].claim.mine, true);
    assert.equal(other.json.taken, 1);
    const none = await read(full.space.name);
    assert.equal(none.json.session, null);
    assert.deepEqual([none.json.comments.entries[0].claim.mine, none.json.reflections.entries[0].claim.mine], [false, false]);
    assert.equal(none.json.taken, 2);
  });

  test('a project with nothing to do answers empty lists, and another project\'s entries are not its own', async () => {
    const empty = s.project();
    const answer = await read(empty.name);
    assert.deepEqual(answer.json, {
      project: empty.name,
      default_commit: empty.commit,
      session: null,
      read_at: at(NOW),
      comments: { total: 0, entries: [] },
      discrepancies: { total: 0, entries: [] },
      reflections: { total: 0, entries: [] },
      checkpoints: { total: 0, entries: [] },
      steps: { total: 0, entries: [] },
      waiting_for_user: 0,
      taken: 0,
    });
  });

  test('lists at most 5000 entries of a kind and counts them all', async () => {
    const many = s.project();
    const where = s.diagram(many);
    // 5001 threads that wait on the agent, written at once.
    db.exec('BEGIN');
    try {
      const thread = db.prepare(
        "INSERT INTO comment_threads (diagram_id, drawing_id, target_kind, state, waits_on, opened_at) VALUES (?, ?, 'diagram', 'open', 'agent', ?)",
      );
      const comment = db.prepare("INSERT INTO comments (thread_id, seq, author, body, created_at) VALUES (?, 1, 'owner', 'Why?', ?)");
      for (let n = 0; n < 5001; n += 1) {
        const key = Number(thread.run(where.id, where.drawing, TIME).lastInsertRowid);
        comment.run(key, TIME);
        threadChanged(db, { project: many.id, thread: key, time: TIME });
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    const answer = await read(many.name);
    assert.equal(answer.status, 200);
    assert.equal(answer.json.comments.total, 5001);
    assert.equal(answer.json.comments.entries.length, 5000);
  });

  test('a read writes nothing', async () => {
    const rows = () => JSON.stringify(['todos', 'claims', 'comment_threads', 'change_sets', 'confirmations']
      .map((table) => db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()));
    const before = rows();
    await read(full.space.name, { ...s.agent.headers, 'Nexus-Session': SESSION });
    assert.equal(rows(), before);
  });

  test('a Nexus-Session that is not a session label gets invalid_request on Nexus-Session', async () => {
    for (const value of ['has space', 'x'.repeat(101), 'semi;colon', '', 'ü']) {
      const answer = await read(full.space.name, { ...s.agent.headers, 'Nexus-Session': value });
      assert.deepEqual([answer.status, answer.json.code, answer.json.field], [400, 'invalid_request', 'Nexus-Session'], value);
      if (value.length > 2) assert.equal(answer.text.includes(value), false);
    }
    assert.equal((await read(full.space.name, { ...s.agent.headers, 'Nexus-Session': 'x'.repeat(100) })).status, 200);
  });

  test('a request without a live agent credential gets access_missing, and the owner\'s sign-in agent_only', async () => {
    const none = await read(full.space.name, {});
    assert.deepEqual([none.status, none.json.code], [401, 'access_missing']);
    const owner = await read(full.space.name, { 'Cf-Access-Jwt-Assertion': local.token() });
    assert.deepEqual([owner.status, owner.json.code], [403, 'agent_only']);
    for (const answer of [none, owner]) assert.equal(answer.text.includes(full.text), false);
  });

  test('a project without a space gets space_not_found, whose detail never repeats the name', async () => {
    for (const name of ['no-such-project', 'Upper', 'a--b', 'x'.repeat(65), '%2e%2e']) {
      const answer = await read(name);
      assert.deepEqual([answer.status, answer.json.code], [404, 'space_not_found'], name);
      assert.equal(answer.json.detail.includes(name), false);
    }
  });

  test('answers internal when the store fails', async (t) => {
    const store = testStore(t);
    const failing = seed(store);
    const space = failing.project('broken');
    // A store whose to-do statements cannot be prepared, as when the disk fails.
    const broken = new Proxy(store, {
      get(target, name) {
        const value = Reflect.get(target, name, target);
        if (name === 'prepare') {
          return (sql) => {
            if (sql.includes('FROM todos')) throw new Error('the store failed');
            return target.prepare(sql);
          };
        }
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const other = await startServer({ store: broken, gate: local.gate, routes: ROUTES });
    t.after(() => other.close());
    const answer = responses.note('getAgentTodo', await other.send({ path: `/api/spaces/${space.name}/todo`, headers: failing.agent.headers }));
    assert.deepEqual([answer.status, answer.json.code], [500, 'internal']);
    const [line] = await other.logged(1);
    assert.equal(line.error, 'Error');
    assert.equal(other.logText().includes('the store failed'), false);
  });

  test('logs one line per request with its sender, and never a comment\'s text, a session or the data folder (rule 5)', async () => {
    const lines = (await server.logged(10)).filter((line) => line.action === 'getAgentTodo');
    assert.ok(lines.length >= 10);
    for (const line of lines) {
      assert.match(line.traceId, TRACE_ID);
      assert.ok([s.agent.name, 'unknown', 'owner'].includes(line.sender));
    }
    const text = server.logText();
    for (const value of [full.text, SESSION, folder, folder.replaceAll('\\', '/'), JSON.stringify(folder).slice(1, -1)]) {
      assert.equal(text.includes(value), false);
    }
  });

  test('answers every response API-245 lists', () => {
    responses.assertEvery('getAgentTodo');
  });

  test('touches the tables its x-corthex.tables lists, and admission only the layer\'s (note 23)', () => {
    checkTables(recorder, 'getAgentTodo');
    checkLayer(recorder);
  });
});

// A project with an entry of every kind of the agent to-do, opened by entries.js, and two of the owner's, of which one
// is open. Returns what the test compares.
function everyKind(s, db) {
  const space = s.project('demo', {
    pictures: [{ part: 'nexus', stage: '03-user-flow', key: 'docs/03-user-flow/FL-001-put-a-project-on-nexus.md', commit: '' }],
  });
  const erd = s.diagram(space, { sourceKey: '/pictures/05-erd/nexus' });
  const flow = s.diagram(space, {
    stage: '03-user-flow', sourceKey: 'docs/03-user-flow/FL-001-put-a-project-on-nexus.md', kind: 'user_flow', name: 'FL-001',
  });
  const table = s.diagram(space, { stage: '02-prd', sourceKey: '/items/02-prd', kind: 'item_table', name: '02-prd' });
  const time = (minutes) => at(Date.parse('2026-11-23T00:00:00.000Z') + minutes * MINUTE);
  const sync = (sync, args) => sync(db, { project: space.id, time: TIME, ...args });

  // Comments: an element of the ERD with an agent's reply and the owner's answer, a whole flow, and an item table's
  // row whose key is no trace ID. A thread that waits on the owner is the owner's.
  const text = `Keep it, ${Date.now()}: a text no log line may hold.`;
  const element = s.thread(erd, { at: time(10), body: 'Should agent credentials keep their last use?' });
  s.comment(element, { author: 'agent', body: 'Shall I add last_used_at?', at: time(12) });
  s.comment(element, { author: 'owner', body: text, at: time(15) });
  const flowThread = s.thread(flow, { target: 'diagram', at: time(20), body: 'Is this the whole flow?' });
  const row = s.thread(table, { target: 'row', elementKey: 'row 3', at: time(30), body: 'Which row is this?' });
  const question = s.thread(erd, { author: 'agent', at: time(5), body: 'Which table holds claims?' });
  for (const thread of [element, flowThread, row, question]) sync(threadChanged, { thread });

  // Reflections: two change sets in pull request 12, and one accepted while it is open.
  const twelve = s.pullRequest(space, { number: 12 });
  const inPull = [s.changeSet(space, erd, { pullRequestId: twelve }), s.changeSet(space, erd, { pullRequestId: twelve })];
  sync(changeSetsChanged, { diagram: erd.id });
  const waiting = s.changeSet(space, erd);
  sync(changeSetsChanged, { diagram: erd.id });
  const [open, waitingEntry] = db.prepare("SELECT id FROM todos WHERE kind = 'reflect' AND project_id = ? ORDER BY id").all(space.id).map((r) => Number(r.id));

  // A confirmation to record; the ERD waits on no owner entry then, and the flow's and the table's confirm entries
  // are left closed for this project's count by confirming them too.
  const confirmation = s.confirm(space, erd, { at: time(40) });
  sync(confirmationsChanged, { diagram: erd.id });
  for (const where of [flow, table]) {
    const other = s.confirm(space, where);
    s.record(other);
    sync(confirmationsChanged, { diagram: where.id });
  }

  // A confirmed workshop step to write.
  const workshop = s.workshop(space);
  s.confirmStep(workshop, '7', { at: time(50) });
  sync(stepsChanged, { workshop });

  // Claims: the session's own on the element's thread, last written 20 minutes ago; another session's on the pull
  // request's reflection, kept while it is open; and one on the flow's thread that lapsed an hour after its last write.
  const entry = (column, key, kind) => Number(db.prepare(`SELECT id FROM todos WHERE ${column} = ? AND kind = ? AND closed_at IS NULL`).get(key, kind).id);
  s.claim(space, entry('thread_id', element, 'comment'), { session: SESSION, claimedAt: time(90), lastWriteAt: time(100) });
  s.claim(space, open, { session: OTHER, pullRequestId: twelve });
  s.claim(space, entry('thread_id', flowThread, 'comment'), { session: OTHER, claimedAt: time(0), lastWriteAt: time(60) });

  return {
    space, erd, flow, table, text, workshop, confirmation,
    threads: { element, flow: flowThread, row },
    reflections: { open, waiting: waitingEntry },
    changeSets: { inPull, waiting },
  };
}
