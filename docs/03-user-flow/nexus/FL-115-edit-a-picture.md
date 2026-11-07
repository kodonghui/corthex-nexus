# FL-115 Edit a picture on a PC

[한국어](FL-115-edit-a-picture.ko.md)

Serves: REQ-127, REQ-130, REQ-171, REQ-172, REQ-240, REQ-241, REQ-242, REQ-244, REQ-247

Context: CTX-010 Editing, with Positions of CTX-012 Pictures. Where editing is included, in phase ②; not in NEXUS 0.2. Starts when the user opens a picture to edit it in the picture view (FL-106). Redrawn on 2026-11-07 from stage 01's frames for phase ②.

```mermaid
flowchart TD
  A(["Where editing is included, the user opens<br/>a picture to edit it, FL-106<br/>REQ-127"]) --> B{"Is the window at least<br/>1024 pixels wide?<br/>REQ-171"}
  B -->|no| B1["Keep the picture read-only,<br/>marking an open edit draft<br/>REQ-171 · SCR-112"]
  B1 --> Z(["End"])
  B -->|yes| C{"Does the part's stage have<br/>an open edit draft?<br/>REQ-240"}
  C -->|no| D["Open the picture in the open-source editor:<br/>Excalidraw for the DDD board and the sitemap,<br/>ERD Editor for the ERD<br/>REQ-127 · SCR-112"]
  C -->|yes, on the latest version| C1["Open the draft where it was left,<br/>on this PC or another<br/>REQ-240 · SCR-112"]
  C -->|yes, on an older version| H["Show the draft over the new picture as<br/>an edit conflict, with the changes that<br/>no longer apply listed apart<br/>REQ-130 · SCR-112"]
  H --> I{"What does the user choose?<br/>REQ-130"}
  I -->|keep it on the new picture| C1
  I -->|edit again| D
  I -->|drop it| I1["Close the draft as dropped<br/>REQ-244"]
  I1 --> Z
  D --> E{"What does the user change?"}
  C1 --> E
  E -->|only positions| F["Keep the new positions under the items' IDs,<br/>without changing the stage sources<br/>REQ-172"]
  F --> Z
  E -->|the content| G{"Does the save start from the draft<br/>as the server last saved it?<br/>REQ-241"}
  G -->|no, as from a second window| G1["Refuse the save, and offer to load<br/>the draft as it was last saved<br/>REQ-241 · SCR-112"]
  G1 --> E
  G -->|yes| G2["Save the changes to the edit draft<br/>on the NEXUS server, bound to the document<br/>version that the picture was drawn from<br/>REQ-240"]
  G2 --> J{"Does the user send it now?"}
  J -->|drops it| I1
  J -->|not yet| J1["The draft waits on the server,<br/>marked on the picture<br/>REQ-240 · SCR-112"]
  J1 --> Z
  J -->|yes| K["Show the list of changes item by item, added,<br/>renamed, changed, removed, connected and<br/>disconnected, for a one-line note<br/>REQ-242 · SCR-112"]
  K --> L{"Is the draft's document version<br/>still the latest?<br/>REQ-130"}
  L -->|no| H
  L -->|yes| M["Record the edit as a pending reflection, with its list,<br/>its note and the positions of the items it adds<br/>under temporary names, FL-111<br/>REQ-242, REQ-247"]
  M --> Z
```

Phase ② turns on editing in the editors that phase ① uses read-only (D11 of stage 02). Keeping the draft on the new picture is offered only when every change still applies; otherwise the user edits again or drops it. A sent edit is never an edit conflict: it waits to be reflected, and the agent puts it in if it fits the new document and asks the user again if it does not (FL-111, hotspot 22 of stage 01). The user can still drop it while it waits (FL-125). The positions of the items that an edit adds follow D14 of stage 02, which this stage's checkpoint for phase ② asks; with its other choice, the automatic layout places them and step M carries no positions.
