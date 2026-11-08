# SCR-110 Home

[한국어](SCR-110-home.ko.md)

Purpose: the user opens NEXUS on a phone or a PC and sees first what waits for their answer in every project, answers a proposal or the agent's recommendation in place or opens an entry at its place in the talk, sees how many entries wait for the agent and when the agent reads them, and opens a project from its card. (FL-117, FL-118)

Path `/`, on the NEXUS server only (API-155); every page's wordmark leads here. Who can see it: anyone Cloudflare Access lets in. Planned in the redesign of 2026-11-06 (SPEC-143 to SPEC-145, SPEC-154) and built by TASK-271 to TASK-273; the hub page, SCR-101, moved to `/hub` as SCR-117. The rules of [every screen](README.md#every-screen) apply, with those of [the redesign](README.md#the-redesigns-screens).

## Data

| Data | Source |
| --- | --- |
| The page: in `view-data` the answer of API-151, read when the page was served | API-155 |
| The view's code: its core file | API-104 |
| My turn: up to 50 entries with their total, each with its kind, a proposal or a comment that waits for the user, its project, part, stage and item, or the stage as a whole, the item's quote, the first 300 characters of the agent's last entry, when it was written, and what it asks: an answer in words, a recommendation or a checkpoint (`asks`) | API-151 (`my_turn`), first from the page's data |
| The agent to-do of each project with a space: how many comments wait for the agent, open discrepancies, pending reflections and checkpoints that wait for their records, and how many of them a session has taken | API-151 (`agent`) |
| A card for each project: its name, repository, the snapshot's commit and time; for each part, its current stage and next action; its 13 stages' states and item counts; its warnings; and for each picture its stage, whether it is current, its open comments and its small drawing, the server's first picture of it without labels | API-151 (`projects`) |
| The order of the cards: by name, or by the last push | The browser's storage, by name when it holds none; the server draws the cards by name, and the code draws them again in a stored order by the last push |
| 0.2's fragments on `/`: `#q={words}`, `#p={project}&id={id}` and `#p={project}&s={stage}`, which lead to the search, to the item in its stage at `#item={id}`, and to that stage of the project's first part. Until the search of SCR-116 is built (TASK-277), the search, and an ID that the server does not find, are the hub page's, at `/hub#q={words}` | The page's address after `#` (SPEC-154); the item's stage from API-157 |

## Actions

| Action | Result | Failure |
| --- | --- | --- |
| Accept or Dismiss on a proposal | The entry stays where it was, marked "Accepted" or "Dismissed", my turn's count drops, and the agent to-do reads again; the entry is gone when the page is loaded again ([choice 19](README.md#choices-this-stage-made), SPEC-131, SPEC-143) | SCR-110#stale, SCR-110#error or SCR-110#permission, with the entry kept |
| As recommended, on an entry whose agent offers a recommendation | The user's reply "As recommended" settles the comment, and the entry is marked "Answered as recommended" (API-159, choice 19) | As above |
| Pass as recommended, on a checkpoint that the agent asks for | The stage's checkpoint passes with the words "As recommended" and the comment's link, and the comment is settled; the entry is marked "Checkpoint passed. You can withdraw it in the stage record until it is recorded.", with a link to the stage's record (API-159, SPEC-139, choice 19) | As above; a part that the snapshot no longer holds: the entry opens in the talk instead (SPEC-143) |
| Reply, or Open | The stage's workspace with the talk at the entry, SCR-114, at `/p/{project}/{part}/{stage}#talk={comment}` | SCR-114's own states |
| Open a count of the agent to-do | The project's workspace at the stage of the count's oldest entry: the talk at that comment, `#talk={comment}`, for the comments; the list filtered to what is left, `#filter=left`, for the discrepancies and the reflections; and the stage for the checkpoints. A count without its oldest entry opens the project | SCR-111's own states |
| Open a project's card, or a small view of one of its pictures | The project's workspace at its current stage (SCR-111), or at that picture's stage (SCR-112) | SCR-111's own states |
| Change the cards' order | The cards by name or by their last push, remembered in the browser | none |
| Type in the search | SCR-116; until it is built (TASK-277), the field waits, shown disabled, and the hub page's search serves at `/hub` | SCR-116's own states |
| Full checks | SCR-117, at `/hub` | SCR-117's own states |
| Load again | The page from the server | SCR-110#error |

## States

| State | What the user sees and can do | From responses |
| --- | --- | --- |
| SCR-110#loading | The page as the server drew it from its data, in the layout of SCR-110#normal, so that nothing moves when the code runs: my turn, the agent to-do and the cards are text and links that work, Open included; the buttons that answer and the order's two buttons show disabled until the view's code runs, which adds what they do ([rule 15](README.md#the-redesigns-screens)); the times show in UTC, as the server writes them, until the code shows them in the browser's time zone in the same boxes | API-155#200, API-104#200 |
| SCR-110#normal | The top bar: NEXUS, All projects, the search field and Full checks. "My turn ({n})", or "50 of {n}", with "What the agent asked or proposed and waits for your answer": each entry with its kind as a word, Proposal, Question, Recommendation or Checkpoint, its project, part, stage and item ID with the item's title and quote, the quote alone when no item holds it, or "the stage as a whole", the agent's text, "Agent · {time}", and its buttons: Accept and Dismiss for a proposal; As recommended and Reply for a recommendation; Pass as recommended and Open for a checkpoint; Reply for a question. Under the list: "When you answer, it becomes the agent's turn. The agent reads it at its next work on the project." Beside or under it, "Agent to-do ({n})": each project's counts by list, "{n} taken by a session", and "The agent reads these when its work on the project next starts. The NEXUS server runs no AI." Then "Projects ({n})" with the order: each card with its name, repository, commit and time; "Now: {stage} {state}" and "Next: {next action}" for each part, or the words of REQ-103 when no progress is recorded; a small view of each picture with its stage, count and open comments, or "No picture yet"; the 13 stages as shapes with their words and their counts, "✓ 1 · ◐ 1 · ? 11", one row for each part; its items and warnings; and Open | API-155#200, API-151#200, API-124#200, API-125#200 and API-159#200 with `changed: true` |
| SCR-110#nothing-waits | My turn says "Nothing waits for your answer now." with "When the agent asks or proposes something, it gathers here."; the agent to-do and the cards show as in SCR-110#normal (SPEC-143) | API-151#200 with an empty `my_turn` |
| SCR-110#empty | No snapshot on the server: in place of my turn, the agent to-do and the cards, the words of SCR-101#empty, with the agent called AI in Korean ([choice 17](README.md#choices-this-stage-made)), what NEXUS shows and the four steps that push a project (SPEC-124, REQ-223), with no secret and no path; Full checks stays in the top bar | API-155#200 and API-151#200 with no project |
| SCR-110#stale | An entry answered in another tab or closed by the agent meanwhile: under the entry, "This no longer waits for your answer. It was answered or closed meanwhile." or, for a proposal, "This proposal is no longer open: it was {state}.", and the entry stays marked so until the page is loaded again, while my turn's count reads again. An answer that the server had already taken: "Done already, in another tab." and my turn reads again. A card's picture that is not current: its small view says "Not current" and why, as the hub page's link does (SPEC-123). Reading again with a newer push: the cards show its data, and a card says "Pushed again at {time}" until the page is loaded again | API-159#409 (`not_recommended`), API-124#409 (`proposal_not_open`), API-125#409 (`proposal_not_open`), API-124#200, API-125#200 and API-159#200 with `changed: false`, API-151#200 |
| SCR-110#error | The page's request: the message page of [rule 9](README.md#every-screen) with the code's message, the trace ID and Load again. Reading again: "Could not update. What you see may be out of date." in a bar under the top bar, with Try again, while the page stays usable. An answer that fails: its code's message under the entry, with the trace ID and Try again, which sends the same write ID; the entry stays in my turn: `invalid_request`; `cross_site` with a link to the page at the server's own address; `write_id_reused`, whose Try again makes a new write ID; `reflection_limit` for Accept, after which the proposal stays open; `reply_limit` and `space_full` for an answer as recommended, whose messages say what is full; `internal` and `method_not_allowed`. An entry that is no longer on the server, `proposal_not_found`, `comment_not_found`, `project_not_found` or `space_not_found`: its message, and my turn reads again. A checkpoint asked for on a part that the snapshot no longer holds, `part_not_found`: its message, with Open, which opens the entry in the talk. No connection, no answer in 30 seconds, `429` or `503`: rule 8 | API-155#default (`internal`, `method_not_allowed`), API-151#default (`internal`, `method_not_allowed`), API-124#400, API-125#400 and API-159#400 (`invalid_request`), API-124#403, API-125#403 and API-159#403 (`cross_site`), API-124#404 and API-125#404 (`proposal_not_found`, `project_not_found`), API-159#404 (`comment_not_found`, `project_not_found`, `space_not_found`, `part_not_found`), API-124#409 (`reflection_limit`, `write_id_reused`), API-125#409 (`write_id_reused`), API-159#409 (`write_id_reused`, `reply_limit`, `space_full`), API-124#default, API-125#default and API-159#default (`internal`, `method_not_allowed`) |
| SCR-110#permission | The page's request: the message page with the code's message. An answer refused because it was not sent with a person's own sign-in: "Only you can do this, signed in yourself." under the entry, which stays (SPEC-116, REQ-129, REQ-179); `access_missing` and `access_other_app` the same way. A sign-in that expired: [rule 7](README.md#every-screen), "Your sign-in has expired. Sign in again: what you wrote stays here." in a bar under the top bar, with Sign in again, which comes back to `/` | API-155#403 (`access_missing`, `access_other_app`), API-151#403 (`access_missing`, `access_other_app`), API-124#403, API-125#403 and API-159#403 (`user_only`, `access_missing`, `access_other_app`), an `opaqueredirect` reply or a `401` |

Every state of the stage applies, with two of the page's own: nothing-waits, an empty my turn on a server that holds projects, and empty, a server without a snapshot. The page has no editor, so a core file that does not load leaves the page as SCR-110#loading draws it, readable, with "The page's buttons could not load. Load the page again to answer here." in the bar.

## Kinds of cases

| Kind | What the user sees |
| --- | --- |
| Access | Access's own login page or refusal comes before the page; the Worker's `403` and a sign-in that expired: SCR-110#permission. Accept, Dismiss and both recommendations need a person's own sign-in (SPEC-116): `user_only` for the service token |
| Input | No text: answers are buttons, and an answer in words opens the talk (SCR-114). The search field is SCR-116's |
| Target | An entry whose comment, proposal or project is no longer on the server: its message, and my turn reads again. A checkpoint asked for on a part that the snapshot no longer holds: the entry opens in the talk. A project without a space has no counts in the agent to-do |
| State changes | An entry answered in another tab or closed by the agent: SCR-110#stale. A picture that is not current: its small view says "Not current" on one line, clear of its count; a small view of 90 pixels or less, on a screen of about 350 pixels or less, shows the flag's icon alone, and screen readers read its words |
| Repeats | While an answer is sent, its buttons say "Sending…" and are announced as disabled (`aria-disabled`), so that the focus stays on them, and a second press sends nothing; a try after a lost reply sends the same write ID, so the same answer twice leaves one result (SPEC-126) |
| Concurrency | Another tab's or the agent's writes show when the page reads again: after an answer, when the page comes back into view, and on Load again (rule 6) |
| Limits | My turn lists 50 entries of its total, "50 of 73", the oldest first in each group (SPEC-143); counts over 999 show as `999+`; the server holds 30 projects (REQ-116) |
| Outside services | None: the page loads its code, styles and fonts only from the server (REQ-147) and sends its requests only to it |
| Data exposure | The agent's last entry up to 300 characters, as text (REQ-098); no stage source text; no identity but "User" or "Agent" (rule 11) |
| Empty and streamed answers | No project: SCR-110#empty. Nothing waits: SCR-110#nothing-waits. A project without recorded progress: the words of REQ-103 on its card. A pictured stage without a picture: "No picture yet" in place of its small view. No stream |
| Screen states | Every state at 390 and 1440 pixels in both themes, as stage 09 drew them in the redesign's look, in [redesign.html](../../09-mockup/nexus/redesign.html#scr-110) |
| AI answers | None: NEXUS calls no AI model (REQ-121). The page says that the agent reads at its next work, so that it does not look like a chat that answers at once (hotspot 6 of stage 01) |

## Layout

| Region | Under 1,024 pixels, drawn at 390 | From 1,024 pixels, drawn at 1,440 |
| --- | --- | --- |
| The top bar | NEXUS, the search button, which opens the field over the bar, and Full checks in a menu | One line: NEXUS, All projects, the search field and Full checks |
| My turn | First, across the width; each entry stacked: its kind and place, the agent's text, "Agent · {time}", then its buttons on a row of their own | Left, two thirds of the width; each entry a row: its kind, then its place and text, then its time with its buttons |
| The agent to-do | Under my turn, across the width | Right of my turn, one third of the width |
| The projects | One card under another; in a card, the small views three in a row, and the 13 stages wrap | Two cards in a row, the column 1,200 pixels at most |
| The notices | Each a bar under the top bar, across the width | The same, above my turn |

On a screen that a finger selects, the links of the agent to-do take a line of 44 pixels, and so do an entry's place and the links under its answer, whose lines grow to it (rule 14). An entry's place keeps the project's title to two fifths of its line, cut with an ellipsis, and wraps under 1,024 pixels, so that the stage and the item stay readable.
