# NEXUS 0.2.1 QA closeout

Recorded on 2026-11-06 KST. Of 717 cases, **692 pass, 7 are partial, 18 do not apply and 0 fail**. Of 64 WBS tasks, **62 are done and 2 are in progress**. Phase 2 is on hold.

PR #44 corrected the applicability of 18 shared contract examples and added 7 examples backed by actual requests. The closeout reassessed the results of 66 previously partial cases and the status of 20 tasks. The original IDs, source references, steps and expected results are preserved alongside the old and new judgments. [Adjudication history](2026-11-05-patch-021-closeout/adjudication.json)

The native Codex walk verified 22 criteria and the completion conditions of 8 tasks in an isolated synthetic repository. It exercised actual PR, merge, fetch and push operations, as well as withdrawal, competing sessions, pending reflection, missing targets and checkpoint records on the same PR. [Native walk](2026-11-05-patch-021-closeout/native.md)

The browser walk covers 43 procedures, with 37 pass and 6 partial. It used 320px and 1440px widths in English and Korean with light and dark themes. The report distinguishes Prism rendering, actual local Node and SQLite effects, page and DOM assertions, and direct image review. Supplemental scroll captures identify the original screenshot, setting and error condition. Four unmodified synthetic screenshots accompany the report. [Browser report](2026-11-05-patch-021-closeout/browser.md) · [Evidence index](2026-11-05-patch-021-closeout/browser.json)

The maintainer accepted mock 429/503 responses for the external provider clauses of TC-1235, TC-1241, TC-1247, TC-1253 and TC-1260. Other clauses have separate evidence. TC-1221 still lacks an observed provider 403 or 401 page outside the portal. Ordinary unauthenticated reads returned a 302 login redirect. The human session expiry checks in TC-1237, TC-1242, TC-1248, TC-1254 and TC-1261, plus the combined expiry, reauthentication and retry procedure in TC-1272, are deferred. TASK-243 and TASK-251 remain in progress.

The patch includes 32 fixes, BUG-563 through BUG-594. The latest fixes restore overview details and source labels, preserve the ERD camera during editor handoff and clear the newer-picture notice after Show it applies the new commit. The SVG and ERD views use the same 0.1–1.5 camera range and two decimal places. The browser evidence index identifies the Linux GitHub Actions run that passed all eight browser suites. Full Windows runs stopped during profile cleanup. The new suite passed on its own on Windows.

The product pins hub commit `9636e33b6a39f189cb12ed586fe0d711071a607a`. The full plugin bytes at upstream tag `corthex-nexus--v0.2.1` match that pin. To update an existing Codex marketplace installation, run `codex plugin marketplace upgrade corthex` and restart Codex. [Hub tag](https://github.com/kodonghui/corthex/tree/corthex-nexus--v0.2.1) · [Codex plugin documentation](https://developers.openai.com/plugins/build/plugins)

Production was serving 0.2.0 at this source checkpoint. The release records the deployed commit, the consistent backup, the two restored-copy compatibility checks, the runtime switch, the read-only service checks and the rollback that retains the latest database.

Earlier performance observations remain open for BUG-559, the native whole-fit floor, and BUG-562, native code transfer delays. The cause of the single v5 HTTP 520 remains undetermined.
