# NEXUS server

[한국어](README.ko.md)

The NEXUS server puts the CORTHEX project hub on an address of your own, so you can open it from any device. The approved standalone runtime uses Node HTTP and SQLite behind Cloudflare Access and a Tunnel; the compatible Worker/D1 runtime remains available. Both keep snapshots sent by `hub.py push` and serve the first page at the address and the hub page at `/hub`. The standalone deployment and recovery procedure is below.

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
5. Pin the application before checking it. Remove the empty `ACCESS_AUD` placeholder from your local `vars`, then run `npx wrangler secret put ACCESS_AUD -c wrangler.local.jsonc` and enter that application's **Application Audience (AUD) Tag** at the prompt. Set `ACCESS_TEAM_DOMAIN` in your local file's `vars` to your team host, such as `your-team.cloudflareaccess.com`, and deploy again. Open the address in a private window: the Access sign-in comes first, then the empty first page, whose Full checks open the hub page at `/hub`.
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
- `hub.py remove <project>` sends no removal: it shows what removing the project deletes and the address of the project's data in NEXUS, where you remove it under your own sign-in. Taking a project out of `nexus.push` stops further pushes but leaves what the server holds.
- When signed in, `/api/snapshots` lists what the server holds.

## Push from the repository on each merge

A project's repository can send its snapshot itself each time a commit reaches its default branch, without a session: a job of the repository's own CI runs `hub.py push --job`. The agent's pushes stay as the second way. Whichever comes first stores the commit, and the other finds it held and sends nothing.

The job sends only for a project that the server already holds, so a project's first push is still `hub.py push <project> --first` in a session, after your yes. It never replaces a held commit: after the default branch was rewritten, it fails and names both commits. It reads no agent to-do and sends no pending writes.

To add it to a project's repository on GitHub:

1. Add the file below to the repository as `.github/workflows/corthex-nexus-push.yml`, by pull request. If the default branch is not `main`, write its name under `branches`.
2. In the repository's **Settings** › **Secrets and variables** › **Actions**, add three repository secrets: `CORTHEX_NEXUS_URL`, the server's `https` address, and `CORTHEX_NEXUS_CLIENT_ID` and `CORTHEX_NEXUS_CLIENT_SECRET`, the service token of step 6.
3. Merge the pull request. From then on, each commit that reaches the default branch runs the job.

```yaml
name: NEXUS push

on:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: corthex-nexus-push
  cancel-in-progress: false

jobs:
  push:
    if: github.ref_name == github.event.repository.default_branch
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Check out the default branch with its history
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          path: project
          fetch-depth: 0
          persist-credentials: false
      - name: Check out the hub at its pinned commit
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          repository: kodonghui/corthex
          ref: c6095b40c71bc74d207b13b5b08aeeb078c7d0c5
          path: hub
          persist-credentials: false
      - name: Push the snapshot
        working-directory: project
        env:
          DEFAULT_BRANCH: ${{ github.event.repository.default_branch }}
          CORTHEX_NEXUS_URL: ${{ secrets.CORTHEX_NEXUS_URL }}
          CORTHEX_NEXUS_CLIENT_ID: ${{ secrets.CORTHEX_NEXUS_CLIENT_ID }}
          CORTHEX_NEXUS_CLIENT_SECRET: ${{ secrets.CORTHEX_NEXUS_CLIENT_SECRET }}
        run: |
          git symbolic-ref refs/remotes/origin/HEAD "refs/remotes/origin/$DEFAULT_BRANCH"
          python3 ../hub/plugins/corthex-nexus/skills/corthex-hub/scripts/hub.py push --job --json
```

The job runs only on a push to the default branch, never for a pull request, so a fork's change never runs with the secrets; a fork has none, and there the job sends nothing and names the missing secrets. It checks out the repository with its full history and, beside it, the hub at the commit that this repository's [`hub-ref.json`](../hub-ref.json) names, and runs nothing from the repository itself. Anyone who can change the workflows on the default branch can use the secrets, so add them only to a repository that only you can push to. When you update the server, take the file again, so that the job's hub moves with it.

The job's log is the one line of `hub.py push --job --json`, which never holds a secret's value:

| The line says | The job | What it means |
| --- | --- | --- |
| `"sent": true` | passes | The commit's snapshot is stored, with the server's answer in `pushed`. |
| `"why": "already-held"` | passes | The server holds this commit or a newer one. |
| `"why": "first-push-waits"` | passes | The server does not hold the project: push it first in a session with `--first`. |
| `"why": "not-set"` | passes | A secret is not set, and `missing` names it. |
| `refused` or `failed` | fails | The server refused the push or did not answer, or the held commit is not in the pushed commit's history; the line says why. |

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

A copy of the newest backup also goes to another machine, Google Drive, so that
losing the server's disk loses at most a day (REQ-291). `nexus-backup-copy@dev.timer`
runs daily at 04:00 UTC, after the backup, with up to 15 minutes of jitter,
including a missed run after downtime. Its first step, `backup-copy.js copy`,
sends with rclone the newest backup whose receipt names it, the archive before
its receipt, and removes copies older than 30 days only while the newest copy is
less than a day old. Its second step, `backup-copy.js age`, reads the names of the
copies, never their contents, and says how old the newest one is, such as "The
newest copy of the backup is 3 hours old." Past a day, or with no copy, it says
so and the service fails, which `systemctl --failed` lists. A failed send fails
nothing by itself: the age that follows says what it means. The output holds
archive names, sizes and ages only, with no path, remote or login.

Set it up once. The login is made on the server and stays there, never in Git,
a message or a record, and no key or login file moves between machines:

1. Install rclone at `/usr/bin/rclone`, from the system's packages or rclone.org.
2. In the Google Cloud console, make the login's own client, since rclone's shared
   one stops working during 2026: a project with the Google Drive API enabled; an
   OAuth consent screen of the type External, with the scope `drive.file` alone,
   published, since an app's login in testing ends after a week; and an OAuth
   client of the type Desktop app. Its ID and secret go only into rclone's prompts
   on the server, in the next step.
3. From the laptop, `ssh -L 53682:127.0.0.1:53682 <configured-origin-alias>`. On
   the server, `sudo install -d -m 0700 -o nexus-dev -g nexus-dev /var/lib/nexus-dev/rclone`,
   then `sudo runuser -u nexus-dev -- env RCLONE_CONFIG=/var/lib/nexus-dev/rclone/rclone.conf rclone config`:
   a new remote `<remote>` of the type `drive`, with that client's ID and secret,
   the scope `drive.file`, so that the login reaches only the files that rclone
   made, and auto config. Open the address that rclone shows,
   `http://127.0.0.1:53682/auth?...`, in the laptop's browser, sign in to the
   Google account that keeps the copies, and allow it.
4. Add `NEXUS_BACKUP_REMOTE=<remote>:nexus-backups` to `/etc/nexus/dev.env`.
   rclone makes the folder at the first copy.
5. The next deployment installs `nexus-backup-copy@.service` and its timer and,
   since the remote is set and rclone is installed, enables the timer.
6. `systemctl start nexus-backup-copy@dev.service`, then
   `journalctl -u nexus-backup-copy@dev -n 4` shows the copy and its age.

Read the age on any day with `journalctl -u nexus-backup-copy@dev -n 2`. Stop the
copies with `systemctl disable --now nexus-backup-copy@dev.timer`; those on the
remote stay. To end the login, remove the app's access in the Google account's
security settings and delete `/var/lib/nexus-dev/rclone/rclone.conf`.

Restore one copy on the other machine and compare it with the server's data.
Download the newest `<archive>.sqlite` and its `<archive>.sqlite.json` from the
folder into one folder there, with rclone or Google Drive's own download, and,
with Node 24 and this repository:

```sh
node nexus/tools/database.js restore --backup <absolute-folder>/<archive>.sqlite --destination <absolute-folder>/restore-check.sqlite
node nexus/tools/database.js counts --database <absolute-folder>/restore-check.sqlite
```

On the server, as the service's user:

```sh
sudo runuser -u nexus-dev -- /usr/bin/node /opt/nexus/dev/current/nexus/tools/database.js counts --database /var/lib/nexus-dev/backups/<archive>.sqlite
```

The restore checks the receipt's SHA-256, which the server wrote, and the
database's integrity. `counts` gives each table's number of rows and, in the
tables that name a project, each project's, and the two answers are the same.
Delete the restored file afterwards, since it holds the project spaces' text.

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

The private setting `NEXUS_EARLY_HINTS=1` added `Link: rel=preload` hints to 0.2's picture view. Since TASK-278 that address answers `302` to the stage's page, which sends no hints, so the setting has no effect and a server that still sets it ignores it.

Only public content-hashed /code/ files may be edge-cached (public,max-age31536000,immutable). HTML/API/data remain no-store behind whole-host Access. Verify HIT/Age and unauthenticated GET/HEAD refusal at cached URLs before release. REQ-124 processing1s starts after body receipt and ends at response handling completion. Keep the old Worker/D1 for14days after switching and ask separately before removal.

### Production CLI credential lifecycle

Inventory observation on2026-11-05: the new production CLI service token was created with a one-year duration; its creation screen displayed expiry on2027-11-05. This records the observed date, with no token value or identifier. Renewal changes expiry, so the operator checks the current entry before maintenance. Its two credential values belong only to the same device's secret store or Windows USER environment, `CORTHEX_NEXUS_CLIENT_ID` and `CORTHEX_NEXUS_CLIENT_SECRET`. Keep the private token-to-device mapping outside Git.

After a separate revocation authorization, identify that exact production CLI token using the private inventory, remove only its selection from the existing production Service Auth policy, and delete it under **Zero Trust → Access controls → Service credentials → Service Tokens**. Preserve the legacy production token, human login and development app. Remove this device's two USER variables only after confirming they belong to the revoked token. Verify refusal through a read-only service request without redirects or saved credentials/cookies, and verify the other authorized access paths. No revocation, renewal or global cleanup is performed by this procedure's documentation update.

Cloudflare distinguishes revoking application sessions from deleting a service token: valid client credentials can obtain a new session after session-only revocation. See the [official service-token lifecycle and revocation instructions](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/). The1year duration and revocation steps are inventory/runbook facts, not an automatic renewal or deletion schedule.

### Preserved v5 code response failure

Root cause remains **unconfirmed**. The [preserved v5 summary](../docs/12-qa/runs/transport-2026-11-05/v5-summary.json) records880 code observations:879 completed200 responses and one520 response, in sitemap slot59 (stage opening20, code ordinal19). The original run remains failed; its denominator and verdict are unchanged.

A read-only origin-journal check of2026-11-04 16:42:12–16:42:54 UTC found zero Node and zero Tunnel records in that window. This did not identify an origin or edge cause, and no correlated provider trace was obtained. The later v8 success and the separately corrected cache/lifecycle checks do not diagnose this520. Preserve the failure when comparing runs; do not fold it into a successful subset.
