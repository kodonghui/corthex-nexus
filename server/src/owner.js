// The owner's projects and to-do (TASK-439; API-262, API-263, SPEC-015, SPEC-042, SPEC-048): what the owner sees first,
// on SCR-142 and SCR-143. Both are owner operations, so admission lets only the owner's sign-in from the gate through
// (SPEC-048), and both carry the warning of a failed daily backup (backups.js). A read writes nothing and logs
// nothing; a project's text is in the answer only (rule 5).
//
// API-262 lists the project spaces as the contract's ProjectList, newest send first (SCR-143), those never sent after
// them by name, at most 1000. Each has its head as the project read finds it (projectHead: the title, the held
// revision, its commit and the time it was received), how many open entries wait on the owner, and how many of the 13
// stages are passed (stagesPassed). A new install has no project space, and the store never reads a v2 store
// (SPEC-015; see store.js), so it lists none.
//
// API-263 lists the open entries of the owner's to-do as the contract's OwnerTodo (SPEC-042): the diagrams to confirm,
// the AI proposals to answer and the agent questions, from TBL-166, which entries.js opens and closes. It takes the
// newest 5000 and groups them by project: the projects in the order of their newest entry, each one's entries newest
// first, so the first entry is the newest of all. An entry of a removed diagram stays as entries.js leaves it: its
// questions and proposals still wait on the owner, and its confirm entry was withdrawn (note 4 of the WBS).

import { backupWarning } from './backups.js';
import { idOf } from './ids.js';
import { latestPasses, projectHead, stagesPassed } from './project.js';
import { STAGES } from './snapshot.js';
import { diagramPart } from './todo.js';

// The contract's limits: ProjectList.projects, ProjectSummary.owner_todo and OwnerTodo.entries.
const LISTED_PROJECTS = 1000;
const COUNT = 1_000_000;
const LISTED_ENTRIES = 5000;
const STAGE_SET = new Set(STAGES);

// The statements of each store, prepared on first use (see credentials.js).
const prepared = new WeakMap();

function statementsOf(store) {
  let statements = prepared.get(store);
  if (statements === undefined) {
    statements = {
      // Newest send first: the time the held snapshot was received, as projectHead answers pushed_at.
      projects: store.prepare(
        `SELECT p.id, p.name, p.held_commit FROM project_spaces p
         LEFT JOIN snapshots s ON s.project_id = p.id AND s.commit_sha = p.held_commit
         ORDER BY s.received_at IS NULL, s.received_at DESC, p.name LIMIT ${LISTED_PROJECTS}`,
      ),
      ownerCounts: store.prepare(
        "SELECT project_id, count(*) AS n FROM todos WHERE side = 'owner' AND closed_at IS NULL GROUP BY project_id",
      ),
      // Every owner entry is about a diagram (TBL-166's checks). A proposal's thread is its change set's; a confirm
      // entry names the last confirmation of the diagram that ended, or none.
      entries: store.prepare(
        `SELECT t.id, t.kind, t.thread_id, t.change_set_id, t.created_at, p.name AS project,
                d.id AS diagram_id, d.stage, d.kind AS diagram_kind, d.source_key, d.name AS diagram_name,
                c.thread_id AS proposal_thread, k.state AS ended
         FROM todos t
         JOIN project_spaces p ON p.id = t.project_id
         JOIN diagrams d ON d.id = t.diagram_id
         LEFT JOIN change_sets c ON c.id = t.change_set_id
         LEFT JOIN confirmations k ON k.id = t.confirmation_id
         WHERE t.side = 'owner' AND t.closed_at IS NULL
         ORDER BY t.created_at DESC, t.id DESC LIMIT ${LISTED_ENTRIES}`,
      ),
    };
    prepared.set(store, statements);
  }
  return statements;
}

// The contract's ProjectList.
export function listProjects(store) {
  const statements = statementsOf(store);
  const owner = new Map(statements.ownerCounts.all().map((row) => [Number(row.project_id), Math.min(Number(row.n), COUNT)]));
  const projects = statements.projects.all().map((project) => {
    const id = Number(project.id);
    const head = projectHead(store, project);
    return {
      name: project.name,
      title: head.title,
      revision: head.revision,
      commit: head.commit,
      pushed_at: head.pushed_at,
      owner_todo: owner.get(id) ?? 0,
      stages_passed: stagesPassed(latestPasses(store, id)),
    };
  });
  return { projects, backup: backupWarning(store) };
}

// Why a diagram waits to be confirmed (OwnerTodoEntry.reason), from the last confirmation that ended: never
// confirmed when none did, else invalidated by a new document (SPEC-033) or cancelled (SPEC-030).
export function confirmReason(ended) {
  return ended === 'invalidated' || ended === 'cancelled' ? ended : 'new';
}

// The contract's OwnerTodo.
export function ownerTodo(store) {
  const parts = new Map();
  const groups = new Map();
  for (const row of statementsOf(store).entries.all()) {
    if (!STAGE_SET.has(row.stage)) continue;
    const diagram = { id: Number(row.diagram_id), stage: row.stage, kind: row.diagram_kind, source_key: row.source_key };
    const thread = row.kind === 'question' ? row.thread_id : row.kind === 'proposal' ? row.proposal_thread : null;
    const entry = {
      kind: row.kind,
      project: row.project,
      part: diagramPart(store, diagram, parts),
      stage: row.stage,
      diagram: idOf('dg', diagram.id),
      diagram_name: row.diagram_name,
      thread: thread === null ? null : idOf('nc', Number(thread)),
      change_set: row.kind === 'proposal' ? idOf('np', Number(row.change_set_id)) : null,
      reason: row.kind === 'confirm' ? confirmReason(row.ended) : null,
      since: row.created_at,
    };
    if (!groups.has(entry.project)) groups.set(entry.project, []);
    groups.get(entry.project).push(entry);
  }
  return { entries: [...groups.values()].flat(), backup: backupWarning(store) };
}

// The routes of API-262 and API-263 (see router.js), of the owner family.
export const OWNER_ROUTES = Object.freeze([
  { method: 'GET', path: '/api/projects', action: 'listProjects', handle: ({ store }) => ({ body: listProjects(store) }) },
  { method: 'GET', path: '/api/todo', action: 'getOwnerTodo', handle: ({ store }) => ({ body: ownerTodo(store) }) },
]);
