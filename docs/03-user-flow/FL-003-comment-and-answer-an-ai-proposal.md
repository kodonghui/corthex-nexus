# FL-003 Comment and answer an AI proposal

[한국어](FL-003-comment-and-answer-an-ai-proposal.ko.md)

Goal: The owner comments on a diagram, an agent answers or proposes a change, and the owner accepts or rejects it.

Serves: REQ-020, REQ-021, REQ-022, REQ-023, REQ-024, REQ-025, REQ-034, REQ-053, REQ-054, REQ-055, REQ-068

```mermaid
flowchart TD
  A(["Owner comments on a<br/>diagram, element or row<br/>REQ-020"])
  B["Add the comment to the<br/>agent to-do<br/>REQ-053"]
  C{"Another session holds it?<br/>REQ-054, REQ-055"}
  D{"Answer or change?"}
  E["Agent replies in the<br/>thread<br/>REQ-021"]
  F["Agent posts an AI proposal<br/>laid over the diagram<br/>REQ-022"]
  G{"Who answers the proposal?"}
  H{"Accept after a<br/>confirmation question?"}
  I["Add the reflection to the<br/>agent to-do<br/>REQ-023"]
  J["Mark it rejected, thread<br/>stays open<br/>REQ-024"]
  K["Owner closes the thread<br/>when done<br/>REQ-034"]
  P{"Answer or external evidence,<br/>verified record, no outstanding work?<br/>REQ-034"}
  Q["Resolve; show evidence;<br/>owner may reopen<br/>REQ-034"]
  R1["Refuse the claim<br/>REQ-055"]
  R3["Refuse the agent<br/>credential<br/>REQ-025"]
  Z(["End"])
  Y(["Reflect it: FL-005"])
  A e1@--> B
  B e2@-->|agent claims| C
  C e3@-->|yes| R1
  C e4@-->|no| D
  D e5@-->|answer| E
  D e6@-->|change| F
  E e7@--> P
  P e30@-->|yes| Q
  P e31@-->|no| K
  Q e32@--> Z
  F e8@--> G
  G e9@-->|owner on a PC| H
  G e10@-->|owner on a phone| H
  G e11@-->|an agent| R3
  H e12@-->|yes| I
  H e13@-->|no| J
  I e14@--> Y
  J e15@--> K
  K e16@--> Z
  R1 e17@--> Z
  R3 e19@--> Z
  %% legend: below
  classDef term fill:#e7f5ff,stroke:#1c7ed6,color:#212529
  classDef proc fill:#f8f9fa,stroke:#495057,color:#212529
  classDef decide fill:#f3f0ff,stroke:#7048e8,color:#212529
  classDef gap fill:#f1f3f5,stroke:#adb5bd,stroke-dasharray:2 3,color:#495057
  classDef pass stroke:#868e96,stroke-width:1.5px
  class A,Z,Y term
  class B,E,F,I,J,K,R1,R3 proc
  class Q proc
  class C,D,G,H,P decide
  class e1,e2,e3,e4,e5,e6,e7,e8,e9,e10,e11,e12,e13,e14,e15,e16,e17,e19,e30,e31,e32 pass
```

| Shape | Means |
| --- | --- |
| Rounded box | Where the flow starts or ends |
| Rectangle | A step |
| Diamond | A decision; each branch is labelled |

## Failure paths

- Refuse the claim (REQ-055)
- Refuse the agent credential (REQ-025)

A decision recorded with an owner answer or external evidence can resolve the conversation after record verification and with no outstanding proposal or question. Show the external source and exact original text; the owner can reopen it.
