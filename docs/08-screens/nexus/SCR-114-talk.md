# SCR-114 Talk

[한국어](SCR-114-talk.ko.md)

Purpose: beside any stage of a project's workspace, the user reads the stage's comments and proposals by turn, what waits for the user first, then what waits for the agent, with whether a session took it, then the closed ones, folded; narrows them to a selected item; and leaves a comment on an item or on the stage as a whole, replies, settles a comment, marks it answered, and accepts or dismisses a proposal. (FL-117, FL-119)

Path `/p/{project}/{part}/{stage}#talk={comment}`, or the stage's page without it, on the NEXUS server only (API-154), in the side of the workspace (SCR-111). Who can see it: anyone Cloudflare Access lets in. Planned in the redesign of 2026-11-06 (SPEC-150, SPEC-151, with SPEC-126, SPEC-127, SPEC-131 and SPEC-133). It takes in the comment (SCR-107) and the proposal (SCR-108), whose addresses lead here (SPEC-154). The rules of [every screen](README.md#every-screen) apply, with those of [the redesign](README.md#the-redesigns-screens).

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
| SCR-114#error | A write that fails: its code's message above the box, with the text kept and Try again, which sends the same write ID: `invalid_request` by the field, as a stage key outside the 13; `cross_site` with a link to the page at the server's own address; `part_not_found` and `space_not_found`; `discrepancy_not_found` for a comment on a discrepancy resolved meanwhile, after which the talk reads again; `comment_limit` and `space_full`; `reply_limit`, with "Leave a new comment" that copies the text into the stage's box; `write_id_reused`, whose Try again makes a new write ID; `text_too_long` by the box, and `body_too_large`; `json_required`, `internal` and `method_not_allowed`. Reading again: "Could not update. What you see may be out of date." with Try again. Opening an entry: "Could not load this comment." or "Could not load this proposal." with Try again. No connection, no answer in 30 seconds, `429` or `503`: rule 8 | API-152#404 (`project_not_found`, `space_not_found`, `part_not_found`, `not_found`), API-152#default (`internal`, `method_not_allowed`), API-118#400 (`invalid_request`), API-118#403 (`cross_site`), API-118#404 (`part_not_found`, `discrepancy_not_found`, `project_not_found`, `space_not_found`), API-118#409 (`comment_limit`, `space_full`, `write_id_reused`), API-118#413 (`text_too_long`, `body_too_large`), API-118#415 (`json_required`), API-118#default (`internal`, `method_not_allowed`), API-119#400 (`invalid_request`), API-119#403 (`cross_site`), API-119#404 (`project_not_found`, `space_not_found`), API-119#409 (`reply_limit`, `space_full`, `write_id_reused`), API-119#413 (`text_too_long`, `body_too_large`), API-119#415 (`json_required`), API-119#default (`internal`, `method_not_allowed`), API-120#400 (`invalid_request`), API-120#403 (`cross_site`), API-120#409 (`write_id_reused`), API-120#default (`internal`, `method_not_allowed`), API-124#400, API-125#400 and API-127#400 (`invalid_request`), API-124#403, API-125#403 and API-127#403 (`cross_site`), API-124#409 (`reflection_limit`, `write_id_reused`), API-125#409 and API-127#409 (`write_id_reused`), API-124#default, API-125#default and API-127#default (`internal`, `method_not_allowed`), API-114#default, API-115#default and API-116#default (`internal`, `method_not_allowed`) |
| SCR-114#permission | A write refused: the code's message above the box, with the text kept: "This sign-in cannot write here. Check the Access policy." for `no_kind`; "Only you can do this, signed in yourself." for Accept, Dismiss and dismissing a reflection, which need a person's own sign-in (SPEC-116); `access_missing` and `access_other_app`. A sign-in that expired: [rule 7](README.md#every-screen), "Sign in again", with the text kept in its box and in the browser's storage | API-152#403, API-114#403, API-115#403 and API-116#403 (`access_missing`, `access_other_app`), API-118#403, API-119#403 and API-120#403 (`access_missing`, `access_other_app`, `no_kind`), API-124#403, API-125#403 and API-127#403 (`user_only`, `access_missing`, `access_other_app`), an `opaqueredirect` reply or a `401` |
| SCR-114#gone | An address or a link names a comment or a proposal that is not on the server: "This comment is not on the server." or "This proposal is not on the server." at the top of the talk, with the stage's talk under it. One that is closed opens unfolded in the closed talk, with its state (SPEC-154). An entry removed while open: the same words in its place, and the talk reads again. A reflection that the server no longer holds, when the talk reads one that it no longer lists or the user dismisses one: "This reflection is not on the server." in its proposal's entry | API-114#404 (`comment_not_found`, `project_not_found`), API-115#404 (`proposal_not_found`, `project_not_found`), API-116#404 (`edit_not_found`, `project_not_found`), API-119#404, API-120#404 (`comment_not_found`), API-124#404, API-125#404 (`proposal_not_found`), API-127#404 (`edit_not_found`, `project_not_found`) |

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
