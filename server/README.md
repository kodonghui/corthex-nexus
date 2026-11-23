# NEXUS v3 server

[한국어](README.ko.md)

The server of NEXUS v3, built task by task from the [WBS](../docs/10-wbs/wbs.md). It runs on Node 24 with Node's own modules and has no dependency to install. It runs behind the Cloudflare Access gate, as v2 did.

It has TASK-413's skeleton, a router for the operations of [api/openapi.yaml](../api/openapi.yaml), settings from the environment and one log line per request; TASK-414's store, the database that the migrations of [db/migrations](../db/migrations/) build; TASK-415's request layer: the error registry, the body limits, JSON only, request keys and one write at a time; and TASK-416's admission, which checks the gate's sign-in of the one owner on every owner request. It takes no operation yet, so every path answers the `not_found` Problem until the tasks that build the operations add them.

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
- **Agent operations** take an agent credential, the `CF-Access-Client-Id` and `-Secret` pair, which TASK-417 checks in `src/admission.js`. Until then every agent request gets `access_missing` (401), and an agent credential on an owner operation is a request without the owner's sign-in.
- **A route** of an action the contract does not name, which only a test makes, says `family: 'none'` to be admitted unchecked; any other route the contract does not name stops the server when it is made, so no operation goes unchecked because its family was left out.

## Requests

A route (`src/router.js`) names its operation's `operationId` as `action`, the 404 code of each path parameter as `params`, the kind of body it takes as `body` and whether it takes a request key as `requestKey`. A request goes through these steps in order, and any of them can refuse it:

1. **Path and method.** A path that is no operation answers `not_found`; one that takes other methods only answers `method_not_allowed`.
2. **Admission.** The request is admitted by its operation's family, as above, before its path parameters or its body are read. The caller a request key belongs to is `owner` for an admitted owner operation; TASK-417 gives an agent operation its credential's ID.
3. **Path parameters.** A path parameter is percent-decoded, and a value that is not in the contract's form of what it names gets the 404 of that thing, such as `project_not_found` for `{project}` (`src/params.js`). So a handler never gets a value holding `/`, `..` or a control character. The detail never repeats the value.
4. **Request key.** An operation that takes one needs `Idempotency-Key` in the contract's form, a write ID in double quotes; without it the answer is `invalid_request` with `field` `Idempotency-Key`.
5. **Body.** An operation that takes a body takes a JSON object only (`src/body.js`):
   - not `application/json`, a charset other than UTF-8, or a content coding: `json_required` (415);
   - over its limit, by its declared length or once the bytes read pass it: `snapshot_too_large` for a snapshot (8 MiB), and `body_too_large` for a Miro export (5 MiB) or any other body (2 MiB), with `limit` (413). The rest of the body is not read;
   - not UTF-8 JSON text of an object: `invalid_request`, or `invalid_snapshot` for a snapshot, with `field` `body` (400).
6. **The operation.** A read runs at once. A write, which is every operation whose method is not GET, runs as described below.

**Unread bodies.** An answer sent before the body was read in full, such as a refusal, leaves the rest of the body unread. Node reads such a body to its end before the connection takes another request. The server lets it do so only when the declared length is within the operation's body limit (2 MiB on a path that takes no body), so that a caller that is still sending reads its answer rather than a reset connection. A longer body, a body whose length is not declared and a body already partly read close the connection (`Connection: close`). So the server never reads more than that limit of a body it did not take.

**Writes, one at a time** (rule 4, `src/writes.js`). A write arrives when its request has passed the steps above, with its body read in full. It waits in one queue for the whole server and runs when the writes before it have ended, whatever their project. Rule 4 asks this of writes to one project. One queue is stricter, and it is what the store allows: the store is one SQLite connection, which holds one transaction at a time. So a long write, such as a large snapshot, holds the writes of other projects until it ends.

A write runs in one transaction (`BEGIN IMMEDIATE` to `COMMIT`), from its request key's check to its key's row, so a write that fails or is refused changes nothing. Its handler may wait (`await`), and the next write waits with it. A read that runs meanwhile on the same connection sees the write's rows before they commit, so a write handler does its waiting before it writes. A handler never begins or ends a transaction itself. It refuses by throwing a Problem. A success is 200 or 201 with a non-empty JSON object, as the contract makes every success. Any other answer, such as another status, a body that is not such an object or a framing header, is a fault that answers `internal`; a write's answer is checked before anything is stored, so such a write changes nothing.

**Request keys** (rule 3, `src/keys.js`). The first answer to each key is kept in TBL-169 `request_keys`. It is the request layer's own table: every write with a key fills it, so no operation lists it (note 21 of the WBS).
- The same key from the same caller within 7 days gets the first status and answer, and nothing is written. The key keeps the answer's status and body, not headers of the write's own, which no operation with a request key has in the contract. Keys are kept 7 days, beyond the 24 hours that rule 3 asks, because the hub keeps an unsent write that long and sends it again under the same key.
- The `action` column holds the `operationId`, a space, and the SHA-256 in hex of the request's path and body bytes as sent. The same key sent again for another operation, another path or another body therefore finds another action and gets `request_key_reused` (409). The digest is of the request, not of a credential. It lives only in the owner-only store, and no log line holds it (rule 5).
- A refused or failed write leaves no key behind, so the same key runs it again.
- A key belongs to its caller (`actor`: `owner` or the credential's ID), so two callers' keys never meet.
- The write of a new key drops every key older than 7 days.
- A route's `repeat(result)` gives what a repeat answers instead of the first answer. API-280 uses it to keep no secret, and answers a repeat with 200 and `secret` null.

## Answers

- An operation answers JSON. A refusal is a Problem as `application/problem+json`, with `title`, `status`, `detail`, `code`, `traceId` and the members its code carries, such as `field` or `limit`. Its shape is exactly `components.schemas.Problem` of the contract.
- The registry (`src/problem.js`) holds every code of `components.x-corthex.errors` with its status, title, members, `message` and `message_ko`. The Problem schema allows no other member, so the two messages are not sent with an answer. They stay in the registry, as `ERRORS` and on each `Problem`, so that the pages can show a refusal in Korean with what to do next, by its code (rule 7). TASK-454, the app shell, serves them.
- A path that is no operation answers `not_found` (404). Under `/api/spaces` its detail names the agent commands NEXUS takes: push, todo, claim, comment, decide, reflect, status and record (SPEC-014). The detail never repeats the path.
- A path that takes other methods only answers `method_not_allowed` (405) with `Allow`.
- A request that admission refuses answers `unauthenticated` (401), `not_owner` (403), `cross_site` (403) or `access_missing` (401), as above.
- A handler that fails answers `internal` (500), whose `traceId` finds the request in the log.

## Log

The server writes one JSON line to standard output for each request, when its answer ends or its connection drops:

| Field | Value |
| --- | --- |
| `time` | When the request arrived, in UTC. |
| `traceId` | 16 random hex digits, or the gate's `CF-Ray` once the owner's sign-in is admitted and the ray has the form of the contract's `traceId` (16 hex digits, a hyphen and the data centre's 3 letters). Anyone who reaches the server without the gate can send a `CF-Ray`, but only the gate signs the owner's sign-in; it is a bearer token, though, so its holder, reaching the loopback server without the gate, could still choose the ray of their own requests. A Problem answer carries the same ID. |
| `method` | The request's method. |
| `action` | The `operationId` of the operation, or `null` for a path that is no operation. |
| `sender` | Who sent the request: `owner` once the owner's sign-in is admitted, otherwise `unknown`, never a name the request gives (rule 8). |
| `status` | The answer's status, or `null` when the connection dropped before the answer started. |
| `code` | The Problem's code, or `null`. |
| `ms` | How long the answer took, in milliseconds. |
| `reason` | Only when the owner's sign-in was not admitted for want of a valid one: the check it failed, `no_sign_in`, `malformed`, `unknown_key`, `bad_signature`, `wrong_issuer`, `wrong_audience`, `expired` or `not_yet_valid`, or `keys_unavailable` when the keys could not be read. |
| `error` | Only when a handler failed or a refusal could not be sent: the kind of error, a built-in error type with Node's code if it has one, such as `Error ENOENT`. |
| `aborted` | Only when the connection dropped before the answer ended: `true`. |

It also writes a line when it starts listening (with its host and port), when it stops and when a setting is invalid, and one line in place of Node's report when it crashes. Before it listens it writes one line about the store: `store_opened` with the store's `version` and the migrations it `applied`, `store_refused` with a `reason` (`not_a_v3_store`, `newer_store`, `migrations_invalid` or `foreign_keys_broken`), or `store_failed` with the kind of `error`. None of them names the data folder.

So every refused request is logged with its time, its action, its sender and its reason, the Problem's `code` (rule 8).

Rule 5 of the [functional spec](../docs/04-functional-spec/spec.md) keeps an agent credential's secret, a credential digest, a sign-in token, a server path and the text of a refused file out of every log line. So no field is copied from the request, its path, query, headers or body, or from an error's message or stack; `test/logs.test.js`, `test/main.test.js` and `test/admission.test.js` check this, the data folder, the owner's sign-in and the emails included, with values made at run time. No line names a gate setting or a request key's digest either (`test/keys.test.js` checks the digest).

## Tests

```sh
cd server
node --test
```

Node's own test runner runs `test/*.test.js`. `test/contract.js` reads [api/openapi.yaml](../api/openapi.yaml) with Node alone, as `tests/yaml_subset.py` does, so that the tests check the registry, the limits, the request key and the path parameters' forms against the contract. `.github/workflows/check.yml` runs them on Node 24 for every pull request, and `all-checks` waits for them.
