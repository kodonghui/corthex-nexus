# FL-008 휴대폰에서 읽고 댓글 달기

[English](FL-008-read-and-comment-on-a-phone.md)

이 문서는 [FL-008-read-and-comment-on-a-phone.md](FL-008-read-and-comment-on-a-phone.md)의 한국어 사본입니다. 원본은 영어입니다.

목표: 사용자가 휴대폰에서 그림과 댓글을 읽고 댓글을 답니다. 확정과 제안 결정은 한 번 더 묻고, 직접 편집은 PC에서 합니다.

근거 요구사항: REQ-020, REQ-021, REQ-062, REQ-067, REQ-068, REQ-079

```mermaid
flowchart TD
  A(["사용자가<br/>휴대폰에서<br/>NEXUS를 엶<br/>REQ-062"])
  B["그림, 항목 표,<br/>댓글 보여 주기<br/>REQ-067"]
  C{"사용자가<br/>무엇을 하나?"}
  D["댓글이나 답글<br/>더하기<br/>REQ-079, REQ-020, REQ-021"]
  P["한 번 더 물은 뒤<br/>확정 또는<br/>제안 결정<br/>REQ-068"]
  R1["휴대폰에서는<br/>없음, PC에서<br/>REQ-068"]
  Z(["끝"])
  A e1@--> B
  B e2@--> C
  C e3@-->|댓글이나 답글| D
  C e4@-->|직접 편집| R1
  C e8@-->|확정이나 제안 답| P
  P e9@--> Z
  C e5@-->|읽기만| Z
  D e6@--> Z
  R1 e7@--> Z
  %% legend: below
  classDef term fill:#e7f5ff,stroke:#1c7ed6,color:#212529
  classDef proc fill:#f8f9fa,stroke:#495057,color:#212529
  classDef decide fill:#f3f0ff,stroke:#7048e8,color:#212529
  classDef gap fill:#f1f3f5,stroke:#adb5bd,stroke-dasharray:2 3,color:#495057
  classDef pass stroke:#868e96,stroke-width:1.5px
  class A,Z term
  class B,D,P,R1 proc
  class C decide
  class e1,e2,e3,e4,e5,e6,e7,e8,e9 pass
```

| 모양 | 뜻 |
| --- | --- |
| 둥근 상자 | 흐름이 시작하거나 끝나는 곳 |
| 사각형 | 한 단계 |
| 마름모 | 결정. 분기마다 이름이 있음 |

## 실패 경로

- 휴대폰에서는 없음, PC에서 (REQ-068)
