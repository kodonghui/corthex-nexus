"""TASK-431: the pinned hub against the running v2 and the v3 contract (SPEC-014; API-242, API-243).

Each test builds this checkout's files into a repository in a temporary folder, as tests/test_hub_project.py does,
with two commits on its default branch: an older one that a server holds and the newer one that the hub sends. The
hub is the clean checkout of hub-ref.json that CORTHEX_HUB_CHECKOUT names. A test server on the loopback address
answers the hub's two calls, GET /api/snapshots/{project}/held (API-243) and POST /api/snapshots (API-242), and keeps
every request; nothing is fetched and no NEXUS server is contacted.

- The 0.3 snapshot that `snapshot --print --format corthex-hub/0.3` makes of this repository validates against the
  Snapshot schema of api/openapi.yaml and fits its snapshot limit. It holds each user flow and screen definition and
  the mockup page that .corthex/project.json names, each with the file's whole text, and no translation copy. The 0.2
  snapshot validates too and holds the pictures of stages 01, 05 and 07 only.
- Every snapshot the hub makes or sends is also read by the v3 server's own intake, readSnapshot of
  server/src/snapshot.js, run with Node: it takes the snapshot in its format and leaves out none of its documents.
- A test server that answers as v2 does, whose held commit lists no formats, gets 0.2 from the push job and from a
  first push, and nothing when it holds the commit already.
- A v3 test server whose held commit lists corthex-hub/0.3 gets 0.3; a commit it holds in 0.2 goes again in 0.3 once.
- Every response API-242 and API-243 list, served as the contract's example, gets the outcome that HELD_RESPONSES and
  PUSH_RESPONSES name, and every request the hub sends matches its operation.
"""

import json
import os
import re
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import test_api as contract  # noqa: E402
from test_hub_project import SECRETS, HubCheckoutCase, base_environment, node_program  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
PROJECT = "corthex-nexus"
HELD_PATH = "/api/snapshots/%s/held" % PROJECT
PUSH_PATH = "/api/snapshots"
OLD, NEW = "corthex-hub/0.2", "corthex-hub/0.3"
V2_STAGES = {"01-domain", "05-erd", "07-sitemap"}
TEXT_STAGES = ("03-user-flow", "08-screen-states", "09-mockup")
# Where the snapshot's items name the file that defines each user flow and each screen: a flow item of stage 03 by
# its own place, and a screen item of the sitemap by its screen definition in stage 08. Apart from the hub's scan,
# each file of the stage's source folder named with the ID prefix, other than a translation copy, must be one of them.
DEFINED_IN = {"03-user-flow": ("flow", "where", "FL-"), "08-screen-states": ("screen", "screen_doc", "SCR-")}
TRACE = "0123456789abcdef"
NOT_FOUND = {"title": "Not found", "status": 404, "detail": "no such path", "code": "not_found", "traceId": TRACE}
SERVER_SOURCE = ROOT / "server" / "src"
# The v3 server's intake of a snapshot (TASK-418): readSnapshot of snapshot.js in the folder of argv[2] on the JSON
# file in argv[3].
# A refusal is a Problem of problem.js; any other error ends the script with its stack, as a fault of the check.
INTAKE = """import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const [folder, file] = process.argv.slice(2);
const { readSnapshot } = await import(pathToFileURL(folder + '/snapshot.js').href);
const { Problem } = await import(pathToFileURL(folder + '/problem.js').href);
try {
  const read = readSnapshot(JSON.parse(readFileSync(file, 'utf8')));
  console.log(JSON.stringify({ format: read.format, commit: read.commit, replaces: read.replaces,
    documents: read.documents.map(({ path, stage, part, why }) => ({ path, stage, part, why })) }));
} catch (error) {
  if (!(error instanceof Problem)) throw error;
  console.log(JSON.stringify({ refused: error.code, detail: error.message }));
}
"""

# What the pinned hub makes of each response that API-243 lists, served as the contract's example to a push job:
# the row's outcome and either the Problem code it reports or, when it sends nothing, why.
HELD_RESPONSES = {
    ("200", "held"): ("done", "sent"),
    ("401", "access-missing"): ("refused", "access_missing"),
    ("403", "agent-only"): ("refused", "agent_only"),
    ("404", "project-not-found"): ("done", "first-push-waits"),
    ("default", "internal"): ("refused", "internal"),
}
# The same for API-242, after a held commit that lists corthex-hub/0.3. A success is the push of a newer commit, the
# same commit again completing its revision in 0.3, or a first push, which only a session sends, after the user's yes.
PUSH_RESPONSES = {
    ("200", "drawn"): ("done", "newer"),
    ("200", "same-commit"): ("done", "same"),
    ("201", "first-send"): ("done", "first"),
    ("400", "invalid-request"): ("refused", "invalid_request"),
    ("400", "invalid-snapshot"): ("refused", "invalid_snapshot"),
    ("400", "unsupported-format"): ("refused", "unsupported_format"),
    ("401", "access-missing"): ("refused", "access_missing"),
    ("403", "agent-only"): ("refused", "agent_only"),
    ("409", "commit-not-replaced"): ("refused", "commit_not_replaced"),
    ("409", "older-snapshot"): ("refused", "older_snapshot"),
    ("409", "repository-mismatch"): ("refused", "repository_mismatch"),
    ("413", "snapshot-too-large"): ("refused", "snapshot_too_large"),
    ("415", "json-required"): ("refused", "json_required"),
    ("default", "internal"): ("refused", "internal"),
}


class LoopbackServer:
    """A test server on the loopback address that answers each (method, path) from `answers` and keeps every request."""

    def __init__(self, answers):
        self.answers = answers
        self.requests = []
        server = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def answer(self):
                length = int(self.headers.get("Content-Length") or 0)
                server.requests.append({"method": self.command, "path": self.path,
                                        "headers": {k.lower(): v for k, v in self.headers.items()},
                                        "body": self.rfile.read(length) if length else b""})
                status, value = server.answers.get((self.command, self.path), (404, NOT_FOUND))
                raw = json.dumps(value).encode("utf8")
                self.send_response(status)
                self.send_header("Content-Type", "application/json" if status < 400 else "application/problem+json")
                self.send_header("Content-Length", str(len(raw)))
                self.send_header("Connection", "close")
                self.end_headers()
                self.wfile.write(raw)

            do_GET = do_POST = do_PUT = do_PATCH = do_DELETE = answer

        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.url = "http://127.0.0.1:%d" % self.httpd.server_address[1]
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *exc):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join(10)

    def sent(self):
        """The snapshots that the hub posted, decoded."""
        return [json.loads(r["body"].decode("utf8")) for r in self.requests
                if (r["method"], r["path"]) == ("POST", PUSH_PATH)]


def operation(doc, api_id):
    for method, path, op in contract.operations(doc):
        if op["x-corthex"]["id"] == api_id:
            return method, path, op
    raise AssertionError("api/openapi.yaml has no " + api_id)


def examples(op):
    """(status, example name, value) of every response the operation lists."""
    for status, response in op["responses"].items():
        for body in response["content"].values():
            for name, example in body["examples"].items():
                yield status, name, example["value"]


def served_status(status, value):
    return value["status"] if status == "default" else int(status)


def mockup_page():
    """The mockup page that .corthex/project.json names for stage 09."""
    settings = json.loads((ROOT / ".corthex" / "project.json").read_text(encoding="utf8"))
    return settings["stages"]["09-mockup"].get("page")


class MockupPageTest(unittest.TestCase):
    def test_the_mockup_page_is_named_for_stage_09(self):
        page = mockup_page()
        self.assertEqual(page, "design/mockup/nexus-mockup.html")
        self.assertTrue((ROOT / page).is_file())


class HubCompatibilityTest(HubCheckoutCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.doc = contract.load()
        cls.limit = cls.doc["components"]["x-corthex"]["limits"]["snapshot_bytes"]
        cls.held_op = operation(cls.doc, "API-243")
        cls.push_op = operation(cls.doc, "API-242")
        cls.page = mockup_page()

    def setUp(self):
        super().setUp()
        # The held commit and a newer one: an empty commit on top, which the default branch then names.
        self.held = self.commit
        self.run_git("commit", "--no-verify", "-q", "--allow-empty", "-m", "A newer commit")
        self.commit = self.run_git("rev-parse", "HEAD")
        self.run_git("update-ref", "refs/remotes/origin/main", self.commit)
        self.run_git("symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main")

    # How the hub runs: the push job's own lines, a session's push, and snapshot --print.

    def push_job(self, server, *, use_workflow_header_mode=True, **secrets):
        values = dict({name: "" for name in SECRETS}, CORTHEX_NEXUS_URL=server.url, **secrets)
        code, row, _ = self.run_push_step(values, use_workflow_header_mode=use_workflow_header_mode)
        return code, row

    def session_push(self, server, *words, **credentials):
        home = Path(tempfile.mkdtemp(prefix="session-home-", dir=str(self.base)))
        env = dict(base_environment(home), CORTHEX_NEXUS_URL=server.url, CORTHEX_NEXUS_PUSH=PROJECT, **credentials)
        result = self.hub(env, "push", PROJECT, "--json", *words)
        rows = result.stdout.strip().splitlines()
        self.assertTrue(rows, "exit %d and no result line: %s" % (result.returncode, result.stderr[-600:]))
        return result.returncode, json.loads(rows[-1])

    def snapshot(self, schema):
        home = Path(tempfile.mkdtemp(prefix="snapshot-home-", dir=str(self.base)))
        result = self.hub(base_environment(home), "--home", str(home), "snapshot", "--path", str(self.project),
                          "--print", "--format", schema)
        self.assertEqual(result.returncode, 0, result.stderr[-600:])
        return json.loads(result.stdout)

    # The answers of a test server.

    def v3_held(self, commit=None, fmt=NEW, formats=(OLD, NEW)):
        """API-243's example, for this project, holding `commit` (the older one by default) in `fmt`."""
        answer = dict(self.example(self.held_op, "200", "held"), project=PROJECT,
                      default_commit=commit or self.held, format=fmt, formats=list(formats))
        if set(formats) <= {OLD, NEW}:
            self.assert_valid(answer, self.held_op, "200")
        return 200, answer

    def v2_held(self, commit=None):
        """v2's answer to API-243: its held commit with no formats, as the running v2 sends it."""
        return 200, {"project": PROJECT, "revision": 7, "default_commit": commit or self.held,
                     "generated_at": "2026-11-20T09:00:00.000Z", "received_at": "2026-11-20T09:00:01.000Z"}

    def v2_pushed(self, revision):
        """v2's answer to a push, the revision it stored."""
        return {"project": PROJECT, "revision": revision, "default_commit": self.commit}

    def push_answer(self, status, name, replaced):
        """API-242's success example for this project's newer commit, which replaced `replaced`."""
        answer = dict(self.example(self.push_op, status, name), project=PROJECT, commit=self.commit, replaced=replaced)
        self.assert_valid(answer, self.push_op, status)
        return answer

    def example(self, op, status, name, media="application/json"):
        """A copy of the value of one example of the operation's response."""
        return json.loads(json.dumps(op[2]["responses"][status]["content"][media]["examples"][name]["value"]))

    def project_not_found(self):
        return 404, self.example(self.held_op, "404", "project-not-found", "application/problem+json")

    def assert_valid(self, value, op, status):
        schema = op[2]["responses"][status]["content"]["application/json"]["schema"]
        self.assertEqual(contract.validate(self.doc, value, schema), [], "%s %s" % (op[2]["x-corthex"]["id"], status))

    # What the hub sent.

    def assert_requests_match_the_contract(self, server):
        """Each request is one of the two operations, with the headers the contract names and a valid snapshot."""
        allowed = {(m.upper(), p.replace("{project}", PROJECT)): op for m, p, op in (self.held_op, self.push_op)}
        for request in server.requests:
            where = "%s %s" % (request["method"], request["path"])
            self.assertIn((request["method"], request["path"]), allowed, where)
            op = allowed[(request["method"], request["path"])]
            params = {p["name"] for p in contract.params_of(self.doc, op)}
            headers = request["headers"]
            for name in ("Idempotency-Key", "Nexus-Session"):
                self.assertEqual(name.lower() in headers, name in params, "%s: %s" % (where, name))
            self.assertIn("application/json", headers.get("accept", ""), where)
            self.assertIn("application/problem+json", headers.get("accept", ""), where)
            if request["method"] == "GET":
                self.assertEqual(request["body"], b"", where)
                continue
            self.assertEqual(headers.get("content-type"), "application/json", where)
            self.assertLessEqual(len(request["body"]), self.limit, where + ": the body is over the contract's limit")
            body = json.loads(request["body"].decode("utf8"))
            self.assert_snapshot(body)

    def assert_snapshot(self, snapshot):
        """The snapshot validates against the Snapshot schema; 0.2 carries the pictures of stages 01, 05 and 07 only."""
        self.assertEqual(contract.validate(self.doc, snapshot, {"$ref": "#/components/schemas/Snapshot"}), [])
        self.assertEqual(snapshot["project"]["name"], PROJECT)
        self.assertEqual(snapshot["repos"]["."]["default"]["commit"], self.commit)
        if snapshot["schema"] == OLD:
            self.assertEqual({p["stage"] for p in snapshot["pictures"]}, V2_STAGES)
            self.assertFalse(any("key" in p for p in snapshot["pictures"]), "0.2 pictures carry no key")
        self.assert_taken_by_the_v3_intake(snapshot)

    def assert_taken_by_the_v3_intake(self, snapshot):
        """The v3 server's readSnapshot takes the snapshot in its format and leaves out none of its documents."""
        node = node_program(self, "the v3 intake check")
        folder = Path(tempfile.mkdtemp(prefix="intake-", dir=str(self.base)))
        (folder / "intake.mjs").write_text(INTAKE, encoding="utf8")
        (folder / "snapshot.json").write_text(json.dumps(snapshot, ensure_ascii=False), encoding="utf8")
        result = subprocess.run([node, str(folder / "intake.mjs"), str(SERVER_SOURCE), str(folder / "snapshot.json")],
                                capture_output=True, text=True, encoding="utf8", timeout=60)
        self.assertEqual(result.returncode, 0, result.stderr[-600:])
        read = json.loads(result.stdout.strip().splitlines()[-1])
        self.assertNotIn("refused", read, read)
        self.assertEqual((read["format"], read["commit"], read["replaces"]),
                         (snapshot["schema"], self.commit, snapshot.get("replaces")))
        self.assertEqual([d["path"] for d in read["documents"] if d["why"] is not None], [], "no document is left out")
        keys = [p["key"] for p in snapshot["pictures"] if "key" in p]
        self.assertLessEqual(set(keys), {d["path"] for d in read["documents"]}, "each file's picture is a document")
        return read

    def assert_text_pictures(self, snapshot):
        """Each user flow, screen definition and the mockup page is one picture with the file's whole text."""
        settings = json.loads((self.project / ".corthex" / "project.json").read_text(encoding="utf8"))["stages"]
        wanted = {}
        for stage, (kind, field, prefix) in DEFINED_IN.items():
            wanted[stage] = sorted({item[field].rsplit(":", 1)[0] for item in snapshot["items"]
                                    if item.get("kind") == kind and item.get(field)})
            source = settings[stage]["source"]
            for key in wanted[stage]:
                self.assertTrue(key.startswith(source), (stage, key))
            named = {path.relative_to(self.project).as_posix() for path in (self.project / source).glob(prefix + "*.md")
                     if not path.name.endswith(".ko.md")}
            self.assertTrue(named, stage)
            self.assertLessEqual(named, set(wanted[stage]),
                                 "%s: a %s*.md file the hub found nothing in" % (stage, prefix))
        wanted["09-mockup"] = [self.page]
        for stage, keys in wanted.items():
            with self.subTest(stage=stage):
                pictures = [p for p in snapshot["pictures"] if p["stage"] == stage]
                self.assertTrue(keys)
                self.assertEqual(sorted(p["key"] for p in pictures), keys)
                for picture in pictures:
                    self.assertEqual(picture["commit"], self.commit)
                    text = (self.project / picture["key"]).read_bytes().decode("utf8")
                    self.assertEqual(picture["source"]["text"], text, picture["key"] + " is sent whole")
        keys = [p.get("key", "") for p in snapshot["pictures"]]
        self.assertFalse([k for k in keys if re.search(r"\.ko\.\w+$", k)], "no translation copy is sent")
        self.assertEqual((snapshot["left_out"], snapshot["truncated"]), ([], False))

    # TASK-431: the v3 contract.

    def test_the_03_snapshot_of_this_repository_validates_against_the_contract(self):
        snapshot = self.snapshot(NEW)
        self.assertEqual(snapshot["schema"], NEW)
        schema = {"$ref": "#/components/schemas/Snapshot"}
        self.assertEqual(contract.validate(self.doc, snapshot, schema), [])
        size = len(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")).encode("utf8"))
        self.assertLessEqual(size, self.limit)
        self.assertEqual({p["stage"] for p in snapshot["pictures"]}, V2_STAGES | set(TEXT_STAGES))
        self.assert_text_pictures(snapshot)
        self.assert_taken_by_the_v3_intake(snapshot)
        # The validation is not empty: the Snapshot schema refuses what each format may not carry.
        self.assertTrue(contract.validate(self.doc, dict(snapshot, schema=OLD), schema),
                        "0.2 carries no stage-09 picture")
        keyless = json.loads(json.dumps(snapshot))
        del next(p for p in keyless["pictures"] if p["stage"] == "09-mockup")["key"]
        self.assertTrue(contract.validate(self.doc, keyless, schema), "a stage-09 picture needs its key")
        self.assertTrue(contract.validate(self.doc, dict(snapshot, schema="corthex-hub/0.4"), schema))

    def test_the_02_snapshot_of_this_repository_validates_against_the_contract(self):
        snapshot = self.snapshot(OLD)
        self.assertEqual(snapshot["schema"], OLD)
        self.assert_snapshot(snapshot)

    def test_the_v2_configured_workflow_sends_03_to_a_v3_server(self):
        # The credential pair goes in the headers that the contract's security schemes name.
        pair = {"CORTHEX_NEXUS_CLIENT_ID": "ac_" + "fixture", "CORTHEX_NEXUS_CLIENT_SECRET": "fixture" + "-pair"}
        with LoopbackServer({("GET", HELD_PATH): self.v3_held()}) as server:
            server.answers[("POST", PUSH_PATH)] = (200, self.push_answer("200", "drawn", self.held))
            code, row = self.push_job(server, **pair)
        sent = server.sent()
        self.assertEqual([s["schema"] for s in sent], [NEW])
        self.assertEqual(sent[0]["replaces"], self.held)
        self.assert_text_pictures(sent[0])
        self.assert_requests_match_the_contract(server)
        schemes = self.doc["components"]["securitySchemes"]
        # The actual workflow explicitly keeps the legacy headers while its target is v2.
        for request in server.requests:
            for scheme, variable in (("agentClientId", "CORTHEX_NEXUS_CLIENT_ID"),
                                     ("agentClientSecret", "CORTHEX_NEXUS_CLIENT_SECRET")):
                self.assertEqual(request["headers"].get(schemes[scheme]["name"].lower()), pair[variable], scheme)
            for scheme in ("nexusAgentClientId", "nexusAgentClientSecret"):
                self.assertFalse(schemes[scheme]["name"].lower() in request["headers"],
                                 "dedicated credential header unexpectedly present")
        self.assertEqual((code, row["outcome"], row["answer"]["sent"]), (0, "done", True), row)

    def test_a_v3_push_job_uses_dedicated_headers_after_override_removal(self):
        pair = {"CORTHEX_NEXUS_CLIENT_ID": "ac_fixture", "CORTHEX_NEXUS_CLIENT_SECRET": "fixture-pair"}
        with LoopbackServer({("GET", HELD_PATH): self.v3_held()}) as server:
            server.answers[("POST", PUSH_PATH)] = (200, self.push_answer("200", "drawn", self.held))
            code, row = self.push_job(server, use_workflow_header_mode=False, **pair)
        self.assertEqual((code, row["outcome"], row["answer"]["sent"]), (0, "done", True), row)
        self.assertGreaterEqual(len(server.requests), 1)
        for request in server.requests:
            self.assertEqual(request["headers"].get("nexus-agent-client-id"), pair["CORTHEX_NEXUS_CLIENT_ID"])
            self.assertEqual(request["headers"].get("nexus-agent-client-secret"), pair["CORTHEX_NEXUS_CLIENT_SECRET"])
            self.assertFalse("cf-access-client-id" in request["headers"] or
                             "cf-access-client-secret" in request["headers"], "mixed credential headers")

    def test_a_v3_session_uses_dedicated_credential_headers(self):
        pair = {"CORTHEX_NEXUS_CLIENT_ID": "ac_fixture", "CORTHEX_NEXUS_CLIENT_SECRET": "fixture-pair"}
        with LoopbackServer({("GET", HELD_PATH): self.v3_held()}) as server:
            server.answers[("POST", PUSH_PATH)] = (200, self.push_answer("200", "drawn", self.held))
            code, row = self.session_push(server, **pair)
        self.assertEqual((code, row["outcome"]), (0, "done"), row)
        self.assertGreaterEqual(len(server.requests), 1)
        for request in server.requests:
            self.assertEqual(request["headers"].get("nexus-agent-client-id"), pair["CORTHEX_NEXUS_CLIENT_ID"])
            self.assertEqual(request["headers"].get("nexus-agent-client-secret"), pair["CORTHEX_NEXUS_CLIENT_SECRET"])
            self.assertFalse("cf-access-client-id" in request["headers"] or
                             "cf-access-client-secret" in request["headers"], "mixed credential headers")

    def test_a_server_that_lists_a_newer_format_gets_the_newest_the_hub_knows(self):
        with LoopbackServer({("GET", HELD_PATH): self.v3_held(formats=(OLD, NEW, "corthex-hub/0.9"))}) as server:
            server.answers[("POST", PUSH_PATH)] = (200, self.push_answer("200", "drawn", self.held))
            code, row = self.push_job(server)
        self.assertEqual([s["schema"] for s in server.sent()], [NEW])
        self.assert_requests_match_the_contract(server)
        self.assertEqual((code, row["outcome"], row["answer"]["sent"]), (0, "done", True), row)

    def test_a_server_that_lists_02_only_gets_02(self):
        with LoopbackServer({("GET", HELD_PATH): self.v3_held(fmt=OLD, formats=(OLD,))}) as server:
            server.answers[("POST", PUSH_PATH)] = (200, self.push_answer("200", "drawn", self.held))
            code, row = self.push_job(server)
        self.assertEqual([s["schema"] for s in server.sent()], [OLD])
        self.assert_requests_match_the_contract(server)
        self.assertEqual((code, row["outcome"], row["answer"]["sent"]), (0, "done", True), row)

    def test_a_commit_held_in_02_goes_again_in_03_once(self):
        with LoopbackServer({("GET", HELD_PATH): self.v3_held(self.commit, fmt=OLD)}) as server:
            server.answers[("POST", PUSH_PATH)] = (200, self.push_answer("200", "same-commit", None))
            code, row = self.push_job(server)
        sent = server.sent()
        self.assertEqual([s["schema"] for s in sent], [NEW])
        self.assertNotIn("replaces", sent[0], "the same commit replaces nothing")
        self.assertEqual((code, row["answer"]["sent"]), (0, True), row)
        self.assert_requests_match_the_contract(server)
        # Once the server names 0.3 as the commit's format, the job stops.
        with LoopbackServer({("GET", HELD_PATH): self.v3_held(self.commit, fmt=NEW)}) as server:
            code, row = self.push_job(server)
        self.assertEqual(server.sent(), [])
        self.assertEqual((code, row["outcome"], row["answer"]), (0, "done", {"sent": False, "why": "already-held"}))

    # TASK-431: the running v2.

    def test_a_v2_server_gets_02_from_the_push_job(self):
        pair = {"CORTHEX_NEXUS_CLIENT_ID": "ac_fixture", "CORTHEX_NEXUS_CLIENT_SECRET": "fixture-pair"}
        with LoopbackServer({("GET", HELD_PATH): self.v2_held()}) as server:
            server.answers[("POST", PUSH_PATH)] = (200, self.v2_pushed(8))
            code, row = self.push_job(server, **pair)
        for request in server.requests:
            self.assertEqual(request["headers"].get("cf-access-client-id"), pair["CORTHEX_NEXUS_CLIENT_ID"])
            self.assertEqual(request["headers"].get("cf-access-client-secret"), pair["CORTHEX_NEXUS_CLIENT_SECRET"])
            self.assertFalse("nexus-agent-client-id" in request["headers"] or
                             "nexus-agent-client-secret" in request["headers"], "mixed credential headers")
        sent = server.sent()
        self.assertEqual([s["schema"] for s in sent], [OLD])
        self.assertEqual(sent[0]["replaces"], self.held)
        self.assert_requests_match_the_contract(server)
        self.assertEqual((code, row["outcome"], row["answer"]["sent"]), (0, "done", True), row)

    def test_a_v2_loopback_push_without_credentials_sends_no_credential_headers(self):
        with LoopbackServer({("GET", HELD_PATH): self.v2_held()}) as server:
            server.answers[("POST", PUSH_PATH)] = (200, self.v2_pushed(8))
            code, row = self.push_job(server)
        self.assertEqual((code, row["outcome"], row["answer"]["sent"]), (0, "done", True), row)
        self.assertGreaterEqual(len(server.requests), 1)
        for request in server.requests:
            self.assertFalse(any(name in request["headers"] for name in (
                "cf-access-client-id", "cf-access-client-secret", "nexus-agent-client-id", "nexus-agent-client-secret")),
                "credential headers unexpectedly present")

    def test_a_v2_server_holding_the_commit_gets_nothing_again(self):
        with LoopbackServer({("GET", HELD_PATH): self.v2_held(self.commit)}) as server:
            code, row = self.push_job(server)
        self.assertEqual([(r["method"], r["path"]) for r in server.requests], [("GET", HELD_PATH)])
        self.assertEqual((code, row["outcome"], row["answer"]), (0, "done", {"sent": False, "why": "already-held"}))

    def test_a_v2_server_gets_02_from_a_first_push(self):
        missing = (404, {"title": "No such project", "status": 404, "code": "project_not_found", "traceId": TRACE})
        with LoopbackServer({("GET", HELD_PATH): missing}) as server:
            server.answers[("POST", PUSH_PATH)] = (200, self.v2_pushed(1))
            code, row = self.session_push(server, "--first")
        self.assertEqual([s["schema"] for s in server.sent()], [OLD])
        self.assertNotIn("replaces", server.sent()[0])
        self.assert_requests_match_the_contract(server)
        self.assertEqual((code, row["outcome"]), (0, "done"), row)

    # TASK-431: every response API-242 and API-243 list.

    def test_every_response_api_243_lists(self):
        listed = {(status, name) for status, name, _ in examples(self.held_op[2])}
        self.assertEqual(listed, set(HELD_RESPONSES), "a response of API-243 has no expected outcome")
        for status, name, value in examples(self.held_op[2]):
            outcome, what = HELD_RESPONSES[(status, name)]
            with self.subTest(status=status, example=name):
                held = self.v3_held() if status == "200" else (served_status(status, value), value)
                with LoopbackServer({("GET", HELD_PATH): held}) as server:
                    server.answers[("POST", PUSH_PATH)] = (200, self.push_answer("200", "drawn", self.held))
                    code, row = self.push_job(server)
                self.assert_requests_match_the_contract(server)
                self.assertEqual(server.requests[0]["path"], HELD_PATH)
                self.assertEqual(row["outcome"], outcome, row)
                if what == "sent":
                    sent = [s["schema"] for s in server.sent()]
                    self.assertEqual((sent, code, row["answer"]["sent"]), ([NEW], 0, True))
                elif outcome == "done":
                    self.assertEqual((server.sent(), code, row["answer"]), ([], 0, {"sent": False, "why": what}))
                else:
                    self.assertEqual((server.sent(), code, row["problem"]), ([], 1, value))
                    self.assertEqual(row["problem"]["code"], what)

    def test_a_session_waits_for_the_users_yes_on_project_not_found(self):
        with LoopbackServer({("GET", HELD_PATH): self.project_not_found()}) as server:
            code, row = self.session_push(server)
        self.assertEqual(server.sent(), [])
        self.assertEqual((code, row["outcome"], row["failure"]), (1, "refused", "first push needs --first"), row)

    def test_every_response_api_242_lists(self):
        listed = {(status, name) for status, name, _ in examples(self.push_op[2])}
        self.assertEqual(listed, set(PUSH_RESPONSES), "a response of API-242 has no expected outcome")
        for status, name, value in examples(self.push_op[2]):
            outcome, what = PUSH_RESPONSES[(status, name)]
            with self.subTest(status=status, example=name):
                # What the hub sends: the newer commit in 0.3, the held commit again in 0.3 to complete its
                # revision, or a first push in 0.2, which has no held commit to read the server's formats from.
                if what == "same":
                    held, schema, replaces = self.v3_held(self.commit, fmt=OLD), NEW, None
                elif what == "first":
                    held, schema, replaces = self.project_not_found(), OLD, None
                else:
                    held, schema, replaces = self.v3_held(), NEW, self.held
                if outcome == "done":
                    value = self.push_answer(status, name, replaces)
                answers = {("GET", HELD_PATH): held, ("POST", PUSH_PATH): (served_status(status, value), value)}
                with LoopbackServer(answers) as server:
                    code, row = self.session_push(server, "--first") if what == "first" else self.push_job(server)
                self.assert_requests_match_the_contract(server)
                sent = server.sent()
                self.assertEqual([(s["schema"], s.get("replaces")) for s in sent], [(schema, replaces)])
                self.assertEqual(row["outcome"], outcome, row)
                if outcome == "done":
                    pushed = row["answer"] if what == "first" else row["answer"]["pushed"]
                    self.assertEqual((code, pushed), (0, value))
                else:
                    self.assertEqual((code, row["problem"]), (1, value))
                    self.assertEqual(row["problem"]["code"], what)


if __name__ == "__main__":
    unittest.main()
