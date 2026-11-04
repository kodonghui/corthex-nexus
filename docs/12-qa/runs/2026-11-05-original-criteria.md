# Original acceptance criteria, 2026-11-05

Exactly8 original criteria receive a new scoped pass:TC612/613/615/632/639/646/686/699. Current source QA710=518 pass/190 partial/2 fail; WBS64 stays15 done/49 in progress. All original IDs/Steps/Expected, the other702 whole case rows and prior results remain unchanged. The [proof](2026-11-05-original-criteria/proof.json) preserves previous EN/KO partial templates with per-case hashes.

Four distinct criteria were newly executed:three Python parser cases at exact E7 hub pin and one Node actual-handler/in-memory-SQLite quota case. Parser r2 passed3/3 on Python3.13.14; only the affected TC613 method ran again in r3 and passed1/1. TC612/615 methods/helpers are AST-identical to their executed r2 versions. Node24.18.0 passed TC6391/1; its final source differs only in evidence metadata, with handler calls/assertions unchanged. The additional TC613 execution is not a fifth distinct new case. The other4 cases reuse exact saved responses after revalidating18 current source files.

| Case | Evidence and exact scope |
| --- | --- |
| TC612 | Actual E7 ERD plus the Given TERM comment:four columns/types/nullability, id PK, TERM/context and restrict FK with its customers target outside this part's source. |
| TC613 | FK-free base explicitly verified before literal ALTER; same endpoints/context/outside-part data. The literal omits ON DELETE and keeps an empty value. A separate explicit RESTRICT control compares the complete FK except its source location. |
| TC615 | Actual E7 Home/Order detail names, paths, access, parent and derived source edge. This is not an observed browser arrow. |
| TC632 | `permission[19]`:403 access_missing, seeded project name absent, same-request DB/receipts unchanged. |
| TC639 |30 actual API-created projects; valid31st request returns409 too_many_projects. Same request preserves36 schema objects,13 tables/all rows/columns/FKs and one nonempty API-created receipt; refused snapshot/space absent. |
| TC646 | `permission[66]`:user-kind proposal403 agent_only, same-request DB/receipts unchanged. |
| TC686 | `boundary[116]`:agent reply to the actual closed comment409 comment_closed, same-request DB/receipts unchanged. |
| TC699 | `permission[82]`:synthetic service-kind acceptance403 user_only, same-request DB/receipts unchanged. |

Matrix indexes are zero-based in phases current-refusal-permission-v1/current-refusal-boundary-v1. Permission captures include a bootstrap response that the138-row matrix omits:the respective phase capture indexes are20/67/83, paired with matrix19/66/82. Boundary capture/matrix116 align. Observation IDs and exact hashes are in the proof; no old aggregate count substitutes for the actual role/state/body/effect. The retained replies match their status/code/schema, common security headers/CSP and error trace/log. The new quota Problem response was separately schema-validated with errors0; that validator's separate process exit was not captured and is not invented.

Initial r1 failed drafts remain private with their original logs/source. They corrected the exact Given TERM augmentation, an invented optional sitemap expectation and an overly exact successful push-response assertion. An initial reviewer concern assumed a table-level FK, but E7 actually uses column-inline REFERENCES; the old removal is not labeled invalid SQL. Final TC613 explicitly checks a complete customer_id definition, no REFERENCES/FOREIGN KEY/ON DELETE, and actual empty FK data before ALTER. No extra SQLite syntax test was added. Literal omission is not assigned an invented deletion default.

The old Node evidence contained externalRequests:0 as a constant. Its raw value is preserved but is not a measured counter; final metadata/proof states that traffic count was not measured. The design is a direct handler with generated signing and an in-memory certificate fixture, with no listener/live endpoint in the test. Do not replace this scope with an outbound-traffic measurement claim.

Working test hashes, base35a9941 and exact E7 pin are recorded in the [canonical manifest](2026-11-05-original-criteria/manifest.json). No new test commit, browser drawing, deployed/real Access or all-OS execution is claimed. Prior R1/read/transport/formal failures and the completed269-row Notion evidence stay untouched. This source-only publication does not write Notion; Root owns full required checks/reviews, commit/CI/publication and the later8-row sync. Stage/release/3s/REQ-107/Worker-D1 conditions remain unchanged.
