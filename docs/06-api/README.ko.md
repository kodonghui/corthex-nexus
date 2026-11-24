# NEXUS v3: API 계약

[English](README.md)

상태: 2026-11-23 통과. 첫 릴리스의 계약으로 고정해요.

원본: [api/openapi.yaml](../../api/openapi.yaml), OpenAPI 3.1. 입력: 기능 명세([spec.md](../04-functional-spec/spec.md))와 스키마([nexus.sql](../../db/nexus.sql)), 둘 다 2026-11-23 통과. 사이트맵은 아직 없어요(07단계). 고정한 hub(corthex-hub 0.4.0·0.5.0)의 통신 형식은 그 코드에서 읽었어요.

## 1. 오퍼레이션

두 계열이 하나의 오류 형식을 써요. 에이전트 계열(20개)은 고정한 hub의 명령을 그 형식 그대로 받고, 소유자 계열(32개)은 화면이 써요. 에이전트 자격 증명으로 소유자 경로를 부르면 owner_only, 소유자 로그인으로 에이전트 경로를 부르면 agent_only로 거절해요.

### 에이전트 계열

| ID | 오퍼레이션 | 하는 일 | 릴리스 | 명세 |
| --- | --- | --- | --- | --- |
| API-242 | `POST /api/snapshots` | 스냅숏 받기 | Must | SPEC-001, SPEC-002, SPEC-003, SPEC-004, SPEC-014, SPEC-025, SPEC-027, SPEC-033 |
| API-243 | `GET /api/snapshots/{project}/held` | 보관된 커밋 읽기 | Must | SPEC-001, SPEC-002, SPEC-014 |
| API-244 | `GET /api/spaces/{project}/data` | 삭제하면 지워지는 것 읽기 | Must | SPEC-013, SPEC-014 |
| API-245 | `GET /api/spaces/{project}/todo` | 에이전트 할 일 주기 | Must | SPEC-014, SPEC-026, SPEC-031, SPEC-043 |
| API-246 | `GET /api/spaces/{project}/comments/{comment}` | 댓글 스레드 읽기 | Must | SPEC-014, SPEC-016 |
| API-247 | `GET /api/spaces/{project}/proposals/{proposal}` | 변경 세트 읽기 | Must | SPEC-014, SPEC-018 |
| API-248 | `GET /api/spaces/{project}/edits/{edit}` | 반영 항목 읽기 | Must | SPEC-014, SPEC-024, SPEC-026 |
| API-249 | `GET /api/spaces/{project}/checkpoints/{checkpoint}` | 기록할 확정 읽기 | Must | SPEC-014, SPEC-031 |
| API-250 | `POST /api/spaces/{project}/claims/{entry}` | 할 일 맡기 | Must | SPEC-014, SPEC-044, SPEC-045 |
| API-251 | `DELETE /api/spaces/{project}/claims/{entry}` | 맡은 일 놓기 | Must | SPEC-014, SPEC-045 |
| API-252 | `POST /api/spaces/{project}/comments` | 에이전트로 댓글 달기 | Must | SPEC-014, SPEC-016, SPEC-027 |
| API-253 | `POST /api/spaces/{project}/comments/{comment}/replies` | 에이전트로 답하기 | Must | SPEC-014, SPEC-017 |
| API-254 | `POST /api/spaces/{project}/comments/{comment}/answered` | 댓글에 답했다고 표시 | Must | SPEC-014, SPEC-017 |
| API-255 | `POST /api/spaces/{project}/comments/{comment}/decisions` | 결정 기록 위치 알리기 | Must | SPEC-014, SPEC-017 |
| API-256 | `POST /api/spaces/{project}/proposals` | AI 제안 올리기 | Must | SPEC-014, SPEC-018 |
| API-257 | `POST /api/spaces/{project}/proposals/{proposal}/withdraw` | 제안 거두기 | Must | SPEC-014, SPEC-018 |
| API-258 | `POST /api/spaces/{project}/edits/{edit}/report` | 반영 보고하기 | Must | SPEC-014, SPEC-023, SPEC-024, SPEC-025, SPEC-045 |
| API-259 | `POST /api/spaces/{project}/checkpoints/{checkpoint}/report` | 확정 기록 보고하기 | Must | SPEC-014, SPEC-032 |
| API-260 | `POST /api/spaces/{project}/workshop/steps/{step}/draft` | 단계 초안 붙이기 | Should | SPEC-037, SPEC-038 |
| API-261 | `POST /api/spaces/{project}/workshop/steps/{step}/report` | 단계 반영 보고하기 | Should | SPEC-039, SPEC-040 |

### 소유자 계열

| ID | 오퍼레이션 | 하는 일 | 릴리스 | 명세 |
| --- | --- | --- | --- | --- |
| API-262 | `GET /api/projects` | 프로젝트 목록 | Must | SPEC-015, SPEC-042, SPEC-048 |
| API-263 | `GET /api/todo` | 소유자 할 일 | Must | SPEC-042, SPEC-048 |
| API-264 | `GET /api/projects/{project}` | 프로젝트 읽기 | Must | SPEC-005, SPEC-027, SPEC-035, SPEC-046 |
| API-265 | `GET /api/projects/{project}/diagrams/{diagram}` | 다이어그램 읽기 | Must | SPEC-003, SPEC-004, SPEC-005, SPEC-006, SPEC-007, SPEC-008, SPEC-009, SPEC-010, SPEC-011, SPEC-012, SPEC-022, SPEC-027, SPEC-034, SPEC-051 |
| API-266 | `GET /api/projects/{project}/threads/{thread}` | 스레드 읽기 | Must | SPEC-016, SPEC-017 |
| API-267 | `POST /api/projects/{project}/diagrams/{diagram}/threads` | 소유자로 댓글 달기 | Must | SPEC-016, SPEC-027, SPEC-051 |
| API-268 | `POST /api/projects/{project}/threads/{thread}/comments` | 소유자로 답하기 | Must | SPEC-017, SPEC-051 |
| API-269 | `POST /api/projects/{project}/threads/{thread}/close` | 스레드 닫기 | Must | SPEC-028 |
| API-270 | `POST /api/projects/{project}/change-sets/{change_set}/accept` | AI 제안 받아들이기 | Must | SPEC-019, SPEC-027 |
| API-271 | `POST /api/projects/{project}/change-sets/{change_set}/reject` | AI 제안 거절하기 | Must | SPEC-020 |
| API-272 | `POST /api/projects/{project}/diagrams/{diagram}/direct-edits` | 직접 이름 바꾸기·연결하기 | Must | SPEC-021, SPEC-027 |
| API-273 | `POST /api/projects/{project}/change-sets/{change_set}/cancel` | 직접 편집 취소하기 | Must | SPEC-023 |
| API-274 | `POST /api/projects/{project}/diagrams/{diagram}/positions` | 요소 옮기기 | Must | SPEC-012, SPEC-027 |
| API-275 | `POST /api/projects/{project}/diagrams/{diagram}/confirmation` | 다이어그램 확정하기 | Must | SPEC-027, SPEC-029, SPEC-031 |
| API-276 | `POST /api/projects/{project}/confirmations/{confirmation}/cancel` | 확정 취소하기 | Must | SPEC-030, SPEC-031 |
| API-277 | `GET /api/projects/{project}/removal` | 삭제할 것 보기 | Must | SPEC-013 |
| API-278 | `POST /api/projects/{project}/removal` | 프로젝트 공간 삭제하기 | Must | SPEC-013 |
| API-279 | `GET /api/credentials` | 에이전트 자격 증명 목록 | Must | SPEC-049, SPEC-050 |
| API-280 | `POST /api/credentials` | 에이전트 자격 증명 발급하기 | Must | SPEC-049 |
| API-281 | `POST /api/credentials/{credential}/revoke` | 에이전트 자격 증명 폐기하기 | Must | SPEC-050 |
| API-282 | `POST /api/projects/{project}/tool-links` | Notion·Jira 링크 걸기 | Should | SPEC-046 |
| API-283 | `DELETE /api/projects/{project}/tool-links/{link}` | 도구 링크 지우기 | Should | SPEC-047 |
| API-284 | `POST /api/projects/{project}/workshop` | 워크숍 열기 | Should | SPEC-036 |
| API-285 | `GET /api/projects/{project}/workshop` | 워크숍 읽기 | Should | SPEC-036, SPEC-038 |
| API-286 | `POST /api/projects/{project}/workshop/notes` | 스티커 붙이기 | Should | SPEC-038 |
| API-287 | `PATCH /api/projects/{project}/workshop/notes/{note}` | 스티커 옮기기·고치기 | Should | SPEC-038 |
| API-288 | `DELETE /api/projects/{project}/workshop/notes/{note}` | 스티커 떼기 | Should | SPEC-038 |
| API-289 | `POST /api/projects/{project}/workshop/links` | 스티커 잇기 | Should | SPEC-038 |
| API-290 | `DELETE /api/projects/{project}/workshop/links/{link}` | 스티커 연결 끊기 | Should | SPEC-038 |
| API-291 | `POST /api/projects/{project}/workshop/steps/{step}/confirm` | 단계 확정하기 | Should | SPEC-039 |
| API-292 | `POST /api/projects/{project}/workshop/imports` | Miro 보드 가져오기 | Could | SPEC-041 |
| API-293 | `GET /api/projects/{project}/diagrams/{diagram}/page` | 목업 페이지 열기 | Must | SPEC-009 |

## 2. 오류 코드

모든 거절은 application/problem+json의 Problem(title, status, detail, code, traceId)이에요. 코드마다 화면 문구와 클라이언트 동작은 원본의 components.x-corthex.errors에 있어요.

| 코드 | 상태 | 화면 문구 |
| --- | --- | --- |
| `invalid_request` | 400 | 표시한 입력을 확인하세요. |
| `invalid_snapshot` | 400 | 스냅숏을 고친 뒤 다시 보내세요. |
| `text_too_long` | 400 | 글자 수 제한까지 줄여 주세요. |
| `unsupported_format` | 400 | NEXUS가 아는 형식을 보내는 hub를 쓰세요. |
| `access_missing` | 401 | 유효한 에이전트 자격 증명을 설정하고 다시 보내세요. |
| `unauthenticated` | 401 | 다시 로그인하세요. |
| `agent_only` | 403 | 에이전트 명령이에요. 화면에서 직접 하세요. |
| `cross_site` | 403 | 이 변경은 NEXUS 화면에서만 할 수 있어요. |
| `not_owner` | 403 | 이 NEXUS의 소유자만 열 수 있어요. |
| `owner_only` | 403 | 소유자만 NEXUS에서 할 수 있는 일이에요. |
| `change_set_not_found` | 404 | NEXUS에 더 이상 없는 변경이에요. |
| `checkpoint_not_found` | 404 | NEXUS에 없는 확정이에요. |
| `comment_not_found` | 404 | NEXUS에 없는 댓글이에요. |
| `confirmation_not_found` | 404 | NEXUS에 더 이상 없는 확정이에요. |
| `credential_not_found` | 404 | NEXUS에 없는 자격 증명이에요. |
| `diagram_not_found` | 404 | NEXUS에 없는 다이어그램이에요. |
| `discrepancy_not_found` | 404 | NEXUS는 차이를 열지 않아요. |
| `drawing_not_found` | 404 | 페이지를 다시 여세요. |
| `edit_not_found` | 404 | NEXUS에 없는 반영 항목이에요. |
| `element_not_found` | 404 | 다이어그램에 더 이상 없는 요소예요. |
| `entry_not_found` | 404 | NEXUS에 없는 할 일이에요. |
| `item_not_found` | 404 | 단계에 없는 항목이에요. |
| `not_found` | 404 | 없는 주소예요. |
| `note_link_not_found` | 404 | 보드에 더 이상 없는 연결이에요. |
| `note_not_found` | 404 | 보드에 더 이상 없는 스티커예요. |
| `part_not_found` | 404 | 프로젝트에 없는 부분이에요. |
| `project_not_found` | 404 | NEXUS에 없는 프로젝트예요. |
| `proposal_not_found` | 404 | NEXUS에 없는 제안이에요. |
| `space_not_found` | 404 | 아직 NEXUS에 없는 프로젝트예요. |
| `step_not_found` | 404 | 없는 단계예요. |
| `thread_not_found` | 404 | NEXUS에 더 이상 없는 댓글 스레드예요. |
| `tool_link_not_found` | 404 | NEXUS에 없는 링크예요. |
| `workshop_not_found` | 404 | 이 프로젝트에는 워크숍이 없어요. |
| `method_not_allowed` | 405 | 이 주소는 그 요청을 받지 않아요. |
| `change_set_state` | 409 | 이미 결정된 변경이에요. |
| `claimed` | 409 | 다른 세션이 작업 중이에요. |
| `commit_not_replaced` | 409 | 보관된 커밋 뒤의 커밋을 보내세요. |
| `confirmation_cancelled` | 409 | 소유자가 이 확정을 취소했어요. |
| `diagram_ambiguous` | 409 | 그림을 하나 골라 주세요. |
| `document_changed` | 409 | 문서가 바뀌었어요. 새 버전을 보세요. |
| `entry_closed` | 409 | 더 이상 열려 있지 않은 할 일이에요. |
| `name_taken` | 409 | 다른 이름을 고르세요. |
| `not_drawn` | 409 | 문서를 고쳐 그려지게 한 뒤 확정하세요. |
| `note_made_by_owner` | 409 | 사람이 만든 스티커는 에이전트가 지울 수 없어요. |
| `older_snapshot` | 409 | 현재 커밋을 보내세요. |
| `pull_request_mismatch` | 409 | 다른 풀 리퀘스트에 들어간 작업이에요. |
| `pull_request_needed` | 409 | 풀 리퀘스트를 먼저 보고하세요. |
| `repository_mismatch` | 409 | 프로젝트의 저장소를 쓰세요. |
| `request_key_reused` | 409 | 새 요청으로 다시 보내세요. |
| `step_confirmed` | 409 | 이미 확정된 단계예요. |
| `step_empty` | 409 | 확정하기 전에 스티커를 붙이세요. |
| `steps_open` | 409 | 이 단계들을 먼저 확정하세요. |
| `thread_closed` | 409 | 닫힌 스레드예요. 새 댓글을 쓰세요. |
| `waiting_reflection` | 409 | 반영을 기다리는 변경을 먼저 반영하거나 취소하세요. |
| `workshop_closed` | 409 | 워크숍이 닫혀 있어요. |
| `workshop_open` | 409 | 이미 열린 워크숍이 있어요. |
| `body_too_large` | 413 | 한 번에 보내는 양을 줄이세요. |
| `snapshot_too_large` | 413 | 더 작은 스냅숏을 보내세요. |
| `json_required` | 415 | 본문을 JSON으로 보내세요. |
| `internal` | 500 | 문제가 생겼어요. 다시 해 보세요. |

## 3. 이 단계의 선택

- 에이전트 계열은 고정한 hub의 경로·헤더·필드와 hub가 읽는 응답 필드를 모두 그대로 받아, hub를 고치지 않고 써요(SPEC-014). hub의 remove 대체 경로(GET /api/snapshots/{project}/removal)와 v2 게시는 받지 않아요. 앞의 것은 /data가 없을 때만, 뒤의 것은 publish-v2 명령에서만 불러요.
- 에이전트 ID는 hub의 형식을 따라요: 스레드 nc_, 변경 세트 np_, 반영 항목 ne_(다이어그램마다 하나, 기다리는 변경 세트를 모두 담음, SPEC-026), 확정 nk_. v3에는 차이(discrepancy)가 없어서 할 일의 discrepancies는 늘 비어 있고 nd_ ID는 늘 찾지 못해요.
- 에이전트 자격 증명은 hub가 이미 보내는 CF-Access-Client-Id와 CF-Access-Client-Secret 한 쌍이고, NEXUS가 발급해요(SPEC-049). 없거나 모르거나 틀리거나 폐기된 자격 증명은 모두 access_missing(401) 하나로 답해요. hub는 이 코드를 다시 보낼 만한 것으로 여겨, 줄에 선 쓰기를 버리지 않고 자격 증명이 고쳐질 때까지 기다려요.
- 요청 키는 규칙 3이 요구하는 24시간보다 긴 7일 동안 보관해요. hub가 보내지 못한 쓰기를 7일 동안 같은 키로 다시 보내기 때문이에요.
- 할 일 항목에 대한 에이전트의 쓰기는 그 세션이 항목을 맡게 하고, 다른 세션이 맡은 항목에 쓰면 claimed로 거절해요. 그래서 댓글에 답하는 제안은 그 댓글을 맡은 상태가 돼요(SPEC-018).
- 반영 보고의 변경 세트는 reflected가 가리키는 병합 커밋의 스냅숏을 NEXUS가 그릴 때만, 또는 이미 그 스냅숏이 있으면 바로 반영 완료로 표시해요(SPEC-025). 서버는 Git 조상 관계를 읽을 수 없어서 다른 커밋의 스냅숏으로는 표시하지 않아요. push 작업이 병합 커밋을 끝내 보내지 않으면, 에이전트가 NEXUS가 가진 커밋으로 reflected를 다시 보고해요.
- hub의 reflect 이벤트 needs-user는 invalid_request로 거절해요. 이 이벤트에 뜻을 주는 요구사항이 없고, 에이전트는 대신 댓글 스레드에서 소유자에게 물어요.
- 에이전트의 결정 보고는 링크가 달린 스레드 항목이에요. 무엇을 묻지 않고 결정이 기록된 곳을 남기는 것이라 닫힌 스레드에도 받아요.
- NEXUS는 스냅숏 형식 corthex-hub/0.2와 corthex-hub/0.3을 받아요. 0.3은 03·08·09단계의 그림 원본을 파일마다 그림 하나로 더하고, 그림마다 원본 파일 경로(key)를 붙여요. 서버가 가진 커밋(API-243)의 답에 받는 형식(formats)을 적고, hub는 거기에 0.3이 있을 때만 0.3을 보내요. 그래서 모르는 그림 단계와 형식을 거절하는 운영 중인 v2는 같은 hub에서 계속 0.2를 받아요. 서버에 아직 없는 프로젝트의 첫 push는 가진 커밋이 없으므로 0.2로 가요. 가진 커밋의 답은 그 커밋이 온 형식(format)도 적고, 같은 커밋이 더 새 형식으로 다시 오면 반복이 아니라 그 리비전을 채워요(API-242). 그래서 0.3 hub의 다음 push가 새 커밋을 기다리지 않고 새 그림을 그리고, 그 단계의 항목 표는 그림에 자리를 내줘요(SPEC-005). formats는 어떤 corthex-hub/N.N이든 받아서, 나중 서버가 더 새 형식을 적을 수 있어요.
- 파일마다 그림이 하나인 단계는 그림이 여럿이고, API-264가 그 목록을 줘요. 댓글(API-252)과 제안(API-256)은 diagram으로 하나를 고르거나, 그 항목을 가진 그림이 하나뿐이면 항목이 골라요. 항목이 없는 댓글(체크포인트 요청 같은)은 그 단계의 첫 그림에 붙고, 여러 그림에 있는 항목은 diagram_ambiguous를 받아요. 고정 hub는 diagram을 보내지 않으니, 거기서 그 hub의 댓글과 제안은 FL-002나 SCR-145처럼 그림 하나에만 있는 항목과 항목 없는 댓글에서 돼요. 제안은 01·03·05·07·08단계의 그려진 그림에만 가요(ProposalStage). 목업은 받지 않고, 그려진 그림이 없는 단계는 not_drawn을 답해요. 한 번 그림으로 그려진 단계는 0.2 스냅숏이 그 그림을 싣지 않아도 마지막 그림을 그대로 둬요. 그래서 고정 hub와 0.3 hub가 같은 프로젝트를 보내도 그림이 사라졌다 나타나지 않아요.
- 목업의 요소는 그 페이지가 쓰는 디자인 토큰이에요. 페이지가 var()로 읽는 CSS 사용자 속성마다 하나예요(API-265, SPEC-009). 그래서 토큰 목록에 따로 필드가 필요 없고, 토큰에도 스레드를 달 수 있어요.
- 0.3에서 hub는 03·08·09단계 원본을 찾고 그림마다 part를 정해요. 이 저장소의 09단계 source는 토큰 파일이라 목업 페이지를 따로 적어야 해요. 그 단계의 0.3 그림은 파일의 글 전체를 source.text로 싣고, 번역 사본은 보내지 않아요. 그런 그림이 있는 0.2 스냅숏이나 key·text가 없는 0.3 그림은 invalid_snapshot이고, 스키마에도 적었어요. 이 저장소의 0.3 스냅숏은 약 625,796바이트로 재져요(0.2 스냅숏 128,540바이트와 원본 JSON 497,256바이트). 고정했던 hub의 예산 1,000,000바이트의 절반을 넘고, API-293의 한도 1MiB 페이지도 담지 못했어요. 고정한 hub 0.6.0은 0.2에 그 예산을 두고, 0.3에는 서버의 8MiB 안에서 8,000,000바이트를 줘요(TASK-428~TASK-430).
- 목업 페이지(API-293)는 hub가 보낸 HTML 그대로예요. Content-Security-Policy sandbox allow-scripts, 네트워크 차단(default-src 'none', 인라인 스크립트와 스타일만, 이미지와 글꼴은 data:만), frame-ancestors 'self', X-Content-Type-Options nosniff로 줘요. 다이어그램 화면은 이것을 sandbox allow-scripts인 iframe으로 열어서, 그 안의 스크립트는 돌지만 NEXUS의 출처·쿠키·API에 닿지 못해요. 목업이 프레임을 다른 페이지로 옮기면 그 페이지는 이 정책 밖이고, 목업에 입력한 글이 그 이동과 함께 나갈 수 있어요. 이것은 어떤 헤더로도 막지 못해요. 그래서 프레임 위 막대가 늘 목업 페이지임을 보이고, NEXUS는 프레임 안에서 로그인을 묻지 않아요. 화면은 프레임을 지켜보다가 두 번째 문서가 열리면 목업 페이지를 한 번 다시 열고, 또 그러면 "다시 열기" 버튼과 함께 멈춰요. 헤더는 탭에서 바로 연 페이지도 sandbox로 만들고, 12단계에서 API-293의 모든 응답에 그 헤더가 있는지 시험해요. 페이지는 프레임의 상태 코드를 읽을 수 없어서, 화면은 먼저 페이지를 직접 요청해 상태만 읽고 200일 때만 프레임에 열어요. 페이지는 text/html; charset=utf-8로 줘요. 페이지가 네트워크에서 불러오는 글꼴은 불러오지 못해요. 앱이 IBM Plex를 어떻게 불러올지는 개발 때 정해요.
- 입력 검증 오류는 글자 수 초과(text_too_long, field와 limit 포함)까지 모두 400이에요. 413은 본문이 바이트 한도를 넘을 때만 써요: 스냅숏 8 MiB, Miro 내보내기 5 MiB, 그 밖의 본문 2 MiB(hub가 줄 세우는 가장 큰 쓰기 크기).
- 아무것도 바꾸지 않는 반복 요청은 changed false로 성공해요. 형식이 틀린 경로 ID는 400이 아니라 그것이 가리키는 것의 404를 받아요. hub가 그렇게 읽어요.
- hub가 링크하는 페이지 주소 /p/{project}/{part 또는 _}/{stage}와 /p/{project}#data는 그대로 둬요. 07단계에서 자리를 정해요.

## 4. 명세 대응

명세 52행 가운데 51행에 오퍼레이션이 있어요. 오퍼레이션이 없는 행: SPEC-052(서버 작업이라 요청이 없음; 실패 경고는 getOwnerTodo로 보여 줌).

2026-11-23 기능 변경(7절)으로 API-265가 SPEC-006, SPEC-008, SPEC-009의 그림을 첫 릴리스부터 보여 주고, API-293이 목업 페이지를 줘요.

| 명세 | 오퍼레이션 |
| --- | --- |
| SPEC-001 Accept a snapshot | API-242, API-243 |
| SPEC-002 Create a project space on the first send | API-242, API-243 |
| SPEC-003 Draw the DDD board | API-242, API-265 |
| SPEC-004 Draw the ERD | API-242, API-265 |
| SPEC-005 Show an item table | API-242, API-264, API-265 |
| SPEC-006 Draw user-flow diagrams | API-242, API-265 |
| SPEC-007 Draw the sitemap tree | API-242, API-265 |
| SPEC-008 Draw screen-state panels | API-242, API-265 |
| SPEC-009 Show mockups with their tokens | API-242, API-265, API-293 |
| SPEC-010 Show names, hide trace IDs | API-265 |
| SPEC-011 Copy an element | API-265 |
| SPEC-012 Move an element and keep its place | API-265, API-274 |
| SPEC-013 Delete a project space | API-244, API-277, API-278 |
| SPEC-014 Accept the pinned hub commands | API-242, API-243, API-244, API-245, API-246, API-247, API-248, API-249, API-250, API-251, API-252, API-253, API-254, API-255, API-256, API-257, API-258, API-259 |
| SPEC-015 Start with no v2 data | API-262 |
| SPEC-016 Add a comment | API-246, API-252, API-266, API-267 |
| SPEC-017 Reply in a thread | API-253, API-254, API-255, API-266, API-268 |
| SPEC-018 Post an AI proposal | API-247, API-256, API-257 |
| SPEC-019 Accept an AI proposal | API-270 |
| SPEC-020 Reject an AI proposal | API-271 |
| SPEC-021 Rename or connect directly | API-272 |
| SPEC-022 Show what waits for reflection | API-265 |
| SPEC-023 Cancel a direct edit | API-258, API-273 |
| SPEC-024 Link a reflection pull request | API-248, API-258 |
| SPEC-025 Mark changes reflected | API-242, API-258 |
| SPEC-026 Hand over a diagram's change sets together | API-245, API-248 |
| SPEC-027 Keep the comments of a removed element | API-242, API-252, API-264, API-265, API-267, API-270, API-272, API-274, API-275 |
| SPEC-028 Close a thread | API-269 |
| SPEC-029 Confirm a diagram or item table | API-275 |
| SPEC-030 Cancel a confirmation | API-276 |
| SPEC-031 Ask the agent to record a confirmation | API-245, API-249, API-275, API-276 |
| SPEC-032 Mark a confirmation recorded | API-259 |
| SPEC-033 Invalidate a confirmation when its document changes | API-242 |
| SPEC-034 Show what changed since the last confirmation | API-265 |
| SPEC-035 Pass a stage checkpoint | API-264 |
| SPEC-036 Open a workshop | API-284, API-285 |
| SPEC-037 Draw a step draft | API-260 |
| SPEC-038 Edit sticky notes | API-260, API-285, API-286, API-287, API-288, API-289, API-290 |
| SPEC-039 Confirm a step | API-261, API-291 |
| SPEC-040 Close the workshop | API-261 |
| SPEC-041 Import a Miro board | API-292 |
| SPEC-042 Open on the owner's to-do | API-262, API-263 |
| SPEC-043 Give agents their to-do | API-245 |
| SPEC-044 Claim a to-do | API-250 |
| SPEC-045 Release or keep a claim | API-250, API-251, API-258 |
| SPEC-046 Link a Notion page or a Jira project | API-264, API-282 |
| SPEC-047 Remove a tool link | API-283 |
| SPEC-048 Admit the owner | API-262, API-263 |
| SPEC-049 Issue an agent credential | API-279, API-280 |
| SPEC-050 Revoke an agent credential | API-279, API-281 |
| SPEC-051 Read and comment on a phone | API-265, API-267, API-268 |
| SPEC-052 Back up daily | — |

## 5. 이전 계약과 달라진 점

이전 계약은 보관한 v2의 것이에요. hub가 v2에 보내고 v2에서 읽는 것은 바뀌지 않아요. 2026-11-23 기능 변경은 0.2 옆에 형식 corthex-hub/0.3을, 가진 커밋의 답에 formats·format 필드를, 댓글과 제안에 선택 필드 diagram을 더해요. push 작업이 쓰는 고정한 hub 0.6.0은 formats·format을 읽고, 0.3을 나열한 서버에 0.3을 보내요. 세션이 쓰는 배포된 0.5.x는 둘 다 읽지 않고 0.2를 보내요. diagram은 어느 hub도 보내지 않아요. hub가 보지 않는 차이는 이래요: v2의 오류 코드 일부(clock_ahead, too_many_projects, write_id_reused, comment_limit 따위)를 쓰지 않고 v3 코드(request_key_reused, thread_closed 등)를 써요; discrepancies는 늘 비어 있어요; checkpoint_requested로 기존 요청에 답글을 돌리지 않아요; /removal과 v2 게시는 받지 않아요; 소유자 로그인은 에이전트 경로를 쓸 수 없어요; 자격 증명은 Cloudflare 서비스 토큰이 아니라 NEXUS가 발급해요. 소유자 계열은 모두 새로 만들었어요. 운영 중인 v2를 v3로 바꾸는 일은 이 계약이 아니라 릴리스 때 정해요.

## 6. 승인된 항목에서 바꾸는 것

체크포인트에서 하나씩 물었고 모두 추천대로 승인됐어요. 04 명세(API 수정)와 05 스키마(API 수정)가 같은 PR에서 고쳐졌어요.

- **SPEC-002와 SPEC-001, 고정한 hub가 보내기 전에 하는 두 확인.** SPEC-002는 "스냅숏에 첫 전송 확인이 없으면 거절하고, 아무것도 만들지 않고, 소유자가 첫 전송을 확인해야 한다고 답한다"고 해요. 고정한 hub의 스냅숏에는 그 필드가 없어요. hub는 사용자의 동의(push --first)가 있을 때까지 프로젝트의 첫 push를 보내지 않을 뿐, 보낼 때 다른 표시를 넣지 않아요. SPEC-001의 "1 MB가 넘는 파일은 거절"도 같아요. 스냅숏에는 파일이 실리지 않고, hub가 그런 파일을 빼고 개수만 적어요. 추천: 유효한 에이전트 자격 증명의 첫 전송이면 NEXUS가 공간을 만들고, 첫 전송 확인은 hub의 --first가, 1 MB 파일 한도는 hub가 맡아요. 두 예외 문장을 그렇게 고쳐요(REQ-003은 hub의 확인으로 지켜져요). 다른 방법(소유자가 NEXUS에서 새 프로젝트를 먼저 허락)은 어떤 요구사항에도 없는 소유자 동작을 더해요.
- **규칙 3, 모든 hub 명령의 요청 키.** 규칙 3은 "모든 hub 명령과 쓰기를 하는 모든 소유자 동작은 요청 키를 싣는다"고 해요. 고정한 hub는 push, claim, release에 키를 보내지 않아요. 추천: 이 셋은 커밋과 세션으로 안전하게 반복되게 하고(같은 커밋은 그 리비전으로 답하고, 같은 세션의 claim은 같은 claim), 규칙 3이 모든 hub 명령 대신 hub가 줄 세우는 쓰기를 가리키게 고쳐요.
- **SPEC-006, SPEC-008, SPEC-009, 스냅숏에 실리지 않는 그림.** 고정한 hub는 01·05·07단계의 그림 원본과 모든 단계의 항목만 보내요. 사용자 흐름 Mermaid, 화면 상태, 목업 이미지는 보내지 않아요. 그래서 사용자 흐름 다이어그램(SPEC-006, Should), 화면 상태 패널(SPEC-008, Could), 토큰을 단 목업(SPEC-009, Could)은 hub가 보내는 것으로 그릴 수 없어요. 추천: 이 그림들은 선행 조건대로 첫 릴리스에서 빼고, 그 단계들은 항목 표(SPEC-005)로 보여 줘요. 행은 나중 hub를 위해 active로 둬요. 2026-11-23 기능 변경으로 바뀌었어요(7절).
- **스키마, hub 필드에 필요한 세 가지 변경.** hub는 05단계 스키마에 열이 없는 필드를 보내고, 병합을 커밋 없이 보고해요. 추천: (1) comments.detail, 항목의 quote·asks·look_first·결정 링크를 담는 JSON 열, (2) change_sets.detail, 제안의 reason·change 글·items·adds·제안 문서를 담는 JSON 열, (3) pull_requests가 merge_commit 없이 merged가 될 수 있게 함(hub는 커밋을 merged가 아니라 reflected에만 보내고, 기록 PR의 병합은 커밋이 필요 없어요). 통과한 스키마를 바꾸는 일이라 하나씩 물어요.

## 7. 체크포인트

2026-11-23 통과. 관리자가 체크포인트를 맡긴 대리인을 거쳐 추천안을 모두 승인했고, 답은 프로젝트 기록에 있어요.

### 2026-11-23 기능 변경

관리자가 사용자 흐름, 화면 상태, 목업을 첫 릴리스부터 그리기로 정했고, 그 원본은 hub가 보내요. 이 변경이 건드리는 승인 항목은 하나씩 여쭸고, 관리자가 체크포인트용으로 정한 대리인을 통해 승인했어요. 답은 프로젝트 기록에 있어요. 여기서는: 03·08·09단계 원본과 그림마다 key를 싣는 스냅숏 형식 corthex-hub/0.3(Snapshot, PictureStage), 서버가 가진 커밋(API-243)의 답에 받는 형식 목록, 첫 릴리스부터 그 그림을 주는 API-265, 목업 페이지를 떨어진 출처로 주는 새 오퍼레이션 API-293(3절)이에요. 그 앞의 오퍼레이션 51개는 그 밖에는 그대로예요. 이 단계 몫은 2026-11-23에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

#### PR 104 리뷰 뒤

승인된 항목 2개가 바뀌고 기능 변경 항목 4개를 정확히 했어요. 하나씩 여쭈어 같은 대리인을 통해 승인했어요. 같은 커밋이 더 새 형식으로 오면 그 리비전을 채우고(API-242), 가진 커밋의 답이 그 커밋이 온 형식을 적고 formats는 어떤 corthex-hub/N.N이든 받아요(API-243). 댓글과 제안은 선택 필드 diagram을 받고 정해지지 않는 대상을 diagram_ambiguous로 거절해요(API-252, API-256). 목업의 요소는 그 토큰이에요(API-265). API-293은 프레임이 막는 것, 화면이 상태를 읽는 법, 페이지가 다른 페이지를 열 때를 적어요. 오퍼레이션 수는 그대로예요. 이 몫은 2026-11-23에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

PR 104의 두 번째 리뷰 뒤 항목이 더 바뀌었고, 하나씩 여쭈어 같은 대리인을 통해 승인했어요. 항목 없는 댓글은 단계의 첫 그림에 붙어요. 제안은 ProposalStage를 받고, 그려진 그림이 없는 단계는 not_drawn을 답해요. 그림으로 그려진 단계는 0.2 스냅숏에서도 그림을 지녀요. API-293은 프레임이 막지 못하는 것을 적고 한 번만 다시 열어요. 0.3 그림 원본은 파일의 글이고, 규칙을 스키마에 적고 그림 1,000개까지 받아요. API-242가 SPEC-005~009를 이어요. 이 몫은 2026-11-23에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

#### PR 104 세 번째 리뷰 뒤

계약이 두 번째 리뷰에서 승인한 것을 그대로 적어요. API-293의 모든 응답에 sandbox 헤더와 nosniff를 적었고, 0.3의 key는 비어 있을 수 없고, 제안의 diagram 설명은 제안만 말하고, not_drawn은 제안에서 받은 에이전트에게 댓글을 달라고 알려요. 여기서 바뀐 승인 항목은 없어요. 이 몫은 2026-11-23에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

#### PR 104 여섯 번째 리뷰 뒤

승인된 항목 1개가 바뀌었고, 하나씩 여쭈어 같은 대리인을 통해 승인했어요. DiagramSummary에 필수 removed가 생겼고, API-264는 지우지 않은 모든 그림에 기록된 확정이 있으면 단계를 통과로 보고, 열린 스레드가 있는 지운 그림은 맨 뒤에 둬요(SPEC-005, SPEC-027). 오퍼레이션은 그대로 52개예요. 이 몫은 2026-11-23에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

#### PR 104 여덟 번째 리뷰 뒤

승인된 항목 1개가 바뀌었고, 하나씩 여쭈어 같은 대리인을 통해 승인했어요. 지운 그림은 새 스레드(API-252, API-267), 직접 편집(API-272), 옮기기(API-274), 확정(API-275)을 받지 않고 404 diagram_not_found로 답해요. diagram_not_found의 뜻에 그것을 적었어요. 지운 그림의 제안은 지금 그림이 아닌 그림에 대한 제안처럼 거절해요(API-270, document_changed). 더하거나 바꾼 코드, 오퍼레이션, 사용자 화면 글은 없어요. 이 몫은 2026-11-23에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

#### PR 104 아홉 번째 리뷰 뒤

승인된 항목 1개가 바뀌었고, 하나씩 여쭈어 같은 대리인을 통해 승인했어요. diagram_not_found의 client 줄에, 쓰기 요청 뒤에는 먼저 그림을 다시 읽는다고 적었어요. 목록에 남은 지운 그림은 스레드를 보려고만 열리기 때문이에요(SPEC-027). 뜻의 "a change"는 제안으로도 읽혀 "a direct edit"로 바꿨어요(API-270은 document_changed로 답해요). 코드, 상태 번호, 사용자 화면 글은 그대로예요. 이 몫은 2026-11-23에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

아홉 번째 리뷰의 고침을 다시 본 열 번째 리뷰에서, 위 오류 표가 diagram_not_found의 뜻을 여덟 번째 리뷰 전 그대로 적고 있음을 찾았어요. 그 줄을 다른 줄처럼 계약에서 옮겨 적었고, 두 표가 계약을 옮겨 적는지 테스트로 확인해요. 한국어 표는 사용자 화면 글을 적어서 바뀌지 않았어요. 승인된 항목은 바뀌지 않았어요.

### 테이블 번호 수정

10단계를 계획하다가 계약이 리뷰·확정 테이블을 번호 두 개 높게 적은 것을 찾았어요. comment_threads는 TBL-155인데 TBL-157로 적는 식으로, TBL-157부터 confirmations의 TBL-162까지 모두 두 개씩 높게 적어서 확정 오퍼레이션이 workshops에 쓰는 것으로 읽혔어요. 워크숍 오퍼레이션은 맞게 적었는데, API-291만 스텝을 확정할 때 적는 단계 통과를 workshops로 적었어요. 승인된 항목 1개가 바뀌었고, 하나씩 여쭈어 같은 대리인을 통해 승인했으며, 리뷰 뒤 그 답을 다시 여쭈었어요. 오퍼레이션 27개가 이제 스키마의 테이블을 적어요. 23개는 번호를 두 개 내렸고, 4개는 하는 일을 따랐어요. API-244는 스레드·댓글·변경안·확정을 세고(TBL-155, TBL-156, TBL-158, TBL-160), API-261은 스텝의 PR을 적고(TBL-157), API-264는 스레드·확정·단계 통과를 읽고(TBL-155, TBL-160, TBL-161), API-291은 단계 통과를 적어요(TBL-161). 쓰기 오퍼레이션이 적은 테이블마다 그 오퍼레이션의 명세 행 하나가 스키마의 그 테이블 추적 목록에 있는지 테스트로 확인해요. 이 테스트는 고치기 전 계약에서 실패해요. 오퍼레이션, 필드, 응답, 명세 행은 그대로예요. 이 몫은 2026-11-23에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

### 예시 수정

TASK-415를 만들다가 API-292의 413 예시가 다른 본문의 한도인 2 MiB(2097152바이트)를 적은 것을 찾았어요. 그 본문 설명, SPEC-041, 한도는 Miro 내보내기에 5 MiB를 줘요. 승인된 항목 하나가 바뀌었고, 따로 여쭈어 같은 대리인을 통해 승인받았어요. 이제 예시는 5242880바이트이고, 서버의 한도 테스트는 예외 없이 다른 본문의 예시처럼 이것도 검사해요. 오퍼레이션, 필드, 응답, 코드, 명세 행은 바뀌지 않았어요. 이 몫은 2026-11-23에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

### 고정 hub 수정

TASK-432는 hub-ref.json과 push 작업에 hub corthex-nexus 0.6.0(kodonghui/corthex의 e410ce9)을 고정해요. 그래서 계약이 고정한 hub를 설명한 문장이 틀리게 됐어요. 그 문장은 push 작업에 0.4.0을 적었고, 고정한 hub가 가진 커밋의 답에서 default_commit만 읽는다고 했고, 고정한 hub의 예산을 1,000,000바이트로 적었어요. 세션은 0.6.0이 배포될 때까지 배포된 0.5.x를 써요. 풀 리퀘스트 115에서 다섯 문장이 바뀌었어요. info의 에이전트 계열 설명은 push 작업의 0.6.0과 세션의 배포된 0.5.x를 적어요. API-243의 설명, 가진 커밋의 formats, 5절은 0.6.0이 formats·format을 읽고 그것을 나열한 서버에 0.3을 보내며, 0.5.x는 default_commit만 읽고 0.2를 보낸다고 적어요. 0.3 스냅숏의 크기를 적은 3절의 문장은 1,000,000바이트 예산이 그때 고정했던 hub의 것이고, 0.6.0은 0.2에 그 예산을 두고 0.3에 8,000,000바이트를 준다고 적어요. 스키마, 오퍼레이션, 응답, 코드, 예시는 바뀌지 않았어요. 이 몫은 2026-11-24에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

### 에이전트 할 일 테이블 수정

TASK-433을 만들다가 에이전트 할 일인 API-245가 TBL-166과 TBL-167만 적은 것을 찾았어요. 그 응답은 항목마다 다른 테이블에만 있는 것을 알려 줘요. 프로젝트 공간과 보관된 커밋(TBL-147), 다이어그램마다 단계와 부분(TBL-151), 그중 파일 그림의 부분은 마지막 그리기의 스냅숏에 있는 /snapshot 문서에만 있어요(TBL-152, TBL-150, TBL-149). 댓글의 스레드와 마지막 글(TBL-155, TBL-156), 반영의 변경 세트와 PR(TBL-158, TBL-157), 체크포인트의 버전과 시각(TBL-160, TBL-152), 스텝의 확정 시각(TBL-163)도 그래요. 서버의 테이블 검사(WBS 메모 23)는 오퍼레이션이 적은 테이블만 정확히 건드리게 해요. 승인된 항목 하나가 바뀌고, 따로 여쭤요. API-245는 이제 TBL-166, TBL-167 대신 TBL-147, TBL-149, TBL-150, TBL-151, TBL-152, TBL-155, TBL-156, TBL-157, TBL-158, TBL-160, TBL-163, TBL-166, TBL-167을 적어요. 오퍼레이션, 필드, 응답, 코드, 명세 행은 바뀌지 않았어요. 이 몫은 2026-11-24에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

### 프로젝트 테이블 수정

TASK-440을 만들다가 프로젝트 읽기인 API-264가 TBL-147, TBL-151, TBL-155, TBL-160, TBL-161, TBL-168만 적은 것을 찾았어요. 그 응답은 다른 테이블에만 있는 것도 알려 줘요(WBS 메모 19). 보관된 커밋의 리비전과 받은 시각(TBL-148), 그 스냅숏의 /snapshot 문서에만 있는 프로젝트의 제목과 부분(TBL-150, TBL-149), 마지막 드로잉의 스냅숏에 있는 /snapshot 문서에만 있는 파일 그림의 부분(TBL-152, TBL-150, TBL-149), 다이어그램이 그려졌는지(TBL-152), 반영을 기다리는 변경 세트(TBL-158), 프로젝트의 워크숍(TBL-162)이에요. 전에 적은 여섯 테이블도 읽기가 모두 써요. 프로젝트 공간(TBL-147), 다이어그램(TBL-151), 열린 스레드(TBL-155), 확정(TBL-160), 단계 통과(TBL-161), 도구 링크(TBL-168)예요. 서버의 테이블 검사(WBS 메모 23)는 오퍼레이션이 적은 테이블만 정확히 건드리게 해요. 승인된 항목 하나가 바뀌고, 따로 여쭤요. API-264는 이제 TBL-147, TBL-151, TBL-155, TBL-160, TBL-161, TBL-168 대신 TBL-147, TBL-148, TBL-149, TBL-150, TBL-151, TBL-152, TBL-155, TBL-158, TBL-160, TBL-161, TBL-162, TBL-168을 적어요. 오퍼레이션, 필드, 응답, 코드, 명세 행은 바뀌지 않았어요. 이 몫은 2026-11-24에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

### 클레임 테이블 수정

TASK-434를 만들다가 할 일 항목을 맡는 API-250과 클레임을 놓는 API-251이 자기가 쓰는 클레임인 TBL-167만 적은 것을 찾았어요. 둘 다 다른 테이블 세 개를 읽어요. 둘 다 이름으로 프로젝트 공간을 찾고, 그 저장소로 클레임의 PR 링크를 만들어요(TBL-147). 항목 ID가 가리키는 에이전트 할 일의 열린 항목을 찾거나, 그 ID가 닫힌 항목을 가리키는지 봐요(TBL-166). 만난 클레임의 PR도 읽어요. PR이 열려 있는 동안 클레임이 유지되고, PR이 닫히면 60분이 시작돼요(TBL-157, SPEC-045). 서버의 테이블 검사(WBS 메모 23)는 오퍼레이션이 적은 테이블만 정확히 건드리게 해요. 승인된 항목 세 개가 바뀌고, 하나씩 따로 여쭤요. API-250은 이제 TBL-167 대신 TBL-147, TBL-157, TBL-166, TBL-167을 적고, API-251도 TBL-167 대신 TBL-147, TBL-157, TBL-166, TBL-167을 적어요. API-251의 설명은 이 세션이 맡지 않은 클레임은 released false라고만 해서, 다른 세션의 살아 있는 클레임에 409 claimed를 답하는 응답과 어긋났어요. 이제 이 세션이 살아 있는 클레임을 갖지 않으면 released false를 답하고, 다른 세션이 갖고 있으면 409 claimed를 답한다고 적어요. 쓰기가 적은 테이블마다 그 쓰기의 명세 행이 채운다고 본 풀 리퀘스트 105의 테스트는 이 목록에서 실패했어요. 둘 다 TBL-147과 TBL-166을 읽기만 하기 때문이에요. 이제 목록은 오퍼레이션이 읽는 테이블도 담으니(WBS 메모 23), 그 규칙은 쓰기가 실제로 바꾸는 테이블에 적용되고, 서버의 테이블 검사가 쓰기를 실행할 때 확인해요. 계약의 테스트는 쓰기가 자기 명세 행이 채우는 테이블을 하나 이상 적는지만 봐요. 필드, 응답, 코드, 명세 행은 바뀌지 않았어요. 이 몫은 2026-11-24에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

### 소유자 프로젝트와 할 일 테이블 수정

TASK-439를 만들다가 프로젝트 목록인 API-262가 TBL-147, TBL-148, TBL-170만, 소유자 할 일인 API-263이 TBL-166, TBL-170만 적은 것을 찾았어요. 두 응답은 다른 테이블에만 있는 것도 알려 줘요. API-262는 프로젝트마다 소유자를 기다리는 열린 항목(TBL-166, WBS 메모 22)과 통과한 단계(TBL-161)를 세고, 보관된 스냅숏의 /snapshot 문서에만 있는 제목(TBL-150, TBL-149)을 알려 줘요. API-263은 항목마다 프로젝트(TBL-147), 다이어그램의 단계와 이름(TBL-151), 마지막 드로잉의 스냅숏에 있는 /snapshot 문서에만 있는 파일 그림의 부분(TBL-152, TBL-150, TBL-149), 제안이 답하는 스레드(TBL-158), 다이어그램이 확정을 기다리는 까닭(TBL-160)을 알려 줘요. 전에 적은 테이블도 모두 써요. API-262는 프로젝트 공간(TBL-147), 보관된 스냅숏(TBL-148), 백업(TBL-170)을, API-263은 할 일 항목(TBL-166)과 백업(TBL-170)을 써요. 서버의 테이블 검사(WBS 메모 23)는 오퍼레이션이 적은 테이블만 정확히 건드리게 해요. 승인된 항목 두 개가 바뀌고, 따로 여쭤요. API-262는 이제 TBL-147, TBL-148, TBL-170 대신 TBL-147, TBL-148, TBL-149, TBL-150, TBL-161, TBL-166, TBL-170을 적고, API-263은 TBL-166, TBL-170 대신 TBL-147, TBL-149, TBL-150, TBL-151, TBL-152, TBL-158, TBL-160, TBL-166, TBL-170을 적어요. 오퍼레이션, 필드, 응답, 코드, 명세 행은 바뀌지 않았어요. 이 몫은 2026-11-24에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

### 에이전트 댓글 테이블 수정

TASK-437을 만들다가 에이전트 댓글의 오퍼레이션 네 개가 읽고 쓰는 테이블의 일부만 적은 것을 찾았어요(WBS 메모 15). 에이전트의 댓글인 API-252는 TBL-155, TBL-156, TBL-166을 적었는데, 이름으로 프로젝트 공간도 찾아요(TBL-147). 부분이 보관된 스냅숏의 /snapshot 문서가 선언한 부분인지, 커밋이 NEXUS가 보관한 스냅숏의 것인지 확인해요(TBL-148, TBL-150, TBL-149). 단계의 다이어그램과 그 부분을 찾는데, 파일 그림의 부분은 마지막 드로잉의 스냅숏에 있는 /snapshot 문서에만 있어요(TBL-151, TBL-152, TBL-150, TBL-149). 보여 주는 드로잉과 item이 가리키는 요소도 찾아요(TBL-152, TBL-153). 답글인 API-253은 TBL-156, TBL-166, TBL-167을 적었는데, 스레드가 소유자를 기다리게 바꾸고(TBL-155, SPEC-017), 프로젝트 공간과 스레드를 그 프로젝트에 묶는 다이어그램을 찾고(TBL-147, TBL-151), 유지하는 클레임의 PR을 읽어요(TBL-157, SPEC-045). 답함 표시인 API-254는 TBL-155, TBL-166, TBL-167을 적었는데, 프로젝트 공간과 스레드의 다이어그램을 찾고(TBL-147, TBL-151), 스레드의 마지막 글의 시각을 답하고(TBL-156), 유지하는 클레임의 PR을 읽어요(TBL-157). 결정을 기록한 곳을 보고하는 API-255는 TBL-156, TBL-166을 적었는데, 열린 스레드가 소유자를 기다리게 바꾸고(TBL-155), 프로젝트 공간과 스레드의 다이어그램을 찾고(TBL-147, TBL-151), 스레드의 댓글 항목의 클레임을 유지했다가 놓으면서 그 PR을 읽어요(TBL-167, TBL-157). 서버의 테이블 검사(WBS 메모 23)는 오퍼레이션이 적은 테이블만 정확히 건드리게 하고, 이 오퍼레이션들이 바꾸는 테이블은 모두 자기 명세 행이 채우는 테이블이에요. 승인된 항목 네 개가 바뀌고, 하나씩 따로 여쭤요. API-252는 이제 TBL-155, TBL-156, TBL-166 대신 TBL-147, TBL-148, TBL-149, TBL-150, TBL-151, TBL-152, TBL-153, TBL-155, TBL-156, TBL-166을 적어요. API-253은 TBL-156, TBL-166, TBL-167 대신 TBL-147, TBL-151, TBL-155, TBL-156, TBL-157, TBL-166, TBL-167을 적고, API-254는 TBL-155, TBL-166, TBL-167 대신 TBL-147, TBL-151, TBL-155, TBL-156, TBL-157, TBL-166, TBL-167을, API-255는 TBL-156, TBL-166 대신 TBL-147, TBL-151, TBL-155, TBL-156, TBL-157, TBL-166, TBL-167을 적어요. 오퍼레이션, 필드, 응답, 코드, 명세 행은 바뀌지 않았어요. 이 몫은 2026-11-24에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

### diagram_not_found의 에이전트 안내

TASK-437을 만들다가 diagram_not_found의 client 줄, 곧 그 답을 받은 클라이언트가 할 일이 화면의 단계만 적은 것을 찾았어요. API-252는 에이전트의 호출이에요(WBS 메모 11). 고정 hub는 댓글에 diagram을 보내지 않고, 404로 거절된 쓰기는 버린 뒤 그 거절을 에이전트에게 알려요. 그래서 에이전트에게 이 답은 그 부분의 단계에 지워지지 않은 그려진 다이어그램이 없거나, 단계의 첫 다이어그램이 한 번도 그려지지 않았다는 뜻인데, 에이전트가 다음에 무엇을 할지는 어디에도 없었어요. 에이전트의 클라이언트는 오류 등록부에서 할 일을 읽으니, 이제 그 줄이 그것을 적어요. 승인된 항목 하나가 바뀌고, 따로 여쭤요. diagram_not_found의 client 줄은 전에 "Link to the project; after a write, read the diagram again first, since a removed one still listed opens for its threads only (SPEC-027)."였고, 이제 "Link to the project; after a write, read the diagram again first, since a removed one still listed opens for its threads only (SPEC-027). An agent does not send the comment again as it is: it pushes the stage so that it draws, or names an item that a drawn diagram of the stage holds; an open thread of a removed diagram still takes replies (API-253)."예요. 오퍼레이션, 필드, 응답, 코드, 뜻, 명세 행은 바뀌지 않았어요. 이 몫은 2026-11-24에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

### 프로젝트 지우기 테이블 수정

TASK-448을 만들다가 지울 때 미리 보기인 API-277과 지우기인 API-278이 TBL-147만 적은 것을 찾았어요. 둘 다 다른 테이블에만 있는 것을 세요(WBS 메모 18). 보관된 커밋의 리비전과 스냅숏(TBL-148), 다이어그램(TBL-151)과 그 드로잉(TBL-152), 위치(TBL-154), 스레드(TBL-155), 댓글(TBL-156), 변경 세트(TBL-158), 확정(TBL-160), 워크숍(TBL-162)과 그 노트(TBL-164), 도구 링크(TBL-168)예요. API-278은 스냅숏 파일이 가리키는 블롭(TBL-150)도 읽고, db/nexus.sql의 TBL-149 주석이 말하듯 남은 스냅숏 파일이 가리키지 않는 블롭을 지워요(TBL-149). 프로젝트의 나머지 행은 스키마의 연쇄 삭제로 프로젝트 공간의 행과 함께 지워져요. 서버의 테이블 검사(WBS 메모 23)는 오퍼레이션이 적은 테이블만 정확히 건드리게 하고, 쓰기가 바꾸는 테이블마다 그 명세 행이 채우는 테이블이게 해요. 그래서 TBL-149에 SPEC-013이 들어가요(05단계의 "지운 프로젝트의 블롭"). 승인된 항목 두 개가 바뀌고, 따로 여쭤요. API-277은 이제 TBL-147 대신 TBL-147, TBL-148, TBL-151, TBL-152, TBL-154, TBL-155, TBL-156, TBL-158, TBL-160, TBL-162, TBL-164, TBL-168을 적고, API-278은 TBL-147 대신 TBL-147, TBL-148, TBL-149, TBL-150, TBL-151, TBL-152, TBL-154, TBL-155, TBL-156, TBL-158, TBL-160, TBL-162, TBL-164, TBL-168을 적어요. 같은 미리 보기를 에이전트에게 주는 API-244는 TASK-436의 몫이라 여기서는 목록을 그대로 둬요. 오퍼레이션, 필드, 응답, 코드, 명세 행은 바뀌지 않았어요. 이 몫은 2026-11-24에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

### 푸시 테이블과 명세 행 수정

TASK-435를 만들다가 hub의 push인 API-242가 TBL-147, TBL-148, TBL-149, TBL-150, TBL-151, TBL-152, TBL-153만 적은 것을 찾았어요. 드로잉 뒤에 바꾸는 일은 더 많은 테이블을 읽고 써요(WBS 메모 14). 문서가 바뀐 다이어그램의 살아 있는 확정을 무효화하고(TBL-160, SPEC-033), 그 확정이 받친 단계 통과를 "통과 뒤 바뀜"으로 표시해요(TBL-161, SPEC-035). 단계의 통과 뒤에 살아 있는 확정 없이 나타난 다이어그램도 그 통과를 바뀜으로 표시해요. 알린 병합 커밋을 그리면 그 반영 PR의 수락된 변경 세트를 반영됨으로 표시하고(TBL-157, TBL-158, SPEC-025), 그 변경 세트를 요청한 스레드를 닫아요. 단계 문서에서 빠진 요소의 열린 스레드는 그 다이어그램으로 옮기고, 요소가 돌아오면 다시 이어요(TBL-155, SPEC-027). 소유자와 에이전트의 할 일도 따라 바뀌어요(TBL-166). 서버의 테이블 검사(WBS 메모 23)는 오퍼레이션이 적은 테이블만 정확히 건드리게 하고, 쓰기가 바꾸는 테이블은 그 오퍼레이션의 명세 행 하나가 채우는 테이블이어야 해요. db/nexus.sql에서 TBL-161을 채우는 행은 SPEC-035와 SPEC-039인데, API-242는 SPEC-035를 적지 않았어요. push가 이제 SPEC-035의 "통과 뒤 바뀜"을 맡아요. 승인된 항목 두 개가 바뀌고, 하나씩 따로 여쭤요. API-242는 이제 TBL-147, TBL-148, TBL-149, TBL-150, TBL-151, TBL-152, TBL-153 대신 TBL-147, TBL-148, TBL-149, TBL-150, TBL-151, TBL-152, TBL-153, TBL-155, TBL-157, TBL-158, TBL-160, TBL-161, TBL-166을 적어요. 명세 행은 SPEC-001, SPEC-002, SPEC-003, SPEC-004, SPEC-005, SPEC-006, SPEC-007, SPEC-008, SPEC-009, SPEC-014, SPEC-025, SPEC-027, SPEC-033 대신 SPEC-001, SPEC-002, SPEC-003, SPEC-004, SPEC-005, SPEC-006, SPEC-007, SPEC-008, SPEC-009, SPEC-014, SPEC-025, SPEC-027, SPEC-033, SPEC-035예요. 오퍼레이션, 필드, 응답, 코드는 바뀌지 않았고, db/nexus.sql도 그대로예요. 이 몫은 2026-11-24에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

### 목업 페이지 테이블 수정

TASK-427을 만들다가 목업 페이지인 API-293이 TBL-149, TBL-150, TBL-151, TBL-152를 적었는데, 그 프로젝트의 다이어그램을 찾기 전에 이름으로 프로젝트 공간도 찾는 것을 알았어요(TBL-147). 적었던 테이블도 모두 그대로 읽어요. 다이어그램(TBL-151), 그려진 마지막 드로잉(TBL-152), 그 드로잉의 스냅숏에서 다이어그램의 source_key로 찾는 문서, 곧 페이지예요(TBL-150, TBL-149). 서버의 테이블 검사(WBS 메모 23)는 오퍼레이션이 적은 테이블만 정확히 건드리게 해요. 승인된 항목 하나가 바뀌고, 따로 여쭤요. API-293은 이제 TBL-149, TBL-150, TBL-151, TBL-152 대신 TBL-147, TBL-149, TBL-150, TBL-151, TBL-152를 적어요. 오퍼레이션, 필드, 응답, 코드, 명세 행은 바뀌지 않았어요. 이 몫은 2026-11-24에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

### 에이전트 읽기 테이블 수정

TASK-436을 만들다가 에이전트의 읽기 다섯 개가 읽는 테이블의 일부만 적은 것을 찾았어요(WBS 메모 18, 23). 에이전트가 지울 때 미리 보기를 읽는 API-244는 TBL-147, TBL-148, TBL-151, TBL-155, TBL-156, TBL-158, TBL-160을 적었는데, API-277과 같은 미리 보기를 같은 셈으로 답해요. 그 셈은 드로잉(TBL-152), 위치(TBL-154), 워크숍(TBL-162)과 그 노트(TBL-164), 도구 링크(TBL-168)도 세요. 하나를 읽는 네 오퍼레이션은 모두 이름으로 프로젝트 공간을 찾고, PR 링크를 만드는 저장소를 읽어요(TBL-147). 읽는 것의 부분, 단계, 다이어그램도 찾는데, 파일 그림의 부분은 마지막 드로잉의 스냅숏에 있는 /snapshot 문서에만 있어요(TBL-151, TBL-152, TBL-150, TBL-149). 그 밖에 스레드를 읽는 API-246은 TBL-155, TBL-156을 적었는데, 스레드가 달린 드로잉과 그 버전(TBL-152), 스레드에 답하는 변경 세트(TBL-158)도 답해요. 변경 세트를 읽는 API-247은 TBL-158, TBL-159를 적었는데, 드로잉의 버전(TBL-152), PR 링크(TBL-157), 그 변경 세트를 담은 반영 항목(TBL-166)도 답해요. 반영 항목을 읽는 API-248은 TBL-166, TBL-158, TBL-157을 적었는데, 항목의 살아 있는 claim도 답하면서 그 claim의 PR을 읽어요(TBL-167, TBL-157). 확정을 읽는 API-249는 TBL-160을 적었는데, 드로잉의 버전(TBL-152), 기록의 PR(TBL-157), 열린 기록 항목의 살아 있는 claim(TBL-166, TBL-167)도 답해요. 서버의 테이블 검사(WBS 메모 23)는 오퍼레이션이 적은 테이블만 정확히 건드리게 하고, 다섯 오퍼레이션은 어느 테이블도 바꾸지 않아요. 승인된 항목 다섯 개가 바뀌고, 하나씩 따로 여쭤요. API-244는 이제 TBL-147, TBL-148, TBL-151, TBL-155, TBL-156, TBL-158, TBL-160 대신 API-277의 목록인 TBL-147, TBL-148, TBL-151, TBL-152, TBL-154, TBL-155, TBL-156, TBL-158, TBL-160, TBL-162, TBL-164, TBL-168을 적어요. API-246은 TBL-155, TBL-156 대신 TBL-147, TBL-149, TBL-150, TBL-151, TBL-152, TBL-155, TBL-156, TBL-158을 적고, API-247은 TBL-158, TBL-159 대신 TBL-147, TBL-149, TBL-150, TBL-151, TBL-152, TBL-157, TBL-158, TBL-159, TBL-166을 적어요. API-248은 TBL-166, TBL-158, TBL-157 대신 TBL-147, TBL-149, TBL-150, TBL-151, TBL-152, TBL-157, TBL-158, TBL-166, TBL-167을, API-249는 TBL-160 대신 TBL-147, TBL-149, TBL-150, TBL-151, TBL-152, TBL-157, TBL-160, TBL-166, TBL-167을 적어요. 오퍼레이션, 필드, 응답, 코드, 명세 행은 바뀌지 않았어요. 이 몫은 2026-11-24에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

### 다이어그램 테이블 수정

TASK-441을 만들다가 다이어그램 읽기인 API-265가 TBL-151, TBL-152, TBL-153, TBL-154, TBL-155, TBL-158, TBL-159, TBL-160만 적은 것을 찾았어요. 그 응답은 다른 테이블에만 있는 것도 알려 줘요. 이름으로 프로젝트 공간을 찾고, 그 저장소로 변경 세트의 PR 링크를 만들어요(TBL-147). 드로잉의 리비전은 그 드로잉이 나온 스냅숏의 리비전이에요(TBL-148). 파일 그림의 부분은 마지막 드로잉의 스냅숏에 있는 /snapshot 문서에만 있고, 항목 표 링크의 이름은 프로젝트가 보관한 스냅숏의 항목 문서에서 와요(TBL-150, TBL-149). 스레드의 항목 수와 마지막 항목의 시각(TBL-156), 변경 세트의 PR(TBL-157), 수락된 변경 세트를 담은 에이전트 할 일의 반영 항목(TBL-166)도 알려 줘요. 전에 적은 여덟 테이블도 읽기가 모두 써요. 다이어그램(TBL-151), 그 드로잉(TBL-152)과 요소(TBL-153), 소유자가 옮긴 위치(TBL-154), 스레드(TBL-155), 변경 세트(TBL-158)와 그 단계(TBL-159), 확정(TBL-160)이에요. 서버의 테이블 검사(WBS 메모 23)는 오퍼레이션이 적은 테이블만 정확히 건드리게 해요. 승인된 항목 하나가 바뀌고, 따로 여쭤요. API-265는 이제 TBL-151, TBL-152, TBL-153, TBL-154, TBL-155, TBL-158, TBL-159, TBL-160 대신 TBL-147, TBL-148, TBL-149, TBL-150, TBL-151, TBL-152, TBL-153, TBL-154, TBL-155, TBL-156, TBL-157, TBL-158, TBL-159, TBL-160, TBL-166을 적어요. 오퍼레이션, 필드, 응답, 코드, 명세 행은 바뀌지 않았어요. 이 몫은 2026-11-24에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

### 제안 테이블 수정

TASK-438을 만들다가 제안 올리기인 API-256과 제안 거두기인 API-257이 읽고 쓰는 테이블의 일부만 적은 것을 찾았어요(WBS 메모 18, 23). API-256은 TBL-158, TBL-159, TBL-155, TBL-166, TBL-167을 적었어요. 이 오퍼레이션은 이름으로 프로젝트 공간을 찾고, 보관한 스냅숏의 /snapshot 문서에서 프로젝트가 적은 part를 읽어요(TBL-147, TBL-148, TBL-150, TBL-149). 받은 `commit`의 리비전도 찾아요(TBL-148). 단계의 다이어그램, 마지막 드로잉의 스냅숏에 있는 /snapshot 문서에서 파일 그림의 part, 다이어그램마다의 현재 드로잉을 찾아요(TBL-151, TBL-150, TBL-149, TBL-152). item을 가진 요소를 읽고, `source_text`가 있으면 비교할 현재 드로잉의 요소도 읽어요(TBL-153). 제안의 글을 스레드에 더하고(TBL-156), 답글처럼 claim을 유지할 때 claim의 PR을 읽어요(TBL-157). API-257은 TBL-158과 TBL-166을 적었어요. 이 오퍼레이션도 이름으로 프로젝트 공간을 찾아요(TBL-147). 변경 세트를 API-247처럼 part, 다이어그램, 드로잉 버전, 단계와 함께 답해요(TBL-151, TBL-152, TBL-150, TBL-149, TBL-159). 제안의 스레드가 에이전트를 기다리는 동안에는 그 댓글 항목의 claim을 유지하고, 그때 claim의 PR을 읽어요(TBL-167, TBL-157). 서버의 테이블 검사(WBS 메모 23)는 오퍼레이션이 적은 테이블만 정확히 건드리게 해요. 승인된 항목 두 개가 바뀌고, 한 질문에서 함께 물었어요. API-256은 이제 TBL-158, TBL-159, TBL-155, TBL-166, TBL-167 대신 TBL-147, TBL-148, TBL-149, TBL-150, TBL-151, TBL-152, TBL-153, TBL-155, TBL-156, TBL-157, TBL-158, TBL-159, TBL-166, TBL-167을 적고, API-257은 TBL-158, TBL-166 대신 TBL-147, TBL-149, TBL-150, TBL-151, TBL-152, TBL-157, TBL-158, TBL-159, TBL-166, TBL-167을 적어요. 오퍼레이션, 필드, 응답, 코드, 명세 행은 바뀌지 않았어요. 이 몫은 2026-11-24에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

### 소유자 스레드 테이블 수정

TASK-443을 만들다가 소유자 스레드의 오퍼레이션 네 개가 읽고 쓰는 테이블의 일부만 적은 것을 찾았어요(WBS 메모 16, 23). 네 오퍼레이션은 모두 이름으로 프로젝트 공간을 찾고(TBL-147), 스레드를 그 프로젝트에 묶는 스레드의 다이어그램을 찾아요(TBL-151). 소유자가 스레드를 읽는 API-266은 TBL-155, TBL-156을 적었는데, API-246과 같은 읽기로 같은 Thread를 답해요. 스레드의 부분, 단계, 다이어그램을 찾는데, 파일 그림의 부분은 마지막 드로잉의 스냅숏에 있는 /snapshot 문서에만 있어요(TBL-151, TBL-152, TBL-150, TBL-149). 스레드가 달린 드로잉과 그 버전(TBL-152), 스레드에 답하는 변경 세트(TBL-158)도 답해요. 소유자의 댓글인 API-267은 TBL-155, TBL-156, TBL-166을 적었는데, API-266처럼 다이어그램과 그 부분도 찾아요(TBL-151, TBL-152, TBL-150, TBL-149). 댓글이 고른 드로잉, 그 드로잉에서 고른 요소, 그리고 현재 드로잉이 그 요소를 아직 읽을 수 있게 담는지도 읽어요(TBL-152, TBL-153). 소유자의 답글인 API-268은 TBL-156, TBL-166을 적었는데, 메모 16이 말하듯 스레드의 상태도 읽고 열린 스레드가 에이전트를 기다리게 바꿔요(TBL-155, SPEC-017). 스레드를 닫는 API-269는 TBL-155, TBL-166을 적었는데, 스레드의 마지막 글의 시각도 답해요(TBL-156). 서버의 테이블 검사(WBS 메모 23)는 오퍼레이션이 적은 테이블만 정확히 건드리게 하고, 이 오퍼레이션들이 바꾸는 테이블은 모두 자기 명세 행이 채우는 테이블이에요. API-267에서는 SPEC-016이 TBL-155, TBL-156, TBL-166을, API-268에서는 SPEC-017이 같은 세 테이블을, API-269에서는 SPEC-028이 TBL-155, TBL-166을 채워요. 승인된 항목 네 개가 바뀌고, 한 질문에서 함께 물었어요. API-266은 이제 TBL-155, TBL-156 대신 API-246의 목록인 TBL-147, TBL-149, TBL-150, TBL-151, TBL-152, TBL-155, TBL-156, TBL-158을 적어요. API-267은 TBL-155, TBL-156, TBL-166 대신 TBL-147, TBL-149, TBL-150, TBL-151, TBL-152, TBL-153, TBL-155, TBL-156, TBL-166을 적고, API-268은 TBL-156, TBL-166 대신 TBL-147, TBL-151, TBL-155, TBL-156, TBL-166을, API-269는 TBL-155, TBL-166 대신 TBL-147, TBL-151, TBL-155, TBL-156, TBL-166을 적어요. 오퍼레이션, 필드, 응답, 코드, 명세 행은 바뀌지 않았어요. 이 몫은 2026-11-24에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

### 직접 편집 테이블 수정

TASK-445를 만들다가 직접 편집인 API-272가 TBL-158, TBL-159, TBL-166만, 그 취소인 API-273이 TBL-158, TBL-166만 적은 것을 찾았어요. 두 오퍼레이션은 다른 테이블에만 있는 것도 읽어요. 둘 다 이름으로 프로젝트 공간을 찾고, 그 저장소로 PR 링크를 만들어요(TBL-147). 그리고 API-247처럼 변경 세트를 그 다이어그램의 부분과 함께 답해요. 파일 그림의 부분은 마지막 드로잉의 스냅숏에 있는 /snapshot 문서에만 있어요(TBL-151, TBL-152, TBL-150, TBL-149). 그 밖에 API-272는 다이어그램이 보여 주는 드로잉과 편집이 가리키는 그 드로잉의 요소를 찾고(TBL-152, TBL-153), API-273은 변경 세트의 단계와 PR을 읽어요(TBL-159, TBL-157). 전에 적은 테이블도 두 오퍼레이션이 모두 써요. 변경 세트(TBL-158), API-272가 쓰는 단계(TBL-159), 에이전트 할 일의 반영 항목과 빼기 항목(TBL-166)이에요. 서버의 테이블 검사(WBS 메모 23)는 오퍼레이션이 적은 테이블만 정확히 건드리게 해요. 승인된 항목 두 개가 바뀌고, 한 질문에서 함께 물었어요. API-272는 이제 TBL-158, TBL-159, TBL-166 대신 TBL-147, TBL-149, TBL-150, TBL-151, TBL-152, TBL-153, TBL-158, TBL-159, TBL-166을 적고, API-273은 TBL-158, TBL-166 대신 TBL-147, TBL-149, TBL-150, TBL-151, TBL-152, TBL-157, TBL-158, TBL-159, TBL-166을 적어요. 오퍼레이션, 필드, 응답, 코드, 명세 행은 바뀌지 않았어요. 이 몫은 2026-11-24에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

### 도구 링크 테이블 수정

TASK-451을 만들다가 Notion 페이지나 Jira 프로젝트를 잇는 API-282와 도구 링크를 지우는 API-283이 각각 TBL-168만 적은 것을 찾았어요. 두 오퍼레이션 모두 프로젝트의 링크를 더하거나 지우기 전에 프로젝트 공간을 이름으로 찾아요(TBL-147). 각각 적었던 테이블 하나, 곧 도구 링크(TBL-168)는 그대로 써요. 서버의 테이블 확인(WBS 메모 23)은 오퍼레이션이 적은 테이블만 정확히 건드리게 해요. 승인된 항목 두 개가 바뀌고, 한 질문에서 함께 물었어요. API-282는 TBL-168 대신 TBL-147, TBL-168을 적어요. API-283은 TBL-168 대신 TBL-147, TBL-168을 적어요. 오퍼레이션, 필드, 응답, 코드, 명세 행은 바뀌지 않았어요. 이 몫은 2026-11-24에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

### 확정 테이블 수정

TASK-446을 만들다가 다이어그램을 확정하는 API-275와 확정을 취소하는 API-276이 둘 다 TBL-160, TBL-166만 적은 것을 찾았어요. 두 오퍼레이션은 다른 테이블에만 있는 것도 읽어요. 둘 다 이름으로 프로젝트 공간을 찾고(TBL-147), 확정한 드로잉의 커밋과 함께 확정을 답해요(TBL-152). 둘 다 할 일에서 확정을 맡는 한 곳을 부르고, 그곳은 다이어그램과 그것이 그려진 적이 있는지를 읽어요(TBL-151, TBL-152). 그 밖에 API-275는 다이어그램과 그 가장 최근 드로잉을 찾고(TBL-151, TBL-152), 확정을 거절하게 하는 반영 대기 변경 세트를 읽어요(TBL-158, SPEC-029). 전에 적은 테이블도 두 오퍼레이션이 모두 써요. 확정(TBL-160)과, 소유자의 확정 항목과 에이전트가 확정이나 그 취소를 기록하는 항목(TBL-166)이에요. 서버의 테이블 검사(WBS 메모 23)는 오퍼레이션이 적은 테이블만 정확히 건드리게 해요. 승인된 항목 두 개가 바뀌고, 하나씩 따로 여쭤요. API-275는 이제 TBL-160, TBL-166 대신 TBL-147, TBL-151, TBL-152, TBL-158, TBL-160, TBL-166을 적고, API-276은 TBL-160, TBL-166 대신 TBL-147, TBL-151, TBL-152, TBL-160, TBL-166을 적어요. 오퍼레이션, 필드, 응답, 코드, 명세 행은 바뀌지 않았어요. 이 몫은 2026-11-24에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

### 제안 답하기 테이블 수정

TASK-444를 만들다가 제안 수락인 API-270과 제안 거절인 API-271이 읽고 쓰는 테이블의 일부만 적은 것을 찾았어요(WBS 메모 18, 23). 두 오퍼레이션 모두 TBL-158과 TBL-166을 적었어요. 둘 다 이름으로 프로젝트 공간을 찾고(TBL-147), 제안의 다이어그램이 지워졌는지 보려고 그 다이어그램도 찾아요(TBL-151). API-270은 제안의 드로잉을 다이어그램이 보여 주는 드로잉과 비교해요(TBL-152). 둘 다 변경 세트를 API-247처럼 part, 드로잉 버전, 단계와 함께 답해요. 파일 그림의 part는 드로잉의 스냅숏에 있는 /snapshot 문서에서 읽어요(TBL-151, TBL-152, TBL-149, TBL-150, TBL-159). 이미 수락한 변경 세트를 다시 수락하면 그 PR도 적는데(TBL-157), 거절한 변경 세트에는 PR이 없어요. 서버의 테이블 검사(WBS 메모 23)는 오퍼레이션이 적은 테이블만 정확히 건드리게 해요. 승인된 항목 두 개가 바뀌고, 따로 여쭤요. API-270은 이제 TBL-158, TBL-166 대신 TBL-147, TBL-149, TBL-150, TBL-151, TBL-152, TBL-157, TBL-158, TBL-159, TBL-166을 적고, API-271은 TBL-158, TBL-166 대신 TBL-147, TBL-149, TBL-150, TBL-151, TBL-152, TBL-158, TBL-159, TBL-166을 적어요. 오퍼레이션, 필드, 응답, 코드, 명세 행은 바뀌지 않았어요. 이 몫은 2026-11-24에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

TASK-445를 만들다가 직접 편집인 API-272가 TBL-158, TBL-159, TBL-166만, 그 취소인 API-273이 TBL-158, TBL-166만 적은 것을 찾았어요. 두 오퍼레이션은 다른 테이블에만 있는 것도 읽어요. 둘 다 이름으로 프로젝트 공간을 찾고, 그 저장소로 PR 링크를 만들어요(TBL-147). 그리고 API-247처럼 변경 세트를 그 다이어그램의 부분과 함께 답해요. 파일 그림의 부분은 마지막 드로잉의 스냅숏에 있는 /snapshot 문서에만 있어요(TBL-151, TBL-152, TBL-150, TBL-149). 그 밖에 API-272는 다이어그램이 보여 주는 드로잉과 편집이 가리키는 그 드로잉의 요소를 찾고(TBL-152, TBL-153), API-273은 변경 세트의 단계와 PR을 읽어요(TBL-159, TBL-157). 전에 적은 테이블도 두 오퍼레이션이 모두 써요. 변경 세트(TBL-158), API-272가 쓰는 단계(TBL-159), 에이전트 할 일의 반영 항목과 빼기 항목(TBL-166)이에요. 서버의 테이블 검사(WBS 메모 23)는 오퍼레이션이 적은 테이블만 정확히 건드리게 해요. 승인된 항목 두 개가 바뀌고, 하나씩 따로 여쭤요. API-272는 이제 TBL-158, TBL-159, TBL-166 대신 TBL-147, TBL-149, TBL-150, TBL-151, TBL-152, TBL-153, TBL-158, TBL-159, TBL-166을 적고, API-273은 TBL-158, TBL-166 대신 TBL-147, TBL-149, TBL-150, TBL-151, TBL-152, TBL-157, TBL-158, TBL-159, TBL-166을 적어요. 오퍼레이션, 필드, 응답, 코드, 명세 행은 바뀌지 않았어요. 이 몫은 2026-11-24에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

### 옮기기와 위치 테이블 수정

TASK-442를 만들다가 요소 옮기기인 API-274가 TBL-154만 적은 것을 찾았어요. 이 오퍼레이션은 위치를 쓰기(TBL-154) 전에 테이블 네 개를 더 읽어요. 이름으로 프로젝트 공간을 찾고(TBL-147), 그 프로젝트의 다이어그램(TBL-151), 다이어그램이 보여 주는 드로잉, 곧 그려진 가장 최근 드로잉(TBL-152), 그 드로잉에서 옮기는 요소(TBL-153)를 찾아요. push인 API-242가 문서를 떠난 요소의 위치를 지워야 한다는 것도 찾았어요. SPEC-012는 "문서에서 사라진 요소 → 위치를 버림"이라고 하고, db/nexus.sql의 TBL-154 주석은 "the code drops the positions of elements that left"라고 해요. 요소는 스냅숏을 그릴 때 떠나므로, push가 위치를 읽고 지워요(TBL-154). 서버의 테이블 검사(WBS 메모 23)는 오퍼레이션이 적은 테이블만 정확히 건드리게 하고, 쓰기가 바꾸는 테이블은 그 오퍼레이션의 명세 행 하나가 채우는 테이블이어야 해요. db/nexus.sql에서 TBL-154를 채우는 행은 SPEC-012뿐인데, API-242는 SPEC-012를 적지 않았어요. 승인된 항목 세 개가 바뀌고, 하나씩 따로 여쭤요. API-274는 이제 TBL-154 대신 TBL-147, TBL-151, TBL-152, TBL-153, TBL-154를 적어요. API-242는 TBL-147, TBL-148, TBL-149, TBL-150, TBL-151, TBL-152, TBL-153, TBL-155, TBL-157, TBL-158, TBL-160, TBL-161, TBL-166 대신 TBL-147, TBL-148, TBL-149, TBL-150, TBL-151, TBL-152, TBL-153, TBL-154, TBL-155, TBL-157, TBL-158, TBL-160, TBL-161, TBL-166을 적어요. API-242의 명세 행은 SPEC-001, SPEC-002, SPEC-003, SPEC-004, SPEC-005, SPEC-006, SPEC-007, SPEC-008, SPEC-009, SPEC-014, SPEC-025, SPEC-027, SPEC-033, SPEC-035 대신 SPEC-001, SPEC-002, SPEC-003, SPEC-004, SPEC-005, SPEC-006, SPEC-007, SPEC-008, SPEC-009, SPEC-012, SPEC-014, SPEC-025, SPEC-027, SPEC-033, SPEC-035예요. 오퍼레이션, 필드, 응답, 코드는 바뀌지 않았고, db/nexus.sql도 그대로예요. 이 몫은 2026-11-24에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

### 워크숍 테이블 수정

TASK-452를 만들다가 워크숍 오퍼레이션 열 개가 읽고 쓰는 테이블 중 일부만 적은 것을 찾았어요. WBS 메모 17이 그중 몇 가지를 적어요. "API-261에 닫는 할 일과 필요한 클레임(TBL-166, TBL-167)가 없고, API-260이 노트를 지우면 선도 지울 수 있고(TBL-165) 초안이 읽기만 하는 TBL-163을 적으며, API-285는 워크숍을 읽어요(TBL-162)." 열 개 모두 다른 것을 읽거나 쓰기 전에 프로젝트 공간을 이름으로 찾고(TBL-147) 그 프로젝트의 워크숍을 찾아요(TBL-162). 서버의 테이블 확인(WBS 메모 23)은 오퍼레이션이 읽고 쓰는 테이블을 정확히 적게 하고, 바꾸는 테이블마다 그 명세 행 중 하나가 채우는 테이블이어야 해요. 승인된 항목 열 개가 바뀌고, 하나씩 따로 여쭤요.

- **API-260**, 스텝 초안 그리기: TBL-163, TBL-164 대신 TBL-147, TBL-162, TBL-163, TBL-164, TBL-165를 적어요. 스티커를 떼면 그 링크도 지워요(TBL-165). 초안은 그 스텝이 확정됐는지 읽으므로(TBL-163) TBL-163은 남아요. 메모 23은 쓰는 테이블뿐 아니라 읽는 테이블도 세기 때문이에요.
- **API-261**, 스텝을 쓴 것을 알리기: TBL-163, TBL-162, TBL-157 대신 TBL-147, TBL-157, TBL-162, TBL-163, TBL-166을 적어요. `merged` 알림이 그 스텝의 `write_step` 항목을 닫아요(TBL-166).
  - 메모 17과 달리 TBL-167은 적지 않아요. 워크숍의 어떤 쓰기도 claim을 만들거나 유지하지 않아요. 스텝에는 API-250이 claim할 항목 ID가 없고, `TodoStep`은 claim을 보여 주지 않으며, API-261은 `claimed` 응답을 적지 않아요.
  - 코디네이터가 TASK-452를 위해 이렇게 골랐고, 2026-11-24에 같은 대리인을 통해 따로 승인했어요. WBS 4절이 메모 17과의 차이로 기록해요.
- **API-284**, 워크숍 열기: TBL-162, TBL-163 대신 TBL-147, TBL-162, TBL-163을 적어요.
- **API-285**, 워크숍 읽기: TBL-163, TBL-164, TBL-165 대신 TBL-147, TBL-162, TBL-163, TBL-164, TBL-165를 적어요.
- **API-286**, 스티커 더하기: TBL-164 대신 TBL-147, TBL-162, TBL-164를 적어요.
- **API-287**, 스티커 바꾸기: TBL-164 대신 TBL-147, TBL-162, TBL-164를 적어요.
- **API-288**, 스티커 떼기: TBL-164, TBL-165 대신 TBL-147, TBL-162, TBL-164, TBL-165를 적어요.
- **API-289**, 두 스티커 잇기: TBL-165 대신 TBL-147, TBL-162, TBL-164, TBL-165를 적어요. 두 스티커 모두 열린 워크숍의 살아 있는 스티커여야 해요(TBL-164).
- **API-290**, 링크 지우기: TBL-165 대신 TBL-147, TBL-162, TBL-165를 적어요.
- **API-291**, 스텝 확정: TBL-163, TBL-161, TBL-166 대신 TBL-147, TBL-161, TBL-162, TBL-163, TBL-164, TBL-166을 적어요. 살아 있는 스티커가 없는 스텝은 `step_empty`를 받아요(TBL-164).

승인된 항목 하나가 더 바뀌고, 따로 여쭤 같은 대리인을 통해 승인했어요. API-260의 400 응답에 `text_too_long` 예시가 생겨요. `field`는 `notes[0].text`, `limit`은 200이에요. 계약에서 초안 스티커의 텍스트는 200자까지이고(`DraftNote`), 텍스트를 받는 다른 워크숍 쓰기(API-286, API-287)는 `text_too_long`을 적으며, 이 코드는 이미 등록부에 있어요.

오퍼레이션, 필드, 코드, 명세 행은 바뀌지 않았어요. 이 몫은 2026-11-24에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

### 보고 테이블과 명세 행 수정

TASK-447을 만들다가, 반영 PR 보고인 API-258과 확정 기록 PR 보고인 API-259가 읽고 쓰는 테이블의 일부만 적은 것을 찾았어요(WBS 메모 20, 23). push인 API-242도 이제 테이블 두 개를 더 써요. API-258은 TBL-157, TBL-158, TBL-166, TBL-167을 적었어요. 이 오퍼레이션은 이름으로 프로젝트 공간과, PR 링크가 가리켜야 하는 저장소를 찾아요(TBL-147). `reflected` 이벤트는 NEXUS가 병합 커밋의 스냅숏을 갖고 있으면(TBL-148) push처럼 변경 세트를 바로 반영해요. 드로잉 스냅숏의 /snapshot 문서에서 다이어그램마다의 part를 찾고(TBL-150, TBL-149), 다이어그램과 그것이 보여 주는 드로잉을 찾아(TBL-151, TBL-152), 변경 세트의 단계(TBL-159)를 그 드로잉의 요소(TBL-153)와 견줘요. 병합한 문서에 변경이 없으면, 그것을 알리는 댓글(WBS 메모 26)을 에이전트 글 하나가 있는 다이어그램의 새 스레드로 써요(TBL-155, TBL-156). 제안의 스레드는 기다리는 변경 세트가 없어지면 닫혀요(TBL-155). API-259는 TBL-160, TBL-157, TBL-166, TBL-167을 적었어요. 이 오퍼레이션도 이름으로 프로젝트 공간을 찾고(TBL-147), 확정을 다이어그램의 part(파일 그림이면 드로잉 스냅숏의 /snapshot 문서에서 읽어요), 확정한 드로잉의 커밋과 함께 답해요(TBL-151, TBL-152, TBL-150, TBL-149). 병합된 기록은 단계의 모든 다이어그램에 기록된 확정이 있으면 단계 통과를 쓰고, 병합된 취소 기록은 그 확정에 기댄 통과를 바뀜으로 표시해요(TBL-161). WBS는 TASK-447의 완료 조건에서 이것을 SPEC-035로 적는데, API-259는 SPEC-014와 SPEC-032만 적었고, db/nexus.sql에서 TBL-161을 채우는 행은 SPEC-035와 SPEC-039뿐이에요. push인 API-242는 API-258처럼 반영하므로 같은 댓글을 쓰고(TBL-155, TBL-156) 견주는 단계를 읽어요(TBL-159). SPEC-025는 이미 적혀 있어요. 서버의 테이블 검사(WBS 메모 23)는 오퍼레이션이 적은 테이블만 정확히 건드리게 하고, 쓰기가 바꾸는 테이블은 그 오퍼레이션의 명세 행 하나가 채우는 테이블이어야 해요. 승인된 항목 네 개가 바뀌고, 하나씩 따로 여쭤요. API-258은 이제 TBL-157, TBL-158, TBL-166, TBL-167 대신 TBL-147, TBL-148, TBL-149, TBL-150, TBL-151, TBL-152, TBL-153, TBL-155, TBL-156, TBL-157, TBL-158, TBL-159, TBL-166, TBL-167을 적어요. API-259는 TBL-160, TBL-157, TBL-166, TBL-167 대신 TBL-147, TBL-149, TBL-150, TBL-151, TBL-152, TBL-157, TBL-160, TBL-161, TBL-166, TBL-167을 적어요. API-259의 명세 행은 SPEC-014, SPEC-032 대신 SPEC-014, SPEC-032, SPEC-035예요. API-242는 TBL-147, TBL-148, TBL-149, TBL-150, TBL-151, TBL-152, TBL-153, TBL-154, TBL-155, TBL-157, TBL-158, TBL-160, TBL-161, TBL-166 대신 TBL-147, TBL-148, TBL-149, TBL-150, TBL-151, TBL-152, TBL-153, TBL-154, TBL-155, TBL-156, TBL-157, TBL-158, TBL-159, TBL-160, TBL-161, TBL-166을 적어요. 오퍼레이션, 필드, 응답, 코드는 바뀌지 않았어요. TBL-155의 추적 줄에는 ERD README의 "반영의 스레드"가 말하듯 SPEC-025가 들어가요. 이 몫은 2026-11-24에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

### Miro 가져오기 테이블과 예시 수정

TASK-453을 만들다가 Miro 보드 가져오기인 API-292가 TBL-164와 TBL-165만 적은 것을 찾았어요. 이 오퍼레이션은 다른 것을 읽거나 쓰기 전에 프로젝트 공간을 이름으로 찾고(TBL-147) 그 프로젝트의 열린 워크숍을 찾아요(TBL-162). 적었던 테이블도 모두 써요. 스텝마다 살아 있는 스티커를 세고 가져온 스티커를 더하며(TBL-164), 보드의 살아 있는 링크를 세고 가져온 링크를 더해요(TBL-165). 스텝(TBL-163)은 읽지 않아요. 확정한 스텝도 가져오기를 받고 확정된 채로 있기 때문이에요. 서버의 테이블 확인(WBS 메모 23)은 오퍼레이션이 읽고 쓰는 테이블을 정확히 적게 하고, 바꾸는 테이블마다 그 명세 행 중 하나가 채우는 테이블이어야 해요. SPEC-041이 TBL-164와 TBL-165를 채워요. 승인된 항목 두 개가 바뀌고, 하나씩 따로 여쭤요.

- **API-292의 테이블:** TBL-164, TBL-165 대신 TBL-147, TBL-162, TBL-164, TBL-165를 적어요.
- **API-292의 400 응답**에 `text_too_long` 예시가 생겨요. `field`는 `data[0].data.content`, `limit`은 200이에요. 전에는 `invalid_request`만 적었어요. 계약에서 스티커의 텍스트는 200자까지이고(`Note`), 코디네이터는 TASK-453에서 이를 넘는 텍스트가 워크숍의 모든 쓰기처럼 가져오기 전체를 `text_too_long`으로 거절하게 골랐으며, 이 코드는 이미 등록부에 있어요.

오퍼레이션, 필드, 코드, 명세 행은 바뀌지 않았어요. 이 몫은 2026-11-24에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

### 2026-11-24 기능 변경

지운 그림은 자기를 기다리는 것을 지켜요. 열린 스레드, 답을 기다리는 AI 제안, 반영을 기다리는 직접 편집 중 하나가 있는 동안 목록에 남고 열려요(기능 명세 6절). 오퍼레이션, 필드, 응답, 코드, 테이블 목록은 바뀌지 않아요. API-264와 API-265는 셋을 지닌 TBL-155와 TBL-158을 이미 적었고, DiagramSummary에는 필드를 더하지 않아요. 작업대의 읽기(API-265)가 제안과 편집을 보여 주기 때문이에요. 승인된 글 4개가 바뀌고, 하나씩 여쭤요.

- API-264의 설명: "removed ones with open threads listed last (SPEC-005, SPEC-027)"가 "removed ones listed last while they have an open thread, a proposed AI proposal or a direct edit waiting for reflection (SPEC-005, SPEC-027)"이 돼요.
- DiagramSummary의 `removed`: "A removed diagram is listed after the others only while it has open threads"가 "A removed diagram is listed after the others only while it has an open thread, a proposed AI proposal or a direct edit waiting for reflection"이 돼요.
- `diagram_not_found`의 뜻과 그것을 옮긴 영어 README 2절의 표: "the diagram that a direct edit, a move, a confirmation or a new thread names was removed (SPEC-027)"가 "the diagram that a new direct edit, a move, a confirmation or a new thread names was removed, or the diagram read (API-265) names a removed diagram with no open thread, proposed AI proposal or direct edit waiting for reflection left (SPEC-027)"이 돼요. 지운 그림에 대한 API-265의 404를 이제 계약에 적어요. 그림 읽기라고 적는 것은 목업 페이지(API-293)가 지운 목업의 페이지를 계속 주기 때문이고, 새 직접 편집이라고 적는 것은 그곳에서도 직접 편집 취소(API-273)는 받기 때문이에요.
- `diagram_not_found`의 client 줄: "a removed one still listed opens for its threads only (SPEC-027)"가 "a removed one still listed opens for its threads, its proposals' Reject and its direct edits' Cancel edit (SPEC-027)"이 돼요.

이 몫은 2026-11-24에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

### 확정에 기록의 PR

TASK-469를 만들다가, 에이전트가 확정을 기록하면 SCR-145#confirmed는 "기록됨"과 그 PR을 보여 주는데(영어: "Recorded" with its pull request), 그림 읽기(API-265)가 주는 확정에는 그 PR이 없다는 것을 찾았어요. API-265의 확정은 계약의 `Confirmation`이고, 승인된 필드는 `id`, `diagram`, `drawing`, `version`, `state`, `confirmed_at`, `ended_at`, `recorded_at`, `cancel_recorded_at`예요. 서버는 그 PR을 이미 지니고 있어요. TASK-447의 API-259가 TBL-160(`record_pull_request_id`)에 쓰고, 체크포인트 읽기(API-249)는 이미 그것을 `pull_request`로 답해요. TBL-160에 그 열이 있으므로 05단계는 바뀌지 않아요. 승인된 항목 3개가 바뀌고, 하나씩 따로 여쭤요.

- **Confirmation**에 `pull_request`가 생겨요. 필수이고, `Link` 또는 null이에요. 같은 읽기가 오버레이의 `pull_request`(`ChangeSet`)에 이미 쓰는 모양이라 API-265 안에서 한 모양을 지키고, 서버도 그것처럼 프로젝트의 저장소와 PR 번호로 만들어요. 뜻은 TBL-160이 지니는 그대로예요. 에이전트가 보고하는 대로(API-259) 해야 할 기록의 PR이거나, 마지막으로 기록된 기록의 PR이에요. 해야 할 기록은 확정이 기록될 때까지는 확정 자신의 기록이고, 기록된 확정이 취소되면 그 취소의 기록이에요. 해야 할 기록이 있는 동안에는 그 열린 PR이고, 에이전트가 보고하기 전과 그 PR이 병합되지 않고 닫힌 뒤에는 null이에요. 기록된 뒤에는 그것을 기록한 PR이에요. 프로젝트에 저장소가 없는 동안에는 null이에요. 계약에는 영어 설명 "The pull request of the record that is due, or of the last one recorded, as the agent reports it (API-259). The record that is due is the confirmation's own until it is recorded, then, once a recorded confirmation is cancelled, the cancel's. While one is due, this is its open pull request, or null before the agent reports one and after it closed without merging; once one is recorded, the pull request that recorded it. Null while the project names no repository."을 적어요. 확정을 담은 예시 3개(API-275의 201과 200, API-276의 200)에는 `pull_request: null`이 생겨요.
- **API-275의 테이블:** 확정하기(API-275)와 확정 취소하기(API-276)의 응답 `ConfirmationAnswer`도 Confirmation이라 이 필드를 답하고, 그것을 만들려고 PR(TBL-157)을 읽어요. API-275는 TBL-147, TBL-151, TBL-152, TBL-158, TBL-160, TBL-166 대신 TBL-147, TBL-151, TBL-152, TBL-157, TBL-158, TBL-160, TBL-166을 적어요.
- **API-276의 테이블:** TBL-147, TBL-151, TBL-152, TBL-160, TBL-166 대신 TBL-147, TBL-151, TBL-152, TBL-157, TBL-160, TBL-166을 적어요.

오퍼레이션, 상태 코드, 코드, 명세 행은 바뀌지 않아요. 이 몫은 2026-11-24에 같은 대리인을 통해 따로 체크포인트를 통과했어요.

### 제안의 소스 경로

WBS 4절은 제안의 `source_text`가 01단계에서, 그리고 현재 드로잉이 여러 파일에서 읽힌 05·07단계에서 변경을 만들지 않는다고 적어요. 그래서 소유자는 SPEC-018의 "X 위의 Y" 대신 변경 설명이 붙은 X를 봐요. `source_text`는 경로가 없는 텍스트 하나라서, NEXUS는 그것이 어느 파일을 대신하는지 알 수 없어요. 2026-11-24에 관리자는 hub가 경로를 보내기로 결정했어요. TASK-470은 그 경로를 API-256의 요청에 더해요. NEXUS는 텍스트를 그 파일 대신 읽고, 드로잉이 다른 파일에서 읽은 것은 hub의 그림이 주는 그대로 둬요. 01단계에서는 NEXUS가 Markdown도 직접 읽어요. TASK-466이 SQL과 YAML을 읽는 것처럼요. 이것은 서버의 일이고 계약의 일은 아니에요. 경로는 NEXUS가 변경을 계산하는 동안에만 쓰고 저장하지 않으므로 05단계는 바뀌지 않아요. SPEC-018의 승인 기준이 이미 "X 위의 Y"를 요구하므로 04단계도 바뀌지 않아요. 승인된 항목 3개가 바뀌고, 하나씩 따로 여쭤요.

- **ProposalRequest**에 `source_path`가 생겨요. 선택 필드이고, 그림의 `key`와 같은 1~300자 문자열이에요. 뜻은 "`source_text`가 대신하는 파일의 저장소 경로"예요. 드로잉이 여러 파일에서 읽혔으면 필요하고, 파일 하나에서 읽혔으면 빼도 되며, 보낸다면 그 파일을 적어야 해요. 드로잉이 읽지 않은 파일을 적으면 `invalid_request`로 거절해요. `source_text` 없이 `source_path`만 보내면 스키마에 어긋나요(`if`/`then`). 계약에는 영어 설명 "The repository path of the file that source_text is the whole proposed text of, as the hub's picture names its files, such as db/nexus.sql. NEXUS reads source_text as that file and keeps what the drawing read from its other files. A drawing read from several files needs it; where the drawing reads one file it may be left out, and when sent it names that file. A path that names no file the drawing reads is refused as invalid_request. It comes only with source_text and is not kept."을 적어요. 경로가 없으면 NEXUS는 지금처럼 드로잉이 읽은 파일 하나로 텍스트를 읽어요. 드로잉이 파일을 여럿 읽었으면 지금은 텍스트를 저장하고 변경을 만들지 않지만, 앞으로는 `source_path`에 대한 `invalid_request`로 거절해요.
- **API-256의 설명**에서 "With source_text, NEXUS draws the proposed document and keeps the differences as changes"가 "With source_text, NEXUS draws the proposed document, as the file source_path names where the drawing reads several, and keeps the differences as changes"로 바뀌어요.
- **API-256의 400 응답**에 `field`가 `source_path`인 `invalid_request` 예시 2개가 생겨요. "source_path names no file the drawing reads"와 "source_path is needed: the drawing reads several files"예요.

API-256은 드로잉의 그림을 지니는 TBL-149와 TBL-150을 이미 적고 있으므로 테이블은 바뀌지 않아요. 오퍼레이션, 상태 코드, 코드, 명세 행은 바뀌지 않아요. 이 몫은 2026-11-24에 같은 대리인을 통해 따로 체크포인트를 통과했어요.
