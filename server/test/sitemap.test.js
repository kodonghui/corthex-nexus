// The sitemap drawer (TASK-425; SPEC-007; TBL-151, TBL-152, TBL-153): the stage-07 picture drawn as a tree of its
// screens, placed by layout.js. The done condition:
// - This repository's 5 screens draw as a stored expected tree. test/sitemap-picture.json is the pinned hub's picture
//   of docs/07-sitemap/nexus.yaml with the file's SHA-256, which tests/test_sitemap_picture.py checks against the pinned
//   hub; this test fails when the file changes and the picture does not. test/sitemap-expected.json is its drawing,
//   compared exactly, so this test fails when the drawing changes and the file does not. To make both again, from the
//   repository's root:
//       CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_sitemap_picture.py --write
//       (cd server && node test/sitemap-expected.js --write)
// - A screen whose parent is missing is drawn at the top, marked. The hub's sitemap.py lists a parent before its
//   children, so its pictures have none; the pictures that do are made here, as are the checks of the cases that break.

import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { DRAWERS, pictureWarnings, SourceFailure } from '../src/drawing.js';
import { idOf } from '../src/ids.js';
import { sitemap } from '../src/sitemap.js';
import { snapshotRoutes } from '../src/snapshots.js';
import { openStore } from '../src/store.js';
import { FORMAT_02, newCommit, repositorySnapshot } from './snapshots.js';
import { drawingOf, STAGE, storedDrawing, storedPicture } from './sitemap-expected.js';
import { startServer } from './support.js';

const START = Date.parse('2026-11-24T08:00:00.000Z');
const JSON_TYPE = { 'Content-Type': 'application/json' };
const SOURCE = '/pictures/07-sitemap/nexus';
const FILE = 'docs/07-sitemap/nexus.yaml';
const AGAIN = 'make test/sitemap-picture.json and test/sitemap-expected.json again as test/sitemap.test.js says at its top';
const ROOT = new URL('../../', import.meta.url);

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const counted = (diagrams) => ({ drawn: 0, unchanged: 0, failed: 0, removed: 0, ...diagrams });
const clone = (value) => JSON.parse(JSON.stringify(value));
const ofKind = (elements, kind, status) => elements.filter((element) => element.kind === kind && (status === undefined || (element.status ?? null) === status));
const byKey = (elements) => new Map(elements.map((element) => [element.key, element]));
const check = (rule, message, stage, part) => ({ rule, level: 'warn', message, by: 'scan', stage, ...(part === undefined ? {} : { part }) });
const partial = (message, part = 'nexus', stage = STAGE) => check('picture-partial', message, stage, part);

// Draws a picture of stage 07 as the push gives it, with the warnings of checks.
function draw(picture, checks = []) {
  return drawingOf({ source: FILE, part: 'nexus', checks, picture });
}

// A picture with what the hub always sends filled in. A screen is { id, name, parent, ... }.
function pictureOf(screens = []) {
  return {
    format: 1,
    screens: screens.map((screen, index) => ({
      id: '', name: '', path: '', access: '', flows: [], context: '', removed: false, where: `${FILE}:${index * 8 + 1}`, ...screen,
    })),
    without_screen: [],
  };
}

// Whether a point lies on the outline of a box.
function onOutline({ x, y }, box) {
  const inside = x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
  return inside && (x === box.x || x === box.x + box.width || y === box.y || y === box.y + box.height);
}
const apart = (a, b) => a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;

// Checks that a drawing is a tree: each screen under its parent, a line from the parent's box to its own, no two boxes
// overlapping, and the screens without a parent in the top layer.
function assertTree(elements) {
  const screens = ofKind(elements, 'screen');
  const keyed = byKey(screens);
  const top = Math.min(...screens.map(({ detail }) => detail.box.y));
  for (const screen of screens) {
    const { box } = screen.detail;
    if (screen.parent === null) {
      assert.equal(box.y, top, `${screen.key} stands in the top layer`);
      continue;
    }
    const parent = keyed.get(screen.parent);
    assert.ok(box.y >= parent.detail.box.y + parent.detail.box.height, `${screen.key} stands under its parent`);
    const [line] = elements.filter((element) => element.kind === 'line' && element.detail.to === screen.key);
    assert.deepEqual([line.parent, line.detail.from, line.name], [screen.parent, screen.parent, screen.name]);
    assert.ok(onOutline(line.detail.points[0], parent.detail.box), `${line.key} starts on its parent's box`);
    assert.ok(onOutline(line.detail.points.at(-1), box), `${line.key} ends on its screen's box`);
  }
  assert.equal(ofKind(elements, 'line').length, screens.filter(({ parent }) => parent !== null).length);
  for (const [index, a] of screens.entries()) {
    for (const b of screens.slice(index + 1)) assert.ok(apart(a.detail.box, b.detail.box), `${a.key} and ${b.key} do not overlap`);
  }
}

describe('the sitemap drawer', () => {
  test('the stored picture is the pinned hub\'s picture of the sitemap as it is now', () => {
    const stored = storedPicture();
    assert.equal(stored.source, FILE);
    assert.equal(stored.sha256, sha256(readFileSync(new URL(FILE, ROOT))), `${FILE} changed since test/sitemap-picture.json was made: ${AGAIN}`);
  });

  test('this repository\'s 5 screens draw as the stored expected tree', () => {
    const stored = storedPicture();
    const drawing = drawingOf(stored);
    assert.deepStrictEqual(drawing, storedDrawing(), `the drawing of test/sitemap-picture.json changed: ${AGAIN}`);
    const { elements } = drawing;
    const { picture } = stored;

    // The 5 screens of the sitemap, in its order, each under the screen the YAML nests it in: SCR-142 at the top.
    const screens = ofKind(elements, 'screen');
    assert.equal(screens.length, 5);
    assert.deepEqual(screens.map(({ key, trace_id: traceId, name, parent, status }) => [key, traceId, name, parent, status]), picture.screens.map((screen) => [
      screen.id, screen.id, screen.name, screen.parent === undefined ? null : picture.screens[screen.parent].id, null,
    ]));
    assert.deepEqual(screens.map(({ parent }) => parent), [null, 'SCR-142', 'SCR-143', 'SCR-144', 'SCR-145']);
    for (const [index, { detail }] of screens.entries()) {
      const { path, access, flows, context, terms, removed, where } = picture.screens[index];
      assert.deepEqual({ ...detail, box: undefined }, { path, access, flows, context, terms, removed, where, box: undefined });
      // Two lines, the name and the path, and wide enough for the longer.
      assert.equal(detail.box.height, 64);
      assert.ok(detail.box.width >= Math.min(480, Math.max(screens[index].name.length, path.length) * 7.2 + 24));
    }
    assertTree(elements);
    // The hub left nothing out, and the terms without a screen are not drawn.
    assert.deepEqual(stored.checks, []);
    assert.deepEqual(picture.without_screen, ['TERM-226']);
    assert.deepEqual(elements.map(({ kind }) => kind).filter((kind) => kind !== 'screen' && kind !== 'line'), []);
    assert.equal(JSON.stringify(elements).includes('TERM-226'), false);
    assert.equal(elements.length, 9);
  });

  test('SPEC-007: a sitemap with 1 root and 4 children draws a tree of 5 screens', () => {
    const { elements } = draw(pictureOf([
      { id: 'SCR-1', name: 'Home', path: '/' },
      ...[1, 2, 3, 4].map((n) => ({ id: `SCR-${n + 1}`, name: `Child ${n}`, path: `/c${n}`, parent: 0 })),
    ]));
    const screens = ofKind(elements, 'screen');
    assert.equal(screens.length, 5);
    assert.deepEqual(screens.map(({ parent }) => parent), [null, 'SCR-1', 'SCR-1', 'SCR-1', 'SCR-1']);
    // The children stand side by side in one layer, in the source's order.
    const children = screens.slice(1).map(({ detail }) => detail.box);
    assert.equal(new Set(children.map(({ y }) => y)).size, 1);
    assert.deepEqual(children.map(({ x }) => x), children.map(({ x }) => x).sort((a, b) => a - b));
    assert.deepEqual(ofKind(elements, 'line').map(({ key }) => key), ['SCR-1/line:SCR-2', 'SCR-1/line:SCR-3', 'SCR-1/line:SCR-4', 'SCR-1/line:SCR-5']);
    assertTree(elements);
  });

  test('a screen whose parent is missing is drawn at the top, marked, with its own screens under it', () => {
    const { elements } = draw(pictureOf([
      { id: 'SCR-1', name: 'Home', path: '/' },
      { id: 'SCR-2', name: 'Far', parent: 99 },
      { id: 'SCR-3', name: 'Under far', parent: 1 },
      { id: 'SCR-4', name: 'Itself', parent: 3 },
      { id: 'SCR-5', name: 'Later', parent: 6 },
      { id: 'SCR-6', name: 'Gone and lost', parent: -1, removed: true },
      { id: 'SCR-7', name: 'Loop', parent: 4 },
      { id: 'SCR-8', name: 'Text', parent: '0' },
      { id: 'SCR-9', name: 'Half', parent: 0.5 },
      { id: 'SCR-10', name: 'Gone', parent: 0, removed: true },
      { id: 'SCR-11', name: 'Null parent', parent: null },
    ]));
    const screens = ofKind(elements, 'screen');
    assert.deepEqual(screens.map(({ key, parent, status, detail }) => [key, parent, status, detail.removed]), [
      ['SCR-1', null, null, false],
      ['SCR-2', null, 'parent_missing', false],
      ['SCR-3', 'SCR-2', null, false],
      ['SCR-4', null, 'parent_missing', false],
      // A parent that comes later in the list is missing, so a loop such as SCR-5 and SCR-7 cannot form.
      ['SCR-5', null, 'parent_missing', false],
      // parent_missing comes before removed, and detail.removed keeps the hub's mark.
      ['SCR-6', null, 'parent_missing', true],
      ['SCR-7', 'SCR-5', null, false],
      ['SCR-8', null, 'parent_missing', false],
      ['SCR-9', null, 'parent_missing', false],
      ['SCR-10', 'SCR-1', 'removed', true],
      // No parent at all is a root, not a missing parent.
      ['SCR-11', null, null, false],
    ]);
    assertTree(elements);
    // No box stands for the missing parent.
    assert.deepEqual(new Set(elements.map(({ kind }) => kind)), new Set(['screen', 'line']));
  });

  test('a screen entry the drawer cannot read is left out and marked with its where, and screens under it keep their place', () => {
    const picture = pictureOf([{ id: 'SCR-1', name: 'Home' }, { id: 'SCR-2', name: 'Bad flows', flows: 'FL-1', parent: 0 }]);
    picture.screens.push('a screen', { id: 'SCR-4', name: 7, where: `${FILE}:30`, parent: 0 }, { name: 'Under bad', where: `${FILE}:40`, parent: 1 });
    const { elements } = draw(picture);
    assert.deepEqual(ofKind(elements, 'screen').map(({ key, trace_id: traceId, name, parent, status, detail }) => [key, traceId, name, parent, status, detail.where]), [
      ['SCR-1', 'SCR-1', 'Home', null, null, `${FILE}:1`],
      ['SCR-2', 'SCR-2', 'Bad flows', 'SCR-1', 'unreadable', `${FILE}:9`],
      ['screen:', null, '', null, 'unreadable', null],
      ['SCR-4', 'SCR-4', '', 'SCR-1', 'unreadable', `${FILE}:30`],
      ['SCR-2/screen:Under bad', null, 'Under bad', 'SCR-2', null, `${FILE}:40`],
    ]);
    for (const screen of ofKind(elements, 'screen', 'unreadable')) assert.deepEqual(Object.keys(screen.detail), ['where', 'box']);
    assertTree(elements);
  });

  test('a part of the sitemap the hub left out is shown with its file and line, and the warnings are read once the tree is placed', () => {
    const { elements } = draw(pictureOf([{ id: 'SCR-1', name: 'Home' }]), [
      partial(`${FILE}:12: a colon in a scalar needs quotes`),
      partial(`${FILE}:1: more than 500 screens; later screens are omitted`),
      check('picture-partial', 'docs/07-sitemap/big.yaml: source object is unreadable or exceeds 1 MB', STAGE),
      partial('db/nexus.sql:9: a statement of stage 05', 'nexus', '05-erd'),
    ]);
    assert.deepEqual(ofKind(elements, 'source').map(({ key, name, status, detail }) => [key, name, status, detail]), [
      ['source:a colon in a scalar needs quotes', 'a colon in a scalar needs quotes', 'left_out', { where: `${FILE}:12` }],
      ['source:more than 500 screens; later screens are omitted', 'more than 500 screens; later screens are omitted', 'left_out', { where: `${FILE}:1` }],
      ['source:source object is unreadable or exceeds 1 MB', 'source object is unreadable or exceeds 1 MB', 'left_out', { where: 'docs/07-sitemap/big.yaml' }],
    ]);

    // A picture that fails, whether at its form or its size, has not read them.
    for (const failed of [{ format: 2, screens: [] }, pictureOf(Array.from({ length: 5001 }, (_, n) => ({ name: `S${n}` })))]) {
      let read = false;
      const given = { stage: STAGE, part: 'nexus', key: null, kind: 'sitemap', source: FILE, text: JSON.stringify(failed), read: () => null };
      Object.defineProperty(given, 'warnings', { get() { read = true; return []; } });
      assert.throws(() => sitemap(given), SourceFailure);
      assert.equal(read, false);
    }
  });

  test('a picture not in format 1 with a list of screens, or with more than 5000 elements, fails at its source', () => {
    for (const picture of [null, [], 'screens', { format: 2, screens: [] }, { format: 1 }, { format: 1, screens: {} }]) {
      assert.throws(() => draw(picture), SourceFailure);
    }
    // 5000 screens draw; one more, or a warning more, fails.
    const roots = (count) => pictureOf(Array.from({ length: count }, (_, n) => ({ name: `S${n}` })));
    assert.equal(draw(roots(5000)).elements.length, 5000);
    assert.throws(() => draw(roots(5001)), SourceFailure);
    assert.throws(() => draw(roots(5000), [partial(`${FILE}:3: left out`)]), SourceFailure);
    // layout.js places any tree within 5000 elements, however deep or wide: 2500 screens one under another draw, and so
    // do 2499 long-named screens under one root, whose boxes pass 1,000,000 pixels, the most layout.js takes as a given
    // position (see the server's README).
    const chain = (count) => pictureOf(Array.from({ length: count }, (_, n) => ({ name: `S${n}`, ...(n === 0 ? {} : { parent: n - 1 }) })));
    assert.equal(draw(chain(2500)).elements.length, 4999);
    const wide = draw(pictureOf([{ name: 'Root' }, ...Array.from({ length: 2499 }, (_, n) => ({ name: `${'x'.repeat(80)}${n}`, parent: 0 }))]));
    assert.equal(wide.elements.length, 4999);
    assert.ok(Math.max(...ofKind(wide.elements, 'screen').map(({ detail }) => detail.box.x + detail.box.width)) > 1000000);
    // An empty sitemap draws an empty tree.
    assert.deepEqual(draw(pictureOf()), { elements: [] });
  });

  test('a screen keeps its key: its trace ID, or its name under its parent; the drawing is the same each time', () => {
    const screens = [
      { id: 'SCR-1', name: 'Home' },
      { name: 'Settings', parent: 0 },
      { id: 'SCR-3', name: 'Project', parent: 0 },
      { name: 'Settings', parent: 2 },
      { name: 'Settings', parent: 2 },
      { id: 'SCR-1', name: 'Home again' },
    ];
    const first = draw(pictureOf(screens));
    assert.deepEqual(first, draw(pictureOf(clone(screens))));
    assert.deepEqual(ofKind(first.elements, 'screen').map(({ key, trace_id: traceId }) => [key, traceId]), [
      ['SCR-1', 'SCR-1'],
      ['SCR-1/screen:Settings', null],
      ['SCR-3', 'SCR-3'],
      ['SCR-3/screen:Settings', null],
      ['SCR-3/screen:Settings#2', null],
      ['SCR-1#2', 'SCR-1'],
    ]);
    // The same screens with the root's children in the other order keep their keys.
    const moved = draw(pictureOf([screens[0], { ...screens[2], parent: 0 }, { ...screens[3], parent: 1 }, { ...screens[4], parent: 1 }, { ...screens[1], parent: 0 }]));
    const keys = (drawing) => ofKind(drawing.elements, 'screen').map(({ key }) => key).sort();
    assert.deepEqual(keys(moved), keys(first).filter((key) => key !== 'SCR-1#2'));
  });
});

describe('the sitemap through the push', () => {
  let folder;
  let db;
  let headers;
  let server;
  const clock = { now: START };

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-sitemap-'));
    ({ db } = openStore(folder));
    const secret = randomBytes(32).toString('base64url');
    const { lastInsertRowid } = db.prepare('INSERT INTO agent_credentials (name, secret_digest, issued_at) VALUES (?, ?, ?)')
      .run('push-job', sha256(secret), new Date(START).toISOString());
    headers = { 'CF-Access-Client-Id': idOf('ac', Number(lastInsertRowid)), 'CF-Access-Client-Secret': secret };
    // The server's own sitemap drawer, alone, so that the counts are the sitemap's.
    server = await startServer({ store: db, now: () => clock.now, routes: snapshotRoutes({ drawers: { sitemap: DRAWERS.sitemap } }) });
  });

  after(async () => {
    await server.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  // A snapshot of this repository whose stage-07 picture and checks are given.
  function snapshotWith(name, picture, checks, { commit = newCommit(), replaces } = {}) {
    const snapshot = repositorySnapshot(FORMAT_02, { name, commit, replaces });
    snapshot.pictures.find((entry) => entry.stage === STAGE).source = picture;
    snapshot.checks = checks;
    return snapshot;
  }

  async function push(snapshot) {
    clock.now += 1000;
    return server.send({ method: 'POST', path: '/api/snapshots', headers: { ...JSON_TYPE, ...headers }, body: JSON.stringify(snapshot) });
  }

  const diagramOf = (name) => db.prepare(
    'SELECT d.* FROM diagrams d JOIN project_spaces p ON p.id = d.project_id WHERE p.name = ? AND d.source_key = ?',
  ).get(name, SOURCE);
  const drawings = (diagramId) => db.prepare('SELECT * FROM drawings WHERE diagram_id = ? ORDER BY id').all(diagramId).map((row) => ({ ...row }));
  const elements = (drawingId) => db.prepare(
    'SELECT element_key, trace_id, kind, name, parent_key, status, detail FROM elements WHERE drawing_id = ? ORDER BY id',
  ).all(drawingId).map((row) => ({ ...row, detail: JSON.parse(row.detail) }));
  // The rows the store keeps of a drawer's elements.
  const rowsOf = (drawn) => drawn.map((element) => ({
    element_key: element.key, trace_id: element.trace_id ?? null, kind: element.kind, name: element.name, parent_key: element.parent ?? null,
    status: element.status ?? null, detail: element.detail,
  }));

  test('the push draws this repository\'s sitemap as the stored expected tree, with the server\'s own drawer', async () => {
    const stored = storedPicture();
    const answer = await push(snapshotWith('sitemap-repository', stored.picture, stored.checks));
    assert.equal(answer.status, 201);
    assert.deepEqual([answer.json.diagrams, answer.json.failures], [counted({ drawn: 1 }), []]);
    const diagram = diagramOf('sitemap-repository');
    assert.deepEqual([diagram.kind, diagram.name, diagram.stage], ['sitemap', 'Sitemap', STAGE]);
    const [drawing] = drawings(diagram.id);
    assert.equal(drawing.status, 'drawn');
    assert.deepEqual(elements(drawing.id), rowsOf(storedDrawing().elements));
    // The hub left nothing out, so the digest is the picture's alone.
    assert.equal(drawing.source_digest, sha256(JSON.stringify([[SOURCE, sha256(JSON.stringify(stored.picture))]])));
  });

  test('a screen whose parent is missing reaches the store at the top, marked', async () => {
    const answer = await push(snapshotWith('sitemap-missing', pictureOf([{ id: 'SCR-1', name: 'Home' }, { id: 'SCR-2', name: 'Lost', parent: 5 }]), []));
    assert.deepEqual(answer.json.diagrams, counted({ drawn: 1 }));
    const [drawing] = drawings(diagramOf('sitemap-missing').id);
    assert.deepEqual(elements(drawing.id).map((row) => [row.element_key, row.parent_key, row.status, row.detail.box.y]), [
      ['SCR-1', null, null, 0],
      ['SCR-2', null, 'parent_missing', 0],
    ]);
  });

  test('a part the hub left out is shown with its file and line, and the warnings join the digest', async () => {
    const name = 'sitemap-left-out';
    const { picture } = storedPicture();
    const checks = [partial(`${FILE}:12: a colon in a scalar needs quotes`), partial('db/nexus.sql:9: stage 05', 'nexus', '05-erd')];
    const [a, b, c] = [newCommit(), newCommit(), newCommit()];
    assert.deepEqual((await push(snapshotWith(name, picture, checks, { commit: a }))).json.diagrams, counted({ drawn: 1 }));
    const diagram = diagramOf(name);
    const [first] = drawings(diagram.id);
    assert.deepEqual(elements(first.id).filter((row) => row.kind === 'source').map((row) => [row.name, row.status, row.detail]), [
      ['a colon in a scalar needs quotes', 'left_out', { where: `${FILE}:12` }],
    ]);
    const warnings = pictureWarnings(checks, STAGE, 'nexus');
    assert.equal(first.source_digest, sha256(JSON.stringify([[SOURCE, sha256(JSON.stringify(picture))], ['/snapshot#picture-partial', sha256(JSON.stringify(warnings))]])));
    // The same warnings with another commit draw nothing new; none draws again.
    assert.deepEqual((await push(snapshotWith(name, picture, clone(checks), { commit: b, replaces: a }))).json.diagrams, counted({ unchanged: 1 }));
    assert.deepEqual((await push(snapshotWith(name, picture, [], { commit: c, replaces: b }))).json.diagrams, counted({ drawn: 1 }));
    assert.deepEqual(elements(drawings(diagram.id).at(-1).id).filter((row) => row.kind === 'source'), []);
  });

  test('a picture in another format fails the drawing at its source, and the sitemap keeps its last good drawing', async () => {
    const name = 'sitemap-format';
    const { picture } = storedPicture();
    const [a, b, c] = [newCommit(), newCommit(), newCommit()];
    await push(snapshotWith(name, picture, [], { commit: a }));
    const answer = await push(snapshotWith(name, { format: 2, screens: [] }, [], { commit: b, replaces: a }));
    const diagram = diagramOf(name);
    assert.deepEqual([answer.json.diagrams, answer.json.failures], [counted({ failed: 1 }),
      [{ diagram: idOf('dg', Number(diagram.id)), part: 'nexus', stage: STAGE, where: FILE }]]);
    const [good, failed] = drawings(diagram.id);
    assert.deepEqual([good.status, failed.status, failed.failed_path, failed.failed_line], ['drawn', 'failed', FILE, null]);
    assert.deepEqual(elements(failed.id), []);
    assert.equal(elements(good.id).length, storedDrawing().elements.length);
    // The same picture failing again, whatever the hub left out, makes no new drawing.
    const again = await push(snapshotWith(name, { format: 2, screens: [] }, [partial(`${FILE}:3: left out`)], { commit: c, replaces: b }));
    assert.deepEqual(again.json.diagrams, counted({ failed: 1 }));
    assert.equal(drawings(diagram.id).length, 2);
  });

  test('no log line holds the picture\'s text (rule 5)', async () => {
    const marker = `screen_${randomBytes(8).toString('hex')}`;
    const picture = pictureOf([{ id: 'SCR-1', name: marker, path: `/${marker}` }, { name: `${marker} child`, parent: 0 }, { name: marker, parent: 7 }]);
    await push(snapshotWith('sitemap-logs', picture, [partial(`docs/07-sitemap/${marker}.yaml:4: ${marker} was left out`)]));
    const logs = server.logText();
    assert.ok(logs.includes('pushSnapshot'));
    assert.equal(logs.includes(marker), false);
  });
});

test('the sitemap drawer is drawing.js\'s drawer of the sitemap kind', () => {
  assert.equal(DRAWERS.sitemap, sitemap);
});
