# FL-004 Edit a diagram directly

[한국어](FL-004-edit-a-diagram-directly.ko.md)

Goal: The owner renames an element or connects two on a PC, and the edit waits to be reflected into Git.

Serves: REQ-026, REQ-027, REQ-028, REQ-053, REQ-068

Screens (stage 07): SCR-145, SCR-146

```mermaid
flowchart TD
  A(["Owner renames an element<br/>or connects two<br/>REQ-026"])
  B{"On a PC?<br/>REQ-068"}
  C["Record it as an accepted<br/>change set<br/>REQ-026"]
  D["Show the elements as<br/>waiting for reflection<br/>REQ-027"]
  E{"Owner cancels before<br/>reflection?<br/>REQ-028"}
  F["Drop the change set and<br/>redraw without it<br/>REQ-028"]
  G["Add the reflection to the<br/>agent to-do<br/>REQ-053"]
  R1["No direct edit on a phone<br/>REQ-068"]
  Z(["End"])
  Y(["Reflect it: FL-005"])
  A e1@--> B
  B e2@-->|no| R1
  B e3@-->|yes| C
  C e4@--> D
  D e5@--> E
  E e6@-->|yes| F
  E e7@-->|no| G
  F e8@--> Z
  G e9@--> Y
  R1 e10@--> Z
  %% legend: below
  classDef term fill:#e7f5ff,stroke:#1c7ed6,color:#212529
  classDef proc fill:#f8f9fa,stroke:#495057,color:#212529
  classDef decide fill:#f3f0ff,stroke:#7048e8,color:#212529
  classDef gap fill:#f1f3f5,stroke:#adb5bd,stroke-dasharray:2 3,color:#495057
  classDef pass stroke:#868e96,stroke-width:1.5px
  class A,Z,Y term
  class C,D,F,G,R1 proc
  class B,E decide
  class e1,e2,e3,e4,e5,e6,e7,e8,e9,e10 pass
```

| Shape | Means |
| --- | --- |
| Rounded box | Where the flow starts or ends |
| Rectangle | A step |
| Diamond | A decision; each branch is labelled |

## Failure paths

- No direct edit on a phone (REQ-068)
