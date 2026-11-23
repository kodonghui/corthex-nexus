// The pinned hub's text helpers that its stage-05 and stage-07 readers use (TASK-466; hub.py at the commit of
// hub-ref.json): Python's line breaks and white space, one_line with its redaction of secrets and email addresses,
// norm, the removed words, and the trace ID formats (IdFormat's find and lead). sql-picture.js and sitemap-picture.js
// read a proposal's SQL and YAML with them, so that NEXUS reads a text as the hub reads it (SPEC-018).
//
// Python's str methods and re module read some characters otherwise than JavaScript's, so they are written out here:
// - Lines break where Python's str.splitlines breaks them: at \r\n, \n, \r, \v, \f, \x1c, \x1d, \x1e, \x85,
//   \u2028 and \u2029.
// - White space is what Python's str.isspace() and re's \s take, which adds \x1c to \x1f and \x85 to JavaScript's \s
//   and leaves out \ufeff.
// - A word character is a letter, a digit or _, as Python's \w takes str.isalnum(): \p{L}, \p{N} and _.
// - Case folding is JavaScript's upper case then lower case, which matches Python's str.casefold() for the letters
//   that differ from lower(), such as ß and ς, and differs only in a few rare scripts.
//
// Nothing here logs (rule 5).

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

// The hub's TEXT_CHARS, one_line's limit when none is given.
export const TEXT_CHARS = 300;

// The hub's one_line: a string on one line with secrets redacted, cut to limit characters with …, or '' for anything
// that is not a string.
export function oneLine(value, limit = TEXT_CHARS) {
  if (typeof value !== 'string') return '';
  const text = splitWords(redacted(value)).join(' ');
  const characters = [...text];
  if (characters.length <= limit) return text;
  return `${rstrip(characters.slice(0, limit - 1).join(''))}…`;
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
    // [id, kind] when text starts with an ID, after any white space, *, _, `, ~, [ or (, else null.
    lead: (text) => {
      const found = first.exec(text.replace(LEAD, ''));
      return found === null ? null : [found[0], kindOf.get(found[1])];
    },
  });
}
