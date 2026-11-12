"""Run picture/discussion regressions with separately owned fixture servers."""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def run_suite(executable, clean, script, arguments=()):
    if script == "browser-regression.mjs":
        clean["NEXUS_QA_TALL_SITEMAP"] = "1"
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
    clean.pop("NEXUS_QA_LINKS", None)
    clean.pop("NEXUS_QA_HUB", None)
    clean.pop("NEXUS_QA_LATE_SCREEN", None)
    clean.pop("NEXUS_QA_TALL_SITEMAP", None)
    clean.pop("NEXUS_QA_PAGES", None)
    clean.pop("NEXUS_QA_HOME", None)
    clean.pop("NEXUS_QA_STAGE", None)
    clean.pop("NEXUS_QA_HUB_VIEWS", None)
    clean["NEXUS_QA_PYTHON"] = sys.executable
    for script, arguments in [("browser-regression.mjs", ()), ("discussion-regression.mjs", ()),
                              ("discussion-regression.mjs", ("--dismiss",)), ("error-regression.mjs", ()),
                              ("asset-regression.mjs", ()), ("asset-regression.mjs", ("--core-css",)),
                              ("asset-regression.mjs", ("--editor-css",))]:
        result = run_suite(executable, clean.copy(), script, arguments)
        if result:
            return result
    late_screen = clean.copy()
    late_screen["NEXUS_QA_LATE_SCREEN"] = "1"
    result = run_suite(executable, late_screen, "late-screen-regression.mjs")
    if result:
        return result
    # The redesign's pages (TASK-272), with their own opt-in synthetic project.
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
    # The hub page's views at /hub and in the file that the pinned hub builds (TASK-281), with its own project.
    hub_views = clean.copy()
    hub_views["NEXUS_QA_HUB_VIEWS"] = "1"
    return run_suite(executable, hub_views, "hub-regression.mjs")


if __name__ == "__main__":
    raise SystemExit(main())
