# The grey pages' scripts

Two pages of grey wireframes are drawn by these scripts from the files of this checkout, on Python 3.8 or later with its standard library alone:

| Page | Script | What it draws |
| --- | --- | --- |
| [revision-wireframes.html](../../docs/08-screens/nexus/revision-wireframes.html) | [revision_wireframes.py](revision_wireframes.py) | Stage 08's frames of each state row of the design revision of 2026-11-11, at 390 and 1,440 pixels, from the definitions' revision sections |
| [picture-stage-views.html](../../docs/09-mockup/nexus/picture-stage-views.html) | [picture_stage_views.py](picture_stage_views.py) | Stage 09's sheet of the picture stage's four views, at 1,280 and 1,440 pixels |

Both take every label of a frame from stage 08's words tables, [revision-words.md](../../docs/08-screens/nexus/revision-words.md), [redesign-words.md](../../docs/08-screens/nexus/redesign-words.md) and the tables of its [README](../../docs/08-screens/nexus/README.md#messages), with their Korean forms, and stop with an error when a frame asks for a label that no table holds. [wf_base.py](wf_base.py) reads the words and holds the small pieces of HTML, [wf_frames.py](wf_frames.py) draws the parts of the frames, and [wf_css.py](wf_css.py) holds the pages' styles and their script.

## Drawing a page again

A change to a row or a word that a page draws draws the page again in the same commit. From the repository's root:

```sh
python -W error tools/grey_pages/revision_wireframes.py
python -W error tools/grey_pages/picture_stage_views.py
```

Each writes its page in place, says how many frames and labels it drew and names each label that two words tables translate otherwise, of which a frame draws the first form; `--out FILE` writes it elsewhere. [tests/test_grey_pages.py](../../tests/test_grey_pages.py) draws both pages and holds them to the committed files byte for byte, so a page edited by hand, or a change that the page does not follow, fails it.

## Measuring a page

[measure.mjs](measure.mjs) measures the pages in a browser. The builder runs it by hand after drawing a page again, with Node 24 and a Chrome that it has; no test and no dependency of the repository names it. It opens an owned headless Chrome over the DevTools protocol, as the browser regressions of `nexus/test` do, reads the pages as local files and reaches no network:

```sh
NEXUS_CHROME=/absolute/path/to/chrome node tools/grey_pages/measure.mjs
```

With no page named, it measures both pages. For each one:

- At widths of 320, 390, 1,280 and 1,440 pixels, in light and dark mode and in English and Korean, 16 runs: the page does not scroll sideways, it shows the language that was picked, and the console shows no error.
- Each frame at its own size, in English and in Korean: no element leaves its frame sideways or is cut by a column of the frame, a picture's canvas apart, which cuts what it holds as a picture larger than its view does; and no word is wider than its button, tag or tab.

It prints each problem with its frame and the counts, and exits with 1 when it finds one. On 2026-11-12, for TASK-285, in headless Chromium: revision-wireframes.html, 16 runs and 128 measurements of frames, and picture-stage-views.html, 16 runs and 32 measurements, with no problem. A page that scrolled sideways, a console error, a button narrower than its word and text that a column cut were each found. Looking at the frames stays a person's step: the measurements find what overflows, not what reads badly.
