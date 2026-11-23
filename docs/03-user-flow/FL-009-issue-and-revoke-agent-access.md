# FL-009 Issue and revoke an agent credential

[한국어](FL-009-issue-and-revoke-agent-access.ko.md)

Goal: The owner gives an agent a credential for hub commands and can take it back.

Serves: REQ-018, REQ-064, REQ-065, REQ-078

Screens (stage 07): SCR-143

```mermaid
flowchart TD
  A(["Owner issues a credential<br/>for an agent<br/>REQ-064"])
  B["Show the secret once<br/>REQ-064"]
  C["Store only its digest<br/>REQ-078"]
  D["Agent sends hub commands<br/>with it<br/>REQ-018"]
  E{"Owner revokes it?<br/>REQ-065"}
  F["Refuse the credential's<br/>next request<br/>REQ-065"]
  Z(["End"])
  A e1@--> B
  B e2@--> C
  C e3@--> D
  D e4@--> E
  E e5@-->|yes| F
  E e6@-->|no| Z
  F e7@--> Z
  %% legend: below
  classDef term fill:#e7f5ff,stroke:#1c7ed6,color:#212529
  classDef proc fill:#f8f9fa,stroke:#495057,color:#212529
  classDef decide fill:#f3f0ff,stroke:#7048e8,color:#212529
  classDef gap fill:#f1f3f5,stroke:#adb5bd,stroke-dasharray:2 3,color:#495057
  classDef pass stroke:#868e96,stroke-width:1.5px
  class A,Z term
  class B,C,D,F proc
  class E decide
  class e1,e2,e3,e4,e5,e6,e7 pass
```

| Shape | Means |
| --- | --- |
| Rounded box | Where the flow starts or ends |
| Rectangle | A step |
| Diamond | A decision; each branch is labelled |

## Failure paths

- Refuse the credential's next request (REQ-065)
