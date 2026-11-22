# NEXUS

[한국어](README.ko.md)

NEXUS shows a project's stages, pictures and discussions in a private browser view. **NEXUS v3 is being rebuilt from stage 01 in this repository, starting on 2026-11-22.** There is no v3 product yet; its stage sources and then its code will arrive here through pull requests.

- **v2 is archived** at the tag [`archive/nexus-v2-2026-11-22`](https://github.com/kodonghui/corthex-nexus/tree/archive/nexus-v2-2026-11-22), with its server, browser views, design tokens, stage sources and QA records.
- **The branch [`legacy/v2`](https://github.com/kodonghui/corthex-nexus/tree/legacy/v2) serves the running production instance** until v3 replaces it. Fixes to the running instance go there.
- **The hub plugin and the core skills stay in [kodonghui/corthex](https://github.com/kodonghui/corthex).** `hub-ref.json` pins the hub commit that this repository's checks and its push job use.

## Working here

[AGENTS.md](AGENTS.md) has the repository's rules and checks, and [SECURITY.md](SECURITY.md) its security scope. `.corthex/project.json` declares the project and its stages for the hub, with one part, `nexus`, and `.corthex/stages/nexus.json` records that part's progress. After a commit reaches `main`, the `NEXUS push` workflow sends the default branch's snapshot to the maintainer's NEXUS server with the pinned hub.
