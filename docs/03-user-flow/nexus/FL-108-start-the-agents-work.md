# FL-108 Start the agent's work on a project

[한국어](FL-108-start-the-agents-work.ko.md)

Serves: REQ-131, REQ-180, REQ-181, REQ-182, REQ-183, REQ-185, REQ-193, REQ-245, REQ-267, REQ-270, REQ-273, REQ-274, REQ-275

Context: CTX-007 Stage progress, which serves the agent to-do, with CTX-014 Discussion, CTX-010 Editing and, where editing is included, CTX-016 Workshops. Starts when the agent starts its work on a project in a session, following a stage skill, and again in the same session before each checkpoint request and once a day has passed since its last read (REQ-274). New in NEXUS 0.2; the design revision of 2026-11-11 added the check of whether the session can send, the recorded read and the reads that follow the first.

```mermaid
flowchart TD
  A(["The agent starts its work on a project<br/>in a session, following a stage skill<br/>REQ-181"]) --> A1{"Can the session send for the project: the server's<br/>address, the project in the push list and the service<br/>token, from the profile or, on a device with neither a<br/>profile nor a list of projects, from its environment?<br/>REQ-275"}
  A1 -->|no| A2{"Is the project expected on a NEXUS server: do<br/>its settings say so, or does the session's<br/>push list name it?<br/>REQ-273"}
  A2 -->|no| A4["Say nothing, and go on with the work"]
  A4 --> Z(["End"])
  A2 -->|yes| A3["Tell the user once in the session, in one line that<br/>names what is missing: the server's address, the project<br/>in the push list or the service token; then go on<br/>with the work<br/>REQ-273"]
  A3 --> Z
  A1 -->|yes| B{"Is a stage source newer than<br/>the pushed snapshot?<br/>REQ-193"}
  B -->|yes| B1["Push the project's snapshot, FL-102<br/>REQ-193"]
  B -->|no| D
  B1 --> D["Read the agent to-do through the hub, with the<br/>service token; the NEXUS server records the time<br/>of the read with the session's label<br/>REQ-183, REQ-270"]
  R(["Later in the same session: before each checkpoint<br/>request, FL-112, and once a day has passed<br/>since the last read<br/>REQ-274"]) --> D
  D --> E{"Could the hub read it?"}
  E -->|no, no answer from the server| E1["Say so, and go on with the work<br/>REQ-185"]
  E1 --> Z
  E -->|yes| F["List the open comments first, then the open<br/>discrepancies, then the pending reflections, and<br/>the checkpoints passed in NEXUS that the stage<br/>records do not hold yet; where editing is included,<br/>also the dropped edits whose pull request is open,<br/>the workshops' passed checkpoints not yet reflected<br/>and the work boards changed since the agent read them<br/>REQ-180, REQ-182, REQ-267"]
  F --> G{"Is anything waiting?"}
  G -->|no| Z
  G -->|yes| H["Tell the user in the session what is waiting"]
  H --> I["Answer the open comments, FL-109"]
  I --> J["Look into the open discrepancies: fix the stage<br/>source by stage work, FL-112, or take it up<br/>on the discrepancy, FL-109"]
  J --> K["Reflect the pending reflections<br/>by pull request, FL-111<br/>REQ-131"]
  K --> L["Write the passed checkpoints into<br/>the stage records, FL-113"]
  L --> L2["Where editing is included: close the dropped edits'<br/>pull requests, FL-125; reflect the workshops' passed<br/>checkpoints, FL-126; read the changed work boards, FL-116<br/>REQ-245, REQ-267"]
  L2 --> Z
```

A project that is not on the NEXUS server has no agent to-do. A session that cannot send for a project that is expected there says so once (REQ-273), where the rule before the design revision of 2026-11-11 had the agent go on in silence: a cloud session, which loses the device's files when it ends, then never read the to-do, and nothing showed it. Such a session can send once its environment names the server's address and the push list (REQ-275); putting them there is the user's own step, never the agent's. The time that the server records with each read (REQ-270) is what the first page and the workspace show as the agent's last read (FL-117, FL-118). Two agents that start on one project at once, and what counts as the start of the agent's work and how the to-do meets what the user asked in the session, are points 12 and 13 of the [README](README.md#points-for-the-functional-spec); what tells a session that a project is expected on a server, and what its environment holds, are points 24 and 25.
