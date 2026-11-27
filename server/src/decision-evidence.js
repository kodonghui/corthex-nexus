// Rules shared by confirmation retention and automatic resolution.
export const normalizeDecisionText = (text) => text.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('und');
export const RECOMMENDATION_CHOICES = new Set(['추천안', '추천안으로', 'recommended', 'the recommendation']);
export const INCOMPLETE_DRAWING = "SELECT 1 FROM elements WHERE drawing_id = ? AND status IN ('unreadable', 'missing', 'left_out') LIMIT 1";

const eventStatements = new WeakMap();
export function recordResolved(store, { thread, detail, time }) {
  if (!eventStatements.has(store)) {
    eventStatements.set(store, store.prepare("INSERT INTO thread_resolution_events (thread_id, event, detail, created_at) VALUES (?, 'resolved', ?, ?)"));
  }
  eventStatements.get(store).run(thread, JSON.stringify(detail), time);
}
