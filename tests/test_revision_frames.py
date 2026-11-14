"""TASK-286: the design revision's states in the redesign's look, docs/09-mockup/nexus/revision.html.

Stage 09 draws the page with the script that drew redesign.html, kept outside the repository, and measures it in a
browser by hand (its README, "Checks run"). This test keeps what needs no browser:

- each state row of the revision in stage 08's definitions has its frames at 390 and 1,440 pixels, and the page draws
  no other state and no width but 390, 1,152, 1,280 and 1,440 pixels;
- each definition of SCR-110 to SCR-115 and SCR-130 links its frames, in English and in Korean;
- the page's custom properties are the frozen tokens as nexus/ui/tokens.css compiles them, with no other value; and
- the pairs of colour that the frames draw, as a browser read them from the 78 frames in both themes and languages on
  2026-11-12 and mapped them back to tokens (TC-1772), are computed again from the frozen values of both themes: text
  at least 4.5:1, and the borders of fields and buttons, the selected tab's line, the selected item's outline, the
  marks and the icons at least 3:1. Disabled controls and the lines that only separate or edge a tag are not held to
  a need, as WCAG's contrast criteria do not hold them.

`python tests/test_revision_frames.py --count` prints what the checks read."""

import collections
import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from test_screen_states import state_rows  # noqa: E402

PAGE = ROOT / "docs/09-mockup/nexus/revision.html"
SCREENS = ROOT / "docs/08-screens/nexus"
TOKENS_CSS = ROOT / "nexus/ui/tokens.css"
THEMES = {theme: ROOT / ("design/nexus/theme/%s.tokens.json" % theme) for theme in ("light", "dark")}
WIDTHS = {"390", "1152", "1280", "1440"}
SCREENS_OF_THE_REVISION = ("SCR-110", "SCR-111", "SCR-112", "SCR-113", "SCR-114", "SCR-115", "SCR-130")
TEXT, SHAPE = 4.5, 3.0
# (foreground, ground, need, where the frames draw it). Where two tokens hold one value in both themes, the browser
# cannot tell them apart, and the pair names the token that the style uses.
PAIRS = (
    ("text", "surface", TEXT, "words on a card, a panel, the talk and the sheets"),
    ("text", "bg", TEXT, "words on the first page and on a phone's page"),
    ("text", "sunken", TEXT, "the workspace's head and the list of stages"),
    ("text", "accent-soft", TEXT, "a selected row"),
    ("text", "info-bg", TEXT, "the bar after a removal, and the line on why the stage does not show an item"),
    ("text", "error-bg", TEXT, "an error's message"),
    ("text", "warn-bg", TEXT, "a warning's message"),
    ("muted", "surface", TEXT, "times, commits, counts and lines of help"),
    ("muted", "bg", TEXT, "the times on the first page"),
    ("muted", "sunken", TEXT, "the times and the help in the workspace's head"),
    ("muted", "accent-soft", TEXT, "a selected row's count"),
    ("muted", "info-bg", TEXT, "secondary words in a bar"),
    ("muted", "error-bg", TEXT, "the trace ID under an error"),
    ("accent", "surface", TEXT, "links, IDs and My turn"),
    ("accent", "bg", TEXT, "IDs on the first page"),
    ("accent", "sunken", TEXT, "links in the workspace's head"),
    ("accent", "accent-soft", TEXT, "a selected stage's number"),
    ("accent", "error-bg", TEXT, "the link to all projects in an error"),
    ("error", "surface", TEXT, "the words of the removal's button"),
    ("warn", "warn-bg", TEXT, "the words of the mark of a long wait"),
    ("on-accent", "accent", TEXT, "the main button and a count of my turn"),
    ("control-line", "surface", SHAPE, "a field's and a button's border"),
    ("control-line", "bg", SHAPE, "the border of Picture and List and of the talk's tabs on a page"),
    ("control-line", "sunken", SHAPE, "a button's border in the workspace's head"),
    ("control-line", "info-bg", SHAPE, "a button's border in a bar"),
    ("control-line", "error-bg", SHAPE, "Try again's border in an error"),
    ("control-line", "warn-bg", SHAPE, "a button's border in a warning"),
    ("control-line", "picture-ground", SHAPE, "the picture's buttons"),
    ("accent", "surface", SHAPE, "the main button's border and a selected filter"),
    ("error", "surface", SHAPE, "the removal's button's border"),
    ("text", "bg", SHAPE, "the selected tab's line"),
    ("focus", "picture-ground", SHAPE, "the outline of the item that the talk selected"),
    ("info", "info-bg", SHAPE, "the icon of a bar and of a note"),
    ("accent", "bg", SHAPE, "an icon in a link"),
    ("error", "error-bg", SHAPE, "the error's icon"),
    ("warn", "warn-bg", SHAPE, "the mark's shape"),
    ("warn", "sunken", SHAPE, "the mark's shape on the folded list of stages"),
    ("muted", "surface", SHAPE, "the search field's icon and a clip's icon"),
    ("muted", "bg", SHAPE, "an icon on the first page"),
    ("muted", "sunken", SHAPE, "an icon in the workspace's head"),
    ("muted", "accent-soft", SHAPE, "an icon in a selected row"),
    ("text", "surface", SHAPE, "an icon in a button"),
    ("text", "sunken", SHAPE, "a stage's shape in the list of stages"),
    ("text", "bg", SHAPE, "an icon on a phone's page"),
    ("text", "accent-soft", SHAPE, "a selected stage's shape"),
    ("text", "picture-ground", SHAPE, "the picture's drawing tools"),
)


def page():
    return PAGE.read_text(encoding="utf8")


def drawn():
    """{state: Counter of widths} of the page's frames."""
    found = collections.defaultdict(collections.Counter)
    for tag in re.findall(r'<figure\b[^>]*\bdata-state="[^"]*"[^>]*>', page()):
        found[re.search(r'\bdata-state="([^"]*)"', tag).group(1)][re.search(r'\bdata-width="([^"]*)"', tag).group(1)] += 1
    return found


def revision_states():
    """The states that the revision's rows of stage 08's definitions name, read as tests/test_screen_states.py reads
    them."""
    return {row.cells[0] for _, row in state_rows() if row.revision}


def properties(text):
    """The (name, value) pairs of the --nx-* custom properties that a style sheet defines."""
    return {(name, value.strip()) for name, value in re.findall(r"(--nx-[a-z0-9-]+):\s*([^;}]+);", text)}


def colours(theme):
    """{token: hex} of a theme's colours, with the mark's group flattened as its custom properties name it."""
    found = {}

    def walk(node, path):
        if isinstance(node, dict) and "$value" in node:
            value = node["$value"]
            if isinstance(value, dict) and value.get("alpha", 1) == 1:
                found["-".join(path)] = value["hex"].lower()
        elif isinstance(node, dict):
            for key, child in node.items():
                if not key.startswith("$"):
                    walk(child, path + [key])

    walk(json.loads(THEMES[theme].read_text(encoding="utf8"))["color"], [])
    return found


def ratio(first, second):
    def luminance(colour):
        channels = [int(colour[i:i + 2], 16) / 255 for i in (1, 3, 5)]
        channels = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]

    lighter, darker = sorted((luminance(first), luminance(second)), reverse=True)
    return (lighter + 0.05) / (darker + 0.05)


class RevisionFramesTest(unittest.TestCase):
    def test_each_state_row_of_the_revision_has_its_frames_at_390_and_1440_pixels(self):
        rows, frames = revision_states(), drawn()
        self.assertEqual(len(rows), 28, "the revision's 28 state rows")
        missing = ["%s: %s" % (state, dict(frames.get(state, {}))) for state in sorted(rows)
                   if not frames.get(state, {}).get("390") or not frames.get(state, {}).get("1440")]
        self.assertEqual(missing, [], "state rows of the revision without a frame at 390 and at 1,440 pixels")
        self.assertEqual(sorted(set(frames) - rows), [], "frames of a state that no row of the revision tells")
        widths = {width for found in frames.values() for width in found}
        self.assertEqual(sorted(widths - WIDTHS), [], "frames at a width that the revision does not draw")

    def test_each_definition_links_its_frames(self):
        anchors = set(re.findall(r'\bid="([^"]+)"', page()))
        unlinked = []
        for screen in SCREENS_OF_THE_REVISION:
            anchor = screen.lower()
            self.assertIn(anchor, anchors)
            for path in sorted(SCREENS.glob(screen + "-*.md")):
                if "../../09-mockup/nexus/revision.html#%s)" % anchor not in path.read_text(encoding="utf8"):
                    unlinked.append(path.name)
        self.assertEqual(unlinked, [], "definitions without a link to their frames in revision.html")

    def test_the_page_holds_the_frozen_tokens_and_no_other_value(self):
        tokens, drawn_properties = properties(TOKENS_CSS.read_text(encoding="utf8")), properties(page())
        self.assertGreater(len(tokens), 100)
        self.assertEqual(sorted(drawn_properties - tokens), [], "custom properties that are not the frozen tokens")
        self.assertEqual(sorted(tokens - drawn_properties), [], "frozen tokens that the page leaves out")

    def test_the_pairs_that_the_frames_draw_meet_their_need_in_both_themes(self):
        self.assertEqual(len(PAIRS), len(set(PAIRS)))
        under = []
        for theme in THEMES:
            values = colours(theme)
            for foreground, ground, need, where in PAIRS:
                self.assertIn(foreground, values, "%s is a frozen colour of the %s theme" % (foreground, theme))
                self.assertIn(ground, values, "%s is a frozen colour of the %s theme" % (ground, theme))
                found = ratio(values[foreground], values[ground])
                if found < need:
                    under.append("%s: %s on %s, %.2f:1 under %.1f:1 (%s)" % (theme, foreground, ground, found, need, where))
        self.assertEqual(under, [])


def count():
    frames = drawn()
    print("states drawn: %d, frames: %d" % (len(frames), sum(sum(found.values()) for found in frames.values())))
    for theme in THEMES:
        values = colours(theme)
        for kind, need in (("text", TEXT), ("lines and shapes", SHAPE)):
            low = min((ratio(values[f], values[g]), f, g) for f, g, n, _ in PAIRS if n == need)
            print("%s, %s: %d pairs, lowest %.2f:1 (%s on %s)" % (theme, kind, sum(1 for p in PAIRS if p[2] == need), *low))


if __name__ == "__main__":
    if sys.argv[1:] == ["--count"]:
        count()
    else:
        unittest.main()
