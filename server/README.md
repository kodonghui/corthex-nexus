# NEXUS v3 server

[한국어](README.ko.md)

The server of NEXUS v3, built task by task from the [WBS](../docs/10-wbs/wbs.md). It runs on Node 24 with Node's own modules and has no dependency to install. It runs behind the Cloudflare Access gate, as v2 did.

It has TASK-413's skeleton, a router for the operations of [api/openapi.yaml](../api/openapi.yaml), settings from the environment and one log line per request; TASK-414's store, the database that the migrations of [db/migrations](../db/migrations/) build; and TASK-416's admission, which checks the gate's sign-in of the one owner on every owner request. It takes no operation yet, so every path answers the `not_found` Problem until the tasks that build the operations add them.

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
- **The keys** are read from `<issuer>/cdn-cgi/access/certs` when a sign-in first needs them, with a 5-second limit and no redirect, and kept for an hour; a `kid` the server does not know makes it ask again, at most once in 10 seconds. Only RSA keys of at least 2048 bits are kept. While no current keys can be read, an owner request gets `internal` (500). This is the server's one outside call, to the gate in front of it, and tests replace it with a local signing key.
- **Agent operations** take an agent credential, the `CF-Access-Client-Id` and `-Secret` pair, which TASK-417 checks in `src/admission.js`. Until then every agent request gets `access_missing` (401), and an agent credential on an owner operation is a request without the owner's sign-in.
- **A route** of an action the contract does not name, which only a test makes, says `family: 'none'` to be admitted unchecked; any other route the contract does not name stops the server when it is made, so no operation goes unchecked because its family was left out.

## Answers

- An operation answers JSON. A refusal is a Problem as `application/problem+json`, with `title`, `status`, `detail`, `code` and `traceId`, in the shape of `components.schemas.Problem` of the contract.
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

Rule 5 of the [functional spec](../docs/04-functional-spec/spec.md) keeps an agent credential's secret, a credential digest, a sign-in token, a server path and the text of a refused file out of every log line. So no field is copied from the request, its path, query, headers or body, or from an error's message or stack; `test/logs.test.js`, `test/main.test.js` and `test/admission.test.js` check this, the data folder, the owner's sign-in and the emails included, with values made at run time. No line names a gate setting either.

## Tests

```sh
cd server
node --test
```

Node's own test runner runs `test/*.test.js`. `.github/workflows/check.yml` runs them on Node 24 for every pull request, and `all-checks` waits for them.
