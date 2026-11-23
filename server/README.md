# NEXUS v3 server

[한국어](README.ko.md)

The server of NEXUS v3, built task by task from the [WBS](../docs/10-wbs/wbs.md). It runs on Node 24 with Node's own modules and has no dependency to install. It runs behind the Cloudflare Access gate, as v2 did.

This is TASK-413, the skeleton: a router for the operations of [api/openapi.yaml](../api/openapi.yaml), settings from the environment and one log line per request. It takes no operation yet, so every path answers the `not_found` Problem until the tasks that build the operations add them.

## Running

```sh
cd server
node src/main.js
```

## Settings

| Variable | Default | Meaning |
| --- | --- | --- |
| `NEXUS_HOST` | `127.0.0.1` | The address the server listens on: an IP address or `localhost`. The gate's tunnel reaches the server on the same machine. |
| `NEXUS_PORT` | `8787` | The port, 0 to 65535. With 0 the system chooses a free port, which the start line names. |

An empty variable takes the default. An invalid value stops the server with exit code 1 and one line that names the setting and its rule, never the value, since a value set by mistake can be a secret.

## Answers

- An operation answers JSON. A refusal is a Problem as `application/problem+json`, with `title`, `status`, `detail`, `code` and `traceId`, in the shape of `components.schemas.Problem` of the contract.
- A path that is no operation answers `not_found` (404). Under `/api/spaces` its detail names the agent commands NEXUS takes: push, todo, claim, comment, decide, reflect, status and record (SPEC-014). The detail never repeats the path.
- A path that takes other methods only answers `method_not_allowed` (405) with `Allow`.
- A handler that fails answers `internal` (500), whose `traceId` finds the request in the log.

## Log

The server writes one JSON line to standard output for each request, when its answer ends or its connection drops:

| Field | Value |
| --- | --- |
| `time` | When the request arrived, in UTC. |
| `traceId` | The gate's `CF-Ray` when it has the form of the contract's `traceId` (16 hex digits, a hyphen and the data centre's 3 letters), otherwise 16 random hex digits. A Problem answer carries the same ID. |
| `method` | The request's method. |
| `action` | The `operationId` of the operation, or `null` for a path that is no operation. |
| `status` | The answer's status, or `null` when the connection dropped before the answer started. |
| `code` | The Problem's code, or `null`. |
| `ms` | How long the answer took, in milliseconds. |
| `error` | Only for a handler that failed: the kind of error, a built-in error type with Node's code if it has one, such as `Error ENOENT`. |
| `aborted` | Only when the connection dropped before the answer ended: `true`. |

It also writes a line when it starts listening (with its host and port), when it stops and when a setting is invalid, and one line in place of Node's report when it crashes.

Rule 5 of the [functional spec](../docs/04-functional-spec/spec.md) keeps an agent credential's secret, a credential digest, a sign-in token, a server path and the text of a refused file out of every log line. So no field is copied from the request, its path, query, headers or body, or from an error's message or stack; `test/logs.test.js` and `test/main.test.js` check this with values made at run time.

## Tests

```sh
cd server
node --test
```

Node's own test runner runs `test/*.test.js`. `.github/workflows/check.yml` runs them on Node 24 for every pull request, and `all-checks` waits for them.
