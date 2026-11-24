// Moving an element (TASK-442; API-274, SPEC-012, SPEC-027): the owner puts an element of a diagram where they want
// it, and NEXUS keeps that place in TBL-154 element_positions, never in Git. The last move wins, so two tabs that move
// one element leave it where the later move put it. A move changes no document, drawing, confirmation or to-do: a
// position never changes what the document means (TBL-154's rule in db/nexus.sql), so no drawing reads it. A drawing
// that read it would make a new drawing at the next push from a move alone, and a confirmation or a proposal made
// against the drawing before it would get document_changed. The diagram read (diagram.js) answers it, and the page
// draws a moved box at its place, routes its lines and keeps the other boxes clear of it (TASK-458).
//
// - Which diagram: one of the project's, of a stage the contract names, that no snapshot removed. A removed diagram
//   opens only for what waits on it and takes no move (SPEC-027): it answers diagram_not_found, as a new direct edit
//   there does.
// - Which element: one of the drawing the diagram shows, its latest that drew, so a move still works while its latest
//   drawing failed (SPEC-001). The body names no drawing, so a page opened before the latest push moves an element
//   that drawing still holds, and gets element_not_found for one it no longer holds. A diagram that never drew has no
//   element to move.
// - What moves: an element its drawing gives a box (placeable), other than a box drawn round other elements: the DDD
//   board's lanes, context frames and the Hotspots lane, which a move would take away from what they hold. A line, a
//   token, a row of an item table and a part the hub left out have no box; moving one is invalid_request on element.
//   An element drawn as unreadable keeps its box and moves (note 1 of the WBS): it has not left the document. So does
//   an ERD table drawn as missing, which a foreign key names and the schema does not define: SPEC-004 draws it in a
//   box, marked, while a foreign key names it. A direct edit refuses both, having no text to change (direct-edits.js).
// - Where: x and y as sent, anywhere within the contract's ±1,000,000, however far from the other boxes.
//
// after-drawing.js drops the positions of the elements a new drawing no longer places, and those of a diagram a
// snapshot removes (SPEC-012), with placeable below. Nothing here logs (rule 5): no line holds an element's key, a
// project's name or a place.

import { ELEMENT_KEY, isObject } from './drawer.js';
import { idOf, keyOf } from './ids.js';
import { invalidRequest, Problem } from './problem.js';
import { STAGES } from './snapshot.js';

// The contract's Move: an element key of 1 to 200 characters that starts and ends with no white space (drawer.js's
// ELEMENT_KEY), and a place within ±1,000,000.
const FIELDS = new Set(['element', 'x', 'y']);
const KEY_LENGTH = 200;
const FAR = 1_000_000;
const STAGE_SET = new Set(STAGES);
// The boxes drawn round other elements: the DDD board's lanes, context frames and Hotspots lane (ddd-board.js). A user
// flow's lane has no box.
const CONTAINERS = new Set(['lane', 'context', 'hotspot_lane']);

// The statements of each store, prepared on first use (see credentials.js).
const prepared = new WeakMap();

function statementsOf(store) {
  let statements = prepared.get(store);
  if (statements === undefined) {
    statements = {
      project: store.prepare('SELECT id FROM project_spaces WHERE name = ?'),
      diagram: store.prepare('SELECT id, stage, removed_at FROM diagrams WHERE id = ? AND project_id = ?'),
      // The drawing the diagram shows: its latest that drew (SPEC-001).
      shown: store.prepare("SELECT id FROM drawings WHERE diagram_id = ? AND status = 'drawn' ORDER BY id DESC LIMIT 1"),
      element: store.prepare('SELECT element_key, kind, detail FROM elements WHERE drawing_id = ? AND element_key = ?'),
      move: store.prepare(
        `INSERT INTO element_positions (diagram_id, element_key, x, y, moved_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (diagram_id, element_key) DO UPDATE SET x = excluded.x, y = excluded.y, moved_at = excluded.moved_at`,
      ),
    };
    prepared.set(store, statements);
  }
  return statements;
}

// Whether an element as TBL-153 keeps it, { kind, detail } with detail as JSON text, has a place the owner can move:
// its drawing gives it a box, and it is no box drawn round other elements.
export function placeable({ kind, detail }) {
  if (CONTAINERS.has(kind)) return false;
  let parsed;
  try {
    parsed = JSON.parse(detail);
  } catch {
    return false;
  }
  return isObject(parsed) && isObject(parsed.box);
}

// The contract's Move from the body, or invalid_request on the field it breaks. No detail repeats a value.
function moveOf(body) {
  if (Object.keys(body).some((field) => !FIELDS.has(field))) throw invalidRequest('body', 'the body takes element, x and y only');
  const { element, x, y } = body;
  if (element === undefined) throw invalidRequest('element', 'element is required');
  if (typeof element !== 'string' || element.length === 0 || [...element].length > KEY_LENGTH || !ELEMENT_KEY.test(element)) {
    throw invalidRequest('element', `element must be an element key of 1 to ${KEY_LENGTH} characters`);
  }
  for (const [field, value] of [['x', x], ['y', y]]) {
    if (value === undefined) throw invalidRequest(field, `${field} is required`);
    coordinateOf(value, field);
  }
  return { element, x, y };
}

// A place's coordinate, a finite number from -1,000,000 to 1,000,000 (the contract's x and y), or invalid_request on
// field. The workshop's notes take the same (TASK-452).
export function coordinateOf(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > FAR) {
    throw invalidRequest(field, `${field} must be a number from -${FAR} to ${FAR}`);
  }
  return value;
}

// API-274: moves an element of the diagram {diagram} of the project {project} (SPEC-012). The project and the diagram
// are found before the Move's fields are checked, so a removed diagram answers diagram_not_found whatever fields the
// body holds. A body that is not a JSON object is refused before, as for every JSON write (body.js).
function moveElement({ store, params, body, now }) {
  const statements = statementsOf(store);
  const project = statements.project.get(params.project);
  if (project === undefined) throw new Problem('project_not_found');
  const key = keyOf('dg', params.diagram);
  const diagram = key === null ? undefined : statements.diagram.get(key, Number(project.id));
  if (diagram === undefined || diagram.removed_at !== null || !STAGE_SET.has(diagram.stage)) throw new Problem('diagram_not_found');
  const { element, x, y } = moveOf(body);
  const diagramId = Number(diagram.id);
  const shown = statements.shown.get(diagramId);
  const row = shown === undefined ? undefined : statements.element.get(Number(shown.id), element);
  if (row === undefined) throw new Problem('element_not_found', undefined, {}, { element });
  if (!placeable(row)) throw invalidRequest('element', 'this element has no place of its own to move');
  const time = new Date(now()).toISOString();
  statements.move.run(diagramId, element, x, y, time);
  return { body: { diagram: idOf('dg', diagramId), element, x, y, moved_at: time } };
}

// The route of API-274 (see router.js), of the owner family.
export const POSITION_ROUTES = Object.freeze([
  {
    method: 'POST',
    path: '/api/projects/{project}/diagrams/{diagram}/positions',
    action: 'moveElement',
    params: { project: 'project_not_found', diagram: 'diagram_not_found' },
    body: 'json',
    requestKey: true,
    handle: moveElement,
  },
]);
