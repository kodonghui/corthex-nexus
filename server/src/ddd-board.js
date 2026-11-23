// The DDD board drawer (TASK-421; SPEC-003): draws the stage-01 picture as one board of its timeline lanes, its contexts
// with their command tables, the dependencies between them and its hotspots, placed by the picture layout (layout.js,
// TASK-420). It is drawing.js's drawer of the ddd_board kind and keeps to the drawer interface described there and in
// the server's README.
//
// The picture is the pinned hub's parsed picture of the project's domain document, as the contract's Snapshot says of
// stage 01: the hub's domain.py reads the Markdown, so NEXUS parses none. Its format 1 is
//   { format: 1, contexts: [context], aggregates: [term], read_models: [term], dependencies: [dependency],
//     hotspots: [hotspot], timeline: [lane] }
//   context: { id, name, type, purpose, removed, external, rows: [row], where }
//   row: { given_by, policy, read_model, command, aggregate, events: [name], where }, a row of a command table
//   term: { name, context, removed, term, where }, a name of an aggregate or read model and its glossary TERM ID
//   dependency: { from, to, kind, why, data, where }, kind call, event or ''
//   hotspot: { text, contexts: [context ID], state, answer, number, where }
//   lane: { lane, places: [[name]], where }, the events of a timeline lane in order, alternatives at one place
// where each where is the file and line of the heading or table row, such as docs/01-domain/nexus.md:62. The hub
// sends what it leaves out not in the picture but as picture-partial checks, which drawing.js gives as warnings.
//
// The board has three regions, top to bottom in the order of REGIONS, each placed by layout.js and the three then
// placed one under another by it (the maintainer's delegate decides on the arrangement; see the server's README):
// - timeline: a lane for each timeline lane, its name at its start and its events left to right in the order of
//   their places, the alternatives at one place one above another;
// - contexts: a frame for each context, holding its command tables: each row a column of stickies, in the bands of
//   BANDS from top to bottom as the stage-09 mockup's board has them (read model, command, aggregate, event,
//   policy), the rows left to right in their order, then its hotspots. The frames and the external systems are the
//   boxes of a layered graph whose lines are the dependencies, the caller above the context it depends on, so a line
//   runs between boxes and never through a sticky;
// - hotspots: the Hotspots lane, for the hotspots that name no context the board draws, when there are any.
//
// It draws, in this order:
// - each lane of the timeline: kind lane, its name, detail { where, box }, box the lane's band across the region; then
//   each of its events: kind event, parent the lane, detail { place, box }, place its place's number from 1;
// - each context: kind context, its trace ID, its name, status removed when the hub marks it removed, and detail
//   { type, purpose, external, where, box }; then its stickies, row by row, each with parent the context: kind
//   read_model, command, aggregate, event or policy, named as the cell names it, and detail { where, box }, where the
//   row's. A cell of read models or aggregates that names several is a sticky for each name, and a read model or
//   aggregate has the trace ID of its glossary term and status removed when the hub's term list marks it removed. A
//   command has detail.actor, who gives it; a row given by a policy ("Policy: when ...") has a policy sticky named by
//   what follows "Policy:", none when that names nothing, and its actor is what comes before it, if anything. Then the
//   context's hotspots;
// - each external system, a name a dependency gives that is no context of the picture, once for each name, "Every
//   context" included: kind external, detail { box };
// - each dependency: kind dependency, named by its why, parent the box it starts from, detail { from, to, kind, why,
//   data, where, points }, from and to the keys of its boxes and points its line from the one to the other;
// - the Hotspots lane when it holds any: kind hotspot_lane, name Hotspots, detail { box }; then its hotspots;
// - each hotspot: kind hotspot, named by its text, parent the context or the Hotspots lane it stands in (see
//   hotspotFrame), status answered when its state starts with "answered" or "답함" (ANSWERED) and open otherwise,
//   and detail { number, state, answer, contexts, where, box };
// - each table or other part of the document the hub left out (SPEC-003), from the warnings: kind table, status
//   left_out, named by what the hub says of it, with detail { where }, its file and line. It has no box.
// An entry of the picture that is not in its form is left out and marked: kind context, command (a row), lane,
// hotspot or dependency, status unreadable, its name when it has one, and detail { where, box }: an unreadable context
// is an empty frame, an unreadable row a command sticky, and an unreadable hotspot stands in the Hotspots lane; an
// unreadable dependency has no line and no box. A term entry the drawer cannot read is passed over, as the board draws
// none on its own.
//
// Every box is { x, y, width, height }, its top left corner and its size, worked out from its text for the page that
// draws it (TASK-458): a sticky is 148 by 80 pixels, as the mockup's are. A dependency names a context by its trace
// ID, at the start of what it says, or by its name in any case. A picture that is not format 1 with a list of
// contexts fails the drawing at its source (SourceFailure), and so does one whose other parts are not lists, one with
// more elements than a drawing holds, and one too large for layout.js to place. Nothing here logs (rule 5).

import {
  characters, elementKey, isName, isObject, isText, isTextList, keyer, leftOut, MAX_ELEMENTS, optional, SourceFailure, traceIdOf,
  whereText,
} from './drawer.js';
import { layout } from './layout.js';

// The board's regions, top to bottom: the one place that orders them.
export const REGIONS = Object.freeze(['timeline', 'contexts', 'hotspots']);

// The sticky kinds of a command table's row, the bands of a context frame from top to bottom, as the stage-09
// mockup's board orders them.
const BANDS = Object.freeze(['read_model', 'command', 'aggregate', 'event', 'policy']);

// Where a hotspot stands, the one place that places hotspots: in the frame of the first context it names that the
// board draws, in the band of HOTSPOT_BAND after the context's rows, as the mockup's hotspot stands by an aggregate;
// or else in the Hotspots lane.
const HOTSPOT_BAND = 'aggregate';
const HOTSPOTS = 'Hotspots';
function hotspotFrame(contexts, frames) {
  for (const id of contexts) {
    const frame = frames.get(id);
    if (frame !== undefined) return frame;
  }
  return null;
}
// A hotspot is answered when its state starts with "answered", such as "answered, one open question", or with its
// Korean form "답함", as a Korean domain document writes it and the hub reads it.
const ANSWERED = /^(?:answered\b|답함)/i;

// Sizes, for 12-pixel IBM Plex Mono, whose characters are 0.6 em wide: a sticky as the mockup draws one, a lane's name
// at its start, and a frame's header with the context's trace ID, name and type.
const STICKY = Object.freeze({ width: 148, height: 80 });
const CHARACTER = 7.2;
const PADDING = 12;
const HEADER = 32;
const LABEL = Object.freeze({ min: 96, max: 240 });
const TITLE = Object.freeze({ min: STICKY.width + 2 * PADDING, max: 480 });
// The gaps layout.js keeps: between the stickies of a frame, in the timeline, between the boxes of the contexts, in
// the Hotspots lane and between the regions. The timeline runs left to right, so its layers are its places; the
// regions are one layer of a left-to-right layout, so they stand one under another.
const INSIDE = Object.freeze({ nodeGap: 24, layerGap: 16 });
const TIMELINE = Object.freeze({ direction: 'LR', nodeGap: 16, layerGap: 24 });
const CONTEXTS = Object.freeze({});
const LANE = Object.freeze({ nodeGap: 24 });
const STACK = Object.freeze({ direction: 'LR', nodeGap: 48 });

// What a cell of a command table holds that names nothing, as the hub reads its definitions.
const EMPTY = new Set(['', '-', 'none', 'null', 'n/a', 'n a', 'na', 'tbd', 'not drawn', '없음', '비어 있음', '미정']);
// A policy in a row's given-by: "Policy: when ...", or the Korean form, as the hub finds one.
const POLICY = /(?:\bPolicy|정책)\s*:\s*/i;
// A hotspot's number at the start of its text, as the hub reads it.
const NUMBER = /^\d+\s*[.)]?\s+/;
// A trace ID at the start of a dependency's end, and one anywhere in a cell's name.
const LEADING_ID = /^([A-Z][A-Z0-9]*-[0-9]{1,6})(?![A-Za-z0-9-])/;
const ID_IN_TEXT = /(?<![A-Za-z0-9-])[A-Z][A-Z0-9]*-[0-9]{1,6}(?![A-Za-z0-9-])/g;

const isFlag = (value) => typeof value === 'boolean';
const isPlaces = (value) => Array.isArray(value) && value.every(isTextList);
const textOf = (entry, member) => (isObject(entry) && isText(entry[member]) ? entry[member] : '');
const round = (value) => Math.round(value * 100) / 100;
// A name as the hub compares names: white space taken out and in lower case.
const word = (name) => name.normalize('NFC').replace(/\s+/g, '').toLowerCase();

// The entries of the picture in its form, with their optional members filled in, or null when they are not.
function readContext(entry) {
  if (!isObject(entry) || !isText(entry.name) || !optional(entry.id, isText) || !optional(entry.where, isText)) return null;
  if (!['type', 'purpose', 'external'].every((member) => optional(entry[member], isText))) return null;
  if (!optional(entry.removed, isFlag) || !optional(entry.rows, Array.isArray)) return null;
  return {
    id: entry.id ?? '', type: entry.type ?? '', purpose: entry.purpose ?? '', external: entry.external ?? '', removed: entry.removed === true,
    rows: entry.rows ?? [],
  };
}

function readRow(entry) {
  if (!isObject(entry) || !['given_by', 'read_model', 'command', 'aggregate', 'where'].every((member) => optional(entry[member], isText))) return null;
  if (!optional(entry.policy, isFlag) || !optional(entry.events, isTextList)) return null;
  return {
    givenBy: entry.given_by ?? '', policy: entry.policy === true, readModel: entry.read_model ?? '', command: entry.command ?? '',
    aggregate: entry.aggregate ?? '', events: entry.events ?? [],
  };
}

function readLane(entry) {
  if (!isObject(entry) || !isText(entry.lane) || !isPlaces(entry.places) || !optional(entry.where, isText)) return null;
  return { name: entry.lane, places: entry.places };
}

function readDependency(entry) {
  if (!isObject(entry) || !isName(entry.from) || !isName(entry.to)) return null;
  if (!['kind', 'why', 'data', 'where'].every((member) => optional(entry[member], isText))) return null;
  return { from: entry.from, to: entry.to, kind: entry.kind ?? '', why: entry.why ?? '', data: entry.data ?? '' };
}

function readHotspot(entry) {
  if (!isObject(entry) || !isText(entry.text) || !optional(entry.contexts, isTextList)) return null;
  if (!['state', 'answer', 'where'].every((member) => optional(entry[member], isText))) return null;
  if (!optional(entry.number, (value) => Number.isSafeInteger(value) && value > 0)) return null;
  return { text: entry.text, contexts: entry.contexts ?? [], state: entry.state ?? '', answer: entry.answer ?? '', number: entry.number ?? null };
}

// The glossary terms of the aggregates or the read models, by context and name: { traceId, removed }, the first of each.
function termsOf(entries) {
  const terms = new Map();
  for (const entry of entries) {
    if (!isObject(entry) || !isName(entry.name) || !optional(entry.context, isText) || !optional(entry.term, isText)) continue;
    if (!optional(entry.removed, isFlag)) continue;
    const at = `${entry.context ?? ''}\n${word(entry.name)}`;
    if (!terms.has(at)) {
      terms.set(at, { traceId: traceIdOf({ id: entry.term }), removed: entry.removed === true });
    }
  }
  return terms;
}

// The names a cell of read models or aggregates holds, as the hub reads its definitions: split at commas and line
// breaks, each glossary TERM ID of the picture's terms (termIds) dropped from a name wherever it stands, with the
// brackets it leaves empty, and what names nothing left out. The hub drops a TERM ID by the project's ID formats,
// which the picture does not carry, so the IDs its terms give stand in for them.
function namesOf(cell, termIds) {
  return cell.split(/\s*,\s*|\s*<br\s*\/?>\s*/i)
    .map((name) => name.replace(ID_IN_TEXT, (id) => (termIds.has(id) ? '' : id)).replace(/\(\s*\)/g, '').replace(/\s+/g, ' ').trim())
    .filter((name) => !EMPTY.has(name.toLowerCase()));
}

// Who gives a row's command: { actor, policy }, the policy what follows "Policy:" when the hub marks the row a policy's,
// and none when that names nothing.
function givenByOf({ givenBy, policy }) {
  if (!policy) return { actor: givenBy.trim(), policy: '' };
  const found = POLICY.exec(givenBy);
  if (found === null) return { actor: '', policy: givenBy.trim() };
  const named = givenBy.slice(found.index + found[0].length).trim();
  return {
    actor: givenBy.slice(0, found.index).replace(/[\s,;]+$/, ''),
    policy: EMPTY.has(named.toLowerCase()) ? '' : named,
  };
}

// The width of a lane's name or a frame's header.
const widthOf = (text, { min, max }) => Math.min(max, Math.max(min, Math.ceil(characters(text) * CHARACTER) + 2 * PADDING));

// Places a graph with layout.js. A RangeError can only be a graph too large to place, as every box and line here is
// in layout.js's form, so the picture fails at its source.
function placed(graph, options) {
  try {
    return layout(graph, options);
  } catch (error) {
    if (error instanceof RangeError) throw new SourceFailure();
    throw error;
  }
}

// The lines that keep a row's stickies in one column, band under band: each sticky of one band to the first of the
// next band that has any, and the first of the one to each of the next.
function columnLines(stickies) {
  const bands = BANDS.map((band) => stickies.filter((sticky) => sticky.kind === band)).filter((group) => group.length > 0);
  return bands.slice(1).flatMap((next, index) => {
    const before = bands[index];
    return [...before.map((sticky) => ({ from: sticky.key, to: next[0].key })), ...next.slice(1).map((sticky) => ({ from: before[0].key, to: sticky.key }))];
  });
}

// The drawer of the ddd_board kind (see the top of this file).
export function dddBoard(given) {
  const picture = JSON.parse(given.text);
  if (!isObject(picture) || picture.format !== 1 || !Array.isArray(picture.contexts)) throw new SourceFailure();
  const listOf = (member) => {
    const value = picture[member] ?? [];
    if (!Array.isArray(value)) throw new SourceFailure();
    return value;
  };
  const [timeline, dependencies, hotspots, aggregates, readModels] = ['timeline', 'dependencies', 'hotspots', 'aggregates', 'read_models'].map(listOf);
  const terms = { aggregate: termsOf(aggregates), read_model: termsOf(readModels) };
  const termIds = new Set([...terms.aggregate.values(), ...terms.read_model.values()].map(({ traceId }) => traceId).filter((id) => id !== null));
  const keyOf = keyer();

  // The timeline's lanes, each with its events.
  const lanes = timeline.map((entry) => {
    const read = readLane(entry);
    const name = read?.name ?? textOf(entry, 'lane');
    const key = keyOf(elementKey({ kind: 'lane', name }));
    const events = (read?.places ?? []).flatMap((names, index) => names.filter((event) => !EMPTY.has(event.trim().toLowerCase()))
      .map((event) => ({ name: event, place: index + 1, key: keyOf(elementKey({ kind: 'event', name: event, parent: key })) })));
    return { entry, read, name, key, events };
  });

  // The contexts, each with the stickies of its rows, by trace ID and by name in lower case for the dependencies.
  const frames = picture.contexts.map((entry) => {
    const traceId = traceIdOf(entry);
    const name = textOf(entry, 'name');
    return { entry, read: readContext(entry), traceId, name, key: keyOf(elementKey({ trace_id: traceId, kind: 'context', name })), stickies: [], hotspots: [] };
  });
  const byId = new Map();
  const byName = new Map();
  for (const frame of frames) {
    if (frame.traceId !== null && !byId.has(frame.traceId)) byId.set(frame.traceId, frame);
    if (isName(frame.name) && !byName.has(frame.name.toLowerCase())) byName.set(frame.name.toLowerCase(), frame);
  }
  for (const frame of frames) {
    for (const entry of frame.read?.rows ?? []) frame.stickies.push(stickiesOf(entry, frame, terms, termIds, keyOf));
  }

  // The hotspots, each in its context's frame or in the Hotspots lane.
  const laneHotspots = [];
  for (const entry of hotspots) {
    const read = readHotspot(entry);
    const name = read?.text ?? textOf(entry, 'text');
    const hotspot = { entry, read, name, key: keyOf(elementKey({ kind: 'hotspot', name: name.replace(NUMBER, '') })) };
    const frame = read === null ? null : hotspotFrame(read.contexts, byId);
    (frame === null ? laneHotspots : frame.hotspots).push(hotspot);
  }

  // The dependencies, each between the boxes of its ends: a context, or else an external system of that name.
  const externals = new Map();
  const endOf = (name) => {
    const id = LEADING_ID.exec(name)?.[1];
    const frame = (id === undefined ? undefined : byId.get(id)) ?? byName.get(name.toLowerCase());
    if (frame !== undefined) return frame.key;
    if (!externals.has(name)) externals.set(name, { name, key: keyOf(elementKey({ kind: 'external', name })) });
    return externals.get(name).key;
  };
  const lines = dependencies.map((entry) => {
    const read = readDependency(entry);
    if (read === null) return { entry, read, name: textOf(entry, 'why'), key: keyOf(elementKey({ kind: 'dependency', name: textOf(entry, 'why') })) };
    const from = endOf(read.from);
    const to = endOf(read.to);
    return { entry, read, from, to, name: read.why, key: keyOf(elementKey({ kind: 'dependency', name: `${to} ${read.kind}`, parent: from })) };
  });
  const laneKey = laneHotspots.length > 0 ? keyOf(elementKey({ kind: 'hotspot_lane', name: HOTSPOTS })) : null;

  const stickyCount = frames.reduce((sum, frame) => sum + frame.stickies.reduce((count, column) => count + column.length, 0), 0);
  const count = lanes.reduce((sum, lane) => sum + 1 + lane.events.length, 0) + frames.length + stickyCount + hotspots.length
    + externals.size + lines.length + (laneKey === null ? 0 : 1);
  if (count > MAX_ELEMENTS) throw new SourceFailure();

  // Each region placed on its own, then the regions one under another.
  const regions = new Map();
  if (lanes.length > 0) regions.set('timeline', placeTimeline(lanes));
  if (frames.length > 0 || externals.size > 0) regions.set('contexts', placeContexts(frames, externals, lines));
  if (laneKey !== null) {
    regions.set('hotspots', placed({
      nodes: [{ id: laneKey, width: widthOf(HOTSPOTS, LABEL), height: STICKY.height }, ...laneHotspots.map(({ key }) => ({ id: key, ...STICKY }))],
    }, LANE));
  }
  const order = REGIONS.filter((region) => regions.has(region));
  const stack = order.length === 0 ? null : placed({
    nodes: order.map((region) => ({ id: region, width: regions.get(region).bounds.width, height: regions.get(region).bounds.height })),
  }, STACK);
  // Where a region's own places go on the board.
  const shiftOf = (region) => {
    const { bounds } = regions.get(region);
    const at = stack.nodes[order.indexOf(region)];
    return { dx: at.x - bounds.x, dy: at.y - bounds.y };
  };
  const boxOf = ({ x, y, width, height }, { dx, dy }) => ({ x: round(x + dx), y: round(y + dy), width: round(width), height: round(height) });

  // What the hub left out. Its warnings are read only once the board is placed, so that they join the digest of no
  // drawing that failed without them.
  const left = leftOut(given.warnings, 'table', keyOf);
  if (count + left.length > MAX_ELEMENTS) throw new SourceFailure();

  const elements = [];
  const draw = {
    timeline() {
      const region = regions.get('timeline');
      const shift = shiftOf('timeline');
      const nodes = new Map(region.nodes.map((node) => [node.id, node]));
      for (const lane of lanes) {
        const own = [lane.key, ...lane.events.map(({ key }) => key)].map((key) => nodes.get(key));
        const top = Math.min(...own.map(({ y }) => y));
        const bottom = Math.max(...own.map(({ y, height }) => y + height));
        const band = boxOf({ x: region.bounds.x, y: top, width: region.bounds.width, height: bottom - top }, shift);
        elements.push({ key: lane.key, kind: 'lane', name: lane.name, ...(lane.read === null ? { status: 'unreadable' } : {}), detail: { where: whereText(lane.entry?.where), box: band } });
        for (const event of lane.events) {
          elements.push({ key: event.key, kind: 'event', name: event.name, parent: lane.key, detail: { place: event.place, box: boxOf(nodes.get(event.key), shift) } });
        }
      }
    },
    contexts() {
      const region = regions.get('contexts');
      const shift = shiftOf('contexts');
      const nodes = new Map(region.nodes.map((node) => [node.id, node]));
      for (const frame of frames) {
        const box = boxOf(nodes.get(frame.key), shift);
        const where = whereText(frame.entry?.where);
        elements.push(frame.read === null
          ? { key: frame.key, trace_id: frame.traceId, kind: 'context', name: frame.name, status: 'unreadable', detail: { where, box } }
          : {
            key: frame.key,
            trace_id: frame.traceId,
            kind: 'context',
            name: frame.name,
            ...(frame.read.removed ? { status: 'removed' } : {}),
            detail: { type: frame.read.type, purpose: frame.read.purpose, external: frame.read.external, where, box },
          });
        // The frame's inside, placed below its header.
        const inside = frame.inside === null ? null : new Map(frame.inside.nodes.map((node) => [node.id, node]));
        const within = frame.inside === null ? null : { dx: box.x + PADDING - frame.inside.bounds.x, dy: box.y + HEADER + PADDING - frame.inside.bounds.y };
        for (const sticky of frame.stickies.flat()) {
          const { key, kind, name, traceId, status, detail } = sticky;
          elements.push({
            key, ...(traceId ? { trace_id: traceId } : {}), kind, name, parent: frame.key, ...(status ? { status } : {}),
            detail: { ...detail, box: boxOf(inside.get(key), within) },
          });
        }
        for (const hotspot of frame.hotspots) elements.push(hotspotElement(hotspot, frame.key, boxOf(inside.get(hotspot.key), within)));
      }
      for (const { name, key } of externals.values()) elements.push({ key, kind: 'external', name, detail: { box: boxOf(nodes.get(key), shift) } });
      let placedLine = 0;
      for (const line of lines) {
        if (line.read === null) {
          elements.push({ key: line.key, kind: 'dependency', name: line.name, status: 'unreadable', detail: { where: whereText(line.entry?.where) } });
          continue;
        }
        const { points } = region.edges[placedLine];
        placedLine += 1;
        elements.push({
          key: line.key,
          kind: 'dependency',
          name: line.name,
          parent: line.from,
          detail: {
            from: line.from,
            to: line.to,
            kind: line.read.kind,
            why: line.read.why,
            data: line.read.data,
            where: whereText(line.entry.where),
            points: points.map(({ x, y }) => ({ x: round(x + shift.dx), y: round(y + shift.dy) })),
          },
        });
      }
    },
    hotspots() {
      const region = regions.get('hotspots');
      const shift = shiftOf('hotspots');
      const nodes = new Map(region.nodes.map((node) => [node.id, node]));
      elements.push({ key: laneKey, kind: 'hotspot_lane', name: HOTSPOTS, detail: { box: boxOf(region.bounds, shift) } });
      for (const hotspot of laneHotspots) elements.push(hotspotElement(hotspot, laneKey, boxOf(nodes.get(hotspot.key), shift)));
    },
  };
  for (const region of order) draw[region]();
  // An unreadable dependency has no line, so it is drawn without the contexts region when there is none.
  if (!regions.has('contexts')) {
    for (const line of lines) elements.push({ key: line.key, kind: 'dependency', name: line.name, status: 'unreadable', detail: { where: whereText(line.entry?.where) } });
  }
  for (const { key, name, where } of left) elements.push({ key, kind: 'table', name, status: 'left_out', detail: { where } });
  return { elements };
}

// The stickies of a row of a context's command table, in band order: each { key, kind, name, traceId, status, detail }.
function stickiesOf(entry, frame, terms, termIds, keyOf) {
  const row = readRow(entry);
  const where = whereText(isObject(entry) ? entry.where : undefined);
  if (row === null) {
    const name = textOf(entry, 'command');
    return [{ key: keyOf(elementKey({ kind: 'command', name, parent: frame.key })), kind: 'command', name, status: 'unreadable', detail: { where } }];
  }
  const { actor, policy } = givenByOf(row);
  const command = row.command.trim();
  // The row's own key is its command's, under its context, and its other stickies' keys are under it.
  const base = elementKey({ kind: 'command', name: command, parent: frame.key });
  const sticky = (kind, name, detail = {}) => {
    const term = terms[kind]?.get(`${frame.read.id}\n${word(name)}`) ?? null;
    return {
      key: keyOf(kind === 'command' ? base : elementKey({ kind, name, parent: base })),
      kind,
      name,
      traceId: term?.traceId ?? null,
      status: term?.removed ? 'removed' : null,
      detail: { ...detail, where },
    };
  };
  return [
    ...namesOf(row.readModel, termIds).map((name) => sticky('read_model', name)),
    ...(EMPTY.has(command.toLowerCase()) ? [] : [sticky('command', command, { actor })]),
    ...namesOf(row.aggregate, termIds).map((name) => sticky('aggregate', name)),
    ...row.events.filter((event) => !EMPTY.has(event.trim().toLowerCase())).map((name) => sticky('event', name)),
    ...(policy === '' ? [] : [sticky('policy', policy)]),
  ];
}

// The timeline region: each lane's name at its start, layer 0, and its events in the layers of their places, linked
// in order so that each lane keeps to its own row.
function placeTimeline(lanes) {
  const nodes = [];
  const edges = [];
  for (const lane of lanes) {
    nodes.push({ id: lane.key, width: widthOf(lane.name, LABEL), height: STICKY.height, layer: 0 });
    let before = [lane.key];
    const places = new Map();
    for (const event of lane.events) {
      nodes.push({ id: event.key, ...STICKY, layer: event.place });
      places.set(event.place, [...(places.get(event.place) ?? []), event.key]);
    }
    for (const place of places.values()) {
      edges.push(...place.map((key) => ({ from: before[0], to: key })));
      before = place;
    }
  }
  return placed({ nodes, edges }, TIMELINE);
}

// The contexts region: each frame sized by its inside, which layout.js places first, and the frames and the external
// systems placed as the boxes of the dependencies' graph.
function placeContexts(frames, externals, lines) {
  for (const frame of frames) {
    const stickies = frame.stickies.flat();
    const nodes = [
      ...stickies.map(({ key, kind }) => ({ id: key, ...STICKY, layer: BANDS.indexOf(kind) })),
      ...frame.hotspots.map(({ key }) => ({ id: key, ...STICKY, layer: BANDS.indexOf(HOTSPOT_BAND) })),
    ];
    frame.inside = nodes.length === 0 ? null : placed({ nodes, edges: frame.stickies.flatMap(columnLines) }, INSIDE);
    const title = [frame.traceId ?? '', frame.name, frame.read?.type ?? ''].filter((part) => part !== '').join(' · ');
    const inner = frame.inside?.bounds ?? { width: 0, height: 0 };
    frame.size = {
      width: Math.max(widthOf(title, TITLE), Math.ceil(inner.width) + 2 * PADDING),
      height: HEADER + PADDING + (frame.inside === null ? 0 : Math.ceil(inner.height) + PADDING),
    };
  }
  return placed({
    nodes: [...frames.map(({ key, size }) => ({ id: key, ...size })), ...[...externals.values()].map(({ key }) => ({ id: key, ...STICKY }))],
    edges: lines.filter(({ read }) => read !== null).map(({ from, to }) => ({ from, to })),
  }, CONTEXTS);
}

// A hotspot's element, in the frame or lane whose key is parent.
function hotspotElement({ entry, read, name, key }, parent, box) {
  if (read === null) return { key, kind: 'hotspot', name, parent, status: 'unreadable', detail: { where: whereText(entry?.where), box } };
  return {
    key,
    kind: 'hotspot',
    name,
    parent,
    status: ANSWERED.test(read.state) ? 'answered' : 'open',
    detail: { number: read.number, state: read.state, answer: read.answer, contexts: read.contexts, where: whereText(entry.where), box },
  };
}
