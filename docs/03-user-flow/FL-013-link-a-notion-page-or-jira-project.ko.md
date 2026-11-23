# FL-013 Notion 페이지나 Jira 프로젝트 연결하기

[English](FL-013-link-a-notion-page-or-jira-project.md)

이 문서는 [FL-013-link-a-notion-page-or-jira-project.md](FL-013-link-a-notion-page-or-jira-project.md)의 한국어 사본입니다. 원본은 영어입니다.

목표: 사용자가 프로젝트나 단계에 다른 도구를 연결하고, 그 상태를 단계 옆에서 읽기만 합니다.

근거 요구사항: REQ-058, REQ-059, REQ-060, REQ-061

```mermaid
flowchart TD
  A(["사용자가<br/>프로젝트나<br/>단계에 링크를<br/>더함<br/>REQ-058"])
  B{"지금 그 도구를<br/>읽을 수 있나?<br/>REQ-061"}
  C["읽은 상태를<br/>보여 주고 쓰지<br/>않음<br/>REQ-058, REQ-060"]
  D["마지막으로<br/>알던 상태와<br/>시각 보여 주기<br/>REQ-061"]
  E{"사용자가<br/>연결을 빼나?<br/>REQ-059"}
  F["링크 빼기<br/>REQ-059"]
  Z(["끝"])
  A e1@--> B
  B e2@-->|예| C
  B e3@-->|아니요| D
  C e4@--> E
  D e5@--> E
  E e6@-->|예| F
  E e7@-->|아니요| Z
  F e8@--> Z
  %% legend: below
  classDef term fill:#e7f5ff,stroke:#1c7ed6,color:#212529
  classDef proc fill:#f8f9fa,stroke:#495057,color:#212529
  classDef decide fill:#f3f0ff,stroke:#7048e8,color:#212529
  classDef gap fill:#f1f3f5,stroke:#adb5bd,stroke-dasharray:2 3,color:#495057
  classDef pass stroke:#868e96,stroke-width:1.5px
  class A,Z term
  class C,D,F proc
  class B,E decide
  class e1,e2,e3,e4,e5,e6,e7,e8 pass
```

| 모양 | 뜻 |
| --- | --- |
| 둥근 상자 | 흐름이 시작하거나 끝나는 곳 |
| 사각형 | 한 단계 |
| 마름모 | 결정. 분기마다 이름이 있음 |

## 실패 경로

- 마지막으로 알던 상태와 시각 보여 주기 (REQ-061)
