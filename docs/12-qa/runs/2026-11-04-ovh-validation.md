# OVH development validation, 2026-11-04

[한국어](2026-11-04-ovh-validation.ko.md)

TASK-223/224/248/251/252/255–264; TC-1270/1271/1283/1291/1304/1307/1309. Actual development integration `aad16450d1256d809023b8b1da18aa67ea026010`, metadata `caf43251385f56770cfa31bbad229bb16df7527d35a73adf2558b382d8adb5bb`. Main and production remain unchanged by this work. [Sanitized numeric receipt](2026-11-04-ovh-validation/summary.json).

## Results kept separate

| Procedure | Observation | Scope |
| --- | --- | --- |
| Exact-head product CI | Seven jobs passed, including34 browser paths and the3,987,903-byte evidence upload | Linux workflow41756751292 at34b5b33; both previous infrastructure failures remain |
| Actual service-identity contract smoke | 32 operations,154 responses, five checks154/154 each | 200×16,400×7,403×29,404×102; many404s follow removal of the run's own project. No user-only success or411-case pass inferred |
| First maximal push | Exactly1,000,000bytes/3000items/2000checks/3pictures;200 and exact readback | Inclusive handler1078.166ms, post-response RSS132,886,528bytes; target1s exceeded |
| Repeated maximal push | Same limits and200/readback; inclusive handler997.419ms | Whole three-request service CPU delta72.256ms, RSS140,259,328bytes. First failure remains; CPU, body receipt and network round trip are different measurements |
| Updated restore CLI | Original legacy schema/data matched; explicit migration of a separate copy preserved row digest and installed1/2/3 | Real origin-only files. Store list/body behavior checked. Backup untouched; no SQL, rows, databases or credentials exported |
| Mobile sitemap | All20 drawings ready,300 Hangul-named logical nodes,fonts loaded;19/20 without resource errors | One favicon404 means no normative batch P95; timing-only all20 first-ready P955165.6ms, ready+fonts5663.7ms |
| Mobile ERD | 20/20,300 Hangul-named tables/live rects and loaded fonts | First-ready P954123.9ms, ready+fonts4124.5ms; target3s exceeded |

Mobile conditions: Chrome156 Windows emulation,390×844/DPR2.75/touch, Fast4G165ms/8.1Mbps/1.35Mbps, cache off, service workers bypassed, CPU1,20 new incognito contexts per picture. No403, CSP, page exception or network failure occurred. The valid document locale ko-KR was incorrectly rejected by an exact-ko harness comparison; the raw40 records stay unchanged and only that interpretation is corrected. CPU4 is deferred until the transport changes are checked. None of this is physical-device evidence.

## Diagnosis and follow-up

Two additional openings are diagnostic, not replacement samples. Each script had roughly0.9–1.1s TTFB. The pinned library eagerly imports browser-fs-access backends; it later loads its Korean locale and roundRect polyfill. Assistant Medium started after the scene. ERD's final script finished at3494.4ms and ready followed at3988.2ms. These are transport/chain observations, not a claim that server CPU caused the delay.

[BUG-554](https://github.com/kodonghui/corthex-nexus/issues/22) keeps this failure. The follow-up preloads those existing modules and fonts, supplies a self-contained icon, and serves precomputed Brotli/gzip variants for code only after the same Access/route checks. The fixed Cache-Control, editor pins, all443 browser payload bytes, tokens, CSP and same-origin boundary are unchanged. Metadata `ca4ac3fd94fc14d08bd7a576792d92f8dd84a1529030fa63b6bb6c42bd4a2085` records the new preload graph. Actual wire tests check decoded bytes, q=0 refusals, HEAD, font passthrough and unauthenticated refusal. Numeric optional metrics now distinguish body arrival, work after the body and process-CPU windows; parallel request CPU windows overlap and are not exact per-request CPU attribution.

Retained harness errors: adding an unnecessary replaces field to the exactly-full maximal fixture tripped its local size guard before a second POST; the diagnostic was corrected for its unchanged commit. An initial origin artifact check compared Windows CRLF worktree bytes; exact Git-blob/archived bytes then matched all seven origin files. The first restore helper had a local quotation syntax error and made no origin call. These are not product defects or successful measurements.

The new transport's final mobile20-opening groups and CPU4 reference remain to be run. Core still waits for MEMORY C1/PR C/PR D; main merge, production switch, tags, first real repository upload and old-resource retirement remain the release decision.

## CA4 development follow-up

Integration `db6313683848ecac10e0fcd1ad4ecd48e2babdcf` passed all seven CI jobs. One diagnostic opening per picture measured first-ready3560.7ms for sitemap and3671.1ms for ERD; these are not P95 samples and both still exceed3s. Both had300 Hangul names, loaded fonts, and no403, CSP or resource errors. The late module/font chain was removed. An optional, default-off Link-hint adapter is prepared for a proxy-supported development experiment; no103 or speed result is claimed from its unit test.

The same integration accepted exactly1,000,000bytes/3000items/2000checks and matched readback. Inclusive handling was1031.079ms, body receipt999.994ms, processing after receipt31.085ms, process CPU-window deltas65.092ms user+8.985ms system, and post-response RSS139,616,256bytes. Network round trip was26982.324ms. The inclusive1s miss remains visible; the faster phase and CPU numbers do not replace that measurement.

An actual development rollback selected the preceding runtime and then this integration, checking both listeners and all13 tables. Logical row counts/digest remained identical. A manual daily backup also succeeded with mode0600; no production switch occurred. Its first incomplete receipt is retained separately from the corrected complete run.

Upstream integration `d18fe0e1d44fbc4df4350c8a5728759c98d91ca5` incorporates main `982fb4f10e8712aff89e0d472f9a10943283aa68`. The combined local suite ran943 tests:928passed,15skipped; four strict plugin validations and all17 CI jobs passed. This updates the hub/harness integration, while the product's exact hub pin remains3570fb0c755b50c314ca26f0361c72a71fe22d0d. No core implementation or release merge is inferred.
