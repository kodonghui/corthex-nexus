# SCR-111 Project workspace

[한국어](SCR-111-project-workspace.ko.md)

Purpose: the user opens a project and finds the way in it: the 13 stages of a part in a list with their states, the chosen stage in the middle with its picture or its items, and beside it the stage's talk or the selected item; on a phone, as tabs. (FL-117, FL-118)

Path `/p/{project}`, which leads to the project's current stage (API-153), and around every stage `/p/{project}/{part}/{stage}` (API-154), whose middle is SCR-112 or SCR-113 and whose side is SCR-114 or SCR-115. Who can see it: anyone Cloudflare Access lets in. Planned in the redesign of 2026-11-06 (SPEC-146, SPEC-155). The rules of [every screen](README.md#every-screen) apply, with those of [the redesign](README.md#the-redesigns-screens).

## Data

| Data | Source |
| --- | --- |
| Where `/p/{project}` leads: the stage of the first part, in the order of the settings' `parts`, that its records name as current, or stage 01 when no stage is recorded (SPEC-146) | API-153, as a `302` |
| The page: the project, part and stage, and in `view-data` the answers of API-158 and API-152 for the stage, and of API-111 for a pictured stage | API-154 |
| The view's code: its core file, and the read-only editor of a pictured stage (SCR-112) | API-104 |
| The project's parts and, for the shown part, its 13 stages in six groups, each with its number, name, state, item count, whether it has a picture and how many of its entries are in my turn | API-158 (`stages`), first from the page's data |
| The project's name, repository, the snapshot's commit and time | API-158 (`project`) |
| What is open beside the stage, and the list or the picture | The page's address after `#`: `talk=`, `item=`, `view=list`, `filter=left`, with which the first page's agent to-do opens the list filtered to what is left (SCR-110), and `step=` on a DDD board |
| The tab open under 1,024 pixels | The address's panel, else the stage |

## Actions

| Action | Result | Failure |
| --- | --- | --- |
| Pick a stage in the list, or in the sheet of stages under 1,024 pixels | That stage's page, SCR-112 or SCR-113, with its talk beside it; the address changes and the browser's back button returns | The stage's own states |
| Switch the part | The same stage of the other part, and the list of that part's stages | A part that the snapshot no longer holds: SCR-111#error |
| Open the talk under 1,280 pixels | From 1,024 pixels, "Talk ({n})" in the stage's head opens the talk as a panel, 400 pixels wide, over the stage's right edge; Close or Escape folds it again. Under 1,024 pixels, the Talk tab | none |
| Select a tab under 1,024 pixels | The stage, its talk, or the selected item, one at a time; the tab stays when the phone turns (SPEC-155) | none |
| All projects, or NEXUS | SCR-110 | SCR-110's own states |
| Type in the search, or Full checks | SCR-116, or SCR-117 | Their own states |
| Load again | The page from the server, at the same address | SCR-111#error |

## States

| State | What the user sees and can do | From responses |
| --- | --- | --- |
| SCR-111#loading | The page as the server drew it, in the layout of SCR-111#normal: the top bar, the list of stages with their states and counts, and the stage's head; the middle and the side follow their screens' loading states (SCR-112#loading, SCR-113#loading, SCR-114#loading). The controls that write show disabled until the view's code runs ([rule 15](README.md#the-redesigns-screens)) | API-153#302, API-154#200, API-104#200 |
| SCR-111#normal | The top bar: NEXUS, the place, "All projects › {project} › {stage}", the search field and Full checks. On the left the project's name, its repository and commit, the part's switch when it has several parts, and the 13 stages in six groups, Discovery (01), Definition (02 to 04), Contracts (05 and 06), Screens (07 to 09), Building (10 to 12) and Presentation (13): each stage a row with its state as a shape and a word for screen readers, its number and name, a picture mark for 01, 05 and 07, its item count, and a count of the entries that wait for the user, the current stage marked by the accent's bar; under the list, the legend of the shapes. In the middle the stage (SCR-112 or SCR-113); on the right its talk (SCR-114), or the selected item (SCR-115) with a way back to the talk | API-154#200, API-158#200 |
| SCR-111#unrecorded | A project without recorded progress: `/p/{project}` opens stage 01, every stage shows "?" but those its settings skip, which show "–", and above the list "No progress recorded yet. Ask your AI to record each stage with the corthex-hub skill." (REQ-103), as the hub page says | API-153#302 to stage 01, API-154#200, API-158#200 with no stage record |
| SCR-111#stale | Reading again finds a newer push than the page shows: "This project was pushed again at {time}. Load again to see it." in a bar under the top bar, with Load again, while the page shows what it drew. A stage whose picture is not current: its row's picture mark says "not current" to screen readers, and SCR-112#stale shows why | API-158#200, API-152#200 |
| SCR-111#error | The page's request: the message page of [rule 9](README.md#every-screen), with the code's message, the trace ID, Load again, and a link to all projects, `/`: `project_not_found`, "This project is not on the server."; `part_not_found`; `not_found` for a stage key outside the 13 or an unknown path; `internal` and `method_not_allowed`. Reading again: "Could not update. What you see may be out of date." with Try again (rule 6). No connection, no answer in 30 seconds, `429` or `503`: rule 8 | API-153#404 (`project_not_found`, `not_found`), API-153#default (`internal`, `method_not_allowed`), API-154#404 (`project_not_found`, `part_not_found`, `not_found`), API-154#default (`internal`, `method_not_allowed`), API-158#404 (`project_not_found`, `part_not_found`, `not_found`), API-158#default (`internal`, `method_not_allowed`) |
| SCR-111#permission | The page's request: the message page with the code's message. Reading again: the code's message in the bar. A sign-in that expired: [rule 7](README.md#every-screen), with what the talk holds kept | API-153#403, API-154#403 and API-158#403 (`access_missing`, `access_other_app`), an `opaqueredirect` reply or a `401` |

Every state of the stage applies but empty, with one of the workspace's own, unrecorded. Does not apply:

- Empty: a project that the server holds always has a snapshot with its 13 stages; a stage without items is SCR-113#empty, and one without a picture SCR-112#empty.

## Kinds of cases

| Kind | What the user sees |
| --- | --- |
| Access | Access's own login page or refusal comes before the page; the Worker's `403` and a sign-in that expired: SCR-111#permission |
| Input | None of its own: the search is SCR-116's, the talk's box SCR-114's |
| Target | An unknown project, a part that the snapshot does not hold, or a stage key outside the 13: SCR-111#error, with a link to all projects (SPEC-146). A project without a space, pushed only by a hub of 0.1: the stage's head and list as API-158 gives them, and the message of `space_not_found` in the place of the talk and of the picture, since the page holds that problem (API-154#200, as stage 06's Page data says since TASK-265). An address of 0.2 leads here first (SPEC-154) |
| State changes | A newer push while the page is open: SCR-111#stale. A stage's state recorded meanwhile shows after Load again |
| Repeats | Picking the same stage again keeps the page; Load again is disabled while it runs |
| Concurrency | Another tab's or the agent's writes show in the counts when the page reads again (rule 6) |
| Limits | 13 stages in each part; counts over 999 show as `999+`; a project's parts as many as its settings name |
| Outside services | None: code, styles and fonts come only from the server (REQ-147) |
| Data exposure | The snapshot's stages and counts only; no identity but "User" or "Agent" (rule 11) |
| Empty and streamed answers | A project without recorded progress: SCR-111#unrecorded. No stream |
| Screen states | Every state at 390 and 1440 pixels in both themes, and SCR-111#normal at 1,152 pixels with the talk folded, in [redesign.html](../../09-mockup/nexus/redesign.html#scr-111) |
| AI answers | None: NEXUS calls no AI model (REQ-121) |

## Layout

| Region | Under 1,024 pixels, drawn at 390 | From 1,024 to 1,279 pixels, drawn at 1,152 | From 1,280 pixels, drawn at 1,440 |
| --- | --- | --- | --- |
| The top bar | Back to all projects, the stage's number and name, which opens the sheet of stages, and the search button | NEXUS, the place, the search field and Full checks | The same |
| The list of stages | A sheet that rises from the bottom, up to 85 per cent of the height, with the part's switch on top | A column on the left, 248 pixels wide | The same |
| The tabs | Under the top bar: the picture or the list, "Talk {n}", and the item while one is selected; a tab 44 pixels high | none | none |
| The stage | Its tab, the whole width | Between the list and the right edge | Between the list and the side |
| The talk and the item | Their tabs | A panel, 400 pixels wide, over the stage's right edge, opened by "Talk ({n})" in the stage's head | A column on the right, 400 pixels wide |
