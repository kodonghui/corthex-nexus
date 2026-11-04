# 현재 명명 GET 응답 정리, 2026-11-05

원본 GET 기준24개만 새로 범위를 한정해 통과시켰습니다. 현재 QA710=pass510/partial198/fail2이며 WBS64개의15done/49in progress는 그대로입니다. 원ID·Steps·Expected 문구와 나머지686개 사례행은 바꾸지 않았습니다. 이전 EN/KO partial 문구와 사례별 해시는 [사례 근거](2026-11-05-read-closure/proof.json)에 보존합니다.

승인된16개는 저장된 현재 합성 handler의3개 phase를 대조했고, 새 영구 테스트가 나머지8개의 정확한 명명 상태를 만듭니다. 선택한 각 GET은 operation·상태·명명 의미 상태·현재 응답 스키마·API별 보안/캐시/CSP 정책과 같은 요청의 쓰기 영수증을 포함한 전체 SQLite 해시 불변을 확인했습니다. 참조하는 서로 다른 GET 응답은24개이며 새 테스트 함수24개가 아닙니다.

| 행 약칭 | 정확한 phase | 보존한 실행 범위 |
| --- | --- | --- |
| success[n] | current-synthetic-success-v1 | 실제 handler47응답·읽기17회 해시 불변 |
| boundary[n] | current-refusal-boundary-v1 | 경계183응답 중 정확히 선택한 성공 GET만 사용 |
| code-policy[n] | code-policy-acceptance-v1 |47응답·코드3개의 같은 응답 정책/바이너리 바이트 검사 |
| eight-read[n] | e1-read-remaining-eight-v1 |21응답=대상GET8+설정POST13·집중 테스트1통과/실패0/skip0·스키마21일치 |

index는 명시한 새 phase 안의0기준입니다. [정규 manifest](2026-11-05-read-closure/manifest.json)는 승인된 두 독립 근거와 현재 작업 테스트를 고정합니다. runtime 소스18개는6f968ee의 raw/정규 바이트와 일치합니다. 성공 테스트 작업 SHA는2cb50d9aa88bc7cf015db8d8632ca553eb7087816b3299f9d75b06493425c6ff, 새 읽기 variant 테스트는575edc285174c1ed0f581e4da42490247906efb62529364f1d46ba748d6a8ec0입니다. 작업 파일 근거이며 새 테스트가 과거 커밋에 있었다고 기록하지 않습니다.

HTML/API 데이터는 승인된 no-store 정책을 따릅니다. API-104는 별도로 승인된1년 public immutable 정책이며 같은 응답의 Set-Cookie 존재=false·Vary-star=false와 metadata 바이트/SHA 일치를 확인했습니다. 과거 capture 필터를 부재 근거로 쓰거나 디코딩한 폰트 문자열을 바이너리 원바이트로 세지 않습니다. 06의 Problem.traceId/오류 로그 조건은 오류일 때 적용되며 성공 스키마에 추가하지 않습니다.

페이지3개는 실제 코드 주입 handler의 HTML/JSON 부트스트랩 범위이며 기본 SSR·native 편집기·브라우저 paint는 아닙니다. TC-827의 한 테이블 문구는 명시적인 예시 축약으로, 허용된 실제 두 테이블 fixture에는 열린 댓글이 정확히1개입니다. TC-829는 정확한 명명 API의 두 화면 source를 수동으로 맞추고 실제 push2회로 그림 생성 후 원본을 제거해 빈ID·빈flows·terms·source-gone을 보존합니다. 허브 파서를 실행한 근거는 아닙니다. TC-848은 댓글2/불일치1/검토중반영1과 fixture에서 계산되는 waiting-for-user0/taken0을 확인했으며, 예시의3/1을 다른 합성 이력의 고정값으로 요구하지 않습니다.

집중 Node 테스트는 한 번 실행했습니다. 앞선 PowerShell 실행 파일 해석 실패는 Node/handler 실행 전이고 첫 스키마 시도는 기본 interpreter의 import 누락에서 멈췄습니다. 둘 다 별도로 보존하며 이미 설치된 contract 환경에서 같은21개 capture를 추가 요청 없이 검증했습니다. 의존성 설치나 관측 교체는 없습니다.

원본 판정24개만 바꿉니다. 이전 원캡처·R1/전송 기록·성능 실패를 모두 보존합니다. TASK-249는 적용 명명 응답54개·공유 예시 적용 검토18개가 남아 진행 중이며 별도 쓰기·조합 workflow·기타 partial은 통과시키지 않습니다. HEAD·배포/실제 Access·실제 저장소 업로드·단계·출시를 주장하지 않습니다. 남은 전체 필수 검사·Code/Security 검토·커밋/PR·이후 Notion 동기화는 Root 소유이며3초·main/운영/태그·REQ-107·Worker/D1 관문은 그대로입니다.
