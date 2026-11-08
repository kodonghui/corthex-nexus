# NEXUS: 요청, 명령, 형식

[English](nexus.md)

CORTHEX 자신의 프로젝트에서 NEXUS 0.2의 06단계입니다: OpenAPI 계약 [nexus.openapi.yaml](nexus.openapi.yaml)에 있는 NEXUS 서버의 요청, 그리고 이 파일에 있는 그 계약이 따르는 규칙, 허브의 명령, 그것과 함께 가는 파일의 형식입니다. 상태: 2026-11-02에 관리자가 그날 고른 대로 기억 플러그인을 만드는 동안, 사용자 흐름, 기능 명세, 서버의 자료의 추천을 따라 초안을 썼습니다. 관리자가 2026-11-03에 03\~05단계, 07·08단계와 함께 이 파일의 확인 지점을 통과시켜, 10단계가 작업을 나누기 전에 NEXUS 0.2의 요청, 명령, 형식이 고정되었습니다. 이제 호환되지 않는 변경을 하려면 관리자의 결정이 필요합니다. 2026-11-03에 관리자가 01단계 이벤트 스토밍을 NEXUS에서 하기로 고르면서 DDD 보드의 그림 자료에 선택 항목 `timeline`을 더했고(호환되는 변경), ② 차례의 작업 보드를 편집 곁에 적었습니다. 둘 다 관리자가 같은 날 통과시켰습니다([확인할 것](#확인할-것)). 관리자의 2026-11-06 다시 디자인은 페이지와 요청 API-151\~API-159, 그리고 API-101\~API-103, API-118, API-119와 허브의 `comment`·`reply`의 변경을 계획하며, 계약과 코드는 다시 디자인을 만들 때 그것을 받아들입니다. API-118, API-119와 허브 명령의 변경은 만들어졌습니다([다시 디자인의 인터페이스](#다시-디자인의-인터페이스)). ② 차례, 곧 PC에서 고치기와 01단계 워크숍은 그 01\~04단계가 2026-11-06과 2026-11-07에 통과했으며, 요청 API-161\~API-173, 허브의 명령 API-174\~API-176, 그리고 0.2와 다시 디자인의 인터페이스의 변경을 계획하고, 계약과 코드는 ② 차례를 만들 때 다시 디자인 뒤에 그것을 받아들입니다([② 차례의 인터페이스](#②-차례의-인터페이스)). 이 단계의 ② 차례 확인 지점이 05단계의 것과 함께 2026-11-08 09:33(KST)에 이것들을 통과시켰습니다([확인할 것](#확인할-것)). 계약은 그 안에 있는 모든 요청, 응답, 예시, 오류 코드의 원본이고, 이 파일은 그것을 설명하며 나머지의 원본입니다. 이 번역과 영어 원문이 다르면 영어 원문이 원본입니다.

입력: [docs/04-functional-spec/nexus.ko.md](../04-functional-spec/nexus.ko.md)의 기능 명세(SPEC-101\~SPEC-156, ② 차례는 SPEC-170\~SPEC-186), 특히 그 [06단계를 위한 메모](../04-functional-spec/nexus.ko.md#06단계-요청-명령-형식); [docs/05-erd/nexus.ko.md](../05-erd/nexus.ko.md)와 [nexus.sql](../05-erd/nexus.sql)의 서버의 자료와 파일(TBL-101\~TBL-118, ② 차례는 TBL-119\~TBL-124), 그 [06단계를 위한 메모](../05-erd/nexus.ko.md#06단계-요청-명령-형식)와 상한; [docs/02-prd/nexus.ko.md](../02-prd/nexus.ko.md)의 요구사항; [docs/01-domain/nexus.ko.md](../01-domain/nexus.ko.md)의 용어집과 DDD 보드(이 파일은 그 말을 그 뜻으로 씁니다); 그리고 지금 도는 1차, 곧 [app.js](../../nexus/src/app.js), [snapshot.js](../../nexus/src/snapshot.js), [store.js](../../nexus/src/store.js)의 서버와, [snapshot.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex-nexus/skills/corthex-hub/references/snapshot.md), [reading.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex-nexus/skills/corthex-hub/references/reading.md)가 설명하는 [hub.py](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex-nexus/skills/corthex-hub/scripts/hub.py)의 허브입니다. 사이트맵(07단계)은 나중이라 아직 입력에 화면 ID가 없고, 요청은 사용자 흐름과 기능 명세가 적은 화면을 맡습니다.

이 단계의 기본 계약은 Swagger UI로 읽는 `api/openapi.yaml`입니다. NEXUS 서버에는 HTTP API가 있으므로 계약은 단계가 말하는 대로 OpenAPI 3.1이고, 다른 부분의 인터페이스 옆에 `docs/06-api/nexus.openapi.yaml`로 둡니다. 사람은 프로젝트의 Notion 기록에 있는 한국어 사본으로 읽고, 파일 자체는 Swagger UI 같은 OpenAPI 보기 도구로 읽습니다. `.corthex/project.json`이 이 선택을 적어 둡니다. 허브의 명령은 HTTP 요청이 아니므로 이 파일이 MEMORY의 [인터페이스](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/docs/06-api/memory.ko.md)와 같은 꼴로 정합니다: 명령마다 API ID, 맡는 동작, 결과가 있습니다.

## 승인된 원 서버 로그인 (2026-11-04)

독립 서버는127.0.0.1에서만 듣고 cloudflared Tunnel로 연결합니다. ctx.access가 없으므로 Cf-Access-Jwt-Assertion의 RS256 서명·설정한 팀 발급자·ACCESS_AUD·만료·nbf를 직접 확인하고 기존의 user/agent 분류를 씁니다. Worker는 원래의 ctx.access·대상 확인도 유지합니다. 설정 누락이나 잘못된 서명은 닫힌 상태로 거절하며 발급자/키 주소를 토큰에서 고르지 않습니다. 기존 Access 정책과 HTTP 요청·응답·스냅샷 형식은 바꾸지 않습니다. 구현·실제 두 종류 시험은 TASK-260/264에서 확인합니다.

## 응답 예제 적용성 (0.2.1, 2026-11-05)

대표자가 아래 공유 예제18개의 예제 전용 정정을 승인했습니다. 그 정확한 옛 예제는 해당 작업에 적용되지 않습니다.400/413 응답을 없애거나 코드·스키마·입력·역할·서버 동작을 바꾸지 않습니다. 원래 TC ID와 이전 결과는 QA 이력에 **해당 없음**으로 남기며 통과로 세지 않습니다. 올바른 필드별 예제7개는 별도 사례이고 새 QA ID를 따로 부여합니다.

| 옛 TC | 작업/상태 | 옛 예제 | 해당 없는 이유 | 현재의 별도 예제 |
| --- | --- | --- | --- | --- |
| TC-908 | API-120#400 | `invalid-field` | 본문을 읽지 않음. | 없음 |
| TC-957 | API-122#413 | `text-too-long` | 실제 필드·한도가 `text`/4000과 다름. | `reason-too-long`: `reason`, 2000 |
| TC-971 | API-123#400 | `invalid-field` | 본문을 읽지 않음. | 없음 |
| TC-986 | API-124#400 | `invalid-field` | 본문을 읽지 않음. | 없음 |
| TC-988 | API-124#400 | `missing-session` | 사용자 전용 요청은 에이전트 세션을 무시함. | 없음 |
| TC-1001 | API-125#400 | `invalid-field` | 본문을 읽지 않음. | 없음 |
| TC-1003 | API-125#400 | `missing-session` | 사용자 전용 요청은 에이전트 세션을 무시함. | 없음 |
| TC-1022 | API-126#400 | `invalid-field` | `text` 입력이 없으며 잘못된 본문은 `body`로 거부함. | `invalid-body`: `body` |
| TC-1036 | API-126#413 | `text-too-long` | 실제 필드·한도가 `text`/4000과 다름. | `pull-request-too-long`: `pull_request`, 2000 |
| TC-1043 | API-127#400 | `invalid-field` | 본문을 읽지 않음. | 없음 |
| TC-1045 | API-127#400 | `missing-session` | 사용자 전용 요청은 에이전트 세션을 무시함. | 없음 |
| TC-1057 | API-128#400 | `invalid-field` | `text` 입력이 없으며 잘못된 본문은 `body`로 거부함. | `invalid-body`: `body` |
| TC-1059 | API-128#400 | `missing-session` | 사용자 전용 요청은 에이전트 세션을 무시함. | 없음 |
| TC-1067 | API-128#413 | `text-too-long` | 실제 필드·한도가 `text`/4000과 다름. | `words-too-long`: `words`, 2000 |
| TC-1081 | API-129#400 | `invalid-field` | 본문을 읽지 않음. | 없음 |
| TC-1083 | API-129#400 | `missing-session` | 사용자 전용 요청은 에이전트 세션을 무시함. | 없음 |
| TC-1095 | API-130#400 | `invalid-field` | `text` 입력이 없으며 잘못된 본문은 `body`로 거부함. | `invalid-body`: `body` |
| TC-1109 | API-130#413 | `text-too-long` | 실제 필드·한도가 `text`/4000과 다름. | `pull-request-too-long`: `pull_request`, 2000 |

옛 계약의 작업/상태/미디어/예제 참조는411개였습니다.393개를 그대로 두고 정확한 옛 예제18개를 제외한 뒤 올바른 참조7개를 추가하므로 **현재 명명 예제는400개**입니다. 공유 구성요소 정의의 개수는 별도입니다. 모의 응답과 실제 HTTP 근거는 분모를 구분하며 새 거부7개를 옛 TC18개 중7개의 통과로 바꾸지 않습니다. 따라서 다른 작업을 적용하기 전 원래710 ID는 통과626·부분66·해당 없음18이며, 새 QA7행을 추가할 때 전체 분모를 따로 바꿉니다.

자동 [예제 적용성 검사](../../nexus/test/contract_example_check.py)는 필드 위치·한도를 작업의 요청 스키마와 비교하고 사용자 전용 작업의 에이전트 세션 누락 예제를 거부합니다. 본문 없는 동작에서 실제 적용되는 헤더 거부 예제는 남습니다. 실행기에 복사된 입력 스키마는 바뀌지 않았습니다.

## 이 파일을 읽는 법

- 서버의 요청은 계약의 작업 API-101\~API-132입니다. 작업마다 `operationId`, 맡는 동작(SPEC), 보낼 수 있는 쪽, 줄 수 있는 모든 응답과 그 이름 붙은 예시, 그리고 `x-corthex.omit` 아래에 줄 수 없는 응답과 그 까닭이 있습니다. [인터페이스](#인터페이스)가 목록을 보이고, 계약이 정합니다.
- 허브의 명령 API-133\~API-150은 [허브의 명령](#허브의-명령)이 옵션, 결과, 종료 코드와 함께 정합니다.
- 응답은 그 요청의 ID와 상태로 `API-105#409`처럼 적고, 명령의 결과는 그 ID와 결과로 `API-136#refused`처럼 적습니다.
- 오류 코드는 `commit_not_replaced`처럼 적습니다. [오류 코드](#오류-코드)는 계약의 `components.x-corthex.errors`대로 코드마다 상태, 뜻, 더하는 멤버, 사용자가 보는 말, 클라이언트가 하는 일을 적습니다.
- 서버의 시각은 `2026-11-03T09:00:00.000Z`처럼 밀리초까지 UTC이고, 기기나 Git의 시각은 그 시간대를 지닙니다. 바이트 크기는 UTF-8로 세고, 글자 수는 05단계처럼 코드 포인트로 셉니다.
- 상태: 지금 도는 1차가 주는 것은 `built`, NEXUS 0.2가 더하거나 바꾸는 것은 `active`, 다시 디자인의 인터페이스 API-151\~API-159는 `planned`이며 [다시 디자인의 인터페이스](#다시-디자인의-인터페이스)가 그것을 정합니다. 계약은 API-155 말고는 그것을 지니고, 서버가 답하기 전까지 `x-corthex.status: planned`로 표시합니다. ② 차례의 인터페이스 API-161\~API-176은 `later (phase ②)`이며, [② 차례의 인터페이스](#②-차례의-인터페이스)가 같은 방법으로 그것을 정합니다.
- `~/.corthex/`는 사용자 홈 폴더의 CORTHEX 폴더이고, Windows에서는 `%USERPROFILE%\.corthex\`입니다. 허브의 파일은 1차처럼 `~/.corthex/hub/` 아래에 있습니다.

## 출처

2026-11-02에 읽은 문서:

- Cloudflare Access와 Workers. [Cloudflare Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/): Worker는 Access가 인증한 요청에서만 애플리케이션의 `aud`와 `getIdentity()`가 있는 `ctx.access`를 받고, 정적 자산을 내줄 때는 받지 못합니다. [애플리케이션 토큰](https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/application-token/): 사람의 토큰에는 `sub`와 `email`이 있고, 서비스 토큰의 토큰에는 `common_name`에 그 토큰의 클라이언트 ID가, `sub`에는 빈 값이 있습니다. [JWT 검증](https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/): 토큰은 `Cf-Access-Jwt-Assertion` 헤더로 오고, 팀의 키는 `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`에 있습니다. [서비스 토큰](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/): 클라이언트는 `CF-Access-Client-Id`와 `CF-Access-Client-Secret` 헤더를 보냅니다.
- 무료 요금제의 한도: [Workers](https://developers.cloudflare.com/workers/platform/limits/)는 요청마다 CPU 시간 10 ms와 하위 요청 50개, 하루 요청 100,000개; [D1](https://developers.cloudflare.com/d1/platform/limits/)은 호출마다 쿼리 50개, 데이터베이스마다 500 MB입니다.
- [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html), HTTP API의 문제 세부 정보(Problem Details): `type`이 없으면 `about:blank`라는 뜻이고, 미디어 형식은 `application/problem+json`이며, 문제는 자기 멤버를 더할 수 있고 그것을 모르는 클라이언트는 무시하며, `status`는 응답 자신의 상태입니다.
- [Idempotency-Key HTTP 헤더 필드](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/), 2026-10-22의 08판, RFC가 아닌 인터넷 초안: 키는 구조화 필드 값(Structured Field Values)의 String이라 큰따옴표 안에 씁니다. 다른 요청과 함께 다시 보낸 키는 `422`를, 첫 요청을 아직 처리하는 중인 키는 `409`를 받는 것이 좋다고 합니다. NEXUS가 어디서 다른지는 [쓰기 ID](#쓰기-id)가 말합니다.

아직 보지 못한 것: 실제 Access 설정에서의 두 가지 로그인, 그리고 문서가 말하지 않는 서비스 토큰에 대한 `getIdentity()`의 결과. [로그인](#로그인)이 이것을 열린 질문으로 둡니다.

## 인터페이스

기능 명세의 모든 동작에 인터페이스가 있습니다. 스텝별 보기(SPEC-141)는 제 요청이 없고, 그림 보기가 읽는 그림(API-111)을 보여 줍니다. 다시 디자인의 동작 SPEC-143\~SPEC-156의 계획한 인터페이스는 [다시 디자인의 인터페이스](#다시-디자인의-인터페이스)에, ② 차례의 동작인 PC에서 고치기와 워크숍(SPEC-134, SPEC-142, SPEC-170\~SPEC-186)의 것은 [② 차례의 인터페이스](#②-차례의-인터페이스)에 있습니다.

### 서버의 요청 목록

계약이 정하고, 이 표는 목록을 보입니다. 보낼 수 있는 쪽: `사용자`는 사람 자신의 로그인, `에이전트`는 서비스 토큰, `둘 다`는 둘 모두입니다([로그인](#로그인)).

| API | 요청 | 코드 이름 | 보낼 수 있는 쪽 | 맡는 동작 | 상태 |
| --- | --- | --- | --- | --- | --- |
| API-101 | `GET /` | `getHubPage` | 둘 다 | SPEC-113, SPEC-122, SPEC-123, SPEC-124, SPEC-125 | active |
| API-102 | `GET /pictures/{project}/{part}/{stage}` | `getPictureViewPage` | 둘 다 | SPEC-113, SPEC-119 | active |
| API-103 | `GET /overview/{project}/{part}/{stage}` | `getStageOverviewPage` | 둘 다 | SPEC-113, SPEC-138, SPEC-139 | active |
| API-104 | `GET /code/{file}` | `getViewCode` | 둘 다 | SPEC-113, SPEC-119 | active |
| API-105 | `POST /api/snapshots` | `pushSnapshot` | 둘 다 | SPEC-111, SPEC-112, SPEC-113, SPEC-114, SPEC-117, SPEC-118, SPEC-120, SPEC-121, SPEC-140 | active |
| API-106 | `GET /api/snapshots` | `listSnapshots` | 둘 다 | SPEC-113, SPEC-122 | built |
| API-107 | `GET /api/snapshots/{project}` | `getSnapshot` | 둘 다 | SPEC-113, SPEC-122 | built |
| API-108 | `DELETE /api/snapshots/{project}` | `removeProject` | 둘 다 | SPEC-113, SPEC-115 | active |
| API-109 | `GET /api/snapshots/{project}/held` | `getHeldCommit` | 둘 다 | SPEC-111, SPEC-112, SPEC-113 | active |
| API-110 | `GET /api/snapshots/{project}/removal` | `getRemovalDryRun` | 둘 다 | SPEC-113, SPEC-115 | active |
| API-111 | `GET /api/spaces/{project}/pictures/{part}/{stage}` | `getPicture` | 둘 다 | SPEC-113, SPEC-118, SPEC-119, SPEC-141 | active |
| API-112 | `GET /api/spaces/{project}/overview/{part}/{stage}` | `getStageOverview` | 둘 다 | SPEC-113, SPEC-138 | active |
| API-113 | `GET /api/spaces/{project}/todo` | `getAgentTodo` | 둘 다 | SPEC-113, SPEC-135, SPEC-136 | active |
| API-114 | `GET /api/spaces/{project}/comments/{comment}` | `getComment` | 둘 다 | SPEC-113, SPEC-127, SPEC-132, SPEC-135 | active |
| API-115 | `GET /api/spaces/{project}/proposals/{proposal}` | `getProposal` | 둘 다 | SPEC-113, SPEC-130, SPEC-131 | active |
| API-116 | `GET /api/spaces/{project}/edits/{edit}` | `getEdit` | 둘 다 | SPEC-113, SPEC-133 | active |
| API-117 | `GET /api/spaces/{project}/checkpoints/{checkpoint}` | `getCheckpoint` | 둘 다 | SPEC-113, SPEC-140 | active |
| API-118 | `POST /api/spaces/{project}/comments` | `leaveComment` | 둘 다 | SPEC-113, SPEC-116, SPEC-126, SPEC-128, SPEC-143, SPEC-151 | active |
| API-119 | `POST /api/spaces/{project}/comments/{comment}/replies` | `replyToComment` | 둘 다 | SPEC-113, SPEC-116, SPEC-127, SPEC-128, SPEC-132, SPEC-143 | active |
| API-120 | `POST /api/spaces/{project}/comments/{comment}/answered` | `markAnswered` | 둘 다 | SPEC-113, SPEC-116, SPEC-127 | active |
| API-121 | `POST /api/spaces/{project}/comments/{comment}/decisions` | `recordDecision` | 에이전트 | SPEC-113, SPEC-116, SPEC-128, SPEC-132 | active |
| API-122 | `POST /api/spaces/{project}/proposals` | `makeProposal` | 에이전트 | SPEC-113, SPEC-116, SPEC-128, SPEC-130 | active |
| API-123 | `POST /api/spaces/{project}/proposals/{proposal}/withdraw` | `withdrawProposal` | 에이전트 | SPEC-113, SPEC-116, SPEC-130 | active |
| API-124 | `POST /api/spaces/{project}/proposals/{proposal}/accept` | `acceptProposal` | 사용자 | SPEC-113, SPEC-116, SPEC-131 | active |
| API-125 | `POST /api/spaces/{project}/proposals/{proposal}/dismiss` | `dismissProposal` | 사용자 | SPEC-113, SPEC-116, SPEC-131 | active |
| API-126 | `POST /api/spaces/{project}/edits/{edit}/report` | `reportEdit` | 에이전트 | SPEC-113, SPEC-116, SPEC-128, SPEC-133, SPEC-136 | active |
| API-127 | `POST /api/spaces/{project}/edits/{edit}/dismiss` | `dismissEdit` | 사용자 | SPEC-113, SPEC-116, SPEC-133 | active |
| API-128 | `POST /api/spaces/{project}/checkpoints` | `passCheckpoint` | 사용자 | SPEC-113, SPEC-116, SPEC-139 | active |
| API-129 | `POST /api/spaces/{project}/checkpoints/{checkpoint}/withdraw` | `withdrawCheckpoint` | 사용자 | SPEC-113, SPEC-116, SPEC-139 | active |
| API-130 | `POST /api/spaces/{project}/checkpoints/{checkpoint}/report` | `reportCheckpoint` | 에이전트 | SPEC-113, SPEC-116, SPEC-128, SPEC-136, SPEC-140 | active |
| API-131 | `POST /api/spaces/{project}/claims/{entry}` | `claimEntry` | 에이전트 | SPEC-113, SPEC-116, SPEC-136 | active |
| API-132 | `DELETE /api/spaces/{project}/claims/{entry}` | `releaseEntry` | 에이전트 | SPEC-113, SPEC-116, SPEC-136 | active |

#구현에서 분명히 한 점(2026-11-04): API-130은 보고된 열린 PR 없이 `merged`·`closed`를 보내거나, 저장된 기록이 이미 가리키는 체크포인트에 새 `opened`를 보내면 `409 checkpoint_state`로 답합니다. 마지막 보고의 반복은 여전히 무변경입니다. SPEC-140의 상태 전이를 유지하면서 빠진 거절을 채웠습니다.

## 허브의 명령 목록

| ID | 이름 | 보내는 요청 | 맡는 동작 | 상태 |
| --- | --- | --- | --- | --- |
| API-133 | `snapshot` | 없음 | SPEC-101, SPEC-102, SPEC-103, SPEC-104, SPEC-105, SPEC-106, SPEC-107, SPEC-108, SPEC-109, SPEC-110 | active |
| API-134 | `status` | 없음 | SPEC-109, SPEC-137, SPEC-140 | active |
| API-135 | `build` | 없음 | SPEC-122, SPEC-123, SPEC-125 | active |
| API-136 | `push` | API-109, API-105 | SPEC-111, SPEC-112, SPEC-129 | active |
| API-137 | `remove` | API-110, API-108 | SPEC-115 | active |
| API-138 | `todo` | API-113 | SPEC-135, SPEC-129 | active |
| API-139 | `comment` | API-118 | SPEC-128, SPEC-129, SPEC-135, SPEC-143, SPEC-151 | active |
| API-140 | `reply` | API-119 | SPEC-127, SPEC-128, SPEC-129, SPEC-132, SPEC-143 | active |
| API-141 | `answered` | API-120 | SPEC-127, SPEC-128, SPEC-129 | active |
| API-142 | `decide` | API-121 | SPEC-132, SPEC-128, SPEC-129 | active |
| API-143 | `propose` | API-122 | SPEC-130, SPEC-128, SPEC-129 | active |
| API-144 | `withdraw` | API-123 | SPEC-130, SPEC-128, SPEC-129 | active |
| API-145 | `reflect` | API-126 | SPEC-133, SPEC-128, SPEC-129 | active |
| API-146 | `record` | API-130 | SPEC-140, SPEC-128, SPEC-129 | active |
| API-147 | `show` | API-114, API-115, API-116, API-117 | SPEC-132, SPEC-133, SPEC-140 | active |
| API-148 | `claim` | API-131 | SPEC-136 | active |
| API-149 | `release` | API-132 | SPEC-136 | active |
| API-150 | `outbox` | 담긴 쓰기의 요청 | SPEC-129 | active |

## 다시 디자인의 인터페이스

2026-11-06 다시 디자인과 함께 SPEC-143\~SPEC-156을 위해 계획했습니다. 그 확인 지점 3이 이것을 보고, 계약, 서버, 허브는 다시 디자인을 만들 때 0.2의 요청과 같은 규칙으로 이것을 받아들입니다: 모든 요청에 Access(SPEC-113), 거절에 문제 세부 정보, 쓰기에 쓰기 ID, 그리고 보기 화면의 코드 말고는 어떤 응답도 캐시하지 않습니다.

| ID | 요청 | 코드 이름 | 보낼 수 있는 쪽 | 맡는 동작 | 상태 |
| --- | --- | --- | --- | --- | --- |
| API-151 | `GET /api/home` | `getHome` | 둘 다 | SPEC-113, SPEC-143, SPEC-144, SPEC-145 | planned |
| API-152 | `GET /api/spaces/{project}/talk/{part}/{stage}` | `getStageTalk` | 둘 다 | SPEC-113, SPEC-150 | planned |
| API-153 | `GET /p/{project}` | `getProjectPage` | 둘 다 | SPEC-113, SPEC-146 | planned |
| API-154 | `GET /p/{project}/{part}/{stage}` | `getStagePage` | 둘 다 | SPEC-113, SPEC-146\~SPEC-151, SPEC-155, SPEC-156 | planned |
| API-155 | `GET /` | `getHomePage` | 둘 다 | SPEC-113, SPEC-143, SPEC-144, SPEC-145, SPEC-154 | planned |
| API-156 | `GET /api/search` | `searchItems` | 둘 다 | SPEC-113, SPEC-152 | planned |
| API-157 | `GET /api/spaces/{project}/items/{id}` | `getItem` | 둘 다 | SPEC-113, SPEC-149 | planned |
| API-158 | `GET /api/spaces/{project}/stages/{part}/{stage}` | `getStage` | 둘 다 | SPEC-113, SPEC-147, SPEC-148 | planned |
| API-159 | `POST /api/spaces/{project}/comments/{comment}/recommended` | `takeRecommendation` | 사용자 | SPEC-113, SPEC-116, SPEC-143 | planned |

- API-151은 첫 화면을 한 번의 읽기로 답합니다. 내 차례: 합계와 함께 50개까지의 줄이며, 줄마다 종류, 프로젝트, 부분, 단계, 항목, 인용, 에이전트의 마지막 글의 첫 300자, 그 시각과 `asks`가 있습니다. 프로젝트마다 AI 할 일의 목록별 개수와 맡은 것의 개수. 그리고 저장된 스냅샷과 공간에서 만든 프로젝트마다의 카드: 그 부분들의 지금 단계와 다음 행동, 13단계의 상태와 항목 수, 경고, 그리고 그림마다 그 단계, 지금 단계인지, 열린 의견, 작은 그림. 작은 그림은 서버가 라벨 없이 그린 그 그림의 첫 그림입니다(2026-11-04의 첫 그림 표시 결정).
- API-152는 단계의 대화를 답합니다: 열린 제안과 의견을 사용자를 기다리는 것부터, 하나하나 그 항목이나 단계 전체, 인용, 쓴 쪽의 종류와 시각, 마지막 답글, `asks`, 그리고 맡음이 이어지는 동안 그 맡음의 시작과 함께; 스냅샷에 더는 그 항목이 없는 의견은 따로; 그리고 닫힌 것의 개수. `item`은 한 항목으로 좁히고, `closed=1`은 닫힌 것을 최근 것부터 50개씩 더합니다.
- API-158은 단계의 머리와 항목을 답합니다: SPEC-147이 적는 머리와 프로젝트가 그 단계를 읽는지, 읽지 않으면 그 까닭(`head.reads`), API-112의 단계 기록, 프로젝트의 이름·저장소·커밋(`project`), 작업 공간의 단계 목록을 위한 그 부분의 13단계와 저마다의 상태·항목 수·그림·내 차례 수(`stages`), 그리고 `after` 다음의 항목 200개씩입니다. 항목은 `filter`(기본인 `all`, `talk`, `mine`, `left` 가운데 하나)와 200자까지의 `q`로 거르고, `group`(기본인 `context`나 `source`)으로 묶습니다.
- API-157은 한 항목을 답합니다: 그 필드와 이름, 컨텍스트, 스냅샷의 커밋과 함께 원문의 자리, 단계별로 그 항목이 나온 곳과 이어지는 곳, 그리고 API-152가 주는 대로 그 의견들입니다. 프로젝트의 어느 단계에도 없으면 `404` `item_not_found`이며, 보기 화면은 그 항목을 아직 적은 의견들을 API-152로 읽고, 그 의견들은 거기서 따로 보입니다.
- API-156은 2자부터 200자까지의 `q`를 받아, 저장된 모든 스냅샷에서 20개까지 찾아 답합니다. 하나하나 프로젝트, 부분, 단계, ID, 제목이 있습니다.
- API-159는 사용자를 기다리는 의견에서 에이전트의 추천을 따릅니다. `asks`가 `recommended`이면, `settles`가 있는 API-119처럼, 서버의 언어로 "추천대로"라는 말을 담아 의견을 매듭짓는 사용자의 답글을 더합니다. `asks`가 `checkpoint`이면, API-128처럼, 그 말과 함께 그 의견을 `comment`에 담아 의견의 부분과 단계의 확인 지점도 통과시킵니다. 둘 다 쓰기 ID와 함께 한 트랜잭션에서 일어납니다. 의견이 더는 사용자를 기다리지 않거나 따를 수 있는 것을 묻지 않으면 `409` `not_recommended`이고, 그 밖에는 API-119와 API-128의 거절입니다.
- 페이지 API-153\~API-155는 0.2의 페이지처럼 자료를 지니고([페이지 자료](#페이지-자료)), 그 코드는 API-104에서 옵니다. API-153은 프로젝트의 지금 단계로 `302`를 답하고, 모르는 프로젝트에는 `404`를 답합니다.

0.2 인터페이스의 변경이며, 다시 디자인을 만들 때 합니다:

1. API-101 `getHubPage`는 `GET /hub`로 옮깁니다(SPEC-153). `GET /`는 API-155가 됩니다.
2. API-102와 API-103은 자기 페이지 대신 단계의 페이지로 `302`를 답하고, 두 번째는 `#view=list`를 붙입니다(SPEC-154). 그 ID는 리다이렉트로 남습니다. 브라우저는 `302`를 간직하지 않으므로 서버는 0.2로 돌아갈 수 있습니다.
3. API-118 `leaveComment`는 13단계의 키 어느 것이든 받고 그림이 필요 없습니다. 단계 전체에 남기는 의견은 `item`이 비어도 됩니다(SPEC-151). 13개 밖의 단계 키는 `stage` 칸의 `400` `invalid_request`, 저장된 스냅샷에 없는 부분은 `404` `part_not_found`로, 0.2에 이미 있는 코드입니다. 에이전트의 의견은 `asks`를 지닐 수 있습니다.
4. API-119 `replyToComment`: 에이전트의 답글은 `asks`를 지닐 수 있고, 사용자의 답글은 의견의 `asks`를 비웁니다.
5. 허브의 `comment`(API-139)는 그림이 있는 단계만이 아니라 13단계 어느 것이든 `--stage`로 받고, 단계 전체에는 `--item`을 뺍니다. `comment`와 `reply`(API-140)는 `--asks answer|recommended|checkpoint`를 받습니다. 이것은 `kodonghui/corthex`에 있는 허브의 변경이므로 허브 페이지 템플릿의 새 토큰(09단계)과 함께 그곳의 풀 리퀘스트로 들어오고, 이 저장소의 규칙대로 이 저장소의 `hub-ref.json`은 제품 검사와 함께 그 정확한 커밋으로 옮깁니다.

변경 3\~5는 만들어졌습니다: 계약과 서버는 kodonghui/corthex-nexus#50에서 05단계의 변환 4와 함께, 허브 0.3.0은 kodonghui/corthex#172에서 만들었고, `hub-ref.json`은 그 커밋 `318035d`을 적습니다. 그것을 쓰면서 정한 두 가지: 무엇을 묻는지는 에이전트만 말하므로 사용자의 `asks`는 `asks` 칸의 `400` `invalid_request`로 거절합니다. 그리고 `commit`을 뺀 의견은 그림의 문서 판을, 그림이 없는 단계에서는 간직한 기본 브랜치 커밋을 받고, 저장된 스냅샷에 그것이 없으면 `commit` 칸으로 거절합니다.

계약은 TASK-265부터 API-151\~API-154와 API-156\~API-159를 `x-corthex.status: planned`로 표시해 지니며, 계약 검사는 서버가 답하기 전까지 그것을 뺍니다. API-155는 API-101을 옮길 때 함께 옵니다(TASK-271). 그것을 쓰면서 정한 것:

- 꼴이 다른 쿼리 값은 경로 값과 달리 그 칸의 `400` `invalid_request`입니다([주소와 경로](#주소와-경로)).
- API-152의 `closed`는 `0`이나 `1`을 받고, `after`는 보기 화면이 이미 지닌 글의 수를 100,000까지 셉니다. 대화의 맡음은 그 시작을 `claimed_at`으로 주며, 에이전트 자신의 읽기에서는 빠질 수 있습니다.
- API-158의 `filter`는 기본인 `all`도 받고, `group`의 기본은 `context`입니다. 항목의 컨텍스트는 그 링크가 적은 컨텍스트, 컨텍스트라면 자기 ID, 아니면 그 항목이 나온 항목 가운데 컨텍스트가 있는 첫 항목의 것으로, 한 단계씩 거슬러 찾습니다. 컨텍스트가 없는 항목은 마지막 묶음입니다. `counts`는 낱말 `q`와 함께 각 거르기의 항목 수를 줍니다.
- API-157은 부분을 쿼리 값 `part`로 받고, 빼면 프로젝트의 첫 부분이며, 대화를 `comments`로 지닙니다. 문제 세부 정보는 그 코드의 칸만 지니므로 `item_not_found`는 의견을 지니지 않습니다: 보기 화면은 그 항목을 아직 적은 의견들을 그 항목으로 좁힌 API-152로 읽고, 거기서 따로 보입니다.
- API-151의 작은 그림은 서버가 처음 놓은 그림을 이름 없이 정수 단위의 상자와 선으로, 각각 2,000개까지 주며, 놓기에 너무 복잡한 그림은 null입니다. 카드의 제목은 제목들처럼 120자에서 자릅니다.
- API-156은 20개까지 답하고, 하나하나 프로젝트의 첫 부분에서 열립니다.
- API-159는 의견의 상태, 의견을 매듭짓는 답글, 확인 지점을 답하며, 추천을 이미 따랐으면 `changed`가 false입니다. 이렇게 통과한 확인 지점은 `comment`에 그 의견을 적습니다.
- 단계 페이지는 `corthex-stage-page/0.3`을 지니고([페이지 자료](#페이지-자료)), 새 코드는 `item_not_found`와 `not_recommended` 두 개입니다([오류 코드](#오류-코드)).

## ② 차례의 인터페이스

② 차례, 곧 PC에서 고치기와 01단계 워크숍(SPEC-134, SPEC-142, SPEC-170\~SPEC-186)을 위해 05단계의 [② 차례의 표](../05-erd/nexus.ko.md#②-차례의-표) 위에 계획했으며, 그 01\~04단계는 2026-11-06과 2026-11-07에 통과했습니다. 이 단계의 ② 차례 확인 지점이 05단계의 것과 함께 2026-11-08 09:33(KST)에 통과시켰고, 계약, 서버, 허브는 ② 차례를 만들 때 다시 디자인 뒤에 0.2의 요청과 같은 규칙으로 받아들입니다: 모든 요청에 Access(SPEC-113), 거절에 문제 세부 정보, 쓰기에 쓰기 ID, 에이전트의 쓰기에 세션 이름표와 AI 할 일의 맡음(SPEC-136), 그리고 보기 화면의 코드 말고는 어떤 응답도 캐시하지 않습니다.

| ID | 요청 | 코드 이름 | 보낼 수 있는 쪽 | 맡는 동작 | 상태 |
| --- | --- | --- | --- | --- | --- |
| API-161 | `GET /api/spaces/{project}/drafts/{part}/{stage}` | `getEditDraft` | 둘 다 | SPEC-113, SPEC-134, SPEC-170 | later (phase ②) |
| API-162 | `POST /api/spaces/{project}/drafts/{part}/{stage}` | `saveEditDraft` | 사용자 | SPEC-113, SPEC-116, SPEC-134 | later (phase ②) |
| API-163 | `POST /api/spaces/{project}/drafts/{part}/{stage}/choice` | `chooseOnConflict` | 사용자 | SPEC-113, SPEC-116, SPEC-170 | later (phase ②) |
| API-164 | `POST /api/spaces/{project}/drafts/{part}/{stage}/send` | `sendEdit` | 사용자 | SPEC-113, SPEC-116, SPEC-171, SPEC-175 | later (phase ②) |
| API-165 | `POST /api/spaces/{project}/drafts/{part}/{stage}/drop` | `dropEditDraft` | 사용자 | SPEC-113, SPEC-116, SPEC-173 | later (phase ②) |
| API-166 | `POST /api/spaces/{project}/edits/{edit}/drop` | `dropEdit` | 사용자 | SPEC-113, SPEC-116, SPEC-172, SPEC-173 | later (phase ②) |
| API-167 | `POST /api/spaces/{project}/positions/{part}/{stage}` | `keepPositions` | 사용자 | SPEC-113, SPEC-116, SPEC-174 | later (phase ②) |
| API-168 | `GET /api/spaces/{project}/workshops` | `listWorkshops` | 둘 다 | SPEC-113, SPEC-142, SPEC-184, SPEC-186 | later (phase ②) |
| API-169 | `POST /api/spaces/{project}/workshops` | `startWorkshop` | 둘 다 | SPEC-113, SPEC-116, SPEC-142, SPEC-186 | later (phase ②) |
| API-170 | `GET /api/spaces/{project}/workshops/{workshop}` | `getWorkBoard` | 둘 다 | SPEC-113, SPEC-142, SPEC-181, SPEC-183, SPEC-186 | later (phase ②) |
| API-171 | `POST /api/spaces/{project}/workshops/{workshop}/changes` | `changeWorkBoard` | 둘 다 | SPEC-113, SPEC-116, SPEC-176, SPEC-177, SPEC-178, SPEC-179, SPEC-186 | later (phase ②) |
| API-172 | `POST /api/spaces/{project}/workshops/{workshop}/read` | `markBoardRead` | 에이전트 | SPEC-113, SPEC-181, SPEC-186 | later (phase ②) |
| API-173 | `POST /api/spaces/{project}/workshops/{workshop}/end` | `endWorkshop` | 사용자 | SPEC-113, SPEC-116, SPEC-184 | later (phase ②) |

| ID | 명령 | 보내는 것 | 맡는 동작 | 상태 |
| --- | --- | --- | --- | --- |
| API-174 | `workshop` | API-168, API-169 | SPEC-142, SPEC-186 | later (phase ②) |
| API-175 | `board` | API-168, API-170, API-172 | SPEC-181, SPEC-183, SPEC-186 | later (phase ②) |
| API-176 | `change` | API-171 | SPEC-179, SPEC-186, SPEC-128, SPEC-129 | later (phase ②) |

### 임시 저장과 보낸 편집

그림이 있는 부분의 단계마다 임시 저장이 하나 열리므로(REQ-240), 임시 저장의 요청은 그림의 경로를 쓰고, 임시 저장의 ID와 출발하는 리비전을 본문에 적습니다(REQ-241). 사용자만 임시 저장을 씁니다(SPEC-116). `{stage}`는 그림이 있는 세 단계 가운데 하나이고, 그림이 없는 단계는 `404` `picture_not_found`를 받습니다.

- **API-161**은 열린 임시 저장을 답합니다: 그 ID, 문서 판(`commit`), 리비전, 바뀐 것 목록, 편집기의 요소, 다시 고치기가 버린 임시 저장의 목록(`earlier`), 만든 때와 마지막으로 저장한 때. 그림의 지금 문서 판인 `latest`를 더하고, 임시 저장이 다른 판에 있으면 `applies`도 더합니다: 바뀐 것마다 순서대로 `true`, 아니면 더는 들어맞지 않는 까닭 `gone`, `changed`, `name-taken`(SPEC-170). 열린 임시 저장이 없으면 `404` `draft_not_found`이고, 그러면 편집기는 그림 자체를 열며 그 첫 저장이 임시 저장을 시작합니다.
- **API-162**는 임시 저장을 저장합니다: `{draft, revision, commit, changes, elements}`. 첫 저장은 `draft: null`, `revision: 0`, 그리고 편집기가 연 그림의 문서 판인 `commit`을 보내고, 새 임시 저장의 ID와 리비전 1과 함께 `201`을 받습니다. 뒤의 저장은 임시 저장의 ID와 그것이 가진 리비전을 `commit` 없이 보내고, 다음 리비전과 함께 `200`을 받습니다. 저장마다 바뀐 것 목록과 요소를 통째로 바꿉니다. 편집기가 연 뒤 첫 저장 전에 그림이 다시 그려졌으면, 임시 저장은 편집기의 판에서 시작하고 API-161이 그것을 편집 충돌로 보여 줍니다. 임시 저장이 다른 리비전을 가졌거나, 두 번째 창에서처럼 첫 저장이 이미 열린 임시 저장을 만나면 `409` `draft_revision`이며, 그 `draft`, `revision`, `saved_at`이 마지막으로 저장한 임시 저장을 알려 주고 화면은 그것을 불러오기를 권합니다(REQ-241). 적은 임시 저장을 이미 보냈거나 버렸으면 `409` `draft_closed`. 바뀐 것, 요소, 앞 목록이 1 MiB를 넘거나 바뀐 것이 300개를 넘으면 `413` `draft_too_large`, 본문이 1 MiB를 넘으면 `413` `body_too_large`, 공간의 글이 8 MiB를 넘게 되면 `409` `space_full`입니다.
- **API-163**은 편집 충돌에서 사용자가 고른 것을 받습니다: `{draft, revision, choice, commit}`. `choice`는 `keep`이나 `edit-again`이고, `commit`은 충돌을 보여 준 가장 새 문서 판입니다. `keep`은 임시 저장을 `commit`에 묶습니다(SPEC-170). 바뀐 것이 들어맞지 않으면 `409` `draft_not_applying`으로 거절하며 그 `changes`가 그것을 막는 바뀐 것과 저마다의 까닭을 적고, 임시 저장이 이미 `commit`에 있으면 `changed: false`로 답합니다. `edit-again`은 임시 저장을 버리고 `commit`에서 바뀐 것 없이, 버린 임시 저장의 목록을 `earlier`로 지닌 새 임시 저장을 열며, 새 임시 저장과 함께 `201`을 받습니다. 충돌을 보여 주는 동안 단계별 원본이 또 바뀌었으면 둘 다 `409` `picture_changed`이고, 그 `latest`가 더 새 판을 알려 줍니다.
- **API-164**는 임시 저장을 편집으로 보냅니다: `{draft, revision, note}`, 메모는 200자까지(SPEC-171). 임시 저장의 판이 아직 가장 새 것이면, 서버는 한 배치에서 임시 저장의 ID로 그 판, 바뀐 것 목록, 메모를 지닌 대기 편집을 만들고, 임시 저장을 지우고, 편집을 AI 할 일에 올리며, 그 편집과 함께 `201`을 답합니다. 사용자가 더한 항목을 놓은 자리는 그 바뀐 것의 `at`에 담겨 임시 이름 아래 함께 갑니다(SPEC-175). 판이 더는 가장 새 것이 아니면 `409` `picture_changed`이고 화면은 충돌을 보여 줍니다(SPEC-170). 목록이 비면 `field`가 `changes`인 `400` `invalid_request`, 메모가 비면 `field`가 `note`인 것; 메모가 200자를 넘으면 `413` `text_too_long`; 공간에 반영 대기가 500개 있으면 `409` `reflection_limit`입니다.
- **API-165**는 임시 저장을 버립니다: `{draft, revision}`(SPEC-173). 임시 저장의 행이 그 바이트와 함께 없어집니다. 더는 열려 있지 않고 보내지도 않은 임시 저장은 이미 버린 것이므로 `changed: false`입니다. 보냈으면 `409` `draft_closed`이고 그 편집을 적습니다.
- **API-166**은 편집기에서 보내 기다리는 편집을 버립니다(SPEC-173): 대기 편집이나 사용자가 필요한 편집은 `dropped`가 되어 반영 대기에서 빠지고, 검토 중인 편집은 그 PR을 지닌 채 `dropped`가 되며, 에이전트가 그 PR이 닫혔거나 병합되었다고 보고할 때까지 AI 할 일이 그것을 적습니다(SPEC-185). 편집이 이미 `closed`, `dismissed`, `dropped`이면 SPEC-173대로 그 `state`와 함께 `409` `edit_state`이고, 받은 제안이 만든 편집도 그렇습니다. 그것은 버리기(API-127, dismiss)만 닫습니다. 세션의 맡음은 이것을 결코 거절하지 않습니다(SPEC-136).
- **API-167**은 자리를 둡니다: `{positions}`, `{item, x, y}` 1\~2,000개의 목록이며, 저마다 지금의 그림에 있는 추적 ID, 곧 DDD 보드의 컨텍스트나 애그리거트, ERD의 표, 사이트맵의 화면입니다(SPEC-174). 하나하나 부분의 단계에서 그 항목 아래에 서버의 시각과 함께 두고, 두 창이면 나중 저장이 이깁니다. 그림에 없는 ID는 `400` `unknown_item`이며 그 `items`가 그것을 적고, 부분의 단계가 2,000개를 넘게 되면 `409` `position_limit`입니다. 응답은 둔 개수와 그 단계의 합계를 줍니다.

### 작업 보드

워크숍은 부분의 01단계 작업 보드입니다(SPEC-142). 보드에 대한 에이전트의 쓰기는 맡음에서 그 워크숍의 항목에 대한 것이고([맡음](#맡음)), 보드에 남기는 의견은 스티커나 프레임에 다는 API-118의 의견입니다(SPEC-180).

- **API-168**은 프로젝트의 워크숍을, `part`가 있으면 그 부분의 것을 늘어놓습니다: 열린 것을 먼저, 그다음 끝난 것을 최근 것부터. 저마다 ID, 부분, 진행 방식, 상태, 보드 판, 마지막 스텝, 에이전트가 마지막으로 읽은 판, 시작하고 끝낸 때가 있으며, 합계와 함께 50개씩입니다.
- **API-169**는 워크숍을 시작합니다: `{part, way, text}`. `way`는 사용자가 고른 `draft-first`나 `people-first`이고(REQ-249), 선택인 `text`는 Step 0의 목표와 범위, 4,000자까지입니다. 열린 워크숍을 보드 판 1과 그 Step 0 프레임과 함께 만들고, 둘을 담아 `201`로 답합니다. 사용자는 화면에서 시작하고, 에이전트는 사용자가 세션에서 부탁할 때 허브로 시작합니다(SPEC-186). 열린 것이 있으면 `409` `workshop_open`이며 그 `workshop`이 열린 것을 알려 주고 화면은 그것을 엽니다(REQ-248). `way`가 없으면 `400` `invalid_request`, 저장된 스냅샷에 없는 부분은 `404` `part_not_found`입니다.
- **API-170**은 보드를 답합니다: 상태, 진행 방식, 보드 판, 에이전트가 마지막으로 읽은 것과 함께 워크숍; 스텝 순서대로 프레임, 저마다 그 글, 마지막 변경의 판과 쓴 쪽, 확인 지점, 그리고 그 확인 지점의 상태, 통과한 보드 판, 그 반영의 PR, 원본과 다른지; 떼어진 것도 포함한 모든 스티커, 화살표, 묶음, 저마다 ID, 프레임, 복사한 것의 ID, 필드, 붙인 쪽, 꼬리표, 만든 판과 마지막 변경의 판, 그 변경을 한 쪽과 무엇이었는지; 에이전트가 읽은 뒤의 표시; 그리고 스티커와 프레임마다 열린 의견의 수. 필드는 05단계의 열을 따릅니다. 보드 판인 `since`는 그 판 뒤에 바뀐 프레임과 요소로 좁히고 보드의 판을 함께 주므로, 열린 보드는 10초마다와 다시 보일 때 바뀐 것을 묻습니다(23번). 확인 지점의 `nk_` ID인 `upto`는 그 확인 지점의 스텝까지의 프레임으로 좁히며, 그 프레임은 통과한 뒤 더는 바뀌지 않으므로 통과한 보드 판과 함께 줍니다(21번). 철회한 확인 지점은 `409` `checkpoint_withdrawn`입니다.
- **API-171**은 보드의 마지막 프레임을 바꿉니다: `{frame, operations}`. 선택인 `frame`은 먼저 더할 프레임의 스텝으로, 마지막 프레임에서 떼어진 요소를 뺀 복사본입니다(SPEC-176). `operations`는 1,000개까지의 작업 목록이며, `frame`이 있을 때만 비어도 됩니다. 서버는 워크숍, 프레임, 작업마다 그 작업과 쓴 쪽과 출발하는 판, 그리고 프레임의 상한을 확인한 뒤, 보드 판을 하나 올리는 배치 하나로 모두 쓰거나 아무것도 쓰지 않습니다(SPEC-177, SPEC-179). 응답은 새 보드 판, `changed`, 붙인 요소의 키에 준 ID(`keys`), 쓴 그대로의 요소, 그리고 아무것도 바꾸지 않은 작업의 자리인 `unchanged`를 줍니다. 본문은 1 MiB까지입니다.
- **API-172**는 에이전트가 보드를 읽은 것을 남깁니다: `{version}`, 허브가 빠짐없이 읽은 보드 판이며 세션 이름표와 함께입니다(REQ-259). 남은 읽음보다 옛 판은 두 읽기가 엇갈렸을 때처럼 아무것도 바꾸지 않고(`changed: false`), 나중 읽기가 셈됩니다. 보드의 것보다 높은 판은 `400`입니다. 한 판을 두 번 남겨도 표시는 하나이므로 맡음처럼 쓰기 ID가 필요 없고, 허브는 그것을 보낼 편지함에 결코 두지 않습니다: 다 읽지 못한 읽기는 아무것도 남기지 않습니다(SPEC-181).
- **API-173**은 워크숍을 끝냅니다(SPEC-184): 그 보드는 자료로 읽기만 하게 됩니다. 사용자만 끝내며, 에이전트는 `403` `user_only`를 받고 사용자에게 부탁합니다. 끝난 워크숍은 `changed: false`로 답합니다.

API-171의 작업:

| `op` | 필드 | 할 수 있는 쪽 | 하는 일 |
| --- | --- | --- | --- |
| `place` | `key`, `kind`, `text`, `x`, `y`, 그리고 에이전트는 `label` | 둘 다. 에이전트는 `label`을 꼭 보내고 사용자는 보내지 않음 | 범례의 아홉 종류 가운데 하나인 스티커를 붙이고 붙인 쪽을 표시함(REQ-214, REQ-215, REQ-252) |
| `change` | `sticky`, `version`, 그리고 `kind`, `text`, `x`, `y` 가운데 하나 이상 | 사용자는 어느 스티커든, 에이전트는 자기 것만 | 그것을 바꾸거나 옮김. 사용자의 변경은 에이전트의 꼬리표를 뗌(REQ-253). 핫스팟은 종류를 `answered-hotspot`으로 바꾸어 답함 |
| `confirm` | `sticky`, `version` | 사용자 | 스티커를 그대로 두고 에이전트의 꼬리표를 뗌(REQ-253) |
| `remove` | `sticky`, `version` | 사용자는 어느 스티커든, 에이전트는 자기 것만 | 그 화살표와 함께 접어 두고, 뗀 쪽과 때를 남김(REQ-257) |
| `restore` | `sticky`, `version` | 사용자 | 그 화살표와 함께 되살림 |
| `arrow` | `key`, `from`, `to` | 둘 다 | 프레임의 두 스티커 사이에 화살표를 그림 |
| `unarrow` | `arrow`, `version` | 사용자는 어느 화살표든, 에이전트는 자기 것만 | 걷음 |
| `group` | `key`, `name`, `members` | 둘 다 | 프레임의 스티커 1\~300개를 100자까지의 이름으로 묶음 |
| `regroup` | `group`, `version`, 그리고 `name`이나 `members`나 둘 다 | 사용자는 어느 묶음이든, 에이전트는 자기 것만 | 이름이나 스티커를 바꿈 |
| `ungroup` | `group`, `version` | 사용자는 어느 묶음이든, 에이전트는 자기 것만 | 묶음을 풂 |
| `text` | `version`, `text` | 둘 다 | Step 0의 목표와 범위처럼 4,000자까지의 프레임 자체의 글을 정함 |

- `key`는 변경이 붙이는 요소의 이름으로, ASCII 글자, 숫자, `-`, `_`로 된 1\~40자이며 그 변경 안에서 겹치지 않습니다. 그래서 그 화살표와 묶음이 같은 변경이 붙이는 스티커를 이을 수 있습니다. `from`, `to`, `members`는 스티커의 ID나 같은 변경의 키를 받습니다. `frame`이 있으면 작업은 그 앞 프레임의 스티커, 화살표, 묶음을 적어 새 프레임에 있는 그 복사본을 뜻할 수 있으며, 복사본은 새것이므로 판을 적지 않습니다.
- `version`은 작업이 출발하는 요소의 판이고, `text`이면 프레임의 판입니다. 옛 판이면 `409` `element_changed`로 거절하며, 그 `at`이 목록에서 그 작업의 자리를, `element`가 지금의 요소와 그것을 바꾼 쪽을 알려 줍니다(REQ-256, 23번).
- 결과가 이미 그런 작업, 곧 떼어진 스티커를 떼기, 돌아온 스티커를 되살리기, 꼬리표 없는 스티커를 맞다고 하기, 걷은 화살표를 걷기, 푼 묶음을 풀기는 어떤 판을 적든 아무것도 바꾸지 않고 `unchanged`에 적힙니다(SPEC-178). 그런 작업만 있는 변경은 `changed: false`로 답하고 판을 올리지 않습니다.
- 거절: `409` `workshop_ended`(REQ-218); 아직 올 수 없는 프레임은 다음 스텝이나 Step 9 뒤면 `null`을 `next`에 담은 `409` `frame_not_next`, 그리고 `step`이 1-b나 7인 `409` `checkpoint_waits`(REQ-251); 마지막이 아니거나 확인 지점을 통과한 프레임의 변경은 `409` `frame_closed`(REQ-250); 에이전트가 자기가 붙이지 않은 것을 바꾸거나 옮기거나 떼면 `403` `not_placed_by_agent`(REQ-254); 에이전트의 `confirm`과 `restore`, 그리고 사용자가 프레임을 더하는 `people-first` 보드에서 에이전트의 `frame`은 `403` `user_only`(SPEC-176); 프레임에 없는 ID는 `400` `unknown_item`; 프레임을 건너는 화살표나 묶음, 두 번 쓴 키, 꼬리표 없는 에이전트의 `place`나 꼬리표 있는 사용자의 것은 `400` `invalid_request`; 300자를 넘는 스티커의 글, 100자를 넘는 이름, 4,000자를 넘는 프레임의 글은 `413` `text_too_long`; 프레임 12개, 또는 한 프레임에 떼어진 것을 포함해 스티커 300개, 화살표 600개, 묶음 50개를 넘으면 그 `field`와 `limit`이 적힌 `409` `board_limit`(SPEC-142). 빈 글은 쓰기가 꼭 지녀야 할 글이 모두 그렇듯 `400`입니다.

### ② 차례의 허브 명령

[명령 돌리기](#명령-돌리기)를 따릅니다: 세션 이름표, `--json`, 종료 코드, 그리고 쓰기의 보낼 편지함. 이것은 `kodonghui/corthex`에 있는 허브의 변경이므로 그곳의 풀 리퀘스트로 들어오고, 다시 디자인처럼 이 저장소의 `hub-ref.json`은 제품 검사와 함께 그 정확한 커밋으로 옮깁니다.

`workshop`(API-174):

```txt
hub.py workshop PROJECT [--part PART]
                [--start --way draft-first|people-first [--text TEXT | --text-file FILE]]
```

`--start`가 없으면 그 부분의 워크숍을 늘어놓습니다(API-168). `--start`가 있으면 사용자가 세션에서 고른 진행 방식과, 가린 Step 0의 목표와 범위를 글로 하여 워크숍을 시작합니다(API-169, SPEC-142). 01단계 스킬은 사용자가 부탁할 때만 에이전트가 워크숍을 시작하게 하고, 진행 방식을 스스로 고르지 않게 합니다(REQ-249). `409` `workshop_open`은 열린 워크숍의 ID와 함께 `refused`입니다.

`board`(API-175):

```txt
hub.py board PROJECT [WORKSHOP] [--part PART] [--checkpoint CHECKPOINT] [--since VERSION]
```

보드를 읽습니다(API-170): `WORKSHOP`이 적은 워크숍, 아니면 API-168로 찾은 그 부분의 열린 워크숍. 열린 워크숍이 없으면 그렇게 말하고 종료 코드는 0입니다(SPEC-186). 보드를 프레임마다 출력합니다: 스티커마다 ID, 종류, 글, 붙인 쪽, 꼬리표, 복사한 것의 ID, 떼어졌는지, 그다음 화살표, 묶음, 프레임마다의 확인 지점, 에이전트가 읽은 뒤의 표시. 그 전에 스냅샷을 가리듯 모든 글과 이름을 가리므로, 스티커의 비밀이 단계별 원본에 닿지 않습니다(SPEC-183). 열린 보드를 통째로, 또는 에이전트가 마지막으로 읽은 판보다 늦지 않은 판 뒤로 빠짐없이 읽은 뒤에 그 읽음을 남깁니다(API-172). 확인 지점의 읽기인 `--checkpoint`는 그 스텝까지의 프레임을 통과한 판으로 주고, 뒤의 프레임을 빼므로 아무것도 남기지 않습니다(21번). 끊긴 읽기는 아무것도 남기지 않고 표시도 그대로입니다(SPEC-181).

`change`(API-176):

```txt
hub.py change PROJECT WORKSHOP --file FILE
```

`FILE`(표준 입력이면 `-`)에 있는 변경, 곧 API-171 본문의 JSON 객체를 그 글과 이름을 가린 뒤, 새 쓰기 ID와 세션 이름표와 함께 그 프로젝트의 보낼 편지함 다음에 보냅니다(SPEC-128). 보드 판, 키에 준 ID, 아무것도 바꾸지 않은 작업을 출력합니다. 보낼 수 없는 변경은 통째로 보낼 편지함에서 기다리며 종료 코드는 3이고, 다음 연결 때 갑니다. 그때 거절되면, 이를테면 그동안 프레임이 통과했으면, 보고하고 버리며 에이전트는 보드를 다시 읽습니다(SPEC-179, SPEC-129).

### 0.2와 다시 디자인의 인터페이스의 변경

② 차례를 만들 때 합니다:

1. API-110 `getRemovalDryRun`은 지우기가 지우는 나머지와 함께 열린 임시 저장과 열렸거나 끝난 워크숍을 늘어놓습니다(SPEC-115).
2. API-111 `getPicture`는 `draft`, 곧 부분의 단계에 열린 임시 저장의 표시를 그 ID, 리비전, 문서 판, 마지막 저장과 함께(19번), `positions`, 곧 배치가 출발하는 남은 자리를(SPEC-119, SPEC-174) 얻습니다. 그리고 그 반영 가운데 편집기에서 보낸 편집을 바뀐 것 목록, 메모와 함께, 그림이 다시 그려졌으면 앞 문서 판에서 보냈다고 표시하여(REQ-243, SPEC-172), 그리고 PR이 열린 버린 편집을 줍니다.
3. API-113 `getAgentTodo`는 확인 지점 다음에 `dropped_edits`, 곧 PR이 열린 버린 편집; `workshop_checkpoints`, 곧 아직 반영하지 않은 워크숍의 통과한 확인 지점을 오래된 것부터, 저마다 보드 판과 보고된 PR과 함께; `changed_boards`, 곧 에이전트가 읽은 뒤 사용자가 보드를 바꾼 열린 워크숍을 저마다 바뀐 수와 함께 늘어놓으며, 저마다 합계와 함께 50개까지입니다(SPEC-185). 워크숍의 확인 지점은 그 반영이 기록을 쓰므로 `checkpoints`에 들지 않습니다.
4. API-116 `getEdit`는 편집기에서 보낸 편집이면 `changes`, `note`, `comment`, `dropped_at`을 얻습니다.
5. API-118 `leaveComment`는 `01-domain` 단계에서 그 부분의 워크숍에 있는 스티커의 `ns_` ID나 프레임의 `nf_` ID를 `item`으로 받습니다(REQ-258, SPEC-180). 보드에 없으면 `404` `item_not_found`, 끝난 워크숍에 새 의견이면 `409` `workshop_ended`이며, 그 열린 의견에는 여전히 답할 수 있습니다.
6. API-126 `reportEdit`: `merged`는 `ids`, 곧 편집이 더한 항목에 단계별 원본이 준 ID를 임시 이름별로 받고, 같은 쓰기가 그 ID 아래에 그 자리를 둡니다. 그 ID에 더 새 자리가 이미 있으면 그대로 둡니다(REQ-247, SPEC-175). 편집에 없는 이름은 `400` `unknown_name`이며 그 `names`가 그것을 적고, 편집은 그대로입니다. 편집기에서 보낸 편집이면 `needs-user`와 `merged`가 `comment`, 곧 사용자에게 묻거나 그것이 어떻게 되었는지 알리는 에이전트의 단계 전체 의견을 받습니다(SPEC-171, SPEC-173). 버린 편집은 그 PR에 대한 `closed`(그 PR을 비우고 편집은 버린 채로 남음)와, PR이 있든 없든 `merged`(버린 뒤 반영된 것으로 닫음, 20번)를 받습니다. 다른 보고는 `409` `edit_state`입니다.
7. API-128 `passCheckpoint`는 `01-domain` 단계에서 `frame`과 `board_version`, 곧 사용자가 보는 보드 판에서 그 프레임의 스텝 뒤에 오는 워크숍의 확인 지점을 받습니다(REQ-261, SPEC-182). 그 뒤 보드가 바뀌었으면 그 `version`이 보드의 판을 알려 주는 `409` `board_changed`; 프레임이 보드의 마지막이 아니거나 그 스텝이 1-b, 7, 9가 아니면 그 `step`이 마지막 프레임의 스텝을 알려 주는 `409` `not_checkpoint_step`; 그 확인 지점을 이미 통과했으면 `409` `frame_closed`입니다. Step 9의 확인 지점을 통과시키면 같은 배치에서 워크숍도 끝냅니다(REQ-263).
8. API-129 `withdrawCheckpoint`는 그 프레임이 아직 보드의 마지막이고 그것을 반영하는 PR이 없는 동안에만 워크숍의 확인 지점을 철회합니다: 뒤 프레임을 더했으면 `409` `frame_closed`, 그 반영의 PR을 보고했으면 `409` `pull_request_reported`, 워크숍을 끝낸 마지막 확인 지점은 `409` `workshop_ended`입니다(SPEC-182).
9. API-130 `reportCheckpoint`는 워크숍의 확인 지점이면 PR 없이 사건 `differs`를 받습니다: 보드를 마지막으로 반영한 뒤 다른 PR이 01단계 원본을 바꾸었고, 에이전트가 사용자에게 묻습니다(REQ-265, SPEC-183). 그 `opened`가 이것을 비웁니다. 다른 확인 지점의 `differs`는 `400`입니다.
10. API-131 `claimEntry`와 API-132 `releaseEntry`는 `nb_` ID, 곧 에이전트가 읽은 뒤 사용자가 보드를 바꾼 워크숍을 받습니다. 그 맡음은 다른 맡음처럼, 또는 세션의 읽음이 그 보드를 AI 할 일에서 빼면 끝납니다(SPEC-185).
11. 다시 디자인의 API-151 `getHome`은 프레임에 단 에이전트의 의견이 그 확인 지점을 물으면 그 프레임의 워크숍의 보드 판을 주고, API-159 `takeRecommendation`은 그것을 `board_version`으로 돌려받아 API-128처럼 그 거절과 함께 확인 지점을 통과시킵니다(D15, SPEC-182).
12. 다시 디자인의 API-152 `getStageTalk`는 `01-domain` 단계에서 보드의 의견을 그 스텝과 스티커의 글과 함께(SPEC-180), 그림이 있는 단계에서 편집기에서 보낸 편집을 그 목록과 메모와 함께 줍니다(SPEC-172). API-158 `getStage`는 01단계의 머리에 그 부분의 열린 워크숍을 마지막 스텝, 보드 판과 함께, 그리고 끝난 것들을 적습니다(SPEC-142).
13. 허브: `todo`(API-138)는 ② 차례의 목록을 출력합니다; `comment`(API-139)는 `--stage 01-domain`과 함께 `--item`에 스티커나 프레임의 ID를 받습니다; `reflect`(API-145)는 `merged`와 함께 이름마다 다시 쓰는 `--id NAME=ID`와 `--comment ID`를 받습니다; `record`(API-146)는 `--pr` 없는 사건 `differs`를 받습니다; `claim`과 `release`(API-148, API-149)는 `nb_` ID를 받습니다. 이것은 API-174\~API-176과 함께 핵심 저장소의 풀 리퀘스트로 들어옵니다.

### ② 차례의 요청 이름, 맡음, 상한

| 이름 | 요청 | 보낼 수 있는 쪽 |
| --- | --- | --- |
| `save-draft` | API-162 | 사용자 |
| `draft-choice` | API-163 | 사용자 |
| `send-edit` | API-164 | 사용자 |
| `drop-draft` | API-165 | 사용자 |
| `drop-edit` | API-166 | 사용자 |
| `positions` | API-167 | 사용자 |
| `start-workshop` | API-169 | 둘 다 |
| `board` | API-171 | 둘 다 |
| `end-workshop` | API-173 | 사용자 |

- 보드에 대한 에이전트의 쓰기, 곧 그 변경과 읽음 표시는 그 워크숍의 항목에 대한 것이고, 워크숍의 확인 지점에 대한 그 보고는 `differs`도 그 확인 지점의 것입니다([맡음](#맡음)).
- 임시 저장의 저장과 보드의 변경은 본문이 1 MiB까지이고, ② 차례의 다른 요청은 256 KiB 그대로입니다. 나머지는 05단계의 [상한](../05-erd/nexus.ko.md#상한)이 정합니다: 1 MiB와 바뀐 것 300개의 임시 저장, 200자의 메모, 부분의 단계마다 자리 2,000개, 그리고 프레임 12개에 저마다 스티커 300개, 화살표 600개, 묶음 50개인 보드.

### ② 차례의 형식

임시 저장과 보낸 편집의 **바뀐 것 목록**(TERM-149, REQ-242)은 300개까지의 바뀐 것의 목록이며, 저마다 객체입니다:

| 필드 | 값 |
| --- | --- |
| `kind` | `added`, `renamed`, `changed`, `removed`, `connected`, `disconnected` |
| `item` | 그 항목의 추적 ID. 임시 저장이 더하는 항목이면 그 임시 이름: `new-`와 소문자, 숫자, 하이픈으로 모두 40자까지이고 임시 저장 안에서 겹치지 않음, 이를테면 `new-1` |
| `before` | 그 바뀐 것이 건드리는 항목의 필드를 임시 저장의 판의 그림이 가진 대로, 그림 자료의 요소가 부르는 이름으로 담음([그림 자료](#그림-자료)), 이를테면 `name`, `context`, 열의 정의. `added`이면 비어 있음. 값마다 300자까지 |
| `after` | 바꾼 뒤의 같은 필드. `removed`이면 비어 있음 |
| `to` | `connected`와 `disconnected`이면 다른 항목의 추적 ID나 임시 이름 |
| `at` | `added`이면 `{x, y}`: 사용자가 그 항목을 놓은 곳(SPEC-175) |
| `quote` | 선택: 목록이 그 바뀐 것과 함께 보여 주는 300자까지의 글 |

- 더 새 그림에서 바뀐 것이 들어맞으려면, 그것이 건드리는 항목이 `before`의 필드 그대로 거기 있고, 이음이면 다른 항목도 그렇고, `added`이면 새 그림의 어느 항목도 그 이름을 갖지 않아야 합니다(SPEC-170). 아니면 `applies`가 `gone`, `changed`, `name-taken`을 줍니다. 다시 그리기는 임시 저장에 아무것도 쓰지 않습니다.
- 목록과 메모는 글로만 보이고(REQ-148), 서버는 이 필드만 읽습니다. `elements`는 편집기 자체의 문서, 곧 Excalidraw의 요소나 ERD Editor의 것이며, 서버는 그것을 보낸 그대로 간직해 돌려주고 편집기만 그것을 읽습니다.
- **보드의 요소**는 05단계의 열을 필드로 지닙니다: 스티커의 `id`, `frame`, `copies`, `kind`, `text`, `x`, `y`, `author`, `label`, `removed`, `removed_by`, `removed_at`, `made_version`, `version`, `changed_by`, `change`, 그리고 화살표와 묶음도 그와 같습니다. 표시는 `{element, mark}`이며, `mark`는 `added`, `changed`, `removed`, `restored`입니다(SPEC-181).

### ② 차례의 오류 코드

| 코드 | 상태 | 뜻 | 멤버 | 말 | 클라이언트가 하는 일 |
| --- | --- | --- | --- | --- | --- |
| `draft_not_found` | 404 | 그림에 열린 임시 저장이 없음 | 없음 | 여기에는 보내지 않은 편집이 없습니다 | 편집기는 그림 자체를 열고, 그 첫 저장이 임시 저장을 시작함 |
| `draft_revision` | 409 | 요청이 임시 저장이 가진 것과 다른 리비전을 적었거나, 첫 저장이 열린 임시 저장을 만남. 멤버가 마지막으로 저장한 임시 저장을 알려 줌 | `draft`, `revision`, `saved_at` | 이 편집은 다른 창에서 저장되었습니다 | 화면은 마지막으로 저장한 임시 저장 불러오기를 권하고, 사용자가 고를 때까지 거절된 변경을 페이지에 간직함 |
| `draft_closed` | 409 | 적은 임시 저장을 보냈거나 버림. state가 어느 쪽인지, edit가 보낸 편집을 알려 줌 | `state`, `edit` | 이 편집은 이미 보냈거나 버렸습니다 | 화면은 그림을 다시 읽음 |
| `picture_changed` | 409 | 그림이 요청이 출발한 것보다 새 문서 판을 가짐. latest가 그것을 알려 줌 | `latest` | 이 편집을 시작한 뒤 그림이 바뀌었습니다 | 화면은 가장 새 그림 위에 편집 충돌을 보여 줌 |
| `draft_not_applying` | 409 | 임시 저장의 바뀐 것이 가장 새 그림에 더는 들어맞지 않음. changes가 그것과 저마다의 까닭을 적음 | `changes` | 몇몇 바뀐 것이 새 그림에 맞지 않습니다 | 화면은 그것을 따로 늘어놓고 다시 고치기와 버리기를 보여 줌 |
| `draft_too_large` | 413 | 임시 저장이 1 MiB나 바뀐 것 300개를 넘게 됨. field와 limit이 어느 쪽인지 적음 | `field`, `limit` | 이 편집이 너무 큽니다. 먼저 보내거나 버리세요 | 화면은 그렇게 말하고 저장하지 않은 변경을 페이지에 간직함 |
| `unknown_name` | 400 | 보고가 편집에 없는 임시 이름을 적음. names가 그것을 알려 줌 | `names` | 보고가 편집이 더하지 않은 항목을 적었습니다 | 허브는 그 이름을 보고하고, 에이전트는 단계별 원본을 확인함 |
| `position_limit` | 409 | 부분의 단계가 상한보다 많은 자리를 두게 됨 | `limit` | 이 그림에는 자리를 더 둘 수 없습니다 | 화면은 그렇게 말하고 다른 항목을 배치함 |
| `workshop_not_found` | 404 | 공간에 그런 워크숍이 없음 | 없음 | 이 워크숍은 여기에 없습니다 | 화면은 단계를 다시 읽고, 허브는 그것을 보고함 |
| `workshop_open` | 409 | 그 부분에 열린 워크숍이 있음. workshop이 그것을 알려 줌 | `workshop` | 이 부분에는 이미 열린 워크숍이 있습니다 | 화면은 그것을 열고, 허브는 그 ID를 보고함 |
| `workshop_ended` | 409 | 워크숍이 끝나 그 보드는 읽기만 하고 새 의견을 받지 않음 | 없음 | 이 워크숍은 끝났습니다 | 화면은 보드를 읽기만 하게 보여 줌 |
| `frame_not_next` | 409 | 더할 프레임이 다음 스텝의 것이 아님. next가 그것을, Step 9 뒤면 null을 알려 줌 | `next` | 다음 스텝이 아닙니다 | 화면은 다음 스텝을 권함 |
| `checkpoint_waits` | 409 | 다음 프레임은 아직 통과하지 않은 확인 지점 뒤에만 옴. step이 그 스텝을 알려 줌 | `step` | 먼저 이 스텝의 확인 지점을 통과시키세요 | 화면은 확인 지점 상자를 엶 |
| `frame_closed` | 409 | 프레임이 보드의 마지막이 아니거나 그 확인 지점을 통과함. frame이 그것을 알려 줌 | `frame` | 이 스텝은 닫혔습니다 | 화면은 보드를 지금 그대로 보여 줌 |
| `element_changed` | 409 | 작업이 그 요소의 옛 판에서 출발함. at이 그 작업의 자리를, element가 지금의 요소를 알려 줌 | `at`, `element` | 그사이 이것이 바뀌었습니다 | 화면은 그 요소를 되돌려 놓고, 누가 바꾸었는지 말하고, 거절된 글을 복사할 수 있게 간직함 |
| `not_placed_by_agent` | 403 | 에이전트가 자기가 붙이지 않은 것을 바꾸거나 옮기거나 뗌. element가 그것을 적음 | `element` | 에이전트는 자기가 붙인 것만 바꿉니다 | 허브는 그것을 보고하고, 에이전트는 그것에 의견을 달아 물음 |
| `board_limit` | 409 | 변경이 보드를 상한 너머로 가져감. field와 limit이 그것을 적음 | `field`, `limit` | 이 보드는 여기가 다 찼습니다 | 화면과 허브는 그 상한을 말함 |
| `board_changed` | 409 | 보드가 통과가 적은 것보다 새 판을 가짐. version이 그것을 알려 줌 | `version` | 보신 뒤 보드가 바뀌었습니다 | 화면은 보드를 지금 그대로 보여 주고 다시 통과시키게 함 |
| `not_checkpoint_step` | 409 | 프레임이 보드의 마지막이 아니거나 그 스텝에 확인 지점이 없음. step이 마지막 프레임의 것을 알려 줌 | `step` | 이 스텝에는 확인 지점이 없습니다 | 화면은 보드를 다시 읽음 |

② 차례는 0.2의 `invalid_request`, `unknown_item`, `user_only`, `agent_only`, `picture_not_found`, `part_not_found`, `edit_state`, `pull_request_reported`, `checkpoint_withdrawn`, `reflection_limit`, `space_full`, `text_too_long`, `body_too_large`와 다시 디자인의 `item_not_found`도 씁니다. 그 거절은 [어느 거절이 먼저인지](#어느-거절이-먼저인지)의 순서를 지킵니다: 요청이 적는 것의 `404`와 `unknown_item`, `unknown_name`은 9에, `409`는 `not_placed_by_agent`와 작업의 `user_only`와 함께 10에 섭니다.

② 차례는 0.2의 클라이언트가 보내는 것을 하나도 바꾸지 않습니다: 그 필드는 선택이고, 그 응답은 멤버를 더할 뿐이며 그것을 모르는 클라이언트는 그것을 무시합니다. 편집의 새 상태 `dropped`는 0.2의 허브에 그것이 읽는 대로 출력하는 응답에서만 닿습니다.

## 공통 규칙

### 주소와 경로

- 서버는 1차처럼 사용자가 정한 주소, 곧 `nexus.url`이 적은 주소에서만 답하고, `workers.dev`나 미리 보기 주소에서는 답하지 않습니다(SPEC-113). 페이지는 `/`, `/pictures/…`, `/overview/…`이고, 보기 화면의 코드는 `/code/` 아래, 나머지는 `/api/` 아래에 있습니다.
- `{project}`는 등록한 이름입니다: 소문자와 숫자로 된 낱말을 하이픈으로 이은 것으로, 100자까지입니다. `{part}`는 같은 꼴의 부분 이름이거나, 프로젝트 전체를 뜻하는 `_`이며, JSON 본문에서는 `""`로 씁니다. `{stage}`는 단계 키이고, 그림이 있는 단계는 `01-domain`, `05-erd`, `07-sitemap`뿐입니다.
- 서버 자신의 ID는 접두어와 소문자 Crockford base32의 임의 글자 12개입니다. 숫자와 `i`, `l`, `o`, `u`를 뺀 글자를 씁니다: 의견은 `nc_`, 어긋남은 `nd_`, 제안은 `np_`, 편집은 `ne_`, 확인 지점은 `nk_`, 쓰기는 `nw_`입니다. 쓰기 ID는 페이지와 허브가 만들고, 나머지는 서버가 만듭니다. 이것은 추적 ID가 아니며, 허브는 이것을 항목으로 읽지 않습니다.
- 꼴이 다른 경로 값은 서버가 갖지 않은 값과 같은 `404`를 받습니다. 1차가 프로젝트 이름에 그렇게 답하는 것과 같으며, `400`은 받지 않습니다([고른 것 1](#이-단계가-고른-것)).
- 꼴이 다른 쿼리 값은 본문의 칸처럼 그 칸의 `400` `invalid_request`를 받습니다. 쿼리 값은 다시 디자인의 읽기, API-152와 API-156\~API-158이 받습니다.

### 메서드와 본문

- `GET`은 읽고, 모든 `GET`은 같은 상태와 헤더로 본문 없이 `HEAD`에도 답합니다. `POST`는 쓰고, `DELETE`는 프로젝트를 지우거나 맡음을 끝냅니다. 경로가 받지 않는 메서드는 받는 메서드를 적은 `Allow` 헤더와 함께 `405`를 받고, 모르는 경로는 `404` `not_found`를 받습니다.
- 본문은 `Content-Type: application/json`으로 보낸 UTF-8의 JSON입니다(아니면 `415` `json_required`, UTF-8이 아니면 `400`). 스냅샷은 1 MiB까지, 다른 본문은 256 KiB까지입니다(`413`). 본문을 받지 않는 요청은 보낸 본문을 읽지 않습니다.
- 쓰기의 본문에는 계약이 적은 필드만 있고, 다른 이름의 필드는 `400`으로 거절합니다. 스냅샷은 1차처럼 서버가 모르는 필드도 간직합니다.
- 쓰기에 꼭 있어야 하는 글, 이를테면 답글의 글이 비었거나 공백뿐이면 `400`으로, 상한보다 길면 `413` `text_too_long`으로 거절합니다. 글은 클라이언트가 보낸 그대로 저장하고, 에이전트의 글은 허브가 보내기 전에 가립니다(SPEC-128).

### 응답

- 응답은 `application/json; charset=utf-8`의 JSON이고, 상태는 `200`, 항목을 더하는 쓰기는 `201`입니다. 페이지는 `text/html; charset=utf-8`이고, 보기 화면의 코드 파일은 제 형식을 지닙니다.
- 모든 응답은 1차의 헤더를 지닙니다: `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-Robots-Tag: noindex, nofollow`, `Cross-Origin-Resource-Policy: same-origin`. 그래서 어떤 응답도 캐시되거나, 다른 사이트의 프레임에 보이거나, 색인되지 않습니다(SPEC-113). JSON 응답에는 `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`을 더합니다.
- 허브 페이지는 1차의 정책을 그대로 둡니다. 자기 인라인 스크립트만 그 다이제스트로 돌리고, 아무 요청도 보내지 않습니다: `default-src 'none'; script-src 'sha256-…'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`, 그리고 `Cross-Origin-Opener-Policy: same-origin`.
- 그림 보기와 단계 현황은 코드를 `/code/`에서만 불러오고 요청은 서버에만 보냅니다(REQ-147): `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`, 그리고 `Cross-Origin-Opener-Policy: same-origin`. 그 자료는 JSON 스크립트 블록에 있고, 페이지는 그것을 글로 읽을 뿐 돌리지 않습니다.
- 브라우저와 같은 origin의 Access 보호 Cloudflare 거점이 간직해도 되는 것은 공개된 내용 해시 이름의 보기 화면 코드·스타일·글꼴뿐이며, `Cache-Control: public, max-age=31536000, immutable`을 지닙니다. 파일 이름마다 그 내용의 다이제스트가 들어 있고, 프로젝트 자료는 없기 때문입니다. 이 단계의 확인 지점이 SPEC-113을 그렇게 바꿨습니다([앞 단계의 변경](#앞-단계의-변경)).

### 오류

모든 거절과 오류는 아래 페이지가 브라우저에 하는 답을 빼면 `application/problem+json`으로 보내는 문제 세부 정보(RFC 9457)이며, 다음 멤버가 있습니다(계약의 `Problem`):

| 멤버 | 값 |
| --- | --- |
| `title` | 코드의 짧은 영어 제목. 그 코드의 모든 응답에서 같습니다 |
| `status` | 응답의 상태 |
| `detail` | 이 요청에서 무엇이 잘못됐는지 말하는 한 줄. 필드나 커밋 같은 요청의 값은 적을 수 있지만, 저장된 글은 적지 않습니다 |
| `code` | [오류 코드](#오류-코드) 가운데 하나 |
| `traceId` | Cloudflare가 `Cf-Ray` 헤더로 보내는 요청의 Ray ID(이를테면 `8f6c3b2a1d0e9f80-ICN`). 기기에서처럼 그것이 없으면 임의의 16진수 16자리. 오류에 대한 서버의 로그 줄에도 같은 ID가 있습니다 |
| `error` | `detail`과 같은 값. 거절의 `error`를 보여 주고 응답을 4,096바이트까지만 읽는 0.1의 허브를 위한 것입니다 |
| 그 밖 | [오류 코드](#오류-코드)가 적는, 그 코드가 더하는 멤버. 이를테면 `field`와 `limit` |

NEXUS는 `type`을 보내지 않으며(RFC 9457은 이것을 `about:blank`로 읽습니다), `instance`도 보내지 않습니다. 클라이언트는 RFC 9457이 말하는 대로 모르는 멤버를 무시합니다. 보기 화면은 `detail`이 아니라 사용자의 언어로 된 코드의 말을 보여 주고, 허브는 `detail`을 보여 줍니다. 서버의 로그에는 오류의 종류와 추적 ID만 있고, 저장된 글이나 요청의 값은 없습니다(SPEC-113).

세 페이지 API-101\~API-103은 요청의 `Accept` 헤더가 `text/html`을 적으면, 곧 브라우저가 페이지를 열 때처럼 하면 거절과 오류에 `text/html; charset=utf-8`로 답하고, 그렇지 않으면 문제 세부 정보로 답합니다. 브라우저는 문제 세부 정보를 날 글로 보이기 때문입니다. 그 페이지에는 서버의 언어로 된 코드의 말 하나와 추적 ID, 다시 불러오기, 허브 페이지 링크가 있고, 응답의 상태와 정책 `default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`을 지니며, 08단계의 [규칙 9](../08-screens/nexus/README.ko.md#모든-화면)가 그것을 그립니다. `/api/` 요청과 보기 화면의 코드는 언제나 문제 세부 정보로 답하고, 보기 자신의 자료는 그것을 `problem`에 담습니다.

### 어느 거절이 먼저인지

규칙을 여러 개 어긴 요청은 다음 순서에서 먼저 오는 거절을 받습니다. 1차는 자기 검사에서 이 순서를 지킵니다:

1. Access: 검사하지 않았으면 `403` `access_missing`, 다른 Access 애플리케이션이 검사했으면 `403` `access_other_app`.
2. 경로와 메서드: `404` `not_found`, `405` `method_not_allowed`. 꼴이 다른 경로 값은 그것이 가리키는 것의 `404`.
3. 브라우저가 다른 사이트에서 보낸 변경: `403` `cross_site`.
4. 쓰기에 필요한 로그인의 종류: `403` `user_only`, `agent_only`, `no_kind`.
5. 헤더, 곧 쓰기 ID와 세션 이름표, 그리고 쿼리 값: `400` `invalid_request`.
6. 본문의 형식 `415` `json_required`, 본문의 크기 `413` `snapshot_too_large`나 `body_too_large`.
7. 본문: UTF-8이나 JSON이 아니거나 꼴이 맞지 않으면 `400` `invalid_request`나 `invalid_snapshot`, 앞선 시각의 스냅샷은 `400` `clock_ahead`, 상한을 넘은 글은 `413` `text_too_long`.
8. 쓰기 ID: 서버가 이미 받은 쓰기는 첫 응답을 받고, 다른 요청이 가진 ID는 `409` `write_id_reused`.
9. 요청이 가리키는 것: 프로젝트, 공간, 부분, 그림, 항목은 `404`, 그림에 없는 항목은 `400` `unknown_item`.
10. 맡음, 상태, 상한: `409`.

## 로그인

1차처럼 Cloudflare Access가 Worker보다 먼저 모든 요청을 검사합니다. 올바른 로그인이 없는 요청은 Worker에 닿지 않습니다. Access가 브라우저는 자기 로그인 페이지로 보내고, 거절한 서비스 토큰에는 리디렉션, `401`, `403`으로 답합니다. 그래서 어느 요청도 `401`을 적지 않고, 계약은 그 까닭을 `x-corthex.omit`마다 적습니다.

그다음 Worker는 1차처럼 Access가 그 요청을(`ctx.access`, 없으면 `403` `access_missing`) 자기 애플리케이션으로(`ACCESS_AUD`가 적은 `aud`, 아니면 `403` `access_other_app`) 검사했는지 보고, Access가 검사한 신원에서 로그인의 종류를 정합니다(SPEC-116):

| 신원 | 종류 |
| --- | --- |
| 비어 있지 않은 `sub`: Access의 로그인으로 들어온 사람 | `user` |
| 빈 `sub`와 `common_name`: 서비스 토큰의 클라이언트 ID | `agent` |
| 그 밖 | 어느 쪽도 아님: 모든 쓰기에서 `403` `no_kind` |

- 읽기, 보내기, 지우기는 1차처럼 Access가 들여보낸 어느 신원이든 받으며, `no_kind`로 답하지 않습니다. 한 종류만 보낼 수 있는 쓰기는 다른 종류에 `user_only`나 `agent_only`로 답하고, 그 `needs`가 받는 종류를 적습니다.
- 신원은 아무것도 간직하거나 로그에 남기지 않습니다. 항목은 쓴 쪽의 종류, 곧 `user`나 `agent`만 간직합니다(REQ-163).
- 보기 화면을 연 동안 로그인이 끝날 수 있습니다. 보기 화면은 요청을 `redirect: "manual"`로 보내므로, Access의 로그인 페이지로 가는 리디렉션이 `opaqueredirect` 응답으로 닿습니다. 그러면 보기 화면은 로그인이 끝났다고 말하고, 글을 간직한 채 페이지를 다시 불러오자고 합니다(SPEC-126).
- 2026-11-03 개발 Access 시험으로 정한 방법: `ctx.access`와 그 audience를 먼저 확인하고 `Cf-Access-Jwt-Assertion`에서 로그인 종류를 읽습니다. 설정한 팀의 공개 `https://<ACCESS_TEAM_DOMAIN>/cdn-cgi/access/certs`에서 `kid`가 맞는 키로 RS256 서명, 정확한 팀 발급자, `ACCESS_AUD`, 만료와 not-before가 있으면 그 시각을 확인합니다. `ACCESS_TEAM_DOMAIN`은 설정한 호스트이며 토큰이 적은 호스트를 쓰지 않습니다. 공개 키는 한 시간까지만 간직하고 모르는 키는 다시 읽습니다. 키 요청은 manual 리디렉션을 쓰고 200이 아니면 거절합니다. 시험의 `redirect: error` 요청은 HTTP 응답 전에 실패했고 manual에서는 키를 받아 두 서명을 확인했습니다. `getIdentity()`는 사람의 `sub`와 서비스 토큰의 `common_name`을 주지 않았습니다. 신원 값·JWT·쿠키·인증값은 저장하거나 로그에 남기지 않습니다. 이 문서와 OpenAPI의 보안 방식도 이 방법을 따릅니다.

## 쓰기

사용자의 쓰기는 보기 화면에서, 에이전트의 쓰기는 허브를 거쳐 옵니다(SPEC-128). 쓰기마다 D1의 배치 하나이므로, 동시에 온 두 쓰기는 하나씩 차례로 받습니다(05단계의 [사용자와 에이전트의 쓰기](../05-erd/nexus.ko.md#사용자와-에이전트의-쓰기)).

### 쓰기 ID

- 맡음을 뺀 모든 쓰기는 `Idempotency-Key` 헤더에 쓰기 ID를 담습니다. 쓰기 ID는 페이지나 허브가 그 쓰기 하나를 위해 만들어 시도마다 보내는 `nw_` ID이고, 초안이 쓰는 대로 큰따옴표 안에 씁니다: `Idempotency-Key: "nw_6t9w2z5c8f1j"`. 그것이 없거나 꼴이 다르면 쓰기는 `400` `invalid_request`로 거절되고, 그 `field`는 `Idempotency-Key`입니다.
- 서버는 받은 쓰기마다 그 ID를 요청의 이름, 첫 응답과 함께 7일 동안 간직합니다(TBL-112). 그 ID로 다시 보낸 쓰기는 같은 상태로 그 응답을 받고, 아무것도 바꾸지 않습니다. 서버가 거절한 쓰기는 ID를 남기지 않으므로, 다시 보내면 다시 검사합니다.
- 서버가 다른 요청의 것으로 가진 ID는 `409` `write_id_reused`로 거절합니다. NEXUS는 TBL-112가 간직하는 요청의 이름을 견주고, 본문은 견주지 않습니다.
- NEXUS가 초안과 다른 점: 다른 요청의 ID에 `422`가 아니라 `409`로 답합니다. 다른 요청으로 돌아온 쓰기 ID는 클라이언트의 잘못이고, `409`는 쓰기의 다른 충돌에도 그렇게 말하기 때문입니다. 아직 처리하는 중인 쓰기를 따로 두지 않습니다. 쓰기마다 트랜잭션 하나이므로, 두 번째 시도는 첫 시도를 기다려 그 응답을 받기 때문입니다. 그리고 7일 뒤에는 ID를 잊습니다. 그때는 허브의 보낼 편지함도 그 쓰기를 버렸기 때문입니다.
- 보내기에는 쓰기 ID가 필요 없습니다. 커밋 규칙이 새 스냅샷과 다시 보낸 스냅샷을 가르기 때문입니다([보내기](#보내기)). 지우기도 필요 없습니다. 두 번째 지우기는 `404`를 받기 때문입니다. 맡음도 필요 없습니다. 두 번 맡아도 맡음은 하나이기 때문입니다.

### 요청 이름

TBL-112가 쓰기마다 간직하고, 보낼 편지함이 에이전트의 쓰기마다 간직하는 이름입니다:

| 이름 | 요청 | 보낼 수 있는 쪽 |
| --- | --- | --- |
| `comment` | API-118 | 둘 다 |
| `reply` | API-119 | 둘 다 |
| `answered` | API-120 | 둘 다 |
| `decision` | API-121 | 에이전트 |
| `proposal` | API-122 | 에이전트 |
| `withdraw-proposal` | API-123 | 에이전트 |
| `accept` | API-124 | 사용자 |
| `dismiss-proposal` | API-125 | 사용자 |
| `report-edit` | API-126 | 에이전트 |
| `dismiss-edit` | API-127 | 사용자 |
| `checkpoint` | API-128 | 사용자 |
| `withdraw-checkpoint` | API-129 | 사용자 |
| `report-checkpoint` | API-130 | 에이전트 |

### 세션

- 에이전트는 `Nexus-Session` 헤더에 세션 이름표를 담아 자기 세션을 밝힙니다. 이름표는 ASCII 글자, 숫자, `.`, `_`, `:`, `-`로 된 1\~100자이고, 세션 동안 그대로 둡니다. 도구의 세션 ID를 쓰거나, 그것이 없으면 세션을 시작할 때 `claude-code-4f2a91`처럼 만든 이름표를 씁니다. 이름표에는 개인적인 것이 없습니다(SPEC-128). 허브는 이것을 `--session`이나 환경 변수 `CORTHEX_NEXUS_SESSION`에서 가져옵니다.
- 에이전트의 모든 쓰기에 이름표가 있어야 하며, 없으면 `400` `invalid_request`로 거절하고 그 `field`는 `Nexus-Session`입니다. AI 할 일은 그 세션 자신의 맡음을 표시하려고 이것을 읽습니다. 사용자의 쓰기에는 필요 없습니다. 맡음이 사용자를 막지 않기 때문이며, 서버는 사용자의 쓰기에 담긴 이름표를 읽지 않습니다.

### 맡음

- 에이전트는 자기 할 일의 항목, 곧 의견, 어긋남, 편집, 확인 지점을 자기 세션으로 맡습니다(API-131, SPEC-136). 맡음은 그 세션이 그 항목에 마지막으로 쓴 뒤 60분까지 이어지며, 그런 쓰기와 다시 맡기는 그 끝을 뒤로 밉니다. 맡음은 그때가 되거나, 항목이 닫히거나, 세션이 놓을 때(API-132) 끝납니다. 항목이 닫혔다는 것은 할 일이 더는 그것을 늘어놓지 않는다는 뜻입니다: 닫힌 의견, 풀린 어긋남, 닫혔거나 버린 편집, 기록된 확인 지점, 그리고 열린 PR도 저장된 기록도 적지 않는 철회된 확인 지점.
- 맡음이 이어지는 동안 다른 세션의 그 항목에 대한 에이전트의 쓰기는 `409` `claimed`로 거절하고, 그 `ends_at`이 맡음의 끝을 알려 줍니다. 할 일은 그때까지 그 세션들에게 그 항목을 맡겨진 것으로 보여 줍니다. 사용자의 쓰기는 맡음 때문에 거절하지 않습니다.
- 다른 세션의 항목, 닫힌 항목, 보고된 PR이 붙든 항목을 맡으려 하면 `409` `claimed`, `entry_closed`, `pull_request_reported`로 거절합니다. 연 PR의 보고는 그 항목의 맡음을 끝냅니다. 그때부터는 그 PR이 병합되거나 닫힐 때까지 모든 세션에 대해 그 항목을 붙들기 때문입니다(SPEC-133, SPEC-140).
- 쓰기가 어느 항목에 대한 것인지:

| 에이전트의 쓰기 | 그 쓰기의 항목 |
| --- | --- |
| 답글, 답했음 표시, 결정 | 그 의견 |
| 어긋남에 단 의견 | 그 어긋남 |
| 의견이나 어긋남에 답하는 제안, 그리고 그 철회 | 그 의견이나 어긋남 |
| 반영의 보고 | 그 편집 |
| 기록 PR의 보고 | 그 확인 지점 |
| 항목에 단 의견, 에이전트가 스스로 낸 제안 | 없음 |

### 바꾸는 것이 없는 응답

결과가 이미 그렇게 된 쓰기는 아무것도 바꾸지 않고, 응답이 `changed: false`로 그렇다고 말합니다: 답했다고든 결정했다고든 이미 닫힌 의견에 답했음을 표시하는 것(SPEC-127), 이미 철회한 제안이나 확인 지점을 철회하거나 이미 버린 반영을 버리는 것, 그 항목의 마지막 보고를 되풀이하는 보고. 다른 결과가 닫은 쓰기는 그 상태와 함께 `409`로 거절합니다: 열려 있지 않은 제안을 받거나 버리는 것(`proposal_not_open`, SPEC-131), 항목의 상태에 맞지 않는 보고. 쓰기 ID로 다시 보낸 쓰기는 무슨 말이었든 첫 응답을 받습니다([쓰기 ID](#쓰기-id)).

## 보내기

보내기(API-136)는 저장된 스냅샷, 프로젝트 공간, 그 그림, 어긋남, 확인 지점을 기기가 가져온 기본 브랜치의 최신 커밋에 맞춥니다(SPEC-111, SPEC-114):

1. 허브는 먼저 그 프로젝트의 보낼 편지함을 보냅니다([보낼 편지함](#보낼-편지함)).
2. 서버가 쥔 커밋을 묻습니다(API-109): 저장된 스냅샷의 `revision`과 `default_commit`. `404` `project_not_found`는 서버가 아무것도 쥐지 않았다는 뜻입니다. `code`가 없는 `404`는 1차의 서버가 준 것이며, 그 서버는 먼저 0.2 판이 필요합니다. 그때 허브는 아무것도 보내지 않습니다.
3. 새 스냅샷을 찍고(API-133), SPEC-105처럼 저장소를 읽어 그 기본 커밋을 Git으로 확인합니다:

| 서버가 쥔 것 | 스냅샷의 커밋 | 허브 |
| --- | --- | --- |
| 스냅샷이 없거나, 기본 커밋이 있는 스냅샷이 없음 | 아무것이나 | `replaces` 없이 보냅니다 |
| 커밋 H | H | `replaces` 없이 보냅니다 |
| 커밋 H | H의 후손 | `replaces: H`와 함께 보냅니다 |
| 커밋 H | H의 조상이거나, 체크아웃에 H가 없음 | 아무것도 보내지 않고, 기본 브랜치를 가져와 다시 보내라고 말합니다 |
| 커밋 H | 기본 브랜치를 다시 쓴 뒤처럼 H의 후손이 아님 | 아무것도 보내지 않고 두 커밋을 적습니다. 에이전트가 사용자의 동의를 받은 뒤에만 쓰는 `--replace-held`가 있으면 `replaces: H`와 함께 보냅니다 |
| 커밋 H | 체크아웃에 기본 브랜치가 없어 커밋이 없음 | 아무것도 보내지 않고, head를 기록하는 법(`git remote set-head origin --auto`)을 말합니다 |

4. 스냅샷을 1 MiB 이하의 압축 JSON으로 보냅니다(API-105).
5. 서버는 그것이 다음 판일 때 저장하며, 커밋을 이름으로만 견주는 커밋 규칙을 따릅니다:

| 서버가 쥔 것 | 스냅샷 | 서버 |
| --- | --- | --- |
| 그 프로젝트의 것이 없음 | 아무것이나 | 새 프로젝트로 저장합니다. 이미 30개를 쥐었으면 `409` `too_many_projects` |
| 기본 커밋이 없는 스냅샷 | 아무것이나 | 저장된 것보다 이르지 않게 찍혔으면 저장하고, 아니면 `stored_at`과 함께 `409` `older_snapshot` |
| 커밋 H | H의 것 | 위와 같습니다 |
| 커밋 H | `replaces: H`가 있는 다른 커밋의 것 | 저장합니다 |
| 커밋 H | `replaces: H`가 없는 다른 커밋의 것, 또는 커밋이 없는 것 | `held_commit`과 함께 `409` `commit_not_replaced` |
| 커밋 H, 그리고 이 보내기가 읽은 뒤 다른 보내기가 먼저 저장함 | 아무것이나 | 새 `held_commit`과 함께 `409` `commit_not_replaced` |

6. 0.2의 스냅샷이면 같은 요청이, 공간이 없을 때 저장소의 주소에 묶인 프로젝트 공간을 만들고(SPEC-117), 바뀐 그림을 그리고 최신이 아닌 그림을 표시하며(SPEC-118), 그림이 바뀌었거나 다시 최신이 된 부분을 점검하고(SPEC-120, SPEC-121), 단계 기록이 적은 확인 지점을 표시합니다(SPEC-140). 이 모두를 하거나 아무것도 하지 않습니다(05단계의 [보내기](../05-erd/nexus.ko.md#보내기)). 주소가 공간이 묶인 주소가 아니거나, 공간에는 주소가 있는데 스냅샷에 없으면 `bound`와 함께 `409` `repository_mismatch`로 거절합니다. 주소에 묶이지 않은 공간은 스냅샷이 처음 적은 주소를 받습니다(05단계의 고른 것 9).
7. 서버는 판 번호, 이제 쥔 기본 커밋, 바꾼 커밋, 그린 그림·다시 최신이 된 그림·최신이 아니라고 표시한 그림, 열고 푼 어긋남, 기록된 확인 지점, AI 할 일의 개수로 답하며, 목록은 저마다 20개까지입니다(`PushAnswer02`). 0.1의 스냅샷은 1차의 응답, 곧 `name`과 `revision`을 받고, 저장된 스냅샷만 바꿉니다. 프로젝트에 공간이 있으면 그 그림과 항목은 그대로입니다.

공간이 묶이는 주소는 `origin` 원격의 주소를 한 꼴로 맞춘 것이며, 허브가 스냅샷에 쓰고 서버가 견줍니다: 사용자 이름과 비밀번호를 빼고, `git@example.com:owner/repo.git`과 `ssh://git@example.com/owner/repo.git`은 `https://example.com/owner/repo`로, 끝의 `.git`이나 `/`를 빼고, 호스트는 소문자로, `http`는 `https`로 씁니다.

30초 안에 응답이 없거나 네트워크가 없는 보내기는 알리기만 하고 아무것도 간직하지 않습니다. 다음 보내기는 새 스냅샷을 찍기 때문입니다(SPEC-111).

## 읽기

| 읽기 | 담는 것 | 최대 |
| --- | --- | --- |
| 허브 페이지(API-101) | 저장된 모든 스냅샷, 그리고 공간이 있는 프로젝트마다 그 그림, 열린 의견·제안·어긋남의 개수, 기록을 기다리는 NEXUS에서 통과한 확인 지점, `checkpoint-withdrawn` 경고(SPEC-123) | 프로젝트마다 그림 150개, 확인 지점 100개, 경고 100개와 그 총수 |
| 그림 하나(API-111) | 문서 판과 최신 여부가 있는 그림 자료; 최근에 움직인 것부터 그 열린 의견과 저마다의 답글 수와 마지막 답글; 닫힌 의견의 ID; 단계별 원본 글을 뺀 열린 제안; 닫히지 않은 반영; 그 그림에 관한, 그 부분의 열린 어긋남(SPEC-119) | 저마다 500개, 어긋남은 1,000개와 그 총수 |
| 단계 현황(API-112) | 스냅샷에 있는 그 단계의 기록과 점검; 열린 어긋남, 열린 의견, 반영 대기; 아직 어느 기록도 적지 않았거나 철회한 뒤에 기록이 적은, NEXUS에서 통과한 확인 지점(SPEC-138) | 저마다 50개와 그 총수 |
| AI 할 일(API-113) | 그 순서대로 에이전트를 기다리는 의견, 열린 어긋남, 반영 대기, 확인 지점([AI 할 일](#ai-할-일)) | 저마다 50개와 그 총수 |
| 의견 하나(API-114) | 그 답글, 결정, 제안 | 모두. 답글은 많아야 200개 |
| 제안(API-115), 편집(API-116), 확인 지점(API-117) 하나 | 제안의 단계별 원본 글까지 그 항목 전체 | |
| 지우기의 미리 보기(API-110) | 지우기가 지우는 것, 그리고 ID로 적은 열린 의견, 열린 제안, 반영 대기, 아직 기록되지 않은 확인 지점 | 저마다 20개와 그 총수 |

구현 명확화(2026-11-04): `CommentThread.proposals`에는 누적 배열 개수 제한이 없습니다. 제안 500개 한도는 공간의 열린 제안에 적용하며 의견의 과거 제안에는 적용하지 않습니다. OpenAPI 스키마를 모두 돌려준다는 기존 API-114의 약속에 맞췄습니다.

어느 의견, 제안, 어긋남이 떨어져 있는지, 곧 지금 그림에 그 항목이 더는 없는지는 보기 화면이 찾습니다. 그림 자료의 항목을 읽는 것은 보기 화면뿐이기 때문입니다(SPEC-119). 0.1의 허브만 보낸, 공간이 없는 프로젝트에는 그림이 없습니다: 그림 보기와 할 일은 `404` `space_not_found`이고, 단계 현황은 기록과 점검만 보여 줍니다.

### AI 할 일

할 일(API-113, SPEC-135)은 다음 순서로 늘어놓습니다:

1. 에이전트를 기다리는 열린 의견([의견이 기다리는 쪽](#의견이-기다리는-쪽)), 오래된 것부터.
2. 열린 어긋남, `warn`을 `info`보다 먼저, 오래된 것부터.
3. 반영 대기, PR이 없는 것부터, 오래된 것부터.
4. 저장된 기록이 적지 않은, NEXUS에서 통과한 확인 지점을 오래된 것부터, 그다음 열린 PR이나 저장된 기록이 아직 적는 철회된 것. 저마다 `why`가 있습니다: `not-recorded`, `withdrawn-in-review`, `withdrawn-recorded`.

사용자를 기다리는 의견의 개수(`waiting_for_user`)와 다른 세션이 맡은 항목의 개수(`taken`)도 셉니다. 어느 세션이 맡은 항목에는 맡음의 끝이 있고, `Nexus-Session`이 적은 세션의 것이면 `mine`으로 표시합니다. 그 헤더가 없으면 모든 맡음을 다른 세션의 것으로 셉니다. 보고된 열린 PR이 붙든 반영이나 확인 지점에는 그 PR이 있어, 다른 세션은 그것을 검토 중으로 보고 건너뜁니다.

## 의견이 기다리는 쪽

의견의 기록은 그 글, 답글, 그리고 그 의견에 답하는 제안과 그 받음이나 버림입니다. 철회한 제안은 세지 않습니다.

| 마지막 기록 | `waits` |
| --- | --- |
| 사용자의 것: 의견, 답글, 또는 그 의견에 답하는 제안을 받거나 버림 | `agent` |
| 에이전트의 것: 의견, 답글, 또는 그 의견에 답하는 열린 제안 | `user` |
| 의견이 닫힘 | `null` |

- 사용자의 답글이 의견을 매듭지으면 `settled`는 `true`가 되고, 의견은 에이전트가 결정을 기록하기를 기다립니다(SPEC-127, SPEC-132). 결정은 의견을 `decided`로 닫습니다.
- 그 의견에 답한 마지막 제안을 버렸고 그 뒤로 에이전트가 그 의견에 쓰지 않았으면 `dismissed`는 `true`입니다(SPEC-131).
- 닫힌 의견에 사용자가 답글을 달면 의견은 다시 열려 에이전트를 기다리고, 에이전트의 답글은 `409` `comment_closed`로 거절합니다. 의견을 다시 여는 것은 이 답글이며, 따로 된 요청은 없습니다.

## 보고

### 반영의 보고

에이전트는 반영 대기가 어떻게 됐는지 보고합니다(API-126, SPEC-133). `opened`, `merged`, `closed`에는 PR이, `reflected`에는 그 단계별 원본이 이미 변경을 담은 커밋이 있고, `needs-user`에는 아무것도 없습니다:

| 사건 | 편집의 상태 | 바뀐 상태 |
| --- | --- | --- |
| `opened` | `pending`이나 `needs-user` | PR이 붙든 `in-review` |
| `merged` | 그 PR이 있는 `in-review`, 또는 `pending`이나 `needs-user` | 그 PR이 있는 `closed` |
| `closed` | 그 PR이 있는 `in-review` | `pending` |
| `reflected` | `pending`이나 `needs-user` | 그 커밋을 `closed_commit`으로 지닌 `closed` |
| `needs-user` | `pending` | 사용자가 버릴 수 있는 `needs-user`(API-127) |

- 편집의 마지막 보고를 되풀이하는 보고는 아무것도 바꾸지 않습니다(`changed: false`).
- 보고된 다른 PR이 붙든 편집의 `opened`는 `409` `pull_request_reported`로, 붙든 PR이 아닌 다른 PR의 `merged`나 `closed`는 `409` `pull_request_mismatch`로 거절하며, 둘 다 붙든 PR을 적습니다.
- 편집의 상태에 맞지 않는 그 밖의 보고는 `409` `edit_state`로 거절하고, 그 `state`가 상태를 알려 줍니다. 제 필드가 없거나 받지 않는 필드가 있는 사건은 `400`으로 거절합니다.

### 기록 PR의 보고

에이전트는 NEXUS에서 통과한 확인 지점을 단계 기록에 쓰는 PR을 보고합니다(API-130, SPEC-140):

| 사건 | 확인 지점 | 바뀐 상태 |
| --- | --- | --- |
| `opened` | 통과했고, 보고된 PR 가운데 열린 것이 없음 | PR이 붙든 `pr_state: open` |
| `merged` | 보고된 PR이 열려 있음 | `pr_state: merged` |
| `closed` | 보고된 PR이 열려 있음 | 어느 세션이든 맡을 수 있는 `pr_state: closed` |

- 철회한 확인 지점의 `opened`는 `409` `checkpoint_withdrawn`으로 거절하므로, 새 기록은 그것을 적지 않습니다. 철회한 확인 지점의 열린 PR에 대한 `merged`와 `closed`는 받습니다. 에이전트가 그 PR을 닫기 때문입니다(SPEC-140).
- 병합된 PR이 확인 지점을 기록하는 것은 아닙니다. 저장된 기록이 그것을 적는 다음 보내기가 기록하고, 그 `recorded_commit`을 정합니다.
- 되풀이와 다른 PR에는 반영과 같이 답합니다.


## 허브의 명령

### 명령 돌리기

- 허브는 1차처럼 허브 스킬의 `scripts` 폴더에 있는 `hub.py`이며, Windows, macOS, Linux에서 도는 표준 라이브러리만 쓴 Python 3.8 이상입니다. 1차의 옵션 `--home`과 `--version`, 그리고 다섯 명령과 그 옵션을 그대로 두고, 0.2는 아래 명령마다 적은 대로 그것을 넓힙니다.
- 서버에 닿는 명령, 곧 `push`, `remove`, `todo`, 에이전트의 쓰기, `show`, `claim`, `release`, `outbox --send`는 서버의 주소를 `--url`, 그다음 `CORTHEX_NEXUS_URL`, 그다음 프로필의 `nexus.url`에서 가져옵니다: `https`이거나, 기기 자신일 때만 `http`입니다. 서비스 토큰은 `CORTHEX_NEXUS_CLIENT_ID`와 `CORTHEX_NEXUS_CLIENT_SECRET`에서 가져와 보내며(기기 위의 서버에는 필요 없습니다), 절대 파일, 로그, 메시지에 쓰지 않습니다(REQ-109, REQ-110). 리디렉션은 따라가지 않고, 리디렉션이나 JSON 까닭이 없는 `401`, `403`은 거절된 토큰으로 봅니다(REQ-111). `remove`를 빼고는 `nexus.push`에 있는 프로젝트에만 됩니다.
- 에이전트의 쓰기, `claim`, `release`에는 `--session`이나 `CORTHEX_NEXUS_SESSION`에서 가져오는 세션 이름표가 있어야 하고, `todo`는 그것이 주어지면 읽습니다.
- 글은 `--text TEXT`에서, 또는 `--text-file FILE`에서 UTF-8로 가져오며, `-`는 표준 입력입니다. `--reason`과 `--reason-file`, `--change`와 `--change-file`, `--source-file`도 그렇습니다. 허브는 글을 보내기 전에 스냅샷처럼 가립니다: 비밀값과 이메일 주소는 `[redacted]`가 되고, 사용자의 홈 폴더는 `~`가 됩니다(SPEC-128).
- `--part PART`는 부분을 적습니다. 없으면 명령은 프로젝트 전체에 관한 것입니다.
- `--json`은 프로젝트마다 JSON 객체 한 줄을 찍습니다: `command`; `project`; 아래의 `outcome`; 서버의 응답인 `answer`; 거절에 대한 서버의 문제 세부 정보인 `problem`; 실패나 허브 자신의 거절의 종류인 `failure`, 이를테면 `no network`, `timeout`, `HTTP 503`, `no service token`, `refused token`, `not in nexus.push`; 그리고 보낼 편지함의 쓰기 가운데 몇 개를 보냈고(`sent`), 버렸고(`dropped`), 기다리는지(`waiting`) 적은 `outbox`. 이것이 없으면 허브는 같은 것을 사람이 읽는 줄로 찍습니다.
  쓰기를 버리면 `outbox.notices`에 쓰기 ID와 까닭(문제 세부 정보나 실패 종류)을 덧붙이고 본문은 담지 않습니다. 아래의 버림 보고와 7일 만료 보고를 제공하면서 간직한 글을 드러내지 않게 합니다.
  에이전트 쓰기를 저장하지 못했을 때만 실패 결과에 원래 ID와 본문을 포함한 가린 OutboxFile인 `recovery`를 더합니다. SPEC-129대로 호출한 에이전트에게 한 번 보여 주고, 이 사본을 파일이나 로그에 남기지 않습니다. 에이전트는 세션에 글을 남기고 복구할 때 원래 ID를 지킵니다. 보통 결과나 보낼 편지함 목록에는 복구 글이 없습니다.

| 종료 코드 | 결과 | 언제 |
| --- | --- | --- |
| 0 | `done` | 명령이 하라는 것을 했을 때. 바꾼 것이 없는 쓰기, 서버가 이미 받은 쓰기, 서버가 갖지 않은 프로젝트의 지우기, 빈 할 일도 여기에 듭니다 |
| 1 | `refused`나 `failed` | 서버나 허브 자신의 검사가 거절했거나 서버에 닿지 못했고, 다시 보내려고 기다리는 것이 없을 때 |
| 2 | | 명령 줄이 틀렸을 때: 모르는 옵션, 꼴이 다른 ID나 이름표, UTF-8이 아닌 글 파일, 빠진 세션 이름표, 또는 비밀값이나 이메일 주소가 든 링크나 역할 |
| 3 | `kept` | 쓰기가 보낼 편지함에서 기다릴 때([보낼 편지함](#보낼-편지함)) |

### 스냅샷과 기록

`snapshot`(API-133):

```txt
hub.py snapshot [PROJECT ...] [--path FOLDER] [--repo ALIAS=FOLDER ...] [--print]
```

1차와 같되 형식은 `corthex-hub/0.2`입니다([스냅샷 0.2](#스냅샷-02)): 0.2부터 스냅샷은 부분, 기본 브랜치의 커밋에서 가져온 그림 자료, 저장소의 단계 기록, 먼저 물을 일도 담고(SPEC-104\~SPEC-110), 그 점검에는 [새 규칙](#점검-규칙)이 듭니다.

`status`(API-134):

```txt
hub.py status PROJECT STAGE [--part PART] [--state STATE] [--next TEXT]
              [--checkpoint TEXT --by ROLE --date DATE [--where LINK] [--nexus CHECKPOINT]]
              [--check LEVEL MESSAGE ...] [--clear-checks] [--reset] [--repository]
```

- 체크아웃에 단계 기록이 있으면, 또는 첫 기록이라면 `--repository`가 있을 때, 단계의 기록을 저장소의 작업 트리, 곧 `.corthex/stages/<part>.json`에, 부분이 없는 프로젝트라면 `.corthex/stages.json`에 씁니다(SPEC-137). 아니면 1차처럼 기기의 진행 기록 파일에 씁니다. 에이전트는 기록을 작업과 함께 그 PR에서 커밋합니다. 허브는 절대 커밋하거나, 푸시하거나, PR을 열지 않습니다.
- 기록에서 `--checkpoint`는 단계의 목록에 확인 지점을 더합니다: 승인한 것, 그것을 승인한 역할인 `--by`(이를테면 `관리자`), `--date`, 그리고 승인한 곳의 링크인 `--where`. `--nexus`는 NEXUS에서 통과한 확인 지점을 적으며, 그 링크는 기본으로 서버에 있는 그 단계 현황, 곧 `<nexus.url>/overview/<project>/<part>/<stage>#<checkpoint>`입니다(SPEC-140). `--state done`에는 날짜가 있는 확인 지점이 기록에 있어야 합니다(REQ-085). 진행 기록 파일에서 `--checkpoint`는 1차의 뜻 그대로입니다.
- 파일은 TBL-115가 말하는 대로 씁니다: 두 칸 들여 쓴 JSON, 그 순서대로의 필드, 끝의 LF이며, 임시 파일에 쓰고 옮깁니다. `updated`는 쓴 시각이고 기기의 시간대를 지닙니다.

`build`(API-135):

```txt
hub.py build [PROJECT ...] [--out FILE] [--no-scan]
```

1차와 같되 페이지 자료는 `corthex-hub-page/0.2`입니다([페이지 자료](#페이지-자료)): 부분마다의 단계 기록과 먼저 물을 일을 담습니다. 기기에서 만든 페이지에는 `spaces`가 없고, 그림과 개수는 서버에 있다고 말합니다(SPEC-123).

### 보내기와 지우기

`push`(API-136):

```txt
hub.py push [PROJECT ...] [--url URL] [--dry-run] [--replace-held]
```

- 이름이 없으면 `nexus.push`에 있는 모든 프로젝트를 저마다 [보내기](#보내기)가 말하는 대로 보내고, 응답을 알립니다: 판 번호, 다시 그린 그림·다시 최신이 된 그림·최신이 아니라고 표시한 그림, 열고 푼 어긋남, 기록된 확인 지점, AI 할 일에서 기다리는 것(SPEC-111).
- `--dry-run`은 아무것도 보내지 않으며, 보낼 편지함도 쥔 커밋을 묻는 질문도 보내지 않습니다: 스냅샷마다 그 개수와 크기, 보낼 그림과 빼는 그림을 보여 주고, 쥔 커밋은 보낼 때 확인한다고 말합니다.
- `--replace-held`는 커밋이 쥔 커밋의 후손이 아닌 스냅샷을, 쥔 커밋을 대신하는 것으로 적어 보냅니다. 에이전트는 사용자가 동의한 뒤에만 이것을 씁니다.
- 결과: `done`; `refused`는 `nexus.push`에 없는 프로젝트, 주소 없음, 토큰의 변수 없음(값 없이 그 이름을 적습니다), [보내기](#보내기)의 표가 막는 커밋, 1차의 서버, 거절된 토큰, 서버의 거절이며, 그 까닭과 함께 알립니다; `failed`는 네트워크가 없거나 30초 안에 응답이 없을 때입니다. 보내기는 절대 간직하지 않습니다. 다음 보내기가 새 스냅샷을 찍기 때문입니다.

`remove`(API-137):

```txt
hub.py remove PROJECT ... [--url URL] [--dry-run]
```

- `--dry-run`은 지우기가 지울 것을 읽어(API-110) 보여 주며, 열린 의견, 열린 제안, 반영 대기, 아직 기록되지 않은 확인 지점을 ID로, 저마다 20개까지 그 총수와 함께 보여 줍니다. 1차와 달리 서버에 닿으므로 서비스 토큰이 필요합니다. 허브 스킬은 에이전트가 그것을 보여 주고, 그 항목에 먼저 답하거나 반영하거나 기록하자고 하며, 사용자가 확인한 뒤에만 지우기를 보내게 합니다(SPEC-115).
- `--dry-run`이 없으면 지우기를 보냅니다(API-108). `404` `project_not_found`는 1차처럼 지울 것이 없다고 알리며 종료 코드는 0입니다. 지우기 뒤에 허브는 그 프로젝트의 보낼 편지함을 지우고, 프로젝트가 아직 `nexus.push`에 있으면 다음 보내기가 빈 공간으로 프로젝트를 되살린다는 것과 목록에서 빼는 법을 말합니다.
- 1차처럼 `nexus.push`가 적었든 아니든 프로젝트를 받습니다.

### 에이전트의 일

`todo`(API-138):

```txt
hub.py todo PROJECT [--session LABEL]
```

프로젝트의 보낼 편지함을 보내고, 세션 이름표와 함께 AI 할 일을 읽어 그 순서대로 찍으며, 사용자를 기다리는 의견과 다른 세션이 맡은 항목의 개수도 찍습니다(SPEC-135). `404` `space_not_found`는 빈 할 일과 종료 코드 0이고, 에이전트는 그것에 대해 아무 말도 하지 않습니다. 서비스 토큰이 없거나 응답이 없으면 `failed`이고, 에이전트는 자기 일을 이어 갑니다(REQ-185).

쓰기(API-139\~API-146):

```txt
hub.py comment  PROJECT --stage STAGE [--part PART] [--item ID] [--quote TEXT]
                [--discrepancy ID] [--commit COMMIT] [--asks ASKS] (--text TEXT | --text-file FILE)
hub.py reply    PROJECT COMMENT [--asks ASKS] (--text TEXT | --text-file FILE)
hub.py answered PROJECT COMMENT
hub.py decide   PROJECT COMMENT --link LINK [--text TEXT | --text-file FILE]
hub.py propose  PROJECT --stage STAGE [--part PART] --item ID [--item ID ...] [--adds ID ...]
                (--reason TEXT | --reason-file FILE) (--change TEXT | --change-file FILE)
                [--source-file FILE] [--comment ID | --discrepancy ID] [--commit COMMIT]
hub.py withdraw PROJECT PROPOSAL
hub.py reflect  PROJECT EDIT EVENT [--pr LINK] [--commit COMMIT]
hub.py record   PROJECT CHECKPOINT EVENT --pr LINK
```

- 저마다 새 쓰기 ID와 세션 이름표로 쓰기 하나를 보내며(API-118\~API-123, API-126, API-130), 그 전에 프로젝트의 보낼 편지함을 보냅니다. `comment`는 13단계 어느 것이든 `--stage`로 받고, `--item`이 없으면 단계 전체에 다는 의견이며, `--quote`는 의견이 있는 그림의 부분을 인용합니다. `comment`와 `reply`는 에이전트가 사용자에게 묻는 것인 `--asks answer|recommended|checkpoint`를 받습니다(SPEC-143). 둘 다 허브 0.3.0부터이며, 0.2의 서버는 그림이 없는 단계, 항목도 인용도 없는 의견, `asks`를 `invalid_request`로 거절합니다. `reflect`는 사건 `opened`, `merged`, `closed`, `reflected`, `needs-user`를, `record`는 `opened`, `merged`, `closed`를 받습니다([보고](#보고)).
- `decide`는 `https`가 아니거나 비밀값이나 이메일 주소가 든 링크를 보내기 전에 거절합니다(SPEC-132).
- 보내지 못한 쓰기는 보낼 편지함에서 기다리고 종료 코드는 3입니다. 서버의 거절은 그 까닭과 함께 알리고 다시 보내지 않습니다(SPEC-128, SPEC-129).

`show`(API-147):

```txt
hub.py show PROJECT ID
```

의견, 제안, 편집, 확인 지점 하나를 그 `nc_`, `np_`, `ne_`, `nk_` ID로 읽습니다(API-114\~API-117): 모든 답글이 있는 의견, 단계별 원본 글이 있는 제안, 그리고 에이전트가 그 기록의 PR을 병합하기 전에 읽는 확인 지점(SPEC-140). 할 일과 단계 현황은 어긋남을 통째로 담으므로, `nd_` ID는 틀린 명령 줄입니다.

`claim`과 `release`(API-148, API-149):

```txt
hub.py claim   PROJECT ENTRY
hub.py release PROJECT ENTRY
```

세션을 위해 항목을 맡거나, 세션의 맡음을 끝냅니다(API-131, API-132). 맡음은 절대 보낼 편지함에서 기다리지 않습니다: 보내지 못한 맡음은 항목을 맡지 않은 채로 두고, 허브가 그렇다고 말합니다(05단계의 [보낼 편지함](../05-erd/nexus.ko.md#보낼-편지함-tbl-117)).

### 보낼 편지함

`outbox`(API-150):

```txt
hub.py outbox [PROJECT ...] [--send]
```

기다리는 쓰기를 프로젝트별로, 그 요청, 만든 때, 시도 횟수, 마지막 실패와 함께, 글은 빼고 늘어놓습니다. `--send`는 그것을 보냅니다.

- 보내지 못한 쓰기는 간직합니다: 네트워크가 없음, 30초 안에 응답이 없음, `429`, `500`, `502`, `503`, `504`, 기기에 서비스 토큰이 없음, 거절된 토큰, 또는 Access 설정을 고치면 통과할 `403` `access_missing`이나 `access_other_app`(SPEC-129).
- 서버가 `409`나 `404`처럼 다른 까닭으로 거절한 쓰기는 버리고 그 까닭과 함께 알립니다. 다시 보내도 바뀌는 것이 없기 때문입니다. 만든 지 7일이 지난 쓰기도 버립니다. 그것이 답한 할 일이 이미 다른 데로 넘어갔기 때문입니다.
- 프로젝트로 서버에 닿을 때마다, 곧 보내기, `todo`, 쓰기, `show`, `claim`, `release`, `outbox --send`마다, 허브는 먼저 그 프로젝트의 보낼 편지함을 오래된 것부터, 쓰기마다 자기 쓰기 ID와 세션 이름표로 보냅니다. 다시 간직하게 된 첫 쓰기에서 멈추므로, 쓰기는 그 순서를 지킵니다.
- 쓰기마다 `~/.corthex/hub/` 아래의 파일 하나, 곧 `outbox/<project>/<time>.<write>.json`(TBL-117)이며, 계약의 `OutboxFile` 꼴입니다. 한 기기의 허브들은 05단계가 말하는 대로 잠금 `outbox/<project>.lock`으로 프로젝트의 보낼 편지함을 차례로 씁니다.
- 새 에이전트 쓰기도 처음 보내기 전에 이 대기열에 넣습니다. 기기 안의 ID 순서 자료가 같은 밀리초의 순서도 지키므로, 동시 추가나 잠금 상실 때문에 새 글이 직접 앞질러 가지 않습니다. 처음 보내기에 성공한 임시 보관 파일도 지우며, 보내기 개수에 그것도 포함합니다.
- 보낼 편지함은 절대 서비스 토큰을 담지 않고, 허브는 간직한 쓰기의 글을 절대 로그에 보이지 않습니다.

## 형식

### 스냅샷 0.2

`corthex-hub/0.2`가 1차의 형식에 더하는 필드는 05단계의 [스냅샷](../05-erd/nexus.ko.md#스냅샷-tbl-114)에 있는 TBL-114의 것이고, 계약의 `Snapshot02`가 그것을 검사합니다. 목록을 줄인 발췌입니다:

```json
{
  "schema": "corthex-hub/0.2",
  "generator": "corthex-nexus 0.2.0",
  "generated_at": "2026-11-03T10:00:00+09:00",
  "project": { "name": "acme-shop", "title": "Acme Shop", "parts": ["orders", "billing"] },
  "repos": {
    ".": {
      "commit": "<full commit id>", "branch": "work", "dirty": true,
      "web": "https://github.com/example/acme-shop", "url": "https://github.com/example/acme-shop",
      "default": { "branch": "main", "commit": "<full commit id>", "time": "2026-11-03T09:40:00+09:00" }
    }
  },
  "replaces": "<the held commit>",
  "records": { "from": "repository", "commit": "<full commit id>", "time": "2026-11-03T09:40:00+09:00" },
  "stages": {
    "05-erd": {
      "state": "in_progress", "source_state": "found",
      "parts": {
        "orders": { "state": "in_progress", "checkpoints": [], "next": "주문을 날짜로 색인하기", "updated": "2026-11-03T09:30:00+09:00" }
      }
    }
  },
  "items": [], "checks": [], "summary": {},
  "pictures": [
    { "part": "orders", "stage": "05-erd", "commit": "<full commit id>", "time": "2026-11-03T09:40:00+09:00",
      "source": { "format": 1, "tables": [], "without_table": [] } }
  ],
  "left_out": [{ "part": "billing", "stage": "07-sitemap", "why": "other-repository" }],
  "ask_before": { "entries": ["releases", "deletions"], "source": "project", "left_out": ["external messages", "deploys", "payments", "publishing"] }
}
```

- 허브는 이것을 압축 JSON으로 보냅니다. 1차의 상한인 항목 3,000개, 점검 2,000개, 1,000,000바이트를 지켜 서버의 1 MiB 아래에 머뭅니다. 그림 자료 때문에 그것을 넘게 되면 가장 큰 것부터 그림을 통째로 빼고, 저마다 `left_out`에 `why: size`로, 그리고 `picture-left-out` 점검으로 적습니다(REQ-192).
- `repos.".".url`은 [보내기](#보내기)의 꼴로 맞춘 `origin` 원격의 주소이고, `repos.".".default`는 SPEC-105가 찾는 대로의 기본 브랜치입니다. 그것이 없으면 스냅샷에는 그림 자료가 없고 `pictures-not-sent` 점검이 있습니다.
- `replaces`는 보내기가 대신하는 쥔 커밋입니다([보내기](#보내기)). `hub.py snapshot`은 이것을 쓰지 않습니다.
- `records`는 단계 기록을 가져온 곳을 말합니다: 그 커밋과 시각이 있는 `repository`, 또는 `status-file`.
- 서버는 스냅샷을 `pictures` 없이 저장하고 그 원본은 그림이 간직하므로(05단계의 고른 것 3), `API-107`은 그것이 빠진 스냅샷, 곧 계약의 `StoredSnapshot02`를 돌려줍니다.

### 그림 자료

그림 자료는 저마다 `format: 1`과 세 가지 꼴 가운데 하나, 곧 계약의 `DomainSource`, `ErdSource`, `SitemapSource`를 지닙니다. 허브는 그것을 기본 브랜치의 커밋에서 한 부분의 단계별 원본 문서로부터 가져옵니다(SPEC-105\~SPEC-108):

- 요소마다 그 커밋에서의 파일과 줄인 `where`가 있으며, `docs/05-erd/nexus.sql:15`처럼 저장소에 대한 상대 경로입니다.
- 요소의 `id`는 그 추적 ID이고, 없으면 `""`입니다. `context`는 CTX ID이거나 `""`입니다. 이름은 120자에서, 다른 글은 제목처럼 300자에서 자르고, 목록마다 계약이 정한 상한에서 멈춥니다.
- 상태가 삭제라고 말하는 요소의 `removed`는 `true`이며, 상태는 [reading.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex-nexus/skills/corthex-hub/references/reading.md)가 읽는 대로 읽습니다.
- 비밀값과 이메일 주소는 `[redacted]`가 됩니다(REQ-191).
- 아래의 양식으로 다 읽을 수 없는 문서는 읽을 수 있었던 것을 주고, 그 자리를 적은 `picture-partial` 점검을 냅니다.

**DDD 보드(`01-domain`).** 01단계 양식 [01-domain.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex/skills/corthex-discover/references/01-domain.md)의 꼴을 영어로, 그리고 [docs/01-domain/nexus.ko.md](../01-domain/nexus.ko.md)처럼 한국어 문서가 쓰는 대로 한국어로 읽습니다. 허브는 표를 그 머리 줄로 찾고, 여기 적은 열을 어느 순서로든 읽으며, 이름은 대소문자와 띄어쓰기를 가리지 않고 견주고, 다른 열은 무시합니다.

| 요소 | 영어 양식 | 한국어 양식 |
| --- | --- | --- |
| 컨텍스트 | `### CTX-001 Ordering`처럼 CTX ID로 시작하고 그 이름이 뒤따르는 제목, 그 아래의 `Purpose: …` 줄과 `- External systems: …` 글머리 | 같은 제목과 `목적: …`, `- 바깥 시스템: …` |
| 그 유형과 애그리거트 | `Context`, `Type`, `Aggregates` 열이 있는 표 | `컨텍스트`, `종류`, `애그리거트` |
| 그 명령 줄 | 컨텍스트의 제목 아래에서 `Given by`, `Read model`, `Command`, `Aggregate`, `Events` 열이 있는 표. `Given by`에 홀로, 또는 주는 다른 쪽 뒤에 `Policy: when …`이 있는 줄은 정책입니다 | `주는 쪽`, `읽기 모델`, `명령`, `애그리거트`, `사건`; `정책: …` |
| 읽기 모델 | 명령 줄의 읽기 모델, 그리고 `Read model`, `Shows` 열이 있는 표 | `읽기 모델`, `보여 주는 것` |
| 의존 | `From`, `To`, `Kind`, `Why`, `Data` 열이 있는 표. `call`로 시작하는 종류는 `call`, `event`로 시작하는 것은 `event`, 그 밖은 `""` | `어디서`, `어디로`, `종류`, `까닭`, `오가는 것`; `바로 묻기`는 `call`, `사건 알림`은 `event` |
| 핫스팟 | `Hotspot`, `Context`, `State`, `Answer or next step` 열이 있는 표. `1.`처럼 글 첫머리의 번호가 핫스팟의 `number`이고, `Context` 아래의 CTX ID가 그 컨텍스트입니다 | `핫스팟`, `컨텍스트`, `상태`, `답이나 다음 할 일` |
| 용어집 | TERM ID가 든 `ID` 열과 `Term` 열이 있는 표 | `ID`, `용어` |
| 삭제된 컨텍스트와 용어 | `ID` 열과 삭제라고 말하는 `Status` 열이 있는 표 | `ID`, `상태`와 `삭제` |
| 타임라인 | 흐름(레인)마다 한 줄씩 차례대로인 `Lane`, `Events` 열의 표. `Events`에서 ` → `는 왼쪽에서 오른쪽으로 자리를 가르고, `, or `는 한 자리에 쌓인 사건을 가릅니다 | `흐름`, `사건`; 앞에 쉼표가 있든 없든 ` 또는 ` |

애그리거트나 읽기 모델은 `Picture (TERM-085)`처럼 그 이름 옆에 적은 TERM ID를, 아니면 같은 문서에서 대소문자와 띄어쓰기를 가리지 않고 그 이름이 용어인 용어집 줄의 것을 가져옵니다. 그런 줄이 없거나 둘이면 `board-term-missing` 경고를 받습니다(SPEC-106).

컨텍스트 제목 밖의 명령 표는 위쪽에서 가장 가까운 컨텍스트에 그 줄들을 남기고 `picture-partial` 검사를 붙입니다. 앞에 그런 제목이 없지만 문서의 다른 곳에 컨텍스트가 있으면, `id`와 `name`이 빈 컨텍스트에 줄들을 남기고 그 애그리거트와 읽기 모델의 `context`는 `""`로 둡니다. 컨텍스트가 하나도 없는 문서는 의존이나 타임라인을 포함해 DDD 보드를 내지 않습니다(SPEC-106).

명령 줄의 `Events`에서는 쉼표가 사건을 가르고, 맨 앞의 `or`(`또는`)는 이름에 들지 않습니다. 그래서 `Payment taken, or Payment failed`는 사건 둘입니다. 타임라인은 없어도 됩니다: 타임라인이 없는 문서는 `timeline`을 주지 않고, 그러면 그림 보기는 보드를 전체로만 보여 줍니다(SPEC-141). 흐름마다 그 줄의 자리인 `where`를 둡니다.

**ERD(`05-erd`).** [reading.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex-nexus/skills/corthex-hub/references/reading.md)와 05단계 양식 [05-erd.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex/skills/corthex-contract/references/05-erd.md)의 SQL입니다:

```sql
-- without a table: TERM-122
-- TBL-101 snapshots (CTX-009, terms: none) ← SPEC-111, SPEC-114
CREATE TABLE snapshots (
  name TEXT PRIMARY KEY,
  revision INTEGER NOT NULL
);
-- TBL-103 pictures (CTX-012, TERM-085) ← SPEC-118
CREATE TABLE pictures (
  project TEXT NOT NULL REFERENCES snapshots (name) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  PRIMARY KEY (project, stage)
);
```

- 표는 TBL ID 주석이 정하는 `CREATE TABLE`입니다. 그 이름 뒤의 괄호가 그 컨텍스트인 CTX ID와, 그 TERM ID나 `terms: none`을 줍니다. 둘 다 없는 주석은 `terms`를 빼며, SPEC-121이 그것을 알립니다.
- 열에는 그 이름, 적힌 그대로의 유형, `null`이 있으며, `null`은 `NOT NULL`인 열과 기본 키의 열에서 `false`입니다. 기본 키는 열이나 표의 `PRIMARY KEY`에서 옵니다. 유일 규칙은 열이나 표의 `UNIQUE`, 또는 `CREATE UNIQUE INDEX … ON`에서 오며, `WHERE`가 있는 것은 `partial: true`입니다. 외래 키는 열이나 표의 `REFERENCES`, 또는 `ALTER TABLE … ADD [CONSTRAINT …] FOREIGN KEY`에서 오며, `on_delete`는 소문자로, 없으면 `""`입니다.
- 부분의 SQL 어디에든 있는, TERM ID가 뒤따르는 주석 줄 `-- without a table:`은 부분이 표 밖에 두는 애그리거트를 적습니다.
- 열 이름으로 나타낼 수 없는 수식 인덱스는 그 고유 규칙 전체를 빼고 `picture-partial` 검사를 붙입니다. 함수 이름을 열로 그리지 않습니다. 표 주석의 삭제 상태는 다른 단계 항목과 같은 상태말을 읽습니다. 명시한 `status:`(`상태:`)가 우선이며, 그것이 없으면 괄호 안이나 `|` 뒤의 독립된 메타데이터 칸이 삭제를 표시할 수 있습니다. 표 이름이나 설명 제목의 낱말은 상태로 읽지 않습니다. 이스케이프된 따옴표까지 구분해, 인용한 이름·제목 안의 구분자는 메타데이터로 읽지 않습니다. 상태의 인용된 값은 값으로 읽습니다.
- 표지 `terms: none`, `without a table:`, `without a screen:`은 둘레의 코드처럼 모든 언어에서 같습니다.

**사이트맵(`07-sitemap`).** 07단계 양식 [07-sitemap.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex/skills/corthex-screen/references/07-sitemap.md)의 YAML에 `terms`를 더한 것입니다. 아래는 NEXUS 자신의 [nexus.yaml](../07-sitemap/nexus.yaml)에 있는 화면 둘입니다:

```yaml
- id: SCR-104
  name: Stage detail
  path: "/#p={project}&s={stage}"
  access: anyone Cloudflare Access lets in, or the device's user
  flows: [FL-105, FL-113]
  terms: none
  status: active
  children:
    - id: SCR-109
      name: Stage overview
      path: "/overview/{project}/{part}/{stage}"
      access: anyone Cloudflare Access lets in, on the server
      flows: [FL-113]
      terms: [CTX-007, TERM-120]
      status: active
# without a screen: TERM-121
```

- 화면마다 `id`, `name`, `path`, `access`, `flows`, 그리고 `children` 아래의 중첩에서 오는 `parent`, 곧 `screens`에서 그 부모의 자리를 지닙니다. 부분이 갖지 않은 부모는 화면을 맨 위에 두고 `picture-partial` 점검을 냅니다.
- `terms`는 화면의 컨텍스트인 CTX ID와 그것이 나타내는 TERM ID를 담습니다. `terms: none`과 `terms: []`는 아무것도 나타내지 않는다고 말하고, 둘 다 없는 화면은 `terms`를 뺍니다.
- TERM ID가 뒤따르는 주석 줄 `# without a screen:`은 부분이 어느 화면에도 보이지 않는 읽기 모델을 적습니다([앞 단계의 변경](#앞-단계의-변경)).

### 프로젝트 설정

프로젝트 설정 `.corthex/project.json`에 두 필드가 생기며, 핵심 플러그인의 [project.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex/skills/corthex/references/project.md)가 0.2 릴리스와 함께 그것을 더합니다:

| 필드 | 유형 | 뜻 |
| --- | --- | --- |
| `parts` | 글의 목록 | 선택. 허브 페이지가 보이는 차례대로의 프로젝트의 부분: 소문자와 숫자로 된 낱말을 하이픈으로 이은, 저마다 100자까지의 서로 다른 이름 1\~50개. 문서는 단계별 원본에서 그 경로가 부분의 이름과 `/`, `.`, `-` 가운데 하나로 시작하는 부분에 속하고, 그런 이름 가운데 가장 긴 것이 이깁니다: 단계별 원본이 `docs/01-domain/`이면 `nexus.md`와 `nexus/board.md`는 `nexus`에 속합니다 |
| `ask_before` | 글의 목록 | 선택. 이 프로젝트에서 먼저 물을 일이며, 프로필의 목록을 대신합니다(SPEC-110) |

다른 꼴의 `parts`는 없는 것으로 치고 `parts-invalid` 경고를 냅니다. 허브는 핵심 플러그인의 기본 `ask_before` 목록, 곧 그 예시 프로필에 있는 `["external messages", "deploys", "payments", "deletions", "publishing"]`의 사본을 지니며, 기억의 컨텍스트가 그렇게 하듯 시험 하나가 둘을 견줍니다.

### 단계 기록

단계 기록은 05단계의 [단계 기록](../05-erd/nexus.ko.md#단계-기록-tbl-115)에 있는 TBL-115의 파일이고, 계약의 `StageRecords`가 그것을 검사합니다: `parts`가 적은 부분마다 `.corthex/stages/<part>.json`, 또는 부분이 없는 프로젝트에서는 `.corthex/stages.json`. 허브는 그것을 기본 브랜치의 커밋에서 Git의 객체 읽기로 읽고, `status`(API-134)로 작업 트리에 씁니다. 올바른 JSON이 아니거나, 다른 `format`이거나, 네 가지가 아닌 상태가 있는 파일은 `records-invalid` 경고를 받고, 그 단계는 `unknown`으로 보입니다(SPEC-109).

`RecordCheckpoint.where`는 선택 필드입니다. `status --where`도 선택이며, SPEC-109는 스냅샷에서 안전하지 않은 링크를 빼되 승인한 것·역할·날짜는 남깁니다. 상태 파일을 대신 읽을 때는 1차의 `checkpoint`와 `checkpoint_date`를 보존하고 역할이나 NEXUS 확인 지점을 지어내지 않습니다. 이 옛 글을 자동으로 저장소 확인 지점으로 바꾸지 않습니다. 옛 `done`에 확인 지점과 유효한 날짜가 모두 있지 않으면 경고와 함께 `in_progress`로 보입니다(REQ-085).

### 보낼 편지함의 파일

보낼 편지함의 파일은 저마다 05단계의 [보낼 편지함](../05-erd/nexus.ko.md#보낼-편지함-tbl-117)에 있는 TBL-117이며, 그 `path`, 곧 요청의 경로가 시도마다 첫 시도가 간 곳으로 가게 합니다. 계약의 `OutboxFile`이 그것을 검사합니다:

```json
{
  "format": 1,
  "write": "nw_6t9w2z5c8f1j",
  "project": "corthex",
  "request": "reply",
  "path": "/api/spaces/corthex/comments/nc_3a6d9g2j5m8r/replies",
  "session": "claude-code-4f2a91",
  "made": "2026-11-03T07:00:00.000Z",
  "body": { "text": "표는 부분마다 줄 하나를 간직합니다." },
  "tries": 1,
  "failure": "no network"
}
```

`request`는 에이전트의 [요청 이름](#요청-이름) 가운데 하나입니다. 파일은 쓰기 ID를 따옴표 없이 간직하고, 허브가 헤더에 따옴표를 더합니다.

### 페이지 자료

- 허브 페이지는 `<script id="hub-data" type="application/json">`에 `corthex-hub-page/0.2`, 곧 계약의 `HubPageData`를 담습니다: 1차의 멤버와 `spaces`이며, `spaces`는 공간이 있는 프로젝트마다 그 그림, 열린 것의 개수, 기록을 기다리는 확인 지점, 경고를 담습니다. `lang`은 1차처럼 서버의 `NEXUS_LANGUAGE`에서, 기기에서는 프로필에서 옵니다.
- 그림 보기와 단계 현황은 `<script id="view-data" type="application/json">`에 `corthex-view-page/0.2`, 곧 계약의 `ViewPageData`를 담습니다: `picture`나 `overview`인 `view`; API-111이나 API-112의 응답인 `data`; 그리고 서버가 그것을 읽지 못했을 때의 문제 세부 정보인 `problem`, 이를테면 `picture_not_found`. 쓰기 뒤에 보기 화면은 그 요청으로 자료를 다시 읽습니다.
- 다시 디자인의 단계 페이지 API-154는 같은 스크립트 블록에 `corthex-stage-page/0.3`, 곧 계약의 `StagePageData`를 담습니다: 기본 순서의 처음 항목 200개에 대한 API-158의 응답인 `data`; 단계 전체에 대한 API-152의 응답인 `talk`, 공간이 없는 프로젝트에서는 null; 그림이 있는 단계에서 API-111의 응답인 `picture`, 그 밖에는 null; 그리고 페이지가 담지 못한 것의 문제 세부 정보인 `problem`, 곧 `space_not_found`나 `picture_not_found`.

## 점검 규칙

허브의 새 규칙이며, 허브의 [reading.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex-nexus/skills/corthex-hub/references/reading.md)가 0.2 릴리스와 함께 이것을 더합니다:

| 규칙 | 수준 | 뜻 |
| --- | --- | --- |
| `pictures-not-sent` | warn | 저장소에 허브가 읽을 수 있는 기본 브랜치가 없습니다: `origin` 원격이 없거나, 그 head가 기록되지 않았거나, Git이 없습니다. 스냅샷에는 그림 자료가 없고, 메시지는 `git remote set-head origin --auto`를 돌리라고 말합니다(SPEC-105) |
| `picture-left-out` | warn | `left_out`이 말하는 대로, 그 크기 때문에 또는 그 단계별 원본이 다른 저장소에 있어서 그림 하나를 통째로 뺐습니다(SPEC-105) |
| `picture-partial` | warn | 그림으로 그리는 문서를 다 읽지 못해, 그 그림에는 읽을 수 있었던 것만 있습니다. 점검은 그 자리와 까닭을 적습니다: 이를테면 어느 컨텍스트 제목 아래에도 없는 표, 컨텍스트가 없는 문서, 부모가 없는 화면, 양식의 꼴이 아닌 YAML(SPEC-105, SPEC-106, SPEC-108) |
| `part-unknown` | info | 그림으로 그리는 문서가 어느 부분에도 속하지 않아, 프로젝트 전체의 그림에 그립니다(SPEC-105) |
| `parts-invalid` | warn | 프로젝트 설정의 `parts`가 서로 다른 부분 이름 1\~50개가 아니어서, 프로젝트를 부분 없이 읽습니다 |
| `board-term-missing` | warn | 애그리거트나 읽기 모델에 그 이름의 용어집 줄이 없거나 둘이어서, 용어가 없거나 첫 것을 씁니다(SPEC-106) |
| `records-invalid` | warn | 단계 기록 파일이 올바른 JSON이 아니거나 아는 형식이 아니거나, 기록에 네 가지가 아닌 상태, 확인 지점과 그 날짜가 없는 `done`, 13개가 아닌 단계 키, 설정이 적지 않은 부분이 있습니다. 점검은 그 파일과 무엇이 잘못됐는지 적습니다(SPEC-109) |
| `records-in-status-file` | info | 기본 브랜치의 커밋에서 저장소에 단계 기록이 없어 기기의 진행 기록 파일에서 가져왔으며, 저장소로 옮겨야 합니다(SPEC-109) |
| `ask-before-invalid` | warn | 프로젝트나 프로필의 `ask_before`가 글의 목록이 아니거나 프로필을 읽을 수 없어, 다음 목록을 씁니다(SPEC-110) |
| `ask-before-long` | info | 목록에 값이 30개보다 많아 앞의 30개를 간직합니다(SPEC-110) |

서버는 단계를 읽을 때, 곧 단계 현황과 허브 페이지에서 그 단계에 규칙 하나를 더하고, 저장된 스냅샷에는 절대 더하지 않습니다: NEXUS에서 철회한 확인 지점을 적은 저장된 단계 기록에 대한 `checkpoint-withdrawn`, `warn`입니다. 기록이 그것을 더는 적지 않는 보내기까지 단계의 기록된 상태 옆에 보입니다(SPEC-140).

## 상한

05단계의 [상한](../05-erd/nexus.ko.md#상한)이 그대로이고, 이 단계가 다음을 더합니다:

| 상한 | 값 |
| --- | --- |
| 쓰기의 본문 | 256 KiB |
| 서버의 시계보다 앞선 시각의 스냅샷 | 1차처럼 10분 |
| 읽기의 목록 | [읽기](#읽기)가 적은 대로 |
| 보내기 응답의 목록 | 저마다 20개와 그 개수 |
| 허브의 요청 | 30초 안의 응답 |

## 경우의 수

| 종류 | 계약이 적는 것 |
| --- | --- |
| 접근 | 모든 요청의 보안. Access가 답하므로 `401`은 절대 Worker의 것이 아닙니다. `access_missing`, `access_other_app`, `cross_site`, `user_only`, `agent_only`, `no_kind`가 있는 `403` |
| 입력 | `invalid_request`, `invalid_snapshot`, `clock_ahead`, `unknown_item`이 있는 `400`, 그리고 글과 본문의 `413`. 필드마다 05단계의 상한이 있습니다 |
| 대상 | 항목의 종류마다 코드가 있는 `404`. 꼴이 다른 경로 값도 같은 `404`를 받습니다 |
| 상태 변화 | `comment_closed`, `proposal_not_open`, `edit_state`, `checkpoint_recorded`처럼 까닭마다 코드가 있는 `409` |
| 되풀이 | 쓰기 ID: 다시 보낸 쓰기는 첫 응답을 받고, 다른 요청의 ID는 `409` `write_id_reused`를 받습니다. 보내기는 커밋 규칙을 따르고, 두 번 보낸 지우기는 `404`를 받습니다 |
| 동시성 | 쓰기는 하나씩 차례로 받습니다. 다른 보내기에 앞질린 보내기는 `409` `commit_not_replaced`를, 다른 세션이 맡은 항목은 `409` `claimed`를 받습니다 |
| 상한 | 공간의 상한에는 `409`, 크기에는 `413`. 서버 자신의 `429`는 없습니다: Cloudflare의 한도를 따르고, 허브는 `429`를 받은 에이전트의 쓰기를 보낼 편지함에 간직합니다 |
| 바깥 서비스 | 없음: 서버는 다른 서비스를 부르지 않습니다. D1의 실패는 `500` `internal`이고, 허브는 그것을 받은 에이전트의 쓰기를 간직합니다 |
| 자료 노출 | 응답에는 쓴 쪽의 종류 말고는 신원이 없고, 저장된 스냅샷에는 그림 자료가 없으며, 목록에는 제안의 단계별 원본 글 대신 그 길이가 있습니다 |
| 빈 응답과 스트림 | 목록마다 `nothing`이나 `empty` 예시가 보이듯 총수 0인 빈 목록. `204`와 스트림은 없습니다 |
| 화면 상태 | 더할 것 없음. 08단계가 응답마다 상태로 잇습니다 |
| AI 응답 | 없음: NEXUS는 AI 모델을 부르지 않습니다(REQ-121) |

## 오류 코드

계약의 `components.x-corthex.errors`가 적는 대로의 모든 요청의 코드이며, `code` 멤버는 다른 것을 받지 않습니다. 더하는 멤버는 그 코드가 [오류의 모양](#오류)에 더하는 것입니다. 사용자가 보는 말은 계약에 영어로 있는 초안을 옮긴 것이고, 08단계가 보기 화면의 상태를 위해 영어와 한국어로 최종 문구를 정합니다. 뜻과 클라이언트가 하는 일은 이 단계의 것입니다.

| 코드 | 상태 | 뜻 | 더하는 멤버 | 사용자가 보는 말 | 클라이언트가 하는 일 |
| --- | --- | --- | --- | --- | --- |
| `invalid_request` | 400 | 필드, 헤더, 본문이 제 꼴이 아닙니다. field가 그것을 적습니다 | `field` | 올바르지 않습니다. 표시한 칸을 확인해 주세요 | 보기 화면은 그 필드 옆에 말을 보여 줍니다. 허브는 필드를 알리고 그 쓰기를 보낼 편지함에서 버립니다 |
| `invalid_snapshot` | 400 | 스냅샷이 corthex-hub/0.1이나 0.2 형식이 아닙니다. field가 처음 잘못된 필드를 적습니다 | `field` | 스냅샷이 올바르지 않습니다 | 허브는 필드를 알리고, 다시 보내려고 간직하는 것은 없습니다 |
| `clock_ahead` | 400 | 스냅샷의 시각이 서버의 시계보다 10분 넘게 앞섭니다 | 없음 | 스냅샷의 시각이 미래입니다. 기기의 시계를 확인해 주세요 | 허브가 그것을 알립니다 |
| `unknown_item` | 400 | 제안이 그 그림에 없고 adds도 적지 않은 항목을 적습니다. items가 그것을 적습니다 | `items` | 제안이 그림에 없는 항목을 적었습니다 | 허브는 그 항목을 알리고, 에이전트는 단계별 원본을 확인합니다 |
| `access_missing` | 403 | Cloudflare Access가 요청을 검사하지 않았습니다 | 없음 | Cloudflare Access가 이 요청을 검사하지 않았습니다. 먼저 Access로 서버를 지켜 주세요 | 허브는 거절된 토큰으로 알립니다. 보기 화면은 로그인이 없다고 말하고 다시 불러오자고 합니다 |
| `access_other_app` | 403 | ACCESS_AUD가 적은 것이 아닌 다른 Access 애플리케이션이 요청을 검사했습니다 | 없음 | 이 요청은 다른 Access 애플리케이션을 위해 검사됐습니다 | access_missing과 같습니다 |
| `cross_site` | 403 | 브라우저가 다른 사이트에서 변경을 보냈습니다 | 없음 | 다른 사이트에서 온 변경은 받지 않습니다 | 보기 화면은 서버 자신의 주소에서 페이지를 열자고 합니다 |
| `user_only` | 403 | 요청에 사람 자신의 로그인이 필요합니다. needs는 user입니다 | `needs` | 직접 로그인한 본인만 할 수 있습니다 | 허브는 사용자가 보기 화면에서 이것을 한다고 알립니다 |
| `agent_only` | 403 | 요청에 서비스 토큰이 필요합니다. needs는 agent입니다 | `needs` | 이것은 에이전트만 허브를 거쳐 합니다 | 보기 화면은 절대 보내지 않습니다. 허브는 없거나 거절된 서비스 토큰을 알립니다 |
| `no_kind` | 403 | Access가 요청을 들여보냈지만, 그 신원이 사람의 로그인도 서비스 토큰도 아닙니다 | 없음 | 이 로그인으로는 여기에 쓸 수 없습니다 | 보기 화면과 허브가 그것을 알리고, 사용자가 Access 정책을 확인합니다 |
| `not_found` | 404 | 그런 경로가 없거나, 보기 화면의 코드에 그런 파일이 없습니다 | 없음 | 찾을 수 없습니다 | 보기 화면은 허브 페이지로 잇습니다 |
| `project_not_found` | 404 | 서버에 그 프로젝트의 스냅샷이 없습니다 | 없음 | 이 프로젝트는 서버에 없습니다 | 허브는 지우거나 읽을 것이 없다고 알립니다. 보내기는 프로젝트를 새것으로 저장합니다 |
| `space_not_found` | 404 | 0.1의 허브만 보냈으므로 프로젝트에 공간이 없습니다 | 없음 | 이 프로젝트에는 아직 서버에 그림이 없습니다. corthex-nexus 0.2로 보내 주세요 | 허브는 그렇다고 말하고 아무것도 보내지 않습니다 |
| `part_not_found` | 404 | 저장된 스냅샷에 그 부분이 없습니다 | 없음 | 이 부분은 프로젝트의 스냅샷에 없습니다 | 보기 화면은 허브 페이지로 잇습니다 |
| `picture_not_found` | 404 | 공간에 그 부분과 단계의 그림이 없습니다. why가 아직 그리지 않았는지, 스냅샷이 크기 때문에 뺐는지, 그 원본이 다른 저장소에 있는지 말합니다 | `why` | 이 단계와 부분에는 아직 그린 그림이 없습니다 | 보기 화면은 why와 함께 빈 상태를 보여 줍니다 |
| `comment_not_found` | 404 | 공간에 그런 의견이 없습니다 | 없음 | 이 의견은 서버에 없습니다 | 보기 화면은 그림을 다시 불러옵니다. 허브는 그것을 알리고 쓰기를 버립니다 |
| `discrepancy_not_found` | 404 | 부분에 그런 어긋남이 없습니다 | 없음 | 이 어긋남은 서버에 없습니다 | comment_not_found와 같습니다 |
| `proposal_not_found` | 404 | 공간에 그런 제안이 없습니다 | 없음 | 이 제안은 서버에 없습니다 | comment_not_found와 같습니다 |
| `edit_not_found` | 404 | 공간에 그런 편집이 없습니다 | 없음 | 이 반영은 서버에 없습니다 | comment_not_found와 같습니다 |
| `checkpoint_not_found` | 404 | 공간에 그런 확인 지점이 없습니다 | 없음 | 이 확인 지점은 서버에 없습니다 | 단계 현황은 다시 불러옵니다. 허브는 그것을 알리고, 에이전트는 그 기록을 쓰지 않습니다 |
| `entry_not_found` | 404 | 공간에 그 ID의 의견, 어긋남, 편집, 확인 지점이 없습니다 | 없음 | 이 항목은 서버에 없습니다 | 허브는 그것을 알리고 그 항목을 둡니다 |
| `item_not_found` | 404 | 프로젝트의 저장된 스냅샷 어느 단계에도 그 항목이 없습니다 | 없음 | 이 항목은 지금 이 프로젝트의 단계에 없습니다 | 보기 화면은 항목의 ID와 함께 그렇다고 말하고, 그 항목을 아직 적은 대화를 따로 보여 주며, 모든 프로젝트에서 찾기를 내놓습니다 |
| `method_not_allowed` | 405 | 경로가 그 메서드를 받지 않습니다. Allow가 받는 메서드를 적습니다 | 없음 | 여기서는 이 요청을 할 수 없습니다 | 허브는 자기 잘못으로 알립니다 |
| `older_snapshot` | 409 | 쥔 커밋의, 또는 쥔 커밋이 없는 프로젝트의 스냅샷이 저장된 것보다 일찍 찍혔습니다. stored_at이 저장된 것을 찍은 때를 말합니다 | `stored_at` | 서버에 더 새로운 스냅샷이 있습니다 | 허브는 새 스냅샷을 찍어 다시 보냅니다 |
| `commit_not_replaced` | 409 | 쥔 커밋을 대신한다고 적지 않은 다른 커밋의 스냅샷, 저장된 스냅샷에는 커밋이 있는데 커밋이 없는 스냅샷, 또는 다른 보내기에 앞질린 보내기입니다. held_commit이 쥔 커밋을 적습니다 | `held_commit` | 서버에 다른 커밋이 있습니다. 기본 브랜치를 가져와 다시 보내 주세요 | 에이전트는 가져와서 한 번 다시 보냅니다 |
| `too_many_projects` | 409 | 서버에 프로젝트가 30개 있고, 스냅샷은 새 프로젝트의 것입니다 | `limit` | 서버에 프로젝트가 30개 있습니다. 먼저 하나를 지워 주세요 | 허브가 그것을 알립니다 |
| `repository_mismatch` | 409 | 스냅샷의 저장소 주소가 공간이 묶인 주소가 아닙니다. bound가 그 주소를 적습니다 | `bound` | 이 프로젝트의 공간은 다른 저장소에 묶여 있습니다 | 허브는 두 주소를 적고, 지우기가 공간의 묶임을 푼다고 말합니다 |
| `comment_limit` | 409 | 공간에 의견이 2,000개 있습니다 | `limit` | 이 프로젝트는 의견을 더 담을 수 없습니다 | 보기 화면은 글을 간직하고 그렇다고 말합니다 |
| `reply_limit` | 409 | 의견에 답글이 200개 있습니다 | `limit` | 이 의견은 답글을 더 담을 수 없습니다. 새 의견을 남겨 주세요 | 보기 화면은 글을 간직하고 새 의견을 권합니다 |
| `proposal_limit` | 409 | 공간에 열린 제안이 500개 있습니다 | `limit` | 이 프로젝트는 열린 제안을 더 담을 수 없습니다 | 허브는 그것을 알리고, 에이전트는 단계별 원본이 이미 넘어선 제안을 철회합니다 |
| `reflection_limit` | 409 | 공간에 반영 대기가 500개 있습니다 | `limit` | 이 프로젝트는 반영 대기를 더 담을 수 없습니다 | 보기 화면은 그렇다고 말하고, 제안은 열린 채로 남습니다 |
| `space_full` | 409 | 쓰기가 공간의 글을 8 MiB 넘게 만듭니다 | `limit` | 이 프로젝트의 공간이 찼습니다 | 보기 화면은 글을 간직합니다. 허브는 그것을 알립니다 |
| `comment_closed` | 409 | 에이전트가 닫힌 의견에 썼습니다. 닫힌 의견은 사용자의 답글만 다시 엽니다 | 없음 | 이 의견은 닫혔습니다 | 허브는 그것을 알리고, 에이전트는 그 의견을 둡니다 |
| `proposal_not_open` | 409 | 제안을 이미 받았거나, 버렸거나, 철회했습니다. state가 어느 것인지 말합니다 | `state` | 이 제안은 더는 열려 있지 않습니다 | 보기 화면은 그 상태를 보여 줍니다 |
| `edit_state` | 409 | 보고나 버림이 편집의 상태에 맞지 않습니다. state가 그 상태를 말합니다 | `state` | 이 반영은 다른 상태에 있습니다 | 보기 화면은 다시 불러옵니다. 허브는 그 상태를 알립니다 |
| `pull_request_reported` | 409 | 보고된 다른 PR이 아직 그 반영이나 확인 지점을 붙들고 있습니다. pull_request가 그것을 적습니다 | `pull_request` | 이미 PR이 이것을 붙들고 있습니다 | 허브는 그 PR을 알리고, 에이전트는 그 항목을 둡니다 |
| `pull_request_mismatch` | 409 | 보고가 그 항목에 보고된 PR이 아닌 다른 PR을 적습니다. pull_request가 보고된 PR을 적습니다 | `pull_request` | 보고된 PR이 아닙니다 | 허브는 두 PR을 알립니다 |
| `claimed` | 409 | 다른 에이전트 세션이 그 항목을 맡았습니다. ends_at이 언제까지인지 말합니다 | `ends_at` | 다른 세션이 이것을 맡고 있습니다 | 허브는 맡음이 끝날 때까지 그 항목을 건너뜁니다 |
| `entry_closed` | 409 | 닫힌 항목을 맡으려 했습니다 | 없음 | 이 항목은 닫혔습니다 | 허브는 그것을 건너뜁니다 |
| `checkpoint_recorded` | 409 | 저장된 단계 기록이 그 확인 지점을 적으므로, 철회하면 기록된 결정이 바뀝니다 | 없음 | 이 확인 지점은 기록됐습니다. 이것을 바꾸는 것은 새 결정입니다 | 단계 현황은 그 기록을 보여 줍니다 |
| `checkpoint_withdrawn` | 409 | 확인 지점을 철회했으므로, 새 기록 PR이 그것을 쓸 수 없습니다 | 없음 | 이 확인 지점은 철회됐습니다 | 허브는 그것을 알리고, 에이전트는 기록을 쓰지 않습니다 |
| `checkpoint_state` | 409 | 맞는 열린 기록 PR이 없거나 이미 기록됨 | 없음 | 체크포인트를 읽고 보고하세요 | 다시 읽음 |
| `not_recommended` | 409 | 의견이 더는 사용자를 기다리지 않거나, 마지막 글이 따를 추천이나 확인 지점을 묻지 않습니다 | 없음 | 이 일은 이제 답을 기다리지 않습니다 | 보기 화면은 그 항목을 그사이 답했거나 닫힌 것으로 표시하고 내 차례를 다시 읽습니다 |
| `write_id_reused` | 409 | 다른 요청이 그 쓰기 ID를 가졌습니다 | 없음 | 이것을 보내지 못했습니다. 다시 해 주세요 | 보기 화면은 새 ID를 만듭니다. 허브는 자기 잘못으로 알립니다 |
| `snapshot_too_large` | 413 | 스냅샷이 1 MiB보다 큽니다 | `limit` | 스냅샷이 서버가 받는 것보다 큽니다 | 허브가 그것을 알립니다. 허브 자신의 상한이 스냅샷을 그보다 작게 지킵니다 |
| `body_too_large` | 413 | 쓰기의 본문이 256 KiB보다 큽니다 | `limit` | 서버가 받는 것보다 큽니다 | 보기 화면과 허브가 그것을 알립니다 |
| `text_too_long` | 413 | 글이 그 상한보다 깁니다. field와 limit이 그것을 적습니다 | `field`, `limit` | 글이 너무 깁니다 | 보기 화면은 필드 옆에서 남은 글자 수를 셉니다. 허브는 그 필드를 알립니다 |
| `json_required` | 415 | application/json으로 보내지 않은 본문입니다 | 없음 | 이것을 보내지 못했습니다 | 허브는 자기 잘못으로 알립니다 |
| `internal` | 500 | 서버 안의 오류입니다. 그 로그에는 오류의 종류와 추적 ID만 있습니다 | 없음 | 문제가 생겼습니다. 다시 해 주세요 | 보기 화면은 가진 것을 간직하고 다시 보내자고 합니다. 허브는 그 쓰기를 보낼 편지함에 간직합니다 |

## 호환되지 않는 변경

허브의 [snapshot.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex-nexus/skills/corthex-hub/references/snapshot.md)가 설명하는 1차와 견주어:

1. 거절은 `application/problem+json`으로 보내는 문제 세부 정보이고, 멤버가 더 있습니다. `error`를 그대로 두므로, 어느 JSON 응답이든 읽고 `error`를 보여 주는 0.1의 허브도 여전히 까닭을 보여 주며, 까닭의 말은 새로 씁니다.
2. 0.1의 허브는 0.2의 허브가 보낸 프로젝트를 보낼 수 없습니다: 저장된 스냅샷에는 커밋이 있는데 그 스냅샷은 커밋을 적지 않으므로, 서버가 `409` `commit_not_replaced`로 거절합니다. 그런 프로젝트를 다시 보내기 전에 모든 기기의 허브가 0.2로 옮겨 갑니다.
3. 0.2의 허브는 1차의 서버에 보내지 않습니다. 1차의 서버는 0.2의 스냅샷을 `400`으로 거절하므로, 허브는 쥔 커밋을 묻는 질문에서 멈춥니다. 1차의 서버는 그 질문에 `code`가 없는 `404`로 답합니다. 그래서 0.2의 서버를 허브보다 먼저 배포합니다.
4. `push`는 저장한 스냅샷을 보내지 않고 새 스냅샷을 찍으며(SPEC-111), `remove --dry-run`은 서버를 읽으므로 서비스 토큰이 필요합니다.
5. 지우기는 스냅샷과 함께 프로젝트의 공간을 지우고(SPEC-115), `GET /api/snapshots/{project}`는 그림 자료가 없는 0.2의 스냅샷을 돌려줍니다.
6. 페이지 자료는 0.2의 페이지가 읽는 `corthex-hub-page/0.2`이고, 다른 것은 그것을 읽지 않습니다.

확인 지점이 2026-11-03에 이것을 받아들였으므로, 0.2는 이대로 나갑니다. 서버가 먼저이고, 그다음 모든 기기의 허브입니다.

## 앞 단계의 변경

2026-11-03에 확인 지점을 통과하며 반영했습니다. 1, 2, 6은 기능 명세에, 3\~5와 7은 서버의 자료에 들어갔습니다.

1. SPEC-113은 어떤 응답도 캐시하면 안 된다고 말합니다. 보기 화면의 코드 파일은 캐시해도 됩니다: 프로젝트 자료가 없고, 이름마다 그 내용의 다이제스트가 있으며, 휴대폰에서 보기 화면이 빠르려면 그것을 간직해야 합니다(REQ-149).
2. SPEC-108은 맨 위의 `without a screen` 목록을 적습니다. 07단계 양식의 YAML은 화면의 목록이어서 키를 둘 자리가 없으므로, SQL의 `-- without a table:`처럼 그 목록은 주석 줄 `# without a screen:`입니다.
3. TBL-117에 `path`가 생겨, 간직한 쓰기의 시도마다 첫 시도가 간 곳으로 갑니다.
4. 05단계의 읽기는 그림의 열린 의견을 그 답글과 결정과 함께 줍니다. 그림의 응답은 열린 의견마다 그 답글 수와 마지막 답글을 주고 의견 자신의 읽기(API-114)가 그 모두를 주어, 그림의 응답이 작게 머뭅니다. 제안의 단계별 원본 글도 같습니다(API-115).
5. 05단계의 그림 자료는 핫스팟의 번호를 줍니다. 양식의 핫스팟 표에는 번호 열이 없으므로, `number`는 선택이고 글 첫머리의 번호에서 가져옵니다.
6. SPEC-116은 보기 화면에서 의견을 다시 여는 것을 사용자의 쓰기에 세고, 기능 명세의 06단계 메모는 그것을 요청에 적습니다: 그것은 닫힌 의견에 단 사용자의 답글이며(SPEC-127), 따로 된 요청이 없습니다.
7. 05단계의 상한에 쓰기 본문의 256 KiB가 더해집니다.

## 이 단계가 고른 것

1. 꼴이 다른 경로 값은 서버가 갖지 않은 값의 `404`를 받고 절대 `400`을 받지 않습니다. 1차가 프로젝트 이름에 그렇게 답하는 것과 같습니다: 모든 경로에는 그것이 가리키는 것에 대한 거절이 하나 있고, 경로의 꼴은 그 이상을 알려 주지 않습니다.
2. 꼴이 맞지 않는 입력은 1차처럼 모든 요청에서 `400`을 받고 절대 `422`를 받지 않습니다. 상한을 넘은 글은 SPEC-126이 말하는 대로 `413`을, 상한에 닿은 공간은 `409`를 받습니다. 요청은 제 꼴이고, 찬 것은 공간이기 때문입니다.
3. 결과가 이미 그렇게 된 쓰기는 아무것도 바꾸지 않고 `changed: false`로 성공합니다. 다른 결과가 닫은 쓰기는 그 상태와 함께 `409`로 거절합니다([바꾸는 것이 없는 응답](#바꾸는-것이-없는-응답)). 기능 명세가 적은 경우는 기능 명세가 정합니다: 닫힌 의견에 답했음을 표시하는 것은 아무것도 바꾸지 않고(SPEC-127), 다른 탭에서 버린 제안을 받는 것은 거절합니다(SPEC-131).
4. 서버는 자기 속도 제한을 두지 않습니다. Access 뒤에서 한 사용자와 그 에이전트를 Cloudflare의 한도 안에서 맡고, Cloudflare의 `429`를 받은 에이전트의 쓰기는 보낼 편지함에 간직합니다.
5. 쓰기 ID는 Idempotency-Key 초안의 헤더에 담습니다. 페이지와 허브가 모든 쓰기에 같은 방법으로 보내고 서버가 본문보다 먼저 읽게 하려는 것이며, [쓰기 ID](#쓰기-id)가 적은 세 가지가 다릅니다.
6. 어느 요청도 `401`을 적지 않습니다: Access가 Worker보다 먼저 그것에 답합니다. 로그인에 대한 Worker의 거절은 1차처럼 코드가 있는 `403`입니다.
7. 오류는 1차의 `error`를 그대로 둔 문제 세부 정보여서, 0.1의 허브도 여전히 까닭을 보여 줍니다.
8. 의견, 제안, 편집, 확인 지점 하나마다 자기 읽기가 있어, 그림, 단계 현황, 할 일의 목록이 작게 머뭅니다.
9. 허브의 명령은 두 번째 도구를 두지 않고 1차의 `hub.py`를 넓히며, MEMORY의 명령이 결과를 주듯 종료 코드 0\~3과 `--json`을 둡니다.
10. 계약은 MEMORY의 인터페이스 옆에 YAML, 곧 `nexus.openapi.yaml`로 둡니다: 허브는 JSON처럼 YAML도 읽고, MEMORY의 시험은 이 폴더의 JSON 파일에 `id`라는 필드가 있는지 검사하는데, OpenAPI 계약의 예시에는 그런 필드가 있습니다.
11. SQL과 YAML에 있는 그림 자료의 표지 `terms: none`, `without a table:`, `without a screen:`은 둘레의 코드처럼 모든 언어에서 영어입니다. DDD 보드의 표는 사람들이 쓰는 대로 영어와 한국어로 읽습니다.

② 차례를 위해 이 단계가 고른 것([② 차례의 인터페이스](#②-차례의-인터페이스)):

12. 임시 저장의 요청은 그림의 경로 아래에 두고, 임시 저장의 ID와 그 리비전을 본문에 적습니다. 그림이 있는 부분의 단계마다 임시 저장이 하나 열리고, 두 번째 창이 첫 창의 임시 저장을 찾아야 하기 때문입니다(REQ-240, REQ-241).
13. 저장마다 차이 대신 바뀐 것 목록과 편집기의 요소를 통째로 보냅니다. 거절된 저장이 반쯤 쓴 것을 남기지 않고, 다른 PC가 마지막으로 저장한 것을 열게 하려는 것입니다. 마지막 바꿈에서 2초 안의 저장이 하나하나를 작게 두고, 1 MiB가 그 상한입니다.
14. 바뀐 것이 아직 들어맞는지는 그 `before`를 지금의 그림과 견주어 읽습니다. 다시 그리기가 임시 저장에 아무것도 쓰지 않게 하려는 것이며, 임시 저장이 더하는 항목은 에이전트의 병합 보고가 그 ID를 줄 때까지 임시 이름을 지닙니다(D14).
15. 이미 없어진 임시 저장을 버리는 것은 0.2의 바꾸는 것이 없는 응답처럼 아무것도 바꾸지 않고, 그사이 닫힌 보낸 편집을 버리는 것은 SPEC-173이 말하는 대로 `409`로 거절합니다.
16. 보드의 변경은 작업 목록을 담은 요청 하나로, 모두 쓰거나 아무것도 쓰지 않으며 보드 판 하나입니다. 에이전트의 스텝의 초안과 사용자가 스티커 여러 개를 바꾼 것이 저마다 변경 하나가 되게 하려는 것이며(SPEC-178, SPEC-179), 붙이는 요소에는 키를 두고, 새 프레임의 복사본은 그것이 복사한 요소를 적어 가리킵니다.
17. 에이전트는 자기 스티커처럼 자기가 그린 화살표와 묶음만 바꾸거나 없애고(REQ-254), 그 밖에는 의견으로 묻습니다.
18. 에이전트의 읽음은 허브가 빠짐없이 읽은 뒤 따로 보내는 요청으로 남기고, 맡음처럼 쓰기 ID가 없으며 보낼 편지함에 결코 두지 않습니다. 끊긴 읽기가 아무것도 남기지 않게 하려는 것입니다(SPEC-181).
19. 열린 보드는 스트림 대신 10초마다 `since`로 바뀐 것을 묻습니다. 0.2에는 스트림이 없고, 보드 하나는 한 사람과 그 에이전트를 맡기 때문입니다(23번).
20. 워크숍의 확인 지점은 API-128로 통과하고 그 반영은 `differs`와 함께 API-130으로 보고합니다. 0.2의 확인 지점, 맡음, 기록이 그것을 맡게 하려는 것이며, NEXUS에서는 사용자만 그것을 통과시킵니다(D15).
21. 보드에서 하는 허브의 일은 명령 세 개, `workshop`, `board`, `change`로 하고, 변경은 JSON 파일로 줍니다. 스텝의 초안에는 옵션이 담을 수 있는 것보다 많은 스티커가 있기 때문입니다.

## 돌린 검사

2026-11-02에 계약과 이 파일에 대해:

- openapi-spec-validator 0.7.1: 계약은 올바른 OpenAPI 3.1입니다.
- 저장소 밖에 두는, PyYAML과 jsonschema로 쓴 이 단계의 Python 검사: 모든 작업에 API ID, 그 SPEC ID, 상태가 있고, 단계의 표가 적는 응답마다 그것을 적거나 `omit`에 까닭과 함께 적으며, 모든 응답에 그 스키마가 받는 이름 붙은 예시가 있고, 모든 오류 예시의 코드가 같은 상태로 목록에 있으며, 모든 쓰기가 쓰기 ID를 받고 다른 요청이 가져간 ID에는 `409` `write_id_reused`로 답합니다. 문제 없음.
- Prism 5.16.0, `prism mock`: 계약이 그 32개 작업과 함께 불러와집니다. 큰따옴표 안의 쓰기 ID는 통과하고, 따옴표가 없는 것은 `400`을 받습니다.
- 그 모의 서버에 대한 Schemathesis 3.39.16, 검사 `not_a_server_error`, `status_code_conformance`, `content_type_conformance`, `response_schema_conformance`와 작업마다 예시 25개: 32개 작업이 모두 요청 858개에서 통과합니다. 도구의 두 버릇은 저장소 밖에 두는 훅으로 비켜 두었고, 실행마다 그것을 셉니다: 도구는 `CF_Authorization` 쿠키를 아무 글자로나 만드는데 Node의 HTTP 서버가 모의 서버가 보기 전에 그것을 맨 `400`으로 거절하므로, 훅이 쿠키에 출력할 수 있는 대신 값을 줍니다. 그리고 도구는 경로 값을 응답 예시의 같은 이름 멤버로, 이를테면 `{edit}`을 `edit` 객체로 채우므로, 훅이 매개변수 자신의 예시를 되돌려 놓습니다. 스냅샷의 큰 본문 때문에 그 상태 검사 `data_too_large`는 껐습니다.
- 모의 서버는 이것들 대부분을 설계상 통과하므로, 계약을 증명하는 것은 실제 서버뿐입니다: 11단계는 같은 도구를 사용자 자신의 서버가 아니라 Access 뒤의 개발 서버에 돌립니다.
- 이 파일들을 둔 채로 돌린 저장소의 검사: `python -m unittest discover -s tests`(시험 725개, 건너뜀 12개), 마켓플레이스와 그 세 플러그인의 `claude plugin validate --strict`, `node --test nexus/test/*.test.js`(시험 15개)가 통과합니다. 허브가 찍은 이 저장소의 스냅샷은 API-101\~API-150을 한 번씩 읽고 점검이 없으며, 이 파일과 영어 원문의 링크는 모두 이어집니다.

2026-11-03에 확인 지점의 변경을 넣은 뒤, 같은 도구로:

- 이 단계의 검사와 openapi-spec-validator: 문제 없음. 계약의 예시 72개가 모두 쓰이며, 그중에 페이지의 HTML 응답이 있습니다.
- Prism의 모의 서버는 요청의 `Accept`가 `text/html`을 적으면 API-101\~API-103에 그 코드의 말을 담은 페이지로 답하고, 아니면 문제 세부 정보로 답합니다.
- 도구가 OpenAPI 3.1 계약에 요구하는 `--experimental=openapi-3.1`을 붙인 Schemathesis: 32개 작업이 모두 요청 858개에서 통과하고, 그중 Pages 아래의 네 작업, 곧 세 페이지와 보기 화면의 코드는 요청 103개에서 통과합니다. 세 번째 버릇도 같은 방법으로 비켜 두었습니다: 도구는 서비스 토큰의 두 헤더 `CF-Access-Client-Id`와 `CF-Access-Client-Secret`을 아무 글자로나 만드는데, Node의 HTTP 서버가 이것도 맨 `400`으로 거절하므로 훅이 저마다 출력할 수 있는 대신 값을 줍니다.
- 저장소의 검사가 통과하며, 이제 시험은 727개(건너뜀 12개)입니다. 허브가 찍은 이 저장소의 스냅샷은 항목 996개를 읽고 점검이 없습니다.

2026-11-03에 관리자가 01단계 이벤트 스토밍을 NEXUS에서 하기로 고른 뒤, 다시:

- openapi-spec-validator 0.7.1: `DomainSource`의 선택 항목 `timeline`을 넣은 계약은 올바른 OpenAPI 3.1입니다.
- 이 단계의 검사: 문제 없음. 이제 타임라인의 흐름 하나를 담은 예시 `picture_data_domain`을 그 스키마가 받고, 예시 72개가 여전히 모두 쓰입니다.
- Prism과 Schemathesis는 다시 돌리지 않았습니다: 이 변경은 스키마 하나에 선택 항목 하나를, 예시 하나에 흐름 하나를 더하고, 이 단계의 검사가 그것을 확인합니다.
- 저장소의 검사가 통과하며, 이제 시험은 756개(건너뜀 12개)입니다. 허브가 찍은 이 저장소의 스냅샷은 항목 1014개를 읽고 점검이 없습니다.

2026-11-08, 계약이 다시 디자인의 요청을 planned로 받았을 때(TASK-265), 로컬에서 합성 자료로:

- openapi-spec-validator: 계약은 요청 40개, 그 가운데 planned 8개로 올바른 OpenAPI 3.1입니다.
- 계약 검사: 이름 붙은 JSON 예시 445개가 모두 그 스키마에 맞고(이제 응답 검사가 이것을 돌립니다), 요청에 없는 칸이나 쿼리 값을 적은 예시가 없습니다. 이름 붙은 기본 응답 70개는 전처럼 통과하고, Schemathesis 3.39.16은 서버가 답하는 요청 32개를 검사마다 156/156으로 통과하며 planned 8개를 뺍니다. Prism은 돌리지 않았습니다.
- 저장소의 Python 시험 13개와 Node 시험 267개가 통과하고, 허브가 찍은 이 저장소의 스냅샷은 새 사례 4개를 포함해 항목 1264개를 읽으며, 경고 630개는 줄 번호 말고는 전과 같습니다.

### 개발 Access의 두 로그인 시험 (2026-11-03)

TASK-201은 임시 진단 Worker를 정적 자산 없이 Access 뒤에 올리고 서비스 토큰 요청(이 PC의 사용자 환경변수)과 Aside CLI 1.26.1028.2335의 사람 로그인 브라우저에서 실행했습니다. 둘 다 200이며 ctx.access audience와 JWT의 audience·발급자·기한·RS256 서명이 모두 맞았습니다. 로그인하지 않은 브라우저는 Access로 302였습니다. 아래는 필드의 있음(present)·비어 있음(empty)·없음(absent)만 기록하며 값은 기록하지 않았습니다.

| 출처 | 필드 | 사람 | 서비스 토큰 |
| --- | --- | --- | --- |
| ctx.access | aud | present | present |
| ctx.access | sub | absent | absent |
| ctx.access | email | absent | absent |
| ctx.access | common_name | absent | absent |
| getIdentity() | aud | absent | absent |
| getIdentity() | sub | absent | absent |
| getIdentity() | email | present | absent |
| getIdentity() | common_name | empty | absent |
| header JWT | aud | present | present |
| header JWT | sub | present | empty |
| header JWT | email | present | absent |
| header JWT | common_name | absent | present |

선택한 헤더 방법은 두 종류 모두를 구별합니다. 구현의 캐시·만료·키 교체·거절 시험과 전체 개발 API 계약 시험은 이 진단과 별도이며 아직 완료로 세지 않습니다. 진단 뒤 개발 Worker는 구현한 서버로 되돌립니다.

## 확인할 것

② 차례의 05·06단계는 그 02\~04단계가 2026-11-07 23:27(KST)에 통과한 뒤 확인 지점 하나로 왔고, 2026-11-08 09:33(KST)에 통과했습니다: 관리자가 프로젝트 스레드의 결정 카드에서 추천대로 통과시키기를 골라(‘추천대로 통과’), 이 단계의 고른 것 12\~21과 05단계의 12\~19는 적은 대로 둡니다. [② 차례의 인터페이스](#②-차례의-인터페이스)는 PC에서 고치기와 워크숍의 요청 API-161\~API-173, 허브의 명령 API-174\~API-176, 0.2와 다시 디자인의 인터페이스의 변경 13개, 오류 코드 19개를 적습니다. 확인 지점이 먼저 본 것: `before`가 무엇이 아직 들어맞는지 정하는 바뀐 것 목록(고른 것 14), 작업 목록을 담은 요청 하나인 보드의 변경(고른 것 16)과 화살표·묶음에 대한 에이전트의 한계(고른 것 17), 쓰기 ID 없는 읽음 표시(고른 것 18), 10초마다인 열린 보드의 요청(고른 것 19), 0.2의 확인 지점을 거치는 워크숍의 확인 지점(고른 것 20). 허브의 명령 세 개와 그 변경은 핵심 플러그인의 저장소에 있으므로, 다시 디자인처럼 ② 차례를 만들 때 그곳의 풀 리퀘스트와 새 `hub-ref.json`이 필요합니다.

2026-11-06 다시 디자인은 그날 17:44(KST)에 확인 지점 1을 통과했습니다(‘이대로 진행’). 그 변경 목록은 첫 화면의 자료를 한 번에 읽는 것과 그림이 없는 의견(선택 ② A)을 적었습니다. [다시 디자인의 인터페이스](#다시-디자인의-인터페이스)는 그 확인 지점 3을 위해 그것을 적고, 쓰면서 찾은 것을 함께 적습니다: 첫 화면에는 에이전트의 추천을 한 트랜잭션에서 따르는 쓰기 API-159가 하나 더 필요하고, 허브의 `comment`와 `reply`는 핵심 플러그인의 저장소에서 바뀌므로, 만들 때 그곳의 풀 리퀘스트와 새 `hub-ref.json`이 필요합니다. 확인 지점의 목록은 이 둘을 적지 않았습니다.

2026-11-03 관리자가 고른 01단계 이벤트 스토밍을 NEXUS에서 하는 것은 그것이 다른 단계에 낸 변경과 함께 같은 날 16:54(KST)에 통과했습니다: 관리자가 프로젝트 스레드의 결정 카드에서 스텝별 보기와 작업 보드를 그린 대로 통과시켰습니다(‘모두 그린 대로 통과’). 확인 지점이 다룬 것: `DomainSource`의 선택 항목 `timeline`과 [그림 자료](#그림-자료)에 적은 그 양식. 그것이 없는 그림 자료도 그대로 맞고 고정된 형식의 스냅샷도 그대로 통과하므로 호환되는 변경입니다. 그리고 ② 차례의 작업 보드(SPEC-142). 그 요청은 편집(SPEC-134)의 요청 곁에 그때 더합니다.

2026-11-03 11:39(KST)에 03\~05단계, 07·08단계와 함께 통과했습니다: 관리자가 프로젝트 스레드의 결정 카드에서 모든 추천을 골라(‘모두 추천대로’), 요청, 명령, 형식이 08단계의 변경과 함께 쓴 대로 섭니다. 로그인(3)은 그 시험 때까지 열려 있습니다. 확인 지점이 다룬 것:

1. [호환되지 않는 변경](#호환되지-않는-변경), 특히 한 기기가 0.2로 보낸 뒤에는 모든 기기의 허브가 0.2로 옮겨 가야 한다는 것과 서버를 먼저 배포한다는 것.
2. [앞 단계의 변경](#앞-단계의-변경), 특히 보기 화면 코드의 캐시(1)와 `# without a screen:` 줄(2).
3. 실제 Access 설정에서 시험할 때까지 열린 채로 두는 로그인([로그인](#로그인)). 시험은 11단계가 요청을 만들기 전에 합니다.
4. 초안의 헤더에 담는 쓰기 ID와 그 세 가지 차이([쓰기 ID](#쓰기-id)), 그리고 바꾸는 것이 없는 응답(고른 것 3).
5. 단계 스킬이 에이전트에게 돌리라고 할 허브의 명령 18개와 그 이름([허브의 명령](#허브의-명령)).

## 다음 단계를 위한 메모

### 07·08단계: 화면

- ② 차례에서: 편집기는 API-161을 읽고 API-162\~API-165와 API-167로 쓰며, 보낸 편집의 패널은 API-166으로 그것을 버립니다. 작업 보드는 API-168과 API-170을 10초마다 `since`와 함께 읽고, API-169, API-171, API-173으로 쓰며, 그 의견은 API-118로, 그 확인 지점 상자는 API-128과 API-129로 씁니다. `draft_revision`은 마지막으로 저장한 임시 저장을 권하고, `picture_changed`와 `draft_not_applying`은 편집 충돌로 이끌며, `element_changed`는 요소를 되돌려 놓고 그것을 바꾼 쪽을 말하고, `workshop_ended`와 `frame_closed`는 보드를 읽기만 하게 또는 지금 그대로 보여 주며, `board_changed`는 다시 통과시키도록 지금 그대로 보여 줍니다.
- 다시 디자인에서: 첫 화면은 API-151을 읽고 API-124, API-125, API-159로 씁니다. 단계 페이지는 API-158, API-111, API-152, API-157을 읽고, 연 의견·연 제안·대화가 더는 늘어놓지 않는 반영을 위해 API-114\~API-116도 읽으며, API-118\~API-120, API-124, API-125, API-127\~API-129로 씁니다. 찾기는 API-156을 읽습니다. 거절마다 0.2의 같은 거절이 이끄는 상태로 이끌고, `item_not_found`는 사라진 항목으로 이끕니다.
- 화면마다의 요청: 허브 페이지는 API-101; 그림 보기는 불러오기에 API-102와 API-104, 다시 읽기에 API-111, 의견이나 제안을 열기에 API-114와 API-115, 그림이 더는 늘어놓지 않는 닫히거나 버려진 반영을 읽어 제안의 패널에 그 PR을 보이기에 API-116, 쓰기에 API-118\~API-120, API-124, API-125, API-127; 단계 현황은 불러오기에 API-103과 API-104, 다시 읽기에 API-112, 쓰기에 API-128과 API-129.
- 오류가 이끄는 상태: `why`가 있는 `picture_not_found`는 빈 상태; `access_missing`, `access_other_app`, `no_kind`, `opaqueredirect` 응답은 권한이나 끝난 로그인; `cross_site`는 서버 자신의 주소를 권하는 오류; `comment_limit`, `reply_limit`, `space_full`, `text_too_long`은 글을 간직함; `proposal_not_open`, `edit_state`, `checkpoint_recorded`는 낡은 상태이며 보기 화면이 다시 읽습니다. 보기 화면은 보내지 못한 글을 그 쓰기 ID와 함께 간직합니다(SPEC-126).
- [오류 코드](#오류-코드)의 말마다 영어와 한국어로 최종 문구를 정합니다.

### 10단계: 작업 분해

- ② 차례에서, 다시 디자인 뒤에: 먼저 핵심 플러그인에서 허브의 명령 세 개와 그 변경을 새 `hub-ref.json`과 함께 만듭니다. 그다음 변환 5와 API-161\~API-167, API-110, API-111, API-116, API-126의 변경, 그다음 API-168\~API-173과 API-113, API-118, API-128\~API-132의 변경이며, 보기 화면이 마지막입니다.
- 다시 디자인에서: 먼저 핵심 플러그인에서 허브의 `comment`와 `reply`, 허브 페이지의 토큰을 새 `hub-ref.json`과 함께 만듭니다. 그다음 변환 4와 API-151\~API-159, API-118과 API-119의 변경, 그다음 페이지이며, API-101의 이동과 API-102, API-103의 리다이렉트가 마지막입니다.
- 서버가 먼저입니다: store.js의 변환, 그다음 계약의 순서대로 요청을 만듭니다. 쥔 커밋이 있는 보내기와 지우기, 읽기, 논의, 편집, 맡음이 있는 단계 진행 순입니다. 허브가 뒤따릅니다: 그림 자료, 단계 기록, 설정이 있는 스냅샷 0.2, `status`, `push`, 그다음 보낼 편지함이 있는 쓰기. 보기 화면이 마지막입니다.
- 릴리스는 이 파일의 형식과 규칙을 허브의 [snapshot.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex-nexus/skills/corthex-hub/references/snapshot.md)와 [reading.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex-nexus/skills/corthex-hub/references/reading.md)로, `parts`와 `ask_before`를 핵심 플러그인의 [project.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex/skills/corthex/references/project.md)로 옮기며, 허브의 명령을 돌리는 단계 스킬의 절차도 함께 옮깁니다.

### 11단계: 개발

- ② 차례에서: 보드의 변경이 통째로 쓰이거나 하나도 쓰이지 않고 보드 판을 하나 올리는지, 보낼 편지함이 변경을 통째로 간직하는지, 허브가 보드에서 읽은 것을 출력하기 전에 가리는지의 시험; 그리고 API-161\~API-173의 응답마다 계약의 예시 하나.
- 실제 Access 설정에서 두 가지 로그인을 시험하는 것이 먼저이며, 그것이 [로그인](#로그인)의 열린 질문을 닫습니다.
- 계약 시험은 [돌린 검사](#돌린-검사)의 훅을 저장소에 두고 Access 뒤의 개발 Worker에 Schemathesis를 돌립니다. 서버를 만들기 전에는 Prism의 모의 서버가 보기 화면의 작업을 맡습니다.
- 부분들을 함께 묶는 시험: 서버의 오류 코드와 계약의 목록, 허브의 요청 이름과 계약의 `OutboxFile`, 허브가 지닌 기본 `ask_before` 목록의 사본과 핵심 플러그인의 예시 프로필, 그리고 [어느 거절이 먼저인지](#어느-거절이-먼저인지)의 거절 순서.

### 12단계: QA

- ② 차례에서: API-161\~API-173과 바뀐 요청의 응답마다, 그리고 API-174\~API-176의 결과마다 사례 하나; 한 임시 저장과 한 스티커에 두 창; 다시 그리기를 사이에 두고 시작한 임시 저장; ID와 함께, 그리고 ID 없이 보고한 임시 이름; 상한마다 더한 프레임; 통째로 거절된 에이전트의 스텝의 초안; 끊긴 읽기; 그리고 그 프레임이 통과하는 동안 보낼 편지함에 간직한 변경.
- 다시 디자인에서: API-151\~API-159와 바뀐 API-118, API-119의 응답마다 사례 하나; 한 쓰기 ID로 두 번 보낸 API-159, 서비스 토큰으로 보낸 것, 더는 기다리지 않는 의견에 보낸 것; 그리고 다시 디자인의 서버에서 연 0.2의 모든 주소.
- 요청마다 응답마다 그 이름 붙은 예시로 `API-118#409`처럼 적는 시험 사례 하나, 그리고 명령마다 결과마다 Linux, macOS, Windows에서 하나씩.
- 위의 경우의 수: 두 번, 그리고 7일 뒤에 다시 보낸 쓰기, 다른 요청의 쓰기 ID, 한 항목에 두 세션, 다른 보내기에 앞질린 보내기, 0.2의 보내기 뒤의 0.1 허브, 보기 화면에서 끝나는 로그인, 그리고 네트워크 없이, 토큰 없이, 7일 뒤의 보낼 편지함.

## 2026-11-04 전송·계측·출시 결정

관리자는 REQ-147의 같은 출처를 유지하면서 공개 내용 해시 코드·스타일·글꼴의 거점 캐시를 승인했습니다. HTML·API·프로젝트 자료·거절 응답은 no-store입니다. 코드 응답에는 Set-Cookie와 Vary:*가 없고 CSP와 전체 호스트 Access를 유지합니다. 캐시 HIT도 미인증 GET/HEAD에 코드를 전달하지 않아야 합니다. 거점 HIT는 원 서버에 닿지 않으므로 원 서버 검증을 매 HIT마다 실행했다고 주장하지 않습니다.

REQ-124의 서버 처리 시간은 본문을 모두 받은 뒤부터 응답 처리 완료까지입니다. 본문 수신·왕복·CPU 구간·RSS는 따로 기록합니다. 기존31.085ms는1초 기준 통과이며 과거 전체1031.079ms는 그대로 보존합니다.

관리자는 REQ-149와 REQ-124 통과,710사례 전부 판정·Must 실패0,운영 자료 이전/복구 리허설, C1 출시·PR C 뒤의 코어 통합,필수 검사와 Code/Security 리뷰를 조건으로 NEXUS 병합·운영 전환·출시 태그를 사전 승인했습니다. 이 저장소 첫 보내기는 REQ-107의 별도 확인입니다. 이전 Worker/D1은 전환 뒤14일 보존하고 삭제는 다시 묻습니다. 조건이 남으면 수치로 한 번 묻고 답 뒤 출시합니다.

## 첫 그림 표시 결정, 2026-11-04

관리자가 현재 Codex 대화에서 “SVG 먼저 표시 + HTML 경로 개선 (추천)”을 명시적으로 선택했습니다. 고정 토큰, 같은 출처의 Access 경계와 실제 편집기 핀을 유지합니다. 서버에서 그린 완전한 SVG를 첫 그림으로 보여주고 Excalidraw/ERD Viewer를 이어 불러옵니다. REQ-149·TC-654·TC-1271·TC-1309는 기존 모바일·회선·CPU1 조건에서 이 첫 그림이 실제로 보인 시간을 잽니다. 편집기 준비 시간은 별도로 적고 이전 편집기 준비 실패와 미완료·계측 실패를 모두 보존합니다. DOM 준비 표시만으로 그림이 보이고 읽힌다고 판단하지 않습니다.

미리보기는 편집기와 같은 결정적 배치와 검사된 원본을 사용합니다. 글자·같은 페이지 링크를 안전하게 쓰며 SVG 스크립트·외부 콘텐츠·외부 자원은 넣지 않습니다. 편집기가 준비되는 동안 그림을 유지하고, 실패해도 미리보기와 항목 목록을 사용할 수 있습니다. 기본 화면 기능에서 실제 편집기로 넘어갈 때 현재 보고 있는 영역을 유지합니다. 불러오는 동안 프레임과 주변 배치를 유지하고 첫 미리보기와 편집기 준비 상태·시간을 구분합니다.

신뢰하는 고정 화면 CSS는 HTML 안에 넣어 스타일 요청이 미리보기를 막지 않게 할 수 있습니다. HTML·프로젝트 SVG·API 자료는 no-store를 유지하고 해시 코드·스타일·글꼴은 승인된 Access 보호 public immutable 캐시를 씁니다. 독립 서버는 내장 기능으로 크기를 제한해 HTML 압축을 협상하고 Tunnel 전송량을 줄일 수 있습니다. 프로젝트 자료를 공개 코드 파일이나 캐시에 넣지 않습니다. 이 결정과 미리보기는 출시·첫 실제 저장소 전송·Worker/D1 삭제 승인이 아니며 기존 조건부 출시 기준을 유지합니다.


반복 배치 안전 한계:300요소 목표와 일반 그림은 그대로입니다. 확장된노드(컨텍스트프레임포함)가20000을넘으면서버와보기가배치를중단하고명확한한계안내및최대3000원본항목목록/패널을남깁니다. 완전한그림/편집기ready로표시하지않고원본API/저장은보존하며GET/HEAD는200/no-store를유지합니다. [검증](../12-qa/runs/2026-11-04-svg-first.ko.md).
