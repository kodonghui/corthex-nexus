// Shared by the tests: drawers made for the tests, one for each kind of diagram, that stand in for the drawing tasks'
// (TASK-421 to TASK-427) through src/drawing.js's interface. node --test also runs this file, which holds no test.
//
// - A stage's picture (01, 05 and 07), the hub's parsed picture as JSON: each entry of each of its lists, such as
//   contexts, tables or screens, is an element named by its name, with its ID as its trace ID. An entry with broken
//   true cannot be read: the drawing fails at its where, the file and line it names; one with broken 'source' fails at
//   the picture's source, with no line.
// - A file (03, 08 and 09): each heading is an element, with the trace ID it starts with, if any, and each CSS custom
//   property the file reads with var() a token. Its first heading names the diagram. A line that holds CANNOT_DRAW
//   fails the drawing at that line of the file.
// - A stage's items: each item is a row named by its title, with its ID as its trace ID.

import { SourceFailure } from '../src/drawing.js';

// What a line of a test file holds to fail its drawing there.
export const CANNOT_DRAW = '<<this line cannot be drawn>>';

const TRACE_ID = /^[A-Z][A-Z0-9]*-[0-9]{1,6}$/;
const HEADING = /^#{1,6} +(.+?) *$/;
const LEADING_ID = /^([A-Z][A-Z0-9]*-[0-9]{1,6}) +(.+)$/;
const TOKEN = /var\(\s*(--[A-Za-z0-9_-]+)/g;

// The file and line a picture entry's where names, such as db/nexus.sql:94.
export function placeOf(where) {
  const colon = where.lastIndexOf(':');
  return { path: where.slice(0, colon), line: Number(where.slice(colon + 1)) };
}

function picture({ text }) {
  const source = JSON.parse(text);
  const elements = [];
  for (const [list, entries] of Object.entries(source)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (entry.broken === true) throw new SourceFailure(placeOf(entry.where));
      if (entry.broken === 'source') throw new SourceFailure();
      elements.push({
        trace_id: TRACE_ID.test(entry.id) ? entry.id : null,
        kind: list.replace(/s$/, ''),
        name: entry.name,
        status: entry.removed ? 'removed' : null,
        detail: { where: entry.where },
      });
    }
  }
  return { elements };
}

function file({ text }) {
  const elements = [];
  let name;
  text.split('\n').forEach((line, index) => {
    if (line.includes(CANNOT_DRAW)) throw new SourceFailure({ line: index + 1 });
    const heading = HEADING.exec(line);
    if (heading === null) return;
    const id = LEADING_ID.exec(heading[1]);
    name ??= heading[1];
    elements.push(id === null ? { kind: 'heading', name: heading[1] } : { trace_id: id[1], kind: 'heading', name: id[2] });
  });
  const tokens = new Set([...text.matchAll(TOKEN)].map((match) => match[1]));
  for (const token of tokens) elements.push({ kind: 'token', name: token });
  return { name, elements };
}

function items({ text }) {
  return {
    elements: JSON.parse(text).map((item) => ({
      trace_id: TRACE_ID.test(item.id) ? item.id : null,
      kind: 'row',
      name: item.title ?? '',
      status: item.removed ? 'removed' : null,
    })),
  };
}

// A drawer for each kind, as a new object each time: the tests give it to the push with snapshotRoutes.
export function testDrawers() {
  return {
    ddd_board: picture,
    erd: picture,
    sitemap: picture,
    user_flow: file,
    screen_states: file,
    mockup: file,
    item_table: items,
  };
}
