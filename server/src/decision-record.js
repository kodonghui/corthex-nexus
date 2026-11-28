// Verify a narrow, fail-closed case of a decision recorded on a DDD board.
// The confirmed and new pictures, their source paths and complete drawings must agree
// everywhere except an open hotspot's answer and its transition to answered.
import { INCOMPLETE_DRAWING, normalizeDecisionText as normalize, RECOMMENDATION_CHOICES } from './decision-evidence.js';
import { exactExternalAnswer } from '../web/decision-match.js';
const statements = new WeakMap();

function queries(store) {
  if (!statements.has(store)) statements.set(store, {
    source: store.prepare(`SELECT b.body FROM drawings w JOIN diagrams d ON d.id = w.diagram_id
      JOIN snapshot_files f ON f.snapshot_id = w.snapshot_id AND f.path = d.source_key
      JOIN document_blobs b ON b.sha256 = f.blob_sha256
      WHERE w.id = ? AND w.status = 'drawn' AND d.kind = 'ddd_board'`),
    incomplete: store.prepare(INCOMPLETE_DRAWING),
    failed: store.prepare("SELECT 1 FROM drawings WHERE diagram_id = ? AND id > ? AND id <= ? AND status = 'failed' LIMIT 1"),
    hotspots: store.prepare("SELECT element_key, json_extract(detail, '$.number') AS number FROM elements WHERE drawing_id = ? AND kind = 'hotspot'"),
    externalSince: store.prepare(`SELECT json_extract(detail, '$.external_evidence.text') AS text FROM comments
      WHERE thread_id = ? AND json_extract(detail, '$.external_evidence.at') >= ? AND created_at <= ?`),
    answers: store.prepare(`SELECT t.id AS thread, t.element_key, owner.created_at AS approved_at, owner.body AS answer, decision.body AS decision FROM comment_threads t
      JOIN comments owner ON owner.thread_id = t.id AND owner.author = 'owner'
      JOIN comments decision ON decision.thread_id = t.id AND decision.author = 'agent'
        AND decision.seq > owner.seq AND json_type(decision.detail, '$.link') = 'text'
      WHERE t.diagram_id = ? AND owner.created_at > ? AND decision.created_at > ? AND decision.created_at <= ?
        AND owner.seq = (SELECT max(candidate.seq) FROM comments candidate
          WHERE candidate.thread_id = t.id AND candidate.author = 'owner' AND candidate.seq < decision.seq)
        AND NOT EXISTS (SELECT 1 FROM comments question WHERE question.thread_id = t.id
          AND question.seq > owner.seq AND question.seq < decision.seq AND json_type(question.detail, '$.asks') = 'text')
        AND NOT EXISTS (SELECT 1 FROM thread_resolution_events event WHERE event.thread_id = t.id
          AND event.event = 'reopened' AND event.created_at >= owner.created_at)
        AND NOT EXISTS (SELECT 1 FROM comments later WHERE later.thread_id = t.id AND later.seq > decision.seq)`),
    answered: store.prepare(`SELECT t.id AS thread, t.element_key, owner.created_at AS approved_at, owner.body AS answer FROM comment_threads t
      JOIN comments owner ON owner.thread_id = t.id AND owner.author = 'owner'
      WHERE t.diagram_id = ? AND t.state = 'open' AND t.waits_on = 'owner'
        AND owner.created_at > ? AND owner.created_at <= ?
        AND NOT EXISTS (SELECT 1 FROM thread_resolution_events event WHERE event.thread_id = t.id
          AND event.event = 'reopened' AND event.created_at >= owner.created_at)
        AND NOT EXISTS (SELECT 1 FROM comments later WHERE later.thread_id = t.id AND later.seq > owner.seq)`),
    accepted: store.prepare(`SELECT t.id AS thread, t.element_key, c.decided_at AS approved_at, json_extract(c.detail, '$.change') AS answer FROM change_sets c
      JOIN comment_threads t ON t.id = c.thread_id AND t.diagram_id = c.diagram_id
      WHERE c.diagram_id = ? AND c.origin = 'proposal' AND c.state IN ('accepted', 'reflected')
        AND c.decided_at > ? AND c.decided_at <= ? AND json_type(c.detail, '$.change') = 'text'
        AND NOT EXISTS (SELECT 1 FROM thread_resolution_events event WHERE event.thread_id = t.id
          AND event.event = 'reopened' AND event.created_at >= c.decided_at)`),
    recommendations: store.prepare(`SELECT t.id AS thread, t.element_key, owner.created_at AS approved_at, proposed.body AS answer, owner.body AS choice, decision.body AS decision
      FROM comment_threads t JOIN comments proposed ON proposed.thread_id = t.id AND proposed.author = 'agent'
        AND json_extract(proposed.detail, '$.asks') = 'recommended'
      JOIN comments owner ON owner.thread_id = t.id AND owner.author = 'owner' AND owner.seq = proposed.seq + 1
      JOIN comments decision ON decision.thread_id = t.id AND decision.author = 'agent' AND decision.seq = owner.seq + 1
        AND json_type(decision.detail, '$.link') = 'text'
      WHERE t.diagram_id = ? AND owner.created_at > ? AND decision.created_at <= ?
        AND NOT EXISTS (SELECT 1 FROM thread_resolution_events event WHERE event.thread_id = t.id
          AND event.event = 'reopened' AND event.created_at >= owner.created_at)
        AND NOT EXISTS (SELECT 1 FROM comments later WHERE later.thread_id = t.id AND later.seq > decision.seq)`),
  });
  return statements.get(store);
}

// Preserve the source path while ignoring line numbers shifted by a record insertion.
function canonical(value, key = '') {
  if (key === 'where' && typeof value === 'string') return value.replace(/:\d+$/, '');
  if (Array.isArray(value)) return value.map((entry) => canonical(entry));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((name) => [name, canonical(value[name], name)]));
  }
  return value;
}

export function isDecisionRecord(store, { diagram, confirmedDrawing, baselineDrawing = confirmedDrawing, drawing, confirmedAt, time }) {
  const q = queries(store);
  if (q.incomplete.get(confirmedDrawing) || q.incomplete.get(drawing) || q.failed.get(diagram, confirmedDrawing, drawing)) return false;
  const oldSource = q.source.get(baselineDrawing);
  const newSource = q.source.get(drawing);
  if (!oldSource || !newSource) return false;
  let before, after;
  try {
    before = JSON.parse(oldSource.body);
    after = JSON.parse(newSource.body);
  } catch {
    return false;
  }
  if (!Array.isArray(before.hotspots) || !Array.isArray(after.hotspots) || before.hotspots.length !== after.hotspots.length) return false;
  const noConflictingExternal = (row, decision) => q.externalSince.all(row.thread, row.approved_at, time)
    .every((external) => exactExternalAnswer(external.text, decision));
  const evidence = q.answers.all(diagram, confirmedAt, confirmedAt, time)
    .filter((row) => !/[?？]/u.test(row.answer) && normalize(row.answer) !== '' && normalize(row.answer) === normalize(row.decision) && noConflictingExternal(row, row.decision))
    .map((row) => ({ key: row.element_key, text: normalize(row.answer) }));
  evidence.push(...q.accepted.all(diagram, confirmedAt, time).filter((row) => noConflictingExternal(row, row.answer)).map((row) => ({ key: row.element_key, text: normalize(row.answer) })).filter((row) => row.text));
  evidence.push(...q.answered.all(diagram, confirmedAt, time)
    .filter((row) => !/[?？]/u.test(row.answer) && noConflictingExternal(row, row.answer)).map((row) => ({ key: row.element_key, text: normalize(row.answer) })).filter((row) => row.text));
  evidence.push(...q.recommendations.all(diagram, confirmedAt, time)
    .filter((row) => RECOMMENDATION_CHOICES.has(normalize(row.choice)) && normalize(row.answer) === normalize(row.decision) && noConflictingExternal(row, row.decision))
    .map((row) => ({ key: row.element_key, text: normalize(row.answer) })).filter((row) => row.text));
  const hotspots = q.hotspots.all(baselineDrawing);
  let recorded = 0;
  for (let index = 0; index < before.hotspots.length; index += 1) {
    const old = before.hotspots[index];
    const next = after.hotspots[index];
    if (!old || !next || typeof old.answer !== 'string' || typeof next.answer !== 'string') return false;
    if (old.answer === next.answer && old.state === next.state) continue;
    const keys = hotspots.filter((row) => row.number === old.number);
    if (old.answer.trim() !== '' || !/^open$/i.test(old.state) || !/^(answered|답함)$/i.test(next.state)
        || keys.length !== 1 || !evidence.some((row) => row.key === keys[0].element_key && row.text === normalize(next.answer))) return false;
    next.answer = old.answer;
    next.state = old.state;
    recorded += 1;
  }
  if (recorded === 0) return false;
  try {
    return JSON.stringify(canonical(before)) === JSON.stringify(canonical(after));
  } catch {
    // An unexpectedly deep or otherwise uncomparable source is never proof.
    return false;
  }
}
