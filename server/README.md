# NEXUS v3 server

[한국어](README.ko.md)

The server of NEXUS v3, built task by task from the [WBS](../docs/10-wbs/wbs.md). It runs on Node 24 with Node's own modules and has no dependency to install. It runs behind the Cloudflare Access gate, as v2 did.

It has TASK-413's skeleton, a router for the operations of [api/openapi.yaml](../api/openapi.yaml), settings from the environment and one log line per request; TASK-414's store, the database that the migrations of [db/migrations](../db/migrations/) build; TASK-415's request layer: the error registry, the body limits, JSON only, request keys and one write at a time; TASK-416's admission, which checks the gate's sign-in of the one owner on every owner request; TASK-417's agent credentials: the owner issues, lists and revokes them, and every agent request is checked by its pair; TASK-418's [snapshot intake](#snapshot-intake), where the hub's push keeps a project's snapshot; TASK-419's [drawing](#drawing), which draws a kept snapshot into diagrams, drawings and elements through each stage's drawer; TASK-421's [DDD board](#ddd-board), the drawer of stage 01; TASK-422's [ERD](#erd), the drawer of stage 05; TASK-423's [item table](#item-table), the drawer of the stages without pictures; TASK-424's [user flow](#user-flow), the drawer of stage 03's flow files; TASK-425's [sitemap](#sitemap), the drawer of stage 07; TASK-426's [screen states](#screen-states), the drawer of stage 08; TASK-427's [mockup](#mockup), the drawer of stage 09, and the [mockup page](#the-mockup-page) it serves in a sandbox; TASK-435's [after a drawing](#after-a-drawing), what a push changes once it has drawn: confirmations, stage passes, reflections and threads; TASK-433's [to-do entries](#to-do-entries), the one place that opens and closes the entries of the owner's to-do and the agent to-do, with the agent to-do it answers; TASK-434's [claims](#claims), by which an agent session holds an entry of the agent to-do alone, keeps it and lets it go; TASK-437's [comments](#comments), by which an agent comments on a diagram, replies, marks a thread answered and reports where a decision is recorded; TASK-443's [threads](#threads), by which the owner reads a thread, comments on a diagram, an element or a row, replies and closes a thread; TASK-440's [project read](#project), a project's stages with their diagrams and states, its stage passes and its tool links; TASK-439's [projects and to-do](#projects-and-to-do), the project list and what waits on the owner, with the warning of a failed backup; TASK-448's [project removal](#project-removal), what deleting a project space removes and the deletion; TASK-436's [agent reads](#agent-reads), what deleting the space removes and one thread, change set, reflection entry or confirmation, as the hub's `remove` and `show` commands read them; TASK-441's [diagram read](#diagram), a diagram with its elements by name and their positions, its overlays, its confirmation, what changed since it and its threads; TASK-442's [moving an element](#moving-an-element), where the owner puts an element of a diagram, which the next drawing keeps; TASK-445's [direct edits](#direct-edits), by which the owner renames an element or connects two and cancels such an edit while it waits for reflection; TASK-446's [confirmations](#confirmations), by which the owner confirms a diagram or an item table and cancels a confirmation; TASK-450's [daily backup](#daily-backup), which backs up the store once a day, keeps 30 days of backups and rehearses a restore before a release; TASK-454's [app shell](#app-shell), the pages the owner opens, with their header, stage tabs, addresses and shared states; TASK-438's [proposals](#proposals), by which an agent posts a change set laid over a drawn picture and withdraws it; TASK-444's [answering proposals](#answering-proposals), by which the owner accepts or rejects one; TASK-451's [tool links](#tool-links), linking a Notion page or a Jira project to the project or a stage and removing the link; TASK-455's [owner to-do screen](#owner-to-do-screen), SCR-142, what waits on the owner across every project; TASK-452's [workshop](#workshop), stage-01 event storming on a board: the owner's sticky notes and links, the agent's step drafts, confirming a step and the agent's report of the pull request that writes it; TASK-456's [projects screen](#projects-screen), SCR-143, the projects and the agent credentials, issuing one with its secret shown once and revoking one; TASK-457's [project screen](#project-screen), SCR-144, one project's stages and tool links and the deletion of its space; TASK-447's [reports](#reports), by which an agent reports the pull request of a reflection or of a confirmation's record, which may pass a stage; TASK-453's [Miro import](#miro-import), the owner's import of a Miro board's sticky notes and connectors into the open workshop, from the uploaded file only; and TASK-449's [pinned-hub run](#pinned-hub-run), the pinned hub's eight agent commands run against this server in the repository's unit tests; TASK-462's [workshop board](#workshop-board), SCR-145's workshop on stage 01, where the owner adds, moves, renames, links and removes sticky notes, confirms a step and imports a Miro export. It takes the operations of `src/routes.js`, so far API-242, API-243, API-244, API-245, API-246, API-247, API-248, API-249, API-250, API-251, API-252, API-253, API-254, API-255, API-256, API-257, API-258, API-259, API-260, API-261, API-262, API-263, API-264, API-265, API-266, API-267, API-268, API-269, API-270, API-271, API-272, API-273, API-274, API-275, API-276, API-277, API-278, API-279, API-280, API-281, API-282, API-283, API-284, API-285, API-286, API-287, API-288, API-289, API-290, API-291, API-292 and API-293; every other path under `/api` answers the `not_found` Problem until the tasks that build its operations add them. A GET of a path outside `/api` is a page of the [app shell](#app-shell). It also holds TASK-420, the [picture layout](#picture-layout) the drawing tasks use.

## Running

```sh
cd server
NEXUS_DATA_DIR=/absolute/path/to/a/data/folder \
NEXUS_BACKUP_DIR=/absolute/path/to/a/backup/folder \
NEXUS_ACCESS_ISSUER=https://<team>.cloudflareaccess.com \
NEXUS_ACCESS_AUD=<the application's audience tag> \
NEXUS_OWNER_EMAIL=<the owner's email address> \
node src/main.js
```

The values in angle brackets are placeholders; the real ones stay in the server's environment, never in Git.

## Settings

| Variable | Default | Meaning |
| --- | --- | --- |
| `NEXUS_HOST` | `127.0.0.1` | The address the server listens on: an IP address or `localhost`. The gate's tunnel reaches the server on the same machine. |
| `NEXUS_PORT` | `8787` | The port, 0 to 65535. With 0 the system chooses a free port, which the start line names. |
| `NEXUS_DATA_DIR` | none | The absolute path of the folder that holds the store. A new install creates the folder, readable by its owner only; the store file is always readable by its owner only, whatever the folder allows. |
| `NEXUS_BACKUP_DIR` | none | The absolute path of the folder that holds the daily backups (see [Daily backup](#daily-backup)). The first backup creates it, readable by its owner only. |
| `NEXUS_BACKUP_TIME` | `03:00` | When the day's backup runs, as `HH:MM` in UTC. The default is an example; the deploy (TASK-464) sets the real time. |
| `NEXUS_ACCESS_ISSUER` | none | The gate's team address, `https://<team>.cloudflareaccess.com`: the issuer its sign-ins name, under which `/cdn-cgi/access/certs` lists their keys. An https origin with no path, port or query. |
| `NEXUS_ACCESS_AUD` | none | The audience tag of the gate's NEXUS application, 64 lowercase hex digits. |
| `NEXUS_OWNER_EMAIL` | none | The email address of the one owner, as the gate's sign-in carries it; matched without case. |
| `NEXUS_NOTION_TOKEN` | none | The token of the Notion integration that reads the status of Notion links (see [Tool status](#tool-status)), with the "Read content" capability only. Unset, Notion is never called and its links show "not read yet". |
| `NEXUS_JIRA_SITE` | none | The one Jira Cloud site whose links are read, such as `example.atlassian.net`. A link on another site keeps "not read yet". |
| `NEXUS_JIRA_CLOUD_ID` | none | That site's cloud ID, a UUID, which `https://<site>/_edge/tenant_info` gives. |
| `NEXUS_JIRA_EMAIL` | none | The email address of the Atlassian account the Jira token belongs to, such as `owner@example.com`. |
| `NEXUS_JIRA_TOKEN` | none | That account's scoped API token, with the `read:jira-work` scope only. |

An empty variable takes the default; `NEXUS_DATA_DIR`, `NEXUS_BACKUP_DIR` and the three gate settings have none and must be set, so a server with no backup folder does not start. The five tool settings may stay unset: the four `NEXUS_JIRA_` settings are set all together or not at all, and a tool with none is never called. An invalid value stops the server with exit code 1 and one line that names the setting and its rule, never the value, since a value set by mistake can be a secret.

### The read-only tokens (for the deploy, TASK-464)

The [tool status read](#tool-status) needs two read-only tokens. The maintainer makes them and puts them in the server's environment before the deploy. No token is ever in Git, and no test uses one.

- **Notion.** In Notion's integration settings, make an internal integration for the workspace with the "Read content" capability only: no content insert or update, no comments and no user information. Share with it each page whose status NEXUS should show. Put its token in `NEXUS_NOTION_TOKEN`. A page not shared with it answers 404 and keeps "not read yet", or its last status.
- **Jira.** In the Atlassian account's security settings, make a scoped API token for Jira with the `read:jira-work` scope only. A classic API token carries all of the account's rights, so it is not used. Put the site in `NEXUS_JIRA_SITE`, its cloud ID from `https://<site>/_edge/tenant_info` in `NEXUS_JIRA_CLOUD_ID`, the account's address in `NEXUS_JIRA_EMAIL` and the token in `NEXUS_JIRA_TOKEN`. The account reads only the projects it can browse. An Atlassian token expires, at most a year after it is made; an expired one fails with 401, and the links keep their last status, so it is renewed before then.
- **Where.** Set them where the server's other settings are set, readable by the server's user only, and restart the server: the settings are read once at start. To withdraw a token, revoke it at its tool and remove the variable.

## Store

The store is one SQLite file, `nexus-v3.sqlite`, in the data folder, opened with Node's own `node:sqlite` (`src/store.js`). The server opens it before it listens and applies the migrations of `db/migrations` it does not have yet, in one transaction, so a migration that fails changes nothing and the server stops. It waits up to 5 seconds for a lock another connection holds, such as a server still stopping. A new install starts with an empty store (SPEC-015); one that stopped before its commit is rolled back by SQLite's journal and run again at the next start.

- **The schema is `db/nexus.sql`'s.** The migrations, numbered from 0001 without a gap, build it from an empty database; `test/store.test.js` finds no difference between the schema they build and `db/nexus.sql`. The store adds no table of its own: its marks are in the SQLite header, NEXUS v3's application ID (`NXS3`) and, as the user version, the number of the last migration applied.
- **Running it again changes nothing.** A store that has every migration is not written to.
- **A v2 store is never read.** v2 named its stores `nexus.sqlite` and `rebuild.sqlite`, and v3 opens only `nexus-v3.sqlite`, so a v2 store in the same folder is left unread. A file with the store's name that is not a NEXUS v3 store, such as a copied v2 store, is refused from its 100-byte header before SQLite opens it, and left as it is; so is a store that a newer server migrated further than this one knows.
- **Migrations.** Never edit a migration once it has been applied anywhere; add the next one. A file in `db/migrations` that ends in `.sql` or starts with four digits but is not named like `0001_initial.sql` stops the server rather than being skipped. The server reads `db/migrations` from the repository, so it runs from a checkout of it. Foreign keys are off while the migrations run, so that one can rebuild a table, and every key is checked before the transaction commits.

A handler gets the open store as `store` beside `settings`.

## Admission

Each request reaches its operation's handler only once admission (`src/admission.js`) lets it through, so a refused request never reads the store and its answer holds no project data. What it checks comes from the operation's `x-corthex` family in the contract, which `test/admission.test.js` compares with the server's lists.

- **Owner operations** admit only the gate's sign-in of the one owner (SPEC-048, rule 1). Cloudflare Access sends it in `Cf-Access-Jwt-Assertion`; a cookie or another header is not read. `src/gate.js` verifies it with Node's own `node:crypto`: the RS256 signature by a key the issuer's certs endpoint lists under the token's `kid`, the issuer and the audience from the settings, and the expiry, with a minute of leeway for a not-before time ahead of the server's clock. No sign-in, an expired one or one that fails a check gets `unauthenticated` (401); a valid sign-in of anyone but the owner gets `not_owner` (403).
- **A write of the owner's** (POST, PUT, PATCH or DELETE) whose browser says in `Sec-Fetch-Site` that it comes from anywhere but NEXUS itself (`same-origin`) or the address bar (`none`) gets `cross_site` (403). A request with no `Sec-Fetch-Site` comes from no browser, or one too old to send it, and is admitted.
- **The keys** are read from `<issuer>/cdn-cgi/access/certs` when a sign-in first needs them, with a 5-second limit and no redirect, and kept for an hour; a `kid` the server does not know makes it ask again, at most once in 10 seconds. Only RSA keys of at least 2048 bits are kept. While no current keys can be read, and for a `kid` the server does not know while its last request to the endpoint failed, an owner request gets `internal` (500); a `kid` of the current keys is still checked meanwhile. This is the server's one outside call, to the gate in front of it, and tests replace it with a local signing key.
- **Agent operations** admit only a live agent credential: the `CF-Access-Client-Id` and `CF-Access-Client-Secret` pair that NEXUS issued (SPEC-049, see [Agent credentials](#agent-credentials)). The ID must be an `ac_` ID and the secret 43 characters of base64url; the secret's SHA-256 must match the credential's digest, compared in constant time, and the credential must not be revoked. Anything else gets `access_missing` (401), one code for a missing pair, an unknown ID, a wrong secret and a revoked credential, so a caller learns nothing about which; the log keeps which (see [Log](#log)). Without a live pair, the owner's valid sign-in gets `agent_only` (403), since the owner does this on the page; a sign-in that cannot be checked, as when the gate's keys cannot be read, counts as none. The gate passes the agent paths through to NEXUS with these two headers, rather than checking them as its own service token; the deploy task, TASK-464, sets it up so.
- **An agent credential on an owner operation**, a live pair on a request without the owner's valid sign-in, gets `owner_only` (403), sent by the credential (rule 1). A pair that is not live is no credential, so that request gets `unauthenticated`.
- **A write that waited behind its credential's revocation** is refused with `access_missing` in its own transaction, before its request key is read: rule 4 refuses a write that an earlier one made invalid. So a revoked credential's claims stay released.
- **A route** of an action the contract does not name, which only a test makes, says `family: 'none'` to be admitted unchecked; any other route the contract does not name stops the server when it is made, so no operation goes unchecked because its family was left out.

## Requests

A route (`src/router.js`) names its operation's `operationId` as `action`, the 404 code of each path parameter as `params`, the kind of body it takes as `body` and whether it takes a request key as `requestKey`. A request goes through these steps in order, and any of them can refuse it:

1. **Path and method.** A GET of a path outside `/api` is a page of the [app shell](#app-shell), answered before any of these steps. A path that is no operation answers `not_found`; one that takes other methods only answers `method_not_allowed`.
2. **Admission.** The request is admitted by its operation's family, as above, before its path parameters or its body are read. The caller a request key belongs to is `owner` for an admitted owner operation and the credential's ID for an agent operation. A handler gets `caller`, and for an agent operation `credential`, its `{ id, key, name }`.
3. **Path parameters.** A path parameter is percent-decoded, and a value that is not in the contract's form of what it names gets the 404 of that thing, such as `project_not_found` for `{project}` (`src/params.js`). So a handler never gets a value holding `/`, `..` or a control character. The detail never repeats the value.
4. **Request key.** An operation that takes one needs `Idempotency-Key` in the contract's form, a write ID in double quotes; without it the answer is `invalid_request` with `field` `Idempotency-Key`.
5. **Body.** An operation that takes a body takes a JSON object only (`src/body.js`):
   - not `application/json`, a charset other than UTF-8, or a content coding: `json_required` (415);
   - over its limit, by its declared length or once the bytes read pass it: `snapshot_too_large` for a snapshot (8 MiB), and `body_too_large` for a Miro export (5 MiB) or any other body (2 MiB), with `limit` (413). The rest of the body is not read;
   - not UTF-8 JSON text of an object: `invalid_request`, or `invalid_snapshot` for a snapshot, with `field` `body` (400).
6. **The operation.** A read runs at once. A write, which is every operation whose method is not GET, runs as described below.

**Unread bodies.** An answer sent before the body was read in full, such as a refusal, leaves the rest of the body unread. Node reads such a body to its end before the connection takes another request. The server lets it do so only when the declared length is within the operation's body limit (2 MiB on a path that takes no body), so that a caller that is still sending reads its answer rather than a reset connection. A longer body, a body whose length is not declared and a body already partly read close the connection (`Connection: close`). So the server never reads more than that limit of a body it did not take.

**Writes, one at a time** (rule 4, `src/writes.js`). A write arrives when its request has passed the steps above, with its body read in full. It waits in one queue for the whole server and runs when the writes before it have ended, whatever their project. Rule 4 asks this of writes to one project. One queue is stricter, and it is what the store allows: the store is one SQLite connection, which holds one transaction at a time. So a long write, such as a large snapshot, holds the writes of other projects until it ends.

A write runs in one transaction (`BEGIN IMMEDIATE` to `COMMIT`), from its request key's check to its key's row, so a write that fails or is refused changes nothing. The same queue runs admission's note of when a credential was last used, so that note never lands inside another write's transaction; so does the daily backup's copy (see [Daily backup](#daily-backup)). Its handler may wait (`await`), and the next write waits with it. A read that runs meanwhile on the same connection sees the write's rows before they commit, so a write handler does its waiting before it writes. A handler never begins or ends a transaction itself. It refuses by throwing a Problem. One refusal keeps its write: a Problem marked by `keepingWrite` in `src/problem.js` commits the transaction, and its request key keeps the refusal, its trace ID included, so a repeat answers the same, its log line naming the refusal's code. Only API-259's `confirmation_cancelled` on a record that merged uses it, since the contract has that refusal also put recording the cancel on the agent to-do (see [Reports](#reports)); it changes TASK-415's rule that a refusal rolls back for that one case, an exception the maintainer approved through the delegate they named for checkpoints on 2026-11-24. A success is 200 or 201 with a non-empty JSON object, as the contract makes every success. Any other answer, such as another status, a body that is not such an object or a framing header, is a fault that answers `internal`; a write's answer is checked before anything is stored, so such a write changes nothing.

**Request keys** (rule 3, `src/keys.js`). The first answer to each key is kept in TBL-169 `request_keys`. It is the request layer's own table: every write with a key fills it, so no operation lists it (note 21 of the WBS).
- The same key from the same caller within 7 days gets the first status and answer, and nothing is written. The key keeps the answer's status and body, not headers of the write's own, which no operation with a request key has in the contract. Keys are kept 7 days, beyond the 24 hours that rule 3 asks, because the hub keeps an unsent write that long and sends it again under the same key.
- The `action` column holds the `operationId`, a space, and the SHA-256 in hex of the request's path and body bytes as sent. The same key sent again for another operation, another path or another body therefore finds another action and gets `request_key_reused` (409). The digest is of the request, not of a credential. It lives only in the owner-only store, and no log line holds it (rule 5).
- A refused or failed write leaves no key behind, so the same key runs it again. A refusal that keeps its write, as above, keeps its key too.
- A key belongs to its caller (`actor`: `owner` or the credential's ID), so two callers' keys never meet.
- The write of a new key drops every key older than 7 days.
- A route's `repeat(result)` gives what a repeat answers instead of the first answer. API-280 uses it to keep no secret, and answers a repeat with 200 and `secret` null.

## Agent credentials

The owner issues, lists and revokes the credentials agents use (`src/credentials.js`; SPEC-049, SPEC-050). Each is a row of TBL-146 `agent_credentials`.

- **IDs.** A credential's ID, which the agent sends as `CF-Access-Client-Id`, is `ac_` and its row's key in base 32 with the contract's 32 characters, 12 of them with leading zeros (`src/ids.js`). The store keeps no other ID, and later tasks write their rows' IDs the same way. An ID is not a secret.
- **Issue** (API-280, `POST /api/credentials`, with a request key). The name is text of 1 to 64 characters, counted as characters, that is not only white space. It is kept as given, and a name another credential has, revoked or not, gets `name_taken` (409). Any other field, or a name that is not text, gets `invalid_request` with `field`. The secret is 32 random bytes from `node:crypto` in base64url, 43 characters, in the 201 answer only. The store keeps its SHA-256 in hex: 32 random bytes cannot be guessed back from their digest, so a slow hash such as scrypt would only slow every agent request. The same request key again answers 200 with the same credential and `secret` null, and the key's row keeps that answer, never the secret.
- **List** (API-279, `GET /api/credentials`): names and times only, never a digest. Live credentials come first, then revoked ones, each the newest first, up to the contract's 500.
- **Revoke** (API-281, `POST /api/credentials/{credential}/revoke`, with a request key and the body `{}`). It marks the credential revoked and releases its live claims (TBL-167, `release_reason` `revoked`), and `claims_released` says how many. Revoked again, it changes nothing and answers `changed` false. An ID that names no credential gets `credential_not_found`.
- **Last used.** An admitted agent request sets `last_used_at`, at most once a minute per credential.

The tests check the three operations as each later operation is checked:
- `test/responses.js` checks each answer against the response the contract lists for its status, its type, its schema and the headers it declares included, and that every listed response was answered, each Problem code its examples give included.
- `test/tables.js` (note 23 of the WBS) wraps the store. SQLite's authorizer reports each table a statement reads and writes as it is prepared. Each run of the statement is noted for the operation whose handler runs it (`src/operation.js`), or for the request layer outside every handler. The tables the schema's keys reach are left out: those a foreign key's check reads, and those a cascade deletes from. An operation must touch exactly the tables its `x-corthex.tables` lists, and the request layer only TBL-169 and TBL-146. Each table an operation changes, by inserting into, updating or deleting from it, must also be fed by one of its spec rows, SPEC-014 aside: the table's trace list in `db/nexus.sql` names one. The contract's lists hold what an operation reads as well, so this rule of pull request 105's check runs here, on what a write changes when it runs, and `tests/test_api.py` checks only that a write lists at least one table its spec rows feed. `test/tables.test.js` checks that the tests of every route in `src/routes.js` call this check.
- `PENDING` in `test/tables.js` names the tables an operation lists that a later task of the WBS builds its part of. Until that task lands, the check leaves them out. A pending table that the operation touches still fails the check, so the entry goes with the task that builds it, and `test/tables.test.js` checks that each entry names tables the operation lists and the WBS gives that task. None is left: API-242's TBL-151 to TBL-153 were the last entry, which TASK-419's drawing removed.

## Snapshot intake

The hub sends each project's snapshot with push and reads the commit NEXUS holds before every push (`src/snapshots.js`, `src/snapshot.js`; SPEC-001, SPEC-002, SPEC-014). Both are agent operations. A project is a row of TBL-147 `project_spaces`, each snapshot it keeps a row of TBL-148 `snapshots`, and what a snapshot holds is kept in TBL-149 `document_blobs` and TBL-150 `snapshot_files`.

- **Formats.** NEXUS takes the snapshot formats `corthex-hub/0.2` and `corthex-hub/0.3`, named by the snapshot's `schema`; any other gets `unsupported_format` (400) with `versions`. 0.2 carries the pictures of stages 01, 05 and 07. 0.3 adds a picture for each file of stages 03, 08 and 09, with the file's path as its `key` and its whole text as `source.text`.
- **Push** (API-242, `POST /api/snapshots`, a body of up to 8 MiB). The snapshot is checked against the contract's `Snapshot` schema, the rules of its format included, then against the rules NEXUS adds to keep it: its commit at `repos["."].default.commit`, where the pinned hub sends it; `repos["."].url`, when given, an https address; each picture of that commit and of a part `project.parts` names, or of no part; one picture per stage and part for stages 01, 05 and 07, and one per file for 03, 08 and 09; keys that are paths in the repository; and no JSON nested deeper than 100 levels. A broken rule gets `invalid_snapshot` (400), whose `field` says where, never the value. A push that carries `Idempotency-Key` gets `invalid_request`: the hub sends none, since the same commit again is how NEXUS knows a repeat.
- **The first send** of a project creates its space, held at the snapshot's commit, with the snapshot as revision 1 (SPEC-002): 201 and `created` true. The pinned hub sends one only after the user's yes (`push --first`). Two first sends at once run one after the other, so the second is the same commit.
- **The next commit** must name the held commit in `replaces` (REQ-002), or it gets `commit_not_replaced` (409) with `held_commit`. It becomes the next revision and the held commit, and `replaced` names the commit before it.
- **A commit held at an earlier revision** gets `older_snapshot` (409) with that `revision`.
- **The held commit again** is the same revision, and nothing is kept again: 200 and `same_commit` true. In a newer format than it came in, such as 0.3 after 0.2, it completes that revision: NEXUS keeps the picture files the older format did not carry, and the held commit's format becomes the newer one. The rest of the revision stays as first kept.
- **Another repository.** A snapshot whose `repos["."].url` is not the project's gets `repository_mismatch` (409), and so does one without it once the project has one.
- **The held commit** (API-243, `GET /api/snapshots/{project}/held`) answers `default_commit`, its `revision` and the `format` it came in, and the `formats` NEXUS takes, so that the hub can tell whether to send the same commit again in a newer format. A project with no space gets `project_not_found`.

A refused push changes nothing, since it runs in its write's transaction.

**Documents.** NEXUS keeps a snapshot as documents, each text once by its SHA-256 in `document_blobs`, named by a path in `snapshot_files`:

| Path | Stage | Text |
| --- | --- | --- |
| the picture's `key` | 03, 08 or 09 | the file's whole text, `source.text` |
| `/pictures/<stage>`, or `/pictures/<stage>/<part>` for a part | 01, 05 or 07 | the hub's parsed picture, `source`, as JSON |
| `/items/<stage>` | that stage | the snapshot's items of that stage, as a JSON array, for each stage with items and each stage whose record says the hub read it (`read` true): an empty list for one with none, unless the snapshot is truncated |
| `/snapshot` | none | the rest as it came: every other field, the pictures without their sources (a file's picture keeps the members of its source other than `text`) and the items of no stage |

The schema lists only the fields NEXUS reads and says NEXUS keeps the others as they come; `/snapshot` keeps them, the project's title and parts among them. A key never starts with `/`, so the two kinds of names never meet.

**Secrets and email addresses** (REQ-077, `src/sensitive.js`). A document whose text looks like a secret (an OpenAI-style, GitHub, Slack or AWS key, or a private key's first line) or an email address is left out. The answer's `refused` names it with its part, its stage, where it is from (its key, or the stage's source as the snapshot's stage record names it) and `why`, `secret` or `email`, up to 500 of them. The patterns are the pinned hub's own, which redacts every text before it sends it, so NEXUS leaves out no more than the hub hides. The rest, `/snapshot`, has no stage to name it by, so a snapshot whose other fields hold such text, which the hub never sends, gets `invalid_snapshot` naming the field. No answer or table holds the text of a document left out or what was found in it, and no log line holds its path either (rule 5).

**Drawing.** After it keeps a snapshot, the push draws it in the same transaction, as [Drawing](#drawing) says, and the answer's `diagrams` and `failures` say what it drew. The same commit again in the same or an older format draws nothing: every diagram is `unchanged`, except one whose source in the push failed or is left out (see [Drawing](#drawing)), which is `failed` and named in `failures` again. What a drawing changes after it, which the answer counts in `confirmations_invalidated`, `change_sets_reflected` and `threads_moved`, is in [After a drawing](#after-a-drawing).

`test/snapshots.test.js` sends 0.2 and 0.3 snapshots of this repository that `test/snapshots.js` builds from its files when the tests run, so no snapshot file is kept in Git. It builds 0.2 from the schema too, rather than with the pinned hub, because the server's tests run with Node alone. It makes every secret-looking and email-looking value at run time from parts. Its pushes draw with the test drawers of `test/drawers.js`, so its answers count diagrams.

## Drawing

The push draws each snapshot it keeps into diagrams (TBL-151 `diagrams`), a drawing of each diagram from the snapshot (TBL-152 `drawings`) and the drawing's elements (TBL-153 `elements`), in the push's transaction (`src/drawing.js`; SPEC-001, SPEC-005). Each stage's drawer, TASK-421 to TASK-427, turns a document into elements and plugs in through `DRAWERS`. TASK-419 built what they plug into, and its tests draw with drawers of their own. `DRAWERS` holds TASK-421's [DDD board](#ddd-board), TASK-422's [ERD](#erd), TASK-423's [item table](#item-table), TASK-424's [user flow](#user-flow), TASK-425's [sitemap](#sitemap), TASK-426's [screen states](#screen-states) and TASK-427's [mockup](#mockup) drawers so far. What the drawers share is in `src/drawer.js`: the `SourceFailure` they throw, element keys, the contract's limits, the reading of a picture's entries and warnings, the measure of text, where a wide character such as Hangul takes the room of two, and the placing of boxes sized for their text. A drawer imports it in place of `src/drawing.js`, so no two files import each other.

**Diagrams.** A diagram is drawn from one document of the snapshot. Its `source_key` is that document's path in `snapshot_files` (see Documents above), so a drawing finds its source from the diagram alone.

| Stage | Diagrams | `source_key` | Kind |
| --- | --- | --- | --- |
| 01, 05, 07 | one per stage and part | `/pictures/<stage>` or `/pictures/<stage>/<part>` | `ddd_board`, `erd`, `sitemap` |
| 03, 08, 09 | one per file | the file's key, its path in the repository | `user_flow`, `screen_states`, `mockup` |
| any other stage with items, or that the hub read | one | `/items/<stage>` | `item_table` |
| 03, 08, 09 while they show no picture (see [Item table](#item-table)) | one | `/items/<stage>` | `item_table` |

- **Removed.** A diagram whose document a snapshot does not hold gets `removed_at`, and is no longer one of its stage's diagrams. The exception is a picture of a stage whose pictures the snapshot's format does not carry. It stays as last drawn, so a corthex-hub/0.2 snapshot after 0.3 pictures keeps them, each drawing's version naming the commit it comes from (SPEC-005).
- **Left out.** A diagram whose source the snapshot leaves out is not removed. No approved document states this rule; the maintainer approved it through the delegate they named for checkpoints.
  - **Which sources.** A document left out as REQ-077 asks (see Secrets and email addresses above), and a source a `left_out` entry names: by the diagram's part and stage, and for a file of stage 03, 08 or 09 by its `key`. A key names its file whatever part NEXUS last read for it, since a revision that a newer format completed records none (see A diagram's part below); the push answer then names the entry's part. An entry with no key names every file of its stage and part, as the hub's `other-repository` entries do. A `left_out` entry names no item table.
  - **Every part, for another repository.** The server reads an entry's `why` for this alone: an `other-repository` entry names its stage in every part, part `''` included, since a stage's source is one setting for all its parts. The hub writes that entry only for each part the project declares, so a stage's picture or file in part `''`, or in a part the project no longer declares, would otherwise be removed. The push answer names the diagram's part. Other entries, such as `size`, name their own part only. The maintainer approved this too through the delegate they named for checkpoints.
  - **What it keeps.** The diagram keeps its last good drawing, as for a source that cannot be read (SPEC-001). It gets a `failed` drawing at its source, with no line: the file's key, or the stage's source as the snapshot's stage record names it. That drawing's digest is the SHA-256 of the source's path as absent, which no drawing that read the source has, so the same source left out again makes no new drawing. The push counts the diagram `failed` and names it in `failures`.
  - **What stays.** As for any failed drawing, nothing moves, and its confirmation and its stage's pass stay (see [After a drawing](#after-a-drawing)). A picture so kept still shows as its stage's picture, so the stage's item table does not come back; an item table that makes way for its stage's pictures still does. The next push that sends the source draws it again.
  - **What is still removed.** What the hub names only by a check's count is removed, as any source the snapshot does not hold: the files past its limits (in 0.3, 400 files a stage, 1,000 pictures, and the files it no longer reads once their texts pass the snapshot's budget), an object it could not read, and an omission past the 1,000 entries `left_out` holds.
  - **What it does not say.** The diagram says that it failed and where, not why. The hub's warning and the answer's `refused` say why.
- **Back again.** A removed diagram whose document a snapshot draws again comes back as the same row, with its threads. A stage's item table makes way for the first picture drawn of its stage, and comes back when the stage has none again (see [Item table](#item-table)). So a 0.2 snapshot after 0.3 pictures still shows the pictures.
- **No pictures.** A stage of 03, 08 or 09 that shows no picture shows its item table, under a format that carries its pictures as under one that does not (note 3 of the WBS; see [Item table](#item-table)).
- **A completed revision**, the same commit in a newer format, draws only the stages the newer format adds: their pictures, and their items again, those the revision kept before, so that each of their item tables makes way for its pictures or stays. An older push may not have kept a stage's items, such as one its hub did not read; that stage draws no table.
- **A diagram's part** is in its `source_key` for a stage's picture, and an item table has none. The store's columns keep no part for a file's picture. The snapshot's `/snapshot` document names it beside the file's key, except in a revision that a newer format completed, which added only the files. A file's diagram takes it from its last drawing, passing over a drawing kept for a source left out: that drawing's snapshot does not name the file, and its digest marks it (see Left out above).

**Drawings.** Each diagram the snapshot holds is drawn again. Its drawing is new when its `source_digest`, or what it drew, differs from the diagram's last drawing. Otherwise the diagram is unchanged and keeps that drawing, so a confirmation of it stays (SPEC-033).
- **The digest** is the SHA-256 of the documents the drawer read, its own included, each by path and SHA-256, in the order of their paths. When the drawer reads its warnings and there are any, they join it too, as `/snapshot#picture-partial` and the SHA-256 of their JSON, a name no document has. So a drawer that draws no warnings is not drawn again when only they change, and a drawing that reads none, or has none, has the digest it had before warnings were given. A drawer that draws otherwise from the same source, such as a newer version of it, makes a new drawing with the same digest.
- **A drawing is `drawn` or `failed`.** A drawer that cannot read its source throws `SourceFailure`. Its drawing keeps where it failed, as `failed_path` and `failed_line`, and has no elements; the diagram keeps its last good drawing (SPEC-001). The same source failing again makes no new drawing.
- **`document_version`** is the snapshot's commit, and `drawn_at` the push's time.
- **A drawing reads the documents of its own snapshot only.**

**Elements.** A drawer returns a drawing's elements. Each has a key that stays the same across drawings, so comments, positions and the diff follow an element from one drawing to the next (TBL-153):
- the key the drawer gives;
- otherwise `elementKey`'s: its trace ID, or its kind and name under its parent's key, such as `lane:Owner/event:Snapshot accepted`, with white space made single spaces. A key over 200 characters keeps its start and ends with `#` and 16 hex digits of its SHA-256;
- a worked-out key that another element of the drawing has gets `#2`, `#3` and so on, in the elements' order.

**The answer.** API-242's `diagrams` counts:
- `drawn`: the new drawings that drew;
- `failed`: the diagrams whose source in the push fails, whether it changed or not. Each is named in `failures` with its `diagram`, `part`, `stage` and `where`, the path and its line, up to 500. A diagram that is not drawn again, in a completed revision or the same commit again, fails when its last drawing failed and the push holds its source;
- `removed`: the diagrams the snapshot removed;
- `unchanged`: every other diagram that is not removed, those kept as last drawn included.

**A drawer** is a function that answers at once, never with a promise:

```js
import { SourceFailure } from './drawer.js';

// A drawer of a stage's picture, as src/erd.js is the ERD's.
function draw({ stage, part, key, kind, source, text, read, warnings }) {
  const picture = JSON.parse(text);
  // ... throw new SourceFailure() for a picture it cannot read at all: the drawing fails at its source.
  return { name: 'ERD', elements: [{ trace_id: 'TBL-151', kind: 'table', name: 'diagrams', detail: { columns: [] } }] };
}
```

| It gets | Meaning |
| --- | --- |
| `stage`, `part`, `key` | The document's. `key` is null except for a file of stage 03, 08 or 09. |
| `kind` | The diagram's kind. |
| `source` | The repository path the document comes from: the file's key, or the stage's source as the snapshot's stage record names it. |
| `text` | The document as kept: a file's whole text, the hub's parsed picture as JSON, or the stage's items as a JSON array. |
| `read(path)` | Another document of the same snapshot by its path, or null when the snapshot holds none. What it reads joins the digest. |
| `warnings` | For a stage's picture (01, 05 and 07), what the hub left out of it: the hub's `picture-partial` checks of the picture's stage that name its part or no part, from the snapshot's `checks` that `/snapshot` keeps, in their order, up to 500. The hub adds one for each statement or entry it leaves out of a picture, as `<path>:<line>: <detail>`, and one for a source file it could not read, as `<path>: <detail>` with no part. Each is `{ path, line, detail }`: the repository path and line it starts with, each null when it names none, and the rest. The path ends at the first colon and is the path of a picture source, a `.md`, `.markdown`, `.sql`, `.yaml` or `.yml` file as the hub reads for stages 01, 05 and 07, so a message that starts with words, or whose detail holds a colon and a number, gets no path or line it does not name, and a path with a space keeps its own. Any other document has none, `[]`. `pictureWarnings(checks, stage, part)` in `src/drawing.js` reads them. |

| It returns | Meaning |
| --- | --- |
| `name` | Optional: the diagram's name, cut to 200 characters. Until a drawer names it, a diagram is named `DDD board`, `ERD`, `Sitemap` or `Item table`, or by its file's name. A drawing that fails leaves the name as it was. |
| `elements` | Up to 5000. More fail the drawing at its source. |
| `elements[].kind` | A lowercase word of up to 40 characters, such as `table`, `line` or `token`. |
| `elements[].name` | Text, cut to 200 characters; `''` when it has none (SPEC-010). |
| `elements[].trace_id`, `key`, `parent`, `status`, `detail` | Optional: a trace ID; the element's key; the key of another element of the drawing; up to 60 characters; a JSON object of what the kind draws, such as a table's columns. Left out or null, each has none, and `detail` is `{}`. |

- **A source it cannot read:** it throws `new SourceFailure({ path, line })`. `path` is a repository path of up to 300 characters, the document's `source` when left out; `line` is a line number or none.
- **A fault:** any other error, or an answer that breaks the rules above. The push answers `internal` and changes nothing, and the log names only the error's kind.
- **A kind without a drawer** is not drawn: its documents make no diagram.
- **Other drawers:** `snapshotRoutes({ drawers })` in `src/snapshots.js` makes the push's routes with them, as the tests do. It checks that each is a function for a kind TBL-151 names.

No log line holds a source's text or where a drawing failed (rule 5). The answer's `where` is a path in the repository, never a server path.

`test/drawing.test.js` draws this repository's snapshots, changed in each test, with the drawers of `test/drawers.js` and others made in the tests. It checks TASK-419's done condition: a failing source keeps the last drawing and is named in failures; a 0.2 snapshot after 0.3 pictures keeps them; an element keeps its key across drawings. It also checks the diagrams of each kind, the item tables that make way, the empty item tables, a diagram that is removed and comes back, a document a drawer reads, the drawer's rules and the tables API-242 lists.

`test/left-out.test.js` checks the sources left out with pushes of this repository's snapshots: a stage's picture and the files of a stage in another repository, in every part of the stage, part `''` too, a file left out for size by its key, also when NEXUS read no part for it, documents NEXUS refuses (a picture, a file and an item table), and a file the hub names only by a count, which is removed. It also checks that a left-out source keeps its confirmation, its stage's pass and its open threads, and its part in the project read, that the same commit again names it failed, and that the next push that sends it draws it again.

## DDD board

`src/ddd-board.js` is TASK-421, the drawer of the `ddd_board` kind. It draws the stage-01 picture as one board of the timeline lanes, the contexts with their command tables, the dependencies between them and the hotspots (SPEC-003). Its source is the pinned hub's parsed picture of the project's domain document, as the contract's `Snapshot` says of stage 01, so NEXUS parses no Markdown of a push; it reads only a proposal's, as the hub would (see [Reading Markdown, SQL and YAML](#reading-markdown-sql-and-yaml)). The hub's `domain.py` reads the document. Its picture, format 1, holds:

- the contexts: each with its trace ID, name, type, purpose, external systems and removed mark, and the rows of its command tables (who gives the command, read model, command, aggregate and events);
- the glossary terms of the aggregates and read models;
- the dependencies: from, to, call or event, why, and what passes;
- the hotspots: text, the contexts they name, state, answer and number;
- the timeline's lanes, each with the events of its places in order.

Each entry carries `where`, the file and line it comes from.

**Board arrangement.** SPEC-003 does not say how the board is arranged. The coordinator chose this arrangement for TASK-421, and the maintainer approved it through the delegate they named for checkpoints. `REGIONS` in `src/ddd-board.js` is the one place that orders the regions, and `hotspotFrame` with `HOTSPOT_BAND` is the one place that places hotspots. The board has three regions, top to bottom:

- **The timeline:** a lane for each timeline lane, with its name at the start and its events left to right in the order of their places. Alternatives at one place stand one above another.
- **The contexts:** a frame for each context, headed by its trace ID, name and type.
  - Inside a frame, each row of the context's command tables is a column of stickies. The bands run top to bottom as on the stage-09 mockup's board: read model, command, aggregate, event and policy. The rows stand left to right in their order, as time runs on the mockup's board, and the context's hotspots follow them in the aggregate band.
  - The frames, and a box for each external system the dependencies name, are the boxes of a layered graph whose lines are the dependencies. The caller stands above the context it depends on, so a line runs between boxes and never through a sticky.
- **The Hotspots lane,** only when some hotspot names no context the board draws.

What it draws, in this order:

| Element | `kind`, `status` | `detail` |
| --- | --- | --- |
| Each timeline lane, in its order | `lane` | `where`; `box`, the lane's band across the region |
| Each event of a lane, its parent the lane | `event` | `place`, its place's number from 1; `box` |
| Each context, in its order, with its trace ID and name | `context`; `removed` when the hub marks it removed | `type`, `purpose`, `external`, `where`; `box`, the frame |
| Each sticky of the context's rows, row by row, its parent the context | `read_model`, `command`, `aggregate`, `event` or `policy`; `removed` for a read model or aggregate whose glossary term the hub marks removed | `where`, the row's; `box`; for a command, `actor` too |
| Each hotspot that stands in the context, after its stickies, its parent the context | `hotspot`; `answered` or `open` | `number`, `state`, `answer`, `contexts`, `where`, `box` |
| Each external system, a name a dependency gives that is no context, once for each name | `external` | `box` |
| Each dependency, named by its why, its parent the box it starts from | `dependency` | `from` and `to`, the keys of its two boxes; `kind` (`call`, `event` or `''`), `why`, `data`, `where`; `points` |
| The Hotspots lane, when it holds any | `hotspot_lane`, named `Hotspots` | `box` |
| Each hotspot of the Hotspots lane, its parent the lane | `hotspot`; `answered` or `open` | as above |
| A table or other part of the document the hub left out, one for each of the picture's warnings, named by what the hub says of it | `table`, `left_out` | `where`: its file and line; the file alone when the hub names no line or the two would pass 300 characters; or null |

- **A table that cannot be read.** The hub's `domain.py` names what it leaves out in a `picture-partial` check with its file and line: a document with no context heading, a command table under no context heading, a source file it cannot read, or a list over its limit. The drawer gets each check as a warning and shows it as a `table` element with status `left_out` (SPEC-003).
- **An entry the drawer cannot read,** one that is not in the picture's form, is left out the same way: it is marked `unreadable`, with its `where` and the kind it would have had.
  - An unreadable context is an empty frame, and an unreadable row is a `command` sticky of its context.
  - An unreadable lane is its name alone, and an unreadable hotspot stands in the Hotspots lane.
  - An unreadable dependency has no line and no box.
  - A term entry it cannot read is passed over, as the board draws no terms of its own.
- **Stickies.**
  - A read-model or aggregate cell that names several things is split at commas and line breaks, as the hub reads its definitions, into a sticky for each name.
  - Each such sticky carries the trace ID of its glossary term: the term the hub's lists give for that context and name, compared without white space or case.
  - A TERM ID that those lists give is dropped from a name wherever it stands, with any brackets it leaves empty, as the hub drops it. So "Diagram TERM-5" and "Diagram (TERM-5)" both draw a sticky named "Diagram".
  - A cell that names nothing, such as `-` or `none`, has no sticky.
  - A row given by a policy ("Policy: when ...") has a `policy` sticky named by what follows "Policy:", and none when that names nothing. The command's `actor` is what comes before it.
- **Hotspots.** A hotspot stands in the frame of the first context it names that the board draws, or else in the Hotspots lane; `contexts` lists every context it names. It is `answered` when its state starts with "answered", or with "답함" as a Korean document writes it, and `open` otherwise.
- **Dependencies.** A dependency names a context by its trace ID at the start of its text, or by the context's name in any case. Any other name, such as "Miro" or "Every context", is an external system's box, one box for each name.
- **Places.** `layout.js` places each region:
  - the timeline left to right, a lane to a row and a place to a column;
  - each frame's inside, a band to a layer;
  - the frames and external systems as a layered graph;
  - the Hotspots lane as a row.

  It then places the regions one under another.
  - `box` is `{ x, y, width, height }`, its top left corner and its size. A dependency's `points`, `[{ x, y }]`, run from the box it starts from to the box it ends at.
  - Sizes are worked out for 12-pixel IBM Plex Mono. A sticky, an event, an external system and a hotspot are 148 by 80 pixels, as the mockup's stickies are. A lane's name is 96 to 240 pixels wide. A frame has a 32-pixel header with its trace ID, name and type, and 12 pixels of padding round its inside.
  - A left-out table has no box.
- **Keys.**
  - A context: its trace ID, or `context:` and its name.
  - A lane: `lane:` and its name. An event: its lane's key, `/event:` and its name.
  - A command: its context's key, `/command:` and its name. The row's other stickies: the command's key, `/`, their kind, `:` and their name, such as `CTX-039/command:Confirm diagram/read_model:Diff view`.
  - A hotspot: `hotspot:` and its text without its number.
  - An external system: `external:` and its name.
  - A dependency: its start's key, `/dependency:`, its end's key and its kind.
  - A left-out table: `table:` and what the hub says.

  A key another element already has gets `#2`, `#3` and so on.
- **A picture it cannot draw** fails at its source, the stage's source with no line. That is a picture that:
  - is not format 1 with a list of contexts;
  - has a timeline, dependencies, hotspots or term lists that are not lists;
  - has more than 5000 elements;
  - or is too large for `layout.js` to place.

  It reads its warnings only once the board is placed. So a picture that fails before then fails again with the same digest and makes no new drawing.

`test/ddd-board.test.js` checks TASK-421's done condition: this repository's stage 01 draws as a stored expected drawing.
- `test/ddd-board-picture.json` is the pinned hub's picture of the stage source's Markdown files, with each file's SHA-256. The source is `docs/01-domain/nexus.md`; its Korean translation is left out, as the hub leaves it out.
- `test/ddd-board-expected.json` is its drawing. The test compares it exactly, both alone and through the push with the server's own drawer.
- The test fails when a stage-01 document changes or is added and the picture does not, and when the drawing changes and its file does not.
- `tests/test_ddd_board_picture.py` makes the picture again with the pinned hub and fails when it differs from the stored one.

To make both files again, from the repository's root:

```sh
CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_ddd_board_picture.py --write
(cd server && node test/ddd-board-expected.js --write)
```

It also checks, with pictures and checks it makes:
- SPEC-003's 7 contexts and 7 lanes;
- a table the hub left out, shown with its file and line, and the warnings in the digest;
- unreadable entries;
- where hotspots stand;
- dependencies by trace ID and by name, and external systems;
- a row's cells;
- a picture in the wrong format or with more than 5000 elements;
- that no log line holds the picture's text (rule 5).

## User flow

`src/user-flow.js` is TASK-424, the drawer of the `user_flow` kind: it draws each flow file's Mermaid flowchart as one diagram of its boxes, decisions and labelled arrows (SPEC-006). Its source is one picture of a corthex-hub/0.3 snapshot: a flow file of stage 03, with its path as the key and its whole text, as the pinned hub's `snapshot03.py` sends it. NEXUS parses the flowchart itself, with a parser of the subset below written in that file and no package. The diagram is named by the file's first heading, such as "FL-001 Put a project on NEXUS". A file with none is named by its file's name, such as `FL-001-put-a-project-on-nexus.md`, as a diagram whose first drawing fails is named until it draws. The drawer gives that name itself, because `drawing.js` keeps a diagram's last name when its drawer gives none, so a heading taken out later would otherwise leave its old name.

What it draws, in this order:

| Element | `kind` | `detail` |
| --- | --- | --- |
| Each lane, a subgraph other than the legend, in its order, named by its title, its parent the lane it stands in | `lane` | `id`, the subgraph's ID; `where` |
| Each box, in the order the flowchart first names it, named by its label without the lines that hold only trace IDs, its parent its lane | `terminal`, `step`, `decision`, `document`, `store`, `llm` or `grading` | `id`, the node's ID; `lines`, the label's lines as the author broke them, without those of IDs; `ids`, those trace IDs; `marks`, `key` and `gap` from its classes; `lane`, its lane's key or null; `where`; `box` |
| Each arrow, in its order, named by its label, its parent the box it leaves | `arrow` | `id`, the edge's ID or null; `from` and `to`, the keys of its boxes; `label`; `line`: `pass`, `grade`, `write`, `read` or `thick`; `where`; `points`; `label_box`, its label's box or null |

`where` is the file and line that defines the element, such as `docs/03-user-flow/FL-001-put-a-project-on-nexus.md:11`: for a box, the last line that gives its shape, or the first that names it when none does.

The coordinator chose the next five points for TASK-424, and the maintainer approved them through the delegate they named for checkpoints on 2026-11-24.

- **Box and line kinds.** The drawer reads the whole of the corthex-diagram grammar, so that a flow written to it draws whole.
  - A box's kind comes from its shape: a stadium is a `terminal`, a start or an end; a rectangle a `step`; a diamond a `decision`; `doc` a `document`; a cylinder a `store`; a framed rectangle an `llm` box. A step of class `grade` is a `grading` box.
  - Its classes `key` and `gap` are its `marks`.
  - `-->` is a `pass` line and `-.->` a `grade` line. `==>` is a `write` or `read` line by its class, or `thick` with neither.
  - Only the mockup's three kinds, the start or end, the step and the decision, and the gap mark have an approved look. The page draws document, store, LLM and grading boxes, the key mark and the write, read and grade lines as TASK-458 proposed (see [Workbench pictures](#workbench-pictures)).
- **Direction.** `TD` and `TB` draw top to bottom, and so does a flowchart that names no direction. `LR` draws left to right. `BT` and `RL` are outside the subset.
- **Lanes.** A subgraph is a lane: an element of kind `lane` that is the parent of its boxes, and each box names its lane in `detail.lane`, so the panel can show it.
  - A lane has no frame. The boxes are placed as usual and nothing overlaps. Frames can come once `layout.js` keeps a lane together.
  - A box is in the first lane to close that names it, as Mermaid places it: an inner lane before the lane round it. Naming it outside any lane does not count.
  - The legend subgraph, titled Legend or 범례, is left out with the subgraphs in it, their boxes and the links that touch them, since the page shows its own legend.
  - `direction` inside a subgraph is skipped.
- **One flowchart per file.** The flowchart is the one mermaid block whose first statement is `flowchart` or `graph`. Other mermaid blocks, such as a sequence diagram, are skipped. A file with none fails at its source with no line. A second flowchart fails at its first line, so that the owner never confirms a diagram that leaves part of the file out.
- **A box's text.** A box's name is its label without the lines that hold only trace IDs, joined with spaces, such as "Create an empty project space". Those IDs are its `ids`, which the page shows under the name, as the mockup does. `lines` keeps the author's line breaks, and the box's size follows them.

**The subset it reads.** Anything else fails the drawing at its line of the file, so the page shows the source text with that line marked (SPEC-006, SCR-145).
- **The file.** Markdown, whose fenced code blocks open with three or more backticks or tildes. The flowchart is in a block whose info string is `mermaid`; a block left open runs to the end of the file. The file's first ATX heading outside the code blocks names the diagram.
- **The first statement.** Before it, blank lines, `%%` comment lines and front matter between two `---` lines are skipped. It is `flowchart` or `graph`, with `TD`, `TB`, `LR` or nothing, and an optional `;` that other statements may follow on its line.
- **Statements**, one or more on a line, with `;` between them: a `style`, `classDef`, `linkStyle` or `direction` statement ends at its `;` too. Blank lines and lines that start with `%%`, Mermaid's directives `%%{…}%%` among them, are skipped.
  - **A node** is its ID alone, a step labelled by it, or its ID with a shape: `A(["…"])` terminal, `A["…"]` step, `A{"…"}` decision, `A[("…")]` store, `A[["…"]]` LLM, or `A@{ shape: …, label: "…" }`. The `shape` is one of the grammar's names, `stadium`, `rect`, `diam`, `doc`, `cyl` and `fr-rect`, or one of Mermaid's other names for them: `pill`, `terminal`, `rectangle`, `proc`, `process`, `diamond`, `decision`, `question`, `document`, `cylinder`, `database`, `db`, `framed-rectangle`, `subproc`, `subprocess` and `subroutine`. The `label` is optional.
  - A label is quoted text with no quote in it, or bare text with no quote. `<br>`, `<br/>` or `<br />` breaks it into lines.
  - `:::name` after a node gives it a class.
  - A node ID is letters, digits and `_`, with single dashes inside, of up to 64 characters, and not `end`. The last shape a node is given draws it, as in Mermaid.
  - **Links** join nodes, in chains such as `A --> B --> C`: `-->` (or longer, `--->`), `==>`, `-.->`, and the invisible `~~~`, which places its boxes and draws no arrow. A label is `-->|…|`, or one of the text forms `-- … -->`, `== … ==>` and `-. … .->`, quoted or not. An edge ID goes before the link: `A e1@--> B`.
  - `subgraph ID` or `subgraph ID["title"]`, and `end`; `direction` inside a subgraph.
  - `class A,B name`, for nodes and edge IDs. `classDef`, `style` and `linkStyle` are read and not drawn, since NEXUS draws with its own tokens.
- **Refused**, each at its line:
  - `BT` and `RL`, and a variant of the first statement such as `flowchart-elk`;
  - any other shape, such as `(…)`, `((…))`, `{{…}}`, `[/…/]`, `[\…\]` or `>…]`, and any other `@{ … }` shape or key;
  - Markdown strings, a quote followed by a backtick;
  - links with no head or another head: `---`, `-.-`, `===`, `--o`, `--x` and `<-->`;
  - `&`, `click`, `direction` outside a subgraph, and any other statement, such as `accTitle`;
  - an ID given to two of a node, an edge and a lane, at the line that gives it the second time; a subgraph left open, at its line; front matter left open, at its first line.

The rest:

- **Keys.** A box's key is its node ID, so the box keeps it, and the threads on it, when its label or place changes. A lane's key is `lane:` and its ID. An arrow's key is its from and to boxes, `A->B`; a second arrow between the same two gets `#2`, a third `#3` and so on.
- **A comment on a flow.** No element of a flow carries a `trace_id`: a box's IDs are in `detail.ids`. The diagram holds its flow's trace ID as a whole instead. Its name, the file's first heading, starts with it, such as FL-005 in "FL-005 Reflect accepted changes into Git"; so does the file's name, which names a diagram until it draws, such as `FL-005-reflect-accepted-changes-into-git.md`. So an agent's comment with item `FL-005` and no diagram goes on that flow's diagram as a whole, unless an element of the stage holds FL-005 (see [Comments](#comments)).
- **Sizes.** A box is as large as its text and shape take, for the page that draws it (TASK-458).
  - Its text is its lines and the line of its IDs, 20 pixels a line, with 12 pixels of padding round them. Its width is its longest line's in 12-pixel IBM Plex Mono, 7.2 pixels a character and twice that for a wide character such as Hangul, up to 480 pixels, plus the padding, and at least 80 pixels. The page wraps a longer line at its spaces, as `drawer.js`'s `wrappedLines` counts, breaking a word longer than a line at the line's end, and the box is as tall as the lines it wraps to.
  - A terminal is wider by half its height, for its round ends. A decision's diamond is as wide as its text's box plus twice that box's height, and as tall as that box plus half its width. A store is 16 pixels taller, a document 8 pixels taller and an LLM box 16 pixels wider.
  - An arrow's label is a 20-pixel line, as wide as its text with 4 pixels at each side, and wraps the same way.
  - `box` and `label_box` are `{ x, y, width, height }`, and `points` `[{ x, y }]`, as `layout.js` gives them.
- **A flowchart it cannot draw** fails at its source with no line: one with more than 5000 elements, or one too large for `layout.js` to place.

`test/user-flow.test.js` checks TASK-424's done condition:
- **This repository's 13 flows draw as stored expected drawings.** `test/user-flow-pictures.json` is the pinned hub's corthex-hub/0.3 pictures of `docs/03-user-flow`, with each file's SHA-256. `test/user-flow-expected.json` is their drawings. The test compares them exactly, alone and through the push with the server's own drawers, where stage 03 lists the 13 diagrams (SPEC-006's criterion) and no item table. It fails when a flow file changes and the pictures do not, and when a drawing changes and its file does not.
- **A flowchart that does not parse shows its source text and the error line.** Each refused form fails at its line of the file. Through the push, the drawing fails with its file and line, the snapshot keeps the file's text for the page to show, and the diagram keeps its last good drawing.

The server's tests run with Node alone, so `tests/test_user_flow_pictures.py` makes the pictures again with the pinned hub's own `snapshot03.py`, over this working tree's files, and fails when they differ from the stored ones. To make both files again, from the repository's root:

```sh
CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_user_flow_pictures.py --write
(cd server && node test/user-flow-expected.js --write)
```

It also checks:
- each shape, link, label form and line kind, and the keys;
- lanes, nested lanes, the legend and `~~~`;
- wide characters and wrapped lines in the sizes;
- the directions, and statements that share a line;
- what is skipped round the flowchart, CRLF line endings, and a file with no flowchart or two;
- more than 5000 elements, and a long line of statements read at once;
- thousands of broken and random texts, which draw within the interface or fail at their source, and nothing else;
- stage 03's item table making way for the flows;
- that no log line holds a flow's text (rule 5).

## ERD

`src/erd.js` is TASK-422, the drawer of the `erd` kind: it draws the stage-05 picture as tables with their columns and keys, and a line for each foreign key (SPEC-004). Its source is the pinned hub's parsed picture of the project's schema, as the contract's `Snapshot` says of stage 05, so NEXUS parses no SQL of a push; it reads only a proposal's, as the hub would (see [Reading Markdown, SQL and YAML](#reading-markdown-sql-and-yaml)). The hub's `erd.py` reads the schema, and its picture, format 1, holds each table with its trace ID, name, columns (name, type, whether it takes null, and where), primary key, unique rules, foreign keys and where, the file and line it comes from.

What it draws, in this order:

| Element | `kind`, `status` | `detail` |
| --- | --- | --- |
| Each table of the picture, in its order, with its trace ID and name | `table`; `removed` when the hub marks it removed | `columns` (each `name`, `type`, `null` and `keys`: `primary`, `foreign` and `unique` for a column that is in the primary key, in a foreign key, or alone a unique rule that is not partial), `primary_key`, `unique`, `where` and `box` |
| A table entry it cannot read, one that is not in the picture's form: left out, and marked with its trace ID and name when it has them | `table`, `unreadable` | `columns` `[]`, `where` and `box` |
| A table that a foreign key names and the picture does not hold, once for each name | `table`, `missing` | `columns` `[]` and `box` |
| A foreign key of a table it read, named by its columns, its parent the table that holds the key | `line` | `from` and `to`, the keys of that table and of the table it references; `columns`, `references`, `on_delete`, `where`; `points` |
| A statement the hub left out, one for each of the picture's warnings, named by what the hub says of it | `statement`, `left_out` | `where`, its file and line; the file alone when the hub names no line or the two would pass 300 characters; or null |

- **A statement that cannot be parsed.** The hub's `erd.py` parses the schema. It leaves out of the picture a statement it cannot read, and adds a `picture-partial` check naming its file and line, which the drawer gets as a warning and shows as a `statement` element (SPEC-004). A table entry of the picture that the drawer cannot read is left out the same way, as an `unreadable` table with its `where`; lines still reach its box.
- **A foreign key to a missing table** goes to a `missing` table of the name it gives. A foreign key names its table as SQL does: the table of that name, or else the first one whose name differs only in case.
- **Places.** `layout.js` places every table, a referenced table above the tables that reference it. `box` is `{ x, y, width, height }`, its top left corner and its size; a line's `points`, `[{ x, y }]`, run from the table that holds the key to the table it references. A box's size is worked out from its text for 12-pixel IBM Plex Mono: a 32-pixel header with the name, a 20-pixel row for each column, 12 pixels of padding at each side, from 120 to 480 pixels wide. A statement has no box.
- **Keys.** A table's key is its trace ID, or `table:` and its name in lower case, as SQL names a table without case, so a missing table keeps its key once the schema creates it, whichever foreign key named it first; a line's is its table's key, `/line:` and its columns; a statement's is `statement:` and what the hub says. A key another element has gets `#2`, `#3` and so on. So a table keeps its key, and the threads on it, while it keeps its trace ID.
- **A picture it cannot draw** fails at its source, the stage's source file with no line: one that is not format 1 with a list of tables, one with more than 5000 elements, and one too large a graph for `layout.js` to place. It reads its warnings only once its tables are placed, so a picture that fails before then fails again with the same digest and makes no new drawing, whatever the hub left out.

`test/erd.test.js` checks TASK-422's done condition. This repository's 26 tables draw as a stored expected drawing: `test/erd-picture.json` is the pinned hub's picture of `db/nexus.sql` with the file's SHA-256, and `test/erd-expected.json` its drawing, compared exactly, alone and through the push with the server's own drawer. The test fails when `db/nexus.sql` changes and the picture does not, and when the drawing changes and its file does not. The server's tests run with Node alone, so `tests/test_erd_picture.py` makes the picture again with the pinned hub and fails when it differs from the stored one. To make both files again, from the repository's root:

```sh
CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_erd_picture.py --write
(cd server && node test/erd-expected.js --write)
```

It also checks, with pictures and checks it makes: a statement the hub left out, with its file and line, and the warnings in the digest; an unreadable table entry; a foreign key to a missing table; a picture in the wrong format; SPEC-004's 2 tables joined by 1 line; and no log line holding the picture's text (rule 5).

## Sitemap

`src/sitemap.js` is TASK-425, the drawer of the `sitemap` kind: it draws the stage-07 picture as a tree of the sitemap's screens (SPEC-007). Its source is the pinned hub's parsed picture of the project's sitemap, as the contract's `Snapshot` says of stage 07, so NEXUS parses no YAML of a push; it reads only a proposal's, as the hub would (see [Reading Markdown, SQL and YAML](#reading-markdown-sql-and-yaml)). The hub's `sitemap.py` reads the YAML. Its picture, format 1, holds each screen with:
- its trace ID, name, path, access, flows, context and terms;
- whether it is removed;
- `where`, the file and line it comes from;
- its `parent`: the place in the list of the screen the YAML nests it under. The hub lists a screen after its parent.

What it draws, in this order:

| Element | `kind`, `status` | `detail` |
| --- | --- | --- |
| Each screen of the picture, in its order, with its trace ID and name, its parent the screen it stands under | `screen`; `parent_missing` when its parent is missing, or else `removed` when the hub marks it removed | `path`, `access`, `flows`, `context`, `terms`, `removed`, `where` and `box` |
| A screen entry it cannot read, one that is not in the picture's form: left out, and marked with its trace ID and name when it has them | `screen`, `unreadable` | `where` and `box` |
| A line from each screen that has a parent to that screen, named by the screen's name, its parent the parent screen | `line` | `from` and `to`, the keys of the two screens; `points` |
| A part of the sitemap the hub left out, one for each of the picture's warnings, named by what the hub says of it | `source`, `left_out` | `where`, its file and line; the file alone when the hub names no line or the two would pass 300 characters; or null |

The coordinator chose the next three points for TASK-425, and the maintainer approved them through the delegate they named for checkpoints.

- **Tree layout.** `layout.js` places the screens top down:
  - A root stands at the top, and each screen in the layer under its parent's. The screens of one parent stand side by side, in the source's order.
  - A line runs from the parent's box down to the child's.
  - A box holds two lines, the screen's name and its path; an unreadable entry's box holds its name and its `where`. The page shows the name and hides the trace ID (SPEC-010).
  - A box is 64 pixels high: 20 pixels a line, with 12 pixels of padding round them. It is as wide as the longer line in 12-pixel IBM Plex Mono, from 120 to 480 pixels.
  - `box` is `{ x, y, width, height }`, its top left corner and its size. A line's `points`, `[{ x, y }]`, run from the parent to the child. A left-out part has no box.
- **Missing parent.** A screen whose parent is missing is drawn at the top, marked (SPEC-007).
  - Its parent is missing when it is not an earlier screen of the list: not a place in the list, the screen itself, or a later one. So no screen stands under itself, however a picture names its parents.
  - Such a screen stands in the top layer beside the roots, with status `parent_missing`. Its own screens stand under it as usual.
  - `parent_missing` comes before `removed`, and `detail.removed` keeps the hub's mark.
  - The picture gives no name for a missing parent, so no box stands for it.
  - The hub lists a parent before its children, so a picture it makes has no missing parent; another picture can have one.
- **Terms without a screen.** The picture's `without_screen` lists the glossary terms that the sitemap says have no screen, such as TERM-226. They are not drawn, as the ERD leaves out the tables' `without_table`.

The rest:

- **A part the hub left out.** The hub's `sitemap.py` leaves out of the picture what it cannot read. That can be a whole file whose YAML is outside the stage-07 template form, a screen that is not a mapping, or children that are not a list. For each, it adds a `picture-partial` check naming the file and line. The drawer gets the check as a warning and shows it as a `source` element: a YAML error leaves out a whole file, not one screen.
- **An entry the drawer cannot read** is left out the same way, as an `unreadable` screen with its `where`. It stays in its place when its parent can be read, so the screens under it keep theirs.
- **Keys.**
  - A screen's key is its trace ID. A screen without one is keyed by its parent's key, `/screen:` and its name, so two screens of one name under different parents stay apart; a root without one is keyed by `screen:` and its name.
  - A line's key is its parent screen's key, `/line:` and its screen's key. A left-out part's is `source:` and what the hub says.
  - A key another element has gets `#2`, `#3` and so on.
  - So a screen keeps its key, and the threads on it, while it keeps its trace ID.
- **A picture it cannot draw** fails at its source, the stage's source file with no line: one that is not format 1 with a list of screens, and one with more than 5000 elements. `layout.js` places any tree within that many elements, however deep or wide, as a tree's lines cross no layer and its boxes keep to `layout.js`'s sizes. A very wide tree places its boxes past 1,000,000 pixels, the most `layout.js` takes as a given position. The drawer reads its warnings only once its tree is placed, so a picture that fails before then fails again with the same digest and makes no new drawing, whatever the hub left out.

`test/sitemap.test.js` checks TASK-425's done condition: this repository's 5 screens draw as a stored expected tree.
- `test/sitemap-picture.json` is the pinned hub's picture of `docs/07-sitemap/nexus.yaml`, with the file's SHA-256.
- `test/sitemap-expected.json` is its drawing. The test compares it exactly, alone and through the push with the server's own drawer.
- The test fails when `docs/07-sitemap/nexus.yaml` changes and the picture does not, and when the drawing changes and its file does not.
- The server's tests run with Node alone, so `tests/test_sitemap_picture.py` makes the picture again with the pinned hub, and fails when it differs from the stored one.

To make both files again, from the repository's root:

```sh
CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_sitemap_picture.py --write
(cd server && node test/sitemap-expected.js --write)
```

It also checks, with pictures and checks it makes:
- SPEC-007's root with 4 children, which draw 5 screens;
- screens whose parent is missing, drawn at the top and marked: a parent out of range, the screen itself, later in the list, or not a whole number;
- an unreadable screen entry;
- a part the hub left out, with its file and line, and the warnings in the digest;
- a picture in the wrong format or over 5000 elements;
- keys;
- no log line holding the picture's text (rule 5).

## Item table

`src/item-table.js` is TASK-423, the drawer of the `item_table` kind: it draws a stage's items as a table, one row for each item (SPEC-005). Its source is the snapshot's items of the stage, `/items/<stage>`: the pinned hub's items as its `build_items` makes them, in its order, by ID. Each has its trace ID, its title, which the hub cuts to 120 characters, the status its source gives it, the IDs it links to, up to 60, and `where`, its file and line. So NEXUS reads no requirement table or other stage document itself.

What it draws:

| Element | `kind`, `status` | `detail` |
| --- | --- | --- |
| Each item, with its trace ID, named by its title | `row`; `removed` for a removed item, none otherwise | `status`, the status as its source gives it (`''` for none); `links`, the IDs it links to; `where` |
| An entry it cannot read, one that is not in the hub's form, in its place, with its trace ID and title when it has them | `row`, `unreadable` | `status` `''`, `links` `[]` and `where` |

- **Order.** The rows are in the hub's order, and the removed items come after the others, in their order (SPEC-005). An item is removed as the hub's `is_removed` says: its status, in lowercase words as the hub's `norm` makes them, holds one of the hub's removed words (removed, deleted, dropped, cancelled, canceled, deprecated, obsolete, and their Korean words). A deferred item stays in its place. `tests/test_item_table_items.py` checks that the drawer's words are the pinned hub's.
- **Names.** A row is shown by its name, the item's title, and one without a title by its trace ID (SPEC-010).
- **Keys.** A row's key is its item's trace ID. An item whose ID is not in the contract's form is keyed `row:` and its ID, and one without an ID `row:` and its title. A key another row has gets `#2`, `#3` and so on. So a row keeps its key, and the threads on it, while its item keeps its ID, whatever its title, status or place.
- **A source it cannot draw** fails at its source: one that is not a list, or one of more than 5000 items. The hub sends at most 3000 items in a snapshot.
- **A truncated snapshot**, one the hub cut to fit its size limit, draws the rows that came. The hub cuts items from the end, so a read stage none of whose items came may have lost them all: it gets no empty table, and shows no table, as a stage the hub did not read. The hub's `truncated` check is among the snapshot's checks.

The coordinator chose the rules below for TASK-423, and the maintainer approved them through the delegate they named for checkpoints.

**Stage without pictures** (note 3 of the WBS). A stage of 03, 08 or 09 shows its item table while it has no picture that is not removed:
- under a format that carries its pictures, while the snapshot holds none of its files that a drawer draws;
- under one that does not, while every picture last drawn of it is removed.

So the table makes way for the first picture drawn of its stage, and comes back, the same diagram with its threads, when the stage has none again. TASK-424's [user flow](#user-flow), TASK-426's [screen states](#screen-states) and TASK-427's [mockup](#mockup) draw the files of 03, 08 and 09, so their tables make way for them under a format that carries them.

**Stage with no items.** A stage whose record in the snapshot says the hub read its source (`read` true) and that has no items keeps an empty `/items/<stage>`, which draws an empty table: the page says the stage has no items yet (SCR-145). A truncated snapshot keeps none, as above. A stage the hub did not read, one with no source or with a missing or skipped one, has no table and shows "Nothing sent yet". A read stage whose items all go keeps its table, with no rows. With a drawer for every kind, as the tests give, this repository's push draws 12 diagrams in corthex-hub/0.2 and 28 in 0.3, where it drew 8 and 26: the empty tables of 08, 09, 12 and 13 in 0.2, and of 12 and 13 in 0.3, where 08 and 09 show their files.

**An empty table can be confirmed.** An empty table is a drawn item table, so the owner can confirm it (SPEC-029), and a stage whose only table is empty passes once that confirmation is recorded (SPEC-035). SPEC-035's "a stage with nothing to confirm" is one with no diagram or table at all, which shows "Nothing sent yet". The page shows what such a confirmation confirms (TASK-461).

**A row's content.** A row keeps the IDs it links to, and the drawing reads only its own stage's items. So a title changed in another stage draws no table again and invalidates no confirmation of it (SPEC-033). The page shows each link by its name, which the read of a diagram gives (TASK-441, API-265) from the project's latest item documents. `itemNames(texts)` in `src/item-table.js` maps IDs to titles from those documents for it. A link it cannot find, or whose item has no title, is shown by its ID, as SPEC-010's exception says.

**Making way.** An item table that makes way for its stage's pictures gets `removed_at` at that push and no new drawing. Its last drawing keeps its rows, and its threads stay on them: SPEC-027 moves none of them (SPEC-005). While something waits on it, an open thread, a proposed AI proposal or a direct edit waiting for reflection, the project read lists it after the pictures, marked removed (see [Project](#project)). `drawSnapshot` marks such a table `madeWay` in the list it returns, so [after a drawing](#after-a-drawing) moves none of its threads: an item table removed while its stage shows a picture after the push. One removed because its stage is no longer read did not make way, and SPEC-027 moves its threads to the diagram. A table that appears, or comes back without a live confirmation, marks its stage's latest pass changed, as any diagram that appears does.

`test/item-table.test.js` checks TASK-423's done condition:
- **Stage 02 of this repository shows one row per requirement.** `test/item-table-items.json` is the pinned hub's items of stage 02, with the SHA-256 of `docs/02-prd/requirements.md`. The 80 requirements draw 80 rows, alone and through the push with the server's own drawers. The test fails when the file changes and the items do not.
- **Removed items come last, marked.**
- **When pictures come, the table is marked removed and keeps its threads on its rows.** A 0.3 push of stage 03's files removes the table with no new drawing, and the thread on its row FL-001 keeps its target and key. The project read lists the table after the pictures.

The server's tests run with Node alone, so `tests/test_item_table_items.py` makes the items again with the pinned hub and fails when they differ from the stored ones. To make the file again, from the repository's root:

```sh
CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_item_table_items.py --write
```

It also checks:
- the table that comes back when the stage's files go, and makes way again when they come back;
- a stage of 03, 08 or 09 that never had a file;
- the empty tables;
- a table removed because its stage is no longer read;
- a completed revision whose older push did not read a stage;
- a truncated snapshot;
- unreadable entries and keys;
- `itemNames`;
- no log line holding an item's text (rule 5).

## Screen states

`src/screen-states.js` is TASK-426, the drawer of the `screen_states` kind. It draws a stage-08 screen definition as one panel for each state of its state table, with the state's name, its description and the responses that lead to it (SPEC-008). Under corthex-hub/0.3 the pinned hub's `snapshot03.py` sends each screen definition as a picture of its own: the file's path is its `key` and its whole text is `source.text`, with no translation beside it. So one screen file is one diagram. NEXUS reads the file's Markdown itself, with this repository's code and no package. Under 0.2 the stage shows its item table (TASK-423).

**What it reads.**
- **The state table.** It is the first Markdown table of the file, outside a fenced code block and a front-matter block, any of whose rows starts with a state ID such as `SCR-142#normal`. A front-matter block is read as the hub reads one: a first line of `---`, closed by a line of `---` or `...` within the file's first 200 lines. A state ID is a trace ID, `#`, and a state: a lowercase letter and up to 30 lowercase letters, digits, hyphens and underscores, as the hub reads states. The table has the stage-08 template's three columns: the state, what the user sees and can do, and the responses that lead to it.
- **A table** is a line that starts with `|`, a separator line under it, and the lines that start with `|` after them, as the hub reads tables. A cell ends at a `|` that no backslash escapes.
- **The diagram's name** is the file's first heading of level 1, as written, such as `SCR-142 Owner to-do`. A file with none is named by its file's name, such as `SCR-142.md`. The drawer gives that name itself, because `drawing.js` keeps a diagram's last name when its drawer gives none, so a heading taken out later would otherwise leave its old name.

What it draws:

| Element | `kind`, `status` | `detail` |
| --- | --- | --- |
| Each row of the state table, in the table's order; its key and name are the state as written | `state`; `no_description` when it has no description | `description`, `responses`, `where` and `box` |

The coordinator chose the next five points for TASK-426, and the maintainer approved them through the delegate they named for checkpoints. The pull request records them with the options not taken.

- **Order.** The panels follow the rows of the state table, in their order.
- **Grid.** The drawer works out a grid of three columns itself, as the stage-09 mockup draws the panels of stage 08 at 1440 pixels. `layout.js` puts boxes that no line joins in one row, so it makes no grid.
  - The panels fill each row left to right in the table's order. A panel is 328 pixels wide, a third of the mockup's 1008-pixel board column, with 12-pixel gaps.
  - A panel is at least 168 pixels high, and as high as its text needs. It has 12 pixels of padding above and below and 16 at the sides, and 8 pixels between its name, its description and its responses.
  - Text is measured at 20 pixels a line and 7.2 pixels a character, so a line holds 41 narrow characters; a wide character such as Hangul counts twice. Text wraps at spaces, and a word longer than a line breaks at the line's end. An empty description or list of responses still takes a line, where the page shows "No description" or `-`.
  - A row is as high as its tallest panel, and every panel of the row is that high. A panel is at most 100000 pixels high, the largest box `layout.js` takes. So a very long table places its panels past 1,000,000 pixels, as a very wide sitemap does.
  - `box` is `{ x, y, width, height }`, the panel's top left corner and its size. The page shows one column on a phone (TASK-458), where moving is not offered.
- **Description.** It is the second cell as written: Markdown such as a code span is kept, and only `\|` is unescaped. The page shows it as written, as text (see [Workbench pictures](#workbench-pictures)).
  - A cell that is empty, white space or `-` alone is no description. The panel is empty, with `description` `''`, and marked with status `no_description` (SPEC-008).
  - The page shows the mark as the stage-09 mockup does: a dashed border, the "No description" tag, and a note that the document has no description of this state.
- **Responses.** They are the third cell split at the commas outside brackets, each as written, such as `API-275#409 (not-drawn)`. A cell that is empty, white space or `-` alone has none, `[]`, and the page shows `-`.
- **Diagram name.** It is the file's first heading, as the stage-09 mockup titles its stage-08 view by the screen's heading.

The rest:

- **Keys.** A panel's key is the state as written, such as `SCR-142#normal`. So a panel keeps its key, and the threads on it, while its state keeps its ID, wherever its row stands. If the table names a state twice, the first keeps the key and the later ones get `#2`, `#3` and so on. `SCR-142#normal` is not a trace ID, so a panel has none.
- **`where`** is the file and the row's line, such as `docs/08-screens/SCR-142.md:30`, or the file alone when the two would pass 300 characters.
- **A state table it cannot read** fails the drawing at its source. The diagram keeps its last good drawing and shows where it failed (SPEC-001):
  - A file with no state table fails at the file, with no line.
  - A line of the state table that does not have three cells fails at that line. This includes the header and the separator.
  - A row whose first cell is not a state ID fails at that row's line.
  - A table of more than 5000 states fails at the file.
- **Warnings and other documents.** `drawing.js` gives a file's picture no warnings. The hub's `picture-partial` checks of stage 08 name screen files it did not send, not parts of a file it sent, so the drawer reads none. It reads no other document either, so a drawing's digest is its file's.

`test/screen-states.test.js` checks TASK-426's done condition: this repository's 5 screens draw 39 panels with name, description and responses.
- `test/screen-states-pictures.json` holds the pinned hub's corthex-hub/0.3 pictures of `docs/08-screens`, each with its file's SHA-256. It leaves out the commit and time, which the hub takes from Git. The hub sends the pictures with no part, since no part of `.corthex/project.json` starts their names, and adds a `part-unknown` check for each.
- `test/screen-states-expected.json` holds their drawings. The test compares them exactly, both alone and through the push with the server's own drawer. It also reads each panel's state, description and responses from the file in its own simple way, as a cross-check.
- The test fails when a screen file changes, is added or is removed and the pictures do not. It also fails when a drawing changes and its file does not.
- `tests/test_screen_states_pictures.py` makes the pictures again with the pinned hub's `snapshot03.py` from the working tree's files. It fails when they differ from the stored ones.

To make both files again, from the repository's root:

```sh
CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_screen_states_pictures.py --write
(cd server && node test/screen-states-expected.js --write)
```

It also checks, with files it makes:
- SPEC-008's screen of 6 states, which draws 6 panels in two rows of three;
- states without a description: an empty cell, white space and `-` each draw an empty panel marked `no_description`;
- a description as written, and responses split at commas;
- panel heights and the grid;
- which table is the state table: the first with state rows, outside code fences and front matter, with front matter closed within 200 lines;
- the diagram's name from the first heading, and the file's name once the heading is taken out, through the push;
- a state table it cannot read, which fails at its line or at the file, and through the push keeps the last good drawing;
- keys;
- that no log line holds the file's text (rule 5).

## Mockup

`src/mockup.js` is TASK-427, the drawer of the `mockup` kind: it lists the design tokens a stage-09 mockup page uses, one element of kind `token` for each CSS custom property the page reads with `var()` (SPEC-009, API-265). Its source is the page itself: in corthex-hub/0.3 the pinned hub sends the whole text of the HTML file that the project's stage 09 names as `page`, one picture per file, and NEXUS reads it. `src/mockup-page.js` serves the page, as [the mockup page](#the-mockup-page) below says.

SPEC-009, API-265, API-293 and the stage-09 mockup left the rules below open. The coordinator chose them for TASK-427, and the maintainer approved them through the delegate they named for checkpoints.

| Question | Rule | Not taken |
| --- | --- | --- |
| Where a `var()` counts | In the CSS of every `<style>` element and every `style` attribute, wherever it stands, `<template>` content included: this repository's page draws its screens from templates and reads 6 of its 95 tokens only there. CSS comments and strings are skipped. The text of a `<script>` or of another element whose content is text, such as `textarea`, `title` or `noscript`, HTML comments and the page's text are not read, so a token only a script reads is not listed. | Any `var()` in the whole text, scripts, comments and text included; or the CSS and the `var()` in a script's strings. |
| A fallback | Each `var()` of a fallback reads its property too: `var(--a, var(--b))` lists `--a` and `--b`, as which one applies is known only when the page runs. | Only `--a`; or `--b` marked as a fallback. |
| Set but never read | Not listed, as SPEC-009 lists what the page reads. This page sets 658 custom properties and reads 95. | Listed, marked unused. |
| Read but never set | Listed like any other, with no mark; its `values` is empty. | Listed with the status `not_set`. |
| Name, key and order | The property as the page writes it, with its leading `--`, as the stage-09 panel lists `--button-primary`; its case kept, since custom properties are case-sensitive; its CSS escapes resolved, so `--a\:b` and `--a\3a b` are one token `--a:b`. Its key is `token:` and its name, as `elementKey` makes it. The tokens come in the order the page first reads them. | The tokens by name. |
| `detail` | `{ values, uses }`. `values` are the distinct values the page's CSS sets for the property, in the page's order, up to 10, each cut to 200 characters, white space made single spaces and `!important` left out; here the light theme's and then the dark's. The screen can draw a swatch of the first. `uses` is how many `var()` read it. | `{}`, the name only. |
| A box | None. The stage-09 mockup lists the tokens in the panel beside the frame, not on a canvas, so `layout.js` places none. A token has no position: TASK-441 answers its `position` null, and TASK-442 refuses to move one. | A box per token, sized for its name, in one column placed by `layout.js`. |
| The diagram's name | The file's name, as `drawing.js` names a file's picture, here `nexus-mockup.html`. | The page's `<title>`. |
| A page that cannot be drawn | Only a page that reads more custom properties than a drawing's 5000 elements fails, at its source with no line, as the ERD and the sitemap do. Any other text draws, an empty page or one that reads none as no tokens. | Also a text that is not an HTML page. |
| A removed mockup | Its last good page is still served (API-293), since its threads, which SPEC-027 still opens, are about it. | `diagram_not_found`. |

How it reads the page:
- **HTML.** As a browser's tokenizer does, it skips comments, doctypes, end tags and the content of an element whose content is text. Tag and attribute names are matched without case. An element's first `style` attribute counts, as HTML keeps the first of two, with its numeric character references and the named ones of ASCII punctuation read. A tag the page ends inside is dropped, as HTML drops it. The page is not checked as HTML: like a browser, the drawer reads whatever text it gets.
- **CSS.** A read is the function `var`, its name matched without case and its escapes resolved, whose first token after white space is a custom property name, `--` and at least one more character. An unquoted `url()` is one token, so a `var()` in it is not read. A custom property is set by a declaration that starts a block's content or follows its `;` or a nested block's `}`, or starts a `style` attribute; its value runs to the `;` or `}` that ends it, brackets in it kept whole.
- **Warnings.** It reads none, as `drawing.js` gives a file's picture none.

`test/mockup.test.js` checks TASK-427's done condition: a test page that uses 3 tokens lists 3 token elements, and this repository's page draws as a stored expected list of 95 tokens.
- `test/mockup-picture.json` is the pinned hub's picture of `design/mockup/nexus-mockup.html`, as its `snapshot03.py` makes it, with the file's SHA-256.
- `test/mockup-expected.json` is its drawing. The test compares it exactly, alone and through the push with the server's own drawer.
- The test fails when the page changes and the picture does not, and when the drawing changes and its file does not.
- The server's tests run with Node alone, so `tests/test_mockup_picture.py` makes the picture again with the pinned hub, from the working tree, and fails when it differs from the stored one.

To make both files again, from the repository's root:

```sh
CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_mockup_picture.py --write
(cd server && node test/mockup-expected.js --write)
```

It also checks each rule of the table with pages it makes.

### The mockup page

API-293 (`GET /api/projects/{project}/diagrams/{diagram}/page`, `src/mockup-page.js`) serves the HTML of a mockup as the hub sent it (SPEC-009). It is an owner operation, and a read that writes nothing and logs nothing.
- **The page** is the document of the diagram's last drawing that drew: its current drawing, or when that failed, its last good one, read from that drawing's snapshot by the diagram's `source_key`. It is sent whole, as `text/html; charset=utf-8`, with `Cache-Control: private, no-store`.
- **The sandbox.** Every answer, its refusals and faults included, carries the contract's `Content-Security-Policy` as its route's header (see [Answers](#answers)), and `X-Content-Type-Options: nosniff`. The policy makes the page a sandbox in which its scripts run but which has no NEXUS origin, so they reach neither NEXUS's cookies nor its API. The page loads nothing from the network, its fonts included, and only a NEXUS page may frame it; opened in a tab of its own, it is a sandbox too.
- **Refusals.** A name no project space has gets `project_not_found`. An ID that names no diagram of the project, or a diagram of another kind, gets `diagram_not_found`. A mockup that has never drawn gets `not_drawn` (409), which names the reason, while the push's `failures` name where its drawing failed.
- **Tables.** It also finds the project space by its name (TBL-147), so API-293 lists 5 tables. The correction at the end of the [API README](../docs/06-api/README.md) passed its own checkpoint on 2026-11-24.
- **Not here.** The frame, the bar above it, reading the page's status before framing it, and opening the page again once when it opens another page are the workbench's (see [Workbench pictures](#workbench-pictures)).

`test/mockup.test.js` answers every response API-293 lists, checks that each answer carried the sandbox header and nosniff, and checks the tables it touches (note 23) and its log lines (rule 5).

## After a drawing

`src/after-drawing.js` is TASK-435: what the push changes once it has drawn a snapshot, in the same transaction, before it answers (API-242; SPEC-025, SPEC-027, SPEC-033, SPEC-035). Beside the answer's counts, `drawSnapshot` returns each diagram it created, brought back, drew again, kept as left out or removed. `afterDrawing` takes that list, for a new snapshot and for a revision completed in a newer format alike. The answer counts what it did: `confirmations_invalidated`, `change_sets_reflected` and `threads_moved`.

- **Confirmations** (SPEC-033). A new drawing that drew invalidates the diagram's live confirmation when the documents it read differ from those of the confirmed drawing (their `source_digest`). A change only in a file the diagram does not draw from keeps it, and so does a change that comes back to the confirmed text. A failed drawing invalidates nothing: the diagram still shows its last good drawing (SPEC-001).
- **Stage passes** (SPEC-035, TBL-161). A pass stays in the record and gets `changed_at`, which the project read shows as `changed_since_pass`:
  - when a confirmation it rests on is invalidated: every pass of the stage made since that confirmation was confirmed and not marked yet;
  - when, after the stage's latest pass, a diagram of the stage appears without a live confirmation: drawn for the first time, back from removal, or a picture that replaces the stage's item table. No approved document states this rule. The coordinator chose it for TASK-435, since SPEC-035's pass rests on a recorded confirmation for every diagram, and the maintainer approved it through the delegate they named for checkpoints. A removed diagram changes no pass, since it counts for none (SPEC-027).
  - When the push removes a diagram, its stage passes if every diagram left has a recorded confirmation, as a merged record passes it (TASK-447, `passStage` in `src/passes.js`; see [Reports](#reports)), since removing the stage's last unconfirmed diagram leaves no record to report.
- **Reflections** (SPEC-025, `src/reflection.js`). The accepted change sets of a pull request whose reported merge commit is the drawn snapshot's commit are reflected, at the drawing the diagram shows after the push: its latest that drew, since a failed drawing shows the last good one (SPEC-001). Only that exact commit marks them, as API-258 says. They are reflected even when the drawing lacks the change, and TASK-447 writes the comment that says what is missing, on a new thread on the diagram that waits on the owner (note 26 of the WBS; see [Reports](#reports)). A proposal's thread then closes, `closed_by` `reflection`, once none of its change sets is proposed or accepted. API-258 reflects through the same code when the agent reports a merge commit NEXUS already holds.
- **Threads** (SPEC-027). An element leaves its stage document when a drawing of its diagram that drew no longer has it or draws it as unreadable, or when the snapshot removes its diagram. An item table that makes way for its stage's pictures (SPEC-005) is the exception. The element's open threads move to the diagram: `target_kind` `diagram`, the key kept and `removed_name` its last readable name. An element whose part was left out as unreadable counts as gone and takes the same mark (note 2 of the WBS).
  - When a later drawing has the element again, readable, its threads stay on the diagram and link to it again: `removed_name` is cleared.
  - A failed drawing moves nothing, and a source the snapshot leaves out gets one (see [Drawing](#drawing)). A corthex-hub/0.2 snapshot that keeps a stage's pictures moves nothing either, since it removes none.
  - A removed diagram stays listed while something waits on it: an open thread, a proposed AI proposal or a direct edit waiting for reflection (see [Project](#project)).
- **Positions** (SPEC-012, TBL-154). A new drawing that drew drops the positions of the elements it no longer places, and a diagram the snapshot removes drops all its own. An element drawn as unreadable keeps its position. A failed drawing and a source left out drop none. See [Moving an element](#moving-an-element).
- **The to-do** follows through `src/entries.js`, in the same transaction:
  - `confirmationsChanged` for each diagram drawn for the first time, back, removed or invalidated;
  - `changeSetsChanged` for each diagram with reflected change sets;
  - `threadChanged` for each thread a reflection closed or opened.
- **No log line** holds what it found (rule 5).

So API-242 lists 16 tables. The correction at the end of the [API README](../docs/06-api/README.md) that gave it 13 passed its own checkpoint; TASK-442's, which adds TBL-154 and SPEC-012, passed its own on 2026-11-24 (see [Moving an element](#moving-an-element)); TASK-447's, which adds TBL-156 and TBL-159 for the reflection's comment, passed its own on 2026-11-24 (see [Reports](#reports)).

`test/after-drawing.test.js` checks TASK-435's done condition with pushes of this repository's snapshots, changed in each test, and rows that `test/seed.js` writes. It also checks the push's tables (note 23). `test/snapshots.test.js` answers every response API-242 lists.

## To-do entries

`src/entries.js` is TASK-433: the one place that opens and closes the entries of TBL-166 `todos`, which the owner's to-do (API-263, SPEC-042) and the agent to-do (API-245, SPEC-043) read. An entry follows what it is about. Each function reads the rows of one subject, opens the entries they call for and closes the others, as `done` or `withdrawn`. An operation that changes such a row calls its subject's function in the same transaction, after its own writes; calling it again changes nothing. The functions write only TBL-166 and read only the subject's own table, and for confirmations the diagram and its drawings, so they add no table to an operation beyond the subject it changes and TBL-166. They log nothing.

| Function | Called after | Entries |
| --- | --- | --- |
| `threadChanged(store, { project, thread, time })` | A thread is opened, replied to, marked answered or closed (TASK-437, TASK-443). | `question` on the owner's to-do while the open thread waits on the owner, `comment` on the agent's while it waits on the agent (SPEC-016, SPEC-017); none once it is closed (SPEC-028). |
| `changeSetsChanged(store, { project, diagram, time })` | A change set of the diagram is proposed, answered, withdrawn, made, cancelled, linked to a pull request or unlinked, or reflected (TASK-435, TASK-438, TASK-444, TASK-445, TASK-447). | `proposal` for the owner while a proposal is proposed (SPEC-018), done when answered and withdrawn when withdrawn; `reflect` for the agent while accepted change sets wait (SPEC-019, SPEC-021, SPEC-026), done when they are reflected (SPEC-025) and withdrawn when none is left. |
| `removeFromPullRequest(store, { project, diagram, changeSet, time })` and `removalReported(store, { project, entry, time })` | A direct edit in an open pull request is cancelled; the removal's pull request is reported (TASK-445, TASK-447). | `remove_from_pr`: taking the cancelled change set out of its pull request (SPEC-023), done on any report of it. |
| `confirmationsChanged(store, { project, diagram, time })` | The diagram is drawn for the first time, removed or back; a confirmation of it is made, cancelled, invalidated or recorded, or its cancel recorded (TASK-435, TASK-446, TASK-447). | `confirm` for the owner while the diagram is drawn, not removed and without a live confirmation, naming the last confirmation that ended, so that the owner's to-do says why it waits (SPEC-029, SPEC-030, SPEC-033); `record_confirmation` for the agent until the confirmation is recorded, or withdrawn when it is cancelled first (SPEC-031, SPEC-032); `record_cancel` once a recorded confirmation is cancelled (SPEC-030). |
| `stepsChanged(store, { project, workshop, time })` | A step of the workshop is confirmed or reported written (TASK-452). | `write_step` while a confirmed step is not written (SPEC-039, SPEC-040). |

- **Reflections** (SPEC-026). A diagram's accepted change sets that wait are grouped by pull request: those in none are one group, those of each pull request another, and each group is one entry. So one entry holds every waiting change set of a diagram, and a change set accepted while a pull request is open starts a new entry. An entry names its group by one of its change sets, its `change_set_id`, so linking the group to a pull request moves the entry with it, and a change set that leaves the group hands the name to another. When the pull request closes and its change sets wait again, the older entry stays and one opened meanwhile is withdrawn. `heldChangeSets` gives an entry's change sets, in the order they were accepted (see [Direct edits](#direct-edits)), and their pull request. `waitingChangeSets` gives every change set of a diagram that waits, in the same order, which a confirmation reads (see [Confirmations](#confirmations)).
- **A removed diagram** (note 4 of the WBS). A diagram that a snapshot removes takes no confirmation (SPEC-027), so it puts nothing on the owner's to-do, confirmed or not, and its open `confirm` entry is withdrawn. Its confirmation stays as it is, and so does the agent's entry to record it, since a record of that version stays true. When the diagram comes back, it waits on the owner again unless its confirmation is still live.
- **Entry IDs.** The pinned hub names an entry of the agent to-do by what it is about: `nc_` its thread, `ne_` the entry itself, a reflection or a removal, and `nk_` its confirmation. `openAgentEntry` finds the open entry an ID names, for the claims of TASK-434 and the reports of TASK-447. A step has no ID, so it is never claimed.
- **Claims** are `src/claims.js`'s (see [Claims](#claims)). Closing an entry here leaves its claim row as it is; a claim of a closed entry holds nothing.

**The agent to-do** (API-245, `GET /api/spaces/{project}/todo`, `src/todo.js`) answers the open entries of the agent to-do, each list oldest first, with its total and up to the contract's 5000 entries (11 steps): `comments`, the threads that wait on the agent, each with its last entry; `reflections`, `reflect` or `remove`; `checkpoints`, `passed` to record a confirmation and `withdrawn` to record its cancel; and `steps`. `discrepancies` is always empty. `waiting_for_user` counts the owner's open entries of the project, and `taken` the listed entries that another session claims. A read writes nothing; `read_at` is the time of the answer.
- **`Nexus-Session`** names the session that reads, so that `claim.mine` says whether a claim is its own; without it no claim is. A value that is not a session label gets `invalid_request` on `Nexus-Session`, whose detail never repeats it.
- **A claim** is shown by `src/claims.js`'s one rule (SPEC-045): while its pull request is open, and otherwise for 60 minutes after the later of its last write and its pull request's close.
- **`item`** is the key of the comment's element or row when that key is a trace ID, as the contract's element keys are for an element that has one, and `''` for the diagram or a key that is none.
- **`part`** comes from a stage picture's `source_key`, is `''` for an item table, and for a file's picture of stage 03, 08 or 09 comes from the `/snapshot` document of its last drawing's snapshot, which names it beside the file's key, passing over a drawing kept for a source left out (see [Drawing](#drawing)); it is `''` where that document does not, as in a revision that a newer format completed.
- **A pull request's link** is the project's repository address, `/pull/` and its number.
- **A project without a space** gets `space_not_found`, which the hub reads as an empty to-do.
- **No log line** holds a comment's text or a session's label (rule 5).

The answer names what other tables hold, so API-245 lists 13 tables. The correction at the end of the [API README](../docs/06-api/README.md) passed its own checkpoint.

`test/entries.test.js` checks TASK-433's done condition with the fewest rows the store allows, which `test/seed.js` writes: each kind of entry appears and leaves when done; one reflection entry holds every waiting change set of a diagram; and note 4. `test/todo.test.js` answers every response API-245 lists and checks the tables it touches (note 23).

## Claims

`src/claims.js` is TASK-434: an agent session holds one entry of the agent to-do alone, keeps it by writing and lets it go (SPEC-044, SPEC-045). A claim is a row of TBL-167 `claims`, of one entry of TBL-166 and one session, made with a credential; at most one row of an entry is unreleased.

- **Claim** (API-250, `POST /api/spaces/{project}/claims/{entry}`) and **release** (API-251, `DELETE` on the same path) take the session from `Nexus-Session`, which they need: a missing or malformed one gets `invalid_request` on `Nexus-Session`, whose detail never repeats it. The hub sends neither a body nor a request key, so a repeat is the same session's claim or release (rule 3).
- **When a claim ends** is one rule, `claimEnd`, which the agent to-do shows claims by too (SPEC-045): never while its pull request is open, and otherwise 60 minutes after the later of its last write and its pull request's close. A claim that has ended holds nothing; the next claim of its entry marks it released as `idle`, at the time it ended.
- **Held by another session**, the entry gets `claimed` (409), with the holder's `session`, `last_write_at` and `ends_at`, `null` while its pull request is open (SPEC-044). Claimed again by the same session, it is the same claim, its last write moved on. Writes run one at a time in arrival order, so of two claims at once the first wins and the second gets `claimed`.
- **A release** ends the session's live claim, marked `released`, and answers `released` true. Where the entry has no live claim, it answers `released` false and writes nothing; another session's live claim gets `claimed`.
- **A write keeps a claim.** An agent's write on an entry calls `keepClaim(store, { project, entry, session, credential, time })` before its own changes. It claims the entry as API-250 does, moves the session's claim on, or refuses the write with `claimed` (TASK-437, TASK-438, TASK-447). The agent operation that closes its own entry, a reply, a proposal or a recorded confirmation (SPEC-017, SPEC-018, SPEC-032), then calls `finishClaim(store, { project, entry, session, time })` in the same transaction, which releases the session's claim as `done`. `src/entries.js` never calls it, so an entry the owner's action closes, or one that is withdrawn, keeps its claim row as it is.
- **A closed entry's claim holds nothing.** A claim holds only its own entry, and only while the entry is open. Once the entry closes, its claim is not shown, blocks no one and does not carry over: a new entry under the same `nc_` or `nk_` ID, as when the owner answers a thread the agent replied to, starts unclaimed, and the first claim wins. Claiming an ID with no open entry, a closed entry or a thread that waits on the owner, gets `entry_closed` (409); releasing one answers `released` false and writes nothing. `entryNamed` in `src/claims.js` is the one place that decides it.
- **Entry IDs** name entries as `openAgentEntry` finds them (see [To-do entries](#to-do-entries)). An ID that names nothing of the project, an `nd_` ID and an `ne_` ID of another kind of entry get `entry_not_found`; a project without a space gets `project_not_found`.
- **No log line** holds a session's label (rule 5).

Both operations read the project space, the entry and the claim's pull request beside the claim they write, so they list TBL-147, TBL-157, TBL-166 and TBL-167. The correction at the end of the [API README](../docs/06-api/README.md) passed its own checkpoint.

`test/claims.test.js` answers every response API-250 and API-251 list, checks their tables (note 23) and TASK-434's done condition, and checks `keepClaim` and `finishClaim` with the fewest rows the store allows.

## Comments

`src/comments.js` is TASK-437: an agent comments on a diagram, replies in a thread, marks a thread answered and reports where a decision is recorded (API-252 to API-255; SPEC-016, SPEC-017, SPEC-027). The owner's side of a thread is [Threads](#threads). All four are agent operations with a JSON body and a request key (rule 3). Each needs `Nexus-Session`, since a write on a thread may write on a claimed entry: a missing or malformed one gets `invalid_request` on `Nexus-Session`, whose detail never repeats it.

- **A thread** is a row of TBL-155 `comment_threads` on a diagram at one of its drawings: on the diagram as a whole, on an element, or on a row of an item table, by the element's key. Its entries are rows of TBL-156 `comments` in order. An agent's entry names its credential, and `detail` keeps `quote`, `asks`, `look_first` and a decision's `link`. An entry with a link is a `decision`, any other a `comment`.
- **Where a comment goes** (API-252). Its diagram is the one `diagram` names, which must be of the request's stage and part, not removed, and drawn. With an item and no diagram, it is the one diagram of the stage and part whose drawing holds the item, or else the file diagram the item names (below). With neither, it is the stage's first diagram, the one its address opens: the first by name and then ID of the stage's diagrams that are not removed. `DIAGRAM_ORDER` in `src/project.js` holds that order, and the project read lists diagrams by it, so the two never disagree.
  - An item that several diagrams hold gets `diagram_ambiguous` with their IDs, and one that none holds and no file diagram is named by gets `item_not_found`.
  - **A file diagram holds its own trace ID.** The coordinator chose this rule for TASK-424, and the maintainer approved it through the delegate they named for checkpoints on 2026-11-24. Suppose no element of the stage's drawings holds an item, but a drawn file diagram of the stage and part is named by it. Then the item picks that diagram, and the thread goes on the diagram as a whole, as a comment with `diagram` and no item does; the answer's `item` is `''`. `diagramTraceId` in `src/drawing.js` finds that ID, in one place:
    - A file diagram is a diagram of stage 03, 08 or 09 that is a file's, not the stage's item table.
    - It is named by the trace ID its name starts with, read as the hub reads the ID that leads a heading: after any white space, `*`, `_`, `` ` ``, `~`, `[` or `(`, an ID that no letter, digit or `_` follows.
    - Its name is its drawer's: the file's first heading, such as "FL-005 Reflect accepted changes into Git" or "SCR-143 Projects", or the file's name until a drawer names it, such as `SCR-143.md`. The diagram row keeps that name, the one the page shows and an agent reads, so no source is read again, and a failed drawing leaves it as it was.
    - The mockup page is named by its file's name, `nexus-mockup.html`, and holds no trace ID. It is reached with no item, as its stage's only diagram.
    - An element that holds the item still wins. Two diagrams named by it get `diagram_ambiguous`. A removed diagram, or one that never drew, is none of them.
    - With `diagram`, the item may also be the one that diagram is named by.
    - So an agent reaches each file of stages 03, 08 and 09 through the pinned hub's `comment` command, which sends `item` and never `diagram`. A proposal's items pick a diagram the same way (see [Proposals](#proposals)).
  - These get `diagram_not_found`, and a comment never moves to another diagram (SPEC-016, SPEC-027): a stage of the part without a drawn diagram; a named diagram that is removed, of another stage or part, or never drew; and a first diagram that never drew.
  - A part the project does not declare gets `part_not_found`. NEXUS v3 opens no discrepancies, so a `discrepancy` gets `discrepancy_not_found`.
- **At commit.** A comment's drawing is the diagram's current one. When NEXUS holds `commit`, it is the one the diagram showed then: its last drawn drawing at or before that snapshot's revision, or the current one when it had not drawn by then. An element that the drawing at commit holds and the current one no longer does, or draws as unreadable, gets the thread on the diagram, as an element that left would: its key is kept and its last name goes in `removed_name`. The last name is the element's last readable name in any drawing of the diagram, the one [After a drawing](#after-a-drawing) marks a moved thread with; else, for an element only ever drawn unreadable, its name in the drawing at commit; else its key. TASK-443 changed this approved rule in one case: a comment at an older commit on an element that was renamed and then removed was marked with its name at that commit, and is now marked with its last readable name, as a thread the push moved is. An element drawn as unreadable counts as gone, as [After a drawing](#after-a-drawing) counts it (SPEC-027).
- **A checkpoint request** (`asks` `checkpoint`) is on the stage as a whole. It has no item, at most 10 lines and 1,200 characters, and `look_first`, which goes with it only. A text is 1 to 4,000 characters and not only white space. A longer one gets `text_too_long` with its field and limit, and no refusal repeats a value.
- **Who a thread waits on** (SPEC-017). An open thread waits on the side that did not write last.
  - A comment opens it waiting on the owner.
  - A reply (API-253) and a decision (API-255) add an entry and make it wait on the owner. Marking it answered (API-254) does so without an entry.
  - A thread that already waits on the owner, or is closed, answers `changed` false to API-254 and changes nothing.
  - A reply to a closed thread gets `thread_closed`. A decision on a closed thread is kept, and the thread stays closed: the link is a record, not a question.
  - An open thread of a removed diagram still takes replies.
- **The to-do and claims.** Each write calls `threadChanged` in the same transaction (see [To-do entries](#to-do-entries)), so a thread that waits on the owner is a question of the owner's to-do and leaves the agent's. A write on a thread that waits on the agent writes on its comment entry. It calls `keepClaim` first, so another session's claim refuses it with `claimed`. Since the write closes that entry, `finishClaim` then releases the session's claim as `done` (see [Claims](#claims)).
- **A decision's text** is optional. When it is missing, empty or only white space, the link stands as the entry's text, since an entry always has text.
- **`item`** in the answer is found by `threadItem` in `src/todo.js`, which the agent to-do uses too.
- **No log line** holds a comment's text, a link or a session's label (rule 5).

The four operations read and write more tables than they listed, the thread's waiting side among them (note 15 of the WBS). The correction at the end of the [API README](../docs/06-api/README.md) passed its own checkpoint, as did the agent line of `diagram_not_found` (note 11).

`test/comments.test.js` checks TASK-437's done condition and an item that names a file diagram, answers every response API-252 to API-255 list, and checks the tables they touch (note 23).

## Threads

`src/threads.js` is TASK-443: the owner reads a thread, comments on a diagram, an element or a row, replies in a thread and closes it (API-266 to API-269; SPEC-016, SPEC-017, SPEC-027, SPEC-028, SPEC-051). All four are owner operations, and the three writes take a JSON body and a request key (rule 3). A phone gets the same answers as a PC (SPEC-051); the page, SCR-145, is TASK-459's. The owner's writes keep no claim: an owner's entry names no credential and no session, and its `detail` is empty. They share `src/comments.js`'s reading of a request's fields and texts, `targetOf`, a thread's summary and `entryOf`.

- **A read** (API-266, `GET /api/projects/{project}/threads/{thread}`) answers any thread of the project, the owner's or an agent's, open or closed, on a diagram removed or not, as API-246 does: `threadBody` in `src/reads.js` gives both the same Thread. So once nothing waits on a removed diagram, its last thread closed among the rest, API-265 answers `diagram_not_found` for the diagram (see [Diagram](#diagram)), while API-266 still answers each of its threads. The page then opens the stage's first diagram in its place (see [Workbench threads](#workbench-threads)).
- **A comment** (API-267, `POST /api/projects/{project}/diagrams/{diagram}/threads`) opens a thread at the drawing the owner names in `drawing`, one of the diagram's own. That drawing is the version the comment is attached to (SPEC-016).
  - `target` `diagram` puts the comment on the diagram as a whole and names no `element`. `element` puts it on an element of a picture and `row` on a row of an item table, each by the `element` key the named drawing holds. A row of a picture, or an element of an item table, gets `invalid_request` on `target`, and a key the drawing does not hold gets `element_not_found` with that key.
  - **A failed drawing** takes a comment on the diagram as a whole at that drawing's version, so the owner can tell the agent what to fix where the diagram does not draw. It holds no element, so an element or a row there gets `element_not_found`. Here the owner may comment where an agent may not: an agent's comment on a diagram that never drew gets `diagram_not_found` (see [Comments](#comments)).
  - **Removed while writing.** An element that the named drawing holds and the current drawing no longer holds readable gets the thread on the diagram, its key kept and its last name in `removed_name`, as an agent's comment at `commit` does (SPEC-016, SPEC-027). So an element renamed and then removed is marked with its later name (see [Comments](#comments)).
  - **How the reads show it.** The answer, API-266 and API-246 give the thread's `drawing` and its `version`, the commit that drawing comes from, so a comment at an older or a failed drawing says which version it was written against. API-265 lists the thread among the diagram's threads with its `target`, `element` and `removed_name`, whichever drawing the diagram shows.
  - A removed diagram takes no new thread (SPEC-027) and gets `diagram_not_found`, as does an ID of no diagram of the project. A drawing of another diagram, or of none, gets `drawing_not_found`.
  - **`item`** in the answer is found by `threadItem`, as for an agent's comment: the key of the element or row when it is a trace ID, and `''` for the diagram as a whole. The rule by which an agent's item picks a file diagram (see [Comments](#comments)) plays no part here: the owner names the diagram in the path and an element by its key, so a comment on a file's diagram as a whole has the `item` `''`.
- **A reply** (API-268, `POST /api/projects/{project}/threads/{thread}/comments`) adds the owner's entry at the end, and the open thread then waits on the agent (SPEC-017). A closed thread gets `thread_closed` (409) and keeps no entry: a new comment starts a new thread, and nothing reopens a closed one.
- **Closing** (API-269, `POST /api/projects/{project}/threads/{thread}/close`) marks the thread closed by the owner, waiting on no one (SPEC-028), and answers `changed` true. A thread closed already, by the owner or by a reflection, answers `changed` false and changes nothing. Closing changes only the thread:
  - A proposal that answers it stays `proposed` and on the owner's to-do. Accepting or rejecting it afterwards (API-270, API-271, TASK-444) leaves the thread closed.
  - A claim of its agent entry keeps its row as it is and holds nothing once the entry closes (see [Claims](#claims)). So the owner closes a thread that an agent session holds, and no `claimed` refuses it.
- **An open thread of a removed diagram** is still read, replied to and closed (SPEC-027).
- **The to-do.** Each write calls `threadChanged` in the same transaction (see [To-do entries](#to-do-entries)). A thread that waits on the agent is a `comment` of the agent to-do and leaves the owner's, and a closed one is on neither. So the owner's reply puts the thread on the agent's to-do and takes it off the owner's, TASK-443's done condition.
- **Refusals.** A name no project space has gets `project_not_found`, and a thread ID of another project or of no row gets `thread_not_found`. A text is 1 to 4,000 characters and not only white space, and a longer one gets `text_too_long` with its field and limit. No refusal repeats a value.
- **No log line** holds a comment's text (rule 5).

**Choices approved through the maintainer's delegate.** No approved document states these rules. The coordinator chose them for TASK-443, and the maintainer approved them through the delegate they named for checkpoints on 2026-11-24: a failed drawing takes a comment on the diagram as a whole; API-266 answers a thread of a removed diagram after the diagram answers 404; closing a thread leaves a proposal that answers it as it is; a reply to a closed thread gets `thread_closed`; nothing reopens a closed thread; a thread with a claim held on it closes all the same; and an element that left is marked with its last readable name in any drawing, else its name in the drawing the comment is at, else its key, which changes TASK-437's rule for an element renamed and then removed.

The four operations read and write more tables than they listed, the thread's waiting side among them (note 16 of the WBS). The correction at the end of the [API README](../docs/06-api/README.md) passed its own checkpoint on 2026-11-24.

`test/threads.test.js` checks TASK-443's done condition. It comments on an element, the diagram, a row and an element of a flow file, at an older drawing and at a failed one, and reads, replies to and closes the threads of a removed diagram. It answers every response API-266 to API-269 list and checks the tables they touch (note 23). Its test that accepting or rejecting a proposal after its thread closed leaves the thread closed runs against TASK-444's API-270 and API-271 (see [Answering proposals](#answering-proposals)).

## Project

`src/project.js` is TASK-440: the project read (API-264, `GET /api/projects/{project}`; SPEC-005, SPEC-027, SPEC-035, SPEC-046), which the owner's project screen (SCR-144, TASK-457) shows. It is an owner operation. A read writes nothing and logs nothing.

- **The head.** `name`, `repository` and `commit`, the held commit, are the project space's (TBL-147). `revision` and `pushed_at` are those of the held commit's snapshot (TBL-148): its revision and when NEXUS received it. `title` and `parts` are the project's in that snapshot's `/snapshot` document (TBL-150, TBL-149; see Documents above), `parts` being `[]` for a project without parts. The title is the project's name when the snapshot gives none, or one that is empty or only white space. `projectTitle` holds that rule, so that TASK-439's project list gives the same title.
- **Stage rows.** The stages are grouped by part, 13 rows per group in stage order (SCR-144). The groups come in this order: the project as a whole (`''`) when the project declares no parts or a listed diagram has none, as an item table never has; the parts of `parts`, in their order; then any other part a listed diagram still names, such as a removed diagram of a part the project no longer declares, by name. There are at most 51 groups, so at most the contract's 663 rows. A row holds the listed diagrams of its stage and part, a diagram's part being found as the agent to-do finds it (see To-do entries).
- **A row's state.** A stage pass (TBL-161) belongs to the stage, since the table keeps no part. So the stage's latest pass, the last written, makes every row of the stage `passed`, or `changed_since_pass` once the pass's `changed_at` is set, which TASK-435 sets when a confirmation the pass rests on is invalidated, or when a diagram appears after the pass without a live confirmation (see [After a drawing](#after-a-drawing)); `passed_at` is the pass's time, since the pass stays in the record (SPEC-035). Without a pass, a row is `open` while it holds a diagram that is not removed, and `not_sent` otherwise, with `passed_at` null. The read works out no pass and no change of its own: TASK-447 and the workshop's steps write passes, and TASK-435 and TASK-447 mark them changed (notes 20 and 25 of the WBS; see [Reports](#reports)).
- **Diagrams.** A row lists its diagrams that are not removed, by name and then by ID, so that the first is the stage's first diagram (SPEC-016); then the removed ones that something still waits on, in the same order, with `removed` true; at most 500 in all. What keeps a removed diagram is an open thread, a proposed AI proposal or a direct edit waiting for reflection (`KEEPS_REMOVED`): the owner answers each there. A live confirmation or an accepted AI proposal alone keeps nothing, and a removed diagram that nothing waits on is not listed. None makes its row open (SPEC-027, SPEC-005). This is the feature change of pull request 154, which TASK-468 builds; before it, only an open thread kept one. `DIAGRAM_ORDER` holds this order, and an agent's comment without item or diagram goes on the first (see [Comments](#comments)). Each diagram says:
  - `drawn`: whether it has a drawing that drew (TBL-152), as a confirmation needs (SPEC-029);
  - `confirmation`: its latest confirmation (TBL-160), `confirmed` while it is live and not recorded, `recorded` once recorded, `invalidated`, or `none` when it was cancelled or there is none;
  - `waiting`: its accepted change sets, which wait for reflection (TBL-158);
  - `open_threads`: its open threads (TBL-155).
- **Tool links** (SPEC-046): the project's links that are not removed (TBL-168), oldest first, at most 200, each with the status last read and the time it was read, both null before the first read. TASK-451 adds and removes them (see [Tool links](#tool-links)); it neither calls a tool nor holds a token. Their status is read by the [tool status read](#tool-status) (TASK-467), about every 30 minutes; until a link's first read both are null, and it shows "not read yet" (SPEC-046's exception).
- **The workshop**: the project's latest workshop (TBL-162), the open one or else the last closed one, or null when it never had one.
- **A name** that no project space has gets `project_not_found`, whose detail never repeats it.

The answer names what other tables hold, so API-264 lists 12 tables. The correction at the end of the [API README](../docs/06-api/README.md) passed its own checkpoint.

`test/project-read.test.js` checks TASK-440's done condition with rows that `test/seed.js` writes, the stage passes and tool links included, since later tasks write them (note 25): a stage shows passed from its pass record, and changed since the pass once a confirmation it rests on is invalidated and its pass is marked changed; removed diagrams are not counted. It answers every response API-264 lists and checks the tables it touches (note 23). For TASK-468 it lists removed diagrams kept by a proposed AI proposal, a waiting direct edit, one in an open pull request and a rejected proposal's open thread, and none kept only by an accepted proposal, a live confirmation, recorded or not, or answered, withdrawn, cancelled or reflected change sets.

## Projects and to-do

`src/owner.js` is TASK-439: what the owner sees first, the project list (API-262, `GET /api/projects`; SPEC-015, SCR-143) and the owner's to-do (API-263, `GET /api/todo`; SPEC-042, SCR-142). Both are owner operations, so admission lets only the owner's sign-in from the gate through (SPEC-048). A read writes nothing and logs nothing.

- **The project list.** The project spaces, newest send first (SCR-143): by the time the held snapshot was received, then by name. A space that holds no snapshot yet comes after them, by name. At most 1000 are listed. Each has:
  - `title`, `revision`, `commit` and `pushed_at` from `projectHead`, as the project read finds them (see Project), so the title falls back to the name in the same way;
  - `owner_todo`: the project's open entries that wait on the owner (TBL-166), the same entries the to-do lists (note 22 of the WBS);
  - `stages_passed`: how many of the 13 stages are passed. A stage counts when `stageState` shows its row as `passed`, so a pass marked changed since does not count. `stagesPassed` in `src/project.js` holds this, so "N of 13 stages passed" on SCR-143 cannot differ from the stage rows on SCR-144.

  A new install has no project space, and the store never reads a v2 store (see Store), so it lists none (SPEC-015).
- **The owner's to-do.** The open owner entries of TBL-166, which `src/entries.js` opens and closes: the diagrams to confirm, the AI proposals to answer and the agent questions. The 5000 newest are listed, grouped by project. Projects come in the order of their newest entry, and each project's entries newest first, by the time each was opened and then by key. So the first entry is the newest of all. Each entry gives:
  - its project, stage, part, diagram and diagram name. The part is found as the agent to-do finds it (see To-do entries).
  - `thread`: a question's thread, or the thread a proposal answers.
  - `change_set`: a proposal's change set.
  - `reason`: for a confirm entry, why the diagram waits. It is `new` when no confirmation of it ended, and otherwise the state of the last one that ended: `invalidated` by a new document (SPEC-033) or `cancelled` (SPEC-030).
  - `since`: when the entry was opened.

  An entry of a removed diagram stays as `src/entries.js` leaves it: its questions and proposals still wait on the owner, and its confirm entry is withdrawn (note 4 of the WBS).
- **The backup warning.** Both answers carry `backup`, the warning of a failed daily backup (SPEC-042, SPEC-052), from TBL-170. `src/backups.js` holds the rule.
  - The warning comes from the latest backup that ended for good, by the time it started. A backup that succeeded shows none. A retry (attempt 2) that failed shows it.
  - A first attempt that failed shows nothing while its retry is due, since SPEC-052 retries a failed backup once within the hour before the warning. Rows still running change nothing either.
  - The warning stays until a later backup succeeds. `failed_at` is when the failed retry ended, and `last_succeeded_at` when the last backup that succeeded ended, or null when none ever did.
  - The backups themselves are TASK-450's, and so is a retry that never ran.

The two answers name what other tables hold, so API-262 lists 7 tables and API-263 lists 9. The correction at the end of the [API README](../docs/06-api/README.md) passed its own checkpoint.

`test/owner.test.js` checks TASK-439's done condition. A new install, with a v2 store beside it in the data folder, lists no project and nothing to do. The test answers every response API-262 and API-263 list, and checks the tables each touches (note 23). Its rows are written with `test/seed.js`, its entries opened by `src/entries.js`, and its TBL-170 rows written as TASK-450's job will write them.

## Project removal

`src/removal.js` is TASK-448: deleting a project space (SPEC-013), with what it removes shown first. API-277, `GET /api/projects/{project}/removal`, answers the preview, and API-278, `POST /api/projects/{project}/removal`, deletes once the owner sends the project's name. Both are owner operations, so an agent never deletes (REQ-017). `removalPreview` is the one preview: TASK-436's API-244, the agent's read of the same preview, calls it too.

- **What goes.** Every row of the project, and nothing of another project. Each table of a project reaches `project_spaces` through `ON DELETE CASCADE` (see `db/nexus.sql`), so deleting the space's row deletes the rest with it:
  - its snapshots and their files;
  - its diagrams, drawings, elements and positions;
  - its threads, comments, pull requests, change sets and their changes, and confirmations;
  - its stage passes, and its workshops with their steps, notes and links;
  - its to-do entries, claims and tool links.
- **Blobs.** A document's text is kept once by its SHA-256, however many snapshots hold it (TBL-149), so two projects may share a blob. In the same transaction, the deletion also removes the project's blobs that no remaining snapshot file names, as the schema's comment on TBL-149 says. A blob another project still names stays.
- **What stays.** Agent credentials, request keys and backups are no project's rows. A backup keeps the deleted project until it ages out after 30 days, or longer when it is the newest that stays while backups fail (SPEC-052, see [Daily backup](#daily-backup)).
- **The preview** (RemovalPreview) gives the held commit and its revision, null before the first snapshot. `deletes` has the 11 counts the contract names, from snapshots to tool links. Each counts every row of its kind the deletion removes, removed diagrams and removed tool links included. The rows of the other tables, such as elements, pull requests, stage passes and to-do entries, go with them but have no count of their own. `open` counts what is still open:
  - the open threads;
  - the change sets still proposed, or accepted and waiting for reflection;
  - the confirmations to record, as `src/entries.js` opens their entries: one not recorded and not cancelled, or a recorded one whose cancel is not recorded.
- **The deletion** takes `{ "name": ... }`, the project's name the owner typed (SCR-144#delete, TASK-457).
  - A space already gone is `project_not_found`, whatever the body's fields are: the space is found before they are read.
  - A name that is not exactly the project's is `invalid_request` on `name`, and nothing is removed.
  - The answer, RemovalAnswer, gives the counts taken in the same transaction just before the delete.
  - Like every write, it runs in one transaction with its request key, so a deletion that fails part way removes nothing, and a repeat with the same key answers the first answer again.

The two operations count and read what other tables hold, so API-277 lists 12 tables and API-278 lists 14. TBL-149 gains SPEC-013 in its trace list, so that API-278 changes only tables its spec row feeds. The corrections at the end of the [ERD README](../docs/05-erd/README.md) and the [API README](../docs/06-api/README.md) passed their own checkpoints.

`test/removal.test.js` checks TASK-448's done condition with two projects that share a blob, each with a row in every table of a project:

- deleting one removes exactly its rows from every table and its blobs, keeps every row of the other and the shared blob, and changes no row it keeps;
- the tables of no project stay as they were, and the request keys gain the deletion's;
- every response API-277 and API-278 list is answered, and each operation touches exactly the tables it lists (note 23).

## Agent reads

`src/reads.js` is TASK-436: the reads of the pinned hub's `remove` and `show` commands (API-244, API-246 to API-249; SPEC-013, SPEC-014, SPEC-016, SPEC-018, SPEC-024, SPEC-026, SPEC-031). All five are agent operations with no body and no session. A read writes nothing: it opens and closes no entry and keeps no claim, so a claim it answers is never `mine`.

The rules below that no approved document states, what a closed entry lists, how a confirmation cancelled before its record reads, which entry a change set's `reflection` names, a withdrawn reflection entry's `pull_request` and `commit`, and `reflection` while its entry is open, were chosen by the coordinator for TASK-436, and the maintainer approved them through the delegate they named for checkpoints on 2026-11-24.

- **What deleting the space removes** (API-244, `GET /api/spaces/{project}/data`) is the preview API-277 gives the owner, from `removalPreview`, the one count (see [Project removal](#project-removal)). The hub's `remove` reads it and gives the owner the page that deletes; an agent never deletes (REQ-017).
- **A thread** (API-246, `nc_`) is any thread of the project, the owner's or an agent's, open or closed, on a diagram removed or not (SPEC-027). It has every entry in order, each made by `entryOf` in `src/comments.js`, which also answers an agent's entry when it is added. `change_sets` are the change sets that answer the thread, by their `thread_id`, oldest first, at most 200. `threadBody` gives it, and the owner's read of a thread (API-266, see [Threads](#threads)) answers the same.
- **A change set** (API-247, `np_`) is an AI proposal or a direct edit, with its steps (TBL-159) in order.
  - **Proposal names.** TBL-158's `detail` keeps a proposal as the hub sends it, under ProposalRequest's own names: `items`, `adds`, `reason`, `change` and `source_text`, the proposed document. The answer says only whether `source_text` came. A direct edit's detail has none of them, so its `items` and `adds` are empty, its `reason` and `change` null and `source_text` false. These names bind the tasks that write the detail, TASK-438 (an agent's proposal) and TASK-445 (the owner's direct edit); this is the one place that names them.
  - **`reflection`** is the reflection entry that reads back with the change set in it. For an accepted change set, it is the open reflection entry whose group holds it, while that entry lists it among the first 200 it holds. For one cancelled in a pull request, it is the removal entry that takes it out, open or done. For a reflected one, it is the latest reflection entry of its diagram closed as done whose anchor is in its pull request. A change set reflected while others of its pull request still wait for reflection is null until that entry closes as done, since an open entry lists only what still waits for reflection, as the agent to-do does. A change set proposed, rejected, or cancelled outside a pull request has none.
- **A reflection entry** (API-248, `ne_`) is a `reflect` or `remove_from_pr` entry of TBL-166, open or closed.
  - **Its change sets.** An open entry holds what `heldChangeSets` in `src/entries.js` finds. TBL-166 keeps only a closed entry's anchor, so a closed entry lists what it can still name. A reflection closed as done lists the diagram's change sets reflected in its anchor's pull request, in the order they were accepted. One withdrawn, and a removal entry, list their anchor.
  - **`state`** is `done` or `withdrawn` as the entry closed. An open entry's follows its pull request, as API-258's reports set it: `waiting` without one, `in_review` while it is open, `merged` once it is merged, and `reported` once its merge commit is reported. `commit` is that merge commit. A withdrawn reflection entry answers `pull_request` and `commit` null: TBL-166 keeps no pull request for a closed entry, and its anchor may join one after the entry closed.
  - **`claim`** is an open entry's live claim (see [Claims](#claims)).
- **A confirmation** (API-249, `nk_`), which the hub calls a checkpoint, is any confirmation of the project.
  - **`state`** is `withdrawn` once it is cancelled, with `withdrawn_at` the cancel's time, and `passed` otherwise, an invalidated one included, as the agent to-do reads it.
  - **`record_state`** tells how far the record that is due got. That record is the cancel's once a recorded confirmation is cancelled, and the confirmation's own otherwise. It is `recorded` when that record is made, `in_review` while `record_pull_request_id` names an open pull request, and `waiting` otherwise. A confirmation cancelled before it was recorded is `withdrawn` with `record_state` `waiting`, even while its record's pull request is open, since nothing was recorded. An agent reads `state` first, so it never records a withdrawn confirmation.
  - **`claim`** is the live claim of its open record entry.
- **A part** is found as the agent to-do finds it (see [To-do entries](#to-do-entries)).
- **Not found.** A name no project space has gets `project_not_found`. An ID of another project or of no row gets the operation's own code: `comment_not_found`, `proposal_not_found`, `edit_not_found` or `checkpoint_not_found`. An `ne_` ID of an entry of another kind gets `edit_not_found` too.
- **No log line** holds a comment's text, a session's label or a link (rule 5).

The five reads name what other tables hold, so API-244 lists API-277's 12 tables and API-246 to API-249 list 8 or 9 (notes 18 and 23 of the WBS). The correction at the end of the [API README](../docs/06-api/README.md) passed its own checkpoint on 2026-11-24.

`test/reads.test.js` checks TASK-436's done condition with rows that `test/seed.js` writes and entries that `src/entries.js` opens. API-244 answers the owner's preview. A thread, a change set, a reflection entry and a confirmation are read in each state above, and each reflection entry a change set names reads back with that change set in it. The test answers every response the five operations list, and checks that each touches exactly the tables it lists and changes none (note 23).

## Diagram

`src/diagram.js` is TASK-441: the diagram read (API-265, `GET /api/projects/{project}/diagrams/{diagram}`; SPEC-003 to SPEC-012, SPEC-022, SPEC-027, SPEC-034, SPEC-051). The owner's workbench (SCR-145, TASK-458) and the list of changes since a confirmation (SCR-146) show it. It is an owner operation. A read writes nothing and logs nothing. A phone gets the same answer as a PC (SPEC-051): leaving out what a phone does not offer is the page's work.

- **The diagram.** `id`, `stage`, `kind` and `name` are the diagram's (TBL-151), and `removed` says whether a snapshot removed it. `part` is found as the agent to-do finds it (see [To-do entries](#to-do-entries)).
- **Drawings.** `drawing` is the diagram's latest drawing (TBL-152). Its `revision` is that of the snapshot it comes from (TBL-148), and `version` that snapshot's commit. For a failed drawing, `failed_at` is where it failed: the file and its line, or the file alone. When the latest drawing failed, `last_drawn` is the last drawing that drew, or null when none did; otherwise `last_drawn` is null (SPEC-001).
- **Elements** are those of the drawing the diagram shows: the current one, or the last good one when the current one failed, and none when it never drew. They come in the drawer's order, as drawn (TBL-153). `name` is `''` for an element without a name, and the page shows it by its trace ID (SPEC-010, SPEC-011). Each element has a `position`:
  - where the owner put it (TBL-154, SPEC-012), which API-274 keeps (see [Moving an element](#moving-an-element));
  - else the top left corner of its `detail.box`, where its drawer placed it;
  - else null: a line, a token, an entry the hub left out, or a box past the contract's ±1,000,000.
- **Links by name.** A row of an item table keeps in its drawing the IDs it links to (see [Item table](#item-table)). The read gives each link as `{ id, name }`, its name from the item documents (`/items/<stage>`) of the snapshot the project holds, through `itemNames`. A link it cannot find, or whose item has no title, has the name `''`, and the page shows its ID (SPEC-010). So a title changed in another stage shows at the next read, with no new drawing.
- **Overlays** (SPEC-022) are the diagram's AI proposals and accepted change sets (TBL-158), newest first, at most 500: an accepted change set by when it was accepted, the order the reflection applies them in (see [Direct edits](#direct-edits)), and a proposal by when it was made. So two change sets on one element are listed newest on top. Each gives:
  - its steps in order (TBL-159) and its pull request's link (TBL-157);
  - once it is accepted, `reflection`: the open reflection entry of the agent to-do that holds it (TBL-166, see [To-do entries](#to-do-entries));
  - `items`, `adds`, `reason` and `change`: what TBL-158's `detail` keeps of a proposal as the hub sends it, under the names of the hub's request. `source_text` says whether `detail` keeps the proposed document. A direct edit has none of them.

  The elements stay as drawn, and the page lays the overlays over them.
- **The confirmation** is the diagram's latest confirmation (TBL-160) in any state, confirmed, invalidated or cancelled, or null when it has none.
- **Since the confirmation** (SPEC-034). `since_confirmation` compares, by element key, the drawing of that latest confirmation with the drawing the diagram shows.
  - `added` and `changed` follow the shown drawing's order, and `removed` the confirmed one's. `version` is the confirmed drawing's commit.
  - It is null when the diagram was never confirmed, and the page says so.
  - An element is changed when what the document says of it changed: its name, kind, trace ID, parent, status or detail, leaving out `detail.box`, `detail.points` and `detail.where`. So one added table, which moves the other boxes, or a line added at the top of a file, marks no other element changed.
  - A cancelled confirmation is still the latest one, so the list shows what changed since the version last confirmed.
- **Threads** are all the diagram's threads (TBL-155): open ones first, then closed ones, each oldest first, at most 5000. Each gives how many entries it has and when the last was written (TBL-156), as [Comments](#comments) answers a thread. A thread whose element left the drawing is on the diagram, keeps the element's key and is marked with its last name, `removed_name` (SPEC-027).
- **A removed diagram** opens while something waits on it, as the project read lists it (`KEEPS_REMOVED`; SPEC-027): an open thread, a proposed AI proposal or a direct edit waiting for reflection. It opens for those: its threads are read, replied to and closed, its proposals rejected (API-271) and its waiting edits cancelled (API-273); the page offers no new thread, move, new direct edit, accepting, confirming or Cancel confirmation (SCR-145). A live confirmation or an accepted AI proposal alone keeps nothing. Once nothing waits on it, it answers `diagram_not_found`, like an ID that no diagram of the project has. A rejected proposal's thread stays open (SPEC-020), so the diagram opens until the owner closes that thread. So when the owner closes its last thread, rejects its last proposal or cancels its last edit and nothing else waits, the next read gets 404, and the page links to the project (note 10 of the WBS). After a close, the page opens the stage's first diagram in its place instead (see [Workbench threads](#workbench-threads)). This is the feature change of pull request 154, which TASK-468 builds; before it, only an open thread kept a removed diagram open.
- **A name** that no project space has gets `project_not_found`, and an ID that names no diagram of the project gets `diagram_not_found`, as does a diagram of a stage the contract does not name, which the project read does not list. Neither detail repeats the value.

The coordinator chose three rules for TASK-441, and the maintainer approved them through the delegate they named for checkpoints: a removed diagram without an open thread answers `diagram_not_found`, which the feature change of pull request 154 widened to a removed diagram that nothing waits on; changed means what the document says changed; and the latest confirmation in any state is the one compared with.

`test/diagram.test.js` checks TASK-441's done condition: it reads a diagram of 300 elements in under a second. The diagram also has 300 positions, 100 threads and 50 overlays, and all 300 elements changed since its confirmation. A first read warms up the server and the store. The test then times five reads, and the middle one counts, so that one read slowed by another program on a busy machine does not fail it. The test also reads every diagram that this repository's push draws with the server's own drawers, answers every response API-265 lists, and checks the tables it touches (note 23). For TASK-468 it opens removed diagrams kept by a proposed AI proposal or a waiting direct edit, and after the owner's own writes, rejecting (API-271), closing (API-269) and cancelling (API-273), answers `diagram_not_found` once nothing waits. Accepting a proposal there is refused with `document_changed` (API-270) and leaves it proposed, so only one accepted before the removal is accepted on a removed diagram; a rejected proposal's open thread keeps the diagram until it is closed, and an accepted proposal or a live confirmation alone keeps nothing.

The answer names what other tables hold, so API-265 lists 15 tables. The correction at the end of the [API README](../docs/06-api/README.md) passed its own checkpoint on 2026-11-24.

## Direct edits

`src/direct-edits.js` is TASK-445: the owner's direct edits (API-272, `POST /api/projects/{project}/diagrams/{diagram}/direct-edits`, and API-273, `POST /api/projects/{project}/change-sets/{change_set}/cancel`; SPEC-021, SPEC-022, SPEC-023, SPEC-027). On the workbench (SCR-145) the owner renames an element or connects two, and cancels such an edit while it waits for reflection. Both are owner operations with a JSON body and a request key, and each is one write. A phone offers neither (SPEC-051, REQ-068): leaving them out is the page's work (see [Workbench changes](#workbench-changes)). Nothing is logged: a name is kept in the store and the answer only (rule 5).

- **An edit** (API-272) is a change set of the diagram (TBL-158) whose origin is `direct_edit`, accepted when it is made, with one step (TBL-159) against the drawing the diagram shows (SPEC-021). Its reflection goes on the agent to-do at once, as `changeSetsChanged` groups it (see [To-do entries](#to-do-entries)). Its `detail` is `{}`, so API-247 reads it with `items` and `adds` empty, `reason` and `change` null and `source_text` false (see [Agent reads](#agent-reads)). The answer is 201 with `created` true and the change set as API-247 gives it, through `changeSetOf` in `src/reads.js`.
- **The diagram.** A removed diagram takes no direct edit (SPEC-027), nor does a diagram of a stage the contract does not name; both answer `diagram_not_found`. Stage 09's mockup page takes no overlay (SPEC-018), so a direct edit there is refused with `invalid_request` on `op`, "a mockup takes no direct edit". An item table of stage 09, drawn while the stage has no mockup page, takes edits as any item table does.
- **The drawing.** `drawing` names the drawing the diagram shows: the current one, or the last good one when the current one failed (SPEC-001). Another drawing of the diagram answers `document_changed` with the drawing shown and its version, or with the latest drawing when none drew, so the page reads the diagram again. An ID that names no drawing of the diagram answers `drawing_not_found`.
- **The elements.** `element`, and a connection's `target`, are element keys of the drawing shown that the document holds; one that is not answers `element_not_found` with its key, as does any element of a diagram that never drew, which shows none.
  - An element drawn as `unreadable` is refused: the drawer could not read its entry, so a reflection has no text to change, and a comment counts it as gone too (SPEC-027).
  - So is one drawn as `missing`: an ERD table that a foreign key names and the schema does not define, which is in no document.
  - So is one drawn as `left_out`: what a drawer does not draw, an ERD statement, a sitemap source or a DDD table, whose key is no name its document gives.
  - One drawn as `removed`, a DDD context or an item its document marks removed, is still in that document, and takes edits.

  A rename's `name` is text that is not only white space, of at most 200 characters (SPEC-021), kept as it is written; a longer one answers `text_too_long`.
- **Nothing new.** An edit that changes nothing writes nothing and answers 200 with `change_set` null and `created` false (SPEC-021). Waiting means accepted and not yet reflected.
  - A rename to the name the element has: the name its waiting rename accepted last gives, or else its name as drawn.
  - A connection that exists, from the element to the target. The other direction is another connection. It exists when:
    - a line of the drawing shown has the element as `detail.from` and the target as `detail.to`: an ERD line, a sitemap line, a user flow's arrow, or a DDD dependency, whose direction is the one its picture gives, its points running from `from` to `to`;
    - on an item table, the row whose key is the element lists the target's key among its `detail.links`, the IDs its source gives; the target's row listing the element does not count;
    - or a step of a waiting change set of the diagram connects the element to the target.
- **What a rename takes.** Every readable element takes a rename but three whose names the drawer makes, not the document: the DDD board's Hotspots lane (`hotspot_lane`), always named Hotspots; a sitemap line (`line`), named after the screen it leads to, whose relation is that screen's parent; and an ERD line (`line`), named by its foreign key's columns joined with commas, which is no one name of the schema. A rename of any of them is refused with `invalid_request` on `element`, since no reflection could apply it. A table's columns are not elements, so no direct edit renames a column. A DDD dependency's name is its "why" and a user flow arrow's its label, so both take a rename.
- **What a connection joins.** A connection joins two elements of the kinds its picture draws its lines between: an ERD's tables, a sitemap's screens, a user flow's boxes of every shape (terminal, step, decision, document, store, LLM and grading), a DDD board's contexts and external systems, and an item table's rows. Any other element or target, such as a line, a lane or an event, is refused with `invalid_request` on its field. Screen states draw no line, so a connection there is refused with `invalid_request` on `op`, and a rename is taken.
- **A connection on a sitemap.** Each screen of a sitemap stands under one parent, and its line runs from that parent to it. So a connection from X to Y means that Y stands under X: the step stays a connection from X to Y, and the reflection moves Y under X, from any parent it had. A target that X stands under, directly or not, would make a cycle, so it is refused with `invalid_request` on `target`, "a screen cannot stand under its own child".
- **The later accepted wins.** A direct rename of an element that an open AI proposal also renames is made as any other. A direct edit is accepted when it is made, and a proposal when the owner accepts it; TBL-158's `decided_at` keeps that time, which API-270 sets.
  - The diagram read lists accepted change sets newest accepted on top (SPEC-022), and a proposal by when it was made. So while the proposal is only proposed, the direct edit made after it is on top, and once the owner accepts the proposal, the proposal is on top.
  - The reflection applies the waiting change sets in the order they were accepted. Within an entry, `heldChangeSets` lists them in that order. Across entries, a change set accepted while a pull request is open waits in a later entry, which the agent to-do lists after it (see [To-do entries](#to-do-entries)).
  - The agent to-do lists entries in that order, but nothing makes their pull requests merge in it: an agent can reflect a later entry first. And when a pull request closes unmerged, its change sets wait again in the older entry that held them, with those already waiting, and the newer waiting entry is withdrawn, so that entry can hold change sets accepted both before and after those of an entry between them. So TASK-447's reflection applies the changes to one element by `decided_at`, the later accepted last, which every change set's answer carries (API-247, API-248), and names in its comment the change it left.
  - So the page always shows on top the name the reflection will leave, and a proposal the owner accepts after a direct edit overrides that edit.
- **A cancel** (API-273) takes a direct edit that is not reflected, with the body `{}`. The change set is marked `cancelled` and leaves the diagram's overlays, so the diagram shows the element as drawn again (SPEC-023), and `changeSetsChanged` takes it out of its reflection entry. The answer is 200 with `changed` true.
  - In an open pull request, it is cancelled all the same and keeps its pull request. `removeFromPullRequest` asks the agent to take it out (see [To-do entries](#to-do-entries)), and `pull_request` names that pull request.
  - In a pull request that merged before it was reflected, it is cancelled with no removal entry, and `pull_request` is null. As SPEC-023 says of a pull request that merges with the cancelled change, the drawing will show the change, and the owner comments to undo it.
  - Cancelled again, it answers the same with `changed` false, and `pull_request` names the pull request a removal was asked of while that pull request is open, as the contract's ChangeSetAnswer says.
  - Reflected, or in any state but accepted and cancelled, it is refused with `change_set_state` and its state. So is an AI proposal, which the owner answers and does not cancel (API-270, API-271): the page offers Cancel edit on a direct edit only.
  - An ID of another project or of no change set answers `change_set_not_found`.
- **A removed diagram** (note 8 of the WBS). SPEC-027 refuses a new direct edit there, but a cancel only takes a change out, so API-273 cancels a removed diagram's direct edit like any other. A waiting edit keeps the removed diagram listed and open, its threads closed or not (see [Diagram](#diagram)), so the owner reaches it in the workbench: SCR-145's "This diagram" section lists the waiting edits in place of the confirm button, each with Cancel edit, and the list of changes (SCR-146) shows only the changes. TASK-460 builds the section's list (see [Workbench changes](#workbench-changes)), and TASK-461 the list of changes. This is the feature change of pull request 154, which TASK-468 builds. Before it, a removed diagram whose threads were all closed did not open, so a waiting edit could be cancelled only by its ID; TASK-447 left it so, and its pull request records the options weighed. The agent can still report the edit's reflection, which marks the change reflected and says in a comment what the merged document lacks (see [Reports](#reports)).
- **The steps** are written by `writeSteps` in `src/changes.js`, the one place that writes TBL-159, for a direct edit and for an agent's proposal (TASK-438). A step is the contract's Change, `{ op, element, name, target }`, by element key:
  - `rename`: the element takes the name `name`;
  - `connect`: a line from the element to `target`, in that direction, under the new line's label `name` when the step gives one, as an agent's proposed arrow does; a direct edit's connect gives none;
  - `add`: the element is added, under `name` when the step gives one;
  - `remove`: the element is removed.

  The steps of a change set keep their order, and a reflection applies them in that order. Each step says what it does with its own four fields, so TASK-447 can say step by step what a merged document lacks (SPEC-025).

The coordinator chose eight rules for TASK-445 that no approved document states: a removed diagram's direct edit can be cancelled; the later accepted wins, which TASK-447's reflection keeps by `decided_at`; which connection already exists; the mockup page takes no direct edit; an element drawn as unreadable, missing or left out takes none; what a rename takes; what a connection joins; and what a connection means on a sitemap. The maintainer approved them through the delegate they named for checkpoints on 2026-11-24; the pull request records them with the options not taken.

`test/direct-edits.test.js` checks TASK-445's done condition: after an unreflected rename of X to Y is cancelled, the diagram read (API-265) shows X again, with no overlay. It checks each rule above on an ERD, a sitemap, a user flow, a DDD board, an item table and screen states, the later accepted winning within one reflection entry and across two, reads each change set back through API-247, answers every response API-272 and API-273 list, and checks the tables each touches (note 23).

The two operations read what other tables hold, so API-272 and API-273 list 9 tables each. The correction at the end of the [API README](../docs/06-api/README.md) passed its own checkpoint on 2026-11-24.

## Confirmations

`src/confirmations.js` is TASK-446: the owner confirms a diagram or an item table and cancels a confirmation (API-275, `POST /api/projects/{project}/diagrams/{diagram}/confirmation`, and API-276, `POST /api/projects/{project}/confirmations/{confirmation}/cancel`; SPEC-027, SPEC-029, SPEC-030, SPEC-031). Both are owner operations with a JSON body and a request key, and each is one write. A phone offers neither (SPEC-029, REQ-068): leaving them out is the page's work. The answer holds IDs, times and a commit only, and nothing is logged (rule 5).

- **A confirmation** (API-275) is a row of TBL-160 `confirmations` of the diagram, at the drawing `drawing` names, in the state `confirmed`. `confirmationsChanged` then closes the owner's `confirm` entry as done and adds recording the confirmation to the agent to-do (SPEC-031; see [To-do entries](#to-do-entries)). The answer is 201 with `changed` true and the Confirmation, made by `confirmationBody`, which the diagram read gives its latest confirmation with too (see [Diagram](#diagram)). It names the drawing it confirms and that drawing's commit, so the page can show what was confirmed, an empty item table included.
- **The diagram.** A removed diagram takes no confirmation (SPEC-027), even while it opens for what waits on it, and neither does a diagram of a stage the contract does not name; both answer `diagram_not_found`. Every other diagram takes one: the mockup page, and an item table of any stage, empty or not (SPEC-005), since a stage passes only when each of them is confirmed (SPEC-035).
- **The drawing.** `drawing` names the diagram's latest drawing, which drew.
  - When the latest drawing failed, the document does not draw. The confirm is refused with `not_drawn`, "the diagram has no current drawing", even while the diagram shows its last good drawing, and the page shows where it failed (SCR-145).
  - Another drawing of the diagram answers `document_changed` with the latest drawing and its version, so the page reads the diagram again ("look at the new version", SPEC-029). An ID that names no drawing of the diagram answers `drawing_not_found`.
- **Waiting changes.** While a change set of the diagram waits for reflection, that is accepted and not reflected, the confirm is refused with `waiting_reflection`. Its `change_sets` lists up to 200 of them, oldest accepted first (SPEC-029).
  - A direct edit (TASK-445) and an accepted proposal (TASK-444) wait alike: `waitingChangeSets` in `src/entries.js` is the one reader of them.
  - A proposal that is only proposed does not wait, and the page says that AI proposals left out are not confirmed (SCR-145).
- **Confirmed again.** While the diagram has a live confirmation, a confirm that names the drawing the diagram shows, or the drawing the confirmation is at, answers 200 with that confirmation and `changed` false, and writes nothing (SPEC-029).
  - The two drawings differ when a later drawing read the same documents and so kept the confirmation live (see [After a drawing](#after-a-drawing)), or when a later drawing failed.
  - A confirmation that ended, cancelled or invalidated, is not revived: confirming again makes a new one.
- **A cancel** (API-276) takes the body `{}` and ends a live confirmation as `cancelled`, at `ended_at`. `confirmationsChanged` puts the diagram back on the owner's to-do as not confirmed, naming the cancelled confirmation (SPEC-030). The answer is 200 with `changed` true.
  - Not recorded yet, its agent entry to record it is withdrawn (SPEC-031).
  - Recorded already, the agent to-do gets recording the cancel, `record_cancel` (SPEC-030).
  - Not confirmed, that is cancelled or invalidated already, it answers the same with `changed` false and changes nothing (SPEC-030).
  - An ID of another project or of no confirmation answers `confirmation_not_found`.
- **A removed diagram** (note 9 of the WBS). SPEC-027 refuses confirming there, but a cancel only takes a confirmation out, so API-276 cancels a removed diagram's confirmation like any other. Its record is withdrawn, or its cancel asked for, as above. The owner's to-do gets no confirm entry, since a removed diagram takes no confirmation (see [To-do entries](#to-do-entries)).
- **A stage pass** is left as it is. Between a cancel and its record, the project page still shows the stage passed (see [Project](#project)). When the agent records the cancel, TASK-447 marks the passes that rest on that confirmation `changed_at`, as [After a drawing](#after-a-drawing) does for an invalidation, since that is when Git's stage record changes (see [Reports](#reports)). A record that merges writes the stage's pass once every diagram of the stage has a recorded confirmation.

The coordinator chose six rules for TASK-446 that no approved document states: a removed diagram's confirmation can be cancelled; a live confirmation answers for the drawing the diagram shows and for the drawing it is at; a stage pass stays as it is until the agent records a cancel; a failed latest drawing answers `not_drawn`; a confirmation that ended is not revived; and a proposal that is only proposed does not stop a confirmation. The maintainer approved them through the delegate they named for checkpoints on 2026-11-24; the pull request records them with the options not taken.

`test/confirmations.test.js` checks TASK-446's done condition: confirming while a direct edit and an accepted proposal wait gets `waiting_reflection`, listing both, oldest accepted first, and once neither waits the diagram takes the confirmation. It checks each rule above, answers every response API-275 and API-276 list, and checks the tables each touches (note 23).

The two operations read what other tables hold, so API-275 lists 6 tables and API-276 lists 5. The correction at the end of the [API README](../docs/06-api/README.md) passed its own checkpoint on 2026-11-24.

## Moving an element

`src/positions.js` is TASK-442: the owner moves an element of a diagram, and NEXUS keeps where they put it (API-274, `POST /api/projects/{project}/diagrams/{diagram}/positions`; SPEC-012, SPEC-027). It is an owner operation with a JSON body and a request key (rule 3). A position is a row of TBL-154 `element_positions`, by diagram and element key, kept in NEXUS and never in Git. A phone gets the same answer as a PC (SPEC-051): leaving moving out on a phone is the page's work (see [Workbench pictures](#workbench-pictures)).

- **A move** takes `{ element, x, y }`, the contract's Move: the element's key and the top left corner of its box, each from -1,000,000 to 1,000,000. The place is kept as sent, however far it is from the other boxes. The answer, MoveAnswer, gives the diagram, the element, the place and `moved_at`. The last move wins, so the same element moved in two tabs stands where the later move put it (SPEC-012).
- **What changes.** Only the position. A move changes no document, drawing, element, confirmation, change set or to-do entry, since a position never changes what the document means (TBL-154). The diagram read answers it as the element's `position` (see [Diagram](#diagram)).
- **No drawing reads a position.** The drawers lay out each drawing from its documents alone, as if nothing had moved, and give `layout.js` no `nodes[].position`. If a drawing read the positions, a move alone would make a new drawing at the next push although the document did not change, and a confirmation or a proposal made against the drawing before it would be refused with `document_changed`. So the boxes a drawer places do not keep clear of a moved box, and its lines, as drawn, still end where the drawer put it. The page draws a moved box at the owner's place and routes its lines to it: on the ERD, the sitemap and the user flows it runs `layout.js` again with the positions as fixed boxes, so that the other boxes keep clear of it, and on the DDD board it draws the box over the others (see [Workbench pictures](#workbench-pictures)).
- **Which diagram.** One of the project's, of a stage the contract names. A diagram a snapshot removed opens only for what waits on it and takes no move (SPEC-027). It gets `diagram_not_found`, as a new direct edit there does, even while the diagram read still opens it (see [Diagram](#diagram)). The project and the diagram are found before the Move's fields are checked.
- **Which element.** One of the drawing the diagram shows: its latest drawing that drew, so a move works while its latest drawing failed (SPEC-001). The body names no drawing, so a page opened before the latest push still moves an element the shown drawing holds. An element it no longer holds gets `element_not_found`, which names the key, and so does any element of a diagram that never drew.
- **What moves.** An element whose drawing gives it a box (`detail.box`): an ERD table, a flow's box, a sitemap screen, a state panel, and on the DDD board an event, a sticky, an external system or a hotspot. These do not move, and get `invalid_request` on `element`:
  - a line, an arrow or a dependency, a mockup's token, an item table's row and a part the hub left out, which have no box;
  - the DDD board's lanes, context frames and Hotspots lane, which are drawn round other elements: moving one alone would leave what it holds behind. `placeable` in `src/positions.js` holds this rule.

  An element drawn as unreadable keeps its box and moves (note 1 of the WBS), since it has not left the document. So does an ERD table drawn as `missing`, which a foreign key names and the schema does not define: SPEC-004 draws it in a box, marked, while a foreign key names it. A direct edit refuses both, since neither has text a reflection could change (see [Direct edits](#direct-edits)).
- **What a push keeps** (`src/after-drawing.js`). A position stays while the drawing the diagram shows places its element.
  - A new drawing that drew drops the positions of the elements it no longer places. An element that left the document loses its position (SPEC-012); when it comes back, it stands where its drawer puts it.
  - An element drawn as unreadable keeps its position. SPEC-027 counts it as gone until its part reads again, which moves its threads to the diagram, but it has not left the document, and its drawer still draws it in its box.
  - A diagram the snapshot removes drops all its positions.
  - A failed drawing, a source the snapshot leaves out (see [Drawing](#drawing)) and a diagram drawn as before keep them all.
- **Refusals** name the field, never its value: a Move that breaks the contract gets `invalid_request` on `body`, `element`, `x` or `y`.
- **No log line** holds an element's key, a project's name or a place (rule 5).

No approved document states these rules: that no drawing reads a position, which elements move, that any place within the contract's range is kept, what a push keeps and drops, a move while the latest drawing failed, a move from a page opened before the latest push, a move on a diagram that never drew, a move of an ERD table drawn as `missing`, and note 1. The coordinator chose them for TASK-442, and the maintainer approved them through the delegate they named for checkpoints on 2026-11-24.

API-274 reads the project space, the diagram, its drawings and the element it moves, besides the position it writes, so it lists TBL-147, TBL-151, TBL-152, TBL-153 and TBL-154. The push drops positions, so API-242 lists TBL-154 and SPEC-012, the spec row that feeds it. The correction at the end of the [API README](../docs/06-api/README.md) passed its own checkpoint on 2026-11-24.

`test/positions.test.js` checks TASK-442's done condition with pushes of this repository's files and the server's own drawers. A moved element keeps its place in the next drawing, and that drawing is the same, box for box, as the drawing of a project whose elements never moved. The test also checks what a push keeps and drops: for an element drawn as unreadable, a failed drawing, a source left out, and a diagram removed and back again. It answers every response API-274 lists, and checks the tables it touches (note 23).

## Daily backup

`src/backups.js` is TASK-450 (SPEC-052, FL-011): the server backs up its store once a day, keeps each backup 30 days, retries a failed backup once within the hour and warns the owner when the retry failed too. It runs in the server, not as a request: the contract names no operation for it.

SPEC-052, FL-011 and the stage-08 screens left the rules below open: when the retry runs, what counts as a day's backup, a retry the server missed, what a failed rehearsal shows, and that the newest backup stays. The coordinator chose them for TASK-450, and the maintainer approved them through the delegate they named for checkpoints. The pull request records them with the options not taken.

- **When.** One backup a UTC day, at the time `NEXUS_BACKUP_TIME` gives. A server that starts after that time, on a day with no backup yet, backs up at once, so a restart after that time does not skip the day. The job looks at the clock at least once an hour, so it notices a clock that was set meanwhile.
- **What.** Each backup is a copy of the store made with `node:sqlite`'s own `backup()`, named by its day: `nexus-v3-backup-YYYY-MM-DD.sqlite` in the folder `NEXUS_BACKUP_DIR` names.
  - It is written as `<name>.partial`, readable by its owner only like the store, and renamed when it is whole. So a file with a backup's name is always a complete store, and a failed attempt leaves no file.
  - The copy runs as one task of the server's one write queue (see [Requests](#requests)). The store is one connection, which cannot copy itself while a write's transaction is open, so the writes wait for the copy while the reads go on.
- **The retry.** A first attempt that fails is retried once, under the same name, 15 minutes after it failed. A retry that would come after the next day's time is dropped, and that day's backup runs at its time instead, so no backup is named by a day it is not of. When the retry fails too, the owner's to-do and the project list show the warning (see [Projects and to-do](#projects-and-to-do)) until a backup succeeds.
- **After a crash.** At start, an attempt left running is recorded failed, and its partial file is removed. An attempt whose end the store could not record is recorded failed in the same way when the job next looks.
  - An attempt left running whose file has the backup's name is recorded succeeded instead, as of when the file was written: the partial file is renamed only once the copy is whole. A backup holds its own row as running, since the row is written before the copy, so a store restored from a backup records that backup as it was, and nothing runs over it.
  - A first attempt's retry then runs at once, even past the hour, and the warning shows only if that retry fails. A retry left running is the end, so the warning shows.
  - A retry that fell due while the server was stopped also runs at start, unless the next day's time has come; that day's backup then runs instead.
- **30 days.** After a backup succeeds, the backups whose day is more than 30 days before its day are removed. Of 31 daily backups, the next one removes the oldest, and 30 remain plus the new one.
  - A failure removes nothing for age. Only the disk rule below removes backups then, and never the newest that succeeded.
  - The backups are found by their files' names in the folder. So a backup the store holds no row of, as after a restore from an older backup, goes too.
  - A removed backup keeps its row, with the time its file was removed (TBL-170's `removed_at`).
  - A removal that fails leaves the backup that succeeded as it is, and the next success removes what is left.
- **Not enough disk.** Before an attempt, when the folder's free space is less than the store's size, the backups past 30 days are removed first, the oldest first, never a newer one and never the newest that succeeded. When the space is still short, the attempt fails without writing (`not_enough_disk`), so a backup never fills the disk.
- **The newest backup stays.** No removal takes the newest backup that succeeded, even past 30 days, so a restore stays possible while backups keep failing and the disk stays short. The order stays oldest first.
  - That backup is the latest row that succeeded whose file is in the folder.
  - The newest backup file by its day stays too, so no fresher backup the store does not record as succeeded is lost, as after a restore from an older backup.
- **Deleted projects.** A backup is a copy of the whole store, so a deleted project stays in the backups until they age out, or longer in the newest backup that stays while backups fail (see [Project removal](#project-removal)).

### The restore rehearsal

Before each release, the release step (TASK-464) rehearses a restore from the latest backup and records it (REQ-080, TBL-171):

```sh
cd server
NEXUS_DATA_DIR=/absolute/path/to/a/data/folder \
NEXUS_BACKUP_DIR=/absolute/path/to/a/backup/folder \
node src/rehearse.js <release>
```

`src/rehearsal.js` takes the latest backup that succeeded and whose file is kept, and copies it into a new folder that only its owner opens, made inside the backups' folder rather than a folder other users share. A folder that a rehearsal killed before its end left there, with its copy of the store, is removed first.
- It opens the copy as the server opens its store, which applies this code's migrations to the copy.
- It reads the copy: SQLite's integrity check, its foreign keys, and every row of every table.
- It removes the folder afterwards.

The result is recorded in the store as it is. The command neither creates the store nor applies a migration to it, so it can run beside a server whose code is older. A store that a newer server migrated is refused (`store_refused` with `newer_store`, exit 1), as the server refuses it. Its one line names no path.

- **It succeeded.** The row says `succeeded`, with a note of what was read. The line is `rehearsal_recorded`, and the command exits 0.
- **A check failed.** The row says `failed`, with a note naming the check and the kind of error, never a path. The checks are `copy`, `open`, `integrity`, `foreign_keys` and `read`. The command exits 1, so the release step stops. No screen shows it.
- **No backup to rehearse.** Nothing is recorded, since a rehearsal names its backup. The line `rehearsal_refused` says `no_backup`, and the command exits 1.
- **Called wrong.** The command exits 2 when a setting is missing or the release is missing. It also exits 2 when the release is not a name of up to 64 letters, digits, dots, pluses, hyphens and underscores that starts with a letter or a digit.

`test/backups.test.js` checks TASK-450's done condition with a clock of its own:
- 31 daily backups from 2026-10-24 to 2026-11-23, then the backup of 2026-11-24, which removes 2026-10-24 and leaves 2026-10-25 to 2026-11-24;
- a backup folder taken by a file, whose failed retry shows on the owner's to-do (API-263) until the next day's backup succeeds;
- the retry's time, the backup at start, a crash, the disk and the queue, a removal or a record that fails, and a backup with no row.

`test/rehearsal.test.js` restores the latest backup into a fresh store and reads it. It also records each failed check, records nothing without a backup, and runs the command as the release step will.

## App shell

TASK-454 (SPEC-048, SPEC-051) is the frame of the pages the owner opens. One page, the shell, serves every screen of the [sitemap](../docs/07-sitemap/nexus.yaml), and it reads the screen's data from the API once it runs. The shell draws each screen's title, place and shared states from API-262, API-263 and API-264. Each screen's own content comes from its own task, TASK-455 to TASK-462.

The header and its menu, the stage tabs, the stale rule and the 409 bar, an unknown `?d=` or `?thread=`, the theme, a 401, an unknown page address, pages served without admission with no placeholder text, and the label "내 차례 N개" are rules no approved document states. The coordinator chose them for TASK-454, and the maintainer approved them through the delegate they named for checkpoints on 2026-11-24.

### Addresses

| Address | Screen |
| --- | --- |
| `/` | SCR-142, 내 차례 |
| `/p` | SCR-143, the projects |
| `/p/{project}` | SCR-144, a project |
| `/p/{project}/{part}/{stage}` | SCR-145, the stage workbench, with `?d={diagram}` and `?thread={thread}`. `_` stands for the project as a whole |
| `/p/{project}/{part}/{stage}/changes` | SCR-146, the changes since the last confirmation, with `?d={diagram}` |

`parseAddress` in `web/address.js` reads these addresses for both the server and the page, so the two never disagree. A project or a part takes the form of the contract's `ProjectName` and `Part`, and the stage is one of the 13. Any other form names no screen. Any other path answers 404 with the shell, which says "없는 주소예요." with a link to 내 차례. The 404 page is the same shell bytes, so it never holds the path or the query. Every path under `/api` stays the API's, and an unknown one still answers the `not_found` Problem.

The page reads `?d=` and `?thread=` as given, and the screen decides what they name. An unknown or malformed `?d=` shows "NEXUS에 없는 다이어그램이에요." with 프로젝트로, and the stage tabs still open. API-264 lists at most 500 diagrams of a stage, so a `?d=` in its proper form that a stage listed to 500 leaves out is not called gone: the workbench's own read of the diagram (API-265) decides. A malformed `?thread=` reads as a thread that is gone: the panel shows "NEXUS에 더 이상 없는 댓글 스레드예요." with 새로 고침 to the diagram. A thread ID in its proper form goes to the workbench task.

### Parts

| File | What it does |
| --- | --- |
| `src/pages.js` | Answers a GET of a path outside `/api` (see [security](#security-of-the-pages)). `pages` of `createApp` turns it on, and `src/main.js` gives it. |
| `web/shell.html` | The one page, with the styles, `theme.js`, `main.js` and `<div id="app">`. |
| `web/theme.js` | A classic script that sets `data-theme` before the page is first drawn. It uses the theme stored in `localStorage` `nexus-theme`, or else follows the system. |
| `web/main.js` | Reads the address and starts the shell with its screen, or with the 404 screen. |
| `web/shell.js` | The shell: the header, the stage tabs, the shared states and the read time. |
| `web/screens.js` | The five screens, as below, and the 404 screen. |
| `web/todo.js` | SCR-142's body: the to-do, the backup warning and the empty state (see [Owner to-do screen](#owner-to-do-screen)). |
| `web/projects.js` | SCR-143's body: the projects and the agent credentials, with issuing and revoking (see [Projects screen](#projects-screen)). |
| `web/states.js` | The state of each answer (section 3 of [docs/08-screens](../docs/08-screens/README.md)), the read time, how long ago a time was, the gate's reload step and the theme. |
| `web/api.js` | `read(path)`, `write(method, path, body, key)` and `newRequestKey()`. A read is a GET; a write sends a JSON body, or none, with its request key. Each returns one outcome: a success, a Problem's status, code and traceId, the gate, or a failure. `probe(path)` reads the status of a page that an operation serves, such as the mockup page, and leaves its body unread. |
| `web/storage.js` | The browser storage the pages use, as below. |
| `web/dom.js` | Builds HTML elements (`h`) and SVG elements (`s`) from text only. |
| `web/stages.js` | The 13 stages, with their numbers and Korean names. |
| `web/project.js` | SCR-144's body: the stages, the tool links and the deletion of the space (see [Project screen](#project-screen)). |
| `web/korean.js` | `objectParticle(name)`: 을 or 를 after a project's name. |
| `/web/messages.js` | Made by the server as it starts, from `message_ko` of the error registry, so a refusal shows the contract's own words. |
| `web/tokens.css` | The tokens of [design/](../design/) as CSS custom properties: light on `:root`, dark on `[data-theme="dark"]`. |
| `web/fonts.css`, `web/fonts/` | The fonts, as below. |
| `web/nexus.css` | The components of the stage-09 mockup: header, tabs, panels, controls, tags, notices, skeletons, the board and the workbench. |
| `web/workbench.js`, `web/picture.js`, `web/relayout.js`, `web/overlays.js`, `web/mockup-frame.js` | SCR-145's pictures (see [Workbench pictures](#workbench-pictures)). |
| `web/changes.js` | SCR-145's changes: AI proposals, direct edits and what waits for reflection (see [Workbench changes](#workbench-changes)). |
| `/web/layout.js` | `src/layout.js`, served unchanged for the workbench. |

### How a screen plugs in

A screen is an object in `SCREENS` of `web/screens.js`, under its SCR ID. The shell runs it at each address for which `parseAddress` gives that ID.

- `layout`: `'list'` (one column) or `'workbench'` (the diagram's column beside the work panel).
- `tabs`: `true` to show the stage tabs.
- `states`: the screen's states beyond the shared ones. A 409 that leads to one of them shows it, and any other 409 is stale.
- `reads(address)`: the screen's API reads, as `{ name: path }`. The shell reads them and passes their bodies on as `data[name]`.
- `parts`: the names of the reads that fail in their own part of the screen, as SCR-143's two tables do. When one of them fails, `data[name]` keeps what it showed before, or is `null`, `shell.missed(name)` gives the failure, and the screen draws it in that part while the rest shows as usual. A failure of any other read shows the shared state, and a 401 or 403 is always the whole page's.
- `follow(ctx)`: optional, the reads that need what `reads` answered, as `{ name: path }`. They are made once every read has answered, and show with them as one load, such as the workbench's diagram (API-265), which API-264's list names.
- `fixedTitle`: the title before the data comes, or `null`.
- `title(ctx)`, `crumb(ctx)`, `description`: drawn once the data has come. Without `title`, the fixed title stays. `description` is a text, a node or a list of them, `{ text, mono }` for a text in code type, or a function of `ctx` giving one.
- `projectTitle(ctx)`: the project's title, for the header's menu button.
- `check(ctx)`: usually `null`. When the data shows that the address names nothing, it returns `{ code, sub, link, tabs }`.
- `gone(code, address)`: optional, what a read's 404 of that code says under it and links to, `{ sub, link }`, beyond the shell's own.
- `instead(ctx, gone)`: optional. After `shell.go` or `shell.reload('instead')`, what opens in place of a gone thing, `{ href, note }`, or `null`. The address replaces the one in the browser's history, and the next view gets the note as `ctx.note`.
- `skeleton(ctx)`: the shapes of the loading state.
- `render(ctx)`, `panel(ctx)`: the body and the work panel.

`ctx` is `{ address, data, shell, via, note }`. `via` says how the address was reached: `'open'` (the page opened, or Back or Forward), `'switch'` (`shell.go`) or `'instead'`. `shell` gives:
- `read`, `isPhone`
- `reload(how)`: reads the screen's data again. `reload('instead')` is a read again after which a gone thing opens what `instead` gives, as after `shell.go`; asked while a load runs, it waits for that load and keeps its mode. TASK-459 uses it after closing the last thread of a removed diagram.
- `write(method, path, body, key)`: a write of the screen's, whose outcome it returns. A 401 or 403 goes through the permission rule, as a read's does.
- `redraw()`: draws the screen again from the data it holds, without a read, when the screen's own state has changed, such as a write that runs.
- `missed(name)`: the failure of a part's read, or `null`.
- `probe(path)`: the status of a page that an operation serves, such as the mockup page, also through the permission rule.
- `go(href)`: opens another address of the same screen and place in this page, such as another diagram of the stage, and puts it in the browser's history. Any other address opens as a page of its own.
- `onLeave(keep)`: run before the page reloads through the gate.
- `keepDraft`, `draftOf`
- `message(code)`: the code's Korean message.
- `staleBar({ text, kept })`: the 409 bar, with 새로 고침.
- `errorNotice(outcome, retry)`
- `since(time, words)`: a time of the data as how long ago it was, such as "12분 전", in a `<time>` that holds the moment. `words` turns it into the screen's text, such as "12분 전에 보냄". It follows the shell's tick (see [Owner to-do screen](#owner-to-do-screen)).
- `outcome(answer)`: the answer of a screen's own read or write meets the shared states. A 401 goes through the gate, a 403 shows only its message, and a 404 of what the page shows, such as `project_not_found`, shows it gone; `outcome` then returns `null`. After gone the shell reads nothing more, so a load still under way cannot draw the page over it. Otherwise it returns `{ state, kind }` of `web/states.js`, for the screen to show where the write was sent.

A screen never draws the shared states itself.

### States

| Answer | What the page shows |
| --- | --- |
| Before the reads answer | The loading state: only the screen's skeleton and its fixed title, and no project data. |
| 401, or the gate's redirect | The page keeps unsent text (through each `onLeave`, in `sessionStorage`) and reloads once through the gate. If a 401 comes again before any read has succeeded, it shows "다시 로그인하세요." with 새로 고침 and reloads no more. A read that succeeds allows one reload again. So the page never loops through the gate. Where this tab's storage is blocked, the page cannot keep the mark of the reload, so it shows the message at once. |
| 403 `not_owner`, `owner_only` | Only the code's message, in place of the whole page. |
| 403 `cross_site` | The message with 새로 고침. |
| 404 `project_not_found` | "NEXUS에 없는 프로젝트예요." with 프로젝트 목록, on a read again too, in place of the old data. |
| 409 `document_changed` | The screen's `staleBar`: "문서가 바뀌었어요. 새 버전을 보세요." with 새로 고침. |
| 500, `default`, a network failure or a timeout | "문제가 생겼어요. 다시 해 보세요." with 다시 시도, and the request's traceId when it has one. |

Data that may be out of date is handled this way:
- The data stays on screen until a new read replaces it. A read again that answers what is shown leaves the view as it is, with what the owner typed, chose or scrolled to. One that answers something new draws the view again at the same scroll position, so a screen that holds typed text keeps it with `keepDraft` as the owner types and fills it back from `draftOf`.
- A load asked for while a read runs, such as `shell.reload()` after a write, waits for that read and then runs once, so no answer older than the request stays on screen. Its promise ends when that load has ended, so a screen that waits for it, as the workbench's changes do, sees the answer read again.
- The page reads again when the tab comes back into view. No timer reads again while the tab stays in view.
- Once the data is more than 5 minutes old, or a read again has failed, "HH:MM에 읽음" shows beside the title.
- A read again that fails keeps the data and shows the error notice above it.

The header holds:
- NEXUS, which goes to 내 차례.
- The project menu (API-262). It lists the projects, newest send first, and then 프로젝트 목록. Its button shows the current project's title.
- "내 차례 N" (API-263).
- The dark-screen switch.

When the first read of the menu or of the count fails, only that part stays out, and the rest of the page works. A read again that fails keeps what the header shows, as it keeps the screen's data. The theme follows the system until the switch is pressed; the choice is then kept on this browser.

### Phone

The page has three widths:
- Below 672 px, it follows the layout of the mockup's 360 px frames.
- Below 1056 px, the workbench's panel goes under the diagram.
- Below 1056 px with a coarse pointer, it is a phone (SPEC-051). `[data-pc-only]` is hidden, `[data-phone-only]` shows, and `shell.isPhone()` is true, so a screen offers no PC-only action.

### Tokens and fonts

`web/tokens.css` has one source, `design/tokens.resolver.json`. `tests/test_tokens_css.py` writes the file with the `tokens.py css` command of the pinned hub, and writes the dark theme with `--input theme=dark --selector '[data-theme="dark"]'`. It checks that the file equals what the command writes now, and that the token block of the stage-09 mockup equals the file. After the tokens change, set `CORTHEX_HUB_CHECKOUT` and run:

```sh
python tests/test_tokens_css.py --write
```

The fonts are IBM Plex Sans KR (release `@ibm/plex-sans-kr@1.1.0`) and IBM Plex Mono (`@ibm/plex-mono@2.5.0`). Each file is taken unchanged from IBM's Plex release on GitHub. Only woff2 at the two weights the tokens use, 400 and 600, is kept: 972,872 bytes in all. `web/fonts/fonts.json` records each release with its asset's SHA-256, and each file with its source, size and SHA-256. `LICENSE.txt` is the fonts' SIL Open Font License 1.1. `test/pages.test.js` checks the files against the record.

### Security of the pages

- **Admission.** The pages and their files are answered without admission, while the gate still stands in front of the whole site. None of them holds a project's data, a setting, a server address or anything read from the request. The page asks the API for its data, and every `/api` operation stays admitted. `test/pages.test.js` fetches each page and file without a sign-in, finds no project data in it, and finds that the API answers 401.
- **Headers.** Every page answer carries:
  - `Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; frame-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; require-trusted-types-for 'script'`. It loads nothing from another site and runs no inline script or style. Its one frame is the stage-09 mockup page (API-293), whose own answer makes it a sandbox with no NEXUS origin; a mockup that opens another site's page in its frame is refused.
  - `X-Content-Type-Options: nosniff`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`.
  - `Cache-Control: no-store`. The fonts are the one exception: their path names their release, so they get `private, max-age=31536000, immutable`.
- **Text only.** The scripts build every element from text (`textContent` and attribute values). They never parse markup and never touch an element's `style`; the project menu is placed by CSS alone, and a picture's boxes and lines by SVG attributes. A test checks the scripts for both.
- **Reads and writes.** The page reads and writes the API only:
  - from its own site, with its own cookies;
  - with `redirect: 'manual'`, so that the gate's redirect to its sign-in counts as a 401;
  - with `cache: 'no-store'` and a 30-second timeout;
  - for a write, with a JSON body or none and its request key in `Idempotency-Key` (see [Project screen](#project-screen)).
- **Browser storage.** The browser keeps three things, and never anything an API answered:
  - the theme, in `localStorage` `nexus-theme`;
  - this tab's unsent text, in `sessionStorage` under `nexus-draft:`;
  - the time of the reload through the gate, in `sessionStorage` `nexus-gate-reload`.

  A credential's secret is none of these. It stays in the page's memory and nowhere else (see [Projects screen](#projects-screen)).
- **Log.** A page request is logged like a path that names no operation, with the `action` `null`. No line holds the path.

`test/pages.test.js` tests the page layer. `test/shell.test.js` runs the shell on a small stand-in for the browser's DOM (`test/fake-dom.js`, run by `test/screen-page.js` for the shell's tests and the screens'), with stubbed answers and against the server, so that every response of API-262, API-263 and API-264 has a test of what the screen shows. The stand-in also plays a phone, a clipboard that allows or refuses, and the browser's history. These tests lay nothing out. The browser walk of the pull request shows each screen at 360 and 1440 px, in light and dark.

## Owner to-do screen

TASK-455 (SPEC-042, SPEC-010) is SCR-142, the page at `/`: what waits on the owner across every project, newest first. `web/todo.js` draws its body in the [app shell](#app-shell). It reads API-263 for the entries and the backup warning, and API-262 for the projects' titles and the empty state's list. The header reads the same two, so each is one request. When either read fails, the screen shows its error state, as SCR-142#error says.

- **Order.** The entries keep API-263's order (see [Projects and to-do](#projects-and-to-do)): projects by their newest entry, and each project's entries newest first. Every entry it answers shows, up to its 5000, with no "more".
- **Groups.** A group is headed by its project's title from API-262, or by its name when the list leaves it out, with 프로젝트 보기 to SCR-144.
- **Rows.** A row shows:
  - its kind as the mockup's tag: 확정, AI 제안 or 질문;
  - the stage and the diagram's name, such as "05 ERD · ERD";
  - for a confirmation, why it waits: "아직 확정한 적이 없어요", "새 문서로 확정이 풀렸어요" or "확정을 취소했어요";
  - how long it has waited.

  It opens SCR-145 at its diagram (`?d=`), and at its thread (`?thread=`) when it has one: a question, or a proposal on a thread. No ID shows (SPEC-010).
- **How long ago.** `ago` in `web/states.js` says it in local time:
  - "N분 전" under an hour, at least 1;
  - "N시간 전" under 24 hours;
  - "어제" on the local day before;
  - otherwise "N일 전" in local calendar days, so never "1일 전".

  `since(time, words)` in `web/shell.js`, given to a screen as `shell.since`, puts it in a `<time>` that holds the moment. It follows the shell's tick, every 30 seconds, and each read, a read again that leaves the view as it is included, so a list left open never keeps "12분 전" for hours.
- **The backup warning.** While API-263's `backup` is set, a warning shows on top, in the empty state too: "M월 D일 백업이 실패했어요." with the local date of `failed_at`, and "서버 기록을 확인하세요. 다음 백업이 성공하면 이 알림은 사라져요." The first read after a backup succeeds drops it. `last_succeeded_at` is not shown.
- **Nothing to do.** The screen says "기다리는 일이 없어요" with "에이전트가 확정할 그림이나 질문을 보내면 여기에 나와요." and lists the projects of API-262, each to SCR-144 with "13단계 중 N 통과 · 12분 전에 보냄". The day before reads "어제 보냄", and a space with no snapshot yet has no send time. With no project yet, it says "에이전트가 처음 보내면 여기에 나와요." with a link, 에이전트 자격, to SCR-143.

What API-263 does not carry does not show. The stage-09 mockup draws the element's name on a row's first line, a proposal's content or a question's text on its second, and how many places changed since a confirmation. The maintainer approved this difference from the mockup through the delegate they named for checkpoints on 2026-11-24, and section 4 of the [WBS](../docs/10-wbs/wbs.md) lists it; adding these fields to API-263 is a contract change left as a separate decision. These rules, and the words the screen definitions and the mockup do not give, were chosen by the coordinator for TASK-455, and the maintainer approved them through the delegate they named for checkpoints on 2026-11-24.

`test/todo-screen.test.js` checks each state of SCR-142 against stubbed answers and against the server, and every response API-263 lists. The browser walk of the pull request shows each state at 360 and 1440 px, in light and dark.

## Projects screen

TASK-456 (SPEC-015, SPEC-049, SPEC-050) is SCR-143, the page at `/p`: the project spaces the agents have sent, and the agent credentials, with issuing one, showing its secret once and revoking one. `web/projects.js` draws its body in the [app shell](#app-shell). It reads API-262 for the projects and API-279 for the credentials, issues with API-280 and revokes with API-281 (see [Agent credentials](#agent-credentials) and [Projects and to-do](#projects-and-to-do)).

- **Two parts.** Each read is a part of the screen (`parts`, see [How a screen plugs in](#how-a-screen-plugs-in)). When one fails, its own table says "프로젝트를 읽지 못했어요." or "에이전트 자격을 읽지 못했어요." with 다시 시도 and the request's traceId, and the other still shows (SCR-143#error). A read again that fails keeps what the part showed, adds the notice, and shows "HH:MM에 읽음" beside the title. A 401 or 403 still follows the shell's rule for the whole page.
- **Projects.** API-262's order, newest send first. Each row opens SCR-144 and shows:
  - the title, with the name in mono at 672 px and wider;
  - "13단계 중 N 통과" with a bar of 14 steps;
  - "할 일 N", blue when N is more than 0 and gray at 0;
  - "리비전 N · 12분 전", by `ago` in `web/states.js`, left out for a space that holds no snapshot yet.

  With no project, it says "아직 프로젝트가 없어요" with "에이전트가 처음 보내면 여기에 나와요. 아래에서 자격을 발급해 hub에 설정하고 --first로 보내세요." (SPEC-015).
- **Credentials.** API-279's order: the live ones first, each the newest first. The mockup's sample lists the live ones oldest first; section 4 of the [WBS](../docs/10-wbs/wbs.md) records this difference. Each row shows:
  - the name, in mono;
  - when it was issued, as "M월 D일";
  - when it was last used: how long ago for a live credential, the date for a revoked one, and "아직 안 씀" when it never was;
  - for a revoked one, dimmed, "폐기됨 M월 D일 HH:MM" at its end.

  With none, it says "아직 보낼 수 있는 에이전트가 없어요."
- **Issuing** (API-280). The name field sets no limit of its own, where the mockup's has `maxlength="64"`, which counts UTF-16 units and silently cuts a pasted name; section 4 of the [WBS](../docs/10-wbs/wbs.md) records this difference. The server refuses an empty name, one over 64 characters or one in use, and its message shows under the field, which is marked and keeps the name. A failure of the request, such as a timeout, shows its message there too, without marking the name. 발급 and every 폐기 are off while it runs, and 발급 is off while a revoke runs. The request key is kept only after a timeout or a lost connection, so 발급 again sends the same request; a changed name or any answer takes a new key. After a 201 the field empties, the list is read again and the secret shows.
- **The secret.** The 201 answer is the only place the secret ever is (see [Agent credentials](#agent-credentials)). The panel "새 자격 {name}", tagged red "지금만 보여요", says "비밀값은 지금만 보여요. 이 페이지를 떠나거나 새로 고치면 다시 볼 수 없어요." It shows the Client ID and the Client secret, each in a read-only field with 복사, and says where they go: the environment variables `CORTHEX_NEXUS_CLIENT_ID` and `CORTHEX_NEXUS_CLIENT_SECRET` of the device the hub runs on, never a file or a command line.
  - The page keeps the secret in its memory only, in `web/projects.js`'s state of the page, never in the shell's data. It shows until the page is left or reloaded, the gate's reload after a 401 included, until another credential is issued, or until this one is revoked here. No timer and no close button take it away.
  - It is never put in `localStorage`, `sessionStorage` or any other browser store, never written to the console or a log, and never put in an address. The page never asks for it again.
  - 복사 puts the value on the clipboard and says "복사했어요" beside that button until the next copy, as SCR-145 copies (SPEC-011). When the browser refuses, the field's text shows selected for the owner to copy.
  - A repeat, when a retry reaches a request that had issued the credential, answers 200 with `secret` null. The panel then shows its heading and the Client ID, and says "이 자격은 이미 발급됐어요. 비밀값은 처음 응답에만 있어서 다시 보여 줄 수 없어요. 이 자격을 폐기하고 새로 발급하세요."
- **Revoking** (API-281). 폐기 asks once, in its own row: "폐기할까요?" with 폐기 and 취소, and the focus goes to 취소. 취소 or Escape puts 폐기 back. While the revoke runs, the focus waits on the credentials' heading, and a refusal gives it back to the row's 폐기. Once the server answers, the list is read again and the row shows "폐기됨". A credential gone meanwhile says "NEXUS에 없는 자격 증명이에요." and the list is read again. Any other refusal shows the registry's message above the credentials, with the traceId. Each credential's request key follows the issue's rule.
- **Answers.** Both writes meet the shell's states through `shell.outcome`, as SCR-144's do (see [How a screen plugs in](#how-a-screen-plugs-in)): a 401 goes through the gate, and a 403 shows only its message. API-281's 404 stays in its row, since the page still shows the other credentials.
- **Phone.** A phone (SPEC-051) shows both lists to read, with "자격 발급과 폐기는 PC에서 하세요.", and neither the form nor 폐기. Below 672 px the tables are the mockup's cards. A narrow PC window keeps both actions.
- **After a deletion.** SCR-144 (TASK-457) opens this page at `/p?deleted={project}` once API-278 has deleted the space. When the name is in `ProjectName`'s form and API-262 no longer lists it, the page says "{project}를 지웠어요" on top once. It then puts `/p` back in the address with `history.replaceState`, so a reload does not say it again, and stores nothing. `objectParticle` in `web/korean.js`, which SCR-144 shares, chooses 을 or 를 (see [Project screen](#project-screen)).
- **Loading.** Grey rows for both tables, the credentials' heading, and the issue form off.

SCR-143 shows no backup warning. These rules, and the Korean words the screen definitions and the mockup do not give, were chosen by the coordinator for TASK-456, and the maintainer approved them through the delegate they named for checkpoints on 2026-11-24, each asked on its own.

`test/projects-screen.test.js` checks each state of SCR-143, the secret state included, against stubbed answers. Against the server, it checks what the page shows for every response API-262, API-279, API-280 and API-281 list, each answered by the server itself. The operations' own tests are in `test/owner.test.js` (API-262) and `test/credentials.test.js` (API-279, API-280 and API-281). The browser walk of the pull request shows each state at 360 and 1440 px, in light and dark.

## Workbench pictures

TASK-458 (SPEC-003 to SPEC-012, SPEC-027) draws SCR-145's pictures in the [app shell](#app-shell): the stage's diagrams, the chosen one drawn by its elements' names, choosing and copying an element, moving a box, and the stage-09 mockup page in a frame. TASK-459 to TASK-462 add the threads, the changes, the confirmations and the workshop to the same workbench.

| File | What it does |
| --- | --- |
| `web/workbench.js` | The workbench's body and panel: the stage's diagrams, the not-drawn notice, the picture and its legend, the Selected panel, copying and moving. `web/screens.js` runs it for SCR-145. |
| `web/picture.js` | Each kind of diagram drawn from API-265's elements. |
| `web/relayout.js` | Where each box and line is drawn once a box has moved. |
| `web/overlays.js` | What lies over a picture: AI proposals, change sets that wait for reflection, and the marks since the last confirmation. |
| `web/mockup-frame.js` | The stage-09 mockup page in its frame. |
| `/web/layout.js` | `src/layout.js`, served unchanged, so that the page lays out a moved box with the drawers' own layout. |

- **Reads.** The shell reads API-264, and then, as the screen's `follow`, API-265 for the diagram `?d=` names, or else for the stage's first diagram that is not removed. Both show as one load. A `?d=` that the stage's list leaves out is read only while the list is full at 500 (see [Addresses](#addresses)). The frame reads the mockup page's status itself (API-293), as below.
- **The stage's diagrams.** When a stage has several diagrams, or a removed one is still listed, they are listed above the picture in API-264's order, a removed one still listed last and tagged 지움 (SPEC-027; since the feature change of pull request 154, TASK-468 lists it while it has an open thread, a proposed AI proposal or a direct edit waiting for reflection). Choosing one opens it in this page: the address gains `?d=` with its ID and goes into the browser's history (`shell.go`), the loading state shows, and Back opens the one before. A click with a modifier key, or with a button other than the first, is left to the browser. A diagram gone meanwhile opens the stage's first diagram with "NEXUS에 없는 다이어그램이에요." above it, and that address replaces the chosen one in the history (`screen.instead`). Only the load the switch asked for does that: a read again later, such as after a write, shows the diagram gone. A switch made while another still reads shows only the last one chosen, since a load whose address changed meanwhile leaves its answers unshown. An address opened directly keeps the shell's rule.
- **Names, not IDs** (SPEC-010). Every box, label, panel, row and token shows its element's name, or its key when it has none. A trace ID shows only in the Selected panel, apart from the name. A name too long for its box wraps inside the box and ends with "…"; the whole name is the box's accessible name and stands in the Selected panel.
- **The kinds.**
  - The DDD board, the ERD, the sitemap and the user flows are SVG. Each box is an HTML button in a `foreignObject` at the place `web/relayout.js` gives it, so that its text wraps and it is chosen by pointer or keyboard. Each line is a path with its head, under a wider invisible path that is chosen too.
  - The board draws the stage-09 mockup's stickies, lanes and context frames, in the colours of its kinds. The ERD draws each table with its columns, their types and PK, FK and UQ. The sitemap draws each screen's name and path.
  - A user flow draws a start or an end as a rounded box, a step as a box and a decision as a diamond, whose lines end on its outline. It also draws shapes this repository's flows do not use: a document with a wavy foot, a store as a cylinder, and an LLM or grading step with a double border. A box marked `key` has a thick border and one marked `gap` a dashed border, with no words. A grading arrow is dashed, and a thick, write or read arrow is thick.
  - Stage 08 is the mockup's grid of state panels, each a button, which never moves. An item table is the mockup's table with 이름, 상태 and 링크, each row's name a button.
  - What a drawing leaves out is listed under the picture with its file and line (SPEC-003). A failed drawing shows "이 문서는 그려지지 않아요." with where it failed and "문서를 고쳐 다시 보내면 그림이 나와요." above the last good drawing (SCR-145#not-drawn).
- **Choosing and copying** (SPEC-011). Every element is chosen by pointer, or by Tab and Enter or Space: boxes, lines, lanes, context frames, state panels, rows and tokens. It shows as chosen, and the Selected panel shows its kind, its name and its IDs apart. Choosing does not draw the view again, so the mockup's frame keeps its page. With nothing chosen, the panel shows the whole diagram's threads (see [Workbench threads](#workbench-threads)). ID와 이름 복사 puts "ID name" on the clipboard, such as "CTX-037 Diagram", and shows 복사했어요; an element without a trace ID copies its name, or else its key. When the browser refuses, the text shows in a field, selected, to copy by hand. A phone copies too.
- **Moving** (SPEC-012, API-274). On a PC, a box of the board, the ERD, the sitemap or a user flow moves by dragging, once it is 3 pixels from where it started, or by the arrow keys, 8 pixels a step and 40 with Shift. Each drag or run of keys is sent as one move once it stops for 400 ms, with a new request key; a move made while one is sent goes after its answer. A drag the browser cancels puts the box back and sends nothing. A box answered while a read again replaced the diagram keeps its place in the diagram shown now. A phone (SPEC-051), a removed diagram (SPEC-027), a lane, a context frame, a line, a state panel, a row and a token take no move.
  - 200: the box stays at its place.
  - 404 `element_not_found`: "다이어그램에 더 이상 없는 요소예요." with 새로 고침, and the box goes back.
  - 404 for the project or the diagram: the box goes back, and the diagram is read again first (SCR-145#error). A removed one still listed opens for what waits on it, which takes no move (TASK-468); otherwise the shell says it is gone.
  - 401 and 403: the shell's permission rule, as for a read.
  - Any other answer: its message with 다시 시도. A retry after a timeout or a lost connection keeps the request key while the box is still at the place sent with it, since the same key with another body is refused; any other makes a new one.
- **Where a moved box is drawn** (`web/relayout.js`). No drawing reads a position (see [Moving an element](#moving-an-element)), so the page places each moved box itself, at the position API-265 answered or at the place of a move not yet answered.
  - The ERD, the sitemap and the user flows keep the other boxes clear. The page builds again the input their drawer gave `layout.js`, from the elements: the boxes in their order and the lines between them. It uses that input only when, with no position, `layout.js` gives back exactly the boxes, lines and labels drawn; this guard runs once for each drawing. The page then lays the picture out again with the moved boxes fixed, so that the other boxes keep clear of them and every line is routed again (see [Picture layout](#picture-layout)).
  - The DDD board draws each moved box over the others, since its stickies are placed in frames by layouts of their own. So does a picture whose input fails the guard, such as a flow with links it does not draw. Only the moved box's own lines are drawn again, straight to it.
- **Overlays** (note 24 of the WBS). `web/overlays.js` reads only API-265's Diagram and builds no screen, so that TASK-460 and TASK-461 use it as it is. `overlayModel(diagram)` gives, by element key, what lies over each element, and the boxes and lines change sets add. Only proposals still proposed and change sets accepted and not yet reflected lie over a picture. `proposalsOf`, `waitingOf` and `changesSince` give the lists the work panel shows. `markChips`, `overClasses`, `aiBadge`, `nameWith` and `ghostCap` give the marks, the classes, the AI badge, the name and the cap of a box or a row, as the stage-09 mockup draws them: a proposal dashed with the AI badge and the old name struck through, a change set that waits ringed with 반영 대기, and 더함 or 바뀜 since the confirmation. TASK-458 draws them with the pictures. TASK-460 draws the panel's proposals and what waits, with their buttons (see [Workbench changes](#workbench-changes)), and TASK-461 the rest of the confirmation.
- **The mockup frame** (SPEC-009, API-293). The frame first reads the page's status through `shell.probe`, which stops the transfer once the status came, since a page cannot read the status of a frame. Only a 200 opens the page, in an iframe with `sandbox="allow-scripts"` and nothing more, 640 pixels tall on a PC and 480 on a phone. A bar above it marks it as a mockup page and says that NEXUS never asks for a sign-in inside it. When the frame loads a second document, the mockup went to another page: the frame opens the mockup page again once and says that the mockup tried to open another page. The second time, it stops with "목업이 계속 다른 페이지를 열어요" and 다시 열기, which starts over. A 409 `not_drawn` shows the mockup's name and the code's message in place of the page; a 404 shows its message with 새로 고침, and any other failure its message with 다시 시도. The mockup's tokens are its elements, listed in the work panel, each with a swatch when its first value is a colour the browser reads that names nothing outside itself (no `url(`, `var(` or `env(`), drawn as an SVG fill. A mockup takes no AI proposals, as the panel says.
- **Scrolling.** The picture scrolls inside its box, at most 650 pixels tall. A picture opens at its top, scrolled across to its first box, and an ERD at its top-left corner. Drawing it again, as after a move, keeps the scroll.
- **Phone.** A phone shows the same pictures, chosen and copied, with no move and the note "옮기기, 이름 바꾸기, 잇기, 제안 답하기, 확정은 PC에서 하세요.", and lists a mockup's tokens under the picture.

These rules, and the Korean words that the screen definitions, the mockup, the sitemap and the error registry do not give, were chosen by the coordinator for TASK-458, and the maintainer approved them through the delegate they named for checkpoints on 2026-11-24, each asked on its own. The stage-08 correction of the action's name, at the end of the [screen states' README](../docs/08-screens/README.md), passed its own checkpoint on 2026-11-24. The full screen names in stage 08's list differ from the stage-09 mockup, and so did the text under stage 01's title until TASK-460 made it the mockup's again; section 4 of the [WBS](../docs/10-wbs/wbs.md) records them.

`test/workbench.test.js` checks the pictures against the stored drawings of this repository's documents, with stubbed answers, and against the server: names and not IDs on each kind, the board's boxes, lines and marks on the ERD and the sitemap, copying, choosing by keyboard, moving and its queue, a cancelled drag and the retry's key, the list and the switch, a switch made while another reads, the mockup frame, the overlays, and the guard and its fallback. It answers every response that API-264, API-265, API-274 and API-293 list. The browser walk of the pull request shows each state of SCR-145's picture area at 360 and 1440 px, in light and dark.

## Workbench threads

TASK-459 (SPEC-016, SPEC-017, SPEC-027, SPEC-028, SPEC-051) adds the threads to SCR-145's Selected section. The owner reads a thread (API-266), comments on the diagram, an element or a row (API-267), replies (API-268) and closes it (API-269), on a phone too (note 12 of the WBS). On a phone the section is the sheet under the picture.

| File | What it does |
| --- | --- |
| `web/threads.js` | The threads of the Selected section: the list, the thread shown, the reply and new-comment boxes, and their writes. `web/workbench.js` draws the section and puts these parts in it, so that TASK-460's parts of the panel sit beside them. |

- **The section.** With nothing chosen, the section says 그림 전체 and lists every thread of the diagram under "스레드 N · 댓글 M". Open ones come first, then closed ones, each newest first by its last activity. Each line says:
  - where its thread is: the element's name, 그림 전체, or "사라진 요소 X" for a thread whose element left the drawing (SPEC-027);
  - its state: 내 차례 or 에이전트 차례 while it is open, 닫힘 once closed, and 반영되어 닫힘 for a thread a reflection closed. API-265 gives no `closed_by`, so that last one shows once the thread is read;
  - how long ago it moved. No version shows.
- **Choosing.** Choosing a thread reads it (API-266) and shows it under the list. When its element is drawn, the element is chosen on the picture too. With an element or a row chosen, the section lists only that element's threads, those marked removed with its key included (SPEC-027), and shows the first open one, else the newest. 그림 전체 스레드 in the section's header, or Escape outside a field (on the picture, a mockup's token list or the section), chooses nothing again. When the focus was in the section, the list's first thread takes it.
- **A thread shown.** Each entry shows:
  - AI for the agent or 나 for the owner, with its time;
  - the quote it answers, above its text;
  - what to look at first, after "먼저 볼 것: ";
  - a decision's address as a link, only when it starts with `https://`, opening in a new tab with `rel="noopener noreferrer"`.

  `asks` is not shown, since the to-do tags the questions. Every text goes in as text.
- **Writing.** An open thread ends with 답글 쓰기 (the field "이 스레드에 남길 말" and 보내기) and 스레드 닫기, which asks nothing. The section ends with 댓글 쓰기, which always starts a new thread where the owner is: "이 요소에 남길 말" on an element, "이 행에 남길 말" on a row of an item table, and "이 그림에 남길 말" on the diagram as a whole.
  - An element or a row names the drawing shown, which is the last good one when the latest failed. The diagram as a whole names the latest drawing even when it failed, so the owner can say what to fix (see [Threads](#threads)).
  - A removed diagram (SPEC-027) and an element drawn as unreadable have no new-comment box. An unreadable one says "읽지 못한 항목이에요. 그림 전체에 댓글을 다세요.".
  - A new thread shows at once, waiting on the agent. A reply is added at the end.
- **Answers to the writes.**
  - An empty text: "댓글을 적어 주세요." by the box, and nothing is sent (SPEC-016).
  - 400, 413, and 409 `request_key_reused`: the message by the box, with "최대 4,000자" after it for `text_too_long` and `body_too_large`. The text stays. For a close, these show with 다시 시도.
  - 409 `thread_closed`: the 409 bar (`staleBar`) over the picture, with "닫힌 스레드예요. 새 댓글을 쓰세요.", "쓰던 댓글은 남아 있어요." and 새로 고침. The reply's text moves to the new-comment box of the same place: the thread's element when it is drawn readable, else the diagram. A removed diagram has no such box (SPEC-027), so there the thread stays as it is shown, the text in its reply box, until 새로 고침.
  - 404 for the project or the diagram: the diagram is read again first (SCR-145#error). Any other 404 (`element_not_found`, `drawing_not_found`, `thread_not_found`): its message with 새로 고침.
  - 401 and 403: the shell's permission rule.
  - Any other answer: its message with 다시 시도. A retry after a timeout or a lost connection keeps the request key while the text is the same.
- **The last thread of a removed diagram.** Closing it reads the diagram again with `shell.reload('instead')`. When nothing else keeps the diagram listed, API-264 no longer lists it. The stage's first diagram then opens with "NEXUS에 없는 다이어그램이에요." above it, its address replacing the removed one's in the history, as after a switch (`screen.instead`). With no other diagram, the stage shows its empty state. API-266 still answers the closed thread (see [Threads](#threads)).
- **`?thread=`.** The thread is read after the diagram and shown, with its element chosen. A thread of another diagram, or a 404, shows "NEXUS에 더 이상 없는 댓글 스레드예요." with 새로 고침, a link to the diagram without `?thread=`. Choosing another thread keeps the address.
- **Unsent text.** Each box's text is kept in this tab as it is typed (`shell.keepDraft`, under `nexus-draft:`; see [Security of the pages](#security-of-the-pages)). So it comes back after the gate, and it is forgotten once sent.
  - The key is `/p/{project} {diagram} {what}`, where `what` is `reply {thread}`, `comment diagram`, or `comment element` or `comment row` with an FNV-1a hash of the element's key. So the key holds the diagram's and a thread's IDs, as an address does, and no text of a document.
  - A box of an element chosen before the gate shows its text once the element is chosen again.
- **Phone** (SPEC-051). A phone reads, comments, replies and closes as a PC does.

These rules, and the Korean words that the screen definitions, the mockup and the error registry do not give, were chosen by the coordinator for TASK-459. The maintainer approved them through the delegate they named for checkpoints on 2026-11-24, each asked on its own.

`test/threads-screen.test.js` checks the section with stubbed answers and against the server. It covers the list, choosing and Escape, the entries and their links, replies, and new comments on an element, a row and the diagram at the drawing shown. It also covers an empty text, closing, a thread closed meanwhile (on a removed diagram too), a read again that draws the view anew during a write, the unsent text kept through the gate, a phone, `?thread=`, the last thread of a removed diagram, an unreadable element, the retry's key, and text that stays text. It answers every response that API-266, API-267, API-268 and API-269 list. The browser walk of the pull request shows the section at 360 and 1440 px, in light and dark.

## Workbench changes

TASK-460 (SPEC-019 to SPEC-023, SPEC-027) adds the changes to SCR-145's [workbench](#workbench-pictures): the AI proposals the owner accepts or rejects, the direct edits the owner makes by renaming and connecting, and what waits for reflection.

| File | What it does |
| --- | --- |
| `web/changes.js` | The line over the picture, the work panel's "AI 제안" and "이 그림" sections, and the Selected panel's name field, 잇기 and list. `web/workbench.js` calls it where its body, its panel, its Selected panel and its keys meet a change, and `web/picture.js` passes it a double click on an element. |

- **AI 제안** (SPEC-019, SPEC-020, API-270, API-271). On a PC, the work panel lists the proposals still proposed and those accepted and waiting, in API-265's order, with "답할 것 N" while any is to answer and "모두 처리함" when none is. A card shows its kind line, its change in bold and its reason under it.
  - The kind line is the words of its steps, in their order, each once, joined with " · ": an add whose key names a DDD kind is "{kind} 더하기", such as "이벤트 더하기"; any other add is "더하기", a rename "이름 바꾸기", a connection "잇기" and a removal "지우기". A proposal with no steps is "더하기" when it adds by trace ID, or else "바꾸기".
  - 수락 and 거절 each ask once in the card, "수락할까요?" or "거절할까요?" with the action and 취소, and Escape stops asking. Only the action sends, with the body `{}` and a new request key.
  - An accepted proposal stays in the list with "수락했어요. 에이전트가 문서에 넣으면 실선이 돼요." and 반영 대기 until it is reflected. A removed diagram's proposals show 거절 only (SPEC-027). A mockup has no section, since it takes no proposal.
- **What waits for reflection** (SCR-145#waiting, SPEC-022, SPEC-023, API-273). While API-265 lists an accepted change set, the work panel's "이 그림" section shows "반영 대기 N", "반영을 기다리는 변경을 먼저 반영하거나 취소하세요. 에이전트가 문서에 넣으면 이 표시가 사라져요.", the list of what waits, newest accepted first, and "이 그림 확정" turned off.
  - A row is a direct rename's new name over "이름 바꾸기 · {old name}에서", a direct connection's "{from} → {to}" over 잇기, or an accepted proposal's change over "AI 제안 수락". A direct edit has 편집 취소 on a PC.
  - When nothing waits, the section shows the diagram's confirmation instead (see [Workbench confirmations](#workbench-confirmations)).
  - On a removed diagram the section holds the tag and the list only, in the confirm button's place (note 8 of the WBS).
- **The Selected panel's list** (SPEC-022). The chosen element's change sets that wait are listed under 반영 대기, newest on top, as rows of the list above. A connection is listed on both its ends, though the picture marks the end it starts from.
- **Renaming** (SPEC-021, API-272). On a PC, on a diagram not removed, the Selected panel shows the name of an element the server renames in a field labelled "이름 · 두 번 누르거나 F2", holding the name shown on top.
  - A double click or F2 on an element chooses it and focuses the field, its text selected. Enter sends a name that differs from the one shown, as `{ drawing, op: "rename", element, name }`. Escape, or leaving the field without Enter, puts the name back and sends nothing; Escape also gives the focus back to the element.
  - The Hotspots lane, an ERD or sitemap line, an element drawn unreadable, missing or left out, and a mockup token keep their name as text, as the server's [direct edits](#direct-edits) take no rename of them.
  - A refused name (400 `invalid_request`, 413 `text_too_long`, 409 `request_key_reused`) shows its message under the field, the name kept as typed until Escape or a send.
- **Connecting** (SPEC-021, API-272). On a PC, on a diagram not removed, an element of a kind the server joins (an ERD table, a sitemap screen, a user flow's boxes, a DDD context or external system, an item row) has 잇기 in the Selected panel.
  - 잇기 shows "이을 요소를 고르세요." with 취소 over the picture, and the next element chosen, by pointer, Enter or Space, is the other end: `{ drawing, op: "connect", element, target }` is sent. Choosing the element itself, or one of a kind not joined, does nothing. 취소, 잇기 again or Escape stops; that Escape does not also choose nothing again. 그림 전체 스레드, or a thread that chooses its element (see [Workbench threads](#workbench-threads)), stops it too, so choosing a thread never sends a connection.
  - A 200, for a connection that exists, says "이미 이어져 있어요.", and nothing new waits.
- **The drawing named.** A direct edit names the drawing shown: the current one, or the last good one when the current one failed (SCR-145#not-drawn).
- **Answers.** Every change's button is off while one is sent.
  - 200 or 201: the diagram is read again (`shell.reload`), and the element changed, or else the "AI 제안" heading, takes the focus.
  - 409 `change_set_state` or `document_changed`: the line over the picture says what changed, with 새로 고침, and a refused 수락 adds "새 제안을 부탁하세요." (SCR-145#stale).
  - 404 for a change set, an element or a drawing: its message with 새로 고침. 404 for the project or the diagram: the diagram is read again first, as for a move, so a removed one still listed opens for what waits on it (TASK-468).
  - 401 and 403: the shell's permission rule, as for a read.
  - 400 or 413 other than a refused name, such as a connection the sitemap's tree refuses: its message, with no 다시 시도, since the same request gets the same answer.
  - Any other answer: its message with 다시 시도. A retry after a timeout or a lost connection sends the same request with the same request key; any other makes a new one.
- **Phone** (SPEC-051). A phone shows the marks, the "이 그림" section's reason and list and the Selected panel's list, without a button, and no "AI 제안" section, name field, 잇기, 편집 취소 or question.
- **Stage 01's text.** Under stage 01's title on a PC, the screen says the stage-09 mockup's text again: "Git 문서에서 그린 그림이에요. 끌어 옮기고, 두 번 눌러 이름을 바꿔 보세요. 키보드로는 화살표로 옮기고 F2로 이름을 바꿔요." (section 4 of the [WBS](../docs/10-wbs/wbs.md)).
- **State.** What the page keeps, such as a question asked, a name typed or the end chosen first, lives in the workbench's state of the diagram shown, never in the browser's storage. A new read of the diagram clears the question and what the line said.

These rules, and the Korean words that the screen definitions, the mockup, the sitemap and the error registry do not give, were chosen by the coordinator for TASK-460. The maintainer approved them through the delegate they named for checkpoints on 2026-11-24, each asked on its own. SCR-145 also said that a proposal shows the other way, which the contract does not carry: a change set holds only its reason and its change, so an agent writes any other way inside its reason. The page shows no other way, and the same pull request drops it from SCR-145 and from the stage-09 mockup's copy; that correction passed its own checkpoints of stages 08 and 09 on 2026-11-24 through the same delegate.

`test/workbench-changes.test.js` checks the changes with stubbed answers and against the server: the kind line, the two sections, asking once, the waiting state, 편집 취소, the Selected panel's list, renaming by F2, a double click, Escape, leaving the field and Enter, a refused name, a failed drawing, connecting, a lost connection's request key, the stale line, a removed diagram, a phone and stage 01's text. It answers every response that API-270, API-271, API-272 and API-273 list. The browser walk of the pull request shows SCR-145's changes at 360 and 1440 px, in light and dark.

## Workbench confirmations

TASK-461 (SPEC-023, SPEC-029, SPEC-030, SPEC-034) adds confirming a diagram to SCR-145's [workbench](#workbench-pictures), and builds SCR-146, the changes since the last confirmation.

| File | What it does |
| --- | --- |
| `web/confirm.js` | The words, the state of the latest confirmation API-265 gives, the elements changed since it, and the link to the confirmed version. It reads and writes nothing itself. |
| `web/changes.js` | Beside [Workbench changes](#workbench-changes), the rest of the work panel's "이 그림" section, 이 그림 확정 with its question, and 확정 취소 (API-275, API-276). |
| `web/changes-page.js` | SCR-146's body, its loading state and its title's tag. It draws through `web/changes.js`, so the two screens share the line of answers, the waiting rows, 편집 취소 and 이 그림 확정. |

- **"이 그림"** (SCR-145#normal, SPEC-034). On a PC, while nothing waits, the section shows the state of the latest confirmation that API-265 gives:
  - never confirmed: "확정 전", "아직 확정한 적이 없어서 바뀐 곳 표시가 없어요.", "남은 AI 제안은 확정에 들어가지 않아요." and 이 그림 확정;
  - ended because the document changed (invalidated): "바뀐 곳 N" and "확정한 뒤 바뀐 곳이 N개 있어요. 다시 확정하면 에이전트가 기록해요.", then up to four changed elements, 더함 first, then 바뀜, then 뺌 by key. "+N개 더 · 바뀐 곳 모두 보기" leads to SCR-146 when there are more than four. The note and 이 그림 확정 follow. With no element changed, "확정 전" shows alone with the note and the button;
  - cancelled: "확정 전", "확정을 취소했어요. 다시 확정할 때까지 할 일에 남아요.", the elements changed since, the note and 이 그림 확정;
  - confirmed (SCR-145#confirmed): "확정함", "이 버전으로 확정했어요. 에이전트가 기록하면 단계가 통과돼요." and 확정 취소. Under the message, in small text, "기록되면 여기에 그 PR이 나와요." until the agent records it, and then "기록됨 · {how long ago} · PR #{number} ↗" ([The record's pull request on a confirmation](#the-records-pull-request-on-a-confirmation));
  - not drawn (SCR-145#not-drawn): "그려지지 않음", "문서를 고쳐 그려지게 한 뒤 확정하세요." and the button off. A live confirmation keeps its line and 확정 취소.
  - While something waits, the section keeps the waiting state of [Workbench changes](#workbench-changes). A live confirmation then adds "확정함" beside "반영 대기 N", its line before the list, and 확정 취소 in the off button's place.
  - A removed diagram has no confirmation part: neither 이 그림 확정 nor 확정 취소 (SPEC-027).
  - A mockup lists its tokens in the section, above the button, without the note on AI proposals.
- **이 그림 확정** (API-275, SPEC-029) asks once: the button becomes "확정할까요?" with 확정 and 취소, and Escape stops asking. 확정 sends `{ drawing }`, naming the drawing shown, with a new request key. Every button stays off until the diagram is read again, and then "이 그림" takes the focus. A 409 `waiting_reflection` or `not_drawn` reads the diagram again, which shows why (SCR-145#waiting, SCR-145#not-drawn).
- **확정 취소** (API-276, SPEC-030) sends `{}` at once, without a question.
- **Answers** are met as in [Workbench changes](#workbench-changes):
  - `document_changed` is the stale line with 새로 고침;
  - a drawing or a confirmation that is gone says so with 새로 고침;
  - a project or a diagram that is gone reads the diagram again first;
  - 400 and 413 show their message without 다시 시도;
  - any other answer shows its message with 다시 시도, and a retry after a lost connection keeps the request key.
- **Loading and empty panels.** While SCR-145 loads, its work panel keeps its sections' titles, "이 그림", "AI 제안" and "고른 요소", with grey shapes where their contents come. A phone keeps "고른 요소" only. With nothing sent for the stage, a PC's panel says "확정할 그림이 아직 없어요." and "모두 처리함". The shell draws a screen's `panelSkeleton` for this.
- **SCR-146** (`/p/{project}/{part}/{stage}/changes`, `?d=`) reads the diagram the workbench opens (API-265):
  - Its title holds "N개" while any element changed.
  - "확정한 버전의 문서 ↗ {the commit's first seven characters} · {M월 D일} 확정" leads to `{repository}/tree/{commit}` in a new tab, with `rel="noopener noreferrer"`, only when API-264's repository is an https address. The repository's address loses its trailing slashes and `.git`, as a pull request's link does. Otherwise it is text.
  - "반영을 기다리는 변경" with "반영 대기 N" comes first and lists every change set that waits, each direct edit with 편집 취소 on a PC (API-273).
  - "바뀐 요소" lists each element added, changed or removed since. A row has its tag, its name in the drawing now (its key once removed), and its kind. With no confirmation the page says "아직 확정하지 않아 비교할 버전이 없어요.", and with nothing changed "확정한 뒤 바뀐 곳이 없어요." (SCR-146#empty).
  - When the document does not draw, "문서를 고쳐 그려지게 한 뒤 확정하세요." shows with 그림에서 보기 (SCR-146#not-drawn).
  - The end holds 이 그림 확정 on a PC, for a diagram not removed and not confirmed now. It is off while something waits, with "반영을 기다리는 변경을 먼저 반영하거나 취소하세요.", or while the document does not draw. 그림으로 follows.
  - After this page's own confirm: "이 버전으로 확정했어요. 에이전트가 기록하면 단계가 통과돼요.", "확정한 뒤 바뀐 곳이 없어요." and 그림으로 (SCR-146#confirmed).
  - While it loads: three grey rows and, on a PC, the button off.
- **Phone** (SPEC-051). "이 그림" shows only what waits and a live confirmation with its lines, without buttons. SCR-146 shows its lists only, with "편집 취소와 확정은 PC에서 하세요.".
- **State.** The question asked and the confirmation this page made live in the screen's state of the diagram shown, never in the browser's storage.

The coordinator chose these rules for TASK-461, and the Korean words that the screen definitions, the mockup, the sitemap and the error registry do not give. The maintainer approved them through the delegate they named for checkpoints on 2026-11-24, each asked on its own. Two of them differed from the approved screen definitions and were asked apart:
- SCR-145#confirmed showed "기록됨" without the record's pull request, which API-265's confirmation did not carry then. SCR-145 stayed as approved, and TASK-469 was added to the WBS: its stage-06 correction gives API-265's confirmation the record's pull request, and "이 그림" now shows it beside 기록됨 ([The record's pull request on a confirmation](#the-records-pull-request-on-a-confirmation)).
- SCR-146#waiting lists every change set that waits, accepted AI proposals included, under "반영을 기다리는 변경". The screens README's "Every change set waiting for reflection" changed SCR-146 to match, which passed its own checkpoint on 2026-11-24 through the same delegate.

`test/confirm.test.js` checks both screens with stubbed answers and against the server:
- each state of "이 그림", asking once, 확정 취소 and a refused confirm read again;
- the loading and empty panels;
- each state of SCR-146 at both widths.

It answers every response that API-275 lists on both screens, API-276 on SCR-145 and API-273 on SCR-146; `test/workbench-changes.test.js` answers API-273 on SCR-145. The browser walk of the pull request shows both screens at 360 and 1440 px, in light and dark.

## The record's pull request on a confirmation

TASK-469 (SPEC-029, SPEC-031, SPEC-035) gives a confirmation the pull request of its record, and SCR-145's "이 그림" shows it once the agent records the confirmation (SCR-145#confirmed).

- **The contract.** The stage-06 README's "The record's pull request on a confirmation" adds `pull_request` to `Confirmation`, a link or null. It is the pull request of the record that is due, or of the last one recorded, as [Reports](#reports) set it in `record_pull_request_id` (TBL-160):
  - The record that is due is the confirmation's own until it is recorded, then, once a recorded confirmation is cancelled, the cancel's.
  - While one is due, it is that record's open pull request, or null before the agent reports one and after it closed without merging. Once one is recorded, it is the pull request that recorded it.
  - It is null while the project names no repository.
- **The server.** `src/confirmations.js` reads a confirmation with the number of its record's pull request (TBL-157), and `confirmationBody` builds the link with `src/claims.js`'s `pullRequestLink`, as the diagram read builds an overlay's. It names a linked pull request only as the contract defines the field: an open one while a record is due, and once none is due, a merged one only when the record it stands for was made, the confirmation's own (`recorded_at`) or, once cancelled, the cancel's (`cancel_recorded_at`). So it gives null for the pull request that recorded the confirmation while the cancel is due; for one that merged as another confirmation's record, since one pull request can hold several, while this one's record is still due or after this one was cancelled before its own; and for the open one of a confirmation cancelled before it was recorded, whose record is withdrawn and on which API-259 takes no `opened` or `closed` report. The diagram read (API-265, `src/diagram.js`) reads the latest confirmation through the same query. Confirming (API-275) and cancelling (API-276) answer the same `Confirmation`, so both now read TBL-157 and list it. Nothing more is written, and nothing is logged.
- **The screen** (`web/changes.js`, `web/confirm.js`). Under "이 버전으로 확정했어요. 에이전트가 기록하면 단계가 통과돼요.", in small text:
  - until the agent records the confirmation, the mockup's "기록되면 여기에 그 PR이 나와요.", also while the record's pull request is open, which is not shown;
  - once it is recorded, "기록됨 · {how long ago} · PR #{number} ↗". "PR #{number} ↗" is a link to the pull request in a new tab, with `rel="noopener noreferrer"`, only for an https link of a pull request; the number is taken from its `/pull/{number}`. Otherwise "기록됨 · {how long ago}" stands alone.
  - In "이 그림", the lines follow the message wherever a live confirmation shows it: while something waits, when the document does not draw, and on a phone, without 확정 취소. SCR-146's note after its own confirm (SCR-146#confirmed) stays the message alone, as SCR-146 defines it.

The coordinator chose the two screen rules for TASK-469, and the words "PR #{number} ↗", which no approved document gives. The maintainer approved them through the delegate they named for checkpoints on 2026-11-24, each asked on its own. The stage-06 correction passed its own checkpoint before the code, on 2026-11-24 through the same delegate.

`test/diagram.test.js` checks API-265's field: null before a report, the open pull request, null after it closed, the one that recorded it, null once cancelled until the cancel's is reported, the cancel's open and merged, null after the cancel's closed, null for a confirmation cancelled before it was recorded, and null without a repository. Through API-275, API-259 and API-276 it also checks one pull request reported for two confirmations: when it merges as one's record, the other names it only once it is reported merged for that one too, and never when that one was cancelled before its record. `test/confirmations.test.js` checks the answers of API-275 and API-276 against the diagram read, the shared pull request included. `test/confirm.test.js` checks the two cases on a PC and a phone, and that only an https link of a pull request is a link. The browser walk of the pull request shows them at 360 and 1440 px, in light and dark.

## Workshop board

TASK-462 (SPEC-036 to SPEC-041, SPEC-051) draws SCR-145's workshop state on stage 01 of the [workbench](#workbench-pictures): the owner's event storming on the board that the [workshop](#workshop) (TASK-452) and the [Miro import](#miro-import) (TASK-453) keep, with API-284 to API-292.

| File | What it does |
| --- | --- |
| `web/workshop.js` | The workshop's title, step strip, frames, legend and panel, its writes, and 워크숍 열기. `web/screens.js` runs it for SCR-145 on stage 01. |

It plugs into the shell and the workbench in three small places, which TASK-459 and TASK-460 keep beside their own parts: a screen's `titleTags` and `titleActions`, which add tags and buttons to the title (`web/shell.js`); `raw` on `write` (`web/api.js`), which sends a text body as it is; and the entry 워크숍 at the head of the stage's diagram list (`web/workbench.js`).

- **Reads.** On stage 01 with no `?d=` or `?thread=`, while API-264 gives the project's workshop open, the screen's `follow` reads API-285 in place of API-265. The title is "워크숍 · 스텝 N 이름" with the tag 열림, and under it "워크숍이 열려 있는 동안은 이 보드가 원본이에요." A workshop that API-285 answers closed or not found, as when it closed between the two reads, shows "워크숍이 닫혀 있어요." with 새로 고침, and the stage's diagrams.
- **The drawn board stays reachable.** The workshop is what stage 01 shows first, as the sitemap says, and the drawn DDD board stays in the stage's diagram list after the entry 워크숍. `?d=` or `?thread=` opens it with its threads and proposals, as the to-do's links do, and 워크숍 in its list opens the workshop again. This goes beyond the sitemap's sentence only in keeping the drawn board reachable: nothing on the screen closes an unfinished workshop, so hiding the board would hide its open threads and proposals for as long as the workshop stays open.
- **Opening** (API-284). With no workshop open, stage 01 offers 워크숍 열기 on a PC, above the drawn board or the empty state. It asks once, in the page: "워크숍을 열까요? 11개 스텝을 모두 확정하고 에이전트가 도메인 문서에 쓸 때까지 열려 있어요." with 워크숍 열기 and 취소. A 201, or a 409 `workshop_open` for a workshop opened meanwhile, opens the workshop at step 0; from a `?d=` or `?thread=` address it goes to the stage's own address. An input refusal shows under the question; any other closes it and shows its message with 다시 시도. Nothing on the screen closes an unfinished workshop.
- **The strip and the frames.** The strip has the 11 steps in the mockup's words, a confirmed step marked done and the chosen one marked on. The chosen step starts as the first step not confirmed, or step 0, and is not kept in the address. The board shows the chosen step's frame and the next step's, each tagged 확정함, 확정 전 or 비어 있음; an empty frame says "확정하기 전에 스티커를 붙이세요." Under the title, step 3 has the mockup's two sentences and every other step the second only.
- **Notes and kinds.** Each note is drawn where it was put, 148 by 80 pixels, with its kind's word and, for an agent's draft, its confidence (확실, 추론, 추측), in the colour of its kind's `--corthex-sticky-<kind>` token. The kind `note`, which a Miro note whose colour names no kind gets, shows uncoloured as 기타, and a kind no token colours shows uncoloured under its own name. A link between two notes of a frame is drawn as an arrow. The legend is the mockup's six kinds and its confidence line; actor and external system have no legend line, and a note says 액터 and 외부 시스템, as the strip does.
- **Adding** (API-286). 스티커 더하기 opens the panel's form of that name: 종류, a choice of the eight token kinds, and 이름, up to 200 characters, with 더하기 and 취소. The kind starts as the one the chosen step introduces (1 event, 2 external system, 3 command, 4 hotspot, 5 actor, 6 aggregate, 8 policy, otherwise event). The note goes to the first place of TASK-452's grid (5 columns 160 pixels apart, rows 120 apart) that no note of the frame holds, and becomes the chosen note.
- **Moving** (API-287). On a PC a note moves by dragging, once it is 3 pixels from where it started, or by the arrow keys, 8 pixels a step and 40 with Shift. Each move is sent as `{ x, y }` once it stops for 400 ms, with a new request key; a move made while one is sent goes after its answer. A note stays in its step: there is no snapping, lane or row, and a frame grows with its notes.
- **The chosen note** (API-287, API-288). Choosing a note shows 고른 스티커 in the panel, with 이름, 잇기 and 이 스티커 떼기. Enter sends the name when it differs; Escape, or leaving the field without Enter, puts the name back and sends nothing, as TASK-460's name field does. 이 스티커 떼기 removes the note at once, with its links.
- **Linking** (API-289, API-290). 잇기 shows "이을 스티커를 고르세요." with 취소 over the board, and the next note chosen is linked from the chosen one; Escape or 취소 stops. 이어진 스티커 lists the chosen note's links, → to a note and ← from one, each with 연결 떼기.
- **Confirming** (API-291). The panel's step section says "스티커 N개 · AI 초안 M개", M being the notes still the agent's, with "확정하면 에이전트가 이 스텝을 도메인 문서에 써요." and 스텝 N 확정. An empty step's button is off, and a 409 `step_empty` shows its message under the button. A confirmed step shows 확정함 and no button.
- **Import** (API-292). Miro에서 가져오기 chooses a `.json` file. A file over 5 MiB is refused in the page with the 413's message and is not sent. Any other goes up as it is, as the request's body with a new request key, and only the server reads it. A 201 says "스티커 N개와 연결 M개를 가져왔어요." over the board and reads the workshop again; a 400 or a 413 shows only its code's message there.
- **Answers.** Every write goes through `shell.write` with a request key, kept for a retry with the same input only after a timeout or a lost connection. 401 and 403 take the shell's permission rule. A 404 `project_not_found` shows the project gone; a 404 for a note, a link or a step shows its message and reads the workshop again. A 409 `workshop_closed` shows "워크숍이 닫혀 있어요." with 새로 고침 and keeps what was typed. A 400, a 413 or a reused request key shows its message by the action's field, or over the board for an action with none. A 415, any other answer and a failure show the error notice with 다시 시도.
- **Drafts.** A new note's name and a rename not yet sent go into this tab's storage only when the page goes through the gate, and come back with the page (SPEC-048).
- **Phone** (SPEC-051). A phone shows the strip, the frames and the legend with "휴대폰에서는 보드를 읽기만 해요. 스티커와 스텝 확정은 PC에서 하세요." Its notes are not buttons, and it has no panel, no title button and no 워크숍 열기.

These rules, and the Korean words that SCR-145, the mockup, the sitemap and the error registry do not give, were chosen by the coordinator for TASK-462. The maintainer approved them through the delegate they named for checkpoints on 2026-11-24, each asked on its own, with the drawn board kept reachable while a workshop is open as a rule of this screen. SCR-145#workshop had "free sticky notes in the six kinds"; the add form offers all eight token kinds, since steps 2 and 5 start with the external-system and actor kinds, and the screens README's "The workshop's eight sticky kinds" changed SCR-145 to match, which passed its own checkpoint on 2026-11-24 through the same delegate.

`test/workshop-screen.test.js` checks the board with stubbed answers: the first view, step 3 as the mockup draws it, the kinds and their classes, adding, moving by keys and by dragging, the rename rule, removing and linking, confirming, the import and its size limit, the phone, the drawn board by `?d=` and `?thread=`, 워크숍 열기, a closed workshop and a rename kept through the gate. Against the server, it answers every response that API-284 to API-292 list. The browser walk of the pull request shows the board at 360 and 1440 px, in light and dark.

## Proposals

`src/proposals.js` is TASK-438: an agent posts a proposal, a change set laid over a drawn picture, and withdraws it while it is still proposed (API-256, `POST /api/spaces/{project}/proposals`, and API-257, `POST /api/spaces/{project}/proposals/{proposal}/withdraw`; SPEC-014, SPEC-018, SPEC-027). Both are agent operations with a JSON body and a request key (rule 3), and both need `Nexus-Session`, since each may write on a claimed entry. The owner's sign-in gets `agent_only`: the owner edits directly instead.

The coordinator chose four rules for TASK-438, below, that no approved document states: how `source_text` becomes changes, what a proposal writes in its thread, that a removed diagram takes no proposal (note 6 of the WBS), and the exception to `document_changed` for a commit at which the diagram showed the same drawing. The maintainer approved them through the delegate they named for checkpoints on 2026-11-24. The contract's text stays as it is; the exception is how this server reads "the current drawing's commit". TASK-466 adds the reading of a proposal's SQL and YAML on stage 05 and 07, and TASK-470 the reading of its Markdown on stage 01 and the `source_path` that names the file a text stands for ([Reading Markdown, SQL and YAML](#reading-markdown-sql-and-yaml)); the rules the coordinator chose for them, which no approved document states, were approved through the same delegate on 2026-11-24.

- **A proposal** is a row of TBL-158 `change_sets` of origin `proposal`, state `proposed`, against the current drawing of one diagram, with the agent's credential and its thread. Its steps are rows of TBL-159 `changes` in order, written by `writeSteps` in `src/changes.js` (see [Direct edits](#direct-edits)). TBL-158's `detail` keeps the request under ProposalRequest's own names, `items`, `adds`, `reason`, `change` and `source_text`, as [Agent reads](#agent-reads) says, so API-247, API-265 and `heldChangeSets` read it as they read any change set. The answer is the contract's ChangeSet, made by `changeSetOf` in `src/reads.js`, which API-247 answers too.
- **Which stage.** Only a drawn picture of stage 01, 03, 05, 07 or 08 takes a proposal (the contract's ProposalStage). Stage 09 and any other stage get `invalid_request` on `stage`: the mockup page takes no overlay, and an agent comments instead. A named item table, a diagram that never drew, and a stage and part with no drawn picture get `not_drawn`.
- **Which diagram.** It is the comment's thread's diagram, the one `diagram` names, or the one drawn picture of the stage and part that holds every item.
  - An item is held by an element of the diagram's current drawing with that trace ID. An element drawn as unreadable holds none, since it counts as gone (SPEC-027), as in [After a drawing](#after-a-drawing). When no element of the stage's drawings holds it, it is held by the file diagram it names, as a comment's item is (see [Comments](#comments)). The proposal then lays over that diagram as a whole: its items keep the ID and mark no element. With `source_text`, its changes are the whole file's differences.
  - Items that no diagram holds get `item_not_found`, naming each of them. Items that no single diagram holds all of, or that several hold, get `diagram_ambiguous`, naming those diagrams in the stage's order.
  - With `diagram`, the diagram must be of the request's stage and part and not removed, and it must hold every item; otherwise `diagram_not_found` or `item_not_found`.
  - **A removed diagram takes no proposal** (SPEC-027, note 6). Named by `diagram`, or reached through the comment's thread, it gets `diagram_not_found`. A removed diagram is none of its stage's diagrams, so an item only it held gets `item_not_found`. Its open threads still take replies (API-253), but no proposal.
  - A part the project does not declare gets `part_not_found`, and a `discrepancy` gets `discrepancy_not_found`, as for a comment.
- **The drawing and `commit`.** The proposal is against the diagram's current drawing, its last drawn one (SPEC-001). A `commit` other than that drawing's version gets `document_changed`, naming the drawing and its version (SPEC-018: "draw against the current version"). There is one exception: NEXUS holds the commit, and the diagram showed that same drawing at it. A push that left the diagram unchanged did not change its document, so a proposal made at the latest commit is not refused.
- **Changes from `source_text`** on stage 01, 03, 05, 07 or 08. On 03 and 08, whose diagram is one file, NEXUS draws the text with that diagram's own drawer, as the file at the diagram's path, with the checks a push's drawing gets (`drawProposed` in `src/drawing.js`); a `source_path` other than that path gets `invalid_request` on `source_path`. On 01, 05 and 07 (TASK-466, TASK-470) it first reads the text as Markdown, SQL or YAML into the picture the pinned hub would send, as the file `source_path` names, and puts it in place of what that file gave the drawing's picture (see [Reading Markdown, SQL and YAML](#reading-markdown-sql-and-yaml)). It then draws that picture with the board, ERD or sitemap drawer, as a push draws it, with the warnings the push kept of the other files and those of the reading. It then compares the two drawings by element key:
  - in the proposed drawing's order, an element only it has is a `connect` from its `detail.from` to its `detail.to` when it is a line or an arrow between two of its elements, with its label as `name`, and an `add` otherwise;
  - a line or an arrow that both drawings have but that joins other elements is a `remove` and then the `connect` of the new line, at the line's place in that order: an ERD line, keyed by its table and columns, whose foreign key now references another table, for one;
  - an element with another name is a `rename`;
  - then each element only the current drawing has, in that drawing's order, is a `remove`. A sitemap screen moved under another parent keeps its key, and its line, keyed by its parent, is a `connect` from the new parent and a `remove` from the old one.
  - Every other difference makes no change: a position, a state's description, a box's kind, and a table's columns, types, keys and unique rules, which are part of the table's element.
  - A text that does not draw gets `invalid_request` on `source_text`, naming the line it fails at, and so do Markdown that reads no context, SQL that reads no table, YAML that reads no screen and more than 500 changes. No detail repeats the text or the path.
- **The thread.** Every proposal adds one agent entry to its thread, its change text, and the thread then waits on the owner (SPEC-017).
  - With `comment`, it is that thread. It must be of the request's stage and part (otherwise `comment_not_found`), open (otherwise `thread_closed`), and on the diagram `diagram` names, when `diagram` is sent (otherwise `invalid_request` on `diagram`). The proposal is written as a reply is: while the thread waits on the agent, it keeps the claim of the thread's comment entry, so another session's claim gets `claimed`, and once written it releases the claim as `done` (SPEC-018, see [Claims](#claims)).
  - Without `comment`, the agent's own thread opens on the diagram as a whole, at the proposal's drawing.
  - **The owner's to-do shows both** the thread's question and the proposal. `threadChanged` reads only the thread, so a thread that waits on the owner is a question, whatever answers it. Showing only the proposal would make `threadChanged` read the change sets too. That would add TBL-158 to the table lists of every operation that calls it, API-242 and API-252 to API-255 among them.
- **Withdrawing** (API-257) cancels a proposal that is still proposed, sets `decided_at`, and closes the owner's proposal entry as withdrawn; the page takes its overlay off. The body is `{}`.
  - One withdrawn already answers `changed` false. One accepted, rejected or reflected gets `change_set_state` with its state. A direct edit's ID, or an ID that names no change set of the project, gets `proposal_not_found`.
  - The owner may answer the proposal's thread, which then waits on the agent. The withdrawal is then a write on its comment entry and keeps that entry's claim, so another session's claim gets `claimed`. The entry stays open, and the claim with it: the agent still answers the owner.
  - The thread is kept as it is. A proposal on a diagram removed since can still be withdrawn.
- **No log line** holds a proposal's text, its `source_text` or a session's label (rule 5).

### Reading Markdown, SQL and YAML

TASK-466 (SPEC-018) reads a proposal's `source_text` on stage 05 and 07, and TASK-470 on stage 01, as the pinned hub reads the stage's source files, so that the board, ERD and sitemap drawers draw a proposal's domain, schema or sitemap as they draw a push's. It uses no Markdown, SQL or YAML package (AGENTS.md): the readers are ports of the hub's at the commit of `hub-ref.json`.

- `src/domain-picture.js` (TASK-470) ports `domain.py`. It reads the stage-01 tables in English and Korean, by their headers: each context's heading with its purpose and external systems, its command tables and their read models, aggregates, events and policies, the context table's types and aggregates, the glossary's terms and removed marks, dependencies, hotspots and the timeline's lanes. It passes over a fenced block and struck text, as the hub does, and leaves out what the hub leaves out, with the hub's `picture-partial` check.
- `src/sql-picture.js` ports `erd.py` and the SQL reader in `hub.py`. It reads `CREATE TABLE` with its columns, keys, unique rules and foreign keys, `ALTER TABLE`'s foreign keys, `CREATE UNIQUE INDEX` on named columns, and a table's comment, which gives its trace ID, context, terms and removed mark. It passes over every other statement, such as a view, an insert or an index that is not unique, as the hub does, and leaves out what the hub leaves out, with the hub's `picture-partial` check.
- `src/sitemap-picture.js` ports `sitemap.py` with its own reader of the sitemap template's YAML: a list of screens, each a mapping of plain, quoted or inline-list values, with children nested under their parent. Tags, anchors, aliases, flow mappings, block scalars and merge keys are refused with their line, as the hub refuses them. Mappings are Maps, so that `__proto__` is a key like any other.
- `src/picture-text.js` holds what they share: Python's line breaks and white space, the hub's one-line messages with secrets and email addresses redacted, its trace ID formats, and its `plain`, which takes a Markdown cell's link texts, tags and emphasis away and decodes its character references as Python's `html.unescape` does. `src/html-entities.json` holds the tables `html.unescape` reads, the named references and the numbers it replaces or drops, as Python's `html.entities` and `html` give them; `tests/test_html_entities.py` keeps it equal to them and makes it again with `--write`.
- `src/picture-merge.js` (TASK-470) puts a text read as one file in place of what that file gave a picture of several (see [Several files](#several-files)).

The rules the coordinator chose for TASK-466 and TASK-470, which the maintainer approved through the delegate they named for checkpoints on 2026-11-24, each asked on its own:

- **Which file.** The text is read as the file `source_path` names, such as `db/nexus.sql`, so that each entry's `where` and each warning's line read as a push's do (TASK-470). The files the drawing reads are those its elements name in their `where`, less a file the hub did not read, past its limit of files or unreadable, of which the drawing holds only the hub's warning. When they are several, `source_path` is needed, and a proposal without it gets `invalid_request` on `source_path` ("source_path is needed: the drawing reads several files"). With one, `source_path` may be left out, and the text is read as that file. With none, which a push's picture does not draw, the text is read as the diagram's path and is the whole picture. A `source_path` that names no file the drawing reads, compared as written, gets `invalid_request` on `source_path` ("source_path names no file the drawing reads"). `source_path` comes only with `source_text`, and it is not kept: the stored request and the answer hold no path.
- **Which trace IDs.** A context's heading, a table's comment or a screen's `id` gives a trace ID in the hub's default formats, or with a prefix that the current drawing's contexts and terms (01), tables (05) or screens (07) use. The project's own `ids` setting does not reach NEXUS, so a prefix that no current element uses is read as the hub reads it without that setting.
- **What changes.** Only the drawing's elements change: on stage 01 the contexts, stickies, dependencies, hotspots and lanes; on 05 the tables and lines; on 07 the screens and lines. A column, its type, a key or a unique rule is part of its table's element and makes no change. A line that joins other elements under its key is a `remove` and then a `connect`, and a screen under another parent moves its line, as [Proposals](#proposals) says.
- **What is refused.** A statement the hub passes over makes no change, and one it leaves out is a `left_out` element, so a new one is an `add`. Markdown that reads no context, SQL that reads no table and YAML that reads no screen get `invalid_request` on `source_text`, as a text that does not draw does: such a text is almost always the wrong file. A YAML error names its line.
Four more rules were chosen while building TASK-470. No approved document states them, and they wait for the delegate's answer in TASK-470's pull request:

- **A byte order mark.** A text's leading byte order mark is not read, as the hub decodes a push's files as `utf-8-sig`. The hub's `propose` reads `--source-file` as UTF-8 and keeps the mark, which would otherwise fall in a table's name or a heading and show as a rename.
- **A file emptied of its entries.** On a drawing of several files, the refusal above is of a text that leaves the picture no context, table or screen. A text with none of its own, such as SQL that only alters another file's tables, takes its file's place, and what that file gave the picture goes, as in the hub.
- **Where the merge can differ from the hub**, the four ways [Several files](#several-files) lists.
- **Stage 01 under the approved differences.** The last two differences below also cover stage 01's reader: Python's decimal digits, which number a hotspot, are a Unicode class, and three of `domain.py`'s splits are scans, since Python's would take time that grows with the square of a list's length. The 1,000,000-character text reads in about 1.5 s.

**Where NEXUS reads otherwise than the hub.** For this repository's `docs/01-domain/nexus.md`, `db/nexus.sql` and `docs/07-sitemap/nexus.yaml`, and for each case in `test/picture-cases.json`, NEXUS's picture and checks equal the pinned hub's. They can differ in four ways, which the maintainer approved through the same delegate on 2026-11-24:

- YAML nested more than 400 blocks deep, or with more than 20 inline lists inside each other, is refused with its line as a YAML error. The hub's reader recurses, and Python stops it near 490 levels with no picture.
- A double-quoted YAML value that escapes half of a surrogate pair, such as `"\ud800"`, is refused with its line as a YAML error. Python keeps such text, but it is not Unicode, and NEXUS keeps only Unicode text.
- Python's `str.casefold` is JavaScript's upper case then lower case, and Python's white space and word characters are written out as Unicode classes. They agree on every letter the cases test, and may differ on a few rare scripts.
- The text comes from an agent and holds up to 1,000,000 characters, so every step reads in time that grows with its length. A few of the hub's regular expressions are written out as scans with the same result.

### Several files

NEXUS keeps only the hub's picture of a push, not the files it read (see [Snapshot intake](#snapshot-intake)). So when a drawing is read from several files, NEXUS reads the text alone, as the file `source_path` names, and puts what it reads in place of what that file gave the drawing's picture, the picture the push sent and the snapshot keeps (`src/picture-merge.js`, TASK-470). Every entry of those pictures names its file in its `where`.

- **Order.** The hub reads a stage's files in the order of their paths, compared by code point, and lists each file's entries after those of the files before it. The entries keep that order, and the text's go where its path puts them.
- **Stages 01 and 07** read each file on its own, so this is the hub's picture of the stage with the one file changed. A screen's parent is its place in the list, so each one is counted again.
- **Stage 05** reads every file's statements against every file's tables. So a foreign key that the file's `ALTER TABLE` gave a table of another file goes with the file's old text. The text is read with the other files' tables known, so that its `ALTER TABLE` and unique indexes reach them. A foreign key that another file's `ALTER TABLE` gave one of the file's tables stays on the text's table of that name, the last one when the text creates several, after the text's own.
- **Warnings.** What the hub left out of the other files stays, as the push's checks say, and what the reading leaves out of the text comes with it. The picture's limits apply again, with the hub's `picture-partial` checks: 500 tables, a table's 300 columns, 50 unique rules and 100 foreign keys; 500 screens; and stage 01's limits. A whole list's limit, such as the 500 tables, is checked once, on the merged list, and names the last file by path, as the hub's check does; the push's check of it and the reading's of the text alone give way. What the hub left out of the picture for its limits is not known, so it stays out.

For each of stages 01, 05 and 07, `test/picture-cases.json` holds two files and, for each of them, the hub's picture of the two with that file's text replaced, and the merge makes it. Where the merge can differ from the hub, which no drawing shows:

- A comment that one SQL file gives a table of another file is not read again, since a picture does not say where a table's comment comes from. A unique rule that one file gives a table of another stays, since it names no file, and a text that still holds it gives it again. Neither makes a change: a table's comment that names its trace ID is in the file that creates it in this repository, and a unique rule is part of its table's element.
- When other files create two tables of one name, the text's `ALTER TABLE` or unique index reaches neither of them, since a picture keeps a table's name without its schema. In the hub it reaches the last of them when they share a schema, and the one its schema names otherwise.
- A table's foreign keys keep the text's own first, then those other files gave it; the hub orders them by statement. The order makes no change.
- The terms without a table or a screen are the picture's and the text's together, since they name no file. No drawing shows them.

`tests/test_picture_cases.py` keeps `test/picture-cases.json` equal to the pinned hub's pictures of its cases: stage-01 tables in English and Korean, headings, links, tags and character references, glossaries and limits; SQL in each dialect the hub reads, comments, statuses, quoted and Unicode names, the line breaks Python reads, trace ID formats and limits; YAML templates, errors and nesting; and two files of each stage with one replaced. To make it again, from the repository's root:

```sh
CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_picture_cases.py --write
```

### Gap closed: changes from source_text on 01 and from several files

- **What the gap was.** TASK-438 and TASK-466 kept `source_text` with no change on stage 01, and on 05 or 07 when the current drawing's elements name more than one file in their `where`, so a rename showed X marked with the change text, not Y over X, against the contract ("the proposed document, from which NEXUS works out the changes") and SPEC-018's acceptance ("the owner sees Y over X, marked as proposed"). `source_text` was one text with no path, NEXUS read no Markdown, and with several files it could not tell which one the text stood for. The WBS's section 4 kept both as differences until a hub change sends the path.
- **What closes it.** TASK-470 adds `source_path` to ProposalRequest (the [API README](../docs/06-api/README.md) records the contract's correction), reads stage 01's Markdown, and puts a text in place of one file of a picture read from several. Stage 01, 05 and 07 are the stages the pinned hub's `propose` offers (`PICTURE_STAGES` in its `commands.py` at e410ce9), and it sends `--source-file`'s whole text.
- **What the hub sends.** The pinned hub at e410ce9 sends no `source_path`. On a drawing of one file, which this repository's stages 01, 05 and 07 each are, its proposal now makes changes. On a drawing of several files it is refused with `invalid_request` on `source_path` until a hub pin that sends the path; the hub's side is a task of its own. The hub reads `--source-file` as UTF-8 with any byte order mark, which NEXUS does not read.
- TASK-449's run of the pinned hub does not include `propose`.

`test/proposals.test.js` checks TASK-438's done condition, TASK-466's and TASK-470's. Stage 09 and stages without a drawn picture are refused. `source_text` on this repository's FL-003 and SCR-144, drawn by their own drawers, becomes renames, adds, connects and removes. For TASK-466 and TASK-470, a project draws the pinned hub's pictures of this repository's `docs/01-domain/nexus.md`, `db/nexus.sql` and `docs/07-sitemap/nexus.yaml` (`test/ddd-board-picture.json`, `test/erd-picture.json` and `test/sitemap-picture.json`) as a push draws them, and keeps each picture in its snapshot as a push does. The schema with a table renamed, added and removed, a foreign key that references another table and a statement the hub leaves out, and the sitemap with a screen renamed, added and moved under another parent, make the changes above in their order. The files as they are, a column's new type and a view make none, and a table keyed by a project's own prefix keeps its key. SQL with no table, YAML with no screen and YAML that does not read, with its line, are refused. On stage 01, the domain document with a context renamed makes that rename; as it is, with a byte order mark, or with its path, it makes none, and Markdown with no context is refused. In part split, a board, an ERD and a sitemap are each read from two files: a context renamed in one, a table added to one with a foreign key to the other's table, a table renamed in the file whose `ALTER TABLE` gives the other's table a foreign key, a unique index the hub left out taken away, and a screen added in one file, which moves the other file's screens down the list, make only their own changes, and each file as it is makes none. A file left with none of its own entries removes what it gave, and the other file's entries stay. A drawing of several files without `source_path`, and a `source_path` that names no file the drawing reads, on each stage, are refused, and a `source_path` out of form or without `source_text` too; the path is not kept. A file the hub did not read is not one of the drawing's files. The test also covers removed diagrams, claims, withdrawing in each state and the log lines. It answers every response API-256 and API-257 list, and checks the tables they touch (note 23).

`test/picture-readers.test.js` checks that NEXUS's readers make the pinned hub's pictures and checks of those three files and of each case in `test/picture-cases.json`, that the merge makes the hub's picture of each case's files with one replaced, that a whole list's limit is checked once, and the limits that are NEXUS's own: YAML nested too deep, Maps for keys such as `__proto__`, and texts of 400,000 characters read in time.

The two operations read and write more tables than they listed, so API-256 lists 14 tables and API-257 lists 10 (notes 18 and 23 of the WBS). A proposal's entry is a row of TBL-156, whose trace list gains SPEC-018. The corrections at the end of the [API README](../docs/06-api/README.md) and the [ERD README](../docs/05-erd/README.md) passed their own checkpoints on 2026-11-24 through the same delegate as the rules above. TASK-466 changes neither list: it compares the proposed drawing with the current drawing's elements, TBL-153, which API-256 already read and lists. Nor does TASK-470: it reads the drawing's picture and the snapshot's checks from TBL-150 and TBL-149, which API-256 already lists.

## Tool links

`src/tool-links.js` is TASK-451. The owner links a Notion page or a Jira project to the project or one of its stages (API-282, `POST /api/projects/{project}/tool-links`, SPEC-046), and removes the link (API-283, `DELETE /api/projects/{project}/tool-links/{link}`, SPEC-047). Both are owner writes with a request key. The project screen (SCR-144, TASK-457) shows them, and the [project read](#project) lists them.

- **Only a link.** The server keeps the scope, the tool and the address (TBL-168), never what the page or project holds. Adding or removing a link calls no tool.
  - The [tool status read](#tool-status) (TASK-467) reads each live link's status later, with read-only tokens of the server's environment. Until a link's first read, `status` and `status_read_at` stay null, and it shows "not read yet" (SPEC-046's exception).
- **Which addresses count.** The check is by host, never by path. So a database, a board or a filter address of the same tool is accepted too. The status read reads only a Notion page or a Jira project, and any other address keeps "not read yet".
  - Notion: `notion.so`, `notion.site`, `notion.com` and their subdomains, such as `www.notion.so` and `app.notion.com`.
  - Jira: a subdomain of `atlassian.net`, unless the first segment of its path is `wiki`, which is Confluence. That holds in any case or encoding, after extra slashes and before a `;` parameter.
  - The address must be https; an `http` or any other address is refused. It is at most 2,000 characters, without white space, a control character or a backslash. It must hold no user name or password, and no port but 443.
  - Anything else is `invalid_request` on `url`, and the refusal never repeats the address.
- **The address kept** is the one given, with its host in lower case and without `:443` or its `#fragment`.
  - The path and query stay as typed, not in the URL parser's percent-encoded form, so the address kept can hold characters a URI does not, such as Hangul or `"`. This differs from the contract's `format: uri` for `Link`, as the maintainer's delegate approved.
  - The page (TASK-457) puts the address only in `href` and `textContent`, never into HTML.
- **The same link** is the same scope and the same address kept. It answers 200 with the link already kept, not a second link.
  - A link with another scope, or with another query, is another link.
  - A link added again after its removal is a new link, with a new ID.
- **At most 200 live links** a project holds, as many as the project read lists. The 201st is `invalid_request` on `url`; the same link still answers 200, and removing one makes room.
- **Removing** marks the link removed, and the project read no longer lists it. Deleting the project space (see [Project removal](#project-removal)) still counts it. Removed again, it changes nothing: `changed` is false (SPEC-047).
- **Not found.** A name no project space has gets `project_not_found`. A link of another project, or an ID in no link's form or of no link, gets `tool_link_not_found`. Neither detail repeats the value.
- **No log line** holds an address or the project's name (rule 5).

The coordinator chose these rules for TASK-451: the check by host, of https addresses only; the same link after the host is put in lower case and the port and fragment are dropped; the 200 links; and links that keep their status null. The maintainer approved them through the delegate they named for checkpoints on 2026-11-24.

`test/tool-links.test.js` checks TASK-451's done condition: every response API-282 and API-283 list. It also tests which addresses count and how each is kept, the same link again, the request key, the 200 links, removing twice, and the log. It checks the tables each touches (note 23). Both find the project space by its name, so API-282 and API-283 list TBL-147 and TBL-168. The correction at the end of the [API README](../docs/06-api/README.md) passed its own checkpoint on 2026-11-24.

## Project screen

TASK-457 (SPEC-013, SPEC-035, SPEC-046, SPEC-047, SPEC-010) is SCR-144, the page at `/p/{project}`: one project's stages and tool links, and the deletion of its space at `#data`. `web/project.js` draws its body in the [app shell](#app-shell). It reads the project with API-264, and the delete panel reads API-277. The page writes API-278, API-282 and API-283.

- **Under the title.** The project's name, its revision and when it was last sent, such as "book-club · 리비전 66 · 12분 전에 보냄". The send time follows the shell's tick.
- **Stages.** The stages grouped by part in API-264's order, 13 rows a group. The project as a whole is one group headed "단계" with "파트 없음 · 13단계"; a part's group is headed by the part's name with "13단계". A row shows:
  - its number and name, which open SCR-145 at that part and stage. The rest of the row opens it too, as its chevron says, and the row's tool links stay links of their own;
  - its state: 통과 for `passed`, 통과 with the purple tag "통과 뒤 바뀜" for `changed_since_pass` (SPEC-035), 진행 중 for `open` and 시작 전 for `not_sent`. When no stage of the project was sent, each row says "아직 보낸 것이 없어요" (SCR-144#empty). 건너뜀 never shows, since API-264 has no such state;
  - for a pass, "마지막 체크포인트 MM-DD", the local date of `passed_at`;
  - at the wide layout, the stage's tool links, each "Notion · " or "Jira · " with its address and ↗. The 360-pixel layout leaves them out, as the mockup does.
- **Tool links.** A card for each link, oldest first. It shows "Notion · " or "Jira · " with the address itself as the link, on one line cut with an ellipsis. Under it are where the link belongs, "프로젝트" or a stage such as "02 PRD", and its status with the time it was read, as the [tool status read](#tool-status) (TASK-467) keeps them, such as "할 일 3 · 진행 중 2 · 완료 10 · 10:40". A link read with no status, such as a Notion page with no status property or with its status empty, says "읽음" with the time, as the mockup's "읽음 · 10:40"; a link not read yet says "아직 안 읽음". With no link, the group says "아직 이은 도구가 없어요."
- **The address.** It goes only into the link's `href` and its text (`textContent`), never into markup, and opens in a new tab with `rel="noopener noreferrer"`. An address that is not https, which the server never keeps, shows as text and links nowhere.
- **Linking.** The form has "Notion 페이지나 Jira 프로젝트 주소" (placeholder `https://`), "어디에" with "프로젝트 전체" and the 13 stages, and 잇기. While its write runs, 잇기 is off with `aria-disabled`, so it keeps the focus, and what the last attempt answered goes. After a 201, or a 200 for the same link again, the field clears and the page reads API-264 again, so a link added twice is one link. A refused address (400, 409 `request_key_reused` or 413) keeps its text, marked invalid, with the registry's message under it, such as "표시한 입력을 확인하세요.", and the field takes the focus. The typed address is unsent text (`keepDraft`), so it comes back after the gate.
- **Removing a link.** 지우기 on a card removes the link without asking again, and is off with `aria-disabled` while it runs, keeping the focus. After a 200, or a 404 `tool_link_not_found` for a link removed meanwhile, the page reads API-264 again and the link is gone. A refusal shows its message under the card.
- **Deleting the space.** At `#data`, the ghost button "이 프로젝트 공간 지우기" opens and closes the panel (`aria-expanded`). Each opening reads API-277 again, with grey counts until it answers, and then shows five of its counts: 스냅숏, 그림, 댓글, 확정 and 레이아웃. The field asks for the project's name, as in "지우려면 프로젝트 이름 book-club을 적으세요". 공간 지우기 turns on only once the counts have come and the name typed is the project's exactly, since what goes shows before the owner confirms (SPEC-013). It is off with `aria-disabled` while API-278 runs. After its 200 the page goes to `/p?deleted={project}`, where TASK-456's SCR-143 says so once. Closing the panel forgets the typed name, and the name is never kept in the browser.
- **The particle.** `objectParticle(name)` in `web/korean.js` puts 을 or 를 after a project's name by how its end is read aloud. A final digit follows how Korean reads it. A final ng, l, m or n, an e after m, n or l, which is silent, and a b, k, p or t after a vowel take 을, a final ck read as one k (stack); anything else takes 를. TASK-456 added the ck reading, which changes TASK-457's approved rule in this one point; the maintainer approved it through the delegate they named for checkpoints on 2026-11-24, asked on its own. English spelling does not always say how a word ends aloud, so the rule can miss on other words; a miss shows the name with the other particle and nothing else.
- **Writes.** `write(method, path, body, key)` in `web/api.js` sends a JSON body, or none, with the attempt's request key in the `Idempotency-Key` header, and `newRequestKey()` makes a key: `nw_` and 12 random characters. The page keeps a key only when no answer came, after a timeout or a lost connection, so 다시 시도 or the same button sends the same input again with the same key and the server cannot write twice (rule 3). It makes a new key when the input changes and after any answer.
- **Answers.** A write's answer meets the shell's states through `shell.outcome` (see [How a screen plugs in](#how-a-screen-plugs-in)): a 401 goes through the gate, a 403 shows only its message, and a 404 `project_not_found` shows the project gone. A 415, a 500, a timeout or a lost connection shows the code's message with 다시 시도 and the traceId where the write was sent: under the form, under the card or in the panel.
- **Focus.** A button whose write runs keeps the focus. Each draw of the tool links or the panel, and each read again that draws the page anew, puts the focus back on the element of the same id, with the caret where it was in a field. When a 다시 시도 goes with its notice, the focus goes to the button that sends the write.
- **Phone.** On a phone, the form, each 지우기 and `#data` are left out, and the tool links' group says "도구 잇기와 링크 지우기, 공간 지우기는 PC에서 하세요." (SPEC-051). A narrow window on a PC keeps them all.
- **Loading.** Thirteen grey rows in the stage list's place, a grey link card and a grey line at `#data`. The form is there already, and 잇기 waits for the project's read.

The screen differs from the stage-09 mockup in four places: a tool link's title is its address, since the contract carries no name; while loading, the header shows grey shapes for the values the read brings, a phone draws no `#data`, and 잇기 stays off until the project's read answers. The maintainer approved each difference through the delegate they named for checkpoints on 2026-11-24, and section 4 of the [WBS](../docs/10-wbs/wbs.md) lists them.

These rules, and the words the screen definitions and the mockup do not give, were chosen by the coordinator for TASK-457, and the maintainer approved them through the delegate they named for checkpoints on 2026-11-24, each asked on its own.

TASK-467 changes one of them: a link read with no status says "읽음" with the time it was read, where TASK-457 showed "아직 안 읽음" for every link with no status. The maintainer approved that change of TASK-457's approved screen, for this one case, through the delegate they named for checkpoints on 2026-11-24, asked on its own.

`test/project-screen.test.js` checks each state of SCR-144 against stubbed answers and against the server, and how the page shows every response API-264, API-277, API-278, API-282 and API-283 list. Each stubbed answer is checked against the contract, and the operations' own tests have the server give each response. It also tests the request keys of the writes, the particle, and a link's status in its three forms: read with a status, read with none, and not read yet. The browser walk of the pull request shows each state at 360 and 1440 px, in light and dark.

## Tool status

`src/tool-status.js` is TASK-467 (SPEC-046, REQ-058, REQ-061). The server reads the status of each live [tool link](#tool-links) and keeps it on the link with the time it was read (TBL-168). The [project read](#project) gives both, and the project screen (SCR-144, TASK-457) shows them.

- **Tokens.** Read-only tokens that only the server's environment holds (see [Settings](#settings) and [the read-only tokens](#the-read-only-tokens-for-the-deploy-task-464)); never the store, a log line, an answer or Git. A tool with no token is never called, and its links keep "not read yet" (SPEC-046's exception).
- **Where it asks.** Only two hosts, constants in the code and never a setting or a link: `https://api.notion.com` for Notion, and `https://api.atlassian.com` for Jira, through its gateway for scoped tokens, `/ex/jira/{cloud ID}/rest/api/3/`. The server never fetches the address a link keeps, so a link cannot send it elsewhere (no SSRF). From a link it takes only an ID, checked by its form:
  - Notion: a page ID of exactly 32 hex digits, with or without the dashes of a UUID, ending the last segment of the path, alone or after a hyphen (`Page-title-<ID>`). It asks `GET /v1/pages/{ID}` with the `Notion-Version` header pinned in the code to `2025-09-03`. A database view (`?v=`) or an address with no such ID is not read and keeps "not read yet".
  - Jira: a project key in Jira's form, a capital letter, then capitals, digits or `_`, 2 to 255 characters in all, from `/browse/KEY`, `/browse/KEY-12` or `/jira/.../projects/KEY`, on the one site `NEXUS_JIRA_SITE` names. A link on another site, or with no key, such as a dashboard or a filter, keeps "not read yet". The key goes into the JQL only after that check, inside double quotes, so a link cannot change the query.
  - No redirect is followed: a 3xx answer is a failure. An answer is read up to 1 MiB. Each token goes only with its own tool's requests: Notion's as `Authorization: Bearer`, Jira's account and token as `Authorization: Basic`.
- **The status**, as SCR-144 shows it, as given: text of at most 120 characters (the contract's limit), its control characters made spaces. Whoever can edit the page or the project's workflow chooses it, so the page (TASK-457) puts it only in `textContent`, never into HTML.
  - Notion: the name of the page's first property of type status, or else of a select property named `Status` or `상태`, in any case. A page in the trash is `휴지통에 있음`. A page with neither property, or with its status empty, is read with status null and its time, which SCR-144 shows as "읽음 · HH:MM".
  - Jira: the project's work items by status category, from three approximate counts (`project = "KEY" AND statusCategory = "To Do"`, then `"In Progress"` and `"Done"`), as `할 일 3 · 진행 중 2 · 완료 10`.
- **When.** A timer in the server process, as the [daily backup](#daily-backup)'s: it starts when the server listens and stops with it. Every minute it looks for live links not tried for 30 minutes, so a link added through API-282 is read within a minute and each link about every 30 minutes. After a restart, a link counts from the read time the store keeps, so a restart does not read every link again. Links never tried go first, then the one tried longest ago, so a link that keeps failing cannot keep the others waiting. A round still running when the next look is due makes that look skip, so rounds never stack. Opening SCR-144 reads nothing: API-264 stays a plain read, and no operation's table list changes.
- **How hard.** One link at a time across both tools, at most two requests a second for each tool, and 10 seconds for each request. Writes go through the store's one write queue, and a status is written only while the link is live: a link removed during its read keeps nothing.
- **Failures (REQ-061).** A link that cannot be read keeps its last status and the time it was read, whatever the failure: a 401, 403, 404, 429 or 5xx answer, a redirect, a timeout, a network error or an answer of the wrong form. A link never read keeps "not read yet". A 401 or 403 (a refused token) or a 429 (asked to slow down) leaves that tool alone for 30 minutes, so a refused token is not tried on every link; the other tool is still read. A Notion page not shared with the integration answers 404.
- **The log.** One `tool_status_read` line for each round and tool that asked anything, a round that the server's stop ended included (see [Log](#log)). It never holds a token, an address, a page ID, a project key, the site, its cloud ID, the account or anything a tool answered (rule 5). A link is named by its ID, which is not a secret.

The coordinator chose these rules for TASK-467. The maintainer approved those no approved document states, with the new Korean words, through the delegate they named for checkpoints on 2026-11-24, each asked on its own.

`test/tool-status.test.js` checks the read with a stubbed `fetch` and an injected clock, with no real token or service:
- which ID a link gives, and the JQL a key makes;
- each status, Notion's and Jira's;
- that only the two hosts are asked, with no redirect followed, and each token only with its own tool's requests; and that Node's own `fetch`, as the server calls it, does not follow a local server's redirect;
- that every failure keeps the last status and time, a body that times out or drops included, and the pause after a 401, 403 or 429, which a link refused on its own does not turn into a wait for the others;
- the looks, the read time kept across a restart, a running round making the next look skip, and the stop, after which the round's line is still written;
- a link removed during its read;
- the log lines, with a token, an address, a page ID and a project key in the stubbed answers.

`test/settings.test.js` and `test/main.test.js` check the settings, naming a wrong one but never its value.

## Answering proposals

`src/proposal-answers.js` is TASK-444: the owner accepts an AI proposal, which then waits for reflection, or rejects it, which takes its overlay off (API-270, `POST /api/projects/{project}/change-sets/{change_set}/accept`, and API-271, `POST /api/projects/{project}/change-sets/{change_set}/reject`; SPEC-019, SPEC-020, SPEC-027). Both are owner operations with the body `{}` and a request key (rule 3). An agent's credential gets `owner_only` (REQ-025), and a phone does not offer them, which is the page's (REQ-068; see [Workbench changes](#workbench-changes)).

The coordinator chose the rules for a removed diagram (note 7 of the WBS) and read the others below from the approved documents. The maintainer approved them through the delegate they named for checkpoints on 2026-11-24.

- **The change set.** The ID names a change set of the project; otherwise `change_set_not_found`. A direct edit is accepted when it is made and cancelled, not answered (API-273), so it gets `change_set_state` with its state, as a proposal sent to API-273 does.
- **Accepting** (API-270, SPEC-019) marks a proposed proposal accepted, with `decided_at` the time of the answer. `changeSetsChanged` closes the owner's proposal entry as done and puts the proposal in its diagram's reflection entry on the agent to-do (see [To-do entries](#to-do-entries)). So API-245, API-247's `reflection` and `heldChangeSets` read it as any accepted change set. They order accepted change sets by `decided_at`, as TASK-445 has them, so the later accepted wins in the reflection and is on top in the diagram read.
  - Accepted again, or reflected since, it answers the change set with `changed` false ("accepted again → the same result"). Rejected, or withdrawn by its agent, it gets `change_set_state` with its state.
  - **The document changed** since the proposal when the drawing the diagram shows, its latest that drew (SPEC-001), is not the proposal's drawing. That is API-256's test of a proposal's `commit`, with its exception: a push that left the diagram unchanged, a failed drawing and a source the snapshot left out keep the drawing the diagram shows. It gets `document_changed`, naming the shown drawing and its version, with "ask for a new proposal".
  - **A removed diagram** takes no accepted proposal (SPEC-027). It gets `document_changed` too, as the contract's description says, naming the drawing the removed diagram still shows, its latest that drew, at which the [diagram read](#diagram) opens it while something waits on it (note 7).
- **Rejecting** (API-271, SPEC-020) marks a proposed proposal rejected at `decided_at`. `changeSetsChanged` closes the owner's proposal entry as done, and the diagram read no longer lays the proposal over the diagram.
  - Rejected again, it answers `changed` false. Accepted, reflected or withdrawn, it gets `change_set_state` with its state.
  - **A removed diagram's proposal** is rejected like any other (note 7). SPEC-027 refuses accepting one, not rejecting one, and rejecting only takes a change off, as withdrawing does (API-257). The owner's to-do keeps a removed diagram's proposals (see [Projects and to-do](#projects-and-to-do)), so this is how the owner clears one. SCR-145 shows Reject, never Accept, there (see the [screens README](../docs/08-screens/README.md)). A proposed proposal keeps its removed diagram listed and open, its thread closed or not, so the owner's to-do entry always reaches it (the feature change of pull request 154, TASK-468). A rejected proposal's thread stays open (SPEC-020) and keeps the diagram until the owner closes it.
- **The thread.** Neither answer writes on the proposal's thread. An open thread waits on the side that did not write last (SPEC-017), so it stays open and waits where it did (SPEC-020), and a closed thread stays closed (TASK-443). Claims are the agent sessions' (SPEC-044): an answer keeps none and ends none, so a thread that waits on the agent keeps its comment entry and its claim.
- **What the agent sees.** The agent reads the answer as the change set's state, by API-246's `change_sets` and API-247. Its to-do gains only an accepted proposal's reflection (SPEC-043). A rejection takes no reason: the body is `{}`, and the owner may reply in the thread.
- **The answer** is the contract's ChangeSetAnswer: the change set as `changeSetOf` in `src/reads.js` makes it, `changed`, and `pull_request` null, which only a direct edit's cancel names.
- **No log line** holds a proposal's text (rule 5).

`test/proposal-answers.test.js` checks TASK-444's done condition with proposals made by API-256: an accepted one waits for reflection on the agent to-do, a rejected one's overlay is gone and its thread stays open, and one already answered gets `change_set_state`. It also covers proposals accepted out of the order they were made, the document changed, a removed diagram, a closed thread, a thread that waits on the agent with its claim, and the log lines. It answers every response API-270 and API-271 list, and checks the tables they touch (note 23).

The two operations read more tables than they listed, so API-270 lists 9 tables and API-271 lists 8 (notes 18 and 23 of the WBS). The correction at the end of the [API README](../docs/06-api/README.md) and the change to SCR-145 at the end of the [screens README](../docs/08-screens/README.md) passed their own checkpoints on 2026-11-24.

## Workshop

`src/workshop.js` is TASK-452: stage-01 event storming on a NEXUS board (SPEC-036 to SPEC-040).

The owner's operations:
- open a workshop (API-284, `POST /api/projects/{project}/workshop`) and read it (API-285, `GET` on the same path);
- add a sticky note (API-286, `POST /api/projects/{project}/workshop/notes`), move or rename it (API-287, `PATCH /api/projects/{project}/workshop/notes/{note}`) and remove it (API-288, `DELETE` on the same path);
- link two notes (API-289, `POST /api/projects/{project}/workshop/links`) and remove a link (API-290, `DELETE /api/projects/{project}/workshop/links/{link}`);
- confirm a step (API-291, `POST /api/projects/{project}/workshop/steps/{step}/confirm`);
- import a Miro board's sticky notes and connectors (API-292, `POST /api/projects/{project}/workshop/imports`): see [Miro import](#miro-import).

The agent's operations:
- draft a step (API-260, `POST /api/spaces/{project}/workshop/steps/{step}/draft`);
- report the pull request that writes a confirmed step into the domain document (API-261, `POST /api/spaces/{project}/workshop/steps/{step}/report`).

Every write takes a request key. The workshop's screen is TASK-462's, and the [project read](#project) names the latest workshop.

- **No AI call.** NEXUS calls no AI model (spec rule 6). A draft's notes and their confidence labels come from the agent through API-260.
- **Stage 01 only.** A workshop belongs to the project. Its board has 11 frames, one for each event storming step, `0`, `1`, `1-b` and `2` to `9`, in that order (TBL-163). Steps 1-b, 7 and 9 are stage 01's checkpoints.
- **Opening and reading.**
  - A project has at most one open workshop. Opening another gets `workshop_open`, which names the open one in `workshop`.
  - The read answers the open workshop, or else the last closed one, with each step's live notes and the board's live links, oldest first. A project that never had a workshop gets `workshop_not_found`.
  - A change to the board without an open workshop gets `workshop_closed`.
- **Notes** (TBL-164). A note has a step, a kind, a text and a place.
  - `kind` is free text of 1 to 40 characters, kept as sent. The screen colours the six kinds it knows.
  - `text` is 1 to 200 characters, and `x` and `y` lie between -1,000,000 and 1,000,000.
  - A text over 200 characters or a kind over 40 gets `text_too_long`, with `field` and `limit`, on every workshop write.
  - A change (API-287) changes the fields sent, and the last change wins.
- **Who made a note** (REQ-047).
  - The owner's notes are made by `owner`. The agent's are made by `agent`, with the credential and a confidence label.
  - When the owner renames an agent's note (changes its text), the note becomes the owner's: `made_by` is `owner`, and the credential and the label are cleared. The agent can then no longer remove it.
  - A move or a change of step keeps who made the note.
- **Links** (TBL-165) are directed. The same from and to is the same link, answered 200, and the reverse is another link. The two notes may be in different steps. Both must be live notes of the open workshop, and a note is not linked to itself.
- **Removing.**
  - Removing a note, by the owner or by the agent's draft, removes its live links too, a person's link included.
  - A removed note or link keeps its row with `removed_at`, and the read no longer lists it.
  - Removed again, it changes nothing: `changed` is false.
- **Limits.** A step holds at most 1,000 live notes, and a board at most 2,000 live links, as many as the read lists. Past that comes `invalid_request` on `notes` (API-260), `step` (API-286, API-287), `from` (API-289) or `data` (API-292).
- **The draft** (API-260, SPEC-037) places 1 to 200 notes in the step's frame, each with its confidence label: `certain`, `inferred` or `guess`.
  - `remove` names notes of the same step, which go before the new notes are placed.
  - A note of another step, or an ID the open workshop does not hold, gets `note_not_found`. A note a person made gets `note_made_by_owner`. Either way the draft writes nothing.
  - A note already removed is passed over and not counted in `removed`.
  - The agent's own notes are every note an agent made, whatever its credential, since credentials are replaced.
  - A note without `x` or `y` takes it from a grid in its frame, 5 columns 160 apart and rows 120 apart: the first grid place, row by row, that no live note of the step holds, nor a note the draft places. So a draft never places a note on another, and a place a removed note left is taken again.
  - A confirmed step takes no draft: `step_confirmed`.
- **Confirming a step** (API-291, SPEC-039).
  - It writes the step's `confirmed_at`, in any order of steps, and leaves the step's notes as they are. A step without a live note gets `step_empty`.
  - Steps 1-b, 7 and 9 each write one pass of stage `01-domain` (TBL-161).
  - The agent to-do gets `write_step` for the step (see [To-do entries](#to-do-entries)).
  - Confirmed again, the step answers its first confirmation with `changed` false, and nothing is written.
  - The owner can still change a confirmed step's notes, and the step stays confirmed.
- **The report** (API-261, SPEC-039, SPEC-040) names the pull request that writes the step into the domain document.
  - A step that is not confirmed gets `steps_open`, which names in `steps` every step of the workshop not confirmed yet.
  - The link must be the project's repository, `/pull/` and a number, as the [agent to-do](#to-do-entries) gives it. Case is ignored. A link of another repository, or any link for a project that names no repository, gets `repository_mismatch`. A link of another form gets `invalid_request` on `pull_request`.
  - Each number is one pull request (TBL-157), with the purpose `domain_document`, and it may write several steps. A number already reported for a reflection or a record gets `invalid_request` on `pull_request`.
  - `opened` links the pull request to the step.
  - `closed`, without a merge, marks the pull request closed and unlinks every step of the workshop linked to it, which stays confirmed and waiting. Opened again, the step reported is linked again.
  - `merged` links the step too, marks the pull request merged and writes every step of the workshop linked to it, which closes their `write_step` entries.
  - A pull request already merged stays merged. A step reported `opened` or `merged` on it is written; one reported `closed` on it changes nothing.
  - A pull request never reported that is reported `closed` links no step, so nothing is kept of it, and the answer's `changed` is false.
  - A written step stays written: a later report answers `changed` false. So does a report that changes nothing, such as the same event again.
  - Once the workshop closes, a report gets `workshop_closed`, as any change to the board does. A retry with the first request key gets the first answer.
  - The workshop closes when all 11 steps are confirmed and written. The merged report that writes the last step not written closes it, and answers `workshop_state` `closed`. A step needs a note to be confirmed, so every frame, step 0 included, needs one. Nothing else closes a workshop.
- **No claim.** No workshop write makes or keeps a claim. A step has no entry ID, so it is never claimed (see [To-do entries](#to-do-entries)). `Nexus-Session`, which API-260 and API-261 need, is checked as a session label and kept nowhere.
- **Not found.** No detail repeats the value.
  - A name no project space has gets `project_not_found`.
  - A step that is not one of the 11 gets `step_not_found`.
  - A note or link of another workshop, or an ID in no note's or link's form, gets `note_not_found` or `note_link_not_found`.
- **No log line** holds a note's text, the project's name, a link or a path (rule 5).

**Open for the workshop release.** The requirements leave two points open, and TASK-452 changes neither:
- how REQ-042 reads for stage 01 while a workshop is open;
- how the owner ends a workshop without finishing it.

The drawn DDD board, its confirmation (API-275) and the pushes of stage 01 go on as they are, and the step checkpoints add passes beside them. Until the second point is settled, a workshop with a step that has no notes cannot close until that step gets a note.

The coordinator chose these rules for TASK-452: when the workshop closes, the pull request report, no claim, who made a note, removed notes and their links, the draft, confirming a step, the kind, links and the limits. The maintainer approved them through the delegate they named for checkpoints on 2026-11-24, each asked on its own.

`test/workshop.test.js` checks TASK-452's done condition: every response API-260, API-261 and API-284 to API-291 list. It also tests:
- opening and reading, and the owner's notes and links;
- the draft, its grid and its removals, and who made a note;
- confirming, the report and closing;
- the limits, the request key and the log;
- the tables each operation touches (note 23).

Every operation finds the project space by its name and the workshop, so each lists TBL-147 and TBL-162 too. The correction at the end of the [API README](../docs/06-api/README.md) gives each list, and passed its own checkpoint on 2026-11-24, each list asked on its own.

## Reports

`src/reports.js` is TASK-447: the agent reports the pull request of a reflection or of a confirmation's record, as the pinned hub's `reflect` and `record` commands send it (API-258, `POST /api/spaces/{project}/edits/{edit}/report`, and API-259, `POST /api/spaces/{project}/checkpoints/{checkpoint}/report`; SPEC-023, SPEC-024, SPEC-025, SPEC-032, SPEC-035, SPEC-045, notes 20 and 26 of the WBS). Both are agent operations with a JSON body, a request key (rule 3) and the session in `Nexus-Session`, and each is one write. `src/reflection.js` reflects, for the push and for API-258 alike, and `src/passes.js` writes a stage's pass.

- **A pull request** is a row of TBL-157, one per number in the project. The first report of a number makes it, with the reporting credential, and a reflection and a record may share it.
  - Its link must be the project's repository address, `/pull/` and its number. Another repository, or a project space that names none, gets `repository_mismatch`; another address of the repository gets `invalid_request` on `pull_request`.
  - A number the [workshop](#workshop)'s report made for the domain document gets `invalid_request` on `pull_request`, as that report refuses a number reported here (TASK-452).
  - Its state follows the reports. `opened` opens it, again when NEXUS had it closed, since GitHub reopens a closed pull request. `merged`, or `reflected` with its merge commit, merges it, also from closed, as the newer state. `closed` closes it. A merged pull request is not reopened or closed: `invalid_request` on `event`, "pull request N is merged".
  - `needs-user` is refused with `invalid_request` on `event`: the agent asks the owner in the thread instead.
- **A reflection** (API-258 on a `reflect` entry, `ne_`). Its change sets are its group, as `heldChangeSets` gives them (see [To-do entries](#to-do-entries)).
  - A report links the group to its pull request when it is in none (SPEC-024). A group in another pull request gets `pull_request_mismatch`, naming it. Without `pull_request`, the group's own is reported, and a group in none gets `pull_request_needed`.
  - `opened` keeps the entry's claim while the pull request is open: the claim names it (TBL-167), so it never ends while the pull request is open (SPEC-045). Reported again, it is the same link, with `changed` false.
  - `merged` records the merge. `reflected` records the merge commit, and when NEXUS holds a snapshot of that very commit, reflects the change sets at once, as the push does (see [After a drawing](#after-a-drawing)), so the entry closes. Otherwise the next push of that commit reflects them, and another commit marks nothing, as API-258 says; `reflected` can be reported again with a commit NEXUS holds.
  - `closed` unlinks the group, whose change sets wait again, met with any entry opened meanwhile, and the claim's 60 minutes start from the close (SPEC-045). Every other group in that pull request, of any diagram, waits again too, since a closed pull request holds none.
- **A removal** (API-258 on a `remove_from_pr` entry, SPEC-023) closes on any report of its change set's pull request; another pull request gets `pull_request_mismatch`. It leaves the pull request's state to the reports of its reflection.
- **A closed entry.** A report that repeats what is true, its pull request in the state the event names, and with the merge commit for `reflected`, answers `changed` false. Any other gets `change_set_state` with the state of the change set the entry is named by. The ID exists, so it is not `edit_not_found`.
- **What the merged document lacks** (note 26). For each diagram and pull request, every step of the reflected change sets that the drawing shown does not show is listed in one comment. The comment opens a new thread on the diagram as a whole, at that drawing, which waits on the owner and so is a question on the owner's to-do. A proposal's own thread still closes (REQ-031). The author is the agent whose credential first reported the pull request (TBL-157's `credential_id`), since the reflection is its work.
  - A step shows when, in the drawing shown: a rename's element is readable with that name; a connection's line runs from the element to the target, or on an item table the element's row lists the target among its links, as [Direct edits](#direct-edits) finds a connection; an added element is readable; a removed element is absent or drawn as removed.
  - The later accepted wins (TASK-445). A step that a later step of its own change set, or a change set of the diagram accepted later by `decided_at`, replaces is not missing. When the replacing step is reflected in the same reflection, the step is left unsaid. When its change set was reflected before, or still waits, the line names the change the reflection left.
  - The text is Korean, as the owner's screen is, and names each change by its kind and element, with an element's trace ID shown apart from its name and never an ID of NEXUS (SPEC-010). No spec ID is in it. Its lines stop within the contract's 4,000 characters, and the last line counts the rest:

    ```text
    병합한 PR #12의 문서에 이 변경이 없어요. 변경은 반영됨으로 표시했어요. 다시 필요하면 이 스레드에 답하거나 새 제안을 부탁하세요.
    - AI 제안, 이름 바꾸기: TBL-146 agents → agent_keys
    - 직접 편집, 잇기: TBL-146 agents → TBL-147 project_spaces
    - 직접 편집, 이름 바꾸기: TBL-150 snapshot_files → files — 나중에 수락한 변경을 남겼어요: AI 제안, 지우기: TBL-150 snapshot_files
    - 그 밖의 변경 3개
    ```
- **A confirmation's record** (API-259 on a confirmation, `nk_`; SPEC-030, SPEC-031, SPEC-032). The record that is due is the confirmation's own until it is recorded, an invalidated one included, which is recorded at its version and stays invalidated (SPEC-032); then, once a recorded confirmation is cancelled, the cancel's.
  - `opened` links the pull request to the confirmation and keeps the claim with it; another open pull request already linked gets `pull_request_mismatch`. `merged` records it, `recorded_at` or for a cancel `cancel_recorded_at`, and the entry closes. `closed` unlinks it, and the claim's 60 minutes start.
  - While the cancel is due, the pull request that recorded the confirmation, or another that NEXUS had as merged by the time of the cancel, answers `changed` false: it cannot hold the cancel's record.
  - With nothing due, the pull request that recorded it reported again answers `changed` false; another gets `pull_request_mismatch`.
  - **A cancel before the record merged** answers `confirmation_cancelled` (SPEC-032). When the report is `merged`, Git now holds the record, so the confirmation is marked recorded and the agent to-do gets recording the cancel (SPEC-030), as the contract says: "A confirmation cancelled before its record merged answers confirmation_cancelled, and the agent to-do gets recording the cancel". The refusal keeps that write (see [Requests](#requests)), and a repeat of its request key answers the same 409. That pull request reported `merged` again under another key answers `confirmation_cancelled` too and writes nothing, and so do `opened` and `closed` on such a confirmation. Another open pull request already linked gets `pull_request_mismatch` first.
- **A stage's pass** (SPEC-035, note 20). A record that merges, and a push that removes a diagram, write the stage's pass when every diagram of the stage that is not removed, item tables included and in every part, has a live confirmation that is recorded. One invalidated meanwhile and recorded at its version does not count, a removed diagram counts for none (SPEC-027), and a stage with none of them gets no pass. Its `passed_at` is the date of the last confirmation, the latest `confirmed_at` among them. A pass of the stage that is not marked changed and is no older than that already rests on them, so none is written again. The push writes one too because removing a stage's last unconfirmed diagram completes the stage with no record to report.
- **A recorded cancel** (TASK-446's approved rule) marks `changed_at` on the passes of the stage made while that confirmation was live, from its `confirmed_at` to its `ended_at`, as an invalidation does: Git's stage record changes when the cancel is recorded. A pass made after the owner confirmed again is not marked.
- **Claims.** Every report on an open entry keeps its claim (`keepClaim`), so another session's gets `claimed`; one that closes its entry releases the claim as `done` (`finishClaim`). See [Claims](#claims).
- **The answer** is the entry as API-248 or API-249 reads it (see [Agent reads](#agent-reads)), its claim told `mine` for the reporting session, and `changed`.
- **No log line** holds a link, a commit, a comment or a session's label (rule 5).

The coordinator chose rules for TASK-447 that no approved document states: where, by whom and in what words the comment on what a merged document lacks is written; how a report meets a pull request NEXUS has as closed or merged, and a closed entry; how a confirmation cancelled before its record merged answers; that the push writes a pass when it removes a diagram; and that a reflection and a record may share a pull request, and a project space without a repository gets `repository_mismatch`. The pull request records them with the options not taken. A removed diagram whose threads were all closed did not open then, so what waited on it stayed waiting. The feature change of pull request 154 (TASK-468) keeps such a diagram open while a proposed AI proposal or a waiting direct edit is left (see [Diagram](#diagram)), and the agent can still withdraw its proposal and report a reflection. The maintainer approved these choices, with the rules added after the review and the rebase, through the delegate they named for checkpoints on 2026-11-24, each asked on its own.

`test/reports.test.js` checks TASK-447's done condition: recording a stage's last confirmation writes its pass with the date of the last confirmation (SPEC-035). It checks the rules above, with each reflection lacking a change, a pull request closed and reopened, a shared pull request and a project without a repository, answers every response API-258 and API-259 list, and checks the tables each touches (note 23). `test/after-drawing.test.js`, `test/drawing.test.js`, `test/left-out.test.js` and `test/snapshots.test.js` check the push's reflection comment and its pass.

The two operations read and write more tables than they listed, so API-258 lists 14 tables and API-259 lists 10, and API-259 names SPEC-035. The correction at the end of the [API README](../docs/06-api/README.md), with TBL-155's trace line at the end of the [ERD README](../docs/05-erd/README.md), passed its own checkpoint on 2026-11-24, each list and line asked on its own.

## Miro import

`src/miro.js` is TASK-453: the owner imports a Miro board's sticky notes and connectors into the open workshop (API-292, `POST /api/projects/{project}/workshop/imports`, SPEC-041). Its route is in `src/workshop.js`, which writes what `src/miro.js` reads as the owner's notes and links, with the [workshop](#workshop)'s own statements and limits. The body is a Miro export of at most 5 MiB, against 2 MiB for the other bodies (TASK-415). The import takes a request key and answers `201` with what came in: `{ workshop, notes, links }`, the workshop's ID and the numbers of notes and links added.

- **No call out.** NEXUS reads only the file the owner uploads. It never fetches a Miro address, an image or an embed the file names, and it calls no Miro API. The import's code holds no network call, and a test checks that an import makes no `fetch`.
- **The file is untrusted.**
  - `JSON.parse` reads it within the 5 MiB limit, so every key is the object's own member, `__proto__` included. A body that is not JSON gets `invalid_request` on `body`.
  - The import reads fixed paths only, each an own member checked for its type, and never walks the file, so a nesting or a list anywhere else is never visited.
  - It bounds each count and length before it reads on: at most 5,000 items (the contract's `MiroBoard`), an `id` of 1 to 100 characters, a sticky note's `content` under 6,000 characters (Miro's own limit), and the first 60 characters of a frame's title.
  - A tag is matched as `<`, characters other than `<` and `>`, then `>`, so the text rules read each character a bounded number of times, whatever the content.
- **Items.** `data` is a list of at most 5,000 items. Each is an object with a string `id` that no other item has and a string `type`; otherwise the import gets `invalid_request` on `data`.
  - Only `sticky_note` items become notes. A sticky note needs a string `data.content` under 6,000 characters and numeric `position.x` and `position.y`; otherwise it gets `invalid_request` on that field, such as `data[4].position.x`.
  - `frame` items are read for their titles only, to find steps. Every other type, such as text, shape, card, image or embed, is skipped.
  - An export without a sticky note is still an export: it answers `201` with `notes` 0.
- **Kinds.** A note's kind comes from its Miro colour, `style.fillColor`. The kinds are named exactly as the design tokens name the sticky colours (`corthex.sticky` in `design/corthex/light.tokens.json`). So an imported note and the agent's draft note of the same kind carry the same text, and the screen can colour each with its token, `--corthex-sticky-<kind>`.

  | Miro colour | Kind | Step |
  | --- | --- | --- |
  | `orange` | `event` | 1 |
  | `light_pink`, `pink` | `external-system` | 2 |
  | `light_blue`, `blue`, `dark_blue` | `command` | 3 |
  | `red` | `hotspot` | 4 |
  | `light_yellow` | `actor` | 5 |
  | `yellow` | `aggregate` | 6 |
  | `violet` | `policy` | 8 |
  | `light_green`, `green`, `dark_green` | `read-model` | 8 |
  | `gray`, `cyan`, `black`, or a colour that is missing, of another form or unknown | `note` | 0 |

  `note` is a new kind string: no token colours it, so the screen leaves it uncoloured. `hotspot-answered` is a state of a hotspot, not a kind. A note's kind cannot change later, since a change (API-287) takes no kind.
- **Steps.** A note inside a Miro frame, named by its `parent.id`, goes to the step the frame's title names. Any other note goes to the step of its kind, as the table gives.
  - A title names a step when it starts with one of the 11 step names, after `Step` or `스텝` or not, in any case, and no letter, digit or hyphen follows: `2`, `Step 2 · External systems`, `1-b 타임라인`. `1-a`, the mockup's label of step 1, means step 1. `10 ideas`, `1a` and `1-c` name no step.
  - A frame whose title names no step, and a parent that is no frame of the file, leave the note to its kind.
- **Places.** A note keeps its Miro `x` and `y`, in its frame's coordinates when it is in one. Then the notes going to each step move together so that their smallest `x` and smallest `y` are 0, keeping their arrangement inside the NEXUS frame. A place still outside -1,000,000 to 1,000,000 gets `invalid_request` on `data`.
- **Text.** Miro's `content` is HTML.
  - Its tags are dropped, and a paragraph or a line break (`<p>`, `</p>`, `<br>`) becomes a space.
  - Then the entities `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;` and `&nbsp;` and the numeric ones are decoded in one pass, so that an escaped tag stays text. Another named entity, and a number that names no character, stay as written.
  - Then white space is collapsed and trimmed. A note left empty is skipped.
  - A text over 200 characters refuses the whole import with `text_too_long`, `field` `data[i].data.content` and `limit` 200, as every workshop write does. A text that is not well-formed Unicode gets `invalid_request` on the same field.
- **Links.** A `connector` item whose `startItem.id` and `endItem.id` name two imported notes becomes a link from its start to its end. Skipped: a connector to anything else, such as a frame, a skipped note or an item the file does not hold; one to the same note; and a second one between the same two notes in the same direction.
- **Who made it.** Imported notes are the owner's: `made_by` `owner` and `from_miro` true, without a credential or a confidence label, so the agent's draft cannot remove them (REQ-047). Their links are the owner's too.
- **All or none.** An import that would put more than 1,000 live notes in a step, or more than 2,000 live links on the board, is refused whole with `invalid_request` on `data`. The import is one transaction, so any refusal, a bad field late in the list or a text over 200 characters among them, leaves the workshop exactly as it was.
- **A confirmed step.** The import may add notes to a confirmed step, as the owner may change a confirmed step's notes, and the step stays confirmed.
- **Importing again.** Each import adds its notes and links, so importing the same file twice doubles them, and the owner removes what is extra: NEXUS keeps no Miro ID (TBL-164). A retry with its first request key gets the first answer and writes nothing.
- **What the owner learns.** The answer's numbers only, as the contract gives them: the screen (TASK-462) can say how many notes and links came in. What was skipped is not counted.
- **A closed workshop.** Without an open workshop, the import gets `workshop_closed`. A name no project space has gets `project_not_found`.
- **No log line** holds the file's text, a Miro address or the project's name (rule 5). A refusal names the field and never repeats its value.

### Miro's shapes

The contract's `MiroBoard` is "the items of a Miro board as Miro's REST API exports them". The import follows Miro's REST API v2 reference. These are the pages read on 2026-11-24, found through the index at https://developers.miro.com/llms.txt, each with the date it was last updated:

| Page | Updated | What it gives |
| --- | --- | --- |
| [Get items on board](https://developers.miro.com/reference/get-items-1) | 2026-06-30 | The page `{ data, total, size, cursor, limit, links }`; each item's `id` and `type`, both required, and its `data`, `style`, `position`, `geometry` and `parent` |
| [Get sticky note item](https://developers.miro.com/reference/get-sticky-note-item-1) | 2026-04-21 | `type` `sticky_note`; `data.content` and `data.shape`; `style.fillColor` with its 16 colours, `light_yellow` by default; `position` with `origin` `center` and `relativeTo`; `parent.id`, "the parent frame for the item" |
| [Get frame item](https://developers.miro.com/reference/get-frame-item) | 2026-07-07 | `type` `frame` and `data.title` |
| [Get connectors](https://developers.miro.com/reference/get-connectors-1) | 2026-04-21 | `startItem.id` and `endItem.id`; `id` is the only member required |
| [Children inside parent items](https://developers.miro.com/docs/children-inside-parent-items) | 2026-03-19 | A child's `x` and `y` are relative to its parent's top-left; a frame is the only parent supported |
| [Frame coordinates to board coordinates](https://developers.miro.com/docs/frame-coordinates-to-board-coordinates) | 2026-03-19 | The board's centre is `x` 0, `y` 0; how a frame's coordinates become the board's, which the import does not do |
| [Web SDK: sticky note](https://developers.miro.com/docs/websdk-reference-sticky-note) | 2026-03-19 | `content`'s HTML: `<p>`, `<a>`, `<strong>`, `<b>`, `<em>`, `<i>`, `<u>`, `<s>` and `<br>`, other tags escaped; under 6,000 characters |
| [Web SDK: connector](https://developers.miro.com/docs/websdk-reference-connector) | 2026-03-19 | A connector's `type` is `connector` |

Where a form was not documented, and how the import reads it:
- **A connector's `type`.** The REST reference describes it as "Type of board object that is returned", with no value. The import reads `connector`, the Web SDK's value. A connector without a string `type` is refused with the file, as any item is.
- **Connectors in the file.** The REST API lists connectors on their own endpoint, not among the items. The import reads them in the same `data` list, as items of type `connector`.
- **`content`'s HTML.** The REST reference calls it "the actual text (content) that appears in the sticky note item"; only the Web SDK says it is HTML and names its tags. The import reads it as HTML.
- **`relativeTo`.** Its value when it is missing is not documented, so the import does not read it: a note with a parent has its frame's coordinates, as "Children inside parent items" says, and any other note the board's.
- **A child of a parent Miro does not support,** such as a Kanban, a mind map, a table or a story map, has an `x` and `y` of -Infinity, which JSON cannot hold. Written as anything but a number, such a note gets `invalid_request` on its `position`.

`test/miro-import.test.js` builds its board from these pages' examples: the sticky note's ID and its content `Hello`, the parent frame's ID, the frame title `Sample frame title`, the user and the times, the connector's caption and style, the image's and the embed's addresses, the items page's cursor, and the Web SDK's sticky note, whose content is `<p>This is a sticky note. It looks just like the actual paper one.</p>`.

The coordinator chose these rules for TASK-453: the items, links, steps, colours and kinds, places, text, what is skipped, the limits, a confirmed step and importing again. The maintainer approved them, with the new kind string `note`, through the delegate they named for checkpoints on 2026-11-24, each asked on its own.

`test/miro-import.test.js` checks TASK-453's done condition: every response API-292 lists. It also tests:
- the documented board through each rule above, and the colours and kinds against the design tokens;
- the file as hostile input: a nesting a million deep and a list of a million numbers where nothing is read, the same nesting where something is, prototype keys, wrong types, and 5,000 items against 5,001;
- that a refused import, over a limit, with a bad field late in the list or with a text over 200, leaves the workshop exactly as it was;
- a confirmed step, importing twice and the request key;
- no `fetch`, the log, and the tables the import touches (note 23).

API-292 finds the project space by its name and the open workshop, so it lists TBL-147 and TBL-162 too, and its 400 response gains a `text_too_long` example. The correction at the end of the [API README](../docs/06-api/README.md) gives both, and passed its own checkpoint on 2026-11-24, each asked on its own.

## Pinned-hub run

TASK-449 (SPEC-014) runs the pinned hub's eight agent commands against this server. `tests/test_hub_run.py` is one of the repository's unit tests (`python -m unittest discover -s tests`), which the `tests` job of `.github/workflows/check.yml` runs for every pull request with Python 3.12 and Node 24, the two it already sets up. `tests/hub_run_server.mjs` starts the server with Node: a new store in a throwaway data folder, every operation of `src/routes.js` on a free port of 127.0.0.1, and a gate whose key pair it makes at run time, as the server's tests make one (`localGate`). The test signs in as the owner with that gate's stand-in sign-in, issues an agent credential through API-280, and gives the hub the address, the credential and a session in the environment it reads with no profile: `CORTHEX_NEXUS_URL`, `CORTHEX_NEXUS_CLIENT_ID`, `CORTHEX_NEXUS_CLIENT_SECRET`, `CORTHEX_NEXUS_PUSH` and `CORTHEX_NEXUS_SESSION`. The hub is the clean checkout at the commit of `hub-ref.json`, as in the other hub tests. No real address, credential or gate value is used, and nothing is fetched.

| Command | Operations | What the run checks | Every response the operation lists |
| --- | --- | --- | --- |
| `push --first`, and the push job's `push --job` | API-243, API-242 | The first push makes the space at revision 1 in `corthex-hub/0.2`. After a commit, the push job sends revision 2 in `corthex-hub/0.3`, which replaces the first. | `test/snapshots.test.js`, "answer every response API-242 and API-243 list", and through the hub in `tests/test_hub_compatibility.py` |
| `todo` | API-245 | It lists the thread, the reflection and the confirmation's record that the owner's writes put on the agent to-do, and the hub names them as new. | `test/todo.test.js`, "answers every response API-245 lists" |
| `claim` | API-250 | The session holds the thread's entry. | `test/claims.test.js`, "answers every response API-250 and API-251 list" |
| `comment` | API-252 | A comment on TBL-146 of the ERD opens a thread that waits on the owner. | `test/comments.test.js`, "answer every response API-252, API-253, API-254 and API-255 list" |
| `decide` | API-255 | The thread holds the decision with its link and waits on the owner again. | the same test |
| `reflect` | API-258 | `opened` links the owner's direct edit to a pull request, and the claim names it. | `test/reports.test.js`, "answer every response API-258 and API-259 list" |
| `record` | API-259 | `opened` links the sitemap's confirmation to the pull request. | the same test |
| `status` | none | It writes the stage record, with the NEXUS checkpoint's ID, in `.corthex/stages/nexus.json` and contacts no server. The push job's next push carries the record in its snapshot (API-242). | API-242's |

- **Read without error.** A command's answer is read when the hub exits 0 with the outcome `done`, no problem, no failure and no remark, and nothing waits in its outbox. The hub reads each answer itself: a to-do answer without `read_at`, for one, gets the remark `server-older`.
- **The owner's side** is made through the owner operations, as the screens send them: a reply in the agent's thread (API-268), a direct edit that renames TBL-146 (API-272) and the sitemap's confirmation (API-275).
- **Answers that refuse by design** are read too:
  - `todo` before the first push reads `space_not_found` as an empty to-do, with exit 0.
  - `push` without `--first` reads `project_not_found` from API-243, sends nothing and exits 1 with "first push needs --first", the user's yes it waits for.
  - Another session's `claim`, and its `decide`, on the entry the first session holds get `claimed` (409) with the holding session. The hub exits 1 with the Problem and does not keep the write to send again.
  - The push job sends the first push's commit again in `corthex-hub/0.3` once, as `same_commit`, then nothing, as `already-held`.
- **The log.** The server's log names, in order, the operations each command called. None of its lines holds the credential's secret or its digest, the owner's sign-in, the data folder, a session, a pull request's link or a comment's text (rule 5).
- **The checkpoint's link.** With `--nexus`, the hub's `status` needs an https link for the checkpoint: `--where`, or else a link it builds from `nexus.url` in the device's profile, `<nexus.url>/overview/<project>/<part or _>/<stage>#<checkpoint>`. That is v2's address. This server shows a stage at `/p/<project>/<part or _>/<stage>` (SCR-145, see [App shell](#app-shell)) and answers `/overview/...` with its 404 page. So the run passes `--where` in this server's form, on a placeholder host, and until the pinned hub builds this server's address, a checkpoint that names a NEXUS checkpoint needs `--where`.

The coordinator chose these rules for TASK-449: what `status` answers, the checkpoint's link and the owner's sign-in in the test. The maintainer approved them through the delegate they named for checkpoints on 2026-11-24, each asked on its own. The hub change that builds this server's address, and its publication, are asked of the maintainer at TASK-463; until then the pinned hub and its pin stay as they are.

## Answers

- An operation answers JSON. A refusal is a Problem as `application/problem+json`, with `title`, `status`, `detail`, `code`, `traceId` and the members its code carries, such as `field` or `limit`. Its shape is exactly `components.schemas.Problem` of the contract.
- The registry (`src/problem.js`) holds every code of `components.x-corthex.errors` with its status, title, members, `message` and `message_ko`. The Problem schema allows no other member, so the two messages are not sent with an answer. They stay in the registry, as `ERRORS` and on each `Problem`, so that the pages can show a refusal in Korean with what to do next, by its code (rule 7). The [app shell](#app-shell) serves the Korean ones as `/web/messages.js`.
- A path that is no operation answers `not_found` (404). Under `/api/spaces` its detail names the agent commands NEXUS takes: push, todo, claim, comment, decide, reflect, status and record (SPEC-014). The detail never repeats the path.
- A path that takes other methods only answers `method_not_allowed` (405) with `Allow`.
- A request that admission refuses answers `unauthenticated` (401), `not_owner` (403), `cross_site` (403), `owner_only` (403), `access_missing` (401) or `agent_only` (403), as above.
- A handler that fails answers `internal` (500), whose `traceId` finds the request in the log.
- Every answer carries `X-Content-Type-Options: nosniff`.
- A route may name `media`, `text/html` for a page, for a GET only: its handler then returns the page's text, sent with that type and `charset=utf-8`. API-293 is the one so far. A route may also name `headers`, which every answer of its operation carries once its path and method match, its refusals and faults included, as API-293's `Content-Security-Policy`; `Content-Type`, `X-Content-Type-Options` and the headers that frame the message, such as `Content-Length`, `Connection` and `Transfer-Encoding`, stay the server's.

## Log

The server writes one JSON line to standard output for each request, when its answer ends or its connection drops:

| Field | Value |
| --- | --- |
| `time` | When the request arrived, in UTC. |
| `traceId` | 16 random hex digits, or the gate's `CF-Ray` once the owner's sign-in or a live agent credential is admitted and the ray has the form of the contract's `traceId` (16 hex digits, a hyphen and the data centre's 3 letters). Anyone who reaches the server without the gate can send a `CF-Ray`, but only the gate signs the owner's sign-in and only NEXUS issues a credential. Both are bearer secrets, though, so their holder, reaching the loopback server without the gate, could still choose the ray of their own requests. A Problem answer carries the same ID. |
| `method` | The request's method. |
| `action` | The `operationId` of the operation, or `null` for a path that is no operation, a page of the [app shell](#app-shell) included. |
| `sender` | Who sent the request: `owner` once the owner's sign-in is checked, the credential's name once a live agent credential is checked, otherwise `unknown`, never a name the request gives (rule 8). A write refused because its credential was revoked while it waited is `unknown` again. |
| `status` | The answer's status, or `null` when the connection dropped before the answer started. |
| `code` | The Problem's code, or `null`. |
| `ms` | How long the answer took, in milliseconds. |
| `reason` | Only when the owner's sign-in was not admitted for want of a valid one: the check it failed, `no_sign_in`, `malformed`, `unknown_key`, `bad_signature`, `wrong_issuer`, `wrong_audience`, `expired` or `not_yet_valid`, or `keys_unavailable` when the keys could not be read. On an agent operation without a live credential: `no_credential` (neither header), `malformed` (a header missing or not in its form), `unknown_credential`, `wrong_secret` or `revoked`. The answer is `access_missing` whatever it is; only the owner's log tells them apart. |
| `error` | Only when a handler failed or a refusal could not be sent: the kind of error, a built-in error type with Node's code if it has one, such as `Error ENOENT`. |
| `aborted` | Only when the connection dropped before the answer ended: `true`. |

It also writes a line when it starts listening (with its host and port), when it stops and when a setting is invalid, and one line in place of Node's report when it crashes. Before it listens it writes one line about the store: `store_opened` with the store's `version` and the migrations it `applied`, `store_refused` with a `reason` (`not_a_v3_store`, `newer_store`, `migrations_invalid` or `foreign_keys_broken`), or `store_failed` with the kind of `error`. None of them names the data folder. The daily backup writes a line for each attempt:
- `backup_succeeded`, with the backup's `day`, its `attempt`, its `bytes`, how many old backups it `removed` and its `ms`;
- or `backup_failed`, with the `day` and the `attempt`, and either a `reason` or the kind of `error`. The reason is `not_enough_disk`, or `interrupted` for an attempt left running by a crash or by a store that could not record its end.

It writes `backup_recorded`, with the `day`, the `attempt` and the `bytes`, for an attempt left running whose backup is whole. It also writes `backup_removal_failed`, with the `day` and the kind of `error`, after a backup that succeeded when the old backups could not be removed. When the job cannot read or write the store, it writes `backup_job_failed` with the kind of `error`, and looks again within the hour. None of them names a folder or a file's path.

The [tool status read](#tool-status) writes `tool_status_read` for each round and tool that asked anything, with:
- the `tool`, `notion` or `jira`;
- how many links were `read`, `failed`, or gave no ID (`no_id`);
- `failures`, up to 20: each with the `link`'s ID, the `kind` (`refused`, `not_found`, `busy`, `redirect`, `server`, `rejected`, `timeout`, `network` or `answer`) and the HTTP `status`, or null.

When a round cannot read or write the store, it writes `tool_status_failed` with the kind of `error`. Neither holds a token, an address, a page ID, a project key, the site or the account.

So every refused request is logged with its time, its action, its sender and its reason, the Problem's `code` (rule 8). No line holds a credential's secret or digest: the sender is the credential's name, which the owner chose, and the reason is one of the words above.

Rule 5 of the [functional spec](../docs/04-functional-spec/spec.md) keeps an agent credential's secret, a credential digest, a sign-in token, a server path and the text of a refused file out of every log line. So no field is copied from the request, its path, query, headers or body, or from an error's message or stack; `test/logs.test.js`, `test/main.test.js` and `test/admission.test.js` check this, the data and backup folders, the owner's sign-in and the emails included, with values made at run time. No line names a gate setting or a request key's digest either (`test/keys.test.js` checks the digest).

## Picture layout

`src/layout.js` is TASK-420: a layered layout, top to bottom, that places the boxes and lines of the DDD board, the ERD, the user flows and the sitemap tree (SPEC-003, SPEC-004, SPEC-006, SPEC-007). The drawing tasks, TASK-421 to TASK-425, give it their boxes and lines and draw what it returns; it draws nothing itself. Question 3 of the [WBS](../docs/10-wbs/wbs.md) chose to write it in this repository rather than take a layout library such as ELK or dagre. It imports nothing, so a page can load the same file.

```js
import { layout } from './layout.js';

const { bounds, nodes, edges } = layout({
  nodes: [
    { id: 'TBL-146', width: 200, height: 120 },
    { id: 'TBL-167', width: 200, height: 80 },
  ],
  edges: [{ from: 'TBL-167', to: 'TBL-146', label: { width: 40, height: 16 } }],
});
```

| Input | Meaning |
| --- | --- |
| `nodes[].id` | The box's key, a text no other box has, such as an element's key. |
| `nodes[].width`, `nodes[].height` | The box's size, from 1 to 100000. |
| `nodes[].layer` | Optional. Pins the box to a layer, from 0 to 1000, such as the rows of a board by kind of note. Without it the box goes one layer below every box that points to it. |
| `nodes[].position` | Optional. `{ x, y }`, where the owner put the box (SPEC-012). The box stays there and the other boxes keep clear of it. No drawer fills it, since no drawing reads a position (see [Moving an element](#moving-an-element)); the workbench does, to draw a moved box with its lines (see [Workbench pictures](#workbench-pictures)). |
| `edges[].from`, `edges[].to` | The ids of the two boxes a line joins. |
| `edges[].label` | Optional. `{ width, height }`, the room the line's label needs. |
| `direction` | Option: `TB`, layers top to bottom (the default), or `LR`, left to right, as a Mermaid `flowchart LR`. |
| `nodeGap`, `layerGap`, `edgeGap` | Options: the space between two boxes of a row (32), the least space between two rows (48), and between two lines side by side and from a line to its label (12). |

It returns `nodes` and `edges` in the order of the input. A node has its `id`, `x` and `y` (the top left corner), `width`, `height`, the `layer` it got and `fixed` (whether it kept a position). An edge has `from`, `to`, its `points` from the edge of the first box to the edge of the second, and its `label` box or `null`. `bounds` is the box that holds them all, for an SVG `viewBox`; its corner need not be at 0.

- The same input gives the same output: every tie is broken by input order, and nothing depends on the clock or on chance. The numbers the layout works out are rounded to two decimal places; sizes and fixed positions come back as given. Where a size or a fixed position has more decimal places, a line's end and `bounds` round away from the box, by less than 0.01, so that a line never starts inside its box and `bounds` holds everything.
- No two boxes overlap, labels included. A box or label the layout places keeps clear of a fixed box over the whole height of its row; two fixed boxes may overlap, since the owner put them there, and so may the labels drawn with them.
- A line leaves the bottom of its box and enters the top of the next (the right and the left in `LR`), runs only across and down, and turns on its own track in the gap between two rows, so it passes through no box or label the layout places. A label sits beside its line. A line to its own box, or between two boxes pinned to one layer, dips under their row. A line that closes a cycle, such as a flow's way back, points up. A drawing task that draws another shape than a rectangle, such as a decision's diamond, moves the first and last point along their segment to the shape's outline.
- A fixed position only leaves room for SPEC-012: the box stays where the owner put it, and the boxes and labels the layout places keep clear of it. This task builds no moving, and no drawer gives a fixed position (see [Moving an element](#moving-an-element)): the workbench draws a moved box and the lines that meet it with these rules on the ERD, the sitemap and the user flows (see [Workbench pictures](#workbench-pictures)). A line with one fixed end follows the layout's route until it would first run through the fixed box, then runs straight to the box's edge, so it never runs through that box. A line between two fixed boxes runs straight from one to the other, its label beside its middle, so lines between the same two fixed boxes lie on one another. A line from a fixed box to itself moves with the box, label included. The boxes the layout places keep clear of these labels, but a line to a fixed box may cross other boxes, the box at its other end included, and its end on the fixed box lies where a line from the box's middle leaves the box, even where the box stayed in its place in the layout. Rows and gaps keep their sizes, so that moving one box never shifts the others: a fixed box, or a label drawn with fixed boxes, may lie across a line between other boxes, and where boxes move clear of a fixed box, the lines in a gap may run closer than `edgeGap`. Where a fixed box covers part of a line, or boxes move clear of one, a label may stand apart from its line.
- Boxes that no line joins stand side by side in input order, such as the columns of a board in time order, and share the rows.
- An invalid input throws a `TypeError` or `RangeError` that names the field and its rule, never the value.
- A graph that needs more than 200000 boxes and points where lines cross rows is refused with a `RangeError`, so that no input holds the caller for long; the densest test graph of 300 elements needs about 23500. Keeping clear of fixed boxes takes at most one pass a row over the fixed boxes and the labels drawn with them, in order of their left side.
- `test/layout.test.js` places 300 elements in each shape in under 1 second on the check runner, half of REQ-070's 2 seconds, which stage 12 measures in the browser.

## Tests

```sh
cd server
node --test
```

Node's own test runner runs `test/*.test.js`. `test/contract.js` reads [api/openapi.yaml](../api/openapi.yaml) with Node alone, as `tests/yaml_subset.py` does, so that the tests check the registry, the limits, the request key, the path parameters' forms, each operation's answers and the tables it touches against the contract. `.github/workflows/check.yml` runs them on Node 24 for every pull request, and `all-checks` waits for them.
