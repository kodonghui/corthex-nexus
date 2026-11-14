# SCR-115 Item

[한국어](SCR-115-item.ko.md)

Purpose: beside any stage of a project's workspace, the user reads one item: its sentence or title as the source has it, its fields in words, its context and the place of its source, the items that it comes from and leads to in the other stages, and its talk, where the user leaves a comment on it. (FL-118, FL-119)

Path `/p/{project}/{part}/{stage}#item={id}`, on the NEXUS server only (API-154), in the side of the workspace (SCR-111). Who can see it: anyone Cloudflare Access lets in. Planned in the redesign of 2026-11-06 (SPEC-149, with SPEC-122). It takes in the item (SCR-106) and the trace view (SCR-103), whose addresses lead here (SPEC-154). What the design revision of 2026-11-11 plans on this screen is in [its last section](#the-design-revision-of-2026-11-11), with a status on each row; until a task builds a row, the sections before it tell the screen as it is. The rules of [every screen](README.md#every-screen) apply, with those of [the redesign](README.md#the-redesigns-screens).

## Data

| Data | Source |
| --- | --- |
| The item: its ID and kind, its title or sentence as the source has it, with the source's language; its fields, with their names in the page's language and their values as the source has them; its context; and the place of its source, a path and a line in the repository, linked to the file at the snapshot's commit when the settings give the repository's address (REQ-228) | API-157 |
| The items that it comes from and leads to in every stage, grouped by stage with their counts, as SPEC-122's trace | API-157 (`trace`) |
| On a pictured stage, its open discrepancies, each with its reason as a sentence, and whether it waits for a current picture | API-111 (`discrepancies`) |
| Its talk, narrowed to it | API-157 (`comments`), as API-152 gives them, then API-152 with `item` (SCR-114#narrowed) |
| The item to open | The page's address after `#`: `item=`; 0.2's `#p={project}&id={id}` leads here (SPEC-154) |

## Actions

| Action | Result | Failure |
| --- | --- | --- |
| Open an item of the trace | That item at its place: its stage's page with `#item={id}`, in this project's workspace | SCR-115#gone on that page |
| Open the source's place | The file at the snapshot's commit and line, on the repository's site, in a new tab | none; without the repository's address, the place is text |
| Comment on this item, or on one of its discrepancies | The talk's box, "Comment on {id}"; on a discrepancy, the comment names it (SCR-114) | SCR-114's own states |
| Talk, in the side's head | The stage's whole talk again (SCR-114), with the item still selected in the picture or the list | none |
| Close, Escape or the browser's back button | The item closes, the address leaves `item=`, and the side shows the stage's talk | none |
| Search all projects for the ID, on an item that is gone | SCR-116 with the ID as its words | SCR-116's own states |

## States

| State | What the user sees and can do | From responses |
| --- | --- | --- |
| SCR-115#loading | The item's ID, kind and text at once, from the row or the picture that the user selected, in the layout of SCR-115#normal; the fields, the trace and the talk keep their places as grey lines until they arrive, with "Loading {id}…" for screen readers | API-157#200 |
| SCR-115#normal | The head: the ID, the kind, Close, and the switch between Talk and Item. The text as the source has it, in its language. The fields as a list of names and values, "None" for an empty one, and the source's other fields folded under Details. "Context: {id} {name}". "Source: {path}, line {n}", a link to the file at commit {commit}, or text without the repository's address. "Comes from" and "Leads to", each grouped by stage with its count, each item a link with its ID and title. On a pictured stage, "Discrepancies ({n})" with each reason and "Comment on this discrepancy". Last, "Talk on {id}", SCR-114#narrowed, with its box | API-157#200, API-111#200 |
| SCR-115#gone | An item that no stage of the project holds now, after a push or from an old link: "{id} is not in this project's stages now." with its comments that still name it, shown apart and still open (REQ-162), and "Search all projects for {id}" (SPEC-149, SPEC-152); in the picture or the list nothing stays selected | API-157#404 (`item_not_found`) |
| SCR-115#error | The code's message in the item's place, with the trace ID and Try again; the stage and its talk stay: `project_not_found`, `space_not_found` and `part_not_found`, after which the page reads again; `not_found`; `invalid_request` for a `part` in another form; `internal` and `method_not_allowed`. No connection, no answer in 30 seconds, `429` or `503`: rule 8 | API-157#400 (`invalid_request`), API-157#404 (`project_not_found`, `space_not_found`, `part_not_found`, `not_found`), API-157#default (`internal`, `method_not_allowed`) |
| SCR-115#permission | The code's message in the item's place. A sign-in that expired: [rule 7](README.md#every-screen), "Sign in again", which comes back to the same address with the item | API-157#403 (`access_missing`, `access_other_app`), an `opaqueredirect` reply or a `401` |

Every state of the stage applies but empty and stale, with one of the item's own, gone. Does not apply:

- Empty: an item always has an ID and a text; a field without a value says "None", and an item without talk shows SCR-114#empty's words.
- Stale: the item reads when it opens; a newer push while it is open shows as SCR-111#stale.

## Kinds of cases

| Kind | What the user sees |
| --- | --- |
| Access | The Worker's `403` and a sign-in that expired: SCR-115#permission |
| Input | None of its own: a comment on the item is the talk's (SCR-114) |
| Target | An ID that no stage of the project holds: SCR-115#gone, with the search. An item in another stage: its link opens it there. A part without an ID of its own, on a picture: the talk's box takes the part's name as the quote, on the item that holds it, or on the stage as a whole when no item holds it, where SPEC-126 attaches it to the picture itself |
| State changes | A discrepancy resolved meanwhile: a comment on it gets `discrepancy_not_found`, and the item reads again (SCR-114#error) |
| Repeats | Opening the same item again keeps the panel; Try again is disabled while it runs |
| Concurrency | A newer push while the item is open: SCR-111#stale; its talk reads again after a write (rule 6) |
| Limits | The trace lists every linked item, grouped by stage with counts; a long text wraps, and a long ID or path breaks rather than widen the side (rule 1) |
| Outside services | The source's link opens the repository's site in a new tab, the one link that leaves the server; the panel sends its requests only to the server (REQ-147) |
| Data exposure | The item's fields as text (REQ-098); the source's place without the content of the file; no identity but "User" or "Agent" (rule 11) |
| Empty and streamed answers | A field without a value: "None". No stream |
| Screen states | Every state at 390 and 1440 pixels in both themes, in [redesign.html](../../09-mockup/nexus/redesign.html#scr-115) |
| AI answers | None: NEXUS calls no AI model (REQ-121) |

## Layout

| Region | Under 1,024 pixels, drawn at 390 | From 1,024 pixels, drawn at 1,440 |
| --- | --- | --- |
| The item | The Item tab, the whole width, which appears while an item is selected | The side, 400 pixels wide, in the talk's place, with the switch to go back |
| The fields | Names above their values | Names in a column of 112 pixels, values beside them |
| The trace | Each stage's group a heading with its count, then its items one under another | The same |
| The talk on the item | Under the trace; its box at the bottom of the tab | Under the trace; its box at the bottom of the side |

## The design revision of 2026-11-11

What the design revision of 2026-11-11 adds to this screen or changes on it, planned and not built: its checkpoint passed on 2026-11-12 ([the review's map](../../reviews/2026-11-11-design-review.md), finding 25). The sections above tell the item as the redesign's checkpoint 3 passed it; TASK-277 builds it with the rows of this section, now that the revision's checkpoint has passed, and moves them into the sections above. The words are in [revision-words.md](revision-words.md), and the rules are those of [the design revision](README.md#the-design-revisions-screens).

### Data of the revision

| Data | Source | Status |
| --- | --- | --- |
| The entry of the talk that selected the item, to open in the item's talk and to return to | The page's address after `#`: `talk=` beside `item=` (SCR-114) | planned |
| Why the stage does not show the item where the user looks: a picture that is not current or not drawn, or a list narrowed past the item's row | The page's data: the picture's state (SCR-112#stale, SCR-112#empty), and the list's filter and search (SCR-113) | planned |

### Actions of the revision

| Action | Result | Failure | Status |
| --- | --- | --- | --- |
| Close, Escape or the browser's back button, on an item that an entry of the talk selected | The item closes, the address leaves `item=` and `talk=`, and the side shows the stage's whole talk with that entry in sight and the focus on it ([rule 24](README.md#the-design-revisions-screens), SPEC-209); in the picture or the list nothing stays selected | none | planned |
| Show all, where the narrowed list does not hold the item's row | The list's filter and search clear, and the row is selected (SCR-113) | SCR-113#error | planned |

### States of the revision

| State | What the revision adds or changes | From responses | Status |
| --- | --- | --- | --- |
| SCR-115#normal | Opened from an entry of the talk: the side scrolls to "Talk on {id}" with that entry open, and the item is selected in the picture or the list. Under the panel's head, where the stage does not show the item: "The picture is not current, so the list shows this item.", "The picture is not drawn yet, so the list shows this item." or "This item is not in the list as you narrowed it." with Show all | API-157#200, API-152#200 with `item` | planned |

The revision adds no state. A request whose `part` is in another form is an error like any other, which SCR-115#error now names (API-157#400).

### Kinds of cases of the revision

| Kind | What the revision adds |
| --- | --- |
| Target | An item whose picture is not current or not drawn: the panel says so, and the list shows its row. An item whose row the narrowed list does not hold: the panel offers Show all |
| Repeats | Picking another entry of the same item keeps the panel and opens that entry in its talk |
| Screen states | The item that the talk selected in grey at 390 and 1,440 pixels, on SCR-112's frames in [revision-wireframes.html](revision-wireframes.html#scr-115); stage 09 draws it in the redesign's look |

### Layout of the revision

| Region | Under 1,024 pixels, drawn at 390 | From 1,024 pixels, drawn at 1,440 |
| --- | --- | --- |
| The line on why the stage does not show the item | Under the panel's head, across the width, Show all 44 pixels high | Under the panel's head, in the side |
| The item's talk, opened from an entry | On the Talk tab, which stays in front; the Item tab holds the item | Under the trace, where the side scrolls to the picked entry |
