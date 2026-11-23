// The screen-states drawer (TASK-426; SPEC-008; TBL-151, TBL-152, TBL-153): each stage-08 screen definition drawn as
// one panel for each state of its state table, in a grid of three columns. The done condition:
// - This repository's 5 screens draw 39 panels with name, description and responses. test/screen-states-pictures.json
//   holds the pinned hub's corthex-hub/0.3 pictures of docs/08-screens, each with its file's SHA-256, which
//   tests/test_screen_states_pictures.py checks against the pinned hub; this test fails when a screen file changes, is
//   added or is removed and the pictures do not. test/screen-states-expected.json is their drawings, compared exactly,
//   so this test fails when a drawing changes and the file does not. To make both again, from the repository's root:
//       CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_screen_states_pictures.py --write
//       (cd server && node test/screen-states-expected.js --write)
// - A state without a description is an empty panel, marked. No state of this repository is without one, so the files
//   that have one are made here, as are those whose state table cannot be read.

import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { DRAWERS, SourceFailure } from '../src/drawing.js';
import { idOf } from '../src/ids.js';
import { screenStates } from '../src/screen-states.js';
import { snapshotRoutes } from '../src/snapshots.js';
import { openStore } from '../src/store.js';
import { drawingOf, drawingsOf, STAGE, storedDrawings, storedPictures } from './screen-states-expected.js';
import { FORMAT_03, newCommit, repositorySnapshot } from './snapshots.js';
import { startServer } from './support.js';

const START = Date.parse('2026-11-24T09:00:00.000Z');
const JSON_TYPE = { 'Content-Type': 'application/json' };
const FOLDER = 'docs/08-screens/';
const FILE = `${FOLDER}SCR-1.md`;
const AGAIN = 'make test/screen-states-pictures.json and test/screen-states-expected.json again as test/screen-states.test.js says at its top';
const ROOT = new URL('../../', import.meta.url);
// The grid of the stage-09 mockup at 1440 pixels.
const WIDTH = 328;
const GAP = 12;
const MIN_HEIGHT = 168;

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const counted = (diagrams) => ({ drawn: 0, unchanged: 0, failed: 0, removed: 0, ...diagrams });
const read = (path) => readFileSync(new URL(path, ROOT), 'utf8');

// A screen file with a state table of rows, each [state, description, responses] or a line as it is; head comes
// before the table, and the table starts at line 5 + the lines of head.
function screenFile(rows, { heading = '# SCR-1 Meeting detail', head = [] } = {}) {
  return [
    heading,
    '',
    ...head,
    '| State | What the user sees and can do | From responses |',
    '| --- | --- | --- |',
    ...rows.map((row) => (typeof row === 'string' ? row : `| ${row.join(' | ')} |`)),
    '',
  ].join('\n');
}

// Draws a screen file as the push gives it.
const draw = (text, key = FILE) => drawingOf({ key, text });
const panels = (drawing) => drawing.elements.map(({ key, name, status, detail }) => ({ key, name, status, ...detail }));
const sixStates = (screen = 'SCR-1') => ['normal', 'loading', 'empty', 'error', 'permission', 'stale']
  .map((state) => [`${screen}#${state}`, `What ${state} shows.`, `API-1#${state === 'normal' ? 200 : 400}`]);

// Where a SourceFailure says a file failed.
function failsAt(text, line) {
  assert.throws(() => draw(text), (error) => error instanceof SourceFailure && error.path === null && error.line === line);
}

const apart = (a, b) => a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;

// Checks the grid: three panels to a row in the table's order, 328 pixels wide with 12-pixel gaps, each at least 168
// pixels high, each row as high as its tallest panel and 12 pixels under the row before, and no two panels overlapping.
function assertGrid(elements) {
  let y = 0;
  for (let start = 0; start < elements.length; start += 3) {
    const row = elements.slice(start, start + 3).map(({ detail }) => detail.box);
    const height = row[0].height;
    assert.ok(height >= MIN_HEIGHT);
    row.forEach((box, column) => assert.deepEqual(box, { x: column * (WIDTH + GAP), y, width: WIDTH, height }));
    y += height + GAP;
  }
  for (const [index, a] of elements.entries()) {
    for (const b of elements.slice(index + 1)) assert.ok(apart(a.detail.box, b.detail.box), `${a.key} and ${b.key} do not overlap`);
  }
}

describe('the screen-states drawer', () => {
  test('the stored pictures are the pinned hub\'s pictures of the screen files as they are now', () => {
    const stored = storedPictures();
    assert.equal(stored.source, FOLDER);
    // The screen definitions of the stage's source: its Markdown files, without a translation beside its original or a
    // listing such as the README, as the hub sends them.
    const names = readdirSync(new URL(FOLDER, ROOT)).filter((name) => /\.(?:md|markdown|mdx)$/i.test(name)
      && !/\.[a-z]{2}(?:[-_][A-Za-z]{2,4})?\.(?:md|markdown|mdx)$/i.test(name) && !/^(?:_|(?:index|readme|list)\.)/i.test(name)).sort();
    assert.deepEqual(stored.pictures.map(({ key }) => key), names.map((name) => `${FOLDER}${name}`), `a screen file was added or removed: ${AGAIN}`);
    for (const picture of stored.pictures) {
      assert.deepEqual([picture.part, picture.stage], ['', STAGE]);
      assert.equal(picture.sha256, sha256(readFileSync(new URL(picture.key, ROOT))), `${picture.key} changed since the pictures were made: ${AGAIN}`);
      assert.equal(picture.source.text, read(picture.key));
    }
    assert.deepEqual(stored.left_out, []);
  });

  test('this repository\'s 5 screens draw 39 panels with name, description and responses', () => {
    const stored = storedPictures();
    const { drawings } = drawingsOf(stored);
    assert.deepStrictEqual({ drawings }, storedDrawings(), `the drawings of test/screen-states-pictures.json changed: ${AGAIN}`);

    // Each screen file is one diagram, named by its first heading: the screen's trace ID and its name in the sitemap.
    const sitemap = JSON.parse(read('server/test/sitemap-picture.json')).picture.screens;
    assert.deepEqual(drawings.map(({ key, name }) => [key, name]), sitemap.map(({ id, name }) => [`${FOLDER}${id}.md`, `${id} ${name}`]));
    assert.deepEqual(drawings.map(({ elements }) => elements.length), [6, 7, 7, 10, 9]);
    assert.equal(drawings.flatMap(({ elements }) => elements).length, 39);

    for (const { key, elements } of drawings) {
      // Each panel is a row of the file's state table, in its order, read here on its own: its state, its description
      // and its responses, which "-" gives none of.
      const lines = read(key).split('\n');
      const rows = lines.flatMap((line, index) => {
        const row = /^\| (SCR-\d+#[a-z-]+) \| (.+) \| (.+) \|$/.exec(line);
        return row === null ? [] : [{
          key: row[1], name: row[1], status: null, description: row[2], responses: row[3] === '-' ? [] : row[3].split(', '), where: `${key}:${index + 1}`,
        }];
      });
      assert.deepEqual(panels({ elements }).map(({ box, ...panel }) => panel), rows);
      assert.ok(elements.every(({ kind, detail }) => kind === 'state' && detail.description !== ''));
      assertGrid(elements);
    }
    // SCR-145's states, in the order of its table, and a state's responses as written.
    const workbench = drawings[3].elements;
    assert.deepEqual(workbench.map(({ name }) => name.split('#')[1]), [
      'normal', 'loading', 'empty', 'error', 'permission', 'stale', 'waiting', 'confirmed', 'not-drawn', 'workshop',
    ]);
    assert.deepEqual(workbench[8].detail.responses, ['API-275#409 (not-drawn)', 'API-293#409']);
  });

  test('SPEC-008: a screen with 6 states draws 6 panels, two rows of three', () => {
    const drawing = draw(screenFile(sixStates()));
    assert.equal(drawing.name, 'SCR-1 Meeting detail');
    assert.deepEqual(panels(drawing).map(({ name, status, description, responses }) => [name, status, description, responses]), sixStates()
      .map(([state, description, response]) => [state, null, description, [response]]));
    assert.deepEqual(drawing.elements.map(({ detail }) => [detail.box.x, detail.box.y]), [[0, 0], [340, 0], [680, 0], [0, 180], [340, 180], [680, 180]]);
    assertGrid(drawing.elements);
  });

  test('a state without a description is an empty panel, marked no_description, with its responses', () => {
    const drawing = draw(screenFile([
      ['SCR-1#normal', 'The list.', 'API-1#200'],
      ['SCR-1#loading', '', '-'],
      ['SCR-1#empty', '   ', 'API-1#200'],
      ['SCR-1#error', '-', 'API-1#404, API-1#default'],
      '| SCR-1#permission | | |',
      ['SCR-1#stale', '--', ''],
      ['SCR-1#secret', 'none', 'API-2#201'],
    ]));
    assert.deepEqual(panels(drawing).map(({ name, status, description, responses, where }) => [name, status, description, responses, where]), [
      ['SCR-1#normal', null, 'The list.', ['API-1#200'], `${FILE}:5`],
      ['SCR-1#loading', 'no_description', '', [], `${FILE}:6`],
      ['SCR-1#empty', 'no_description', '', ['API-1#200'], `${FILE}:7`],
      ['SCR-1#error', 'no_description', '', ['API-1#404', 'API-1#default'], `${FILE}:8`],
      ['SCR-1#permission', 'no_description', '', [], `${FILE}:9`],
      // Only an empty cell, white space or "-" alone is no description.
      ['SCR-1#stale', null, '--', [], `${FILE}:10`],
      ['SCR-1#secret', null, 'none', ['API-2#201'], `${FILE}:11`],
    ]);
    assertGrid(drawing.elements);
  });

  test('the description is the cell as written, with \\| unescaped, and responses split at the commas outside brackets', () => {
    const drawing = draw(screenFile([
      ['SCR-1#normal', 'Shows `a \\| b`, **bold** and [the list](SCR-2.md) <br> "quoted"', 'API-1#200,API-2#200 , API-3#409 (stale, reload), API-4#404 [gone, a], , API-5#x\\|y'],
    ]));
    const [panel] = panels(drawing);
    assert.equal(panel.description, 'Shows `a | b`, **bold** and [the list](SCR-2.md) <br> "quoted"');
    assert.deepEqual(panel.responses, ['API-1#200', 'API-2#200', 'API-3#409 (stale, reload)', 'API-4#404 [gone, a]', 'API-5#x|y']);
  });

  test('a panel is as high as its text needs, at least 168 pixels, and each row as high as its tallest panel', () => {
    const long = 'word '.repeat(200).trim();
    const korean = '가'.repeat(400);
    const drawing = draw(screenFile([
      ['SCR-1#normal', 'Short.', 'API-1#200'],
      ['SCR-1#loading', long, '-'],
      ['SCR-1#empty', 'Short.', '-'],
      ['SCR-1#error', 'a'.repeat(400), '-'],
      ['SCR-1#stale', korean, '-'],
      ['SCR-1#delete', 'Short.', Array.from({ length: 60 }, (_, n) => `API-${n + 1}#409`).join(', ')],
      ['SCR-1#secret', 'Short.', '-'],
    ]));
    const heights = drawing.elements.map(({ detail }) => detail.box.height);
    // A word fills 41 narrow characters a line: 200 words of 4 are 25 lines, 400 characters without a space 10, and
    // 400 Hangul characters, each as wide as two, 20; with the name's and the responses' lines and the padding.
    assert.deepEqual(heights.slice(0, 3), [580, 580, 580]);
    assert.equal(heights[3], heights[4]);
    assert.equal(heights[3], 24 + 16 + (1 + 20 + 1) * 20);
    assert.equal(heights[6], MIN_HEIGHT);
    assertGrid(drawing.elements);
    // Each panel is as high as its own text needs before the row makes it as high as the tallest.
    const alone = (description, responses = '-') => draw(screenFile([['SCR-1#normal', description, responses]])).elements[0].detail.box.height;
    assert.deepEqual([alone('Short.'), alone(long), alone('a'.repeat(400)), alone(korean)], [MIN_HEIGHT, 580, 280, 480]);
    assert.ok(heights[5] > MIN_HEIGHT);
  });

  test('the state table is the first table whose rows start with a state ID, outside code fences and front matter', () => {
    const text = [
      '---',
      '# a comment of the front matter, no heading',
      '| SCR-9#front | Not read. | - |',
      '---',
      '## Data',
      '# SCR-1 Meeting detail',
      '',
      '| Data | Source |',
      '| --- | --- |',
      '| The meeting | API-1 |',
      '',
      '```markdown',
      '# SCR-2 An example',
      '| State | What the user sees | From responses |',
      '| --- | --- | --- |',
      '| SCR-2#example | Not read. | API-2#200 |',
      '```',
      '',
      '| State | What the user sees and can do | From responses |',
      '|:---|:---:|---:|',
      '| SCR-1#normal | The meeting. | API-1#200 |',
      '| SCR-1#empty | Nothing yet. | API-1#200 |',
      '',
      '| State | What the user sees and can do | From responses |',
      '| --- | --- | --- |',
      '| SCR-1#later | A second state table is not read. | - |',
    ].join('\r\n');
    const drawing = draw(text);
    assert.equal(drawing.name, 'SCR-1 Meeting detail');
    assert.deepEqual(panels(drawing).map(({ name, where }) => [name, where]), [['SCR-1#normal', `${FILE}:21`], ['SCR-1#empty', `${FILE}:22`]]);
    // A table line with no separator under it is no table, and a blank line ends a table.
    const loose = draw(screenFile(sixStates().slice(0, 2), { head: ['| SCR-1#loose | Not a table. | - |', ''] }));
    assert.deepEqual(panels(loose).map(({ name }) => name), ['SCR-1#normal', 'SCR-1#loading']);
    // A heading of level 1 names the diagram, closing marks left out; with none, the diagram keeps drawing.js's name.
    assert.equal(draw(screenFile(sixStates(), { heading: '# SCR-1 Meeting detail ##' })).name, 'SCR-1 Meeting detail');
    for (const heading of ['## SCR-1 Meeting detail', '#SCR-1', 'SCR-1 Meeting detail', '#   ']) {
      assert.equal(Object.hasOwn(draw(screenFile(sixStates(), { heading })), 'name'), false, heading);
    }
  });

  test('a file whose state table cannot be read fails at the line it cannot read, or at the file', () => {
    // No state table at all: the file, with no line.
    failsAt('# SCR-1 Meeting detail\n\nNo table.\n', null);
    failsAt(screenFile([['normal', 'A state with no screen.', '-']]), null);
    failsAt(`${'```\n'}${screenFile(sixStates())}${'```\n'}`, null);
    // A row of another number of cells, or whose first cell is not a state ID, fails at its line.
    failsAt(screenFile([...sixStates(), '| SCR-1#late | Two cells |']), 11);
    failsAt(screenFile([sixStates()[0], ['SCR-1#loading', 'Four', 'cells', '-']]), 6);
    for (const state of ['normal', 'SCR-1', 'SCR-1#Normal', 'scr-1#normal', 'SCR-1#', '`SCR-1#normal`', `SCR-1#${'a'.repeat(32)}`]) {
      failsAt(screenFile([sixStates()[0], [state, 'A state.', '-']]), 6);
    }
    // A header or separator that is not of three cells fails at its line.
    failsAt(['| State | Description |', '| --- | --- | --- |', '| SCR-1#normal | The list. | - |'].join('\n'), 1);
    failsAt(['| State | Description | From responses |', '| --- | --- |', '| SCR-1#normal | The list. | - |'].join('\n'), 2);
    // 5000 states draw; one more fails at the file.
    const states = (count) => screenFile(Array.from({ length: count }, (_, n) => [`SCR-1#s${n}`, '', '-']));
    assert.equal(draw(states(5000)).elements.length, 5000);
    failsAt(states(5001), null);
  });

  test('a panel keeps the state as its key; a state the table names twice gets #2; the drawing is the same each time', () => {
    const rows = [['SCR-1#normal', 'One.', '-'], ['SCR-1#empty', 'Two.', '-'], ['SCR-1#normal', 'Three.', '-'], ['SCR-2#normal', 'Four.', '-']];
    const drawing = draw(screenFile(rows));
    assert.deepEqual(drawing, draw(screenFile(rows)));
    assert.deepEqual(drawing.elements.map(({ key, name }) => [key, name]), [
      ['SCR-1#normal', 'SCR-1#normal'], ['SCR-1#empty', 'SCR-1#empty'], ['SCR-1#normal#2', 'SCR-1#normal'], ['SCR-2#normal', 'SCR-2#normal'],
    ]);
    assert.ok(drawing.elements.every((element) => !Object.hasOwn(element, 'trace_id') && element.kind === 'state'));
    // A state keeps its key when the rows move.
    const moved = draw(screenFile([rows[1], rows[0]]));
    assert.deepEqual(moved.elements.map(({ key }) => key), ['SCR-1#empty', 'SCR-1#normal']);
    // A long path is cut in a panel's where to the path alone, as a failure's where is.
    const deep = `${'d/'.repeat(146)}SCR-1.md`;
    assert.equal(draw(screenFile(rows), deep).elements[0].detail.where, deep);
  });

  test('the drawer reads no warnings and no other document', () => {
    let touched = false;
    const given = { stage: STAGE, part: '', key: FILE, kind: 'screen_states', source: FILE, text: screenFile(sixStates()) };
    Object.defineProperty(given, 'warnings', { get() { touched = true; return []; } });
    given.read = () => { touched = true; return null; };
    screenStates(given);
    assert.equal(touched, false);
  });
});

describe('screen states through the push', () => {
  let folder;
  let db;
  let headers;
  let server;
  const clock = { now: START };

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-screen-states-'));
    ({ db } = openStore(folder));
    const secret = randomBytes(32).toString('base64url');
    const { lastInsertRowid } = db.prepare('INSERT INTO agent_credentials (name, secret_digest, issued_at) VALUES (?, ?, ?)')
      .run('push-job', sha256(secret), new Date(START).toISOString());
    headers = { 'CF-Access-Client-Id': idOf('ac', Number(lastInsertRowid)), 'CF-Access-Client-Secret': secret };
    // The server's own screen-states drawer, alone, so that the counts are its own.
    server = await startServer({ store: db, now: () => clock.now, routes: snapshotRoutes({ drawers: { screen_states: DRAWERS.screen_states } }) });
  });

  after(async () => {
    await server.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  // A 0.3 snapshot of this repository whose stage-08 pictures are the files given, each { key, text }.
  function snapshotWith(name, files, { commit = newCommit(), replaces } = {}) {
    const snapshot = repositorySnapshot(FORMAT_03, { name, commit, replaces });
    const { time } = snapshot.repos['.'].default;
    snapshot.pictures = [
      ...snapshot.pictures.filter((picture) => picture.stage !== STAGE),
      ...files.map(({ key, text }) => ({ part: '', stage: STAGE, key, commit, time, source: { text } })),
    ];
    return snapshot;
  }

  const storedFiles = () => storedPictures().pictures.map(({ key, source }) => ({ key, text: source.text }));

  async function push(snapshot) {
    clock.now += 1000;
    return server.send({ method: 'POST', path: '/api/snapshots', headers: { ...JSON_TYPE, ...headers }, body: JSON.stringify(snapshot) });
  }

  const diagramsOf = (name) => db.prepare(
    'SELECT d.* FROM diagrams d JOIN project_spaces p ON p.id = d.project_id WHERE p.name = ? AND d.stage = ? ORDER BY d.id',
  ).all(name, STAGE);
  const drawings = (diagramId) => db.prepare('SELECT * FROM drawings WHERE diagram_id = ? ORDER BY id').all(diagramId).map((row) => ({ ...row }));
  const elements = (drawingId) => db.prepare(
    'SELECT element_key, trace_id, kind, name, parent_key, status, detail FROM elements WHERE drawing_id = ? ORDER BY id',
  ).all(drawingId).map((row) => ({ ...row, detail: JSON.parse(row.detail) }));
  // The rows the store keeps of a drawer's elements.
  const rowsOf = (drawn) => drawn.map((element) => ({
    element_key: element.key, trace_id: element.trace_id ?? null, kind: element.kind, name: element.name, parent_key: element.parent ?? null,
    status: element.status ?? null, detail: element.detail,
  }));

  test('the push draws this repository\'s 5 screens as the stored expected panels, with the server\'s own drawer', async () => {
    const files = storedFiles();
    const answer = await push(snapshotWith('screens-repository', files));
    assert.equal(answer.status, 201);
    assert.deepEqual([answer.json.diagrams, answer.json.failures], [counted({ drawn: 5 }), []]);
    const diagrams = diagramsOf('screens-repository');
    const { drawings: expected } = storedDrawings();
    assert.deepEqual(diagrams.map(({ kind, name, source_key: key }) => [kind, name, key]), expected.map(({ name, key }) => ['screen_states', name, key]));
    let total = 0;
    for (const [index, diagram] of diagrams.entries()) {
      const [drawing] = drawings(diagram.id);
      assert.equal(drawing.status, 'drawn');
      const kept = elements(drawing.id);
      assert.deepEqual(kept, rowsOf(expected[index].elements));
      total += kept.length;
      // The drawer reads its own file alone, so the digest is the file's.
      assert.equal(drawing.source_digest, sha256(JSON.stringify([[diagram.source_key, sha256(files[index].text)]])));
    }
    assert.equal(total, 39);
  });

  test('a state without a description reaches the store as an empty panel, marked', async () => {
    const answer = await push(snapshotWith('screens-empty', [{ key: FILE, text: screenFile([['SCR-1#normal', 'The list.', 'API-1#200'], ['SCR-1#empty', '', 'API-1#200']]) }]));
    assert.deepEqual(answer.json.diagrams, counted({ drawn: 1 }));
    const [diagram] = diagramsOf('screens-empty');
    assert.deepEqual([diagram.name, diagram.source_key], ['SCR-1 Meeting detail', FILE]);
    assert.deepEqual(elements(drawings(diagram.id)[0].id).map(({ element_key: key, status, detail }) => [key, status, detail.description, detail.responses]), [
      ['SCR-1#normal', null, 'The list.', ['API-1#200']],
      ['SCR-1#empty', 'no_description', '', ['API-1#200']],
    ]);
  });

  test('a screen file whose state table cannot be read keeps its last good drawing and is named in failures with its line', async () => {
    const name = 'screens-failed';
    const files = storedFiles();
    const broken = files.map((file) => (file.key === `${FOLDER}SCR-142.md`
      ? { ...file, text: file.text.replace('| SCR-142#loading |', '| SCR-142#loading | | | |') }
      : file));
    const [a, b, c, d] = [newCommit(), newCommit(), newCommit(), newCommit()];
    assert.deepEqual((await push(snapshotWith(name, files, { commit: a }))).json.diagrams, counted({ drawn: 5 }));
    const answer = await push(snapshotWith(name, broken, { commit: b, replaces: a }));
    const diagram = diagramsOf(name)[0];
    assert.deepEqual([answer.json.diagrams, answer.json.failures], [counted({ failed: 1, unchanged: 4 }), [
      { diagram: idOf('dg', Number(diagram.id)), part: '', stage: STAGE, where: `${FOLDER}SCR-142.md:31` },
    ]]);
    const [good, failed] = drawings(diagram.id);
    assert.deepEqual([good.status, failed.status, failed.failed_path, failed.failed_line], ['drawn', 'failed', `${FOLDER}SCR-142.md`, 31]);
    assert.deepEqual(elements(failed.id), []);
    assert.equal(elements(good.id).length, 6);
    // The diagram keeps its name, and the same file failing again makes no new drawing.
    assert.equal(diagramsOf(name)[0].name, 'SCR-142 Owner to-do');
    assert.deepEqual((await push(snapshotWith(name, broken, { commit: c, replaces: b }))).json.diagrams, counted({ failed: 1, unchanged: 4 }));
    assert.equal(drawings(diagram.id).length, 2);
    // The file read again draws again.
    assert.deepEqual((await push(snapshotWith(name, files, { commit: d, replaces: c }))).json.diagrams, counted({ drawn: 1, unchanged: 4 }));
    assert.deepEqual(elements(drawings(diagram.id).at(-1).id), elements(good.id));
  });

  test('no log line holds a screen file\'s text (rule 5)', async () => {
    const marker = `state_${randomBytes(8).toString('hex')}`;
    const text = screenFile([['SCR-1#normal', marker, `API-1#200 (${marker})`], `| SCR-1#${marker} | ${marker} |`], { heading: `# SCR-1 ${marker}` });
    const answer = await push(snapshotWith('screens-logs', [{ key: `${FOLDER}SCR-1.md`, text }]));
    assert.deepEqual(answer.json.diagrams, counted({ failed: 1 }));
    const logs = server.logText();
    assert.ok(logs.includes('pushSnapshot'));
    assert.equal(logs.includes(marker), false);
  });
});

test('the screen-states drawer is drawing.js\'s drawer of the screen_states kind', () => {
  assert.equal(DRAWERS.screen_states, screenStates);
});
