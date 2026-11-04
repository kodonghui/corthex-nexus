# Working on NEXUS

- This public repository owns the NEXUS server, browser views, design tokens and stage 01–12 sources. English is the source; README and docs have matching `.md` and `.ko.md` copies. Use `the maintainer` in repository text. Private records, personal names and private publication/Miro links stay in the conversation or Notion.
- The hub plugin and core skills remain in `kodonghui/corthex`. `hub-ref.json` pins their exact commit. Changes to their snapshot format or page template require linked upstream/product PRs and the product checks against the proposed pin. Never silently follow a branch tip or fabricate compatibility from an aggregate CI result.
- `nexus/` is plain JavaScript with no server runtime dependencies. Wrangler is its only development dependency. Prefer `node:http` and `node:sqlite` for the approved standalone runtime. Ask before adding a runtime dependency or a repository build/development dependency. SQL stays in `nexus/src/store.js`; a SQLite batch is one transaction. Keep the Worker build and tests working.
- Browser-only Excalidraw, ERD Editor, React and React DOM are approved by the stage 02 D11/editor-trial decision. Their pins, licenses and reproducible prebuilt files belong to the browser build. They add no server dependency, third-party CDN or Access bypass. The2026-11-04 maintainer decision permits public immutable content-hashed code/style/font caching at the same Access-protected origin; HTML/API/project data and refusals remain no-store. Stage 09 tokens are frozen.
- The maintainer's server runs the approved standalone runtime behind Access and a Tunnel, bound to `127.0.0.1`. Keep real IPs, SSH names/users/ports/paths/keys, Tunnel IDs/credentials/certificates, Access team/AUD values and service tokens outside Git. Never copy keys or authentication files between devices. Database files, backups and logs stay on the server. Examples use placeholders.
- Scope: one person on their own devices, server behind Access. Test network authentication, cross-site writes, untrusted text/requests, concurrent/repeated writes and recovery. Findings requiring an attacker to have already modified the person's private local settings are recorded without blocking this iteration.
- Work through PRs. Update stage 10/12 source first; Notion follows. Keep original result history and distinguish fixture, mocked, real server, page measurement and visual evidence. Preserve working changes before moving them. Main merge, production switch and tags follow the conditional release decision below. First real-repository upload and old Worker/D1 deletion still require their separate confirmations.

## Checks before every authored commit

Prepare a clean checkout of the exact hub pin with `python tools/fetch_hub_ref.py --destination <outside-checkout-path>` and set `CORTHEX_HUB_CHECKOUT` to it. Test commands do not fetch.

```sh
python -m unittest discover -s tests -v
node --test nexus/test/*.test.js
node nexus/node_modules/wrangler/bin/wrangler.js deploy --dry-run --config nexus/wrangler.jsonc --outdir <outside-checkout-path>
```

Use Node 24 LTS or later. Run the pinned external contract suite in `.github/workflows/check.yml` for contract, server or hub-boundary changes, and the full-history secret/public-safety checks before publishing imported history. No test uses real credentials or a paid API. Browser flows use synthetic development data and report actual effects.

Core main-merge gates require C1 0.2.0, PR C and PR D; the latest decision authorizes earlier drafts of TASK-244/245/247. Plan approval/import alone is not release approval; the separate conditional-release decision below governs release.

## Conditional release decision of2026-11-04

The maintainer authorized drafts of upstream TASK-244/245/247 now; TASK-246 follows PR C. Do not merge upstream core to main before the MEMORY0.2.0 tag and PR C. Integrate latest main in the NEXUS integration branch without changing main during MEMORY checks.

Conditional release is preapproved after REQ-149 P95<=3s, REQ-124 after-body processing<1s, all710 QA cases adjudicated with zero Must failures, migration/recovery rehearsal, core main integration after MEMORY/PR C, and required checks plus Code/Security reviews. Then merge product#1/upstream#89, switch/migrate production and tag, reporting remaining issues. First real-repository upload still requires REQ-107 confirmation. Keep Worker/D1 for14days after the switch and ask before deletion. If any condition remains, ask once with numbers and wait for the answer before release. This decision supersedes the earlier separate final-release question; it does not approve new paid plans or other contract changes.
