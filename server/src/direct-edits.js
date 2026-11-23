// Direct edits (TASK-445; API-272, API-273, SPEC-021, SPEC-022, SPEC-023, SPEC-027): the owner renames an element or
// connects two, and cancels such an edit while it waits for reflection. Both are owner operations with a JSON body and
// a request key (rule 3), each one write (writes.js). A phone offers neither (SPEC-051, REQ-068): that is the page's.
// Nothing here logs; a name is in the store and the answer only (rule 5).
//
// API-272 records a rename or a connection as a change set of the diagram (TBL-158), origin direct_edit, accepted when
// it is made, with one step (TBL-159, written by changes.js's writeSteps) against the drawing the diagram shows; then
// entries.js's changeSetsChanged puts its reflection on the agent to-do (SPEC-021, SPEC-026). Its detail is {}: it
// has none of ProposalRequest's names, so it reads with no items or adds, reason and change null and source_text false
// (reads.js). The diagram read lays it over its element, newest on top (SPEC-022, diagram.js).
// - The diagram. A removed one takes no direct edit (SPEC-027), nor does one of a stage the contract does not name,
//   which no read lists: both answer diagram_not_found. The mockup page, stage 09's picture, takes no overlay
//   (SPEC-018), so it takes no direct edit either: invalid_request on op. An item table of stage 09, drawn while the
//   stage has no mockup page, takes edits as any item table does.
// - The drawing. The diagram shows its latest drawing that drew: the current one, or the last good one when the
//   current one failed (SPEC-001). The request names that drawing: another drawing of the diagram answers
//   document_changed with the drawing shown, or the latest when none drew, and its version; a drawing of no drawing of
//   the diagram answers drawing_not_found. A diagram that never drew shows no element, so an edit of its latest
//   drawing answers element_not_found.
// - The element, and a connection's target, are elements of the drawing shown that the document holds; one that is not
//   answers element_not_found with its key. An element drawn as unreadable (its entry could not be read), missing (an
//   ERD table that a foreign key names and the schema does not define) or left_out (what a drawer does not draw: an
//   ERD statement, a sitemap source, a DDD table) has no text a reflection could change, so it is refused as not
//   there. One drawn as removed is still in its document, and takes edits.
// - A rename takes every element of the drawing shown but three whose names the drawer makes, not the document
//   (UNNAMED): the DDD board's Hotspots lane, always named Hotspots; a sitemap line, named after the screen it leads to,
//   whose relation is that screen's parent; and an ERD line, named by its foreign key's columns joined with commas,
//   which is no one name of the schema. Each is refused with invalid_request on element.
// - A connection joins two elements of the kinds its picture draws its lines between (JOINS). Any other element or
//   target is refused with invalid_request on its field, and a picture that draws no line, such as screen states,
//   refuses a connection with invalid_request on op. On a sitemap, where each screen stands under one parent, a
//   connection from X to Y means that Y stands under X: the reflection moves Y under X, from any parent it had. A
//   target that X stands under, directly or not, would make a cycle: invalid_request on target.
// - Nothing new answers 200 with no change set:
//   - a rename to the name the element has: that of the waiting rename of it accepted last, or else its name as
//     drawn;
//   - a connection that exists: a line of the drawing shown from the element to the target, one whose detail names
//     them as from and to, as an ERD line, a sitemap line, a user flow's arrow and a DDD dependency do, in the
//     direction their points run; on an item table, the element's row listing the target's key among its links; or a
//     step of a waiting change set of the diagram that connects them. The other direction is another connection.
// - A rename of an element that an open AI proposal also renames is made as any other, and the later accepted wins. A
//   direct edit is accepted when it is made, a proposal when the owner accepts it (decided_at). The diagram read lists
//   accepted change sets on an element newest accepted on top (SPEC-022, diagram.js), and the reflection applies them
//   in the order they were accepted: within an entry as entries.js's heldChangeSets lists them, and across entries in
//   the agent to-do's order, a change set accepted while a pull request is open waiting in a later entry. Nothing makes
//   the entries' pull requests merge in that order, and when a pull request closes unmerged its change sets wait again
//   in the older entry, which can then hold change sets accepted before and after those of a newer one. So TASK-447's
//   reflection applies the changes to one element by decided_at, the later accepted last, and names in its comment the
//   change it left. So the page shows the name the reflection will leave.
// Waiting means accepted and not yet reflected.
//
// API-273 cancels a direct edit that is not reflected (SPEC-023): the change set is marked cancelled and leaves the
// diagram's overlays, so the diagram shows the element as drawn again, and changeSetsChanged takes it out of its
// reflection entry.
// - In an open pull request, it is cancelled all the same and keeps its pull request; entries.js's
//   removeFromPullRequest asks the agent to take it out, and the answer's pull_request names that pull request. In a
//   pull request that merged before it was reflected, it is cancelled with no removal: the drawing will show the
//   change, and the owner comments to undo it, as when the pull request merges after the cancel.
// - Cancelled again, it answers the same with changed false; pull_request names the pull request while it is open.
// - Reflected, or in any state but accepted and cancelled, it is refused: change_set_state with its state. So is an AI
//   proposal, which the owner answers and does not cancel (API-270, API-271): the page offers Cancel edit on a direct
//   edit only.
// - A removed diagram's direct edit is cancelled like any other (note 8 of the WBS): SPEC-027 refuses a new thread, a
//   move, a direct edit, accepting a proposal and confirming, and a cancel only takes a change out.

import { isElementKey, writeSteps } from './changes.js';
import { pullRequestLink } from './claims.js';
import { characters } from './drawer.js';
import { changeSetsChanged, removeFromPullRequest } from './entries.js';
import { idOf, keyOf } from './ids.js';
import { LIMITS } from './limits.js';
import { invalidRequest, Problem } from './problem.js';
import { changeSetOf } from './reads.js';
import { STAGES } from './snapshot.js';

const STAGE_SET = new Set(STAGES);
// The kind of stage 09's picture, the mockup page, which takes no overlay (SPEC-009, SPEC-018).
const MOCKUP = 'mockup';
const DRAWING_ID = /^dw_[0-9a-hjkmnp-tv-z]{12}$/;
const OPS = Object.freeze(['rename', 'connect']);
const FIELDS = new Set(['drawing', 'op', 'element', 'name', 'target']);
// The kinds each picture draws its lines between, which a connection joins (SPEC-021): an ERD's tables, a sitemap's
// screens, a user flow's boxes of every shape, a DDD board's contexts and external systems, and an item table's rows.
// A picture not named draws no line.
const JOINS = new Map([
  ['erd', new Set(['table'])],
  ['sitemap', new Set(['screen'])],
  ['user_flow', new Set(['terminal', 'step', 'decision', 'document', 'store', 'llm', 'grading'])],
  ['ddd_board', new Set(['context', 'external'])],
  ['item_table', new Set(['row'])],
]);
// The kinds whose name the drawer makes, not the document, which take no rename (see the top of this file).
const UNNAMED = new Map([
  ['ddd_board', new Set(['hotspot_lane'])],
  ['sitemap', new Set(['line'])],
  ['erd', new Set(['line'])],
]);
// The statuses of an element whose document does not hold it as drawn (see the top of this file).
const GONE = new Set(['unreadable', 'missing', 'left_out']);

// The statements of each store, prepared on first use (see credentials.js).
const prepared = new WeakMap();

// A waiting change set of the diagram, as a condition on change_sets under the alias c.
const WAITING = "c.diagram_id = ? AND c.state = 'accepted'";

function statementsOf(store) {
  let statements = prepared.get(store);
  if (statements === undefined) {
    statements = {
      project: store.prepare('SELECT id, name, repository FROM project_spaces WHERE name = ?'),
      diagram: store.prepare('SELECT id, stage, kind, removed_at FROM diagrams WHERE id = ? AND project_id = ?'),
      drawing: store.prepare('SELECT id FROM drawings WHERE id = ? AND diagram_id = ?'),
      current: store.prepare('SELECT id, status, document_version FROM drawings WHERE diagram_id = ? ORDER BY id DESC LIMIT 1'),
      lastDrawn: store.prepare(
        "SELECT id, status, document_version FROM drawings WHERE diagram_id = ? AND status = 'drawn' ORDER BY id DESC LIMIT 1",
      ),
      element: store.prepare('SELECT kind, name, status, parent_key, detail FROM elements WHERE drawing_id = ? AND element_key = ?'),
      line: store.prepare(
        `SELECT 1 AS found FROM elements WHERE drawing_id = ?
         AND json_type(detail, '$.from') = 'text' AND json_extract(detail, '$.from') = ?
         AND json_type(detail, '$.to') = 'text' AND json_extract(detail, '$.to') = ? LIMIT 1`,
      ),
      waitingConnect: store.prepare(
        `SELECT 1 AS found FROM changes x JOIN change_sets c ON c.id = x.change_set_id
         WHERE ${WAITING} AND x.op = 'connect' AND x.element_key = ? AND x.target_key = ? LIMIT 1`,
      ),
      waitingName: store.prepare(
        `SELECT x.new_name FROM changes x JOIN change_sets c ON c.id = x.change_set_id
         WHERE ${WAITING} AND x.op = 'rename' AND x.element_key = ?
         ORDER BY coalesce(c.decided_at, c.created_at) DESC, c.id DESC, x.seq DESC LIMIT 1`,
      ),
      insert: store.prepare(
        `INSERT INTO change_sets (project_id, diagram_id, drawing_id, origin, state, created_at, decided_at)
         VALUES (?, ?, ?, 'direct_edit', 'accepted', ?, ?)`,
      ),
      changeSet: store.prepare('SELECT id, diagram_id, origin, state, pull_request_id FROM change_sets WHERE id = ? AND project_id = ?'),
      pullRequest: store.prepare('SELECT number, state FROM pull_requests WHERE id = ?'),
      cancel: store.prepare("UPDATE change_sets SET state = 'cancelled' WHERE id = ? AND state = 'accepted'"),
      removal: store.prepare("SELECT 1 AS found FROM todos WHERE change_set_id = ? AND kind = 'remove_from_pr' LIMIT 1"),
    };
    prepared.set(store, statements);
  }
  return statements;
}

const timeOf = (now) => new Date(now()).toISOString();

function projectOf(statements, name) {
  const row = statements.project.get(name);
  if (row === undefined) throw new Problem('project_not_found');
  return { id: Number(row.id), name: row.name, repository: row.repository };
}

// The request's fields (the contract's DirectEdit). Each refusal names the field and never repeats its value (rule 5).

function keyField(body, field) {
  if (!Object.hasOwn(body, field)) throw invalidRequest(field, `${field} is required`);
  if (!isElementKey(body[field])) throw invalidRequest(field, `${field} is not in its form`);
  return body[field];
}

// A new name: text that is not only white space, of at most 200 characters (SPEC-021), kept as it is written.
function nameField(body) {
  if (!Object.hasOwn(body, 'name')) throw invalidRequest('name', 'a rename needs name');
  const { name } = body;
  if (typeof name !== 'string') throw invalidRequest('name', 'name must be text');
  // A lone surrogate cannot be stored as UTF-8: the store would keep another name than the one given.
  if (!name.isWellFormed()) throw invalidRequest('name', 'name must be Unicode text');
  if (!/\S/u.test(name)) throw invalidRequest('name', 'name must not be empty');
  const limit = LIMITS.nameCharacters;
  if (characters(name) > limit) throw new Problem('text_too_long', `name is over ${limit} characters`, {}, { field: 'name', limit });
  return name;
}

// The edit a DirectEdit asks for: { drawing, op, element, name, target }, name null for a connection and target null
// for a rename.
function editOf(body) {
  if (Object.keys(body).some((field) => !FIELDS.has(field))) {
    throw invalidRequest('body', `the body takes ${[...FIELDS].join(', ')} only`);
  }
  if (!Object.hasOwn(body, 'drawing')) throw invalidRequest('drawing', 'drawing is required');
  if (typeof body.drawing !== 'string' || !DRAWING_ID.test(body.drawing)) throw invalidRequest('drawing', 'drawing is not in its form');
  if (!Object.hasOwn(body, 'op')) throw invalidRequest('op', 'op is required');
  if (!OPS.includes(body.op)) throw invalidRequest('op', 'op is rename or connect');
  const element = keyField(body, 'element');
  if (body.op === 'rename') {
    if (Object.hasOwn(body, 'target')) throw invalidRequest('target', 'a rename takes no target');
    return { drawing: body.drawing, op: 'rename', element, name: nameField(body), target: null };
  }
  if (Object.hasOwn(body, 'name')) throw invalidRequest('name', 'a connection takes no name');
  const target = keyField(body, 'target');
  if (target === element) throw invalidRequest('target', 'an element is not connected to itself');
  return { drawing: body.drawing, op: 'connect', element, name: null, target };
}

// The diagram {diagram} of the project, which takes a direct edit: not removed (SPEC-027), of a stage the contract
// names, and not the mockup page.
function editableDiagram(statements, project, id) {
  const key = keyOf('dg', id);
  const row = key === null ? undefined : statements.diagram.get(key, project.id);
  if (row === undefined || row.removed_at !== null || !STAGE_SET.has(row.stage)) throw new Problem('diagram_not_found');
  if (row.kind === MOCKUP) throw invalidRequest('op', 'a mockup takes no direct edit');
  return { id: Number(row.id), kind: row.kind };
}

// The drawing the diagram shows, which the edit names: its key, or null when the diagram never drew and so shows no
// element. Another drawing of the diagram is refused with document_changed, naming the drawing shown, or the latest
// when none drew; one that is not the diagram's, with drawing_not_found.
function shownDrawing(statements, diagram, id) {
  const key = keyOf('dw', id);
  if (key === null || statements.drawing.get(key, diagram.id) === undefined) throw new Problem('drawing_not_found');
  const current = statements.current.get(diagram.id);
  const shown = current.status === 'drawn' ? current : statements.lastDrawn.get(diagram.id) ?? null;
  const named = shown ?? current;
  if (Number(named.id) !== key) {
    throw new Problem('document_changed', undefined, {}, { drawing: idOf('dw', Number(named.id)), version: named.document_version });
  }
  return shown === null ? null : key;
}

// An element of the drawing shown, which the document holds (see the top of this file): its row, or element_not_found
// with its key. drawing is null when the diagram never drew, and shows no element.
function elementOf(statements, drawing, key) {
  const row = drawing === null ? undefined : statements.element.get(drawing, key);
  if (row === undefined || GONE.has(row.status)) throw new Problem('element_not_found', undefined, {}, { element: key });
  return row;
}

// Whether the element row stands under key in the drawing, directly or not: key is one of the parents its parent_key
// leads up to, as a sitemap's screens stand under one another.
function standsUnder(statements, drawing, row, key) {
  const seen = new Set();
  for (let parent = row.parent_key; parent !== null && !seen.has(parent);) {
    if (parent === key) return true;
    seen.add(parent);
    parent = statements.element.get(drawing, parent)?.parent_key ?? null;
  }
  return false;
}

// Whether a row of an item table lists the key among its links (detail.links), as its source gives them.
function linksTo(row, key) {
  const detail = JSON.parse(row.detail);
  return detail !== null && Array.isArray(detail.links) && detail.links.includes(key);
}

// Whether the edit changes nothing: a rename to the name the element has, or a connection that exists.
function changesNothing(statements, diagram, drawing, edit, drawn) {
  if (edit.op === 'rename') {
    const waiting = statements.waitingName.get(diagram.id, edit.element);
    return (waiting === undefined ? drawn.name : waiting.new_name) === edit.name;
  }
  const exists = diagram.kind === 'item_table' ? linksTo(drawn, edit.target) : statements.line.get(drawing, edit.element, edit.target) !== undefined;
  return exists || statements.waitingConnect.get(diagram.id, edit.element, edit.target) !== undefined;
}

// API-272: renames an element of {diagram} or connects two, as an accepted change set (SPEC-021).
function makeDirectEdit({ store, params, body, now }) {
  const edit = editOf(body);
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  const diagram = editableDiagram(statements, project, params.diagram);
  const joins = JOINS.get(diagram.kind);
  if (edit.op === 'connect' && joins === undefined) throw invalidRequest('op', 'this diagram draws no line to connect');
  const drawing = shownDrawing(statements, diagram, edit.drawing);
  const drawn = elementOf(statements, drawing, edit.element);
  if (edit.op === 'rename' && UNNAMED.get(diagram.kind)?.has(drawn.kind)) throw invalidRequest('element', 'this element takes no rename');
  if (edit.op === 'connect') {
    const target = elementOf(statements, drawing, edit.target);
    if (!joins.has(drawn.kind)) throw invalidRequest('element', 'this element takes no connection');
    if (!joins.has(target.kind)) throw invalidRequest('target', 'this element takes no connection');
    if (diagram.kind === 'sitemap' && standsUnder(statements, drawing, drawn, edit.target)) {
      throw invalidRequest('target', 'a screen cannot stand under its own child');
    }
  }
  if (changesNothing(statements, diagram, drawing, edit, drawn)) return { body: { change_set: null, created: false } };
  const time = timeOf(now);
  const key = Number(statements.insert.run(project.id, diagram.id, drawing, time, time).lastInsertRowid);
  writeSteps(store, { changeSet: key, steps: [{ op: edit.op, element: edit.element, name: edit.name, target: edit.target }] });
  changeSetsChanged(store, { project: project.id, diagram: diagram.id, time });
  return { status: 201, body: { change_set: changeSetOf(store, project, key), created: true } };
}

// API-273: cancels a direct edit that is not reflected (SPEC-023).
function cancelDirectEdit({ store, params, body, now }) {
  if (Object.keys(body).length > 0) throw invalidRequest('body', 'the body is the empty object {}');
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  const key = keyOf('np', params.change_set);
  const row = key === null ? undefined : statements.changeSet.get(key, project.id);
  if (row === undefined) throw new Problem('change_set_not_found');
  if (row.origin !== 'direct_edit') {
    throw new Problem('change_set_state', 'an AI proposal is answered, not cancelled', {}, { state: row.state });
  }
  if (row.state !== 'accepted' && row.state !== 'cancelled') {
    throw new Problem('change_set_state', `the change set is ${row.state}`, {}, { state: row.state });
  }
  const pullRequest = row.pull_request_id === null ? undefined : statements.pullRequest.get(Number(row.pull_request_id));
  const link = pullRequest === undefined ? null : pullRequestLink(project.repository, Number(pullRequest.number));
  const inOpen = pullRequest?.state === 'open';
  if (row.state === 'cancelled') {
    const removed = inOpen && statements.removal.get(key) !== undefined;
    return { body: { change_set: changeSetOf(store, project, key), changed: false, pull_request: removed ? link : null } };
  }
  const time = timeOf(now);
  const diagram = Number(row.diagram_id);
  statements.cancel.run(key);
  if (inOpen) removeFromPullRequest(store, { project: project.id, diagram, changeSet: key, time });
  changeSetsChanged(store, { project: project.id, diagram, time });
  return { body: { change_set: changeSetOf(store, project, key), changed: true, pull_request: inOpen ? link : null } };
}

// The routes of API-272 and API-273 (see router.js), of the owner family.
export const DIRECT_EDIT_ROUTES = Object.freeze([
  {
    method: 'POST',
    path: '/api/projects/{project}/diagrams/{diagram}/direct-edits',
    action: 'makeDirectEdit',
    params: { project: 'project_not_found', diagram: 'diagram_not_found' },
    body: 'json',
    requestKey: true,
    handle: makeDirectEdit,
  },
  {
    method: 'POST',
    path: '/api/projects/{project}/change-sets/{change_set}/cancel',
    action: 'cancelDirectEdit',
    params: { project: 'project_not_found', change_set: 'change_set_not_found' },
    body: 'json',
    requestKey: true,
    handle: cancelDirectEdit,
  },
]);
