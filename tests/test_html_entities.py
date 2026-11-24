"""NEXUS decodes HTML character references as Python's html.unescape does (TASK-470).

The pinned hub's `plain` turns Markdown and HTML into plain text with Python's `html.unescape`, and its stage-01 reader
(domain.py) reads every heading and table cell through it. `server/src/picture-text.js` ports `plain` for NEXUS's own
reading of a proposal's Markdown, so it needs the same tables: the HTML5 named character references
(`html.entities.html5`), the numeric references Python replaces (`html._invalid_charrefs`) and those it drops
(`html._invalid_codepoints`). `server/src/html-entities.json` stores them; this test makes them again from this
Python and fails when they differ. Nothing is fetched.

To make the file again, from the repository's root:

    python tests/test_html_entities.py --write
"""

import html
import html.entities
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "server" / "src" / "html-entities.json"


def tables():
    """What the file holds, as this Python's html module has it."""
    return {
        "about": "Python's html.unescape tables, which server/src/picture-text.js decodes character references with. "
                 "tests/test_html_entities.py checks them and says how to make them again.",
        "named": dict(sorted(html.entities.html5.items())),
        "replaced": {str(code): text for code, text in sorted(html._invalid_charrefs.items())},
        "dropped": sorted(html._invalid_codepoints),
    }


class HtmlEntitiesTest(unittest.TestCase):
    def test_the_stored_tables_are_pythons(self):
        stored = json.loads(FIXTURE.read_text(encoding="utf-8"))
        self.assertEqual(stored, tables(), "make it again as this file's docstring says")


if __name__ == "__main__":
    if sys.argv[1:] == ["--write"]:
        FIXTURE.write_text(json.dumps(tables(), indent=0, ensure_ascii=True) + "\n", encoding="utf-8", newline="\n")
        print("Wrote Python's html.unescape tables")
    else:
        unittest.main()
