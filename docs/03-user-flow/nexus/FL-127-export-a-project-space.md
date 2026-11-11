# FL-127 Export a project space

[한국어](FL-127-export-a-project-space.ko.md)

Serves: REQ-113, REQ-292

Context: CTX-009 Sharing. Starts when the user opens a project's data in NEXUS and asks for an export, on a phone or a PC. New with the design revision of 2026-11-11 (the review of that day, finding 15): a project space holds comments, proposals and passed checkpoints that Git does not, and nothing let the user take a copy of them.

```mermaid
flowchart TD
  A(["The user opens the project's data,<br/>from the workspace or from a link<br/>SCR-130"]) --> B["Show, each with its count, what the space holds and Git<br/>does not: its comments with their replies, proposals, edits<br/>and passed checkpoints, and from phase ② its edit drafts,<br/>positions and work boards<br/>REQ-292 · SCR-130"]
  B --> C{"Does the user ask for the export?"}
  C -->|no| Z(["End"])
  C -->|yes| D{"Did Cloudflare Access check the request,<br/>from the user's own sign-in?<br/>REQ-113"}
  D -->|no, or it carries the service token| D1["Refuse it, and the page says why<br/>SCR-130"]
  D1 --> Z
  D -->|yes| E{"Does the server hold the project?"}
  E -->|no| E1["Say that there is nothing to export<br/>SCR-130"]
  E1 --> Z
  E -->|yes| F["Build one file with what the space holds and Git<br/>does not, naming the commit that the project<br/>shows and the time<br/>REQ-292"]
  F --> G["The browser saves the file on the user's device; the<br/>server keeps no copy of it and changes nothing"]
  G --> Z
```

The export is not a snapshot: a snapshot is what the hub reads from the stage sources, and Git holds those (TERM-065, TERM-152). It is the user's own copy before a removal (FL-114), apart from the server's backup, which keeps a copy on another machine (REQ-291, which holds for the whole server, so no flow draws it). What the file holds exactly, its format and its limits are point 30 of the [README](README.md#points-for-the-functional-spec).
