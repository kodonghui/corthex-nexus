// The project read (TASK-440; API-264, SPEC-005, SPEC-027, SPEC-035, SPEC-046): one project as the owner's project
// screen shows it, its stages grouped by part with their diagrams and states, its stage passes, its tool links and its
// workshop. A read writes nothing and logs nothing; the project's text is in the answer only (rule 5).
//
// The answer is the contract's Project:
// - the head, from the project space (TBL-147) and its held snapshot (TBL-148): the revision and the time it was
//   received, and the title and parts its /snapshot document holds (TBL-150, TBL-149; see snapshot.js);
// - stages: groups of the 13 stages, one group per part (stageGroups), each row with the diagrams of its stage and part
//   (TBL-151) and its state (stageState). A diagram tells whether it was drawn (TBL-152), its confirmation (TBL-160),
//   its change sets waiting for reflection (TBL-158) and its open threads (TBL-155);
// - tool_links: the live tool links (TBL-168), oldest first, with the status last read;
// - workshop: the project's latest workshop (TBL-162), open or closed, or null.
// Stage passes and tool links are only read here: TASK-447 and the workshop tasks write passes, TASK-435 marks them
// changed, and TASK-451 writes tool links.

import { idOf } from './ids.js';
import { Problem } from './problem.js';
import { STAGES } from './snapshot.js';
import { diagramPart } from './todo.js';

// The contract's limits: StageState.diagrams, Project.tool_links, Project.parts, the groups Project.stages holds
// (663 rows, 13 per group), the length of Project.title and ToolLink.status, and the counts of a DiagramSummary.
const LISTED_DIAGRAMS = 500;
const LISTED_LINKS = 200;
const PARTS = 50;
const GROUPS = 51;
const TITLE_LENGTH = 120;
const STATUS_LENGTH = 120;
const COUNT = 1_000_000;
// The contract's Part.
const PART = /^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/;
const PART_LENGTH = 100;
const STAGE_SET = new Set(STAGES);

// The order of a project's diagrams, as an ORDER BY of diagrams under the alias d: those that are not removed first,
// each by name and then by ID, so that a stage's first diagram, the one its address opens, is the first of the stage
// that is not removed (SPEC-016); then the removed ones in the same order (SPEC-027). The project read lists the
// diagrams by it, and an agent's comment without item or diagram goes on the first (comments.js).
export const DIAGRAM_ORDER = 'd.removed_at IS NOT NULL, d.name, d.id';

// The statements of each store, prepared on first use (see credentials.js).
const prepared = new WeakMap();

function statementsOf(store) {
  let statements = prepared.get(store);
  if (statements === undefined) {
    statements = {
      project: store.prepare('SELECT id, name, repository, held_commit FROM project_spaces WHERE name = ?'),
      held: store.prepare(
        `SELECT s.revision, s.received_at, b.body AS rest FROM snapshots s
         LEFT JOIN snapshot_files f ON f.snapshot_id = s.id AND f.path = '/snapshot'
         LEFT JOIN document_blobs b ON b.sha256 = f.blob_sha256
         WHERE s.project_id = ? AND s.commit_sha = ?`,
      ),
      // Each diagram of the project, in DIAGRAM_ORDER.
      diagrams: store.prepare(
        `SELECT d.id, d.stage, d.source_key, d.kind, d.name, d.removed_at,
                EXISTS (SELECT 1 FROM drawings w WHERE w.diagram_id = d.id AND w.status = 'drawn') AS drawn,
                (SELECT count(*) FROM comment_threads h WHERE h.diagram_id = d.id AND h.state = 'open') AS open_threads,
                (SELECT count(*) FROM change_sets c WHERE c.diagram_id = d.id AND c.state = 'accepted') AS waiting,
                k.state AS confirmation_state, k.recorded_at
         FROM diagrams d
         LEFT JOIN confirmations k ON k.id = (SELECT max(id) FROM confirmations WHERE diagram_id = d.id)
         WHERE d.project_id = ?
         ORDER BY ${DIAGRAM_ORDER}`,
      ),
      // In the order they were written, so that the last row of each stage is its latest pass. A pass written later
      // can carry an earlier passed_at, the date of its last confirmation (passes.js), so passed_at does not order them.
      passes: store.prepare('SELECT stage, passed_at, changed_at FROM stage_passes WHERE project_id = ? ORDER BY id'),
      links: store.prepare(
        `SELECT id, scope, tool, url, status, status_read_at, added_at FROM tool_links
         WHERE project_id = ? AND removed_at IS NULL ORDER BY added_at, id LIMIT ${LISTED_LINKS}`,
      ),
      workshop: store.prepare('SELECT id, state FROM workshops WHERE project_id = ? ORDER BY id DESC LIMIT 1'),
    };
    prepared.set(store, statements);
  }
  return statements;
}

// A text cut to at most length characters (Unicode code points), as JSON Schema's maxLength counts them.
function cut(text, length) {
  if (text.length <= length) return text;
  const points = Array.from(text);
  return points.length <= length ? text : points.slice(0, length).join('');
}

// A project's title (Project.title, and ProjectSummary.title for TASK-439): the title of the project the snapshot
// gives, or the project's name when it gives none, or one that is empty or only white space, so that every reader has
// a title to show. At most 120 characters, as the snapshot's schema allows.
export function projectTitle(name, title) {
  if (typeof title !== 'string' || title.trim() === '') return name;
  return cut(title, TITLE_LENGTH);
}

// The parts the snapshot's project declares, in its order: [] when it declares none. Only parts in the contract's
// form are kept, each once, at most 50, as the intake checked them.
function declaredParts(parts) {
  if (!Array.isArray(parts)) return [];
  const kept = [];
  for (const part of parts) {
    if (typeof part === 'string' && part !== '' && part.length <= PART_LENGTH && PART.test(part) && !kept.includes(part)) kept.push(part);
  }
  return kept.slice(0, PARTS);
}

// The head of a project space, project a row of TBL-147 with its id, name and held_commit: { title, revision, commit,
// pushed_at, parts }, commit being the held commit and the rest from its snapshot, the time that snapshot was received
// being pushed_at. A space holds its snapshot from its first send on; without one the revision and the time are null,
// the title is the name and there are no parts.
export function projectHead(store, project) {
  const held = project.held_commit === null ? undefined : statementsOf(store).held.get(Number(project.id), project.held_commit);
  let rest = null;
  if (held?.rest !== undefined && held.rest !== null) {
    const parsed = JSON.parse(held.rest);
    rest = typeof parsed?.project === 'object' && parsed.project !== null ? parsed.project : null;
  }
  return {
    title: projectTitle(project.name, rest?.title),
    revision: held === undefined ? null : Number(held.revision),
    commit: project.held_commit,
    pushed_at: held === undefined ? null : held.received_at,
    parts: declaredParts(rest?.parts),
  };
}

// A diagram's confirmation, from its latest confirmation (TBL-160): live and not recorded yet, confirmed; live and
// recorded in the stage record, recorded; invalidated by a later drawing (SPEC-033), invalidated; cancelled (SPEC-030)
// or never made, none.
export function confirmationOf(state, recordedAt) {
  if (state === 'confirmed') return recordedAt === null ? 'confirmed' : 'recorded';
  if (state === 'invalidated') return 'invalidated';
  return 'none';
}

// The groups of the stage list (SCR-144: the stages grouped by part, 13 per part), as the parts in their order: the
// project as a whole ('') when the project declares no parts or a listed diagram has none, such as an item table; then
// the parts the project declares, in its order; then any other part a listed diagram still names, such as a removed
// diagram of a part no longer declared, by name. At most 51 groups, so at most 663 rows.
export function stageGroups(declared, diagramParts) {
  const groups = [];
  if (declared.length === 0 || diagramParts.includes('')) groups.push('');
  groups.push(...declared);
  const others = [...new Set(diagramParts)].filter((part) => !groups.includes(part)).sort();
  groups.push(...others);
  return groups.slice(0, GROUPS);
}

// The state of a stage's row (SPEC-035, SPEC-027): a stage pass belongs to the stage, since TBL-161 keeps no part, so
// the stage's latest pass makes every row of the stage passed, or changed_since_pass once a confirmation it rests on
// was invalidated or a diagram appeared after it without one (changed_at, which after-drawing.js sets), with the pass's
// time; the pass stays in the record. Without a
// pass, a row is open while it holds a diagram that is not removed, and not_sent otherwise: a removed diagram is no
// longer one of its stage's diagrams.
export function stageState(pass, live) {
  if (pass !== undefined) return { state: pass.changed_at === null ? 'passed' : 'changed_since_pass', passed_at: pass.passed_at };
  return { state: live ? 'open' : 'not_sent', passed_at: null };
}

// The latest pass of each stage of the project (TBL-161), by stage: the last of its passes written.
export function latestPasses(store, projectId) {
  const passes = new Map();
  for (const pass of statementsOf(store).passes.all(projectId)) passes.set(pass.stage, pass);
  return passes;
}

// How many of the 13 stages are passed (ProjectSummary.stages_passed for TASK-439, SCR-143's "N of 13 stages
// passed"): those whose rows stageState shows passed, so not changed since the pass, and the project list and the
// project read cannot disagree. passes is latestPasses' answer.
export function stagesPassed(passes) {
  return STAGES.filter((stage) => stageState(passes.get(stage), false).state === 'passed').length;
}

const count = (value) => Math.min(Number(value), COUNT);

// The project named name as the contract's Project, or null when no project space has the name.
export function readProject(store, name) {
  const statements = statementsOf(store);
  const project = statements.project.get(name);
  if (project === undefined) return null;
  const projectId = Number(project.id);
  const head = projectHead(store, project);

  // The listed diagrams: every diagram that is not removed, and a removed one only while it has open threads
  // (SPEC-027). Each with its part (see todo.js).
  const parts = new Map();
  const listed = [];
  for (const row of statements.diagrams.all(projectId)) {
    const removed = row.removed_at !== null;
    if (removed && Number(row.open_threads) === 0) continue;
    if (!STAGE_SET.has(row.stage)) continue;
    listed.push({
      stage: row.stage,
      part: diagramPart(store, { id: Number(row.id), stage: row.stage, kind: row.kind, source_key: row.source_key }, parts),
      summary: {
        id: idOf('dg', Number(row.id)),
        kind: row.kind,
        name: row.name,
        removed,
        drawn: Number(row.drawn) === 1,
        confirmation: confirmationOf(row.confirmation_state, row.recorded_at),
        waiting: count(row.waiting),
        open_threads: count(row.open_threads),
      },
    });
  }

  const passes = latestPasses(store, projectId);

  // The listed diagrams of each row, by part and stage, in their order.
  const rows = new Map();
  for (const diagram of listed) {
    const row = `${diagram.part} ${diagram.stage}`;
    if (!rows.has(row)) rows.set(row, []);
    rows.get(row).push(diagram);
  }
  const stages = [];
  for (const part of stageGroups(head.parts, listed.map((diagram) => diagram.part))) {
    for (const stage of STAGES) {
      const here = rows.get(`${part} ${stage}`) ?? [];
      const live = here.some((diagram) => !diagram.summary.removed);
      stages.push({
        stage,
        part,
        ...stageState(passes.get(stage), live),
        diagrams: here.slice(0, LISTED_DIAGRAMS).map((diagram) => diagram.summary),
      });
    }
  }

  const toolLinks = statements.links.all(projectId).map((row) => ({
    id: idOf('tl', Number(row.id)),
    scope: row.scope,
    tool: row.tool,
    url: row.url,
    status: row.status === null ? null : cut(row.status, STATUS_LENGTH),
    status_read_at: row.status_read_at,
    added_at: row.added_at,
  }));
  const workshop = statements.workshop.get(projectId);

  return {
    name: project.name,
    title: head.title,
    repository: project.repository,
    revision: head.revision,
    commit: head.commit,
    pushed_at: head.pushed_at,
    parts: head.parts,
    stages,
    tool_links: toolLinks,
    workshop: workshop === undefined ? null : { id: idOf('ws', Number(workshop.id)), state: workshop.state },
  };
}

// API-264: the project {project}. A name no project space has answers project_not_found.
function getProject({ store, params }) {
  const body = readProject(store, params.project);
  if (body === null) throw new Problem('project_not_found');
  return { body };
}

// The route of API-264 (see router.js), of the owner family.
export const PROJECT_ROUTES = Object.freeze([
  {
    method: 'GET',
    path: '/api/projects/{project}',
    action: 'getProject',
    params: { project: 'project_not_found' },
    handle: getProject,
  },
]);
