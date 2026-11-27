# NEXUS v3: screen states

[한국어](README.ko.md)

Status: passed on 2026-11-23.

Inputs: the sitemap (stage 07, five screens), the functional spec (stage 04), the API contract (stage 06, its responses and error codes), and, as in stage 07, the click mockup of 2026-11-21, kept in the project's records, as the starting point. One definition file per screen; states are written as `SCR-142#empty`.

## 1. Screens and states

| Screen | States |
| --- | --- |
| [SCR-142 Owner to-do](SCR-142.md) | normal, loading, empty, error, permission, stale |
| [SCR-143 Projects](SCR-143.md) | normal, loading, empty, error, permission, stale, secret |
| [SCR-144 Project](SCR-144.md) | normal, loading, empty, error, permission, stale, delete |
| [SCR-145 Stage workbench](SCR-145.md) | normal, loading, empty, error, permission, stale, waiting, confirmed, not-drawn, workshop |
| [SCR-146 Changes since the last confirmation](SCR-146.md) | normal, loading, empty, error, permission, stale, waiting, not-drawn, confirmed |

## 2. What every screen shares

- Header. Every screen has the 2026-11-21 mockup's header: NEXUS, the project menu, "My turn N" and the dark-screen switch. When the count or the menu cannot be read, it is left out and the rest of the screen works.
- Messages. A screen shows the message of the error code in the contract's list (stage 06), in Korean, with the request's `traceId` under "Something went wrong". A definition says where it shows more.
- Repeats. A button is off while its request runs, and one result shows. Each new write carries a new request key. A retry after a timeout or a lost connection sends the same key, so a write that went through is not done twice and its first result comes back (rule 3 of the spec); the key changes only when the owner changes the input.
- Stale. A screen shows when it read its data and reads again when its tab comes back into view. A 409 that says the data changed keeps what the owner typed and offers a reload.
- Phone. On a phone, a touch screen narrower than 1056 pixels, every screen uses the phone layout: one column, and the work panel becomes a sheet under the diagram with the threads and the comment box. Moving, direct edits (renaming, connecting, cancelling an edit, and a workshop's sticky notes, steps and Miro import), answering proposals, confirming and cancelling a confirmation, credentials, tool links and deletion are not offered there, with a note to use a PC (SPEC-051); comments and replies work. A narrow window on a PC stacks the panel under the diagram and keeps every action. Each state's 360-pixel frame is its phone layout, except for a state that only a PC action leads to (SCR-143#secret, SCR-144#delete, SCR-146#confirmed, SCR-146#not-drawn): its 360-pixel frame is a narrow PC window.
- Widths. Each state is drawn at 360 and 1440 pixels, the phone and the mockup's width. Long names wrap by word (Korean too) and never push the work panel off the screen.
- Data exposure. Pages load only the owner's data through the owner operations; an agent credential's secret shows once, on the page that issued it, and never again.

## 3. Responses and states

Every response the contract lists for an operation a screen calls leads to one state. Where a code leads to more than one, the state tables name the example, as in `API-275#409 (not-drawn)`. These are the defaults; a definition says where its screen differs. The contract has no 429 or 503. The stale state also comes from time: a screen shows when it read its data.

| Response | State | What the owner sees by default |
| --- | --- | --- |
| 200, 201 | normal | The data, or the action's result in place |
| 200 with nothing in it | empty | What will appear here and how it gets here |
| 400, 413 | error | The message beside the input it concerns; the input is kept |
| 401 | permission | "Sign in again"; the page goes to the gate and comes back here, keeping an unsent comment (SPEC-048) |
| 403 | permission | not-owner: "Only the owner of this NEXUS can open it" and nothing else; cross-site: "This change has to come from NEXUS itself" and a reload |
| 404 | error | That the item is no longer there, and a link to where it was listed. By example: tool-link-not-found and workshop-not-found lead to normal (the link is gone; no workshop is open) |
| 409 | stale | That it changed: reload, then try again. By example: request-key-reused and name-taken lead to error; waiting-reflection to waiting, not-drawn to not-drawn and workshop-open and step-empty to workshop where the screen has that state, otherwise to stale |
| 415, default, a timeout or no network | error | A short message and a retry; the rest of the screen still works |

## 4. From the 2026-11-21 mockup

As in stage 07, the states start from the mockup's workbench. The work panel's three sections (this diagram's state, AI proposals, the selected element) are SCR-145's normal state, and the mockup's "changed since the confirmation" list becomes SCR-146. The screens speak Korean; the mockup's words carry over like this:

| Mockup | v3 | Why |
| --- | --- | --- |
| 이 그림의 상태 · 확정 전 / 확정함 | (kept) | - |
| AI가 만든 제안이에요. 반영하기 전에는 그림에도, 문서에도 들어가지 않아요. | AI가 만든 제안이에요. 수락하고 에이전트가 반영하기 전에는 문서에 들어가지 않아요. | reflection follows acceptance through an agent's pull request (stage 07, difference 5) |
| 반영했어요. 보드에 실선 스티커로 들어갔어요. | 수락했어요. 에이전트가 문서에 넣으면 실선이 돼요. | stage 07, difference 5 |
| 거절했어요. | 거절했어요. 스레드는 열려 있어요. | the thread stays open (SPEC-020) |
| 되돌리기 / AI 이름으로 되돌리기 | 편집 취소(직접 편집만) | stage 07, difference 6 |
| 확정한 뒤 바뀐 곳이 N개 있어요. 다시 확정하면 도메인 문서에 반영돼요. | 확정한 뒤 바뀐 곳이 N개 있어요. 다시 확정하면 에이전트가 기록해요. | stage 07, difference 7 |
| 확정을 풀었어요. 도메인 문서는 마지막으로 확정한 내용 그대로예요. | 확정을 취소했어요. 다시 확정할 때까지 할 일에 남아요. | SPEC-030 |
| 남은 AI 제안은 확정에 들어가지 않아요. | (kept) | - |
| 모두 처리함 | (kept) | - |
| AI가 그린 초안이에요. 스티커를 끌어 옮기고, 두 번 눌러 이름을 바꿔 보세요. | Git 문서에서 그린 그림이에요. 끌어 옮기고, 두 번 눌러 이름을 바꿔 보세요. | the diagram is drawn from Git (SPEC-001) |

## 5. Wireframes

[wireframes.html](wireframes.html) has one frame per state, at 360 and 1440 pixels, in greys, the system font and placeholder text. The loading frames keep the normal frames' layout. The design tokens and the mockup with the real copy are stage 09's, in [design/](../../design/README.md).

## 6. Checkpoint

The screen definitions are approved before implementation. This stage removes, defers or changes no approved item. It reads 3 approved items more narrowly, each asked as its own question; one without its own answer stays as approved.

| Item | Approved text | This stage's reading | Why |
| --- | --- | --- | --- |
| SPEC-051 | Confirming, answering proposals, direct edits and moving → not offered, with a note to use a PC. | A phone does not offer issuing or revoking agent credentials, linking tools or deleting a project space either. | Stage-01 hotspot 5 was answered "view and comment only" for a phone (REQ-068); SPEC-051 names four actions and leaves these three unnamed. The secret shows only once (SPEC-049) and a deletion cannot be undone, so both stay with the PC. |
| SCR-143 (stage 07) | The owner's project spaces with each stage's state and tool links, and the agent credentials: issue one, whose secret shows once, and revoke one. | The projects list shows each project's stages passed out of 13 and its to-do count; each stage's state and the tool links are on SCR-144, one click away. | The approved contract's project list (API-262) returns those counts, not each stage's state or the tool links; showing them here would take one project read per row. |
| SCR-146 (stage 07) | The diff view: every element added, removed or changed since the last confirmed version, before and after (SPEC-034). | Each changed element is marked added, removed or changed, with its name; "before" is a link to the document at the confirmed version in the repository, not a value per element. | SPEC-034 asks to mark the changed elements, and the approved contract (API-265) returns their keys and the confirmed commit, not their earlier values. |

Passed on 2026-11-23. The maintainer approved every recommendation through the delegate they named for checkpoints; the answer is in the project's records.

### Feature change of 2026-11-23

The maintainer chose to draw user flows, screen states and mockups from the first release, with the hub sending their sources. Each approved item the change touches was asked on its own and approved through the delegate they named for checkpoints; the answers are in the project's records. Here: SCR-145's data gains the mockup page (API-293), its normal state says how the pictures of stages 03, 08 and 09 look, and its not-drawn state gives the failure text of each kind. The number of states is unchanged. This stage's part of the change passed its own checkpoint on 2026-11-23 through the same delegate.

#### After the review of pull request 104

Approved items changed, each asked on its own and approved through the same delegate. Here: SCR-145 and SCR-146 take the optional query ?diagram=, SCR-145's data gains the stage's diagrams and its actions "Open another diagram of the stage"; its normal state says how the diagrams are listed, that a mockup's tokens are its elements, that the view reads the page's status first and what happens when the page opens another page. The number of states is unchanged. This part passed its own checkpoint on 2026-11-23 through the same delegate.

#### After the second review of pull request 104

More approved items changed, each asked on its own and approved through the same delegate. Here: the query of SCR-145 and SCR-146 is the existing ?d=. SCR-145's normal state says that the bar above the mockup frame marks it as a mockup page and NEXUS never asks for a sign-in inside it, that the view opens the page again only once and then stops with Open again, that a mockup takes no AI proposals, and that elements, state panels and tokens included, are selected by keyboard too. The number of states is unchanged. This part passed its own checkpoint on 2026-11-23 through the same delegate.

#### After the seventh review of pull request 104

One approved item changed, asked on its own and approved through the same delegate. Here: SCR-145 lists the stage's diagrams also when a removed one is still listed because it has open threads, and its normal state says that a removed diagram comes last, marked removed, and opens with its threads (SPEC-027). The number of states is unchanged. This part passed its own checkpoint on 2026-11-23 through the same delegate.

#### After the eighth review of pull request 104

One approved item changed, asked on its own and approved through the same delegate. Here: on SCR-145 a removed diagram opens for its threads only, with no new comment, move, direct edit, proposal answer or confirm button, and SCR-146 shows only its changes, with no confirm button (SPEC-027). The number of states is unchanged. This part passed its own checkpoint on 2026-11-23 through the same delegate.

#### After the ninth review of pull request 104

One approved item changed, asked on its own and approved through the same delegate. Here: after a 404 for the diagram on a write, SCR-145 reads the diagram again first, and a removed one still listed opens for its threads only; after a confirmation SCR-146 does the same and shows only its changes; otherwise both still say the diagram is not in NEXUS (SPEC-027). The number of states is unchanged. This part passed its own checkpoint on 2026-11-23 through the same delegate.

### Reject on a removed diagram

Building TASK-444 found that a removed diagram's AI proposals could not leave the owner's to-do. The approved text, from the feature change of 2026-11-23, is "on SCR-145 a removed diagram opens for its threads only, with no new comment, move, direct edit, proposal answer or confirm button" (SPEC-027), and from the ninth review of pull request 104, "a removed one still listed opens for its threads only". SPEC-027 refuses accepting a proposal on a removed diagram, not rejecting one, and the owner's to-do keeps a removed diagram's proposals waiting on the owner (the server's README, "Projects and to-do"). So such a proposal waited until its agent withdrew it or the diagram came back. API-271 now takes the rejection there, as API-257 takes a withdrawal (note 7 of the WBS). One approved item changes, asked on its own: SCR-145#normal says that a removed diagram opens for its threads and its AI proposals only, its proposals showing Reject and never Accept, and SCR-145#error opens a removed one still listed for its threads and its proposals' Reject only. Accept stays hidden, since SPEC-027 refuses it. The number of states is unchanged, and TASK-460 draws it. This part passed its own checkpoint on 2026-11-24 through the same delegate.

### Feature change of 2026-11-24

A removed diagram keeps what waits on it: it stays listed and opens while it has an open thread, a proposed AI proposal or a direct edit waiting for reflection (section 6 of the functional spec). A removed diagram shows no confirm button, so SCR-145's waiting state, which a confirm attempt leads to, never shows there; its waiting direct edits are listed in the confirm button's place instead. Two approved items change, each asked on its own:

- SCR-145#normal: "A removed diagram with open threads comes last, marked removed, and opens for its threads and its AI proposals only: its threads are read, answered and closed, its proposals show Reject and never Accept, and no new comment, move, direct edit or confirm button shows (SPEC-027)." becomes "A removed diagram that has an open thread, a proposed AI proposal or a direct edit waiting for reflection comes last, marked removed, and opens for these only: its threads are read, answered and closed, its proposals show Reject and never Accept, and the "This diagram" section lists its direct edits waiting for reflection in place of the confirm button, each with Cancel edit (on a phone, the list without it); no new comment, move, direct edit, confirm button or Cancel confirmation shows (SPEC-027)." Cancel confirmation was not named before; a removed diagram's live confirmation is harmless (note 4 of the WBS), so the page does not offer it, though API-276 takes it (TASK-446).
- SCR-145#error: "a removed one still listed opens for its threads and its proposals' Reject only (SPEC-027)" becomes "a removed one still listed opens for its threads, its proposals' Reject and its waiting direct edits' Cancel edit only (SPEC-027)".

SCR-146 stays: a removed diagram shows only its changes, with no confirm button. SCR-144 has no text about removed diagrams, and the project screen (TASK-457) shows no diagram list. The number of states is unchanged; TASK-458 and TASK-460 draw it. This part passed its own checkpoint on 2026-11-24 through the same delegate.

### The name of opening another diagram

Building TASK-458 (note 5 of the WBS) found that SCR-145's action "Open another diagram of the stage", approved after the review of pull request 104, also opens a removed diagram that is still listed: since the seventh review of pull request 104, such a diagram is listed last, marked removed, and opens (SPEC-027), and since the feature change of 2026-11-24 it stays listed while it has an open thread, a proposed AI proposal or a direct edit waiting for reflection. The name reads as if only the stage's current diagrams opened. One approved item changes, asked on its own: SCR-145's action is now "Open another diagram listed for the stage", and its operation, result and failure are unchanged. The number of states is unchanged. This part passed its own checkpoint on 2026-11-24 through the same delegate.

### Dropping "the other way"

Building TASK-460 found that SCR-145 asks each AI proposal to show "the other way", which the contract does not carry: ChangeSet and ProposalRequest carry a reason and a change only, so an agent writes any other way inside its reason. On pull request 157 the delegate chose this correction over a later contract change that would add a field. One approved item, SCR-145, changes in two places, asked on its own:

- The "AI answers" row: "an AI proposal shows its kind, text, reason and the other way, dashed until accepted and reflected" (Korean: "AI 제안은 종류, 글, 이유, 다른 방법을 보여 주고, 수락·반영 전에는 점선") becomes "an AI proposal shows its kind, text and reason, dashed until accepted and reflected" (Korean: "AI 제안은 종류, 글, 이유를 보여 주고, 수락·반영 전에는 점선").
- SCR-145#normal's "AI proposals" part: ""AI proposals": each with its kind, text, reason and the other way, and Accept and Reject ("All answered" when none)" (Korean: ""AI 제안": 종류, 글, 이유, 다른 방법, 수락·거절(없으면 "모두 처리함")") becomes ""AI proposals": each with its kind, text and reason, and Accept and Reject ("All answered" when none)" (Korean: ""AI 제안": 종류, 글, 이유, 수락·거절(없으면 "모두 처리함")").

Nothing else in SCR-145 changes. The stage-07 README's "an AI proposal with its reason and the other way" stays, as the record of what passed then. The wireframes are made again from the definitions, so the frames of SCR-145#normal and SCR-145#error, which still had the text of the eighth and ninth reviews of pull request 104, also catch up with "Reject on a removed diagram" and the feature change of 2026-11-24; that catch-up is not part of this correction. The number of states is unchanged. This part passed its own checkpoint on 2026-11-24 through the same delegate.

### The workshop's eight sticky kinds

Building TASK-462 found that SCR-145#workshop offers free sticky notes in the legend's six kinds, while steps 2 and 5 of event storming start with the external-system and actor kinds, which the design tokens also colour (`--corthex-sticky-external-system`, `--corthex-sticky-actor`). With six kinds the owner could not add the notes those two steps are for. On pull request 158 the delegate approved adding a note in any of the eight kinds the tokens colour, with the legend kept as the mockup's six. One approved item, SCR-145, changes in one place, asked on its own:

- SCR-145#workshop: "free sticky notes in the six kinds" (Korean: "여섯 종류의 자유로운 스티커") becomes "free sticky notes in the eight kinds the tokens colour (the legend's six, actor and external system)" (Korean: "토큰이 색을 주는 여덟 종류(범례의 여섯과 액터, 외부 시스템)의 자유로운 스티커").

Nothing else in SCR-145 changes, and the legend stays the mockup's six kinds. The stage-07 and stage-09 READMEs' "the six sticky kinds and their colours" stay, as the record of what passed then. The wireframes are made again from the definitions: only SCR-145#workshop's text changes, and no frame. The number of states is unchanged. This part passed its own checkpoint on 2026-11-24 through the same delegate.

### Every change set waiting for reflection

Building TASK-461 found that SCR-146#waiting lists only the direct edits waiting for reflection, while SPEC-029 refuses a confirmation while any change set waits for reflection, an accepted AI proposal included (API-275's 409 `waiting_reflection`). Listing direct edits only, the page could show "Reflect or cancel the waiting changes first" with nothing listed; SCR-145#waiting already lists both. On pull request 160 the delegate chose a stage-08 correction that names every change set waiting for reflection. One approved item, SCR-146, changes in one place, asked on its own:

- SCR-146#waiting: "Direct edits waiting for reflection: they come first, each with Cancel edit (on a phone, without it), and the confirm button is off with "Reflect or cancel the waiting changes first"." (Korean: "반영을 기다리는 직접 편집: 맨 위에 각각 편집 취소와 함께(휴대폰에서는 없이). 확정 버튼은 꺼지고 "반영을 기다리는 변경을 먼저 반영하거나 취소하세요".") becomes "Every change set waiting for reflection: they come first, each direct edit with Cancel edit (on a phone, without it) and each accepted AI proposal without it, and the confirm button is off with "Reflect or cancel the waiting changes first"." (Korean: "반영을 기다리는 변경 세트 모두: 맨 위에, 직접 편집은 각각 편집 취소와 함께(휴대폰에서는 없이), 수락한 AI 제안은 편집 취소 없이. 확정 버튼은 꺼지고 "반영을 기다리는 변경을 먼저 반영하거나 취소하세요".").

Nothing else in SCR-146 changes, and the state's response stays API-275#409 (waiting-reflection). The wireframes are made again from the definitions: only SCR-146#waiting's text changes, and no frame. The number of states is unchanged. This part passed its own checkpoint on 2026-11-24 through the same delegate.

The 2026-11-27 guidance correction for SCR-142, SCR-145 and SCR-146 is reflected in the wireframe descriptions and representative frames, including the empty-stage next action and the distinction between a confirmed diagram and a passed stage. No state was added or removed by this synchronization.
