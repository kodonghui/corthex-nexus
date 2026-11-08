# SCR-117 Full checks

[한국어](SCR-117-full-checks.ko.md)

Purpose: the user looks at every project's 13 stages and their checks on one page, as the hub page shows them in NEXUS 0.2, from the first page's Full checks or from a search without a match. (FL-118)

Path `/hub`, on the NEXUS server only (API-101). Who can see it: anyone Cloudflare Access lets in. Planned in the redesign of 2026-11-06 (SPEC-153): the hub page of 0.2, SCR-101, moves here unchanged (REQ-233), with its own views at its own fragments, the search results, the trace view and the stage detail (SCR-102 to SCR-104). The hub page that the hub builds on a device stays as it is. The rules of [every screen](README.md#every-screen) apply.

## Data

| Data | Source |
| --- | --- |
| The page as the hub builds it: every project's 13 stages and their checks, the parts, the picture links and the counts (SPEC-122 to SPEC-125) | API-101, now at `/hub` |
| Its look | The tokens of stage 09, which the hub page's template takes in the core plugin's repository with the redesign (stage 09's notes for stage 10) |

## Actions

The hub page's own, as SCR-101 to SCR-104 define them. Its picture links lead through the redirects of SPEC-154 to the stages of the workspace (SCR-112), and its stage overview links to the list of the stage (SCR-113). The way back to the first page is the browser's back button or `/`: the page gets no new link, since it moves unchanged.

## States

| State | What the user sees and can do | From responses |
| --- | --- | --- |
| SCR-117#normal | SCR-101#normal, at `/hub`, in the redesign's look | API-101#200 |
| SCR-117#empty | SCR-101#empty: what the hub shows and the four steps that push a project (SPEC-124) | API-101#200 with no project |
| SCR-117#stale | SCR-101#stale | API-101#200 |
| SCR-117#error | SCR-101#error, whose message page leads on to all projects, `/`, as the workspace's does (SCR-111#error), since its way to the hub page would lead back to itself | API-101#default (`internal`, `method_not_allowed`) |
| SCR-117#permission | SCR-101#permission | API-101#403 (`access_missing`, `access_other_app`) |

As on SCR-101, loading does not apply: the page is one document that holds its data, and it draws at once. Its views keep their states, SCR-102 to SCR-104.

## Kinds of cases

As SCR-101's, at `/hub`. What changes: the address, the look, and where its picture and overview links end (SPEC-154). The page that the hub builds on a device is unchanged.

| Kind | What the user sees |
| --- | --- |
| Parts | As on SCR-101: the stages show the recorded states of the project as a whole, so a project that records only its parts, as NEXUS records its part nexus, shows "?" on each stage, and the Now and Next line of each part says where it stands. The workspace shows each part's states (SCR-111) |
| Screen states | Every state at 390 and 1440 pixels in both themes, in the redesign's look, in [redesign.html](../../09-mockup/nexus/redesign.html#scr-117) |

## Layout

As SCR-101's: one column of cards at 390 pixels, the column 1,200 pixels at most at 1,440.
