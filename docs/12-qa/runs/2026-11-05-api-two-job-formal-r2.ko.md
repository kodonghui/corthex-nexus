# API 두 기준과 Job 정식 r2, 2026-11-05

현재 원본 QA710=pass520/partial188/fail2입니다. TC787/1052만 새로 범위를 한정해 수용하고,TC654는 partial·TC1271/1309는 fail을 유지하며 이후 결과를 연결합니다. 나머지705개 전체 행·원ID/Steps/Expected·WBS64행(15done/49in progress)을 보존합니다. [근거](2026-11-05-api-two-job-formal-r2/proof.json)에 교체 전 EN/KO 문구와 해시를,[manifest](2026-11-05-api-two-job-formal-r2/manifest.json)에 정규 출력 bytes를 남깁니다. 이번 원본 단위는 Notion에 쓰지 않으며 새 사용자 체크포인트·단계 완료·예외·출시 권한을 더하지 않습니다.

| API 기준 | 보존된 정확한 요청 근거와 한계 |
| --- | --- |
| TC787 | 실제 API로30개를 만든 뒤 유효한31번째 snapshot409 too_many_projects/limit30·schema 객체36개/테이블13개 전체 행·비어있지 않은 receipt1개 불변. 실제 Problem/헤더/CSP/오류 trace-log·기존 스키마 검증이 일치합니다. 수용된 R3 한도 요청 재사용이며 새 실행이 아닙니다. 과거 externalRequests:0 상수는 트래픽 계측이 아니고 별도 validator process exit는 캡처되지 않았습니다. |
| TC1052 | `code-policy[32]`의 pending edit 닫기409 edit_state/state=pending·실제 현재 Problem/schema/보안/CSP·일치하는 오류 로그 trace와 같은 요청 전체 테이블/receipt 해시 불변. 생성한 합성 Access/메모리 실제 handler 근거이며 배포/브라우저 주장이 아닙니다. |

첫 v7 도구안은 request/response URL이 아직 분류되지 않은 이벤트 기록이 보안 판정에서 빠질 수 있는 P2로 실행 전 반려됐습니다. 별도 r2 guard는 cutoff에서 unresolvedEventRecords=0을 요구하며 이후 해소로 cutoff 판정을 승격하지 못하고,이후 미확인 근거는 보안을 무효화할 수 있습니다. 기존 오프라인 근거는8/8그룹(collector9/reference13) 통과이며 실제 HTTP/브라우저/native/정식 실행은0입니다. 이 순수 검사는 아래 실제 실행과 별도이고 실제 실패를 통과로 바꾸지 않습니다.

실제 r2는2026-11-04 UTC/2026-11-05 KST에 실행됐습니다. 시작/끝 저장 input proof가 같고 제품906f360/D802를 고정하며,이번 정리는 live source-proof 함수를 호출하지 않았습니다. 단계별20회씩 계획60칸을 모두 남기고 재시도/대체/이어 실행은 없었습니다.390×844/DPR2.75 touch/mobile·CPU1·legacy4G165ms/down1012500/up168750bytes/s·cache-off/SW bypass·300요소 fixture 조건을 고정합니다. 편집기 준비는 완전한 초기 SVG 지표와 별도이고90초 opening/95초 navigation acknowledgement/native+5초·정리 기한도 유지합니다.

여기서300은 렌더링 노드 수입니다.DDD는 source99행이 context frame1개를 포함한300노드가 되고,ERD는 열을 label로 둔 테이블300노드,사이트맵은 화면300노드이며 edge299개는 노드 수에서 뺍니다.

| 단계 | 초기 SVG 지표 관측 | 정리까지 유효 / 고정 분모 | SVG 정규P95 | native 정규P95 |
| --- | ---: | ---: | --- | --- |
| DDD |13|13/20|null|null|
| ERD |13|12/20|null|null|
| 사이트맵 |12|12/20|null|null|

합계38관측·37유효·22미시작입니다. reference는 계획8개 중5개 검증·3개 미시작이며 별도 비제한 Node 시계/회선으로60회와 두 P95에서 제외됩니다. 관측38행의 보안 근거는 모두 확인됐고 마지막 code 실패/미완료 행은0입니다. 계획한 전체 실행이 성립하지 않아 보존된 study security/primary 판정은 fail이며 실제 인증 누출을 주장하는 것은 아닙니다. 유효한 일부만이나 과거 회차를 섞어 정규P95를 계산하지 않습니다.

slot38(ERD)의 owned-cleanup-not-verified로 중단했습니다. Browser.close ACK는 있었으나30초 유예 뒤에도 정리를 검증하지 못했고,소유한 Job 종료1회가10초 operation deadline에 걸렸습니다. 최종 close reply는 accounting0/held0을 보고했으나 rootWaitSignaled=false·cleanup=false·helper exit/close code1이었습니다. 스트림 종료나 이 counter만으로 Chrome/root 종료를 증명하지 않습니다. operator는 실패 뒤 OS census를 하지 않았으므로 OS/Chrome0을 추론하지 않습니다. controller exit1·실행1회/재시도0과 원래 실패 판정을 유지합니다. v4/v5/v6/첫v7/r2 원본과 이전3초 실패를 보존하며 SLA 통과나 원인 확정이 아닙니다.

마지막 결과5행과 현재 QA 집계만 바꿨습니다. 제품 필수 검사/검토·커밋/CI·이후 Notion 동기화는 Root 소유입니다. runtime/배포와 출시/REQ-107/Worker-D1 관문을 유지하고 이후 측정은 별도 pin된 계획/검토/Root gate를 거칩니다.
