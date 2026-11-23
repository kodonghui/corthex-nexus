// Writes: one at a time, in the order they arrive (rule 4), each in one transaction with its request key (rule 3).
//
// Every operation whose method is not GET writes. A write arrives when its request is routed, admitted and its body
// read and checked; it then waits in one queue for the whole server and runs when the writes before it have ended.
// Rule 4 asks this of writes to one project; one queue is stricter, and it is what the store allows: the store is one
// SQLite connection, which holds one transaction at a time. So a long write, such as a large snapshot, holds the
// writes of other projects until it ends.
//
// A write runs in one transaction (BEGIN IMMEDIATE ... COMMIT) from its request key's check to its key's row, so a
// write that fails or is refused changes nothing and leaves no key, and a write that is stored keeps its key. Its
// handler may wait (await); the next write waits with it. A read that runs meanwhile on the same connection sees the
// write's rows before they commit, so a write handler does its waiting before it writes. Its answer is checked whole
// (see answer.js) before anything is stored, so a write whose answer could not be sent is rolled back, not stored.

import { answerOf, keptAnswer } from './answer.js';
import { actionOf, requestKeys } from './keys.js';
import { Problem } from './problem.js';

// Runs each task after the ones given before it have ended, whether they succeeded or failed.
export function createQueue() {
  let tail = Promise.resolve();
  const ignore = () => {};
  return function run(task) {
    const result = tail.then(() => task());
    tail = result.then(ignore, ignore);
    return result;
  };
}

export function isWrite(route) {
  return route.method !== 'GET';
}

// write(route, context, request) runs route.handle(context) as a write and returns its answer (see answer.js), or the
// first answer of its request key. request is { pathname, key, bytes }: the path as sent, the request key or null,
// and the body's bytes or null. context.caller is the actor the key belongs to: 'owner' or an agent credential's ID.
export function createWrites({ store, now = Date.now }) {
  const queue = createQueue();
  const keys = store === null ? null : requestKeys(store, now);

  async function run(route, context, request) {
    // Without a store, as in the router's own tests, a write runs in the queue alone.
    if (store === null) {
      if (request.key !== null) throw new TypeError('a write with a request key needs the store');
      return answerOf(await route.handle(context));
    }
    if (request.key !== null && (typeof context.caller !== 'string' || context.caller === '')) {
      throw new TypeError('a write with a request key needs its caller');
    }
    store.exec('BEGIN IMMEDIATE');
    try {
      let action = null;
      if (request.key !== null) {
        // request_keys.action: the operationId and the SHA-256 of the path and body (see keys.js).
        action = actionOf(route.action, request.pathname, request.bytes);
        const first = keys.find(context.caller, request.key);
        if (first !== undefined) {
          store.exec('ROLLBACK');
          if (first.action !== action) throw new Problem('request_key_reused');
          return keptAnswer(first.status, first.text);
        }
      }
      const result = await route.handle(context);
      // A write refuses by throwing a Problem. An answer that could not be sent, such as another status, no body or a
      // framing header, is a fault: answerOf throws, the write is rolled back below and answers internal.
      const answer = answerOf(result);
      if (action !== null) {
        // What a repeat answers: the first answer, unless the route keeps less, as API-280 keeps no secret.
        const kept = route.repeat === undefined ? answer : answerOf(route.repeat(result));
        keys.remember(context.caller, request.key, action, kept.status, kept.text);
      }
      store.exec('COMMIT');
      return answer;
    } catch (error) {
      if (store.isTransaction) store.exec('ROLLBACK');
      throw error;
    }
  }

  return (route, context, request) => queue(() => run(route, context, request));
}
