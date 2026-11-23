// The picture layout (TASK-420): the same input gives the same positions, no two boxes overlap, and 300 elements are
// placed in under 1 second, half of REQ-070's 2 seconds; and the shapes the drawing tasks need (SPEC-003, SPEC-004,
// SPEC-006, SPEC-007).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { LAYOUT_DEFAULTS, layout } from '../src/layout.js';

// A small seeded generator (mulberry32), so that every graph below is the same on every run.
function generator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ELEMENTS = 300;
const pick = (random, count) => Math.floor(random() * count);

// Graphs of 300 elements in the shapes of the pictures.
const SHAPES = {
  // The sitemap: a tree of screens (SPEC-007).
  tree(random) {
    const nodes = [];
    const edges = [];
    for (let index = 0; index < ELEMENTS; index += 1) {
      nodes.push({ id: `screen-${index}`, width: 160, height: 48 });
      if (index > 0) edges.push({ from: `screen-${pick(random, index)}`, to: `screen-${index}` });
    }
    return { nodes, edges };
  },
  // A user flow: steps and decisions with labelled arrows, ways back and ways forward (SPEC-006).
  flow(random) {
    const nodes = [];
    const edges = [];
    for (let index = 0; index < ELEMENTS; index += 1) {
      const decision = random() < 0.25;
      nodes.push({ id: `step-${index}`, width: decision ? 220 : 200, height: decision ? 96 : 56 });
      if (index > 0) {
        const label = random() < 0.3 ? { width: 40, height: 18 } : null;
        edges.push({ from: `step-${index - 1}`, to: `step-${index}`, label });
      }
      if (decision && index > 3) {
        edges.push({ from: `step-${index}`, to: `step-${pick(random, index)}`, label: { width: 60, height: 18 } });
      }
      if (decision && index + 5 < ELEMENTS) {
        edges.push({ from: `step-${index}`, to: `step-${index + 2 + pick(random, 3)}`, label: { width: 30, height: 18 } });
      }
    }
    return { nodes, edges };
  },
  // The ERD: tables of 3 to 17 columns, up to two foreign keys each and some to the table itself (SPEC-004).
  erd(random) {
    const nodes = [];
    const edges = [];
    for (let index = 0; index < ELEMENTS; index += 1) {
      nodes.push({ id: `table-${index}`, width: 220, height: 28 + 20 * (3 + pick(random, 15)) });
      const keys = index > 0 ? pick(random, 3) : 0;
      for (let key = 0; key < keys; key += 1) edges.push({ from: `table-${index}`, to: `table-${pick(random, index)}` });
      if (random() < 0.03) edges.push({ from: `table-${index}`, to: `table-${index}` });
    }
    return { nodes, edges };
  },
  // The DDD board: 60 columns of sticky notes in five pinned rows (SPEC-003).
  board() {
    const nodes = [];
    const edges = [];
    for (let column = 0; column < ELEMENTS / 5; column += 1) {
      for (let row = 0; row < 5; row += 1) {
        nodes.push({ id: `note-${column}-${row}`, width: 148, height: 80, layer: row });
        if (row > 0) edges.push({ from: `note-${column}-${row - 1}`, to: `note-${column}-${row}` });
      }
    }
    return { nodes, edges };
  },
  // The hardest case: 600 lines between any two of 300 boxes of mixed sizes, so long lines and cycles abound.
  dense(random) {
    const nodes = [];
    const edges = [];
    for (let index = 0; index < ELEMENTS; index += 1) {
      nodes.push({ id: `box-${index}`, width: 80 + pick(random, 120), height: 30 + pick(random, 60) });
    }
    for (let line = 0; line < 2 * ELEMENTS; line += 1) {
      const label = random() < 0.2 ? { width: 50, height: 16 } : null;
      edges.push({ from: `box-${pick(random, ELEMENTS)}`, to: `box-${pick(random, ELEMENTS)}`, label });
    }
    return { nodes, edges };
  },
  // The ERD with every third table where the owner put it (SPEC-012).
  moved(random) {
    const graph = SHAPES.erd(random);
    graph.nodes.forEach((node, index) => {
      if (index % 3 === 0) node.position = { x: pick(random, 40000), y: pick(random, 4000) };
    });
    return graph;
  },
};

const graphs = Object.fromEntries(Object.entries(SHAPES).map(([name, make]) => [name, make(generator(420))]));

// Random small graphs of every kind the input allows: cycles, lines to the box itself, pinned layers, lines inside a
// pinned layer, labels, fixed positions and both directions.
function smallGraph(seed) {
  const random = generator(seed);
  const count = 1 + pick(random, 24);
  const nodes = [];
  for (let index = 0; index < count; index += 1) {
    const node = { id: `n${index}`, width: 1 + pick(random, 200), height: 1 + pick(random, 120) };
    if (random() < 0.2) node.layer = pick(random, 4);
    if (random() < 0.15) node.position = { x: pick(random, 1200) - 200, y: pick(random, 800) - 100 };
    nodes.push(node);
  }
  const edges = [];
  const lines = pick(random, 2 * count + 1);
  for (let line = 0; line < lines; line += 1) {
    const label = random() < 0.3 ? { width: 1 + pick(random, 60), height: 1 + pick(random, 24) } : null;
    edges.push({ from: `n${pick(random, count)}`, to: `n${pick(random, count)}`, label });
  }
  const options = {
    direction: random() < 0.3 ? 'LR' : 'TB',
    nodeGap: 1 + pick(random, 60),
    layerGap: 1 + pick(random, 80),
    edgeGap: 1 + pick(random, 20),
  };
  return { graph: { nodes, edges }, options };
}

const SMALL_GRAPHS = 300;

function deepFreeze(value) {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

// The boxes of a result: its nodes and its labels. Two fixed boxes may overlap, since the owner put them there; the
// label of a line whose ends are both fixed is drawn with them.
function boxesOf(result) {
  const boxes = result.nodes.map((node) => ({ ...node, what: `node ${node.id}` }));
  const fixed = new Set(result.nodes.filter((node) => node.fixed).map((node) => node.id));
  result.edges.forEach((edge, index) => {
    if (edge.label === null) return;
    boxes.push({ ...edge.label, fixed: fixed.has(edge.from) && fixed.has(edge.to), what: `label of edge ${index}` });
  });
  return boxes;
}

const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

function assertNoOverlap(result, context = '') {
  const boxes = boxesOf(result);
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      if (boxes[i].fixed && boxes[j].fixed) continue;
      assert.ok(!overlap(boxes[i], boxes[j]), `${context}: ${boxes[i].what} overlaps ${boxes[j].what}`);
    }
  }
}

// Float error: 54.23 is on the edge of a box at y 4.23 with height 50, which floating point puts at 54.230000000000004.
const FLOAT_ERROR = 1e-6;

// On the box's edge. With sizes and positions of two decimal places or fewer, a line's end is on it exactly; with
// more, rounding moves the end out by less than 0.01.
const onBoundary = (point, box, slack = FLOAT_ERROR) => {
  const inX = point.x >= box.x - slack && point.x <= box.x + box.width + slack;
  const inY = point.y >= box.y - slack && point.y <= box.y + box.height + slack;
  const near = (a, b) => Math.abs(a - b) <= slack;
  return (inX && (near(point.y, box.y) || near(point.y, box.y + box.height)))
    || (inY && (near(point.x, box.x) || near(point.x, box.x + box.width)));
};

// Each line starts on its source box and ends on its target box. A line between laid-out boxes runs only across
// and down, and passes through no box and no label; when no box is fixed, no two lines run on top of each other.
function assertLines(result, context = '', slack = FLOAT_ERROR) {
  const byId = new Map(result.nodes.map((node) => [node.id, node]));
  const boxes = boxesOf(result);
  const runs = [];
  result.edges.forEach((edge, index) => {
    const where = `${context}: edge ${index}`;
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    assert.ok(edge.points.length >= 2, `${where} has two points or more`);
    for (const point of edge.points) assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), `${where} is finite`);
    assert.ok(onBoundary(edge.points[0], from, slack), `${where} starts on its source`);
    assert.ok(onBoundary(edge.points.at(-1), to, slack), `${where} ends on its target`);
    if (from.fixed || to.fixed) return;
    for (let at = 1; at < edge.points.length; at += 1) {
      const a = edge.points[at - 1];
      const b = edge.points[at];
      assert.ok(a.x === b.x || a.y === b.y, `${where} runs only across and down`);
      runs.push(a.x === b.x
        ? { index, upright: true, at: a.x, low: Math.min(a.y, b.y), high: Math.max(a.y, b.y) }
        : { index, upright: false, at: a.y, low: Math.min(a.x, b.x), high: Math.max(a.x, b.x) });
      for (const box of boxes) {
        if (box.fixed) continue;
        const e = FLOAT_ERROR;
        const crosses = a.x === b.x
          ? a.x > box.x + e && a.x < box.x + box.width - e
            && Math.max(a.y, b.y) > box.y + e && Math.min(a.y, b.y) < box.y + box.height - e
          : a.y > box.y + e && a.y < box.y + box.height - e
            && Math.max(a.x, b.x) > box.x + e && Math.min(a.x, b.x) < box.x + box.width - e;
        assert.ok(!crosses, `${where} passes through ${box.what}`);
      }
    }
  });
  if (result.nodes.some((node) => node.fixed)) return;
  const byLine = Map.groupBy(runs, (run) => `${run.upright} ${run.at}`);
  for (const group of byLine.values()) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const [a, b] = [group[i], group[j]];
        const shared = a.index !== b.index && a.low < b.high && b.low < a.high;
        assert.ok(!shared, `${context}: edges ${a.index} and ${b.index} run on top of each other`);
      }
    }
  }
}

// Runs first, so that each layout is timed cold, as a page opening a diagram runs it.
test('places 300 elements in under 1 second in each shape (TASK-420, REQ-070)', () => {
  for (const [name, graph] of Object.entries(graphs)) {
    const start = performance.now();
    const result = layout(graph);
    const elapsed = performance.now() - start;
    assert.equal(result.nodes.length, ELEMENTS, name);
    assert.ok(elapsed < 1000, `${name} took ${elapsed.toFixed(0)} ms`);
  }
});

test('the same input gives the same positions, and the input is left as it was', () => {
  for (const [name, graph] of Object.entries(graphs)) {
    const frozen = deepFreeze(structuredClone(graph));
    const first = layout(frozen);
    assert.deepEqual(layout(structuredClone(graph)), first, name);
    assert.deepEqual(layout(frozen, { direction: 'LR' }), layout(structuredClone(graph), { direction: 'LR' }), name);
  }
  for (let seed = 1; seed <= SMALL_GRAPHS; seed += 1) {
    const { graph, options } = smallGraph(seed);
    const frozen = deepFreeze(structuredClone(graph));
    assert.deepEqual(layout(frozen, options), layout(structuredClone(graph), options), `small graph ${seed}`);
  }
});

test('no two boxes overlap, labels included, in every shape and in random graphs', () => {
  for (const [name, graph] of Object.entries(graphs)) {
    assertNoOverlap(layout(graph), name);
    assertNoOverlap(layout(graph, { direction: 'LR' }), `${name} LR`);
  }
  for (let seed = 1; seed <= SMALL_GRAPHS; seed += 1) {
    const { graph, options } = smallGraph(seed);
    assertNoOverlap(layout(graph, options), `small graph ${seed}`);
  }
});

test('lines start and end on their boxes, run across and down, and pass through no box', () => {
  for (const [name, graph] of Object.entries(graphs)) {
    if (name === 'dense') continue;
    assertLines(layout(graph), name);
  }
  for (let seed = 1; seed <= SMALL_GRAPHS; seed += 1) {
    const { graph, options } = smallGraph(seed);
    assertLines(layout(graph, options), `small graph ${seed}`);
  }
});

test('a sitemap with 1 root and 4 children is a tree of 5 screens, the root over its children (SPEC-007)', () => {
  const children = ['projects', 'project', 'workbench', 'changes'];
  const result = layout({
    nodes: [{ id: 'todo', width: 120, height: 40 }, ...children.map((id) => ({ id, width: 120, height: 40 }))],
    edges: children.map((id) => ({ from: 'todo', to: id })),
  });
  assert.equal(result.nodes.length, 5);
  const [root, ...rest] = result.nodes;
  assert.equal(root.layer, 0);
  assert.deepEqual(rest.map((node) => node.layer), [1, 1, 1, 1]);
  // The children stand in one row under the root, in their order.
  assert.ok(rest.every((node) => node.y === rest[0].y && node.y > root.y + root.height));
  assert.deepEqual(rest.map((node) => node.id), [...rest].sort((a, b) => a.x - b.x).map((node) => node.id));
  const middle = (node) => node.x + node.width / 2;
  assert.equal(middle(root), (middle(rest[0]) + middle(rest[3])) / 2);
});

test('a screen whose parent is missing stands at the top, beside the tree (SPEC-007)', () => {
  const result = layout({
    nodes: ['todo', 'projects', 'orphan'].map((id) => ({ id, width: 120, height: 40 })),
    edges: [{ from: 'todo', to: 'projects' }],
  });
  const [todo, , orphan] = result.nodes;
  assert.equal(orphan.layer, 0);
  assert.equal(orphan.y, todo.y);
  assert.ok(orphan.x >= todo.x + todo.width + LAYOUT_DEFAULTS.nodeGap);
});

test('an ERD of 2 tables and 1 foreign key shows 2 tables joined by 1 line (SPEC-004)', () => {
  const result = layout({
    nodes: [{ id: 'TBL-146', width: 200, height: 160 }, { id: 'TBL-167', width: 200, height: 100 }],
    edges: [{ from: 'TBL-167', to: 'TBL-146' }],
  });
  assert.equal(result.nodes.length, 2);
  assert.equal(result.edges.length, 1);
  assertLines(result);
  // A table that points to itself gets a line that leaves its bottom and comes back to it.
  const self = layout({ nodes: [{ id: 'TBL-155', width: 200, height: 100 }], edges: [{ from: 'TBL-155', to: 'TBL-155' }] });
  const [box] = self.nodes;
  const { points } = self.edges[0];
  assert.equal(points[0].y, box.y + box.height);
  assert.equal(points.at(-1).y, box.y + box.height);
  assert.notEqual(points[0].x, points.at(-1).x);
  assert.ok(points.some((point) => point.y > box.y + box.height));
});

test('a user flow runs top to bottom, its way back points up and its labels sit beside their lines (SPEC-006)', () => {
  const step = (id) => ({ id, width: 200, height: 56 });
  const result = layout({
    nodes: [step('start'), step('read'), { id: 'ok', width: 220, height: 96 }, step('confirm'), step('end')],
    edges: [
      { from: 'start', to: 'read' },
      { from: 'read', to: 'ok' },
      { from: 'ok', to: 'confirm', label: { width: 24, height: 18 } },
      { from: 'ok', to: 'read', label: { width: 40, height: 18 } },
      { from: 'confirm', to: 'end' },
    ],
  });
  assert.deepEqual(result.nodes.map((node) => node.layer), [0, 1, 2, 3, 4]);
  for (let index = 1; index < result.nodes.length; index += 1) {
    assert.ok(result.nodes[index].y > result.nodes[index - 1].y + result.nodes[index - 1].height);
  }
  const back = result.edges[3];
  const [, read, ok] = result.nodes;
  assert.equal(back.points[0].y, ok.y, 'the way back leaves the top of the decision');
  assert.equal(back.points.at(-1).y, read.y + read.height, 'and enters the bottom of the step it returns to');
  for (const edge of [result.edges[2], back]) {
    // A label sits right of a line that runs down through its row.
    const { label } = edge;
    const passing = edge.points.some((point, index) => index > 0
      && point.x === edge.points[index - 1].x
      && point.x < label.x && point.x >= label.x - LAYOUT_DEFAULTS.edgeGap
      && Math.min(point.y, edge.points[index - 1].y) <= label.y
      && Math.max(point.y, edge.points[index - 1].y) >= label.y + label.height);
    assert.ok(passing, 'the label sits beside its line');
  }
  assertNoOverlap(result);
  assertLines(result);
});

test('a board pins each kind of note to its row and keeps each column in line, columns in input order (SPEC-003)', () => {
  const kinds = ['read model', 'command', 'aggregate', 'event', 'policy'];
  const columns = [['read model', 'command', 'aggregate', 'event'], ['command', 'aggregate', 'event', 'policy'], ['command', 'aggregate', 'event']];
  const nodes = [];
  const edges = [];
  columns.forEach((column, at) => {
    column.forEach((kind, index) => {
      nodes.push({ id: `${at}-${kind}`, width: 148, height: 80, layer: kinds.indexOf(kind) });
      if (index > 0) edges.push({ from: `${at}-${column[index - 1]}`, to: `${at}-${kind}` });
    });
  });
  const result = layout({ nodes, edges }, { nodeGap: 28, layerGap: 16 });
  const byKind = Map.groupBy(result.nodes, (node) => kinds[node.layer]);
  for (const [kind, notes] of byKind) {
    assert.ok(notes.every((note) => note.y === notes[0].y), `${kind} notes share a row`);
  }
  const rows = kinds.filter((kind) => byKind.has(kind)).map((kind) => byKind.get(kind)[0].y);
  assert.deepEqual(rows, [...rows].sort((a, b) => a - b), 'rows follow their layers down');
  const columnX = columns.map((column, at) => {
    const notes = result.nodes.filter((node) => node.id.startsWith(`${at}-`));
    assert.ok(notes.every((note) => note.x === notes[0].x), `column ${at} is in line`);
    return notes[0].x;
  });
  assert.deepEqual(columnX, [...columnX].sort((a, b) => a - b), 'columns stand in input order');
  assertNoOverlap(result);
});

test('two notes pinned to one row are joined by a line that dips under the row, its label below it', () => {
  const result = layout({
    nodes: [{ id: 'a', width: 100, height: 40, layer: 0 }, { id: 'b', width: 100, height: 40, layer: 0 }],
    edges: [{ from: 'a', to: 'b', label: { width: 30, height: 14 } }],
  });
  const [a, b] = result.nodes;
  const { points, label } = result.edges[0];
  assert.equal(points[0].y, a.y + a.height);
  assert.equal(points.at(-1).y, b.y + b.height);
  assert.ok(points.every((point) => point.y >= a.y + a.height));
  assert.ok(label.y > a.y + a.height);
});

test('a cycle is laid out with the line that closes it pointing up', () => {
  const result = layout({
    nodes: ['a', 'b', 'c'].map((id) => ({ id, width: 80, height: 30 })),
    edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a' }],
  });
  assert.deepEqual(result.nodes.map((node) => node.layer), [0, 1, 2]);
  const [a, , c] = result.nodes;
  const closing = result.edges[2].points;
  assert.equal(closing[0].y, c.y);
  assert.equal(closing.at(-1).y, a.y + a.height);
  assertLines(result);
});

test('lines between the same two boxes leave and enter at different points', () => {
  const result = layout({
    nodes: [{ id: 'drawings', width: 200, height: 80 }, { id: 'comment_threads', width: 200, height: 80 }],
    edges: [{ from: 'comment_threads', to: 'drawings' }, { from: 'comment_threads', to: 'drawings' }],
  });
  const [first, second] = result.edges.map((edge) => edge.points);
  assert.notEqual(first[0].x, second[0].x);
  assert.notEqual(first.at(-1).x, second.at(-1).x);
});

test('left to right lays the layers out across, as a Mermaid flowchart LR', () => {
  const result = layout({
    nodes: ['agent', 'diagram', 'review'].map((id) => ({ id, width: 120, height: 40 })),
    edges: [{ from: 'agent', to: 'diagram', label: { width: 60, height: 16 } }, { from: 'diagram', to: 'review' }],
  }, { direction: 'LR' });
  const [agent, diagram, review] = result.nodes;
  assert.ok(agent.x + agent.width < diagram.x && diagram.x + diagram.width < review.x);
  assert.equal(agent.y + agent.height / 2, diagram.y + diagram.height / 2);
  assert.equal(result.edges[1].points[0].x, diagram.x + diagram.width);
  assert.equal(result.edges[1].points.at(-1).x, review.x);
  assertNoOverlap(result);
  assertLines(result);
});

test('a box with a position stays there, the others keep clear of it, and the rest stays where it was (SPEC-012)', () => {
  const graph = {
    nodes: ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, width: 100, height: 40 })),
    edges: [{ from: 'a', to: 'b' }, { from: 'a', to: 'c' }, { from: 'b', to: 'd' }, { from: 'c', to: 'e' }],
  };
  const before = layout(graph);
  // Far away: nothing else moves, not even the rows below.
  const far = structuredClone(graph);
  far.nodes[1].position = { x: 5000.5, y: -300.25 };
  const after = layout(far);
  assert.deepEqual({ x: after.nodes[1].x, y: after.nodes[1].y, fixed: after.nodes[1].fixed }, { x: 5000.5, y: -300.25, fixed: true });
  for (const index of [0, 2, 3, 4]) {
    assert.deepEqual(after.nodes[index], before.nodes[index]);
  }
  assert.ok(after.bounds.x <= 0 && after.bounds.y <= -300.25 && after.bounds.x + after.bounds.width >= 5100.5);
  assertLines(after);
  // On top of another box: that box moves clear of it.
  const onTop = structuredClone(graph);
  onTop.nodes[4].position = { x: before.nodes[3].x, y: before.nodes[3].y };
  const moved = layout(onTop);
  assert.deepEqual({ x: moved.nodes[4].x, y: moved.nodes[4].y }, onTop.nodes[4].position);
  assertNoOverlap(moved);
  assert.ok(moved.nodes[3].x > before.nodes[3].x);
});

test('a line from a fixed box to itself moves with it, label included, and a line between two fixed boxes runs straight', () => {
  const loop = { nodes: [{ id: 'a', width: 100, height: 50 }], edges: [{ from: 'a', to: 'a', label: { width: 40, height: 16 } }] };
  const before = layout(loop);
  for (const position of [{ x: 1000, y: 2000 }, { x: 1000.25, y: 4.23 }]) {
    const moved = structuredClone(loop);
    moved.nodes[0].position = position;
    const after = layout(moved);
    const shift = (box) => ({ x: Math.round((box.x + position.x) * 100) / 100, y: Math.round((box.y + position.y) * 100) / 100 });
    assert.deepEqual(after.edges[0].points, before.edges[0].points.map(shift));
    assert.deepEqual(after.edges[0].label, { ...before.edges[0].label, ...shift(before.edges[0].label) });
  }
  const moved = structuredClone(loop);
  moved.nodes[0].position = { x: 1000, y: 2000 };
  // The boxes the layout places keep clear of the moved label: here it lands in the row of b1, at x 132.
  const crowd = structuredClone(moved);
  for (let index = 0; index < 6; index += 1) crowd.nodes.push({ id: `b${index}`, width: 100, height: 50 });
  crowd.edges.push(...[0, 1, 2, 3, 4].map((index) => ({ from: `b${index}`, to: `b${index + 1}` })));
  crowd.nodes[0].position = { x: 86, y: 45 };
  const crowded = layout(crowd);
  assert.deepEqual(crowded.edges[0].label, { x: 142, y: 119, width: 40, height: 16 });
  assertNoOverlap(crowded);
  assertLines(crowded);

  const same = layout({
    nodes: [{ id: 'a', width: 100, height: 50, position: { x: 0, y: 0 } }, { id: 'b', width: 100, height: 50, position: { x: 0, y: 0 } }],
    edges: [{ from: 'a', to: 'b' }],
  });
  assert.equal(same.edges[0].points.length, 2);
  assertLines(same);
  // The layout's tracks for a→b run below a, but a and b are both fixed: the line goes straight up from a to b,
  // never back through a.
  const apart = layout({
    nodes: [
      { id: 'a', width: 800, height: 220, position: { x: -300, y: -100 } },
      { id: 'b', width: 100, height: 50, position: { x: 0, y: -1000 } },
      { id: 'c', width: 100, height: 50 },
    ],
    edges: [{ from: 'a', to: 'b' }, { from: 'a', to: 'c' }],
  });
  assert.equal(apart.edges[0].points.length, 2);
  assert.equal(apart.edges[0].points[0].y, -100);
  assertLines(apart);
  // Its label sits beside the middle of the straight line, clear of it, and the bounds hold no stale place.
  for (const [b, label] of [[{ x: 900, y: 900 }, { x: 764, y: 717 }], [{ x: 900, y: 520 }, { x: 730, y: 542 }]]) {
    const pair = layout({
      nodes: [{ id: 'a', width: 100, height: 50, position: { x: 500, y: 500 } }, { id: 'b', width: 100, height: 50, position: b }],
      edges: [{ from: 'a', to: 'b', label: { width: 40, height: 16 } }],
    });
    assert.deepEqual(pair.edges[0].label, { ...label, width: 40, height: 16 });
    assert.deepEqual([pair.bounds.x, pair.bounds.y], [500, 500]);
  }
});

// Whether the segment from p to q runs through the inside of the box, in any direction (Liang and Barsky).
function runsThrough(box, p, q) {
  const e = FLOAT_ERROR;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  let low = 0;
  let high = 1;
  for (const [step, room] of [[-dx, p.x - box.x - e], [dx, box.x + box.width - e - p.x], [-dy, p.y - box.y - e], [dy, box.y + box.height - e - p.y]]) {
    if (step === 0) {
      if (room < 0) return false;
    } else if (step < 0) {
      low = Math.max(low, room / step);
    } else {
      high = Math.min(high, room / step);
    }
  }
  return high - low > 1e-9;
}

test('a line with one fixed end never runs back through its fixed box', () => {
  for (let seed = 1; seed <= 300; seed += 1) {
    const random = generator(seed);
    const count = 2 + pick(random, 14);
    const nodes = Array.from({ length: count }, (_, index) => ({ id: `n${index}`, width: 20 + pick(random, 150), height: 20 + pick(random, 80) }));
    const edges = Array.from({ length: 2 * count }, () => ({ from: `n${pick(random, count)}`, to: `n${pick(random, count)}` }));
    const { bounds } = layout({ nodes, edges });
    const fixed = pick(random, count);
    nodes[fixed].position = { x: bounds.x + pick(random, Math.max(1, bounds.width)), y: bounds.y + pick(random, Math.max(1, bounds.height)) };
    const result = layout({ nodes, edges });
    const box = result.nodes[fixed];
    result.edges.forEach((edge, index) => {
      if ((edge.from === box.id) === (edge.to === box.id)) return;
      for (let at = 1; at < edge.points.length; at += 1) {
        assert.ok(!runsThrough(box, edge.points[at - 1], edge.points[at]), `small graph ${seed}: edge ${index} runs through ${box.id}`);
      }
    });
    assertLines(result, `small graph ${seed}`);
  }
});

// A line to the fixed box ends where a line from its middle leaves it (README), so only the box's own loop and the
// other boxes and lines stay as they were.
test('a box fixed where the layout put it moves no other box, no line between other boxes and not its own loop', () => {
  const graph = {
    nodes: ['a', 'p', 'q'].map((id) => ({ id, width: 100, height: 50 })),
    edges: [{ from: 'a', to: 'a', label: { width: 40, height: 16 } }, { from: 'a', to: 'p' }, { from: 'p', to: 'q' }, { from: 'a', to: 'q' }],
  };
  const before = layout(graph);
  const pinned = structuredClone(graph);
  pinned.nodes[0].position = { x: before.nodes[0].x, y: before.nodes[0].y };
  const after = layout(pinned);
  assert.deepEqual(after.nodes.slice(1), before.nodes.slice(1));
  assert.deepEqual([after.edges[0], after.edges[2]], [before.edges[0], before.edges[2]]);
});

test('the numbers the layout works out have two decimal places, also with sizes that have more', () => {
  const twoPlaces = (value) => Math.round(value * 100) / 100 === value;
  for (let seed = 1; seed <= 100; seed += 1) {
    const random = generator(seed);
    const { graph, options } = smallGraph(seed);
    for (const node of graph.nodes) {
      node.width += random();
      node.height += random();
      if (node.position !== undefined) node.position = { x: node.position.x + random(), y: node.position.y + random() };
    }
    for (const edge of graph.edges) {
      if (edge.label !== null) edge.label = { width: edge.label.width + random(), height: edge.label.height + random() };
    }
    const result = layout(graph, options);
    const { bounds } = result;
    const numbers = [bounds.x, bounds.y, bounds.width, bounds.height];
    for (const node of result.nodes) if (!node.fixed) numbers.push(node.x, node.y);
    for (const edge of result.edges) {
      for (const point of edge.points) numbers.push(point.x, point.y);
      if (edge.label !== null) numbers.push(edge.label.x, edge.label.y);
    }
    assert.ok(numbers.every(twoPlaces), `small graph ${seed}: ${numbers.find((value) => !twoPlaces(value))}`);
    const holds = (x, y, width = 0, height = 0) => x >= bounds.x && y >= bounds.y
      && x + width <= bounds.x + bounds.width + 1e-9 && y + height <= bounds.y + bounds.height + 1e-9;
    assert.ok(boxesOf(result).every((box) => holds(box.x, box.y, box.width, box.height)), `small graph ${seed}: bounds`);
    assert.ok(result.edges.every((edge) => edge.points.every((point) => holds(point.x, point.y))), `small graph ${seed}: bounds`);
    assertNoOverlap(result, `small graph ${seed}`);
    assertLines(result, `small graph ${seed}`, 0.01);
  }
  // Far out, where float error is larger, a line's end still never falls inside its box.
  const far = layout({ nodes: [{ id: 'a', width: 100, height: 50, position: { x: 0, y: 999949.0005 } }], edges: [{ from: 'a', to: 'a' }] });
  assert.deepEqual([far.edges[0].points[0].y, far.edges[0].points.at(-1).y], [999999.01, 999999.01]);
});

test('with two decimal places or fewer, lines end exactly on their boxes and the bounds fit exactly', () => {
  const result = layout({
    nodes: [
      { id: 'a', width: 80, height: 50, position: { x: 4.23, y: 4.23 } },
      { id: 'b', width: 80.5, height: 40.25 },
      { id: 'c', width: 50, height: 30, position: { x: 300.1, y: 200.07 } },
    ],
    edges: [{ from: 'a', to: 'b' }, { from: 'a', to: 'a' }, { from: 'b', to: 'c' }],
  });
  const hundredths = (value) => Math.round(value * 100) / 100;
  const b = result.nodes[1];
  assert.equal(result.edges[0].points[0].y, 54.23);
  assert.deepEqual(result.edges[1].points.map((point) => point.y).filter((y) => y < 60), [54.23, 54.23]);
  assert.equal(result.edges[2].points[0].y, hundredths(b.y + b.height));
  const boxes = boxesOf(result);
  const points = result.edges.flatMap((edge) => edge.points);
  const left = Math.min(...boxes.map((box) => box.x), ...points.map((point) => point.x));
  const top = Math.min(...boxes.map((box) => box.y), ...points.map((point) => point.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width), ...points.map((point) => point.x));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height), ...points.map((point) => point.y));
  assert.deepEqual(result.bounds, { x: left, y: top, width: hundredths(right - left), height: hundredths(bottom - top) });
  assertLines(result);
});

test('keeping clear of many fixed boxes takes one sweep a row', () => {
  // Laid-out boxes first, so that they start left of every fixed box; tall fixed boxes listed right to left, which
  // reach into every row of the chain.
  const nodes = Array.from({ length: 20 }, (_, index) => ({ id: `n${index}`, width: 40, height: 30 }));
  for (let index = 0; index < 9800; index += 1) {
    nodes.push({ id: `f${index}`, width: 40, height: 30000, layer: 1000, position: { x: (9799 - index) * 41, y: -100 } });
  }
  const edges = nodes.slice(1, 20).map((node, index) => ({ from: `n${index}`, to: node.id }));
  const start = performance.now();
  const result = layout({ nodes, edges });
  assert.ok(performance.now() - start < 1000);
  assertNoOverlap({ ...result, nodes: result.nodes.filter((node) => !node.fixed || node.id === 'f0') });
  assert.ok(result.nodes.slice(0, 20).every((node) => node.x >= 9799 * 41 + 40));
});

test('a box with 1500 children packs the lines of its one gap by where they start, quickly', () => {
  const graph = {
    nodes: [{ id: 'root', width: 200, height: 40 }, ...Array.from({ length: 1500 }, (_, index) => ({ id: `c${index}`, width: 100, height: 40 }))],
    edges: Array.from({ length: 1500 }, (_, index) => ({ from: 'root', to: `c${index}` })),
  };
  const start = performance.now();
  const result = layout(graph);
  assert.ok(performance.now() - start < 1000);
  assertNoOverlap(result);
  assertLines(result);
});

test('a graph that needs more than 200000 boxes and points where lines cross rows is refused', () => {
  const nodes = Array.from({ length: 2001 }, (_, index) => ({ id: `n${index}`, width: 10, height: 10 }));
  const edges = nodes.slice(1).map((node, index) => ({ from: `n${index}`, to: node.id }));
  for (let line = 0; line < 60; line += 1) edges.push({ from: 'n0', to: 'n2000' });
  assert.throws(() => layout({ nodes, edges }), (error) => error instanceof RangeError && /more than 200000/.test(error.message));
  assert.equal(layout({ nodes, edges: edges.slice(0, 2000 + 40) }).nodes.length, 2001);
});

test('an empty graph lays out nothing', () => {
  assert.deepEqual(layout({ nodes: [], edges: [] }), { bounds: { x: 0, y: 0, width: 0, height: 0 }, nodes: [], edges: [] });
  assert.deepEqual(layout({ nodes: [] }).edges, []);
});

test('a refused input names the field and its rule, never the value', () => {
  const marker = `marker-${Math.random().toString(36).slice(2)}`;
  const box = (extra = {}) => ({ id: marker, width: 10, height: 10, ...extra });
  const cases = [
    [null, TypeError, /graph must be an object/],
    [{ nodes: 'x' }, TypeError, /graph\.nodes must be an array/],
    [{ nodes: [box(), box()] }, TypeError, /graph\.nodes\[1\]\.id is the id of an earlier node/],
    [{ nodes: [box({ id: '' })] }, TypeError, /graph\.nodes\[0\]\.id must be a text/],
    [{ nodes: [box({ width: 0 })] }, RangeError, /graph\.nodes\[0\]\.width must be a number from 1/],
    [{ nodes: [box({ height: Number.NaN })] }, RangeError, /graph\.nodes\[0\]\.height must be a number from 1/],
    [{ nodes: [box({ layer: 1.5 })] }, RangeError, /graph\.nodes\[0\]\.layer must be a whole number/],
    [{ nodes: [box({ layer: -1 })] }, RangeError, /graph\.nodes\[0\]\.layer must be a whole number/],
    [{ nodes: [box({ position: { x: 2e6, y: 0 } })] }, RangeError, /graph\.nodes\[0\]\.position\.x must be a number/],
    [{ nodes: [box()], edges: [{ from: marker, to: `${marker}-gone` }] }, TypeError, /graph\.edges\[0\]\.to must be the id of a node/],
    [{ nodes: [box()], edges: [{ from: marker, to: marker, label: { width: 5, height: 0 } }] }, RangeError, /graph\.edges\[0\]\.label\.height/],
  ];
  for (const [graph, kind, message] of cases) {
    assert.throws(() => layout(graph), (error) => {
      assert.ok(error instanceof kind, error.message);
      assert.match(error.message, message);
      assert.equal(error.message.includes(marker), false, 'the message holds no value');
      return true;
    });
  }
  const graph = { nodes: [box()] };
  assert.throws(() => layout(graph, { direction: 'BT' }), /options\.direction must be TB or LR/);
  assert.throws(() => layout(graph, { nodeGap: 0 }), /options\.nodeGap must be a number from 1/);
  assert.throws(() => layout(graph, { nodegap: 10 }), /the options may hold only/);
  assert.throws(() => layout({ nodes: Array.from({ length: 10001 }, (_, index) => box({ id: `${index}` })) }), RangeError);
});

test('the layout imports nothing and uses neither the clock nor chance, so a page loads it and redraws it the same', () => {
  const text = readFileSync(new URL('../src/layout.js', import.meta.url), 'utf8');
  assert.doesNotMatch(text, /^\s*import\b|\bimport\(|\brequire\(/m);
  assert.doesNotMatch(text, /Math\.random|Date\b|performance\.|process\.|Buffer\b|setTimeout|crypto/);
});
