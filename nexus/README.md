# NEXUS server

[한국어](README.ko.md)

The NEXUS server puts the CORTHEX project hub on an address of your own, so you can open it from any device. The approved standalone runtime uses Node HTTP and SQLite behind Cloudflare Access and a Tunnel; the compatible Worker/D1 runtime remains available. Both keep snapshots sent by `hub.py push` and serve the hub page. The standalone deployment and recovery procedure is below.

This folder is not a plugin. Deploy it from a clone of this repository.

## What it keeps and who can see it

- **Snapshots and a discussion space.** Snapshots hold IDs, titles, states, checks, relative file locations, commits and parsed pictures/stage records ([format](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex-nexus/skills/corthex-hub/references/snapshot.md)). A new push of a project replaces its row. The space separately retains comments/replies, proposals/reflections, discrepancies and checkpoints. Only author kind is retained; identities and stored text are never logged.
- **Access first.** The Worker answers only requests that Cloudflare Access checked. Any other request gets `403` and no data, so a Worker deployed before Access is set up shows nothing.
- **One address.** Only the address you set serves it: no `workers.dev` or preview addresses, and no static assets, which would take the Access check away from the Worker.
- **Self-contained hub, same-origin views.** The hub carries its data and hash-allowed inline script. Picture/overview pages load pinned prebuilt code/styles/fonts only through the Access-checked `/code/` operation. There is no CDN or static-assets bypass; see [the browser build guide](ui/README.md).

## Requirements

- A Cloudflare account with a domain on it, and Cloudflare Zero Trust set up. The Zero Trust Free plan is enough; its setup asks for payment details even so.
- Node.js 24 LTS or later, and a clone of this repository.
- `corthex-nexus` on each machine that sends snapshots.

## Set up

1. Install the tools: in this folder, run `npm install`.
2. Make your own settings file: copy `wrangler.jsonc` to `wrangler.local.jsonc`, which git ignores. In the copy, set the address in `routes`, such as `nexus.example.com` on a domain in your account, and set `NEXUS_LANGUAGE` to `ko` for a Korean page.
3. Deploy: run `npx wrangler login`, then `npm run deploy`. The first deploy creates the D1 database `corthex-nexus` and links it to the Worker; run in a terminal, it also writes the database's ID into your settings file, and later deploys keep using the database either way. Cloudflare then adds the address's DNS record and certificate. If the address already has a DNS record, for example from an earlier service, Cloudflare does not put the Worker's record over it: note its value if you may need it, delete it in the dashboard under your domain's **DNS** › **Records**, and deploy again. Until the next step, the address answers `403`.
4. Protect the Worker with Access. In the Cloudflare dashboard, go to **Workers & Pages**, select `corthex-nexus`, open the **Access** tab and select **Protect this Worker behind Access**. Choose **All traffic**, choose who can sign in (for yourself alone, **Cloudflare account**) and select **Apply Access**. If an Access application for this address already exists under **Zero Trust** › **Access controls** › **Applications**, it applies before Worker-level Access and already protects the hub: check that its policies let in only the people you want, and skip this step.
5. Pin the application before checking it. Remove the empty `ACCESS_AUD` placeholder from your local `vars`, then run `npx wrangler secret put ACCESS_AUD -c wrangler.local.jsonc` and enter that application's **Application Audience (AUD) Tag** at the prompt. Set `ACCESS_TEAM_DOMAIN` in your local file's `vars` to your team host, such as `your-team.cloudflareaccess.com`, and deploy again. Open the address in a private window: the Access sign-in comes first, then the empty hub page.
6. Create a service token for `hub.py`. In **Zero Trust** › **Access controls** › **Service credentials** › **Service Tokens**, create one and copy its Client ID and Client Secret; the secret is shown only once. Then open the Access application that protects the hub, the one from step 4 or the one the address already had, under **Zero Trust** › **Access controls** › **Applications**, and add a policy with the action **Service Auth** that includes this token. Add it to that application rather than creating a second one for the same Worker, which can conflict with it.
7. On each machine that sends snapshots, set the address and the projects that may be sent in `~/.corthex/profile.json`:

   ```json
   { "nexus": { "url": "https://nexus.example.com", "push": ["acme-shop"] } }
   ```

   Put the token in the environment variables `CORTHEX_NEXUS_CLIENT_ID` and `CORTHEX_NEXUS_CLIENT_SECRET`, from your system's secret store, never in a file in a repository. Then run `hub.py push --dry-run`, and `hub.py push`.

`ACCESS_AUD` and `ACCESS_TEAM_DOMAIN` are required in 0.2. Several audience tags can be given, separated by commas. After checking `ctx.access`, the Worker verifies the assertion header's RS256 signature against the configured team's public keys, issuer, audience and expiry; a missing configuration grants no access. It retains only the author's kind, never a person or service identity.

The dashboard names follow Cloudflare's documentation as of October 2026: [Cloudflare Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/), [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/), [service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/) and [Zero Trust setup](https://developers.cloudflare.com/cloudflare-one/setup/).

## Use

- `hub.py push` sends the projects in `nexus.push`; name projects to send only those. The server keeps the newer snapshot of a project: one generated earlier than the stored one is refused, so build again and push.
- `hub.py remove <project>` deletes a project from the server. Taking a project out of `nexus.push` stops further pushes but leaves what the server holds.
- When signed in, `/api/snapshots` lists what the server holds.

## Limits

- A snapshot of up to 1 MiB (`hub.py` keeps them under 1 MB), and up to 30 projects. A snapshot dated more than 10 minutes in the future is refused; check the clock of the machine that made it.
- On the Workers Free plan, a request gets 10 ms of CPU time. Checking a snapshot of about 40 KB, the size of a real project with 92 items, took under 1 ms in a local measurement with Node; one near 1 MB took about 15 ms and may exceed the limit.
- D1's free plan has daily limits on rows read and written, which a personal hub stays far below. See Cloudflare's current [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

## Try it on this machine

- `npm test` runs the server's checks with Node's own test runner over an in-memory database.
- For a local HTTP stand-in, run `node test/serve.js`. It signs synthetic assertions and uses in-memory SQLite; its printed `127.0.0.1` address works with the hub. `npm run dev` does not manufacture a signed Access assertion: a fake `ctx.access` audience alone cannot authenticate in 0.2. Check the Workers runtime on a separately protected development Worker with its own D1 and service token.

## Update and remove

- To update, pull the repository, compare `wrangler.jsonc` with your copy, then run `npm install` and `npm run deploy`.
- To remove it, `npx wrangler delete -c wrangler.local.jsonc` deletes the Worker and `npx wrangler d1 delete corthex-nexus` deletes the database with its snapshots. Then delete the Access application and the service token under **Zero Trust** › **Access controls**.
# Standalone runtime (approved development target)

The standalone runtime uses Node 24 LTS built-ins only: `node:http`,
`node:sqlite` and Web Crypto. It runs the same handler and Store as the Worker.
All product and engine SQL remains in `src/store.js`. SQLite enables foreign
keys, WAL, full synchronous writes and a five-second busy timeout. Each D1-style
batch is one synchronous transaction; a failed statement rolls the batch back.

Prepare the origin once: a dedicated `nexus-dev` user, private state under
`/var/lib/nexus-dev`, and a root-owned, mode-0600 `/etc/nexus/dev.env` based on
`ops/runtime.env.example`. Use the selected public HTTPS origin and the existing
Access application's issuer and audience. No configuration value from the
request selects the issuer. The Node entry point verifies the signed assertion
header; the Worker still independently requires its checked Access context.
There is no development authentication bypass. The server binds only loopback.

Create the Tunnel **on the origin** with `cloudflared tunnel login` and
`cloudflared tunnel create <development-name>`. Authorize its browser login, and
keep the resulting certificate and credentials on that origin. Adapt
`ops/cloudflared.example.yml`, route only the approved development hostname to
the tunnel, and run cloudflared as its own service. Preserve Access policies.
Do not change the production hostname or delete its Worker/D1.

From a clean, reviewed commit on the laptop:

```powershell
./nexus/ops/deploy-dev.ps1 -SshAlias <configured-origin-alias> -Commit <full-sha>
```

The script archives only committed runtime/operations files, uploads no keys,
backs up any existing development database, selects an immutable release and
restarts `nexus@dev`. It requires an unauthenticated 403 from the local listener.
On startup failure it selects the previous runtime. Inspect `systemctl status
nexus@dev` and the safe journal; stop it with `systemctl stop nexus@dev`.
The service has its own Unix user, state directory and memory limit.

`nexus-backup@dev.timer` runs daily at 03:15 UTC with up to 15 minutes of jitter,
including a missed run after downtime. `database.js backup` also runs before
deployment; `database.js migrate` backs up before migration. Each archive is a
consistent SQLite backup, checked for integrity and foreign keys, sealed without
WAL companions, mode 0600, and accompanied by its SHA-256 receipt. Retention is
30 days. Stop scheduled backups with `systemctl disable --now
nexus-backup@dev.timer`; state/backups are retained.

Restore rehearsal (use absolute paths):

```sh
node nexus/tools/database.js restore --backup /private/backups/<archive>.sqlite --destination /private/restore-check.sqlite
```

The destination must not exist. The tool verifies the receipt and restores a separate copy with its original
schema. Run the explicit `migrate` command separately when an upgrade is wanted. Verify counts and the API on an
isolated development listener before selecting a restored database. For an
actual rollback, stop the affected service, back up its current database, select
the verified restored file in its private environment and restart. Never replace
a live database or detach it from its WAL. A runtime rollback alone does not
undo database migrations.

Before release, export production D1 **read-only** to the origin, import it into
a separate rehearsal database, record table counts, back it up, apply migrations
and verify both forward behavior and a restored copy. Keep the old production
Worker and D1 for14days after the conditionally approved switch. Main
merge, production routing/data changes and tags follow the conditional release
decision of2026-11-04. First real-project snapshot upload still needs REQ-107
confirmation, and removing the retained Worker/D1 requires a separate question.

CI runs the original Worker checks and the standalone HTTP/SQLite tests, plus
Schemathesis against all 32 operations using generated RSA keys and an isolated
temporary database. These local fixtures do not prove an authenticated Tunnel
deployment or browser acceptance; those are recorded separately in stage 12.

For a supervised processing/RSS measurement, temporarily set `NEXUS_METRICS=1`
in the private origin environment and restart. Each numeric receipt includes
status, received body bytes, handler processing milliseconds and process RSS.
It contains no path, identity, headers or stored text. Remove the setting after
the run. `ops/cloudflared-nexus@.service` is the isolated Tunnel service example;
its dedicated user needs only the origin-created Tunnel credentials, never the
zone administrator certificate.


### Standalone code transport

Trusted JS/CSS Brotli/gzip variants are made once at startup. At the origin, Access, role and route checks precede Accept-Encoding selection; HEAD and code-cache/CSP policies remain intact. Same-origin edge HITs still require whole-host Access first. Fonts and refusals do not use these compression variants. NEXUS_METRICS=1 emits numbers only: processing_ms includes body arrival and I/O; body_receive_ms and after_body_ms distinguish the phases. cpu_user_ms/cpu_system_ms are process CPU deltas over that window, which overlap for concurrent requests. RSS is a post-response sample, not peak.

The optional private setting `NEXUS_EARLY_HINTS=1` adds `Link: rel=preload` hints to successful picture HTML. It is off by default. Hints contain only the current editor's immutable same-origin bundle names, both supported locales and its fonts; they contain no snapshot or identity data. Access still checks every asset request. The existing proxy must separately support Early Hints; a Link header alone does not prove a 103 response or a faster page. Keep response bodies private. When changing those bundle names, refresh the development picture responses before measuring so cached hint metadata cannot select an older bundle.

Only public content-hashed /code/ files may be edge-cached (public,max-age31536000,immutable). HTML/API/data remain no-store behind whole-host Access. Verify HIT/Age and unauthenticated GET/HEAD refusal at cached URLs before release. REQ-124 processing1s starts after body receipt and ends at response handling completion. Keep the old Worker/D1 for14days after switching and ask separately before removal.

### Production CLI credential lifecycle

Inventory observation on2026-11-05: the new production CLI service token was created with a one-year duration; its creation screen displayed expiry on2027-11-05. This records the observed date, with no token value or identifier. Renewal changes expiry, so the operator checks the current entry before maintenance. Its two credential values belong only to the same device's secret store or Windows USER environment, `CORTHEX_NEXUS_CLIENT_ID` and `CORTHEX_NEXUS_CLIENT_SECRET`. Keep the private token-to-device mapping outside Git.

After a separate revocation authorization, identify that exact production CLI token using the private inventory, remove only its selection from the existing production Service Auth policy, and delete it under **Zero Trust → Access controls → Service credentials → Service Tokens**. Preserve the legacy production token, human login and development app. Remove this device's two USER variables only after confirming they belong to the revoked token. Verify refusal through a read-only service request without redirects or saved credentials/cookies, and verify the other authorized access paths. No revocation, renewal or global cleanup is performed by this procedure's documentation update.

Cloudflare distinguishes revoking application sessions from deleting a service token: valid client credentials can obtain a new session after session-only revocation. See the [official service-token lifecycle and revocation instructions](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/). The1year duration and revocation steps are inventory/runbook facts, not an automatic renewal or deletion schedule.

### Preserved v5 code response failure

Root cause remains **unconfirmed**. The [preserved v5 summary](../docs/12-qa/runs/transport-2026-11-05/v5-summary.json) records880 code observations:879 completed200 responses and one520 response, in sitemap slot59 (stage opening20, code ordinal19). The original run remains failed; its denominator and verdict are unchanged.

A read-only origin-journal check of2026-11-04 16:42:12–16:42:54 UTC found zero Node and zero Tunnel records in that window. This did not identify an origin or edge cause, and no correlated provider trace was obtained. The later v8 success and the separately corrected cache/lifecycle checks do not diagnose this520. Preserve the failure when comparing runs; do not fold it into a successful subset.
