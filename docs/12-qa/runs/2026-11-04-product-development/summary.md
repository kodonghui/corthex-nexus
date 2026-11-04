# NEXUS 합성 브라우저 검사

묶음 SHA256: CAF43251385F56770CFA31BBAD229BB16DF7527D35A73ADF2558B382D8ADB5BB

제품 표준 라이브러리 드라이버의 34경로가 별도 합성 fixture 7개로 순차 통과했고, 모든 소유 프로필 정리가 완료됐습니다. 정상 화면 매트릭스는 F260의 EN/KO × 320/1440 × light/dark, 48개 캡처이며 CAF43의 변경된 출처 문구는 한국어 320 dark 조합에서 확인했습니다.

사용자 역할은 가짜 Access를 통과한 합성 사용자입니다. Agent 자료는 초기 seed입니다. 답글·받기·버리기·확인 지점 성공은 실제 합성 Store/SQLite 효과를 읽어 확인했습니다. 읽기 실패·권한 거절·오래된 읽기·새 Agent 답글은 명시한 모의 응답입니다. 실제 Cloudflare 로그인과 GitHub 거래는 검사하지 않았습니다.

- [01-proposal-ko-mobile-dark.png](01-proposal-ko-mobile-dark.png): 한국어 320px dark 제안 원본, F260 정상 매트릭스
- [02-comment-loading-draft.png](02-comment-loading-draft.png): 실제 GET 응답을 지연한 동안 입력한 초안과 대기 버튼, F260
- [03-stale-proposal-real409.png](03-stale-proposal-real409.png): 오래된 GET만 모의한 뒤 실제 POST409와 재조회 후 안내, F260
- [04-core-css-fallback.png](04-core-css-fallback.png): 실제 core CSS 요청을 차단한 새 Chrome의 정적 reload, CAF43
- [05-editor-css-fallback.png](05-editor-css-fallback.png): 실제 editor CSS 요청을 차단한 별도 새 Chrome의 목록/패널, CAF43
- [06-korean-overview-source.png](06-korean-overview-source.png): 한국어 320px dark 단계 현황의 출처 문구, CAF43

기존 실패와 하네스 시도 원본은 별도 보존했습니다. 이 공개 선택본에는 raw 프로필·쿠키·토큰·사용자 계정·운영 자료·절대 로컬 경로를 포함하지 않았습니다. 모든 QA나 성능 기준을 통과했다고 주장하지 않습니다.

기존34의 loading행은 caret42..42/focus 보존 근거입니다. 같은 기존행을 native Shift와 비어 있지 않은 선택범위로 보완한 별도 검사에서39..42가 응답 후에도 유지됐습니다. 이를 추가 플로우 수로 합산하지 않습니다.
