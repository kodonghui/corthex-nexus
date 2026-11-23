# FL-005 받아들인 변경을 Git에 반영하기

[English](FL-005-reflect-accepted-changes-into-git.md)

이 문서는 [FL-005-reflect-accepted-changes-into-git.md](FL-005-reflect-accepted-changes-into-git.md)의 한국어 사본입니다. 원본은 영어입니다.

목표: 에이전트가 그림의 받아들인 변경안을 PR 하나로 단계 문서에 넣습니다.

근거 요구사항: REQ-001, REQ-029, REQ-030, REQ-031, REQ-032, REQ-053, REQ-054, REQ-056, REQ-057

화면(07단계): SCR-145

```mermaid
flowchart TD
  A(["에이전트가<br/>반영할<br/>변경안을 점유<br/>REQ-053, REQ-054"])
  B["에이전트가<br/>그림의<br/>변경안으로<br/>PR 하나를 엶<br/>REQ-032"]
  C["알린 PR을<br/>변경안에 잇기<br/>REQ-029"]
  D["PR이 열린 동안<br/>점유 유지<br/>REQ-057"]
  E{"PR이<br/>병합되었나?"}
  F["병합 커밋이 든<br/>스냅숏 그리기<br/>REQ-001"]
  G["변경안을<br/>반영됨으로<br/>표시<br/>REQ-030"]
  H["요청한 스레드<br/>닫기<br/>REQ-031"]
  R1["60분 쓰기가<br/>없으면 점유<br/>풀기<br/>REQ-056"]
  Z(["끝"])
  A e1@--> B
  B e2@--> C
  C e3@--> D
  D e4@--> E
  E e5@-->|예| F
  E e6@-->|병합 없이 닫힘| R1
  F e7@--> G
  G e8@--> H
  H e9@--> Z
  R1 e10@--> Z
  %% legend: below
  classDef term fill:#e7f5ff,stroke:#1c7ed6,color:#212529
  classDef proc fill:#f8f9fa,stroke:#495057,color:#212529
  classDef decide fill:#f3f0ff,stroke:#7048e8,color:#212529
  classDef gap fill:#f1f3f5,stroke:#adb5bd,stroke-dasharray:2 3,color:#495057
  classDef pass stroke:#868e96,stroke-width:1.5px
  class A,Z term
  class B,C,D,F,G,H,R1 proc
  class E decide
  class e1,e2,e3,e4,e5,e6,e7,e8,e9,e10 pass
```

| 모양 | 뜻 |
| --- | --- |
| 둥근 상자 | 흐름이 시작하거나 끝나는 곳 |
| 사각형 | 한 단계 |
| 마름모 | 결정. 분기마다 이름이 있음 |

## 실패 경로

- 60분 쓰기가 없으면 점유 풀기 (REQ-056)
