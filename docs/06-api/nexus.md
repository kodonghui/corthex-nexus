# NEXUS: requests, commands and formats

[한국어](nexus.ko.md)

Stage 06 of CORTHEX's own project, for NEXUS 0.2: the requests that the NEXUS server answers, in the OpenAPI contract [nexus.openapi.yaml](nexus.openapi.yaml), and in this file the rules that the contract follows, the hub's commands and the formats of the files that go with them. Status: drafted on 2026-11-02, while the memory plugin is being built, as the maintainer chose that day, on the recommendations of the user flows, the functional spec and the server's data. The maintainer passed its checkpoint on 2026-11-03, together with stages 03 to 05, 07 and 08, so the requests, the commands and the formats are frozen for NEXUS 0.2 before stage 10 plans the work: a later breaking change needs the maintainer's decision. The maintainer's choice of 2026-11-03 to hold stage 01's event storming in NEXUS added the optional `timeline` to the DDD board's picture source, a compatible change, and named the work board of phase ② beside editing; the maintainer passed both the same day ([For the checkpoint](#for-the-checkpoint)). The maintainer's redesign of 2026-11-06 plans the pages and requests API-151 to API-159 and changes to API-101 to API-103, API-118, API-119 and the hub's `comment` and `reply`, which the contract and the code take when the redesign is built; the changes to API-118, API-119 and the hub's commands are built ([The redesign's interfaces](#the-redesigns-interfaces)). Phase ②, editing on a PC and the workshops of stage 01, whose stages 01 to 04 passed on 2026-11-06 and 2026-11-07, plans the requests API-161 to API-173, the hub's commands API-174 to API-176 and changes to 0.2's and the redesign's interfaces, which the contract and the code take when phase ② is built, after the redesign ([Phase ②'s interfaces](#phase-②s-interfaces)). This stage's checkpoint for phase ②, with stage 05's, passed them at 09:33 KST on 2026-11-08 ([For the checkpoint](#for-the-checkpoint)). The contract is the source of every request, answer, example and error code that it holds; this file explains them and is the source of the rest. When this file and its Korean translation differ, this file is the source.

Inputs: the functional spec in [docs/04-functional-spec/nexus.md](../04-functional-spec/nexus.md) (SPEC-101 to SPEC-156, and SPEC-170 to SPEC-186 for phase ②), above all its [notes for stage 06](../04-functional-spec/nexus.md#stage-06-requests-commands-and-formats); the server's data and the files in [docs/05-erd/nexus.md](../05-erd/nexus.md) and [nexus.sql](../05-erd/nexus.sql) (TBL-101 to TBL-118, and TBL-119 to TBL-124 for phase ②), with their [notes for stage 06](../05-erd/nexus.md#stage-06-requests-commands-and-formats) and their limits; the requirements in [docs/02-prd/nexus.md](../02-prd/nexus.md); the glossary and the DDD board in [docs/01-domain/nexus.md](../01-domain/nexus.md), whose words this file keeps; and phase 1 as it runs: the server in [app.js](../../nexus/src/app.js), [snapshot.js](../../nexus/src/snapshot.js) and [store.js](../../nexus/src/store.js), and the hub in [hub.py](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex-nexus/skills/corthex-hub/scripts/hub.py) with its [snapshot.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex-nexus/skills/corthex-hub/references/snapshot.md) and [reading.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex-nexus/skills/corthex-hub/references/reading.md). The sitemap (stage 07) comes later, so no screen ID is an input yet; the requests serve the screens that the user flows and the functional spec name.

The stage's default contract is `api/openapi.yaml`, read in Swagger UI. The NEXUS server has an HTTP API, so its contract is OpenAPI 3.1, as the stage asks, kept beside the other part's interfaces as `docs/06-api/nexus.openapi.yaml`. People read it in the Korean copy in the project's Notion records, and the file itself in any OpenAPI viewer, such as Swagger UI; `.corthex/project.json` records the choice. The hub's commands are no HTTP requests, so this file defines them, in the form of MEMORY's [interfaces](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/docs/06-api/memory.md): each with an API ID, the behaviours that it serves and its outcomes.

## Approved origin sign-in (2026-11-04)

The standalone origin binds only to127.0.0.1 behind a cloudflared Tunnel. Without ctx.access it directly verifies the Cf-Access-Jwt-Assertion RS256 signature, configured team issuer, ACCESS_AUD, expiry and nbf, then applies the existing user/agent classification. The Worker additionally retains its checked context/audience requirement. Missing configuration or an invalid signature fails closed; the token never chooses the issuer/key host. Existing Access policies and HTTP/snapshot formats are unchanged. TASK-260/264 verify implementation and both real identity kinds.

## Response-example applicability (0.2.1, 2026-11-05)

The maintainer authorized an example-only correction for the18 shared fixtures below. Their exact old examples are not applicable to these operations; this does not remove the400/413 response, change a code, schema, input, role or server behaviour. Each original TC ID and previous result stays in the QA history as **not applicable**, never as a pass. The seven corrected field-specific examples are distinct cases, with new QA IDs assigned separately.

| Legacy TC | Operation/status | Old example | Why it is not applicable | Current distinct example |
| --- | --- | --- | --- | --- |
| TC-908 | API-120#400 | `invalid-field` | No body is read. | none |
| TC-957 | API-122#413 | `text-too-long` | The actual field and bound differ from `text`/4000. | `reason-too-long`: `reason`, 2000 |
| TC-971 | API-123#400 | `invalid-field` | No body is read. | none |
| TC-986 | API-124#400 | `invalid-field` | No body is read. | none |
| TC-988 | API-124#400 | `missing-session` | The user-only request ignores the agent session. | none |
| TC-1001 | API-125#400 | `invalid-field` | No body is read. | none |
| TC-1003 | API-125#400 | `missing-session` | The user-only request ignores the agent session. | none |
| TC-1022 | API-126#400 | `invalid-field` | No `text` input; a bad body reports `body`. | `invalid-body`: `body` |
| TC-1036 | API-126#413 | `text-too-long` | The actual field and bound differ from `text`/4000. | `pull-request-too-long`: `pull_request`, 2000 |
| TC-1043 | API-127#400 | `invalid-field` | No body is read. | none |
| TC-1045 | API-127#400 | `missing-session` | The user-only request ignores the agent session. | none |
| TC-1057 | API-128#400 | `invalid-field` | No `text` input; a bad body reports `body`. | `invalid-body`: `body` |
| TC-1059 | API-128#400 | `missing-session` | The user-only request ignores the agent session. | none |
| TC-1067 | API-128#413 | `text-too-long` | The actual field and bound differ from `text`/4000. | `words-too-long`: `words`, 2000 |
| TC-1081 | API-129#400 | `invalid-field` | No body is read. | none |
| TC-1083 | API-129#400 | `missing-session` | The user-only request ignores the agent session. | none |
| TC-1095 | API-130#400 | `invalid-field` | No `text` input; a bad body reports `body`. | `invalid-body`: `body` |
| TC-1109 | API-130#413 | `text-too-long` | The actual field and bound differ from `text`/4000. | `pull-request-too-long`: `pull_request`, 2000 |

The old contract had411 operation/status/media/example references. It retains393 unchanged references, omits18 exact old fixtures and adds7 corrected references: **400 current named examples**. Shared component definitions have a different count. Mock responses and actual HTTP evidence keep separate denominators; the seven new refusals do not become seven passes among the old18 TCs. The original710 IDs therefore contain626 pass,66 partial and18 not applicable before other work; adding the seven new QA rows later changes the overall total separately.

The automatic [example applicability check](../../nexus/test/contract_example_check.py) compares field locations and limits with the operation's request schema, and rejects a missing-agent-session example on a user-only operation. Applicable header refusals remain named for body-free actions. The copied runtime input schemas are unchanged.

## How to read this file

- The server's requests are the operations of the contract, API-101 to API-132. Each has its `operationId`, the behaviours (SPEC) that it serves, who may send it, every response that it can give, each with a named example, and under `x-corthex.omit` the responses that it cannot give, with the reason. [Interfaces](#interfaces) lists them; the contract defines them.
- The hub's commands, API-133 to API-150, are defined in [The hub's commands](#the-hubs-commands), with their options, outcomes and exit codes.
- A response is written as its request's ID and its status, as `API-105#409`, and an outcome of a command as its ID and the outcome, as `API-136#refused`.
- An error code is written as `commit_not_replaced`. [Error codes](#error-codes) lists each with its status, its meaning, the members that it adds, the message that the user sees and what the client does, as the contract's `components.x-corthex.errors` holds them.
- Times from the server are in UTC with milliseconds, as `2026-11-03T09:00:00.000Z`; times from a device or from Git keep their zone. Sizes in bytes count UTF-8, and lengths in characters count code points, as in stage 05.
- Status: `built` for what phase 1 serves as it runs, `active` for what NEXUS 0.2 adds or changes, and `planned` for the redesign's interfaces, API-151 to API-159, which [The redesign's interfaces](#the-redesigns-interfaces) defines and the contract holds, all but API-155, as `x-corthex.status: planned` until the server answers them, and `later (phase ②)` for phase ②'s, API-161 to API-176, which [Phase ②'s interfaces](#phase-②s-interfaces) defines in the same way.
- `~/.corthex/` is the CORTHEX folder in the user's home folder, `%USERPROFILE%\.corthex\` on Windows. The hub's files are under `~/.corthex/hub/`, as in phase 1.

## Sources

Documents read on 2026-11-02:

- Cloudflare Access and Workers. [Cloudflare Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/): a Worker gets `ctx.access` only for a request that Access authenticated, with the application's `aud` and `getIdentity()`, and gets none when it serves static assets. [Application token](https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/application-token/): a person's token holds `sub` and `email`, and a service token's holds the token's client ID in `common_name` and an empty `sub`. [Validate JWTs](https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/): the token comes in the header `Cf-Access-Jwt-Assertion`, and the team's keys are at `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`. [Service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/): a client sends the headers `CF-Access-Client-Id` and `CF-Access-Client-Secret`.
- Limits of the free plan: [Workers](https://developers.cloudflare.com/workers/platform/limits/), 10 ms of CPU time and 50 subrequests for each request and 100,000 requests a day; [D1](https://developers.cloudflare.com/d1/platform/limits/), 50 queries for each invocation and 500 MB for each database.
- [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html), Problem Details for HTTP APIs: an absent `type` means `about:blank`; the media type is `application/problem+json`; a problem may add members of its own, which a client that does not know them ignores; and `status` is the response's own status.
- [The Idempotency-Key HTTP header field](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/), version 08 of 2026-10-22, an Internet-Draft and not an RFC: the key is a String of Structured Field Values, in double quotes; a key sent again with another request should get `422`, and one whose first request is still being processed `409`. [Write IDs](#write-ids) says where NEXUS differs.

Not yet seen: both kinds of sign-in on a real Access setup, and what `getIdentity()` returns for a service token, which the documents do not say. [Sign-in](#sign-in) keeps this open.

## Interfaces

Every behaviour of the functional spec has an interface. The step view (SPEC-141) has no request of its own: it shows the picture that the view reads (API-111). The redesign's behaviours, SPEC-143 to SPEC-156, have their planned interfaces in [The redesign's interfaces](#the-redesigns-interfaces), and phase ②'s, editing on a PC and the workshops (SPEC-134, SPEC-142, SPEC-170 to SPEC-186), theirs in [Phase ②'s interfaces](#phase-②s-interfaces).

### Requests of the server

The contract defines them, and this table lists them. Who may send each: `user`, a person's own sign-in; `agent`, the service token; `either`, both ([Sign-in](#sign-in)).

| API | Request | Code name | Who | Serves | Status |
| --- | --- | --- | --- | --- | --- |
| API-101 | `GET /` | `getHubPage` | either | SPEC-113, SPEC-122, SPEC-123, SPEC-124, SPEC-125 | active |
| API-102 | `GET /pictures/{project}/{part}/{stage}` | `getPictureViewPage` | either | SPEC-113, SPEC-119 | active |
| API-103 | `GET /overview/{project}/{part}/{stage}` | `getStageOverviewPage` | either | SPEC-113, SPEC-138, SPEC-139 | active |
| API-104 | `GET /code/{file}` | `getViewCode` | either | SPEC-113, SPEC-119 | active |
| API-105 | `POST /api/snapshots` | `pushSnapshot` | either | SPEC-111, SPEC-112, SPEC-113, SPEC-114, SPEC-117, SPEC-118, SPEC-120, SPEC-121, SPEC-140 | active |
| API-106 | `GET /api/snapshots` | `listSnapshots` | either | SPEC-113, SPEC-122 | built |
| API-107 | `GET /api/snapshots/{project}` | `getSnapshot` | either | SPEC-113, SPEC-122 | built |
| API-108 | `DELETE /api/snapshots/{project}` | `removeProject` | either | SPEC-113, SPEC-115 | active |
| API-109 | `GET /api/snapshots/{project}/held` | `getHeldCommit` | either | SPEC-111, SPEC-112, SPEC-113 | active |
| API-110 | `GET /api/snapshots/{project}/removal` | `getRemovalDryRun` | either | SPEC-113, SPEC-115 | active |
| API-111 | `GET /api/spaces/{project}/pictures/{part}/{stage}` | `getPicture` | either | SPEC-113, SPEC-118, SPEC-119, SPEC-141 | active |
| API-112 | `GET /api/spaces/{project}/overview/{part}/{stage}` | `getStageOverview` | either | SPEC-113, SPEC-138 | active |
| API-113 | `GET /api/spaces/{project}/todo` | `getAgentTodo` | either | SPEC-113, SPEC-135, SPEC-136 | active |
| API-114 | `GET /api/spaces/{project}/comments/{comment}` | `getComment` | either | SPEC-113, SPEC-127, SPEC-132, SPEC-135 | active |
| API-115 | `GET /api/spaces/{project}/proposals/{proposal}` | `getProposal` | either | SPEC-113, SPEC-130, SPEC-131 | active |
| API-116 | `GET /api/spaces/{project}/edits/{edit}` | `getEdit` | either | SPEC-113, SPEC-133 | active |
| API-117 | `GET /api/spaces/{project}/checkpoints/{checkpoint}` | `getCheckpoint` | either | SPEC-113, SPEC-140 | active |
| API-118 | `POST /api/spaces/{project}/comments` | `leaveComment` | either | SPEC-113, SPEC-116, SPEC-126, SPEC-128, SPEC-143, SPEC-151 | active |
| API-119 | `POST /api/spaces/{project}/comments/{comment}/replies` | `replyToComment` | either | SPEC-113, SPEC-116, SPEC-127, SPEC-128, SPEC-132, SPEC-143 | active |
| API-120 | `POST /api/spaces/{project}/comments/{comment}/answered` | `markAnswered` | either | SPEC-113, SPEC-116, SPEC-127 | active |
| API-121 | `POST /api/spaces/{project}/comments/{comment}/decisions` | `recordDecision` | agent | SPEC-113, SPEC-116, SPEC-128, SPEC-132 | active |
| API-122 | `POST /api/spaces/{project}/proposals` | `makeProposal` | agent | SPEC-113, SPEC-116, SPEC-128, SPEC-130 | active |
| API-123 | `POST /api/spaces/{project}/proposals/{proposal}/withdraw` | `withdrawProposal` | agent | SPEC-113, SPEC-116, SPEC-130 | active |
| API-124 | `POST /api/spaces/{project}/proposals/{proposal}/accept` | `acceptProposal` | user | SPEC-113, SPEC-116, SPEC-131 | active |
| API-125 | `POST /api/spaces/{project}/proposals/{proposal}/dismiss` | `dismissProposal` | user | SPEC-113, SPEC-116, SPEC-131 | active |
| API-126 | `POST /api/spaces/{project}/edits/{edit}/report` | `reportEdit` | agent | SPEC-113, SPEC-116, SPEC-128, SPEC-133, SPEC-136 | active |
| API-127 | `POST /api/spaces/{project}/edits/{edit}/dismiss` | `dismissEdit` | user | SPEC-113, SPEC-116, SPEC-133 | active |
| API-128 | `POST /api/spaces/{project}/checkpoints` | `passCheckpoint` | user | SPEC-113, SPEC-116, SPEC-139 | active |
| API-129 | `POST /api/spaces/{project}/checkpoints/{checkpoint}/withdraw` | `withdrawCheckpoint` | user | SPEC-113, SPEC-116, SPEC-139 | active |
| API-130 | `POST /api/spaces/{project}/checkpoints/{checkpoint}/report` | `reportCheckpoint` | agent | SPEC-113, SPEC-116, SPEC-128, SPEC-136, SPEC-140 | active |
| API-131 | `POST /api/spaces/{project}/claims/{entry}` | `claimEntry` | agent | SPEC-113, SPEC-116, SPEC-136 | active |
| API-132 | `DELETE /api/spaces/{project}/claims/{entry}` | `releaseEntry` | agent | SPEC-113, SPEC-116, SPEC-136 | active |

### Commands of the hub

| ID | Name | Sends | Serves | Status |
| --- | --- | --- | --- | --- |
| API-133 | `snapshot` | nothing | SPEC-101, SPEC-102, SPEC-103, SPEC-104, SPEC-105, SPEC-106, SPEC-107, SPEC-108, SPEC-109, SPEC-110 | active |
| API-134 | `status` | nothing | SPEC-109, SPEC-137, SPEC-140 | active |
| API-135 | `build` | nothing | SPEC-122, SPEC-123, SPEC-125 | active |
| API-136 | `push` | API-109, API-105 | SPEC-111, SPEC-112, SPEC-129 | active |
| API-137 | `remove` | API-110, API-108 | SPEC-115 | active |
| API-138 | `todo` | API-113 | SPEC-135, SPEC-129 | active |
| API-139 | `comment` | API-118 | SPEC-128, SPEC-129, SPEC-135, SPEC-143, SPEC-151 | active |
| API-140 | `reply` | API-119 | SPEC-127, SPEC-128, SPEC-129, SPEC-132, SPEC-143 | active |
| API-141 | `answered` | API-120 | SPEC-127, SPEC-128, SPEC-129 | active |
| API-142 | `decide` | API-121 | SPEC-132, SPEC-128, SPEC-129 | active |
| API-143 | `propose` | API-122 | SPEC-130, SPEC-128, SPEC-129 | active |
| API-144 | `withdraw` | API-123 | SPEC-130, SPEC-128, SPEC-129 | active |
| API-145 | `reflect` | API-126 | SPEC-133, SPEC-128, SPEC-129 | active |
| API-146 | `record` | API-130 | SPEC-140, SPEC-128, SPEC-129 | active |
| API-147 | `show` | API-114, API-115, API-116, API-117 | SPEC-132, SPEC-133, SPEC-140 | active |
| API-148 | `claim` | API-131 | SPEC-136 | active |
| API-149 | `release` | API-132 | SPEC-136 | active |
| API-150 | `outbox` | the requests of the writes that it holds | SPEC-129 | active |

## The redesign's interfaces

Planned with the redesign of 2026-11-06 for SPEC-143 to SPEC-156. Its checkpoint 3 sees them; the contract, the server and the hub take them when the redesign is built, with the same rules as 0.2's requests: Access on every request (SPEC-113), Problem Details for refusals, write IDs for writes, and no reply cached but the view's code.

| ID | Request | Code name | Who | Serves | Status |
| --- | --- | --- | --- | --- | --- |
| API-151 | `GET /api/home` | `getHome` | either | SPEC-113, SPEC-143, SPEC-144, SPEC-145 | active |
| API-152 | `GET /api/spaces/{project}/talk/{part}/{stage}` | `getStageTalk` | either | SPEC-113, SPEC-150 | active |
| API-153 | `GET /p/{project}` | `getProjectPage` | either | SPEC-113, SPEC-146 | planned |
| API-154 | `GET /p/{project}/{part}/{stage}` | `getStagePage` | either | SPEC-113, SPEC-146 to SPEC-151, SPEC-155, SPEC-156 | planned |
| API-155 | `GET /` | `getHomePage` | either | SPEC-113, SPEC-143, SPEC-144, SPEC-145, SPEC-154 | planned |
| API-156 | `GET /api/search` | `searchItems` | either | SPEC-113, SPEC-152 | active |
| API-157 | `GET /api/spaces/{project}/items/{id}` | `getItem` | either | SPEC-113, SPEC-149 | active |
| API-158 | `GET /api/spaces/{project}/stages/{part}/{stage}` | `getStage` | either | SPEC-113, SPEC-147, SPEC-148 | active |
| API-159 | `POST /api/spaces/{project}/comments/{comment}/recommended` | `takeRecommendation` | user | SPEC-113, SPEC-116, SPEC-143 | planned |

- API-151 answers the first page in one read: my turn, up to 50 entries with the total, each with its kind, project, part, stage, item, quote, the first 300 characters of the agent's last entry, its time and its `asks`; the agent to-do's counts for each project, by list, with the taken ones; and a card for each project, from its stored snapshot and space: its parts' current stage and next action, the 13 stages' states and item counts, its warnings, and for each picture its stage, whether it is current, its open comments and a small drawing, which is the server's first picture of it without labels (the first picture decision of 2026-11-04).
- API-152 answers a stage's talk: the open proposals and comments, those that wait for the user first, each with its item or the stage as a whole, its quote, its author's kind and time, its last reply, its `asks` and, while one lasts, its claim's start; the comments whose item the snapshot no longer holds, apart; and the count of closed ones. `item` narrows it to one item, and `closed=1` adds the closed ones, newest first, 50 at a time.
- API-158 answers a stage's head and items: the head as SPEC-147 lists it, with whether the project reads the stage and why not (`head.reads`), and the stage record of API-112; the project's name, repository and commit (`project`); the part's 13 stages with their states, item counts, pictures and counts of entries in my turn, for the workspace's list of stages (`stages`); and the items 200 at a time after `after`, filtered by `filter`, `all`, the default, `talk`, `mine` or `left`, and by `q`, up to 200 characters, grouped by `group`, `context`, the default, or `source`.
- API-157 answers one item: its fields and their names, its context, the place of its source with the snapshot's commit, the items that it comes from and leads to by stage, and its comments as API-152 gives them. `404` `item_not_found` when no stage of the project holds it; the view then reads the comments that still name it with API-152, where they show apart.
- API-156 takes `q`, from 2 characters to 200, and answers up to 20 matches across every stored snapshot, each with its project, part, stage, ID and title.
- API-159 takes the agent's recommendation on a comment that waits for the user. With `asks` `recommended`, it adds the user's reply that settles the comment, with the words for "as recommended" in the server's language, as API-119 with `settles` would. With `asks` `checkpoint`, it also passes the checkpoint of the comment's part and stage, with those words and the comment in its `comment`, as API-128 would. Both happen in one transaction with the write ID. `409` `not_recommended` when the comment no longer waits for the user or asks for nothing that can be taken; the refusals of API-119 and API-128 otherwise.
- The pages, API-153 to API-155, hold their data as the 0.2 pages do ([Page data](#page-data)), and their code comes from API-104. API-153 answers `302` to the project's current stage, and `404` for an unknown project.

Changes to 0.2's interfaces, made when the redesign is built:

1. API-101 `getHubPage` moves to `GET /hub` (SPEC-153); `GET /` becomes API-155.
2. API-102 and API-103 answer `302` to the stage's page instead of their own pages, the second with `#view=list` (SPEC-154); their IDs stay, as redirects. A `302` is not kept by browsers, so the server can go back to 0.2.
3. API-118 `leaveComment` takes any of the 13 stage keys and needs no picture; `item` may be empty for the stage as a whole (SPEC-151). A stage key outside the 13 is `400` `invalid_request` by the field `stage`, and a part that the stored snapshot does not hold is `404` `part_not_found`, codes that 0.2 already has. The agent's comment may carry `asks`.
4. API-119 `replyToComment`: the agent's reply may carry `asks`; the user's reply empties the comment's `asks`.
5. The hub's `comment` (API-139) takes any of the 13 stages in `--stage`, not only the pictured ones, and leaves `--item` out for the stage as a whole; `comment` and `reply` (API-140) take `--asks answer|recommended|checkpoint`. These are changes of the hub in `kodonghui/corthex`, so they come in its pull request, with the new tokens of the hub page's template (stage 09), and this repository's `hub-ref.json` moves to that exact commit with the product checks, as this repository's rules say.

Changes 3 to 5 are built: the contract and the server in kodonghui/corthex-nexus#50, with stage 05's migration 4, and the hub 0.3.0 in kodonghui/corthex#172, whose commit `318035d` `hub-ref.json` names. Two points that writing them settled: the user's `asks` is refused as `400` `invalid_request` by the field `asks`, since only the agent says what it asks; and a comment that leaves out `commit` takes the picture's document version, or on a stage without a picture the held default branch commit, and is refused by the field `commit` when the stored snapshot has none.

The contract holds API-151 to API-154 and API-156 to API-159 since TASK-265, marked `x-corthex.status: planned`, which the contract checks leave out until the server answers them; API-155 comes with the move of API-101 (TASK-271). Writing them settled these points:

- A query value in another form is `400` `invalid_request` by its field, unlike a path value ([Addresses and paths](#addresses-and-paths)).
- API-152's `closed` takes `0` or `1`, and `after` counts the entries that the view holds already, up to 100,000. A claim in the talk gives its start as `claimed_at`, which the agent's own reads may leave out.
- API-158's `filter` also takes `all`, the default, and `group` is `context` by default. An item's context is the context that its links name, a context's own ID for a context, or else that of the first item that it comes from that has one, a stage back at a time; the items without one are the last group. `counts` gives each filter's items with the words `q`.
- API-157 takes the part as the query value `part`, the project's first part when it is left out, and holds the talk as `comments`. `item_not_found` holds no comments, since Problem Details hold only the code's members: the view reads the comments that still name the item with API-152 narrowed to it, where they show apart.
- API-151's small drawing is the server's first layout of the picture, as boxes and lines in whole units without labels, up to 2,000 of each, and null for a picture that is too complex to lay out. A card's title is cut at 120 characters, as titles are.
- API-156 answers up to 20 matches, each opening in the project's first part.
- API-159 answers the comment's state, the reply that settles it and the checkpoint, with `changed` false when the recommendation was taken already; a checkpoint passed this way names the comment in `comment`.
- The stage page holds `corthex-stage-page/0.3` ([Page data](#page-data)), and two codes are new: `item_not_found` and `not_recommended` ([Error codes](#error-codes)).

API-158 is active since TASK-266: the server answers it, and the contract checks and Schemathesis cover it. Building it settled these points:

- The items are the project's items of the stage, as the hub page lists them; their marks, each stage's count of my turn, and the head's picture, commit and hotspots are the part's.
- My turn on a stage counts its comments that wait for the user and its open proposals (TERM-135). `talk` keeps the items with comments, open or closed; `left` keeps those with an open comment, an open discrepancy on either of its sides, or a pending reflection.
- When an item comes from several items that have a context, the nearest stage wins, then the order of its links, then the order of IDs. The groups follow the order of the contexts in the snapshot; an ID that the snapshot's prefixes make a context, but that no item of the snapshot holds, is a group without a title after them, and the items without a context come last.
- A hotspot of a stage 01 board is open while its state is `open` or `열림`, ignoring case and the spaces at its ends, as the board's template writes them in either language; `hotspots` is null when the part has no stage 01 board.
- `q` comes back trimmed, or null when it holds no words. A query value given twice is refused as one in another form is, and a name that the read does not take is ignored.

API-152 is active since TASK-267: the server answers it, and the contract checks and Schemathesis cover it. Building it settled these points:

- A comment is in my turn while it waits for the user and in the agent's turn while it waits for the agent; while the stored snapshot's stage does not hold its item, it is apart, in neither turn, whichever it waits for. A comment on the stage as a whole is never apart. API-158 still counts an apart comment that waits for the user in the stage's my turn, since it waits for the user (TERM-135).
- My turn lists the comments whose last entry asks for the stage's checkpoint, then the open proposals, then the other comments that wait for the user (SPEC-143), each oldest first: a comment by the time of its last entry, when it began to wait, and a proposal by when it was made. The agent's turn and apart follow the time of the last entry too, and equal times go by ID.
- The closed talk is the stage's closed comments, by the time of their last entry, and its proposals no longer open, accepted, dismissed or withdrawn, by when they closed, newest first. `after` counts only these; with `closed=0` the answer gives their total and no entries.
- `item` narrows the comments to those on the item, and the proposals and reflections to those whose items include it, closed ones too; a comment on the stage as a whole is on no item.
- The view asks with no session, so no claim in the talk is `mine`. Each comment and reflection gives `claim` with the claim's start and end while one lasts, and null otherwise; a proposal has no claim.
- Each turn and apart give their first 200 entries with their totals, and the reflections all of the stage's, up to the 500 that a project holds at most. A project without a space is `404` `space_not_found`.

API-156 and API-157 are active since TASK-268: the server answers them, and the contract checks and Schemathesis cover them. Building them settled these points:

- API-157's item is the first item of the stored snapshot, in its order, that one of the 13 stages holds by the ID, as the list shows it. `part` names the part of its talk: the project's first part when it is left out, and `_` for the project as a whole. The talk is that of the item's stage in the part, as API-152 gives it narrowed to the item. A project without a space, pushed only by a hub of 0.1, is `404` `space_not_found`, as for API-152.
- The source's place is read as the hub page's links read it, `[repository:]path:line`. A repository that the settings name holds the file at its own commit in the snapshot; any other name stays in the path, in the project's own repository, whose commit is the one that the snapshot was made from and may differ from the held default branch commit. The link opens the file at that commit, at its line unless it is the first. There is no link when the settings give no web address or no whole commit: the hub page also links an abbreviated commit, but the contract's commits are whole. There is no source when the item names no place or its path is over 300 characters.
- The trace takes the item's direct links in either direction: items of an earlier kind, in the stage contract's order of kinds, are what it comes from, and items of a later kind what it leads to. Links to an item of the same kind, to a decision or another kind outside that order, to an ID that no item holds, or to an item outside the 13 stages have no place, though the hub page's trace view shows the first three as the same kind, decisions and links. The groups follow the stages' order, each by kind and then by ID, with its first 100 items and its total.
- API-156 trims the words and counts them in code points. The items whose ID equals the words, ignoring case, come first; then the items whose ID or title holds every word, ignoring case; each list goes by the projects' names and then in the snapshot's order. An ID matches once in each project that holds it, as the first of its items on the 13 stages, so an ID in several projects is one match for each, by name; IDs in another form and items outside the 13 stages are left out. A match opens in the project's first part, or the project as a whole when it has no parts. `total` counts every match, and the first 20 come back, with titles cut at 120 characters.
- The search reads only the stored items, never the checks or the stage sources, and keeps no index. Over 30 stored snapshots of 3,000 items each, 29 of them about 1 MB, it took from 104 to 156 milliseconds in a local in-memory server ([Checks run](#checks-run)).

API-151 is active since TASK-269: the server answers it, and the contract checks and Schemathesis cover it. Building it settled these points:

- My turn gathers every space's open comments that wait for the user and its open proposals, in API-152's order: the comments whose last entry asks for the stage's checkpoint, then the proposals, then the other comments, each oldest first, a comment by when it began to wait and a proposal by when it was made, and equal times by ID. A comment whose item no stage holds now is there too, with no title, since it still waits for the user; the stage's talk shows it apart.
- A comment's text is its last entry, the agent's: the change of an open proposal that answers it after its last reply, or else its last reply, or else its own text, so that a reply of the user's before the proposal never shows as the agent's. A proposal's text is its change, with its first item, and its quote and `asks` are null. Texts are cut at 300 characters.
- An entry's title is that of the first item of the stored snapshot that one of the 13 stages holds by the ID, as API-157 finds it, cut at 120 characters; it is null for the stage as a whole and for an item that no stage holds. Only the 50 entries that come back read their last entries and titles.
- The agent's counts are API-113's lists read without a session, for each project with a space, by name, even when every list is empty. Each list's oldest entry, by the time that the list keeps (a comment's last entry, when a discrepancy opened, whatever its level, when a reflection was made and when a checkpoint passed) and then by ID, opens at its part and stage; a discrepancy opens at stage 05 when it compares an aggregate with a table and at stage 07 when it compares a read model with a screen. `taken` counts the claims that last on these entries, so a claim on a comment that waits for the user is not counted.
- A card counts the items of the 13 stages, and its warnings are the stored checks of level warn. Its parts are the settings' valid parts, up to 50, or the project as a whole when they name none. A part's current stage is its first in progress, or else its first not started, as the hub page names it; `recorded` is true when any of its stages has a recorded state, skipped included; `next` is the current stage's next action cut at 300 characters, or null. `repository` is the web address of the project's own repository, `commit` the held default branch commit and `pushed_at` when the server stored the snapshot.
- A card holds the pictures of the parts that its snapshot names, in their order and then the stages' order; a picture of a part that the settings no longer name stays in the space but off the card. A picture that is not current is still drawn from its stored source, and `comments` counts the open comments of its part and stage.
- The small drawing is the server's first layout of the picture, the whole board for stage 01, and gives each box its kind and each line from the right middle of one box to the left middle of the other, rounded to whole units. It is null when the picture has nothing to draw, when the layout stops at its limit, or past 2,000 boxes or lines.
- The server reads the page in one batch of four statements, and SQLite takes the cards' fields out of the stored bodies. Over 30 projects with spaces, the server's limit, it took a median of 123 to 327 milliseconds in a local in-memory server, with 90 to 4,500 pictures and answers of 0.7 to 2.7 MB ([Checks run](#checks-run)).

## Phase ②'s interfaces

Planned for phase ②, editing on a PC and the workshops of stage 01 (SPEC-134, SPEC-142, SPEC-170 to SPEC-186), on the tables of stage 05's [Phase ②'s tables](../05-erd/nexus.md#phase-②s-tables), whose stages 01 to 04 passed on 2026-11-06 and 2026-11-07. This stage's checkpoint for phase ②, with stage 05's, passed them at 09:33 KST on 2026-11-08; the contract, the server and the hub take them when phase ② is built, after the redesign, with the same rules as 0.2's requests: Access on every request (SPEC-113), Problem Details for refusals, write IDs for writes, the session label for the agent's writes and the claims of the agent to-do (SPEC-136), and no reply cached but the view's code.

| ID | Request | Code name | Who | Serves | Status |
| --- | --- | --- | --- | --- | --- |
| API-161 | `GET /api/spaces/{project}/drafts/{part}/{stage}` | `getEditDraft` | either | SPEC-113, SPEC-134, SPEC-170 | later (phase ②) |
| API-162 | `POST /api/spaces/{project}/drafts/{part}/{stage}` | `saveEditDraft` | user | SPEC-113, SPEC-116, SPEC-134 | later (phase ②) |
| API-163 | `POST /api/spaces/{project}/drafts/{part}/{stage}/choice` | `chooseOnConflict` | user | SPEC-113, SPEC-116, SPEC-170 | later (phase ②) |
| API-164 | `POST /api/spaces/{project}/drafts/{part}/{stage}/send` | `sendEdit` | user | SPEC-113, SPEC-116, SPEC-171, SPEC-175 | later (phase ②) |
| API-165 | `POST /api/spaces/{project}/drafts/{part}/{stage}/drop` | `dropEditDraft` | user | SPEC-113, SPEC-116, SPEC-173 | later (phase ②) |
| API-166 | `POST /api/spaces/{project}/edits/{edit}/drop` | `dropEdit` | user | SPEC-113, SPEC-116, SPEC-172, SPEC-173 | later (phase ②) |
| API-167 | `POST /api/spaces/{project}/positions/{part}/{stage}` | `keepPositions` | user | SPEC-113, SPEC-116, SPEC-174 | later (phase ②) |
| API-168 | `GET /api/spaces/{project}/workshops` | `listWorkshops` | either | SPEC-113, SPEC-142, SPEC-184, SPEC-186 | later (phase ②) |
| API-169 | `POST /api/spaces/{project}/workshops` | `startWorkshop` | either | SPEC-113, SPEC-116, SPEC-142, SPEC-186 | later (phase ②) |
| API-170 | `GET /api/spaces/{project}/workshops/{workshop}` | `getWorkBoard` | either | SPEC-113, SPEC-142, SPEC-181, SPEC-183, SPEC-186 | later (phase ②) |
| API-171 | `POST /api/spaces/{project}/workshops/{workshop}/changes` | `changeWorkBoard` | either | SPEC-113, SPEC-116, SPEC-176, SPEC-177, SPEC-178, SPEC-179, SPEC-186 | later (phase ②) |
| API-172 | `POST /api/spaces/{project}/workshops/{workshop}/read` | `markBoardRead` | agent | SPEC-113, SPEC-181, SPEC-186 | later (phase ②) |
| API-173 | `POST /api/spaces/{project}/workshops/{workshop}/end` | `endWorkshop` | user | SPEC-113, SPEC-116, SPEC-184 | later (phase ②) |

| ID | Command | Sends | Serves | Status |
| --- | --- | --- | --- | --- |
| API-174 | `workshop` | API-168, API-169 | SPEC-142, SPEC-186 | later (phase ②) |
| API-175 | `board` | API-168, API-170, API-172 | SPEC-181, SPEC-183, SPEC-186 | later (phase ②) |
| API-176 | `change` | API-171 | SPEC-179, SPEC-186, SPEC-128, SPEC-129 | later (phase ②) |

### Edit drafts and sent edits

The draft's requests take the picture's path, since one draft is open for each part's pictured stage (REQ-240), and name the draft's ID and the revision that they start from in the body (REQ-241). Only the user writes a draft (SPEC-116); `{stage}` is one of the three pictured stages, and a stage without a picture gets `404` `picture_not_found`.

- **API-161** answers the open draft: its ID, its document version (`commit`), its revision, its list of changes, the editor's elements, the list of the draft that editing again dropped (`earlier`), and when it was made and last saved. It adds `latest`, the picture's current document version, and, when the draft is on another, `applies`: for each change, in order, `true` or why it no longer applies, `gone`, `changed` or `name-taken` (SPEC-170). `404` `draft_not_found` when no draft is open: the editor then opens the picture itself, and its first save starts the draft.
- **API-162** saves the draft: `{draft, revision, commit, changes, elements}`. A first save sends `draft: null`, `revision: 0` and `commit`, the document version of the picture that the editor opened, and gets `201` with the new draft's ID and revision 1; a later save sends the draft's ID and the revision that it holds, without `commit`, and gets `200` with the next revision. Each save replaces the list of changes and the elements whole. When the picture was redrawn between the editor's opening and the first save, the draft starts on the editor's version, and API-161 shows it as an edit conflict. `409` `draft_revision` when the draft holds another revision, or when a first save finds a draft open, as from a second window: its `draft`, `revision` and `saved_at` give the draft as last saved, which the view offers to load (REQ-241). `409` `draft_closed` when the named draft was sent or dropped. `413` `draft_too_large` over 1 MiB of changes, elements and earlier list, or over 300 changes, and `413` `body_too_large` for a body over 1 MiB; `409` `space_full` when the space's text would pass 8 MiB.
- **API-163** takes the user's choice on an edit conflict: `{draft, revision, choice, commit}`, where `choice` is `keep` or `edit-again` and `commit` is the latest document version that the conflict was shown over. `keep` binds the draft to `commit` (SPEC-170): refused with `409` `draft_not_applying`, whose `changes` names the changes that stop it, each with why; answered `changed: false` when the draft is on `commit` already. `edit-again` drops the draft and opens a new one on `commit`, with no changes and the dropped draft's list as its `earlier`, and gets `201` with the new draft. Both get `409` `picture_changed`, whose `latest` gives the newer version, when the stage source changed again while the conflict was shown.
- **API-164** sends the draft as an edit: `{draft, revision, note}`, with a note of up to 200 characters (SPEC-171). When the draft's version is still the latest, the server makes the edit under the draft's ID, pending, with the draft's version, its list of changes and the note, deletes the draft and puts the edit in the agent to-do, all in one batch, and answers `201` with the edit. The positions at which the user placed the added items go with their changes' `at`, under their temporary names (SPEC-175). `409` `picture_changed` when the version is no longer the latest, and the view shows the conflict (SPEC-170). `400` `invalid_request` for an empty list, whose `field` is `changes`, and for an empty note, whose `field` is `note`; `413` `text_too_long` for a note over 200 characters; `409` `reflection_limit` when the space holds 500 pending reflections.
- **API-165** drops the draft: `{draft, revision}` (SPEC-173). The draft's row goes, with its bytes. A draft that is no longer open and was not sent is dropped already: `changed: false`. `409` `draft_closed` when it was sent, naming the edit.
- **API-166** drops an edit sent from the editor while it waits (SPEC-173): a pending edit, or one that needs the user, becomes `dropped` and leaves the pending reflections; one in review becomes `dropped` with its pull request kept, and the agent to-do lists it until the agent reports the pull request closed or merged (SPEC-185). `409` `edit_state`, with its `state`, when the edit is closed, dismissed or dropped already, as SPEC-173 says, and for an edit that an accepted proposal made, which only a dismissal closes (API-127). A session's claim never refuses it (SPEC-136).
- **API-167** keeps positions: `{positions}`, a list of 1 to 2,000 `{item, x, y}`, each a trace ID that the current picture holds, a context or an aggregate of the DDD board, a table of the ERD or a screen of the sitemap (SPEC-174). Each is kept under its item for the part's stage, with the server's time; of two windows, the later save wins. `400` `unknown_item`, whose `items` names them, for IDs that the picture does not hold; `409` `position_limit` when the part's stage would hold more than 2,000. The answer gives how many were kept and the stage's total.

### Work boards

A workshop is the work board of a part's stage 01 (SPEC-142). The agent's writes on a board are on the workshop's entry for its claims ([Claims](#claims)), and a comment on a board is API-118's, on a sticky or a frame (SPEC-180).

- **API-168** lists the project's workshops, or a part's with `part`: the open one first, then the ended ones, newest first, each with its ID, part, way of working, state, board version, last step, the version that the agent last read, and when it started and ended; 50 at a time, with the total.
- **API-169** starts a workshop: `{part, way, text}`, where `way` is `draft-first` or `people-first`, which the user chose (REQ-249), and `text`, optional, is Step 0's goal and scope, up to 4,000 characters. It makes the workshop, open, at board version 1, with its Step 0 frame, and answers `201` with both. The user starts one in the view, and the agent through the hub when the user asks in the session (SPEC-186). `409` `workshop_open`, whose `workshop` gives the open one, which the view opens (REQ-248). `400` `invalid_request` without `way`; `404` `part_not_found` for a part that the stored snapshot does not hold.
- **API-170** answers a board: the workshop, with its state, way, board version and the agent's last read; its frames in step order, each with its text, the version and author of its last change and its checkpoint, with the checkpoint's state, the board version passed, its reflection's pull request and whether it differs from the source; every sticky, arrow and group, removed ones too, each with its ID, frame, the ID that it copies, its fields, its author, its label, the version at which it was made and of its last change, who made that change and what it was; the marks since the agent's read; and the counts of open comments on each sticky and frame. Its fields follow stage 05's columns. `since`, a board version, narrows it to the frames and elements changed after that version, with the board's version, so that an open board asks for its changes every 10 seconds and when it is shown again (point 23). `upto`, a checkpoint's `nk_` ID, narrows it to the frames up to that checkpoint's step, which no longer change once it passed, with the board version passed (point 21); `409` `checkpoint_withdrawn` for a withdrawn checkpoint.
- **API-171** changes a board's last frame: `{frame, operations}`, where `frame`, optional, is the step of a frame to add first, as a copy of the last frame without its removed elements (SPEC-176), and `operations` is a list of up to 1,000 operations, which may be empty only with `frame`. The server checks the workshop, the frame, each operation, its author and the version that it starts from, and the frame's limits, then writes all of it in one batch, which raises the board version by one, or nothing (SPEC-177, SPEC-179). The answer gives the new board version, `changed`, the IDs given to the keys of the elements that it placed (`keys`), the elements as written, and `unchanged`, the places of the operations that changed nothing. A body may have up to 1 MiB.
- **API-172** records the agent's read of a board: `{version}`, the board version that the hub read in full, with the session label (REQ-259). A version older than the recorded read changes nothing (`changed: false`), as when two reads cross; the later read counts. A version above the board's is `400`. It needs no write ID, as a claim needs none, since recording one version twice leaves one mark, and the hub never keeps it in the outbox: a read that it could not complete records nothing (SPEC-181).
- **API-173** ends a workshop (SPEC-184): its board becomes read-only, as material. Only the user ends one; the agent gets `403` `user_only` and asks the user. An ended workshop answers `changed: false`.

The operations of API-171:

| `op` | Fields | Who | What it does |
| --- | --- | --- | --- |
| `place` | `key`, `kind`, `text`, `x`, `y`, and `label` from the agent | either; the agent must send `label`, the user sends none | Places a sticky of one of the legend's nine kinds, marked with its author (REQ-214, REQ-215, REQ-252) |
| `change` | `sticky`, `version`, and one or more of `kind`, `text`, `x` and `y` | the user any sticky; the agent only its own | Changes or moves it; the user's change takes the agent's label off (REQ-253). A hotspot is answered by changing its kind to `answered-hotspot` |
| `confirm` | `sticky`, `version` | user | Takes the agent's label off, as the sticky is (REQ-253) |
| `remove` | `sticky`, `version` | the user any sticky; the agent only its own | Folds it away with its arrows, with who removed it and when (REQ-257) |
| `restore` | `sticky`, `version` | user | Brings it back with its arrows |
| `arrow` | `key`, `from`, `to` | either | Draws an arrow between two stickies of the frame |
| `unarrow` | `arrow`, `version` | the user any arrow; the agent only its own | Takes it away |
| `group` | `key`, `name`, `members` | either | Groups 1 to 300 stickies of the frame under a name of up to 100 characters |
| `regroup` | `group`, `version`, and `name` or `members` or both | the user any group; the agent only its own | Renames it or changes its stickies |
| `ungroup` | `group`, `version` | the user any group; the agent only its own | Ungroups it |
| `text` | `version`, `text` | either | Sets the frame's own text, up to 4,000 characters, such as Step 0's goal and scope |

- `key` is a name for an element that the change places, 1 to 40 ASCII letters, digits, `-` and `_`, unique in the change, so that its arrows and groups can join the stickies that it places; `from`, `to` and `members` take a sticky's ID or a key of the same change. With `frame`, an operation may name a sticky, arrow or group of the frame before it, meaning its copy in the new frame, and names no version, since the copy is new.
- `version` is the element's version that the operation starts from, or the frame's for `text`. An older one is refused with `409` `element_changed`, whose `at` gives the operation's place in the list and `element` the element as it is now, with who changed it (REQ-256, point 23).
- An operation whose outcome holds already, a removal of a removed sticky, a restoring of one that is back, a confirmation of a sticky without a label, a taking away of an arrow taken away or an ungrouping of an ungrouped group, changes nothing, whatever version it names, and is listed in `unchanged` (SPEC-178). A change of only such operations is answered with `changed: false` and raises no version.
- Refusals: `409` `workshop_ended` (REQ-218); `409` `frame_not_next`, whose `next` gives the next step or `null` after Step 9, and `409` `checkpoint_waits`, whose `step` is 1-b or 7, for a frame that may not come yet (REQ-251); `409` `frame_closed` for a change on a frame that is not the last, or whose checkpoint passed (REQ-250); `403` `not_placed_by_agent` for the agent's change, move or removal of what it did not place (REQ-254); `403` `user_only` for the agent's `confirm` and `restore`, and for the agent's `frame` on a board of the way `people-first`, whose frames the user adds (SPEC-176); `400` `unknown_item` for IDs that the frame does not hold; `400` `invalid_request` for an arrow or a group across frames, a key used twice, and the agent's `place` without a label or the user's with one; `413` `text_too_long` for a sticky's text over 300 characters, a name over 100 or a frame's text over 4,000; and `409` `board_limit`, whose `field` and `limit` name it, for 12 frames, or in a frame 300 stickies, 600 arrows or 50 groups, removed ones included (SPEC-142). An empty text is `400`, as for any text that a write must have.

### Commands of the hub for phase ②

They follow [Running a command](#running-a-command): the session label, `--json`, the exit codes, and the outbox for the writes. They are changes of the hub in `kodonghui/corthex`, so they come in its pull request, and this repository's `hub-ref.json` moves to that exact commit with the product checks, as for the redesign.

`workshop` (API-174):

```txt
hub.py workshop PROJECT [--part PART]
                [--start --way draft-first|people-first [--text TEXT | --text-file FILE]]
```

Without `--start` it lists the part's workshops (API-168). With `--start` it starts one with the way of working that the user chose in the session, and Step 0's goal and scope as its text, redacted (API-169, SPEC-142). The stage 01 skill has the agent start one only when the user asks, and never choose the way itself (REQ-249). `409` `workshop_open` is `refused`, with the open workshop's ID.

`board` (API-175):

```txt
hub.py board PROJECT [WORKSHOP] [--part PART] [--checkpoint CHECKPOINT] [--since VERSION]
```

It reads a board (API-170): the workshop that `WORKSHOP` names, or the part's open one, which it finds through API-168; with no open workshop it says so, with exit code 0 (SPEC-186). It prints the board frame by frame, each sticky with its ID, kind, text, author, label, the ID that it copies and whether it is removed, then the arrows, the groups, each frame's checkpoint and the marks since the agent's read, after redacting every text and name as it redacts a snapshot, so that no secret on a sticky reaches a stage source (SPEC-183). After a complete read of an open board, whole or since a version no later than the agent's last read, it records the read (API-172); a read of a checkpoint, `--checkpoint`, gives the frames up to its step at the version passed and records nothing, since it leaves the later frames out (point 21). A read cut off records nothing, and the marks stay (SPEC-181).

`change` (API-176):

```txt
hub.py change PROJECT WORKSHOP --file FILE
```

It sends the change in `FILE`, `-` for standard input, a JSON object of API-171's body, after redacting its texts and names, with a new write ID and the session label, after the project's outbox (SPEC-128). It prints the board version, the IDs given to the keys and the operations that changed nothing. A change that cannot be sent waits whole in the outbox, with exit code 3, and goes at the next contact; a refusal then, as for a frame passed meanwhile, is reported and dropped, and the agent reads the board again (SPEC-179, SPEC-129).

### Changes to 0.2's and the redesign's interfaces

Made when phase ② is built:

1. API-110 `getRemovalDryRun` lists the open drafts and the workshops, open and ended, with the rest of what a removal deletes (SPEC-115).
2. API-111 `getPicture` gains `draft`, the mark of the part's stage's open draft, with its ID, revision, document version and last save (point 19); `positions`, the kept positions, from which the layout starts (SPEC-119, SPEC-174); and, among its reflections, the edits sent from the editor, with their list of changes and note, marked as sent on an earlier document version once the picture was redrawn (REQ-243, SPEC-172), and the dropped ones whose pull request is open.
3. API-113 `getAgentTodo` lists, after its checkpoints, `dropped_edits`, the dropped edits whose pull request is open; `workshop_checkpoints`, the workshops' passed checkpoints not yet reflected, oldest first, each with its board version and its pull request when one was reported; and `changed_boards`, the open workshops whose board the user changed since the agent's read, each with its count of changes: 50 of each, with their totals (SPEC-185). A workshop's checkpoint is not among `checkpoints`, since its reflection writes the record.
4. API-116 `getEdit` gains, for an edit sent from the editor, `changes`, `note`, `comment` and `dropped_at`.
5. API-118 `leaveComment` takes, on stage `01-domain`, an `item` that is the `ns_` ID of a sticky or the `nf_` ID of a frame of the part's workshop (REQ-258, SPEC-180). `404` `item_not_found` when the board does not hold it, and `409` `workshop_ended` for a new comment on an ended workshop, whose open comments can still be answered.
6. API-126 `reportEdit`: `merged` takes `ids`, the IDs that the stage source gave the items that the edit added, by their temporary names, and the same write keeps their positions under those IDs, unless an ID has a newer position already (REQ-247, SPEC-175); a name that the edit does not hold is `400` `unknown_name`, whose `names` gives them, and the edit stays as it was. For an edit sent from the editor, `needs-user` and `merged` take `comment`, the agent's comment on the stage as a whole that asks the user or tells them what became of it (SPEC-171, SPEC-173). A dropped edit takes `closed` for its pull request, which empties it and leaves the edit dropped, and `merged`, with its pull request or none, which closes it as reflected after the drop (point 20); any other report is `409` `edit_state`.
7. API-128 `passCheckpoint` takes, for stage `01-domain`, `frame` and `board_version`: the workshop's checkpoint after the frame's step, at the board version that the user sees (REQ-261, SPEC-182). `409` `board_changed`, whose `version` gives the board's, when the board changed since; `409` `not_checkpoint_step`, whose `step` gives the last frame's, when the frame is not the board's last or its step is not 1-b, 7 or 9; `409` `frame_closed` when its checkpoint passed already. The pass of Step 9's checkpoint also ends the workshop, in the same batch (REQ-263).
8. API-129 `withdrawCheckpoint` withdraws a workshop's checkpoint only while its frame is still the board's last one and no pull request reflects it: `409` `frame_closed` once a later frame was added, `409` `pull_request_reported` once its reflection's pull request was reported, and `409` `workshop_ended` for the last checkpoint, which ended the workshop (SPEC-182).
9. API-130 `reportCheckpoint` takes, for a workshop's checkpoint, the event `differs`, without a pull request: another pull request changed the stage 01 source since the board was last reflected, and the agent asks the user (REQ-265, SPEC-183); its `opened` clears it. `differs` for any other checkpoint is `400`.
10. API-131 `claimEntry` and API-132 `releaseEntry` take an `nb_` ID, a workshop whose board the user changed since the agent's read; its claim ends as any claim ends, or when the session's read leaves the board out of the to-do (SPEC-185).
11. The redesign's API-151 `getHome` gives, for an agent's comment on a frame that asks for its checkpoint, the board version of the frame's workshop, and API-159 `takeRecommendation` takes it back as `board_version` and passes the checkpoint as API-128 would, with its refusals (D15, SPEC-182).
12. The redesign's API-152 `getStageTalk` gives, on stage `01-domain`, the board comments with their step and sticky's text (SPEC-180), and on the pictured stages the edits sent from the editor with their list and note (SPEC-172). API-158 `getStage` names, in stage 01's head, the part's open workshop with its last step and board version, and its ended ones (SPEC-142).
13. The hub: `todo` (API-138) prints phase ②'s lists; `comment` (API-139) takes a sticky's or a frame's ID in `--item` with `--stage 01-domain`; `reflect` (API-145) takes `--id NAME=ID`, again for each name, with `merged`, and `--comment ID`; `record` (API-146) takes the event `differs`, without `--pr`; `claim` and `release` (API-148, API-149) take an `nb_` ID. They come in the core repository's pull request with API-174 to API-176.

### Request names, claims and limits of phase ②

| Name | Request | Who |
| --- | --- | --- |
| `save-draft` | API-162 | user |
| `draft-choice` | API-163 | user |
| `send-edit` | API-164 | user |
| `drop-draft` | API-165 | user |
| `drop-edit` | API-166 | user |
| `positions` | API-167 | user |
| `start-workshop` | API-169 | either |
| `board` | API-171 | either |
| `end-workshop` | API-173 | user |

- The agent's writes on a board, its changes and its read marks, are on the workshop's entry, and its reports of a workshop's checkpoint, `differs` too, on the checkpoint's ([Claims](#claims)).
- A draft's save and a board's change may have bodies of up to 1 MiB; every other request of phase ② keeps 256 KiB. Stage 05's [limits](../05-erd/nexus.md#limits) give the rest: a draft of 1 MiB and 300 changes, a note of 200 characters, 2,000 positions for each part's stage, and a board's 12 frames with, in each, 300 stickies, 600 arrows and 50 groups.

### Formats of phase ②

**The list of changes** of a draft and of a sent edit (TERM-149, REQ-242) is a list of up to 300 changes, each an object:

| Field | Value |
| --- | --- |
| `kind` | `added`, `renamed`, `changed`, `removed`, `connected` or `disconnected` |
| `item` | The item's trace ID; for an item that the draft adds, its temporary name, `new-` with lowercase letters, digits and hyphens, up to 40 characters in all, unique in the draft, such as `new-1` |
| `before` | The fields of the item that the change touches, as the draft's version of the picture had them, named as the picture source's element names them ([Picture sources](#picture-sources)), such as `name`, `context` or a column's definition; empty for `added`. Each value is up to 300 characters |
| `after` | The same fields after the change; empty for `removed` |
| `to` | For `connected` and `disconnected`, the other item's trace ID or temporary name |
| `at` | For `added`, `{x, y}`: where the user placed the item (SPEC-175) |
| `quote` | Optional: up to 300 characters that the list shows with the change |

- A change applies to a newer picture when the item that it touches is in it with the fields of `before`, its other item too for a connection, and, for `added`, when no item of the new picture has its name (SPEC-170). `applies` gives `gone`, `changed` or `name-taken` otherwise. A redraw writes nothing to a draft.
- The list and the note are shown only as text (REQ-148), and the server reads only these fields. `elements` is the editor's own document, Excalidraw's elements or ERD Editor's, which the server keeps and gives back as it was sent, and which only the editor reads.
- **A board's elements** have the fields of stage 05's columns: a sticky's `id`, `frame`, `copies`, `kind`, `text`, `x`, `y`, `author`, `label`, `removed`, `removed_by`, `removed_at`, `made_version`, `version`, `changed_by` and `change`, and an arrow's and a group's likewise. A mark is `{element, mark}`, where `mark` is `added`, `changed`, `removed` or `restored` (SPEC-181).

### Error codes of phase ②

| Code | Status | Meaning | Members | Message | What the client does |
| --- | --- | --- | --- | --- | --- |
| `draft_not_found` | 404 | the picture has no open edit draft | none | There is no unsent edit here | the editor opens the picture itself, and its first save starts the draft |
| `draft_revision` | 409 | a request names another revision than the draft holds, or a first save finds a draft open; the members give the draft as last saved | `draft`, `revision`, `saved_at` | This edit was saved in another window | the view offers to load the draft as last saved, keeping the refused changes in the page until the user chooses |
| `draft_closed` | 409 | the named draft was sent or dropped; state says which, and edit names the sent edit | `state`, `edit` | This edit was sent or dropped already | the view reads the picture again |
| `picture_changed` | 409 | the picture holds a newer document version than the request starts from; latest gives it | `latest` | The picture changed since this edit began | the view shows the edit conflict over the newest picture |
| `draft_not_applying` | 409 | changes of the draft no longer apply to the latest picture; changes names them, each with why | `changes` | Some changes no longer fit the new picture | the view lists them apart, with editing again and dropping |
| `draft_too_large` | 413 | the draft would pass 1 MiB or 300 changes; field and limit name which | `field`, `limit` | This edit is too large. Send it or drop it first | the view says so and keeps the unsaved changes in the page |
| `unknown_name` | 400 | a report names temporary names that the edit does not hold; names gives them | `names` | The report names items that the edit did not add | the hub reports the names, and the agent checks the stage source |
| `position_limit` | 409 | the part's stage would keep more positions than its limit | `limit` | No more positions can be kept for this picture | the view says so and lays out the other items |
| `workshop_not_found` | 404 | the space holds no such workshop | none | This workshop is not here | the view reads the stage again; the hub reports it |
| `workshop_open` | 409 | the part has an open workshop; workshop gives it | `workshop` | A workshop is open for this part already | the view opens it; the hub reports its ID |
| `workshop_ended` | 409 | the workshop has ended, so its board is read-only and takes no new comment | none | This workshop has ended | the view shows the board read-only |
| `frame_not_next` | 409 | the frame to add is not the next step's; next gives it, or null after Step 9 | `next` | This is not the next step | the view offers the next step |
| `checkpoint_waits` | 409 | the next frame comes only after a checkpoint that has not passed; step gives its step | `step` | Pass this step's checkpoint first | the view opens the checkpoint box |
| `frame_closed` | 409 | the frame is not the board's last, or its checkpoint passed; frame gives it | `frame` | This step is closed | the view shows the board as it is |
| `element_changed` | 409 | an operation starts from an older version of its element; at gives the operation's place, element the element as it is now | `at`, `element` | This was changed meanwhile | the view puts the element back, says who changed it and keeps the refused text to copy |
| `not_placed_by_agent` | 403 | the agent changes, moves or removes what it did not place; element names it | `element` | The agent changes only what it placed | the hub reports it, and the agent asks in a comment on it |
| `board_limit` | 409 | the change would take the board past a limit; field and limit name it | `field`, `limit` | This board is full here | the view and the hub name the limit |
| `board_changed` | 409 | the board holds a newer version than the pass names; version gives it | `version` | The board changed since you looked | the view shows the board as it is now, to pass again |
| `not_checkpoint_step` | 409 | the frame is not the board's last, or its step has no checkpoint; step gives the last frame's | `step` | This step has no checkpoint | the view reads the board again |

Phase ② also uses 0.2's `invalid_request`, `unknown_item`, `user_only`, `agent_only`, `picture_not_found`, `part_not_found`, `edit_state`, `pull_request_reported`, `checkpoint_withdrawn`, `reflection_limit`, `space_full`, `text_too_long` and `body_too_large`, and the redesign's `item_not_found`. Its refusals keep the order of [Which refusal comes first](#which-refusal-comes-first): the `404`s of what a request names and `unknown_item` and `unknown_name` at 9, and the `409`s, with `not_placed_by_agent` and an operation's `user_only`, at 10.

Phase ② changes nothing that 0.2's clients send: its fields are optional, and its answers add members, which a client that does not know them ignores. The edit's new state, `dropped`, reaches a hub of 0.2 only in an answer that it prints as it reads it.

## Common rules

### Addresses and paths

- The server answers only at the address that the user set, which `nexus.url` names, and at no `workers.dev` or preview address, as phase 1 does (SPEC-113). The pages are `/`, `/pictures/…` and `/overview/…`, the view's code is under `/code/`, and the rest under `/api/`.
- `{project}` is the registered name: lowercase letters and digits in words joined by hyphens, up to 100 characters. `{part}` is a part's name of the same form, or `_` for the project as a whole, which a JSON body writes as `""`. `{stage}` is a stage key; only `01-domain`, `05-erd` and `07-sitemap` have pictures.
- The server's own IDs are a prefix and 12 random characters of lowercase Crockford base32, the digits and the letters but `i`, `l`, `o` and `u`: `nc_` for comments, `nd_` discrepancies, `np_` proposals, `ne_` edits, `nk_` checkpoints and `nw_` writes. The server makes them, apart from write IDs, which the page and the hub make. They are not trace IDs, and the hub never reads them as items.
- A path value in another form gets the `404` that a value the server does not hold gets, as phase 1 answers a project name, and never `400` ([choice 1](#choices-this-stage-made)).
- A query value in another form gets `400` `invalid_request` by its field, as a body's field does. The redesign's reads, API-152 and API-156 to API-158, take query values.

### Methods and bodies

- `GET` reads, and every `GET` also answers `HEAD`, with the same status and headers and no body. `POST` writes, and `DELETE` removes a project or ends a claim. A method that a path does not take gets `405` with an `Allow` header that names those it takes; an unknown path gets `404` `not_found`.
- A body is JSON, sent as `Content-Type: application/json` (otherwise `415` `json_required`) and in UTF-8 (otherwise `400`). A snapshot may have up to 1 MiB, and any other body up to 256 KiB (`413`). A request that takes no body reads none that is sent.
- A write's body holds only the fields that the contract names, and a field of another name is refused with `400`. A snapshot keeps the fields that the server does not know, as phase 1 does.
- A text that a write must have, such as a reply's, is refused with `400` when it is empty or white space only, and with `413` `text_too_long` when it is longer than its limit. Texts are stored as the client sent them; the hub redacts the agent's before it sends them (SPEC-128).

### Replies

- An answer is JSON, as `application/json; charset=utf-8`, with `200`, or `201` for a write that adds an entry. A page is `text/html; charset=utf-8`, and a file of the view's code has its own type.
- Every reply carries phase 1's headers: `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-Robots-Tag: noindex, nofollow` and `Cross-Origin-Resource-Policy: same-origin`, so that no reply is cached, shown in a frame of another site or indexed (SPEC-113). A JSON reply adds `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`.
- The hub page keeps phase 1's policy, which runs only its own inline script, by its digest, and sends no request: `default-src 'none'; script-src 'sha256-…'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`, with `Cross-Origin-Opener-Policy: same-origin`.
- The picture view and the stage overview load their code from `/code/` and send their requests only to the server (REQ-147): `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`, with `Cross-Origin-Opener-Policy: same-origin`. Their data is in a JSON script block, which the page reads as text and never runs.
- Only public content-hashed view code, styles and fonts may be kept by the browser and the same-origin Access-protected Cloudflare edge, with `Cache-Control: public, max-age=31536000, immutable`: each name carries a digest of the file's content, and they hold no project data. SPEC-113 allows this, as this stage's checkpoint changed it ([Changes to earlier stages](#changes-to-earlier-stages)).

### Errors

Every refusal and error is Problem Details (RFC 9457), sent as `application/problem+json`, apart from the pages' answers to a browser below, with these members (the contract's `Problem`):

| Member | Value |
| --- | --- |
| `title` | The code's short title in English, the same in every reply with that code |
| `status` | The reply's status |
| `detail` | One line that says what was wrong with this request; it may name its values, such as a field or a commit, but never a stored text |
| `code` | One of the [error codes](#error-codes) |
| `traceId` | The request's Ray ID, which Cloudflare sends in the `Cf-Ray` header, such as `8f6c3b2a1d0e9f80-ICN`, or 16 random hexadecimal digits where there is none, as on a device. The server's log line for an error holds the same ID |
| `error` | The same as `detail`, for hubs of 0.1, which show a refusal's `error` and read at most 4,096 bytes of a reply |
| others | The members that the code adds, which [Error codes](#error-codes) names, such as `field` and `limit` |

NEXUS sends no `type`, which RFC 9457 reads as `about:blank`, and no `instance`. A client ignores the members that it does not know, as RFC 9457 says. The view shows the code's message in the user's language, never `detail`; the hub shows `detail`. The server's log holds only the kind of an error and its trace ID, never a stored text or a value of the request (SPEC-113).

The three pages, API-101 to API-103, answer a refusal or an error as `text/html; charset=utf-8` when the request's `Accept` header names `text/html`, as a browser's does when it opens a page, and as Problem Details otherwise, since a browser shows those as raw text. The page holds one message, the code's in the server's language, with the trace ID, Load again and a link to the hub page; it has the reply's status and the policy `default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`, and stage 08's [rule 9](../08-screens/nexus/README.md#every-screen) draws it. The `/api/` requests and the view's code always answer Problem Details, and a view's own data holds them in `problem`.

### Which refusal comes first

A request that breaks several rules gets the refusal of the first in this order, which phase 1 keeps for its own checks:

1. Access: not checked, `403` `access_missing`; checked for another Access application, `403` `access_other_app`.
2. The path and the method: `404` `not_found`; `405` `method_not_allowed`; a path value in another form, the `404` of what it names.
3. A change that a browser sends from another site: `403` `cross_site`.
4. The kind of sign-in that a write needs: `403` `user_only`, `agent_only` or `no_kind`.
5. The headers, the write ID and the session label, and the query values: `400` `invalid_request`.
6. The body's type, `415` `json_required`, and its size, `413` `snapshot_too_large` or `body_too_large`.
7. The body: not UTF-8, not JSON or not in its form, `400` `invalid_request` or `invalid_snapshot`; a snapshot dated ahead, `400` `clock_ahead`; a text over its limit, `413` `text_too_long`.
8. The write ID: a write that the server took already gets its first answer, and an ID that another request took, `409` `write_id_reused`.
9. What the request names: `404` for the project, the space, the part, the picture or the entry, and `400` `unknown_item` for items that the picture does not hold.
10. The claims, the state and the limits: `409`.

## Sign-in

Cloudflare Access checks every request before the Worker sees it, as in phase 1. A request without a valid sign-in never reaches the Worker: Access sends a browser to its login page and answers a refused service token with a redirect, `401` or `403`. So no request lists `401`, and the contract says why in each `x-corthex.omit`.

The Worker then checks, as phase 1 does, that Access checked the request (`ctx.access`, otherwise `403` `access_missing`) for its own application (an `aud` that `ACCESS_AUD` names, otherwise `403` `access_other_app`), and takes the kind of sign-in from the identity that Access checked (SPEC-116):

| Identity | Kind |
| --- | --- |
| A non-empty `sub`: a person signed in with Access's login | `user` |
| An empty `sub` and a `common_name`: the client ID of a service token | `agent` |
| Anything else | neither: `403` `no_kind` for every write |

- Reads, pushes and removals take any identity that Access let in, as in phase 1, and never answer `no_kind`. A write that only one kind may send answers the other with `user_only` or `agent_only`, whose `needs` names the kind that it takes.
- Nothing of the identity is kept or logged: an entry keeps only its author's kind, `user` or `agent` (REQ-163).
- A sign-in can expire while a view is open. The view sends its requests with `redirect: "manual"`, so Access's redirect to its login page reaches it as an `opaqueredirect` reply; the view then says that the sign-in expired, keeps the text and offers to load the page again (SPEC-126).
- Chosen on 2026-11-03 by the development Access trial: read the kind from `Cf-Access-Jwt-Assertion`, after requiring `ctx.access` and checking its audience. Verify RS256 with the matching `kid` from the configured team’s public `https://<ACCESS_TEAM_DOMAIN>/cdn-cgi/access/certs`, the exact team issuer, `ACCESS_AUD`, expiry and any not-before time. `ACCESS_TEAM_DOMAIN` is the configured host, never a host taken from a token. Keep public keys for at most one hour and refresh on an unknown key. Fetch the keys with manual redirects and refuse a non-200 response; the trial’s `redirect: error` request failed before an HTTP response, while manual mode returned the keys and both signatures verified. `getIdentity()` did not give `sub` for the person or `common_name` for the service token. No identity value, JWT, cookie or credential is kept or logged. The security schemes below and in OpenAPI use this selected method.

## Writes

The user's writes come from the view and the agent's through the hub (SPEC-128). Each is one batch in D1, so two writes at once are taken one after the other (stage 05, [The writes of the user and the agent](../05-erd/nexus.md#the-writes-of-the-user-and-the-agent)).

### Write IDs

- Every write but a claim carries the header `Idempotency-Key` with its write ID, an `nw_` ID that the page or the hub makes for that one write and sends with each try of it, in double quotes as the draft writes it: `Idempotency-Key: "nw_6t9w2z5c8f1j"`. Without it, or in another form, the write is refused with `400` `invalid_request`, whose `field` is `Idempotency-Key`.
- The server keeps the ID of each write that it took, with the request's name and its first answer, for 7 days (TBL-112). A write sent again with that ID gets that answer, with the same status, and changes nothing. A write that the server refused leaves no ID behind, so it is checked again when it is sent again.
- An ID that the server holds for another request is refused with `409` `write_id_reused`. NEXUS compares the request's name, which TBL-112 keeps, and not the body.
- Where NEXUS differs from the draft: it answers an ID of another request with `409` and not `422`, since a write ID that comes back for another request is a fault of the client, as `409` says for the other conflicts of a write; it keeps no write that is still being processed, since each write is one transaction, so a second try waits for the first and gets its answer; and it forgets an ID after 7 days, when the hub's outbox has dropped the write too.
- A push needs no write ID, since the commit rule tells a new snapshot from one sent again ([A push](#a-push)), and a removal needs none, since a second one gets `404`. A claim needs none, since claiming twice leaves one claim.

### Request names

The name that TBL-112 keeps for each write, and the outbox for the agent's:

| Name | Request | Who |
| --- | --- | --- |
| `comment` | API-118 | either |
| `reply` | API-119 | either |
| `answered` | API-120 | either |
| `decision` | API-121 | agent |
| `proposal` | API-122 | agent |
| `withdraw-proposal` | API-123 | agent |
| `accept` | API-124 | user |
| `dismiss-proposal` | API-125 | user |
| `report-edit` | API-126 | agent |
| `dismiss-edit` | API-127 | user |
| `checkpoint` | API-128 | user |
| `withdraw-checkpoint` | API-129 | user |
| `report-checkpoint` | API-130 | agent |

### Sessions

- The agent names its session in the header `Nexus-Session` with a label of 1 to 100 ASCII letters, digits, `.`, `_`, `:` and `-`, which it keeps for the session, such as the host's session ID or, without one, a label that it makes at the session's start, such as `claude-code-4f2a91`. The label holds nothing personal (SPEC-128). The hub takes it from `--session` or the environment variable `CORTHEX_NEXUS_SESSION`.
- Every write of the agent's carries it, and one without it is refused with `400` `invalid_request`, whose `field` is `Nexus-Session`. The agent to-do reads it to mark the session's own claims. The user's writes need none, since no claim holds the user back, and the server does not read one that they carry.

### Claims

- The agent claims an entry of its to-do, a comment, a discrepancy, an edit or a checkpoint, for its session (API-131, SPEC-136). The claim lasts until 60 minutes after the session's last write on the entry: each such write and each claim again moves its end on. It ends at that time, when the entry closes or when the session releases it (API-132). An entry is closed when the to-do no longer lists it: a closed comment, a resolved discrepancy, a closed or dismissed edit, a recorded checkpoint, or a withdrawn one that no open pull request and no stored record names.
- While a claim lasts, the agent's writes on the entry from other sessions are refused with `409` `claimed`, whose `ends_at` gives the claim's end, and the to-do shows the entry to them as taken until then. The user's writes are never refused for a claim.
- A claim of another session's entry, of a closed one or of one that a reported pull request holds is refused with `409` `claimed`, `entry_closed` or `pull_request_reported`. A report of an opened pull request ends the claim on the entry, since the pull request holds the entry from then on, for every session, until it is merged or closed (SPEC-133, SPEC-140).
- Which entry a write is on:

| The agent's write | The entry it is on |
| --- | --- |
| A reply, marking answered or a decision | The comment |
| A comment on a discrepancy | The discrepancy |
| A proposal in answer to a comment or a discrepancy, and its withdrawal | That comment or discrepancy |
| A report of a reflection | The edit |
| A report of a record's pull request | The checkpoint |
| A comment on an item, or a proposal of the agent's own | None |

### Answers that change nothing

A write whose outcome holds already changes nothing, and its answer says so with `changed: false`: marking answered a comment that is closed, whether as answered or as decided (SPEC-127); withdrawing a proposal or a checkpoint that is withdrawn already, or dismissing a reflection that is dismissed already; and a report that repeats the last one of its entry. A write that another outcome has closed is refused with `409` and the state that closed it: accepting or dismissing a proposal that is not open (`proposal_not_open`, SPEC-131), and a report that does not fit its entry's state. A write sent again with its write ID gets its first answer, whatever it said ([Write IDs](#write-ids)).

## A push

A push (API-136) brings the stored snapshot, the project space, its pictures, its discrepancies and its checkpoints to the default branch's latest commit that the device fetched (SPEC-111, SPEC-114):

1. The hub sends the project's outbox first ([The outbox](#the-outbox)).
2. It asks for the held commit (API-109): the stored snapshot's `revision` and `default_commit`. `404` `project_not_found` means that the server holds none. A `404` without a `code` comes from a server of phase 1, which needs the 0.2 release first; the hub then sends nothing.
3. It takes a fresh snapshot (API-133) and checks its default commit with Git, reading the repository as SPEC-105 does:

| The server holds | The snapshot's commit | The hub |
| --- | --- | --- |
| No snapshot, or none with a default commit | any | Sends it without `replaces` |
| Commit H | H | Sends it without `replaces` |
| Commit H | A descendant of H | Sends it with `replaces: H` |
| Commit H | H's ancestor, or the checkout does not have H | Sends nothing, and says to fetch the default branch and push again |
| Commit H | Not a descendant of H, as after the default branch was rewritten | Sends nothing, and names both commits; with `--replace-held`, which the agent uses only after the user agrees, sends it with `replaces: H` |
| Commit H | None, since the checkout has no default branch | Sends nothing, and says how to record the head (`git remote set-head origin --auto`) |

4. It sends the snapshot (API-105), compact JSON of at most 1 MiB.
5. The server stores it when it is the next version, by the commit rule, which compares commits by their names only:

| The server holds | The snapshot | The server |
| --- | --- | --- |
| Nothing of the project | any | Stores it as a new project, unless it holds 30: `409` `too_many_projects` |
| A snapshot without a default commit | any | Stores it when it was made no earlier than the stored one, otherwise `409` `older_snapshot` with `stored_at` |
| Commit H | Of H | Likewise |
| Commit H | Of another commit, with `replaces: H` | Stores it |
| Commit H | Of another commit without `replaces: H`, or of no commit | `409` `commit_not_replaced` with `held_commit` |
| Commit H, and another push stored first since this one read it | any | `409` `commit_not_replaced` with the new `held_commit` |

6. For a snapshot of 0.2, the same request creates the project's space when there is none, bound to the repository's address (SPEC-117), draws the pictures that changed and marks those that are not current (SPEC-118), cross-checks the parts whose pictures changed or became current again (SPEC-120, SPEC-121) and marks the checkpoints that the stage records name (SPEC-140), all of it or none (stage 05, [A push](../05-erd/nexus.md#a-push)). A snapshot whose address is not the one that the space is bound to, or that has none while the space has one, is refused with `409` `repository_mismatch`, with `bound`. A space bound to no address takes the first one that a snapshot names (stage 05's choice 9).
7. The server answers with the revision, the default commit that it now holds, the commit that it replaced, the pictures drawn, made current again or marked not current, the discrepancies opened and resolved, the checkpoints recorded and the counts of the agent to-do, each list up to 20 (`PushAnswer02`). A snapshot of 0.1 gets phase 1's answer, its `name` and `revision`, and changes nothing but the stored snapshot: a space, if the project has one, keeps its pictures and entries.

The address that a space is bound to is the `origin` remote's address in one form, which the hub writes into the snapshot and the server compares: without a user name or password; `git@example.com:owner/repo.git` and `ssh://git@example.com/owner/repo.git` as `https://example.com/owner/repo`; without a final `.git` or `/`; with the host in lowercase; and `https` for `http`.

A push that gets no answer within 30 seconds, or no network, is reported and nothing is kept, since the next push takes a fresh snapshot (SPEC-111).

## Reads

| Read | Holds | Up to |
| --- | --- | --- |
| The hub page (API-101) | Every stored snapshot and, for each project that has a space, its pictures, its counts of open comments, proposals and discrepancies, its checkpoints passed in NEXUS that wait for their records and its `checkpoint-withdrawn` warnings (SPEC-123) | 150 pictures, 100 checkpoints and 100 warnings for each project, with their totals |
| A picture (API-111) | The picture source with its document version and whether it is current; its open comments, the most recently active first, each with its count of replies and its last reply; its closed comments by ID; its open proposals, without their stage source text; its reflections that are not closed; and the open discrepancies of its part that concern it (SPEC-119) | 500 of each, and 1,000 discrepancies, with their totals |
| A stage's overview (API-112) | The stage's record and checks from the snapshot; its open discrepancies, open comments and pending reflections; and its checkpoints passed in NEXUS that no record names yet, or that a record names after their withdrawal (SPEC-138) | 50 of each, with their totals |
| The agent to-do (API-113) | In its order: the comments that wait for the agent, the open discrepancies, the pending reflections and the checkpoints ([The agent to-do](#the-agent-to-do)) | 50 of each, with their totals |
| One comment (API-114) | Its replies, decisions and proposals | All of them: 200 replies at most |
| One proposal (API-115), edit (API-116) or checkpoint (API-117) | The whole entry, with a proposal's stage source text | |
| The dry run of a removal (API-110) | What the removal deletes, with the open comments, open proposals, pending reflections and checkpoints that no record names yet by ID | 20 of each, with their totals |

Implementation clarification (2026-11-04): `CommentThread.proposals` has no lifetime array cap. The 500-proposal limit applies to open proposals in a space, not to a comment's historical proposals. The OpenAPI schema now agrees with API-114's existing promise to return all of them.

The view finds which comments, proposals and discrepancies are apart, those whose item the current picture no longer holds, since only it reads the picture source's items (SPEC-119). A project without a space, which only hubs of 0.1 pushed, has no pictures: its picture view and its to-do are `404` `space_not_found`, and its overview shows the record and checks only.

### The agent to-do

The to-do (API-113, SPEC-135) lists, in this order:

1. The open comments that wait for the agent ([How a comment waits](#how-a-comment-waits)), oldest first.
2. The open discrepancies, `warn` before `info`, oldest first.
3. The pending reflections, those without a pull request first, oldest first.
4. The checkpoints passed in NEXUS that no stored record names, oldest first, then the withdrawn ones that an open pull request or a stored record still names, each with `why`: `not-recorded`, `withdrawn-in-review` or `withdrawn-recorded`.

It also counts the comments that wait for the user (`waiting_for_user`) and the entries that other sessions claim (`taken`). An entry that a session claims carries the claim's end, marked `mine` when it is the session that `Nexus-Session` names; without the header, every claim counts as another session's. A reflection or checkpoint that a reported open pull request holds carries the pull request, so that other sessions skip it as in review.

## How a comment waits

A comment's entries are its text, its replies and the proposals that answer it, with their acceptance or dismissal; a withdrawn proposal does not count.

| The last entry | `waits` |
| --- | --- |
| The user's: the comment, a reply, or accepting or dismissing a proposal that answers it | `agent` |
| The agent's: the comment, a reply or an open proposal that answers it | `user` |
| The comment is closed | `null` |

- `settled` is `true` once a reply of the user's settles the comment, and the comment then waits for the agent to record the decision (SPEC-127, SPEC-132). A decision closes the comment as `decided`.
- `dismissed` is `true` while the last proposal that answered it was dismissed and the agent has not written on the comment since (SPEC-131).
- The user's reply to a closed comment opens it again, and it waits for the agent; the agent's is refused with `409` `comment_closed`. Opening a comment again is that reply, with no request of its own.

## Reports

### Reports of a reflection

The agent reports what became of a pending reflection (API-126, SPEC-133). `opened`, `merged` and `closed` carry the pull request, `reflected` the commit whose stage source already holds the change, and `needs-user` nothing:

| Event | The edit's state | Becomes |
| --- | --- | --- |
| `opened` | `pending` or `needs-user` | `in-review`, held by the pull request |
| `merged` | `in-review` with that pull request, or `pending` or `needs-user` | `closed`, with the pull request |
| `closed` | `in-review` with that pull request | `pending` |
| `reflected` | `pending` or `needs-user` | `closed`, with the commit as `closed_commit` |
| `needs-user` | `pending` | `needs-user`, which the user may dismiss (API-127) |

- A report that repeats the edit's last report changes nothing (`changed: false`).
- `opened` for an edit that another reported pull request holds is refused with `409` `pull_request_reported`, and `merged` or `closed` for another pull request than the held one with `409` `pull_request_mismatch`; both name the held pull request.
- Any other report that does not fit the edit's state is refused with `409` `edit_state`, whose `state` gives the state. An event without its field, or with a field that it does not take, is refused with `400`.

### Reports of a record's pull request

The agent reports the pull request that writes a checkpoint passed in NEXUS into its stage record (API-130, SPEC-140):

| Event | The checkpoint | Becomes |
| --- | --- | --- |
| `opened` | Passed, with no reported pull request open | `pr_state: open`, held by the pull request |
| `merged` | Its reported pull request is open | `pr_state: merged` |
| `closed` | Its reported pull request is open | `pr_state: closed`, free for any session to claim |

- `opened` for a withdrawn checkpoint is refused with `409` `checkpoint_withdrawn`, so no new record names it. `merged` and `closed` are still taken for a withdrawn checkpoint's open pull request, which the agent closes (SPEC-140).
- A merged pull request does not record the checkpoint: the next push whose stored records name it does, and sets its `recorded_commit`.
- Repeats and other pull requests are answered as for a reflection.

Implementation clarification (2026-11-04): API-130 returns `409 checkpoint_state` for `merged` or `closed` without a reported open pull request, and for a new `opened` after a stored record names the checkpoint. Repeating its last report still changes nothing. This fills an unspecified refusal without changing SPEC-140's state transitions.

## The hub's commands

### Running a command

- The hub is `hub.py` in the `scripts` folder of the hub skill, in standard-library Python 3.8 or later on Windows, macOS and Linux, as in phase 1. It keeps phase 1's options `--home` and `--version`, and its five commands with their options, which 0.2 extends as each command below says.
- The commands that reach the server, `push`, `remove`, `todo`, the agent's writes, `show`, `claim`, `release` and `outbox --send`, take its address from `--url`, then `CORTHEX_NEXUS_URL`, then `nexus.url` in the profile: `https`, or `http` only for the device itself. They send the service token from `CORTHEX_NEXUS_CLIENT_ID` and `CORTHEX_NEXUS_CLIENT_SECRET`, which a server on the device does not need, and never write it to a file, a log or a message (REQ-109, REQ-110). They follow no redirect, and take a redirect, or a `401` or `403` without a JSON reason, as a refused token (REQ-111). They work only for the projects in `nexus.push`, apart from `remove`.
- The agent's writes, `claim` and `release` need the session label, from `--session` or `CORTHEX_NEXUS_SESSION`; `todo` reads it when it is given.
- A text comes from `--text TEXT`, or from `--text-file FILE`, where `-` is standard input, in UTF-8; likewise `--reason` and `--reason-file`, `--change` and `--change-file`, and `--source-file`. Before it sends a text, the hub redacts it as it redacts a snapshot: secrets and email addresses become `[redacted]`, and the user's home folder becomes `~` (SPEC-128).
- `--part PART` names a part; without it a command concerns the project as a whole.
- `--json` prints, for each project, one line with a JSON object: `command`; `project`; `outcome`, as below; `answer`, the server's answer; `problem`, the server's Problem Details of a refusal; `failure`, the kind of a failure or of the hub's own refusal, such as `no network`, `timeout`, `HTTP 503`, `no service token`, `refused token` or `not in nexus.push`; and `outbox`, how many of its writes were `sent`, `dropped` and are `waiting`. Without it, the hub prints the same in lines for a person.
  When a write is dropped, `outbox.notices` additionally names its write ID and reason (the Problem Details or the failure kind), never its body. This supplies the drop report below, including seven-day expiry, without exposing a kept text.
  Only when an agent write cannot be persisted, the failed result also has `recovery`: its original redacted OutboxFile, including its write ID and body. The command shows this once to the calling agent, as SPEC-129 requires; it does not save or log this copy. The agent keeps the text in its session and preserves that ID when recovering it. Ordinary results and outbox listings have no recovery text.

| Exit code | Outcome | When |
| --- | --- | --- |
| 0 | `done` | The command did what it asked, also for a write that changed nothing, one that the server had taken already, a removal of a project that the server does not hold, and an empty to-do |
| 1 | `refused` or `failed` | The server or the hub's own checks refused it, or it could not reach the server, and nothing waits to be sent again |
| 2 | | The command line is wrong: an unknown option, an ID or a label in another form, a text file that is not UTF-8, a missing session label, or a link or role that holds a secret or an email address |
| 3 | `kept` | The write waits in the outbox ([The outbox](#the-outbox)) |

### Snapshots and records

`snapshot` (API-133):

```txt
hub.py snapshot [PROJECT ...] [--path FOLDER] [--repo ALIAS=FOLDER ...] [--print]
```

As in phase 1, in the format `corthex-hub/0.2` ([Snapshot 0.2](#snapshot-02)): from 0.2 the snapshot also holds the parts, the picture sources from the default branch's commit, the stage records from the repository and the actions to ask about first (SPEC-104 to SPEC-110), and its checks include the [new rules](#check-rules).

`status` (API-134):

```txt
hub.py status PROJECT STAGE [--part PART] [--state STATE] [--next TEXT]
              [--checkpoint TEXT --by ROLE --date DATE [--where LINK] [--nexus CHECKPOINT]]
              [--check LEVEL MESSAGE ...] [--clear-checks] [--reset] [--repository]
```

- It writes the stage's record into the repository's working tree, `.corthex/stages/<part>.json`, or `.corthex/stages.json` for a project without parts, when the checkout holds stage records, or, for the first record, with `--repository` (SPEC-137). Otherwise it writes the device's status file, as in phase 1. The agent commits the record with the work, in its pull request; the hub never commits, pushes or opens a pull request.
- In the records, `--checkpoint` adds a checkpoint to the stage's list: what was approved, `--by` the role that approved it, such as `the maintainer`, `--date`, and `--where`, a link to where it was approved. `--nexus` names a checkpoint passed in NEXUS, whose link, by default, is its stage overview on the server, `<nexus.url>/overview/<project>/<part>/<stage>#<checkpoint>` (SPEC-140). `--state done` needs a checkpoint with its date in the record (REQ-085). In the status file, `--checkpoint` keeps phase 1's meaning.
- The file is written as TBL-115 says: JSON indented by two spaces, its fields in their order and a final LF, through a temporary file and a move. `updated` is the time of the write, with the device's zone.

`build` (API-135):

```txt
hub.py build [PROJECT ...] [--out FILE] [--no-scan]
```

As in phase 1, with the page data `corthex-hub-page/0.2` ([Page data](#page-data)): each part's stage records and the actions to ask about first. A page built on a device has no `spaces`, and says that the pictures and the counts are on the server (SPEC-123).

### Pushes and removals

`push` (API-136):

```txt
hub.py push [PROJECT ...] [--url URL] [--dry-run] [--replace-held]
```

- Without names it pushes every project in `nexus.push`, each as [A push](#a-push) says, and reports the answer: the revision, the pictures drawn again, made current again or marked not current, the discrepancies opened and resolved, the checkpoints recorded and what waits in the agent to-do (SPEC-111).
- `--dry-run` sends nothing, not even the outbox or the question for the held commit: it shows each snapshot's counts and size, the pictures that it would send and those that it leaves out, and says that the held commit is checked when it is sent.
- `--replace-held` sends a snapshot whose commit is not a descendant of the held one, naming the held one as the one it replaces. The agent uses it only after the user agrees.
- Outcomes: `done`; `refused`, for a project that is not in `nexus.push`, no address, no token's variables, which it names without a value, a commit that the table of [A push](#a-push) rules out, a server of phase 1, a refused token or a refusal of the server, with its reason; `failed`, for no network or no answer within 30 seconds. A push is never kept, since the next one takes a fresh snapshot.

`remove` (API-137):

```txt
hub.py remove PROJECT ... [--url URL] [--dry-run]
```

- `--dry-run` reads what the removal would delete (API-110) and shows it, with the open comments, open proposals, pending reflections and checkpoints not yet recorded, by ID, up to 20 of each with their totals. Unlike phase 1's, it reaches the server and needs the service token. The hub skill has the agent show it, offer to answer, reflect or record those entries first, and send the removal only once the user confirms (SPEC-115).
- Without `--dry-run`, it sends the removal (API-108). `404` `project_not_found` is reported as nothing to remove, with exit code 0, as in phase 1. After a removal the hub deletes the project's outbox, and when the project is still in `nexus.push` it says that the next push brings the project back with an empty space, and how to take it off the list.
- It takes projects whether `nexus.push` lists them or not, as in phase 1.

### The agent's work

`todo` (API-138):

```txt
hub.py todo PROJECT [--session LABEL]
```

It sends the project's outbox, reads the agent to-do with the session label and prints it in its order, with the counts of comments that wait for the user and of entries that other sessions took (SPEC-135). `404` `space_not_found` gives an empty to-do and exit code 0, and the agent says nothing about it. No service token, or no answer, is `failed`, and the agent goes on with its work (REQ-185).

The writes (API-139 to API-146):

```txt
hub.py comment  PROJECT --stage STAGE [--part PART] [--item ID] [--quote TEXT]
                [--discrepancy ID] [--commit COMMIT] [--asks ASKS] (--text TEXT | --text-file FILE)
hub.py reply    PROJECT COMMENT [--asks ASKS] (--text TEXT | --text-file FILE)
hub.py answered PROJECT COMMENT
hub.py decide   PROJECT COMMENT --link LINK [--text TEXT | --text-file FILE]
hub.py propose  PROJECT --stage STAGE [--part PART] --item ID [--item ID ...] [--adds ID ...]
                (--reason TEXT | --reason-file FILE) (--change TEXT | --change-file FILE)
                [--source-file FILE] [--comment ID | --discrepancy ID] [--commit COMMIT]
hub.py withdraw PROJECT PROPOSAL
hub.py reflect  PROJECT EDIT EVENT [--pr LINK] [--commit COMMIT]
hub.py record   PROJECT CHECKPOINT EVENT --pr LINK
```

- Each sends one write with a new write ID and the session label (API-118 to API-123, API-126 and API-130), after the project's outbox. `comment` takes any of the 13 stages in `--stage`; without `--item` it comments on the stage as a whole, and `--quote` quotes the part of a picture that it is on. `comment` and `reply` take `--asks answer|recommended|checkpoint`, what the agent asks of the user (SPEC-143). Both come with hub 0.3.0; a server of 0.2 refuses a stage without a picture, a comment with neither an item nor a quote, and `asks`, as `invalid_request`. `reflect` takes the events `opened`, `merged`, `closed`, `reflected` and `needs-user`, and `record` takes `opened`, `merged` and `closed` ([Reports](#reports)).
- `decide` refuses, before sending, a link that is not `https` or that holds a secret or an email address (SPEC-132).
- A write that cannot be sent waits in the outbox, with exit code 3; a refusal of the server is reported with its reason and is not sent again (SPEC-128, SPEC-129).

`show` (API-147):

```txt
hub.py show PROJECT ID
```

It reads one comment, proposal, edit or checkpoint by its `nc_`, `np_`, `ne_` or `nk_` ID (API-114 to API-117): a comment with all its replies, a proposal with its stage source text, and a checkpoint, which the agent reads before it merges the pull request of its record (SPEC-140). The to-do and the overview hold discrepancies whole, so an `nd_` ID is a wrong command line.

`claim` and `release` (API-148, API-149):

```txt
hub.py claim   PROJECT ENTRY
hub.py release PROJECT ENTRY
```

They claim an entry for the session, or end the session's claim (API-131, API-132). A claim is never kept in the outbox: one that cannot be sent leaves the entry untaken, and the hub says so (stage 05, [Outbox](../05-erd/nexus.md#outbox-tbl-117)).

### The outbox

`outbox` (API-150):

```txt
hub.py outbox [PROJECT ...] [--send]
```

It lists the writes that wait, by project, with their request, when they were made, their tries and their last failure, but no text; `--send` sends them.

- A write is kept when it cannot be sent: no network, no answer within 30 seconds, `429`, `500`, `502`, `503` or `504`, no service token on the device, a refused token, or `403` `access_missing` or `access_other_app`, which a fixed Access setup will let through (SPEC-129).
- A write is dropped, and reported with its reason, when the server refuses it for another reason, such as `409` or `404`, since sending it again changes nothing, and 7 days after it was made, since the to-do that it answered has moved on.
- At each contact with the server for a project, a push, `todo`, a write, `show`, `claim`, `release` or `outbox --send`, the hub first sends that project's outbox, oldest first, each write with its own write ID and session label. It stops at the first write that is kept again, so that the writes keep their order.
- Each write is one file, `outbox/<project>/<time>.<write>.json` under `~/.corthex/hub/` (TBL-117), in the form of the contract's `OutboxFile`. The hubs of one device take turns on a project's outbox with the lock `outbox/<project>.lock`, as stage 05 says.
- A fresh agent write enters that queue before its first send. The device-only ID ordering metadata preserves admission order at millisecond ties; neither a concurrent append nor a lost sender's lease makes a new direct send bypass it. Successful first sends remove their transient files too, so the reported drain counts include them.
- The outbox never holds the service token, and the hub never shows a kept write's text in a log.

## Formats

### Snapshot 0.2

The fields that `corthex-hub/0.2` adds to phase 1's format are those of TBL-114 in stage 05's [Snapshot](../05-erd/nexus.md#snapshot-tbl-114), and the contract's `Snapshot02` checks them. An excerpt, with lists cut short:

```json
{
  "schema": "corthex-hub/0.2",
  "generator": "corthex-nexus 0.2.0",
  "generated_at": "2026-11-03T10:00:00+09:00",
  "project": { "name": "acme-shop", "title": "Acme Shop", "parts": ["orders", "billing"] },
  "repos": {
    ".": {
      "commit": "<full commit id>", "branch": "work", "dirty": true,
      "web": "https://github.com/example/acme-shop", "url": "https://github.com/example/acme-shop",
      "default": { "branch": "main", "commit": "<full commit id>", "time": "2026-11-03T09:40:00+09:00" }
    }
  },
  "replaces": "<the held commit>",
  "records": { "from": "repository", "commit": "<full commit id>", "time": "2026-11-03T09:40:00+09:00" },
  "stages": {
    "05-erd": {
      "state": "in_progress", "source_state": "found",
      "parts": {
        "orders": { "state": "in_progress", "checkpoints": [], "next": "Index the orders by date", "updated": "2026-11-03T09:30:00+09:00" }
      }
    }
  },
  "items": [], "checks": [], "summary": {},
  "pictures": [
    { "part": "orders", "stage": "05-erd", "commit": "<full commit id>", "time": "2026-11-03T09:40:00+09:00",
      "source": { "format": 1, "tables": [], "without_table": [] } }
  ],
  "left_out": [{ "part": "billing", "stage": "07-sitemap", "why": "other-repository" }],
  "ask_before": { "entries": ["releases", "deletions"], "source": "project", "left_out": ["external messages", "deploys", "payments", "publishing"] }
}
```

- The hub sends it as compact JSON. It keeps phase 1's limits of 3,000 items, 2,000 checks and 1,000,000 bytes, under the server's 1 MiB. When the picture sources would take it over, whole pictures are left out, the largest first, each named in `left_out` with `why: size` and in a `picture-left-out` check (REQ-192).
- `repos.".".url` is the `origin` remote's address in the form of [A push](#a-push), and `repos.".".default` the default branch as SPEC-105 finds it. Without them, the snapshot has no picture sources and a `pictures-not-sent` check.
- `replaces` is the held commit that the push replaces ([A push](#a-push)); `hub.py snapshot` writes none.
- `records` says where the stage records came from: `repository`, with the commit and its time, or `status-file`.
- The server stores the snapshot without `pictures`, whose sources the pictures keep (stage 05's choice 3), so `API-107` returns the snapshot without them, the contract's `StoredSnapshot02`.

### Picture sources

Each picture source has `format: 1` and one of three shapes, the contract's `DomainSource`, `ErdSource` and `SitemapSource`. The hub takes them from the stage sources' documents of one part at the default branch's commit (SPEC-105 to SPEC-108):

- Each element has `where`, its file and line at the commit, relative to the repository, such as `docs/05-erd/nexus.sql:15`.
- An element's `id` is its trace ID, or `""` when it has none; `context` is a CTX ID, or `""`. Names are cut at 120 characters and other texts at 300, as titles are, and each list stops at the contract's limit for it.
- `removed` is `true` for an element whose status says that it is removed, as [reading.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex-nexus/skills/corthex-hub/references/reading.md) reads statuses.
- Secrets and email addresses become `[redacted]` (REQ-191).
- A document that the forms below cannot fully read gives what could be read, with a `picture-partial` check that names the place.

**DDD board (`01-domain`).** The forms of the stage 01 template, [01-domain.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex/skills/corthex-discover/references/01-domain.md), in English, and in Korean as its Korean documents write them, such as [docs/01-domain/nexus.ko.md](../01-domain/nexus.ko.md). The hub finds a table by its header row, reads the columns named here in any order, compares the names ignoring case and spacing, and ignores other columns.

| Element | English form | Korean form |
| --- | --- | --- |
| A context | A heading that starts with its CTX ID and then its name, such as `### CTX-001 Ordering`, with a line `Purpose: …` and a bullet `- External systems: …` under it | The same heading, with `목적: …` and `- 바깥 시스템: …` |
| Its type and aggregates | A table with the columns `Context`, `Type` and `Aggregates` | `컨텍스트`, `종류`, `애그리거트` |
| Its command rows | A table with the columns `Given by`, `Read model`, `Command`, `Aggregate` and `Events`, under the context's heading. A row whose `Given by` holds `Policy: when …`, alone or after who else gives it, is a policy | `주는 쪽`, `읽기 모델`, `명령`, `애그리거트`, `사건`; `정책: …` |
| The read models | The read models of the command rows, and a table with the columns `Read model` and `Shows` | `읽기 모델`, `보여 주는 것` |
| The dependencies | A table with the columns `From`, `To`, `Kind`, `Why` and `Data`. A kind that starts with `call` is `call`, one that starts with `event` is `event`, and any other `""` | `어디서`, `어디로`, `종류`, `까닭`, `오가는 것`; `바로 묻기` is `call`, `사건 알림` is `event` |
| The hotspots | A table with the columns `Hotspot`, `Context`, `State` and `Answer or next step`. A number at the start of the text, such as `1.`, is the hotspot's `number`, and the CTX IDs under `Context` its contexts | `핫스팟`, `컨텍스트`, `상태`, `답이나 다음 할 일` |
| The glossary | A table with an `ID` column of TERM IDs and a `Term` column | `ID`, `용어` |
| Removed contexts and terms | A table with an `ID` column and a `Status` column that says removed | `ID`, `상태`, with `삭제` |
| The timeline | A table with the columns `Lane` and `Events`, one row for each lane, in order. In `Events`, ` → ` separates the places, from left to right, and `, or ` the events stacked in one place | `흐름`, `사건`; ` 또는 `, with or without a comma before it |

An aggregate or read model takes the TERM ID written beside its name, as `Picture (TERM-085)`, or else that of the glossary row, in the same document, whose term is its name, ignoring case and spacing; with none, or with two such rows, it gets a `board-term-missing` warning (SPEC-106).

A command table outside a context's heading keeps its rows under the nearest context heading above it, with a `picture-partial` check. If none precedes it but the document has a context elsewhere, the rows stay in a context whose `id` and `name` are empty, and their aggregates and read models have `context: ""`. A document with no context contributes no DDD board, including none of its dependencies or timeline (SPEC-106).

In a command row's `Events`, commas separate the events, and a leading `or` (`또는`) is not part of a name, so `Payment taken, or Payment failed` gives two events. The timeline is optional: a document without one gives no `timeline`, and the view then shows the board only as a whole (SPEC-141). Each lane keeps its `where`, the line of its row.

**ERD (`05-erd`).** The SQL of [reading.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex-nexus/skills/corthex-hub/references/reading.md) and the stage 05 template, [05-erd.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex/skills/corthex-contract/references/05-erd.md):

```sql
-- without a table: TERM-122
-- TBL-101 snapshots (CTX-009, terms: none) ← SPEC-111, SPEC-114
CREATE TABLE snapshots (
  name TEXT PRIMARY KEY,
  revision INTEGER NOT NULL
);
-- TBL-103 pictures (CTX-012, TERM-085) ← SPEC-118
CREATE TABLE pictures (
  project TEXT NOT NULL REFERENCES snapshots (name) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  PRIMARY KEY (project, stage)
);
```

- A table is a `CREATE TABLE` that a TBL ID comment defines. The parentheses after its name give its context, a CTX ID, and either its TERM IDs or `terms: none`. A comment with neither leaves `terms` out, which SPEC-121 reports.
- A column has its name, its type as written and `null`, which is `false` for `NOT NULL` and for a column of the primary key. The primary key comes from `PRIMARY KEY` on a column or in the table; a unique rule from `UNIQUE` on a column or in the table, or from `CREATE UNIQUE INDEX … ON`, with `partial: true` for one with `WHERE`; a foreign key from `REFERENCES` on a column or in the table, or from `ALTER TABLE … ADD [CONSTRAINT …] FOREIGN KEY`, with `on_delete` in lowercase, or `""` without one.
- A comment line `-- without a table:` followed by TERM IDs, anywhere in the part's SQL, lists the aggregates that the part keeps outside tables.
- An index expression that cannot be represented as column names is omitted as a whole unique rule, with a `picture-partial` check; a function name is never drawn as a column. Removed status words in table comments use the same vocabulary as other stage items: an explicit `status:` (`상태:`) wins; otherwise a standalone metadata field in parentheses or after a `|` may mark removal. Words in a table name or descriptive title are not its status. Quoted identifier/title spans are excluded before metadata delimiters are read, including escaped quotes; a quoted status value remains a value.
- The markers `terms: none`, `without a table:` and `without a screen:` are the same in every language, as the code around them is.

**Sitemap (`07-sitemap`).** The YAML of the stage 07 template, [07-sitemap.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex/skills/corthex-screen/references/07-sitemap.md), with `terms`, here two screens of NEXUS's own [nexus.yaml](../07-sitemap/nexus.yaml):

```yaml
- id: SCR-104
  name: Stage detail
  path: "/#p={project}&s={stage}"
  access: anyone Cloudflare Access lets in, or the device's user
  flows: [FL-105, FL-113]
  terms: none
  status: active
  children:
    - id: SCR-109
      name: Stage overview
      path: "/overview/{project}/{part}/{stage}"
      access: anyone Cloudflare Access lets in, on the server
      flows: [FL-113]
      terms: [CTX-007, TERM-120]
      status: active
# without a screen: TERM-121
```

- Each screen keeps `id`, `name`, `path`, `access`, `flows` and, from the nesting under `children`, `parent`, the place of its parent in `screens`. A parent that the part does not hold puts the screen at the top, with a `picture-partial` check.
- `terms` holds the screen's context, a CTX ID, and the TERM IDs that it stands for; `terms: none` and `terms: []` say that it stands for none, and a screen with neither leaves `terms` out.
- A comment line `# without a screen:` followed by TERM IDs lists the read models that the part shows on no screen ([Changes to earlier stages](#changes-to-earlier-stages)).

### Project settings

The project settings, `.corthex/project.json`, gain two fields, which the core plugin's [project.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex/skills/corthex/references/project.md) adds with the 0.2 release:

| Field | Type | Meaning |
| --- | --- | --- |
| `parts` | array of strings | Optional. The project's parts, in the order in which the hub page shows them: 1 to 50 different names in lowercase letters and digits joined by hyphens, up to 100 characters each. A document belongs to the part whose name starts its path in the stage source, followed by `/`, `.` or `-`, and the longest such name wins: in a stage source `docs/01-domain/`, `nexus.md` and `nexus/board.md` belong to `nexus` |
| `ask_before` | array of strings | Optional. The actions to ask about first in this project, in place of the profile's list (SPEC-110) |

`parts` in another form counts as none, with a `parts-invalid` warning. The hub keeps a copy of the core plugin's default `ask_before` list, the one in its example profile, `["external messages", "deploys", "payments", "deletions", "publishing"]`, and a test compares the two, as memory's context does.

### Stage records

The stage records are the file of TBL-115 in stage 05's [Stage records](../05-erd/nexus.md#stage-records-tbl-115), which the contract's `StageRecords` checks: `.corthex/stages/<part>.json` for each part that `parts` names, or `.corthex/stages.json` for a project without parts. The hub reads them from the default branch's commit through Git's object reader and writes them in the working tree with `status` (API-134). A file that is not valid JSON, of another `format` or with a state that is not one of the four gets a `records-invalid` warning, and its stages show as `unknown` (SPEC-109).

`RecordCheckpoint.where` is optional: `status --where` is optional, and SPEC-109 leaves an unsafe link out of a snapshot while retaining the approval, role and date. The status-file fallback preserves phase 1's `checkpoint` and `checkpoint_date` without inventing a role or a NEXUS checkpoint. It never converts that legacy text into a repository checkpoint by itself. A legacy `done` without both a checkpoint and a valid calendar date is shown as `in_progress` with a warning (REQ-085).

### Outbox files

Each file of the outbox is TBL-117 of stage 05's [Outbox](../05-erd/nexus.md#outbox-tbl-117), whose `path`, the request's path, makes each try go where the first went; the contract's `OutboxFile` checks it:

```json
{
  "format": 1,
  "write": "nw_6t9w2z5c8f1j",
  "project": "corthex",
  "request": "reply",
  "path": "/api/spaces/corthex/comments/nc_3a6d9g2j5m8r/replies",
  "session": "claude-code-4f2a91",
  "made": "2026-11-03T07:00:00.000Z",
  "body": { "text": "The table keeps one row for each part." },
  "tries": 1,
  "failure": "no network"
}
```

`request` is one of the agent's [request names](#request-names). The file keeps the write ID without the quotes, which the hub adds to the header.

### Page data

- The hub page holds `corthex-hub-page/0.2` in `<script id="hub-data" type="application/json">`, the contract's `HubPageData`: phase 1's members and `spaces`, which holds for each project that has a space its pictures, open counts, checkpoints that wait for their records and warnings. `lang` comes from the server's `NEXUS_LANGUAGE`, as in phase 1, or from the profile on a device.
- The picture view and the stage overview hold `corthex-view-page/0.2` in `<script id="view-data" type="application/json">`, the contract's `ViewPageData`: `view`, `picture` or `overview`; `data`, the answer of API-111 or API-112; and `problem`, the Problem Details when the server could not read it, such as `picture_not_found`. After a write the view reads its data again with that request.
- The redesign's stage page, API-154, holds `corthex-stage-page/0.3` in the same script block, the contract's `StagePageData`: `data`, the answer of API-158 for the first 200 items in the default order; `talk`, that of API-152 for the whole stage, or null for a project without a space; `picture`, that of API-111 on a stage with a picture, or null; and `problem`, the Problem Details of what the page could not hold, `space_not_found` or `picture_not_found`.

## Check rules

The hub's new rules, which its [reading.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex-nexus/skills/corthex-hub/references/reading.md) gains with the 0.2 release:

| Rule | Level | Meaning |
| --- | --- | --- |
| `pictures-not-sent` | warn | The repository has no default branch that the hub can read: no `origin` remote, no head recorded for it, or no Git. The snapshot holds no picture sources, and the message says to run `git remote set-head origin --auto` (SPEC-105) |
| `picture-left-out` | warn | A whole picture is left out, for its size or because its stage source is in another repository, as `left_out` says (SPEC-105) |
| `picture-partial` | warn | A pictured document could not be fully read, so its picture holds what could be read: the check names the place and why, such as a table under no context heading, a document without a context, a screen whose parent is missing or YAML not in the template's form (SPEC-105, SPEC-106, SPEC-108) |
| `part-unknown` | info | A pictured document belongs to no part, so it is drawn into the picture of the project as a whole (SPEC-105) |
| `parts-invalid` | warn | The project settings' `parts` is not 1 to 50 different part names, so the project is read without parts |
| `board-term-missing` | warn | An aggregate or a read model has no glossary row of its name, or two, so it has no term, or the first (SPEC-106) |
| `records-invalid` | warn | A stage records file is not valid JSON or not in a known format, or a record has a state that is not one of the four, `done` without a checkpoint and its date, a stage key that is not one of the 13 or a part that the settings do not name; the check names the file and what was wrong (SPEC-109) |
| `records-in-status-file` | info | The repository holds no stage records at the default branch's commit, so they come from the device's status file and should move to the repository (SPEC-109) |
| `ask-before-invalid` | warn | The project's or the profile's `ask_before` is not a list of strings, or the profile cannot be read, so the next list applies (SPEC-110) |
| `ask-before-long` | info | The list has more than 30 entries, and the first 30 are kept (SPEC-110) |

The server adds one rule to a stage when it reads it, in the overview and the hub page, and never to the stored snapshot: `checkpoint-withdrawn`, `warn`, for a stored stage record that names a checkpoint withdrawn in NEXUS, shown beside the stage's recorded state until a push whose records no longer name it (SPEC-140).

## Limits

Stage 05's [limits](../05-erd/nexus.md#limits) hold, with these that this stage adds:

| Limit | Value |
| --- | --- |
| A write's body | 256 KiB |
| A snapshot dated ahead of the server's clock | 10 minutes, as in phase 1 |
| The lists of a read | As [Reads](#reads) gives them |
| The lists of a push's answer | 20 of each, with their counts |
| A request of the hub | An answer within 30 seconds |

## Kinds of cases

| Kind | What the contract lists |
| --- | --- |
| Access | Every request's security. `401` is never the Worker's, since Access answers it; `403` with `access_missing`, `access_other_app`, `cross_site`, `user_only`, `agent_only` and `no_kind` |
| Input | `400` with `invalid_request`, `invalid_snapshot`, `clock_ahead` and `unknown_item`, and `413` for texts and bodies, with each field's limits from stage 05 |
| Target | `404` with a code for each kind of entry; a path value in another form gets the same `404` |
| State changes | `409` with a code for each reason, such as `comment_closed`, `proposal_not_open`, `edit_state` and `checkpoint_recorded` |
| Repeats | The write ID: a write sent again gets its first answer, and an ID of another request `409` `write_id_reused`. A push by the commit rule, a removal sent twice `404` |
| Concurrency | Writes are taken one after the other; a push that another overtook gets `409` `commit_not_replaced`; another session's claim `409` `claimed` |
| Limits | `409` for a space's limits and `413` for sizes. No `429` of the server's own: Cloudflare's limits apply, and the hub keeps an agent's write that gets `429` in the outbox |
| Outside services | None: the server calls no other service. A failure of D1 is `500` `internal`, and the hub keeps an agent's write that gets it |
| Data exposure | Answers hold no identity but the author's kind, a stored snapshot holds no picture sources, and lists hold the length of a proposal's stage source text instead of the text |
| Empty and streamed answers | Empty lists with a total of 0, as each list's `nothing` or `empty` example shows. No `204` and no streams |
| Screen states | Nothing more; stage 08 leads each response to a state |
| AI answers | None: NEXUS calls no AI model (REQ-121) |

## Error codes

The codes of every request, as the contract's `components.x-corthex.errors` lists them; the `code` member takes no other. The members are those that the code adds to the [error shape](#errors). The messages are drafts in English, which stage 08 words in English and Korean for the view's states; the meanings and what the client does are this stage's.

| Code | Status | Meaning | Members | Message | What the client does |
| --- | --- | --- | --- | --- | --- |
| `invalid_request` | 400 | a field, a header or the body is not in its form; field names it | `field` | This is not valid: check the marked field | the view shows the message by the field; the hub reports the field and drops the write from its outbox |
| `invalid_snapshot` | 400 | the snapshot is not in the format corthex-hub/0.1 or 0.2; field names the first bad field | `field` | The snapshot is not valid | the hub reports the field and keeps nothing to send again |
| `clock_ahead` | 400 | the snapshot is dated more than 10 minutes ahead of the server's clock | none | The snapshot is dated in the future. Check the device's clock | the hub reports it |
| `unknown_item` | 400 | a proposal names items that its picture does not hold and that adds does not name; items names them | `items` | The proposal names items that are not in the picture | the hub reports the items, and the agent checks the stage source |
| `access_missing` | 403 | Cloudflare Access did not check the request | none | Cloudflare Access did not check this request. Protect the server with Access first | the hub reports a refused token; the view says that the sign-in is missing and offers to load again |
| `access_other_app` | 403 | another Access application than ACCESS_AUD names checked the request | none | This request was checked for another Access application | as for access_missing |
| `cross_site` | 403 | a browser sent a change from another site | none | A change from another site is refused | the view offers to open the page at the server's own address |
| `user_only` | 403 | the request needs a person's own sign-in; needs is user | `needs` | Only you can do this, signed in yourself | the hub reports that the user does this in the view |
| `agent_only` | 403 | the request needs the service token; needs is agent | `needs` | Only the agent does this, through the hub | the view never sends it; the hub reports a missing or refused service token |
| `no_kind` | 403 | Access let the request in, but its identity is neither a person's sign-in nor the service token | none | This sign-in cannot write here | the view and the hub report it, and the user checks the Access policy |
| `not_found` | 404 | no such path, or no such file of the view's code | none | Not found | the view links to the hub page |
| `project_not_found` | 404 | the server holds no snapshot of the project | none | This project is not on the server | the hub reports nothing to remove or read; a push stores the project as a new one |
| `space_not_found` | 404 | the project has no space, since only hubs of 0.1 pushed it | none | This project has no pictures on the server yet. Push it with corthex-nexus 0.2 | the hub says so and sends nothing |
| `part_not_found` | 404 | the stored snapshot does not hold the part | none | This part is not in the project's snapshot | the view links to the hub page |
| `picture_not_found` | 404 | the space holds no picture of the part and stage; why says whether none was drawn yet, the snapshot left it out for its size or its source is in another repository | `why` | No picture is drawn yet for this stage and part | the view shows the empty state with why |
| `comment_not_found` | 404 | the space holds no such comment | none | This comment is not on the server | the view loads the picture again; the hub reports it and drops the write |
| `discrepancy_not_found` | 404 | the part holds no such discrepancy | none | This discrepancy is not on the server | as for comment_not_found |
| `proposal_not_found` | 404 | the space holds no such proposal | none | This proposal is not on the server | as for comment_not_found |
| `edit_not_found` | 404 | the space holds no such edit | none | This reflection is not on the server | as for comment_not_found |
| `checkpoint_not_found` | 404 | the space holds no such checkpoint | none | This checkpoint is not on the server | the overview loads again; the hub reports it, and the agent writes no record of it |
| `entry_not_found` | 404 | the space holds no comment, discrepancy, edit or checkpoint with that ID | none | This entry is not on the server | the hub reports it and leaves the entry |
| `item_not_found` | 404 | no stage of the project's stored snapshot holds the item | none | This item is not in this project's stages now | the view says so with the item's ID, shows the talk that still names it apart and offers to search every project |
| `method_not_allowed` | 405 | the path does not take the method; Allow names those that it takes | none | This request is not allowed here | the hub reports it as a fault of its own |
| `older_snapshot` | 409 | a snapshot of the held commit, or of a project that holds none, made earlier than the stored one; stored_at says when that was made | `stored_at` | The server holds a newer snapshot | the hub takes a fresh snapshot and pushes again |
| `commit_not_replaced` | 409 | a snapshot of another commit than the held one that does not name the held one as the one it replaces, one without a commit where the stored snapshot has one, or a push that another push overtook; held_commit names the held commit | `held_commit` | The server holds another commit. Fetch the default branch and push again | the agent fetches and pushes again, once |
| `too_many_projects` | 409 | the server holds 30 projects, and the snapshot is of a new one | `limit` | The server holds 30 projects. Remove one first | the hub reports it |
| `repository_mismatch` | 409 | the snapshot's repository address is not the one that the space is bound to; bound names it | `bound` | This project's space is bound to another repository | the hub names both addresses and says that a removal unbinds the space |
| `comment_limit` | 409 | the space holds 2,000 comments | `limit` | This project holds as many comments as it may | the view keeps the text and says so |
| `reply_limit` | 409 | the comment holds 200 replies | `limit` | This comment holds as many replies as it may. Leave a new comment | the view keeps the text and offers a new comment |
| `proposal_limit` | 409 | the space holds 500 open proposals | `limit` | This project holds as many open proposals as it may | the hub reports it, and the agent withdraws proposals that the stage sources passed |
| `reflection_limit` | 409 | the space holds 500 pending reflections | `limit` | This project holds as many pending reflections as it may | the view says so, and the proposal stays open |
| `space_full` | 409 | the write would take the text of the space past 8 MiB | `limit` | This project's space is full | the view keeps the text; the hub reports it |
| `comment_closed` | 409 | the agent wrote on a closed comment, which only the user's reply opens again | none | This comment is closed | the hub reports it, and the agent leaves the comment |
| `proposal_not_open` | 409 | the proposal is accepted, dismissed or withdrawn already; state says which | `state` | This proposal is no longer open | the view shows its state |
| `edit_state` | 409 | the report or the dismissal does not fit the edit's state; state says which it is | `state` | This reflection is in another state | the view loads it again; the hub reports the state |
| `pull_request_reported` | 409 | another reported pull request still holds the reflection or the checkpoint; pull_request names it | `pull_request` | A pull request holds this already | the hub reports the pull request, and the agent leaves the entry |
| `pull_request_mismatch` | 409 | the report names another pull request than the one reported for the entry; pull_request names that one | `pull_request` | This is not the reported pull request | the hub reports both pull requests |
| `claimed` | 409 | another agent session claims the entry; ends_at says until when | `ends_at` | Another session holds this | the hub skips the entry until the claim ends |
| `entry_closed` | 409 | a claim on a closed entry | none | This entry is closed | the hub skips it |
| `checkpoint_recorded` | 409 | a stored stage record names the checkpoint, so withdrawing it would change a recorded decision | none | This checkpoint is recorded. Changing it is a new decision | the overview shows the record |
| `checkpoint_withdrawn` | 409 | the checkpoint was withdrawn, so no new record pull request may write it | none | This checkpoint was withdrawn | the hub reports it, and the agent writes no record |
| `checkpoint_state` | 409 | no matching open record, or already recorded | none | Read the checkpoint before reporting | read it again |
| `not_recommended` | 409 | the comment no longer waits for the user, or its last entry asks for no recommendation or checkpoint to take | none | This no longer waits for your answer | the view marks the entry as answered or closed meanwhile and reads my turn again |
| `write_id_reused` | 409 | the write ID was taken by another request | none | This write could not be sent. Try again | the view makes a new ID; the hub reports it as a fault of its own |
| `snapshot_too_large` | 413 | the snapshot is larger than 1 MiB | `limit` | The snapshot is larger than the server takes | the hub reports it; its own limits keep snapshots smaller |
| `body_too_large` | 413 | a write's body is larger than 256 KiB | `limit` | This is larger than the server takes | the view and the hub report it |
| `text_too_long` | 413 | a text is longer than its limit; field and limit name them | `field`, `limit` | This text is too long | the view counts down by the field; the hub reports the field |
| `json_required` | 415 | a body that is not sent as application/json | none | This could not be sent | the hub reports it as a fault of its own |
| `internal` | 500 | an error inside the server; its log holds only the kind of error and the trace ID | none | Something went wrong. Try again | the view keeps what it holds and offers to send again; the hub keeps the write in its outbox |

## Breaking changes

Compared with phase 1, as the hub's [snapshot.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex-nexus/skills/corthex-hub/references/snapshot.md) describes it:

1. Refusals are Problem Details, sent as `application/problem+json`, with more members. They keep `error`, so a hub of 0.1, which reads any JSON reply and shows `error`, still shows the reason, and the reasons are worded anew.
2. A hub of 0.1 cannot push a project that a hub of 0.2 pushed: its snapshot names no commit while the stored one has one, so the server refuses it with `409` `commit_not_replaced`. Every device's hub moves to 0.2 before it pushes such a project again.
3. A hub of 0.2 does not push to a server of phase 1, which refuses a snapshot of 0.2 with `400`: the hub stops at the question for the held commit, which a server of phase 1 answers with a `404` without a `code`. So the server of 0.2 is deployed before the hubs.
4. `push` takes a fresh snapshot instead of sending the saved one (SPEC-111), and `remove --dry-run` reads the server and needs the service token.
5. A removal deletes the project's space with the snapshot (SPEC-115), and `GET /api/snapshots/{project}` returns a snapshot of 0.2 without its picture sources.
6. The page data is `corthex-hub-page/0.2`, which the page of 0.2 reads; nothing else reads it.

The checkpoint accepted them on 2026-11-03, so 0.2 ships with them: the server first, then every device's hub.

## Changes to earlier stages

Applied on 2026-11-03, when the checkpoint passed: 1, 2 and 6 to the functional spec, and 3 to 5 and 7 to the server's data.

1. SPEC-113 says that no reply may be cached. The files of the view's code may be: they hold no project data, each name carries a digest of its content, and the view's speed on a phone needs them kept (REQ-149).
2. SPEC-108 names a top-level `without a screen` list. The stage 07 template's YAML is a list of screens, which has no place for a key, so the list is a comment line, `# without a screen:`, as the SQL's `-- without a table:` is.
3. TBL-117 gains `path`, so that each try of a kept write goes where the first went.
4. Stage 05's reads give a picture's open comments with their replies and decisions. The picture's answer gives each open comment with its count of replies and its last reply, and a comment's own read (API-114) gives all of them, so that a picture's answer stays small; the same for a proposal's stage source text (API-115).
5. Stage 05's picture sources give a hotspot's number. The template's hotspot table has no number column, so `number` is optional, taken from a number at the start of the text.
6. SPEC-116 counts opening a comment again from the view among the user's writes, and the functional spec's notes for stage 06 list it among the requests: it is the user's reply to the closed comment (SPEC-127), with no request of its own.
7. Stage 05's limits gain the 256 KiB of a write's body.

## Choices this stage made

1. A path value in another form gets the `404` of a value that the server does not hold, never `400`, as phase 1 answers a project name: every path has one refusal for what it names, and the form of a path tells nothing more.
2. Input that is not in its form gets `400`, never `422`, in every request, as phase 1 does. A text over its limit gets `413`, as SPEC-126 says, and a space at a limit `409`, since the request is in its form and the space is what is full.
3. A write whose outcome holds already changes nothing and succeeds with `changed: false`; one that another outcome closed is refused with `409` and the state ([Answers that change nothing](#answers-that-change-nothing)). The functional spec decides the cases that it names: marking answered a closed comment changes nothing (SPEC-127), and accepting a proposal dismissed in another tab is refused (SPEC-131).
4. The server sets no rate limit of its own. It serves one user and their agents behind Access, within Cloudflare's limits, and a `429` from Cloudflare keeps the agent's write in the outbox.
5. The write ID goes in the header of the Idempotency-Key draft, so that the page and the hub send it the same way for every write and the server reads it before the body, with the three differences that [Write IDs](#write-ids) gives.
6. No request lists `401`: Access answers it before the Worker. The Worker's refusals of a sign-in are `403` with a code, as phase 1's are.
7. Errors are Problem Details with phase 1's `error` kept, so that hubs of 0.1 still show the reason.
8. One comment, proposal, edit or checkpoint has a read of its own, so that the lists of a picture, an overview and the to-do stay small.
9. The hub's commands extend phase 1's `hub.py`, with exit codes 0 to 3 and `--json`, as MEMORY's commands give their results, instead of a second tool.
10. The contract is YAML, `nexus.openapi.yaml`, beside MEMORY's interfaces: the hub reads YAML as it reads JSON, and MEMORY's tests check the JSON files of this folder for a field named `id`, which an OpenAPI contract's examples hold.
11. The markers of the picture sources in SQL and YAML, `terms: none`, `without a table:` and `without a screen:`, are English in every language, as the code around them is; the DDD board's tables are read in English and in Korean, as people write them.

For phase ②, this stage chose ([Phase ②'s interfaces](#phase-②s-interfaces)):

12. The draft's requests under the picture's path, with the draft's ID and its revision in the body, since one draft is open for each part's pictured stage and a second window must find the first one's draft (REQ-240, REQ-241).
13. Each save sends the whole list of changes and the editor's elements instead of a difference, so that a refused save leaves nothing half written and another PC opens what was last saved; saves within 2 seconds of a change keep each one small, and 1 MiB bounds them.
14. Whether a change still applies is read from its `before` against the current picture, so that a redraw writes nothing to a draft, and an item that a draft adds keeps a temporary name until the agent's report of the merge gives its ID (D14).
15. Dropping a draft that is gone already changes nothing, as 0.2's answers that change nothing do, while dropping a sent edit that closed meanwhile is refused with `409`, as SPEC-173 says.
16. A board's change as one request of operations, all or none and one board version, so that the agent's draft of a step and the user's change of several stickies are one change each (SPEC-178, SPEC-179), with keys for the elements that it places and a new frame's copies named by the elements that they copy.
17. The agent changes and removes only the arrows and groups that it drew, as it does for its stickies (REQ-254), and asks in a comment otherwise.
18. The agent's read recorded by a request of its own after the hub's complete read, with no write ID and never kept in the outbox, as for a claim, so that a read cut off records nothing (SPEC-181).
19. The open board asks for its changes with `since` every 10 seconds instead of a stream, since 0.2 has none and a board serves one person and their agents (point 23).
20. A workshop's checkpoint passed with API-128 and its reflection reported with API-130, with `differs`, so that 0.2's checkpoints, claims and records serve it, and only the user passes it, in NEXUS (D15).
21. The hub's work on a board in three commands, `workshop`, `board` and `change`, with a change as a JSON file, since a draft of a step holds more stickies than options can carry.

## Checks run

On 2026-11-02, on the contract and this file:

- openapi-spec-validator 0.7.1: the contract is valid OpenAPI 3.1.
- A check of this stage, in Python with PyYAML and jsonschema, which stays outside the repository: every operation has an API ID, its SPEC IDs and a status, and accounts for each response of the stage's table, by listing it or by naming it in `omit` with a reason; every response has a named example that its schema takes; every error example's code is in the list with the same status; and every write takes the write ID and answers `409` `write_id_reused` for an ID that another request took. No problems.
- Prism 5.16.0, `prism mock`: the contract loads, with its 32 operations. A write ID in double quotes passes, and one without them gets `400`.
- Schemathesis 3.39.16 against that mock, with `not_a_server_error`, `status_code_conformance`, `content_type_conformance` and `response_schema_conformance` and 25 examples for each operation: all 32 operations pass, in 858 requests. Two habits of the tool were set aside with hooks, which stay outside the repository and are counted in each run: it builds the `CF_Authorization` cookie from any characters, which Node's HTTP server refuses with a bare `400` before the mock sees it, so the hook gives the cookie a printable stand-in; and it fills a path value from a response example's member of the same name, such as the `edit` object for `{edit}`, so the hook puts back the parameter's own example. Its health check `data_too_large` was turned off, for the snapshot's large body.
- A mock passes most of these by design, so only a real server proves the contract: stage 11 runs the same tool against a development server behind Access, never against the user's own server.
- The repository's checks, with these files in place: `python -m unittest discover -s tests` (725 tests, 12 skipped), `claude plugin validate --strict` for the marketplace and its three plugins, and `node --test nexus/test/*.test.js` (15 tests) pass. The hub's snapshot of this repository reads API-101 to API-150 once each, with no checks, and every link of this file and its translation resolves.

On 2026-11-03, after the checkpoint's changes, with the same tools:

- The check of this stage and openapi-spec-validator find no problems; each of the contract's 72 examples is used, among them the pages' answers in HTML.
- Prism's mock answers API-101 to API-103 with a page of the code's message when the request's `Accept` names `text/html`, and with Problem Details otherwise.
- Schemathesis, with `--experimental=openapi-3.1`, which it asks for an OpenAPI 3.1 contract: all 32 operations pass, in 858 requests, and the four under Pages, the three pages and the view's code, in 103 of them. A third habit was set aside the same way: it builds the service token's two headers, `CF-Access-Client-Id` and `CF-Access-Client-Secret`, from any characters, which Node's HTTP server also refuses with a bare `400`, so the hook gives each a printable stand-in.
- The repository's checks pass, now with 727 tests (12 skipped), and the hub's snapshot of this repository reads 996 items with no checks.

Again on 2026-11-03, after the maintainer's choice to hold stage 01's event storming in NEXUS:

- openapi-spec-validator 0.7.1: the contract, with the optional `timeline` of `DomainSource`, is valid OpenAPI 3.1.
- The check of this stage finds no problems: the example `picture_data_domain`, which now holds a lane of the timeline, is taken by its schema, and each of the 72 examples is still used.
- Prism and Schemathesis were not run again: the change adds one optional field to one schema and a lane to one example, which the check of this stage validates.
- The repository's checks pass, now with 756 tests (12 skipped), and the hub's snapshot of this repository reads 1014 items with no checks.

On 2026-11-08, when the contract took the redesign's requests as planned (TASK-265), locally with synthetic data:

- openapi-spec-validator: the contract is valid OpenAPI 3.1, with 40 operations, 8 of them planned.
- The contract checks: each of the 445 named JSON examples fits its schema, a check that the response check now runs, and no example names a field or query value that its operation lacks; the 70 named defaults pass as before; Schemathesis 3.39.16 tests the 32 operations that the server answers, 156 of 156 for each check, and leaves the 8 planned ones out. Prism was not run.
- The repository's 13 Python tests and 267 Node tests pass, and the hub's snapshot of this repository reads 1264 items, the 4 new cases among them, with 630 warnings, the same as before apart from line numbers.

On 2026-11-08, when the server took API-158 (TASK-266), locally with synthetic data and this repository's own snapshot:

- openapi-spec-validator: the contract is valid OpenAPI 3.1, with 40 operations, 7 of them planned.
- The contract checks: the 445 named JSON examples and four of the server's answers to API-158 fit their schemas; the 72 named defaults pass; Schemathesis 3.39.16 tests the 33 operations that the server answers, 160 of 160 for each check, and leaves the 7 planned ones out. Prism was not run.
- The repository's 13 Python tests and 274 Node tests pass, and the hub's snapshot of this repository reads 1272 items, the 8 new cases among them, with the same 630 warnings apart from line numbers. Read from this repository's snapshot at `58ac651` in a local in-memory server, part `nexus`: stage 02's 199 requirements fall into 11 contexts and 6 without one, stage 01's head counts 1 open hotspot, and stage 12's 723 items take four reads of 200, from 10 to 21 milliseconds each, 13 at the median of three rounds.

On 2026-11-08, when the server took API-152 (TASK-267), locally with synthetic data:

- openapi-spec-validator: the contract is valid OpenAPI 3.1, with 40 operations, 6 of them planned.
- The contract checks: the 445 named JSON examples, four of the server's answers to API-158 and four to API-152 fit their schemas; the 74 named defaults pass; Schemathesis 3.39.16 tests the 34 operations that the server answers, 165 of 165 for each check, and leaves the 6 planned ones out. Prism was not run.
- The repository's 13 Python tests and 279 Node tests pass, and the hub's snapshot of this repository reads 1278 items, the 6 new cases among them, with the same 630 warnings apart from line numbers. In a local in-memory server, with a project's 2,000 comments on one stage, 1,500 of them open, and three replies each, a read of the whole talk takes 29 milliseconds at the median of five, with or without a page of the closed talk, and one narrowed to an item 19, for answers of 342,585 to 415,822 bytes.

On 2026-11-08, when the server took API-157 and API-156 (TASK-268), locally with synthetic data:

- openapi-spec-validator: the contract is valid OpenAPI 3.1, with 40 operations, 4 of them planned.
- The contract checks: the 446 named JSON examples, four of the server's answers to API-158, four to API-152, two to API-157 and three to API-156 fit their schemas; the 78 named defaults pass; Schemathesis 3.39.16 tests the 36 operations that the server answers, 174 of 174 for each check, and leaves the 4 planned ones out. Prism was not run.
- The repository's 13 Python tests and 287 Node tests pass, and the hub's snapshot of this repository reads 1286 items, the 8 new cases among them, with the same 630 warnings apart from line numbers. In a local in-memory server holding 30 projects, 29 snapshots of about 1 MB with 3,000 items each and one of 3,000 items, each of four searches takes from 104 to 156 milliseconds, from 109 to 135 at the median of five, for answers of 44 to 3,121 bytes; one item that 600 cases link, with 60 comments, reads in 9 milliseconds at the median, in 32,681 bytes.

On 2026-11-08, when the server took API-151 (TASK-269), locally with synthetic data:

- openapi-spec-validator: the contract is valid OpenAPI 3.1, with 40 operations, 3 of them planned.
- The contract checks: the 446 named JSON examples, four of the server's answers to API-158, four to API-152, two to API-157, three to API-156 and two to API-151 fit their schemas; the 80 named defaults pass; Schemathesis 3.39.16 tests the 37 operations that the server answers, 177 of 177 for each check, and leaves the 3 planned ones out. Prism was not run.
- The repository's 13 Python tests and 295 Node tests pass, and the hub's snapshot of this repository reads 1294 items, the 8 new cases among them, with the same 630 warnings apart from line numbers. In a local in-memory server holding 30 projects with spaces, the first page took from 119 to 336 milliseconds a read: 207 at the median of five with three parts and 270 pictures in all, 123 with 50 parts and 4,500 small pictures, and 327 with 90 pictures as large as a push holds, for answers of 719,912 to 2,724,782 bytes.

### Development Access identity trial (2026-11-03)

TASK-201 deployed a temporary diagnostic Worker behind Access without static assets and used a service-token request (this host’s user environment) and a person’s signed-in browser through Aside CLI 1.26.1028.2335. Both returned 200; ctx.access audience and the JWT audience, issuer, expiry and RS256 signature matched. An anonymous browser received Access’s 302. Only field presence, empty and absent are recorded below, never their values.

| Source | Field | Person | Service token |
| --- | --- | --- | --- |
| ctx.access | aud | present | present |
| ctx.access | sub | absent | absent |
| ctx.access | email | absent | absent |
| ctx.access | common_name | absent | absent |
| getIdentity() | aud | absent | absent |
| getIdentity() | sub | absent | absent |
| getIdentity() | email | present | absent |
| getIdentity() | common_name | empty | absent |
| header JWT | aud | present | present |
| header JWT | sub | present | empty |
| header JWT | email | present | absent |
| header JWT | common_name | absent | present |

The selected header method distinguishes both kinds. Implementation checks of caching, expiry, rotation and refusal, and the full development API contract run are separate from this diagnostic and are not yet counted as complete. After the diagnostic, replace the development probe with the implemented server.

## For the checkpoint

Phase ②'s stages 05 and 06 came to one checkpoint after its stages 02 to 04 passed at 23:27 KST on 2026-11-07, and it passed at 09:33 KST on 2026-11-08: on a decision card in the project's thread the maintainer chose to pass them as recommended ("추천대로 통과", pass as recommended), so this stage's choices 12 to 21 and stage 05's 12 to 19 stand as written. [Phase ②'s interfaces](#phase-②s-interfaces) writes down the requests of editing on a PC and of the workshops, API-161 to API-173, the hub's commands API-174 to API-176, thirteen changes to 0.2's and the redesign's interfaces and nineteen error codes. The points that the checkpoint looked at first: the list of changes, whose `before` decides what still applies (choice 14); a board's change as one request of operations (choice 16), with the agent's limit on arrows and groups (choice 17); the read mark without a write ID (choice 18); the open board's requests every 10 seconds (choice 19); and the workshop's checkpoint through 0.2's checkpoints (choice 20). The hub's three commands and its changes are in the core plugin's repository, so phase ②'s build needs a pull request there and a new `hub-ref.json`, as the redesign's does.

The redesign of 2026-11-06 passed its checkpoint 1 at 17:44 KST that day ("이대로 진행", go ahead as drawn), whose list of changes named the first page's data in one read and comments without a picture (choice ② A). [The redesign's interfaces](#the-redesigns-interfaces) writes them down for its checkpoint 3, with what writing them found: the first page needs one more write, API-159, to take the agent's recommendation in one transaction, and the hub's `comment` and `reply` change in the core plugin's repository, so the build needs a pull request there and a new `hub-ref.json`, which the checkpoint's list did not name.

The maintainer's choice of 2026-11-03, to hold stage 01's event storming in NEXUS, passed at 16:54 KST the same day, together with the changes that it made to the other stages: on a decision card in the project's thread the maintainer chose to pass the step view and the work board as drawn ("모두 그린 대로 통과", pass all as drawn). The checkpoint covered: the optional `timeline` of `DomainSource`, with its forms in [Picture sources](#picture-sources), which is a compatible change, since a picture source without it stays valid and a snapshot of the frozen form still passes; and the work board of phase ② (SPEC-142), which adds its requests then, beside those of editing (SPEC-134).

Passed on 2026-11-03 at 11:39 KST, together with stages 03 to 05, 07 and 08: on a decision card in the project's thread the maintainer chose all the recommendations ("모두 추천대로", all as recommended), so the requests, the commands and the formats stand as written, with the changes of stage 08. The sign-in (3) stays open until its trial. The checkpoint covered:

1. The [breaking changes](#breaking-changes), above all that every device's hub moves to 0.2 once one has pushed with it, and that the server is deployed first.
2. The [changes to earlier stages](#changes-to-earlier-stages), above all the cached code of the view (1) and the `# without a screen:` line (2).
3. The sign-in that stays open until a trial on a real Access setup ([Sign-in](#sign-in)), which comes before stage 11 builds the requests.
4. The write ID in the draft's header, with its three differences ([Write IDs](#write-ids)), and the answers that change nothing (choice 3).
5. The hub's 18 commands and their names ([The hub's commands](#the-hubs-commands)), which the stage skills will tell the agent to run.

## Notes for later stages

### Stages 07 and 08: screens

- For phase ②: the editor reads API-161 and writes with API-162 to API-165 and API-167, and a sent edit's panel drops it with API-166; the work board reads API-168 and API-170, with `since` every 10 seconds, and writes with API-169, API-171 and API-173, its comments with API-118 and its checkpoint box with API-128 and API-129. `draft_revision` offers the draft as last saved; `picture_changed` and `draft_not_applying` lead to the edit conflict; `element_changed` puts the element back and names who changed it; `workshop_ended` and `frame_closed` show the board read-only or as it is; `board_changed` shows it as it is now, to pass again.
- For the redesign: the first page reads API-151 and writes with API-124, API-125 and API-159; the stage page reads API-158, API-111, API-152 and API-157, and API-114 to API-116 for an opened comment, an opened proposal and a reflection that the talk no longer lists, and writes with API-118 to API-120, API-124, API-125 and API-127 to API-129; the search reads API-156. Each refusal leads to the state that its 0.2 counterpart leads to, and `item_not_found` to an item that is gone.
- The requests of each screen: the hub page, API-101; the picture view, API-102 and API-104 to load, API-111 to read again, API-114 and API-115 to open a comment or a proposal, API-116 to read a reflection that the picture no longer lists, closed or dismissed, so that the proposal's panel shows its pull request, and API-118 to API-120, API-124, API-125 and API-127 to write; and the stage overview, API-103 and API-104 to load, API-112 to read again, and API-128 and API-129 to write.
- The states that the errors lead to: `picture_not_found` with its `why` is empty; `access_missing`, `access_other_app`, `no_kind` and an `opaqueredirect` reply are permission or an expired sign-in; `cross_site` is an error that offers the server's own address; `comment_limit`, `reply_limit`, `space_full` and `text_too_long` keep the text; `proposal_not_open`, `edit_state` and `checkpoint_recorded` are stale, and the view reads again. The view keeps an unsent text with its write ID (SPEC-126).
- Each message of [Error codes](#error-codes) gets its final words, in English and Korean.

### Stage 10: work breakdown

- For phase ②, after the redesign: the hub's three commands and its changes in the core plugin, with the new `hub-ref.json`; then migration 5 and API-161 to API-167, with the changes to API-110, API-111, API-116 and API-126; then API-168 to API-173, with the changes to API-113, API-118 and API-128 to API-132; the views last.
- For the redesign: the hub's `comment` and `reply` and the hub page's tokens in the core plugin first, with the new `hub-ref.json`; then migration 4 and API-151 to API-159 with the changes to API-118 and API-119; then the pages; the move of API-101 and the redirects of API-102 and API-103 last.
- The server first: store.js's migrations, then the requests in the contract's order: the push with the held commit and the removal; the reads; the discussion; editing; stage progress with the claims. The hub follows: the snapshot 0.2 with its picture sources, stage records and settings, `status`, `push`, then the writes with the outbox. The views come last.
- The release carries this file's formats and rules into the hub's [snapshot.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex-nexus/skills/corthex-hub/references/snapshot.md) and [reading.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex-nexus/skills/corthex-hub/references/reading.md), and `parts` and `ask_before` into the core plugin's [project.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex/skills/corthex/references/project.md), with the stage skills' steps that run the hub's commands.

### Stage 11: development

- For phase ②: tests that a board's change is written whole or not at all and raises the board version by one, that the outbox keeps a change whole, and that the hub redacts what it reads from a board before it prints it; and an example of the contract for each response of API-161 to API-173.
- The trial of both kinds of sign-in on a real Access setup comes first, and closes the open question of [Sign-in](#sign-in).
- Contract tests run Schemathesis against a development Worker behind Access, with the hooks of [Checks run](#checks-run) in the repository, and Prism's mock serves the views' work before the server is built.
- Tests that hold the parts together: the server's error codes against the contract's list; the hub's request names against the contract's `OutboxFile`; the hub's copy of the default `ask_before` list against the core plugin's example profile; and the order of refusals of [Which refusal comes first](#which-refusal-comes-first).

### Stage 12: QA

- For phase ②: a case for each response of API-161 to API-173 and of the changed requests, and for each outcome of API-174 to API-176; two windows on one draft and on one sticky; a draft started across a redraw; temporary names reported with and without IDs; a frame added at each limit; the agent's draft of a step refused whole; a read cut off; and a change kept in the outbox while its frame is passed.
- For the redesign: a case for each response of API-151 to API-159 and of the changed API-118 and API-119; API-159 sent twice with one write ID, with the service token and on a comment that no longer waits; and every address of 0.2 opened against a server of the redesign.
- A test case for each response of each request, from its named examples, written as `API-118#409`, and for each outcome of each command, on Linux, macOS and Windows.
- The kinds of cases above: a write sent twice and again after 7 days, a write ID of another request, two sessions on one entry, a push that another overtook, a 0.1 hub after a 0.2 push, a sign-in that expires in the view, and the outbox without a network, without a token and after 7 days.

## Transport, measurement and release decision of 2026-11-04

The maintainer approved edge caching of public content-hashed code, styles and fonts at the same configured origin (REQ-147). HTML, API, project data and refusals remain no-store. Code has no Set-Cookie or Vary:*, with unchanged CSP and whole-host Access. Even a cached object must not reach unauthenticated GET/HEAD callers. An edge HIT does not visit the origin, so origin verification is not claimed on every HIT.

REQ-124 server processing runs from complete body receipt to response handling completion. Body arrival, client round trip, process CPU windows and RSS remain separate. The existing31.085ms passes1s; the historical inclusive1031.079ms stays recorded.

The maintainer conditionally approved NEXUS merges, production migration/routing and release tags after REQ-149/124 pass, all710 cases have verdicts with zero Must failures, migration/recovery rehearsals pass, core integrates after C1 release/PR C, and required checks plus Code/Security reviews pass. The first repository snapshot still needs REQ-107 confirmation. Preserve the old Worker/D1 for14days after switching and ask before deletion. If a condition remains, ask once with its numbers and release after the answer.

## First picture decision, 2026-11-04

The maintainer explicitly selected “SVG first + HTML path improvement” in the current Codex conversation. Keep the frozen tokens, same-origin Access boundary and pinned real editors. A complete server-rendered SVG is the first picture; Excalidraw/ERD Viewer loads afterwards. REQ-149/TC-654/TC-1271/TC-1309 measure this first visible picture under the unchanged mobile/network/CPU1 profile. Record native-editor readiness separately, keeping all earlier native-ready failures and any failed/incomplete observations. Do not use a DOM-ready marker alone as evidence of a visible, readable picture.

The preview uses the same deterministic geometry and checked source as the editor, with safe text/fragment links and no SVG scripts, foreign content or external resources. It stays visible during editor loading and remains available with the item list when that loading fails. Core controls keep the current viewport when handing over to the real editor. Loading preserves the frame and surrounding layout. Distinguish first-preview and native-editor-ready states and timings.

Trusted static view CSS may be inlined so a stylesheet request does not block the preview. HTML, SVG project content and API data remain no-store; hashed code/style/fonts retain the approved Access-protected public immutable cache. The standalone server may negotiate bounded built-in HTML compression to reduce Tunnel transfer. No project data is placed in a public code file or cache. Neither this decision nor a preview is a release, first real-repository upload, or approval to delete Worker/D1. Existing conditional-release gates remain.


Repeated-layout safety bound: keep the300-element target and normal pictures. If expanded nodes (including context frames) exceed20000, server/view stop layout and show an explicit limitation with at most3000original source items and working panels. Do not claim a complete picture/editor-ready state. Preserve original API/storage and200/no-store GET/HEAD. [Validation](../12-qa/runs/2026-11-04-svg-first.md).
