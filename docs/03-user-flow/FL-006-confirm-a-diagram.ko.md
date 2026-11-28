# FL-006 그림 확정하기

[English](FL-006-confirm-a-diagram.md)

이 문서는 [FL-006-confirm-a-diagram.md](FL-006-confirm-a-diagram.md)의 한국어 사본입니다. 원본은 영어입니다.

목표: 사용자가 PC나 휴대폰에서 한 번 더 확인한 뒤 그림이나 항목 표를 확정하고, 에이전트가 기록하고, 모두 기록되면 단계가 통과합니다.

근거 요구사항: REQ-035, REQ-036, REQ-037, REQ-038, REQ-039, REQ-041, REQ-042, REQ-052, REQ-068, REQ-082

```mermaid
flowchart TD
  A(["카드나<br/>그림에서<br/>확정을 엶<br/>REQ-052"])
  B["바뀐 곳과<br/>확정 결과<br/>안내하기<br/>REQ-041, REQ-082"]
  C{"누가<br/>요청하나?"}
  D{"확정인가<br/>취소인가?"}
  E["보던 버전과<br/>함께 확정 기록<br/>REQ-035"]
  F["기록하는 일을<br/>에이전트<br/>할 일에<br/>REQ-038"]
  G["에이전트가<br/>병합된 기록을<br/>알림<br/>REQ-039"]
  H{"단계의 모든<br/>그림과 표가<br/>기록되었나?<br/>REQ-042"}
  I["단계<br/>체크포인트를<br/>통과로 봄<br/>REQ-042"]
  J["확정 전으로<br/>할 일에<br/>되돌림<br/>REQ-037"]
  P{"휴대폰에서<br/>확정인가<br/>취소인가?"}
  L{"이 그림을<br/>확정할까요?"}
  R1["확정 취소는<br/>PC에서<br/>REQ-068"]
  R2["에이전트 자격<br/>거절<br/>REQ-036"]
  Z(["끝"])
  A e1@--> B
  B e2@--> C
  C e3@-->|PC의 사용자| D
  C e4@-->|휴대폰의 사용자| P
  C e5@-->|에이전트| R2
  D e6@-->|확정| L
  D e7@-->|취소| J
  E e8@--> F
  F e9@--> G
  G e10@--> H
  H e11@-->|예| I
  H e12@-->|아니요| Z
  I e13@--> Z
  J e14@--> Z
  R1 e15@--> Z
  R2 e16@--> Z
  P e17@-->|확정| L
  P e18@-->|확정 취소| R1
  L e19@-->|예| E
  L e20@-->|아니요| Z
  %% legend: below
  classDef term fill:#e7f5ff,stroke:#1c7ed6,color:#212529
  classDef proc fill:#f8f9fa,stroke:#495057,color:#212529
  classDef decide fill:#f3f0ff,stroke:#7048e8,color:#212529
  classDef gap fill:#f1f3f5,stroke:#adb5bd,stroke-dasharray:2 3,color:#495057
  classDef pass stroke:#868e96,stroke-width:1.5px
  class A,Z term
  class B,E,F,G,I,J,R1,R2 proc
  class C,D,H,P,L decide
  class e1,e2,e3,e4,e5,e6,e7,e8,e9,e10,e11,e12,e13,e14,e15,e16,e17,e18,e19,e20 pass
```

| 모양 | 뜻 |
| --- | --- |
| 둥근 상자 | 흐름이 시작하거나 끝나는 곳 |
| 사각형 | 한 단계 |
| 마름모 | 결정. 분기마다 이름이 있음 |

## 실패 경로

- 확정 취소는 PC에서 (REQ-068)
- 에이전트 자격 거절 (REQ-036)
