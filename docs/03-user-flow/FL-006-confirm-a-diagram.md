# FL-006 Confirm a diagram

[한국어](FL-006-confirm-a-diagram.ko.md)

Goal: The owner confirms a diagram or an item table on a PC, an agent records it, and the stage passes once all are recorded.

Serves: REQ-035, REQ-036, REQ-037, REQ-038, REQ-039, REQ-041, REQ-042, REQ-052, REQ-068

```mermaid
flowchart TD
  A(["Owner opens a diagram to<br/>confirm<br/>REQ-052"])
  B["Show what changed since<br/>the last confirmation<br/>REQ-041"]
  C{"Who asks?"}
  D{"Confirm or cancel?"}
  E["Record the confirmation<br/>with the version shown<br/>REQ-035"]
  F["Add recording it to the<br/>agent to-do<br/>REQ-038"]
  G["Agent reports the merged<br/>record<br/>REQ-039"]
  H{"Every diagram and table of<br/>the stage recorded?<br/>REQ-042"}
  I["Treat the stage checkpoint<br/>as passed<br/>REQ-042"]
  J["Put it back in the to-do<br/>as not confirmed<br/>REQ-037"]
  R1["No confirmation on a phone<br/>REQ-068"]
  R2["Refuse the agent<br/>credential<br/>REQ-036"]
  Z(["End"])
  A e1@--> B
  B e2@--> C
  C e3@-->|owner on a PC| D
  C e4@-->|owner on a phone| R1
  C e5@-->|an agent| R2
  D e6@-->|confirm| E
  D e7@-->|cancel| J
  E e8@--> F
  F e9@--> G
  G e10@--> H
  H e11@-->|yes| I
  H e12@-->|no| Z
  I e13@--> Z
  J e14@--> Z
  R1 e15@--> Z
  R2 e16@--> Z
  %% legend: below
  classDef term fill:#e7f5ff,stroke:#1c7ed6,color:#212529
  classDef proc fill:#f8f9fa,stroke:#495057,color:#212529
  classDef decide fill:#f3f0ff,stroke:#7048e8,color:#212529
  classDef gap fill:#f1f3f5,stroke:#adb5bd,stroke-dasharray:2 3,color:#495057
  classDef pass stroke:#868e96,stroke-width:1.5px
  class A,Z term
  class B,E,F,G,I,J,R1,R2 proc
  class C,D,H decide
  class e1,e2,e3,e4,e5,e6,e7,e8,e9,e10,e11,e12,e13,e14,e15,e16 pass
```

| Shape | Means |
| --- | --- |
| Rounded box | Where the flow starts or ends |
| Rectangle | A step |
| Diamond | A decision; each branch is labelled |

## Failure paths

- No confirmation on a phone (REQ-068)
- Refuse the agent credential (REQ-036)
