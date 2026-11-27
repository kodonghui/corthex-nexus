# NEXUS v3: read-only browser reconnaissance

[한국어](aside-readonly-2026-11-27.ko.md)

On 2026-11-27 an authenticated browser read the existing v3 deployment. The coordinator reported deployed commit `445f7cf`; the browser did not independently establish that revision. The earlier server-side fix was `0a6b152`. The local source used to identify the screen routes was merged NEXUS commit `7c6c594`, not a claim about the deployed revision. No project, credential, proposal, confirmation, backup or service was changed. The browser used only owner-session reads; a test project and the other pairwise roles were not established. The project-list, owner-to-do and credential-list reads each returned HTTP 200; a read for an uncreated synthetic project returned 404. No names, credential values or contents are recorded here.

The screenshots below were captured at 1440 × 900 and 360 × 900. They are deliberately redacted: project content, credential rows, the project selector and the live count are hidden in the browser before capture. They show only the remaining generic shell and must not be treated as evidence of the hidden data or as individual flow transitions. The two stage captures hide the entire workbench content. No screenshot is claimed where a case's necessary state was not captured.

| Case | Independently observed | Captures | Remaining |
| --- | --- | --- | --- |
| TC-225 | Project-list read returned 200. | [1440](evidence/aside-readonly-2026-11-27/tc225-1440-redacted.png), [360](evidence/aside-readonly-2026-11-27/tc225-360-redacted.png) | First push, credential and failure paths were not exercised. |
| TC-226 | To-do read returned 200 and a stage link was opened read-only. | To-do [1440](evidence/aside-readonly-2026-11-27/tc226-1440-redacted.png), [360](evidence/aside-readonly-2026-11-27/tc226-360-redacted.png); stage shell [1440](evidence/aside-readonly-2026-11-27/tc226-stage-1440-redacted.png), [360](evidence/aside-readonly-2026-11-27/tc226-stage-360-redacted.png) | The hidden workbench, other roles, expired sessions and the full flow remain unchecked. |
| TC-227 | A read-only stage page contained a proposal label. | None for the proposal state. | No disposable pending proposal, comment, acceptance or refusal was exercised. |
| TC-230 | A stage was opened read-only. | None for a confirmation state. | No confirmation, cancellation or data change was exercised. |
| TC-231 | A stage was opened read-only. | None for a redraw. | No new snapshot was sent and no redraw or resulting data was checked. |
| TC-233 | Credential-list read returned 200. | [1440](evidence/aside-readonly-2026-11-27/tc233-1440-redacted.png), [360](evidence/aside-readonly-2026-11-27/tc233-360-redacted.png) | Credential issue, revoke and agent responses were not exercised. |
| TC-234 | An uncreated synthetic project read returned 404. | None for deletion. | No disposable deployed project was identified; no delete dialog or deletion was attempted. |
| TC-235 | To-do read returned 200. | None for backup or restore. | No backup failure, retention or restore was initiated or observed. |

All eight cases remain **not run** for the gate: the plan requires each applicable arrow, role, width, screenshot and data check in an isolated environment. The live observations above are supplementary, not a substitute for the planned local disposable-server walk. The browser agent's narrative was used to guide navigation, not to decide a pass. No other person, expired sign-in, revoked credential or network-loss row was checked. The optional AI exploratory phase was not run.
