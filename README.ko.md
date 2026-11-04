# NEXUS

[English](README.md)

NEXUS는 프로젝트의 단계·그림·논의를 인증된 브라우저 화면으로 보여 줍니다. 이 공개 저장소에는 서버, 화면, 01–12단계 원본과 확정된 디자인 토큰이 있습니다. 별도로 배포하는 **corthex-nexus 허브 플러그인은 [kodonghui/corthex](https://github.com/kodonghui/corthex/tree/main/plugins/corthex-nexus)에 남고**, 하네스 마켓플레이스로 설치합니다.

관리자는 2026-11-04에 저장소 분리와 독립 서버 계획을 승인했습니다. `codex/nexus-0.2`에서 계속 만들고, `main`에는 원래 저장소의 0.1 서버 이력을 옮깁니다. 0.2의 main 병합과 운영 전환은 출시 결정 때 정합니다. 순서는 저장소 분리 → 계획·계약 → 독립 서버 → 화면 → 전체 QA입니다. Workers는 빌드·검사와 되돌릴 길로 유지합니다.

## 읽을 곳

- [서버 설치](nexus/README.ko.md), [작업 계획](docs/10-wbs/nexus.ko.md), [QA와 실제 결과](docs/12-qa/nexus.ko.md).
- [OpenAPI 계약](docs/06-api/nexus.openapi.yaml), [도메인](docs/01-domain/nexus.ko.md), [데이터](docs/05-erd/nexus.ko.md), [화면](docs/08-screens/nexus/README.ko.md), [디자인](docs/09-mockup/nexus/README.ko.md).
- [저장소 규칙](AGENTS.md), [보안 범위](SECURITY.ko.md), [이주와 이력](docs/history/README.ko.md).

`hub-ref.json`은 허브와 서버를 함께 검사하는 원래 저장소의 커밋을 고정합니다. `python tools/fetch_hub_ref.py --destination <저장소-밖-절대경로>`로 준비하고 `CORTHEX_HUB_CHECKOUT`을 설정합니다. 시험은 고정 커밋을 확인하며 네트워크에서 가져오지 않습니다. Node 24 LTS+, Python 3.8+로 AGENTS.md의 검사를 실행하고 외부 계약 도구 버전은 CI에 고정합니다.

## 옮겨 온 이력

**2026-11-04 KST**에 `kodonghui/corthex`에서 옮겼습니다. 원본 main은 `855bc6b463a4a5c57c949d1166b58db3915587c2`, 원본 통합 기준은 `76508243558abaedcc15bb422c454341845fcabd`입니다. 뽑은 머리는 각각 `93adb595f439e07e8a3476f3bd564105d034a5b6`, `23fb72a4a1bc003e18942cb48fb9d97c4f9b30b2`입니다. [커밋 대응표](docs/history/2026-11-04-commit-map.txt)와 [브랜치 대응표](docs/history/2026-11-04-branch-map.json)로 QA·Notion의 예전 SHA를 찾습니다. 예전 PR·이슈는 `kodonghui/corthex#번호`로 구분합니다.

DB·백업·자격과 실제 배포 접속값은 저장소 밖에 둡니다. 실제 프로젝트 스냅샷 첫 보내기, 운영 데이터·주소 전환, 기존 Worker·D1 정리와 출시 태그는 마지막 출시 결정에 남겨 둡니다.
