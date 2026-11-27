"""QA walk on the pinned hub and a disposable loopback v3 server (TC-215, TC-218)."""

import http.client
import http.server
import threading
import urllib.parse

from test_hub_run import HubRunTest, PROJECT, PULL


class HubQaWalk(HubRunTest):
    def test_two_sessions_trade_a_thread(self):
        thread = self.first_push_and_comment()
        self.owner_reply(thread)
        self.read(self.session, "claim", PROJECT, thread)
        refused = self.refused(self.other, "claim", PROJECT, thread)
        self.assertEqual((refused["status"], refused["code"], refused["session"]),
                         (409, "claimed", self.session["CORTHEX_NEXUS_SESSION"]))
        released = self.read(self.session, "release", PROJECT, thread)
        self.assertTrue(released["released"])
        self.assertTrue(self.read(self.other, "claim", PROJECT, thread)["mine"])
        refused = self.refused(self.session, "claim", PROJECT, thread)
        self.assertEqual((refused["status"], refused["code"], refused["session"]),
                         (409, "claimed", self.other["CORTHEX_NEXUS_SESSION"]))
        self.read(self.other, "reply", PROJECT, thread, "--text", "A synthetic reply.")
        shown = self.read(self.session, "show", PROJECT, thread)
        self.assertEqual(sum(entry.get("text") == "A synthetic reply." for entry in shown["entries"]), 1)
        self.read(self.other, "release", PROJECT, thread)
        self.owner_reply(thread)
        self.assertTrue(self.read(self.session, "claim", PROJECT, thread)["mine"])

    def test_remove_informs_without_deleting(self):
        thread = self.first_push_and_comment()
        edit, checkpoint = self.owner_edit_and_confirmation()
        proposal = self.read(self.session, "propose", PROJECT, "--part", "nexus", "--stage", "05-erd",
                             "--item", "TBL-146", "--reason", "Synthetic reason", "--change", "Synthetic change")
        for entry in (thread, proposal["id"], edit, checkpoint):
            self.assertEqual(self.read(self.session, "show", PROJECT, entry)["id"], entry)
        code, row = self.command(self.session, "remove", PROJECT)
        self.assertEqual((code, row["outcome"], row["answer"]["project"]), (0, "done", PROJECT))
        status, project = self.server.owner("GET", "/api/projects/" + PROJECT)
        self.assertEqual((status, project["name"]), (200, PROJECT))

    def test_deletion_then_first_send_again(self):
        first = self.read(self.session, "push", PROJECT, "--first")
        self.assertEqual(first["revision"], 1)
        path = "/api/projects/" + PROJECT + "/removal"
        status, preview = self.server.owner("GET", path)
        self.assertEqual((status, preview["revision"]), (200, 1))
        with (self.project / "README.md").open("a", encoding="utf8") as readme:
            readme.write("\nSynthetic QA revision.\n")
        self.commit = self.commit_and_publish("Synthetic QA revision")
        self.assertEqual(self.read(self.session, "push", PROJECT)["revision"], 2)
        status, _ = self.server.owner("POST", path, {"name": PROJECT})
        self.assertEqual(status, 200)
        self.assertEqual(self.server.owner("GET", "/api/projects/" + PROJECT)[0], 404)
        code, row = self.command(self.session, "push", PROJECT)
        self.assertEqual((code, row["outcome"], row["failure"]), (1, "refused", "first push needs --first"))
        self.assertEqual(self.server.owner("GET", "/api/projects/" + PROJECT)[0], 404)
        restored = self.read(self.session, "push", PROJECT, "--first")
        self.assertEqual((restored["revision"], restored["created"]), (1, True))
        self.assertEqual(self.server.owner("GET", "/api/projects/" + PROJECT)[0], 200)

    def test_reply_and_answered_repeat_after_a_lost_response(self):
        thread = self.first_push_and_comment()
        self.owner_reply(thread)
        target = urllib.parse.urlsplit(self.server.url)

        class DropOnce(http.server.BaseHTTPRequestHandler):
            drop = None
            observed = []

            def log_message(self, *args):
                pass

            def do_GET(self):
                self.forward()

            def do_POST(self):
                self.forward()

            def forward(self):
                body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
                headers = {k: v for k, v in self.headers.items()
                           if k.lower() not in ("host", "connection", "content-length")}
                connection = http.client.HTTPConnection(target.hostname, target.port, timeout=20)
                connection.request(self.command, self.path, body=body or None, headers=headers)
                answer = connection.getresponse()
                payload = answer.read()
                if self.command == "POST" and (self.path.endswith("/replies") or self.path.endswith("/answered")):
                    DropOnce.observed.append((answer.status, payload, self.headers.get("Idempotency-Key")))
                if self.command == "POST" and self.path.endswith(DropOnce.drop or "NEVER"):
                    DropOnce.drop = None
                    self.connection.shutdown(2)
                    self.connection.close()
                    connection.close()
                    return
                self.send_response(answer.status)
                for key, value in answer.getheaders():
                    if key.lower() not in ("connection", "transfer-encoding", "content-length"):
                        self.send_header(key, value)
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                connection.close()

        proxy = http.server.ThreadingHTTPServer(("127.0.0.1", 0), DropOnce)
        threading.Thread(target=proxy.serve_forever, daemon=True).start()
        env = dict(self.session, CORTHEX_NEXUS_URL="http://127.0.0.1:%s" % proxy.server_port)
        try:
            for name, ending, words in (("reply", "/replies", ("--text", "Synthetic retry reply.")),
                                        ("answered", "/answered", ())):
                DropOnce.drop = ending
                code, row = self.command(env, name, PROJECT, thread, *words)
                self.assertEqual((code, row["outcome"], row["outbox"]["waiting"]), (3, "kept", 1))
                code, row = self.command(env, "outbox", PROJECT, "--send")
                self.assertEqual((code, row["outcome"], row["outbox"]["sent"], row["outbox"]["waiting"]),
                                 (0, "done", 1, 0))
            self.assertEqual(len(DropOnce.observed), 4)
            for index, expected in ((0, 201), (2, 200)):
                first, repeated = DropOnce.observed[index:index + 2]
                self.assertEqual((first[0], repeated[0]), (expected, expected))
                self.assertTrue(first[1] == repeated[1], "repeat returned a different response")
                self.assertTrue(first[2] and first[2] == repeated[2], "repeat did not keep its request key")
            shown = self.read(self.session, "show", PROJECT, thread)
            self.assertEqual(sum(entry.get("text") == "Synthetic retry reply." for entry in shown["entries"]), 1)
        finally:
            proxy.shutdown()
            proxy.server_close()

    def test_redraw_invalidates_reflects_and_moves_a_thread(self):
        thread = self.first_push_and_comment()
        edit, checkpoint = self.owner_edit_and_confirmation()
        self.read(self.session, "reflect", PROJECT, edit, "opened", "--pr", PULL % 12)
        self.read(self.session, "reflect", PROJECT, edit, "merged", "--pr", PULL % 12)

        schema = self.project / "db/nexus.sql"
        original = schema.read_text(encoding="utf8")
        start = original.index("-- TBL-146 ")
        end = original.index("-- TBL-147 ", start)
        schema.write_text(original[:start] + original[end:], encoding="utf8")
        sitemap = self.project / "docs/07-sitemap/nexus.yaml"
        original = sitemap.read_text(encoding="utf8")
        self.assertIn("name: Owner to-do", original)
        sitemap.write_text(original.replace("name: Owner to-do", "name: Owner work list", 1), encoding="utf8")
        self.commit = self.commit_and_publish("Synthetic diagram changes")
        reported = self.read(self.session, "reflect", PROJECT, edit, "reflected", "--commit", self.commit,
                             "--pr", PULL % 12)
        self.assertEqual(reported["edit"]["state"], "reported")
        pushed = self.read(self.session, "push", PROJECT)
        self.assertEqual((pushed["confirmations_invalidated"], pushed["change_sets_reflected"],
                          pushed["threads_moved"], pushed["failures"], pushed["refused"]), (1, 1, 1, [], []))
        todo = self.read(self.session, "todo", PROJECT)
        self.assertEqual(todo["reflections"]["total"], 0)
        self.assertEqual(todo["checkpoints"]["total"], 1)
        moved = self.read(self.session, "show", PROJECT, thread)
        self.assertEqual((moved["target"], moved["removed_name"]), ("diagram", "agent_credentials"))
        self.assertEqual(self.read(self.session, "show", PROJECT, edit)["state"], "done")
        self.assertEqual(self.read(self.session, "show", PROJECT, checkpoint)["confirmation"], "invalidated")

    def test_checkpoint_pull_request_after_each_kind_of_cancellation(self):
        self.read(self.session, "push", PROJECT, "--first")
        for stage, number, recorded in (("07-sitemap", 80, False), ("05-erd", 81, True)):
            with self.subTest(stage=stage):
                (diagram, drawing), = self.drawings(stage)
                status, created = self.server.owner("POST", "/api/projects/%s/diagrams/%s/confirmation" % (PROJECT, diagram),
                                                    {"drawing": drawing})
                self.assertEqual(status, 201)
                checkpoint = created["confirmation"]["id"]
                self.read(self.session, "record", PROJECT, checkpoint, "opened", "--pr", PULL % number)
                if recorded:
                    self.read(self.session, "record", PROJECT, checkpoint, "merged", "--pr", PULL % number)
                status, cancelled = self.server.owner("POST", "/api/projects/%s/confirmations/%s/cancel" % (PROJECT, checkpoint), {})
                self.assertEqual((status, cancelled["confirmation"]["pull_request"]), (200, None))
                status, diagram_answer = self.server.owner("GET", "/api/projects/%s/diagrams/%s" % (PROJECT, diagram))
                self.assertEqual((status, diagram_answer["confirmation"]["pull_request"]), (200, None))
                shown = self.read(self.session, "show", PROJECT, checkpoint)
                self.assertEqual((shown["state"], shown["record_state"], shown["pull_request"]),
                                 ("withdrawn", "waiting", PULL % number))
                if not recorded:
                    refused = self.refused(self.session, "record", PROJECT, checkpoint, "closed", "--pr", PULL % number)
                    self.assertEqual((refused["status"], refused["code"]), (409, "confirmation_cancelled"))
                else:
                    old = self.read(self.session, "record", PROJECT, checkpoint, "closed", "--pr", PULL % number)
                    self.assertFalse(old["changed"])
                    self.read(self.session, "record", PROJECT, checkpoint, "opened", "--pr", PULL % 82)
                    merged = self.read(self.session, "record", PROJECT, checkpoint, "merged", "--pr", PULL % 82)
                    self.assertEqual(merged["checkpoint"]["pull_request"], PULL % 82)
                    status, diagram_answer = self.server.owner("GET", "/api/projects/%s/diagrams/%s" % (PROJECT, diagram))
                    self.assertEqual((status, diagram_answer["confirmation"]["pull_request"]), (200, PULL % 82))
