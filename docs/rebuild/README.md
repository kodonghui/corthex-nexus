# NEXUS rebuild workflow

[한국어](README.ko.md)

The maintainer requested a new thirteen-stage cycle on 2026-11-17 and explicitly instructed continuing through design on 2026-11-18. Enter through `/corthex:corthex`; rebuild is the active part and nexus is reference history. The [current instruction](../decisions/rebuild-authorization.md) replaces waiting between stages through stage-10 WBS for this cycle. It does not fabricate individual review of future artifacts or a human NEXUS pass.

| Stage | Routed skill | Output |
| --- | --- | --- |
| [01 Domain discovery](../01-domain/rebuild.md) | corthex-discover | Timeline, five contexts, 34 terms, commands, policies, map and preserved Miro frames |
| [02 PRD](../02-prd/rebuild.md) | corthex-define | Fifty active requirements, baseline and measurable acceptance |
| [03 User flow](../03-user-flow/rebuild/README.md) | corthex-define | Nine success/failure/recovery flows |
| [04 Functional spec](../04-functional-spec/rebuild.md) | corthex-define | 42 behaviors with authorization and exceptional cases |
| [05 ERD](../05-erd/rebuild.md) | corthex-contract | 20 tables, constraints and migration/recovery contract |
| [06 API](../06-api/rebuild.md) | corthex-contract | 36 HTTP operations and five operator interfaces |
| [07 Sitemap](../07-sitemap/rebuild.md) | corthex-screen | Eleven routes with generated board/list/slides |
| [08 Screen states](../08-screens/rebuild/README.md) | corthex-screen + corthex-uxui | Eleven screens, 91 states and 389 response mappings |
| [09 Mockup](../09-mockup/rebuild/README.md) | corthex-screen + corthex-uxui | Two retained layouts; selected A light/dark HTML and token baseline |
| [10 WBS](../10-wbs/rebuild.md) | corthex-build | 92 todo tasks with acyclic dependencies and acceptance |
| 11 Development | corthex-build | Later: implementation PRs against this design |
| 12 QA | corthex-build | Later: browser agents, every flow, migration/recovery evidence |
| 13 Presentation | corthex-present + corthex-uxui | Later: verified results and explicit limitations |

## Publication and review state

Author each source/record PR, pass required checks/reviews, merge main, hub push, then send a separate checkpoint request. Verify merge, upload, held commit and saved request separately. Current publication progress, actual request IDs and private addresses are in the existing project record. Stages awaiting individual NEXUS review stay in_progress; 11–13 are not_started. The [actual stage record](../../.corthex/stages/rebuild.json) retains the one real timeline pass and invents no others.

Keep English sources and Korean reading copies together; run the absolute term-check on Korean text before publication. Preserve old decisions and state why they are replaced. Public Git contains no personal data, secrets or private Miro/record URLs.

## Verified scope and later execution

Each stage records source checks, contract examples, mockup measurements and synthetic control evidence. The 816 mockup renders/95 assertions are not real-service QA. Public authentication provisioning, new v2 runtime, complete accessibility/performance, all-project migration, server-only discussion/checkpoint preservation and post-switch acknowledged-write recovery remain stages 11–12. Keep current production until the rebuilt product passes QA and is deployed. No deletion is planned.
