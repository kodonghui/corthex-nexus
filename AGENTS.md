# Working on NEXUS

- This public repository owns the NEXUS server, browser views, design tokens and stage 01–12 sources. English is the source; README and docs have matching `.md` and `.ko.md` copies. Use `the maintainer` in repository text. Private records, personal names and private publication/Miro links stay in the conversation or Notion.
- The hub plugin and core skills remain in `kodonghui/corthex`. `hub-ref.json` pins their exact commit. Changes to their snapshot format or page template require linked upstream/product PRs and the product checks against the proposed pin. Never silently follow a branch tip or fabricate compatibility from an aggregate CI result.
- `nexus/` is plain JavaScript with no server runtime dependencies. Wrangler is its only development dependency. Prefer `node:http` and `node:sqlite` for the approved standalone runtime. Ask before adding a runtime dependency or a repository build/development dependency. SQL stays in `nexus/src/store.js`; a SQLite batch is one transaction. Keep the Worker build and tests working.
- Browser-only Excalidraw, ERD Editor, React and React DOM are approved by the stage 02 D11/editor-trial decision. Their pins, licenses and reproducible prebuilt files belong to the browser build. They add no server dependency, static-assets bypass or CDN. Stage 09 tokens are frozen.
- The maintainer's server runs the approved standalone runtime behind Access and a Tunnel, bound to `127.0.0.1`. Keep real IPs, SSH names/users/ports/paths/keys, Tunnel IDs/credentials/certificates, Access team/AUD values and service tokens outside Git. Never copy keys or authentication files between devices. Database files, backups and logs stay on the server. Examples use placeholders.
- Scope: one person on their own devices, server behind Access. Test network authentication, cross-site writes, untrusted text/requests, concurrent/repeated writes and recovery. Findings requiring an attacker to have already modified the person's private local settings are recorded without blocking this iteration.
- Work through PRs. Update stage 10/12 source first; Notion follows. Keep original result history and distinguish fixture, mocked, real server, page measurement and visual evidence. Preserve working changes before moving them. Main merge, production address/data switch, release tags, the first real repository snapshot upload and retirement of the old Worker/D1 wait for the final release decision.

## Checks before every authored commit

Prepare a clean checkout of the exact hub pin with `python tools/fetch_hub_ref.py --destination <outside-checkout-path>` and set `CORTHEX_HUB_CHECKOUT` to it. Test commands do not fetch.

```sh
python -m unittest discover -s tests -v
node --test nexus/test/*.test.js
node nexus/node_modules/wrangler/bin/wrangler.js deploy --dry-run --config nexus/wrangler.jsonc --outdir <outside-checkout-path>
```

Use Node 22.13 or later. Run the pinned external contract suite in `.github/workflows/check.yml` for contract, server or hub-boundary changes, and the full-history secret/public-safety checks before publishing imported history. No test uses real credentials or a paid API. Browser flows use synthetic development data and report actual effects.

Core/MEMORY gates apply to upstream core changes: C1 0.2.0, PR C and PR D must land before those changes. Plan approval and repository import do not approve a release.
