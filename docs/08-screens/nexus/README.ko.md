# NEXUS: 화면 상태

[English](README.md)

CORTHEX 자신의 프로젝트에서 NEXUS 0.2의 08단계입니다: [사이트맵](../../07-sitemap/nexus.ko.md)의 화면 아홉 개마다 정의 하나, 곧 그 화면이 보여 주는 자료와 저마다 어느 요청에서 오는지, 그 동작과 결과와 실패, 그리고 모든 상태와 그것으로 이어지는 응답; 그리고 이 파일에 있는 모든 화면에 걸리는 규칙, 메시지의 최종 문구, 정의에서 그린 [와이어프레임](wireframes.html)입니다. 상태: 2026-11-03에 관리자가 2026-11-02에 고른 대로 기억 플러그인을 만드는 동안, 사용자 흐름, 기능 명세, 서버의 자료, 인터페이스, 사이트맵의 추천을 따라 초안을 썼습니다. 관리자가 같은 날 03\~07단계와 함께 이 단계의 확인 지점을 통과시켰습니다. 2026-11-03에 관리자가 01단계 이벤트 스토밍을 NEXUS에서 하기로 고르면서 그림 보기에 DDD 보드의 스텝 고르기와 그 말을 더했고, 이것은 관리자가 같은 날 통과시켰습니다([확인할 것](#확인할-것)). 2026-11-06 관리자의 다시 디자인이 사이트맵에 두 번째 나무 SCR-110\~SCR-117을 더했습니다. 그 정의는 2026-11-07에 그 확인 지점 3을 위해 초안을 썼고, 그 말은 [redesign-words.ko.md](redesign-words.ko.md)에 두었으며, 모든 상태는 그 확인 지점 2가 고른 모습으로 09단계의 [redesign.html](../../09-mockup/nexus/redesign.html)에 그렸습니다([다시 디자인의 화면](#다시-디자인의-화면)). 그날의 검토에 답하는 2026-11-11의 설계 수정은 새 화면 하나인 프로젝트 자료 SCR-130의 정의를 더하고, SCR-110\~SCR-115의 정의마다 그 화면에 계획한 것을 적은 마지막 절을 더합니다. 규칙 여섯, [revision-words.ko.md](revision-words.ko.md)에 둔 그 말, 새 상태와 바뀐 상태의 회색 와이어프레임 [revision-wireframes.html](revision-wireframes.html)이 함께 옵니다([설계 수정의 화면](#설계-수정의-화면)). 그 확인 지점은 2026-11-12에 통과했고, 만들기가 시작됐습니다: 끝난 작업은 [10단계](../../10-wbs/nexus.ko.md#지금-어디에-있나)가 말합니다. 이 번역과 영어 원문이 다르면 영어 원문이 원본입니다.

입력: [docs/07-sitemap/nexus.yaml](../../07-sitemap/nexus.yaml)의 사이트맵(SCR-101\~SCR-109)과 그 [08단계를 위한 메모](../../07-sitemap/nexus.ko.md#08단계-화면-상태); [docs/04-functional-spec/nexus.ko.md](../../04-functional-spec/nexus.ko.md)의 기능 명세, 특히 SPEC-119, SPEC-122\~SPEC-127, SPEC-131\~SPEC-134, SPEC-138, SPEC-139, SPEC-141, SPEC-142와 그 [07·08단계를 위한 메모](../../04-functional-spec/nexus.ko.md#0708단계-화면); [docs/06-api/nexus.ko.md](../../06-api/nexus.ko.md)의 인터페이스와 계약 [nexus.openapi.yaml](../../06-api/nexus.openapi.yaml), 상태는 그 응답과 [오류 코드](../../06-api/nexus.ko.md#오류-코드)를 따르며, 그 [07·08단계를 위한 메모](../../06-api/nexus.ko.md#0708단계-화면)와 함께; [docs/05-erd/nexus.ko.md](../../05-erd/nexus.ko.md)의 서버의 자료, 거기서 오는 표시를 위해; [docs/03-user-flow/nexus/](../../03-user-flow/nexus/README.ko.md)에 있는, 브라우저에서 도는 사용자 흐름 FL-105\~FL-107, FL-109, FL-110, FL-113, FL-115, FL-116; 그리고 지금 도는 1차의 허브 페이지 [hub.html](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex-nexus/skills/corthex-hub/assets/hub.html), 허브 페이지와 그 보기는 그 상태를 그대로 둡니다. 기억 플러그인에는 화면이 없으므로 이 단계에는 그 파일이 없습니다. 다시 디자인을 위해서는: 사이트맵의 두 번째 나무 SCR-110\~SCR-117과 그 [08단계를 위한 메모](../../07-sitemap/nexus.ko.md#08단계-화면-상태); 행 SPEC-143\~SPEC-156; 흐름 FL-117\~FL-119; 06단계의 [다시 디자인의 인터페이스](../../06-api/nexus.ko.md#다시-디자인의-인터페이스) API-151\~API-159와 0.2의 것에 낸 변경; 용어집의 TERM-135\~TERM-138; 그리고 [다시 디자인의 생김새](../../09-mockup/nexus/README.ko.md#다시-디자인의-생김새)에 있는 그 확인 지점 2의 모습. 2026-11-11의 설계 수정을 위해서는: [검토 지도](../../reviews/2026-11-11-design-review.ko.md)의 발견 1, 3, 11, 12, 15, 18, 25, 29\~32; SCR-130이 든 사이트맵의 한 나무와 그 [08단계를 위한 메모](../../07-sitemap/nexus.ko.md#08단계-화면-상태); 행 SPEC-187\~SPEC-189, SPEC-194\~SPEC-198, SPEC-201\~SPEC-203, SPEC-209, SPEC-210과 설계 수정이 SPEC-139, SPEC-143\~SPEC-147, SPEC-150, SPEC-155에 더한 것; 흐름 FL-113, FL-114, FL-117\~FL-119, FL-127; 그리고 06단계의 [설계 수정의 인터페이스](../../06-api/nexus.ko.md#설계-수정의-인터페이스), 곧 API-177과 API-178, 그리고 계약이 `components.pathItems` 아래에 둔 API-108, API-128, API-151, API-152, API-158, API-159의 계획한 꼴.

이 단계의 기본 사람 화면은 정의에서 그린 회색 와이어프레임입니다. 여기서는 그것이 한 페이지 [wireframes.html](wireframes.html)이며 상태마다 320과 1440픽셀의 틀이 있고, 저장소가 공개이므로 사람은 그것을 링크가 프로젝트의 기록에 있는 비공개 게시 페이지로 봅니다. 정의는 프로젝트의 Notion 기록에 있는 한국어 사본으로 읽으며, 표는 거기서 데이터베이스입니다. `.corthex/project.json`이 이 선택을 적어 둡니다. 다시 디자인의 상태는 그 확인 지점 2의 모습으로 09단계의 [redesign.html](../../09-mockup/nexus/redesign.html)에 한 번 그리고, 같은 방식으로 봅니다([고른 것 13](#이-단계가-고른-것)). 설계 수정의 새 상태와 바뀐 상태는 먼저 회색으로, 두 번째 페이지 [revision-wireframes.html](revision-wireframes.html)에 390과 1,440픽셀로 그리고, 같은 방식으로 봅니다. 그 뒤 09단계가 다시 디자인의 모습으로 그립니다([고른 것 21](#이-단계가-고른-것)). TASK-285부터 그 생성기가 저장소에 있습니다: `python -W error tools/grey_pages/revision_wireframes.py`가 정의서와 말 표로 다시 그리고, 브라우저에서 재는 법은 [tools/grey_pages](../../../tools/grey_pages/README.ko.md)가 적습니다.

## 화면

- [SCR-101 허브 페이지](SCR-101-hub-page.ko.md), 예전의 `/`, 2026-11-11의 설계 수정부터 `removed`이며 SCR-117이 가리키는 허브 페이지 상태의 글로 남습니다: normal, empty, stale, error, permission.
- [SCR-102 검색 결과](SCR-102-search-results.ko.md), `/hub#q={words}`: normal, empty.
- [SCR-103 추적 화면](SCR-103-trace-view.ko.md), `/hub#p={project}&id={id}`: normal, error.
- [SCR-104 단계 자세히 보기](SCR-104-stage-detail.ko.md), `/hub#p={project}&s={stage}`: normal, empty, stale, error.
- [SCR-105 그림 보기](SCR-105-picture-view.ko.md), `/pictures/{project}/{part}/{stage}`, 주소가 SCR-112로 이어지는 TASK-278부터 `removed`이며 0.2 그림 보기의 기록으로 남습니다: loading, normal, large, empty, stale, error, code-failed, permission.
- [SCR-106 항목](SCR-106-item.ko.md), `#item={id}`, 주소가 SCR-115로 이어지는 TASK-278부터 `removed`이며 0.2 항목 패널의 기록으로 남습니다: normal, empty, loading, error, permission, gone.
- [SCR-107 의견](SCR-107-comment.ko.md), `#comment={comment}`, 주소가 SCR-114로 이어지는 TASK-278부터 `removed`이며 0.2 의견 패널의 기록으로 남습니다: loading, normal, stale, error, permission, gone.
- [SCR-108 제안](SCR-108-proposal.ko.md), `#proposal={proposal}`, 주소가 SCR-114로 이어지는 TASK-278부터 `removed`이며 0.2 제안 패널의 기록으로 남습니다: loading, normal, stale, error, permission, gone.
- [SCR-109 단계 현황](SCR-109-stage-overview.ko.md), `/overview/{project}/{part}/{stage}`, 주소가 SCR-112나 SCR-113의 목록으로 이어지는 TASK-278부터 `removed`이며 0.2 단계 현황의 기록으로 남습니다: loading, normal, empty, stale, error, permission.

다시 디자인의 화면이며, 만들기 전까지는 계획입니다. 2026-11-11의 설계 수정부터 07단계가 허브 페이지와 함께 한 나무에 둡니다([다시 디자인한 화면](../../07-sitemap/nexus.ko.md#다시-디자인한-화면)):

- [SCR-110 첫 화면](SCR-110-home.ko.md), `/`: loading, normal, nothing-waits, empty, stale, error, permission, 그리고 설계 수정부터 removed.
- [SCR-111 프로젝트 작업 공간](SCR-111-project-workspace.ko.md), `/p/{project}`: loading, normal, unrecorded, stale, error, permission, 그리고 설계 수정부터 folded.
- [SCR-112 그림 단계](SCR-112-picture-stage.ko.md), `/p/{project}/{part}/{picture stage}`: loading, normal, large, empty, stale, error, code-failed, permission.
- [SCR-113 문서 단계](SCR-113-document-stage.ko.md), `/p/{project}/{part}/{document stage}`: loading, normal, empty, not-read, no-match, stale, error, permission.
- [SCR-114 대화](SCR-114-talk.ko.md), `#talk={comment}`: loading, normal, narrowed, empty, stale, error, permission, gone.
- [SCR-115 항목](SCR-115-item.ko.md), `#item={id}`: loading, normal, gone, error, permission.
- [SCR-116 찾기](SCR-116-search.ko.md), `{any page}#q={words}`: loading, normal, short, empty, error, permission.
- [SCR-117 전체 점검](SCR-117-full-checks.ko.md), `/hub`, 기기에서는 허브의 파일: normal, empty, stale, error, permission.

설계 수정의 화면이며, 계획입니다([설계 수정의 화면](#설계-수정의-화면)):

- [SCR-130 프로젝트 자료](SCR-130-project-data.ko.md), `/p/{project}#data`: loading, normal, empty, removal, removal-ready, stale, error, permission, gone.

## 정의서를 읽는 법

- **목적**: 그 화면을 지나는 흐름에서 온 한 문장과 그 FL ID. 그다음 화면의 경로, 볼 수 있는 사람, 그리고 1차에서 만들었는지 NEXUS 0.2에서 새로 생기는지.
- **자료**: 화면이 보여 주는 것과 저마다 어디서 오는지: API ID로 적은 계약의 요청, 페이지 자신의 자료, 페이지의 주소, 또는 브라우저 저장소.
- **동작**: 저마다 그 결과와 실패이며, 실패는 그것이 이어지는 상태를 적습니다.
- **상태**: 상태마다 `SCR-105#empty`처럼 적은 그 ID, 사용자가 보는 것과 할 수 있는 것, 그리고 `API-111#404`처럼 적은 그것으로 이어지는 응답과, 괄호 안에 그것을 정하는 오류 코드. 계약이 화면의 요청에 늘어놓는 모든 응답이 어느 상태로 이어지고, 계약이 그 응답에 주는 모든 코드가 적혀 있습니다. 표 아래에는 해당하지 않는 단계의 상태와 그 까닭.
- **경우의 수**: 04, 06, 12단계가 쓰는 종류 12가지, 저마다 화면이 보여 주는 것, 또는 그것이 왜 화면에 닿지 않는지.
- **배치**: NEXUS가 받치는 가장 좁은 폭과 가장 넓은 폭인 320과 1440픽셀(REQ-101, REQ-146)에서의 화면의 영역이며, 와이어프레임이 그것을 그립니다. 다시 디자인의 정의는 그것을 1,024픽셀보다 좁을 때와 1,024픽셀부터로 적습니다. 좁을 때는 그 확인 지점의 폭인 390에서 그리고 320까지 확인하며, 넓을 때는 1,440에서 그립니다. 작업 공간에는 대화가 접히는 1,024\~1,279의 세 번째 폭이 있습니다([규칙 16](#다시-디자인의-화면)).
- **2026-11-11의 설계 수정**: SCR-110\~SCR-115의 정의의 마지막 절이며, 설계 수정이 더하거나 바꾸는 것을 같은 표로, 행마다 진행 `planned`와 함께 적습니다. 작업이 행을 만들기 전까지는 그 앞의 절들이 지금의 화면을 적고, 작업은 같은 변경에서 그 행을 앞의 절로 옮깁니다. SCR-130은 새 화면이므로 그 정의에는 설계 수정의 행만 있고, 모두 계획입니다.
- **서버**: 정의는 Worker를 두고 썼습니다. 2026-11-04의 결정부터 관리자의 서버는 독립 서버로 돌므로, 정의가 Worker의 `403`이라고 적은 곳은 서버의 것으로 읽습니다(검토의 발견 29, 06단계의 [이 파일을 읽는 법](../../06-api/nexus.ko.md#이-파일을-읽는-법)).

## 모든 화면

1. **글로만.** 프로젝트의 글, 의견, 답글, 까닭, 단계 원본의 글은 글로만 보입니다: 그 안의 어떤 것도 마크업으로 읽히거나 돌지 않습니다(REQ-098, REQ-148). 긴 글은 줄을 바꾸고, 긴 낱말이나 ID는 페이지를 넓히지 않고 끊겨서, 320에서 1440픽셀까지 어느 폭에서도 페이지가 옆으로 밀리지 않습니다(REQ-101, REQ-146). 틀보다 큰 그림은 틀 안에서 움직이고, 제안의 단계 원본 글은 자기 상자 안에서 스크롤됩니다.
2. **언어와 테마.** 모든 화면은 그 페이지 자료의 언어 `lang`으로 말합니다. 그것은 서버의 `NEXUS_LANGUAGE`에서, 기기에서는 프로필에서 오며 영어나 한국어입니다. 화면은 시스템의 밝은 모드나 어두운 모드를 따릅니다(REQ-099, REQ-100, REQ-150). 시각은 1차처럼 브라우저의 시간대로 보입니다.
3. **메시지.** 거절이나 오류는 [메시지](#메시지)에서 그 코드의 메시지를 페이지의 언어로 보이고, 답의 `detail`은 절대 보이지 않으며, 그 아래 작은 글자로 서버의 로그에도 있는 "추적 ID {traceId}"를 보입니다([고른 것 4](#이-단계가-고른-것)).
4. **쓰기.** 쓰기의 단추는 그 요청이 도는 동안 막히고 "보내는 중…"이라고 적힙니다. 보기는 쓰기마다 쓰기 ID 하나, 곧 `nw_` ID를 만들어 그 쓰기를 시도할 때마다 실어, 답을 잃은 뒤의 시도가 결과 하나를 남기게 합니다(SPEC-126). `write_id_reused` 뒤에는 다음 시도가 새 ID를 씁니다. 그 요청은 서버에만, JSON으로, `redirect: "manual"`과 함께 갑니다.
5. **보내지 않은 글.** 4,000자까지의 의견이나 답글의 글과 2,000자까지의 확인 지점의 말은, 서버가 받을 때까지 그 칸과, 그 그림과 항목, 그 의견, 또는 그 부분과 단계의 브라우저 저장소에 쓰기 ID와 함께 남고, 다시 불러온 뒤 돌아옵니다(SPEC-126). 한도의 90퍼센트부터 칸은 남은 글자 수를 보이며, 한도를 넘는 글은 보내지 않습니다. 빈 글이나 공백뿐인 의견과 답글은 보내지 않습니다. 확인 지점의 말은 비워 둘 수 있습니다: 비었거나 공백뿐인 말은 요청에서 빠지고, 확인 지점은 말 없이 통과합니다(SPEC-139). 일부 비공개 창처럼 브라우저가 저장소를 두지 않는 곳에서는 글이 페이지에만 남습니다.
6. **다시 읽기.** 쓰기 뒤 보기는 그 자료, 곧 그림(API-111)이나 현황(API-112)을, 열린 패널은 그 의견(API-114)이나 제안(API-115)을 다시 읽습니다. 그동안 "새로 읽는 중…"이 보이고 화면은 그대로 쓸 수 있습니다. 그린 그림보다 새 그림은 사용자 밑에서 다시 그리지 않고 권합니다(SCR-105#stale). 다시 읽기가 실패하면 화면은 보이던 것을 그대로 두고 "새로 읽지 못했습니다. 보이는 내용이 최신이 아닐 수 있습니다."와 다시 시도를 보입니다.
7. **로그인.** 서버에서는 모든 페이지와 요청이 Cloudflare Access 뒤에 있고, 그 로그인 페이지와 거절은 Access 자신의 것으로 사이트맵 밖에 있습니다. 보기가 열린 동안 로그인이 끝나면 요청은 Access의 리다이렉트를 받고, 보기는 그것을 `opaqueredirect` 응답으로 보거나 `401`을 받습니다. 그러면 보기는 로그인이 끝났다고 알리고, 사용자가 쓴 것을 그대로 두며, 다시 로그인을 둡니다. 다시 로그인은 Access의 로그인을 거쳐 페이지를 다시 불러오고, 그 패널과 함께 같은 주소로 돌아옵니다.
8. **연결.** 네트워크 없음, 30초 안에 답 없음, 또는 Cloudflare의 `429`나 `503`: [메시지](#메시지)의 그 메시지와 다시 시도가 있는 오류이며, 화면의 나머지는 그대로 돌고 사용자가 쓴 것은 남습니다.
9. **페이지의 거절.** 세 페이지, 곧 허브 페이지(API-101), 그림 보기(API-102), 단계 현황(API-103)은 거절하거나 실패한 브라우저의 요청에 서버의 언어로 된 메시지 하나의 작은 HTML 페이지로 답하며, 거기에는 추적 ID, 다시 불러오기, 허브 페이지 링크가 있습니다([변경 1](#앞-단계의-변경)). 생성된 코드 메시지를 빠짐없이 쓰고 기존 고정 보기 스타일의 시스템 밝은/어두운 테마, 읽기 쉬운 한국어 단어 줄바꿈과 목표 크기의 링크를 적용합니다. 이 페이지는 스크립트나 스타일시트를 요청하지 않습니다. 보기 자신의 자료는 `problem`에 Problem Details를 담습니다.
10. **패널과 주소.** 항목, 의견, 제안의 패널은 `#` 뒤의 주소 `item=`, `comment=`, `proposal=`에서 곧바로, 휴대폰에서도 열립니다. 어느 항목도 담지 않는 부분은 자기 주소 없이 항목 패널을 엽니다([고른 것 12](#이-단계가-고른-것)). 포커스는 패널의 제목으로 옮겨 가고, Escape, 닫기, 브라우저의 뒤로 단추는 패널을 닫고 그림의 주소를 남깁니다. 허브 페이지는 1차의 주소, 곧 `q`, 그리고 `id`나 `s`가 붙은 `p`를 그대로 둡니다.
11. **누구에게나 같음.** 화면은 그것을 보는 모든 사람, 곧 사용자와 Access가 들여보낸 다른 누구에게나 같은 것을 보입니다. 누가 무엇을 할 수 있는지는 요청의 로그인을 따릅니다: 제안을 받거나 버리기, 반영 버리기, 확인 지점을 통과시키거나 철회하기에는 사람 본인의 로그인이 필요하고(API-124, API-125, API-127\~API-129), 거절은 그 메시지를 보입니다. 어느 화면도 이메일 주소, 이름, 그 밖의 신원의 어떤 부분도 보이지 않습니다: 항목은 쓴 쪽의 종류 "사용자"나 "에이전트"를 보입니다(REQ-163, [고른 것 9](#이-단계가-고른-것)).
12. **목록과 한도.** 읽기가 잘라 내는 목록은 "73개 중 50개"처럼 전체 가운데 몇 개를 담았는지 보입니다. 단계 현황은 저마다 50개를 늘어놓고, 500개를 늘어놓는 그림 보기로 잇습니다. 999를 넘는 수는 `999+`로 보입니다(SPEC-123).

보내는 중 읽기 전용인 글상자도 기존 글을 포커스·선택·복사할 수 있으므로 원래 고정 글자/바탕색으로 읽을 수 있게 둡니다. 비활성 불투명도는 disabled 조작에만 씁니다.

## 다시 디자인의 화면

열두 규칙은 SCR-110\~SCR-116에도 걸리고, 다시 디자인의 행과 그 두 확인 지점에서 온 이 여섯이 더해집니다. SCR-117은 허브 페이지이므로 자기 것을 지킵니다.

13. **모양과 말.** 단계의 상태는 모양과 말, 곧 ✓ 완료, ◐ 진행 중, ○ 시작 전, – 건너뜀, ? 기록 없음이며, 글꼴에 없는 모양이 있어 아이콘으로 그립니다(BUG-596). 누구 차례인지는 말로 적고, 수나 표시에는 무엇을 세는지 말하는 이름이 있습니다(REQ-236). 어떤 상태도 색만으로 알리지 않습니다.
14. **누르는 자리.** 조작은 높이 34픽셀로, 확대처럼 빽빽한 줄에서는 28로 그리고, 손가락이 고를 수 있는 곳에서는 그린 것 둘레에 44픽셀(`size.target`)의 누르는 자리를 두되 옆의 것을 움직이지 않습니다. 1,024픽셀보다 좁을 때 답하는 단추와 탭은 높이 44픽셀로 그립니다.
15. **코드보다 먼저 읽기.** 서버는 페이지마다 읽는 부분을 페이지의 자료로 그립니다: 첫 화면의 목록과 카드, 단계의 머리와 목록, 대화, 그림의 첫 SVG는 보기의 코드가 돌기 전에 글과 링크이며, 코드가 지키는 배치 그대로라 코드가 돌 때 아무것도 움직이지 않습니다. 쓰는 조작은 코드가 돌 때까지 막혀 보입니다. 코드를 불러오지 못하면 페이지는 읽을 수 있는 채로 남고, 막대에 "페이지의 단추를 불러오지 못했습니다. 여기서 답하려면 페이지를 다시 불러와 주세요."가 보입니다([고른 것 15](#이-단계가-고른-것)).
16. **폭.** 1,024픽셀보다 좁으면 첫 화면은 한 열이고, 작업 공간은 단계, 그 대화, 고른 항목을 탭으로 보입니다(SPEC-155). 1,024\~1,279픽셀에서 작업 공간은 단계 목록과 단계를 두고, 대화는 단계 머리의 "대화 ({n})"로 접혀 단계의 오른쪽 가장자리 위로 열립니다. 1,280픽셀부터는 세 열입니다. 320픽셀부터 어떤 것도 페이지를 옆으로 밀지 않습니다(REQ-101, REQ-146)([고른 것 14](#이-단계가-고른-것)).
17. **위 막대 하나.** 다시 디자인의 모든 페이지에 같은 위 막대가 있습니다: 첫 화면으로 가는 NEXUS, 사용자가 있는 자리, 찾기(SCR-116), 전체 점검(SCR-117). 계정 메뉴는 없습니다([고른 것 16](#이-단계가-고른-것)).
18. **AI 차례.** 사용자가 AI에게 쓰거나 답하는 곳마다 페이지는 AI가 그 프로젝트의 다음 작업 때 그것을 읽는다고 말하고, 첫 화면은 서버가 AI를 돌리지 않는다고 말합니다(REQ-121, 01단계의 핫스팟 6).

다시 디자인의 요청은 06단계의 [인터페이스](../../06-api/nexus.ko.md#다시-디자인의-인터페이스)에 계획되어 있으므로, 그 정의는 응답을 06단계가 적는 대로 이름 짓고, 0.2의 오류 코드와 새 코드 둘, 곧 [redesign-words.ko.md](redesign-words.ko.md)에 그 말이 있는 `item_not_found`와 `not_recommended`를 씁니다. 계약은 다시 디자인을 만들 때 그것을 받고, 상태는 그때 계약에 맞춰 확인합니다([다음 단계를 위한 메모](#다음-단계를-위한-메모)).

## 설계 수정의 화면

2026-11-11의 설계 수정은 그날의 검토에 답합니다([검토 지도](../../reviews/2026-11-11-design-review.ko.md)). 화면 하나, 곧 프로젝트 자료 SCR-130을 더하고, SCR-110\~SCR-115에 바꿀 것을 저마다 그 정의의 마지막 절에 계획합니다. SCR-116과 SCR-117은 상태를 그대로 둡니다. 그 확인 지점은 2026-11-12에 통과했고 만든 것은 없습니다. 위의 열여덟 규칙은 이 화면들에도 걸리고, 이 여섯이 더해집니다. `open (D17)`이던 행은 `planned`입니다: 관리자가 2026-11-12에 D17을 추천대로 정했습니다.

19. **고리의 두 때.** 페이지가 프로젝트를 마지막으로 올린 때나 AI가 그 AI 할 일을 마지막으로 읽은 때를 보이는 곳마다, 브라우저의 시간대로 쓴 날짜와 시각을 보이고 괄호 안에 얼마나 지났는지를 보입니다: 1분이 안 되면 "방금", 그다음 1시간이 안 되면 분, 24시간이 안 되면 시간, 그 뒤로는 일이며 저마다 내림합니다. 서버는 페이지를 내줄 때 그것을 그립니다. 때는 모든 때를 그리는 대로, 얼마나 지났는지는 그 순간의 것으로, 코드가 지키는 자리에 그려(규칙 15) 아무것도 움직이지 않습니다. 그 뒤 코드가 때를 브라우저의 시간대로 보이고 얼마나 지났는지를 다시 알아내며, 페이지가 다시 보일 때마다도 그렇게 합니다. 마지막 올림은 서버가 스냅샷을 저장한 때이고 서버의 시계를 따르며, 스냅샷이 적은 커밋의 첫 7자나 "커밋 없음"이 함께 있습니다. AI가 처음 읽기 전에는 페이지가 "AI가 아직 읽지 않음", 공간이 없는 프로젝트에는 "아직 AI 할 일 없음"이라고 말합니다: 어느 자리도 비워 두지 않습니다(SPEC-188).
20. **오래 기다린다는 표시.** AI를 기다리는 줄이 읽히지 않은 채 24시간 넘게 기다리는 동안, 프로젝트의 마지막 읽음에 표시가 붙습니다. 첫 화면에서는 그 카드와 AI 할 일의 그 줄에, 그리고 작업 공간의 머리와 프로젝트 자료에 붙습니다: 모양과 "24시간 넘게 읽지 않음"이라는 말, 그리고 그 뜻을 적은 한 줄 "이 프로젝트에서 일하는 세션이 없거나, 세션이 이 서버에 닿지 못하고 있습니다." 페이지는 표시를 보일 때마다 `unread_since`, 곧 안 읽힌 줄이 기다린 가장 오래된 때에서 그것을 알아냅니다: 서버는 표시를 저장하지 않고, AI가 읽으면 표시는 없어집니다. 올림에는 아무 표시도 하지 않습니다. 서버는 저장소를 읽지 않아 더 새 커밋이 있는지 알 수 없기 때문입니다(SPEC-188, SPEC-189, REQ-236).
21. **통과는 사용자가 본 것을 적습니다.** 통과는 페이지가 보여 준 것을 보냅니다: 프로젝트 스냅샷의 커밋, 스냅샷이 커밋을 적지 않았으면 그 판 번호. 그리고 단계에 열린 확인 요청이 있으면 그 요청의 의견과 마지막 글의 자리. 통과가 요청에 답하는 곳에서 그 단추는 무엇을 하는지 말해 "{n}단계 확인 지점 통과"이고, 어느 통과도 "추천대로"라고 하지 않습니다. 커밋이나 요청이 바뀌어 서버가 거절한 통과는 아무것도 기록하지 않고, 사용자의 말을 그대로 두며, 사용자가 다시 통과시키기 전에 단계나 요청을 지금 모습으로 보입니다(SPEC-194, SPEC-196). 확인 지점을 통과시키는 곳은 둘입니다: 첫 화면의 내 차례 줄, 그 둘째 동작으로 요청을 통째로 보이는 동안만, 그리고 단계 기록. 대화에서 요청의 줄은 기록을 엽니다([고른 것 24](#이-단계가-고른-것)).
22. **AI가 사용자에게 먼저 보라고 한 것.** 확인 요청의 먼저 볼 것은 링크입니다: 항목이면 그 ID와, 페이지가 지녔으면 그 제목이 보이고, 첫 화면에서는 그것을 지닌 단계에서, 단계 자신의 페이지에서는 항목의 패널에서 열립니다. 주소면 그 호스트와 함께 글로 보이고, 사용자가 누를 때만 리퍼러 없이 새 탭에서 열립니다. 페이지 자신은 그 주소를 결코 불러오지 않고, 미리 보기를 보이지 않으며, 거기로 아무것도 보내지 않습니다(REQ-147). 지금 어느 단계도 지니지 않는 항목은 그 ID와 함께 글로 보입니다(SPEC-196, SPEC-198).
23. **쓸 수 없는 것은 보이지 않음.** 화면은 그 릴리스가 쓸 수 없는 조작을 보이지 않습니다: 편집이 든 릴리스 전에는 "편집"도, "2단계" 표시도, 작업 보드의 탭도 없습니다(SPEC-147, 검토의 발견 32). 그런 조작이 그 릴리스와 함께 올 자리는 설계가 정해 둡니다(07단계, [선택 18](../../07-sitemap/nexus.ko.md#이-단계가-고른-것)). 그때까지 그 자리에는 아무것도 없고, 그것을 위해 빈 자리를 남기지도 않습니다. 요청이 도는 동안의 쓰기 단추나 코드가 오기 전의 조작처럼 잠깐 기다릴 뿐인 조작은 여전히 막힌 채 보입니다(규칙 4와 15).
24. **단계와 그 대화는 서로를 고릅니다.** 그림이나 목록에서 항목을 고르면 지금처럼 대화가 그 항목으로 좁혀지고, 항목에 달린 대화의 줄을 열면 단계에서 그 항목이 골라집니다(SPEC-209). 그림은 항목이 보이도록 옮겨 가되 항목이 다 들어오지 않을 때만 확대 비율을 바꾸고, 목록은 그 항목의 행으로 스크롤합니다. 항목은 그림에서는 테두리로, 목록에서는 고른 행의 막대로 표시하며, 결코 색만으로 표시하지 않습니다. 항목의 패널이 그 줄을 연 채 열리고, 주소는 그 줄과 항목을 브라우저 방문 기록의 한 걸음으로 지녀, 뒤로 단추가 단계 전체의 대화에서 그 줄로 돌아옵니다. 대화가 접혀 있으면 그 열은 항목이나 줄이 열려 있는 동안 보입니다(SCR-111, SPEC-210).

설계 수정의 요청은 06단계의 [설계 수정의 인터페이스](../../06-api/nexus.ko.md#설계-수정의-인터페이스)에 계획되어 있고, 계약이 이미 그것을 담고 있습니다: API-177과 API-178은 계획한 경로로, 만든 요청의 계획한 꼴은 `components.pathItems` 아래에 있습니다. 그래서 설계 수정의 행은 계약이 늘어놓는 응답과 코드를 적고, 이 단계의 검사가 그것을 계약에서 읽습니다([돌린 검사](#돌린-검사)).

## 응답과 상태

NEXUS의 요청이 답하는 대로 쓴 단계의 기본값입니다. 정의마다 자기 요청의 응답을 적습니다.

| 응답 | 상태 | 사용자가 보는 것 |
| --- | --- | --- |
| 자료가 있는 `200`이나 `201` | normal | 그 자료. 쓰기 뒤에는 그 결과와 다시 읽은 자료 |
| 빈 목록이 있는 `200`, 또는 문제 `picture_not_found` | empty | 무엇이 나타날지와 그것이 어떻게 나타나는지 |
| `changed: false`인 `200` | stale | 다른 탭이나 에이전트가 이미 했다는 것과 다시 읽은 자료 |
| `400` `invalid_request` | error | `field`가 가리킨 칸 옆의 메시지, 입력은 그대로 |
| `401`, 또는 `opaqueredirect` 응답으로 온 Access의 리다이렉트 | permission | 로그인이 끝남: 다시 로그인, 입력은 그대로(규칙 7) |
| `403` `access_missing`, `access_other_app`, `user_only`, `no_kind` | permission | 코드의 메시지로 본 까닭과 돌아갈 길, 입력은 그대로 |
| `403` `cross_site` | error | 메시지와, 서버 자체 주소의 그 페이지로 가는 링크 |
| 프로젝트, 그 공간, 부분, 단계의 `404` | error | 코드의 메시지와 허브 페이지 링크 |
| 항목, 곧 의견, 어긋남, 제안, 반영, 확인 지점의 `404` | 패널에서는 gone, 그 밖에는 error | 그것이 서버에 없다는 것. 보기는 다시 읽습니다 |
| 상태의 `409`: `proposal_not_open`, `edit_state`, `checkpoint_recorded` | stale | 그것이 지금 무엇인지와 다시 읽은 자료 |
| 한도의 `409`: `comment_limit`, `reply_limit`, `reflection_limit`, `space_full` | error | 한도, 글은 그대로. `reply_limit`이면 새 의견을 권함 |
| `409` `write_id_reused` | error | 새 쓰기 ID를 만드는 다시 시도 |
| 통과가 보여 준 것의 `409`: `snapshot_changed`나 `request_changed`, 계획 | stale | 바뀌었다는 것, 쓴 말은 그대로이고 아무것도 기록되지 않으며, 단계나 요청의 지금 모습([규칙 21](#설계-수정의-화면)) |
| `409` `checkpoint_requested`, 계획 | error | 허브를 거친 AI의 확인 요청만 받습니다. 보기는 다른 코드처럼 그 메시지를 보입니다 |
| `413` `text_too_long`이나 `body_too_large` | error | 칸 옆의 한도, 글은 그대로 |
| `415`, `500`, 그 밖의 오류 | error | 메시지와 다시 시도, 화면이 담은 것은 그대로 |
| Cloudflare의 `429`나 `503`, 네트워크 없음, 30초 안에 답 없음 | error | 메시지와 다시 시도(규칙 8) |

NEXUS가 단계의 기본값과 다른 곳: `401`은 서버가 아니라 Access의 것이고, 끝난 로그인만 그것을 보기에 가져옵니다. 항목의 `404`는 패널 자신의 상태 `gone`으로 이어집니다. 한도의 `409`는 글을 그대로 두는 오류입니다. 요청은 제 꼴이었고 가득 찬 것은 공간이기 때문입니다. 2026-11-11의 설계 수정부터: 다시 읽기의 `400`, 곧 꼴이 다른 쿼리 값은 여느 것과 같은 읽기의 오류로 "새로 읽지 못했습니다. 보이는 내용이 최신이 아닐 수 있습니다."와 다시 시도를 보입니다. 그 값을 담은 사용자의 칸이 없기 때문입니다(검토의 발견 30).

## 메시지

화면이 보이는 06단계 [오류 코드](../../06-api/nexus.ko.md#오류-코드)의 메시지와 화면 자신의 메시지의 최종 문구입니다. `{limit}`, `{state}`와 중괄호 속 다른 이름은 답이나 자료에서 채웁니다. 한국어는 1차의 허브 페이지처럼 존댓말로 씁니다.

### 오류 코드

| 코드 | 상태 | 영어 | 한국어 |
| --- | --- | --- | --- |
| `invalid_request` | 400 | This could not be sent: check the marked field. | 보내지 못했습니다. 표시한 칸을 확인해 주세요. |
| `access_missing` | 403 | Cloudflare Access did not check this request. Protect the server with Access first. | Cloudflare Access가 이 요청을 확인하지 않았습니다. 먼저 서버를 Access로 보호해 주세요. |
| `access_other_app` | 403 | This request was checked for another Access application. Check the server's Access settings. | 이 요청은 다른 Access 애플리케이션용으로 확인되었습니다. 서버의 Access 설정을 확인해 주세요. |
| `cross_site` | 403 | A change from another site is refused. Open this page at the server's own address. | 다른 사이트에서 보낸 변경은 받지 않습니다. 서버 주소에서 이 페이지를 열어 주세요. |
| `user_only` | 403 | Only you can do this, signed in yourself. | 본인이 직접 로그인해야 할 수 있습니다. |
| `no_kind` | 403 | This sign-in cannot write here. Check the Access policy. | 이 로그인으로는 여기에 쓸 수 없습니다. Access 정책을 확인해 주세요. |
| `not_found` | 404 | Not found. | 찾을 수 없습니다. |
| `project_not_found` | 404 | This project is not on the server. | 이 프로젝트는 서버에 없습니다. |
| `space_not_found` | 404 | This project was pushed only by an older hub, so it has no pictures or checkpoints here yet. Push it with corthex-nexus 0.2. | 이 프로젝트는 이전 허브로만 올라와 아직 그림과 확인 지점이 없습니다. corthex-nexus 0.2로 올려 주세요. |
| `part_not_found` | 404 | This part is not in the project's snapshot. | 이 부분은 프로젝트의 스냅샷에 없습니다. |
| `picture_not_found`, `why`가 `not-drawn` | 404 | No picture is drawn yet for this stage and part. It appears after a push that holds the stage's document. | 이 단계와 부분의 그림은 아직 없습니다. 단계 문서를 담은 스냅샷을 올리면 나타납니다. |
| `picture_not_found`, `why`가 `size` | 404 | This picture was left out: its source is larger than a snapshot may hold. | 원본이 스냅샷에 담을 수 있는 크기보다 커서 이 그림은 빠졌습니다. |
| `picture_not_found`, `why`가 `other-repository` | 404 | This picture was left out: its source is in another repository. | 원본이 다른 저장소에 있어서 이 그림은 빠졌습니다. |
| `comment_not_found` | 404 | This comment is not on the server. | 이 의견은 서버에 없습니다. |
| `discrepancy_not_found` | 404 | This discrepancy is not on the server. | 이 어긋남은 서버에 없습니다. |
| `proposal_not_found` | 404 | This proposal is not on the server. | 이 제안은 서버에 없습니다. |
| `edit_not_found` | 404 | This reflection is not on the server. | 이 반영은 서버에 없습니다. |
| `checkpoint_not_found` | 404 | This checkpoint is not on the server. | 이 확인 지점은 서버에 없습니다. |
| `method_not_allowed` | 405 | This request is not allowed here. Load the page again. | 여기서는 할 수 없는 요청입니다. 페이지를 다시 불러와 주세요. |
| `comment_limit` | 409 | This project holds as many comments as it may ({limit}). Your text stays here. | 이 프로젝트에 남길 수 있는 의견({limit}개)이 다 찼습니다. 쓴 글은 여기 남아 있습니다. |
| `reply_limit` | 409 | This comment holds as many replies as it may ({limit}). Leave a new comment. | 이 의견에 달 수 있는 답글({limit}개)이 다 찼습니다. 새 의견으로 남겨 주세요. |
| `reflection_limit` | 409 | This project holds as many pending reflections as it may ({limit}). The proposal stays open. | 이 프로젝트의 반영 대기가 한도({limit}개)에 닿았습니다. 제안은 열린 채로 둡니다. |
| `space_full` | 409 | This project's space is full. Your text stays here. | 이 프로젝트의 공간이 가득 찼습니다. 쓴 글은 여기 남아 있습니다. |
| `proposal_not_open` | 409 | This proposal is no longer open: it was {state}. | 이 제안은 이제 열려 있지 않습니다. 상태: {state} |
| `edit_state` | 409 | This reflection changed meanwhile: it is now {state}. | 이 반영은 그사이 바뀌었습니다. 지금 상태: {state} |
| `checkpoint_recorded` | 409 | This checkpoint is recorded, so it cannot be withdrawn here. Changing it is a new decision. | 이 확인 지점은 이미 기록되어 여기서 철회할 수 없습니다. 바꾸려면 새로 결정해야 합니다. |
| `write_id_reused` | 409 | This could not be sent. Try again. | 보내지 못했습니다. 다시 시도해 주세요. |
| `body_too_large` | 413 | This is larger than the server takes. | 서버가 받는 크기보다 큽니다. |
| `text_too_long` | 413 | This text is too long: {limit} characters at most. | 글이 너무 깁니다. {limit}자까지 쓸 수 있습니다. |
| `json_required` | 415 | This could not be sent. Load the page again, then try again. | 보내지 못했습니다. 페이지를 다시 불러온 뒤 다시 시도해 주세요. |
| `internal` | 500 | Something went wrong on the server. Try again. | 서버에서 문제가 생겼습니다. 다시 시도해 주세요. |

`{state}`에 들어가는 상태: 제안은 받음, 버림, 철회됨(accepted, dismissed, withdrawn), 반영은 `pending`, `in-review`, `needs-user`, `closed`, `dismissed`에 따라 반영 전, 검토 중, 사용자를 기다림, 반영됨, 버림(not yet reflected, in review, waiting for the user, reflected, dismissed)입니다.

다른 코드는 어느 화면도 보이지 않습니다. `agent_only`, `claimed`, `comment_closed`는 에이전트의 쓰기만 거절하고, `invalid_snapshot`, `clock_ahead`, `unknown_item`, `older_snapshot`, `commit_not_replaced`, `too_many_projects`, `repository_mismatch`, `proposal_limit`, `pull_request_reported`, `pull_request_mismatch`, `entry_closed`, `checkpoint_withdrawn`, `snapshot_too_large`, `entry_not_found`는 허브에만 닿으며 허브는 세션에서 `detail`을 보입니다. 그 메시지는 06단계가 쓴 초안 그대로입니다.

### 화면 자신의 메시지

| 메시지 | 나오는 곳 | 영어 | 한국어 |
| --- | --- | --- | --- |
| 끝난 로그인 | 모든 보기(규칙 7) | Your sign-in has expired. Sign in again: what you wrote stays here. | 로그인이 끝났습니다. 다시 로그인해 주세요. 쓴 글은 여기 남아 있습니다. |
| 연결 없음 | 모든 보기(규칙 8) | No connection to the server. Check the network, then try again. | 서버에 연결되지 않습니다. 네트워크를 확인한 뒤 다시 시도해 주세요. |
| 제때 답 없음 | 모든 보기(규칙 8) | The server did not answer in time. Try again. | 서버가 제때 답하지 않았습니다. 다시 시도해 주세요. |
| 바쁨 | 모든 보기(규칙 8) | The server is busy. Wait a moment, then try again. | 서버가 바쁩니다. 잠시 뒤 다시 시도해 주세요. |
| 추적 ID | 모든 오류 아래(규칙 3) | Trace ID {traceId} | 추적 ID {traceId} |
| 새로 읽는 중 | 모든 보기(규칙 6) | Updating… | 새로 읽는 중… |
| 새로 읽지 못함 | 모든 보기(규칙 6) | Could not update. What you see may be out of date. | 새로 읽지 못했습니다. 보이는 내용이 최신이 아닐 수 있습니다. |
| 보내는 중 | 모든 쓰기(규칙 4) | Sending… | 보내는 중… |
| 남은 글자 수 | 모든 칸(규칙 5) | {n} characters left | {n}자 남음 |
| 읽지 못한 페이지 자료 | SCR-101 | This page's data could not be read. Load the page again. On a device: Build the hub again. | 이 페이지의 데이터를 읽지 못했습니다. 페이지를 다시 불러와 주세요. 기기에서는 허브를 다시 만들어 주세요. |
| 빈 서버 | SCR-101 | Nothing has been pushed to this server yet. It shows each pushed project's stages, checks and pictures. To push a project: register it with the corthex skill; list it in `nexus.push` with this server's address in `nexus.url`; set the service token's two environment variables, `CORTHEX_NEXUS_CLIENT_ID` and `CORTHEX_NEXUS_CLIENT_SECRET`; then have the agent show a dry run and push. | 아직 이 서버에 올라온 프로젝트가 없습니다. 이 서버는 올라온 프로젝트마다 단계, 점검, 그림을 보여 줍니다. 프로젝트를 올리려면 corthex 스킬로 등록하고, `nexus.push`에 넣고 `nexus.url`에 이 서버의 주소를 적고, 서비스 토큰의 환경 변수 두 개 `CORTHEX_NEXUS_CLIENT_ID`와 `CORTHEX_NEXUS_CLIENT_SECRET`을 설정한 뒤, 에이전트에게 미리 보기를 보이고 올려 달라고 하세요. |
| 서버에 있음 | 기기의 SCR-101, SCR-104 | The pictures, comments and stage overviews are on the NEXUS server. | 그림, 의견, 단계 현황은 NEXUS 서버에 있습니다. |
| 페이지에 없는 프로젝트 | SCR-103, SCR-104 | This project is not on this page. | 이 프로젝트는 이 페이지에 없습니다. |
| 단계가 아님 | SCR-104 | This stage is not one of the 13. | 13단계에 없는 단계입니다. |
| 보기를 불러오는 중 | 코드가 돌기 전의 SCR-105 | Loading the picture view. If it does not appear, load the page again. | 그림 보기를 불러오는 중입니다. 나타나지 않으면 페이지를 다시 불러와 주세요. |
| 그리는 중 | SCR-105 | Drawing the picture… | 그림을 그리는 중… |
| 큰 그림 | SCR-105 | This picture is large ({n} elements), so drawing it may take longer. | 이 그림은 요소가 {n}개로 커서 그리는 데 시간이 더 걸릴 수 있습니다. |
| 스텝 | SCR-105, DDD 보드에서: 스텝 고르기(SPEC-141) | Previous step · Next step · Steps · 1-b Timeline · 2 External systems · 3 Commands · 4 Hotspots · 5 Actors · 6 Aggregates · 7 Contexts · 8-a Policies and read models · 8-b–9 Map and tables | 이전 스텝 · 다음 스텝 · 스텝 · 1-b 타임라인 · 2 바깥 시스템 · 3 명령 · 4 핫스팟 · 5 행위자 · 6 애그리거트 · 7 컨텍스트 · 8-a 정책과 읽기 모델 · 8-b–9 지도와 정리표 |
| 타임라인 없음 | SCR-105, 타임라인이 없는 DDD 보드에서 스텝 고르기 자리에 | This document has no timeline, so the board is shown only as a whole. | 이 문서에는 타임라인이 없어 보드를 전체로만 보여 줍니다. |
| 최신 아님 | SCR-105 | This picture shows commit {commit}: its newest source is larger than a snapshot may hold. Or: its newest source is gone from the repository. Or: its newest source is in another repository. | 이 그림은 커밋 {commit}의 그림입니다. 최신 원본이 스냅샷에 담을 수 있는 크기보다 큽니다. 또는: 최신 원본이 저장소에서 사라졌습니다. 또는: 최신 원본이 다른 저장소에 있습니다. |
| 링크 옆의 최신 아님 | SCR-104, SCR-109 | Not current: its newest source is larger than a snapshot may hold. Or: is gone from the repository. Or: is in another repository. | 최신 아님: 최신 원본이 스냅샷에 담을 수 있는 크기보다 큼. 또는: 저장소에서 사라짐. 또는: 다른 저장소에 있음. |
| 새 판 | SCR-105 | A newer version of this picture is on the server. Show it | 서버에 이 그림의 새 판이 있습니다. 보기 |
| 코드 실패 | SCR-105 | The picture could not be drawn here, so its items are listed instead. | 여기서는 그림을 그리지 못해 항목을 목록으로 보여 드립니다. |
| 따로 | SCR-105 | Apart: comments whose item is gone ({n}) | 따로: 항목이 없어진 의견 ({n}) |
| 기다림 | SCR-105, SCR-106 | Waits for a current picture | 최신 그림을 기다림 |
| 받음 | SCR-105, SCR-108 | Accepted, not yet reflected | 받음, 아직 반영 전 |
| 의견 없음 | SCR-106 | No comments on {id} yet. | {id}에는 아직 의견이 없습니다. |
| 그림에 없음 | SCR-106 | {id} is not in this picture. | {id} 항목은 이 그림에 없습니다. |
| ID 없음 | SCR-106 | No ID: comments on it are kept on the picture, with its name as the quote. | ID가 없어, 의견은 이 이름을 인용으로 붙여 그림에 남습니다. |
| 항목 안의 부분 | SCR-106 | No ID of its own: comments are kept on {id}, with this name as the quote. | 자기 ID가 없어, 의견은 이 이름을 인용으로 붙여 {id}에 남습니다. |
| 항목의 닫힌 의견 | SCR-106 | Closed on {id} | {id}의 닫힌 의견 |
| 복구한 초안 | SCR-106 | An earlier picture draft was recovered. Its previous send may already be on the picture; check the comments before sending a new comment on {id}, with this name as the quote. | 이전 그림 초안을 복구했습니다. 이전 전송이 그림에 이미 남았을 수 있으니 의견을 확인한 뒤 보내세요. 새 의견은 이 이름을 인용으로 붙여 {id}에 남습니다. |
| 의견의 상태 | SCR-107 | Waiting for the agent. Waiting for the user. Settled by the user, waiting for the agent's record. A proposal was dismissed. Closed as answered. Closed with a decision. | 에이전트를 기다림. 사용자를 기다림. 사용자가 정함, 에이전트의 기록을 기다림. 제안을 버림. 답이 나서 닫힘. 결정으로 닫힘. |
| 답글 없음 | SCR-107 | No replies yet. | 아직 답글이 없습니다. |
| 정함 | SCR-107 | This settles it | 이것으로 정함 |
| 다시 열기 | SCR-107 | Reply and open again | 답글 달고 다시 열기 |
| 이미 닫힘 | SCR-107 | This comment was already closed. | 이 의견은 이미 닫혀 있었습니다. |
| 불러오지 못함 | SCR-107, SCR-108 | Could not load this comment. Or: Could not load this proposal. | 이 의견을 불러오지 못했습니다. 또는: 이 제안을 불러오지 못했습니다. |
| 반영의 상태 | SCR-108 | Accepted, not yet reflected. In review: {pull request}. The change no longer fits the stage source; the agent asks you on its comment. Reflected by {pull request}. Reflected: already in the stage source at commit {commit}. The reflection was dismissed. | 받음, 아직 반영 전. 검토 중: {pull request}. 단계 원본이 바뀌어 이 변경이 더는 맞지 않습니다. 에이전트가 의견에서 묻습니다. {pull request}로 반영됨. 반영됨: 커밋 {commit}의 단계 원본에 이미 있음. 반영을 버렸습니다. |
| 버림, 철회됨 | SCR-108 | Dismissed on {date}; its comment stays open. Withdrawn by the agent on {date}. | {date}에 버림. 의견은 열린 채로 남습니다. {date}에 에이전트가 철회함. |
| 반영 대기 | SCR-108 | Accepted, not yet reflected. | 받음, 아직 반영 전. |
| 반영 검토 중 | SCR-108 | In review: {pull request}. | 검토 중: {pull request}. |
| 사용자 확인이 필요한 반영 | SCR-108 | The change no longer fits the stage source; the agent asks you on its comment. | 단계 원본이 바뀌어 이 변경이 더는 맞지 않습니다. 에이전트가 의견에서 묻습니다. |
| PR로 반영 | SCR-108 | Reflected by {pull request}. | {pull request}로 반영됨. |
| 원본에 이미 반영 | SCR-108 | Reflected: already in the stage source at commit {commit}. | 반영됨: 커밋 {commit}의 단계 원본에 이미 있음. |
| 반영 버림 | SCR-108 | The reflection was dismissed. | 반영을 버렸습니다. |
| 제안 버림 | SCR-108 | Dismissed on {date}; its comment stays open. | {date}에 버림. 의견은 열린 채로 남습니다. |
| 제안 철회 | SCR-108 | Withdrawn by the agent on {date}. | {date}에 에이전트가 철회함. |
| 이미 버림 | SCR-108 | The reflection was already dismissed. | 이 반영은 이미 버려져 있었습니다. |
| 앞 그림 | SCR-108 | Made on the picture of commit {commit}; the stage source may have changed since. | 커밋 {commit}의 그림에서 낸 제안입니다. 그 뒤 단계 원본이 바뀌었을 수 있습니다. |
| 현황을 불러오는 중 | 코드가 돌기 전의 SCR-109 | Loading the stage overview. If it does not appear, load the page again. | 단계 현황을 불러오는 중입니다. 나타나지 않으면 페이지를 다시 불러와 주세요. |
| 남은 것 없음 | SCR-109 | Nothing is left in this stage. | 이 단계에 남은 것이 없습니다. |
| 점검 없음 | SCR-109 | No checks found anything. | 점검에서 찾은 것이 없습니다. |
| 읽지 않는 단계 | SCR-109 | This project does not read this stage: {why}. You can still pass its checkpoint. | 이 프로젝트는 이 단계를 읽지 않습니다: {why}. 그래도 확인 지점은 통과시킬 수 있습니다. |
| 기록을 기다림 | SCR-101, SCR-104, SCR-109 | Passed in NEXUS on {date}, waiting for its record | {date}에 NEXUS에서 통과, 기록을 기다림 |
| 다시 통과 | SCR-109 | Pass again | 다시 통과 |
| 기록된 철회 | SCR-101, SCR-104, SCR-109 | The record names a checkpoint that was withdrawn in NEXUS. The agent corrects the record. | 기록에 NEXUS에서 철회한 확인 지점이 적혀 있습니다. 에이전트가 기록을 고칩니다. |
| 이미 철회됨 | SCR-109 | This checkpoint was already withdrawn. | 이 확인 지점은 이미 철회되어 있었습니다. |
| 철회함 | SCR-109 | Withdrawn on {date} | {date}에 철회함 |
| 열지 못함 | SCR-109 | {n} discrepancies could not be opened, since the space holds 1,000 open ones. | 공간에 열린 어긋남이 1,000개라 {n}개를 열지 못했습니다. |

스텝과 타임라인 없음 두 줄은 2026-11-03 관리자의 선택으로 더했습니다. 스텝 줄에서 `·` 사이의 말은 저마다 따로 쓰는 이름표입니다.

허브 페이지와 그 보기는 1차의 다른 메시지, 곧 "아직 프로젝트가 없습니다. corthex 스킬로 프로젝트를 등록한 뒤 허브를 다시 만들어 주세요."나 "“{q}”와 맞는 항목이 없습니다." 같은 것을 hub.html이 담은 영어와 한국어 그대로 둡니다.

### 목업이 더한 말

09단계의 목업([A 방향](../../09-mockup/nexus/README.ko.md#결정))에 필요했지만 08단계가 쓰지 않았던 말입니다. 2026-11-03에 목업과 함께 더했고, 그날의 확인 지점에서 그대로 섰습니다. `·` 사이의 말은 저마다 따로 쓰는 이름표입니다.

| 말 | 나오는 곳 | 영어 | 한국어 |
| --- | --- | --- | --- |
| 열린 수 | SCR-101, 서버에서 | 1 open comment · {n} open comments · 1 open proposal · {n} open proposals · 1 open discrepancy · {n} open discrepancies | 열린 의견 {n} · 열린 제안 {n} · 열린 어긋남 {n} |
| 그림 표시 | SCR-101, 서버에서: 단계 표시의 설명 끝과, 그림이 있는 단계의 이름 | picture in NEXUS | NEXUS에 그림 |
| 기다리는 확인 지점 | SCR-101, 서버에서 | Waiting for their records ({n}) | 기록을 기다리는 확인 지점 ({n}) |
| NEXUS에서 | SCR-101#stale, 서버에서: 최신이 아닌 그림이 있거나 기록에 철회한 확인 지점이 적혀 있을 때 카드의 그 줄들의 제목 | In NEXUS | NEXUS에서 |
| 먼저 묻는 일 | SCR-101, 서버에서(SPEC-125) | Asks first ({source}) · {list} and {n} more in the settings · Not asked in this project: {list} · Anything that cannot be undone is asked in any case. · Only what cannot be undone is asked. | 먼저 묻는 일 ({source}) · {list} 외 {n}개는 설정에 있음 · 이 프로젝트에서 묻지 않는 일: {list} · 되돌릴 수 없는 일은 어쨌든 묻습니다. · 되돌릴 수 없는 일만 묻습니다. |
| 목록의 출처 | SCR-101, 먼저 묻는 일 안 | the project's list · the profile's list · the default list | 프로젝트의 목록 · 프로필의 목록 · 기본 목록 |
| 모든 프로젝트 | SCR-103, SCR-104: 프로젝트로 가는 링크 | All projects | 모든 프로젝트 |
| 확대 | SCR-105: 확대 단추의 이름 | Zoom out · Zoom in · Whole picture | 축소 · 확대 · 그림 전체 |
| 합친 표시 | SCR-105: 그림 전체에서 합친 컨텍스트 표시의 이름 | 1 mark in {context}: zoom in · {n} marks in {context}: zoom in | {context}의 표시 {n}개: 확대하기 |
| 표시의 설명 | SCR-105: 표시 설명의 이름 | Legend of the marks | 표시의 설명 |
| 항목 목록 | SCR-105 | With marks ({n}) · The rest ({n}) · Part without an ID | 표시가 있는 것 ({n}) · 나머지 ({n}) · ID 없는 부분 |
| 항목 패널 | SCR-106 | Proposals ({n}) · Comments ({n}) · Closed ({n}) · 1 reply · {n} replies | 제안 ({n}) · 의견 ({n}) · 닫힌 의견 ({n}) · 답글 {n}개 |
| One reply | SCR-106, 의견 요약 | 1 reply | 답글 1개 |
| Reply count | SCR-106, 의견 요약 | {n} replies | 답글 {n}개 |
| Comment on | SCR-106, 의견 입력란 라벨 | Comment on {id} | {id}에 의견 남기기 |
| 그림으로 돌아가기 | SCR-106, SCR-107, SCR-108, 그 항목·의견·제안이 없어졌을 때 | Back to the picture | 그림으로 돌아가기 |
| 답글 불러오기 | SCR-107#loading, 화면 낭독기용 | Loading the replies… | 답글을 불러오는 중… |
| 새 답글 | SCR-107#stale: 패널을 연 뒤에 온 답글 | New | 새 답글 |
| 제안 패널 | SCR-108 | Change · Reason · Stage source text · Made on commit {commit} · Answers | 변경 · 까닭 · 단계 원본의 글 · 커밋 {commit}에서 낸 제안 · 답하는 의견 |
| 원본 글 불러오기 | SCR-108#loading, 화면 낭독기용 | Loading the stage source text… | 단계 원본의 글을 불러오는 중… |
| 단계 현황의 제목 | SCR-109 | Recorded state · Updated {time} · Discrepancies ({n}) · Comments ({n}) · Pending reflections ({n}) · Words (optional) | 기록된 상태 · 갱신 {time} · 어긋남 ({n}) · 의견 ({n}) · 반영 대기 ({n}) · 남길 말 (선택) |

### 0.2.3이 더한 말

NEXUS 0.2.3은 지금 화면의 틀은 그대로 두고 고칩니다. 이 말들은 필드 이름, 까닭 코드, 아무 말 없던 휠을 대신하며, 2026-11-06에 그 패치와 함께 더했습니다. `·` 사이의 말은 저마다 따로 쓰는 이름표이고, 코드는 '자세히' 안에 남습니다.

| 말 | 나오는 곳 | 영어 | 한국어 |
| --- | --- | --- | --- |
| 휠 안내 | SCR-105: 그림 위에서 휠을 그냥 처음 굴렸을 때 한 번 | The wheel scrolls the page. To zoom the picture, hold Ctrl or ⌘ while turning the wheel, pinch, or use the zoom buttons. | 휠은 페이지를 내립니다. 그림을 확대하려면 Ctrl이나 ⌘를 누른 채 휠을 굴리거나, 두 손가락을 오므리거나 벌리거나, 확대 단추를 쓰세요. |
| 항목 필드 | SCR-106: 항목의 원본 필드 context, terms, primary_key, unique, foreign_keys, path, flows, purpose의 이름 | Context · Terms · Primary key · Unique · Foreign keys · Path · Flows · Purpose | 컨텍스트 · 용어 · 기본 키 · 고유 · 외래 키 · 경로 · 흐름 · 목적 |
| 항목 값 | SCR-106: 빈 필드, 일부 행에만 걸린 고유 키, 접어 둔 원본 필드 | None · {columns}, on some rows only · Details | 없음 · {columns}, 일부 행에만 · 자세히 |
| 외래 키 | SCR-106: 외래 키 하나, 가리키는 열이 있을 때와 없을 때 | {columns} → {table} ({references}). Deleting the referenced row {action} · {columns} → {table}. Deleting the referenced row {action} | {columns} → {table} ({references}). 가리키는 행을 지우면 {action} · {columns} → {table}. 가리키는 행을 지우면 {action} |
| 지울 때 | SCR-106: 외래 키 안, 지울 때의 동작 cascade, set null, set default, restrict, no action | also deletes this row. · empties these columns. · sets these columns to their default. · is refused. · is refused. | 이 행도 지워집니다. · 이 열이 비워집니다. · 이 열이 기본값으로 바뀝니다. · 거부됩니다. · 거부됩니다. |
| 01 용어 없음 | SCR-106, SCR-109: 어긋남의 까닭 no-term, 표일 때와 화면일 때 | This table names no 01 term. · This screen names no 01 term. | 이 표에 맞는 01 용어가 없습니다. · 이 화면에 맞는 01 용어가 없습니다. |
| 보드에 없음 | SCR-106, SCR-109: 어긋남의 까닭 not-on-board | The 01 board has no such term. | 01 보드에 없는 용어입니다. |
| 다른 컨텍스트 | SCR-106, SCR-109: 어긋남의 까닭 other-context, 표일 때와 화면일 때 | The 01 board puts this term in {board}, and this table is in {here}. · The 01 board puts this term in {board}, and this screen is in {here}. | 01 보드는 이 용어를 {board}에 두고, 이 표는 {here}에 있습니다. · 01 보드는 이 용어를 {board}에 두고, 이 화면은 {here}에 있습니다. |
| 지움 표시 | SCR-106, SCR-109: 어긋남의 까닭 removed, 용어일 때와 표일 때와 화면일 때 | The 01 board marks this term removed. · This table is marked removed. · This screen is marked removed. | 01 보드가 이 용어를 지운 것으로 표시합니다. · 이 표는 지운 것으로 표시되어 있습니다. · 이 화면은 지운 것으로 표시되어 있습니다. |
| 표 없음 | SCR-106, SCR-109: 어긋남의 까닭 no-table | No 05 table names this aggregate. | 이 애그리거트를 쓰는 05 표가 없습니다. |
| 화면 없음 | SCR-106, SCR-109: 어긋남의 까닭 no-screen | No 07 screen names this read model. | 이 읽기 모델을 쓰는 07 화면이 없습니다. |
| 그림의 지움 표시 | SCR-105: 그림 속 05 표의 설명 줄에서 ID와 컨텍스트 뒤, 그 표가 지운 것으로 표시되어 있을 때 | removed | 지움 |

### 다시 디자인이 더한 말

다시 디자인의 정의 SCR-110\~SCR-117에는 [redesign-words.ko.md](redesign-words.ko.md)의 말이 필요하며, 2026-11-07에 그 확인 지점 3을 위해 초안을 썼습니다. 0.2에 이미 있는 코드와 상태에는 위의 메시지를 그대로 씁니다. 이 말을 따로 파일에 두는 까닭은 `nexus/tools/messages.mjs`가 README.md의 표를 모두 0.2에서 만든 보기의 말로 바꾸기 때문이며, 다시 디자인을 만들면서부터 그 파일의 표를 다시 디자인의 말로 그 곁에 바꾸고, 거기 있는 코드 `not_recommended`와 `item_not_found`는 0.2의 코드에 더해집니다([11단계](#11단계-개발)).

### 설계 수정이 계획한 말

설계 수정의 행에는 [revision-words.ko.md](revision-words.ko.md)의 말이 필요하며, 영어와 한국어로 있고 만든 것은 없습니다. 그 파일의 표에는 다섯째 칸, 곧 줄마다의 진행이 있어서, 이 파일과 [redesign-words.ko.md](redesign-words.ko.md)의 네 칸짜리 표를 모두 읽는 `nexus/tools/messages.mjs`가 그것을 건드리지 않고, 보기의 말은 만든 그대로 남습니다. 줄을 만드는 작업은 같은 변경에서 그 말을 진행 없이 [redesign-words.ko.md](redesign-words.ko.md)로 옮기고, 만든 말이 그것을 따릅니다. 그때 물러나는 만든 말: D17에 따라 "추천대로 통과"와 `not_recommended`의 말, "2단계"가 붙은 "편집", 그리고 [오류 코드](#오류-코드)에 있는 `cross_site`의 말이며, 그 새 말은 내보내기처럼 아무것도 바꾸지 않는 요청에도 맞습니다.

## 이 단계가 고른 것

앞 단계들이 이것들을 08단계에 맡겼습니다. 2026-11-03의 확인 지점은 저마다 그대로 두었습니다.

1. 화면마다 파일 하나를 그 ID와 짧은 이름으로 이름 지어 NEXUS의 폴더에 두고, 모든 화면의 규칙과 메시지는 이 파일에 둡니다. 03단계의 흐름을 둔 방식과 같습니다. 이 단계의 기본은 `docs/08-screens/`에 화면마다 그 ID만으로 이름 지은 파일 하나입니다.
2. 단계의 여섯 상태 말고 화면 자신의 상태 셋: SPEC-119가 이름을 붙인 그림 보기의 `large`와 `code-failed`, 그리고 세 패널의 `gone`. `gone`은 주소나 패널이 가리키는 항목, 의견, 제안이 이제 없을 때이며, 단계의 기본값이면 오류라고 부를 것입니다.
3. 패널은 1,024픽셀 폭부터, 곧 ② 차례가 고치기를 하는 폭부터(SPEC-134) 그림 옆에 너비 400픽셀로 열리고, 그보다 좁으면 높이의 85퍼센트까지 아래에서 올라오는 시트로 열려, 휴대폰에서도 그림이 보이게 합니다.
4. 메시지는 `detail`을 절대 보이지 않으므로, 모든 오류는 그 메시지 아래 작은 글자로 추적 ID를 보여 사용자가 그것을 알리고 서버의 로그에서 그것을 찾을 수 있게 합니다.
5. 보기의 요청은 허브의 요청처럼(06단계의 [상한](../../06-api/nexus.ko.md#상한)) 30초를 가집니다. 그 뒤 보기는 서버가 제때 답하지 않았다고 알립니다.
6. 쓰기나 다시 읽기 뒤의 새 그림은 사용자 밑에서 다시 그리지 않고 보기와 함께 권하여, 사용자가 읽고 있는 항목이 움직이지 않게 합니다.
7. 허브 페이지가 그 프로젝트나 단계를 담지 않은 `#` 뒤의 주소는, 1차가 아무것도 보이지 않던 자리에 프로젝트 목록으로 가는 링크를 단 안내를 보입니다.
8. 자료를 읽지 못한 허브 페이지는 그렇다고 알립니다. 1차는 빈 페이지 "아직 프로젝트가 없습니다"를 보이는데, 그러면 있는 프로젝트를 등록하라고 사용자를 보내게 됩니다.
9. 항목의 쓴 쪽은 "나" 대신 서버가 두는 종류(REQ-163)인 "사용자"나 "에이전트"로 보입니다. Access가 들여보낸 누구나 같은 화면을 보기 때문입니다.
10. 메시지는 무슨 일이 있었는지와 사용자가 할 수 있는 것을 페이지의 언어로, 1차의 메시지 꼴로, 곧 영어 문장과 존댓말의 한국어로 말합니다. 허브만 보는 코드는 06단계의 초안을 그대로 둡니다.
11. 사람 화면: 한 페이지의 와이어프레임을, 저장소가 공개이므로 링크가 프로젝트의 기록에 있는 비공개 페이지로 게시하고, 정의는 표를 데이터베이스로 둔 Notion의 한국어 사본으로 읽습니다.
12. ID 없이 그린 표나 화면처럼 어느 항목도 담지 않는 부분은 그림 자체에 대한 항목 패널을 엽니다. 그 부분의 이름이 패널의 제목이 되고, 거기 남기는 의견의 인용이 됩니다(SPEC-126). 그 부분을 가리키는 ID가 없으므로 이 패널에는 자기 주소가 없습니다: 다시 불러오면 그림이 보이고, 그 부분의 표시가 패널을 다시 열며, 보내지 않은 글은 그 부분을 다시 고르면 돌아옵니다.

다시 디자인의 고른 것이며, 2026-11-07에 그 확인 지점 3을 위해 초안을 썼습니다:

13. 모든 상태를 회색 와이어프레임을 먼저 그리지 않고, 다시 디자인의 확인 지점 2가 고른 모습으로 09단계의 [redesign.html](../../09-mockup/nexus/redesign.html)에 한 번 그립니다: 확인 지점 1이 회색으로 구조를, 확인 지점 2가 모습을 통과시켰으므로, 볼 것으로 남은 것은 그 모습으로 그린 상태 하나하나입니다. 이 페이지는 두 단계를 함께 맡고, 토큰으로 그리므로 목업과 함께 둡니다.
14. 작업 공간의 세 폭(규칙 16). 1,024픽셀에서 세 열이면 248의 목록과 400의 대화 사이에 그림이 376픽셀만 남으므로, 거기서 1,280픽셀까지는 대화를 단추로 접어 단계의 너비를 776픽셀 이상으로 지킵니다.
15. 서버가 페이지의 읽는 부분을 그립니다(규칙 15). 휴대폰이 보기의 코드가 오기 전에 내 차례를 읽게 하려는 것이며, 12단계는 REQ-149가 그림을 재듯 이것을 첫 화면에서 잽니다. 또 2026-11-04의 첫 그림 결정이 그림의 SVG를 그렇게 했듯, 코드가 실패한 페이지도 읽을 수 있게 남깁니다.
16. 계정 메뉴는 없습니다. 확인 지점 1의 와이어프레임은 그것을 그렸지만, 그것을 묻는 행이 없고 어느 화면도 신원을 보일 수 없으므로(규칙 11) 위 막대에 두지 않으며, 로그아웃은 Access의 것으로 남습니다.
17. 한국어에서 AI 에이전트는 AI입니다. 용어집이 AI 할 일(TERM-121)과 AI 차례(TERM-138)를 그렇게 부르고, 확인 지점 1과 2가 그렇게 그렸습니다. 0.2의 화면은 에이전트를 그대로 둡니다.
18. 단계 기록은 옆에, 대화 자리에 열려, 사용자가 기록을 읽거나 확인 지점을 통과시키는 동안 그림이나 목록이 보이는 채로 남게 합니다. 1,024픽셀보다 좁으면 시트로 엽니다.
19. 첫 화면에서 답한 줄은 페이지를 다시 불러올 때까지 그 결과로 표시된 채 제자리에 남고, 내 차례의 수는 바로 줄어, 목록이 사용자의 손가락 밑에서 움직이지 않게 합니다. 어느 답도 확인을 묻지 않습니다: 단추가 무엇을 하는지 말하고, 이렇게 통과시킨 확인 지점은 기록이 그것을 담기 전까지 그 단계 기록에서 철회할 수 있습니다(SPEC-143).

설계 수정의 고른 것이며, 2026-11-11에 초안을 썼습니다. 그 확인 지점은 2026-11-12에 통과했습니다:

20. 만들었거나 통과한 화면에 설계 수정이 계획한 것은 그 화면 정의의 마지막 절 "2026-11-11의 설계 수정"에, 정의 자신의 표로, 행마다 진행 `planned`와 함께 둡니다. 그 앞의 절들은 계속 지금의 화면을 적고, 행을 만드는 작업이 그 행을 앞의 절로 옮깁니다. 그래서 정의를 읽는 사람이 계획한 것을 있는 것으로 읽는 일이 없고, D17에 딸린 행은 통과한 글을 건드리지 않고 없앨 수 있었으며, D17이 2026-11-12에 추천대로 정해졌으므로 그대로 남습니다. SCR-130은 새 화면이어서 그 정의에는 계획한 행만 있습니다.
21. 설계 수정의 새 상태와 바뀐 상태는 이 단계의 기본이 묻는 대로 먼저 회색으로 그립니다: [revision-wireframes.html](revision-wireframes.html)에 설계 수정의 상태 행마다 390과 1,440픽셀의 틀을 영어와 한국어로 둡니다(검토의 발견 31). 확인 지점 3이 다시 디자인의 모습으로 통과시킨 상태 53개에는 고른 것 13이 그대로이며, 회색으로 다시 그리지 않습니다. 09단계는 이 단계의 확인 지점 뒤에 설계 수정의 상태를 그 모습으로 그립니다.
22. 프로젝트 자료 SCR-130은 단계의 열 위에 뜨는 패널이고 1,024픽셀보다 좁을 때는 시트이며, 상태가 아홉입니다: 단계의 여섯과 자기 것 셋, 곧 removal, removal-ready, gone. 지우기 확인은 브라우저의 대화 상자가 아니라 패널의 두 상태, 곧 프로젝트의 이름을 입력하기 전과 뒤입니다. 그래서 지우기가 무엇을 지우는지 보이고, 내보내기를 먼저 권하며, 열릴 때 목록을 다시 읽습니다. 입력한 이름은 페이지 안에서 양 끝의 빈칸만 빼고 글자 그대로 견주며, 보내지도 남기지도 않습니다. 지운 뒤 첫 화면은 브라우저의 세션 저장소에서 읽어 막대로 한 번 그렇게 말합니다(`SCR-110#removed`). 다시 불러온 페이지는 되풀이하지 않으며, 카드가 없다는 것이 그것을 알립니다.
23. 접기(SPEC-210): 1,024픽셀부터 단계 목록은 56픽셀의 띠로 접히고, 띠는 단계마다 가는 길을 남깁니다. 1,280픽셀부터 대화는 규칙 16의 "대화 ({n})"로 접히고, 접힌 채로 남습니다. 1,024\~1,279픽셀에서 대화는 규칙 16의 패널 그대로입니다. 처음 열 때 단계 목록은 편 채이고, 대화는 1,440픽셀부터 열이며 1,280\~1,439픽셀에서는 접힌 채 시작합니다: 두 열 옆에서 단계는 1,280픽셀에서 632픽셀이고 고른 것 14의 776픽셀에는 1,424픽셀이 되어야 닿으므로, 처음 열 때 단계가 776픽셀보다 좁아지는 일이 없습니다([그림 단계의 네 보기](../../09-mockup/nexus/picture-stage-views.html)). 그 뒤로는 사용자가 접거나 편 대로 남습니다. 1,280픽셀에서 둘 다 접으면 그림은 1,224픽셀을 얻으며, 세 열일 때는 632였습니다(검토의 발견 11). 서버는 열을 처음 열 때처럼 그리고 코드가 브라우저가 지닌 대로 접습니다. 첫 화면의 카드를 지닌 순서로 그리는 것과 같습니다. `SCR-111#folded`는 작업 공간 자신의 상태입니다. 만든 "대화 ({n})"와 휴대폰의 탭 "대화 {n}"은 단계의 열린 줄을 세는데, SPEC-155와 SPEC-210은 내 차례의 줄 수를 묻습니다: 둘 다 단계에 대화가 있는지 알려 주는 만든 수를 그대로 두고, 그 단계의 것이 사용자를 기다리는 동안에는 "내 차례 {n}"도 말합니다.
24. 2026-11-12에 추천대로 정해진 D17에 따라: 첫 화면에서 형식을 갖춘 확인 요청은 통째로 보이고, 첫째인 채운 단추가 "요청 열기", 둘째가 통과입니다. 통째로 보일 수 없는 요청은 여는 것만 내놓습니다(SPEC-196). 대화에서 요청의 줄은 단계 기록을 열고 사용자는 거기서 통과시킵니다. 대화 자신은 아무것도 통과시키지 않습니다. 그래서 확인 지점을 통과시키는 곳은 둘이고 둘 다 요청 전체 곁이며, "추천대로 통과"는 없어집니다.
25. 항목에 달린 대화의 줄을 여는 것이 그 항목을 고르는 몸짓입니다(규칙 24): 줄마다 조작을 하나 더 두지 않고, 한 번 눌러 답글을 읽고 항목을 봅니다. 주소는 `talk={comment}`와 `item={id}`를 브라우저 방문 기록의 한 걸음으로 함께 지녀, SPEC-209가 묻는 대로 뒤로 단추를 한 번 누르면 단계 전체의 대화에서 그 줄로 돌아옵니다.
26. 대화가 고른 항목의 행을 목록의 거르기나 찾기가 가리고 있으면, 목록은 사용자가 좁혀 놓은 것을 지키고 항목의 패널이 모두 보기와 함께 그렇게 말합니다. 사용자 밑에서 거르기를 비우지 않습니다. 그림이 최신이 아니거나 그려지지 않았으면 목록이 대신 그 행을 보이고, 패널이 까닭을 말합니다(SPEC-209).
27. 먼저 볼 것인 주소는 어디에 보이든, 서버 자신의 페이지여도, 리퍼러 없이 새 탭에서 열립니다: AI가 쓴 모든 주소에 규칙 하나이며(규칙 22, 06단계의 메모), 어느 페이지도 서버의 주소를 다른 주소와 가려낼 필요가 없고 페이지의 주소가 밖으로 나가지 않습니다.
28. 세 읽기 API-152, API-157, API-158의 `400` 답은 읽기의 오류입니다(검토의 발견 30): 꼴이 다른 쿼리 값은 "새로 읽지 못했습니다. 보이는 내용이 최신이 아닐 수 있습니다."와 다시 시도를 보이며, 만들어 둔 작업 공간과 목록은 실패한 읽기의 어느 코드에나 이미 그렇게 합니다. 다른 꼴인 `part`는 항목 자리에 코드의 메시지를 보입니다. 오류 상태는 만든 것을 적으므로 제자리에서 그것을 적고, 상태는 더하지 않습니다.
29. 설계 수정의 말은 자기 파일 [revision-words.ko.md](revision-words.ko.md)에 두고 그 표에 다섯째 칸을 두어, 말 생성기가 계획한 말을 만든 보기의 말로 바꾸지 않게 합니다. 작업은 줄을 만들 때 그 줄을 [redesign-words.ko.md](redesign-words.ko.md)로 옮깁니다. 한국어 이름표는 보내기를 첫 화면의 만든 이름표처럼 올리다라고 하며, 용어집의 글은 보내기라고 합니다.
30. 동작을 바꾸지 않는 바로잡기(검토의 발견 29): SCR-105의 날짜가 붙은 문단과 SCR-106 한국어판의 한 행에서 붙어 버린 낱말이 띄어쓰기를 되찾고, [정의서를 읽는 법](#정의서를-읽는-법)의 한 줄이 Worker의 문장을 서버의 것으로 읽게 합니다.

## 앞 단계의 변경

2026-11-03에 확인 지점을 통과하며 1\~3을 인터페이스에 반영했습니다. 07단계의 실수 둘을 바로잡는 마지막 것은 이 단계와 함께 바꿨습니다.

1. 06단계: 세 페이지 API-101\~API-103은 브라우저의 요청처럼 요청이 받아들이면 거절이나 오류에 `text/html`로 답합니다. 서버의 언어로 된 메시지 하나의 작은 페이지에 추적 ID, 다시 불러오기, 허브 페이지 링크가 있고, 정책 `default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'` 아래, 같은 상태로 답합니다. 지금 계약은 그 페이지들에 `application/problem+json`만 주는데, 브라우저는 그것을 날 글로 보입니다. 다른 클라이언트는 Problem Details를 그대로 받고 `/api/` 요청은 바뀌지 않습니다. 페이지들은 계약에서 두 형식이 있는 자기 응답을 얻습니다.
2. 06단계의 [읽기](../../06-api/nexus.ko.md#읽기)는 공간이 없는 프로젝트의 그림 보기가 `picture_not_found`를 보인다고 말하지만, 계약은 그 페이지에 `404` `space_not_found`로 답합니다. 그 문장은 계약을 따르고, 이 단계는 그 코드의 메시지를 확인 지점의 통과(API-128)에도 맞게 씁니다.
3. 06단계의 07·08단계를 위한 메모는 화면마다의 요청을 늘어놓습니다. 단계 현황도 그 정책이 말하듯 API-104에서 그 코드를 불러오고, 제안의 패널은 그림이 더는 늘어놓지 않는 닫히거나 버려진 반영을, 그 PR을 보이려고 API-116으로 읽습니다.
4. 07단계의 08단계를 위한 메모는 폭에 허브 페이지의 언어인 REQ-099를 적었는데, 폭은 REQ-101과 REQ-146입니다. 또 07단계는 06단계의 예시를 설명하며 양식의 예시 화면 ID 둘을 적어, 허브가 그것을 언급했지만 정의하지 않은 것으로 알렸습니다. 이 변경은 두 곳을 바로잡으며, 규칙은 바꾸지 않습니다.

2026-11-07에 다시 디자인의 정의와 함께 그 확인 지점 3을 위해 제안했고, 다시 디자인의 인터페이스가 계획이므로 같은 풀 리퀘스트에서 바꿨습니다:

5. 06단계, API-158: 작업 공간의 단계 목록을 위해 프로젝트의 이름, 저장소, 커밋(`project`)과, 부분의 13단계와 저마다의 상태, 항목 수, 그림, 내 차례의 줄 수(`stages`), 그리고 프로젝트가 그 단계를 읽는지와 그 까닭(`head.reads`)도 답해, 작업 공간이 단계와 함께 그것을 다시 읽게 합니다.
6. 06단계, API-118: 13개 밖의 단계 키는 필드 `stage`의 `400` `invalid_request`이고, 저장된 스냅샷이 담지 않은 부분은 `404` `part_not_found`입니다. 0.2에 있는 코드이므로 계약은 그것을 위해 아무것도 더하지 않고, `item_not_found`와 `not_recommended`만 더합니다.
7. 06단계의 07·08단계를 위한 메모: 단계 페이지는 0.2의 패널처럼, 연 의견, 연 제안, 대화가 더는 늘어놓지 않는 반영을 위해 API-114\~API-116도 읽고, 반영을 버리려고 API-127로 씁니다.
8. 06단계: API-156과 API-158의 낱말 `q`는 200자까지입니다.

2026-11-11의 설계 수정은 이 단계에서 앞 단계에 변경 하나를 더합니다. 정의서의 검사가 찾은 것이고, 바꾸는 꼴이 계획한 꼴이어서 같은 PR에서 고쳤습니다:

9. 06단계, API-119: 계획한 꼴의 `403`이 다른 모든 요청의 `403`처럼 `access_other_app`의 예시도 듭니다. 서버는 다른 Access 애플리케이션이 확인한 어떤 요청에도 이 코드로 답하고 SCR-107과 SCR-114는 답글에 이 코드를 적는데, 만든 꼴의 예시에는 빠져 있습니다. 계획한 꼴을 만드는 작업이 이 예시를 만든 꼴로 옮기며, 달라지는 응답은 없습니다.

SPEC-155와 SPEC-210은 대화 탭과 접힌 대화의 단추가 내 차례의 줄 수를 보이라고 하는데, 만든 탭과 단추는 단계의 열린 줄을 셉니다. 이 단계는 둘 다에 "내 차례 {n}"을 더하고 만든 수는 그대로 두므로, 그 행들은 쓴 대로 섭니다([고른 것 23](#이-단계가-고른-것)).

## 돌린 검사

2026-11-03에 정의서 아홉 개, 이 파일, 그 한국어 번역, 와이어프레임에서:

- 이 단계의 검사, 저장소 밖에 두는 스크립트로: 모든 자료가 그 요청이나 출처를 적음; 모든 동작에 결과와 실패가 있음; 화면이 부르는 요청마다 계약이 늘어놓는 모든 응답, 모두 97개가 어느 상태로 이어지고, 계약이 그 응답에 주는 모든 오류 코드가 그 상태에 적혀 있음; 화면마다 단계의 여섯 상태를 저마다 설명하거나 해당하지 않는 까닭을 적음; 정의서마다 경우의 수 12가지가 차례대로 있고 두 폭의 배치가 있음; 파일이 적는 `SCR-105#stale` 같은 모든 상태가 정의돼 있음; 이 파일이 늘어놓은 상태가 정의서와 같음; 한국어 번역이 영어 파일과 같은 상태, 응답, 코드, 적은 상태를 담음.
- 이 파일들의 모든 링크가 그 앵커까지 맞음. 와이어프레임 안의 화면마다의 자리도 포함.
- 와이어프레임에 상태 45개마다 320과 1440픽셀의 틀이 있고, 정의되지 않은 상태의 틀은 없음. Chromium에서 320, 390, 1,280, 1,440픽셀 폭, 밝은 모드와 어두운 모드, 두 언어로 페이지가 옆으로 밀리지 않고, 틀 밖으로 나간 요소가 없으며, 콘솔에 오류가 없음. 그림으로 본 것: 밝은 모드와 한국어로 두 폭의 `SCR-101#normal`, `SCR-106#error`, `SCR-109#stale`, 그리고 어두운 모드와 한국어로 320픽셀의 `SCR-107#normal`. 나머지 틀은 재기만 하고 보지는 않았음.
- 이 저장소의 허브 스냅샷이 정의서 아홉 개를 SCR-101\~SCR-109의 화면 정의로, 그 상태 45개와 함께 읽고, 점검 결과를 더하지 않음. 변경 4의 수정으로 07단계의 글이 `main`에서 낸 경고 둘도 사라짐.
- 이 파일들을 넣은 저장소의 검사가 통과함: `python -m unittest discover -s tests`, 마켓플레이스와 그 세 플러그인의 `claude plugin validate --strict`, `node --test nexus/test/*.test.js`, `git diff --check`.

2026-11-03에 관리자가 01단계 이벤트 스토밍을 NEXUS에서 하기로 고른 뒤, 같은 스크립트로 다시:

- 이 단계의 검사가 SCR-105의 새 자료, 동작, 말에서 문제를 찾지 않음: 화면 9개, 상태 45개, 응답 97개이고, 한국어 파일도 같은 것을 담음. 스텝별 보기는 상태를 더하지 않음: SCR-105#normal을 보여 주는 한 방법임.
- 와이어프레임은 다시 그리지 않았으므로, SCR-105의 정의서가 적듯 스텝 조절을 그리지 않음. 09단계의 목업이 그것을 그림.
- 저장소의 검사가 통과하고(시험 756개, 건너뜀 12개), 이 저장소의 허브 스냅샷이 항목 1014개를 읽고 점검이 없음.

2026-11-07에 다시 디자인의 확인 지점 3을 위해, SCR-110\~SCR-117의 정의서 여덟 개, 이 파일, [다시 디자인의 말](redesign-words.ko.md), 그 한국어 번역에서:

- 이 단계의 검사, 앞서처럼 저장소 밖에 두는 스크립트로, 다시 디자인의 것을 더해: 정의서마다 다섯 절이 차례대로 있음; 모든 자료가 그 출처를 적음; 모든 동작에 결과와 실패가 있음; 상태마다 그리로 이어지는 응답을 적음; 단계의 여섯 상태를 저마다 정의하거나 해당하지 않는다고 적음; 경우의 수 12가지가 SCR-105의 차례를 따르고, 배치에 폭마다 열이 있음(SCR-111은 셋, SCR-117은 SCR-101의 것을 따름); 이 단계의 파일과 09단계 README가 상태를 적은 589곳이 모두 정의된 상태를 가리킴; 이 파일과 그 번역이 화면마다 늘어놓은 상태가 정의서와 같음; 한국어 번역이 같은 상태, 응답, 코드, 적은 상태를 담음; 계약에 있는 요청에 적은 응답은 모두 그 요청의 응답이고, 화면이 부르는 0.2의 요청 13개에 계약이 늘어놓는 모든 응답이 어느 상태로 이어짐; 적은 오류 코드는 모두 계약의 것이거나 변경 6의 둘임. 정의서 8개, 상태 53개, 문제 없음. 계획된 요청 API-151\~API-159는 계약이 그것을 받을 때 계약과 대조함([11단계](#11단계-개발)).
- 스크립트가 찾은 것: SCR-114가 API-116의 응답을 적지 않았음. 대화는 더는 늘어놓지 않는 반영을 그것으로 읽음(변경 7). 이제 normal, error, permission, gone 상태가 그 응답을 적고, gone 상태는 `edit_not_found`의 메시지 "이 반영은 서버에 없습니다."를 그 제안의 줄에 보여 줌.
- 다시 디자인이 `docs/` 아래에서 바꾸거나 더한 파일 44개의 모든 링크가 그 앵커까지 맞음.
- 09단계의 [redesign.html](../../09-mockup/nexus/redesign.html)이 상태마다 그 폭들에서 그리고, 09단계의 [검사](../../09-mockup/nexus/README.ko.md#돌린-검사)가 적은 대로 재고 봄.
- 핵심 플러그인을 `hub-ref.json`이 고정한 커밋으로 둔 이 저장소의 허브 스냅샷이 정의서 여덟 개를 SCR-110\~SCR-117의 화면 정의로, 그 상태와 함께 읽음: 항목 1,176개, 오류 없음, `main`과 같은 경고 628개이고, 그 어느 것도 SCR-110\~SCR-117을 적지 않음. 계획을 담은 커밋에서 그 여덟 화면에 아직 화면 정의가 없다던 알림은 사라짐.
- 저장소의 검사가 찾은 것: 다시 디자인의 말이 이 파일의 표였을 때, 만든 말이 이 파일과 같은지 보는 보기의 시험이 실패했음. 생성기가 네 칸짜리 표를 모두 읽기 때문임. 그래서 그 말을 생성기가 읽지 않는 [redesign-words.ko.md](redesign-words.ko.md)로 옮김.
- 이 파일들을 넣은 저장소의 검사가 통과함: `python -m unittest discover -s tests`(시험 13개), `node --test nexus/test/*.test.js`(시험 264개), Worker의 `wrangler deploy --dry-run`, `git diff --check`.

2026-11-12, 정의서, 이 파일, [설계 수정의 말](revision-words.ko.md), 회색 와이어프레임, 06단계의 계획한 꼴의 예시 하나를 바꾸고 코드는 바꾸지 않는 2026-11-11의 설계 수정에서:

- 이 단계의 검사, 전처럼 저장소 밖에 두는 스크립트에 설계 수정의 검사를 더해, 정의서 18개와 그 상태 109개에서: 정의서마다 절이 차례대로 있고 SCR-110\~SCR-115에서는 설계 수정의 절이 마지막임; 설계 수정이 손대는 화면 일곱 개에서 자료 67개가 저마다 어디서 오는지 적고, 조작 78개에 저마다 결과와 실패가 있으며, 구역 53개에 저마다 그 화면의 모든 폭이 있음; 그 화면들이 부르는 요청에 계약이 적은 응답이 만든 꼴과 계획한 꼴을 합쳐 238개인데 모두 상태로 이어지고, 계약이 그 응답에 주는 코드 438개가 어느 화면도 보이지 않는 코드를 빼고 모두 제 응답과 함께 적힘; 이 단계의 여섯 상태가 저마다 정의되거나 해당하지 않는다고 적힘; 사례의 종류 12가지가 차례대로 있고 설계 수정의 행은 그 가운데 종류임; 파일이 적는 상태가 모두 정의됨(이 단계의 파일에 109개, 다른 단계의 문서에 49개); 이 파일이 화면마다 늘어놓는 상태가 정의서와 같음; 한국어판이 줄마다 같은 ID, 코드, 상태 표시를 지님; 설계 수정의 말은 27행 91개로, 저마다 한국어 꼴과 같은 중괄호 이름이 있고, 말 생성기가 읽을 네 칸짜리 행이 없음; 설계 수정의 상태 행 28개마다 와이어프레임에 두 폭의 틀이 있고 다른 것의 틀은 없음. 남은 문제는 없음.
- 스크립트가 찾은 것: SCR-114가 제 요청의 코드 넷을 어디에도 적지 않았음. API-119의 `403`에서 `user_only`, API-120의 `404`에서 `project_not_found`와 `space_not_found`, API-124와 API-125의 `404`에서 `project_not_found`. 이제 SCR-114#permission, SCR-114#error, SCR-114#gone이 이들을 적으며, 화면의 말은 바뀌지 않음. 계약의 API-119 `403` 예시에는 SCR-107과 SCR-114가 적는 `access_other_app`이 빠져 있었음([변경 9](#앞-단계의-변경)). 그리고 계약의 예시가 주지 않는 자리에 적힌 코드가 넷 있는데, 다시 디자인이 쓴 행이어서 그대로 둠: SCR-111에서 API-153의 `404`, SCR-115에서 API-157의 `404`와 함께 적힌 `not_found`(서버가 꼴이 맞지 않는 경로에 주는 답), 그리고 SCR-112와 SCR-113에서 API-158의 `404`와 함께 적힌 `space_not_found`(그 요청은 이 코드로 답하지 않음).
- 검토 지도를 포함해 이 단계가 바꾼 문서 18쌍의 링크 808개가 닻까지 모두 맞고, 바뀌거나 새로 생긴 536줄이 저마다 그 번역과 ID, 코드, 링크가 같음; 와이어프레임으로 가는 링크 26개가 모두 그 페이지의 닻에 닿음; 정의서가 따옴표로 적은 말이 예시인 "Safari, 휴대폰"을 빼고 모두 말 표에 있음.
- 저장소 밖에 두는 스크립트로 만든 와이어프레임 [revision-wireframes.html](revision-wireframes.html)에는 상태 행 28개의 틀 64개가 있고, 행마다 390픽셀과 1,440픽셀의 틀이 있으며, 틀 속의 말은 말 표의 말 205개이고 날짜, 수, 커밋, 이름은 예시임. Chromium에서 두 언어로 잰 128번에서 틀 밖으로 나가는 요소가 없고, 1,440픽셀에서 SCR-130의 패널 뒤에서 기다리는 페이지를 빼고는 잘린 열이 없으며, 제 단추, 꼬리표, 탭보다 넓은 말이 없음; 폭 320, 390, 1,280, 1,440픽셀, 밝은 모드와 어두운 모드, 두 언어에서 페이지가 옆으로 스크롤되지 않고, 틀 밖으로 나가는 요소가 없고, 콘솔에 오류가 없음. 그림으로 본 것: 틀 64개를 저마다 영어나 한국어로 한 번 이상, 그리고 어두운 모드로 390픽셀의 `SCR-110#normal`, `SCR-110#error`, `SCR-130#removal`, 두 폭의 `SCR-111#normal`, 1,440픽셀의 `SCR-112#normal`. 보면서 찾은 것은 틀에서 고치고 다시 쟀음: 잘린 열, 한국어 390픽셀에서 눌린 찾기 칸, 낱말 안에서 끊긴 한국어, 서로 맞지 않던 예시 자료. 또 1,024픽셀 아래에서는 다른 커밋 때문에 통과가 거절된 뒤 다시 불러오기를 내놓는 막대를 기록의 시트가 가린다는 것을 찾아, 거절에 다시 불러오기를 따로 두었음(SCR-112#stale). 행이 말하는 경우 가운데 셋은 정의서에만 있고 틀에는 없음: 20개에서 잘린 지우기 목록 옆의 "{total}개 중 {n}개", `SCR-130#stale`의 둘째 경우(패널이 열려 있는 동안 새로 올라온 것), 그리고 단추 위에 뜨는 지우기 자신의 오류.
- `hub-ref.json`이 고정한 커밋의 허브가 이 저장소의 스냅샷에서 정의서 18개를 상태 109개와 함께 읽고, SCR-130은 상태 아홉 개와 함께 읽음: 항목 1442개, 오류 0개, 경고 600개로 07단계 뒤와 같고, SCR-130에 상태가 없다던 안내는 사라짐.
- 저장소의 검사가 통과함: 고정한 허브로 `python -m unittest discover -s tests`(시험 13개), `node --test nexus/test/*.test.js`(시험 337개, 컨테이너에 Node 24가 없어 Node 22에서), Worker의 dry-run 빌드, `git diff --check`. 바뀐 예시에 대한 06단계의 검사는 [그 파일](../../06-api/nexus.ko.md#돌린-검사)에 있음.

2026-11-12에 다시, 09단계가 [그림 단계의 네 보기](../../09-mockup/nexus/picture-stage-views.html)를 그린 한 장이 이 단계의 행 셋, 곧 도구 줄, 스텝 고르기의 줄, 처음 열 때의 열을 정리한 뒤, 같은 스크립트로:

- 이 단계의 검사가 문제를 찾지 않음: 정의서 18개와 상태 109개. 설계 수정이 손대는 화면 일곱 개에서 자료 67개, 조작 78개, 구역 55개이며, 구역은 SCR-112의 설계 수정 배치에 든 도구와 스텝 고르기로 앞보다 둘 늘었음. 응답 238개와 코드 438개는 앞과 같음.
- 회색 와이어프레임을 다시 그렸고 두 가지가 바뀜: `SCR-115#normal` 아래 1,440픽셀의 목록 보기 틀이 그림의 도구를 그렸는데 이제 그림과 목록, 그리고 단계 기록만 있음. `SCR-111#loading`의 설명은 바뀐 행을 따름. 페이지는 틀 64개와 말 205개 그대로임. Chromium에서 128번 재고 네 폭에서 16번 돌려 문제가 없고, 바뀐 틀을 영어와 한국어로 봄.
- 바뀐 문서의 링크와 줄마다의 대조, 허브 스냅샷, 저장소의 검사는 [09단계의 검사](../../09-mockup/nexus/README.ko.md#돌린-검사)에 있음.

2026-11-12, TASK-282에서, 이 단계의 검사가 저장소의 것이 되어 바뀔 때마다 돕니다: 파이썬 표준 라이브러리로 도는 [test_screen_states.py](../../../tests/test_screen_states.py)와, `nexus-contracts` 작업의 고정한 환경에서 도는 [screen_states_check.py](../../../nexus/test/screen_states_check.py)이며, 둘은 정의서를 같은 방법으로 읽습니다:

- 검사하는 것: 이 단계의 문서마다 한국어판과 줄마다 같은 상태 이름, 응답, 진행을 지님; 상태 행마다 제 화면의 상태를 적고, 저장소의 파일이 적는 상태가 모두 정의됨(정의서 18개의 109개); 이 파일의 화면 목록이 두 언어로 정의서마다 그 상태를 늘어놓음; SCR-110\~SCR-115와 SCR-130에서 설계 수정의 줄이 따옴표로 적은 말 145개가 "Safari, 휴대폰"을 빼고 모두 말 표에 있음; 설계 수정의 상태 행 28개마다 회색 페이지에 틀이 있어 모두 64개이고, 390픽셀과 1,440픽셀의 수가 같으며, 다른 상태의 틀은 없음; 페이지마다, 그 화면들의 조작과 상태가 적는 요청에 계약이 적은 응답이 만든 꼴과, 설계 수정의 페이지에서는 계획한 꼴까지 합쳐 300개인데 모두 그 페이지의 상태로 이어지고, 그 예시가 주는 코드 543개가 어느 화면도 보이지 않는 코드 18개를 빼고 모두 제 응답과 함께 적힘; 예시가 주지 않는 코드를 적은, 설계 수정의 검사가 찾은 네 자리는 알려진 목록임. 저장소의 링크 검사는 이제 페이지의 닻도 찾아, 회색 페이지, 와이어프레임, 09단계의 페이지로 가는 링크 68개를 확인함.
- 찾은 것: SCR-110이 제 핵심 파일의 실패, 곧 API-104의 `403`, `404`, `default`를 적지 않았는데, 정의서는 그때 페이지가 SCR-110#loading이 그린 대로 규칙 15의 막대와 함께 남는다고 말함; 이제 SCR-110#loading이 이들을 적음. SCR-106#error가 API-118의 `404`와 함께 `picture_not_found`를 적었는데, 의견이 어느 단계에나 달리게 된 뒤(2026-11-08) 서버는 그 경우 `part_not_found`로 답함; 이제 행이 `part_not_found`를 적음. 둘 다 화면의 말은 바꾸지 않음.
- 보았으나 바꾸지 않은 것: SCR-110의 자료가 0.2의 주소를 위해 API-157을 적지만, 페이지의 어느 상태도 그 응답을 적지 않음; 검사는 화면의 요청을 조작과 상태에서 읽으므로, 이것은 그 주소에 답하는 TASK-278에 남김. 설계 수정의 줄 밖에서 정의서가 따옴표로 적은 글 291개 가운데 68개, 서로 다른 것으로 58개가 말 표에 없음: 39개는 보기가 이미 `nexus/ui`와 허브 페이지에 지닌 말이고, 나머지는 자료의 예시, 값이 채워진 메시지, 그리고 다시 디자인을 만들 때 더할 그 행의 말 몇 개임(SCR-114의 "단계 전체" 같은 것). 말의 검사는 이 단계의 검사처럼 설계 수정의 줄을 봄.
- 검사마다 하나씩 일부러 낸 고장 열 개가 모두 검사에 걸림. 저장소의 검사가 통과함: 고정한 허브로 `python -m unittest discover -s tests`(시험 33개), `node --test nexus/test/*.test.js`(시험 339개, Node 24), Worker의 dry-run 빌드, `git diff --check`.

2026-11-12, TASK-285에서, 회색 페이지 둘, 곧 이 단계의 [revision-wireframes.html](revision-wireframes.html)과 09단계의 [picture-stage-views.html](../../09-mockup/nexus/picture-stage-views.html)의 생성기가 브라우저에서 페이지를 재는 도구와 함께 [tools/grey_pages](../../../tools/grey_pages/README.ko.md)로 저장소에 들어왔습니다:

- [test_grey_pages.py](../../../tests/test_grey_pages.py)가 파이썬 표준 라이브러리로 두 페이지를 다시 그려 커밋한 파일과 바이트까지 대조하고(1,009,966바이트와 240,461바이트), 생성기에서 저장소 밖의 경로를 찾지 않음. Python 3.8과 3.13으로 그린 페이지가 같은 바이트임. 일부러 낸 고장 넷이 모두 걸림: 틀이 더는 찾지 못하게 바꾼 [revision-words.md](revision-words.ko.md)의 말, 바꾼 [redesign-words.md](redesign-words.ko.md)의 한국어 말, 손으로 고친 페이지, 생성기 안의 비공개 경로.
- 손으로 headless Chromium에서 돌린 [measure.mjs](../../../tools/grey_pages/measure.mjs): revision-wireframes.html은 네 폭에서 16번 돌리고 틀을 128번 재고, picture-stage-views.html은 16번 돌리고 32번 재어 문제가 없음. 옆으로 스크롤되는 페이지, 콘솔 오류, 제 말보다 좁은 단추, 열에 잘린 글은 저마다 찾아짐. 이것은 커밋한 페이지를 잰 것이며, 바뀐 틀이 없으므로 다시 눈으로 보지는 않음.
- 보았으나 바꾸지 않은 것: "No comments on {id} yet."의 한국어 꼴이 둘임. [redesign-words.md](redesign-words.ko.md)의 SCR-114#empty 행에는 "{id}에 아직 의견이 없습니다.", 이 파일의 SCR-106 행에는 "{id}에는 아직 의견이 없습니다."로 적힘. 어느 회색 페이지도 이 말을 그리지 않고, 이제 생성기가 돌 때마다 이것을 적음. 대화의 말을 만드는 TASK-276에 남김.
- 저장소의 검사가 통과함: 고정한 허브로 `python -m unittest discover -s tests`(시험 35개), `node --test nexus/test/*.test.js`(시험 339개, Node 24), Worker의 dry-run 빌드, `git diff --check`.

2026-11-13, 대화를 만드는 TASK-276에서, SCR-114의 절들은 만든 대로 대화가 하는 일을 말하고, 설계 수정은 회색 페이지가 그리는 그 행들을 남기되 어느 것을 만들었는지 진행으로 말합니다:

- 말: [redesign-words.md](redesign-words.ko.md)에 대화의 새 행 셋이 있음. 둘은 [revision-words.md](revision-words.ko.md)에서 옮긴 `checkpoint_requested`와 대화가 고르는 항목이고, 하나는 새로 더한 대화의 줄임. "No comments on {id} yet."의 한국어 꼴은 이제 SCR-106이 보이는 "{id}에는 아직 의견이 없습니다." 하나이며, 위에서 TASK-285가 본 것을 정리함.
- 회색 와이어프레임은 SCR-114의 행 셋의 진행 때문에 다시 그림. 바뀐 틀은 없고, 페이지는 틀 64개와 라벨 205개를 그대로 지님.
- 저장소의 검사가 통과함: 고정한 허브로 `python -m unittest discover -s tests`(테스트 39개), `node --test nexus/test/*.test.js`(테스트 360개, Node 24), Worker의 dry-run 빌드, `git diff --check`.

2026-11-13, 0.2의 그림 보기와 단계 현황을 단계 페이지로 이끄는 TASK-278에서:

- 0.2의 화면: SCR-105부터 SCR-109까지는 `removed`이고, 그 정의서는 0.2가 보인 것의 기록으로 남으며, 저마다 그 주소가 어디로 이어지는지 말하는 줄을 지님. SCR-111#loading, SCR-111#error, SCR-111#permission은 단계 페이지로 이끄는 `302`를 비롯해 API-102와 API-103의 응답을 적고, [screen_states_check.py](../../../nexus/test/screen_states_check.py)는 이 다섯 기록을 더는 계약에 대어 읽지 않음.
- SCR-112와 SCR-113의 설계 수정은 무엇을 만들었는지 말함. SCR-112에서는 대화의 줄이 고르는 항목, 편집 없는 머리, 항목에 달린 대화의 줄 고르기가 `built`이고, SCR-112#normal은 머리와 대화가 고르는 항목에 대해 `built in part`임. SCR-113에서는 그 항목과 고르기가 `built`이고, SCR-113#normal은 `built in part`임. 진행마다 코드와, 그것을 돌린 케이스 TC-1492부터 TC-1495까지, TC-1803, TC-1819에서 정함. 기록 안의 열린 요청, 브라우저와 기기의 종류, 사용자가 본 것에 묶인 통과는 `planned`로 남음. 위의 SCR-112의 절들은 TASK-275가 바꾼 것을 말함: 머리에는 편집이 보이지 않고, `view=edit`나 `view=board`인 주소는 그림을 보임.
- 표시의 범례: SCR-112의 한국어 사본은 두 곳에서, 9단계의 README는 한 곳에서 이것을 "표시의 설명"이라 불렀고, 서버가 내주는 페이지와 [redesign-words.md](redesign-words.ko.md)는 "표시 범례"라 함. 이제 세 곳 모두 "표시 범례"라 함. [목업이 더한 말](#목업이-더한-말)의 SCR-105 행은 그 화면의 기록으로서 0.2가 보인 말 "표시의 설명"을 지니므로, 회색 페이지의 생성기는 여전히 두 꼴을 적고, 어느 페이지도 이 말을 그리지 않음. SCR-101의 단계 표시의 설명은 허브의 말로 된 다른 것임.
- SCR-110, 위에서 TASK-282가 본 것: 그 데이터는 0.2의 `#p={project}&id={id}`에 API-157을 적었으나, 어느 상태도 그 응답을 적지 않았음. 이제 SCR-110#normal이 그것을 적음: API-157#200이면 페이지는 그 단계의 항목으로 이어지고, 다른 응답이면 코드가 하는 대로 그 ID로 찾기를 엶. 데이터 행도 이제 서버가 찾지 못한 ID만이 아니라 API-157의 어떤 실패든 찾기를 연다고 말함. 화면이 보이는 말은 바뀌지 않음.
- 단계의 검사: [test_screen_states.py](../../../tests/test_screen_states.py)가 통과하고, [screen_states_check.py](../../../nexus/test/screen_states_check.py)는 페이지 5개의 정의서 13개와 기록 5개를 읽음: 응답 223개가 저마다 상태로 이어지고 코드는 405개이며, SCR-110의 API-157 몫인 응답 다섯과 코드 아홉이 전보다 많음.
- 회색 와이어프레임은 SCR-112#normal과 SCR-113#normal의 진행 때문에 다시 그림. 그 설명만 바뀌었고, 페이지는 틀 64개와 라벨 205개를 그대로 지니며 이제 1,010,247바이트임. [measure.mjs](../../../tools/grey_pages/measure.mjs)는 16번 돌리고 틀을 128번 재어 문제를 찾지 못함.
- 저장소의 검사가 통과함: 고정한 허브로 `python -m unittest discover -s tests`(테스트 39개), `node --test nexus/test/*.test.js`(테스트 368개, Node 24), Worker의 dry-run 빌드, `git diff --check`.

2026-11-13, 작업 공간의 열을 접는 TASK-287에서, SCR-111의 절들은 만든 대로 접기를 말하고, 설계 수정은 회색 페이지가 그리는 행들을 남기되 어느 것을 만들었는지 진행으로 말합니다:

- SCR-111의 설계 수정: 데이터 행 둘, 곧 접은 것과 사용자를 기다리는 줄 수, 그리고 조작 셋, 곧 단계 목록 접기, 대화 접기, 대화를 접은 채 항목이나 줄이 보이는 오른쪽 열이 `built (TASK-287)`임. SCR-111#loading, SCR-111#normal, SCR-111#folded는 접기에 대해서만 `built in part (TASK-287)`임. 띠에도 보이는 머리의 두 때와 오래 기다린다는 표시는 TASK-298을 위해, 프로젝트 자료는 TASK-312를 위해 `planned`로 남음. 진행마다 코드와, 그것을 돌린 케이스 TC-1496부터 TC-1499까지, TC-1712, TC-1720부터 TC-1722까지, TC-1769, TC-1778에서 정함.
- 위의 SCR-111의 절들: SCR-111#folded가 작업 공간 자신의 상태에 더해짐. 조작은 두 접기 단추, 누르면 하는 일, 포커스가 가는 곳을 적음. 단계 기록도 항목처럼 접힌 대화의 열을 보임. 배치는 1,024, 1,280, 1,440픽셀에서 목록, 띠, 대화 옆의 단계 너비를 적음. "내 차례 {n}"이 "대화 ({n})"와 대화 탭에 보임. TASK-276이 대화를 만들기 전까지 패널이 비어 열린다던 구절은, TASK-276이 그것을 만들었으므로 지움.
- SCR-112, SCR-113, SCR-114는 그 배치에서 접기가 어디 보이는지 말함: 대화를 접은 동안 그림과 목록의 머리에 "내 차례 {n}"과 함께 보이는 "대화 ({n})", 그리고 1,280픽셀부터 대화 머리 끝의 "대화 접기".
- 말: 두 접기 단추의 이름은 프로젝트 자료를 남긴 [revision-words.md](revision-words.ko.md)의 작업 공간 머리 행을 떠나, 보기의 말을 만드는 [redesign-words.md](redesign-words.ko.md)의 제 행 "접기"로 옮김.
- 회색 와이어프레임은 SCR-111의 상태 행 셋의 진행 때문에 다시 그림. 그 설명만 바뀌었고, 페이지는 틀 64개와 라벨 205개를 그대로 지니며 이제 1,010,349바이트임. [measure.mjs](../../../tools/grey_pages/measure.mjs)는 16번 돌리고 틀을 128번 재어 문제를 찾지 못함.
- 단계의 검사: [test_screen_states.py](../../../tests/test_screen_states.py)가 통과하고, [screen_states_check.py](../../../nexus/test/screen_states_check.py)는 TASK-278 뒤와 같이 페이지 5개의 정의서 13개와 기록 5개를 읽음: 응답 223개와 코드 405개이며, 접기는 요청을 부르지 않음.
- 저장소의 검사가 통과함: 고정한 허브로 `python -m unittest discover -s tests`(테스트 39개), `node --test nexus/test/*.test.js`(테스트 376개, Node 24), Worker의 dry-run 빌드, `git diff --check`.

## 확인할 것

2026-11-11의 설계 수정은 2026-11-12에 관리자 자신의 말로 확인 지점을 통과했습니다([검토 지도](../../reviews/2026-11-11-design-review.ko.md)). 이 단계가 거기에 내는 것을, 관리자에게 달라지는 일 하나에 한 줄씩 적습니다:

1. 첫 화면과 작업 공간의 머리가 프로젝트마다 마지막으로 올린 때와 AI가 마지막으로 읽은 때를 얼마나 지났는지와 함께 보이고, 무엇인가 24시간 넘게 읽히지 않은 채 기다리면 표시를 붙입니다.
2. 확인 요청은 첫 화면에서 통째로 보이고 첫째 단추가 열기입니다. 통과는 커밋과 요청을 적고, 둘 중 하나가 바뀌었으면 거절됩니다. 2026-11-12에 추천대로 정해진 D17을 따릅니다.
3. 프로젝트마다 그 자료의 페이지가 생깁니다: 서버에만 있고 Git에는 없는 것, 파일 하나로 받는 내보내기, 프로젝트의 이름을 묻는 지우기.
4. 1,024픽셀부터 단계 목록과 대화가 저마다 따로 접혀, 그림이나 목록이 그 너비를 얻습니다. 처음 열 때 대화는 세 열이 단계에 632픽셀까지만 남기는 1,280\~1,439픽셀에서 접힌 채 시작하고, 1,440픽셀부터 열입니다.
5. 대화에서 의견을 열면 그 항목이 그림이나 목록에 보이고, 뒤로 단추가 그 의견으로 돌아옵니다.
6. "편집"은 편집이 릴리스될 때까지 보이지 않습니다.
7. `/`에 있던 허브 페이지의 옛 화면은 없앤 것으로 표시되고, "전체 점검"이 서버와 기기의 허브 페이지를 가리킵니다.

먼저 볼 것: 회색 와이어프레임 [revision-wireframes.html](revision-wireframes.html)의 390픽셀 틀에 있는 `SCR-110#normal`.

다시 디자인의 확인 지점 3은 09단계의 상태, 토큰과 함께 2026-11-08 14:54(KST)에 통과했습니다([09단계](../../09-mockup/nexus/README.ko.md#확인할-것)): 관리자가 프로젝트 스레드의 결정 카드에서, 확인 지점 3의 상태 그림과 토큰 값을 이대로 확정할지 묻는 물음에 그린 대로 확정을 골랐습니다(‘그린 대로 확정 (추천)’). SCR-110\~SCR-117의 상태는 정의서가 쓰고 09단계가 그린 대로입니다. 이 단계가 이 확인 지점에 낸 점:

1. 정의서가 적고 09단계의 [redesign.html](../../09-mockup/nexus/redesign.html)이 그린 대로의 SCR-110\~SCR-117 상태 53개.
2. [다시 디자인의 화면](#다시-디자인의-화면)의 규칙 13\~18과 고른 것 13\~19.
3. 계약이 계획된 요청과 함께 받을, 06단계의 변경 5\~8.
4. [redesign-words.ko.md](redesign-words.ko.md)에 있는, 영어와 한국어로 된 다시 디자인의 말.

2026-11-03 관리자가 고른 01단계 이벤트 스토밍을 NEXUS에서 하는 것은 그것이 다른 단계에 낸 변경과 함께 같은 날 16:54(KST)에 통과했습니다: 관리자가 프로젝트 스레드의 결정 카드에서 스텝별 보기와 작업 보드를 그린 대로 통과시켰습니다(‘모두 그린 대로 통과’). 확인 지점이 다룬 것: DDD 보드에서 SCR-105의 스텝 고르기, 타임라인이 없는 보드의 안내와 그 말, 그리고 그 상태가 그 차례와 함께 오는 ② 차례의 워크숍. 와이어프레임은 스텝 고르기보다 먼저 그렸고, 09단계의 목업이 그것을 그립니다.

2026-11-03 11:39(KST)에 03\~07단계와 함께 통과했습니다: 관리자가 프로젝트 스레드의 결정 카드에서 모든 추천을 골라(‘모두 추천대로’), 화면의 상태와 메시지의 문구가 그리고 쓴 대로 섭니다. 확인 지점이 다룬 것:

1. HTML로 된 페이지의 거절(변경 1). 계약의 세 페이지를 바꿉니다.
2. 그림 보기의 상태, 특히 `large`, `code-failed`, 그리고 그리지 않고 권하는 새 판(고른 것 2와 6), 그림 옆이나 아래의 패널(고른 것 3), 그리고 ID 없는 부분의 패널(고른 것 12).
3. 영어와 한국어로 된 메시지의 최종 문구.
4. 휴대폰처럼 320픽셀에서 본 와이어프레임.

## 다음 단계를 위한 메모

### 09단계: 목업

- 2026-11-11의 설계 수정에서: 이 단계의 확인 지점 뒤에, 설계 수정의 상태를 다시 디자인의 모습으로 390과 1,440픽셀에서 두 테마와 두 언어로 그립니다: 새 상태 11개, 곧 SCR-130의 아홉과 `SCR-110#removed`, `SCR-111#folded`, 그리고 [revision-wireframes.html](revision-wireframes.html)이 회색으로 그린 바뀐 상태. 그림 단계를 연 작업 공간을 1,280과 1,440픽셀에서 열을 편 것과 접은 것으로, 1,152에서는 목록을 접은 것으로. "내 차례 {n}"이 붙은 대화 탭과 접힌 대화의 단추. 굳힌 토큰, 띠나 오래 기다린다는 표시에 토큰이 더 필요하면 먼저 묻습니다. 그리고 네 보기가 든 그림 단계의 열을 그린 07단계의 회색 한 장([선택 18](../../07-sitemap/nexus.ko.md#이-단계가-고른-것)).
- 다시 디자인을 위해: [redesign.html](../../09-mockup/nexus/redesign.html)이 SCR-110\~SCR-117의 모든 상태를 확인 지점 2의 모습으로 390과 1,440픽셀에서, SCR-111은 1,152에서도, 두 테마와 두 언어로 그립니다. 그 확인 지점 3이 2026-11-08에 그것이 쓰는 토큰을 굳혔습니다.
- 새 화면 SCR-105\~SCR-109마다 후보 둘, 휴대폰을 먼저, 320픽셀에서, 이 틀에서 시작합니다. 상태마다 디자인할 틀입니다. 허브 페이지는 1차의 디자인을 그대로 두고 SCR-101과 SCR-104에 0.2가 더하는 것을 더합니다.
- 그림의 항목 위의 표시와 "받음, 아직 반영 전"은 꽉 찬 DDD 보드 위에서도 두 테마에서도 읽히는 꼴과, 손가락으로 고를 수 있는 크기가 필요합니다.
- DDD 보드의 스텝 고르기를 두 폭에서, 그리고 타임라인이 없는 보드의 안내(SPEC-141).

### 10단계: 작업 분해

- 2026-11-11의 설계 수정에서: SCR-130을 만드는 작업, API-177, API-178, API-108과 지운 뒤 첫 화면의 막대와 함께. SCR-110, SCR-111, SCR-114의 두 때와 표시를 만드는 작업. D17에 따라, SCR-110과 단계 기록에서 통째로 보이는 요청과 사용자가 본 것을 적는 통과를 만드는 작업. 접기를 만드는 작업, 대화 탭과 접힌 대화의 단추의 "내 차례 {n}"과 함께. 대화의 고르기는 설계 수정의 확인 지점이 통과했으므로 TASK-275\~TASK-277이 저마다 자기 화면의 행과 함께 맡습니다. 그리고 머리에서 "편집"을 빼는 일. 작업마다 자기가 만드는 행을 정의의 마지막 절에서 그 앞의 절로, 그 말을 [revision-words.ko.md](revision-words.ko.md)에서 [redesign-words.ko.md](redesign-words.ko.md)로 같은 변경에서 옮기고, 물러나는 말은 그때 빠집니다([설계 수정이 계획한 말](#설계-수정이-계획한-말)). 지금까지 저장소 밖의 스크립트가 돌리던 이 단계의 검사는 저장소 안의 시험이 지킵니다.
- 다시 디자인을 위해: 서버가 코드보다 먼저 그리는 페이지(규칙 15), 작업 공간의 세 폭(규칙 16), 그리고 API-151\~API-159와 함께 오는 계획된 요청의 상태.
- 변경 1의 메시지 페이지는 서버의 페이지와 함께, 보기의 상태는 보기와 함께, 허브 페이지의 0.2 상태는 [hub.html](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex-nexus/skills/corthex-hub/assets/hub.html)에서 하며, 그 파일을 [nexus/src/hub.html](../../../nexus/src/hub.html)이 복사합니다.

### 11단계: 개발

- 2026-11-11의 설계 수정에서: 서버는 두 때, 얼마나 지났는지, 표시를 페이지를 내줄 때의 모습으로 코드가 지키는 자리에 그리고, 코드는 페이지가 다시 보일 때 그것을 다시 알아냅니다(규칙 19와 20). 지우기에 입력한 이름은 페이지를 떠나지 않고, 그 칸은 자동 대문자, 고침, 추천을 묻지 않습니다. 먼저 볼 것인 주소는 `rel="noopener noreferrer"`와 `target="_blank"`를 단 링크이며, 불러오지도 미리 불러오지도 미리 보이지도 않습니다(규칙 22). 접기는 보기의 코드가 돌자마자 한 번에 적용하며, 첫 화면의 지닌 순서와 같습니다. 그리고 내보내기는 통째로 받은 뒤에 브라우저에 넘깁니다.
- 다시 디자인을 위해: 계약이 API-151\~API-159를 받으면 상태마다 계약의 목에 맞춰 만들고, 그때 이 파일의 응답을 그것에 맞춰 확인합니다. 서버의 첫 그림과 보기의 코드는 배치 하나를 함께 써서 코드가 돌 때 아무것도 움직이지 않게 합니다. 규칙 14의 누르는 자리는 가정하지 않고 잽니다. 보기의 말도 그것을 쓰는 화면을 만들 때 [redesign-words.ko.md](redesign-words.ko.md)에서 만듭니다.
- 서버가 준비되기 전에, 계약이 늘어놓는 어느 응답이든 요청하면 돌려주는 Prism의 목에 맞춰 상태마다 만듭니다.
- 보기의 요청: `redirect: "manual"`, 30초 뒤의 중단, 브라우저 저장소에 글과 함께 두는 쓰기 ID, 그리고 끝난 로그인으로 읽는 `opaqueredirect` 응답.
- 보기마다 HTML에 둔 고정 문구는 핵심 파일이 돌면 숨기고, 편집기는 따로 불러와 그 실패가 항목 목록을 남기게 합니다.
- 테스트는 패널마다 그 주소에서 열고, 상태마다 그 응답에서 이끌어 내며, 다시 불러온 뒤 보내지 않은 글을 되돌립니다.

### 12단계: QA

- 2026-11-11의 설계 수정에서: 새 상태 11개마다, 그리고 바뀐 상태의 행마다 케이스 하나를 390과 1,440픽셀에서 두 테마와 두 언어로 두고, 작업 공간은 1,152와 1,280픽셀에서도 접기마다 둡니다. 그 단계의 브라우저 에이전트가 만든 자료로 FL-113, FL-114, FL-117\~FL-119, FL-127을 걸어 봅니다. 손으로, 또는 두 번째 세션으로: 새로 올라온 뒤의 통과와 AI의 더 새 요청 뒤의 통과, 둘 다 쓴 말을 남긴 채 거절됨. 대소문자만 다른 이름의 지우기, 단추는 꺼진 채. 지운 뒤 첫 화면의 막대, 한 번만이고 다시 불러온 뒤에는 없음. 다시 불러온 접힌 작업 공간. 대화에서 연 의견과 뒤로 단추. 그리고 누를 때만 페이지가 요청하는 먼저 볼 것인 주소, 브라우저의 네트워크 기록이 그것을 보입니다.
- 다시 디자인을 위해: 상태 53개마다 케이스 하나를 390과 1,440픽셀에서, SCR-111은 1,152에서도, 두 테마와 두 언어로 두고, 그 단계의 브라우저 에이전트가 FL-117\~FL-119로 걸어 봅니다. 0.2의 모든 주소를 열어 어디로 이어지는지 보고, 코드를 불러오지 못한 페이지와, 390픽셀에서 잰 누르는 자리.
- `SCR-105#large` 같은 상태마다 테스트 케이스 하나를 320과 1440픽셀에서 두고, 그 단계의 브라우저 에이전트가 먼저 목의 응답으로, 그다음 Access 뒤의 개발 서버에서 걸어 봅니다.
- 손으로: 열린 보기에서 끝나는 로그인, 잃어버린 답, 의견을 닫는 두 번째 탭, 30초 넘게 기다리는 요청.
