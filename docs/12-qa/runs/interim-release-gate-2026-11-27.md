# NEXUS v3 QA: interim release gate

[한국어](interim-release-gate-2026-11-27.ko.md)

Recommendation: **no-go**, including for the first group. This is an interim assessment of the QA plan and local walks, not a release-commit gate. The 243 case rows in [QA draft PR 166](https://github.com/kodonghui/corthex-nexus/pull/166) at commit `5d7184b` recorded 206 pass, 36 not run and 1 blocked. GitHub OAuth `workflow` scope was added, permitting the push of PR 167's changed hub workflow. TC-221 passed a preliminary run at NEXUS PR 167 commit `6145f53` with hub `1becbab`, and the targeted test passed again on `e95fdbd` and `fc621d3` in PR 167; the full Node suite had the separate BUG-007 timing failure on the `e95fdbd` review working tree. The source-path checks also passed against hub `e6b46ac` at PR head `9e7009c` in [GitHub run 46027355864](https://github.com/kodonghui/corthex-nexus/actions/runs/46027355864); they must be checked again at the final merged pin. PR 167 remains unmerged, so the case remains not run in this assessment: the updated count in QA PR 166 at `71bc506` is 206 pass, 37 not run and 0 blocked; many passes are from earlier commits, and the release commit must be checked again. No case is waived. The coordinator reported that BUG-008 passed the public-path recheck; PR 169 records it fixed, with S2/P1 severity and priority, but has not yet merged. Five S3 findings, BUG-002 to BUG-005 and BUG-007, remain open in the [QA bug files](../bugs/). BUG-001 was fixed and merged in PR 165 and incorporated in QA draft commit `bc3a3d0`.

## BUG-008: passed recheck, source merge pending

[BUG-008](https://github.com/kodonghui/corthex-nexus/pull/169) was proposed S2/P1 after an agent request failed through the public path. The server-side alternative-header fix merged in PR 170 (`0a6b152`), and the hub-side change merged as [harness PR 228](https://github.com/kodonghui/corthex/pull/228) at `e6b46ac`. The local credential regression passed on `71bc506`. The coordinator reported a public-path recheck on 2026-11-27 at 16:10 UTC using hub `e6b46ac` and a v3 profile: can-send was true, the held-commit read returned 200, and a real project push completed with pushSnapshot 200. The held revision remained 1 because the source commit was already current; reported trace metadata confirmed the public edge path. No address, credential value or project identity is included here. This passes the requested recheck. PR 169 at `13b68ac` records BUG-008 as fixed and TC-244 as pass; that source update remains unmerged pending PR 166. Until it merges, the formal release record must still be reconciled. TC-244 is not included in the 243-case baseline count above; recompute the totals after the source merges. The precise cause of the original header failure remains unisolated.

PR 167 proposes the new hub pin. The current push workflow intentionally retains the legacy CF-Access header pair for v2; at the later v3 cutover remove its override and switch its URL and credential secrets to v3 values.

## Blocking items

The BUG-008 recheck passed and PR 169 records it fixed, but its source-record closure remains unmerged. Until that source update is merged and reconciled, the current stage plan still treats BUG-008 as a formal gate blocker.

Eight gate cases still need the required browser-flow walk: TC-225, TC-226, TC-227, TC-230, TC-231, TC-233, TC-234 and TC-235. Their expected arrows, roles, widths, screenshots and data checks remain in the plan. These block the first group too. Screen captures from the local synthetic walk cover selected states only and do not close these cases. A real phone and the real Access sign-in/expiry path were not available in the isolated local environment; the stand-in gate does not establish those results.

The maintainer separately directed an early v3 deployment on 2026-11-27, before this gate, and subsequently approved the public-path fixes. That deployment is reported in PR 169; v2 and its data remain in place. The no-go recommendation applies to the release gate and does not decide a rollback of the existing deployment. Further expansion, including turning off v2 and switching the push workflow to v3, remains on hold for a separate maintainer decision after the release gate passes. The other 11 gate cases require deployment or elapsed production time and remain unverified here: TC-037, TC-038, TC-097 and TC-205 to TC-212. As the plan specifies, the first group may receive a go only after the other blockers pass or the maintainer records a waiver for each named item; these 11 cases then run on that first-group deployment, and the wider release remains held until their evidence passes. BUG-005 records that TC-212's expected backup notice conflicts with the screen definition; resolve that expectation before the case can be closed. This report does not authorize deployment, a real-repository upload, or deletion of any existing service or data.

## Known risks

There are 18 non-gate cases without a pass. Each remains open with its named follow-up in the plan:

- TC-198 and TC-199: measured P95 performance on the intended environment is still needed.
- TC-200, TC-201 and TC-202: browser-version, design and accessibility coverage remains unrun.
- TC-213: real read-only external-tool status requires the deployed environment and appropriate credentials.
- TC-221: the preliminary source-path checks passed on both the earlier `1becbab` and proposed `e6b46ac` hub pins; the pin PR is unmerged and the final pin head must be checked.
- TC-228, TC-229, TC-232, TC-236 and TC-237: the named full flow walks remain unrun.
- TC-238 to TC-242: full screen-state and mockup comparisons remain unrun; TC-240 also shares BUG-005's unresolved backup-notice expectation; selected local states have partial evidence in the [walk report](qa-resume-2026-11-27.md).
- TC-243: real-phone read and comment walk remains unrun.

`server/test/layout.test.js`'s single cold-run layout timing test took 1,158 ms, 1,034 ms and 1,185 ms against its 1,000 ms limit in three runs on the shared host; other runs of the same suite passed. The failures were observed on PR 167 at `23261b1` and `3083d6c` with a merge working tree, and `e95fdbd` with a review working tree. The cause is not established; [BUG-007](../bugs/BUG-007.md) in QA PR 166 tracks the test failure as a hypothesis, without weakening the test or claiming a product failure. This observation does not establish the required P95 in the intended environment.

This report depends on QA PR 166: its plan and bug records are the stage-12 source, and it must land before this report. The controlled gate, API refusals and response-loss tests are local evidence and do not prove the deployed Access or provider path. Optional AI exploratory testing was not run and is not a gate item. Recompute counts and review bug status, pinned tests, screen evidence, and open review threads on the exact release commit before any go/no-go decision.

## Retrospective candidate

Evaluate adding a public-history check for real server-location references, with tests for false positives.
