# 제품 개발 검사, 2026-11-04

[English](2026-11-04-product-development.md)

범위는 TASK-236–TASK-243, TASK-248–TASK-252, TASK-255–TASK-264입니다. 운영 출시 결정과 구분합니다.

## 원본과 묶음

제품 브랜치는 `codex/nexus-views-0.2`이며 실행부 기준은 `d3de08bbb3fe5e6e4a39a7936bfa72d9a6cf2378`입니다. 정확한 허브 기준점은 kodonghui/corthex#103의 `3570fb0c755b50c314ca26f0361c72a71fe22d0d`입니다. 리뷰 수정 뒤 허브 Python930개 중916개 통과·14개 건너뜀(642.061초), strict 패키지 검사4개 통과를 확인했습니다.

첫 커밋의 브라우저 metadata SHA256(과거7C35)은 `7c35c4998aa991d352c6e1b2f3d2f67ffe30b9818e6358b9e4b180a32efb631c`이며 두 번 빌드한 결과가 같습니다. 파일443개, 원본23,484,032바이트, 개별 gzip 합계16,357,513바이트입니다. 승인된 읽기 전용 ERD 이동·라벨 수정과 Excalidraw의 미사용 Firebase 호스팅 설정 제거를 포함합니다. 입력·배포 파일 해시를 확인하며 호스팅 Firebase 키가 남으면 실패합니다.

## 구분한 실행 범위

| 범위 | 관측 결과 | 한계 |
| --- | --- | --- |
| 제품 Node | 최종 편집기 그래프에서120개 통과 | 합성 Access·SQLite이며 실제 계정을 사용하지 않음 |
| 제품 Python | 정확하고 깨끗한 허브 기준점으로9개 통과 | 연결·페이지 사본·공개 검사이며 원래 저장소 OS 행렬과 다름 |
| Worker dry-run | 브라우저 모듈을 포함한 빌드 유지 | 운영 배포 없음 |
| 고정 외부 검사 | OpenAPI·응답·default·허브 계약·hook·sanitizer·독립 서버 Schemathesis 통과 | 모의·로컬 결과를 실제 로그인과 구분 |
| 독립 서버 Schemathesis | 동작32개, 응답154개에 검사5종 각각 통과 | 동작별 예제3개의 제한된 검사이며 명명 응답 전부가 아님 |
| 명명 API 감사 | 예제 스키마411개 확인, 실제 handler 명명 variant232개, default와의 합집합270/411 | 미관측141개, 적용 조건 명확화가 필요한 공유 예제11개 |
| 경로 CI 시험 | 성공·상태 요청47개와 권한·헤더 거절138개로32개 동작 전체 검사, 읽기·거절의 전체 행 해시 확인 | 요청 수이며 고유 TC 수가 아님 |
| 브라우저 회귀 | 03E31C·B17B3C·06BB2B에서 포인터·초안·경합5개 통과, 마지막06BB 회차14.699초 | 7C35는 호스팅 설정 제거만 추가하며 CI가 정확한 원본에서 다시 검사 |
| 그림 확인 | 그림3종과320/390/768/1440폭, DDD9단계, 이동·확대, 실제 마크와 ID 없는 의견 저장 | 03E31C의 시각·페이지 측정이며 실제 기기나 최종 OVH P95가 아님 |
| 실제 개발 로그인 | 사람 페이지200·미인증 리디렉션·에이전트 전용 제안201/철회/삭제 | 합성 프로젝트만 사용하며 실제 인증값은 저장소 밖에 둠 |
| 원 서버 DB 이주 연습 | 읽기 전용 D1 내보내기·데이터는 원 서버에 유지, 이주1/2/3 뒤 행·해시 보존, 분리 복구가 이전 스키마·데이터와 일치 | 운영 이주가 아닌 연습이며 첫 복구는 SQLite backup API 사용 |

원시 근거는 비공개 실행 기록에 보존합니다. 토큰·assertion·쿠키·사용자 프로필·실제 저장소 스냅샷·원 서버 DB 파일은 이 보고서에 넣지 않습니다.

첫 Linux PR 실행 bc82059에서 브라우저 회귀5개가26.129초에 통과하고 소유 프로필도 제거했습니다. 뒤이어 근거 업로드 action이 `..`를 포함한 경로를 거부해 해당 job이 실패했고, 다른 제품 job은 모두 통과했습니다. 근거 경로는 runner의 임시 폴더를 직접 쓰도록 고쳤습니다. 실패한 workflow도 이력으로 남기며 all-checks 통과로 부르지 않습니다.

BUG-553: 후속42d990a는 검사 작업을 시작하기 전 workflow 초기화에서 실패했습니다. `runner.temp`를 작업 수준 env에 썼으나 [공식 context 표](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#context-availability)는 그 위치에서 runner를 허용하지 않습니다. 실행 중인 준비 step이 RUNNER_TEMP를 읽어 GITHUB_ENV로 내보내도록 고쳤습니다. CI 기반 설정 실패를 정확한 묶음의 로컬 브라우저 통과와 구분해 보존합니다.

## 재검사할 수정 이력

| ID | 발견 | 수정 |
| --- | --- | --- |
| BUG-535 | Excalidraw 첫 전체 맞춤을 초기 데이터가 덮음 | 장면·화면 준비 뒤 맞춤 |
| BUG-536 | 캔버스가 클릭할 마크를 가림 | 캔버스·마크 쌓임 순서 지정 |
| BUG-537 | 문서 언어 ko-KR에 한국어 줄바꿈 규칙 누락 | `:lang(ko)` 적용 |
| BUG-538 | 320폭 ERD의 커밋 줄 넘침 | flex 자식 폭·줄바꿈 제한 |
| BUG-539 | API-104 JS 응답 형식이 고정 계약과 다름(TC-770) | `text/javascript`와 실제 자산 응답 검사 |
| BUG-540 | 의견 제목 상태·관련 제안 상태/열기 누락 | ID+상태 제목과 명시적 상태/열기 |
| BUG-541 | 철회 날짜 안내를 새로 읽기가 덮음 | 읽은 뒤 실제 반환 날짜 안내 |
| BUG-542 | English 화면의 한국어 사용자 글이 음절로 줄바꿈 | 두 언어의 사용자 글 영역에 어절 규칙 적용 |
| BUG-543 | 선택한 단계를 접으면 잘못된 단계 오류 | 알려진 프로젝트의 s 없는 주소 허용 |
| BUG-544 | 이름 있는 부분 때문에 프로젝트 전체 그림 링크 누락 | 존재하는 빈 부분의 그림 링크 포함 |
| BUG-545 | 끝난 부분을 기록이 없다고 안내 | 기록이 있으면 미진행 단계 안내를 생략 |

초기 실패와 하네스·도구 실패도 보존하며 이후 통과로 지우지 않습니다. 이전 Worker 간헐403인 BUG-534는 별도 OVH20회 묶음으로 재검사합니다. 새 그래프의 실제 최대 업로드·RSS·모바일 P95는 통합 브랜치를 개발 서버에 배포한 뒤 측정합니다.

코어 변경은 MEMORY C1·PR C·PR D가 main에 들어간 뒤 합니다. 이 결과는 main 병합·운영 전환·태그·실제 저장소 첫 업로드를 뜻하지 않습니다.

## 최종 동결 묶음과 추가 검사

최종 metadata SHA256은 `caf43251385f56770cfa31bbad229bb16df7527d35a73adf2558b382d8adb5bb`이며 두 번째 빌드와 바이트가 같습니다. 파일443개·원본23,486,991바이트·개별 gzip 합계16,358,576바이트입니다. 이 원본에서 Python9·Node121·Worker dry-run·고정 외부7검사가 통과했습니다. 연결한 허브 정확한 기준3570fb0은 CI17개와 코드·보안 리뷰를 통과했고 지적 없음으로 끝났습니다. 첫 실행의 무관한 MEMORY observer 실패는 이력에 남깁니다.

최종 portable driver는 정확한 CAF432에서34경로를106.660초에 통과했습니다. 새 fixture·브라우저7회와 소유 프로필7개 정리를 확인했습니다. 그림·포인터·초안 경합5개, 토론 동작4개, needs-user 버리기1개, 지연·오류·재시도18개, JS실패4개, 별도 새 브라우저 CSS실패2개입니다. 지연 읽기·모의 읽기 실패·실제 쓰기/SQLite 효과는 [정제한 근거](2026-11-04-product-development/results.json)에서 구분합니다. 별도 실제 선택범위 검사는 응답 전후 focus와39..42를 보존했고, 기존 행은 caret42..42 근거입니다.

정상 화면 매트릭스는 F260의48조합(상태6종×320/1440×EN/KO×light/dark)이며 CAF432에서는 현황 출처 문구만 바뀌어 한국어320/dark로 별도 확인했습니다. [선정 캡처](2026-11-04-product-development/summary.md)에 정확한 묶음을 적었습니다. 모든 오류의 전체 행렬이나 실제 기기 검사로 확대하지 않습니다.

API 감사는 스키마 예제411개·실제 handler 명명 variant355개·default 합집합393/411입니다. [ledger](2026-11-04-product-development/api-response-ledger.json)에 모든 TC ID를 유지합니다. [정확한 공유 예제18개의 적용 한계](2026-11-04-product-development/api-example-applicability.md)는 본래 역할·입력을 보존합니다. 경계 요청183개·불변 거절130개·무결성29개·외부 응답 스키마183/183은 이전47/138요청과 별도입니다. 요청 수를 전체 TC 통과나 실제 Access 결과로 바꾸지 않습니다.

| ID | 수정 동작 | 회귀 근거 |
| --- | --- | --- |
| [BUG-546](https://github.com/kodonghui/corthex-nexus/issues/14) | 읽는 동안 답글 입력창·대기 버튼·입력과 초점을 보존 | comment-loading-ready-reply |
| [BUG-547](https://github.com/kodonghui/corthex-nexus/issues/15) | 사라진 의견에 캐시 유무와 관계없이 복사할 초안을 보존 | gone/draft states |
| [BUG-548](https://github.com/kodonghui/corthex-nexus/issues/16) | 제안을 읽는 동안 원본 길이·대기 버튼을 표시 | proposal-loading-source-length |
| [BUG-549](https://github.com/kodonghui/corthex-nexus/issues/17) | 읽기 오류에 의견·제안 문맥과 재시도를 표시 | read failure/retry |
| [BUG-550](https://github.com/kodonghui/corthex-nexus/issues/18) | 오래된 상태를 다시 읽어도 실제409 안내를 보존 | actual stale-proposal conflict |
| [BUG-551](https://github.com/kodonghui/corthex-nexus/issues/19) | 주 CSS 실패 때 읽을 수 있는 정적 대체 화면을 보존 | asset-regression --core-css |
| [BUG-552](https://github.com/kodonghui/corthex-nexus/issues/20) | 편집기 CSS 실패 때 접근 가능한 항목 목록·패널을 보존 | asset-regression --editor-css |

통합 CI·최종 OVH 성능·수정한 CLI 복구는 다음 별도 검사입니다. 출시·코어 선행 조건을 유지합니다.
