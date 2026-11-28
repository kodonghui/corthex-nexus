# FL-002 할 일에서 단계 읽기

[English](FL-002-read-a-stage-from-the-to-do.md)

이 문서는 [FL-002-read-a-stage-from-the-to-do.md](FL-002-read-a-stage-from-the-to-do.md)의 한국어 사본입니다. 원본은 영어입니다.

목표: 사용자가 아침 보고에서 카드의 행동을 하거나 전체 할 일 또는 프로젝트와 단계를 엽니다.

근거 요구사항: REQ-004, REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-010, REQ-011, REQ-012, REQ-013, REQ-015, REQ-041, REQ-052, REQ-062, REQ-063, REQ-066, REQ-070, REQ-081, REQ-082, REQ-083

```mermaid
flowchart TD
  A(["사용자가<br/>NEXUS를 엶"])
  B{"로그인<br/>게이트를<br/>통과했나?<br/>REQ-062, REQ-063"}
  C["아침 보고 표시<br/>REQ-052, REQ-082"]
  D["사용자가<br/>프로젝트와<br/>단계를 고름"]
  E{"그 단계에<br/>그림이 있나?<br/>REQ-004, REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-010"}
  F["그림을<br/>이름으로<br/>열기, ID는<br/>숨김<br/>REQ-004, REQ-005, REQ-011, REQ-070"]
  G["표를 열거나 빈<br/>단계에서 보낼<br/>자료 안내<br/>REQ-006, REQ-011, REQ-082"]
  H["지난 확정 뒤<br/>바뀐 곳 표시<br/>REQ-041"]
  I{"사용자가<br/>무엇을 하나?"}
  J["새 위치를<br/>NEXUS에만<br/>저장<br/>REQ-013, REQ-015"]
  K["ID와 이름을<br/>클립보드에<br/>넣기<br/>REQ-012"]
  L["그림 확대·축소<br/>또는 화면 맞춤<br/>REQ-081"]
  N["이동<br/>되돌리거나<br/>다시 실행<br/>REQ-083"]
  R1["들어갈 수 없음<br/>REQ-062, REQ-066"]
  Q0{"어디로 갈까?"}
  Q["카드 행동 또는<br/>전체 할 일 열기<br/>REQ-052"]
  Z(["끝"])
  A e1@--> B
  B e2@-->|아니요| R1
  B e3@-->|예| C
  C e4@--> Q0
  Q0 e21@-->|프로젝트와 단계| D
  Q0 e22@-->|카드 또는 전체 할 일| Q
  Q e23@--> Z
  D e5@--> E
  E e6@-->|예| F
  E e7@-->|아니요| G
  F e8@--> H
  G e9@--> H
  H e10@--> I
  I e11@-->|PC에서 요소 옮기기| J
  I e12@-->|요소 복사| K
  I e13@-->|읽기만| Z
  J e14@--> Z
  K e15@--> Z
  R1 e16@--> Z
  I e17@-->|확대·축소 또는 맞춤| L
  L e18@--> I
  I e19@-->|이동 되돌리기·재실행| N
  N e20@--> Z
  %% legend: below
  classDef term fill:#e7f5ff,stroke:#1c7ed6,color:#212529
  classDef proc fill:#f8f9fa,stroke:#495057,color:#212529
  classDef decide fill:#f3f0ff,stroke:#7048e8,color:#212529
  classDef gap fill:#f1f3f5,stroke:#adb5bd,stroke-dasharray:2 3,color:#495057
  classDef pass stroke:#868e96,stroke-width:1.5px
  class A,Z term
  class C,D,F,G,H,J,K,L,N,Q,R1 proc
  class B,E,I,Q0 decide
  class e1,e2,e3,e4,e5,e6,e7,e8,e9,e10,e11,e12,e13,e14,e15,e16,e17,e18,e19,e20,e21,e22,e23 pass
```

| 모양 | 뜻 |
| --- | --- |
| 둥근 상자 | 흐름이 시작하거나 끝나는 곳 |
| 사각형 | 한 단계 |
| 마름모 | 결정. 분기마다 이름이 있음 |

## 실패 경로

- 들어갈 수 없음 (REQ-062, REQ-066)
