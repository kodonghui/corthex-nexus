"""The stage-01 picture that the DDD board drawer's test draws is the pinned hub's own picture of docs/01-domain/.

The DDD board drawer (TASK-421) draws the stage-01 picture the hub sends, which the hub's domain.py parses from the
project's domain document; a push's Markdown is the hub's to read. `server/test/ddd-board.test.js` draws
`server/test/ddd-board-picture.json`, the picture the pinned hub makes of this repository's stage-01 source, and
compares the drawing with the stored one, `server/test/ddd-board-expected.json`. A proposal's source_text on stage 01
is Markdown that NEXUS reads itself (TASK-470), and `server/test/picture-readers.test.js` checks that its reader,
`server/src/domain-picture.js`, makes this same picture of the same documents. The server's tests run with Node
alone, so this test makes the picture again with the pinned hub, the clean checkout at the commit of `hub-ref.json`
that `CORTHEX_HUB_CHECKOUT` names (prepare it with `python tools/fetch_hub_ref.py`), as the hub's snapshot makes it
for this repository's stage 01: the stage source's Markdown files, a translation beside its original left out, each
by the part its name gives. It fails when the stored picture differs: when a stage-01 document changed, or when a new
hub pin reads it otherwise. Nothing is fetched and no server is contacted.

To make the two files again, from the repository's root:

    CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_ddd_board_picture.py --write
    (cd server && node test/ddd-board-expected.js --write)
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
STAGE = "01-domain"
EXTENSIONS = {".md", ".markdown"}
FIXTURE = ROOT / "server" / "test" / "ddd-board-picture.json"
ABOUT = ("The pinned hub's stage-01 picture of this repository's domain documents, as its domain.py makes it, with "
         "the SHA-256 of each document. tests/test_ddd_board_picture.py checks it against the pinned hub and says how "
         "to make it again.")


def hub_picture():
    """What the fixture holds, as the pinned hub makes it now."""
    spec = importlib.util.spec_from_file_location("corthex_hub_pinned_domain", locate_hub() / SCRIPTS / "hub.py")
    hub = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(hub)
    settings = json.loads((ROOT / ".corthex" / "project.json").read_text(encoding="utf-8"))
    source = settings["stages"][STAGE]["source"]
    # As the hub's snapshot reads a stage-01 source (its snapshot02.py): the Markdown files under it in the order of
    # their paths, a translation beside its original left out, grouped by the part each file's name gives, each
    # decoded as it decodes a Git blob, with the project's trace ID formats.
    names = sorted(path.relative_to(ROOT).as_posix() for path in (ROOT / source).rglob("*")
                   if path.is_file() and path.suffix.lower() in EXTENSIONS)
    present = {Path(name) for name in names}
    names = [name for name in names if not hub.original_of(Path(name), present)]
    hub.picture_ids = hub.IdFormat(settings.get("ids"))
    parts = settings.get("parts") or []
    groups = {}
    for name in names:
        groups.setdefault(hub.companion("snapshot02").part_of(name, source, parts), []).append(name)
    if len(groups) != 1:
        raise AssertionError("the stage-01 documents are expected to make one picture, of one part")
    [(part, files)] = groups.items()
    data = {name: (ROOT / name).read_bytes() for name in files}
    checks = []
    picture = hub.parse_picture(STAGE, [(name, data[name].decode("utf-8-sig", "replace")) for name in files], checks, hub, part)
    return {"about": ABOUT, "source": source, "part": part,
            "documents": [{"path": name, "sha256": hashlib.sha256(data[name]).hexdigest()} for name in files],
            "checks": checks, "picture": picture}


class DddBoardPictureTest(unittest.TestCase):
    def test_the_stored_picture_is_the_pinned_hubs(self):
        stored = json.loads(FIXTURE.read_text(encoding="utf-8"))
        made = hub_picture()
        again = "make it again as this file's docstring says"
        self.assertEqual(stored["documents"], made["documents"], f"the stage-01 documents changed since the stored picture: {again}")
        self.assertEqual(stored, made, f"the pinned hub's picture of the stage-01 documents differs from the stored one: {again}")


if __name__ == "__main__":
    if sys.argv[1:] == ["--write"]:
        text = json.dumps(hub_picture(), indent=1, ensure_ascii=False) + "\n"
        FIXTURE.write_text(text, encoding="utf-8", newline="\n")
        print("Wrote the pinned hub's picture of the stage-01 documents")
    else:
        unittest.main()
