// The pinned hub's text helpers that its stage-01, 05 and 07 readers use (TASK-466, TASK-470; hub.py at the commit of
// hub-ref.json): Python's line breaks and white space, one_line with its redaction of secrets and email addresses,
// plain with Python's html.unescape, norm, the removed words, and the trace ID formats (IdFormat's find and lead).
// domain-picture.js, sql-picture.js and sitemap-picture.js read a proposal's Markdown, SQL and YAML with them, so that
// NEXUS reads a text as the hub reads it (SPEC-018).
//
// Python's str methods and re module read some characters otherwise than JavaScript's, so they are written out here:
// - Lines break where Python's str.splitlines breaks them: at \r\n, \n, \r, \v, \f, \x1c, \x1d, \x1e, \x85,
//   \u2028 and \u2029.
// - White space is what Python's str.isspace() and re's \s take, which adds \x1c to \x1f and \x85 to JavaScript's \s
//   and leaves out \ufeff.
// - A word character is a letter, a digit or _, as Python's \w takes str.isalnum(): \p{L}, \p{N} and _.
// - Case folding is JavaScript's upper case then lower case, which matches Python's str.casefold() for the letters
//   that differ from lower(), such as ß and ς, and differs only in a few rare scripts.
// - html.unescape's tables are Python's own, in html-entities.json, which tests/test_html_entities.py keeps.
//
// Nothing here logs (rule 5).

import { readFileSync } from 'node:fs';

// Python's white space, as a character class's contents, and its line breaks.
export const SPACE = '\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
const LINE_BREAK = /\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/g;
const SPACES = new RegExp(`[${SPACE}]+`, 'u');
const IS_SPACE = new RegExp(`^[${SPACE}]$`, 'u');
// A word character as Python's \w takes it, as a character class's contents.
export const WORD = '\\p{L}\\p{N}_';

// Python's text.splitlines(keepEnds).
export function splitLines(text, keepEnds = false) {
  const lines = [];
  let start = 0;
  for (const found of text.matchAll(LINE_BREAK)) {
    const end = found.index + found[0].length;
    lines.push(text.slice(start, keepEnds ? end : found.index));
    start = end;
  }
  if (start < text.length) lines.push(text.slice(start));
  return lines;
}

// Python's text.split() with no separator, text.strip(), lstrip(), rstrip() and isspace() of one character. Every
// white space character is one UTF-16 unit, so the ends are found unit by unit: a pattern such as /\s+$/ would try
// each place in a long run of spaces and take time that grows with the square of the run's length.
export const splitWords = (text) => text.split(SPACES).filter((word) => word !== '');
export const isSpace = (character) => IS_SPACE.test(character);
const startOf = (text) => {
  let start = 0;
  while (start < text.length && isSpace(text[start])) start += 1;
  return start;
};
const endOf = (text, start = 0) => {
  let end = text.length;
  while (end > start && isSpace(text[end - 1])) end -= 1;
  return end;
};
export const lstrip = (text) => text.slice(startOf(text));
export const rstrip = (text) => text.slice(0, endOf(text));
export const strip = (text) => {
  const start = startOf(text);
  return text.slice(start, endOf(text, start));
};
export const casefold = (text) => text.toUpperCase().toLowerCase();

// The hub's SECRET_TEXT: the keys and email addresses that one_line redacts, found leftmost first as Python's re.sub
// finds them. As the hub does, an address is tried only where its run of address characters starts or where the match
// before it ended, so that a long run of such characters takes time that grows with its length, not its square.
const SECRET_KEYS = String.raw`(?<![A-Za-z0-9])(?:sk-[A-Za-z0-9_-]{20,}|(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}`
  + String.raw`|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})|-----BEGIN [A-Z ]*PRIVATE KEY-----`;
const EMAIL_TEXT = String.raw`[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}`;
const SECRET_AT = new RegExp(`${SECRET_KEYS}|${EMAIL_TEXT}`, 'y');
const SECRET_FROM = new RegExp(`${SECRET_KEYS}|(?<![A-Za-z0-9._%+-])${EMAIL_TEXT}`, 'g');

function redacted(text) {
  const from = (at) => {
    SECRET_FROM.lastIndex = at;
    return SECRET_FROM.exec(text);
  };
  const at = (where) => {
    SECRET_AT.lastIndex = where;
    return SECRET_AT.exec(text);
  };
  let result = '';
  let last = 0;
  let found = from(0);
  while (found !== null) {
    result += `${text.slice(last, found.index)}[redacted]`;
    last = found.index + found[0].length;
    found = at(last) ?? from(last);
  }
  return result + text.slice(last);
}

// The hub's TEXT_CHARS, one_line's limit when none is given, and TITLE_CHARS, plain's.
export const TEXT_CHARS = 300;
export const TITLE_CHARS = 120;

// The hub's one_line: a string on one line with secrets redacted, cut to limit characters with …, or '' for anything
// that is not a string.
export function oneLine(value, limit = TEXT_CHARS) {
  if (typeof value !== 'string') return '';
  const text = splitWords(redacted(value)).join(' ');
  const characters = [...text];
  if (characters.length <= limit) return text;
  return `${rstrip(characters.slice(0, limit - 1).join(''))}…`;
}

// Python's html.unescape: each character reference of text decoded as the HTML5 standard says, by Python's tables.
const ENTITIES = JSON.parse(readFileSync(new URL('html-entities.json', import.meta.url), 'utf8'));
const NAMED = new Map(Object.entries(ENTITIES.named));
const REPLACED = new Map(Object.entries(ENTITIES.replaced).map(([code, text]) => [Number(code), text]));
const DROPPED = new Set(ENTITIES.dropped);
const CHARREF = /&(#[0-9]+;?|#[xX][0-9a-fA-F]+;?|[^\t\n\f <&#;]{1,32};?)/gu;

// A numeric reference's number, or Infinity when it is past any character: Python reads every digit, however many.
function referenceNumber(digits, radix) {
  const significant = digits.replace(/^0+/u, '');
  return significant.length > 8 ? Infinity : significant === '' ? 0 : Number.parseInt(significant, radix);
}

function decoded(reference) {
  if (reference[0] === '#') {
    const hex = reference[1] === 'x' || reference[1] === 'X';
    const digits = reference.slice(hex ? 2 : 1).replace(/;$/u, '');
    const code = referenceNumber(digits, hex ? 16 : 10);
    if (REPLACED.has(code)) return REPLACED.get(code);
    if ((code >= 0xd800 && code <= 0xdfff) || code > 0x10ffff) return '�';
    if (DROPPED.has(code)) return '';
    return String.fromCodePoint(code);
  }
  if (NAMED.has(reference)) return NAMED.get(reference);
  // The longest name it starts with, as the standard reads a name with no semicolon.
  const characters = [...reference];
  for (let length = characters.length - 1; length > 1; length -= 1) {
    const name = characters.slice(0, length).join('');
    if (NAMED.has(name)) return NAMED.get(name) + characters.slice(length).join('');
  }
  return `&${reference}`;
}

export const unescapeHtml = (text) => (text.includes('&') ? text.replace(CHARREF, (_, reference) => decoded(reference)) : text);

// The hub's MD_LINK, !?\[([^\]]*)\]\([^)]*\), each link replaced by its text. Written out as a scan with the same
// result: tried at each [ of a long text with no ] or ), the pattern would take time that grows with the square of the
// text's length. A [ whose first ] is not followed by ( shares that ] with every [ before it, so the scan goes on
// after it; with no ] or ) left, no link follows.
function linkTexts(text) {
  let result = '';
  let last = 0;
  let from = 0;
  for (;;) {
    const open = text.indexOf('[', from);
    if (open === -1) break;
    const close = text.indexOf(']', open + 1);
    if (close === -1) break;
    if (text[close + 1] !== '(') {
      from = close + 1;
      continue;
    }
    const end = text.indexOf(')', close + 2);
    if (end === -1) break;
    const start = open > last && text[open - 1] === '!' ? open - 1 : open;
    result += text.slice(last, start) + text.slice(open + 1, close);
    last = end + 1;
    from = end + 1;
  }
  return result + text.slice(last);
}

const TAG = /<[^>]{0,300}>/gu;
const MARKUP = /\*\*|__|~~|`/gu;

// The hub's plain: Markdown or HTML text as plain text on one line, with secrets redacted, cut to limit characters.
export function plain(value, limit = TITLE_CHARS) {
  if (typeof value !== 'string') return '';
  let text = linkTexts(value);
  text = text.replaceAll('<br>', ' ').replace(TAG, ' ');
  text = unescapeHtml(text).replace(MARKUP, '');
  return oneLine(text, limit);
}

const NOT_WORD = new RegExp(`[^${WORD}${SPACE}-]`, 'gu');

// The hub's norm: a name or value in lower-case words, without punctuation, for comparing.
export const norm = (value) => splitWords(String(value).toLowerCase().replace(NOT_WORD, ' ').replaceAll('_', ' ')).join(' ');

// The hub's REMOVED words, and its is_removed of a status.
export const REMOVED = new Set(['removed', 'deleted', 'dropped', 'cancelled', 'canceled', 'deprecated', 'obsolete', '삭제', '삭제됨', '폐기',
  '제외', '취소']);
export const isRemovedStatus = (status) => splitWords(norm(status)).some((word) => REMOVED.has(word));

// The hub's ID kinds and their default prefixes, in the order of the stage contract.
const KINDS = Object.freeze([
  ['context', 'CTX'], ['term', 'TERM'], ['requirement', 'REQ'], ['flow', 'FL'], ['spec', 'SPEC'], ['table', 'TBL'], ['api', 'API'],
  ['screen', 'SCR'], ['task', 'TASK'], ['test', 'TC'], ['bug', 'BUG'], ['decision', 'DEC'], ['scene', 'SCENE'],
]);
const PREFIX = /^[A-Z][A-Z0-9]*$/;
const LEAD = new RegExp(`^[${SPACE}*_\`~[(]+`, 'u');
const STATE = /^#([a-z][a-z0-9_-]{0,30})/u;
const TRAIL = new RegExp(`^[${SPACE}\\]):：.\\-–—·|*_\`~]+`, 'u');
const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The hub's IdFormat with its default prefixes, which the hub uses for a project whose settings name none, and the
// prefixes of extra, [prefix, kind] pairs, that no kind has yet: { find(text), lead(text), kind(id) }. NEXUS does not
// receive a project's own ID formats, so a proposal adds the prefixes of the trace IDs its current drawing holds.
export function idFormat(extra = []) {
  const kindOf = new Map();
  for (const [kind, prefix] of KINDS) kindOf.set(prefix, kind);
  for (const [prefix, kind] of extra) {
    if (PREFIX.test(prefix) && !kindOf.has(prefix)) kindOf.set(prefix, kind);
  }
  const names = [...kindOf.keys()].sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0));
  const body = `(?<![A-Za-z0-9_])(${names.map(escaped).join('|')})-([0-9]{1,6})(?![0-9A-Za-z_])`;
  const every = new RegExp(body, 'g');
  const first = new RegExp(`^${body}`);
  return Object.freeze({
    kind: (id) => kindOf.get(id.split('-')[0]) ?? null,
    // [id, kind] for each ID in text.
    find: (text) => [...text.matchAll(every)].map((found) => [found[0], kindOf.get(found[1])]),
    // [id, kind, state, rest] when text starts with an ID, after any white space, *, _, `, ~, [ or (, else null:
    // state the #state after it or null, and rest the text after them without the marks that end an ID's title.
    lead: (text) => {
      const stripped = text.replace(LEAD, '');
      const found = first.exec(stripped);
      if (found === null) return null;
      let rest = stripped.slice(found[0].length);
      const state = STATE.exec(rest);
      if (state !== null) rest = rest.slice(state[0].length);
      return [found[0], kindOf.get(found[1]), state === null ? null : state[1], rest.replace(TRAIL, '')];
    },
  });
}
