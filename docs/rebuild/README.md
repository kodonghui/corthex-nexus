# NEXUS rebuild workflow

[한국어](README.ko.md)

The maintainer requested a new thirteen-stage cycle on 2026-11-17. Enter through `/corthex:corthex` and route each stage using the table below. The active part is `rebuild`; `nexus` remains the legacy reference. This is a workflow record, not a stage-10 WBS or authorization to skip checkpoints.

| Stage | Routed skill | Required result |
| --- | --- | --- |
| 01 Domain discovery | `corthex-discover` | Miro event storming; timeline, context boundaries, context tables and map reviewed at separate checkpoints |
| 02 PRD | `corthex-define` | Requirements derived from the new domain model, with trace IDs |
| 03 User flow | `corthex-define` | Every user flow and exception traced to requirements |
| 04 Functional spec | `corthex-define` | Functional behavior, permissions and acceptance criteria |
| 05 ERD | `corthex-contract` | Data model with trace links and migration constraints |
| 06 API contract | `corthex-contract` | OpenAPI contract with errors, concurrency and version behavior |
| 07 Sitemap | `corthex-screen` | Screens, routes and navigation |
| 08 Screen states | `corthex-screen`, `corthex-uxui` | Every screen state, including empty, loading, error and permission states |
| 09 Mockup | `corthex-screen`, `corthex-uxui` | Multiple candidates, one chosen direction, light and dark themes, interactive HTML committed to Git |
| 10 WBS | `corthex-build` | A new dependency-ordered work plan with its own checkpoint |
| 11 Development | `corthex-build` | Implementation PRs against the approved plan and contracts |
| 12 QA | `corthex-build` | Browser execution of every flow; migration, recovery and outstanding limitations recorded |
| 13 Presentation | `corthex-present`, `corthex-uxui` | Presentation based on verified product behavior and remaining limitations |

Each draft or checkpoint unit is committed through a PR, merged into the default branch after required checks, sent with `hub.py push`, and requested with `--asks checkpoint`. Only the maintainer passes it in NEXUS. Internal stage checkpoints remain in force: stage 01 stops after Steps 1-b, 7 and 9. A first pass of that stage must remain `in_progress` until its final checkpoint is recorded.

Stage sources are configured for the new part as each stage starts. Existing files are reference material and do not become new approved outputs through a path change. New context and term IDs are assigned only when agreed, continuing after existing IDs. Preserve historical decisions and record each replacement and its reason in the project's Notion database rows. Private workspace links remain outside this public repository.

Production remains unchanged by this planning cycle until the new product passes QA and is deployed. Snapshot republication alone is insufficient for server-only comments, replies and checkpoints: preserve those through a compatible migration/recovery path. Do not remove real project data or pass checkpoints through browser automation. First uploads need the maintainer's separate consent; CI never supplies it.

Current state: stage 01's [checkpoint-1 draft](../01-domain/rebuild.md) is ready for repository review; every later stage is `not_started` in `.corthex/stages/rebuild.json`. Existing stage records remain in `.corthex/stages/nexus.json` with their original history. No runtime, token or legacy design is selected as the new architecture by this record.
