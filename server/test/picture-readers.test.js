// NEXUS's SQL and YAML readers (TASK-466; SPEC-018) read as the pinned hub reads: of this repository's db/nexus.sql and
// docs/07-sitemap/nexus.yaml they make the pictures that tests/test_erd_picture.py and tests/test_sitemap_picture.py
// keep in erd-picture.json and sitemap-picture.json, and of each case in picture-cases.json, which
// tests/test_picture_cases.py keeps, the hub's picture and checks. Then the limits that are NEXUS's own: YAML nested
// deeper than the hub can read, and long texts that are read in time that grows with their length.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idFormat, oneLine, splitLines, strip } from '../src/picture-text.js';
import { readSqlPicture, sqlStatements } from '../src/sql-picture.js';
import { MAX_BLOCKS, MAX_LISTS, readSitemapPicture, readYaml } from '../src/sitemap-picture.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const READERS = { '05-erd': readSqlPicture, '07-sitemap': readSitemapPicture };

// As tests/test_picture_cases.py's shape: each list longer than three as its count, first and last.
const shape = (value) => {
  if (Array.isArray(value)) {
    return value.length > 3 ? { count: value.length, first: shape(value[0]), last: shape(value.at(-1)) } : value.map(shape);
  }
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shape(item)]));
  return value;
};

for (const [stored, read] of [['erd-picture.json', readSqlPicture], ['sitemap-picture.json', readSitemapPicture]]) {
  test(`NEXUS reads this repository's stage source as the pinned hub does (${stored})`, () => {
    const kept = fixture(stored);
    const bytes = readFileSync(new URL(`../../${kept.source}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), kept.sha256, `${kept.source} changed since the stored picture`);
    const text = bytes.toString('utf8').replace(/^\uFEFF/, '');
    const { picture, checks } = read([[kept.source, text]], { part: kept.part });
    assert.deepEqual(picture, kept.picture);
    assert.deepEqual(checks, kept.checks);
  });
}

test('NEXUS reads each case as the pinned hub does', () => {
  const { cases } = fixture('picture-cases.json');
  assert.ok(cases.length >= 15);
  for (const each of cases) {
    const extra = Object.entries(each.ids ?? {}).map(([kind, prefix]) => [prefix, kind]);
    const { picture, checks } = READERS[each.stage](each.documents, { ids: idFormat(extra), part: each.part });
    assert.deepEqual(each.shape ? shape(picture) : picture, each.picture, each.name);
    assert.deepEqual(checks, each.checks, each.name);
  }
});

test('a YAML text that does not read gives the line where it stops, and a text that reads gives none', () => {
  assert.deepEqual(readSitemapPicture([['a.yaml', '- name: a\n  name: b\n']]).failure, { file: 'a.yaml', line: 2 });
  assert.equal(readSitemapPicture([['a.yaml', '- name: a\n']]).failure, null);
  assert.equal(readSitemapPicture([['a.yaml', '']]).picture.screens.length, 0);
});

test('mappings are Maps, so that __proto__ and constructor are keys like any other', () => {
  const [screen] = readYaml('- constructor: a\n  toString: b\n  children:\n    - __proto__: c\n');
  assert.ok(screen instanceof Map);
  assert.equal(screen.get('constructor'), 'a');
  assert.equal(screen.get('children')[0].get('__proto__'), 'c');
  assert.equal(Object.getPrototypeOf(screen.get('children')[0]), Map.prototype);
  assert.equal({}.c, undefined);
});

test('YAML nested deeper than the hub can read is refused with its line', () => {
  const deep = (levels) => Array.from({ length: levels }, (_, n) => `${' '.repeat(2 * n)}k${n}:`).join('\n');
  const nested = `- a:\n${deep(MAX_BLOCKS + 5).replace(/^/gmu, '    ')}\n`;
  const { picture, failure, checks } = readSitemapPicture([['deep.yaml', nested]]);
  assert.equal(picture, null);
  assert.equal(failure.line, MAX_BLOCKS + 1);
  assert.match(checks[0].message, new RegExp(`YAML nests more than ${MAX_BLOCKS} deep`));
  const lists = `- flows: ${'['.repeat(MAX_LISTS + 1)}a${']'.repeat(MAX_LISTS + 1)}\n`;
  assert.deepEqual(readSitemapPicture([['lists.yaml', lists]]).failure, { file: 'lists.yaml', line: 1 });
  const fits = `- flows: ${'['.repeat(MAX_LISTS)}FL-1${']'.repeat(MAX_LISTS)}\n`;
  assert.deepEqual(readSitemapPicture([['lists.yaml', fits]]).picture.screens[0].flows, []);
});

test('long texts are read in time that grows with their length', { timeout: 60_000 }, () => {
  const size = 400_000;
  // An SQL line of [ with no ], long runs of white space in a column's type and a table's status, and a long
  // string of address characters.
  const brackets = sqlStatements(`SELECT ${'['.repeat(size)}`);
  assert.equal(brackets[0].length, size + 1);
  const spaces = ' '.repeat(size);
  const sql = `CREATE TABLE t (a ENUM('x${spaces}y', 'z')); COMMENT ON TABLE t IS 'TBL-1 t (status:${spaces}removed\n${spaces})';`;
  const { picture } = readSqlPicture([['t.sql', sql]]);
  assert.equal(picture.tables[0].columns[0].type, "ENUM('x y', 'z')");
  assert.equal(picture.tables[0].removed, false);
  assert.equal(strip(`a${spaces}`), 'a');
  assert.equal(oneLine(`${'a'.repeat(size)}@`).length, 300);
  // A YAML line of long runs, and many lines.
  const yaml = `- name: ${'a '.repeat(size / 2)}\n${'  # c\n'.repeat(size / 8)}  path: '${"''".repeat(size / 4)}'\n`;
  assert.equal(readSitemapPicture([['t.yaml', yaml]]).picture.screens.length, 1);
  assert.equal(splitLines('\r\n'.repeat(size)).length, size);
});
