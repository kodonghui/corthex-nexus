# NEXUS 재설계: 제품 요구사항

[English](rebuild.md)

상태: 2026-11-18 설계 기준 버전 1.0입니다. 사용자님이 현재 추천안과 설계 완료까지의 진행을 승인하셨습니다. [승인 기록](../decisions/rebuild-authorization.md)에 따라 50개 요구사항을 설계 입력으로 확정합니다. 버전에 연결된 NEXUS 통과는 별개이며 AI가 만들지 않았습니다.

## 1. Product and evidence

NEXUS는 한 사람이 여러 프로젝트를 진행하면서 각 프로젝트의 13단계 산출물을 그림으로 보고, 항목에 대해 AI와 대화하고, 직접 체크포인트를 통과시키는 공개 범용 도구입니다. 승인된 다섯 이벤트 흐름은 프로젝트 연결, 단계 검토, 항목 대화, 버전 재검토, 마이그레이션과 배포입니다. 제품 목표를 정한 것이며 기존 구현 재사용을 결정한 것은 아닙니다.

출처: B1은 2026-11-17 사용자님의 재설계 지시입니다. C1은 [01단계](../01-domain/rebuild.ko.md)의 타임라인 통과와 두 추천안 승인입니다. F1은 같은 날의 후속 지시(PRD 진행, 검토 전 병합·push, CI 수정·설정 자동화)입니다. P1은 이 PRD에서 새로 제안하며 범위 검토가 필요한 내용입니다. 출처는 근거를 나타내며, 파생 요구사항 전체의 승인을 의미하지 않습니다.

01에서 새 컨텍스트 다섯 개·명령·애그리게이트 규칙·컨텍스트 맵·용어를 작성했습니다. 아래 행은 새 컨텍스트에 연결됩니다. 첫 버전은 하나의 서비스 안에 논리 모듈을 둡니다. 과거 경계를 승인 근거로 물려받지 않습니다. 프로젝트·스냅샷·항목·대화·체크포인트·콘텐츠 버전은 새 용어 표를 따릅니다.

Legacy sources, code, and PRs [50](https://github.com/kodonghui/corthex-nexus/pull/50), [53](https://github.com/kodonghui/corthex-nexus/pull/53), [56](https://github.com/kodonghui/corthex-nexus/pull/56) are reference evidence only. The new batch starts at REQ-301, after the existing maximum REQ-295; unused numbers are not reused definitions. Part `rebuild` records this cycle. Legacy `nexus` approvals are preserved and do not approve these rows.

## 2. Release scope

첫 릴리스 범위는 다섯 흐름, 13단계 검토 화면, 소스와 연결된 대화, 버전에 연결된 사용자 전용 체크포인트, 안전한 동기화, 계정·프로젝트 격리, 라이트·다크 테마, 검증된 마이그레이션·복구입니다. 개인 계정이 있는 공개 서비스를 제공 방식으로 추천하며, 인증 제공자·요금제·서버 아키텍처를 확정한 것은 아닙니다.

단계 화면의 대상은 도메인 이벤트·컨텍스트 맵, PRD 항목, 유저 플로우 다이어그램, 기능 명세 항목, ERD, OpenAPI 검토, 사이트맵, 모든 화면 상태, 커밋된 대화형 HTML 목업, WBS, 개발·PR 근거, 브라우저 QA 근거, 발표 자료입니다. 지원하지 않거나 없는 표현은 빈 성공 표시 대신 명시적인 상태로 보여야 합니다. 도메인 보드와 다이어그램 작성 도구는 해당 단계에서 정합니다.

NEXUS 안에서 산출물을 직접 편집하는 기능, 팀·공유 프로젝트 권한, 추가 외부 도구 연결은 이후 릴리스로 미루는 안을 제안합니다. 첫 릴리스에도 한 사람의 프로젝트에서 여러 AI 세션을 쓰는 기능, 버전 관리된 소스 변경, 기존 hub, 필수 단계 도구의 소스 링크는 포함합니다. 다섯 흐름의 승인은 이 세 가지 범위 선택까지 확정한 것이 아닙니다.

## 3. Requirements

All rows are `active` for the design baseline. Must is required for the first release; Should is a measured target with any shortfall adjudicated before release. Priority does not automatically pass a checkpoint. Each row contains one EARS response and an explicit context.

| ID | Requirement | Type | Priority | Context | Source | Status |
| --- | --- | --- | --- | --- | --- | --- |
| REQ-301 | 인증된 사용자가 NEXUS를 열면 시스템은 그 사용자에게 접근 권한이 있는 프로젝트만 표시해야 합니다. | functional | Must | CTX-035 | B1 | active |
| REQ-302 | 사용자가 프로젝트를 전환하면 시스템은 선택한 프로젝트의 단계와 대화 컨텍스트를 복원해야 합니다. | functional | Must | CTX-033 | B1 | active |
| REQ-303 | 사용자가 프로젝트를 열면 시스템은 13개 단계의 현재 상태를 표시해야 합니다. | functional | Must | CTX-033 | B1 | active |
| REQ-304 | 단계에 산출물이 없으면 시스템은 해당 산출물을 미작성 상태로 표시해야 합니다. | functional | Must | CTX-033 | B1 | active |
| REQ-305 | 지원하는 다이어그램 산출물이 게시되면 시스템은 소스를 읽을 수 있는 그림으로 표시해야 합니다. | functional | Must | CTX-033 | B1 | active |
| REQ-306 | 다이어그램 외의 단계 산출물이 게시되면 시스템은 해당 단계에 맞는 검토 화면을 제공해야 합니다. | functional | Must | CTX-033 | B1 | active |
| REQ-307 | 사용자가 목업 산출물을 열면 시스템은 레포에 커밋된 HTML 목업을 검토할 수 있게 해야 합니다. | functional | Must | CTX-033 | B1 | active |
| REQ-308 | 사용자가 산출물을 확인하면 시스템은 소스 커밋과 소스 위치를 표시해야 합니다. | functional | Must | CTX-033 | C1 | active |
| REQ-309 | 사용자가 산출물 항목을 선택하면 시스템은 해당 항목의 고정된 검토 주소를 열어야 합니다. | functional | Must | CTX-033 | B1 | active |
| REQ-310 | 사용자가 항목의 소스를 요청하면 시스템은 표시된 버전과 일치하는 소스 위치를 열어야 합니다. | functional | Should | CTX-033 | P1 | active |
| REQ-311 | 사용자가 항목 코멘트를 등록하면 시스템은 코멘트를 항목과 검토한 산출물 버전에 연결해야 합니다. | functional | Must | CTX-033 | B1 | active |
| REQ-312 | 항목 코멘트에 AI 응답이 요청되면 시스템은 이를 해당 프로젝트의 AI 작업 목록에 표시해야 합니다. | functional | Must | CTX-033 | C1 | active |
| REQ-313 | AI 응답이 기록되면 시스템은 원래 항목의 대화에 응답을 표시해야 합니다. | functional | Must | CTX-033 | B1 | active |
| REQ-314 | 대화에서 결정이 기록되면 시스템은 근거 대화와 소스 변경에 연결된 결정을 보존해야 합니다. | functional | Must | CTX-033 | C1 | active |
| REQ-315 | AI 세션이 항목을 점유한 동안 시스템은 같은 프로젝트에서 작업하는 다른 세션에 점유 상태를 표시해야 합니다. | functional | Should | CTX-033 | P1 | active |
| REQ-316 | AI가 산출물 변경을 제안하면 시스템은 소스 변경이 확인될 때까지 제안 상태로 표시해야 합니다. | functional | Must | CTX-033 | P1 | active |
| REQ-317 | 에이전트가 체크포인트를 요청하면 시스템은 요청을 게시된 default branch 산출물 버전에 연결해야 합니다. | functional | Must | CTX-034 | F1 | active |
| REQ-318 | 권한이 있는 사용자가 체크포인트를 통과시키면 시스템은 검토한 버전에 대한 사용자 결정을 기록해야 합니다. | functional | Must | CTX-034 | B1 | active |
| REQ-319 | AI 자격 증명으로 체크포인트 통과를 시도하면 시스템은 해당 동작을 거부해야 합니다. | functional | Must | CTX-034 | B1 | active |
| REQ-320 | 필수 체크포인트가 대기 중인 동안 시스템은 종속 단계의 완료 처리를 차단해야 합니다. | functional | Must | CTX-034 | F1 | active |
| REQ-321 | 승인된 버전 뒤에 새 콘텐츠 버전이 게시되면 시스템은 이전 버전의 승인 이력을 보존해야 합니다. | functional | Must | CTX-034 | C1 | active |
| REQ-322 | 승인된 버전 뒤에 새 콘텐츠 버전이 게시되면 시스템은 새 버전에 대해 새로운 체크포인트를 요구해야 합니다. | functional | Must | CTX-034 | C1 | active |
| REQ-323 | 사용자가 승인을 철회하면 시스템은 철회 기록을 체크포인트 이력에 보존해야 합니다. | functional | Must | CTX-034 | P1 | active |
| REQ-324 | 산출물의 검토 화면 메타데이터만 바뀌면 시스템은 콘텐츠 버전의 체크포인트 상태를 유지해야 합니다. | functional | Should | CTX-034 | P1 | active |
| REQ-325 | 제출한 소스 커밋이 default branch에 병합되지 않았으면 시스템은 현재 프로젝트 스냅샷으로 게시하는 것을 거부해야 합니다. | functional | Must | CTX-032 | F1 | active |
| REQ-326 | 프로젝트를 처음 업로드할 때 시스템은 해당 프로젝트의 첫 업로드에 대한 동의를 요구해야 합니다. | functional | Must | CTX-032 | B1 | active |
| REQ-327 | 자동 push가 끝나면 시스템은 대상 커밋이 NEXUS에 실제 반영되었는지 보고해야 합니다. | functional | Must | CTX-032 | F1 | active |
| REQ-328 | 업로드가 실패하면 시스템은 게시 완료로 표시하지 않고 재시도할 수 있는 결과를 보존해야 합니다. | functional | Must | CTX-032 | P1 | active |
| REQ-329 | 수신한 스냅샷이 현재 default branch 스냅샷보다 오래되었으면 시스템은 현재 스냅샷의 교체를 거부해야 합니다. | functional | Must | CTX-032 | P1 | active |
| REQ-330 | 시스템은 자격 증명 값을 로그, 레포 산출물, 사용자에게 표시하는 처리 결과에서 제외해야 합니다. | non-functional | Must | CTX-035 | F1 | active |
| REQ-331 | 권한이 있는 운영자가 push CI를 설정하면 시스템은 해당 세션의 환경 변수에서 CI 시크릿 값을 읽어야 합니다. | functional | Must | CTX-032 | F1 | active |
| REQ-332 | 사용자가 권한 없이 다른 사용자의 비공개 프로젝트 데이터를 요청하면 시스템은 접근을 거부해야 합니다. | functional | Must | CTX-035 | B1 | active |
| REQ-333 | 사용자가 공개 서비스에 가입하면 시스템은 계정에 연결된 프로젝트 온보딩 플로우를 제공해야 합니다. | functional | Must | CTX-035 | P1 | active |
| REQ-334 | 저장된 테마 설정 없이 NEXUS를 열면 시스템은 라이트 테마를 사용해야 합니다. | functional | Must | CTX-033 | B1 | active |
| REQ-335 | 사용자가 테마를 선택하면 시스템은 같은 기기의 다음 세션을 위해 설정을 보존해야 합니다. | functional | Must | CTX-033 | P1 | active |
| REQ-336 | 시스템은 320~1440 CSS 픽셀 너비에서 동작이나 텍스트가 사라지지 않도록 프로젝트 검토를 지원해야 합니다. | non-functional | Must | CTX-033 | P1 | active |
| REQ-337 | 검토 화면이 로딩, 빈 상태, 접근 거부 또는 오류 상태이면 시스템은 해당 상태와 가능한 다음 동작을 표시해야 합니다. | functional | Must | CTX-033 | B1 | active |
| REQ-338 | 시스템은 첫 릴리스의 검토 및 체크포인트 플로우에서 WCAG 2.2 AA를 충족해야 합니다. | non-functional | Must | CTX-033 | P1 | active |
| REQ-339 | 시스템은 정의된 검토 부하 조건에서 프로젝트 및 단계 검토 화면을 P95 2초 이내에 표시해야 합니다. | non-functional | Should | CTX-033 | P1 | active |
| REQ-340 | 시스템은 정의된 대화 부하 조건에서 항목 코멘트 쓰기를 P95 1초 이내에 확인해야 합니다. | non-functional | Should | CTX-033 | P1 | active |
| REQ-341 | 기존 프로젝트 스냅샷을 마이그레이션하거나 다시 push하면 시스템은 프로젝트와 항목의 식별자를 보존해야 합니다. | functional | Must | CTX-036 | B1 | active |
| REQ-342 | 기존 서버 대화를 마이그레이션하면 시스템은 작성 주체, 순서, 버전 참조를 보존해야 합니다. | functional | Must | CTX-036 | B1 | active |
| REQ-343 | 기존 체크포인트를 마이그레이션하면 시스템은 원래 결정과 검토 버전 참조를 보존해야 합니다. | functional | Must | CTX-036 | B1 | active |
| REQ-344 | 전환 후 릴리스 검증이 실패하면 시스템은 확인된 모든 쓰기 기록을 반영하여 이전 서비스로 복구할 수 있어야 합니다. | functional | Must | CTX-036 | C1 | active |
| REQ-345 | 새 버전이 릴리스 QA를 통과하지 않은 동안 시스템은 기존 운영 서비스를 유지해야 합니다. | functional | Must | CTX-036 | B1 | active |
| REQ-346 | 시스템은 운영 전환 전에 보존 대상 프로젝트 전체의 마이그레이션 및 복구 리허설을 통과해야 합니다. | non-functional | Must | CTX-036 | B1 | active |
| REQ-347 | 시스템은 릴리스 전에 첫 릴리스 유저 플로우 전체의 브라우저 실행 검증을 통과해야 합니다. | non-functional | Must | CTX-036 | B1 | active |
| REQ-348 | 예시 데이터를 사용하면 시스템은 실제 사용자 프로젝트 데이터와 분리해서 관리해야 합니다. | functional | Should | CTX-033 | P1 | active |
| REQ-349 | 소스 산출물에 실행 코드나 지시문 형태의 신뢰할 수 없는 콘텐츠가 포함되면 시스템은 영향 범위를 승인된 산출물 표시 경계로 제한해야 합니다. | non-functional | Must | CTX-033 | P1 | active |
| REQ-350 | CORTHEX 설치 이력이 없는 사용자가 시작하면 시스템은 예시 프로젝트를 게시하고 검토하는 문서화된 절차를 제공해야 합니다. | functional | Must | CTX-032 | P1 | active |

## 4. Acceptance boundaries and measurement

REQ-305 includes domain, flow, ERD and sitemap diagrams. REQ-306 covers PRD/spec/WBS lists, an OpenAPI view, screen-state review, QA evidence and presentation review. REQ-307 requires repository HTML for both themes; candidate selection and every-state coverage belong to stage 09. A browser preview must follow the content-isolation boundary of REQ-349; serving arbitrary active HTML with account/session authority is not approved.

REQ-308 shows source repository/path/commit and the artifact's content version. REQ-309's address remains meaningful after later uploads, including a clear removed-item state. REQ-311 preserves comments on removed or revised items. REQ-314 distinguishes a proposal, verified PR merge and actual NEXUS reflection. REQ-320 permits parallel preparation explicitly authorized by the user, while keeping dependent stage completion gated; it never grants an agent the checkpoint action.

The selected REQ-324 threshold excludes theme preference, read receipts and visual layout from artifact content; reviewable text, semantic relationships, schema, attachments and mockup changes create a new content version under REQ-322. Compute SHA-256 over canonical normalized source content, ordered artifact manifest and parser/render-contract version; exclude only the enumerated display metadata. Unknown changes invalidate conservatively. Stage 06 fixes the canonical envelope and examples. Checkpoint history identifies version, user decision and time; migration must not reinterpret it as current-version approval.

REQ-330 is checked with synthetic credentials against stdout/stderr, subprocess argv, local files and CI logs. GitHub Actions' encrypted secret store is the intended destination of CI setup, not a local plaintext copy. Actual configuration needs installed/authenticated gh; unavailable gh skips with one line. Workflow creation uses a PR and cannot pass a human checkpoint. The current harness task implements this integration independently of approval of the rebuilt product.

REQ-336 is measured at widths 320, 768 and 1440 in both themes, checking text, focus and controls; diagrams may pan/zoom within their own view. REQ-338 uses automated checks plus keyboard, focus, contrast and screen-reader review of every first-release flow. These are design acceptance targets, not measured product outcomes.

REQ-339's review-load profile is an isolated staging service behind the intended authentication boundary, with 100 projects, up to 3,000 items per project and 20 concurrent authenticated sessions. Measure browser navigation start to usable content across at least 200 warmed navigations, excluding neither authentication checks nor ordinary network time; record region/device/network and cold-start observations separately. REQ-340 uses the same staging boundary and 20 concurrent sessions, at least 200 comment submissions, measuring submit to durable-save acknowledgement; AI generation time is excluded and reported separately. These targets require a recorded environment and raw results, not a local fixture timing.

REQ-341~343은 기존 프로젝트 세 개를 포함한 보존 대상 전체의 프로젝트, 항목 ID, 콘텐츠 버전, 코멘트·답글, 작성 주체, 체크포인트 통과·철회 목록을 요구합니다. 스냅샷 재전송만으로 서버 전용 대화와 승인을 복구할 수 없습니다. 운영 전환 전에 개수·고정 ID를 대조하고 버전·상위 참조를 검사하며 보호된 서버 기준 데이터와 보존된 내용을 비교합니다. 실제 데이터와 자격 증명을 Git에 복사하지 않습니다.

REQ-344 and REQ-346 require a consistent backup, restore into an isolated environment, write reconciliation during a controlled switch window, rollback procedure and a recorded rehearsal. A pre-switch backup alone does not account for writes accepted after the switch. REQ-345 keeps the current service unchanged until release QA passes. No new production access-control change is authorized by this draft.

REQ-347 means executing every first-release flow and its states in browser-agent QA, with light/dark, desktop/mobile and supported-browser coverage defined at stages 08/12. Fixtures and real-service observations are labeled separately. Human checkpoint tests use isolated synthetic data and never pass a real user's checkpoint. REQ-349 is measured by malicious text/link/HTML fixtures showing no execution outside the permitted preview, no credential access and no writes beyond the artifact boundary.

## 5. Scope decisions

- Q1, selected A on 2026-11-18: delivery is a public service with individual accounts and private projects (REQ-332/333/350). B is public source plus self-hosted individual installations for the first release, with hosted signup deferred. Either keeps the mandated public, general-purpose vision. Authentication provider, payment and infrastructure are later design decisions.
- Q2, selected A on 2026-11-18: defer direct artifact editing, shared-team projects and extra tool integrations for the first release, retaining source-controlled updates and required stage-tool links. B adds named capabilities now; their requirements and impact must be drafted before scope freeze.
- Q3, selected A on 2026-11-18: apply REQ-321/322 to content/semantic changes and REQ-324 to display-only metadata. B requires a new checkpoint for every source commit, including display-only changes. The earlier decision to preserve history and freshly review changed content stays in force.

## 6. Independent coverage check and supersession

독립 점검표는 13단계 산출물, 다섯 이벤트 흐름, 사용자·AI·권한 없는 주체, 로딩·빈 상태·오류·접근 거부, 여러 프로젝트 동시 진행, 마이그레이션·복구를 조합한 목록입니다. 기존 구현과 별도의 요구사항 점검이며 시장 조사는 아닙니다. 계정 격리, 산출물 부재 상태, 오래된 업로드, 삭제된 항목의 대화, 전환 후 쓰기 복구를 발견해 위 행에 반영했습니다. 남은 질문은 Q1~Q3와 새 도메인 입력입니다. 범위 확정 때 누락 여부를 한 번 요청합니다.

기존 개인 기기·Access 전용 제품 범위는 새 지시의 공개 제품 방향으로 대체합니다. 운영 서비스의 접근 제어는 검증된 릴리스까지 유지합니다. 기존 편집기 검토, 확정된 목업 토큰, 서버 선택, 이전 단계 승인을 재설계의 승인으로 사용하지 않습니다. GitHub CI 설정 작업은 F1으로 별도 허용되었으며 앱 아키텍처를 선택하지 않습니다. 과거 `nexus.md`의 요구사항은 삭제하거나 대체 처리하지 않으며 새 행은 별도 작업의 초안입니다.

## 7. Checks and next checkpoint

게시 전에 ID 중복, 영한 문서 일치, 행마다 EARS 응답 하나, 유형·우선순위·출처·상태, 측정 가능한 NFR, 고정된 hub 스냅샷의 새 행 50개, 알 수 없는 새 ID 부재, 기존 산출물 보존을 확인합니다. Must 기능 요구사항 38개에는 아직 04단계 명세가 없습니다. 완전한 추적성이 있다고 표시하지 않고 정확한 req-without-spec 경고 ID와 이유를 기록합니다. 누락된 컨텍스트 연결은 별도 미완성 항목으로 직접 검사합니다. 자동 검사는 공개 가입·마이그레이션·제품 QA의 실행 근거가 아닙니다.

Publish this main-merged baseline through the hub, verify the held commit and fifty active requirements, and leave a version-review request in NEXUS. Its current project-wide list also contains legacy rows: search the new batch using `REQ`, a hyphen and `3`. The Korean copy is the review translation; English remains the repository source. Continue stage 03 under the current explicit design instruction, while retaining the actual NEXUS checkpoint state. No agent acts as the human approver.

