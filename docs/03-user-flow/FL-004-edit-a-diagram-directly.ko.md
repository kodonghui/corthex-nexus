# FL-004 그림을 직접 고치기

[English](FL-004-edit-a-diagram-directly.md)

이 문서는 [FL-004-edit-a-diagram-directly.md](FL-004-edit-a-diagram-directly.md)의 한국어 사본입니다. 원본은 영어입니다.

목표: 사용자가 PC에서 요소 이름을 바꾸거나 두 요소를 잇고, 그 편집이 Git 반영을 기다립니다.

근거 요구사항: REQ-026, REQ-027, REQ-028, REQ-053, REQ-068

```mermaid
flowchart TD
  A(["사용자가<br/>이름을<br/>바꾸거나 선을<br/>이음<br/>REQ-026"])
  B{"PC인가?<br/>REQ-068"}
  C["받아들인<br/>변경안으로<br/>기록<br/>REQ-026"]
  D["요소를 반영<br/>대기로 표시<br/>REQ-027"]
  E{"반영 전에<br/>사용자가<br/>취소하나?<br/>REQ-028"}
  F["변경안을<br/>버리고 그것<br/>없이 그림<br/>REQ-028"]
  G["반영을<br/>에이전트<br/>할 일에<br/>더하기<br/>REQ-053"]
  R1["휴대폰에서는<br/>직접 편집 없음<br/>REQ-068"]
  Z(["끝"])
  Y(["반영으로:<br/>FL-005"])
  A e1@--> B
  B e2@-->|아니요| R1
  B e3@-->|예| C
  C e4@--> D
  D e5@--> E
  E e6@-->|예| F
  E e7@-->|아니요| G
  F e8@--> Z
  G e9@--> Y
  R1 e10@--> Z
  %% legend: below
  classDef term fill:#e7f5ff,stroke:#1c7ed6,color:#212529
  classDef proc fill:#f8f9fa,stroke:#495057,color:#212529
  classDef decide fill:#f3f0ff,stroke:#7048e8,color:#212529
  classDef gap fill:#f1f3f5,stroke:#adb5bd,stroke-dasharray:2 3,color:#495057
  classDef pass stroke:#868e96,stroke-width:1.5px
  class A,Z,Y term
  class C,D,F,G,R1 proc
  class B,E decide
  class e1,e2,e3,e4,e5,e6,e7,e8,e9,e10 pass
```

| 모양 | 뜻 |
| --- | --- |
| 둥근 상자 | 흐름이 시작하거나 끝나는 곳 |
| 사각형 | 한 단계 |
| 마름모 | 결정. 분기마다 이름이 있음 |

## 실패 경로

- 휴대폰에서는 직접 편집 없음 (REQ-068)
