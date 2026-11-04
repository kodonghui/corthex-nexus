# 원 수용 기준, 2026-11-05

원 기준 TC612/613/615/632/639/646/686/699의8개만 새로 범위를 한정해 통과시켰습니다. 현재 원본 QA710=pass518/partial190/fail2이며 WBS64개의15done/49in progress는 그대로입니다. 원ID/Steps/Expected·나머지702개 전체 사례행·이전 결과를 보존합니다. [근거](2026-11-05-original-criteria/proof.json)에 이전 EN/KO partial 문구와 사례별 해시가 있습니다.

서로 다른 새 실행 기준은4개입니다. 정확 E7 허브 pin의 Python 파서3개와 실제 Node handler/메모리SQLite의 프로젝트 한도1개입니다. Python3.13.14의 parser r2는3/3, 이후 영향받은 TC613 메서드만 r3에서1/1 통과했습니다. TC612/615의 메서드·helper AST는 실행한 r2와 같습니다. Node24.18.0의 TC639는1/1 통과했고 최종 소스는 근거 metadata만 바뀌었으며 handler 호출과 assertion은 같습니다. TC613 추가 실행을 다섯 번째 새 사례로 세지 않습니다. 나머지4개는 현재 소스18개를 다시 대조한 정확한 기존 응답을 재사용합니다.

| 사례 | 근거와 정확한 범위 |
| --- | --- |
| TC612 | 실제 E7 ERD에 Given의 TERM 주석을 더해4열/type/nullability·id PK·TERM/context·이 부분 source 밖 customers로 향하는 restrict FK 자료 확인. |
| TC613 | literal ALTER 전 FK 없는 base를 명시 확인하고 같은 endpoint/context/부분 밖 대상 자료를 확인. literal에는 ON DELETE가 없어 빈 값을 유지하며, 별도 explicit RESTRICT 대조군은 source 위치를 뺀 완전 FK를 비교. |
| TC615 | 실제 E7 Home/Order detail의 이름/path/access/parent와 그로부터 얻은 source edge. 브라우저 화살표 관측은 아님. |
| TC632 | `permission[19]`:403 access_missing·seed project 이름 부재·같은 요청 DB/receipt 불변. |
| TC639 | 실제 API로30개를 만든 뒤 유효한31번째 요청이409 too_many_projects. 같은 요청의 schema 객체36개·테이블13개 전체 행/열/FK·API로 만든 비어있지 않은 receipt1개를 보존하며 거절 snapshot/space는 없음. |
| TC646 | `permission[66]`:user-kind 제안403 agent_only·같은 요청 DB/receipt 불변. |
| TC686 | `boundary[116]`:실제로 닫힌 의견의 agent 답글409 comment_closed·같은 요청 DB/receipt 불변. |
| TC699 | `permission[82]`:합성 service-kind 받기403 user_only·같은 요청 DB/receipt 불변. |

matrix index는 current-refusal-permission-v1/current-refusal-boundary-v1 phase의0기준입니다. permission capture에는138행 matrix에서 뺀 bootstrap 응답이 있어 phase capture20/67/83은 matrix19/66/82와 연결되고, boundary capture/matrix116은 같습니다. 관측ID와 정확한 해시는 근거에 있으며 합계 통과 수를 실제 역할/상태/body/효과 대신 쓰지 않습니다. 보존 응답은 상태/code/schema·공통 보안 헤더/CSP·오류 trace/log가 맞습니다. 새 한도 Problem 응답은 별도 스키마 검증 오류0이며, validator의 별도 process exit는 캡처하지 않아 만들어 적지 않습니다.

처음 실패한 r1 초안의 로그·소스는 private에 원래대로 남깁니다. 정확 Given의 TERM 추가, 원래 없던 사이트맵 optional 기대와 지나치게 엄격한 push 성공 응답 단정을 교정했습니다. 초기 검토는 table-level FK를 가정했으나 실제 E7은 column-inline REFERENCES이므로 기존 제거를 잘못된 SQL로 판정하지 않습니다. 최종 TC613은 완전한 customer_id 정의·REFERENCES/FOREIGN KEY/ON DELETE 부재·ALTER 전 실제 FK=[]를 명시 확인합니다. 별도 SQLite 구문검사는 추가하지 않았고 미명시 삭제동작에 기본값을 지어내지 않습니다.

이전 Node 근거의 externalRequests:0은 상수였습니다. 원문은 보존하되 계측 counter로 쓰지 않고 최종 metadata/근거에는 트래픽 수 미계측을 명시했습니다. 설계는 생성한 서명·메모리 인증서 fixture를 쓰는 직접 handler이며 listener/live endpoint는 시험에 없습니다. 이를 외부 트래픽 계측으로 바꾸어 읽지 않습니다.

작업 테스트 해시·base35a9941·정확 E7 pin은 [정규 manifest](2026-11-05-original-criteria/manifest.json)에 있습니다. 새 테스트 커밋·브라우저 그림·배포/실제 Access·모든 OS 실행을 주장하지 않습니다. 과거 R1/읽기/전송/정식 실패와 완료된269행 Notion 근거는 그대로입니다. 이번 원본 기록은 Notion에 쓰지 않으며 전체 필수 검사/검토·커밋/CI/게시·이후8행 동기화는 Root 소유입니다. 단계/출시/3초/REQ-107/Worker-D1 조건도 유지합니다.
