# FL-010 Delete a project space

[한국어](FL-010-delete-a-project-space.ko.md)

Goal: The owner removes a project from NEXUS after seeing what goes with it.

Serves: REQ-016, REQ-017

Screens (stage 07): SCR-144

```mermaid
flowchart TD
  A(["Deletion of a project<br/>space asked"])
  B{"Who asks?"}
  C["Show what the deletion<br/>removes<br/>REQ-016"]
  D{"Owner confirms?<br/>REQ-016"}
  E["Remove snapshots,<br/>diagrams, comments,<br/>confirmations, layouts<br/>REQ-016"]
  F["Keep everything"]
  R1["Refuse the agent<br/>credential<br/>REQ-017"]
  Z(["End"])
  A e1@--> B
  B e2@-->|the owner| C
  B e3@-->|an agent| R1
  C e4@--> D
  D e5@-->|yes| E
  D e6@-->|no| F
  E e7@--> Z
  F e8@--> Z
  R1 e9@--> Z
  %% legend: below
  classDef term fill:#e7f5ff,stroke:#1c7ed6,color:#212529
  classDef proc fill:#f8f9fa,stroke:#495057,color:#212529
  classDef decide fill:#f3f0ff,stroke:#7048e8,color:#212529
  classDef gap fill:#f1f3f5,stroke:#adb5bd,stroke-dasharray:2 3,color:#495057
  classDef pass stroke:#868e96,stroke-width:1.5px
  class A,Z term
  class C,E,F,R1 proc
  class B,D decide
  class e1,e2,e3,e4,e5,e6,e7,e8,e9 pass
```

| Shape | Means |
| --- | --- |
| Rounded box | Where the flow starts or ends |
| Rectangle | A step |
| Diamond | A decision; each branch is labelled |

## Failure paths

- Refuse the agent credential (REQ-017)
