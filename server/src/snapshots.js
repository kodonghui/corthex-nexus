// Snapshot intake (TASK-418; SPEC-001, SPEC-002, SPEC-014): the hub's push (API-242) and the held commit it reads
// before every push (API-243).
//
// A push is checked as snapshot.js reads it, then, in the write's transaction (rule 4, see writes.js):
// - A project without a space gets one (SPEC-002), created by the credential that sent it, with the snapshot as its
//   revision 1: 201 and created true. The pinned hub sends such a snapshot only after the user's yes, push --first.
//   Two first sends of one project at once run one after the other, so the second is handled as a send to the space
//   the first created.
// - A snapshot of another repository than the project's gets repository_mismatch.
// - The held commit again is the same revision, and nothing is kept again: same_commit true. In a newer format than
//   the one the commit came in, it completes that revision: NEXUS keeps the documents of the picture stages the older
//   format did not carry, and the held commit's format becomes the newer one (API-243).
// - A commit NEXUS held at an earlier revision gets older_snapshot, naming that revision.
// - Any other commit must name the held commit in replaces, which the hub sets only for a commit that descends from it
//   or after the user agreed to replace it (REQ-002); otherwise commit_not_replaced, naming the held commit. It becomes
//   the next revision and the held commit.
// A refused push changes nothing. A kept snapshot keeps its documents (TBL-149, TBL-150), each text once by its
// SHA-256; a document whose text looks like a secret or an email address is left out and named in refused (REQ-077).
// Then drawing.js draws it (TASK-419): its diagrams, drawings and elements. The answer counts what drew and names the
// sources that failed; what a drawing changes after it, confirmations, change sets and threads, is TASK-435's (note 14
// of the WBS), so those counts are 0 until it lands.
//
// The hub sends push with no request key: a repeat is recognised by its commit (rule 3). A push that carries one is
// refused, since the same key would not give the first answer as rule 3 says. No log line holds a document's text, a
// path of the snapshot or what was found in it (rule 5).

import { createHash } from 'node:crypto';
import { checkDrawers, drawSnapshot, DRAWERS, heldDrawing } from './drawing.js';
import { invalidRequest, Problem } from './problem.js';
import { carriedBy, FORMATS, isNewer, readSnapshot } from './snapshot.js';

// The answer's refused list holds at most this many, as the contract's PushAnswer allows.
const REFUSED = 500;

// The statements of each store, prepared on first use (see credentials.js).
const prepared = new WeakMap();

function statementsOf(store) {
  let statements = prepared.get(store);
  if (statements === undefined) {
    statements = {
      project: store.prepare('SELECT id, name, repository, held_commit FROM project_spaces WHERE name = ?'),
      createProject: store.prepare(
        'INSERT INTO project_spaces (name, repository, held_commit, created_at, created_by_credential) VALUES (?, ?, ?, ?, ?)',
      ),
      hold: store.prepare('UPDATE project_spaces SET held_commit = ?, repository = ? WHERE id = ?'),
      byCommit: store.prepare('SELECT id, revision, format_version FROM snapshots WHERE project_id = ? AND commit_sha = ?'),
      lastRevision: store.prepare('SELECT max(revision) AS revision FROM snapshots WHERE project_id = ?'),
      insertSnapshot: store.prepare(
        'INSERT INTO snapshots (project_id, revision, commit_sha, replaced_commit, format_version, bytes, received_at, credential_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ),
      format: store.prepare('UPDATE snapshots SET format_version = ? WHERE id = ?'),
      blob: store.prepare('INSERT INTO document_blobs (sha256, body, bytes) VALUES (?, ?, ?) ON CONFLICT (sha256) DO NOTHING'),
      file: store.prepare('INSERT INTO snapshot_files (snapshot_id, path, stage, blob_sha256) VALUES (?, ?, ?, ?)'),
      held: store.prepare(
        `SELECT p.name, p.held_commit, s.revision, s.format_version FROM project_spaces p
         LEFT JOIN snapshots s ON s.project_id = p.id AND s.commit_sha = p.held_commit WHERE p.name = ?`,
      ),
    };
    prepared.set(store, statements);
  }
  return statements;
}

// Keeps the documents of a snapshot, each text once by its SHA-256, and leaves out those that look like they hold a
// secret or an email address. Returns { kept, refused }: what drawing.js gets, each with where it comes from, and the
// answer's refused entries.
function keep(statements, snapshotId, documents) {
  const kept = [];
  const refused = [];
  for (const document of documents) {
    if (document.why !== null) {
      refused.push({ part: document.part, stage: document.stage, where: document.where, why: document.why });
      continue;
    }
    const sha256 = createHash('sha256').update(document.text, 'utf8').digest('hex');
    statements.blob.run(sha256, document.text, Buffer.byteLength(document.text, 'utf8'));
    statements.file.run(snapshotId, document.path, document.stage, sha256);
    const { path, stage, part, key, kind, where } = document;
    kept.push(Object.freeze({ path, stage, part, key, kind, sha256, where }));
  }
  return { kept, refused: refused.slice(0, REFUSED) };
}

// The answer of API-242, the contract's PushAnswer.
function answer({ project, revision, commit, replaced, created, sameCommit, drawn, refused }) {
  return {
    status: created ? 201 : 200,
    body: {
      project,
      revision,
      commit,
      replaced,
      created,
      same_commit: sameCommit,
      diagrams: drawn.diagrams,
      failures: drawn.failures,
      refused,
      confirmations_invalidated: 0,
      change_sets_reflected: 0,
      threads_moved: 0,
    },
  };
}

// API-242: the hub's push, drawn by drawers (see drawing.js).
function pushSnapshot(drawers, { store, request, body, size, credential, now }) {
  if (request.headers['idempotency-key'] !== undefined) {
    throw invalidRequest('Idempotency-Key', 'push takes no request key: the same commit again answers its revision');
  }
  const snapshot = readSnapshot(body);
  const statements = statementsOf(store);
  const time = new Date(now()).toISOString();
  let project = statements.project.get(snapshot.project);
  const created = project === undefined;
  let replaced = null;

  if (created) {
    const { lastInsertRowid } = statements.createProject.run(snapshot.project, snapshot.repository, snapshot.commit, time, credential.key);
    project = { id: Number(lastInsertRowid), name: snapshot.project, repository: snapshot.repository, held_commit: null };
  } else {
    if (project.repository !== null && project.repository !== snapshot.repository) throw new Problem('repository_mismatch');
    const earlier = statements.byCommit.get(project.id, snapshot.commit);
    if (earlier !== undefined && project.held_commit === snapshot.commit) {
      return again({ statements, store, project, held: earlier, snapshot, time, drawers });
    }
    if (earlier !== undefined) throw new Problem('older_snapshot', undefined, {}, { revision: Number(earlier.revision) });
    if (project.held_commit !== null && snapshot.replaces !== project.held_commit) {
      throw new Problem('commit_not_replaced', undefined, {}, { held_commit: project.held_commit });
    }
    replaced = project.held_commit;
    statements.hold.run(snapshot.commit, project.repository ?? snapshot.repository, project.id);
  }

  const revision = Number(statements.lastRevision.get(project.id).revision ?? 0) + 1;
  const { lastInsertRowid } = statements.insertSnapshot.run(
    project.id, revision, snapshot.commit, replaced, snapshot.format, size, time, credential.key,
  );
  const snapshotId = Number(lastInsertRowid);
  const { kept, refused } = keep(statements, snapshotId, snapshot.documents);
  const drawn = drawSnapshot({
    store,
    project: { id: project.id, name: project.name },
    snapshot: { id: snapshotId, revision, commit: snapshot.commit, format: snapshot.format, carries: snapshot.carries, carried: [] },
    completed: false,
    documents: kept,
    time,
    drawers,
  });
  return answer({ project: project.name, revision, commit: snapshot.commit, replaced, created, sameCommit: false, drawn, refused });
}

// The held commit again: the same revision. In a newer format than it came in, it completes that revision with the
// documents of the picture stages the older format did not carry and draws them; otherwise nothing is kept again or
// drawn, and every diagram is unchanged but those whose source fails, named in failures again.
function again({ statements, store, project, held, snapshot, time, drawers }) {
  const revision = Number(held.revision);
  // The push's documents, less those left out as REQ-077 asks: a diagram that is not drawn again and whose source is
  // among them fails as its last drawing did.
  const sent =snapshot.documents.filter((document) => document.why === null);
  let drawn;
  let refused = [];
  if (isNewer(snapshot.format, held.format_version)) {
    const carried = carriedBy(held.format_version);
    const before = new Set(carried);
    const isAdded = (document) => document.kind === 'picture' && !before.has(document.stage);
    statements.format.run(snapshot.format, held.id);
    const kept = keep(statements, Number(held.id), snapshot.documents.filter(isAdded));
    refused = kept.refused;
    drawn = drawSnapshot({
      store,
      project: { id: project.id, name: project.name },
      snapshot: { id: Number(held.id), revision, commit: snapshot.commit, format: snapshot.format, carries: snapshot.carries, carried },
      completed: true,
      documents: kept.kept,
      earlier: sent.filter((document) => !isAdded(document)),
      time,
      drawers,
    });
  } else {
    drawn = heldDrawing({ store, project, documents: sent });
  }
  return answer({ project: project.name, revision, commit: snapshot.commit, replaced: null, created: false, sameCommit: true, drawn, refused });
}

// API-243: the held commit, its revision and the format it came in, and the formats NEXUS takes.
function getHeldCommit({ store, params }) {
  const row = statementsOf(store).held.get(params.project);
  if (row === undefined) throw new Problem('project_not_found');
  return {
    body: {
      project: row.name,
      default_commit: row.held_commit,
      revision: row.revision === null ? null : Number(row.revision),
      formats: [...FORMATS],
      format: row.format_version,
    },
  };
}

// The routes of API-242 and API-243 (see router.js), both of the agent family. The push draws with drawers by kind,
// drawing.js's DRAWERS unless a test gives its own.
export function snapshotRoutes({ drawers = DRAWERS } = {}) {
  checkDrawers(drawers);
  return Object.freeze([
    { method: 'POST', path: '/api/snapshots', action: 'pushSnapshot', body: 'snapshot', handle: (context) => pushSnapshot(drawers, context) },
    {
      method: 'GET',
      path: '/api/snapshots/{project}/held',
      action: 'getHeldCommit',
      params: { project: 'project_not_found' },
      handle: getHeldCommit,
    },
  ]);
}

export const SNAPSHOT_ROUTES = snapshotRoutes();
