# 재설계 API 계약과 호환성

[English](rebuild.md)

상태: [OpenAPI 3.1 계약](sources/rebuild/openapi.json)의 HTTP 동작 36개와 [운영 인터페이스](sources/rebuild/operator.md) 5개를 정의했습니다. 설계 산출물이며 구현·배포 증거가 아닙니다.

| Operation | HTTP | Behaviors |
| --- | --- | --- |
| API-201 getOwnerSession | GET /api/v2/session | SPEC-301, SPEC-332, SPEC-333 |
| API-202 startOwnerSignIn | POST /api/v2/auth/start | SPEC-333 |
| API-203 completeOwnerSignIn | GET /api/v2/auth/callback | SPEC-333 |
| API-204 signOut | POST /api/v2/session/logout | SPEC-333 |
| API-205 listOwnerProjects | GET /api/v2/projects | SPEC-301, SPEC-302, SPEC-332 |
| API-206 connectProject | POST /api/v2/projects | SPEC-326, SPEC-333, SPEC-350 |
| API-207 getProjectOverview | GET /api/v2/projects/{projectId} | SPEC-302, SPEC-303, SPEC-304, SPEC-320, SPEC-332, SPEC-337 |
| API-208 getStageArtifact | GET /api/v2/projects/{projectId}/stages/{part}/{stage} | SPEC-304, SPEC-305, SPEC-306, SPEC-307, SPEC-308, SPEC-337 |
| API-209 getArtifactItem | GET /api/v2/projects/{projectId}/stages/{part}/{stage}/items/{itemId} | SPEC-308, SPEC-309, SPEC-310, SPEC-341 |
| API-210 listStageDiscussions | GET /api/v2/projects/{projectId}/stages/{part}/{stage}/discussions | SPEC-311, SPEC-313, SPEC-342 |
| API-211 askAboutArtifact | POST /api/v2/projects/{projectId}/stages/{part}/{stage}/discussions | SPEC-311, SPEC-312, SPEC-337 |
| API-212 getDiscussion | GET /api/v2/projects/{projectId}/discussions/{discussionId} | SPEC-311, SPEC-313, SPEC-314, SPEC-342 |
| API-213 recordDiscussionDecision | POST /api/v2/projects/{projectId}/discussions/{discussionId}/decisions | SPEC-314, SPEC-316 |
| API-214 listAgentWork | GET /api/v2/projects/{projectId}/agent/work | SPEC-312, SPEC-315 |
| API-215 claimAgentWork | POST /api/v2/projects/{projectId}/agent/work/{workId}/claim | SPEC-315 |
| API-216 replyToAgentWork | POST /api/v2/projects/{projectId}/agent/work/{workId}/reply | SPEC-313, SPEC-315 |
| API-217 proposeArtifactChange | POST /api/v2/projects/{projectId}/discussions/{discussionId}/proposals | SPEC-316 |
| API-218 decideProposal | POST /api/v2/projects/{projectId}/proposals/{proposalId}/decision | SPEC-314, SPEC-316 |
| API-219 recordProposalReflection | POST /api/v2/projects/{projectId}/proposals/{proposalId}/reflection | SPEC-314, SPEC-316 |
| API-220 requestCheckpoint | POST /api/v2/projects/{projectId}/checkpoints | SPEC-317, SPEC-320, SPEC-321, SPEC-322, SPEC-324 |
| API-221 getCheckpointReview | GET /api/v2/projects/{projectId}/checkpoints/{checkpointId} | SPEC-317, SPEC-318, SPEC-320, SPEC-321, SPEC-343 |
| API-222 decideCheckpoint | POST /api/v2/projects/{projectId}/checkpoints/{checkpointId}/decisions | SPEC-318, SPEC-319, SPEC-320 |
| API-223 withdrawCheckpoint | POST /api/v2/projects/{projectId}/checkpoints/{checkpointId}/withdrawals | SPEC-319, SPEC-321, SPEC-323 |
| API-224 listProjectVersions | GET /api/v2/projects/{projectId}/versions | SPEC-321, SPEC-322, SPEC-324 |
| API-225 publishSnapshot | POST /api/v2/projects/{projectId}/publications | SPEC-325, SPEC-326, SPEC-327, SPEC-328, SPEC-329 |
| API-226 getPublicationReceipt | GET /api/v2/projects/{projectId}/publications/{publicationId} | SPEC-327, SPEC-328, SPEC-329 |
| API-227 consentFirstPublication | POST /api/v2/projects/{projectId}/publication-consents | SPEC-326 |
| API-228 listProjectCredentials | GET /api/v2/projects/{projectId}/credentials | SPEC-332, SPEC-333 |
| API-229 issueProjectCredential | POST /api/v2/projects/{projectId}/credentials | SPEC-319, SPEC-332, SPEC-333 |
| API-230 revokeProjectCredential | POST /api/v2/projects/{projectId}/credentials/{credentialId}/revoke | SPEC-332, SPEC-333 |
| API-231 getIsolatedPreview | GET /api/v2/projects/{projectId}/previews/{artifactId} | SPEC-307, SPEC-308, SPEC-337 |
| API-232 getPublicSample | GET /api/v2/sample | SPEC-348, SPEC-350 |
| API-233 createPrivateSampleProject | POST /api/v2/sample-projects | SPEC-348, SPEC-350 |
| API-234 pollProjectEvents | GET /api/v2/projects/{projectId}/events | SPEC-303, SPEC-312, SPEC-313, SPEC-315, SPEC-337 |
| API-235 renewAgentClaim | POST /api/v2/projects/{projectId}/agent/work/{workId}/renew | SPEC-315 |
| API-236 releaseAgentClaim | POST /api/v2/projects/{projectId}/agent/work/{workId}/release | SPEC-315 |

## 계약 결정

1. 잘못된 입력은 400, 없거나 다른 소유자의 비공개 객체는 404, 인증한 역할의 금지 동작은 403, 오래된 콘텐츠·revision·잘못된 상태·요청 키·lease·커밋 선후 관계의 충돌은 409로 정합니다. 빈 목록은 200과 []이며 성공은 영구 저장을 뜻합니다. 429에는 Retry-After가 있습니다. 모든 오류는 RFC 9457 application/problem+json과 안전한 code·traceId를 사용합니다. 라우팅 404·405와 요청 크기 오류도 같은 형식이며 405의 Allow 헤더를 보존합니다.
2. 사용자 전용 체크포인트·제안 결정은 불투명한 소유자 세션과 출처·CSRF 검사를 사용합니다. 기계는 별도 프로젝트 bearer 자격 증명을 사용하며 브라우저 신원으로 대체할 수 없습니다. 다른 소유자의 조회는 없는 객체와 구분하지 않습니다. 쿠키·자격 증명 해시·공급자 토큰·원본 진단·다른 소유자의 데이터는 화면 응답 스키마에 포함하지 않습니다.
3. 변경 요청의 Idempotency-Key는 소유자·프로젝트·동작별 범위로 24시간 이상 보존합니다. 같은 내용은 하나의 영구 결과를 재전달하고 다른 내용은 idempotency_conflict입니다. 일회성 자격 증명 비밀값은 결과 저장에서 명시적으로 제외합니다. 200 재전달에는 공개 메타데이터와 secret_not_replayed만 제공합니다. 응답 유실 시 철회·재발급하며 평문으로 보관하지 않습니다. 일회성 비공개 응답에 대한 유일한 예외입니다.
4. 사용자 결정은 본문의 expected_revision·content_version으로 트랜잭션 안에서 표시 버전을 비교합니다. 답변은 새 산출물이 생겨도 원래 질문의 콘텐츠 버전에 남습니다. 대화 조회는 lease 토큰 없이 정제한 에이전트 작업 상태를 제공하며 다이어그램 조회는 소스 기반 노드·관계·속성 목록을 반환합니다. 명령·이벤트·플로우 단계의 개별 대화를 위해 부모 추적 ID에 결정적인 하위 키를 붙일 수 있으며 전체 길이는 80자 이하입니다. 부모 ID 번호는 바꾸지 않습니다. 10분 lease는 명시적으로 갱신하고 만료된 쓰기는 거부하며 대기 작업을 다시 claim할 수 있습니다. 첫 버전은 커서 조회를 사용하고 AI 스트림·서버 내부 공급자 호출은 제공하지 않습니다.
5. 공개 가입은 설정 가능한 OIDC 어댑터·authorization code·PKCE를 사용합니다. state·nonce는 한 번 검증하고 issuer·audience·signature를 확인하며 코드 교환을 보호하고 세션을 교체합니다. 유휴 만료는 30분, 절대 수명은 8시간입니다. 공급자 등록은 후속 구현의 외부 선행 조건이며 완료한 설정이 아닙니다. 리디렉션은 검증한 같은 출처의 복귀 경로만 사용하고 실패 로그에 토큰·code·state를 기록하지 않습니다.
6. 버전 입력은 RFC 8785 정규 JSON입니다. version=nexus.content/1, parser_contract, 정규 상대 경로순으로 정렬한 source_files와 원본 UTF-8의 SHA-256, 경로순 첨부 digest를 포함합니다. 이 입력의 SHA-256이 content_version입니다. 소스 커밋·게시 시간과 장치 전용 테마·접힘·선택·배치는 입력 밖의 출처·표시 메타데이터입니다. 알 수 없는 소스·파서·관계·스키마·첨부 변경은 보수적으로 새 버전으로 처리합니다. 승인을 유지하려고 검토 원본에서 임의 필드를 제거하지 않습니다.
7. 새 v2 게시는 읽기 전용 레포 연결로 GitHub 기본 브랜치의 커밋 선후 관계를 검증합니다. 비공개 레포 연결 권한·공급자 설정은 외부 선행 조건이며 없으면 source_verification_unavailable로 거부합니다. 설정한 GitHub 호스트·API 경로만 사용하고 임의 URL을 가져오지 않습니다. 기존 업로드 라우트는 새 버전의 호환성 QA까지 hub 형식·Access 인증 어댑터를 유지합니다. 새 hub v2 전송에는 연결한 상위·제품 PR과 계약 검사가 필요하며 hub-ref.json을 조용히 바꾸지 않습니다.
8. 소유자 인증으로 HTML을 가져온 뒤 불투명한 sandbox에서 렌더링합니다. 쿠키 권한·동일 출처 기능·네트워크·폼 제출·탐색·팝업·저장소·부모 메시지 신뢰를 부여하지 않습니다. 독립적인 HTML을 지원하고 외부 자산은 차단합니다. 출시 전에 합성 fixture에서 악성 링크·스크립트·자격 증명 접근·쓰기를 시도해 격리를 검사해야 합니다.
9. 모든 HTTP 동작은 인증·성공과 오류 예시·표준 응답 생략 이유를 명시합니다. 필드 길이·전체 제한·안전한 거부 메시지는 목업과 후속 실제 서버 검사의 입력입니다. 현재는 계약과 예시를 정적으로 검증하며 목업 응답을 실제 권한·저장 동작의 증거로 보지 않습니다.

## 호환성 변경 목록

v2 라우트·소유자 세션·범위가 제한된 자격 증명·소스 형식은 새 계약이며 기존 스냅샷·Access client ID와 secret의 의미를 바꾸지 않습니다. 기존 OpenAPI와 원본 인터페이스 문서는 바이트 단위로 보존합니다. JSON 등록은 기존 ID·제목·상태·추적 연결을 보존하고 원본 소스를 가리킵니다. 새 서비스를 검사하는 동안 기존 API를 기존 보호 뒤에서 유지합니다. 이전 시 기존 프로젝트를 검증한 소유자에게 연결하고 공개로 바꾸지 않습니다. 코멘트·체크포인트의 원래 ID·버전을 유지합니다. 호환 어댑터가 이전 클라이언트를 지원하며 v2 전환은 상위 계약 검사를 포함한 WBS 작업으로 명시합니다. 이번 설계에서 런타임 의존성·유료 공급자를 추가하지 않습니다.

## 확인과 후속 실행

OpenAPI 3.1과 모든 이름 있는 응답 예시를 스키마로 검증하며 오류·일회성 자격 증명 재전달도 포함합니다. 서버 동작마다 API·운영 인터페이스 연결을 확인합니다. 클라이언트 전용 테마에는 네트워크 동작이 없습니다. 이후 이 계약의 개발 목업, 모든 응답에 대한 실제 서버 계약 검사, 08의 브라우저 상태 연결을 구현합니다. 실제 공급자 인증·Git 선후 관계·v2 업로드·제한·이전·복구를 현재 통과했다고 주장하지 않습니다.

## 클라이언트 조회와 버전 참조

Work는 원래 질문과 대화·파트·단계·항목·버전 ID를 제공합니다. 에이전트는 작업 범위를 확인하는 API-208/API-209로 참조 원본을 조회하고 ID를 추측하지 않고 API-212/API-217을 호출할 수 있습니다. Discussion은 리비전·원래 범위와 독립적으로 페이지를 조회하는 제안 본문·버전·리비전을 반환하며 반영 근거와 수락을 구분합니다. 게시 자격 증명은 대화를 읽을 수 없습니다. 산출물·개요·이력은 체크포인트 ID를 제공하고 산출물은 API-231에 필요한 ID를 제공합니다. 한 번도 게시하지 않은 누락 산출물은 원본 정보·ID가 null일 수 있습니다. 과거 항목은 게시본 안의 파트·단계·산출물을 구분합니다. 체크포인트 이력은 원래 수행자와 사유를 보존합니다. 공유 405 응답은 유효한 오류 상태·코드와 필수 Allow 헤더를 갖습니다. 기존 플로우를 완성하는 설계 필드이며 새 HTTP 동작이나 런타임 구현을 뜻하지 않습니다.

수정한 계약의 동작 응답 예시 323개와 공유 405 거부 예시를 검증했습니다. 독립적인 정적 조회·메모리 DDL 검사 22개와 기존 외부 계약 검사 9개를 통과했습니다. 원본 정보·이력은 게시 ID·서버 스냅샷 리비전·게시 시각도 제공해 명시한 화면을 응답만으로 구현할 수 있습니다. 설계 검증이며 실제 v2 서비스 검사는 아닙니다.

HTML 호스트는 신뢰하는 상위 HTML 응답에 `frame-src 'none'`를 적용하고 `srcdoc` 하위 프레임으로만 표시해야 합니다. 샌드박스와 하위 조회 정책만으로는 자체 탐색을 차단하지 못합니다. 로컬 Chromium 픽스처에서 상위 정책이 없을 때 샘플 요청 1개, 있을 때 0개를 확인했습니다. 엄격한 정책에서도 차단된 탐색 전에는 하위 화면과 내부 동작이 실행되었습니다. 고정한 호스트 정책을 먼저 적용하고 불투명 `allow-scripts`만 허용하며 탐색 거부 시 다시 열기·원본을 제공합니다. 브라우저 개념 검사이며 실제 서버·다른 브라우저 격리는 배포 QA로 남습니다.

과거 조회는 콘텐츠 버전 외에 publication_id를 받아 다른 커밋의 같은 콘텐츠도 정확한 원본으로 조회합니다. 작업·대화의 원래 게시본도 함께 제공합니다. 다시 연 대화는 본문·수행자·고정 원본/PR 근거를 가진 결정 목록을 별도 페이지로 조회하며 추가 전용 결정 테이블에 보존합니다. PR 링크는 선택 사항이고 수신한 게시본·커밋이 검증된 원본이며 기존의 미검증 근거는 구분합니다.

질문 생성도 선택한 publication_id를 요구해 같은 콘텐츠 해시 때문에 대화의 원래 게시본이 바뀌지 않게 합니다. 체크포인트 조회는 정확한 원래 게시본을 제공하며 생성은 보호된 트랜잭션에서 보유 게시본을 사용합니다.
