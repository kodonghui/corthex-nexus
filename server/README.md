# NEXUS v3 server

[한국어](README.ko.md)

The server of NEXUS v3, built task by task from the [WBS](../docs/10-wbs/wbs.md). It runs on Node 24 with Node's own modules and has no dependency to install. It runs behind the Cloudflare Access gate, as v2 did.

It has TASK-413's skeleton, a router for the operations of [api/openapi.yaml](../api/openapi.yaml), settings from the environment and one log line per request; TASK-414's store, the database that the migrations of [db/migrations](../db/migrations/) build; TASK-415's request layer: the error registry, the body limits, JSON only, request keys and one write at a time; TASK-416's admission, which checks the gate's sign-in of the one owner on every owner request; TASK-417's agent credentials: the owner issues, lists and revokes them, and every agent request is checked by its pair; and TASK-418's [snapshot intake](#snapshot-intake), where the hub's push keeps a project's snapshot. It takes the operations of `src/routes.js`, so far API-242, API-243, API-279, API-280 and API-281; every other path answers the `not_found` Problem until the tasks that build its operations add them. It also holds TASK-420, the [picture layout](#picture-layout) the drawing tasks use.

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
- `test/tables.js` (note 23 of the WBS) wraps the store. SQLite's authorizer reports each table a statement reads and writes as it is prepared. Each run of the statement is noted for the operation whose handler runs it (`src/operation.js`), or for the request layer outside every handler. The tables the schema's keys reach are left out: those a foreign key's check reads, and those a cascade deletes from. An operation must touch exactly the tables its `x-corthex.tables` lists, and the request layer only TBL-169 and TBL-146. `test/tables.test.js` checks that the tests of every route in `src/routes.js` call this check.
- `PENDING` in `test/tables.js` names the tables an operation lists that a later task of the WBS builds its part of: API-242 lists TBL-151 to TBL-153, which TASK-419's drawing writes. Until that task lands, the check leaves them out. A pending table that the operation touches still fails the check, so the entry goes with the task that builds it, and `test/tables.test.js` checks that each entry names tables the operation lists and the WBS gives that task.

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
| `/items/<stage>` | that stage | the snapshot's items of that stage, as a JSON array |
| `/snapshot` | none | the rest as it came: every other field, the pictures without their sources and the items of no stage |

The schema lists only the fields NEXUS reads and says NEXUS keeps the others as they come; `/snapshot` keeps them, the project's title and parts among them. A key never starts with `/`, so the two kinds of names never meet.

**Secrets and email addresses** (REQ-077, `src/sensitive.js`). A document whose text looks like a secret (an OpenAI-style, GitHub, Slack or AWS key, or a private key's first line) or an email address is left out. The answer's `refused` names it with its part, its stage, where it is from (its key, or the stage's source as the snapshot's stage record names it) and `why`, `secret` or `email`, up to 500 of them. The patterns are the pinned hub's own, which redacts every text before it sends it, so NEXUS leaves out no more than the hub hides. The rest, `/snapshot`, has no stage to name it by, so a snapshot whose other fields hold such text, which the hub never sends, gets `invalid_snapshot` naming the field. No answer or table holds the text of a document left out or what was found in it, and no log line holds its path either (rule 5).

**Drawing.** After it keeps a snapshot, the push calls `drawSnapshot` of `src/drawing.js` once, in the same transaction, with the project, the snapshot, whether it completes a revision and the documents kept. That function is where TASK-419 hooks in the diagrams and drawings (TBL-151 to TBL-153); until then it draws nothing: the answer's `diagrams` counts are 0 and its `failures` empty. What a drawing changes after it, the answer's `confirmations_invalidated`, `change_sets_reflected` and `threads_moved`, is TASK-435's, so those are 0 until it lands.

`test/snapshots.test.js` sends 0.2 and 0.3 snapshots of this repository that `test/snapshots.js` builds from its files when the tests run, so no snapshot file is kept in Git. It builds 0.2 from the schema too, rather than with the pinned hub, because the server's tests run with Node alone. It makes every secret-looking and email-looking value at run time from parts.

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
