// The item-table drawer (TASK-423; SPEC-005): draws a stage's items as a table, one row for each item. It is
// drawing.js's drawer of the item_table kind and keeps to the drawer interface described there and in the server's
// README. Which stages show an item table, and when one makes way for its stage's pictures, is drawing.js's.
//
// The source is the snapshot's items of the stage, which snapshot.js keeps as a JSON array, /items/<stage>: the pinned
// hub's items as its build_items makes them, in its order (by ID), each
//   { id, kind, stage, where, title, status, type, priority, link, parent, links, ... }
// where id is the item's trace ID, where its file and line such as docs/02-prd/requirements.md:23, title its name, cut
// by the hub to 120 characters, status the status its source gives it, and links the IDs it links to, up to 60, in ID
// order. The hub leaves out a member it has no value for. A stage the hub read that has no items keeps an empty list,
// which draws an empty table: the page says the stage has no items yet (SPEC-005).
//
// It draws, for each item, a row: kind row, the item's trace ID, named by its title ('' for none, which the page shows
// by the trace ID, SPEC-010), and detail { status, links, where }: the status as its source gives it ('' for none), the
// IDs it links to as the hub sends them, and its file and line. A removed item has status removed and comes after the
// others, in their order (SPEC-005); every other row has none. An item is removed as the hub's is_removed says: its
// status, in lowercase words, holds one of the hub's removed words (REMOVED below). A deferred item stays in its place.
// An entry it cannot read, one that is not in the form above, is a row in its place with status unreadable, its trace
// ID and title when it has them, and detail { status: '', links: [], where }.
//
// Links stay IDs in the drawing, which reads only its own stage's items: so a title changed in another stage draws no
// table again, and no confirmation of it is invalidated (SPEC-033). The page shows each link by its name, which the
// read of a diagram gives (TASK-441, API-265) from the project's latest item documents with itemNames below; a link it
// cannot find is shown by its ID, as SPEC-010's exception says.
//
// A row's key is its item's trace ID. An item whose ID is not in the contract's form is keyed row:<its ID>, and one
// without an ID row:<its title>. So a row keeps its key, and its threads, while its item keeps its ID, whatever its
// title, status or place.
//
// A source that is not a list fails the drawing at its source (SourceFailure), and so does one of more items than a
// drawing holds. Nothing here logs (rule 5).

import {
  elementKey, isName, isObject, isText, isTextList, keyer, MAX_ELEMENTS, optional, SourceFailure, traceIdOf, whereText,
} from './drawer.js';

// The hub's removed words at the pin (hub.py's REMOVED), English and Korean.
const REMOVED = new Set([
  'removed', 'deleted', 'dropped', 'cancelled', 'canceled', 'deprecated', 'obsolete', '삭제', '삭제됨', '폐기', '제외', '취소',
]);

// A status in lowercase words, as the hub's norm() makes it: every character that is not a letter, a number, an
// underscore, a space or a hyphen becomes a space, and so does an underscore.
const wordsOf = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}_\s-]/gu, ' ').replaceAll('_', ' ').split(/\s+/).filter((word) => word !== '');

// Whether a status marks its item removed (the hub's is_removed).
export const isRemoved = (status) => isText(status) && wordsOf(status).some((word) => REMOVED.has(word));

// An item in the form above, with its members filled in, or null when it is not.
function readItem(entry) {
  if (!isObject(entry) || !isName(entry.id)) return null;
  const { title, status, links, where } = entry;
  if (!optional(title, isText) || !optional(status, isText) || !optional(links, isTextList) || !optional(where, isText)) return null;
  return { id: entry.id, title: title ?? '', status: status ?? '', links: links ?? [] };
}

// The drawer of the item_table kind (see the top of this file).
export function itemTable(given) {
  const items = JSON.parse(given.text);
  if (!Array.isArray(items) || items.length > MAX_ELEMENTS) throw new SourceFailure();
  const keyOf = keyer();
  const rows = items.map((entry) => {
    const item = readItem(entry);
    const traceId = traceIdOf(entry);
    const id = isObject(entry) && isName(entry.id) ? entry.id : null;
    const name = item?.title ?? (isObject(entry) && isText(entry.title) ? entry.title : '');
    const key = keyOf(elementKey({ trace_id: traceId, kind: 'row', name: id ?? name }));
    const where = whereText(isObject(entry) ? entry.where : undefined);
    if (item === null) {
      return { key, trace_id: traceId, kind: 'row', name, status: 'unreadable', detail: { status: '', links: [], where } };
    }
    const removed = isRemoved(item.status);
    return {
      key, trace_id: traceId, kind: 'row', name, status: removed ? 'removed' : null, detail: { status: item.status, links: item.links, where },
    };
  });
  return { elements: [...rows.filter((row) => row.status !== 'removed'), ...rows.filter((row) => row.status === 'removed')] };
}

// The names of items by their IDs, from the texts of item documents (/items/<stage>), for showing an item table's
// links by name (TASK-441): each item with an ID and a title that is not blank, the first of an ID winning. A text
// that is not a list adds nothing, and an item it cannot read adds nothing, so its links are shown by their IDs.
export function itemNames(texts) {
  const names = new Map();
  for (const text of texts) {
    if (!isText(text)) continue;
    let items;
    try {
      items = JSON.parse(text);
    } catch {
      continue;
    }
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (isObject(item) && isName(item.id) && isName(item.title) && !names.has(item.id)) names.set(item.id, item.title);
    }
  }
  return names;
}
