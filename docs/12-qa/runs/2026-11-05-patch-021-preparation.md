# NEXUS 0.2.1 preparation snapshot

[한국어](2026-11-05-patch-021-preparation.ko.md)

This is the source preparation snapshot before the 0.2.1 production switch. The maintainer authorized the patch release and the remaining original flow checks; phase 2 remains on hold. The earlier [postrelease closeout](2026-11-05-postrelease-closeout.md), its failures and partial judgments remain historical evidence.

The [applicability correction](2026-11-05-api-example-applicability-021.md), product PR [44](https://github.com/kodonghui/corthex-nexus/pull/44), preserves the original710 cases as626 pass/66 partial/18 not applicable/0 fail and adds seven distinct actual HTTP cases. At this snapshot the717-case ledger is633 pass/66 partial/18 not applicable/0 fail. New browser/native observations have not yet been promoted into that count. WBS remains64 tasks,44 done/20 in progress until its whole completion conditions are adjudicated.

## Corrections found by the original screen procedures

These restore existing screen criteria. They change no API schema, response code, database schema, frozen style token or phase-2 scope. Corrected source and regression tests are distinct from full browser acceptance. Original failing runs and test-tool corrections are retained by the QA owners.

| Bug | Original case | Source correction |
| --- | --- | --- |
| BUG-573 | TC-1251 | Exact accepted/reflected/dismissed/withdrawn proposal state phrases and safe PR links. |
| BUG-574 | TC-1224 | An item without links explicitly says none. |
| BUG-575 | TC-1226 | The selected stage says that checks found nothing even if another stage has warnings. |
| BUG-576 | TC-1224 | Trace links are grouped by their declared stage. |
| BUG-577 | TC-1225 | Undefined IDs show referring source locations. |
| BUG-578 | TC-1217 | Missing device snapshots retain their declared reason. |
| BUG-579 | TC-1238 | Item heading, reply count/last reply, closed reason and named comment input. |
| BUG-580 | TC-1226 | Stage heading includes its state. |
| BUG-581 | TC-1226 | Stage items are grouped by kind. |
| BUG-582 | TC-1241, TC-1260 | Declared missing-target refusals reread the picture or overview and preserve draft/write ID/trace. |
| BUG-583 | TC-1238 | A successful item comment stays on that item, rereads the ordered list and clears the sent draft. |
| BUG-584 | TC-1247 | Explicit reply-limit recovery creates a separate new-comment draft, preserving its original target and concurrent drafts. |
| BUG-585 | TC-1244 | A closed comment's known summary remains visible while replies load; text can be drafted while sending waits. |
| BUG-586 | TC-1250 | An accepted proposal's known reflection summary remains visible while its source loads. |
| BUG-587 | TC-1249 | Declared comment read/write404 paths show the gone state, a way back and a copyable retained reply. |
| BUG-588 | TC-1255 | Declared proposal/reflection read/write404 paths show the gone state and reread without reviving stale actions. |

The hub changes are proposed in upstream PR [142](https://github.com/kodonghui/corthex/pull/142). `hub-ref.json` pins9636e33b6a39f189cb12ed586fe0d711071a607a, whose two manifests, skill metadata, CLI and User-Agent report0.2.1. The nine CLI runtime scripts retain the accepted protocol; only the two approved version literals differ from the former byte baseline. Tests retain actual file hashes and reject an unreviewed version or schema change. Product/core templates agree outside the frozen style block.

The product UI source regressions cover exact state messages, comment targets and draft identities, declared gone responses, and both orders of racing read/write results. Browser measurements and image inspection remain separately recorded. Rebuilt content hashes can rename the CSS asset while its frozen CSS bytes remain unchanged.

## Release and evidence boundaries

At this snapshot,0.2.1 is a source candidate; tags and production switch are pending. The running0.2.0 runtime matches the previous reviewed product runtime. Its current13-table SQLite database is authoritative. The patch procedure prepares a consistent current backup, checks both runtimes against same-origin restored copies, and switches only the runtime. A prepared rollback keeps the then-current database; it never substitutes the old Worker/D1 snapshot.

Actual native-host commands and file edits, typed GitHub actions in one private synthetic repository, generated-role Node/SQLite HTTP, Prism responses, browser measurements, visual inspection and real Access observations have separate evidence. Private repository identifiers, host paths, execution profiles and authentication stay outside this public record. A provider or real-login clause is not promoted from a mock without the maintainer's explicit scoped decision. The development-only Access-duration question is separate from the remaining provider-evidence question.

## Further original-screen corrections before deployment

The final TC-1257 walk found two more omissions in the existing SCR-109 normal state. BUG-589 restores its specified “What is left” heading (“남은 것”) above the three nonempty groups. BUG-590 displays each recorded checkpoint's required `approved`, `by` and date fields, plus its existing safe optional link. The former renderer used a nonexistent `words` field and exposed only the date/link. Record text remains plain text; the date-only value is preserved. No screen criterion, API/record schema or frozen CSS byte changes.

The failing browser observations remain separate from the corrected source. New regressions cover both languages, empty/nonempty groups, multiple checkpoints, optional links and untrusted approval/author text; browser confirmation is recorded separately. The initial preparation tag is not evidence that these later corrections were deployed.

TC-1259 also exposed BUG-591: overview picture links omitted the stored `not_current` reason. They now use the existing link-specific message for size, missing source and other-repository states, next to the corresponding link; current pictures have no stale warning. The picture view's separately verified rendering and the API remain unchanged.

The TC-1230 handoff check found BUG-592: ERD preview zoom1.25 became1.0, and a fractional preview zoom was rounded only when the native viewer appeared. The SVG controls and native navigation now share the pinned viewer's supported0.1–1.5 range and two-decimal precision. Fits and zooms compute the origin using the final supported zoom, preserving the world point under the frame center. The existing viewport bridge uses the pinned package's own range constants. DDD/sitemap retain their prior range and precision; the dependency version, upstream package source, server protocol and frozen CSS remain unchanged. Original camera flags and the separate native-table-width observations are retained; a marker's right edge alone is not treated as a camera measurement.

On 2026-11-06, the TC-1234 visual review found BUG-593. After Show it applied the newer commit, the notice still said that a newer picture was available. The action now removes that notice when it applies the fetched picture. A bilingual client regression checks that refresh leaves the old commit visible until Show it, a reread of the drawn commit stays quiet, and another newer commit offers Show it again.

The TC-1257 audit found BUG-594 in the overview. The screen now uses the specified source labels for repository records and device status files. The Korean checkpoint form heading matches SCR-109. The existing browser suite checks the repository label and the checkpoint heading in each setting.
