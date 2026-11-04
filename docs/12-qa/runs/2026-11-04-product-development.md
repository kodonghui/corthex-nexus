# Product development checks, 2026-11-04

[한국어](2026-11-04-product-development.ko.md)

Scope: TASK-236–TASK-243, TASK-248–TASK-252, TASK-255–TASK-264. The production release decision remains separate.

## Source and artifacts

The product branch is `codex/nexus-views-0.2`, based on runtime commit `d3de08bbb3fe5e6e4a39a7936bfa72d9a6cf2378`. The exact hub reference is `3570fb0c755b50c314ca26f0361c72a71fe22d0d` in kodonghui/corthex#103. The latter passed 930 local Python tests (916 passed, 14 skipped, 642.061 seconds) and four strict package validations after the review fixes.

The first committed browser metadata SHA256 (historical 7C35) is `7c35c4998aa991d352c6e1b2f3d2f67ffe30b9818e6358b9e4b180a32efb631c`, reproduced by two builds. It describes 443 files, 23,484,032 raw bytes and 16,357,513 summed gzip bytes. It includes the approved read-only ERD navigation/label modifications and the removal of Excalidraw's unused hosted Firebase configuration. Input and payload hashes are checked, and hosted Firebase keys are refused.

## Separate execution scopes

| Scope | Observed result | Limit |
| --- | --- | --- |
| Product Node suite | 120 tests passed on the final editor graph | Synthetic Access and SQLite; no real account |
| Product Python suite | 9 passed against the exact clean hub reference | Bridge/template/public checks, not the upstream OS matrix |
| Worker dry-run | Build retained with the browser payload modules | No production deployment |
| External pinned checks | OpenAPI, response corpus, default corpus, hub contract, hook controls, sanitizer controls and standalone Schemathesis passed | Offline/local stand-ins are explicitly separate from live Access |
| Standalone Schemathesis | 32 operations; 154 responses passed each of five checks | Bounded three-example smoke, not every named response |
| Named API audit | 411 example schemas checked; 232 named variants observed at the actual handler; 270/411 union with default controls | 141 named variants unobserved; eleven shared examples need applicability clarification |
| Portable route tests | 47 success/state requests and 138 authorization/header refusals across all 32 operations; full row hashes checked on reads/refusals | Request count, not unique TC count |
| Browser regression | Five actual pointer/draft/race regressions passed on artifacts 03E31C, B17B3C and 06BB2B; latest retained 06BB run 14.699 seconds | Latest 7C35 removes hosted configuration only; CI repeats browser regression on its exact source |
| Picture inspection | Three scene types at 320/390/768/1440, nine DDD steps, pan/zoom, actual markers and no-ID comment effect | Visual/page measurements on 03E31C; no physical-device or final OVH P95 claim |
| Live development Access | Human page 200, unauthenticated redirect and real agent-only proposal 201/withdraw/delete | Synthetic project only; identity values stay outside the repository |
| Origin migration rehearsal | Read-only D1 export stayed on the origin; migrations 1/2/3 preserved rows/digests; isolated rollback matched old schema/data | Rehearsal, not production data migration; initial rollback used SQLite's backup API |

Raw runs remain in the private execution packet. No tokens, assertions, cookies, user profiles, real repository snapshots or origin database files enter this report.

The first Linux PR run at `bc82059` passed all five portable browser regressions in 26.129 seconds and removed its owned profile. The job then failed to upload receipts because the artifact action rejected a path containing `..`; all other product jobs passed. The artifact directory now uses `runner.temp` directly. The failed workflow remains historical evidence and is not called an all-checks pass.

## Findings preserved for retest

| ID | Finding | Change |
| --- | --- | --- |
| BUG-535 | Initial Excalidraw fit was overwritten by its initial-data load | Wait for loaded scene and viewport before fitting |
| BUG-536 | Canvas stacking covered actionable markers | Explicit canvas/marker stacking |
| BUG-537 | Excalidraw's `ko-KR` document language missed the Korean wrapping rule | Use `:lang(ko)` |
| BUG-538 | ERD page's commit line overflowed at 320 pixels | Bound the flex child's width and wrapping |
| BUG-539 | API-104 JavaScript media type differed from the frozen contract (TC-770) | Serve `text/javascript`; enforce actual asset media |
| BUG-540 | Comment heading omitted its state and related proposals omitted state/Open | Show item/state heading and explicit proposal state/Open |
| BUG-541 | Successful withdrawal date was overwritten by the following refresh | Show the actual returned withdrawal date after refresh |
| BUG-542 | Korean user text wrapped by syllable in the English UI | Apply Korean word wrapping to user-content regions in either language |
| BUG-543 | Collapsing a selected stage displayed an invalid-stage error | Accept a known project without an `s` parameter |
| BUG-544 | Named parts hid a valid project-wide picture | Include the existing empty part in picture links |
| BUG-545 | A completed part was described as having no progress record | Omit pending-stage guidance when records already exist |

Original failures and harness/tool failures remain recorded; later successful runs do not replace them. BUG-534's old intermittent Worker 403 needs the separate completed OVH opening batch. The new graph's final OVH maximum push/RSS and mobile P95 are measured after integration deployment.

Core changes still require MEMORY C1, PR C and PR D on main. No main merge, production switch, release tag or first real repository upload is implied by these checks.

## Final frozen artifact and follow-up

The final metadata SHA256 is `caf43251385f56770cfa31bbad229bb16df7527d35a73adf2558b382d8adb5bb`, reproduced with identical bytes in a second build:443 files,23,486,991 raw bytes and16,358,576 summed gzip bytes. Python9, Node121, Worker dry-run and all seven pinned external checks passed on this source. The linked hub exact head3570fb0 passed all17 CI jobs and code/security review with no findings; the first unrelated MEMORY observer failure remains in history.

The final portable driver passed34 paths in106.660 seconds on the exact CAF432 artifact, with seven fresh fixture/browser runs and all seven owned profiles removed. It covers five picture/pointer/draft races, four discussion actions, needs-user dismissal, eighteen delayed/error/retry paths, four script failures and two fresh-browser stylesheet failures. Delayed reads, mocked read failures and actual write/SQLite effects are distinguished in [the sanitized receipt](2026-11-04-product-development/results.json). A separate successful selection check retained focus and39..42 after the delayed reply read; the original row retained a42..42 caret.

The normal screen matrix contains48 F260 combinations (six states ×320/1440 ×EN/KO ×light/dark); CAF432 changes only the overview source phrase, separately checked in Korean at320/dark. The [selected captures](2026-11-04-product-development/summary.md) name their exact source artifact; no entire error-state matrix or physical-device check is inferred.

The API audit now has411 schema-valid examples,355 actual named handler variants and393/411 union with default controls. [The ledger](2026-11-04-product-development/api-response-ledger.json) retains every TC ID. [Eighteen exact generic-example applicability limits](2026-11-04-product-development/api-example-applicability.md) preserve the normative roles/fields. Boundary requests183, unchanged refusals130, integrity checks29 and external response schemas183/183 supplement the earlier47/138 requests. No full TC pass or live Access result is inferred from these counts.

| ID | Fixed behavior | Regression |
| --- | --- | --- |
| [BUG-546](https://github.com/kodonghui/corthex-nexus/issues/14) | Loading keeps a reply box, disabled actions and input/focus | comment-loading-ready-reply |
| [BUG-547](https://github.com/kodonghui/corthex-nexus/issues/15) | Gone comment keeps a copyable cached or uncached draft | gone/draft states |
| [BUG-548](https://github.com/kodonghui/corthex-nexus/issues/16) | Proposal loading shows source length and disabled actions | proposal-loading-source-length |
| [BUG-549](https://github.com/kodonghui/corthex-nexus/issues/17) | Read errors identify the comment or proposal and offer retry | read failure/retry |
| [BUG-550](https://github.com/kodonghui/corthex-nexus/issues/18) | Stale refresh keeps the actual409 conflict notice | actual stale-proposal conflict |
| [BUG-551](https://github.com/kodonghui/corthex-nexus/issues/19) | Main CSS failure preserves the readable static fallback | asset-regression --core-css |
| [BUG-552](https://github.com/kodonghui/corthex-nexus/issues/20) | Editor CSS failure preserves the accessible item list/panel | asset-regression --editor-css |

Integration CI, final OVH performance and updated CLI restore are separate next checks. Release and core gates remain unchanged.
