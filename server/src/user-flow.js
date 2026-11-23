// The user-flow drawer (TASK-424; SPEC-006): draws a flow file's Mermaid flowchart as one diagram of its boxes,
// decisions and labelled arrows, placed by the picture layout (layout.js, TASK-420). It is drawing.js's drawer of the
// user_flow kind and keeps to the drawer interface described there and in the server's README.
//
// The source is the file's whole text, as the pinned hub's corthex-hub/0.3 snapshot sends each flow file of stage 03
// (its snapshot03.py), and NEXUS parses it here, with no package. The file holds one Mermaid flowchart: a fenced block
// whose info string is mermaid and whose first statement is flowchart or graph. Other mermaid blocks are skipped. The
// diagram is named by the file's first heading, such as "FL-001 Put a project on NEXUS"; with none, by the file's name,
// such as "FL-001-put-a-project-on-nexus.md", as drawing.js names it until its drawer does. drawing.js keeps a
// diagram's last name when its drawer gives none, so a heading taken out would otherwise leave its old name.
//
// The flowchart is read in the subset that this repository's flows and the corthex-diagram grammar use; the server's
// README lists it. Anything outside it fails the drawing at its line of the file (SourceFailure), so the page shows the
// source text with that line marked (SPEC-006, SCR-145#not-drawn); a file with no flowchart fails with no line, and a
// second flowchart fails at its first line.
//
// It draws, in this order:
// - each lane, a subgraph other than the legend, in its order: kind lane, named by its title, its parent the lane it
//   stands in, and detail { id, where }. A lane has no box: layout.js keeps no lane together yet. A box is in the first
//   lane to close that names it, as in Mermaid, so an inner lane before the lane round it.
// - each box, in the order the flowchart first names it: its kind from its shape (terminal, step, decision, document,
//   store, llm, or grading for a step of class grade), named by its label without the lines that hold only trace IDs,
//   its parent its lane, and detail { id, lines, ids, marks, lane, where, box }: id the node's ID, which is its key;
//   lines the label's lines as the author broke them, those IDs left out; ids those trace IDs; marks key and gap from its
//   classes; lane its lane's key or null;
// - each arrow, in its order: kind arrow, named by its label, its parent the box it leaves, and detail { id, from, to,
//   label, line, where, points, label_box }: id its edge ID or null; from and to the keys of its boxes; line pass for
//   -->, grade for -.->, and write, read or thick for ==> by its class; points the line layout.js gives it, and
//   label_box its label's box or null. Its key is from->to, with #2 for a second arrow between the same two boxes.
// The legend subgraph, titled Legend or 범례, is left out with its boxes and the links that touch them, since the page
// shows its own legend; a ~~~ link elsewhere places its boxes and draws no arrow. where is the file and line that
// defines the element, such as docs/03-user-flow/FL-001-put-a-project-on-nexus.md:12. A box's size is worked out
// from its text and shape, for the page that draws it (TASK-458).
//
// A flowchart with more elements than a drawing holds, or too large for layout.js to place, fails at its source.
// Nothing here logs (rule 5).

import {
  CHARACTER, characters, columnsOf, failureWhere, keyer, MAX_ELEMENTS, PADDING, placed, SourceFailure, TRACE_ID, wrappedLines,
} from './drawer.js';

// A box's text: 20-pixel lines with drawer.js's padding round them, a wide character such as Hangul twice as wide as
// another. A line wider than MAX_TEXT_WIDTH, PER_LINE narrow characters, is wrapped by the page at its spaces, so the box
// is no wider and is as tall as the lines it wraps to; so is an arrow's label.
const LINE = 20;
const MIN_WIDTH = 80;
const MAX_TEXT_WIDTH = 480;
const PER_LINE = Math.floor(MAX_TEXT_WIDTH / CHARACTER);
// Room a shape takes beyond its text: a store's top and bottom curves, a document's wavy foot, an LLM box's inner
// frame. A terminal's round ends and a decision's corners are worked out in sizeOf.
const STORE_CAPS = 16;
const DOCUMENT_FOOT = 8;
const LLM_FRAME = 16;
// An arrow's label: one 20-pixel line with 4 pixels at each side.
const LABEL_PADDING = 4;
// A node, edge or subgraph ID, so that every key stays within the contract.
const MAX_ID = 64;

// The box shapes of the grammar, by the names of Mermaid's @{ shape: … } and their aliases, and the kind each draws.
const SHAPES = new Map(Object.entries({
  stadium: 'terminal', pill: 'terminal', terminal: 'terminal',
  rect: 'step', rectangle: 'step', proc: 'step', process: 'step',
  diam: 'decision', diamond: 'decision', decision: 'decision', question: 'decision',
  doc: 'document', document: 'document',
  cyl: 'store', cylinder: 'store', database: 'store', db: 'store',
  'fr-rect': 'llm', 'framed-rectangle': 'llm', subproc: 'llm', subprocess: 'llm', subroutine: 'llm',
}));
// The bracket forms of those shapes, longest opening first: [open, close, kind].
const BRACKETS = [['([', '])', 'terminal'], ['[(', ')]', 'store'], ['[[', ']]', 'llm'], ['[', ']', 'step'], ['{', '}', 'decision']];
// Openings of Mermaid shapes outside the subset, checked before BRACKETS.
const REFUSED_OPENINGS = ['{{', '[/', '[\\', '(', '>'];
const MARKS = ['key', 'gap'];
const LEGEND = new Set(['legend', '범례']);
const DIRECTIONS = new Map([['TD', 'TB'], ['TB', 'TB'], ['LR', 'LR']]);

const ID = /[A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*/y;
const CLASS_NAME = /[A-Za-z_][A-Za-z0-9_-]*/y;
const KEY_WORD = /[A-Za-z][A-Za-z-]*/y;
const BARE_VALUE = /[^\s,}"]+/y;
const BREAK = /<br\s*\/?>/i;
const KEYWORD = /(?:classDef|class|style|linkStyle|subgraph|end|direction|click)(?=\s|;|$)/y;
const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const CLOSING_FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

const fail = (line) => {
  throw new SourceFailure({ line });
};

// A label's text as lines: split at <br>, each trimmed with its white space made single spaces, empty ones dropped.
const linesOf = (text) => text.split(BREAK).map((line) => line.replace(/\s+/g, ' ').trim()).filter((line) => line !== '');

// Whether a line holds only trace IDs, separated by commas, and which.
function idsOf(line) {
  const ids = line.split(',').map((part) => part.trim());
  if (ids.at(-1) === '') ids.pop();
  return ids.length > 0 && ids.every((id) => TRACE_ID.test(id)) ? ids : null;
}

// One statement line of the flowchart, read from its start: the parser's place in it and its file line.
class Scanner {
  constructor(text, line) {
    this.text = text;
    this.line = line;
    this.at = 0;
  }

  done() {
    return this.at >= this.text.length;
  }

  peek(length = 1) {
    return this.text.slice(this.at, this.at + length);
  }

  startsWith(prefix) {
    return this.text.startsWith(prefix, this.at);
  }

  spaces() {
    while (this.text[this.at] === ' ' || this.text[this.at] === '\t') this.at += 1;
  }

  // The match of a sticky pattern here, consumed, or null.
  take(pattern) {
    pattern.lastIndex = this.at;
    const found = pattern.exec(this.text);
    if (found === null) return null;
    this.at = pattern.lastIndex;
    return found[0];
  }

  expect(prefix) {
    if (!this.startsWith(prefix)) fail(this.line);
    this.at += prefix.length;
  }

  // A quoted text: "…" with no quote inside; a Markdown string ("`…`") is outside the subset.
  quoted() {
    this.expect('"');
    const end = this.text.indexOf('"', this.at);
    if (end < 0) fail(this.line);
    const text = this.text.slice(this.at, end);
    if (text.startsWith('`')) fail(this.line);
    this.at = end + 1;
    return text;
  }

  // A label up to close: quoted, or the bare text before close with no quote in it.
  labelBefore(close) {
    this.spaces();
    if (this.peek() === '"') {
      const text = this.quoted();
      this.spaces();
      this.expect(close);
      return text;
    }
    const end = this.text.indexOf(close, this.at);
    if (end < 0) fail(this.line);
    const text = this.text.slice(this.at, end);
    if (text.includes('"')) fail(this.line);
    this.at = end + close.length;
    return text;
  }

  // The rest of the statement, up to the semicolon that ends it or the end of the line, trimmed.
  rest() {
    const end = this.text.indexOf(';', this.at);
    const stop = end < 0 ? this.text.length : end;
    const text = this.text.slice(this.at, stop).trim();
    this.at = stop;
    return text;
  }
}

// The flowchart of a flow file and the file's first heading: { heading, lines }, lines the flowchart's lines as
// { text, number } from its first statement on, or a SourceFailure (see the top of this file).
function findFlowchart(text) {
  let heading = null;
  let fence = null;
  const blocks = [];
  text.split('\n').forEach((raw, index) => {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (fence !== null) {
      const close = CLOSING_FENCE.exec(line);
      if (close !== null && close[1][0] === fence.marker[0] && close[1].length >= fence.marker.length) {
        if (fence.mermaid) blocks.push(fence.lines);
        fence = null;
      } else {
        fence.lines.push({ text: line, number: index + 1 });
      }
      return;
    }
    const open = FENCE.exec(line);
    if (open !== null && !(open[1][0] === '`' && open[2].includes('`'))) {
      fence = { marker: open[1], mermaid: open[2].trim().split(/\s/)[0].toLowerCase() === 'mermaid', lines: [] };
      return;
    }
    heading ??= headingOf(line);
  });
  if (fence?.mermaid) blocks.push(fence.lines);
  const flowcharts = blocks.map(statementsOf).filter((lines) => lines !== null);
  if (flowcharts.length === 0) throw new SourceFailure();
  if (flowcharts.length > 1) fail(flowcharts[1][0].number);
  return { heading, lines: flowcharts[0] };
}

// An ATX heading's text, or null.
function headingOf(line) {
  const found = /^ {0,3}#{1,6}(?=[ \t]|$)/.exec(line);
  if (found === null) return null;
  let text = line.slice(found[0].length).trim();
  const closing = /[ \t]#+$/.exec(text);
  if (closing !== null) text = text.slice(0, closing.index).trim();
  else if (/^#+$/.test(text)) text = '';
  return text === '' ? null : text;
}

// A mermaid block's lines from its first statement on, when it is a flowchart, or null: blank lines, %% comments and
// front matter before it are skipped. Front matter that does not close fails at its first line.
function statementsOf(lines) {
  let index = 0;
  const blank = (line) => line.text.trim() === '' || line.text.trim().startsWith('%%');
  while (index < lines.length && blank(lines[index])) index += 1;
  if (index < lines.length && lines[index].text.trim() === '---') {
    const start = lines[index].number;
    index += 1;
    while (index < lines.length && lines[index].text.trim() !== '---') index += 1;
    if (index >= lines.length) fail(start);
    index += 1;
    while (index < lines.length && blank(lines[index])) index += 1;
  }
  // A variant such as flowchart-elk is a flowchart too, which fails at its first line.
  if (index >= lines.length || !/^(flowchart|graph)(?=\s|;|-|$)/.test(lines[index].text.trim())) return null;
  return lines.slice(index);
}

// The flowchart read: { direction, nodes, edges, lanes }, each node { id, kind, label, classes, lane, legend, line },
// each edge { id, from, to, form, label, line, classes }, each lane { id, title, parent, line, legend }.
function parse(lines) {
  const [header, ...rest] = lines;
  const { direction, after } = directionOf(header);
  const statements = after === null ? rest : [after, ...rest];
  const nodes = new Map();
  const edges = [];
  const edgeIds = new Map();
  const subgraphs = new Map();
  const stack = [];
  const classed = [];
  const taken = (id) => nodes.has(id) || edgeIds.has(id) || subgraphs.has(id);

  // A node named in a statement. A shape gives its kind and label, the last one winning as in Mermaid; a node named only
  // by its ID is a step labelled by it. The lane it is named in notes it, for its lane (see closeLane).
  const nameNode = (id, line, shape) => {
    let node = nodes.get(id);
    if (node === undefined) {
      if (edgeIds.has(id) || subgraphs.has(id)) fail(line);
      node = { id, kind: 'step', label: id, classes: [], lane: null, legend: false, line };
      nodes.set(id, node);
    }
    stack.at(-1)?.named.push(id);
    if (shape !== null) Object.assign(node, { kind: shape.kind, label: shape.label ?? node.label, line });
    return node;
  };

  // A lane that closes takes the nodes named in it that no lane has taken, as Mermaid's subgraphs take their nodes when
  // they close: so a node is in the first lane to close that names it, an inner lane before the lane round it, and a
  // node named outside every lane is in none.
  const closeLane = () => {
    const lane = stack.pop();
    for (const id of lane.named) {
      const node = nodes.get(id);
      if (node.lane === null) Object.assign(node, { lane: lane.id, legend: lane.legend });
    }
    lane.named = null;
  };

  // @{ shape: …, label: "…" } on one line: shape is one of SHAPES, label is optional.
  const shapeObject = (scanner) => {
    const { line } = scanner;
    scanner.at += 2;
    const given = new Map();
    for (;;) {
      scanner.spaces();
      const key = scanner.take(KEY_WORD);
      if (key === null || given.has(key) || (key !== 'shape' && key !== 'label')) fail(line);
      scanner.spaces();
      scanner.expect(':');
      scanner.spaces();
      const value = scanner.peek() === '"' ? scanner.quoted() : scanner.take(BARE_VALUE);
      if (value === null) fail(line);
      given.set(key, value);
      scanner.spaces();
      if (scanner.peek() === '}') break;
      scanner.expect(',');
    }
    scanner.at += 1;
    const kind = SHAPES.get(given.get('shape'));
    if (kind === undefined) fail(line);
    return { kind, label: given.get('label') ?? null };
  };

  // A node with its shape and class, when the statement gives them.
  const nodeRef = (scanner) => {
    const { line } = scanner;
    const id = scanner.take(ID);
    if (id === null || id === 'end' || characters(id) > MAX_ID) fail(line);
    let shape = null;
    if (scanner.startsWith('@{')) {
      shape = shapeObject(scanner);
    } else {
      if (REFUSED_OPENINGS.some((opening) => scanner.startsWith(opening)) && !scanner.startsWith('([')) fail(line);
      const bracket = BRACKETS.find(([open]) => scanner.startsWith(open));
      if (bracket !== undefined) {
        const [open, close, kind] = bracket;
        scanner.at += open.length;
        shape = { kind, label: scanner.labelBefore(close) };
      }
    }
    const node = nameNode(id, line, shape);
    if (scanner.startsWith(':::')) {
      scanner.at += 3;
      const className = scanner.take(CLASS_NAME);
      if (className === null) fail(line);
      classed.push({ ids: [id], className });
    }
    return node;
  };

  // A link between two nodes: { id, form, label }, form pass, thick, dotted or invisible.
  const linkOf = (scanner) => {
    const { line } = scanner;
    let id = null;
    const start = scanner.at;
    const named = scanner.take(ID);
    const next = scanner.text[scanner.at + 1];
    if (named !== null && scanner.peek() === '@' && next !== undefined && '-=~'.includes(next)) {
      if (characters(named) > MAX_ID) fail(line);
      id = named;
      scanner.at += 1;
    } else {
      scanner.at = start;
    }
    const arrow = arrowOf(scanner);
    if (arrow === null) fail(line);
    let { label } = arrow;
    scanner.spaces();
    if (scanner.peek() === '|') {
      if (label !== null || arrow.form === 'invisible') fail(line);
      scanner.at += 1;
      label = scanner.labelBefore('|');
    }
    return { id, form: arrow.form, label: label === null ? '' : linesOf(label).join(' ') };
  };

  // A chain of nodes and links: A, or A --> B, or A --> B -->|label| C.
  const chain = (scanner) => {
    let from = nodeRef(scanner);
    for (;;) {
      const before = scanner.at;
      scanner.spaces();
      if (scanner.done() || scanner.peek() === ';') return;
      // A link follows a node after a space, or at once when it starts with its arrow.
      if (scanner.at === before && !'-=~'.includes(scanner.peek())) fail(scanner.line);
      const link = linkOf(scanner);
      scanner.spaces();
      const to = nodeRef(scanner);
      if (link.id !== null && taken(link.id)) fail(scanner.line);
      const edge = { ...link, from: from.id, to: to.id, line: scanner.line, classes: [] };
      if (link.id !== null) edgeIds.set(link.id, edge);
      edges.push(edge);
      from = to;
    }
  };

  // subgraph ID, or subgraph ID["title"]: a lane, or the legend when titled Legend or 범례, inside the legend or not.
  const subgraph = (scanner) => {
    const { line } = scanner;
    if (scanner.peek() !== ' ' && scanner.peek() !== '\t') fail(line);
    scanner.spaces();
    const id = scanner.take(ID);
    if (id === null || id === 'end' || characters(id) > MAX_ID || taken(id)) fail(line);
    let title = id;
    if (scanner.peek() === '[') {
      scanner.at += 1;
      title = linesOf(scanner.labelBefore(']')).join(' ');
    }
    const parent = stack.at(-1) ?? null;
    const lane = { id, title, parent: parent?.id ?? null, line, legend: parent?.legend === true || LEGEND.has(title.toLowerCase()), named: [] };
    subgraphs.set(id, lane);
    stack.push(lane);
  };

  // class A,B name: the IDs of nodes or edges, applied once every statement is read.
  const classStatement = (scanner) => {
    const ids = [];
    do {
      if (ids.length > 0) scanner.at += 1;
      const id = scanner.take(ID);
      if (id === null) fail(scanner.line);
      ids.push(id);
    } while (scanner.peek() === ',');
    if (scanner.peek() !== ' ' && scanner.peek() !== '\t') fail(scanner.line);
    scanner.spaces();
    const className = scanner.take(CLASS_NAME);
    if (className === null) fail(scanner.line);
    classed.push({ ids, className });
  };

  const keywordStatement = (keyword, scanner) => {
    const { line } = scanner;
    if (keyword === 'end') {
      if (stack.length === 0) fail(line);
      closeLane();
    } else if (keyword === 'subgraph') {
      subgraph(scanner);
    } else if (keyword === 'direction') {
      // Skipped inside a lane, where Mermaid turns the lane's own boxes; refused outside one.
      if (stack.length === 0 || !/^(TB|TD|BT|LR|RL)$/.test(scanner.rest())) fail(line);
    } else if (keyword === 'style' || keyword === 'linkStyle') {
      // Read and not drawn: NEXUS draws with its own tokens.
      if (scanner.rest() === '') fail(line);
    } else if (keyword === 'classDef') {
      scanner.spaces();
      do {
        if (scanner.peek() === ',') scanner.at += 1;
        if (scanner.take(CLASS_NAME) === null) fail(line);
      } while (scanner.peek() === ',');
      if (scanner.peek() !== ' ' && scanner.peek() !== '\t') fail(line);
      if (scanner.rest() === '') fail(line);
    } else if (keyword === 'class') {
      scanner.spaces();
      classStatement(scanner);
    } else {
      fail(line);
    }
  };

  for (const { text, number } of statements) {
    const trimmed = text.trim();
    if (trimmed === '' || trimmed.startsWith('%%')) continue;
    const scanner = new Scanner(trimmed, number);
    for (;;) {
      scanner.spaces();
      if (scanner.done()) break;
      const keyword = scanner.take(KEYWORD);
      if (keyword === null) chain(scanner);
      else keywordStatement(keyword, scanner);
      scanner.spaces();
      if (scanner.done()) break;
      scanner.expect(';');
    }
  }
  if (stack.length > 0) fail(stack.at(-1).line);

  for (const { ids, className } of classed) {
    for (const id of ids) {
      const target = nodes.get(id) ?? edgeIds.get(id);
      if (target !== undefined) target.classes.push(className);
    }
  }
  const lanes = [...subgraphs.values()].filter((lane) => !lane.legend);
  return { direction, nodes: [...nodes.values()], edges, lanes };
}

// The flowchart's first statement: { direction, after }. Its direction is TD and TB top to bottom, LR left to right,
// top to bottom when it names none; BT and RL, and anything else, are outside the subset. after is what follows its
// semicolon on its line, read as statements, or null.
function directionOf({ text, number }) {
  const scanner = new Scanner(text.trim(), number);
  scanner.take(/flowchart|graph/y);
  const rest = scanner.rest();
  const direction = rest === '' ? 'TB' : DIRECTIONS.get(rest);
  if (direction === undefined) fail(number);
  return { direction, after: scanner.done() ? null : { text: scanner.text.slice(scanner.at + 1), number } };
}

// The arrow at the scanner, consumed: { form, label }, with the label of the text forms (-- text -->, == text ==>,
// -. text .->), or null when there is none in the subset there.
function arrowOf(scanner) {
  const { text } = scanner;
  const at = scanner.at;
  const run = (char, from) => {
    let end = from;
    while (text[end] === char) end += 1;
    return end;
  };
  if (text[at] === '~') {
    const end = run('~', at);
    if (end - at < 3) return null;
    scanner.at = end;
    return { form: 'invisible', label: null };
  }
  if (text[at] === '=') {
    const end = run('=', at);
    if (end - at >= 2 && text[end] === '>') {
      scanner.at = end + 1;
      return { form: 'thick', label: null };
    }
    if (end - at === 2 && (text[end] === ' ' || text[end] === '\t')) return textArrow(scanner, end, '=', 'thick');
    return null;
  }
  if (text[at] !== '-') return null;
  if (text[at + 1] === '.') {
    const dots = run('.', at + 1);
    if (text[dots] === '-' && text[dots + 1] === '>') {
      scanner.at = dots + 2;
      return { form: 'dotted', label: null };
    }
    if (dots === at + 2 && (text[dots] === ' ' || text[dots] === '\t')) return dottedTextArrow(scanner, dots);
    return null;
  }
  const end = run('-', at);
  if (end - at >= 2 && text[end] === '>') {
    scanner.at = end + 1;
    return { form: 'pass', label: null };
  }
  if (end - at === 2 && (text[end] === ' ' || text[end] === '\t')) return textArrow(scanner, end, '-', 'pass');
  return null;
}

// -- text --> or == text ==>: the text up to the first run of two or more of char that ends in >.
function textArrow(scanner, from, char, form) {
  const { text } = scanner;
  for (let at = from; at < text.length; at += 1) {
    if (text[at] !== '>' || text[at - 1] !== char || text[at - 2] !== char || at - 2 < from) continue;
    let start = at - 1;
    while (start > from && text[start - 1] === char) start -= 1;
    const label = unquote(text.slice(from, start).trim(), scanner.line);
    if (label === '') return null;
    scanner.at = at + 1;
    return { form, label };
  }
  return null;
}

// -. text .->: the text up to the first . followed by dashes and >.
function dottedTextArrow(scanner, from) {
  const { text } = scanner;
  for (let at = from; at < text.length; at += 1) {
    if (text[at] !== '.' || text[at + 1] !== '-') continue;
    let end = at + 1;
    while (text[end] === '-') end += 1;
    if (text[end] !== '>') {
      at = end - 1;
      continue;
    }
    const label = unquote(text.slice(from, at).trim(), scanner.line);
    if (label === '') return null;
    scanner.at = end + 1;
    return { form: 'dotted', label };
  }
  return null;
}

// A link's text form, without its quotes when it is quoted.
function unquote(text, line) {
  if (!text.startsWith('"')) {
    if (text.includes('"')) fail(line);
    return text;
  }
  if (text.length < 2 || !text.endsWith('"') || text.slice(1, -1).includes('"') || text[1] === '`') fail(line);
  return text.slice(1, -1);
}

// A line of text on the page: its width, up to MAX_TEXT_WIDTH, and the lines it takes there when the page wraps it.
const textWidthOf = (text) => Math.min(MAX_TEXT_WIDTH, Math.ceil(columnsOf(text) * CHARACTER));
const rowsOf = (text) => wrappedLines(text, PER_LINE);

// A box's size for its kind and text (see the top of this file): its lines and the line of its IDs.
function sizeOf(kind, lines, ids) {
  const texts = ids.length > 0 ? [...lines, ids.join(', ')] : lines;
  let widest = 0;
  let rows = 0;
  for (const text of texts) {
    widest = Math.max(widest, textWidthOf(text));
    rows += rowsOf(text);
  }
  const textWidth = widest + 2 * PADDING;
  const textHeight = Math.max(1, rows) * LINE + 2 * PADDING;
  const width = Math.max(MIN_WIDTH, textWidth);
  switch (kind) {
    case 'terminal':
      return { width: width + Math.ceil(textHeight / 2), height: textHeight };
    case 'decision':
      // A diamond round the text's box: as wide as it and twice its height, as tall as it and half its width.
      return { width: width + 2 * textHeight, height: textHeight + Math.ceil(width / 2) };
    case 'store':
      return { width, height: textHeight + STORE_CAPS };
    case 'document':
      return { width, height: textHeight + DOCUMENT_FOOT };
    case 'llm':
      return { width: width + LLM_FRAME, height: textHeight };
    default:
      return { width, height: textHeight };
  }
}

// The kind of line an edge is: pass, grade, or for a thick one write or read by its last such class, else thick.
function lineOf(edge) {
  if (edge.form === 'pass') return 'pass';
  if (edge.form === 'dotted') return 'grade';
  return edge.classes.filter((name) => name === 'write' || name === 'read').at(-1) ?? 'thick';
}

// The drawer of the user_flow kind (see the top of this file).
export function userFlow(given) {
  const { heading, lines } = findFlowchart(given.text);
  const { direction, nodes, edges, lanes } = parse(lines);
  const path = given.key ?? given.source;
  const whereOf = (line) => failureWhere({ path, line });
  const keyOf = keyer();
  const laneKey = new Map(lanes.map((lane) => [lane.id, keyOf(`lane:${lane.id}`)]));

  const boxes = nodes.filter((node) => !node.legend).map((node) => {
    const all = linesOf(node.label);
    const ids = [];
    const kept = [];
    for (const line of all) {
      const found = idsOf(line);
      if (found === null) kept.push(line);
      else for (const id of found) if (!ids.includes(id)) ids.push(id);
    }
    const kind = node.kind === 'step' && node.classes.includes('grade') ? 'grading' : node.kind;
    return {
      key: keyOf(node.id), node, kind, name: kept.join(' '), lines: kept, ids,
      marks: MARKS.filter((mark) => node.classes.includes(mark)), lane: laneKey.get(node.lane) ?? null, ...sizeOf(kind, kept, ids),
    };
  });
  const boxKey = new Map(boxes.map((box) => [box.node.id, box.key]));
  const links = edges.filter((edge) => boxKey.has(edge.from) && boxKey.has(edge.to));
  const drawn = links.filter((edge) => edge.form !== 'invisible');
  // Counted before the arrows take their keys, which grow slower with each repeat.
  if (lanes.length + boxes.length + drawn.length > MAX_ELEMENTS) throw new SourceFailure();
  const arrows = drawn.map((edge) => ({ key: keyOf(`${edge.from}->${edge.to}`), edge, from: boxKey.get(edge.from), to: boxKey.get(edge.to) }));

  const laid = placed({
    nodes: boxes.map(({ key, width, height }) => ({ id: key, width, height })),
    edges: links.map((edge) => ({
      from: boxKey.get(edge.from),
      to: boxKey.get(edge.to),
      label: edge.label === '' ? null : { width: textWidthOf(edge.label) + 2 * LABEL_PADDING, height: rowsOf(edge.label) * LINE },
    })),
  }, { direction });
  const placedEdge = new Map(links.map((edge, index) => [edge, laid.edges[index]]));

  const elements = lanes.map((lane) => ({
    key: laneKey.get(lane.id), kind: 'lane', name: lane.title, parent: laneKey.get(lane.parent) ?? null, detail: { id: lane.id, where: whereOf(lane.line) },
  }));
  boxes.forEach(({ key, node, kind, name, lines: kept, ids, marks, lane }, index) => {
    const { x, y, width, height } = laid.nodes[index];
    elements.push({
      key, kind, name, parent: lane, detail: { id: node.id, lines: kept, ids, marks, lane, where: whereOf(node.line), box: { x, y, width, height } },
    });
  });
  for (const { key, edge, from, to } of arrows) {
    const { points, label } = placedEdge.get(edge);
    elements.push({
      key,
      kind: 'arrow',
      name: edge.label,
      parent: from,
      detail: {
        id: edge.id, from, to, label: edge.label, line: lineOf(edge), where: whereOf(edge.line),
        points: points.map(({ x, y }) => ({ x, y })), label_box: label === null ? null : { x: label.x, y: label.y, width: label.width, height: label.height },
      },
    });
  }
  return { name: heading ?? path.split('/').at(-1), elements };
}
