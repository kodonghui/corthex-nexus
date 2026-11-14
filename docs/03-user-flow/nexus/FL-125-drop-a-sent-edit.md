# FL-125 Drop an edit that waits to be reflected

[한국어](FL-125-drop-a-sent-edit.ko.md)

Serves: REQ-170, REQ-184, REQ-243, REQ-244, REQ-245, REQ-267

Context: CTX-010 Editing, with CTX-007 Stage progress for the agent to-do. Where editing is included, in phase ②; not in NEXUS 0.2. Starts when the user opens an edit that was sent and waits to be reflected, in the picture view or in the stage's talk. Drawn on 2026-11-07 from stage 01's frames for phase ②.

```mermaid
flowchart TD
  A(["Where editing is included, the user opens<br/>a sent edit that waits to be reflected<br/>REQ-244"]) --> B{"Has its picture been redrawn<br/>since the edit was sent?<br/>REQ-243"}
  B -->|yes| B1["Mark it as sent on an earlier<br/>document version, with both commits<br/>REQ-243 · SCR-112"]
  B -->|no| C
  B1 --> C{"Does the user drop it?<br/>REQ-244"}
  C -->|no| C1["It keeps waiting; the agent puts it in if it<br/>fits the new document, or asks again, FL-111"]
  C1 --> Z(["End"])
  C -->|yes| D["The user confirms in the page, and the<br/>edit leaves the pending reflections<br/>REQ-244 · SCR-112"]
  D --> E{"Has the agent reported an<br/>open pull request for it?"}
  E -->|no| E1["Close the edit as dropped<br/>REQ-244"]
  E1 --> Z
  E -->|yes| F["List it in the agent to-do as a dropped<br/>edit whose pull request is open<br/>REQ-267"]
  F --> G["At its next work, FL-108, the agent<br/>looks at the pull request<br/>REQ-245"]
  G --> H{"What state is it in?"}
  H -->|still open| H1["Close it without merging<br/>REQ-245"]
  H1 --> H4
  H -->|closed without merging| H4["Report it through the hub;<br/>the edit closes as dropped<br/>REQ-245, REQ-184"]
  H4 --> Z
  H -->|merged before the drop| H2["Report it merged; the edit closes<br/>as reflected, and the agent tells<br/>the user in the session<br/>REQ-170, REQ-184"]
  H2 --> H3["Taking the change back is a new<br/>edit, FL-115, or stage work, FL-112"]
  H3 --> Z
```

An edit draft is dropped in FL-115, as an edit conflict or before it is sent; this flow drops an edit that was sent. NEXUS never closes a pull request: the agent does at its next work, as it opens them (FL-111).
