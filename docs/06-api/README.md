# NEXUS v3: API contract

[한국어](README.ko.md)

Status: passed on 2026-11-23; the contract is frozen for the first release.

Source: [api/openapi.yaml](../../api/openapi.yaml), OpenAPI 3.1. Inputs: the functional spec ([spec.md](../04-functional-spec/spec.md)) and the schema ([nexus.sql](../../db/nexus.sql)), both passed on 2026-11-23; no sitemap yet (stage 07). The pinned hub's wire (corthex-hub 0.4.0 and 0.5.0) was read from its code.

## 1. Operations

Two families share one error shape. The agent family (20 operations) takes the pinned hub's commands in their format; the owner family (32) serves the pages. An agent credential on an owner path gets owner_only, the owner's sign-in on an agent path agent_only.

### Agent family

| ID | Operation | What it does | Release | Spec |
| --- | --- | --- | --- | --- |
| API-242 | `POST /api/snapshots` | Accept a snapshot | Must | SPEC-001, SPEC-002, SPEC-003, SPEC-004, SPEC-014, SPEC-025, SPEC-027, SPEC-033 |
| API-243 | `GET /api/snapshots/{project}/held` | Read the held commit | Must | SPEC-001, SPEC-002, SPEC-014 |
| API-244 | `GET /api/spaces/{project}/data` | Read what deleting the space removes | Must | SPEC-013, SPEC-014 |
| API-245 | `GET /api/spaces/{project}/todo` | Give the agent its to-do | Must | SPEC-014, SPEC-026, SPEC-031, SPEC-043 |
| API-246 | `GET /api/spaces/{project}/comments/{comment}` | Read a comment thread | Must | SPEC-014, SPEC-016 |
| API-247 | `GET /api/spaces/{project}/proposals/{proposal}` | Read a change set | Must | SPEC-014, SPEC-018 |
| API-248 | `GET /api/spaces/{project}/edits/{edit}` | Read a reflection entry | Must | SPEC-014, SPEC-024, SPEC-026 |
| API-249 | `GET /api/spaces/{project}/checkpoints/{checkpoint}` | Read a confirmation to record | Must | SPEC-014, SPEC-031 |
| API-250 | `POST /api/spaces/{project}/claims/{entry}` | Claim a to-do entry | Must | SPEC-014, SPEC-044, SPEC-045 |
| API-251 | `DELETE /api/spaces/{project}/claims/{entry}` | Release a claim | Must | SPEC-014, SPEC-045 |
| API-252 | `POST /api/spaces/{project}/comments` | Comment as an agent | Must | SPEC-014, SPEC-016 |
| API-253 | `POST /api/spaces/{project}/comments/{comment}/replies` | Reply as an agent | Must | SPEC-014, SPEC-017 |
| API-254 | `POST /api/spaces/{project}/comments/{comment}/answered` | Mark a comment answered | Must | SPEC-014, SPEC-017 |
| API-255 | `POST /api/spaces/{project}/comments/{comment}/decisions` | Report where a decision is recorded | Must | SPEC-014, SPEC-017 |
| API-256 | `POST /api/spaces/{project}/proposals` | Post an AI proposal | Must | SPEC-014, SPEC-018 |
| API-257 | `POST /api/spaces/{project}/proposals/{proposal}/withdraw` | Withdraw a proposal | Must | SPEC-014, SPEC-018 |
| API-258 | `POST /api/spaces/{project}/edits/{edit}/report` | Report a reflection | Must | SPEC-014, SPEC-023, SPEC-024, SPEC-025, SPEC-045 |
| API-259 | `POST /api/spaces/{project}/checkpoints/{checkpoint}/report` | Report a confirmation record | Must | SPEC-014, SPEC-032 |
| API-260 | `POST /api/spaces/{project}/workshop/steps/{step}/draft` | Draw a step draft | Should | SPEC-037, SPEC-038 |
| API-261 | `POST /api/spaces/{project}/workshop/steps/{step}/report` | Report a step written | Should | SPEC-039, SPEC-040 |

### Owner family

| ID | Operation | What it does | Release | Spec |
| --- | --- | --- | --- | --- |
| API-262 | `GET /api/projects` | List the projects | Must | SPEC-015, SPEC-042, SPEC-048 |
| API-263 | `GET /api/todo` | Open on the owner's to-do | Must | SPEC-042, SPEC-048 |
| API-264 | `GET /api/projects/{project}` | Read a project | Must | SPEC-035, SPEC-046 |
| API-265 | `GET /api/projects/{project}/diagrams/{diagram}` | Read a diagram | Must | SPEC-003, SPEC-004, SPEC-005, SPEC-006, SPEC-007, SPEC-008, SPEC-009, SPEC-010, SPEC-011, SPEC-012, SPEC-022, SPEC-027, SPEC-034, SPEC-051 |
| API-266 | `GET /api/projects/{project}/threads/{thread}` | Read a thread | Must | SPEC-016, SPEC-017 |
| API-267 | `POST /api/projects/{project}/diagrams/{diagram}/threads` | Comment as the owner | Must | SPEC-016, SPEC-051 |
| API-268 | `POST /api/projects/{project}/threads/{thread}/comments` | Reply as the owner | Must | SPEC-017, SPEC-051 |
| API-269 | `POST /api/projects/{project}/threads/{thread}/close` | Close a thread | Must | SPEC-028 |
| API-270 | `POST /api/projects/{project}/change-sets/{change_set}/accept` | Accept an AI proposal | Must | SPEC-019 |
| API-271 | `POST /api/projects/{project}/change-sets/{change_set}/reject` | Reject an AI proposal | Must | SPEC-020 |
| API-272 | `POST /api/projects/{project}/diagrams/{diagram}/direct-edits` | Rename or connect directly | Must | SPEC-021 |
| API-273 | `POST /api/projects/{project}/change-sets/{change_set}/cancel` | Cancel a direct edit | Must | SPEC-023 |
| API-274 | `POST /api/projects/{project}/diagrams/{diagram}/positions` | Move an element | Must | SPEC-012 |
| API-275 | `POST /api/projects/{project}/diagrams/{diagram}/confirmation` | Confirm a diagram | Must | SPEC-029, SPEC-031 |
| API-276 | `POST /api/projects/{project}/confirmations/{confirmation}/cancel` | Cancel a confirmation | Must | SPEC-030, SPEC-031 |
| API-277 | `GET /api/projects/{project}/removal` | Show what deleting removes | Must | SPEC-013 |
| API-278 | `POST /api/projects/{project}/removal` | Delete a project space | Must | SPEC-013 |
| API-279 | `GET /api/credentials` | List agent credentials | Must | SPEC-049, SPEC-050 |
| API-280 | `POST /api/credentials` | Issue an agent credential | Must | SPEC-049 |
| API-281 | `POST /api/credentials/{credential}/revoke` | Revoke an agent credential | Must | SPEC-050 |
| API-282 | `POST /api/projects/{project}/tool-links` | Link a Notion page or a Jira project | Should | SPEC-046 |
| API-283 | `DELETE /api/projects/{project}/tool-links/{link}` | Remove a tool link | Should | SPEC-047 |
| API-284 | `POST /api/projects/{project}/workshop` | Open a workshop | Should | SPEC-036 |
| API-285 | `GET /api/projects/{project}/workshop` | Read the workshop | Should | SPEC-036, SPEC-038 |
| API-286 | `POST /api/projects/{project}/workshop/notes` | Add a sticky note | Should | SPEC-038 |
| API-287 | `PATCH /api/projects/{project}/workshop/notes/{note}` | Move or rename a sticky note | Should | SPEC-038 |
| API-288 | `DELETE /api/projects/{project}/workshop/notes/{note}` | Remove a sticky note | Should | SPEC-038 |
| API-289 | `POST /api/projects/{project}/workshop/links` | Connect two sticky notes | Should | SPEC-038 |
| API-290 | `DELETE /api/projects/{project}/workshop/links/{link}` | Remove a link between notes | Should | SPEC-038 |
| API-291 | `POST /api/projects/{project}/workshop/steps/{step}/confirm` | Confirm a step | Should | SPEC-039 |
| API-292 | `POST /api/projects/{project}/workshop/imports` | Import a Miro board | Could | SPEC-041 |
| API-293 | `GET /api/projects/{project}/diagrams/{diagram}/page` | Open a mockup page | Must | SPEC-009 |

## 2. Error codes

Every refusal is a Problem (title, status, detail, code, traceId) as application/problem+json. Each code's message and what the client does are in components.x-corthex.errors of the source.

| Code | Status | Meaning |
| --- | --- | --- |
| `invalid_request` | 400 | A header, a field or a value breaks the contract; field names it. |
| `invalid_snapshot` | 400 | A snapshot field breaks the hub's format; field names it. |
| `text_too_long` | 400 | A text is over its limit; field and limit name them. |
| `unsupported_format` | 400 | A snapshot schema NEXUS does not know; versions lists the ones it takes (SPEC-014). |
| `access_missing` | 401 | An agent path without a valid agent credential: none, an unknown client ID, a wrong secret or a revoked credential. One code for all four, so a caller learns nothing about which. |
| `unauthenticated` | 401 | An owner path without a valid sign-in from the gate, or with an expired one. |
| `agent_only` | 403 | The owner's sign-in on an agent path. |
| `cross_site` | 403 | A browser write whose Sec-Fetch-Site is neither same-origin nor none. |
| `not_owner` | 403 | A valid sign-in of someone other than the one owner (REQ-063). |
| `owner_only` | 403 | An agent credential on an owner action (rule 1). |
| `change_set_not_found` | 404 | No change set has that ID in this project. |
| `checkpoint_not_found` | 404 | No confirmation has that nk_ ID in this project. |
| `comment_not_found` | 404 | No comment thread has that nc_ ID in this project. |
| `confirmation_not_found` | 404 | No confirmation has that ID in this project. |
| `credential_not_found` | 404 | No agent credential has that ID. |
| `diagram_not_found` | 404 | No diagram has that ID, or the stage has nothing drawn yet. |
| `discrepancy_not_found` | 404 | NEXUS v3 has no discrepancies, so every nd_ ID is unknown. |
| `drawing_not_found` | 404 | The drawing the request names is not one of the diagram's. |
| `edit_not_found` | 404 | No reflection entry has that ne_ ID in this project. |
| `element_not_found` | 404 | The element is in neither the drawing shown nor the current one. |
| `entry_not_found` | 404 | The claim names no to-do entry: an unknown ID, an nd_ ID or another kind. |
| `item_not_found` | 404 | Trace IDs the stage's drawing does not hold; items lists them (SPEC-018). |
| `not_found` | 404 | A path that is no operation. Under /api/spaces the detail names the agent commands NEXUS takes (SPEC-014). |
| `note_link_not_found` | 404 | No link between sticky notes has that ID in the open workshop. |
| `note_not_found` | 404 | No sticky note has that ID in the open workshop. |
| `part_not_found` | 404 | The project has no part of that name. |
| `project_not_found` | 404 | No project space has that name, or it was deleted. |
| `proposal_not_found` | 404 | No change set has that np_ ID in this project. |
| `space_not_found` | 404 | The to-do of a project with no space; the pinned hub reads it as an empty to-do. |
| `step_not_found` | 404 | A step that is not one of event storming's steps. |
| `thread_not_found` | 404 | No comment thread has that ID in this project. |
| `tool_link_not_found` | 404 | No tool link has that ID in this project. |
| `workshop_not_found` | 404 | The project has no workshop. |
| `method_not_allowed` | 405 | A method the path does not take; the answer has Allow. |
| `change_set_state` | 409 | The change set's state does not allow the action, such as accepting a rejected proposal or cancelling a reflected edit; state names it. |
| `claimed` | 409 | Another session claims the entry (SPEC-044); session and last_write_at name the holder, ends_at when the claim ends, null while its pull request is open. |
| `commit_not_replaced` | 409 | The project holds a commit and the snapshot does not name it in replaces (REQ-002); held_commit names it, and the held diagrams stay as they were. |
| `confirmation_cancelled` | 409 | The record of a confirmation cancelled meanwhile (SPEC-032); the agent to-do now has recording the cancel. |
| `document_changed` | 409 | The request was made against a drawing that is no longer current (rule 4, SPEC-018, SPEC-019, SPEC-029); drawing and version name the current one. |
| `entry_closed` | 409 | The entry is done, withdrawn or waits on the owner. |
| `name_taken` | 409 | Another agent credential has this name (SPEC-049). |
| `not_drawn` | 409 | A confirmation of a diagram whose current drawing failed or that has none. |
| `note_made_by_owner` | 409 | An agent draft that would remove a note the owner made (REQ-047). |
| `older_snapshot` | 409 | The snapshot's commit is one of an earlier revision; revision names it. |
| `pull_request_mismatch` | 409 | The entry is linked to another pull request (SPEC-024); pull_request names it. |
| `pull_request_needed` | 409 | A report of reflected for an entry that names no pull request, in the body or before. |
| `repository_mismatch` | 409 | The snapshot or the pull request is of another repository than the project's (SPEC-024). |
| `request_key_reused` | 409 | An Idempotency-Key that an earlier request of another action took (rule 3). |
| `step_confirmed` | 409 | An agent draft for a confirmed step (SPEC-037). |
| `step_empty` | 409 | Confirming a step without notes (SPEC-039). |
| `steps_open` | 409 | A written report for a step before it is confirmed (SPEC-040); steps lists the open ones. |
| `thread_closed` | 409 | A reply to a closed thread (SPEC-017). |
| `waiting_reflection` | 409 | A confirmation while accepted change sets wait for reflection (SPEC-029); change_sets lists them. |
| `workshop_closed` | 409 | A change to the board when no workshop is open. |
| `workshop_open` | 409 | The project already has an open workshop (SPEC-036); workshop names it. |
| `body_too_large` | 413 | A request body over its limit, in bytes. |
| `snapshot_too_large` | 413 | A snapshot over 8 MiB (SPEC-001). |
| `json_required` | 415 | A body that is not application/json. |
| `internal` | 500 | An unexpected server error; traceId names it in the log. |

## 3. Choices this stage makes

- The agent family keeps every path, header and field of the pinned hub, and every answer field the hub reads, so the hub runs unchanged (SPEC-014). The hub's remove fallback (GET /api/snapshots/{project}/removal) and its v2 publication are not served: the hub calls the first only when /data is missing, and the second only with its publish-v2 command.
- Agent IDs keep the hub's forms: a thread is nc_, a change set np_, a reflection entry ne_ (one per diagram, holding all its waiting change sets, SPEC-026) and a confirmation nk_. NEXUS v3 has no discrepancies, so the to-do's discrepancies list is always empty and an nd_ ID is never found.
- The agent's credential is the pair the hub already sends, CF-Access-Client-Id and CF-Access-Client-Secret, issued by NEXUS (SPEC-049). A missing, unknown, wrong or revoked credential gets one code, access_missing (401), which the hub treats as worth retrying, so a queued write waits for a fixed credential instead of being dropped.
- Request keys are kept 7 days, not only the 24 hours that rule 3 requires, because the hub keeps an unsent write 7 days and sends it again under the same key.
- Every agent write on a to-do entry claims it for the session, and a write on an entry another session claims gets claimed; so a proposal answering a comment holds its claim (SPEC-018).
- A reflection's change sets are marked reflected only when NEXUS draws the snapshot of the merge commit that reflected names, or at once when it already holds one (SPEC-025). The server cannot read Git ancestry, so a snapshot of another commit marks nothing; when the push job never sends the merge commit, the agent reports reflected again with a commit NEXUS holds.
- The hub's reflect event needs-user is refused as invalid_request: no requirement gives NEXUS a meaning for it, and the agent asks the owner in the comment thread instead.
- An agent decision is an entry of the thread with its link; it is accepted on a closed thread too, since it records where the decision went rather than asking anything.
- NEXUS takes the snapshot formats corthex-hub/0.2 and corthex-hub/0.3. 0.3 adds the picture sources of stages 03, 08 and 09, one picture per file, each with key, the path of its source file. The held commit (API-243) lists the formats in formats, and a hub sends 0.3 only to a server that lists it; so the running v2, which refuses picture stages and formats it does not know, keeps taking 0.2 from the same hub. A project's first push, which reads no held commit, goes as 0.2.
- A mockup page (API-293) is the HTML the hub sent, served with Content-Security-Policy sandbox allow-scripts, no network (default-src 'none'; inline scripts and styles; images and fonts from data: only), frame-ancestors 'self' and X-Content-Type-Options nosniff. The diagram view opens it in an iframe with sandbox allow-scripts, so its scripts run but reach neither NEXUS nor its cookies. Fonts a page loads from the network do not load; how the app loads IBM Plex is decided in development.
- Validation errors are 400 everywhere, including text over its limit (text_too_long with field and limit); 413 is only for a body over its byte limit: 8 MiB for a snapshot, 5 MiB for a Miro export and 2 MiB for any other body, the size of the hub's largest queued write.
- A repeat that changes nothing succeeds with changed false; a path ID in a malformed form gets the 404 of what it names, never 400, as the hub expects.
- The pages that the hub links to stay at their addresses: /p/{project}/{part or _}/{stage} and /p/{project}#data. Stage 07 places them.

## 4. Coverage

51 of the 52 spec rows have an operation. Rows without one: SPEC-052 (a server job, not a request; its failure warning reaches the owner through getOwnerTodo).

API-265 serves the pictures of SPEC-006, SPEC-008 and SPEC-009 from the first release, by the feature change of 2026-11-23 (section 7), and API-293 serves a mockup page.

| Spec | Operations |
| --- | --- |
| SPEC-001 Accept a snapshot | API-242, API-243 |
| SPEC-002 Create a project space on the first send | API-242, API-243 |
| SPEC-003 Draw the DDD board | API-242, API-265 |
| SPEC-004 Draw the ERD | API-242, API-265 |
| SPEC-005 Show an item table | API-265 |
| SPEC-006 Draw user-flow diagrams | API-265 |
| SPEC-007 Draw the sitemap tree | API-265 |
| SPEC-008 Draw screen-state panels | API-265 |
| SPEC-009 Show mockups with their tokens | API-265, API-293 |
| SPEC-010 Show names, hide trace IDs | API-265 |
| SPEC-011 Copy an element | API-265 |
| SPEC-012 Move an element and keep its place | API-265, API-274 |
| SPEC-013 Delete a project space | API-244, API-277, API-278 |
| SPEC-014 Accept the pinned hub commands | API-242, API-243, API-244, API-245, API-246, API-247, API-248, API-249, API-250, API-251, API-252, API-253, API-254, API-255, API-256, API-257, API-258, API-259 |
| SPEC-015 Start with no v2 data | API-262 |
| SPEC-016 Add a comment | API-246, API-252, API-266, API-267 |
| SPEC-017 Reply in a thread | API-253, API-254, API-255, API-266, API-268 |
| SPEC-018 Post an AI proposal | API-247, API-256, API-257 |
| SPEC-019 Accept an AI proposal | API-270 |
| SPEC-020 Reject an AI proposal | API-271 |
| SPEC-021 Rename or connect directly | API-272 |
| SPEC-022 Show what waits for reflection | API-265 |
| SPEC-023 Cancel a direct edit | API-258, API-273 |
| SPEC-024 Link a reflection pull request | API-248, API-258 |
| SPEC-025 Mark changes reflected | API-242, API-258 |
| SPEC-026 Hand over a diagram's change sets together | API-245, API-248 |
| SPEC-027 Keep the comments of a removed element | API-242, API-265 |
| SPEC-028 Close a thread | API-269 |
| SPEC-029 Confirm a diagram or item table | API-275 |
| SPEC-030 Cancel a confirmation | API-276 |
| SPEC-031 Ask the agent to record a confirmation | API-245, API-249, API-275, API-276 |
| SPEC-032 Mark a confirmation recorded | API-259 |
| SPEC-033 Invalidate a confirmation when its document changes | API-242 |
| SPEC-034 Show what changed since the last confirmation | API-265 |
| SPEC-035 Pass a stage checkpoint | API-264 |
| SPEC-036 Open a workshop | API-284, API-285 |
| SPEC-037 Draw a step draft | API-260 |
| SPEC-038 Edit sticky notes | API-260, API-285, API-286, API-287, API-288, API-289, API-290 |
| SPEC-039 Confirm a step | API-261, API-291 |
| SPEC-040 Close the workshop | API-261 |
| SPEC-041 Import a Miro board | API-292 |
| SPEC-042 Open on the owner's to-do | API-262, API-263 |
| SPEC-043 Give agents their to-do | API-245 |
| SPEC-044 Claim a to-do | API-250 |
| SPEC-045 Release or keep a claim | API-250, API-251, API-258 |
| SPEC-046 Link a Notion page or a Jira project | API-264, API-282 |
| SPEC-047 Remove a tool link | API-283 |
| SPEC-048 Admit the owner | API-262, API-263 |
| SPEC-049 Issue an agent credential | API-279, API-280 |
| SPEC-050 Revoke an agent credential | API-279, API-281 |
| SPEC-051 Read and comment on a phone | API-265, API-267, API-268 |
| SPEC-052 Back up daily | — |

## 5. Breaking changes against the previous contract

The previous contract is the archived v2's. Nothing the pinned hub sends or reads changes; the feature change of 2026-11-23 adds the format corthex-hub/0.3 beside 0.2 and the field formats to the held commit, which the pinned hub does not read. Differences the hub does not see: some v2 codes are gone (clock_ahead, too_many_projects, write_id_reused, comment_limit and others) and v3 codes replace them (request_key_reused, thread_closed and others); discrepancies is always empty; no checkpoint_requested turns a request into a reply; /removal and the v2 publication are not served; the owner's sign-in cannot use agent paths; credentials are issued by NEXUS, not as the gate's service tokens. The owner family is new. Replacing the running v2 with v3 is decided at release, not here.

## 6. What this stage changes in approved items

Each was asked on its own at the checkpoint and approved as recommended. The stage-04 spec and the stage-05 schema carry the corrections, each under API corrections, in the same pull request.

- **SPEC-002 and SPEC-001, two checks the pinned hub makes before it sends.** SPEC-002 says: "No first-send confirmation in the snapshot → refused, nothing created, the answer says the owner must confirm the first send." The pinned hub's snapshot has no field for it: the hub holds back the first push of a project until the user's yes, given as push --first, and sends nothing different then. Likewise SPEC-001 refuses "a file over 1 MB", but the snapshot carries no files: the hub leaves such a file out and counts it. Recommended: NEXUS creates the space on a first send from a valid agent credential, the confirmation stays the hub's --first, the 1 MB file limit stays the hub's, and the two exceptions say so (REQ-003 is met by the hub's gate). The other way, the owner allowing each new project in NEXUS first, adds an owner action no requirement has.
- **Rule 3, request keys on every hub command.** Rule 3 says: "Every hub command and every owner action that writes carries a request key." The pinned hub sends no key with push, claim and release. Recommended: those three are repeated safely by commit and by session (the same commit answers its revision; the same session's claim is the same claim), and rule 3 names the hub's queued writes instead of every hub command.
- **SPEC-006, SPEC-008 and SPEC-009, pictures the snapshot cannot carry.** The pinned hub sends picture sources only for stages 01, 05 and 07, and items for every stage; it sends no user-flow Mermaid, screen states or mockup images. So user-flow diagrams (SPEC-006, Should), screen-state panels (SPEC-008, Could) and mockups with tokens (SPEC-009, Could) cannot be drawn from what the hub sends. Recommended: leave these pictures out of the first release, as their precondition allows; those stages show item tables (SPEC-005), and the rows stay active for a later hub. Changed by the feature change of 2026-11-23 (section 7).
- **The schema, three changes the hub's fields need.** The hub sends fields the stage-05 schema has no column for, and reports a merge without its commit. Recommended: (1) comments.detail, a JSON column for an entry's quote, asks, look_first and decision link; (2) change_sets.detail, a JSON column for a proposal's reason, change text, items, adds and proposed document; (3) pull_requests may be merged without merge_commit, which the hub sends only with reflected, never with merged, and a record's merge never needs. Each is asked on its own as a change to the passed schema.

## 7. Checkpoint

Passed on 2026-11-23. The maintainer approved every recommendation through the delegate they named for checkpoints; the answer is in the project's records.

### Feature change of 2026-11-23

The maintainer chose to draw user flows, screen states and mockups from the first release, with the hub sending their sources. Each approved item the change touches was asked on its own and approved through the delegate they named for checkpoints; the answers are in the project's records. Here: the snapshot format corthex-hub/0.3 with the sources of stages 03, 08 and 09 and a key per picture (Snapshot, PictureStage), the formats a server takes in the held commit (API-243), API-265 serving those pictures from the first release, and a new operation, API-293, that serves a mockup page in isolation (section 3). The 51 operations before it are otherwise unchanged. This stage's part of the change passed its own checkpoint on 2026-11-23 through the same delegate.
