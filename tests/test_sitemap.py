"""The stage-07 sitemap in `docs/07-sitemap/nexus.yaml`.

- Every screen has an SCR ID, a name, a path, who can see it, a status, its flows and its terms; IDs and paths are
  unique and the tree starts at `/`.
- Every user flow has a screen and every flow a screen names exists. The README's table of flow steps names real
  steps, and it gives each screen exactly the flows the sitemap gives it.
- Each screen names one context and only read models of that context, and every read model of the domain design
  has a screen or is listed as without one, as NEXUS compares them with the DDD board.
- The README draws every screen once on the board and once in the list, with the sitemap's flows and read models.
- The stage's note fits in the 300 characters that the hub keeps.
"""
import json
import os
import re
import unittest

from yaml_subset import load

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITEMAP = os.path.join(ROOT, "docs", "07-sitemap", "nexus.yaml")
FLOWS = os.path.join(ROOT, "docs", "03-user-flow")


def read(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as fh:
        return fh.read()


def screens(nodes, parent=None):
    for node in nodes:
        yield node, parent
        yield from screens(node.get("children", []), node)


def flow_files():
    return sorted(name for name in os.listdir(FLOWS) if re.match(r"FL-\d{3}-.*\.md$", name)
                  and not name.endswith(".ko.md"))


def flow_steps(flow):
    """The box IDs of a flow diagram, such as A or R1."""
    name = next(n for n in flow_files() if n.startswith(flow))
    return set(re.findall(r"^\s+([A-Z][0-9]?)[\[({]", read("docs", "03-user-flow", name), re.M))


def read_models():
    """TERM ID -> context ID for every read model in the domain design's glossary."""
    found = {}
    for line in read("docs", "01-domain", "nexus.md").splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) >= 4 and re.fullmatch(r"TERM-\d+", cells[0]) and "(read model)" in cells[2]:
            found[cells[0]] = cells[3]
    return found


class SitemapTest(unittest.TestCase):
    def setUp(self):
        with open(SITEMAP, encoding="utf-8") as fh:
            self.text = fh.read()
        self.tree = load(self.text)
        self.all = list(screens(self.tree))

    def test_the_stage_reads_this_file(self):
        project = json.loads(read(".corthex", "project.json"))
        self.assertEqual(project["stages"]["07-sitemap"]["source"], "docs/07-sitemap/nexus.yaml")

    def test_every_screen_is_complete(self):
        for node, _ in self.all:
            with self.subTest(screen=node.get("id")):
                self.assertRegex(node["id"], r"^SCR-\d{3}$")
                self.assertGreaterEqual(int(node["id"][4:]), 142, "v3 screen IDs continue after v2's")
                for key in ("name", "path", "access"):
                    self.assertTrue(node.get(key), "%s has no %s" % (node["id"], key))
                self.assertIn(node["status"], ("active", "removed"))
                self.assertIsInstance(node["flows"], list)
                self.assertIsInstance(node["terms"], list)

    def test_ids_and_paths_are_unique_and_the_root_is_slash(self):
        ids = [n["id"] for n, _ in self.all]
        paths = [n["path"] for n, _ in self.all]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(len(paths), len(set(paths)))
        self.assertEqual(len(self.tree), 1, "one root")
        self.assertEqual(self.tree[0]["path"], "/")
        for node, parent in self.all:
            if parent is not None:
                self.assertTrue(node["path"].startswith(parent["path"].rstrip("/") + "/"),
                                "%s sits under %s" % (node["path"], parent["path"]))

    def test_the_pages_the_hub_links_to_keep_their_addresses(self):
        paths = {n["path"] for n, _ in self.all}
        self.assertIn("/p/{project}/{part}/{stage}", paths)
        self.assertIn("/p/{project}", paths, "the hub links to /p/{project}#data")

    def test_every_flow_has_a_screen_and_every_named_flow_exists(self):
        flows = {name[:6] for name in flow_files()}
        named = {f for n, _ in self.all for f in n["flows"]}
        self.assertEqual(named - flows, set(), "screens name flows that do not exist")
        self.assertEqual(flows - named, set(), "flows without a screen")

    def test_the_step_table_names_real_steps_and_matches_the_sitemap(self):
        on_screen = {(f, n["id"]) for n, _ in self.all for f in n["flows"]}
        for name in ("README.md", "README.ko.md"):
            text = read("docs", "07-sitemap", name)
            rows = re.findall(r"^\| (FL-\d{3}) \| ([^|]+) \| ([^|]+) \|$", text, re.M)
            self.assertTrue(rows, "no step table in %s" % name)
            in_table = set()
            for flow, steps, shown in rows:
                with self.subTest(file=name, flow=flow, steps=steps):
                    self.assertLessEqual(set(steps.strip().split(", ")), flow_steps(flow), "steps not in the flow")
                    in_table |= {(flow, scr) for scr in re.findall(r"SCR-\d{3}", shown)}
            with self.subTest(file=name):
                self.assertEqual(in_table - on_screen, set(), "table puts a flow on a screen the sitemap does not")
                self.assertEqual(on_screen - in_table, set(), "sitemap puts a flow on a screen with no step in the table")

    def test_terms_are_read_models_of_the_screen_context(self):
        models = read_models()
        self.assertTrue(models, "no read model found in the glossary")
        shown = set()
        for node, _ in self.all:
            contexts = [t for t in node["terms"] if t.startswith("CTX-")]
            terms = [t for t in node["terms"] if t.startswith("TERM-")]
            with self.subTest(screen=node["id"]):
                self.assertEqual(len(contexts), 1, "one context per screen")
                for term in terms:
                    self.assertIn(term, models, "%s is not a read model" % term)
                    self.assertEqual(models[term], contexts[0], "%s belongs to another context" % term)
                    shown.add(term)
        # The hub's own reading of the marker (sitemap.py): any case and spacing, every matching line.
        markers = [m.group(1) for m in (re.match(r"\s*#\s*without a screen\s*:\s*(.*)", line, re.I)
                                        for line in self.text.splitlines()) if m]
        without = {term for m in markers for term in re.findall(r"TERM-\d+", m)}
        self.assertEqual(shown & without, set(), "a read model both shown and listed without a screen")
        self.assertEqual(set(models) - shown - without, set(), "read models with no screen and not listed")

    def test_the_readme_draws_every_screen_on_the_board_and_in_the_list(self):
        for name in ("README.md", "README.ko.md"):
            text = read("docs", "07-sitemap", name)
            board = re.search(r"```mermaid\n(.*?)```", text, re.S).group(1)
            rows = [line for line in text.splitlines() if re.match(r"\| SCR-\d{3} \|", line)]
            for node, parent in self.all:
                with self.subTest(file=name, screen=node["id"]):
                    self.assertEqual(len(re.findall(r'\["%s<br/>' % node["id"], board)), 1)
                    mine = [r for r in rows if r.startswith("| %s |" % node["id"])]
                    self.assertEqual(len(mine), 1)
                    cells = [c.strip() for c in mine[0].strip("|").split("|")]
                    self.assertEqual(cells[4], ", ".join(node["flows"]))
                    self.assertEqual(cells[5], ", ".join(node["terms"]))
                    if parent is not None:
                        self.assertIn("%s --> %s" % (parent["id"].replace("-", ""), node["id"].replace("-", "")),
                                      board)

    def test_the_stage_note_fits_what_the_hub_keeps(self):
        note = json.loads(read(".corthex", "project.json"))["stages"]["07-sitemap"].get("note", "")
        self.assertLessEqual(len(note), 300, "the hub cuts notes at 300 characters")


if __name__ == "__main__":
    unittest.main()
