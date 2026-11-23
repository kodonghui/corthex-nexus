# FL-010 프로젝트 공간 지우기

[English](FL-010-delete-a-project-space.md)

이 문서는 [FL-010-delete-a-project-space.md](FL-010-delete-a-project-space.md)의 한국어 사본입니다. 원본은 영어입니다.

목표: 사용자가 함께 지워질 것을 본 뒤 NEXUS에서 프로젝트를 지웁니다.

근거 요구사항: REQ-016, REQ-017

화면(07단계): SCR-144

```mermaid
flowchart TD
  A(["프로젝트 공간<br/>지우기 요청"])
  B{"누가<br/>요청하나?"}
  C["지워질 것 보여<br/>주기<br/>REQ-016"]
  D{"사용자가<br/>확인하나?<br/>REQ-016"}
  E["스냅숏, 그림,<br/>댓글, 확정,<br/>레이아웃<br/>지우기<br/>REQ-016"]
  F["모두 그대로 둠"]
  R1["에이전트 자격<br/>거절<br/>REQ-017"]
  Z(["끝"])
  A e1@--> B
  B e2@-->|사용자| C
  B e3@-->|에이전트| R1
  C e4@--> D
  D e5@-->|예| E
  D e6@-->|아니요| F
  E e7@--> Z
  F e8@--> Z
  R1 e9@--> Z
  %% legend: below
  classDef term fill:#e7f5ff,stroke:#1c7ed6,color:#212529
  classDef proc fill:#f8f9fa,stroke:#495057,color:#212529
  classDef decide fill:#f3f0ff,stroke:#7048e8,color:#212529
  classDef gap fill:#f1f3f5,stroke:#adb5bd,stroke-dasharray:2 3,color:#495057
  classDef pass stroke:#868e96,stroke-width:1.5px
  class A,Z term
  class C,E,F,R1 proc
  class B,D decide
  class e1,e2,e3,e4,e5,e6,e7,e8,e9 pass
```

| 모양 | 뜻 |
| --- | --- |
| 둥근 상자 | 흐름이 시작하거나 끝나는 곳 |
| 사각형 | 한 단계 |
| 마름모 | 결정. 분기마다 이름이 있음 |

## 실패 경로

- 에이전트 자격 거절 (REQ-017)
