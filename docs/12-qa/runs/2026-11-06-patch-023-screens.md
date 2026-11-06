# NEXUS 0.2.3 screen patch verification

[한국어](2026-11-06-patch-023-screens.ko.md)

NEXUS 0.2.3 makes the current screens readable without changing their structure. The maintainer approved the patch, its release and the hub plugin change on 2026-11-06 KST. The picture-first redesign follows separately.

## What changed

| Item | Change | Evidence |
| --- | --- | --- |
| Stage records | `.corthex/stages/nexus.json` records the stages that have a documented checkpoint or decision: 01–06 and 10 done, 07–09, 11 and 12 in progress, each with its next action. No record was made up for a stage without one. | The hub reads the file as a repository record. |
| DDD contexts without items | In the whole picture, a context with no items no longer takes the default place of an empty bound. Such frames stand in one row below the board. | `view-layout.test.js`. On the two real boards read on 2026-11-06, CORTHEX's memory part went from 10 overlapping frame pairs to 0 and NEXUS's own board from 18 to 9. |
| Wheel over a picture | A plain wheel or two-finger scroll moves the page, and the first time shows a hint. Ctrl or ⌘ with the wheel, which is also how a trackpad pinch arrives, zooms the picture. Excalidraw keeps its own zoom. The first SVG picture, its marks and the ERD viewer zoom through the NEXUS camera, with small steps added up until the viewer's rounded zoom changes. Phone touch is unchanged. | Browser walk below. SCR-105 updated. |
| Item panel words | Source fields read as words: Context, Terms, Primary key, Unique, Foreign keys, Path, Flows and Purpose, with "None" for an empty field. A foreign key reads as a sentence with its delete action. The source fields stay under Details. | `fields.test.js`, `preview-limit.test.js`. SCR-106 updated. |
| Discrepancy reasons | Each reason reads as one sentence, by table or screen, in the item panel and the stage overview. The reason codes stay under Details. | `fields.test.js`, `view-overview.test.js`. SCR-109 updated. |
| Stage overview checks | Each check reads as its message, with its rule and other codes under Details. | `view-overview.test.js`. SCR-109 updated. Found during the browser walk. |
| ERD removed mark | A removed table's comment line in the ERD picture uses the page's language. | Browser walk. Found during the walk. |
| Hub page | The hub plugin change is [kodonghui/corthex#155](https://github.com/kodonghui/corthex/pull/155) at `d486437`. Checks start folded unless one is an error, and the summary counts each level. Korean texts cover the checks whose snapshot message is English only. Entries from the project's own settings keep their words, with a "원문" mark in Korean. The project's ask-before entries keep an inherited one that they repeat with more words. `hub-ref.json` pins `d486437`, and `nexus/src/hub.html` equals its template. | The upstream suite and the page assertions, below. |
| Words | Stage 08 holds every new word in "Words 0.2.3 added". `nexus/ui/messages.js` is compiled from it. | `fields.test.js` checks that every new key comes from stage 08. |

The rebuilt browser code renames 209 of the 446 files under `nexus/src/view-code` and changes three. The build uses the pinned external esbuild 0.28.2 and checks the browser package versions. A rebuild of the previous commit in a clean copy also differed from the committed files, so the renaming comes from the build environment. The Excalidraw chunk that carries the reviewed compiled-WASM substring has a new name. Its entry in `nexus/ui/vendor/public-constants.json` was added after the same value hash and the pinned source hash were checked.

## Checks

| Check | Result |
| --- | --- |
| `node --test nexus/test/*.test.js` (Node 24.22.1) | 264 tests, 264 pass |
| `python -m unittest discover -s tests -v` with the pinned hub checkout | 13 tests OK |
| Wrangler dry run | OK, 23,305.80 KiB, gzip 15,977.88 KiB |
| OpenAPI validator and the five offline contract checks | OK |
| Standalone HTTP and SQLite with Schemathesis | 32 operations. 154 of 154 cases passed each of the five checks. |
| `python nexus/test/browser_check.py` (Chromium 1243 headless) | 8 of 8 suites work |
| Upstream `python -m unittest discover -s tests -v` and four strict plugin validations | 1,583 tests OK, 18 skipped. All four validations pass. |

In one earlier run in the same container, `whole-picture-fits-300-native-nodes` stopped at its 15-second wait for the native editor. The previous commit stopped at the same point in that container at that time. The final run passed with the unchanged wait. A copy of the suite with 90-second waits also passed all eight suites.

## Browser walk

The walk used Playwright with Chromium 1243 in the cloud session. Ego lite and Aside run on a computer that this session cannot reach. They walk production after the release. The synthetic data was the view fixture with five contexts, four discrepancy kinds, three checks and a project ask-before list. Of the contexts, one had rows, two had no items, one had only an external system and one had an external system and an aggregate. For this board the previous layout put the two item-less frames at one place over the first context, with three overlapping pairs. The patched layout has none, and the screenshot shows the two frames side by side below the board.

The flow was hub → stage cell 01 → picture 01 → wheel and Ctrl+wheel → item CTX-001 → picture 05 → Ctrl+wheel → item TBL-002 → stage overview 05. It ran in English and Korean, at 1440×1000 and 390×844, in light and dark themes.

| Step | Observed |
| --- | --- |
| Hub | Checks folded: "점검 (3) · 경고 2 · 참고 1" / "Checks (3) · 2 warnings · 1 note". The project's ask-before entries showed "원문 deletions (repositories, data) · 결제" and "이 프로젝트에서 먼저 묻지 않는 것: 배포". |
| Picture 01, wheel | A plain wheel moved the page 300 px and left the zoom at 16%. The hint appeared once and not on the next turn. Ctrl+wheel took the zoom from 16% to 26%, and the page stayed where it was. At 390 px, where Excalidraw hides its zoom figure, the picture changed and the page stayed. |
| Item CTX-001 | "목적: Take an order", with the source under "자세히" closed. |
| Picture 05 | Ctrl+wheel changed the ERD picture. The page moved 0 px and the page scale stayed 1. The removed table read "TBL-004 · CTX-001 · 지움". |
| Item TBL-002 | "외래 키: order_id → orders (id). 가리키는 행을 지우면 이 행도 지워집니다." and "Foreign keys: order_id → orders (id). Deleting the referenced row also deletes this row." The discrepancy read "01 보드는 이 용어를 CTX-001에 두고, 이 표는 CTX-002에 있습니다." |
| Stage overview 05 | Four reasons as sentences, among them "이 표에 맞는 01 용어가 없습니다." and "No 05 table names this aggregate.". The check read as its message, and its rule was under Details. |

All 64 steps passed, with no console errors and no horizontal overflow. In an intermediate run the page appeared to move on Ctrl+wheel. Playwright had scrolled the picture into view to take an element screenshot. A probe that logged each wheel event confirmed that the event was cancelled and the page stayed. The walk then took viewport screenshots.

## Left open

- A context without rows but with glossary terms has its terms drawn 300 below its external system. When the next context in the source also has no rows, the two frames can touch. A first version of the walk's board showed this. Neither real board has such a pair, and the redesign redraws the DDD picture.
- Nine frame pairs on NEXUS's own board still overlap. They are contexts whose events share the timeline lanes, so their bounding frames cross. The redesign addresses this.
- The stage overview shows each check's scanner message, which is English. The hub has Korean texts for these checks.
- Production with real data, a phone's touch and the ego lite or Aside walk follow the release.
