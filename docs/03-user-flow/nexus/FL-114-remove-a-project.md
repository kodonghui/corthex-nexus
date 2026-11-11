# FL-114 Remove a project from the NEXUS server

[한국어](FL-114-remove-a-project.ko.md)

Serves: REQ-105, REQ-113, REQ-117, REQ-120, REQ-206, REQ-292, REQ-293

Context: CTX-009 Sharing. Starts when the user asks to remove a project from the NEXUS server, in the session with the agent or in NEXUS. Built in phase 1 for snapshots; NEXUS 0.2 deletes the project space as well (REQ-120). Since the design revision of 2026-11-11 the user confirms in NEXUS, under the user's own sign-in, and the server refuses a removal that carries the service token (REQ-293): a space holds comments, proposals and passed checkpoints that Git does not, and until then the token that every session holds could delete them.

```mermaid
flowchart TD
  A(["The user asks to remove a project<br/>from the NEXUS server"]) --> B{"Where?"}
  B -->|in the session| B1["The agent shows a dry run of what the removal deletes:<br/>the snapshot and the project space, with its pictures,<br/>comments, proposals, pending reflections and passed<br/>checkpoints, and where editing is included its edit drafts,<br/>positions and work boards; it sends no removal, and gives<br/>the address where the user confirms it in NEXUS<br/>REQ-105, REQ-206"]
  B1 --> B2{"Is the project in the push list?"}
  B2 -->|yes| B3["Say that a later push is the project's first again<br/>and waits for the user's yes, and how to take it<br/>off the push list"]
  B2 -->|no| C
  B3 --> C
  B -->|in NEXUS| C["Open the project's data: what the removal deletes and<br/>what of it Git does not hold, with an offer to export<br/>the project space first, FL-127<br/>REQ-206, REQ-292 · SCR-130"]
  C --> D{"Does the user confirm the removal,<br/>by typing the project's name?"}
  D -->|no| D1["Nothing is removed"]
  D1 --> Z(["End"])
  D -->|yes| E{"Did Cloudflare Access check the request, from the<br/>user's own sign-in and not from another site?<br/>REQ-113, REQ-117"}
  E -->|no| E1["The server refuses it, and<br/>the page says why"]
  E1 --> Z
  E -->|yes| F["Delete the snapshot and the project space<br/>REQ-120"]
  F --> G["The project's sources and<br/>the device's files stay"]
  G --> Z
  X(["A request to remove a project<br/>carries the service token"]) --> X1["The server refuses it: only the user<br/>removes a project, in NEXUS<br/>REQ-293"]
  X1 --> Z
```

The decisions on its comments stay where the agent wrote them, in Git and in the project's records; open comments and pending reflections go with the space. Point 17 of the [README](README.md#points-for-the-functional-spec) lists them before the user confirms, and the export keeps a copy of what Git does not hold (FL-127). After a removal the push job sends nothing for the project, since the server no longer holds it (FL-102), and a push from a device whose push list still names the project is the project's first again: it waits for the user's yes and then puts the project back with an empty space. How the user confirms on the page, and what the hub's removal command does once the server refuses the service token, are point 30.
