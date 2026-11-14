# SCR-114 Talk

[한국어](SCR-114-talk.ko.md)

Purpose: beside any stage of a project's workspace, the user reads the stage's comments and proposals by turn, what waits for the user first, then what waits for the agent, with whether a session took it, then the closed ones, folded; narrows them to a selected item; and leaves a comment on an item or on the stage as a whole, replies, settles a comment, marks it answered, and accepts or dismisses a proposal. (FL-117, FL-119)

Path `/p/{project}/{part}/{stage}#talk={comment}`, or the stage's page without it, on the NEXUS server only (API-154), in the side of the workspace (SCR-111). Who can see it: anyone Cloudflare Access lets in. Planned in the redesign of 2026-11-06 (SPEC-150, SPEC-151, with SPEC-126, SPEC-127, SPEC-131 and SPEC-133). It takes in the comment (SCR-107) and the proposal (SCR-108), whose addresses lead here (SPEC-154). What the design revision of 2026-11-11 plans on this screen is in [its last section](#the-design-revision-of-2026-11-11), with a status on each row; until a task builds a row, the sections before it tell the screen as it is. The rules of [every screen](README.md#every-screen) apply, with those of [the redesign](README.md#the-redesigns-screens).

## Data

| Data | Source |
| --- | --- |
| The stage's talk for the part: the open proposals and comments, those that wait for the user first, each with its item and quote or the stage as a whole, its author's kind and time, its last reply, what it asks, since when it waits and, while a session holds a claim on it, when the agent took it; the comments whose item the snapshot no longer holds, apart; and the count of closed ones | API-152, first from the page's data |
| The talk narrowed to one item | API-152 with `item`, when an item is selected (SCR-115) |
| The closed talk, newest first, 50 at a time | API-152 with `closed=1` |
| A comment's replies, opened | API-114 |
| A proposal's change, reason and stage source text, and its reflection | API-115, and API-116 for a reflection that the talk no longer lists |
| The entry to open | The page's address after `#`: `talk=` with a comment's or a proposal's ID; 0.2's `comment=` and `proposal=` read the same (SPEC-154) |
| Unsent text: a comment's or a reply's, with its write ID | The browser's storage, for the part, stage and item, or the comment (rule 5) |

## Actions

| Action | Result | Failure |
| --- | --- | --- |
| Write a comment and Leave it | With an item selected, the comment goes on the item, with the quote when the user selected a part of a picture; with nothing selected, on the stage as a whole (SPEC-151, API-118). It shows under the agent's turn, marked as the user's, and the talk reads again | SCR-114#error or SCR-114#permission, with the text kept |
| Open an entry | Its replies under it, and for a proposal its change, reason and stage source text in its own box (SCR-108's content) | SCR-114#gone, SCR-114#error |
| Reply, with or without "This settles it" | The reply under the comment; settled, the comment waits for the agent's record (SPEC-127, SPEC-132); on a closed comment, "Reply and open again" opens it again (REQ-203) | As above |
| Mark answered | The comment closes as answered and folds into the closed talk (SPEC-127, API-120) | As above |
| Accept or Dismiss a proposal; Dismiss its reflection | As SCR-108 did: accepted, the items show "Accepted, not yet reflected"; dismissed, its comment stays open (SPEC-131, SPEC-133) | SCR-114#stale, SCR-114#error, SCR-114#permission |
| Select an item in the picture or the list, or open an entry's item | The talk narrows to that item with "All talk of the stage" to go back (REQ-230); the item shows beside, SCR-115 | none |
| Show the closed talk | The closed comments and proposals, 50 at a time, with "Show more" | SCR-114#error |
| Close, Escape or the browser's back button on an opened entry | The entry folds, and the address leaves `talk=` | none |

## States

| State | What the user sees and can do | From responses |
| --- | --- | --- |
| SCR-114#loading | The talk from the page's data as the server drew it, in the layout of SCR-114#normal; the box and the buttons wait for the view's code, shown disabled. Opening an entry: its last reply stays in view while the others load, with "Loading the replies…" for screen readers | API-154#200, API-104#200, API-114#200, API-115#200 |
| SCR-114#normal | The heading "Talk" with the stage, and its two counts, "My turn {n}" and "The agent's turn {n}". "My turn ({n})": each entry with its kind, Proposal, Question, Recommendation or Checkpoint, its item's ID and quote or "On the stage as a whole", "Agent · {time}", its text, and its buttons as on SCR-110. "The agent's turn ({n})": each entry with "Waiting for the agent since {time}", or "Taken by the agent at {time}" while a session holds it, and the user can still reply (SPEC-136). "Apart: comments whose item is gone ({n})", still open, with the items' IDs (REQ-162). "Closed ({n})", folded. At the bottom, the box, "Comment on the stage as a whole" or "Comment on {id}", up to 4,000 characters, with Leave and "The agent reads this at its next work on the project." | API-154#200, API-152#200, API-116#200, API-118#201, API-119#201, API-120#200, API-124#200, API-125#200 and API-127#200 with `changed: true` |
| SCR-114#narrowed | An item is selected: "Talk on {id}" with the item's entries only, apart and closed included, the box saying "Comment on {id}", and "All talk of the stage" to go back (REQ-230) | API-152#200 with `item` |
| SCR-114#empty | No talk on the stage yet: "No talk on this stage yet. Select an item to talk about it, or write about the stage as a whole." above the box. Narrowed to an item without comments: "No comments on {id} yet." | API-152#200 with no entries |
| SCR-114#stale | A write on a comment closed or answered meanwhile in another tab: its state, "This comment was already closed.", and the talk reads again. A reply that came after the entry opened: "New" by it. A proposal no longer open: "This proposal is no longer open: it was {state}." A reflection that changed: "This reflection changed meanwhile: it is now {state}." A reflection dismissed already: "The reflection was already dismissed." In each, the talk reads again and the text being written stays | API-120#200 with `changed: false`, API-124#409 and API-125#409 (`proposal_not_open`), API-127#409 (`edit_state`), API-127#200 with `changed: false`, API-152#200, API-114#200 |
| SCR-114#error | A write that fails: its code's message above the box, with the text kept and Try again, which sends the same write ID: `invalid_request` by the field, as a stage key outside the 13; `cross_site` with a link to the page at the server's own address; `part_not_found` and `space_not_found`; `discrepancy_not_found` for a comment on a discrepancy resolved meanwhile, after which the talk reads again; `comment_limit` and `space_full`; `reply_limit`, with "Leave a new comment" that copies the text into the stage's box; `write_id_reused`, whose Try again makes a new write ID; `text_too_long` by the box, and `body_too_large`; `json_required`, `internal` and `method_not_allowed`. Reading again: "Could not update. What you see may be out of date." with Try again, which a query value out of its form, `invalid_request`, gets too. Opening an entry: "Could not load this comment." or "Could not load this proposal." with Try again. No connection, no answer in 30 seconds, `429` or `503`: rule 8 | API-152#400 (`invalid_request`), API-152#404 (`project_not_found`, `space_not_found`, `part_not_found`, `not_found`), API-152#default (`internal`, `method_not_allowed`), API-118#400 (`invalid_request`), API-118#403 (`cross_site`), API-118#404 (`part_not_found`, `discrepancy_not_found`, `project_not_found`, `space_not_found`), API-118#409 (`comment_limit`, `space_full`, `write_id_reused`), API-118#413 (`text_too_long`, `body_too_large`), API-118#415 (`json_required`), API-118#default (`internal`, `method_not_allowed`), API-119#400 (`invalid_request`), API-119#403 (`cross_site`), API-119#404 and API-120#404 (`project_not_found`, `space_not_found`), API-119#409 (`reply_limit`, `space_full`, `write_id_reused`), API-119#413 (`text_too_long`, `body_too_large`), API-119#415 (`json_required`), API-119#default (`internal`, `method_not_allowed`), API-120#400 (`invalid_request`), API-120#403 (`cross_site`), API-120#409 (`write_id_reused`), API-120#default (`internal`, `method_not_allowed`), API-124#400, API-125#400 and API-127#400 (`invalid_request`), API-124#403, API-125#403 and API-127#403 (`cross_site`), API-124#409 (`reflection_limit`, `write_id_reused`), API-125#409 and API-127#409 (`write_id_reused`), API-124#default, API-125#default and API-127#default (`internal`, `method_not_allowed`), API-114#default, API-115#default and API-116#default (`internal`, `method_not_allowed`) |
| SCR-114#permission | A write refused: the code's message above the box, with the text kept: "This sign-in cannot write here. Check the Access policy." for `no_kind`; "Only you can do this, signed in yourself." for Accept, Dismiss and dismissing a reflection, which need a person's own sign-in (SPEC-116); `access_missing` and `access_other_app`. A sign-in that expired: [rule 7](README.md#every-screen), "Sign in again", with the text kept in its box and in the browser's storage | API-152#403, API-114#403, API-115#403 and API-116#403 (`access_missing`, `access_other_app`), API-118#403 and API-120#403 (`access_missing`, `access_other_app`, `no_kind`), API-119#403 (`access_missing`, `access_other_app`, `no_kind`, `user_only`), API-124#403, API-125#403 and API-127#403 (`user_only`, `access_missing`, `access_other_app`), an `opaqueredirect` reply or a `401` |
| SCR-114#gone | An address or a link names a comment or a proposal that is not on the server: "This comment is not on the server." or "This proposal is not on the server." at the top of the talk, with the stage's talk under it. One that is closed opens unfolded in the closed talk, with its state (SPEC-154). An entry removed while open: the same words in its place, and the talk reads again. A reflection that the server no longer holds, when the talk reads one that it no longer lists or the user dismisses one: "This reflection is not on the server." in its proposal's entry | API-114#404 (`comment_not_found`, `project_not_found`), API-115#404 (`proposal_not_found`, `project_not_found`), API-116#404 (`edit_not_found`, `project_not_found`), API-119#404, API-120#404 (`comment_not_found`), API-124#404, API-125#404 (`proposal_not_found`, `project_not_found`), API-127#404 (`edit_not_found`, `project_not_found`) |

Every state of the stage applies, with two of the talk's own: narrowed, the talk of one item, and gone, as on the panels of 0.2. The talk reads again when the page comes back into view and after each write; it does not update by itself (SPEC-150).

## Kinds of cases

| Kind | What the user sees |
| --- | --- |
| Access | The Worker's `403` and a sign-in that expired: SCR-114#permission. Accepting and dismissing need a person's own sign-in: `user_only` for the service token; the agent writes through the hub (FL-109) |
| Input | A comment or a reply up to 4,000 characters, kept in its box and in the browser's storage with its write ID until the server takes it; from 90 per cent, how many characters are left; an empty one or one of spaces is not sent (rule 5) |
| Target | A comment or a proposal that is not on the server: SCR-114#gone. A comment whose item a push removed: shown apart, still open (REQ-162). A stage key outside the 13: `400`; a part that the snapshot does not hold: `404` (SPEC-151) |
| State changes | A comment closed in another tab, a proposal no longer open, a reflection changed: SCR-114#stale. An entry that a session holds: "Taken by the agent at {time}", and the user's replies are still taken (SPEC-136) |
| Repeats | A write's button is disabled and says "Sending…" while it runs; a try after a lost reply sends the same write ID, so one result (SPEC-126) |
| Concurrency | The agent's replies and another tab's writes show when the talk reads again: after a write and when the page comes back into view (rule 6) |
| Limits | 2,000 comments in a project (REQ-116), with `comment_limit`; a comment's replies up to its limit, then a new comment; the closed talk 50 at a time; counts over 999 show as `999+` |
| Outside services | None: the talk's requests go only to the server (REQ-147) |
| Data exposure | Comments, replies and stage source text as text only (REQ-098, REQ-148); no identity but "User" or "Agent" (rule 11, REQ-163) |
| Empty and streamed answers | No talk: SCR-114#empty. No stream: the talk does not update by itself (SPEC-150) |
| Screen states | Every state at 390 and 1440 pixels in both themes, in [redesign.html](../../09-mockup/nexus/redesign.html#scr-114) |
| AI answers | None: NEXUS calls no AI model (REQ-121). The agent answers at its next work, which the talk says beside the box and in each entry of the agent's turn (hotspot 6 of stage 01) |

## Layout

| Region | Under 1,024 pixels, drawn at 390 | From 1,024 pixels, drawn at 1,440 |
| --- | --- | --- |
| The talk | The Talk tab, the whole width under the tabs | The side, 400 pixels wide; from 1,024 to 1,279 pixels, a panel over the stage's right edge (SCR-111) |
| The turn counts | Two halves under the heading, each 44 pixels high, which scroll the talk to their group | The same, in the side's head |
| The entries | Each a card across the width; its buttons on a row of their own, 44 pixels high | Each a card in the side; its buttons at its end |
| The box | Fixed at the bottom of the tab, above the system's bars, growing to 40 per cent of the height | Fixed at the bottom of the side, growing to 240 pixels |

## The design revision of 2026-11-11

What the design revision of 2026-11-11 adds to this screen or changes on it, planned and not built: its checkpoint passed on 2026-11-12 ([the review's map](../../reviews/2026-11-11-design-review.md), findings 1, 3 and 25). The sections above tell the talk as the redesign's checkpoint 3 passed it; TASK-276 builds it with the rows of this section, now that the revision's checkpoint has passed, and moves them into the sections above. The rows that said `open (D17)` are `planned`: the maintainer decided D17 on 2026-11-12 as recommended. The words are in [revision-words.md](revision-words.md), and the rules are those of [the design revision](README.md#the-design-revisions-screens).

### Data of the revision

| Data | Source | Status |
| --- | --- | --- |
| On each entry of the agent's turn, a comment or a pending reflection: whether the agent has not read it yet, `unread`, which the server works out from since when the entry waits and the space's last read (SPEC-189) | API-152, first from the page's data | planned |
| On a checkpoint request and on each of its entries that asks for the checkpoint: the thing to look at first, `look_first`, an item's ID or an `https` address; null for any other comment and for a request stored before the revision (SPEC-197, SPEC-198) | API-152, and API-114 for the replies | planned |
| The entry that the user picked, to open in the item's talk and to return to | The page's address after `#`: `talk=` beside `item=`; the place in the stage's whole talk stays in the page while it is open | planned |

### Actions of the revision

| Action | Result | Failure | Status |
| --- | --- | --- | --- |
| Open an entry that is on an item, or press its item's ID | The entry opens as now, and its item is selected in the stage ([rule 24](README.md#the-design-revisions-screens), SPEC-209): in the picture as SCR-112's revision says, in the list as SCR-113's. The side shows the item's panel with the talk narrowed to the item and that entry open and in sight (SCR-115, SCR-114#narrowed), and the address holds `talk={comment}` and `item={id}`, one step of the browser's history. The browser's back button, Close on the item, or "All talk of the stage" returns to the stage's whole talk with that entry in sight and the focus on it. An entry on the stage as a whole opens and selects nothing; an entry on a discrepancy selects the discrepancy's first item | The stage no longer holds the item, as for the entries shown apart: the entry opens, nothing is selected, and it says "{id} is no longer in this stage." (REQ-162). The picture is not current or not drawn, or the narrowed list does not hold the row: as SCR-112's and SCR-113's revisions say | planned |
| Stage record, on a checkpoint request's entry of my turn | The stage's record opens, with the request whole above the words box and the pass (SCR-112, SCR-113). It takes the place of "Pass as recommended" on such an entry and is drawn as its first, filled button: the talk itself passes no checkpoint. Reply stays on every entry, and a recommendation keeps "As recommended" | none | planned |
| Open the thing to look at first, on a checkpoint request's entry | An item's ID: the item's panel beside the stage, `#item={id}` (SCR-115), whichever stage of the project holds the item; the stage selects it where it holds it. An address: a new tab, without a referrer; the page itself never loads it ([rule 22](README.md#the-design-revisions-screens)) | SCR-115#gone for an item that no stage holds now | planned |

### States of the revision

| State | What the revision adds or changes | From responses | Status |
| --- | --- | --- | --- |
| SCR-114#normal | In the agent's turn, an entry that the agent has not read yet says "Not read by the agent yet" after "Waiting for the agent since {time}", and an accepted proposal whose reflection waits says it beside "Accepted, not yet reflected". An entry that a session took says "Taken by the agent at {time}" without the mark. An entry without the mark is only older than the agent's last read, which the workspace's head shows (SCR-111): the talk claims no more. In my turn, a checkpoint request's entry shows its whole text; "Look at first", a link with the item's ID or the address's host; and "Stage record" as its first button, with Reply. A request stored without the form shows as it is, without "Look at first". Both links are in the page as the server draws it. An entry whose item the stage no longer holds, once picked: "{id} is no longer in this stage." | API-152#200, API-114#200 | planned |
| SCR-114#narrowed | Reached from an entry too: the entry's item is selected in the stage, the talk shows the item's entries with the picked one open and in sight, and "All talk of the stage" or the browser's back button returns to the whole talk at that entry | API-152#200 with `item` | planned |
| SCR-114#error | `checkpoint_requested`, which only a checkpoint request gets, and the view sends none: its message above the box like any other code's, if it ever comes | API-118#409 and API-119#409 (`checkpoint_requested`) | planned |

The revision adds no state. A reading again that sends a query value out of its form is an error like any reading that fails, which SCR-114#error now names (API-152#400).

### Kinds of cases of the revision

| Kind | What the revision adds |
| --- | --- |
| Target | An entry whose item the stage no longer holds: picking it selects nothing, and the entry says so with the item's ID. A thing to look at first that no stage holds now: SCR-115#gone, with the search |
| State changes | The agent's newer request while the talk is open shows when the talk reads again, as a reply on the open request: a part's stage has one open request (SPEC-197) |
| Repeats | Opening the entry that is open already folds it, as now, and the item stays selected until the user closes it |
| Concurrency | The agent's read takes the marks away when the talk reads again; the talk does not update by itself (SPEC-150) |
| Limits | The mark is the server's `unread`, which the talk shows as given and does not work out; a request's text is at most ten lines and 1,200 characters, so it shows whole (SPEC-197); an address to look at first shows its host and what follows, cut after 120 characters |
| Outside services | A request's address to look at first opens only when the user presses it, in a new tab without a referrer, and the talk never loads it (REQ-147) |
| Data exposure | The mark tells the order of two times and names no session; the request's text and the address show as text (REQ-098) |
| Screen states | The marks of what the agent has not read and a checkpoint request's entry in grey at 390 and 1,440 pixels, in [revision-wireframes.html](revision-wireframes.html#scr-114); stage 09 draws them in the redesign's look |

### Layout of the revision

| Region | Under 1,024 pixels, drawn at 390 | From 1,024 pixels, drawn at 1,440 |
| --- | --- | --- |
| The mark of what the agent has not read | On the line of the entry's wait, after "Waiting for the agent since {time}", on a line of its own when both do not fit | The same |
| A checkpoint request's entry | The whole text; "Look at first" on a line of its own; then "Stage record" and Reply, each 44 pixels high | The whole text; "Look at first" on a line of its own; "Stage record" and Reply at the entry's end, "Stage record" first |
| The talk of an item that an entry selected | The Talk tab stays in front, narrowed to the item, with the picked entry open; the Item tab appears beside it | In the item's panel, under the trace, which the side scrolls to |
