import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pendingActions, UNDO_MS } from '../web/pending-actions.js';
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
  const first = pendingActions({ storage: store, schedule: () => 1, cancelTimer: () => {} });
  const key = first.enqueue('/api/projects/demo/change-sets/np_000000000001/accept', {});
  let release; let calls = 0;
  const next = pendingActions({ storage: store, send: () => { calls += 1; return new Promise((resolve) => { release = resolve; }); } });
  const item = next.recovered()[0];
  const sent = next.retry(item);
  next.retry(item);
  assert.equal(calls, 1);
  assert.equal(next.discard(item), false);
  release({ failure: 'network' });
  await sent;
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
