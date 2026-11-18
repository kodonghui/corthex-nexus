import { createHmac } from "node:crypto";
import { iso, randomToken, resourceId, safeEqual } from "./rebuild-auth.js";
import { digestPattern, idPattern, previewPolicy, schemas, tracePattern } from "./rebuild-contract.js";
import { canonicalJSON, rebuildBody, rebuildJSON, RebuildProblem, sha256 } from "./rebuild-http.js";
import { parserVersion, prepareArtifacts, previewDigest, snapshotLimit } from "./rebuild-source.js";

export function pageCursor(token, scope, id) {
  const signature = createHmac("sha256", token).update(`nexus.page/1\0${scope}\0${id}`).digest("base64url");
  return `${id}.${signature}`;
}

export function pageInput(params, token, scope, pattern) {
  const count = params.get("limit") ?? "50";
  const cursor = params.get("cursor") || "";
  if (!/^[1-9][0-9]{0,2}$/.test(count) || Number(count) > 100 || cursor.length > 256) throw new RebuildProblem("invalid_input");
  const after = cursor.split(".")[0];
  if (cursor && (!pattern.test(after) || !safeEqual(cursor, pageCursor(token, scope, after)))) throw new RebuildProblem("invalid_input");
  return { limit: Number(count), after };
}

export function writeResult(result, replayStatus) {
  if (result.conflict) throw new RebuildProblem(result.conflict);
  return rebuildJSON(result.body, result.replay && replayStatus ? replayStatus : result.status);
}

export function readSelection(params) {
  const version = params.get("version"), publication = params.get("publication_id");
  if ((version !== null && !digestPattern.test(version)) || (publication !== null && !idPattern.test(publication))) {
    throw new RebuildProblem("invalid_input");
  }
  return { version, publication };
}

function checkpointSummary(rows, version) {
  const matching = rows.find((item) => item.content_version === version && item.state !== "superseded");
  return { checkpoint_state: matching?.state || (rows.some((item) => ["passed", "withdrawn", "superseded"].includes(item.state)) ? "historical" : "none"),
    checkpoint_ids: rows.map(({ id }) => id) };
}

function provenance(artifact) {
  if (!artifact || artifact.representation === "missing" || artifact.parser_version === "nexus.legacy/1") return null;
  return { repository_url: artifact.repository_url || "https://github.com/kodonghui/corthex-nexus", path: artifact.source_path,
    line: 1, commit: artifact.commit_sha, content_version: artifact.content_version,
    publication_id: artifact.publication_id, publication_revision: artifact.publication_revision, published_at: artifact.published_at };
}

const emptyGraph = () => ({ nodes: [], edges: [] });

// API-208/209 and API-224–231. Gate first, then resolve all IDs within
// the authenticated project and the exact selected publication.
export function publicationHandlers({ store, github, access, writeContext, limiter, stageCatalog, reportOutcome }) {
  function readArtifact(request, url, now, { projectId, part, stage, itemId }) {
    const actor = access(request, now, projectId, ["owner", "agent"]);
    const selection = readSelection(url.searchParams);
    const machine = actor.role === "agent";
    if (machine && (!selection.version || !selection.publication)) throw new RebuildProblem("invalid_input");
    const artifact = store.artifact(projectId, part, stage, selection);
    if (!artifact && (itemId || selection.version || selection.publication)) throw new RebuildProblem("not_found");
    const scope = `items:${projectId}:${artifact?.id || part + "/" + stage}`;
    const { limit, after } = pageInput(url.searchParams, actor.token, scope, tracePattern);
    const identity = actor.credential?.id;
    const at = iso(now);
    const cites = machine ? store.citedWork(projectId, artifact.id, identity, at, { item: itemId ?? null }) : null;
    const permitted = !machine || cites.includes(null);
    if (!permitted && !cites.length) throw new RebuildProblem("not_found");
    if (itemId) {
      const [item] = store.artifactItems(projectId, artifact.id, "", 1, itemId);
      if (!item || (item.removed && !selection.publication && !selection.version)) throw new RebuildProblem("not_found");
      return rebuildJSON(item);
    }
    const overview = store.overview(actor.owner, projectId);
    const current = stageCatalog(overview.artifacts, overview.checkpoints).find((row) => row.part === part && row.stage === stage);
    if (!current && !artifact) throw new RebuildProblem("not_found");
    const history = artifact ? checkpointSummary(store.artifactCheckpoints(projectId, part, stage, artifact.content_version), artifact.content_version) : null;
    const summary = !artifact ? current : { ...current, part, stage, ...history, content_version: artifact.content_version,
      work_state: current?.work_state ?? "not_started", blockers: current?.blockers ?? [],
      artifact_state: artifact.representation === "missing" ? "missing" : artifact.representation === "unsupported" ? "unsupported" : "present" };
    const document = artifact ? JSON.parse(artifact.source_json) : {};
    const items = !artifact ? [] : permitted ? store.artifactItems(projectId, artifact.id, after, limit + 1, null)
      : store.citedWork(projectId, artifact.id, identity, at, { after, limit: limit + 1 })
          .flatMap((id) => store.artifactItems(projectId, artifact.id, "", 1, id));
    let next_cursor = null;
    if (items.length > limit) {
      items.pop();
      next_cursor = pageCursor(actor.token, scope, items.at(-1).id);
    }
    return rebuildJSON({ stage: summary, representation: artifact?.representation || "missing",
      source: permitted ? provenance(artifact) : items[0]?.source || store.artifactItems(projectId, artifact.id, "", 1, cites[0])[0]?.source, items, next_cursor,
      diagnostics: permitted ? document.diagnostics || [] : [], graph: permitted ? document.graph || emptyGraph() : emptyGraph(),
      artifact_id: artifact?.id ?? null, checkpoint_ids: summary.checkpoint_ids });
  }

  function listProjectVersions(request, url, now, { projectId }) {
    const actor = access(request, now, projectId, ["owner"]);
    const scope = `versions:${projectId}`;
    const { limit, after } = pageInput(url.searchParams, actor.token, scope, idPattern);
    const prior = after ? store.versionPosition(projectId, after) : { revision: Number.MAX_SAFE_INTEGER, part: "", stage: "", id: "" };
    if (!prior) throw new RebuildProblem("invalid_input");
    const versions = store.versions(projectId, prior, limit + 1);
    let next_cursor = null;
    if (versions.length > limit) {
      versions.pop();
      next_cursor = pageCursor(actor.token, scope, versions.at(-1).artifact_id);
    }
    return rebuildJSON({ versions: versions.map((version) => {
      const checkpoints = store.artifactCheckpoints(projectId, version.part, version.stage, version.content_version);
      return { ...version, held: Boolean(version.held), ...checkpointSummary(checkpoints, version.content_version),
        matching_checkpoint_ids: checkpoints.filter((row) => row.content_version === version.content_version).map(({ id }) => id) };
    }), next_cursor });
  }

  function getPublicationReceipt(request, _url, now, { projectId, publicationId }) {
    access(request, now, projectId, ["owner", "agent", "publisher"]);
    const publication = store.publication(projectId, publicationId);
    if (!publication) throw new RebuildProblem("not_found");
    return rebuildJSON(publication);
  }

  function listProjectCredentials(request, _url, now, { projectId }) {
    access(request, now, projectId, ["owner"]);
    return rebuildJSON({ credentials: store.listCredentials(projectId) });
  }

  async function issueProjectCredential(request, _url, now, { projectId }) {
    const actor = access(request, now, projectId, ["owner"]);
    const body = await rebuildBody(request, schemas.CredentialInput);
    if (!body.label.trim() || !body.label.isWellFormed()) throw new RebuildProblem("invalid_input");
    const write = writeContext(request, actor, "issueProjectCredential", body);
    const secret = randomToken();
    return writeResult(store.issueCredential(write, projectId, body, resourceId("cred"), secret, sha256(secret)), 200);
  }

  async function revokeProjectCredential(request, _url, now, { projectId, credentialId }) {
    const actor = access(request, now, projectId, ["owner"]);
    const body = await rebuildBody(request, schemas.CredentialRevokeInput);
    if (credentialId !== body.credential_id) throw new RebuildProblem("invalid_input");
    return writeResult(store.revokeCredential(writeContext(request, actor, "revokeProjectCredential", body), projectId, credentialId, body));
  }

  async function consentFirstPublication(request, _url, now, { projectId }) {
    const actor = access(request, now, projectId, ["owner"]);
    const body = await rebuildBody(request, schemas.ConsentInput);
    return writeResult(store.firstConsent(writeContext(request, actor, "consentFirstPublication", body), projectId, body, resourceId("consent")));
  }

  async function publishSnapshot(request, _url, now, { projectId }) {
    const actor = access(request, now, projectId, ["publisher"]);
    limiter.require(`publish:${projectId}`, now, 10);
    const input = await rebuildBody(request, schemas.SnapshotInput, { limit: snapshotLimit, registry: schemas });
    const write = writeContext(request, actor, "publishSnapshot", input);
    const replay = store.readReceipt(write);
    if (replay) {
      const response = writeResult(replay);
      reportOutcome("skipped");
      return response;
    }
    const current = store.projectState(actor.owner, projectId);
    if (!current) throw new RebuildProblem("not_found");
    if (current.commit_sha !== input.base_commit) throw new RebuildProblem("older_publication");
    const contentDigest = previewDigest(projectId, input);
    if (current.held_publication_id ? input.consent_id !== null : !store.liveConsent(actor.owner, projectId, input.consent_id, contentDigest)) {
      throw new RebuildProblem("consent_required");
    }
    const artifacts = prepareArtifacts(input.artifacts).map((artifact) => ({ ...artifact, id: resourceId("art") }));
    if (!github) throw new RebuildProblem("source_verification_unavailable");
    await github.verify(current, input, current.commit_sha);
    const applied = writeContext(request, actor, "publishSnapshot", input);
    const verified = { id: resourceId("pub"), digest: sha256(canonicalJSON(input)), consentDigest: contentDigest, parser: parserVersion,
      repository: current.repository_url, priorId: current.held_publication_id, snapshotText: canonicalJSON(input), artifacts };
    const result = store.publish(applied, projectId, actor.hash, verified, input);
    const response = writeResult(result);
    reportOutcome(result.journal ? "received" : "skipped");
    return response;
  }

  function getIsolatedPreview(request, url, now, { projectId, artifactId }) {
    access(request, now, projectId, ["owner"]);
    const { version } = readSelection(url.searchParams);
    const artifact = store.artifactById(projectId, artifactId, version);
    if (artifact?.representation !== "html") throw new RebuildProblem("not_found");
    const file = JSON.parse(artifact.source_json).source_files?.find((source) => source.path === artifact.source_path && source.media_type === "text/html");
    const source = provenance(artifact);
    if (!file?.content_utf8 || !source) throw new RebuildProblem("not_found");
    return rebuildJSON({ artifact_id: artifact.id, content_version: artifact.content_version, part: artifact.part,
      source, html: file.content_utf8, sandbox: "allow-scripts", csp: previewPolicy });
  }

  return { getStageArtifact: readArtifact, getArtifactItem: readArtifact, listProjectVersions,
    getPublicationReceipt, listProjectCredentials, issueProjectCredential, revokeProjectCredential,
    consentFirstPublication, publishSnapshot, getIsolatedPreview };
}
