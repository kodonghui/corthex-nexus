# 재설계 운영 인터페이스

[English](operator.md)

| ID | Interface | From | Access | Outcomes |
| --- | --- | --- | --- | --- |
| API-237 | 보호된 백업과 목록 | SPEC-341, SPEC-342 | 운영자 전용 로컬 명령 | 원래 ID·digest·확인 응답 쓰기 경계를 포함한 일관된 보호 목록 |
| API-238 | 기존 데이터 복원과 대조 | SPEC-341, SPEC-342, SPEC-343 | 운영자 전용 격리 마이그레이션 명령 | ID 매핑·개수·외래 키·보호 콘텐츠 검사, 불일치 시 중단 |
| API-239 | 검증과 운영 교체·유지 | SPEC-345 | 운영자 전용 배포 명령 | 모든 Must QA·복구 증거 뒤 유지·교체 결정 기록 |
| API-240 | 확인 응답한 쓰기 복구 | SPEC-344 | 운영자 전용 롤백 명령 | 호환 런타임·마지막 쓰기 기록 대조, 확인 응답 쓰기 누락 시 미완료 |
| API-241 | hub.py setup-ci PROJECT | SPEC-331, SPEC-327, SPEC-328 | 허용한 로컬 하네스 CLI | 환경 변수만 읽는 gh secret set, 안전한 건너뛰기·부분 실패·설정 결과, 워크플로 누락 시 PR |

운영자 명령은 보호된 로컬 계정에서 실행합니다. 실제 경로, 백업, 로그와 자격 증명은 서버 또는 보호된 세션에 둡니다. 하네스 0.5.0으로 기존 레포 3개의 Actions를 설정했고 새 실행에서 전송 수신을 확인했습니다. 배포 검증에는 정확한 후보 커밋을 사용합니다.

## 격리된 운영자 리허설

Node 24와 소유자만 접근할 수 있는 파일을 사용합니다. 백업과 복구의 출력은 새 권한 0700 디렉터리에 저장합니다. 이미 인증된 소유자 레코드를 가진 격리된 v2 데이터베이스로 복원합니다. 레거시 원본 보관본에는 형식, ID, 원본 참조와 새 형식으로 표현할 수 없는 레코드를 유지합니다.

```sh
node nexus/src/rebuild-operator.js backup-legacy /protected/live.sqlite /protected/legacy-inventory
node nexus/src/rebuild-operator.js import-legacy /protected/legacy-inventory/legacy.sqlite /protected/legacy-inventory/inventory.json /protected/owner-map.json /protected/candidate.sqlite
node nexus/src/rebuild-operator.js backup-rebuild /protected/candidate.sqlite /protected/baseline
node nexus/src/rebuild-operator.js recover /protected/baseline/rebuild.sqlite /protected/baseline/baseline.json /protected/frozen/rebuild.sqlite /protected/recovery
node nexus/src/rebuild-operator.js check-release /protected/release-evidence.json MAIN_COMMIT
```

인벤토리에 스키마, 수량, 원본 ID와 행 다이제스트, 스냅샷 항목 다이제스트, 마지막 레거시 쓰기 경계를 기록합니다. 소유자 매핑은 레거시 프로젝트 이름별로 인증된 `owner_id`, GitHub `repository_url`, `default_branch`를 지정합니다. 후보 데이터베이스는 보호 인벤토리와 백업을 대조하고 이전 및 보관 매핑을 기록합니다. 재생은 트랜잭션 변경 집합을 적용하고 승인된 결과 다이제스트를 수신 기록과 대조합니다. 누락이나 충돌이 있으면 재생 트랜잭션을 롤백합니다.

배포 근거 인덱스는 후보 커밋과 보호된 보고서별 SHA-256을 지정합니다. API, 브라우저, 성능, 이전, 복구, 호환성, 미리 보기 격리, OIDC, 게시, 소유자 체크포인트를 검증합니다. 보고서가 완료 조건을 충족할 때까지 유지 결정을 반환합니다. 서비스와 환경 파일 예시는 `nexus/ops/`에 있습니다.

개발 리허설에서는 레거시 샘플 프로젝트 3개와 백업 이후 승인된 쓰기 2건을 복구했습니다. 운영 인벤토리, 실제 소유자 매핑, 운영 이전 및 전환에는 보호된 서버 접속이 필요합니다.

보호된 런타임 환경에서 `NEXUS_METRICS=1`을 설정하면 요청 처리 시간과 본문 수신 이후 처리 시간을 측정합니다. 게시·메모 수신, 질문 대기, 재시도 건너뜀, 실패, claim 만료 및 거부의 누적 횟수도 프로세스에서 집계합니다. 오류 지표의 추적 ID는 오류 응답과 같습니다. 지표에는 숫자로 표시한 시간·용량·횟수, 정해진 처리 결과와 생성한 추적 ID가 포함됩니다.
