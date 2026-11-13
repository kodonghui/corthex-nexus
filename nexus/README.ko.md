# NEXUS 서버

[English](README.md)

NEXUS 서버는 CORTHEX 프로젝트 허브를 내 주소에 올려, 어느 기기에서든 열 수 있게 합니다. 승인된 단독 실행부는 Cloudflare Access·Tunnel 뒤에서 Node HTTP와 SQLite로 돌며 Worker/D1 호환 실행도 유지합니다. 둘 다 `hub.py push`가 보낸 스냅샷을 지니고, 주소에서 첫 화면을, `/hub`에서 허브 페이지를 제공합니다. 단독 실행부의 배포·복구 절차는 아래에 있습니다.

이 폴더는 플러그인이 아닙니다. 이 저장소를 내려받은 사본에서 배포합니다.

## 무엇을 두고 누가 보는가

- **스냅샷과 대화 공간을 둡니다.** 스냅샷에는 ID, 제목, 상태, 점검 결과, 상대 파일 위치, 커밋과 해석한 그림·단계 기록이 들어갑니다([형식](https://github.com/kodonghui/corthex/blob/010ccaa4e596676095b802e1283f1efac562377d/plugins/corthex-nexus/skills/corthex-hub/references/snapshot.md)). 같은 프로젝트를 다시 보내면 그 줄을 바꿉니다. 그림·의견·답글·제안·반영·어긋남·확인 지점은 대화 공간에 따로 둡니다. 작성자 종류만 보존하며 계정 신원이나 저장된 글을 로그에 남기지 않습니다.
- **Access가 먼저입니다.** Worker는 Cloudflare Access가 확인한 요청에만 답합니다. 다른 요청은 모두 `403`을 받고 데이터를 보지 못하므로, Access를 설정하기 전에 배포해도 아무것도 보이지 않습니다.
- **주소는 하나입니다.** 내가 정한 주소에서만 열립니다. `workers.dev` 주소나 미리보기 주소가 없고, 정적 자산도 쓰지 않습니다. 정적 자산을 쓰면 Worker가 Access 확인 결과를 받지 못합니다.
- **허브는 독립적이고 그림 코드는 같은 주소에서 옵니다.** 허브는 데이터와 해시로 허용한 스크립트를 안에 담습니다. 그림·현황 화면의 고정 코드·스타일·글꼴은 Access를 확인하는 `/code/` 연산으로만 받으며 CDN이나 정적 자산 우회는 없습니다. [브라우저 빌드](ui/README.ko.md)를 참고하세요. 다른 사이트는 페이지를 틀에 넣거나 저장된 내용을 바꾸지 못합니다.

## 필요한 것

- 도메인을 올려 둔 Cloudflare 계정과 Cloudflare Zero Trust 설정. Zero Trust Free 요금제로 충분하지만, 설정할 때 결제 정보를 넣어야 합니다.
- Node.js 24 LTS 이상과 이 저장소를 내려받은 사본.
- 스냅샷을 보내는 컴퓨터마다 설치한 `corthex-nexus`.

## 설정

1. 도구 설치: 이 폴더에서 `npm install`을 실행합니다.
2. 내 설정 파일 만들기: `wrangler.jsonc`를 `wrangler.local.jsonc`로 복사합니다. 이 사본은 git이 무시합니다. 사본의 `routes`에 내 계정에 있는 도메인의 주소, 예를 들어 `nexus.example.com`을 적고, 한국어 페이지를 원하면 `NEXUS_LANGUAGE`를 `ko`로 바꿉니다.
3. 배포: `npx wrangler login`을 실행한 뒤 `npm run deploy`를 실행합니다. 첫 배포 때 D1 데이터베이스 `corthex-nexus`가 만들어져 Worker에 연결됩니다. 터미널에서 실행하면 그 ID가 내 설정 파일에도 적히고, 적히지 않아도 다음 배포는 같은 데이터베이스를 씁니다. 이어서 Cloudflare가 주소의 DNS 레코드와 인증서를 더합니다. 예전 서비스 등이 남긴 DNS 레코드가 주소에 이미 있으면 Cloudflare가 그 위에 Worker의 레코드를 만들지 않습니다. 필요하면 그 값을 적어 두고, 대시보드의 내 도메인 **DNS** › **Records**에서 지운 뒤 다시 배포합니다. 다음 단계를 마칠 때까지 주소는 `403`으로 답합니다.
4. Access로 보호하기: Cloudflare 대시보드에서 **Workers & Pages**로 가서 `corthex-nexus`를 고르고, **Access** 탭에서 **Protect this Worker behind Access**를 누릅니다. **All traffic**을 고르고, 로그인할 수 있는 사람을 정한 뒤(나 혼자라면 **Cloudflare account**) **Apply Access**를 누릅니다. **Zero Trust** › **Access controls** › **Applications**에 이 주소의 Access 애플리케이션이 이미 있으면, 그것이 Worker 단위 Access보다 먼저 적용되어 이미 허브를 보호합니다. 그 정책이 원하는 사람만 들이는지 확인하고 이 단계는 건너뜁니다.
5. 확인 전에 애플리케이션을 고정합니다. 로컬 `vars`에서 빈 `ACCESS_AUD` 자리를 지운 뒤 `npx wrangler secret put ACCESS_AUD -c wrangler.local.jsonc`를 실행해 입력 프롬프트에 그 애플리케이션의 **Application Audience (AUD) Tag**를 넣습니다. 로컬 파일의 `vars`에는 `ACCESS_TEAM_DOMAIN`으로 팀 호스트(예: `your-team.cloudflareaccess.com`)를 적고 다시 배포합니다. 시크릿 창에서 열면 Access 로그인이 먼저 나오고, 빈 첫 화면이 나옵니다. 그 전체 검사는 `/hub`의 허브 페이지를 엽니다.
6. `hub.py`용 서비스 토큰 만들기: **Zero Trust** › **Access controls** › **Service credentials** › **Service Tokens**에서 토큰을 만들고 Client ID와 Client Secret을 복사합니다. Secret은 이때 한 번만 보입니다. 그다음 **Zero Trust** › **Access controls** › **Applications**에서 허브를 보호하는 Access 애플리케이션, 곧 4단계에서 만든 것이나 주소에 이미 있던 것을 열고, 동작이 **Service Auth**이고 이 토큰을 포함하는 정책을 더합니다. 같은 Worker에 애플리케이션을 하나 더 만들면 서로 부딪칠 수 있으니, 기존 애플리케이션에 더합니다.
7. 스냅샷을 보내는 컴퓨터마다 `~/.corthex/profile.json`에 주소와 보내도 되는 프로젝트를 적습니다.

   ```json
   { "nexus": { "url": "https://nexus.example.com", "push": ["acme-shop"] } }
   ```

   토큰은 시스템의 비밀값 저장소에서 환경 변수 `CORTHEX_NEXUS_CLIENT_ID`와 `CORTHEX_NEXUS_CLIENT_SECRET`으로 넣고, 저장소 안의 파일에는 절대 적지 않습니다. 그다음 `hub.py push --dry-run`을 실행하고, `hub.py push`를 실행합니다.

0.2에서는 `ACCESS_AUD`와 `ACCESS_TEAM_DOMAIN`이 필수입니다. audience 태그는 쉼표로 나눠 여러 개를 넣을 수 있습니다. Worker는 `ctx.access`를 확인한 뒤 설정한 팀의 공개 키로 헤더 토큰의 RS256 서명·발급자·audience·만료를 검증합니다. 설정이 빠지면 접근을 허용하지 않습니다. 쓴 쪽의 종류만 남기며 사람이나 서비스 신원은 보관하지 않습니다.

대시보드 메뉴 이름은 2026년 10월 Cloudflare 문서를 따랐습니다: [Workers용 Cloudflare Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/), [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/), [서비스 토큰](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/), [Zero Trust 설정](https://developers.cloudflare.com/cloudflare-one/setup/).

## 쓰기

- `hub.py push`는 `nexus.push`의 프로젝트를 보냅니다. 프로젝트 이름을 주면 그것만 보냅니다. 서버는 프로젝트마다 더 새 스냅샷을 둡니다. 저장된 것보다 먼저 만든 스냅샷은 거절하니, 다시 만들어 보내세요.
- `hub.py remove <프로젝트>`는 삭제 요청을 보내지 않습니다. 프로젝트를 삭제하면 지워지는 것과 NEXUS에서 그 프로젝트 데이터의 주소를 보여 주며, 삭제는 그 주소에서 내 로그인으로 합니다. `nexus.push`에서 프로젝트를 빼면 그 뒤로 보내지 않을 뿐, 서버에 둔 것은 남습니다.
- 로그인한 상태에서 `/api/snapshots`를 열면 서버에 둔 목록이 보입니다.

## 병합마다 저장소에서 보내기

프로젝트 저장소는 기본 브랜치에 커밋이 들어올 때마다 세션 없이 스냅샷을 직접 보낼 수 있습니다. 저장소 자체 CI의 작업이 `hub.py push --job`을 실행합니다. 에이전트의 push는 두 번째 방법으로 남습니다. 먼저 보낸 쪽이 커밋을 저장하고, 다른 쪽은 이미 저장된 것을 보고 아무것도 보내지 않습니다.

이 작업은 서버가 이미 가진 프로젝트만 보냅니다. 그래서 프로젝트의 첫 push는 여전히 내가 승인한 뒤 세션에서 `hub.py push <project> --first`로 합니다. 저장된 커밋을 바꾸지도 않습니다. 기본 브랜치의 이력을 다시 쓴 뒤라면 두 커밋을 밝히며 실패합니다. 에이전트 to-do를 읽지 않고, 아직 보내지 못한 쓰기도 보내지 않습니다.

GitHub의 프로젝트 저장소에 더하는 방법:

1. 아래 파일을 pull request로 저장소의 `.github/workflows/corthex-nexus-push.yml`에 더합니다. 기본 브랜치가 `main`이 아니면 `branches`에 그 이름을 적습니다.
2. 저장소의 **Settings** › **Secrets and variables** › **Actions**에서 저장소 시크릿 세 개를 더합니다. `CORTHEX_NEXUS_URL`에는 서버의 `https` 주소를, `CORTHEX_NEXUS_CLIENT_ID`와 `CORTHEX_NEXUS_CLIENT_SECRET`에는 6단계의 서비스 토큰을 넣습니다.
3. pull request를 병합합니다. 그 뒤로 기본 브랜치에 커밋이 들어올 때마다 작업이 실행됩니다.

```yaml
name: NEXUS push

on:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: corthex-nexus-push
  cancel-in-progress: false

jobs:
  push:
    if: github.ref_name == github.event.repository.default_branch
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Check out the default branch with its history
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          path: project
          fetch-depth: 0
          persist-credentials: false
      - name: Check out the hub at its pinned commit
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          repository: kodonghui/corthex
          ref: 7455a4852d3deb6cd2835168bf30131207d283a3
          path: hub
          persist-credentials: false
      - name: Push the snapshot
        working-directory: project
        env:
          DEFAULT_BRANCH: ${{ github.event.repository.default_branch }}
          CORTHEX_NEXUS_URL: ${{ secrets.CORTHEX_NEXUS_URL }}
          CORTHEX_NEXUS_CLIENT_ID: ${{ secrets.CORTHEX_NEXUS_CLIENT_ID }}
          CORTHEX_NEXUS_CLIENT_SECRET: ${{ secrets.CORTHEX_NEXUS_CLIENT_SECRET }}
        run: |
          git symbolic-ref refs/remotes/origin/HEAD "refs/remotes/origin/$DEFAULT_BRANCH"
          python3 ../hub/plugins/corthex-nexus/skills/corthex-hub/scripts/hub.py push --job --json
```

작업은 기본 브랜치에 push될 때만 실행되고 pull request에서는 실행되지 않으므로, 포크의 변경이 시크릿을 가지고 실행되는 일은 없습니다. 포크에는 시크릿이 없어서, 거기서는 작업이 아무것도 보내지 않고 빠진 시크릿의 이름을 밝힙니다. 작업은 저장소를 전체 이력과 함께 체크아웃하고, 그 옆에 이 저장소의 [`hub-ref.json`](../hub-ref.json)이 가리키는 커밋의 허브를 체크아웃하며, 저장소 자체의 코드는 실행하지 않습니다. 기본 브랜치의 워크플로를 바꿀 수 있는 사람은 누구나 시크릿을 쓸 수 있으니, 나만 push할 수 있는 저장소에만 더합니다. 서버를 업데이트할 때 이 파일도 다시 가져와 작업의 허브를 함께 옮깁니다.

작업의 로그는 `hub.py push --job --json`의 결과 한 줄이며, 시크릿의 값은 담지 않습니다.

| 결과 줄 | 작업 | 뜻 |
| --- | --- | --- |
| `"sent": true` | 통과 | 그 커밋의 스냅샷을 저장했습니다. 서버의 답은 `pushed`에 있습니다. |
| `"why": "already-held"` | 통과 | 서버가 이 커밋이나 더 새 커밋을 이미 가지고 있습니다. |
| `"why": "first-push-waits"` | 통과 | 서버에 이 프로젝트가 없습니다. 세션에서 `--first`로 먼저 보냅니다. |
| `"why": "not-set"` | 통과 | 시크릿이 빠졌으며, `missing`이 그 이름을 밝힙니다. |
| `refused`나 `failed` | 실패 | 서버가 거절했거나 답하지 않았거나, 저장된 커밋이 보낸 커밋의 이력에 없습니다. 결과 줄에 이유가 있습니다. |

## 한도

- 스냅샷 하나는 1MiB까지(`hub.py`는 1MB 아래로 만듭니다), 프로젝트는 30개까지입니다. 10분 넘게 미래 시각이 적힌 스냅샷은 거절합니다. 그 스냅샷을 만든 컴퓨터의 시계를 확인하세요.
- Workers Free 요금제에서는 요청 하나에 CPU 시간 10ms를 씁니다. 항목 92개인 실제 프로젝트 크기, 약 40KB의 스냅샷은 Node로 로컬에서 재 보니 검사에 1ms가 안 걸렸고, 1MB에 가까운 것은 약 15ms가 걸려 한도를 넘을 수 있습니다.
- D1 무료 요금제에는 하루에 읽고 쓰는 행 수 한도가 있지만, 개인 허브는 그보다 훨씬 적게 씁니다. 현재 한도는 Cloudflare의 [Workers 한도](https://developers.cloudflare.com/workers/platform/limits/)와 [D1 한도](https://developers.cloudflare.com/d1/platform/limits/)에서 확인하세요.

## 이 컴퓨터에서 먼저 해 보기

- `npm test`는 메모리 안의 데이터베이스로 서버 검사를 Node 자체 테스트 도구로 돌립니다.
- 로컬 HTTP 대역은 `node test/serve.js`로 실행합니다. 가상 토큰에 서명하고 메모리 SQLite를 쓰며, 출력한 `127.0.0.1` 주소로 허브를 연결할 수 있습니다. `npm run dev`는 서명된 Access 토큰을 만들지 않습니다. 0.2에서 `ctx.access`의 audience 대역만으로 인증되지 않습니다. Workers 실행 환경은 별도 Access·D1·서비스 토큰을 갖춘 개발 Worker에서 확인합니다.

## 갱신과 제거

- 갱신하려면 저장소를 받아 온 뒤 `wrangler.jsonc`를 내 사본과 비교하고, `npm install`과 `npm run deploy`를 실행합니다.
- 없애려면 `npx wrangler delete -c wrangler.local.jsonc`로 Worker를, `npx wrangler d1 delete corthex-nexus`로 데이터베이스와 스냅샷을 지웁니다. 그다음 **Zero Trust** › **Access controls**에서 Access 애플리케이션과 서비스 토큰을 지웁니다.
# 단독 실행부 (승인된 개발 대상)

Node 24 LTS의 내장 HTTP·SQLite·Web Crypto만 씁니다. Worker와 같은 처리 함수와
Store를 쓰며 제품 질의와 엔진 SQL은 `src/store.js`에 모읍니다. SQLite는 외래 키,
WAL, 전체 동기 쓰기, 5초 잠금 대기를 켭니다. D1 형태의 batch는 동기 트랜잭션
하나이고 문장이 실패하면 앞의 변경도 되돌립니다.

서버에 전용 `nexus-dev` 사용자와 `/var/lib/nexus-dev` 상태 폴더를 준비하고,
`ops/runtime.env.example`을 참고해 root 소유·0600인 `/etc/nexus/dev.env`를 만듭니다.
선택한 공개 HTTPS 주소와 기존 Access 앱의 발급자·AUD를 씁니다. 요청에서 발급자를
고르지 않습니다. Node는 서명된 헤더를 확인하고 Worker는 기존 Access 컨텍스트도
요구합니다. 개발용 인증 우회는 없고 서버는 루프백에서만 듣습니다.

Tunnel은 **원 서버에서** `cloudflared tunnel login`과 `cloudflared tunnel create
<개발용-이름>`으로 만듭니다. 브라우저에서 승인하고 인증서·자격 증명은 그 서버에
둡니다. `ops/cloudflared.example.yml`을 참고해 승인된 개발 호스트만 연결하고
별도 서비스로 돌립니다. Access 정책과 운영 호스트·Worker·D1은 유지합니다.

노트북의 검토한 깨끗한 커밋에서 배포합니다.

```powershell
./nexus/ops/deploy-dev.ps1 -SshAlias <설정된-서버-별칭> -Commit <전체-SHA>
```

스크립트는 커밋된 실행부·운영 파일만 묶고 키를 보내지 않습니다. 기존 개발 DB를
백업한 뒤 고정 릴리스를 선택하고 `nexus@dev`를 재시작합니다. 로컬 리스너가
미인증 요청에 403을 주는지 확인합니다. 시작에 실패하면 이전 실행부를 선택합니다.
`systemctl status nexus@dev`와 안전한 journal로 확인하고 `systemctl stop
nexus@dev`로 멈춥니다. 서비스의 Unix 사용자·상태 폴더·메모리 한도는 독립적입니다.

`nexus-backup@dev.timer`는 매일 03:15 UTC부터 최대 15분을 분산해 실행하며,
중단 중 놓친 실행도 처리합니다. 배포 전과 `database.js migrate`의 이주 전에도
백업합니다. SQLite 백업 API로 일관된 사본을 만들고 무결성·외래 키를 검사한 뒤
WAL 보조 파일 없이 봉인합니다. 파일은 0600이고 SHA-256 영수증을 남기며 30일
보관합니다. 예약은 `systemctl disable --now nexus-backup@dev.timer`로 멈추며
상태·백업은 남습니다.

복구 리허설에는 절대 경로를 씁니다.

```sh
node nexus/tools/database.js restore --backup /private/backups/<archive>.sqlite --destination /private/restore-check.sqlite
```

대상 파일은 없어야 합니다. 영수증을 확인하고 기존 스키마를 보존한 별도 파일로 복구·검사합니다. 업그레이드는 별도 `migrate` 명령으로 실행합니다.
독립 개발 리스너에서 행 수와 API를 확인한 뒤 복구 파일을 선택합니다. 실제로
되돌릴 때는 해당 서비스를 멈추고 현재 DB를 백업한 뒤 비공개 환경 파일에서 검증한
복구 DB를 선택하고 재시작합니다. 실행 중인 DB를 덮거나 WAL과 떼지 않습니다.
실행부만 되돌리는 것으로 DB 이주까지 취소되지는 않습니다.

출시 전 운영 D1은 **읽기 전용으로** 서버에 내보내 별도 리허설 DB에 넣습니다.
행 수를 기록하고 백업·이주·동작 확인·사본 복구를 검증합니다. 승인 후 운영을
전환하더라도 기존 Worker·D1은14일 보존하고 삭제 전에 묻습니다. main 병합·운영
주소/데이터 전환·출시 태그는2026-11-04의 조건부 사전 승인을 따릅니다. 실제
프로젝트 첫 스냅샷은 REQ-107에 따라 별도로 확인합니다.

CI는 Worker 검사와 단독 HTTP·SQLite 시험, 생성한 RSA 키와 임시 DB로 32개
API를 검사하는 Schemathesis를 돌립니다. 이 로컬 시험과 실제 인증 Tunnel·화면
수용 검증은 12단계에 따로 기록합니다.

처리 시간·RSS를 감독하며 잴 때는 비공개 서버 환경에 잠시 `NEXUS_METRICS=1`을
설정하고 재시작합니다. 숫자 영수증에는 상태, 읽은 본문 바이트, 처리 시간(ms),
프로세스 RSS만 있으며 경로·신원·헤더·저장된 글은 없습니다. 시험 뒤 설정을
지웁니다. `ops/cloudflared-nexus@.service`는 독립 Tunnel 서비스 예시이며 전용
사용자는 그 서버에서 발급한 Tunnel 자격 증명만 읽고 영역 관리자 인증서는
읽지 않습니다.


### 독립 실행부의 코드 전송

신뢰한 JS/CSS의 Brotli/gzip 변형은 시작할 때 한 번 만듭니다. 원 서버에서는 인증·역할·경로를 먼저 확인한 뒤 Accept-Encoding에 맞춰 제공하고, HEAD와 코드 캐시·CSP를 유지합니다. 같은 origin의 거점 HIT도 전체 호스트 Access를 먼저 통과해야 합니다. 글꼴과 거절 응답에는 이 압축 변형을 적용하지 않습니다. NEXUS_METRICS=1은 숫자만 남기며 processing_ms는 본문 도착과 I/O를 포함합니다. body_receive_ms·after_body_ms를 따로 읽고 cpu_user_ms/cpu_system_ms는 같은 구간의 프로세스 CPU 차이로 봅니다. 병렬 요청의 CPU 구간은 겹치며 RSS는 응답 뒤 표본이지 peak가 아닙니다.

서버의 비공개 설정 `NEXUS_EARLY_HINTS=1`은 0.2 그림 보기에 `Link: rel=preload` 힌트를 붙였습니다. TASK-278부터 그 주소는 힌트를 보내지 않는 단계의 페이지로 `302`를 답하므로 이 설정은 효과가 없고, 아직 이 설정을 둔 서버는 그것을 무시합니다.

공개 내용 해시 /code/만 거점에 보관할 수 있습니다(public,max-age31536000,immutable). HTML/API/자료는 no-store이고 전체 호스트 Access를 유지합니다. Edge HIT/Age와 캐시된 주소의 미인증 GET/HEAD 거절을 출시 전에 확인합니다. REQ-124 처리1초는 본문 수신 뒤부터 응답 처리 완료까지입니다. 이전 Worker/D1의 출시 뒤 보존 기간은14일이며 삭제는 별도 확인합니다.

### 운영 CLI 자격의 수명

2026-11-05의 자격 목록 관측: 새 운영 CLI 서비스 토큰을1년 기간으로 만들었고, 발급 화면은 만료일을2027-11-05로 표시했습니다. 값과 식별자 없이 관측한 날짜만 기록합니다. 갱신하면 만료일도 바뀌므로 정비 전에 현재 항목을 다시 확인합니다. 두 자격 값은 같은 기기의 비밀값 저장소나 Windows USER 환경변수 `CORTHEX_NEXUS_CLIENT_ID`·`CORTHEX_NEXUS_CLIENT_SECRET`에만 둡니다. 토큰과 기기의 대응 정보는 Git 밖의 비공개 목록에 둡니다.

별도 폐기 승인을 받은 뒤 비공개 목록으로 정확한 운영 CLI 토큰을 식별하고, 기존 운영 Service Auth 정책에서 그 토큰의 선택만 제거한 다음 **Zero Trust → Access controls → Service credentials → Service Tokens**에서 해당 토큰을 삭제합니다. 기존 운영 토큰·사람 로그인·개발 앱을 유지합니다. 이 기기의 USER 변수 두 값도 폐기한 토큰에 속하는지 확인한 뒤에만 제거합니다. 리다이렉트를 따르거나 자격·쿠키를 저장하지 않는 읽기 전용 서비스 요청으로 거절을 확인하고, 나머지 허용된 접근 경로도 확인합니다. 이번 런북 문서 갱신으로 폐기·갱신·계정 전체 정리를 실행하지 않습니다.

Cloudflare에서 앱 세션 취소와 서비스 토큰 삭제는 다릅니다. 세션만 취소해도 유효한 클라이언트 자격으로 새 세션을 받을 수 있습니다. [공식 서비스 토큰 수명·폐기 안내](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/)를 따릅니다.1년 기간과 폐기 절차는 자격 목록·운영 문서의 정보이며 자동 갱신·삭제 일정이 아닙니다.

### v5 코드 응답 실패 보존

원인은 **미확인**입니다. [보존한 v5 요약](../docs/12-qa/runs/transport-2026-11-05/v5-summary.json)은 코드 관측880건 중200완료879건과520응답1건을 기록합니다. 사이트맵 slot59(해당 그림20번째 열기, 코드 순번19)이며 원래 실행의 실패·분모·판정을 유지합니다.

2026-11-04 16:42:12~16:42:54 UTC 구간의 읽기 전용 원 서버 journal 점검에서 Node0건·Tunnel0건이 나왔습니다. 이 결과로 원 서버나 거점의 원인을 찾지 못했고, 대응하는 제공자 추적 자료도 얻지 못했습니다. 나중 v8 통과와 별도로 바로잡은 캐시·브라우저 수명 검사로 이520의 원인을 설명하지 않습니다. 실행을 비교할 때 이 실패를 남기며 성공한 일부에 섞지 않습니다.
