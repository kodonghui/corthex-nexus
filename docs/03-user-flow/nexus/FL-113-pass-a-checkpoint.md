# FL-113 Pass a stage's checkpoint

[한국어](FL-113-pass-a-checkpoint.ko.md)

Serves: REQ-084, REQ-086, REQ-089, REQ-090, REQ-117, REQ-125, REQ-173, REQ-176, REQ-177, REQ-178, REQ-179, REQ-180, REQ-278, REQ-279, REQ-283

Context: CTX-007 Stage progress. Starts when the user looks at whether a stage is ready, in the stage overview of NEXUS or in the session with the agent. New in NEXUS 0.2; the design revision of 2026-11-11 binds a pass to what the user saw (REQ-278, REQ-279, under D17 of stage 02, decided on 2026-11-12) and names the stage's record of the redesign beside the stage overview.

```mermaid
flowchart TD
  A(["The user looks at whether a stage is ready"]) --> B{"Where?"}
  B -->|in NEXUS| C["Open the stage's record, in the stage overview or, in the<br/>redesign, behind the stage's head: the checkpoint request whole,<br/>the commit that the project shows, and the stage's open<br/>discrepancies, comments and pending reflections, together<br/>REQ-176 · SCR-109, SCR-112, SCR-113"]
  C --> D{"Does the user pass the checkpoint,<br/>with or without what is left?<br/>REQ-177"}
  D -->|no| D1["The stage stays as it is, and the user<br/>may leave a comment, FL-107, FL-119"]
  D1 --> Z(["End"])
  D -->|yes| D2["Send the pass with the commit that the page showed and,<br/>where the agent asked, the last entry of the<br/>checkpoint request that it showed<br/>REQ-278"]
  D2 --> E{"Does the request come from the user's own<br/>sign-in, and not from another site?<br/>REQ-117, REQ-179"}
  E -->|no| E1["Refuse it<br/>REQ-179"]
  E1 --> Z
  E -->|yes| E2{"Has the commit that the project shows, or the<br/>checkpoint request, changed since the page was drawn?<br/>REQ-279"}
  E2 -->|yes| E3["Refuse the pass, saying what changed;<br/>the page shows the stage as it is now<br/>REQ-279 · SCR-109, SCR-112, SCR-113"]
  E3 --> D
  E2 -->|no| F["Record who passed it and when, what was seen, and the<br/>kind of browser and device that the request names<br/>REQ-178, REQ-278, REQ-283"]
  F --> G["List it in the agent to-do until<br/>the stage record holds it<br/>REQ-180"]
  G --> H["At its next work, FL-108, the agent writes the<br/>checkpoint into the stage record, with a reference<br/>to the checkpoint recorded in NEXUS<br/>REQ-086, REQ-090"]
  B -->|in the session| I["The agent writes the checkpoint into the<br/>stage record, with a reference to the record<br/>that holds the user's approval<br/>REQ-086, REQ-090"]
  H --> J["The pull request is merged, and the agent<br/>pushes the new snapshot, FL-102<br/>REQ-125"]
  I --> J
  J --> K["The hub reads the record from the repository and<br/>shows the stage as recorded, the same on<br/>every device and on the server<br/>REQ-084, REQ-089, REQ-173 · SCR-104, SCR-117"]
  K --> Z
```

Only the user passes a checkpoint; an AI recommendation, a read receipt or an edit time is not one. A pass binds what the user saw, the commit that the project shows and the last entry of the checkpoint request, so that a push or a reply that arrives while the page is open does not pass unseen (REQ-278, REQ-279; point 28 of the README). The kind of browser and device is recorded so that a pass from a browser that an agent drives can be told afterwards (REQ-283); on a project that is not synthetic a browser agent leaves the pass to the user (REQ-284, a rule of the stage 12 skill, which no flow draws). Where editing is included, a workshop's checkpoint after Step 1-b, 7 or 9 is passed here too, in NEXUS only, and the server records the board version that the user passed (FL-116, REQ-261, D15 of stage 02). How the stage overview shows a checkpoint passed in NEXUS before the agent records it is point 15 of the [README](README.md#points-for-the-functional-spec).
