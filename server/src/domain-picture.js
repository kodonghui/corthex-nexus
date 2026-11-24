// The stage-01 picture of a proposal's Markdown (TASK-470; SPEC-003, SPEC-018): NEXUS reads source_text as the pinned
// hub reads a domain document, so that the DDD board drawer (ddd-board.js) draws a proposal's domain as it draws the
// hub's picture of the project's. It is a port of the hub's domain.py at the commit of hub-ref.json, with
// picture-text.js's helpers (hub.py's plain, norm, one_line, cells and IdFormat). server/test/ddd-board-picture.json
// holds the hub's picture of docs/01-domain, and server/test/picture-cases.json its pictures of the cases this
// repository's document does not show; test/picture-readers.test.js reads both here.
//
// readDomainPicture(documents, { ids, part }) takes [file, text] pairs and returns { picture, checks }:
// - picture is the hub's format 1, { format: 1, contexts, aggregates, read_models, dependencies, hotspots, timeline? },
//   as ddd-board.js reads it, or null when no document has a context heading, as the hub sends none;
// - checks are the hub's checks of the reading: picture-partial, { rule, level, message, by, stage, part? }, for what it
//   leaves out, which drawing.js's pictureWarnings turns into the drawer's warnings, and board-term-missing, with its
//   refs and args, for an aggregate or read model with no glossary term or several.
// - ids is picture-text.js's idFormat.
//
// It reads what the hub reads, each document on its own: a heading that starts with a CTX ID opens that context, and a
// heading at its level or above closes it; Purpose: and External systems: lines under it; and the tables by their
// headers, in English or Korean: the context map (context, type, aggregates), the command tables (given by, read model,
// command, aggregate, events) under their context, read models (read model, shows), dependencies (from, to, kind, why,
// data), hotspots (hotspot, context, state, answer), the event timeline (lane, events) and the glossary (ID, term,
// status). Struck-out text and fenced code are passed over. Each document's contexts, glossary and removed IDs are its
// own, so a document reads the same beside any other; the picture's limits then apply to them all.
//
// Python's regular expressions that would take time that grows with the square of a long run of white space, the
// splits of a cell at commas, <br>, arrows and "or", are written out as scans with the same result. A hotspot's number
// is read from any decimal digits, as Python's \d and int() read them; one too large for JavaScript to hold exactly is
// past any number the drawer takes, as the hub's is.
//
// Nothing here logs; the text is read and never kept (rule 5).

import { casefold, idFormat, isRemovedStatus, isSpace, lstrip, norm, oneLine, plain, SPACE, splitLines, strip, WORD } from './picture-text.js';

const STAGE = '01-domain';

// The hub's HEADERS: each key a table's column may stand for, and the header names it takes, normalized.
const HEADERS = Object.freeze([
  ['context', ['context', '컨텍스트']], ['type', ['type', '종류']], ['aggregates', ['aggregates', '애그리거트']],
  ['given_by', ['given by', '주는 쪽']], ['read_model', ['read model', '읽기 모델']], ['command', ['command', '명령']],
  ['aggregate', ['aggregate', '애그리거트']], ['events', ['events', '사건']], ['shows', ['shows', '보여 주는 것']],
  ['from', ['from', '어디서']], ['to', ['to', '어디로']], ['kind', ['kind', '종류']], ['why', ['why', '까닭']],
  ['data', ['data', '오가는 것']], ['hotspot', ['hotspot', '핫스팟']], ['state', ['state', '상태']],
  ['answer', ['answer or next step', '답이나 다음 할 일']], ['id', ['id']], ['term', ['term', '용어']],
  ['status', ['status', '상태']], ['lane', ['lane', '흐름']],
]);
// The hub's EMPTY values, normalized.
const EMPTY = new Set(['', '-', 'none', 'null', 'n a', 'na', 'tbd', '없음', '비어 있음', '미정']);
// The hub's picture limits, in its order, and a context's rows.
const LIMITS = Object.freeze([['contexts', 200], ['aggregates', 500], ['read_models', 500], ['dependencies', 500], ['hotspots', 500], ['timeline', 50]]);
const MAX_ROWS = 200;

const STRUCK = /~~[^~\n]+~~/gu;
const FENCE = new RegExp(`^[${SPACE}]*(?:\`{3,}|~{3,})`, 'u');
const DIVIDER = /^:?-{3,}:?$/u;
const CELL_SPLIT = /(?<!\\)\|/u;
const HEADING = new RegExp(`^(#{1,6})[${SPACE}]+(.+)`, 'u');
const PURPOSE = new RegExp(`^[${SPACE}]*(?:Purpose|목적)[${SPACE}]*:[${SPACE}]*(.*)`, 'iu');
const EXTERNAL = new RegExp(`^[${SPACE}]*[-*][${SPACE}]*(?:External systems|바깥 시스템)[${SPACE}]*:[${SPACE}]*(.*)`, 'iu');
// Python's re.IGNORECASE also takes İ and ı for i, which JavaScript's does not; \b is between a word character and
// another, as Python's \w takes them.
const POLICY = new RegExp(`(?:(?<![${WORD}])Pol[iİı]cy[${SPACE}]*:|정책[${SPACE}]*:)`, 'iu');
const OR_LEAD = new RegExp(`^(?:or|또는)[${SPACE}]+`, 'iu');
const NUMBERED = new RegExp(`^(\\p{Nd}+)[${SPACE}]*[.)]?[${SPACE}]+`, 'u');
const EMPTY_PARENS = new RegExp(`\\([${SPACE}]*\\)`, 'gu');
const SPACES = new RegExp(`[${SPACE}]+`, 'gu');
const DIGIT = /\p{Nd}/u;

// The hub's word: a name without white space, composed and case-folded, for comparing.
const wordOf = (text) => casefold(text.normalize('NFC').replace(SPACES, ''));

// The hub's cells and is_table.
function cells(line) {
  let text = strip(line);
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|') && !text.endsWith('\\|')) text = text.slice(0, -1);
  return text.split(CELL_SPLIT).map(strip);
}
const isTable = (line) => lstrip(line).startsWith('|');

// The hub's tables: each row of each table outside fenced code, as [its line from 1, { key: cell }] by HEADERS.
function tablesOf(lines) {
  const rows = [];
  let index = 0;
  let fenced = false;
  while (index < lines.length) {
    if (FENCE.test(lines[index])) fenced = !fenced;
    if (fenced || index + 1 >= lines.length || !isTable(lines[index])) {
      index += 1;
      continue;
    }
    const divider = cells(lines[index + 1]);
    if (!divider.every((cell) => DIVIDER.test(strip(cell)))) {
      index += 1;
      continue;
    }
    const header = cells(lines[index]).map((cell) => norm(plain(cell)));
    const columns = HEADERS.map(([key, aliases]) => [key, header.findIndex((name) => aliases.includes(name))]).filter(([, column]) => column !== -1);
    index += 2;
    while (index < lines.length && isTable(lines[index])) {
      const values = cells(lines[index]);
      rows.push([index + 1, Object.fromEntries(columns.map(([key, column]) => [key, column < values.length ? values[column] : '']))]);
      index += 1;
    }
  }
  return rows;
}

const has = (row, keys) => keys.every((key) => Object.hasOwn(row, key));

// Python's re.split of text by a separator whose leftmost match at or after a place the separator's finder gives as
// [start, end], or null when there is none. A finder is made for each split, since it keeps where it found each
// word last: the places it is asked from only grow, so each word is searched for across the text once, and a split
// takes time that grows with the text's length.
function splitBy(text, finder) {
  const next = finder();
  const parts = [];
  let last = 0;
  for (let found = next(text, 0); found !== null; found = next(text, found[1])) {
    parts.push(text.slice(last, found[0]));
    last = found[1];
  }
  parts.push(text.slice(last));
  return parts;
}

// The place of word in text at or after at, found again only when the place last found is before at; -1 for none.
function searcher(word) {
  let found = -2;
  return (text, at) => {
    if (found !== -1 && found < at) found = text.indexOf(word, at);
    return found;
  };
}

// The white space before a separator's core, from no earlier than from, and after it.
function spaced(text, from, start, end) {
  let first = start;
  while (first > from && isSpace(text[first - 1])) first -= 1;
  let last = end;
  while (last < text.length && isSpace(text[last])) last += 1;
  return [first, last];
}

// \s*,\s*|\s*<br\s*/?>\s*: a comma or a <br> tag, with the white space around it.
function termSeparators() {
  const commas = searcher(',');
  const tags = searcher('<br');
  return (text, from) => {
    for (let at = from; ;) {
      const comma = commas(text, at);
      const tag = tags(text, at);
      if (comma === -1 && tag === -1) return null;
      if (comma !== -1 && (tag === -1 || comma < tag)) return spaced(text, from, comma, comma + 1);
      let end = tag + 3;
      while (end < text.length && isSpace(text[end])) end += 1;
      if (text[end] === '/') end += 1;
      if (text[end] === '>') return spaced(text, from, tag, end + 1);
      at = tag + 1;
    }
  };
}

// \s*→\s*: an arrow with the white space around it.
function arrows() {
  const found = searcher('→');
  return (text, from) => {
    const arrow = found(text, from);
    return arrow === -1 ? null : spaced(text, from, arrow, arrow + 1);
  };
}

// ,?\s+(?:or|또는)\s+: "or" between white space, with a comma before it.
function ors() {
  const englishes = searcher('or');
  const koreans = searcher('또는');
  return (text, from) => {
    for (let at = from; ;) {
      const english = englishes(text, at);
      const korean = koreans(text, at);
      if (english === -1 && korean === -1) return null;
      const word = english !== -1 && (korean === -1 || english < korean) ? english : korean;
      const end = word + 2;
      if (word - 1 >= from && isSpace(text[word - 1]) && end < text.length && isSpace(text[end])) {
        let [start, last] = spaced(text, from, word, end);
        if (start > from && text[start - 1] === ',') start -= 1;
        return [start, last];
      }
      at = word + 1;
    }
  };
}

// A decimal digit's value: Unicode puts every set of decimal digits in a run of ten from 0 to 9.
function digitValue(character) {
  const code = character.codePointAt(0);
  if (code < 128) return code - 48;
  let start = code;
  while (start > 0 && DIGIT.test(String.fromCodePoint(start - 1))) start -= 1;
  return (code - start) % 10;
}

// A hotspot's number, as Python's int() reads its digits; past any safe integer, the largest number JavaScript holds.
function numberOf(digits) {
  const value = Number([...digits].map(digitValue).join(''));
  return Number.isFinite(value) ? value : Number.MAX_VALUE;
}

// The hub's domain.parse (see the top of this file).
export function readDomainPicture(documents, { ids = idFormat(), part = '' } = {}) {
  const picture = { format: 1, contexts: [], aggregates: [], read_models: [], dependencies: [], hotspots: [] };
  const checks = [];
  const partial = (file, line, why) => {
    const row = { rule: 'picture-partial', level: 'warn', message: oneLine(`${file}:${line}: ${why}`, 600), by: 'scan', stage: STAGE };
    if (part) row.part = part;
    checks.push(row);
  };
  const traceIds = (text, kind = null) => ids.find(text).filter(([, found]) => kind === null || found === kind).map(([id]) => id);

  for (const [file, whole] of documents) {
    const text = whole.replace(STRUCK, ' ');
    const lines = splitLines(text);
    const rows = tablesOf(lines);
    const glossary = new Map();
    const removed = new Set();
    for (const [, row] of rows) {
      const found = traceIds(row.id ?? '');
      if (found.length > 0 && Object.hasOwn(row, 'status') && isRemovedStatus(row.status)) for (const id of found) removed.add(id);
      if (Object.hasOwn(row, 'term')) {
        for (const id of found.filter((each) => ids.kind(each) === 'term')) {
          const word = wordOf(plain(row.term, 120));
          if (!glossary.has(word)) glossary.set(word, []);
          glossary.get(word).push(id);
        }
      }
    }

    const contexts = new Map();
    const positions = [];
    let current = null;
    let nearest = null;
    let contextLevel = 0;
    let fenced = false;
    for (const [at, line] of lines.entries()) {
      const index = at + 1;
      if (FENCE.test(line)) fenced = !fenced;
      if (fenced) continue;
      const heading = HEADING.exec(line);
      if (heading !== null) {
        const lead = ids.lead(plain(heading[2], 300));
        if (lead !== null && lead[1] === 'context') {
          const [id, , , name] = lead;
          if (!contexts.has(id)) {
            contexts.set(id, {
              id, name: plain(name, 120), type: '', purpose: '', removed: removed.has(id), external: '', rows: [], where: `${file}:${index}`,
            });
          }
          current = contexts.get(id);
          nearest = current;
          contextLevel = heading[1].length;
          positions.push([index, current, nearest]);
        } else if (current !== null && heading[1].length <= contextLevel) {
          current = null;
          positions.push([index, null, nearest]);
        }
      }
      if (current !== null) {
        const purpose = PURPOSE.exec(line);
        const external = EXTERNAL.exec(line);
        if (purpose !== null) current.purpose = plain(purpose[1], 300);
        if (external !== null) current.external = plain(external[1], 300);
      }
    }
    if (contexts.size === 0) {
      if (strip(text) !== '') partial(file, 1, 'document has no context heading');
      continue;
    }

    const aggregateDefinitions = [];
    const modelDefinitions = [];
    // The context and nearest context of the last heading at or before line. positions are in line order, so a binary
    // search finds it, and a document of many headings and many rows reads in time that grows with its length.
    const located = (line) => {
      let [low, high] = [0, positions.length];
      while (low < high) {
        const middle = (low + high) >>> 1;
        if (positions[middle][0] <= line) low = middle + 1;
        else high = middle;
      }
      return low === 0 ? [null, null] : [positions[low - 1][1], positions[low - 1][2]];
    };
    const addTerms = (target, value, context, where) => {
      // A TERM ID in parentheses belongs to the name before it, not to the next comma-separated aggregate.
      for (const name of splitBy(value, termSeparators)) {
        let clean = plain(name, 300);
        if (clean === '' || EMPTY.has(norm(clean)) || norm(clean) === 'not drawn') continue;
        const explicit = traceIds(clean, 'term');
        for (const id of explicit) clean = clean.replaceAll(id, '');
        clean = oneLine(clean.replace(EMPTY_PARENS, ''), 120);
        target.push([clean, context, explicit[0] ?? null, where]);
      }
    };

    // The contexts whose command rows name each read model, by its word, in the order of contexts: kept as rows are read,
    // so that a read model's own row finds them without scanning every command row.
    const order = new Map([...contexts.values()].map((context, index) => [context, index]));
    const usedBy = new Map();
    for (const [line, row] of rows) {
      const where = `${file}:${line}`;
      if (has(row, ['context', 'type', 'aggregates'])) {
        for (const id of traceIds(row.context, 'context')) {
          const context = contexts.get(id);
          if (context !== undefined) context.type = plain(row.type, 120);
          addTerms(aggregateDefinitions, row.aggregates, id, where);
        }
      }
      if (has(row, ['given_by', 'read_model', 'command', 'aggregate', 'events'])) {
        let [context, previous] = located(line);
        if (context === null) {
          partial(file, line, 'command table is under no context heading');
          context = previous;
          if (context === null) {
            if (!contexts.has('')) {
              contexts.set('', { id: '', name: '', type: '', purpose: '', removed: false, external: '', rows: [], where });
              order.set(contexts.get(''), order.size);
            }
            context = contexts.get('');
          }
        }
        const given = plain(row.given_by, 300);
        const events = row.events.split(',').filter((each) => strip(each) !== '')
          .map((each) => plain(strip(each).replace(OR_LEAD, ''), 120));
        context.rows.push({
          given_by: given, policy: POLICY.test(given), read_model: plain(row.read_model, 120), command: plain(row.command, 120),
          aggregate: plain(row.aggregate, 120), events: events.slice(0, 20), where,
        });
        const model = wordOf(context.rows.at(-1).read_model);
        if (!usedBy.has(model)) usedBy.set(model, new Set());
        usedBy.get(model).add(context);
        addTerms(aggregateDefinitions, row.aggregate, context.id, where);
        addTerms(modelDefinitions, row.read_model, context.id, where);
      }
      if (has(row, ['read_model', 'shows'])) {
        const name = wordOf(plain(row.read_model, 120));
        const used = [...(usedBy.get(name) ?? [])].sort((a, b) => order.get(a) - order.get(b));
        for (const context of used) addTerms(modelDefinitions, row.read_model, context.id, where);
      }
      if (has(row, ['from', 'to', 'kind', 'why', 'data'])) {
        const kind = casefold(plain(row.kind, 120));
        picture.dependencies.push({
          from: plain(row.from, 120), to: plain(row.to, 120),
          kind: ['call', '바로 묻기'].some((start) => kind.startsWith(start)) ? 'call' : ['event', '사건 알림'].some((start) => kind.startsWith(start)) ? 'event' : '',
          why: plain(row.why, 300), data: plain(row.data, 300), where,
        });
      }
      if (has(row, ['hotspot', 'context', 'state', 'answer'])) {
        const words = plain(row.hotspot, 300);
        const hotspot = {
          text: words, contexts: traceIds(row.context, 'context').slice(0, 20), state: plain(row.state, 120), answer: plain(row.answer, 300), where,
        };
        const numbered = NUMBERED.exec(words);
        if (numbered !== null) {
          const number = numberOf(numbered[1]);
          if (number > 0) hotspot.number = number;
        }
        picture.hotspots.push(hotspot);
      }
      if (has(row, ['lane', 'events'])) {
        const places = [];
        for (const place of splitBy(row.events, arrows).slice(0, 200)) {
          const cleaned = splitBy(place, ors).map((each) => plain(each, 120)).filter((each) => each !== '').slice(0, 10);
          if (cleaned.length > 0) places.push(cleaned);
        }
        picture.timeline ??= [];
        picture.timeline.push({ lane: plain(row.lane, 120), places, where });
      }
    }

    picture.contexts.push(...contexts.values());
    for (const [target, definitions] of [['aggregates', aggregateDefinitions], ['read_models', modelDefinitions]]) {
      const seen = new Set();
      for (const [name, context, explicit, where] of definitions) {
        const key = JSON.stringify([context, wordOf(name)]);
        if (seen.has(key)) continue;
        seen.add(key);
        const candidates = explicit !== null ? [explicit] : glossary.get(wordOf(name)) ?? [];
        const row = { name, context, removed: candidates.length > 0 && removed.has(candidates[0]), where };
        if (candidates.length > 0) row.term = candidates[0];
        if (candidates.length !== 1) {
          const warning = {
            rule: 'board-term-missing', level: 'warn', message: oneLine(`${name} has ${candidates.length > 0 ? 'multiple' : 'no'} glossary terms`, 600),
            by: 'scan', stage: STAGE,
          };
          if (context) warning.refs = [context];
          warning.args = { name, context };
          if (part) warning.part = part;
          checks.push(warning);
        }
        picture[target].push(row);
      }
    }
  }

  for (const [key, limit] of LIMITS) {
    if (Object.hasOwn(picture, key) && picture[key].length > limit) {
      picture[key] = picture[key].slice(0, limit);
      partial(documents.at(-1)[0], 1, `${key} exceeds its picture limit`);
    }
  }
  for (const context of picture.contexts) {
    if (context.rows.length > MAX_ROWS) partial(context.where.slice(0, context.where.lastIndexOf(':')), 1, 'context rows exceed their picture limit');
    context.rows = context.rows.slice(0, MAX_ROWS);
  }
  return { picture: picture.contexts.length > 0 ? picture : null, checks };
}
