---
synced_at: 2026-11-17T09:14:13.274Z
---

# NEXUS rebuild: domain discovery

[한국어](rebuild.ko.md)

Status: checkpoint 1 of the new timeline passed in NEXUS on 2026-11-17. Steps 2–9 are not authored or approved. The maintainer explicitly requested proceeding to stage 02 after this pass; its missing context/glossary inputs remain visible. Legacy checkpoints are not approval of this rebuild.

## 1. Service overview

The maintainer's brief of 2026-11-17 asks for a public, general-purpose product in which one person can run multiple projects, see all thirteen stages' artifacts visually, discuss individual items with AI and personally pass checkpoints. Existing code and decisions are reference material. The rebuild starts from that purpose.

The maintained production service stays in place until the new version passes QA and is deployed. Existing project snapshots, comments and checkpoints must survive through migration or an authorized repush. Republishing source snapshots alone cannot recover server-only discussion or approval records.

## 2. Event storming

- Human view: a new rebuild column on the existing Miro board. Private board/frame links are kept in the project's Notion records, outside this public repository.
- Frames authored: Step 0 purpose and scope; Step 1-a event collection; Step 1-b timeline and checkpoint questions. Earlier columns remain unchanged.
- Way of working: draft and correct, the skill default. Stop after Steps 1-b, 7 and 9. A stage-level request at the first stop does not finish stage 01.
- Sync: the board leads the workshop. This document transcribes the reread timeline. After the last checkpoint, changes go to the source first, then the board.
- Human participation: the maintainer passed the timeline in NEXUS and approved both recommendations. The exact words and times are recorded below. Human board edits/comments have not been independently counted.
- Confidence: the original draft used `[sure]`, `[inferred]` and `[guess]`. After the human pass, the approved timeline labels were removed; Step 1-a and Git history preserve the draft. Approval of the two version-review events follows the separate recommendation answer.
- NEXUS: part `rebuild` records this cycle. Part `nexus` preserves the legacy artifacts and approval history. The current renderer needs agreed CTX headings before it can draw a domain picture; none is fabricated before the boundary checkpoint. The checkpoint request must open the Miro timeline first and explicitly disclose the absent rebuild picture.

## 3. Event timeline

The order and alternatives below are transcribed from Step 1-b. Rows are independent lanes; this is not yet a user-flow or API contract. The board has 21 event candidates, copied from Step 1-a into this timeline.

| Lane | Events |
| --- | --- |
| Project connection | Project connected → First upload consent recorded → Snapshot published → Snapshot updated |
| Stage review | Stage draft written → Draft merged → Stage artifact published → Checkpoint requested → Checkpoint passed or changes requested |
| Item discussion | Item question recorded → AI response recorded → Decision recorded → Revised artifact published |
| Version review | New version published after approval → New version review requested → New version checkpoint passed |
| Data migration and release | Existing data backed up → Existing data restored → QA result recorded → New version deployed or current version kept → Previous version restored after failed validation |

The last event of the release lane is conditional on failed validation after a switch. Keeping the current production version is a deliberate release outcome, not a new deployment. Stage 02 must define which outcomes need durable audit records.

Excluded reads: opening a project list or picture, searching, and switching projects. These change no domain data by themselves. Authentication, authorization and failure responses still need requirements in stage 02; exclusion from the event timeline does not remove them from the product.

## 4. Contexts, commands and glossary

No CTX or TERM ID is assigned in this checkpoint-1 draft. Context boundaries belong to Step 7, after the timeline is reviewed. Commands, aggregates, policies, read models, context tables and the context map are not drafted or approved yet. New IDs must continue after the highest existing project ID; legacy IDs are never reused or renumbered.

Provisional vocabulary: project, stage, artifact, snapshot, item discussion, checkpoint, version, session and migration. Their definitions will be agreed in the domain glossary before later stages use them. Screens, field names, dependencies and implementation architecture are undecided.

## 5. Resolved timeline questions

1. Coverage: the maintainer approved recommendation A. Start from the five lanes and decide direct editing, team collaboration and external-tool integration in stage 02. The independent checklist was the supplied thirteen stages, item-level AI discussion, user-only checkpoints, multiple projects and data preservation; it was not a market survey.
2. Changed artifacts after approval: the maintainer approved recommendation A. Preserve the previous approval as history and request a new checkpoint for a new content version. The two `[guess]` events are now supported by that decision. The change threshold remains stage-02 work.
3. Public scope is settled by the maintainer's brief: build a general-purpose public product in which each user can manage their own projects. Do not request approval of that direction again. Account, hosting and signup options remain stage-02 work; no subscription or multitenant architecture is assumed approved.

The first two recommendations are now human decisions; the third remains the original product direction. The timeline pass does not approve contexts, tables or implementation choices that were not presented.

## 6. Reference decisions and supersession

- The 2026-11-17 brief replaces reuse of the existing implementation and approvals as the basis of the new design. Prior sources and `.corthex/stages/nexus.json` remain historical evidence; `.corthex/stages/rebuild.json` started empty and now records only the verified timeline pass.
- The legacy private-device scope is background for the currently running service. The public-product scope must be decided afresh in stage 02, without changing production access controls now.
- Legacy frozen tokens and phase order do not choose this rebuild's stage-09 direction. Stage 09 must use `corthex-uxui`, compare multiple candidates, select one, cover light and dark themes and commit working HTML to the repository before its checkpoint.
- Legacy mockup HTML exists in `docs/09-mockup/nexus/mockup.html`. The brief reports an incomplete gray Artifact experience. File existence and historical approvals do not establish completeness or approval for the rebuild; evaluate the actual coverage at stage 09.
- [PR 50](https://github.com/kodonghui/corthex-nexus/pull/50), [PR 53](https://github.com/kodonghui/corthex-nexus/pull/53) and [PR 56](https://github.com/kodonghui/corthex-nexus/pull/56) were read as background. This work neither changes PR 56 nor owns its deployment.

## 7. Checks and next action

The board was reread after each authored frame. Its 21 event candidates, five lane orderings, alternatives, confidence labels and open questions were checked against this source. Korean board text and the paired document passed the core skill's `term-check.py`. The repository checks are reported in the pull request; none is a live migration rehearsal or full product QA.

Next: record the verified pass and recommendation answers through a PR and push them. The current follow-up explicitly says `그다음 02 PRD로 넘어가고`; this authorizes preparing stage 02 while disclosing that new context boundaries, CTX/TERM IDs, tables and a context map are missing inputs. Keep stage 01 in progress and do not infer approval of those missing outputs. This specific sequencing instruction replaces the earlier default wait before any stage-02 preparation.

## 8. Checkpoint 1 and decisions

- Timeline checkpoint `nk_n9aja7yrtm1q`: passed on 2026-11-17 at 08:19:16.314 UTC, bound to commit `5a19cd264b73fd2b02d8ff371e391ff5e0660bdf`. The maintainer's original words were `01단계 확인 지점 통과`. This is preserved as quoted evidence rather than adopted terminology.
- Coverage comment `nc_hvjv377v757w`: recommendation A approved with `추천 모두 승인` at 08:19:46.997 UTC.
- Version comment `nc_ayya1yv8g3bc`: recommendation A approved with `추천 모두 승인` at 08:19:50.363 UTC, repeated at 08:19:55.036 UTC. The repeated answer is one decision.
- The NEXUS checkpoint and full comments were read before the source update. Private approval addresses stay in project records; the repository record points here and retains the NEXUS checkpoint ID. The pass must still be checked immediately before merge.
