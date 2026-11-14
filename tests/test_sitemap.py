"""TASK-281 (TC-1768): stage 07's four checks, which a script outside the repository ran until the design revision of
2026-11-11, as the repository's test. It reads nexus.yaml with the pinned hub's own reader, the steps of stage 03's
flows in English and Korean, and the board, the list and the table of flows of the sitemap guide and its
translation; and it takes the repository's snapshot with the pinned hub and runs NEXUS's cross-check on it. Whether
every step that shows something names its screen stays a check by hand ("Checks run" in docs/07-sitemap/nexus.md).
The hub page's views at /hub, TC-1766, run in the browser regression."""

import json
import re
import shutil
import subprocess
import sys
import unittest

from test_nexus import ROOT, _hub_tests_path, hub, node_with_sqlite

sys.path.insert(0, _hub_tests_path)
try:
    from test_hub02 import GitSourcesFixture
finally:
    sys.path.remove(_hub_tests_path)

SITEMAP = ROOT / "docs/07-sitemap"
FLOWS = ROOT / "docs/03-user-flow/nexus"
SCREEN = re.compile(r"SCR-[0-9]{3,4}")
# The Korean copy's words for what nexus.yaml writes in English. A new screen or a new reach adds its words here.
KOREAN_NAMES = {
    "Home": "첫 화면", "Search": "찾기", "Full checks": "전체 점검", "Search results": "검색 결과", "Trace view": "추적 화면",
    "Stage detail": "단계 자세히 보기", "Picture view": "그림 보기", "Item": "항목", "Comment": "의견", "Proposal": "제안",
    "Stage overview": "단계 현황", "Project workspace": "프로젝트 작업 공간", "Picture stage": "그림 단계",
    "Document stage": "문서 단계", "Talk": "대화", "Project data": "프로젝트 자료", "Hub page": "허브 페이지",
}
KOREAN_ACCESS = {
    "anyone Cloudflare Access lets in, on the server": "Cloudflare Access가 들인 사람, 서버에서",
    "anyone Cloudflare Access lets in, or the device's user": "Cloudflare Access가 들인 사람, 또는 기기의 사용자",
}
WORDS = {
    "en": {"name": lambda name: name, "access": lambda access: access, "board access": lambda access: access,
           "none": "none", "removed": "Removed", "no screen": "none: the hub reports in the session",
           "list": "| Screen | Name | Parent | Path | Who can see it | Flows | Terms | Status |",
           "flows": "| Flow | Where it runs | Screens of its steps |"},
    "ko": {"name": KOREAN_NAMES.__getitem__, "access": KOREAN_ACCESS.__getitem__,
           # The board breaks the Korean reach after "Access가" and after its comma.
           "board access": lambda access: re.sub(r"(Access가|,) ", r"\1<br/>", KOREAN_ACCESS[access]),
           "none": "없음", "removed": "없어진 화면", "no screen": "없음: 허브가 세션에서 알림",
           "list": "| 화면 | 이름 | 상위 | 경로 | 볼 수 있는 사람 | 흐름 | 용어 | 상태 |",
           "flows": "| 흐름 | 도는 곳 | 그 단계의 화면 |"},
}
GUIDES = {"en": SITEMAP / "nexus.md", "ko": SITEMAP / "nexus.ko.md"}


def screens():
    """The screens of nexus.yaml in the order of the file, each with its parent's ID, read by the pinned hub."""
    found = []

    def walk(nodes, parent):
        for node in nodes:
            found.append(dict(node, parent=parent))
            walk(node.get("children") or [], node["id"])

    walk(hub.companion("sitemap").read_yaml((SITEMAP / "nexus.yaml").read_text(encoding="utf8")), None)
    return found


def flow_files():
    """Each flow of stage 03 by its ID, with its English and Korean files."""
    found = {}
    for path in sorted(FLOWS.glob("FL-*.md")):
        flow = re.match(r"FL-[0-9]{3}", path.name).group(0)
        found.setdefault(flow, {})["ko" if path.name.endswith(".ko.md") else "en"] = path
    return found


def steps(path):
    """The SCR IDs that the steps of a flow name: those in its Mermaid drawing, not those of its prose."""
    blocks = re.findall(r"```mermaid\n(.*?)```", path.read_text(encoding="utf8"), re.S)
    return blocks, set(SCREEN.findall("\n".join(blocks)))


def block(text, name):
    """A block that nexus.yaml draws, from its opening comment to its closing one."""
    found = re.findall(r"<!-- %s: drawn from nexus\.yaml -->\n(.*?)<!-- end of %s -->\n" % (name, name), text, re.S)
    if len(found) != 1:
        raise AssertionError("the guide must hold one %s drawn from nexus.yaml" % name)
    return found[0]


def drawing(language):
    """The board, the list and the flows of the table, drawn afresh from nexus.yaml in one language."""
    words, all_screens = WORDS[language], screens()
    standing = [screen for screen in all_screens if screen["status"] != "removed"]
    removed = [screen for screen in all_screens if screen["status"] == "removed"]
    node = lambda screen: screen["id"].replace("-", "")

    def label(screen, last):
        return '%s["%s %s<br/>%s<br/>%s"]' % (node(screen), screen["id"], words["name"](screen["name"]), screen["path"], last)

    board = ["```mermaid", "flowchart TD"]
    for screen in standing:
        drawn = label(screen, words["board access"](screen["access"]))
        board.append("  " + (node({"id": screen["parent"]}) + " --> " + drawn if screen["parent"] else drawn))
    if removed:
        board.append('  subgraph gone["%s"]' % words["removed"])
        board.extend("    " + label(screen, "removed") + ":::removed" for screen in removed)
        board.extend(["  end", "  classDef removed stroke-dasharray: 5 5"])
    board.append("```")

    def terms(screen):
        return "`none`" if screen["terms"] == "none" else ", ".join(screen["terms"])

    rows = [words["list"], "| --- | --- | --- | --- | --- | --- | --- | --- |"]
    for screen in standing + removed:
        rows.append("| %s |" % " | ".join([
            screen["id"], words["name"](screen["name"]), screen["parent"] or words["none"], "`%s`" % screen["path"],
            words["access"](screen["access"]), ", ".join(screen.get("flows") or []) or words["none"], terms(screen),
            screen["status"]]))

    flows = []
    for flow in sorted(flow_files()):
        named = sorted(screen["id"] for screen in standing if flow in (screen.get("flows") or []))
        flows.append((flow, ", ".join(named) or words["no screen"]))
    return "\n".join(board) + "\n", "\n".join(rows) + "\n", flows


class SitemapChecksTest(unittest.TestCase):
    """TC-1768's four checks on the repository's files."""

    def test_TC_1768_check_1_the_steps_of_each_flow_name_the_screens_that_list_it(self):
        all_screens = screens()
        removed = {screen["id"] for screen in all_screens if screen["status"] == "removed"}
        standing = [screen for screen in all_screens if screen["id"] not in removed]
        files = flow_files()
        self.assertEqual(len(files), 22, "the flows of stage 03")
        for flow, paths in files.items():
            self.assertEqual(set(paths), {"en", "ko"}, flow + " has an English and a Korean file")
            wanted = {screen["id"] for screen in standing if flow in (screen.get("flows") or [])}
            for language, path in paths.items():
                with self.subTest(flow=flow, language=language):
                    blocks, named = steps(path)
                    self.assertEqual(len(blocks), 1, "one drawing of the steps")
                    self.assertEqual(named & removed, set(), "no step names a removed screen")
                    self.assertEqual(sorted(named), sorted(wanted), "the steps name the screens whose flows list the flow")
        for screen in standing:
            for flow in screen.get("flows") or []:
                self.assertIn(flow, files, screen["id"] + " lists a flow of stage 03")

    def test_TC_1768_check_2_one_root_and_one_path_for_each_screen(self):
        all_screens = screens()
        ids = [screen["id"] for screen in all_screens]
        self.assertEqual(len(ids), len(set(ids)), "no two screens share an ID")
        standing = [screen for screen in all_screens if screen["status"] != "removed"]
        roots = [screen["id"] for screen in standing if screen["parent"] is None]
        self.assertEqual(roots, ["SCR-110"], "one root among the screens that are not removed")
        for screen in all_screens:
            if screen["status"] == "removed":
                with self.subTest(removed=screen["id"]):
                    self.assertIsNone(screen["parent"], "a removed screen stands after the tree")
                    self.assertFalse(screen.get("children"), "a removed screen leads to no screen")
                    self.assertEqual(screen["terms"], "none")
        # The removed screens stand after the tree and have no children, so the one root reaches every other screen.
        paths = [screen["path"] for screen in standing]
        self.assertEqual(sorted(set(paths)), sorted(paths), "no two screens that are not removed share a path")

    def test_TC_1768_check_3_every_screen_says_who_can_see_it(self):
        for screen in screens():
            with self.subTest(screen=screen["id"]):
                for key in ("name", "path", "access", "status"):
                    self.assertTrue(isinstance(screen.get(key), str) and screen[key].strip(), key)

    def test_TC_1768_check_4_the_guide_and_its_translation_equal_a_fresh_drawing(self):
        for language, path in GUIDES.items():
            with self.subTest(language=language):
                text = path.read_text(encoding="utf8")
                board, rows, flows = drawing(language)
                self.assertEqual(block(text, "board"), board)
                self.assertEqual(block(text, "list"), rows)
                table = block(text, "flows").splitlines()
                self.assertEqual(table[:2], [WORDS[language]["flows"], "| --- | --- | --- |"])
                cells = [[cell.strip() for cell in line.strip("|").split("|")] for line in table[2:]]
                self.assertTrue(all(len(row) == 3 and row[1] for row in cells), "each flow says where it runs")
                self.assertEqual([(row[0], row[2]) for row in cells], flows)
        counted = screens()
        self.assertEqual((len(counted), sum(screen["status"] == "removed" for screen in counted)), (18, 6))


class SitemapCrosscheckTest(GitSourcesFixture):
    """TC-1768's snapshot: the repository's sources through the pinned hub, then NEXUS's cross-check."""

    def test_TC_1768_the_hub_reads_the_sitemap_and_the_crosscheck_opens_no_discrepancy(self):
        node = node_with_sqlite()
        if not node:
            self.skipTest("needs Node 22.13 or later")
        settings = json.loads((ROOT / ".corthex/project.json").read_text(encoding="utf8"))
        self.write(self.repo / ".corthex/project.json", settings)
        self.register(name=settings["name"])
        (self.repo / ".corthex/stages.json").unlink()  # Only the owned fixture's seed.
        self.write(self.repo / ".corthex/stages/nexus.json", {"format": 1, "project": settings["name"], "part": "nexus", "stages": {}})
        for relative in ("docs/01-domain/nexus.md", "docs/07-sitemap/nexus.yaml"):
            destination = self.repo / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / relative, destination)
        head = self.commit("the sitemap and the board of the repository")
        self.git("update-ref", "refs/remotes/origin/main", head)
        snapshot = self.snapshot()

        partial = [check["message"] for check in snapshot["checks"]
                   if check.get("rule") == "picture-partial" and check.get("stage") == "07-sitemap"]
        self.assertEqual(partial, [], "the hub reads the whole sitemap")
        pictures = [picture for picture in snapshot["pictures"] if picture["stage"] in ("01-domain", "07-sitemap")]
        self.assertEqual(sorted(picture["stage"] for picture in pictures), ["01-domain", "07-sitemap"])
        sitemap = next(picture["source"] for picture in pictures if picture["stage"] == "07-sitemap")
        by_id = {screen["id"]: screen for screen in sitemap["screens"]}
        # SCR-101 since the design revision of 2026-11-11, and 0.2's two pages and their panels since TASK-278.
        for removed in ("SCR-101", "SCR-105", "SCR-106", "SCR-107", "SCR-108", "SCR-109"):
            self.assertTrue(by_id[removed]["removed"], removed)
            self.assertNotIn("parent", by_id[removed], removed)
        self.assertEqual(sitemap["screens"][by_id["SCR-130"]["parent"]]["id"], "SCR-111", "SCR-130 is in the tree")

        crosscheck = (ROOT / "nexus/src/crosscheck.js").as_uri()
        script = ("import { crosscheckParts } from %s;\n"
                  "let text = ''; for await (const chunk of process.stdin) text += chunk;\n"
                  "const pictures = JSON.parse(text);\n"
                  "process.stdout.write(JSON.stringify(crosscheckParts(pictures, [], new Set(pictures.map((p) => p.part)))));\n"
                  % json.dumps(crosscheck))
        run = subprocess.run([node, "--input-type=module", "-e", script], input=json.dumps(pictures).encode("utf8"),
                             cwd=str(ROOT), capture_output=True, timeout=60)
        self.assertEqual(run.returncode, 0, run.stderr.decode("utf8", "replace")[-2000:])
        result = json.loads(run.stdout.decode("utf8"))
        self.assertEqual([entry for entry in result["open"] if entry["compares"] == "read-model-screen"], [],
                         "the cross-check of the board and the sitemap opens no discrepancy")
        self.assertEqual((result["updates"], result["resolve"]), ([], []))


if __name__ == "__main__":
    unittest.main()
