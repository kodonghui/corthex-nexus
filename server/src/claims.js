// Claims (TASK-434; API-250, API-251, SPEC-044, SPEC-045, TBL-167): an agent session holds one entry of the agent to-do
// alone, keeps it by writing and lets it go.
//
// A claim is a row of TBL-167 claims: one entry of TBL-166 (todo_id), the session that holds it and the credential
// that made it. At most one row of an entry is unreleased (claims_live).
//
// - When a claim ends (SPEC-045) is one rule, claimEnd below, which the agent to-do (todo.js) shows by too: a claim
//   lives while its pull request is open, and otherwise until 60 minutes after the later of its last write and its pull
//   request's close. A claim that has ended holds nothing; the next claim of its entry marks it released as 'idle', at
//   the time it ended.
// - An entry another session holds is refused with claimed, which names the holder, its last write and its end
//   (SPEC-044). Claimed again by the same session, it is the same claim with its last write moved on (rule 3). Writes
//   run one at a time in arrival order (rule 4, writes.js), so of two claims at once the first wins and the second is
//   refused.
// - A write keeps a claim: an agent's write on an entry calls keepClaim, which claims the entry as API-250 does, or
//   refuses the write with claimed (TASK-437, TASK-438, TASK-447). The agent operation that closes its own entry, a
//   reply, a proposal or a recorded confirmation (SPEC-017, SPEC-018, SPEC-032), then calls finishClaim in the same
//   transaction, which releases the session's claim as 'done'. entries.js never calls it: an entry the owner's action
//   closes, or one that is withdrawn, keeps its claim row as it is.
// - A closed entry's claim holds nothing (entryNamed below, the one place that decides it): a claim holds only its own
//   entry, and only while the entry is open. Once the entry closes, its claim is not shown, blocks no one and does not
//   carry over; a new entry under the same nc_ or nk_ ID starts unclaimed. Claiming a closed entry gets entry_closed
//   (API-250), and releasing one answers released false and writes nothing (API-251).
//
// Nothing here logs; a session's label is in the answers only, never in a log line (rule 5).

import { checkKey, checkTime, openAgentEntry } from './entries.js';
import { keyOf } from './ids.js';
import { invalidRequest, Problem } from './problem.js';

// A claim ends this long after the session's last write on its entry, or after its pull request closed (SPEC-045).
export const CLAIM_MS = 60 * 60 * 1000;
// The contract's SessionLabel.
const SESSION = /^[A-Za-z0-9._:-]{1,100}$/;

// The statements of each store, prepared on first use (see credentials.js).
const prepared = new WeakMap();

const HELD = `SELECT c.id, c.session, c.claimed_at, c.last_write_at, p.number, p.state AS pull_state, p.closed_at AS pull_closed_at
              FROM claims c LEFT JOIN pull_requests p ON p.id = c.pull_request_id`;

function statementsOf(store) {
  let statements = prepared.get(store);
  if (statements === undefined) {
    statements = {
      project: store.prepare('SELECT id, repository FROM project_spaces WHERE name = ?'),
      // The unreleased claim of an entry, with its pull request.
      held: store.prepare(`${HELD} WHERE c.todo_id = ? AND c.project_id = ? AND c.released_at IS NULL`),
      open: store.prepare("SELECT 1 AS open FROM todos WHERE id = ? AND project_id = ? AND side = 'agent' AND closed_at IS NULL"),
      insert: store.prepare(
        'INSERT INTO claims (project_id, todo_id, session, credential_id, claimed_at, last_write_at) VALUES (?, ?, ?, ?, ?, ?)',
      ),
      wrote: store.prepare('UPDATE claims SET last_write_at = ? WHERE id = ?'),
      release: store.prepare('UPDATE claims SET released_at = ?, release_reason = ? WHERE id = ? AND released_at IS NULL'),
      finish: store.prepare(
        "UPDATE claims SET released_at = ?, release_reason = 'done' WHERE todo_id = ? AND project_id = ? AND session = ? AND released_at IS NULL",
      ),
      // Whether an ID that names no open entry names one of the project's entries all the same, closed or waiting on
      // the owner: a thread or a confirmation that an entry was ever about, or a reflection or removal entry.
      named: {
        nc: store.prepare('SELECT 1 AS named FROM todos WHERE thread_id = ? AND project_id = ? LIMIT 1'),
        ne: store.prepare("SELECT 1 AS named FROM todos WHERE id = ? AND project_id = ? AND kind IN ('reflect', 'remove_from_pr')"),
        nk: store.prepare('SELECT 1 AS named FROM todos WHERE confirmation_id = ? AND project_id = ? LIMIT 1'),
      },
    };
    prepared.set(store, statements);
  }
  return statements;
}

// The Nexus-Session header's session label: null without one, unless required, when its absence is refused. A value
// that is not a SessionLabel is refused; the detail never repeats it.
export function sessionOf(headers, { required = false } = {}) {
  const value = headers['nexus-session'];
  if (value === undefined && !required) return null;
  if (value === undefined) throw invalidRequest('Nexus-Session', 'Nexus-Session names the session the claim is for');
  if (typeof value !== 'string' || !SESSION.test(value)) {
    throw invalidRequest('Nexus-Session', 'Nexus-Session is a session label of 1 to 100 letters, digits, dots, underscores, colons and hyphens');
  }
  return value;
}

function checkSession(session) {
  if (typeof session !== 'string' || !SESSION.test(session)) throw new TypeError('session is a session label');
}

// The repository's address that its pull requests' links begin with, ending in /: without trailing slashes and .git.
// The one rule that makes a link (pullRequestLink) and reads one (reports.js).
export const repositoryBase = (repository) => `${repository.replace(/\/+$/, '').replace(/\.git$/, '')}/`;

// The link of a pull request of the project's repository, as the hub reports it: the repository's address and
// /pull/ and its number. null when the project names no repository.
export function pullRequestLink(repository, number) {
  if (repository === null || number === null || number === undefined) return null;
  return `${repositoryBase(repository)}pull/${Number(number)}`;
}

// SPEC-045, the one rule of when a claim ends: null while its pull request is open, and otherwise the time in
// milliseconds 60 minutes after the later of its last write and its pull request's close. row has last_write_at and,
// from its pull request, pull_state and pull_closed_at (null or absent without one).
export function claimEnd(row) {
  if (row.pull_state === 'open') return null;
  const closed = row.pull_closed_at === null || row.pull_closed_at === undefined ? 0 : Date.parse(row.pull_closed_at);
  return Math.max(Date.parse(row.last_write_at), closed) + CLAIM_MS;
}

function isLive(row, now) {
  const end = claimEnd(row);
  return end === null || now < end;
}

const timeOf = (ms) => (ms === null ? null : new Date(ms).toISOString());

// A claim row as the contract's Claim of entry (its ID), or null when there is none or it has ended (SPEC-045).
// session is the label of the session that asks, or null; now the time in milliseconds; repository the project's.
export function claimOf(row, { entry, session, now, repository }) {
  if (row === undefined || row === null || !isLive(row, now)) return null;
  return {
    entry,
    session: row.session,
    mine: session !== null && row.session === session,
    claimed_at: row.claimed_at,
    last_write_at: row.last_write_at,
    ends_at: timeOf(claimEnd(row)),
    pull_request: row.number === null || row.number === undefined ? null : pullRequestLink(repository, row.number),
  };
}

// The refusal of a write or a claim on an entry that another session holds (SPEC-044).
function claimedBy(row) {
  return new Problem('claimed', undefined, {}, {
    session: row.session,
    last_write_at: row.last_write_at,
    ends_at: timeOf(claimEnd(row)),
  });
}

// A write keeps a claim (API-250, SPEC-044, SPEC-045): the session claims the open entry of the agent to-do whose key
// is entry, in the project, or keeps its claim with time as its last write. Call it from an agent's write on an entry,
// before the write's own changes, with the request's session and credential key and the write's time. An entry
// another session holds throws the claimed Problem; a claim that has ended is released as 'idle' and a new one made.
// Returns the claim row, as claimOf takes it.
export function keepClaim(store, { project, entry, session, credential, time }) {
  checkKey(project, 'project');
  checkKey(entry, 'entry');
  checkKey(credential, 'credential');
  checkSession(session);
  checkTime(time);
  const statements = statementsOf(store);
  if (statements.open.get(entry, project) === undefined) throw new TypeError('a claim is of an open entry of the agent to-do');
  const now = Date.parse(time);
  const held = statements.held.get(entry, project);
  if (held !== undefined) {
    if (isLive(held, now)) {
      if (held.session !== session) throw claimedBy(held);
      statements.wrote.run(time, Number(held.id));
      return { ...held, last_write_at: time };
    }
    statements.release.run(timeOf(claimEnd(held)), 'idle', Number(held.id));
  }
  statements.insert.run(project, entry, session, credential, time, time);
  return { session, claimed_at: time, last_write_at: time, number: null, pull_state: null, pull_closed_at: null };
}

// The agent operation that closes its own entry releases its session's claim of it as 'done', in the same transaction
// (SPEC-017, SPEC-018, SPEC-032). Returns { released }: 1, or 0 when the session held no claim of it.
export function finishClaim(store, { project, entry, session, time }) {
  checkKey(project, 'project');
  checkKey(entry, 'entry');
  checkSession(session);
  checkTime(time);
  return { released: Number(statementsOf(store).finish.run(time, entry, project, session).changes) };
}

// Ends the session's live claim of the open entry entry (API-251): { released } true, or false when the entry has no
// live claim. Another session's live claim throws the claimed Problem.
export function releaseClaim(store, { project, entry, session, time }) {
  checkKey(project, 'project');
  checkKey(entry, 'entry');
  checkSession(session);
  checkTime(time);
  const statements = statementsOf(store);
  const held = statements.held.get(entry, project);
  if (held === undefined || !isLive(held, Date.parse(time))) return { released: false };
  if (held.session !== session) throw claimedBy(held);
  statements.release.run(time, 'released', Number(held.id));
  return { released: true };
}

function projectOf(store, name) {
  const row = statementsOf(store).project.get(name);
  if (row === undefined) throw new Problem('project_not_found');
  return { id: Number(row.id), repository: row.repository };
}

// The entry an entry ID names in the project: { entry }, the key of its open entry of the agent to-do, or null when
// what it names has no open entry: a closed entry, or a thread that waits on the owner. An ID that names nothing of
// the project, an nd_ ID (NEXUS v3 opens no discrepancies) and an ne_ ID of another kind of entry get entry_not_found.
function entryNamed(store, project, id) {
  const prefix = id.slice(0, 2);
  const key = keyOf(prefix, id);
  if (key !== null && prefix !== 'nd') {
    const open = openAgentEntry(store, { project, prefix, key });
    if (open !== null) return { entry: Number(open.id) };
    if (statementsOf(store).named[prefix].get(key, project) !== undefined) return { entry: null };
  }
  throw new Problem('entry_not_found');
}

const timeNow = (now) => new Date(now()).toISOString();

// API-250: the session claims the entry, or keeps its claim.
function claimEntry({ store, params, request, credential, now }) {
  const session = sessionOf(request.headers, { required: true });
  const project = projectOf(store, params.project);
  const { entry } = entryNamed(store, project.id, params.entry);
  if (entry === null) throw new Problem('entry_closed');
  const time = timeNow(now);
  const claim = keepClaim(store, { project: project.id, entry, session, credential: credential.key, time });
  return { body: claimOf(claim, { entry: params.entry, session, now: Date.parse(time), repository: project.repository }) };
}

// API-251: the session lets its claim go.
function releaseEntry({ store, params, request, now }) {
  const session = sessionOf(request.headers, { required: true });
  const project = projectOf(store, params.project);
  const { entry } = entryNamed(store, project.id, params.entry);
  const { released } = entry === null
    ? { released: false }
    : releaseClaim(store, { project: project.id, entry, session, time: timeNow(now) });
  return { body: { entry: params.entry, released } };
}

// The routes of API-250 and API-251 (see router.js), of the agent family. The hub sends neither a body nor a request
// key: a repeat is the same session's claim or release (rule 3).
const PARAMS = Object.freeze({ project: 'project_not_found', entry: 'entry_not_found' });

export const CLAIM_ROUTES = Object.freeze([
  { method: 'POST', path: '/api/spaces/{project}/claims/{entry}', action: 'claimEntry', params: PARAMS, handle: claimEntry },
  { method: 'DELETE', path: '/api/spaces/{project}/claims/{entry}', action: 'releaseEntry', params: PARAMS, handle: releaseEntry },
]);
