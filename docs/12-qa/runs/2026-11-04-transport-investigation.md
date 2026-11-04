# Keep the 3s target: transport investigation proposal, 2026-11-04

[한국어](2026-11-04-transport-investigation.ko.md)

Status: source-first decision record and offline plan only. No diagnostic browser, HTTP request, model, new measurement or deployment ran in this preparation. Root reviews the tools and selects the smallest comparison before granting an exclusive execution window.

## Decision and retained baseline

The maintainer selected the exact answer **“3초 유지·개선 계속 (추천)”** in the performance-decision card in this working conversation. It means keep the 3s target and continue improvement. The user-supplied date is 2026-11-04 and the client timezone is Asia/Seoul; the exact response time is unverified. The full question, options and opaque card reference are retained only in the private work ledger for later record synchronization. A clock reading used to prepare that ledger is not the user's decision time. Invoking CORTHEX 0.6 selects the workflow; it does not change the release criterion.

The decision continues investigation under REQ-149. It does not accept the current latency, pass a stage10/12 checkpoint, or authorize release. The 710 QA cases remain 241 pass, 467 partial and 2 fail; the 64 tasks remain 15 done and 49 in progress. TC-1271/1309 remain failed, TASK-252/253 remain in progress, and BUG-562 remains open with its cause unresolved.

The [v4 formal record](2026-11-04-mobile-final.md) remains the baseline, without reclassification:

| Picture | Eligible / slots | Normative first-SVG P95 | Native eligible / normative P95 |
| --- | --- | --- | --- |
| DDD |20/20|4546.3ms|20/20 /65602ms|
| ERD |19/20|null|19/20 /null|
| Sitemap |20/20|4381.2ms|20/20 /18907ms|

ERD's 6993.9ms is a diagnostic for the 19 eligible samples only. Global20/ERD7 recorded initial SVG at 2742.4ms but no code response completion/HIT evidence within 90s. A DDD code header-to-finish interval was 56.00534s. Neither observation establishes a 403, cache MISS, credential leak, or a network/compression/server cause. Old60/80 and v4 raw bytes, plans, denominators and failed observations stay frozen.

The development runtime remains 906f360/D802; the evidence source was 4132327, integrated at 0d900479. The formal profile remains 390×844, DPR2.75, touch, CPU1, Fast4G at 165ms/8.1Mbps down/1.35Mbps up, browser cache off, service-worker bypass, a fresh incognito context per opening, and 300 rendered elements per picture. DDD's 300 include one context frame and 99 each of event/command/actor plus one aggregate and one read-model; ERD counts 300 table nodes, and sitemap counts 300 screens with edges excluded. First SVG retains the complete node/label/end-marker/style/visibility/two-rAF definition and 90s opening deadline. Native readiness stays separate; the 5s observation and instrumentation remain disclosed in cumulative CPU scope.

## Proposed comparisons

These are alternatives for tool review, not a finalized sweep. Root fixes the exact allowlist, byte/time/request/opening budgets, source pins, ordering and stop rules before execution. Start with one small pair that answers the next uncertainty; retain every attempt and error.

| Proposal | Controlled comparison | Evidence and limit |
| --- | --- | --- |
| Connection and protocol | Same approved synthetic resource with fresh versus reused connection; compare HTTP/1.1 and HTTP/2 only when the reviewed tool supports both. | Record DNS/TCP/TLS and observed ALPN/protocol within the tool's clock. Browser-observed HTTP/3 is a separate observation, not an assumed Node capability. Do not add nested connection intervals twice. |
| Headers and body | Bounded GET/HEAD of an allowlisted code asset and synthetic HTML under the same target/content/cache conditions. | Record wire-header timing, first/last body receipt, bounded chunk counts, bytes, status and completion separately. HEAD cannot prove body delivery or paint; a response event is not body completion. No purge or cache-rule change. |
| CDP network shaping | One reviewed browser comparison with the formal shaping settings versus explicitly unshaped diagnostic conditions. | Record effective CDP settings, protocol, resource timing/dataReceived counts, complete SVG opportunity and native milestones when observed. Differences may locate shaping effects but cannot replace the formal profile or identify server CPU. |
| Compression | Same content, protocol and connection policy with reviewed Accept-Encoding alternatives, where supported. | Record actual Content-Encoding, wire/decoded lengths and bounded hashes. Decode only within a reviewed size bound; never equate a compressed-body hash with the source hash. No compression or Cloudflare setting change during this comparison. |

Use the existing approved development target and synthetic fixture only. Keep same-origin Access/CSP, HTML/API/project-data no-store and the approved hashed-code policy. Do not send a real repository, mutate project data, expose an origin route, read/copy credentials, add a paid plan/dependency, or store raw cookies, authentication headers, user URLs, project text, personal paths or raw V8 profiles. Existing reviewed child-environment handling may carry authentication in memory; public output contains allowlisted presence checks and numeric/hashed evidence only.

DOM navigation/rAF, CDP monotonic timing, Node monotonic timing and harness wall-clock delivery are distinct domains. Label every field and any explicit bridge, including its uncertainty; do not silently subtract different clocks. SVG completion can precede whole-document EOF. Transfer, idle, decoding, evaluation, style and render CPU cannot be inferred by splitting a wall-clock interval. Record instrumentation scope separately.

## Ownership and handoff

| Owner | Output | Permitted scope | End condition |
| --- | --- | --- | --- |
| Root | Reviewed arm selection, execution gate and final decision | Development/Cloudflare resources, branch and final gate; freezes pins and approves any later change | Receipts reviewed and exclusive window explicitly returned |
| UI | Offline CDP diagnostic tool proposal | Its owned offline tool files; no browser/network before Root's execution signal | Tool/source review and owned-process cleanup reported |
| API | Offline Node diagnostic tool, then a separately scheduled single execution | Its owned tool files; later only the reviewed read-only target/budget | All attempts recorded and owned processes0 before handoff |
| QA | This decision/plan and later independent evidence audit | Stage10/12 EN/KO notes, this paired report and private evidence ledger; no runtime/settings changes | Source diff reviewed; a later audit ends with owned processes0 and handoff |

During an announced diagnostic window, other network, browser and CPU-heavy work stops. Run approved tools sequentially; API and UI do not probe concurrently. Close only owned Node/Chrome/CDP processes, retain profiles, and return a process0 receipt before Root releases the window. A missing completion is retained as unobserved/failed evidence, never replaced by a retry or a final inspection after the deadline.

## After a cause is supported

Choose one small reversible change, preserve the prior candidate, and run the relevant regression and repository-required checks. Root owns implementation, review, commit and deployment decisions. Any further diagnostic comparison remains labelled diagnostic. A later reviewed candidate must repeat 20 openings for each of the three pictures under the unchanged formal profile, retaining failures and separate native readiness; nearest-rank P95 is normative only at 20/20 eligible. Keep the original results alongside it.

This preparation ends at the source diff. Root runs the required checks and commits; Notion follows only after Root's later sync signal. Registry/profile/stage metadata are untouched. Main, production and tags remain subject to the existing conditional-release gates; first real upload still needs REQ-107. Keep Worker/D1 for 14 days after a switch and ask before deletion. The present answer continues improvement and supplies no latency exception or additional release approval.

## Observed follow-up, 2026-11-05 KST / 2026-11-04 UTC

The e750509 decision record remains unchanged: the maintainer chose “3초 유지·개선 계속 (추천)” on the supplied 2026-11-04 date, with exact response time unverified. The subsequent diagnostics ran on 2026-11-04 UTC, which is 2026-11-05 in Asia/Seoul. They provide observations after the plan, not a new approval or release exception. The 710 QA cases remain 241 pass, 467 partial and 2 fail; the 64 tasks remain 15 done and 49 in progress.

**Node:** one bootstrap HEAD and 16 code GET slots all completed with 200/EOF and the expected 73974-byte decoded payload SHA. There were 13 HIT and 3 actual MISS; only 13 are cache-comparable. The reported exit1 is consistent with that comparison gate. Controller elapsed was 21202.5851ms; bootstrap and 8 pairs closed, owned Node0, with no replacement/additional request. Two H2 reused/HIT observations recorded header-to-first-data 0.2115/0.1130ms and header-to-body-EOF 3279.5906/3291.1915ms. All 16 actual encodings were br. [Slim Node evidence](transport-2026-11-05/node-summary.json) keeps numbers, enums and public hashes; the raw report remains in its owned ledger.

**Chrome:** 18 slots, three per protocol/network cell, completed and qualified for this diagnostic. Metadata GET18 + code GET18 + bootstrap HEAD1 =37 observed allowlisted requests. AUTO observed h2 in 9 slots; H1ONLY observed http/1.1 in 9; all 6 ByRule slots had matched-rule evidence. Code18/18 matched the same payload SHA and 200/HIT+Age/approved cache policy. Browser36/36 had cookie-only evidence and no service-client headers. All 18 owned-browser censuses were0, 18 profiles were retained, and the operator recorded owned Chrome/Node0 and no extra HTTP. [Slim Chrome evidence](transport-2026-11-05/chrome-summary.json) separates the common device settings from shaping requested only for the legacy/ByRule arms.

Chrome used top-level Document/VeryHigh after unthrottled metadata setup. Asset connections18/18 were reused and TLS timing fields were unavailable, so this does not measure cold TLS or the original module/render workload. Both diagnostics returned br; different Accept-Encoding advertisements do not establish a codec comparison. Chrome encoded dataReceived totals of0 are not zero wire transfer: loadingFinished recorded 441186 bytes under a different scope, while decoded asset bytes totalled 1331532. Keep DOM/CDP/Node/controller clock domains and byte scopes separate. No Cloudflare/compression/protocol cause or first-SVG/native/P95 success is established.

**External configuration, read only:** the existing authenticated Cloudflare UI showed HTTP/2 and HTTP/3 on at zone scope, not a development-host-only setting; the HTTP/2 control appeared locked. The owned compression rule was active only for the exact development host's HTML picture routes, with brotli/gzip preference. Cloudflare changes, production changes and login/MFA attempts were0. Settings being on do not prove a request negotiated HTTP/3 or explain latency. The safe receipt hash is 72eb1902e231ff7512494e5f36a178036cabc63da55e0ddaebcbd9933447cbd1 and is pinned in the [manifest](transport-2026-11-05/manifest.json); no account, zone, rule or request identifier is published.

The slim manifest pins both output summaries and the report/cleanup/configuration inputs by public SHA only. Original60/80/v4 bytes, plans, denominators and failed observations are unchanged. The formal v4 remains DDD20/20 first-SVG P95 4546.3ms/native 65602ms, ERD19/20 normative P95 null (eligible19-only diagnostic 6993.9ms), sitemap20/20 first-SVG P95 4381.2ms/native 18907ms. TC-1271/1309 still fail the 3s criterion and BUG-562 remains open. These diagnostics supply no new acceptance pass, stage checkpoint, waiver or release decision.

### Current actual-module6 preparation

The next actual-module6 diagnostic is being implemented offline and has not received Root GO. This record does not report any module6 request or result. Current ownership is:

| Owner | Current scope |
| --- | --- |
| Root | Server, Cloudflare, branch and final execution/release gates |
| UI | Runner and all other diagnostic-tool files |
| API | Only `module-wire.mjs` |
| QA | Decision/progress records and independent static/result audit |

Root will review the frozen source/plan before any execution. Work remains sequential in an exclusive window and ends with zero owned processes returned. Any later small fix still needs regression checks and a separately pinned formal20×3 under the original profile. Main/production/tags, first real upload under REQ-107, and Worker/D1 retention for 14 days after a switch followed by a deletion question remain unchanged. Notion follows only after Root commits and signals synchronization.

Root subsequently enabled development numeric metrics as module6 preparation, using two owned temporary flag/drop-in files. The active runtime remains 906f360/D802; unauthenticated loopback returned 403. The enable receipt confirms no private environment-file read, credential copy, production change or other-service restart. Root reports the original environment was unchanged and will restore the temporary setting after the six-slot execution. The [manifest](transport-2026-11-05/manifest.json) pins receipt 4107e74f39b8315512139fc91809f9df9c72d00a4c0157ec7458714bf18bc735 without file locations or process identifiers. No log values have been collected and no server-processing verdict or per-route attribution is established; module6 execution still awaits Root GO at this record.
