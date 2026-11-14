"""TASK-285: the two grey pages, drawn again by their generators, equal the committed files byte for byte.

The generators in tools/grey_pages read the definitions and the words tables of this checkout with Python's standard
library alone: revision_wireframes.py draws stage 08's revision-wireframes.html and picture_stage_views.py stage 09's
picture-stage-views.html. A change to the rows or the words that a page draws draws the page again in the same commit
(tools/grey_pages/README.md). Measuring the pages in a browser stays a step that the builder runs by hand."""

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GENERATORS = ROOT / "tools" / "grey_pages"
PAGES = {
    "revision_wireframes.py": ROOT / "docs" / "08-screens" / "nexus" / "revision-wireframes.html",
    "picture_stage_views.py": ROOT / "docs" / "09-mockup" / "nexus" / "picture-stage-views.html",
}


def first_difference(drawn, committed):
    """The first line where two pages differ, as (line number, drawn line, committed line)."""
    first, second = drawn.decode("utf8").split("\n"), committed.decode("utf8").split("\n")
    for number, (mine, theirs) in enumerate(zip(first, second), 1):
        if mine != theirs:
            return number, mine[:200], theirs[:200]
    return min(len(first), len(second)) + 1, "%d lines" % len(first), "%d lines" % len(second)


class GreyPagesTest(unittest.TestCase):
    def test_each_generator_draws_its_page_as_committed(self):
        with tempfile.TemporaryDirectory() as folder:
            for script, page in PAGES.items():
                with self.subTest(page=page.name):
                    drawn = Path(folder) / page.name
                    run = subprocess.run([sys.executable, "-W", "error", str(GENERATORS / script), "--out", str(drawn)],
                                         capture_output=True, timeout=300)
                    self.assertEqual(run.returncode, 0, run.stderr.decode("utf8", "replace")[-2000:])
                    if drawn.read_bytes() != page.read_bytes():
                        self.fail("%s differs from its generator's drawing at line %d:\n drawn:     %s\n committed: %s\n"
                                  "Draw it again with tools/grey_pages/%s, or put the change in the generator."
                                  % ((page.relative_to(ROOT),) + first_difference(drawn.read_bytes(), page.read_bytes())
                                     + (script,)))

    def test_the_generators_name_no_path_outside_the_repository(self):
        for path in sorted(GENERATORS.glob("*.py")):
            text = path.read_text(encoding="utf8")
            for outside in ("/home/", "/mnt/", "/tmp/", "C:\\", "file://"):
                self.assertNotIn(outside, text, "%s names a path outside the repository" % path.name)


if __name__ == "__main__":
    unittest.main()
