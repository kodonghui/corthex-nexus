# NEXUS

[English](README.md)

NEXUS는 프로젝트의 단계·그림·논의를 인증된 브라우저 화면으로 보여 줍니다. 이 공개 저장소에는 서버, 화면, 01–12단계 원본과 확정된 디자인 토큰이 있습니다. 별도로 배포하는 **corthex-nexus 허브 플러그인은 [kodonghui/corthex](https://github.com/kodonghui/corthex/tree/main/plugins/corthex-nexus)에 남고**, 하네스 마켓플레이스로 설치합니다.

관리자는 2026-11-04에 저장소 분리와 독립 서버 계획을 승인했습니다. `main`에는 이제0.2 독립 서버와 브라우저 구현이 통합되어 있으며 이후 작업은 `codex/nexus-0.2`를 거칩니다. 운영 선택과 출시 태그는 [조건부 출시 결정](AGENTS.md)과 날짜가 있는 QA/WBS 근거를 따릅니다. 실제 선택된 운영 런타임은 출시·복구 기록에서 확인합니다. Workers는 빌드·검사 호환성을 유지합니다.

## 읽을 곳

- [서버 설치](nexus/README.ko.md), [작업 계획](docs/10-wbs/nexus.ko.md), [QA와 실제 결과](docs/12-qa/nexus.ko.md).
- [OpenAPI 계약](docs/06-api/nexus.openapi.yaml), [도메인](docs/01-domain/nexus.ko.md), [데이터](docs/05-erd/nexus.ko.md), [화면](docs/08-screens/nexus/README.ko.md), [디자인](docs/09-mockup/nexus/README.ko.md).
- [저장소 규칙](AGENTS.md), [보안 범위](SECURITY.ko.md), [이주와 이력](docs/history/README.ko.md).

`hub-ref.json`은 허브와 서버를 함께 검사하는 원래 저장소의 커밋을 고정합니다. `python tools/fetch_hub_ref.py --destination <저장소-밖-절대경로>`로 준비하고 `CORTHEX_HUB_CHECKOUT`을 설정합니다. 시험은 고정 커밋을 확인하며 네트워크에서 가져오지 않습니다. Node 24 LTS+, Python 3.8+로 AGENTS.md의 검사를 실행하고 외부 계약 도구 버전은 CI에 고정합니다.

## 옮겨 온 이력

**2026-11-04 KST**에 `kodonghui/corthex`에서 옮겼습니다. 원본 main은 `855bc6b463a4a5c57c949d1166b58db3915587c2`, 원본 통합 기준은 `76508243558abaedcc15bb422c454341845fcabd`입니다. 뽑은 머리는 각각 `93adb595f439e07e8a3476f3bd564105d034a5b6`, `23fb72a4a1bc003e18942cb48fb9d97c4f9b30b2`입니다. [커밋 대응표](docs/history/2026-11-04-commit-map.txt)와 [브랜치 대응표](docs/history/2026-11-04-branch-map.json)로 QA·Notion의 예전 SHA를 찾습니다. 예전 PR·이슈는 `kodonghui/corthex#번호`로 구분합니다.

DB·백업·자격과 실제 배포 접속값은 저장소 밖에 둡니다. 실제 프로젝트 스냅샷 첫 보내기와 기존 Worker/D1 삭제는 각각 별도 확인을 받습니다. 전환 뒤 기존 Worker/D1은 최소14일 그대로 보존합니다. 새 origin을 공개한 뒤에는 실제 쓰기 관측과 관계없이13개 전체 테이블 DB가 기준이므로 최신 일관 백업에 검증된 호환0.2 런타임이나 검토한 수정을 사용합니다. 옛 snapshot 전용 D1으로만 돌리는 것은 무손실 복구가 아닙니다. [이주·복구 경계](docs/12-qa/runs/2026-11-05-origin-recovery.ko.md)를 따르며 운영 선택과 태그는 위의 조건부 출시 근거를 따릅니다.
