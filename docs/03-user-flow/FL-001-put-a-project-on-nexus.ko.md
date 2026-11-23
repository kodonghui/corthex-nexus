# FL-001 프로젝트를 NEXUS에 올리기

[English](FL-001-put-a-project-on-nexus.md)

이 문서는 [FL-001-put-a-project-on-nexus.md](FL-001-put-a-project-on-nexus.md)의 한국어 사본입니다. 원본은 영어입니다.

목표: 에이전트가 프로젝트의 첫 스냅숏을 보내고, 사용자는 그려진 프로젝트를 봅니다.

근거 요구사항: REQ-001, REQ-003, REQ-004, REQ-005, REQ-006, REQ-018, REQ-019, REQ-052, REQ-066, REQ-077

```mermaid
flowchart TD
  A(["에이전트가 새<br/>프로젝트를<br/>push<br/>REQ-018"])
  B{"자격이<br/>유효한가?<br/>REQ-066"}
  C{"사용자가 첫<br/>전송을<br/>확인했나?<br/>REQ-003"}
  D{"비밀 값이나<br/>이메일로<br/>보이는 파일?<br/>REQ-077"}
  E["빈 프로젝트<br/>공간 만들기<br/>REQ-001, REQ-019"]
  F["단계 그림과<br/>항목 표 그리기<br/>REQ-001, REQ-004, REQ-005, REQ-006"]
  G["사용자<br/>할 일에<br/>프로젝트<br/>올리기<br/>REQ-052"]
  R1["요청 거절<br/>REQ-066"]
  R2["거절하고 첫<br/>전송 확인을<br/>요청<br/>REQ-003"]
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
  G e10@--> Z
  R1 e11@--> Z
  R2 e12@--> Z
  R3 e13@--> Z
  %% legend: below
  classDef term fill:#e7f5ff,stroke:#1c7ed6,color:#212529
  classDef proc fill:#f8f9fa,stroke:#495057,color:#212529
  classDef decide fill:#f3f0ff,stroke:#7048e8,color:#212529
  classDef gap fill:#f1f3f5,stroke:#adb5bd,stroke-dasharray:2 3,color:#495057
  classDef pass stroke:#868e96,stroke-width:1.5px
  class A,Z term
  class E,F,G,R1,R2,R3 proc
  class B,C,D decide
  class e1,e2,e3,e4,e5,e6,e7,e8,e9,e10,e11,e12,e13 pass
```

| 모양 | 뜻 |
| --- | --- |
| 둥근 상자 | 흐름이 시작하거나 끝나는 곳 |
| 사각형 | 한 단계 |
| 마름모 | 결정. 분기마다 이름이 있음 |

## 실패 경로

- 요청 거절 (REQ-066)
- 거절하고 첫 전송 확인을 요청 (REQ-003)
- 그 파일을 거절하고 답에 이름 적기 (REQ-077)
