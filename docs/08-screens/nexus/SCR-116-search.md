# SCR-116 Search

[한국어](SCR-116-search.ko.md)

Purpose: from the top of any page of the server, the user finds an item by its ID or the words of its title in every project, and opens it at its place in its project's workspace. (FL-118)

Path `{any page}#q={words}`, on the NEXUS server only, a field in the top bar of every page of the redesign (SCR-110 to SCR-115), which asks API-156. Who can see it: anyone Cloudflare Access lets in. Planned in the redesign of 2026-11-06 (SPEC-152). It takes in phase 1's search results (SCR-102), whose address `/#q={words}` opens it on the first page (SPEC-154). The rules of [every screen](README.md#every-screen) apply, with those of [the redesign](README.md#the-redesigns-screens).

## Data

| Data | Source |
| --- | --- |
| The words, as the user types them, from two characters | The field, and the page's address after `#`, `q=`, so that a search can be linked |
| Up to 20 matches across every stored snapshot: an exact ID first, then the items whose ID or title holds every word, case-insensitive, as the hub page's search matches (REQ-094); each with its project, part, stage, ID and title | API-156 |

## Actions

| Action | Result | Failure |
| --- | --- | --- |
| Type in the field | From two characters, after a pause of 250 milliseconds, the matches under the field; the words go into the address as `q=` | SCR-116#short, SCR-116#empty, SCR-116#error |
| Move with the arrow keys, then Enter, or select a match | The item at its place: `/p/{project}/{part}/{stage}#item={id}` in its project's workspace (SPEC-149, REQ-232) | SCR-115#gone on that page |
| Escape, or select outside the matches | The matches close; the words stay in the field | none |
| Full checks, when nothing matches | SCR-117 | SCR-117's own states |
| Under 1,024 pixels, the search button | The field opens over the top bar with the keyboard, and the matches fill the screen under it; Close returns to the page | none |

## States

| State | What the user sees and can do | From responses |
| --- | --- | --- |
| SCR-116#loading | "Searching…" under the field, while the earlier matches stay until the answer comes | API-156 while it runs |
| SCR-116#normal | "{n} matches for “{q}”", then the matches, each with its ID, its title as the source has it, and "{project} · {part} · {stage}" under it; an ID that several projects hold, once for each; the match under the arrow keys marked by the accent's bar. At 20 matches: "The first 20. Add a word to narrow it." | API-156#200 |
| SCR-116#short | One character: "Type at least two characters." and nothing is searched | none |
| SCR-116#empty | "Nothing matches “{q}”." with "Look in the full checks", which opens SCR-117 | API-156#200 with no match |
| SCR-116#error | The code's message under the field, with the trace ID and Try again; the words stay: `invalid_request`, `internal` and `method_not_allowed`. No connection, no answer in 30 seconds, `429` or `503`: rule 8, with the words kept | API-156#400 (`invalid_request`), API-156#default (`internal`, `method_not_allowed`) |
| SCR-116#permission | The code's message under the field. A sign-in that expired: [rule 7](README.md#every-screen), "Sign in again", which comes back to the same address with the words | API-156#403 (`access_missing`, `access_other_app`), an `opaqueredirect` reply or a `401` |

Every state of the stage applies but stale, with one of the search's own, short. Does not apply:

- Stale: the search asks the server each time the words change, and the matches are only links.

## Kinds of cases

| Kind | What the user sees |
| --- | --- |
| Access | The Worker's `403` and a sign-in that expired: SCR-116#permission |
| Input | From two characters to 200; the words are text, never markup (REQ-098); spaces at the ends are left out |
| Target | A match whose item a push removed meanwhile: SCR-115#gone at its place |
| State changes | None: each change of the words asks again |
| Repeats | Words typed quickly ask once, after the pause; an answer to older words than the field holds is dropped |
| Concurrency | None: the search only reads |
| Limits | 20 matches, the exact ID first; more needs more words |
| Outside services | None: the search asks only the server (REQ-147) |
| Data exposure | IDs and titles of stored snapshots only, which every page of the server already shows; no stage source text |
| Empty and streamed answers | No match: SCR-116#empty. No stream |
| Screen states | Every state at 390 and 1440 pixels in both themes, in [redesign.html](../../09-mockup/nexus/redesign.html#scr-116) |
| AI answers | None: NEXUS calls no AI model (REQ-121) |

## Layout

| Region | Under 1,024 pixels, drawn at 390 | From 1,024 pixels, drawn at 1,440 |
| --- | --- | --- |
| The field | Behind the search button; opened, it takes the top bar, with Close | In the top bar, 560 pixels wide, with the hint "Find by ID or words · e.g. REQ-107" |
| The matches | Under the field, the whole width and the rest of the height; each match at least 44 pixels high | A panel under the field, as wide as it, up to 70 per cent of the height, which scrolls inside |
