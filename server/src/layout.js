// The picture layout (TASK-420): where the boxes and lines of a picture go. The drawing tasks give it the boxes and
// lines of the DDD board, the ERD, a user flow or the sitemap tree (SPEC-003, SPEC-004, SPEC-006, SPEC-007) and draw
// what it returns; it draws nothing itself. It imports nothing, so the server and a page can both load it.
//
// It is a layered layout, top to bottom, in the steps of Sugiyama's method:
// 1. Layers. Each box gets a layer: the layer its node pins, or one below every box that points to it. A depth-first
//    search in input order turns round the lines that close a cycle, so a flow's way back points up.
// 2. Rows. Real layers are the even rows; the odd row between two layers holds the lines that pass and their labels.
//    A line that crosses rows gets a point in each row it passes, so lines never cross a box the layout places.
// 3. Order. Sweeps down and up sort each row by the mean place of its neighbours in the row before, and the order
//    with the fewest crossings wins.
// 4. Places across. Brandes and Köpf's method lines up long lines and children under their parents, and keeps the
//    gaps between boxes. Parts that share no line stand side by side in input order.
// 5. Lines. A line leaves the bottom of its box and enters the top of the next, and turns on a track of the gap
//    between two rows. Lines on one track keep apart, and a line that leaves a row goes above one that enters the
//    next row at the same x, so two lines do not run on top of each other. A gap of over 1000 turns keeps only the
//    first rule, to stay fast.
//
// The same input always gives the same output: every choice breaks ties by input order, and nothing depends on the
// clock or on chance. A box whose node has a position (SPEC-012, kept by TASK-442) stays at that position and the
// others keep clear of it.

export const LAYOUT_DEFAULTS = Object.freeze({
  // TB lays layers out top to bottom; LR left to right, as a Mermaid flowchart LR is drawn.
  direction: 'TB',
  // The space between two boxes of one row.
  nodeGap: 32,
  // The least space between two rows of boxes.
  layerGap: 48,
  // The space between two lines that run side by side, and from a line to its label.
  edgeGap: 12,
});

export const LAYOUT_LIMITS = Object.freeze({
  nodes: 10000,
  edges: 50000,
  // Boxes plus one point for each row a line crosses: the work grows with it, so that no input holds the caller for
  // long.
  items: 200000,
  layer: 1000,
  size: 100000,
  coordinate: 1000000,
  gap: 10000,
});

// The ordering stops after this many sweeps, or after this many sweeps in a row that find no fewer crossings.
const SWEEPS = 32;
const SWEEPS_WITHOUT_GAIN = 4;
// A gap with more turns than this packs them by where they start, which takes n log n steps instead of n squared.
const TURNS_PACKED_BY_START = 1000;

// Returns where each box and line goes:
// { bounds: { x, y, width, height },
//   nodes: [{ id, x, y, width, height, layer, fixed }],
//   edges: [{ from, to, points: [{ x, y }, ...], label: { x, y, width, height } | null }] }
// nodes and edges are in the order of the input. x and y are the top left corner of a box.
export function layout(graph, options = {}) {
  const settings = readOptions(options);
  const input = readGraph(graph);
  const across = settings.direction === 'LR';
  const model = buildModel(input, settings, across);
  orderRows(model);
  placeAcross(model);
  placeDown(model);
  if (model.fixedCount > 0) {
    keepClearOfFixed(model);
    connect(model);
  }
  return output(model, input, across);
}

// Input.

function readOptions(options) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('the options must be an object');
  }
  for (const name of Object.keys(options)) {
    if (!Object.hasOwn(LAYOUT_DEFAULTS, name)) {
      throw new TypeError('the options may hold only direction, nodeGap, layerGap and edgeGap');
    }
  }
  const direction = options.direction ?? LAYOUT_DEFAULTS.direction;
  if (direction !== 'TB' && direction !== 'LR') throw new RangeError('options.direction must be TB or LR');
  const gap = (name) => {
    const value = options[name] ?? LAYOUT_DEFAULTS[name];
    if (typeof value !== 'number' || !(value >= 1 && value <= LAYOUT_LIMITS.gap)) {
      throw new RangeError(`options.${name} must be a number from 1 to ${LAYOUT_LIMITS.gap}`);
    }
    return value;
  };
  return { direction, nodeGap: gap('nodeGap'), layerGap: gap('layerGap'), edgeGap: gap('edgeGap') };
}

// Errors name the field and its rule, never the value, as the server's settings do.
function readGraph(graph) {
  if (graph === null || typeof graph !== 'object' || Array.isArray(graph)) {
    throw new TypeError('the graph must be an object with nodes and edges');
  }
  const nodes = graph.nodes;
  const edges = graph.edges ?? [];
  if (!Array.isArray(nodes)) throw new TypeError('graph.nodes must be an array');
  if (!Array.isArray(edges)) throw new TypeError('graph.edges must be an array');
  if (nodes.length > LAYOUT_LIMITS.nodes) {
    throw new RangeError(`graph.nodes may hold at most ${LAYOUT_LIMITS.nodes} nodes`);
  }
  if (edges.length > LAYOUT_LIMITS.edges) {
    throw new RangeError(`graph.edges may hold at most ${LAYOUT_LIMITS.edges} edges`);
  }
  const ids = new Map();
  const readNodes = nodes.map((node, index) => {
    const at = `graph.nodes[${index}]`;
    if (node === null || typeof node !== 'object') throw new TypeError(`${at} must be an object`);
    if (typeof node.id !== 'string' || node.id === '') throw new TypeError(`${at}.id must be a text that is not empty`);
    if (ids.has(node.id)) throw new TypeError(`${at}.id is the id of an earlier node`);
    ids.set(node.id, index);
    const layer = node.layer ?? null;
    if (layer !== null && !(Number.isInteger(layer) && layer >= 0 && layer <= LAYOUT_LIMITS.layer)) {
      throw new RangeError(`${at}.layer must be a whole number from 0 to ${LAYOUT_LIMITS.layer}`);
    }
    const position = node.position ?? null;
    if (position !== null && typeof position !== 'object') {
      throw new TypeError(`${at}.position must be an object with x and y`);
    }
    return {
      id: node.id,
      width: readSize(node.width, `${at}.width`),
      height: readSize(node.height, `${at}.height`),
      layer,
      position: position === null
        ? null
        : { x: readCoordinate(position.x, `${at}.position.x`), y: readCoordinate(position.y, `${at}.position.y`) },
    };
  });
  const readEdges = edges.map((edge, index) => {
    const at = `graph.edges[${index}]`;
    if (edge === null || typeof edge !== 'object') throw new TypeError(`${at} must be an object`);
    const from = typeof edge.from === 'string' ? ids.get(edge.from) : undefined;
    if (from === undefined) throw new TypeError(`${at}.from must be the id of a node`);
    const to = typeof edge.to === 'string' ? ids.get(edge.to) : undefined;
    if (to === undefined) throw new TypeError(`${at}.to must be the id of a node`);
    const label = edge.label ?? null;
    if (label !== null && typeof label !== 'object') {
      throw new TypeError(`${at}.label must be an object with width and height`);
    }
    return {
      from,
      to,
      label: label === null
        ? null
        : { width: readSize(label.width, `${at}.label.width`), height: readSize(label.height, `${at}.label.height`) },
    };
  });
  return { nodes: readNodes, edges: readEdges };
}

function readSize(value, at) {
  if (typeof value !== 'number' || !(value >= 1 && value <= LAYOUT_LIMITS.size)) {
    throw new RangeError(`${at} must be a number from 1 to ${LAYOUT_LIMITS.size}`);
  }
  return value;
}

function readCoordinate(value, at) {
  const limit = LAYOUT_LIMITS.coordinate;
  if (typeof value !== 'number' || !(value >= -limit && value <= limit)) {
    throw new RangeError(`${at} must be a number from -${limit} to ${limit}`);
  }
  return value;
}

// Layers.

// The layer of each node: its pinned layer, or the longest path to it from a node nothing points to. A node nothing
// points to then moves down to just above the nearest node it points to, so that its lines stay short. Lines between
// two pinned nodes take no part: their layers are given.
function assignLayers(nodes, edges) {
  const count = nodes.length;
  const pinned = nodes.map((node) => node.layer);
  const free = (edge) => edge.from !== edge.to && (pinned[edge.from] === null || pinned[edge.to] === null);
  const outgoing = Array.from({ length: count }, () => []);
  edges.forEach((edge, index) => {
    if (free(edge)) outgoing[edge.from].push(index);
  });
  // A depth-first search in input order: a line to a node still on the search path closes a cycle and is turned.
  const state = new Uint8Array(count);
  const turned = new Uint8Array(edges.length);
  for (let start = 0; start < count; start += 1) {
    if (state[start] !== 0) continue;
    state[start] = 1;
    const stack = [[start, 0]];
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const [node, next] = top;
      if (next < outgoing[node].length) {
        top[1] = next + 1;
        const index = outgoing[node][next];
        const target = edges[index].to;
        if (state[target] === 1) {
          turned[index] = 1;
        } else if (state[target] === 0) {
          state[target] = 1;
          stack.push([target, 0]);
        }
      } else {
        state[node] = 2;
        stack.pop();
      }
    }
  }
  const before = Array.from({ length: count }, () => []);
  const after = Array.from({ length: count }, () => []);
  const waiting = new Int32Array(count);
  edges.forEach((edge, index) => {
    if (!free(edge)) return;
    const [upper, lower] = turned[index] === 1 ? [edge.to, edge.from] : [edge.from, edge.to];
    after[upper].push(lower);
    before[lower].push(upper);
    waiting[lower] += 1;
  });
  const order = [];
  for (let node = 0; node < count; node += 1) {
    if (waiting[node] === 0) order.push(node);
  }
  for (let head = 0; head < order.length; head += 1) {
    for (const lower of after[order[head]]) {
      waiting[lower] -= 1;
      if (waiting[lower] === 0) order.push(lower);
    }
  }
  const layers = new Int32Array(count);
  for (const node of order) {
    if (pinned[node] !== null) {
      layers[node] = pinned[node];
      continue;
    }
    let layer = 0;
    for (const upper of before[node]) layer = Math.max(layer, layers[upper] + 1);
    layers[node] = layer;
  }
  for (const node of order) {
    if (pinned[node] !== null || before[node].length > 0 || after[node].length === 0) continue;
    let layer = Infinity;
    for (const lower of after[node]) layer = Math.min(layer, layers[lower] - 1);
    if (layer > layers[node]) layers[node] = layer;
  }
  return layers;
}

// The model: items and segments.
//
// Items are the things that take room in a row: the real nodes first, in input order, then one dummy for each row a
// line passes, which holds the line's label in the row the label goes in. A segment joins an item in one row to an
// item in the row below. Places across are anchors: a node's middle, or where its line passes a dummy. Every
// coordinate is worked out top to bottom, with x across; a left-to-right picture swaps them on the way in and out.

function buildModel(input, settings, across) {
  const { nodes, edges } = input;
  const count = nodes.length;
  const layers = assignLayers(nodes, edges);
  let items = count;
  for (const edge of edges) items += Math.max(1, 2 * Math.abs(layers[edge.to] - layers[edge.from]) - 1);
  if (items > LAYOUT_LIMITS.items) {
    throw new RangeError(`the graph needs more than ${LAYOUT_LIMITS.items} boxes and points where lines cross rows`);
  }
  const model = {
    settings,
    count,
    layers,
    labelOffset: settings.edgeGap / 2,
    // Per item.
    rank: [],
    left: [],
    right: [],
    height: [],
    label: [],
    upSegments: [],
    downSegments: [],
    // Per segment.
    segmentFrom: [],
    segmentTo: [],
    // Per real node: its size, top to bottom, and its fixed position, if any.
    width: [],
    nodeHeight: [],
    fixed: [],
    fixedCount: 0,
    // Per edge.
    lines: [],
  };
  nodes.forEach((node, index) => {
    const width = across ? node.height : node.width;
    const height = across ? node.width : node.height;
    model.width.push(width);
    model.nodeHeight.push(height);
    const fixed = node.position === null
      ? null
      : (across ? { x: node.position.y, y: node.position.x } : { x: node.position.x, y: node.position.y });
    model.fixed.push(fixed);
    if (fixed !== null) model.fixedCount += 1;
    addItem(model, 2 * layers[index], width / 2, width / 2, height, null);
  });
  edges.forEach((edge, index) => {
    const label = edge.label === null
      ? null
      : (across ? { width: edge.label.height, height: edge.label.width } : { ...edge.label });
    const from = edge.from;
    const to = edge.to;
    const line = { kind: '', from, to, segments: [], labelItem: -1 };
    if (from === to || layers[from] === layers[to]) {
      // A line to its own box, or between two boxes pinned to one layer, dips into the row below and comes back.
      line.kind = from === to ? 'self' : 'flat';
      const dummy = addDummy(model, 2 * layers[from] + 1, label);
      if (label !== null) line.labelItem = dummy;
      line.segments.push(addSegment(model, from, dummy), addSegment(model, to, dummy));
    } else {
      line.kind = layers[from] < layers[to] ? 'down' : 'up';
      const upper = line.kind === 'down' ? from : to;
      const lower = line.kind === 'down' ? to : from;
      const top = 2 * layers[upper];
      const bottom = 2 * layers[lower];
      // The label goes in the odd row nearest the middle of the line, the upper one of two.
      const middle = (top + bottom) / 2;
      const labelRank = middle % 2 === 1 ? middle : middle - 1;
      let previous = upper;
      for (let rank = top + 1; rank < bottom; rank += 1) {
        const dummy = addDummy(model, rank, rank === labelRank ? label : null);
        if (rank === labelRank && label !== null) line.labelItem = dummy;
        line.segments.push(addSegment(model, previous, dummy));
        previous = dummy;
      }
      line.segments.push(addSegment(model, previous, lower));
    }
    model.lines.push(line);
  });
  model.parts = findParts(model, edges);
  return model;
}

function addItem(model, rank, left, right, height, label) {
  model.rank.push(rank);
  model.left.push(left);
  model.right.push(right);
  model.height.push(height);
  model.label.push(label);
  model.upSegments.push([]);
  model.downSegments.push([]);
  return model.rank.length - 1;
}

// A dummy is a point where its line passes, or, with a label, the label beside the line, to its right.
function addDummy(model, rank, label) {
  if (label === null) return addItem(model, rank, 0, 0, 0, null);
  return addItem(model, rank, 0, model.labelOffset + label.width, label.height, label);
}

function addSegment(model, from, to) {
  const segment = model.segmentFrom.length;
  model.segmentFrom.push(from);
  model.segmentTo.push(to);
  model.downSegments[from].push(segment);
  model.upSegments[to].push(segment);
  return segment;
}

// Parts are the sets of nodes joined by lines, in the order of their first node. Each part is ordered and placed on
// its own, then the parts stand side by side; rows are shared, so a pinned layer is one row across the picture.
function findParts(model, edges) {
  const { count } = model;
  const parent = Int32Array.from({ length: count }, (_, index) => index);
  const find = (node) => {
    let root = node;
    while (parent[root] !== root) {
      parent[root] = parent[parent[root]];
      root = parent[root];
    }
    return root;
  };
  for (const edge of edges) {
    const a = find(edge.from);
    const b = find(edge.to);
    if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
  }
  const partOf = new Int32Array(model.rank.length);
  const parts = [];
  const byRoot = new Map();
  for (let node = 0; node < count; node += 1) {
    const root = find(node);
    if (!byRoot.has(root)) {
      byRoot.set(root, parts.length);
      parts.push({ nodes: [], items: [], low: Infinity, high: -Infinity, rows: [] });
    }
    partOf[node] = byRoot.get(root);
    parts[partOf[node]].nodes.push(node);
  }
  model.lines.forEach((line) => {
    const part = partOf[line.from];
    for (const segment of line.segments) {
      const item = model.segmentTo[segment];
      if (item >= count) partOf[item] = part;
    }
  });
  for (let item = 0; item < model.rank.length; item += 1) {
    const part = parts[partOf[item]];
    part.items.push(item);
    part.low = Math.min(part.low, model.rank[item]);
    part.high = Math.max(part.high, model.rank[item]);
  }
  return parts;
}

// Order.

function orderRows(model) {
  const position = new Int32Array(model.rank.length);
  model.position = position;
  const visited = new Uint8Array(model.rank.length);
  for (const part of model.parts) {
    part.rows = Array.from({ length: part.high - part.low + 1 }, () => []);
    // The first order: a depth-first walk down from each node in input order, so a subtree stays together.
    for (const start of part.nodes) {
      const stack = [start];
      while (stack.length > 0) {
        const item = stack.pop();
        if (visited[item] === 1) continue;
        visited[item] = 1;
        part.rows[model.rank[item] - part.low].push(item);
        const down = model.downSegments[item];
        for (let index = down.length - 1; index >= 0; index -= 1) {
          const next = model.segmentTo[down[index]];
          if (visited[next] === 0) stack.push(next);
        }
      }
    }
    setPositions(part.rows, position);
    part.segmentsByRow = part.rows.map((row) => row.flatMap((item) => model.downSegments[item]));
    let best = part.rows.map((row) => row.slice());
    let fewest = crossings(model, part);
    for (let sweep = 0, withoutGain = 0; withoutGain < SWEEPS_WITHOUT_GAIN && sweep < SWEEPS && fewest > 0; sweep += 1) {
      const downward = sweep % 2 === 0;
      const rightFirst = sweep % 4 >= 2;
      if (downward) {
        for (let row = 1; row < part.rows.length; row += 1) {
          sortRow(model, part.rows[row], model.upSegments, model.segmentFrom, rightFirst);
        }
      } else {
        for (let row = part.rows.length - 2; row >= 0; row -= 1) {
          sortRow(model, part.rows[row], model.downSegments, model.segmentTo, rightFirst);
        }
      }
      const found = crossings(model, part);
      if (found < fewest) {
        fewest = found;
        best = part.rows.map((row) => row.slice());
        withoutGain = 0;
      } else {
        withoutGain += 1;
      }
    }
    part.rows = best;
    setPositions(part.rows, position);
  }
}

function setPositions(rows, position) {
  for (const row of rows) {
    row.forEach((item, index) => {
      position[item] = index;
    });
  }
}

// Sorts a row by the mean position of each item's neighbours in the row before. An item with no neighbour there
// keeps its place. Ties keep the current order, or the reverse on alternate pairs of sweeps.
function sortRow(model, row, segmentsOf, otherEnd, rightFirst) {
  const { position } = model;
  const sortable = [];
  const kept = [];
  row.forEach((item, index) => {
    const segments = segmentsOf[item];
    if (segments.length === 0) {
      kept.push({ item, index });
      return;
    }
    let sum = 0;
    for (const segment of segments) sum += position[otherEnd[segment]];
    sortable.push({ item, index, mean: sum / segments.length });
  });
  if (sortable.length < 2) return;
  sortable.sort((a, b) => a.mean - b.mean || (rightFirst ? b.index - a.index : a.index - b.index));
  let slot = 0;
  let next = 0;
  const take = () => {
    while (next < kept.length && kept[next].index <= slot) {
      row[slot] = kept[next].item;
      slot += 1;
      next += 1;
    }
  };
  take();
  for (const entry of sortable) {
    row[slot] = entry.item;
    slot += 1;
    take();
  }
  while (next < kept.length) {
    row[slot] = kept[next].item;
    slot += 1;
    next += 1;
  }
  row.forEach((item, index) => {
    position[item] = index;
  });
}

// The number of crossings between each pair of rows, counted as inversions with a Fenwick tree.
function crossings(model, part) {
  const { position, segmentFrom, segmentTo } = model;
  let total = 0;
  for (let row = 0; row + 1 < part.rows.length; row += 1) {
    const segments = part.segmentsByRow[row];
    if (segments.length < 2) continue;
    const width = part.rows[row + 1].length;
    const codes = new Float64Array(segments.length);
    segments.forEach((segment, index) => {
      codes[index] = position[segmentFrom[segment]] * width + position[segmentTo[segment]];
    });
    codes.sort();
    const tree = new Int32Array(width + 1);
    for (let index = 0; index < codes.length; index += 1) {
      const lower = codes[index] % width;
      // Segments already counted whose lower end lies right of this one cross it.
      let notRight = 0;
      for (let at = lower + 1; at > 0; at -= at & -at) notRight += tree[at];
      total += index - notRight;
      for (let at = lower + 1; at <= width; at += at & -at) tree[at] += 1;
    }
  }
  return total;
}

// Places across.

function placeAcross(model) {
  const { settings } = model;
  const items = model.rank.length;
  model.anchor = new Float64Array(items);
  const half = (item) => (item < model.count ? settings.nodeGap / 2 : settings.edgeGap / 2);
  model.half = half;
  let offset = 0;
  for (const part of model.parts) {
    const xs = brandesKoepf(model, part);
    let low = Infinity;
    let high = -Infinity;
    part.items.forEach((item, index) => {
      low = Math.min(low, xs[index] - model.left[item]);
      high = Math.max(high, xs[index] + model.right[item]);
    });
    part.items.forEach((item, index) => {
      model.anchor[item] = round(xs[index] - low + offset);
    });
    offset += high - low + settings.nodeGap;
  }
  model.columnOrder = rowsAcrossParts(model);
}

// Brandes and Köpf, "Fast and Simple Horizontal Coordinate Assignment" (2001): four alignments, from the top and from
// the bottom, leaning left and right; each lines items up with a median neighbour into blocks and packs the blocks
// as close as the gaps allow. The four are shifted onto the narrowest and each item takes the mean of its two middle
// places.
function brandesKoepf(model, part) {
  const size = part.items.length;
  const local = new Map();
  part.items.forEach((item, index) => local.set(item, index));
  const rows = part.rows.map((row) => row.map((item) => local.get(item)));
  const unique = (segments, end) => [...new Set(segments.map((segment) => local.get(end[segment])))];
  const up = part.items.map((item) => unique(model.upSegments[item], model.segmentFrom));
  const down = part.items.map((item) => unique(model.downSegments[item], model.segmentTo));
  const dummy = part.items.map((item) => item >= model.count);
  const left = part.items.map((item) => model.left[item]);
  const right = part.items.map((item) => model.right[item]);
  const half = part.items.map((item) => model.half(item));
  const position = new Int32Array(size);
  rows.forEach((row) => row.forEach((item, index) => {
    position[item] = index;
  }));
  const conflicts = innerConflicts(rows, up, dummy, position, size);
  const alignments = [];
  for (const fromTop of [true, false]) {
    const vertical = fromTop ? rows : rows.slice().reverse();
    for (const leaningRight of [false, true]) {
      const layering = leaningRight ? vertical.map((row) => row.slice().reverse()) : vertical;
      const root = alignBlocks(layering, conflicts, fromTop ? up : down, size);
      alignments.push({ leaningRight, xs: packBlocks(layering, root, leaningRight, left, right, half, size) });
    }
  }
  const widthOf = (xs) => {
    let low = Infinity;
    let high = -Infinity;
    for (let item = 0; item < size; item += 1) {
      low = Math.min(low, xs[item] - left[item]);
      high = Math.max(high, xs[item] + right[item]);
    }
    return high - low;
  };
  let narrowest = alignments[0];
  let narrowestWidth = widthOf(narrowest.xs);
  for (const alignment of alignments.slice(1)) {
    const width = widthOf(alignment.xs);
    if (width < narrowestWidth) {
      narrowest = alignment;
      narrowestWidth = width;
    }
  }
  const lowest = (xs) => xs.reduce((low, x) => Math.min(low, x), Infinity);
  const highest = (xs) => xs.reduce((high, x) => Math.max(high, x), -Infinity);
  for (const alignment of alignments) {
    if (alignment === narrowest) continue;
    const shift = alignment.leaningRight
      ? highest(narrowest.xs) - highest(alignment.xs)
      : lowest(narrowest.xs) - lowest(alignment.xs);
    for (let item = 0; item < size; item += 1) alignment.xs[item] += shift;
  }
  const xs = new Float64Array(size);
  const four = new Float64Array(4);
  for (let item = 0; item < size; item += 1) {
    alignments.forEach((alignment, index) => {
      four[index] = alignment.xs[item];
    });
    four.sort();
    xs[item] = (four[1] + four[2]) / 2;
  }
  // The mean keeps every gap, since each alignment does; this pass only guards against rounding.
  for (const row of rows) {
    for (let index = 1; index < row.length; index += 1) {
      const a = row[index - 1];
      const b = row[index];
      const least = xs[a] + right[a] + left[b] + half[a] + half[b];
      if (xs[b] < least) xs[b] = least;
    }
  }
  return xs;
}

const pairKey = (a, b, size) => (a < b ? a * size + b : b * size + a);

// Type 1 conflicts: a segment between two dummies (an inner segment of a long line) crossed by another segment. Long
// lines then stay straight and the other segment gives way.
function innerConflicts(rows, up, dummy, position, size) {
  const conflicts = new Set();
  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1];
    const row = rows[index];
    let k0 = 0;
    let scan = 0;
    row.forEach((item, at) => {
      let inner = -1;
      if (dummy[item]) inner = up[item].find((other) => dummy[other]) ?? -1;
      const k1 = inner >= 0 ? position[inner] : previous.length;
      if (inner >= 0 || at === row.length - 1) {
        for (let s = scan; s <= at; s += 1) {
          const lower = row[s];
          for (const upper of up[lower]) {
            const place = position[upper];
            if ((place < k0 || place > k1) && !(dummy[upper] && dummy[lower])) {
              conflicts.add(pairKey(upper, lower, size));
            }
          }
        }
        scan = at + 1;
        k0 = k1;
      }
    });
  }
  return conflicts;
}

function alignBlocks(layering, conflicts, neighbours, size) {
  const root = new Int32Array(size);
  const align = new Int32Array(size);
  const position = new Int32Array(size);
  for (const row of layering) {
    row.forEach((item, index) => {
      root[item] = item;
      align[item] = item;
      position[item] = index;
    });
  }
  for (const row of layering) {
    let last = -1;
    for (const item of row) {
      let others = neighbours[item];
      if (others.length === 0) continue;
      if (others.length > 1) others = others.slice().sort((a, b) => position[a] - position[b]);
      const middle = (others.length - 1) / 2;
      for (let index = Math.floor(middle); index <= Math.ceil(middle); index += 1) {
        const other = others[index];
        if (align[item] === item && last < position[other] && !conflicts.has(pairKey(item, other, size))) {
          align[other] = item;
          align[item] = root[other];
          root[item] = root[other];
          last = position[other];
        }
      }
    }
  }
  return root;
}

// Packs the blocks left to right: each as far left as the blocks before it allow, then as far right as the blocks
// after it allow, which closes gaps a block does not need.
function packBlocks(layering, root, leaningRight, left, right, half, size) {
  const separation = new Map();
  const after = Array.from({ length: size }, () => []);
  const before = Array.from({ length: size }, () => []);
  const waiting = new Int32Array(size);
  for (const row of layering) {
    for (let index = 1; index < row.length; index += 1) {
      const a = row[index - 1];
      const b = row[index];
      // Leaning right, the rows run right to left and x is mirrored, so the sides swap.
      const gap = (leaningRight ? left[a] + right[b] : right[a] + left[b]) + half[a] + half[b];
      const key = root[a] * size + root[b];
      const known = separation.get(key);
      if (known === undefined) {
        separation.set(key, gap);
        after[root[a]].push(root[b]);
        before[root[b]].push(root[a]);
        waiting[root[b]] += 1;
      } else if (gap > known) {
        separation.set(key, gap);
      }
    }
  }
  const order = [];
  const placed = new Uint8Array(size);
  for (const row of layering) {
    for (const item of row) {
      if (root[item] === item && waiting[item] === 0) {
        order.push(item);
        placed[item] = 1;
      }
    }
  }
  for (let head = 0; head < order.length; head += 1) {
    for (const next of after[order[head]]) {
      waiting[next] -= 1;
      if (waiting[next] === 0) {
        order.push(next);
        placed[next] = 1;
      }
    }
  }
  // The alignment never makes the blocks a cycle; if it did, the rest are placed in row order and the gaps are kept
  // by the pass after the mean.
  for (const row of layering) {
    for (const item of row) {
      if (root[item] === item && placed[item] === 0) {
        order.push(item);
        placed[item] = 1;
      }
    }
  }
  const blockX = new Float64Array(size);
  for (const block of order) {
    let x = 0;
    for (const other of before[block]) x = Math.max(x, blockX[other] + separation.get(other * size + block));
    blockX[block] = x;
  }
  for (let index = order.length - 1; index >= 0; index -= 1) {
    const block = order[index];
    if (after[block].length === 0) continue;
    let x = Infinity;
    for (const other of after[block]) x = Math.min(x, blockX[other] - separation.get(block * size + other));
    if (x > blockX[block]) blockX[block] = x;
  }
  const xs = new Float64Array(size);
  for (let item = 0; item < size; item += 1) xs[item] = leaningRight ? -blockX[root[item]] : blockX[root[item]];
  return xs;
}

// Each row across the whole picture, left to right: the parts' rows one after the other.
function rowsAcrossParts(model) {
  const rows = [];
  for (const part of model.parts) {
    part.rows.forEach((row, index) => {
      const rank = part.low + index;
      while (rows.length <= rank) rows.push([]);
      rows[rank].push(...row);
    });
  }
  return rows;
}

// Places down: row heights, the tracks of each gap, and the lines.

function placeDown(model) {
  const { settings, count } = model;
  const ranks = model.columnOrder.length;
  const rowHeight = new Float64Array(ranks);
  // A fixed box keeps the room of its place in the layout, so that moving a box never moves the rows below it.
  for (let item = 0; item < model.rank.length; item += 1) {
    rowHeight[model.rank[item]] = Math.max(rowHeight[model.rank[item]], model.height[item]);
  }
  model.rowHeight = rowHeight;
  connect(model, true);
  const gapHeight = new Float64Array(ranks);
  for (let rank = 0; rank + 1 < ranks; rank += 1) {
    gapHeight[rank] = Math.max(settings.layerGap / 2, (model.trackCount[rank] + 1) * settings.edgeGap);
  }
  model.gapHeight = gapHeight;
  const rowTop = new Float64Array(ranks);
  for (let rank = 1; rank < ranks; rank += 1) {
    rowTop[rank] = round(rowTop[rank - 1] + rowHeight[rank - 1] + gapHeight[rank - 1]);
  }
  model.rowTop = rowTop;
  model.top = new Float64Array(model.rank.length);
  for (let item = 0; item < model.rank.length; item += 1) {
    const rank = model.rank[item];
    const height = item < count ? model.nodeHeight[item] : model.height[item];
    model.top[item] = round(rowTop[rank] + (rowHeight[rank] - height) / 2);
  }
}

// Ports, tracks and the lines' points, from the anchors. The first call sets how many tracks each gap needs; a call
// after boxes moved clear of fixed ones spreads the tracks over the gaps as they are.
function connect(model, first = false) {
  const { settings, count, anchor } = model;
  const segments = model.segmentFrom.length;
  // Where a segment leaves its upper item and enters its lower one.
  const exitX = new Float64Array(segments);
  const entryX = new Float64Array(segments);
  for (let segment = 0; segment < segments; segment += 1) {
    exitX[segment] = anchor[model.segmentFrom[segment]];
    entryX[segment] = anchor[model.segmentTo[segment]];
  }
  // A box spreads its ports evenly along its bottom and its top, in the order of the items they lead to.
  for (let node = 0; node < count; node += 1) {
    const boxLeft = round(anchor[node] - model.width[node] / 2);
    const spread = (list, end, into) => {
      if (list.length === 0) return;
      const sorted = list.slice().sort((a, b) => anchor[end[a]] - anchor[end[b]] || a - b);
      sorted.forEach((segment, index) => {
        into[segment] = round(boxLeft + (model.width[node] * (index + 1)) / (sorted.length + 1));
      });
    };
    spread(model.downSegments[node], model.segmentTo, exitX);
    spread(model.upSegments[node], model.segmentFrom, entryX);
  }
  model.exitX = exitX;
  model.entryX = entryX;
  // A segment whose two ends differ across turns on a track of its gap; a line that dips under its row turns on
  // one too.
  const turns = [];
  const segmentTurn = new Int32Array(segments).fill(-1);
  const lineTurn = new Int32Array(model.lines.length).fill(-1);
  model.lines.forEach((line, index) => {
    if (line.kind === 'self' || line.kind === 'flat') {
      const [a, b] = line.segments;
      lineTurn[index] = turns.length;
      turns.push({ gap: model.rank[line.from], x1: exitX[a], x2: exitX[b], dip: true, order: index });
      return;
    }
    for (const segment of line.segments) {
      if (exitX[segment] === entryX[segment]) continue;
      segmentTurn[segment] = turns.length;
      turns.push({ gap: model.rank[model.segmentFrom[segment]], x1: exitX[segment], x2: entryX[segment], dip: false, order: segment });
    }
  });
  const byGap = new Map();
  for (const turn of turns) {
    turn.low = Math.min(turn.x1, turn.x2);
    turn.high = Math.max(turn.x1, turn.x2);
    if (!byGap.has(turn.gap)) byGap.set(turn.gap, []);
    byGap.get(turn.gap).push(turn);
  }
  const ranks = model.columnOrder.length;
  const trackCount = new Int32Array(ranks);
  for (const [gap, list] of byGap) {
    // Dips first, short ones nearest their row; then lines going right, the later start higher, then lines going
    // left, the earlier start higher. Each takes the highest track it fits on.
    const group = (turn) => (turn.dip ? 0 : turn.x1 < turn.x2 ? 1 : 2);
    list.sort((a, b) => group(a) - group(b)
      || (a.dip ? (a.high - a.low) - (b.high - b.low) || a.low - b.low
        : a.x1 < a.x2 ? b.x1 - a.x1 || b.x2 - a.x2 : a.x1 - b.x1 || a.x2 - b.x2)
      || a.order - b.order);
    trackCount[gap] = list.length > TURNS_PACKED_BY_START
      ? packByStart(list, settings.edgeGap)
      : packInOrder(list, settings.edgeGap);
  }
  model.turns = turns;
  model.segmentTurn = segmentTurn;
  model.lineTurn = lineTurn;
  model.trackCount = trackCount;
  if (first) return;
  model.routes = model.lines.map((line, index) => route(model, line, index));
}

// Each turn takes the highest track where it keeps edgeGap from every turn already there. A turn that leaves its row
// at an x where another turn enters the next row goes above that turn, so that their upright parts never run on top
// of each other; an x is where at most one turn leaves and one enters, so these rules form chains, and the rare
// cycle drops the rule of its first turn. Returns the tracks used.
function packInOrder(list, edgeGap) {
  const leaving = new Map();
  for (const turn of list) {
    leaving.set(turn.x1, turn);
    if (turn.dip) leaving.set(turn.x2, turn);
  }
  const above = new Map();
  for (const turn of list) {
    if (turn.dip) continue;
    const other = leaving.get(turn.x2);
    if (other !== undefined && other !== turn) above.set(turn, other);
  }
  const tracks = [];
  const waiting = new Map();
  const place = (turn) => {
    const over = above.get(turn);
    let track = over === undefined ? 0 : over.track + 1;
    while (track < tracks.length
      && tracks[track].some((other) => !(other.high + edgeGap <= turn.low || turn.high + edgeGap <= other.low))) {
      track += 1;
    }
    while (tracks.length <= track) tracks.push([]);
    tracks[track].push(turn);
    turn.track = track;
    const next = waiting.get(turn);
    if (next !== undefined) {
      waiting.delete(turn);
      for (const after of next) {
        if (after.track === undefined) place(after);
      }
    }
  };
  for (const turn of list) {
    const over = above.get(turn);
    if (over !== undefined && over.track === undefined) {
      if (!waiting.has(over)) waiting.set(over, []);
      waiting.get(over).push(turn);
      continue;
    }
    place(turn);
  }
  for (const turn of list) {
    if (turn.track !== undefined) continue;
    above.delete(turn);
    place(turn);
  }
  return tracks.length;
}

// Interval partitioning: the turns in order of where they start, each on the free track that ended first, kept in a
// binary heap of [end, track]. Returns the tracks used.
function packByStart(list, edgeGap) {
  const sorted = list.slice().sort((a, b) => a.low - b.low || a.high - b.high || a.order - b.order);
  const heap = [];
  const before = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
  const push = (entry) => {
    heap.push(entry);
    for (let at = heap.length - 1; at > 0;) {
      const parent = (at - 1) >> 1;
      if (!before(heap[at], heap[parent])) break;
      [heap[at], heap[parent]] = [heap[parent], heap[at]];
      at = parent;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0) {
      heap[0] = last;
      for (let at = 0; ;) {
        const left = 2 * at + 1;
        const right = left + 1;
        let least = at;
        if (left < heap.length && before(heap[left], heap[least])) least = left;
        if (right < heap.length && before(heap[right], heap[least])) least = right;
        if (least === at) break;
        [heap[at], heap[least]] = [heap[least], heap[at]];
        at = least;
      }
    }
    return top;
  };
  let tracks = 0;
  for (const turn of sorted) {
    if (heap.length > 0 && heap[0][0] + edgeGap <= turn.low) {
      turn.track = pop()[1];
    } else {
      turn.track = tracks;
      tracks += 1;
    }
    push([turn.high, turn.track]);
  }
  return tracks;
}

function trackY(model, turn) {
  const gapTop = model.rowTop[turn.gap] + model.rowHeight[turn.gap];
  const tracks = model.trackCount[turn.gap];
  return round(gapTop + (model.gapHeight[turn.gap] * (turn.track + 1)) / (tracks + 1));
}

function route(model, line, index) {
  const { count } = model;
  // A line's end on a box's side rounds away from the box, so that it never starts inside the box.
  const bottomOf = (node) => roundUp(model.top[node] + model.nodeHeight[node]);
  let points;
  if (line.kind === 'self' || line.kind === 'flat') {
    const turn = model.turns[model.lineTurn[index]];
    const y = trackY(model, turn);
    points = [
      { x: turn.x1, y: bottomOf(line.from) },
      { x: turn.x1, y },
      { x: turn.x2, y },
      { x: turn.x2, y: bottomOf(line.to) },
    ];
  } else {
    const first = line.segments[0];
    const last = line.segments[line.segments.length - 1];
    const upper = model.segmentFrom[first];
    const lower = model.segmentTo[last];
    points = [{ x: model.exitX[first], y: bottomOf(upper) }];
    for (const segment of line.segments) {
      const at = model.segmentTurn[segment];
      if (at < 0) continue;
      const turn = model.turns[at];
      const y = trackY(model, turn);
      points.push({ x: turn.x1, y }, { x: turn.x2, y });
    }
    points.push({ x: model.entryX[last], y: model.top[lower] });
    if (line.kind === 'up') points.reverse();
  }
  // A fixed box: a line to itself moves with it; a line between two fixed boxes runs straight from one to the other,
  // since the layout's tracks belong to neither; any other line runs straight from its edge to the line's next point.
  const fromFixed = line.from < count ? model.fixed[line.from] : null;
  const toFixed = line.to < count ? model.fixed[line.to] : null;
  if (line.kind === 'self' && fromFixed !== null) {
    const { dx, dy } = shiftOf(model, line.from);
    const bottom = roundUp(fromFixed.y + model.nodeHeight[line.from]);
    points = points.map((point, at) => ({ x: point.x + dx, y: at === 0 || at === points.length - 1 ? bottom : point.y + dy }));
  } else if (fromFixed !== null && toFixed !== null) {
    points = straightBetween(model, line);
  } else if (fromFixed !== null) {
    // The line leaves the fixed box straight towards the first point after the last part of the layout's route that
    // runs through the box, so that it never runs back through the box.
    const box = fixedBox(model, line.from);
    let next = 1;
    for (let at = 0; at + 1 < points.length; at += 1) {
      if (runsThrough(box, points[at], points[at + 1])) next = at + 1;
    }
    points = [clip(box, points[next]), ...points.slice(next)];
  } else if (toFixed !== null) {
    // The line follows the layout's route up to the first part that runs through the fixed box, then goes straight.
    const box = fixedBox(model, line.to);
    let last = points.length - 2;
    for (let at = points.length - 2; at >= 0; at -= 1) {
      if (runsThrough(box, points[at], points[at + 1])) last = at;
    }
    points = [...points.slice(0, last + 1), clip(box, points[last])];
  }
  const rounded = points.map((point) => ({ x: round(point.x), y: round(point.y) }));
  const kept = simplify(rounded);
  // Two fixed boxes on top of each other still give a line of two points, one on each.
  return kept.length >= 2 ? kept : [rounded[0], rounded[rounded.length - 1]];
}

function fixedBox(model, node) {
  const { x, y } = model.fixed[node];
  return { x, y, width: model.width[node], height: model.nodeHeight[node] };
}

// How far a fixed box is from its place in the layout. A line from it to itself, and that line's label, move as far.
function shiftOf(model, node) {
  return {
    dx: model.fixed[node].x - round(model.anchor[node] - model.width[node] / 2),
    dy: model.fixed[node].y - model.top[node],
  };
}

// A line both of whose ends are fixed boxes, the same one or two, is drawn with them, not where the layout put it.
const movesWithFixed = (model, line) => model.fixed[line.from] !== null && model.fixed[line.to] !== null;

// The straight line between two fixed boxes, from the edge of one to the edge of the other.
function straightBetween(model, line) {
  const a = fixedBox(model, line.from);
  const b = fixedBox(model, line.to);
  return [clip(a, middleOf(b)), clip(b, middleOf(a))];
}

// A line's label box, top to bottom. The label of a line from a fixed box to itself moves with the box; the label of
// a line between two fixed boxes sits beside the middle of the straight line, as far from it as the line leans, so
// that the line never runs through it.
function labelBox(model, line) {
  const item = line.labelItem;
  const { width, height } = model.label[item];
  let x = model.anchor[item] + model.labelOffset;
  let y = model.top[item];
  if (line.kind === 'self' && model.fixed[line.from] !== null) {
    const { dx, dy } = shiftOf(model, line.from);
    x += dx;
    y += dy;
  } else if (movesWithFixed(model, line)) {
    const [start, end] = straightBetween(model, line);
    const across = Math.abs(end.x - start.x);
    const down = Math.abs(end.y - start.y);
    const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    if (down >= across) {
      x = middle.x + model.labelOffset + (down === 0 ? 0 : (height / 2) * (across / down));
      y = middle.y - height / 2;
    } else {
      x = middle.x - width / 2;
      y = middle.y + model.labelOffset + (width / 2) * (down / across);
    }
  }
  return { x: round(x), y: round(y), width, height };
}

const middleOf = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

// Whether a part of the layout's route, across or down, runs through the inside of a box.
function runsThrough(box, from, to) {
  if (from.x === to.x) {
    return from.x > box.x && from.x < box.x + box.width
      && Math.max(from.y, to.y) > box.y && Math.min(from.y, to.y) < box.y + box.height;
  }
  return from.y > box.y && from.y < box.y + box.height
    && Math.max(from.x, to.x) > box.x && Math.min(from.x, to.x) < box.x + box.width;
}

// Where the line from the middle of a box towards a point leaves the box; straight down from a point at the middle.
// The side it leaves by rounds away from the box.
function clip(box, point) {
  const middle = middleOf(box);
  const dx = point.x - middle.x;
  const dy = point.x === middle.x && point.y === middle.y ? 1 : point.y - middle.y;
  const w = box.width / 2;
  const h = box.height / 2;
  if (Math.abs(dy) * w > Math.abs(dx) * h) {
    const sy = dy < 0 ? -h : h;
    return { x: round(middle.x + (sy * dx) / dy), y: dy < 0 ? roundDown(box.y) : roundUp(box.y + box.height) };
  }
  const sx = dx < 0 ? -w : w;
  return { x: dx < 0 ? roundDown(box.x) : roundUp(box.x + box.width), y: round(middle.y + (sx * dy) / dx) };
}

// Drops repeated points and the middle of three in a straight run.
function simplify(points) {
  const kept = [];
  for (const point of points) {
    const last = kept[kept.length - 1];
    if (last !== undefined && last.x === point.x && last.y === point.y) continue;
    if (kept.length >= 2) {
      const before = kept[kept.length - 2];
      const vertical = before.x === last.x && last.x === point.x && Math.sign(last.y - before.y) === Math.sign(point.y - last.y);
      const level = before.y === last.y && last.y === point.y && Math.sign(last.x - before.x) === Math.sign(point.x - last.x);
      if (vertical || level) kept.pop();
    }
    kept.push(point);
  }
  return kept;
}

// Fixed boxes.

// Moves the items of each row right, in order, until none comes within its gap of a fixed box, or of a label drawn
// with fixed boxes; the rows' heights and the gaps stay as they are. An item keeps clear of every such box that
// reaches into its row, over the row's whole height. The boxes are sorted once by where their gap starts on the left:
// the items' right sides only grow along a row, so one pointer passes the boxes that start before an item ends, and
// the item moves past the furthest right of those that reach into the row. A row takes steps in proportion to its
// items and the boxes the pointer passes, at most all of them.
function keepClearOfFixed(model) {
  const { count, anchor, settings } = model;
  // Each box keeps the gap of what it is: half the node gap for a fixed box, half the line gap for a label.
  const boxes = [];
  for (let node = 0; node < count; node += 1) {
    if (model.fixed[node] !== null) boxes.push({ ...fixedBox(model, node), half: settings.nodeGap / 2 });
  }
  // The points of a line drawn with its fixed boxes keep their places, since the line is drawn elsewhere; its label
  // is drawn with it, and the other items keep clear of it there.
  const drawnElsewhere = new Set();
  for (const line of model.lines) {
    if (!movesWithFixed(model, line)) continue;
    for (const segment of line.segments) {
      if (model.segmentTo[segment] >= count) drawnElsewhere.add(model.segmentTo[segment]);
    }
    if (line.labelItem >= 0) boxes.push({ ...labelBox(model, line), half: settings.edgeGap / 2 });
  }
  boxes.sort((a, b) => a.x - a.half - (b.x - b.half));
  // Arrays of numbers, since a picture with many fixed boxes reads them for every row.
  const total = boxes.length;
  const start = new Float64Array(total);
  const end = new Float64Array(total);
  const top = new Float64Array(total);
  const bottom = new Float64Array(total);
  boxes.forEach((box, index) => {
    start[index] = box.x - box.half;
    end[index] = box.x + box.width + box.half;
    top[index] = box.y;
    bottom[index] = box.y + box.height;
  });
  model.columnOrder.forEach((row, rank) => {
    const bandTop = model.rowTop[rank];
    const bandBottom = bandTop + model.rowHeight[rank];
    // A row of points only, with no height, takes the boxes that touch its line.
    const flat = model.rowHeight[rank] === 0;
    let previous = -1;
    let next = 0;
    let furthest = -Infinity;
    for (const item of row) {
      if ((item < count && model.fixed[item] !== null) || drawnElsewhere.has(item)) continue;
      if (previous >= 0) {
        const least = anchor[previous] + model.right[previous] + model.left[item] + model.half(previous) + model.half(item);
        if (anchor[item] < least) anchor[item] = least;
      }
      const half = model.half(item);
      // Each round passes at least one more box, so the loop ends; a move past every box passed is clear of them by
      // construction, which no float sum is asked to confirm.
      for (;;) {
        if (furthest + half > anchor[item] - model.left[item]) anchor[item] = furthest + half + model.left[item];
        const reach = anchor[item] + model.right[item] + half;
        if (next >= total || start[next] >= reach) break;
        for (; next < total && start[next] < reach; next += 1) {
          const inRow = flat
            ? top[next] <= bandTop && bottom[next] >= bandTop
            : top[next] < bandBottom && bottom[next] > bandTop;
          if (inRow && end[next] > furthest) furthest = end[next];
        }
      }
      anchor[item] = roundUp(anchor[item]);
      previous = item;
    }
  });
}

// Output.

function output(model, input, across) {
  const { count } = model;
  if (model.routes === undefined) model.routes = model.lines.map((line, index) => route(model, line, index));
  const flip = across ? (point) => ({ x: point.y, y: point.x }) : (point) => point;
  const nodes = input.nodes.map((node, index) => {
    const fixed = model.fixed[index] !== null;
    const corner = fixed
      ? model.fixed[index]
      : { x: round(model.anchor[index] - model.width[index] / 2), y: model.top[index] };
    const { x, y } = flip(corner);
    return { id: node.id, x, y, width: node.width, height: node.height, layer: model.layers[index], fixed };
  });
  const edges = input.edges.map((edge, index) => {
    const line = model.lines[index];
    let label = null;
    if (line.labelItem >= 0) {
      const { x, y } = flip(labelBox(model, line));
      label = { x, y, width: edge.label.width, height: edge.label.height };
    }
    return {
      from: input.nodes[edge.from].id,
      to: input.nodes[edge.to].id,
      points: model.routes[index].map(flip),
      label,
    };
  });
  let low = { x: Infinity, y: Infinity };
  let high = { x: -Infinity, y: -Infinity };
  const take = (x, y, width = 0, height = 0) => {
    low = { x: Math.min(low.x, x), y: Math.min(low.y, y) };
    high = { x: Math.max(high.x, x + width), y: Math.max(high.y, y + height) };
  };
  for (const node of nodes) take(node.x, node.y, node.width, node.height);
  for (const edge of edges) {
    for (const point of edge.points) take(point.x, point.y);
    if (edge.label !== null) take(edge.label.x, edge.label.y, edge.label.width, edge.label.height);
  }
  // The bounds round outwards, so that they hold boxes whose size or fixed position has more decimal places.
  const left = roundDown(low.x);
  const top = roundDown(low.y);
  const bounds = count === 0
    ? { x: 0, y: 0, width: 0, height: 0 }
    : { x: left, y: top, width: round(roundUp(high.x) - left), height: round(roundUp(high.y) - top) };
  return { bounds, nodes, edges };
}

// Two decimal places, so that the same picture gives the same numbers to keep and compare; never -0.
function round(value) {
  return Math.round(value * 100) / 100 + 0;
}

// Two decimal places, never above or never below the value: at most 0.01 from it. A value within float error of a
// hundredth, such as 4.23 + 50 = 54.230000000000004, is that hundredth.
function roundDown(value) {
  const near = round(value);
  return near <= value + floatError(value) ? near : round(near - 0.01);
}

function roundUp(value) {
  const near = round(value);
  return near >= value - floatError(value) ? near : round(near + 0.01);
}

// A few units in the last place of the value: the error of adding two numbers that were each written with two
// decimal places.
const floatError = (value) => 4 * Number.EPSILON * Math.max(1, Math.abs(value));
