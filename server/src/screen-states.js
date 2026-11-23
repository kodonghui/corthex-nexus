// The screen-states drawer (TASK-426; SPEC-008): draws a stage-08 screen definition as one panel for each state of its
// state table, with the state's name, its description and the responses that lead to it, the panels in a grid of three
// columns in the table's order. It is drawing.js's drawer of the screen_states kind and keeps to the drawer interface
// described there and in the server's README.
//
// Under corthex-hub/0.3 the pinned hub sends each screen definition of the stage as a picture of its own, with the
// file's path as its key and its whole text as source.text (its snapshot03.py); a translation beside its original is
// not sent. So one screen file is one diagram, and this file reads the file's Markdown itself, with no package.
//
// What it reads:
// - The state table: the first Markdown table of the file, outside a fenced code block and a front-matter block, any of
//   whose rows starts with a state ID, such as SCR-142#normal: a trace ID, #, and a state of a lowercase letter and up
//   to 30 lowercase letters, digits, hyphens and underscores, as the hub reads states. It is the stage-08 template's
//   table of three columns: the state, what the user sees and can do, and the responses that lead to it. A table is a
//   line that starts with |, a separator line under it, and the lines that start with | after them; a cell ends at a |
//   that no backslash escapes.
// - The diagram's name: the file's first heading of level 1, as written, such as "SCR-142 Owner to-do"; with none,
//   the diagram keeps drawing.js's name, the file's name.
//
// It draws each row of the state table, in the table's order, as a panel: kind state, its key and name the state as
// written (SCR-142#normal is no trace ID, so it has none), and detail { description, responses, where, box }:
// - description: the second cell as written, Markdown kept and only \| unescaped. A cell that is empty, white space
//   or "-" alone is no description: the panel is empty, with description '', and marked with status no_description
//   (SPEC-008);
// - responses: the third cell split at the commas outside brackets, each as written, such as "API-275#409
//   (not-drawn)"; a cell that is empty, white space or "-" alone has none, [];
// - where: the file and the row's line, such as docs/08-screens/SCR-142.md:30;
// - box: { x, y, width, height }, its top left corner and its size, in a grid of three columns: the panels fill each
//   row left to right in the table's order, 328 pixels wide with 12-pixel gaps, as the stage-09 mockup's panels stand
//   at 1440 pixels. A panel is at least 168 pixels high and as high as its text needs (see heightOf); a row is as high
//   as its tallest panel, and each panel of the row is that high. The page shows one column on a phone (TASK-458).
// A state that the table names twice keeps its key the first time and gets #2, #3 and so on after.
//
// A file whose state table cannot be read fails the drawing (SourceFailure), so the diagram keeps its last good
// drawing and shows where it failed (SPEC-001):
// - a file with no state table fails at the file, with no line;
// - a line of the state table whose cells are not three, the header and the separator included, or a row whose first
//   cell is not a state ID, fails at that line;
// - a table of more states than a drawing holds elements fails at the file.
// A screen file has no picture-partial checks, so the drawer reads no warnings. Nothing here logs (rule 5).

import { failureWhere, keyer, MAX_ELEMENTS, SourceFailure } from './drawer.js';
import { LAYOUT_LIMITS } from './layout.js';

// The grid, as the stage-09 mockup draws the panels of stage 08 at 1440 pixels: three columns of a 1008-pixel board
// column with 12-pixel gaps, each panel at least 168 pixels high, with 12 pixels of padding above and below its text,
// 16 at its sides, and 8 between its name, its description and its responses.
const COLUMNS = 3;
const WIDTH = 328;
const GAP = 12;
const MIN_HEIGHT = 168;
const PADDING_Y = 12;
const PADDING_X = 16;
const SPACE = 8;
// Text is estimated for 12-pixel type: 7.2 pixels a character, 20-pixel lines, a wide character such as Hangul twice
// as wide. So a line of the panel holds 41 narrow characters.
const CHARACTER = 7.2;
const LINE = 20;
const PER_LINE = Math.floor((WIDTH - 2 * PADDING_X) / CHARACTER);

const NEWLINE = /\r\n|\r|\n/;
const FENCE = /^\s*(?:`{3,}|~{3,})/;
const FRONT_MATTER = /^---\s*$/;
const FRONT_MATTER_END = /^(?:---|\.\.\.)\s*$/;
const HEADING = /^#\s+(.*?)(?:\s+#+)?\s*$/;
const TABLE_LINE = /^\s*\|/;
const SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const CELL = /(?<!\\)\|/;
// A state ID: a trace ID of the contract's form, #, and a state as the hub reads one (its STATE).
const STATE_ID = /^[A-Z][A-Z0-9]*-[0-9]{1,6}#[a-z][a-z0-9_-]{0,30}$/;
const NONE = /^(?:-|)$/;
// Hangul, CJK and full-width forms, which take about two narrow characters' room.
const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꥠ-꥿가-힣豈-﫿︰-﹏＀-｠￠-￦\u{20000}-\u{3fffd}]/u;

// The cells of a table line, as the hub reads them: the line without its outer |, split at each | that no backslash
// escapes, each cell trimmed.
function cellsOf(line) {
  let text = line.trim();
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|') && !text.endsWith('\\|')) text = text.slice(0, -1);
  return text.split(CELL).map((cell) => cell.trim());
}

const unescaped = (cell) => cell.replaceAll('\\|', '|');

// The responses of a cell: split at the commas outside brackets, each as written, none for an empty cell or "-".
function responsesOf(cell) {
  const text = unescaped(cell).trim();
  if (NONE.test(text)) return [];
  const responses = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '(' || character === '[') depth += 1;
    else if ((character === ')' || character === ']') && depth > 0) depth -= 1;
    else if (character === ',' && depth === 0) {
      responses.push(text.slice(start, index));
      start = index + 1;
    }
  }
  responses.push(text.slice(start));
  return responses.map((response) => response.trim()).filter((response) => response !== '');
}

// The narrow characters' room a text takes, a wide character counting twice.
function columnsOf(text) {
  let columns = 0;
  for (const character of text) columns += WIDE.test(character) ? 2 : 1;
  return columns;
}

// The lines a text takes in a panel, wrapped at spaces, a word longer than a line broken where it reaches its end; one
// line at least, as the page shows "No description" or "-" in place of an empty one.
function linesOf(text) {
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/).filter((part) => part !== '')) {
    const size = columnsOf(word);
    if (used > 0 && used + 1 + size <= PER_LINE) {
      used += 1 + size;
      continue;
    }
    if (used > 0) lines += 1;
    lines += Math.ceil(size / PER_LINE) - 1;
    used = size - (Math.ceil(size / PER_LINE) - 1) * PER_LINE;
  }
  return lines;
}

// A panel's height for its name, its description and its responses as the page shows them, the responses joined by
// commas: at least 168 pixels, and at most the largest box layout.js takes.
function heightOf(name, description, responses) {
  const lines = linesOf(name) + linesOf(description) + linesOf(responses.join(', '));
  return Math.min(LAYOUT_LIMITS.size, Math.max(MIN_HEIGHT, 2 * PADDING_Y + 2 * SPACE + lines * LINE));
}

// The lines of the file with their numbers, from 1, outside a front-matter block at its start and fenced code blocks.
function bodyOf(text) {
  const lines = text.split(NEWLINE);
  let start = 0;
  if (lines.length > 0 && FRONT_MATTER.test(lines[0])) {
    const end = lines.findIndex((line, index) => index > 0 && FRONT_MATTER_END.test(line));
    if (end > 0) start = end + 1;
  }
  const body = [];
  let fenced = false;
  for (let index = start; index < lines.length; index += 1) {
    if (FENCE.test(lines[index])) {
      fenced = !fenced;
      continue;
    }
    if (!fenced) body.push({ number: index + 1, line: lines[index] });
  }
  return body;
}

// The tables of the file's body, each { header, rows }: its header line and the lines after its separator, each
// { number, line }. A table line that is no table's, such as one with no separator under it, is passed over.
function tablesOf(body) {
  const tables = [];
  for (let index = 0; index < body.length; index += 1) {
    const { line } = body[index];
    const next = body[index + 1];
    if (!TABLE_LINE.test(line) || next === undefined || next.number !== body[index].number + 1 || !SEPARATOR.test(next.line)) continue;
    const table = { header: body[index], separator: next, rows: [] };
    index += 2;
    while (index < body.length && TABLE_LINE.test(body[index].line) && body[index].number === body[index - 1].number + 1) {
      table.rows.push(body[index]);
      index += 1;
    }
    index -= 1;
    tables.push(table);
  }
  return tables;
}

// The rows of the state table, each { number, cells }, or a SourceFailure where it cannot be read.
function stateRows(body) {
  const table = tablesOf(body).find(({ rows }) => rows.some(({ line }) => STATE_ID.test(cellsOf(line)[0])));
  if (table === undefined) throw new SourceFailure();
  for (const { number, line } of [table.header, table.separator]) {
    if (cellsOf(line).length !== 3) throw new SourceFailure({ line: number });
  }
  return table.rows.map(({ number, line }) => {
    const cells = cellsOf(line);
    if (cells.length !== 3 || !STATE_ID.test(cells[0])) throw new SourceFailure({ line: number });
    return { number, cells };
  });
}

// The file's first heading of level 1, or null.
function nameOf(body) {
  for (const { line } of body) {
    const heading = HEADING.exec(line);
    if (heading !== null && heading[1].trim() !== '') return heading[1].trim();
  }
  return null;
}

// The drawer of the screen_states kind (see the top of this file).
export function screenStates(given) {
  const { source } = given;
  const body = bodyOf(given.text);
  const rows = stateRows(body);
  if (rows.length > MAX_ELEMENTS) throw new SourceFailure();
  const keyOf = keyer();

  const panels = rows.map(({ number, cells: [state, cell, responseCell] }) => {
    const text = unescaped(cell).trim();
    const described = !NONE.test(text);
    const description = described ? text : '';
    const responses = responsesOf(responseCell);
    return {
      key: keyOf(state),
      name: state,
      described,
      description,
      responses,
      where: failureWhere({ path: source, line: number }),
      height: heightOf(state, description, responses),
    };
  });

  // The grid: three panels to a row in the table's order, each row as high as its tallest panel.
  let y = 0;
  for (let start = 0; start < panels.length; start += COLUMNS) {
    const row = panels.slice(start, start + COLUMNS);
    const height = Math.max(...row.map((panel) => panel.height));
    row.forEach((panel, column) => {
      panel.box = { x: column * (WIDTH + GAP), y, width: WIDTH, height };
    });
    y += height + GAP;
  }

  const elements = panels.map(({ key, name, described, description, responses, where, box }) => ({
    key,
    kind: 'state',
    name,
    status: described ? null : 'no_description',
    detail: { description, responses, where, box },
  }));
  const name = nameOf(body);
  return name === null ? { elements } : { name, elements };
}
