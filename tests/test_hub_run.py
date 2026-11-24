"""TASK-449: the pinned hub's eight commands against a local v3 server (SPEC-014; API-242, API-243, API-245, API-250,
API-252, API-255, API-258, API-259).

Each test builds this checkout's files into a repository in a temporary folder, as tests/test_hub_project.py does,
and starts the v3 server of server/src with tests/hub_run_server.mjs: a new store in a throwaway data folder, every
operation of server/src/routes.js on a free port of 127.0.0.1, and a gate whose key pair is made at run time. The
owner's sign-in is a stand-in for that gate, as the server's own tests make one. The test issues an agent credential
through API-280 with it, and gives the hub the server's address, the credential and a session through the
environment, as the hub reads them with no profile (CORTHEX_NEXUS_URL, CORTHEX_NEXUS_CLIENT_ID,
CORTHEX_NEXUS_CLIENT_SECRET, CORTHEX_NEXUS_PUSH and CORTHEX_NEXUS_SESSION). The hub is the clean checkout of
hub-ref.json that CORTHEX_HUB_CHECKOUT names; nothing is fetched and nothing beyond the loopback port is contacted.

- Each of push, todo, claim, comment, decide, reflect, status and record exits 0 with the outcome done, no problem,
  no failure and no remark, and nothing waits in its outbox: the hub's own code read the server's answer. The owner
  makes the entries the agent commands act on through the owner operations, as the owner's screens send them: a reply
  in the agent's thread (API-268), a direct edit (API-272) and a confirmation (API-275).
- status contacts no server: it writes the stage record in the repository, and the push job's next push carries the
  record, with its NEXUS checkpoint ID, to the server in its snapshot (API-242).
- The server's answers that refuse by design are read too: todo before the first push reads the missing space as an
  empty to-do; push without --first sends nothing and asks for the user's yes; a claim or a write on an entry another
  session holds is refused with the server's Problem, exit 1, and its write is not kept to send again; the push job
  sends the commit of a first push again in corthex-hub/0.3 once, and then nothing, since the server holds it.
- Each command calls the operations it names, in order, and no log line of the server holds the credential's secret
  or its digest, the owner's sign-in or the data folder (rule 5).
"""

import hashlib
import json
import os
import re
import secrets
import shutil
import subprocess
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

from test_hub_project import HubCheckoutCase, base_environment

ROOT = Path(__file__).resolve().parents[1]
HARNESS = ROOT / "tests" / "hub_run_server.mjs"
PROJECT = "corthex-nexus"
# Pull request links in the project's repository. The server reads only their form; nothing opens them.
PULL = "https://github.com/kodonghui/corthex-nexus/pull/%d"
# The stage page of a checkpoint in the address form of SCR-145, on a placeholder host. The hub needs an https link
# for a checkpoint that names a NEXUS checkpoint, and the local server has none.
WHERE = "https://nexus.example.com/p/%s/nexus/07-sitemap" % PROJECT
# The 32 characters of the contract's IDs, for a request key of the owner's writes.
ID_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"
# The operations each command calls, as the server's log names them; status calls none. A push that sends nothing
# reads the held commit only.
CALLS = {
    "push": ["getHeldCommit", "pushSnapshot"],
    "push sending nothing": ["getHeldCommit"],
    "todo": ["getAgentTodo"],
    "claim": ["claimEntry"],
    "comment": ["leaveComment"],
    "decide": ["recordDecision"],
    "reflect": ["reportEdit"],
    "record": ["reportCheckpoint"],
    "status": [],
}
QUESTION = "Does a revoked credential keep its name?"
DECISION = "Kept in the ERD."


def calls(*commands):
    return [action for command in commands for action in CALLS[command]]


def node_program(case):
    node = shutil.which("node")
    case.assertTrue(node, "the hub run needs Node 24 (AGENTS.md)")
    version = subprocess.run([node, "--version"], capture_output=True, text=True, timeout=30).stdout.strip()
    case.assertGreaterEqual(int(re.match(r"v(\d+)", version).group(1)), 24, "the hub run needs Node 24")
    return node


class LocalServer:
    """The v3 server of tests/hub_run_server.mjs in a data folder of its own, until close()."""

    def __init__(self, node, base):
        self.data = base / "server-data"
        self.data.mkdir()
        self.log = base / "server.log"
        self.errors = (base / "server.err").open("w", encoding="utf8")
        self.process = subprocess.Popen([node, str(HARNESS), str(self.data), str(self.log)], stdin=subprocess.PIPE,
                                        stdout=subprocess.PIPE, stderr=self.errors, text=True, encoding="utf8")
        first = []
        reader = threading.Thread(target=lambda: first.append(self.process.stdout.readline()), daemon=True)
        reader.start()
        reader.join(60)
        if not first or not first[0].strip():
            self.close()
            raise AssertionError("the server did not start: " + (base / "server.err").read_text(encoding="utf8")[-600:])
        started = json.loads(first[0])
        self.url, self.owner_sign_in = started["url"], started["owner"]
        # The loopback address goes straight to the server, whatever proxy the environment names.
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def close(self):
        """Stops the server, which closes the store and the log, and returns the log's lines."""
        if self.process.poll() is None:
            self.process.stdin.close()
            try:
                self.process.wait(timeout=30)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=30)
        self.process.stdout.close()
        self.errors.close()
        return self.log.read_text(encoding="utf8").splitlines() if self.log.exists() else []

    def owner(self, method, path, body=None):
        """An owner request with the stand-in sign-in: (status, JSON body). A write carries a new request key."""
        headers = {"Accept": "application/json", "Cf-Access-Jwt-Assertion": self.owner_sign_in}
        data = None
        if method != "GET":
            headers["Idempotency-Key"] = '"nw_%s"' % "".join(secrets.choice(ID_ALPHABET) for _ in range(12))
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf8")
        request = urllib.request.Request(self.url + path, data=data, method=method, headers=headers)
        try:
            with self.opener.open(request, timeout=30) as answer:
                return answer.status, json.loads(answer.read())
        except urllib.error.HTTPError as refused:
            return refused.code, json.loads(refused.read())


class HubRunTest(HubCheckoutCase):
    def setUp(self):
        self.node = node_program(self)
        super().setUp()
        self.run_git("symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main")
        self.server = LocalServer(self.node, self.base)
        self.log_lines = None
        self.addCleanup(self.stop_server)
        status, issued = self.server.owner("POST", "/api/credentials", {"name": "hub-run"})
        self.assertEqual(status, 201, issued)
        self.credential, self.secret = issued["credential"]["id"], issued["secret"]
        self.outputs = []
        self.session = self.agent_environment("hub-run-a")
        self.other = self.agent_environment("hub-run-b")

    def stop_server(self):
        if self.log_lines is None:
            self.log_lines = self.server.close()
        return self.log_lines

    def agent_environment(self, label):
        """The hub's environment with no profile, for one agent session with a device home of its own."""
        home = Path(tempfile.mkdtemp(prefix="agent-home-", dir=str(self.base)))
        return dict(base_environment(home), CORTHEX_NEXUS_URL=self.server.url, CORTHEX_NEXUS_PUSH=PROJECT,
                    CORTHEX_NEXUS_CLIENT_ID=self.credential, CORTHEX_NEXUS_CLIENT_SECRET=self.secret,
                    CORTHEX_NEXUS_SESSION="%s-%s" % (label, secrets.token_hex(6)))

    # How the hub runs: a session's command, and the push job's own lines.

    def command(self, env, name, *words):
        """Runs one hub command with --json: (exit code, its outcome row)."""
        result = self.hub(env, name, *words, "--json")
        self.outputs += [result.stdout, result.stderr]
        rows = result.stdout.strip().splitlines()
        self.assertTrue(rows, "%s: exit %d and no result line: %s" % (name, result.returncode, result.stderr[-600:]))
        row = json.loads(rows[-1])
        self.assertEqual((row["command"], row["project"]), (name, PROJECT), row)
        self.row = row
        return result.returncode, row

    def read(self, env, name, *words):
        """A command whose answer the hub read without error: its answer."""
        code, row = self.command(env, name, *words)
        self.assertEqual((code, row["outcome"], row["problem"], row["failure"], row["remarks"]),
                         (0, "done", None, None, []), row)
        self.assertEqual(row["outbox"]["waiting"], 0, row)
        return row["answer"]

    def refused(self, env, name, *words):
        """A command the server refused by design: exit 1 and the server's Problem."""
        code, row = self.command(env, name, *words)
        self.assertEqual((code, row["outcome"], row["answer"], row["failure"]), (1, "refused", None, None), row)
        self.assertEqual(row["outbox"]["waiting"], 0, "a refused write is not kept to send again")
        return row["problem"]

    def push_job(self):
        code, row, home = self.run_push_step({"CORTHEX_NEXUS_URL": self.server.url,
                                              "CORTHEX_NEXUS_CLIENT_ID": self.credential,
                                              "CORTHEX_NEXUS_CLIENT_SECRET": self.secret})
        self.outputs.append(json.dumps(row))
        self.assertEqual((code, row["command"], row["project"], row["outcome"], row["problem"], row["failure"],
                          row["remarks"]), (0, "push", PROJECT, "done", None, None, []), row)
        return row["answer"], home

    def commit_and_publish(self, message):
        """Commits the repository's changes to its default branch, as a merge to main does."""
        self.run_git("add", "-A")
        self.run_git("commit", "--no-verify", "-q", "-m", message)
        commit = self.run_git("rev-parse", "HEAD")
        self.run_git("update-ref", "refs/remotes/origin/main", commit)
        return commit

    # The owner's side, through the owner operations.

    def diagram_of(self, stage, part):
        status, project = self.server.owner("GET", "/api/projects/%s" % PROJECT)
        self.assertEqual(status, 200, project)
        found = [d for s in project["stages"] if (s["stage"], s["part"]) == (stage, part) for d in s["diagrams"]]
        self.assertEqual(len(found), 1, found)
        status, diagram = self.server.owner("GET", "/api/projects/%s/diagrams/%s" % (PROJECT, found[0]["id"]))
        self.assertEqual(status, 200, diagram)
        return diagram["id"], diagram["drawing"]["id"]

    def owner_writes(self, thread):
        """The owner replies in the thread, renames an element of the ERD and confirms the sitemap. Returns the
        reflection's and the confirmation's entries."""
        status, reply = self.server.owner("POST", "/api/projects/%s/threads/%s/comments" % (PROJECT, thread),
                                          {"text": "Yes: a revoked credential keeps its name."})
        self.assertEqual((status, reply["thread"]["waits_on"]), (201, "agent"), reply)
        erd, erd_drawing = self.diagram_of("05-erd", "nexus")
        status, edit = self.server.owner("POST", "/api/projects/%s/diagrams/%s/direct-edits" % (PROJECT, erd),
                                         {"drawing": erd_drawing, "op": "rename", "element": "TBL-146",
                                          "name": "agent_keys"})
        self.assertEqual(status, 201, edit)
        sitemap, sitemap_drawing = self.diagram_of("07-sitemap", "nexus")
        status, confirmed = self.server.owner("POST", "/api/projects/%s/diagrams/%s/confirmation" % (PROJECT, sitemap),
                                              {"drawing": sitemap_drawing})
        self.assertEqual(status, 201, confirmed)
        return edit["change_set"]["reflection"], confirmed["confirmation"]["id"]

    def first_push_and_comment(self):
        pushed = self.read(self.session, "push", PROJECT, "--first")
        self.assertEqual((pushed["revision"], pushed["commit"], pushed["created"], pushed["failures"],
                          pushed["refused"]), (1, self.commit, True, [], []), pushed)
        self.assertGreater(pushed["diagrams"]["drawn"], 0, pushed)
        thread = self.read(self.session, "comment", PROJECT, "--part", "nexus", "--stage", "05-erd", "--item",
                           "TBL-146", "--text", QUESTION, "--asks", "answer")
        self.assertRegex(thread["id"], r"^nc_")
        self.assertEqual((thread["stage"], thread["element"], thread["waits_on"], thread["entries"][0]["author"]),
                         ("05-erd", "TBL-146", "owner", "agent"), thread)
        return thread["id"]

    def assert_calls_and_log(self, *commands):
        """The server's log names the agent operations the commands called, in order, and no line holds what rule 5
        keeps out, nor a session, a link or a comment's text."""
        lines = [json.loads(line) for line in self.stop_server()]
        self.assertEqual([line["action"] for line in lines if line["sender"] == "hub-run"], calls(*commands))
        digest = hashlib.sha256(self.secret.encode("ascii")).hexdigest()
        text = "\n".join(json.dumps(line) for line in lines)
        for value in (self.secret, digest, self.server.owner_sign_in, str(self.server.data),
                      str(self.server.data).replace("\\", "/"), self.session["CORTHEX_NEXUS_SESSION"],
                      self.other["CORTHEX_NEXUS_SESSION"], PULL % 1, PULL % 2, QUESTION, DECISION):
            self.assertNotIn(value, text, "the server's log holds what it keeps out")
        for output in self.outputs:
            self.assertNotIn(self.secret, output, "the hub shows the credential's secret")

    def test_each_command_gets_an_answer_the_hub_reads(self):
        first = self.commit
        thread = self.first_push_and_comment()
        reflection, confirmation = self.owner_writes(thread)

        todo = self.read(self.session, "todo", PROJECT)
        self.assertEqual((todo["default_commit"], todo["session"]),
                         (first, self.session["CORTHEX_NEXUS_SESSION"]), todo)
        listed = {kind: [entry["id"] for entry in todo[kind]["entries"]]
                  for kind in ("comments", "reflections", "checkpoints")}
        self.assertEqual(listed, {"comments": [thread], "reflections": [reflection], "checkpoints": [confirmation]})
        # The hub keeps what the session read, and names what is new since its last read.
        self.assertEqual((self.row["read"], {kind: self.row["new"][kind] for kind in listed}), (True, listed), self.row)

        claim = self.read(self.session, "claim", PROJECT, thread)
        self.assertEqual((claim["entry"], claim["session"], claim["mine"]),
                         (thread, self.session["CORTHEX_NEXUS_SESSION"], True), claim)

        decided = self.read(self.session, "decide", PROJECT, thread, "--link", PULL % 1, "--text", DECISION)
        self.assertEqual((decided["thread"]["id"], decided["thread"]["waits_on"], decided["entry"]["kind"],
                          decided["entry"]["link"]), (thread, "owner", "decision", PULL % 1), decided)

        reflected = self.read(self.session, "reflect", PROJECT, reflection, "opened", "--pr", PULL % 2)
        self.assertEqual((reflected["edit"]["id"], reflected["edit"]["state"], reflected["edit"]["pull_request"],
                          reflected["edit"]["claim"]["mine"], reflected["changed"]),
                         (reflection, "in_review", PULL % 2, True, True), reflected)

        recorded = self.read(self.session, "record", PROJECT, confirmation, "opened", "--pr", PULL % 2)
        self.assertEqual((recorded["checkpoint"]["id"], recorded["checkpoint"]["record_state"],
                          recorded["checkpoint"]["pull_request"], recorded["changed"]),
                         (confirmation, "in_review", PULL % 2, True), recorded)

        # status writes the stage record in the repository; the next push carries it to the server.
        checkpoint = {"approved": "The sitemap confirmed on NEXUS", "by": "the maintainer", "nexus": confirmation,
                      "where": WHERE, "date": "2026-11-24"}
        status = self.read(self.session, "status", PROJECT, "07-sitemap", "--part", "nexus", "--repository",
                           "--state", "done", "--checkpoint", checkpoint["approved"], "--by", checkpoint["by"],
                           "--date", checkpoint["date"], "--nexus", confirmation, "--where", WHERE)
        self.assertEqual((status["stage"], status["from"], status["record"]["checkpoints"][-1]),
                         ("07-sitemap", "repository", checkpoint), status)
        stages = json.loads((self.project / ".corthex" / "stages" / "nexus.json").read_text(encoding="utf8"))
        self.assertEqual(stages["stages"]["07-sitemap"]["checkpoints"][-1], checkpoint)
        self.commit = self.commit_and_publish("Record the confirmation of the sitemap")

        answer, home = self.push_job()
        pushed = answer["pushed"]
        self.assertEqual((answer["sent"], pushed["revision"], pushed["commit"], pushed["replaced"], pushed["failures"],
                          pushed["refused"]), (True, 2, self.commit, first, [], []), answer)
        sent = json.loads((home / ".corthex" / "hub" / "snapshots" / ("%s.json" % PROJECT)).read_text(encoding="utf8"))
        self.assertEqual(sent["repos"]["."]["default"]["commit"], self.commit)
        self.assertEqual(sent["stages"]["07-sitemap"]["parts"]["nexus"]["checkpoints"][-1]["nexus"], confirmation)

        self.assert_calls_and_log("push", "comment", "todo", "claim", "decide", "reflect", "record", "status", "push")

    def test_the_hub_reads_the_refusals_by_design(self):
        # Before the first push, the space is missing: the to-do is empty, and push waits for the user's yes.
        empty = self.read(self.session, "todo", PROJECT)
        self.assertEqual([empty[kind]["total"] for kind in ("comments", "discrepancies", "reflections", "checkpoints")],
                         [0, 0, 0, 0], empty)
        code, row = self.command(self.session, "push", PROJECT)
        self.assertEqual((code, row["outcome"], row["answer"], row["problem"], row["failure"]),
                         (1, "refused", None, None, "first push needs --first"), row)

        thread = self.first_push_and_comment()
        self.owner_writes(thread)
        self.read(self.session, "claim", PROJECT, thread)
        # Another session's claim and write on the entry the first holds.
        for words in (("claim", PROJECT, thread),
                      ("decide", PROJECT, thread, "--link", PULL % 1, "--text", DECISION)):
            with self.subTest(command=words[0]):
                problem = self.refused(self.other, *words)
                self.assertEqual((problem["status"], problem["code"], problem["session"]),
                                 (409, "claimed", self.session["CORTHEX_NEXUS_SESSION"]), problem)

        # The push job sends the commit the first push sent in corthex-hub/0.2 again in 0.3, which the server lists,
        # and then nothing: the server holds the commit in the newest format the hub knows.
        answer, _ = self.push_job()
        self.assertEqual((answer["sent"], answer["pushed"]["revision"], answer["pushed"]["commit"],
                          answer["pushed"]["same_commit"]), (True, 1, self.commit, True), answer)
        answer, _ = self.push_job()
        self.assertEqual(answer, {"sent": False, "why": "already-held"})

        self.assert_calls_and_log("todo", "push sending nothing", "push", "comment", "claim", "claim", "decide", "push",
                                  "push sending nothing")


if __name__ == "__main__":
    unittest.main()
