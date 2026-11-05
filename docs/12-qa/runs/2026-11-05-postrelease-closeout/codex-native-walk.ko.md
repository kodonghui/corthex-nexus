# 출시 뒤 Codex 실제 도구 걷기 - 2026-11-05

기준은 CORTHEX0.7.0 `c016733`·NEXUS 런타임 `74f9e45`, 설치 CLI는0.166.0-alpha.6입니다. 기본 모델 설정과 현재 사용자/프로젝트 실행 규칙을 유지했습니다. 수동 제공한 스킬·합성 fixture의 시험이며 자동 플러그인 발견이나 실제 Access 제공자 인수를 뜻하지 않습니다.

| 시험 | 실제 관측 | 결과와 범위 |
| --- | --- | --- |
| 읽기 정책 | native rg 완료1회가 작업자가 만든 canary를 읽고 실제 출력·최종 marker가 일치, fixture 해시 불변 | read-only/never에서 통과. ignore-rules·bypass·HOME/CODEX_HOME 변경·자격 파일 복사0 |
| 새 ERD 표 | native 파일 패치1회에 TBL-002 cache_epochs·CTX-001·terms:none·migration·진행 기록을 함께 작성. native rg 재읽기와 node:sqlite 검사를 완료 | 스키마 생성·기존2행 보존·제약·트랜잭션·확인 지점 없는 in_progress를 검사. 출력은 PASS5줄·LIMIT1줄(원래 baseline migration 없음). 마지막 진행 보고 작성 중 외곽180초 제한에 걸린 timeout/exit1은 보존. 실제 PR은 생성하지 않음 |
| 서로 다른 기본 커밋 A→B | 진짜 로컬 bare origin에 A와 strict descendant B를 만들고 서버는 A 보유. native rg가 현재 core/profile/source를 읽음 | 설치 Python으로 정상 hub.py --help를 시작할 때 Windows AccessDenied. 첫 거부에서 우회 없이 중단. native fetch·동기화·todo HTTP0. 부분 검증 |

정상 허브 parser로 표2개와 새 기술 표의 빈 용어 참조를 따로 확인했고, format1 단계 기록은 in_progress·checkpoint0입니다. 이 작업자 측 parser 확인은 모델의 실제 native SQL/도구 관측과 구분합니다.

TC718은 같은 실제 hosted PR/merge를 수행하지 않아 partial을 유지합니다. TC630은 정상 hub 프로세스를 시작할 수 없어 partial입니다. TC629의 실제 ERD 병합→기본 브랜치 전송과 TC726의 실제 승인/기록 흐름은 미실행입니다. TC707~710의 기존 model/local 통과는 보존하며 이 시험자가 원본/Notion 판정을 바꾸지 않았습니다.

필요 허용 한 줄: Codex 제한 실행 환경에서 설치 Python3.13 실행 파일의 허브 실행(--help 및 이 합성 fixture의 --home 명령만)을 허용해야 합니다. 확인된 것은 OS 프로세스 시작 AccessDenied이며 ACL/AppLocker/Codex sandbox 중 정확한 원인은 미확인입니다. 자동 승인 검토가 거절한 것은 아닙니다. Python을 복사하거나 다른 실행기로 숨겨 호출하거나 정책을 낮추는 방법은 시도하지 않았습니다.

쓰기는 소유한 합성 fixture 안에만 했습니다. 운영·공유 개발 서버 쓰기0입니다. peer 정상 종료 결과가 미확인된 뒤 소유 프로세스를 중지하고 종료를 기다렸으며 해당 loopback 포트 닫힘을 확인했습니다. 시작된 native 명령은 모두 완료 이벤트가 있습니다. 기존 시도·timeout·프로그램 발견 실패·작업자 준비/helper 중단은 남겼습니다.

근거는 같은 폴더의 summary.public-safe.json과 case-verdict-suggestions.safe.json, 각 실행 폴더의 receipt/events/artifact-verification/cleanup 파일입니다. native event에는 기기별 경로가 있으므로 원문은 비공개 검토용이며 공개 전 경로를 가려야 합니다.
