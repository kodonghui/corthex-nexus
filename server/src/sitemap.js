// The sitemap drawer (TASK-425; SPEC-007): draws the stage-07 picture as a tree of its screens, the root at the top and
// each screen under its parent, with a line from parent to child, placed by the picture layout (layout.js, TASK-420).
// It is drawing.js's drawer of the sitemap kind and keeps to the drawer interface described there and in the server's
// README.
//
// The picture is the pinned hub's parsed picture of the project's sitemap, as the contract's Snapshot says of stage 07:
// the hub's sitemap.py reads the YAML, so NEXUS parses none. Its format 1 is
//   { format: 1, screens: [screen], without_screen: [TERM ID] }
//   screen: { id, name, path, access, flows: [FL ID], context, terms: [TERM ID], removed, where, parent }
// where where is the file and line of the screen, such as docs/07-sitemap/nexus.yaml:5, and parent the place in the
// list of the screen it stands under, from 0, left out for a root. The hub lists a screen after its parent. It sends a
// part of the YAML it cannot read not in the picture but as a picture-partial check, which drawing.js gives as
// warnings. The terms without a screen are not drawn, as the ERD leaves out the tables' without_table.
//
// It draws, in this order:
// - each screen of the picture, in its order: kind screen, its trace ID, its name, its parent the key of the screen it
//   stands under, and detail { path, access, flows, context, terms, removed, where, box }. Its status is
//   parent_missing when its parent is missing (see parentOf), and else removed when the hub marks it removed;
//   detail.removed says whether the hub marks it removed either way;
// - a screen entry it cannot read, one that is not in the form above, is left out and marked: kind screen, status
//   unreadable, its trace ID and name when it has them, and detail { where, box }; a screen still stands under it;
// - a line from each screen that has a parent to the screen: kind line, named by the screen's name, its parent the
//   parent screen, and detail { from, to, points }: from and to the keys of the two screens, and points the line from
//   the one to the other;
// - each part of the sitemap the hub left out, from the warnings: kind source, status left_out, named by what the hub
//   says of it, with detail { where }, its file and line. A YAML error leaves out a whole file, not a screen.
// A screen's box is from layout.js, { x, y, width, height } with its top left corner: a root, and a screen whose parent
// is missing, in the top layer, and each other screen in the layer under its parent's. A box holds two lines, the
// screen's name and its path, and is as wide as the longer one; the page shows the name and hides the trace ID
// (SPEC-010). A left-out part has no box.
//
// A picture that is not format 1 with a list of screens fails the drawing at its source (SourceFailure), and so does
// one with more elements than a drawing holds. A tree within that many elements stays within layout.js's limits,
// however deep or wide, and placed() fails any other at its source too. Nothing here logs (rule 5).

import {
  CHARACTER, characters, elementKey, isObject, isText, isTextList, keyer, leftOut, MAX_ELEMENTS, optional, PADDING, placed, SourceFailure,
  traceIdOf, whereText,
} from './drawer.js';

// A screen's box: two 20-pixel lines, its name and its path, with drawer.js's padding round them, from 120 to 480
// pixels wide.
const LINE = 20;
const HEIGHT = 2 * PADDING + 2 * LINE;
const MIN_WIDTH = 120;
const MAX_WIDTH = 480;

const isFlag = (value) => typeof value === 'boolean';

// A screen entry in the picture's form, with its optional members filled in, or null when it is not.
function readScreen(entry) {
  if (!isObject(entry) || !isText(entry.name) || !optional(entry.id, isText)) return null;
  if (!['path', 'access', 'context', 'where'].every((member) => optional(entry[member], isText))) return null;
  if (!optional(entry.flows, isTextList) || !optional(entry.terms, isTextList) || !optional(entry.removed, isFlag)) return null;
  return {
    name: entry.name,
    path: entry.path ?? '',
    access: entry.access ?? '',
    flows: entry.flows ?? [],
    context: entry.context ?? '',
    terms: entry.terms ?? [],
    removed: entry.removed === true,
  };
}

// The place of the screen an entry stands under: null for a root, or else its parent when that is an earlier screen of
// the list, as the hub lists them, and undefined when its parent is missing: not a place in the list, the screen
// itself or a later one. So no screen stands under itself, however the picture names its parents.
function parentOf(entry, index) {
  if (!isObject(entry) || entry.parent === undefined || entry.parent === null) return null;
  const { parent } = entry;
  return Number.isSafeInteger(parent) && parent >= 0 && parent < index ? parent : undefined;
}

// A box's width for its two lines.
const widthOf = (...lines) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH,
  Math.ceil(Math.max(...lines.map(characters)) * CHARACTER) + 2 * PADDING));

// The drawer of the sitemap kind (see the top of this file).
export function sitemap(given) {
  const picture = JSON.parse(given.text);
  if (!isObject(picture) || picture.format !== 1 || !Array.isArray(picture.screens)) throw new SourceFailure();
  const keyOf = keyer();

  // The screens, those it cannot read included, in the picture's order, so that a parent has its key before its
  // children. A screen without a trace ID is keyed by its name under its parent's key.
  const screens = [];
  for (const [index, entry] of picture.screens.entries()) {
    const read = readScreen(entry);
    const name = isObject(entry) && isText(entry.name) ? entry.name : '';
    const traceId = traceIdOf(entry);
    const at = parentOf(entry, index);
    const parent = at === null || at === undefined ? null : screens[at].key;
    screens.push({
      entry, read, name, traceId, parent, missing: at === undefined, key: keyOf(elementKey({ trace_id: traceId, kind: 'screen', name, parent })),
    });
  }
  const lines = screens.filter(({ parent }) => parent !== null).map(({ key, name, parent }) => ({
    key: keyOf(elementKey({ kind: 'line', name: key, parent })), name, from: parent, to: key,
  }));
  if (screens.length + lines.length > MAX_ELEMENTS) throw new SourceFailure();

  // The tree: each screen's box, and a line from its parent down to it.
  const tree = placed({
    nodes: screens.map(({ key, read, name, entry }) => ({
      id: key, width: widthOf(name, read === null ? whereText(entry?.where) ?? '' : read.path), height: HEIGHT,
    })),
    edges: lines.map(({ from, to }) => ({ from, to })),
  });
  const box = (index) => {
    const { x, y, width, height } = tree.nodes[index];
    return { x, y, width, height };
  };

  // The parts of the sitemap the hub left out. Their warnings are read only once the tree is placed, so that they join
  // the digest of no drawing that failed without them: a picture that fails before this fails again with the same
  // digest, and makes no new drawing, whatever the hub left out.
  const left = leftOut(given.warnings, 'source', keyOf);
  if (screens.length + lines.length + left.length > MAX_ELEMENTS) throw new SourceFailure();

  const elements = screens.map(({ entry, read, name, traceId, parent, missing, key }, index) => {
    const where = whereText(isObject(entry) ? entry.where : undefined);
    if (read === null) return { key, trace_id: traceId, kind: 'screen', name, parent, status: 'unreadable', detail: { where, box: box(index) } };
    return {
      key,
      trace_id: traceId,
      kind: 'screen',
      name,
      parent,
      status: missing ? 'parent_missing' : read.removed ? 'removed' : null,
      detail: {
        path: read.path, access: read.access, flows: read.flows, context: read.context, terms: read.terms, removed: read.removed, where, box: box(index),
      },
    };
  });
  lines.forEach(({ key, name, from, to }, index) => {
    elements.push({ key, kind: 'line', name, parent: from, detail: { from, to, points: tree.edges[index].points.map(({ x, y }) => ({ x, y })) } });
  });
  for (const { key, name, where } of left) elements.push({ key, kind: 'source', name, status: 'left_out', detail: { where } });
  return { elements };
}
