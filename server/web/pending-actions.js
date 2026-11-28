// The owner's ten-second undo window. Requests are persisted until their outcome is known so a pagehide send that
// loses its response can be retried with the same idempotency key on the next visit.
import { isRetryableOutcome, newRequestKey, write } from './api.js';

const PREFIX = 'nexus-pending-action:';
const PATH = /^\/api\/projects\/[a-z0-9-]+\/(?:threads\/nc_[0-9a-hjkmnp-tv-z]{12}\/comments|change-sets\/np_[0-9a-hjkmnp-tv-z]{12}\/(?:accept|reject))$/;
const KEY = /^nw_[0-9a-hjkmnp-tv-z]{12}$/;
export const UNDO_MS = 10_000;

export function pendingActions({ storage = globalThis.localStorage, send = write, schedule = setTimeout, cancelTimer = clearTimeout, now = Date.now, onChange = () => {} } = {}) {
  const live = new Map();
  const inFlight = new Map();
  const remembered = new Map();
  const discarded = new Set();
  const save = (item) => storage.setItem(PREFIX + item.key, JSON.stringify(item));
  const forget = (item) => storage.removeItem(PREFIX + item.key);
  const savedCopy = (item) => {
    try {
      const saved = JSON.parse(storage.getItem(PREFIX + item.key));
      return saved?.key === item.key && saved.path === item.path && JSON.stringify(saved.body) === JSON.stringify(item.body) ? saved : null;
    } catch { return null; }
  };
  const withinWindow = (item) => item.state === 'waiting' && (!Number.isFinite(item.expires_at) || item.expires_at > now());

  async function dispatch(item, keepalive = false, hooks = null) {
    const existing = inFlight.get(item.key);
    if (existing) {
      if (hooks) { existing.listeners.push(hooks); if (existing.fromRemembered) existing.skipCurrent = true; }
      return existing.promise;
    }
    if (live.has(item.key)) {
      let removed = false;
      try { removed = storage.getItem(PREFIX + item.key) === null; } catch { /* A storage error does not cancel the owner's action. */ }
      if (removed) {
        const handle = live.get(item.key);
        cancelTimer(handle.timer); live.delete(item.key); remembered.delete(item.key);
        handle.undone?.('elsewhere'); onChange();
        return { failure: 'discarded' };
      }
    }
    const current = live.get(item.key) ?? hooks ?? remembered.get(item.key);
    let settleFlight;
    const flight = { listeners: [], fromRemembered: current != null && current === remembered.get(item.key) && !live.has(item.key) && hooks === null,
      skipCurrent: false, promise: new Promise((resolve) => { settleFlight = resolve; }) };
    inFlight.set(item.key, flight);
    if (current) { cancelTimer(current.timer); current.sending = true; }
    item.state = 'sending';
    try { save(item); } catch { /* The original persisted entry still warns on the next visit. */ }
    try { onChange(); } catch { /* A broken view must not strand a send. */ }
    let result;
    try { result = await send('POST', item.path, item.body, item.key, { keepalive }); }
    catch { result = { failure: 'network' }; }
    if (current) current.sending = false;
    let viewFailed = false;
    const notify = (handler, name, ...args) => {
      try { handler?.[name]?.(...args); } catch { viewFailed = true; }
    };
    try {
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
        remembered.delete(item.key);
        if (!flight.skipCurrent) notify(current, 'done', result.body, result);
        for (const listener of flight.listeners) notify(listener, 'done', result.body, result);
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
        if (item.state === 'failed') remembered.delete(item.key);
        if (!flight.skipCurrent) notify(current, 'failed', result, item.key);
        for (const listener of flight.listeners) notify(listener, 'failed', result, item.key);
      }
      const handlesHere = (handler) => {
        try { return Boolean(handler?.done && (!handler.active || handler.active())); }
        catch { viewFailed = true; return false; }
      };
      const handled = (!flight.skipCurrent && handlesHere(current)) || flight.listeners.some(handlesHere);
      onChange(result, handled, viewFailed, item);
      return result;
    } finally {
      inFlight.delete(item.key);
      settleFlight(result);
    }
  }

  const targetOf = (path) => path.replace(/\/(?:accept|reject)$/, '');
  const hasOtherTarget = (path, key = null) => [...live.values()].some(({ item }) => item.key !== key && targetOf(item.path) === targetOf(path))
    || recovered().some((item) => item.key !== key && item.state !== 'failed' && targetOf(item.path) === targetOf(path));
  const hasTarget = (path) => hasOtherTarget(path);
  function enqueue(path, body, { done = null, failed = null, undone = null, active = null, draft = null, draftText = null } = {}) {
    if (!PATH.test(path)) throw new Error('invalid action path');
    try { if (hasTarget(path)) throw new Error('already pending'); }
    catch (error) { if (error.message === 'already pending') throw error; throw new Error('storage unavailable', { cause: error }); }
    const item = { key: newRequestKey(), path, body, state: 'waiting', expires_at: now() + UNDO_MS };
    if (typeof draft === 'string') item.draft = draft;
    if (typeof draftText === 'string') item.draftText = draftText;
    // If storage is unavailable the UI must not say that the action can be recovered after leaving.
    try { save(item); } catch (error) { throw new Error('storage unavailable', { cause: error }); }
    const handle = { item, timer: null, sending: false, done, failed, undone, active };
    live.set(item.key, handle);
    remembered.set(item.key, handle);
    handle.timer = schedule(() => dispatch(item), UNDO_MS);
    try { onChange(); } catch { /* The queued action is still retained. */ }
    return item.key;
  }

  function undo(key) {
    const handle = live.get(key);
    if (!handle || handle.sending) return false;
    if (!withinWindow(handle.item)) return false;
    try {
      const saved = JSON.parse(storage.getItem(PREFIX + key));
      if (saved?.state !== 'waiting') return false;
    } catch { return false; }
    try { forget(handle.item); } catch { return false; }
    cancelTimer(handle.timer);
    live.delete(key);
    remembered.delete(key);
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
  function canForceDiscard(item) {
    const saved = savedCopy(item);
    return !!saved && !inFlight.has(item.key) && (saved.state === 'waiting' || saved.state === 'sending');
  }
  function discard(item, force = false) {
    const saved = savedCopy(item);
    if (!saved || inFlight.has(item.key) || (!force && (saved.state === 'waiting' || saved.state === 'sending'))) return false;
    try { forget(saved); } catch { return false; }
    remembered.delete(item.key); discarded.add(item.key); onChange(); return true;
  }
  function retry(item, hooks = null) {
    const saved = savedCopy(item);
    if (!inFlight.has(item.key) && hasOtherTarget(item.path, item.key)) return Promise.resolve({ failure: 'pending' });
    // A view's explicit retry can reconstruct a dismissed marker using its original key; a stale banner cannot.
    if (!saved && !hooks && !inFlight.has(item.key)) return Promise.resolve({ failure: 'stale' });
    const candidate = saved ?? item;
    if (withinWindow(candidate)) return Promise.resolve({ failure: 'pending' });
    return dispatch(candidate, false, hooks);
  }
  return { enqueue, undo, flush, recovered, hasTarget, hasOtherTarget, discard, canForceDiscard, retry, wasDiscarded: (key) => discarded.has(key), has: (key) => live.has(key), waiting: () => [...live.values()].filter((item) => !item.sending).map(({ item }) => item) };
}
