# NEXUS: work breakdown

[한국어](nexus.ko.md)

Stage 10 of CORTHEX’s own project. Status: plan approved with repository split and standalone server on 2026-11-04; execution in progress. English is the source; the Notion databases follow it (`truth: source`). Implementation is authorized now on `codex/nexus-0.2`; the maintainer may adjust this plan while the first trials and migrations proceed. Main merge, production transition and release tags follow the conditional approval below; every release gate must pass first.

Inputs: [functional spec](../04-functional-spec/nexus.md), [schema](../05-erd/nexus.md), [API contract](../06-api/nexus.md), [screens](../08-screens/nexus/README.md), [mockups](../09-mockup/nexus/README.md) and their Notes for later stages. All 01–09 checkpoints passed on 2026-11-03. SPEC-134 and SPEC-142 stay phase ②; the tables retain their future fields.

## How to read this file

`ID` is permanent, starting at TASK-201. `Task` is one independently testable slice. `From` names its SPEC/REQ. `Touches` names its interfaces, data or screens. `Depends on` must finish first; named C1/PR gates are external prerequisites. `Owner: agent` means the implementing Codex, with account operations delegated to Aside on this host. `Estimate` is changed code plus meaningful tests: S about 300 lines, M about 800, L about 2,000; split a larger slice before starting it. `Done when` is evidence another reviewer can check. `Status` is todo, in progress, done (#N), or removed (date), preserving IDs.

A request task is done only when each response it lists has a passing test; development API evidence, mock UI evidence, automated page checks and visual review are reported separately. A task that awaits cross-OS/live evidence remains in progress. Every commit runs AGENTS.md checks. Each bundle targets the integration branch and merges only after all-checks and code/security reviews.

Current plan: 64 tasks (S 7, M 47, L 10). The [QA plan](../12-qa/nexus.md) retains710 original cases from acceptance criteria, named responses, command outcomes, screen states and cross-cutting scenarios, plus seven distinct endpoint-specific examples from the0.2.1 applicability correction (717 current cases).

## Repository split and standalone server

| ID | Task | From | Touches | Depends on | Owner | Estimate | Done when | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TASK-255 | Extract and verify both histories | REQ-124, SPEC-104–SPEC-140, decision of 2026-11-04 | Product history/contracts/deployment | none | agent | M | Selected historical paths and bytes/modes match; old/new commit and branch maps, qualified references, preserved WIP and full-history public scans are recorded. | done |
| TASK-256 | Establish product ownership and pinned hub bridge | REQ-124, SPEC-104–SPEC-140, decision of 2026-11-04 | Product history/contracts/deployment | TASK-255 | agent | M | Root metadata and project sources are valid; an exact clean hub pin supplies upstream fixtures; real hub/server bridge and template-copy checks pass. | done |
| TASK-257 | Configure product CI and repository guards | REQ-124, SPEC-104–SPEC-140, decision of 2026-11-04 | Product history/contracts/deployment | TASK-256 | agent | M | Linux server/build/all existing contract/bridge/public-history jobs pass behind all-checks; secret scanning, push protection and PR/check protection are verified. | done |
| TASK-258 | Redirect the upstream harness to the product | REQ-124, SPEC-104–SPEC-140, decision of 2026-11-04 | Product history/contracts/deployment | TASK-257 | agent | M | One upstream PR removes only migrated paths, keeps hub/core/tests, updates shared guidance/CI/dependabot and the draft, with paired-pin compatibility evidence. | done (kodonghui/corthex#102) |
| TASK-259 | Run Node HTTP and transactional SQLite | REQ-124, SPEC-104–SPEC-140, decision of 2026-11-04 | Product history/contracts/deployment | TASK-256 | agent | L | The native-module runtime matches D1 result shapes and atomic batches; persistence/migrations/limits/HEAD and process restart pass without added runtime packages. | done |
| TASK-260 | Verify origin assertions behind Tunnel | REQ-124, SPEC-104–SPEC-140, decision of 2026-11-04 | Product history/contracts/deployment | TASK-259 | agent | M | Standalone verifies signature/issuer/audience/time and both author kinds without ctx.access; Worker still requires its checked context; Access policy is unchanged. | done |
| TASK-261 | Deploy isolated development over SSH | REQ-124, SPEC-104–SPEC-140, decision of 2026-11-04 | Product history/contracts/deployment | TASK-260 | agent | M | Loopback-only dedicated user/folders/systemd and Tunnel serve development with restart and rollback; real values stay outside Git, keys stay on their devices, other services are unchanged. | done |
| TASK-262 | Back up and restore the database | REQ-124, SPEC-104–SPEC-140, decision of 2026-11-04 | Product history/contracts/deployment | TASK-259, TASK-261 | agent | M | Daily and pre-migration/deploy consistent backups, explicit retention and permissions are tested; one restored copy is reopened and data/behavior compared. | done |
| TASK-263 | Rehearse production data migration and rollback | REQ-124, SPEC-104–SPEC-140, decision of 2026-11-04 | Product history/contracts/deployment | TASK-262 | agent | L | Production D1 is exported read-only into an isolated development copy; migrations and restore are compared by counts/digests, with old Worker/D1 preserved and no production address/data switch. | done |
| TASK-264 | Repeat development contracts and performance on OVH | REQ-124, SPEC-104–SPEC-140, decision of 2026-11-04 | Product history/contracts/deployment | TASK-261, TASK-262 | agent | M | Schemathesis, both real Access identities and maximum1MB push processing/memory are measured; server processing is under 1s; full-view mobile evidence remains TASK-224/238/251. The1s processing interval starts after complete body receipt and ends when response handling completes; arrival/round trip are separate references. | done |

## Server

| ID | Task | From | Touches | Depends on | Owner | Estimate | Done when | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TASK-201 | Trial both Access identities | SPEC-113, SPEC-116 | API-101–API-104 | none | agent | M | Real development Access returns presence/absence of ctx.access, aud, sub, email and common_name for both identities; document the selected verifier before authentication code. | done (kodonghui/corthex#92) |
| TASK-202 | Preserve the phase-1 database as migration 1 | SPEC-114 | TBL-101, TBL-113 | none | agent | S | An empty and an existing phase-1 database acquire migration 1 atomically; existing snapshot bytes and revisions remain unchanged. | done (kodonghui/corthex#91) |
| TASK-203 | Apply schema migration 2 | SPEC-114 | TBL-101–TBL-113 | TASK-202 | agent | M | Migration output and nexus.sql agree on tables, columns, primary/foreign keys, indexes and CHECK constraints; concurrent/failing migration retries leave no partial schema. | done (kodonghui/corthex#91) |
| TASK-254 | Persist reflection report identity | SPEC-133 | TBL-109, API-126 | TASK-203 | agent | S | Migration 3 preserves schema-2 entries and stores only internal last-report metadata; a repeated closed report differs from an invalid first closed report, even after write IDs expire. | done |
| TASK-204 | Validate snapshot 0.2 and picture sources | SPEC-104, SPEC-105, SPEC-109, SPEC-110, SPEC-114 | API-105, TBL-114 | TASK-203 | agent | M | Both snapshot versions and every source shape meet the frozen contract, UTF-8 and limits; unknown snapshot fields survive and picture sources are separated from stored snapshots. | done |
| TASK-205 | Store guarded pushes and held commits | SPEC-111, SPEC-112, SPEC-114, SPEC-117, SPEC-118, SPEC-140 | API-105, API-109, TBL-101–TBL-104, TBL-110 | TASK-204, TASK-206 | agent | L | All API-105/API-109 responses pass, including interleaved push batches, repository binding, same/older times, unchanged pictures and recorded checkpoints; overtaken pushes write no rows. | done |
| TASK-206 | Pair pictures and reconcile discrepancies | SPEC-120, SPEC-121 | TBL-103, TBL-104 | TASK-204 | agent | M | All five mismatch kinds, removed terms, explicit none/exemptions, waiting pictures, reopening and 1,000-open limits match SPEC-120/121 with deterministic pair keys. | done |
| TASK-207 | Remove projects with a dry run | SPEC-115 | API-108, API-110, TBL-101–TBL-112 | TASK-205 | agent | S | Every response is checked; the dry run reports bounded IDs and totals; removal leaves no project row in any table. | done |
| TASK-208 | Read spaces, pictures, overviews and entries | SPEC-119, SPEC-123, SPEC-127, SPEC-130, SPEC-133, SPEC-138, SPEC-140 | API-106, API-107, API-111, API-112, API-114–API-117 | TASK-205 | agent | L | Each listed response and HEAD is tested; totals, ordering and limits match the contract, and full proposal text appears only in its own read. | done |
| TASK-209 | Verify Access and dispatch paths and roles | SPEC-113, SPEC-116 | API-101–API-132 | TASK-201 | agent | M | Use the real-trial decision; wrong app/kind, path/method/origin and session refusals follow the contract order and change no data. | done |
| TASK-210 | Return Problem Details and safe trace logs | SPEC-113 | API-101–API-132 | TASK-209 | agent | S | Every emitted error code exists in OpenAPI; status, fields, safe detail and traceId match; only error kind and traceId reach logs. | done |
| TASK-211 | Create item and picture comments | SPEC-126, SPEC-128 | API-118, TBL-105 | TASK-208, TASK-221 | agent | M | All API-118 responses and acceptance criteria pass, including missing items, quote requirement, picture version, quotas and UTF-8 text bytes. | done |
| TASK-212 | Reply, settle, mark answered and reopen | SPEC-127, SPEC-128, SPEC-132 | API-119, API-120, TBL-105, TBL-106 | TASK-211 | agent | M | All response variants pass; only a user reopens a closed comment and may settle it; waits, dismissed and claim renewal remain correct. | done |
| TASK-213 | Record a decision and close its comment | SPEC-132 | API-121, TBL-105, TBL-107 | TASK-212 | agent | S | Every response passes; an agent records the user's decision with a safe HTTPS link, closing an open comment atomically and preserving a closed comment's state. A session decision need not have a prior settling reply. | done |
| TASK-214 | Create and withdraw proposals | SPEC-130 | API-122, API-123, TBL-108 | TASK-211, TASK-221 | agent | M | All response variants cover targets, additions, source text, one answer target, limits, claims and idempotent withdrawal. | done |
| TASK-215 | Accept or dismiss proposals | SPEC-131 | API-124, API-125, TBL-108, TBL-109 | TASK-214 | agent | M | All responses pass; a user acceptance creates exactly one pending reflection, quotas are atomic and dismissing updates the waiting comment. | done |
| TASK-216 | Report or dismiss reflections | SPEC-133 | API-126, API-127, TBL-109 | TASK-215, TASK-254 | agent | M | Every state/event/PR combination and response is checked, including repeat reports, mismatched PR, needs-user and claim release. | done |
| TASK-217 | Read the ordered agent to-do | SPEC-135, SPEC-136, SPEC-140 | API-113 | TASK-208, TASK-216, TASK-220 | agent | M | Every response, group ordering, totals, waits, mine/taken and in-review holds match the contract for two sessions. | done |
| TASK-218 | Claim and release work for a session | SPEC-136 | API-131, API-132, TBL-111 | TASK-221 | agent | M | Every response passes for two sessions, expiry, renewal, closed entries and reported PR holds; a failed claim is never queued. | done |
| TASK-219 | Pass and withdraw stage checkpoints | SPEC-139 | API-128, API-129, TBL-110 | TASK-208, TASK-221 | agent | M | Every response passes, including no default commit, missing parts/stages, repeated withdrawal and recorded checkpoints. | done |
| TASK-220 | Report checkpoint record PRs and warnings | SPEC-140 | API-130, TBL-110 | TASK-219 | agent | M | Every report response passes; withdrawal during review remains actionable, and an incorrectly merged record creates checkpoint-withdrawn until corrected. | done |
| TASK-221 | Keep writes atomic and replay for seven days | SPEC-126–SPEC-133, SPEC-136, SPEC-139, SPEC-140 | TBL-102, TBL-111, TBL-112 | TASK-203, TASK-209, TASK-210 | agent | L | Each write batch gates mutations on a newly accepted ID, claim/state/quota checks; replay returns the original status/body; expiry and concurrent duplicate submissions change data once. | done |
| TASK-222 | Serve HTML refusal pages and code securely | SPEC-113, SPEC-119, SPEC-138 | API-101–API-104 | TASK-209, TASK-210 | agent | M | Browser Accept gets the localized one-message HTML page; APIs/code retain Problem Details; all headers, HEAD and content-digest code caching pass. | done |

## Trials

| ID | Task | From | Touches | Depends on | Owner | Estimate | Done when | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TASK-223 | Measure maximum push processing and memory on OVH | SPEC-114, SPEC-118, SPEC-121 | REQ-081, REQ-124, API-105 | TASK-205 | agent | M | Record server processing time and memory on OVH development for synthetic1,000,000 bytes,3,000 items,2,000 checks,3 pictures; processing is under 1s. Preserve the earlier Workers 83ms result. The1s processing interval starts after complete body receipt and ends when response handling completes; arrival/round trip are separate references. | done |
| TASK-224 | Trial mobile editors, CSP and Worker size | SPEC-119 | REQ-146–REQ-149, API-104 | TASK-222 | agent | L | Pin editors/React and licenses; serve all code/fonts through Worker; record gzip/raw sizes, current free Worker limit, CSP and 20 mobile/4G openings, P95 <=3 seconds for 300 elements or seek the maintainer decision. | done |

## Hub

| ID | Task | From | Touches | Depends on | Owner | Estimate | Done when | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TASK-225 | Read default-branch Git objects and group parts | SPEC-104, SPEC-105 | API-133, TBL-114 | none | agent | M | Branch/uncommitted changes cannot enter pictures; canonical origin, default commit/time, longest part prefix and each omission/check are tested without executing hooks/filters. | done |
| TASK-226 | Parse DDD boards and timelines | SPEC-106 | API-133, TBL-114 | TASK-225 | agent | M | English/Korean template fixtures and NEXUS itself yield contexts, rows/policies, aggregates/read models/terms, dependencies, hotspots and all five ordered timeline lanes. | done |
| TASK-227 | Parse ERD SQL picture sources | SPEC-107 | API-133, TBL-114 | TASK-225 | agent | M | Template SQL and nexus.sql preserve column types/nullability, primary/unique/foreign keys, partial indexes, contexts/terms and without_table exemptions. | done |
| TASK-228 | Parse nested sitemap picture sources | SPEC-108 | API-133, TBL-114 | TASK-225 | agent | M | Template YAML and nexus.yaml preserve parents, paths/access/flows/status, contexts/terms/none, without_screen and partial-source checks using standard-library Python. | done |
| TASK-229 | Read stage records from default branch | SPEC-109 | API-133, TBL-115, TBL-116 | TASK-225 | agent | M | Part-specific records override device status, invalid records stay unknown with checks, fallback is explicit and done needs a dated checkpoint. | done |
| TASK-230 | Apply settings, redaction and snapshot limits | SPEC-104, SPEC-110 | API-133, TBL-114 | TASK-226, TASK-227, TASK-228, TASK-229 | agent | M | Snapshot 0.2 and all five new check families pass; default ask_before equals the core example; largest-first whole-picture omission precedes item/check truncation; no paths/secrets leave fixtures. | done |
| TASK-231 | Write repository stage records with status | SPEC-109, SPEC-137, SPEC-140 | API-134, TBL-115 | TASK-229 | agent | M | Every status outcome passes for parts/fallback, list checkpoints and NEXUS links; atomic LF JSON writes preserve another part and never commit or push. | done |
| TASK-232 | Push by ancestry and remove after dry run | SPEC-111, SPEC-112, SPEC-115 | API-136, API-137 | TASK-230, TASK-233, TASK-234 | agent | M | All command outcomes pass for no held snapshot, same/child/ancestor/diverged/missing commits, equal parent-child times, replace-held and protocol 0.1 refusal. | done |
| TASK-233 | Provide safe HTTP, session and JSON outcomes | SPEC-128, SPEC-135 | API-136–API-150 | none | agent | M | No redirect is followed, only configured URLs/projects receive tokens, session/text/file inputs are validated/redacted and outcomes/exit codes match the contract. | done |
| TASK-234 | Persist and drain the seven-day outbox | SPEC-129 | API-150, TBL-117 | TASK-233 | agent | M | Each outcome, retry status, token/network failure, expiry, permanent refusal, oldest-first stop and two-hub exclusive lock is tested; queued files contain no credentials. | done |
| TASK-235 | Implement the agent commands and references | SPEC-127–SPEC-133, SPEC-135, SPEC-136, SPEC-140 | API-138–API-149 | TASK-233, TASK-234 | agent | L | Every documented command/result has a test; OutboxFile request names agree with OpenAPI; snapshot.md, reading.md and hub skill describe 0.2. | done |

## Views

| ID | Task | From | Touches | Depends on | Owner | Estimate | Done when | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TASK-236 | Generate CSS properties from frozen tokens | SPEC-119, SPEC-123, SPEC-138 | SCR-101, SCR-104–SCR-109 | none | agent | S | Resolver order applies base then selected theme; properties cover both themes and each color/length used by the new UI; recomputed contrast pairs are recorded. | done |
| TASK-237 | Extend the hub page for NEXUS 0.2 | SPEC-123, SPEC-124, SPEC-125 | API-101, API-135, SCR-101, SCR-104 | TASK-236, TASK-208, TASK-230 | agent | M | Parts, pictures, counts, pending/withdrawn checkpoints, ask_before and empty-server guidance match every state; local page stays offline and copied HTML agrees. | done |
| TASK-238 | Draw read-only pictures with fallback lists | SPEC-119 | API-102, API-104, API-111, SCR-105 | TASK-224, TASK-236 | agent | L | Prism-driven states render all three sources deterministically; editor failure preserves the accessible item list and size-stable named marks; pan/zoom remain within the frame. | done |
| TASK-239 | Show the five DDD board steps | SPEC-141 | SCR-105 | TASK-238 | agent | M | Timeline/context-derived five layouts match mockups, first/last controls and absent timeline work, and step hash opens/restores without saving positions. | done |
| TASK-240 | Build item and comment panels | SPEC-126, SPEC-127, SPEC-132 | API-114, API-118–API-120, SCR-106, SCR-107 | TASK-238, TASK-243 | agent | M | Each state follows its mock response, hashes open/close panels, reply/reopen/settled states work at both widths and full proposal text is not loaded early. | done |
| TASK-241 | Build proposal and reflection panels | SPEC-130, SPEC-131, SPEC-133 | API-115, API-116, API-124, API-125, API-127, SCR-108 | TASK-238, TASK-243 | agent | M | All proposal/reflection states and stale races match Prism; accept/dismiss re-read data and display PR/reflection status with text safely. | done |
| TASK-242 | Build the stage overview and checkpoints | SPEC-138, SPEC-139, SPEC-140 | API-103, API-112, API-128, API-129, SCR-109 | TASK-236, TASK-243 | agent | M | All overview states, recorded state plus unrecorded checkpoint, withdrawal and warning states follow the contract at both widths. | done |
| TASK-243 | Keep drafts, IDs and request recovery | SPEC-126, SPEC-127, SPEC-131, SPEC-139 | SCR-105–SCR-109 | TASK-236 | agent | M | Requests use manual redirects and 30-second aborts; draft plus write ID survives reload, lost responses replay once, opaqueredirect/401 preserve text and stale writes reload safely. | in progress |

## Core after C1

| ID | Task | From | Touches | Depends on | Owner | Estimate | Done when | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TASK-244 | Read agent work from entry and stage skills | SPEC-112, SPEC-135, SPEC-136 | REQ-181, REQ-185, plugins/corthex | C1 0.2.0 tag, PR C, PR D (kodonghui/corthex#83), TASK-235 | agent | M | Merge latest main first; once/session/project to-do reads prioritize explicit user work, absent tokens do not stop work and claims/holds are respected. | done |
| TASK-245 | Teach stage records, reflection and timeline steps | SPEC-106, SPEC-132, SPEC-133, SPEC-137, SPEC-140 | REQ-086, REQ-131, REQ-154, REQ-167, REQ-168, REQ-212 | TASK-244, TASK-231 | agent | M | Update stage references, stage-contract where needed, hub stage table and template-reading tests together; write work/checkpoints by PR and verify standing before merge. | done |
| TASK-246 | Document project parts and ask_before | SPEC-110, SPEC-137 | plugins/corthex, .corthex/project.json, TBL-115 | TASK-244 | agent | S | After PR C, align parts/ask_before and sitemap terms/status. Under the approved source split, upstream declares memory and the product nexus; preserve verified MEMORY states and unknown/missing records. | done |

## Integration

| ID | Task | From | Touches | Depends on | Owner | Estimate | Done when | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TASK-247 | Prepare versions, guides and architecture | SPEC-113, SPEC-137 | REQ-126, manifests, README pairs, NOTICE | TASK-245, TASK-246, TASK-237, TASK-242 | agent | M | NEXUS 0.2.0 and next main core version agree in both manifests/all skill metadata; bilingual guides describe dev, migrations and server-first upgrades; no production deploy/tag. | done |
| TASK-253 | Reconcile main and hand over release evidence | SPEC-104–SPEC-141 | docs/10-wbs/nexus.md, docs/12-qa/nexus.md, draft PR | TASK-247, TASK-249, TASK-250, TASK-251, TASK-252 | agent | M | Source tasks/results and Notion agree; latest-main checks name the exact tree; release proceeds under the 2026-11-04 conditional approval only when every gate passes. List remaining issues and bundle PRs; first repository upload still requires REQ-107 confirmation. | done |

## QA

| ID | Task | From | Touches | Depends on | Owner | Estimate | Done when | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TASK-248 | Run pinned contract validation and mocks | SPEC-113–SPEC-140 | API-101–API-132 | TASK-222 | agent | M | External pinned validator 0.7.1, Prism 5.16.0 and Schemathesis 3.39.16 hooks cover Access cookie/path/header substitutions; live development contract run names commit and mock-only results separately. | done |
| TASK-249 | Fire every named server response | SPEC-104–SPEC-140 | API-101–API-132 | TASK-217, TASK-218, TASK-220, TASK-248 | agent | L | Each named example is reproduced on development where feasible, with schema/code/effect checked; default/internal mock cases remain counted apart. | done |
| TASK-250 | Verify hub commands on three operating systems | SPEC-104–SPEC-140 | API-133–API-150 | TASK-231, TASK-232, TASK-235 | agent | M | Python 3.8 and latest matrix on Windows/macOS/Linux passes all command outcomes and preserves no-network/no-token fixture isolation. | done |
| TASK-251 | Walk flows and all screen states | SPEC-119, SPEC-123–SPEC-141 | FL-101–FL-114, SCR-101–SCR-109 | TASK-237, TASK-239, TASK-240, TASK-241, TASK-242, TASK-249 | agent | L | Browser testers record role/path/commit and evidence for 320/1440, both themes/languages; page checks and image review are separate; working browser paths become CI e2e tests. | in progress |
| TASK-252 | Record performance and own-project cross-check | SPEC-106, SPEC-107, SPEC-108, SPEC-119, SPEC-120 | REQ-124, REQ-149 | TASK-223, TASK-224, TASK-251 | agent | M | Record raw 20-opening measurements/P95, Worker/editor code sizes and maximal push metrics; synthetic plus local NEXUS self-picture check passes without an unauthorized repository upload. | done |

## Outcomes

The server rows name every declared response. The QA cases also distinguish the named examples of each response; mock-only internal failures are never counted as live passes.

| Interface | Request | Responses | Test-writing task |
| --- | --- | --- | --- |
| API-101 | GET / | 200, 403, default | TASK-237 |
| API-102 | GET /pictures/{project}/{part}/{stage} | 200, 403, 404, default | TASK-238 |
| API-103 | GET /overview/{project}/{part}/{stage} | 200, 403, 404, default | TASK-242 |
| API-104 | GET /code/{file} | 200, 403, 404, default | TASK-222 |
| API-105 | POST /api/snapshots | 200, 400, 403, 409, 413, 415, default | TASK-205 |
| API-106 | GET /api/snapshots | 200, 403, default | TASK-208 |
| API-107 | GET /api/snapshots/{project} | 200, 403, 404, default | TASK-208 |
| API-108 | DELETE /api/snapshots/{project} | 200, 403, 404, default | TASK-207 |
| API-109 | GET /api/snapshots/{project}/held | 200, 403, 404, default | TASK-205 |
| API-110 | GET /api/snapshots/{project}/removal | 200, 403, 404, default | TASK-207 |
| API-111 | GET /api/spaces/{project}/pictures/{part}/{stage} | 200, 403, 404, default | TASK-208 |
| API-112 | GET /api/spaces/{project}/overview/{part}/{stage} | 200, 403, 404, default | TASK-208 |
| API-113 | GET /api/spaces/{project}/todo | 200, 400, 403, 404, default | TASK-217 |
| API-118 | POST /api/spaces/{project}/comments | 201, 400, 403, 404, 409, 413, 415, default | TASK-211 |
| API-114 | GET /api/spaces/{project}/comments/{comment} | 200, 403, 404, default | TASK-208 |
| API-119 | POST /api/spaces/{project}/comments/{comment}/replies | 201, 400, 403, 404, 409, 413, 415, default | TASK-212 |
| API-120 | POST /api/spaces/{project}/comments/{comment}/answered | 200, 400, 403, 404, 409, default | TASK-212 |
| API-121 | POST /api/spaces/{project}/comments/{comment}/decisions | 201, 400, 403, 404, 409, 413, 415, default | TASK-213 |
| API-122 | POST /api/spaces/{project}/proposals | 201, 400, 403, 404, 409, 413, 415, default | TASK-214 |
| API-115 | GET /api/spaces/{project}/proposals/{proposal} | 200, 403, 404, default | TASK-208 |
| API-123 | POST /api/spaces/{project}/proposals/{proposal}/withdraw | 200, 400, 403, 404, 409, default | TASK-214 |
| API-124 | POST /api/spaces/{project}/proposals/{proposal}/accept | 200, 400, 403, 404, 409, default | TASK-215 |
| API-125 | POST /api/spaces/{project}/proposals/{proposal}/dismiss | 200, 400, 403, 404, 409, default | TASK-215 |
| API-116 | GET /api/spaces/{project}/edits/{edit} | 200, 403, 404, default | TASK-208 |
| API-126 | POST /api/spaces/{project}/edits/{edit}/report | 200, 400, 403, 404, 409, 413, 415, default | TASK-216 |
| API-127 | POST /api/spaces/{project}/edits/{edit}/dismiss | 200, 400, 403, 404, 409, default | TASK-216 |
| API-128 | POST /api/spaces/{project}/checkpoints | 201, 400, 403, 404, 409, 413, 415, default | TASK-219 |
| API-117 | GET /api/spaces/{project}/checkpoints/{checkpoint} | 200, 403, 404, default | TASK-208 |
| API-129 | POST /api/spaces/{project}/checkpoints/{checkpoint}/withdraw | 200, 400, 403, 404, 409, default | TASK-219 |
| API-130 | POST /api/spaces/{project}/checkpoints/{checkpoint}/report | 200, 400, 403, 404, 409, 413, 415, default | TASK-220 |
| API-131 | POST /api/spaces/{project}/claims/{entry} | 200, 400, 403, 404, 409, default | TASK-218 |
| API-132 | DELETE /api/spaces/{project}/claims/{entry} | 200, 400, 403, 404, 409, default | TASK-218 |

| Interface | Command | Outcomes | Test-writing task |
| --- | --- | --- | --- |
| API-133 | snapshot | done; invalid CLI; failed | TASK-230 |
| API-134 | status | done; invalid CLI; failed | TASK-231 |
| API-135 | build | done; invalid CLI; failed | TASK-237 |
| API-136 | push | done; invalid CLI; failed; refused | TASK-232 |
| API-137 | remove | done; invalid CLI; failed; refused | TASK-232 |
| API-138 | todo | done; invalid CLI; failed; refused | TASK-235 |
| API-139 | comment | done; invalid CLI; failed; refused; kept | TASK-235 |
| API-140 | reply | done; invalid CLI; failed; refused; kept | TASK-235 |
| API-141 | answered | done; invalid CLI; failed; refused; kept | TASK-235 |
| API-142 | decide | done; invalid CLI; failed; refused; kept | TASK-235 |
| API-143 | propose | done; invalid CLI; failed; refused; kept | TASK-235 |
| API-144 | withdraw | done; invalid CLI; failed; refused; kept | TASK-235 |
| API-145 | reflect | done; invalid CLI; failed; refused; kept | TASK-235 |
| API-146 | record | done; invalid CLI; failed; refused; kept | TASK-235 |
| API-147 | show | done; invalid CLI; failed; refused | TASK-235 |
| API-148 | claim | done; invalid CLI; failed; refused | TASK-235 |
| API-149 | release | done; invalid CLI; failed; refused | TASK-235 |
| API-150 | outbox | done; invalid CLI; failed; refused; kept | TASK-234 |

## Decisions the tasks wait for

- TASK-209 waits for TASK-201’s real Access identity trial. If neither ctx.access nor verified JWT fields distinguish both identities, take the alternatives to the maintainer.
- TASK-238 waits for TASK-224’s mobile/editor and code-size trial. A required additional development dependency, changed editor choice, frozen token change or breached performance limit goes to the maintainer; independent server/hub work continues.
- TASK-244–TASK-247 wait for `corthex-memory--v0.2.0`, PR C and PR D (kodonghui/corthex#83) on main.
- TASK-253 waits for all QA evidence and the 2026-11-04 conditional-release gates. When every gate passes, the existing approval permits main merges, production transition and tags without another question. The first repository upload still follows REQ-107; deleting retained Worker/D1 resources requires its separate later decision.

## Choices this stage made

1. Keep source-first bilingual files named nexus.md and nexus.ko.md, with Korean Notion reading copies and one database row per task/case.
2. Keep server, hub, views, delayed core and QA slices separate so reviews remain small. Large slices are split before implementation if their measured change exceeds the scale.
3. Use synthetic projects throughout development. NEXUS’s own pictures are compared locally; uploading this repository waits for REQ-107.
4. Keep credentials on this host in the secret store/environment; Aside handles authorized account steps. No key, cookie or authentication file is copied to another device.
5. Keep the frozen 04 rows, 05 schema, 06 contracts and 09 tokens. Meaning-preserving clarifications are documented in both languages before code; breaking changes wait for the maintainer.

## For the checkpoint

Approved on 2026-11-04: the maintainer supplied the OVH answer and repository-split follow-up (A, move now), and confirmed “proceed with this plan” on the plan decision card in the working conversation. The original 54 tasks(S 7/M 39/L 8) plus TASK-255–264 make 64(S 7/M 47/L 10), with 710 QA cases. Order: split → product plans/contracts → standalone server → views → complete QA. Core follows C1/PR C/PR D; SPEC-134/142 stay phase②. The original final-confirmation requirement recorded at 08:08 KST was superseded by the maintainer's 14:21 KST conditional approval for main merges, production transition and tags. REQ-107 first upload and later retirement of rollback resources remain separate decisions. Message provenance and precise receipt times remain in private working records.

## Notes for later stages

### Stage 11: development

Use a branch per bundle based on codex/nexus-0.2, identify TASK/SPEC and tests/untested work, and keep design changes in the bundle PR. First push the integration branch, then open its main draft once source changes exist. Every completed task changes here in its finishing PR before the Notion board follows. Merge commits preserve bundle review history. Merge origin/main before shared-file work and before handover.

### Stage 12: QA

Run the [plan](../12-qa/nexus.md) on development behind Access. Record commit, environment and evidence for each pass. Browser testers walk every applicable phase-① flow; pin working paths in e2e CI. Keep live response counts, mock-only counts, page-check measurements and visual review separate. Release decision remains pending.

## Historical server foundation checkpoint

TASK-204–TASK-224 and TASK-254 are in progress. The server router and transactions have local tests and a synthetic development smoke run, but complete per-response contracts, the editor trial and screens remain. See the QA evidence; neither API provision nor screen acceptance is inferred from a test count.

Server foundation bundles kodonghui/corthex#91 (migrations), kodonghui/corthex#92 (Access) and kodonghui/corthex#93 (router/transactions) are merged into the development integration branch. PR kodonghui/corthex#93's final commit 5070de8 passed all three operating systems, Worker build, strict plugin validation, the external contract guard/corpus job and the aggregate check in workflow 41684359822; its review threads were resolved before merge commit c5e7308. Main release gates remain unchanged.

TASK-225–TASK-235 are in progress: the hub now has the 0.2 Git-object readers, picture parsers, repository status, ancestry checks, 18-command surface and fenced outbox in source. Boundary tests and external schema checks run locally; final review and the Python 3.8/latest three-OS matrix must pass before the bundle merges. No task is marked done from a prototype or a command-count assertion.

## Development checkpoint of 2026-11-04

The product contains the standalone server, three read-only picture views, the item/comment/proposal panels, stage overview and checkpoint actions (TASK-236–TASK-243). Browser payloads are built from the approved pinned packages with a complete NOTICE; server runtime dependencies remain zero. The linked hub UI is reviewed separately in kodonghui/corthex#103. The ownership cleanup is merged as kodonghui/corthex#102.

Local browser testing uses synthetic Access, the actual handler/Store and memory SQLite. Five portable pointer/draft/race regressions passed on the retained 03E31C and B17B3C artifacts. Twelve picture/viewport checks passed on 03E31C. Later discussion fixes and live OVH performance are separate runs; those earlier results do not certify them. Original fit/marker/locale/overflow failures and failed harness attempts are retained.

The independent API audit maps all 411 named examples without changing TC IDs. Example schemas pass, but actual handler named variants were observed for 232; the union with default controls is 270/411. There are 141 unobserved variants and eleven shared examples needing applicability clarification. Two portable tests add 47 successful/stateful and 138 authorization/header requests across all 32 operations, with database immutability checks. These are request counts, not additional fully passed TC rows.

The 8CC00C artifact passed 120 Node tests, nine Python bridge/public checks, Worker dry-run and all seven pinned external checks. Standalone Schemathesis exercised 32 operations, with 154/154 responses passing each of five checks. Mock/fixture evidence is distinct from the live Access trial and origin migration rehearsal. Later UI changes are rechecked before their commit.

Development deployment is isolated. Core changes still wait for MEMORY C1, PR C and PR D on main. Main merge, production address/data switch, release tags, first real repository upload and old-resource retirement remain the release decision.


## Frozen view bundle checkpoint

The final CAF432 UI is reproduced and passes Python9/Node121/Worker/external7 plus34 exact-artifact portable browser paths. API named evidence is now355 handler variants/393 union;18 generic examples are scoped separately. Screen and API implementation is present; tasks remain in progress until their finishing integration PR and remaining live/state acceptance checks. The linked hub3570fb0 has17 green CI jobs and no code/security findings. [Scoped QA](../12-qa/runs/2026-11-04-product-development.md) retains earlier failures, the48-combination F260 matrix and current screenshots. No core gate or release decision is bypassed.

## OVH validation checkpoint

The finishing PR records extraction, exact hub/CI/protection, native runtime/real identities and origin recovery/rehearsal evidence. Performance, final view acceptance and SSH rollback remain separate. [QA](../12-qa/runs/2026-11-04-ovh-validation.md)

## Development delivery, 2026-11-04

The server, hub and phase-① browser implementation is integrated. The independent final source audit found no additional missing product function within the approved scope. Remaining in-progress acceptance rows must not be read as a claim that all710 cases passed. TASK-244–247 are still the explicitly gated core work; direct editing/workshops remain phase②. The actual development deployment is30f7957 with unchanged CA4 payloads. TASK-261 is done: immutable deploy, old/new runtime rollback, unchanged logical data in13 tables, and a restart that left22 other service PIDs/start times unchanged.

The actual human session completed three success flows with seven writes: comment/reply/Answered/reopen, accept→pending reflection, and checkpoint pass→withdraw. API readback matched; this is development evidence, distinct from local fixtures and from the complete state matrix. The proxy hint experiment did not meet the mobile target and its zone-wide switch and owned server hint/metrics settings were restored. [Final scoped QA](../12-qa/runs/2026-11-04-ovh-validation.md) retains all failed samples and the final default-setting run. Main/release and first real-project upload remain the final decision.

Task states at ce6875a: done 12, in progress 46, todo 6.

## Transport, measurement and release decision of 2026-11-04

The maintainer approved edge caching of public content-hashed code, styles and fonts at the same configured origin (REQ-147). HTML, API, project data and refusals remain no-store. Code has no Set-Cookie or Vary:*, with unchanged CSP and whole-host Access. Even a cached object must not reach unauthenticated GET/HEAD callers. An edge HIT does not visit the origin, so origin verification is not claimed on every HIT.

REQ-124 server processing runs from complete body receipt to response handling completion. Body arrival, client round trip, process CPU windows and RSS remain separate. The existing31.085ms passes1s; the historical inclusive1031.079ms stays recorded.

The maintainer conditionally approved NEXUS merges, production migration/routing and release tags after REQ-149/124 pass, all710 cases have verdicts with zero Must failures, migration/recovery rehearsals pass, core integrates after C1 release/PR C, and required checks plus Code/Security reviews pass. The first repository snapshot still needs REQ-107 confirmation. Preserve the old Worker/D1 for14days after switching and ask before deletion. If a condition remains, ask once with its numbers and release after the answer.

Historical transport-bundle states: done 14, in progress 44, todo 6.

## First picture decision, 2026-11-04

The maintainer explicitly selected “SVG first + HTML path improvement” in the current Codex conversation. Keep the frozen tokens, same-origin Access boundary and pinned real editors. A complete server-rendered SVG is the first picture; Excalidraw/ERD Viewer loads afterwards. REQ-149/TC-654/TC-1271/TC-1309 measure this first visible picture under the unchanged mobile/network/CPU1 profile. Record native-editor readiness separately, keeping all earlier native-ready failures and any failed/incomplete observations. Do not use a DOM-ready marker alone as evidence of a visible, readable picture.

The preview uses the same deterministic geometry and checked source as the editor, with safe text/fragment links and no SVG scripts, foreign content or external resources. It stays visible during editor loading and remains available with the item list when that loading fails. Core controls keep the current viewport when handing over to the real editor. Loading preserves the frame and surrounding layout. Distinguish first-preview and native-editor-ready states and timings.

Trusted static view CSS may be inlined so a stylesheet request does not block the preview. HTML, SVG project content and API data remain no-store; hashed code/style/fonts retain the approved Access-protected public immutable cache. The standalone server may negotiate bounded built-in HTML compression to reduce Tunnel transfer. No project data is placed in a public code file or cache. Neither this decision nor a preview is a release, first real-repository upload, or approval to delete Worker/D1. Existing conditional-release gates remain.

Earlier TASK-250 checkpoint:59 remaining CLI outcomes had methods preserving their original TC IDs. Windows Python3.8/3.13 each59/59; new Linux/macOS CI was then pending.65 scoped backend partial verdicts and first-SVG findings are retained in the [QA bundle](../12-qa/runs/2026-11-04-acceptance-audit.md).

Earlier checkpoint evidence: core0.7 candidate d997b688/PR120, full1039/15existing skips/strict4/source Code-Security0. CLI62 pass/16 remaining clauses, actual-model/own-repository/mobile60 and Brotli transport evidence are in [scope record](../12-qa/runs/2026-11-04-acceptance-scopes.md). Tasks64=done14/in progress50/todo0; release follows the existing conditions.

Current64 tasks: done15/in progress49/todo0. TASK-250 exact original78 CLI criteria now have individual named evidence; the remaining16 completed six hosted OS/Python cells in PR122. Full1057/strict4 and bounded source reviews passed. Mobile3s remains unmet; TASK-252/253 remain in progress. [Final evidence](../12-qa/runs/2026-11-04-mobile-final.md). No main/production/tag approval is inferred.

## Keep the 3s target, 2026-11-04

In the performance-decision card in this working conversation, dated 2026-11-04 with client timezone Asia/Seoul, the maintainer selected “3초 유지·개선 계속 (추천)” (keep the 3s target and continue improvement). The exact response time is unverified. This approves continued investigation and improvement while retaining the 3s requirement. The 64 tasks remain 15 done and 49 in progress; TASK-252/253 stay in progress, with no new stage10 checkpoint recorded.

The [transport investigation proposal](../12-qa/runs/2026-11-04-transport-investigation.md) separates connection/TLS, headers/body, CDP network shaping, protocol and compression before choosing a small fix, regression checks and a new 20×3 formal run. Root selects the diagnostic arms after tool review. Diagnostic observations do not replace the existing failures. Conditional release, REQ-107, 14-day Worker/D1 retention followed by a deletion question, and the ban on new paid plans/dependencies remain in force.

## Diagnostic follow-up, 2026-11-05 KST / 2026-11-04 UTC

After decision record e750509, the separate Node16 and Chrome18 transfer diagnostics finished and returned zero owned processes. Node retained 16 valid transfers but only 13 cache-comparable observations; Chrome retained 18 diagnostic-qualified observations. The [follow-up record](../12-qa/runs/2026-11-04-transport-investigation.md) and [safe manifest](../12-qa/runs/transport-2026-11-05/manifest.json) keep their scope, hashes and the read-only Cloudflare findings. These are transfer observations, not a new 3s/P95 or release verdict. The 64 task rows remain 15 done and 49 in progress, with TASK-252/253 still in progress.

The actual-module6 follow-up is being implemented offline and has not received Root GO. Current ownership is recorded in the follow-up: Root owns server/Cloudflare/branch/gates; UI owns the runner and other tool files; API owns only `module-wire.mjs`; QA owns records and independent audit. No checkpoint, latency exception or original release/REQ-107/Worker-D1 condition changes.

## Preserved M01/v5 and prospective v6, 2026-11-05 KST / 2026-11-04 UTC

The preceding preparation status is retained history. M01 subsequently observed 5 of 6 planned openings and stopped after slot5 cleanup was unverified; slot6 remained unstarted. The later owned-process0 receipt does not erase that failure. The v5 run then completed all60 openings and verified cleanup60/60, but its original qualification remained DDD17/20, ERD17/20 and sitemap16/20, with every normative P95 null. Of10 invalid openings,9 were cache-only and1 also had an actual code520/resource failure. The exact second opening of each stage separately verified all44 code responses as200/EOF/HIT+Age/approved-policy/cookie-only. These are scoped cache observations, not a new task completion or3s verdict. [Evidence and plan](../12-qa/runs/2026-11-04-transport-investigation.md).

Root identified an added test condition: downstream editor-code HIT/Age had been used to qualify the first complete SVG, although REQ-149/TC-1271/SPEC-119 measure first SVG and native readiness separately. A new prospective v6 will retain3s,20 openings per stage, the original mobile4G/300/auth/CSP/security/200-completion/90s/cleanup criteria, recording cache status and Age separately. Existing v5 and older raw data, plans, verdicts and task rows stay unchanged. This is Root's test correction, not a new user approval or latency exception; v6 is preparation only and awaits its own review/gate. Tasks64 remain15done/49in progress, with no stage checkpoint or release promotion.

## v6 stopped-run record, 2026-11-05 KST / 2026-11-04 UTC

The subsequent authorized v6 retained all60 planned slots:29 observed,1 setup failure and30 not started. Original DDD/ERD/sitemap qualification is9/10/9 of20, every normative P95 is null and exit1/fail remains. Slot26 had a setup command timeout; slot30's cleanup was unverified with1 process remaining. The later OS receipt returned owned Chrome0/Node0 and retained30 profiles without reclassifying either failure. [Result and safe hashes](../12-qa/runs/2026-11-04-transport-investigation.md).

Setup/cleanup causes remain unproved. A separate lifecycle diagnostic is being prepared offline; no target diagnostic execution, v7 formal result or new user approval is recorded. Root kept metrics OFF and Cloudflare settings unchanged. Tasks64 remain15done/49in progress; the3s, release/REQ-107 and Worker/D1 conditions remain pending and unchanged.

## Current refusal closure, 2026-11-05

[R1](../12-qa/runs/2026-11-05-refusal-closure.md) adds245 current synthetic-handler6f scoped passes from exact fresh refusal responses and same-request schema/headers/trace/DB/receipt evidence. QA710 is now486pass/222partial/2fail. TASK-249 remains in progress with78 applicable named-response clauses and18 shared-example applicability reviews; no task closes. WBS64 stays15done/49in progress. Original performance/transport failures and release/REQ-107/Worker-D1 conditions remain; no real Access, deployed proof or new user checkpoint is claimed.

## Current named-read closure, 2026-11-05

The later [24-case read adjudication](../12-qa/runs/2026-11-05-read-closure.md) brings QA710 to510 pass/198 partial/2 fail. TASK-249 stays in progress with54 applicable named-response criteria and18 shared-example applicability reviews; all64 WBS rows and15 done/49 in progress remain unchanged. The local actual-handler GET evidence includes operation-specific policy/schema and same-request whole DB/receipt preservation. It adds no HEAD, default SSR, hub-parser, browser or deployed/real Access claim; old R1/transport/performance verdicts and release/REQ-107/Worker-D1 gates remain. Full required checks, Code/Security review and publication are pending under Root.

## Original-criterion evidence, 2026-11-05

The later [R3 source record](../12-qa/runs/2026-11-05-original-criteria.md) adds8 scoped passes:4 distinct new criteria and4 exact reused replies. Source QA710 is518 pass/190 partial/2 fail. All64 WBS rows and15 done/49 in progress stay unchanged; no task closes. Parser data, literal ALTER/control differences and local role/state refusals keep their precise limits. Old results/269-row Notion evidence and stage/release/3s/REQ-107/Worker-D1 conditions remain. Root owns required checks/publication and the separate8-row Notion follow-up.

## Later API/Job-formal evidence, 2026-11-05

The [later source record](../12-qa/runs/2026-11-05-api-two-job-formal-r2.md) accepts TC787/1052 from retained exact-request proof and records one stopped v7-r2 formal attempt. QA710 is520 pass/188 partial/2 fail; every64 WBS row stays unchanged at15 done/49 in progress,with no task closed. E1 still has52 partial criteria plus18 separately unadjudicated shared examples. The formal run has37 qualified openings out of60 planned and no normative P95; original failures and all release/3s/REQ-107/Worker-D1 conditions remain. No new execution or approval is inferred from this record.

## 2026-11-05: formal mobile gate, scoped evidence

Prospective v8 current906/D802 completed each300-node Korean picture20 times under the unchanged original mobile4G/CPU1 profile. First-SVG rank19 is DDD1399.2ms,ERD1327.2ms,sitemap1357.3ms;60 security/strict cleanup proofs are present. Native-ready P95 is2784/2686/2873.9ms and native-paint opportunity3159.5/2721.7/3067ms,kept separate. Original CTX012/320-frame/script-title/response/no-effect clauses and existing TC1128 capture are mapped in the [scope record](../12-qa/runs/2026-11-05-svg-mobile-v8.md). QA is524pass/186partial/0fail;all64 task rows remain15done/49in progress. No task is closed by this metric;other release conditions,REQ107 first-upload consent and the Worker/D1 retention/deletion conditions remain.


## 2026-11-05: eleven evidence-backed task closures

Only TASK-204/224/225/226/227/228/230/233/234/235/254 are now done after their original finishing conditions were matched to retained actual evidence. The current 64 tasks are 26done/38in progress. The other 53 rows, every ID, finishing condition, other column and earlier history are preserved. TASK-244/245/246/247/252 and the remaining partial clauses stay open. All 710 QA rows and their 524pass/186partial/0fail verdicts are unchanged. The [clause-specific record](../12-qa/runs/2026-11-05-wbs-closure.md) adds no execution, whole-product acceptance or release approval. Migration/recovery and other release gates, first real-repository upload, and Worker/D1 retention/deletion conditions remain separate.


## 2026-11-05: actual-default own-picture closure

TASK-252 is now done after its remaining actual-default local self-picture clause was checked without source overlays or an upload. Current64 tasks are27done/37in progress; the other63 whole rows and all original non-status columns/history remain. The [source-specific record](../12-qa/runs/2026-11-05-own-main.md) separates new local static/in-memory evidence from retained v8, code sizes and historical maximal-push metrics. QA710 remains524pass/186partial/0fail, with no live-role/UI or whole-product acceptance added. First real-repository upload and old Worker/D1 deletion keep their separate confirmations.

## 2026-11-05: postrelease acceptance classification

The [single classification table](../12-qa/runs/2026-11-05-postrelease-closeout.md) covers the original37 in-progress tasks:17 are evidence-backed done,20 retain exact remaining acceptance, and no whole unimplemented task was found within those37. All64 original rows now have44 done/20 in progress; only those17 status cells changed. TASK-244–247 and TASK-253 are included. Original finishing conditions, IDs, other columns and history remain. QA is626 pass/84 partial/0 fail. Phase2 FL-115/116 remains unstarted; no production deployment/upload or host plugin update is included.

## NEXUS 0.2.1 completion conditions (2026-11-06 KST)

Of 64 tasks, 62 are done and 2 are in progress. The closeout links the completion conditions to their evidence and preserves their previous statuses. Phase 2 is on hold. [Closeout](../12-qa/runs/2026-11-05-patch-021-closeout.md)

## NEXUS 0.2.2 editor patch (2026-11-06 KST)

The patch fixes whole-picture fit for the tall sitemap and the Windows browser runner. The development transport investigation leaves BUG-562 open. The Phase 2 editor note is available for design review. [Patch evidence](../12-qa/runs/2026-11-06-patch-022-editor.md) · [Editor memo PR](https://github.com/kodonghui/corthex-nexus/pull/47)

## NEXUS 0.2.3 screen patch (2026-11-06 KST)

The patch makes the current screens readable within their structure: folded hub checks with Korean texts, ask-before matching, stage records with evidence, item-less DDD contexts in a row, the wheel scrolling the page, and words in place of field and reason codes. The hub plugin change is [kodonghui/corthex#155](https://github.com/kodonghui/corthex/pull/155). The picture-first redesign follows as its own work. [Patch evidence](../12-qa/runs/2026-11-06-patch-023-screens.md)
