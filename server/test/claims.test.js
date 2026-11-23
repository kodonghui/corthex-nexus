// Claims (TASK-434; API-250, API-251, SPEC-044, SPEC-045, rule 3, rule 4, rule 5): every response API-250 and API-251
// list, the claim against the contract's Claim, the tables they touch (note 23) and their log lines; and keepClaim and
// finishClaim, which the agent's writes of later tasks call, with the fewest rows the store allows. The entries are set
// up with test/seed.js and opened by src/entries.js, as the operations of later tasks will open them.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { CLAIM_MS, claimEnd, finishClaim, keepClaim } from '../src/claims.js';
import { changeSetsChanged, confirmationsChanged, removeFromPullRequest, threadChanged } from '../src/entries.js';
import { idOf } from '../src/ids.js';
import { Problem } from '../src/problem.js';
import { ROUTES } from '../src/routes.js';
import { openStore } from '../src/store.js';
import { agentTodo } from '../src/todo.js';
import { responseRecord } from './responses.js';
import { REPOSITORY, seed, TIME } from './seed.js';
import { localGate, startServer, testStore, TRACE_ID, waitFor } from './support.js';
import { checkLayer, checkTables, recordTables } from './tables.js';

const START = Date.parse('2026-11-23T02:00:00.000Z');
const MINUTE = 60 * 1000;
const S1 = 'claude-code-4f2a91';
const S2 = 'codex-7d1e';
const at = (ms) => new Date(ms).toISOString();

// The claims of an entry in the store, oldest first, with the columns a test compares.
const claimsOf = (db, todo) => db.prepare(
  'SELECT session, claimed_at, last_write_at, released_at, release_reason FROM claims WHERE todo_id = ? ORDER BY id',
).all(todo).map((row) => ({ ...row }));

// The key of the open entry of a kind about a subject.
const openEntry = (db, column, key, kind) => {
  const row = db.prepare(`SELECT id FROM todos WHERE ${column} = ? AND kind = ? AND closed_at IS NULL`).get(key, kind);
  return row === undefined ? null : Number(row.id);
};

describe('claims', () => {
  const responses = responseRecord();
  let folder;
  let db;
  let recorder;
  let local;
  let server;
  let s;
  let space;
  let erd;
  let clock = START;
  const hold = {};

  const request = (method, action) => async (name, entry, session, headers = s.agent.headers) => {
    const all = session === undefined ? { ...headers } : { ...headers, 'Nexus-Session': session };
    const answer = await server.send({ method, path: `/api/spaces/${name}/claims/${entry}`, headers: all });
    return responses.note(action, answer);
  };
  const claim = request('POST', 'claimEntry');
  const release = request('DELETE', 'releaseEntry');

  // A thread of the ERD that waits on the agent, with its comment entry: { thread, id, entry }.
  const waitingThread = () => {
    const thread = s.thread(erd);
    threadChanged(db, { project: space.id, thread, time: TIME });
    return { thread, id: idOf('nc', thread), entry: openEntry(db, 'thread_id', thread, 'comment') };
  };

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-claims-'));
    ({ db } = openStore(folder));
    recorder = recordTables(db);
    local = localGate();
    server = await startServer({
      store: recorder.store,
      gate: local.gate,
      now: () => clock,
      routes: [
        ...ROUTES,
        // A write of no operation that holds the queue until the test lets it go, so that writes sent meanwhile wait
        // in the order they arrived.
        {
          method: 'POST',
          path: '/test/hold',
          action: 'testHold',
          family: 'none',
          handle: () => new Promise((resolve) => {
            hold.started = true;
            hold.release = () => resolve({ body: { held: true } });
          }),
        },
      ],
    });
    // Every row is written straight into the store, outside any operation, as the operations of later tasks would.
    s = seed(db);
    space = s.project('demo');
    erd = s.diagram(space, { sourceKey: '/pictures/05-erd/nexus' });
  });

  after(async () => {
    await server.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  test('a free entry is claimed for the session, and claimed again by it is the same claim, moved on (SPEC-044, rule 3)', async () => {
    clock = START;
    const { id, entry } = waitingThread();
    const first = await claim(space.name, id, S1);
    assert.equal(first.status, 200);
    assert.deepEqual(first.json, {
      entry: id, session: S1, mine: true, claimed_at: at(START), last_write_at: at(START), ends_at: at(START + 60 * MINUTE),
      pull_request: null,
    });
    clock = START + 10 * MINUTE;
    const again = await claim(space.name, id, S1);
    assert.deepEqual(again.json, { ...first.json, last_write_at: at(clock), ends_at: at(clock + 60 * MINUTE) });
    assert.deepEqual(claimsOf(db, entry), [
      { session: S1, claimed_at: at(START), last_write_at: at(clock), released_at: null, release_reason: null },
    ]);
    // The agent to-do shows the claim by the same rule.
    const todo = agentTodo(db, { name: space.name, session: S1, now: clock });
    assert.deepEqual(todo.comments.entries.find((each) => each.id === id).claim, again.json);
  });

  test('another session\'s claim gets claimed, naming the holder, its last write and its end (SPEC-044)', async () => {
    clock = START;
    const { id, entry } = waitingThread();
    await claim(space.name, id, S1);
    clock = START + 5 * MINUTE;
    const refused = await claim(space.name, id, S2);
    assert.equal(refused.status, 409);
    assert.equal(refused.json.code, 'claimed');
    assert.deepEqual([refused.json.session, refused.json.last_write_at, refused.json.ends_at], [S1, at(START), at(START + 60 * MINUTE)]);
    assert.match(refused.json.traceId, TRACE_ID);
    assert.deepEqual(claimsOf(db, entry).map((row) => row.session), [S1]);
  });

  test('of two claims at once, the first wins and the second gets claimed (SPEC-044, rule 4)', async () => {
    clock = START;
    const { id, entry } = waitingThread();
    hold.started = false;
    const held = server.send({ method: 'POST', path: '/test/hold' });
    await waitFor(() => hold.started);
    // Both wait behind the held write, the first sent first.
    const one = claim(space.name, id, S1);
    await delay(200);
    const two = claim(space.name, id, S2);
    await delay(200);
    hold.release();
    const [first, second] = await Promise.all([one, two]);
    assert.equal((await held).status, 200);
    assert.equal(first.status, 200);
    assert.equal(first.json.session, S1);
    assert.deepEqual([second.status, second.json.code, second.json.session], [409, 'claimed', S1]);
    assert.deepEqual(claimsOf(db, entry).map((row) => row.session), [S1]);
  });

  test('a claim with no write for 60 minutes and no open pull request lapses (SPEC-045)', async () => {
    clock = START;
    const { id, entry } = waitingThread();
    await claim(space.name, id, S1);
    clock = START + 60 * MINUTE - 1;
    assert.equal((await claim(space.name, id, S2)).status, 409);
    clock = START + 60 * MINUTE;
    const taken = await claim(space.name, id, S2);
    assert.equal(taken.status, 200);
    assert.deepEqual([taken.json.session, taken.json.claimed_at], [S2, at(clock)]);
    // The lapsed claim is released as idle, at the time it ended.
    assert.deepEqual(claimsOf(db, entry), [
      { session: S1, claimed_at: at(START), last_write_at: at(START), released_at: at(START + 60 * MINUTE), release_reason: 'idle' },
      { session: S2, claimed_at: at(clock), last_write_at: at(clock), released_at: null, release_reason: null },
    ]);
  });

  test('a claim with an open pull request is kept after 90 minutes, and its 60 minutes start when it closes (SPEC-045)', async () => {
    clock = START;
    const changeSet = s.changeSet(space, erd);
    changeSetsChanged(db, { project: space.id, diagram: erd.id, time: TIME });
    const entry = openEntry(db, 'change_set_id', changeSet, 'reflect');
    const id = idOf('ne', entry);
    await claim(space.name, id, S1);
    // The session reports pull request 12 for the entry, as API-258 will (TASK-447).
    const twelve = s.pullRequest(space, { number: 12 });
    db.prepare('UPDATE claims SET pull_request_id = ? WHERE todo_id = ? AND released_at IS NULL').run(twelve, entry);
    clock = START + 90 * MINUTE;
    const kept = await claim(space.name, id, S2);
    assert.deepEqual([kept.status, kept.json.code, kept.json.session], [409, 'claimed', S1]);
    assert.deepEqual([kept.json.last_write_at, kept.json.ends_at], [at(START), null]);
    // The holder's claim names its pull request and has no end while it is open.
    clock = START + 95 * MINUTE;
    const mine = await claim(space.name, id, S1);
    assert.deepEqual(mine.json, {
      entry: id, session: S1, mine: true, claimed_at: at(START), last_write_at: at(clock), ends_at: null,
      pull_request: `${REPOSITORY}/pull/12`,
    });
    // Closed without merge at minute 100, the 60 minutes start from the close, which is later than the last write.
    db.prepare("UPDATE pull_requests SET state = 'closed', closed_at = ? WHERE id = ?").run(at(START + 100 * MINUTE), twelve);
    clock = START + 160 * MINUTE - 1;
    const closing = await claim(space.name, id, S2);
    assert.deepEqual([closing.status, closing.json.ends_at], [409, at(START + 160 * MINUTE)]);
    clock = START + 160 * MINUTE;
    assert.equal((await claim(space.name, id, S2)).status, 200);
    assert.deepEqual(claimsOf(db, entry).map((row) => [row.session, row.release_reason, row.released_at]), [
      [S1, 'idle', at(START + 160 * MINUTE)],
      [S2, null, null],
    ]);
  });

  test('a confirmation to record and a removal from a pull request are claimed by their IDs', async () => {
    clock = START;
    const confirmation = s.confirm(space, erd);
    confirmationsChanged(db, { project: space.id, diagram: erd.id, time: TIME });
    const record = await claim(space.name, idOf('nk', confirmation), S1);
    assert.deepEqual([record.status, record.json.entry], [200, idOf('nk', confirmation)]);
    const changeSet = s.changeSet(space, erd, { state: 'cancelled' });
    const { entry } = removeFromPullRequest(db, { project: space.id, diagram: erd.id, changeSet, time: TIME });
    const removal = await claim(space.name, idOf('ne', entry), S1);
    assert.deepEqual([removal.status, removal.json.entry], [200, idOf('ne', entry)]);
  });

  test('a closed entry\'s claim holds nothing, and a new entry of the same thread starts unclaimed', async () => {
    clock = START;
    const { thread, id, entry } = waitingThread();
    await claim(space.name, id, S1);
    // The agent's reply closes the comment entry; the thread waits on the owner, so it is claimed by no one.
    s.comment(thread, { author: 'agent' });
    threadChanged(db, { project: space.id, thread, time: at(clock) });
    const waiting = await claim(space.name, id, S2);
    assert.deepEqual([waiting.status, waiting.json.code], [409, 'entry_closed']);
    // Releasing the closed entry answers released false and writes nothing.
    const before = claimsOf(db, entry);
    const released = await release(space.name, id, S1);
    assert.deepEqual([released.status, released.json], [200, { entry: id, released: false }]);
    assert.deepEqual(claimsOf(db, entry), before);
    // The owner answers within the hour: a new entry opens under the same nc_ ID, and the first claim of it wins.
    clock = START + 10 * MINUTE;
    s.comment(thread, { author: 'owner' });
    threadChanged(db, { project: space.id, thread, time: at(clock) });
    const next = openEntry(db, 'thread_id', thread, 'comment');
    assert.notEqual(next, entry);
    assert.equal(agentTodo(db, { name: space.name, session: S1, now: clock }).comments.entries.find((each) => each.id === id).claim, null);
    const taken = await claim(space.name, id, S2);
    assert.deepEqual([taken.status, taken.json.session, taken.json.claimed_at], [200, S2, at(clock)]);
    assert.deepEqual((await claim(space.name, id, S1)).json.session, S2);
    // The closed entry's claim row stays as it was.
    assert.deepEqual(claimsOf(db, entry).map((row) => row.release_reason), [null]);
    // A thread the agent opened waits on the owner: its ID names no open entry either.
    const question = s.thread(erd, { author: 'agent' });
    threadChanged(db, { project: space.id, thread: question, time: TIME });
    assert.equal((await claim(space.name, idOf('nc', question), S1)).json.code, 'entry_closed');
  });

  test('a release ends the session\'s live claim, and answers released false where it holds none', async () => {
    clock = START;
    const { id, entry } = waitingThread();
    // A free entry.
    assert.deepEqual((await release(space.name, id, S1)).json, { entry: id, released: false });
    await claim(space.name, id, S1);
    // Another session's live claim is refused, naming it.
    const other = await release(space.name, id, S2);
    assert.deepEqual([other.status, other.json.code, other.json.session, other.json.ends_at], [409, 'claimed', S1, at(START + 60 * MINUTE)]);
    clock = START + 5 * MINUTE;
    const released = await release(space.name, id, S1);
    assert.deepEqual([released.status, released.json], [200, { entry: id, released: true }]);
    assert.deepEqual(claimsOf(db, entry).map((row) => [row.released_at, row.release_reason]), [[at(clock), 'released']]);
    // Released again: the same answer as for no claim, and nothing written.
    assert.deepEqual((await release(space.name, id, S1)).json, { entry: id, released: false });
    // A lapsed claim is no claim to release, and stays as it is until the next claim.
    await claim(space.name, id, S2);
    clock += 60 * MINUTE;
    assert.deepEqual((await release(space.name, id, S2)).json, { entry: id, released: false });
    assert.deepEqual(claimsOf(db, entry).at(-1).release_reason, null);
    // The entry is free for anyone.
    assert.equal((await claim(space.name, id, S1)).status, 200);
  });

  test('an entry ID that names no entry of the project gets entry_not_found', async () => {
    clock = START;
    const { thread } = waitingThread();
    const other = s.project();
    const owners = s.thread(erd, { author: 'agent' });
    threadChanged(db, { project: space.id, thread: owners, time: TIME });
    const comment = openEntry(db, 'thread_id', thread, 'comment');
    const question = openEntry(db, 'thread_id', owners, 'question');
    const ids = [
      // A discrepancy, which NEXUS v3 never opens; an ne_ ID of a comment entry and of the owner's question.
      idOf('nd', 1), idOf('ne', comment), idOf('ne', question),
      // Nothing of the project, and a key past the store's.
      idOf('nc', 999999), idOf('nk', 999999), idOf('ne', 999999), 'nc_zzzzzzzzzzzz',
    ];
    for (const id of ids) {
      for (const send of [claim, release]) {
        const answer = await send(space.name, id, S1);
        assert.deepEqual([answer.status, answer.json.code], [404, 'entry_not_found'], id);
        assert.equal(answer.json.detail.includes(id), false);
      }
    }
    // Another project's thread.
    for (const send of [claim, release]) {
      assert.equal((await send(other.name, idOf('nc', thread), S1)).json.code, 'entry_not_found');
    }
    // A value not in the form of an entry ID.
    for (const value of [idOf('np', 1), 'nc_1', 'NC_000000000001']) {
      assert.equal((await claim(space.name, value, S1)).json.code, 'entry_not_found', value);
    }
  });

  test('a project without a space gets project_not_found, whose detail never repeats the name', async () => {
    for (const name of ['no-such-project', 'Upper', 'a--b', 'x'.repeat(65)]) {
      for (const send of [claim, release]) {
        const answer = await send(name, idOf('nc', 1), S1);
        assert.deepEqual([answer.status, answer.json.code], [404, 'project_not_found'], name);
        assert.equal(answer.json.detail.includes(name), false);
      }
    }
  });

  test('a claim or a release needs Nexus-Session, a session label, and the detail never repeats it', async () => {
    const { id } = waitingThread();
    for (const send of [claim, release]) {
      const none = await send(space.name, id);
      assert.deepEqual([none.status, none.json.code, none.json.field], [400, 'invalid_request', 'Nexus-Session']);
      for (const value of ['has space', 'x'.repeat(101), 'semi;colon', '', 'ü']) {
        const answer = await send(space.name, id, value);
        assert.deepEqual([answer.status, answer.json.code, answer.json.field], [400, 'invalid_request', 'Nexus-Session'], value);
        if (value.length > 2) assert.equal(answer.text.includes(value), false);
      }
    }
  });

  test('a request without a live agent credential gets access_missing, and the owner\'s sign-in agent_only', async () => {
    const { id, entry } = waitingThread();
    for (const send of [claim, release]) {
      const none = await send(space.name, id, S1, {});
      assert.deepEqual([none.status, none.json.code], [401, 'access_missing']);
      const owner = await send(space.name, id, S1, { 'Cf-Access-Jwt-Assertion': local.token() });
      assert.deepEqual([owner.status, owner.json.code], [403, 'agent_only']);
    }
    assert.deepEqual(claimsOf(db, entry), []);
  });

  test('answers internal when the store fails, and changes nothing', async (t) => {
    const store = testStore(t);
    const failing = seed(store);
    const broken = failing.project('broken');
    const where = failing.diagram(broken);
    const thread = failing.thread(where);
    threadChanged(store, { project: broken.id, thread, time: TIME });
    // A store whose claim statements cannot be prepared, as when the disk fails.
    const failingStore = new Proxy(store, {
      get(target, name) {
        const value = Reflect.get(target, name, target);
        if (name === 'prepare') {
          return (sql) => {
            if (sql.includes('INSERT INTO claims')) throw new Error('the store failed');
            return target.prepare(sql);
          };
        }
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const other = await startServer({ store: failingStore, gate: local.gate, routes: ROUTES });
    t.after(() => other.close());
    const headers = { ...failing.agent.headers, 'Nexus-Session': S1 };
    for (const [method, action] of [['POST', 'claimEntry'], ['DELETE', 'releaseEntry']]) {
      const answer = responses.note(action, await other.send({ method, path: `/api/spaces/broken/claims/${idOf('nc', thread)}`, headers }));
      assert.deepEqual([answer.status, answer.json.code], [500, 'internal']);
    }
    const lines = await other.logged(2);
    assert.deepEqual(lines.map((line) => line.error), ['Error', 'Error']);
    assert.equal(other.logText().includes('the store failed'), false);
    assert.equal(store.prepare('SELECT count(*) AS n FROM claims').get().n, 0);
  });

  test('logs one line per request with its sender, and never a session or the data folder (rule 5)', async () => {
    const lines = (await server.logged(10)).filter((line) => ['claimEntry', 'releaseEntry'].includes(line.action));
    assert.ok(lines.length >= 10);
    for (const line of lines) {
      assert.match(line.traceId, TRACE_ID);
      assert.ok([s.agent.name, 'unknown', 'owner'].includes(line.sender));
    }
    const text = server.logText();
    for (const value of [S1, S2, folder, folder.replaceAll('\\', '/'), JSON.stringify(folder).slice(1, -1)]) {
      assert.equal(text.includes(value), false);
    }
  });

  test('answers every response API-250 and API-251 list', () => {
    responses.assertEvery('claimEntry');
    responses.assertEvery('releaseEntry');
  });

  test('touch the tables their x-corthex.tables list, and admission only the layer\'s (note 23)', () => {
    checkTables(recorder, 'claimEntry');
    checkTables(recorder, 'releaseEntry');
    checkLayer(recorder);
  });
});

// keepClaim and finishClaim, as the agent's writes of TASK-437, TASK-438 and TASK-447 will call them, with the fewest
// rows the store allows: a project, a diagram and a thread that waits on the agent.
function smallest(t) {
  const db = testStore(t);
  const s = seed(db);
  const space = s.project();
  const thread = s.thread(s.diagram(space));
  threadChanged(db, { project: space.id, thread, time: TIME });
  const entry = openEntry(db, 'thread_id', thread, 'comment');
  const keep = (session, time) => keepClaim(db, { project: space.id, entry, session, credential: s.agent.key, time });
  return { db, s, space, thread, entry, keep };
}

test('a write keeps a claim: it claims a free entry, moves its own on and is refused on another\'s (keepClaim)', (t) => {
  const { db, entry, keep } = smallest(t);
  const start = Date.parse(TIME);
  const made = keep(S1, TIME);
  assert.deepEqual([made.session, made.claimed_at, made.last_write_at], [S1, TIME, TIME]);
  assert.equal(claimEnd(made), start + CLAIM_MS);
  const later = at(start + 30 * MINUTE);
  assert.equal(keep(S1, later).last_write_at, later);
  assert.deepEqual(claimsOf(db, entry), [{ session: S1, claimed_at: TIME, last_write_at: later, released_at: null, release_reason: null }]);
  // Another session's write within the hour of the last one is refused, naming the holder.
  assert.throws(() => keep(S2, at(start + 89 * MINUTE)), (error) => error instanceof Problem && error.code === 'claimed'
    && error.members.session === S1 && error.members.ends_at === at(start + 90 * MINUTE));
  // After it, the write claims the entry, and the claim that ended is released as idle.
  const taken = keep(S2, at(start + 90 * MINUTE));
  assert.equal(taken.session, S2);
  assert.deepEqual(claimsOf(db, entry).map((row) => [row.session, row.release_reason, row.released_at]), [
    [S1, 'idle', at(start + 90 * MINUTE)],
    [S2, null, null],
  ]);
});

test('keepClaim takes an open entry of the agent to-do and checks what it is given', (t) => {
  const { db, s, space, thread, entry, keep } = smallest(t);
  for (const [field, value] of [['session', 'has space'], ['time', '2026-11-23'], ['credential', 0]]) {
    const args = { project: space.id, entry, session: S1, credential: s.agent.key, time: TIME, [field]: value };
    assert.throws(() => keepClaim(db, args), TypeError, field);
  }
  // The owner's question entry is no entry of the agent to-do, and a closed entry holds no claim.
  s.comment(thread, { author: 'agent' });
  threadChanged(db, { project: space.id, thread, time: TIME });
  assert.throws(() => keep(S1, TIME), /an open entry of the agent to-do/);
  const question = openEntry(db, 'thread_id', thread, 'question');
  assert.throws(() => keepClaim(db, { project: space.id, entry: question, session: S1, credential: s.agent.key, time: TIME }), TypeError);
  assert.deepEqual(claimsOf(db, entry), []);
});

test('the agent operation that closes its own entry releases its claim as done (finishClaim; SPEC-017)', (t) => {
  const { db, s, space, thread, entry, keep } = smallest(t);
  const later = '2026-11-23T01:10:00.000Z';
  // An agent's reply: it keeps the claim, adds its comment, closes the entry and finishes the claim.
  keep(S1, later);
  s.comment(thread, { author: 'agent' });
  threadChanged(db, { project: space.id, thread, time: later });
  // Another session's finish releases nothing.
  assert.deepEqual(finishClaim(db, { project: space.id, entry, session: S2, time: later }), { released: 0 });
  assert.deepEqual(finishClaim(db, { project: space.id, entry, session: S1, time: later }), { released: 1 });
  assert.deepEqual(claimsOf(db, entry), [{ session: S1, claimed_at: later, last_write_at: later, released_at: later, release_reason: 'done' }]);
  assert.deepEqual(finishClaim(db, { project: space.id, entry, session: S1, time: later }), { released: 0 });
  assert.throws(() => finishClaim(db, { project: space.id, entry, session: S1, time: 'later' }), TypeError);
});
