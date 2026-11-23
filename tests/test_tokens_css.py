"""The pages' token CSS is the pinned hub's tokens.py output of design/, so the tokens keep one source.

`server/web/tokens.css` holds the design tokens of design/tokens.resolver.json as CSS custom properties, the light theme
on `:root` and the dark theme on `[data-theme="dark"]`, as the stage-09 mockup carries them. It is never edited by hand:
this test makes the CSS again with the pinned hub's `tokens.py css`, the clean checkout at the commit of `hub-ref.json`
that `CORTHEX_HUB_CHECKOUT` names (prepare it with `python tools/fetch_hub_ref.py`), and fails when the committed file
differs, as when a token changed in design/ or a new hub pin writes it otherwise. It also checks that the mockup's own
token block is the same text, so the pages and the approved mockup read the same tokens. Nothing is fetched.

To write the file again, from the repository's root:

    CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_tokens_css.py --write
"""

import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from hub_ref import locate_hub  # noqa: E402

TOKENS = "plugins/corthex/skills/corthex-screen/scripts/tokens.py"
RESOLVER = "design/tokens.resolver.json"
TARGET = ROOT / "server" / "web" / "tokens.css"
MOCKUP = ROOT / "design" / "mockup" / "nexus-mockup.html"
HEAD = ("/* server/web/tokens.css: the tokens of design/, written by tests/test_tokens_css.py --write with the pinned hub's "
        "tokens.py, light then dark. */\n")
# Each theme as tokens.py css prints it: its arguments after the resolver.
THEMES = ([], ["--input", "theme=dark", "--selector", '[data-theme="dark"]'])


def theme_css(hub, arguments):
    result = subprocess.run([sys.executable, "-I", str(hub / TOKENS), "css", RESOLVER, *arguments], cwd=ROOT,
                            capture_output=True, timeout=120)
    if result.returncode:
        raise AssertionError("the pinned hub's tokens.py css failed on design/tokens.resolver.json")
    return result.stdout.decode("utf-8").replace("\r\n", "\n")


def made_css():
    hub = locate_hub()
    return HEAD + "".join(theme_css(hub, arguments) for arguments in THEMES)


def without_comments(text):
    """The CSS without its /* */ comment lines, which name the file each copy was written from."""
    return "".join(line for line in text.splitlines(keepends=True) if not line.startswith("/*"))


class TokensCssTest(unittest.TestCase):
    def test_the_committed_css_is_the_pinned_hubs_output(self):
        again = "write it again as this file's docstring says"
        self.assertEqual(TARGET.read_text(encoding="utf-8"), made_css(),
                         f"server/web/tokens.css differs from the pinned hub's tokens.py output of design/: {again}")

    def test_the_mockup_carries_the_same_tokens(self):
        page = MOCKUP.read_text(encoding="utf-8").replace("\r\n", "\n")
        start = page.index("/* tokens: written by tokens.py css")
        end = page.index("/* end of tokens */")
        self.assertEqual(without_comments(page[start:end]), without_comments(TARGET.read_text(encoding="utf-8")),
                         "the stage-09 mockup's token block and server/web/tokens.css differ")


if __name__ == "__main__":
    if sys.argv[1:] == ["--write"]:
        TARGET.write_text(made_css(), encoding="utf-8", newline="\n")
        print("Wrote server/web/tokens.css")
    else:
        unittest.main()
