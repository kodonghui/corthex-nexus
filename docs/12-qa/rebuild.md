# Rebuild release QA

[한국어](rebuild.ko.md)

The stage 11 NEXUS checkpoint binds development review to `befa9804bdcf721971f8fd27c65759764b904813`. The release QA must establish the cases below on an exact candidate. Use separate tenant fixtures, themes and browser sessions. [Development checkpoint](https://nexus.corthex-hq.com/p/corthex-nexus/rebuild/11-development)

| Case | Source | Runs as | Expected result |
| --- | --- | --- | --- |
| TC-1880 | FL-128, SCR-131, SCR-132, SPEC-302, SPEC-333 | browser agent | Sign-in starts once. Callback refusal, provider delay and session expiry provide recovery. Project switching restores the last valid part, stage, item and version for each project. Foreign and absent projects have matching refusal behavior. |
| TC-1881 | FL-129, SCR-133, SCR-137, SPEC-326–329 | browser agent, HTTP, CLI | Preview and owner consent identify the exact first publication. GitHub verification rejects an unmerged or older commit. Lost responses replay one receipt. The screen shows the held commit, last receipt and a retry or setup action for the attempted commit. |
| TC-1882 | FL-130, SCR-134, SCR-139, SPEC-303–310 | browser agent | All 13 stage slots show their work, artifact and checkpoint states. Historical and removed items retain review links, source metadata and discussions. Stalled reads allow a retry. |
| TC-1883 | FL-131, SCR-135, SPEC-311–316 | browser agent, HTTP | A complete question remains bound to the original item and publication. Concurrent claims have a single winner. Lease expiry, response loss and proposal review preserve the correct state and version. |
| TC-1884 | FL-132, SCR-136, SPEC-317–324 | browser agent, HTTP | An owner decides on the exact displayed revision. Machine credentials are refused. Losing a response or repeating a click records a single decision. Withdrawal appends history and restores downstream blockers. |
| TC-1885 | FL-133, SCR-136, SCR-137, SCR-139, SPEC-321–329 | browser agent, CLI | An unchanged content digest retains prior approval. A new digest requires a fresh checkpoint while keeping the original decision and source. Publication failures preserve the held snapshot and give an actionable status. |
| TC-1886 | FL-134, REQ-341–346, API-237–240 | operator | Reconcile all three retained projects from a protected backup. Restore every acknowledged write in the rehearsal. Incomplete release evidence produces a keep decision. |
| TC-1887 | FL-135, SCR-138, SCR-140, SPEC-332, SPEC-348, SPEC-350 | browser agent, CLI | Issue a narrowly scoped secret once, check role separation and confirm revocation. The installation-free sample remains private to its owner and displays its source. |
| TC-1888 | FL-136, SCR-141, REQ-349, API-231 | browser agent, HTTP | Verify the preview's exact source. The iframe's policy confines scripts and rejects parent access, network access, write attempts and unsafe navigation with no change to stored project state. |
| TC-1889 | REQ-336, REQ-338 | browser agent, manual | Check both themes at 320, 390, 768 and 1440 CSS pixels. Verify keyboard navigation, focus, names, contrast, reflow and screen-reader behavior. |
| TC-1890 | REQ-339, REQ-340 | staging, performance | With 100 projects, up to 3,000 items each and 20 authenticated contexts, record at least 200 warmed review navigations and 200 durable question submissions. Review P95 is at most 2 s and acknowledgement P95 is at most 1 s. |
| TC-1891 | REQ-330, REQ-331, API-241 | CI, operator | Verify credential boundaries, repeatable CI setup and the delivery receipt. Compare each held snapshot, source and main commit. |

The [response cases](rebuild/api-cases.json) map the 36 v2 HTTP operations and all 283 declared responses to test IDs. Run numeric responses and each operation's default response through the real handler. Check the problem code, response body or headers and durable state. Record responses observed without a matching assertion as observations.

Run browser roles and recovery paths against one identified candidate. Record the browser, width, theme, trace ID where available and the resulting data. Record the original failure evidence and the exact candidate used for a retest. Compare migration and recovery evidence on protected server copies.

The release evidence requires complete response and browser flow coverage, accessibility, staging latency, all-project migration and recovery, preview isolation, actual Google sign-in, publication receipts and owner checkpoint decisions. Verify those gates before switching the production address. [Release gate](../../nexus/src/rebuild-operator.js)
