"""Run the browser regressions of the redesign's pages with separately owned fixture servers.

Since TASK-278 no address serves 0.2's picture view or stage overview (SPEC-154), so their suites are retired; the
page suite opens their addresses and sees where they lead (TC-1767)."""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def run_suite(executable, clean, script, arguments=()):
    server = subprocess.Popen([executable, str(ROOT / "nexus/test/view-server.mjs")], cwd=ROOT, env=clean,
                              stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        fixture = json.loads(server.stdout.readline())
        clean["NEXUS_QA_ORIGIN"] = fixture["origin"]
        result = subprocess.run([executable, str(ROOT / "nexus/test" / script), *arguments], cwd=ROOT,
                                env=clean, capture_output=True, text=True, encoding="utf8", timeout=180)
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


def main():
    executable = shutil.which("node")
    if not executable or Path(executable).resolve().parent == ROOT:
        raise RuntimeError("Node 24 must be installed on PATH outside the checkout")
    clean = {key: value for key, value in os.environ.items()
             if not key.startswith(("NEXUS_DEV_", "CORTHEX_NEXUS_"))}
    clean.pop("NEXUS_QA_PAGES", None)
    clean.pop("NEXUS_QA_HOME", None)
    clean.pop("NEXUS_QA_STAGE", None)
    clean.pop("NEXUS_QA_PICTURE", None)
    clean.pop("NEXUS_QA_TALK", None)
    clean.pop("NEXUS_QA_ITEM", None)
    clean.pop("NEXUS_QA_HUB_VIEWS", None)
    clean["NEXUS_QA_PYTHON"] = sys.executable
    # The redesign's pages (TASK-272), with their own opt-in synthetic project, and 0.2's addresses (TASK-278).
    pages = clean.copy()
    pages["NEXUS_QA_PAGES"] = "1"
    result = run_suite(executable, pages, "page-regression.mjs")
    if result:
        return result
    # The first page's answers, reading again and fragments (TASK-273), with its own spaces.
    home = clean.copy()
    home["NEXUS_QA_HOME"] = "1"
    result = run_suite(executable, home, "home-regression.mjs")
    if result:
        return result
    # A stage in the workspace (TASK-274): the document stage's list, addresses and stage record.
    stage = clean.copy()
    stage["NEXUS_QA_STAGE"] = "1"
    result = run_suite(executable, stage, "stage-regression.mjs")
    if result:
        return result
    # The picture stage (TASK-275): its view, tools, addresses and states, with its own projects.
    picture = clean.copy()
    picture["NEXUS_QA_PICTURE"] = "1"
    result = run_suite(executable, picture, "picture-regression.mjs")
    if result:
        return result
    # The talk in a stage's side (TASK-276): its turns, entries, answers, box, addresses and states.
    talk = clean.copy()
    talk["NEXUS_QA_TALK"] = "1"
    result = run_suite(executable, talk, "talk-regression.mjs")
    if result:
        return result
    # The item's panel and the search in the top bar (TASK-277): their states, the trace, the switch
    # and the Item tab, with their own projects.
    item = clean.copy()
    item["NEXUS_QA_ITEM"] = "1"
    result = run_suite(executable, item, "item-regression.mjs")
    if result:
        return result
    # The hub page's views at /hub and in the file that the pinned hub builds (TASK-281), with its own project.
    hub_views = clean.copy()
    hub_views["NEXUS_QA_HUB_VIEWS"] = "1"
    return run_suite(executable, hub_views, "hub-regression.mjs")


if __name__ == "__main__":
    raise SystemExit(main())
