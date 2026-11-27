// The pictures of the stage workbench (SCR-145, TASK-458; SPEC-003 to SPEC-010): each kind of diagram drawn from
// API-265's elements, by name and never by trace ID (SPEC-010).
//
// - The DDD board, the ERD, the sitemap and the user flows are SVG: each box at the place relayout.js gives it, an
//   HTML button inside a foreignObject so that its text wraps and it is chosen by pointer or keyboard; each line a path
//   with its head, and an invisible wider path over it that is chosen too. Colours come from nexus.css classes, never
//   from a style.
// - Screen states are the mockup's grid of panels, and an item table the mockup's table, both HTML.
// - A mockup is its frame (mockup-frame.js).
// What lies over the picture, proposals, waiting change sets and the marks since the confirmation, comes from
// overlays.js.
//
// view is what the workbench gives: { diagram, place (relayout.js placement), model (overlays.js overlayModel),
// selected (an element key or null), select(key), keydown(element, event), pointerdown(element, event), names (a Map
// of element key to the name it is shown by), nodes (a Map that each chosen thing's node goes into, by key) }.

import { h, s } from './dom.js';
import { aiBadge, ghostCap, KIND_WORDS, markChips, nameWith, overClasses } from './overlays.js';
import { endsOf, straight } from './relayout.js';

// Room round each box for its ring, so that the foreignObject does not cut it.
export const PAD = 6;
const MARGIN = 16;
const GHOST = Object.freeze({ board: { width: 148, height: 80 }, other: { width: 168, height: 64 }, gap: 24, below: 48 });
const HEAD = Object.freeze({ length: 9, half: 5 });

// Words no approved document gives, listed as new in the pull request (TASK-458's questions 5 and 6).
export const WORDS = Object.freeze({
  removed: '지움',
  unreadable: '읽을 수 없음',
  missing: '없는 테이블',
  parentMissing: '부모 없음',
  answered: '답함',
  leftOut: '그리지 못한 부분',
  noDescription: '설명 없음',
  noDescriptionNote: '이 상태의 설명이 문서에 없어요.',
  noItems: '이 단계에는 아직 항목이 없어요',
});
// The words of a kind in the Selected panel's tag (question 6).
export const TAG_WORDS = Object.freeze({
  ...KIND_WORDS,
  lane: '레인',
  hotspot_lane: '핫스팟',
  dependency: '의존',
  terminal: '시작·끝',
  step: '단계',
  decision: '결정',
  document: '문서',
  store: '저장소',
  llm: 'LLM',
  grading: '채점',
  arrow: '화살표',
  table: '테이블',
  line: '선',
  screen: '화면',
  state: '상태',
  token: '토큰',
  row: '항목',
  statement: '문장',
  source: '소스',
});

// The words of a line in the Selected panel's tag, by the kind of its diagram (question 6): an ERD's line is a foreign
// key, a sitemap's joins two screens.
export const LINE_WORDS = Object.freeze({ erd: '외래 키', sitemap: '화면 사이 선' });

// The word of an element's kind in the Selected panel's tag.
export function tagWord(diagram, element) {
  if (element.kind === 'line' && LINE_WORDS[diagram.kind] !== undefined) return LINE_WORDS[diagram.kind];
  return TAG_WORDS[element.kind] ?? element.kind;
}

// The kinds a DDD board draws as stickies, in the mockup's colours.
export const STICKIES = new Set(['event', 'command', 'aggregate', 'policy', 'read_model', 'hotspot', 'external']);
const FRAMES = new Set(['context']);
const LANES = new Set(['lane', 'hotspot_lane']);
const FLOW_BOXES = new Set(['terminal', 'step', 'decision', 'document', 'store', 'llm', 'grading']);

// The text an element is shown by: its name, or its trace ID or key when it has none (SPEC-010).
export function shownName(element) {
  return element.name !== '' ? element.name : element.trace_id ?? element.key;
}

// The picture of view.diagram, as nodes for the board column.
export function pictureOf(view) {
  const { diagram } = view;
  switch (diagram.kind) {
    case 'screen_states':
      return [statePanels(view), leftOutList(diagram)];
    case 'item_table':
      return [itemTable(view), leftOutList(diagram)];
    case 'ddd_board':
    case 'erd':
    case 'sitemap':
    case 'user_flow':
      return [svgPicture(view), leftOutList(diagram)];
    default:
      return [];
  }
}

// What the drawing leaves out (SPEC-003): each with what the hub says of it and its file and line.
function leftOutList(diagram) {
  const left = (diagram.elements ?? []).filter((element) => element.status === 'left_out');
  if (left.length === 0) return null;
  return h('section', { class: 'leftout' },
    h('h3', {}, WORDS.leftOut),
    h('ul', {}, left.map((element) => h('li', {},
      h('span', {}, shownName(element)),
      element.detail?.where ? h('span', { class: 'small mono' }, element.detail.where) : null))));
}

// The SVG of a board, an ERD, a sitemap or a user flow, in its scrolling box, with the boxes change sets add in a row
// under it.
function svgPicture(view) {
  const { diagram, place, model } = view;
  const board = diagram.kind === 'ddd_board';
  const ghostSize = board ? GHOST.board : GHOST.other;
  const ghostBoxes = new Map();
  model.ghosts.forEach((ghost, index) => ghostBoxes.set(ghost.key, {
    x: place.bounds.x + index * (ghostSize.width + GHOST.gap),
    y: place.bounds.y + place.bounds.height + GHOST.below,
    ...ghostSize,
  }));
  const bounds = grow(place.bounds, [...ghostBoxes.values()]);
  const x = bounds.x - MARGIN;
  const y = bounds.y - MARGIN;
  const width = Math.max(1, bounds.width + 2 * MARGIN);
  const height = Math.max(1, bounds.height + 2 * MARGIN);
  // A moved box is painted after the others, so that where it lies over one it shows whole (relayout.js's 'over').
  const layers = { back: [], lines: [], boxes: [], moved: [], over: [] };
  for (const element of diagram.elements ?? []) {
    if (LANES.has(element.kind)) laneOf(view, element, layers);
    else if (FRAMES.has(element.kind)) frameOf(view, element, layers);
    else if (STICKIES.has(element.kind)) boxOf(view, element, layers, stickyContent(view, element), `stk k-${element.kind}${element.status === 'answered' ? ' answered' : ''}`);
    else if (element.kind === 'table') boxOf(view, element, layers, tableContent(view, element), 'pbox tbl');
    else if (element.kind === 'screen') boxOf(view, element, layers, screenContent(view, element), 'pbox scr');
    else if (FLOW_BOXES.has(element.kind)) flowBoxOf(view, element, layers);
    else if (endsOf(element) !== null) lineOf(view, element, layers);
  }
  for (const ghost of model.ghosts) layers.over.push(ghostOf(ghost, ghostBoxes.get(ghost.key), board));
  for (const link of model.links) {
    const from = place.boxes.get(link.from) ?? ghostBoxes.get(link.from);
    const to = place.boxes.get(link.to) ?? ghostBoxes.get(link.to);
    if (from === undefined || to === undefined) continue;
    const points = straight(from, to);
    layers.over.push(s('path', { class: link.waiting ? 'ov-link wait' : 'ov-link', d: pathOf(points) }), s('path', { class: 'ov-head', d: headOf(points) }));
  }
  const svg = s('svg', {
    class: `pic k-${diagram.kind}`, width: width * (view.zoom ?? 1), height: height * (view.zoom ?? 1), viewBox: `${x} ${y} ${width} ${height}`,
  }, layers.back, layers.lines, layers.boxes, layers.moved, layers.over);
  // The workbench keeps the box's scroll across redraws and opens a picture at its first box (workbench.js).
  view.box = h('div', { class: 'boardbox' }, h('div', { class: 'pic-wrap', role: 'group', 'aria-label': labelOf(diagram, place) }, svg));
  view.origin = { x, y };
  view.svg = svg;
  view.size = { width, height };
  return view.box;
}

// What a screen reader is told the picture is: the mockup's words for the board and a flow.
function labelOf(diagram, place) {
  if (diagram.kind === 'ddd_board') return '도메인 보드 그림. 왼쪽에서 오른쪽으로 시간이 흘러요.';
  if (diagram.kind === 'user_flow') return `${diagram.name} 흐름 그림. ${across(diagram, place) ? '왼쪽에서 오른쪽으로' : '위에서 아래로'} 읽어요.`;
  return `${diagram.name} 그림.`;
}

// Whether a flow runs left to right: its arrows end on a box's side more often than on its top.
function across(diagram, place) {
  let sideways = 0;
  let down = 0;
  for (const element of diagram.elements ?? []) {
    const points = element.kind === 'arrow' ? place.lines.get(element.key) : null;
    if (!points || points.length < 2) continue;
    const [a, b] = points.slice(-2);
    if (a.y === b.y) sideways += 1;
    else if (a.x === b.x) down += 1;
  }
  return sideways > down;
}

// A box that holds the given ones too.
function grow(bounds, boxes) {
  if (boxes.length === 0) return bounds;
  const left = Math.min(bounds.x, ...boxes.map((box) => box.x));
  const top = Math.min(bounds.y, ...boxes.map((box) => box.y));
  const right = Math.max(bounds.x + bounds.width, ...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(bounds.y + bounds.height, ...boxes.map((box) => box.y + box.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

// A button inside a foreignObject over a box, with room for its ring.
function boxed(box, child) {
  return s('foreignObject', { x: box.x - PAD, y: box.y - PAD, width: box.width + 2 * PAD, height: box.height + 2 * PAD }, h('div', { class: 'fo' }, child));
}

// The button that chooses element: pressed while it is the chosen one, with the classes of what lies over it.
export function chooser(view, element, className, content, extra = {}) {
  const over = view.model.marks.get(element.key);
  const on = view.selected === element.key;
  const button = h('button', {
    type: 'button',
    class: [className, on ? 'sel' : null, ...overClasses(over)].filter(Boolean).join(' '),
    'aria-pressed': on ? 'true' : 'false',
    ...extra,
    on: {
      click: () => view.select(element.key),
      keydown: (event) => view.keydown(element, event),
      pointerdown: (event) => view.pointerdown(element, event),
      // A double click renames (TASK-460).
      dblclick: () => view.dblclick?.(element),
    },
  }, content);
  view.nodes.set(element.key, button);
  return button;
}

// The marks of an element's state that are not overlays: removed, unreadable and the like, as tags in its cap.
function stateChips(element) {
  const word = {
    removed: WORDS.removed,
    unreadable: WORDS.unreadable,
    missing: WORDS.missing,
    parent_missing: WORDS.parentMissing,
  }[element.status ?? ''];
  return word === undefined ? null : h('span', { class: `mk st ${element.status}` }, word);
}

// The file and line of an element drawn as unreadable, under its name.
function whereLine(element) {
  return element.status === 'unreadable' && element.detail?.where ? h('span', { class: 'sub mono' }, element.detail.where) : null;
}

function boxOf(view, element, layers, content, className) {
  const box = view.place.boxes.get(element.key);
  if (box === undefined) return;
  boxLayer(view, element, layers).push(boxed(box, chooser(view, element, className, content)));
}

// The layer a box is painted in: the moved boxes' own, over the others, or the boxes'.
function boxLayer(view, element, layers) {
  return view.place.moved?.has(element.key) ? layers.moved : layers.boxes;
}

// A DDD board's sticky: its kind as the mockup's cap (a command's actor after it), the marks, and its name.
function stickyContent(view, element) {
  const over = view.model.marks.get(element.key);
  let cap = KIND_WORDS[element.kind];
  if (element.kind === 'command' && element.detail?.actor) cap = `${cap} · ${element.detail.actor}`;
  if (element.kind === 'hotspot' && element.status === 'answered') cap = `${cap} · ${WORDS.answered}`;
  return [
    h('span', { class: 'cap' }, h('span', { class: 'cw' }, cap), aiBadge(over), stateChips(element), markChips(over)),
    nameWith(shownName(element), over),
    whereLine(element),
  ];
}

// A lane of the timeline, or the Hotspots lane: its band, and its name at its start, which is chosen.
function laneOf(view, element, layers) {
  const box = view.place.boxes.get(element.key);
  if (box === undefined) return;
  layers.back.push(s('rect', { class: 'pic-lane', x: box.x, y: box.y, width: box.width, height: box.height, rx: 8 }));
  const name = element.kind === 'hotspot_lane' ? KIND_WORDS.hotspot : shownName(element);
  // The label sits in the lane's left gutter, centred on its height as the mockup's row labels are.
  const label = { x: box.x + 8, y: box.y + Math.max(8, (box.height - 32) / 2), width: Math.min(232, Math.max(88, box.width - 16)), height: 32 };
  const over = view.model.marks.get(element.key);
  layers.boxes.push(boxed(label, chooser(view, element, 'plabel', [h('span', { class: 'nm' }, name), stateChips(element), markChips(over)])));
}

// A context's frame, headed by "경계 컨텍스트 · name" as the mockup heads it; the head is chosen.
function frameOf(view, element, layers) {
  const box = view.place.boxes.get(element.key);
  if (box === undefined) return;
  const over = view.model.marks.get(element.key);
  layers.back.push(s('rect', { class: `pic-frame${element.status === 'removed' ? ' removed' : ''}`, x: box.x, y: box.y, width: box.width, height: box.height, rx: 8 }));
  const head = { x: box.x + 8, y: box.y + 4, width: Math.max(1, box.width - 16), height: 28 };
  const name = over?.rename ? over.rename.name : shownName(element);
  layers.boxes.push(boxed(head, chooser(view, element, 'ctx-head', [
    h('span', { class: 'nm' }, `${KIND_WORDS.context} · ${name}`), aiBadge(over), stateChips(element), markChips(over),
  ])));
}

// An ERD table: its name as the header and a row for each column, with its type and its keys.
function tableContent(view, element) {
  const over = view.model.marks.get(element.key);
  const columns = Array.isArray(element.detail?.columns) ? element.detail.columns : [];
  const keyWord = { primary: 'PK', foreign: 'FK', unique: 'UQ' };
  return [
    h('span', { class: 'th' }, nameWith(shownName(element), over), aiBadge(over), stateChips(element), markChips(over)),
    columns.map((column) => h('span', { class: 'col' },
      h('span', { class: 'cn' }, column.name),
      h('span', { class: 'ct' }, column.type ?? ''),
      h('span', { class: 'ck' }, (column.keys ?? []).map((key) => keyWord[key]).filter(Boolean).join(' ')))),
    whereLine(element),
  ];
}

// A sitemap screen: its name and its path; the trace ID stays out (SPEC-010).
function screenContent(view, element) {
  const over = view.model.marks.get(element.key);
  return [
    h('span', { class: 'cap' }, aiBadge(over), stateChips(element), markChips(over)),
    nameWith(shownName(element), over),
    element.detail?.path ? h('span', { class: 'sub mono' }, element.detail.path) : null,
    whereLine(element),
  ];
}

// A user flow's box: its shape drawn in SVG, and over it the button with its lines as the author broke them and the
// trace IDs it names apart, under them (SPEC-006, SPEC-010).
function flowBoxOf(view, element, layers) {
  const box = view.place.boxes.get(element.key);
  if (box === undefined) return;
  const marks = Array.isArray(element.detail?.marks) ? element.detail.marks : [];
  const shapeClass = ['fl-shape', `k-${element.kind}`, ...marks.map((mark) => `mark-${mark}`)].join(' ');
  const moved = view.place.moved?.has(element.key) === true;
  const shape = shapeOf(element.kind, box, shapeClass);
  // A drag moves the shape with the button (workbench.js).
  view.shapes?.set(element.key, shape);
  (moved ? layers.moved : layers.back).push(shape);
  const over = view.model.marks.get(element.key);
  const lines = Array.isArray(element.detail?.lines) && element.detail.lines.length > 0 ? element.detail.lines : [shownName(element)];
  const renamed = over?.rename && over.rename.name !== element.name;
  const ids = Array.isArray(element.detail?.ids) ? element.detail.ids : [];
  boxLayer(view, element, layers).push(boxed(box, chooser(view, element, `fbox k-${element.kind}`, [
    over?.proposed || over?.waiting || over?.since || element.status ? h('span', { class: 'cap' }, aiBadge(over), stateChips(element), markChips(over)) : null,
    renamed ? [h('b', { class: 'nm' }, over.rename.name), h('s', { class: 'was' }, element.name)] : lines.map((line) => h('b', { class: 'ln1' }, line)),
    ids.length > 0 ? h('span', { class: 'id' }, ids.join(', ')) : null,
  ])));
}

// The outline of a flow box's shape: a stadium, a rectangle, a diamond, a document with a wavy foot, a cylinder, or a
// rectangle with a double border for an LLM or a grading step.
function shapeOf(kind, box, className) {
  const { x, y, width: w, height: hh } = box;
  switch (kind) {
    case 'terminal':
      return s('rect', { class: className, x, y, width: w, height: hh, rx: hh / 2 });
    case 'decision':
      return s('polygon', { class: className, points: `${x + w / 2},${y} ${x + w},${y + hh / 2} ${x + w / 2},${y + hh} ${x},${y + hh / 2}` });
    case 'document': {
      const foot = y + hh - 8;
      return s('path', { class: className, d: `M${x} ${y} H${x + w} V${foot} C${x + w * 0.75} ${foot - 8} ${x + w * 0.25} ${foot + 16} ${x} ${foot} Z` });
    }
    case 'store':
      return s('path', {
        class: className,
        d: `M${x} ${y + 8} A${w / 2} 8 0 0 1 ${x + w} ${y + 8} V${y + hh - 8} A${w / 2} 8 0 0 1 ${x} ${y + hh - 8} Z M${x} ${y + 8} A${w / 2} 8 0 0 0 ${x + w} ${y + 8}`,
      });
    case 'llm':
    case 'grading':
      return s('g', {}, s('rect', { class: className, x, y, width: w, height: hh, rx: 4 }), s('rect', { class: `${className} inner`, x: x + 8, y: y + 4, width: Math.max(1, w - 16), height: Math.max(1, hh - 8), rx: 2 }));
    default:
      return s('rect', { class: className, x, y, width: w, height: hh, rx: 4 });
  }
}

// A line between two boxes: its path and head, its label for a flow's arrow, and a wider invisible path that chooses it.
function lineOf(view, element, layers) {
  let points = view.place.lines.get(element.key);
  if (!points || points.length < 2) return;
  const { from, to } = endsOf(element);
  points = onOutline(points, view.diagram, view.place, from, to);
  const over = view.model.marks.get(element.key);
  const on = view.selected === element.key;
  const kind = element.kind === 'arrow' ? ` l-${element.detail?.line ?? 'pass'}` : '';
  const d = pathOf(points);
  layers.lines.push(s('path', { class: `pic-ln${kind}${on ? ' sel' : ''}${over?.waiting ? ' waiting' : ''}${over?.proposed ? ' ov-prop' : ''}`, d }));
  layers.lines.push(s('path', { class: `pic-hd${on ? ' sel' : ''}`, d: headOf(points) }));
  const label = view.place.labels.get(element.key);
  const text = over?.rename ? over.rename.name : element.name;
  if (label && text !== '') {
    layers.lines.push(s('foreignObject', { x: label.x, y: label.y, width: Math.max(1, label.width), height: Math.max(1, label.height) },
      h('div', { class: 'flab' }, text)));
  }
  const names = view.names;
  const hit = s('path', {
    class: 'pic-hit',
    d,
    tabindex: 0,
    role: 'button',
    'aria-pressed': on ? 'true' : 'false',
    'aria-label': text !== '' ? text : `${names.get(from) ?? from} → ${names.get(to) ?? to}`,
    on: {
      click: () => view.select(element.key),
      dblclick: () => view.dblclick?.(element),
      keydown: (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          view.select(element.key);
        } else {
          // F2 and Escape, which the workbench's changes take (TASK-460); a line takes no arrow.
          view.keydown?.(element, event);
        }
      },
    },
  });
  view.nodes.set(element.key, hit);
  layers.lines.push(hit);
}

// A flow's line moved onto the outline of a decision's diamond at either end, as the layout leaves that to the page.
function onOutline(points, diagram, place, from, to) {
  if (diagram.kind !== 'user_flow') return points;
  const kindOf = (key) => (diagram.elements ?? []).find((element) => element.key === key)?.kind;
  const moved = points.map((point) => ({ ...point }));
  if (kindOf(from) === 'decision') moved[0] = diamondPoint(moved[0], moved[1], place.boxes.get(from));
  if (kindOf(to) === 'decision') moved[moved.length - 1] = diamondPoint(moved.at(-1), moved.at(-2), place.boxes.get(to));
  return moved;
}

// Where a line that runs straight across or down to point meets the diamond inside box, from the side of neighbour.
function diamondPoint(point, neighbour, box) {
  if (box === undefined) return point;
  const a = box.width / 2;
  const b = box.height / 2;
  const cx = box.x + a;
  const cy = box.y + b;
  if (point.x === neighbour.x && Math.abs(point.x - cx) <= a) {
    const reach = b * (1 - Math.abs(point.x - cx) / a);
    return { x: point.x, y: neighbour.y < point.y ? cy - reach : cy + reach };
  }
  if (point.y === neighbour.y && Math.abs(point.y - cy) <= b) {
    const reach = a * (1 - Math.abs(point.y - cy) / b);
    return { x: neighbour.x < point.x ? cx - reach : cx + reach, y: point.y };
  }
  return point;
}

// A box a change set adds: dashed while proposed, ringed while it waits, with its cap and its name or key.
function ghostOf(ghost, box, board) {
  return boxed(box, h('div', { class: `${board ? 'stk' : 'pbox'} ghost${ghost.waiting ? ' waiting' : ''}`, role: 'note' },
    h('span', { class: 'cap' }, board && ghost.kind !== null ? h('span', { class: `sw k-${ghost.kind}`, 'aria-hidden': 'true' }) : null, ghostCap(ghost),
      ghost.waiting ? markChips({ since: null, waiting: true }) : null),
    h('b', { class: 'nm' }, ghost.name !== '' ? ghost.name : ghost.key)));
}

export const pathOf = (points) => points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ');

// The head of a line at its last point, a triangle along its last part.
export function headOf(points) {
  const end = points.at(-1);
  const before = points.at(-2);
  const dx = end.x - before.x;
  const dy = end.y - before.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const bx = end.x - ux * HEAD.length;
  const by = end.y - uy * HEAD.length;
  const round = (value) => Math.round(value * 100) / 100;
  return `M${end.x} ${end.y} L${round(bx - uy * HEAD.half)} ${round(by + ux * HEAD.half)} L${round(bx + uy * HEAD.half)} ${round(by - ux * HEAD.half)} Z`;
}

// Stage 08: a panel for each state of the screen, in the table's order, as the mockup's grid (SPEC-008). A state with
// no description is an empty panel with a dashed border, "설명 없음" and the note that the document has none.
function statePanels(view) {
  const states = (view.diagram.elements ?? []).filter((element) => element.kind === 'state');
  return h('div', { class: 'sgrid', role: 'group', 'aria-label': `${view.diagram.name} 그림.` }, states.map((element) => {
    const none = element.status === 'no_description';
    const over = view.model.marks.get(element.key);
    const responses = Array.isArray(element.detail?.responses) && element.detail.responses.length > 0 ? element.detail.responses.join(', ') : '-';
    return chooser(view, element, `spanel${none ? ' none' : ''}`, [
      h('span', { class: 'ph' }, h('b', { class: 'mono' }, shownName(element)),
        none ? h('span', { class: 'tag red' }, WORDS.noDescription) : null, aiBadge(over), markChips(over)),
      none ? null : h('span', { class: 'sketch', 'aria-hidden': 'true' }, h('span', { class: 's1' }), h('span', { class: 's2' }), h('span', { class: 's3' })),
      none ? h('span', { class: 'd sec' }, WORDS.noDescriptionNote) : h('span', { class: 'd' }, element.detail?.description ?? ''),
      h('span', { class: 'd small mono' }, responses),
    ]);
  }));
}

// An item table (SPEC-005): a row for each item, by its name, its status and its links by name; removed rows last,
// as drawn. Each row's name is the button that chooses it; a row has no box, so it never moves.
function itemTable(view) {
  const rows = (view.diagram.elements ?? []).filter((element) => element.kind === 'row');
  if (rows.length === 0) return h('div', { class: 'empty' }, h('h2', {}, WORDS.noItems));
  return h('table', { class: 'tb items', 'aria-label': view.diagram.name },
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, '이름'), h('th', { scope: 'col' }, '상태'), h('th', { scope: 'col' }, '링크'))),
    h('tbody', {}, rows.map((element) => {
      const over = view.model.marks.get(element.key);
      const links = Array.isArray(element.detail?.links) ? element.detail.links : [];
      const off = element.status === 'removed' || element.status === 'unreadable';
      return h('tr', { class: off ? 'off' : null },
        h('td', {}, chooser(view, element, 'rowpick', [nameWith(shownName(element), over), aiBadge(over), markChips(over)])),
        h('td', {}, stateChips(element), element.detail?.status ? h('span', {}, element.detail.status) : null,
          element.status === 'unreadable' && element.detail?.where ? h('span', { class: 'small mono' }, ` ${element.detail.where}`) : null),
        h('td', {}, links.map((link) => (typeof link === 'object' && link !== null ? (link.name || link.id) : String(link))).join(', ')));
    })));
}
