# SCR-112 Picture stage

[한국어](SCR-112-picture-stage.ko.md)

Purpose: in a project's workspace the user looks at a stage that has a picture, the DDD board of 01, the ERD of 05 or the sitemap of 07: its head with its recorded state, last checkpoint, commit and counts; the picture, which fills the middle and shows where the view is in the whole; and the stage's items as a list; and from it opens an item, its talk or the stage record, where the user passes the checkpoint. (FL-118, FL-119)

Path `/p/{project}/{part}/{stage}` for `01-domain`, `05-erd` and `07-sitemap`, on the NEXUS server only (API-154), in the middle of the workspace (SCR-111). Who can see it: anyone Cloudflare Access lets in. Planned in the redesign of 2026-11-06 (SPEC-147, SPEC-156, with SPEC-119 and SPEC-141). It takes in the stage detail (SCR-104), the picture view (SCR-105) and the stage overview (SCR-109), whose addresses lead here (SPEC-154). What the design revision of 2026-11-11 plans on this screen is in [its last section](#the-design-revision-of-2026-11-11), with a status on each row; until a task builds a row, the sections before it tell the screen as it is. The rules of [every screen](README.md#every-screen) apply, with those of [the redesign](README.md#the-redesigns-screens).

## Data

| Data | Source |
| --- | --- |
| The head: the stage's number and name, its recorded state, its last checkpoint and its date, the commit that the stage shows and its time, which is the picture's document version (REQ-139), and its counts: contexts, terms and open hotspots for 01, tables for 05 and screens for 07 (REQ-226) | API-158 (`head`), first from the page's data |
| The stage record: the recorded state, next action, checkpoints, checks and findings, and a checkpoint passed in NEXUS that waits for its record (SPEC-138) | API-158 (`record`) |
| The picture's source, its document version, the commit and the commit's time, when it was drawn, and whether it is current, with why | API-111 (`picture`), first from the page's data |
| The marks: on each item the counts of its open comments, proposals and discrepancies, and "Accepted, not yet reflected" on the items of an accepted proposal (SPEC-131) | API-111 (`comments`, `proposals`, `reflections`, `discrepancies`) |
| A DDD board's timeline, its lanes with their events in order, and its step | API-111 (`picture.source.timeline`), and the address after `#`, `step=` (SPEC-141) |
| The view: its zoom, where it is in the whole picture, and "Go to"'s list, the picture's contexts, tables or screens by ID and name | The picture's source, kept in the page while it is open |
| The picture or the list | The address after `#`: `view=list` for the list (SCR-113's list), else the picture |

## Actions

| Action | Result | Failure |
| --- | --- | --- |
| Select an item, or open an address with `#item=` | The item beside the stage, SCR-115, and the talk narrowed to it (SPEC-150); under 1,024 pixels the Item tab | An ID that the stage does not hold: SCR-115#gone |
| Select a mark | The talk at the item's comments, narrowed to it (SCR-114) | none |
| Move or zoom the picture | Two fingers or the wheel move the picture inside its frame, and the page does not scroll; Ctrl or ⌘ with the wheel, a pinch or the zoom buttons size it, from 100 per cent when it opens; Fit shows it whole. While the picture is larger than the view, the map in a corner shows the whole picture with a frame where the view is; dragging the frame or tapping the map moves the view (SPEC-156) | none |
| Go to, then a context, a table or a screen | The picture centres it and fits it in the view (REQ-237) | none |
| Picture or List | The picture, or the stage's items as a list, as SCR-113 lists them, with `#view=list` in the address | SCR-113's own states |
| On a DDD board, Previous step, Next step or the list of steps | The board as it stood at that step, with `step=` in the address; the map shows the step's frame (SPEC-141, SPEC-156) | A board without a timeline: the notice in the control's place; a key that the board does not have: the whole board |
| Stage record | The record opens in the side in the talk's place, under 1,024 pixels as a sheet: the recorded state, next action, checkpoints, checks and findings, and "Pass the checkpoint" with its words box, up to 2,000 characters (SPEC-138, SPEC-139); Back to the talk returns | SCR-112#stale, SCR-112#error, SCR-112#permission |
| Pass, or Withdraw a checkpoint passed in NEXUS | The checkpoint passes, or is withdrawn, and the head and the record read again (SPEC-139) | As above, with the words kept |
| Edit | Switched off, marked "Phase ②": editing on a PC comes with phase ② (SPEC-134) | none |
| Show a newer version | The picture drawn again from the newer data | SCR-112#error |
| Load again | The page from the server, at the same address | SCR-111#error |

## States

| State | What the user sees and can do | From responses |
| --- | --- | --- |
| SCR-112#loading | The head from the page's data, and in the frame the server's first picture, its whole SVG with its labels, which the user can read and move at once; the marks, the map and the panels come when the small view module runs, and the editor after it, keeping the view where the user left it, with "The editor is loading. You can already read and move the picture." in the frame (the first picture decision of 2026-11-04). Before any code, the SVG and the items' links stay | API-154#200, API-104#200 |
| SCR-112#normal | The head: the stage's number and name, its state as a shape and a word, "Last checkpoint {date}" or "No checkpoint yet", "Commit {commit} · drawn {time}", its counts, Edit switched off with "Phase ②", and Stage record. Under it, the tools: Picture and List, the zoom buttons with the zoom, Fit and Go to; on a DDD board, the step control. The picture, read-only and laid out the same way each time (SPEC-119), with its marks; while it is larger than the view, the map in the lower right corner; the legend of the marks in the lower left | API-154#200, API-111#200, API-158#200, API-128#201 and API-129#200 with `changed: true` |
| SCR-112#large | As SCR-112#normal, with "This picture is large ({n} elements), so drawing it may take longer." above the frame; the map draws the frames only (SPEC-119, SPEC-156) | API-111#200 with more than 300 elements |
| SCR-112#empty | No picture in the frame: the message of `picture_not_found` for its `why`, not drawn yet, left out for its size, or its source in another repository, with List, which still lists the stage's items (SPEC-147); the head as in SCR-112#normal | API-154#200 with the problem `picture_not_found`, API-111#404 (`picture_not_found`) |
| SCR-112#stale | A picture that is not current: "This picture shows commit {commit}" and why, above the frame; the picture stays usable. A newer picture after a write or a reading again: "A newer version of this picture is on the server." with Show it, while the drawn picture stays. A discrepancy that waits for a current picture: its mark says "Waits for a current picture". A checkpoint passed in NEXUS that no record names: "Passed in NEXUS on {date}, waiting for its record" beside the recorded state in the head, and in the record with Withdraw; Pass then says "Pass again". Withdraw on a checkpoint recorded meanwhile, or withdrawn already: the message of `checkpoint_recorded`, or "This checkpoint was already withdrawn.", and the record reads again | API-111#200, API-158#200, API-129#409 (`checkpoint_recorded`), API-129#200 with `changed: false` |
| SCR-112#error | The page's request: SCR-111#error. Reading again: the code's message in a bar above the picture, which stays as drawn, or "Could not update. What you see may be out of date." with Try again, which a query value out of its form, `invalid_request`, gets too. Passing or withdrawing in the record: the message above the words box, with the words kept and Try again, which sends the same write ID: `invalid_request` by the field; `cross_site` with a link to the page at the server's own address; `part_not_found`, `space_not_found`, `checkpoint_not_found` and `project_not_found`, after which the record reads again; `write_id_reused`, whose Try again makes a new write ID; `text_too_long` by the box, and `body_too_large`; `json_required`, `internal` and `method_not_allowed`. No connection, no answer in 30 seconds, `429` or `503`: rule 8 | API-111#404 (`project_not_found`, `space_not_found`, `part_not_found`, `not_found`), API-111#default (`internal`, `method_not_allowed`), API-158#400 (`invalid_request`), API-158#404 (`project_not_found`, `space_not_found`, `part_not_found`, `not_found`), API-158#default (`internal`, `method_not_allowed`), API-128#400 (`invalid_request`), API-128#403 (`cross_site`), API-128#404 (`part_not_found`, `space_not_found`), API-128#409 (`write_id_reused`), API-128#413 (`text_too_long`, `body_too_large`), API-128#415 (`json_required`), API-128#default (`internal`, `method_not_allowed`), API-129#400 (`invalid_request`), API-129#403 (`cross_site`), API-129#404 (`checkpoint_not_found`, `project_not_found`), API-129#409 (`write_id_reused`), API-129#default (`internal`, `method_not_allowed`) |
| SCR-112#code-failed | The editor's code fails: "The editor could not load. The picture and item list remain available." in the frame; the SVG, moving and zooming, the map, the list and the panels stay. If the small view module fails too, the server's SVG and the items' links stay. A failed editor is never marked ready | API-104#403 (`access_missing`, `access_other_app`), API-104#404 (`not_found`), API-104#default (`internal`, `method_not_allowed`) |
| SCR-112#permission | Reading again: the code's message in the bar above the picture. Passing or withdrawing: "Only you can do this, signed in yourself." above the words box, with the words kept, since only a person's own sign-in passes or withdraws a checkpoint (SPEC-139); `access_missing` and `access_other_app` the same way. A sign-in that expired: [rule 7](README.md#every-screen), "Sign in again", with the words kept | API-111#403 and API-158#403 (`access_missing`, `access_other_app`), API-128#403 and API-129#403 (`user_only`, `access_missing`, `access_other_app`), an `opaqueredirect` reply or a `401` |

Every state of the stage applies, with two of the picture's own, large and code-failed, as on the picture view of 0.2. Phase ② adds editing on a PC and the workshop on a work board here (SPEC-134, SPEC-142), with their states.

## Kinds of cases

| Kind | What the user sees |
| --- | --- |
| Access | Access's own login page or refusal comes before the page; the Worker's `403` and a sign-in that expired: SCR-112#permission. Passing and withdrawing need a person's own sign-in: `user_only` |
| Input | The checkpoint's words, up to 2,000 characters, kept in their box and in the browser's storage until the server takes them (rule 5); empty words are left out and the checkpoint passes without them (SPEC-139) |
| Target | A part or a project that the server does not hold: SCR-111#error. A project without a space: the message of `space_not_found` in the picture's place, as SCR-111's Target says. No picture: SCR-112#empty. An address whose item the stage does not hold: SCR-115#gone. A step key that the board does not have: the whole board |
| State changes | A picture that is not current, a newer picture, a discrepancy that waits, a checkpoint that waits for its record or was recorded meanwhile: SCR-112#stale |
| Repeats | Pass, Withdraw, Show it and Load again are disabled while they run; Pass again after a lost reply sends the same write ID (SPEC-126) |
| Concurrency | Another tab's or the agent's writes show when the view reads again (rule 6) or after Load again; a newer picture is offered, not drawn under the user |
| Limits | More than 300 elements: SCR-112#large. The marks count 500 of each kind and 1,000 discrepancies, with their totals; Go to lists every context, table or screen of the picture |
| Outside services | None: the view loads its code, styles and fonts only from the server (REQ-147) and sends its requests only to it |
| Data exposure | Only the picture, its marks and the stage record; a proposal's stage source text only in the talk (SCR-114); no identity but "User" or "Agent" (rule 11) |
| Empty and streamed answers | No picture: SCR-112#empty. A picture without entries shows no marks. No stream |
| Screen states | Every state at 390 and 1440 pixels in both themes, in [redesign.html](../../09-mockup/nexus/redesign.html#scr-112) |
| AI answers | None: NEXUS calls no AI model (REQ-121) |

## Layout

| Region | Under 1,024 pixels, drawn at 390 | From 1,024 pixels, drawn at 1,440 |
| --- | --- | --- |
| The head | Under the tabs: the state, the last checkpoint and the commit on one line that wraps, the counts on a second line, and Stage record; Edit is not shown, since editing is for a PC | Two lines, as stage 09 draws them: the number and name, the state, and the counts with Edit at the right end; under them the last checkpoint and the commit. Until TASK-275 draws the picture, the stage shows SCR-113's list with SCR-113's head |
| The tools | Picture and List, then Fit and Go to; the zoom buttons over the picture's lower right corner, 44 pixels each | One line under the head: Picture and List, the zoom buttons with the zoom, Fit and Go to, and Stage record at its right end |
| The step control, on a DDD board | Above the frame, across the width: Previous step and Next step, 44 pixels each, with the list of steps between them | Left of the tools' end, on the same line |
| The picture | Its frame takes the rest of the height, so the page does not scroll; the map, 120 pixels wide, in the lower right corner above the zoom buttons | Its frame takes the middle under the tools; the map, 188 pixels wide, in the lower right corner, and the legend in the lower left |
| The notices | Each a bar above the frame, across the width | The same |
| The stage record | A sheet of up to 85 per cent of the height | In the side, 400 pixels wide, in the talk's place |

## The design revision of 2026-11-11

What the design revision of 2026-11-11 adds to this screen or changes on it, planned and not built: its checkpoint passed on 2026-11-12 ([the review's map](../../reviews/2026-11-11-design-review.md), findings 3, 12, 25 and 32). The sections above tell the stage as the redesign's checkpoint 3 passed it; TASK-275 builds it with the rows of this section, now that the revision's checkpoint has passed, and moves them into the sections above. The rows that said `open (D17)` are `planned`: the maintainer decided D17 on 2026-11-12 as recommended. The words are in [revision-words.md](revision-words.md), and the rules are those of [the design revision](README.md#the-design-revisions-screens).

### Data of the revision

| Data | Source | Status |
| --- | --- | --- |
| The stage's open checkpoint request, for the record: the open comment on the stage as a whole that asks for the checkpoint, with the whole text of its last entry, the place of that entry and the thing to look at first, `look_first`; and what is left in the stage, the counts of its open discrepancies, its other open comments and its pending reflections (SPEC-139, SPEC-197) | API-152, from the talk's my turn, which the page holds; the counts from API-158 (`record`), with the request itself left out of the open comments | planned |
| What a pass names: the commit of the project's snapshot, which the workspace's head shows (SCR-111) and which is the commit of the stage's head while the picture is current, or, where the snapshot names none, the snapshot's `revision`; and, for a request, its comment and the place of its last entry (SPEC-194) | API-158 (`project`), API-152 | planned |
| In the record, for each checkpoint passed in NEXUS: what was approved, its `commit` or `revision`, and for a request its `comment` and `entry`; and the kind of browser and device, `browser`, `device` and `driven`, all null for a checkpoint passed before the revision (SPEC-195) | API-158 (`record`) | planned |
| The item that an entry of the talk selects | The entry's item (SCR-114), and the picture's source for where the item is drawn | planned |

### Actions of the revision

| Action | Result | Failure | Status |
| --- | --- | --- | --- |
| Edit | Goes: the head shows no "Edit" control and no "Phase ②" mark, since a control that cannot be used is not shown ([rule 23](README.md#the-design-revisions-screens), SPEC-147). The head's right end stays the control's place, and the tools' place after List stays the work board's view's, both for the release that includes editing (stage 07, [choice 18](../../07-sitemap/nexus.md#choices-this-stage-made)): until then nothing stands there, no room is left empty for them, and an address with `view=edit` or `view=board` shows the picture | none | planned |
| Pick an entry of the talk that is on an item | The item is selected in the picture ([rule 24](README.md#the-design-revisions-screens), SPEC-209): the view moves so that the item is in sight, keeping its zoom unless the item does not fit at that zoom, where it zooms out until the item fits; an outline marks the item, not colour alone; the item's panel opens with its talk narrowed to it and the picked entry open (SCR-115); and the address gains `item={id}` beside the entry's `talk=` (SCR-114), so that the browser's back button returns to the stage's whole talk at that entry. On a DDD board whose step view does not hold the item, the view goes to the step that holds it, or to the whole board. An entry on a discrepancy selects its first item | The stage no longer holds the item: nothing is selected, and the entry says so with the item's ID (SCR-114). The picture is not current or not drawn: the item's row in the list is selected instead, at `#view=list&item={id}`, and the item's panel says why the picture does not show it | planned |
| Stage record, while the stage has an open checkpoint request | Above the words box, the request whole: the whole text of its last entry, "Look at first" as a link, "Commit {commit}", the commit of the project's snapshot, which the pass names, and what is left in the stage. Where the picture is not current, the bar above it keeps saying which commit the picture shows (SCR-112#stale). The pass's button says "Pass the stage {n} checkpoint", and the pass names the commit or the revision and the request's comment and last entry, and settles the request's comment with the user's reply, which holds the user's words or, without them, the button's (API-128, SPEC-194, SPEC-196). A request stored without the form shows as it is, and the record passes with it. Without an open request the record is as now, and its pass names the commit or the revision alone | SCR-112#stale, SCR-112#error or SCR-112#permission, with the words kept | planned |
| In the record, a checkpoint passed in NEXUS | Beside who passed it and when: "Commit {commit}"; the request that it answered, as a link to it in the talk; and the kind of browser and device, such as "Safari, phone", with "Software drove the browser" where the page reported that. A checkpoint passed before the revision shows none of these, and does not say "unknown browser" or "unknown device" (SPEC-195) | none | planned |

### States of the revision

| State | What the revision adds or changes | From responses | Status |
| --- | --- | --- | --- |
| SCR-112#normal | The head without Edit and its mark; the counts reach the head's right end. An item that the talk selected is in sight and marked by an outline, with its panel beside the picture. In the record, the stage's open request whole above the pass, the pass named for the stage, and what each checkpoint passed in NEXUS recorded | API-158#200, API-152#200, API-128#201 | planned |
| SCR-112#stale | A pass refused because what the page showed has changed, above the words box, with the words kept and nothing recorded. `snapshot_changed`, "The project now shows another commit: {commit}. Look again before you pass.": the page shows SCR-111#stale's bar with Load again, since the picture is still the older commit's, and the refusal has a Load again of its own, since under 1,024 pixels the record's sheet covers the bar; the pass stays off until the page is loaded again, after which it names the commit that the workspace's head then shows; the words come back from the browser's storage (rule 5). `request_changed`, "The checkpoint request changed. Read it again before you pass.", or, for a pass that named no request, "This stage now has a checkpoint request. Read it before you pass.": the talk and the record read again and show the request as it is now, and the pass names it | API-128#409 (`snapshot_changed`, `request_changed`) | planned |
| SCR-112#error | A pass that fails for its request, above the words box, with the words kept: `comment_not_found`, after which the talk and the record read again; `reply_limit`, whose message says that the comment is full, where the user marks the request answered in the talk and passes without it; `space_full`; and `invalid_request` for a pass that names no commit, as from a page loaded before the release, with Load again | API-128#400 (`invalid_request`), API-128#404 (`comment_not_found`), API-128#409 (`reply_limit`, `space_full`) | planned |

The revision adds no state. A reading again that sends a query value out of its form is an error like any reading that fails, which SCR-112#error now names (API-158#400).

### Kinds of cases of the revision

| Kind | What the revision adds |
| --- | --- |
| Target | An item that the talk selects and the stage no longer holds: nothing is selected, and the entry says so. An item whose picture is not current or not drawn: its row in the list is selected instead |
| State changes | A push, or the agent's newer request, between the page's drawing and the pass: SCR-112#stale |
| Repeats | A pass sent again with its write ID leaves one checkpoint and gets its first answer, even when the commit changed in between (SPEC-194) |
| Data exposure | The record shows the kind of browser and device in a fixed vocabulary, never the text that the browser sent or a network address (SPEC-195); the address to look at first opens only when the user presses it, in a new tab without a referrer |
| Screen states | The changed head, the item that the talk selects and the record with a request in grey at 390 and 1,440 pixels, in [revision-wireframes.html](revision-wireframes.html#scr-112); the column's four views, the picture, the list, the editor and the work board, in grey at 1,280 and 1,440 pixels, in [picture-stage-views.html](../../09-mockup/nexus/picture-stage-views.html) (stage 07, choice 18); and the revision's states in the redesign's look in both themes, as stage 09 drew them after the revision's checkpoint, in [revision.html](../../09-mockup/nexus/revision.html#scr-112) |

### Layout of the revision

| Region | Under 1,024 pixels, drawn at 390 | From 1,024 pixels, drawn at 1,440 |
| --- | --- | --- |
| The head | As above, where Edit was not shown | The counts reach the right end of the first line, where Edit stood |
| The tools | As above; with the list, Picture and List alone, since Fit, Go to and the zoom buttons are the picture's | One line under the head, which wraps where its parts do not fit: Picture and List, then the tools of the view that shows, the zoom buttons with the zoom, Fit and Go to with the picture and none with the list, and Stage record at its right end ([the four views](../../09-mockup/nexus/picture-stage-views.html)) |
| The step control, on a DDD board | As above, with the picture only | A line of its own under the tools, with the picture only, as [redesign.html](../../09-mockup/nexus/redesign.html#scr-112) draws it in SCR-112#large. The cell above that puts it on the tools' line gives way: in the redesign's look the two need 816 pixels on one line, and at 1,440 pixels beside both columns the line has 752 |
| The item that the talk selected | The Item tab appears and the Talk tab stays in front; the picture shows the item marked when the user opens its tab | The item in sight in the picture, an outline around it; its panel in the side |
| The record's request | In the sheet, above the words box: the text, then "Look at first", the commit and what is left, each on a line of its own | In the side, above the words box, the same |
| A passed checkpoint's record | Under the checkpoint's date: the commit, the request and the kind of browser and device, each on a line of its own | One line that wraps under the checkpoint's date |
