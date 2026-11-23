// To-do entries (TASK-433): the one place that opens and closes the entries of TBL-166 todos, which the owner's to-do
// (API-263, SPEC-042) and the agent to-do (API-245, SPEC-043) read.
//
// An entry follows what it is about. Each function below reads the rows of one subject, a thread, a diagram's change
// sets, a diagram's confirmations or a workshop's steps, opens the entries those rows call for and closes the others.
// So an operation that changes such a row calls the function of its subject in the same transaction, after its own
// writes, and the to-do follows; calling it again changes nothing. The functions write only TBL-166 and read only the
// subject's own table (and, for confirmations, the diagram and its drawings), so they add no table to an operation
// beyond the subject it changes and TBL-166. They log nothing.
//
// | Function             | Kind                | Side  | Open while                                                    | Closed as                                        |
// | -------------------- | ------------------- | ----- | ------------------------------------------------------------- | ------------------------------------------------ |
// | threadChanged        | question            | owner | the thread is open and waits on the owner (SPEC-016, 017)     | done                                             |
// | threadChanged        | comment             | agent | the thread is open and waits on the agent (SPEC-016, 017)     | done                                             |
// | changeSetsChanged    | proposal            | owner | the AI proposal is proposed (SPEC-018)                        | done when answered, withdrawn when withdrawn     |
// | changeSetsChanged    | reflect             | agent | accepted change sets wait for reflection (SPEC-019, 021, 026) | done when reflected, withdrawn when none is left |
// | removeFromPullRequest| remove_from_pr      | agent | a cancelled change set is still in an open pull request (023) | done by removalReported                          |
// | confirmationsChanged | confirm             | owner | drawn, not removed, without a live confirmation (029, 030, 033)| done when confirmed, withdrawn otherwise         |
// | confirmationsChanged | record_confirmation | agent | confirmed, not cancelled and not recorded yet (SPEC-031, 032) | done when recorded, withdrawn when cancelled     |
// | confirmationsChanged | record_cancel       | agent | cancelled after it was recorded, the cancel not recorded (030)| done when the cancel is recorded                 |
// | stepsChanged         | write_step          | agent | the step is confirmed and not written (SPEC-039, SPEC-040)    | done when written                                |
//
// Reflections (SPEC-026). A diagram's accepted change sets that wait for reflection are grouped by their pull request:
// those in none are one group, and those of each pull request another. Each group is one entry, so one reflection
// entry holds every waiting change set of the diagram, and a change set accepted while a pull request is open starts a
// new entry. An entry names its group by an anchor, its change_set_id: one of the group's change sets, whose pull
// request is the group's. Linking a pull request to the group's change sets (API-258) moves the anchor with them, and
// unlinking them when the pull request closes moves it back, where it meets any entry opened meanwhile: the older entry
// stays and the newer one is withdrawn. An anchor that leaves the group, cancelled or reflected, is moved to another
// change set of the group; an entry whose group is empty closes, done when its change sets were reflected.
//
// Note 4 of the WBS. A diagram that a snapshot removes takes no confirmation (SPEC-027), so it puts nothing on the
// owner's to-do, whether it was confirmed or not, and its open confirm entry is withdrawn. Its confirmation stays as it
// is, and so does the agent's entry to record it, since a record of that version stays true. A diagram that comes back
// gets its confirm entry again, unless its confirmation is still live. The rule is takesConfirmation below.
//
// Claims (TBL-167) are TASK-434's. Closing an entry leaves its claim as it is: a claim of a closed entry holds nothing.

const STEP_CHECKPOINTS = Object.freeze(['1-b', '7', '9']);

// The statements of each store, prepared on first use (see credentials.js).
const prepared = new WeakMap();

function statementsOf(store) {
  let statements = prepared.get(store);
  if (statements === undefined) {
    statements = {
      insert: store.prepare(
        `INSERT INTO todos (project_id, side, kind, diagram_id, thread_id, change_set_id, confirmation_id, workshop_id, step, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ),
      close: store.prepare('UPDATE todos SET closed_at = ?, close_reason = ? WHERE id = ? AND closed_at IS NULL'),
      anchor: store.prepare('UPDATE todos SET change_set_id = ? WHERE id = ?'),
      thread: store.prepare('SELECT id, diagram_id, state, waits_on FROM comment_threads WHERE id = ?'),
      threadEntries: store.prepare(
        "SELECT id, kind FROM todos WHERE thread_id = ? AND kind IN ('question', 'comment') AND closed_at IS NULL ORDER BY id",
      ),
      changeSets: store.prepare(
        'SELECT id, origin, state, pull_request_id FROM change_sets WHERE diagram_id = ? AND project_id = ? ORDER BY id',
      ),
      diagramEntries: store.prepare(
        'SELECT id, kind, change_set_id, confirmation_id FROM todos WHERE diagram_id = ? AND project_id = ? AND kind = ? AND closed_at IS NULL ORDER BY created_at, id',
      ),
      removal: store.prepare(
        "SELECT id FROM todos WHERE change_set_id = ? AND diagram_id = ? AND kind = 'remove_from_pr' AND closed_at IS NULL",
      ),
      removalEntry: store.prepare("SELECT id FROM todos WHERE id = ? AND project_id = ? AND kind = 'remove_from_pr'"),
      diagram: store.prepare('SELECT id, removed_at FROM diagrams WHERE id = ? AND project_id = ?'),
      drawn: store.prepare("SELECT 1 AS drawn FROM drawings WHERE diagram_id = ? AND project_id = ? AND status = 'drawn' LIMIT 1"),
      confirmations: store.prepare(
        'SELECT id, state, recorded_at, cancel_recorded_at FROM confirmations WHERE diagram_id = ? AND project_id = ? ORDER BY id',
      ),
      steps: store.prepare(
        'SELECT step, confirmed_at, written_at FROM workshop_steps WHERE workshop_id = ? AND project_id = ? ORDER BY step',
      ),
      stepEntries: store.prepare(
        "SELECT id, step FROM todos WHERE workshop_id = ? AND project_id = ? AND kind = 'write_step' AND closed_at IS NULL ORDER BY id",
      ),
      openAgent: store.prepare(
        "SELECT id, kind, diagram_id, thread_id, change_set_id, confirmation_id, created_at FROM todos WHERE id = ? AND project_id = ? AND side = 'agent' AND closed_at IS NULL",
      ),
      openComment: store.prepare(
        "SELECT id, kind, diagram_id, thread_id, change_set_id, confirmation_id, created_at FROM todos WHERE thread_id = ? AND project_id = ? AND kind = 'comment' AND closed_at IS NULL",
      ),
      openRecord: store.prepare(
        "SELECT id, kind, diagram_id, thread_id, change_set_id, confirmation_id, created_at FROM todos WHERE confirmation_id = ? AND project_id = ? AND kind IN ('record_confirmation', 'record_cancel') AND closed_at IS NULL",
      ),
      group: store.prepare(
        "SELECT id FROM change_sets WHERE diagram_id = ? AND project_id = ? AND state = 'accepted' AND pull_request_id IS ? ORDER BY id",
      ),
      anchorOf: store.prepare('SELECT pull_request_id FROM change_sets WHERE id = ?'),
    };
    prepared.set(store, statements);
  }
  return statements;
}

// The side each kind belongs to (TBL-166's rule).
const SIDES = Object.freeze({
  confirm: 'owner',
  proposal: 'owner',
  question: 'owner',
  comment: 'agent',
  reflect: 'agent',
  remove_from_pr: 'agent',
  record_confirmation: 'agent',
  record_cancel: 'agent',
  write_step: 'agent',
});

function checkKey(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${name} is a row key`);
}

// An entry's times are answered as they are kept, so a time has the contract's Time form: UTC with milliseconds.
const TIME = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;

function checkTime(time) {
  const valid = typeof time === 'string' && TIME.test(time) && !Number.isNaN(Date.parse(time))
    && new Date(time).toISOString() === time;
  if (!valid) throw new TypeError('time is a UTC time with milliseconds, such as 2026-11-23T01:00:00.000Z');
}

// Opens an entry of kind about what subject names, returning its key.
function open(statements, project, kind, time, subject = {}) {
  const { diagram = null, thread = null, changeSet = null, confirmation = null, workshop = null, step = null } = subject;
  const { lastInsertRowid } = statements.insert.run(
    project, SIDES[kind], kind, diagram, thread, changeSet, confirmation, workshop, step, time,
  );
  return Number(lastInsertRowid);
}

function close(statements, id, reason, time) {
  return statements.close.run(time, reason, id).changes;
}

// Comments and threads (SPEC-016, SPEC-017, SPEC-028; TASK-437, TASK-443). An open thread waits only on the side that
// did not write last: on the owner it is a question of the owner's to-do, on the agent a comment of the agent to-do.
// A closed thread is in neither (SPEC-028), whether the owner or a reflection closed it. Call it after a thread is
// opened, replied to, marked answered or closed, with the thread's project. Returns { opened, closed }.
export function threadChanged(store, { project, thread, time }) {
  checkKey(project, 'project');
  checkKey(thread, 'thread');
  checkTime(time);
  const statements = statementsOf(store);
  const row = statements.thread.get(thread);
  if (row === undefined) throw new TypeError('no thread has this key');
  const wanted = row.state === 'open' ? (row.waits_on === 'owner' ? 'question' : 'comment') : null;
  let opened = 0;
  let closed = 0;
  let found = false;
  for (const entry of statements.threadEntries.all(thread)) {
    if (entry.kind === wanted && !found) {
      found = true;
    } else {
      closed += close(statements, entry.id, 'done', time);
    }
  }
  if (wanted !== null && !found) {
    open(statements, project, wanted, time, { diagram: Number(row.diagram_id), thread });
    opened += 1;
  }
  return { opened, closed };
}

// Change sets (SPEC-018 to SPEC-026; TASK-435, TASK-438, TASK-444, TASK-445, TASK-447): the owner's proposal entries
// and the agent's reflection entries of one diagram. Call it after a change set of the diagram is proposed, accepted,
// rejected, withdrawn, made by a direct edit, cancelled, linked to a pull request or unlinked from one, or reflected.
// Returns { opened, closed }.
export function changeSetsChanged(store, { project, diagram, time }) {
  checkKey(project, 'project');
  checkKey(diagram, 'diagram');
  checkTime(time);
  const statements = statementsOf(store);
  const sets = statements.changeSets.all(diagram, project).map((row) => ({
    id: Number(row.id),
    origin: row.origin,
    state: row.state,
    pullRequest: row.pull_request_id === null ? null : Number(row.pull_request_id),
  }));
  const byId = new Map(sets.map((set) => [set.id, set]));
  const counts = { opened: 0, closed: 0 };

  // The owner answers each proposal that is proposed (SPEC-018). Accepted or rejected it is done (SPEC-019,
  // SPEC-020); withdrawn by its agent (API-257), the entry is withdrawn too.
  const proposing = new Set();
  for (const entry of statements.diagramEntries.all(diagram, project, 'proposal')) {
    const set = byId.get(Number(entry.change_set_id));
    if (set.state === 'proposed' && !proposing.has(set.id)) {
      proposing.add(set.id);
    } else {
      counts.closed += close(statements, entry.id, set.state === 'cancelled' ? 'withdrawn' : 'done', time);
    }
  }
  for (const set of sets) {
    if (set.state === 'proposed' && !proposing.has(set.id)) {
      open(statements, project, 'proposal', time, { diagram, changeSet: set.id });
      counts.opened += 1;
    }
  }

  // The agent reflects each group of accepted change sets, one entry a group (see the top of this file).
  const groups = new Map();
  for (const set of sets) {
    if (set.state !== 'accepted') continue;
    if (!groups.has(set.pullRequest)) groups.set(set.pullRequest, []);
    groups.get(set.pullRequest).push(set.id);
  }
  const held = new Set();
  for (const entry of statements.diagramEntries.all(diagram, project, 'reflect')) {
    const anchor = entry.change_set_id === null ? undefined : byId.get(Number(entry.change_set_id));
    const group = anchor === undefined ? null : anchor.pullRequest;
    if (!groups.has(group) || held.has(group)) {
      const reflected = group !== null && sets.some((set) => set.pullRequest === group && set.state === 'reflected');
      counts.closed += close(statements, entry.id, reflected && !held.has(group) ? 'done' : 'withdrawn', time);
      continue;
    }
    held.add(group);
    if (anchor?.state !== 'accepted') statements.anchor.run(groups.get(group)[0], entry.id);
  }
  for (const [group, members] of groups) {
    if (held.has(group)) continue;
    open(statements, project, 'reflect', time, { diagram, changeSet: members[0] });
    counts.opened += 1;
  }
  return counts;
}

// A direct edit cancelled while it is in an open reflection pull request (SPEC-023, TASK-445): the agent takes it out
// of that pull request. The caller keeps the change set's pull request and calls changeSetsChanged as well, since the
// change set left its group. Returns { opened, entry }, entry the key of the open removal entry.
export function removeFromPullRequest(store, { project, diagram, changeSet, time }) {
  checkKey(project, 'project');
  checkKey(diagram, 'diagram');
  checkKey(changeSet, 'changeSet');
  checkTime(time);
  const statements = statementsOf(store);
  const found = statements.removal.get(changeSet, diagram);
  if (found !== undefined) return { opened: 0, entry: Number(found.id) };
  return { opened: 1, entry: open(statements, project, 'remove_from_pr', time, { diagram, changeSet }) };
}

// Any report of a removal entry's pull request closes the entry (API-258, TASK-447). entry is the entry's key in the
// project. Returns { closed }: 1, or 0 when it was closed already.
export function removalReported(store, { project, entry, time }) {
  checkKey(project, 'project');
  checkKey(entry, 'entry');
  checkTime(time);
  const statements = statementsOf(store);
  if (statements.removalEntry.get(entry, project) === undefined) throw new TypeError('no removal entry has this key');
  return { closed: close(statements, entry, 'done', time) };
}

// Whether the owner can confirm the diagram, so that it waits on the owner while it has no live confirmation: it is
// drawn (SPEC-029) and not removed (SPEC-027; note 4 of the WBS).
function takesConfirmation(diagram, drawn) {
  return diagram.removed_at === null && drawn;
}

// Confirmations (SPEC-029 to SPEC-033; TASK-435, TASK-446, TASK-447): the owner's confirm entry of one diagram and
// the agent's entries to record its confirmations and their cancels. Call it after the diagram is drawn for the first
// time, removed or back, and after a confirmation of it is made, cancelled, invalidated, recorded or its cancel
// recorded. The confirm entry names the last confirmation that ended, if any, so that the owner's to-do says why the
// diagram waits: never confirmed, invalidated or cancelled. Returns { opened, closed }.
export function confirmationsChanged(store, { project, diagram, time }) {
  checkKey(project, 'project');
  checkKey(diagram, 'diagram');
  checkTime(time);
  const statements = statementsOf(store);
  const row = statements.diagram.get(diagram, project);
  if (row === undefined) throw new TypeError('no diagram of the project has this key');
  const drawn = statements.drawn.get(diagram, project) !== undefined;
  const confirmations = statements.confirmations.all(diagram, project);
  const counts = { opened: 0, closed: 0 };

  const live = confirmations.some((confirmation) => confirmation.state === 'confirmed');
  const ended = confirmations.filter((confirmation) => confirmation.state !== 'confirmed').at(-1);
  const wanted = takesConfirmation(row, drawn) && !live ? (ended === undefined ? null : Number(ended.id)) : undefined;
  let found = false;
  for (const entry of statements.diagramEntries.all(diagram, project, 'confirm')) {
    const names = entry.confirmation_id === null ? null : Number(entry.confirmation_id);
    if (wanted !== undefined && names === wanted && !found) {
      found = true;
    } else {
      counts.closed += close(statements, entry.id, live ? 'done' : 'withdrawn', time);
    }
  }
  if (wanted !== undefined && !found) {
    open(statements, project, 'confirm', time, { diagram, confirmation: wanted });
    counts.opened += 1;
  }

  // Each confirmation waits to be recorded until it is, unless it is cancelled first (SPEC-031); one invalidated
  // meanwhile is still recorded at its version (SPEC-032). A cancel of a recorded confirmation waits to be recorded
  // in turn (SPEC-030).
  const wants = new Map();
  for (const confirmation of confirmations) {
    const id = Number(confirmation.id);
    if (confirmation.recorded_at === null && confirmation.state !== 'cancelled') wants.set(id, 'record_confirmation');
    if (confirmation.state === 'cancelled' && confirmation.recorded_at !== null && confirmation.cancel_recorded_at === null) {
      wants.set(id, 'record_cancel');
    }
  }
  const byId = new Map(confirmations.map((confirmation) => [Number(confirmation.id), confirmation]));
  const recording = new Set();
  for (const kind of ['record_confirmation', 'record_cancel']) {
    for (const entry of statements.diagramEntries.all(diagram, project, kind)) {
      const id = Number(entry.confirmation_id);
      if (wants.get(id) === kind && !recording.has(id)) {
        recording.add(id);
        continue;
      }
      const confirmation = byId.get(id);
      const done = kind === 'record_confirmation' ? confirmation.recorded_at !== null : confirmation.cancel_recorded_at !== null;
      counts.closed += close(statements, entry.id, done ? 'done' : 'withdrawn', time);
    }
  }
  for (const [id, kind] of wants) {
    if (recording.has(id)) continue;
    open(statements, project, kind, time, { diagram, confirmation: id });
    counts.opened += 1;
  }
  return counts;
}

// Workshop steps (SPEC-039, SPEC-040; TASK-452): writing each confirmed step into the domain document. Call it after a
// step of the workshop is confirmed or reported written. Returns { opened, closed }.
export function stepsChanged(store, { project, workshop, time }) {
  checkKey(project, 'project');
  checkKey(workshop, 'workshop');
  checkTime(time);
  const statements = statementsOf(store);
  const steps = new Map(statements.steps.all(workshop, project).map((row) => [row.step, row]));
  const counts = { opened: 0, closed: 0 };
  const waiting = new Set();
  for (const entry of statements.stepEntries.all(workshop, project)) {
    const step = steps.get(entry.step);
    if (step.confirmed_at !== null && step.written_at === null && !waiting.has(entry.step)) {
      waiting.add(entry.step);
    } else {
      counts.closed += close(statements, entry.id, step.written_at !== null ? 'done' : 'withdrawn', time);
    }
  }
  for (const [name, step] of steps) {
    if (step.confirmed_at === null || step.written_at !== null || waiting.has(name)) continue;
    open(statements, project, 'write_step', time, { workshop, step: name });
    counts.opened += 1;
  }
  return counts;
}

// Whether a step is one of the stage-01 checkpoints (REQ-043, SPEC-039).
export function isCheckpointStep(step) {
  return STEP_CHECKPOINTS.includes(step);
}

// The open entry of the agent to-do that an entry ID's key names in the project, or null (API-250, API-251, API-258,
// API-259; TASK-434, TASK-447). The pinned hub names an entry by what it is about: nc_ a thread, whose comment entry it
// is; ne_ the entry itself, a reflection or a removal; nk_ a confirmation, whose entry to record it or its cancel it
// is. prefix is 'nc', 'ne' or 'nk' and key the row key of the ID (see ids.js); nd_ names no entry, since NEXUS v3 opens
// no discrepancies. Returns the entry's row: { id, kind, diagram_id, thread_id, change_set_id, confirmation_id,
// created_at }.
export function openAgentEntry(store, { project, prefix, key }) {
  checkKey(project, 'project');
  checkKey(key, 'key');
  const statements = statementsOf(store);
  let row;
  if (prefix === 'nc') row = statements.openComment.get(key, project);
  else if (prefix === 'ne') row = statements.openAgent.get(key, project);
  else if (prefix === 'nk') row = statements.openRecord.get(key, project);
  else if (prefix === 'nd') row = undefined;
  else throw new TypeError('an entry ID starts with nc, nd, ne or nk');
  if (row !== undefined && prefix === 'ne' && !['reflect', 'remove_from_pr'].includes(row.kind)) row = undefined;
  return row ?? null;
}

// The change sets an entry of kind reflect or remove_from_pr holds, oldest first, and the key of their pull request
// or null: { changeSets, pullRequest } (API-245, API-248, API-258). entry is the entry's row, with its project,
// diagram_id, kind and change_set_id.
export function heldChangeSets(store, { project, entry }) {
  checkKey(project, 'project');
  const statements = statementsOf(store);
  const anchor = Number(entry.change_set_id);
  const pullRequestId = statements.anchorOf.get(anchor)?.pull_request_id ?? null;
  const pullRequest = pullRequestId === null ? null : Number(pullRequestId);
  if (entry.kind === 'remove_from_pr') return { changeSets: [anchor], pullRequest };
  if (entry.kind !== 'reflect') throw new TypeError('only a reflection or a removal holds change sets');
  const changeSets = statements.group.all(Number(entry.diagram_id), project, pullRequest).map((row) => Number(row.id));
  return { changeSets, pullRequest };
}
