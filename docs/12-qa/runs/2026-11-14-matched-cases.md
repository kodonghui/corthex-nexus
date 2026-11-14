# TASK-243 and TASK-251 matched against the redesign, 2026-11-14

[한국어](2026-11-14-matched-cases.ko.md)

TASK-319 of [the work breakdown](../../10-wbs/nexus.md) settles TASK-243 and TASK-251 of NEXUS 0.2, which stayed `in progress` while five tasks that depend on them say `done` (the review of 2026-11-11, finding 37). The two tasks' cases ran on 0.2's screens. SCR-101 is `removed` since the design revision, its page having left `/` with TASK-271 and TASK-273, and TASK-278 removed SCR-105 to SCR-109 on 2026-11-13: what those cases asked of a screen, the redesign's screens answer now, and the cases of TASK-274, TASK-276 and TASK-278 test them. On 2026-11-14 each of the two tasks' 47 cases in [the QA plan](../nexus.md) at commit `5de2832` was matched against those cases, by the state that it names, its responses and what it expects, as the cases are written. No case was run again.

- A case moves when cases of those three tasks test its state on the redesign's screen. It keeps its verdict in the plan, with the cases that it moved to, and its whole result moved here, as the plan held it, so that the plan stays under the pinned hub's 1 MiB limit.
- A case stays when its screen stays: the hub page's three views, SCR-102 to SCR-104, which the redesign keeps under the full checks (SCR-117). TC-1273 of TASK-243 stays too.
- What the cases that a case moved to do not name is in the match's last column. The redesign's state cases test one response for each state, where 0.2's cases named each response of the state; the refusals and failures of a write are tested by TASK-274's and TASK-276's cases, as the table names them.
- Seven cases were partial, each for the same reason, and their partial part stays: [What stays partial](#what-stays-partial). Under D19 a case stays partial only on the maintainer's word for that case.

## The match

| Case | State in 0.2 | Verdict | Moved to | What those cases do not name |
| --- | --- | --- | --- | --- |
| TC-1217 | SCR-101#normal | pass | TC-1873, TC-1826, TC-1834 | Each field of a card one by one, a project without a snapshot, and the page on a device |
| TC-1218 | SCR-101#empty | pass | TC-1874, TC-1828 | The page on a device without a project |
| TC-1219 | SCR-101#stale | pass | TC-1875, TC-1851 | A snapshot with uncommitted changes, the `checkpoint-withdrawn` warning, and the page built again on a device |
| TC-1220 | SCR-101#error | pass | TC-1876 | `method_not_allowed`, and a page whose data cannot be read |
| TC-1221 | SCR-101#permission | partial | TC-1877, TC-1831 | `access_other_app`; what [stays partial](#what-stays-partial) |
| TC-1222 | SCR-102#normal | pass | stays | Stays: a view of the hub page, which the redesign keeps under SCR-117 |
| TC-1223 | SCR-102#empty | pass | stays | Stays: a view of the hub page, which the redesign keeps under SCR-117 |
| TC-1224 | SCR-103#normal | pass | stays | Stays: a view of the hub page, which the redesign keeps under SCR-117 |
| TC-1225 | SCR-103#error | pass | stays | Stays: a view of the hub page, which the redesign keeps under SCR-117 |
| TC-1226 | SCR-104#normal | pass | stays | Stays: a view of the hub page, which the redesign keeps under SCR-117 |
| TC-1227 | SCR-104#empty | pass | stays | Stays: a view of the hub page, which the redesign keeps under SCR-117 |
| TC-1228 | SCR-104#stale | pass | stays | Stays: a view of the hub page, which the redesign keeps under SCR-117 |
| TC-1229 | SCR-104#error | pass | stays | Stays: a view of the hub page, which the redesign keeps under SCR-117 |
| TC-1230 | SCR-105#loading | pass | TC-1838, TC-1878 | The place in the picture kept when the editor takes over |
| TC-1231 | SCR-105#normal | pass | TC-1839, TC-1797, TC-1847 | The steps' Previous and Next, a document without a timeline, the marks on parts without an ID, and "Accepted, not yet reflected" on the picture's items |
| TC-1232 | SCR-105#large | pass | TC-1840 | Nothing |
| TC-1233 | SCR-105#empty | pass | TC-1841 | A picture not drawn yet, and one whose source is in another repository |
| TC-1234 | SCR-105#stale | pass | TC-1842, TC-1835 | A discrepancy's `waiting` mark, and a newer picture on the server with Show it |
| TC-1235 | SCR-105#error | pass | TC-1843, TC-1852 | Each `404` code of a picture and `method_not_allowed`; a reading without an answer in 30 seconds, `429` and `503` |
| TC-1236 | SCR-105#code-failed | pass | TC-1844, TC-1878 | Each refusal of the editor's code by its code |
| TC-1237 | SCR-105#permission | partial | TC-1837, TC-1853, TC-1801 | `access_other_app`; what [stays partial](#what-stays-partial) |
| TC-1238 | SCR-106#normal | pass | TC-1863, TC-1856, TC-1803 | A part that no item holds, with its name as the quote |
| TC-1239 | SCR-106#empty | pass | TC-1802 | The empty notice for a part that no item holds |
| TC-1240 | SCR-106#loading | pass | TC-1405 | A comment's own sending state: TC-1405 sends a pass |
| TC-1241 | SCR-106#error | pass | TC-1859, TC-1800 | The messages of `invalid_request`, `cross_site`, the four `404` codes, `comment_limit`, `space_full`, `write_id_reused`, `text_too_long`, `body_too_large`, `json_required` and `method_not_allowed` on a comment |
| TC-1242 | SCR-106#permission | partial | TC-1860, TC-1801 | `access_other_app`; what [stays partial](#what-stays-partial) |
| TC-1243 | SCR-106#gone | pass | TC-1864, TC-1797 | An unsent comment on an item that is gone, kept with its write ID |
| TC-1244 | SCR-107#loading | pass | TC-1854 | Nothing |
| TC-1245 | SCR-107#normal | pass | TC-1855, TC-1796, TC-1797 | Reply and open again on a closed comment |
| TC-1246 | SCR-107#stale | pass | TC-1805 | Nothing |
| TC-1247 | SCR-107#error | pass | TC-1800, TC-1859 | The messages of `invalid_request`, `cross_site`, `reply_limit` with Leave a new comment, `space_full`, `write_id_reused`, `text_too_long`, `body_too_large`, `json_required` and `method_not_allowed` on a reply, and Mark answered's failures |
| TC-1248 | SCR-107#permission | partial | TC-1801, TC-1860 | `access_other_app`, and `user_only` on a reply that settles; what [stays partial](#what-stays-partial) |
| TC-1249 | SCR-107#gone | pass | TC-1861, TC-1797 | A reply being written kept to copy when its comment is gone |
| TC-1250 | SCR-108#loading | pass | TC-1854 | A proposal's own loading, with the length of its source text |
| TC-1251 | SCR-108#normal | pass | TC-1806, TC-1796 | A reflection in review, reflected or already in the source, and a withdrawn proposal |
| TC-1252 | SCR-108#stale | pass | TC-1858, TC-1806 | A proposal made on an earlier picture than the one drawn |
| TC-1253 | SCR-108#error | pass | TC-1859, TC-1800 | A proposal's own failures: TC-1859 and TC-1800 walk a comment's |
| TC-1254 | SCR-108#permission | partial | TC-1806 | `access_missing` and `access_other_app` on a proposal's answers; what [stays partial](#what-stays-partial) |
| TC-1255 | SCR-108#gone | pass | TC-1861 | A proposal and a reflection that are not on the server |
| TC-1256 | SCR-109#loading | pass | TC-1846, TC-1878 | Nothing |
| TC-1257 | SCR-109#normal | pass | TC-1847, TC-1403, TC-1397 | Where the record comes from, the repository or the device's status file |
| TC-1258 | SCR-109#empty | pass | TC-1848, TC-1401 | What is left with nothing left |
| TC-1259 | SCR-109#stale | pass | TC-1851, TC-1405, TC-1842 | The `checkpoint-withdrawn` warning |
| TC-1260 | SCR-109#error | pass | TC-1836, TC-1852, TC-1405, TC-1878 | The messages of `invalid_request`, `cross_site`, `part_not_found`, `space_not_found`, `text_too_long`, `body_too_large`, `json_required` and `method_not_allowed` on a pass, and of `checkpoint_not_found` on a withdrawal |
| TC-1261 | SCR-109#permission | partial | TC-1837, TC-1853, TC-1845, TC-1405 | `access_other_app`; what [stays partial](#what-stays-partial) |
| TC-1272 | Expired sign-in and recovered draft | partial | TC-1807, TC-1801, TC-1405, TC-1800 | What [stays partial](#what-stays-partial) |
| TC-1273 | Delayed request and editor-load failure | pass | stays | Stays: a request held past 30 seconds, which no case of the redesign holds; the editor's failure is also TC-1844's |

## What stays

- TC-1222 to TC-1229, the hub page's three views, SCR-102 to SCR-104, on the server and on a device: the redesign keeps them under SCR-117, so they stay with TASK-251, as they passed.
- TC-1273, a request held past 30 seconds and the editor's code that fails: it stays with TASK-243, as it passed. The editor's failure is also TC-1844's, SCR-112#code-failed. No case of the redesign holds a request past 30 seconds; the pages send through the same code, `nexus/ui/state.js`, whose deadline `nexus/test/view-state.test.js` holds on every run of the checks.
- What the match's last column names for each case.

## What stays partial

In 0.2's walk each of these seven was partial for one reason: no person's Access session expired while a view was open, so a genuine expiry, Access's own page and signing in again were not run, while the controlled `401` and the sign-in's redirect, read as `opaqueredirect`, were. The redesign's cases run the same controlled answers (TC-1801, TC-1405), so the genuine part stays partial in each. Running it takes a person's own sign-in through Access and a change of the Access application's session duration, which the maintainer is asked about before it is made, with the setting, the duration and the way back.

| Case | What moved, to which cases | What stays partial | The maintainer's word |
| --- | --- | --- | --- |
| TC-1221 | The message page for a request that Access did not check: TC-1877, TC-1831 | Access's own page for a person whom Access refuses, and a `401` from Access itself, with the real provider | asked on 2026-11-14 |
| TC-1237 | The message page and the bar of a refused reading: TC-1837, TC-1853; Sign in again with what the side holds kept: TC-1801 | A person's sign-in that expires while the picture is open | asked on 2026-11-14 |
| TC-1242 | `no_kind`'s message with the words kept: TC-1860; Sign in again, and the words back after a reload: TC-1801 | A person's sign-in that expires while a comment is written, and the words back with their write ID after signing in again | asked on 2026-11-14 |
| TC-1248 | The refusals with the words kept, and Sign in again: TC-1801, TC-1860 | A person's sign-in that expires while a reply is written | asked on 2026-11-14 |
| TC-1254 | `user_only`'s message with the answers kept: TC-1806 | A person's sign-in that expires while a proposal is answered | asked on 2026-11-14 |
| TC-1261 | The message page, the bar, `user_only` on a pass, and Sign in again with the words kept: TC-1837, TC-1853, TC-1845, TC-1405 | A person's sign-in that expires while a checkpoint is passed or withdrawn | asked on 2026-11-14 |
| TC-1272 | The words and one write ID across a reload, the controlled `401` and sign-in, and Try again with the same write ID: TC-1807, TC-1801, TC-1405, TC-1800 | The whole procedure in a real session: Access expires, the person signs in again, and a write whose answer was lost is sent again once with its write ID | asked on 2026-11-14 |

## The whole results

Each moved case's last result, as the plan held it at `5de2832`; its links now lead from this folder.

### TC-1217

pass — rich team/personal cards; two parts; snapshots/state/check counts; nonempty comments/proposals/discrepancies; current picture stage marks; checkpoint overview links; ask project/profile/default origins; no recorded progress; device server-only instructions; missing snapshot reason Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1218

pass — server four push steps with variable names only and no secret/path/project section; actual CLI device empty notice Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1219

pass — build/snapshot time and commit, dirty; source size/gone/other-repository; copied-view time; actual pending checkpoint; withdrawn checkpoint named in a newly pushed record; native reload newer source; actual formal9636 CLI rebuild Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1220

pass — real handler internal500 and method405 HTML with trace and reload; invalid JSON/schema on server renderer and actual CLI-device HTML (controlled local inert-data corruption); corresponding exact Prism HTML at eight settings Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1221

partial — synthetic verifier actual missing and wrong audience403 plus exact Prism HTML at eight settings Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim. Safe deployed reads302 only; real provider403/401 remains unproved, separately from expiry deferral.

### TC-1230

pass — All3 complete SVG/critical styles and pre-JS item links; tiny view native pan/zoom/item+comment panels before editor; exact loading notice; preserved DDD/Sitemap marker camera and ERD public viewport, including exact1.25handoff and.1..1.5limits. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1231

pass — All3 top links/commit/time/read-only deterministic SVG/list/Apart/legend; named44px accepted/discrepancy/unowned marks exposed with actual native pan; nine original step keys initially whole board, first/last boundaries and native reload/hash restoration; no timeline notice. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1232

pass — Actual and Prism301-element picture with exact large notice, normal read-only frame/list/controls; no3second performance claim for large state. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1233

pass — All3 why messages not-drawn/size/other-repository and valid origin-bound overview/hub links. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1234

pass — Three stale-source reasons and the waiting discrepancy remain visible. In Prism and on the local Node/SQLite server, Refresh offered commit c while retaining commit a. Show it applied c and cleared the notice. A subsequent reread of c kept the notice clear. The focused check covered all eight settings on e838383.

### TC-1235

pass — Applicable page Problem/trace/Hub and internal Reload, refresh bar retains drawn picture; controlled network and real30s timeout/retry. Only real provider429/503 clauses close with user-approved transport mock evidence. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1236

pass — Three sources × six exact code fault paths per mode: failed native editor leaves SVG/pan/zoom/item list/panels and never ready; failed tiny module leaves SSR SVG/item links; no-picture native failure retains reload fallback. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1237

partial — Page/refresh Access code messages and retained panels with controlled401/manual opaqueredirect; genuine mid-view human expiry remains explicitly user-deferred. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1238

pass — ID/title/focus/Close/quote, nonempty discrepancies and Open proposals, most-active timestamp ordering, user/agent/time/text/reply count+last reply/closed outcomes; ready labeled form/near-limit counter; native Send creates exactly one scoped row/receipt, keeps item, top new comment and empty form; unowned exact-name/quote policy and send. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1239

pass — Stable-ID and unowned-name exact empty notices with ready form and no proposals/discrepancies. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1240

pass — Native Send held at response boundary, exact Sending/disabled submit, retained text and usable Close/rest of panel; release creates one actual receipt and empty form. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1241

pass — All declared human comment error messages/field placement/canonical link/retained text+same ID and reused-ID rotation; actual four missing-target readbacks incl discrepancy404; threshold/size/content/method/server failures and agent-only claimed separation; real30s/network/retry, approved provider429/503 mocks. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1242

partial — Actual synthetic missing/other-app/no-kind role failures preserve text; controlled401/manual redirect and browser-storage text/write ID recovery. Genuine human expiry→normal sign-in remains user-deferred. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1243

pass — Stable-ID comment-only/draft-only/neither/closed-only64 valid observations; actual changed-source push/native reload keeps open comments or meaningful draft+same ID, otherwise Back only. Unowned removal16 readiness-correct observations shows no address/Gone panel and moves still-open item-empty quoted comment to Apart without writes. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1244

pass — Open and closed cached comment summary including text/author/state/last reply or item/closed outcome; delayed real detail requests leave skeleton replies, editable reply box and disabled Reply/Answered. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1245

pass — All six exact focused comment headings, ordered replies/settles marker/decision links/proposal entries, empty-replies and foreign-picture link; native plain/settling reply→Answered→reopen verified actual API/SQLite and four receipts, no early proposal-source API requests. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1246

pass — Actual closed race then native Answered shows already-closed/current data; new agent reply since panel opened becomes marked-new after actual in-panel user write; mobile background refresh is not clicked through modal. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1247

pass — Read retry/cached summary, every declared human reply error/retained draft+ID, agent-only closed/claimed separation; actual200-reply limit and explicit new-comment transfer with original named target/new ID/old draft preservation; real30s/network and approved429/503 mocks. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1248

partial — Actual synthetic Access code failures and agent settling user_only preserve reply; controlled expiry presentation only. Genuine mid-view human expiry remains user-deferred. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1249

pass — All8 declared comment GET/reply/answered×404code paths each Prism8+actual8=128: typed comment Gone, Back and picture reread, copyable unchanged reply+ID, submit disabled, no write effect; stale read/write order guards retained. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1250

pass — Open and accepted nested-reflection cached proposal item/reason/change/state summaries; delayed source text length/grey box, Accept/Dismiss wait. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1251

pass — Focused proposal heading/Close/reason/change/source own scroll/commit/related comment; exact8 original terminal/reflection phrases with PR/commit metadata; actual native Accept/Dismiss/reflection-dismiss48 observations with one-effect receipts. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1252

pass — Actual accept/dismiss races against3terminal states, changed in-review/closed reflection and already-dismissed rereads; corrected actual changed-source push gives earlier-picture notice while Accept stays enabled. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1253

pass — Read retry/cached proposal and all declared accept/dismiss errors including actual500reflection cap, same-ID retry/reused-ID rotation; real30s/network/retry and approved provider429/503 mocks. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1254

partial — Actual signed role user_only/missing/other-app and controlled401/manual redirect retain panel/actions; genuine human mid-view expiry user-deferred. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1255

pass — All10 declared proposal/edit GET/accept/dismiss×404code paths each Prism8+actual8=160: correctly typed Gone, Back+picture reread, safe disabled actions and no effects, asynchronous read/write stale guards. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1256

pass — Before actual code exact static line and native reload; changed timeOrigin then release draws bootstrap in same new document without API calls.16 observations/32 before-after captures reviewed; before-code bounded metrics separated from full checker after release. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1257

pass — Prism and the local Node/SQLite server showed both record-source labels and the specified checkpoint form heading in all eight settings on e838383. The overview retained record metadata, three remaining-work groups and their links, scoped checks and the optional 2,000-character Pass form. Five source reasons retained Pass. For stages without pictures, record and check summaries remain visible and checkpoint actions follow SPEC-139.

### TC-1258

pass on isolated local Node/SQLite (v5 canonical copied-source 7b3de16f769b, synthetic signed Access): pinned Prism DTO through the real renderer in 8 settings, then actual Node in the same 8 (320/1440 px x EN/KO x light/dark). The notice replaces all 3 empty lists; record, exact empty-checks message and enabled Pass remain. All 16 primary state and 8 mobile lower-control files independently viewed; both phases have 0 checker errors. Each actual cell passed then withdrew one checkpoint: SQL/to-do agree, record unchanged. Original v3 BUG571 and v4 BUG572 failures retained. [closeout](2026-11-05-postrelease-closeout.md).

### TC-1259

pass — Actual Pass again distinct checkpoint/receipt, words/PR metadata; already-withdrawn message, record-race refusal with current overview reread, actual withdrawn-record warning, and inline Not-current3why next to picture link. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1260

pass — Applicable initial Problem/trace/Hub/internal Reload; module failure static reload; refresh bar/overview preserved; every Pass/Withdraw error with correct retention/ID and actual missing-target reread, real30s/network/retry, approved429/503 mocks. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1261

partial — Initial/refresh/pass/withdraw synthetic missing/other-app/user_only refusals preserve words, controlled401/manual redirect; genuine human mid-view expiry user-deferred. Required eight settings use exact Prism wire/DTO→product UI and independent actual local Node/SQLite; original criteria unchanged. Evidence sources remain scoped; no production or genuine Access-expiry claim.

### TC-1272

partial (explicit maintainer deferral): Genuine human Access expiry, re-sign-in and the combined lost-response/same-write-ID recovery procedure remain unexecuted. Controlled401/manual opaque redirects, retained drafts/IDs and separate actual local retry effects have their own browser receipts; they do not prove this combined real-session criterion. The maintainer deferred the actual expiry test; no policy, cookie or forced-login change was made.
