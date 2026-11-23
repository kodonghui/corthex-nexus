# NEXUS

[English](README.md)

NEXUS는 프로젝트의 단계·그림·논의를 비공개 브라우저 화면으로 보여 줍니다. **NEXUS v3는 2026-11-22부터 이 저장소에서 01단계부터 다시 만들고 있습니다.** 아직 v3 제품은 없으며, 단계 원본과 그다음 코드가 풀 리퀘스트로 이곳에 들어옵니다.

- **v2는 태그 [`archive/nexus-v2-2026-11-22`](https://github.com/kodonghui/corthex-nexus/tree/archive/nexus-v2-2026-11-22)에 보관**되어 있습니다. 서버, 브라우저 화면, 디자인 토큰, 단계 원본과 QA 기록이 그대로 있습니다.
- **브랜치 [`legacy/v2`](https://github.com/kodonghui/corthex-nexus/tree/legacy/v2)가 지금 운영 중인 인스턴스를 맡습니다.** v3가 대신할 때까지 운영 인스턴스의 수정은 이 브랜치로 갑니다.
- **허브 플러그인과 코어 스킬은 [kodonghui/corthex](https://github.com/kodonghui/corthex)에 남습니다.** `hub-ref.json`은 이 저장소의 검사와 push 작업이 쓰는 허브 커밋을 고정합니다.

## 작업하기

저장소 규칙과 검사는 [AGENTS.md](AGENTS.md)에, 보안 범위는 [SECURITY.ko.md](SECURITY.ko.md)에 있습니다. [server/](server/README.ko.md)에는 WBS의 태스크 순서대로 만드는 v3 서버가 있습니다. `.corthex/project.json`은 허브에 프로젝트와 단계를 알리며 파트는 `nexus` 하나이고, `.corthex/stages/nexus.json`은 그 파트의 진행을 기록합니다. 커밋이 `main`에 들어오면 `NEXUS push` 워크플로가 고정된 허브로 기본 브랜치의 스냅샷을 관리자의 NEXUS 서버에 보냅니다.
