"""The stage-09 design tokens and mockup in `design/`.

- Every token file follows the Design Tokens format: a group has no `$value`, and a token has a `$value` and a
  `$type`, its own or its group's.
- The resolver names only files that exist and every token file in `design/` but those of the Carbon themes it does
  not use, two themes whole, and the project's own tokens are only under `nexus`.
- The Carbon copies are unchanged: `carbon/source.json` names every file in `carbon/`, and each file's SHA-256, taken
  with LF line endings, is the one it names.
- The mockup has one frame for every state of every screen definition in `docs/08-screens/`, at 360 and 1440
  pixels, and no other. Its styles name only custom properties that its token CSS defines, and no colour appears
  outside that token CSS: not in another style block, a style attribute or a style the script sets, whether written
  as a hex value, a colour function or a CSS colour name.
"""
import hashlib
import json
import os
import re
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESIGN = os.path.join(ROOT, "design")
MOCKUP = os.path.join(DESIGN, "mockup", "nexus-mockup.html")
WIDTHS = (360, 1440)
COLOUR = re.compile(r"#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color|color-mix|light-dark)\(")
# The named colours of CSS Color Module Level 4, and the system colours of level 4 that set a colour by themselves.
NAMED = set("""
aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue
chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen
darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue
darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick
floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink
indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray
lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid
mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream
mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen
paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown
royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow
springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen
accentcolor accentcolortext activetext buttonborder buttonface buttontext canvas canvastext field fieldtext graytext
highlight highlighttext linktext mark marktext selecteditem selecteditemtext visitedtext
""".split())


def read(path):
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def token_files():
    found = []
    for folder, _, names in os.walk(DESIGN):
        for name in names:
            if name.endswith(".tokens.json"):
                found.append(os.path.relpath(os.path.join(folder, name), DESIGN).replace(os.sep, "/"))
    return sorted(found)


def walk(node, path, inherited, problems):
    """Collect format problems of a token tree."""
    kind = node.get("$type", inherited)
    for key, value in node.items():
        if key.startswith("$"):
            continue
        where = path + [key]
        if not isinstance(value, dict):
            problems.append("%s is not an object" % ".".join(where))
        elif "$value" in value:
            if not value.get("$type", kind):
                problems.append("%s has no $type" % ".".join(where))
        else:
            walk(value, where, kind, problems)


def mockup_styles():
    """(the token CSS, every other style of the mockup as declarations, one per line)."""
    text = read(MOCKUP)
    blocks = re.findall(r"<style\b[^>]*>(.*?)</style>", text, re.S | re.I)
    styles = "\n".join(blocks)
    start, end = styles.index("/* tokens:"), styles.index("/* end of tokens */")
    tokens, rest = styles[start:end], styles[:start] + styles[end:]
    rest = re.sub(r"/\*.*?\*/", "", rest, flags=re.S)
    attrs = [a or b for a, b in re.findall(r"""\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')""", text)]
    scripts = "\n".join(re.findall(r"<script\b[^>]*>(.*?)</script>", text, re.S | re.I))
    # Styles the script sets: el.style.prop = "value", el.style.setProperty("prop", "value") and el.style.cssText.
    js = ["%s:%s" % m for m in re.findall(r"""\.style\.([A-Za-z]+)\s*=\s*["']([^"']*)["']""", scripts)]
    js += ["%s:%s" % m for m in re.findall(r"""\.setProperty\(\s*["']([^"']+)["']\s*,\s*["']([^"']*)["']""", scripts)]
    return tokens, "\n".join([rest] + attrs + js)


def declarations(css):
    """(property, value) for every declaration in some CSS, a selector's pseudo-classes left out."""
    body = re.sub(r"[^{};]*\{", ";", css)
    return [(k.strip().lower(), v.strip()) for k, v in re.findall(r"([A-Za-z-]+)\s*:\s*([^;{}\n]+)", body)]


class DesignTokens(unittest.TestCase):
    def test_every_token_file_follows_the_format(self):
        for name in token_files():
            with self.subTest(file=name):
                problems = []
                walk(json.loads(read(os.path.join(DESIGN, name))), [], None, problems)
                self.assertEqual(problems, [])

    def test_the_resolver_names_every_token_file_it_uses(self):
        resolver = json.loads(read(os.path.join(DESIGN, "tokens.resolver.json")))
        refs = set(re.findall(r'"\$ref": "([^"#][^"]*)"', json.dumps(resolver)))
        for ref in refs:
            self.assertTrue(os.path.isfile(os.path.join(DESIGN, ref)), ref)
        # Carbon's other themes are copied too, so that a theme can be chosen again; a theme is used whole or not.
        themes = {}
        for name in token_files():
            parts = name.split("/")
            if parts[:2] == ["carbon", "themes"]:
                themes.setdefault(parts[2], set()).add(name)
            else:
                self.assertIn(name, refs)
        for theme, names in themes.items():
            self.assertIn(len(names & refs), (0, len(names)), theme)
        self.assertEqual(sum(1 for names in themes.values() if names & refs), 2, "a light and a dark theme")

    def test_the_project_tokens_are_only_under_nexus(self):
        base = json.loads(read(os.path.join(DESIGN, "base.tokens.json")))
        self.assertEqual([k for k in base if not k.startswith("$")], ["nexus"])

    def test_the_carbon_copies_match_their_source(self):
        carbon = os.path.join(DESIGN, "carbon")
        source = json.loads(read(os.path.join(carbon, "source.json")))
        listed = set()
        for package in source["packages"]:
            for name, entry in package["files"].items():
                with open(os.path.join(carbon, name), "rb") as fh:
                    digest = hashlib.sha256(fh.read().replace(b"\r\n", b"\n")).hexdigest()
                self.assertEqual(digest, entry["sha256"], name)
                listed.add(name)
        self.assertGreater(len(listed), 0)
        on_disk = set()
        for folder, _, names in os.walk(carbon):
            for name in names:
                on_disk.add(os.path.relpath(os.path.join(folder, name), carbon).replace(os.sep, "/"))
        self.assertEqual(sorted(on_disk - {"source.json"} - listed), [], "files in carbon/ that source.json does not name")


class Mockup(unittest.TestCase):
    def test_one_frame_for_every_state_at_both_widths(self):
        wanted = set()
        docs = os.path.join(ROOT, "docs", "08-screens")
        for name in sorted(os.listdir(docs)):
            if re.fullmatch(r"SCR-\d{3}\.md", name):
                for sid, state in re.findall(r"^\| (SCR-\d{3})#([a-z-]+) \|", read(os.path.join(docs, name)), re.M):
                    wanted |= {"t-%s-%s-%d" % (sid, state, w) for w in WIDTHS}
        frames = re.findall(r'<template id="(t-SCR-[^"]+)">', read(MOCKUP))
        self.assertEqual(len(frames), len(set(frames)), "a frame drawn twice")
        self.assertGreater(len(wanted), 0)
        self.assertEqual(set(frames), wanted)

    def test_the_stage_views_of_the_workbench_at_both_widths(self):
        # SCR-145#normal draws the pictures of stages 03, 08 and 09 (SPEC-006, SPEC-008, SPEC-009) as views of its own.
        views = re.findall(r'<template id="(v-SCR-[^"]+)">', read(MOCKUP))
        self.assertEqual(len(views), len(set(views)), "a view drawn twice")
        self.assertEqual(set(views), {"v-SCR-145-normal-%s-%d" % (n, w) for n in ("03", "08", "09") for w in WIDTHS})
        # The script opens a view for exactly these stages, and every stage tab of a state frame goes where it went at
        # the stage-09 checkpoint, so the state frames stay as approved.
        names = json.loads(re.search(r"var VIEWS = (\{.*?\});", read(MOCKUP)).group(1))
        self.assertEqual(sorted(names), ["03", "08", "09"])
        tabs = 0
        for tpl in re.findall(r'<template id="t-SCR-[^"]+">(.*?)</template>', read(MOCKUP), re.S):
            tabs += len(re.findall(r'<a [^>]*class="tab(?: on)?"', tpl))
            self.assertEqual(set(re.findall(r'<a [^>]*class="tab(?: on)?"[^>]*data-go="([^"]+)"', tpl)) - {"SCR-145/normal"}, set())
        self.assertGreater(tabs, 0, "the state frames have stage tabs")

    def test_styles_use_only_the_tokens(self):
        tokens, rest = mockup_styles()
        defined = set(re.findall(r"(--[A-Za-z0-9-]+):", tokens))
        used = set(re.findall(r"var\((--[A-Za-z0-9-]+)", rest))
        self.assertEqual(sorted(used - defined), [], "custom properties the token CSS does not define")
        self.assertEqual(COLOUR.findall(rest), [], "colours outside the tokens")
        decls = declarations(rest)
        self.assertGreater(len(decls), 100)
        named = sorted({"%s: %s" % (k, v) for k, v in decls
                        if set(re.findall(r"[a-z]+", re.sub(r"var\([^)]*\)", "", v.lower()))) & NAMED})
        self.assertEqual(named, [], "named colours outside the tokens")

    def test_the_colour_check_finds_colours(self):
        # The checks above must see colours wherever the mockup could set them.
        samples = ["a{border:1px solid white}", "b{outline:2px solid Navy}", "c{background:teal}",
                   "d{color:CanvasText}", "e{box-shadow:0 0 0 1px rgb(0 0 0)}", "f{color:#c00}"]
        for css in samples:
            with self.subTest(css=css):
                found = COLOUR.findall(css) or [v for _, v in declarations(css)
                                                if set(re.findall(r"[a-z]+", v.lower())) & NAMED]
                self.assertTrue(found)
        self.assertEqual([v for _, v in declarations("a:hover{color:var(--link-primary)}")
                          if set(re.findall(r"[a-z]+", re.sub(r"var\([^)]*\)", "", v.lower()))) & NAMED], [])


if __name__ == "__main__":
    unittest.main()
