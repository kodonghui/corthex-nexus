# FL-005 Reflect accepted changes into Git

[한국어](FL-005-reflect-accepted-changes-into-git.ko.md)

Goal: An agent carries a diagram's accepted change sets into the stage document through one pull request.

Serves: REQ-001, REQ-029, REQ-030, REQ-031, REQ-032, REQ-053, REQ-054, REQ-056, REQ-057

```mermaid
flowchart TD
  A(["Agent claims a change set<br/>to reflect<br/>REQ-053, REQ-054"])
  B["Agent opens one PR for the<br/>diagram's change sets<br/>REQ-032"]
  C["Link the reported PR to<br/>its change sets<br/>REQ-029"]
  D["Keep the claim while the<br/>PR is open<br/>REQ-057"]
  E{"PR merged?"}
  F["Draw the snapshot with the<br/>merge commit<br/>REQ-001"]
  G["Mark the change sets<br/>reflected<br/>REQ-030"]
  H["Close the threads that<br/>asked for them<br/>REQ-031"]
  R1["Release the claim after 60<br/>idle minutes<br/>REQ-056"]
  Z(["End"])
  A e1@--> B
  B e2@--> C
  C e3@--> D
  D e4@--> E
  E e5@-->|yes| F
  E e6@-->|closed without merge| R1
  F e7@--> G
  G e8@--> H
  H e9@--> Z
  R1 e10@--> Z
  %% legend: below
  classDef term fill:#e7f5ff,stroke:#1c7ed6,color:#212529
  classDef proc fill:#f8f9fa,stroke:#495057,color:#212529
  classDef decide fill:#f3f0ff,stroke:#7048e8,color:#212529
  classDef gap fill:#f1f3f5,stroke:#adb5bd,stroke-dasharray:2 3,color:#495057
  classDef pass stroke:#868e96,stroke-width:1.5px
  class A,Z term
  class B,C,D,F,G,H,R1 proc
  class E decide
  class e1,e2,e3,e4,e5,e6,e7,e8,e9,e10 pass
```

| Shape | Means |
| --- | --- |
| Rounded box | Where the flow starts or ends |
| Rectangle | A step |
| Diamond | A decision; each branch is labelled |

## Failure paths

- Release the claim after 60 idle minutes (REQ-056)
