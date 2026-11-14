# FL-119 Talk about a stage or an item

[한국어](FL-119-talk-about-a-stage-or-an-item.ko.md)

Serves: REQ-117, REQ-158, REQ-160, REQ-161, REQ-162, REQ-163, REQ-165, REQ-166, REQ-182, REQ-184, REQ-202, REQ-203, REQ-219, REQ-229, REQ-230, REQ-231, REQ-272, REQ-294

Context: CTX-014 Discussion. Starts when the user opens a stage's talk, from the stage, from the first page or from a link, or selects an item to talk about, on a phone or a PC. The agent talks through the hub (FL-109). New in the redesign of 2026-11-06: talk on the items of every stage, choice ② A of its checkpoint 1; until it is built, FL-107 draws comments on the pictures' items only. The design revision of 2026-11-11 added the mark on what the agent has not read (REQ-272) and the selection of a comment's item (REQ-294).

```mermaid
flowchart TD
  A(["The user opens a stage's talk, from the stage,<br/>the first page or a link<br/>SCR-114"]) --> B["Show the talk by turn: what waits for the user<br/>first, then what waits for the agent, with whether<br/>it took it and whether it was written after the agent's<br/>last read, then the closed talk, folded<br/>REQ-229, REQ-272 · SCR-114"]
  B --> B2["Show apart, still open, the comments<br/>whose items are no longer in the stage<br/>REQ-162 · SCR-114"]
  B2 --> B3{"Does the user pick a comment<br/>that is on an item?<br/>REQ-294"}
  B3 -->|yes| B4["Select the comment's item in the stage, moving the<br/>picture to the item or the list to its row, and mark it<br/>REQ-294 · SCR-112, SCR-113, SCR-115"]
  B3 -->|no| C
  B4 --> C{"Is an item selected, in the picture<br/>or in the list?<br/>SCR-112, SCR-113"}
  C -->|yes| C1["Narrow the talk to that item<br/>REQ-230 · SCR-115"]
  C -->|no| D
  C1 --> D["The user writes a comment or a reply<br/>and sends it<br/>SCR-114"]
  D --> E{"What does it go on?"}
  E -->|a part of a picture| E1["Attach it to the item's trace ID, or with<br/>a quote to the item that holds the part,<br/>as FL-107 does<br/>REQ-158, REQ-160, REQ-161"]
  E -->|an item of a list| E2["Attach it to the item's trace ID,<br/>not to a position<br/>REQ-158, REQ-160"]
  E -->|nothing selected| E3["Attach it to the stage as a whole<br/>REQ-231"]
  E -->|a comment| E4["Add it as a reply under the comment,<br/>which opens again if it was closed<br/>REQ-202, REQ-203"]
  E1 --> F
  E2 --> F
  E3 --> F
  E4 --> F{"Does the NEXUS server take it: checked<br/>by Cloudflare Access, and not<br/>sent from another site?<br/>REQ-117"}
  F -->|no| F1["Say that it was not saved,<br/>and keep its text in the page<br/>SCR-114"]
  F1 --> Z(["End"])
  F -->|yes| G["Mark the user as its author; the talk is now<br/>the agent's turn and waits in the agent to-do<br/>until the agent's next work, FL-108<br/>REQ-163, REQ-182"]
  G --> H["At its work the agent replies, proposes or asks<br/>for a checkpoint through the hub, FL-109;<br/>the talk is the user's turn again<br/>REQ-184, REQ-219"]
  H --> I["The user replies, settles the comment, marks it<br/>answered or opens it again, here or from<br/>the first page, FL-117; a recorded decision closes it<br/>REQ-165, REQ-166, REQ-202, REQ-203"]
  I --> Z
```

The talk shows whose turn it is on every comment, so that it does not look like a chat that answers at once: the agent reads it only when its work on the project starts (hotspot 6 of stage 01). What is kept when a comment cannot be saved is point 14 of the [README](README.md#points-for-the-functional-spec), as for FL-107. The stage and its talk select each other: an item picked in the stage narrows the talk to it (REQ-230), and a comment picked in the talk selects its item in the stage (REQ-294), which the screens had not defined before the design revision of 2026-11-11. What the agent has not read yet is marked (REQ-272), from the time of its last read that the server records (FL-108).
