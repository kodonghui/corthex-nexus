"""Run accepted picture regressions with an owned synthetic server/profile."""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main():
    executable = shutil.which("node")
    if not executable or Path(executable).resolve().parent == ROOT:
        raise RuntimeError("Node 24 must be installed on PATH outside the checkout")
    clean = {key: value for key, value in os.environ.items()
             if not key.startswith(("NEXUS_DEV_", "CORTHEX_NEXUS_"))}
    server = subprocess.Popen([executable, str(ROOT / "nexus/test/view-server.mjs")], cwd=ROOT, env=clean,
                              stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        fixture = json.loads(server.stdout.readline())
        clean["NEXUS_QA_ORIGIN"] = fixture["origin"]
        result = subprocess.run([executable, str(ROOT / "nexus/test/browser-regression.mjs")], cwd=ROOT,
                                env=clean, capture_output=True, text=True, encoding="utf8", timeout=180)
        lines = [line for line in result.stdout.splitlines() if line.startswith("{")]
        receipt = json.loads(lines[-1]) if lines else {}
        print(json.dumps({"scope": "synthetic local browser regression", "status": receipt.get("status", "blocked"),
                          "elapsed_ms": receipt.get("elapsedMs"), "profile_removed": receipt.get("profileRemoved", False)}))
        return result.returncode
    finally:
        server.stdin.close()
        try:
            server.wait(timeout=15)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait()


if __name__ == "__main__":
    raise SystemExit(main())
