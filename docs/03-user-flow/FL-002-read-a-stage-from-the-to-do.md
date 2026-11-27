# FL-002 Read a stage from the to-do

[한국어](FL-002-read-a-stage-from-the-to-do.ko.md)

Goal: The owner opens NEXUS, picks a stage from the to-do and reads its diagram or item table.

Serves: REQ-004, REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-010, REQ-011, REQ-012, REQ-013, REQ-015, REQ-041, REQ-052, REQ-062, REQ-063, REQ-066, REQ-070, REQ-081, REQ-082

```mermaid
flowchart TD
  A(["Owner opens NEXUS"])
  B{"Signed in through the<br/>gate?<br/>REQ-062, REQ-063"}
  C["Show to-do and next action<br/>REQ-052, REQ-082"]
  D["Owner picks a project and<br/>a stage"]
  E{"Does the stage have a<br/>picture?<br/>REQ-004, REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-010"}
  F["Open the diagram with<br/>names, IDs hidden<br/>REQ-004, REQ-005, REQ-011, REQ-070"]
  G["Open the table or explain<br/>what to send if empty<br/>REQ-006, REQ-011, REQ-082"]
  H["Mark what changed since<br/>the last confirmation<br/>REQ-041"]
  I{"What does the owner do?"}
  J["Store the new position in<br/>NEXUS only<br/>REQ-013, REQ-015"]
  K["Put the ID and name on the<br/>clipboard<br/>REQ-012"]
  L["Zoom or fit the picture<br/>REQ-081"]
  R1["Not admitted<br/>REQ-062, REQ-066"]
  Z(["End"])
  A e1@--> B
  B e2@-->|no| R1
  B e3@-->|yes| C
  C e4@--> D
  D e5@--> E
  E e6@-->|yes| F
  E e7@-->|no| G
  F e8@--> H
  G e9@--> H
  H e10@--> I
  I e11@-->|move an element on a PC| J
  I e12@-->|copy an element| K
  I e13@-->|read only| Z
  J e14@--> Z
  K e15@--> Z
  R1 e16@--> Z
  I e17@-->|zoom or fit| L
  L e18@--> I
  %% legend: below
  classDef term fill:#e7f5ff,stroke:#1c7ed6,color:#212529
  classDef proc fill:#f8f9fa,stroke:#495057,color:#212529
  classDef decide fill:#f3f0ff,stroke:#7048e8,color:#212529
  classDef gap fill:#f1f3f5,stroke:#adb5bd,stroke-dasharray:2 3,color:#495057
  classDef pass stroke:#868e96,stroke-width:1.5px
  class A,Z term
  class C,D,F,G,H,J,K,L,R1 proc
  class B,E,I decide
  class e1,e2,e3,e4,e5,e6,e7,e8,e9,e10,e11,e12,e13,e14,e15,e16,e17,e18 pass
```

| Shape | Means |
| --- | --- |
| Rounded box | Where the flow starts or ends |
| Rectangle | A step |
| Diamond | A decision; each branch is labelled |

## Failure paths

- Not admitted (REQ-062, REQ-066)
