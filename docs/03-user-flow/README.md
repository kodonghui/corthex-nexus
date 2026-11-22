# NEXUS v3: user flows

[한국어](README.ko.md)

Status: draft, waiting for its checkpoint.

Inputs: the stage-02 requirements ([requirements.md](../02-prd/requirements.md)), passed on 2026-11-23, and the stage-01 contexts and glossary ([nexus.md](../01-domain/nexus.md)). Each flow is one goal that the owner or an agent comes with; its file holds one Mermaid flowchart, and each step names the requirements it serves.

## 1. Flows

| Flow | Who | Release | Goal |
| --- | --- | --- | --- |
| [FL-001 Put a project on NEXUS](FL-001-put-a-project-on-nexus.md) | Agent, owner | Must | An agent sends a project's first snapshot, and the owner finds the project drawn. |
| [FL-002 Read a stage from the to-do](FL-002-read-a-stage-from-the-to-do.md) | Owner | Must | The owner opens NEXUS, picks a stage from the to-do and reads its diagram or item table. |
| [FL-003 Comment and answer an AI proposal](FL-003-comment-and-answer-an-ai-proposal.md) | Owner, agent | Must | The owner comments on a diagram, an agent answers or proposes a change, and the owner accepts or rejects it. |
| [FL-004 Edit a diagram directly](FL-004-edit-a-diagram-directly.md) | Owner on a PC | Must | The owner renames an element or connects two on a PC, and the edit waits to be reflected into Git. |
| [FL-005 Reflect accepted changes into Git](FL-005-reflect-accepted-changes-into-git.md) | Agent | Must | An agent carries a diagram's accepted change sets into the stage document through one pull request. |
| [FL-006 Confirm a diagram](FL-006-confirm-a-diagram.md) | Owner on a PC, agent | Must | The owner confirms a diagram or an item table on a PC, an agent records it, and the stage passes once all are recorded. |
| [FL-007 Draw a new snapshot](FL-007-draw-a-new-snapshot.md) | Agent | Must | After a merge, an agent sends a snapshot and NEXUS redraws the project, keeping layouts and comments. |
| [FL-008 Read and comment on a phone](FL-008-read-and-comment-on-a-phone.md) | Owner on a phone | Must | The owner reads diagrams and comments on a phone and leaves comments; deciding waits for a PC. |
| [FL-009 Issue and revoke an agent credential](FL-009-issue-and-revoke-agent-access.md) | Owner | Must | The owner gives an agent a credential for hub commands and can take it back. |
| [FL-010 Delete a project space](FL-010-delete-a-project-space.md) | Owner | Must | The owner removes a project from NEXUS after seeing what goes with it. |
| [FL-011 Back up and rehearse a restore](FL-011-back-up-and-rehearse-a-restore.md) | NEXUS, maintainer | Must | NEXUS backs up its data every day, and a restore is rehearsed before each release. |
| [FL-012 Run an event storming workshop](FL-012-run-an-event-storming-workshop.md) | Owner, agent | Should | The owner and an agent build the domain design step by step on a free canvas, and each confirmed step goes into the domain document. |
| [FL-013 Link a Notion page or a Jira project](FL-013-link-a-notion-page-or-jira-project.md) | Owner | Should | The owner links another tool to a project or a stage and sees its status beside the stage, read only. |

## 2. Coverage

Every Must requirement appears in a flow except three that hold on every screen; they and two Should requirements of the same kind are carried to later stages, as below. 75 of 80 requirements appear in at least one flow. A flow's release is the highest of its requirements, except FL-013, whose only Must requirement is a limit on the Should feature it draws.

| Requirement | Release | Why no flow shows it |
| --- | --- | --- |
| REQ-069 | Must | The interface language holds on every screen; stage 08 checks it. |
| REQ-072 | Must | Browsers are checked by the browser walk of stage 12. |
| REQ-073 | Must | Components and corners belong to stage 09. |
| REQ-074 | Should | Contrast and keyboard use are checked on the screens of stages 08 and 12. |
| REQ-075 | Should | Themes belong to stage 09. |

## 3. What the flows add

- FL-011 draws a step the requirements do not describe: telling the owner when a daily backup fails. It is drawn as not in the source; stage 04 decides it.
- FL-003 and FL-004 end where FL-005 starts, so that reflecting into Git is drawn once.

## 4. Checkpoint

Each flow's main path and its failure paths are reviewed. Approved items that this stage removes, defers or changes: none.
