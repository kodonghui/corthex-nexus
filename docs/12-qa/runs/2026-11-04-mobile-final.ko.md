# 최종 모바일 SVG와 로컬 검사, 2026-11-04

REQ-149 / TC-1271 / TC-1309는 승인된3초 기준에 계속 실패합니다. 보존한60·80회를 재분류한 연구가 아닙니다. [독립 감사](2026-11-04-mobile-final/audit.ko.md)·[69회 행](2026-11-04-mobile-final/openings.csv)·[공개 요약](2026-11-04-mobile-final/mobile-summary.json).

| 단계 | 적격 | 초기 SVG 표시 기회 P95 | 편집기 준비 적격 / P95 |
| --- | --- | --- | --- |
| DDD |20/20|4546.3ms|20/20 /65602ms|
| ERD |19/20|null|19/20 /null|
| Sitemap |20/20|4381.2ms|20/20 /18907ms|

20회 분모를 유지합니다. ERD6993.9ms는 적격19개만의 참고값이며 정규 P95가 아닙니다. 초기 SVG60회 시각은 모두 관측했습니다. 전체20번·ERD7번은SVG2742.4ms였으나 code요청1개의 응답 완료가90초 안에 관측되지 않아 HIT 전제와 편집기 준비가 미검증입니다. 실제 MISS·403·유출을 뜻하지 않습니다. RTT8/8 검증, cold3/3 적격·warm3/6 적격이며 재열기 세 건의 cookie transport는 미검증으로 남깁니다. 대체·숨은 재시도는0입니다. 편집기 준비와 초기 SVG는 별개입니다.

후보906f360/D802, runtime790efecc7cbf6cc160d6b7fb53cdbd0ba10362b075821cb4674d9fb41e29f3d7, plan26fdbd0fbb4ecf3763cdb1a0e6fc1b23cc469ccdf3f0620f326b9fa9aa7974af. 모바일390x844·DPR2.75·touch·CPU1·Fast4G·cacheOFF·SW우회·매회 새incognito·그림별한글300개·90초를 유지했습니다. 편집기 뒤5초 관측은 명시하며 누적CPU를 예전500ms와 같은 범위로 비교하지 않습니다. 완전한 DOM·스타일·가시영역·두rAF의 표시 기회 상한이며 합성기 픽셀 시각은 아닙니다.

[지연 순서](2026-11-04-mobile-final/latency.ko.md): 선정한 느린9개는 HTML responseEnd 뒤38.7–186.1ms에 초기SVG를 관측했습니다. 가장 느린SVG10.2472초 행은 requestStart7.6349/responseStart8.7865/responseEnd10.1917/DOM10.2026/두rAF10.2472초와 bridge로 옮긴 CDP TLS7.504856초 구간을 기록했습니다. DDD code응답 하나는 헤더부터완료까지56.00534초 뒤 core/편집기가 준비됐습니다. 관측 구간이며 CF·압축·네트워크 원인이나 특정구간 CPU로 단정하지 않습니다. 사전검증의 저장 메타데이터 분리·입력time/API시각 매핑 오류 두 건은 연구 전에 고쳤고 실패를 보존했습니다. 기존 seed변경은0입니다.

[로컬 검사](2026-11-04-mobile-final/local-checks.json): upstreamc235a7a/tree6a0e7e66에 main9ec6394와 최종CLI16을 합쳤습니다. 전체1057개는1042통과·기존15skip·실패/오류0,657.096초였고 같은소스의엄격4개도통과했습니다. 이전warmup/정리오류와짧은TEMP focused통과는원인미확정으로보존합니다. 소스전용Code/Security지적은수정했고 최종범위지적은0입니다. 실제새6셀은별도근거로확인합니다.

[현재개발전송검사](2026-11-04-mobile-final/wire.json)는zstd허용시Brotli·HTMLno-store/CSP·해시code HIT/Age·익명302/코드미전달을검증했습니다. 개발전용실험의지연개선인과는입증하지않았습니다. 운영/main/태그는관문을유지하고실제첫보내기는REQ-107을따릅니다. 이전측정·프로필·Worker/D1·되돌리기자료를보존하며소유측정Chrome/Node는0입니다. 전체인수나출시를통과처리하지않습니다.

[새CLI16 실제호스티드](2026-11-04-mobile-final/cli16-six-cell.json)는 Windows/macOS/Linux × Python3.8/최신3.15.2의 정확96개 명명 관측이 전부통과·해당skip0입니다. 호스티드Win3.8.10·Ubuntu/mac3.8.18과 로컬3.8.20/3.13.14를 구분합니다. PRheadc235a7a와 실제CImerge1aa71cd7를 따로 적고 새시험/필수source blob동등을확인했습니다. [현재제품허브pin](2026-11-04-mobile-final/current-hub-pin.json) e7ff394는 CLI실행부9개와같으며 canonicalhub.html은별도제품Python검사입니다. [전체workflow](2026-11-04-mobile-final/workflow.json)41845045363의17개job도 전부성공한뒤 PR122를개발통합b629c7d로병합했습니다. 이통합대상PR의설정된required context조회는없음이었으며없는context성공을추측하지않습니다. main·운영·태그관문은유지합니다.
