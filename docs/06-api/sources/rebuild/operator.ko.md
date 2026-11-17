# 재설계 운영 인터페이스

[English](operator.md)

| ID | Interface | From | Access | Outcomes |
| --- | --- | --- | --- | --- |
| API-237 | Protected backup and inventory | SPEC-341, SPEC-342 | operator-only local command | consistent protected manifest with original IDs/digests and accepted-write boundary |
| API-238 | Restore and reconcile legacy data | SPEC-341, SPEC-342, SPEC-343 | operator-only isolated migration command | mapped identities, counts, foreign-key and protected content checks; blocked on mismatch |
| API-239 | Validate and switch or keep release | SPEC-345 | operator-only release command | recorded keep/switch after all Must QA and recovery evidence |
| API-240 | Recover acknowledged writes | SPEC-344 | operator-only rollback command | compatible runtime and reconciled journal tail; incomplete if any acknowledged write is missing |
| API-241 | hub.py setup-ci PROJECT | SPEC-331, SPEC-327, SPEC-328 | authorized local harness CLI | environment-only gh secret set; safe skip/partial/configured result and workflow PR when absent |

운영 명령은 공개 HTTP 라우트가 아닙니다. 실제 경로·백업·로그·자격 증명은 서버 또는 현재 세션에만 두며 Git·사용자 결과에 노출하지 않습니다. 이전·교체·복구는 후속 구현·리허설이 필요합니다. 허용한 CI 설정 기능은 하네스 0.5.0에서 구현했지만 현재 GitHub Secrets 권한 403으로 실제 설정과 자동 전송을 완료하지 못했습니다.
