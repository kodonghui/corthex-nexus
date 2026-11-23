# FL-012 이벤트 스토밍 워크숍 하기

[English](FL-012-run-an-event-storming-workshop.md)

이 문서는 [FL-012-run-an-event-storming-workshop.md](FL-012-run-an-event-storming-workshop.md)의 한국어 사본입니다. 원본은 영어입니다.

목표: 사용자와 에이전트가 자유 캔버스에서 도메인 설계를 스텝마다 만들고, 확정한 스텝은 도메인 문서로 들어갑니다.

근거 요구사항: REQ-043, REQ-044, REQ-045, REQ-046, REQ-047, REQ-048, REQ-049, REQ-050, REQ-051

화면(07단계): SCR-145

```mermaid
flowchart TD
  A(["사용자나<br/>에이전트가<br/>워크숍을 엶<br/>REQ-044"])
  B["스텝마다<br/>프레임 하나인<br/>보드를<br/>원본으로<br/>REQ-044, REQ-048"]
  M{"Miro 보드에서<br/>시작하나?<br/>REQ-051"}
  N["스티커의 글,<br/>색, 위치를<br/>옮김<br/>REQ-051"]
  C["에이전트가<br/>신뢰도 표시와<br/>함께 스텝 초안<br/>REQ-045"]
  D{"사람이 만든<br/>스티커를<br/>지우나?<br/>REQ-047"}
  E["사용자가<br/>PC에서<br/>스티커를 고침<br/>REQ-046"]
  F{"사용자가<br/>스텝을<br/>확정하나?<br/>REQ-043"}
  G["스텝을 문서에<br/>쓰는 일을<br/>에이전트<br/>할 일에<br/>REQ-049"]
  H{"마지막<br/>스텝까지<br/>확정하고<br/>썼나?<br/>REQ-050"}
  I["워크숍 닫기<br/>REQ-050"]
  R1["에이전트의<br/>변경 거절<br/>REQ-047"]
  Z(["끝"])
  A e1@--> B
  B e2@--> M
  M e3@-->|예| N
  M e4@-->|아니요| C
  N e5@--> C
  C e6@--> D
  D e7@-->|예| R1
  D e8@-->|아니요| E
  R1 e9@--> E
  E e10@--> F
  F e11@-->|아니요| E
  F e12@-->|예| G
  G e13@--> H
  H e14@-->|아니요, 다음 스텝| C
  H e15@-->|예| I
  I e16@--> Z
  %% legend: below
  classDef term fill:#e7f5ff,stroke:#1c7ed6,color:#212529
  classDef proc fill:#f8f9fa,stroke:#495057,color:#212529
  classDef decide fill:#f3f0ff,stroke:#7048e8,color:#212529
  classDef gap fill:#f1f3f5,stroke:#adb5bd,stroke-dasharray:2 3,color:#495057
  classDef pass stroke:#868e96,stroke-width:1.5px
  class A,Z term
  class B,N,C,E,G,I,R1 proc
  class M,D,F,H decide
  class e1,e2,e3,e4,e5,e6,e7,e8,e9,e10,e11,e12,e13,e14,e15,e16 pass
```

| 모양 | 뜻 |
| --- | --- |
| 둥근 상자 | 흐름이 시작하거나 끝나는 곳 |
| 사각형 | 한 단계 |
| 마름모 | 결정. 분기마다 이름이 있음 |

## 실패 경로

- 에이전트의 변경 거절 (REQ-047)
