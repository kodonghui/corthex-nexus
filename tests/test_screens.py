"""The stage-08 screen definitions in `docs/08-screens/`.

- Every screen of the sitemap has a definition and a Korean copy, and no definition names a screen the sitemap
  does not have.
- Every piece of data and every action names operations of the API contract, and every action has a result and a
  failure.
- Every response that the contract lists for an operation a screen calls leads to one of the screen's states, and
  the six kinds of state (normal, loading, empty, error, permission, stale) are each described.
- The Korean copy has the same states with the same responses, the README lists the same states, and the
  wireframes draw every state, and only those, at 360 and 1440 pixels.
"""
import os
import re
import unittest

from yaml_subset import load

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, "docs", "08-screens")
KINDS = ("normal", "loading", "empty", "error", "permission", "stale")
WIDTHS = (360, 1440)


def read(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as fh:
        return fh.read()


def sitemap_screens():
    def walk(nodes):
        for node in nodes:
            yield node["id"]
            yield from walk(node.get("children", []))
    return list(walk(load(read("docs", "07-sitemap", "nexus.yaml"))))


def contract():
    """API ID -> the response codes the contract lists for it."""
    doc = load(read("api", "openapi.yaml"))
    found = {}
    for item in doc["paths"].values():
        for op in item.values():
            if isinstance(op, dict) and "responses" in op:
                found[op["x-corthex"]["id"]] = set(str(code) for code in op["responses"])
    return found


def section(text, title):
    """The table rows under a `## title` heading, as lists of cells."""
    match = re.search(r"^## (?:\d+\. )?%s\n(.*?)(?=^## |\Z)" % re.escape(title), text, re.M | re.S)
    if not match:
        return []
    rows = [line for line in match.group(1).splitlines() if line.startswith("| ")]
    cells = [[c.strip() for c in re.split(r"(?<!\\)\|", row.strip())[1:-1]] for row in rows]
    return [c for c in cells[2:]] if len(cells) > 2 else []


class ScreensTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.screens = sitemap_screens()
        cls.ops = contract()

    def definition(self, sid, ko=False):
        return read("docs", "08-screens", "%s%s.md" % (sid, ".ko" if ko else ""))

    def states(self, sid, ko=False):
        """state ID -> the set of responses it names."""
        rows = section(self.definition(sid, ko), "상태" if ko else "States")
        return {row[0]: set(re.findall(r"API-\d+#\w+", row[2])) for row in rows}

    def test_every_screen_has_a_definition_and_a_korean_copy(self):
        names = set(os.listdir(DOCS))
        defined = {n[:7] for n in names if re.fullmatch(r"SCR-\d{3}(\.ko)?\.md", n)}
        self.assertEqual(defined, set(self.screens))
        for sid in self.screens:
            with self.subTest(screen=sid):
                self.assertIn(sid + ".ko.md", names)
                self.assertTrue(self.definition(sid).startswith("# %s " % sid))

    def test_data_and_actions_name_operations_of_the_contract(self):
        for sid in self.screens:
            text = self.definition(sid)
            with self.subTest(screen=sid):
                data = section(text, "Data")
                actions = section(text, "Actions")
                self.assertTrue(data and actions)
                for row in data:
                    named = re.findall(r"API-\d+", row[1])
                    self.assertTrue(named, "data without an operation: %s" % row[0])
                    self.assertLessEqual(set(named), set(self.ops))
                for row in actions:
                    self.assertLessEqual(set(re.findall(r"API-\d+", row[1])), set(self.ops))
                    self.assertTrue(row[2] and row[3], "an action needs a result and a failure: %s" % row[0])

    def test_every_response_of_every_called_operation_leads_to_a_state(self):
        for sid in self.screens:
            text = self.definition(sid)
            called = set()
            for row in section(text, "Data") + section(text, "Actions"):
                called |= set(re.findall(r"API-\d+", row[1]))
            states = self.states(sid)
            cited = set().union(*states.values())
            with self.subTest(screen=sid):
                expected = {"%s#%s" % (api, code) for api in called for code in self.ops[api]}
                self.assertEqual(expected - cited, set(), "responses with no state")
                self.assertEqual(cited - expected, set(), "states name responses of operations the screen does not call")

    def test_the_six_kinds_of_state_are_described(self):
        for sid in self.screens:
            states = self.states(sid)
            with self.subTest(screen=sid):
                for kind in KINDS:
                    self.assertIn("%s#%s" % (sid, kind), states)
                for state in states:
                    self.assertRegex(state, r"^%s#[a-z][a-z0-9-]*$" % sid)

    def test_the_korean_copy_and_the_readme_have_the_same_states(self):
        for name, ko in (("README.md", False), ("README.ko.md", True)):
            rows = section(read("docs", "08-screens", name), "화면과 상태" if ko else "Screens and states")
            listed = {re.search(r"SCR-\d{3}", row[0]).group(0): row[1].split(", ") for row in rows}
            for sid in self.screens:
                with self.subTest(file=name, screen=sid):
                    self.assertEqual(["%s#%s" % (sid, s) for s in listed[sid]], list(self.states(sid)))
        for sid in self.screens:
            with self.subTest(screen=sid):
                self.assertEqual(self.states(sid, ko=True), self.states(sid))

    def test_the_wireframes_draw_every_state_at_both_widths(self):
        for name in ("wireframes.html", "wireframes.ko.html"):
            text = read("docs", "08-screens", name)
            frames = set(re.findall(r'id="(SCR-\d{3}-[a-z0-9-]+-\d+)"', text))
            expected = {"%s-%d" % (state.replace("#", "-"), w) for sid in self.screens for state in self.states(sid)
                        for w in WIDTHS}
            with self.subTest(file=name):
                self.assertEqual(frames, expected)


if __name__ == "__main__":
    unittest.main()
