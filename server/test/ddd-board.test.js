// The DDD board drawer (TASK-421; SPEC-003; TBL-151, TBL-152, TBL-153): the stage-01 picture drawn as one board of its
// timeline lanes, its contexts with their command tables, the dependencies and the hotspots, placed by layout.js. The
// done condition:
// - This repository's stage 01 draws as a stored expected drawing. test/ddd-board-picture.json is the pinned hub's
//   picture of the stage-01 documents with their SHA-256, which tests/test_ddd_board_picture.py checks against the
//   pinned hub; this test fails when a stage-01 document changes and the picture does not. test/ddd-board-expected.json
//   is its drawing, compared exactly, so this test fails when the drawing changes and the file does not. To make both
//   again, from the repository's root:
//       CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_ddd_board_picture.py --write
//       (cd server && node test/ddd-board-expected.js --write)
// - A table that cannot be read is left out and shown with its file and line: the hub's domain.py reads the document,
//   leaves out what it cannot read and names it in a picture-partial check of the snapshot, which the drawing shows
//   with its file and line; an entry of the picture the drawer cannot read is left out and marked with its own.
// The pictures and checks of the cases that break are made here.

import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { dddBoard, REGIONS } from '../src/ddd-board.js';
import { DRAWERS, pictureWarnings, SourceFailure } from '../src/drawing.js';
import { idOf } from '../src/ids.js';
import { snapshotRoutes } from '../src/snapshots.js';
import { openStore } from '../src/store.js';
import { drawingOf, STAGE, storedDrawing, storedPicture } from './ddd-board-expected.js';
import { FORMAT_02, newCommit, repositorySnapshot } from './snapshots.js';
import { startServer } from './support.js';

const START = Date.parse('2026-11-24T04:00:00.000Z');
const JSON_TYPE = { 'Content-Type': 'application/json' };
const SOURCE = '/pictures/01-domain/nexus';
const AGAIN = 'make test/ddd-board-picture.json and test/ddd-board-expected.json again as test/ddd-board.test.js says at its top';
const ROOT = new URL('../../', import.meta.url);
const STICKIES = ['read_model', 'command', 'aggregate', 'event', 'policy'];

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const counted = (diagrams) => ({ drawn: 0, unchanged: 0, failed: 0, removed: 0, ...diagrams });
const clone = (value) => JSON.parse(JSON.stringify(value));
const ofKind = (elements, kind, status = null) => elements.filter((element) => element.kind === kind && (element.status ?? null) === status);
const byKey = (elements) => new Map(elements.map((element) => [element.key, element]));

// A check of the snapshot as the pinned hub writes one (its hub.py check()).
const check = (rule, message, stage, part) => ({ rule, level: 'warn', message, by: 'scan', stage, ...(part === undefined ? {} : { part }) });
const partial = (message, part = 'nexus', stage = STAGE) => check('picture-partial', message, stage, part);

// Draws a picture of stage 01 as the push gives it, with the warnings of checks.
function draw(picture, checks = []) {
  return drawingOf({ source: 'docs/01-domain/', part: 'nexus', checks, picture });
}

// A picture with what the hub always sends filled in. A context is { id, name, rows }, a row { command, ... }.
function pictureOf({ contexts = [], timeline, dependencies = [], hotspots = [], aggregates = [], readModels = [] } = {}) {
  return {
    format: 1,
    contexts: contexts.map((context, index) => ({
      id: '', name: '', type: 'core', purpose: '', removed: false, external: '', where: `docs/01-domain/nexus.md:${index * 100 + 1}`,
      ...context,
      rows: (context.rows ?? []).map((row, at) => ({
        given_by: 'Owner', policy: false, read_model: '', command: '', aggregate: '', events: [], where: `docs/01-domain/nexus.md:${index * 100 + at + 2}`, ...row,
      })),
    })),
    aggregates,
    read_models: readModels,
    dependencies: dependencies.map((dependency, index) => ({ kind: 'call', why: '', data: '', where: `docs/01-domain/nexus.md:${900 + index}`, ...dependency })),
    hotspots: hotspots.map((hotspot, index) => ({ contexts: [], state: '', answer: '', where: `docs/01-domain/nexus.md:${950 + index}`, ...hotspot })),
    ...(timeline === undefined ? {} : { timeline: timeline.map((lane, index) => ({ where: `docs/01-domain/nexus.md:${980 + index}`, ...lane })) }),
  };
}

// Whether a point lies on the outline of a box, within the layout's rounding.
function onOutline({ x, y }, box) {
  const near = (a, b) => Math.abs(a - b) < 0.02;
  const inside = x >= box.x - 0.02 && x <= box.x + box.width + 0.02 && y >= box.y - 0.02 && y <= box.y + box.height + 0.02;
  return inside && (near(x, box.x) || near(x, box.x + box.width) || near(y, box.y) || near(y, box.y + box.height));
}
const within = (inner, outer) => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width
  && inner.y + inner.height <= outer.y + outer.height;
const apart = (a, b) => a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
const bottomOf = (boxes) => Math.max(...boxes.map(({ y, height }) => y + height));
const topOf = (boxes) => Math.min(...boxes.map(({ y }) => y));

// The Markdown files of the stage-01 source that the hub reads: a translation beside its original left out.
function stageDocuments(source) {
  const names = readdirSync(new URL(source, ROOT), { recursive: true }).map((name) => `${source}${name.replaceAll('\\', '/')}`)
    .filter((name) => /\.(?:md|markdown)$/i.test(name)).sort();
  const present = new Set(names);
  return names.filter((name) => {
    const found = /^(.*)\.[A-Za-z]{2,3}(?:-[A-Za-z0-9]+)*(\.(?:md|markdown))$/.exec(name);
    return found === null || !present.has(`${found[1]}${found[2]}`);
  });
}

describe('the DDD board drawer', () => {
  test('the stored picture is the pinned hub\'s picture of the stage-01 documents as they are now', () => {
    const stored = storedPicture();
    assert.equal(stored.source, 'docs/01-domain/');
    assert.deepEqual(stored.documents.map(({ path }) => path), stageDocuments(stored.source), `the stage-01 documents changed: ${AGAIN}`);
    for (const { path, sha256: digest } of stored.documents) {
      assert.equal(digest, sha256(readFileSync(new URL(path, ROOT))), `${path} changed since test/ddd-board-picture.json was made: ${AGAIN}`);
    }
  });

  test('this repository\'s stage 01 draws as the stored expected drawing', () => {
    const stored = storedPicture();
    const drawing = drawingOf(stored);
    assert.deepStrictEqual(drawing, storedDrawing(), `the drawing of test/ddd-board-picture.json changed: ${AGAIN}`);
    const { elements } = drawing;
    const keyed = byKey(elements);
    const { picture } = stored;

    // SPEC-003: the 7 contexts and the 7 lanes of the document, each in its order.
    const contexts = ofKind(elements, 'context');
    assert.deepEqual(contexts.map((context) => [context.trace_id, context.name]), picture.contexts.map(({ id, name }) => [id, name]));
    assert.equal(contexts.length, 7);
    const lanes = ofKind(elements, 'lane');
    assert.deepEqual(lanes.map((lane) => [lane.name, lane.detail.where]), picture.timeline.map(({ lane, where }) => [lane, where]));
    assert.equal(lanes.length, 7);
    // Each lane's events, place by place, inside its band.
    for (const [index, lane] of lanes.entries()) {
      const events = elements.filter((element) => element.kind === 'event' && element.parent === lane.key);
      assert.deepEqual(events.map(({ name, detail }) => [detail.place, name]), picture.timeline[index].places.flatMap((names, at) => names.map((name) => [at + 1, name])));
      for (const event of events) assert.ok(within(event.detail.box, lane.detail.box), `${event.key} lies in its lane`);
      const columns = events.map(({ detail }) => [detail.place, detail.box.x]);
      for (const [place, x] of columns) for (const [other, otherX] of columns) if (place < other) assert.ok(x < otherX, 'a later place lies to the right');
    }

    // Each context's command tables, row by row, a sticky for each name in the order of the bands, inside the frame.
    const terms = new Map([...picture.aggregates, ...picture.read_models].map(({ context, name, term }) => [`${context}\n${name}`, term]));
    for (const [index, context] of contexts.entries()) {
      const stickies = elements.filter((element) => element.parent === context.key && STICKIES.includes(element.kind));
      const expected = picture.contexts[index].rows.flatMap((row) => {
        const names = (cell) => cell.split(/\s*,\s*/).filter((name) => name !== '');
        const policy = row.policy ? row.given_by.replace(/^.*?Policy:\s*/, '') : null;
        return [
          ...names(row.read_model).map((name) => ['read_model', name, terms.get(`${context.trace_id}\n${name}`)]),
          ['command', row.command, undefined],
          ...names(row.aggregate).map((name) => ['aggregate', name, terms.get(`${context.trace_id}\n${name}`)]),
          ...row.events.map((name) => ['event', name, undefined]),
          ...(policy === null ? [] : [['policy', policy, undefined]]),
        ];
      });
      assert.deepEqual(stickies.map(({ kind, name, trace_id: traceId }) => [kind, name, traceId]), expected);
      const header = { ...context.detail.box, y: context.detail.box.y + 32, height: context.detail.box.height - 32 };
      for (const sticky of stickies) {
        assert.ok(within(sticky.detail.box, header), `${sticky.key} lies in its frame, below its header`);
        assert.deepEqual([sticky.detail.box.width, sticky.detail.box.height], [148, 80]);
      }
      // The bands lie one under another: every read model above every command, and so on.
      for (const a of stickies) {
        for (const b of stickies) {
          if (a !== b) assert.ok(apart(a.detail.box, b.detail.box), `${a.key} and ${b.key} do not overlap`);
          if (STICKIES.indexOf(a.kind) < STICKIES.indexOf(b.kind)) assert.ok(a.detail.box.y < b.detail.box.y, `${a.key} lies above ${b.key}`);
        }
      }
    }
    // The read model cell "Diagram view, Diff view" is two stickies, each with its term.
    const confirm = elements.filter((element) => element.key.startsWith('CTX-039/command:Confirm diagram/read_model:'));
    assert.deepEqual(confirm.map(({ name, trace_id: traceId }) => [name, traceId]), [['Diagram view', 'TERM-222'], ['Diff view', 'TERM-224']]);
    // A row given by a policy: its command has the actor before it, and the policy is what follows "Policy:".
    const reflected = elements.filter((element) => element.key.startsWith('CTX-038/') && ['command', 'policy'].includes(element.kind))
      .filter(({ key }) => picture.contexts[1].rows.some((row) => row.given_by.startsWith('Owner; Policy:') && key.startsWith(`CTX-038/command:${row.command}`)));
    assert.deepEqual(reflected.map(({ kind, name, detail }) => [kind, name, detail.actor]), [
      ['command', picture.contexts[1].rows.find((row) => row.given_by.startsWith('Owner; Policy:')).command, 'Owner'],
      ['policy', 'when Change reflected', undefined],
    ]);

    // One external box for each name a dependency gives that is no context, "Every context" included, and a line for
    // each dependency from the box of its start to the box of its end.
    const externals = ofKind(elements, 'external');
    assert.deepEqual(externals.map(({ name }) => name).sort(), ['Agent (corthex-hub)', 'Every context', 'Miro', 'Notion, Jira']);
    const lines = ofKind(elements, 'dependency');
    assert.equal(lines.length, 16);
    const endOf = (name) => (/^CTX-\d+$/.test(name) ? name : `external:${name}`);
    lines.forEach((line, index) => {
      const { from, to, kind, why, data, where } = picture.dependencies[index];
      assert.deepEqual([line.parent, line.detail.from, line.detail.to, line.name], [endOf(from), endOf(from), endOf(to), why]);
      assert.deepEqual([line.detail.kind, line.detail.why, line.detail.data, line.detail.where], [kind, why, data, where]);
      assert.ok(onOutline(line.detail.points[0], keyed.get(line.detail.from).detail.box), `${line.key} starts on its box`);
      assert.ok(onOutline(line.detail.points.at(-1), keyed.get(line.detail.to).detail.box), `${line.key} ends on its box`);
    });

    // Each hotspot in the frame of the first context it names, or in the Hotspots lane, answered or open by its state.
    const hotspots = ofKind(elements, 'hotspot', 'answered').concat(ofKind(elements, 'hotspot', 'open'));
    assert.equal(hotspots.length, 14);
    const [lane] = ofKind(elements, 'hotspot_lane');
    for (const entry of picture.hotspots) {
      const hotspot = hotspots.find(({ name }) => name === entry.text);
      assert.equal(hotspot.parent, entry.contexts[0] ?? lane.key);
      assert.equal(hotspot.status, entry.state.startsWith('answered') ? 'answered' : 'open');
      assert.deepEqual(hotspot.detail.contexts, entry.contexts);
      assert.ok(within(hotspot.detail.box, keyed.get(hotspot.parent).detail.box), `${hotspot.key} lies in its frame or lane`);
    }
    assert.deepEqual([lane.name, hotspots.filter(({ parent }) => parent === lane.key).length], ['Hotspots', 1]);

    // The regions one under another in the order of REGIONS, and no two boxes of the contexts overlap.
    const frames = [...contexts, ...externals].map(({ detail }) => detail.box);
    assert.ok(bottomOf(lanes.map(({ detail }) => detail.box)) < topOf(frames));
    assert.ok(bottomOf(frames) < lane.detail.box.y);
    frames.forEach((a, i) => frames.slice(i + 1).forEach((b) => assert.ok(apart(a, b))));
    assert.equal(ofKind(elements, 'table', 'left_out').length, 0);
    assert.equal(elements.length, 216);
  });

  test('the drawing is the same each time, and its elements keep their keys when the contexts and lanes move', () => {
    const { picture } = storedPicture();
    assert.deepStrictEqual(draw(picture), draw(clone(picture)));
    const moved = clone(picture);
    moved.contexts.reverse();
    moved.timeline.reverse();
    moved.hotspots.reverse();
    const keysOf = (drawing) => drawing.elements.map((element) => element.key).sort();
    assert.deepEqual(keysOf(draw(moved)), keysOf(draw(picture)));
  });

  test('SPEC-003: a domain document with 7 contexts and 7 lanes draws 7 contexts and 7 lanes', () => {
    const seven = [1, 2, 3, 4, 5, 6, 7];
    const { elements } = draw(pictureOf({
      contexts: seven.map((n) => ({ id: `CTX-${n}`, name: `Context ${n}`, rows: [{ command: `Do ${n}`, aggregate: `Thing ${n}`, events: [`Done ${n}`] }] })),
      timeline: seven.map((n) => ({ lane: `Lane ${n}`, places: [[`Done ${n}`]] })),
    }));
    assert.deepEqual([ofKind(elements, 'context').length, ofKind(elements, 'lane').length], [7, 7]);
    assert.deepEqual(ofKind(elements, 'context').map(({ key }) => key), seven.map((n) => `CTX-${n}`));
  });

  test('a table the hub left out is shown with its file and line, and the warnings are read once the board is placed', () => {
    const picture = pictureOf({ contexts: [{ id: 'CTX-1', name: 'One', rows: [{ command: 'Do' }] }] });
    const { elements } = draw(picture, [
      partial('docs/01-domain/nexus.md:120: command table is under no context heading'),
      partial('docs/01-domain/other.md:1: document has no context heading'),
      check('picture-partial', 'docs/01-domain/big.md: source object is unreadable or exceeds 1 MB', STAGE),
      partial('db/nexus.sql:9: a statement of stage 05', 'nexus', '05-erd'),
    ]);
    assert.deepEqual(ofKind(elements, 'table', 'left_out').map(({ key, name, detail }) => [key, name, detail]), [
      ['table:command table is under no context heading', 'command table is under no context heading', { where: 'docs/01-domain/nexus.md:120' }],
      ['table:document has no context heading', 'document has no context heading', { where: 'docs/01-domain/other.md:1' }],
      ['table:source object is unreadable or exceeds 1 MB', 'source object is unreadable or exceeds 1 MB', { where: 'docs/01-domain/big.md' }],
    ]);

    // A picture that fails, whether at its form, its size or its placing, has not read them.
    const failing = [
      { format: 2, contexts: [] },
      pictureOf({ contexts: Array.from({ length: 5001 }, (_, n) => ({ id: `CTX-${n + 1}`, name: `C${n}` })) }),
      pictureOf({ contexts: [{ id: 'CTX-1', name: 'Wide', rows: Array.from({ length: 700 }, (_, n) => ({ command: `Do ${n}` })) }] }),
    ];
    for (const failed of failing) {
      let read = false;
      const given = { stage: STAGE, part: 'nexus', key: null, kind: 'ddd_board', source: 'docs/01-domain/', text: JSON.stringify(failed), read: () => null };
      Object.defineProperty(given, 'warnings', { get() { read = true; return []; } });
      assert.throws(() => dddBoard(given), SourceFailure);
      assert.equal(read, false);
    }
  });

  test('an entry of the picture the drawer cannot read is left out and marked with its where', () => {
    const picture = pictureOf({
      contexts: [{ id: 'CTX-1', name: 'One', rows: [{ command: 'Do', events: ['Done'] }] }, { id: 'CTX-2', name: 'Two' }],
      timeline: [{ lane: 'Good', places: [['Done']] }],
      hotspots: [{ text: '1. Fine?', contexts: ['CTX-2'] }],
    });
    picture.contexts[1].rows = 'not a list';
    picture.contexts[0].rows.push({ command: 'Broken', events: 'not a list', where: 'docs/01-domain/nexus.md:7' });
    picture.timeline.push({ lane: 'Broken lane', places: 'not a list', where: 'docs/01-domain/nexus.md:8' });
    picture.hotspots.push({ text: 'Broken hotspot', number: -1, where: 'docs/01-domain/nexus.md:9' });
    picture.dependencies.push({ from: 'CTX-1', to: '', why: 'Broken line', where: 'docs/01-domain/nexus.md:10' });
    picture.contexts.push(42);
    const { elements } = draw(picture);
    const marked = elements.filter(({ status }) => status === 'unreadable');
    assert.deepEqual(marked.map(({ kind, name, detail }) => [kind, name, detail.where]), [
      ['lane', 'Broken lane', 'docs/01-domain/nexus.md:8'],
      ['command', 'Broken', 'docs/01-domain/nexus.md:7'],
      ['context', 'Two', 'docs/01-domain/nexus.md:101'],
      ['context', '', null],
      ['dependency', 'Broken line', 'docs/01-domain/nexus.md:10'],
      ['hotspot', 'Broken hotspot', 'docs/01-domain/nexus.md:9'],
    ]);
    const keyed = byKey(elements);
    // The unreadable context is an empty frame that still holds the hotspot naming it, the unreadable row a command
    // sticky of its context, and the unreadable hotspot stands in the Hotspots lane; the unreadable line has no box.
    assert.equal(elements.find(({ name }) => name === '1. Fine?').parent, 'CTX-2');
    assert.equal(keyed.get('CTX-1/command:Broken').parent, 'CTX-1');
    assert.equal(elements.find(({ name }) => name === 'Broken hotspot').parent, 'hotspot_lane:Hotspots');
    assert.equal(elements.find(({ name }) => name === 'Broken line').detail.box, undefined);
    for (const element of marked.filter(({ kind }) => kind !== 'dependency')) assert.ok(element.detail.box.width > 0);
  });

  test('a hotspot stands in the first context it names that the board draws, or else in the Hotspots lane', () => {
    const contexts = [{ id: 'CTX-1', name: 'One', rows: [{ command: 'Do' }] }, { id: 'CTX-2', name: 'Two', rows: [{ command: 'Go' }] }];
    const { elements } = draw(pictureOf({
      contexts,
      hotspots: [
        { text: '1. Both?', contexts: ['CTX-9', 'CTX-2', 'CTX-1'], state: 'answered, one open question' },
        { text: '2. Nowhere?', contexts: ['CTX-9'], state: 'reviewed in stage 02' },
        { text: '3. None?', contexts: [], state: 'Answered' },
        { text: '4. Open?', contexts: ['CTX-1'], state: 'open' },
        // A Korean domain document writes "answered" as "답함", and the hub reads its tables as it reads English ones.
        { text: '5. 한국어?', contexts: ['CTX-2'], state: '답함, 열린 질문 하나' },
        { text: '6. 다시?', contexts: ['CTX-2'], state: '02단계에서 다시 봄' },
      ],
    }));
    assert.deepEqual(ofKind(elements, 'hotspot', 'answered').concat(ofKind(elements, 'hotspot', 'open'))
      .map(({ key, parent, status, detail }) => [key, parent, status, detail.number]).sort(), [
      ['hotspot:Both?', 'CTX-2', 'answered', null],
      ['hotspot:None?', 'hotspot_lane:Hotspots', 'answered', null],
      ['hotspot:Nowhere?', 'hotspot_lane:Hotspots', 'open', null],
      ['hotspot:Open?', 'CTX-1', 'open', null],
      ['hotspot:다시?', 'CTX-2', 'open', null],
      ['hotspot:한국어?', 'CTX-2', 'answered', null],
    ]);
    // A hotspot stands in its frame's aggregate band, after the frame's rows.
    const keyed = byKey(elements);
    const open = keyed.get('hotspot:Open?').detail.box;
    assert.ok(open.x > keyed.get('CTX-1/command:Do').detail.box.x);
    // With every hotspot in a frame, there is no Hotspots lane.
    const framed = draw(pictureOf({ contexts, hotspots: [{ text: 'In one', contexts: ['CTX-1'] }] })).elements;
    assert.deepEqual(ofKind(framed, 'hotspot_lane'), []);
  });

  test('a dependency names a context by its trace ID or its name, and any other name is one external system', () => {
    const { elements } = draw(pictureOf({
      contexts: [{ id: 'CTX-1', name: 'Diagram' }, { id: 'CTX-2', name: 'Review' }],
      dependencies: [
        { from: 'CTX-1 Diagram', to: 'review', kind: 'event', why: 'Tell' },
        { from: 'Miro', to: 'CTX-2', why: 'Import' },
        { from: 'Miro', to: 'CTX-1', why: 'Import again' },
        { from: 'Every context', to: 'CTX-2', why: 'All' },
        { from: 'CTX-12', to: 'CTX-1', why: 'Not CTX-1' },
      ],
    }));
    assert.deepEqual(ofKind(elements, 'external').map(({ key }) => key), ['external:Miro', 'external:Every context', 'external:CTX-12']);
    assert.deepEqual(ofKind(elements, 'dependency').map(({ key, detail }) => [key, detail.from, detail.to, detail.kind]), [
      ['CTX-1/dependency:CTX-2 event', 'CTX-1', 'CTX-2', 'event'],
      ['external:Miro/dependency:CTX-2 call', 'external:Miro', 'CTX-2', 'call'],
      ['external:Miro/dependency:CTX-1 call', 'external:Miro', 'CTX-1', 'call'],
      ['external:Every context/dependency:CTX-2 call', 'external:Every context', 'CTX-2', 'call'],
      ['external:CTX-12/dependency:CTX-1 call', 'external:CTX-12', 'CTX-1', 'call'],
    ]);
  });

  test('a row\'s cells: several names, terms by context, a removed term, a policy, and cells that name nothing', () => {
    const { elements } = draw(pictureOf({
      contexts: [
        { id: 'CTX-1', name: 'One', rows: [
          { given_by: 'Policy: when Done', policy: true, read_model: 'List, Detail (TERM-3)<br>-', command: 'Do', aggregate: 'Thing', events: ['Done', 'or Failed'] },
          { given_by: 'Agent', read_model: 'none', command: '-', aggregate: 'Old thing', events: [] },
        ] },
        { id: 'CTX-2', name: 'Two', rows: [{ command: 'Do', aggregate: 'Thing' }] },
      ],
      aggregates: [
        { name: 'Thing', context: 'CTX-1', removed: false, term: 'TERM-1', where: 'x' },
        { name: 'Old thing', context: 'CTX-1', removed: true, term: 'TERM-2', where: 'x' },
        { name: 'thing', context: 'CTX-2', removed: false, term: 'TERM-9', where: 'x' },
      ],
      readModels: [{ name: 'Detail', context: 'CTX-1', removed: false, term: 'TERM-3', where: 'x' }],
    }));
    const stickies = elements.filter(({ kind }) => STICKIES.includes(kind));
    assert.deepEqual(stickies.map(({ key, trace_id: traceId, status, detail }) => [key, traceId ?? null, status ?? null, detail.actor ?? null]), [
      ['CTX-1/command:Do/read_model:List', null, null, null],
      ['CTX-1/command:Do/read_model:Detail', 'TERM-3', null, null],
      ['CTX-1/command:Do', null, null, ''],
      ['CTX-1/command:Do/aggregate:Thing', 'TERM-1', null, null],
      ['CTX-1/command:Do/event:Done', null, null, null],
      ['CTX-1/command:Do/event:or Failed', null, null, null],
      ['CTX-1/command:Do/policy:when Done', null, null, null],
      ['CTX-1/command:-/aggregate:Old thing', 'TERM-2', 'removed', null],
      ['CTX-2/command:Do', null, null, 'Owner'],
      ['CTX-2/command:Do/aggregate:Thing', 'TERM-9', null, null],
    ]);
  });

  test('a row\'s cells as the hub reads them: a TERM ID anywhere in a name, a term ID too long for one, and a policy that names nothing', () => {
    const long = `${'A'.repeat(29)}-1`;
    const picture = pictureOf({
      contexts: [{ id: 'CTX-1', name: 'One', rows: [
        { given_by: 'Agent, Policy:', policy: true, read_model: 'Board TERM-5', command: 'Do', aggregate: 'Shape (TERM-4), Hash (SHA-256)' },
        { given_by: 'Policy: -', policy: true, command: 'Go', aggregate: 'Long' },
      ] }],
      // The hub drops each explicit TERM ID from a name and keeps any other trace ID, as these names show.
      aggregates: [
        { name: 'Shape', context: 'CTX-1', removed: false, term: 'TERM-4', where: 'x' },
        { name: 'Hash (SHA-256)', context: 'CTX-1', removed: false, where: 'x' },
        { name: 'Long', context: 'CTX-1', removed: true, term: long, where: 'x' },
      ],
      readModels: [{ name: 'Board', context: 'CTX-1', removed: false, term: 'TERM-5', where: 'x' }],
    });
    const { elements } = draw(picture);
    const stickies = elements.filter(({ kind }) => STICKIES.includes(kind));
    assert.deepEqual(stickies.map(({ key, trace_id: traceId, status, detail }) => [key, traceId ?? null, status ?? null, detail.actor ?? null]), [
      ['CTX-1/command:Do/read_model:Board', 'TERM-5', null, null],
      ['CTX-1/command:Do', null, null, 'Agent'],
      ['CTX-1/command:Do/aggregate:Shape', 'TERM-4', null, null],
      ['CTX-1/command:Do/aggregate:Hash (SHA-256)', null, null, null],
      ['CTX-1/command:Go', null, null, ''],
      // A term ID longer than a trace ID may be is no trace ID, so the sticky has none, though its term is removed.
      ['CTX-1/command:Go/aggregate:Long', null, 'removed', null],
    ]);
    // So the push takes the drawing: every trace ID keeps to the contract's form and its 30 characters.
    assert.ok(elements.every(({ trace_id: traceId }) => traceId === undefined || traceId === null
      || (traceId.length <= 30 && /^[A-Z][A-Z0-9]*-[0-9]{1,6}$/.test(traceId))));
  });

  test('a picture not in format 1 with a list of contexts, with parts that are not lists or more than 5000 elements, fails at its source', () => {
    for (const picture of [
      null, [], { format: 2, contexts: [] }, { format: 1 }, { format: 1, contexts: {} }, { format: 1, contexts: [], timeline: {} },
      { format: 1, contexts: [], dependencies: 'none' }, { format: 1, contexts: [], hotspots: 3 }, { format: 1, contexts: [], aggregates: {} },
    ]) {
      assert.throws(() => draw(picture), SourceFailure);
    }
    // A picture of 5000 elements draws; one more, or a warning more, fails.
    const lanes = (count) => Array.from({ length: count }, (_, n) => ({ lane: `Lane ${n}`, places: [['A'], ['B'], ['C'], ['D']] }));
    assert.equal(draw(pictureOf({ timeline: lanes(1000) })).elements.length, 5000);
    assert.throws(() => draw(pictureOf({ timeline: [...lanes(1000), { lane: 'One more', places: [] }] })), SourceFailure);
    assert.throws(() => draw(pictureOf({ timeline: lanes(1000) }), [partial('docs/01-domain/nexus.md:3: left out')]), SourceFailure);
    // An empty picture draws an empty board.
    assert.deepEqual(draw(pictureOf()), { elements: [] });
  });

  test('the regions stand in the order of REGIONS', () => {
    assert.deepEqual(REGIONS, ['timeline', 'contexts', 'hotspots']);
  });
});

describe('the DDD board through the push', () => {
  let folder;
  let db;
  let headers;
  let server;
  const clock = { now: START };

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-ddd-'));
    ({ db } = openStore(folder));
    const secret = randomBytes(32).toString('base64url');
    const { lastInsertRowid } = db.prepare('INSERT INTO agent_credentials (name, secret_digest, issued_at) VALUES (?, ?, ?)')
      .run('push-job', sha256(secret), new Date(START).toISOString());
    headers = { 'CF-Access-Client-Id': idOf('ac', Number(lastInsertRowid)), 'CF-Access-Client-Secret': secret };
    // The server's own ddd_board drawer, alone, so that the counts are the board's.
    server = await startServer({ store: db, now: () => clock.now, routes: snapshotRoutes({ drawers: { ddd_board: DRAWERS.ddd_board } }) });
  });

  after(async () => {
    await server.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  // A snapshot of this repository whose stage-01 picture and checks are given.
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

  test('the push draws this repository\'s DDD board as the stored expected drawing, with the server\'s own drawer', async () => {
    const stored = storedPicture();
    const answer = await push(snapshotWith('ddd-repository', stored.picture, stored.checks));
    assert.equal(answer.status, 201);
    assert.deepEqual([answer.json.diagrams, answer.json.failures], [counted({ drawn: 1 }), []]);
    const diagram = diagramOf('ddd-repository');
    assert.deepEqual([diagram.kind, diagram.name, diagram.stage], ['ddd_board', 'DDD board', STAGE]);
    const [drawing] = drawings(diagram.id);
    assert.equal(drawing.status, 'drawn');
    assert.deepEqual(elements(drawing.id), rowsOf(storedDrawing().elements));
    // The hub left nothing out, so the digest is the picture's alone.
    assert.equal(drawing.source_digest, sha256(JSON.stringify([[SOURCE, sha256(JSON.stringify(stored.picture))]])));
  });

  test('a table the hub left out is shown with its file and line, and the warnings join the digest', async () => {
    const name = 'ddd-left-out';
    const { picture } = storedPicture();
    const checks = [partial('docs/01-domain/nexus.md:120: command table is under no context heading'), partial('db/nexus.sql:9: stage 05', 'nexus', '05-erd')];
    const [a, b, c] = [newCommit(), newCommit(), newCommit()];
    assert.deepEqual((await push(snapshotWith(name, picture, checks, { commit: a }))).json.diagrams, counted({ drawn: 1 }));
    const diagram = diagramOf(name);
    const [first] = drawings(diagram.id);
    assert.deepEqual(elements(first.id).filter((row) => row.kind === 'table').map((row) => [row.name, row.status, row.detail]), [
      ['command table is under no context heading', 'left_out', { where: 'docs/01-domain/nexus.md:120' }],
    ]);
    const warnings = pictureWarnings(checks, STAGE, 'nexus');
    const text = JSON.stringify(picture);
    assert.equal(first.source_digest, sha256(JSON.stringify([[SOURCE, sha256(text)], ['/snapshot#picture-partial', sha256(JSON.stringify(warnings))]])));
    // The same warnings with another commit draw nothing new; none draws again.
    assert.deepEqual((await push(snapshotWith(name, picture, clone(checks), { commit: b, replaces: a }))).json.diagrams, counted({ unchanged: 1 }));
    assert.deepEqual((await push(snapshotWith(name, picture, [], { commit: c, replaces: b }))).json.diagrams, counted({ drawn: 1 }));
    assert.deepEqual(elements(drawings(diagram.id).at(-1).id).filter((row) => row.kind === 'table'), []);
  });

  test('a picture in another format fails the drawing at its source, and the board keeps its last good drawing', async () => {
    const name = 'ddd-format';
    const { picture } = storedPicture();
    const [a, b, c] = [newCommit(), newCommit(), newCommit()];
    await push(snapshotWith(name, picture, [], { commit: a }));
    const answer = await push(snapshotWith(name, { format: 2, contexts: [] }, [], { commit: b, replaces: a }));
    const diagram = diagramOf(name);
    assert.deepEqual([answer.json.diagrams, answer.json.failures], [counted({ failed: 1 }),
      [{ diagram: idOf('dg', Number(diagram.id)), part: 'nexus', stage: STAGE, where: 'docs/01-domain/' }]]);
    const [good, failed] = drawings(diagram.id);
    assert.deepEqual([good.status, failed.status, failed.failed_path, failed.failed_line], ['drawn', 'failed', 'docs/01-domain/', null]);
    assert.deepEqual(elements(failed.id), []);
    assert.equal(elements(good.id).length, storedDrawing().elements.length);
    // The same picture failing again, whatever the hub left out, makes no new drawing.
    const again = await push(snapshotWith(name, { format: 2, contexts: [] }, [partial('docs/01-domain/nexus.md:3: left out')], { commit: c, replaces: b }));
    assert.deepEqual(again.json.diagrams, counted({ failed: 1 }));
    assert.equal(drawings(diagram.id).length, 2);
  });

  test('no log line holds the picture\'s text (rule 5)', async () => {
    const marker = `context_${randomBytes(8).toString('hex')}`;
    const picture = pictureOf({
      contexts: [{ id: 'CTX-1', name: marker, rows: [{ command: `${marker} command` }] }],
      dependencies: [{ from: `${marker} system`, to: 'CTX-1', why: marker }],
      hotspots: [{ text: `${marker}?` }],
    });
    await push(snapshotWith('ddd-logs', picture, [partial(`docs/01-domain/${marker}.md:4: ${marker} was left out`)]));
    const logs = server.logText();
    assert.ok(logs.includes('pushSnapshot'));
    assert.equal(logs.includes(marker), false);
  });
});

test('the ddd_board drawer is drawing.js\'s drawer of the ddd_board kind', () => {
  assert.equal(DRAWERS.ddd_board, dddBoard);
});
