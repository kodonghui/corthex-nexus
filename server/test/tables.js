// Shared by the tests: the tables each operation touches, recorded from the store and checked against the contract's
// x-corthex.tables (note 23 of the WBS). node --test also runs this file, which holds no test.
//
// SQLite's authorizer reports each table a statement reads and writes when the statement is prepared. recordTables
// wraps a store so that each statement prepared through it keeps what it reported, and each time a statement runs,
// its tables are noted for the operation that runs then (src/operation.js), or for the request layer when no handler
// runs, as for admission and request keys. So a statement prepared once and run by several operations counts for each.
//
// A statement also reports tables it reaches only through the schema's keys: SQLite reads the tables keyed to a table
// it writes, parents and children, to check a foreign key, and an ON DELETE CASCADE deletes from every table it
// reaches. Those need no listing, and the store's schema tells them apart: a read of a table keyed to a table the
// statement writes, and a delete from a table that a cascade reaches from another table the statement deletes from.
// The authorizer gives no mark of which reads are the key's, so a statement's own read of a table keyed to the one it
// writes is not counted either; a statement that reads such a table, as an INSERT ... SELECT may, reads it as a key
// check would.

import assert from 'node:assert/strict';
import { constants } from 'node:sqlite';
import { runningAction } from '../src/operation.js';
import { operations, read } from './contract.js';

const WRITES = new Map([
  [constants.SQLITE_INSERT, 'insert'],
  [constants.SQLITE_UPDATE, 'update'],
  [constants.SQLITE_DELETE, 'delete'],
]);
// The ways a statement of node:sqlite runs.
const RUNS = new Set(['run', 'get', 'all', 'iterate']);

// The TBL IDs of db/nexus.sql by table name, from the comment above each table.
export const TABLE_IDS = new Map([...read('db/nexus.sql').matchAll(/^-- (TBL-\d+) ([a-z_]+) /gm)]
  .map(([, id, table]) => [table, id]));

// The request layer's tables, which no operation lists: request keys (TBL-169, note 21 of the WBS) and the agent
// credentials that admission checks and marks used (TBL-146).
export const LAYER_TABLES = Object.freeze(['request_keys', 'agent_credentials']);

// Wraps db: returns { store, tables(action), layer(), runs() }. store is the wrapped store, which the server and its
// handlers are given in place of db; tables(action) is the set of tables the statements run for that operationId
// touched, layer() those run outside every handler, and runs() how many statements have run.
export function recordTables(db) {
  const keys = keysOf(db);
  const touched = new Map();
  let runs = 0;
  const note = (tables) => {
    runs += 1;
    const action = runningAction();
    if (!touched.has(action)) touched.set(action, new Set());
    for (const table of tables) touched.get(action).add(table);
  };
  const statementOf = (statement, tables) => new Proxy(statement, {
    get(target, name) {
      const value = Reflect.get(target, name, target);
      if (typeof value !== 'function') return value;
      if (!RUNS.has(name)) return value.bind(target);
      return (...args) => {
        note(tables);
        return value.apply(target, args);
      };
    },
  });
  const store = new Proxy(db, {
    get(target, name) {
      if (name === 'prepare') {
        return (...args) => {
          const { result, tables } = analysed(target, keys, () => target.prepare(...args));
          return statementOf(result, tables);
        };
      }
      if (name === 'exec') {
        // exec prepares and runs at once, so its tables are noted as it runs.
        return (...args) => {
          const { result, tables } = analysed(target, keys, () => target.exec(...args));
          note(tables);
          return result;
        };
      }
      const value = Reflect.get(target, name, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return {
    store,
    tables: (action) => new Set(touched.get(action) ?? []),
    layer: () => new Set(touched.get(null) ?? []),
    runs: () => runs,
  };
}

// Tables an operation lists that a later task of the WBS builds the part of it that touches them, by operation: until
// that task lands, the operation touches the other tables it lists. The task that lands removes its entry, and then
// its tables are checked like any other; a table here that the operation touches already fails, so an entry cannot
// outlive its task. tables.test.js checks that each entry names listed tables and its task.
export const PENDING = Object.freeze({
  // TASK-418 keeps the snapshot; TASK-419 draws it, into diagrams, drawings and elements (see src/drawing.js).
  pushSnapshot: Object.freeze({ task: 'TASK-419', tables: Object.freeze(['TBL-151', 'TBL-152', 'TBL-153']) }),
});

// Checks that the tables the operation action touched are exactly the TBL IDs its x-corthex.tables lists, less those
// PENDING leaves to a later task: a table it touched but does not list fails, and so does a listed table it never
// touched. So it is checked once every response of the operation has run, at the end of the operation's tests.
export function checkTables(recorder, action) {
  const pending = Object.hasOwn(PENDING, action) ? PENDING[action].tables : [];
  const listed = [...listedTables(action)].filter((table) => !pending.includes(table)).sort();
  const touched = [...recorder.tables(action)].map((table) => TABLE_IDS.get(table) ?? table).sort();
  assert.deepEqual(touched, listed, `${action} touches other tables than x-corthex.tables lists`);
}

// Checks that what ran outside every handler touched the request layer's tables only.
export function checkLayer(recorder) {
  for (const table of recorder.layer()) assert.ok(LAYER_TABLES.includes(table), `the request layer touched ${table}`);
}

// The TBL IDs an operation's x-corthex.tables lists.
export function listedTables(action) {
  const found = operations().find(({ operation }) => operation.operationId === action);
  assert.ok(found, `${action} is no operation of the contract`);
  return new Set(found.operation['x-corthex'].tables);
}

// What a statement touches, by the authorizer while compile() prepares it: { result, tables }, the tables less those
// reached only through the schema's keys.
function analysed(db, keys, compile) {
  const reads = new Set();
  const writes = new Map();
  db.setAuthorizer((action, table) => {
    if (typeof table === 'string' && !table.startsWith('sqlite_')) {
      if (action === constants.SQLITE_READ) reads.add(table);
      const kind = WRITES.get(action);
      if (kind !== undefined) {
        if (!writes.has(table)) writes.set(table, new Set());
        writes.get(table).add(kind);
      }
    }
    return constants.SQLITE_OK;
  });
  let result;
  try {
    result = compile();
  } finally {
    db.setAuthorizer(null);
  }
  // The tables a cascade reaches from another table the statement deletes from.
  const cascaded = new Set();
  for (const [table, kinds] of writes) {
    if (!kinds.has('delete')) continue;
    for (const reached of reachedBy(keys.cascades, table)) if (reached !== table) cascaded.add(reached);
  }
  const tables = new Set();
  for (const [table, kinds] of writes) {
    if (!(cascaded.has(table) && kinds.size === 1 && kinds.has('delete'))) tables.add(table);
  }
  // The tables keyed to a table the statement writes, which a foreign key's check reads.
  const keyed = new Set([...writes.keys()].flatMap((table) => [...(keys.keyed.get(table) ?? [])]));
  for (const table of reads) {
    if (writes.has(table) ? !cascaded.has(table) : !keyed.has(table)) tables.add(table);
  }
  return { result, tables };
}

// For each table of the store: keyed, the tables its foreign keys name and those whose foreign keys name it; and
// cascades, the tables whose foreign keys to it delete their rows with it (ON DELETE CASCADE).
function keysOf(db) {
  const tables = db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all()
    .map((row) => row.name);
  const keyed = new Map(tables.map((table) => [table, new Set()]));
  const cascades = new Map(tables.map((table) => [table, new Set()]));
  const keysOfTable = db.prepare('SELECT "table" AS parent, on_delete FROM pragma_foreign_key_list(?)');
  for (const child of tables) {
    for (const { parent, on_delete: onDelete } of keysOfTable.all(child)) {
      keyed.get(child).add(parent);
      keyed.get(parent).add(child);
      if (onDelete === 'CASCADE') cascades.get(parent).add(child);
    }
  }
  return { keyed, cascades };
}

// Every table that edges reach from start, start included.
function reachedBy(edges, start) {
  const reached = new Set([start]);
  const waiting = [start];
  while (waiting.length > 0) {
    for (const next of edges.get(waiting.pop()) ?? []) {
      if (!reached.has(next)) {
        reached.add(next);
        waiting.push(next);
      }
    }
  }
  return reached;
}
