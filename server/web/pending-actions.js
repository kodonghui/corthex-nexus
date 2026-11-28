// The owner's ten-second undo window. Requests are persisted until their outcome is known so a pagehide send that
// loses its response can be retried with the same idempotency key on the next visit.
import { isRetryableOutcome, newRequestKey, write } from './api.js';

const PREFIX = 'nexus-pending-action:';
const PATH = /^\/api\/projects\/[a-z0-9-]+\/(?:threads\/nc_[0-9a-hjkmnp-tv-z]{12}\/comments|change-sets\/np_[0-9a-hjkmnp-tv-z]{12}\/(?:accept|reject))$/;
const KEY = /^nw_[0-9a-hjkmnp-tv-z]{12}$/;
export const UNDO_MS = 10_000;

export function pendingActions({ storage = globalThis.localStorage, send = write, schedule = setTimeout, cancelTimer = clearTimeout, onChange = () => {} } = {}) {
  const live = new Map();
  const inFlight = new Set();
  const save = (item) => storage.setItem(PREFIX + item.key, JSON.stringify(item));
  const forget = (item) => storage.removeItem(PREFIX + item.key);

  async function dispatch(item, keepalive = false, hooks = null) {
    const current = live.get(item.key) ?? hooks;
    if (current?.sending || inFlight.has(item.key)) return;
    inFlight.add(item.key);
    if (current) { cancelTimer(current.timer); current.sending = true; }
    item.state = 'sending';
    try { save(item); } catch { /* The original persisted entry still warns on the next visit. */ }
    onChange();
    let result;
    try { result = await send('POST', item.path, item.body, item.key, { keepalive }); }
    catch { result = { failure: 'network' }; }
    inFlight.delete(item.key);
    if (current) current.sending = false;
    if (result.status === 200 || result.status === 201) {
      try {
        forget(item);
        for (const old of recovered()) {
          const sameTarget = targetOf(old.path) === targetOf(item.path);
          const sameDecision = item.path.includes('/change-sets/') || old.body.text === item.body.text;
          if (old.state === 'failed' && sameTarget && sameDecision) forget(old);
        }
      } catch { /* A retry with the same key remains safe. */ }
      live.delete(item.key);
      current?.done?.(result.body, result);
    } else {
      // An explicit client refusal remains visible but does not block a new action.
      if (result.status >= 400 && result.status < 500 && !isRetryableOutcome(result)) {
        item.state = 'failed';
        try { save(item); } catch { /* Keep the previous persisted marker. */ }
      } else {
        item.state = 'unconfirmed';
        try { save(item); } catch { /* Keep the earlier marker. */ }
      }
      live.delete(item.key);
      current?.failed?.(result, item.key);
    }
    onChange(result, Boolean(current?.done));
    return result;
  }

  const targetOf = (path) => path.replace(/\/(?:accept|reject)$/, '');
  const hasTarget = (path) => [...live.values()].some(({ item }) => targetOf(item.path) === targetOf(path))
    || recovered().some((item) => item.state !== 'failed' && targetOf(item.path) === targetOf(path));
  function enqueue(path, body, { done = null, failed = null, undone = null } = {}) {
    if (!PATH.test(path)) throw new Error('invalid action path');
    if (hasTarget(path)) throw new Error('already pending');
    const item = { key: newRequestKey(), path, body, state: 'waiting' };
    // If storage is unavailable the UI must not say that the action can be recovered after leaving.
    save(item);
    const handle = { item, timer: null, sending: false, done, failed, undone };
    live.set(item.key, handle);
    handle.timer = schedule(() => dispatch(item), UNDO_MS);
    onChange();
    return item.key;
  }

  function undo(key) {
    const handle = live.get(key);
    if (!handle || handle.sending) return false;
    try { forget(handle.item); } catch { return false; }
    cancelTimer(handle.timer);
    live.delete(key);
    handle.undone?.();
    onChange();
    return true;
  }

  function flush() {
    for (const { item, sending } of live.values()) if (!sending) dispatch(item, true);
  }

  function recovered() {
    const items = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(PREFIX)) continue;
      try {
        const item = JSON.parse(storage.getItem(key));
        if (KEY.test(item?.key ?? '') && key === PREFIX + item.key && PATH.test(item?.path ?? '') && item?.body && typeof item.body === 'object' && !Array.isArray(item.body) && !live.has(item.key)) items.push(item);
      } catch { /* Ignore an unreadable marker. */ }
    }
    return items;
  }
  return { enqueue, undo, flush, recovered, hasTarget, discard: (item) => { if (inFlight.has(item.key)) return false; forget(item); onChange(); return true; }, retry: (item, hooks = null) => dispatch(item, false, hooks), has: (key) => live.has(key), waiting: () => [...live.values()].filter((item) => !item.sending).map(({ item }) => item) };
}
