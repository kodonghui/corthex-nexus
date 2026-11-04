# Repository extraction, 2026-11-04

[한국어](README.ko.md)

The maintainer approved extracting NEXUS now, while retaining the hub/core in the upstream harness. The completed hub merge `76508243558abaedcc15bb422c454341845fcabd` is the integration cut. Unfinished view work was preserved in a local recovery packet and is carried later as product work; no failing UI was merged merely to create this cut.

The fresh clone was filtered with **git-filter-repo 2.47.0** over `main` and `codex/nexus-0.2`, using the recorded [path inventory](2026-11-04-paths.txt). Historical name/status and rename edges were inspected;132 selected historical paths and no rename edge outside that selection were found. PR/issue references in commit messages were qualified with `regex:(?<![\w/])#(\d+)==>kodonghui/corthex#\1`; old commit references were preserved for the map. The original repository was not rewritten. Only the two exported branches are published.

The official [commit map](2026-11-04-commit-map.txt) retains removed-commit zeros. A source commit that changed only excluded files may be pruned; the [branch map](2026-11-04-branch-map.json) records the exact source/filtered tip pairs even in that case. Both tips' selected file bytes and modes matched exactly:94 files on main and131 on integration;71 commits remain reachable.

Before first publication, all 414 reachable UTF-8 content-blob versions passed the upstream public-safety rules. Gitleaks 8.30.1 was downloaded from its official release and SHA256 verified. It found two historical generic-key matches in the bilingual API document's public quoted `Idempotency-Key` example. They were independently confirmed as noncredential write IDs; only those two exact fingerprints are in `.gitleaksignore`. The reviewed history scan returned zero findings. Values are withheld in diagnostics. New bootstrap files receive the same current-file/history checks before publication.

The product's Linux CI checks Node/server, Worker build, all existing contracts, the immutable upstream hub/server bridge and public safety. The standalone Node/SQLite and live development-contract jobs are added with their implementation tasks; this import does not claim them complete. Hub compatibility across the three OS/Python versions remains upstream.

Sources: [git-filter-repo manual](https://github.com/newren/git-filter-repo/blob/main/Documentation/git-filter-repo.txt), [Gitleaks 8.30.1](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1). The private working records retain scanned hashes, commands, false-positive classification and the unfinished-view recovery packet; credentials are not part of that packet.
