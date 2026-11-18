import { commitPattern, idPattern, partPattern, stageKeys, tracePattern } from "./rebuild-contract.js";
import { repositoryNames } from "./rebuild-github.js";
import { canonicalJSON, sha256 } from "./rebuild-http.js";

const key = (value) => sha256(canonicalJSON(value));
const legacyId = (kind, ...values) => `${kind}_${key(values).slice(0, 30)}`;
const date = (value) => Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const text = (value) => typeof value === "string" && value.length && value.isWellFormed() &&
  Array.from(value).length <= 8000 && Buffer.byteLength(value) <= 32768;
const commit = (value) => typeof value === "string" && commitPattern.test(value);
const part = (name) => partPattern.test(name ?? "") ? name : "main";
const slot = (part, stage, commit) => `${part}\0${stage}\0${commit}`;

export function legacyManifest({ schema, records, usedKeys, unknown, boundary }, fingerprint) {
  const tables = Object.fromEntries(Object.entries(records).map(([name, rows]) => {
    const entries = rows.map((row) => ({ id: usedKeys[name].map((field) => row[field]), sha256: key(row) }));
    return [name, { count: entries.length, entries, sha256: key(entries) }];
  }));
  const snapshotItems = records.snapshots.flatMap(({ name, default_commit, body }) => (JSON.parse(body).items || [])
    .map((item, at) => ({ id: [name, default_commit, at, item.id ?? null], sha256: key(item) })));
  return { format: "nexus.legacy-inventory/1", backup_sha256: fingerprint, schema_sha256: key(schema),
    project_names: records.snapshots.map(({ name }) => name), accepted_write_boundary: boundary,
    tables, snapshot_items: { count: snapshotItems.length, entries: snapshotItems, sha256: key(snapshotItems) }, unknown_tables: unknown };
}

function partForItem(item, parts) {
  const segments = (item.where?.split?.("/") || []).map((name) => name.split(".", 1)[0]);
  const inferred = parts.filter((candidate) => segments.includes(candidate));
  return inferred.length === 1 ? inferred[0] : parts.length === 1 ? parts[0] : "legacy";
}

function sourceLocation(where) {
  const match = /^(.*?):([1-9][0-9]{0,8})(?::[0-9]+)?$/.exec(typeof where === "string" ? where : "");
  if (!match || match[1].length > 1024 || /[\\\p{C}]/u.test(match[1]) ||
      match[1].split("/").some((piece) => !piece || piece === "." || piece === "..")) return { path: "legacy-source", line: null };
  return { path: match[1], line: Number(match[2]) };
}

// Preparation and tests run only on the protected backup/candidate pair.
// Legacy data without a verifiable source stays in the accompanying archive.
export function buildLegacyPlan(data, manifest, ownerMap, archive, at) {
  if (!ownerMap || Array.isArray(ownerMap) || Object.keys(ownerMap).sort().join("\0") !== [...manifest.project_names].sort().join("\0")) {
    throw new Error("Owner mapping must name every saved project exactly once");
  }
  const { records } = data;
  const rows = Object.fromEntries(["projects", "publications", "stage_artifacts", "artifact_items", "discussions", "messages",
    "discussion_decisions", "checkpoint_requests", "checkpoint_decisions"].map((name) => [name, []]));
  const mappings = [];
  const preservedArchive = Object.create(null);
  const digest = key(manifest);
  for (const item of records.snapshots) {
    const name = item.name;
    const owner = ownerMap[name];
    if (!owner || !idPattern.test(owner.owner_id) || !repositoryNames(owner.repository_url) ||
        !/^[A-Za-z0-9_./-]{1,255}$/.test(owner.default_branch) || !commit(item.default_commit) || !date(item.received_at) ||
        !/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(name)) throw new Error("A project mapping is incomplete");
    const project = legacyId("prj", name);
    const seed = JSON.parse(item.body);
    const title = typeof seed.project?.title === "string" && seed.project.title.trim() && Array.from(seed.project.title).length <= 120
      ? seed.project.title : name;
    const held = item.default_commit;
    const parts = (Array.isArray(seed.project?.parts) ? seed.project.parts : []).filter((value) => typeof value === "string" && partPattern.test(value));
    if (!parts.length) parts.push("main");
    const resolution = new Map();
    const ensurePart = (p) => { if (!parts.includes(p)) parts.push(p); };
    const selected = (table) => (records[table] || []).filter((record) => record.project === name);
    const archived = (kind) => { preservedArchive[kind] = (preservedArchive[kind] || 0) + 1; };
    const map = (kind, oid, tid, original) => mappings.push({ project: name, kind, legacy: oid, targetProject: project, target: tid, digest: key(original) });
    const comments = selected("comments");
    const checkpoints = selected("checkpoints");
    const commits = [...new Set([...comments, ...checkpoints].map((row) => row.commit_id).filter((value) => commit(value) && value !== held)), held];
    const publicationByCommit = new Map();
    let previous = null;
    for (const [index, sha] of commits.entries()) {
      const current = sha === held;
      const id = legacyId("pub", name, sha);
      const snapshot = current ? item.body : canonicalJSON({ format: "nexus.legacy-source-reference/1", commit: sha, archived: true });
      const received = current ? date(item.received_at) :
        date(comments.find((comment) => comment.commit_id === sha)?.made_at || checkpoints.find((check) => check.commit_id === sha)?.passed_at) || date(item.received_at);
      const revision = current ? Math.max(Number(item.revision), index + 1) : index + 1;
      const record = { id, project_id: project, revision, commit_sha: sha, parent_publication_id: previous,
        snapshot_digest: sha256(snapshot), format_version: 1, snapshot_json: snapshot, received_at: received };
      rows.publications.push(record);
      publicationByCommit.set(sha, record);
      previous = id;
      if (current) map("snapshot", name, id, item);
    }
    rows.projects.push({ id: project, owner_id: owner.owner_id, slug: name, title, repository_url: owner.repository_url,
      default_branch: owner.default_branch, held_publication_id: previous, row_revision: Number(item.revision), created_at: date(item.received_at) });
    for (const row of selected("project_spaces")) map("project_space", name, project, row);
    const artifacts = new Map();
    function artifact(p, stage, sha) {
      ensurePart(p);
      const logical = slot(p, stage, sha);
      if (!artifacts.has(logical)) {
        const version = publicationByCommit.get(sha);
        const id = legacyId("art", name, p, stage, sha);
        artifacts.set(logical, { publication: version, row: { id, project_id: project, publication_id: version.id, part: p, stage,
          content_version: key({ format: "nexus.legacy-content/1", part: p, stage, commit: sha, snapshot_digest: version.snapshot_digest }),
          parser_version: "nexus.legacy/1", representation: "unsupported", source_path: "legacy-source",
          source_json: JSON.stringify({ diagnostics: ["Legacy source. Publish verified source files to start a new review version."] }),
          created_at: version.received_at }, items: new Map() });
      }
      return artifacts.get(logical);
    }
    function setItem(a, trace, title, kind, location, removed) {
      const { path, line } = location;
      if (a.items.has(trace)) return a.items.get(trace);
      const { row, publication } = a;
      const item = { id: trace, title, kind, removed, fields: {},
        source: { repository_url: owner.repository_url, path, line, commit: publication.commit_sha, content_version: row.content_version,
          publication_id: publication.id, publication_revision: publication.revision, published_at: publication.received_at } };
      a.items.set(trace, item);
      if (line && row.source_path === "legacy-source") row.source_path = path;
      rows.artifact_items.push({ project_id: project, artifact_id: row.id, trace_id: trace, item_json: JSON.stringify(item), source_line: line, removed: Number(removed) });
      return item;
    }
    for (const [index, entry] of (seed.items || []).entries()) {
      if (!stageKeys.includes(entry.stage) || !tracePattern.test(entry.id || "") || typeof entry.title !== "string" ||
          !entry.title || Array.from(entry.title).length > 500 || typeof entry.kind !== "string" || !entry.kind || entry.kind.length > 40) {
        archived("snapshot_item"); continue;
      }
      const a = artifact(partForItem(entry, parts), entry.stage, held);
      if (a.items.has(entry.id)) { archived("snapshot_item"); continue; }
      setItem(a, entry.id, entry.title, entry.kind, sourceLocation(entry.where), false);
      map("snapshot_item", `${entry.id}:${index}`, a.row.id + ":" + entry.id, entry);
    }
    function targetOf(record) {
      if (!commit(record.commit_id) || !stageKeys.includes(record.stage)) return null;
      return artifact(part(record.part), record.stage, record.commit_id);
    }
    for (const comment of comments) {
      const a = targetOf(comment);
      if (!a || !date(comment.made_at) || !idPattern.test(comment.id) || !text(comment.text)) { archived("comments"); continue; }
      const trace = tracePattern.test(comment.item || "") ? comment.item : null;
      if (trace && !a.items.has(trace)) setItem(a, trace, trace, "legacy", { path: "legacy-source", line: null }, true);
      const id = comment.id;
      rows.discussions.push({ id, project_id: project, origin_artifact_id: a.row.id, item_trace_id: trace,
        state: comment.state === "closed" ? "resolved" : "open", created_at: date(comment.made_at) });
      const msg = legacyId("msg", name, id, 0);
      rows.messages.push({ id: msg, project_id: project, discussion_id: id, sequence: 1, author_kind: "legacy",
        author_ref: comment.author, body: comment.text, created_at: date(comment.made_at) });
      map("comment", id, id, comment);
      resolution.set(id, a);
      for (const reply of (records.replies || []).filter((row) => row.comment === id)) {
        if (!date(reply.made_at) || !text(reply.text)) { archived("replies"); continue; }
        const message = legacyId("msg", name, id, reply.seq);
        rows.messages.push({ id: message, project_id: project, discussion_id: id, sequence: reply.seq + 1, parent_message_id: msg,
          author_kind: "legacy", author_ref: reply.author, body: reply.text, created_at: date(reply.made_at) });
        map("reply", id + ":" + reply.seq, message, reply);
      }
      for (const choice of (records.decisions || []).filter((row) => row.comment === id)) {
        if (!date(choice.made_at) || !text(choice.text || choice.link)) { archived("decisions"); continue; }
        const decision = legacyId("dec", name, id, choice.seq);
        const pull = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/[0-9]+$/.test(choice.link) ? choice.link : null;
        rows.discussion_decisions.push({ id: decision, project_id: project, discussion_id: id, sequence: choice.seq,
          actor_owner_id: owner.owner_id, content_version: a.row.content_version, body: choice.text || choice.link, pull_request_url: pull,
          legacy_actor_json: JSON.stringify({ label: "legacy owner" }), decided_at: date(choice.made_at) });
        map("discussion_decision", id + ":" + choice.seq, decision, choice);
      }
    }
    const handledCheckpoints = new Set();
    for (const decision of checkpoints) {
      const a = targetOf(decision);
      if (!a || !idPattern.test(decision.id) || !date(decision.passed_at) ||
          (decision.state === "withdrawn" && !date(decision.withdrawn_at)) || handledCheckpoints.has(a.row.id)) {
        archived("checkpoints");
        continue;
      }
      handledCheckpoints.add(a.row.id);
      const request = decision.id, decisionId = legacyId("cpd", name, request);
      rows.checkpoint_requests.push({ id: request, project_id: project, artifact_id: a.row.id, content_version: a.row.content_version,
        state: decision.state, row_revision: decision.state === "withdrawn" ? 2 : 1, requested_at: date(decision.passed_at) });
      const history = { project_id: project, request_id: request, actor_owner_id: owner.owner_id, content_version: a.row.content_version,
        legacy_actor_json: JSON.stringify({ label: "legacy owner" }) };
      rows.checkpoint_decisions.push({ ...history, id: decisionId, sequence: 1, decision: "pass",
        decided_at: date(decision.passed_at), reason: text(decision.words) ? decision.words : null });
      if (decision.state === "withdrawn") rows.checkpoint_decisions.push({ ...history, id: legacyId("cpd", name, request, "withdraw"),
        sequence: 2, decision: "withdraw", prior_decision_id: decisionId, decided_at: date(decision.withdrawn_at) });
      map("checkpoint", decision.id, request, decision);
    }
    for (const request of comments.filter((row) => row.asks === "checkpoint" && row.state === "open")) {
      const a = resolution.get(request.id);
      if (!a || handledCheckpoints.has(a.row.id)) { archived("checkpoint_request"); continue; }
      handledCheckpoints.add(a.row.id);
      rows.checkpoint_requests.push({ id: request.id, project_id: project, artifact_id: a.row.id, content_version: a.row.content_version,
        state: "pending", requested_at: date(request.made_at) });
      map("checkpoint_request", request.id, request.id, request);
    }
    for (const p of parts) {
      if (![...artifacts.values()].some(({ row }) => row.part === p && row.publication_id === previous)) artifact(p, "01-domain", held);
    }
    rows.stage_artifacts.push(...[...artifacts.values()].map(({ row }) => row));
    for (const kind of ["pictures", "discrepancies", "proposals", "edits", "claims", "writes"]) {
      for (const entry of selected(kind)) {
        const entryId = data.usedKeys[kind].map((field) => entry[field]).join(":");
        map(`archive_${kind}`, entryId, legacyId("archive", name, kind, entryId), entry);
        archived(kind);
      }
    }
  }
  const counts = Object.fromEntries(Object.entries(manifest.tables).map(([name, table]) => [name, table.count]));
  const report = { projects: rows.projects.length, mapped: mappings.length, archives: preservedArchive, tables_unknown: manifest.unknown_tables.length,
    held_legacy_writes: manifest.accepted_write_boundary, archived_only: Boolean(manifest.unknown_tables.length || Object.keys(preservedArchive).length) };
  return { id: legacyId("migration", digest), digest, archive, counts, boundary: manifest.accepted_write_boundary, at, rows, mappings, report };
}
