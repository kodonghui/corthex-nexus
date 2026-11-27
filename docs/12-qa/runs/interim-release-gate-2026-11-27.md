# NEXUS v3 QA: interim release gate

Recommendation: **no-go**, including for the first group. This is an interim assessment of the QA plan and local walks, not a release-commit gate. The 243 case rows in [QA draft PR 166](https://github.com/kodonghui/corthex-nexus/pull/166) at commit `5d7184b` recorded 206 pass, 36 not run and 1 blocked. Since then workflow permission was added. TC-221 passed a preliminary run at pin commit `6145f53` in PR 167, which remains unmerged, so it remains not run in the gate: the updated count in QA PR 166 at `b68c73e` is 206 pass, 37 not run and 0 blocked; many passes are from earlier commits, and the release commit must be checked again. No case is waived. No open S1 or S2 is recorded; four S3 findings, BUG-002 to BUG-005, remain open. BUG-001 was fixed and merged in PR 165 and incorporated in QA draft commit `bc3a3d0`.

## Blocking items

Eight gate cases still need the required browser-flow walk: TC-225, TC-226, TC-227, TC-230, TC-231, TC-233, TC-234 and TC-235. Their expected arrows, roles, widths, screenshots and data checks remain in the plan. These block the first group too. Screen captures from the local synthetic walk cover selected states only and do not close these cases. A real phone and the real Access sign-in/expiry path were not available in the isolated local environment; the stand-in gate does not establish those results.

The other 11 gate cases require deployment or elapsed production time: TC-037, TC-038, TC-097 and TC-205 to TC-212. As the plan specifies, they are eligible for a go for the first group only after the other blockers are cleared; the wider release remains held until their own evidence passes. This report does not authorize deployment, a real-repository upload, or deletion of any existing service or data.

## Known risks

There are 18 non-gate cases without a pass. Each remains open with its named follow-up in the plan:

- TC-198 and TC-199: measured P95 performance on the intended environment is still needed.
- TC-200, TC-201 and TC-202: browser-version, design and accessibility coverage remains unrun.
- TC-213: real read-only external-tool status requires the deployed environment and appropriate credentials.
- TC-221: the preliminary pinned-hub run passed; the pin PR is unmerged and the result is not yet credited as a gate pass.
- TC-228, TC-229, TC-232, TC-236 and TC-237: the named full flow walks remain unrun.
- TC-238 to TC-242: full screen-state and mockup comparisons remain unrun; selected local states have partial evidence in the walk report.
- TC-243: real-phone read and comment walk remains unrun.

A Node layout timing test took 1,158 ms and 1,034 ms against its 1,000 ms limit in two runs on the shared host; the same suite also passed once. The cause is not established. This observation does not establish the required P95 in the intended environment.

The controlled gate, API refusals and response-loss tests are local evidence and do not prove the deployed Access or provider path. Optional AI exploratory testing was not run and is not a gate item. Recompute counts and review bug status, pinned tests, screen evidence, and open review threads on the exact release commit before any go/no-go decision.
