// The stage-05 picture of a proposal's SQL (TASK-466; SPEC-004, SPEC-018): NEXUS reads source_text as the pinned hub
// reads a schema file, so that the ERD drawer (erd.js) draws a proposal's schema as it draws the hub's picture of the
// project's. It is a port of the hub's erd.py and of the SQL reader in its hub.py (sql_reading, sql_statements,
// sql_name, sql_string, sql_arguments and sql_about) at the commit of hub-ref.json, with picture-text.js's helpers.
// server/test/picture-cases.json holds the hub's own pictures of the cases this repository's schema does not show, and
// erd-picture.json its picture of db/nexus.sql; test/picture-readers.test.js reads both here.
//
// readSqlPicture(documents, { ids, part }) takes [file, text] pairs and returns { picture, checks }:
// - picture is the hub's format 1, { format: 1, tables: [table], without_table: [TERM ID] }, each table
//   { id, name, context, removed, columns: [{ name, type, null, where }], primary_key, unique: [{ columns, partial }],
//   foreign_keys: [{ columns, table, references, on_delete, where }], where, terms? };
// - checks are the hub's picture-partial checks, { rule, level, message, by, stage, part? }, one for each statement or
//   rule it leaves out, which drawing.js's pictureWarnings turns into the drawer's warnings.
// - ids is picture-text.js's idFormat.
// - known, for a proposal on a drawing read from several files (TASK-470), is the tables the drawing's other files
//   created, as their picture has them: a table this text alters, gives a unique index or names only by its name is
//   found among them as among the text's own, as the hub reads every file's statements against every file's tables,
//   and its foreign keys and unique rules join that table in place. They are not in the picture returned, and a
//   comment this text gives one of them is not read, since their pictures keep the comments they were drawn with.
//
// It reads what the hub reads: CREATE TABLE with its columns, keys, unique rules and foreign keys; ALTER TABLE's
// foreign keys; CREATE UNIQUE INDEX on named columns; and a table's comment, as a -- line before it, COMMENT after its
// columns, COMMENT ON TABLE or SQL Server's MS_Description property. A table comment that starts with a TBL ID gives
// the table its trace ID, its CTX ID its context, its TERM IDs its terms, and a removed word its removed mark. Any other
// statement, a view, an insert, a drop, a check or an index that is not unique, is passed over, as the hub passes it.
// A backslash in a quoted string is read as an escape only when that leaves fewer line breaks in the strings, as the
// hub reads it.
//
// Nothing here logs; the text is read and never kept (rule 5).

import { casefold, idFormat, isRemovedStatus, isSpace, lstrip, norm, oneLine, REMOVED, SPACE, splitLines, strip, WORD } from './picture-text.js';

const CONSTRAINT_WORDS = new Set(['NOT', 'NULL', 'PRIMARY', 'UNIQUE', 'REFERENCES', 'CHECK', 'DEFAULT', 'COLLATE', 'GENERATED', 'CONSTRAINT',
  'COMMENT', 'AUTO_INCREMENT', 'IDENTITY']);
const STAGE = '05-erd';

// The hub's SQL_READINGS: one SQL token, a comment, a string (also N'…', E'…' and $tag$…$tag$), a name (also quoted),
// a number or a mark. In the first reading a backslash in '…' escapes the next character, as in MySQL; in the second it
// is a character, as in PostgreSQL. E'…' always escapes.
//
// The hub's name in brackets, [name], is left out of the pattern: tried at each [ of a long line that has no ] it would
// take time that grows with the square of the line's length. tokensOf reads it instead, with the same result: at a [
// no comment, string or other name can start, so the hub's pattern takes [ to the first ] when no line feed comes
// before it, and else takes the [ alone as a mark.
const readingOf = (quoted) => new RegExp(
  `(?<comment>--[^\\n]*|#(?![^${SPACE}])[^\\n]*|/\\*.*?(?:\\*/|$))`
  + `|(?<string>[Ee]'(?:[^'\\\\]|''|\\\\.)*(?:'|$)|[Nn]?'(?:${quoted})*(?:'|$)`
  + `|\\$(?<tag>[A-Za-z_][${WORD}]*|)\\$.*?(?:\\$\\k<tag>\\$|$))`
  + `|(?<name>"(?:[^"]|"")*(?:"|$)|\`(?:[^\`]|\`\`)*(?:\`|$)|[A-Za-z_@][${WORD}$@#]*)`
  + '|(?<number>[0-9]+(?:\\.[0-9]+)?)'
  + `|(?<mark>[^${SPACE}])`,
  'gsu',
);
const ESCAPED = Object.freeze({ escapes: true, source: readingOf(String.raw`[^'\\]|''|\\.`) });
const PLAIN = Object.freeze({ escapes: false, source: readingOf("[^']|''") });
const GROUPS = ['comment', 'string', 'name', 'number', 'mark'];
const SQL_ESCAPE = /''|\\(.)/gsu;
const SQL_ESCAPES = new Map([['n', '\n'], ['r', '\r'], ['t', '\t']]);
// A line that ends a statement: SQL Server's GO or Oracle's /.
const SQL_END_LINE = new RegExp(`^[${SPACE}]*(?:GO(?:[${SPACE}]+\\p{Nd}+)?|/)[${SPACE}]*(?:--.*)?$`, 'iu');
const SQL_EXTENDED_PROPERTY = Object.freeze(['sp_addextendedproperty', 'sp_updateextendedproperty']);
const SQL_PROPERTY_ARGS = Object.freeze(['name', 'value', 'level0type', 'level0name', 'level1type', 'level1name', 'level2type', 'level2name']);

// Each token of a reading, { group, text, start, end }, as the hub's pattern finds them. The next ] and the next line
// feed are looked for only past the last ones found, so that each part of the text is looked at once.
function* tokensOf(reading, text) {
  const pattern = new RegExp(reading.source, reading.flags);
  let close = -1;
  let feed = -1;
  const after = (character, place) => {
    const found = text.indexOf(character, place);
    return found === -1 ? Infinity : found;
  };
  for (let found = pattern.exec(text); found !== null; found = pattern.exec(text)) {
    const start = found.index;
    let group = GROUPS.find((name) => found.groups[name] !== undefined);
    let value = found[0];
    if (group === 'mark' && value === '[') {
      if (close <= start) close = after(']', start + 1);
      if (feed <= start) feed = after('\n', start + 1);
      if (close < feed) {
        group = 'name';
        value = text.slice(start, close + 1);
        pattern.lastIndex = close + 1;
      }
    }
    yield { group, text: value, start, end: start + value.length };
  }
}

// The hub's sql_reading: the reading that leaves fewer line breaks in the strings, then fewer strings.
function readingFor(text) {
  const spread = (reading) => {
    let breaks = 0;
    let strings = 0;
    for (const token of tokensOf(reading.source, text)) {
      if (token.group !== 'string') continue;
      strings += 1;
      breaks += token.text.split('\n').length - 1;
    }
    return [breaks, strings];
  };
  if (text.includes("\\'")) {
    const [a, b] = [spread(ESCAPED), spread(PLAIN)];
    if (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])) return ESCAPED;
  }
  return PLAIN;
}

// The hub's sql_string: the value of a string token.
function stringValue(value, escapes) {
  if (value.startsWith('$')) {
    const tag = value.slice(0, value.indexOf('$', 1) + 1);
    const body = value.slice(tag.length);
    return body.length >= tag.length && body.endsWith(tag) ? body.slice(0, body.length - tag.length) : body;
  }
  const escaping = escapes || 'Ee'.includes(value[0]);
  const rest = 'NnEe'.includes(value[0]) ? value.slice(1) : value;
  const body = rest.length >= 2 && rest.endsWith("'") ? rest.slice(1, -1) : rest.slice(1);
  if (!escaping) return body.replaceAll("''", "'");
  return body.replace(SQL_ESCAPE, (_, escaped) => (escaped === undefined ? "'" : SQL_ESCAPES.get(escaped) ?? escaped));
}

// The number of the line a place in text is on, from 1, as the hub's bisect over its lines' starts finds it.
function liner(text) {
  const starts = [];
  let offset = 0;
  for (const piece of splitLines(text, true)) {
    starts.push(offset);
    offset += piece.length;
  }
  return (at) => {
    let low = 0;
    let high = starts.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (starts[middle] <= at) low = middle + 1;
      else high = middle;
    }
    return low;
  };
}

// The hub's sql_statements: the statements of an SQL text, each a list of tokens [group, text, line, depth, last line],
// a string's text its value. A statement ends at ; or at a GO or / line; the comments before a statement belong to it,
// and a comment on the line where a statement ends belongs to that statement.
export function sqlStatements(text) {
  const lineOf = liner(text);
  const endLines = new Set();
  splitLines(text).forEach((line, index) => {
    if (SQL_END_LINE.test(line)) endLines.add(index + 1);
  });
  const reading = readingFor(text);
  const statements = [];
  let tokens = [];
  let depth = 0;
  let ended = null;
  for (const { group, text: value, start, end } of tokensOf(reading.source, text)) {
    const line = lineOf(start);
    const token = [group, group === 'string' ? stringValue(value, reading.escapes) : value, line, depth, lineOf(end - 1)];
    if (group === 'comment' && tokens.length === 0 && line === ended) {
      statements.at(-1).push(token);
    } else if (tokens.length === 0 && line === ended && endLines.has(line)) {
      // the count of GO 2
    } else if (group === 'mark' && value === '(') {
      tokens.push(token);
      depth += 1;
    } else if (group === 'mark' && value === ')') {
      tokens.push(token);
      depth = Math.max(depth - 1, 0);
    } else {
      tokens.push(token);
      const onEndLine = endLines.has(line) && ((group === 'name' && value.toUpperCase() === 'GO') || (group === 'mark' && value === '/'));
      if ((group === 'mark' && value === ';') || onEndLine) {
        statements.push(tokens);
        tokens = [];
        depth = 0;
        ended = line;
      }
    }
  }
  if (tokens.length > 0) statements.push(tokens);
  return statements;
}

// The hub's sql_name: a name without its quotes.
export function sqlName(value) {
  const ends = value.length >= 2 ? value[0] + value.at(-1) : '';
  if (ends === '""' || ends === '``') return value.slice(1, -1).replaceAll(value[0].repeat(2), value[0]);
  if (ends === '[]') return value.slice(1, -1);
  return value;
}

// The words of tokens: a name in upper case, any other token as it is.
const wordsOf = (tokens) => tokens.map((token) => (token[0] === 'name' ? token[1].toUpperCase() : token[1]));
const sameWords = (words, from, expected) => expected.every((word, index) => words[from + index] === word) && from + expected.length <= words.length;
const startsWith = (words, expected) => sameWords(words, 0, expected);

// The hub's sql_arguments: the string arguments of a procedure call as a Map of name to [text, line], by place or by
// @name.
function sqlArguments(code) {
  const args = new Map();
  let position = 0;
  let argument = [];
  for (const token of [...code, ['mark', ',', 0, 0, 0]]) {
    if (!(token[0] === 'mark' && token[1] === ',')) {
      argument.push(token);
      continue;
    }
    let key = null;
    let value = null;
    if (argument.length >= 3 && argument[0][1].startsWith('@') && argument[1][1] === '=') {
      [key, value] = [argument[0][1].slice(1).toLowerCase(), argument[2]];
    } else if (argument.length > 0 && position < SQL_PROPERTY_ARGS.length) {
      [key, value] = [SQL_PROPERTY_ARGS[position], argument[0]];
      position += 1;
    }
    if (key && value[0] === 'string') args.set(key, [value[1], value[2]]);
    argument = [];
  }
  return args;
}

// The hub's sql_about: { key, name, creates, comment } of a statement, the table it is about by its key, a
// { schema, name, id } in folded case, and its name; whether it creates the table; and the table's own comment in it,
// [text, line]. null when it is about no table.
function sqlAbout(tokens) {
  const code = tokens.filter((token) => token[0] !== 'comment');
  const words = wordsOf(code);
  const nameAt = (from) => {
    const parts = [];
    let index = from;
    while (index < code.length && code[index][0] === 'name') {
      parts.push(sqlName(code[index][1]));
      index += 1;
      if (words[index] !== '.') break;
      index += 1;
    }
    return [parts, index];
  };
  const stringAt = (index) => (index < code.length && code[index][0] === 'string' ? [code[index][1], code[index][2]] : null);

  let table = [];
  let creates = false;
  let comment = null;
  if (words[0] === 'CREATE') {
    let place = null;
    for (let k = 1; k < Math.min(words.length, 7); k += 1) {
      if (words[k] === 'TABLE') {
        place = k;
        break;
      }
    }
    let named = place !== null;
    for (let k = 1; named && k < place; k += 1) named = code[k][0] === 'name';
    if (named) {
      let index = place + 1;
      if (sameWords(words, index, ['IF', 'NOT', 'EXISTS'])) index += 3;
      [table, index] = nameAt(index);
      creates = true;
      // MySQL, MariaDB, Snowflake and Databricks keep the table's comment after its columns.
      for (let k = index; k < code.length; k += 1) {
        if (words[k] === 'COMMENT' && code[k][3] === 0) {
          comment = stringAt(words[k + 1] === '=' ? k + 2 : k + 1);
          break;
        }
      }
    } else if (words.slice(1, 4).includes('INDEX') && words.includes('ON')) {
      const index = words.indexOf('ON') + 1;
      [table] = nameAt(words[index] === 'ONLY' ? index + 1 : index);
    }
  } else if (startsWith(words, ['ALTER', 'TABLE'])) {
    const index = sameWords(words, 2, ['IF', 'EXISTS']) ? 4 : 2;
    [table] = nameAt(words[index] === 'ONLY' ? index + 1 : index);
  } else if (startsWith(words, ['COMMENT', 'ON', 'TABLE'])) {
    let index;
    [table, index] = nameAt(3);
    if (words[index] === 'IS') comment = stringAt(index + 1);
  } else if (startsWith(words, ['COMMENT', 'ON', 'COLUMN'])) {
    table = nameAt(3)[0].slice(0, -1);
  } else if (words[0] === 'EXEC' || words[0] === 'EXECUTE') {
    const [parts, index] = nameAt(1);
    if (parts.length > 0 && SQL_EXTENDED_PROPERTY.includes(parts.at(-1).toLowerCase())) {
      // SQL Server keeps comments as MS_Description properties of a table or its columns.
      const args = sqlArguments(code.slice(index));
      const kind = (key) => (args.has(key) ? args.get(key)[0].toLowerCase() : undefined);
      if (kind('name') === 'ms_description' && kind('level1type') === 'table' && args.has('level1name')) {
        const schema = kind('level0type') === 'schema' && args.has('level0name') ? [args.get('level0name')[0]] : [];
        table = [...schema, args.get('level1name')[0]];
        if (!kind('level2type')) comment = args.get('value') ?? null;
      }
    }
  }
  if (table.length === 0) return null;
  const schema = table.length > 1 ? casefold(table.at(-2)) : null;
  const folded = casefold(table.at(-1));
  return { key: { schema, name: folded, id: JSON.stringify([schema, folded]) }, name: table.at(-1), creates, comment };
}

// The hub's groups: the comma-separated expressions of tokens at one parenthesis depth.
function groups(tokens, level) {
  const result = [];
  let current = [];
  for (const token of tokens) {
    if (token[1] === ',' && token[3] === level) {
      if (current.length > 0) result.push(current);
      current = [];
    } else {
      current.push(token);
    }
  }
  if (current.length > 0) result.push(current);
  return result;
}

// The hub's inside_parens: the tokens inside the first parenthesis from start, and the place after it.
function insideParens(tokens, start) {
  let opening = null;
  for (let i = start; i < tokens.length; i += 1) {
    if (tokens[i][1] === '(') {
      opening = i;
      break;
    }
  }
  if (opening === null) return [[], tokens.length];
  const level = tokens[opening][3];
  let closing = tokens.length;
  for (let i = opening + 1; i < tokens.length; i += 1) {
    if (tokens[i][1] === ')' && tokens[i][3] === level + 1) {
      closing = i;
      break;
    }
  }
  return [tokens.slice(opening + 1, closing), closing + 1];
}

const unique = (values) => [...new Set(values)];

// The hub's names: the names that lead the comma-separated groups of tokens, up to 50.
const names = (tokens) => groups(tokens, tokens.length > 0 ? tokens[0][3] : 1)
  .filter((group) => group.length > 0 && group[0][0] === 'name')
  .map((group) => oneLine(sqlName(group[0][1]), 120))
  .slice(0, 50);

// The hub's index_columns: the columns of a unique index when each is a name the table has, known, its columns' names
// in folded case; else null.
function indexColumns(tokens, known) {
  const result = [];
  for (const group of groups(tokens, tokens.length > 0 ? tokens[0][3] : 1)) {
    if (group.length === 0 || group[0][0] !== 'name') return null;
    const name = oneLine(sqlName(group[0][1]), 120);
    if (!known.has(casefold(name))) return null;
    let tail = wordsOf(group.slice(1));
    if (tail[0] === 'COLLATE' && group.length > 2 && group[2][0] === 'name') tail = tail.slice(2);
    if (tail.length > 0 && (tail[0] === 'ASC' || tail[0] === 'DESC')) tail = tail.slice(1);
    if (tail.length === 2 && tail[0] === 'NULLS' && (tail[1] === 'FIRST' || tail[1] === 'LAST')) tail = [];
    if (tail.length > 0) return null;
    result.push(name);
  }
  return result.length > 0 ? result.slice(0, 50) : null;
}

const STATUS_FIELD = new RegExp(`^[${SPACE}]*(?:status|상태)[${SPACE}]*:`, 'iu');

// The value of a status: field, as the hub's re.match(r"\s*(?:status|상태)\s*:\s*(.*)$", field, re.I) gives it, or
// null. Python's . takes any character but a line feed, and its $ also matches before a last line feed; the value is
// found by its ends rather than by such a pattern, which would try each place in a long run of spaces.
function statusOf(field) {
  const head = STATUS_FIELD.exec(field);
  if (head === null) return null;
  const rest = lstrip(field.slice(head[0].length));
  const feed = rest.indexOf('\n');
  if (feed === -1) return rest;
  return feed === rest.length - 1 ? rest.slice(0, feed) : null;
}

// The hub's removed_status: whether a table's comment marks it removed, by a status: field or a removed word among the
// fields after ( or |. Delimiters inside quotes are ordinary characters.
function removedStatus(comment) {
  const characters = [...comment];
  const fields = [];
  let current = [];
  let quoted = null;
  let collecting = false;
  let index = 0;
  while (index < characters.length) {
    const character = characters[index];
    if (quoted !== null) {
      if (collecting) current.push(character);
      if (character === quoted) {
        if (index + 1 < characters.length && characters[index + 1] === quoted) {
          if (collecting) current.push(characters[index + 1]);
          index += 2;
          continue;
        }
        quoted = null;
      }
    } else if ('"\'`['.includes(character) && (index === 0 || isSpace(characters[index - 1]) || '(|,;:.'.includes(characters[index - 1]))) {
      quoted = character === '[' ? ']' : character;
      if (collecting) current.push(character);
    } else if ('(|),;'.includes(character)) {
      if (collecting) {
        fields.push(current.join(''));
        current = [];
      }
      if (character === '(' || character === '|') collecting = true;
      else if (character === ')') collecting = false;
    } else if (collecting) {
      current.push(character);
    }
    index += 1;
  }
  if (collecting) fields.push(current.join(''));
  for (const field of fields) {
    const status = statusOf(field);
    if (status !== null) return isRemovedStatus(status);
  }
  return fields.some((field) => REMOVED.has(norm(field)));
}

// The hub's patterns, each starting only where a run of white space starts: a match that starts inside a run would also
// start where the run starts, and tried at each place in a long run the patterns would take time that grows with the
// square of its length.
const AROUND_MARK = new RegExp(`(?<![${SPACE}])[${SPACE}]*([(.])[${SPACE}]*`, 'gu');
const BEFORE_CLOSE = new RegExp(`(?<![${SPACE}])[${SPACE}]*\\)`, 'gu');
const AROUND_COMMA = new RegExp(`(?<![${SPACE}])[${SPACE}]*,[${SPACE}]*`, 'gu');

// The hub's type_text: a column's type as written, on one line.
function typeText(tokens) {
  let value = tokens.map((token) => (token[0] === 'string' ? `'${token[1].replaceAll("'", "''")}'` : token[1])).join(' ');
  value = value.replace(AROUND_MARK, '$1').replace(BEFORE_CLOSE, ')').replace(AROUND_COMMA, ', ');
  return oneLine(value, 120);
}

const DELETIONS = Object.freeze(['set null', 'set default', 'no action', 'cascade', 'restrict']);

// The hub's foreign_key: a foreign key of tokens, a table rule (FOREIGN KEY (…) REFERENCES …) or, with columns, a
// column's REFERENCES; null when it has none.
function foreignKey(tokens, file, columns = null) {
  const words = wordsOf(tokens);
  const reference = words.indexOf('REFERENCES');
  if (reference === -1) return null;
  let local = columns;
  if (local === null) {
    let index = -1;
    for (let i = 0; i < reference; i += 1) {
      if (words[i] === 'FOREIGN' && words[i + 1] === 'KEY') {
        index = i;
        break;
      }
    }
    if (index === -1) return null;
    local = names(insideParens(tokens, index + 2)[0]);
  }
  let target = reference + 1;
  const targetNames = [];
  while (target < tokens.length && tokens[target][0] === 'name') {
    targetNames.push(sqlName(tokens[target][1]));
    target += 1;
    if (target < tokens.length && tokens[target][1] === '.') target += 1;
    else break;
  }
  const refs = target < tokens.length && tokens[target][1] === '(' ? insideParens(tokens, target)[0] : [];
  let deletion = '';
  for (let i = reference; i < words.length - 2; i += 1) {
    if (words[i] === 'ON' && words[i + 1] === 'DELETE') {
      const option = words.slice(i + 2, i + 4).join(' ').toLowerCase();
      deletion = DELETIONS.find((each) => option.startsWith(each)) ?? '';
      break;
    }
  }
  if (local.length === 0 || targetNames.length === 0) return null;
  return {
    columns: local.slice(0, 50), table: oneLine(targetNames.at(-1), 120), references: names(refs), on_delete: deletion,
    where: `${file}:${tokens[reference][2]}`,
  };
}

// Python's re.IGNORECASE also takes İ and ı for i, which JavaScript's does not.
const WITHOUT_TABLE = new RegExp(`^w[iİı]thout a table[${SPACE}]*:[${SPACE}]*([^\n]*)`, 'iu');
const TERMS_NONE = new RegExp(`(?<![${WORD}])terms[${SPACE}]*:[${SPACE}]*none(?![${WORD}])`, 'iu');
const MAX_TABLES = 500;

// The hub's erd.parse (see the top of this file).
export function readSqlPicture(documents, { ids = idFormat(), part = '', known: others = [] } = {}) {
  const picture = { format: 1, tables: [], without_table: [] };
  const checks = [];
  const made = new Map();
  // The other files' tables, each by the key its unqualified name gives; tables that share a name, whose schemas their
  // pictures do not keep, each by a key no statement has, so that the name alone finds none of them.
  const shared = new Map();
  for (const table of others) shared.set(casefold(table.name), (shared.get(casefold(table.name)) ?? 0) + 1);
  for (const [index, table] of others.entries()) {
    const name = casefold(table.name);
    const id = shared.get(name) === 1 ? JSON.stringify([null, name]) : JSON.stringify(['', index]);
    made.set(id, { key: { schema: null, name, id }, table });
  }
  const statements = [];
  const annotations = new Map();
  const issue = (file, line, detail) => {
    const row = { rule: 'picture-partial', level: 'warn', message: oneLine(`${file}:${line}: ${detail}`, 600), by: 'scan', stage: STAGE };
    if (part) row.part = part;
    checks.push(row);
  };
  const terms = (text, kind) => ids.find(text).filter(([, found]) => found === kind).map(([id]) => id);

  for (const [file, text] of documents) {
    for (const tokens of sqlStatements(text)) {
      const about = sqlAbout(tokens);
      const comments = tokens
        .filter((token) => token[0] === 'comment' && token[1].startsWith('--') && token[3] === 0)
        .map((token) => [strip(token[1].slice(2)), token[2]]);
      for (const [comment] of comments) {
        const marker = WITHOUT_TABLE.exec(comment);
        if (marker !== null) {
          for (const term of terms(marker[1], 'term')) picture.without_table.push(term);
        }
      }
      if (about === null) continue;
      if (about.comment !== null) comments.push(about.comment);
      for (const [comment, line] of comments) {
        const lead = ids.lead(comment);
        if (lead !== null && lead[1] === 'table') annotations.set(about.key.id, [lead[0], comment, line]);
      }
      const code = tokens.filter((token) => token[0] !== 'comment');
      statements.push({ file, code, about });
      if (about.creates) made.set(about.key.id, { key: about.key, table: null });
    }
  }

  // The key a statement's table has among the created tables: its own, or the one created table of its name.
  const named = new Map();
  for (const { key } of made.values()) named.set(key.name, named.has(key.name) ? null : key);
  const keyFor = (key) => (made.has(key.id) ? key : named.get(key.name) ?? key);
  // Each table's columns' names in folded case, made once for the unique indexes on it.
  const known = new Map();

  for (const { file, code, about } of statements) {
    if (!about.creates) continue;
    const { key } = about;
    const annotation = annotations.get(key.id) ?? annotations.get(keyFor(key).id);
    const [ident, comment, line] = annotation ?? ['', '', code[0][2]];
    const table = {
      id: ident, name: oneLine(about.name, 120), context: terms(comment, 'context')[0] ?? '', removed: removedStatus(comment),
      columns: [], primary_key: [], unique: [], foreign_keys: [], where: `${file}:${line}`,
    };
    const tableTerms = terms(comment, 'term');
    if (tableTerms.length > 0 || TERMS_NONE.test(comment)) table.terms = unique(tableTerms).slice(0, 20);
    const [body] = insideParens(code, 0);
    if (body.length === 0) issue(file, code[0][2], 'CREATE TABLE has no readable column list');
    for (let expression of groups(body, 1)) {
      let words = wordsOf(expression);
      if (words[0] === 'CONSTRAINT') [expression, words] = [expression.slice(2), words.slice(2)];
      if (expression.length === 0) continue;
      if (startsWith(words, ['PRIMARY', 'KEY'])) {
        table.primary_key.push(...names(insideParens(expression, 2)[0]));
      } else if (words[0] === 'UNIQUE') {
        const [columns] = insideParens(expression, 1);
        if (columns.length > 0) table.unique.push({ columns: names(columns), partial: false });
      } else if (startsWith(words, ['FOREIGN', 'KEY'])) {
        const foreign = foreignKey(expression, file);
        if (foreign !== null) table.foreign_keys.push(foreign);
      } else if (!['CHECK', 'KEY', 'INDEX', 'EXCLUDE', 'LIKE'].includes(words[0]) && expression[0][0] === 'name') {
        const name = oneLine(sqlName(expression[0][1]), 120);
        let endType = expression.length;
        for (let i = 1; i < expression.length; i += 1) {
          if (expression[i][3] === 1 && CONSTRAINT_WORDS.has(words[i])) {
            endType = i;
            break;
          }
        }
        const pair = (first, second) => words.some((word, i) => i < words.length - 1 && word === first && words[i + 1] === second);
        const primary = pair('PRIMARY', 'KEY');
        table.columns.push({ name, type: typeText(expression.slice(1, endType)), null: !(pair('NOT', 'NULL') || primary), where: `${file}:${expression[0][2]}` });
        if (primary) table.primary_key.push(name);
        if (words.includes('UNIQUE')) table.unique.push({ columns: [name], partial: false });
        const foreign = foreignKey(expression, file, [name]);
        if (foreign !== null) table.foreign_keys.push(foreign);
      }
    }
    made.set(key.id, { key, table });
    picture.tables.push(table);
  }

  for (const { file, code, about } of statements) {
    const table = made.get(keyFor(about.key).id)?.table;
    if (!table || about.creates) continue;
    const words = wordsOf(code);
    if (startsWith(words, ['ALTER', 'TABLE'])) {
      for (const action of groups(code, 0)) {
        const foreign = foreignKey(action, file);
        if (foreign !== null) table.foreign_keys.push(foreign);
      }
    } else if (words[0] === 'CREATE' && words.slice(0, 4).includes('UNIQUE') && words.slice(0, 5).includes('INDEX') && words.includes('ON')) {
      const [columns] = insideParens(code, words.indexOf('ON') + 1);
      if (columns.length > 0) {
        if (!known.has(table)) known.set(table, new Set(table.columns.map((column) => casefold(column.name))));
        const indexed = indexColumns(columns, known.get(table));
        if (indexed !== null) table.unique.push({ columns: indexed, partial: words.includes('WHERE') });
        else issue(file, code[0][2], 'unique index has an unreadable column expression; rule omitted');
      }
    }
  }
  for (const table of picture.tables) {
    table.primary_key = unique(table.primary_key).slice(0, 50);
    for (const column of table.columns) {
      if (table.primary_key.includes(column.name)) column.null = false;
    }
    for (const [key, limit] of [['columns', 300], ['unique', 50], ['foreign_keys', 100]]) {
      if (table[key].length > limit) {
        issue(table.where.slice(0, table.where.lastIndexOf(':')), 1, `${key} exceeds its picture limit`);
        table[key] = table[key].slice(0, limit);
      }
    }
  }
  if (picture.tables.length > MAX_TABLES) {
    issue(documents.at(-1)[0], 1, `more than ${MAX_TABLES} tables; later tables are omitted`);
    picture.tables = picture.tables.slice(0, MAX_TABLES);
  }
  picture.without_table = unique(picture.without_table).slice(0, 500);
  return { picture, checks };
}
