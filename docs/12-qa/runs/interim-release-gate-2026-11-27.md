# NEXUS v3 QA: interim release gate

[한국어](interim-release-gate-2026-11-27.ko.md)

Recommendation: **no-go**, including for the first group. This is an interim assessment, not a gate on the release commit. On merged NEXUS commit `7c6c594` with hub `e6b46ac`, the local disposable-server checks for TC-214 to TC-221 passed. Including TC-221 and TC-244, the 244-case plan has 208 pass, 36 not run and 0 blocked. Many other passes cite earlier commits and must be checked again on the release commit. No case is waived. BUG-008 is fixed with a passed public-path recheck; BUG-002 to BUG-005 and BUG-007 remain open as S3 findings, and BUG-001 is fixed.

## BUG-008: fixed and rechecked

[BUG-008](../bugs/BUG-008.md) was proposed S2/P1 after an agent request failed through the public path. The server-side alternative-header fix merged in PR 170 (`0a6b152`), and the hub-side change merged as [hub PR 228](https://github.com/kodonghui/corthex/pull/228) at `e6b46ac`. The local credential regression passed on `71bc506`. The coordinator reported a public-path recheck on 2026-11-27 at 16:10 UTC using hub `e6b46ac` and a v3 profile: can-send was true, the held-commit read returned 200, and a real project push returned outcome done with pushSnapshot 200. The held revision remained 1 because the source commit was already current; reported trace metadata confirmed the public edge path. No address, credential value or project identity is included here. This public-path pass is the coordinator's direct execution as reported to this QA run. Raw responses and server logs are not retained in this public record, so it was not independently reproduced here. PR 169 merged the source update at `fe0f958`: BUG-008 is fixed and TC-244 is pass. The precise cause of the original header failure remains unisolated.

PR 167 merged the new hub pin at `7c6c594`. The current push workflow intentionally retains the legacy CF-Access header pair for v2. Local synthetic v2 tests checked the override and push behavior; no successful live v2 push after this change is evidenced here, and v2 was not touched. At the later v3 cutover remove its override and switch its URL and credential secrets to v3 values.

## Blocking items

Eight gate cases still need the required browser-flow walk: TC-225, TC-226, TC-227, TC-230, TC-231, TC-233, TC-234 and TC-235. Their expected arrows, roles, widths, screenshots and data checks remain in the plan. These block the first group too. Screen captures from the local synthetic walk cover selected states only and do not close these cases. A real phone and the real Access sign-in/expiry path were not available in the isolated local environment; the local stand-in Access gate does not establish those results.

A later [read-only browser reconnaissance](aside-readonly-2026-11-27.md) reached the deployed owner screens and retained redacted 1440/360 shell captures for selected cases. The coordinator reported deployed commit `445f7cf`, which the browser did not independently verify. The reconnaissance did not establish an isolated test project and did not exercise the required writes, other roles or full flows, so none of the eight cases is closed by it.

A subsequent [disposable local-server walk](aside-local-2026-11-27.md) exercised selected first-push, role, proposal, confirmation, redraw, credential, deletion and forced-backup paths at both widths, with data checks and synthetic screenshots. The browser's 360px mode was a narrow PC window, not a touch phone; the full arrows and pairwise combinations remain incomplete, and forced backups do not close the deployed schedule cases.

The maintainer separately directed an early v3 deployment on 2026-11-27, before this gate, and subsequently approved the public-path fixes. That deployment is reported in PR 169; v2 and its data remain in place. The no-go recommendation applies to the release gate and does not decide a rollback of the existing deployment. The 11 deployment-dependent gate cases remain unverified here: TC-037, TC-038, TC-097 and TC-205 to TC-212. As the plan specifies, the first-group go requires the other blockers to pass or a separately recorded waiver for each named item; the wider release remains held until the deployment-dependent cases pass or are individually waived.

TC-206 remains not run: the opportunity to inspect the deployed v3 before its first push was missed, and no direct evidence of an empty list from that time is available. The reported creation of a fresh data folder and the continued separate v2 service are indirect evidence only. As a separate local substitute, on merged main commit `fe0f958`, `server/test/owner.test.js`'s `a new install lists no project and nothing to do, and never reads a v2 store beside it (SPEC-015)` test passed (1/1) on Node 24: a fresh temporary v3 store with a synthetic v2 store beside it returned empty project and to-do lists through a local server. This is not a deployed TC-206 pass and does not prove the state of the real v2 data or backup.

After the other blocking items have passed or received individual waivers, the maintainer must separately decide whether to expand to v3, including turning off v2 and switching the push workflow. If that go is given, TC-207 runs as the first step of that expansion; it must pass before expansion is complete. If it fails, the stated plan is to return the push workflow to v2. These are conditional future steps, not actions authorized by this report. BUG-005 records that TC-212's expected backup notice conflicts with the screen definition; resolve that expectation before the case can be closed. This report does not authorize deployment, a real-repository upload, or deletion of any existing service or data.

## Known risks

There are 17 non-gate cases without a pass. Each remains open with its named follow-up in the plan:

- TC-198 and TC-199: measured P95 performance on the intended environment is still needed.
- TC-200, TC-201 and TC-202: browser-version, design and accessibility coverage remains unrun.
- TC-213: real read-only external-tool status requires the deployed environment and appropriate credentials.
- TC-228, TC-229, TC-232, TC-236 and TC-237: the named full flow walks remain unrun.
- TC-238 to TC-242: full screen-state and mockup comparisons remain unrun; TC-240 also shares BUG-005's unresolved backup-notice expectation; selected local states have partial evidence in the [walk report](qa-resume-2026-11-27.md).
- TC-243: real-phone read and comment walk remains unrun.

`server/test/layout.test.js`'s single cold-run layout timing test took 1,158 ms, 1,034 ms and 1,185 ms against its 1,000 ms limit in three runs on the shared host; other runs of the same suite passed. The failures were observed on PR 167 at `23261b1` and `3083d6c` with a merge working tree, and `e95fdbd` with a review working tree. The cause is not established; [BUG-007](../bugs/BUG-007.md) in QA PR 166 tracks the test failure as a hypothesis, without weakening the test or claiming a product failure. This observation does not establish the required P95 in the intended environment.

QA PR 166 has merged; its plan and bug records are the stage-12 source for this report. The controlled gate, API refusals and response-loss tests are local evidence and do not prove the deployed Access or provider path. Optional AI exploratory testing was not run and is not a gate item. Recompute counts and review bug status, pinned tests, screen evidence, and open review threads on the exact release commit before any go/no-go decision.

## Retrospective candidate

Evaluate adding a public-history check for real server-location references, with tests for false positives.
