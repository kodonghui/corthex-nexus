// Shared by the tests of the to-do (TASK-433), the project read (TASK-440) and the diagram read (TASK-441): the fewest
// rows the store's schema allows for each subject an entry is about, for the stage passes and tool links the project
// read shows, and for the elements, positions, documents and change-set steps the diagram read shows, written straight
// into a store, so that a test sets up a thread, a change set, a confirmation, a step, a pass or a link without the
// operations that later tasks build. node --test also runs this file, which holds no test.

import { createHash, randomBytes } from 'node:crypto';
import { idOf } from '../src/ids.js';

export const TIME = '2026-11-23T01:00:00.000Z';
export const REPOSITORY = 'https://github.com/example/demo';

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const commit = () => randomBytes(20).toString('hex');

// Writes rows into db, each at time unless told otherwise. Every function returns the new row's key, or an object of
// keys.
export function seed(db, { time = TIME } = {}) {
  const insert = (sql, ...values) => Number(db.prepare(sql).run(...values).lastInsertRowid);

  // An agent credential as API-280 makes one: { key, name, headers } with the pair an agent sends.
  function credential(name = `agent-${randomBytes(4).toString('hex')}`) {
    const secret = randomBytes(32).toString('base64url');
    const key = insert('INSERT INTO agent_credentials (name, secret_digest, issued_at) VALUES (?, ?, ?)', name, sha256(secret), time);
    return { key, name, headers: { 'CF-Access-Client-Id': idOf('ac', key), 'CF-Access-Client-Secret': secret } };
  }

  const agent = credential();

  // A project space holding one snapshot: { id, name, commit, snapshot }. pictures is what the snapshot's /snapshot
  // document lists, as the intake keeps it (see src/snapshot.js), so that a file picture's part can be found; title and
  // parts, when given, are the project's there.
  function project(name = `demo-${randomBytes(3).toString('hex')}`, { repository = REPOSITORY, pictures = [], title, parts } = {}) {
    const id = insert(
      'INSERT INTO project_spaces (name, repository, held_commit, created_at, created_by_credential) VALUES (?, ?, NULL, ?, ?)',
      name, repository, time, agent.key,
    );
    const space = { id, name };
    snapshot(space, { pictures, title, parts });
    return space;
  }

  // The project's next snapshot, received at at and now held, with its /snapshot document: sets space.commit and
  // space.snapshot. title and parts, when given, are the project's in that document.
  function snapshot(space, { pictures = [], title, parts, at = time } = {}) {
    const held = commit();
    const { revision } = db.prepare('SELECT coalesce(max(revision), 0) + 1 AS revision FROM snapshots WHERE project_id = ?').get(space.id);
    const id = insert(
      `INSERT INTO snapshots (project_id, revision, commit_sha, replaced_commit, format_version, bytes, received_at, credential_id)
       VALUES (?, ?, ?, ?, 'corthex-hub/0.3', 0, ?, ?)`,
      space.id, revision, held, space.commit ?? null, at, agent.key,
    );
    db.prepare('UPDATE project_spaces SET held_commit = ? WHERE id = ?').run(held, space.id);
    const head = { name: space.name };
    if (title !== undefined) head.title = title;
    if (parts !== undefined) head.parts = parts;
    const rest = JSON.stringify({ project: head, pictures });
    db.prepare('INSERT INTO document_blobs (sha256, body, bytes) VALUES (?, ?, ?) ON CONFLICT (sha256) DO NOTHING')
      .run(sha256(rest), rest, Buffer.byteLength(rest));
    db.prepare("INSERT INTO snapshot_files (snapshot_id, path, stage, blob_sha256) VALUES (?, '/snapshot', '', ?)").run(id, sha256(rest));
    Object.assign(space, { commit: held, snapshot: id });
    return id;
  }

  // A diagram of the project with one drawing of the project's snapshot: { id, drawing }. status is the drawing's,
  // drawn or failed; removed sets removed_at.
  function diagram(space, { stage = '05-erd', sourceKey = '/pictures/05-erd', kind = 'erd', name = 'ERD', status = 'drawn', removed = false } = {}) {
    const id = insert(
      'INSERT INTO diagrams (project_id, stage, source_key, kind, name, created_at, removed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      space.id, stage, sourceKey, kind, name, time, removed ? time : null,
    );
    return { id, drawing: drawing(space, id, { status }) };
  }

  // A drawing of the diagram from the project's last snapshot. A failed one failed at failedPath and failedLine.
  function drawing(space, diagramId, { status = 'drawn', failedPath = 'db/nexus.sql', failedLine = null, at = time } = {}) {
    const failed = status === 'failed';
    return insert(
      `INSERT INTO drawings (project_id, diagram_id, snapshot_id, document_version, status, source_digest, failed_path, failed_line, drawn_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      space.id, diagramId, space.snapshot, space.commit, status, sha256(`${diagramId}`), failed ? failedPath : null, failed ? failedLine : null, at,
    );
  }

  // The elements of a drawing, in order, each { key, trace_id, kind, name, parent, status, detail } as a drawer
  // returns it, with its key given.
  function elements(drawingId, rows) {
    const statement = db.prepare(
      'INSERT INTO elements (drawing_id, element_key, trace_id, kind, name, parent_key, status, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    );
    for (const row of rows) {
      statement.run(
        drawingId, row.key, row.trace_id ?? null, row.kind ?? 'table', row.name ?? '', row.parent ?? null, row.status ?? null,
        JSON.stringify(row.detail ?? {}),
      );
    }
  }

  // Where the owner put an element of a diagram, as API-274 keeps it (TASK-442; TBL-154, SPEC-012): the last move wins.
  function position(diagramId, key, { x, y, at = time }) {
    db.prepare(
      `INSERT INTO element_positions (diagram_id, element_key, x, y, moved_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (diagram_id, element_key) DO UPDATE SET x = excluded.x, y = excluded.y, moved_at = excluded.moved_at`,
    ).run(diagramId, key, x, y, at);
  }

  // A document of the project's last snapshot by its path, such as /items/<stage>, as the intake keeps one.
  function document(space, path, stage, body) {
    db.prepare('INSERT INTO document_blobs (sha256, body, bytes) VALUES (?, ?, ?) ON CONFLICT (sha256) DO NOTHING')
      .run(sha256(body), body, Buffer.byteLength(body));
    db.prepare('INSERT INTO snapshot_files (snapshot_id, path, stage, blob_sha256) VALUES (?, ?, ?, ?)').run(space.snapshot, path, stage, sha256(body));
  }

  // An open thread with its first comment, waiting on the side that did not write it: { id }.
  function thread(where, { target = 'element', elementKey = 'TBL-146', author = 'owner', body = 'Should this table keep its last use?', at = time } = {}) {
    const id = insert(
      `INSERT INTO comment_threads (diagram_id, drawing_id, target_kind, element_key, state, waits_on, opened_at)
       VALUES (?, ?, ?, ?, 'open', ?, ?)`,
      where.id, where.drawing, target, target === 'diagram' ? null : elementKey, author === 'owner' ? 'agent' : 'owner', at,
    );
    comment(id, { author, body, at });
    return id;
  }

  // A comment at the end of a thread; the thread then waits on the other side, as SPEC-017 says.
  function comment(threadId, { author = 'agent', body = 'Yes, it keeps it.', at = time } = {}) {
    const { seq } = db.prepare('SELECT coalesce(max(seq), 0) + 1 AS seq FROM comments WHERE thread_id = ?').get(threadId);
    insert(
      'INSERT INTO comments (thread_id, seq, author, credential_id, body, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      threadId, seq, author, author === 'agent' ? agent.key : null, body, at,
    );
    db.prepare("UPDATE comment_threads SET waits_on = ? WHERE id = ? AND state = 'open'").run(author === 'owner' ? 'agent' : 'owner', threadId);
  }

  function closeThread(threadId, { by = 'owner' } = {}) {
    db.prepare("UPDATE comment_threads SET state = 'closed', waits_on = NULL, closed_at = ?, closed_by = ? WHERE id = ?").run(time, by, threadId);
  }

  function pullRequest(space, { number, state = 'open', purpose = 'reflection' }) {
    return insert(
      `INSERT INTO pull_requests (project_id, purpose, number, state, reported_at, closed_at, credential_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      space.id, purpose, number, state, time, state === 'open' ? null : time, agent.key,
    );
  }

  // A change set of the diagram: a direct edit, accepted unless told otherwise, or a proposal on threadId. detail is
  // what TBL-158 keeps of a proposal as the hub sends it, made at at and decided at decidedAt.
  function changeSet(space, where, {
    origin = 'direct_edit', state = origin === 'proposal' ? 'proposed' : 'accepted', threadId = null, pullRequestId = null, detail = {},
    at = time, decidedAt = null,
  } = {}) {
    return insert(
      `INSERT INTO change_sets (project_id, diagram_id, drawing_id, origin, thread_id, credential_id, state, created_at, decided_at,
                                pull_request_id, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      space.id, where.id, where.drawing, origin, threadId, origin === 'proposal' ? agent.key : null, state, at, decidedAt, pullRequestId,
      JSON.stringify(detail),
    );
  }

  // The next step of a change set (TBL-159): rename, connect, add or remove an element.
  function change(changeSetId, { op = 'rename', element, name = null, target = null }) {
    const { seq } = db.prepare('SELECT coalesce(max(seq), 0) + 1 AS seq FROM changes WHERE change_set_id = ?').get(changeSetId);
    return insert(
      'INSERT INTO changes (change_set_id, seq, op, element_key, new_name, target_key) VALUES (?, ?, ?, ?, ?, ?)',
      changeSetId, seq, op, element, name, target,
    );
  }

  // Sets a change set's state and pull request, as the operations that decide, link and reflect it will.
  function setChangeSet(id, { state, pullRequestId, reflectedDrawing } = {}) {
    if (state !== undefined) db.prepare('UPDATE change_sets SET state = ? WHERE id = ?').run(state, id);
    if (pullRequestId !== undefined) db.prepare('UPDATE change_sets SET pull_request_id = ? WHERE id = ?').run(pullRequestId, id);
    if (reflectedDrawing !== undefined) {
      db.prepare("UPDATE change_sets SET state = 'reflected', reflected_drawing_id = ? WHERE id = ?").run(reflectedDrawing, id);
    }
  }

  function confirm(space, where, { at = time } = {}) {
    return insert(
      "INSERT INTO confirmations (project_id, diagram_id, drawing_id, state, confirmed_at) VALUES (?, ?, ?, 'confirmed', ?)",
      space.id, where.id, where.drawing, at,
    );
  }

  // Ends or records a confirmation, as API-276, TASK-435 and API-259 will: cancelled, invalidated by a drawing,
  // recorded, or its cancel recorded.
  function cancel(id) {
    db.prepare("UPDATE confirmations SET state = 'cancelled', ended_at = ? WHERE id = ?").run(time, id);
  }
  function invalidate(id, byDrawing) {
    db.prepare("UPDATE confirmations SET state = 'invalidated', ended_at = ?, invalidated_by_drawing = ? WHERE id = ?").run(time, byDrawing, id);
  }
  function record(id) {
    db.prepare('UPDATE confirmations SET recorded_at = ? WHERE id = ?').run(time, id);
  }
  function recordCancel(id) {
    db.prepare('UPDATE confirmations SET cancel_recorded_at = ? WHERE id = ?').run(time, id);
  }

  function removeDiagram(id, removed = true) {
    db.prepare('UPDATE diagrams SET removed_at = ? WHERE id = ?').run(removed ? time : null, id);
  }

  // An open workshop with its steps, none confirmed: { id }.
  function workshop(space, steps = ['0', '1', '1-b', '2', '3', '4', '5', '6', '7', '8', '9']) {
    const id = insert("INSERT INTO workshops (project_id, state, opened_at) VALUES (?, 'open', ?)", space.id, time);
    for (const step of steps) db.prepare('INSERT INTO workshop_steps (project_id, workshop_id, step) VALUES (?, ?, ?)').run(space.id, id, step);
    return id;
  }
  function confirmStep(workshopId, step, { at = time } = {}) {
    db.prepare('UPDATE workshop_steps SET confirmed_at = ? WHERE workshop_id = ? AND step = ?').run(at, workshopId, step);
  }
  function writeStep(workshopId, step) {
    db.prepare('UPDATE workshop_steps SET written_at = ? WHERE workshop_id = ? AND step = ?').run(time, workshopId, step);
  }
  function closeWorkshop(workshopId) {
    db.prepare("UPDATE workshops SET state = 'closed', closed_at = ? WHERE id = ?").run(time, workshopId);
  }

  // A stage pass of the project, as TASK-447 and the workshop tasks will write one, and its mark that a confirmation
  // it rests on was invalidated, as TASK-435 will set it (TBL-161, SPEC-035).
  function pass(space, stage, { passedAt = time } = {}) {
    return insert('INSERT INTO stage_passes (project_id, stage, passed_at) VALUES (?, ?, ?)', space.id, stage, passedAt);
  }
  function changePass(id, { at = time } = {}) {
    db.prepare('UPDATE stage_passes SET changed_at = ? WHERE id = ?').run(at, id);
  }

  // A tool link of the project or one of its stages, as TASK-451 will add one, with the status last read or none
  // (TBL-168, SPEC-046); removed sets removed_at.
  function toolLink(space, {
    scope = 'project', tool = 'notion', url = `https://www.notion.so/example-${randomBytes(8).toString('hex')}`, status = null,
    statusReadAt = null, addedAt = time, removed = false,
  } = {}) {
    return insert(
      `INSERT INTO tool_links (project_id, scope, tool, url, status, status_read_at, added_at, removed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      space.id, scope, tool, url, status, statusReadAt, addedAt, removed ? time : null,
    );
  }

  // A live claim of an entry by a session, as TASK-434 will make one.
  function claim(space, todo, { session, claimedAt = time, lastWriteAt = time, pullRequestId = null }) {
    return insert(
      `INSERT INTO claims (project_id, todo_id, session, credential_id, claimed_at, last_write_at, pull_request_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      space.id, todo, session, agent.key, claimedAt, lastWriteAt, pullRequestId,
    );
  }

  return {
    agent, credential, project, snapshot, diagram, drawing, elements, position, document, thread, comment, closeThread, pullRequest,
    changeSet, change, setChangeSet, confirm, cancel, invalidate, record, recordCancel, removeDiagram, workshop, confirmStep, writeStep,
    closeWorkshop, claim, pass, changePass, toolLink,
  };
}

// The open entries of TBL-166 in a store, each as "side kind" with what it is about, oldest first.
export function openEntries(db, project) {
  return db.prepare(
    `SELECT side, kind, diagram_id, thread_id, change_set_id, confirmation_id, workshop_id, step FROM todos
     WHERE project_id = ? AND closed_at IS NULL ORDER BY created_at, id`,
  ).all(project).map((row) => Object.fromEntries(Object.entries(row).filter(([, value]) => value !== null)));
}

// The closed entries, each as { kind, reason } with what it is about.
export function closedEntries(db, project) {
  return db.prepare(
    `SELECT kind, close_reason AS reason, thread_id, change_set_id, confirmation_id, step FROM todos
     WHERE project_id = ? AND closed_at IS NOT NULL ORDER BY id`,
  ).all(project).map((row) => Object.fromEntries(Object.entries(row).filter(([, value]) => value !== null)));
}
