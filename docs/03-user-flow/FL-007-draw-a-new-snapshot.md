# FL-007 Draw a new snapshot

[한국어](FL-007-draw-a-new-snapshot.ko.md)

Goal: After a merge, an agent sends a snapshot and NEXUS redraws the project, keeping layouts and comments.

Serves: REQ-001, REQ-002, REQ-014, REQ-018, REQ-030, REQ-033, REQ-040, REQ-065, REQ-066, REQ-071, REQ-077

Screens (stage 07): SCR-142, SCR-145

```mermaid
flowchart TD
  A(["Agent pushes a snapshot<br/>after a merge<br/>REQ-018"])
  B{"Credential valid and not<br/>revoked?<br/>REQ-065, REQ-066"}
  C{"Commit descends from the<br/>held one?<br/>REQ-001, REQ-002"}
  D{"A file looks like a secret<br/>or an email?<br/>REQ-077"}
  E["Redraw, keeping stored<br/>positions<br/>REQ-001, REQ-014, REQ-071"]
  F["Move comments of removed<br/>elements to the diagram<br/>REQ-033"]
  G["Mark change sets with a<br/>merged PR reflected<br/>REQ-030"]
  H{"Changed a confirmed<br/>diagram's document?<br/>REQ-040"}
  I["Invalidate the<br/>confirmation, back to the<br/>to-do<br/>REQ-040"]
  R1["Refuse the request<br/>REQ-065, REQ-066"]
  R2["Reject and keep the held<br/>diagrams<br/>REQ-002"]
  R3["Refuse the file and name<br/>it in the answer<br/>REQ-077"]
  Z(["End"])
  A e1@--> B
  B e2@-->|no| R1
  B e3@-->|yes| C
  C e4@-->|no| R2
  C e5@-->|yes| D
  D e6@-->|yes| R3
  D e7@-->|no| E
  E e8@--> F
  F e9@--> G
  G e10@--> H
  H e11@-->|yes| I
  H e12@-->|no| Z
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

| Shape | Means |
| --- | --- |
| Rounded box | Where the flow starts or ends |
| Rectangle | A step |
| Diamond | A decision; each branch is labelled |

## Failure paths

- Refuse the request (REQ-065, REQ-066)
- Reject and keep the held diagrams (REQ-002)
- Refuse the file and name it in the answer (REQ-077)
