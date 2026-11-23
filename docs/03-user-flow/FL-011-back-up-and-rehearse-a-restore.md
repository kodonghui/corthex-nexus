# FL-011 Back up and rehearse a restore

[한국어](FL-011-back-up-and-rehearse-a-restore.ko.md)

Goal: NEXUS backs up its data every day, and a restore is rehearsed before each release.

Serves: REQ-076, REQ-080

```mermaid
flowchart TD
  A(["Daily schedule<br/>REQ-076"])
  B["Back up the data<br/>REQ-076"]
  C{"Backup succeeded?"}
  D["Drop backups older than 30<br/>days<br/>REQ-076"]
  E["Tell the owner<br/>(not in the source)"]
  P(["Before a release<br/>REQ-080"])
  Q["Restore the latest backup<br/>on a test copy<br/>REQ-080"]
  S["Record the rehearsal for<br/>the release<br/>REQ-080"]
  Z(["End"])
  A e1@--> B
  B e2@--> C
  C e3@-->|yes| D
  C e4@-->|no| E
  D e5@--> Z
  E e6@--> Z
  P e7@--> Q
  Q e8@--> S
  S e9@--> Z
  %% legend: below
  classDef term fill:#e7f5ff,stroke:#1c7ed6,color:#212529
  classDef proc fill:#f8f9fa,stroke:#495057,color:#212529
  classDef decide fill:#f3f0ff,stroke:#7048e8,color:#212529
  classDef gap fill:#f1f3f5,stroke:#adb5bd,stroke-dasharray:2 3,color:#495057
  classDef pass stroke:#868e96,stroke-width:1.5px
  class A,P,Z term
  class B,D,E,Q,S proc
  class C decide
  class E gap
  class e1,e2,e3,e4,e5,e6,e7,e8,e9 pass
```

| Shape | Means |
| --- | --- |
| Rounded box | Where the flow starts or ends |
| Rectangle | A step |
| Diamond | A decision; each branch is labelled |
| Grey dotted box | A step the requirements do not describe, drawn so the flow stays whole |

## Failure paths

- Tell the owner (not in the source)
