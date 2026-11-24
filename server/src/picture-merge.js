// A proposal's picture of one file of a stage-01, 05 or 07 drawing (TASK-470; SPEC-018): NEXUS keeps the hub's parsed
// picture of a push, not the files it read (snapshot.js), so a proposal's source_text, the whole proposed text of the
// file its source_path names, is read alone and put in place of what that file gave the drawing's picture, the
// picture as the hub sent it. Every entry of those pictures names its file in its where, such as db/nexus.sql:41.
//
// mergePicture(stage, current, file, text, { ids, part }) returns { picture, checks, failure }, as the stage's reader
// returns them for the text alone (domain-picture.js, sql-picture.js, sitemap-picture.js), but with picture the
// drawing's picture less every entry of file and with the text's own, in the hub's order:
// - The hub reads a stage's files in the order of their paths, compared by code point, and lists each file's entries
//   after the entries of the files before it. So the entries keep their order, and those of file go where its path's
//   order puts them.
// - Stages 01 and 07 read each file on its own, so this is the hub's picture of the stage with the one file changed.
//   A screen's parent is its place in the list, so each one is counted again.
// - Stage 05 reads every file's statements against every file's tables. So a foreign key that file's ALTER TABLE gave
//   a table of another file goes with file's old text, the text is read with the other files' tables known, so that
//   its ALTER TABLE and unique indexes reach them, and a foreign key that another file's ALTER TABLE gave one of file's
//   tables stays on the table of that name in the text, the last one when the text creates several, after the text's
//   own foreign keys, where the hub orders them by statement. A comment that one file gives a table of another file is
//   not read again, since a picture does not say where a table's comment comes from, and a unique rule one file gives
//   a table of another stays, since it names no file. A picture keeps a table's name without its schema, so when other
//   files create two tables of one name, the text's statements reach neither, though the hub reaches the one a schema
//   names. None of these makes a change.
// - The terms without a table or a screen, which no drawing shows, are the picture's and the text's together.
// - The picture's limits then apply again, with the hub's picture-partial checks for them: 500 tables, and a table's
//   300 columns, 50 unique rules and 100 foreign keys; 500 screens; and stage 01's limits (domain-picture.js).
//   What the hub left out of the picture for its limits is not known, so it stays out.
//
// Nothing here logs; the text is read and never kept (rule 5).

import { readDomainPicture } from './domain-picture.js';
import { casefold, oneLine } from './picture-text.js';
import { readSitemapPicture } from './sitemap-picture.js';
import { readSqlPicture } from './sql-picture.js';

// The file of an entry's where, a repository path and its line, such as db/nexus.sql:41; null for none.
const LINED = /^(.+):[0-9]+$/su;
export function fileOf(where) {
  if (typeof where !== 'string' || where === '') return null;
  return LINED.exec(where)?.[1] ?? where;
}

// Two paths in the order Python sorts them: by code point, where JavaScript's < compares UTF-16 units.
export function byCodePoint(a, b) {
  const left = [...a];
  const right = [...b];
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const difference = left[index].codePointAt(0) - right[index].codePointAt(0);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const listOf = (picture, key) => (isObject(picture) && Array.isArray(picture[key]) ? picture[key] : []);
const unique = (values) => [...new Set(values)];

// The entries of a list in the order of their files, each file's in its own order; an entry with no file first.
function inFileOrder(entries) {
  return entries
    .map((entry, index) => [entry, index, fileOf(entry?.where) ?? ''])
    .sort(([, a, x], [, b, y]) => byCodePoint(x, y) || a - b)
    .map(([entry]) => entry);
}

// The hub's picture-partial check of a stage.
function partial(stage, part, file, line, detail) {
  const row = { rule: 'picture-partial', level: 'warn', message: oneLine(`${file}:${line}: ${detail}`, 600), by: 'scan', stage };
  if (part) row.part = part;
  return row;
}

const DOMAIN_LISTS = Object.freeze([['contexts', 200], ['aggregates', 500], ['read_models', 500], ['dependencies', 500], ['hotspots', 500], ['timeline', 50]]);

function mergeDomain(current, file, read, part, checks) {
  const picture = { format: 1 };
  // The hub names its last file in a limit's check: the last, by path, that the picture or the text names.
  const files = DOMAIN_LISTS.flatMap(([key]) => listOf(current, key).map((entry) => fileOf(entry?.where) ?? ''));
  const last = [...files, file].reduce((a, b) => (byCodePoint(a, b) >= 0 ? a : b));
  for (const [key, limit] of DOMAIN_LISTS) {
    let entries = inFileOrder([...listOf(current, key).filter((entry) => fileOf(entry?.where) !== file), ...(read[key] ?? [])]);
    // The hub gives a timeline only when a file has a lane.
    if (key === 'timeline' && entries.length === 0) continue;
    if (entries.length > limit) {
      entries = entries.slice(0, limit);
      checks.push(partial('01-domain', part, last, 1, `${key} exceeds its picture limit`));
    }
    picture[key] = entries;
  }
  return picture;
}

const TABLE_LIMITS = Object.freeze([['columns', 300], ['unique', 50], ['foreign_keys', 100]]);
const MAX_TABLES = 500;
// The parts of a table the SQL reader adds to when a statement of the text reaches it.
const READABLE_TABLE = (table) => isObject(table) && typeof table.name === 'string' && Array.isArray(table.columns)
  && Array.isArray(table.unique) && Array.isArray(table.foreign_keys);

function mergeSql(current, file, text, { ids, part }) {
  const tables = listOf(current, 'tables');
  const others = tables.filter((table) => fileOf(table?.where) !== file).map((table) => structuredClone(table));
  for (const table of others) {
    if (isObject(table) && Array.isArray(table.foreign_keys)) table.foreign_keys = table.foreign_keys.filter((key) => fileOf(key?.where) !== file);
  }
  const { picture: read, checks } = readSqlPicture([[file, text]], { ids, part, known: others.filter(READABLE_TABLE) });
  // The foreign keys that other files' ALTER TABLE gave the file's tables, by the table's name.
  const carried = new Map();
  for (const table of tables) {
    if (!READABLE_TABLE(table) || fileOf(table.where) !== file) continue;
    const kept = table.foreign_keys.filter((key) => fileOf(key?.where) !== file);
    if (kept.length > 0) carried.set(casefold(table.name), [...(carried.get(casefold(table.name)) ?? []), ...kept]);
  }
  const last = new Map(read.tables.map((table) => [casefold(table.name), table]));
  for (const [name, keys] of carried) last.get(name)?.foreign_keys.push(...structuredClone(keys));
  let merged = inFileOrder([...others, ...read.tables]);
  for (const table of merged) {
    if (!READABLE_TABLE(table)) continue;
    for (const [key, limit] of TABLE_LIMITS) {
      if (Array.isArray(table[key]) && table[key].length > limit) {
        checks.push(partial('05-erd', part, fileOf(table.where) ?? file, 1, `${key} exceeds its picture limit`));
        table[key] = table[key].slice(0, limit);
      }
    }
  }
  if (merged.length > MAX_TABLES) {
    checks.push(partial('05-erd', part, fileOf(merged.at(-1)?.where) ?? file, 1, `more than ${MAX_TABLES} tables; later tables are omitted`));
    merged = merged.slice(0, MAX_TABLES);
  }
  const without = unique([...listOf(current, 'without_table'), ...read.without_table]).slice(0, 500);
  return { picture: { format: 1, tables: merged, without_table: without }, checks, failure: null, read };
}

const MAX_SCREENS = 500;

function mergeSitemap(current, file, read, part) {
  const screens = listOf(current, 'screens');
  const placed = inFileOrder([
    ...screens.map((screen, index) => ({ screen, index, from: 'current', where: screen?.where })).filter(({ where }) => fileOf(where) !== file),
    ...read.screens.map((screen, index) => ({ screen, index, from: 'read', where: screen.where })),
  ]);
  // Each screen's new place, by the list it came from and its place there.
  const places = new Map(placed.map(({ index, from }, at) => [`${from}:${index}`, at]));
  const merged = placed.slice(0, MAX_SCREENS).map(({ screen, from }) => {
    if (!isObject(screen) || !Object.hasOwn(screen, 'parent')) return screen;
    const copy = { ...screen };
    const parent = places.get(`${from}:${screen.parent}`);
    if (parent === undefined) delete copy.parent;
    else copy.parent = parent;
    return copy;
  });
  const checks = [];
  if (placed.length > MAX_SCREENS) {
    checks.push(partial('07-sitemap', part, fileOf(placed[MAX_SCREENS].where) ?? file, 1, `more than ${MAX_SCREENS} screens; later screens are omitted`));
  }
  const without = unique([...listOf(current, 'without_screen'), ...read.without_screen]).slice(0, 500);
  return { picture: { format: 1, screens: merged, without_screen: without }, checks };
}

// See the top of this file. The reading's failure, or a picture with none of its stage's entries, comes back as the
// reader gives it, with no merge, so that it is refused as the text alone would be.
export function mergePicture(stage, current, file, text, { ids, part = '' } = {}) {
  if (stage === '05-erd') {
    const merged = mergeSql(current, file, text, { ids, part });
    return merged.read.tables.length === 0 ? { picture: merged.read, checks: merged.checks, failure: null, empty: true } : merged;
  }
  if (stage === '07-sitemap') {
    const { picture: read, checks, failure } = readSitemapPicture([[file, text]], { ids, part });
    if (read === null || read.screens.length === 0) return { picture: read, checks, failure, empty: true };
    const merged = mergeSitemap(current, file, read, part);
    return { picture: merged.picture, checks: [...checks, ...merged.checks], failure };
  }
  if (stage === '01-domain') {
    const { picture: read, checks } = readDomainPicture([[file, text]], { ids, part });
    if (read === null) return { picture: null, checks, failure: null, empty: true };
    return { picture: mergeDomain(current, file, read, part, checks), checks, failure: null };
  }
  throw new TypeError(`no picture is read for stage ${stage}`);
}
