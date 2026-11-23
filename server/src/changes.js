// The steps of a change set (TBL-159; SPEC-018, SPEC-021, SPEC-022): the one place that writes them, for the owner's
// direct edits (TASK-445, direct-edits.js) and an agent's proposals (TASK-438). A step is the contract's Change,
// { op, element, name, target }, by element key, the key an element keeps across drawings (its trace ID when it has
// one):
// - rename: element takes the name name; target is null.
// - connect: a line from element to target, in that direction, as each picture draws its lines (detail.from to
//   detail.to); name is null, and target is never element.
// - add: element is added, under the name name when the step gives one.
// - remove: element is removed.
// The steps of a change set keep their order, seq from 1, and a reflection applies them in that order. Each step names
// what it does with its own four fields only, so what a merged document lacks can be said step by step (SPEC-025,
// TASK-447): a rename of element to name, a connection from element to target, an added element and its name, or a
// removed element. writeSteps holds a step to the contract's Change and the schema's checks; a request is checked
// before it comes here, so a step that breaks them is a fault, not a refusal.

import { characters, ELEMENT_KEY, MAX_KEY } from './drawer.js';
import { LIMITS } from './limits.js';

// The contract's Change.op.
export const STEP_KINDS = Object.freeze(['rename', 'connect', 'add', 'remove']);

// The contract's ElementKey: 1 to 200 characters, with no white space at either end and no line break, as the drawer
// keeps an element's key (drawer.js).
export function isElementKey(value) {
  return typeof value === 'string' && value.isWellFormed() && characters(value) <= MAX_KEY && ELEMENT_KEY.test(value);
}

// The statements of each store, prepared on first use (see credentials.js).
const prepared = new WeakMap();

function statementsOf(store) {
  let statements = prepared.get(store);
  if (statements === undefined) {
    statements = {
      next: store.prepare('SELECT coalesce(max(seq), 0) AS seq FROM changes WHERE change_set_id = ?'),
      insert: store.prepare('INSERT INTO changes (change_set_id, seq, op, element_key, new_name, target_key) VALUES (?, ?, ?, ?, ?, ?)'),
    };
    prepared.set(store, statements);
  }
  return statements;
}

function checkStep(step) {
  const { op, element, name = null, target = null } = step;
  if (!STEP_KINDS.includes(op)) throw new TypeError('a step is rename, connect, add or remove');
  if (!isElementKey(element)) throw new TypeError("a step's element is an element key");
  if (name !== null && (typeof name !== 'string' || !name.isWellFormed() || characters(name) > LIMITS.nameCharacters)) {
    throw new TypeError("a step's name is text of at most 200 characters, or null");
  }
  if (target !== null && !isElementKey(target)) throw new TypeError("a step's target is an element key, or null");
  if (op === 'rename' && (name === null || target !== null)) throw new TypeError('a rename has a name and no target');
  if (op === 'connect' && (target === null || target === element || name !== null)) {
    throw new TypeError('a connect has a target other than its element, and no name');
  }
  return { op, element, name, target };
}

// Writes the steps of the change set whose key is changeSet after any it has, in their order, and returns how many it
// wrote. Each step is { op, element, name, target }, name and target null or left out where the step has none.
export function writeSteps(store, { changeSet, steps }) {
  if (!Number.isSafeInteger(changeSet) || changeSet < 1) throw new TypeError('changeSet is a row key');
  if (!Array.isArray(steps)) throw new TypeError('steps is a list');
  const checked = steps.map(checkStep);
  const statements = statementsOf(store);
  let seq = Number(statements.next.get(changeSet).seq);
  for (const { op, element, name, target } of checked) {
    seq += 1;
    statements.insert.run(changeSet, seq, op, element, name, target);
  }
  return checked.length;
}
