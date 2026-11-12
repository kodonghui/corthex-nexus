# SCR-111 Project workspace

[한국어](SCR-111-project-workspace.ko.md)

Purpose: the user opens a project and finds the way in it: the 13 stages of a part in a list with their states, the chosen stage in the middle with its picture or its items, and beside it the stage's talk or the selected item; on a phone, as tabs. (FL-117, FL-118)

Path `/p/{project}`, which leads to the project's current stage (API-153), and around every stage `/p/{project}/{part}/{stage}` (API-154), whose middle is SCR-112 or SCR-113 and whose side is SCR-114 or SCR-115. Who can see it: anyone Cloudflare Access lets in. Planned in the redesign of 2026-11-06 (SPEC-146, SPEC-155) and built by TASK-274, whose middle is SCR-113's list for every stage until TASK-275 draws the pictures; the talk and the item join with TASK-276 and TASK-277. What the design revision of 2026-11-11 plans on this screen is in [its last section](#the-design-revision-of-2026-11-11), with a status on each row; until a task builds a row, the sections before it tell the screen as it is. The rules of [every screen](README.md#every-screen) apply, with those of [the redesign](README.md#the-redesigns-screens).

## Data

| Data | Source |
| --- | --- |
| Where `/p/{project}` leads: the stage of the first part, in the order of the settings' `parts`, that its records name as current, or stage 01 when no stage is recorded (SPEC-146) | API-153, as a `302` |
| The page: the project, part and stage, and in `view-data` the answers of API-158 and API-152 for the stage, and of API-111 for a pictured stage | API-154 |
| The view's code: its core file, and the read-only editor of a pictured stage (SCR-112) | API-104 |
| The project's parts and, for the shown part, its 13 stages in six groups, each with its number, name, state, item count, whether it has a picture, whether that picture is current and how many of its entries are in my turn | API-158 (`stages`, with `not_current` since TASK-274), first from the page's data |
| The project's name, repository, the snapshot's commit and time | API-158 (`project`) |
| What is open beside the stage, and the list or the picture | The page's address after `#`: `talk=`, `item=`, `view=list`, `filter=left`, with which the first page's agent to-do opens the list filtered to what is left (SCR-110), and `step=` on a DDD board |
| The tab open under 1,024 pixels | The address's panel, else the stage |

## Actions

| Action | Result | Failure |
| --- | --- | --- |
| Pick a stage in the list, or in the sheet of stages under 1,024 pixels | That stage's page, SCR-112 or SCR-113, with its talk beside it; the address changes and the browser's back button returns | The stage's own states |
| Switch the part | The same stage of the other part, and the list of that part's stages | A part that the snapshot no longer holds: SCR-111#error |
| Open the talk under 1,280 pixels | From 1,024 pixels, "Talk ({n})" in the stage's head opens the talk as a panel, 400 pixels wide, over the stage's right edge; Close or Escape folds it again, and the focus returns to "Talk ({n})"; until TASK-276 builds the talk with its Close, the panel opens empty and Escape folds it. Under 1,024 pixels, the Talk tab | none |
| Select a tab under 1,024 pixels | The stage, its talk, or the selected item, one at a time; the tab stays when the phone turns (SPEC-155) | none |
| All projects, or NEXUS | SCR-110 | SCR-110's own states |
| Type in the search, or Full checks | SCR-116, or SCR-117 | Their own states |
| Load again | The page from the server, at the same address | SCR-111#error |

## States

| State | What the user sees and can do | From responses |
| --- | --- | --- |
| SCR-111#loading | The page as the server drew it, in the layout of SCR-111#normal: the top bar, the list of stages with their states and counts, and the stage's head; the middle and the side follow their screens' loading states (SCR-112#loading, SCR-113#loading, SCR-114#loading). The controls that write show disabled until the view's code runs ([rule 15](README.md#the-redesigns-screens)) | API-102#302, API-103#302, API-153#302, API-154#200, API-104#200 |
| SCR-111#normal | The top bar: NEXUS, the place, "All projects › {project} › {stage}", the search field and Full checks. On the left the project's name, its repository and commit, the part's switch when it has several parts, and the 13 stages in six groups, Discovery (01), Definition (02 to 04), Contracts (05 and 06), Screens (07 to 09), Building (10 to 12) and Presentation (13): each stage a row with its state as a shape and a word for screen readers, its number and name, a picture mark for 01, 05 and 07, its item count, and a count of the entries that wait for the user, the current stage marked by the accent's bar; under the list, the legend of the shapes. In the middle the stage (SCR-112 or SCR-113); on the right its talk (SCR-114), or the selected item (SCR-115) with a way back to the talk | API-154#200, API-158#200 |
| SCR-111#unrecorded | A project without recorded progress: `/p/{project}` opens stage 01, every stage shows "?" but those its settings skip, which show "–", and above the list "No progress recorded yet. Ask your AI to record each stage with the corthex-hub skill." (REQ-103), as the hub page says | API-153#302 to stage 01, API-154#200, API-158#200 with no stage record |
| SCR-111#stale | Reading again finds a newer push than the page shows: "This project was pushed again at {time}. Load again to see it." in a bar under the top bar, with Load again, while the page shows what it drew. A stage whose picture is not current: its row's picture mark says "not current" to screen readers, and SCR-112#stale shows why | API-158#200, API-152#200 |
| SCR-111#error | The page's request: the message page of [rule 9](README.md#every-screen), with the code's message, the trace ID, Load again, and a link to all projects, `/`: `project_not_found`, "This project is not on the server."; `part_not_found`; `not_found` for a stage key outside the 13 or an unknown path; `internal` and `method_not_allowed`. Reading again: "Could not update. What you see may be out of date." with Try again (rule 6), which a query value out of its form, `invalid_request`, gets too. No connection, no answer in 30 seconds, `429` or `503`: rule 8 | API-102#404 and API-103#404 (`project_not_found`, `part_not_found`, `not_found`), API-102#default and API-103#default (`internal`, `method_not_allowed`), API-153#404 (`project_not_found`, `not_found`), API-153#default (`internal`, `method_not_allowed`), API-154#404 (`project_not_found`, `part_not_found`, `not_found`), API-154#default (`internal`, `method_not_allowed`), API-158#400 (`invalid_request`), API-158#404 (`project_not_found`, `part_not_found`, `not_found`), API-158#default (`internal`, `method_not_allowed`) |
| SCR-111#permission | The page's request: the message page with the code's message. Reading again: the code's message in the bar. A sign-in that expired: [rule 7](README.md#every-screen), with what the talk holds kept | API-102#403, API-103#403, API-153#403, API-154#403 and API-158#403 (`access_missing`, `access_other_app`), an `opaqueredirect` reply or a `401` |

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

## The design revision of 2026-11-11

What the design revision of 2026-11-11 adds to this screen or changes on it, planned and not built: its checkpoint passed on 2026-11-12 ([the review's map](../../reviews/2026-11-11-design-review.md), findings 1, 11 and 15). The sections above tell the workspace as it is built; a task that builds a row of this section moves it into them. The words are in [revision-words.md](revision-words.md), and the rules are those of [the design revision](README.md#the-design-revisions-screens).

### Data of the revision

| Data | Source | Status |
| --- | --- | --- |
| In the workspace's head, with the project's name and repository: when the server last stored the snapshot, `pushed_at`, with the first 7 characters of its commit or "No commit", in the place of the snapshot's own time; whether the project has a space, `space`; the agent's last read of its agent to-do, `read_at`, null before the first read; and since when the oldest entry waits unread, `unread_since`, for the mark of a long wait (SPEC-146, SPEC-188) | API-158 (`project`), first from the page's data | planned |
| The folds: whether the list of stages is folded, from 1,024 pixels, and whether the talk is folded or shown, from 1,280 pixels | The browser's storage, for the device and not for a project; as on a first visit while it holds none or cannot be read (SPEC-210): the list of stages shown, and the talk a column from 1,440 pixels and folded from 1,280 to 1,439 | planned |
| How many entries of the shown stage are in my turn, for the folded talk's button and for the Talk tab | API-158 (`stages`: `mine`), which the list of stages shows already | planned |
| Whether the project's data is open | The page's address after `#`: `data` (SCR-130) | planned |

### Actions of the revision

| Action | Result | Failure | Status |
| --- | --- | --- | --- |
| Project data, in the workspace's head | The project's data opens over the stage (SCR-130), and the address gains `data` | SCR-130's own states | planned |
| Fold the list of stages, or show it again, from 1,024 pixels | The list folds to a rail, and the stage takes the width that it leaves; the rail keeps a way to each stage and the control that shows the list again. The control is a button whose name says what it does and whose state a screen reader says, and the keyboard reaches it. The fold is kept in the browser | none; where the browser keeps no storage, the fold lasts for the visit | planned |
| Fold the talk, or show it again, from 1,280 pixels | The talk folds to "Talk ({n})" in the stage's head, and the stage takes the width that it leaves; pressing "Talk ({n})" shows the talk as a column again. What the user last did, fold or show, is kept in the browser and holds at every width from 1,280 pixels. On a first visit the talk is a column from 1,440 pixels and starts folded from 1,280 to 1,439: beside both columns the stage has 632 pixels at 1,280 and reaches the 776 of [choice 14](README.md#choices-this-stage-made) only at 1,424. From 1,024 to 1,279 pixels the talk stays the panel of [rule 16](README.md#the-redesigns-screens), which is folded whenever the page opens | none | planned |
| Select an item, or open an address with `#talk=` or `#item=`, while the talk is folded | The right column shows, with the item or the entry, for as long as that is open; closing it folds the column again, and the kept fold does not change (SPEC-209, SPEC-210) | none | planned |

### States of the revision

| State | What the revision adds or changes | From responses | Status |
| --- | --- | --- | --- |
| SCR-111#loading | The server draws the head's two times with how long ago, and the mark of a long wait, as they are when it serves the page ([rule 19](README.md#the-design-revisions-screens)). It draws the columns as on a first visit, the list of stages shown and the talk a column from 1,440 pixels and its button under that, and the code folds or shows what the browser keeps when it runs, as it draws the first page's cards again in a kept order (SCR-110) | API-154#200 | planned |
| SCR-111#normal | In the workspace's head, under the project's name and repository: the first 7 characters of the commit or "No commit", and "Pushed {time}"; "Read by the agent {time}", "Not read by the agent yet" or, for a project without a space, "No agent to-do yet", each time with how long ago; the mark of a long wait, with its line, as on SCR-110; and "Project data". At the head's end, the control that folds the list; in the talk's head, the one that folds the talk | API-158#200 | planned |
| SCR-111#folded | From 1,024 pixels, the list of stages folded to its rail, the talk folded to its button, or both, so that the stage takes the width that they leave; with both folded, a picture or a list has the window's width but for the rail. The rail: at its top the control that shows the list again and, while the mark of a long wait holds, the mark, which opens the project's data; then the 13 stages by number, each with the shape of its state, its name and state in words for screen readers, and a mark while entries of it wait for the user; the current stage carries the accent's bar, and each opens its stage. The folded talk: the button "Talk ({n})" in the stage's head, whose number is the stage's open entries as built, and which says "My turn {n}" too while entries of the stage wait for the user, as SPEC-210 asks; from 1,024 to 1,279 pixels the button of rule 16 says it too. Under 1,024 pixels the tabs show, whatever is folded, the Talk tab with "My turn {n}" in the same way (SPEC-155), and a wider window shows the folds as they were | none: the folds are the browser's | planned |

The revision adds one state of the workspace's own, folded. A reading again that sends a query value out of its form is an error like any reading that fails, which SCR-111#error now names (API-158#400).

### Kinds of cases of the revision

| Kind | What the revision adds |
| --- | --- |
| Target | A project without a space: the head says "No agent to-do yet" in the last read's place, and the project's data opens with every count 0 (SCR-130#empty) |
| State changes | The agent's read while the page is open shows in the head when the page reads again; how long ago is worked out again whenever the page comes back into view |
| Repeats | Folding what is folded, or showing what shows, changes nothing; the two controls answer at once and wait for no request |
| Limits | The rail holds the 13 stages of the shown part; a window made narrower than 1,024 pixels shows the tabs, and made wider again shows the folds as they were |
| Data exposure | The folds stay in the browser: the server keeps nothing of how the user looks at a page (REQ-118) |
| Screen states | The changed head and the folds in grey at 390 and 1,440 pixels, in [revision-wireframes.html](revision-wireframes.html#scr-111), and a picture stage at 1,280 and 1,440 pixels with its columns shown and folded, in [picture-stage-views.html](../../09-mockup/nexus/picture-stage-views.html); and in the redesign's look in both themes, with the folds at 1,152 and 1,280 pixels too, as stage 09 drew them after the revision's checkpoint, in [revision.html](../../09-mockup/nexus/revision.html#scr-111) |

### Layout of the revision

| Region | Under 1,024 pixels, drawn at 390 | From 1,024 to 1,279 pixels, drawn at 1,152 | From 1,280 pixels, drawn at 1,440 |
| --- | --- | --- | --- |
| The workspace's head | In the sheet of stages, above the part's switch: the project's name and repository, the two times on two lines, the mark with its line, and "Project data", 44 pixels high | At the top of the list's column, under the repository: the two times on two lines, the mark with its line, then "Project data"; the control that folds the list at the head's right end | The same |
| The list of stages, folded | The folds do not apply: the sheet of stages | A rail on the left, 56 pixels wide, each stage 44 pixels high | The same |
| The talk, folded | The folds do not apply: the Talk tab, with "My turn {n}" under "Talk {n}" inside the tab's 44 pixels while entries wait for the user | As rule 16: "Talk ({n})" in the stage's head, which opens the panel, with "My turn {n}" in the same button | "Talk ({n})" with "My turn {n}" in the stage's head, and no column: the stage reaches the right edge |
| The stage | Its tab, the whole width | Between the list or the rail and the right edge: 776 pixels at 1,024 beside the list, and 968 beside the rail | Between the list or the rail and the talk or the right edge: at 1,280 pixels, 632 with both columns, 824 with the list folded, 1,032 with the talk folded, as on a first visit, and 1,224 with both; at 1,440 pixels, 792 with both columns, as on a first visit, then 984, 1,192 and 1,384 |
