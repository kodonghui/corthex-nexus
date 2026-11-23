// Drawing a kept snapshot (TASK-419; SPEC-001, SPEC-005): its diagrams (TBL-151), a drawing of each from one
// snapshot (TBL-152) and each drawing's elements (TBL-153). TASK-418's intake keeps the snapshot and its documents and
// calls drawSnapshot once, in the push's transaction, before it answers (see snapshots.js). Each stage's drawer,
// TASK-421 to TASK-427, turns a document into elements and plugs in through DRAWERS below; what the drawers share,
// SourceFailure and elementKey among it, is drawer.js's, which they import in place of this file.
//
// Diagrams. A diagram is drawn from one document of the snapshot, and its source_key is that document's path in
// snapshot_files (TBL-150; see snapshot.js), so a drawing finds its source by the diagram alone:
// - stages 01, 05 and 07: one diagram per stage and part, /pictures/<stage> or /pictures/<stage>/<part>;
// - stages 03, 08 and 09: one diagram per file, its key, the file's path in the repository;
// - every other stage, and 03, 08 and 09 while they show no picture: one item table per stage, /items/<stage>
//   (SPEC-005), which snapshot.js keeps for each stage with items and each stage the hub read, an empty list for one
//   with none.
// A stage of 03, 08 or 09 shows no picture while it has no picture diagram that is not removed: under a format that
// carries its pictures, while the snapshot holds none of its files that a drawer draws; under one that does not, while
// every picture last drawn of it is removed (note 3 of the WBS, TASK-423). So its item table makes way for the first
// picture drawn of the stage, and comes back when the stage has none again.
// A diagram the snapshot does not hold gets removed_at, except a picture of a stage whose pictures the snapshot's
// format does not carry, which stays as last drawn: so a corthex-hub/0.2 snapshot after 0.3 pictures keeps them, each
// drawing's version naming the commit it comes from (SPEC-005). An item table that makes way gets removed_at and no new
// drawing: its last drawing keeps its rows, and its threads stay on them (SPEC-005, SPEC-027). drawSnapshot marks it
// madeWay in what it returns, so after-drawing.js moves none of its threads, while an item table removed otherwise,
// whose stage no snapshot reads any more, did not make way. A removed diagram whose document a snapshot draws again
// comes back, the same row with its threads, an item table that made way among them. A diagram's part is in its
// source_key for a stage's picture; the store's columns keep none for a file's picture (see the server's README).
//
// Left-out sources. A diagram whose source the snapshot leaves out is not removed (see snapshot.js): a document left
// out as REQ-077 asks names its diagram by its path, and a left_out entry names the picture of its part and stage, a
// file of stage 03, 08 or 09 by its key, or every file of its stage and part when it names none. The diagram keeps its
// last good drawing and gets a failed drawing at its source, with no line: the file's key, or the stage's source as
// the snapshot's stage record names it. As for any failed drawing, nothing moves and its confirmation and its stage's
// pass stay (see after-drawing.js), and the push counts it failed and names it in failures; a picture so kept still
// shows as its stage's picture, and the next push that sends its source draws it again. A left_out entry names no item
// table, and an item table that makes way for its stage's pictures still does. What the snapshot names only by a
// count, such as the files past the hub's limits, is removed as any source the snapshot does not hold. No approved
// document states this rule; the maintainer approved it through the delegate they named for checkpoints.
//
// Drawings. Each diagram the snapshot holds is drawn again. Its drawing is new when its source_digest, which covers
// every document the drawer read, or what it drew differs from the diagram's last drawing; otherwise the diagram is
// unchanged and keeps that drawing, so a confirmation of it stays (SPEC-033). A drawing is drawn or failed: a drawer
// that cannot read its source throws SourceFailure, and the drawing keeps where, as failed_path and failed_line, with no
// elements, while the diagram shows its last good drawing (SPEC-001). A drawing reads the documents of its own snapshot
// only. What a drawing changes after it, confirmations, change sets, threads and stage passes, is after-drawing.js's
// (TASK-435), which the push calls with what drawSnapshot changed.
//
// Elements. A drawer returns a drawing's elements, each with a key that stays the same across drawings: the key the
// drawer gives, or else elementKey's (see drawer.js), so comments, positions and the diff follow an element from one
// drawing to the next (TBL-153). A drawer that breaks this interface is a fault: the push answers internal and
// changes nothing. Nothing here logs; no source text, failure place or secret reaches a log line (rule 5).
//
// drawSnapshot(context) gets:
// - store: the store, in the push's transaction. Drawers do not wait (await): everything is written before the answer.
// - project: { id, name }, the project space's row key and name.
// - snapshot: { id, revision, commit, format, carries, carried }: the snapshot's row key, its revision and commit, the
//   format it came in, the picture stages that format carries, and those it carried before this call: none for a new
//   snapshot, the older format's when completed.
// - completed: false for a new snapshot; true when the same commit came again in a newer format, which completes its
//   revision (API-242): then only the stages the newer format adds are drawn: from documents, the pictures it adds, and
//   from earlier, those stages' items again, so that each item table shows or makes way as the pictures say.
// - documents: the documents kept now, each { path, stage, part, key, kind, sha256, where } (see snapshot.js): kind is
//   picture, items or snapshot; key is the file's path for a picture of stage 03, 08 or 09, otherwise null; where is
//   the repository path it comes from. A document left out as REQ-077 asks is not among them.
// - leftOut: the sources the push leaves out, each { stage, part, key, path, where } (see snapshot.js): a document
//   left out as REQ-077 asks, with its path, or a left_out entry, path null; none unless given.
// - earlier: for a completed revision, the push's other documents, which the revision kept before, each in the form of
//   documents; none otherwise. This call draws again only the items of the stages it draws that the revision keeps.
// - time: the push's time, for created_at, drawn_at and removed_at.
// - drawers: the drawers by kind, DRAWERS unless a test gives its own.
// It returns what the push answer says of the drawing, { diagrams: { drawn, unchanged, failed, removed }, failures },
// failures as the contract's PushAnswer gives them, and changed, what after-drawing.js needs: each diagram this call
// drew, kept as left out or removed, as { id, stage, kind, created, restored, removed, madeWay, drawing, status,
// digest }, drawing the
// key of its new drawing, or null when it kept its last one, with that drawing's status and source_digest; removed
// with madeWay for an item table that makes way for its stage's pictures (SPEC-005). drawn counts the new drawings that drew, failed the diagrams whose
// source in the push fails or is left out, whether it changed or not, removed the diagrams this snapshot removed, and
// unchanged every other diagram that is not removed, those kept as last drawn included. A diagram this call does not
// draw again fails when its last drawing failed and earlier holds its source, or the push leaves it out, as drawing it
// again would. It refuses nothing.
//
// A drawer: drawer({ stage, part, key, kind, source, text, read, warnings }) returns { name, elements }, at once (no
// promise).
// - stage, part, key: the document's (key null but for a file of stage 03, 08 or 09); kind: the diagram's kind.
// - source: the repository path the document comes from: the file's key, or the stage's source as the snapshot's stage
//   record names it.
// - text: the document's text as kept: a file's whole text (03, 08 and 09), the hub's parsed picture as JSON (01, 05
//   and 07) or the stage's items as a JSON array (an item table).
// - read(path): the text of another document of the same snapshot by its path, or null when it holds none. What it
//   reads joins the drawing's source_digest, so a change there draws the diagram again.
// - warnings: for a stage's picture (01, 05 and 07), what the hub left out of it: the hub's picture-partial checks of
//   the picture's stage and part, from the snapshot's checks that /snapshot keeps (see pictureWarnings below), each
//   { path, line, detail }: path and line where the hub found it, each null when the hub names none, and detail what it
//   says. Any other document has none. When the drawer reads them and there are any, they join the drawing's
//   source_digest, as the documents it reads do.
// - name: optional, the diagram's name, up to 200 characters.
// - elements: up to 5000, each { key, trace_id, kind, name, parent, status, detail }: kind a lowercase word of up to 40
//   characters, such as table, line or token; name text, cut to 200 characters, '' when it has none (SPEC-010);
//   trace_id, key and parent optional, a trace ID and element keys of the contract's forms, parent the key of another
//   element of the drawing; status optional, up to 60 characters; detail optional, a JSON object of what the kind draws.
//   An optional member left out or null has none, and a detail of none is {}.
//   More elements than 5000 fail the drawing at its source.
// - It throws new SourceFailure({ path, line }) for a source it cannot read: path a repository path, the document's
//   source when left out, and line a line number or none. Any other error is a fault.

import { createHash } from 'node:crypto';
import { dddBoard } from './ddd-board.js';
import {
  characters, CONTROL, elementKey, failureWhere, isObject, MAX_ELEMENTS, MAX_KEY, MAX_TRACE_ID, MAX_WHERE, numbered, SourceFailure,
  TRACE_ID,
} from './drawer.js';
import { erd } from './erd.js';
import { idOf } from './ids.js';
import { itemTable } from './item-table.js';
import { mockup } from './mockup.js';
import { screenStates } from './screen-states.js';
import { sitemap } from './sitemap.js';
import { diagramPart } from './todo.js';
import { userFlow } from './user-flow.js';

// A drawer's failure and the keys it works out are drawer.js's, which the drawers import in place of this file.
export { elementKey, SourceFailure };

// The kind of diagram each picture stage draws. A stage that is not here shows its items as an item table, and so do
// 03, 08 and 09 while they show no picture (SPEC-005; see the top of this file).
const PICTURE_KINDS = Object.freeze({
  '01-domain': 'ddd_board',
  '03-user-flow': 'user_flow',
  '05-erd': 'erd',
  '07-sitemap': 'sitemap',
  '08-screen-states': 'screen_states',
  '09-mockup': 'mockup',
});
const FILE_STAGES = new Set(['03-user-flow', '08-screen-states', '09-mockup']);
const ITEM_TABLE = 'item_table';
// TBL-151's kinds.
export const KINDS = Object.freeze([...Object.values(PICTURE_KINDS), ITEM_TABLE]);

// The drawers, by kind of diagram (see the top of this file). Each drawing task adds its own: ddd_board TASK-421, erd
// TASK-422, item_table TASK-423, user_flow TASK-424, sitemap TASK-425, screen_states TASK-426 and mockup TASK-427.
// A kind without a drawer is not drawn: its documents make no diagram.
export const DRAWERS = Object.freeze({ ddd_board: dddBoard, erd, mockup, sitemap, item_table: itemTable, user_flow: userFlow, screen_states: screenStates });

// The names a diagram has until its drawer names it, such as when its first drawing fails.
const NAMES = Object.freeze({ ddd_board: 'DDD board', erd: 'ERD', sitemap: 'Sitemap', item_table: 'Item table' });

// A trace ID at the start of a name, as the hub reads the ID that leads a heading (its IdIndex.lead): after any white
// space, *, _, `, ~, [ or (, an ID of the contract's form, drawer.js's TRACE_ID, that no letter, digit or _ follows.
const LEADING_TRACE_ID = new RegExp(String.raw`^[\s*_\x60~[(]*(${TRACE_ID.source.replace(/^\^|\$$/g, '')})(?![0-9A-Za-z_])`);

// The trace ID a file diagram holds as a whole, the one it is named by, or null (SPEC-016; see the server's README): a
// diagram of stage 03, 08 or 09 that is a file's, not the stage's item table, holds the trace ID its name starts with.
// Its name is its drawer's: the file's first heading for a user flow or a screen, such as "FL-005 Reflect accepted
// changes into Git" or "SCR-143 Projects", or the file's name until a drawer names it, such as "SCR-143.md", which
// starts with the same ID. The name is the one the page shows and what an agent reads, and the diagram row keeps it, so
// no source is read again; a failed drawing leaves it as it was. A name with no ID at its start, such as the mockup's
// "nexus-mockup.html", holds none.
export function diagramTraceId({ stage, kind, name }) {
  if (!FILE_STAGES.has(stage) || kind === ITEM_TABLE || typeof name !== 'string') return null;
  return LEADING_TRACE_ID.exec(name)?.[1] ?? null;
}

// The contract's limits besides drawer.js's: Diagram's name, Element's kind and status, and PushAnswer's failures; and
// ElementKey's form.
const MAX_NAME = 200;
const MAX_KIND = 40;
const MAX_STATUS = 60;
const MAX_FAILURES = 500;
const ELEMENT_KEY = /^\S(?:.*\S)?$/;
const KIND = /^[a-z][a-z0-9_]*$/;
// The snapshot's rest, which keeps its checks as they came (see snapshot.js), and the name that the warnings a drawer
// was given take in its source_digest. No document has that name: NEXUS names none of its own so, and a key never
// starts with /.
const REST = '/snapshot';
const WARNINGS = '/snapshot#picture-partial';
// A drawer gets at most as many warnings as the push answer names failures.
const MAX_WARNINGS = 500;
// The hub's picture-partial message: "<path>:<line>: <detail>", or "<path>: <detail>" for a whole file. The path ends
// at the first colon and is the path of a picture source, a file the hub reads for stage 01, 05 or 07 (.md,
// .markdown, .sql, .yaml or .yml), so a message that starts with other words, or whose detail holds a colon and a
// number, never gets a path or line it does not name, while a path with a space keeps its own.
const AT_PATH = /^([^:]+):(?:([1-9][0-9]{0,8}):)? (.*)$/s;
const FILE_NAME = /(?:^|\/)[^/]*[^/\s]\.(?:md|markdown|sql|ya?ml)$/i;
const NONE = Object.freeze([]);

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

// The first max characters of text; a longer text ends with an ellipsis.
function cut(text, max) {
  const all = [...text];
  return all.length <= max ? text : `${all.slice(0, max - 1).join('')}…`;
}

// Checks the drawers by kind: known kinds, each a function.
export function checkDrawers(drawers) {
  if (!isObject(drawers)) throw new TypeError('drawers are an object of drawers by kind');
  for (const [kind, drawer] of Object.entries(drawers)) {
    if (!KINDS.includes(kind)) throw new TypeError('a drawer is for a kind of diagram TBL-151 names');
    if (typeof drawer !== 'function') throw new TypeError('a drawer is a function');
  }
  return drawers;
}

// The statements of each store, prepared on first use (see credentials.js).
const prepared = new WeakMap();

function statementsOf(store) {
  let statements = prepared.get(store);
  if (statements === undefined) {
    statements = {
      // Each diagram of the project with its last drawing.
      diagrams: store.prepare(
        `SELECT d.id, d.stage, d.source_key, d.kind, d.name, d.removed_at,
                w.id AS drawing, w.status, w.source_digest, w.failed_path, w.failed_line
         FROM diagrams d LEFT JOIN drawings w ON w.id = (SELECT max(id) FROM drawings WHERE diagram_id = d.id)
         WHERE d.project_id = ? ORDER BY d.id`,
      ),
      document: store.prepare(
        `SELECT b.body, b.sha256 FROM snapshot_files f JOIN document_blobs b ON b.sha256 = f.blob_sha256
         WHERE f.snapshot_id = ? AND f.path = ?`,
      ),
      insertDiagram: store.prepare(
        'INSERT INTO diagrams (project_id, stage, source_key, kind, name, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ),
      rename: store.prepare('UPDATE diagrams SET name = ? WHERE id = ?'),
      restore: store.prepare('UPDATE diagrams SET removed_at = NULL WHERE id = ?'),
      remove: store.prepare('UPDATE diagrams SET removed_at = ? WHERE id = ?'),
      insertDrawing: store.prepare(
        `INSERT INTO drawings (project_id, diagram_id, snapshot_id, document_version, status, source_digest, failed_path,
                               failed_line, drawn_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ),
      elements: store.prepare(
        'SELECT element_key, trace_id, kind, name, parent_key, status, detail FROM elements WHERE drawing_id = ? ORDER BY id',
      ),
      insertElement: store.prepare(
        'INSERT INTO elements (drawing_id, element_key, trace_id, kind, name, parent_key, status, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ),
      // Whether a snapshot keeps a document of that path.
      keeps: store.prepare('SELECT 1 FROM snapshot_files WHERE snapshot_id = ? AND path = ?'),
    };
    prepared.set(store, statements);
  }
  return statements;
}

// An optional text: null when left out, otherwise text of 1 to max characters in form.
function optionalText(value, field, max, form) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length === 0 || characters(value) > max || (form !== undefined && !form.test(value))) {
    throw new TypeError(`${field} must be null or its form's text`);
  }
  return value;
}

// The elements a drawer returned, checked and keyed: each { key, trace_id, kind, name, parent, status, detail }, with
// detail as JSON text, as the store keeps them.
function elementsOf(elements) {
  const rows = elements.map((element, index) => {
    const at = `elements[${index}]`;
    if (!isObject(element)) throw new TypeError(`${at} must be an object`);
    const { kind, name } = element;
    const detail = element.detail ?? {};
    if (typeof kind !== 'string' || kind.length > MAX_KIND || !KIND.test(kind)) throw new TypeError(`${at}.kind must be a lowercase word`);
    if (typeof name !== 'string') throw new TypeError(`${at}.name must be text`);
    if (!isObject(detail)) throw new TypeError(`${at}.detail must be an object`);
    let text;
    try {
      text = JSON.stringify(detail);
    } catch {
      throw new TypeError(`${at}.detail must be JSON`);
    }
    return {
      key: optionalText(element.key, `${at}.key`, MAX_KEY, ELEMENT_KEY),
      trace_id: optionalText(element.trace_id, `${at}.trace_id`, MAX_TRACE_ID, TRACE_ID),
      kind,
      name,
      parent: optionalText(element.parent, `${at}.parent`, MAX_KEY, ELEMENT_KEY),
      status: optionalText(element.status, `${at}.status`, MAX_STATUS),
      detail: text,
    };
  });
  // The keys the drawer gives first, then those worked out, each in its order: a worked-out key another element has
  // gets #2, #3 and so on.
  const keys = new Set();
  for (const row of rows) {
    if (row.key === null) continue;
    if (keys.has(row.key)) throw new TypeError('two elements of a drawing have one key');
    keys.add(row.key);
  }
  for (const row of rows) {
    if (row.key !== null) continue;
    const base = elementKey(row);
    let key = base;
    for (let n = 2; keys.has(key); n += 1) key = numbered(base, n);
    row.key = key;
    keys.add(key);
  }
  for (const row of rows) {
    if (row.parent !== null && (row.parent === row.key || !keys.has(row.parent))) {
      throw new TypeError('an element\'s parent must be another element of the drawing');
    }
    row.name = cut(row.name, MAX_NAME);
  }
  return rows.map(({ key, trace_id: traceId, kind, name, parent, status, detail }) => [key, traceId, kind, name, parent, status, detail]);
}

// Where a drawing failed, from its SourceFailure: { path, line }, the document's source when it names no path.
function failureOf(error, source) {
  const path = error.path ?? source;
  const { line = null } = error;
  if (typeof path !== 'string' || path.length === 0 || characters(path) > MAX_WHERE || CONTROL.test(path)) {
    throw new TypeError('a SourceFailure names a repository path of up to 300 characters');
  }
  if (line !== null && !(Number.isSafeInteger(line) && line >= 1)) throw new TypeError('a SourceFailure names a line number or none');
  return { path, line };
}

// Whether text is a path in the repository as Git lists it, of up to 300 characters (see snapshot.js).
function isRepositoryPath(text) {
  return characters(text) <= MAX_WHERE && !CONTROL.test(text) && !text.includes('\\')
    && text.split('/').every((name) => name !== '' && name !== '.' && name !== '..');
}

// A picture-partial message as { path, line, detail }: the repository path and the line it starts with, each null
// when it names none, and the rest. A message that starts with no path is all detail.
function warningOf(message) {
  const found = AT_PATH.exec(message);
  const path = found?.[1];
  if (found === null || path.trim() !== path || !FILE_NAME.test(path) || !isRepositoryPath(path)) {
    return Object.freeze({ path: null, line: null, detail: message });
  }
  return Object.freeze({ path, line: found[2] === undefined ? null : Number(found[2]), detail: found[3] });
}

// The warnings of a stage's picture, from a snapshot's checks: the hub's picture-partial checks of the stage that name
// the picture's part or none, in their order, up to 500, each as { path, line, detail }. The hub adds one for each
// statement or entry it leaves out of a picture, naming the picture's part when it has one, and one for a source file
// it could not read, naming none.
export function pictureWarnings(checks, stage, part) {
  if (!Array.isArray(checks)) return NONE;
  return Object.freeze(checks
    .filter((check) => isObject(check) && check.rule === 'picture-partial' && check.stage === stage && typeof check.message === 'string'
      && ((check.part ?? '') === '' || check.part === part))
    .slice(0, MAX_WARNINGS)
    .map((check) => warningOf(check.message)));
}

// The checks a snapshot's rest keeps, a list.
function checksOf(statements, snapshotId) {
  const row = statements.document.get(snapshotId, REST);
  const checks = row === undefined ? null : JSON.parse(row.body).checks;
  return Array.isArray(checks) ? checks : [];
}

// Runs a drawer on a document: { status, digest, name, rows, failure }. The digest covers each document it read, its
// own included, by path and SHA-256 in the order of their paths, and the warnings when it read them and there are any,
// so that a drawer that draws no warnings is not drawn again when only they change.
function drawOne(statements, snapshotId, drawer, document, kind, warnings) {
  const reads = new Map();
  const read = (path) => {
    if (typeof path !== 'string') throw new TypeError('read takes a document\'s path');
    if (!reads.has(path)) reads.set(path, statements.document.get(snapshotId, path) ?? null);
    return reads.get(path)?.body ?? null;
  };
  const text = read(document.path);
  if (text === null) throw new Error('a kept document is in its snapshot');
  let warned = false;
  const digest = () => {
    const entries = [...reads].map(([path, row]) => [path, row?.sha256 ?? null]);
    if (warned && warnings.length > 0) entries.push([WARNINGS, sha256(JSON.stringify(warnings))]);
    return sha256(JSON.stringify(entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))));
  };
  const { stage, part, key, where: source } = document;
  try {
    const result = drawer({
      stage,
      part,
      key,
      kind,
      source,
      text,
      read,
      // Read when the drawer takes them, as read() notes the documents it reads.
      get warnings() {
        warned = true;
        return warnings;
      },
    });
    if (!isObject(result) || !Array.isArray(result.elements)) throw new TypeError('a drawer returns { name, elements }');
    if (result.name !== undefined && result.name !== null && typeof result.name !== 'string') throw new TypeError('a diagram\'s name is text');
    // A drawing that fails names nothing: the diagram keeps its name with its last good drawing.
    if (result.elements.length > MAX_ELEMENTS) {
      return { status: 'failed', digest: digest(), name: null, rows: [], failure: { path: source, line: null } };
    }
    const name = typeof result.name === 'string' && result.name.trim() !== '' ? cut(result.name, MAX_NAME) : null;
    return { status: 'drawn', digest: digest(), name, rows: elementsOf(result.elements), failure: null };
  } catch (error) {
    if (!(error instanceof SourceFailure)) throw error;
    return { status: 'failed', digest: digest(), name: null, rows: [], failure: failureOf(error, source) };
  }
}

// Whether a drawer's outcome is the diagram's last drawing: the same documents read, and the same elements drawn or
// the same failure.
function sameAsLast(statements, diagram, outcome) {
  if (diagram.drawing === null || diagram.source_digest !== outcome.digest || diagram.status !== outcome.status) return false;
  if (outcome.status === 'failed') {
    return diagram.failed_path === outcome.failure.path && (diagram.failed_line === null ? null : Number(diagram.failed_line)) === outcome.failure.line;
  }
  const last = statements.elements.all(diagram.drawing)
    .map((row) => [row.element_key, row.trace_id, row.kind, row.name, row.parent_key, row.status, row.detail]);
  return JSON.stringify(last) === JSON.stringify(outcome.rows);
}

// Keeps a drawer's outcome as the diagram's new drawing, with its elements, unless it is the diagram's last drawing
// again (sameAsLast). Returns the new drawing's key, or null when the diagram keeps its last one.
function keepDrawing(statements, { project, snapshot, diagram, outcome, time }) {
  if (sameAsLast(statements, diagram, outcome)) return null;
  const { lastInsertRowid } = statements.insertDrawing.run(
    project.id, diagram.id, snapshot.id, snapshot.commit, outcome.status, outcome.digest,
    outcome.failure?.path ?? null, outcome.failure?.line ?? null, time,
  );
  const drawing = Number(lastInsertRowid);
  for (const row of outcome.rows) statements.insertElement.run(drawing, ...row);
  return drawing;
}

// A where the store and the contract keep (up to 300 characters, no control character), or else fallback.
const whereOr = (text, fallback) => (
  typeof text === 'string' && text !== '' && characters(text) <= MAX_WHERE && !CONTROL.test(text) ? text : fallback
);

// Finds the diagrams whose source the push leaves out (see the top of this file). Returns diagram → { part, where } or
// null: the part the push answer names and where the drawing fails, the file's key for a file and otherwise the
// source as the push names it.
function leftOutFinder(store, leftOut) {
  const byPath = new Map();
  const byStage = new Map();
  for (const source of leftOut) {
    if (source.path !== null) {
      byPath.set(stageAndPath(source.stage, source.path), source);
    } else {
      if (!byStage.has(source.stage)) byStage.set(source.stage, []);
      byStage.get(source.stage).push(source);
    }
  }
  const parts = new Map();
  return (diagram) => {
    const fallback = FILE_STAGES.has(diagram.stage) && diagram.kind !== ITEM_TABLE ? diagram.source_key : diagram.stage;
    const document = byPath.get(stageAndPath(diagram.stage, diagram.source_key));
    if (document !== undefined) return { part: document.part, where: whereOr(document.where, fallback) };
    const entries = byStage.get(diagram.stage);
    if (entries === undefined || diagram.kind === ITEM_TABLE) return null;
    const file = FILE_STAGES.has(diagram.stage);
    const part = diagramPart(store, diagram, parts);
    const entry = entries.find((each) => each.part === part && (!file || each.key === null || each.key === diagram.source_key));
    return entry === undefined ? null : { part, where: file ? diagram.source_key : whereOr(entry.where, fallback) };
  };
}

// The outcome of a diagram whose source the push leaves out: a failed drawing at where, with no line, that read no
// document. Its digest names the source's path as absent, which no drawing that read it has.
function leftOutOutcome(diagram, where) {
  return {
    status: 'failed', digest: sha256(JSON.stringify([[diagram.source_key, null]])), name: null, rows: [], failure: { path: where, line: null },
  };
}

// The kind of diagram a document is drawn as, or null when it draws none: a picture as its stage's picture, a stage's
// items as an item table while the stage shows one (SPEC-005): a stage without pictures, or one of 03, 08 and 09 that
// shows none (pictured, see the top of this file).
function kindOf(document, pictured) {
  if (document.kind === 'picture') return PICTURE_KINDS[document.stage] ?? null;
  if (document.kind !== 'items') return null;
  if (!Object.hasOwn(PICTURE_KINDS, document.stage)) return ITEM_TABLE;
  return FILE_STAGES.has(document.stage) && !pictured.has(document.stage) ? ITEM_TABLE : null;
}

function defaultName(kind, document) {
  if (Object.hasOwn(NAMES, kind)) return NAMES[kind];
  if (document.key !== null) return cut(document.key.split('/').at(-1), MAX_NAME);
  return document.stage;
}

const stageAndPath = (stage, path) => `${stage}\n${path}`;

// A failures entry of the push answer: the diagram, the part and stage of its document, and where it failed.
const failureEntry = (diagramId, document, failure) => ({
  diagram: idOf('dg', Number(diagramId)), part: document.part, stage: document.stage, where: failureWhere(failure),
});

// Counts a diagram that is not removed and that this call does not draw again: failed, and named in failures, when its
// last drawing failed and the push holds its source or leaves it out, as drawing it again would find; otherwise
// unchanged. sent holds the push's documents by stage and path, and leftOutOf finds a source the push leaves out.
function countNotDrawn(diagram, sent, leftOutOf, counts, failures) {
  const document = diagram.status === 'failed' ? sent.get(stageAndPath(diagram.stage, diagram.source_key)) ?? leftOutOf(diagram) : null;
  if (document === null) {
    counts.unchanged += 1;
    return;
  }
  counts.failed += 1;
  const line = diagram.failed_line === null ? null : Number(diagram.failed_line);
  failures.push(failureEntry(diagram.id, { part: document.part, stage: diagram.stage }, { path: diagram.failed_path, line }));
}

const sentBy = (documents) => new Map(documents.map((document) => [stageAndPath(document.stage, document.path), document]));

// Draws a kept snapshot (see the top of this file).
export function drawSnapshot({ store, project, snapshot, completed, documents, earlier = [], leftOut = [], time, drawers = DRAWERS }) {
  checkDrawers(drawers);
  const statements = statementsOf(store);
  const carries = new Set(snapshot.carries);
  // A completed revision draws only the stages its newer format adds.
  const scope = completed ? new Set(snapshot.carries.filter((stage) => !snapshot.carried.includes(stage))) : null;
  const inScope = (stage) => scope === null || scope.has(stage);
  const diagrams = statements.diagrams.all(project.id);
  const bySource = new Map(diagrams.map((diagram) => [stageAndPath(diagram.stage, diagram.source_key), diagram]));
  const sent = sentBy(earlier);
  const leftOutOf = leftOutFinder(store, leftOut);
  const drawsPictures = (stage) => inScope(stage) && carries.has(stage);
  // The pictures this call keeps as left out, by diagram: those not removed of a stage it draws whose source the push
  // does not send and leaves out (see the top of this file).
  const sending = new Set(documents.map((document) => stageAndPath(document.stage, document.path)));
  const keptOut = new Map();
  for (const diagram of diagrams) {
    if (diagram.kind === ITEM_TABLE || diagram.removed_at !== null || !drawsPictures(diagram.stage)) continue;
    if (sending.has(stageAndPath(diagram.stage, diagram.source_key))) continue;
    const found = leftOutOf(diagram);
    if (found !== null) keptOut.set(diagram.id, found);
  }
  // The stages of 03, 08 and 09 that show a picture after this call, whose item tables make way (see the top of this
  // file): a stage this call draws under a format that carries its pictures, when it draws one of its files or keeps
  // one as left out; any other, when it has a picture diagram that is not removed, which this call keeps as last drawn.
  const pictured = new Set([
    ...documents.filter((document) => document.kind === 'picture' && drawsPictures(document.stage)
      && Object.hasOwn(drawers, PICTURE_KINDS[document.stage] ?? '')).map((document) => document.stage),
    ...diagrams.filter((diagram) => keptOut.has(diagram.id)).map((diagram) => diagram.stage),
    ...diagrams.filter((diagram) => diagram.kind !== ITEM_TABLE && diagram.removed_at === null && !drawsPictures(diagram.stage))
      .map((diagram) => diagram.stage),
  ]);
  const counts = { drawn: 0, unchanged: 0, failed: 0, removed: 0 };
  const failures = [];
  const changed = [];
  const held = new Set();
  // The warnings of a stage's picture (01, 05 and 07), from the snapshot's checks, read once, when the first such
  // picture is drawn; any other document has none.
  let checks = null;
  const warningsOf = (document) => {
    if (document.kind !== 'picture' || document.key !== null) return NONE;
    checks ??= checksOf(statements, snapshot.id);
    return pictureWarnings(checks, document.stage, document.part);
  };

  // A completed revision draws again the items of the stages it draws, those it kept before: an older push may not
  // have kept them, such as a stage its hub did not read.
  const kept = (document) => statements.keeps.get(snapshot.id, document.path) !== undefined;
  const toDraw = completed
    ? [...documents, ...earlier.filter((document) => document.kind === 'items' && inScope(document.stage) && kept(document))]
    : documents;
  for (const document of toDraw) {
    if (!inScope(document.stage)) continue;
    const kind = kindOf(document, pictured);
    const drawer = kind !== null && Object.hasOwn(drawers, kind) ? drawers[kind] : undefined;
    if (drawer === undefined) continue;
    const outcome = drawOne(statements, snapshot.id, drawer, document, kind, warningsOf(document));
    let diagram = bySource.get(stageAndPath(document.stage, document.path));
    const created = diagram === undefined;
    const restored = !created && diagram.removed_at !== null;
    if (created) {
      const { lastInsertRowid } = statements.insertDiagram.run(
        project.id, document.stage, document.path, kind, outcome.name ?? defaultName(kind, document), time,
      );
      diagram = { id: Number(lastInsertRowid), drawing: null, removed_at: null };
    } else {
      if (diagram.removed_at !== null) statements.restore.run(diagram.id);
      if (outcome.name !== null && outcome.name !== diagram.name) statements.rename.run(outcome.name, diagram.id);
    }
    held.add(diagram.id);
    const drawing = keepDrawing(statements, { project, snapshot, diagram, outcome, time });
    const unchanged = drawing === null;
    changed.push({
      id: Number(diagram.id), stage: document.stage, kind, created, restored, removed: false, madeWay: false, drawing,
      status: outcome.status, digest: outcome.digest,
    });
    if (outcome.status === 'failed') {
      counts.failed += 1;
      failures.push(failureEntry(diagram.id, document, outcome.failure));
    } else {
      counts[unchanged ? 'unchanged' : 'drawn'] += 1;
    }
  }

  for (const diagram of diagrams) {
    if (held.has(diagram.id) || diagram.removed_at !== null) continue;
    // A diagram this call does not draw, or a picture the format does not carry, kept as last drawn (SPEC-005).
    if (!inScope(diagram.stage) || (diagram.kind !== ITEM_TABLE && !carries.has(diagram.stage))) {
      countNotDrawn(diagram, sent, leftOutOf, counts, failures);
      continue;
    }
    // An item table makes way when its stage shows a picture after this call (pictured); one removed otherwise, whose
    // stage no snapshot reads any more, did not, and SPEC-027 moves its threads.
    const madeWay = diagram.kind === ITEM_TABLE && pictured.has(diagram.stage);
    // A source the push leaves out keeps its diagram, with a failed drawing at its source (see the top of this file).
    const left = diagram.kind === ITEM_TABLE ? (madeWay ? null : leftOutOf(diagram)) : keptOut.get(diagram.id) ?? null;
    if (left !== null) {
      const outcome = leftOutOutcome(diagram, left.where);
      const drawing = keepDrawing(statements, { project, snapshot, diagram, outcome, time });
      changed.push({
        id: Number(diagram.id), stage: diagram.stage, kind: diagram.kind, created: false, restored: false, removed: false, madeWay: false,
        drawing, status: outcome.status, digest: outcome.digest,
      });
      counts.failed += 1;
      failures.push(failureEntry(diagram.id, { part: left.part, stage: diagram.stage }, outcome.failure));
      continue;
    }
    statements.remove.run(time, diagram.id);
    counts.removed += 1;
    changed.push({
      id: Number(diagram.id), stage: diagram.stage, kind: diagram.kind, created: false, restored: false, removed: true, madeWay,
      drawing: null, status: null, digest: null,
    });
  }
  return { diagrams: counts, failures: failures.slice(0, MAX_FAILURES), changed };
}

// What the push answer says of the drawing when the same commit comes again in the same or an older format, which
// draws nothing: documents are the push's, each { path, stage, part }, and leftOut the sources it leaves out. Every
// diagram that is not removed is unchanged, but one whose last drawing failed and whose source the push holds or leaves
// out, which fails as the commit's first answer said.
export function heldDrawing({ store, project, documents, leftOut = [] }) {
  const counts = { drawn: 0, unchanged: 0, failed: 0, removed: 0 };
  const failures = [];
  const sent = sentBy(documents);
  const leftOutOf = leftOutFinder(store, leftOut);
  for (const diagram of statementsOf(store).diagrams.all(project.id)) {
    if (diagram.removed_at === null) countNotDrawn(diagram, sent, leftOutOf, counts, failures);
  }
  return { diagrams: counts, failures: failures.slice(0, MAX_FAILURES) };
}
