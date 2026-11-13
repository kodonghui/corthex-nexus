# SCR-113 Document stage

[한국어](SCR-113-document-stage.ko.md)

Purpose: in a project's workspace the user looks at a stage without a picture, such as the requirements of 02 or the QA cases of 12: its head with its recorded state, last checkpoint, commit and counts, and its items as a list that the user narrows to what has talk, what waits for the user or what is left; selects an item to read it and talk about it; and passes the stage's checkpoint from its record. The same list is the List tab of a picture stage. (FL-118, FL-119)

Path `/p/{project}/{part}/{stage}` for the ten stages other than `01-domain`, `05-erd` and `07-sitemap`, and `#view=list` on those three, on the NEXUS server only (API-154), in the middle of the workspace (SCR-111). Who can see it: anyone Cloudflare Access lets in. Planned in the redesign of 2026-11-06 (SPEC-147, SPEC-148) and built by TASK-274; until TASK-275 draws the picture, a pictured stage shows this list, whose rows lead to `#view=list&item=`. It takes in the stage detail (SCR-104) and the stage overview (SCR-109), whose "what is left" becomes a filter. What the design revision of 2026-11-11 plans on this screen is in [its last section](#the-design-revision-of-2026-11-11), with a status on each row; until a task builds a row, the sections before it tell the screen as it is. The rules of [every screen](README.md#every-screen) apply, with those of [the redesign](README.md#the-redesigns-screens).

## Data

| Data | Source |
| --- | --- |
| The head: the stage's number and name, its recorded state, its last checkpoint and its date, the commit that the stage shows and its time, and its counts, such as requirements by priority for 02 or cases by result for 12 (REQ-226) | API-158 (`head`), first from the page's data |
| The stage record: the recorded state, next action, checkpoints, checks and findings, and a checkpoint passed in NEXUS that waits for its record (SPEC-138); since TASK-299, the kind of browser and device of each checkpoint passed in NEXUS that the record holds, and of the one that a recorded checkpoint names, as on SCR-112 (SPEC-195); and since TASK-300, the stage's open checkpoint request whole, with its thing to look at first, the commit of the project's snapshot and what is left in the stage, as on SCR-112 (SPEC-139, SPEC-197) | API-158 (`record`, `project`), and the talk's my turn (API-152) for the request |
| Whether the project reads the stage, and why not, from the state of its text source | API-158 (`head.reads`) |
| The items, 200 at a time: each with its ID, its title or sentence as the source has it, its main fields, such as a requirement's priority and status, the number of its comments, a mark when it is in my turn, and marks for its open discrepancies and pending reflections; grouped by context, with the items without a context last, or in the source's order (REQ-227) | API-158 (`items`, `after`, `group`), the first 200 from the page's data |
| The filter, all, with talk, my turn or what is left, and the words of the search within the stage | Kept in the page while it is open; sent as `filter` and `q` (API-158). An address with `#filter=left`, from the first page's agent to-do (SCR-110), opens the list with what is left, on a pictured stage too |

## Actions

| Action | Result | Failure |
| --- | --- | --- |
| Pick a filter: All, With talk, My turn, What is left | The list narrows to the items with comments, those with an entry that waits for the user, or those with an open discrepancy, comment or pending reflection, with how many it holds (REQ-176); the address's `#filter=` gives way to the pick | SCR-113#no-match, SCR-113#error |
| Search in this stage, from one character | Once the typing pauses for 250 milliseconds, the list narrows to the items whose ID or title holds every word, case-insensitive | SCR-113#no-match, SCR-113#error |
| Group by context, or In the source's order | The list grouped by the items' contexts, or in the order of the source | none |
| Scroll to the end of the list | The next 200 items, with "Loading more…" as the last row meanwhile | "Could not load more." with Try again as the last row |
| Select an item, or open an address with `#item=` | The item beside the stage, SCR-115, and the talk narrowed to it; the row shows as selected, and an item past the rows drawn reads the next 200 until its row is there, and comes into view | An ID that the stage does not hold: SCR-115#gone, with no row selected |
| Select an item's count of comments | The talk narrowed to the item (SCR-114); until TASK-276 builds the talk, the count is part of its row, which it selects | none |
| Stage record, Pass, Withdraw | As on SCR-112 (SPEC-138, SPEC-139). Back to the talk or Escape closes the record, and so does the backdrop of its sheet under 1,024 pixels, where the page behind it waits until it closes; the focus returns to the button that opened it | SCR-113#stale, SCR-113#error, SCR-113#permission |
| Load again | The page from the server, at the same address | SCR-111#error |

## States

| State | What the user sees and can do | From responses |
| --- | --- | --- |
| SCR-113#loading | The head and the first 200 items as the server drew them from the page's data, in the layout of SCR-113#normal, with the rows' links working; the filters, the search, the grouping and Stage record wait for the view's code, shown disabled ([rule 15](README.md#the-redesigns-screens)), and the times show in UTC until the code shows them in the browser's time zone in the same boxes. Loading more: "Loading more…" as the last row | API-154#200, API-104#200 |
| SCR-113#normal | The head: the stage's number and name, its state as a shape and a word, "Last checkpoint {date}" or "No checkpoint yet", "Commit {commit} · {time}", its counts, and Stage record. Under it the filters, each with its count, the search in this stage and the grouping. The list: each group's heading with its context's ID and name and its count; each item a row with its ID, its text as the source has it, in its own language, its main fields with their names in the page's language, its count of comments, and its marks: My turn, a discrepancy's and a pending reflection's, each with its word for screen readers; the selected row with the accent's bar. "{n} of {total}" at the end while more remain. While a filter, a search or a write reads the list again, "Updating…" shows over the list's top right corner, and the list stays usable (rule 6) | API-154#200, API-158#200, API-128#201 and API-129#200 with `changed: true` |
| SCR-113#empty | A stage that the project reads with no items yet: "This stage holds no items yet." in place of the list; the head, the record and the talk on the stage as a whole stay | API-158#200 with no items |
| SCR-113#not-read | A stage that the project does not read: the head says why, from the state of its text source, and in place of the list "This project does not read this stage: {why}. You can still pass its checkpoint.", with Stage record (SPEC-147, SPEC-148) | API-158#200 with `head.reads` false |
| SCR-113#no-match | A filter or a search that matches nothing: "Nothing waits for you in this stage.", "Nothing is left in this stage.", "No item of this stage has talk yet." or "Nothing in this stage matches “{q}”.", with Show all, which clears the filter and the search | API-158#200 with no items for `filter` or `q` |
| SCR-113#stale | A checkpoint passed in NEXUS that no record names, one recorded meanwhile or one withdrawn already: as SCR-112#stale, in the head and the record. A newer push found when the list reads again: SCR-111#stale's bar, and the list keeps what it drew until Load again, with the filter and the search that it was read with; meanwhile the end of the list reads no more | API-158#200, API-129#409 (`checkpoint_recorded`), API-129#200 with `changed: false` |
| SCR-113#error | The page's request: SCR-111#error. A filter, a search or the next 200 that fail: "Could not update. What you see may be out of date." with Try again, or "Could not load more." with Try again as the last row, while the list stays; the filter that the user picked stays pressed, and Try again reads it. A query value out of its form, `invalid_request`, is such a failure. Passing or withdrawing: as SCR-112#error. No connection, no answer in 30 seconds, `429` or `503`: rule 8 | API-158#400 (`invalid_request`), API-158#404 (`project_not_found`, `space_not_found`, `part_not_found`, `not_found`), API-158#default (`internal`, `method_not_allowed`), and the responses of API-128 and API-129 as on SCR-112#error |
| SCR-113#permission | Reading again: the code's message in the bar. Passing or withdrawing: as SCR-112#permission. A sign-in that expired: [rule 7](README.md#every-screen), with the words kept | API-158#403 (`access_missing`, `access_other_app`), API-128#403 and API-129#403 (`user_only`, `access_missing`, `access_other_app`), an `opaqueredirect` reply or a `401` |

Every state of the stage applies, with two of the list's own: not-read, a stage that the project does not read, and no-match, a filter or a search without a match.

## Kinds of cases

| Kind | What the user sees |
| --- | --- |
| Access | Access's own login page or refusal comes before the page; the Worker's `403` and a sign-in that expired: SCR-113#permission. Passing and withdrawing need a person's own sign-in: `user_only` |
| Input | The search in this stage, up to 200 characters, sent as `q` once the typing pauses; the checkpoint's words, up to 2,000 characters (rule 5): from 1,800 the box says how many are left, and past 2,000 "This text is too long: 2,000 characters at most.", with the box marked invalid and Pass disabled |
| Target | A part or a project that the server does not hold: SCR-111#error. A project without a space shows its list, with the message of `space_not_found` in the talk's place, as SCR-111's Target says. An address whose item the stage does not hold: SCR-115#gone. A stage that the project does not read: SCR-113#not-read |
| State changes | A checkpoint that waits for its record or was recorded meanwhile, and a newer push: SCR-113#stale |
| Repeats | While Pass or Withdraw runs it says "Sending…" and is announced as disabled, so that the focus stays on it, and a second press sends nothing; a try after a lost reply sends the same write ID (SPEC-126); a filter picked twice reads once, and a search reads once when its typing pauses |
| Concurrency | Another tab's or the agent's writes show in the counts and marks when the list reads again (rule 6): after a write, a filter, a search and Try again, while coming back to the page reads nothing, so that the list does not move under the user; a checkpoint that another tab withdrew: "This checkpoint was already withdrawn.", and the record reads again |
| Limits | 200 items at a time, then more as the user scrolls, with "{n} of {total}"; counts over 999 show as `999+`. NEXUS's stage 12 holds 717 cases, which load in four reads. An address's `#item=` reads on, 200 at a time, until its row is drawn |
| Outside services | None: code, styles and fonts come only from the server (REQ-147) |
| Data exposure | The snapshot's items as text (REQ-098); no identity but "User" or "Agent" (rule 11); a pass's kind of browser and device only in the words of its fixed vocabulary, as on SCR-112 (SPEC-195) |
| Empty and streamed answers | No items: SCR-113#empty. Not read: SCR-113#not-read. No match: SCR-113#no-match. No stream |
| Screen states | Every state at 390 and 1440 pixels in both themes, in [redesign.html](../../09-mockup/nexus/redesign.html#scr-113) |
| AI answers | None: NEXUS calls no AI model (REQ-121) |

## Layout

| Region | Under 1,024 pixels, drawn at 390 | From 1,024 pixels, drawn at 1,440 |
| --- | --- | --- |
| The head | Under the tabs: the state, the last checkpoint and the commit on lines that wrap, a checkpoint that waits for its record on a line of its own, then the counts, each whole, with Stage record at the right end of their line; the top bar names the stage, so its heading is there for screen readers only | Two lines, as stage 09 draws them: the number and name, the state, and the counts with Stage record at the right end, and "Talk ({n})" after it from 1,024 to 1,279 pixels and, from 1,280, while the talk is folded, with "My turn {n}" while entries of the stage wait for the user (SCR-111); under them the last checkpoint, the commit and a checkpoint that waits for its record. The counts wrap, each whole, rather than end in an ellipsis, so that none is cut |
| The filters and the search | The four filters in a row that wraps, then the search and the grouping, a menu, on a line across the width | One line: the filters, the search, up to 280 pixels wide, and the grouping, a menu. The search and the grouping keep together: the search narrows to 144 pixels, its placeholder ending in an ellipsis, and then both take a line of their own |
| The list | Each item stacked: its ID and marks on the first line, its text under them, its fields on a last line that wraps; a row at least 44 pixels high | Each item a row of columns: ID 112 pixels, the text, its fields, its comments and its marks; a row 36 pixels high when its text fits one line |
| The group headings | A line across the width with the context's ID, name and count | The same, above the group's rows |
| The stage record | A sheet of up to 85 per cent of the height | In the side, 400 pixels wide, in the talk's place; from 1,024 to 1,279 pixels, a panel as wide over the stage's right edge, where the talk opens too |

On a screen that a finger selects, the filters, the search, the grouping, Stage record, the rows and, in the record, its buttons take a hit area of 44 pixels (rule 14).

## The design revision of 2026-11-11

What the design revision of 2026-11-11 adds to this screen or changes on it: its checkpoint passed on 2026-11-12 ([the review's map](../../reviews/2026-11-11-design-review.md), findings 3 and 25). The sections above tell the list as TASK-274 built it. Since TASK-278 of 2026-11-13 each row of this section says whether it is built, and since TASK-301 of the same day every row is, by the tasks that each names: the talk of TASK-276 and the item of TASK-277 built an item that the talk selects, and TASK-299, TASK-300 and TASK-301 the record, as on SCR-112: the kind of browser and device, the open checkpoint request, and a pass bound to what the user saw, with its refusals, what it names and the words of its button. The rows stay here, since the grey page draws them and the stage's check ties each state row to its frames. The rows that said `open (D17)` are `planned`: the maintainer decided D17 on 2026-11-12 as recommended. The words are in [revision-words.md](revision-words.md), and the rules are those of [the design revision](README.md#the-design-revisions-screens).

### Data of the revision

| Data | Source | Status |
| --- | --- | --- |
| The item that an entry of the talk selects | The entry's item (SCR-114); its row is found as the row of an address's `#item=` is, 200 items at a time | built (TASK-276, TASK-277) |
| For the record: the stage's open checkpoint request with what is left in the stage, what a pass names, and what each checkpoint passed in NEXUS recorded | As SCR-112's revision says: API-152, API-158 (`project`, `record`) | built (TASK-299, TASK-300, TASK-301) |

### Actions of the revision

| Action | Result | Failure | Status |
| --- | --- | --- | --- |
| Pick an entry of the talk that is on an item | The item is selected in the list ([rule 24](README.md#the-design-revisions-screens), SPEC-209): the list scrolls so that the item's row is in sight and shows it as selected, with the accent's bar and as the current row for screen readers, reading on 200 items at a time until the row is drawn; the item's panel opens with its talk narrowed to it and the picked entry open (SCR-115); and the address gains `item={id}` beside the entry's `talk=` (SCR-114), so that the browser's back button returns to the stage's whole talk at that entry. The List view of a pictured stage does the same, and its address keeps `view=list` | The stage no longer holds the item: nothing is selected, and the entry says so with the item's ID (SCR-114). The list as the user narrowed it does not hold the row: no row is selected, the filter and the search stay, and the item's panel says "This item is not in the list as you narrowed it." with Show all, which clears the filter and the search and selects the row | built (TASK-276, TASK-277) |
| Stage record, Pass | As SCR-112's revision says: the stage's open request whole above the words box, "Pass the stage {n} checkpoint", and beside each checkpoint passed in NEXUS what it recorded. A stage that the project does not read passes in the same way, with the commit that its head shows (SCR-113#not-read) | SCR-113#stale, SCR-113#error or SCR-113#permission, with the words kept | built (TASK-299, TASK-300, TASK-301) |

### States of the revision

| State | What the revision adds or changes | From responses | Status |
| --- | --- | --- | --- |
| SCR-113#normal | An item that the talk selected: its row in sight and shown as selected, with its panel beside the list; where the narrowed list does not hold the row, the panel's line with Show all. In the record, the stage's open request whole above the pass, the pass named for the stage, and what each checkpoint passed in NEXUS recorded, as on SCR-112 | API-158#200, API-152#200, API-128#201 | built (TASK-276, TASK-277, TASK-299, TASK-300, TASK-301) |
| SCR-113#stale | A pass refused because what the page showed has changed: as SCR-112#stale's revision says, above the words box, with the words kept and nothing recorded | API-128#409 (`snapshot_changed`, `request_changed`) | built (TASK-301) |
| SCR-113#error | A pass that fails for its request: as SCR-112#error's revision says, above the words box, with the words kept | API-128#400 (`invalid_request`), API-128#404 (`comment_not_found`), API-128#409 (`reply_limit`, `space_full`) | built (TASK-301) |

The revision adds no state. A reading again that sends a query value out of its form is an error like any reading that fails, which SCR-113#error now names (API-158#400).

### Kinds of cases of the revision

| Kind | What the revision adds |
| --- | --- |
| Target | An item that the talk selects and the stage no longer holds: nothing is selected, and the entry says so. An item whose row the narrowed list does not hold: no row is selected, and the item's panel offers Show all |
| State changes | A push, or the agent's newer request, between the page's drawing and the pass: SCR-113#stale |
| Repeats | Picking an entry of the item that is selected already keeps the row and the panel, and opens that entry. A pass sent again with its write ID leaves one checkpoint and gets its first answer, even when the commit changed in between (SPEC-194) |
| Limits | The row of an item that the talk selects is read as an address's is: 200 items at a time, until it is drawn |
| Screen states | The row that the talk selected and the record with a request in grey at 390 and 1,440 pixels, in [revision-wireframes.html](revision-wireframes.html#scr-113), and in the redesign's look in both themes, as stage 09 drew them after the revision's checkpoint, in [revision.html](../../09-mockup/nexus/revision.html#scr-113) |

### Layout of the revision

| Region | Under 1,024 pixels, drawn at 390 | From 1,024 pixels, drawn at 1,440 |
| --- | --- | --- |
| The item that the talk selected | The Item tab appears and the Talk tab stays in front; the list shows the row selected when the user opens its tab | The row in sight in the list, selected; its panel in the side |
| The record's request and a passed checkpoint's record | As on SCR-112, in the sheet | As on SCR-112, in the side |
