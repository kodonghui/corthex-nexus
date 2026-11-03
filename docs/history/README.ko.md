# 저장소 분리, 2026-11-04

[English](README.md)

관리자는 허브·코어를 원래 하네스에 남기고 NEXUS를 지금 나누기로 승인했습니다. 완료된 허브 병합 `76508243558abaedcc15bb422c454341845fcabd`가 통합 기준입니다. 만들던 화면은 로컬 복구 묶음으로 보존해 이후 제품 작업으로 이어가며, 자르기 위해 결함이 있는 UI를 병합하지 않았습니다.

새 사본에서 **git-filter-repo 2.47.0**으로 `main`, `codex/nexus-0.2`를 [경로 목록](2026-11-04-paths.txt)에 따라 뽑았습니다. 예전 이름·상태와 rename 연결을 확인했으며 과거 경로132개, 선택 밖으로 이어지는 rename은 없었습니다. 커밋 메시지의 PR·이슈는 `regex:(?<![\w/])#(\d+)==>kodonghui/corthex#\1`로 원래 저장소를 가리키게 했습니다. 커밋 참조는 대응표를 위해 유지했습니다. 원본 저장소의 이력은 바꾸지 않았고 두 브랜치만 올립니다.

공식 [커밋 대응표](2026-11-04-commit-map.txt)의 삭제 커밋0을 그대로 뒀습니다. 제외한 파일만 바꾼 커밋은 빠질 수 있으므로 [브랜치 대응표](2026-11-04-branch-map.json)에 원본·결과 머리 쌍을 적었습니다. 머리별 선택 파일의 내용·권한은 원본과 정확히 같습니다. main94개, 통합131개, 도달 가능한 커밋71개입니다.

처음 올리기 전에 도달 가능한 UTF-8 파일 버전414개가 원래 공개 안전 규칙을 통과했습니다. 공식 Gitleaks 8.30.1을 SHA256 확인 후 사용했습니다. 두 API 언어 사본의 공개 `Idempotency-Key` 예시가 일반 키 규칙에 걸렸지만, 인증값이 아닌 쓰기 ID임을 확인했습니다. 그 두 fingerprint만 `.gitleaksignore`에 적었으며 검토한 이력 검사 결과는0개입니다. 진단에는 값을 숨기고 새 기본 파일도 올리기 전 같은 현재 파일·이력 검사를 받습니다.

제품의 Linux CI는 Node 서버, Worker 빌드, 기존 계약 전부, 고정한 허브·서버 연결과 공개 안전을 검사합니다. 독립 Node/SQLite와 실제 개발 서버 계약 job은 해당 작업에서 더하며 이번 이주로 완료했다고 하지 않습니다. 허브의 세 OS·Python 호환 검사는 원래 저장소에 남습니다.

근거: [git-filter-repo 안내](https://github.com/newren/git-filter-repo/blob/main/Documentation/git-filter-repo.txt), [Gitleaks 8.30.1](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1). 비공개 작업 기록에는 검사 해시·명령·예시 판정과 화면 복구 묶음을 보존하며 그 묶음에 자격은 없습니다.
