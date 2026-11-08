// The workspace's item (API-157, SPEC-149): one item of the stored snapshot,
// its context, the place of its source and its trace, as the hub page's trace
// view shows them, with its talk that store.js reads. Nothing here reads the
// database or the request.
import { STAGES } from "./preflight.js";
import { KIND_ORDER, TRACE, compareIds, contextFinder, cut, https, itemFields } from "./stage-items.js";

export const TRACED = 100;
const COMMIT = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
// A place is [repository:]path:line, as the hub page's links read it.
const PLACE = /^(?:([a-z0-9]+(?:-[a-z0-9]+)*):)?(.+):(\d+)$/;

// The place of the item's source: a repository of the settings by its name,
// or the project's own; the link opens the file at that repository's commit,
// at the line unless it is the first, when the settings give its web address.
function sourceOf(snapshot, where) {
  if (typeof where !== "string" || !where) return null;
  const repos = snapshot.repos && typeof snapshot.repos === "object" ? snapshot.repos : {};
  const match = PLACE.exec(where);
  let alias = ".", path = where, line = null;
  if (match) {
    const named = match[1] !== undefined && Object.hasOwn(repos, match[1]);
    alias = named ? match[1] : ".";
    path = match[1] !== undefined && !named ? match[1] + ":" + match[2] : match[2];
    line = Number(match[3]) >= 1 ? Number(match[3]) : null;
  }
  if (Array.from(path).length > 300) return null;
  const repo = Object.hasOwn(repos, alias) && repos[alias] && typeof repos[alias] === "object" ? repos[alias] : {};
  const commit = typeof repo.commit === "string" && COMMIT.test(repo.commit) ? repo.commit : null;
  const web = https(repo.web);
  const link = web && commit ? https(web + "/blob/" + commit + "/" + path.split("/").map(encodeURIComponent).join("/") + (line !== null && line !== 1 ? "#L" + line : "")) : null;
  return { path, line, link, commit };
}

// The items that it comes from and leads to: its links in either direction to
// items of an earlier or a later kind, by stage in the stages' order, and in a
// stage by kind and ID, as the hub page's trace view groups them. Links to an
// item of the same kind, of a kind outside the stage contract's, or to an ID
// that no item of the 13 stages holds, have no place in either.
function traceOf({ byId, kindOf, near }, id) {
  const rank = (other) => KIND_ORDER.indexOf(kindOf(other));
  const here = rank(id), sides = { from: new Map(), to: new Map() };
  if (here >= 0) for (const other of near.get(id) || []) {
    const linked = byId.get(other), there = rank(other);
    if (!linked || there < 0 || there === here || other.length > 30 || !TRACE.test(other) || !STAGES.includes(linked.stage)) continue;
    const side = sides[there < here ? "from" : "to"];
    if (!side.has(linked.stage)) side.set(linked.stage, []);
    side.get(linked.stage).push(other);
  }
  const groups = (side) => STAGES.filter((stage) => side.has(stage)).map((stage) => {
    const ids = side.get(stage).sort((a, b) => rank(a) - rank(b) || compareIds(a, b));
    return { stage, total: ids.length, items: ids.slice(0, TRACED).map((other) => {
      const linked = byId.get(other);
      return { id: other, kind: linked.kind, title: typeof linked.title === "string" ? cut(linked.title, 120) : null };
    }) };
  });
  return { from: groups(sides.from), to: groups(sides.to) };
}

export function itemData({ snapshot, project, part, item, comments }) {
  const found = contextFinder(snapshot);
  const context = found.contextOf(item.id);
  const title = context === null ? null : found.byId.get(context)?.title;
  const language = snapshot.project?.language;
  return { project, part,
    language: typeof language === "string" && language && Array.from(language).length <= 20 ? language : null,
    item: itemFields(item),
    context: context === null ? null : { id: context, title: typeof title === "string" ? cut(title, 120) : null },
    source: sourceOf(snapshot, item.where), trace: traceOf(found, item.id), comments };
}
