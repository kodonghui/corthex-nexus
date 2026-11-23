// Answering an AI proposal (TASK-444; API-270, API-271, SPEC-019, SPEC-020, SPEC-027, note 7 of the WBS): the owner
// accepts a proposal, which then waits for reflection, or rejects it, which takes its overlay off. Both are owner
// operations with the empty body {} and a request key (rule 3), each one write (writes.js); an agent's credential gets
// owner_only from admission (REQ-025), and a phone does not offer them, which is the page's (REQ-068). Nothing here
// logs: a proposal's text is in the store and the answer only (rule 5).
//
// - The change set. The ID names a change set of the project (otherwise change_set_not_found). A direct edit is
//   accepted when it is made and cancelled, not answered (API-273): change_set_state with its state, as a proposal sent
//   to API-273 is refused.
// - Accepting (API-270, SPEC-019) marks a proposed proposal accepted at the time of the answer, decided_at, the time
//   readers order accepted change sets by since TASK-445: the later accepted wins in the reflection and is on top in
//   the diagram read. Then entries.js's changeSetsChanged closes the owner's proposal entry as done and puts the
//   proposal in its diagram's reflection entry on the agent to-do (SPEC-026), so API-245, API-247's reflection and
//   heldChangeSets read it as any accepted change set.
//   - Accepted again, or reflected since, it answers the change set with changed false ("accepted again → the same
//     result"). Rejected, or withdrawn by its agent (cancelled), it gets change_set_state with its state.
//   - The document changed since the proposal: the diagram's shown drawing, its latest that drew (SPEC-001), is not the
//     proposal's drawing. That is API-256's test of a proposal's commit, exception included: a push that left the
//     diagram unchanged, a failed drawing and a source the snapshot left out keep the drawing the diagram shows, so
//     they change nothing. It gets document_changed naming the shown drawing and its version, so the owner asks for a
//     new proposal.
//   - A removed diagram takes no accepted proposal (SPEC-027). It gets document_changed too, as the contract's text
//     says, naming the drawing the removed diagram still shows, its latest that drew, which the diagram read opens it
//     at for its threads (note 7).
// - Rejecting (API-271, SPEC-020) marks a proposed proposal rejected at decided_at; changeSetsChanged closes the
//   owner's proposal entry as done, and the diagram read no longer lays it over the diagram. Rejected again, it answers
//   changed false; accepted, reflected or cancelled, it gets change_set_state with its state. A removed diagram's
//   proposal is rejected like any other (note 7): SPEC-027 refuses accepting one, and rejecting only takes a change
//   off, as withdrawing it does (API-257), so the owner can clear it from the to-do.
// - The thread. Neither answer writes on the proposal's thread. An open thread waits on the side that did not write
//   last (SPEC-017), so it stays open and waits where it did (SPEC-020); a closed thread stays closed (TASK-443). The
//   agent reads the answer as the change set's state, by API-246 and API-247; its to-do gains only the reflection of an
//   accepted proposal (SPEC-043). Claims are the agent sessions' (SPEC-044): an answer keeps none and ends none.
// - The answer is the contract's ChangeSetAnswer: the change set as reads.js's changeSetOf makes it, changed, and
//   pull_request null, which only a direct edit's cancel names.

import { emptyOf } from './comments.js';
import { changeSetsChanged } from './entries.js';
import { idOf, keyOf } from './ids.js';
import { Problem } from './problem.js';
import { changeSetOf } from './reads.js';

// The statements of each store, prepared on first use (see credentials.js).
const prepared = new WeakMap();

function statementsOf(store) {
  let statements = prepared.get(store);
  if (statements === undefined) {
    statements = {
      project: store.prepare('SELECT id, repository FROM project_spaces WHERE name = ?'),
      changeSet: store.prepare(
        `SELECT c.diagram_id, c.drawing_id, c.origin, c.state, d.removed_at FROM change_sets c JOIN diagrams d ON d.id = c.diagram_id
         WHERE c.id = ? AND c.project_id = ?`,
      ),
      // The drawing a diagram shows: its latest that drew (SPEC-001).
      shown: store.prepare("SELECT id, document_version FROM drawings WHERE diagram_id = ? AND status = 'drawn' ORDER BY id DESC LIMIT 1"),
      answer: store.prepare("UPDATE change_sets SET state = ?, decided_at = ? WHERE id = ? AND state = 'proposed'"),
    };
    prepared.set(store, statements);
  }
  return statements;
}

const timeNow = (now) => new Date(now()).toISOString();

const stateProblem = (state, detail = `the change set is ${state}`) => new Problem('change_set_state', detail, {}, { state });

// The project, its proposal and the key of the proposal: { project, key, row }.
function proposalOf(statements, params) {
  const found = statements.project.get(params.project);
  if (found === undefined) throw new Problem('project_not_found');
  const project = { id: Number(found.id), repository: found.repository };
  const key = keyOf('np', params.change_set);
  const row = key === null ? undefined : statements.changeSet.get(key, project.id);
  if (row === undefined) throw new Problem('change_set_not_found');
  if (row.origin !== 'proposal') throw stateProblem(row.state, 'a direct edit is cancelled, not answered');
  return { project, key, row };
}

const answerOf = (store, project, key, changed) => ({ body: { change_set: changeSetOf(store, project, key), changed, pull_request: null } });

// Marks the proposed proposal state at the time of the answer and lets the to-do follow (see the top of this file).
function decide(store, statements, { project, key, row }, state, now) {
  const time = timeNow(now);
  statements.answer.run(state, time, key);
  changeSetsChanged(store, { project: project.id, diagram: Number(row.diagram_id), time });
  return answerOf(store, project, key, true);
}

// API-270: the owner accepts an AI proposal, which then waits for reflection (SPEC-019, SPEC-027).
function acceptProposal({ store, params, body, now }) {
  emptyOf(body);
  const statements = statementsOf(store);
  const found = proposalOf(statements, params);
  const { project, key, row } = found;
  if (row.state === 'accepted' || row.state === 'reflected') return answerOf(store, project, key, false);
  if (row.state !== 'proposed') throw stateProblem(row.state);
  const shown = statements.shown.get(Number(row.diagram_id));
  const changed = (detail) => new Problem('document_changed', detail, {}, {
    drawing: idOf('dw', Number(shown.id)), version: shown.document_version,
  });
  if (row.removed_at !== null) throw changed('the diagram is no longer in its stage document; ask for a new proposal');
  if (Number(shown.id) !== Number(row.drawing_id)) throw changed('the document changed since the proposal; ask for a new proposal');
  return decide(store, statements, found, 'accepted', now);
}

// API-271: the owner rejects an AI proposal, whose overlay is then gone while its thread stays as it is (SPEC-020).
function rejectProposal({ store, params, body, now }) {
  emptyOf(body);
  const statements = statementsOf(store);
  const found = proposalOf(statements, params);
  const { project, key, row } = found;
  if (row.state === 'rejected') return answerOf(store, project, key, false);
  if (row.state !== 'proposed') throw stateProblem(row.state);
  return decide(store, statements, found, 'rejected', now);
}

// The routes of API-270 and API-271 (see router.js), of the owner family.
export const PROPOSAL_ANSWER_ROUTES = Object.freeze([
  {
    method: 'POST',
    path: '/api/projects/{project}/change-sets/{change_set}/accept',
    action: 'acceptProposal',
    params: { project: 'project_not_found', change_set: 'change_set_not_found' },
    body: 'json',
    requestKey: true,
    handle: acceptProposal,
  },
  {
    method: 'POST',
    path: '/api/projects/{project}/change-sets/{change_set}/reject',
    action: 'rejectProposal',
    params: { project: 'project_not_found', change_set: 'change_set_not_found' },
    body: 'json',
    requestKey: true,
    handle: rejectProposal,
  },
]);
