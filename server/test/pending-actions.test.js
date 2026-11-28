import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pendingActions, RETRY_LIMIT_MS, UNDO_MS } from '../web/pending-actions.js';
function storage() {
  const map = new Map();
  return { get length() { return map.size; }, key: (n) => [...map.keys()][n] ?? null,
    getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: (k) => map.delete(k) };
}
test('undo suppresses the write; expiry sends once', async () => {
  const store = storage(); const timers = []; const sent = [];
  const queue = pendingActions({ storage: store, schedule: (fn, ms) => { assert.equal(ms, UNDO_MS); timers.push(fn); return timers.length; },
    cancelTimer: () => {}, send: async (...args) => { sent.push(args); return { status: 200 }; } });
  const first = queue.enqueue('/api/projects/demo/change-sets/np_000000000001/accept', {});
  assert.equal(queue.undo(first), true); assert.equal(store.length, 0);
  queue.enqueue('/api/projects/demo/change-sets/np_000000000001/accept', { text: 'answer' }); await timers[1]();
  assert.equal(sent.length, 1); assert.equal(store.length, 0);
});
test('pagehide sends with keepalive and a lost answer can be retried with the same key', async () => {
  const store = storage(); const sent = [];
  const send = async (...args) => { sent.push(args); return sent.length === 1 ? { failure: 'network' } : { status: 200 }; };
  const queue = pendingActions({ storage: store, schedule: () => 1, cancelTimer: () => {}, send });
  const key = queue.enqueue('/api/projects/demo/change-sets/np_000000000001/accept', {}); queue.flush();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sent[0][4].keepalive, true); assert.equal(queue.undo(key), false);
  const recovery = pendingActions({ storage: store, send }); const items = recovery.recovered();
  assert.equal(items.length, 1); await recovery.retry(items[0]);
  assert.equal(sent[1][3], key); assert.equal(store.length, 0);
});

test('opposite decisions cannot both wait for one proposal', () => {
  const queue = pendingActions({ storage: storage(), schedule: () => 1, cancelTimer: () => {} });
  queue.enqueue('/api/projects/demo/change-sets/np_000000000001/accept', {});
  assert.throws(() => queue.enqueue('/api/projects/demo/change-sets/np_000000000001/reject', {}), /already pending/);
});

test('storage failure refuses to start an action', () => {
  const store = storage(); store.setItem = () => { throw new Error('blocked'); };
  let scheduled = false;
  const queue = pendingActions({ storage: store, schedule: () => { scheduled = true; } });
  assert.throws(() => queue.enqueue('/api/projects/demo/change-sets/np_000000000001/accept', {}));
  assert.equal(scheduled, false);
});

test('a recovered action is retried once with its original key and can be dismissed', async () => {
  const store = storage();
  const first = pendingActions({ storage: store, now: () => 0, schedule: () => 1, cancelTimer: () => {} });
  const key = first.enqueue('/api/projects/demo/change-sets/np_000000000001/accept', {});
  let release; let calls = 0;
  const next = pendingActions({ storage: store, now: () => UNDO_MS, send: () => { calls += 1; return new Promise((resolve) => { release = resolve; }); } });
  const item = next.recovered()[0];
  const sent = next.retry(item);
  let attachedFailure = null;
  const attached = next.retry(item, { failed: (result) => { attachedFailure = result.failure; } });
  assert.equal(calls, 1);
  assert.equal(next.discard(item), false);
  release({ failure: 'network' });
  await sent; await attached;
  assert.equal(attachedFailure, 'network');
  assert.equal(next.recovered()[0].key, key);
  assert.equal(next.discard(item), true);
  assert.equal(next.recovered().length, 0);
});

test('a definite refusal remains visible but allows a new decision', async () => {
  const store = storage(); const timers = [];
  const queue = pendingActions({ storage: store, schedule: (fn) => { timers.push(fn); return timers.length; },
    cancelTimer: () => {}, send: async () => ({ status: 409, code: 'document_changed' }) });
  const path = '/api/projects/demo/change-sets/np_000000000001/accept';
  queue.enqueue(path, {});
  await timers[0]();
  assert.equal(queue.recovered()[0].state, 'failed');
  assert.equal(queue.hasTarget(path), false);
  assert.doesNotThrow(() => queue.enqueue(path, {}));
});

test('an uncertain failure blocks the same target until retry or dismissal', async () => {
  const store = storage(); const timers = [];
  const queue = pendingActions({ storage: store, schedule: (fn) => { timers.push(fn); return timers.length; },
    cancelTimer: () => {}, send: async () => ({ status: 500, code: 'internal' }) });
  const path = '/api/projects/demo/change-sets/np_000000000001/accept';
  queue.enqueue(path, {});
  await timers[0]();
  assert.equal(queue.hasTarget(path), true);
  assert.throws(() => queue.enqueue(path, {}), /already pending/);
  assert.equal(queue.discard(queue.recovered()[0]), true);
  assert.equal(queue.hasTarget(path), false);
});

test('authentication and temporary refusals keep a retryable action', async () => {
  for (const status of [401, 408, 429]) {
    const store = storage(); const timers = [];
    const queue = pendingActions({ storage: store, schedule: (fn) => { timers.push(fn); return timers.length; },
      cancelTimer: () => {}, send: async () => ({ status }) });
    const path = '/api/projects/demo/change-sets/np_000000000001/accept';
    queue.enqueue(path, {});
    await timers[0]();
    assert.equal(queue.recovered()[0].state, 'unconfirmed', String(status));
    assert.equal(queue.hasTarget(path), true, String(status));
  }
});

test('a later successful decision clears earlier failed records for the same proposal', async () => {
  const store = storage(); const timers = []; let status = 409;
  const queue = pendingActions({ storage: store, schedule: (fn) => { timers.push(fn); return timers.length; },
    cancelTimer: () => {}, send: async () => ({ status }) });
  const path = '/api/projects/demo/change-sets/np_000000000001/accept';
  queue.enqueue(path, {}); await timers[0]();
  assert.equal(queue.recovered()[0].state, 'failed');
  status = 200;
  queue.enqueue(path.replace('/accept', '/reject'), {}); await timers[1]();
  assert.equal(queue.recovered().length, 0);
});


test('a later different reply does not erase a failed answer to the same thread', async () => {
  const store = storage(); const timers = []; let status = 409;
  const queue = pendingActions({ storage: store, schedule: (fn) => { timers.push(fn); return timers.length; },
    cancelTimer: () => {}, send: async () => ({ status }) });
  const path = '/api/projects/demo/threads/nc_000000000001/comments';
  queue.enqueue(path, { text: '첫 답변' }); await timers[0]();
  status = 201;
  queue.enqueue(path, { text: '다른 답변' }); await timers[1]();
  assert.deepEqual(queue.recovered().map((item) => [item.state, item.body.text]), [['failed', '첫 답변']]);
});


test('a later successful identical reply clears its failed notice', async () => {
  const store = storage(); const timers = []; let status = 409;
  const queue = pendingActions({ storage: store, schedule: (fn) => { timers.push(fn); return timers.length; },
    cancelTimer: () => {}, send: async () => ({ status }) });
  const path = '/api/projects/demo/threads/nc_000000000001/comments';
  queue.enqueue(path, { text: '같은 답변' }); await timers[0]();
  status = 201;
  queue.enqueue(path, { text: '같은 답변' }); await timers[1]();
  assert.equal(queue.recovered().length, 0);
});

test('a different pending action on the same proposal is detected without blocking its own key', () => {
  const queue = pendingActions({ storage: storage(), schedule: () => 1, cancelTimer: () => {} });
  const accept = '/api/projects/demo/change-sets/np_000000000001/accept';
  const reject = accept.replace('/accept', '/reject');
  const key = queue.enqueue(reject, {});
  assert.equal(queue.hasOtherTarget(accept, key), false);
  assert.equal(queue.hasOtherTarget(accept, 'nw_000000000000'), true);
});


test('a recovered retry cannot race a different pending proposal decision', async () => {
  const store = storage(); let sends = 0;
  const queue = pendingActions({ storage: store, schedule: () => 1, cancelTimer: () => {},
    send: async () => { sends += 1; return { status: 200 }; } });
  const accept = '/api/projects/demo/change-sets/np_000000000001/accept';
  const reject = accept.replace('/accept', '/reject');
  const other = queue.enqueue(reject, {});
  const result = await queue.retry({ key: 'nw_000000000000', path: accept, body: {}, state: 'unconfirmed' });
  assert.equal(result.failure, 'pending');
  assert.equal(sends, 0);
  assert.equal(queue.undo(other), true);
});

test('a completed retry refreshes the shell when its screen handler is no longer live', async () => {
  const store = storage();
  const first = pendingActions({ storage: store, now: () => 0, schedule: () => 1, cancelTimer: () => {} });
  first.enqueue('/api/projects/demo/threads/nc_000000000001/comments', { text: '답변' });
  const changes = [];
  const next = pendingActions({ storage: store, now: () => UNDO_MS, send: async () => ({ status: 201, body: {} }),
    onChange: (result, handled) => { if (result) changes.push(handled); } });
  await next.retry(next.recovered()[0], { active: () => false, done: () => {} });
  assert.deepEqual(changes, [false]);
});

test('an enqueued action uses its live-screen guard on completion', async () => {
  const timers = []; const changes = [];
  const queue = pendingActions({ storage: storage(), schedule: (fn) => { timers.push(fn); return 1; }, cancelTimer: () => {},
    send: async () => ({ status: 201 }), onChange: (result, handled) => { if (result) changes.push(handled); } });
  queue.enqueue('/api/projects/demo/threads/nc_000000000001/comments', { text: '답변' }, { active: () => false, done: () => {} });
  await timers[0]();
  assert.deepEqual(changes, [false]);
});

test('a recovered action retains its original screen handler for a global retry', async () => {
  const timers = []; let calls = 0; let completed = 0;
  const queue = pendingActions({ storage: storage(), schedule: (fn) => { timers.push(fn); return 1; }, cancelTimer: () => {},
    send: async () => ++calls === 1 ? { failure: 'network' } : { status: 201 } });
  queue.enqueue('/api/projects/demo/threads/nc_000000000001/comments', { text: '답변' }, { done: () => { completed += 1; } });
  await timers[0]();
  await queue.retry(queue.recovered()[0]);
  assert.equal(completed, 1);
});

test('a broken screen callback cannot suppress joined callbacks or the refresh signal', async () => {
  const store = storage(); let release; const changes = [];
  const first = pendingActions({ storage: store, now: () => 0, schedule: () => 1, cancelTimer: () => {} });
  first.enqueue('/api/projects/demo/threads/nc_000000000001/comments', { text: '답변' });
  const queue = pendingActions({ storage: store, now: () => UNDO_MS, send: () => new Promise((resolve) => { release = resolve; }),
    onChange: (result, handled, failed) => { if (result) changes.push([handled, failed]); } });
  const item = queue.recovered()[0]; let joined = false;
  const sent = queue.retry(item, { done: () => { throw new Error('broken view'); } });
  const another = queue.retry(item, { done: () => { joined = true; } });
  release({ status: 201 });
  await Promise.all([sent, another]);
  assert.equal(joined, true);
  assert.deepEqual(changes, [[true, true]]);
});

test('a screen retry joining a global retry replaces the remembered callback', async () => {
  const timers = []; let calls = 0; let release; const completed = [];
  const queue = pendingActions({ storage: storage(), schedule: (fn) => { timers.push(fn); return 1; }, cancelTimer: () => {},
    send: () => ++calls === 1 ? Promise.resolve({ failure: 'network' }) : new Promise((resolve) => { release = resolve; }) });
  queue.enqueue('/api/projects/demo/threads/nc_000000000001/comments', { text: '답변' }, { done: () => completed.push('remembered') });
  await timers[0]();
  const item = queue.recovered()[0];
  const global = queue.retry(item);
  const screen = queue.retry(item, { done: () => completed.push('screen') });
  release({ status: 201 }); await Promise.all([global, screen]);
  assert.deepEqual(completed, ['screen']);
});

test('a broken pending notice does not leave the send in flight forever', async () => {
  const store = storage(); const timers = []; let changes = 0;
  const queue = pendingActions({ storage: store, schedule: (fn) => { timers.push(fn); return 1; }, cancelTimer: () => {},
    send: async () => ({ status: 201 }), onChange: () => { if (++changes === 2) throw new Error('broken notice'); } });
  queue.enqueue('/api/projects/demo/threads/nc_000000000001/comments', { text: '답변' });
  await timers[0]();
  assert.equal(store.length, 0);
});

test('another tab cannot send or dismiss a waiting action before its undo window ends', async () => {
  const store = storage(); let time = 1000; let sends = 0;
  const options = { storage: store, now: () => time, schedule: () => 1, cancelTimer: () => {}, send: async () => { sends += 1; return { status: 200 }; } };
  const owner = pendingActions(options); const other = pendingActions(options);
  const key = owner.enqueue('/api/projects/demo/change-sets/np_000000000001/reject', {});
  const item = other.recovered()[0];
  assert.equal((await other.retry(item)).failure, 'pending');
  assert.equal(other.discard(item), false);
  assert.equal(sends, 0);
  assert.equal(owner.undo(key), true);
  time += UNDO_MS;
  assert.equal((await other.retry(item)).failure, 'stale');
  assert.equal(sends, 0);
  const nextKey = owner.enqueue('/api/projects/demo/change-sets/np_000000000001/reject', {});
  const next = other.recovered()[0];
  time += UNDO_MS;
  assert.equal(owner.undo(nextKey), false);
  assert.equal(sends, 0);
  owner.flush();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sends, 1);
  assert.equal(next.key, nextKey);
});

test('another tab cannot discard an action that is being sent', async () => {
  const store = storage(); let release;
  const owner = pendingActions({ storage: store, schedule: () => 1, cancelTimer: () => {}, send: () => new Promise((resolve) => { release = resolve; }) });
  const other = pendingActions({ storage: store });
  owner.enqueue('/api/projects/demo/change-sets/np_000000000001/reject', {});
  const old = other.recovered()[0];
  owner.flush();
  assert.equal(other.discard(old), false);
  assert.equal(other.recovered()[0].state, 'sending');
  release({ failure: 'network' }); await new Promise((resolve) => setImmediate(resolve));
  assert.equal(other.recovered()[0].state, 'unconfirmed');
});

test('explicitly dismissing an orphaned waiting action prevents its owner timer from sending it', async () => {
  const store = storage(); const timers = []; let sends = 0; let reason = null;
  const owner = pendingActions({ storage: store, schedule: (fn) => { timers.push(fn); return 1; }, cancelTimer: () => {}, send: async () => { sends += 1; return { status: 200 }; } });
  const other = pendingActions({ storage: store });
  owner.enqueue('/api/projects/demo/change-sets/np_000000000001/reject', {}, { undone: (why) => { reason = why; } });
  const item = other.recovered()[0];
  assert.equal(other.canForceDiscard(item), true);
  assert.equal(other.discard(item, true), true);
  await timers[0]();
  assert.equal(sends, 0);
  assert.equal(reason, 'elsewhere');
});

test('an old unconfirmed action is not resent after the safe request-key period', async () => {
  const store = storage(); const timers = []; let time = 10_000; let sends = 0;
  const queue = pendingActions({ storage: store, now: () => time, schedule: (fn) => { timers.push(fn); return 1; }, cancelTimer: () => {},
    send: async () => { sends += 1; return { failure: 'network' }; } });
  queue.enqueue('/api/projects/demo/threads/nc_000000000001/comments', { text: '답변' });
  await timers[0]();
  const item = queue.recovered()[0];
  time += RETRY_LIMIT_MS;
  assert.equal(queue.expired(item), true);
  assert.equal((await queue.retry(item)).failure, 'expired');
  assert.equal(queue.hasTarget(item.path), false);
  assert.equal(sends, 1);
  assert.equal(queue.discard(item), true);
  assert.equal((await queue.retry(item, { done: () => {} })).failure, 'expired');
  assert.equal(sends, 1);
});

test('a recovery record with unknown age is never sent automatically', async () => {
  const store = storage(); let sends = 0;
  const item = { key: 'nw_000000000001', path: '/api/projects/demo/threads/nc_000000000001/comments', body: { text: '답변' }, state: 'unconfirmed' };
  store.setItem(`nexus-pending-action:${item.key}`, JSON.stringify(item));
  const queue = pendingActions({ storage: store, send: async () => { sends += 1; return { status: 201 }; } });
  assert.equal((await queue.retry(item)).failure, 'expired');
  assert.equal(sends, 0);
});

test('a small backward clock correction does not expire a fresh queued answer', async () => {
  const store = storage(); const timers = []; let time = 100_000; let sends = 0;
  const queue = pendingActions({ storage: store, now: () => time, schedule: (fn) => { timers.push(fn); return 1; }, cancelTimer: () => {},
    send: async () => { sends += 1; return { status: 201 }; } });
  queue.enqueue('/api/projects/demo/threads/nc_000000000001/comments', { text: '답변' });
  time -= 2_000; await timers[0]();
  assert.equal(sends, 1);
});

test('a long-delayed waiting action is not sent by its timer or pagehide', async () => {
  const store = storage(); const timers = []; let time = 0; let sends = 0;
  const queue = pendingActions({ storage: store, now: () => time, schedule: (fn) => { timers.push(fn); return 1; }, cancelTimer: () => {},
    send: async () => { sends += 1; return { status: 201 }; } });
  queue.enqueue('/api/projects/demo/threads/nc_000000000001/comments', { text: '답변' });
  time += RETRY_LIMIT_MS;
  await timers[0](); queue.flush();
  assert.equal(sends, 0);
  assert.equal(queue.recovered()[0].state, 'expired');
});

test('a dismissed six-day-old waiting notice does not return when its old timer runs', async () => {
  const store = storage(); const timers = []; let time = 100_000;
  const options = { storage: store, now: () => time, schedule: (fn) => { timers.push(fn); return 1; }, cancelTimer: () => {} };
  const first = pendingActions(options); const next = pendingActions(options);
  first.enqueue('/api/projects/demo/change-sets/np_000000000001/reject', {});
  const item = next.recovered()[0];
  time += RETRY_LIMIT_MS;
  assert.equal(next.canForceDiscard(item), false);
  assert.equal(next.discard(item), true);
  await timers[0]();
  assert.equal(next.recovered().length, 0);
});
