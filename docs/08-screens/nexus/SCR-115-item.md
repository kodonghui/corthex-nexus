# SCR-115 Item

[한국어](SCR-115-item.ko.md)

Purpose: beside any stage of a project's workspace, the user reads one item: its sentence or title as the source has it, its fields in words, its context and the place of its source, the items that it comes from and leads to in the other stages, and its talk, where the user leaves a comment on it. (FL-118, FL-119)

Path `/p/{project}/{part}/{stage}#item={id}`, on the NEXUS server only (API-154), in the side of the workspace (SCR-111). Who can see it: anyone Cloudflare Access lets in. Planned in the redesign of 2026-11-06 (SPEC-149, with SPEC-122). It takes in the item (SCR-106) and the trace view (SCR-103), whose addresses lead here (SPEC-154). The rules of [every screen](README.md#every-screen) apply, with those of [the redesign](README.md#the-redesigns-screens).

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
| SCR-115#error | The code's message in the item's place, with the trace ID and Try again; the stage and its talk stay: `project_not_found`, `space_not_found` and `part_not_found`, after which the page reads again; `not_found`; `internal` and `method_not_allowed`. No connection, no answer in 30 seconds, `429` or `503`: rule 8 | API-157#404 (`project_not_found`, `space_not_found`, `part_not_found`, `not_found`), API-157#default (`internal`, `method_not_allowed`) |
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
