# NEXUS: 다시 디자인의 말

[English](redesign-words.md)

다시 디자인의 정의 SCR-110\~SCR-117에 필요한 말이며, 2026-11-07에 그 확인 지점 3을 위해 초안을 썼습니다. `·` 사이의 말은 저마다 따로 쓰는 이름표이고, 한국어에서 AI 에이전트는 AI입니다([고른 것 17](README.ko.md#이-단계가-고른-것)). 0.2에 이미 있는 코드와 상태에는 화면이 08단계의 [메시지](README.ko.md#메시지)를 그대로 씁니다. 다시 디자인을 만들면서부터 `nexus/tools/messages.mjs`는 [README.md](README.md)의 표를 0.2의 말로 바꾸듯 이 파일의 영어판 표도 다시 디자인한 보기의 말로 바꾸고([다시 디자인이 더한 말](README.ko.md#다시-디자인이-더한-말)), 줄마다 영어와 한국어가 같은 수의 이름표와 같은 중괄호 값을 갖는지 확인합니다. 그래서 두 말 칸에는 말만 두고, 줄의 뜻이나 말이 어디서 왔는지는 나오는 곳 칸에 둡니다. 이 파일과 영어 파일이 다르면 영어 파일이 원본입니다.

| 말 | 나오는 곳 | 영어 | 한국어 |
| --- | --- | --- | --- |
| 위 막대 | SCR-110\~SCR-116(규칙 17) | NEXUS · All projects · Search · Full checks · Menu · Close | NEXUS · 모든 프로젝트 · 찾기 · 전체 점검 · 메뉴 · 닫기 |
| 찾기 안내 | SCR-116 | Find by ID or words · e.g. REQ-107 | ID나 낱말로 찾기 · 예: REQ-107 |
| 내 차례 | SCR-110 | My turn ({n}) · What the agent asked or proposed and waits for your answer | 내 차례 ({n}) · AI가 묻거나 제안해서 내 답을 기다리는 것 |
| 줄의 종류 | SCR-110, SCR-114 | Proposal · Question · Recommendation · Checkpoint | 제안 · 질문 · 추천 · 확인 지점 |
| 줄의 자리 | SCR-110, SCR-114 | the stage as a whole | 단계 전체 |
| 쓴 이와 때 | SCR-110, SCR-114, SCR-115(규칙 11) | Agent · {time} · User · {time} | AI · {time} · 사용자 · {time} |
| 답 | SCR-110, SCR-114 | Accept · Dismiss · As recommended · Pass as recommended · Reply · Open | 받기 · 버리기 · 추천대로 · 추천대로 통과 · 답하기 · 열기 |
| 답함 | SCR-110([고른 것 19](README.ko.md#이-단계가-고른-것)) | Accepted · Dismissed · Answered as recommended · Checkpoint passed. You can withdraw it in the stage record until it is recorded. | 받음 · 버림 · 추천대로 답함 · 확인 지점을 통과시켰습니다. 기록되기 전까지는 단계 기록에서 철회할 수 있습니다. |
| 차례 | SCR-110(규칙 18) | When you answer, it becomes the agent's turn. The agent reads it at its next work on the project. | 답하면 AI 차례가 됩니다. AI는 그 프로젝트의 다음 작업 때 읽습니다. |
| AI 할 일 | SCR-110(규칙 18) | Agent to-do ({n}) · Comments that wait for the agent · Open discrepancies · Pending reflections · Checkpoints that wait for their records · {n} taken by a session · The agent reads these when its work on the project next starts. The NEXUS server runs no AI. | AI 할 일 ({n}) · AI를 기다리는 의견 · 열린 어긋남 · 반영 대기 · 기록을 기다리는 확인 지점 · 세션이 맡은 것 {n} · AI는 그 프로젝트의 다음 작업을 시작할 때 이것을 읽습니다. NEXUS 서버는 AI를 돌리지 않습니다. |
| 기다리는 것 없음 | SCR-110#nothing-waits | Nothing waits for your answer now. · When the agent asks or proposes something, it gathers here. | 지금은 답을 기다리는 것이 없습니다. · AI가 묻거나 제안하면 여기에 모입니다. |
| `not_recommended`, 409 | SCR-110#stale | This no longer waits for your answer. It was answered or closed meanwhile. | 이 일은 이제 답을 기다리지 않습니다. 그사이 답했거나 닫혔습니다. |
| 이미 함 | SCR-110#stale | Done already, in another tab. | 다른 탭에서 이미 했습니다. |
| 프로젝트 | SCR-110 | Projects ({n}) · By name · By last push · Now: {stage} {state} · Next: {next action} · No picture yet · Not current · Pushed again at {time} · {n} items · {n} warnings · Open | 프로젝트 ({n}) · 이름순 · 올린 순 · 지금: {stage} {state} · 다음: {next action} · 아직 그림 없음 · 최신 아님 · {time}에 다시 올라옴 · 항목 {n} · 경고 {n} · 열기 |
| 단추를 불러오지 못함 | SCR-110\~SCR-115(규칙 15) | The page's buttons could not load. Load the page again to answer here. | 페이지의 단추를 불러오지 못했습니다. 여기서 답하려면 페이지를 다시 불러와 주세요. |
| 단계 묶음 | SCR-111 | Discovery · Definition · Contracts · Screens · Building · Presentation | 발견 · 정의 · 계약 · 화면 · 만들기 · 발표 |
| 모양의 설명 | SCR-111(규칙 13) | ✓ done · ◐ in progress · ○ not started · – skipped · ? not recorded · picture | ✓ 완료 · ◐ 진행 중 · ○ 시작 전 · – 건너뜀 · ? 기록 없음 · 그림 |
| 다시 올라옴 | SCR-111#stale | This project was pushed again at {time}. Load again to see it. | 이 프로젝트가 {time}에 다시 올라왔습니다. 보려면 다시 불러와 주세요. |
| 탭 | SCR-111(규칙 16) | Picture · List · Talk {n} · Item · Talk ({n}) | 그림 · 목록 · 대화 {n} · 항목 · 대화 ({n}) |
| 머리 | SCR-112, SCR-113 | Last checkpoint {date} · No checkpoint yet · Commit {commit} · drawn {time} · Stage record · Back to the talk · Edit · Phase ② | 마지막 확인 지점 {date} · 아직 확인 지점 없음 · 커밋 {commit} · {time}에 그림 · 단계 기록 · 대화로 돌아가기 · 편집 · 2단계 |
| 머리의 수 | SCR-112, SCR-113 | {n} contexts · {n} terms · {n} open hotspots · {n} tables · {n} screens · {n} requirements · {n} cases | 컨텍스트 {n} · 용어 {n} · 열린 핫스팟 {n} · 표 {n} · 화면 {n} · 요구사항 {n} · 사례 {n} |
| 읽지 않음 | SCR-113#not-read. {why}는 텍스트 원본의 상태 `missing`, `none`, `skipped`, `no-checkout`, `invalid`를 따라 뒤의 다섯 가운데 하나이고, 같은 {why}가 0.2의 메시지 "이 프로젝트는 이 단계를 읽지 않습니다: {why}."를 채웁니다 | Not read: {why} · the source is missing · no text source is set · the project skips this stage · its repository was not on the machine that made the snapshot · its setting needs a fix | 읽지 않음: {why} · 원본이 없음 · 텍스트 원본이 정해지지 않음 · 프로젝트가 이 단계를 건너뜀 · 스냅샷을 만든 기기에 저장소가 없었음 · 설정을 고쳐야 함 |
| 단계 기록 | SCR-112, SCR-113 (SPEC-138, SPEC-139). 기록된 상태, 없음, 남길 말 (선택), 다시 통과, 기록을 기다리는 확인 지점의 말은 0.2에 있습니다 | Next action · Checkpoints · Checks · Pass the checkpoint · Pass · Withdraw | 다음 행동 · 확인 지점 · 점검 · 확인 지점 통과 · 통과 · 철회 |
| 그림의 도구 | SCR-112 | Zoom out · Zoom in · Fit · Go to · Map of the whole picture | 축소 · 확대 · 맞추기 · 바로 가기 · 전체 그림 지도 |
| 편집기 | SCR-112#loading, SCR-112#code-failed | The editor is loading. You can already read and move the picture. · The editor could not load. The picture and item list remain available. | 편집기를 불러오는 중입니다. 그림은 바로 읽고 이동할 수 있습니다. · 편집기를 불러오지 못했습니다. 그림과 항목 목록은 계속 사용할 수 있습니다. |
| 목록 | SCR-113 | All · With talk · My turn · What is left · Search in this stage · By context · In the source's order · Show all · No context · {n} of {total} · Loading more… · Could not load more. | 모두 · 대화 있음 · 내 차례 · 남은 것 · 이 단계에서 찾기 · 컨텍스트별 · 원문 순서 · 모두 보기 · 컨텍스트 없음 · {total}개 중 {n}개 · 더 불러오는 중… · 더 불러오지 못했습니다. |
| 항목 없음 | SCR-113#empty | This stage holds no items yet. | 이 단계에는 아직 항목이 없습니다. |
| 맞는 것 없음 | SCR-113#no-match | Nothing waits for you in this stage. · No item of this stage has talk yet. · Nothing in this stage matches “{q}”. | 이 단계에는 내 답을 기다리는 것이 없습니다. · 이 단계에는 아직 대화가 있는 항목이 없습니다. · 이 단계에서 “{q}”에 맞는 항목이 없습니다. |
| 대화 | SCR-114 | Talk · My turn {n} · The agent's turn {n} · The agent's turn ({n}) · Apart: comments whose item is gone ({n}) · Closed ({n}) · Show more | 대화 · 내 차례 {n} · AI 차례 {n} · AI 차례 ({n}) · 따로: 항목이 없어진 의견 ({n}) · 닫힌 대화 ({n}) · 더 보기 |
| 기다림 | SCR-114 | Waiting for the agent since {time} · Taken by the agent at {time} | {time}부터 AI를 기다림 · {time}에 AI가 맡음 |
| 칸 | SCR-114(규칙 18) | Comment on the stage as a whole · Leave · The agent reads this at its next work on the project. · Leave a new comment | 단계 전체에 의견 남기기 · 남기기 · AI는 그 프로젝트의 다음 작업 때 이것을 읽습니다. · 새 의견으로 남기기 |
| 좁힘 | SCR-114#narrowed | Talk on {id} · All talk of the stage | {id}의 대화 · 단계의 대화 모두 |
| 대화 없음 | SCR-114#empty | No talk on this stage yet. Select an item to talk about it, or write about the stage as a whole. · No comments on {id} yet. | 이 단계에는 아직 대화가 없습니다. 항목을 골라 그 항목에 대해 말하거나, 단계 전체에 대해 써 주세요. · {id}에 아직 의견이 없습니다. |
| 항목 | SCR-115 | Context: {id} {name} · Source: {path}, line {n} · Comes from · Leads to · Discrepancies ({n}) · Comment on this discrepancy · Loading {id}… | 컨텍스트: {id} {name} · 원문: {path}, {n}번째 줄 · 나온 곳 · 이어지는 곳 · 어긋남 ({n}) · 이 어긋남에 의견 남기기 · {id} 불러오는 중… |
| `item_not_found`, 404 | SCR-115#gone | {id} is not in this project's stages now. · Search all projects for {id} | {id} 항목은 지금 이 프로젝트의 단계에 없습니다. · 모든 프로젝트에서 {id} 찾기 |
| 찾기 | SCR-116 | Searching… · {n} matches for “{q}” · The first 20. Add a word to narrow it. · Type at least two characters. · Nothing matches “{q}”. · Look in the full checks | 찾는 중… · “{q}” 검색 결과 {n}개 · 처음 20개입니다. 낱말을 더하면 좁혀집니다. · 두 글자 이상 넣어 주세요. · “{q}”에 맞는 항목이 없습니다. · 전체 점검에서 보기 |
| 목록 표시 | SCR-113 | Discrepancy · Pending reflection | 어긋남 · 반영 대기 |
| 더 있음 | SCR-112(단계 기록의 점검), SCR-115(나온 곳, 이어지는 곳) | and {n} more | 외 {n}개 |
| 항목의 종류 | SCR-115, 허브 페이지가 부르는 대로. 표는 0.2의 보기처럼 테이블 대신 표라고 씁니다 | context · term · requirement · user flow · spec · table · API · screen · task · test case · bug · decision · scene | 컨텍스트 · 용어 · 요구사항 · 유저 플로우 · 기능 명세 · 표 · API · 화면 · 작업 · 테스트 · 버그 · 결정 · 장면 |
| 단계 이름 | SCR-110\~SCR-116, 허브 페이지가 부르는 대로 | Domain discovery · PRD · User flow · Functional spec · ERD · API · Sitemap · Screen states · Mockup · WBS · Development · QA · Presentation | 도메인 탐색 · PRD · 유저 플로우 · 기능 명세 · ERD · API · 사이트맵 · 화면 상태 · 목업 · WBS · 개발 · QA · 발표 |

SCR-117 허브 페이지는 hub.html 자신의 말이 페이지와 함께 그대로이고(REQ-233), 그래서 그 한국어는 에이전트라고 씁니다.
