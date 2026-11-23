// The user-flow drawer (TASK-424; SPEC-006; TBL-151, TBL-152, TBL-153): each flow file's Mermaid flowchart drawn as one
// diagram of its boxes, decisions and labelled arrows, placed by layout.js, with a parser of the flowchart subset
// written here. The done condition:
// - This repository's 13 flows draw as stored expected drawings. test/user-flow-pictures.json is the pinned hub's
//   corthex-hub/0.3 pictures of docs/03-user-flow with each file's SHA-256, which tests/test_user_flow_pictures.py checks
//   against the pinned hub; this test fails when a flow file changes and the pictures do not.
//   test/user-flow-expected.json is their drawings, compared exactly, so this test fails when a drawing changes and the
//   files do not. To make both again, from the repository's root:
//       CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_user_flow_pictures.py --write
//       (cd server && node test/user-flow-expected.js --write)
// - A flowchart that does not parse shows its source text and the error line: the drawing fails at the file and the
//   line, as drawing.js keeps them, and the snapshot keeps the file's text for the page to show.

import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { DRAWERS, SourceFailure } from '../src/drawing.js';
import { idOf } from '../src/ids.js';
import { readProject } from '../src/project.js';
import { snapshotRoutes } from '../src/snapshots.js';
import { openStore } from '../src/store.js';
import { userFlow } from '../src/user-flow.js';
import { FORMAT_02, FORMAT_03, newCommit, repositorySnapshot } from './snapshots.js';
import { startServer } from './support.js';
import { drawingOf, STAGE, storedDrawings, storedPictures } from './user-flow-expected.js';

const START = Date.parse('2026-11-24T10:00:00.000Z');
const JSON_TYPE = { 'Content-Type': 'application/json' };
const FILE = 'docs/03-user-flow/FL-900-a-flow.md';
const AGAIN = 'make test/user-flow-pictures.json and test/user-flow-expected.json again as test/user-flow.test.js says at its top';
const ROOT = new URL('../../', import.meta.url);

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const at = (ms) => new Date(ms).toISOString();
const ofKind = (elements, ...kinds) => elements.filter((element) => kinds.includes(element.kind));
const byKey = (elements) => new Map(elements.map((element) => [element.key, element]));
const BOX_KINDS = ['terminal', 'step', 'decision', 'document', 'store', 'llm', 'grading'];

// A flow file round a flowchart's statements: its heading on line 1 and the flowchart's first line on line 4, so the
// statement at index i is on line i + 5.
function flowFile(statements, { header = 'flowchart TD', heading = '# FL-900 A flow' } = {}) {
  return [heading, '', '```mermaid', header, ...statements, '```', ''].join('\n');
}

// Draws a flow file's text as the push gives it: its key as the key and the source, its whole text, and no warnings.
function draw(text, key = FILE) {
  return userFlow({ stage: STAGE, part: '', key, kind: 'user_flow', source: key, text, read: () => null, warnings: [] });
}
const drawn = (statements, options) => draw(flowFile(statements, options)).elements;

// The SourceFailure a text fails with, or null when it draws. Any other error is the drawer's fault.
function failureOf(text) {
  try {
    draw(text);
    return null;
  } catch (error) {
    if (!(error instanceof SourceFailure)) throw error;
    return error;
  }
}

// The line a flowchart's statements fail at, null for a failure with no line, or undefined when they draw. A failure
// names no path, so drawing.js keeps the file's key as its place.
function failsAt(statements, options) {
  const failure = failureOf(flowFile(statements, options));
  if (failure === null) return undefined;
  assert.equal(failure.path, null);
  return failure.line;
}

// Whether a point lies on the outline of a box.
function onOutline({ x, y }, box) {
  const inside = x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
  return inside && (x === box.x || x === box.x + box.width || y === box.y || y === box.y + box.height);
}
const apart = (a, b) => a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;

// Checks what every drawing keeps to: the drawer interface drawing.js checks (see the top of drawing.js), each box with
// its box and each arrow from its box's outline to the other's, no two boxes overlapping.
function assertDrawing(elements) {
  assert.ok(elements.length <= 5000);
  const keyed = byKey(elements);
  assert.equal(keyed.size, elements.length, 'each element has its own key');
  for (const element of elements) {
    assert.match(element.key, /^\S(?:.*\S)?$/);
    assert.ok(element.key.length <= 200);
    assert.match(element.kind, /^[a-z][a-z0-9_]{0,39}$/);
    assert.equal(typeof element.name, 'string');
    assert.ok(element.parent === null || keyed.has(element.parent), `${element.key}'s parent is an element`);
    assert.equal(typeof element.detail.where, 'string');
  }
  const boxes = elements.filter((element) => BOX_KINDS.includes(element.kind));
  for (const [index, box] of boxes.entries()) {
    for (const other of boxes.slice(index + 1)) assert.ok(apart(box.detail.box, other.detail.box), `${box.key} and ${other.key} do not overlap`);
  }
  for (const arrow of ofKind(elements, 'arrow')) {
    const { from, to, points } = arrow.detail;
    assert.equal(arrow.parent, from);
    assert.ok(onOutline(points[0], keyed.get(from).detail.box), `${arrow.key} leaves its box`);
    assert.ok(onOutline(points.at(-1), keyed.get(to).detail.box), `${arrow.key} reaches its box`);
  }
}

describe('the user-flow drawer', () => {
  test('the stored pictures are the pinned hub\'s pictures of the 13 flow files as they are now', () => {
    const stored = storedPictures();
    assert.deepEqual([stored.stage, stored.source], [STAGE, 'docs/03-user-flow/']);
    const files = readdirSync(new URL('docs/03-user-flow/', ROOT)).filter((name) => /^FL-\d+-.+\.md$/.test(name) && !name.endsWith('.ko.md')).sort();
    assert.equal(files.length, 13);
    assert.deepEqual(stored.pictures.map(({ picture }) => picture.key), files.map((name) => `docs/03-user-flow/${name}`), AGAIN);
    for (const { sha256: digest, picture } of stored.pictures) {
      const data = readFileSync(new URL(picture.key, ROOT));
      assert.equal(digest, sha256(data), `${picture.key} changed since test/user-flow-pictures.json was made: ${AGAIN}`);
      assert.deepEqual([picture.stage, picture.source.text], [STAGE, data.toString('utf8')]);
    }
  });

  test('this repository\'s 13 flows draw as the stored expected drawings (SPEC-006)', () => {
    const { pictures } = storedPictures();
    const expected = storedDrawings();
    assert.deepEqual(Object.keys(expected), pictures.map(({ picture }) => picture.key));
    for (const { picture } of pictures) {
      const drawing = drawingOf(picture);
      assert.deepEqual(drawing, expected[picture.key], `the drawing of ${picture.key} changed: ${AGAIN}`);
      assertDrawing(drawing.elements);
      // Each is named by its file's heading, and draws the mockup's three kinds of box and an arrow for each link.
      const heading = /^# (.+)$/m.exec(picture.source.text)[1];
      assert.equal(drawing.name, heading);
      assert.match(heading, /^FL-\d{3} /);
      const kinds = new Set(drawing.elements.map((element) => element.kind));
      assert.deepEqual([...kinds].filter((kind) => !['terminal', 'step', 'decision', 'arrow'].includes(kind)), []);
      const links = picture.source.text.match(/-->/g).length;
      assert.equal(ofKind(drawing.elements, 'arrow').length, links);
      // A box shows its name, and the IDs it serves apart from it (SPEC-010): no line of its name holds only IDs.
      for (const box of drawing.elements.filter((element) => BOX_KINDS.includes(element.kind))) {
        assert.ok(box.detail.lines.every((line) => !/^REQ-\d{3}(, REQ-\d{3})*$/.test(line)), box.key);
        assert.equal(box.name, box.detail.lines.join(' '));
        assert.ok(box.detail.ids.every((id) => /^REQ-\d{3}$/.test(id)), box.key);
      }
    }
    // FL-011's backup that has no task yet is its one box marked gap.
    const marked = Object.values(expected).flatMap(({ elements }) => elements.filter((element) => element.detail.marks?.length > 0));
    assert.deepEqual(marked.map((box) => [box.kind, box.detail.marks, box.detail.where.split(':')[0]]), [
      ['step', ['gap'], 'docs/03-user-flow/FL-011-back-up-and-rehearse-a-restore.md'],
    ]);
  });

  test('FL-001 draws its boxes and labelled arrows as its source says', () => {
    const key = 'docs/03-user-flow/FL-001-put-a-project-on-nexus.md';
    const { name, elements } = storedDrawings()[key];
    assert.equal(name, 'FL-001 Put a project on NEXUS');
    const keyed = byKey(elements);
    assert.deepEqual(['A', 'B', 'C', 'E', 'Z'].map((id) => [keyed.get(id).kind, keyed.get(id).name, keyed.get(id).detail.ids]), [
      ['terminal', 'Agent pushes a new project', ['REQ-018']],
      ['decision', 'Credential valid?', ['REQ-066']],
      ['decision', 'Owner confirmed the first send?', ['REQ-003']],
      ['step', 'Create an empty project space', ['REQ-001', 'REQ-019']],
      ['terminal', 'End', []],
    ]);
    assert.deepEqual(keyed.get('C').detail.lines, ['Owner confirmed the first', 'send?']);
    assert.equal(keyed.get('A').detail.where, `${key}:11`);
    const arrow = keyed.get('B->R1');
    assert.deepEqual([arrow.name, arrow.parent, arrow.detail.id, arrow.detail.line, arrow.detail.where], ['no', 'B', 'e2', 'pass', `${key}:23`]);
    assert.notEqual(arrow.detail.label_box, null);
    assert.equal(keyed.get('A->B').detail.label_box, null);
  });

  test('a box\'s kind comes from its shape; its name is its label without the lines of trace IDs, which are its ids', () => {
    const elements = drawn([
      'A(["Start here<br/>REQ-001"])',
      'B["Do one thing<br>and then<BR />another<br/>REQ-002, REQ-003"]',
      'C{"Fine?"}',
      'D[("Kept rows")]',
      'E[["Ask the model"]]',
      'F@{ shape: doc, label: "A document" }',
      'G@{ shape: cyl }',
      'H',
      'I["Grade it"]:::grade',
      'J@{ shape: stadium, label: "End" }',
      'K@{shape:diam}',
      'L@{ label: "Framed", shape: fr-rect }',
      'M[Bare words REQ-004]',
      'N["  Spaced   out  <br/>  <br/> REQ-005,"]',
    ]);
    assert.deepEqual(elements.map((box) => [box.key, box.kind, box.name, box.detail.ids]), [
      ['A', 'terminal', 'Start here', ['REQ-001']],
      ['B', 'step', 'Do one thing and then another', ['REQ-002', 'REQ-003']],
      ['C', 'decision', 'Fine?', []],
      ['D', 'store', 'Kept rows', []],
      ['E', 'llm', 'Ask the model', []],
      ['F', 'document', 'A document', []],
      ['G', 'store', 'G', []],
      ['H', 'step', 'H', []],
      ['I', 'grading', 'Grade it', []],
      ['J', 'terminal', 'End', []],
      ['K', 'decision', 'K', []],
      ['L', 'llm', 'Framed', []],
      ['M', 'step', 'Bare words REQ-004', []],
      ['N', 'step', 'Spaced out', ['REQ-005']],
    ]);
    const keyed = byKey(elements);
    // The author's breaks are kept, the IDs left out of them; each box is as large as its text and shape take.
    assert.deepEqual(keyed.get('B').detail.lines, ['Do one thing', 'and then', 'another']);
    assert.deepEqual(keyed.get('B').detail, { ...keyed.get('B').detail, id: 'B', marks: [], lane: null, where: `${FILE}:6` });
    const size = (id) => [keyed.get(id).detail.box.width, keyed.get(id).detail.box.height];
    assert.deepEqual(size('H'), [80, 44]);
    assert.ok(size('C')[0] > size('H')[0] && size('C')[1] > size('H')[1]);
    assert.ok(size('D')[1] > size('H')[1]);
    assert.deepEqual(elements.map((element) => element.parent), Array(14).fill(null));
    assertDrawing(elements);
  });

  test('a box is drawn by the last shape it is given, where that shape is, and keeps its key', () => {
    const elements = drawn(['A["One"] --> B', 'A{"Two"}', 'A --> C']);
    const keyed = byKey(elements);
    assert.deepEqual([keyed.get('A').kind, keyed.get('A').name, keyed.get('A').detail.where], ['decision', 'Two', `${FILE}:6`]);
    assert.deepEqual(ofKind(elements, 'terminal', 'step', 'decision').map((box) => box.key), ['A', 'B', 'C']);
    // Its key is its node ID, so the same box keeps it when its label or place changes.
    const renamed = drawn(['Z["First"]', 'A["Renamed and moved"] --> B', 'A --> C']);
    assert.equal(byKey(renamed).get('A').name, 'Renamed and moved');
  });

  test('arrows: -->, ==> and -.-> with their labels in each form, lines pass, grade, write, read or thick, keys from->to', () => {
    const elements = ofKind(drawn([
      'A --> B',
      'B -->|yes| C',
      'B -- "no, not yet" --> D',
      'C ==> D',
      'C e1@==> E',
      'D e2@== saved ==> E',
      'E -.-> F',
      'E -. graded .-> F',
      'A-->B',
      'F ---> G',
      'G -->|"a | b"| A',
      'G e3@-->|" two<br/>lines "| H; H --> I --> J',
      'class e1 write',
      'class e2 read',
      'class e3 write',
    ]), 'arrow');
    assert.deepEqual(elements.map((arrow) => [arrow.key, arrow.name, arrow.detail.line, arrow.detail.id, arrow.detail.from, arrow.detail.to]), [
      ['A->B', '', 'pass', null, 'A', 'B'],
      ['B->C', 'yes', 'pass', null, 'B', 'C'],
      ['B->D', 'no, not yet', 'pass', null, 'B', 'D'],
      ['C->D', '', 'thick', null, 'C', 'D'],
      ['C->E', '', 'write', 'e1', 'C', 'E'],
      ['D->E', 'saved', 'read', 'e2', 'D', 'E'],
      ['E->F', '', 'grade', null, 'E', 'F'],
      ['E->F#2', 'graded', 'grade', null, 'E', 'F'],
      ['A->B#2', '', 'pass', null, 'A', 'B'],
      ['F->G', '', 'pass', null, 'F', 'G'],
      ['G->A', 'a | b', 'pass', null, 'G', 'A'],
      // A line's class is the edge's: e3 is a pass line, whatever its class says.
      ['G->H', 'two lines', 'pass', 'e3', 'G', 'H'],
      ['H->I', '', 'pass', null, 'H', 'I'],
      ['I->J', '', 'pass', null, 'I', 'J'],
    ]);
    assert.deepEqual(elements.map((arrow) => arrow.detail.where.split(':').at(-1)), ['5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '16', '16']);
    // A labelled arrow has its label's box, as wide as its text.
    const labelled = byKey(elements).get('B->C').detail.label_box;
    assert.deepEqual([labelled.width, labelled.height], [Math.ceil(3 * 7.2) + 8, 20]);
  });

  test('a long label or box line is as wide as the page wraps it, and as tall as the lines it wraps to', () => {
    const long = 'word '.repeat(400).trim();
    const elements = drawn([`A["${long}"] -->|${long}| B`]);
    const box = byKey(elements).get('A').detail.box;
    assert.deepEqual([box.width, box.height], [480 + 24, Math.ceil((long.length * 7.2) / 480) * 20 + 24]);
    const label = byKey(elements).get('A->B').detail.label_box;
    assert.deepEqual([label.width, label.height], [480 + 8, Math.ceil((long.length * 7.2) / 480) * 20]);
  });

  test('lanes: each subgraph but the legend is a lane, the parent of the boxes named first in a lane in it; the legend and ~~~ draw nothing', () => {
    const elements = drawn([
      'subgraph one["① Owner"]',
      '  direction LR',
      '  A["Ask"]',
      '  subgraph inner',
      '    B["Answer"]',
      '  end',
      'end',
      'subgraph legend["Legend"]',
      '  L1["Step"] ~~~ L2{"Decision"}',
      '  subgraph deeper',
      '    L3["Store"]',
      '  end',
      'end',
      'subgraph ko["범례"]',
      '  L4["단계"]',
      'end',
      'A --> B',
      'B --> C["Outside"]',
      'C ~~~ A',
      'L1 --> A',
      'subgraph two',
      '  C',
      '  D["In two"]',
      '  A',
      'end',
      'E',
    ]);
    // C, linked outside any lane, is in the lane that lists it, as in Mermaid; A stays in the first lane that named it.
    assert.deepEqual(elements.map((element) => [element.key, element.kind, element.name, element.parent, element.detail.lane ?? null]), [
      ['lane:one', 'lane', '① Owner', null, null],
      ['lane:inner', 'lane', 'inner', 'lane:one', null],
      ['lane:two', 'lane', 'two', null, null],
      ['A', 'step', 'Ask', 'lane:one', 'lane:one'],
      ['B', 'step', 'Answer', 'lane:inner', 'lane:inner'],
      ['C', 'step', 'Outside', 'lane:two', 'lane:two'],
      ['D', 'step', 'In two', 'lane:two', 'lane:two'],
      ['E', 'step', 'E', null, null],
      ['A->B', 'arrow', '', 'A', null],
      ['B->C', 'arrow', '', 'B', null],
    ]);
    assert.deepEqual(byKey(elements).get('lane:inner').detail, { id: 'inner', where: `${FILE}:8` });
    assertDrawing(elements);
  });

  test('direction: TD and TB top to bottom, LR left to right, none top to bottom; BT and RL fail at the flowchart\'s line', () => {
    const boxes = (header) => {
      const keyed = byKey(drawn(['A --> B'], { header }));
      return [keyed.get('A').detail.box, keyed.get('B').detail.box];
    };
    for (const header of ['flowchart TD', 'flowchart TB', 'graph TD', 'flowchart', 'graph', 'flowchart TD;', '  flowchart   TB  ']) {
      const [a, b] = boxes(header);
      assert.ok(b.y >= a.y + a.height, header);
    }
    for (const header of ['flowchart LR', 'graph LR']) {
      const [a, b] = boxes(header);
      assert.ok(b.x >= a.x + a.width, header);
    }
    for (const header of ['flowchart BT', 'flowchart RL', 'graph BT', 'flowchart td', 'flowchart TD LR', 'flowchart TD; A --> B', 'flowchart-v2 TD']) {
      assert.equal(failsAt(['A --> B'], { header }), header.startsWith('flowchart-v2') ? null : 4, header);
    }
  });

  test('classes give the marks key and gap and the grading kind; classDef, style and linkStyle are read and not drawn', () => {
    const elements = drawn([
      'A["One"]:::key',
      'B["Two"]',
      'class B gap',
      'class A,B gap',
      'classDef key stroke-width:3px',
      'classDef gap,term fill:#eee,stroke-dasharray:2 3',
      'style A fill:#fff',
      'linkStyle 0 stroke:#000;',
      'A --> B',
      'class Z key',
      'class C grade',
      'C["Checked"]',
    ]);
    assert.deepEqual(ofKind(elements, ...BOX_KINDS).map((box) => [box.key, box.kind, box.detail.marks]), [
      ['A', 'step', ['key', 'gap']],
      ['B', 'step', ['gap']],
      ['C', 'grading', []],
    ]);
  });

  test('comments, front matter, other mermaid blocks and the text round the flowchart are skipped; CRLF reads the same', () => {
    const text = [
      '---',
      'title: front matter of the file',
      '---',
      '```',
      '# Not the heading: it is in a code block',
      '```',
      '## FL-900 A flow ##',
      '',
      '# A later heading',
      '',
      '```mermaid',
      'sequenceDiagram',
      '  A->>B: not a flowchart',
      '```',
      '',
      '~~~~ Mermaid',
      '%% a comment before it',
      '',
      '---',
      'config:',
      '  theme: base',
      '---',
      'flowchart TD',
      '  %% a comment in it',
      '',
      '  A["One"] --> B["Two"]',
      '~~~~',
      '',
      '```text',
      'flowchart TD',
      '```',
    ].join('\n');
    const { name, elements } = draw(text);
    assert.equal(name, 'FL-900 A flow');
    assert.deepEqual(elements.map((element) => [element.key, element.detail.where]), [['A', `${FILE}:26`], ['B', `${FILE}:26`], ['A->B', `${FILE}:26`]]);
    assert.deepEqual(draw(text.replaceAll('\n', '\r\n')), { name, elements });
    // A file with no heading is named by its file's name, so a heading taken out leaves no old name behind.
    assert.equal(draw('```mermaid\nflowchart TD\n  A\n```\n').name, 'FL-900-a-flow.md');
    // A mermaid block left open at the end of the file is read to its end.
    assert.equal(draw('# FL-900 A flow\n```mermaid\nflowchart TD\n  A --> B\n').elements.length, 3);
  });

  test('one flowchart per file: none fails at its source with no line, a second fails at its first line', () => {
    for (const text of [
      '# FL-900 A flow\n\nNo flowchart here.\n',
      '# FL-900 A flow\n```mermaid\nsequenceDiagram\n  A->>B: hi\n```\n',
      '# FL-900 A flow\n```text\nflowchart TD\n  A --> B\n```\n',
      '# FL-900 A flow\n```mermaid\n%% only a comment\n```\n',
      '# FL-900 A flow\n    ```mermaid\n    flowchart TD\n    A --> B\n    ```\n',
      '',
    ]) {
      const failure = failureOf(text);
      assert.ok(failure instanceof SourceFailure, text);
      assert.deepEqual([failure.path, failure.line], [null, null]);
    }
    // The second's first line is its graph line, line 12, after its comment.
    const two = `${flowFile(['A --> B'])}\nAnd another:\n\n\`\`\`mermaid\n%% the second\ngraph LR\n  C --> D\n\`\`\`\n`;
    assert.equal(two.split('\n')[11], 'graph LR');
    assert.equal(failureOf(two).line, 12);
  });

  test('a flowchart outside the subset fails at its line in the file, for the page to show the source and that line (SPEC-006)', () => {
    const refused = [
      // Shapes outside the grammar.
      'A{{"Hexagon"}}', 'A[/"Lean"/]', 'A[\\"Lean"\\]', 'A("Round")', 'A((Circle))', 'A>"Flag"]', 'A@{ shape: hex }',
      'A@{ shape: rect, icon: "fa:x" }', 'A@{ shape: rect, shape: rect }', 'A@{ shape: rect', 'A@{ label: "x" }',
      // Markdown strings, quotes in bare text and labels left open.
      'A["`**Bold**`"]', 'A[One"Two]', 'A["Open]', 'A["One"', 'A["One" ]x', 'A -->|"`b`"| B', 'A -- "`b`" --> B', 'A -->|yes B',
      // Links outside the grammar.
      'A --- B', 'A --o B', 'A --x B', 'A <--> B', 'A -.- B', 'A === B', 'A ~~ B', 'A & B --> C', 'A --> B & C', 'A -- x -->|y| B',
      'A ~~~|x| B', 'A -->', 'A --> end', 'A["x"] B["y"]', 'A -- --> B', 'A e1@-->',
      // Statements outside the subset.
      'click A callback', 'click A "https://example.com"', 'accTitle: A flow', 'direction LR', 'style', 'linkStyle', 'classDef key',
      'class A', 'class A,', 'end', 'subgraph', 'subgraph end', 'A:::', `${'A'.repeat(65)} --> B`, 'A;;B',
    ];
    // A line that starts with %% is a comment, a directive such as %%{init: {}}%% among them, and is skipped whole.
    assert.equal(failsAt(['Z["Fine"]', '%%{init: {}}%% A{{"x"}}']), undefined);
    for (const statement of refused) assert.equal(failsAt(['Z["Fine"]', statement]), 6, statement);
    // A name given twice, to an edge, a box or a lane.
    assert.equal(failsAt(['A e1@--> B', 'C e1@--> D']), 6);
    assert.equal(failsAt(['A e1@--> B', 'e1["Box"]']), 6);
    assert.equal(failsAt(['subgraph one', 'end', 'one --> A']), 7);
    assert.equal(failsAt(['A', 'subgraph A', 'end']), 6);
    // A lane left open fails at its line; front matter left open, at its first.
    assert.equal(failsAt(['A', 'subgraph one', '  B', 'subgraph two', 'end']), 6);
    assert.equal(failureOf('# FL-900\n```mermaid\n---\ntitle: x\nflowchart TD\n```\n').line, 3);
    // A line the parser cannot read anywhere in it fails at that line, after the lines before it.
    assert.equal(failsAt(['A --> B', 'B --> C', 'C --> D', '  D -->> E']), 8);
  });

  test('more elements than a drawing holds fail at the source with no line, and a long line of statements is read at once', () => {
    assert.equal(failsAt(Array.from({ length: 5001 }, (_, index) => `N${index}`)), null);
    assert.equal(drawn(Array.from({ length: 5000 }, (_, index) => `N${index}`)).length, 5000);
    // Arrows count, ~~~ links do not, and repeated arrows are counted before they take their keys.
    assert.equal(failsAt(Array(4999).fill('A --> B')), null);
    assert.equal(drawn([...Array(2000).fill('A ~~~ B'), 'A --> B']).length, 3);
    const started = Date.now();
    assert.equal(failsAt(['A --> B;'.repeat(130000)]), null);
    assert.equal(failsAt([`A --> ${'B '.repeat(500000)}`]), 5);
    assert.ok(Date.now() - started < 20000);
  });

  test('whatever the text, the drawer draws within the interface or fails at its source, and nothing else', () => {
    // A seeded generator, so that a failure can be made again.
    let seed = 424;
    const random = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = (list) => list[Math.floor(random() * list.length)];
    const tokens = [
      'A', 'B', 'C', 'e1', 'end', 'subgraph ', 'subgraph L["Legend"]', '-->', '---', '-.->', '==>', '~~~', '-- x -->', '-. x .->',
      '== x ==>', '|x|', '|"x"|', '["x"]', '("x")', '(["x"])', '{"x"}', '[("x")]', '[["x"]]', '@{ shape: doc }', '@{', '}', ':::gap',
      ':::grade', 'class ', 'classDef ', 'style ', 'click ', 'direction LR', ';', '\n', ' ', '"', '`', '<br/>', 'REQ-001', ',', '%%',
      '---\n', 'e1@', '&', '\r\n', '#', '```', '```mermaid\n', 'flowchart TD\n', 'graph LR\n', '\t', '\u0000', '범례', '①', '\ud800',
    ];
    const lines = (text) => text.split('\n').length;
    const check = (text) => {
      let drawing;
      try {
        drawing = draw(text);
      } catch (error) {
        assert.ok(error instanceof SourceFailure, `${error?.name}: ${JSON.stringify(text)}`);
        assert.ok(error.line === null || (Number.isSafeInteger(error.line) && error.line >= 1 && error.line <= lines(text)), JSON.stringify(text));
        return;
      }
      assert.equal(typeof drawing.name, 'string');
      assertDrawing(drawing.elements);
    };
    for (let round = 0; round < 3000; round += 1) {
      const body = Array.from({ length: 1 + Math.floor(random() * 40) }, () => pick(tokens)).join('');
      check(`# FL-900 A flow\n\`\`\`mermaid\nflowchart TD\n${body}\n\`\`\`\n`);
    }
    // This repository's flows, broken a little at a time: a slice cut out, a line doubled or a token put in.
    for (const { picture } of storedPictures().pictures) {
      const { text } = picture.source;
      for (let round = 0; round < 60; round += 1) {
        const from = Math.floor(random() * text.length);
        const to = from + Math.floor(random() * 40);
        check(text.slice(0, from) + text.slice(to));
        check(text.slice(0, from) + pick(tokens) + text.slice(from));
        const split = text.split('\n');
        const line = Math.floor(random() * split.length);
        check([...split.slice(0, line), split[line], ...split.slice(line)].join('\n'));
      }
    }
  });

  test('the drawing is the same each time', () => {
    const [{ picture }] = storedPictures().pictures;
    assert.deepEqual(drawingOf(picture), drawingOf(picture));
  });
});

describe('user flows through the push', () => {
  let folder;
  let db;
  let headers;
  let server;
  const clock = { now: START };

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-user-flow-'));
    ({ db } = openStore(folder));
    const secret = randomBytes(32).toString('base64url');
    const { lastInsertRowid } = db.prepare('INSERT INTO agent_credentials (name, secret_digest, issued_at) VALUES (?, ?, ?)')
      .run('push-job', sha256(secret), at(START));
    headers = { 'CF-Access-Client-Id': idOf('ac', Number(lastInsertRowid)), 'CF-Access-Client-Secret': secret };
    // The server's own drawers.
    server = await startServer({ store: db, now: () => clock.now, routes: snapshotRoutes() });
  });

  after(async () => {
    await server.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  async function push(snapshot) {
    clock.now += 1000;
    const answer = await server.send({ method: 'POST', path: '/api/snapshots', headers: { ...JSON_TYPE, ...headers }, body: JSON.stringify(snapshot) });
    assert.ok(answer.status === 200 || answer.status === 201, `${answer.status}`);
    return answer.json;
  }

  const diagramOf = (name, key) => db.prepare(
    'SELECT d.* FROM diagrams d JOIN project_spaces p ON p.id = d.project_id WHERE p.name = ? AND d.source_key = ?',
  ).get(name, key);
  const drawings = (diagramId) => db.prepare('SELECT * FROM drawings WHERE diagram_id = ? ORDER BY id').all(diagramId).map((row) => ({ ...row }));
  const elements = (drawingId) => db.prepare(
    'SELECT element_key, trace_id, kind, name, parent_key, status, detail FROM elements WHERE drawing_id = ? ORDER BY id',
  ).all(drawingId).map((row) => ({ ...row, detail: JSON.parse(row.detail) }));
  // The rows the store keeps of a drawer's elements.
  const rowsOf = (drawn) => drawn.map((element) => ({
    element_key: element.key, trace_id: element.trace_id ?? null, kind: element.kind, name: element.name, parent_key: element.parent ?? null,
    status: element.status ?? null, detail: element.detail,
  }));
  // The text a project's latest snapshot keeps under a path.
  const kept = (name, path) => db.prepare(
    `SELECT b.body FROM snapshot_files f JOIN document_blobs b ON b.sha256 = f.blob_sha256 JOIN snapshots s ON s.id = f.snapshot_id
     JOIN project_spaces p ON p.id = s.project_id WHERE p.name = ? AND f.path = ? ORDER BY s.id DESC LIMIT 1`,
  ).get(name, path)?.body;
  const listed = (name) => readProject(db, name).stages.filter((row) => row.stage === STAGE)
    .flatMap((row) => row.diagrams.map((summary) => [summary.kind, summary.name, summary.removed]));
  const flowOf = (snapshot, key) => snapshot.pictures.find((picture) => picture.key === key);

  test('the push draws this repository\'s 13 flows as the stored expected drawings, and stage 03 lists 13 diagrams (SPEC-006)', async () => {
    const name = 'user-flow-repository';
    const answer = await push(repositorySnapshot(FORMAT_03, { name }));
    assert.deepEqual(answer.failures, []);
    const expected = storedDrawings();
    for (const { picture } of storedPictures().pictures) {
      const diagram = diagramOf(name, picture.key);
      assert.deepEqual([diagram.kind, diagram.name, diagram.stage, diagram.removed_at], ['user_flow', expected[picture.key].name, STAGE, null]);
      const [drawing, ...others] = drawings(diagram.id);
      assert.deepEqual([drawing.status, others], ['drawn', []]);
      assert.deepEqual(elements(drawing.id), rowsOf(expected[picture.key].elements));
      // The drawing reads its own file and nothing else.
      assert.equal(drawing.source_digest, sha256(JSON.stringify([[picture.key, sha256(picture.source.text)]])));
    }
    // Stage 03 lists its 13 flows by name, and no item table: its files draw from the first push (SPEC-005).
    assert.deepEqual(listed(name), Object.values(expected).map((drawing) => ['user_flow', drawing.name, false]));
    assert.equal(diagramOf(name, `/items/${STAGE}`), undefined);
  });

  test('stage 03\'s item table of a 0.2 snapshot makes way for the flows of the next 0.3 snapshot', async () => {
    const name = 'user-flow-made-way';
    const [a, b] = [newCommit(), newCommit()];
    await push(repositorySnapshot(FORMAT_02, { name, commit: a }));
    assert.equal(diagramOf(name, `/items/${STAGE}`).removed_at, null);
    const answer = await push(repositorySnapshot(FORMAT_03, { name, commit: b, replaces: a }));
    assert.deepEqual([answer.failures, answer.threads_moved], [[], 0]);
    assert.equal(diagramOf(name, `/items/${STAGE}`).removed_at, at(clock.now));
    assert.equal(listed(name).filter(([kind, , removed]) => kind === 'user_flow' && !removed).length, 13);
  });

  test('a flow that does not parse fails at its file and line, keeps its text, and the diagram keeps its last good drawing', async () => {
    const name = 'user-flow-failed';
    const key = 'docs/03-user-flow/FL-001-put-a-project-on-nexus.md';
    const [a, b, c] = [newCommit(), newCommit(), newCommit()];
    await push(repositorySnapshot(FORMAT_03, { name, commit: a }));
    const diagram = diagramOf(name, key);
    const broken = repositorySnapshot(FORMAT_03, { name, commit: b, replaces: a });
    const flow = flowOf(broken, key);
    flow.source.text = flow.source.text.replace('  B e2@-->|no| R1', '  B e2@--o R1');
    const line = flow.source.text.split('\n').findIndex((text) => text.includes('--o')) + 1;
    assert.equal(line, 23);
    const answer = await push(broken);
    assert.deepEqual(answer.failures, [{ diagram: idOf('dg', Number(diagram.id)), part: '', stage: STAGE, where: `${key}:${line}` }]);
    const [good, failed] = drawings(diagram.id);
    assert.deepEqual([good.status, failed.status, failed.failed_path, failed.failed_line], ['drawn', 'failed', key, line]);
    assert.deepEqual(elements(failed.id), []);
    assert.deepEqual(elements(good.id), rowsOf(storedDrawings()[key].elements));
    // The page shows the source text the snapshot keeps, with the line marked; the diagram keeps its name.
    assert.equal(kept(name, key), flow.source.text);
    assert.equal(diagramOf(name, key).name, 'FL-001 Put a project on NEXUS');
    // A new flow file with no flowchart fails at the file alone, named by its file until it draws.
    const added = repositorySnapshot(FORMAT_03, { name, commit: c, replaces: b });
    const extra = 'docs/03-user-flow/FL-014-a-new-flow.md';
    added.pictures.push({ ...flowOf(added, key), key: extra, source: { text: '# FL-014 A new flow\n\nNot drawn yet.\n' } });
    const again = await push(added);
    const fresh = diagramOf(name, extra);
    assert.deepEqual(again.failures.find((entry) => entry.diagram === idOf('dg', Number(fresh.id))), {
      diagram: idOf('dg', Number(fresh.id)), part: '', stage: STAGE, where: extra,
    });
    assert.deepEqual([fresh.kind, fresh.name], ['user_flow', 'FL-014-a-new-flow.md']);
    assert.deepEqual(drawings(fresh.id).map((row) => [row.status, row.failed_path, row.failed_line]), [['failed', extra, null]]);
  });

  test('no log line holds a flow\'s text (rule 5)', async () => {
    const marker = `flow_${randomBytes(8).toString('hex')}`;
    const snapshot = repositorySnapshot(FORMAT_03, { name: 'user-flow-logs' });
    const [first, second] = snapshot.pictures.filter((picture) => picture.stage === STAGE);
    first.source.text = flowFile([`A["${marker}"] -->|${marker}| B`, `subgraph ${marker}`, 'end']);
    second.source.text = flowFile([`A["${marker}"] --o B`]);
    const answer = await push(snapshot);
    assert.equal(answer.failures.length, 1);
    const logs = server.logText();
    assert.ok(logs.includes('pushSnapshot'));
    assert.equal(logs.includes(marker), false);
  });
});

test('the user_flow drawer is drawing.js\'s drawer of the user_flow kind', () => {
  assert.equal(DRAWERS.user_flow, userFlow);
});
