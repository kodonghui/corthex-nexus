# FL-011 백업하고 복원 연습하기

[English](FL-011-back-up-and-rehearse-a-restore.md)

이 문서는 [FL-011-back-up-and-rehearse-a-restore.md](FL-011-back-up-and-rehearse-a-restore.md)의 한국어 사본입니다. 원본은 영어입니다.

목표: NEXUS가 매일 데이터를 백업하고, 릴리스마다 그 전에 복원을 연습합니다.

근거 요구사항: REQ-076, REQ-080

화면(07단계): SCR-142

```mermaid
flowchart TD
  A(["매일 일정<br/>REQ-076"])
  B["데이터 백업<br/>REQ-076"]
  C{"백업이<br/>성공했나?"}
  D["30일 지난 백업<br/>지우기<br/>REQ-076"]
  E["사용자에게<br/>알림<br/>(원문에 없음)"]
  P(["릴리스 전<br/>REQ-080"])
  Q["최근 백업을<br/>시험용 사본에<br/>복원<br/>REQ-080"]
  S["그 릴리스의<br/>연습 기록<br/>남기기<br/>REQ-080"]
  Z(["끝"])
  A e1@--> B
  B e2@--> C
  C e3@-->|예| D
  C e4@-->|아니요| E
  D e5@--> Z
  E e6@--> Z
  P e7@--> Q
  Q e8@--> S
  S e9@--> Z
  %% legend: below
  classDef term fill:#e7f5ff,stroke:#1c7ed6,color:#212529
  classDef proc fill:#f8f9fa,stroke:#495057,color:#212529
  classDef decide fill:#f3f0ff,stroke:#7048e8,color:#212529
  classDef gap fill:#f1f3f5,stroke:#adb5bd,stroke-dasharray:2 3,color:#495057
  classDef pass stroke:#868e96,stroke-width:1.5px
  class A,P,Z term
  class B,D,E,Q,S proc
  class C decide
  class E gap
  class e1,e2,e3,e4,e5,e6,e7,e8,e9 pass
```

| 모양 | 뜻 |
| --- | --- |
| 둥근 상자 | 흐름이 시작하거나 끝나는 곳 |
| 사각형 | 한 단계 |
| 마름모 | 결정. 분기마다 이름이 있음 |
| 회색 점선 상자 | 요구사항에 없는 단계. 흐름이 끊기지 않게 그림 |

## 실패 경로

- 사용자에게 알림(원문에 없음)
