"""Pinned external Schemathesis against a real local standalone server.

This fixture uses generated RSA keys, never a real Access session. Its origin
is checked before attaching the assertion; no redirects or external writes.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlsplit

from click.testing import CliRunner
import schemathesis
from schemathesis.cli import schemathesis as command

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root))
from nexus.test import contract_hooks  # noqa: E402 - registers existing checks

def main():
    node = shutil.which("node")
    if not node:
        raise RuntimeError("Node must be installed")
    clean = {key: value for key, value in os.environ.items() if not key.startswith(("NEXUS_CONTRACT_", "SCHEMATHESIS_"))}
    for key in list(os.environ):
        if key.startswith(("NEXUS_CONTRACT_", "SCHEMATHESIS_")):
            del os.environ[key]
    with tempfile.TemporaryDirectory(prefix="nexus-schema-") as cache:
        os.environ["HYPOTHESIS_STORAGE_DIRECTORY"] = cache
        server = subprocess.Popen([node, str(root / "nexus/test/serve-standalone.js")], cwd=root, env=clean,
                                  stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        try:
            fixture = json.loads(server.stdout.readline())
            target = urlsplit(fixture["url"])
            if target.scheme != "http" or target.hostname != "127.0.0.1" or not target.port:
                raise RuntimeError("fixture must bind loopback")

            @schemathesis.hook
            def before_call(context, case):
                actual = urlsplit(case.base_url or "")
                if (actual.scheme, actual.hostname, actual.port) != (target.scheme, target.hostname, target.port):
                    raise RuntimeError("fixture origin changed")
                case.headers = dict(case.headers or {}, **{"Cf-Access-Jwt-Assertion": fixture["assertion"]})
                case.cookies = {}

            result = CliRunner().invoke(command, ["run", str(root / "docs/06-api/nexus.openapi.yaml"),
                "--base-url", fixture["url"], "--experimental=openapi-3.1", "--hypothesis-max-examples=3",
                "--hypothesis-deadline=10000", "--request-timeout=10000",
                "--checks=not_a_server_error,status_code_conformance,content_type_conformance,response_schema_by_media_type,response_headers_conformance"],
                catch_exceptions=True)
            # Only counts/check names are reportable; raw generated examples,
            # assertions and runner traceback are deliberately not printed.
            summary = [line.strip() for line in result.output.splitlines() if any(word in line for word in (" passed", " failed", " errored", " skipped", "API operations", "Total API"))]
            print(json.dumps({"tool": "Schemathesis 3.39.16", "runtime": "Node HTTP/SQLite", "max_examples": 3,
                              "exit_code": result.exit_code, "summary": summary[-8:]}))
            return result.exit_code
        finally:
            server.stdin.close()
            try:
                server.wait(timeout=30)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()

if __name__ == "__main__":
    raise SystemExit(main())
