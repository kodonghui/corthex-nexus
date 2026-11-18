import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const api = JSON.parse(readFileSync(new URL("../../docs/06-api/sources/rebuild/openapi.json", import.meta.url), "utf8"));
const operations = new Map(Object.values(api.paths).flatMap((methods) => Object.values(methods).map((op) => [op.operationId, op])));
const example = (operation, status) => structuredClone(operations.get(operation).responses[status].content["application/json"].examples.success.value);
const digest = (value) => createHash("sha256").update(value).digest("hex");

// TASK-321 (SPEC-308, REQ-349). Derive the initial source from the approved
// API's public sample, then model a real content change in a second commit.
export function rebuildFixture() {
  const sample = example("getPublicSample", 200);
  const approvedItem = example("getArtifactItem", 200);
  const approvedReview = example("getCheckpointReview", 200);
  const projectExample = example("createPrivateSampleProject", 201);
  const time = "2026-11-18T01:00:00.000Z";
  const later = "2026-11-18T02:00:00.000Z";
  const sourcePath = sample.source_files[0].path;
  const originalSource = sample.source_files[0].content_utf8 + "| REQ-302 | Original second requirement |\n";
  const changedSource = sample.source_files[0].content_utf8 + "| REQ-303 | Replacement requirement |\n";
  const sampleTitle = originalSource.split("\n").find((line) => line.startsWith(`| ${approvedItem.id} |`)).split("|")[2].trim();
  const projectId = projectExample.id;
  const owner = "own_demo";
  const otherOwner = "own_other";
  const otherProject = "prj_other";
  const repository = approvedItem.source.repository_url;
  const snapshots = [originalSource, changedSource].map((raw, index) => {
    const id = index === 0 ? "pub_demo" : "pub_changed_demo";
    const created = index === 0 ? time : later;
    const commit = (index === 0 ? "c" : "e").repeat(40);
    const snapshot = JSON.stringify({ source_files: [{ ...sample.source_files[0], content_utf8: raw, sha256: digest(raw) }] });
    return { id, project_id: projectId, revision: index + 1, commit_sha: commit,
      parent_publication_id: index === 0 ? null : "pub_demo", snapshot_digest: digest(snapshot),
      format_version: 2, snapshot_json: snapshot, received_at: created };
  });
  const artifacts = snapshots.map((snapshot, index) => ({
    id: index === 0 ? "art_original" : "art_changed", project_id: projectId, publication_id: snapshot.id,
    part: approvedReview.part, stage: approvedReview.stage, content_version: digest(index === 0 ? originalSource : changedSource),
    parser_version: "fixture-prd-1", representation: "list", source_path: sourcePath,
    source_json: snapshot.snapshot_json, created_at: snapshot.received_at,
  }));
  function item(artifact, trace, title, removed = false) {
    const snapshot = snapshots.find(({ id }) => id === artifact.publication_id);
    const line = trace === approvedItem.id ? 5 : 6;
    return { project_id: projectId, artifact_id: artifact.id, trace_id: trace, removed: Number(removed),
      source_line: removed ? null : line,
      item_json: JSON.stringify({ ...approvedItem, id: trace, title, removed, source: {
        repository_url: repository, path: sourcePath, line: removed ? null : line, commit: snapshot.commit_sha,
        content_version: artifact.content_version, publication_id: snapshot.id,
        publication_revision: snapshot.revision, published_at: snapshot.received_at,
      } }) };
  }
  const [original, current] = artifacts;
  const previous = { id: "cp_original", project_id: projectId, artifact_id: original.id,
    content_version: original.content_version, state: "passed", row_revision: 1, requested_at: time };
  const pending = { id: approvedReview.id, project_id: projectId, artifact_id: current.id,
    content_version: current.content_version, state: "pending", row_revision: 0, requested_at: later };
  const owners = [owner, otherOwner].map((id) => ({ id, issuer: "https://oidc.example.test", subject: id, created_at: time }));
  const sessions = owners.map(({ id }) => ({ id_hash: digest(`fixture-session:${id}`), owner_id: id,
    csrf_hash: digest(`fixture-csrf:${id}`), created_at: time, last_seen_at: time,
    idle_expires_at: "2026-11-18T01:30:00.000Z", absolute_expires_at: "2026-11-18T09:00:00.000Z" }));
  return { version: 1, owner, otherOwner, projectId, otherProject, repository, time, current, original, pending, previous,
    rows: {
      owners, owner_sessions: sessions,
      projects: [
        { id: projectId, owner_id: owner, slug: projectExample.slug, title: sample.title, repository_url: repository,
          default_branch: "main", held_publication_id: snapshots[1].id, row_revision: 2, synthetic: 1, created_at: time },
        { id: otherProject, owner_id: otherOwner, slug: projectExample.slug, title: "Another owner's private sample",
          held_publication_id: null, row_revision: 0, synthetic: 1, created_at: later },
      ],
      publications: snapshots, stage_artifacts: artifacts,
      artifact_items: [item(original, approvedItem.id, sampleTitle), item(original, "REQ-302", "Original second requirement"),
        item(current, approvedItem.id, sampleTitle), item(current, "REQ-302", "Original second requirement", true),
        item(current, "REQ-303", "Replacement requirement")],
      discussions: [{ id: "dis_demo", project_id: projectId, origin_artifact_id: original.id, item_trace_id: "REQ-302", state: "resolved", created_at: time }],
      messages: [
        { id: "msg_question", project_id: projectId, discussion_id: "dis_demo", sequence: 1, author_kind: "owner",
          author_ref: owner, body: "Why was this requirement included?", created_at: time },
        { id: "msg_reply", project_id: projectId, discussion_id: "dis_demo", sequence: 2, parent_message_id: "msg_question", author_kind: "agent",
          author_ref: "fixture-agent", body: "It was used in the first version of the sample.", created_at: time },
      ],
      discussion_decisions: [{ id: "dec_original", project_id: projectId, discussion_id: "dis_demo", sequence: 1,
        actor_owner_id: owner, content_version: original.content_version, body: "Replace the second requirement in the next publication.",
        source_publication_id: snapshots[0].id, source_commit: snapshots[0].commit_sha, decided_at: time }],
      checkpoint_requests: [previous, pending],
      checkpoint_decisions: [{ id: "cpd_original", project_id: projectId, request_id: previous.id, sequence: 1,
        actor_owner_id: owner, decision: "pass", content_version: original.content_version, decided_at: time }],
    },
  };
}

export function insertFixtureRow(db, table, values) {
  const keys = Object.keys(values);
  db.prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`).run(...Object.values(values));
}

export function seedRebuildFixture(db, fixture = rebuildFixture()) {
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const [table, rows] of Object.entries(fixture.rows)) {
      for (const row of rows) insertFixtureRow(db, table, row);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return fixture;
}
