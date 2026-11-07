---
synced_at: 2026-10-24T22:44+09:00
---

# NEXUS: domain

[한국어](nexus.ko.md)

Stage 01 of CORTHEX's own project, for NEXUS: the `corthex-nexus` plugin and the server in [`nexus/`](../../nexus/). Status: steps 0 to 9 done on an event storming board, checkpoints 1 to 3 passed on 2026-10-24. Stage 02's scope check answered hotspots 2, 4, 8 and 13 on 2026-10-25. At the joint checkpoint of NEXUS's stages 03 to 08 on 2026-11-03, the maintainer approved writing the read model of Edit picture in CTX-010 as Picture view, the name in the glossary, since the board's table of read models already says what the view shows on an edit conflict (stage 07's change 3). On 2026-11-03 the maintainer also chose to hold stage 01's event storming in NEXUS: section 1 gained the exception of a work board to the principle about pictures, CTX-012 the step view, section 6 hotspot 14 and the glossary TERM-130 to TERM-134. These came from the maintainer's choice, not from the board, which keeps the steps of 2026-10-24; the work board's own steps are drawn when phase ② is designed (hotspot 14). The maintainer passed these changes as drawn the same day, at 16:54 KST, on a decision card in the project's thread ("모두 그린 대로 통과", pass all as drawn), together with the changes that the choice made to stages 02 to 09. This version replaces the draft of the same day, which started from the hub built in phase 1; the board started again from the maintainer's own words about what NEXUS is for. With the maintainer's redesign of 2026-11-06, whose checkpoint 1 passed at 17:44 KST that day on a decision card in the project's thread ("이대로 진행", go ahead as drawn) with talk on the items of every stage (choice ② A), CTX-014's purpose and rule and TERM-114 let a comment be on any stage's item or on a stage as a whole, and the glossary gains TERM-135 to TERM-138; the board keeps its steps, and its next change can add my turn as a read model. On the same card the maintainer also passed checkpoint 1 of phase ②'s frames, new frames for the contexts that phase ② changes (section 2): the timeline gains their lanes, section 6 hotspots 15 and 16, and the glossary TERM-145. Their checkpoint 2, after Steps 2 to 7, passed at 15:42 KST on 2026-11-07 on a decision card in the project's thread ("추천대로 통과", pass as recommended): the work board became a context of its own, CTX-016 Workshops (hotspot 14), and section 1 gains Cloudflare Access among the external systems, the timeline Sticky restored, section 3 CTX-016 and the aggregate Positions in CTX-012, section 4 the commands of phase ② with their actors, aggregates and rules, section 6 hotspots 17 to 21, and the glossary TERM-146 and TERM-147, while TERM-132 to TERM-134 move to CTX-016. Their checkpoint 3, after Steps 8 and 9, passed at 20:44 KST on 2026-11-07 on a decision card in the project's thread ("추천대로 통과", pass as recommended), which ends stage 01 for phase ②: section 4 gains phase ②'s two policies and its read models, with the read model of each of its command rows, the source of each rule of CTX-012 and an example for each of its key commands, section 5 the links of CTX-016 and the patterns toward external systems, section 6 hotspots 22 and 23, and the glossary TERM-148 and TERM-149, while TERM-091, TERM-111, TERM-120, TERM-121, TERM-132 and TERM-147 get new definitions. Stage 02's checkpoint for phase ②, with those of stages 03 and 04, passed at 23:27 KST on 2026-11-07 on a decision card in the project's thread ("추천대로 통과", pass as recommended): it answered hotspot 18 with D14 of stage 02 and hotspot 21 with the nine points of its review, so section 4 gains points 2 to 5 and 7 in the rules of CTX-010, CTX-012 and CTX-016, sections 4 and 5 make the candidate link of hotspot 18 a link, section 6 marks both hotspots answered, and TERM-149 gains changed and disconnected. When this file and its Korean translation differ, this file is the source.

This file holds the contexts and the glossary of NEXUS. Its IDs continue after those of CORTHEX-MEMORY in [memory.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/docs/01-domain/memory.md): contexts from CTX-006 and terms from TERM-047, the terms added with the board from TERM-109, after the ones that memory took up to TERM-108, those added with the functional spec from TERM-124, those of the maintainer's choice of 2026-11-03 from TERM-130, those of the redesign of 2026-11-06 from TERM-135, and those of phase ②'s frames from TERM-145. Contexts and terms that went away keep their IDs and are marked as removed. The terms that memory.md already defines keep their meaning here, such as Agent, Session, Project settings and Project list; where NEXUS uses a word differently, its glossary row says how.

Sources read:

- The maintainer's words of 2026-10-24 about what NEXUS is for, kept word for word in Step 0 of the board, and the decision of the same day to build NEXUS in stages.
- The event storming board, Steps 0 to 9, read at the time in `synced_at`, with the maintainer's answers at the three checkpoints. The board is private; its link is in the project's records.
- Phase ②'s frames, Steps 0 to 9, on a private page as published at 15:48 KST on 2026-11-07, with the maintainer's answers at their checkpoints 1 to 3. The page's link is in the project's records.
- The draft of this file (2026-10-24) and phase 1 as built: [`plugins/corthex-nexus/`](https://github.com/kodonghui/corthex/tree/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex-nexus), [`nexus/`](../../nexus/) and [docs/architecture.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/docs/architecture.md#project-hub), deployed on the maintainer's own address on 2026-10-24.
- The decision of 2026-10-24 that NEXUS builds no ERD editor and that new projects use ERD Editor for stage 05.
- The memory domain in [memory.md](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/docs/01-domain/memory.md), for the shared terms.

## 1. Service overview

NEXUS is where the user and the AI discuss a project's pictures. In the maintainer's words, translated: "What I had in mind for NEXUS is a place where, for each project, the AI and I collaborate on what we need to discuss, in pictures such as DDD (like Miro), ERD and SiteMap. If possible, I can edit them too. And it would be even better to have things like Notion and Jira all managed on one platform."

Priorities, in the order and tone of those words:

1. Discuss with the AI over pictures: required.
2. Edit the pictures directly: if possible.
3. Manage records and work items, such as Notion pages and Jira issues, in the same place: better still.

What only NEXUS does, since NEXUS builds only what existing tools cannot do:

- It draws the pictures from the stage sources in Git, so the pictures always match them.
- It joins the DDD board, the ERD and the sitemap by ID and finds where they disagree, such as an ERD table with no matching aggregate.
- It keeps all the pictures of a project in one place.

Pictures that the AI drafts and people correct were not by themselves a reason to build: Miro does that, as the board of this stage shows. The maintainer's words of 2026-11-03 widened this for stage 01's event storming, translated: "I meant to do it in NEXUS with all of Miro's features." So NEXUS 0.2 also shows the DDD board step by step, as the board's frames built it, and phase ② adds a work board, where the user and the agent hold the workshop itself. The work board starts with what event storming needs: stickies in the legend's colours, step frames, arrows, groups and comments, and a view of what changed since the agent last read it; voting, timers, presenting, files and export stay out (checkpoint 1 of phase ②'s frames, 2026-11-06). Unlike a board in another tool, it keeps the workshop in the same place and behind the same sign-in as the document's pictures, and the agent drafts on it through the hub, as it comments.

- In scope: a space of pictures for each project; discussion and editing by the user and the AI; keeping the pictures and the stage sources equal; checks across pictures; the DDD board step by step, and later stage 01's event storming on a work board; later, links to Notion and Jira.
- Out of scope: building Notion or Jira again (NEXUS links to them); building a picture editor from scratch (NEXUS embeds an open-source one); memory (CORTHEX-MEMORY).

The plan, decided on 2026-10-24: NEXUS is built in stages, phase ① discussion over pictures, phase ② editing with an embedded open-source editor and phase ③ links to Notion and Jira. The hub of phase 1 stays as each project's home page. Stages 01 and 02 decide what to build; building comes after the memory plugin. On 2026-11-03 the maintainer added stage 01's event storming to it: phase ① also shows the DDD board step by step, drawn from the stage 01 document, and phase ② adds the work board, on Excalidraw, for the user and the agent first. Team members' real-time work on it comes with team members; until then, team workshops stay on Miro.

Answers at checkpoint 1, the AI's recommendations as approved:

| Question | Answer |
| --- | --- |
| Which pictures | The DDD board, the ERD and the sitemap first; user flows and others later |
| Who uses NEXUS | The user and the AI first; sharing with team members later |
| Where the pictures come from | The stage sources in Git; the AI reflects edited pictures in them |
| Where discussion happens | Both: the AI answers comments on picture items at its next work, and long talks happen in the conversation |
| Phone | Viewing on a phone too; editing on a PC first |
| Notion and Jira | Linked, not moved: a link and its state, with each tool staying the source |

What follows from these answers, in every context:

- NEXUS draws the pictures; the AI does not. The one exception, from phase ②, is a work board, which is not a picture: on it the user and the agent place the stickies of stage 01's event storming themselves, and while the workshop runs, the board leads. At each of the workshop's checkpoints the agent writes the stage 01 document from it, and NEXUS draws the DDD board only from the document.
- The AI is an actor. It comes at its next work, reads what waits for it and answers; NEXUS never calls it.
- NEXUS never writes to Git. The AI reflects edits and decisions in the stage sources by pull request.
- Positions in a picture stay in NEXUS; only the content goes to the stage sources.

Actors and external systems:

- User: discusses, edits pictures on a PC, accepts or dismisses proposals and passes checkpoints, and from phase ② holds stage 01's workshop on a work board. At first the maintainer alone. A phone is not another actor: the same user views and comments there, and edits and holds workshops on a PC.
- Agent (TERM-002), the AI on the board: comments, proposes, records decisions and reflects edits, at its next work in a session; from phase ②, it also drafts a workshop's steps on the work board and writes the stage 01 document from it.
- Git repository (external): holds the stage sources. The agent writes decisions and stage states there, and from phase ② it opens there the pull requests of edits and of a workshop's stage 01 document; when another pull request changes that document during a workshop, the board and the document differ.
- Cloudflare Access (TERM-082, external): the sign-in in front of NEXUS. From phase ②, NEXUS takes who placed a sticky or left a comment from the kind of sign-in: the user's own, or the agent's service token through the hub.
- Session (TERM-003), the conversation on the board (external): where long talks happen; the agent writes down what was decided, and from phase ② the answers given there at a workshop's checkpoints.
- Notion and Jira (external, phase ③): the sources of records and work items.

Not external: the open-source editors that NEXUS embeds run inside its pages, a generic part that editing and workshops share, and the hub, through which the agent reaches the work board, is part of the product (Steps 2 and 7 of phase ②'s frames).

## 2. Event storming

- Board: private, with one frame per step; its link and the links of its frames are in the project's records.
- Frames: Step 0 (purpose and scope), 1-a (events), 1-b (timeline), one frame each for Steps 2 to 7, 8-a (policies and read models), 8-b (context map) and 9 (context tables).
- Way of working: draft and correct. The AI drafted each step from the maintainer's words; the maintainer answered at the checkpoints in the conversation and changed nothing on the board.
- Checkpoints, all passed on 2026-10-24 with the maintainer's approval of everything as drawn: 1, the purpose, the priorities, the six questions of Step 0, the 18 events and the five lanes; 2, the six contexts and the recommended answers to eight hotspots; 3, the five policies, the context map, the numbering and the 14 command rows.
- Material: the same board keeps, in a separate column, a first attempt that started from the hub of phase 1 instead of the maintainer's purpose. It stopped before step 8 and is not a source of this file.
- Phase ②: new frames for the contexts that phase ② changes, CTX-010 and CTX-012, and for the work board (hotspot 14), as stage 01 does when it adds to a product. On 2026-11-06 the AI drew Step 0, 1-a, with 21 events of which five were already in this file, and 1-b, with the lanes Editing directly (changed), Tidying positions and Holding a workshop on a work board (new), on a private page, since the board could not be opened from its session that day. Checkpoint 1 passed at 17:44 KST that day on the redesign's decision card ("이대로 진행", go ahead as drawn): approved as drawn, with no edits or comments on the page. The answers, all as the AI recommended: both guesses hold (hotspots 15 and 16); after an edit, NEXUS lists the changes against the picture that the edit started from, item by item (added, renamed, removed, connected), and the user checks the list and sends it with a one-line note; the agent's stickies go on the board at once, marked as the agent's and labelled sure, inferred or guessed, and a label goes when the user corrects or confirms its sticky; and beyond the five features of 2026-11-03, the work board gets only a view of what changed since the agent last read it.
- Phase ②, Steps 2 to 7: on 2026-11-07 the AI drew on the same page three external systems (Git repository, Cloudflare Access and Session), 20 commands of which 16 are new, with two transactions, the actors, the new aggregates Positions, Workshop and Sticky with their rules, and the contexts. Checkpoint 2 passed at 15:42 KST that day on a decision card in the project's thread ("추천대로 통과", pass as recommended), with no edits or comments on the page, so its command rows and aggregate rules wait for a review in stage 02 (hotspot 21). The answers, all as the AI recommended: the work board is a supporting context of its own, CTX-016 Workshops, since editing and a workshop give reflect, edit, what leads and the agent's part different meanings (hotspot 14); NEXUS keeps the edit draft on its server, one open draft for each picture, so that the user goes on editing on another PC (hotspot 17); a removed sticky is kept and can be restored, which adds Restore sticky and Sticky restored, while a board's whole version history stays out (hotspot 20); both guesses hold, so the user can end a workshop midway (hotspot 19) and a comment can be on a whole frame as well as on a sticky (hotspot 15); and the aggregate rules of CTX-012 hold as drawn. Steps 8 and 9 follow, with checkpoint 3 after Step 9.
- Phase ②, Steps 8 and 9: on 2026-11-07 the AI drew on the same page seven policies, two of them new, five read models, two of them new and three widened, the context map with three new links of CTX-016 and a candidate link for hotspot 18, and the tables of the five contexts that phase ② changes or touches, CTX-012 with every column, the source of each rule and an example for each key command. Checkpoint 3 passed at 20:44 KST on 2026-11-07 on a decision card in the project's thread ("추천대로 통과", pass as recommended), with no edits or comments on the page, so its policies, read models and links join the review in stage 02 (hotspot 21). The answers, all as the AI recommended: when the stage source changes after an edit is sent, only an edit draft becomes a conflict for the user to resolve, while a sent edit waits to be reflected and the agent puts it in if it fits the new document and asks again if not, as FL-111 drew (hotspot 22); a workshop's checkpoint records the board version that the user passed, the agent writes that version into the stage 01 document, and what changes after the pass goes to the next checkpoint, so the last checkpoint ends the workshop as it passes, as in SPEC-142's example (hotspot 23); the three inferences hold, namely the stage overview at a workshop's checkpoint, no policy for an edit conflict, and the patterns toward external systems; and the aggregate rules of CTX-012 hold, now with their sources. This ends stage 01 for phase ②. The review that hotspot 21 asked for passed with stage 02's checkpoint for phase ② at 23:27 KST on 2026-11-07, as recommended, and answered hotspot 18 too.

The timeline, one lane per flow. The events are in order, and "or" joins outcomes of which only one happens, the usual one first.

| Lane | What happens | Events |
| --- | --- | --- |
| Drawing pictures | When a stage source appears or changes, NEXUS draws the pictures and checks them against each other | Project space created → Stage source changed → Picture drawn, or Picture redrawn → Discrepancy found |
| Discussing together | Over the pictures, the user and the AI exchange comments and proposals and decide; long talks happen in the conversation | Comment left → Proposal made → Proposal accepted, or Proposal dismissed → Decision recorded → Comment resolved |
| Editing directly | The user edits a picture on a PC, and NEXUS keeps a draft; when the user sends it, the AI reflects it in the stage sources at its next work. If the stage source changed meanwhile, the user keeps the edit on the new picture or drops it | Edit draft saved → Picture edited, or Edit conflict found → Edit kept on the new picture, or Edit dropped → Edit reflected |
| Tidying positions | When the user only moves items, NEXUS keeps their positions and the stage sources stay as they are; the next layout starts from the positions kept, and a position goes when a redrawn picture no longer has its item | Positions kept → Positions dropped |
| Holding a workshop on a work board | The user and the AI hold stage 01's event storming on a work board, step by step, and at each checkpoint the AI writes the stage 01 document by pull request from the board version that the user passed; if another change reached the document meanwhile, the AI shows the difference and asks. Each step repeats the events from Step frame added on, with stickies, arrows, groups and comments mixed, and only Steps 1-b, 7 and 9 end with a checkpoint. A removed sticky can be restored; the workshop ends when its last checkpoint passes, or midway when the user ends it | Workshop started → Step frame added → Sticky placed → Sticky changed, or Sticky removed, or Sticky restored → Arrow drawn → Stickies grouped → Comment left → Agent read marked → Checkpoint passed → Board reflected, or Board difference found → Workshop ended |
| Closing a stage | When the discrepancies are resolved and the user checks, the stage is done | Discrepancy resolved → Checkpoint passed |
| Linking tools (candidate, phase ③) | Notion records and Jira work items are linked to the pictures, which show only their state; each tool stays the source | Record linked → Work item linked |

Left out, because they only read and change no data: picture opened, zoom and pan, space browsed, signed in. Changed by the answers at checkpoint 1: NEXUS draws the pictures, not the AI; and "Work item created" became "Work item linked", since work items are created in Jira. Left out of phase ②'s lanes for the same reason: editor opened; zoom, pan and fit; step chosen; list of changes viewed; undo and redo in the editor, which act only on the draft; and signing in. The agent's reading of the board changes data only by Agent read marked (hotspot 16), and at checkpoint 1 of phase ②'s frames "Board comment left" became Comment left (hotspot 15).

## 3. Bounded contexts and packages

Six contexts on the board, numbered at checkpoint 2: two continue the IDs of the draft (CTX-007 and CTX-010) and four are new (CTX-012 to CTX-015). The hub of phase 1 is kept as each project's home and was not redrawn. The package names of the new contexts are candidates, named here and not on the board. Phase ②'s frames add CTX-016 Workshops, numbered at their checkpoint 2 on 2026-11-07, and the aggregate Positions to CTX-012; Editing keeps the editing of pictures, from the edit draft on.

| Context | Type | Aggregates | Package |
| --- | --- | --- | --- |
| CTX-012 Pictures | core | Project space, Picture, Positions | `pictures` |
| CTX-013 Cross-checking | core | Discrepancy | `crosscheck` |
| CTX-014 Discussion | supporting | Comment, Proposal | `discussion` |
| CTX-010 Editing | supporting; the editor is generic | Edit | `editing` |
| CTX-016 Workshops | supporting, from phase ②; the editor is generic | Workshop, Sticky | `workshops` |
| CTX-007 Stage progress | supporting | Stage record | `progress`; phase 1 built its recording part in `corthex-hub` |
| CTX-015 Tool links | generic, a candidate for phase ③ | Tool link | `toollinks` |
| CTX-006 Reading | built in phase 1 | not drawn | `corthex-hub` |
| CTX-008 Overview | built in phase 1 | not drawn | `corthex-hub` and the server in `nexus/` |
| CTX-009 Sharing | built in phase 1 | not drawn | `corthex-hub` and the server in `nexus/` |

Removed, with its ID kept:

| ID | Name | Status | Why |
| --- | --- | --- | --- |
| CTX-011 | Assistant access | removed | The agent comes to NEXUS at its next work instead of NEXUS reaching assistants in chat clients; Discussion and Stage progress share what it was for. Confirmed at checkpoint 3 |

## 4. Context tables

Seven policies connect events to the commands they trigger; the last two came with Step 8 of phase ②'s frames. Four of them cross a boundary and appear in the dependencies.

| Policy | Crosses |
| --- | --- |
| When Project space created or Stage source changed, Draw picture | no |
| When Picture drawn, Cross-check pictures | from CTX-012 to CTX-013 |
| When Picture redrawn, Cross-check the open discrepancies again | from CTX-012 to CTX-013 |
| When Proposal accepted, Edit picture as proposed | from CTX-014 to CTX-010 |
| When Decision recorded, Close comment | no |
| When Picture redrawn, Drop positions | no, inside CTX-012 |
| When the last Checkpoint passed, End workshop | from CTX-007 to CTX-016 |

At checkpoint 2 of phase ②'s frames the policy that ends a workshop waited until the board of the last checkpoint was reflected; checkpoint 3 moved it to the pass itself (hotspot 23). An edit conflict has no policy: the picture view and the agent to-do compare document versions and show it.

Five read models are what an actor looks at before a command; Step 8 of phase ②'s frames added the work board view and the list of changes, and widened the other three. Stage progress (CTX-007) serves the agent to-do and the stage overview, Workshops (CTX-016) the work board view, and Editing (CTX-010) the list of changes.

| Read model | Shows | Read before |
| --- | --- | --- |
| Picture view | A picture with its comments, proposals and discrepancies on it; on an edit conflict, the user's edit over the new picture. From phase ②, also the edit draft and the positions kept; an edit draft from an older document version shows as an edit conflict over the new picture, and a sent edit whose picture changed since is only marked so (hotspot 22) | Leave comment, Accept proposal, Dismiss proposal, Edit picture; from phase ②, Save edit draft, Move items, Keep edit on the new picture, Drop edit |
| List of changes | The changes of an edit draft item by item, added, renamed, changed, removed, connected and disconnected, with its one-line note; once sent, it goes with the pending reflection, which the agent reads in the agent to-do | Edit picture, which sends the edit |
| Work board view | A part's step frames with their stickies, who placed them and their labels, arrows, groups and comments, the checkpoint boxes, the removed stickies folded away, and the board version with what changed since the agent read it. The user sees it on screen, and the agent reads it through the hub | Add step frame, Place sticky, Change sticky, Confirm sticky, Remove sticky, Restore sticky, Draw arrow, Group stickies, Leave comment, Mark board read, End workshop |
| Agent to-do | Open comments and discrepancies, and the pending reflections: edited pictures and accepted proposals. From phase ②, also the work boards changed since the agent read them, a workshop's passed checkpoints not yet reflected, and dropped edits whose pull request is open | Make proposal, Reflect in stage source; from phase ②, Reflect board |
| Stage overview | What is left in a stage: its open discrepancies, comments and pending reflections. At a workshop's checkpoint, also that frame's open hotspots, the agent's stickies that still carry a label and its open comments, and the user decides | Pass checkpoint |

Phase ②'s frames add, at their checkpoint 2, the commands of CTX-016 and new commands of CTX-012 and CTX-010, with their actors, aggregates and rules, and at their checkpoint 3 the read model of each of those rows, the source of each rule of CTX-012 and an example for each of its key commands.

The hub contexts, CTX-006, CTX-008 and CTX-009, come last: they are built and kept as each project's home, and the board did not redraw them.

### CTX-012 Pictures

Purpose: draw a project's pictures, the DDD board, the ERD and the sitemap, from its stage sources in Git, and show the DDD board also step by step, as its event storming built it (from 2026-11-03, TERM-131).

| Given by | Read model | Command | Aggregate | Events |
| --- | --- | --- | --- | --- |
| User, Agent | | Create space | Project space | Project space created |
| Policy: when Project space created or Stage source changed | | Draw picture | Picture | Picture drawn, Picture redrawn |
| User, on a PC | Picture view | Move items | Positions | Positions kept |
| Policy: when Picture redrawn | | Drop positions | Positions | Positions dropped |

- Aggregate rules: one project space for each project, bound to its repository (document: hotspot 1). One picture for each document version, always equal to it; the stage sources are the truth of every picture (document: this file, 2026-10-24). From phase ②, Positions holds a position for each item of a part's stage and never reaches the stage sources, and moving items only is not an edit (document: hotspot 3, REQ-172); when a redrawn picture no longer has an item that the picture before it had, its position goes, and the next layout starts from the positions kept (document: SPEC-119, SPEC-134); the position of an item that the picture before did not have, such as one that an edit added, stays, so that a redraw from a commit before the edit's reflection keeps it (document: stage 02's review of hotspot 21, REQ-246). An edit that adds items carries their positions under temporary names, and when the agent reports the reflection with the IDs that the stage source gave them, NEXUS keeps the positions under those IDs (document: hotspot 18, D14 of stage 02, REQ-247). Positions stay apart from the picture because a picture belongs to one document version, while positions outlast versions (inferred).
- Given–When–Then: Given the stage 01 document at commit B and positions kept for its items, When Draw picture runs, Then the picture equals commit B and its layout starts from the positions kept (SPEC-119, SPEC-134).
- Given–When–Then: Given the DDD board of commit B open on a PC 1280 pixels wide, When the user gives Move items on an aggregate, Then its position is kept under the item's ID and the stage sources stay at commit B (SPEC-134's example).
- Given–When–Then: Given positions kept for items A and B, When the picture is redrawn from a document without B and the policy gives Drop positions, Then B's position goes and A's stays (SPEC-134).
- External systems: Git repository. The stage sources come through the hub of phase 1.
- Links: the hub sends the snapshot (event); tells Cross-checking that a picture was drawn or redrawn (event); Editing asks for the picture to edit and its document version (call), and tells it the new IDs and positions of items added in an edit once reflected (event, hotspot 18, D14 of stage 02).
- Hotspots: 1 repositories per space (answered); 2 how the stage sources reach NEXUS (answered in stage 02: the hub on a device pushes them); 3 positions (answered: they stay in NEXUS); 18 positions of items added in an edit (answered in stage 02: kept under the IDs that the reflection gives them, D14).

### CTX-013 Cross-checking

Purpose: pair the items of the pictures by ID to find discrepancies, and see whether they are resolved.

| Given by | Read model | Command | Aggregate | Events |
| --- | --- | --- | --- | --- |
| Policy: when Picture drawn or Picture redrawn (CTX-012) | | Cross-check pictures | Discrepancy | Discrepancy found, Discrepancy resolved |

- Aggregate rules: only one discrepancy is open for each pair; it is resolved when a new cross-check no longer finds it.
- External systems: none.
- Links: follows Picture drawn and Picture redrawn of Pictures (event); Stage progress asks for the open discrepancies (call).
- Hotspots: 4 pairs to compare (answered in stage 02: by glossary term).

### CTX-014 Discussion

Purpose: the user and the agent exchange comments and proposals over the pictures and, from the redesign of 2026-11-06, over the items of every stage, and decide.

| Given by | Read model | Command | Aggregate | Events |
| --- | --- | --- | --- | --- |
| User, Agent | Picture view, Work board view | Leave comment | Comment | Comment left |
| Agent, at its next work | Agent to-do | Make proposal | Proposal | Proposal made |
| User | Picture view | Accept proposal | Proposal | Proposal accepted |
| User | Picture view | Dismiss proposal | Proposal | Proposal dismissed |
| Agent, as the user says | | Record decision | Comment | Decision recorded |
| User, Agent; policy: when Decision recorded | | Close comment | Comment | Comment resolved |

- Aggregate rules: a comment is attached to an item's trace ID, not to a position, so it follows the item when the picture is redrawn; from the redesign of 2026-11-06 the item may be in any stage, in its picture or in its list, and a comment may be on a stage as a whole (choice ② A); it closes when a decision is attached or it is answered. The agent makes a proposal, and only the user accepts or dismisses it; an accepted proposal waits to be reflected. On a work board (CTX-016) a comment is on a sticky, by the sticky ID that NEXUS gave it, or on a whole frame; it stays with that frame's sticky and does not follow its copies.
- External systems: Git repository, the stage sources that decisions go into; Session, for long talks, where the agent writes down what was decided.
- Links: tells Editing that a proposal was accepted (event); Stage progress asks for the open comments, those on stickies and frames too (call).
- Hotspots: 5 comments on a phone, 6 when the agent reads and 7 where decisions go (answered); 13 where the agent reads its to-do (answered in stage 02: through the hub); 15 comments on the work board (answered at checkpoints 1 and 2 of phase ②'s frames: the same comments, on a sticky or a whole frame).

### CTX-010 Editing

Purpose: the user edits pictures on a PC, and the agent reflects the edits in the stage sources at its next work. It was Structure editing, a candidate of the draft; the board brings it forward with an embedded open-source editor, which is generic.

| Given by | Read model | Command | Aggregate | Events |
| --- | --- | --- | --- | --- |
| User, on a PC, while editing | Picture view | Save edit draft | Edit | Edit draft saved |
| User, on a PC; policy: when Proposal accepted (CTX-014) | Picture view, List of changes | Edit picture | Edit | Picture edited, or Edit conflict found |
| User only | Picture view | Keep edit on the new picture | Edit | Edit kept on the new picture |
| User only | Picture view | Drop edit | Edit | Edit dropped |
| Agent, at its next work | Agent to-do | Reflect in stage source | Edit | Edit reflected |

- Aggregate rules: an edit is bound to the document version that its picture was drawn from. A newer version makes an edit draft a conflict, in which only the user keeps it on the new picture, edits it again or drops it; an edit already sent waits to be reflected, and the agent puts it in if it fits the new document and asks the user again if it does not (hotspot 22, FL-111). Until the user sends it, with its list of changes item by item and a one-line note, it is an edit draft, which NEXUS keeps on its server, one open draft for each pictured stage of a part, whatever document version it is on, since a redraw makes a new picture (stage 02's review of hotspot 21, REQ-240); once sent, it waits to be reflected. Moving items only is not an edit (Positions, CTX-012), and neither is zooming or panning. The user can also drop an edit that waits to be reflected; if its pull request is open, the agent closes it at its next work. It closes once it is in the stage sources, and so does an accepted proposal.
- External systems: Git repository, where the agent opens a pull request. The open-source editor is embedded in NEXUS, a generic part that CTX-016 uses too.
- Links: asks Pictures for the picture to edit and its document version (call), and tells it the new IDs and positions of items added in an edit once reflected (event, hotspot 18, D14 of stage 02); follows Proposal accepted of Discussion (event); Stage progress asks for the pending reflections and the dropped edits whose pull request is open (call).
- Hotspots: 8 which editor (answered in stage 02: Excalidraw and ERD Editor); 9 conflicts and 10 writing to Git (answered); 17 where the edit draft is kept (answered at checkpoint 2 of phase ②'s frames: on the NEXUS server); 18 positions of items added in an edit (answered in stage 02, with CTX-012: D14); 22 a sent edit whose document changed (answered at checkpoint 3 of phase ②'s frames: the agent puts it in if it fits and asks if not). The work board of hotspot 14 was placed here, with hotspot 16, until checkpoint 2 of phase ②'s frames gave it CTX-016.

### CTX-016 Workshops

Purpose: the user and the agent hold stage 01's event storming on a work board, step by step, and at each checkpoint the agent writes the stage 01 document from the board, which leads while the workshop runs. Apart from Editing since checkpoint 2 of phase ②'s frames (hotspot 14).

| Given by | Read model | Command | Aggregate | Events |
| --- | --- | --- | --- | --- |
| User, on a PC; Agent, when the user asks in the session | | Start workshop | Workshop | Workshop started |
| User; Agent, when it drafts first | Work board view | Add step frame | Workshop | Step frame added |
| User; Agent, through the hub, with its labels | Work board view | Place sticky | Sticky | Sticky placed |
| User; Agent, its own stickies only | Work board view | Change sticky | Sticky | Sticky changed |
| User only | Work board view | Confirm sticky | Sticky | Sticky changed |
| User; Agent, its own stickies only, once the user agrees to the list | Work board view | Remove sticky | Sticky | Sticky removed |
| User | Work board view | Restore sticky | Sticky | Sticky restored |
| User, Agent | Work board view | Draw arrow | Sticky | Arrow drawn |
| User, Agent | Work board view | Group stickies | Sticky | Stickies grouped |
| Agent, when it reads the board through the hub | Work board view | Mark board read | Workshop | Agent read marked |
| Agent, at each checkpoint | Agent to-do | Reflect board | Workshop | Board reflected, or Board difference found |
| Policy: when the last Checkpoint passed (CTX-007); User, to end it midway | Work board view | End workshop | Workshop | Workshop ended |

- Aggregate rules for Workshop: one open workshop for each part; at its start the user chooses its way of working, the AI's draft first or people first. Its frames follow the steps, each starting as a copy of the previous one, and only the last frame changes; the earlier ones stay as they were, to show how the model grew. The frame after a checkpoint's step comes only once that checkpoint has passed, and a passed frame no longer changes, so the agent writes the frames up to the checkpoint's step as they were passed and needs no copies of earlier versions (stage 02's review of hotspot 21, REQ-250, REQ-251). Each change to the board raises its board version (TERM-147), and the agent's reading and each reflection record the version they read. Its checkpoints come after Steps 1-b, 7 and 9, and only the user passes them, in NEXUS (CTX-007, D15 of stage 02); a checkpoint records the board version that the user passed, the agent writes that version into the stage 01 document, and what changes after the pass goes to the next checkpoint (hotspot 23). While it runs, the board leads, and NEXUS draws the DDD board only from the stage 01 document; once it ends, as its last checkpoint passes or midway, the board is read-only.
- Aggregate rules for Sticky: a sticky has one kind of the legend, who placed it and one frame. The agent's stickies carry its label, sure, inferred or guessed, until the user changes or confirms them; confirming only takes the label off, so its event is Sticky changed. The agent changes only its own stickies and removes them only once the user agrees to the list; to change the user's sticky, it asks in a comment on it. When both change the same sticky, the later change is refused. Arrows and groups join stickies of one frame, and the contexts of Step 7 are named groups too; Draw arrow also takes an arrow away, and Group stickies also ungroups and renames a group, under their events, as replies came without a command of their own (stage 02's review of hotspot 21, TERM-127). NEXUS gives each sticky an ID when it is placed and never reuses it; a copied sticky gets a new ID and keeps the ID, the author and the label of the sticky that it copies, so that the agent's copies never make the user's stickies the agent's (stage 02's review, REQ-269). A removed sticky is kept, folded away, until it is restored.
- Transactions: Add step frame makes the new frame and the copies of the previous frame's stickies, arrows and groups at once, or nothing; when the agent places a step's draft, its stickies, arrows and groups go in at once, or none if one is refused.
- Commands of other contexts that a workshop uses: Leave comment of CTX-014, on a sticky or a whole frame, and Pass checkpoint of CTX-007, after Steps 1-b, 7 and 9 only.
- External systems: Git repository, where the agent opens the stage 01 document's pull request with the board version, and where another pull request may change that document meanwhile; Cloudflare Access, whose kind of sign-in tells who placed a sticky; Session, where the answers at a checkpoint come.
- Links: Stage progress asks for what is left in a frame and for the board versions (call), and tells it that the last checkpoint passed (event); Cloudflare Access gives the kind of sign-in with each request (call), which NEXUS takes as it is (conformist). The agent reaches the board only through the hub, which the core repository extends for it.
- Hotspots: 14 a context of its own (answered at checkpoint 2 of phase ②'s frames: this one); 15 comments on the work board (answered, with CTX-014); 16 the board version that the agent read (answered at checkpoint 1: recorded); 19 ending a workshop midway and 20 bringing back a removed sticky (answered at checkpoint 2); 21 the rows, rules, policies and read models approved as drawn (answered by stage 02's review, with CTX-010 and CTX-012); 23 which board version a checkpoint writes (answered at checkpoint 3: the version passed).

### CTX-007 Stage progress

Purpose: gather and show what is left in a stage, so that the user passes its checkpoint. It was Progress, whose recording part phase 1 built.

| Given by | Read model | Command | Aggregate | Events |
| --- | --- | --- | --- | --- |
| User only | Stage overview | Pass checkpoint | Stage record | Checkpoint passed |

- Aggregate rules: only the user passes a checkpoint, a workshop's too, whose checkpoints come after Steps 1-b, 7 and 9 and are recorded here with the board version passed (hotspot 23).
- Read models it serves: the stage overview, for the user, and the agent to-do, for the agent.
- External systems: Git repository, where the agent writes the stage state.
- Links: asks Cross-checking, Discussion, Editing and Workshops what is left (four calls), and tells Workshops that the last checkpoint passed (event).
- Hotspots: 11 what remains (answered: it is shown together, and the user decides).
- Built in phase 1: `hub.py status` records a stage's state, its last checkpoint, its next action and review findings, in a status file on each device and outside every repository. A stage's state comes only from what was recorded, never from the files that exist; `done` needs a checkpoint and its date, and an AI recommendation, a read receipt or an edit time is not a checkpoint. On the board the agent writes the stage state to the Git repository; stage 02 decided that the stage records move into the project's repository, and that the hub reads a status file only while a project has none (D12).

### CTX-015 Tool links

Purpose: link Notion records and Jira work items to the items in the pictures, and show only their state. A candidate for phase ③.

| Given by | Read model | Command | Aggregate | Events |
| --- | --- | --- | --- | --- |
| User, Agent | | Link record | Tool link | Record linked |
| User, Agent | | Link work item | Tool link | Work item linked |

- Aggregate rules: a link and a state only; each tool stays the source.
- External systems: Notion, the source of records; Jira, the source of work items.
- Links: asks Notion and Jira for the state (calls).
- Hotspots: 12 reading their state (open, decided when the links are built).

### CTX-006 Reading

Purpose: turn the stage sources of each registered project into a snapshot of its trace items, their links and the checks, without changing anything. Built in phase 1; on the board, the hub reads the stage sources from Git and gives the snapshot to Pictures.

- Events: Snapshot built, Stage read, Stage not read, Files skipped, Check raised, Project refused, Snapshot cut
- Commands: Build snapshot
- Policies: Read only the projects in the project list, each only under its registered name. Read text only: never run a project's code, Git hooks or Git filters, and never write to a repository. An ID is defined only in the stage that creates its kind; anywhere else it is a mention. Skip files that look like secrets, and translations that define only their original's IDs. Keep file contents and local paths out of the snapshot, and redact secrets and email addresses. A check finds structure, not meaning: it is a lead, not a verdict. Never renumber an ID to clear a check.
- Actors: User, Agent, Hub
- Open questions: How the snapshot reaches Pictures was hotspot 2, which stage 02 answered (D8). From the draft: should the hub read a stage whose truth is a human view, such as a Notion database, from that tool, or only from a text copy as now? Should it read results that are not stage sources, such as test runs for `12-qa` or the state of tasks for `10-wbs`?

### CTX-008 Overview

Purpose: show every project on one page, so that the user sees where each one stands, follows any ID through the stages and opens the tool behind each stage. Built in phase 1 and kept as each project's home page.

- Events: Hub page built, Hub page opened, Trace followed, Human view opened
- Commands: Build hub page, Open hub page, Trace ID, Search items
- Policies: One page for all registered projects, the same on a device and on the server. Each project shows its current stage and next action first. Link to each stage's human view instead of rebuilding the tool. Show text only as text, and load nothing from the network. Follow the profile's language and the system's light or dark mode. Leave off projects that are no longer in the project list.
- Actors: User, Viewer
- Open questions, from the draft: What should the first screen on a phone show? What should a viewer see before any project has been pushed? Which summaries of single stages are worth a place, such as the API list of `06-api`, the progress of tasks in `10-wbs` or the test results of `12-qa`? Should the page show what changed since the viewer's last visit, and link the project's records? Should it show memory's current state of each project?

### CTX-009 Sharing

Purpose: put the hub on an address of the user's own, so that it opens on any device, while nothing leaves a device unless the user sends it and only allowed people can open it. Built in phase 1 and deployed on 2026-10-24.

- Events: Push previewed, Snapshot pushed, Snapshot stored, Snapshot refused, Project removed, Request refused, Viewer signed in
- Commands: Preview push, Push snapshots, Remove project, Sign in
- Policies: Nothing leaves a device until the user pushes. Push only the projects in the push list, and ask before the first push of each project. Read the service token only from the environment, and never write or show it. Follow no redirects, so that a refused token is reported instead of sent on. The server answers only requests that Cloudflare Access checked, at the address the user set and nowhere else. It keeps only the newest snapshot of each project and nothing but snapshots. It has no AI and no rights on any repository. Remove a project only with the user's go-ahead.
- Actors: User, Agent, Hub, NEXUS server, Cloudflare Access, Viewer
- Open questions: Whether a push follows each change on its own was part of hotspot 2: under D8 of stage 02 the agent pushes after each merge of stage work and each checkpoint. From the draft: should the server keep earlier snapshots, so that the page can show changes over time? Team members come later (checkpoint 1); how would Cloudflare Access tell their projects apart?

## 5. Dependencies between contexts

On the board a solid arrow is a call (sync) and a dashed one an event (async), and each leaves the side that asks or tells. The agent is an actor, not a context, so it is not on the map: it reads the agent to-do, gives commands to Discussion and Editing, and opens pull requests on Git. No calls run in a circle. Step 8 of phase ②'s frames redrew the map: three new links with CTX-016, more data on two links of Stage progress, and a candidate link for hotspot 18, which stage 02 made a link (D14). The links of the hub and of CTX-016 with external systems name their pattern in the Why column; those of CTX-015 wait for phase ③.

| From | To | Kind | Why | Data |
| --- | --- | --- | --- | --- |
| Hub (CTX-006) | Git repository | call (sync) | Read the stage sources; anticorruption layer: the hub turns them into a snapshot, so that NEXUS never reads Git's own form | stage sources |
| Hub (CTX-006, CTX-009) | CTX-012 | event (async) | Draw from the new snapshot, which the hub on a device pushes (hotspot 2, D8 of stage 02) | snapshot |
| CTX-012 | CTX-013 | event (async) | Cross-check what was drawn | Picture drawn, Picture redrawn |
| CTX-014 | CTX-010 | event (async) | Edit the picture as proposed | Proposal accepted |
| CTX-010 | CTX-012 | call (sync) | Edit the picture that the user sees | the picture and its document version |
| CTX-010 | CTX-012 | event (async) | Keep the positions of items added in an edit: hotspot 18, as stage 02 decided (D14) | Edit reflected, with the new items' IDs and the positions kept under their temporary names |
| CTX-007 | CTX-013 | call (sync) | Gather what is left | open discrepancies |
| CTX-007 | CTX-014 | call (sync) | Gather what is left | open comments, those on stickies and frames too |
| CTX-007 | CTX-010 | call (sync) | Gather what is left, and the agent to-do | pending reflections, and dropped edits whose pull request is open |
| CTX-007 | CTX-016 | call (sync) | Gather what is left before a checkpoint, and the agent to-do | what is left in a frame (open hotspots, the agent's stickies that still carry a label) and the board versions passed, reflected and read by the agent |
| CTX-007 | CTX-016 | event (async) | End the workshop (hotspot 23) | the last Checkpoint passed |
| Cloudflare Access | CTX-016 | call (sync), with each request | Tell who placed a sticky or left a comment; conformist: NEXUS takes the sign-in as Access gives it | the kind of sign-in: the user's own, or the hub's service token |
| CTX-015 | Notion | call (sync) | Show a record's state; the permissions are hotspot 12 | state |
| CTX-015 | Jira | call (sync) | Show a work item's state; the permissions are hotspot 12 | state |

## 6. Hotspots

The answers to eight hotspots are the AI's recommendations, approved at checkpoint 2. Number 13 was added at step 8. Stage 02 answered numbers 2, 4, 8 and 13 with its decisions D8, D10, D11 and D9, which the maintainer approved at its scope check on 2026-10-25. Number 14 came with the maintainer's choice of 2026-11-03, and numbers 15 and 16 with Step 1-a of phase ②'s frames, whose checkpoint 1 answered them on 2026-11-06. Numbers 17 to 20 came with Step 4 of those frames; their checkpoint 2 answered 14, 17, 19 and 20 on 2026-11-07. Number 21 kept what that checkpoint approved as drawn for stage 02 to review, and what checkpoint 3 approved as drawn joined it; stage 02's checkpoint for phase ② answered 18 and 21 on 2026-11-07. Numbers 22 and 23 came with Step 8 of those frames, and their checkpoint 3 answered them on 2026-11-07.

| Hotspot | Context | State | Answer or next step |
| --- | --- | --- | --- |
| 1. Repositories per space: what about a project with two repositories? | CTX-012 | answered | One repository per project space at first |
| 2. How the stage sources reach NEXUS once they are merged | CTX-012 | answered | The hub on a device pushes snapshots that carry what the pictures show (stage 02, D8) |
| 3. Positions: the layout is automatic; should moved positions reach the stage sources? | CTX-012 | answered | Positions stay in NEXUS; only the content goes to the stage sources |
| 4. Pairs to compare: which items of the DDD board and the ERD, and of the DDD board and the sitemap? | CTX-013 | answered | By glossary term: each aggregate with its ERD tables, and each read model with its sitemap screens (stage 02, D10) |
| 5. Comments on a phone | CTX-014 | answered | Comments work on a phone too; only editing pictures needs a PC |
| 6. When the agent reads new comments | CTX-014 | answered | At the start of its work, open comments first; anything urgent goes in the conversation |
| 7. Where decisions go | CTX-014 | answered | As the current rules say: specs in Git, the user's choices in the records |
| 8. Which open-source editor, such as Excalidraw, ERD Editor or draw.io | CTX-010 | answered | Excalidraw for the DDD board and the sitemap, and ERD Editor for the ERD (stage 02, D11) |
| 9. Conflicts: what if the stage source changes during an edit? | CTX-010 | answered | The edit is shown again over the new picture, and the user chooses |
| 10. Writing to Git: does NEXUS write to Git itself? | CTX-010 | answered | No: the agent opens a pull request at its next work |
| 11. What remains: can a stage pass with open discrepancies or comments? | CTX-007 | answered | They are shown together, and the user decides |
| 12. Reading the state of Notion and Jira: with what permissions? | CTX-015 | open | Decided when the links are built, in phase ③ |
| 13. Where the agent reads its to-do: the hub on a device, an API of the server or another way? | CTX-014, CTX-007 | answered | Through the hub, which reads it from the server's API with the service token (stage 02, D9) |
| 14. The work board of phase ②: a context of its own, or part of Editing? Its aggregates, commands and events, how the agent places stickies and reads the board, and team members' real-time work | CTX-016, CTX-010 | answered | A supporting context of its own, CTX-016 Workshops, with the aggregates Workshop and Sticky (checkpoint 2 of phase ②'s frames); the agent places stickies and reads the board through the hub. Team members' real-time work comes with team members |
| 15. Board comments: is a comment on the work board the same as a comment on a picture, and where does it attach, since a sticky has no trace ID? | CTX-014, CTX-016 | answered | The same comment, so that the agent to-do, comments on a phone and replies work as they do, written as Comment left: on a sticky, by the sticky ID that NEXUS gives it (Step 6), or on a whole frame (checkpoint 2) |
| 16. Does NEXUS record the board version that the agent last read? | CTX-016 | answered | Yes, so that the user sees what changed since then; the agent's reading is recorded as Agent read marked |
| 17. Where is the edit draft kept: on the NEXUS server, or only in the browser where the user edits? | CTX-010 | answered | On the NEXUS server, one open draft for each picture, so that the user goes on editing on another PC and keeps it through a reload, a lost connection or an expired sign-in; a later save from a second window is refused, and stage 04 sets how an old unsent draft is shown. Stage 02's review made it one open draft for each pictured stage of a part, across document versions (REQ-240) |
| 18. Positions of new items: positions are kept by trace ID, but an item added in an edit has none until it is reflected | CTX-012, CTX-010 | answered | As recommended, by stage 02's checkpoint for phase ② (D14): the edit carries the new item's position under a temporary name, and when the agent reports the reflection with the new ID, NEXUS keeps the position under that ID (REQ-247, SPEC-175) |
| 19. What if the user ends a workshop midway? | CTX-016 | answered | As guessed: the user can end it, the board stays read-only and the stage 01 document stays as reflected at the last passed checkpoint; to hold it again, the user starts a new workshop from Step 0 |
| 20. Should a removed sticky be brought back? | CTX-016 | answered | Yes: since the agent removes stickies too, a removed sticky is kept, folded away, and the user restores it (Restore sticky, Sticky restored); a board's whole version history, as in Miro, FigJam and Excalidraw+, stays out |
| 21. Approved as drawn: the command rows and aggregate rules of phase ②'s frames passed checkpoint 2, and their policies, read models and links checkpoint 3, with no edits or comments on the page | CTX-010, CTX-012, CTX-016 | answered | Stage 02 read them again with the requirements of editing and the work board and raised nine points, which its checkpoint for phase ② passed as recommended on 2026-11-07: points 2 to 5 and 7 are now in the rules of CTX-010, CTX-012 and CTX-016, point 8 in TERM-149, and the others in the requirements (REQ-172, REQ-255, REQ-262) |
| 22. When the stage source changes after an edit is sent, who decides? FL-111 drew that the agent puts it in if it fits and asks again if not, while SPEC-134 shows an edit from an older version as a conflict for the user | CTX-010 | answered | Only an edit draft becomes a conflict, for the user to keep on the new picture, edit again or drop. A sent edit waits to be reflected: the agent puts it in if it fits the new document and asks again if not, as FL-111 drew. Stage 04 of phase ② narrows SPEC-134's conflict rule to edit drafts |
| 23. Which board version does the agent write into the stage 01 document at a checkpoint? SPEC-142's example makes the board read-only when the last checkpoint passes, while FL-116 ends the workshop after the agent's reflection | CTX-016, CTX-007 | answered | The version that the user passed: a checkpoint records it, the agent writes it, and what changes after the pass goes to the next checkpoint, so nothing reaches the document without the user's pass. The last checkpoint ends the workshop as it passes, and stage 03 of phase ② corrects FL-116 |

Stage 02 also took up, beyond the hotspots:

- Where NEXUS keeps spaces, pictures, comments, proposals and edits, and how the agent and the hub reach them, together with hotspots 2 and 13.
- How the stage state that the agent writes to Git meets the status file of phase 1 (CTX-007).
- The screens: the picture view on a phone, for viewing and comments, and on a PC, for editing; and how the hub page leads to each project's pictures.
- The open questions kept from the draft under CTX-006, CTX-008 and CTX-009.

## 7. Glossary

| ID | Term | Definition | Context | Avoid |
| --- | --- | --- | --- | --- |
| TERM-047 | NEXUS | The part of CORTHEX where the user and the agent discuss each project's pictures, drawn from its stage sources, and edit them, with the hub as each project's home; it also shows the DDD board step by step, and later holds stage 01's event storming on a work board and links records and work items. Made of the `corthex-nexus` plugin and the NEXUS server | all | hub (one of its parts) |
| TERM-048 | Hub | The `corthex-hub` skill and its script `hub.py`, which read projects, record progress, build the hub page and push snapshots on a device. Built in phase 1 and kept as each project's home | CTX-006, CTX-007, CTX-008, CTX-009 | NEXUS (the whole), dashboard |
| TERM-049 | Device | A computer where the user runs a host and the hub, with its own project list, checkouts and status files. A cloud session runs on a device whose files are lost when the session's container is reclaimed | all | machine, computer |
| TERM-050 | Project (NEXUS) | A project in the project list together with the other repositories that its settings name under `repos`, read and shown as one. For memory (TERM-005), a project is the repository that a session runs in | CTX-006, CTX-008, CTX-009, CTX-012 | workspace (its page, TERM-136), repo |
| TERM-051 | Registered name | The name of a project in the project list; the hub reads and pushes a project only under that name | CTX-006, CTX-009 | |
| TERM-052 | Checkout | A local copy of one of a project's repositories, listed for the project in the project list | CTX-006 | clone |
| TERM-053 | Stage | One of the 13 steps of the CORTHEX workflow, from `01-domain` to `13-presentation`, each with its six-slot contract | CTX-006, CTX-007, CTX-008 | phase (TERM-097), step |
| TERM-054 | Stage source | The text in a repository that a stage writes and later stages read, set as the stage's `source` in the project settings. The board calls it the stage document; NEXUS draws its pictures from the stage sources in Git | CTX-006, CTX-012, CTX-010 | source alone (TERM-018 uses it for a quote's place) |
| TERM-055 | Human view | Where people look at and edit a stage's work, such as Notion, Miro or ERD Editor, set as the stage's `human` | CTX-006, CTX-008 | tool, UI |
| TERM-056 | Truth | Which side wins when a stage source and its human view differ: `source` or `human`. For the pictures of NEXUS, always the stage sources | CTX-006, CTX-012, CTX-010 | master, primary |
| TERM-057 | Text copy | A stage source refreshed from a human view that is the truth; it records when it was copied | CTX-006 | export, mirror |
| TERM-058 | Trace ID | An ID that a stage creates for an item, made of a prefix for its kind, a hyphen and digits; later stages name it, and it is never reused or renumbered | all | key, number |
| TERM-059 | Item | A trace ID where it is defined, with its title, its fields and its place (file and line) | CTX-006, CTX-008, CTX-012 | record, entry, node |
| TERM-060 | Definition | The one place in the stage sources that creates an item | CTX-006 | declaration |
| TERM-061 | Mention | An ID written anywhere but in its definition | CTX-006 | reference |
| TERM-062 | Link | A connection between two items, made by a mention inside a definition; it counts in both directions | CTX-006, CTX-008 | relation, edge |
| TERM-063 | Check | A finding about how a project's items connect, with a level (`error`, `warn` or `info`) and the IDs concerned; a lead, not a verdict | CTX-006, CTX-007, CTX-008 | verdict, lint |
| TERM-064 | Check rule | A named rule of the hub that raises checks, such as `duplicate-id` | CTX-006 | |
| TERM-065 | Snapshot | What one reading of a project saved: its items, links, checks, stage settings and recorded progress, without file contents or local paths | CTX-006, CTX-008, CTX-009, CTX-012 | export, backup, dump |
| TERM-066 | Redaction (hub) | Replacing secrets and email addresses in a snapshot's titles and fields with `[redacted]`, and leaving out a link that holds one. Memory's redaction (TERM-010) works on conversation text before it is written | CTX-006 | masking |
| TERM-067 | Stage state | A stage's recorded progress: `done`, `in_progress`, `not_started` or `skipped`, and `unknown` while nothing is recorded | CTX-007, CTX-008 | status, progress |
| TERM-068 | Checkpoint | A stage's human checkpoint as recorded: what was approved, by whom and where, with its date | CTX-007 | approval, sign-off |
| TERM-069 | Next action | The step that a stage's record names as next | CTX-007, CTX-008 | task, to-do (TASK is the trace ID of `10-wbs`) |
| TERM-070 | Review finding | A check that a person or an agent recorded after reading the sources, such as a spec that contradicts its requirement | CTX-007 | comment |
| TERM-071 | Status file | The file on a device with a project's recorded stage states, checkpoints, next actions and review findings, outside every repository; where phase 1 keeps the stage records | CTX-007 | progress file |
| TERM-072 | Records | The project's place for meetings, decisions and progress notes, set as `records` in the project settings, such as a Notion database | CTX-007, CTX-008, CTX-014, CTX-015 | log, notes |
| TERM-073 | Hub page | The one page with every registered project's stages, checks and items: built on a device, or served by the NEXUS server | CTX-008 | dashboard, site |
| TERM-074 | Trace view | The part of the hub page that shows, for one ID, what it comes from and what it leads to through the stages | CTX-008 | graph, map |
| TERM-075 | Viewer | A person who opens the hub page: on a device, the user; on the server, anyone that Cloudflare Access lets in | CTX-008, CTX-009 | visitor |
| TERM-076 | NEXUS server | The user's own server that keeps pushed snapshots and serves the hub page behind Cloudflare Access; in phase 1 a Cloudflare Worker with a D1 database, deployed by the user | CTX-009 | cloud, backend, sync remote (TERM-033) |
| TERM-077 | Push | Sending saved snapshots from a device to the NEXUS server | CTX-009 | sync (memory's CTX-004), upload |
| TERM-078 | Push list | The projects that a device may push, listed in the profile | CTX-009 | allowlist |
| TERM-079 | Dry run | Showing what a push would send, without sending it | CTX-009 | test push |
| TERM-080 | Removal | Deleting a project and its snapshot from the NEXUS server; the project's sources and the device's files stay | CTX-009 | purge (TERM-036) |
| TERM-081 | Server revision | How many snapshots of a project the NEXUS server has stored | CTX-009 | version |
| TERM-082 | Cloudflare Access | The sign-in in front of the NEXUS server; the server answers only the requests that it checked | CTX-009 | login, auth |
| TERM-083 | Service token | The Cloudflare Access credential that a push uses, read from environment variables | CTX-009 | API key, password |
| TERM-084 | Allowed people | The people that an Access policy lets open the NEXUS server; for one person, their own account | CTX-009 | users, members |
| TERM-085 | Picture | A diagram that NEXUS draws from a stage source, such as the DDD board, the ERD or the sitemap: one for each document version, always equal to it. Its nodes are items, so comments, discrepancies and tool links attach to their trace IDs, not to positions. A work board (TERM-133) is not a picture | CTX-012, CTX-013, CTX-014, CTX-010 | structure diagram (its earlier name), canvas, whiteboard |
| TERM-088 | Proposal | A change to a picture that the agent puts on it at its next work, with its reason; only the user accepts or dismisses it, and an accepted proposal waits to be reflected | CTX-014, CTX-010 | suggestion |
| TERM-089 | Accept | The user's taking a proposal; the picture is then edited as proposed, and the agent reflects the edit like any other | CTX-014, CTX-010 | import (its earlier name), merge |
| TERM-091 | Edit conflict | An edit made on a picture whose document version is no longer the latest, because the stage source changed meanwhile; the edit is shown again over the new picture, and the user chooses. From phase ②, only an edit draft (TERM-145) becomes a conflict; a sent edit waits to be reflected, and the agent puts it in if it fits the new document and asks again if not | CTX-010 | |
| TERM-092 | Reflect | The agent's writing edits and accepted proposals into the stage sources, by pull request at its next work; NEXUS never writes to Git | CTX-010 | apply (its earlier name), sync, publish, deploy |
| TERM-093 | Team project | A project that several people work on, with `team: true` in its settings | CTX-009, CTX-010 | shared project |
| TERM-097 | Phase | One step of the plan for NEXUS: phase 1, the hub and the server, is built; the plan of 2026-10-24 follows it with phase ① discussion over pictures, phase ② editing pictures, with the work board of stage 01's event storming since 2026-11-03, and phase ③ links to Notion and Jira | all | stage (TERM-053), release |
| TERM-109 | Project space | The place in NEXUS for one project's pictures, bound to its repository: one for each project, and at first one repository for each space | CTX-012 | workspace, board |
| TERM-110 | Document version | The stage sources at one commit in Git. A picture is drawn for one document version, and an edit is bound to the version that its picture was drawn from | CTX-012, CTX-010 | revision (TERM-081 counts snapshots), board revision |
| TERM-111 | Picture view | A picture with its comments, proposals and discrepancies on it, and from phase ② its edit draft and positions: what the user looks at before commenting, accepting or dismissing a proposal, editing and moving items | CTX-012, CTX-014, CTX-010 | canvas |
| TERM-112 | Discrepancy | A place where two pictures of a project disagree when their items are paired by ID, such as an ERD table with no matching aggregate on the DDD board. Only one is open for each pair, and it is resolved when a new cross-check no longer finds it. Unlike a check (TERM-063), it has a state and can be discussed | CTX-013, CTX-007 | mismatch, conflict (TERM-091), error |
| TERM-113 | Pair | The two things that a cross-check compares, such as an aggregate on the DDD board and a table in the ERD; which pairs are compared first is decision D10 of stage 02 (hotspot 4) | CTX-013 | match |
| TERM-114 | Comment | A note that the user or the agent attaches to an item by its trace ID, so that it follows the item when the picture is redrawn: an item in a picture and, from the redesign of 2026-11-06, in any stage's list; or to a stage as a whole. It closes when a decision is attached or it is answered. Comments work on a phone too | CTX-014, CTX-007 | review finding (TERM-070) |
| TERM-115 | Decision | What the user settles about a comment, which the agent writes down as the user said: specs into the stage sources in Git, the user's choices into the records | CTX-014 | approval, user decision (TERM-020, a memory item) |
| TERM-116 | Edit | A change to a picture, made by the user on a PC with the open-source editor or by an accepted proposal. It is bound to the document version that its picture was drawn from, and it closes once it is reflected. Moving items only is not an edit (TERM-146) | CTX-010 | change, patch |
| TERM-117 | Pending reflection | An edit, or an accepted proposal, that is not yet reflected in the stage sources | CTX-010, CTX-007 | draft (an edit not yet sent, TERM-145), unsaved change |
| TERM-118 | Open-source editor | An existing editor that NEXUS embeds for editing pictures, such as Excalidraw, ERD Editor or draw.io; stage 02 chose Excalidraw and ERD Editor (D11, hotspot 8), and the work board uses Excalidraw too. NEXUS does not build an editor from scratch | CTX-010 | canvas |
| TERM-119 | Stage record | What Stage progress keeps for one stage: its state, its checkpoints and its next action. Only the user passes a checkpoint, and the agent writes the stage state to Git | CTX-007 | status file (TERM-071, where phase 1 keeps it) |
| TERM-120 | Stage overview | What is left in a stage before its checkpoint: its open discrepancies, comments and pending reflections, and at a workshop's checkpoint also the frame's open hotspots and the agent's stickies that still carry a label, shown together so that the user decides | CTX-007 | dashboard, stage state (TERM-067) |
| TERM-121 | Agent to-do | What the agent reads when it starts its work: open comments and discrepancies, and pending reflections, and from phase ② the work boards changed since it read them, a workshop's passed checkpoints not yet reflected and dropped edits whose pull request is open; it reads them through the hub (D9 of stage 02, hotspot 13) | CTX-007, CTX-014, CTX-010, CTX-016 | next action (TERM-069), task (TASK is the trace ID of `10-wbs`), inbox |
| TERM-122 | Tool link | A link from an item in a picture to a record in Notion or a work item in Jira, which shows only its state; each tool stays the source. A candidate for phase ③ | CTX-015 | link alone (TERM-062), sync, import |
| TERM-123 | Work item | A unit of work in a tracker such as Jira | CTX-015 | task (TASK is the trace ID of `10-wbs`), ticket |
| TERM-124 | Part | A named portion of one project: the documents whose paths in each stage source start with the part's name, such as `memory` and `nexus` in this repository. Set as `parts` in the project settings; each part has its own pictures and stage records | CTX-006, CTX-007, CTX-012 | module, component |
| TERM-125 | Picture source | What the hub takes from a part's stage source for one picture: its items, their connections and their terms, without a layout. A snapshot carries it to the NEXUS server, which keeps it as the picture of its document version | CTX-006, CTX-012 | layout, image |
| TERM-126 | Default branch | The branch that a repository's `origin` remote names as its head, such as `main`. NEXUS takes pictures and stage records only from its commit as the checkout last fetched it | CTX-006 | main (a branch's name, not this role) |
| TERM-127 | Reply | A note under a comment, by the user or the agent. A user's reply can settle the comment, or open a closed one again | CTX-014 | answer (a comment is answered when it closes) |
| TERM-128 | Claim | The NEXUS server's hold of one entry of the agent to-do for one agent session: other sessions' writes on the entry are refused until a set time after the session's last write on it (60 minutes by default) or until the entry closes | CTX-007 | lock, lease |
| TERM-129 | Outbox | The file on a device where the hub keeps the agent's writes that it could not send, until its next contact with the NEXUS server | CTX-014, CTX-009 | queue |
| TERM-130 | Timeline | The domain events of a stage 01 document in the order in which they happen, one lane for each flow, as step 1-b of event storming orders them; outcomes of which only one happens share a place. NEXUS draws the step view from it | CTX-012 | event list, flow (FL is the trace ID of `03-user-flow`) |
| TERM-131 | Step view | The DDD board shown one step of event storming at a time (steps 0 to 9 of stage 01, not stages, TERM-053), from the timeline to the context map and tables, each step adding the layer that the board's frame of that step adds. NEXUS draws it read-only from the stage 01 document, as it draws the whole board | CTX-012 | frame, slide |
| TERM-132 | Workshop | Stage 01's event storming as people hold it on a board, step by step, from step 0 to its last checkpoint, with checkpoints after steps 1-b, 7 and 9; in NEXUS, from phase ②, the user and the agent hold it on a work board. While it runs, the board leads, and at each checkpoint the agent writes the stage 01 document from the board version that the user passed. Stage 01's way of working called workshop, where people go first, is one way of holding it | CTX-016 | session (TERM-003), meeting |
| TERM-133 | Work board | The board of a workshop in NEXUS, from phase ②: a frame for each step, each starting as a copy of the previous one, with stickies, arrows, groups and comments that the user and the agent place; each change raises its board version (TERM-147). It is not a picture: NEXUS draws nothing on it from the stage sources, and once the workshop ends, after the last checkpoint or midway, it stays read-only, as material | CTX-016 | picture (TERM-085), canvas, whiteboard |
| TERM-134 | Sticky | One note on a work board, of a kind in the board's legend, such as a domain event, a command or a hotspot, shown in that kind's colour, with who placed it and an ID that NEXUS gives it. The agent's stickies carry its label until the user changes or confirms them, and a removed sticky is kept until it is restored | CTX-016 | card, item (TERM-059) |
| TERM-135 | My turn | What waits for the user's answer across every project, gathered on the first page: open proposals, comments whose last entry is the agent's, and checkpoints that the agent asked the user to pass. An entry leaves it when the user answers, and then waits in the agent to-do (TERM-121) until the agent's next work | CTX-014, CTX-008 | inbox, notifications |
| TERM-136 | Workspace | A project's page from the redesign of 2026-11-06: the 13 stages in a list, the chosen stage with its picture or its list of items, and the stage's talk beside it; on a phone, as tabs | CTX-008 | project (TERM-050), dashboard |
| TERM-137 | Talk | A stage's comments and proposals with their replies, shown by turn: what waits for the user first, then what waits for the agent, then the closed ones, folded. It can be narrowed to one item | CTX-014 | chat, thread, session |
| TERM-138 | Turn | Whose next entry a comment waits for: the user's when the agent wrote last, the agent's when the user did, and no one's when it is closed. The agent reads the user's entries only at its next work, so the agent's turn is not an instant answer | CTX-014 | status, unread |
| TERM-145 | Edit draft | The user's changes to a picture that are not sent yet: NEXUS keeps them on its server while the user edits on a PC, one open draft for each picture, and marks them on the picture. When the user checks their list of changes and sends them, they become an edit (TERM-116) and a pending reflection (TERM-117) | CTX-010 | draft alone, pending reflection (TERM-117), unsaved change |
| TERM-146 | Positions | Where the user moved the items of a picture: a position for each item of a part's stage, kept in NEXUS and never in the stage sources. The next layout starts from them, and a position goes when a redrawn picture no longer has its item. An aggregate of CTX-012 from phase ② | CTX-012 | layout (what NEXUS works out from them), coordinates |
| TERM-147 | Board version | The number of a work board's state, raised by each change to it. The agent's reading (Agent read marked) and each reflection of the board record the version they read, so that the user sees what changed since, and a passed checkpoint records the version that the user passed, which the agent writes into the stage 01 document | CTX-016 | board revision (TERM-090, removed), document version (TERM-110), server revision (TERM-081) |
| TERM-148 | Work board view | A work board as the user sees it on screen and the agent reads it through the hub: a part's step frames with their stickies, who placed them and their labels, arrows, groups and comments, the checkpoint boxes, the removed stickies folded away, and the board version with what changed since the agent read it. A read model of CTX-016 from phase ② | CTX-016, CTX-014 | picture view (TERM-111), step view (TERM-131) |
| TERM-149 | List of changes | The changes of an edit draft against the picture that the edit started from, item by item (added, renamed, changed, removed, connected, disconnected; changed is a field's new value, such as a column's type), with a one-line note; the user checks it before sending the edit, and the agent reads it with the pending reflection. A read model of CTX-010 from phase ② | CTX-010 | diff, changelog, patch |

Removed with the board, with their IDs kept:

| ID | Term | Status | Why |
| --- | --- | --- | --- |
| TERM-086 | User board | removed | A picture has one version that the user and the agent both see, and proposals show on it in the picture view |
| TERM-087 | Proposal board | removed | As for TERM-086 |
| TERM-090 | Board revision | removed | An edit is bound to the document version (TERM-110) instead |
| TERM-094 | MCP server (NEXUS) | removed | Removed with CTX-011 |
| TERM-095 | Chat client | removed | Removed with CTX-011 |
| TERM-096 | In-chat view | removed | Removed with CTX-011 |

Changed with the board on 2026-10-24: TERM-085, TERM-089 and TERM-092 have new names and definitions under the same IDs; TERM-047, TERM-048, TERM-054, TERM-056, TERM-071, TERM-088, TERM-091 and TERM-097 have new definitions; TERM-050, TERM-059, TERM-065, TERM-072, TERM-076 and TERM-082 have only updated contexts; TERM-109 to TERM-123 are new. TERM-124 to TERM-129 were added with the functional spec on 2026-11-02 ([docs/04-functional-spec/nexus.md](../04-functional-spec/nexus.md#new-words)). TERM-130 to TERM-134 were added, and TERM-047, TERM-085, TERM-097 and TERM-118 got new definitions, with the maintainer's choice of 2026-11-03 to hold stage 01's event storming in NEXUS. TERM-135 to TERM-138 were added, TERM-114 got a new definition and TERM-050 names TERM-136 among the words to avoid, with the redesign of 2026-11-06 (choice ② A of its checkpoint 1). TERM-145 was added, and TERM-117 names it among the words to avoid, with checkpoint 1 of phase ②'s frames on 2026-11-06. TERM-146 and TERM-147 were added, TERM-132 to TERM-134 moved to CTX-016, and TERM-116, TERM-133, TERM-134 and TERM-145 got new definitions, with checkpoint 2 of phase ②'s frames on 2026-11-07. TERM-148 and TERM-149 were added, and TERM-091, TERM-111, TERM-120, TERM-121, TERM-132 and TERM-147 got new definitions, with checkpoint 3 of phase ②'s frames on 2026-11-07. TERM-149 got a new definition, with changed and disconnected, with stage 02's checkpoint for phase ② on 2026-11-07.
