// The workspace's first page (API-151, SPEC-143 to SPEC-145): my turn across
// the spaces, the agent to-do's counts and a card for each stored snapshot,
// from the rows that store.js reads. Nothing here reads the database or the
// request.
import { STAGES } from "./preflight.js";
import { stageRecord } from "./entries.js";
import { pictureLayout } from "./layout.js";
import { cut, partsOf, repositoryOf } from "./stage-items.js";

export const TURN = 50;
export const DRAWN = 2000;
const KINDS = new Set(["context", "lane", "event", "command", "actor", "aggregate", "read-model", "policy", "external", "hotspot", "screen", "table"]);
const PART = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const parse = (text) => { try { return JSON.parse(text); } catch { return null; } };
const fields = (value) => value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};

// A picture as the server first lays it out, the whole board for stage 01, in
// whole units and without labels (the first picture decision of 2026-11-04):
// each box by its kind, in the layout's order, and each line from the right
// middle of one box to the left middle of the other, as the 0.2 preview draws
// them. Null when the picture has nothing to draw, when the layout stops at
// its limit, or past 2,000 boxes or lines.
export function drawingOf(source, stage) {
  const scene = pictureLayout(source, stage);
  if (scene.limited || !scene.nodes.length || scene.nodes.length > DRAWN || scene.edges.length > DRAWN) return null;
  const at = new Map(scene.nodes.map((node) => [node.key, node]));
  const whole = (values) => values.map((value) => Math.round(value));
  const lines = scene.edges.flatMap((edge) => {
    const from = at.get(edge.from), to = at.get(edge.to);
    return from && to ? [whole([from.x + from.width, from.y + from.height / 2, to.x, to.y + to.height / 2])] : [];
  });
  const { x, y, width, height } = scene.bounds;
  return { bounds: whole([x, y, width, height]),
    boxes: scene.nodes.filter((node) => KINDS.has(node.kind)).map((node) => [node.kind, ...whole([node.x, node.y, node.width, node.height])]), lines };
}

// My turn's rows come in SPEC-143's order with their total; a comment brings
// the text of its last entry, the agent's, and an item the title that the
// stored snapshot gives it.
function turnEntry(row) {
  return { kind: row.kind, id: row.id, project: row.project, part: row.part, stage: row.stage, item: row.item,
    title: row.item && typeof row.title === "string" ? cut(row.title, 120) : null,
    quote: typeof row.quote === "string" ? cut(row.quote, 300) : null, text: cut(String(row.last_text ?? ""), 300),
    at: row.at, asks: row.asks ?? null };
}

function agentCounts(row) {
  const count = (list) => ({ total: row[list], oldest: row[list + "_oldest"] === null ? null : parse(row[list + "_oldest"]) });
  return { project: row.project, comments: count("comments"), discrepancies: count("discrepancies"),
    reflections: count("reflections"), checkpoints: count("checkpoints"), taken: row.taken };
}

// The settings' parts, or the project as a whole; a phase 1 snapshot keeps
// fields that the server does not read, so only the names that a 0.2
// snapshot could hold make parts.
function cardParts(project) {
  const named = [...new Set(partsOf({ project }).filter((part) => typeof part === "string" && part.length <= 100 && PART.test(part)))].slice(0, 50);
  return named.length ? named : [""];
}

// A part's row of stages, as the hub page names its current stage: the first
// in progress, else the first not started; recorded when a record names a
// state for any of them.
function cardPart(snapshot, name) {
  const records = STAGES.map((stage) => stageRecord(snapshot, name, stage));
  const states = records.map((record) => record.state);
  const at = states.includes("in_progress") ? states.indexOf("in_progress") : states.indexOf("not_started");
  const next = at < 0 ? null : records[at].next;
  return { name, recorded: states.some((state) => state !== "unknown"), current: at < 0 ? null : STAGES[at],
    next: typeof next === "string" && next ? cut(next, 300) : null, states };
}

// Where a project's address leads (API-153, SPEC-146): the current stage of
// its first part, as its card names it, or stage 01 when none is current.
export function currentPlace(snapshot) {
  const project = fields(snapshot.project), part = cardParts(project)[0];
  return { part, stage: cardPart({ project, stages: fields(snapshot.stages) }, part).current || STAGES[0] };
}

function card(row, pictures) {
  const project = fields(parse(row.project));
  const snapshot = { project, stages: fields(parse(row.stages)) };
  const counts = fields(parse(row.counts));
  const parts = cardParts(project);
  const place = new Map(parts.map((part, index) => [part, index]));
  const stages = STAGES.map((key) => ({ key, items: Number.isInteger(counts[key]) ? counts[key] : 0 }));
  return { name: row.name, title: typeof project.title === "string" ? cut(project.title, 120) : null,
    repository: repositoryOf(fields(parse(row.repo))), commit: row.default_commit || null,
    generated_at: row.generated_at, pushed_at: row.received_at,
    items: stages.reduce((sum, stage) => sum + stage.items, 0), warnings: row.warnings,
    parts: parts.map((part) => cardPart(snapshot, part)), stages,
    // The space's pictures of the parts that the snapshot names, in their
    // order and the stages' order; one of a part no longer named stays off.
    pictures: pictures.filter((picture) => place.has(picture.part))
      .sort((a, b) => place.get(a.part) - place.get(b.part) || (a.stage < b.stage ? -1 : a.stage > b.stage ? 1 : 0))
      .map((picture) => ({ part: picture.part, stage: picture.stage, commit: picture.commit_id, committed_at: picture.committed_at,
        not_current: picture.not_current, comments: picture.comments, drawing: drawingOf(JSON.parse(picture.source), picture.stage) })) };
}

export function homeData({ now, turn, agent, cards, pictures }) {
  const held = new Map();
  for (const picture of pictures) {
    if (!held.has(picture.project)) held.set(picture.project, []);
    held.get(picture.project).push(picture);
  }
  return { generated_at: now, my_turn: { total: turn[0]?._total || 0, entries: turn.map(turnEntry) },
    agent: agent.map(agentCounts), projects: cards.map((row) => card(row, held.get(row.name) || [])) };
}
