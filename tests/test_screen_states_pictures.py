"""The stage-08 pictures that the screen-states drawer's test draws are the pinned hub's own pictures of docs/08-screens.

The screen-states drawer (TASK-426) draws each stage-08 picture the hub sends under corthex-hub/0.3: one picture per
screen definition, with the file's path as its key and its whole text as source.text, which NEXUS reads itself.
`server/test/screen-states.test.js` draws `server/test/screen-states-pictures.json`, the pictures the pinned hub makes
of this repository's docs/08-screens, and compares the drawings with the stored ones,
`server/test/screen-states-expected.json`. The server's tests run with Node alone, so this test makes the pictures again
with the pinned hub, the clean checkout at the commit of `hub-ref.json` that `CORTHEX_HUB_CHECKOUT` names (prepare it
with `python tools/fetch_hub_ref.py`), as its snapshot03.py makes them for this repository's stage 08 from the files of
the working tree: the stage source's Markdown files that define a screen, a translation beside its original and a
listing such as the README left out, each with the part its name gives. The pictures keep no commit or time, which
come from Git, and each has the SHA-256 of its file. It fails when the stored pictures differ: when a screen file
changed, was added or was removed, or when a new hub pin reads them otherwise. Nothing is fetched and no server is
contacted.

To make the two files again, from the repository's root:

    CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_screen_states_pictures.py --write
    (cd server && node test/screen-states-expected.js --write)
"""

import hashlib
import importlib.util
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from hub_ref import locate_hub  # noqa: E402

SCRIPTS = "plugins/corthex-nexus/skills/corthex-hub/scripts"
STAGE = "08-screen-states"
FIXTURE = ROOT / "server" / "test" / "screen-states-pictures.json"
ABOUT = ("The pinned hub's corthex-hub/0.3 pictures of this repository's docs/08-screens, as its snapshot03.py makes "
         "them, without the commit and time they take from Git, each with the SHA-256 of its file. "
         "tests/test_screen_states_pictures.py checks them against the pinned hub and says how to make them again.")
# The pictures' commit and time, which the stored pictures leave out.
COMMIT = "0" * 40
TIME = "2026-11-24T00:00:00+00:00"


class WorkingTree:
    """The repository's files as the hub's snapshot02.ObjectTree reads a commit's tree."""

    def __init__(self, hub):
        self.hub = hub
        self.sizes = {}

    def source_files(self, source, extensions):
        rel = source.rstrip("/")
        selected = sorted(path.relative_to(ROOT).as_posix() for path in (ROOT / rel).rglob("*")
                          if path.is_file() and path.suffix.lower() in extensions
                          and not self.hub.secret_path(path, ROOT))
        present = {Path(name) for name in selected}
        return [name for name in selected if not self.hub.original_of(Path(name), present)]

    def read(self, name):
        data = (ROOT / name).read_bytes()
        self.sizes[name] = len(data)
        if len(data) > self.hub.MAX_FILE_BYTES:
            return None
        return data.decode("utf-8-sig", "replace")


class Project:
    def __init__(self, settings):
        self.settings = settings


def hub_pictures():
    """What the fixture holds, as the pinned hub makes it now."""
    spec = importlib.util.spec_from_file_location("corthex_hub_pinned_screens", locate_hub() / SCRIPTS / "hub.py")
    hub = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(hub)
    settings = json.loads((ROOT / ".corthex" / "project.json").read_text(encoding="utf-8"))
    # Only stage 08: the other stages of corthex-hub/0.3, 03 and 09, are skipped as a project's settings skip a stage.
    stages = {key: {"skip": True} for key, *_ in hub.STAGES if key != STAGE}
    stages[STAGE] = settings["stages"][STAGE]
    hub.picture_ids = hub.IdFormat(settings.get("ids"))
    snapshot = {"pictures": [], "left_out": []}
    checks = []
    hub.companion("snapshot03").pictures(snapshot, Project({**settings, "stages": stages}), settings.get("parts") or [],
                                         WorkingTree(hub), {"commit": COMMIT, "time": TIME}, checks, hub)
    pictures = []
    for picture in snapshot["pictures"]:
        if picture.pop("commit") != COMMIT or picture.pop("time") != TIME:
            raise AssertionError("a picture keeps the commit and time it is given")
        picture["sha256"] = hashlib.sha256((ROOT / picture["key"]).read_bytes()).hexdigest()
        pictures.append(picture)
    return {"about": ABOUT, "source": settings["stages"][STAGE]["source"], "checks": checks,
            "left_out": snapshot["left_out"], "pictures": pictures}


class ScreenStatesPicturesTest(unittest.TestCase):
    def test_the_stored_pictures_are_the_pinned_hubs(self):
        stored = json.loads(FIXTURE.read_text(encoding="utf-8"))
        made = hub_pictures()
        again = "make them again as this file's docstring says"
        files = lambda pictures: [(picture["key"], picture["sha256"]) for picture in pictures]  # noqa: E731
        self.assertEqual(files(stored["pictures"]), files(made["pictures"]), f"the screen files changed since the stored pictures: {again}")
        self.assertEqual(stored, made, f"the pinned hub's pictures of docs/08-screens differ from the stored ones: {again}")


if __name__ == "__main__":
    if sys.argv[1:] == ["--write"]:
        text = json.dumps(hub_pictures(), indent=1, ensure_ascii=False) + "\n"
        FIXTURE.write_text(text, encoding="utf-8", newline="\n")
        print("Wrote the pinned hub's pictures of docs/08-screens")
    else:
        unittest.main()
