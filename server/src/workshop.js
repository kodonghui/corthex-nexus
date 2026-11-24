// The workshop (TASK-452; API-260, API-261, API-284 to API-291; SPEC-036 to SPEC-040): stage-01 event storming on a
// NEXUS board. The owner opens a board with a frame per step (TBL-162, TBL-163), adds, moves, renames, links and
// removes sticky notes on it (TBL-164, TBL-165), and confirms each step; an agent drafts a step's notes with their
// confidence labels and reports the pull request that writes a confirmed step into the domain document. NEXUS calls no
// AI model (spec rule 6): a draft and a report come from the agent through the API. The board's screen is TASK-462's.
// The owner may also import a Miro board's sticky notes and connectors (TASK-453; API-292, SPEC-041), which miro.js
// reads; they become the owner's notes and links under the same limits.
//
// The rules the specs, the contract and the tables left open, chosen by the coordinator for TASK-452 and waiting for
// the maintainer's delegate (see the server README's "Workshop" section):
// - The workshop closes when all 11 steps are confirmed and reported merged: the merged report that writes the last
//   step not written closes it. A report on a step that is not confirmed gets steps_open, naming every step not
//   confirmed yet. A step needs a note to be confirmed (step_empty), so every frame needs one.
// - A report's link is the project's repository, /pull/ and a number (repository_mismatch otherwise, and for a project
//   without a repository). One pull request (TBL-157, purpose domain_document) may write several steps; a number
//   reported for a reflection or a record is invalid_request. opened links the pull request to the step; merged
//   writes every step linked to it, the reported one included; closed unlinks every step linked to it. A merged pull
//   request stays merged. A written step stays written: a later report answers changed false.
// - No workshop write makes or keeps a claim: a step has no entry ID, so it is never claimed (see entries.js), and
//   Nexus-Session is only checked as a label.
// - An owner's rename of an agent's note makes it the owner's (made_by owner, without credential or confidence
//   label), so the agent can no longer remove it (REQ-047); a move or a change of step keeps who made it. An agent's
//   own notes are every note an agent made, whatever its credential.
// - Removing a note, by the owner or the agent, removes its live links too, a person's link included. A removed note
//   or link keeps its row with removed_at and is no longer listed.
// - A draft removes only notes of its own step, before it places its notes. A note without x or y takes it from a
//   grid in the frame, 5 columns 160 apart and rows 120 apart: the first place no live note of the step holds.
// - Confirming a step writes only its confirmed_at, in any order of steps; steps 1-b, 7 and 9 each write one pass of
//   stage 01 (TBL-161). The owner may still change a confirmed step's notes; an agent's draft gets step_confirmed.
// - kind is the contract's free text of 1 to 40 characters, kept as sent.
// - A link is directed: the same from and to is the same link; the reverse is another.
// - A step holds at most 1000 live notes and a board 2000 live links, as many as API-285 lists. A text over 200
//   characters or a kind over 40 gets text_too_long on every workshop write.
//
// Nothing here logs: a note's text, a project's name and a link are in the store and the answers only (rule 5).

import { pullRequestLink, sessionOf } from './claims.js';
import { boundedText, emptyOf, formOf, onlyFields } from './comments.js';
import { isCheckpointStep, stepsChanged } from './entries.js';
import { idOf, keyOf } from './ids.js';
import { STEPS } from './params.js';
import { coordinateOf } from './positions.js';
import { readMiroBoard } from './miro.js';
import { invalidRequest, Problem } from './problem.js';

// The stage whose checkpoints steps 1-b, 7 and 9 pass (REQ-043).
const DOMAIN_STAGE = '01-domain';
export const LIMITS = Object.freeze({
  // The contract's Note: text and kind.
  text: 200,
  kind: 40,
  // WorkshopStep.notes and Workshop.links: as many as the read lists.
  stepNotes: 1000,
  links: 2000,
  // StepDraft: notes and remove.
  draft: 200,
});
// Where a note without a place goes in its frame: the first place of this grid, row by row, that no live note of the
// step holds.
export const GRID = Object.freeze({ columns: 5, x: 160, y: 120 });
const NOTE_ID = /^sn_[0-9a-hjkmnp-tv-z]{12}$/u;
const NOTE_ID_LENGTH = 15;
// The contract's Link: an https address of at most 2,000 characters without white space.
const LINK = /^https:\/\/\S+$/u;
const LINK_LENGTH = 2000;
// A pull request's address: anything, /pull/ and its number.
const PULL = /\/pull\/([1-9][0-9]{0,15})$/u;
const CONFIDENCES = new Set(['certain', 'inferred', 'guess']);
// What each event of a report makes the pull request.
const EVENTS = Object.freeze({ opened: 'open', merged: 'merged', closed: 'closed' });

// The statements of each store, prepared on first use (see credentials.js).
const prepared = new WeakMap();

function statementsOf(store) {
  let statements = prepared.get(store);
  if (statements === undefined) {
    const NOTE = 'id, step, kind, body, x, y, made_by, credential_id, confidence, from_miro, created_at, removed_at';
    statements = {
      project: store.prepare('SELECT id, repository FROM project_spaces WHERE name = ?'),
      open: store.prepare("SELECT id, state, opened_at, closed_at FROM workshops WHERE project_id = ? AND state = 'open'"),
      latest: store.prepare('SELECT id, state, opened_at, closed_at FROM workshops WHERE project_id = ? ORDER BY id DESC LIMIT 1'),
      insertWorkshop: store.prepare("INSERT INTO workshops (project_id, state, opened_at) VALUES (?, 'open', ?)"),
      closeWorkshop: store.prepare("UPDATE workshops SET state = 'closed', closed_at = ? WHERE id = ? AND state = 'open'"),
      insertStep: store.prepare('INSERT INTO workshop_steps (project_id, workshop_id, step) VALUES (?, ?, ?)'),
      steps: store.prepare('SELECT step, confirmed_at, written_at, pull_request_id FROM workshop_steps WHERE workshop_id = ? AND project_id = ?'),
      confirm: store.prepare('UPDATE workshop_steps SET confirmed_at = ? WHERE workshop_id = ? AND step = ? AND confirmed_at IS NULL'),
      linkStep: store.prepare('UPDATE workshop_steps SET pull_request_id = ? WHERE workshop_id = ? AND step = ?'),
      writeLinked: store.prepare(
        'UPDATE workshop_steps SET written_at = ? WHERE workshop_id = ? AND pull_request_id = ? AND written_at IS NULL',
      ),
      unlinkSteps: store.prepare(
        'UPDATE workshop_steps SET pull_request_id = NULL WHERE workshop_id = ? AND pull_request_id = ? AND written_at IS NULL',
      ),
      pass: store.prepare('INSERT INTO stage_passes (project_id, stage, passed_at) VALUES (?, ?, ?)'),
      notes: store.prepare(`SELECT ${NOTE} FROM sticky_notes WHERE workshop_id = ? AND removed_at IS NULL ORDER BY id`),
      note: store.prepare(`SELECT ${NOTE} FROM sticky_notes WHERE id = ? AND workshop_id = ?`),
      stepNotes: store.prepare('SELECT count(*) AS n FROM sticky_notes WHERE workshop_id = ? AND step = ? AND removed_at IS NULL'),
      stepPlaces: store.prepare('SELECT x, y FROM sticky_notes WHERE workshop_id = ? AND step = ? AND removed_at IS NULL'),
      insertNote: store.prepare(
        `INSERT INTO sticky_notes (workshop_id, step, kind, body, x, y, made_by, credential_id, confidence, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ),
      // A note of a Miro import (API-292): the owner's, from_miro.
      importNote: store.prepare(
        `INSERT INTO sticky_notes (workshop_id, step, kind, body, x, y, made_by, from_miro, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'owner', 1, ?)`,
      ),
      changeNote: store.prepare(
        'UPDATE sticky_notes SET step = ?, body = ?, x = ?, y = ?, made_by = ?, credential_id = ?, confidence = ? WHERE id = ?',
      ),
      removeNote: store.prepare('UPDATE sticky_notes SET removed_at = ? WHERE id = ? AND removed_at IS NULL'),
      removeNoteLinks: store.prepare(
        'UPDATE sticky_links SET removed_at = ? WHERE workshop_id = ? AND (from_note = ? OR to_note = ?) AND removed_at IS NULL',
      ),
      links: store.prepare('SELECT id, from_note, to_note, made_by FROM sticky_links WHERE workshop_id = ? AND removed_at IS NULL ORDER BY id'),
      link: store.prepare('SELECT id, from_note, to_note, made_by, removed_at FROM sticky_links WHERE id = ? AND workshop_id = ?'),
      liveLink: store.prepare(
        'SELECT id, from_note, to_note, made_by FROM sticky_links WHERE workshop_id = ? AND from_note = ? AND to_note = ? AND removed_at IS NULL',
      ),
      linkCount: store.prepare('SELECT count(*) AS n FROM sticky_links WHERE workshop_id = ? AND removed_at IS NULL'),
      insertLink: store.prepare("INSERT INTO sticky_links (workshop_id, from_note, to_note, made_by, created_at) VALUES (?, ?, ?, 'owner', ?)"),
      removeLink: store.prepare('UPDATE sticky_links SET removed_at = ? WHERE id = ? AND removed_at IS NULL'),
      pullRequest: store.prepare('SELECT id, purpose, state FROM pull_requests WHERE project_id = ? AND number = ?'),
      insertPullRequest: store.prepare(
        `INSERT INTO pull_requests (project_id, purpose, number, state, reported_at, closed_at, credential_id)
         VALUES (?, 'domain_document', ?, ?, ?, ?, ?)`,
      ),
      setPullRequest: store.prepare('UPDATE pull_requests SET state = ?, closed_at = ? WHERE id = ?'),
    };
    prepared.set(store, statements);
  }
  return statements;
}

const timeOf = (now) => new Date(now()).toISOString();

// Where the store's rows go in the answers.

// A note as the contract's Note.
function noteOf(row) {
  return {
    id: idOf('sn', Number(row.id)),
    step: row.step,
    kind: row.kind,
    text: row.body,
    x: Number(row.x),
    y: Number(row.y),
    made_by: row.made_by,
    confidence: row.confidence,
    from_miro: Number(row.from_miro) === 1,
    created_at: row.created_at,
  };
}

// A link as the contract's NoteLink.
function linkOf(row) {
  return {
    id: idOf('sl', Number(row.id)),
    from: idOf('sn', Number(row.from_note)),
    to: idOf('sn', Number(row.to_note)),
    made_by: row.made_by,
  };
}

// The steps of a workshop by name.
const stepsOf = (statements, workshop, projectId) => new Map(statements.steps.all(workshop, projectId).map((row) => [row.step, row]));

// A workshop as the contract's Workshop: its steps in their order, each with its live notes, oldest first, and its
// live links, oldest first.
function workshopOf(statements, projectId, row) {
  const workshop = Number(row.id);
  const notes = new Map(STEPS.map((step) => [step, []]));
  for (const note of statements.notes.all(workshop)) notes.get(note.step).push(noteOf(note));
  const steps = stepsOf(statements, workshop, projectId);
  return {
    id: idOf('ws', workshop),
    state: row.state,
    opened_at: row.opened_at,
    closed_at: row.closed_at,
    steps: STEPS.filter((step) => steps.has(step)).map((step) => ({
      step,
      confirmed_at: steps.get(step).confirmed_at,
      written_at: steps.get(step).written_at,
      checkpoint: isCheckpointStep(step),
      notes: notes.get(step),
    })),
    links: statements.links.all(workshop).map(linkOf),
  };
}

// The project space a name gives, { id, repository }, or project_not_found.
function projectOf(statements, name) {
  const row = statements.project.get(name);
  if (row === undefined) throw new Problem('project_not_found');
  return { id: Number(row.id), repository: row.repository };
}

// The project's open workshop, or workshop_closed: a change to the board needs one.
function openWorkshopOf(statements, projectId) {
  const row = statements.open.get(projectId);
  if (row === undefined) throw new Problem('workshop_closed');
  return { ...row, id: Number(row.id) };
}

// The live note of the open workshop an ID names, or note_not_found.
function liveNote(statements, workshop, id) {
  const key = keyOf('sn', id);
  const row = key === null ? undefined : statements.note.get(key, workshop);
  if (row === undefined || row.removed_at !== null) throw new Problem('note_not_found');
  return { ...row, id: key };
}

const stepNotes = (statements, workshop, step) => Number(statements.stepNotes.get(workshop, step).n);

// The grid place a note's place is, numbered row by row from 0, or null when it is none.
function slotOf(x, y) {
  const column = x / GRID.x;
  const row = y / GRID.y;
  if (!Number.isInteger(column) || !Number.isInteger(row) || column < 0 || column >= GRID.columns || row < 0) return null;
  return row * GRID.columns + column;
}

// The request's fields. Each refusal names the field and never repeats its value (rule 5).

function stepField(value, field) {
  if (typeof value !== 'string' || !STEPS.includes(value)) throw invalidRequest(field, `${field} must be one of the event storming steps`);
  return value;
}

const textField = (value, field) => boundedText(value, field, LIMITS.text, { empty: false });
const kindField = (value, field) => boundedText(value, field, LIMITS.kind, { empty: false });

// The field a body must have, named as the refusal names it (name, such as notes[2].text).
function required(body, field, name = field) {
  if (!Object.hasOwn(body, field)) throw invalidRequest(name, `${name} is required`);
  return body[field];
}

// NewNote: { step, kind, text, x, y }.
function newNoteOf(body) {
  onlyFields(body, new Set(['step', 'kind', 'text', 'x', 'y']));
  return {
    step: stepField(required(body, 'step'), 'step'),
    kind: kindField(required(body, 'kind'), 'kind'),
    text: textField(required(body, 'text'), 'text'),
    x: coordinateOf(required(body, 'x'), 'x'),
    y: coordinateOf(required(body, 'y'), 'y'),
  };
}

// NoteChange: at least one of step, text, x and y; the fields sent change.
function noteChangeOf(body) {
  onlyFields(body, new Set(['step', 'text', 'x', 'y']));
  if (Object.keys(body).length === 0) throw invalidRequest('body', 'the body changes at least one of step, text, x and y');
  return {
    step: Object.hasOwn(body, 'step') ? stepField(body.step, 'step') : undefined,
    text: Object.hasOwn(body, 'text') ? textField(body.text, 'text') : undefined,
    x: Object.hasOwn(body, 'x') ? coordinateOf(body.x, 'x') : undefined,
    y: Object.hasOwn(body, 'y') ? coordinateOf(body.y, 'y') : undefined,
  };
}

// NewNoteLink: { from, to }, two different notes.
function newLinkOf(body) {
  onlyFields(body, new Set(['from', 'to']));
  const from = formOf(body, 'from', { pattern: NOTE_ID, length: NOTE_ID_LENGTH, required: true });
  const to = formOf(body, 'to', { pattern: NOTE_ID, length: NOTE_ID_LENGTH, required: true });
  if (from === to) throw invalidRequest('to', 'a note cannot be linked to itself');
  return { from, to };
}

// StepDraft: { notes, remove }, notes of DraftNote { kind, text, confidence, x, y } and remove the IDs of the agent's
// notes to remove. A field of a note is named by its place, such as notes[2].text.
function draftOf(body) {
  onlyFields(body, new Set(['notes', 'remove']));
  const notes = required(body, 'notes');
  if (!Array.isArray(notes) || notes.length < 1 || notes.length > LIMITS.draft) {
    throw invalidRequest('notes', `notes must be a list of 1 to ${LIMITS.draft} notes`);
  }
  const drafted = notes.map((note, index) => {
    const at = `notes[${index}]`;
    if (typeof note !== 'object' || note === null || Array.isArray(note)) throw invalidRequest(at, `${at} must be a note`);
    if (Object.keys(note).some((field) => !['kind', 'text', 'confidence', 'x', 'y'].includes(field))) {
      throw invalidRequest(at, `${at} takes kind, text, confidence, x and y only`);
    }
    const confidence = required(note, 'confidence', `${at}.confidence`);
    if (!CONFIDENCES.has(confidence)) throw invalidRequest(`${at}.confidence`, `${at}.confidence must be certain, inferred or guess`);
    return {
      kind: kindField(required(note, 'kind', `${at}.kind`), `${at}.kind`),
      text: textField(required(note, 'text', `${at}.text`), `${at}.text`),
      confidence,
      x: Object.hasOwn(note, 'x') ? coordinateOf(note.x, `${at}.x`) : null,
      y: Object.hasOwn(note, 'y') ? coordinateOf(note.y, `${at}.y`) : null,
    };
  });
  let remove = [];
  if (Object.hasOwn(body, 'remove')) {
    remove = body.remove;
    const valid = Array.isArray(remove) && remove.length >= 1 && remove.length <= LIMITS.draft
      && remove.every((id) => typeof id === 'string' && NOTE_ID.test(id)) && new Set(remove).size === remove.length;
    if (!valid) throw invalidRequest('remove', `remove must be a list of 1 to ${LIMITS.draft} different note IDs`);
  }
  return { notes: drafted, remove };
}

// StepReport: { event, pull_request }.
function reportOf(body) {
  onlyFields(body, new Set(['event', 'pull_request']));
  const event = required(body, 'event');
  if (typeof event !== 'string' || !Object.hasOwn(EVENTS, event)) throw invalidRequest('event', 'event must be opened, merged or closed');
  const link = formOf(body, 'pull_request', { pattern: LINK, length: LINK_LENGTH, required: true });
  return { event, link };
}

// The number of the pull request a link names in the project's repository: invalid_request when it is no pull
// request's address, and repository_mismatch when it is one of another repository, or the project names none.
export function pullRequestNumber(link, repository) {
  const match = PULL.exec(link);
  const number = match === null ? null : Number(match[1]);
  if (number === null || !Number.isSafeInteger(number)) {
    throw invalidRequest('pull_request', 'pull_request must be the address of a pull request, ending in /pull/ and its number');
  }
  const own = pullRequestLink(repository, number);
  if (own === null || own.toLowerCase() !== link.toLowerCase()) throw new Problem('repository_mismatch');
  return number;
}

// The operations.

// API-284: opens a workshop with a frame per step (SPEC-036). One already open gets workshop_open, naming it.
function openWorkshop({ store, params, body, now }) {
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  emptyOf(body);
  const open = statements.open.get(project.id);
  if (open !== undefined) throw new Problem('workshop_open', undefined, {}, { workshop: idOf('ws', Number(open.id)) });
  const time = timeOf(now);
  const workshop = Number(statements.insertWorkshop.run(project.id, time).lastInsertRowid);
  for (const step of STEPS) statements.insertStep.run(project.id, workshop, step);
  return {
    status: 201,
    body: {
      id: idOf('ws', workshop),
      state: 'open',
      opened_at: time,
      closed_at: null,
      steps: STEPS.map((step) => ({ step, confirmed_at: null, written_at: null, checkpoint: isCheckpointStep(step), notes: [] })),
      links: [],
    },
  };
}

// API-285: the open workshop, or the last closed one, with its steps, notes and links (SPEC-036, SPEC-038).
function getWorkshop({ store, params }) {
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  const row = statements.latest.get(project.id);
  if (row === undefined) throw new Problem('workshop_not_found');
  return { body: workshopOf(statements, project.id, row) };
}

// API-286: adds the owner's note to a step's frame (SPEC-038).
function addNote({ store, params, body, now }) {
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  const note = newNoteOf(body);
  const workshop = openWorkshopOf(statements, project.id);
  if (stepNotes(statements, workshop.id, note.step) >= LIMITS.stepNotes) {
    throw invalidRequest('step', `a step holds at most ${LIMITS.stepNotes} notes`);
  }
  const time = timeOf(now);
  const { lastInsertRowid } = statements.insertNote.run(workshop.id, note.step, note.kind, note.text, note.x, note.y, 'owner', null, null, time);
  return {
    status: 201,
    body: noteOf({ id: lastInsertRowid, ...note, body: note.text, made_by: 'owner', confidence: null, from_miro: 0, created_at: time }),
  };
}

// API-287: changes the fields sent; the last change wins (SPEC-038). Renaming an agent's note makes it the owner's.
function changeNote({ store, params, body }) {
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  const change = noteChangeOf(body);
  const workshop = openWorkshopOf(statements, project.id);
  const row = liveNote(statements, workshop.id, params.note);
  const next = {
    ...row,
    step: change.step ?? row.step,
    body: change.text ?? row.body,
    x: change.x ?? Number(row.x),
    y: change.y ?? Number(row.y),
  };
  if (next.step !== row.step && stepNotes(statements, workshop.id, next.step) >= LIMITS.stepNotes) {
    throw invalidRequest('step', `a step holds at most ${LIMITS.stepNotes} notes`);
  }
  if (next.body !== row.body && row.made_by === 'agent') Object.assign(next, { made_by: 'owner', credential_id: null, confidence: null });
  statements.changeNote.run(next.step, next.body, next.x, next.y, next.made_by, next.credential_id, next.confidence, row.id);
  return { body: noteOf(next) };
}

// Removes a live note of the workshop and its live links.
function removeWithLinks(statements, workshop, key, time) {
  statements.removeNote.run(time, key);
  statements.removeNoteLinks.run(time, workshop, key, key);
}

// API-288: removes the note and its links (SPEC-038). Removed again: changed false.
function removeNote({ store, params, now }) {
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  const workshop = openWorkshopOf(statements, project.id);
  const key = keyOf('sn', params.note);
  const row = key === null ? undefined : statements.note.get(key, workshop.id);
  if (row === undefined) throw new Problem('note_not_found');
  const id = idOf('sn', key);
  if (row.removed_at !== null) return { body: { id, changed: false } };
  removeWithLinks(statements, workshop.id, key, timeOf(now));
  return { body: { id, changed: true } };
}

// API-289: links two notes (SPEC-038); the same link again answers 200 with it.
function connectNotes({ store, params, body, now }) {
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  const { from, to } = newLinkOf(body);
  const workshop = openWorkshopOf(statements, project.id);
  const fromKey = liveNote(statements, workshop.id, from).id;
  const toKey = liveNote(statements, workshop.id, to).id;
  const kept = statements.liveLink.get(workshop.id, fromKey, toKey);
  if (kept !== undefined) return { body: linkOf(kept) };
  if (Number(statements.linkCount.get(workshop.id).n) >= LIMITS.links) {
    throw invalidRequest('from', `a board holds at most ${LIMITS.links} links`);
  }
  const { lastInsertRowid } = statements.insertLink.run(workshop.id, fromKey, toKey, timeOf(now));
  return { status: 201, body: linkOf({ id: lastInsertRowid, from_note: fromKey, to_note: toKey, made_by: 'owner' }) };
}

// API-290: removes the link (SPEC-038). Removed again: changed false.
function removeNoteLink({ store, params, now }) {
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  const workshop = openWorkshopOf(statements, project.id);
  const key = keyOf('sl', params.link);
  const row = key === null ? undefined : statements.link.get(key, workshop.id);
  if (row === undefined) throw new Problem('note_link_not_found');
  const id = idOf('sl', key);
  if (row.removed_at !== null) return { body: { id, changed: false } };
  statements.removeLink.run(timeOf(now), key);
  return { body: { id, changed: true } };
}

// API-291: records the step confirmation (SPEC-039). Steps 1-b, 7 and 9 pass stage 01's checkpoint, and the agent
// to-do gets writing the step into the domain document. Confirmed again: changed false.
function confirmStep({ store, params, body, now }) {
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  emptyOf(body);
  const workshop = openWorkshopOf(statements, project.id);
  const step = stepsOf(statements, workshop.id, project.id).get(params.step);
  const answer = (confirmedAt, changed) => ({
    body: { workshop: idOf('ws', workshop.id), step: params.step, confirmed_at: confirmedAt, checkpoint: isCheckpointStep(params.step), changed },
  });
  if (step.confirmed_at !== null) return answer(step.confirmed_at, false);
  if (stepNotes(statements, workshop.id, params.step) === 0) throw new Problem('step_empty');
  const time = timeOf(now);
  statements.confirm.run(time, workshop.id, params.step);
  if (isCheckpointStep(params.step)) statements.pass.run(project.id, DOMAIN_STAGE, time);
  stepsChanged(store, { project: project.id, workshop: workshop.id, time });
  return answer(time, true);
}

// API-260: places the agent's notes in the step's frame, each with its confidence label (SPEC-037), and removes the
// agent's own notes it names; a note a person made cannot be removed (REQ-047).
function draftWorkshopStep({ store, params, request, body, credential, now }) {
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  sessionOf(request.headers, { required: true });
  const draft = draftOf(body);
  const workshop = openWorkshopOf(statements, project.id);
  if (stepsOf(statements, workshop.id, project.id).get(params.step).confirmed_at !== null) throw new Problem('step_confirmed');
  const removing = [];
  for (const id of draft.remove) {
    const key = keyOf('sn', id);
    const row = key === null ? undefined : statements.note.get(key, workshop.id);
    if (row === undefined || row.step !== params.step) throw new Problem('note_not_found');
    if (row.removed_at !== null) continue;
    if (row.made_by !== 'agent') throw new Problem('note_made_by_owner');
    removing.push(key);
  }
  const live = stepNotes(statements, workshop.id, params.step) - removing.length;
  if (live + draft.notes.length > LIMITS.stepNotes) throw invalidRequest('notes', `a step holds at most ${LIMITS.stepNotes} notes`);
  const time = timeOf(now);
  for (const key of removing) removeWithLinks(statements, workshop.id, key, time);
  // The grid places the step's live notes and the draft's placed notes hold; a note without a place takes the next
  // free one, so that no note lands on another.
  const taken = new Set();
  const hold = (x, y) => {
    const slot = slotOf(x, y);
    if (slot !== null) taken.add(slot);
  };
  for (const row of statements.stepPlaces.all(workshop.id, params.step)) hold(Number(row.x), Number(row.y));
  for (const note of draft.notes) if (note.x !== null && note.y !== null) hold(note.x, note.y);
  let free = 0;
  const placed = draft.notes.map((note) => {
    let { x, y } = note;
    if (x === null || y === null) {
      while (taken.has(free)) free += 1;
      taken.add(free);
      x ??= (free % GRID.columns) * GRID.x;
      y ??= Math.floor(free / GRID.columns) * GRID.y;
    }
    const { lastInsertRowid } = statements.insertNote.run(
      workshop.id, params.step, note.kind, note.text, x, y, 'agent', credential.key, note.confidence, time,
    );
    return noteOf({
      id: lastInsertRowid, step: params.step, kind: note.kind, body: note.text, x, y, made_by: 'agent',
      confidence: note.confidence, from_miro: 0, created_at: time,
    });
  });
  return { status: 201, body: { workshop: idOf('ws', workshop.id), step: params.step, notes: placed, removed: removing.length } };
}

// API-261: reports the pull request that writes a confirmed step into the domain document. The steps linked to a
// pull request follow it: written once it is merged, unlinked once it closes. When every step is written, the
// workshop closes and the domain document is the source again (SPEC-040).
function reportStepWritten({ store, params, request, body, credential, now }) {
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  sessionOf(request.headers, { required: true });
  const { event, link } = reportOf(body);
  const workshop = openWorkshopOf(statements, project.id);
  const steps = stepsOf(statements, workshop.id, project.id);
  const step = steps.get(params.step);
  if (step.confirmed_at === null) {
    const open = STEPS.filter((name) => steps.has(name) && steps.get(name).confirmed_at === null);
    throw new Problem('steps_open', undefined, {}, { steps: open });
  }
  const number = pullRequestNumber(link, project.repository);
  const answer = (changed, writtenAt, state = 'open') => ({
    body: { workshop: idOf('ws', workshop.id), step: params.step, workshop_state: state, written_at: writtenAt, changed },
  });
  if (step.written_at !== null) return answer(false, step.written_at);
  const row = statements.pullRequest.get(project.id, number);
  if (row !== undefined && row.purpose !== 'domain_document') {
    throw invalidRequest('pull_request', 'this pull request was reported for other work than the domain document');
  }
  // A pull request never reported that closed links no step, so nothing is kept of it.
  if (row === undefined && event === 'closed') return answer(false, null);
  const time = timeOf(now);
  // The pull request moves on: open to merged or closed, closed to open again or merged; a merged one stays merged.
  let changed = false;
  let pullRequest;
  let state;
  if (row === undefined) {
    state = EVENTS[event];
    pullRequest = Number(statements.insertPullRequest.run(project.id, number, state, time, state === 'open' ? null : time, credential.key).lastInsertRowid);
    changed = true;
  } else {
    pullRequest = Number(row.id);
    state = row.state === 'merged' ? 'merged' : EVENTS[event];
    if (state !== row.state) {
      statements.setPullRequest.run(state, state === 'open' ? null : time, pullRequest);
      changed = true;
    }
  }
  // opened and merged link the step to the pull request unless it is closed; closed links none.
  const linked = step.pull_request_id === null ? null : Number(step.pull_request_id);
  if (event !== 'closed' && state !== 'closed' && linked !== pullRequest) {
    statements.linkStep.run(pullRequest, workshop.id, params.step);
    changed = true;
  }
  if (state === 'merged' && statements.writeLinked.run(time, workshop.id, pullRequest).changes > 0) changed = true;
  if (state === 'closed' && statements.unlinkSteps.run(workshop.id, pullRequest).changes > 0) changed = true;
  if (!changed) return answer(false, null);
  stepsChanged(store, { project: project.id, workshop: workshop.id, time });
  const after = stepsOf(statements, workshop.id, project.id);
  const done = STEPS.every((name) => after.get(name).written_at !== null);
  if (done) statements.closeWorkshop.run(time, workshop.id);
  return answer(true, after.get(params.step).written_at, done ? 'closed' : 'open');
}

// API-292: adds the sticky notes and connectors of a Miro board export to the open workshop as the owner's notes and
// links (SPEC-041), all or none: a step that would pass 1000 live notes, or a board 2000 live links, refuses the whole
// file. Each import adds its notes again; a retry with its request key gets the first answer.
function importMiroBoard({ store, params, body, now }) {
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  const { notes, links } = readMiroBoard(body, LIMITS.text);
  const workshop = openWorkshopOf(statements, project.id);
  const added = new Map();
  for (const { step } of notes) added.set(step, (added.get(step) ?? 0) + 1);
  for (const [step, count] of added) {
    if (stepNotes(statements, workshop.id, step) + count > LIMITS.stepNotes) {
      throw invalidRequest('data', `the import would put more than ${LIMITS.stepNotes} notes in a step`);
    }
  }
  if (Number(statements.linkCount.get(workshop.id).n) + links.length > LIMITS.links) {
    throw invalidRequest('data', `the import would put more than ${LIMITS.links} links on the board`);
  }
  const time = timeOf(now);
  const keys = notes.map(({ step, kind, text, x, y }) => Number(statements.importNote.run(workshop.id, step, kind, text, x, y, time).lastInsertRowid));
  for (const { from, to } of links) statements.insertLink.run(workshop.id, keys[from], keys[to], time);
  return { status: 201, body: { workshop: idOf('ws', workshop.id), notes: notes.length, links: links.length } };
}

// The routes of the eleven operations (see router.js): API-260 and API-261 of the agent family, the rest of the owner's.
// Each write takes its request key (rule 3).
const WRITE = Object.freeze({ requestKey: true });
const PROJECT = Object.freeze({ project: 'project_not_found' });

export const WORKSHOP_ROUTES = Object.freeze([
  {
    ...WRITE,
    method: 'POST',
    path: '/api/spaces/{project}/workshop/steps/{step}/draft',
    action: 'draftWorkshopStep',
    params: { ...PROJECT, step: 'step_not_found' },
    body: 'json',
    handle: draftWorkshopStep,
  },
  {
    ...WRITE,
    method: 'POST',
    path: '/api/spaces/{project}/workshop/steps/{step}/report',
    action: 'reportStepWritten',
    params: { ...PROJECT, step: 'step_not_found' },
    body: 'json',
    handle: reportStepWritten,
  },
  { ...WRITE, method: 'POST', path: '/api/projects/{project}/workshop', action: 'openWorkshop', params: PROJECT, body: 'json', handle: openWorkshop },
  { method: 'GET', path: '/api/projects/{project}/workshop', action: 'getWorkshop', params: PROJECT, handle: getWorkshop },
  { ...WRITE, method: 'POST', path: '/api/projects/{project}/workshop/notes', action: 'addNote', params: PROJECT, body: 'json', handle: addNote },
  {
    ...WRITE,
    method: 'PATCH',
    path: '/api/projects/{project}/workshop/notes/{note}',
    action: 'changeNote',
    params: { ...PROJECT, note: 'note_not_found' },
    body: 'json',
    handle: changeNote,
  },
  {
    ...WRITE,
    method: 'DELETE',
    path: '/api/projects/{project}/workshop/notes/{note}',
    action: 'removeNote',
    params: { ...PROJECT, note: 'note_not_found' },
    handle: removeNote,
  },
  { ...WRITE, method: 'POST', path: '/api/projects/{project}/workshop/links', action: 'connectNotes', params: PROJECT, body: 'json', handle: connectNotes },
  {
    ...WRITE,
    method: 'DELETE',
    path: '/api/projects/{project}/workshop/links/{link}',
    action: 'removeNoteLink',
    params: { ...PROJECT, link: 'note_link_not_found' },
    handle: removeNoteLink,
  },
  {
    ...WRITE,
    method: 'POST',
    path: '/api/projects/{project}/workshop/steps/{step}/confirm',
    action: 'confirmStep',
    params: { ...PROJECT, step: 'step_not_found' },
    body: 'json',
    handle: confirmStep,
  },
  {
    ...WRITE,
    method: 'POST',
    path: '/api/projects/{project}/workshop/imports',
    action: 'importMiroBoard',
    params: PROJECT,
    body: 'miro',
    handle: importMiroBoard,
  },
]);
