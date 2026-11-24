// Reading a Miro board export (TASK-453; API-292, SPEC-041): the sticky notes, frames and connectors of a board as
// Miro's REST API v2 lists them, read into the notes and links the import adds to the open workshop (workshop.js).
// NEXUS reads only the file the owner uploads. It fetches no address, image or embed the file names, and calls no
// Miro API.
//
// The file is untrusted. JSON.parse has read it already, within the 5 MiB limit of a Miro export (body.js), and every
// key it made is the object's own, __proto__ included. This reads fixed paths only, each an own member checked for its
// type, and never walks the file, so a nesting or a list anywhere else is never visited. It bounds each count and
// length before it reads on: at most 5000 items, an id of at most 100 characters, a sticky note's content of fewer
// than 6000 characters (Miro's own limit) and the first 60 characters of a frame's title.
//
// The rules the spec, the contract and the tables left open, chosen by the coordinator for TASK-453 and waiting for the
// maintainer's delegate (see the server README's "Miro import" section):
// 1. Items: each item of data is an object with a string id and type. Only type sticky_note becomes a note; frames are
//    read for their titles only, and every other type is skipped. A sticky note needs a string data.content and
//    numeric position.x and position.y.
// 2. Links: a connector whose startItem.id and endItem.id name two imported notes is a link from start to end. One to
//    anything else, to the same note, or again between the same two notes in the same direction is skipped.
// 3. Steps: a note in a frame (parent.id) whose title starts with a step name, after "Step" or "스텝" or not, goes to
//    that step, "1-a" being step 1. Any other note goes to the step that introduces its kind, and a note of no known
//    kind to step 0.
// 4. Kinds: the sticky colour gives the kind, named as the design tokens name the sticky colours (COLOURS); gray,
//    cyan, black and a missing or unknown colour give "note".
// 5. Places: a note keeps its x and y, in its frame's coordinates when it is in one. The notes of each step then move
//    together so that their smallest x and smallest y are 0, and each must lie within ±1,000,000.
// 6. Text: the content's tags are dropped, a paragraph or line break becomes a space, entities are decoded and white
//    space is collapsed. A note left empty is skipped; a text over 200 characters refuses the whole import.

import { boundedText } from './comments.js';
import { isObject } from './drawer.js';
import { coordinateOf } from './positions.js';
import { invalidRequest } from './problem.js';

// MiroBoard.data's maxItems in the contract.
export const ITEMS = 5000;
// Bounds read before anything else: a Miro ID is a number of about 19 digits, kept as text.
const ID_LENGTH = 100;
// Miro's own limit: "The text must be shorter than 6000 characters" (Web SDK, sticky note).
const CONTENT_LENGTH = 6000;
// The part of a frame's title read for a step name.
const TITLE_LENGTH = 60;

// Miro's 16 sticky colours (StickyNoteStyle.fillColor) and the kind each gives, named as the design tokens name the
// sticky colours (design/corthex/light.tokens.json, color.sticky). A colour not listed gives NOTE.
export const COLOURS = Object.freeze({
  orange: 'event',
  light_blue: 'command',
  blue: 'command',
  dark_blue: 'command',
  yellow: 'aggregate',
  light_yellow: 'actor',
  violet: 'policy',
  light_green: 'read-model',
  green: 'read-model',
  dark_green: 'read-model',
  light_pink: 'external-system',
  pink: 'external-system',
  red: 'hotspot',
});
export const NOTE = 'note';
// The step that introduces each kind, after the mockup's step labels; NOTE goes to step 0.
export const KIND_STEPS = Object.freeze({
  event: '1',
  'external-system': '2',
  command: '3',
  hotspot: '4',
  actor: '5',
  aggregate: '6',
  policy: '8',
  'read-model': '8',
  [NOTE]: '0',
});
// A step name at the start of a frame's title, after "Step" or "스텝" or not, ending where no letter, digit or hyphen
// follows: "2", "Step 2 · External systems", "1-b 타임라인". "1-a" is the mockup's label of step 1.
const TITLE_STEP = /^\s*(?:step|스텝)?\s*(1-a|1-b|[0-9])(?![\p{L}\p{N}-])/iu;

// The member an object has of its own, or undefined.
const own = (value, name) => (isObject(value) && Object.hasOwn(value, name) ? value[name] : undefined);

// Whether a text has fewer than limit characters, counting at most 2 × limit UTF-16 units.
function shorter(text, limit) {
  if (text.length < limit) return true;
  if (text.length >= 2 * limit) return false;
  let count = 0;
  for (const _ of text) count += 1;
  return count < limit;
}

const isId = (value) => typeof value === 'string' && value.length >= 1 && value.length <= ID_LENGTH;

// The step a frame's title names, or null.
function stepOfTitle(title) {
  if (typeof title !== 'string') return null;
  const match = TITLE_STEP.exec(title.slice(0, TITLE_LENGTH));
  if (match === null) return null;
  const step = match[1].toLowerCase();
  return step === '1-a' ? '1' : step;
}

const NAMED = Object.freeze({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' });

// A numeric character reference's character, or the reference as written when it names no character.
function character(reference, code) {
  if (!Number.isSafeInteger(code) || code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return reference;
  return String.fromCodePoint(code);
}

// A sticky note's content as plain text: Miro's content is HTML of <p>, <a>, <strong>, <b>, <em>, <i>, <u>, <s> and
// <br> (Web SDK, sticky note). A paragraph or a line break becomes a space and any other tag is dropped; then the
// entities are decoded once, in one pass, so that an escaped tag stays text; then white space is collapsed. A tag holds
// no < or >, so each pattern reads each character a bounded number of times, whatever the content.
export function textOf(content) {
  return content
    .replace(/<\/?(?:p|br)\b[^<>]*>/giu, ' ')
    .replace(/<[^<>]*>/gu, '')
    .replace(/&(?:#([0-9]{1,7})|#[xX]([0-9a-fA-F]{1,6})|(amp|lt|gt|quot|apos|nbsp));/gu, (reference, decimal, hex, name) => {
      if (name !== undefined) return NAMED[name];
      return character(reference, decimal !== undefined ? Number(decimal) : Number.parseInt(hex, 16));
    })
    .replace(/\s+/gu, ' ')
    .trim();
}

// A sticky note of data[index] as { id, step, kind, text, x, y }, or null when its text is empty. frames maps a frame's
// ID to the step its title names, or null.
function noteOf(item, index, frames, textLimit) {
  const at = `data[${index}]`;
  const content = own(own(item, 'data'), 'content');
  if (typeof content !== 'string' || !shorter(content, CONTENT_LENGTH)) {
    throw invalidRequest(`${at}.data.content`, `${at}.data.content must be the text of a Miro sticky note, under ${CONTENT_LENGTH} characters`);
  }
  const position = own(item, 'position');
  for (const axis of ['x', 'y']) {
    if (typeof own(position, axis) !== 'number') throw invalidRequest(`${at}.position.${axis}`, `${at}.position.${axis} must be a number`);
  }
  const text = textOf(content);
  if (text === '') return null;
  boundedText(text, `${at}.data.content`, textLimit, { empty: false });
  const colour = own(own(item, 'style'), 'fillColor');
  const kind = typeof colour === 'string' && Object.hasOwn(COLOURS, colour) ? COLOURS[colour] : NOTE;
  const parent = own(own(item, 'parent'), 'id');
  const framed = typeof parent === 'string' ? frames.get(parent) ?? null : null;
  return { id: item.id, step: framed ?? KIND_STEPS[kind], kind, text, x: position.x, y: position.y };
}

// A place moved by its step's smallest, which must lie within ±1,000,000.
function placed(value, smallest) {
  try {
    return coordinateOf(value - smallest, 'data');
  } catch {
    throw invalidRequest('data', 'data places a sticky note more than 1000000 from the other notes of its step');
  }
}

// Reads a MiroBoard body into { notes: [{ step, kind, text, x, y }], links: [{ from, to }] }, from and to being indexes
// of notes, in the file's order. Refuses invalid_request on data when the file is not a Miro export, on an item's field
// when a sticky note's is not Miro's, and text_too_long when a note's text is over textLimit characters.
export function readMiroBoard(body, textLimit) {
  const data = own(body, 'data');
  if (!Array.isArray(data) || data.length > ITEMS) throw invalidRequest('data', `data must be a list of at most ${ITEMS} Miro items`);
  const ids = new Set();
  const frames = new Map();
  for (const item of data) {
    if (!isId(own(item, 'id')) || typeof own(item, 'type') !== 'string' || ids.has(item.id)) {
      throw invalidRequest('data', `each item of data must be an object with its own id of 1 to ${ID_LENGTH} characters and a type`);
    }
    ids.add(item.id);
    if (item.type === 'frame') frames.set(item.id, stepOfTitle(own(own(item, 'data'), 'title')));
  }
  const read = [];
  data.forEach((item, index) => {
    if (item.type !== 'sticky_note') return;
    const note = noteOf(item, index, frames, textLimit);
    if (note !== null) read.push(note);
  });
  const smallest = new Map();
  for (const { step, x, y } of read) {
    const [left, top] = smallest.get(step) ?? [x, y];
    smallest.set(step, [Math.min(left, x), Math.min(top, y)]);
  }
  const notes = read.map(({ step, kind, text, x, y }) => {
    const [left, top] = smallest.get(step);
    return { step, kind, text, x: placed(x, left), y: placed(y, top) };
  });
  const indexes = new Map(read.map((note, index) => [note.id, index]));
  const links = [];
  const linked = new Set();
  for (const item of data) {
    if (item.type !== 'connector') continue;
    const from = indexes.get(own(own(item, 'startItem'), 'id'));
    const to = indexes.get(own(own(item, 'endItem'), 'id'));
    if (from === undefined || to === undefined || from === to || linked.has(`${from}>${to}`)) continue;
    linked.add(`${from}>${to}`);
    links.push({ from, to });
  }
  return { notes, links };
}
