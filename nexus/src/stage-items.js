// The workspace's stage (API-158, SPEC-146 to SPEC-148): its head, the part's
// 13 stages and the stage's items, drawn from the stored snapshot and the part's
// marks that store.js reads. Nothing here reads the database or the request.
import { STAGES } from "./preflight.js";
import { stageRecord } from "./entries.js";

// The hub page's order of kinds, which is the stage contract's order of stages.
export const KIND_ORDER = Object.freeze(["context", "term", "requirement", "flow", "spec", "table", "api", "screen", "task", "test", "bug", "scene"]);
export const PAGE = 200;
export const TRACE = /^[A-Z][A-Z0-9]*-[0-9]{1,6}$/;
const FIELDS = ["id", "kind", "stage", "where", "title", "status", "type", "priority", "link", "parent", "screen_doc", "states", "links"];
// A DDD board's hotspot is open while its state says so, in the stage 01
// template's English or in Korean; answered ones (answered, 답함) are not.
const OPEN_HOTSPOT = new Set(["open", "열림"]);

export const cut = (text, limit) => Array.from(text).slice(0, limit).join("");
const list = (value) => { try { const parsed = typeof value === "string" ? JSON.parse(value) : value; return Array.isArray(parsed) ? parsed : []; } catch { return []; } };
export const https = (value) => typeof value === "string" && value.startsWith("https://") && value.length <= 2000 ? value : null;
// An item's fields that the contract's Item names, as the snapshot holds them.
export const itemFields = (item) => Object.fromEntries(FIELDS.filter((name) => item[name] !== undefined).map((name) => [name, item[name]]));
// The project's parts, or the project as a whole when the snapshot names none.
export const partsOf = (snapshot) => Array.isArray(snapshot.project?.parts) && snapshot.project.parts.length ? snapshot.project.parts : [""];
// The item that a stage holds by its ID: the first in the snapshot's order of
// those with the ID on one of the 13 stages, as the list shows each of them.
export const heldItem = (snapshot, id) => (Array.isArray(snapshot.items) ? snapshot.items : []).find((item) => item.id === id && STAGES.includes(item.stage)) || null;

// The hub page's order of IDs: by prefix, then by number.
export function compareIds(a, b) {
  const pa = a.split("-"), pb = b.split("-");
  if (pa[0] !== pb[0]) return pa[0] < pb[0] ? -1 : 1;
  return (parseInt(pa[1], 10) || 0) - (parseInt(pb[1], 10) || 0) || (a < b ? -1 : a > b ? 1 : 0);
}

// An item's context, as the hub page's trace follows the links: a context's own
// ID; else the first context that its links name; else that of the first item
// that it comes from that has one, a stage back at a time. The items it comes
// from are the linked items of earlier kinds, in either direction, the nearest
// stage first, and within a stage those that its links name in their order,
// then the others by ID. Kinds only fall, so the walk ends; each item's answer
// is kept, so a snapshot of 3,000 items is walked once.
export function contextFinder(snapshot) {
  const items = Array.isArray(snapshot.items) ? snapshot.items : [];
  const byId = new Map();
  for (const item of items) if (!byId.has(item.id)) byId.set(item.id, item);
  const prefixes = snapshot.ids && typeof snapshot.ids === "object" ? snapshot.ids : {};
  const kindOf = (id) => byId.get(id)?.kind ?? (typeof prefixes[String(id).split("-")[0]] === "string" ? prefixes[String(id).split("-")[0]] : "");
  const rank = (id) => KIND_ORDER.indexOf(kindOf(id));
  const near = new Map();
  const join = (a, b) => { if (!near.has(a)) near.set(a, new Set()); near.get(a).add(b); };
  for (const item of items) for (const target of Array.isArray(item.links) ? item.links : []) {
    if (typeof target === "string" && target !== item.id) { join(item.id, target); join(target, item.id); }
  }
  const found = new Map();
  function contextOf(id) {
    if (found.has(id)) return found.get(id);
    found.set(id, null);
    let context = null;
    const links = Array.isArray(byId.get(id)?.links) ? byId.get(id).links : [];
    if (kindOf(id) === "context") context = id;
    else context = links.find((target) => kindOf(target) === "context") ?? null;
    const here = rank(id);
    if (context === null && here > 0) {
      const named = (other) => { const at = links.indexOf(other); return at < 0 ? Infinity : at; };
      const earlier = [...(near.get(id) || [])].filter((other) => { const there = rank(other); return there >= 0 && there < here; })
        .sort((a, b) => rank(b) - rank(a) || named(a) - named(b) || compareIds(a, b));
      for (const other of earlier) { context = contextOf(other); if (context !== null) break; }
    }
    if (context !== null && !TRACE.test(context)) context = null;
    found.set(id, context);
    return context;
  }
  return { byId, contextOf, kindOf, near };
}

function counted(values, limit) {
  const tally = new Map();
  for (const value of values) if (typeof value === "string" && value && Array.from(value).length <= 40) tally.set(value, (tally.get(value) || 0) + 1);
  return [...tally].slice(0, limit);
}

export function stageData({ held, snapshot, record, project, part, stage, query, comments, proposals, discrepancies, reflections, pictures }) {
  const items = Array.isArray(snapshot.items) ? snapshot.items : [];
  const ofStage = items.filter((item) => item.stage === stage);

  // The part's marks: each item's comments of this stage, open and waiting for
  // the user; the entries of my turn on each stage, the comments that wait for
  // the user and the open proposals (TERM-135); the open discrepancies, by
  // either of their sides; and the stage's pending reflections.
  const talk = new Map(), mine = new Map(), proposed = new Set(), opened = new Map(), pending = new Map();
  for (const row of comments) {
    if (row.stage === stage && row.item) talk.set(row.item, { all: Number(row.total) || 0, open: Number(row.open) || 0, mine: Number(row.mine) || 0 });
    mine.set(row.stage, (mine.get(row.stage) || 0) + (Number(row.mine) || 0));
  }
  for (const row of proposals) {
    mine.set(row.stage, (mine.get(row.stage) || 0) + 1);
    if (row.stage === stage) for (const id of list(row.items)) proposed.add(id);
  }
  for (const row of discrepancies) for (const id of new Set([row.term, row.item])) if (id) opened.set(id, (opened.get(id) || 0) + 1);
  for (const row of reflections) for (const id of new Set(list(row.items))) pending.set(id, (pending.get(id) || 0) + 1);
  const marks = (id) => {
    const said = talk.get(id) || { all: 0, open: 0, mine: 0 };
    return { comments: said.all, open: said.open, mine: said.mine > 0 || proposed.has(id), discrepancies: opened.get(id) || 0, reflections: pending.get(id) || 0 };
  };
  const filters = {
    all: () => true,
    talk: (mark) => mark.comments > 0,
    mine: (mark) => mark.mine,
    left: (mark) => mark.open > 0 || mark.discrepancies > 0 || mark.reflections > 0,
  };

  // The words narrow by ID or title, every word, ignoring case, as the hub
  // page's search does (REQ-094).
  const words = typeof query.q === "string" ? query.q.toLowerCase().split(/\s+/).filter(Boolean) : [];
  const matches = (item) => words.every((word) => String(item.id).toLowerCase().includes(word) || String(item.title || "").toLowerCase().includes(word));
  const found = ofStage.filter(matches).map((item) => ({ item, mark: marks(item.id) }));
  const counts = Object.fromEntries(Object.entries(filters).map(([name, keep]) => [name, found.filter(({ mark }) => keep(mark)).length]));
  const chosen = found.filter(({ mark }) => filters[query.filter](mark));

  const { byId, contextOf } = contextFinder(snapshot);
  let ordered = chosen, groups = [];
  if (query.group === "context") {
    const places = new Map();
    for (const item of items) if (item.kind === "context" && TRACE.test(item.id) && !places.has(item.id)) places.set(item.id, places.size);
    const grouped = new Map();
    for (const entry of chosen) {
      const context = contextOf(entry.item.id);
      if (!grouped.has(context)) grouped.set(context, []);
      grouped.get(context).push(entry);
    }
    const place = (id) => places.has(id) ? places.get(id) : Infinity;
    const keys = [...grouped.keys()].sort((a, b) => a === null ? 1 : b === null ? -1 : (place(a) - place(b)) || compareIds(a, b));
    ordered = keys.flatMap((key) => grouped.get(key));
    groups = keys.map((key) => {
      const title = key === null ? null : byId.get(key)?.title;
      return { context: key, title: typeof title === "string" ? cut(title, 120) : null, count: grouped.get(key).length };
    });
  }
  const entries = ordered.slice(query.after, query.after + PAGE).map(({ item, mark }) => ({
    ...itemFields(item),
    context: contextOf(item.id), comments: mark.comments, mine: mark.mine, discrepancies: mark.discrepancies, reflections: mark.reflections,
  }));

  // The head (SPEC-147): the picture's document version on a stage with a
  // picture of the part, and the held default branch commit otherwise.
  const drawn = new Map(pictures.map((row) => [row.stage, row]));
  const picture = drawn.get(stage);
  const repo = snapshot.repos?.["."] || {};
  const recorded = stageRecord(snapshot, part, stage);
  const last = Array.isArray(recorded.checkpoints) && recorded.checkpoints.length ? recorded.checkpoints[recorded.checkpoints.length - 1] : null;
  let hotspots = null;
  if (stage === "01-domain" && picture?.source) {
    const source = list(JSON.parse(picture.source).hotspots);
    hotspots = source.filter((spot) => OPEN_HOTSPOT.has(String(spot?.state ?? "").trim().toLowerCase())).length;
  }
  const kinds = counted(ofStage.map((item) => item.kind), Infinity)
    .sort(([a], [b]) => (KIND_ORDER.indexOf(a) + 1 || 99) - (KIND_ORDER.indexOf(b) + 1 || 99)).slice(0, 13);
  const head = {
    key: stage, state: recorded.state,
    checkpoint: last && typeof last === "object" ? Object.fromEntries(["approved", "by", "where", "date", "nexus"].filter((name) => last[name] !== undefined).map((name) => [name, last[name]])) : null,
    commit: picture ? picture.commit_id : held.default_commit || null,
    time: picture ? picture.committed_at : held.default_commit && typeof repo.default?.time === "string" ? repo.default.time : null,
    reads: record.read, source_state: record.source_state,
    counts: { items: ofStage.length, kinds: kinds.map(([kind, count]) => ({ kind, count })),
      priorities: counted(ofStage.map((item) => item.priority), 20).map(([priority, count]) => ({ priority, count })), hotspots },
    picture: Boolean(picture),
  };

  const parts = partsOf(snapshot);
  return {
    project: { name: held.name, title: typeof snapshot.project?.title === "string" ? cut(snapshot.project.title, 120) : null,
      repository: https(repo.url) || https(repo.web), commit: held.default_commit || null,
      generated_at: held.generated_at, pushed_at: held.received_at, parts },
    part, stage, head, record,
    stages: STAGES.map((key) => ({ key, state: stageRecord(snapshot, part, key).state, items: items.filter((item) => item.stage === key).length,
      picture: drawn.has(key), mine: mine.get(key) || 0 })),
    items: { group: query.group, filter: query.filter, q: words.length ? query.q.trim() : null, total: chosen.length, after: query.after,
      counts, groups, entries },
  };
}
