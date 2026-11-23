"""The stage-05 picture that the ERD drawer's test draws is the pinned hub's own picture of db/nexus.sql.

The ERD drawer (TASK-422) draws the stage-05 picture the hub sends, which the hub's erd.py parses from the project's
schema, so NEXUS parses no SQL. `server/test/erd.test.js` draws `server/test/erd-picture.json`, the picture the pinned
hub makes of db/nexus.sql, and compares the drawing with the stored one, `server/test/erd-expected.json`. The server's
tests run with Node alone, so this test makes the picture again with the pinned hub, the clean checkout at the commit of
`hub-ref.json` that `CORTHEX_HUB_CHECKOUT` names (prepare it with `python tools/fetch_hub_ref.py`), as the hub's
snapshot makes it for this repository's stage 05. It fails when the stored picture differs: when db/nexus.sql changed,
or when a new hub pin reads it otherwise. Nothing is fetched and no server is contacted.

To make the two files again, from the repository's root:

    CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_erd_picture.py --write
    (cd server && node test/erd-expected.js --write)
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
STAGE = "05-erd"
FIXTURE = ROOT / "server" / "test" / "erd-picture.json"
ABOUT = ("The pinned hub's stage-05 picture of db/nexus.sql, as its erd.py makes it, and the SHA-256 of the file. "
         "tests/test_erd_picture.py checks it against the pinned hub and says how to make it again.")


def hub_picture():
    """What the fixture holds, as the pinned hub makes it now."""
    spec = importlib.util.spec_from_file_location("corthex_hub_pinned_erd", locate_hub() / SCRIPTS / "hub.py")
    hub = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(hub)
    settings = json.loads((ROOT / ".corthex" / "project.json").read_text(encoding="utf-8"))
    source = settings["stages"][STAGE]["source"]
    data = (ROOT / source).read_bytes()
    # As the hub's snapshot reads a stage-05 source (its snapshot02.py): the project's trace ID formats, the part the
    # file's name gives, and the file's text decoded as it decodes a Git blob.
    hub.picture_ids = hub.IdFormat(settings.get("ids"))
    part = hub.companion("snapshot02").part_of(source, source, settings.get("parts") or [])
    checks = []
    picture = hub.parse_picture(STAGE, [(source, data.decode("utf-8-sig", "replace"))], checks, hub, part)
    return {"about": ABOUT, "source": source, "sha256": hashlib.sha256(data).hexdigest(), "part": part,
            "checks": checks, "picture": picture}


class ErdPictureTest(unittest.TestCase):
    def test_the_stored_picture_is_the_pinned_hubs(self):
        stored = json.loads(FIXTURE.read_text(encoding="utf-8"))
        made = hub_picture()
        again = "make it again as this file's docstring says"
        self.assertEqual(stored["sha256"], made["sha256"], f"db/nexus.sql changed since the stored picture: {again}")
        self.assertEqual(stored, made, f"the pinned hub's picture of db/nexus.sql differs from the stored one: {again}")


if __name__ == "__main__":
    if sys.argv[1:] == ["--write"]:
        text = json.dumps(hub_picture(), indent=1, ensure_ascii=False) + "\n"
        FIXTURE.write_text(text, encoding="utf-8", newline="\n")
        print("Wrote the pinned hub's picture of db/nexus.sql")
    else:
        unittest.main()
