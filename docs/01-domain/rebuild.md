---
synced_at: 2026-11-17T07:57:32.339Z
---

# NEXUS rebuild: domain discovery

[한국어](rebuild.ko.md)

Status: Steps 0, 1-a and 1-b are AI drafts. Checkpoint 1 is pending. Steps 2–9 and stages 02–13 have not started. No previous checkpoint is approval of this rebuild.

## 1. Service overview

The maintainer's brief of 2026-11-17 asks for a public, general-purpose product in which one person can run multiple projects, see all thirteen stages' artifacts visually, discuss individual items with AI and personally pass checkpoints. Existing code and decisions are reference material. The rebuild starts from that purpose.

The maintained production service stays in place until the new version passes QA and is deployed. Existing project snapshots, comments and checkpoints must survive through migration or an authorized repush. Republishing source snapshots alone cannot recover server-only discussion or approval records.

## 2. Event storming

- Human view: a new rebuild column on the existing Miro board. Private board/frame links are kept in the project's Notion records, outside this public repository.
- Frames authored: Step 0 purpose and scope; Step 1-a event collection; Step 1-b timeline and checkpoint questions. Earlier columns remain unchanged.
- Way of working: draft and correct, the skill default. Stop after Steps 1-b, 7 and 9. A stage-level request at the first stop does not finish stage 01.
- Sync: the board leads the workshop. This document transcribes the reread timeline. After the last checkpoint, changes go to the source first, then the board.
- Human participation: no human approval of this column has been received or recorded. Human board edits/comments have not been independently counted; no claim of approval as drawn is made.
- Confidence: `[sure]` is supported by the brief; `[inferred]` is AI interpretation; `[guess]` remains an open hotspot. These labels are translated on the Korean board.
- NEXUS: part `rebuild` records this cycle. Part `nexus` preserves the legacy artifacts and approval history. The current renderer needs agreed CTX headings before it can draw a domain picture; none is fabricated before the boundary checkpoint. The checkpoint request must open the Miro timeline first and explicitly disclose the absent rebuild picture.

## 3. Event timeline

The order and alternatives below are transcribed from Step 1-b. Rows are independent lanes; this is not yet a user-flow or API contract. The board has 21 event candidates, copied from Step 1-a into this timeline.

| Lane | Events |
| --- | --- |
| Project connection | Project connected [inferred] → First upload consent recorded [sure] → Snapshot published [sure] → Snapshot updated [sure] |
| Stage review | Stage draft written [sure] → Draft merged [sure] → Stage artifact published [sure] → Checkpoint requested [sure] → Checkpoint passed or changes requested [inferred] |
| Item discussion | Item question recorded [sure] → AI response recorded [sure] → Decision recorded [inferred] → Revised artifact published [inferred] |
| Version review | New version published after approval [inferred] → New version review requested [guess] → New version checkpoint passed [guess] |
| Data migration and release | Existing data backed up [inferred] → Existing data restored [sure] → QA result recorded [sure] → New version deployed or current version kept [sure] → Previous version restored after failed validation [inferred] |

The last event of the release lane is conditional on failed validation after a switch. Keeping the current production version is a deliberate release outcome, not a new deployment. Stage 02 must define which outcomes need durable audit records.

Excluded reads: opening a project list or picture, searching, and switching projects. These change no domain data by themselves. Authentication, authorization and failure responses still need requirements in stage 02; exclusion from the event timeline does not remove them from the product.

## 4. Contexts, commands and glossary

No CTX or TERM ID is assigned in this checkpoint-1 draft. Context boundaries belong to Step 7, after the timeline is reviewed. Commands, aggregates, policies, read models, context tables and the context map are not drafted or approved yet. New IDs must continue after the highest existing project ID; legacy IDs are never reused or renumbered.

Provisional vocabulary: project, stage, artifact, snapshot, item discussion, checkpoint, version, session and migration. Their definitions will be agreed in the domain glossary before later stages use them. Screens, field names, dependencies and implementation architecture are undecided.

## 5. Open hotspots for checkpoint 1

1. Coverage: use the maintainer's independent checklist of thirteen stages, item-level AI discussion, user-only checkpoints, multiple projects and existing-data preservation. Recommended A: start from the five lanes and decide direct editing, team collaboration and external-tool integration in stage 02. Alternative B: add one of them as a required lane now. The checklist is not a market survey.
2. Changed artifacts after approval: recommended A preserves the previous approval as history and requests a new checkpoint for a new content version. Alternative B carries the previous approval forward. The two `[guess]` events depend on this answer. The change threshold remains a stage-02 question.
3. Public scope is settled by the maintainer's brief: build a general-purpose public product in which each user can manage their own projects. Do not request approval of that direction again. Account, hosting and signup options remain stage-02 work; no subscription or multitenant architecture is assumed approved.

The first two items are open questions with recommendations; the third records the existing brief. No recommendation is a decision or a checkpoint pass. The checkpoint request asks only for the timeline; answers to the open choices should be recorded separately.

## 6. Reference decisions and supersession

- The 2026-11-17 brief replaces reuse of the existing implementation and approvals as the basis of the new design. Prior sources and `.corthex/stages/nexus.json` remain historical evidence; `.corthex/stages/rebuild.json` starts without checkpoints.
- The legacy private-device scope is background for the currently running service. The public-product scope must be decided afresh in stage 02, without changing production access controls now.
- Legacy frozen tokens and phase order do not choose this rebuild's stage-09 direction. Stage 09 must use `corthex-uxui`, compare multiple candidates, select one, cover light and dark themes and commit working HTML to the repository before its checkpoint.
- Legacy mockup HTML exists in `docs/09-mockup/nexus/mockup.html`. The brief reports an incomplete gray Artifact experience. File existence and historical approvals do not establish completeness or approval for the rebuild; evaluate the actual coverage at stage 09.
- [PR 50](https://github.com/kodonghui/corthex-nexus/pull/50), [PR 53](https://github.com/kodonghui/corthex-nexus/pull/53) and [PR 56](https://github.com/kodonghui/corthex-nexus/pull/56) were read as background. This work neither changes PR 56 nor owns its deployment.

## 7. Checks and next action

The board was reread after each authored frame. Its 21 event candidates, five lane orderings, alternatives, confidence labels and open questions were checked against this source. Korean board text and the paired document passed the core skill's `term-check.py`. The repository checks are reported in the pull request; none is a live migration rehearsal or full product QA.

Next: merge and push this draft, request checkpoint 1 for part `rebuild`, and wait for the maintainer's NEXUS pass. Then read the board and NEXUS again before Step 2. Checkpoints 2 and 3 still follow; stage 02 cannot start until stage 01's required checkpoints are passed and recorded.
