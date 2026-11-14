// The search (API-156, SPEC-152): every stored snapshot's items by ID and
// title, from the rows that store.js reads. Nothing here reads the database or
// the request, and no stage source's text is searched.
import { STAGES } from "./preflight.js";
import { TRACE, cut } from "./stage-items.js";

export const MATCHES = 20;
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// rows: each project's name, first part and items, in the order of the
// names. An item whose ID is the words comes first, then the items whose ID
// or title holds every word, ignoring case, as the hub page's search and the
// stage's words match (REQ-094); each list in the order of the projects and
// then of the snapshot. A project's ID matches once, as the item that a stage
// holds by it, and opens in the project's first part.
export function searchData(q, rows) {
  const upper = q.toUpperCase(), words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const exact = [], loose = [];
  let total = 0;
  for (const row of rows) {
    let items;
    try { items = JSON.parse(row.items); } catch { items = null; }
    const part = typeof row.part === "string" && row.part.length <= 100 && NAME.test(row.part) ? row.part : "";
    const seen = new Set();
    for (const item of Array.isArray(items) ? items : []) {
      if (!item || typeof item.id !== "string" || seen.has(item.id) || item.id.length > 30 || !TRACE.test(item.id) || !STAGES.includes(item.stage)) continue;
      seen.add(item.id);
      const title = typeof item.title === "string" ? item.title : null;
      const id = item.id.toLowerCase(), named = (title || "").toLowerCase();
      const list = item.id === upper ? exact : words.every((word) => id.includes(word) || named.includes(word)) ? loose : null;
      if (!list) continue;
      total++;
      if (list.length < MATCHES) list.push({ project: row.name, part, stage: item.stage, id: item.id, title: title === null ? null : cut(title, 120) });
    }
  }
  return { q, total, matches: [...exact, ...loose].slice(0, MATCHES) };
}
