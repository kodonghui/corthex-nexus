// Reports from the agent (TASK-447; API-258, API-259, SPEC-023, SPEC-024, SPEC-025, SPEC-032, SPEC-035, SPEC-045, notes
// 20 and 26 of the WBS): the pull request of a reflection or of a confirmation's record, as the pinned hub's reflect and
// record commands report it. Both are agent writes with a JSON body, a request key (rule 3) and the session in
// Nexus-Session. The server's README, "Reports", says the same with the choices the maintainer's delegate made.
//
// A pull request is a row of TBL-157, one per number in the project: the first report of a number makes it, with the
// reporting credential, and a reflection and a record may share it. Its link must be the project's repository's
// address, /pull/ and its number: another repository, or a project space that names none, gets repository_mismatch,
// and another address of the repository invalid_request on pull_request. Its state follows the reports: opened opens
// it, again when NEXUS had it closed, since GitHub reopens a closed pull request; merged, or reflected with its merge
// commit, merges it, also from closed, as the newer state; closed closes it. A merged pull request is not reopened or
// closed: invalid_request on event, "pull request N is merged".
//
// - API-258 (reportEdit) reports on a reflection or a removal entry (ne_), open or closed.
//   - A reflection's change sets are its group (entries.js's heldChangeSets). A report links them to its pull request
//     when they are in none (SPEC-024); a group in another pull request gets pull_request_mismatch, naming it. Without
//     a pull request in the body, the group's own is reported; a group in none gets pull_request_needed.
//   - opened keeps the entry's claim while the pull request is open: the claim names it (TBL-167), so it never ends
//     while it is open (SPEC-045). Reported again, it is the same link, changed false.
//   - merged records the merge; reflected records the merge commit, and when NEXUS holds a snapshot of that very
//     commit, reflects the change sets at once, as the push does (reflection.js), so the entry closes. Otherwise the
//     next push of that commit reflects them, and another commit marks nothing: reflected can be reported again with a
//     commit NEXUS holds.
//   - closed unlinks the group, whose change sets wait again (entries.js meets it with any entry opened meanwhile), and
//     the claim's 60 minutes start from the close (SPEC-045).
//   - A removal entry (SPEC-023) closes on any report of its change set's pull request; another pull request gets
//     pull_request_mismatch. It leaves the pull request's state to the reports of its reflection.
//   - needs-user is refused with invalid_request on event: the agent asks the owner in the thread instead.
//   - A closed entry: a report that repeats what is true, its pull request in the state the event names (and the merge
//     commit for reflected), answers changed false; any other report gets change_set_state with the state of the change
//     set the entry is named by.
// - API-259 (reportCheckpoint) reports on a confirmation (nk_) the pull request that records it, or its cancel, in the
//   stage record (SPEC-030, SPEC-031, SPEC-032).
//   - The record that is due is the confirmation's own until it is recorded, an invalidated one included, which is
//     recorded at its version and stays invalidated (SPEC-032); then, once a recorded confirmation is cancelled, the
//     cancel's. opened links the pull request to the confirmation (record_pull_request_id, which so names the pull
//     request of the record that is due, or of the last one recorded) and keeps the claim with it; another open pull
//     request already linked gets pull_request_mismatch. merged records it: recorded_at, or cancel_recorded_at for a
//     cancel, and the entry closes. closed unlinks it, and the claim's 60 minutes start.
//   - A record that merges may pass the stage: passes.js's passStage writes the pass, with the date of the last
//     confirmation, when every diagram of the stage has a recorded confirmation (SPEC-035, note 20). A cancel that
//     merges marks the passes that rested on the confirmation changed (passes.js's cancelRecorded, TASK-446).
//   - A confirmation cancelled before its record merged answers confirmation_cancelled (SPEC-032). When the report is
//     merged, Git now holds the record, so it is marked recorded and the agent to-do gets recording the cancel
//     (SPEC-030), and the refusal keeps that write (problem.js's keepingWrite). opened and closed write nothing.
//   - With nothing due, the pull request that recorded it reported again answers changed false; another gets
//     pull_request_mismatch.
// Every report on an open entry keeps its claim (claims.js's keepClaim), so another session's gets claimed; one that
// closes its entry releases the claim as done (finishClaim). The answer is the entry as API-248 or API-249 reads it
// (reads.js), its claim told mine for the reporting session, and changed. Nothing here logs: a link, a commit and a
// session's label are in the store and the answer only (rule 5).

import { finishClaim, keepClaim, pullRequestLink, sessionOf } from './claims.js';
import { formOf, onlyFields } from './comments.js';
import { changeSetsChanged, confirmationsChanged, heldChangeSets, openAgentEntry, removalReported } from './entries.js';
import { keyOf } from './ids.js';
import { cancelRecorded, passStage } from './passes.js';
import { invalidRequest, keepingWrite, Problem } from './problem.js';
import { checkpointBody, reflectionBody } from './reads.js';
import { reflectMerged } from './reflection.js';

// The contract's forms: Link, Commit, and the events of EditReport and CheckpointReport.
const LINK = /^https:\/\/\S+$/;
const LINK_LIMIT = 2000;
const COMMIT = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
const COMMIT_LIMIT = 64;
const NUMBER = /^[1-9][0-9]{0,8}$/;
const EDIT_EVENTS = Object.freeze(['opened', 'merged', 'closed', 'reflected', 'needs-user']);
const RECORD_EVENTS = Object.freeze(['opened', 'merged', 'closed']);
const EDIT_FIELDS = new Set(['event', 'pull_request', 'commit']);
const RECORD_FIELDS = new Set(['event', 'pull_request']);

// The statements of each store, prepared on first use (see credentials.js).
const prepared = new WeakMap();

const PULL = 'SELECT id, number, state, merge_commit, closed_at FROM pull_requests';

function statementsOf(store) {
  let statements = prepared.get(store);
  if (statements === undefined) {
    statements = {
      project: store.prepare('SELECT id, repository FROM project_spaces WHERE name = ?'),
      entry: store.prepare(
        `SELECT id, kind, diagram_id, change_set_id, closed_at, close_reason FROM todos
         WHERE id = ? AND project_id = ? AND kind IN ('reflect', 'remove_from_pr')`,
      ),
      open: store.prepare('SELECT 1 AS open FROM todos WHERE id = ? AND closed_at IS NULL'),
      changeSet: store.prepare('SELECT state, pull_request_id FROM change_sets WHERE id = ?'),
      byNumber: store.prepare(`${PULL} WHERE project_id = ? AND number = ?`),
      byId: store.prepare(`${PULL} WHERE id = ?`),
      insertPull: store.prepare(
        `INSERT INTO pull_requests (project_id, purpose, number, state, reported_at, credential_id)
         VALUES (?, ?, ?, 'open', ?, ?)`,
      ),
      movePull: store.prepare('UPDATE pull_requests SET state = ?, closed_at = ?, merge_commit = ? WHERE id = ?'),
      link: store.prepare("UPDATE change_sets SET pull_request_id = ?1 WHERE id = ?2 AND state = 'accepted' AND pull_request_id IS NOT ?1"),
      claimPull: store.prepare('UPDATE claims SET pull_request_id = ? WHERE todo_id = ? AND project_id = ? AND released_at IS NULL'),
      holds: store.prepare('SELECT 1 AS held FROM snapshots WHERE project_id = ? AND commit_sha = ? LIMIT 1'),
      confirmation: store.prepare(
        `SELECT k.id, k.diagram_id, k.state, k.recorded_at, k.record_pull_request_id, k.cancel_recorded_at, d.stage
         FROM confirmations k JOIN diagrams d ON d.id = k.diagram_id WHERE k.id = ? AND k.project_id = ?`,
      ),
      linkRecord: store.prepare('UPDATE confirmations SET record_pull_request_id = ? WHERE id = ?'),
      recorded: store.prepare('UPDATE confirmations SET recorded_at = ?, record_pull_request_id = ? WHERE id = ? AND recorded_at IS NULL'),
      cancelRecorded: store.prepare(
        'UPDATE confirmations SET cancel_recorded_at = ?, record_pull_request_id = ? WHERE id = ? AND cancel_recorded_at IS NULL',
      ),
    };
    prepared.set(store, statements);
  }
  return statements;
}

const timeNow = (now) => new Date(now()).toISOString();

function projectOf(statements, name) {
  const row = statements.project.get(name);
  if (row === undefined) throw new Problem('project_not_found');
  return { id: Number(row.id), repository: row.repository };
}

// The report's fields (EditReport or CheckpointReport): { event, pullRequest, commit }, each undefined when absent. A
// refusal names the field and never repeats its value (rule 5).
function reportOf(body, { fields, events }) {
  onlyFields(body, fields);
  if (!Object.hasOwn(body, 'event')) throw invalidRequest('event', 'event is required');
  if (!events.includes(body.event)) throw invalidRequest('event', `event is one of ${events.join(', ')}`);
  if (body.event === 'needs-user') {
    throw invalidRequest('event', 'needs-user is not reported to NEXUS; ask the owner in the thread instead');
  }
  const record = !fields.has('commit');
  const pullRequest = formOf(body, 'pull_request', { pattern: LINK, length: LINK_LIMIT, required: record });
  const commit = record
    ? undefined
    : formOf(body, 'commit', { pattern: COMMIT, length: COMMIT_LIMIT, required: body.event === 'reflected' });
  return { event: body.event, pullRequest, commit };
}

// The number of a pull request link of the project's repository (see the top of this file).
function numberOf(project, link) {
  if (project.repository === null) throw new Problem('repository_mismatch', 'the project names no repository');
  const base = `${project.repository.replace(/\/+$/, '').replace(/\.git$/, '')}/`;
  if (link.slice(0, base.length).toLowerCase() !== base.toLowerCase()) throw new Problem('repository_mismatch');
  const [, number] = /^pull\/([^/]+)\/?$/.exec(link.slice(base.length)) ?? [];
  if (number === undefined || !NUMBER.test(number)) {
    throw invalidRequest('pull_request', "pull_request is the address of a pull request of the project's repository");
  }
  return Number(number);
}

const mismatch = (project, pull) => new Problem('pull_request_mismatch', undefined, {}, {
  pull_request: pullRequestLink(project.repository, pull.number),
});

const pullOf = (row) => ({
  id: Number(row.id), number: Number(row.number), state: row.state, merge_commit: row.merge_commit, closed_at: row.closed_at,
});

// The pull request of number, made open with the reporting credential when NEXUS has none: a pull request as pullOf
// gives it, with made true when this report made it.
function pullRequestOf(statements, { project, number, purpose, credential, time }) {
  let row = statements.byNumber.get(project.id, number);
  let made = false;
  if (row === undefined) {
    statements.insertPull.run(project.id, purpose, number, time, credential);
    row = statements.byNumber.get(project.id, number);
    made = true;
  }
  return { ...pullOf(row), made };
}

// Moves the pull request to the state the event names (see the top of this file). Returns whether it changed.
function movePullRequest(statements, pull, { event, commit, time }) {
  if ((event === 'opened' || event === 'closed') && pull.state === 'merged') {
    throw invalidRequest('event', `pull request ${pull.number} is merged`);
  }
  let state = 'merged';
  if (event === 'opened') state = 'open';
  else if (event === 'closed') state = 'closed';
  const mergeCommit = event === 'reflected' ? commit : pull.merge_commit;
  if (state === pull.state && mergeCommit === pull.merge_commit) return false;
  let closedAt = time;
  if (state === 'open') closedAt = null;
  else if (state === pull.state) closedAt = pull.closed_at;
  statements.movePull.run(state, closedAt, mergeCommit, pull.id);
  Object.assign(pull, { state, merge_commit: mergeCommit, closed_at: closedAt });
  return true;
}

// Whether a report repeats what NEXUS has of the pull request: the state the event names, and for reflected its merge
// commit.
function repeats(pull, { event, commit }) {
  if (event === 'opened') return pull.state === 'open';
  if (event === 'closed') return pull.state === 'closed';
  if (event === 'merged') return pull.state === 'merged';
  return pull.state === 'merged' && pull.merge_commit === commit;
}

// A report on a closed reflection or removal entry: changed false when it repeats what is true of the entry's pull
// request; otherwise change_set_state, with the state of the change set the entry is named by. A withdrawn reflection
// names no pull request (reads.js), so any report on it is refused.
function closedEntryReport(statements, { entry, report, number }) {
  const anchor = statements.changeSet.get(Number(entry.change_set_id));
  const row = anchor.pull_request_id === null || entry.close_reason === 'withdrawn'
    ? undefined
    : statements.byId.get(Number(anchor.pull_request_id));
  const own = row !== undefined && (number === null || Number(row.number) === number);
  if (own && (entry.kind === 'remove_from_pr' || repeats(pullOf(row), report))) return false;
  throw new Problem('change_set_state', `this entry is closed; its change set is ${anchor.state}`, {}, { state: anchor.state });
}

// A report on an open removal entry: any report of its change set's pull request closes it (SPEC-023). The pull
// request's state is left to the reports of the reflection it belongs to.
function removalReport(store, statements, { project, entry, number, keep, time }) {
  const anchor = statements.changeSet.get(Number(entry.change_set_id));
  const row = anchor.pull_request_id === null ? undefined : statements.byId.get(Number(anchor.pull_request_id));
  if (row === undefined) throw new TypeError('a removal entry is of a change set in a pull request');
  if (number !== null && Number(row.number) !== number) throw mismatch(project, pullOf(row));
  keep();
  removalReported(store, { project: project.id, entry: Number(entry.id), time });
  return true;
}

// A report on an open reflection entry (see the top of this file). Returns whether it changed anything.
function reflectionReport(store, statements, { project, entry, report, number, credential, keep, time }) {
  const held = heldChangeSets(store, { project: project.id, entry });
  const linked = held.pullRequest === null ? undefined : pullOf(statements.byId.get(held.pullRequest));
  if (linked !== undefined && number !== null && linked.number !== number) throw mismatch(project, linked);
  if (linked === undefined && number === null) {
    throw new Problem('pull_request_needed', report.event === 'reflected' ? undefined : 'report the pull request with its address');
  }
  keep();
  const pull = linked === undefined
    ? pullRequestOf(statements, { project, number, purpose: 'reflection', credential, time })
    : { ...linked, made: false };
  let changed = movePullRequest(statements, pull, { event: report.event, commit: report.commit, time }) || pull.made;
  if (report.event === 'closed') {
    for (const set of held.changeSets) changed = statements.link.run(null, set).changes > 0 || changed;
  } else if (linked === undefined) {
    for (const set of held.changeSets) statements.link.run(pull.id, set);
    changed = true;
  }
  statements.claimPull.run(pull.id, Number(entry.id), project.id);
  changeSetsChanged(store, { project: project.id, diagram: Number(entry.diagram_id), time });
  if (report.event === 'reflected' && statements.holds.get(project.id, report.commit) !== undefined) {
    changed = reflectMerged(store, { project: project.id, commit: report.commit, time }) > 0 || changed;
  }
  return changed;
}

// API-258: the agent reports the pull request of a reflection or a removal (SPEC-023, SPEC-024, SPEC-025, SPEC-045).
function reportEdit({ store, params, request, body, credential, now }) {
  const session = sessionOf(request.headers, { required: true });
  const report = reportOf(body, { fields: EDIT_FIELDS, events: EDIT_EVENTS });
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  const key = keyOf('ne', params.edit);
  const entry = key === null ? undefined : statements.entry.get(key, project.id);
  if (entry === undefined) throw new Problem('edit_not_found');
  const number = report.pullRequest === undefined ? null : numberOf(project, report.pullRequest);
  const time = timeNow(now);
  let changed;
  if (entry.closed_at !== null) {
    changed = closedEntryReport(statements, { entry, report, number });
  } else {
    const keep = () => keepClaim(store, { project: project.id, entry: key, session, credential: credential.key, time });
    const context = { project, entry, report, number, credential: credential.key, keep, time };
    changed = entry.kind === 'remove_from_pr' ? removalReport(store, statements, context) : reflectionReport(store, statements, context);
    if (statements.open.get(key) === undefined) finishClaim(store, { project: project.id, entry: key, session, time });
  }
  return { body: { edit: reflectionBody(store, project, key, Date.parse(time), session), changed } };
}

// API-259: the agent reports the pull request that records a confirmation, or its cancel (SPEC-030, SPEC-031, SPEC-032,
// SPEC-035).
function reportCheckpoint({ store, params, request, body, credential, now }) {
  const session = sessionOf(request.headers, { required: true });
  const report = reportOf(body, { fields: RECORD_FIELDS, events: RECORD_EVENTS });
  const statements = statementsOf(store);
  const project = projectOf(statements, params.project);
  const key = keyOf('nk', params.checkpoint);
  const row = key === null ? undefined : statements.confirmation.get(key, project.id);
  if (row === undefined) throw new Problem('checkpoint_not_found');
  const number = numberOf(project, report.pullRequest);
  const time = timeNow(now);
  const answer = (changed) => ({ body: { checkpoint: checkpointBody(store, project, key, Date.parse(time), session), changed } });
  const diagram = Number(row.diagram_id);
  const cancelled = row.state === 'cancelled';
  const linked = row.record_pull_request_id === null ? undefined : pullOf(statements.byId.get(Number(row.record_pull_request_id)));

  // Cancelled before its record merged: refused, and a record that merged is kept, so that its cancel is recorded.
  if (cancelled && row.recorded_at === null) {
    if (report.event !== 'merged') throw new Problem('confirmation_cancelled');
    const pull = pullRequestOf(statements, { project, number, purpose: 'record', credential: credential.key, time });
    movePullRequest(statements, pull, { event: 'merged', time });
    statements.recorded.run(time, pull.id, key);
    confirmationsChanged(store, { project: project.id, diagram, time });
    throw keepingWrite(new Problem('confirmation_cancelled'));
  }
  // Nothing is due: the record, and the cancel's for a cancelled one, are in Git already.
  const cancelDue = cancelled && row.cancel_recorded_at === null;
  if (row.recorded_at !== null && !cancelDue) {
    if (linked === undefined || linked.number === number) return answer(false);
    throw mismatch(project, linked);
  }
  // The cancel is due, and the pull request that recorded the confirmation is reported again.
  if (cancelDue && linked?.state === 'merged' && linked.number === number) return answer(false);
  if (linked?.state === 'open' && linked.number !== number) throw mismatch(project, linked);

  const open = openAgentEntry(store, { project: project.id, prefix: 'nk', key });
  if (open === null) throw new TypeError('a record that is due has its entry on the agent to-do');
  const entry = Number(open.id);
  keepClaim(store, { project: project.id, entry, session, credential: credential.key, time });
  const pull = pullRequestOf(statements, { project, number, purpose: 'record', credential: credential.key, time });
  let changed = movePullRequest(statements, pull, { event: report.event, time }) || pull.made;
  statements.claimPull.run(pull.id, entry, project.id);
  if (report.event !== 'merged') {
    const wanted = report.event === 'opened' ? pull.id : null;
    const current = linked === undefined ? null : linked.id;
    if (current !== wanted && (wanted !== null || current === pull.id)) {
      statements.linkRecord.run(wanted, key);
      changed = true;
    }
    return answer(changed);
  }
  // merged: the record that is due is in Git, so its entry is done and the stage may pass.
  if (cancelDue) statements.cancelRecorded.run(time, pull.id, key);
  else statements.recorded.run(time, pull.id, key);
  confirmationsChanged(store, { project: project.id, diagram, time });
  finishClaim(store, { project: project.id, entry, session, time });
  if (cancelDue) cancelRecorded(store, { project: project.id, confirmation: key, time });
  else passStage(store, { project: project.id, stage: row.stage });
  return answer(true);
}

// The routes of API-258 and API-259 (see router.js), of the agent family, each with its JSON body and request key
// (rule 3).
const WRITE = Object.freeze({ method: 'POST', body: 'json', requestKey: true });

export const REPORT_ROUTES = Object.freeze([
  {
    ...WRITE,
    path: '/api/spaces/{project}/edits/{edit}/report',
    action: 'reportEdit',
    params: { project: 'project_not_found', edit: 'edit_not_found' },
    handle: reportEdit,
  },
  {
    ...WRITE,
    path: '/api/spaces/{project}/checkpoints/{checkpoint}/report',
    action: 'reportCheckpoint',
    params: { project: 'project_not_found', checkpoint: 'checkpoint_not_found' },
    handle: reportCheckpoint,
  },
]);
