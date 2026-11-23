// The mockup drawer (TASK-427; SPEC-009): lists the design tokens a stage-09 mockup page uses, one element for each CSS
// custom property the page reads with var() (API-265). It is drawing.js's drawer of the mockup kind and keeps to the
// drawer interface described there and in the server's README. The page itself is served by API-293
// (mockup-page.js), in a sandbox; this file only reads its text.
//
// The source is the page as the pinned hub sends it in corthex-hub/0.3: the whole text of the HTML file the project's
// stage 09 names, one picture per file, which NEXUS reads itself. The coordinator chose these rules for TASK-427, and
// the server's README gives them with the options not taken:
// - Where a var() counts: in the CSS of every <style> element and of every style attribute, wherever it stands,
//   <template> content included; CSS comments and CSS strings are skipped. The text of a <script> or another element
//   whose content is text, HTML comments and the page's text are not read, so a token a script alone reads is not
//   listed.
// - Each var() reads its custom property, and so does each var() of its fallback: var(--a, var(--b)) reads --a and
//   --b.
// - A custom property the page sets but never reads with var() is not listed; one it reads but never sets is listed
//   like any other.
// - A token is named by the property as the page writes it, with its leading --, its case kept (CSS custom properties
//   are case-sensitive) and its CSS escapes resolved, so --a\:b and --a\3a b are one token --a:b. Its key is
//   token:<name>, as elementKey makes it. The tokens come in the order the page first reads them.
// - Its detail is { values, uses }: values, the distinct values the page's CSS sets for it, in the page's order, up to
//   10, each cut to 200 characters, so that the screen can draw a swatch of the first; uses, how many var() read it.
// - A token has no box: the screen lists the tokens in the panel beside the page, not on a canvas, so layout.js places
//   none and no position is kept for one.
// - The diagram keeps drawing.js's name, the file's name.
// - A page fails at its source, with no line, only when it reads more custom properties than a drawing holds
//   elements; any other text draws, an empty page or one that reads none as no tokens.
// The page is not checked as HTML: like a browser, the drawer reads whatever text it gets. It reads no warnings, as
// drawing.js gives a file's picture none. Nothing here logs (rule 5).

import { characters, elementKey, keyer, MAX_ELEMENTS, SourceFailure } from './drawer.js';

// A token's values: at most this many, each of at most this many characters.
const MAX_VALUES = 10;
const MAX_VALUE = 200;

// The elements whose content HTML reads as text, not markup, so that a tag or a style attribute in it is no element:
// raw text and escapable raw text, and noscript, since the sandbox runs scripts. plaintext holds the rest of the page.
const TEXT_CONTENT = new Set(['iframe', 'noembed', 'noframes', 'noscript', 'script', 'style', 'textarea', 'title', 'xmp']);
const PLAINTEXT = 'plaintext';

// The named character references a style attribute may spell CSS with: those of ASCII punctuation and white space.
// Numeric references are all read.
const NAMED = Object.freeze({
  amp: '&', apos: "'", ast: '*', bsol: '\\', colon: ':', comma: ',', commat: '@', dollar: '$', equals: '=', excl: '!',
  grave: '`', gt: '>', Hat: '^', lbrack: '[', lcub: '{', lowbar: '_', lpar: '(', lsqb: '[', lt: '<', NewLine: '\n',
  num: '#', percnt: '%', period: '.', plus: '+', quest: '?', quot: '"', rbrack: ']', rcub: '}', rpar: ')', rsqb: ']',
  semi: ';', sol: '/', Tab: '\t', verbar: '|', vert: '|',
});
const REFERENCE = /&(?:#([0-9]+);?|#[xX]([0-9a-fA-F]+);?|([A-Za-z][A-Za-z0-9]*);)/g;

const REPLACEMENT = '�';
const isHtmlSpace = (c) => c === ' ' || c === '\n' || c === '\t' || c === '\f' || c === '\r';
const isLetter = (c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
const asciiLower = (text) => text.replace(/[A-Z]+/g, (letters) => letters.toLowerCase());

// A code point HTML or CSS reads from a number: none, a surrogate or one past Unicode is the replacement character.
function codePoint(code) {
  return code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff) ? REPLACEMENT : String.fromCodePoint(code);
}

// The number digits spell in radix, or Infinity when they spell more than places digits after any leading zeros.
function numberOf(digits, places, radix) {
  const significant = digits.replace(/^0+(?=.)/, '');
  return significant.length > places ? Infinity : parseInt(significant, radix);
}

// An attribute's value with its character references read.
function decoded(value) {
  if (!value.includes('&')) return value;
  return value.replace(REFERENCE, (whole, decimal, hex, name) => {
    // Leading zeros name nothing; a longer number than Unicode's is past it.
    if (decimal !== undefined) return codePoint(numberOf(decimal, 7, 10));
    if (hex !== undefined) return codePoint(numberOf(hex, 6, 16));
    return Object.hasOwn(NAMED, name) ? NAMED[name] : whole;
  });
}

// HTML.

// The end of a comment, "-->" or "--!>": one search finds the first of either, so a page of many comments is read in
// one pass.
const COMMENT_END = /--!?>/g;

// Where a comment that starts at at ends, after "<!--": "-->", "--!>", or the abrupt "<!-->" and "<!--->".
function commentEnd(html, at) {
  if (html[at] === '>') return at + 1;
  if (html.startsWith('->', at)) return at + 2;
  COMMENT_END.lastIndex = at;
  const end = COMMENT_END.exec(html);
  return end === null ? html.length : end.index + end[0].length;
}

// A tag whose name starts at at: { name, style, end }, its name in lowercase, its first style attribute's value with
// its references read or null, and where it ends; or null when the page ends inside it, which HTML drops.
function tagAt(html, at) {
  let index = at;
  while (index < html.length && !isHtmlSpace(html[index]) && html[index] !== '/' && html[index] !== '>') index += 1;
  const name = asciiLower(html.slice(at, index));
  let style = null;
  const seen = new Set();
  for (;;) {
    while (index < html.length && (isHtmlSpace(html[index]) || html[index] === '/')) index += 1;
    if (index >= html.length) return null;
    if (html[index] === '>') return { name, style, end: index + 1 };
    // An attribute's name may start with "="; it ends at white space, "/", ">" or "=".
    const start = index;
    index += 1;
    while (index < html.length && !isHtmlSpace(html[index]) && html[index] !== '/' && html[index] !== '>' && html[index] !== '=') index += 1;
    const attribute = asciiLower(html.slice(start, index));
    while (index < html.length && isHtmlSpace(html[index])) index += 1;
    let value = '';
    if (html[index] === '=') {
      index += 1;
      while (index < html.length && isHtmlSpace(html[index])) index += 1;
      const quote = html[index];
      if (quote === '"' || quote === "'") {
        const close = html.indexOf(quote, index + 1);
        if (close === -1) return null;
        value = html.slice(index + 1, close);
        index = close + 1;
      } else {
        const begin = index;
        while (index < html.length && !isHtmlSpace(html[index]) && html[index] !== '>') index += 1;
        value = html.slice(begin, index);
      }
    }
    // HTML keeps the first of two attributes of one name.
    if (!seen.has(attribute)) {
      seen.add(attribute);
      if (attribute === 'style') style = decoded(value);
    }
  }
}

// Where the text content of an element named name, which starts at at, ends: { start, end }, the start of its end tag
// and the end of that tag, or the page's end when it has none.
function textContentEnd(html, at, name) {
  for (let index = html.indexOf('</', at); index !== -1; index = html.indexOf('</', index + 2)) {
    const after = html[index + 2 + name.length];
    if (asciiLower(html.slice(index + 2, index + 2 + name.length)) !== name) continue;
    if (after !== undefined && !isHtmlSpace(after) && after !== '/' && after !== '>') continue;
    const tag = tagAt(html, index + 2);
    return { start: index, end: tag === null ? html.length : tag.end };
  }
  return { start: html.length, end: html.length };
}

// The CSS of a page, in the page's order: { text, list } for the text of each <style> element (list false, a style
// sheet) and the value of each style attribute (list true, a list of declarations).
export function* cssOf(html) {
  let at = 0;
  while (at < html.length) {
    const open = html.indexOf('<', at);
    if (open === -1) return;
    const next = html[open + 1] ?? '';
    if (html.startsWith('<!--', open)) {
      at = commentEnd(html, open + 4);
    } else if (next === '!' || next === '?') {
      // A doctype or a bogus comment, to the next ">".
      const close = html.indexOf('>', open + 2);
      at = close === -1 ? html.length : close + 1;
    } else if (next === '/') {
      if (isLetter(html[open + 2] ?? '')) {
        // An end tag: its attributes are read and dropped.
        const tag = tagAt(html, open + 2);
        if (tag === null) return;
        at = tag.end;
      } else {
        const close = html.indexOf('>', open + 2);
        at = close === -1 ? html.length : close + 1;
      }
    } else if (isLetter(next)) {
      const tag = tagAt(html, open + 1);
      if (tag === null) return;
      if (tag.style !== null) yield { text: tag.style, list: true };
      at = tag.end;
      if (tag.name === PLAINTEXT) return;
      if (TEXT_CONTENT.has(tag.name)) {
        const content = textContentEnd(html, at, tag.name);
        if (tag.name === 'style') yield { text: html.slice(at, content.start), list: false };
        at = content.end;
      }
    } else {
      at = open + 1;
    }
  }
}

// CSS.

const isCssSpace = (c) => c === ' ' || c === '\n' || c === '\t' || c === '\r' || c === '\f';
// A code unit of a CSS name: a letter, a digit, "-", "_", anything past ASCII, or NUL, which CSS reads as the
// replacement character.
const isNameUnit = (c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c === '-' || c === '_'
  || c > '\u007f' || c === '\u0000';
const isNewline = (c) => c === '\n' || c === '\r' || c === '\f';
// A backslash that starts an escape: not before a newline.
const startsEscape = (css, at) => css[at] === '\\' && !isNewline(css[at + 1] ?? '');

// The escape that starts at at: { text, end }. Up to six hex digits and one white space after them name a code point;
// a backslash at the end of the text is the replacement character; any other character stands for itself.
function escapeAt(css, at) {
  const hex = /^[0-9a-fA-F]{1,6}/.exec(css.slice(at + 1, at + 7));
  if (hex !== null) {
    let end = at + 1 + hex[0].length;
    if (css[end] === '\r' && css[end + 1] === '\n') end += 2;
    else if (isCssSpace(css[end] ?? '')) end += 1;
    return { text: codePoint(parseInt(hex[0], 16)), end };
  }
  if (at + 1 >= css.length) return { text: REPLACEMENT, end: at + 1 };
  const code = css.codePointAt(at + 1);
  return { text: code === 0 ? REPLACEMENT : String.fromCodePoint(code), end: at + 1 + (code > 0xffff ? 2 : 1) };
}

// The name that starts at at, its escapes resolved: { name, end }.
function nameAt(css, at) {
  let name = '';
  let index = at;
  while (index < css.length) {
    if (startsEscape(css, index)) {
      const escape = escapeAt(css, index);
      name += escape.text;
      index = escape.end;
    } else if (isNameUnit(css[index])) {
      name += css[index] === '\u0000' ? REPLACEMENT : css[index];
      index += 1;
    } else {
      break;
    }
  }
  return { name, end: index };
}

// Where a string that starts with its quote at at ends: at its closing quote, or before a newline it may not hold.
function stringEnd(css, at) {
  const quote = css[at];
  let index = at + 1;
  while (index < css.length) {
    const c = css[index];
    if (c === quote) return index + 1;
    if (isNewline(c)) return index;
    index += c === '\\' ? 2 : 1;
  }
  return css.length;
}

// Where an unquoted url( ... ) that starts after its "(" at at ends.
function urlEnd(css, at) {
  let index = at;
  while (index < css.length && css[index] !== ')') index += startsEscape(css, index) ? escapeAt(css, index).end - index : 1;
  return Math.min(index + 1, css.length);
}

// The tokens of a CSS text, comments left out: each { type, value, start, end }, type one of space, string, url,
// name, function (value its name), the brackets (, ), [, ], {, }, and ; : , and other for any other character.
export function tokensOf(css) {
  const tokens = [];
  let at = 0;
  while (at < css.length) {
    const c = css[at];
    const start = at;
    if (c === '/' && css[at + 1] === '*') {
      const close = css.indexOf('*/', at + 2);
      at = close === -1 ? css.length : close + 2;
      continue;
    }
    if (isCssSpace(c)) {
      while (at < css.length && isCssSpace(css[at])) at += 1;
      tokens.push({ type: 'space', value: ' ', start, end: at });
    } else if (c === '"' || c === "'") {
      at = stringEnd(css, at);
      tokens.push({ type: 'string', value: css.slice(start, at), start, end: at });
    } else if (isNameUnit(c) || startsEscape(css, at)) {
      const { name, end } = nameAt(css, at);
      at = end;
      if (css[at] !== '(') {
        tokens.push({ type: 'name', value: name, start, end: at });
        continue;
      }
      at += 1;
      if (asciiLower(name) === 'url') {
        let index = at;
        while (index < css.length && isCssSpace(css[index])) index += 1;
        if (css[index] !== '"' && css[index] !== "'") {
          at = urlEnd(css, index);
          tokens.push({ type: 'url', value: css.slice(start, at), start, end: at });
          continue;
        }
      }
      tokens.push({ type: 'function', value: name, start, end: at });
    } else {
      at += 1;
      tokens.push({ type: '()[]{};:,'.includes(c) ? c : 'other', value: c, start, end: at });
    }
  }
  return tokens;
}

const OPENS = Object.freeze({ '(': ')', '[': ']', '{': '}', function: ')' });
const isCustomProperty = (token) => token?.type === 'name' && token.value.startsWith('--') && token.value.length > 2;

// The index of the first token from at on that is not white space.
function nextSolid(tokens, at) {
  let index = at;
  while (tokens[index]?.type === 'space') index += 1;
  return index;
}

// The custom properties each var() of tokens reads, in their order: the first name after its "(".
export function readsOf(tokens) {
  const reads = [];
  tokens.forEach((token, index) => {
    if (token.type !== 'function' || asciiLower(token.value) !== 'var') return;
    const name = tokens[nextSolid(tokens, index + 1)];
    if (isCustomProperty(name)) reads.push(name.value);
  });
  return reads;
}

// A declaration's value: its tokens' text from start to end, white space made single spaces and trimmed, and a final
// !important left out: the delimiter "!" and then the name important, in any case, white space between them allowed.
// It is found by its tokens, not by searching the text, so a long value costs no more than its length.
function valueOf(css, tokens, start, end) {
  const before = (at) => {
    let index = at;
    while (index > start && tokens[index - 1].type === 'space') index -= 1;
    return index;
  };
  let last = before(end);
  const important = tokens[last - 1];
  if (last > start && important.type === 'name' && asciiLower(important.value) === 'important') {
    const bang = before(last - 1);
    if (bang > start && tokens[bang - 1].type === 'other' && tokens[bang - 1].value === '!') last = bang - 1;
  }
  let text = '';
  for (let index = start; index < last; index += 1) {
    const token = tokens[index];
    if (token.type === 'space') {
      if (!text.endsWith(' ')) text += ' ';
    } else {
      text += css.slice(token.start, token.end);
    }
  }
  return text.trim();
}

// The custom properties the declarations of tokens set, in their order: each { name, from, to }, its value being the
// tokens from from to to (see valueOf), read only when it is kept. A declaration starts a block's content or follows
// its ";" or a nested block's "}"; in a list of declarations, as a style attribute holds, the text's start is one too.
// Its value runs to the ";" or "}" that ends it, brackets inside it kept whole.
export function settingsOf(css, tokens, list) {
  const settings = [];
  const open = [];
  const inBlock = () => (open.length === 0 ? list : open.at(-1) === '}');
  let starts = list;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === 'space') continue;
    if (starts && isCustomProperty(token)) {
      const colon = nextSolid(tokens, index + 1);
      if (tokens[colon]?.type === ':') {
        let depth = 0;
        let end = colon + 1;
        for (; end < tokens.length; end += 1) {
          const type = tokens[end].type;
          if (depth === 0 && (type === ';' || type === '}')) break;
          if (Object.hasOwn(OPENS, type)) depth += 1;
          else if (type === ')' || type === ']' || type === '}') depth = Math.max(0, depth - 1);
        }
        settings.push({ name: token.value, from: colon + 1, to: end });
        // The ";" or "}" that ends it is read as any other.
        index = end - 1;
        starts = false;
        continue;
      }
    }
    if (Object.hasOwn(OPENS, token.type)) {
      open.push(OPENS[token.type]);
      starts = token.type === '{';
    } else if (token.type === ')' || token.type === ']' || token.type === '}') {
      if (open.at(-1) === token.type) open.pop();
      starts = token.type === '}' && inBlock();
    } else {
      starts = token.type === ';' && inBlock();
    }
  }
  return settings;
}

// The first max characters of text; a longer text ends with an ellipsis.
function cut(text, max) {
  return characters(text) <= max ? text : `${[...text].slice(0, max - 1).join('')}…`;
}

// The tokens a page uses: { name, values, uses } in the order the page first reads them. More than a drawing holds
// fail the page at its source.
export function tokensOfPage(html) {
  const used = new Map();
  const values = new Map();
  for (const { text, list } of cssOf(html)) {
    const tokens = tokensOf(text);
    for (const name of readsOf(tokens)) {
      const token = used.get(name);
      if (token !== undefined) {
        token.uses += 1;
        continue;
      }
      if (used.size === MAX_ELEMENTS) throw new SourceFailure();
      used.set(name, { name, values: [], uses: 1 });
    }
    for (const { name, from, to } of settingsOf(text, tokens, list)) {
      if (!values.has(name)) values.set(name, []);
      const kept = values.get(name);
      if (kept.length === MAX_VALUES) continue;
      const shown = cut(valueOf(text, tokens, from, to), MAX_VALUE);
      if (!kept.includes(shown)) kept.push(shown);
    }
  }
  return [...used.values()].map((token) => ({ ...token, values: values.get(token.name) ?? [] }));
}

// The drawer (see the top of this file and drawing.js).
export function mockup({ text }) {
  const keyOf = keyer();
  return {
    elements: tokensOfPage(text).map(({ name, values, uses }) => ({
      key: keyOf(elementKey({ kind: 'token', name })),
      kind: 'token',
      name,
      detail: { values, uses },
    })),
  };
}
