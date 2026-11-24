// The workshop (TASK-452; API-260, API-261, API-284 to API-291; SPEC-036 to SPEC-040, REQ-047, rule 5): opening a
// board with a frame per step, the owner's sticky notes and links, the agent's step drafts, confirming a step and the
// agent's report of the pull request that writes it, with every response the ten operations list, their answers
// against the contract, the tables they touch (note 23) and their log lines. NEXUS calls no AI model: the agent's
// notes come through the API, as here.

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { idOf } from '../src/ids.js';
import { STEPS } from '../src/params.js';
import { ROUTES } from '../src/routes.js';
import { openStore } from '../src/store.js';
import { GRID, pullRequestNumber } from '../src/workshop.js';
import { responseRecord } from './responses.js';
import { closedEntries, openEntries, REPOSITORY, seed } from './seed.js';
import { exchange, head, localGate, newId, startServer, testStore, TRACE_ID } from './support.js';
import { checkLayer, checkTables, recordTables } from './tables.js';

const JSON_TYPE = { 'Content-Type': 'application/json' };
const MiB = 1024 * 1024;
const START = Date.parse('2026-11-24T01:00:00.000Z');
const at = (minutes) => new Date(START + minutes * 60 * 1000).toISOString();
const SESSION = 'claude-code-4f2a91';
const CHECKPOINTS = new Set(['1-b', '7', '9']);
const OWNER_WRITES = ['openWorkshop', 'addNote', 'changeNote', 'removeNote', 'connectNotes', 'removeNoteLink', 'confirmStep'];
const ACTIONS = ['draftWorkshopStep', 'reportStepWritten', ...OWNER_WRITES, 'getWorkshop'];

describe('workshop', () => {
  const responses = responseRecord();
  const clock = { now: START };
  let folder;
  let db;
  let recorder;
  let local;
  let server;
  let s;

  const owner = () => ({ 'Cf-Access-Jwt-Assertion': local.token() });
  const key = () => ({ 'Idempotency-Key': `"${newId('nw')}"` });
  const agent = (credential = s.agent) => ({ ...credential.headers, 'Nexus-Session': SESSION });
  // Headers with those given as undefined left out, so that a test can send a request without one.
  const clean = (headers) => Object.fromEntries(Object.entries(headers).filter(([, value]) => value !== undefined));
  const call = async (action, { method = 'POST', path, headers, body }) => responses.note(action, await server.send({
    method,
    path,
    headers: clean({ ...(body === undefined ? {} : JSON_TYPE), ...headers }),
    body: body === undefined || typeof body === 'string' ? body : JSON.stringify(body),
  }));
  const board = (name) => `/api/projects/${name}/workshop`;
  const open = (name, headers = {}, body = {}) => call('openWorkshop', { path: board(name), headers: { ...owner(), ...key(), ...headers }, body });
  const read = (name, headers = {}) => call('getWorkshop', { method: 'GET', path: board(name), headers: { ...owner(), ...headers } });
  const add = (name, note, headers = {}) => call('addNote', { path: `${board(name)}/notes`, headers: { ...owner(), ...key(), ...headers }, body: note });
  const change = (name, id, fields, headers = {}) => call('changeNote', {
    method: 'PATCH', path: `${board(name)}/notes/${id}`, headers: { ...owner(), ...key(), ...headers }, body: fields,
  });
  const remove = (name, id, headers = {}) => call('removeNote', { method: 'DELETE', path: `${board(name)}/notes/${id}`, headers: { ...owner(), ...key(), ...headers } });
  const connect = (name, from, to, headers = {}) => call('connectNotes', { path: `${board(name)}/links`, headers: { ...owner(), ...key(), ...headers }, body: { from, to } });
  const unlink = (name, id, headers = {}) => call('removeNoteLink', { method: 'DELETE', path: `${board(name)}/links/${id}`, headers: { ...owner(), ...key(), ...headers } });
  const confirm = (name, step, headers = {}, body = {}) => call('confirmStep', {
    path: `${board(name)}/steps/${step}/confirm`, headers: { ...owner(), ...key(), ...headers }, body,
  });
  const draft = (name, step, body, headers = {}) => call('draftWorkshopStep', {
    path: `/api/spaces/${name}/workshop/steps/${step}/draft`, headers: { ...agent(), ...key(), ...headers }, body,
  });
  const report = (name, step, body, headers = {}) => call('reportStepWritten', {
    path: `/api/spaces/${name}/workshop/steps/${step}/report`, headers: { ...agent(), ...key(), ...headers }, body,
  });
  const note = (step, text = 'Credential revoked', extra = {}) => ({ step, kind: 'event', text, x: 10, y: 20, ...extra });
  const drafted = (text, confidence = 'inferred', extra = {}) => ({ kind: 'event', text, confidence, ...extra });
  const pull = (number, repository = REPOSITORY) => `${repository}/pull/${number}`;
  const workshopRow = (id) => ({ ...db.prepare('SELECT state, closed_at FROM workshops WHERE id = ?').get(id) });
  const stepRow = (workshop, step) => db.prepare('SELECT confirmed_at, written_at, pull_request_id FROM workshop_steps WHERE workshop_id = ? AND step = ?').get(workshop, step);
  const passes = (space) => db.prepare('SELECT stage, passed_at FROM stage_passes WHERE project_id = ? ORDER BY id').all(space.id).map((row) => ({ ...row }));
  const noteRows = (workshop) => db.prepare('SELECT id, step, made_by, credential_id, confidence, removed_at FROM sticky_notes WHERE workshop_id = ? ORDER BY id').all(workshop);
  // Writes notes straight into a step, as many as count, made by the owner.
  const fill = (workshop, step, count) => {
    const insert = db.prepare("INSERT INTO sticky_notes (workshop_id, step, kind, body, x, y, made_by, created_at) VALUES (?, ?, 'event', 'n', 0, 0, 'owner', ?)");
    const keys = [];
    for (let index = 0; index < count; index += 1) keys.push(Number(insert.run(workshop, step, at(0)).lastInsertRowid));
    return keys;
  };
  const refusedOn = (answer, field, code = 'invalid_request') => assert.deepEqual([answer.status, answer.json.code, answer.json.field], [400, code, field]);
  const problem = (answer) => [answer.status, answer.json.code];
  // A project with an open workshop opened through API-284: { space, workshop, id }.
  const opened = async (options = {}) => {
    const space = s.project(undefined, options);
    const answer = await open(space.name);
    assert.equal(answer.status, 201);
    return { space, id: answer.json.id, workshop: Number(db.prepare('SELECT id FROM workshops WHERE project_id = ?').get(space.id).id) };
  };

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-workshop-'));
    ({ db } = openStore(folder));
    recorder = recordTables(db);
    local = localGate();
    server = await startServer({ store: recorder.store, gate: local.gate, routes: ROUTES, now: () => clock.now });
    s = seed(db);
  });

  after(async () => {
    await server.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  test('opens a board with a frame per step as the source, and one already open is named (SPEC-036)', async () => {
    const space = s.project();
    clock.now = Date.parse(at(1));
    const first = await open(space.name);
    assert.equal(first.status, 201);
    const workshop = Number(db.prepare('SELECT id FROM workshops WHERE project_id = ?').get(space.id).id);
    assert.deepEqual(first.json, {
      id: idOf('ws', workshop),
      state: 'open',
      opened_at: at(1),
      closed_at: null,
      steps: STEPS.map((step) => ({ step, confirmed_at: null, written_at: null, checkpoint: CHECKPOINTS.has(step), notes: [] })),
      links: [],
    });
    assert.equal(STEPS.length, 11);
    const again = await open(space.name);
    assert.deepEqual([...problem(again), again.json.workshop], [409, 'workshop_open', first.json.id]);
    assert.deepEqual((await read(space.name)).json, first.json);
    // The project read names it.
    const project = await server.send({ path: `/api/projects/${space.name}`, headers: owner() });
    assert.deepEqual(project.json.workshop, { id: first.json.id, state: 'open' });
  });

  test('reads the open workshop, or else the last closed one, and workshop_not_found without one', async () => {
    const space = s.project();
    assert.deepEqual(problem(await read(space.name)), [404, 'workshop_not_found']);
    const old = s.workshop(space);
    s.closeWorkshop(old);
    const closed = await read(space.name);
    assert.deepEqual([closed.status, closed.json.id, closed.json.state, closed.json.closed_at], [200, idOf('ws', old), 'closed', '2026-11-23T01:00:00.000Z']);
    const fresh = await open(space.name);
    assert.equal((await read(space.name)).json.id, fresh.json.id);
    assert.notEqual(fresh.json.id, closed.json.id);
  });

  test('the owner adds, moves, renames, connects and removes notes; a removed note takes its links with it (SPEC-038)', async () => {
    const { space, workshop } = await opened();
    clock.now = Date.parse(at(2));
    const event = await add(space.name, note('1', 'Meeting created', { x: -40.5, y: 1_000_000 }));
    assert.equal(event.status, 201);
    const [row] = noteRows(workshop);
    assert.deepEqual(event.json, {
      id: idOf('sn', Number(row.id)), step: '1', kind: 'event', text: 'Meeting created', x: -40.5, y: 1_000_000,
      made_by: 'owner', confidence: null, from_miro: false, created_at: at(2),
    });
    const command = (await add(space.name, { step: '3', kind: 'command', text: '모임 만들기', x: 0, y: 0 })).json;
    const hotspot = (await add(space.name, { step: '4', kind: 'hotspot', text: 'Who may cancel?', x: 5, y: 5 })).json;
    // Changes only the fields sent; the last change wins.
    const moved = await change(space.name, event.json.id, { x: 300 });
    assert.deepEqual([moved.status, moved.json.x, moved.json.y, moved.json.text], [200, 300, 1_000_000, 'Meeting created']);
    const renamed = await change(space.name, event.json.id, { text: 'Meeting opened', step: '1-b', y: 12 });
    assert.deepEqual([renamed.json.step, renamed.json.text, renamed.json.x, renamed.json.y], ['1-b', 'Meeting opened', 300, 12]);
    // Links are directed: the same from and to is the same link, the reverse another; across steps too.
    const link = await connect(space.name, command.id, event.json.id);
    assert.equal(link.status, 201);
    assert.deepEqual(link.json, { id: link.json.id, from: command.id, to: event.json.id, made_by: 'owner' });
    const same = await connect(space.name, command.id, event.json.id);
    assert.deepEqual([same.status, same.json], [200, link.json]);
    const reverse = await connect(space.name, event.json.id, command.id);
    assert.equal(reverse.status, 201);
    assert.notEqual(reverse.json.id, link.json.id);
    const other = (await connect(space.name, command.id, hotspot.id)).json;
    // Removing a link, and again: changed false.
    assert.deepEqual((await unlink(space.name, other.id)).json, { id: other.id, changed: true });
    assert.deepEqual((await unlink(space.name, other.id)).json, { id: other.id, changed: false });
    // Removing a note removes its live links; removed again, changed false.
    clock.now = Date.parse(at(3));
    assert.deepEqual((await remove(space.name, event.json.id)).json, { id: event.json.id, changed: true });
    assert.deepEqual((await remove(space.name, event.json.id)).json, { id: event.json.id, changed: false });
    const linkRows = db.prepare('SELECT removed_at FROM sticky_links WHERE workshop_id = ? ORDER BY id').all(workshop).map((each) => each.removed_at);
    assert.deepEqual(linkRows, [at(3), at(3), at(2)]);
    // A removed link of a removed note is changed false too.
    assert.deepEqual((await unlink(space.name, link.json.id)).json, { id: link.json.id, changed: false });
    const shown = (await read(space.name)).json;
    assert.deepEqual(shown.steps.flatMap((step) => step.notes.map((each) => [step.step, each.id])), [['3', command.id], ['4', hotspot.id]]);
    assert.deepEqual(shown.links, []);
    // A removed note can no longer change or be linked.
    assert.deepEqual(problem(await change(space.name, event.json.id, { x: 1 })), [404, 'note_not_found']);
    assert.deepEqual(problem(await connect(space.name, command.id, event.json.id)), [404, 'note_not_found']);
  });

  test('the agent drafts a step with confidence labels, placing a note without a place on the frame\'s grid (SPEC-037)', async () => {
    const { space, id } = await opened();
    clock.now = Date.parse(at(4));
    const notes = Array.from({ length: 10 }, (_, index) => drafted(`Event ${index}`, ['certain', 'inferred', 'guess'][index % 3]));
    notes[6] = drafted('Placed', 'certain', { x: 999.5, y: -3 });
    notes[7] = drafted('Half placed', 'guess', { y: 77 });
    const answer = await draft(space.name, '2', { notes });
    assert.equal(answer.status, 201);
    assert.deepEqual([answer.json.workshop, answer.json.step, answer.json.removed, answer.json.notes.length], [id, '2', 0, 10]);
    // Given step 2 is open, when the agent drafts 10 notes, then 10 notes with labels show in frame 2.
    const frame = (await read(space.name)).json.steps.find((step) => step.step === '2');
    assert.deepEqual(frame.notes, answer.json.notes);
    assert.deepEqual(frame.notes.map((each) => [each.text, each.confidence, each.made_by, each.from_miro, each.created_at]), notes.map((each) => [each.text, each.confidence, 'agent', false, at(4)]));
    const grid = (slot) => [(slot % GRID.columns) * GRID.x, Math.floor(slot / GRID.columns) * GRID.y];
    // A note placed in full holds no grid place; one placed in half takes the next place's other coordinate.
    assert.deepEqual(frame.notes.map((each) => [each.x, each.y]), [
      grid(0), grid(1), grid(2), grid(3), grid(4), grid(5), [999.5, -3], [grid(6)[0], 77], grid(7), grid(8),
    ]);
    // The next draft takes the first place no live note holds: the half-placed note left grid(6) free.
    const more = await draft(space.name, '2', { notes: [drafted('Event 10'), drafted('Event 11')] });
    assert.deepEqual(more.json.notes.map((each) => [each.x, each.y]), [grid(6), grid(9)]);
    // Each agent note names its credential.
    const credentials = new Set(db.prepare("SELECT credential_id FROM sticky_notes WHERE made_by = 'agent' AND step = '2'").all().map((row) => Number(row.credential_id)));
    assert.deepEqual([...credentials], [s.agent.key]);
  });

  test('a draft never places a note on another: removed places are taken again, and those the owner holds are passed over', async () => {
    const { space } = await opened();
    const grid = (slot) => [(slot % GRID.columns) * GRID.x, Math.floor(slot / GRID.columns) * GRID.y];
    const first = (await draft(space.name, '4', { notes: ['A', 'B', 'C', 'D', 'E'].map((text) => drafted(text)) })).json.notes;
    // The owner puts a note on grid(5) and another off the grid.
    await add(space.name, { ...note('4', 'Owner on the grid'), x: grid(5)[0], y: grid(5)[1] });
    await add(space.name, { ...note('4', 'Owner off the grid'), x: 7, y: 9 });
    const second = await draft(space.name, '4', { notes: [drafted('F'), drafted('G'), drafted('H')], remove: [first[0].id, first[1].id] });
    assert.deepEqual(second.json.notes.map((each) => [each.x, each.y]), [grid(0), grid(1), grid(6)]);
    const places = (await read(space.name)).json.steps.find((step) => step.step === '4').notes.map((each) => `${each.x},${each.y}`);
    assert.equal(new Set(places).size, places.length);
  });

  test('a draft removes the agent\'s own notes of its step with their links, and never a note a person made (REQ-047)', async () => {
    const { space, workshop } = await opened();
    const mine = (await draft(space.name, '5', { notes: [drafted('Member'), drafted('Organiser'), drafted('Guest')] })).json.notes;
    // Another credential's note counts as the agent's own.
    const otherAgent = s.credential();
    const theirs = (await draft(space.name, '5', { notes: [drafted('Host')] }, agent(otherAgent))).json.notes[0];
    const persons = (await add(space.name, note('5', 'Librarian'))).json;
    const elsewhere = (await draft(space.name, '6', { notes: [drafted('Meeting')] })).json.notes[0];
    const link = (await connect(space.name, persons.id, mine[0].id)).json;
    // Given a note the owner made, when an agent sends a change removing it, then the change is refused and the note stays.
    const refused = await draft(space.name, '5', { notes: [drafted('Reader')], remove: [persons.id] });
    assert.deepEqual(problem(refused), [409, 'note_made_by_owner']);
    assert.equal(noteRows(workshop).find((row) => idOf('sn', Number(row.id)) === persons.id).removed_at, null);
    // A note of another step, or an ID the board does not hold, is not found; nothing is written.
    assert.deepEqual(problem(await draft(space.name, '5', { notes: [drafted('Reader')], remove: [elsewhere.id] })), [404, 'note_not_found']);
    assert.deepEqual(problem(await draft(space.name, '5', { notes: [drafted('Reader')], remove: [newId('sn')] })), [404, 'note_not_found']);
    assert.equal((await read(space.name)).json.steps.find((step) => step.step === '5').notes.length, 5);
    clock.now = Date.parse(at(5));
    const replaced = await draft(space.name, '5', { notes: [drafted('Reader')], remove: [mine[0].id, theirs.id] });
    assert.deepEqual([replaced.status, replaced.json.removed], [201, 2]);
    // Its links went with it, the person's included.
    assert.equal(db.prepare('SELECT removed_at FROM sticky_links WHERE id = ?').get(Number(db.prepare('SELECT id FROM sticky_links WHERE workshop_id = ?').get(workshop).id)).removed_at, at(5));
    assert.deepEqual((await read(space.name)).json.links.map((each) => each.id).includes(link.id), false);
    // A note already removed is passed over and not counted.
    const again = await draft(space.name, '5', { notes: [drafted('Writer')], remove: [mine[0].id] });
    assert.deepEqual([again.status, again.json.removed], [201, 0]);
    const left = (await read(space.name)).json.steps.find((step) => step.step === '5').notes.map((each) => each.text);
    assert.deepEqual(left, ['Organiser', 'Guest', 'Librarian', 'Reader', 'Writer']);
  });

  test('an owner\'s rename makes an agent\'s note the owner\'s, while a move keeps who made it', async () => {
    const { space, workshop } = await opened();
    const [kept, renamedNote] = (await draft(space.name, '3', { notes: [drafted('Join'), drafted('Leave', 'guess')] })).json.notes;
    const moved = await change(space.name, kept.id, { x: 50, y: 60, step: '4' });
    assert.deepEqual([moved.json.made_by, moved.json.confidence, moved.json.step], ['agent', 'inferred', '4']);
    // The same text again is no rename.
    const same = await change(space.name, renamedNote.id, { text: 'Leave' });
    assert.deepEqual([same.json.made_by, same.json.confidence], ['agent', 'guess']);
    const renamed = await change(space.name, renamedNote.id, { text: 'Leave the meeting' });
    assert.deepEqual([renamed.json.made_by, renamed.json.confidence, renamed.json.text], ['owner', null, 'Leave the meeting']);
    const row = noteRows(workshop).find((each) => idOf('sn', Number(each.id)) === renamedNote.id);
    assert.deepEqual([row.made_by, row.credential_id, row.confidence], ['owner', null, null]);
    assert.deepEqual(problem(await draft(space.name, '3', { notes: [drafted('Stay')], remove: [renamedNote.id] })), [409, 'note_made_by_owner']);
    // The agent still removes the note the owner only moved, from its new step.
    assert.equal((await draft(space.name, '4', { notes: [drafted('Stay')], remove: [kept.id] })).json.removed, 1);
  });

  test('confirms a step: steps 1-b, 7 and 9 pass stage 01, the agent to-do gets writing it, and again changes nothing (SPEC-039)', async () => {
    const { space, workshop, id } = await opened();
    assert.deepEqual(problem(await confirm(space.name, '7')), [409, 'step_empty']);
    await add(space.name, note('7', 'Bounded context: Meeting'));
    await add(space.name, note('3', 'Create a meeting'));
    // Given step 7 with notes, when the owner confirms it, then the stage-01 checkpoint at step 7 is passed and the
    // agent to-do lists writing step 7.
    clock.now = Date.parse(at(6));
    const confirmed = await confirm(space.name, '7');
    assert.deepEqual(confirmed.json, { workshop: id, step: '7', confirmed_at: at(6), checkpoint: true, changed: true });
    assert.deepEqual(passes(space), [{ stage: '01-domain', passed_at: at(6) }]);
    assert.deepEqual(openEntries(db, space.id), [{ side: 'agent', kind: 'write_step', workshop_id: workshop, step: '7' }]);
    const todo = await server.send({ path: `/api/spaces/${space.name}/todo`, headers: agent() });
    assert.deepEqual(todo.json.steps, { total: 1, entries: [{ workshop: id, step: '7', confirmed_at: at(6), checkpoint: true }] });
    // Confirmed again: the same result, nothing written.
    clock.now = Date.parse(at(7));
    assert.deepEqual((await confirm(space.name, '7')).json, { ...confirmed.json, changed: false });
    assert.equal(passes(space).length, 1);
    // Any order; a step that is no checkpoint passes nothing.
    const third = await confirm(space.name, '3');
    assert.deepEqual([third.json.checkpoint, third.json.changed], [false, true]);
    assert.equal(passes(space).length, 1);
    // The owner may still change a confirmed step's notes, and it stays confirmed; the agent's draft is refused.
    assert.equal((await add(space.name, note('7', 'Bounded context: Member'))).status, 201);
    assert.equal(stepRow(workshop, '7').confirmed_at, at(6));
    assert.deepEqual(problem(await draft(space.name, '7', { notes: [drafted('Context map')] })), [409, 'step_confirmed']);
    // A confirmed step whose notes are all removed confirms again as it was.
    const shown = (await read(space.name)).json.steps.find((step) => step.step === '7');
    for (const each of shown.notes) await remove(space.name, each.id);
    assert.deepEqual((await confirm(space.name, '7')).json.changed, false);
  });

  test('a report links the pull request, writes the step when it merges, and closes its entry (SPEC-039, SPEC-040)', async () => {
    const { space, workshop, id } = await opened();
    await add(space.name, note('1', 'Meeting created'));
    await add(space.name, note('2', 'Mail service'));
    await confirm(space.name, '1');
    await confirm(space.name, '2');
    clock.now = Date.parse(at(8));
    const openedReport = await report(space.name, '1', { event: 'opened', pull_request: pull(41) });
    assert.deepEqual(openedReport.json, { workshop: id, step: '1', workshop_state: 'open', written_at: null, changed: true });
    const pullRequest = db.prepare('SELECT id, purpose, number, state, reported_at, closed_at, credential_id FROM pull_requests WHERE project_id = ?').get(space.id);
    assert.deepEqual({ ...pullRequest, id: undefined }, {
      id: undefined, purpose: 'domain_document', number: 41, state: 'open', reported_at: at(8), closed_at: null, credential_id: s.agent.key,
    });
    assert.equal(stepRow(workshop, '1').pull_request_id, pullRequest.id);
    assert.deepEqual((await report(space.name, '1', { event: 'opened', pull_request: pull(41) })).json.changed, false);
    // Closed without merging: the step is unlinked and still waits; opened again, linked again.
    clock.now = Date.parse(at(9));
    assert.deepEqual((await report(space.name, '1', { event: 'closed', pull_request: pull(41) })).json, { ...openedReport.json, changed: true });
    assert.deepEqual([stepRow(workshop, '1').pull_request_id, db.prepare('SELECT state, closed_at FROM pull_requests WHERE id = ?').get(pullRequest.id).closed_at], [null, at(9)]);
    await report(space.name, '1', { event: 'opened', pull_request: pull(41) });
    assert.equal(stepRow(workshop, '1').pull_request_id, pullRequest.id);
    // One pull request writes both steps: merged writes every step linked to it and closes their entries.
    await report(space.name, '2', { event: 'opened', pull_request: pull(41) });
    clock.now = Date.parse(at(10));
    const merged = await report(space.name, '1', { event: 'merged', pull_request: pull(41) });
    assert.deepEqual(merged.json, { workshop: id, step: '1', workshop_state: 'open', written_at: at(10), changed: true });
    assert.deepEqual({ ...db.prepare('SELECT state, closed_at FROM pull_requests WHERE id = ?').get(pullRequest.id) }, { state: 'merged', closed_at: at(10) });
    assert.equal(stepRow(workshop, '2').written_at, at(10));
    assert.deepEqual(openEntries(db, space.id), []);
    assert.deepEqual(closedEntries(db, space.id), [{ kind: 'write_step', reason: 'done', step: '1' }, { kind: 'write_step', reason: 'done', step: '2' }]);
    // A written step stays written, whatever is reported of it.
    const second = await report(space.name, '2', { event: 'merged', pull_request: pull(41) });
    assert.deepEqual(second.json, { ...merged.json, step: '2', changed: false });
    const later = await report(space.name, '1', { event: 'closed', pull_request: pull(42) });
    assert.deepEqual(later.json, { ...merged.json, changed: false });
    assert.equal(stepRow(workshop, '1').written_at, at(10));
    const shown = (await read(space.name)).json.steps.filter((step) => ['1', '2'].includes(step.step)).map((step) => step.written_at);
    assert.deepEqual(shown, [at(10), at(10)]);
    // A pull request never reported that is reported closed keeps nothing, and the pull request 42 above was not kept.
    assert.deepEqual(db.prepare('SELECT number FROM pull_requests WHERE project_id = ?').all(space.id).map((row) => row.number), [41]);
  });

  test('every step linked to a pull request follows it, and a merged pull request stays merged', async () => {
    const { space, workshop } = await opened();
    for (const step of ['3', '4', '5']) {
      await add(space.name, note(step, `Step ${step}`));
      await confirm(space.name, step);
    }
    await report(space.name, '3', { event: 'opened', pull_request: pull(50) });
    await report(space.name, '4', { event: 'opened', pull_request: pull(50) });
    // Closed: both steps are unlinked, whichever step the report names.
    const closed = await report(space.name, '5', { event: 'closed', pull_request: pull(50) });
    assert.deepEqual([closed.json.changed, closed.json.written_at], [true, null]);
    assert.deepEqual(['3', '4', '5'].map((step) => stepRow(workshop, step).pull_request_id), [null, null, null]);
    // Reopened for step 3 alone, then merged: step 3 is written, step 4 waits for a report of its own.
    await report(space.name, '3', { event: 'opened', pull_request: pull(50) });
    clock.now = Date.parse(at(12));
    await report(space.name, '3', { event: 'merged', pull_request: pull(50) });
    assert.deepEqual(['3', '4'].map((step) => stepRow(workshop, step).written_at), [at(12), null]);
    // A merged pull request stays merged: reported closed for a step it does not write, nothing changes ...
    const stale = await report(space.name, '4', { event: 'closed', pull_request: pull(50) });
    assert.deepEqual([stale.json.changed, stale.json.written_at], [false, null]);
    assert.equal(stepRow(workshop, '4').written_at, null);
    assert.equal(db.prepare('SELECT state FROM pull_requests WHERE project_id = ? AND number = 50').get(space.id).state, 'merged');
    // ... and reported opened for a step, it writes that step.
    clock.now = Date.parse(at(13));
    const late = await report(space.name, '4', { event: 'opened', pull_request: pull(50) });
    assert.deepEqual([late.json.changed, late.json.written_at], [true, at(13)]);
  });

  test('a report before its step is confirmed names the open steps, and writing the last step closes the workshop (SPEC-040)', async () => {
    const space = s.project();
    const workshop = s.workshop(space);
    for (const step of STEPS.slice(0, 9)) {
      s.confirmStep(workshop, step);
      s.writeStep(workshop, step);
    }
    // Reported before the last step is confirmed: refused, the open steps named.
    const early = await report(space.name, '9', { event: 'merged', pull_request: pull(7) });
    assert.deepEqual([...problem(early), early.json.steps], [409, 'steps_open', ['8', '9']]);
    s.confirmStep(workshop, '8');
    s.confirmStep(workshop, '9');
    // Given all steps confirmed, when the agent reports the document updated, then the workshop shows closed.
    await report(space.name, '8', { event: 'merged', pull_request: pull(7) });
    assert.equal(workshopRow(workshop).state, 'open');
    clock.now = Date.parse(at(11));
    const last = await report(space.name, '9', { event: 'merged', pull_request: pull(8) });
    assert.deepEqual(last.json, { workshop: idOf('ws', workshop), step: '9', workshop_state: 'closed', written_at: at(11), changed: true });
    assert.deepEqual(workshopRow(workshop), { state: 'closed', closed_at: at(11) });
    const shown = await read(space.name);
    assert.deepEqual([shown.json.state, shown.json.closed_at], ['closed', at(11)]);
    // The board takes no change once it is closed, and a new workshop can open.
    assert.deepEqual(problem(await report(space.name, '9', { event: 'merged', pull_request: pull(8) })), [409, 'workshop_closed']);
    assert.deepEqual(problem(await add(space.name, note('1'))), [409, 'workshop_closed']);
    assert.equal((await open(space.name)).status, 201);
  });

  test('a report names a pull request of the project\'s own repository', async () => {
    const { space } = await opened();
    await add(space.name, note('0', 'Scope'));
    await confirm(space.name, '0');
    assert.equal(pullRequestNumber(pull(12), REPOSITORY), 12);
    assert.equal(pullRequestNumber(`${REPOSITORY.toUpperCase().replace('HTTPS', 'https')}/pull/12`, `${REPOSITORY}.git`), 12);
    for (const link of [pull(12, 'https://github.com/example/other'), 'https://gitlab.example.com/example/demo/pull/12', `${REPOSITORY}/tree/pull/12`.replace('/tree', '/x')]) {
      assert.deepEqual(problem(await report(space.name, '0', { event: 'opened', pull_request: link })), [409, 'repository_mismatch'], link);
    }
    for (const link of [`${REPOSITORY}/pull/0`, `${REPOSITORY}/pull/12/files`, `${REPOSITORY}/issues/12`, `${REPOSITORY}/pull/012`, 'http://github.com/example/demo/pull/12', `${REPOSITORY}/pull/${'9'.repeat(17)}`]) {
      refusedOn(await report(space.name, '0', { event: 'opened', pull_request: link }), 'pull_request');
    }
    // A project that names no repository can take no pull request.
    const bare = await opened({ repository: null });
    await add(bare.space.name, note('0', 'Scope'));
    await confirm(bare.space.name, '0');
    assert.deepEqual(problem(await report(bare.space.name, '0', { event: 'opened', pull_request: pull(3) })), [409, 'repository_mismatch']);
    // A number reported for a reflection is not a domain document's.
    s.pullRequest(space, { number: 30 });
    refusedOn(await report(space.name, '0', { event: 'merged', pull_request: pull(30) }), 'pull_request');
    assert.equal(db.prepare('SELECT count(*) AS n FROM workshop_steps WHERE pull_request_id IS NOT NULL AND project_id = ?').get(space.id).n, 0);
  });

  test('a step holds at most 1000 live notes and a board 2000 live links; a text over 200 or a kind over 40 is too long', async () => {
    const { space, workshop } = await opened();
    const keys = fill(workshop, '6', 1000);
    refusedOn(await add(space.name, note('6')), 'step');
    refusedOn(await draft(space.name, '6', { notes: [drafted('One more')] }), 'notes');
    const elsewhere = (await add(space.name, note('8'))).json;
    refusedOn(await change(space.name, elsewhere.id, { step: '6' }), 'step');
    // A draft that removes as many as it adds fits.
    const own = (await draft(space.name, '8', { notes: [drafted('Agent note')] })).json.notes[0];
    db.prepare("UPDATE sticky_notes SET step = '6' WHERE id = ?").run(keys[0]);
    db.prepare('UPDATE sticky_notes SET removed_at = ? WHERE id = ?').run(at(0), keys[1]);
    assert.equal((await add(space.name, note('6'))).status, 201);
    assert.equal(own.step, '8');
    const insert = db.prepare("INSERT INTO sticky_links (workshop_id, from_note, to_note, made_by, created_at) VALUES (?, ?, ?, 'owner', ?)");
    for (let index = 0; index < 2000; index += 1) insert.run(workshop, keys[2 + (index % 900)], keys[2 + ((index + 1 + Math.floor(index / 900)) % 900)], at(0));
    refusedOn(await connect(space.name, elsewhere.id, own.id), 'from');
    for (const [answer, field, limit] of [
      [await add(space.name, note('1', 'x'.repeat(201))), 'text', 200],
      [await add(space.name, { ...note('1'), kind: 'k'.repeat(41) }), 'kind', 40],
      [await change(space.name, elsewhere.id, { text: '가'.repeat(201) }), 'text', 200],
      [await draft(space.name, '1', { notes: [drafted('x'.repeat(201))] }), 'notes[0].text', 200],
      [await draft(space.name, '1', { notes: [drafted('ok'), { ...drafted('ok'), kind: 'k'.repeat(41) }] }), 'notes[1].kind', 40],
    ]) {
      assert.deepEqual([answer.status, answer.json.code, answer.json.field, answer.json.limit], [400, 'text_too_long', field, limit]);
    }
    // At the limits, a text of 200 characters, emoji included, and a kind of 40 are taken.
    assert.equal((await add(space.name, { ...note('1', '😀'.repeat(200)), kind: 'k'.repeat(40) })).status, 201);
  });

  test('refuses a body that breaks the contract, naming the field and never its value', async () => {
    const { space } = await opened();
    const target = (await add(space.name, note('1'))).json;
    const second = (await add(space.name, note('1', 'Second'))).json;
    const secret = `private-${randomBytes(8).toString('hex')}`;
    for (const [send, field] of [
      [() => open(space.name, {}, { name: secret }), 'body'],
      [() => confirm(space.name, '1', {}, { step: '1' }), 'body'],
      [() => add(space.name, { ...note('1'), color: secret }), 'body'],
      [() => add(space.name, { kind: 'event', text: secret, x: 0, y: 0 }), 'step'],
      [() => add(space.name, { ...note('1'), step: '1-a' }), 'step'],
      [() => add(space.name, { ...note('1'), kind: ' ' }), 'kind'],
      [() => add(space.name, { ...note('1'), text: '' }), 'text'],
      [() => add(space.name, { ...note('1'), text: 7 }), 'text'],
      [() => add(space.name, { ...note('1'), x: '1' }), 'x'],
      [() => add(space.name, { ...note('1'), y: 1_000_001 }), 'y'],
      [() => add(space.name, { step: '1', kind: 'event', text: secret, x: 0 }), 'y'],
      [() => change(space.name, target.id, {}), 'body'],
      [() => change(space.name, target.id, { kind: 'command' }), 'body'],
      [() => change(space.name, target.id, { text: '   ' }), 'text'],
      [() => change(space.name, target.id, { x: null }), 'x'],
      [() => connect(space.name, target.id, target.id), 'to'],
      [() => connect(space.name, 'sn_1', second.id), 'from'],
      [() => call('connectNotes', { path: `${board(space.name)}/links`, headers: { ...owner(), ...key() }, body: { from: target.id } }), 'to'],
      [() => draft(space.name, '1', { notes: [] }), 'notes'],
      [() => draft(space.name, '1', {}), 'notes'],
      [() => draft(space.name, '1', { notes: [drafted(secret)], extra: true }), 'body'],
      [() => draft(space.name, '1', { notes: [{ kind: 'event', text: secret }] }), 'notes[0].confidence'],
      [() => draft(space.name, '1', { notes: [drafted(secret, 'sure')] }), 'notes[0].confidence'],
      [() => draft(space.name, '1', { notes: [drafted(secret, 'certain', { colour: 'blue' })] }), 'notes[0]'],
      [() => draft(space.name, '1', { notes: [null] }), 'notes[0]'],
      [() => draft(space.name, '1', { notes: [drafted(secret, 'certain', { x: Number.MAX_VALUE })] }), 'notes[0].x'],
      [() => draft(space.name, '1', { notes: Array.from({ length: 201 }, () => drafted('n')) }), 'notes'],
      [() => draft(space.name, '1', { notes: [drafted(secret)], remove: [] }), 'remove'],
      [() => draft(space.name, '1', { notes: [drafted(secret)], remove: [target.id, target.id] }), 'remove'],
      [() => draft(space.name, '1', { notes: [drafted(secret)], remove: ['sn_x'] }), 'remove'],
      [() => report(space.name, '1', { event: 'merged' }), 'pull_request'],
      [() => report(space.name, '1', { event: 'reopened', pull_request: pull(1) }), 'event'],
      [() => report(space.name, '1', { event: ['merged'], pull_request: pull(1) }), 'event'],
      [() => report(space.name, '1', { event: 'merged', pull_request: pull(1), commit: secret }), 'body'],
      [() => report(space.name, '1', { event: 'merged', pull_request: `${pull(1)} ` }), 'pull_request'],
      [() => draft(space.name, '1', { notes: [drafted(secret)] }, { 'Nexus-Session': undefined }), 'Nexus-Session'],
      [() => report(space.name, '1', { event: 'merged', pull_request: pull(1) }, { 'Nexus-Session': 'not a label' }), 'Nexus-Session'],
      [() => add(space.name, note('1'), { 'Idempotency-Key': undefined }), 'Idempotency-Key'],
      [() => remove(space.name, target.id, { 'Idempotency-Key': undefined }), 'Idempotency-Key'],
      [() => unlink(space.name, idOf('sl', 1), { 'Idempotency-Key': undefined }), 'Idempotency-Key'],
      [() => call('addNote', { path: `${board(space.name)}/notes`, headers: { ...owner(), ...key() }, body: '[]' }), 'body'],
      [() => call('reportStepWritten', { path: `/api/spaces/${space.name}/workshop/steps/1/report`, headers: { ...agent(), ...key() }, body: '{"event":' }), 'body'],
    ]) {
      const answer = await send();
      refusedOn(answer, field);
      assert.equal(answer.text.includes(secret), false);
    }
    assert.equal((await read(space.name)).json.steps.find((step) => step.step === '1').notes.length, 2);
    // Not JSON, and a body over 2 MiB.
    for (const [action, method, path, headers] of [
      ['openWorkshop', 'POST', board(space.name), owner()],
      ['addNote', 'POST', `${board(space.name)}/notes`, owner()],
      ['changeNote', 'PATCH', `${board(space.name)}/notes/${target.id}`, owner()],
      ['connectNotes', 'POST', `${board(space.name)}/links`, owner()],
      ['confirmStep', 'POST', `${board(space.name)}/steps/1/confirm`, owner()],
      ['draftWorkshopStep', 'POST', `/api/spaces/${space.name}/workshop/steps/1/draft`, agent()],
      ['reportStepWritten', 'POST', `/api/spaces/${space.name}/workshop/steps/1/report`, agent()],
    ]) {
      const wrongType = await call(action, { method, path, headers: { ...headers, ...key(), 'Content-Type': 'text/plain' }, body: '{}' });
      assert.deepEqual(problem(wrongType), [415, 'json_required'], action);
      const { answers } = await exchange(server.port, [head(method, path, { ...JSON_TYPE, ...headers, ...key(), 'Content-Length': 2 * MiB + 1 })]);
      responses.note(action, answers[0]);
      assert.deepEqual([answers[0].status, answers[0].json.code, answers[0].json.limit], [413, 'body_too_large', 2 * MiB], action);
    }
  });

  test('a change to the board without an open workshop gets workshop_closed', async () => {
    const space = s.project();
    const old = s.workshop(space);
    const [left] = fill(old, '1', 1);
    s.closeWorkshop(old);
    for (const answer of [
      await add(space.name, note('1')),
      await change(space.name, idOf('sn', left), { x: 1 }),
      await remove(space.name, idOf('sn', left)),
      await connect(space.name, idOf('sn', left), newId('sn')),
      await unlink(space.name, newId('sl')),
      await confirm(space.name, '1'),
      await draft(space.name, '1', { notes: [drafted('Late')] }),
      await report(space.name, '1', { event: 'merged', pull_request: pull(5) }),
    ]) {
      assert.deepEqual(problem(answer), [409, 'workshop_closed']);
    }
    assert.equal(noteRows(old)[0].removed_at, null);
  });

  test('names that name nothing get the 404 of what they name, never repeating them', async () => {
    const { space, workshop } = await opened();
    const target = (await add(space.name, note('1'))).json;
    // A note or link of another workshop of the project, and of another project.
    const elsewhere = await opened();
    const [foreign] = fill(elsewhere.workshop, '1', 1);
    const missing = `missing-${randomBytes(5).toString('hex')}`;
    for (const [answer, code] of [
      [await open(missing), 'project_not_found'],
      [await read(missing), 'project_not_found'],
      [await add(missing, note('1')), 'project_not_found'],
      [await change(missing, target.id, { x: 1 }), 'project_not_found'],
      [await remove(missing, target.id), 'project_not_found'],
      [await connect(missing, target.id, target.id), 'project_not_found'],
      [await unlink(missing, newId('sl')), 'project_not_found'],
      [await confirm(missing, '1'), 'project_not_found'],
      [await draft(missing, '1', { notes: [drafted('n')] }), 'project_not_found'],
      [await report(missing, '1', { event: 'merged', pull_request: pull(1) }), 'project_not_found'],
      [await confirm(space.name, '1-a'), 'step_not_found'],
      [await confirm(space.name, '10'), 'step_not_found'],
      [await draft(space.name, 'one', { notes: [drafted('n')] }), 'step_not_found'],
      [await report(space.name, '0b', { event: 'merged', pull_request: pull(1) }), 'step_not_found'],
      [await change(space.name, 'sn_1', { x: 1 }), 'note_not_found'],
      [await change(space.name, idOf('sn', foreign), { x: 1 }), 'note_not_found'],
      [await remove(space.name, idOf('sn', foreign)), 'note_not_found'],
      [await remove(space.name, 'note'), 'note_not_found'],
      [await connect(space.name, target.id, idOf('sn', foreign)), 'note_not_found'],
      [await draft(space.name, '1', { notes: [drafted('n')], remove: [idOf('sn', foreign)] }), 'note_not_found'],
      [await unlink(space.name, newId('sl')), 'note_link_not_found'],
      [await unlink(space.name, 'link'), 'note_link_not_found'],
    ]) {
      assert.equal(answer.status, 404);
      assert.equal(answer.json.code, code);
      assert.equal(answer.text.includes(missing), false);
    }
    assert.equal(noteRows(workshop).length, 1);
  });

  test('a request key repeats its first answer and writes nothing; one another action took is refused', async () => {
    const { space, workshop } = await opened();
    const requestKey = key();
    const first = await add(space.name, note('1', 'Once'), requestKey);
    clock.now += 60_000;
    const repeat = await add(space.name, note('1', 'Once'), requestKey);
    assert.deepEqual([repeat.status, repeat.json], [201, first.json]);
    assert.equal(noteRows(workshop).length, 1);
    const draftKey = { 'Idempotency-Key': `"${newId('nw')}"` };
    const drafting = await draft(space.name, '2', { notes: [drafted('Once')] }, draftKey);
    assert.deepEqual((await draft(space.name, '2', { notes: [drafted('Once')] }, draftKey)).json, drafting.json);
    assert.equal(noteRows(workshop).length, 2);
    const movedKey = key();
    assert.equal((await change(space.name, first.json.id, { x: 5 }, movedKey)).status, 200);
    for (const answer of [
      await open(space.name, requestKey),
      await change(space.name, first.json.id, { x: 1 }, requestKey),
      await remove(space.name, first.json.id, requestKey),
      await connect(space.name, first.json.id, drafting.json.notes[0].id, requestKey),
      await unlink(space.name, newId('sl'), requestKey),
      await confirm(space.name, '1', requestKey),
      await add(space.name, note('1', 'Other'), movedKey),
      // A key belongs to its sender: the agent's own key, taken by its draft.
      await draft(space.name, '1', { notes: [drafted('Other')] }, draftKey),
      await report(space.name, '1', { event: 'merged', pull_request: pull(1) }, draftKey),
    ]) {
      assert.deepEqual(problem(answer), [409, 'request_key_reused']);
    }
    assert.equal(noteRows(workshop).length, 2);
  });

  test('the owner\'s operations take only the owner\'s sign-in, and the agent\'s only a live credential', async () => {
    const { space, workshop } = await opened();
    const target = (await add(space.name, note('1'))).json;
    const someone = { 'Cf-Access-Jwt-Assertion': local.token({ email: 'someone@example.org' }) };
    const writes = (headers) => [
      () => open(space.name, headers),
      () => add(space.name, note('1'), headers),
      () => change(space.name, target.id, { x: 9 }, headers),
      () => remove(space.name, target.id, headers),
      () => connect(space.name, target.id, newId('sn'), headers),
      () => unlink(space.name, newId('sl'), headers),
      () => confirm(space.name, '1', headers),
    ];
    for (const [headers, status, code] of [
      [{ 'Cf-Access-Jwt-Assertion': undefined }, 401, 'unauthenticated'],
      [someone, 403, 'not_owner'],
      [{ 'Cf-Access-Jwt-Assertion': undefined, ...s.agent.headers }, 403, 'owner_only'],
      [{ 'Sec-Fetch-Site': 'cross-site' }, 403, 'cross_site'],
    ]) {
      for (const send of writes(headers)) assert.deepEqual(problem(await send()), [status, code]);
      if (code !== 'cross_site') assert.deepEqual(problem(await read(space.name, headers)), [status, code]);
    }
    for (const [headers, status, code] of [
      [{ 'CF-Access-Client-Id': undefined, 'CF-Access-Client-Secret': undefined }, 401, 'access_missing'],
      [{ 'CF-Access-Client-Secret': 'wrong' }, 401, 'access_missing'],
      [{ 'CF-Access-Client-Id': undefined, 'CF-Access-Client-Secret': undefined, ...owner() }, 403, 'agent_only'],
    ]) {
      assert.deepEqual(problem(await draft(space.name, '1', { notes: [drafted('n')] }, headers)), [status, code]);
      assert.deepEqual(problem(await report(space.name, '1', { event: 'merged', pull_request: pull(1) }, headers)), [status, code]);
    }
    assert.deepEqual(noteRows(workshop).map((row) => row.removed_at), [null]);
  });

  test('answers internal when the store fails', async (t) => {
    const store = testStore(t);
    // A store whose workshop statements cannot be prepared, as when the disk fails.
    const failing = new Proxy(store, {
      get(target, name) {
        const value = Reflect.get(target, name, target);
        if (name === 'prepare') {
          return (sql) => {
            if (sql.includes('sticky_notes')) throw new Error('the store failed');
            return target.prepare(sql);
          };
        }
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    // The agent's credential lives in this store, which only the workshop's statements fail on.
    const failingAgent = { ...seed(store).agent.headers, 'Nexus-Session': SESSION };
    const broken = await startServer({ store: failing, gate: local.gate, routes: ROUTES });
    t.after(() => broken.close());
    const send = (action, method, path, headers, body) => broken.send({
      method, path, headers: { ...(body === undefined ? {} : JSON_TYPE), ...headers, ...key() }, body: body === undefined ? undefined : JSON.stringify(body),
    }).then((answer) => responses.note(action, answer));
    const answers = [
      await send('openWorkshop', 'POST', '/api/projects/demo/workshop', owner(), {}),
      await send('getWorkshop', 'GET', '/api/projects/demo/workshop', owner()),
      await send('addNote', 'POST', '/api/projects/demo/workshop/notes', owner(), note('1')),
      await send('changeNote', 'PATCH', `/api/projects/demo/workshop/notes/${idOf('sn', 1)}`, owner(), { x: 1 }),
      await send('removeNote', 'DELETE', `/api/projects/demo/workshop/notes/${idOf('sn', 1)}`, owner()),
      await send('connectNotes', 'POST', '/api/projects/demo/workshop/links', owner(), { from: idOf('sn', 1), to: idOf('sn', 2) }),
      await send('removeNoteLink', 'DELETE', `/api/projects/demo/workshop/links/${idOf('sl', 1)}`, owner()),
      await send('confirmStep', 'POST', '/api/projects/demo/workshop/steps/1/confirm', owner(), {}),
      await send('draftWorkshopStep', 'POST', '/api/spaces/demo/workshop/steps/1/draft', failingAgent, { notes: [drafted('n')] }),
      await send('reportStepWritten', 'POST', '/api/spaces/demo/workshop/steps/1/report', failingAgent, { event: 'merged', pull_request: pull(1) }),
    ];
    assert.deepEqual(answers.map(problem), answers.map(() => [500, 'internal']));
    assert.equal(broken.logText().includes('the store failed'), false);
  });

  test('logs one line per request with its sender, and never a note\'s text, the project\'s name, a link or the data folder (rule 5)', async () => {
    const name = `lima-${randomBytes(6).toString('hex')}`;
    const space = s.project(name);
    await open(name);
    const text = `Secret-${randomBytes(6).toString('hex')}`;
    const added = (await add(name, note('1', text))).json;
    await add(name, note('1', `${text}-too-long`.repeat(20)));
    await change(name, added.id, { text: `${text}-renamed` });
    await draft(name, '1', { notes: [drafted(`${text}-agent`)] });
    await confirm(name, '1');
    const link = pull(77, 'https://github.com/example/other');
    await report(name, '1', { event: 'opened', pull_request: link });
    await report(name, '1', { event: 'opened', pull_request: pull(77) });
    const lines = (await server.logged(7)).filter((line) => ACTIONS.includes(line.action));
    assert.ok(lines.length >= 7);
    const agents = db.prepare('SELECT name FROM agent_credentials').all().map((row) => row.name);
    for (const line of lines) {
      assert.match(line.traceId, TRACE_ID);
      assert.ok(['owner', 'unknown', ...agents].includes(line.sender), line.sender);
    }
    const logged = server.logText();
    for (const value of [name, text, link, pull(77), 'example/demo', folder, folder.replaceAll('\\', '/'), JSON.stringify(folder).slice(1, -1)]) {
      assert.equal(logged.includes(value), false, value);
    }
    assert.equal(space.name, name);
  });

  test('answers every response API-260, API-261 and API-284 to API-291 list', () => {
    for (const action of ACTIONS) responses.assertEvery(action);
  });

  test('touches the tables their x-corthex.tables list, and admission only the layer\'s (note 23)', () => {
    checkTables(recorder, 'draftWorkshopStep');
    checkTables(recorder, 'reportStepWritten');
    checkTables(recorder, 'openWorkshop');
    checkTables(recorder, 'getWorkshop');
    checkTables(recorder, 'addNote');
    checkTables(recorder, 'changeNote');
    checkTables(recorder, 'removeNote');
    checkTables(recorder, 'connectNotes');
    checkTables(recorder, 'removeNoteLink');
    checkTables(recorder, 'confirmStep');
    checkLayer(recorder);
  });
});
