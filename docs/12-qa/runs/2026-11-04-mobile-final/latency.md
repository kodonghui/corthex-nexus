# SVG v4 latency memo — read only

Inputs are only the three completed B01/R-COLD/R-WARM report.json files. All values below are milliseconds. Per stage, select the three smallest/largest finite recorded firstSvgPaint values from the20 slots; preserve original validity. No denominator or qualification is recomputed. Copied report P95s: DDD4546.3/native65602, Sitemap4381.2/native18907. ERD has19/20 qualified rows, normative P95 null and completed-only diagnostic6993.9. The original failure against3s remains unchanged.

DOM request/response/marker/two-rAF values share performance.timeOrigin. *DNS/TLS were not saved in DOM navigation: they are **CDP timings mapped through the recorded epoch bridge**, clearly labelled in JSON. Recorded DNS0/0 means zero in that record, not universally free DNS. TLS nests inside pre-request; do not sum it twice. There is no separate style-start/end timing, so DOM-complete→two-rAF is not isolated style or CPU time.

**01-domain**

| Pick/global(stage) | DNS/TLS Δ* | requestStart | responseStart | responseEnd | DOM complete | first 2rAF | EOF→SVG |
|---|---:|---:|---:|---:|---:|---:|---:|
| fast1 #35(12) | 0.0/308.1 | 435.9 | 1131.8 | 1144.8 | 1172.0 | 1217.9 | 73.1 |
| fast2 #17(6) | 0.0/334.1 | 462.0 | 1151.0 | 1163.9 | 1191.1 | 1241.5 | 77.6 |
| fast3 #37(13) | 0.0/362.2 | 500.6 | 1207.3 | 1219.7 | 1244.3 | 1292.3 | 72.6 |
| slow1 #26(9) | 0.0/1338.6 | 1473.3 | 4977.0 | 5315.8 | 5358.3 | 5380.2 | 64.4 |
| slow2 #46(16) | 0.0/360.2 | 495.1 | 3780.0 | 4477.7 | 4488.6 | 4546.3 | 68.6 |
| slow3 #6(2) | 0.0/363.6 | 488.7 | 1635.5 | 4355.6 | 4367.6 | 4413.8 | 58.2 |

**05-erd**

| Pick/global(stage) | DNS/TLS Δ* | requestStart | responseStart | responseEnd | DOM complete | first 2rAF | EOF→SVG |
|---|---:|---:|---:|---:|---:|---:|---:|
| fast1 #27(9) | 0.0/362.2 | 491.8 | 1133.8 | 1146.1 | 1169.5 | 1209.9 | 63.8 |
| fast2 #13(5) | 0.0/328.3 | 454.2 | 1188.8 | 1203.3 | 1234.7 | 1277.0 | 73.7 |
| fast3 #11(4) | 0.0/350.9 | 486.8 | 1639.2 | 1652.9 | 1674.0 | 1724.2 | 71.3 |
| slow1 #22(8) | 0.0/358.5 | 497.5 | 6186.9 | 6879.1 | 6918.9 | 6993.9 | 114.8 |
| slow2 #31(11) | 0.0/1352.8 | 1488.9 | 3766.8 | 5793.6 | 5787.4 | 5832.3 | 38.7 |
| slow3 #29(10) | 0.0/359.5 | 496.6 | 1620.6 | 5106.0 | 5112.4 | 5176.5 | 70.5 |

**07-sitemap**

| Pick/global(stage) | DNS/TLS Δ* | requestStart | responseStart | responseEnd | DOM complete | first 2rAF | EOF→SVG |
|---|---:|---:|---:|---:|---:|---:|---:|
| fast1 #5(2) | 0.0/366.6 | 502.5 | 1105.6 | 1126.9 | 1258.1 | 1298.2 | 171.3 |
| fast2 #3(1) | 0.0/361.2 | 494.4 | 1143.0 | 1165.4 | 1197.9 | 1369.0 | 203.6 |
| fast3 #34(12) | 0.0/350.5 | 479.8 | 1489.8 | 1511.9 | 1532.5 | 1583.5 | 71.6 |
| slow1 #39(13) | 0.0/7504.9 | 7634.9 | 8786.5 | 10191.7 | 10202.6 | 10247.2 | 55.5 |
| slow2 #7(3) | 0.0/2219.7 | 2351.3 | 3528.7 | 4321.5 | 4321.0 | 4381.2 | 59.7 |
| slow3 #41(14) | 0.0/2657.8 | 2793.4 | 3854.4 | 3876.9 | 3922.5 | 4063.0 | 186.1 |

Initial delays appear in different observed spans. DDD #26 has3503.7 request→responseStart; #6 has2720.1 responseStart→responseEnd. ERD #22 waits5689.4 to responseStart; #29 has a3485.4 body-receipt span. The largest initial value, Sitemap #39 at10247.2, has requestStart7634.9/responseStart8786.5/EOF10191.7/DOM10202.6/two-rAF10247.2; recorded CDP TLS7504.856 overlaps pre-request. EOF→SVG is55.5 there. Across each stage's selected slow3, EOF→SVG is58.2–68.6 DDD,38.7–114.8 ERD,55.5–186.1 Sitemap. These multi-second samples cannot be explained solely by post-EOF SVG work. The data does not establish a CF, compression, network or server cause.

**ERD global20(stage7):** HTML EOF2624.0/DOM2658.2/firstSVG2742.4 were observed, but its one code request, view.f3a8b693.js at bridged2634.228, has zero recorded code responses. Cookie-only evidence is verified in the source. There is no observed403, MISS or network-failure event. Last successful poll is89913.3 and the stop reason is the whole-opening deadline. Strict HIT qualification is unverified and native milestones/live count are separately unobserved. The fast SVG does not rescue this row's qualification.

**DDD native-P95 row #10:** DOM firstSVG3129.4→coreSVG59602.8→nativeReady65602.0→native two-rAF65657.7. Bridged view request3054.236/wire-header-end3457.767/loadingFinished59463.107 gives a56005.340 header-end→completion-timestamp interval, followed by139.693 to coreSVG. Native-library requests occur around59603; last pre-native code finish65132.970 leaves469.030 to native readiness, then55.7 to two-rAF. All20 code responses are recorded HIT/200. This is chronology, not a separation of transfer, idle, decode, evaluation or render CPU. Some response-event timestamps follow loadingFinished; they are kept separate rather than substituted for first wire-header timing. The largest native row #8 at73179.8 is also retained in JSON.

The nine reference openings are not added to formal data. R-WARM enables browser cache/shared contexts; its three later rows retain their original cookie-only-unverified invalid flags. In particular, its first DDD SVG1615.7 precedes HTML EOF3117.9 (residual-1502.2). Complete SVG/marker and full-document EOF can overlap, so body and DOM intervals are not always serial additive phases. These references do not establish a causal cold/warm effect or a new pass.

If separately authorized later, evidence would be needed for connection chronology in long recorded TLS spans, dataReceived/DOM resource timing between code header-end and completion, and post-EOF DOM/style/rAF scheduling. The current snapshots cannot choose among causes. Whole-observation cumulative CPU, including the extra5s and instrumentation, is not attributed to server or individual phase CPU. No browser/HTTP/remote/model/dependency/measurement/input-write action occurred; no design, plan or sample qualification changed.
