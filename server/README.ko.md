# NEXUS v3 서버

[English](README.md)

NEXUS v3의 서버예요. [WBS](../docs/10-wbs/wbs.ko.md)의 태스크 순서대로 만들어요. Node 24와 Node 자체 모듈로 돌아가고, 설치할 의존성이 없어요. v2처럼 Cloudflare Access 게이트 뒤에서 돌아가요.

TASK-413의 서버 골격, 곧 [api/openapi.yaml](../api/openapi.yaml)의 오퍼레이션을 위한 라우터, 환경 변수에서 읽는 설정, 요청마다 한 줄의 로그가 있고, TASK-414의 저장소, 곧 [db/migrations](../db/migrations/)의 마이그레이션이 만드는 데이터베이스가 있어요. 아직 받는 오퍼레이션이 없어서, 오퍼레이션을 만드는 태스크가 추가하기 전까지는 모든 경로가 `not_found` Problem으로 응답해요.

## 실행

```sh
cd server
NEXUS_DATA_DIR=/absolute/path/to/a/data/folder node src/main.js
```

## 설정

| 변수 | 기본값 | 뜻 |
| --- | --- | --- |
| `NEXUS_HOST` | `127.0.0.1` | 서버가 요청을 받는 주소예요. IP 주소나 `localhost`예요. 게이트의 터널은 같은 머신에서 서버에 접속해요. |
| `NEXUS_PORT` | `8787` | 포트, 0부터 65535까지예요. 0이면 시스템이 빈 포트를 고르고, 시작 줄이 그 포트를 알려요. |
| `NEXUS_DATA_DIR` | 없음 | 저장소를 두는 폴더의 절대 경로예요. 새 설치는 이 폴더를 소유자만 읽을 수 있게 만들어요. 저장소 파일은 폴더 권한과 상관없이 늘 소유자만 읽을 수 있어요. |

빈 변수는 기본값을 써요. `NEXUS_DATA_DIR`은 기본값이 없어서 꼭 설정해야 해요. 값이 올바르지 않으면 서버는 종료 코드 1로 멈추고, 설정 이름과 어긴 규칙을 적은 줄 하나만 남겨요. 잘못 넣은 값이 시크릿일 수 있어서 값은 적지 않아요.

## 저장소

저장소는 데이터 폴더 안의 SQLite 파일 하나, `nexus-v3.sqlite`이고, Node 자체 모듈 `node:sqlite`로 열어요(`src/store.js`). 서버는 요청을 받기 전에 저장소를 열고, 저장소에 아직 없는 `db/migrations`의 마이그레이션을 트랜잭션 하나로 적용해요. 그래서 마이그레이션이 실패하면 아무것도 바뀌지 않고 서버가 멈춰요. 아직 멈추는 중인 서버처럼 다른 연결이 잠금을 잡고 있으면 5초까지 기다려요. 새 설치는 빈 저장소로 시작해요(SPEC-015). 커밋 전에 멈춘 새 설치는 SQLite의 저널로 롤백되고, 다음 시작 때 다시 실행돼요.

- **스키마는 `db/nexus.sql`과 같아요.** 0001부터 빠짐없이 번호가 붙은 마이그레이션이 빈 데이터베이스에서 스키마를 만들어요. `test/store.test.js`는 마이그레이션이 만든 스키마와 `db/nexus.sql` 사이에 차이가 없는지 검사해요. 저장소는 자기 테이블을 따로 두지 않아요. 표시는 SQLite 헤더에 있어요. NEXUS v3의 application ID(`NXS3`)와, user version으로 적은 마지막 마이그레이션 번호예요.
- **다시 실행해도 아무것도 바뀌지 않아요.** 모든 마이그레이션이 적용된 저장소에는 쓰지 않아요.
- **v2 저장소는 읽지 않아요.** v2는 저장소 이름을 `nexus.sqlite`와 `rebuild.sqlite`로 썼고, v3는 `nexus-v3.sqlite`만 열어요. 그래서 같은 폴더에 있는 v2 저장소는 읽지 않은 채로 남아요. 저장소 이름을 가졌지만 NEXUS v3 저장소가 아닌 파일, 예를 들어 복사한 v2 저장소는 SQLite가 열기 전에 100바이트 헤더만 보고 거절하고, 그대로 둬요. 이 서버가 아는 것보다 새로운 서버가 더 마이그레이션한 저장소도 마찬가지예요.
- **마이그레이션.** 어디서든 한 번 적용된 마이그레이션은 고치지 않고, 다음 마이그레이션을 추가해요. `db/migrations`에 `.sql`로 끝나거나 숫자 네 자리로 시작하지만 `0001_initial.sql`처럼 이름 붙지 않은 파일이 있으면, 건너뛰지 않고 서버를 멈춰요. 서버는 저장소의 `db/migrations`를 읽으므로 저장소 체크아웃에서 실행해요. 마이그레이션이 테이블을 다시 만들 수 있도록 실행하는 동안에는 외래 키 검사를 끄고, 트랜잭션을 커밋하기 전에 모든 키를 검사해요.

핸들러는 `settings` 옆에서 열린 저장소를 `store`로 받아요.

## 응답

- 오퍼레이션은 JSON으로 응답해요. 거절은 `application/problem+json`의 Problem이고, 계약의 `components.schemas.Problem` 형식대로 `title`, `status`, `detail`, `code`, `traceId`가 있어요.
- 오퍼레이션이 없는 경로는 `not_found`(404)로 응답해요. `/api/spaces` 아래에서는 detail이 NEXUS가 받는 에이전트 명령 push, todo, claim, comment, decide, reflect, status, record를 알려요(SPEC-014). detail은 요청의 경로를 되풀이하지 않아요.
- 다른 메서드만 받는 경로는 `Allow`와 함께 `method_not_allowed`(405)로 응답해요.
- 핸들러가 실패하면 `internal`(500)로 응답하고, 그 `traceId`로 로그에서 요청을 찾아요.

## 로그

서버는 요청마다 응답이 끝나거나 연결이 끊길 때 표준 출력에 JSON 한 줄을 써요.

| 필드 | 값 |
| --- | --- |
| `time` | 요청이 들어온 시각, UTC예요. |
| `traceId` | 게이트의 `CF-Ray`가 계약의 `traceId` 형식(16진수 16자리, 하이픈, 데이터 센터의 영문 3자)이면 그 값, 아니면 임의의 16진수 16자리예요. Problem 응답에도 같은 ID가 들어가요. |
| `method` | 요청의 메서드예요. |
| `action` | 오퍼레이션의 `operationId`예요. 오퍼레이션이 없는 경로는 `null`이에요. |
| `status` | 응답의 상태 코드예요. 응답을 시작하기 전에 연결이 끊기면 `null`이에요. |
| `code` | Problem의 코드, 없으면 `null`이에요. |
| `ms` | 응답에 걸린 시간, 밀리초예요. |
| `error` | 핸들러가 실패했거나 거절 응답을 보내지 못했을 때만 있어요. 오류 종류로, 내장 오류 타입과 Node의 코드가 있으면 그 코드예요. 예: `Error ENOENT`. |
| `aborted` | 응답이 끝나기 전에 연결이 끊겼을 때만 있어요. 값은 `true`예요. |

요청을 받기 시작할 때(호스트와 포트 포함), 멈출 때, 설정이 올바르지 않을 때도 한 줄을 쓰고, 크래시가 나면 Node의 보고 대신 한 줄을 써요. 요청을 받기 전에는 저장소에 관한 줄을 하나 써요. 저장소의 `version`과 적용한 마이그레이션 `applied`를 담은 `store_opened`, 이유 `reason`(`not_a_v3_store`, `newer_store`, `migrations_invalid`, `foreign_keys_broken` 중 하나)을 담은 `store_refused`, 오류 종류 `error`를 담은 `store_failed` 중 하나예요. 어느 줄도 데이터 폴더를 적지 않아요.

[기능 명세](../docs/04-functional-spec/spec.ko.md)의 규칙 5에 따라 에이전트 자격 증명의 시크릿, 자격 증명 다이제스트, 로그인 토큰, 서버 경로, 거절한 파일의 텍스트는 어떤 로그 줄에도 들어가지 않아요. 그래서 어떤 필드도 요청(경로, 쿼리, 헤더, 본문)이나 오류의 메시지·스택에서 복사하지 않아요. `test/logs.test.js`와 `test/main.test.js`가 데이터 폴더까지 포함해, 실행할 때 만든 값으로 이것을 검사해요.

## 테스트

```sh
cd server
node --test
```

Node 자체 테스트 러너가 `test/*.test.js`를 실행해요. `.github/workflows/check.yml`은 모든 풀 리퀘스트에서 Node 24로 이 테스트를 돌리고, `all-checks`는 그 결과를 기다려요.
