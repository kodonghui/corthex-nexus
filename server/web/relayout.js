// Where the workbench draws each box and line of a picture (TASK-458; SPEC-012). No drawing reads a position (see the
// server README's "Moving an element"): an element's position is where the owner put its box, and the page draws the
// box there, re-routes its lines to it and keeps the other boxes clear of it.
//
// - Nothing moved: every box and line as drawn ('drawn').
// - The ERD, the sitemap and the user flows ('clear'): the page builds again the input its drawer gave src/layout.js,
//   which the server serves unchanged at /web/layout.js, from the elements: the boxes in their order and the lines
//   between them. It uses that input only when, with no position, layout.js gives back exactly the boxes, lines and
//   labels drawn, which it checks for each drawing. Then it lays the picture out again with the moved boxes fixed, so
//   the other boxes keep clear of them and every line is routed again.
// - The DDD board, whose stickies are placed inside frames by layouts of their own, and any picture whose input cannot
//   be built again, such as a flow with links it does not draw ('over'): each moved box is drawn at its place over the
//   others, and only its own lines are re-routed, straight to it.

import { layout } from './layout.js';

// The kinds whose drawer's input the page can build again from the elements.
const REBUILT = Object.freeze(['erd', 'sitemap', 'user_flow']);
// What was found for each drawing: its input for layout.js, or null when it does not give back what was drawn.
const checked = new Map();
const CHECKED_KEPT = 20;

const boxOf = (element) => {
  const box = element.detail?.box;
  return box && Number.isFinite(box.x) && Number.isFinite(box.y) && box.width > 0 && box.height > 0 ? box : null;
};
const pointsOf = (element) => (Array.isArray(element.detail?.points) ? element.detail.points : null);

// The ends of a line, as the keys of its boxes: { from, to } as its points run, or null for an element that is no line.
export function endsOf(element) {
  const { from, to } = element.detail ?? {};
  return pointsOf(element) !== null && typeof from === 'string' && typeof to === 'string' ? { from, to } : null;
}

// The places of the diagram's boxes and lines: { mode, boxes, lines, labels, bounds }, boxes, lines and labels being
// maps by element key. moves, a map of key to { x, y }, holds the places the owner is moving boxes to and has not yet
// sent, over the positions the diagram answered.
export function placement(diagram, moves = new Map()) {
  const elements = diagram.elements ?? [];
  const boxes = new Map();
  const lines = new Map();
  const labels = new Map();
  const moved = new Map();
  for (const element of elements) {
    const box = boxOf(element);
    if (box !== null) {
      boxes.set(element.key, box);
      const at = moves.get(element.key) ?? element.position ?? null;
      if (at !== null && (at.x !== box.x || at.y !== box.y)) moved.set(element.key, { x: at.x, y: at.y });
    }
    const points = pointsOf(element);
    if (points !== null) {
      lines.set(element.key, points);
      labels.set(element.key, element.detail.label_box ?? null);
    }
  }
  if (moved.size === 0) return { mode: 'drawn', boxes, lines, labels, bounds: boundsOf(boxes, lines, labels) };
  const input = REBUILT.includes(diagram.kind) ? inputOf(diagram, boxes, lines, labels) : null;
  if (input !== null) {
    try {
      const laid = layout({ nodes: input.nodes.map((node) => (moved.has(node.id) ? { ...node, position: moved.get(node.id) } : node)), edges: input.edges }, input.options);
      const placed = new Map(boxes);
      laid.nodes.forEach(({ id, x, y, width, height }) => placed.set(id, { x, y, width, height }));
      const routed = new Map(lines);
      const routedLabels = new Map(labels);
      input.lines.forEach((key, index) => {
        const points = laid.edges[index].points.map(({ x, y }) => ({ x, y }));
        routed.set(key, input.reversed ? points.reverse() : points);
        routedLabels.set(key, laid.edges[index].label);
      });
      return { mode: 'clear', boxes: placed, lines: routed, labels: routedLabels, bounds: boundsOf(placed, routed, routedLabels) };
    } catch {
      // A layout that cannot place the moved boxes draws them over the others.
    }
  }
  const placed = new Map(boxes);
  for (const [key, at] of moved) placed.set(key, { ...boxes.get(key), x: at.x, y: at.y });
  const routed = new Map(lines);
  const routedLabels = new Map(labels);
  for (const element of elements) {
    const ends = endsOf(element);
    if (ends === null || (!moved.has(ends.from) && !moved.has(ends.to))) continue;
    const from = placed.get(ends.from);
    const to = placed.get(ends.to);
    if (from === undefined || to === undefined) continue;
    const points = straight(from, to);
    routed.set(element.key, points);
    const label = labels.get(element.key);
    if (label) routedLabels.set(element.key, { ...label, x: (points[0].x + points[1].x) / 2 + 4, y: (points[0].y + points[1].y) / 2 - label.height / 2 });
  }
  return { mode: 'over', boxes: placed, lines: routed, labels: routedLabels, bounds: boundsOf(placed, routed, routedLabels) };
}

// The input the drawer gave layout.js, built again from the drawing's elements, or null when it does not give back
// the drawing exactly. { nodes, edges, options, lines, reversed }: lines are the keys of the line elements in the
// order of edges, and reversed says that a line's points run against its edge, as an ERD line runs from the table that
// holds the key up to the table it references.
function inputOf(diagram, boxes, lines, labels) {
  const id = diagram.drawing?.status === 'drawn' ? diagram.drawing.id : diagram.last_drawn?.id ?? null;
  const known = id === null ? undefined : checked.get(id);
  if (known !== undefined) return known;
  const found = buildInput(diagram, boxes, lines, labels);
  if (id !== null) {
    if (checked.size >= CHECKED_KEPT) checked.delete(checked.keys().next().value);
    checked.set(id, found);
  }
  return found;
}

function buildInput(diagram, boxes, lines, labels) {
  const elements = diagram.elements ?? [];
  const boxed = elements.filter((element) => boxes.has(element.key) && !CONTAINERS.has(element.kind));
  const lined = elements.filter((element) => lines.has(element.key) && endsOf(element) !== null);
  const nodes = boxed.map((element) => {
    const { width, height } = boxes.get(element.key);
    return { id: element.key, width, height };
  });
  const keys = new Set(nodes.map((node) => node.id));
  if (lined.some((element) => !keys.has(element.detail.from) || !keys.has(element.detail.to))) return null;
  const reversed = diagram.kind === 'erd';
  const edges = lined.map((element) => {
    const { from, to } = element.detail;
    const label = labels.get(element.key);
    return {
      from: reversed ? to : from,
      to: reversed ? from : to,
      ...(label ? { label: { width: label.width, height: label.height } } : {}),
    };
  });
  const tries = diagram.kind === 'user_flow' ? [{ direction: 'TB' }, { direction: 'LR' }] : [{}];
  for (const options of tries) {
    const graph = { nodes, edges };
    let laid;
    try {
      laid = layout(graph, options);
    } catch {
      return null;
    }
    if (sameDrawing(laid, boxed, lined, boxes, lines, labels, reversed)) return { nodes, edges, options, lines: lined.map((element) => element.key), reversed };
  }
  return null;
}

// A user flow's lanes have no box; a DDD board's frames do, but its kind is never built again. Listed so that a box
// drawn round others never joins the input.
const CONTAINERS = new Set(['lane', 'context', 'hotspot_lane']);

// Whether layout.js's answer is the drawing, box for box, line for line and label for label.
function sameDrawing(laid, boxed, lined, boxes, lines, labels, reversed) {
  const sameBox = (a, b) => a !== null && b !== null && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
  if (!boxed.every((element, index) => sameBox(laid.nodes[index], boxes.get(element.key)))) return false;
  return lined.every((element, index) => {
    const edge = laid.edges[index];
    const drawn = lines.get(element.key);
    const points = reversed ? [...edge.points].reverse() : edge.points;
    if (points.length !== drawn.length || points.some((point, at) => point.x !== drawn[at].x || point.y !== drawn[at].y)) return false;
    const label = labels.get(element.key) ?? null;
    return label === null ? edge.label === null : sameBox(edge.label, label);
  });
}

// A straight line from one box to another, between the points where the line joining their centres leaves each box.
export function straight(from, to) {
  const a = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const b = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
  return [edgePoint(from, a, b), edgePoint(to, b, a)];
}

function edgePoint(box, centre, toward) {
  const dx = toward.x - centre.x;
  const dy = toward.y - centre.y;
  if (dx === 0 && dy === 0) return centre;
  const scale = Math.min(dx === 0 ? Infinity : box.width / 2 / Math.abs(dx), dy === 0 ? Infinity : box.height / 2 / Math.abs(dy));
  return { x: round(centre.x + dx * scale), y: round(centre.y + dy * scale) };
}

const round = (value) => Math.round(value * 100) / 100;

// The box that holds every box, line and label.
function boundsOf(boxes, lines, labels) {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  const take = (x, y, width = 0, height = 0) => {
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x + width);
    bottom = Math.max(bottom, y + height);
  };
  for (const box of boxes.values()) take(box.x, box.y, box.width, box.height);
  for (const points of lines.values()) for (const point of points) take(point.x, point.y);
  for (const label of labels.values()) if (label) take(label.x, label.y, label.width, label.height);
  if (left === Infinity) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: left, y: top, width: right - left, height: bottom - top };
}
