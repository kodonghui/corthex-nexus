// Automatically resolve only a decision whose exact text is in a held snapshot of
// the same repository. A link or an agent assertion alone is not proof.
import { pullRequestLink, repositoryBase } from './claims.js';
import { INCOMPLETE_DRAWING, normalizeDecisionText as normalize, recordResolved, RECOMMENDATION_CHOICES } from './decision-evidence.js';
import { threadChanged } from './entries.js';

function approvedText(entries, owner, last) {
  if (normalize(owner.body) === normalize(last.body)) return true;
  const recommendation = entries.find((entry) => entry.seq === owner.seq - 1);
  return RECOMMENDATION_CHOICES.has(normalize(owner.body)) && recommendation?.author === 'agent'
    && JSON.parse(recommendation.detail).asks === 'recommended'
    && normalize(recommendation.body) === normalize(last.body);
}

function approvalTime(q, thread, row, entries, last, reopenedAt) {
  const owner = entries.findLast((entry) => entry.author === 'owner');
  if (owner && !/[?？]/u.test(owner.body) && approvedText(entries, owner, last)
      && (reopenedAt == null || owner.created_at > reopenedAt)
      && !entries.some((entry) => entry.seq > owner.seq && entry.seq < last.seq && JSON.parse(entry.detail).asks !== undefined)) return owner.created_at;
  const evidence = JSON.parse(last.detail).external_evidence;
  if (!evidence || typeof evidence.at !== 'string' || typeof evidence.text !== 'string' || /[?？]/u.test(evidence.text)
      || evidence.at < row.opened_at || evidence.at > last.created_at
      || (reopenedAt != null && evidence.at <= reopenedAt)) return null;
  if (q.laterQuestion.get(thread, last.seq, evidence.at)) return null;
  return evidence.at;
}
const cached = new WeakMap();
function queries(store) {
  if (!cached.has(store)) cached.set(store, {
    thread: store.prepare(`SELECT t.state, t.opened_at, t.diagram_id, t.element_key, d.source_key, d.kind, p.repository, p.held_commit FROM comment_threads t
      JOIN diagrams d ON d.id = t.diagram_id JOIN project_spaces p ON p.id = d.project_id
      WHERE t.id = ? AND p.id = ?`),
    entries: store.prepare('SELECT seq, author, body, detail, created_at FROM comments WHERE thread_id = ? ORDER BY seq DESC LIMIT 200'),
    laterQuestion: store.prepare("SELECT 1 FROM comments WHERE thread_id = ? AND seq < ? AND created_at >= ? AND (author = 'owner' OR json_type(detail, '$.asks') IS NOT NULL) LIMIT 1"),
    lastReopen: store.prepare("SELECT max(created_at) AS at FROM thread_resolution_events WHERE thread_id = ? AND event = 'reopened'"),
    pending: store.prepare("SELECT 1 FROM change_sets WHERE thread_id = ? AND state IN ('proposed', 'accepted') LIMIT 1"),
    ownerPending: store.prepare("SELECT 1 FROM change_sets WHERE thread_id = ? AND state = 'proposed' LIMIT 1"),
    pull: store.prepare("SELECT number, merge_commit FROM pull_requests WHERE project_id = ? AND number = ? AND state = 'merged' AND merge_commit IS NOT NULL"),
    snapshot: store.prepare('SELECT id, revision, received_at FROM snapshots WHERE project_id = ? AND commit_sha = ?'),
    priorSnapshot: store.prepare('SELECT id, revision FROM snapshots WHERE project_id = ? AND revision < ? ORDER BY revision DESC LIMIT 1'),
    current: store.prepare('SELECT id, status, document_version, snapshot_id FROM drawings WHERE diagram_id = ? ORDER BY id DESC LIMIT 1'),
    historical: store.prepare(`SELECT w.id, w.status FROM drawings w JOIN snapshots s ON s.id = w.snapshot_id
      WHERE w.diagram_id = ? AND s.revision <= ? ORDER BY s.revision DESC, w.id DESC LIMIT 1`),
    incomplete: store.prepare(INCOMPLETE_DRAWING),
    names: store.prepare("SELECT element_key, name FROM elements WHERE drawing_id = ? AND (status IS NULL OR status <> 'removed')"),
    hotspot: store.prepare("SELECT json_extract(detail, '$.number') AS number FROM elements WHERE drawing_id = ? AND element_key = ? AND kind = 'hotspot'"),
    source: store.prepare(`SELECT b.body FROM snapshot_files f JOIN document_blobs b ON b.sha256 = f.blob_sha256
      WHERE f.snapshot_id = ? AND f.path = ?`),
    close: store.prepare("UPDATE comment_threads SET state = 'closed', waits_on = NULL, closed_at = ?, closed_by = 'reflection' WHERE id = ? AND state = 'open'"),
  });
  return cached.get(store);
}

// A matching owner answer makes the missing record the agent's work. A different
// or later question, or an outstanding proposal, cannot be treated as approval.
export function decisionWaitingForRecord(store, { project, thread }) {
  const q = queries(store);
  const row = q.thread.get(thread, project);
  if (!row || row.state !== 'open' || q.ownerPending.get(thread)) return false;
  const entries = q.entries.all(thread).reverse();
  const last = entries.at(-1);
  const reopenedAt = q.lastReopen.get(thread)?.at;
  if (!last || last.author !== 'agent' || !approvalTime(q, thread, row, entries, last, reopenedAt)
      || typeof JSON.parse(last.detail).link !== 'string') return false;
  return normalize(last.body) !== '';
}

export function resolveDecision(store, { project, thread, time }) {
  const q = queries(store);
  const row = q.thread.get(thread, project);
  if (!row || row.state !== 'open' || row.repository === null || q.pending.get(thread)) return false;
  const entries = q.entries.all(thread).reverse();
  const last = entries.at(-1);
  if (!last || last.author !== 'agent') return false;
  const reopenedAt = q.lastReopen.get(thread)?.at;
  if (reopenedAt !== null && reopenedAt !== undefined && reopenedAt >= last.created_at) return false;
  const { link } = JSON.parse(last.detail);
  if (typeof link !== 'string') return false;
  const text = normalize(last.body);
  const approvedAt = approvalTime(q, thread, row, entries, last, reopenedAt);
  if (!text || !approvedAt) return false;
  const drawing = q.current.get(row.diagram_id);
  if (!drawing || drawing.status !== 'drawn' || q.incomplete.get(drawing.id)) return false;
  const base = repositoryBase(row.repository);
  const pullSuffix = link.startsWith(`${base}pull/`) ? link.slice(`${base}pull/`.length) : '';
  const commitSuffix = link.startsWith(`${base}commit/`) ? link.slice(`${base}commit/`.length) : '';
  let commit, pull;
  if (/^[1-9][0-9]{0,8}$/.test(pullSuffix)) {
    pull = q.pull.get(project, Number(pullSuffix));
    if (!pull || pullRequestLink(row.repository, pull.number) !== link) return false;
    commit = pull.merge_commit;
  } else if (/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(commitSuffix)) {
    commit = commitSuffix;
  } else return false;
  const recorded = q.snapshot.get(project, commit);
  const held = q.snapshot.get(project, row.held_commit);
  if (!recorded || !held || Number(recorded.revision) > Number(held.revision) || recorded.received_at <= approvedAt) return false;
  const prior = q.priorSnapshot.get(project, recorded.revision);
  if (!prior) return false;
  if (row.kind === 'ddd_board') {
    const previous = q.historical.get(row.diagram_id, prior.revision);
    if (!previous || previous.status !== 'drawn' || q.incomplete.get(previous.id)) return false;
    const target = row.element_key === null ? null : q.hotspot.get(drawing.id, row.element_key);
    if (row.element_key !== null && !target) return false;
    const holdsAnswer = (snapshot, previous = false) => {
      const source = q.source.get(snapshot, row.source_key);
      if (!source) return null;
      let picture;
      try { picture = JSON.parse(source.body); } catch { return null; }
      if (!Array.isArray(picture.hotspots) || picture.hotspots.some((item) => !item || typeof item.answer !== 'string')) return null;
      if (target !== null && picture.hotspots.filter((item) => item?.number === target.number && typeof item.answer === 'string').length !== 1) return null;
      const matches = picture.hotspots.filter((item) => typeof item?.answer === 'string' && normalize(item.answer) === text);
      return row.element_key === null ? (previous ? matches.length > 0 : matches.length === 1) : matches.some((item) => item.number === target.number);
    };
    if (holdsAnswer(prior.id, true) !== false || holdsAnswer(recorded.id) !== true || holdsAnswer(drawing.snapshot_id) !== true) return false;
  } else {
    const historical = q.historical.get(row.diagram_id, recorded.revision);
    const previous = q.historical.get(row.diagram_id, prior.revision);
    if (!historical || historical.status !== 'drawn' || q.incomplete.get(historical.id)
        || !previous || previous.status !== 'drawn' || q.incomplete.get(previous.id)
        || !q.source.get(recorded.id, row.source_key) || !q.source.get(prior.id, row.source_key)) return false;
    const holdsAnswer = (drawingId, previous = false) => {
      const matches = q.names.all(drawingId).filter((element) => normalize(element.name) === text);
      return row.element_key === null ? (previous ? matches.length > 0 : matches.length === 1) : matches.some((element) => element.element_key === row.element_key);
    };
    if (holdsAnswer(previous.id, true) || !holdsAnswer(historical.id) || !holdsAnswer(drawing.id)) return false;
  }
  if (q.close.run(time, thread).changes === 0) return false;
  recordResolved(store, { thread, detail: { decision_seq: Number(last.seq), drawing: Number(drawing.id), ...(pull ? { pull_request: Number(pull.number) } : { commit }) }, time });
  threadChanged(store, { project, thread, time });
  return true;
}
