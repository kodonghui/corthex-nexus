# FL-007 새 스냅숏 그리기

[English](FL-007-draw-a-new-snapshot.md)

이 문서는 [FL-007-draw-a-new-snapshot.md](FL-007-draw-a-new-snapshot.md)의 한국어 사본입니다. 원본은 영어입니다.

목표: 병합 뒤 에이전트가 스냅숏을 보내면, NEXUS가 레이아웃과 댓글을 지키며 다시 그립니다.

근거 요구사항: REQ-001, REQ-002, REQ-014, REQ-018, REQ-030, REQ-033, REQ-040, REQ-065, REQ-066, REQ-071, REQ-077

```mermaid
flowchart TD
  A(["병합 뒤<br/>에이전트가<br/>스냅숏 push<br/>REQ-018"])
  B{"자격이<br/>유효하고<br/>폐기되지<br/>않았나?<br/>REQ-065, REQ-066"}
  C{"들고 있는<br/>커밋에서<br/>이어지나?<br/>REQ-001, REQ-002"}
  D{"비밀 값이나<br/>이메일로<br/>보이는 파일?<br/>REQ-077"}
  E["저장된 위치를<br/>지키며 다시<br/>그림<br/>REQ-001, REQ-014, REQ-071"]
  F["사라진 요소의<br/>댓글을 그림<br/>댓글로<br/>REQ-033"]
  G["병합된 PR의<br/>변경안을<br/>반영됨으로<br/>REQ-030"]
  H{"확정한 그림의<br/>문서가<br/>바뀌었나?<br/>REQ-040"}
  I["확정을<br/>무효화,<br/>할 일로<br/>되돌림<br/>REQ-040"]
  R1["요청 거절<br/>REQ-065, REQ-066"]
  R2["거절하고 들고<br/>있던 그림 유지<br/>REQ-002"]
  R3["그 파일을<br/>거절하고 답에<br/>이름 적기<br/>REQ-077"]
  Z(["끝"])
  A e1@--> B
  B e2@-->|아니요| R1
  B e3@-->|예| C
  C e4@-->|아니요| R2
  C e5@-->|예| D
  D e6@-->|예| R3
  D e7@-->|아니요| E
  E e8@--> F
  F e9@--> G
  G e10@--> H
  H e11@-->|예| I
  H e12@-->|아니요| Z
  I e13@--> Z
  R1 e14@--> Z
  R2 e15@--> Z
  R3 e16@--> Z
  %% legend: below
  classDef term fill:#e7f5ff,stroke:#1c7ed6,color:#212529
  classDef proc fill:#f8f9fa,stroke:#495057,color:#212529
  classDef decide fill:#f3f0ff,stroke:#7048e8,color:#212529
  classDef gap fill:#f1f3f5,stroke:#adb5bd,stroke-dasharray:2 3,color:#495057
  classDef pass stroke:#868e96,stroke-width:1.5px
  class A,Z term
  class E,F,G,I,R1,R2,R3 proc
  class B,C,D,H decide
  class e1,e2,e3,e4,e5,e6,e7,e8,e9,e10,e11,e12,e13,e14,e15,e16 pass
```

| 모양 | 뜻 |
| --- | --- |
| 둥근 상자 | 흐름이 시작하거나 끝나는 곳 |
| 사각형 | 한 단계 |
| 마름모 | 결정. 분기마다 이름이 있음 |

## 실패 경로

- 요청 거절 (REQ-065, REQ-066)
- 거절하고 들고 있던 그림 유지 (REQ-002)
- 그 파일을 거절하고 답에 이름 적기 (REQ-077)
