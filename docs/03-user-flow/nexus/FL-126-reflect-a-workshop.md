# FL-126 Reflect a workshop's board

[한국어](FL-126-reflect-a-workshop.ko.md)

Serves: REQ-086, REQ-180, REQ-184, REQ-216, REQ-217, REQ-259, REQ-265, REQ-267, REQ-268

Context: CTX-016 Workshops, with CTX-007 Stage progress for the agent to-do and the stage record. Where editing is included, in phase ②; not in NEXUS 0.2. Starts when the agent to-do lists a workshop's passed checkpoint that is not yet reflected (FL-108), or when the user tells the agent in the session that a checkpoint passed. Drawn on 2026-11-07 from stage 01's frames for phase ②.

```mermaid
flowchart TD
  A(["Where editing is included, the agent to-do lists a<br/>workshop's passed checkpoint not yet reflected, FL-108,<br/>or the user tells the agent in the session<br/>REQ-267"]) --> B["Claim the entry, and read through the hub the<br/>frames up to the checkpoint's step, at the board<br/>version that the user passed; NEXUS records the read<br/>REQ-268, REQ-259"]
  B --> C{"Has another pull request changed<br/>the stage 01 source since the board<br/>was last reflected?<br/>REQ-265"}
  C -->|yes| C1["List the differences and ask the user,<br/>in the session or on a comment, FL-109,<br/>and record the board difference<br/>REQ-265"]
  C1 --> C2{"What does the user decide?"}
  C2 -->|not now| Z(["End"])
  C2 -->|how to write it| D
  C -->|no| D["Write the stage 01 source from the version<br/>passed, by pull request naming the board version;<br/>for an existing document, change only<br/>what the board holds<br/>REQ-217"]
  D --> E["Report the pull request through the hub,<br/>so that the version passed shows as in review<br/>REQ-184, REQ-268"]
  E --> F{"Is the pull request merged,<br/>as the project's rules say?"}
  F -->|not yet| F1["It waits, and the agent looks<br/>at it again at its next work"]
  F1 --> Z
  F -->|closed without merging| F2["Ask the user again, FL-109"]
  F2 --> Z
  F -->|yes| G["Report it merged: the board is reflected at<br/>that version, and the agent writes the checkpoint<br/>into the stage 01 record, FL-113<br/>REQ-086, REQ-180"]
  G --> H["Push the new snapshot, FL-102; FL-103 draws the<br/>DDD board again from the stage 01 source, while<br/>the work board stays apart<br/>REQ-216"]
  H --> Z
```

The agent writes only what the user passed: the frames up to the checkpoint's step, at the board version recorded with the pass. A change made later, on the next frame, waits for the next checkpoint. The board leads while the workshop runs, yet a change that another pull request made to the stage 01 source is never overwritten unseen: the agent shows the differences, as stage 01's sync rule asks, and writes as the user decides.
