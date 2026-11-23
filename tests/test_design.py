"""The stage-09 design tokens and mockup in `design/`.

- Every token file follows the Design Tokens format: a group has no `$value`, and a token has a `$value` and a
  `$type`, its own or its group's.
- The resolver names only files that exist and every token file in `design/` but those of the Carbon themes it does
  not use, two themes whole, and the project's own tokens are only under `nexus`.
- The Carbon copies are unchanged: each file's SHA-256, taken with LF line endings, is the one `carbon/source.json`
  names.
- The mockup has one frame for every state of every screen definition in `docs/08-screens/`, at 360 and 1440
  pixels, and no other. Its styles name only custom properties that its token CSS defines, and no colour appears
  outside that token CSS.
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
COLOUR = re.compile(r"#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|lab|lch|hwb|color)\(|"
                    r":\s*(?:white|black|red|green|blue|gray|grey|yellow|orange|purple)\b")


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
    """(the token CSS, every other style of the mockup)."""
    text = read(MOCKUP)
    blocks = re.findall(r"<style>(.*?)</style>", text, re.S)
    styles = "\n".join(blocks)
    start, end = styles.index("/* tokens:"), styles.index("/* end of tokens */")
    tokens, rest = styles[start:end], styles[:start] + styles[end:]
    rest += "\n" + "\n".join(re.findall(r'style="([^"]*)"', text))
    return tokens, rest


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
        source = json.loads(read(os.path.join(DESIGN, "carbon", "source.json")))
        checked = 0
        for package in source["packages"]:
            for name, entry in package["files"].items():
                with open(os.path.join(DESIGN, "carbon", name), "rb") as fh:
                    digest = hashlib.sha256(fh.read().replace(b"\r\n", b"\n")).hexdigest()
                self.assertEqual(digest, entry["sha256"], name)
                checked += 1
        self.assertGreater(checked, 0)


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

    def test_styles_use_only_the_tokens(self):
        tokens, rest = mockup_styles()
        defined = set(re.findall(r"(--[A-Za-z0-9-]+):", tokens))
        used = set(re.findall(r"var\((--[A-Za-z0-9-]+)", rest))
        self.assertEqual(sorted(used - defined), [], "custom properties the token CSS does not define")
        self.assertEqual(COLOUR.findall(rest), [], "colours outside the tokens")


if __name__ == "__main__":
    unittest.main()
