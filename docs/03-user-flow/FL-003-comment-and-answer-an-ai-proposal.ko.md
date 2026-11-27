# FL-003 댓글을 달고 AI 제안에 답하기

[English](FL-003-comment-and-answer-an-ai-proposal.md)

이 문서는 [FL-003-comment-and-answer-an-ai-proposal.md](FL-003-comment-and-answer-an-ai-proposal.md)의 한국어 사본입니다. 원본은 영어입니다.

목표: 사용자가 그림에 댓글을 달고, 에이전트가 답하거나 변경을 제안하고, 사용자가 받아들이거나 거절합니다.

근거 요구사항: REQ-020, REQ-021, REQ-022, REQ-023, REQ-024, REQ-025, REQ-034, REQ-053, REQ-054, REQ-055, REQ-068

```mermaid
flowchart TD
  A(["사용자가<br/>그림, 요소,<br/>행에 댓글<br/>REQ-020"])
  B["댓글을<br/>에이전트<br/>할 일에<br/>더하기<br/>REQ-053"]
  C{"다른 세션이<br/>맡고 있나?<br/>REQ-054, REQ-055"}
  D{"답인가<br/>변경인가?"}
  E["에이전트가<br/>스레드에 답글<br/>REQ-021"]
  F["에이전트가<br/>AI 제안을<br/>그림 위에 겹쳐<br/>올림<br/>REQ-022"]
  G{"누가 제안에<br/>답하나?"}
  H{"한 번 더 묻고<br/>받아들이나?"}
  I["반영을<br/>에이전트<br/>할 일에<br/>더하기<br/>REQ-023"]
  J["거절됨 표시,<br/>스레드는 열림<br/>REQ-024"]
  K["끝나면<br/>사용자가<br/>스레드를 닫음<br/>REQ-034"]
  R1["점유 거절<br/>REQ-055"]
  R3["에이전트 자격<br/>거절<br/>REQ-025"]
  Z(["끝"])
  Y(["반영으로:<br/>FL-005"])
  A e1@--> B
  B e2@-->|에이전트가 점유| C
  C e3@-->|예| R1
  C e4@-->|아니요| D
  D e5@-->|답| E
  D e6@-->|변경| F
  E e7@--> K
  F e8@--> G
  G e9@-->|PC의 사용자| H
  G e10@-->|휴대폰의 사용자| H
  G e11@-->|에이전트| R3
  H e12@-->|예| I
  H e13@-->|아니요| J
  I e14@--> Y
  J e15@--> K
  K e16@--> Z
  R1 e17@--> Z
  R3 e19@--> Z
  %% legend: below
  classDef term fill:#e7f5ff,stroke:#1c7ed6,color:#212529
  classDef proc fill:#f8f9fa,stroke:#495057,color:#212529
  classDef decide fill:#f3f0ff,stroke:#7048e8,color:#212529
  classDef gap fill:#f1f3f5,stroke:#adb5bd,stroke-dasharray:2 3,color:#495057
  classDef pass stroke:#868e96,stroke-width:1.5px
  class A,Z,Y term
  class B,E,F,I,J,K,R1,R3 proc
  class C,D,G,H decide
  class e1,e2,e3,e4,e5,e6,e7,e8,e9,e10,e11,e12,e13,e14,e15,e16,e17,e19 pass
```

| 모양 | 뜻 |
| --- | --- |
| 둥근 상자 | 흐름이 시작하거나 끝나는 곳 |
| 사각형 | 한 단계 |
| 마름모 | 결정. 분기마다 이름이 있음 |

## 실패 경로

- 점유 거절 (REQ-055)
- 에이전트 자격 거절 (REQ-025)
