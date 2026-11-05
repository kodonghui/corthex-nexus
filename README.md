# NEXUS

[한국어](README.ko.md)

NEXUS shows project stages, pictures and discussions in a private browser view. This public repository owns the server, browser views, stage 01–12 sources and frozen design tokens. The separately distributed **corthex-nexus hub plugin stays in [kodonghui/corthex](https://github.com/kodonghui/corthex/tree/main/plugins/corthex-nexus)** and is installed from its harness marketplace.

The maintainer approved this repository split and the standalone-server plan on 2026-11-04. `main` now includes the 0.2 standalone server and browser implementation; further work goes through `codex/nexus-0.2`. Production selection and release tags follow the [conditional release decision](AGENTS.md) and its dated QA/WBS evidence. Consult the release and recovery records for the selected operating runtime. Workers retain build/test compatibility.

## Start here

- [Server setup](nexus/README.md), [work plan](docs/10-wbs/nexus.md), [QA and actual results](docs/12-qa/nexus.md).
- [OpenAPI contract](docs/06-api/nexus.openapi.yaml), [domain](docs/01-domain/nexus.md), [data](docs/05-erd/nexus.md), [screens](docs/08-screens/nexus/README.md), [design](docs/09-mockup/nexus/README.md).
- [Repository rules](AGENTS.md), [security scope](SECURITY.md), [migration and history](docs/history/README.md).

`hub-ref.json` pins the upstream commit used by the hub/server bridge. Prepare it outside this checkout with `python tools/fetch_hub_ref.py --destination <absolute-outside-path>` and set `CORTHEX_HUB_CHECKOUT`. The test runner verifies the pin and fetches nothing. Run the commands in AGENTS.md with Node 24 LTS+ and Python 3.8+; external contract tools are pinned in CI.

## Imported history

Imported on **2026-11-04 KST** from `kodonghui/corthex`. Source main: `855bc6b463a4a5c57c949d1166b58db3915587c2`; source integration cut: `76508243558abaedcc15bb422c454341845fcabd`. The filtered tips are `93adb595f439e07e8a3476f3bd564105d034a5b6` and `23fb72a4a1bc003e18942cb48fb9d97c4f9b30b2`. [Commit map](docs/history/2026-11-04-commit-map.txt) and [branch map](docs/history/2026-11-04-branch-map.json) explain old QA/Notion SHAs. Historical PR/issue references remain qualified as `kodonghui/corthex#N`.

Database files, backups, credentials and actual deployment coordinates stay outside this repository. The first real project snapshot upload and old Worker/D1 deletion require their separate confirmations. Keep the old Worker/D1 unchanged for at least14 days after cutover. After the new origin is exposed, regardless of whether a write has been observed, its full13-table database is authoritative: use a verified compatible0.2 runtime or a reviewed forward fix with a consistent latest backup. Returning to the old snapshot-only D1 alone is not a lossless rollback. See the [migration and recovery boundary](docs/12-qa/runs/2026-11-05-origin-recovery.md); production selection and tags follow the conditional release evidence above.
