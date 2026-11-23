// The ERD drawer (TASK-422; SPEC-004): draws the stage-05 picture as its tables, with their columns and keys, and a
// line for each foreign key, placed by the picture layout (layout.js, TASK-420). It is drawing.js's drawer of the erd
// kind and keeps to the drawer interface described there and in the server's README.
//
// The picture is the pinned hub's parsed picture of the project's schema, as the contract's Snapshot says of stage
// 05: the hub's erd.py reads the SQL, so NEXUS parses none. Its format 1 is
//   { format: 1, tables: [table], without_table: [TERM ID] }
//   table: { id, name, context, removed, columns: [{ name, type, null, where }], primary_key: [column],
//            unique: [{ columns, partial }], foreign_keys: [{ columns, table, references, on_delete, where }], where }
// where each where is the file and line of the statement or column, such as db/nexus.sql:41. The hub sends a statement
// it cannot parse not in the picture but as a picture-partial check, which drawing.js gives as warnings.
//
// It draws, in this order:
// - each table of the picture, in its order: kind table, its trace ID, its name, status removed when the hub marks it
//   removed, and detail { columns: [{ name, type, null, keys }], primary_key, unique, where, box }. A column's keys
//   list primary, foreign and unique: it is in the primary key, in a foreign key, or alone a unique rule that is not
//   partial;
// - a table entry it cannot read, one that is not in the form above, is left out and marked: kind table, status
//   unreadable, its trace ID and name when it has them, and detail { columns: [], where, box };
// - a table that a foreign key names and the picture does not hold, once for each name: kind table, status missing,
//   and detail { columns: [], box } (SPEC-004);
// - a line for each foreign key of a table it read: kind line, named by its columns, its parent the table that holds
//   the key, and detail { from, to, columns, references, on_delete, where, points }: from and to the keys of that table
//   and of the table it references, and points the line from the one to the other;
// - each statement the hub left out (SPEC-004), from the warnings: kind statement, status left_out, named by what the
//   hub says of it, with detail { where }, its file and line.
// Every table has its box from layout.js, { x, y, width, height } with its top left corner, a referenced table above
// the tables that reference it; a line has the points layout.js gives it, [{ x, y }]. A box's size is worked out from
// its text, for the page that draws it (TASK-458). A statement has no box.
//
// A picture that is not format 1 with a list of tables fails the drawing at its source (SourceFailure), and so does one
// with more elements than a drawing holds, or too large a graph for layout.js to place. A foreign key names its table
// by name, as SQL does: the table of that name, or else the first whose name differs only in case. Nothing here logs
// (rule 5).

import {
  characters, elementKey, isName, isObject, isText, isTextList, keyer, leftOut, MAX_ELEMENTS, optional, SourceFailure, traceIdOf,
  whereText as whereOf,
} from './drawer.js';
import { layout, LAYOUT_LIMITS } from './layout.js';

// A table's box, sized for 12-pixel IBM Plex Mono, whose characters are 0.6 em wide: a header with its name, a row for
// each column with its name, its type and its key marks, and padding round them.
const CHARACTER = 7.2;
const PADDING = 12;
const HEADER = 32;
const ROW = 20;
const FOOTER = 8;
const MIN_WIDTH = 120;
const MAX_WIDTH = 480;
// The characters a column's row holds besides its name and type: the gap between them and up to three key marks.
const MARKS = 8;

const isColumn = (column) => isObject(column) && isName(column.name) && optional(column.type, isText)
  && optional(column.null, (value) => typeof value === 'boolean');
const isUnique = (rule) => isObject(rule) && isTextList(rule.columns) && optional(rule.partial, (value) => typeof value === 'boolean');
const isForeignKey = (key) => isObject(key) && isTextList(key.columns) && key.columns.length > 0 && isName(key.table)
  && optional(key.references, isTextList) && optional(key.on_delete, isText) && optional(key.where, isText);

// A table entry in the picture's form, with its optional members filled in, or null when it is not.
function readTable(entry) {
  if (!isObject(entry) || !isName(entry.name) || !optional(entry.id, isText) || !optional(entry.where, isText)) return null;
  if (!optional(entry.removed, (value) => typeof value === 'boolean')) return null;
  const { columns, primary_key: primaryKey = [], unique = [], foreign_keys: foreignKeys = [] } = entry;
  if (!Array.isArray(columns) || !columns.every(isColumn)) return null;
  if (!optional(primaryKey, isTextList)) return null;
  if (!optional(unique, (rules) => Array.isArray(rules) && rules.every(isUnique))) return null;
  if (!optional(foreignKeys, (keys) => Array.isArray(keys) && keys.every(isForeignKey))) return null;
  return {
    name: entry.name,
    removed: entry.removed === true,
    columns,
    primaryKey: primaryKey ?? [],
    unique: (unique ?? []).map((rule) => ({ columns: rule.columns, partial: rule.partial === true })),
    foreignKeys: foreignKeys ?? [],
  };
}

// A column as the drawing shows it: its name, its type, whether it takes null, and its keys.
function columnsOf(table) {
  const primary = new Set(table.primaryKey);
  const foreign = new Set(table.foreignKeys.flatMap((key) => key.columns));
  const unique = new Set(table.unique.filter((rule) => rule.columns.length === 1 && !rule.partial).map((rule) => rule.columns[0]));
  return table.columns.map(({ name, type, null: nullable }) => ({
    name,
    type: type ?? '',
    null: nullable ?? true,
    keys: [[primary, 'primary'], [foreign, 'foreign'], [unique, 'unique']].filter(([set]) => set.has(name)).map(([, mark]) => mark),
  }));
}

// A box's size for its name and the text of its rows, one row at least.
function sizeOf(name, rows) {
  const longest = rows.reduce((most, row) => Math.max(most, row), characters(name));
  return {
    width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.ceil(longest * CHARACTER) + 2 * PADDING)),
    height: Math.min(LAYOUT_LIMITS.size, HEADER + Math.max(1, rows.length) * ROW + FOOTER),
  };
}

// The drawer of the erd kind (see the top of this file).
export function erd(given) {
  const picture = JSON.parse(given.text);
  if (!isObject(picture) || picture.format !== 1 || !Array.isArray(picture.tables)) throw new SourceFailure();
  const keyOf = keyer();

  // The tables of the picture, those it cannot read included, each with its key. A table without a trace ID is keyed
  // by its name in lower case, as SQL names a table without case, so that a missing table keeps its key once the
  // schema creates it, however a foreign key spelled it.
  const tableKey = (traceId, name) => keyOf(elementKey({ trace_id: traceId, kind: 'table', name: name.toLowerCase() }));
  const tables = picture.tables.map((entry) => {
    const name = isObject(entry) && isText(entry.name) ? entry.name : '';
    const traceId = traceIdOf(entry);
    return { entry, read: readTable(entry), name, traceId, key: tableKey(traceId, name) };
  });
  const exact = new Map();
  const folded = new Map();
  for (const { name, key } of tables) {
    if (!isName(name)) continue;
    if (!exact.has(name)) exact.set(name, key);
    if (!folded.has(name.toLowerCase())) folded.set(name.toLowerCase(), key);
  }

  // Each foreign key of a table it read, to the table it names or to a missing table of that name.
  const missing = new Map();
  const targetOf = (name) => {
    const found = exact.get(name) ?? folded.get(name.toLowerCase());
    if (found !== undefined) return found;
    // Keyed as a table without a trace ID, so that the key does not hang on which foreign key comes first.
    if (!missing.has(name.toLowerCase())) missing.set(name.toLowerCase(), { name, key: tableKey(null, name) });
    return missing.get(name.toLowerCase()).key;
  };
  const lines = tables.flatMap(({ read, key: from }) => (read === null ? [] : read.foreignKeys.map((foreign) => ({
    foreign, from, to: targetOf(foreign.table),
  }))));
  for (const line of lines) {
    line.name = line.foreign.columns.join(', ');
    line.key = keyOf(elementKey({ kind: 'line', name: line.name, parent: line.from }));
  }
  if (tables.length + missing.size + lines.length > MAX_ELEMENTS) throw new SourceFailure();

  // The boxes: the tables of the picture, then the missing ones.
  const boxes = [
    ...tables.map(({ read, name, key, entry }) => {
      const rows = read === null
        ? [characters(whereOf(entry?.where) ?? '')]
        : read.columns.map((column) => characters(column.name) + characters(column.type ?? '') + MARKS);
      return { id: key, ...sizeOf(name, rows) };
    }),
    ...[...missing.values()].map(({ name, key }) => ({ id: key, ...sizeOf(name, []) })),
  ];
  let placed;
  try {
    // A line runs from the referenced table down to the table that holds the key, so referenced tables come first.
    placed = layout({ nodes: boxes, edges: lines.map(({ from, to }) => ({ from: to, to: from })) });
  } catch (error) {
    // The boxes and lines are in layout.js's form, so a RangeError can only be a graph too large to place in time.
    if (error instanceof RangeError) throw new SourceFailure();
    throw error;
  }
  const box = (index) => {
    const { x, y, width, height } = placed.nodes[index];
    return { x, y, width, height };
  };

  // The statements the hub left out. Their warnings are read only once the tables are placed, so that they join the
  // digest of no drawing that failed without them: a picture that fails before this fails again with the same digest,
  // and makes no new drawing, whatever the hub left out.
  const statements = leftOut(given.warnings, 'statement', keyOf);
  if (tables.length + missing.size + lines.length + statements.length > MAX_ELEMENTS) throw new SourceFailure();

  const elements = tables.map(({ entry, read, name, traceId, key }, index) => (read === null
    ? { key, trace_id: traceId, kind: 'table', name, status: 'unreadable', detail: { columns: [], where: whereOf(entry?.where), box: box(index) } }
    : {
      key,
      trace_id: traceId,
      kind: 'table',
      name,
      status: read.removed ? 'removed' : null,
      detail: {
        columns: columnsOf(read), primary_key: read.primaryKey, unique: read.unique, where: whereOf(entry.where), box: box(index),
      },
    }));
  [...missing.values()].forEach(({ name, key }, index) => {
    elements.push({ key, kind: 'table', name, status: 'missing', detail: { columns: [], box: box(tables.length + index) } });
  });
  lines.forEach(({ foreign, from, to, name, key }, index) => {
    elements.push({
      key,
      kind: 'line',
      name,
      parent: from,
      detail: {
        from,
        to,
        columns: foreign.columns,
        references: foreign.references ?? [],
        on_delete: foreign.on_delete ?? '',
        where: whereOf(foreign.where),
        points: placed.edges[index].points.map(({ x, y }) => ({ x, y })).reverse(),
      },
    });
  });
  for (const { name, where, key } of statements) {
    elements.push({ key, kind: 'statement', name, status: 'left_out', detail: { where } });
  }
  return { elements };
}
