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
