// State transitions are independent of D1. The store serializes this plan with
// an optimistic basis check and the write-ID receipt in one transaction.
import { Problem } from "./problem.js";
import { entryId } from "./push-plan.js";
import * as E from "./entries.js";

const opposite = (author) => author === "user" ? "agent" : "user";
const millis = (now, amount) => new Date(Date.parse(now) + amount).toISOString();
const bytes = (...texts) => texts.reduce((n, text) => n + new TextEncoder().encode(text || "").length, 0);
const fail = (code, fields = {}) => { throw new Problem(code, "the write cannot be applied in the current state", fields); };
const need = (row, kind) => { if (!row) fail(kind + "_not_found"); return row; };
const PICTURE_STAGES = ["01-domain", "05-erd", "07-sitemap"];
// The words of "as recommended" in the server's language (stage 08's words of
// the redesign, Answers): the user's reply that takes the agent's
// recommendation, and the words of a checkpoint passed with it (API-159).
export const AS_RECOMMENDED = Object.freeze({ en: "As recommended", ko: "추천대로" });
const RECOMMENDED_WORDS = Object.values(AS_RECOMMENDED);

// Shape checks that need no stored data run before the write-ID lookup too.
export function checkWriteBody(name, body, kind) {
  // The redesign: an empty item is the stage as a whole and needs no quote
  // (SPEC-151), and only the agent says what it asks of the user (SPEC-143).
  if ((name === "comment" || name === "reply") && body.asks && kind !== "agent") fail("invalid_request", { field: "asks" });
  if ((name === "reply" && body.settles || name === "recommended") && kind !== "user") fail("user_only", { needs: "user" });
  if (name === "proposal") {
    if (body.comment && body.discrepancy) fail("invalid_request", { field: "discrepancy" });
    if ((body.adds || []).some((id) => !body.items.includes(id))) fail("invalid_request", { field: "adds" });
  }
  if (name === "report-edit") {
    const pr = ["opened", "merged", "closed"].includes(body.event);
    if (pr !== Boolean(body.pull_request)) fail("invalid_request", { field: "pull_request" });
    if ((body.event === "reflected") !== Boolean(body.commit)) fail("invalid_request", { field: "commit" });
  }
}

function sameReport(a, b) {
  return a && a.event === b.event && (a.pull_request || null) === (b.pull_request || null) && (a.commit || null) === (b.commit || null);
}

export function planEntryWrite(name, body, state, { project, kind, session, now, language = "en" }) {
  if (!state.held) fail("project_not_found");
  if (!state.space) fail("space_not_found");
  const changes = [];
  const put = (table, row, fresh = false) => changes.push({ table, row, fresh });
  const comment = state.comment && { ...state.comment };
  const proposal = state.proposal && { ...state.proposal };
  const edit = state.edit && { ...state.edit };
  const checkpoint = state.checkpoint && { ...state.checkpoint };
  let on = null, answer, status = 200, textBytes = 0;
  // A monotonically increasing comment timestamp makes waits deterministic
  // when several entries arrive in the same millisecond.
  const eventAt = comment && now <= comment.last_at ? millis(comment.last_at, 1) : now;
  // Only the agent's comment or reply sets asks, and only while the comment
  // waits for the user; any other entry empties it.
  function touchComment(author, extra = {}) {
    Object.assign(comment, { waits: (extra.state || comment.state) === "open" ? opposite(author) : null,
      last_at: eventAt, ...(author === "agent" ? { dismissed: 0 } : {}), asks: null, ...extra });
    if (comment.state !== "open" || comment.waits !== "user") comment.asks = null;
    put("comments", comment);
  }
  function part() {
    if (body.part && !(state.parts || []).includes(body.part)) fail("part_not_found");
  }
  function picture() {
    part();
    if (!state.picture) {
      const omitted=(state.leftOut||[]).find((row)=>row.part===body.part&&row.stage===body.stage);
      fail("picture_not_found",{why:omitted?.why||"not-drawn"});
    }
    return state.picture;
  }
  function discrepancy() {
    const row = need(state.discrepancy, "discrepancy");
    if (row.part !== body.part || !PICTURE_STAGES.includes(body.stage) || (body.stage === "05-erd" && row.compares !== "aggregate-table") ||
        (body.stage === "07-sitemap" && row.compares !== "read-model-screen")) fail("discrepancy_not_found");
    return row;
  }
  function claim(entry) {
    on = entry;
    const held = state.claims.find((row) => row.entry === entry && row.ends_at > now);
    if (kind === "agent" && held && held.session !== session) fail("claimed", { ends_at: held.ends_at });
  }
  function openProposal() {
    need(proposal, "proposal");
    if (proposal.state !== "open") fail("proposal_not_open", { state: proposal.state });
  }
  switch (name) {
    case "comment": {
      // Any of the 13 stages of a part that the snapshot holds, with or without
      // a picture: the version seen is the picture's, else the held commit.
      part();
      if (body.discrepancy) { discrepancy(); claim(body.discrepancy); }
      if (state.counts.comments >= 2000) fail("comment_limit", { limit: 2000 });
      const commit = body.commit || state.picture?.commit_id || state.held.default_commit;
      if (!commit) fail("invalid_request", { field: "commit" });
      const row = { id: entryId("nc_"), project, part: body.part, stage: body.stage, item: body.item,
        quote: body.quote || null, discrepancy: body.discrepancy || null, commit_id: commit,
        author: kind, text: body.text, state: "open", closed_as: null, waits: opposite(kind),
        asks: kind === "agent" ? body.asks || null : null, settled: 0, dismissed: 0, made_at: now, last_at: now };
      put("comments", row, true); textBytes = bytes(body.text, body.quote);
      status = 201; answer = E.comment(row); break;
    }
    case "reply": {
      need(comment, "comment"); claim(comment.id);
      if (comment.state === "closed" && kind === "agent") fail("comment_closed");
      if (state.replyCount >= 200) fail("reply_limit", { limit: 200 });
      const row = { comment: comment.id, seq: state.replyCount + 1, author: kind, text: body.text,
        settles: body.settles ? 1 : 0, made_at: eventAt };
      put("replies", row, true);
      touchComment(kind, { state: "open", closed_as: null, ...(kind === "user" ? { settled: row.settles } : { asks: body.asks || null }) });
      textBytes = bytes(body.text); status = 201; answer = { comment: E.commentState(comment), reply: E.reply(row) }; break;
    }
    case "recommended": {
      // API-159: the user takes what the agent's last entry asks, as API-119
      // with settles and, for a checkpoint, API-128 would. The reply, the
      // comment's last entry and the checkpoint take one time, so that a
      // second take finds them: the comment then waits for the agent after
      // the user's reply in the words for "as recommended", and a checkpoint
      // passed with that reply still stands.
      need(comment, "comment"); claim(comment.id);
      const last = state.lastReply, named = state.commentCheckpoint;
      if (comment.state === "open" && comment.waits === "agent" && last?.author === "user" && last.settles
          && last.made_at === comment.last_at && RECOMMENDED_WORDS.includes(last.text)) {
        const passed = named?.passed_at === last.made_at ? named : null;
        if (!passed || passed.state === "passed") {
          answer = { comment: E.commentState(comment), reply: E.reply(last), checkpoint: passed && E.checkpoint(passed), changed: false };
          break;
        }
      }
      if (comment.state !== "open" || comment.waits !== "user" || !["recommended", "checkpoint"].includes(comment.asks)) fail("not_recommended");
      const asksCheckpoint = comment.asks === "checkpoint";
      if (asksCheckpoint && comment.part && !(state.parts || []).includes(comment.part)) fail("part_not_found");
      if (state.replyCount >= 200) fail("reply_limit", { limit: 200 });
      const words = AS_RECOMMENDED[language] || AS_RECOMMENDED.en;
      const row = { comment: comment.id, seq: state.replyCount + 1, author: "user", text: words, settles: 1, made_at: eventAt };
      put("replies", row, true);
      touchComment("user", { state: "open", closed_as: null, settled: 1 });
      const passed = asksCheckpoint ? { id: entryId("nk_"), project, part: comment.part, stage: comment.stage, commit_id: state.held.default_commit,
        words, state: "passed", passed_at: eventAt, withdrawn_at: null, pull_request: null, pr_state: null, recorded_commit: null, comment: comment.id } : null;
      if (passed) put("checkpoints", passed, true);
      textBytes = bytes(words);
      answer = { comment: E.commentState(comment), reply: E.reply(row), checkpoint: passed && E.checkpoint(passed), changed: true }; break;
    }
    case "answered": {
      need(comment, "comment"); claim(comment.id);
      const changed = comment.state === "open";
      if (changed) touchComment(kind, { state: "closed", closed_as: "answered", waits: null, settled: 0, dismissed: 0 });
      answer = { comment: E.commentState(comment), changed }; break;
    }
    case "decision": {
      need(comment, "comment"); claim(comment.id);
      const row = { comment: comment.id, seq: state.decisionCount + 1, link: body.link, text: body.text || null, made_at: eventAt };
      put("decisions", row, true);
      touchComment(kind, { state: "closed", closed_as: comment.closed_as || "decided", waits: null, settled: 0, dismissed: 0 });
      textBytes = bytes(body.link, body.text); status = 201; answer = { comment: E.commentState(comment), decision: E.decision(row) }; break;
    }
    case "proposal": {
      const p = picture();
      if (body.comment) {
        need(comment, "comment");
        if (comment.part !== body.part || comment.stage !== body.stage) fail("comment_not_found");
      }
      if (body.discrepancy) discrepancy();
      const source = JSON.parse(p.source);
      // Membership follows the picture schema: board terms use `term`,
      // contexts, tables and screens use `id`. References to another item
      // (for example a foreign key's target) do not define that item here.
      const ids = new Set(body.stage === "01-domain"
        ? [...source.contexts.map((row) => row.id), ...source.aggregates.map((row) => row.term), ...source.read_models.map((row) => row.term)]
        : (body.stage === "05-erd" ? source.tables : source.screens).map((row) => row.id));
      const unknown = body.items.filter((id) => !ids.has(id) && !(body.adds || []).includes(id));
      if (unknown.length) fail("unknown_item", { items: unknown });
      if (body.comment) { claim(comment.id); if (comment.state === "closed") fail("comment_closed"); }
      if (body.discrepancy) claim(body.discrepancy);
      if (state.counts.proposals >= 500) fail("proposal_limit", { limit: 500 });
      const row = { id: entryId("np_"), project, part: body.part, stage: body.stage, commit_id: body.commit || p.commit_id,
        items: JSON.stringify(body.items), reason: body.reason, change: body.change, source_text: body.source_text || null,
        comment: body.comment || null, discrepancy: body.discrepancy || null, state: "open", made_at: comment ? eventAt : now, closed_at: null };
      put("proposals", row, true); if (comment) touchComment("agent");
      textBytes = bytes(body.reason, body.change, body.source_text); status = 201; answer = E.proposal(row, true); break;
    }
    case "withdraw-proposal": {
      need(proposal, "proposal"); if (proposal.comment || proposal.discrepancy) claim(proposal.comment || proposal.discrepancy);
      const changed = proposal.state !== "withdrawn";
      if (changed) {
        openProposal(); proposal.state = "withdrawn"; proposal.closed_at = now; put("proposals", proposal);
        if (comment && comment.state === "open") {
          const candidates = [{ author: comment.author, at: comment.made_at, dismissed: 0 }];
          if (state.lastReply) candidates.push({ author: state.lastReply.author, at: state.lastReply.made_at, dismissed: 0 });
          for (const other of state.threadProposals) if (other.id !== proposal.id && other.state !== "withdrawn") {
            candidates.push({ author: other.state === "open" ? "agent" : "user", at: other.closed_at || other.made_at, dismissed: other.state === "dismissed" ? 1 : 0 });
          }
          candidates.sort((a, b) => b.at.localeCompare(a.at));
          touchComment(candidates[0].author, { dismissed: candidates[0].dismissed });
        }
      }
      answer = { proposal: E.proposalState(proposal), changed }; break;
    }
    case "accept":
    case "dismiss-proposal": {
      openProposal();
      if (name === "accept" && state.counts.edits >= 500) fail("reflection_limit", { limit: 500 });
      proposal.state = name === "accept" ? "accepted" : "dismissed"; proposal.closed_at = comment ? eventAt : now; put("proposals", proposal);
      if (comment && comment.state === "open") touchComment("user", { dismissed: name === "dismiss-proposal" ? 1 : comment.dismissed });
      if (name === "accept") {
        const row = { id: entryId("ne_"), project, part: proposal.part, stage: proposal.stage, commit_id: proposal.commit_id,
          proposal: proposal.id, content: null, state: "pending", pull_request: null, closed_commit: null, made_at: now, changed_at: now, last_report: null };
        put("edits", row, true); answer = { proposal: E.proposalState(proposal), edit: E.edit(row) };
      } else answer = { proposal: E.proposalState(proposal), comment: comment ? E.commentState(comment) : null };
      break;
    }
    case "report-edit": {
      need(edit, "edit"); claim(edit.id);
      const last = edit.last_report && JSON.parse(edit.last_report);
      const changed = !sameReport(last, body);
      if (changed) {
        if (edit.state === "in-review" && body.event === "opened") fail("pull_request_reported", { pull_request: edit.pull_request });
        if (edit.state === "in-review" && ["merged", "closed"].includes(body.event) && edit.pull_request !== body.pull_request) fail("pull_request_mismatch", { pull_request: edit.pull_request });
        const pending = ["pending", "needs-user"].includes(edit.state);
        if (body.event === "opened" && pending) { edit.state = "in-review"; edit.pull_request = body.pull_request; }
        else if (body.event === "merged" && (pending || edit.state === "in-review")) { edit.state = "closed"; edit.pull_request = body.pull_request; }
        else if (body.event === "closed" && edit.state === "in-review") { edit.state = "pending"; edit.pull_request = null; }
        else if (body.event === "reflected" && pending) { edit.state = "closed"; edit.closed_commit = body.commit; }
        else if (body.event === "needs-user" && edit.state === "pending") edit.state = "needs-user";
        else fail("edit_state", { state: edit.state });
        edit.last_report = JSON.stringify(body); edit.changed_at = now; put("edits", edit);
      }
      answer = { edit: E.edit(edit), changed }; break;
    }
    case "dismiss-edit": {
      need(edit, "edit"); const changed = edit.state !== "dismissed";
      if (changed) {
        if (edit.state !== "needs-user") fail("edit_state", { state: edit.state });
        edit.state = "dismissed"; edit.changed_at = now; put("edits", edit);
      }
      answer = { edit: E.edit(edit), changed }; break;
    }
    case "checkpoint": {
      if (body.part && !(state.parts || []).includes(body.part)) fail("part_not_found");
      const row = { id: entryId("nk_"), project, part: body.part, stage: body.stage, commit_id: state.held.default_commit,
        words: body.words || null, state: "passed", passed_at: now, withdrawn_at: null, pull_request: null, pr_state: null, recorded_commit: null };
      put("checkpoints", row, true); status = 201; answer = E.checkpoint(row); break;
    }
    case "withdraw-checkpoint": {
      need(checkpoint, "checkpoint");
      if (checkpoint.recorded_commit) fail("checkpoint_recorded");
      const changed = checkpoint.state !== "withdrawn";
      if (changed) { checkpoint.state = "withdrawn"; checkpoint.withdrawn_at = now; put("checkpoints", checkpoint); }
      answer = { checkpoint: E.checkpoint(checkpoint), changed }; break;
    }
    case "report-checkpoint": {
      need(checkpoint, "checkpoint"); claim(checkpoint.id);
      const prState = { opened: "open", merged: "merged", closed: "closed" }[body.event];
      const changed = checkpoint.pr_state !== prState || checkpoint.pull_request !== body.pull_request;
      if (changed) {
        if (body.event === "opened") {
          if (checkpoint.state === "withdrawn") fail("checkpoint_withdrawn");
          if (checkpoint.pr_state === "open") fail("pull_request_reported", { pull_request: checkpoint.pull_request });
          if (checkpoint.recorded_commit) fail("checkpoint_state");
        } else {
          if (checkpoint.pr_state !== "open") fail("checkpoint_state");
          if (checkpoint.pull_request !== body.pull_request) fail("pull_request_mismatch", { pull_request: checkpoint.pull_request });
        }
        checkpoint.pull_request = body.pull_request; checkpoint.pr_state = prState; put("checkpoints", checkpoint);
      }
      answer = { checkpoint: E.checkpoint(checkpoint), changed }; break;
    }
    default: throw new Error("unknown write name");
  }
  if (state.space.text_bytes + textBytes > 8 * 1024 * 1024) fail("space_full", { limit: 8 * 1024 * 1024 });
  return { changes, textBytes, on, status, body: answer };
}

export function entryDisposition(row, type) {
  const closed = type === "comment" ? row.state !== "open" : type === "discrepancy" ? row.state !== "open" :
    type === "edit" ? ["closed", "dismissed"].includes(row.state) : !E.listedCheckpoint(row);
  const held = type === "edit" ? row.state === "in-review" : type === "checkpoint" && row.pr_state === "open";
  return { closed, held: held ? row.pull_request : null };
}
