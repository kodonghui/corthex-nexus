"""The stage-03 pictures that the user-flow drawer's test draws are the pinned hub's own pictures of docs/03-user-flow.

The user-flow drawer (TASK-424) draws each picture of stage 03 that a corthex-hub/0.3 snapshot sends: one flow file,
its repository path as the key and its whole text, which NEXUS parses itself. `server/test/user-flow.test.js` draws
`server/test/user-flow-pictures.json`, the pictures the pinned hub makes of this repository's flow files, and compares
the drawings with the stored ones, `server/test/user-flow-expected.json`. The server's tests run with Node alone, so
this test makes the pictures again with the pinned hub, the clean checkout at the commit of `hub-ref.json` that
`CORTHEX_HUB_CHECKOUT` names (prepare it with `python tools/fetch_hub_ref.py`), through the hub's own snapshot03
code over this working tree's files instead of the default commit's Git objects. It fails when the stored pictures
differ: when a flow file changed, came or went, or when a new hub pin reads them otherwise. Nothing is fetched and no
server is contacted.

To make the two files again, from the repository's root:

    CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_user_flow_pictures.py --write
    (cd server && node test/user-flow-expected.js --write)
"""

import hashlib
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from hub_ref import locate_hub  # noqa: E402

SCRIPTS = "plugins/corthex-nexus/skills/corthex-hub/scripts"
STAGE = "03-user-flow"
FIXTURE = ROOT / "server" / "test" / "user-flow-pictures.json"
ABOUT = ("The pinned hub's corthex-hub/0.3 pictures of this repository's stage 03, as its snapshot03.py makes them "
         "from the stage's source, without the commit and time a snapshot gives each, and the SHA-256 of each file. "
         "tests/test_user_flow_pictures.py checks them against the pinned hub and says how to make them again.")


def pinned_hub():
    spec = importlib.util.spec_from_file_location("corthex_hub_pinned_flows", locate_hub() / SCRIPTS / "hub.py")
    hub = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(hub)
    return hub


def working_tree(hub, folder):
    """The hub's tree of a default commit, read from this working tree's files in one folder instead of Git objects."""

    class WorkingTree(hub.companion("snapshot02").ObjectTree):
        def __init__(self):
            self.root, self.commit, self.h = ROOT, None, hub
            self.files = {}
            self.sizes = {}
            for path in sorted((ROOT / folder).iterdir()):
                if path.is_file():
                    rel = path.relative_to(ROOT).as_posix()
                    self.files[rel] = rel
                    self.sizes[rel] = path.stat().st_size

        def read(self, rel):
            # As ObjectTree.read: no secret path, nothing over the hub's largest file, decoded as a Git blob.
            if rel not in self.files or self.h.secret_path(self.root / rel, self.root) or self.sizes[rel] > self.h.MAX_FILE_BYTES:
                return None
            return (self.root / rel).read_bytes().decode("utf-8-sig", "replace")

    return WorkingTree()


def hub_pictures(hub):
    """What the fixture holds, as the pinned hub makes it now."""
    project, why = hub.open_project(ROOT)
    if project is None:
        raise AssertionError(why)
    source = project.settings["stages"][STAGE]["source"]
    # As the hub's snapshot makes a 0.3 snapshot's pictures: the project's trace ID formats and parts, then
    # snapshot03.pictures over the default commit's tree, here this working tree's flow files. A home folder that holds
    # nothing makes the scrub of each text the same on every machine.
    hub.picture_ids = hub.IdFormat(project.settings.get("ids"))
    checks = []
    parts = hub.companion("snapshot02").parts_of(project.settings, checks, hub)
    snapshot = {"pictures": [], "left_out": []}
    default = {"commit": "0" * 40, "time": "2026-11-24T00:00:00+00:00"}
    with tempfile.TemporaryDirectory() as home:
        hub.companion("snapshot03").pictures(snapshot, project, parts, working_tree(hub, source), default, checks, hub, home)
    pictures = []
    for picture in snapshot["pictures"]:
        if picture["stage"] != STAGE:
            continue
        data = (ROOT / picture["key"]).read_bytes()
        kept = {key: value for key, value in picture.items() if key not in ("commit", "time")}
        pictures.append({"sha256": hashlib.sha256(data).hexdigest(), "picture": kept})
    return {"about": ABOUT, "stage": STAGE, "source": source,
            "checks": [check for check in checks if check.get("stage") in (None, STAGE)],
            "left_out": [entry for entry in snapshot["left_out"] if entry["stage"] == STAGE],
            "pictures": pictures}


class UserFlowPicturesTest(unittest.TestCase):
    def test_the_stored_pictures_are_the_pinned_hubs(self):
        stored = json.loads(FIXTURE.read_text(encoding="utf-8"))
        made = hub_pictures(pinned_hub())
        again = "make them again as this file's docstring says"
        self.assertEqual([entry["picture"]["key"] for entry in stored["pictures"]],
                         [entry["picture"]["key"] for entry in made["pictures"]], f"the flow files came or went: {again}")
        for was, now in zip(stored["pictures"], made["pictures"]):
            self.assertEqual(was["sha256"], now["sha256"], f"{now['picture']['key']} changed since the stored pictures: {again}")
        self.assertEqual(stored, made, f"the pinned hub's pictures of docs/03-user-flow differ from the stored ones: {again}")

    def test_each_picture_is_one_flow_file_whole(self):
        made = hub_pictures(pinned_hub())
        # The 13 flows, one picture each, with no README and no Korean copy, and no file left out. A flow file's name
        # names no part of the project's, so each is in no part, which the hub notes and nothing more.
        self.assertEqual(len(made["pictures"]), 13)
        self.assertEqual(made["left_out"], [])
        self.assertEqual([(check["rule"], check["level"]) for check in made["checks"]], [("part-unknown", "info")] * 13)
        for entry in made["pictures"]:
            key = entry["picture"]["key"]
            self.assertEqual(entry["picture"]["part"], "")
            self.assertRegex(key, r"^docs/03-user-flow/FL-\d{3}-[a-z0-9-]+\.md$")
            self.assertEqual(entry["picture"]["source"]["text"], (ROOT / key).read_bytes().decode("utf-8-sig"))


if __name__ == "__main__":
    if sys.argv[1:] == ["--write"]:
        text = json.dumps(hub_pictures(pinned_hub()), indent=1, ensure_ascii=False) + "\n"
        FIXTURE.write_text(text, encoding="utf-8", newline="\n")
        print("Wrote the pinned hub's pictures of docs/03-user-flow")
    else:
        unittest.main()
