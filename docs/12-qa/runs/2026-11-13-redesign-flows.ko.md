# 2026-11-13 합성 루프백 서버에서의 실행 (커밋 97aef23)

[English](2026-11-13-redesign-flows.md)

TASK-278에서 브라우저 에이전트가 TASK-265부터 TASK-277까지 만든 페이지에서 재디자인의 세 사용자 흐름 FL-117부터 FL-119까지를 실제 브라우저에서 점검했습니다(TC-1785). 43개 행 가운데 37개가 동작하고, 2개가 실패했으며, 4개는 막혔습니다. 두 실패는 `3f5cfd9`에서 고쳤고 브라우저로 다시 확인했으며, 어느 테스트 스위트도 되풀이하지 않던 경로는 `nexus/test/flow-regression.mjs`에 고정했습니다.

- 도구: Playwright 1.63.0과 Chromium 153.0.8010.12, 헤드리스, Node 24.22.1 · 테스터 3명이 동시에, 흐름마다 1명씩, 하위 에이전트 없이 · 34분, KST 06:00부터 06:34까지
- 역할: NEXUS를 쓰는 한 사람인 관리자, 1,440픽셀의 PC와 390픽셀의 휴대폰에서
- 설정: 행에 따로 적지 않으면 390픽셀의 밝은 영어와 어두운 한국어, 1,440픽셀의 밝은 영어와 어두운 한국어; 1,024픽셀 미만은 탭, 그 이상은 클릭
- 데이터: 루프백의 픽스처 서버 `nexus/test/view-server.mjs`와 첫 페이지, 단계, 그림, 대화, 항목의 합성 프로젝트; 테스터마다 자기 서버를 띄웠고, 실제 프로젝트, 계정, 키는 쓰지 않았습니다

ego lite나 Aside를 쓰지 않은 이유: 이 세션은 Linux 클라우드 컨테이너에서 돌았습니다. ego lite에는 Linux판이 없고 Aside도 없습니다. Linux의 `aside`가 다른 컴퓨터의 Aside를 움직이는 원격 제어는 이 세션을 위해 켜지지 않았고 `aside login` 승인도 없었습니다. 다음 점검은 ego lite가 설치된 관리자 컴퓨터의 세션에서 이 저장소와 Node 24로 ego lite를 쓰거나, Aside의 원격 제어를 켜고 `aside login`을 승인한 뒤 Aside를 쓸 수 있습니다.

브리핑이 픽스처의 프로젝트를 점검용으로 만든 것이라고 밝혔으므로, 테스터는 제안 받기나 확인 지점 통과 같은 사용자 본인의 누름을 그 프로젝트에서만 했습니다(SPEC-200).

## 동작함

| 행 | 경로 | 테스트 케이스 | 고정한 곳 | 증거 |
| --- | --- | --- | --- | --- |
| FL-117/R2 | 제안을 제자리에서 받기 | TC-1387, TC-1392 | `home`: `answers-stay-in-place-until-the-page-loads-again` | [fl117-r2-390-dark-ko-1.jpg](2026-11-13-redesign-flows/fl117-r2-390-dark-ko-1.jpg) |
| FL-117/R3 | 제안을 제자리에서 버리기: 의견에 답하는 제안과 답하지 않는 제안 | TC-1387, TC-1392 | `home`: `answers-stay-in-place-until-the-page-loads-again` | [fl117-r3-1440-light-en-1.jpg](2026-11-13-redesign-flows/fl117-r3-1440-light-en-1.jpg) |
| FL-117/R4 | AI의 추천 따르기 | TC-1387, TC-1392 | `home`: `answers-stay-in-place-until-the-page-loads-again` | [fl117-r4-390-light-en-1.jpg](2026-11-13-redesign-flows/fl117-r4-390-light-en-1.jpg) |
| FL-117/R5 | 2026-11-11 수정 전에 만든 대로의 확인 지점 요청 줄: 열기와 추천대로 통과 (REQ-278부터 REQ-280까지는 판단하지 않음) | TC-1392 | `home`: `answers-stay-in-place-until-the-page-loads-again` | [fl117-r5-1440-light-en-3.jpg](2026-11-13-redesign-flows/fl117-r5-1440-light-en-3.jpg) |
| FL-117/R6 | 질문의 답하기가 단계 대화에서 그 줄을 엶 | TC-1388 | `flows:first-page` (TC-1388) | [fl117-r6-390-light-en-1.jpg](2026-11-13-redesign-flows/fl117-r6-390-light-en-1.jpg) |
| FL-117/R7 | 프로젝트 카드의 열기가 그 현재 단계로 이끎 | TC-1385, TC-1388 | `flows:first-page` (TC-1388) | [fl117-r7-1440-dark-ko-1.jpg](2026-11-13-redesign-flows/fl117-r7-1440-dark-ko-1.jpg) |
| FL-117/F1 | 프로젝트가 하나도 없는 서버 | TC-1386, TC-1828 | `home`: `states-{lang}-{theme}-{width}`; `walk:home` | [fl117-f1-390-dark-ko-1.jpg](2026-11-13-redesign-flows/fl117-f1-390-dark-ko-1.jpg) |
| FL-117/F2 | 사용자를 기다리는 것이 없음 | TC-1386, TC-1827 | `home`: `states-{lang}-{theme}-{width}`; `walk:home` | [fl117-f2-1440-light-en-1.jpg](2026-11-13-redesign-flows/fl117-f2-1440-light-en-1.jpg) |
| FL-117/F3 | Access가 확인하지 않은 답, 그리고 Access가 확인할 때 같은 답 다시 | TC-1391, TC-1393 | `flows:first-page` (TC-1393) | [fl117-f3-390-light-en-1.jpg](2026-11-13-redesign-flows/fl117-f3-390-light-en-1.jpg) |
| FL-117/F4 | 그사이 다른 탭에서 답한 제안 | TC-1392, TC-1829 | `home`: `answers-stay-in-place-until-the-page-loads-again`; `walk:home` | [fl117-f4-1440-light-en-1.jpg](2026-11-13-redesign-flows/fl117-f4-1440-light-en-1.jpg) |
| FL-117/F5 | 서버의 데이터베이스 실패, 그리고 처음부터 Access가 없는 요청 | TC-1380, TC-1830, TC-1831 | `walk:home` | [fl117-f5-390-light-en-1.jpg](2026-11-13-redesign-flows/fl117-f5-390-light-en-1.jpg) |
| FL-118/R1 | 첫 페이지에서 프로젝트 열기 | TC-1376, TC-1399, TC-1407 | `flows:first-page` (TC-1388); `walk:workspace`; `page`: `widths-without-code` | [fl118-r1-1440-light-en-1.jpg](2026-11-13-redesign-flows/fl118-r1-1440-light-en-1.jpg) |
| FL-118/R2 | 0.2의 주소가 같은 곳으로 이끎 | TC-1767 | `page`: `addresses-lead-to-their-pages` | [fl118-r2-1440-dark-ko-1.jpg](2026-11-13-redesign-flows/fl118-r2-1440-dark-ko-1.jpg) |
| FL-118/R3 | 1,024픽셀 미만의 탭과 제목에서 여는 단계 목록, 390픽셀에서만 | TC-1406, TC-1817 | `item`: `phone-390-{lang}-{theme}`; `stage`: `hit-areas-at-390`; `flows:workspace` (TC-1407) | [fl118-r3-390-dark-ko-1.jpg](2026-11-13-redesign-flows/fl118-r3-390-dark-ko-1.jpg) |
| FL-118/R4 | 그림이 있는 단계: 01, 05, 07 | TC-1765, TC-1770 | `picture`: `loading-normal-{width}-{lang}-{theme}`, `tools-{width}-{lang}`, `tools-line-1280-{lang}`, `addresses-{width}-{lang}` | [fl118-r4-1440-light-en-1.jpg](2026-11-13-redesign-flows/fl118-r4-1440-light-en-1.jpg) |
| FL-118/R5 | 그림이 없는 단계: 02 | TC-1397, TC-1399, TC-1400 | `stage`: `states-{lang}-{theme}-{width}` | [fl118-r5-390-light-en-1.jpg](2026-11-13-redesign-flows/fl118-r5-390-light-en-1.jpg) |
| FL-118/R6 | 목록 좁히기와 묶기 | TC-1400 | `stage`: `the-list-works-1440-en` | [fl118-r6-1440-dark-ko-1.jpg](2026-11-13-redesign-flows/fl118-r6-1440-dark-ko-1.jpg) |
| FL-118/R7 | 그림과 목록에서 항목 고르기 | TC-1810, TC-1811, TC-1812, TC-1817 | `item`: `loading-and-normal-1440-{lang}-{theme}`, `trace-and-source-1440-en`, `switch-close-escape-back-1440-en`; `picture`: `select-item` | [fl118-r7-1440-light-en-1.jpg](2026-11-13-redesign-flows/fl118-r7-1440-light-en-1.jpg) |
| FL-118/R8 | 단계 목록에서 다른 단계 고르기, 그리고 브라우저의 뒤로 | TC-1407 | `flows:workspace` (TC-1407) | [fl118-r8-390-dark-ko-1.jpg](2026-11-13-redesign-flows/fl118-r8-390-dark-ko-1.jpg) |
| FL-118/R9 | 모든 프로젝트를 ID와 낱말로 찾고 결과 열기 | TC-1820, TC-1821, TC-1822 | `item`: `search-1440-{lang}-{theme}`, `search-phone-390-ko-dark`, `search-first-page-1440-en` | [fl118-r9-390-light-en-1.jpg](2026-11-13-redesign-flows/fl118-r9-390-light-en-1.jpg) |
| FL-118/R10 | 단계 기록에서 단계의 확인 지점 통과, 그리고 철회 | TC-1403, TC-1405 | `stage`: `pass-and-withdraw-390-ko-dark`, `the-stage-record-in-the-side-panel-and-sheet` | [fl118-r10-390-light-en-2.jpg](2026-11-13-redesign-flows/fl118-r10-390-light-en-2.jpg) |
| FL-118/R11 | 전체 점검 열기 | TC-1767 | `page`: `addresses-lead-to-their-pages`; `hub`: `{view}-{place}-{language}` | [fl118-r11-390-dark-ko-1.jpg](2026-11-13-redesign-flows/fl118-r11-390-dark-ko-1.jpg) |
| FL-118/F1 | 주소에 모르는 프로젝트, 부분, 단계 | TC-1379 | `nexus/test/pages.test.js`; `walk:workspace` | [fl118-f1-1440-light-en-1.jpg](2026-11-13-redesign-flows/fl118-f1-1440-light-en-1.jpg) |
| FL-118/F2 | 단계가 보여 주지 않는 항목을 `#item=`으로 열기 | TC-1814, TC-1816 | `item`: `other-stage-and-gone-1440-en`, `why-lines-1440-ko-dark` | [fl118-f2-1440-light-en-2.jpg](2026-11-13-redesign-flows/fl118-f2-1440-light-en-2.jpg) |
| FL-118/F3 | 아무것도 찾지 못하는 검색, 그리고 한 글자 검색 | TC-1820, TC-1821 | `item`: `search-states-1440-en` | [fl118-f3-390-dark-ko-1.jpg](2026-11-13-redesign-flows/fl118-f3-390-dark-ko-1.jpg) |
| FL-118/F4 | 프로젝트가 읽지 않는 단계 03, 그리고 항목이 없는 단계 04 | TC-1399 | `stage`: `states-{lang}-{theme}-{width}` | [fl118-f4-1440-light-en-1.jpg](2026-11-13-redesign-flows/fl118-f4-1440-light-en-1.jpg) |
| FL-118/F5 | 크기 때문에 빠진 그림, 최신이 아닌 그림, 화면 320개의 사이트맵 | TC-1840, TC-1841, TC-1842 | `picture`: `states-{width}-{lang}`; `walk:picture` | [fl118-f5-1440-light-en-3.jpg](2026-11-13-redesign-flows/fl118-f5-1440-light-en-3.jpg) |
| FL-119/R1 | 단계에서, 첫 페이지의 줄에서, `#talk=` 링크에서 단계 대화 열기: 차례별 대화와 접힌 닫힌 대화 | TC-1795, TC-1796, TC-1797, TC-1808 | `talk`: `loading-and-normal-1440-{lang}-{theme}`, `addresses-closed-and-gone-1440-en`; `flows:first-page` (TC-1388) | [fl119-r1-390-dark-ko-1.jpg](2026-11-13-redesign-flows/fl119-r1-390-dark-ko-1.jpg) |
| FL-119/R2 | 항목이 단계를 떠난 의견은 열린 채 따로 서고, 항목이 없어졌다고 말함 | TC-1495, TC-1797 | `talk`: `addresses-closed-and-gone-1440-en` | [fl119-r2-1440-light-en-1.jpg](2026-11-13-redesign-flows/fl119-r2-1440-light-en-1.jpg) |
| FL-119/R4 | 목록이나 그림에서 항목을 골라 대화를 좁힌 뒤 단계의 대화 전체로 돌아가기 | TC-1803, TC-1806 | `talk`: `narrowed-and-error-{width}-{lang}-{theme}` | [fl119-r4-390-light-en-1.jpg](2026-11-13-redesign-flows/fl119-r4-390-light-en-1.jpg) |
| FL-119/R5 | 목록 항목에 남기는 의견 | TC-1802, TC-1803 | `talk`: `reply-mark-answered-and-box-1440-en`, `empty-1440-en-ko` | [fl119-r5-390-dark-ko-1.jpg](2026-11-13-redesign-flows/fl119-r5-390-dark-ko-1.jpg) |
| FL-119/R6 | 단계 전체에 남기는 의견 | TC-1803 | `talk`: `reply-mark-answered-and-box-1440-en` | [fl119-r6-1440-light-en-1.jpg](2026-11-13-redesign-flows/fl119-r6-1440-light-en-1.jpg) |
| FL-119/R7 | 답글, 그리고 답변 완료로 닫힌 의견에 답글을 달아 다시 열기 | TC-1797, TC-1799, TC-1803 | `talk`: `talk-tab-{width}-{lang}`, `reply-mark-answered-and-box-1440-en`; `flows:talk` (TC-1803) | [fl119-r7-390-dark-ko-1.jpg](2026-11-13-redesign-flows/fl119-r7-390-dark-ko-1.jpg) |
| FL-119/R8 | AI가 답함; 다시 불러온 뒤 처음 200개를 넘는 요구사항에 답글, 정리하는 답글, 답변 완료 표시 | TC-1494, TC-1803 | `talk`: `kept-across-a-reload-1440-en`, `stale-comment-1440-en`, `reply-mark-answered-and-box-1440-en` | [fl119-r8-1440-dark-ko-2.jpg](2026-11-13-redesign-flows/fl119-r8-1440-dark-ko-2.jpg) |
| FL-119/R9 | ERD 대화에서 제안 하나는 받고 다른 하나는 버리기 | TC-1806 | `talk`: `proposals-and-reflection-1440-en` | [fl119-r9-1440-light-en-1.jpg](2026-11-13-redesign-flows/fl119-r9-1440-light-en-1.jpg) |
| FL-119/F1 | Access가 확인하지 않은 의견은 글을 지키고, 같은 쓰기 ID로 나중에 통과함 | TC-1800, TC-1801 | `flows:talk` (TC-1801); `talk`: `permission-and-sign-in-1440-ko-dark`, `errors-and-one-write-id-1440-en` | [fl119-f1-390-light-en-1.jpg](2026-11-13-redesign-flows/fl119-f1-390-light-en-1.jpg) |
| FL-119/F2 | 다른 탭에서 버린 제안을 여기서 받기 | TC-1806 | `talk`: `proposals-and-reflection-1440-en` | [fl119-f2-1440-dark-ko-1.jpg](2026-11-13-redesign-flows/fl119-f2-1440-dark-ko-1.jpg) |

고정한 곳은 `nexus/test/browser_check.py`의 스위트와, 쌍점 뒤에 그 테스트를 적습니다. 모든 풀 리퀘스트가 이를 실행합니다: `walk`와 `flows`는 browser-walk 작업에서, 나머지 스위트는 browser-ui에서 실행합니다. `flows` 묶음은 다른 스위트가 되풀이하지 않던 경로를 담고 테스트마다 케이스 이름이 붙으며, 아래 두 수정 전의 코드는 이 테스트에서 실패합니다.

## 동작하지 않음

| 행 | 설정 | 단계 | 기대 | 실제 | 버그 |
| --- | --- | --- | --- | --- | --- |
| FL-117/R1 | 1,440픽셀, 밝은 영어 | 내 차례에서 줄마다 위치 읽기 | SCR-110#normal: 줄마다 프로젝트, 부분, 단계, 항목을 밝히고, 줄의 5분의 2에서 프로젝트 제목만 잘림 | 위치는 388~502픽셀 너비였습니다. 23개 줄 가운데 6개에서 항목이 잘렸고 그중 3개는 ID 안에서 잘렸으며("SCR-…"), 짧은 제목은 "QA t…"로 보였습니다. [fl117-r1-1440-light-en-4.jpg](2026-11-13-redesign-flows/fl117-r1-1440-light-en-4.jpg) | BUG-602, `3f5cfd9`에서 고침: 위치가 줄을 바꾸고, `flows:first-page`(TC-1826)는 1,024픽셀과 1,440픽셀에서 14개 줄 가운데 잘린 항목을 찾지 못합니다. [fl117-r1-1440-light-en-fixed.jpg](2026-11-13-redesign-flows/fl117-r1-1440-light-en-fixed.jpg) |
| FL-119/R3 | 390픽셀, 밝은 영어와 어두운 한국어 | 01 단계 대화에서 항목에 달린 의견을 고른 뒤 그림 탭 열기 | SCR-114#narrowed와 SPEC-209: 항목이 보이고 윤곽선이 그려지며, 항목 패널과 그 의견이 열리고, 주소에 `#item=` | 기대대로 대화 탭이 앞에 남고 항목 탭이 생겼지만, 그림 탭은 보드를 0 %로 보여 주었고 컨텍스트는 틀 왼쪽 끝의 2×1픽셀 점이었습니다. [fl119-r3-390-light-en-1b.jpg](2026-11-13-redesign-flows/fl119-r3-390-light-en-1b.jpg) | BUG-603, `3f5cfd9`에서 고침: 보드가 17 %로 보이고 컨텍스트는 틀 안에서 342×90픽셀로 윤곽선이 그려집니다; `flows:picture`(TC-1779). [fl119-r3-390-light-en-fixed.jpg](2026-11-13-redesign-flows/fl119-r3-390-light-en-fixed.jpg) |

두 행의 나머지는 동작했습니다. FL-117/R1에서 페이지는 네 설정 모두에서 API와 맞았습니다: 23개 줄의 내 차례, 7개 프로젝트에 걸친 AI 할 일 339개, 카드 11장; 390픽셀과 1,440픽셀 어두운 한국어에서는 모든 항목을 읽을 수 있었습니다. FL-119/R3에서는 1,440픽셀의 두 설정에서 항목이 38 %로 윤곽선과 함께 보였고 [fl119-r3-1440-light-en-1.jpg](2026-11-13-redesign-flows/fl119-r3-1440-light-en-1.jpg), 브라우저의 뒤로와 항목이 없어진 의견은 네 설정 모두에서 동작했습니다.

## 인상

버그와 따로 둔, 관리자로서 테스터가 받은 인상입니다. 어느 것을 버그, 작업, 요구사항 변경으로 삼을지는 관리자가 정합니다.

| 화면 | 페르소나와 설정 | 인상 | 증거 |
| --- | --- | --- | --- |
| SCR-110 | PC, 1,440, 밝은 영어 | 위치가 자리를 이상하게 씁니다. 짧은 프로젝트 제목은 "QA t…"로 잘리는데 옆의 긴 요구사항 제목은 그대로이고, 이름이 긴 프로젝트는 늘 5분의 2를 다 차지합니다. 추천이 무엇에 관한 것인지 알려면 마우스를 올리거나 열어 봐야 합니다. | [fl117-r1-1440-light-en-4.jpg](2026-11-13-redesign-flows/fl117-r1-1440-light-en-4.jpg) |
| SCR-110 | 휴대폰, 390, 어두운 한국어 | 위치가 줄을 바꾸면 구분 점이 줄 끝에 남거나 다음 줄을 시작해, 떨어진 글머리표처럼 보입니다. 영어에서도 같습니다. | [fl117-r2-390-dark-ko-1.jpg](2026-11-13-redesign-flows/fl117-r2-390-dark-ko-1.jpg) |
| SCR-110 | PC, 1,440, 밝은 영어 | 같은 AI 글이 내 차례에 두 번 나옵니다. 받기와 버리기가 있는 제안으로, 그리고 아래쪽에 답하기가 있는 질문으로 나옵니다. 제안을 버리자 질문도 표시 없이 사라졌고 내 차례는 둘 줄었습니다. | [fl117-r1-1440-light-en-4.jpg](2026-11-13-redesign-flows/fl117-r1-1440-light-en-4.jpg) |
| SCR-110 | 휴대폰, 390, 밝은 영어 | 줄 아래의 Access 거절은 서버를 운영하는 사람에게 하는 지시처럼 읽힙니다. 내 답이 저장되지 않았다고 말하지 않고 다시 시도도 없어서, 받기를 다시 눌러야겠다고 짐작했습니다. | [fl117-f3-390-light-en-1.jpg](2026-11-13-redesign-flows/fl117-f3-390-light-en-1.jpg) |
| SCR-110 | PC, 1,440, 밝은 영어 | 그사이 버려진 제안에 받기를 누르자 줄이 성공과 같은 체크 표시의 "✓ Dismissed"로 바뀌어, 얼핏 보면 내 누름이 무언가를 한 것처럼 보입니다. | [fl117-f4-1440-light-en-1.jpg](2026-11-13-redesign-flows/fl117-f4-1440-light-en-1.jpg) |
| SCR-110 | 휴대폰, 390, 밝은 영어 | 카드의 13단계는 번호도 글도 없는 작은 모양 13개가 한 줄로 서 있고, 집계 "◐ 4 · ? 9"는 범례를 외워야 읽힙니다. 휴대폰에는 마우스 올리기가 없어 어느 표시가 어느 단계인지 알 수 없습니다. | [fl117-r1-390-light-en-3.jpg](2026-11-13-redesign-flows/fl117-r1-390-light-en-3.jpg) |
| SCR-110 | PC, 1,440, 밝은 영어 | 여러 프로젝트가 같은 제목과 같은 저장소를 쓰는데, 이는 픽스처의 데이터이고, AI 할 일은 이들을 달리 구별할 것 없이 따로따로 늘어놓습니다. | [fl117-r1-1440-light-en-1.jpg](2026-11-13-redesign-flows/fl117-r1-1440-light-en-1.jpg) |
| SCR-110 | PC, 1,440, 밝은 영어 | 내 차례 아래쪽에서 AI 할 일이 내 차례 옆으로 길고 빈 패널로 이어져, 덜 만든 것처럼 보입니다. | [fl117-r1-1440-light-en-4.jpg](2026-11-13-redesign-flows/fl117-r1-1440-light-en-4.jpg) |
| SCR-112 | PC, 1,440, 밝은 영어 | 추천대로 통과 뒤 표시의 단계 기록 링크는 기록이 닫힌 단계를 엽니다. 머리는 여전히 "No checkpoint yet"인데 옆에 노란 띠 "Passed in NEXUS …, waiting for its record"가 있고, 기록은 다시 통과를 내놓습니다. 함께 보면 통과가 안 된 것처럼 읽힙니다. | [fl117-r5-1440-light-en-3.jpg](2026-11-13-redesign-flows/fl117-r5-1440-light-en-3.jpg) |
| SCR-110 | 휴대폰, 390, 밝은 영어 | 메시지 페이지는 두 테마에서 차분하고 잘 읽히지만, 나갈 길은 다시 불러오기뿐이어서 서버가 계속 실패하는 동안 같은 페이지만 돌아오고, NEXUS 막대나 다른 링크가 없습니다. | [fl117-f5-390-light-en-1.jpg](2026-11-13-redesign-flows/fl117-f5-390-light-en-1.jpg) |
| SCR-110 | 휴대폰, 390, 어두운 한국어 | 제자리에서 답하기가 안심됩니다. 줄은 엄지 아래 그대로 있고, "✓ 받음"이 버튼을 대신하며, 개수가 바로 바뀌고, 버튼이 넓어 누르기 쉽습니다. | [fl117-r2-390-dark-ko-1.jpg](2026-11-13-redesign-flows/fl117-r2-390-dark-ko-1.jpg) |
| SCR-112 | PC, 1,440, 밝은 영어 | 작은 ERD를 처음 보기에서 +로 두 번 키우면 표가 보기 위로 밀려나 틀이 비고, 맞춤을 누르거나 지도를 눌러야 했습니다. 보기 가운데를 중심으로 키우면 더 안심되겠습니다. SPEC-156은 기준점을 정하지 않습니다. | [fl118-r4-1440-light-en-1.jpg](2026-11-13-redesign-flows/fl118-r4-1440-light-en-1.jpg) |
| SCR-112 | PC, 1,440, 밝은 영어 | 화면 320개의 사이트맵에서 틀만 그리는 지도는 작은 점 하나뿐인 거의 빈 상자여서, 지금 어디 있는지 알려 주지 못합니다. | [fl118-f5-1440-light-en-3.jpg](2026-11-13-redesign-flows/fl118-f5-1440-light-en-3.jpg) |
| SCR-112 | PC, 1,440, 밝은 영어 | 영어 개수에 단수가 없습니다: 머리의 "1 open hotspots"와 "1 contexts", 단계 목록의 "1 items"(SCR-111), "1 comments"(SCR-113). 낱말 파일이 복수만 줍니다. | [fl118-r1-1440-light-en-1.jpg](2026-11-13-redesign-flows/fl118-r1-1440-light-en-1.jpg) |
| SCR-111 | 휴대폰, 390, 어두운 한국어 | 시트에서 단계를 고른 뒤 뒤로를 누르면 먼저 시트가 다시 열리고, 두 번째 뒤로에서야 단계를 떠납니다. | [fl118-r8-390-dark-ko-1.jpg](2026-11-13-redesign-flows/fl118-r8-390-dark-ko-1.jpg) |
| SCR-111 | 휴대폰, 390, 어두운 한국어 | 휴대폰에서는 작업 공간 위 막대에 전체 점검이 없어, 모든 프로젝트와 그 메뉴를 거쳐서야 찾았습니다. | [fl118-r11-390-dark-ko-1.jpg](2026-11-13-redesign-flows/fl118-r11-390-dark-ko-1.jpg) |
| SCR-116 | 휴대폰, 390, 밝은 영어 | 결과가 프로젝트를 제목이 아닌 키로 밝히고 긴 제목은 잘려서, 두 프로젝트에서 같은 ID로 나온 두 결과가 얼핏 같아 보입니다. | [fl118-r9-390-light-en-1.jpg](2026-11-13-redesign-flows/fl118-r9-390-light-en-1.jpg) |
| SCR-115 | 휴대폰, 390, 밝은 영어 | 고정된 의견 상자가 항목 탭의 5분의 1쯤을 차지해, 항목 자체를 볼 자리가 줄어듭니다. | [fl118-r2-390-light-en-1.jpg](2026-11-13-redesign-flows/fl118-r2-390-light-en-1.jpg) |
| SCR-115 | PC, 1,440, 밝은 영어 | 항목을 열면 그 항목의 대화가 고정된 의견 상자 아래, 옆 칸 낮은 곳에서 시작하고 처음에는 아이콘만 보여서, 어디서 시작하는지 찾아야 했습니다. | [fl118-r7-1440-light-en-1.jpg](2026-11-13-redesign-flows/fl118-r7-1440-light-en-1.jpg) |
| SCR-113 | 휴대폰, 390, 밝은 영어 | "Passed in NEXUS …, waiting for its record"가 호박색 경고 막대로 그려져, 내 통과가 문제처럼 읽힙니다. | [fl118-r5-390-light-en-1.jpg](2026-11-13-redesign-flows/fl118-r5-390-light-en-1.jpg) |
| SCR-113 | 휴대폰, 390, 밝은 영어 | 기록 시트에서 두 번째 통과는 경고 없이 기다리는 줄을 하나 더 더하고, 다시 통과는 스크롤하기 전까지 시트 아래 끝에서 반쯤 잘려 있습니다. | [fl118-r10-390-light-en-2.jpg](2026-11-13-redesign-flows/fl118-r10-390-light-en-2.jpg) |
| SCR-116 | 휴대폰, 390, 어두운 한국어 | 검색은 "“zzqx”에 맞는 항목이 없습니다."라고 하고, 검색이 이끄는 허브 페이지는 "“zzqx”와 맞는 항목이 없습니다."라고 합니다. 한 걸음 안에 두 문구가 있고, 각각 SCR-116과 허브 페이지의 낱말이라는 자기 문서를 따릅니다. | [fl118-f3-390-dark-ko-1.jpg](2026-11-13-redesign-flows/fl118-f3-390-dark-ko-1.jpg) |
| SCR-112 | PC, 1,440, 어두운 한국어 | 크기 때문에 빠진 ERD에서 머리의 "표 0"은 빠졌다는 메시지 옆에서 ERD가 빈 것처럼 읽힙니다. | [fl118-f5-1440-dark-ko-1.jpg](2026-11-13-redesign-flows/fl118-f5-1440-dark-ko-1.jpg) |
| SCR-111 | PC, 1,440, 밝은 영어 | 단계 목록에서 항목이 없는 단계는 개수를 보이지 않아 읽지 않는 단계와 같아 보입니다. 0을 보이면 둘이 구별됩니다. | [fl118-r1-1440-light-en-1.jpg](2026-11-13-redesign-flows/fl118-r1-1440-light-en-1.jpg) |
| SCR-112 | PC, 1,440, 밝은 영어 | 컨텍스트에 달린 의견을 고르면 DDD 보드가 컨텍스트 전체에 맞게 100 %에서 38 %로 줄어듭니다. 윤곽선은 분명하지만 안의 메모가 너무 작아 읽을 수 없어 다시 키우게 됩니다. | [fl119-r3-1440-light-en-1.jpg](2026-11-13-redesign-flows/fl119-r3-1440-light-en-1.jpg) |
| SCR-114 | 휴대폰, 390, 어두운 한국어 | 답글을 열면 상자 둘이 겹칩니다: 대화 안 질문의 답글 상자와, 그 아래 고정된 단계 자체의 상자와 그 남기기입니다. 키보드가 올라오면 보이는 버튼은 그 상자의 꺼진 남기기여서, 답글을 보낼 수 없는 것처럼 읽힙니다. | [fl119-f3-390-dark-ko-2.jpg](2026-11-13-redesign-flows/fl119-f3-390-dark-ko-2.jpg) |
| SCR-110 | 휴대폰, 390, 밝은 영어 | 첫 페이지의 답하기는 단계 대화에서 질문을 열지만, 초점이 답글 상자가 아닌 줄의 제목에 가서 입력 전에 한 번 더 눌러야 합니다. 대화 자체의 답하기는 초점을 상자에 둡니다. | [fl119-r1-390-light-en-2.jpg](2026-11-13-redesign-flows/fl119-r1-390-light-en-2.jpg) |
| SCR-114 | PC, 1,440, 어두운 한국어 | 답변 완료 표시를 누르면 줄이 그 자리에 아무 말 없이 접힌 닫힌 대화로 사라집니다. 닫힌 대화의 개수만이 동작했다고 알려 주는데, 받기와 버리기는 제자리에 낱말을 남깁니다. | [fl119-r8-1440-dark-ko-2.jpg](2026-11-13-redesign-flows/fl119-r8-1440-dark-ko-2.jpg) |
| SCR-114 | PC, 1,440, 어두운 한국어 | 한국어에서 나를 기다리는 반영은 "…에이전트가 의견에서 묻습니다."라고 하는데, 대화의 다른 모든 줄은 에이전트를 "AI"라고 부릅니다. 그 문장은 재디자인이 유지한 08 단계의 0.2 메시지지만, 한 에이전트의 두 이름처럼 읽힙니다. | [fl119-f2-1440-dark-ko-1.jpg](2026-11-13-redesign-flows/fl119-f2-1440-dark-ko-1.jpg) |
| SCR-115 | 휴대폰, 390, 어두운 한국어 | 항목 탭에서 남기기를 누르면 새 의견이 고정된 상자 뒤, 화면 아래로 들어갑니다. 비워진 상자와 탭의 개수만이 저장됐다고 알려 줍니다. 1,440에서는 보입니다. | [fl119-r5-390-dark-ko-1.jpg](2026-11-13-redesign-flows/fl119-r5-390-dark-ko-1.jpg) |
| SCR-114 | 휴대폰, 390, 어두운 한국어 | "AI 차례 3"을 누르면 대화가 그 묶음으로 스크롤되지만 밑줄은 "내 차례 3"에 남고 누른 링크가 옅은 채움으로 깜박여서, 두 링크가 바뀌지 않은 탭처럼 읽힙니다. | [fl119-r1-390-dark-ko-1.jpg](2026-11-13-redesign-flows/fl119-r1-390-dark-ko-1.jpg) |
| SCR-114 | 휴대폰, 390, 밝은 영어 | AI가 내 의견에 답한 뒤 내 차례의 그 줄은 내 글 위에 "Question" 칩을 답니다. SCR-114#normal은 내 차례의 줄을 AI의 것으로 설명하므로, 칩은 AI가 물은 것처럼 읽힙니다. | [fl119-r8-390-light-en-1.jpg](2026-11-13-redesign-flows/fl119-r8-390-light-en-1.jpg) |
| SCR-114 | 휴대폰, 390, 밝은 영어 | Access가 쓰기를 확인하지 않았을 때 상자 위 메시지는 서버를 Access로 보호하라고 하고 추적 ID를 주지만, 의견이 저장되지 않았다고 쉬운 말로 하지 않습니다. 남아 있는 글과 남기기가 다시 해 보라고 알려 줍니다. | [fl119-f1-390-light-en-1.jpg](2026-11-13-redesign-flows/fl119-f1-390-light-en-1.jpg) |
| SCR-112 | PC, 1,440, 밝은 영어 | 보드의 머리가 낱말 파일대로 "1 contexts · 0 terms · 1 open hotspots"라고, 하나에 복수를 씁니다. 한국어는 잘 읽힙니다. | [fl119-r3-1440-light-en-1.jpg](2026-11-13-redesign-flows/fl119-r3-1440-light-en-1.jpg) |

## 실행하지 않음

| 행 | 경로 | 이유 |
| --- | --- | --- |
| FL-117/F6 | 페이지를 그린 뒤 커밋이나 요청이 바뀌어 거절되는 통과 (REQ-279) | 막힘: 만들지 않았습니다. 사용자가 본 것에 묶인 통과는 TASK-299부터 TASK-302까지이고, 그 거절은 TASK-301입니다. 만든 추천대로 통과는 커밋도 요청도 보내지 않아 서버가 거절할 것이 없습니다. |
| FL-118/B1 | 단계 목록이나 대화 접기 (REQ-295) | 막힘: TASK-287을 만들지 않았습니다. |
| FL-118/B2 | 프로젝트 자료 열기 (REQ-292) | 막힘: TASK-310부터 TASK-312까지를 만들지 않았습니다. |
| FL-119/F3 | 휴대폰에서 키보드를 올린 채 AI의 질문에 답하기 (TC-1799) | 막힘: 헤드리스 Chromium에는 키보드가 없습니다. 테스터가 대신 쓴 390×464픽셀 페이지에서는 답하기가 단계 자체의 상자 아래에 놓였고, 보이는 것은 그 상자의 꺼진 남기기뿐이었습니다 [fl119-f3-390-dark-ko-2.jpg](2026-11-13-redesign-flows/fl119-f3-390-dark-ko-2.jpg). 페이지의 viewport 태그에는 `interactive-widget`이 없고 코드는 `visualViewport`를 읽지 않습니다. iOS Safari와 Chrome의 기본값처럼 키보드 위로 화면을 옮기는 브라우저에서는 답하기에 닿을 수도 있습니다. 실제 휴대폰이 필요합니다. |

에이전트는 대화의 TC-1798, TC-1804, TC-1805, TC-1807, TC-1767의 주소 `#proposal=`, 첫 페이지의 TC-1389, TC-1394, TC-1395를 점검하지 않았고, TC-1494는 일부만 점검했습니다. 브라우저 회귀 테스트가 이 케이스들을 실행하며, 마지막 결과는 [QA 계획](../nexus.ko.md)에 있습니다. 첫 페이지의 행이 빠뜨린 것, 즉 스냅샷이 더는 갖지 않는 부분의 확인 지점, 다시 시도가 있는 실패한 답, 만료된 로그인도 `home` 스위트가 다룹니다. 만들지 않아 판단하지 않은 것: 머리의 마지막 올림과 AI의 마지막 읽음(REQ-271, TASK-298), 읽지 않음 표시(TASK-298), 확인 지점 요청의 단계 기록(TASK-302).

## 참고

- 커밋: 테스터가 점검한 것은 `97aef23`입니다. 점검 중 커밋 3개가 작업 트리를 `ffac8a7`로 옮겼지만 QA 계획과 테스트 스크립트만 바꿨고, `nexus/src`, `nexus/ui`, `nexus/test/view-server.mjs`와 그 픽스처는 `97aef23` 그대로였습니다.
- 콘솔: 페이지 오류와 다른 출처로 가는 요청은 없었습니다. 오류는 점검하는 상태가 일으키는 실패한 로드뿐이었습니다: 답과 의견의 403과 409, 메시지 페이지와 모르는 항목의 404. FL-119/F1의 한국어 실행에서는 픽스처의 Access 대역이 늦게 불러오는 한국어 글꼴 조각도 거절했습니다. 실제로 Access 세션이 끊겨도 마찬가지로 빠집니다.
- 데이터: 모든 쓰기는 픽스처의 합성 프로젝트로 갔고 API로 다시 읽었습니다: FL-117의 답, FL-118/R10의 통과와 철회, FL-119의 의견, 답글, 제안.
- FL-118/R2: 302 뒤에도 `#comment=`가 주소에 남고 대화가 그 줄을 엽니다. SPEC-154와 TC-1767의 결과가 말하는 대로입니다.
- 페이지의 시각은 컨테이너의 시간대인 UTC여서, 점검은 TC-1389의 시간대 변환을 확인하지 못했습니다.
- 픽스처 한계: 01 단계에는 따로 선 의견이 없어 FL-119/R3은 항목 픽스처의 02 단계에서 지워진 요구사항에 달린 의견을 썼습니다. 그림 상태 프로젝트에는 항목이 없고, 단계 프로젝트의 처음 200개 행은 한 컨텍스트에 있으며, 여러 프로젝트가 한 제목을 씁니다.
- 동시 실행 수: 테스터마다 하나씩 세션 3개를 동시에 돌렸고, 시간 초과, 다른 세션의 페이지, 도구 오류 없이 모두 끝났습니다. 다음 점검은 3에서 시작해 6을 시도할 수 있습니다.
- 브리핑은 픽스처 서버를 서브셸의 PID가 기록되게 띄워서, 그 PID로 멈추면 서버가 계속 돌았습니다. 테스터와 오케스트레이터가 서버 자체의 PID로 멈췄습니다. 다음 브리핑은 서버 자체의 PID를 기록합니다.
- 스크린샷: 테스터가 64장, 60장, 58장을 찍었습니다. 이 폴더는 보고서가 인용한 47장(휴대폰 화면은 390×844픽셀)과 수정 뒤 찍은 2장을 다시 압축해 둡니다.

집계: 흐름 3개 중 3개를 점검했습니다. 37개 행이 동작하고, 2개는 동작하지 않았다가 고쳤으며, 4개는 막혔습니다.
