# FL-008 Read and comment on a phone

[한국어](FL-008-read-and-comment-on-a-phone.ko.md)

Goal: The owner reads diagrams and comments on a phone and leaves comments; confirmation and proposal decisions ask once more, while direct edits wait for a PC.

Serves: REQ-020, REQ-021, REQ-062, REQ-067, REQ-068, REQ-079

```mermaid
flowchart TD
  A(["Owner opens NEXUS on a<br/>phone<br/>REQ-062"])
  B["Show diagrams, item tables<br/>and comments<br/>REQ-067"]
  C{"What does the owner do?"}
  D["Add the comment or reply<br/>REQ-079, REQ-020, REQ-021"]
  P["Ask again, then confirm<br/>or answer the proposal<br/>REQ-068"]
  R1["Not offered on a phone, do<br/>it on a PC<br/>REQ-068"]
  Z(["End"])
  A e1@--> B
  B e2@--> C
  C e3@-->|comment or reply| D
  C e4@-->|direct edit| R1
  C e8@-->|confirm or answer proposal| P
  P e9@--> Z
  C e5@-->|read only| Z
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

| Shape | Means |
| --- | --- |
| Rounded box | Where the flow starts or ends |
| Rectangle | A step |
| Diamond | A decision; each branch is labelled |

## Failure paths

- Not offered on a phone, do it on a PC (REQ-068)
