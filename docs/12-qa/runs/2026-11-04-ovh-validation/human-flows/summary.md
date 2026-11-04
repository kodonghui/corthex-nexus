# 실제 개발 서버의 합성 사용자 흐름

배포 aad16450d1256d809023b8b1da18aa67ea026010 / UI metadata caf43251385f56770cfa31bbad229bb16df7527d35a73adf2558b382d8adb5bb에서 기존 사람 Access 세션으로 의견→답글→Answered→재열기, 제안 받기→반영 전, 확인 지점 통과→철회를 수행했습니다. 세 흐름의 일곱 UI 쓰기가 실제 서버 API 재조회와 일치했습니다. 직접 SQL을 읽은 검사는 아닙니다.

서비스 자격은 새 합성 프로젝트 seed와 별도 읽기 검증 자식프로세스에만 사용했습니다. 브라우저의 사람 세션에는 주입하지 않았습니다. 계정/인증 식별자와 실제 객체 ID는 이 공개 선택본에 포함하지 않았습니다. 그림의 CTX/TERM 같은 ID와 a로 된 commit은 의도한 합성 데이터입니다.

- [01-proposal-pending.png](01-proposal-pending.png): 서비스가 만든 합성 제안을 사람 UI로 받은 뒤 반영 전
- [02-checkpoint-passed.png](02-checkpoint-passed.png): 사람 UI로 통과한 합성 확인 지점과 기록 대기
- [03-checkpoint-withdrawn.png](03-checkpoint-withdrawn.png): 같은 합성 확인 지점 철회와 서버 날짜 안내

초기 REPL 캡처와 연결 실패는 보존했고, 후속 Aside 자체 agent의 실제 UI 캡처를 확인했습니다. 전체 QA·MFA·모바일·성능 결과로 확대하지 않습니다.
