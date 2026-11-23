# FL-009 에이전트 자격 발급·폐기하기

[English](FL-009-issue-and-revoke-agent-access.md)

이 문서는 [FL-009-issue-and-revoke-agent-access.md](FL-009-issue-and-revoke-agent-access.md)의 한국어 사본입니다. 원본은 영어입니다.

목표: 사용자가 에이전트에게 hub 명령용 자격을 주고, 다시 거둘 수 있습니다.

근거 요구사항: REQ-018, REQ-064, REQ-065, REQ-078

```mermaid
flowchart TD
  A(["사용자가<br/>에이전트에게<br/>자격 발급<br/>REQ-064"])
  B["비밀 값을 한<br/>번만 보여 주기<br/>REQ-064"]
  C["다이제스트만<br/>저장<br/>REQ-078"]
  D["에이전트가 그<br/>자격으로<br/>hub 명령<br/>REQ-018"]
  E{"사용자가<br/>폐기하나?<br/>REQ-065"}
  F["그 자격의 다음<br/>요청 거절<br/>REQ-065"]
  Z(["끝"])
  A e1@--> B
  B e2@--> C
  C e3@--> D
  D e4@--> E
  E e5@-->|예| F
  E e6@-->|아니요| Z
  F e7@--> Z
  %% legend: below
  classDef term fill:#e7f5ff,stroke:#1c7ed6,color:#212529
  classDef proc fill:#f8f9fa,stroke:#495057,color:#212529
  classDef decide fill:#f3f0ff,stroke:#7048e8,color:#212529
  classDef gap fill:#f1f3f5,stroke:#adb5bd,stroke-dasharray:2 3,color:#495057
  classDef pass stroke:#868e96,stroke-width:1.5px
  class A,Z term
  class B,C,D,F proc
  class E decide
  class e1,e2,e3,e4,e5,e6,e7 pass
```

| 모양 | 뜻 |
| --- | --- |
| 둥근 상자 | 흐름이 시작하거나 끝나는 곳 |
| 사각형 | 한 단계 |
| 마름모 | 결정. 분기마다 이름이 있음 |

## 실패 경로

- 그 자격의 다음 요청 거절 (REQ-065)
