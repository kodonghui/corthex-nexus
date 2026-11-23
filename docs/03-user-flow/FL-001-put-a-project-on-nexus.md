# FL-001 Put a project on NEXUS

[한국어](FL-001-put-a-project-on-nexus.ko.md)

Goal: An agent sends a project's first snapshot, and the owner finds the project drawn.

Serves: REQ-001, REQ-003, REQ-004, REQ-005, REQ-006, REQ-018, REQ-019, REQ-052, REQ-066, REQ-077

```mermaid
flowchart TD
  A(["Agent pushes a new project<br/>REQ-018"])
  B{"Credential valid?<br/>REQ-066"}
  C{"Owner confirmed the first<br/>send?<br/>REQ-003"}
  D{"A file looks like a secret<br/>or an email?<br/>REQ-077"}
  E["Create an empty project<br/>space<br/>REQ-001, REQ-019"]
  F["Draw the stage diagrams<br/>and item tables<br/>REQ-001, REQ-004, REQ-005, REQ-006"]
  G["List the project in the<br/>owner's to-do<br/>REQ-052"]
  R1["Refuse the request<br/>REQ-066"]
  R2["Reject and ask for the<br/>first-send confirmation<br/>REQ-003"]
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

| Shape | Means |
| --- | --- |
| Rounded box | Where the flow starts or ends |
| Rectangle | A step |
| Diamond | A decision; each branch is labelled |

## Failure paths

- Refuse the request (REQ-066)
- Reject and ask for the first-send confirmation (REQ-003)
- Refuse the file and name it in the answer (REQ-077)
