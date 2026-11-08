# NEXUS: mockups

[한국어](README.ko.md)

Stage 09 of CORTHEX's own project, for NEXUS 0.2: the design tokens in [design/nexus/](../../../design/nexus/base.tokens.json), and the mockups of direction A, Hub pages, on one page, [mockup.html](mockup.html): every state of the five new screens, SCR-105 to SCR-109, and of the hub page and its stage detail, SCR-101 and SCR-104, with what 0.2 adds to them, drawn for the phone first, at 320 pixels. Status: the maintainer chose direction A on 2026-11-03, the stage's first checkpoint, and the states were then drawn in it. The maintainer passed the second checkpoint, frozen tokens, the same day at 11:39 KST, together with the joint checkpoint of stages 03 to 08, whose recommendations the mockups follow: the tokens are frozen for NEXUS 0.2 before development uses them, and a later change needs the maintainer's decision. The maintainer's choice of 2026-11-03 to hold stage 01's event storming in NEXUS added the step control of a DDD board above the picture and five frames of its steps, drawn with the frozen tokens, which the maintainer passed the same day ([For the checkpoint](#for-the-checkpoint)). The maintainer's redesign of 2026-11-06 reopened the tokens until its checkpoint 3, and its checkpoint 2 chose their new look on 2026-11-07 ([The redesign's look](#the-redesigns-look)); a second page, [redesign.html](redesign.html), draws every state of the redesign's screens in that look for its checkpoint 3 ([The redesign's states](#the-redesigns-states)). Checkpoint 3 passed on 2026-11-08 at 14:54 KST, and the files in design/nexus/ now hold that look, frozen again ([For the checkpoint](#for-the-checkpoint)). When a file and its Korean translation differ, the English file is the source.

Inputs: the screen definitions of [stage 08](../../08-screens/nexus/README.md), [SCR-101](../../08-screens/nexus/SCR-101-hub-page.md), [SCR-104](../../08-screens/nexus/SCR-104-stage-detail.md) and [SCR-105](../../08-screens/nexus/SCR-105-picture-view.md) to [SCR-109](../../08-screens/nexus/SCR-109-stage-overview.md), with their states, their layouts at 320 and 1440 pixels, the final words of the messages and the [notes for stage 09](../../08-screens/nexus/README.md#stage-09-mockups); the hub page's rows of the [functional spec](../../04-functional-spec/nexus.md), SPEC-122 to SPEC-125; phase 1's hub page as it runs, [hub.html](https://github.com/kodonghui/corthex/blob/76508243558abaedcc15bb422c454341845fcabd/plugins/corthex-nexus/skills/corthex-hub/assets/hub.html), whose colours, type, spacing, cards and words the tokens and the hub's frames take; and the event storming board of [stage 01](../../01-domain/nexus.md), drawn in the frames as the sample picture, with its timeline for the steps of SPEC-141. No brand assets or liked references were given: NEXUS has no logo of its own, so the mockups keep phase 1's look.

The stage's default human view is Figma or Claude Design. Here it is one page drawn from the tokens by a script, [mockup.html](mockup.html), with every frame in light and dark and in English and Korean, which a browser can measure: line breaks, contrast, target sizes and overflow. Figma is not connected to this project, and a page drawn from the tokens keeps a token name in every value. People look at it as a private published page whose link is in the project's records, as the repository is public. `.corthex/project.json` records the choice.

## The choice

- Question: “09 목업은 어느 방향으로 그릴까요?” (which direction should the 09 mockups take?), asked in the project's thread on 2026-11-03 at 08:34 KST, after the draft with two candidates (pull request kodonghui/corthex#70).
- Options: “A · 허브와 같은 쪽” (A, Hub pages, recommended), “B · 그림이 먼저” (B, Picture first), “A에 B의 절반 높이 패널” (A with B's half-height panel) and “먼저 이야기하기” (talk first).
- Answer: the maintainer picked “A · 허브와 같은 쪽” on 2026-11-03 at 09:00 KST.
- What followed: the states not drawn yet were drawn in A, together with what 0.2 adds to the hub page; B's frames left with its tokens `size.tab` and `layout.sheet-peek`, which the option named, and `shadow.float`, which only B's floating buttons used; the words that the frames need joined [stage 08's messages](../../08-screens/nexus/README.md#words-the-mockups-added); and each screen definition links its mockups. The draft with both candidates stays in Git: [candidates.html at commit e1d9956](https://github.com/kodonghui/corthex/blob/e1d9956c30339a0ca78c5a2a4a0c79063410636a/docs/09-mockup/nexus/candidates.html).

## Direction A · Hub pages

The picture view and the stage overview read like phase 1's hub page: the same top lines, cards and rows. The picture sits in a card inside the page's 16-pixel margins, 286 pixels wide on a phone. Each kind of entry has its own small pin on the item's corner, 24 pixels drawn and 44 to touch: a dark circle for comments, a blue square for proposals and an amber diamond for discrepancies, with a hollow diamond when a discrepancy waits for a current picture. An accepted proposal not yet reflected outlines its item with blue dashes and a ✓ pin. Apart, Items as a list and the legend are rows under the picture. Panels rise from the bottom to their content's height, up to 85 per cent, over a dimmed picture; at 1,440 pixels they open beside it.

- For: one look with the hub page, which NEXUS 0.2 keeps from phase 1; corner pins cover little of a full board; each kind has its own shape, so colour is not the only cue; stage 08's layout stays as it is.
- Against, and still true: the shapes need the legend at first, and the words of a waiting or accepted item show only in the legend, the list and the panel; the picture is narrower on a phone, and a tall panel covers it.

### Across the screens

- The opening view of a picture shows the context with the most marks at a zoom where the board's text is about 10 pixels high on a phone; at 1,440 pixels the whole picture fits.
- Marks keep their size at every zoom. At the whole picture on a phone, the marks of each context merge into a 32-pixel circle with their count, which zooms in. A mark that counts one entry opens that entry's panel, and a count of several opens the item's panel.
- On a DDD board, the step control above the picture opens at the last step, 8-b–9, the whole board. A step is laid out from the board's timeline and context tables, the same way each time: a lane for each flow, its places from left to right, with the events of one place stacked; from step 2 the external systems, and from step 4 the hotspots, in a column beside the first event of their context; from step 3 each command left of its events, from step 5 its actors below it as small stickies, and from step 6 its aggregate above it; from step 7 each sticky of a context with the context's ID; and at step 8-a the policy and the read model left of the command. A place widens when a step gives it a column. On a phone a step opens at the start of its first lane, at the zoom of the opening view; at 1,440 pixels the whole step fits.
- The list of items puts the items with marks first, then the rest, and names a part without an ID as such.
- A refusal or an error shows its message above the box or the buttons it concerns, with its trace ID, and what the user wrote stays. While something loads, still grey shapes stand where its content will be.
- Korean text breaks between words, dates never break inside, and long IDs break rather than widen the page. Under reduced motion, sheets fade instead of moving.

### The hub page and the stage detail

SCR-101 and SCR-104 are drawn as phase 1's hub.html draws them, with its words, and with what 0.2 adds in the same style:

- Each part's Now and Next, the open comments, proposals and discrepancies, and a mark on each stage that has a picture, which the legend explains (SPEC-123).
- The checkpoints passed in NEXUS that wait for their records, each with a link to its stage overview. On a page built earlier, the rows under "In NEXUS" also hold a picture that is not current and a withdrawn checkpoint that a record names (SPEC-140).
- The actions that the agent asks about first: up to 10 entries, where the list comes from, the profile's entries that the project's list leaves out, and that anything that cannot be undone is asked in any case (SPEC-125).
- On an empty server, the four steps that push a project (SPEC-124). On a device, a line that says that the pictures, comments and stage overviews are on the server.
- In the stage detail, each part's state, last checkpoint and next action, with Picture and Stage overview beside the state at 1,440 pixels and on their own line at 320.

Where the frames differ from phase 1, as the checkpoint accepted them:

- The search field's border takes `color.control-line`, 3:1 against the page, where phase 1's line is lighter.
- The stages keep phase 1's borders, under 3:1 against the card. Each stage is a button that its text names, so its border carries nothing that the text does not; WCAG 1.4.11 asks 3:1 of what is needed to identify a control.

## Tokens

Format 2025.10 of the Design Tokens Community Group, with the modes of the Resolver Module 2025.10. The source is these files; the page and, later, the code take the tokens from them.

| File | Holds |
| --- | --- |
| [base.tokens.json](../../../design/nexus/base.tokens.json) | 46 tokens that every theme shares: `font` (families, five sizes, three weights, three line heights), `space` (2 to 32 pixels), `radius`, `border`, `size` (targets, marks, boxes, the side panel, the overview's column and the hub's stages), `opacity`, `layout` (shares of the screen's height), `breakpoint`, `duration` and `easing` |
| [theme/light.tokens.json](../../../design/nexus/theme/light.tokens.json) | The light theme's 32 colours and shadows |
| [theme/dark.tokens.json](../../../design/nexus/theme/dark.tokens.json) | The dark theme's 32, under the same names |
| [tokens.resolver.json](../../../design/nexus/tokens.resolver.json) | Base first, then the theme: `light` by default, or `dark` |

- From phase 1's hub page: the system fonts with the Korean ones, body text of 15 pixels, the page's and the cards' colours, the accent, the colours of the stages done, in progress and not started, a stage's least size, and the corners of 6, 8 and 12 pixels and the pill.
- New for 0.2: `color.control-line` for the border of a field, a chip or a check box, which needs 3:1 against the page and a surface (WCAG 1.4.11) where phase 1's line is lighter; `color.mark.*` for the marks and the halo that keeps them apart from the picture's colours; `color.scrim` and `color.picture-ground`; `color.warn` and `color.info` with their grounds; the sheet's shadow; `size.target`, 44 pixels, the least width and height of anything a finger selects; the sizes of marks, boxes and panels; and the shares of the phone's height for the picture and the sheets.
- Since the choice: added `color.progress-bg`, `color.progress-fg`, `color.progress-line`, `color.todo-line` and `size.stage`, phase 1's values for the hub's stages, which the frames of SCR-101 and SCR-104 draw; removed B's `size.tab`, `layout.sheet-peek` and `shadow.float`.
- At the freeze: added `color.skipped-fg` and `color.unknown-line`, phase 1's colours of a skipped stage's text and of a stage not recorded's dashed border, which the second sample project's stages now draw on SCR-101 and SCR-104. A skipped stage keeps `color.sunken` with a dotted `color.todo-line` border, and one not recorded `color.surface` with `color.muted` text, as in phase 1. A skipped stage's text in the light theme is darkened from phase 1's 4.13:1 on its ground to 4.63:1; in the dark theme it keeps 4.89:1.
- In the page, each token is a custom property named by its path, such as `--nx-color-mark-ink`. Outside the drawing inside the picture, the mockups' styles use no colour or length but these names, and every token is used, apart from `breakpoint.side-panel`: the frames are drawn at fixed widths, and the views will use it in their media query.

## Frames

Fifty-five frames, each in light and dark and in English and Korean: every state of the seven screens at 320 pixels, with the steps of a DDD board, and the normal state of five of them at 1,440, with one step. The sample data is made up for them: two projects, the board of stage 01 with its timeline, five comments, two proposals, two discrepancies, commits, times and a trace ID. The words of NEXUS itself are stage 08's.

| Screen | At 320 pixels | At 1,440 |
| --- | --- | --- |
| SCR-101 Hub page | normal, on the server and on a device; empty; stale; error, data that could not be read; permission, `access_missing` | normal |
| SCR-104 Stage detail | normal; empty; stale; error, a project not on the page | normal |
| SCR-105 Picture view | loading, before the view's code runs and while it draws; normal, opened, as the whole picture, at the steps 1-b, 6 and 8-a, and on a board without a timeline; large; empty; stale; error; code-failed; permission, a sign-in that expired | normal; step 3 |
| SCR-106 Item | normal; empty; loading; error, `comment_limit`; permission, `no_kind`; gone | normal |
| SCR-107 Comment | loading; normal; stale; error, `reply_limit`; permission, a sign-in that expired; gone | none |
| SCR-108 Proposal | loading; normal, open and accepted; stale; error, `reflection_limit`; permission, `user_only`; gone | none |
| SCR-109 Stage overview | loading, before the overview's code runs; normal; empty; stale; error, `internal` when passing; permission, `user_only` | normal |

SCR-102 and SCR-103, the search results and the trace view, keep phase 1's design and are not drawn.

## Words

The words that the frames need and stage 08 had not written joined stage 08's messages as [Words the mockups added](../../08-screens/nexus/README.md#words-the-mockups-added): the hub page's open counts, waiting checkpoints and actions to ask about first; the names of the zoom buttons, the merged marks and the legend; the headings of the list of items, the panels and the stage overview; the loading lines for screen readers; "New" on a reply; and "Back to the picture". B's own words, such as its tabs and filter chips, left with it. The step control's words, "Steps" and "No timeline", came with stage 08's change of 2026-11-03 (SPEC-141).

## The redesign's look

The maintainer's redesign of 2026-11-06 reopened the tokens frozen for NEXUS 0.2 until its checkpoint 3. At its checkpoint 2, on 2026-11-07 at 05:45 KST, the maintainer chose candidate A, Drawing sheet, on a decision card in the project's thread ("A 제도 용지 (추천)", A, Drawing sheet, recommended), over B, Night studio: a paper ground, a deep blue accent, ink for what is done, and IBM Plex Sans KR and IBM Plex Mono served by the NEXUS server. Both candidates were drawn on checkpoint 1's screens, SCR-110 to SCR-117, at 1,440 and 390 pixels in both themes, on a private published page whose link is in the project's records. Checkpoint 3, which passed on 2026-11-08 with the states of the new screens drawn in them, wrote the values below into [base.tokens.json](../../../design/nexus/base.tokens.json) and the two themes and froze them again; 0.2's values stay in the files' history.

| Token | Light | Dark | Draws |
| --- | --- | --- | --- |
| `color.bg` | `#F3F0E8` | `#161512` | The page, a paper ground |
| `color.surface` | `#FFFFFF` | `#1E1D19` | Cards, panels and fields |
| `color.sunken` | `#ECE8DE` | `#292720` | Wells, such as the list of stages |
| `color.line` | `#D9D2C3` | `#37342D` | Lines between surfaces, which A draws instead of shadows |
| `color.control-line` | `#8A8272` | `#807969` | Borders of buttons, fields and tabs |
| `color.text` | `#1D1B17` | `#ECE8DE` | Text |
| `color.muted` | `#5D574D` | `#ABA597` | Secondary text |
| `color.accent`, `color.focus` | `#1F4F7F` | `#8FB9E6` | Links, the main button, the current stage, my turn and focus rings |
| `color.on-accent` | `#FFFFFF` | `#0F1620` | Text on the accent |
| `color.accent-soft`, new | `#E4ECF4` | `#1E2C3B` | The selected row, the current stage's row and my turn, with a 3-pixel bar of the accent at their start |
| `color.done-bg`, `color.done-line` | `#1D1B17` | `#ECE8DE` | A stage that is done, in ink |
| `color.done-fg` | `#FFFFFF` | `#161512` | Text on a stage that is done |
| `color.progress-bg`, `color.progress-fg`, `color.progress-line` | `#E4ECF4`, `#1F4F7F`, `#1F4F7F` | `#1E2C3B`, `#8FB9E6`, `#8FB9E6` | A stage in progress, in the accent |
| `color.warn`, `color.warn-bg` | `#875300`, `#FAEFD5` | `#E8BA5C`, `#33290F` | Warnings |
| `color.error`, `color.error-bg` | `#A3261C`, `#FAE6E2` | `#FF8C7D`, `#3A1B16` | Errors |
| `color.mark.ink`, `color.mark.on-ink` | `#1D1B17`, `#FFFFFF` | `#ECE8DE`, `#161512` | NEXUS's marks on a picture |
| `color.mark.halo` | `#FFFFFF` | `#0F1216` | Unchanged: the ring that keeps a mark apart from the picture |
| `color.picture-ground` | `#FFFFFF` | `#121212` | Unchanged: the picture keeps the editor's colours |

- The colours that checkpoint 2 left for checkpoint 3 take these values in the states drawn, light then dark: `color.on-warn` `#FFFFFF` and `#161512`; `color.info` and `color.info-bg` the accent and `color.accent-soft`; `color.todo-line` and `color.unknown-line` `#8A8272` and `#807969`, as `color.control-line`; `color.skipped-fg` `#5D574D` and `#ABA597`, as `color.muted`; `color.scrim` `rgb(29 27 23 / 0.32)` and `rgb(0 0 0 / 0.55)`; and `shadow.sheet` `0 -4px 16px` in `rgb(29 27 23 / 0.18)` and in `rgb(0 0 0 / 0.6)`.
- Contrast, computed from these values for the 53 pairs that the states draw in each theme, 31 of text and 22 of lines and shapes (18 pairs at checkpoint 2): text at least 5.62:1 in light, the warning's text on its ground, and 5.79:1 in dark, secondary text on `color.accent-soft`, where 4.5:1 is needed; the borders of controls, focus rings, the lines of the stages' states and the marks at least 3.11:1 in light and 3.46:1 in dark, a control's border on a well, where 3:1 is needed. None is under its need.
- One pair that only the hub page draws falls short in A: the counts of warnings and errors on a stage that is done, `color.warn` and `color.error` on `color.done-bg`, which A makes ink: 2.68:1 and 2.33:1 in light, 1.48:1 and 1.85:1 in dark, where 0.2's green ground gives 5.5:1 and 5.68:1 in light and 8.3:1 and 6.1:1 in dark. No drawn state shows such a count; the samples' done stages have none. The hub page's template, which the core plugin's pull request changes anyway (stage 10), takes one rule for it: on a stage that is done, the counts take `color.done-fg`, 17.19:1 in light and 14.92:1 in dark, and keep their ! and ✕, so that the count is told by its sign, not by its colour. Checkpoint 3 took the rule: it is in [hub.css](../../../nexus/ui/hub.css), and the core plugin's template takes it with the new tokens in kodonghui/corthex#169.
- Type: `font.family.sans` is IBM Plex Sans KR and `font.family.mono` IBM Plex Mono, each followed by 0.2's system fonts. The server serves both from its own origin (REQ-147), split by Unicode range, from the packages `@fontsource/ibm-plex-sans-kr` 5.3.0 and `@fontsource/ibm-plex-mono` 5.3.0, under the SIL Open Font License 1.1; checkpoint 3 allowed them as a new input of the browser build, which the repository's rules ask about first. The views link one hashed stylesheet of their faces after their first paint ([`nexus/ui/README.md`](../../../nexus/ui/README.md)); the hub page keeps the system fonts for now, since its policy allows no font. With an empty cache, A's screens on the published page loaded 22 to 35 font files, 311 to 491 KB.
- Sizes: 0.2's scale times 1.06, so body text 16 pixels (from 15), `font.size.caption` 0.8 rem, `small` 0.925 rem, `title` 1.2 rem and `page` 1.5 rem; the body's line height 1.6 (from 1.55); `font.weight.bold` 600 (from 650) for headings, names and counts. The wordmark NEXUS is set in capitals, 0.14 em apart.
- Shapes: corners `radius.sm` 2, `radius.md` 3, `radius.lg` 4, `radius.sheet` 6 and `radius.pill` 3 pixels, from 6, 8, 12, 16 and 999, with a new `radius.round`, 999 pixels, for the marks; new heights `size.row` 36 pixels for a row of a list, `size.button` 34 for a button or a field and `size.button-small` 28. Surfaces have no shadow and are told apart by `color.line`; only the sheet that rises on a phone keeps `shadow.sheet`. A selected tab is the surface with a 2-pixel line of `color.text` under it.
- The picture keeps NEXUS's editor colours in both themes; its dark ground needs the fix of BUG-595. The shapes of the states, ✓ ◐ ○ – ?, and the symbols of the steps and buttons are drawn as SVG icons, since the two fonts lack some of them (BUG-596).

## The redesign's states

[redesign.html](redesign.html) draws the 53 states of SCR-110 to SCR-117 that [stage 08](../../08-screens/nexus/README.md#the-redesigns-screens) defines, in A's look, in 107 frames: each state at 390 and 1,440 pixels, and the workspace's normal state at 1,152 too, where its talk folds (stage 08's rule 16). Each frame shows in light and dark and in English and Korean, opens larger on its own, and is drawn from the token values above, which the page holds as custom properties.

- Data: the stages, items, checks and records of this repository and of the core plugin's, as the hub read them on 2026-11-06 at commits `9608fa1` and `7bc5659`; made-up samples for the talk, the marks, my turn, the answers and the times. The words are stage 08's.
- SCR-117, Full checks, is 0.2's hub page at `/hub`, unchanged (REQ-233): its frames draw hub.html's own markup, words and styles with A's tokens in place of 0.2's, from the same snapshots. Its error and permission states are the message page of stage 08's rule 9.
- Controls are drawn 34 pixels high, or 28 in a dense row, with the hit area of 44 pixels that rule 14 asks for wherever a finger selects them.
- Colours and type come only from the tokens' custom properties. Lengths are written in pixels: of the 342 gaps, paddings and offsets, 211 are steps of `space`, and most of the rest are 6 and 10 pixels (89), which the scale lacks; checkpoint 3 chose that the build takes those from the nearest step, a change of 2 pixels, instead of adding the steps.
- Type: the published copy of the page embeds subsets of the two fonts; the copy in the repository, which holds no font file, falls back to the system fonts that follow them in `font.family`.

## Checks run

On 2026-11-03, on the tokens, the page and its 50 frames, and again after the freeze:

- The tokens: each of the 46 base tokens and the 32 of each theme has one `$value` and a type, its own or its group's; colours are sRGB objects whose `hex` matches their components, and dimensions are objects in `px` or `rem`; both themes hold the same 32 names, and none of them is in the base file; the resolver lists the three files.
- The mockups' styles: no colour or length outside the token names, only 0, whole shares such as 50 per cent and the picture's height in container units; every token used apart from `breakpoint.side-panel`.
- Contrast, computed from the tokens for each pair the frames draw, 42 in each theme: text at least 4.5:1, and the borders of fields, focus rings, outlines, marks and error icons at least 3:1 against what is behind them.
- `corthex-uxui`'s page check on each frame on its own, at 320 × 640 or 1440 × 900, in both themes: 200 runs. No sideways scrolling, no split word, no text past its box, no missing label and no target under 24 pixels. What it reports is the drawing inside the picture cut off by its frame, which is how a picture larger than its frame moves (stage 08's rule 1), and the numbers on the marks, which sit on shapes that the check cannot see and were computed from the token pairs instead. Its 44-pixel goal is met everywhere but by the check box, 24 pixels in a row of 44, and two links inside a sentence: phase 1's "open" for a human view and a pull request's number.
- The page in Chromium at 320, 390, 1,280 and 1,440 pixels, in light and dark and in both languages, 16 runs: no sideways scrolling, no element past its frame's edge, no console error; the page check on it reports only the drawing inside the pictures and a few short last lines, which it counts as information or a warning.
- Looked at as images: every frame at 320 pixels in English and light and in Korean and dark, and the five at 1,440 pixels in English and light, with the stage detail's in Korean and dark as well. What looking changed: the stage detail's stale frame counts both waiting checkpoints, the comment's loading frame shows its last reply whole, the actions to ask about first follow SPEC-125, the Close button of the stage detail keeps its width, and a long variable name in the empty server's steps no longer splits a Korean word.
- Looked at as images after the freeze: the hub page's and the stage detail's normal frames at 320 and 1,440 pixels, in English and light and in Korean and dark, with the skipped and not-recorded stages.
- The hub's snapshot of this repository finds `design/nexus/` as the stage's source and adds no check result.
- The repository's checks with these files pass: `python -m unittest discover -s tests`, `claude plugin validate --strict` for the marketplace and its three plugins, `node --test nexus/test/*.test.js` and `git diff --check`.
- Again on 2026-11-03, after the step view: the mockups' styles hold only token names, and the 42 contrast pairs of each theme are unchanged, since the step control uses only the frozen tokens. The page check on each of the 55 frames in both themes, 220 runs, reports nothing new, only the drawing inside the picture cut off by its frame and the numbers on the marks, and the step control's buttons are 44 pixels. The page in Chromium at 320, 390, 1,280 and 1,440 pixels, 16 runs, has no sideways scrolling, no element past its frame's edge and no console error. Looked at as images: the five new frames, in English and light and in Korean and dark; and of the frames that the control moved, the opened picture in Korean and light, the stale picture and a proposal's sheet in English and light, and the picture at 1,440 pixels in English and light, with the item beside it in Korean and dark.
- For the redesign's checkpoint 2, on 2026-11-06 at about 20:25 KST, in headless Chromium in a cloud container: `corthex-uxui`'s page check on each candidate's six screens in both themes found no Korean word split at a line's end, no contrast error and no text past its box, apart from the stickies at a picture's edge, where the picture goes on past the screen; one lone last word on the first page was fixed. The published page had no sideways scrolling at 1,440 and 390 pixels in either theme, and its font files were counted on a local server with an empty cache.
- For the redesign's checkpoint 3, on 2026-11-07 between about 09:00 and 09:45 KST, in headless Chromium in a cloud container, on [redesign.html](redesign.html) and its 107 frames:
  - Contrast, computed from A's values for the 53 pairs that the states draw in each theme: none under its need ([The redesign's look](#the-redesigns-look)).
  - `corthex-uxui`'s page check on each frame at its own width, in light and dark and in English and Korean: 428 runs. No sideways scrolling, no Korean word split, no text past its box, no contrast error, no field without a label and no short last word in a heading. What it still reports, sorted by cause: the words for screen readers of icon buttons, counts and shapes, hidden on purpose, which it counts as clipped text (15,184) or cannot measure over another box (506); text cut by the bottom of a list, the talk, an item, the stages or the search's matches, which scroll in the built page while a frame draws their first screenful (230), or which it cannot measure there (510); and the full commit hash in the hub page's line of where records come from, which breaks at 390 pixels as stage 08's rule 1 asks (8).
  - What the check found, and what changed: controls drawn disabled while a page loads now say so (`aria-disabled`), as the built controls will; the separators in the top bar take `color.muted` instead of a line's colour; the search's loading state keeps the earlier matches at full contrast, as SCR-116 defines it, instead of dimming them; the hub page's search field has its label, as hub.html's has; Korean messages that ended with one short word on their last line wrap evenly; and the frames' type takes only the tokens' sizes, weights and line heights.
  - Each frame measured for anything past its edge and for drawn controls under 24 pixels, or under 44 on a phone: 428 runs, none, and no console error.
  - The whole page at 1,440 × 900, 390 × 844 and 320 × 640 pixels, in both themes and languages: 12 runs, no sideways scrolling and no console error; the page check reports only what it reports on the frames.
  - Each fragment of stage 08's table of [the redesign's words](../../08-screens/nexus/redesign-words.md) looked for in the frames, in its language: all are drawn but 46, each a case that no state shows, such as Done already, the other reasons of Not read and the other kinds of an item, or a note of the table itself.
  - Looked at as images: the frames at 1,440 and 390 pixels in Korean and light, in contact sheets, and SCR-111's at 1,152; the hub page's frames in both themes and languages; and, after the last changes, seven frames of SCR-110 and six others in Korean and light or English and dark.

## For the checkpoint

The redesign's checkpoint 3 passed on 2026-11-08 at 14:54 KST: on a decision card in the project's thread, which asked whether to confirm checkpoint 3's drawings of the states and the values of the tokens as they are, the maintainer chose to confirm them as drawn ("그린 대로 확정 (추천)", confirm as drawn, recommended). So the 53 states and A's tokens are frozen, the gaps of 6 and 10 pixels take the nearest step of `space`, the two font packages join the browser build, controls get the hit area of 44 pixels, and the hub page's counts on a done stage take `color.done-fg`, as proposed. The checkpoint covered:

1. The 53 states as [redesign.html](redesign.html) draws them ([The redesign's states](#the-redesigns-states)), with stage 08's definitions.
2. The values of the tokens left for it, and the gaps of 6 and 10 pixels, which the build takes from the nearest step of `space`.
3. A hit area of 44 pixels (`size.target`) around controls drawn 34 and 28 pixels high, wherever a finger selects them.
4. The two font packages as a new input of the browser build.
5. The hub page's rule for the counts on a stage that is done ([The redesign's look](#the-redesigns-look)).

Its checkpoint 2 passed on 2026-11-07 at 05:45 KST: on a decision card in the project's thread the maintainer chose A, Drawing sheet ("A 제도 용지 (추천)"). [The redesign's look](#the-redesigns-look) writes it down.

The maintainer's choice of 2026-11-03, to hold stage 01's event storming in NEXUS, passed at 16:54 KST the same day, together with the changes that it made to the other stages: on a decision card in the project's thread the maintainer chose to pass the step view and the work board as drawn ("모두 그린 대로 통과", pass all as drawn). The checkpoint covered: the step control above a DDD board, with stage 08's words, and the five frames of the steps, which show how a step is laid out from the timeline ([Across the screens](#across-the-screens)). The tokens stay frozen: the control uses only them, and the steps' stickies keep the editor's colours, with pink for external systems and pale yellow for actors, as stage 01's legend has them.

Passed on 2026-11-03 at 11:39 KST, together with the joint checkpoint of stages 03 to 08: on a decision card in the project's thread the maintainer chose all the recommendations ("모두 추천대로", all as recommended), so the tokens are frozen for NEXUS 0.2 as recommended below. The checkpoint covered:

1. The states drawn after the choice, above all the hub page's additions on SCR-101 and SCR-104 and the panels' loading, stale and gone states.
2. The words the mockups added to stage 08's messages.
3. The two differences from phase 1 above, and the skipped and not-recorded stages, which joined the tokens with a skipped stage's text darkened to 4.5:1.

## Notes for later stages

### Stage 10: work breakdown

- For the redesign: the hub page's template takes the new tokens in the core plugin's repository, in the pull request that changes the hub's `comment` and `reply`, and `hub-ref.json` moves to its exact commit; the views' custom properties follow from the same files. The same pull request gives the counts on a done stage `color.done-fg`, and may correct the Korean hint of the hub's search, which names REQ-01 where the English names REQ-001.
- One task builds the custom properties from the resolver, the base and each theme, in the order that it gives, for the views and for 0.2's parts of the hub page; the frames' styles show the names in use.

### Stage 11: development

- For the redesign: the views take every length from the tokens, the frames' gaps of 6 and 10 pixels from the nearest step of `space`; the server serves the subsets of the two fonts with the views' code, from its own origin (REQ-147); the picture view gives the editor `#ffffff` as its background in the dark theme too, so that the editor's filter turns it into `color.picture-ground` (BUG-595); the shapes of the states and the symbols are SVG icons (BUG-596).
- The views take every colour and length from the tokens; the picture's own drawing keeps the editor's colours, inverted in dark mode as the editor does.
- Marks are buttons with names that say what they count, as the frames name them; they keep their size at every zoom and merge for each context at the whole picture.
- In the frames an item's ID is text with the look of phase 1's button; the hub page keeps the button, which opens the trace view.
- The step view lays each step out from the picture source's timeline and context tables, as the five frames show, and keeps no layout (SPEC-141).

### Stage 12: QA

- For the redesign: the 53 contrast pairs of each theme computed again from the frozen values, with the hub page's counts on a done stage; the picture's ground in the dark theme looked at in a browser; and the font files and bytes of the first page with an empty cache, against REQ-149.
- Each state at 320 and 1440 pixels, in both themes and languages, measured with the page check and looked at as images, with the contrast pairs above computed again from the frozen tokens.
- The step control at the first and the last step, on a board without a timeline, and with an address that holds `step=` (SPEC-141).
