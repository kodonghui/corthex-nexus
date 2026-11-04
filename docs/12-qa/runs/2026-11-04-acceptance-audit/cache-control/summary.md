# 임시 캐시 규칙 복구 결과

승인된 개발 호스트·HTTPS·`/code/`만 대상으로 임시 Bypass 규칙 하나를 생성했습니다. 실제 저장 범위를 확인하고 TTL override 없이 A에서는 활성, B에서는 비활성으로 전환했습니다. B03은 B02의 비활성 상태를 그대로 사용해 추가 UI 읽기나 토글이 없었습니다.

초기 Disabled → B01 Active → B02/B03 Disabled → B04 Active 뒤, 실제 측정 종료와 별도 복구 GO를 받고 소유 규칙 하나만 삭제했습니다. 2026-11-04 16:39:10.437 KST reload 후 원래 Cache Rules 0개 유지가 확인됐습니다.

다른 설정 변경·개발 fetch·인증값 읽기·cache purge는 0입니다. 기본 public 설정으로 복귀했다는 UI 근거이며, 이 조작자는 성능 측정이나 rollback 후 wire HIT 시험을 하지 않았습니다. 읽기 오류·지연과 최초 생성의 짧은 Active 구간은 원본에 남겼습니다. 단계별 원본·SHA256 manifest와 별도 사람 세션 캐시·역할 근거를 보존했습니다. 실제 주소·account/zone/rule ID·쿠키·토큰·원시 헤더·원시 본문은 공개 선택본에 넣지 않았습니다.
