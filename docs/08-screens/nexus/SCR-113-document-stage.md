# SCR-113 Document stage

[한국어](SCR-113-document-stage.ko.md)

Purpose: in a project's workspace the user looks at a stage without a picture, such as the requirements of 02 or the QA cases of 12: its head with its recorded state, last checkpoint, commit and counts, and its items as a list that the user narrows to what has talk, what waits for the user or what is left; selects an item to read it and talk about it; and passes the stage's checkpoint from its record. The same list is the List tab of a picture stage. (FL-118, FL-119)

Path `/p/{project}/{part}/{stage}` for the ten stages other than `01-domain`, `05-erd` and `07-sitemap`, and `#view=list` on those three, on the NEXUS server only (API-154), in the middle of the workspace (SCR-111). Who can see it: anyone Cloudflare Access lets in. Planned in the redesign of 2026-11-06 (SPEC-147, SPEC-148). It takes in the stage detail (SCR-104) and the stage overview (SCR-109), whose "what is left" becomes a filter. The rules of [every screen](README.md#every-screen) apply, with those of [the redesign](README.md#the-redesigns-screens).

## Data

| Data | Source |
| --- | --- |
| The head: the stage's number and name, its recorded state, its last checkpoint and its date, the commit that the stage shows and its time, and its counts, such as requirements by priority for 02 or cases by result for 12 (REQ-226) | API-158 (`head`), first from the page's data |
| The stage record: the recorded state, next action, checkpoints, checks and findings, and a checkpoint passed in NEXUS that waits for its record (SPEC-138) | API-158 (`record`) |
| Whether the project reads the stage, and why not, from the state of its text source | API-158 (`head.reads`) |
| The items, 200 at a time: each with its ID, its title or sentence as the source has it, its main fields, such as a requirement's priority and status, the number of its comments, a mark when it is in my turn, and marks for its open discrepancies and pending reflections; grouped by context, with the items without a context last, or in the source's order (REQ-227) | API-158 (`items`, `after`, `group`), the first 200 from the page's data |
| The filter, all, with talk, my turn or what is left, and the words of the search within the stage | Kept in the page while it is open; sent as `filter` and `q` (API-158). An address with `#filter=left`, from the first page's agent to-do (SCR-110), opens the list with what is left, on a pictured stage too |

## Actions

| Action | Result | Failure |
| --- | --- | --- |
| Pick a filter: All, With talk, My turn, What is left | The list narrows to the items with comments, those with an entry that waits for the user, or those with an open discrepancy, comment or pending reflection, with how many it holds (REQ-176) | SCR-113#no-match, SCR-113#error |
| Search in this stage, from one character | The list narrows to the items whose ID or title holds every word, case-insensitive | SCR-113#no-match |
| Group by context, or In the source's order | The list grouped by the items' contexts, or in the order of the source | none |
| Scroll to the end of the list | The next 200 items, with "Loading more…" as the last row meanwhile | "Could not load more." with Try again as the last row |
| Select an item, or open an address with `#item=` | The item beside the stage, SCR-115, and the talk narrowed to it; the row shows as selected | An ID that the stage does not hold: SCR-115#gone |
| Select an item's count of comments | The talk narrowed to the item (SCR-114) | none |
| Stage record, Pass, Withdraw | As on SCR-112 (SPEC-138, SPEC-139) | SCR-113#stale, SCR-113#error, SCR-113#permission |
| Load again | The page from the server, at the same address | SCR-111#error |

## States

| State | What the user sees and can do | From responses |
| --- | --- | --- |
| SCR-113#loading | The head and the first 200 items as the server drew them from the page's data, in the layout of SCR-113#normal; the filters, the search and the record's writes wait for the view's code, shown disabled ([rule 15](README.md#the-redesigns-screens)). Loading more: "Loading more…" as the last row | API-154#200, API-104#200 |
| SCR-113#normal | The head: the stage's number and name, its state as a shape and a word, "Last checkpoint {date}" or "No checkpoint yet", "Commit {commit} · {time}", its counts, and Stage record. Under it the filters, each with its count, the search in this stage and the grouping. The list: each group's heading with its context's ID and name and its count; each item a row with its ID, its text as the source has it, in its own language, its main fields with their names in the page's language, its count of comments, and its marks: My turn, a discrepancy's and a pending reflection's, each with its word for screen readers; the selected row with the accent's bar. "{n} of {total}" at the end while more remain | API-154#200, API-158#200, API-128#201 and API-129#200 with `changed: true` |
| SCR-113#empty | A stage that the project reads with no items yet: "This stage holds no items yet." in place of the list; the head, the record and the talk on the stage as a whole stay | API-158#200 with no items |
| SCR-113#not-read | A stage that the project does not read: the head says why, from the state of its text source, and in place of the list "This project does not read this stage: {why}. You can still pass its checkpoint.", with Stage record (SPEC-147, SPEC-148) | API-158#200 with `head.reads` false |
| SCR-113#no-match | A filter or a search that matches nothing: "Nothing waits for you in this stage.", "Nothing is left in this stage.", "No item of this stage has talk yet." or "Nothing in this stage matches “{q}”.", with Show all, which clears the filter and the search | API-158#200 with no items for `filter` or `q` |
| SCR-113#stale | A checkpoint passed in NEXUS that no record names, one recorded meanwhile or one withdrawn already: as SCR-112#stale, in the head and the record. A newer push found when the list reads again: SCR-111#stale's bar, and the list keeps what it drew until Load again | API-158#200, API-129#409 (`checkpoint_recorded`), API-129#200 with `changed: false` |
| SCR-113#error | The page's request: SCR-111#error. A filter, a search or the next 200 that fail: "Could not update. What you see may be out of date." with Try again, or "Could not load more." as the last row, while the list stays. Passing or withdrawing: as SCR-112#error. No connection, no answer in 30 seconds, `429` or `503`: rule 8 | API-158#404 (`project_not_found`, `space_not_found`, `part_not_found`, `not_found`), API-158#default (`internal`, `method_not_allowed`), and the responses of API-128 and API-129 as on SCR-112#error |
| SCR-113#permission | Reading again: the code's message in the bar. Passing or withdrawing: as SCR-112#permission. A sign-in that expired: [rule 7](README.md#every-screen), with the words kept | API-158#403 (`access_missing`, `access_other_app`), API-128#403 and API-129#403 (`user_only`, `access_missing`, `access_other_app`), an `opaqueredirect` reply or a `401` |

Every state of the stage applies, with two of the list's own: not-read, a stage that the project does not read, and no-match, a filter or a search without a match.

## Kinds of cases

| Kind | What the user sees |
| --- | --- |
| Access | Access's own login page or refusal comes before the page; the Worker's `403` and a sign-in that expired: SCR-113#permission. Passing and withdrawing need a person's own sign-in: `user_only` |
| Input | The search in this stage, up to 200 characters, sent as `q`; the checkpoint's words, up to 2,000 characters (rule 5) |
| Target | A part or a project that the server does not hold: SCR-111#error. A project without a space shows its list, with the message of `space_not_found` in the talk's place, as SCR-111's Target says. An address whose item the stage does not hold: SCR-115#gone. A stage that the project does not read: SCR-113#not-read |
| State changes | A checkpoint that waits for its record or was recorded meanwhile, and a newer push: SCR-113#stale |
| Repeats | Pass and Withdraw are disabled while they run; a filter picked twice reads once |
| Concurrency | Another tab's or the agent's writes show in the counts and marks when the list reads again (rule 6) |
| Limits | 200 items at a time, then more as the user scrolls, with "{n} of {total}"; counts over 999 show as `999+`. NEXUS's stage 12 holds 717 cases, which load in four reads |
| Outside services | None: code, styles and fonts come only from the server (REQ-147) |
| Data exposure | The snapshot's items as text (REQ-098); no identity but "User" or "Agent" (rule 11) |
| Empty and streamed answers | No items: SCR-113#empty. Not read: SCR-113#not-read. No match: SCR-113#no-match. No stream |
| Screen states | Every state at 390 and 1440 pixels in both themes, in [redesign.html](../../09-mockup/nexus/redesign.html#scr-113) |
| AI answers | None: NEXUS calls no AI model (REQ-121) |

## Layout

| Region | Under 1,024 pixels, drawn at 390 | From 1,024 pixels, drawn at 1,440 |
| --- | --- | --- |
| The head | Under the tabs: the state, the last checkpoint and the commit on one line that wraps, the counts on a second line, and Stage record | One line: the number and name, the state, the last checkpoint and the commit, with the counts and Stage record at its right end |
| The filters and the search | The four filters in a row that wraps, then the search across the width, and the grouping in a menu | One line: the filters, the search, 280 pixels wide, and the grouping |
| The list | Each item stacked: its ID and marks on the first line, its text under them, its fields on a last line that wraps; a row at least 44 pixels high | Each item a row of columns: ID 112 pixels, the text, its fields, its comments and its marks; a row 36 pixels high when its text fits one line |
| The group headings | A line across the width with the context's ID, name and count | The same, above the group's rows |
| The stage record | A sheet of up to 85 per cent of the height | In the side, 400 pixels wide, in the talk's place |
