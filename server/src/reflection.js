// Reflections (TASK-435, TASK-447; SPEC-025, REQ-030, REQ-031, note 26 of the WBS): marking the change sets of a merged
// reflection pull request reflected, and saying what the merged document lacks. The push calls it once it has drawn a
// snapshot (after-drawing.js), and API-258 calls it when the agent reports a merge commit NEXUS already holds
// (reports.js), so both run the same rule.
//
// - Which. The accepted change sets in a pull request of the project whose reported merge commit is commit, whatever
//   purpose its first report gave it, since a reflection and a record may share one (TBL-157). Only that exact commit
//   marks them (API-258).
// - Where. Each is reflected at the drawing its diagram shows: its latest that drew, since a failed drawing shows the
//   last good one (SPEC-001). It is reflected even when that drawing lacks the change (SPEC-025).
// - Threads (REQ-031). A proposal thread resolves after all proposals are handled only when the reflected changes
//   are verified and no later conversation entry leaves an unresolved question.
// - What is missing (note 26). For each diagram and pull request, every step of the reflected change sets that the
//   drawing does not show is listed in one comment, on a new thread on the diagram as a whole at that drawing, which
//   waits on the owner and so is a question of the owner's to-do. The comment is the agent's that reported the pull
//   request (TBL-157's credential), since the reflection is its work, and it is written in Korean, as the owner's
//   screen is, naming each change by its kind and element, never by an ID of NEXUS (SPEC-010). A step shows when:
//   - rename: the element is in the drawing, readable, with that name;
//   - connect: a line of the drawing runs from the element to the target, or on an item table the element's row
//     lists the target among its links (as direct-edits.js finds a connection), with the step's label when it has one;
//   - add: the element is in the drawing, readable, with the step's name when it has one;
//   - remove: the element is not in the drawing, or is drawn as removed.
// - The later accepted wins (TASK-445). A step that a later step of its own change set, or a change set of the diagram
//   accepted later (decided_at), replaces is not missing: a later rename, add or remove of the same element replaces
//   a rename or an add; a later rename or add replaces a remove; a later remove of either end replaces a connect. When
//   the replacing step is reflected in the same reflection, the step is left unsaid; when its change set was reflected
//   before, as when pull requests merge out of the order their change sets were accepted in, or still waits, the
//   comment names the change the reflection left.
//
// It returns how many change sets it reflected. Nothing here logs: names are in the store and the comment only
// (rule 5).

import { addAgentEntry, openOwnThread } from './comments.js';
import { INCOMPLETE_DRAWING, recordResolved } from './decision-evidence.js';
import { TRACE_ID } from './drawer.js';
import { changeSetsChanged, threadChanged } from './entries.js';
import { LIMITS } from './limits.js';

// Elements a change cannot be read in: the drawer could not read the entry, the schema names a table it does not
// define, or the drawer does not draw it (see the README's Direct edits).
const UNREAD = new Set(['unreadable', 'missing', 'left_out']);
// What each kind of change set and step is called on the owner's screen (SCR-145, SCR-146).
const KINDS = Object.freeze({ proposal: 'AI 제안', direct_edit: '직접 편집' });
const STEPS = Object.freeze({ rename: '이름 바꾸기', connect: '잇기', add: '추가', remove: '지우기' });

// The statements of each store, prepared on first use (see credentials.js).
const prepared = new WeakMap();

function statementsOf(store) {
  let statements = prepared.get(store);
  if (statements === undefined) {
    statements = {
      reflecting: store.prepare(
        `SELECT c.id, c.diagram_id, c.thread_id, p.id AS pull_request, p.number, p.credential_id FROM change_sets c
         JOIN pull_requests p ON p.id = c.pull_request_id AND p.project_id = c.project_id
         WHERE c.project_id = ? AND c.state = 'accepted' AND p.merge_commit = ?
         ORDER BY c.id`,
      ),
      currentDrawn: store.prepare("SELECT id FROM drawings WHERE diagram_id = ? AND status = 'drawn' ORDER BY id DESC LIMIT 1"),
      latestDrawing: store.prepare('SELECT max(id) AS id FROM drawings WHERE diagram_id = ?'),
      latestStatus: store.prepare('SELECT status FROM drawings WHERE diagram_id = ? ORDER BY id DESC LIMIT 1'),
      incomplete: store.prepare(INCOMPLETE_DRAWING),
      reflect: store.prepare("UPDATE change_sets SET state = 'reflected', reflected_drawing_id = ? WHERE id = ? AND state = 'accepted'"),
      asking: store.prepare("SELECT 1 AS asking FROM change_sets WHERE thread_id = ? AND state IN ('proposed', 'accepted') LIMIT 1"),
      threadEntries: store.prepare('SELECT seq, author, body, created_at FROM comments WHERE thread_id = ? ORDER BY seq'),
      threadSets: store.prepare("SELECT id, diagram_id, state, detail, created_at, decided_at FROM change_sets WHERE thread_id = ? AND origin = 'proposal' AND state IN ('reflected', 'rejected', 'cancelled')"),
      lastReopen: store.prepare("SELECT max(created_at) AS at FROM thread_resolution_events WHERE thread_id = ? AND event = 'reopened'"),
      reflectedThreads: store.prepare(`SELECT DISTINCT c.thread_id FROM change_sets c JOIN comment_threads t ON t.id = c.thread_id
        WHERE c.project_id = ? AND c.diagram_id = ? AND c.origin = 'proposal' AND c.state = 'reflected' AND t.state = 'open'`),
      closeThread: store.prepare(
        "UPDATE comment_threads SET state = 'closed', waits_on = NULL, closed_at = ?, closed_by = 'reflection' WHERE id = ? AND state = 'open'",
      ),
      // The change sets of a diagram that are accepted or reflected, in the order they were accepted (TASK-445).
      decided: store.prepare(
        `SELECT id, origin, state, drawing_id FROM change_sets WHERE diagram_id = ? AND state IN ('accepted', 'reflected')
         ORDER BY coalesce(decided_at, created_at), id`,
      ),
      steps: store.prepare('SELECT op, element_key, new_name, target_key FROM changes WHERE change_set_id = ? ORDER BY seq'),
      elements: store.prepare('SELECT element_key, trace_id, kind, name, status, detail FROM elements WHERE drawing_id = ?'),
      diagramKind: store.prepare('SELECT kind FROM diagrams WHERE id = ?'),
    };
    prepared.set(store, statements);
  }
  return statements;
}

// The elements of a drawing by key, each with its detail read.
function elementsOf(statements, drawing, cache) {
  if (!cache.has(drawing)) {
    const byKey = new Map();
    for (const row of statements.elements.all(drawing)) byKey.set(row.element_key, { ...row, detail: JSON.parse(row.detail) });
    cache.set(drawing, byKey);
  }
  return cache.get(drawing);
}

const readable = (element) => element !== undefined && !UNREAD.has(element.status);

// Whether the drawing shows the step (see the top of this file). elements are the drawing's, by key.
function shows(step, elements, itemTable) {
  const element = elements.get(step.element_key);
  if (step.op === 'rename') return readable(element) && element.name === step.new_name;
  if (step.op === 'add') return readable(element) && (step.new_name === null || element.name === step.new_name);
  if (step.op === 'remove') return element === undefined || element.status === 'removed';
  if (itemTable) {
    const links = element?.detail?.links;
    return readable(element) && Array.isArray(links) && links.includes(step.target_key);
  }
  for (const line of elements.values()) {
    if (line.detail?.from === step.element_key && line.detail?.to === step.target_key
      && (step.new_name === null || line.name === step.new_name)) return true;
  }
  return false;
}

// Whether a later step replaces the step (see the top of this file).
function replaces(later, step) {
  if (step.op === 'connect') return later.op === 'remove' && [step.element_key, step.target_key].includes(later.element_key);
  if (later.element_key !== step.element_key) return false;
  if (step.op === 'remove') return later.op === 'rename' || later.op === 'add';
  return later.op === 'rename' || later.op === 'add' || later.op === 'remove';
}

// An element as the owner's screen names it: its trace ID apart, then its name, from the drawing the change was made
// against, else from the drawing shown, else its key (SPEC-010).
function elementLabel(key, ...drawings) {
  const element = drawings.map((elements) => elements.get(key)).find((found) => found !== undefined);
  const name = element === undefined || element.name === '' ? null : element.name;
  const trace = element?.trace_id ?? (TRACE_ID.test(key) ? key : null);
  if (trace !== null && name !== null && name !== trace) return `${trace} ${name}`;
  return trace ?? name ?? key;
}

// One change as a line of the comment: its kind, its step and its element, such as
// "AI 제안, 이름 바꾸기: TBL-146 agents → agent_keys".
function changeLine(set, step, made, shown) {
  const label = (key) => elementLabel(key, made, shown);
  let what;
  if (step.op === 'rename') what = `${label(step.element_key)} → ${step.new_name}`;
  else if (step.op === 'connect') what = `${label(step.element_key)} → ${label(step.target_key)}${step.new_name === null ? '' : ` (${step.new_name})`}`;
  else if (step.op === 'add') what = TRACE_ID.test(step.element_key) && step.new_name !== null ? `${step.element_key} ${step.new_name}` : (step.new_name ?? step.element_key);
  else what = label(step.element_key);
  return `${KINDS[set.origin]}, ${STEPS[step.op]}: ${what}`;
}

// The comment's text within the contract's 4,000 characters: its lines while they fit, then how many more there are.
function commentText(number, lines) {
  const head = `병합한 PR #${number}의 문서에 이 변경이 없어요. 변경은 반영됨으로 표시했어요. 다시 필요하면 이 스레드에 답하거나 새 제안을 부탁하세요.`;
  const limit = LIMITS.textCharacters;
  const length = (text) => [...text].length;
  let text = head;
  for (let index = 0; index < lines.length; index += 1) {
    const next = `${text}\n- ${lines[index]}`;
    const rest = lines.length - index - 1;
    const tail = rest === 0 ? '' : `\n- 그 밖의 변경 ${rest}개`;
    if (length(next) + length(tail) > limit) return `${text}\n- 그 밖의 변경 ${lines.length - index}개`;
    text = next;
  }
  return text;
}

// The change sets of a diagram that are accepted or reflected, in the order they were accepted, from the first of
// those reflected now, since only a later one replaces a step. Each reads its steps once, when they are first needed.
function decidedFrom(statements, diagram, now) {
  const rows = statements.decided.all(diagram);
  return rows.slice(rows.findIndex((row) => now.has(Number(row.id)))).map((row) => {
    let steps = null;
    return {
      id: Number(row.id),
      origin: row.origin,
      drawing: Number(row.drawing_id),
      get steps() {
        steps ??= statements.steps.all(Number(row.id)).map((step) => ({ ...step }));
        return steps;
      },
    };
  });
}

// The lines that say what the drawing lacks of mine, the change sets of one pull request reflected now on one diagram;
// decided is decidedFrom's answer for the diagram, and now holds every change set reflected now (see the top of this
// file).
function lacking(statements, { shown, itemTable, decided, mine, now }, cache) {
  const shownElements = elementsOf(statements, shown, cache);
  const lines = [];
  decided.forEach((set, index) => {
    if (!mine.has(set.id)) return;
    const made = elementsOf(statements, set.drawing, cache);
    set.steps.forEach((step, at) => {
      if (shows(step, shownElements, itemTable)) return;
      // A later step of the same change set, reflected with it, replaces it: nothing is missing.
      if (set.steps.slice(at + 1).some((each) => replaces(each, step))) return;
      const later = decided.slice(index + 1).filter((other) => other.steps.some((each) => replaces(each, step))).at(-1);
      if (later !== undefined && now.has(later.id)) return;
      if (later !== undefined) {
        const left = later.steps.filter((each) => replaces(each, step)).at(-1);
        const kept = changeLine(later, left, elementsOf(statements, later.drawing, cache), shownElements);
        lines.push(`${changeLine(set, step, made, shownElements)} — 나중에 수락한 변경을 남겼어요: ${kept}`);
      } else {
        lines.push(changeLine(set, step, made, shownElements));
      }
    });
  });
  return lines;
}

// See the top of this file. project is the project's key, commit the merge commit, time the time of the write.
export function reflectMerged(store, { project, commit, time }) {
  const statements = statementsOf(store);
  const sets = statements.reflecting.all(project, commit);
  if (sets.length === 0) return 0;
  const now = new Set(sets.map((set) => Number(set.id)));
  // By diagram, then by pull request: { shown, pulls: Map(pull request → { number, credential }) }.
  const diagrams = new Map();
  const asked = new Set();
  for (const set of sets) {
    const diagram = Number(set.diagram_id);
    if (!diagrams.has(diagram)) {
      // A change set is made against a drawing that drew, so the diagram has one; its latest drawing is only a guard.
      const shown = statements.currentDrawn.get(diagram) ?? statements.latestDrawing.get(diagram);
      diagrams.set(diagram, { shown: Number(shown.id), pulls: new Map() });
    }
    const where = diagrams.get(diagram);
    statements.reflect.run(where.shown, Number(set.id));
    const pull = Number(set.pull_request);
    if (!where.pulls.has(pull)) where.pulls.set(pull, { number: Number(set.number), credential: Number(set.credential_id), sets: new Set() });
    where.pulls.get(pull).sets.add(Number(set.id));
    if (set.thread_id !== null) asked.add(Number(set.thread_id));
  }

  const cache = new Map();
  for (const [diagram, { shown, pulls }] of diagrams) {
    const itemTable = statements.diagramKind.get(diagram)?.kind === 'item_table';
    const decided = decidedFrom(statements, diagram, now);
    for (const pull of pulls.values()) {
      const lines = lacking(statements, { shown, itemTable, decided, mine: pull.sets, now }, cache);
      if (lines.length === 0) continue;
      const thread = openOwnThread(store, { diagram, drawing: shown, time });
      addAgentEntry(store, { thread, credential: pull.credential, text: commentText(pull.number, lines), detail: {}, time });
      threadChanged(store, { project, thread, time });
    }
    changeSetsChanged(store, { project, diagram, time });
  }
  resolveReflected(store, { project, threads: asked, time });
  return sets.length;
}

// A reflected proposal that could not be proved on its merge can become provable
// after a later, complete drawing. Recheck it without reflecting its set twice.
export function recheckReflected(store, { project, diagram, time }) {
  const statements = statementsOf(store);
  const threads = statements.reflectedThreads.all(project, diagram).map((row) => Number(row.thread_id));
  resolveReflected(store, { project, threads, time });
}

function resolveReflected(store, { project, threads, time }) {
  const statements = statementsOf(store);
  const cache = new Map();
  for (const thread of threads) {
    if (statements.asking.get(thread) !== undefined) continue;
    const proposals = statements.threadSets.all(thread);
    if (proposals.length === 0) continue;
    const entries = statements.threadEntries.all(thread);
    const proposalSequences = new Set();
    for (const set of proposals) {
      const matches = entries.filter((entry) => entry.author === 'agent' && entry.created_at === set.created_at
        && entry.body === JSON.parse(set.detail).change);
      // Without an unambiguous proposal entry, the order of the conversation
      // cannot be proved. Sequence, not timestamp, also handles simultaneous writes.
      if (matches.length !== 1) break;
      proposalSequences.add(Number(matches[0].seq));
    }
    if (proposalSequences.size !== proposals.length) continue;
    const earliestProposal = Math.min(...proposalSequences);
    const extra = entries.some((entry) => Number(entry.seq) > earliestProposal && !proposalSequences.has(Number(entry.seq)));
    if (extra) continue;
    const reflected = proposals.filter((set) => set.state === 'reflected');
    const reopenedAt = statements.lastReopen.get(thread)?.at;
    if (reopenedAt != null && !reflected.some((set) => set.decided_at != null && set.decided_at > reopenedAt)) continue;
    const verified = reflected.length > 0 && reflected.every((set) => {
      const steps = statements.steps.all(set.id);
      const shown = statements.currentDrawn.get(Number(set.diagram_id))?.id;
      if (shown === undefined) return false;
      const itemTable = statements.diagramKind.get(Number(set.diagram_id))?.kind === 'item_table';
      const elements = elementsOf(statements, shown, cache);
      const decided = statements.decided.all(set.diagram_id);
      const index = decided.findIndex((row) => Number(row.id) === Number(set.id));
      const shownOrReplaced = (step, position) => {
        if (shows(step, elements, itemTable)) return true;
        const later = [
          ...steps.slice(position + 1).map((replacement) => ({ state: 'reflected', replacement })),
          ...decided.slice(index + 1).flatMap((other) => statements.steps.all(other.id).map((replacement) => ({ state: other.state, replacement }))),
        ].filter(({ replacement }) => replaces(replacement, step)).at(-1);
        return later !== undefined && later.state === 'reflected' && shows(later.replacement, elements, itemTable);
      };
      return statements.latestStatus.get(set.diagram_id)?.status === 'drawn' && !statements.incomplete.get(shown)
        && index >= 0 && steps.length > 0 && steps.every(shownOrReplaced);
    });
    if (!verified) continue;
    if (statements.closeThread.run(time, thread).changes > 0) {
      recordResolved(store, { thread, detail: { change_sets: reflected.map((set) => Number(set.id)) }, time });
      threadChanged(store, { project, thread, time });
    }
  }
}
