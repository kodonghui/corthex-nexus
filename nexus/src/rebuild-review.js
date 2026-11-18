import { createHmac } from "node:crypto";
import { iso, resourceId } from "./rebuild-auth.js";
import { idPattern, partPattern, schemas } from "./rebuild-contract.js";
import { rebuildBody, rebuildJSON, RebuildProblem, sha256 } from "./rebuild-http.js";
import { pageCursor, pageInput, readSelection, writeResult } from "./rebuild-publications.js";

const sequencePattern = /^(?:0|[1-9][0-9]{0,14})$/;
const leaseDuration = 10 * 60 * 1000;
const take = (rows, limit, token, scope, key) => {
  const list = rows.slice(0, limit);
  return [list, rows.length > limit ? pageCursor(token, scope, String(list.at(-1)[key])) : null];
};

function readPages(params, actor, id) {
  const read = (param, scope, pattern) => {
    const scopeKey = `discussion:${id}:${scope}`;
    const query = new URLSearchParams();
    if (params.has(param)) query.set("cursor", params.get(param));
    if (params.has("limit")) query.set("limit", params.get("limit"));
    return { ...pageInput(query, actor.token, scopeKey, pattern), scope: scopeKey };
  };
  return { messages: read("cursor", "messages", sequencePattern), proposals: read("proposal_cursor", "proposals", idPattern),
    decisions: read("decision_cursor", "decisions", sequencePattern) };
}

function validText(value, allowEmpty = false) {
  if (!value.isWellFormed() || (!allowEmpty && !value.trim())) throw new RebuildProblem("invalid_input");
  if (Buffer.byteLength(value) > 32768) throw new RebuildProblem("payload_too_large");
}

function hashLease(input) {
  const { lease_token, ...safe } = input;
  return { ...safe, lease_hash: sha256(lease_token) };
}

export function reviewHandlers({ store, access, writeContext, limiter, stageCatalog, reportOutcome }) {
  function discussion(row, actor, pages, now) {
    const data = store.discussionRows(actor.project.id, row.id, pages, iso(now), actor.credential?.id);
    if (!data) throw new RebuildProblem("not_found");
    const [messages, next_cursor] = take(data.notes, pages.messages.limit, actor.token, pages.messages.scope, "sequence");
    const [proposals, next_proposal_cursor] = take(data.changes, pages.proposals.limit, actor.token, pages.proposals.scope, "id");
    const [decisions, next_decision_cursor] = take(data.resolution, pages.decisions.limit, actor.token, pages.decisions.scope, "sequence");
    return { ...row, removed_item: Boolean(row.removed_item), messages, next_cursor,
      agent_work: data.work, proposals, next_proposal_cursor, decisions, next_decision_cursor };
  }

  function listStageDiscussions(request, url, now, { projectId, part, stage }) {
    const actor = access(request, now, projectId, ["owner"]);
    const { version } = readSelection(url.searchParams);
    const scope = `discussions:${projectId}:${part}:${stage}:${version || ""}`;
    const { after, limit } = pageInput(url.searchParams, actor.token, scope, idPattern);
    const rows = store.stageDiscussions(projectId, part, stage, version, after, limit + 1);
    const [selected, next_cursor] = take(rows, limit, actor.token, scope, "id");
    return rebuildJSON({ discussions: selected.map((row) => discussion(row, actor, readPages(new URLSearchParams({ limit: "3" }), actor, row.id), now)), next_cursor });
  }

  function getDiscussion(request, url, now, { projectId, discussionId }) {
    const actor = access(request, now, projectId, ["owner", "agent"]);
    const row = store.discussionRecord(projectId, discussionId);
    if (!row) throw new RebuildProblem("not_found");
    return rebuildJSON(discussion(row, actor, readPages(url.searchParams, actor, row.id), now));
  }

  async function askAboutArtifact(request, _url, now, { projectId, part, stage }) {
    const actor = access(request, now, projectId, ["owner"]);
    limiter.require(`discussion-write:${projectId}`, now, 30);
    const input = await rebuildBody(request, schemas.QuestionInput);
    validText(input.body);
    const result = store.askAboutArtifact(writeContext(request, actor, "askAboutArtifact", input), projectId, part, stage, input,
      { discussion: resourceId("dis"), message: resourceId("msg"), work: resourceId("work") });
    const response = writeResult(result);
    reportOutcome(result.replay ? "skipped" : input.ask_ai ? "queued" : "received");
    return response;
  }

  async function recordDiscussionDecision(request, _url, now, { projectId, discussionId }) {
    const actor = access(request, now, projectId, ["owner"]);
    limiter.require(`discussion-write:${projectId}`, now, 30);
    const input = await rebuildBody(request, schemas.EvidenceDecisionInput);
    validText(input.body);
    return writeResult(store.recordDiscussionDecision(writeContext(request, actor, "recordDiscussionDecision", input),
      projectId, discussionId, input, resourceId("dec")));
  }

  function listAgentWork(request, url, now, { projectId }) {
    const actor = access(request, now, projectId, ["agent"]);
    const scope = `agent-work:${projectId}`;
    const { after, limit } = pageInput(url.searchParams, actor.token, scope, idPattern);
    const rows = store.agentQueue(projectId, actor.credential.id, iso(now), after, limit + 1);
    const [work, next_cursor] = take(rows, limit, actor.token, scope, "id");
    return rebuildJSON({ work, next_cursor });
  }

  async function claimAgentWork(request, _url, now, { projectId, workId }) {
    const actor = access(request, now, projectId, ["agent"]);
    const input = await rebuildBody(request, schemas.ClaimInput);
    validText(input.session_label);
    const write = writeContext(request, actor, "claimAgentWork", input);
    const lease_token = createHmac("sha256", actor.token)
      .update(`nexus.lease/1\0${projectId}\0${workId}\0${write.keyHash}\0${write.bodyDigest}`).digest("base64url");
    const result = store.claim(write, projectId, workId, input, actor.credential.id, sha256(lease_token), iso(Date.parse(write.now) + leaseDuration));
    if (result.conflict) return writeResult(result);
    return rebuildJSON({ work: result.body, lease_token });
  }

  function leaseAction(operation) {
    return async (request, _url, now, { projectId, workId }) => {
      const actor = access(request, now, projectId, ["agent"]);
      const reply = operation === "replyToAgentWork";
      const renew = operation === "renewAgentClaim";
      const input = await rebuildBody(request, reply ? schemas.ReplyInput : schemas.LeaseInput);
      if (reply) { validText(input.body); limiter.require(`discussion-write:${projectId}`, now, 30); }
      const write = writeContext(request, actor, operation, input);
      const result = store.changeLease(write, projectId, workId, hashLease(input), actor.credential.id,
        renew ? iso(Date.parse(write.now) + leaseDuration) : null, reply ? resourceId("msg") : null);
      if (result.conflict || !renew) return writeResult(result);
      return rebuildJSON({ work: result.body, lease_token: input.lease_token });
    };
  }

  async function proposeArtifactChange(request, _url, now, { projectId, discussionId }) {
    const actor = access(request, now, projectId, ["agent"]);
    limiter.require(`discussion-write:${projectId}`, now, 30);
    const input = await rebuildBody(request, schemas.ProposalInput);
    validText(input.body);
    return writeResult(store.proposeChange(writeContext(request, actor, "proposeArtifactChange", input),
      projectId, discussionId, hashLease(input), actor.credential.id, resourceId("proposal")));
  }

  async function decideProposal(request, _url, now, { projectId, proposalId }) {
    const actor = access(request, now, projectId, ["owner"]);
    limiter.require(`discussion-write:${projectId}`, now, 30);
    const input = await rebuildBody(request, schemas.ProposalDecisionInput);
    return writeResult(store.decideProposal(writeContext(request, actor, "decideProposal", input), projectId, proposalId, input));
  }

  async function recordProposalReflection(request, _url, now, { projectId, proposalId }) {
    const actor = access(request, now, projectId, ["agent"]);
    const input = await rebuildBody(request, schemas.ReflectionInput);
    return writeResult(store.reflectProposal(writeContext(request, actor, "recordProposalReflection", input), projectId, proposalId, input, actor.credential.id));
  }

  function blockers(actor) {
    return (part, stage) => {
      const { artifacts, checkpoints } = store.overview(actor.owner, actor.project.id);
      return stageCatalog(artifacts, checkpoints).find((row) => row.part === part && row.stage === stage)?.blockers || [];
    };
  }

  async function requestCheckpoint(request, _url, now, { projectId }) {
    const actor = access(request, now, projectId, ["owner", "agent"]);
    const input = await rebuildBody(request, schemas.CheckpointInput);
    if (!partPattern.test(input.part)) throw new RebuildProblem("invalid_input");
    return writeResult(store.requestCheckpoint(writeContext(request, actor, "requestCheckpoint", input),
      projectId, input, resourceId("cp"), blockers(actor)));
  }

  function getCheckpointReview(request, _url, now, { projectId, checkpointId }) {
    const actor = access(request, now, projectId, ["owner"]);
    const row = store.checkpointRecord(projectId, checkpointId);
    if (!row) throw new RebuildProblem("not_found");
    const held = store.artifact(projectId, row.part, row.stage, { publication: null, version: null });
    const current = held && !["missing", "unsupported"].includes(held.representation)
      ? { publication_id: held.publication_id, content_version: held.content_version } : null;
    return rebuildJSON({ ...row, current_source: current, blockers: blockers(actor)(row.part, row.stage),
      history: store.checkpointHistory(projectId, checkpointId) });
  }

  function checkpointDecision(operation) {
    return async (request, _url, now, { projectId, checkpointId }) => {
      const actor = access(request, now, projectId, ["owner"], "human_session_required");
      const withdrawal = operation === "withdrawCheckpoint";
      const input = await rebuildBody(request, withdrawal ? schemas.WithdrawalInput : schemas.CheckpointDecisionInput);
      validText(input.reason, true);
      return writeResult(store.decideRebuildCheckpoint(writeContext(request, actor, operation, input), projectId,
        checkpointId, input, resourceId("cpd"), blockers(actor), withdrawal));
    };
  }

  function pollProjectEvents(request, url, now, { projectId }) {
    const actor = access(request, now, projectId, ["owner", "publisher", "agent"]);
    const scope = `project-events:${projectId}`;
    const { after, limit } = pageInput(url.searchParams, actor.token, scope, sequencePattern);
    const events = store.projectEvents(projectId, Number(after || 0), limit, actor.role === "publisher");
    return rebuildJSON({ events, next_cursor: pageCursor(actor.token, scope, String(events.at(-1)?.sequence || after || 0)) });
  }

  return { listStageDiscussions, askAboutArtifact, getDiscussion, recordDiscussionDecision, listAgentWork, claimAgentWork,
    replyToAgentWork: leaseAction("replyToAgentWork"), renewAgentClaim: leaseAction("renewAgentClaim"), releaseAgentClaim: leaseAction("releaseAgentClaim"),
    proposeArtifactChange, decideProposal, recordProposalReflection, requestCheckpoint, getCheckpointReview,
    decideCheckpoint: checkpointDecision("decideCheckpoint"), withdrawCheckpoint: checkpointDecision("withdrawCheckpoint"), pollProjectEvents };
}
