# NEXUS 재설계 워크플로

[English](README.md)

사용자님은 2026-11-17 새 13단계 주기를 요청하셨고, 2026-11-18 이 대화에서 설계 끝까지 계속하도록 지시하셨습니다. 진입점은 `/corthex:corthex`, 활성 파트는 rebuild이며 nexus 파트는 참고 이력입니다. [현재 지시](../decisions/rebuild-authorization.ko.md)는 이번 10 WBS까지 단계 사이의 재대기를 대체합니다. 이후 산출물을 이미 개별 검토하셨다고 만들지 않으며 실제 NEXUS 통과를 대신 실행하지 않습니다.

| 단계 | 라우팅 스킬 | 산출물 |
| --- | --- | --- |
| [01 도메인 탐색](../01-domain/rebuild.ko.md) | corthex-discover | 타임라인·5개 컨텍스트·34개 용어·명령·정책·맵·기존 프레임 보존 |
| [02 PRD](../02-prd/rebuild.ko.md) | corthex-define | 활성 요구사항 50개·설계 기준·측정 가능한 완료 조건 |
| [03 유저 플로우](../03-user-flow/rebuild/README.ko.md) | corthex-define | 성공·실패·복구 유저 플로우 9개 |
| [04 기능 명세](../04-functional-spec/rebuild.ko.md) | corthex-define | 권한·예외 조건을 포함한 동작 42개 |
| [05 ERD](../05-erd/rebuild.ko.md) | corthex-contract | 테이블 20개·제약·이전/복구 계약 |
| [06 API](../06-api/rebuild.ko.md) | corthex-contract | HTTP 동작 36개·운영 인터페이스 5개 |
| [07 사이트맵](../07-sitemap/rebuild.ko.md) | corthex-screen | 생성한 보드·목록·슬라이드와 경로 11개 |
| [08 화면 정의](../08-screens/rebuild/README.ko.md) | corthex-screen + corthex-uxui | 화면 11개·상태 91개·응답 매핑 389개 |
| [09 목업](../09-mockup/rebuild/README.ko.md) | corthex-screen + corthex-uxui | 보존한 두 후보·선택한 A 라이트/다크 HTML과 토큰 기준 |
| [10 WBS](../10-wbs/rebuild.ko.md) | corthex-build | 순환 없는 의존성·완료 조건을 갖춘 todo 작업 92개 |
| 11 개발 | corthex-build | 후속: 이번 설계에 따른 구현 PR |
| 12 QA | corthex-build | 후속: 브라우저 에이전트·모든 플로우·이전/복구 근거 |
| 13 발표 | corthex-present + corthex-uxui | 후속: 검증 결과와 명시적인 제한 |

## 게시와 검토 상태

단계별 원본·기록을 PR로 작성하고 필수 검사·검토를 통과해 main에 병합한 뒤 hub push와 별도 체크포인트 요청을 보냅니다. 병합·업로드·서버 보유 커밋·검토 요청 저장을 각각 확인합니다. 현재 게시 진행과 실제 요청 ID·주소는 기존 비공개 프로젝트 기록에서 확인합니다. 이후 사용자님은 default commit `f4f765360a9ffdb32a5e8e5e934be1a7dcea3da9`·스냅샷 버전 32의 [게시된 01~10을 대화에서 모두 승인](../decisions/rebuild-design-approval-2026-11-18.ko.md)하셨습니다. 해당 단계는 done이며 11~13은 not_started를 유지합니다. [실제 단계 기록](../../.corthex/stages/rebuild.json)은 기존 타임라인 이벤트와 출처를 명시한 후속 대화 승인을 보존하며 NEXUS 버튼 이벤트를 만들지 않습니다.

원본의 영어와 한국어 읽기 문서를 함께 유지하고 한국어는 게시 전에 절대 경로의 term-check로 검사합니다. 새 결정은 이전 결정을 지우지 않고 대체 사유를 남깁니다. 공개 레포에는 개인정보·시크릿·비공개 Miro/기록 주소를 넣지 않습니다.

## 실제로 검증한 범위와 후속 작업

원본 검사·계약 예시·목업 측정·샘플 동작 근거는 각 단계에 기록합니다. 09의 816개 렌더·95개 assertion을 실제 서비스 QA로 바꾸어 부르지 않습니다. 공개 인증 설정·새 v2 서버·전체 접근성/성능·세 프로젝트 이전·서버 전용 대화/체크포인트 보존·전환 후 쓰기 복구는 11~12 작업입니다. 새 버전 QA를 통과해 배포할 때까지 기존 운영을 유지합니다. 삭제는 계획하지 않습니다.
