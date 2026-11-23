// The stage-07 picture of a proposal's YAML (TASK-466; SPEC-009, SPEC-018): NEXUS reads source_text as the pinned hub
// reads a sitemap file, so that the sitemap drawer (sitemap.js) draws a proposal's sitemap as it draws the hub's picture
// of the project's. It is a port of the hub's sitemap.py at the commit of hub-ref.json, its own reader of the sitemap
// template's YAML among them, with picture-text.js's helpers. server/test/picture-cases.json holds the hub's own
// pictures of the cases this repository's sitemap does not show, and sitemap-picture.json its picture of
// docs/07-sitemap/nexus.yaml; test/picture-readers.test.js reads both here.
//
// readSitemapPicture(documents, { ids, part }) takes [file, text] pairs and returns { picture, checks, failure }:
// - picture is the hub's format 1, { format: 1, screens: [screen], without_screen: [TERM ID] }, each screen
//   { id, name, path, access, flows, context, removed, where, terms?, parent? }, parent the place of its parent screen
//   in screens; or null when no file reads as the template's YAML, as the hub sends none;
// - checks are the hub's picture-partial checks, { rule, level, message, by, stage, part? }, one for each file that does
//   not read and each screen rule it leaves out;
// - failure is { file, line } of the first file that does not read, else null.
// - ids is picture-text.js's idFormat.
//
// The YAML it reads is the template's form only, as the hub's: a list of screens, each a mapping of keys to plain,
// quoted or inline-list values, block lists and mappings, with children nested under their parent. Tags, anchors,
// aliases, flow mappings, block scalars and merge keys are refused with the line they are on, as the hub refuses them.
// Mappings are Maps, so that a key such as __proto__ is a key like any other.
//
// It differs from the hub's in two ways, each refused here with its line as YAML that does not read:
// - YAML nested deeper than the hub's Python can read, which stops the hub rather than giving a picture: block lists
//   and mappings nested more than MAX_BLOCKS deep, and inline lists nested more than MAX_LISTS deep. Each inline list
//   is read again for each list around it, so that limit also keeps a line's reading short.
// - A double-quoted scalar that escapes half of a surrogate pair, such as "\ud800": Python keeps such text, but it is
//   not Unicode, and NEXUS keeps only Unicode text.
//
// Nothing here logs; the text is read and never kept (rule 5).

import { casefold, idFormat, isSpace, lstrip, norm, oneLine, REMOVED, rstrip, SPACE, splitLines, strip } from './picture-text.js';

const STAGE = '07-sitemap';
const MAX_SCREENS = 500;
const MAX_DEPTH = 100;
export const MAX_BLOCKS = 400;
export const MAX_LISTS = 20;

// The hub's Invalid: a YAML text that is not the template's form, and the line where it stops.
class Invalid extends Error {
  constructor(line, message) {
    super(message);
    this.line = line;
  }
}

// The hub's uncomment: a line without its # comment, which starts at a # outside quotes after white space.
function uncomment(text) {
  const characters = [...text];
  let quoted = null;
  let escaped = false;
  for (let i = 0; i < characters.length; i += 1) {
    const c = characters[i];
    if (quoted === '"' && c === '\\' && !escaped) {
      escaped = true;
      continue;
    }
    if ((c === '"' || c === "'") && !escaped) {
      if (quoted === c) quoted = null;
      else if (quoted === null) quoted = c;
    }
    if (c === '#' && quoted === null && (i === 0 || isSpace(characters[i - 1]))) return rstrip(characters.slice(0, i).join(''));
    escaped = false;
  }
  return rstrip(text);
}

const COLON_IN_SCALAR = new RegExp(`[${SPACE}]:[${SPACE}]`, 'u');

// The hub's scalar: a value after a key or a list's dash, as text, an inline list or null.
function scalar(raw, line, lists = 0) {
  const text = strip(raw);
  if (text === '') return null;
  if ('!&*{|>'.includes(text[0]) || text.startsWith('<<:')) throw new Invalid(line, 'YAML is outside the stage-07 template form');
  if (text.startsWith('"')) {
    let value;
    try {
      value = JSON.parse(text);
    } catch {
      throw new Invalid(line, 'invalid double-quoted YAML scalar');
    }
    if (typeof value !== 'string') throw new Invalid(line, 'expected a text scalar');
    // An escape of half a surrogate pair, such as \ud800, makes text that is not Unicode, which the store cannot keep.
    if (!value.isWellFormed()) throw new Invalid(line, 'a double-quoted YAML scalar escapes half of a surrogate pair');
    return value;
  }
  if (text.startsWith("'")) {
    if (!text.endsWith("'") || text.length < 2) throw new Invalid(line, 'unterminated single-quoted YAML scalar');
    return text.slice(1, -1).replaceAll("''", "'");
  }
  if (text.startsWith('[')) {
    if (!text.endsWith(']')) throw new Invalid(line, 'unterminated inline YAML list');
    if (lists >= MAX_LISTS) throw new Invalid(line, `inline YAML lists nest more than ${MAX_LISTS} deep`);
    const values = [];
    let current = [];
    let quote = null;
    let escaped = false;
    for (const c of [...strip(text.slice(1, -1)), ',']) {
      if (c === ',' && quote === null) {
        const item = current.join('');
        if (strip(item) !== '') values.push(scalar(item, line, lists + 1));
        current = [];
        continue;
      }
      current.push(c);
      if ((c === '"' || c === "'") && !escaped) {
        if (quote === c) quote = null;
        else if (quote === null) quote = c;
      }
      escaped = c === '\\' && !escaped;
    }
    if (quote !== null) throw new Invalid(line, 'unterminated quoted list value');
    return values;
  }
  if (COLON_IN_SCALAR.test(text)) throw new Invalid(line, 'a colon in a scalar needs quotes');
  return text;
}

const PAIR = new RegExp(`^([A-Za-z_][A-Za-z0-9_-]*):(?:[${SPACE}]+([^\\n]*)|[${SPACE}]*)$`, 'u');
const KEY_START = /^[A-Za-z_][A-Za-z0-9_-]*:/;

// The hub's read_yaml: the template's list of screens, each a Map of its keys and __line__, the line it starts on.
export function readYaml(text) {
  const lines = [];
  splitLines(text).forEach((raw, index) => {
    const number = index + 1;
    if (raw.slice(0, raw.length - lstrip(raw).length).includes('\t')) throw new Invalid(number, 'tabs cannot indent the template');
    const clean = uncomment(raw);
    const stripped = strip(clean);
    if (stripped === '' || stripped === '---' || stripped === '...') return;
    lines.push([clean.length - lstrip(clean).length, stripped, number]);
  });

  const pair = (text, line) => {
    const found = PAIR.exec(text);
    if (found === null) throw new Invalid(line, 'expected a template key and colon');
    return [found[1], found[2] ?? ''];
  };

  // The hub's block, its entry, and depth, how many blocks hold this one.
  const block = (start, indent, depth) => {
    if (depth > MAX_BLOCKS) throw new Invalid(lines[start][2], `YAML nests more than ${MAX_BLOCKS} deep`);
    const entry = (result, key, raw, from, keyIndent, line) => {
      if (result.has(key)) throw new Invalid(line, 'duplicate YAML key');
      if (raw) {
        result.set(key, scalar(raw, line));
        return from;
      }
      if (from < lines.length && lines[from][0] > keyIndent) {
        const [value, next] = block(from, lines[from][0], depth + 1);
        result.set(key, value);
        return next;
      }
      result.set(key, null);
      return from;
    };
    let i = start;
    const sequence = lines[i][1].startsWith('- ') || lines[i][1] === '-';
    const result = sequence ? [] : new Map();
    while (i < lines.length && lines[i][0] === indent) {
      const [, text, line] = lines[i];
      if (sequence) {
        if (!text.startsWith('- ')) throw new Invalid(line, 'mixed sequence and mapping');
        const rest = text.slice(2);
        i += 1;
        if (KEY_START.test(rest)) {
          const item = new Map([['__line__', line]]);
          const [key, raw] = pair(rest, line);
          i = entry(item, key, raw, i, indent + 2, line);
          while (i < lines.length && lines[i][0] === indent + 2) {
            const [, itemText, number] = lines[i];
            const [itemKey, itemRaw] = pair(itemText, number);
            i = entry(item, itemKey, itemRaw, i + 1, indent + 2, number);
          }
          result.push(item);
        } else {
          result.push(scalar(rest, line));
        }
      } else {
        const [key, raw] = pair(text, line);
        i = entry(result, key, raw, i + 1, indent, line);
      }
      if (i < lines.length && lines[i][0] > indent) throw new Invalid(lines[i][2], 'unexpected YAML indentation');
    }
    return [result, i];
  };

  if (lines.length === 0) return [];
  const [result, end] = block(0, lines[0][0], 1);
  if (end !== lines.length) throw new Invalid(lines[end][2], 'unexpected YAML indentation');
  if (!Array.isArray(result)) throw new Invalid(lines[0][2], 'the sitemap template is a list of screens');
  return result;
}

// Python's re.IGNORECASE also takes İ and ı for i, which JavaScript's does not.
const WITHOUT_SCREEN = new RegExp(`^[${SPACE}]*#[${SPACE}]*w[iİı]thout a screen[${SPACE}]*:[${SPACE}]*([^\\n]*)`, 'iu');
const unique = (values) => [...new Set(values)];

// The hub's sitemap.parse (see the top of this file).
export function readSitemapPicture(documents, { ids = idFormat(), part = '' } = {}) {
  const picture = { format: 1, screens: [], without_screen: [] };
  const checks = [];
  let readFiles = 0;
  let failure = null;
  const issue = (file, line, detail) => {
    const row = { rule: 'picture-partial', level: 'warn', message: oneLine(`${file}:${line}: ${detail}`, 600), by: 'scan', stage: STAGE };
    if (part) row.part = part;
    checks.push(row);
  };
  const trace = (text, kind) => ids.find(text).filter(([, found]) => found === kind).map(([id]) => id);

  for (const [file, text] of documents) {
    for (const line of splitLines(text)) {
      const marker = WITHOUT_SCREEN.exec(line);
      if (marker === null) continue;
      for (const term of trace(marker[1], 'term')) picture.without_screen.push(term);
    }
    let roots;
    try {
      roots = readYaml(text);
    } catch (error) {
      if (!(error instanceof Invalid)) throw error;
      issue(file, error.line, error.message);
      failure ??= { file, line: error.line };
      continue;
    }
    readFiles += 1;

    const walk = (nodes, parent, depth) => {
      if (depth > MAX_DEPTH) {
        issue(file, 1, `screen nesting exceeds ${MAX_DEPTH} levels`);
        return;
      }
      for (const node of nodes) {
        if (picture.screens.length >= MAX_SCREENS) {
          issue(file, 1, `more than ${MAX_SCREENS} screens; later screens are omitted`);
          return;
        }
        if (!(node instanceof Map)) {
          issue(file, 1, 'a screen must be a mapping');
          continue;
        }
        const line = node.has('__line__') ? node.get('__line__') : 1;
        const value = (key, limit = 120) => oneLine(node.get(key), limit);
        const screenIds = trace(value('id'), 'screen');
        const screen = {
          id: screenIds[0] ?? '', name: value('name'), path: value('path', 300), access: value('access'), flows: [], context: '',
          removed: REMOVED.has(norm(value('status'))), where: `${file}:${line}`,
        };
        const flows = node.has('flows') ? node.get('flows') : [];
        if (Array.isArray(flows)) {
          screen.flows = unique(flows.filter((flow) => typeof flow === 'string').flatMap((flow) => trace(flow, 'flow'))).slice(0, 50);
        } else if (flows !== null) {
          issue(file, line, 'flows must be a list');
        }
        if (node.has('terms')) {
          const terms = node.get('terms');
          if (Array.isArray(terms)) {
            const joined = terms.filter((term) => typeof term === 'string').join(' ');
            screen.context = trace(joined, 'context')[0] ?? '';
            screen.terms = unique(trace(joined, 'term')).slice(0, 20);
          } else if (typeof terms === 'string' && casefold(terms) === 'none') {
            screen.terms = [];
          } else {
            issue(file, line, 'terms must be a list or none');
          }
        }
        if (parent !== null) screen.parent = parent;
        const index = picture.screens.length;
        picture.screens.push(screen);
        const children = node.has('children') ? node.get('children') : [];
        if (Array.isArray(children)) walk(children, index, depth + 1);
        else if (children !== null) issue(file, line, 'children must be a list');
      }
    };
    walk(roots, null, 0);
  }
  picture.without_screen = unique(picture.without_screen).slice(0, 500);
  return { picture: readFiles > 0 ? picture : null, checks, failure };
}

