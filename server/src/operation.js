// The operation a piece of work runs for, so that what the store does can be told apart by operation (note 23 of the
// WBS): the router runs each handler inside its operation (see router.js), and what runs outside any handler, such as
// admission and request keys, runs for none. test/tables.js reads it to check the tables each operation touches
// against the contract's x-corthex.tables.

import { AsyncLocalStorage } from 'node:async_hooks';

const running = new AsyncLocalStorage();

// Runs work(), and what it waits for, as the operation action (an operationId); returns what work() returns.
export function runAs(action, work) {
  return running.run(action, work);
}

// The operationId of the operation running now, or null outside every handler.
export function runningAction() {
  return running.getStore() ?? null;
}
