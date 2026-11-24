// NEXUS's Markdown, SQL and YAML readers (TASK-466, TASK-470; SPEC-018) read as the pinned hub reads: of this
// repository's docs/01-domain/nexus.md, db/nexus.sql and docs/07-sitemap/nexus.yaml they make the pictures that
// tests/test_ddd_board_picture.py, tests/test_erd_picture.py and tests/test_sitemap_picture.py keep in
// ddd-board-picture.json, erd-picture.json and sitemap-picture.json, and of each case in picture-cases.json, which
// tests/test_picture_cases.py keeps, the hub's picture and checks. A case's replaced files are put in place of what one
// file gave its picture (picture-merge.js), which makes the hub's picture of the files with that one changed. Then the
// limits that are NEXUS's own: YAML nested deeper than the hub can read, and long texts that are read in time that
// grows with their length.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readDomainPicture } from '../src/domain-picture.js';
import { byCodePoint, fileOf, mergePicture } from '../src/picture-merge.js';
import { idFormat, oneLine, plain, splitLines, strip, unescapeHtml } from '../src/picture-text.js';
import { readSqlPicture, sqlStatements } from '../src/sql-picture.js';
import { MAX_BLOCKS, MAX_LISTS, readSitemapPicture, readYaml } from '../src/sitemap-picture.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const READERS = { '01-domain': readDomainPicture, '05-erd': readSqlPicture, '07-sitemap': readSitemapPicture };
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
// The hub's picture-partial checks, as a drawing's warnings come from them, in one order.
const partials = (checks) => checks.filter((check) => check.rule === 'picture-partial').map((check) => check.message).sort();

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
    assert.equal(sha256(bytes), kept.sha256, `${kept.source} changed since the stored picture`);
    const text = bytes.toString('utf8').replace(/^\uFEFF/, '');
    const { picture, checks } = read([[kept.source, text]], { part: kept.part });
    assert.deepEqual(picture, kept.picture);
    assert.deepEqual(checks, kept.checks);
  });
}

test("NEXUS reads this repository's stage-01 documents as the pinned hub does (ddd-board-picture.json)", () => {
  const kept = fixture('ddd-board-picture.json');
  assert.ok(kept.documents.length >= 1);
  const documents = kept.documents.map(({ path, sha256: digest }) => {
    const bytes = readFileSync(new URL(`../../${path}`, import.meta.url));
    assert.equal(sha256(bytes), digest, `${path} changed since the stored picture`);
    return [path, bytes.toString('utf8').replace(/^\uFEFF/u, '')];
  });
  const { picture, checks } = readDomainPicture(documents, { part: kept.part });
  assert.deepEqual(picture, kept.picture);
  assert.deepEqual(checks, kept.checks);
});

test('NEXUS reads each case as the pinned hub does', () => {
  const { cases } = fixture('picture-cases.json');
  assert.ok(cases.length >= 25);
  assert.deepEqual([...new Set(cases.map((each) => each.stage))].sort(), Object.keys(READERS));
  for (const each of cases) {
    const extra = Object.entries(each.ids ?? {}).map(([kind, prefix]) => [prefix, kind]);
    const { picture, checks } = READERS[each.stage](each.documents, { ids: idFormat(extra), part: each.part });
    assert.deepEqual(each.shape ? shape(picture) : picture, each.picture, each.name);
    assert.deepEqual(checks, each.checks, each.name);
  }
});

test("a text in place of one of two files makes the hub's picture of the files so changed, on stages 01, 05 and 07", () => {
  const cases = fixture('picture-cases.json').cases.filter((each) => each.replaced !== undefined);
  assert.deepEqual(cases.map((each) => each.stage), Object.keys(READERS));
  for (const each of cases) {
    const extra = Object.entries(each.ids ?? {}).map(([kind, prefix]) => [prefix, kind]);
    assert.equal(each.documents.length, 2, each.name);
    assert.deepEqual(each.replaced.map((replaced) => replaced.file), each.documents.map(([file]) => file), each.name);
    for (const [index, replaced] of each.replaced.entries()) {
      const [file, text] = each.replace[index];
      const name = `${each.name}: ${file}`;
      // The text changes the picture, and the merge makes the hub's picture of the changed files.
      assert.notDeepEqual(replaced.picture, each.picture, name);
      const merged = mergePicture(each.stage, each.picture, file, text, { ids: idFormat(extra), part: each.part });
      assert.equal(merged.failure, null, name);
      assert.deepEqual(merged.picture, replaced.picture, name);
      // What the hub left out of the other file stays, and the text's own warnings come with it, as a proposal keeps them.
      const kept = each.checks.filter((check) => !check.message.startsWith(`${file}:`));
      assert.deepEqual(partials([...kept, ...merged.checks]), partials(replaced.checks), name);
    }
    // The picture the merge was given is as it was.
    assert.deepEqual(READERS[each.stage](each.documents, { ids: idFormat(extra), part: each.part }).picture, each.picture, each.name);
  }
});

test('a text that reads nothing, or that does not read, comes back as the reader gives it, with no merge', () => {
  for (const [stage, current, text] of [
    ['05-erd', fixture('erd-picture.json').picture, 'CREATE VIEW v AS SELECT 1;'],
    ['07-sitemap', fixture('sitemap-picture.json').picture, '# nothing\n'],
    ['01-domain', fixture('ddd-board-picture.json').picture, '# no context\n'],
  ]) {
    assert.equal(mergePicture(stage, current, 'a', text).empty, true, stage);
  }
  const failed = mergePicture('07-sitemap', null, 'a.yaml', '- name: a\n  name: b\n');
  assert.deepEqual([failed.empty, failed.failure], [true, { file: 'a.yaml', line: 2 }]);
  assert.throws(() => mergePicture('03-user-flow', null, 'a', 'x'), TypeError);
});

test("an entry's file is its where without the line, and files go in the order Python sorts them", () => {
  assert.deepEqual(['db/a.sql:41', 'db/a:b.sql:2', 'docs/x.md', '', null, 7].map(fileOf), ['db/a.sql', 'db/a:b.sql', 'docs/x.md', null, null, null]);
  // By code point: U+FF5E sorts before U+1F600, though its first UTF-16 unit is the greater.
  assert.deepEqual(['b', '\u{1F600}', 'a', '\uFF5E', 'ab'].sort(byCodePoint), ['a', 'ab', 'b', '\uFF5E', '\u{1F600}']);
});

test("plain and unescapeHtml read a stage-01 text as the hub's plain and Python's html.unescape do", () => {
  for (const [text, want] of [
    ['a &amp; b &lt;x&gt; &ampx &notit; &notin;', 'a & b <x> &x \u00ACit; \u2209'],
    ['&#0; &#128; &#x110000; &#55296; &#65; &#x41 &#0000000000065;', '\uFFFD \u20AC \uFFFD \uFFFD A A A'],
    // Code points HTML does not allow are dropped; a carriage return is kept.
    ['&#1; &#x7f; &#13; &#65534;', '  \r '],
    ['&frac12x &AElig &zz; &', '\u00BDx \u00C6 &zz; &'],
  ]) {
    assert.equal(unescapeHtml(text), want, text);
  }
  assert.equal(plain('[a](b) ![c](d) [e] (f) **bold** <b>tag</b>x<br>y `v`'), 'a c [e] (f) bold tag x y v');
  assert.equal(plain('a'.repeat(200)).length, 120);
  assert.equal(plain(null), '');
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

test('a double-quoted YAML value that escapes half of a surrogate pair is refused with its line', () => {
  for (const value of ['name: "a\\ud800"', 'name: "\\udc00b"', 'flows: ["\\ud83d"]']) {
    const { picture, failure } = readSitemapPicture([['a.yaml', `- id: SCR-1\n  ${value}\n`]]);
    assert.deepEqual([picture, failure], [null, { file: 'a.yaml', line: 2 }], value);
  }
  const pair = readSitemapPicture([['a.yaml', '- id: SCR-1\n  name: "\\ud83d\\ude00"\n']]);
  assert.equal(pair.picture.screens[0].name, '\u{1F600}');
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
  // Stage-01 Markdown: long lists of names, of lane places and of alternatives, long runs of <, [, & and white space,
  // and many rows.
  const commands = '| Given by | Read model | Command | Aggregate | Events |\n| --- | --- | --- | --- | --- |';
  const markdown = [
    `### CTX-1 ${'<'.repeat(size / 4)}${'['.repeat(size / 4)}${'&'.repeat(size / 4)}`,
    `Purpose:${' '.repeat(size / 4)}x`,
    commands,
    `| a | b | c | ${'x, '.repeat(size / 3)} | e |`,
    `| Policy${' '.repeat(size / 4)} | b | c | d${' '.repeat(size / 4)}e | ${'f or '.repeat(size / 5)} |`,
    '| a | b | c | d | e |\n'.repeat(size / 40),
    `| Lane | Events |\n| --- | --- |\n| l | ${'a → '.repeat(size / 4)} |\n| m | ${'a or '.repeat(size / 5)} |`,
  ].join('\n');
  const read = readDomainPicture([['t.md', markdown]]);
  assert.equal(read.picture.contexts.length, 1);
  assert.equal(read.picture.timeline[0].places.length, 200);
  assert.equal(mergePicture('01-domain', read.picture, 't.md', markdown).picture.contexts.length, 1);
});
