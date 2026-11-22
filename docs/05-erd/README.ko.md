# NEXUS v3: 데이터 스키마

[English](README.md)

이 문서는 [README.md](README.md)의 한국어 사본입니다. 원본은 영어입니다.

상태: 2026-11-23 통과. API 계약 전에 스키마를 동결했습니다.

입력: 2026-11-23 통과하고 고친 기능 명세([spec.ko.md](../04-functional-spec/spec.ko.md)), 도메인 설계의 애그리거트 규칙, 이름은 용어집. 원본은 [db/nexus.sql](../../db/nexus.sql)이고, 표마다 TBL ID, 컨텍스트, 명세 행, 용어가 있습니다. [db/migrations/](../../db/migrations/)가 빈 데이터베이스에서 다시 만들고, NEXUS가 여기서 ERD를 그립니다.

## 1. 테이블

테이블 26개, TBL-146~TBL-171. 보관한 v2가 TBL-145까지 썼습니다.

| 테이블 | 컨텍스트 | 담는 것 |
| --- | --- | --- |
| TBL-146 `agent_credentials` | CTX-043 접근 | 에이전트 자격. 다이제스트로만 두고, 지우지 않고 폐기만 함 |
| TBL-147 `project_spaces` | CTX-037 그림 | 프로젝트 공간. 이름, 저장소, 들고 있는 커밋 |
| TBL-148 `snapshots` | CTX-037 그림 | 에이전트가 보낸 스냅숏. 커밋마다 하나, 리비전 번호와 함께 |
| TBL-149 `document_blobs` | CTX-037 그림 | 단계 문서의 내용. SHA-256으로 한 번만 둠 |
| TBL-150 `snapshot_files` | CTX-037 그림 | 스냅숏이 담은 문서와 그 경로 |
| TBL-151 `diagrams` | CTX-037 그림 | 단계의 그림과 항목 표 |
| TBL-152 `drawings` | CTX-037 그림 | 스냅숏 하나에서 그린 그림. 문서 버전 하나의 그림 |
| TBL-153 `elements` | CTX-037 그림 | 그림의 요소. 추적 ID와 이름 |
| TBL-154 `element_positions` | CTX-037 그림 | 사용자가 옮긴 요소의 위치. 레이아웃이고 Git에 두지 않음 |
| TBL-155 `comment_threads` | CTX-038 검토 | 그림, 요소, 행에 단 댓글 스레드와 기다리는 쪽 |
| TBL-156 `comments` | CTX-038 검토 | 스레드의 댓글과 답글, 순서대로 |
| TBL-157 `pull_requests` | CTX-038 검토 | 에이전트가 알린 PR. 반영, 기록, 도메인 문서 |
| TBL-158 `change_sets` | CTX-038 검토 | AI 제안과 직접 편집. 제안부터 반영까지 |
| TBL-159 `changes` | CTX-038 검토 | 변경안의 단계. 이름 바꾸기, 잇기, 더하기, 빼기 |
| TBL-160 `confirmations` | CTX-039 확정 | 사용자가 그림 하나를 확정한 것과 그 기록 |
| TBL-161 `stage_passes` | CTX-039 확정 | 통과한 단계 체크포인트. 기록에 남음 |
| TBL-162 `workshops` | CTX-040 워크숍 | 워크숍. 프로젝트마다 열린 것은 하나까지 |
| TBL-163 `workshop_steps` | CTX-040 워크숍 | 워크숍의 이벤트 스토밍 스텝. 확정과 문서 반영 |
| TBL-164 `sticky_notes` | CTX-040 워크숍 | 워크숍 보드의 스티키 노트와 신뢰도 레이블 |
| TBL-165 `sticky_links` | CTX-040 워크숍 | 스티키 노트 사이의 선 |
| TBL-166 `todos` | CTX-041 할 일 | 사용자와 에이전트의 할 일 |
| TBL-167 `claims` | CTX-041 할 일 | 어느 에이전트 세션이 할 일을 점유했는지 |
| TBL-168 `tool_links` | CTX-042 연결 | Notion과 Jira 연결과 마지막 상태 |
| TBL-169 `request_keys` | 운영 | 요청 키마다 처음 답. 24시간 |
| TBL-170 `backups` | 운영 | 매일 백업과 다시 하기 |
| TBL-171 `restore_rehearsals` | 운영 | 릴리스 전에 연습한 복원 |

## 2. 데이터베이스가 지키는 규칙

도메인 설계의 다른 규칙, 예를 들어 에이전트가 사람이 만든 스티키 노트를 지우지 않는 것은 코드가 지킵니다.

- `project_spaces`: 프로젝트 공간 이름은 소문자, 숫자, 하이픈 1~64자이고 겹치지 않습니다.
- `snapshots`: 프로젝트는 커밋마다 스냅숏 하나만 가지므로, 같은 커밋이 다시 오면 같은 리비전입니다(SPEC-001).
- `drawings`: 그림 하나는 스냅숏 하나에서만 그리고, 실패한 그림은 실패한 곳을 적습니다.
- `comment_threads`: 열린 스레드는 한쪽만 기다리고, 닫힌 스레드는 언제 누가 닫았는지 적습니다.
- `comments`: 에이전트의 댓글은 자격을 적고, 사용자의 댓글은 적지 않습니다.
- `change_sets`: 제안에는 스레드와 에이전트가 있고, 직접 편집에는 에이전트도 제안 상태도 없습니다. 반영된 변경안은 반영한 스냅숏을 적습니다.
- `changes`: 요소를 자기 자신에 잇지 않습니다.
- `confirmations`: 그림마다 살아 있는 확정은 하나까지이고, 확정만은 사용자가 하므로 자격을 적는 확정은 없습니다.
- `workshops`: 프로젝트마다 열린 워크숍은 하나까지입니다.
- `sticky_notes`: 에이전트의 스티키 노트에는 신뢰도 레이블이 있습니다.
- `todos`: 할 일의 종류마다 한쪽에 속하고, 무엇에 대한 일인지 적습니다.
- `claims`: 할 일마다 살아 있는 점유는 하나까지이고, 점유는 자격을 적으므로 자격을 폐기하면 그 점유를 풉니다(SPEC-050).
- `tool_links`: 연결은 지우기 전까지 프로젝트나 단계마다 하나만 둡니다.

## 3. 이 단계가 정한 것

- SQLite 3가 돌리는 SQL(D1도 같음). 한 사람의 데이터이고 v2도 같은 엔진을 썼습니다. 어디서 돌릴지는 11단계에서 정합니다.
- 키는 모두 AUTOINCREMENT 정수라 프로젝트 공간을 지운 뒤에도 같은 ID를 다시 주지 않습니다. 시각은 ISO 8601 UTC 텍스트입니다.
- 명세의 한도는 제약이 아니라 코드가 확인합니다. v2처럼 한도를 바꿔도 마이그레이션이 필요 없게.
- 스냅숏은 모두 두되 문서는 해시로 한 번만 두고, 그림마다 요소를 둡니다. 마지막 확정 이후의 차이와 스레드의 문서 버전을 언제나 보여 줄 수 있게.
- 레이아웃은 NEXUS에 둡니다(element_positions). 01단계 핫스팟 7과 REQ-015대로.
- 양쪽 할 일을 행으로 두어, 점유가 할 일 하나를 가리키고 확정을 취소하면 그 항목을 거둡니다.
- pull_requests 표 하나가 반영, 확정 기록, 도메인 문서 PR을 모두 담습니다. 점유가 그 일에 열린 PR이 있는지 알 수 있게(SPEC-045).
- 거절한 요청은 데이터베이스가 아니라 서버 로그에 남깁니다(규칙 8).
- 프로젝트 공간을 지우면 그 안의 것이 모두 함께 지워집니다. 에이전트 자격은 지우지 않고 폐기만 합니다.
- 원본은 db/schema.sql이 아니라 db/nexus.sql입니다. hub가 이름이 nexus로 시작하는 파일에만 part nexus를 붙이기 때문입니다.

## 4. 덮은 범위

데이터를 읽거나 쓰는 명세 행은 모두 테이블을 가리킵니다(52개 중 51개). SPEC-048(사용자 들이기)은 없습니다. 로그인은 로그인 게이트가 맡습니다. 테이블이 없는 용어: TERM-190, TERM-209, TERM-219, TERM-220, TERM-222, TERM-223, TERM-224(단계, 차이, 사용자, 에이전트, 테이블을 읽는 화면 세 개).

## 5. 관계

선 하나가 외래 키 하나이고, 이름은 그 열입니다. 열까지 담은 전체 ERD는 NEXUS가 원본에서 그립니다.

```mermaid
erDiagram
  agent_credentials ||--o{ project_spaces : created_by_credential
  agent_credentials ||--o{ snapshots : credential_id
  project_spaces ||--o{ snapshots : project_id
  document_blobs ||--o{ snapshot_files : blob_sha256
  snapshots ||--o{ snapshot_files : snapshot_id
  project_spaces ||--o{ diagrams : project_id
  snapshots ||--o{ drawings : snapshot_id
  diagrams ||--o{ drawings : diagram_id
  drawings ||--o{ elements : drawing_id
  diagrams ||--o{ element_positions : diagram_id
  drawings ||--o{ comment_threads : drawing_id
  diagrams ||--o{ comment_threads : diagram_id
  agent_credentials |o--o{ comments : credential_id
  comment_threads ||--o{ comments : thread_id
  agent_credentials ||--o{ pull_requests : credential_id
  project_spaces ||--o{ pull_requests : project_id
  snapshots |o--o{ change_sets : reflected_snapshot_id
  pull_requests |o--o{ change_sets : pull_request_id
  agent_credentials |o--o{ change_sets : credential_id
  comment_threads |o--o{ change_sets : thread_id
  drawings ||--o{ change_sets : drawing_id
  diagrams ||--o{ change_sets : diagram_id
  change_sets ||--o{ changes : change_set_id
  pull_requests |o--o{ confirmations : record_pull_request_id
  snapshots |o--o{ confirmations : invalidated_by_snapshot
  drawings ||--o{ confirmations : drawing_id
  diagrams ||--o{ confirmations : diagram_id
  project_spaces ||--o{ stage_passes : project_id
  project_spaces ||--o{ workshops : project_id
  pull_requests |o--o{ workshop_steps : pull_request_id
  workshops ||--o{ workshop_steps : workshop_id
  workshop_steps ||--o{ sticky_notes : workshop_id
  workshop_steps ||--o{ sticky_notes : step
  agent_credentials |o--o{ sticky_notes : credential_id
  workshops ||--o{ sticky_notes : workshop_id
  sticky_notes ||--o{ sticky_links : to_note
  sticky_notes ||--o{ sticky_links : from_note
  workshop_steps |o--o{ todos : workshop_id
  workshop_steps |o--o{ todos : step
  confirmations |o--o{ todos : confirmation_id
  change_sets |o--o{ todos : change_set_id
  comment_threads |o--o{ todos : thread_id
  diagrams |o--o{ todos : diagram_id
  project_spaces ||--o{ todos : project_id
  pull_requests |o--o{ claims : pull_request_id
  agent_credentials ||--o{ claims : credential_id
  todos ||--o{ claims : todo_id
  project_spaces ||--o{ tool_links : project_id
  backups ||--o{ restore_rehearsals : backup_id
```

## 6. 체크포인트

API 계약을 쓰기 전의 스키마 동결. 이 단계가 없애거나 미루거나 바꾸는 승인된 항목: 없음.

2026-11-23 통과. 관리자가 체크포인트를 맡긴 대리인을 거쳐 추천안을 모두 승인했습니다. 답은 프로젝트 기록에 있습니다.
