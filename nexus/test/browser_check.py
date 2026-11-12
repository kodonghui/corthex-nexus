"""Run the browser regressions of the redesign's pages with separately owned fixture servers.

Since TASK-278 no address serves 0.2's picture view or stage overview (SPEC-154), so their suites are retired; the
page suite opens their addresses and sees where they lead (TC-1767). The walk of the redesign's 53 states (TASK-278)
runs after them, one group of screens per fixture server, and the paths that browser agents walked through the flows
(TC-1785) last. Names given as arguments run only those suites, such as `page`, `walk`, `walk:talk` or `flows`."""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def run_suite(executable, clean, script, arguments=(), timeout=180):
    server = subprocess.Popen([executable, str(ROOT / "nexus/test/view-server.mjs")], cwd=ROOT, env=clean,
                              stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        fixture = json.loads(server.stdout.readline())
        clean["NEXUS_QA_ORIGIN"] = fixture["origin"]
        result = subprocess.run([executable, str(ROOT / "nexus/test" / script), *arguments], cwd=ROOT,
                                env=clean, capture_output=True, text=True, encoding="utf8", timeout=timeout)
        lines = [line for line in result.stdout.splitlines() if line.startswith("{")]
        receipt = json.loads(lines[-1]) if lines else {}
        print(json.dumps({"scope": "synthetic local browser regression", "suite": script, "arguments": arguments, "status": receipt.get("status", "blocked"),
                          "elapsed_ms": receipt.get("elapsedMs"), "profile_removed": receipt.get("profileRemoved", False)}))
        status = result.returncode or int(receipt.get("status") != "works" or not receipt.get("profileRemoved"))
        if status:
            sys.stderr.write(result.stderr)
        return status
    finally:
        server.stdin.close()
        try:
            server.wait(timeout=15)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait()


FLAGS = ("NEXUS_QA_PAGES", "NEXUS_QA_HOME", "NEXUS_QA_STAGE", "NEXUS_QA_PICTURE", "NEXUS_QA_TALK", "NEXUS_QA_ITEM",
         "NEXUS_QA_HUB_VIEWS")
SUITES = (
    # The redesign's pages (TASK-272), with their own opt-in synthetic project, and 0.2's addresses (TASK-278).
    ("page", "page-regression.mjs", ("NEXUS_QA_PAGES",), ()),
    # The first page's answers, reading again and fragments (TASK-273), with its own spaces.
    ("home", "home-regression.mjs", ("NEXUS_QA_HOME",), ()),
    # A stage in the workspace (TASK-274): the document stage's list, addresses and stage record.
    ("stage", "stage-regression.mjs", ("NEXUS_QA_STAGE",), ()),
    # The picture stage (TASK-275): its view, tools, addresses and states, with its own projects.
    ("picture", "picture-regression.mjs", ("NEXUS_QA_PICTURE",), ()),
    # The talk in a stage's side (TASK-276): its turns, entries, answers, box, addresses and states.
    ("talk", "talk-regression.mjs", ("NEXUS_QA_TALK",), ()),
    # The item's panel and the search in the top bar (TASK-277): their states, the trace, the switch
    # and the Item tab, with their own projects.
    ("item", "item-regression.mjs", ("NEXUS_QA_ITEM",), ()),
    # The hub page's views at /hub and in the file that the pinned hub builds (TASK-281), with its own project.
    ("hub", "hub-regression.mjs", ("NEXUS_QA_HUB_VIEWS",), ()),
    # The walk of the 53 states (TASK-278): each group of screens on the fixture of the suites above that
    # holds its states, at its widths, in both themes and languages, with the page checks.
    ("walk:home", "walk-regression.mjs", ("NEXUS_QA_HOME",), ("home",)),
    ("walk:workspace", "walk-regression.mjs", ("NEXUS_QA_STAGE",), ("workspace",)),
    ("walk:document", "walk-regression.mjs", ("NEXUS_QA_STAGE",), ("document",)),
    ("walk:picture", "walk-regression.mjs", ("NEXUS_QA_PICTURE",), ("picture",)),
    ("walk:talk", "walk-regression.mjs", ("NEXUS_QA_TALK",), ("talk",)),
    ("walk:item", "walk-regression.mjs", ("NEXUS_QA_ITEM",), ("item",)),
    ("walk:search", "walk-regression.mjs", ("NEXUS_QA_ITEM",), ("search",)),
    ("walk:hub", "walk-regression.mjs", ("NEXUS_QA_HOME", "NEXUS_QA_STAGE"), ("hub",)),
    # The paths that browser agents walked through FL-117 to FL-119 and that no suite above repeats,
    # each named with its case (TASK-278, TC-1785), one group per fixture server.
    ("flows:first-page", "flow-regression.mjs", ("NEXUS_QA_HOME",), ("first-page",)),
    ("flows:workspace", "flow-regression.mjs", ("NEXUS_QA_STAGE",), ("workspace",)),
    ("flows:picture", "flow-regression.mjs", ("NEXUS_QA_PICTURE",), ("picture",)),
    ("flows:talk", "flow-regression.mjs", ("NEXUS_QA_TALK",), ("talk",)),
)


def main(names=()):
    executable = shutil.which("node")
    if not executable or Path(executable).resolve().parent == ROOT:
        raise RuntimeError("Node 24 must be installed on PATH outside the checkout")
    groups = ("walk", "flows")
    unknown = [name for name in names if name not in groups and name not in {suite[0] for suite in SUITES}]
    if unknown:
        raise SystemExit("Unknown suites: " + ", ".join(unknown))
    clean = {key: value for key, value in os.environ.items()
             if not key.startswith(("NEXUS_DEV_", "CORTHEX_NEXUS_")) and key not in FLAGS}
    clean["NEXUS_QA_PYTHON"] = sys.executable
    for name, script, flags, arguments in SUITES:
        if names and name not in names and not any(group in names and name.startswith(group + ":") for group in groups):
            continue
        suite = clean.copy()
        for flag in flags:
            suite[flag] = "1"
        result = run_suite(executable, suite, script, arguments, timeout=360 if name.startswith("walk:") else 180)
        if result:
            return result
    return 0


if __name__ == "__main__":
    raise SystemExit(main(tuple(sys.argv[1:])))
