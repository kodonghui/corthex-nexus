# NEXUS v3 서버

[English](README.md)

NEXUS v3의 서버예요. [WBS](../docs/10-wbs/wbs.ko.md)의 태스크 순서대로 만들어요. Node 24와 Node 자체 모듈로 돌아가고, 설치할 의존성이 없어요. v2처럼 Cloudflare Access 게이트 뒤에서 돌아가요.

TASK-413의 서버 골격, 곧 [api/openapi.yaml](../api/openapi.yaml)의 오퍼레이션을 위한 라우터, 환경 변수에서 읽는 설정, 요청마다 한 줄의 로그가 있고, TASK-414의 저장소, 곧 [db/migrations](../db/migrations/)의 마이그레이션이 만드는 데이터베이스가 있고, TASK-416의 입장 확인, 곧 소유자 요청마다 게이트의 로그인이 한 소유자의 것인지 확인하는 부분이 있어요. 아직 받는 오퍼레이션이 없어서, 오퍼레이션을 만드는 태스크가 추가하기 전까지는 모든 경로가 `not_found` Problem으로 응답해요.

## 실행

```sh
cd server
NEXUS_DATA_DIR=/absolute/path/to/a/data/folder \
NEXUS_ACCESS_ISSUER=https://<team>.cloudflareaccess.com \
NEXUS_ACCESS_AUD=<the application's audience tag> \
NEXUS_OWNER_EMAIL=<the owner's email address> \
node src/main.js
```

꺾쇠 괄호 안의 값은 자리 표시자예요. 실제 값은 서버의 환경 변수에만 두고 Git에는 넣지 않아요.

## 설정

| 변수 | 기본값 | 뜻 |
| --- | --- | --- |
| `NEXUS_HOST` | `127.0.0.1` | 서버가 요청을 받는 주소예요. IP 주소나 `localhost`예요. 게이트의 터널은 같은 머신에서 서버에 접속해요. |
| `NEXUS_PORT` | `8787` | 포트, 0부터 65535까지예요. 0이면 시스템이 빈 포트를 고르고, 시작 줄이 그 포트를 알려요. |
| `NEXUS_DATA_DIR` | 없음 | 저장소를 두는 폴더의 절대 경로예요. 새 설치는 이 폴더를 소유자만 읽을 수 있게 만들어요. 저장소 파일은 폴더 권한과 상관없이 늘 소유자만 읽을 수 있어요. |
| `NEXUS_ACCESS_ISSUER` | 없음 | 게이트의 팀 주소 `https://<team>.cloudflareaccess.com`이에요. 게이트의 로그인 토큰이 발급자(issuer)로 적는 주소이고, 그 아래 `/cdn-cgi/access/certs`가 서명 키를 알려요. 경로, 포트, 쿼리가 없는 https origin이어야 해요. |
| `NEXUS_ACCESS_AUD` | 없음 | 게이트에 있는 NEXUS 애플리케이션의 audience 태그, 소문자 16진수 64자리예요. |
| `NEXUS_OWNER_EMAIL` | 없음 | 한 소유자의 이메일 주소예요. 게이트의 로그인에 담긴 대로 적고, 대소문자는 가리지 않고 비교해요. |

빈 변수는 기본값을 써요. `NEXUS_DATA_DIR`과 게이트 설정 세 개는 기본값이 없어서 꼭 설정해야 해요. 값이 올바르지 않으면 서버는 종료 코드 1로 멈추고, 설정 이름과 어긴 규칙을 적은 줄 하나만 남겨요. 잘못 넣은 값이 시크릿일 수 있어서 값은 적지 않아요.

## 저장소

저장소는 데이터 폴더 안의 SQLite 파일 하나, `nexus-v3.sqlite`이고, Node 자체 모듈 `node:sqlite`로 열어요(`src/store.js`). 서버는 요청을 받기 전에 저장소를 열고, 저장소에 아직 없는 `db/migrations`의 마이그레이션을 트랜잭션 하나로 적용해요. 그래서 마이그레이션이 실패하면 아무것도 바뀌지 않고 서버가 멈춰요. 아직 멈추는 중인 서버처럼 다른 연결이 잠금을 잡고 있으면 5초까지 기다려요. 새 설치는 빈 저장소로 시작해요(SPEC-015). 커밋 전에 멈춘 새 설치는 SQLite의 저널로 롤백되고, 다음 시작 때 다시 실행돼요.

- **스키마는 `db/nexus.sql`과 같아요.** 0001부터 빠짐없이 번호가 붙은 마이그레이션이 빈 데이터베이스에서 스키마를 만들어요. `test/store.test.js`는 마이그레이션이 만든 스키마와 `db/nexus.sql` 사이에 차이가 없는지 검사해요. 저장소는 자기 테이블을 따로 두지 않아요. 표시는 SQLite 헤더에 있어요. NEXUS v3의 application ID(`NXS3`)와, user version으로 적은 마지막 마이그레이션 번호예요.
- **다시 실행해도 아무것도 바뀌지 않아요.** 모든 마이그레이션이 적용된 저장소에는 쓰지 않아요.
- **v2 저장소는 읽지 않아요.** v2는 저장소 이름을 `nexus.sqlite`와 `rebuild.sqlite`로 썼고, v3는 `nexus-v3.sqlite`만 열어요. 그래서 같은 폴더에 있는 v2 저장소는 읽지 않은 채로 남아요. 저장소 이름을 가졌지만 NEXUS v3 저장소가 아닌 파일, 예를 들어 복사한 v2 저장소는 SQLite가 열기 전에 100바이트 헤더만 보고 거절하고, 그대로 둬요. 이 서버가 아는 것보다 새로운 서버가 더 마이그레이션한 저장소도 마찬가지예요.
- **마이그레이션.** 어디서든 한 번 적용된 마이그레이션은 고치지 않고, 다음 마이그레이션을 추가해요. `db/migrations`에 `.sql`로 끝나거나 숫자 네 자리로 시작하지만 `0001_initial.sql`처럼 이름 붙지 않은 파일이 있으면, 건너뛰지 않고 서버를 멈춰요. 서버는 저장소의 `db/migrations`를 읽으므로 저장소 체크아웃에서 실행해요. 마이그레이션이 테이블을 다시 만들 수 있도록 실행하는 동안에는 외래 키 검사를 끄고, 트랜잭션을 커밋하기 전에 모든 키를 검사해요.

핸들러는 `settings` 옆에서 열린 저장소를 `store`로 받아요.

## 입장 확인

요청은 입장 확인(`src/admission.js`)을 통과해야만 오퍼레이션의 핸들러에 닿아요. 그래서 거절한 요청은 저장소를 읽지 않고, 그 응답에는 프로젝트 데이터가 없어요. 무엇을 확인할지는 계약에 적힌 오퍼레이션의 `x-corthex` family가 정하고, `test/admission.test.js`가 서버의 목록을 계약과 비교해요.

- **소유자 오퍼레이션**은 게이트가 한 소유자에게 준 로그인만 들여요(SPEC-048, 규칙 1). Cloudflare Access는 이 로그인을 `Cf-Access-Jwt-Assertion` 헤더로 보내고, 쿠키나 다른 헤더는 읽지 않아요. `src/gate.js`가 Node 자체 모듈 `node:crypto`로 검증해요. 토큰의 `kid`로 발급자의 certs 엔드포인트가 알려 주는 키를 찾아 RS256 서명을 확인하고, 설정의 발급자와 audience, 만료 시각을 확인해요. 서버 시계보다 앞선 not-before 시각은 1분까지 봐줘요. 로그인이 없거나 만료됐거나 확인 하나라도 통과하지 못하면 `unauthenticated`(401), 소유자가 아닌 사람의 유효한 로그인이면 `not_owner`(403)예요.
- **소유자의 쓰기**(POST, PUT, PATCH, DELETE) 가운데 브라우저가 `Sec-Fetch-Site`로 NEXUS 자신(`same-origin`)이나 주소창(`none`)이 아닌 곳에서 왔다고 알리는 요청은 `cross_site`(403)예요. `Sec-Fetch-Site`가 없는 요청은 브라우저가 아니거나 이 헤더를 보내지 않는 오래된 브라우저에서 온 것이고, 들여요.
- **키**는 로그인을 처음 확인할 때 `<issuer>/cdn-cgi/access/certs`에서 읽어요. 5초 제한이 있고 리디렉션은 따르지 않으며, 한 시간 동안 써요. 서버가 모르는 `kid`가 오면 다시 묻지만, 10초에 한 번까지만 물어요. 2048비트 이상의 RSA 키만 써요. 현재 키를 읽을 수 없는 동안 소유자 요청은 `internal`(500)이에요. 이것이 서버의 유일한 바깥 호출이고, 서버 앞의 게이트에 하는 호출이에요. 테스트는 이것을 로컬 서명 키로 바꿔요.
- **에이전트 오퍼레이션**은 에이전트 자격 증명, 곧 `CF-Access-Client-Id`와 `-Secret` 쌍을 받고, TASK-417이 `src/admission.js`에서 확인해요. 그전까지는 모든 에이전트 요청이 `access_missing`(401)이고, 소유자 오퍼레이션에 온 에이전트 자격 증명은 소유자의 로그인이 없는 요청으로 다뤄요.
- **라우트**의 동작이 계약에 없는 것은 테스트만 만드는데, 확인 없이 들이려면 `family: 'none'`을 적어요. 계약에 없는 동작인데 그렇게 적지 않은 라우트는 서버를 만들 때 멈춰요. 그래서 family를 빠뜨려서 확인 없이 열리는 오퍼레이션은 없어요.

## 응답

- 오퍼레이션은 JSON으로 응답해요. 거절은 `application/problem+json`의 Problem이고, 계약의 `components.schemas.Problem` 형식대로 `title`, `status`, `detail`, `code`, `traceId`가 있어요.
- 오퍼레이션이 없는 경로는 `not_found`(404)로 응답해요. `/api/spaces` 아래에서는 detail이 NEXUS가 받는 에이전트 명령 push, todo, claim, comment, decide, reflect, status, record를 알려요(SPEC-014). detail은 요청의 경로를 되풀이하지 않아요.
- 다른 메서드만 받는 경로는 `Allow`와 함께 `method_not_allowed`(405)로 응답해요.
- 입장 확인이 거절한 요청은 위에 적은 대로 `unauthenticated`(401), `not_owner`(403), `cross_site`(403), `access_missing`(401) 중 하나로 응답해요.
- 핸들러가 실패하면 `internal`(500)로 응답하고, 그 `traceId`로 로그에서 요청을 찾아요.

## 로그

서버는 요청마다 응답이 끝나거나 연결이 끊길 때 표준 출력에 JSON 한 줄을 써요.

| 필드 | 값 |
| --- | --- |
| `time` | 요청이 들어온 시각, UTC예요. |
| `traceId` | 임의의 16진수 16자리예요. 소유자의 로그인을 들였고 게이트의 `CF-Ray`가 계약의 `traceId` 형식(16진수 16자리, 하이픈, 데이터 센터의 영문 3자)이면 그 값을 써요. 게이트를 거치지 않고 서버에 닿는 누구나 `CF-Ray`를 보낼 수 있지만, 소유자의 로그인에는 게이트만 서명해요. 다만 로그인은 bearer 토큰이라서, 그 토큰을 가진 사람이 게이트를 거치지 않고 loopback의 서버에 닿으면 자기 요청의 ray는 고를 수 있어요. Problem 응답에도 같은 ID가 들어가요. |
| `method` | 요청의 메서드예요. |
| `action` | 오퍼레이션의 `operationId`예요. 오퍼레이션이 없는 경로는 `null`이에요. |
| `sender` | 요청을 보낸 이예요. 소유자의 로그인을 들이면 `owner`, 아니면 `unknown`이고, 요청이 스스로 대는 이름은 적지 않아요(규칙 8). |
| `status` | 응답의 상태 코드예요. 응답을 시작하기 전에 연결이 끊기면 `null`이에요. |
| `code` | Problem의 코드, 없으면 `null`이에요. |
| `ms` | 응답에 걸린 시간, 밀리초예요. |
| `reason` | 유효한 로그인이 없어서 소유자를 들이지 않았을 때만 있어요. 통과하지 못한 확인으로 `no_sign_in`, `malformed`, `unknown_key`, `bad_signature`, `wrong_issuer`, `wrong_audience`, `expired`, `not_yet_valid` 중 하나이고, 키를 읽지 못했으면 `keys_unavailable`이에요. |
| `error` | 핸들러가 실패했거나 거절 응답을 보내지 못했을 때만 있어요. 오류 종류로, 내장 오류 타입과 Node의 코드가 있으면 그 코드예요. 예: `Error ENOENT`. |
| `aborted` | 응답이 끝나기 전에 연결이 끊겼을 때만 있어요. 값은 `true`예요. |

요청을 받기 시작할 때(호스트와 포트 포함), 멈출 때, 설정이 올바르지 않을 때도 한 줄을 쓰고, 크래시가 나면 Node의 보고 대신 한 줄을 써요. 요청을 받기 전에는 저장소에 관한 줄을 하나 써요. 저장소의 `version`과 적용한 마이그레이션 `applied`를 담은 `store_opened`, 이유 `reason`(`not_a_v3_store`, `newer_store`, `migrations_invalid`, `foreign_keys_broken` 중 하나)을 담은 `store_refused`, 오류 종류 `error`를 담은 `store_failed` 중 하나예요. 어느 줄도 데이터 폴더를 적지 않아요.

그래서 거절한 요청은 모두 시각, 동작, 보낸 이, 까닭(Problem의 `code`)과 함께 로그에 남아요(규칙 8).

[기능 명세](../docs/04-functional-spec/spec.ko.md)의 규칙 5에 따라 에이전트 자격 증명의 시크릿, 자격 증명 다이제스트, 로그인 토큰, 서버 경로, 거절한 파일의 텍스트는 어떤 로그 줄에도 들어가지 않아요. 그래서 어떤 필드도 요청(경로, 쿼리, 헤더, 본문)이나 오류의 메시지·스택에서 복사하지 않아요. `test/logs.test.js`, `test/main.test.js`, `test/admission.test.js`가 데이터 폴더, 소유자의 로그인, 이메일까지 포함해, 실행할 때 만든 값으로 이것을 검사해요. 게이트 설정도 어떤 줄에도 적지 않아요.

## 테스트

```sh
cd server
node --test
```

Node 자체 테스트 러너가 `test/*.test.js`를 실행해요. `.github/workflows/check.yml`은 모든 풀 리퀘스트에서 Node 24로 이 테스트를 돌리고, `all-checks`는 그 결과를 기다려요.
