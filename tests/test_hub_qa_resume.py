"""QA walk on the pinned hub and a disposable loopback v3 server (TC-215, TC-218)."""

from test_hub_run import HubRunTest, PROJECT


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
        self.first_push_and_comment()
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
