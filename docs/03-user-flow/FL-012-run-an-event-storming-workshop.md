# FL-012 Run an event storming workshop

[한국어](FL-012-run-an-event-storming-workshop.ko.md)

Goal: The owner and an agent build the domain design step by step on a free canvas, and each confirmed step goes into the domain document.

Serves: REQ-043, REQ-044, REQ-045, REQ-046, REQ-047, REQ-048, REQ-049, REQ-050, REQ-051

Screens (stage 07): SCR-145

```mermaid
flowchart TD
  A(["Owner or agent opens a<br/>workshop<br/>REQ-044"])
  B["Create a board, one frame<br/>per step, as the source<br/>REQ-044, REQ-048"]
  M{"Start from a Miro board?<br/>REQ-051"}
  N["Copy the sticky notes'<br/>text, colour and position<br/>REQ-051"]
  C["Agent drafts a step with<br/>confidence labels<br/>REQ-045"]
  D{"Removes a sticky note a<br/>person made?<br/>REQ-047"}
  E["Owner edits sticky notes<br/>on a PC<br/>REQ-046"]
  F{"Owner confirms the step?<br/>REQ-043"}
  G["Add writing the step to<br/>the agent to-do<br/>REQ-049"]
  H{"Last step confirmed and<br/>written?<br/>REQ-050"}
  I["Close the workshop<br/>REQ-050"]
  R1["Refuse the agent's change<br/>REQ-047"]
  Z(["End"])
  A e1@--> B
  B e2@--> M
  M e3@-->|yes| N
  M e4@-->|no| C
  N e5@--> C
  C e6@--> D
  D e7@-->|yes| R1
  D e8@-->|no| E
  R1 e9@--> E
  E e10@--> F
  F e11@-->|no| E
  F e12@-->|yes| G
  G e13@--> H
  H e14@-->|no, next step| C
  H e15@-->|yes| I
  I e16@--> Z
  %% legend: below
  classDef term fill:#e7f5ff,stroke:#1c7ed6,color:#212529
  classDef proc fill:#f8f9fa,stroke:#495057,color:#212529
  classDef decide fill:#f3f0ff,stroke:#7048e8,color:#212529
  classDef gap fill:#f1f3f5,stroke:#adb5bd,stroke-dasharray:2 3,color:#495057
  classDef pass stroke:#868e96,stroke-width:1.5px
  class A,Z term
  class B,N,C,E,G,I,R1 proc
  class M,D,F,H decide
  class e1,e2,e3,e4,e5,e6,e7,e8,e9,e10,e11,e12,e13,e14,e15,e16 pass
```

| Shape | Means |
| --- | --- |
| Rounded box | Where the flow starts or ends |
| Rectangle | A step |
| Diamond | A decision; each branch is labelled |

## Failure paths

- Refuse the agent's change (REQ-047)
