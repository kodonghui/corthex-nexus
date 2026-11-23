// Drawing a kept snapshot (TASK-419; SPEC-001, SPEC-005): its diagrams (TBL-151), a drawing of each from one
// snapshot (TBL-152) and each drawing's elements (TBL-153). TASK-418's intake keeps the snapshot and its documents and
// calls drawSnapshot once, in the push's transaction, before it answers (see snapshots.js). Each stage's drawer,
// TASK-421 to TASK-427, turns a document into elements and plugs in through DRAWERS below.
//
// Diagrams. A diagram is drawn from one document of the snapshot, and its source_key is that document's path in
// snapshot_files (TBL-150; see snapshot.js), so a drawing finds its source by the diagram alone:
// - stages 01, 05 and 07: one diagram per stage and part, /pictures/<stage> or /pictures/<stage>/<part>;
// - stages 03, 08 and 09: one diagram per file, its key, the file's path in the repository;
// - every other stage, and 03, 08 and 09 while no snapshot drew their pictures and the format does not carry them:
//   one item table per stage, /items/<stage> (SPEC-005).
// A diagram the snapshot does not hold gets removed_at, except a picture of a stage whose pictures the snapshot's
// format does not carry, which stays as last drawn: so a corthex-hub/0.2 snapshot after 0.3 pictures keeps them, each
// drawing's version naming the commit it comes from (SPEC-005). A stage's item table is not drawn once a snapshot drew
// the stage's pictures, so the first drawing of a stage's pictures removes it, and while the stage has pictures it never
// comes back. Any other removed diagram whose document a snapshot holds again comes back, the same row with its threads.
// A stage of 03, 08 or 09 whose format carries its pictures, but that has none and never had any, shows no diagram
// until TASK-423 says otherwise (note 3 of the WBS). A diagram's part is in its source_key for a stage's picture; the
// store's columns keep none for a file's picture (see the server's README).
//
// Drawings. Each diagram the snapshot holds is drawn again. Its drawing is new when its source_digest, which covers
// every document the drawer read, or what it drew differs from the diagram's last drawing; otherwise the diagram is
// unchanged and keeps that drawing, so a confirmation of it stays (SPEC-033). A drawing is drawn or failed: a drawer
// that cannot read its source throws SourceFailure, and the drawing keeps where, as failed_path and failed_line, with no
// elements, while the diagram shows its last good drawing (SPEC-001). A drawing reads the documents of its own snapshot
// only. What a drawing changes after it, confirmations, change sets and threads, is TASK-435's (note 14 of the WBS).
//
// Elements. A drawer returns a drawing's elements, each with a key that stays the same across drawings: the key the
// drawer gives, or else elementKey's (see below), so comments, positions and the diff follow an element from one
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
//   revision (API-242): then only the stages the newer format adds are drawn, from documents, the pictures it adds.
// - documents: the documents kept now, each { path, stage, part, key, kind, sha256, where } (see snapshot.js): kind is
//   picture, items or snapshot; key is the file's path for a picture of stage 03, 08 or 09, otherwise null; where is
//   the repository path it comes from. A document left out as REQ-077 asks is not among them.
// - earlier: for a completed revision, the push's other documents, which the revision kept before and this call does
//   not draw again, each { path, stage, part }; none otherwise.
// - time: the push's time, for created_at, drawn_at and removed_at.
// - drawers: the drawers by kind, DRAWERS unless a test gives its own.
// It returns what the push answer says of the drawing: { diagrams: { drawn, unchanged, failed, removed }, failures },
// failures as the contract's PushAnswer gives them. drawn counts the new drawings that drew, failed the diagrams whose
// source in the push fails, whether it changed or not, removed the diagrams this snapshot removed, and unchanged every
// other diagram that is not removed, those kept as last drawn included. A diagram this call does not draw again fails
// when its last drawing failed and earlier holds its source, as drawing it again would. It refuses nothing.
//
// A drawer: drawer({ stage, part, key, kind, source, text, read }) returns { name, elements }, at once (no promise).
// - stage, part, key: the document's (key null but for a file of stage 03, 08 or 09); kind: the diagram's kind.
// - source: the repository path the document comes from: the file's key, or the stage's source as the snapshot's stage
//   record names it.
// - text: the document's text as kept: a file's whole text (03, 08 and 09), the hub's parsed picture as JSON (01, 05
//   and 07) or the stage's items as a JSON array (an item table).
// - read(path): the text of another document of the same snapshot by its path, or null when it holds none. What it
//   reads joins the drawing's source_digest, so a change there draws the diagram again.
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
import { idOf } from './ids.js';

// The kind of diagram each picture stage draws. A stage that is not here shows its items as an item table, and so do
// 03, 08 and 09 while no snapshot drew their pictures and the format does not carry them (SPEC-005).
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
export const DRAWERS = Object.freeze({});

// The names a diagram has until its drawer names it, such as when its first drawing fails.
const NAMES = Object.freeze({ ddd_board: 'DDD board', erd: 'ERD', sitemap: 'Sitemap' });

// The contract's limits: Diagram's elements and name, Element's key, kind and status, a failure's where, PushAnswer's
// failures, and TraceId and ElementKey.
const MAX_ELEMENTS = 5000;
const MAX_NAME = 200;
const MAX_KEY = 200;
const MAX_KIND = 40;
const MAX_STATUS = 60;
const MAX_WHERE = 300;
const MAX_FAILURES = 500;
const MAX_TRACE_ID = 30;
const TRACE_ID = /^[A-Z][A-Z0-9]*-[0-9]{1,6}$/;
const ELEMENT_KEY = /^\S(?:.*\S)?$/;
const KIND = /^[a-z][a-z0-9_]*$/;
const CONTROL = /[\u0000-\u001f\u007f]/;
// A derived key longer than the contract allows keeps its start and ends with # and 16 hex digits of its SHA-256.
const HASHED = 16;

// What a drawer throws for a source it cannot read: where it failed, a path in the repository and a line, or neither
// for the document's own source. The drawing fails there, and the diagram keeps its last good drawing (SPEC-001).
export class SourceFailure extends Error {
  constructor({ path = null, line = null } = {}) {
    super('the source cannot be drawn');
    this.name = 'SourceFailure';
    this.path = path;
    this.line = line;
  }
}

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const characters = (text) => [...text].length;

// The first max characters of text; a longer text ends with an ellipsis.
function cut(text, max) {
  const all = [...text];
  return all.length <= max ? text : `${all.slice(0, max - 1).join('')}…`;
}

// The key an element has when its drawer gives none: its trace ID, or else its kind and name, white space made single
// spaces, under its parent's key, such as "lane:Owner/event:Snapshot accepted". So an element keeps its key across
// drawings while it keeps its trace ID, or its kind, name and parent, wherever it stands among the others. A key over
// 200 characters keeps its start and ends with # and part of its SHA-256. A drawer that names an element's parent by
// such a key works it out here.
export function elementKey({ trace_id: traceId = null, kind, name = '', parent = null }) {
  if (traceId !== null) return traceId;
  const own = `${kind}:${name.replace(/\s+/g, ' ').trim()}`;
  const key = parent === null ? own : `${parent}/${own}`;
  if (characters(key) <= MAX_KEY) return key;
  return `${[...key].slice(0, MAX_KEY - HASHED - 1).join('').trimEnd()}#${sha256(key).slice(0, HASHED)}`;
}

// key with #n after it, within the contract's length.
function numbered(key, n) {
  const suffix = `#${n}`;
  return characters(key) + suffix.length <= MAX_KEY ? `${key}${suffix}` : `${[...key].slice(0, MAX_KEY - suffix.length).join('').trimEnd()}${suffix}`;
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

// A failure's where, as the push answer and a drawing's failed_at give it: the path and its line, or the path alone
// when the two would be too long.
function whereOf({ path, line }) {
  if (line === null) return path;
  const where = `${path}:${line}`;
  return characters(where) <= MAX_WHERE ? where : path;
}

// Runs a drawer on a document: { status, digest, name, rows, failure }. The digest covers each document it read, its
// own included, by path and SHA-256 in the order of their paths.
function drawOne(statements, snapshotId, drawer, document, kind) {
  const reads = new Map();
  const read = (path) => {
    if (typeof path !== 'string') throw new TypeError('read takes a document\'s path');
    if (!reads.has(path)) reads.set(path, statements.document.get(snapshotId, path) ?? null);
    return reads.get(path)?.body ?? null;
  };
  const text = read(document.path);
  if (text === null) throw new Error('a kept document is in its snapshot');
  const digest = () => sha256(JSON.stringify([...reads].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([path, row]) => [path, row?.sha256 ?? null])));
  const { stage, part, key, where: source } = document;
  try {
    const result = drawer({ stage, part, key, kind, source, text, read });
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

// The kind of diagram a document is drawn as, or null when it draws none: a picture as its stage's picture, a stage's
// items as an item table while the stage shows one (SPEC-005).
function kindOf(document, carries, pictured) {
  if (document.kind === 'picture') return PICTURE_KINDS[document.stage] ?? null;
  if (document.kind !== 'items') return null;
  if (!Object.hasOwn(PICTURE_KINDS, document.stage)) return ITEM_TABLE;
  return FILE_STAGES.has(document.stage) && !carries.has(document.stage) && !pictured.has(document.stage) ? ITEM_TABLE : null;
}

function defaultName(kind, document) {
  if (Object.hasOwn(NAMES, kind)) return NAMES[kind];
  if (document.key !== null) return cut(document.key.split('/').at(-1), MAX_NAME);
  return document.stage;
}

const stageAndPath = (stage, path) => `${stage}\n${path}`;

// A failures entry of the push answer: the diagram, the part and stage of its document, and where it failed.
const failureEntry = (diagramId, document, failure) => ({
  diagram: idOf('dg', Number(diagramId)), part: document.part, stage: document.stage, where: whereOf(failure),
});

// Counts a diagram that is not removed and that this call does not draw again: failed, and named in failures, when its
// last drawing failed and the push holds its source, as drawing it again would find; otherwise unchanged. sent holds
// the push's documents by stage and path.
function countNotDrawn(diagram, sent, counts, failures) {
  const document = sent.get(stageAndPath(diagram.stage, diagram.source_key));
  if (diagram.status !== 'failed' || document === undefined) {
    counts.unchanged += 1;
    return;
  }
  counts.failed += 1;
  const line = diagram.failed_line === null ? null : Number(diagram.failed_line);
  failures.push(failureEntry(diagram.id, document, { path: diagram.failed_path, line }));
}

const sentBy = (documents) => new Map(documents.map((document) => [stageAndPath(document.stage, document.path), document]));

// Draws a kept snapshot (see the top of this file).
export function drawSnapshot({ store, project, snapshot, completed, documents, earlier = [], time, drawers = DRAWERS }) {
  checkDrawers(drawers);
  const statements = statementsOf(store);
  const carries = new Set(snapshot.carries);
  // A completed revision draws only the stages its newer format adds.
  const scope = completed ? new Set(snapshot.carries.filter((stage) => !snapshot.carried.includes(stage))) : null;
  const inScope = (stage) => scope === null || scope.has(stage);
  const diagrams = statements.diagrams.all(project.id);
  const bySource = new Map(diagrams.map((diagram) => [stageAndPath(diagram.stage, diagram.source_key), diagram]));
  const sent = sentBy(earlier);
  // The stages a snapshot drew pictures of, whose item tables made way for them.
  const pictured = new Set(diagrams.filter((diagram) => diagram.kind !== ITEM_TABLE).map((diagram) => diagram.stage));
  const counts = { drawn: 0, unchanged: 0, failed: 0, removed: 0 };
  const failures = [];
  const held = new Set();

  for (const document of documents) {
    if (!inScope(document.stage)) continue;
    const kind = kindOf(document, carries, pictured);
    const drawer = kind !== null && Object.hasOwn(drawers, kind) ? drawers[kind] : undefined;
    if (drawer === undefined) continue;
    const outcome = drawOne(statements, snapshot.id, drawer, document, kind);
    let diagram = bySource.get(stageAndPath(document.stage, document.path));
    if (diagram === undefined) {
      const { lastInsertRowid } = statements.insertDiagram.run(
        project.id, document.stage, document.path, kind, outcome.name ?? defaultName(kind, document), time,
      );
      diagram = { id: Number(lastInsertRowid), drawing: null, removed_at: null };
    } else {
      if (diagram.removed_at !== null) statements.restore.run(diagram.id);
      if (outcome.name !== null && outcome.name !== diagram.name) statements.rename.run(outcome.name, diagram.id);
    }
    held.add(diagram.id);
    const unchanged = sameAsLast(statements, diagram, outcome);
    if (!unchanged) {
      const { lastInsertRowid } = statements.insertDrawing.run(
        project.id, diagram.id, snapshot.id, snapshot.commit, outcome.status, outcome.digest,
        outcome.failure?.path ?? null, outcome.failure?.line ?? null, time,
      );
      for (const row of outcome.rows) statements.insertElement.run(Number(lastInsertRowid), ...row);
    }
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
      countNotDrawn(diagram, sent, counts, failures);
      continue;
    }
    statements.remove.run(time, diagram.id);
    counts.removed += 1;
  }
  return { diagrams: counts, failures: failures.slice(0, MAX_FAILURES) };
}

// What the push answer says of the drawing when the same commit comes again in the same or an older format, which
// draws nothing: documents are the push's, each { path, stage, part }. Every diagram that is not removed is unchanged,
// but one whose last drawing failed and whose source the push holds, which fails as the commit's first answer said.
export function heldDrawing({ store, project, documents }) {
  const counts = { drawn: 0, unchanged: 0, failed: 0, removed: 0 };
  const failures = [];
  const sent = sentBy(documents);
  for (const diagram of statementsOf(store).diagrams.all(project.id)) {
    if (diagram.removed_at === null) countNotDrawn(diagram, sent, counts, failures);
  }
  return { diagrams: counts, failures: failures.slice(0, MAX_FAILURES) };
}
