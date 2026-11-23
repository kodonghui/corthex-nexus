// Request keys (rule 3): the same key from the same caller within 7 days gets the first status and answer and
// writes nothing; a key that another request took gets request_key_reused; a refused request leaves no key behind.
//
// The keys live in TBL-169 request_keys, the request layer's own table: every write with a request key fills it, so
// no operation lists it (note 21 of the WBS). Its row is written in the transaction of the write it answers (see
// writes.js), so the write and its key are stored together or not at all.

import { createHash } from 'node:crypto';
import { LIMITS } from './limits.js';
import { invalidRequest } from './problem.js';

// The Idempotency-Key header of the contract: a write ID in double quotes, as the pinned hub sends it.
export const REQUEST_KEY = /^"(nw_[0-9a-hjkmnp-tv-z]{12})"$/;
const DAY_MS = 24 * 60 * 60 * 1000;

// The key a request carries, without its quotes. A missing or malformed key is invalid_request on Idempotency-Key;
// the detail never repeats the value.
export function requestKeyOf(headers) {
  const value = headers['idempotency-key'];
  const match = typeof value === 'string' ? REQUEST_KEY.exec(value) : null;
  if (match === null) {
    throw invalidRequest('Idempotency-Key', 'Idempotency-Key must be a write ID in double quotes, as the hub sends it');
  }
  return match[1];
}

// What request_keys.action holds for a request: the operationId, a space and the SHA-256, in hex, of the request's
// path and body bytes as sent. A key sent again for another operation, another path or another body therefore finds
// another action and gets request_key_reused. The digest is of the request, never of a credential; it lives only in
// the owner-only store and no log line holds it (rule 5).
export function actionOf(action, pathname, bytes) {
  const digest = createHash('sha256').update(pathname).update('\n').update(bytes ?? Buffer.alloc(0)).digest('hex');
  return `${action} ${digest}`;
}

// The request keys of the store. now() gives the time in milliseconds.
export function requestKeys(store, now) {
  const find = store.prepare(
    'SELECT action, status_code, answer FROM request_keys WHERE actor = ? AND request_key = ? AND created_at >= ?',
  );
  const prune = store.prepare('DELETE FROM request_keys WHERE created_at < ?');
  const insert = store.prepare(
    'INSERT INTO request_keys (actor, request_key, action, status_code, answer, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const cutoff = () => new Date(now() - LIMITS.requestKeyDays * DAY_MS).toISOString();
  return {
    // The first answer to this key from this caller within 7 days, or undefined: { action, status, text }, text being
    // its JSON body as sent.
    find(actor, key) {
      const row = find.get(actor, key, cutoff());
      if (row === undefined) return undefined;
      return { action: row.action, status: Number(row.status_code), text: row.answer };
    },
    // Keeps the first answer, its status and its JSON body as sent, after dropping every key older than 7 days, this
    // one's earlier use among them.
    remember(actor, key, action, status, text) {
      if (typeof text !== 'string') throw new TypeError('a request key keeps a JSON answer');
      prune.run(cutoff());
      insert.run(actor, key, action, status, text, new Date(now()).toISOString());
    },
  };
}
