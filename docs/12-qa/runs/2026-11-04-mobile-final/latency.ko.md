# SVG v4 지연 구간 메모 — 읽기 전용

입력은 B01/R-COLD/R-WARM의 완료 report.json3개뿐입니다. 이하 단위는ms입니다. 단계별 firstSvgPaint가 관측된20개 값에서 빠른3/느린3을 골랐고 원 validity는 유지했습니다. 원 분모/P95 판정은 재계산·재분류하지 않았습니다. 아래 P95는 보고서 값을 그대로 인용합니다: DDD4546.3/native65602, Sitemap4381.2/native18907; ERD는19/20 조건충족으로 normative null, completed-only diagnostic6993.9입니다. 3초 미달이라는 원 결정을 바꾸지 않습니다.

DOM request/response/marker/2rAF는 같은 performance.timeOrigin 축입니다. *DNS/TLS는 DOM navigation에 저장돼 있지 않아 **CDP timing + 기록된 epoch bridge로 환산**했습니다. 원시DNS0/0은 그 기록의0ms일 뿐 실제 DNS가 항상 무료라는 뜻은 아닙니다. TLS는 pre-request에 포함되므로 중복 합산하지 않습니다. 스타일 시작/끝은 따로 기록되지 않아 DOM complete→2rAF를 순수 스타일 또는 CPU 시간으로 해석할 수 없습니다.

**01-domain**

| 선택/global(stage) | DNS/TLS Δ* | requestStart | responseStart | responseEnd | DOM complete | first 2rAF | EOF→SVG |
|---|---:|---:|---:|---:|---:|---:|---:|
| fast1 #35(12) | 0.0/308.1 | 435.9 | 1131.8 | 1144.8 | 1172.0 | 1217.9 | 73.1 |
| fast2 #17(6) | 0.0/334.1 | 462.0 | 1151.0 | 1163.9 | 1191.1 | 1241.5 | 77.6 |
| fast3 #37(13) | 0.0/362.2 | 500.6 | 1207.3 | 1219.7 | 1244.3 | 1292.3 | 72.6 |
| slow1 #26(9) | 0.0/1338.6 | 1473.3 | 4977.0 | 5315.8 | 5358.3 | 5380.2 | 64.4 |
| slow2 #46(16) | 0.0/360.2 | 495.1 | 3780.0 | 4477.7 | 4488.6 | 4546.3 | 68.6 |
| slow3 #6(2) | 0.0/363.6 | 488.7 | 1635.5 | 4355.6 | 4367.6 | 4413.8 | 58.2 |

**05-erd**

| 선택/global(stage) | DNS/TLS Δ* | requestStart | responseStart | responseEnd | DOM complete | first 2rAF | EOF→SVG |
|---|---:|---:|---:|---:|---:|---:|---:|
| fast1 #27(9) | 0.0/362.2 | 491.8 | 1133.8 | 1146.1 | 1169.5 | 1209.9 | 63.8 |
| fast2 #13(5) | 0.0/328.3 | 454.2 | 1188.8 | 1203.3 | 1234.7 | 1277.0 | 73.7 |
| fast3 #11(4) | 0.0/350.9 | 486.8 | 1639.2 | 1652.9 | 1674.0 | 1724.2 | 71.3 |
| slow1 #22(8) | 0.0/358.5 | 497.5 | 6186.9 | 6879.1 | 6918.9 | 6993.9 | 114.8 |
| slow2 #31(11) | 0.0/1352.8 | 1488.9 | 3766.8 | 5793.6 | 5787.4 | 5832.3 | 38.7 |
| slow3 #29(10) | 0.0/359.5 | 496.6 | 1620.6 | 5106.0 | 5112.4 | 5176.5 | 70.5 |

**07-sitemap**

| 선택/global(stage) | DNS/TLS Δ* | requestStart | responseStart | responseEnd | DOM complete | first 2rAF | EOF→SVG |
|---|---:|---:|---:|---:|---:|---:|---:|
| fast1 #5(2) | 0.0/366.6 | 502.5 | 1105.6 | 1126.9 | 1258.1 | 1298.2 | 171.3 |
| fast2 #3(1) | 0.0/361.2 | 494.4 | 1143.0 | 1165.4 | 1197.9 | 1369.0 | 203.6 |
| fast3 #34(12) | 0.0/350.5 | 479.8 | 1489.8 | 1511.9 | 1532.5 | 1583.5 | 71.6 |
| slow1 #39(13) | 0.0/7504.9 | 7634.9 | 8786.5 | 10191.7 | 10202.6 | 10247.2 | 55.5 |
| slow2 #7(3) | 0.0/2219.7 | 2351.3 | 3528.7 | 4321.5 | 4321.0 | 4381.2 | 59.7 |
| slow3 #41(14) | 0.0/2657.8 | 2793.4 | 3854.4 | 3876.9 | 3922.5 | 4063.0 | 186.1 |

관측된 초기 지연은 한 구간에 고정돼 있지 않습니다. DDD #26은 request→responseStart3503.7, #6은 responseStart→responseEnd2720.1입니다. ERD #22는 헤더까지5689.4, #29는 본문 수신 span3485.4입니다. 최고 Sitemap #39의10,247.2는 requestStart7634.9/responseStart8786.5/EOF10191.7/DOM10202.6/2rAF10247.2이며 CDP TLS 구간7504.856이 pre-request와 겹칩니다. 이 표본의 EOF→SVG는55.5입니다. 선택된 느린3의 EOF→SVG는 DDD58.2–68.6,ERD38.7–114.8,Sitemap55.5–186.1입니다. 따라서 이 표본들의 수초 지연을 EOF 이후 SVG 작업만으로 설명할 수 없습니다. CF·압축·네트워크·서버 어느 원인인지는 이 자료로 확정하지 않습니다.

**ERD global20(stage7):** HTML EOF2624.0/DOM2658.2/firstSVG2742.4는 관측됐지만 code 요청 `view.f3a8b693.js`1개(bridge상2634.228)에 응답 기록이0개입니다. cookie-only는 원본에서 verified이며 HTTP403/MISS/네트워크 실패의 증거가 없습니다. 마지막 성공 poll은89913.3, 종료는 whole-opening deadline입니다. 엄격 HIT 전제는 미확인이고 native milestone/live count도 미관측인 별도 실패입니다. 빠른 SVG를 근거로 이 행을 qualified로 바꾸지 않았습니다.

**DDD native P95 해당 #10:** DOM firstSVG3129.4→coreSVG59602.8→nativeReady65602.0→native2rAF65657.7입니다. bridge상 view 요청3054.236/기록된 wire-header-end3457.767/loadingFinished59463.107로, header-end→완료 timestamp 간격은56005.340입니다. 그 뒤 coreSVG까지139.693이며 native 라이브러리 요청은 약59603대, 마지막 native 전 code 완료65132.970→nativeReady 잔여469.030, nativeReady→2rAF55.7입니다. code20개는 HIT/200으로 기록됩니다. 이는 chronology이며 실제 전송/idle/decode/eval/렌더 시간을 분해한 것이 아닙니다. response-event timestamp가 loadingFinished보다 뒤인 자원도 있어 이를 첫 헤더 시각으로 대체하지 않았습니다. 최대 native #8의73179.8도 JSON에 별도 보존했습니다.

참고9행은 formal에 합치지 않았습니다. R-WARM은 cache enabled/공유 context 조건이며 세 후속 행의 기존 cookie-only 미입증 invalid를 유지했습니다. 특히 R-WARM DDD첫행의 SVG1615.7은 EOF3117.9보다 먼저입니다(잔여-1502.2). SVG marker와 전체 HTML EOF가 겹칠 수 있으므로 모든 수신 span과 DOM 작업을 직렬 합산하지 않습니다. 이 참고값으로 cold/warm 인과 효과나 새로운 통과를 주장하지 않습니다.

후속 진단이 별도로 승인된다면 긴 TLS 표시 구간의 connection chronology, code의 header-end→loadingFinished 사이 dataReceived/DOM resource timing, EOF 후 DOM/style/rAF scheduling을 각각 확인할 근거가 필요합니다. 현재 snapshot만으로 그 원인을 고를 수 없습니다. 전체 관측 누적 CPU(추가5초·계측 포함)를 서버나 특정 phase CPU에 귀속하지 않았습니다. 브라우저/HTTP/원격/모델/의존성/새계측/원본변경은0이며 설계·계획·표본 판정을 바꾸지 않았습니다.
