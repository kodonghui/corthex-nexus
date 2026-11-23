// Deleting a project space (TASK-448; API-277, API-278, SPEC-013): what the deletion removes, with counts, and the
// deletion itself once the owner confirms by sending the project's name. Both are owner operations; an agent never
// deletes (REQ-017). removalPreview is the one preview: TASK-436's API-244, the agent's read of the same preview, calls
// it too.
//
// What goes: every row of the project, and nothing of another project. Each table of a project reaches project_spaces
// through ON DELETE CASCADE, by the schema's keys (db/nexus.sql), so deleting the space's row deletes its snapshots,
// their files, diagrams, drawings, elements, positions, threads, comments, pull requests, change sets and their
// changes, confirmations, stage passes, workshops with their steps, notes and links, to-do entries, claims and tool
// links. A document's text is kept once by its SHA-256 however many snapshots hold it (TBL-149), and so may be shared
// with another project: the deletion also removes, in the same transaction, the project's blobs that no remaining
// snapshot file names, as the schema's comment on TBL-149 says, and a blob another project still names stays.
// Agent credentials, request keys and backups are no project's rows, so they stay: a backup keeps the project until it
// ages out after 30 days (SPEC-052).
//
// The preview has the 11 counts RemovalPreview names, each of every row of its kind the deletion removes, removed
// diagrams and tool links included (the rows of the other tables, such as elements, pull requests, stage passes and
// to-do entries, go too but have no count), and what is still open: the open threads, the change sets still proposed
// or accepted and waiting for reflection, and the confirmations to record, as entries.js's rules open them (a
// confirmation not recorded and not cancelled, or a recorded one whose cancel is not recorded). A deletion answers the
// counts it took in its own transaction just before it deleted.
//
// Nothing here logs; the project's name is in the path and the answer only, never in a log line (rule 5).

import { invalidRequest, Problem } from './problem.js';

// The contract's limit of each count.
const COUNT = 1_000_000;

// The statements of each store, prepared on first use (see credentials.js).
const prepared = new WeakMap();

function statementsOf(store) {
  let statements = prepared.get(store);
  if (statements === undefined) {
    statements = {
      project: store.prepare('SELECT id, name, held_commit FROM project_spaces WHERE name = ?'),
      held: store.prepare('SELECT revision FROM snapshots WHERE project_id = ? AND commit_sha = ?'),
      // Drawings, change sets and confirmations are counted through their diagram, whose project a key holds them to
      // (db/nexus.sql), since their indexes start with the diagram: no count reads a whole table.
      counts: store.prepare(
        `SELECT
           (SELECT count(*) FROM snapshots WHERE project_id = :project) AS snapshots,
           (SELECT count(*) FROM diagrams WHERE project_id = :project) AS diagrams,
           (SELECT count(*) FROM drawings w JOIN diagrams d ON d.id = w.diagram_id WHERE d.project_id = :project) AS drawings,
           (SELECT count(*) FROM comment_threads h JOIN diagrams d ON d.id = h.diagram_id WHERE d.project_id = :project) AS threads,
           (SELECT count(*) FROM comments c JOIN comment_threads h ON h.id = c.thread_id JOIN diagrams d ON d.id = h.diagram_id
            WHERE d.project_id = :project) AS comments,
           (SELECT count(*) FROM change_sets c JOIN diagrams d ON d.id = c.diagram_id WHERE d.project_id = :project) AS change_sets,
           (SELECT count(*) FROM confirmations c JOIN diagrams d ON d.id = c.diagram_id WHERE d.project_id = :project) AS confirmations,
           (SELECT count(*) FROM element_positions p JOIN diagrams d ON d.id = p.diagram_id WHERE d.project_id = :project) AS positions,
           (SELECT count(*) FROM workshops WHERE project_id = :project) AS workshops,
           (SELECT count(*) FROM sticky_notes n JOIN workshops w ON w.id = n.workshop_id WHERE w.project_id = :project) AS notes,
           (SELECT count(*) FROM tool_links WHERE project_id = :project) AS tool_links,
           (SELECT count(*) FROM comment_threads h JOIN diagrams d ON d.id = h.diagram_id
            WHERE d.project_id = :project AND h.state = 'open') AS open_threads,
           (SELECT count(*) FROM change_sets c JOIN diagrams d ON d.id = c.diagram_id
            WHERE d.project_id = :project AND c.state IN ('proposed', 'accepted')) AS open_change_sets,
           (SELECT count(*) FROM confirmations c JOIN diagrams d ON d.id = c.diagram_id WHERE d.project_id = :project
            AND ((c.state <> 'cancelled' AND c.recorded_at IS NULL)
              OR (c.state = 'cancelled' AND c.recorded_at IS NOT NULL AND c.cancel_recorded_at IS NULL))) AS to_record`,
      ),
      // The blobs the project's snapshot files name, before the deletion takes the files.
      blobs: store.prepare(
        `SELECT DISTINCT f.blob_sha256 AS sha256 FROM snapshot_files f JOIN snapshots s ON s.id = f.snapshot_id
         WHERE s.project_id = ?`,
      ),
      remove: store.prepare('DELETE FROM project_spaces WHERE id = ?'),
      // A blob, unless a snapshot file still names it.
      unnamed: store.prepare(
        'DELETE FROM document_blobs WHERE sha256 = ? AND NOT EXISTS (SELECT 1 FROM snapshot_files f WHERE f.blob_sha256 = document_blobs.sha256)',
      ),
    };
    prepared.set(store, statements);
  }
  return statements;
}

const count = (value) => Math.min(Number(value), COUNT);

// The counts of the project space with this key: { deletes, open }, as RemovalPreview names them.
function countsOf(store, projectId) {
  const row = statementsOf(store).counts.get({ project: projectId });
  const deletes = {};
  for (const name of ['snapshots', 'diagrams', 'drawings', 'threads', 'comments', 'change_sets', 'confirmations', 'positions',
    'workshops', 'notes', 'tool_links']) deletes[name] = count(row[name]);
  return {
    deletes,
    open: { threads: count(row.open_threads), change_sets: count(row.open_change_sets), confirmations_to_record: count(row.to_record) },
  };
}

// What deleting the project space named name removes, as the contract's RemovalPreview, or null when no space has the
// name. revision and commit are the held commit's, null before the first snapshot.
export function removalPreview(store, name) {
  const statements = statementsOf(store);
  const project = statements.project.get(name);
  if (project === undefined) return null;
  const projectId = Number(project.id);
  const held = project.held_commit === null ? undefined : statements.held.get(projectId, project.held_commit);
  return {
    project: project.name,
    revision: held === undefined ? null : Number(held.revision),
    commit: project.held_commit,
    ...countsOf(store, projectId),
  };
}

// Deletes the project space of project, its row of TBL-147 with id and name, and every row of it, with the blobs only
// it named, in the caller's transaction: the contract's RemovalAnswer.
function removeSpace(store, project) {
  const statements = statementsOf(store);
  const projectId = Number(project.id);
  const { deletes } = countsOf(store, projectId);
  const blobs = statements.blobs.all(projectId).map((row) => row.sha256);
  statements.remove.run(projectId);
  for (const blob of blobs) statements.unnamed.run(blob);
  return { project: project.name, removed: true, deleted: deletes };
}

// The name of RemovalRequest, the project's name the owner typed. A refusal names the field, never the value.
function nameOf(body) {
  if (Object.keys(body).some((field) => field !== 'name')) throw invalidRequest('body', 'the body takes name only');
  if (!Object.hasOwn(body, 'name')) throw invalidRequest('name', 'name is required');
  if (typeof body.name !== 'string') throw invalidRequest('name', 'name must be text');
  return body.name;
}

// API-277: what deleting {project} removes. A name no project space has answers project_not_found.
function getRemovalPreview({ store, params }) {
  const body = removalPreview(store, params.project);
  if (body === null) throw new Problem('project_not_found');
  return { body };
}

// API-278: deletes {project} once the body names it (SPEC-013). A space already gone is project_not_found, whatever the
// body holds, so the space is found before the body is read; a body that does not name it is invalid_request, and
// nothing is removed.
function deleteProject({ store, params, body }) {
  const project = statementsOf(store).project.get(params.project);
  if (project === undefined) throw new Problem('project_not_found');
  if (nameOf(body) !== project.name) throw invalidRequest('name', "name must be the project's name");
  return { body: removeSpace(store, project) };
}

// The routes of API-277 and API-278 (see router.js), of the owner family.
export const REMOVAL_ROUTES = Object.freeze([
  {
    method: 'GET',
    path: '/api/projects/{project}/removal',
    action: 'getRemovalPreview',
    params: { project: 'project_not_found' },
    handle: getRemovalPreview,
  },
  {
    method: 'POST',
    path: '/api/projects/{project}/removal',
    action: 'deleteProject',
    params: { project: 'project_not_found' },
    body: 'json',
    requestKey: true,
    handle: deleteProject,
  },
]);
