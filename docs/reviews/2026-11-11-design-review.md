# The design review of 2026-11-11 and the design revision

[한국어](2026-11-11-design-review.ko.md)

This file is the public map of an independent review of the whole NEXUS design and of the revision that answers it. When this file and its Korean translation differ, this file is the source.

## What the review was

On 2026-11-11 the maintainer asked for an independent review of the whole NEXUS design before more was built: first whether the design itself is right, then whether the harness's rules were followed and what the build looks like. The review read every stage document at the head of the redesign's pull request (commit `fa4f042`), ran the repository's checks and the hub, opened the built screens and the mockups in a browser, and read the production server without writing to it. It found 41 points: 1 critical, 8 high, 17 medium, 11 low and 4 observations.

The review did not compare the Korean copies or the copies in the maintainer's records with the English sources, wrote nothing to production and pushed nothing. Its full text, with the evidence for each point, is in the maintainer's private records; this file carries one line for each point and where the design answers it.

## What the revision is

At 14:49 KST the same day the maintainer asked to fix everything that the design can answer, and to leave the building to a later builder. The design revision of 2026-11-11 therefore changes the stage documents only, stages 01 to 12 with the design of phase ② and of the redesign, and no code:

- Each stage that changes says so in its status paragraph and in its section for the checkpoint, with one line for each thing that changes for the maintainer and one thing to look at first.
- A new row is `active` when it stands on its own, and `open (Dn)` when it depends on one of the five decisions that the revision raised, D16 to D20 of stage 02. Each open decision has a recommendation and real alternatives, and the work goes on with the recommendation until the maintainer decides.
- A request that is designed and not built is in the API contract as planned, so the checks of the built server pass it over.
- Stage 10 turns the revision into tasks that a builder can follow as written, and stage 12 into the cases that judge them.
- The revision's own checkpoint has not passed. A checkpoint passes on the maintainer's own words only.

## The 41 points

The map grows with the revision: a stage's answers are added when the stage is fixed. Fixed so far: stage 01, stage 02. Still to come: stage 03, stage 04, stage 05, stage 06, stage 07, stage 08, stage 09, stage 10, stage 12, stage records, harness rules.

The state of a point is `fixed` when the stage documents answer it and only building is left, `open (Dn)` when its answer waits for that decision, `trial` when the two-week trial answers it, `operations` when it needs work on the server or on a session's settings, which needs the maintainer's own word, and `recorded` when it is kept as a record.

| No. | Severity | The point | Where the design answers it | State |
| --- | --- | --- | --- | --- |
| 1 | critical | The loop of pushing pictures and the agent reading comments did not run in real work, and no check caught it. | Stage 01: TERM-150, TERM-153. Stage 02: problem 15; REQ-270 to REQ-275; D16 with REQ-276 and REQ-277; the measure "The loop shows" | in progress: stage 03, stage 04, stage 05, stage 06, stage 08, stage 10, stage 12, harness rules left |
| 2 | high | The PRD's success measures, a two-week trial, were never measured, and the redesign and phase ② were designed on top. | Stage 02: the success measures say when the trial runs and with what; D20 puts it before the scope of phase ② | in progress: stage 10, stage 12 left |
| 3 | high | One press passes a checkpoint, and the pass carries nothing of what the user saw. | Stage 01: TERM-151. Stage 02: problem 16; D17 with REQ-278 to REQ-280 | in progress: stage 03, stage 04, stage 05, stage 06, stage 08, stage 10, stage 12 left |
| 4 | high | Checkpoints came bundled at a size that nobody can read, and all passed as recommended. | Stage 01: TERM-151. Stage 02: REQ-281, REQ-282 | in progress: stage 10, harness rules left |
| 5 | high | The core device of phase ②, reading what was drawn back as a list of changes, is not designed and was never tried, and D11's premise does not hold in the code. | Stage 02: the correction to D11; REQ-287, REQ-288; D20, the first prototype | in progress: stage 04, stage 10, stage 12 left |
| 6 | high | The work board of stage 01 is a second product inside phase ②, with no prototype. | Stage 02: D20, the second prototype and the two parts planned apart; the core of the editing phase | in progress: stage 10 left |
| 7 | high | Pictures show merged documents only, so a design that is being decided cannot be seen in NEXUS. | Stage 02: D18 with REQ-285 | in progress: stage 03, harness rules left |
| 8 | high | The release went ahead of acceptance. | Stage 02: D19 | in progress: stage 10, stage 12 left |
| 9 | high | QA asked whether the build matches the spec, not whether it can be used. | Stage 02: D19, the walk in a real browser and its impressions | in progress: stage 10, stage 12 left |
| 10 | medium | All 40 requirements of phase ② are Could, so the phase has no smallest scope. | Stage 02: the core of the editing phase | in progress: stage 12 left |
| 11 | medium | The middle column is narrow, so lists and pictures are cut off. | — | in progress: stage 08, stage 09, stage 10 left |
| 12 | medium | The picture screen is built before the screens for editing are designed. | — | in progress: stage 07, stage 09, stage 10 left |
| 13 | medium | A proposal comes as words only: the picture before and after cannot be seen. | Stage 02: the trial's question 1 | trial |
| 14 | medium | User flows and mockups are pictures in no phase. | Stage 02: the trial's question 2 | trial |
| 15 | medium | The backup of the data that only the server holds sits on the same machine, nothing exports it, and the service token can remove a project. | Stage 01: TERM-152. Stage 02: REQ-291 to REQ-293; the new wording of REQ-206 | in progress: stage 03, stage 04, stage 05, stage 06, stage 07, stage 08, stage 10, stage 12 left |
| 16 | medium | The user is anyone who signed in as a person, and a browser agent in the user's signed-in browser is not told from the user. | Stage 02: REQ-283, REQ-284; the open question on the server's owner | in progress: stage 04, stage 05, stage 06, stage 12 left |
| 17 | medium | Stage 06 of phase ② and of the redesign passed as prose, before the contract. | — | in progress: stage 06, stage 10 left |
| 18 | medium | Sentences from before the redesign remain, and two screens share one address. | Stage 01: sections 1 and 4; TERM-047. Stage 02: the goal and the scope | in progress: stage 03, stage 07 left |
| 19 | medium | Limits of the retired free plan, and two runtimes, still bind the design. | Stage 02: the open question on REQ-116 and REQ-124 | in progress: stage 04, stage 05 left |
| 20 | medium | A person cannot read the progress, and no notice comes when a stage passes. | — | in progress: stage 10, harness rules left |
| 21 | medium | Building went faster than anyone could review it. | Stage 02: REQ-282 | in progress: stage 10 left |
| 22 | medium | Production is two versions behind the design. | — | in progress: stage 10 left |
| 23 | medium | In phase ②, two edits in a row conflict by design. | Stage 02: REQ-286 | in progress: stage 04, stage 12 left |
| 24 | medium | No rule says how a workshop starts on a project that already has documents, or how a board is written back. | Stage 02: REQ-289, REQ-290 | in progress: stage 04, stage 10 left |
| 25 | medium | Nothing defines that choosing an item in the talk moves the picture to it. | — | in progress: stage 08 left |
| 26 | medium | The redesign's plan of tasks was not agreed on its own. | — | in progress: stage 10, harness rules left |
| 27 | low | The stage records hold where a checkpoint passed, and the user's words, only as summaries. | — | in progress: stage records left |
| 28 | low | 631 warnings of the hub have piled up and cannot serve as a signal. | — | in progress: stage 06, stage 10 left |
| 29 | low | Hygiene of the documents: words run together, statuses not moved on, sentences of the old Worker. | Stage 02: the spacing of REQ-124, REQ-149 and the decision of 2026-11-04 | in progress: stage 04, stage 05, stage 06 left |
| 30 | low | The 400 answers of three new requests are in no screen state. | — | in progress: stage 08 left |
| 31 | low | The screens were drawn in their final look, without the gray skeleton first. | — | in progress: stage 08 left |
| 32 | low | The switched-off button for editing shows on the main screen. | — | in progress: stage 08, stage 09 left |
| 33 | low | In the real snapshot, 10 of the 13 stages show as having no record. | — | in progress: stage 10 left |
| 34 | low | Some names are easy to confuse. | Stage 01: the notes of TERM-097, TERM-109, TERM-116 and TERM-136 | fixed |
| 35 | low | The evidence for the rows of phase 1, the hub, is in another repository, and two bugs are open. | — | in progress: stage 12 left |
| 36 | low | Six Must requirements are in no flow. | — | in progress: stage 03 left |
| 37 | low | Five finished tasks depend on tasks that are not finished. | — | in progress: stage 10 left |
| 38 | observation | The real channel of the work is the decision cards of the agent's session, and my turn is a second window on them. | Stage 02: the measure "A checkpoint in NEXUS"; the trial's question 4 | trial |
| 39 | observation | The door by which an agent comes in straight from a chat, an MCP server, was removed on 2026-10-24. | Stage 02: the trial's question 3 | trial |
| 40 | observation | The start of building was said four times and did not reach the maintainer. | — | in progress: stage 10, harness rules left |
| 41 | observation | The safeguard for a checkpoint passed as drawn shows only in phase ②. | Kept here as a record: stage 01 of phase ② carries the safeguard (hotspot 21), and the three checkpoints of 2026-10-24 for phase ① show none. | recorded |

## What the design cannot do by itself

- Sending from the sessions that have no profile: REQ-275 lets the hub work from a session's environment, and the environment's values, the server's address and the push list, are set by the maintainer or on the maintainer's word. The harness's rule that an agent never enables sending on its own stays.
- Pushing the two real projects again, and showing the redesign as built: both change what the maintainer's server holds or runs, so they wait for the maintainer's word (point 22).
- Deleting the old Worker and its D1 database: the decision of 2026-11-04 keeps them for 14 days after the switch and asks before the deletion. The limits that came from the free plan are derived again after it (point 19).
- The harness's own rules, such as how often the agent reads the to-do, what a checkpoint request holds and how a stage's passing is told: they live in the harness's repository and change there, in their own pull request, linked from stage 10.
