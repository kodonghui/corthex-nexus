// Automatically resolve only a decision whose exact text is in a drawn, reported
// merge commit of the same repository. A link or an agent assertion alone is not proof.
import { pullRequestLink, repositoryBase } from './claims.js';
import { threadChanged } from './entries.js';

const normalize = (text) => text.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('und');
const choices = new Set(['추천안', '추천안으로', 'recommended', 'the recommendation']);
function approvedText(entries, owner, last) {
  if (normalize(owner.body) === normalize(last.body)) return true;
  const recommendation = entries.find((entry) => entry.seq === owner.seq - 1);
  return choices.has(normalize(owner.body)) && recommendation?.author === 'agent'
    && JSON.parse(recommendation.detail).asks === 'recommended'
    && normalize(recommendation.body) === normalize(last.body);
}
const cached = new WeakMap();
function queries(store) {
  if (!cached.has(store)) cached.set(store, {
    thread: store.prepare(`SELECT t.state, t.diagram_id, d.source_key, d.kind, p.repository FROM comment_threads t
      JOIN diagrams d ON d.id = t.diagram_id JOIN project_spaces p ON p.id = d.project_id
      WHERE t.id = ? AND p.id = ?`),
    entries: store.prepare('SELECT seq, author, body, detail, created_at FROM comments WHERE thread_id = ? ORDER BY seq DESC LIMIT 200'),
    lastReopen: store.prepare("SELECT max(created_at) AS at FROM thread_resolution_events WHERE thread_id = ? AND event = 'reopened'"),
    pending: store.prepare("SELECT 1 FROM change_sets WHERE thread_id = ? AND state IN ('proposed', 'accepted') LIMIT 1"),
    ownerPending: store.prepare("SELECT 1 FROM change_sets WHERE thread_id = ? AND state = 'proposed' LIMIT 1"),
    pull: store.prepare("SELECT number, merge_commit FROM pull_requests WHERE project_id = ? AND number = ? AND state = 'merged' AND merge_commit IS NOT NULL"),
    current: store.prepare('SELECT id, status, document_version, snapshot_id FROM drawings WHERE diagram_id = ? ORDER BY id DESC LIMIT 1'),
    incomplete: store.prepare("SELECT 1 FROM elements WHERE drawing_id = ? AND status IN ('unreadable', 'missing', 'left_out') LIMIT 1"),
    names: store.prepare("SELECT name FROM elements WHERE drawing_id = ? AND (status IS NULL OR status <> 'removed')"),
    source: store.prepare(`SELECT b.body FROM snapshot_files f JOIN document_blobs b ON b.sha256 = f.blob_sha256
      WHERE f.snapshot_id = ? AND f.path = ?`),
    close: store.prepare("UPDATE comment_threads SET state = 'closed', waits_on = NULL, closed_at = ?, closed_by = 'reflection' WHERE id = ? AND state = 'open'"),
    event: store.prepare("INSERT INTO thread_resolution_events (thread_id, event, detail, created_at) VALUES (?, 'resolved', ?, ?)"),
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
  const owner = entries.findLast((entry) => entry.author === 'owner');
  if (!last || last.author !== 'agent' || !owner || /[?？]/u.test(owner.body)
      || typeof JSON.parse(last.detail).link !== 'string') return false;
  return normalize(last.body) !== '' && approvedText(entries, owner, last)
    && !entries.some((entry) => entry.seq > owner.seq && entry.seq < last.seq && JSON.parse(entry.detail).asks !== undefined);
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
  const owner = entries.findLast((entry) => entry.author === 'owner');
  if (!text || !owner || /[?？]/u.test(owner.body) || !approvedText(entries, owner, last)
      || (reopenedAt != null && owner.created_at <= reopenedAt)
      || entries.some((entry) => entry.seq > owner.seq && entry.seq < last.seq && JSON.parse(entry.detail).asks !== undefined)) return false;
  const drawing = q.current.get(row.diagram_id);
  if (!drawing || drawing.status !== 'drawn' || q.incomplete.get(drawing.id)) return false;
  const base = `${repositoryBase(row.repository)}pull/`;
  const suffix = link.startsWith(base) ? link.slice(base.length) : '';
  if (!/^[1-9][0-9]{0,8}$/.test(suffix)) return false;
  const pull = q.pull.get(project, Number(suffix));
  if (pull && (pull.merge_commit !== drawing.document_version || pullRequestLink(row.repository, pull.number) !== link)) return false;
  if (!pull) return false;
  if (row.kind === 'ddd_board') {
    const source = q.source.get(drawing.snapshot_id, row.source_key);
    if (!source) return false;
    let picture;
    try { picture = JSON.parse(source.body); } catch { return false; }
    if (!Array.isArray(picture.hotspots) || !picture.hotspots.some((item) => typeof item?.answer === 'string' && normalize(item.answer) === text)) return false;
  } else if (!q.names.all(drawing.id).some((element) => normalize(element.name) === text)) return false;
  if (q.close.run(time, thread).changes === 0) return false;
  q.event.run(thread, JSON.stringify({ decision_seq: Number(last.seq), drawing: Number(drawing.id), pull_request: Number(pull.number) }), time);
  threadChanged(store, { project, thread, time });
  return true;
}
