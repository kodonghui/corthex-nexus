# NEXUS v3: design tokens and mockup

[한국어](README.ko.md)

Status: passed on 2026-11-23; the tokens are frozen before development.

Inputs: the screen definitions of stage 08 ([docs/08-screens](../docs/08-screens/README.md), five screens and 39 states), REQ-073 (IBM Carbon components with 8 px corners on controls, 16 px corners on panels and pill-shaped tags), and the click mockup of 2026-11-21, kept in the project's records. The maintainer approved that mockup on 2026-11-22 together with the ten redesign recommendations, which chose the direction: this stage draws that one direction for every screen instead of two candidates per screen.

The source is [base.tokens.json](base.tokens.json), the project's layer of the tokens. The mockup is [mockup/nexus-mockup.html](mockup/nexus-mockup.html).

## 1. Tokens

The tokens follow the Design Tokens Community Group format of 2025.10 and start from the default base of the `corthex-screen` skill, in three layers. A later layer wins over an earlier one for the same name.

| Layer | Files | What it holds |
| --- | --- | --- |
| IBM Carbon | [carbon/](carbon/) | Carbon's colours, spacing, sizes, radius scale and themes, copied unchanged. Apache-2.0, Copyright 2015 IBM Corp.: see [carbon/LICENSE](carbon/LICENSE); [carbon/source.json](carbon/source.json) names each package, version and file hash. |
| CORTHEX | [corthex/](corthex/) | Rounded corners from Carbon's radius scale, IBM Plex Sans KR and IBM Plex Mono, Carbon's type styles, and the colours of AI proposals, stage states and event-storming stickies. |
| NEXUS | [base.tokens.json](base.tokens.json) | Six tokens, `nexus.shell.*`: the header above every screen. Like Carbon's UI shell and the 2026-11-21 mockup, it stays Gray 100 in both themes, which no Carbon theme token gives. |

[tokens.resolver.json](tokens.resolver.json) chooses the themes: light is Carbon's Gray 10 and dark is Gray 100. NEXUS overrides no Carbon or CORTHEX token.

The screens mark their states with these tokens:

| Mark | Tokens | Where |
| --- | --- | --- |
| An AI proposal not yet accepted and reflected: a dashed border, a light aura and the AI label | `corthex.ai.*` | SCR-142, SCR-145 |
| Waiting for reflection: an accepted proposal or a direct edit that no agent has put into the document yet | Carbon's teal tag | SCR-145, SCR-146 |
| Added, changed and removed since the last confirmation | Carbon's green, purple and red tags | SCR-145, SCR-146 |
| A stage's state: passed, in progress, not started, skipped | `corthex.stage.*`, always beside its word | SCR-144 |
| A to-do entry's kind: confirmation, AI proposal, agent question | Carbon's grey tag, the AI label, Carbon's cyan tag | SCR-142 |
| A diagram's state: not confirmed, confirmed, does not draw | Carbon's grey, green and red tags | SCR-145 |
| Messages: warning, error, information, success | Carbon's notification and support tokens | every screen |

## 2. The mockup

[mockup/nexus-mockup.html](mockup/nexus-mockup.html) is one file without a build step: open it in a browser. The bar at the top picks the screen, the state, the width (1440 for a PC, 360 for a phone) and the theme, and an address such as `#SCR-145/waiting/1440/dark` opens one directly. Links and buttons inside a screen go where the definition's actions say, for example Confirm to the confirmed state and "+2 more" to SCR-146. Under the frame, the page shows the state's definition and the responses that lead to it.

- Every state of every screen is drawn at 360 and 1440 pixels: 39 states and 78 frames, each in the light and the dark theme.
- SCR-145#normal also has three stage views for the pictures of the feature change of 2026-11-23, at both widths in both themes: stage 03 as a flow diagram with the main path down the left, stage 08 as one panel per state with one marked "No description", and stage 09 as the mockup page in an isolated frame with the tokens it uses listed in the panel, a token selected with its thread and comment box. Above the flow and the state panels, the stage's diagrams are a list to choose from. The stage tabs open them, and an address such as `#SCR-145/normal/1440/light/03` opens one directly; 6 frames more.
- The copy is the Korean the screens will ship with, at its real size. The example project is the 2026-11-21 mockup's book club app (the title 독서 모임 앱, the name `book-club`), with its domain board, AI proposals and comments.
- At 360 pixels a state shows the phone, except the four states that only a PC action leads to (SCR-143#secret, SCR-144#delete, SCR-146#confirmed and SCR-146#not-drawn), which show a narrow PC window, as section 2 of the stage-08 README says.
- The fonts load from Google Fonts when the browser is online; otherwise the system fonts that the font tokens list after them are used.
- Every colour, corner and type style in the mockup is a token: the file carries the CSS that the `corthex-screen` skill's `tokens.py css` writes from [tokens.resolver.json](tokens.resolver.json), and the rest of its styles use those custom properties only.

Each state has one frame. Variants inside a state are not drawn as frames of their own; their words are in the screen definitions:

| Screen | Variant not drawn |
| --- | --- |
| SCR-142 | empty with no project yet, which links to the agent credentials |
| SCR-143 | the one-time "Deleted demo" notice after a deletion |
| SCR-144 | errors other than 404, and a refused link with its message by the address |
| SCR-145 | a never-confirmed diagram, a part of the document that cannot be read, an item table with no items, and "Recorded" with its pull request after the agent's record |
| SCR-146 | empty before the first confirmation |
| every screen | permission after a 401, which goes to the access gate; the frames draw the 403 |

## 3. From the 2026-11-21 mockup

Carried over:

- IBM Carbon's colours and type, light Gray 10 and dark Gray 100, with rounded corners: 8 px for boxes and buttons, 16 px for panels, tags fully rounded.
- The dark header: NEXUS, the project's name, "My turn N" and the dark-screen switch.
- The stage tabs under the header, the diagram in the middle and the work panel on the right with its three sections: this diagram, AI proposals and the selected element.
- Dashed AI proposals with the AI label and their reasons, the legend, the six sticky kinds and their colours, and the lanes per bounded context.
- The book club app's board and comments, "AI proposals left out are not confirmed" and "All answered".
- Moving by dragging or with the arrow keys, renaming with a double click or F2, and the AI and owner badges on comments.

Changed, each as stage 07 decided (section 4 of the [stage-07 README](../docs/07-sitemap/README.md), differences 1 to 9):

- The first screen is the owner's to-do, and "My turn N" is its count (1).
- New screens for the projects with the agent credentials, and for a project with its tool links and deletion (2).
- The tabs hold all 13 stages; a stage without a picture shows its item table instead of "coming soon" (3).
- Adding and removing stickies leaves the drawn board for the workshop state (4).
- "Reflect" becomes "Accept"; accepted proposals and direct edits carry the waiting mark, and the confirm button is off while anything waits (5).
- "Undo" is only "Cancel edit", for direct edits (6).
- "Unconfirm" becomes "Cancel confirmation", and the words after a confirmation say the stage passes when the agent records it (7).
- "+N more" opens the changes screen, and the changed elements carry added and changed marks (8).
- On a phone, reading and comments only, with "Do this on a PC" for the rest (9).

And one change of this stage: every colour is a token name, where the 2026-11-21 mockup wrote Carbon's values directly, and the header's colours are the NEXUS tokens `nexus.shell.*`.

## 4. Checks

- `tokens.py check` of the `corthex-screen` skill on the mockup: 1158 colour literals, none off the tokens, compared in both themes.
- `tokens.py verify` on [carbon/](carbon/): 27 Carbon files match [carbon/source.json](carbon/source.json).
- [tests/test_design.py](../tests/test_design.py) checks that every token file follows the format, that the resolver lists every token file, that the project's tokens are only under `nexus`, that `source.json` names every file in [carbon/](carbon/) and each copy matches its hash, that the mockup has a frame for every state of every screen definition at both widths and for each of the three stage views of SCR-145#normal, and that no colour outside the token CSS appears in the mockup: not in another style block, a style attribute or a style its script sets, whether written as a hex value, a colour function or a CSS colour name.
- Looked at in Edge: every frame at both widths in both themes, 156 pictures, after the last change of stage 09; after the feature change of 2026-11-23, the stage views at both widths in both themes, 12 pictures.
- Not checked: real phones, screen readers and measured contrast. The colours are Carbon's theme tokens, with the CORTHEX layer's sticky text on the sticky colours.

## 5. Choices made in this stage

These are reversible, so they were made here and listed for the checkpoint:

- One direction, the approved 2026-11-21 mockup, instead of two candidates per screen.
- The marks' colours in section 1.
- On a phone the header shows the dark-screen switch as an icon, with its name for screen readers, so that the project menu and "My turn N" fit in 360 pixels.
- On a phone the diagram keeps its real size and scrolls sideways in its box, so that the stickies stay readable.
- The workshop board keeps one frame per step, one under another; the next step's empty frame says "Add notes before confirming".
- A document that does not draw shows where it failed and no picture.
- The example credential's secret is the contract's example value, never a real one.

## 6. Checkpoint

The maintainer passed stage 09 on 2026-11-23 at 7fff711 through the delegate they named for checkpoints; the answer is in the project's records. The direction is chosen and the tokens are frozen before development uses them. This stage removes, defers or changes no approved item of stages 01 to 08; the variants in section 2 keep their words in the screen definitions.

### Feature change of 2026-11-23

The maintainer chose to draw user flows, screen states and mockups from the first release, with the hub sending their sources. Each approved item the change touches was asked on its own and approved through the delegate they named for checkpoints; the answers are in the project's records. Here: the three stage views of SCR-145#normal in section 2. No token is added or changed. This stage's part of the change passed its own checkpoint on 2026-11-23 through the same delegate.

#### After the review of pull request 104

The stage tabs of the 78 state frames are again exactly as stage 09 approved them; the script opens the view of stage 03, 08 or 09 from a tab, so no state frame changed. The stage-09 view gained the thread and comment box of a selected token, on a phone under the frame's token list; the flow and screen lists above the 03 and 08 views are links. No token is added or changed. This part passed its own checkpoint on 2026-11-23 through the same delegate.

#### After the second review of pull request 104

The state panels of the 08 view and the tokens of the 09 view are buttons that show which one is selected, like the boxes of the 03 view, so a keyboard selects them too. The bar above the mockup frame says it is a mockup page, that NEXUS never asks for a sign-in inside it and that a page it opens is opened again once; the 09 view's "AI proposals" section says that a mockup takes none. The state frames are still exactly as stage 09 approved them, and no token is added or changed. This part passed its own checkpoint on 2026-11-23 through the same delegate.

#### After the seventh review of pull request 104

The mockup page's copy of SCR-145's normal state follows stage 08: a removed diagram with open threads comes last, marked removed, and opens with its threads (SPEC-027). The page is generated again; nothing else in it changed and no approved item of this stage changed. This part passed its own checkpoint on 2026-11-23 through the same delegate.

#### After the eighth review of pull request 104

The mockup page's copy of SCR-145's and SCR-146's normal states follows stage 08: a removed diagram opens for its threads only (SPEC-027). The page is generated again; nothing else in it changed and no approved item of this stage changed. This part passed its own checkpoint on 2026-11-23 through the same delegate.

#### After the ninth review of pull request 104

The mockup page's copy of SCR-145's and SCR-146's error states follows stage 08: after a 404 for the diagram on a write, the diagram is read again first, and a removed one still listed opens for its threads only (SPEC-027). The page is generated again; nothing else in it changed and no approved item of this stage changed. This part passed its own checkpoint on 2026-11-23 through the same delegate.

### Feature change of 2026-11-24

The mockup page's Korean copy of SCR-145's normal and error states (`META` in its script) follows stage 08 again: the page is generated again from the stage-08 Korean definitions, each state's text with its phone sentence apart, as before. Besides this change's text, the copy catches up with TASK-444's Reject on a removed diagram, which the screens README's "Reject on a removed diagram" passed on 2026-11-24 and the page had not followed; that catch-up is not part of the removed-diagram rule. No other state's copy changed, no frame draws a removed diagram, and no token is added or changed. One approved item changes, asked on its own: the page's copy of those two states. This part passed its own checkpoint on 2026-11-24 through the same delegate.
