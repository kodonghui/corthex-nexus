// The mockup page (TASK-427; API-293, SPEC-009): the HTML of a stage-09 mockup as the hub sent it, served in a
// sandbox. A read writes nothing and logs nothing; the page's text is in the answer only (rule 5).
//
// The page is the document of the diagram's last drawing that drew: its current drawing, or when that failed, its last
// good one, read from that drawing's snapshot by the diagram's source_key (TBL-152, TBL-150, TBL-149). A removed
// mockup still serves it, since its threads, which SPEC-027 still opens, are about that page. So it reads the project
// space by its name (TBL-147), the diagram (TBL-151), the drawing, and its document.
//
// Every answer of the operation, its refusals and faults included, carries the contract's Content-Security-Policy, as
// its route's headers (see router.js), and nosniff, which every answer of the server carries (see app.js). The policy
// makes the page a sandbox in which its scripts run but which has no NEXUS origin, so they reach neither NEXUS's
// cookies nor its API; the page loads nothing from the network, and only a NEXUS page may frame it. The success adds
// the contract's Cache-Control. The frame, its bar and what happens when the page opens another page are TASK-458's.

import { keyOf } from './ids.js';
import { Problem } from './problem.js';

// The contract's headers of API-293 (api/openapi.yaml), sent exactly.
export const SANDBOX = "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";
const CACHE = 'private, no-store';
const KIND = 'mockup';

// The statements of each store, prepared on first use (see credentials.js).
const prepared = new WeakMap();

function statementsOf(store) {
  let statements = prepared.get(store);
  if (statements === undefined) {
    statements = {
      project: store.prepare('SELECT id FROM project_spaces WHERE name = ?'),
      // The diagram, its last drawing that drew, and that drawing's document.
      page: store.prepare(
        `SELECT d.kind, w.id AS drawing, b.body
         FROM diagrams d
         LEFT JOIN drawings w ON w.id = (SELECT max(id) FROM drawings WHERE diagram_id = d.id AND status = 'drawn')
         LEFT JOIN snapshot_files f ON f.snapshot_id = w.snapshot_id AND f.path = d.source_key
         LEFT JOIN document_blobs b ON b.sha256 = f.blob_sha256
         WHERE d.id = ? AND d.project_id = ?`,
      ),
    };
    prepared.set(store, statements);
  }
  return statements;
}

// API-293: the page of the mockup {diagram} of the project {project}. A name no project space has answers
// project_not_found; an ID that names no diagram of the project, or one of another kind, diagram_not_found; a mockup
// that has never drawn, not_drawn.
function getMockupPage({ store, params }) {
  const statements = statementsOf(store);
  const project = statements.project.get(params.project);
  if (project === undefined) throw new Problem('project_not_found');
  const diagram = keyOf('dg', params.diagram);
  const row = diagram === null ? undefined : statements.page.get(diagram, Number(project.id));
  if (row === undefined || row.kind !== KIND) throw new Problem('diagram_not_found', 'no mockup has this ID in the project');
  if (row.drawing === null) throw new Problem('not_drawn', 'the mockup\'s document has never drawn; fix it and push again');
  // A drawing that drew read its document from its own snapshot, which keeps it.
  if (typeof row.body !== 'string') throw new Error('a drawn mockup\'s document is in its snapshot');
  return { text: row.body, headers: { 'Cache-Control': CACHE } };
}

// The route of API-293 (see router.js), of the owner family.
export const MOCKUP_PAGE_ROUTES = Object.freeze([
  {
    method: 'GET',
    path: '/api/projects/{project}/diagrams/{diagram}/page',
    action: 'getMockupPage',
    params: { project: 'project_not_found', diagram: 'diagram_not_found' },
    media: 'text/html',
    headers: { 'Content-Security-Policy': SANDBOX },
    handle: getMockupPage,
  },
]);
