# NEXUS: 작업 분해

[English](nexus.md)

CORTHEX 자신의 프로젝트 10단계입니다. 상태: 2026-11-04에 저장소 분리·독립 서버를 포함한 계획을 승인받아 진행 중입니다. 영어가 원본이고 Notion 데이터베이스는 읽기용 사본입니다(`truth: source`). 지금 `codex/nexus-0.2`에서 만드는 것은 승인되었으며 첫 시험과 이주를 진행하는 동안 관리자가 계획을 고칠 수 있습니다. main 병합·운영 전환·출시 태그는 아래 조건부 승인을 따르며 출시 관문을 전부 통과해야 합니다.

입력: [기능 명세](../04-functional-spec/nexus.ko.md), [스키마](../05-erd/nexus.ko.md), [API](../06-api/nexus.ko.md), [화면](../08-screens/nexus/README.ko.md), [목업](../09-mockup/nexus/README.ko.md)과 각각의 다음 단계 메모입니다. 01–09 확인 지점은 2026-11-03 통과했습니다. SPEC-134·142는 단계 ②이며 그 데이터 자리는 남깁니다.

## 이 파일을 읽는 법

`ID`는 TASK-201부터이며 바꾸지 않습니다. `작업`은 따로 시험할 한 조각입니다. `근거`는 SPEC/REQ, `건드리는 곳`은 인터페이스·저장 단위·화면입니다. `선행 작업`을 먼저 끝내고 C1·PR 이름은 외부 선행 조건입니다. `담당 agent`는 Codex이며 이 호스트의 계정 작업은 Aside에 맡깁니다. `크기`는 코드와 의미 있는 시험을 합해 S 약 300줄, M 약 800줄, L 약 2,000줄이며 넘으면 시작 전에 나눕니다. `끝났다고 볼 때`는 다른 사람이 확인할 근거입니다. `상태`는 todo, in progress, done (#N), removed (날짜)이며 번호와 행을 남깁니다.

요청의 모든 응답에 통과 사례가 있어야 완료입니다. 실제 개발 API·mock 화면·자동 페이지 검사·이미지 확인을 나누며 OS/실제 환경 검증이 남으면 진행 중입니다. 커밋마다 AGENTS.md 검사를 하고 묶음 PR은 통합 브랜치로 보내 all-checks와 코드·보안 리뷰 뒤 merge commit으로 합칩니다.

현재 작업 64개: S 7개·M 47개·L 10개입니다. [QA 계획](../12-qa/nexus.ko.md)은 기능 수용 기준·이름 붙은 응답·명령 결과·화면 상태·통합 시나리오에서 뽑은 원래710건을 보존하고,0.2.1 적용 여부 정정의 별개 엔드포인트 예제7건을 더해 현재717건입니다.

## 저장소 분리와 독립 서버

| ID | 작업 | 근거 | 닿는 곳 | 선행 | 담당 | 크기 | 끝난 기준 | 상태 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TASK-255 | 두 브랜치 이력을 뽑고 검증 | REQ-124, SPEC-104–SPEC-140, 2026-11-04 결정 | 제품 이력·계약·배포 | none | agent | M | 과거 경로·내용·권한을 대조하고 커밋·브랜치 대응표, 원래 PR 참조, 작업 보존과 이력 전체 검사를 기록합니다. | done |
| TASK-256 | 제품 원본과 고정 허브 연결 | REQ-124, SPEC-104–SPEC-140, 2026-11-04 결정 | 제품 이력·계약·배포 | TASK-255 | agent | M | 루트 규칙·프로젝트 원본을 만들고 깨끗한 정확한 허브 커밋의 양식으로 실제 연결·페이지 사본 검사를 통과합니다. | done |
| TASK-257 | 제품 CI와 저장소 보호 설정 | REQ-124, SPEC-104–SPEC-140, 2026-11-04 결정 | 제품 이력·계약·배포 | TASK-256 | agent | M | Linux 서버·빌드·기존 계약 전부·연결·공개 이력 검사와 all-checks를 통과하고 secret scanning·push protection·PR/검사 보호를 확인합니다. | done |
| TASK-258 | 원래 하네스를 제품으로 연결 | REQ-124, SPEC-104–SPEC-140, 2026-11-04 결정 | 제품 이력·계약·배포 | TASK-257 | agent | M | 원래 저장소 PR 하나로 옮긴 경로만 빼고 허브·코어·시험을 지키며 공용 안내·CI·dependabot·draft와 두 저장소 검사 근거를 맞춥니다. | done (kodonghui/corthex#102) |
| TASK-259 | Node HTTP와 SQLite 트랜잭션 실행 | REQ-124, SPEC-104–SPEC-140, 2026-11-04 결정 | 제품 이력·계약·배포 | TASK-256 | agent | L | 내장 모듈 실행부가 D1 결과·원자적 batch를 맞추고 추가 실행 패키지 없이 보존·이주·한도·HEAD·재시작을 통과합니다. | done |
| TASK-260 | Tunnel 뒤 원 서버 토큰 확인 | REQ-124, SPEC-104–SPEC-140, 2026-11-04 결정 | 제품 이력·계약·배포 | TASK-259 | agent | M | 독립 서버는 ctx.access 없이 서명·발급자·대상·시각·작성자 두 종류를 확인하고 Worker의 확인된 context와 기존 Access 정책을 유지합니다. | done |
| TASK-261 | SSH로 분리된 개발 서버 배포 | REQ-124, SPEC-104–SPEC-140, 2026-11-04 결정 | 제품 이력·계약·배포 | TASK-260 | agent | M | 전용 사용자·폴더·systemd·loopback·Tunnel로 개발 서버를 열고 재시작·되돌리기를 확인합니다. 실제 값은 Git 밖, 키는 원래 기기에 두며 다른 서비스를 지킵니다. | done |
| TASK-262 | DB 백업과 실제 복구 | REQ-124, SPEC-104–SPEC-140, 2026-11-04 결정 | 제품 이력·계약·배포 | TASK-259, TASK-261 | agent | M | 매일과 이주·배포 직전의 일관된 백업, 보관 기간·권한을 시험하고 복구 사본을 실제 열어 데이터·행동을 대조합니다. | done |
| TASK-263 | 운영 데이터 이주와 되돌리기 리허설 | REQ-124, SPEC-104–SPEC-140, 2026-11-04 결정 | 제품 이력·계약·배포 | TASK-262 | agent | L | 운영 D1을 읽기 전용으로 내보내 독립 개발 사본에서 이주·복구를 수·해시로 비교합니다. 기존 Worker·D1을 보존하고 운영 주소·데이터는 전환하지 않습니다. | done |
| TASK-264 | OVH 개발 계약·성능 재시험 | REQ-124, SPEC-104–SPEC-140, 2026-11-04 결정 | 제품 이력·계약·배포 | TASK-261, TASK-262 | agent | M | Schemathesis·실제 Access 두 종류와 최대1MB 밀기의 처리·메모리를 재고 서버 처리는1초 안입니다. 완성 화면 모바일 검사는 TASK-224/238/251에서 따로 증명합니다. 처리1초는 본문 전체 수신 뒤부터 응답 처리 완료까지이며 수신/왕복은 별도 참고입니다. | done |

## 서버

| ID | 작업 | 근거 | 건드리는 곳 | 선행 작업 | 담당 | 크기 | 끝났다고 볼 때 | 상태 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TASK-201 | Access 로그인 두 종류 시험 | SPEC-113, SPEC-116 | API-101–API-104 | none | agent | M | 실제 개발 Access의 사람·서비스 토큰에서 ctx.access·aud·sub·email·common_name의 있음/비어 있음을 기록하고 로그인 구현 전에 확인 방법을 정합니다. | done (kodonghui/corthex#92) |
| TASK-202 | 1단계 DB를 보존하는 이주 1 | SPEC-114 | TBL-101, TBL-113 | none | agent | S | 빈 DB와 1단계 DB에 이주 1이 원자적으로 적용되고 기존 스냅샷 바이트와 revision이 그대로 남습니다. | done (kodonghui/corthex#91) |
| TASK-203 | 설계 스키마로 옮기는 이주 2 | SPEC-114 | TBL-101–TBL-113 | TASK-202 | agent | M | 이주 결과와 nexus.sql의 표·열·키·색인·CHECK가 같으며 실패·동시 적용 뒤 부분 스키마가 남지 않습니다. | done (kodonghui/corthex#91) |
| TASK-254 | 반영 보고를 구별할 메타데이터 보존 | SPEC-133 | TBL-109, API-126 | TASK-203 | agent | S | 변환 3이 스키마 2 데이터를 지키고 내부 마지막 보고만 더합니다. 쓰기 ID 만료 뒤에도 같은 PR의 closed 재보고와 유효하지 않은 첫 closed를 구별합니다. | done |
| TASK-204 | 스냅샷 0.2와 그림 자료 검증 | SPEC-104, SPEC-105, SPEC-109, SPEC-110, SPEC-114 | API-105, TBL-114 | TASK-203 | agent | M | 두 스냅샷 판과 그림 자료의 형식·UTF-8·한도를 검사하고 모르는 스냅샷 필드는 보존하며 그림 자료는 따로 저장합니다. | done |
| TASK-205 | 앞지른 밀기를 막고 보관 커밋 읽기 | SPEC-111, SPEC-112, SPEC-114, SPEC-117, SPEC-118, SPEC-140 | API-105, API-109, TBL-101–TBL-104, TBL-110 | TASK-204, TASK-206 | agent | L | API-105·109의 모든 응답, 겹친 밀기, 저장소 주소, 같은/이전 시각, 바뀌지 않은 그림과 확인 지점을 시험합니다. 앞질러진 밀기는 아무 행도 쓰지 않습니다. | done |
| TASK-206 | 그림 짝짓기와 불일치 정리 | SPEC-120, SPEC-121 | TBL-103, TBL-104 | TASK-204 | agent | M | 다섯 불일치 유형, 삭제된 용어, 명시적 none·예외, 기다리는 그림, 다시 생긴 불일치와 열린 항목 1,000개 한도를 시험합니다. | done |
| TASK-207 | 삭제 전 확인과 프로젝트 삭제 | SPEC-115 | API-108, API-110, TBL-101–TBL-112 | TASK-205 | agent | S | 모든 응답과 제한된 ID·합계를 확인하고 삭제 뒤 어떤 표에도 그 프로젝트 행이 남지 않습니다. | done |
| TASK-208 | 공간·그림·개요·개별 항목 읽기 | SPEC-119, SPEC-123, SPEC-127, SPEC-130, SPEC-133, SPEC-138, SPEC-140 | API-106, API-107, API-111, API-112, API-114–API-117 | TASK-205 | agent | L | 모든 응답과 HEAD, 합계·순서·목록 한도를 확인합니다. 제안 원문은 개별 읽기에만 나옵니다. | done |
| TASK-209 | Access 확인과 주소·역할별 요청 처리 | SPEC-113, SPEC-116 | API-101–API-132 | TASK-201 | agent | M | 실제 로그인 시험의 방법을 쓰고 앱·로그인 종류·주소·메서드·출처·세션 거절의 순서와 무변경을 확인합니다. | done |
| TASK-210 | Problem Details와 안전한 추적 로그 | SPEC-113 | API-101–API-132 | TASK-209 | agent | S | 서버 오류 코드는 계약 목록과 같고 상태·추가 필드·안전한 detail·traceId가 맞습니다. 로그에는 종류와 traceId만 남습니다. | done |
| TASK-211 | 항목·그림에 댓글 달기 | SPEC-126, SPEC-128 | API-118, TBL-105 | TASK-208, TASK-221 | agent | M | 모든 API-118 응답과 수용 기준, 없는 항목·인용문·그림 판·개수·UTF-8 글 바이트 한도를 시험합니다. | done |
| TASK-212 | 답글·답함·결정 요청과 다시 열기 | SPEC-127, SPEC-128, SPEC-132 | API-119, API-120, TBL-105, TBL-106 | TASK-211 | agent | M | 모든 응답을 시험합니다. 사용자만 닫힌 댓글을 다시 열거나 결정을 요청하며 waits·dismissed·클레임 갱신이 맞습니다. | done |
| TASK-213 | 결정 기록과 댓글 닫기 | SPEC-132 | API-121, TBL-105, TBL-107 | TASK-212 | agent | S | 모든 응답을 시험합니다. 에이전트가 사용자 결정을 안전한 HTTPS 링크로 기록하며 열린 댓글은 원자적으로 닫고 닫힌 댓글은 상태를 지킵니다. 세션에서 한 결정은 먼저 끝맺음 답글을 남길 필요가 없습니다. | done |
| TASK-214 | 제안 만들기와 철회 | SPEC-130 | API-122, API-123, TBL-108 | TASK-211, TASK-221 | agent | M | 모든 응답에서 대상·새 항목·원문·한 답변 대상·한도·클레임·반복 철회를 확인합니다. | done |
| TASK-215 | 제안 수락과 기각 | SPEC-131 | API-124, API-125, TBL-108, TBL-109 | TASK-214 | agent | M | 모든 응답에서 사용자 수락이 반영 하나만 만들고 한도가 원자적으로 적용되며 기각이 댓글의 기다림을 바꿉니다. | done |
| TASK-216 | 반영 보고와 취소 | SPEC-133 | API-126, API-127, TBL-109 | TASK-215, TASK-254 | agent | M | 상태·사건·PR 조합별 응답과 반복 보고·다른 PR·needs-user·클레임 해제를 모두 시험합니다. | done |
| TASK-217 | 순서가 있는 에이전트 할 일 읽기 | SPEC-135, SPEC-136, SPEC-140 | API-113 | TASK-208, TASK-216, TASK-220 | agent | M | 모든 응답, 묶음 순서·합계·기다림·mine/taken·검토 중 PR의 점유를 두 세션으로 확인합니다. | done |
| TASK-218 | 세션별 클레임과 해제 | SPEC-136 | API-131, API-132, TBL-111 | TASK-221 | agent | M | 두 세션·기한·갱신·닫힌 항목·보고된 PR의 모든 응답을 확인하며 실패한 클레임은 outbox에 두지 않습니다. | done |
| TASK-219 | 단계 확인 지점 통과와 철회 | SPEC-139 | API-128, API-129, TBL-110 | TASK-208, TASK-221 | agent | M | 모든 응답에서 기본 커밋 없음·없는 부분/단계·반복 철회·기록된 확인 지점을 확인합니다. | done |
| TASK-220 | 확인 지점 기록 PR과 경고 | SPEC-140 | API-130, TBL-110 | TASK-219 | agent | M | 모든 보고 응답을 확인합니다. 검토 중 철회와 잘못 병합된 기록은 고칠 때까지 할 일과 checkpoint-withdrawn에 남습니다. | done |
| TASK-221 | 7일 쓰기 기록과 원자적 재전송 | SPEC-126–SPEC-133, SPEC-136, SPEC-139, SPEC-140 | TBL-102, TBL-111, TBL-112 | TASK-203, TASK-209, TASK-210 | agent | L | 새 쓰기 ID와 클레임·상태·한도가 한 batch의 쓰기를 지킵니다. 재전송은 첫 상태/본문을 돌려주고 기한·동시 중복에도 한 번만 바뀝니다. | done |
| TASK-222 | HTML 거절 화면과 안전한 코드 제공 | SPEC-113, SPEC-119, SPEC-138 | API-101–API-104 | TASK-209, TASK-210 | agent | M | 브라우저 Accept는 서버 언어의 한 장 HTML을 받고 API·코드는 Problem Details를 받습니다. 헤더·HEAD·내용 해시 캐시를 확인합니다. | done |

## 먼저 하는 시험

| ID | 작업 | 근거 | 건드리는 곳 | 선행 작업 | 담당 | 크기 | 끝났다고 볼 때 | 상태 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TASK-223 | OVH 최대 밀기의 처리와 메모리 측정 | SPEC-114, SPEC-118, SPEC-121 | REQ-081, REQ-124, API-105 | TASK-205 | agent | M | OVH 개발 서버에서 합성1,000,000바이트·항목3,000·검사2,000·그림3개의 서버 처리 시간과 메모리를 기록하고 처리는1초 안입니다. 이전 Workers 83ms 결과를 보존합니다. 처리1초는 본문 전체 수신 뒤부터 응답 처리 완료까지이며 수신/왕복은 별도 참고입니다. | done |
| TASK-224 | 모바일 편집기·CSP·Worker 크기 시험 | SPEC-119 | REQ-146–REQ-149, API-104 | TASK-222 | agent | L | 편집기/React 판·라이선스, 서버에서 주는 코드·글꼴, 압축 전후 크기와 현재 Worker 한도·CSP를 기록합니다. 모바일 4G에서 300요소를 20번 열어 P95 3초를 재며 초과는 판단을 받습니다. | done |

## 허브

| ID | 작업 | 근거 | 건드리는 곳 | 선행 작업 | 담당 | 크기 | 끝났다고 볼 때 | 상태 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TASK-225 | 기본 브랜치 Git 객체와 부분별 문서 읽기 | SPEC-104, SPEC-105 | API-133, TBL-114 | none | agent | M | 작업 브랜치·미커밋 글은 그림에 들어가지 않습니다. 원격 주소·기본 커밋·시각·가장 긴 부분 이름·생략 검사를 훅/필터 실행 없이 확인합니다. | done |
| TASK-226 | DDD 보드와 타임라인 읽기 | SPEC-106 | API-133, TBL-114 | TASK-225 | agent | M | 영어·한국어 틀과 NEXUS에서 맥락·명령/정책·애그리거트/읽기 모델/용어·의존·핫스팟·다섯 타임라인 흐름을 읽습니다. | done |
| TASK-227 | ERD SQL 그림 자료 읽기 | SPEC-107 | API-133, TBL-114 | TASK-225 | agent | M | 틀과 nexus.sql의 열 형식/NULL·PK/UNIQUE/FK·부분 색인·맥락/용어·without_table 예외를 읽습니다. | done |
| TASK-228 | 중첩 사이트맵 그림 자료 읽기 | SPEC-108 | API-133, TBL-114 | TASK-225 | agent | M | 표준 라이브러리로 부모·주소/권한/흐름/상태·맥락/용어/none·without_screen·일부만 읽은 검사를 보존합니다. | done |
| TASK-229 | 기본 브랜치의 단계 기록 읽기 | SPEC-109 | API-133, TBL-115, TBL-116 | TASK-225 | agent | M | 부분별 저장소 기록이 기기 상태를 대신합니다. 잘못된 기록은 검사와 unknown으로 남고 대체 출처가 보이며 done은 날짜 있는 확인 지점이 필요합니다. | done |
| TASK-230 | 설정·가림·스냅샷 한도 | SPEC-104, SPEC-110 | API-133, TBL-114 | TASK-226, TASK-227, TASK-228, TASK-229 | agent | M | 0.2 형식과 새 검사를 확인합니다. 기본 ask_before는 코어 예시와 같고 큰 그림 전체부터 뺀 뒤 항목/검사를 줄이며 경로/비밀은 보내지 않습니다. | done |
| TASK-231 | status로 저장소 단계 기록 쓰기 | SPEC-109, SPEC-137, SPEC-140 | API-134, TBL-115 | TASK-229 | agent | M | 부분·대체 상태·확인 지점 목록·NEXUS 링크의 모든 결과를 시험합니다. LF JSON 원자적 쓰기는 다른 부분을 지키고 커밋·밀기를 하지 않습니다. | done |
| TASK-232 | 조상 관계로 밀고 삭제 전 확인하기 | SPEC-111, SPEC-112, SPEC-115 | API-136, API-137 | TASK-230, TASK-233, TASK-234 | agent | M | 보관 스냅샷 없음·같음/자식/조상/갈라짐/커밋 없음·부모자식 같은 시각·replace-held·0.1 서버 거절의 명령 결과를 모두 확인합니다. | done |
| TASK-233 | 안전한 HTTP·세션·JSON 결과 | SPEC-128, SPEC-135 | API-136–API-150 | none | agent | M | 리디렉션을 따라가지 않습니다. 설정된 주소/프로젝트에만 토큰을 보내며 세션·글·파일을 검사/가리고 문서의 결과·종료 코드를 냅니다. | done |
| TASK-234 | 7일 outbox 저장과 전송 | SPEC-129 | API-150, TBL-117 | TASK-233 | agent | M | 재시도 상태·토큰/네트워크 실패·기한·영구 거절·오래된 순서·재실패 시 멈춤·두 허브의 잠금을 시험하고 파일에 인증값이 없습니다. | done |
| TASK-235 | 에이전트 명령과 참조 문서 | SPEC-127–SPEC-133, SPEC-135, SPEC-136, SPEC-140 | API-138–API-149 | TASK-233, TASK-234 | agent | L | 모든 명령/결과를 시험하고 OutboxFile 요청 이름을 계약과 맞대며 snapshot.md·reading.md·허브 스킬을 0.2로 맞춥니다. | done |

## 화면

| ID | 작업 | 근거 | 건드리는 곳 | 선행 작업 | 담당 | 크기 | 끝났다고 볼 때 | 상태 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TASK-236 | 고정한 토큰으로 CSS 속성 만들기 | SPEC-119, SPEC-123, SPEC-138 | SCR-101, SCR-104–SCR-109 | none | agent | S | resolver 순서대로 기본과 테마를 적용합니다. 두 테마와 새 화면의 모든 색·길이를 덮고 대비를 다시 계산합니다. | done |
| TASK-237 | 허브 페이지에 0.2 추가 | SPEC-123, SPEC-124, SPEC-125 | API-101, API-135, SCR-101, SCR-104 | TASK-236, TASK-208, TASK-230 | agent | M | 부분·그림·개수·기록 전/철회 확인 지점·ask_before·빈 서버가 각 상태대로 보입니다. 로컬은 오프라인이며 복사 HTML이 같습니다. | done |
| TASK-238 | 읽기 전용 그림과 대체 항목 목록 | SPEC-119 | API-102, API-104, API-111, SCR-105 | TASK-224, TASK-236 | agent | L | Prism 상태로 그림 셋을 일정하게 그립니다. 편집기 실패에도 접근 가능한 목록과 크기 고정·이름 있는 표시가 남고 이동/확대가 틀 안에 있습니다. | done |
| TASK-239 | DDD 보드의 다섯 스텝 | SPEC-141 | SCR-105 | TASK-238 | agent | M | 타임라인/맥락에서 다섯 배치를 만들고 처음/마지막·타임라인 없음·step 주소를 확인하며 배치를 저장하지 않습니다. | done |
| TASK-240 | 항목·댓글 패널 | SPEC-126, SPEC-127, SPEC-132 | API-114, API-118–API-120, SCR-106, SCR-107 | TASK-238, TASK-243 | agent | M | 모든 상태가 mock 응답을 따르고 주소로 패널을 열고 닫습니다. 두 폭에서 답글/다시 열기/결정 요청이 동작하며 제안 원문을 미리 읽지 않습니다. | done |
| TASK-241 | 제안·반영 패널 | SPEC-130, SPEC-131, SPEC-133 | API-115, API-116, API-124, API-125, API-127, SCR-108 | TASK-238, TASK-243 | agent | M | 모든 제안/반영 상태와 뒤늦은 변경을 Prism으로 시험합니다. 수락/기각 뒤 다시 읽고 PR/반영 상태와 글을 안전하게 보여 줍니다. | done |
| TASK-242 | 단계 개요와 확인 지점 | SPEC-138, SPEC-139, SPEC-140 | API-103, API-112, API-128, API-129, SCR-109 | TASK-236, TASK-243 | agent | M | 개요의 모든 상태, 기록된 상태와 기록 전 확인 지점, 철회·경고가 두 폭에서 계약을 따릅니다. | done |
| TASK-243 | 작성 중 글·쓰기 ID·요청 복구 | SPEC-126, SPEC-127, SPEC-131, SPEC-139 | SCR-105–SCR-109 | TASK-236 | agent | M | manual 리디렉션·30초 중단을 씁니다. 글+쓰기 ID가 재열기 뒤 남고 잃은 응답의 재시도는 하나만 만들며 opaqueredirect/401·상태 충돌 뒤 글을 지킵니다. | in progress |

## C1 뒤 코어

| ID | 작업 | 근거 | 건드리는 곳 | 선행 작업 | 담당 | 크기 | 끝났다고 볼 때 | 상태 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TASK-244 | 입구·단계 스킬에서 에이전트 할 일 읽기 | SPEC-112, SPEC-135, SPEC-136 | REQ-181, REQ-185, plugins/corthex | C1 0.2.0 tag, PR C, PR D (kodonghui/corthex#83), TASK-235 | agent | M | 최신 main을 먼저 받습니다. 세션/프로젝트마다 한 번 할 일을 읽고 명시적 사용자 작업을 우선하며 토큰이 없어도 계속하고 클레임/PR 점유를 지킵니다. | done |
| TASK-245 | 단계 기록·반영·타임라인 절차 | SPEC-106, SPEC-132, SPEC-133, SPEC-137, SPEC-140 | REQ-086, REQ-131, REQ-154, REQ-167, REQ-168, REQ-212 | TASK-244, TASK-231 | agent | M | 단계 참조·필요한 stage-contract·허브 단계 표·틀 시험을 함께 고칩니다. 작업/확인 지점을 PR로 기록하고 병합 전에 여전히 유효한지 확인합니다. | done |
| TASK-246 | 프로젝트 parts·ask_before 문서 | SPEC-110, SPEC-137 | plugins/corthex, .corthex/project.json, TBL-115 | TASK-244 | agent | S | PR C 이후 부분/ask_before·사이트맵 term/status를 맞춥니다. 원본 분리에 따라 상위 memory/제품 nexus만 선언하고 검증된 MEMORY 상태와 미기록/미확인을 보존합니다. | done |

## 통합

| ID | 작업 | 근거 | 건드리는 곳 | 선행 작업 | 담당 | 크기 | 끝났다고 볼 때 | 상태 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TASK-247 | 버전·안내서·아키텍처 | SPEC-113, SPEC-137 | REQ-126, manifests, README pairs, NOTICE | TASK-245, TASK-246, TASK-237, TASK-242 | agent | M | NEXUS 0.2.0과 최신 main 다음 코어 판이 매니페스트·모든 스킬에서 같습니다. 두 언어 안내서에 개발·이주·서버 먼저 갱신을 쓰며 운영 배포/태그는 기다립니다. | done |
| TASK-253 | 최신 main에 맞추고 출시 근거 넘기기 | SPEC-104–SPEC-141 | docs/10-wbs/nexus.md, docs/12-qa/nexus.md, draft PR | TASK-247, TASK-249, TASK-250, TASK-251, TASK-252 | agent | M | 작업·사례 원본과 Notion이 같고 최신 main 검사 트리를 적습니다. 2026-11-04 조건부 승인에 따라 모든 관문 통과 시 출시합니다. 남은 문제와 묶음 PR을 적고 저장소 첫 보내기는 REQ-107 확인을 받습니다. | done |

## QA

| ID | 작업 | 근거 | 건드리는 곳 | 선행 작업 | 담당 | 크기 | 끝났다고 볼 때 | 상태 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TASK-248 | 고정 판 계약 검사와 mock 실행 | SPEC-113–SPEC-140 | API-101–API-132 | TASK-222 | agent | M | 저장소 밖 고정 판 validator 0.7.1·Prism 5.16.0·Schemathesis 3.39.16과 쿠키/경로/헤더 hook을 씁니다. 개발 계약 시험은 커밋을 적고 mock만의 결과를 나눕니다. | done |
| TASK-249 | 서버의 이름 붙은 응답 모두 보내기 | SPEC-104–SPEC-140 | API-101–API-132 | TASK-217, TASK-218, TASK-220, TASK-248 | agent | L | 가능한 모든 이름 붙은 예시를 개발 서버에서 보내 스키마·코드·데이터 효과를 확인합니다. default/internal의 mock 사례는 따로 셉니다. | done |
| TASK-250 | 세 운영체제의 허브 명령 검증 | SPEC-104–SPEC-140 | API-133–API-150 | TASK-231, TASK-232, TASK-235 | agent | M | Windows/macOS/Linux에서 Python 3.8과 최신 판의 모든 명령 결과가 통과하며 네트워크/토큰 없는 시험의 격리가 유지됩니다. | done |
| TASK-251 | 흐름과 모든 화면 상태 걷기 | SPEC-119, SPEC-123–SPEC-141 | FL-101–FL-114, SCR-101–SCR-109 | TASK-237, TASK-239, TASK-240, TASK-241, TASK-242, TASK-249 | agent | L | 브라우저 시험자가 역할·경로·커밋과 320/1440·두 테마/언어의 근거를 남깁니다. 페이지 검사와 이미지 확인을 나누고 작동한 경로를 CI e2e로 만듭니다. | in progress |
| TASK-252 | 성능과 NEXUS 자신의 그림 맞대기 | SPEC-106, SPEC-107, SPEC-108, SPEC-119, SPEC-120 | REQ-124, REQ-149 | TASK-223, TASK-224, TASK-251 | agent | M | 20번의 원래 값·P95, Worker/편집기 크기와 최대 밀기를 기록합니다. 가상 자료와 NEXUS 자신의 로컬 그림을 확인하며 저장소는 허락 없이 보내지 않습니다. | done |

## 결과

서버 요청의 선언된 응답을 모두 적었습니다. QA는 각 응답의 이름 붙은 예시까지 나누며 mock만으로 보는 internal은 실제 서버 통과로 세지 않습니다.

| 인터페이스 | 요청 | 응답 | 시험 작성 작업 |
| --- | --- | --- | --- |
| API-101 | GET / | 200, 403, default | TASK-237 |
| API-102 | GET /pictures/{project}/{part}/{stage} | 200, 403, 404, default | TASK-238 |
| API-103 | GET /overview/{project}/{part}/{stage} | 200, 403, 404, default | TASK-242 |
| API-104 | GET /code/{file} | 200, 403, 404, default | TASK-222 |
| API-105 | POST /api/snapshots | 200, 400, 403, 409, 413, 415, default | TASK-205 |
| API-106 | GET /api/snapshots | 200, 403, default | TASK-208 |
| API-107 | GET /api/snapshots/{project} | 200, 403, 404, default | TASK-208 |
| API-108 | DELETE /api/snapshots/{project} | 200, 403, 404, default | TASK-207 |
| API-109 | GET /api/snapshots/{project}/held | 200, 403, 404, default | TASK-205 |
| API-110 | GET /api/snapshots/{project}/removal | 200, 403, 404, default | TASK-207 |
| API-111 | GET /api/spaces/{project}/pictures/{part}/{stage} | 200, 403, 404, default | TASK-208 |
| API-112 | GET /api/spaces/{project}/overview/{part}/{stage} | 200, 403, 404, default | TASK-208 |
| API-113 | GET /api/spaces/{project}/todo | 200, 400, 403, 404, default | TASK-217 |
| API-118 | POST /api/spaces/{project}/comments | 201, 400, 403, 404, 409, 413, 415, default | TASK-211 |
| API-114 | GET /api/spaces/{project}/comments/{comment} | 200, 403, 404, default | TASK-208 |
| API-119 | POST /api/spaces/{project}/comments/{comment}/replies | 201, 400, 403, 404, 409, 413, 415, default | TASK-212 |
| API-120 | POST /api/spaces/{project}/comments/{comment}/answered | 200, 400, 403, 404, 409, default | TASK-212 |
| API-121 | POST /api/spaces/{project}/comments/{comment}/decisions | 201, 400, 403, 404, 409, 413, 415, default | TASK-213 |
| API-122 | POST /api/spaces/{project}/proposals | 201, 400, 403, 404, 409, 413, 415, default | TASK-214 |
| API-115 | GET /api/spaces/{project}/proposals/{proposal} | 200, 403, 404, default | TASK-208 |
| API-123 | POST /api/spaces/{project}/proposals/{proposal}/withdraw | 200, 400, 403, 404, 409, default | TASK-214 |
| API-124 | POST /api/spaces/{project}/proposals/{proposal}/accept | 200, 400, 403, 404, 409, default | TASK-215 |
| API-125 | POST /api/spaces/{project}/proposals/{proposal}/dismiss | 200, 400, 403, 404, 409, default | TASK-215 |
| API-116 | GET /api/spaces/{project}/edits/{edit} | 200, 403, 404, default | TASK-208 |
| API-126 | POST /api/spaces/{project}/edits/{edit}/report | 200, 400, 403, 404, 409, 413, 415, default | TASK-216 |
| API-127 | POST /api/spaces/{project}/edits/{edit}/dismiss | 200, 400, 403, 404, 409, default | TASK-216 |
| API-128 | POST /api/spaces/{project}/checkpoints | 201, 400, 403, 404, 409, 413, 415, default | TASK-219 |
| API-117 | GET /api/spaces/{project}/checkpoints/{checkpoint} | 200, 403, 404, default | TASK-208 |
| API-129 | POST /api/spaces/{project}/checkpoints/{checkpoint}/withdraw | 200, 400, 403, 404, 409, default | TASK-219 |
| API-130 | POST /api/spaces/{project}/checkpoints/{checkpoint}/report | 200, 400, 403, 404, 409, 413, 415, default | TASK-220 |
| API-131 | POST /api/spaces/{project}/claims/{entry} | 200, 400, 403, 404, 409, default | TASK-218 |
| API-132 | DELETE /api/spaces/{project}/claims/{entry} | 200, 400, 403, 404, 409, default | TASK-218 |

| 인터페이스 | 명령 | 결과 | 시험 작성 작업 |
| --- | --- | --- | --- |
| API-133 | snapshot | done, 잘못된 명령줄, failed | TASK-230 |
| API-134 | status | done, 잘못된 명령줄, failed | TASK-231 |
| API-135 | build | done, 잘못된 명령줄, failed | TASK-237 |
| API-136 | push | done, 잘못된 명령줄, failed, refused | TASK-232 |
| API-137 | remove | done, 잘못된 명령줄, failed, refused | TASK-232 |
| API-138 | todo | done, 잘못된 명령줄, failed, refused | TASK-235 |
| API-139 | comment | done, 잘못된 명령줄, failed, refused, kept | TASK-235 |
| API-140 | reply | done, 잘못된 명령줄, failed, refused, kept | TASK-235 |
| API-141 | answered | done, 잘못된 명령줄, failed, refused, kept | TASK-235 |
| API-142 | decide | done, 잘못된 명령줄, failed, refused, kept | TASK-235 |
| API-143 | propose | done, 잘못된 명령줄, failed, refused, kept | TASK-235 |
| API-144 | withdraw | done, 잘못된 명령줄, failed, refused, kept | TASK-235 |
| API-145 | reflect | done, 잘못된 명령줄, failed, refused, kept | TASK-235 |
| API-146 | record | done, 잘못된 명령줄, failed, refused, kept | TASK-235 |
| API-147 | show | done, 잘못된 명령줄, failed, refused | TASK-235 |
| API-148 | claim | done, 잘못된 명령줄, failed, refused | TASK-235 |
| API-149 | release | done, 잘못된 명령줄, failed, refused | TASK-235 |
| API-150 | outbox | done, 잘못된 명령줄, failed, refused, kept | TASK-234 |

## 작업이 기다리는 결정

- TASK-209는 TASK-201의 실제 로그인 시험을 기다립니다. ctx.access와 검증한 JWT 모두 두 종류를 가르지 못하면 대안과 함께 관리자에게 돌려드립니다.
- TASK-238은 TASK-224의 모바일·편집기·크기 시험을 기다립니다. 추가 개발 의존·편집기 선택 변경·고정 토큰 변경·성능 초과는 판단을 받고 독립적인 서버/허브 작업을 계속합니다.
- TASK-244–247은 main의 corthex-memory--v0.2.0 태그·PR C·PR D(kodonghui/corthex#83)를 기다립니다.
- TASK-253은 QA 전체 근거와 2026-11-04 조건부 출시 관문을 기다립니다. 전부 통과하면 기존 승인대로 main 병합·운영 전환·태그를 다시 묻지 않고 진행합니다. 저장소 첫 보내기는 REQ-107을 따르고 보관한 Worker·D1 삭제는 나중의 별도 결정을 받습니다.

## 이 단계가 고른 것

1. 원본은 nexus.md, 짝은 nexus.ko.md이며 Notion 한국어 사본은 작업·사례마다 한 DB 행입니다.
2. 서버·허브·화면·C1 뒤 코어·QA를 나누어 리뷰하고 크기를 넘으면 구현 전에 다시 나눕니다.
3. 가상 프로젝트를 쓰고 자신의 그림은 로컬에서 맞댑니다. 저장소 전송은 REQ-107을 기다립니다.
4. 인증값은 이 호스트의 환경변수·비밀 저장소에만 두고 Aside가 계정 작업을 합니다. 키·쿠키·인증파일은 다른 기기로 복사하지 않습니다.
5. 고정된 04 행·05 스키마·06 계약·09 토큰을 지킵니다. 뜻을 지키는 설명은 코드 전에 양쪽 문서를 고치고 깨는 변경은 관리자를 기다립니다.

## 확인할 것

2026-11-04 승인: 관리자는 이 대화의 OVH 답변과 저장소 분리 후속 지시(A안), 그리고 계획 결정 카드의 “이 계획대로 진행”으로 이번 반복을 승인했습니다. 원래54개(S 7/M 39/L 8)에 TASK-255–264를 더해64개(S 7/M 47/L 10), QA710개입니다. 순서는 분리 → 새 제품의 계획·계약 → 독립 서버 → 화면 → 전체 QA입니다. 코어는 C1·PR C·PR D 뒤, SPEC-134/142는 단계②입니다. 08:08 KST에 기록한 마지막 출시 재확인 조건은 14:21 KST의 조건부 승인으로 대체했습니다. 전부 통과하면 main 병합·운영 전환·태그를 진행하며, REQ-107 첫 보내기와 나중의 기존 자원 삭제는 별도 결정으로 남습니다. 승인 메시지와 상세 시각은 비공개 작업 기록에 둡니다.

## 다음 단계를 위한 메모

### 11단계: 개발

묶음별 브랜치는 codex/nexus-0.2에서 따고 TASK/SPEC·한 시험·안 한 시험·설계 변경을 PR에 적습니다. 통합 브랜치를 먼저 push하고 원본 변경이 생기면 main 쪽 draft를 엽니다. 완료 상태는 그 PR에서 Git을 먼저 고치고 보드가 따릅니다. 공용 파일과 인계 전에 origin/main을 merge commit으로 받습니다.

### 12단계: QA

개발 Access 뒤에서 [계획](../12-qa/nexus.ko.md)을 돌리고 통과마다 커밋·환경·근거를 적습니다. 브라우저 시험자가 단계 ① 흐름을 걷고 작동한 경로를 e2e로 고정합니다. 실제 응답·mock만의 응답·페이지 측정·이미지 검토를 나누고 출시는 기다립니다.

## 화면 통합 전 서버 기반 기록

TASK-204–TASK-224와 TASK-254는 진행 중입니다. 서버 요청 처리와 트랜잭션의 로컬 시험, 가상 프로젝트의 개발 서버 확인을 했으나 응답별 계약 전체·편집기 시험·화면은 남았습니다. QA 근거를 따르며 시험 개수로 API 제공이나 화면 인수를 추정하지 않습니다.

서버 기반 묶음 kodonghui/corthex#91(이주)·kodonghui/corthex#92(Access)·kodonghui/corthex#93(요청 처리·트랜잭션)은 개발 통합 브랜치에 병합했습니다. #93의 마지막 커밋 5070de8은 workflow41684359822에서 세 운영체제·Worker 빌드·strict 플러그인 검사·외부 계약 제어와 응답 모음·종합 검사가 모두 통과했습니다. 리뷰 논의를 처리한 뒤 c5e7308로 병합했으며 main 출시 조건은 그대로입니다.

TASK-225–TASK-235는 진행 중입니다. 허브 원본에 0.2 Git 객체 읽기·그림 파서·저장소 status·조상 검사·18개 명령·이전 소유자를 막는 보낼 편지함을 연결했습니다. 경계 시험과 외부 스키마 검사를 로컬에서 돌리며, 묶음 병합 전 최종 리뷰와 Python 3.8·최신판의 세 운영체제 검사가 통과해야 합니다. 시제품이나 명령 개수 확인만으로 작업을 완료 표시하지 않습니다.

## Development checkpoint of 2026-11-04

제품 원본에 독립 서버, 읽기 전용 그림 세 종류, 항목·의견·제안 패널, 단계 현황과 확인 지점 동작을 구현했습니다(TASK-236–TASK-243). 승인된 고정 브라우저 패키지와 전체 NOTICE를 사용하며 서버 실행 의존성은 없습니다. 허브 화면은 kodonghui/corthex#103에서 별도로 검토하고, 원본 저장소 정리는 kodonghui/corthex#102로 병합했습니다.

로컬 브라우저 검사는 합성 Access와 실제 handler·Store, 메모리 SQLite로 실행합니다. 보존한 03E31C·B17B3C 묶음에서 포인터·초안·경합 회귀 다섯 개를 통과했고, 03E31C에서 그림·화면 폭 조합 열두 개를 확인했습니다. 이후 의견 화면 수정과 실제 OVH 성능은 별도 회차이며, 앞선 통과로 대신하지 않습니다. 초기 맞춤·마크 가림·언어·넘침 실패와 하네스 실패도 보존했습니다.

독립 API 감사는 TC ID를 그대로 두고 명명 예제 411개를 대응했습니다. 예제 스키마는 맞지만 실제 handler에서 관측한 명명 variant는232개, default 제어 검사와의 합집합은270/411입니다. 미관측141개와 적용 조건을 명확히 해야 할 공유 예제11개가 남습니다. CI용 시험 둘은32개 동작 전체에 성공·상태 요청47개와 권한·헤더 거절 요청138개를 더하며 DB 불변도 확인합니다. 요청 수를 완전 통과 TC 수로 세지 않습니다.

8CC00C 묶음에서 Node120개, Python 연결·공개 검사9개, Worker 빌드와 고정 외부 검사7개를 통과했습니다. 독립 서버 Schemathesis는32개 동작과154개 응답에 검사 다섯 종류를 각각 통과했습니다. 합성 검사는 실제 로그인 시험·원 서버 DB 이주 연습과 구분합니다. 이후 UI 수정은 커밋 전에 다시 검사합니다.

배포는 개발 서버에 한정합니다. 코어 변경은 MEMORY C1·PR C·PR D가 main에 들어간 뒤 진행합니다. main 병합, 운영 주소·데이터 전환, 릴리스 태그, 실제 저장소 첫 업로드, 이전 자원 정리는 출시 결정에 남습니다.


## 동결 화면 묶음 확인

최종 CAF432 화면을 재현하고 Python9·Node121·Worker·외부7검사와 정확한 묶음 브라우저34경로를 통과했습니다. API 명명 근거는 handler355개·합집합393개이며 공유 예제18개의 적용 범위는 따로 적었습니다. 화면·API 구현은 존재하며 완료 PR의 통합과 남은 실제/상태 수용 검사를 앞두고 작업은 진행 중으로 둡니다. 연결 허브3570fb0은 CI17개 통과·코드/보안 지적 없음입니다. [범위를 구분한 QA](../12-qa/runs/2026-11-04-product-development.ko.md)에 기존 실패·F260 정상48조합·선정 캡처를 보존합니다. 코어 선행 조건과 출시 결정을 유지합니다.

## OVH validation checkpoint

저장소 분리·고정 허브 연결·제품 CI와 보호, 독립 실행부·실제 두 신원, 원 서버 복구/이주 리허설 근거를 완료 PR에 기록했습니다. 성능·최종 화면 수용과 SSH 되돌리기는 별도 검증 중입니다. [QA](../12-qa/runs/2026-11-04-ovh-validation.ko.md)

## 2026-11-04 개발 결과

서버·허브와 단계① 브라우저 구현을 개발 통합에 반영했습니다. 마지막 독립 소스 감사에서 승인 범위 안의 추가 제품 기능 누락은 찾지 못했습니다. 진행 중인 수용 사례를 전체710개 통과로 읽지 않습니다. TASK-244–247 코어는 명시된 선행 조건을 기다리며 직접 편집·워크숍은 단계②입니다. 실제 개발 배포는30f7957이고 CA4 화면 바이트는 같습니다. TASK-261은 불변 배포·구/신 실행부 되돌리기·13테이블 논리 데이터 불변·다른22개 서비스 PID와 시작시각 불변까지 확인해 완료했습니다.

실제 사람 세션에서 의견·답글·Answered·재열기, 제안 받기→반영 전, 확인 지점 통과→철회의 세 성공 흐름·일곱 쓰기를 API 재조회와 대조했습니다. 로컬 fixture나 전체 화면 상태 행렬과 구분합니다. 프록시 힌트 실험은 모바일 목표에 못 미쳐 zone 전체 스위치와 이번 서버 힌트·계측 설정을 원상복구했습니다. [최종 범위별 QA](../12-qa/runs/2026-11-04-ovh-validation.ko.md)에 실패 표본과 마지막 기본 설정 측정을 보존합니다. main·출시와 첫 실제 프로젝트 업로드는 최종 결정입니다.

ce6875a 당시 작업 상태: done 12, in progress 46, todo 6.

## 2026-11-04 전송·계측·출시 결정

관리자는 REQ-147의 같은 출처를 유지하면서 공개 내용 해시 코드·스타일·글꼴의 거점 캐시를 승인했습니다. HTML·API·프로젝트 자료·거절 응답은 no-store입니다. 코드 응답에는 Set-Cookie와 Vary:*가 없고 CSP와 전체 호스트 Access를 유지합니다. 캐시 HIT도 미인증 GET/HEAD에 코드를 전달하지 않아야 합니다. 거점 HIT는 원 서버에 닿지 않으므로 원 서버 검증을 매 HIT마다 실행했다고 주장하지 않습니다.

REQ-124의 서버 처리 시간은 본문을 모두 받은 뒤부터 응답 처리 완료까지입니다. 본문 수신·왕복·CPU 구간·RSS는 따로 기록합니다. 기존31.085ms는1초 기준 통과이며 과거 전체1031.079ms는 그대로 보존합니다.

관리자는 REQ-149와 REQ-124 통과,710사례 전부 판정·Must 실패0,운영 자료 이전/복구 리허설, C1 출시·PR C 뒤의 코어 통합,필수 검사와 Code/Security 리뷰를 조건으로 NEXUS 병합·운영 전환·출시 태그를 사전 승인했습니다. 이 저장소 첫 보내기는 REQ-107의 별도 확인입니다. 이전 Worker/D1은 전환 뒤14일 보존하고 삭제는 다시 묻습니다. 조건이 남으면 수치로 한 번 묻고 답 뒤 출시합니다.

이전 전송 변경 묶음의 상태: done 14, in progress 44, todo 6.

## 첫 그림 표시 결정, 2026-11-04

관리자가 현재 Codex 대화에서 “SVG 먼저 표시 + HTML 경로 개선 (추천)”을 명시적으로 선택했습니다. 고정 토큰, 같은 출처의 Access 경계와 실제 편집기 핀을 유지합니다. 서버에서 그린 완전한 SVG를 첫 그림으로 보여주고 Excalidraw/ERD Viewer를 이어 불러옵니다. REQ-149·TC-654·TC-1271·TC-1309는 기존 모바일·회선·CPU1 조건에서 이 첫 그림이 실제로 보인 시간을 잽니다. 편집기 준비 시간은 별도로 적고 이전 편집기 준비 실패와 미완료·계측 실패를 모두 보존합니다. DOM 준비 표시만으로 그림이 보이고 읽힌다고 판단하지 않습니다.

미리보기는 편집기와 같은 결정적 배치와 검사된 원본을 사용합니다. 글자·같은 페이지 링크를 안전하게 쓰며 SVG 스크립트·외부 콘텐츠·외부 자원은 넣지 않습니다. 편집기가 준비되는 동안 그림을 유지하고, 실패해도 미리보기와 항목 목록을 사용할 수 있습니다. 기본 화면 기능에서 실제 편집기로 넘어갈 때 현재 보고 있는 영역을 유지합니다. 불러오는 동안 프레임과 주변 배치를 유지하고 첫 미리보기와 편집기 준비 상태·시간을 구분합니다.

신뢰하는 고정 화면 CSS는 HTML 안에 넣어 스타일 요청이 미리보기를 막지 않게 할 수 있습니다. HTML·프로젝트 SVG·API 자료는 no-store를 유지하고 해시 코드·스타일·글꼴은 승인된 Access 보호 public immutable 캐시를 씁니다. 독립 서버는 내장 기능으로 크기를 제한해 HTML 압축을 협상하고 Tunnel 전송량을 줄일 수 있습니다. 프로젝트 자료를 공개 코드 파일이나 캐시에 넣지 않습니다. 이 결정과 미리보기는 출시·첫 실제 저장소 전송·Worker/D1 삭제 승인이 아니며 기존 조건부 출시 기준을 유지합니다.

이전 TASK-250 확인 지점: 빠진 CLI 결과59개를 원 TC별 메서드로 연결했습니다. Windows Python3.8/3.13 각각59/59였고 당시 Linux·macOS의 새 CI는 대기 중이었습니다.65개 backend partial 정리와 첫 SVG 후보 결함은 [QA 묶음](../12-qa/runs/2026-11-04-acceptance-audit.ko.md)에 보존합니다.

앞선 확인 지점의 근거(2026-11-04): core0.7 후보 d997b688/PR120, 전체1039·기존skip15·strict4·소스 Code/Security0. CLI62통과/16잔여 절 보완, 실제모델·자기저장소·모바일60 및 Brotli 전송 실험은 [범위 기록](../12-qa/runs/2026-11-04-acceptance-scopes.ko.md). 작업64=done14/in progress50/todo0이며 출시 단계는 기존 조건 뒤입니다.

현재64개 작업: done15/in progress49/todo0. TASK-250의 원CLI78개 조건에 개별 명명 근거가 있고 남은16개도 PR122의 실제OS/Python6셀을 통과했습니다. 전체1057·엄격4개·범위를 한정한 소스 리뷰를 통과했습니다. 모바일3초는 미달이며 TASK-252/253은 진행 중입니다. [최종 근거](../12-qa/runs/2026-11-04-mobile-final.ko.md). main·운영·태그 승인을 추측하지 않습니다.

## 3초 기준 유지, 2026-11-04

관리자는 이 작업 대화의 성능 결정 카드에서 “3초 유지·개선 계속 (추천)”을 선택했습니다. 사용자 날짜는2026-11-04, 클라이언트 시간대는Asia/Seoul이며 정확한 응답 시각은 미확인입니다. 3초 기준을 유지하며 원인 조사와 개선을 계속하는 승인입니다. 작업64개의15done/49in progress와 TASK-252/253의 진행 상태를 유지하며 새10단계 확인 지점 통과를 기록하지 않습니다.

[전송 진단 제안](../12-qa/runs/2026-11-04-transport-investigation.ko.md)은 연결/TLS·헤더/본문·CDP 회선 제한·프로토콜·압축을 구분한 뒤 작은 수정·회귀 검사·새20×3 정식 측정으로 이어갑니다. 실제 비교안은 도구 검토 후 Root가 고릅니다. 진단 관측으로 기존 실패를 대체하지 않습니다. 조건부 출시·REQ-107·전환 뒤 Worker/D1의14일 보존과 삭제 전 질문·새 유료 요금제/의존성 금지는 그대로입니다.

## 진단 후속 기록, 2026-11-05 KST / 2026-11-04 UTC

결정 기록 e750509 뒤 별도 Node16·Chrome18 전송 진단을 마치고 소유 프로세스0을 반환했습니다. Node는 전송 유효16개 중 캐시 비교 가능13개, Chrome은 진단 적격18개를 보존합니다. [후속 기록](../12-qa/runs/2026-11-04-transport-investigation.ko.md)과 [안전 요약 manifest](../12-qa/runs/transport-2026-11-05/manifest.json)에 범위·해시·읽기 전용 Cloudflare 확인을 남깁니다. 전송 관측이며 새3초/P95·출시 판정이 아닙니다. 작업64행의15done/49in progress와 TASK-252/253의 진행 상태를 유지합니다.

실제 module6 후속 도구는 오프라인 구현 중이며 Root GO 전입니다. 현재 소유는 후속 기록에 적었습니다. Root는 서버/Cloudflare/브랜치/관문, UI는 runner와 나머지 도구 파일, API는 `module-wire.mjs` 한 파일, QA는 기록과 독립 감사를 맡습니다. 확인 지점·지연 예외·기존 출시/REQ-107/Worker-D1 조건을 바꾸지 않습니다.

## M01/v5 보존과 다음 v6 준비, 2026-11-05 KST / 2026-11-04 UTC

앞의 준비 상태는 당시 기록으로 보존합니다. 이후 M01은 예정6회 중5회를 관측하고 slot5 정리 미확인으로 중단했으며 slot6은 시작하지 않았습니다. 나중의 소유 프로세스0 영수증으로 그 실패를 지우지 않습니다. 이어 v5는60회를 모두 관측하고 정리60/60을 확인했지만 원래 적격 판정은 DDD17/20·ERD17/20·사이트맵16/20, 정식P95는 모두null입니다. 무효10회 중9회는 캐시 조건만이고1회에는 실제code520/자원실패도 있었습니다. 그림마다 정확히 두 번째 열기의 코드44건은 별도로 모두200/EOF/HIT+Age/승인정책/cookie-only를 확인했습니다. 범위를 한정한 캐시 관측이며 새 작업완료·3초 판정이 아닙니다. [근거와 계획](../12-qa/runs/2026-11-04-transport-investigation.ko.md).

Root는 REQ-149/TC-1271/SPEC-119가 첫SVG와 편집기 준비를 구분하는데도 후행 편집기코드의 HIT/Age를 첫 완전SVG의 적격 조건에 넣은 검사 오류를 확인했습니다. 새로 준비할 v6는3초·그림별20회·기존 모바일4G/300요소/auth/CSP/보안정책/200완료/90초/정리 기준을 유지하고 캐시 상태와Age를 별도 기록합니다. v5와 이전 원자료·계획·판정·작업행은 바꾸지 않습니다. 사용자 새 승인이나 지연 예외가 아닌 Root의 검사 교정이며, v6는 준비 중으로 별도 리뷰·관문을 기다립니다. 작업64개의15done/49in progress를 유지하고 확인 지점·출시로 승격하지 않습니다.

## v6 중단 기록, 2026-11-05 KST / 2026-11-04 UTC

이후 승인된 v6는 예정60개를 모두 보존했습니다. 관측29회·설정 실패1회·미시작30회이며 원래 DDD/ERD/사이트맵 적격 수는 각20회 중9/10/9, 정식P95는 모두null,exit1/fail입니다. slot26에는 설정 명령 시간초과, slot30에는 남은 프로세스1개로 정리 미확인이 있었습니다. 나중의 OS영수증은 소유Chrome0/Node0·프로필30개 보존을 기록했으며 두 실패를 다시 판정하지 않습니다. [결과와 안전 해시](../12-qa/runs/2026-11-04-transport-investigation.ko.md).

설정/정리 원인은 아직 미확정입니다. 별도 lifecycle 진단은 오프라인 준비 중이며 대상 진단 실행·v7 정식 결과·사용자 새 승인을 기록하지 않습니다. Root는 계측OFF·Cloudflare 설정을 유지했습니다. 작업64개의15done/49in progress와3초·출시/REQ-107·Worker/D1 조건은 그대로 미완료로 남습니다.

## 현재 거절 응답 정리, 2026-11-05

[R1](../12-qa/runs/2026-11-05-refusal-closure.ko.md)의정확한fresh거절·같은요청schema/헤더/trace/DB/receipt근거로현재합성handler6f범위245개를통과시켜QA710=486pass/222partial/2fail입니다. TASK-249에는적용명명응답78개·공유예시적용검토18개가남아진행중이며완료작업은추가하지않습니다. WBS64=15done/49in progress를유지합니다. 이전성능/전송실패·출시/REQ-107/Worker-D1 조건은그대로이고실제Access/배포근거·사용자새확인지점을주장하지않습니다.

## 현재 명명 읽기 응답 정리, 2026-11-05

이후 [읽기24개 새 판정](../12-qa/runs/2026-11-05-read-closure.ko.md)으로 현재 QA710은 pass510/partial198/fail2입니다. TASK-249는 적용 명명 응답54개·공유 예시 적용 검토18개가 남아 진행 중이며 WBS64행과15done/49in progress는 모두 그대로입니다. 로컬 실제 handler의 GET에서 API별 정책/스키마와 같은 요청 전체 DB/receipt 불변을 확인했습니다. HEAD·기본 SSR·허브 파서·브라우저·배포/실제 Access를 주장하지 않으며 과거 R1/전송/성능 판정과 출시/REQ-107/Worker-D1 관문을 보존합니다. 전체 필수 검사·Code/Security 검토·게시는 Root 소유로 아직 대기 중입니다.

## 원 수용 기준 근거, 2026-11-05

이후 [R3 원본 기록](../12-qa/runs/2026-11-05-original-criteria.ko.md)에서 서로 다른 새 실행 기준4개·정확한 재사용 응답4개로 범위별 통과8개를 더해 원본 QA710은 pass518/partial190/fail2입니다. WBS64행과15done/49in progress는 바꾸지 않았고 완료 작업도 추가하지 않습니다. 파서 자료·literal ALTER/대조군 차이·로컬 역할/상태 거절의 정확한 범위를 유지합니다. 이전 결과/269행 Notion 근거와 단계/출시/3초/REQ-107/Worker-D1 조건은 그대로이며 필수 검사/게시·별도8행 Notion 후속은 Root 소유입니다.

## 이후 API/Job 정식 근거, 2026-11-05

[이후 원본 기록](../12-qa/runs/2026-11-05-api-two-job-formal-r2.ko.md)에서 보존된 정확한 요청 근거로 TC787/1052를 수용하고 v7-r2 정식1회 중단을 남겼습니다. QA710은 pass520/partial188/fail2이며 WBS64개 행과15done/49in progress는 그대로로 완료 작업이 늘지 않습니다. E1의52개 partial과 별도 미판정 공유 예시18개가 남습니다. 정식 실행은 계획60회 중37회만 유효하며 정규P95가 없습니다. 기존 실패와 출시/3초/REQ-107/Worker-D1 조건을 유지하고 이 기록에서 새 실행이나 승인을 추론하지 않습니다.

## 2026-11-05: 모바일 성능 관문과 범위별 근거

새 정식v8에서 현재906/D802의300노드 한국어 그림을 원 모바일4G/CPU1 조건으로 각각20번 완료했습니다. 첫SVG19번째값은DDD1399.2ms·ERD1327.2ms·사이트맵1357.3ms이며60회 보안/엄격한 정리 근거가 있습니다. native준비P95는2784/2686/2873.9ms,표시기회는3159.5/2721.7/3067ms로 분리합니다. 원 CTX012/320틀이동/script제목/응답·데이터불변과 기존TC1128근거는 [범위기록](../12-qa/runs/2026-11-05-svg-mobile-v8.ko.md)에 연결합니다. QA524pass/186partial/0fail이며64작업행15done/49in progress는 그대로입니다. 성능값으로 작업을 닫지 않으며 다른 출시 조건·REQ107 첫전송 동의·Worker/D1 보관 및 삭제 조건은 남습니다.


## 2026-11-05: 근거가 갖춰진 작업 11개 완료

원래 완료 조건과 기존 실제 근거를 대조해 TASK-204/224/225/226/227/228/230/233/234/235/254만 done으로 닫았습니다. 현재 64개 작업은 26done/38in progress입니다. 다른 53행과 모든 ID·완료 조건·나머지 열·이전 이력은 유지합니다. TASK-244/245/246/247/252와 남은 부분 검증은 진행 중입니다. QA 710개 행과 524pass/186partial/0fail 판정도 바꾸지 않습니다. [조건별 완료 근거](../12-qa/runs/2026-11-05-wbs-closure.ko.md)는 새 실행이나 전체 인수·출시 승인을 뜻하지 않습니다. 이주·복구와 다른 출시 관문, 첫 실제 저장소 전송 및 Worker/D1 보관·삭제 조건은 별도로 유지합니다.


## 2026-11-05: 실제 default 자체 그림 완료

source overlay나 업로드 없이 남아 있던 실제 default의 로컬 자체 그림 조건을 확인해 TASK-252를 done으로 닫습니다. 현재64작업은27done/37in progress이며 다른63개 전체 행과 모든 원 비상태 열·이력은 유지합니다. [원본별 기록](../12-qa/runs/2026-11-05-own-main.ko.md)은 새 로컬 정적/메모리 근거와 기존 v8·코드 크기·과거 최대 밀기 기록을 구별합니다. QA710은524pass/186partial/0fail이며 운영 역할/화면이나 제품 전체 인수를 더하지 않았습니다. 첫 실제 저장소 전송과 기존 Worker/D1 삭제의 별도 확인은 남습니다.

## 2026-11-05: 출시 뒤 인수 분류

원진행37작업은 [단일 분류표](../12-qa/runs/2026-11-05-postrelease-closeout.ko.md)에17개 근거 있는 완료·20개 정확한 남은 인수로 정리했으며 이37개 안에 미구현 전체 작업은 없습니다. 원64행은44완료/20진행이고17개 상태 칸만 바꿨습니다. TASK-244~247·TASK-253을 포함합니다. 원완료 조건·ID·다른 열·이력은 보존했습니다. QA는626통과/84부분/0실패입니다. 2단계 FL-115/116은 시작하지 않았으며 운영 새 배포/전송·호스트 플러그인 갱신은 포함하지 않습니다.

## NEXUS 0.2.1 완료 조건 판정 (2026-11-06 KST)

64개 중 62개 완료, 2개 진행입니다. 작업의 완료 조건을 각 시험 근거에 연결하고 이전 상태를 보존했습니다. 2단계는 보류합니다. [마무리 기록](../12-qa/runs/2026-11-05-patch-021-closeout.ko.md)

## NEXUS 0.2.2 편집기 패치 (2026-11-06 KST)

세로 사이트맵의 전체 맞춤과 Windows 브라우저 실행부를 고쳤습니다. 개발 서버 전송 조사 뒤 BUG-562는 열린 상태입니다. 2단계 편집기 설계용 메모를 PR에 올렸습니다. [패치 근거](../12-qa/runs/2026-11-06-patch-022-editor.ko.md) · [편집기 메모 PR](https://github.com/kodonghui/corthex-nexus/pull/47)

## NEXUS 0.2.3 화면 패치 (2026-11-06 KST)

지금 화면의 틀 안에서 읽히게 고쳤습니다: 접힌 허브 점검과 한국어 문구, 먼저 묻기 목록 맞추기, 근거가 있는 단계 기록, 한 줄로 선 항목 없는 DDD 컨텍스트, 페이지를 내리는 휠, 필드·까닭 코드 대신 쓰는 말. 허브 플러그인 변경은 [kodonghui/corthex#155](https://github.com/kodonghui/corthex/pull/155)입니다. 그림 중심 재디자인은 따로 이어집니다. [패치 근거](../12-qa/runs/2026-11-06-patch-023-screens.ko.md)
