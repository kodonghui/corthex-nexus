# NEXUS v3 QA: interim release gate

Recommendation: **no-go**, including for the first group. This is an interim assessment of the QA plan and local walks, not a release-commit gate. The 243 case rows in [QA draft PR 166](https://github.com/kodonghui/corthex-nexus/pull/166) at commit `5d7184b` recorded 206 pass, 36 not run and 1 blocked. Since then GitHub OAuth `workflow` scope was added, permitting the push of PR 167’s changed hub workflow. TC-221 passed a preliminary run at pin commit `6145f53` and passed again on `e95fdbd` and `fc621d3` in PR 167, which remains unmerged, so the case remains not run in this assessment: the updated count in QA PR 166 at `ec78b41` is 206 pass, 37 not run and 0 blocked; many passes are from earlier commits, and the release commit must be checked again. No case is waived. BUG-008 is open with proposed severity S2/P1 and blocks the gate; five S3 findings, BUG-002 to BUG-005 and BUG-007, remain open in the [QA draft files](https://github.com/kodonghui/corthex-nexus/pull/166/files). BUG-001 was fixed and merged in PR 165 and incorporated in QA draft commit `bc3a3d0`.

## Blocking items

[BUG-008](https://github.com/kodonghui/corthex-nexus/pull/169) is an open deployment-reported S2/P1 proposal: the public agent request returned 401 while the same test credential reached authentication on loopback. The point and cause of header removal remain unisolated. TC-244 is reserved for its regression in PR 169 and is not yet included in the 243-case count above. This finding independently blocks the gate until fixed and verified.

Eight gate cases still need the required browser-flow walk: TC-225, TC-226, TC-227, TC-230, TC-231, TC-233, TC-234 and TC-235. Their expected arrows, roles, widths, screenshots and data checks remain in the plan. These block the first group too. Screen captures from the local synthetic walk cover selected states only and do not close these cases. A real phone and the real Access sign-in/expiry path were not available in the isolated local environment; the stand-in gate does not establish those results.

A separate first-group deployment is reported in PR 169. The other 11 gate cases require deployment or elapsed production time and remain unverified here: TC-037, TC-038, TC-097 and TC-205 to TC-212. As the plan specifies, they are eligible for a go for the first group only after the other blockers are cleared; the wider release remains held until their own evidence passes. This report does not authorize deployment, a real-repository upload, or deletion of any existing service or data.

## Known risks

There are 18 non-gate cases without a pass. Each remains open with its named follow-up in the plan:

- TC-198 and TC-199: measured P95 performance on the intended environment is still needed.
- TC-200, TC-201 and TC-202: browser-version, design and accessibility coverage remains unrun.
- TC-213: real read-only external-tool status requires the deployed environment and appropriate credentials.
- TC-221: the preliminary pinned-hub run passed; the pin PR is unmerged and the result is not yet credited as a case pass.
- TC-228, TC-229, TC-232, TC-236 and TC-237: the named full flow walks remain unrun.
- TC-238 to TC-242: full screen-state and mockup comparisons remain unrun; selected local states have partial evidence in the [walk report](https://github.com/kodonghui/corthex-nexus/blob/ec78b41848acb5c08dcd9abf935d8d49e091c774/docs/12-qa/runs/qa-resume-2026-11-27.md).
- TC-243: real-phone read and comment walk remains unrun.

`server/test/layout.test.js`’s single cold-run layout timing test took 1,158 ms, 1,034 ms and 1,185 ms against its 1,000 ms limit in three runs on the shared host; other runs of the same suite passed. The failures were observed on PR 167 at `23261b1` and `3083d6c` with a merge working tree, and `e95fdbd` with a review working tree. The cause is not established; BUG-007 in QA PR 166 tracks the test failure as a hypothesis, without weakening the test or claiming a product failure. This observation does not establish the required P95 in the intended environment.

This report depends on QA PR 166: its plan and bug records are the stage-12 source, and it must land before this report. The controlled gate, API refusals and response-loss tests are local evidence and do not prove the deployed Access or provider path. Optional AI exploratory testing was not run and is not a gate item. Recompute counts and review bug status, pinned tests, screen evidence, and open review threads on the exact release commit before any go/no-go decision.
