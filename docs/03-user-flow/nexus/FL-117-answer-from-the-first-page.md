# FL-117 Answer from the first page

[한국어](FL-117-answer-from-the-first-page.ko.md)

Serves: REQ-117, REQ-129, REQ-159, REQ-178, REQ-179, REQ-219, REQ-220, REQ-221, REQ-222, REQ-223, REQ-236, REQ-271, REQ-272, REQ-278, REQ-279, REQ-280

Context: CTX-014 Discussion. Starts when the user opens NEXUS's first page, on a phone or a PC. New in the redesign of 2026-11-06; until it is built, the user answers in the picture view (FL-107, FL-110) and passes checkpoints in the stage overview (FL-113). The design revision of 2026-11-11 added the last push and the agent's last read, and changed how a checkpoint is passed from the page (REQ-278 to REQ-280, under D17 of stage 02, decided on 2026-11-12).

```mermaid
flowchart TD
  A(["The user opens the first page,<br/>on a phone or a PC<br/>SCR-110"]) --> B{"Does the NEXUS server hold a project?"}
  B -->|no| B1["Say what NEXUS shows and how<br/>a project gets pushed to it<br/>REQ-223 · SCR-110"]
  B1 --> Z(["End"])
  B -->|yes| C["Gather my turn from every project: the open<br/>proposals, the comments that wait for the user<br/>and the checkpoints that the agent asks for<br/>REQ-219 · SCR-110"]
  C --> D{"Does anything wait for the user?"}
  D -->|no| D1["Say that nothing waits for the user<br/>REQ-219 · SCR-110"]
  D -->|yes| E["Show each entry with its kind, its project,<br/>stage and item, its first lines,<br/>and who wrote it when<br/>REQ-219 · SCR-110"]
  D1 --> F
  E --> F["Show how many entries of each project's agent to-do wait and how<br/>many of them the agent has not read, when the project was last pushed,<br/>with the commit that it shows, and when the agent last read its to-do;<br/>and that the agent reads them at its next work on the project<br/>REQ-221, REQ-271, REQ-272 · SCR-110"]
  F --> G["Show each project's card with its current stage<br/>and next action, a small view of each picture<br/>and its 13 stages by shape and word<br/>REQ-222, REQ-236 · SCR-110"]
  G --> H{"What does the user do?"}
  H -->|accepts or dismisses a proposal| I["Accept or dismiss it in place,<br/>as FL-110 does<br/>REQ-159, REQ-220"]
  H -->|takes the agent's recommendation on a comment| J["Settle the comment with a reply<br/>that takes it<br/>REQ-220"]
  H -->|opens a checkpoint request, its entry's first action| P["Open the stage's workspace with the talk at the request,<br/>beside the stage that it asks about; the user<br/>passes there, FL-113<br/>REQ-280 · SCR-114"]
  P --> Z
  H -->|passes a checkpoint, offered only while its entry shows the request whole| Q["Pass the checkpoint with the commit that the page showed<br/>and the request's last entry, as FL-113 does<br/>REQ-178, REQ-278, REQ-280"]
  I --> K{"Does the NEXUS server take it: the user's<br/>own sign-in, and not sent<br/>from another site?<br/>REQ-117, REQ-129, REQ-179"}
  J --> K
  Q --> K
  K -->|no| K1["Say that the answer was not saved,<br/>and keep the entry in my turn<br/>REQ-117 · SCR-110"]
  K1 --> Z
  K -->|yes| K2{"For a pass: has the commit or the request<br/>changed since the page was drawn?<br/>REQ-279"}
  K2 -->|yes| K3["Refuse the pass, saying what changed, and<br/>show the entry as it is now<br/>REQ-279 · SCR-110"]
  K3 --> Z
  K2 -->|no, or not a pass| L["The entry leaves my turn and waits in the<br/>agent to-do until the agent's next work, FL-108<br/>REQ-219, REQ-221"]
  L --> Z
  H -->|answers in words| M["Open the stage's workspace with the talk<br/>at that entry, FL-119<br/>REQ-220 · SCR-114"]
  H -->|opens a project| N["Open the project's workspace<br/>at its current stage, FL-118<br/>SCR-111"]
  M --> Z
  N --> Z
```

The agent reads what the user answers only when its work on the project starts, so the page says so beside the agent to-do instead of looking like a chat (hotspot 6 of stage 01). Beside it the page shows when each project was last pushed and when the agent last read its to-do, so that a loop that stands still shows (REQ-271, REQ-272). A checkpoint request offers opening it first, and the pass only while its entry shows the request whole (REQ-280): before the design revision of 2026-11-11 one press on the request's first lines passed the stage, with the words "as recommended". Which entries offer the agent's recommendation, and what taking one writes, is in the functional spec (SPEC-143); what the request whole is, and what the pass's button says, are point 29 of the [README](README.md#points-for-the-functional-spec).
