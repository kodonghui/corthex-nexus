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
| API-252 | `POST /api/spaces/{project}/comments` | 에이전트로 댓글 달기 | Must | SPEC-014, SPEC-016 |
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
| API-264 | `GET /api/projects/{project}` | 프로젝트 읽기 | Must | SPEC-035, SPEC-046 |
| API-265 | `GET /api/projects/{project}/diagrams/{diagram}` | 다이어그램 읽기 | Must | SPEC-003, SPEC-004, SPEC-005, SPEC-006, SPEC-007, SPEC-008, SPEC-009, SPEC-010, SPEC-011, SPEC-012, SPEC-022, SPEC-027, SPEC-034, SPEC-051 |
| API-266 | `GET /api/projects/{project}/threads/{thread}` | 스레드 읽기 | Must | SPEC-016, SPEC-017 |
| API-267 | `POST /api/projects/{project}/diagrams/{diagram}/threads` | 소유자로 댓글 달기 | Must | SPEC-016, SPEC-051 |
| API-268 | `POST /api/projects/{project}/threads/{thread}/comments` | 소유자로 답하기 | Must | SPEC-017, SPEC-051 |
| API-269 | `POST /api/projects/{project}/threads/{thread}/close` | 스레드 닫기 | Must | SPEC-028 |
| API-270 | `POST /api/projects/{project}/change-sets/{change_set}/accept` | AI 제안 받아들이기 | Must | SPEC-019 |
| API-271 | `POST /api/projects/{project}/change-sets/{change_set}/reject` | AI 제안 거절하기 | Must | SPEC-020 |
| API-272 | `POST /api/projects/{project}/diagrams/{diagram}/direct-edits` | 직접 이름 바꾸기·연결하기 | Must | SPEC-021 |
| API-273 | `POST /api/projects/{project}/change-sets/{change_set}/cancel` | 직접 편집 취소하기 | Must | SPEC-023 |
| API-274 | `POST /api/projects/{project}/diagrams/{diagram}/positions` | 요소 옮기기 | Must | SPEC-012 |
| API-275 | `POST /api/projects/{project}/diagrams/{diagram}/confirmation` | 다이어그램 확정하기 | Must | SPEC-029, SPEC-031 |
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
- 파일마다 그림이 하나인 단계는 그림이 여럿이고, API-264가 그 목록을 줘요. 댓글(API-252)과 제안(API-256)은 diagram으로 하나를 고르거나, 그 항목을 가진 그림이 하나뿐이면 항목이 골라요. 그렇지 않으면 diagram_ambiguous를 받아요. 항목이 없는 댓글(체크포인트 요청 같은)은 그 단계의 첫 그림에 붙고, 여러 그림에 있는 항목은 diagram_ambiguous를 받아요. 고정 hub는 diagram을 보내지 않으니, 거기서 그 hub의 댓글과 제안은 FL-002나 SCR-145처럼 그림 하나에만 있는 항목과 항목 없는 댓글에서 돼요. 제안은 01·03·05·07·08단계의 그려진 그림에만 가요(ProposalStage). 목업은 받지 않고, 그려진 그림이 없는 단계는 not_drawn을 답해요. 한 번 그림으로 그려진 단계는 0.2 스냅숏이 그 그림을 싣지 않아도 마지막 그림을 그대로 둬요. 그래서 고정 hub와 0.3 hub가 같은 프로젝트를 보내도 그림이 사라졌다 나타나지 않아요.
- 목업의 요소는 그 페이지가 쓰는 디자인 토큰이에요. 페이지가 var()로 읽는 CSS 사용자 속성마다 하나예요(API-265, SPEC-009). 그래서 토큰 목록에 따로 필드가 필요 없고, 토큰에도 스레드를 달 수 있어요.
- 0.3에서 hub는 03·08·09단계 원본을 찾고 그림마다 part를 정해요. 이 저장소의 09단계 source는 토큰 파일이라 목업 페이지를 따로 적어야 해요. 그 단계의 0.3 그림은 파일의 글 전체를 source.text로 싣고, 번역 사본은 보내지 않아요. 그런 그림이 있는 0.2 스냅숏이나 key·text가 없는 0.3 그림은 invalid_snapshot이고, 스키마에도 적었어요. 이 저장소의 0.3 스냅숏은 약 625,796바이트로 재져요(0.2 스냅숏 128,540바이트와 원본 JSON 497,256바이트). 고정 hub의 예산 1,000,000바이트의 절반을 넘고, API-293의 한도 1MiB 페이지도 담지 못해요. 0.3 hub의 예산은 서버의 8MiB 안에서 늘려요. 둘 다 10단계의 hub 작업이에요.
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
| SPEC-005 Show an item table | API-242, API-265 |
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
| SPEC-027 Keep the comments of a removed element | API-242, API-265 |
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

이전 계약은 보관한 v2의 것이에요. 고정한 hub가 보내고 읽는 것은 바뀌지 않아요. 2026-11-23 기능 변경은 0.2 옆에 형식 corthex-hub/0.3을, 가진 커밋의 답에 formats·format 필드를, 댓글과 제안에 선택 필드 diagram을 더해요. 고정한 hub는 그 필드를 읽지도 보내지도 않아요. hub가 보지 않는 차이는 이래요: v2의 오류 코드 일부(clock_ahead, too_many_projects, write_id_reused, comment_limit 따위)를 쓰지 않고 v3 코드(request_key_reused, thread_closed 등)를 써요; discrepancies는 늘 비어 있어요; checkpoint_requested로 기존 요청에 답글을 돌리지 않아요; /removal과 v2 게시는 받지 않아요; 소유자 로그인은 에이전트 경로를 쓸 수 없어요; 자격 증명은 Cloudflare 서비스 토큰이 아니라 NEXUS가 발급해요. 소유자 계열은 모두 새로 만들었어요. 운영 중인 v2를 v3로 바꾸는 일은 이 계약이 아니라 릴리스 때 정해요.

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
