# NEXUS v3 server

[한국어](README.ko.md)

The server of NEXUS v3, built task by task from the [WBS](../docs/10-wbs/wbs.md). It runs on Node 24 with Node's own modules and has no dependency to install. It runs behind the Cloudflare Access gate, as v2 did.

It has TASK-413's skeleton, a router for the operations of [api/openapi.yaml](../api/openapi.yaml), settings from the environment and one log line per request; TASK-414's store, the database that the migrations of [db/migrations](../db/migrations/) build; TASK-415's request layer: the error registry, the body limits, JSON only, request keys and one write at a time; TASK-416's admission, which checks the gate's sign-in of the one owner on every owner request; TASK-417's agent credentials: the owner issues, lists and revokes them, and every agent request is checked by its pair; TASK-418's [snapshot intake](#snapshot-intake), where the hub's push keeps a project's snapshot; TASK-419's [drawing](#drawing), which draws a kept snapshot into diagrams, drawings and elements through each stage's drawer; TASK-421's [DDD board](#ddd-board), the drawer of stage 01; TASK-422's [ERD](#erd), the drawer of stage 05; TASK-423's [item table](#item-table), the drawer of the stages without pictures; TASK-425's [sitemap](#sitemap), the drawer of stage 07; TASK-426's [screen states](#screen-states), the drawer of stage 08; TASK-435's [after a drawing](#after-a-drawing), what a push changes once it has drawn: confirmations, stage passes, reflections and threads; TASK-433's [to-do entries](#to-do-entries), the one place that opens and closes the entries of the owner's to-do and the agent to-do, with the agent to-do it answers; TASK-434's [claims](#claims), by which an agent session holds an entry of the agent to-do alone, keeps it and lets it go; TASK-437's [comments](#comments), by which an agent comments on a diagram, replies, marks a thread answered and reports where a decision is recorded; TASK-440's [project read](#project), a project's stages with their diagrams and states, its stage passes and its tool links; TASK-439's [projects and to-do](#projects-and-to-do), the project list and what waits on the owner, with the warning of a failed backup; and TASK-448's [project removal](#project-removal), what deleting a project space removes and the deletion. It takes the operations of `src/routes.js`, so far API-242, API-243, API-245, API-250, API-251, API-252, API-253, API-254, API-255, API-262, API-263, API-264, API-277, API-278, API-279, API-280 and API-281; every other path answers the `not_found` Problem until the tasks that build its operations add them. It also holds TASK-420, the [picture layout](#picture-layout) the drawing tasks use.

## Running

```sh
cd server
NEXUS_DATA_DIR=/absolute/path/to/a/data/folder \
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
| `NEXUS_ACCESS_ISSUER` | none | The gate's team address, `https://<team>.cloudflareaccess.com`: the issuer its sign-ins name, under which `/cdn-cgi/access/certs` lists their keys. An https origin with no path, port or query. |
| `NEXUS_ACCESS_AUD` | none | The audience tag of the gate's NEXUS application, 64 lowercase hex digits. |
| `NEXUS_OWNER_EMAIL` | none | The email address of the one owner, as the gate's sign-in carries it; matched without case. |

An empty variable takes the default; `NEXUS_DATA_DIR` and the three gate settings have none and must be set. An invalid value stops the server with exit code 1 and one line that names the setting and its rule, never the value, since a value set by mistake can be a secret.

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

1. **Path and method.** A path that is no operation answers `not_found`; one that takes other methods only answers `method_not_allowed`.
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

A write runs in one transaction (`BEGIN IMMEDIATE` to `COMMIT`), from its request key's check to its key's row, so a write that fails or is refused changes nothing. The same queue runs admission's note of when a credential was last used, so that note never lands inside another write's transaction. Its handler may wait (`await`), and the next write waits with it. A read that runs meanwhile on the same connection sees the write's rows before they commit, so a write handler does its waiting before it writes. A handler never begins or ends a transaction itself. It refuses by throwing a Problem. A success is 200 or 201 with a non-empty JSON object, as the contract makes every success. Any other answer, such as another status, a body that is not such an object or a framing header, is a fault that answers `internal`; a write's answer is checked before anything is stored, so such a write changes nothing.

**Request keys** (rule 3, `src/keys.js`). The first answer to each key is kept in TBL-169 `request_keys`. It is the request layer's own table: every write with a key fills it, so no operation lists it (note 21 of the WBS).
- The same key from the same caller within 7 days gets the first status and answer, and nothing is written. The key keeps the answer's status and body, not headers of the write's own, which no operation with a request key has in the contract. Keys are kept 7 days, beyond the 24 hours that rule 3 asks, because the hub keeps an unsent write that long and sends it again under the same key.
- The `action` column holds the `operationId`, a space, and the SHA-256 in hex of the request's path and body bytes as sent. The same key sent again for another operation, another path or another body therefore finds another action and gets `request_key_reused` (409). The digest is of the request, not of a credential. It lives only in the owner-only store, and no log line holds it (rule 5).
- A refused or failed write leaves no key behind, so the same key runs it again.
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
- `test/responses.js` checks each answer against the response the contract lists for its status, schema included, and that every listed response was answered, each Problem code its examples give included.
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

**Drawing.** After it keeps a snapshot, the push draws it in the same transaction, as [Drawing](#drawing) says, and the answer's `diagrams` and `failures` say what it drew. The same commit again in the same or an older format draws nothing: every diagram is `unchanged`, except one whose source in the push failed, which is `failed` and named in `failures` again. What a drawing changes after it, which the answer counts in `confirmations_invalidated`, `change_sets_reflected` and `threads_moved`, is in [After a drawing](#after-a-drawing).

`test/snapshots.test.js` sends 0.2 and 0.3 snapshots of this repository that `test/snapshots.js` builds from its files when the tests run, so no snapshot file is kept in Git. It builds 0.2 from the schema too, rather than with the pinned hub, because the server's tests run with Node alone. It makes every secret-looking and email-looking value at run time from parts. Its pushes draw with the test drawers of `test/drawers.js`, so its answers count diagrams.

## Drawing

The push draws each snapshot it keeps into diagrams (TBL-151 `diagrams`), a drawing of each diagram from the snapshot (TBL-152 `drawings`) and the drawing's elements (TBL-153 `elements`), in the push's transaction (`src/drawing.js`; SPEC-001, SPEC-005). Each stage's drawer, TASK-421 to TASK-427, turns a document into elements and plugs in through `DRAWERS`. TASK-419 built what they plug into, and its tests draw with drawers of their own. `DRAWERS` holds TASK-421's [DDD board](#ddd-board), TASK-422's [ERD](#erd), TASK-423's [item table](#item-table), TASK-425's [sitemap](#sitemap) and TASK-426's [screen states](#screen-states) drawers so far. What the drawers share is in `src/drawer.js`: the `SourceFailure` they throw, element keys, the contract's limits, the reading of a picture's entries and warnings, and the placing of boxes sized for their text. A drawer imports it in place of `src/drawing.js`, so no two files import each other.

**Diagrams.** A diagram is drawn from one document of the snapshot. Its `source_key` is that document's path in `snapshot_files` (see Documents above), so a drawing finds its source from the diagram alone.

| Stage | Diagrams | `source_key` | Kind |
| --- | --- | --- | --- |
| 01, 05, 07 | one per stage and part | `/pictures/<stage>` or `/pictures/<stage>/<part>` | `ddd_board`, `erd`, `sitemap` |
| 03, 08, 09 | one per file | the file's key, its path in the repository | `user_flow`, `screen_states`, `mockup` |
| any other stage with items, or that the hub read | one | `/items/<stage>` | `item_table` |
| 03, 08, 09 while they show no picture (see [Item table](#item-table)) | one | `/items/<stage>` | `item_table` |

- **Removed.** A diagram whose document a snapshot does not hold gets `removed_at`, and is no longer one of its stage's diagrams. The exception is a picture of a stage whose pictures the snapshot's format does not carry. It stays as last drawn, so a corthex-hub/0.2 snapshot after 0.3 pictures keeps them, each drawing's version naming the commit it comes from (SPEC-005).
- **Back again.** A removed diagram whose document a snapshot draws again comes back as the same row, with its threads. A stage's item table makes way for the first picture drawn of its stage, and comes back when the stage has none again (see [Item table](#item-table)). So a 0.2 snapshot after 0.3 pictures still shows the pictures.
- **No pictures.** A stage of 03, 08 or 09 that shows no picture shows its item table, under a format that carries its pictures as under one that does not (note 3 of the WBS; see [Item table](#item-table)).
- **A completed revision**, the same commit in a newer format, draws only the stages the newer format adds: their pictures, and their items again, those the revision kept before, so that each of their item tables makes way for its pictures or stays. An older push may not have kept a stage's items, such as one its hub did not read; that stage draws no table.
- **A diagram's part** is in its `source_key` for a stage's picture, and an item table has none. The store's columns keep no part for a file's picture. The snapshot's `/snapshot` document names it beside the file's key, except in a revision that a newer format completed, which added only the files.

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

## DDD board

`src/ddd-board.js` is TASK-421, the drawer of the `ddd_board` kind. It draws the stage-01 picture as one board of the timeline lanes, the contexts with their command tables, the dependencies between them and the hotspots (SPEC-003). Its source is the pinned hub's parsed picture of the project's domain document, as the contract's `Snapshot` says of stage 01, so NEXUS parses no Markdown. The hub's `domain.py` reads the document. Its picture, format 1, holds:

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

## ERD

`src/erd.js` is TASK-422, the drawer of the `erd` kind: it draws the stage-05 picture as tables with their columns and keys, and a line for each foreign key (SPEC-004). Its source is the pinned hub's parsed picture of the project's schema, as the contract's `Snapshot` says of stage 05, so NEXUS parses no SQL. The hub's `erd.py` reads the schema, and its picture, format 1, holds each table with its trace ID, name, columns (name, type, whether it takes null, and where), primary key, unique rules, foreign keys and where, the file and line it comes from.

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

`src/sitemap.js` is TASK-425, the drawer of the `sitemap` kind: it draws the stage-07 picture as a tree of the sitemap's screens (SPEC-007). Its source is the pinned hub's parsed picture of the project's sitemap, as the contract's `Snapshot` says of stage 07, so NEXUS parses no YAML. The hub's `sitemap.py` reads the YAML. Its picture, format 1, holds each screen with:
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

So the table makes way for the first picture drawn of its stage, and comes back, the same diagram with its threads, when the stage has none again. Until TASK-424, TASK-426 and TASK-427 add their drawers, the server draws no file of 03, 08 or 09, so those stages show their item tables in both formats.

**Stage with no items.** A stage whose record in the snapshot says the hub read its source (`read` true) and that has no items keeps an empty `/items/<stage>`, which draws an empty table: the page says the stage has no items yet (SCR-145). A truncated snapshot keeps none, as above. A stage the hub did not read, one with no source or with a missing or skipped one, has no table and shows "Nothing sent yet". A read stage whose items all go keeps its table, with no rows. With a drawer for every kind, as the tests give, this repository's push draws 12 diagrams in corthex-hub/0.2 and 28 in 0.3, where it drew 8 and 26: the empty tables of 08, 09, 12 and 13 in 0.2, and of 12 and 13 in 0.3, where 08 and 09 show their files.

**An empty table can be confirmed.** An empty table is a drawn item table, so the owner can confirm it (SPEC-029), and a stage whose only table is empty passes once that confirmation is recorded (SPEC-035). SPEC-035's "a stage with nothing to confirm" is one with no diagram or table at all, which shows "Nothing sent yet". The page shows what such a confirmation confirms (TASK-461).

**A row's content.** A row keeps the IDs it links to, and the drawing reads only its own stage's items. So a title changed in another stage draws no table again and invalidates no confirmation of it (SPEC-033). The page shows each link by its name, which the read of a diagram gives (TASK-441, API-265) from the project's latest item documents. `itemNames(texts)` in `src/item-table.js` maps IDs to titles from those documents for it. A link it cannot find, or whose item has no title, is shown by its ID, as SPEC-010's exception says.

**Making way.** An item table that makes way for its stage's pictures gets `removed_at` at that push and no new drawing. Its last drawing keeps its rows, and its threads stay on them: SPEC-027 moves none of them (SPEC-005). While it has open threads, the project read lists it after the pictures, marked removed. `drawSnapshot` marks such a table `madeWay` in the list it returns, so [after a drawing](#after-a-drawing) moves none of its threads: an item table removed while its stage shows a picture after the push. One removed because its stage is no longer read did not make way, and SPEC-027 moves its threads to the diagram. A table that appears, or comes back without a live confirmation, marks its stage's latest pass changed, as any diagram that appears does.

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
- **The state table.** It is the first Markdown table of the file, outside a fenced code block and a front-matter block, any of whose rows starts with a state ID such as `SCR-142#normal`. A state ID is a trace ID, `#`, and a state: a lowercase letter and up to 30 lowercase letters, digits, hyphens and underscores, as the hub reads states. The table has the stage-08 template's three columns: the state, what the user sees and can do, and the responses that lead to it.
- **A table** is a line that starts with `|`, a separator line under it, and the lines that start with `|` after them, as the hub reads tables. A cell ends at a `|` that no backslash escapes.
- **The diagram's name** is the file's first heading of level 1, as written, such as `SCR-142 Owner to-do`. A file with none keeps the file's name.

What it draws:

| Element | `kind`, `status` | `detail` |
| --- | --- | --- |
| Each row of the state table, in the table's order; its key and name are the state as written | `state`; `no_description` when it has no description | `description`, `responses`, `where` and `box` |

The coordinator chose the next five points for TASK-426. The pull request records them with the options not taken.

- **Order.** The panels follow the rows of the state table, in their order.
- **Grid.** The drawer works out a grid of three columns itself, as the stage-09 mockup draws the panels of stage 08 at 1440 pixels. `layout.js` puts boxes that no line joins in one row, so it makes no grid.
  - The panels fill each row left to right in the table's order. A panel is 328 pixels wide, a third of the mockup's 1008-pixel board column, with 12-pixel gaps.
  - A panel is at least 168 pixels high, and as high as its text needs. It has 12 pixels of padding above and below and 16 at the sides, and 8 pixels between its name, its description and its responses.
  - Text is measured at 20 pixels a line and 7.2 pixels a character, so a line holds 41 narrow characters; a wide character such as Hangul counts twice. Text wraps at spaces, and a word longer than a line breaks at the line's end. An empty description or list of responses still takes a line, where the page shows "No description" or `-`.
  - A row is as high as its tallest panel, and every panel of the row is that high. A panel is at most 100000 pixels high, the largest box `layout.js` takes. So a very long table places its panels past 1,000,000 pixels, as a very wide sitemap does.
  - `box` is `{ x, y, width, height }`, the panel's top left corner and its size. The page shows one column on a phone (TASK-458), where moving is not offered.
- **Description.** It is the second cell as written: Markdown such as a code span is kept, and only `\|` is unescaped. TASK-458 decides how to show it.
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
- **Warnings and other documents.** A screen file has no `picture-partial` checks, so the drawer reads no warnings. It reads no other document either, so a drawing's digest is its file's.

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
- which table is the state table: the first with state rows, outside code fences and front matter;
- a state table it cannot read, which fails at its line or at the file, and through the push keeps the last good drawing;
- keys;
- that no log line holds the file's text (rule 5).

## After a drawing

`src/after-drawing.js` is TASK-435: what the push changes once it has drawn a snapshot, in the same transaction, before it answers (API-242; SPEC-025, SPEC-027, SPEC-033, SPEC-035). Beside the answer's counts, `drawSnapshot` returns each diagram it created, brought back, drew again or removed. `afterDrawing` takes that list, for a new snapshot and for a revision completed in a newer format alike. The answer counts what it did: `confirmations_invalidated`, `change_sets_reflected` and `threads_moved`.

- **Confirmations** (SPEC-033). A new drawing that drew invalidates the diagram's live confirmation when the documents it read differ from those of the confirmed drawing (their `source_digest`). A change only in a file the diagram does not draw from keeps it, and so does a change that comes back to the confirmed text. A failed drawing invalidates nothing: the diagram still shows its last good drawing (SPEC-001).
- **Stage passes** (SPEC-035, TBL-161). A pass stays in the record and gets `changed_at`, which the project read shows as `changed_since_pass`:
  - when a confirmation it rests on is invalidated: every pass of the stage made since that confirmation was confirmed and not marked yet;
  - when, after the stage's latest pass, a diagram of the stage appears without a live confirmation: drawn for the first time, back from removal, or a picture that replaces the stage's item table. No approved document states this rule. The coordinator chose it for TASK-435, since SPEC-035's pass rests on a recorded confirmation for every diagram, and the maintainer approved it through the delegate they named for checkpoints. A removed diagram changes no pass, since it counts for none (SPEC-027).
- **Reflections** (SPEC-025). The accepted change sets of a reflection pull request whose reported merge commit is the drawn snapshot's commit are reflected, at the drawing the diagram shows after the push: its latest that drew, since a failed drawing shows the last good one (SPEC-001). Only that exact commit marks them, as API-258 says. They are reflected even when the drawing lacks the change; the comment that says what is missing is TASK-447's (note 26 of the WBS). A proposal's thread then closes, `closed_by` `reflection`, once none of its change sets is proposed or accepted.
- **Threads** (SPEC-027). An element leaves its stage document when a drawing of its diagram that drew no longer has it or draws it as unreadable, or when the snapshot removes its diagram. An item table that makes way for its stage's pictures (SPEC-005) is the exception. The element's open threads move to the diagram: `target_kind` `diagram`, the key kept and `removed_name` its last readable name. An element whose part was left out as unreadable counts as gone and takes the same mark (note 2 of the WBS).
  - When a later drawing has the element again, readable, its threads stay on the diagram and link to it again: `removed_name` is cleared.
  - A failed drawing moves nothing. Neither does a corthex-hub/0.2 snapshot that keeps a stage's pictures, since it removes none.
  - A removed diagram stays listed while it has open threads (see [Project](#project)).
- **The to-do** follows through `src/entries.js`, in the same transaction:
  - `confirmationsChanged` for each diagram drawn for the first time, back, removed or invalidated;
  - `changeSetsChanged` for each diagram with reflected change sets;
  - `threadChanged` for each thread a reflection closed.
- **No log line** holds what it found (rule 5).

So API-242 lists 13 tables. The correction at the end of the [API README](../docs/06-api/README.md) passed its own checkpoint.

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

- **Reflections** (SPEC-026). A diagram's accepted change sets that wait are grouped by pull request: those in none are one group, those of each pull request another, and each group is one entry. So one entry holds every waiting change set of a diagram, and a change set accepted while a pull request is open starts a new entry. An entry names its group by one of its change sets, its `change_set_id`, so linking the group to a pull request moves the entry with it, and a change set that leaves the group hands the name to another. When the pull request closes and its change sets wait again, the older entry stays and one opened meanwhile is withdrawn. `heldChangeSets` gives an entry's change sets and their pull request.
- **A removed diagram** (note 4 of the WBS). A diagram that a snapshot removes takes no confirmation (SPEC-027), so it puts nothing on the owner's to-do, confirmed or not, and its open `confirm` entry is withdrawn. Its confirmation stays as it is, and so does the agent's entry to record it, since a record of that version stays true. When the diagram comes back, it waits on the owner again unless its confirmation is still live.
- **Entry IDs.** The pinned hub names an entry of the agent to-do by what it is about: `nc_` its thread, `ne_` the entry itself, a reflection or a removal, and `nk_` its confirmation. `openAgentEntry` finds the open entry an ID names, for the claims of TASK-434 and the reports of TASK-447. A step has no ID, so it is never claimed.
- **Claims** are `src/claims.js`'s (see [Claims](#claims)). Closing an entry here leaves its claim row as it is; a claim of a closed entry holds nothing.

**The agent to-do** (API-245, `GET /api/spaces/{project}/todo`, `src/todo.js`) answers the open entries of the agent to-do, each list oldest first, with its total and up to the contract's 5000 entries (11 steps): `comments`, the threads that wait on the agent, each with its last entry; `reflections`, `reflect` or `remove`; `checkpoints`, `passed` to record a confirmation and `withdrawn` to record its cancel; and `steps`. `discrepancies` is always empty. `waiting_for_user` counts the owner's open entries of the project, and `taken` the listed entries that another session claims. A read writes nothing; `read_at` is the time of the answer.
- **`Nexus-Session`** names the session that reads, so that `claim.mine` says whether a claim is its own; without it no claim is. A value that is not a session label gets `invalid_request` on `Nexus-Session`, whose detail never repeats it.
- **A claim** is shown by `src/claims.js`'s one rule (SPEC-045): while its pull request is open, and otherwise for 60 minutes after the later of its last write and its pull request's close.
- **`item`** is the key of the comment's element or row when that key is a trace ID, as the contract's element keys are for an element that has one, and `''` for the diagram or a key that is none.
- **`part`** comes from a stage picture's `source_key`, is `''` for an item table, and for a file's picture of stage 03, 08 or 09 comes from the `/snapshot` document of its last drawing's snapshot, which names it beside the file's key; it is `''` where that document does not, as in a revision that a newer format completed.
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

`src/comments.js` is TASK-437: an agent comments on a diagram, replies in a thread, marks a thread answered and reports where a decision is recorded (API-252 to API-255; SPEC-016, SPEC-017, SPEC-027). All four are agent operations with a JSON body and a request key (rule 3). Each needs `Nexus-Session`, since a write on a thread may write on a claimed entry: a missing or malformed one gets `invalid_request` on `Nexus-Session`, whose detail never repeats it.

- **A thread** is a row of TBL-155 `comment_threads` on a diagram at one of its drawings: on the diagram as a whole, on an element, or on a row of an item table, by the element's key. Its entries are rows of TBL-156 `comments` in order. An agent's entry names its credential, and `detail` keeps `quote`, `asks`, `look_first` and a decision's `link`. An entry with a link is a `decision`, any other a `comment`.
- **Where a comment goes** (API-252). Its diagram is the one `diagram` names, which must be of the request's stage and part, not removed, and drawn. With an item and no diagram, it is the one diagram of the stage and part whose drawing holds the item. With neither, it is the stage's first diagram, the one its address opens: the first by name and then ID of the stage's diagrams that are not removed. `DIAGRAM_ORDER` in `src/project.js` holds that order, and the project read lists diagrams by it, so the two never disagree.
  - An item that several diagrams hold gets `diagram_ambiguous` with their IDs, and one that none holds gets `item_not_found`.
  - These get `diagram_not_found`, and a comment never moves to another diagram (SPEC-016, SPEC-027): a stage of the part without a drawn diagram; a named diagram that is removed, of another stage or part, or never drew; and a first diagram that never drew.
  - A part the project does not declare gets `part_not_found`. NEXUS v3 opens no discrepancies, so a `discrepancy` gets `discrepancy_not_found`.
- **At commit.** A comment's drawing is the diagram's current one. When NEXUS holds `commit`, it is the one the diagram showed then: its last drawn drawing at or before that snapshot's revision, or the current one when it had not drawn by then. An element that the drawing at commit holds and the current one no longer does, or draws as unreadable, gets the thread on the diagram, as an element that left would: its key is kept and its last name goes in `removed_name`. An element drawn as unreadable counts as gone, as [After a drawing](#after-a-drawing) counts it (SPEC-027).
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

`test/comments.test.js` checks TASK-437's done condition, answers every response API-252 to API-255 list, and checks the tables they touch (note 23).

## Project

`src/project.js` is TASK-440: the project read (API-264, `GET /api/projects/{project}`; SPEC-005, SPEC-027, SPEC-035, SPEC-046), which the owner's project screen (SCR-144, TASK-457) shows. It is an owner operation. A read writes nothing and logs nothing.

- **The head.** `name`, `repository` and `commit`, the held commit, are the project space's (TBL-147). `revision` and `pushed_at` are those of the held commit's snapshot (TBL-148): its revision and when NEXUS received it. `title` and `parts` are the project's in that snapshot's `/snapshot` document (TBL-150, TBL-149; see Documents above), `parts` being `[]` for a project without parts. The title is the project's name when the snapshot gives none, or one that is empty or only white space. `projectTitle` holds that rule, so that TASK-439's project list gives the same title.
- **Stage rows.** The stages are grouped by part, 13 rows per group in stage order (SCR-144). The groups come in this order: the project as a whole (`''`) when the project declares no parts or a listed diagram has none, as an item table never has; the parts of `parts`, in their order; then any other part a listed diagram still names, such as a removed diagram of a part the project no longer declares, by name. There are at most 51 groups, so at most the contract's 663 rows. A row holds the listed diagrams of its stage and part, a diagram's part being found as the agent to-do finds it (see To-do entries).
- **A row's state.** A stage pass (TBL-161) belongs to the stage, since the table keeps no part. So the stage's latest pass makes every row of the stage `passed`, or `changed_since_pass` once the pass's `changed_at` is set, which TASK-435 sets when a confirmation the pass rests on is invalidated, or when a diagram appears after the pass without a live confirmation (see [After a drawing](#after-a-drawing)); `passed_at` is the pass's time, since the pass stays in the record (SPEC-035). Without a pass, a row is `open` while it holds a diagram that is not removed, and `not_sent` otherwise, with `passed_at` null. The read works out no pass and no change of its own: TASK-447 and the workshop's steps write passes, and TASK-435 marks them changed (notes 20 and 25 of the WBS).
- **Diagrams.** A row lists its diagrams that are not removed, by name and then by ID, so that the first is the stage's first diagram (SPEC-016); then the removed ones that still have open threads, in the same order, with `removed` true; at most 500 in all. A removed diagram without an open thread is not listed, and none makes its row open (SPEC-027, SPEC-005). `DIAGRAM_ORDER` holds this order, and an agent's comment without item or diagram goes on the first (see [Comments](#comments)). Each diagram says:
  - `drawn`: whether it has a drawing that drew (TBL-152), as a confirmation needs (SPEC-029);
  - `confirmation`: its latest confirmation (TBL-160), `confirmed` while it is live and not recorded, `recorded` once recorded, `invalidated`, or `none` when it was cancelled or there is none;
  - `waiting`: its accepted change sets, which wait for reflection (TBL-158);
  - `open_threads`: its open threads (TBL-155).
- **Tool links** (SPEC-046): the project's links that are not removed (TBL-168), oldest first, at most 200, each with the status last read and the time it was read, both null before the first read. TASK-451 adds and removes them and reads their status.
- **The workshop**: the project's latest workshop (TBL-162), the open one or else the last closed one, or null when it never had one.
- **A name** that no project space has gets `project_not_found`, whose detail never repeats it.

The answer names what other tables hold, so API-264 lists 12 tables. The correction at the end of the [API README](../docs/06-api/README.md) passed its own checkpoint.

`test/project-read.test.js` checks TASK-440's done condition with rows that `test/seed.js` writes, the stage passes and tool links included, since later tasks write them (note 25): a stage shows passed from its pass record, and changed since the pass once a confirmation it rests on is invalidated and its pass is marked changed; removed diagrams are not counted. It answers every response API-264 lists and checks the tables it touches (note 23).

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
- **What stays.** Agent credentials, request keys and backups are no project's rows. A backup keeps the deleted project until it ages out after 30 days (SPEC-052).
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

## Answers

- An operation answers JSON. A refusal is a Problem as `application/problem+json`, with `title`, `status`, `detail`, `code`, `traceId` and the members its code carries, such as `field` or `limit`. Its shape is exactly `components.schemas.Problem` of the contract.
- The registry (`src/problem.js`) holds every code of `components.x-corthex.errors` with its status, title, members, `message` and `message_ko`. The Problem schema allows no other member, so the two messages are not sent with an answer. They stay in the registry, as `ERRORS` and on each `Problem`, so that the pages can show a refusal in Korean with what to do next, by its code (rule 7). TASK-454, the app shell, serves them.
- A path that is no operation answers `not_found` (404). Under `/api/spaces` its detail names the agent commands NEXUS takes: push, todo, claim, comment, decide, reflect, status and record (SPEC-014). The detail never repeats the path.
- A path that takes other methods only answers `method_not_allowed` (405) with `Allow`.
- A request that admission refuses answers `unauthenticated` (401), `not_owner` (403), `cross_site` (403), `owner_only` (403), `access_missing` (401) or `agent_only` (403), as above.
- A handler that fails answers `internal` (500), whose `traceId` finds the request in the log.

## Log

The server writes one JSON line to standard output for each request, when its answer ends or its connection drops:

| Field | Value |
| --- | --- |
| `time` | When the request arrived, in UTC. |
| `traceId` | 16 random hex digits, or the gate's `CF-Ray` once the owner's sign-in or a live agent credential is admitted and the ray has the form of the contract's `traceId` (16 hex digits, a hyphen and the data centre's 3 letters). Anyone who reaches the server without the gate can send a `CF-Ray`, but only the gate signs the owner's sign-in and only NEXUS issues a credential. Both are bearer secrets, though, so their holder, reaching the loopback server without the gate, could still choose the ray of their own requests. A Problem answer carries the same ID. |
| `method` | The request's method. |
| `action` | The `operationId` of the operation, or `null` for a path that is no operation. |
| `sender` | Who sent the request: `owner` once the owner's sign-in is checked, the credential's name once a live agent credential is checked, otherwise `unknown`, never a name the request gives (rule 8). A write refused because its credential was revoked while it waited is `unknown` again. |
| `status` | The answer's status, or `null` when the connection dropped before the answer started. |
| `code` | The Problem's code, or `null`. |
| `ms` | How long the answer took, in milliseconds. |
| `reason` | Only when the owner's sign-in was not admitted for want of a valid one: the check it failed, `no_sign_in`, `malformed`, `unknown_key`, `bad_signature`, `wrong_issuer`, `wrong_audience`, `expired` or `not_yet_valid`, or `keys_unavailable` when the keys could not be read. On an agent operation without a live credential: `no_credential` (neither header), `malformed` (a header missing or not in its form), `unknown_credential`, `wrong_secret` or `revoked`. The answer is `access_missing` whatever it is; only the owner's log tells them apart. |
| `error` | Only when a handler failed or a refusal could not be sent: the kind of error, a built-in error type with Node's code if it has one, such as `Error ENOENT`. |
| `aborted` | Only when the connection dropped before the answer ended: `true`. |

It also writes a line when it starts listening (with its host and port), when it stops and when a setting is invalid, and one line in place of Node's report when it crashes. Before it listens it writes one line about the store: `store_opened` with the store's `version` and the migrations it `applied`, `store_refused` with a `reason` (`not_a_v3_store`, `newer_store`, `migrations_invalid` or `foreign_keys_broken`), or `store_failed` with the kind of `error`. None of them names the data folder.

So every refused request is logged with its time, its action, its sender and its reason, the Problem's `code` (rule 8). No line holds a credential's secret or digest: the sender is the credential's name, which the owner chose, and the reason is one of the words above.

Rule 5 of the [functional spec](../docs/04-functional-spec/spec.md) keeps an agent credential's secret, a credential digest, a sign-in token, a server path and the text of a refused file out of every log line. So no field is copied from the request, its path, query, headers or body, or from an error's message or stack; `test/logs.test.js`, `test/main.test.js` and `test/admission.test.js` check this, the data folder, the owner's sign-in and the emails included, with values made at run time. No line names a gate setting or a request key's digest either (`test/keys.test.js` checks the digest).

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
| `nodes[].position` | Optional. `{ x, y }`, where the owner put the box (SPEC-012). The box stays there and the other boxes keep clear of it. TASK-442 fills it; this task builds no moving. |
| `edges[].from`, `edges[].to` | The ids of the two boxes a line joins. |
| `edges[].label` | Optional. `{ width, height }`, the room the line's label needs. |
| `direction` | Option: `TB`, layers top to bottom (the default), or `LR`, left to right, as a Mermaid `flowchart LR`. |
| `nodeGap`, `layerGap`, `edgeGap` | Options: the space between two boxes of a row (32), the least space between two rows (48), and between two lines side by side and from a line to its label (12). |

It returns `nodes` and `edges` in the order of the input. A node has its `id`, `x` and `y` (the top left corner), `width`, `height`, the `layer` it got and `fixed` (whether it kept a position). An edge has `from`, `to`, its `points` from the edge of the first box to the edge of the second, and its `label` box or `null`. `bounds` is the box that holds them all, for an SVG `viewBox`; its corner need not be at 0.

- The same input gives the same output: every tie is broken by input order, and nothing depends on the clock or on chance. The numbers the layout works out are rounded to two decimal places; sizes and fixed positions come back as given. Where a size or a fixed position has more decimal places, a line's end and `bounds` round away from the box, by less than 0.01, so that a line never starts inside its box and `bounds` holds everything.
- No two boxes overlap, labels included. A box or label the layout places keeps clear of a fixed box over the whole height of its row; two fixed boxes may overlap, since the owner put them there, and so may the labels drawn with them.
- A line leaves the bottom of its box and enters the top of the next (the right and the left in `LR`), runs only across and down, and turns on its own track in the gap between two rows, so it passes through no box or label the layout places. A label sits beside its line. A line to its own box, or between two boxes pinned to one layer, dips under their row. A line that closes a cycle, such as a flow's way back, points up. A drawing task that draws another shape than a rectangle, such as a decision's diamond, moves the first and last point along their segment to the shape's outline.
- A fixed position only leaves room for SPEC-012: the box stays where the owner put it, and the boxes and labels the layout places keep clear of it. This task builds no moving; how lines meet a moved box is left to TASK-442. For now, a line with one fixed end follows the layout's route until it would first run through the fixed box, then runs straight to the box's edge, so it never runs through that box. A line between two fixed boxes runs straight from one to the other, its label beside its middle, so lines between the same two fixed boxes lie on one another. A line from a fixed box to itself moves with the box, label included. The boxes the layout places keep clear of these labels, but a line to a fixed box may cross other boxes, the box at its other end included, and its end on the fixed box lies where a line from the box's middle leaves the box, even where the box stayed in its place in the layout. Rows and gaps keep their sizes, so that moving one box never shifts the others: a fixed box, or a label drawn with fixed boxes, may lie across a line between other boxes, and where boxes move clear of a fixed box, the lines in a gap may run closer than `edgeGap`. Where a fixed box covers part of a line, or boxes move clear of one, a label may stand apart from its line.
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
