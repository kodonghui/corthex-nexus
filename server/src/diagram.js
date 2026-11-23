// The diagram read (TASK-441; API-265, SPEC-003 to SPEC-012, SPEC-022, SPEC-027, SPEC-034, SPEC-051): one diagram or
// item table as the owner's workbench shows it (SCR-145) and the list of changes since its confirmation (SCR-146). A
// read writes nothing and logs nothing; the project's text is in the answer only (rule 5). The same answer serves a PC
// and a phone (SPEC-051): what a phone does not offer is the page's.
//
// The answer is the contract's Diagram:
// - the diagram (TBL-151): its ID, project, part, stage, kind and name, and whether a snapshot removed it. Its part is
//   found as the agent to-do finds it (todo.js's diagramPart).
// - drawing: its latest drawing (TBL-152), drawn or failed, with the revision of the snapshot it comes from (TBL-148)
//   and, when it failed, where (SPEC-001). last_drawn: when it failed, the last drawing that drew, or null when none did.
// - elements: those of the drawing the diagram shows (TBL-153), the current one or, when it failed, the last good one,
//   in the drawer's order and by name (SPEC-010, SPEC-011). Each has a position: where the owner put it (TBL-154,
//   SPEC-012), else the top left corner of its box, else null, as for a token, a line or an entry left out. A row of an
//   item table gives each link as { id, name }, its name from the project's latest item documents (item-table.js's
//   itemNames), '' when none is found, so the page shows its ID (SPEC-010).
// - overlays: the AI proposals and accepted change sets of the diagram (TBL-158, TBL-159), newest first (SPEC-022): an
//   accepted one by when it was accepted (decided_at), the order the reflection applies them in (entries.js), so the
//   later accepted is on top (TASK-445), and a proposal by when it was made. Each comes with its pull request (TBL-157)
//   and, once accepted, the reflection entry of the agent to-do that holds it (TBL-166).
// - since_confirmation: what changed from the drawing of the diagram's latest confirmation, whatever its state, to the
//   drawing it shows (SPEC-034); null when it was never confirmed. confirmation: that latest confirmation (TBL-160).
// - threads: the diagram's threads (TBL-155), open ones first, then closed, each oldest first, with how many entries
//   each has and when the last was written (TBL-156); a thread whose element left keeps its key and is marked with the
//   element's last name (SPEC-027).
//
// A removed diagram is answered only while it has an open thread, as the project read lists it (SPEC-027): it opens
// for its threads only, which the page holds to. One whose threads are all closed answers diagram_not_found, as an ID
// no diagram of the project has (note 10 of the WBS). So does one of a stage the contract does not name, which the
// project read does not list either.

import { pullRequestLink } from './claims.js';
import { confirmationBody } from './confirmations.js';
import { failureWhere } from './drawer.js';
import { idOf, keyOf } from './ids.js';
import { itemNames } from './item-table.js';
import { Problem } from './problem.js';
import { STAGES } from './snapshot.js';
import { diagramPart } from './todo.js';

// The contract's limits: Diagram's elements, overlays and threads; ChangeSet's items, adds and changes; the length of
// ChangeSet's reason and change; Change's name and ThreadBrief's removed_name; ThreadBrief's entries; and Element's
// position.
const LISTED_ELEMENTS = 5000;
const LISTED_OVERLAYS = 500;
const LISTED_THREADS = 5000;
const LISTED_IDS = 50;
const LISTED_CHANGES = 500;
const TEXT_LENGTH = 4000;
const NAME_LENGTH = 200;
const ENTRIES = 100_000;
const FAR = 1_000_000;
const TRACE_ID = /^[A-Z][A-Z0-9]*-[0-9]{1,6}$/;
const TRACE_ID_LENGTH = 30;
const STAGE_SET = new Set(STAGES);
// What an element's detail holds that is not what the document says: where it is drawn and its file and line. A
// change in them alone does not mark the element changed (SPEC-034).
const PLACING = new Set(['box', 'points', 'where']);

// The statements of each store, prepared on first use (see credentials.js).
const prepared = new WeakMap();

// The change sets the overlays list, as a condition on change_sets under the alias c.
const LISTED_SETS = "c.state IN ('proposed', 'accepted')";

const DRAWING = `SELECT w.id, w.status, w.document_version, w.failed_path, w.failed_line, w.drawn_at, s.revision
                 FROM drawings w JOIN snapshots s ON s.id = w.snapshot_id`;

function statementsOf(store) {
  let statements = prepared.get(store);
  if (statements === undefined) {
    statements = {
      project: store.prepare('SELECT id, name, repository, held_commit FROM project_spaces WHERE name = ?'),
      diagram: store.prepare(
        `SELECT d.id, d.stage, d.source_key, d.kind, d.name, d.removed_at,
                EXISTS (SELECT 1 FROM comment_threads h WHERE h.diagram_id = d.id AND h.state = 'open') AS open_threads
         FROM diagrams d WHERE d.id = ? AND d.project_id = ?`,
      ),
      // The latest drawing, and the latest that drew.
      current: store.prepare(`${DRAWING} WHERE w.diagram_id = ? ORDER BY w.id DESC LIMIT 1`),
      lastDrawn: store.prepare(`${DRAWING} WHERE w.diagram_id = ? AND w.status = 'drawn' ORDER BY w.id DESC LIMIT 1`),
      elements: store.prepare(
        `SELECT element_key, trace_id, kind, name, parent_key, status, detail FROM elements WHERE drawing_id = ?
         ORDER BY id LIMIT ${LISTED_ELEMENTS}`,
      ),
      positions: store.prepare('SELECT element_key, x, y FROM element_positions WHERE diagram_id = ?'),
      // The item documents of the snapshot the project holds, by path.
      items: store.prepare(
        `SELECT b.body FROM snapshots s JOIN snapshot_files f ON f.snapshot_id = s.id JOIN document_blobs b ON b.sha256 = f.blob_sha256
         WHERE s.project_id = ? AND s.commit_sha = ? AND substr(f.path, 1, 7) = '/items/' ORDER BY f.path`,
      ),
      threads: store.prepare(
        `SELECT h.id, h.target_kind, h.element_key, h.removed_name, h.state, h.waits_on, h.opened_at,
                (SELECT count(*) FROM comments c WHERE c.thread_id = h.id) AS entries,
                (SELECT c.created_at FROM comments c WHERE c.thread_id = h.id ORDER BY c.seq DESC LIMIT 1) AS last_at
         FROM comment_threads h WHERE h.diagram_id = ?
         ORDER BY h.state = 'closed', h.opened_at, h.id LIMIT ${LISTED_THREADS}`,
      ),
      // The proposals and accepted change sets, newest first, without the proposed document itself, which only says
      // whether it came (source_text). A member of detail of another JSON type than the request's is read as absent.
      overlays: store.prepare(
        `SELECT c.id, c.drawing_id, w.document_version, c.origin, c.thread_id, c.state, c.created_at, c.decided_at,
                c.pull_request_id, p.number,
                CASE WHEN json_type(c.detail, '$.items') = 'array' THEN json_extract(c.detail, '$.items') END AS items,
                CASE WHEN json_type(c.detail, '$.adds') = 'array' THEN json_extract(c.detail, '$.adds') END AS adds,
                CASE WHEN json_type(c.detail, '$.reason') = 'text' THEN json_extract(c.detail, '$.reason') END AS reason,
                CASE WHEN json_type(c.detail, '$.change') = 'text' THEN json_extract(c.detail, '$.change') END AS change,
                json_type(c.detail, '$.source_text') = 'text' AS source_text
         FROM change_sets c JOIN drawings w ON w.id = c.drawing_id LEFT JOIN pull_requests p ON p.id = c.pull_request_id
         WHERE c.diagram_id = ? AND ${LISTED_SETS}
         ORDER BY coalesce(c.decided_at, c.created_at) DESC, c.id DESC LIMIT ${LISTED_OVERLAYS}`,
      ),
      // The steps of the listed change sets only, at most LISTED_CHANGES of each, in order.
      changes: store.prepare(
        `SELECT change_set_id, op, element_key, new_name, target_key FROM (
           SELECT x.change_set_id, x.seq, x.op, x.element_key, x.new_name, x.target_key,
                  row_number() OVER (PARTITION BY x.change_set_id ORDER BY x.seq) AS n
           FROM changes x
           WHERE x.change_set_id IN (SELECT c.id FROM change_sets c WHERE c.diagram_id = ? AND ${LISTED_SETS}
                                     ORDER BY coalesce(c.decided_at, c.created_at) DESC, c.id DESC LIMIT ${LISTED_OVERLAYS}))
         WHERE n <= ${LISTED_CHANGES} ORDER BY change_set_id, seq`,
      ),
      // The open reflection entries of the diagram, oldest first, with the pull request of the group each holds: its
      // anchor's (see entries.js).
      reflections: store.prepare(
        `SELECT t.id, a.pull_request_id FROM todos t JOIN change_sets a ON a.id = t.change_set_id
         WHERE t.diagram_id = ? AND t.kind = 'reflect' AND t.closed_at IS NULL ORDER BY t.created_at, t.id`,
      ),
      confirmation: store.prepare(
        `SELECT k.id, k.diagram_id, k.drawing_id, w.document_version, k.state, k.confirmed_at, k.ended_at, k.recorded_at,
                k.cancel_recorded_at
         FROM confirmations k JOIN drawings w ON w.id = k.drawing_id WHERE k.diagram_id = ? ORDER BY k.id DESC LIMIT 1`,
      ),
    };
    prepared.set(store, statements);
  }
  return statements;
}

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

// A text cut to at most length characters (Unicode code points), as JSON Schema's maxLength counts them (see
// project.js).
function cut(text, length) {
  if (text.length <= length) return text;
  const points = Array.from(text);
  return points.length <= length ? text : points.slice(0, length).join('');
}

// An element's detail: the object its drawer wrote, or {} for anything else, as the contract's Element.detail is an
// object and TBL-153 only holds it to valid JSON.
function detailOf(row) {
  const detail = JSON.parse(row.detail);
  return isPlainObject(detail) ? detail : {};
}

// A drawing as the contract's Drawing.
function drawingOf(row) {
  const failed = row.status === 'failed';
  return {
    id: idOf('dw', Number(row.id)),
    revision: Number(row.revision),
    version: row.document_version,
    status: row.status,
    failed_at: failed ? failureWhere({ path: row.failed_path, line: row.failed_line === null ? null : Number(row.failed_line) }) : null,
    drawn_at: row.drawn_at,
  };
}

// A point within the contract's reach, or null.
function pointOf(x, y) {
  const near = (value) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= FAR;
  return near(x) && near(y) ? { x, y } : null;
}

// An element as the contract's Element. moved holds the owner's positions by key, and names the item names, for the
// links of an item table's rows.
function elementOf(row, moved, names) {
  const detail = detailOf(row);
  if (names !== null && Array.isArray(detail.links)) {
    detail.links = detail.links.map((id) => ({ id, name: names.get(id) ?? '' }));
  }
  const box = isPlainObject(detail.box) ? pointOf(detail.box.x, detail.box.y) : null;
  return {
    key: row.element_key,
    trace_id: row.trace_id,
    kind: row.kind,
    name: row.name,
    parent: row.parent_key,
    status: row.status,
    detail,
    position: moved.get(row.element_key) ?? box,
  };
}

// The trace IDs of a change set's items or adds, as its detail keeps them: [] when it keeps none.
function traceIds(text) {
  if (text === null || text === undefined) return [];
  let list;
  try {
    list = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  const ids = list.filter((id) => typeof id === 'string' && id.length <= TRACE_ID_LENGTH && TRACE_ID.test(id));
  return [...new Set(ids)].slice(0, LISTED_IDS);
}

// A change set's reason or change text, or null.
function textOf(value) {
  return typeof value === 'string' && value !== '' ? cut(value, TEXT_LENGTH) : null;
}

// A step's new name or a thread's removed_name, or null.
function nameOf(value) {
  return typeof value === 'string' ? cut(value, NAME_LENGTH) : null;
}

// Text with its objects' members in order of their names, so that two details that say the same compare equal
// whatever order their drawer wrote them in.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((name) => `${JSON.stringify(name)}:${canonical(value[name])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

// What an element says, for the comparison of SPEC-034: its trace ID, kind, name, parent, status and detail, without
// where it is drawn and its file and line (PLACING).
function meaningOf(row) {
  const kept = Object.fromEntries(Object.entries(detailOf(row)).filter(([name]) => !PLACING.has(name)));
  return canonical([row.trace_id, row.kind, row.name, row.parent_key, row.status, kept]);
}

// What changed from the confirmed drawing's elements to the shown drawing's (SPEC-034): the keys added, removed and
// changed, added and changed in the shown drawing's order and removed in the confirmed one's.
export function changesSince(confirmed, shown) {
  const before = new Map(confirmed.map((row) => [row.element_key, row]));
  const now = new Set(shown.map((row) => row.element_key));
  const added = [];
  const changed = [];
  for (const row of shown) {
    const old = before.get(row.element_key);
    if (old === undefined) added.push(row.element_key);
    else if (meaningOf(old) !== meaningOf(row)) changed.push(row.element_key);
  }
  const removed = confirmed.filter((row) => !now.has(row.element_key)).map((row) => row.element_key);
  return { added, removed, changed };
}

// The diagram whose ID is id in the project named name, as the contract's Diagram, or a Problem's code when there is
// none to answer: project_not_found or diagram_not_found.
export function readDiagram(store, name, id) {
  const statements = statementsOf(store);
  const project = statements.project.get(name);
  if (project === undefined) return 'project_not_found';
  const projectId = Number(project.id);
  const key = keyOf('dg', id);
  const diagram = key === null ? undefined : statements.diagram.get(key, projectId);
  if (diagram === undefined) return 'diagram_not_found';
  const removed = diagram.removed_at !== null;
  if (removed && Number(diagram.open_threads) === 0) return 'diagram_not_found';
  if (!STAGE_SET.has(diagram.stage)) return 'diagram_not_found';
  const diagramId = Number(diagram.id);
  const part = diagramPart(store, { id: diagramId, stage: diagram.stage, kind: diagram.kind, source_key: diagram.source_key });

  const current = statements.current.get(diagramId) ?? null;
  const shown = current?.status === 'drawn' ? current : statements.lastDrawn.get(diagramId) ?? null;
  const rows = shown === null ? [] : statements.elements.all(Number(shown.id));

  const moved = new Map();
  for (const row of statements.positions.all(diagramId)) {
    const point = pointOf(row.x, row.y);
    if (point !== null) moved.set(row.element_key, point);
  }
  // The names of an item table's links, from the item documents of the snapshot the project holds.
  let names = null;
  if (diagram.kind === 'item_table') {
    names = project.held_commit === null ? new Map()
      : itemNames(statements.items.all(projectId, project.held_commit).map((row) => row.body));
  }
  const elements = rows.map((row) => elementOf(row, moved, names));

  // The overlays, each with its steps and, once accepted, the reflection entry of its group (by pull request).
  const steps = new Map();
  for (const row of statements.changes.all(diagramId)) {
    const set = Number(row.change_set_id);
    if (!steps.has(set)) steps.set(set, []);
    steps.get(set).push({ op: row.op, element: row.element_key, name: nameOf(row.new_name), target: row.target_key });
  }
  const reflections = new Map();
  for (const row of statements.reflections.all(diagramId)) {
    const group = row.pull_request_id === null ? null : Number(row.pull_request_id);
    if (!reflections.has(group)) reflections.set(group, Number(row.id));
  }
  const diagramRef = idOf('dg', diagramId);
  const overlays = statements.overlays.all(diagramId).map((row) => {
    const group = row.pull_request_id === null ? null : Number(row.pull_request_id);
    const reflection = row.state === 'accepted' ? reflections.get(group) ?? null : null;
    return {
      id: idOf('np', Number(row.id)),
      part,
      stage: diagram.stage,
      diagram: diagramRef,
      drawing: idOf('dw', Number(row.drawing_id)),
      version: row.document_version,
      origin: row.origin,
      thread: row.thread_id === null ? null : idOf('nc', Number(row.thread_id)),
      state: row.state,
      items: traceIds(row.items),
      adds: traceIds(row.adds),
      reason: textOf(row.reason),
      change: textOf(row.change),
      source_text: Number(row.source_text) === 1,
      changes: steps.get(Number(row.id)) ?? [],
      made_at: row.created_at,
      decided_at: row.decided_at,
      reflection: reflection === null ? null : idOf('ne', reflection),
      pull_request: row.number === null ? null : pullRequestLink(project.repository, row.number),
    };
  });

  // The latest confirmation, and what changed since the drawing it confirmed (SPEC-034).
  const confirmed = statements.confirmation.get(diagramId) ?? null;
  let since = null;
  if (confirmed !== null) {
    const before = shown !== null && Number(confirmed.drawing_id) === Number(shown.id) ? rows : statements.elements.all(Number(confirmed.drawing_id));
    since = { version: confirmed.document_version, ...changesSince(before, rows) };
  }

  const threads = statements.threads.all(diagramId).map((row) => ({
    id: idOf('nc', Number(row.id)),
    target: row.target_kind,
    element: row.element_key,
    removed_name: nameOf(row.removed_name),
    state: row.state,
    waits_on: row.waits_on,
    last_at: row.last_at ?? row.opened_at,
    entries: Math.min(Math.max(Number(row.entries), 1), ENTRIES),
  }));

  return {
    id: diagramRef,
    project: project.name,
    part,
    stage: diagram.stage,
    kind: diagram.kind,
    name: diagram.name,
    removed,
    drawing: current === null ? null : drawingOf(current),
    last_drawn: current?.status === 'failed' && shown !== null ? drawingOf(shown) : null,
    elements,
    overlays,
    since_confirmation: since,
    confirmation: confirmed === null ? null : confirmationBody(confirmed),
    threads,
  };
}

// API-265: the diagram {diagram} of the project {project}. A name no project space has answers project_not_found; an
// ID no diagram of the project has, or a removed diagram without an open thread, answers diagram_not_found.
function getDiagram({ store, params }) {
  const body = readDiagram(store, params.project, params.diagram);
  if (typeof body === 'string') throw new Problem(body);
  return { body };
}

// The route of API-265 (see router.js), of the owner family.
export const DIAGRAM_ROUTES = Object.freeze([
  {
    method: 'GET',
    path: '/api/projects/{project}/diagrams/{diagram}',
    action: 'getDiagram',
    params: { project: 'project_not_found', diagram: 'diagram_not_found' },
    handle: getDiagram,
  },
]);
