"""The stage-09 picture that the mockup drawer's test draws is the pinned hub's own picture of the mockup page.

The mockup drawer (TASK-427) lists the tokens of the stage-09 picture the hub sends: in corthex-hub/0.3, the whole text
of the page that .corthex/project.json names, which NEXUS reads itself. `server/test/mockup.test.js` draws
`server/test/mockup-picture.json`, the picture the pinned hub makes of docs/09-mockup/nexus-combination.html, and compares the
drawing with the stored one, `server/test/mockup-expected.json`. The server's tests run with Node alone, so this test
makes the picture again with the pinned hub, the clean checkout at the commit of `hub-ref.json` that
`CORTHEX_HUB_CHECKOUT` names (prepare it with `python tools/fetch_hub_ref.py`), as the hub's snapshot makes it for this
repository's stage 09 (its snapshot03.py), from the working tree rather than from Git's objects. It fails when the
stored picture differs: when the page changed, or when a new hub pin reads it otherwise. The picture's commit and time
are the default branch's and left out. Nothing is fetched and no server is contacted.

To make the two files again, from the repository's root:

    CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_mockup_picture.py --write
    (cd server && node test/mockup-expected.js --write)
"""

import hashlib
import importlib.util
import json
import sys
import unittest
from pathlib import Path, PurePosixPath
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from hub_ref import locate_hub  # noqa: E402

SCRIPTS = "plugins/corthex-nexus/skills/corthex-hub/scripts"
STAGE = "09-mockup"
FIXTURE = ROOT / "server" / "test" / "mockup-picture.json"
ABOUT = ("The pinned hub's stage-09 picture of docs/09-mockup/nexus-combination.html, as its snapshot03.py makes it, and the "
         "SHA-256 of the file. tests/test_mockup_picture.py checks it against the pinned hub and says how to make it again.")
# The default branch's commit and time, which the picture carries and the fixture leaves out.
DEFAULT = {"commit": "0" * 40, "time": "2026-11-24T00:00:00+00:00"}


class WorkingTree:
    """The hub's tree of the default commit (snapshot02.ObjectTree), read from this checkout's files instead."""

    def __init__(self, names, h):
        self.h = h
        self.files = {name: name for name in names}
        self.sizes = {name: (ROOT / name).stat().st_size for name in names}

    def read(self, rel):
        if rel not in self.files or self.h.secret_path(ROOT / rel, ROOT) or self.sizes[rel] > self.h.MAX_FILE_BYTES:
            return None
        return (ROOT / rel).read_bytes().decode("utf-8-sig", "replace")

    def source_files(self, source, extensions):
        rel = source.rstrip("/")
        selected = [name for name in sorted(self.files)
                    if (name == rel or name.startswith(rel + "/")) and PurePosixPath(name).suffix.lower() in extensions and
                    not self.h.secret_path(ROOT / name, ROOT)]
        paths = set(Path(name) for name in selected)
        return [name for name in selected if not self.h.original_of(Path(name), paths)]


def hub_picture():
    """What the fixture holds, as the pinned hub makes it now."""
    spec = importlib.util.spec_from_file_location("corthex_hub_pinned_mockup", locate_hub() / SCRIPTS / "hub.py")
    hub = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(hub)
    settings = json.loads((ROOT / ".corthex" / "project.json").read_text(encoding="utf-8"))
    page = settings["stages"][STAGE]["page"]
    folder = PurePosixPath(page).parent
    names = sorted(str(PurePosixPath(*path.relative_to(ROOT).parts)) for path in (ROOT / folder).rglob("*") if path.is_file())
    hub.picture_ids = hub.IdFormat(settings.get("ids"))
    project = SimpleNamespace(settings=settings)
    snapshot = {"pictures": [], "left_out": []}
    checks = []
    hub.companion("snapshot03").pictures(snapshot, project, settings.get("parts") or [], WorkingTree(names, hub), DEFAULT, checks,
                                         hub, ROOT)
    pictures = [picture for picture in snapshot["pictures"] if picture["stage"] == STAGE]
    if len(pictures) != 1 or pictures[0]["key"] != page:
        raise AssertionError("the pinned hub makes no single picture of the page .corthex/project.json names")
    picture = {name: pictures[0][name] for name in ("part", "stage", "key", "source")}
    return {"about": ABOUT, "source": page, "sha256": hashlib.sha256((ROOT / page).read_bytes()).hexdigest(),
            "part": picture["part"], "checks": [check for check in checks if check.get("stage") == STAGE],
            "left_out": [entry for entry in snapshot["left_out"] if entry.get("stage") == STAGE], "picture": picture}


class MockupPictureTest(unittest.TestCase):
    def test_the_stored_picture_is_the_pinned_hubs(self):
        stored = json.loads(FIXTURE.read_text(encoding="utf-8"))
        made = hub_picture()
        again = "make it again as this file's docstring says"
        self.assertEqual(stored["sha256"], made["sha256"], f"docs/09-mockup/nexus-combination.html changed since the stored picture: {again}")
        self.assertEqual(stored, made, f"the pinned hub's picture of docs/09-mockup/nexus-combination.html differs from the stored one: {again}")


if __name__ == "__main__":
    if sys.argv[1:] == ["--write"]:
        text = json.dumps(hub_picture(), indent=1, ensure_ascii=False) + "\n"
        FIXTURE.write_text(text, encoding="utf-8", newline="\n")
        print("Wrote the pinned hub's picture of docs/09-mockup/nexus-combination.html")
    else:
        unittest.main()
