// What the drawers share (TASK-419's drawer interface; the drawers of TASK-421 to TASK-427): the failure a drawer
// throws for a source it cannot read, the element keys, the contract's limits, the reading of a stage picture's
// entries and of what the hub left out of it, and the placing of boxes with their text; and the digest of a drawing
// kept for a source a push leaves out, which todo.js reads too. drawing.js runs the drawers
// and keeps what they draw, and imports each drawer; a drawer imports this file, never drawing.js, so that no two files
// import each other. Nothing here logs (rule 5).

import { createHash } from 'node:crypto';
import { layout } from './layout.js';

// The contract's limits: a drawing's elements, an element key, a trace ID and a failure's where; and a trace ID's form.
export const MAX_ELEMENTS = 5000;
export const MAX_KEY = 200;
export const MAX_TRACE_ID = 30;
export const MAX_WHERE = 300;
export const TRACE_ID = /^[A-Z][A-Z0-9]*-[0-9]{1,6}$/;
export const CONTROL = /[\u0000-\u001f\u007f]/;
// A derived key longer than the contract allows keeps its start and ends with # and 16 hex digits of its SHA-256.
const HASHED = 16;

export const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
export const isText = (value) => typeof value === 'string';
export const isName = (value) => isText(value) && value.trim() !== '';
export const isTextList = (value) => Array.isArray(value) && value.every(isText);
// An optional member of a picture: left out, null, or in its form.
export const optional = (value, check) => value === undefined || value === null || check(value);
export const characters = (text) => [...text].length;
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

// The source_digest of a drawing kept for a source a push leaves out (see drawing.js): the source's path as read and
// absent, which no drawing that read the source has. todo.js passes such a drawing over when it finds a file's part.
export const leftOutDigest = (sourceKey) => sha256(JSON.stringify([[sourceKey, null]]));

// What a drawer throws for a source it cannot read: where it failed, a path in the repository and a line, or neither
// for the document's own source. The drawing fails there, and the diagram keeps its last good drawing (SPEC-001).
export class SourceFailure extends Error {
  constructor({ path = null, line = null } = {}) {
    super('the source cannot be drawn');
    this.name = 'SourceFailure';
    this.path = path;
    this.line = line;
  }
}

// The key an element has when its drawer gives none: its trace ID, or else its kind and name, white space made single
// spaces, under its parent's key, such as "lane:Owner/event:Snapshot accepted". So an element keeps its key across
// drawings while it keeps its trace ID, or its kind, name and parent, wherever it stands among the others. A key over
// 200 characters keeps its start and ends with # and part of its SHA-256. A drawer that names an element's parent by
// such a key works it out here.
export function elementKey({ trace_id: traceId = null, kind, name = '', parent = null }) {
  if (traceId !== null) return traceId;
  const own = `${kind}:${name.replace(/\s+/g, ' ').trim()}`;
  const key = parent === null ? own : `${parent}/${own}`;
  if (characters(key) <= MAX_KEY) return key;
  return `${[...key].slice(0, MAX_KEY - HASHED - 1).join('').trimEnd()}#${sha256(key).slice(0, HASHED)}`;
}

// key with #n after it, within the contract's length.
export function numbered(key, n) {
  const suffix = `#${n}`;
  return characters(key) + suffix.length <= MAX_KEY ? `${key}${suffix}` : `${[...key].slice(0, MAX_KEY - suffix.length).join('').trimEnd()}${suffix}`;
}

// Hands out the element keys of one drawing: a key another element has gets #2, #3 and so on, as drawing.js does for
// the keys it works out.
export function keyer() {
  const taken = new Set();
  return (base) => {
    let key = base;
    for (let n = 2; taken.has(key); n += 1) key = numbered(base, n);
    taken.add(key);
    return key;
  };
}

// An entry's trace ID, or null when it has none in the contract's form.
export function traceIdOf(entry) {
  const id = isObject(entry) ? entry.id : undefined;
  return isText(id) && id.length <= MAX_TRACE_ID && TRACE_ID.test(id) ? id : null;
}

// A where of a picture, a file and its line such as db/nexus.sql:41, or null when it is not text NEXUS can show as one.
export function whereText(value) {
  return isText(value) && value !== '' && characters(value) <= MAX_WHERE && !CONTROL.test(value) ? value : null;
}

// A failure's where, as the push answer and a drawing's failed_at give it: the path and its line, or the path alone
// when the two would be too long.
export function failureWhere({ path, line }) {
  if (line === null) return path;
  const where = `${path}:${line}`;
  return characters(where) <= MAX_WHERE ? where : path;
}

// Text in a box, for 12-pixel IBM Plex Mono, whose characters are 0.6 em wide: a character's width and the padding at
// each side. The drawers work out a box's size from its text with these, for the page that draws it (TASK-458).
export const CHARACTER = 7.2;
export const PADDING = 12;

// Hangul, CJK and full-width forms, which take about two narrow characters' room.
const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꥠ-꥿가-힣豈-﫿︰-﹏＀-｠￠-￦\u{20000}-\u{3fffd}]/u;

// The narrow characters' room a text takes, a wide character counting twice.
export function columnsOf(text) {
  let columns = 0;
  for (const character of text) columns += WIDE.test(character) ? 2 : 1;
  return columns;
}

// The lines a text takes where a line holds perLine narrow characters: wrapped at spaces, a word longer than a line
// broken where it reaches its end; one line at least, as the page shows a placeholder in place of an empty text.
export function wrappedLines(text, perLine) {
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/).filter((part) => part !== '')) {
    const size = columnsOf(word);
    if (used > 0 && used + 1 + size <= perLine) {
      used += 1 + size;
      continue;
    }
    if (used > 0) lines += 1;
    lines += Math.ceil(size / perLine) - 1;
    used = size - (Math.ceil(size / perLine) - 1) * perLine;
  }
  return lines;
}

// Places a graph with layout.js (TASK-420). A drawer gives it boxes and lines in layout.js's form, so a RangeError can
// only be a graph too large to place in time, and the picture fails at its source.
export function placed(graph, options) {
  try {
    return layout(graph, options);
  } catch (error) {
    if (error instanceof RangeError) throw new SourceFailure();
    throw error;
  }
}

// What the hub left out of a picture, from the drawer's warnings (see drawing.js): for each, its key, of the given
// kind and named by what the hub says, and its where, the file and line as a failure's where, or null when the hub
// names no file.
export function leftOut(warnings, kind, keyOf) {
  return (warnings ?? []).map(({ path, line, detail }) => ({
    key: keyOf(elementKey({ kind, name: detail })),
    name: detail,
    where: path === null ? null : failureWhere({ path, line }),
  }));
}
