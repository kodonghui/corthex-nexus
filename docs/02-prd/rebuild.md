# NEXUS rebuild: product requirements

[한국어](rebuild.ko.md)

Status: scope-review draft 0.1, 2026-11-17. No rebuild PRD checkpoint has passed. The next stop is scope freeze; version freeze follows as a separate human checkpoint before stage 03.

## 1. Product and evidence

NEXUS is a public, general-purpose workspace for one person to run several projects: see each project's thirteen stages visually, discuss individual items with AI, and personally pass checkpoints. The five accepted event lanes are project connection, stage review, item discussion, version review, and migration/release. These are product goals, not a decision to reuse the current implementation.

Sources: B1 is the maintainer's rebuild brief of 2026-11-17; C1 is the passed timeline and two accepted recommendations in [stage 01](../01-domain/rebuild.md); F1 is the follow-up instruction of the same date (proceed to PRD, merge/push before review, repair CI and automate its setup); P1 is a new proposal in this PRD, requiring scope review. Source labels describe provenance, not approval of every derived requirement.

The latest instruction explicitly authorizes stage 02 after the timeline checkpoint. New context boundaries, CTX/TERM definitions, commands, aggregates, tables and a context map are still missing. Context is therefore `none (pending)` throughout; no legacy context is assigned by guess. Resolve these inputs before version freeze and before dependent design. Stage 01 remains in progress. Provisional terms use the accepted timeline's vocabulary.

Legacy sources, code, and PRs [50](https://github.com/kodonghui/corthex-nexus/pull/50), [53](https://github.com/kodonghui/corthex-nexus/pull/53), [56](https://github.com/kodonghui/corthex-nexus/pull/56) are reference evidence only. The new batch starts at REQ-301, after the existing maximum REQ-295; unused numbers are not reused definitions. Part `rebuild` records this cycle. Legacy `nexus` approvals are preserved and do not approve these rows.

## 2. Release scope proposed for review

The first release covers the five lanes, the thirteen stage views, source-linked discussion, human-only version-bound checkpoints, safe synchronization, account/project isolation, light and dark themes, and verified migration/recovery. A public service with individual accounts is the recommendation for delivery, not a decided authentication provider, pricing plan or server architecture.

Stage views cover: domain events/context map; PRD rows; user-flow diagrams; functional-spec rows; ERD; OpenAPI review; sitemap; all screen states; committed interactive HTML mockups; WBS; development/PR evidence; browser QA evidence; and presentation. Unsupported or missing representations need an explicit state rather than an empty success indicator. Domain-board and diagram authoring tools are chosen at their own stages.

Direct artifact editing inside NEXUS, team/shared-project permissions, and extra external-tool integrations are proposed for a later release. The first release still supports several AI sessions on one person's projects, source-controlled changes, the existing hub, and source links to required stage tools. The five-lane approval did not settle these three scope choices.

## 3. Requirements

All rows are `draft`. Must denotes required first-release behavior if scope is accepted; Should denotes a negotiable target. No row's priority or status is an automatic approval. Each row contains one EARS response. Context assignments remain an explicit input gap.

| ID | Requirement | Type | Priority | Context | Source | Status |
| --- | --- | --- | --- | --- | --- | --- |
| REQ-301 | When an authenticated user opens NEXUS, the system shall list only projects that user may access. | functional | Must | none (pending) | B1 | draft |
| REQ-302 | When a user switches projects, the system shall restore the selected project's own stage and discussion context. | functional | Must | none (pending) | B1 | draft |
| REQ-303 | When a user opens a project, the system shall show the current state of all thirteen stages. | functional | Must | none (pending) | B1 | draft |
| REQ-304 | If a stage has no artifact, then the system shall identify that artifact as missing. | functional | Must | none (pending) | B1 | draft |
| REQ-305 | When a supported diagram artifact is published, the system shall provide a readable visual representation of its source. | functional | Must | none (pending) | B1 | draft |
| REQ-306 | When a non-diagram stage artifact is published, the system shall provide its stage-appropriate review view. | functional | Must | none (pending) | B1 | draft |
| REQ-307 | When a user opens a mockup artifact, the system shall make the committed HTML mockup available for review. | functional | Must | none (pending) | B1 | draft |
| REQ-308 | When a user inspects an artifact, the system shall show its source commit and source location. | functional | Must | none (pending) | C1 | draft |
| REQ-309 | When a user selects an artifact item, the system shall open a stable review address for that item. | functional | Must | none (pending) | B1 | draft |
| REQ-310 | When a user requests an item's source, the system shall open the matching source location of the displayed version. | functional | Should | none (pending) | P1 | draft |
| REQ-311 | When a user submits an item comment, the system shall bind that comment to the item and reviewed artifact version. | functional | Must | none (pending) | B1 | draft |
| REQ-312 | When an item comment requests an AI response, the system shall expose it in that project's AI work queue. | functional | Must | none (pending) | C1 | draft |
| REQ-313 | When an AI response is recorded, the system shall place it in the originating item's discussion. | functional | Must | none (pending) | B1 | draft |
| REQ-314 | When a discussion produces a decision, the system shall retain the decision with its supporting discussion and source change. | functional | Must | none (pending) | C1 | draft |
| REQ-315 | While an AI session holds an item claim, the system shall show that claim to other sessions working on the project. | functional | Should | none (pending) | P1 | draft |
| REQ-316 | When AI proposes an artifact change, the system shall present that change as a proposal until its source change is verified. | functional | Must | none (pending) | P1 | draft |
| REQ-317 | When an agent requests a checkpoint, the system shall bind the request to the published default-branch artifact version. | functional | Must | none (pending) | F1 | draft |
| REQ-318 | When an authorized user passes a checkpoint, the system shall record that user's decision for the reviewed version. | functional | Must | none (pending) | B1 | draft |
| REQ-319 | If an AI credential attempts to pass a checkpoint, then the system shall refuse that action. | functional | Must | none (pending) | B1 | draft |
| REQ-320 | While a required checkpoint is pending, the system shall keep dependent stages blocked for completion. | functional | Must | none (pending) | F1 | draft |
| REQ-321 | When a new content version follows an approved version, the system shall preserve the previous version's approval history. | functional | Must | none (pending) | C1 | draft |
| REQ-322 | When a new content version follows an approved version, the system shall require a fresh checkpoint for that new version. | functional | Must | none (pending) | C1 | draft |
| REQ-323 | When a user withdraws an approval, the system shall retain the withdrawal in the checkpoint history. | functional | Must | none (pending) | P1 | draft |
| REQ-324 | When an artifact changes only in review-display metadata, the system shall retain the content version's checkpoint state. | functional | Should | none (pending) | P1 | draft |
| REQ-325 | If a submitted source commit is not merged into the default branch, then the system shall refuse to publish it as the current project snapshot. | functional | Must | none (pending) | F1 | draft |
| REQ-326 | When a project is uploaded for the first time, the system shall require consent for that project's first upload. | functional | Must | none (pending) | B1 | draft |
| REQ-327 | When an automatic push finishes, the system shall report whether the target commit was actually held by NEXUS. | functional | Must | none (pending) | F1 | draft |
| REQ-328 | If an upload fails, then the system shall preserve a retryable result without reporting the snapshot as published. | functional | Must | none (pending) | P1 | draft |
| REQ-329 | If a received snapshot is older than the held default-branch snapshot, then the system shall refuse to replace the held snapshot. | functional | Must | none (pending) | P1 | draft |
| REQ-330 | The system shall keep credential values out of its logs, repository artifacts and user-facing receipts. | non-functional | Must | none (pending) | F1 | draft |
| REQ-331 | When an authorized operator configures push CI, the system shall obtain CI secret values from that session's environment. | functional | Must | none (pending) | F1 | draft |
| REQ-332 | If a user requests another user's private project data without permission, then the system shall refuse access. | functional | Must | none (pending) | B1 | draft |
| REQ-333 | When a person joins the public service, the system shall provide an account-scoped project onboarding flow. | functional | Must | none (pending) | P1 | draft |
| REQ-334 | When a user opens NEXUS without a saved theme preference, the system shall use the light theme. | functional | Must | none (pending) | B1 | draft |
| REQ-335 | When a user chooses a theme, the system shall retain that preference for later sessions on the same device. | functional | Must | none (pending) | P1 | draft |
| REQ-336 | The system shall support project review at viewport widths from 320 to 1440 CSS pixels without losing actions or text. | non-functional | Must | none (pending) | P1 | draft |
| REQ-337 | When a review screen is loading, empty, refused or failed, the system shall show the corresponding state and available next action. | functional | Must | none (pending) | B1 | draft |
| REQ-338 | The system shall meet WCAG 2.2 AA for the first release's review and checkpoint flows. | non-functional | Must | none (pending) | P1 | draft |
| REQ-339 | The system shall render project and stage review views within 2 seconds at P95 under the defined review-load profile. | non-functional | Should | none (pending) | P1 | draft |
| REQ-340 | The system shall acknowledge item-comment writes within 1 second at P95 under the defined discussion-load profile. | non-functional | Should | none (pending) | P1 | draft |
| REQ-341 | When an existing project snapshot is migrated or repushed, the system shall preserve its project and item identities. | functional | Must | none (pending) | B1 | draft |
| REQ-342 | When existing server discussions are migrated, the system shall preserve their authorship, order and version references. | functional | Must | none (pending) | B1 | draft |
| REQ-343 | When existing checkpoints are migrated, the system shall preserve their original decisions and reviewed-version references. | functional | Must | none (pending) | B1 | draft |
| REQ-344 | If release validation fails after a switch, then the system shall support recovery to the previous service with all acknowledged writes accounted for. | functional | Must | none (pending) | C1 | draft |
| REQ-345 | While the rebuilt version has not passed its release QA, the system shall keep the existing production service available. | functional | Must | none (pending) | B1 | draft |
| REQ-346 | The system shall pass a migration-and-recovery rehearsal covering every retained project before the production switch. | non-functional | Must | none (pending) | B1 | draft |
| REQ-347 | The system shall pass browser execution of every first-release user flow before release. | non-functional | Must | none (pending) | B1 | draft |
| REQ-348 | When demonstration data is used, the system shall keep it separate from a user's real project data. | functional | Should | none (pending) | P1 | draft |
| REQ-349 | If a source artifact contains executable or instruction-like untrusted content, then the system shall confine its effects to the approved artifact-viewing boundary. | non-functional | Must | none (pending) | P1 | draft |
| REQ-350 | When a new user starts without prior CORTHEX installation, the system shall provide a documented path to publish and review a sample project. | functional | Must | none (pending) | P1 | draft |

## 4. Acceptance boundaries and measurement

REQ-305 includes domain, flow, ERD and sitemap diagrams. REQ-306 covers PRD/spec/WBS lists, an OpenAPI view, screen-state review, QA evidence and presentation review. REQ-307 requires repository HTML for both themes; candidate selection and every-state coverage belong to stage 09. A browser preview must follow the content-isolation boundary of REQ-349; serving arbitrary active HTML with account/session authority is not approved.

REQ-308 shows source repository/path/commit and the artifact's content version. REQ-309's address remains meaningful after later uploads, including a clear removed-item state. REQ-311 preserves comments on removed or revised items. REQ-314 distinguishes a proposal, verified PR merge and actual NEXUS reflection. REQ-320 permits parallel preparation explicitly authorized by the user, while keeping dependent stage completion gated; it never grants an agent the checkpoint action.

The proposed REQ-324 threshold excludes theme preference, read receipts and visual layout from artifact content; an artifact-source or semantic relationship change creates a new content version under REQ-322. This threshold is decision Q3, not an approved hash algorithm. Checkpoint history identifies version, user decision and time; migration must not reinterpret it as current-version approval.

REQ-330 is checked with synthetic credentials against stdout/stderr, subprocess argv, local files and CI logs. GitHub Actions' encrypted secret store is the intended destination of CI setup, not a local plaintext copy. Actual configuration needs installed/authenticated gh; unavailable gh skips with one line. Workflow creation uses a PR and cannot pass a human checkpoint. The current harness task implements this integration independently of approval of the rebuilt product.

REQ-336 is measured at widths 320, 768 and 1440 in both themes, checking text, focus and controls; diagrams may pan/zoom within their own view. REQ-338 uses automated checks plus keyboard, focus, contrast and screen-reader review of every first-release flow. These accessibility and performance targets are proposed, not measured outcomes.

REQ-339's review-load profile is an isolated staging service behind the intended authentication boundary, with 100 projects, up to 3,000 items per project and 20 concurrent authenticated sessions. Measure browser navigation start to usable content across at least 200 warmed navigations, excluding neither authentication checks nor ordinary network time; record region/device/network and cold-start observations separately. REQ-340 uses the same staging boundary and 20 concurrent sessions, at least 200 comment submissions, measuring submit to durable-save acknowledgement; AI generation time is excluded and reported separately. Proposed targets require a recorded environment and raw results, not a local fixture timing.

REQ-341–343 require an inventory of all retained projects, including the three existing project collections, item IDs, content versions, comments/replies, authorship and checkpoint/pass/withdrawal records. Snapshot repush alone cannot reconstruct server-only discussions or approvals. Before a production switch, reconcile counts and stable IDs, validate version/parent references, and compare preserved record content with a protected server-side baseline. Do not copy real data or credentials into Git.

REQ-344 and REQ-346 require a consistent backup, restore into an isolated environment, write reconciliation during a controlled switch window, rollback procedure and a recorded rehearsal. A pre-switch backup alone does not account for writes accepted after the switch. REQ-345 keeps the current service unchanged until release QA passes. No new production access-control change is authorized by this draft.

REQ-347 means executing every first-release flow and its states in browser-agent QA, with light/dark, desktop/mobile and supported-browser coverage defined at stages 08/12. Fixtures and real-service observations are labeled separately. Human checkpoint tests use isolated synthetic data and never pass a real user's checkpoint. REQ-349 is measured by malicious text/link/HTML fixtures showing no execution outside the permitted preview, no credential access and no writes beyond the artifact boundary.

## 5. Scope questions

- Q1, public delivery: recommendation A is a public service with individual accounts and private projects (REQ-332/333/350). B is public source plus self-hosted individual installations for the first release, with hosted signup deferred. Either keeps the mandated public, general-purpose vision. Authentication provider, payment and infrastructure are later design decisions.
- Q2, editing/collaboration/integrations: recommendation A defers direct artifact editing, shared-team projects and extra tool integrations for the first release, retaining source-controlled updates and required stage-tool links. B adds named capabilities now; their requirements and impact must be drafted before scope freeze.
- Q3, changed-version threshold: recommendation A applies REQ-321/322 to content/semantic changes and REQ-324 to display-only metadata. B requires a new checkpoint for every source commit, including display-only changes. The earlier decision to preserve history and freshly review changed content stays in force.

## 6. Independent coverage check and supersession

The independent checklist is the cross-product of thirteen stage outputs, the five event lanes, human/AI/unauthorized actors, loading/empty/error/refused states, multiple simultaneous projects and migration/recovery. It is a requirements checklist independent of the old implementation, not market research. It found account isolation, absent-artifact states, stale uploads, removed-item discussion and post-switch write recovery; the rows above address them. Outstanding questions are Q1–Q3 and the missing new domain inputs. Ask for omissions once at scope freeze.

The old private-device/Access-only product scope is replaced by the public-product direction from the new brief; the running service retains its current controls until a validated release. Legacy editor trials, frozen mockup tokens, server choices and older phase approvals are not reused as rebuild approvals. The present GitHub CI setup work is separately authorized by F1 and does not select an application architecture. No existing requirement is deleted or marked superseded in the historical `nexus.md`; these are a new cycle's draft.

## 7. Checks and next checkpoint

Before publication, check unique IDs, paired translations, one EARS response per row, explicit type/priority/source/status, measurable NFRs, all fifty rows in the pinned hub snapshot, no unknown new IDs, and unchanged legacy artifacts. The 38 Must functional requirements have no stage-04 specification yet; record their exact req-without-spec warnings and reason rather than claiming complete traceability. The missing context links are checked manually as a separate gap. Automated checks do not demonstrate public signup, migration or product QA.

Publish a main-merged draft through the hub, verify the held commit and the fifty new items, then request scope freeze in NEXUS. Its current project-wide list also contains legacy rows: search the new batch using `REQ`, a hyphen and `3`. The Korean copy is the review translation; English remains the repository source. Scope is not frozen until the user passes its checkpoint. Next within stage 02: resolve responses and domain inputs, publish the resulting version, then request version freeze. Do not enter stage 03 before that pass.

