# FL-118 Find the way in a project

[한국어](FL-118-find-the-way-in-a-project.ko.md)

Serves: REQ-093, REQ-094, REQ-176, REQ-178, REQ-224, REQ-225, REQ-226, REQ-227, REQ-228, REQ-230, REQ-232, REQ-233, REQ-234, REQ-235, REQ-236, REQ-237

Context: CTX-008 Overview. Starts when the user opens a project from the first page, a stage or an item from a link, or an address of NEXUS 0.2, on a phone or a PC. New in the redesign of 2026-11-06; until it is built, FL-105 and FL-106 draw the way through the hub page and the picture view.

```mermaid
flowchart TD
  A(["The user opens a project, a stage or an item,<br/>from the first page, a link or<br/>an address of NEXUS 0.2<br/>SCR-110"]) --> B{"Is it an address of NEXUS 0.2?"}
  B -->|yes| B1["Lead it to the same place<br/>in the redesign<br/>REQ-234"]
  B1 --> C
  B -->|no| C["Open the project's workspace at the stage,<br/>its current stage when none is named: the 13 stages<br/>in a list, the stage, and its talk beside it<br/>REQ-224, REQ-236 · SCR-111"]
  C --> W{"Is the window under 1024 pixels wide?"}
  W -->|yes| W1["Show the stage, the talk and the item as tabs,<br/>and the list of stages from the stage's title<br/>REQ-235"]
  W -->|no| D
  W1 --> D{"Has the stage a picture?"}
  D -->|yes, 01, 05 or 07| E["Show the stage's head and its picture, with where<br/>the view is in the whole picture, and a tab<br/>that lists the stage's items<br/>REQ-225, REQ-226, REQ-237 · SCR-112"]
  D -->|no| F["Show the stage's head<br/>and its items as a list<br/>REQ-225, REQ-226 · SCR-113"]
  E --> G{"What does the user do?"}
  F --> G
  G -->|narrows the list| H["Narrow it to the items with talk, those that wait<br/>for the user or those with what is left,<br/>or group them by context<br/>REQ-176, REQ-227"]
  H --> G
  G -->|selects an item| I["Show the item beside the stage, with its fields,<br/>the place of its source and the items that it<br/>comes from and leads to, and narrow the talk to it<br/>REQ-093, REQ-228, REQ-230 · SCR-115"]
  I --> Z(["End"])
  G -->|picks another stage| C
  G -->|searches| J["Find items by ID or words of a title<br/>in every project, and open the one<br/>picked at its place<br/>REQ-094, REQ-232 · SCR-116"]
  J --> I
  G -->|passes the stage's checkpoint| K["Pass it from the stage record<br/>behind the head, FL-113<br/>REQ-178, REQ-226"]
  K --> Z
  G -->|opens the full checks| L["Show the hub page whole: every project's<br/>13 stages and their checks<br/>REQ-233 · SCR-117"]
  L --> Z
  G -->|talks about the stage or an item| M["FL-119"]
  M --> Z
```

The search keeps what it does on the hub page today (REQ-094); it only moves into a field at the top of every page, since the first page is no longer the hub page. The redirects of NEXUS 0.2's addresses are listed in [stage 07](../../07-sitemap/nexus.md#addresses).
