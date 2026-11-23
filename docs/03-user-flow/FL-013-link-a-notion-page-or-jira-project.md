# FL-013 Link a Notion page or a Jira project

[한국어](FL-013-link-a-notion-page-or-jira-project.ko.md)

Goal: The owner links another tool to a project or a stage and sees its status beside the stage, read only.

Serves: REQ-058, REQ-059, REQ-060, REQ-061

```mermaid
flowchart TD
  A(["Owner adds a link to a<br/>project or stage<br/>REQ-058"])
  B{"Can the tool be read now?<br/>REQ-061"}
  C["Show the status read from<br/>it, never writing<br/>REQ-058, REQ-060"]
  D["Show the last known status<br/>and its time<br/>REQ-061"]
  E{"Owner removes the link?<br/>REQ-059"}
  F["Drop the link<br/>REQ-059"]
  Z(["End"])
  A e1@--> B
  B e2@-->|yes| C
  B e3@-->|no| D
  C e4@--> E
  D e5@--> E
  E e6@-->|yes| F
  E e7@-->|no| Z
  F e8@--> Z
  %% legend: below
  classDef term fill:#e7f5ff,stroke:#1c7ed6,color:#212529
  classDef proc fill:#f8f9fa,stroke:#495057,color:#212529
  classDef decide fill:#f3f0ff,stroke:#7048e8,color:#212529
  classDef gap fill:#f1f3f5,stroke:#adb5bd,stroke-dasharray:2 3,color:#495057
  classDef pass stroke:#868e96,stroke-width:1.5px
  class A,Z term
  class C,D,F proc
  class B,E decide
  class e1,e2,e3,e4,e5,e6,e7,e8 pass
```

| Shape | Means |
| --- | --- |
| Rounded box | Where the flow starts or ends |
| Rectangle | A step |
| Diamond | A decision; each branch is labelled |

## Failure paths

- Show the last known status and its time (REQ-061)
