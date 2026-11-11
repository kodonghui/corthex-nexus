# FL-102 Push a project to the NEXUS server

[한국어](FL-102-push-a-project.ko.md)

Serves: REQ-105, REQ-106, REQ-107, REQ-108, REQ-109, REQ-110, REQ-111, REQ-112, REQ-113, REQ-114, REQ-115, REQ-116, REQ-118, REQ-119, REQ-125, REQ-193, REQ-201, REQ-275, REQ-276

Context: CTX-009 Sharing. Starts when the agent pushes after stage work is merged or a checkpoint is recorded (REQ-125), at the start of its work when a stage source is newer than the pushed snapshot (REQ-193, FL-108), when the user asks, or, where a project's repository runs the push job, when a commit reaches its default branch (REQ-276, open under D16 of stage 02). Built in phase 1; NEXUS 0.2 adds the pushes of REQ-125 and REQ-193 and the pictures that a stored snapshot leads to (FL-103); the design revision of 2026-11-11 adds the push job, the push list that a session's environment names (REQ-275) and the check of REQ-201, which the flow had left to the functional spec.

```mermaid
flowchart TD
  A(["The agent pushes after a merge or a checkpoint,<br/>or at the start of its work, the user asks, or<br/>a repository's push job runs on a commit<br/>to its default branch<br/>REQ-125, REQ-193, REQ-276"]) --> B{"Is the project in the push list: the profile's or,<br/>on a device with neither a profile nor a list<br/>of projects, the one that the environment names?<br/>REQ-106, REQ-275"}
  B -->|no| B1["Send nothing, and say how<br/>a project joins the push list"]
  B1 --> Z(["End"])
  B -->|yes| C{"Pushed before?"}
  C -->|no, and the push job runs| C3["Send nothing: the push job never makes<br/>a project's first push<br/>REQ-107, REQ-276"]
  C3 --> Z
  C -->|no, in a session| C1{"The agent asks the user first:<br/>does the user agree?<br/>REQ-107"}
  C1 -->|no| C2["Send nothing"]
  C2 --> Z
  C1 -->|yes| D
  C -->|yes| D["Take a fresh snapshot, FL-101"]
  D --> E["Show a dry run of what<br/>the push would send<br/>REQ-108"]
  E --> F{"Are the service token's<br/>environment variables set?<br/>REQ-109"}
  F -->|no| F1["Name the missing variables,<br/>never showing a value<br/>REQ-110"]
  F1 --> Z
  F -->|yes| F2{"Is the snapshot's commit the one that the<br/>server holds, or a descendant of it?<br/>REQ-201"}
  F2 -->|no| F3["Send nothing, and say to fetch and push again, or<br/>name both commits when the held one is not<br/>in the history of the snapshot's commit<br/>REQ-201"]
  F3 --> Z
  F2 -->|yes| G["Send the snapshot to the NEXUS server,<br/>and nothing else off the device<br/>REQ-105"]
  G --> H{"Answered with a redirect?<br/>REQ-111"}
  H -->|yes| H1["Report a refused token,<br/>without following the redirect<br/>REQ-111"]
  H1 --> Z
  H -->|no| I{"Did Cloudflare Access check the request,<br/>at the address that the user set?<br/>REQ-113, REQ-114"}
  I -->|no| R["The server refuses it, and<br/>the hub shows the server's reason<br/>REQ-112"]
  R --> Z
  I -->|yes| J{"In the snapshot format, newer than the one<br/>held, within 1 MiB and 30 projects?<br/>REQ-115, REQ-116"}
  J -->|no| R
  J -->|yes| K["Store it, logging no stored text; the server keeps<br/>nothing but the snapshots and what<br/>the project spaces hold<br/>REQ-118, REQ-119"]
  K --> L["Draw the project's pictures, FL-103"]
  L --> Z
```

The service token stays in the environment variables: the hub never writes it to a file, a log or a message (REQ-110). Projects with protected data, such as answer keys or student records, are never in the push list. Which snapshot counts as newer when two devices push the same project is point 3 of the [README](README.md#points-for-the-functional-spec), which REQ-201 answers with the commits' descent. The push job is the hub at a pinned commit, run in the repository's own CI with the service token as the repository's secret (REQ-277, TERM-153); it sends only a project that the server already holds, so a project's first push is always agreed in a session (REQ-107). The push job is open under D16 of stage 02. What the environment holds, and how a device without the hub's own files learns whether a project was pushed before, are points 25 and 26.
