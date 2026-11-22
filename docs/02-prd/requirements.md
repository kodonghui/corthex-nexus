# NEXUS v3: requirements (PRD)

[한국어](requirements.ko.md)

Status: passed on 2026-11-23. The scope and the wording are frozen; a change goes through the feature-change procedure. Requirement IDs start at REQ-001 because v3 restarted the project's documents; the archived v2 keeps its own IDs in its tag.

Inputs: the stage-01 domain design ([nexus.md](../01-domain/nexus.md)), contexts CTX-037 to CTX-043 and terms TERM-189 to TERM-226, with its hotspots marked "review in stage 02"; the maintainer's briefs and redesign decisions named in its section 1.

## 1. Releases

| Priority | Meaning | What it holds |
| --- | --- | --- |
| Must | The first release | Diagrams drawn from Git for stage 01 (DDD board) and stage 05 (ERD), item tables for every other stage, comments and AI proposals, renaming and connecting, confirmation, the to-do, access, viewing and commenting on a phone, daily backups |
| Should | v3 after the first release has been used | The event storming workshop on a free canvas, pictures for stages 03 and 07, tool links, light and dark themes |
| Could | Later, when there is time | Pictures for stages 08 and 09, importing a Miro board |

The first release proves one loop end to end: a stage document in Git is drawn, the owner comments, an agent proposes, the change goes back to Git through a pull request, and the owner confirms the diagram.

## 2. Requirements

| ID | Requirement | Type | Priority | Context | Source | Status |
| --- | --- | --- | --- | --- | --- | --- |
| REQ-001 | When an agent sends a snapshot whose commit descends from the held commit, the system shall draw the stage diagrams from the snapshot's stage documents. | functional | Must | CTX-037 | CTX-037 rule | active |
| REQ-002 | If a snapshot's commit does not descend from the held commit, then the system shall reject the snapshot, leaving the held diagrams as they were. | functional | Must | CTX-037 | CTX-037 rule | active |
| REQ-003 | If a snapshot would create a project space without the owner's first-send confirmation, then the system shall reject it. | functional | Must | CTX-037 | CTX-037 rule; CORTHEX NEXUS work rules | active |
| REQ-004 | The system shall draw stage 01 as a DDD board from the domain document's timeline, contexts, command tables, dependencies and hotspots. | functional | Must | CTX-037 | Redesign recommendations | active |
| REQ-005 | The system shall draw stage 05 as an ERD from the schema source. | functional | Must | CTX-037 | Redesign recommendations | active |
| REQ-006 | The system shall show each stage that has no picture in this release as an item table of its items. | functional | Must | CTX-037 | Brief 2026-11-21 | active |
| REQ-007 | Where user-flow pictures are included, the system shall draw stage 03 as flow diagrams from the user-flow source. | functional | Should | CTX-037 | Redesign recommendations | active |
| REQ-008 | Where sitemap pictures are included, the system shall draw stage 07 as a sitemap tree from the sitemap source. | functional | Should | CTX-037 | Redesign recommendations | active |
| REQ-009 | Where screen-state pictures are included, the system shall draw stage 08 as one panel per screen and state. | functional | Could | CTX-037 | Redesign recommendations | active |
| REQ-010 | Where mockup pictures are included, the system shall show stage 09's mockups with their design tokens. | functional | Could | CTX-037 | Redesign recommendations | active |
| REQ-011 | The system shall show element names on screen and hide their trace IDs. | functional | Must | CTX-037 | Brief 2026-11-21; redesign decision on IDs | active |
| REQ-012 | When the owner copies an element, the system shall put the element's trace ID and name on the clipboard. | functional | Must | CTX-037 | Redesign decision on IDs | active |
| REQ-013 | When the owner moves an element on a PC, the system shall store its new position in the diagram's layout without changing the stage document. | functional | Must | CTX-037 | CTX-037 rule | active |
| REQ-014 | When a diagram is drawn again, the system shall keep the stored positions of the elements that still exist. | functional | Must | CTX-037 | CTX-037 rule | active |
| REQ-015 | The system shall keep layouts in NEXUS and never write them to Git. | functional | Must | CTX-037 | Stage-01 hotspot 7 (answered 2026-11-23) | active |
| REQ-016 | When the owner confirms the deletion of a project space after seeing what it removes, the system shall remove the project's snapshots, diagrams, comments, confirmations and layouts. | functional | Must | CTX-037 | CTX-037 rule | active |
| REQ-017 | If an agent credential asks to delete a project space, then the system shall refuse it. | functional | Must | CTX-037 | CTX-037 rule | active |
| REQ-018 | The system shall accept the snapshot format and the push, todo, claim, comment, decide, reflect, status and record commands of the corthex-hub version that the projects pin. | functional | Must | CTX-037 | Stage-01 hotspot 4 (answered 2026-11-23) | active |
| REQ-019 | The system shall start with no data carried over from v2. | functional | Must | CTX-037 | Stage-01 hotspot 8 (answered 2026-11-23) | active |
| REQ-020 | When the owner or an agent adds a comment to a diagram, an element or a table row, the system shall attach the comment to that target and to the document version shown. | functional | Must | CTX-038 | CTX-038 rule | active |
| REQ-021 | When the owner or an agent replies to a comment, the system shall add the reply to its comment thread. | functional | Must | CTX-038 | CTX-038 table | active |
| REQ-022 | When an agent posts an AI proposal, the system shall lay the proposed change over the diagram, marked apart from the current diagram. | functional | Must | CTX-038 | Redesign decision on review | active |
| REQ-023 | When the owner accepts an AI proposal, the system shall add the accepted change set's reflection to the agent's to-do. | functional | Must | CTX-038 | CTX-038 rule | active |
| REQ-024 | When the owner rejects an AI proposal, the system shall mark the proposal rejected while its comment thread stays open. | functional | Must | CTX-038 | Stage-01 hotspot 14 (answered 2026-11-23) | active |
| REQ-025 | If an agent credential asks to accept or reject an AI proposal, then the system shall refuse it. | functional | Must | CTX-038 | CTX-038 rule; CORTHEX principle 5 | active |
| REQ-026 | When the owner renames an element or connects two elements on a PC, the system shall record the direct edit as an accepted change set. | functional | Must | CTX-038 | Redesign decision on direct edit | active |
| REQ-027 | While a change set waits for reflection, the system shall show its elements as waiting for reflection. | functional | Must | CTX-038 | CTX-038 example | active |
| REQ-028 | When the owner cancels a direct edit that is not yet reflected, the system shall drop its change set and show the diagram without it. | functional | Must | CTX-038 | CTX-038 table | active |
| REQ-029 | When an agent reports a reflection pull request, the system shall link the pull request to its change sets. | functional | Must | CTX-038 | CTX-038 table | active |
| REQ-030 | When a drawn snapshot holds the merge commit of a reflection pull request, the system shall mark its change sets reflected. | functional | Must | CTX-038 | CTX-038 rule | active |
| REQ-031 | When a change set is reflected, the system shall close the comment threads that asked for it. | functional | Must | CTX-038 | CTX-038 table | active |
| REQ-032 | The system shall give an agent a diagram's accepted change sets together, so that one reflection pull request can carry them. | functional | Should | CTX-038 | Stage-01 hotspot 6 (answered 2026-11-23) | active |
| REQ-033 | When an element leaves the stage document, the system shall move its open comment threads to the diagram's own comments, marked as from a removed element. | functional | Must | CTX-038 | Stage-01 hotspot 3 (answered 2026-11-23) | active |
| REQ-034 | When the owner closes a comment thread, the system shall mark it closed. | functional | Must | CTX-038 | Stage-01 hotspot 14 (answered 2026-11-23) | active |
| REQ-035 | When the owner confirms a diagram or an item table on a PC, the system shall record the confirmation with the document version shown. | functional | Must | CTX-039 | Redesign decision on confirmation | active |
| REQ-036 | If an agent credential asks to confirm or cancel a confirmation, then the system shall refuse it. | functional | Must | CTX-039 | CTX-039 rule; CORTHEX principle 5 | active |
| REQ-037 | When the owner cancels a confirmation, the system shall put the diagram back in the owner's to-do as not confirmed. | functional | Must | CTX-039 | CTX-039 table | active |
| REQ-038 | When a confirmation is recorded, the system shall add recording it in the stage record to the agent's to-do. | functional | Must | CTX-039 | CTX-039 table | active |
| REQ-039 | When an agent reports the merged record of a confirmation, the system shall mark the confirmation recorded. | functional | Must | CTX-039 | CTX-039 rule | active |
| REQ-040 | When a drawn snapshot changes the document of a confirmed diagram, the system shall invalidate the confirmation, so that the diagram returns to the owner's to-do. | functional | Must | CTX-039 | Answer 2026-11-23 (stage-01 hotspot 2) | active |
| REQ-041 | The system shall show the elements that changed in the document since a diagram's last confirmation. | functional | Must | CTX-039 | Redesign decision on confirmation | active |
| REQ-042 | When every diagram and item table of a stage has a recorded confirmation, the system shall treat the stage's checkpoint as passed. | functional | Must | CTX-039 | Stage-01 hotspot 9 (answered 2026-11-23) | active |
| REQ-043 | While a workshop is open, the system shall treat the step confirmations at steps 1-b, 7 and 9 as the stage-01 checkpoints. | functional | Should | CTX-040 | Stage-01 hotspot 9 (answered 2026-11-23) | active |
| REQ-044 | When the owner or an agent opens a workshop, the system shall create a workshop board with one frame per event storming step. | functional | Should | CTX-040 | Redesign decision on event storming | active |
| REQ-045 | When an agent draws a step draft, the system shall place its sticky notes in that step's frame with their confidence labels. | functional | Should | CTX-040 | CTX-040 rule | active |
| REQ-046 | While a workshop is open, the system shall let the owner add, move, rename, connect and remove sticky notes on a PC. | functional | Should | CTX-040 | Redesign decision on direct edit | active |
| REQ-047 | If an agent's change would remove a sticky note that a person made, then the system shall refuse that change. | functional | Should | CTX-040 | CTX-040 rule | active |
| REQ-048 | While a workshop is open, the system shall treat the workshop board as the source of the domain design. | functional | Should | CTX-040 | Answer 2026-11-23 (stage-01 hotspot 1) | active |
| REQ-049 | When the owner confirms a step, the system shall add writing that step into the domain document to the agent's to-do. | functional | Should | CTX-040 | CTX-040 table | active |
| REQ-050 | When an agent reports the domain document updated after the last step is confirmed, the system shall close the workshop. | functional | Should | CTX-040 | CTX-040 table | active |
| REQ-051 | When the owner imports a Miro board, the system shall copy its sticky notes' text, colour and position into the workshop board. | functional | Could | CTX-040 | Redesign decision on event storming | active |
| REQ-052 | The system shall open on the owner's to-do, listing diagrams to confirm and AI proposals and questions to answer. | functional | Must | CTX-041 | Redesign recommendations | active |
| REQ-053 | The system shall give agents an agent to-do of open comments, change sets to reflect, confirmations to record and domain documents to write. | functional | Must | CTX-041 | CTX-041 read models | active |
| REQ-054 | When an agent session claims a to-do, the system shall hold it for that session alone. | functional | Must | CTX-041 | CTX-041 rule | active |
| REQ-055 | If a session claims a to-do that another session holds, then the system shall refuse the claim. | functional | Must | CTX-041 | CTX-041 rule | active |
| REQ-056 | When a claim has had no write for 60 minutes and its work has no open pull request, the system shall release the claim. | functional | Must | CTX-041 | CTX-041 table | active |
| REQ-057 | While a to-do's work has an open pull request, the system shall keep its claim. | functional | Must | CTX-041 | CTX-041 rule | active |
| REQ-058 | When the owner adds a Notion page or a Jira project link to a project or a stage, the system shall show the link with the status last read from it. | functional | Should | CTX-042 | Redesign decision on other tools | active |
| REQ-059 | When the owner removes a tool link, the system shall drop the link from the project or stage. | functional | Should | CTX-042 | CTX-042 table | active |
| REQ-060 | The system shall never write to Notion or Jira. | functional | Must | CTX-042 | Redesign decision on other tools | active |
| REQ-061 | If a linked tool cannot be read, then the system shall show the last known status with the time it was read. | functional | Should | CTX-042 | Inferred | active |
| REQ-062 | The system shall admit the owner only through the sign-in gate. | functional | Must | CTX-043 | CTX-043 | active |
| REQ-063 | The system shall serve one owner and offer no sign-up. | functional | Must | CTX-043 | Redesign decision "solo first" | active |
| REQ-064 | When the owner issues an agent credential, the system shall show the credential's secret only once. | functional | Must | CTX-043 | CTX-043 rule | active |
| REQ-065 | When the owner revokes an agent credential, the system shall refuse the credential's next request. | functional | Must | CTX-043 | CTX-043 rule | active |
| REQ-066 | If a request carries neither the owner's sign-in nor a valid agent credential, then the system shall refuse it. | functional | Must | CTX-043 | CTX-043 | active |
| REQ-067 | While the owner uses a phone, the system shall show diagrams, item tables and comments. | functional | Must | none | Redesign decision on mobile | active |
| REQ-068 | While the owner uses a phone, the system shall offer no confirmation, no accepting or rejecting of AI proposals and no direct edit. | functional | Must | none | Redesign decision on mobile; stage-01 hotspot 5 (answered 2026-11-23) | active |
| REQ-069 | The system shall show its interface in Korean. | non-functional | Must | none | Owner profile | active |
| REQ-070 | The system shall open a diagram of up to 300 elements within 2 seconds at the 95th percentile (P95), with one user, measured in the browser on a PC against the deployed server. | non-functional | Must | CTX-037 | Inferred | active |
| REQ-071 | The system shall draw the diagrams of a snapshot of up to 1 MB within 10 seconds at P95 of the push answer, with one push at a time, measured on the deployed server. | non-functional | Should | CTX-037 | Inferred | active |
| REQ-072 | The system shall work in the latest two versions of Chrome, Edge and Safari on a PC, and of Chrome and Safari on a phone, checked by a browser walk of the first release. | non-functional | Must | none | Inferred | active |
| REQ-073 | The system shall use IBM Carbon components with 8px corners on controls, 16px corners on panels and pill-shaped tags. | non-functional | Must | none | Brief 2026-11-21; redesign decision on design | active |
| REQ-074 | The system shall meet WCAG 2.2 level AA for contrast and keyboard use on the to-do, diagram, comment and confirmation screens, checked with an automated accessibility check and a keyboard walk. | non-functional | Should | none | Inferred | active |
| REQ-075 | Where themes are included, the system shall offer a light and a dark theme that follow the device setting. | non-functional | Should | none | Inferred | active |
| REQ-076 | The system shall back up its data daily and keep each backup for 30 days. | non-functional | Must | none | Inferred | active |
| REQ-077 | If a snapshot file holds text that looks like a secret or an email address, then the system shall refuse that file, naming it in the push answer. | non-functional | Should | CTX-037 | Inferred; the public-repository rules | active |
| REQ-078 | The system shall store agent credentials only as digests. | non-functional | Must | CTX-043 | CTX-043 rule | active |
| REQ-079 | While the owner uses a phone, the system shall let the owner add comments and replies. | functional | Must | none | Redesign decision on mobile | active |
| REQ-080 | The system shall keep, for each release, the record of a restore from backup rehearsed before it. | non-functional | Should | none | Inferred | active |

## 3. Stage-01 hotspots settled here

| Stage-01 hotspot | Answer | Requirements |
| --- | --- | --- |
| 3. Comments of an element that leaves the document | Move them to the diagram's comments, marked as from a removed element | REQ-033 |
| 4. The current corthex-hub commands | Accept them as they are | REQ-018 |
| 5. Confirming on a phone | No: view and comment only | REQ-068 |
| 6. One pull request per direct edit, or several together | Several together, per diagram | REQ-032 |
| 7. Where the layout is kept | In NEXUS (stage 05 shows its table) | REQ-015 |
| 8. Moving the running NEXUS's records to v3 | No; they stay in the archive tag and the Git records | REQ-019 |
| 9. A confirmation and a stage checkpoint | A stage passes its checkpoint once every diagram and item table of it has a recorded confirmation; on the stage-01 board the step confirmations at steps 1-b, 7 and 9 do | REQ-042, REQ-043 |
| 12, 13. Rules and command rows approved as drawn | Carried into the requirements above as written | REQ-001 to REQ-066 |
| 14. A comment thread after a rejected proposal | It stays open until the owner closes it | REQ-024, REQ-034 |

## 4. Conflicts, duplicates and open questions

- No two requirements contradict each other. REQ-026 (rename and connect, Must) and REQ-046 (free canvas in a workshop, Should) both edit diagrams; the first release has only the first.
- REQ-043 depends on the workshop (Should); until then stage 01's checkpoint is the confirmation of the DDD board drawn from the document (REQ-042).
- Open for the workshop release, from the review of pull request 96: how the owner ends an open workshop without finishing it, which no requirement covers yet, and how REQ-042 reads for stage 01 while a workshop is open, since REQ-043 then passes it by step confirmations. Both are settled when the workshop is planned.
- REQ-061, REQ-070 to REQ-072, REQ-074 to REQ-077 and REQ-080 are inferred targets with no source in the maintainer's words; they need the version freeze to keep them.
- Every requirement has a priority.

## 5. What might be missing

Checked against two independent lists: OWASP ASVS level 1 (authentication, session, access control, data protection, logging) and WCAG 2.2 level AA. Covered: authentication (REQ-062, REQ-066), agent credentials (REQ-064, REQ-065, REQ-078), access control for human-only acts (REQ-017, REQ-025, REQ-036), data protection (REQ-077), accessibility (REQ-074). Not covered, left for stage 04's exceptions: logging of refused requests and session expiry of the sign-in gate, which the gate provides today. Stage 04 logs refused requests in its rule 8 and leaves session expiry to the gate.

## 6. Checkpoint

The scope freeze and the version freeze were asked together on 2026-11-23, with one question for each stage-01 hotspot settled here. The maintainer approved every recommendation through the delegate they named for checkpoints; the answer is in the project's records.

- Scope freeze: the first release is the Must requirements; the Should and Could requirements wait.
- Version freeze: the wording of the eighty requirements, inferred targets included. A change goes through the feature-change procedure.
- Stage-01 hotspots 3 to 9 and 14: answered as in section 3.
- Approved items that this stage removes, defers or changes: none. The first release leaves out the workshop and the other Should and Could items, which the scope freeze approved.
- Deleting the data of the running v2 server is not part of this checkpoint and will be asked on its own when v3 replaces v2.
- Review corrections: after the review of pull request 96, section 4 gained the open question for the workshop release and section 5 names where the logging went. They passed their own checkpoint on 2026-11-23; no requirement changed.
