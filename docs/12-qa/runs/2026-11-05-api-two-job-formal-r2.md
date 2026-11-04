# Two API criteria and Job formal r2, 2026-11-05

Current source QA710=520 pass/188 partial/2 fail. Only TC787/1052 receive a new scoped pass; TC654 stays partial and TC1271/1309 stay fail with a later result link. The other705 whole rows,all original IDs/Steps/Expected and WBS64 rows(15 done/49 in progress) are preserved. [Proof](2026-11-05-api-two-job-formal-r2/proof.json) retains every replaced EN/KO result and hash; [manifest](2026-11-05-api-two-job-formal-r2/manifest.json) pins canonical output bytes. This source unit writes no Notion and adds no user checkpoint,stage completion,waiver or release permission.

| API criterion | Retained exact-request evidence and limit |
| --- | --- |
| TC787 | Valid31st snapshot after30 API-created projects:409 too_many_projects/limit30;36schema objects/13tables/all rows and one nonempty receipt unchanged. Actual Problem/header/CSP/error trace-log checks and existing schema validation agree. Reuses the accepted R3 quota request,not a new execution. Its old static externalRequests:0 is not measured traffic; a separate validator process exit was not captured. |
| TC1052 | `code-policy[32]`:pending edit dismissal409 edit_state/state=pending,actual current Problem/schema/security/CSP and matching error-log trace; same-request whole-table/receipt hash unchanged. This is generated synthetic Access/in-memory actual-handler evidence,not a deployed/browser claim. |

The first v7 proposal was rejected before execution for a P2:an event record whose request/response URL was still unclassified could escape the security qualification. The separate r2 guard requires unresolvedEventRecords=0 at cutoff; later resolution cannot promote cutoff qualification,and later unknown evidence can invalidate security. Its existing offline proof passed8/8 groups(collector9/reference13),with0 actual HTTP/browser/native/formal calls. Those pure checks are separate from the following actual run and do not turn its failure into a pass.

The actual r2 attempt ran on2026-11-04 UTC/2026-11-05 KST. Stored input proofs at both ends are equal and pin product906f360/D802; this audit never calls a live source-proof function. It retained all60 planned slots,20 per stage,with no retry,replacement or resume. The390×844/DPR2.75 touch/mobile profile,CPU1,legacy4G165ms/1012500down/168750up bytes per second,cache-off/SW bypass and300-element fixtures remain fixed. Native readiness is separate from the complete initial SVG metric;90s opening/95s navigation acknowledgement/native+5s and cleanup bounds remain.

Here300 means rendered nodes:DDD has99 source rows expanding to300 nodes including one context frame;ERD has300 table nodes with columns as labels;sitemap has300 screen nodes and299 edges excluded from the node count.

| Stage | Observed initial SVG metrics | Qualified with cleanup / fixed denominator | Normative SVG P95 | Normative native P95 |
| --- | ---: | ---: | --- | --- |
| DDD |13|13/20|null|null|
| ERD |13|12/20|null|null|
| Sitemap |12|12/20|null|null|

Total38 observed,37 qualified and22 not started. Reference controls are5 verified/8 planned,with3 not started;they use a separate unshaped Node clock/transport and are outside60 and both P95s. All38 observed rows verify their security evidence and have0 final code-failure/incomplete rows. The retained study security/primary verdicts remain fail because the planned complete run is not established; this is no observed authentication-leak claim. No valid-only or spliced normative P95 is computed.

Slot38(ERD) stopped the study for owned-cleanup-not-verified. Browser.close acknowledged,but the30s grace did not verify cleanup. One owned Job termination hit its10s operation deadline. The final close reply reported accounting0/held0,but rootWaitSignaled remained false,cleanup stayed false and helper exit/close codes were1. Closed streams or those counters do not prove Chrome/root exit. The operator performed no post-failure OS census;no OS/Chrome0 is inferred. Controller exit1,one invocation/no retry and the original failed verdict remain unchanged. Original v4/v5/v6/first-v7/r2 records and the prior3s failures are retained; this is no SLA pass or cause diagnosis.

Only five LastResult rows and the current QA count changed. Root owns mandatory product checks/review/commit/CI and later Notion sync. Runtime/deployment and release/REQ-107/Worker-D1 gates remain unchanged; a future measurement needs its own pinned plan/review/Root gate.
